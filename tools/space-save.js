// ══════════════════════════════════════════════════════════════════════════
//  저장이 **정말 이어지나** — 브라우저 없이.
//
//    node tools/space-save.js
//
//  ★ 여기서 묻는 것은 「저장이 되나」가 아니라 **「불러온 뒤가 같은가」**다.
//    반쯤 저장되는 것이 제일 나쁘다 — 저장은 성공했다고 나오고,
//    **불러온 뒤에야** 「열이 왜 0 이지」로 드러난다.
//
//  ★ 그리고 **판본이 다르면 깨끗이 버리나.** 억지로 읽으면 「이상하게
//    망가진 배」로 시작하고, 그건 버그로 신고된다.
// ══════════════════════════════════════════════════════════════════════════
import { SAVE_VERSION, SAVE_KEY, FIELDS, SAVE, usable } from '../web/space/js/game/save-table.js';
import { pack, apply, where } from '../web/space/js/game/save.js';
import { makeRoute } from '../web/space/js/game/route.js';
import { makeChase } from '../web/space/js/game/chase.js';
import { makeSupply } from '../web/space/js/game/supply.js';
import { makeFaults } from '../web/space/js/game/fault.js';
import { makeHazard } from '../web/space/js/game/hazard.js';
import { makeMove } from '../web/space/js/game/move.js';
import { makeCarry } from '../web/space/js/game/carry.js';
import { makeTutor } from '../web/space/js/game/tutor.js';
import { makeScenes, newLeg as sceneLeg } from '../web/space/js/game/scene.js';
import { makeDrift } from '../web/space/js/game/drift.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };

/** 새 배 한 척 */
const fresh = () => ({
  route: makeRoute('SPACE1'),
  chase: makeChase(),
  supply: makeSupply(),
  faults: makeFaults(),
  hazard: makeHazard(),
  move: makeMove(),
  carry: makeCarry(),
  tutor: makeTutor(),
  scenes: (() => { const sc = makeScenes('SPACE1'); sceneLeg(sc, 1); return sc; })(),
  drift: makeDrift(),
  ship: { heat: 0, power: { thrust: true, cool: true, sensor: false }, clock: 0, seed: 'SPACE1', coolOpen: false },
  me: { x: 0, z: 0, yaw: 0, pitch: 0 },
});

console.log('\n[1] 통째로 JSON 하면 **안 되는 것들**이 있다');
{
  const w = fresh();
  // route 에 난수 발생기(함수)가 들어 있다 — 통째로 넘기면 사라진다
  ok(typeof w.route.rnd === 'function', 'route 에 난수 발생기(함수)가 있다');
  const naive = JSON.parse(JSON.stringify(w.route));
  ok(naive.rnd === undefined,
    '통째로 JSON 하면 그것이 **조용히 사라진다** — 그래서 칸을 적는다');
  // 우리 방식은 함수를 애초에 안 담는다
  const packed = pack(w);
  ok(packed.route.rnd === undefined, 'pack 은 적어 둔 칸만 담는다');
  ok(FIELDS.route.every((f) => f !== 'rnd'), 'FIELDS.route 에 rnd 가 없다');
}

