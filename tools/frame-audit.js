// 화면 감사 (v200) — **내가 화면을 직접 본다.**
//
// 왜 만들었나: 회귀 검사 117개는 전부 '상태'를 본다. "패턴 5종이 시전됐다"는 검사는
// 그 5종이 전부 똑같은 원으로 그려지는 화면에서도 통과한다. 그래서 v187~v199 내내
// "검증 통과"로 보고됐고, 화면을 실제로 본 사람은 사장뿐이었다.
// 이 도구는 보스전을 돌리며 (1) 프레임을 PNG로 저장하고 (2) 픽셀 색을 세고
// (3) 그리기 호출을 도형별로 태그해 집계한다.
//
//   node tools/frame-audit.js [층...]        기본 1 2 3
//   결과: docs/audit/f<층>-*.png + 표준출력 집계
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const FLOORS = (process.argv.slice(2).length ? process.argv.slice(2) : ['1', '2', '3']).map(Number);
const OUT = path.join(__dirname, '..', 'docs', 'audit');
const SECONDS = 13;        // 기획안 지표: '13초 안에 목격하는 것'
const SHOTS = 6;           // 균등 간격 스냅샷

// 캔버스 그리기 호출을 도형으로 분류하는 계측 훅.
// 실제 화면에 나간 것만 센다 — 생성기가 아니라 소비자(렌더)를 잰다.
const PROBE = `
(() => {
  const ctx = Renderer.ctx;
  const R = { shapes: {}, calls: 0 };
  window.__audit = R;
  const bump = (k) => { R.shapes[k] = (R.shapes[k] || 0) + 1; R.calls++; };
  // arc(): 반지름과 시작/끝 각으로 원 / 호 / 고리를 구분
  const _arc = ctx.arc.bind(ctx);
  ctx.arc = function (x, y, r, a0, a1, ccw) {
    const span = Math.abs(a1 - a0);
    if (r >= 14) bump(span > 6.2 ? 'circle' : span > 0.35 ? 'arc' : 'dot');
    return _arc(x, y, r, a0, a1, ccw);
  };
  // fillRect(): 화면 폭의 절반 이상이면 '전면 붉은 영역'류
  const _fr = ctx.fillRect.bind(ctx);
  ctx.fillRect = function (x, y, w, h) {
    if (Math.abs(w) > 300 && Math.abs(h) > 200) bump('slab');
    else if (Math.abs(w) > 40 || Math.abs(h) > 40) bump('bar');
    return _fr(x, y, w, h);
  };
  // 굵은 stroke = 띠(선형 위험). lineWidth로 판별
  const _st = ctx.stroke.bind(ctx);
  ctx.stroke = function () { if (ctx.lineWidth >= 40) bump('band'); return _st(); };
  // 다각형 채우기 = 부채꼴/파편/불꽃 등 비원형
  const _fl = ctx.fill.bind(ctx);
  ctx.fill = function (p) { return p ? _fl(p) : _fl(); };
  R.reset = () => { R.shapes = {}; R.calls = 0; };
})();
`;

