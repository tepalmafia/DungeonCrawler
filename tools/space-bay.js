// ══════════════════════════════════════════════════════════════════════════
//  베이 번호가 **붙었고 · 안 겹치고 · 읽히나** — 실제 브라우저에서.
//
//    python3 tools/serve.py 8391 &
//    node tools/space-bay.js
//
//  ★ 왜 브라우저인가
//    「번호를 붙였다」는 코드로 셀 수 있다. 하지만 이 일의 목적은
//    **「3번 베이」라고 부를 수 있게** 하는 것이고, 그건 **글자가 실제로
//    읽히느냐**로 갈린다. 붙었는데 1cm 짜리라 안 보이면 안 붙인 것과 같다.
//    그래서 세 가지를 묻는다:
//
//      [1] 다 붙었나 — 랙·패널에 빠짐없이
//      [2] 안 겹치나 — 한 방에 같은 번호가 둘이면 그건 번호가 아니다
//      [3] **읽히나** — 서서 봤을 때 글자가 화면에서 몇 화소인가
//
//    [3] 이 이 검사의 이유다. 나머지 둘은 세 줄이면 끝난다.
// ══════════════════════════════════════════════════════════════════════════
const PW = ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs'];
let chromium = null;
for (const m of PW) { try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ } }
if (!chromium) {
  console.error('playwright 가 없습니다.  npm i -g playwright  뒤에 다시 돌리세요.');
  process.exit(2);
}
const { PREFIX, PANEL_BAY, FIRST_RACK, PLATE, bay } = await import('../web/space/js/game/bay-table.js');
const PORT = process.argv[2] || '8391';
const SP = process.env.SHOTS || null;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 640, height: 380 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const S = (fn, a) => p.evaluate(fn, a);
// ══ ★★★ v121 — **한복판을 눈 감고 누르지 않는다** ═══════════════════
//
//  ★ 여기가 `mouse.click(320, 190)` 이었다. 시작 화면이 생기기 전에 쓴
//    줄인데, 지금은 한복판에 **단추가 서 있다.** 「처음부터 다시」를
//    누르면 `location.reload()` 가 돌고, 그러면 검사가
//    「Execution context was destroyed」로 통째로 죽는다.
//  ★★ 그래서 **누를 것을 이름으로 부른다.** 좌표로 누르는 줄은 화면이
//    바뀔 때마다 말없이 엉뚱한 것을 누르게 된다 — 이 저장소가
//    `space-check.js` 를 만든 이유가 바로 그것이었다
await p.click('#btn-play').catch(() => {});
await p.waitForTimeout(600);
await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });

// 배 안의 번호판을 전부 걷어 온다 — 이름이 `베이 …` 인 판들
const plates = await S(`(() => {
  const T = SPACE.THREE, out = [];
  SPACE.shipGroup.traverse((o) => {
    if (!o.userData?.bay?.text) return;
    const w = o.getWorldPosition(new T.Vector3());
    out.push({ text: o.userData.bay.text, glyph: o.userData.bay.glyph,
      x: +w.x.toFixed(2), y: +w.y.toFixed(2), z: +w.z.toFixed(2) });
  });
  return out;
})()`);

console.log('\n[1] 다 붙었나 — 랙과 점검 패널에 빠짐없이');
{
  ok(plates.length > 0, `번호판 ${plates.length} 장`);
  // 점검 패널은 **일곱 방 전부** 1번이어야 한다. 이게 이 일의 규칙이다
  const missing = Object.keys(PREFIX).filter((r) => !plates.some((q) => q.text === bay(r, PANEL_BAY)));
  ok(missing.length === 0,
    `일곱 방 전부 「${PANEL_BAY}번 = 점검 패널」 — ${missing.length ? `빠짐: ${missing.join(' · ')}` : '다 있다'}`);
  // 랙이 있는 방은 2번부터 이어져야 한다 (1번은 패널 몫)
  for (const room of ['observ', 'workshop', 'engine', 'spine']) {
    const ns = plates.filter((q) => q.text.startsWith(PREFIX[room] + ' '))
      .map((q) => +q.text.split(' ')[1]).sort((a, c) => a - c);
    const want = ns.map((_, i) => i + PANEL_BAY);
    ok(ns.length > 1 && ns.join() === want.join(),
      `${PREFIX[room]} — ${ns.join(' · ') || '없음'} (${PANEL_BAY}번부터 안 끊기고)`);
  }
}

console.log('\n[2] 안 겹치나 — 한 방에 같은 번호가 둘이면 번호가 아니다');
{
  const seen = new Map();
  const dup = [];
  for (const q of plates) {
    if (seen.has(q.text)) dup.push(q.text);
    seen.set(q.text, 1);
  }
  ok(dup.length === 0, `겹치는 번호 없음 — ${dup.length ? [...new Set(dup)].join(' · ') : '없음'}`);
}