console.log('\n[2] ★ **저장했다 불러오면 같은가** — 반쯤 저장되는 것이 제일 나쁘다');
{
  const a = fresh();
  // 한참 논 것처럼 흔들어 놓는다
  a.route.leg = 7; a.route.press = 41; a.route.t = 120; a.route.phase = 'leg';
  a.chase.risk = 62; a.chase.dist = 33.5; a.chase.runs = 4;
  a.supply.food = 2; a.supply.parts = 5; a.supply.ore = 18;
  a.faults.fixed = 9; a.faults.wear = { power: 0.4, cool: 0.7, hull: 0.2 };
  // ★ **열려 있던 고장**도 이어져야 한다. 안 그러면 껐다 켜는 것이
  //   고장을 지우는 요령이 된다
  a.faults.open = [{ key: 'attitude', name: '자세 제어', steps: [{ at: 'workshop', hold: 5 }], step: 0, held: 2.1 }];
  a.faults.log = [{ name: '오염된 냉매', reveal: '갈면 끝난다', at: 320 }];
  a.hazard.hits = 3; a.hazard.dodged = 6;
  a.move.breath = 0.4; a.move.spent = true;
  a.carry.held = 'coolant';
  a.tutor.i = 7; a.tutor.done = ['walk', 'route']; a.tutor.grips = { spot: 2 };
  a.scenes.leg = 9; a.scenes.keys = ['A', 'F']; a.scenes.phase = 'act'; a.scenes.done = ['A', 'B'];
  a.scenes.ended = ['F']; a.scenes.ember = 6.2; a.scenes.overdue = true;
  a.drift.dead = true; a.drift.angle = -19.4; a.drift.spin = 4.2; a.drift.hits = 2; a.drift.needsFix = true;
  a.ship.heat = 58; a.ship.clock = 2400; a.ship.coolOpen = true; a.ship.power = { thrust: false, cool: true, sensor: true };
  a.me.x = 3.2; a.me.z = 12.4; a.me.yaw = 1.1;

  const raw = JSON.parse(JSON.stringify(pack(a)));   // 진짜로 글로 나갔다 온다
  const b = fresh();
  ok(apply(b, raw), '불러왔다');

  // 적어 둔 칸이 **전부** 같은가
  const bad = [];
  for (const [key, fields] of Object.entries(FIELDS)) {
    for (const f of fields) {
      const x = JSON.stringify(a[key]?.[f]), y = JSON.stringify(b[key]?.[f]);
      if (x !== y) bad.push(`${key}.${f} (${x} → ${y})`);
    }
  }
  ok(bad.length === 0, `적어 둔 칸이 전부 같다 — ${bad.length ? bad.join(' · ') : `${Object.values(FIELDS).flat().length} 칸`}`);

  // ★ 함수는 **살아 있어야** 한다. 덮어씌우기지 갈아 끼우기가 아니다
  ok(typeof b.route.rnd === 'function', '난수 발생기는 살아 있다 — 새로 만든 것을 덮었으니까');
}

console.log('\n[3] 저장한 뒤에 게임이 움직여도 **저장은 안 따라 움직인다**');
{
  const a = fresh();
  a.faults.wear = { power: 0.1 };
  const saved = pack(a);
  // 저장한 뒤에 게임이 계속 돈다
  a.faults.wear.power = 0.9;
  ok(saved.faults.wear.power === 0.1,
    `깊은 복사를 한다 — 저장한 순간이 남는다 (${saved.faults.wear.power})`);
}

console.log('\n[4] 판본이 다르면 **깨끗이 버린다**');
{
  const a = fresh();
  const raw = pack(a);
  ok(usable(raw), `지금 판본(${SAVE_VERSION})은 읽는다`);
  ok(!usable({ ...raw, v: SAVE_VERSION + 1 }), '다음 판본은 안 읽는다');
  ok(!usable({ ...raw, v: SAVE_VERSION - 1 }), '옛 판본도 안 읽는다');
  ok(!usable(null) && !usable('망가진 글') && !usable({}),
    '망가진 것·빈 것도 안 읽는다 — 억지로 읽으면 「이상한 배」로 시작한다');
  const b = fresh();
  ok(apply(b, { v: 99 }) === false, '못 읽으면 false 를 돌려준다 — 새로 시작하라는 뜻');
  ok(b.ship.heat === 0, '못 읽었으면 아무것도 안 건드린다');
  // ★ **시드도 같이 담는다.** 시드가 항로·고장·문·잔해를 전부 정하므로,
  //   `?seed=ABC` 로 열고 옛 저장을 덮으면 「구간 7」이 전혀 다른 항로의
  //   7 이 된다. main.js loadOnce() 가 이 칸을 보고 안 잇는다
  ok(FIELDS.ship.includes('seed'), '어느 항로였는지도 저장한다 — 그래야 다른 항로에 안 덮는다');
  ok(pack(fresh()).ship.seed === 'SPACE1', '시드가 실제로 담긴다');
}

