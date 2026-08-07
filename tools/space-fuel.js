// ══════════════════════════════════════════════════════════════════════════
//  ★★ 추진제 — **시계를 맞는 물건에 옮겼다** (v62 · REAL.md §2-D · §4-D)
//
//    node tools/space-fuel.js
//
//  ★ 무엇이 틀렸었나
//    식량이 **13분에 바닥**났고 손 떨림이 10분이었다. 밥 먹고 10분 뒤에
//    손이 떨리는 사람은 없다 — 그건 식량의 시계가 아니었다.
//
//    그런데 **그 시계 자체는 필요했다.** 「다음 거점까지 갈 것이 있나」가
//    항로를 고르게 만드는 유일한 통화다 (PLAN §5-1). 그래서 지우지 않고
//    **옮겼다.** 이 도구는 「옮긴 자리가 맞나」를 묻는다.
//
//  ★★ 묻는 것 여섯
//      ① 회차에 두어 번 채우나 — 열두 번이면 시계고, 한 번도 안이면 장식이다
//      ② ★★ **밟는 동안만 주나** — 늘 주면 그건 추진제가 아니라 두 번째 식량이다
//      ③ ★★ **길마다 다르게 드나** — 여기가 「항로를 고르게 만드는」 자리다
//      ④ ★★ **양쪽이 다 손해인가** — 밟으면 추진제, 아끼면 압박. 한쪽만이면 정답이 하나다
//      ⑤ 바닥나도 안 끝나나 — 벌은 늘 **기다림**이다
//      ⑥ ★ 고리가 닫히나 — 캐야 갈 수 있나
//
//  ★★ ④ 가 제일 위험한 자리다. v55 에서 **반대쪽 실수**를 이미 밟았다 —
//     추진을 끄면 잃는 게 없어서 「발만 떼면 영영 안 붙는 게임」이 됐고,
//     시뮬이 「추격 0회」로 잡아 줬다. 추진제는 그 반대다: 아끼는 쪽이
//     공짜면 「계속 끄고 있는 게임」이 된다.
// ══════════════════════════════════════════════════════════════════════════
import { FUEL, burnMult, fuelWord, isDry, legsLeftOnFuel } from '../web/space/js/game/fuel-table.js';
import { LEG, PRESS, allForks } from '../web/space/js/game/route-table.js';
import { REGIONS, REGION_BY_KEY } from '../web/space/js/game/regions-table.js';
import { TRADE, FOOD } from '../web/space/js/game/supply-table.js';
import { makeSupply, stepSupply, trade, canThrust } from '../web/space/js/game/supply.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DT = 1 / 30;
const RUN = LEG.seconds * LEG.count;

/** 이만큼 밟는다 */
function burn(s, sec, region = 'empty') {
  const evs = [];
  for (let t = 0; t < sec; t += DT) {
    const e = stepSupply(s, DT, { thrust: true, region });
    if (e) evs.push(e);
  }
  return evs;
}

console.log('\n추진제 — 시계를 맞는 물건에 옮겼다');

console.log('\n[1] **회차에 몇 번 채우나** — 열두 번이면 시계고, 0번이면 장식이다');
{
  const full = FUEL.max / FUEL.perSec;           // 내내 밟으면 몇 초
  console.log(`   한 통으로 ${(full / 60).toFixed(1)}분 밟는다 · 회차 ${(RUN / 60).toFixed(0)}분`);
  for (const r of REGIONS) {
    console.log(`   ${r.key.padEnd(8)} 구간 ${legsLeftOnFuel(FUEL.max, r.key).toFixed(2)}개`);
  }
  const legs = FUEL.max / (FUEL.perSec * LEG.seconds);
  ok(legs >= 3 && legs <= 6,
    `★ 한 통으로 **${legs.toFixed(1)}구간**을 내내 밟는다 (3~6) — 12구간이므로 회차에 두어 번 채운다.`
    + ' 매 구간이면 그건 고를 것이 없는 시계고, 한 번도 안이면 아무 일도 안 난다');
  ok(FUEL.low > 0 && FUEL.low < FUEL.max * 0.35,
    `${FUEL.low} 밑이면 알린다 — 아직 한 구간은 갈 수 있을 때다`);
}

