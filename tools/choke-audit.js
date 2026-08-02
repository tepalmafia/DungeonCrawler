// ══════════════════════════════════════════════════════════════════════════
//  길목 함정 점검 — 「층 표에 적은 chokeTraps 가 실제로 놓이는가」
//
//    python3 tools/serve.py 8137 &   node tools/choke-audit.js
//
//  ★ 왜 필요한가
//    층 표는 길목 함정을 층당 3~8개로 적어 뒀는데 **한 개도 안 놓이고 있었다.**
//    조건이 「양옆이 바로 벽인 칸」이었는데 복도 폭이 2칸이라 그런 칸이
//    층 전체에 없었다. 오류도 로그도 없이 설계 절반이 죽어 있었다.
//
//    숫자를 표에 적는 것과 그 숫자가 화면에 나오는 것은 다른 일이다.
//    그 사이를 이 도구가 잇는다.
//
//  재는 것:
//    · 층별 길목 후보 수 · 실제로 놓인 길목 수 (표의 chokeTraps 와 비교)
//    · **막힘 검사** — 길목 함정을 밟지 않고 지나갈 수 있는가.
//      「돌아갈 길이 없다」가 이 함정의 존재 이유이므로 이게 진짜 검사다.
//      함정 반경 안에 들어가지 않고 통과하는 경로가 있으면 그 길목은 헛것이다.
// ══════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright-core');

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137/3d';
const SEEDS = ['CHOKE01', 'CHOKE02', 'CHOKE03', 'CHOKE04', 'CHOKE05'];

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));

  await page.goto(`${BASE}/index.html?seed=CHOKE&autostart=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.G3 && window.G3.state === 'play', { timeout: 45000 });

  const rows = await page.evaluate(async (SEEDS) => {
    const dun = await import('./js/world/dungeon.js');
    const fl = await import('./js/world/floors.js');
    const tr = await import('./js/world/traps.js');
    const out = [];

    // 함정 종류별 피해 반경 — traps.js 의 정의를 그대로 읽는다
    const RAD = {};
    for (const [k, v] of Object.entries(tr.TRAP_KINDS || {})) RAD[k] = v.radius;

    for (let f = 1; f <= 9; f++) {
      const F = fl.floorDef(f);
      let candSum = 0, placedSum = 0, pairSum = 0, bypassSum = 0, n = 0;
      for (const seed of SEEDS) {
        const dg = dun.generate(f, seed);
        n++;
        // 길목 후보 다시 세기 (생성기와 같은 규칙)
        const at = dg.at;
        let cand = 0;
        for (let y = 2; y < dg.h - 2; y++)
          for (let x = 2; x < dg.w - 2; x++) {
            if (at(x, y) !== 1) continue;
            if (at(x - 1, y) === 2 && at(x + 1, y) === 2) { cand++; continue; }
            if (at(x, y - 1) === 2 && at(x, y + 1) === 2) { cand++; continue; }
            if (at(x, y - 1) === 2 && at(x, y + 1) === 1 && at(x, y + 2) === 2) cand++;
            if (at(x - 1, y) === 2 && at(x + 1, y) === 1 && at(x + 2, y) === 2) cand++;
          }
        candSum += cand;

        // **길목 봉쇄로 놓은 것만** 센다. 흩뿌린 함정이 우연히 복도에 떨어질
        // 수 있는데, 그건 원래 피할 수 있는 함정이라 같이 세면 판정이 흐려진다.
        const chokeTraps = dg.traps.filter((t) => t.choke);
        placedSum += chokeTraps.length;

        // 짝을 이루는가 — 바로 옆 칸에 같은 종류가 있으면 단면을 막은 것이다
        let paired = 0;
        for (const t of chokeTraps) {
          if (dg.traps.some((o) => o !== t && o.kind === t.kind
            && Math.abs(o.gx - t.gx) + Math.abs(o.gz - t.gz) === 1)) paired++;
        }
        pairSum += paired;

        // **우회 가능한 길목** — 함정 반경 밖으로 그 칸의 단면을 지날 수 있는가.
        // 폭 2칸 복도에서 한 칸만 막혀 있고 반경이 옆 차선(2.0 유닛)에 못 닿으면 헛것이다.
        let bypass = 0;
        for (const t of chokeTraps) {
          const r = RAD[t.kind] ?? 1.5;
          if (r >= 2.0) continue;                 // 반경만으로 옆 차선을 덮는다
          const mate = dg.traps.some((o) => o !== t
            && Math.abs(o.gx - t.gx) + Math.abs(o.gz - t.gz) === 1);
          if (!mate) bypass++;                    // 짝도 없고 반경도 모자라다
        }
        bypassSum += bypass;
      }
      out.push({
        f, want: F.chokeTraps,
        cand: +(candSum / n).toFixed(1),
        placed: +(placedSum / n).toFixed(1),
        paired: +(pairSum / n).toFixed(1),
        bypass: +(bypassSum / n).toFixed(1),
      });
    }
    return out;
  }, SEEDS);

  console.log(`\n시드 ${SEEDS.length}개 평균\n`);
  console.log('층  표(길목)  후보칸  놓인 길목함정  단면 짝  ★우회가능');
  for (const r of rows)
    console.log(String(r.f).padStart(2) + String(r.want).padStart(9) + String(r.cand).padStart(9)
      + String(r.placed).padStart(14) + String(r.paired).padStart(9) + String(r.bypass).padStart(10));
  console.log('\n우회가능 = 반경도 모자라고 짝도 없는 길목 함정. **0 이어야 한다** —');
  console.log('돌아갈 길이 있으면 「해제할까 밟을까」라는 판단이 안 생긴다.');

  if (errs.length) console.log('\nERR ' + [...new Set(errs)].slice(0, 3).join(' | '));
  await browser.close();
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