console.log('\n[3] ★ **읽히나** — 붙었는데 안 읽히면 안 붙인 것이다');
{
  // 글자가 화면에서 몇 화소인가. 화면 세로 380 화소에 세로 화각 ~50도이므로
  // 1도 ≈ 7.6화소. 사람이 편히 읽는 한계가 시야각 0.25도쯤이니, 실제
  // 브라우저(1080p 세로)로 환산해 **글자 높이 ≥ 0.2도**를 기준으로 잡는다
  const deg = 2 * Math.atan(PLATE.glyph / 2 / PLATE.readAt) * 180 / Math.PI;
  ok(deg >= 0.2,
    `${PLATE.readAt}m 앞에서 글자가 ${deg.toFixed(2)}도 — 0.2도 이상이라야 읽힌다`);

  // 그리고 **실제로 화면에 그 크기로 나오나.** 위는 표의 약속이고
  // 이건 세상이 그 약속을 지켰나다 — 판을 작게 만들어 놓고 표만
  // 고쳐 두면 위 줄은 통과한다
  const near = await S(`(() => {
    const T = SPACE.THREE, cam = SPACE.camera;
    let best = null;
    SPACE.shipGroup.traverse((o) => {
      if (!o.userData?.bay?.text) return;
      const w = o.getWorldPosition(new T.Vector3());
      const g = new T.Box3().setFromObject(o).getSize(new T.Vector3());
      // 판의 세로 실치수 × (글자/판 비율) = 글자 실높이
      const h = Math.max(g.y, 0.001) * o.userData.bay.glyph / ${PLATE.h};
      const d = w.distanceTo(cam.getWorldPosition(new T.Vector3()));
      const item = { text: o.userData.bay.text, h: +h.toFixed(4), d: +d.toFixed(2) };
      if (!best || item.h < best.h) best = item;
    });
    return best;
  })()`);
  ok(!!near && near.h >= PLATE.glyph * 0.9,
    `제일 작은 글자가 ${near ? `${(near.h * 100).toFixed(1)}cm (${near.text})` : '없음'}`
    + ` — 표의 약속은 ${(PLATE.glyph * 100).toFixed(1)}cm`);
}

console.log('\n[4] 서서 보면 눈에 들어오나 — 기관실 랙 앞');
{
  // ★ 방향을 틀리면 검사가 게임을 탓한다. yaw 는 「앞이 -z」에서 재므로
  //   **+π/2 라야 -x 쪽 벽**을 본다. 처음에 -π/2 로 두고 「번호가 하나도
  //   안 보인다」를 받았는데, 그때 화면에는 반응로가 찍혀 있었다
  await S(() => SPACE.put(-3.0, 12.5, Math.PI / 2, 0));
  for (let i = 0; i < 30; i++) {
    const at = await S(() => {
      const q = SPACE.camera.getWorldPosition(new SPACE.THREE.Vector3());
      return Math.abs(q.x + 3.0) < 0.05 && Math.abs(q.z - 12.5) < 0.05;
    });
    if (at) break;
    await p.waitForTimeout(500);
  }
  const front = await S(`(() => {
    const T = SPACE.THREE, cam = SPACE.camera;
    const eye = cam.getWorldPosition(new T.Vector3());
    const out = [];
    SPACE.shipGroup.traverse((o) => {
      if (!o.userData?.bay?.text) return;
      const w = o.getWorldPosition(new T.Vector3());
      if (w.distanceTo(eye) > 3.2) return;
      // 화면 안에 들어오나 (NDC 가 -1..1)
      const n = w.clone().project(cam);
      if (Math.abs(n.x) > 1 || Math.abs(n.y) > 1 || n.z > 1) return;
      out.push(o.userData.bay.text);
    });
    return out;
  })()`);
  ok(front.length >= 2, `한 화면에 번호가 여럿 보인다 — ${front.join(' · ') || '하나도 안 보임'}`);
  if (SP) { await p.waitForTimeout(600); await p.screenshot({ path: `${SP}/베이번호.png` }); }
}

console.log('');
if (errs.length) { console.log('콘솔 오류:'); for (const e of errs.slice(0, 5)) console.log('  ' + e); fail += errs.length; }
else console.log('오류 없음');
console.log(fail ? `\n✘ ${fail} 군데` : '\n✔ 전부 통과');
if (SP) console.log(`  (${SP}/베이번호.png 저장)`);
await b.close();
process.exit(fail ? 1 : 0);
