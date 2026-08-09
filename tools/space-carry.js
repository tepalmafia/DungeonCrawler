// ══════════════════════════════════════════════════════════════════════════
//  옮길 수 있는 물건이 **정말 손을 묶나** — 브라우저 없이.
//
//    node tools/space-carry.js            숫자만 (1초)
//    node tools/space-carry.js --see 8391  + 화면 (serve.py 를 먼저 띄운다)
//
//  ★ 이 계통이 게임이 되는 지점은 하나다: **한 번에 하나.**
//    두 손으로 안고 있으면 아무 손잡이도 못 잡는다. 그래서 냉매통을
//    들고 가는 길에 문이 끼면 **통을 어딘가 붙여 놓아야** 한다.
//    그게 안 되면 이건 그냥 「인벤토리」이고, 인벤토리는 이 게임에
//    아무것도 안 보탠다.
//
//  ★ 그래서 여기서 재는 것은 넷이다:
//      [1] 떼고 붙이는 것이 **자리에서만** 되나
//      [2] 두 손으로 안으면 **정말 못 잡나** · 그런데 내려놓기는 되나
//      [3] 놓으면 **되돌아가나** (배 안의 모든 「잡고 있기」와 같은 규약)
//      [4] 고장이 물건을 주고 먹나 — 「챙긴다 → 갈아 넣는다」가 말뿐이 아닌가
// ══════════════════════════════════════════════════════════════════════════
import { KINDS, SPOTS, CARRY, canGrab, carryPlan } from '../web/space/js/game/carry-table.js';
import { makeCarry, carryStep, atSpot, spotsIn, give, take, summary } from '../web/space/js/game/carry.js';
import { MISSIONS } from '../web/space/js/game/mission-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DT = 1 / 60;
/** 자리를 잡고 있는다 — 몇 초, 아니면 결과가 날 때까지 */
function hold(c, spot, sec) {
  let t = 0, out = null;
  while (t < sec) { out = carryStep(c, spot, true, DT) ?? out; t += DT; }
  return out;
}

console.log('\n[1] 떼고 붙이는 것이 **자리에서만** 된다');
{
  const c = makeCarry();
  ok(c.items.every((it) => it.spot), '처음엔 전부 어딘가 붙어 있다 — 떠다니는 것으로 시작하지 않는다');
  ok(new Set(c.items.map((it) => it.spot)).size === c.items.length,
    `한 자리에 하나씩 — ${c.items.map((it) => `${KINDS[it.kind].name}@${it.spot}`).join(' · ')}`);

  const first = c.items[0];
  // ★ **자리 이름을 미리 붙잡아 둔다.** 처음엔 뗀 뒤에 `first.spot` 을
  //   다시 읽었는데, 그때는 이미 null 이라 `atSpot(c, null)` 이 방금 뗀
  //   그 물건을 도로 찾아 왔다 — 검사가 「자리가 안 비었다」로 나왔다.
  //   게임이 아니라 검사가 틀린 것이었다
  const was = first.spot;
  ok(hold(c, was, CARRY.pull + 0.1) === 'pulled',
    `${CARRY.pull}초 잡으니 떨어진다 — ${KINDS[first.kind].name}`);
  ok(c.held === first.kind && !atSpot(c, was), '손에 들렸고 자리는 비었다');

  // 이미 뭐가 붙어 있는 자리에는 못 붙인다
  const taken = c.items.find((it) => it.spot)?.spot;
  ok(hold(c, taken, CARRY.stick + 0.4) === null, `이미 찬 자리에는 안 붙는다 — ${taken}`);
  ok(c.held === first.kind, '그 사이에 손에서 사라지지도 않는다');

  const empty = SPOTS.find((s) => !atSpot(c, s.key)).key;
  ok(hold(c, empty, CARRY.stick + 0.1) === 'stuck', `빈 자리에는 ${CARRY.stick}초에 붙는다 — ${empty}`);
  ok(!c.held && atSpot(c, empty)?.kind === first.kind, '손이 비고 자리가 찼다');

  // 자리가 아닌 곳에서는 아무 일도 안 난다
  const c2 = makeCarry();
  ok(hold(c2, null, 3) === null && !c2.held, '자리가 아니면 아무 일도 안 난다');
}