console.log('\n[2] ★★ **밟는 동안만 준다** — 늘 주면 두 번째 식량이다');
{
  const off = makeSupply();
  for (let t = 0; t < 600; t += DT) stepSupply(off, DT, { thrust: false });
  ok(off.fuel === FUEL.max,
    '★★ 발을 떼면 **10분을 흘러도 한 방울도 안 준다** — 추진제가 하는 일은 「가는 것」이다');
  ok(off.food < FOOD.max, `그동안 식량은 준다 (${off.food.toFixed(0)}) — 시계 둘이 서로 다른 것을 잰다`);
  const on = makeSupply();
  burn(on, 600);
  ok(on.fuel < FUEL.max, `밟으면 준다 (${on.fuel.toFixed(0)})`);
}

console.log('\n[3] ★★ **길마다 다르게 든다** — 여기가 「항로를 고르게 만드는」 자리다');
{
  for (const f of allForks()) {
    const s = makeSupply();
    burn(s, f.seconds, f.region);
    const used = FUEL.max - s.fuel;
    console.log(`   ${f.name.padEnd(20)} 한 구간 내내 밟으면 ${used.toFixed(0)}`);
  }
  const each = allForks().map((f) => {
    const s = makeSupply(); burn(s, f.seconds, f.region);
    return { key: f.region, used: FUEL.max - s.fuel, sec: f.seconds };
  });
  const lo = each.reduce((a, b) => (a.used < b.used ? a : b));
  const hi = each.reduce((a, b) => (a.used > b.used ? a : b));
  ok(hi.used / lo.used >= 1.1,
    `★ 제일 많이 드는 길(${hi.key} ${hi.used.toFixed(0)})이 제일 적게 드는 길(${lo.key} ${lo.used.toFixed(0)})의`
    + ` **${(hi.used / lo.used).toFixed(2)}배** — 같으면 추진제는 항로를 안 가른다`);
  // ★ **느린 길이 덜 든다**는 것이 이 설계의 요점이다
  const neb = each.find((e) => e.key === 'nebula');
  const emp = each.find((e) => e.key === 'empty');
  ok(neb.used < emp.used && neb.sec > emp.sec,
    `★★ 성운은 **오래 걸리되(${(neb.sec / 60).toFixed(1)}분) 덜 든다**(${neb.used.toFixed(0)}), `
    + `빈 공간은 **빨리 지나되(${(emp.sec / 60).toFixed(1)}분) 더 든다**(${emp.used.toFixed(0)}).`
    + ' 새 숫자를 안 만들고 구역의 `speed` 하나로 낸다');
}

console.log('\n[4] ★★ **양쪽이 다 손해인가** — 한쪽만이면 정답이 하나다');
{
  // 밟으면 추진제를 쓴다. 안 밟으면 **구간이 늘어지고 압박이 시간으로 쌓인다**
  const fork = allForks()[0];
  const fast = fork.seconds;                       // 내내 밟으면
  const slow = fork.seconds / LEG.coast;           // 발을 떼면 (coast 0.45)
  const pressFast = fork.pressRate * fast;
  const pressSlow = fork.pressRate * slow;
  const s = makeSupply(); burn(s, fast, fork.region);
  const cost = FUEL.max - s.fuel;
  console.log(`   밟으면 ${(fast / 60).toFixed(1)}분 · 추진제 ${cost.toFixed(0)} · 압박 +${pressFast.toFixed(0)}`);
  console.log(`   떼면   ${(slow / 60).toFixed(1)}분 · 추진제 0 · 압박 +${pressSlow.toFixed(0)}`);
  ok(cost > 0, '밟으면 **추진제**를 잃는다');
  ok(pressSlow > pressFast,
    `★★ 떼면 **압박**을 잃는다 (+${pressSlow.toFixed(0)} vs +${pressFast.toFixed(0)}) —`
    + ' 아끼는 쪽이 공짜면 「계속 끄고 있는 게임」이 된다. v55 에서 반대쪽을 이미 밟았다');
  ok(PRESS.drift > 0, `시간 자체에 값이 붙어 있다 (drift ${PRESS.drift}/초) — 이게 없으면 늦는 것이 공짜다`);
}