console.log('\n[5] 얼마나 자주 저장하나 — **되돌리기가 되면 긴장이 사라진다**');
{
  ok(SAVE.slots === 1, `칸이 하나뿐이다 (${SAVE.slots}) — 여러 칸이면 최적으로 되돌린다`);
  ok(SAVE.onLeg, '구간이 끝날 때 저장한다 — 12구간이면 12번');
  // 초마다 저장하면 안 된다
  ok(!SAVE.everySecond, '초마다 저장하지 않는다 — 죽기 직전으로 되돌리기가 된다');
}

console.log('\n[6] 이어하기 물음에 **어디까지 갔는지** 말하나');
{
  const a = fresh();
  a.route.leg = 6; a.ship.clock = 62 * 60;
  const w = where(pack(a), 12);
  ok(!!w && /구간 7\/12/.test(w.text), `「${w?.text}」`);
  ok(w.min === 62, `몇 분째인지도 말한다 (${w.min}분)`);
  ok(where({ v: 99 }) === null, '못 읽는 저장은 이어하기를 안 물어본다');
}

console.log('\n[7] 새 칸을 만들면 **여기 적어야 저장된다** — 그게 이 표의 요점');
{
  const a = fresh();
  a.ship.무언가새것 = 42;
  const raw = pack(a);
  ok(raw.ship.무언가새것 === undefined,
    'FIELDS 에 없는 칸은 안 저장된다 — 「왜 이건 안 이어지지」를 표에서 답한다');
  ok(typeof SAVE_KEY === 'string' && SAVE_KEY.length > 0, `저장 열쇠 ${SAVE_KEY}`);
}

