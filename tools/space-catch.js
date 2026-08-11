// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **포획** — 뼈대만 (v103)
//
//    node tools/space-catch.js
//
//  ★ 사장님 「**적이나 물체를 부수고 그 자리에 있어야 아이템을 획득하지.
//    멀리 날아가버리잔아.** 일정 거리만 날아가고 **포획 같은 단축키로
//    자동으로 따라붙어서 도킹해서 아이템을 회수** 할 수 있도록해」
//
//  ★★★ 묻는 것 다섯
//      ① **정말 멀리 날아가나** — 고치기 전이 얼마였나 (사장님 말씀 검산)
//      ② 이제 **일정 거리에서 멎나**
//      ③ 포획이 **정말 따라붙나** — 몇 초에 닿나
//      ④ ★★ **공짜가 아닌가** — 맞으면 풀리나 · 값이 드나
//      ⑤ ★ **늘 누르는 게 답은 아닌가** — 적이 쏘는 중이면 손해인가
// ══════════════════════════════════════════════════════════════════════════
import { CATCH, DRIFT_MAX, CWHY, catchWord, catchTime } from '../web/space/js/game/catch-table.js';
import { makeCatch, beginCatch, stepCatch, stopCatch, chasing, summary } from '../web/space/js/game/catch.js';
import { PACK, NET } from '../web/space/js/game/salvage-table.js';
import { DOCK } from '../web/space/js/game/dock-table.js';
import { AXES } from '../web/space/js/game/flight-table.js';
import { FUEL } from '../web/space/js/game/fuel-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const DEG = 180 / Math.PI;

console.log('포획 — 뼈대만 (게임을 안 부른다)');

console.log('\n[1] ★★★ **정말 멀리 날아가나** — 사장님 말씀을 숫자로 검산한다');
{
  const wentFar = PACK.drift * PACK.live;
  console.log(`   꾸러미가 ${PACK.drift}m/초로 ${PACK.live}초 → **${wentFar.toFixed(0)}m**`);
  console.log(`   도킹이 닿는 거리 ${DOCK.reach}m · 그물 ${NET.reach}m`);
  const tOut = DOCK.reach / PACK.drift;
  ok(wentFar > DOCK.reach,
    `★★★ **${tOut.toFixed(0)}초가 지나면 도킹으로는 영영 못 문다** — 사장님`
    + ' 「멀리 날아가버리잔아」가 숫자로 이것이다');
  ok(DRIFT_MAX < wentFar,
    `★★ 이제 **${DRIFT_MAX}m 에서 멎는다** (${wentFar.toFixed(0)} → ${DRIFT_MAX})`);
  ok(DRIFT_MAX <= NET.reach,
    `★ 제일 먼 것도 **그물(${NET.reach}m) 안**이다 — 포획 말고 그물이라는 길도 남는다`);
  ok(DRIFT_MAX > DOCK.reach,
    `★★★ 그래도 **도킹(${DOCK.reach}m)보다는 멀다** — 그냥 붙지지 않는다.`
    + ' 여기가 「따라붙어야 한다」가 사는 자리다');
}

console.log('\n[2] ★★★ 포획이 **정말 따라붙나** — 몇 초에 닿나');
{
  const run = (d0, off0, o = {}) => {
    const c = makeCatch();
    beginCatch(c, { has: true, id: 1, dist: d0 });
    let t = 0, why = null;
    const dt = 1 / 60;
    while (t < 90) {
      why = stepCatch(c, dt, { off: t === 0 ? off0 : null, reach: DOCK.reach, ...o });
      t += dt;
      if (why) break;
    }
    return { t: +t.toFixed(2), why, c };
  };
  console.log('   거리   기수 각    닿는 데');
  for (const [d0, off0] of [[DRIFT_MAX, 0], [DRIFT_MAX, 60], [DRIFT_MAX, 150], [120, 0]]) {
    const r = run(d0, off0);
    console.log(`   ${String(d0).padStart(4)}m  ${String(off0).padStart(4)}도   `
      + `**${r.t.toFixed(1)}초** (${r.why})`);
  }
  const near = run(DRIFT_MAX, 0);
  ok(near.why === 'arrived' && near.t > 2 && near.t < 9,
    `★★★ 제일 먼 꾸러미까지 **${near.t.toFixed(1)}초** — 이 5초가 값이다.`
    + ' 적이 쏘는 사이에 곧게 날아야 한다');
  const back = run(DRIFT_MAX, 150);
  ok(back.t > near.t + 2,
    `★★ **뒤에 있으면 더 걸린다** (${back.t.toFixed(1)}초) — 기수를 돌리는 시간이 든다`);
  ok(CATCH.turn < AXES.yaw.rate * DEG,
    `★★★ 자동이 **손보다 느리다** (${CATCH.turn}°/초 < ${(AXES.yaw.rate * DEG).toFixed(0)}°/초)`
    + ' — 자동이 손을 이기면 조종이 없어진다');
  ok(catchTime(DRIFT_MAX) > 0, `★ 계기가 쓰는 식이 같다 (${catchTime(DRIFT_MAX)}초)`);
}