// 화면 지배색 히스토그램 — 12색 팔레트로 양자화해 '몇 가지 색이 보이는가'를 센다
function dominant(buf, w, h) {
  const BUCKET = {};
  for (let i = 0; i < buf.length; i += 4) {
    const r = buf[i], g = buf[i + 1], b = buf[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx < 60) continue;                       // 어두운 배경 제외
    if (mx - mn < 42) continue;                  // 무채색(돌바닥·UI) 제외
    let hue;
    if (mx === r) hue = ((g - b) / (mx - mn) + 6) % 6;
    else if (mx === g) hue = (b - r) / (mx - mn) + 2;
    else hue = (r - g) / (mx - mn) + 4;
    const deg = Math.round(hue * 60);
    const name = deg < 15 || deg >= 345 ? '적' : deg < 45 ? '주' : deg < 75 ? '황'
      : deg < 165 ? '녹' : deg < 200 ? '청록' : deg < 255 ? '청' : deg < 290 ? '보라' : '자홍';
    BUCKET[name] = (BUCKET[name] || 0) + 1;
  }
  const total = Object.values(BUCKET).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(BUCKET)
    .map(([k, v]) => [k, v / total])
    .filter(([, v]) => v >= 0.06)                // 6% 미만은 '보인다'고 치지 않는다
    .sort((a, b) => b[1] - a[1]);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME });
  const report = [];
  for (const fl of FLOORS) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
    await page.goto(`${BASE}/?test=1&bot=1&botloop=1`);
    await page.waitForFunction(() => typeof Game !== 'undefined' && typeof Sprites !== 'undefined');
    await page.evaluate(() => {
      localStorage.clear(); Meta.load(); Meta.data.introSeen = true;
      Meta.data.classes = { knight: true, archer: true, mage: true, alch: true };
      Meta.save();
    });
    await page.reload();
    await page.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'play');
    await page.evaluate((f) => {
      Dungeon.floor = f; Dungeon.roomIndex = Dungeon.totalRooms; Dungeon.build('boss');
    }, fl);
    await page.evaluate(PROBE);
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__audit.reset());

    const shapeSeen = {}, colorSeen = {};
    const shots = [];
    for (let s = 0; s < SHOTS; s++) {
      await page.waitForTimeout((SECONDS * 1000) / SHOTS);
      const f = path.join(OUT, `f${fl}-${s}.png`);
      await page.screenshot({ path: f });
      shots.push(f);
      const sh = await page.evaluate(() => {
        const r = { ...window.__audit.shapes };
        window.__audit.reset();
        return r;
      });
      for (const k of Object.keys(sh)) shapeSeen[k] = (shapeSeen[k] || 0) + sh[k];
      // 픽셀 색 — 캔버스에서 직접 읽는다.
      // ★ 히스토그램은 **페이지 안에서** 센다. 2M짜리 픽셀 배열을 노드로 넘기면
      //   직렬화만 수십 초가 걸려 도구 자체가 멈춘다 (첫 시도에서 실측).
      //   (문자열이 function 으로 시작하면 playwright가 '호출할 함수'로 오인한다 → 화살표로 감싼다)
      const hist = await page.evaluate(`(() => {
        const dominant = ${String(dominant)};
        const c = Renderer.canvas || document.querySelector('canvas');
        const g = c.getContext('2d');
        return dominant(g.getImageData(0, 0, c.width, c.height).data);
      })()`);
      for (const [n, v] of hist) colorSeen[n] = Math.max(colorSeen[n] || 0, v);
    }
    const st = await page.evaluate(() => {
      const b = Game.enemies.find((e) => e.isBoss);
      const p = Game.player;
      return {
        alive: !!b && !b.dead,
        bossHp: b ? Math.round((b.hp / b.maxHp) * 100) : null,
        zones: Game.zones.length, patches: Game.firePatches.length,
        // 보스가 플레이어에게 건 상태이상 종수 (현재 코드에 있는 필드 전수)
        statuses: ['slowT', 'burnT', 'freezeT', 'poisonT', 'shockT', 'curseT']
          .filter((k) => (p[k] || 0) > 0),
      };
    });
    report.push({ fl, shapeSeen, colorSeen, st, errs, shots });
    await page.close();
  }
  await browser.close();

  console.log('\n════ 화면 감사 (보스전 13초) ════');
  for (const r of report) {
    const sh = Object.entries(r.shapeSeen).sort((a, b) => b[1] - a[1]);
    const tot = sh.reduce((a, b) => a + b[1], 0) || 1;
    const distinct = sh.filter(([, v]) => v / tot >= 0.05).length;
    console.log(`\n── ${r.fl}층 보스 ──`);
    console.log(`  도형   ${sh.map(([k, v]) => `${k} ${(v / tot * 100).toFixed(0)}%`).join(' · ')}`);
    console.log(`  → 5% 이상 차지한 서로 다른 도형: ${distinct}`);
    const co = Object.entries(r.colorSeen).sort((a, b) => b[1] - a[1]);
    console.log(`  색상   ${co.map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(' · ')}`);
    console.log(`  → 화면 지배 색상 종수: ${co.length}`);
    console.log(`  바닥   보스 장판 ${r.st.zones} · 잔여물 ${r.st.patches}`);
    console.log(`  상태   플레이어가 받은 상태이상: ${r.st.statuses.length ? r.st.statuses.join(',') : '없음'}`);
    if (r.errs.length) console.log(`  ⚠ 에러 ${r.errs.length}: ${r.errs[0]}`);
  }
  console.log(`\n스크린샷: ${OUT}`);
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
