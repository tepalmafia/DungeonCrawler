// ══════════════════════════════════════════════════════════════════════════
//  보급 — **고리가 닫히나.** 브라우저 없이.
//
//    node tools/space-supply.js
//
//  ★ 여기서 묻는 것
//    ★★ **①의 뜻이 v62 에서 뒤집혔다** (열네 번째다). 예전에는 「식량이
//       한 구간의 1.2~1.8배인가」를 물었고, 그건 「**20분 회차를 반복한다**」던
//       옛 전제에서 나온 잣대였다. 전제는 2026-08-05 에 「2시간 한 번의
//       여정」으로 바뀌었는데(PLAN2H) **이 잣대만 안 옮겼다** — 그래서
//       도구가 「13분에 굶는 배」를 몇 달 동안 초록으로 지켜 줬다.
//       지금은 **회차 하나**를 기준으로 묻는다 (REAL.md §2-D).
//
//    ① 식량이 한 구간의 1.2~1.8배인가 (PLAN §11) — 「다음 거점까지 갈 식량이
//       있나」가 질문이 되려면 아슬아슬해야 한다
//    ② 채굴 한 통이 40~90초인가 · 한 통에 접촉 위험이 20~30% 오르나
//    ③ **줍기만으로는 모자라나** — 모자라야 밖에 나갈 이유가 생긴다
//    ④ **고리가 닫히나** — 회차 하나를 굶지 않고 마칠 수 있나. 몇 통이 드나
//    ⑤ 굶으면 진짜 불리한가 — 벌이 없으면 식량은 장식이다
//
//  ★ 여기서 안 나오는 것
//    「한 통만 더」가 실제로 유혹인지는 **직접 캐 봐야** 안다. 여기서 재는
//    것은 그 유혹이 성립할 **수치 조건**뿐이다.
// ══════════════════════════════════════════════════════════════════════════
import { FOOD, PARTS, ORE, SCOOP, WINCH, TRADE } from '../web/space/js/game/supply-table.js';
import { makeSupply, stepSupply, winchStep, canTrade, trade, legsLeftOnFood, shaky }
  from '../web/space/js/game/supply.js';
import { LEG, allForks } from '../web/space/js/game/route-table.js';
import { FUEL } from '../web/space/js/game/fuel-table.js';
import { REGION_BY_KEY } from '../web/space/js/game/regions-table.js';
import { SIGN } from '../web/space/js/game/chase-table.js';

const DT = 0.5;
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };

// ── 1) 식량은 한 구간의 몇 배인가 ───────────────────────────
console.log('\n[1] 식량 — 「다음 거점까지 갈 식량이 있나」가 질문이 되나');
{
  const s = makeSupply();
  const full = FOOD.max / FOOD.perSec;              // 가득 채우면 몇 초
  console.log(`  가득 = ${(full / 60).toFixed(1)}분 · 구간 하나 = ${(LEG.seconds / 60).toFixed(1)}~${(LEG.seconds / 0.78 / 60).toFixed(1)}분`);
  for (const f of allForks()) {
    const ratio = full / f.seconds;
    console.log(`  ${f.name.padEnd(20)} 구간의 ${ratio.toFixed(2)}배`);
  }
  // ★★ **회차 하나를 기준으로 묻는다** (v62). 한 끼가 회차의 0.5~0.8 이면
  //   시작에 한 번 · 중간에 한 번 — 「2시간에 2~3끼」다. 0.5 아래면 거점마다
  //   무조건 들르게 되어 **고를 것이 없어지고**(그건 시계지 통화가 아니다),
  //   0.8 위면 회차 안에서 한 번도 안 문다
  const RUN = LEG.seconds * LEG.count;
  const ofRun = full / RUN;
  const meals = 1 / ofRun;
  console.log(`  ★ 회차 ${(RUN / 60).toFixed(0)}분의 ${ofRun.toFixed(2)}배 — 회차에 ${meals.toFixed(1)}끼`);
  ok(ofRun >= 0.5 && ofRun <= 0.8,
    `★ 한 끼가 회차의 **${ofRun.toFixed(2)}배** (0.5~0.8) — 2시간에 ${meals.toFixed(1)}끼.`
    + ` 예전엔 ${(full / LEG.seconds).toFixed(2)}구간(13분)이었고 그건 「밥 먹고 10분 뒤 손 떨림」이었다`);
  // 그래도 **한 구간은 넘게** 버텨야 한다 — 구간 안에서 굶으면 고를 것이 없다
  const ratios = allForks().map((f) => FOOD.max / FOOD.perSec / f.seconds);
  ok(Math.min(...ratios) >= 1.2,
    `제일 느린 길에서도 구간의 ${Math.min(...ratios).toFixed(1)}배는 버틴다 — 구간 안에서 굶으면 고를 것이 없다`);
  // 그리고 **가는 길에 따라 갈려야** 한다. 다 똑같으면 항로를 고를 이유가 없다
  ok(Math.max(...ratios) - Math.min(...ratios) >= 0.25,
    `길에 따라 여유가 갈린다 (차 ${(Math.max(...ratios) - Math.min(...ratios)).toFixed(2)}배)`);
  void s;
}