console.log('\n[2] ★ 두 손으로 안으면 **정말 못 잡는다** — 여기가 이 계통의 전부다');
{
  ok(canGrab(null, 'valve'), '빈손이면 밸브를 잡는다');
  const two = Object.keys(KINDS).filter((k) => KINDS[k].both);
  const one = Object.keys(KINDS).filter((k) => !KINDS[k].both);
  ok(two.length > 0 && one.length > 0,
    `두 손짜리 ${two.map((k) => KINDS[k].name).join('·')} / 한 손짜리 ${one.map((k) => KINDS[k].name).join('·')}`);

  for (const aim of ['valve', 'yoke', 'thrust', 'crank:engine', 'winch']) {
    ok(!canGrab(two[0], aim), `${KINDS[two[0]].name} 를 안고는 ${aim} 를 못 잡는다`);
  }
  // ★ 그런데 **내려놓기는 돼야 한다.** 아니면 영영 못 놓는다
  ok(canGrab(two[0], 'spot:shop-a'), `안고 있어도 **붙이는 자리**는 잡힌다 — 아니면 영영 못 놓는다`);
  // 한 손짜리는 들고도 일한다
  ok(canGrab(one[0], 'crank:engine'), `${KINDS[one[0]].name} 는 들고도 크랭크를 돌린다`);
}

console.log('\n[3] 놓으면 되돌아간다 — 배 안의 모든 「잡고 있기」와 같은 규약');
{
  const c = makeCarry();
  const spot = c.items[0].spot;
  let t = 0;
  while (t < CARRY.pull * 0.7) { carryStep(c, spot, true, DT); t += DT; }
  const peak = c.t;
  ok(peak > 0 && !c.held, `${(CARRY.pull * 0.7).toFixed(2)}초 잡았다 (${peak.toFixed(2)})`);
  let u = 0;
  while (u < 2) { carryStep(c, spot, false, DT); u += DT; }
  ok(c.t === 0 && c.doing === null, '놓으니 0 으로 돌아왔다 — 딱 멈추면 손을 뗄 이유가 없다');
}

console.log('\n[4] 고장이 물건을 주고 먹는다 — 「챙긴다 → 갈아 넣는다」가 말뿐이 아니다');
{
  // 두 걸음짜리 고장이 실제로 몇 개나 「챙긴다」로 시작하나
  const two = MISSIONS.filter((m) => (m.steps ?? []).length >= 2);
  const pairs = two.filter((m) => carryPlan(m.steps));
  ok(pairs.length >= 4,
    `「챙긴다 → 쓴다」로 짜인 고장 ${pairs.length} 종 — `
    + pairs.map((m) => `${m.name}(${KINDS[carryPlan(m.steps).kind].name})`).join(' · '));

  const c = makeCarry();
  ok(give(c, 'coolant') && c.held === 'coolant', '「챙긴다」를 마치면 손에 들린다');
  ok(!give(c, 'part'), '이미 들었으면 또 못 받는다 — 손은 하나다');
  ok(!take(c, 'part'), '안 들고 있는 것은 못 넣는다 — 이게 「챙긴다」를 진짜로 만든다');
  ok(take(c, 'coolant') && !c.held, '「갈아 넣는다」를 마치면 손이 빈다');
  ok(c.items.find((x) => x.kind === 'coolant').spot === 'shop-a',
    '쓴 물건은 정비실 제자리로 돌아간다 — 배에서 없어지면 다음 회차에 못 고친다');
}

console.log('\n[5] 자리가 배 안에 흩어져 있다 — 한 방에 몰리면 「어디 뒀더라」가 없다');
{
  const rooms = [...new Set(SPOTS.map((s) => s.room))];
  ok(rooms.length >= 3, `자리가 있는 방 ${rooms.length} — ${rooms.join(' · ')}`);
  // ★ 이름이 **실제로 있는 베이**여야 한다. 없는 번호를 적으면 world/carry.js
  //   가 자리를 못 찾고, 그러면 물건을 영영 못 놓는다. 세상은 브라우저에서
  //   확인하지만(아래 space-carry 는 순수다) 적어도 꼴은 여기서 본다
  ok(spotsIn('engine').length >= 1, '기관실에도 붙일 데가 있다 — 가서 내려놓을 수 있어야 한다');
  // 자리 이름이 **베이 번호**여야 한다. 「저기 어디」가 아니라 「기관 4」
  ok(SPOTS.every((s) => /^[가-힣]{2} \d+$/.test(s.name)),
    `이름이 전부 베이 번호다 — ${SPOTS.map((s) => s.name).join(' · ')}`);
}

