// ══════════════════════════════════════════════════════════════════════════
//  캐릭터 시제품 캡처 — 개선 전/후를 같은 순간에 찍는다.
//
//    python3 tools/serve.py &
//    node tools/actor-proto.js
//
//  결과: docs/audit3d/actors-<동작>.png   (다섯 동작 각각, 위=개선 전 / 아래=개선 후)
//        docs/audit3d/actors-sheet.png    (공격 순간 한 장 — 대표 컷)
//
//  동작마다 **가장 말이 되는 순간**을 골라 찍는다. 대기는 호흡이 들어찬 지점,
//  공격은 타격 직전(가장 크게 젖힌 곳), 피격은 맞은 직후 0.05초.
//  아무 데나 찍으면 「비슷해 보이는데?」로 끝난다.
// ══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137/3d';
const OUT = path.join(__dirname, '..', 'docs', 'audit3d');

// 동작 → **그 동작 한 번 안에서의** 진행도(0~1).
// 구간 전체 비율이 아니다 — 공격은 한 구간에서 세 번 반복하므로 0.30 을 주면
// 두 번째 휘두르기의 쉬는 틈에 떨어진다. 실제로 그렇게 찍어서 「공격 컷」에
// 가만히 선 캐릭터가 나왔다. (actors.js 의 timeFor 주석 참조)
const SHOTS = [
  { clip: 'idle', u: 0.30, why: '숨을 들이켠 지점' },
  { clip: 'walk', u: 0.44, why: '한쪽 무릎이 최대로 접힌 순간' },
  { clip: 'attack', u: 0.36, why: '가장 크게 젖힌 예비 동작 — 「무엇이 올지」가 보이는 구간' },
  { clip: 'attack2', clipName: 'attack', u: 0.52, why: '내려치는 도중 — 팔꿈치가 먼저 펴진다' },
  { clip: 'hit', u: 0.16, why: '맞은 직후 — 상체가 꺾이고 머리가 뒤따른다' },
  // 0.45 로 잡았더니 **개선 전 열이 통째로 비었다** — 옛 죽음은 0.55 초 만에
  // 줄어들어 사라지므로 그 시점에 이미 없다. 그건 정직한 비교이긴 하지만
  // 「사진이 깨졌다」로 읽힌다. 둘 다 보이는 지점으로 옮긴다.
  { clip: 'die', u: 0.28, why: '무릎이 풀리는 중 — 옛 쪽은 이미 줄어들며 사라지는 중이다' },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });

  const errs = [];
  const made = [];
  let stats = null;

  for (const s of SHOTS) {
    const p = await browser.newPage({ viewport: { width: 1700, height: 760 } });
    p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 250)));
    await p.goto(`${BASE}/actors.html?clip=${s.clipName || s.clip}&u=${s.u}`, { waitUntil: 'load' });
    await p.waitForFunction(() => window.ACTORS_READY === true, { timeout: 40000 });
    await p.waitForTimeout(2600);          // 소프트웨어 렌더링 — 첫 프레임이 느리다
    const file = path.join(OUT, `actors-${s.clip}.png`);
    await p.screenshot({ path: file });
    made.push({ file, why: s.why });
    if (!stats) {
      stats = await p.evaluate(() => window.ACTORS.panels.map((x) => ({
        key: x.cast.key, mode: x.mode, meshes: x.meshes, tris: Math.round(x.tris),
      })));
    }
    await p.close();
  }

  await browser.close();

  if (stats) {
    console.log('메시 · 삼각형 수 (개선 전 → 후)');
    const by = {};
    for (const s of stats) (by[s.key] ||= {})[s.mode] = s;
    for (const k of Object.keys(by)) {
      const o = by[k].old, n = by[k].new;
      console.log(`  ${k.padEnd(9)} 메시 ${String(o.meshes).padStart(2)} → ${String(n.meshes).padStart(2)}`
        + `   삼각형 ${String(o.tris).padStart(5)} → ${String(n.tris).padStart(5)}`
        + `   (×${(n.tris / o.tris).toFixed(1)})`);
    }
  }

  if (errs.length) {
    console.log('\n페이지 오류:');
    for (const e of [...new Set(errs)].slice(0, 6)) console.log('  ' + e);
    process.exit(1);
  }
  console.log('\n생성됨:');
  for (const m of made) console.log(`  ${path.relative(path.join(__dirname, '..'), m.file)}  — ${m.why}`);
})().catch((e) => { console.error(e); process.exit(1); });