// ── 2) 채굴 한 통 ───────────────────────────────────────────
console.log('\n[2] 채굴 — 「한 통만 더」가 성립하나');
{
  const s = makeSupply();
  let t = 0, risk = 0, first = 0;
  while (t < 400) {
    const ev = winchStep(s, DT);
    risk = Math.min(100, risk + WINCH.riskRise * DT);
    t += DT;
    if (ev === 'load' && !first) { first = t; break; }
  }
  console.log(`  한 통 = ${first.toFixed(0)}초 · 광석 ${WINCH.load} · 그동안 위험 +${(WINCH.riskRise * first).toFixed(0)}`);
  ok(first >= 40 && first <= 90, `한 통이 40~90초 (PLAN §11)`);
  const perLoad = WINCH.riskRise * first;
  ok(perLoad >= 20 && perLoad <= 30, `한 통에 접촉 위험 20~30% (${perLoad.toFixed(0)}%)`);
  const loadsToContact = 100 / perLoad;
  console.log(`  내리 캐면 ${loadsToContact.toFixed(1)}통째에 붙는다 (쉬면 초당 ${SIGN.riskFall} 씩 빠진다)`);
  ok(loadsToContact >= 3 && loadsToContact <= 5, '몰아서 캐면 서너 통째에 붙는다 — 그게 「한 통만 더」다');
}

// ── 3) 줍기만으로는 모자라나 ────────────────────────────────
console.log('\n[3] 줍기 — **모자라야 밖에 나갈 이유가 생긴다**');
{
  for (const f of allForks()) {
    const r = REGION_BY_KEY[f.region];
    const got = r.debris * SCOOP.perDebris * f.seconds;
    console.log(`  ${f.name.padEnd(20)} 한 구간에 광석 ${got.toFixed(0)}`);
  }
  // ══ ★★ **v62 — 계산서의 절반만 재고 있었다** ═══════════════════
  //  예전에는 「한 구간의 **식량**을 줍기로 댈 수 있나」만 물었다.
  //  v62 에 식량 시계가 회차로 늘어나면서 (REAL.md §2-D) 식량만으로는
  //  줍기가 이기게 됐고, 그 순간 「안 캐면 굶나」가 깨진 것처럼 보였다.
  //
  //  깨진 게 아니라 **계산서에 줄이 하나 늘었다.** 옛 식량이 하던 일
  //  (「다음 거점까지 갈 것이 있나」)은 **추진제**로 옮겨 갔으므로,
  //  물어야 할 것은 「한 구간이 먹는 **식량 + 추진제**」다
  const needFood = FOOD.perSec * LEG.seconds;
  const needFuel = FUEL.perSec * LEG.seconds;      // 한 구간을 내내 밟았을 때
  const oreFor = (food, fuel) =>
    (food / TRADE.food) * TRADE.ore + (fuel / FUEL.perTrade) * TRADE.ore;
  const needOre = oreFor(needFood, needFuel);
  const bestScoop = Math.max(...allForks().map(
    (f) => REGION_BY_KEY[f.region].debris * SCOOP.perDebris * f.seconds,
  ));
  console.log(`  한 구간이 먹는 것: 식량 ${needFood.toFixed(0)} + 추진제 ${needFuel.toFixed(0)} = 광석 ${needOre.toFixed(0)} 어치`);
  ok(bestScoop < needOre,
    `★ 제일 잘 줍는 길로 가도 모자란다 (${bestScoop.toFixed(0)} < ${needOre.toFixed(0)}) — **안 캐면 못 간다.**`
    + ` 식량만 보면 ${oreFor(needFood, 0).toFixed(0)} 이라 줍기가 이긴다: 캐는 이유는 이제 **추진제** 쪽에 있다`);
  ok(bestScoop > needOre * 0.25, `그래도 바닥은 된다 — 굶어 죽는 나선은 막는다 (${(bestScoop / needOre * 100).toFixed(0)}%)`);
}