// ══════════════════════════════════════════════════════════════════════════
//  여기부터는 **실제 배**다 — `--see 8391` 을 줬을 때만 돈다.
//
//  ★ 위 일곱은 규칙만 본다. 규칙이 아무리 맞아도 `main.js` 가 안 부르면
//    화면에서는 아무 일도 안 난다. 그리고 **저장은 유독 그렇다** —
//    「저장했습니다」가 뜨는데 실제로는 안 남아 있는 것이 제일 나쁘고,
//    그건 **정말로 창을 다시 여는 것** 말고는 확인할 방법이 없다.
//
//  ★ 그리고 멈춤 화면에는 이 저장소가 이미 한 번 밟은 함정이 있다 —
//    `pointer-events` 를 빼먹으면 **멈추면 다시 못 돌아온다.** 화면은
//    멀쩡하고 콘솔도 조용하다. 코드로는 못 찾는다.
// ══════════════════════════════════════════════════════════════════════════
const see = process.argv.indexOf('--see');
if (see >= 0) {
  const PORT = process.argv[see + 1] || '8391';
  let chromium = null;
  for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ }
  }
  if (!chromium) { console.error('playwright 가 없습니다.'); process.exit(2); }
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 380 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);
  const S = (fn, a) => p.evaluate(fn, a);
  // 남아 있는 저장이 있으면 지우고 **깨끗한 배**로 시작한다
  await S(() => SPACE.clearSave());
  await p.mouse.move(320, 190); await p.mouse.click(320, 190);
  await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });

  console.log('\n[8] ★ 멈춤 화면이 **정말 뜨나** — 그리고 어디까지 왔는지 말하나');
  {
    await S(() => SPACE.pause(true));
    const st = await S(() => SPACE.save);
    ok(st.paused && st.boxShown, '멈췄고 화면이 떴다');
    // 화면에 **정말 그려졌나** — hidden 만 보면 「화면 밖에 그려지고 있었다」를 놓친다
    const box = await p.locator('#pause').boundingBox();
    ok(!!box && box.width > 100 && box.y >= 0 && box.y < 380,
      `화면 안에 있다 (${box ? `${box.width | 0}×${box.height | 0} @${box.y | 0}` : '없음'})`);
    ok(/구간 \d+\/\d+/.test(st.where) && /남은 거점/.test(st.where),
      `어디까지 왔는지 말한다 — 「${st.where}」`);
    ok(/분째/.test(st.where), '몇 분째인지도 말한다');
    ok(st.note.length > 0, `저장이 됐는지 말한다 — 「${st.note}」`);
  }

  console.log('\n[9] ★ **누르면 돌아오나** — 여기를 빠뜨리면 멈추면 못 돌아온다');
  {
    // 화면 한복판에 무엇이 있나. 멈춤 화면이 클릭을 먹으면 캔버스에 못 닿는다
    const at = await S(() => document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.id ?? '');
    ok(at !== 'pause',
      `한복판을 누르면 **캔버스**가 받는다 (지금 「${at || '(이름없음)'}」) — pointer-events:none`);
    await p.mouse.click(320, 190);
    await p.waitForTimeout(600);
    const st = await S(() => SPACE.save);
    ok(!st.paused && !st.boxShown, '눌렀더니 계속한다');
  }

  console.log('\n[10] 멈추면 **시간도 멈추나** — 안 그러면 밥 먹는 동안 잡힌다');
  {
    await S(() => SPACE.pause(true));
    const a = await S(() => SPACE.save);
    await p.waitForTimeout(1500);
    const b2 = await S(() => SPACE.save);
    ok(Math.abs(b2.clock - a.clock) < 0.05, `멈춘 동안 시계가 안 간다 (${a.clock} → ${b2.clock})`);
    await S(() => SPACE.pause(false));
    const c = await S(() => SPACE.save);
    await p.waitForTimeout(1200);
    const d = await S(() => SPACE.save);
    ok(d.clock > c.clock, `풀면 다시 간다 (${c.clock} → ${d.clock})`);
  }

  console.log('\n[11] ★★ **닫았다 켜면 이어지나** — 이 판의 전부다');
  {
    // ★ 갈래를 먼저 고른다. 거점(PORT)에서는 **고르기 전까지 안 나아가고**,
    //   그걸 빼먹으면 구간이 0 인 채로 「그대로다」가 되어 검사가 초록으로
    //   거짓말을 한다 — 도구가 게임보다 앞서 있으면 늘 이 모양이 된다
    await S(() => { const o = SPACE.route.offer; if (o.length) SPACE.pick(o[0]); });
    await S(() => { SPACE.skipLeg(); SPACE.setHeat(47); });
    for (let i = 0; i < 30; i++) {
      await p.waitForTimeout(300);
      if ((await S(() => SPACE.route)).leg > 0) break;
    }
    const before = await S(() => ({ ...SPACE.route, heat: SPACE.heat, save: SPACE.save }));
    ok(before.leg > 0, `구간 ${before.leg} 까지 갔다`);
    ok(before.save.stored, '거점에 닿으면서 **저절로** 저장됐다 — 손으로 안 눌렀다');
    // 저장된 글 자체를 읽는다 — 「저장했다는데 뭐가 들었나」를 직접 본다
    const raw = await S(() => JSON.parse(localStorage.getItem('spacewar.save.v1')));
    ok(raw?.route?.leg === before.leg, `저장된 글에도 구간이 들었다 (${raw?.route?.leg})`);

    // ★ 정말로 창을 다시 연다
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(2200);
    const after = await S(() => ({ ...SPACE.route, heat: SPACE.heat }));
    ok(after.leg === before.leg, `다시 열었더니 구간이 그대로다 (${before.leg} → ${after.leg})`);
    ok(Math.abs(after.heat - raw.ship.heat) < 6,
      `열도 그대로다 (저장 ${raw.ship.heat.toFixed(1)} → ${after.heat.toFixed(1)})`);
    // 이었다고 **말했나.** 조용히 이으면 사람은 새로 시작한 줄 안다
    const said = await S(() => {
      const el = document.getElementById('hud');
      return el && !el.hidden ? el.textContent : null;
    });
    ok(/이어합니다/.test(said ?? ''), `이었다고 말한다 — 「${said ?? '아무 말 없음'}」`);
  }

  console.log('\n[11b] ★ **열려 있던 고장이 이어지나** — 안 이어지면 껐다 켜는 게 요령이 된다');
  {
    await S(() => SPACE.forceFault());
    await p.waitForTimeout(600);
    const before = await S(() => ({ n: SPACE.faults.open.length, keys: SPACE.faults.open.map((o) => o.key) }));
    ok(before.n > 0, `고장을 ${before.n}개 열어 뒀다 (${before.keys.join('·')})`);
    await S(() => SPACE.saveNow());
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(2200);
    const after = await S(() => ({ n: SPACE.faults.open.length, keys: SPACE.faults.open.map((o) => o.key) }));
    ok(after.n === before.n && after.keys.join() === before.keys.join(),
      `다시 열었더니 그대로 열려 있다 (${before.n} → ${after.n})`);
  }

  console.log('\n[12] 판본이 바뀌면 **깨끗이 버리고 새로 시작하나**');
  {
    const bent = await S(() => {
      SPACE.saveNow();                  // 읽을 것이 있어야 구부린다
      const k = 'spacewar.save.v1';
      const raw = JSON.parse(localStorage.getItem(k) ?? 'null');
      if (!raw) return false;
      raw.v = 99;                       // 다음 판본인 척
      localStorage.setItem(k, JSON.stringify(raw));
      return true;
    });
    ok(bent, '구부릴 저장이 있다');
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(2200);
    const r = await S(() => SPACE.route);
    ok(r.leg === 0, `못 읽는 저장은 버리고 처음부터 (구간 ${r.leg})`);
    ok(!(await S(() => SPACE.save)).stored, '망가진 저장은 지워졌다 — 그대로 두면 켤 때마다 터진다');
  }

  console.log('\n[13] ★ **다른 항로의 저장은 안 잇는다** — 그리고 안 지운다');
  {
    // 한 항로에서 저장해 둔다
    await S(() => { const o = SPACE.route.offer; if (o.length) SPACE.pick(o[0]); SPACE.skipLeg(); });
    for (let i = 0; i < 30; i++) {
      await p.waitForTimeout(300);
      if ((await S(() => SPACE.route)).leg > 0) break;
    }
    const kept = (await S(() => SPACE.route)).leg;
    ok(kept > 0, `기본 항로에서 구간 ${kept} 까지 저장해 뒀다`);

    // 다른 시드로 연다 — 이으면 「구간 N」이 **전혀 다른 항로의 N** 이 된다
    await p.goto(`http://127.0.0.1:${PORT}/space/?seed=DIFFERENT`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2200);
    ok((await S(() => SPACE.route)).leg === 0, '다른 시드로 열면 처음부터 — 안 잇는다');

    // ★ 그래도 **원래 저장은 살아 있어야** 한다. 잠깐 들여다본 것 때문에
    //   원래 회차가 사라지면 그건 저장이 아니라 함정이다
    await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2200);
    ok((await S(() => SPACE.route)).leg === kept,
      `원래 항로로 돌아오면 그대로 이어진다 (구간 ${kept})`);
  }

  ok(errs.length === 0, errs.length ? `콘솔 오류 ${errs.length}: ${errs[0]}` : '콘솔 오류 없음');
  await b.close();
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
process.exit(fail ? 1 : 0);