console.log('\n[3] ★★★ **공짜가 아닌가** — 여기가 이 계통의 전부다');
{
  const c = makeCatch();
  beginCatch(c, { has: true, id: 1, dist: DRIFT_MAX });
  let fuel = 0, sign = 0, heat = 0, t = 0;
  const dt = 1 / 60;
  while (t < 30) {
    const why = stepCatch(c, dt, { reach: DOCK.reach });
    fuel += c.burned; sign += c.signed; heat += c.heated;
    t += dt;
    if (why) break;
  }
  console.log(`   한 번 포획에 — 추진제 **${fuel.toFixed(2)}** (탱크 ${FUEL.max}) ·`
    + ` 자국 **+${sign.toFixed(1)}** · 열 **+${heat.toFixed(1)}**`);
  // ★ 처음에 「열 번 주우면 탱크 절반」이라고 적었다가 재 보니 11% 였다.
  //   **추진제는 이 계통의 값이 아니다** — 값은 조종간과 「맞으면 풀린다」다.
  //   숫자를 안 고치고 말을 고쳤다: 없는 벌을 있다고 적으면 다음 사람이
  //   그 말을 믿고 값을 또 만진다
  ok(fuel > 0.5 && fuel < 8,
    `★ 추진제가 든다 — 탱크의 ${(fuel / FUEL.max * 100).toFixed(1)}% (순항 ${(fuel / FUEL.perSec).toFixed(0)}초치).`
    + ' **작다.** 이 계통의 값은 추진제가 아니다');
  ok(sign > DOCK.sign,
    `★★ **자국이 도킹(${DOCK.sign})보다 더 오른다** (+${sign.toFixed(1)})`
    + ' — 따라가서 무는 것이 가만히 무는 것보다 덜 띄면 앞뒤가 안 맞는다');
  ok(sign < NET.sign,
    `★ 그래도 **그물(${NET.sign})보다는 싸다** — 셋의 순서가 맞는다`);
  ok(CATCH.legMult === 0, '★ 붙는 동안 **항로가 안 나아간다** — 12구간을 2시간에 가야 한다');
  ok(CATCH.holdsHelm === true,
    '★★★ **조종간을 뺏는다** — 붙는 동안 회피를 못 한다. 이것이 제일 큰 값이다');
}

console.log('\n[4] ★★★ **맞으면 풀리나** — 없으면 「쏘든 말든 K」가 된다');
{
  const c = makeCatch();
  beginCatch(c, { has: true, id: 1, dist: DRIFT_MAX });
  stepCatch(c, 0.5, { reach: DOCK.reach });
  const mid = summary(c).dist;
  const why = stepCatch(c, 1 / 60, { hit: true, reach: DOCK.reach });
  ok(why === 'hit' && !chasing(c),
    `★★★ **맞으니 ${mid}m 에서 풀렸다** — 헛수고다. 그래서 「지금 주울까`
    + ' 나중에 주울까」가 생긴다');
  // 흩어져도 풀린다
  const c2 = makeCatch();
  beginCatch(c2, { has: true, id: 2, dist: 50 });
  ok(stepCatch(c2, 1 / 60, { gone: true }) === 'gone', '★ 꾸러미가 흩어지면 풀린다');
  // 추진제가 바닥나도
  const c3 = makeCatch();
  beginCatch(c3, { has: true, id: 3, dist: 50 });
  ok(stepCatch(c3, 1 / 60, { dry: true }) === 'dry', '★ 추진제가 바닥나면 풀린다');
  // 손으로도 끊긴다
  const c4 = makeCatch();
  beginCatch(c4, { has: true, id: 4, dist: 50 });
  ok(stopCatch(c4) === 4 && !chasing(c4),
    '★★ **아무 때나 끊을 수 있다** — 갇히면 그건 벌이 아니라 고장이다');
}

console.log('\n[5] ★ 못 거는 자리마다 **까닭을 말하나**');
{
  const c = makeCatch();
  const why = (o) => beginCatch(makeCatch(), o).why;
  ok(why({ has: false }) === 'none', `★ 주울 것이 없다 — 「${CWHY.none}」`);
  ok(why({ has: true, id: 1, dist: CATCH.reach + 1 }) === 'far', `★ 너무 멀다 — 「${CWHY.far}」`);
  ok(why({ has: true, id: 1, dist: 20, seated: false }) === 'seat', `★ 안 앉았다 — 「${CWHY.seat}」`);
  ok(why({ has: true, id: 1, dist: 20, dry: true }) === 'dry', `★ 추진제 — 「${CWHY.dry}」`);
  ok(why({ has: true, id: 1, dist: 20, full: true }) === 'full', `★ 화물칸 — 「${CWHY.full}」`);
  beginCatch(c, { has: true, id: 1, dist: 20 });
  ok(beginCatch(c, { has: true, id: 2, dist: 20 }).why === 'busy', `★ 이미 붙는 중 — 「${CWHY.busy}」`);
  ok(catchWord(c).includes('포획'), `★ 계기가 한 마디로 말한다 — 「${catchWord(c)}」`);
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