// ══════════════════════════════════════════════════════════════════════════
//  여기부터는 **화면**이다 — `--see` 를 줬을 때만 돈다.
//
//  ★ 위의 숫자가 다 맞아도 「자리가 벽 속에 있다」·「든 물건이 화면을
//    덮는다」는 하나도 안 걸린다. 크랭크가 벽에 파묻혀 있던 것도,
//    조종간이 콘솔에 가려 있던 것도 전부 숫자로는 초록이었다.
// ══════════════════════════════════════════════════════════════════════════
const see = process.argv.indexOf('--see');
if (see >= 0) {
  const PORT = process.argv[see + 1] || '8391';
  const SP = process.env.SHOTS || null;
  let chromium = null;
  for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ }
  }
  if (!chromium) { console.error('playwright 가 없습니다.'); process.exit(2); }
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 380 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const cons = []; p.on('console', (m) => { if (m.type() === 'warning') cons.push(m.text()); });
  await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  const S = (fn, a) => p.evaluate(fn, a);
  await p.click('#btn-play').catch(() => p.mouse.click(320, 190));
  await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });

  console.log('\n[6] 자리가 **세상에 정말 있나** — 없으면 물건을 영영 못 놓는다');
  {
    const c = await S(() => SPACE.carry);
    ok(c.spots.length === SPOTS.length,
      `자리 ${c.spots.length}/${SPOTS.length} 개를 찾았다 — ${c.spots.join(' · ')}`);
    // ★ 못 찾은 자리가 있으면 world/carry.js 가 콘솔에 경고를 낸다.
    //   그 경고가 **실제로 안 나오는지**를 본다 — 조용히 넘어가면 안 된다
    ok(!cons.some((t) => /붙일 자리를 못 찾/.test(t)),
      `자리를 못 찾았다는 경고가 없다 — ${cons.filter((t) => /carry/.test(t)).join(' | ') || '없음'}`);
  }

  console.log('\n[7] 손에 든 것이 **보이되 화면을 안 덮는다**');
  {
    ok(await S(() => SPACE.giveItem('coolant')), '냉매통을 손에 쥔다');
    // 카메라의 자식이라 **카메라가 장면에 없으면 코드는 다 도는데 그림이
    // 없다.** 손목에서 겪은 것과 같은 함정이라 따로 묻는다
    let on = false;
    for (let i = 0; i < 20; i++) { await p.waitForTimeout(500); on = (await S(() => SPACE.carry)).onScreen; if (on) break; }
    ok(on, '든 물건이 화면(카메라)에 붙었다');

    const box = await S(`(() => {
      const T = SPACE.THREE, cam = SPACE.camera;
      const g = SPACE.heldMesh;
      if (!g) return null;
      const bb = new T.Box3().setFromObject(g);
      const pts = [];
      for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
        pts.push(new T.Vector3(x, y, z).project(cam));
      }
      const xs = pts.map((v) => v.x), ys = pts.map((v) => v.y);
      return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    })()`);
    ok(!!box, `화면에서 차지하는 자리 ${box ? `x ${box.x0.toFixed(2)}~${box.x1.toFixed(2)} · y ${box.y0.toFixed(2)}~${box.y1.toFixed(2)}` : '못 잼'}`);
    if (box) {
      // 가운데(조준선)를 안 가려야 한다. 화면 한가운데는 0,0 이다
      const covers = box.x0 < 0.12 && box.x1 > -0.12 && box.y0 < 0.12 && box.y1 > -0.12;
      ok(!covers, '조준선 한가운데를 안 가린다');
      // 화면 넓이의 얼마를 먹나 — 표의 약속(CARRY.cover) 안이어야 한다
      const area = Math.max(0, Math.min(1, box.x1) - Math.max(-1, box.x0))
        * Math.max(0, Math.min(1, box.y1) - Math.max(-1, box.y0)) / 4;
      ok(area <= CARRY.cover, `화면의 ${(area * 100).toFixed(0)}% 를 먹는다 — 약속은 ${(CARRY.cover * 100).toFixed(0)}% 이하`);
    }
    if (SP) { await p.waitForTimeout(600); await p.screenshot({ path: `${SP}/든것.png`, timeout: 90000 }); }
  }

  if (errs.length) { console.log('콘솔 오류:'); for (const e of errs.slice(0, 5)) console.log('  ' + e); fail += errs.length; }
  await b.close();
  if (SP) console.log(`\n  (${SP}/든것.png 저장)`);
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
process.exit(fail ? 1 : 0);