// ── 4) 회차 하나가 닫히나 ───────────────────────────────────
console.log('\n[4] 회차 하나 — 굶지 않고 마치려면 몇 통을 캐야 하나');
{
  /** 한 회차를 돈다. 구간마다 정해진 만큼 캔다 */
  function lap(loadsPerLeg, forkKey) {
    const s = makeSupply();
    const f = allForks().find((x) => x.key === forkKey);
    const debris = REGION_BY_KEY[f.region].debris;
    let hungry = 0, t = 0, gained = 0;
    for (let leg = 0; leg < LEG.count; leg++) {
      // ★ **거점을 떠나자마자 캔다.** 처음엔 구간 끝에 캐게 했더니 굶은 시간이
      //   0 이 안 됐다 — 배가 고픈 채로 50초씩 멈춰 서 있는 셈이라 당연했다.
      //   사람은 배를 채우고 나서 캔다. 시뮬이 사람처럼 안 하면 표를 엉뚱하게
      //   맞추게 된다 (space-route.js 의 「눈이 없다」와 같은 종류의 실수)
      for (let n = 0; n < loadsPerLeg; n++) {
        for (let e = 0; e < WINCH.load / WINCH.perSec; e += DT) {
          winchStep(s, DT);
          gained += WINCH.perSec * DT;
          stepSupply(s, DT, { debris });
          if (shaky(s)) hungry += DT;
          t += DT;
        }
      }
      // 구간을 간다 — 먹고 줍는다
      for (let e = 0; e < f.seconds; e += DT) {
        gained += debris * SCOOP.perDebris * DT;
        stepSupply(s, DT, { debris });
        if (shaky(s)) hungry += DT;
        t += DT;
      }
      // 거점 — 되는 만큼 바꾼다
      while (canTrade(s) && s.food < FOOD.max - TRADE.food * 0.5) trade(s);
    }
    return { food: s.food, hungry, t, traded: s.traded, ore: s.ore, parts: s.parts, gained };
  }

  console.log('  ' + '─'.repeat(64));
  console.log('  ' + '구간당 통'.padEnd(12) + '끝 식량'.padStart(9) + '굶은 시간'.padStart(11)
    + '회차'.padStart(9) + '거래'.padStart(7));
  const runs = [0, 1, 2, 3].map((n) => ({ n, ...lap(n, 'empty') }));
  for (const r of runs) {
    console.log(`  ${String(r.n).padEnd(12)}${r.food.toFixed(0).padStart(9)}`
      + `${(r.hungry / 60).toFixed(1).padStart(9)}분${(r.t / 60).toFixed(0).padStart(8)}분${String(r.traded).padStart(7)}`);
  }
  // ★ **굶은 시간 0 을 목표로 삼지 않는다.** 거점에 거의 빈 채로 닿는 것이
  //   이 게임의 긴장이다 (「다음 거점까지 갈 식량이 있나」). 목표는
  //   「안 캐면 못 버티고, 캐면 아슬아슬하게 산다」다
  const share = (r) => r.hungry / r.t;
  ok(share(runs[0]) > 0.5, `안 캐면 회차의 ${(share(runs[0]) * 100).toFixed(0)}% 를 굶는다 — 못 버틴다`);
  const enough = runs.find((r) => share(r) <= 0.15);
  ok(!!enough && enough.n <= 3,
    enough ? `구간마다 ${enough.n}통이면 굶는 시간이 ${(share(enough) * 100).toFixed(0)}% 로 준다 — 고리가 닫힌다`
      : '아무리 캐도 굶는다 — 고리가 안 닫힌다');
  // ★ **더 캔다고 덜 굶지는 않는다.** 식량은 100 이 한도라 남는 광석이
  //   식량으로 안 바뀌기 때문이다. 처음엔 이걸 「손해」라고 보고 광석 한도를
  //   올렸는데, 한도는 원인이 아니었다 — 원인은 식량 쪽 한도였다.
  //   그래도 노력이 사라지면 안 되므로, 남는 광석은 **부품**으로 남는다.
  ok(runs[3].parts >= runs[2].parts,
    `더 캐면 부품이 남는다 (2통 ${runs[2].parts} → 3통 ${runs[3].parts}) — 헛수고가 아니다`);

  // 잔해밭 — **느리다.** 줍는 것이 그 시간값을 다 메우지는 못한다.
  // 이건 결함이 아니라 거래다: 광석은 더 남고 식량은 더 빠듯하다
  const deep = lap(enough?.n ?? 2, 'debris');
  const plain = lap(enough?.n ?? 2, 'empty');
  console.log(`  잔해밭 vs 빈 공간 — 광석 ${deep.gained.toFixed(0)} vs ${plain.gained.toFixed(0)} · `
    + `굶은 시간 ${(deep.hungry / 60).toFixed(1)}분 vs ${(plain.hungry / 60).toFixed(1)}분`);
  ok(deep.gained > plain.gained, '잔해밭은 광석이 더 남는다 — 대신 느려서 식량은 더 빠듯하다');
}

// ── 5) 굶으면 진짜 불리한가 ─────────────────────────────────
console.log('\n[5] 굶으면 — **벌이 없으면 식량은 장식이다**');
{
  const normal = 7, hungryHold = 7 / FOOD.handMult;
  console.log(`  같은 수리가 ${normal}초 → 굶으면 ${hungryHold.toFixed(0)}초`);
  ok(FOOD.handMult < 0.7, `잡고 있어도 더디다 (${FOOD.handMult}배)`);
  ok(FOOD.slipMult > 2, `놓으면 훨씬 빨리 되돌아간다 (${FOOD.slipMult}배)`);
  ok(FOOD.shakeMult > 1.3, `화면도 떨린다 (${FOOD.shakeMult}배) — 눈에도 보인다`);
  console.log(`  손이 떨리기 시작하는 선: 식량 ${FOOD.shaky} (가득의 ${(FOOD.shaky / FOOD.max * 100).toFixed(0)}%)`);
}

console.log('\n  ※ 「한 통만 더」가 실제로 유혹인지는 **직접 캐 봐야** 안다.');
console.log('  ※ 여기서 잰 것은 그 유혹이 성립할 수치 조건뿐이다.\n');
process.exit(fail ? 1 : 0);
