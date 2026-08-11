// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **화면을 누가 얼마나 먹나** (v103)
//
//    python3 tools/serve.py 8391 &
//    node tools/space-screen.js
//
//  ★ 사장님 「**광학창이랑 배 상태창이랑 레이더 등이 화면을 너무 가리는데?
//    전투화면이 더 광할하고 방해되지 않는 선에서 재배치**해줘」
//
//  ══ 왜 진짜 브라우저인가 ══════════════════════════════════════════════
//
//  「가린다」는 **화면의 말**이다. 뼈대만 재는 도구는 「판이 어디 있나」는
//  알아도 「그 판이 하늘의 어디를 덮나」는 모른다 — 그건 **진짜 카메라와
//  진짜 메시**를 투영해야 나온다 (`space-align.js` 와 같은 규약).
//
//  ★★ 그리고 **판이 아니라 그룹인 것이 있다** (광학창). 처음에
//    `geometry.parameters` 로 재다가 광학창이 **화면의 95%**라는 값을 얻고
//    하마터면 그 숫자로 자리를 옮길 뻔했다 — 그룹은 크기가 거기 없다.
//    `Box3` 로 고쳤다. **재는 것이 화면과 다르면 그 숫자로 고치면 안 된다**
// ══════════════════════════════════════════════════════════════════════════
import {
  CONE, BUDGET, PANELS, hitsCone, isCut, overlaps, inCorner,
} from '../web/space/js/game/screen-table.js';

const PORT = process.env.PORT ?? '8391';
let chromium = null;
for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
  try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ }
}
if (!chromium) { console.log('playwright 가 없습니다'); process.exit(0); }

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

console.log('화면을 누가 얼마나 먹나 — 진짜 카메라 · 진짜 메시');

const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!globalThis.SPACE, null, { timeout: 60000 });
  const S = (f, a) => p.evaluate(f, a);

  await S(() => SPACE.clearSave());
  await p.click('#btn-play').catch(() => {});
  await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });
  await p.waitForTimeout(1200);
  // ★ 앉아야 계기가 켜진다 — **가리는 것을 재려면 켜져 있어야 한다**
  await S(() => SPACE.put(0, -7.10, 0, -0.55));
  await p.waitForTimeout(400);
  await S(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
  await p.waitForTimeout(250);
  await S(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
  for (let i = 0; i < 40; i++) {
    if (await S(() => SPACE.helm2.k) > 0.99) break;
    await p.waitForTimeout(200);
  }
  ok(await S(() => SPACE.helm2.k) > 0.99, '조종석에 앉았다 — 계기가 다 켜졌다');

  const P = await S(() => SPACE.panels());

  console.log('\n   판        복판 (x, y)      넓이     덮는 각      원뿔  잘림');
  let sum = 0;
  for (const [name, spec] of Object.entries(PANELS)) {
    const q = P[name];
    if (!q) { console.log(`   ${name}  — 안 보인다`); continue; }
    if (name !== '조준경') sum += q.area;
    console.log(`   ${name}  (${String(q.cx).padStart(6)},${String(q.cy).padStart(6)})`
      + `  ${(q.area * 100).toFixed(1).padStart(5)}%`
      + `  ${String(q.degH).padStart(5)}×${String(q.degV).padEnd(5)}°`
      + `  ${hitsCone(q) ? '★건드림' : '  비었음'}`
      + `  ${isCut(q) ? '★잘림' : '   —'}`);
    void spec;
  }

  console.log('');
  // ══ ① 전투 원뿔 — 겨누는 눈이 판에 걸리나 ═══════════════════════════
  const intruders = Object.entries(PANELS)
    .filter(([n, s]) => !s.inCone && P[n] && hitsCone(P[n])).map(([n]) => n);
  ok(!intruders.length,
    `★★★ **복판 ${CONE} 안에 조준경 말고는 없다** ${intruders.length ? `— ${intruders.join(' · ')} 가 들어와 있다` : ''}`
    + ' (사장님 「전투화면이 더 광활하게」가 이 한 줄이다)');
  // ══ ② 잘림 — 가리는 것과 **다른 병**이다 ════════════════════════════
  const cut = Object.keys(PANELS).filter((n) => P[n] && isCut(P[n]));
  ok(!cut.length,
    `★★★ **화면 밖으로 잘린 판이 없다** ${cut.length ? `— ${cut.join(' · ')}` : ''}`
    + ' — 사장님 사진에서 레이더 아랫줄이 잘려 있었다. 잘린 계기는 없는 계기다');
  // ══ ③ 넓이 — 셋을 합쳐서 ═══════════════════════════════════════════
  ok(sum <= BUDGET,
    `★★ **계기 셋이 화면의 ${(sum * 100).toFixed(1)}%** (${(BUDGET * 100).toFixed(0)}% 이하)`);
  for (const [name, spec] of Object.entries(PANELS)) {
    if (!P[name]) continue;
    ok(P[name].area <= spec.area,
      `   ${name} ${(P[name].area * 100).toFixed(1)}% ≤ ${(spec.area * 100).toFixed(1)}%`);
  }
  // ══ ④ 구석 — 제자리에 있나 ═════════════════════════════════════════
  for (const name of Object.keys(PANELS)) {
    if (!P[name] || name === '조준경') continue;
    ok(inCorner(name, P[name]), `   ${name} 이 제 구석에 있다 (${PANELS[name].what})`);
  }
  // ══ ⑤ 겹침 — 둘이 겹치면 둘 다 못 읽는다 ═══════════════════════════
  const names = Object.keys(PANELS).filter((n) => P[n]);
  const laps = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      if (overlaps(P[names[i]], P[names[j]])) laps.push(`${names[i]}×${names[j]}`);
    }
  }
  ok(!laps.length, `★ **판끼리 안 겹친다** ${laps.length ? `— ${laps.join(' · ')}` : ''}`);

  ok(!errs.length, `콘솔에 오류가 없다 ${errs.length ? errs.slice(0, 2).join(' · ') : ''}`);
} finally { await b.close(); }

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전투 화면이 비어 있다');
process.exit(bad ? 1 : 0);