console.log('\n[5] **바닥나도 안 끝난다** — 벌은 늘 기다림이다');
{
  const s = makeSupply();
  const evs = burn(s, FUEL.max / FUEL.perSec + 30);
  ok(evs.includes('lowFuel'), '바닥나기 전에 한 번 알린다');
  ok(evs.includes('dry'), '바닥나면 알린다');
  ok(s.fuel === 0 && isDry(s.fuel) && !canThrust(s), '★ 추진이 안 걸린다');
  ok(LEG.coast > 0,
    `★★ 그래도 구간은 **관성으로 ${LEG.coast}배 속도**로 나아간다 — 끝이 아니라 늘어짐이다.`
    + ' 그동안 압박이 진짜 시간으로 쌓여 결국 그물이 닫힌다');
  // 그리고 거래로 되살아난다
  s.ore = TRADE.ore;
  ok(trade(s) && s.fuel > 0 && canThrust(s),
    `★ 광석 ${TRADE.ore} 을 내면 추진제 ${FUEL.perTrade} 이 온다 — **접수구 하나로 셋을 다 받는다**`);
}

console.log('\n[6] ★ **고리가 닫히나** — 캐야 갈 수 있나');
{
  // 한 구간을 내내 밟으면 광석이 얼마나 드나
  const needFuel = FUEL.perSec * LEG.seconds;
  const needFood = FOOD.perSec * LEG.seconds;
  const oreFuel = (needFuel / FUEL.perTrade) * TRADE.ore;
  const oreFood = (needFood / TRADE.food) * TRADE.ore;
  console.log(`   한 구간: 추진제 ${needFuel.toFixed(0)}(광석 ${oreFuel.toFixed(0)}) + 식량 ${needFood.toFixed(0)}(광석 ${oreFood.toFixed(0)})`);
  ok(oreFuel > oreFood,
    `★★ 이제 **추진제가 식량보다 비싸다** (광석 ${oreFuel.toFixed(0)} vs ${oreFood.toFixed(0)}) —`
    + ' 「왜 캐나」의 답이 식량에서 추진제로 옮겨 갔다. 그게 이 판이 한 일이다');
  // 잔해밭에서 지나가며 줍는 것으로는 못 댄다 (space-supply.js [3] 과 같은 물음)
  const debris = REGION_BY_KEY.debris;
  ok(debris.debris > 0, '잔해밭에는 주울 것이 있다 — 바닥은 있어야 죽음의 나선이 안 난다');
  ok(oreFuel + oreFood > 20,
    `한 구간의 계산서가 광석 ${(oreFuel + oreFood).toFixed(0)} — 줍기(잔해밭 최대 27)로 겨우 못 댄다`);
}

console.log('\n[7] 사람에게 뭐라고 말하나 — **숫자로 안 띄운다**');
{
  const say = [FUEL.max, FUEL.max * 0.5, FUEL.low - 1, 0].map(fuelWord);
  for (const w of say) console.log(`   ${w}`);
  ok(new Set(say).size === say.length, '네 단계가 서로 다른 말이다');
  ok(!say.some((w) => /\d/.test(w)), '숫자가 안 들어 있다');
  ok(burnMult('nebula') < burnMult('empty'), '구역 배수가 표에서 그대로 나온다 — 두 곳에 안 적는다');
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「추진제를 아끼는 것이 재미있나」는 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「밟는 동안만 주나 · 길마다 다른가 · 양쪽이 다 손해인가 · 고리가 닫히나」뿐이다.');
process.exit(fail ? 1 : 0);
