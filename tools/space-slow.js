// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **느려지는 시간** — 발사와 회피 (v84 · docs/space/AI.md §4·§5)
//
//    node tools/space-slow.js
//
//  ★ 사장님 「순간적으로 **슬로우 모션으로 발사되어 점점 가속화**」
//            「**회피 기동을 하면 슬로우로 전환**되고」
//
//  ★★ 여기서 묻는 것은 「멋있나」가 아니다. 잴 수 있는 것만 묻는다:
//
//      ① 발사가 **느리게 시작해서 빨라지나**
//      ② **레이저에는 안 걸리나** (즉발인 것을 느리게 날리면 고증이 깨진다)
//      ③ **규칙과 화면이 같은 시계를 쓰나** (v79 에 갈라져서 혼났다)
//      ④ 겹쳐도 **바닥 밑으로 안 가나** — 이 표가 하나인 이유
//      ⑤ 점화 때문에 늘어난 시간이 **감당할 만한가**
//      ⑥ 회차 **예산**을 안 넘나
//
//  ★ 브라우저를 안 쓴다 — 순수 규칙이다.
// ══════════════════════════════════════════════════════════════════════════
import {
  SLOW, LAUNCH, flownAt, speedAt, flyTime, lagOf, lit, slowsOnLaunch,
} from '../web/space/js/game/slow-table.js';
import { makeSlow, askSlow, dropSlow, stepSlow, slowNow, summary } from '../web/space/js/game/slow.js';
import { WEAPONS } from '../web/space/js/game/combat-table.js';
import { ENEMY_FIRE } from '../web/space/js/game/target-table.js';
import { LEG } from '../web/space/js/game/route-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const head = (t) => console.log(`\n${t}`);
const DT = 1 / 60;
const run = (s, sec) => { for (let t = 0; t < sec; t += DT) stepSlow(s, DT); };

console.log('\n느려지는 시간 — 발사와 회피');
console.log(`   사출 ${LAUNCH.ejectSec}초 ${LAUNCH.ejectSpeed}m/s → 점화 → 가속 ${LAUNCH.boostSec}초`
  + ` · 배율 바닥 ${SLOW.floor} · 회차 예산 ${SLOW.budget}초`);

// ══ ① 느리게 시작해서 빨라지나 ═══════════════════════════════════════
head('[1] ★★ **사출되어 나가고 점화되어 멀어진다**');
{
  const w = WEAPONS.ir;
  const rows = [0, 0.15, LAUNCH.ejectSec, 0.5, 0.9, 1.5, 2.5];
  console.log('      쏜 지    속도    간 거리   불');
  for (const t of rows) {
    console.log(`      ${t.toFixed(2)}초  ${speedAt(t, w.speed).toFixed(0).padStart(4)} m/s`
      + `  ${flownAt(t, w.speed).toFixed(1).padStart(6)} m   ${lit(t) ? '켜짐' : '꺼짐'}`);
  }
  ok(speedAt(0.1, w.speed) === LAUNCH.ejectSpeed, `사출 중에는 ${LAUNCH.ejectSpeed}m/s — 눈앞을 천천히 지나간다`);
  ok(!lit(0.1) && lit(LAUNCH.ejectSec + 0.01), '★★ **사출 중에는 불이 없다** — 관 안에서 켜면 제 배를 태운다 (진공이면 더욱)');
  ok(speedAt(0.5, w.speed) > speedAt(0.35, w.speed), '점화하면 **점점 빨라진다** (부스트 · 질량이 준다)');
  ok(Math.abs(speedAt(2.5, w.speed) - w.speed) < 0.01, '부스트가 끝나면 순항 속도에 붙는다');
  // 가속이 정말 「점점」인가 — 같은 길이의 두 구간에서 뒤가 더 멀리 가야 한다
  const a = flownAt(0.6, w.speed) - flownAt(0.4, w.speed);
  const b = flownAt(1.0, w.speed) - flownAt(0.8, w.speed);
  ok(b > a * 1.2, `★ 뒤로 갈수록 더 멀리 간다 (0.4~0.6초 ${a.toFixed(1)}m < 0.8~1.0초 ${b.toFixed(1)}m)`);
}

// ══ ② 레이저 ═════════════════════════════════════════════════════════
head('[2] ★★★ **레이저에는 안 건다** — 즉발인 것을 느리게 날리면 v57 이 거짓말이 된다');
{
  ok(!slowsOnLaunch('laser'), '레이저는 슬로우가 안 걸린다');
  ok(slowsOnLaunch('ir') && slowsOnLaunch('arh'), '미사일 둘만 걸린다');
  const w = WEAPONS.laser;
  console.log(`      레이저가 사거리 끝(${w.rMax}m)까지 ${(w.rMax / w.speed * 1000).toFixed(0)}밀리초`);
  ok(w.rMax / w.speed < 0.05, '★ 즉발이다 — 슬로우를 걸 시간 자체가 없다');
  // ★ 그리고 이것이 곧 예산이다 — 주력이 레이저다
  ok(WEAPONS.laser.reload < WEAPONS.ir.reload && WEAPONS.laser.cost.ore === 0,
    '★★ 주력이 레이저라 **슬로우가 흔해지지 않는다** — 이것이 저절로 예산이 된다');
}

// ══ ③ 규칙과 화면이 같은 시계 ════════════════════════════════════════
head('[3] ★★★ **규칙과 화면이 같은 시계를 쓰나** (v79 에 갈라져서 혼났다)');
{
  let worst = 0;
  for (const w of Object.values(WEAPONS)) {
    if (!slowsOnLaunch(w.key)) continue;
    for (const d of [30, 60, 120, 200, 240]) {
      if (d < w.rMin || d > w.rMax) continue;
      const t = flyTime(d, w.speed);          // 규칙이 쓰는 값
      const gone = flownAt(t, w.speed);       // 화면이 그리는 값
      worst = Math.max(worst, Math.abs(gone - d));
    }
  }
  console.log(`      비행 시간만큼 날렸을 때 종점 오차 최대 ${worst.toFixed(4)} m`);
  ok(worst < 0.01, '★★★ **닿는 순간과 그려지는 자리가 같다** — 두 곳에 안 적었으므로 갈라질 수가 없다');
}

// ══ ④ 겹쳐도 안 멈추나 ═══════════════════════════════════════════════
head('[4] ★★★ **발사와 회피가 겹쳐도 바닥 밑으로 안 간다** — 이 표가 하나인 이유');
{
  const s = makeSlow();
  askSlow(s, 'launch');
  stepSlow(s, DT);
  const one = s.k;
  askSlow(s, 'evade');
  stepSlow(s, DT);
  console.log(`      하나일 때 ${one.toFixed(2)} · 둘이 겹쳤을 때 ${s.k.toFixed(2)}`
    + ` (곱하면 ${(SLOW.launch.scale * SLOW.evade.scale).toFixed(2)} 이었을 것)`);
  ok(s.k >= SLOW.floor - 1e-9, `바닥(${SLOW.floor}) 밑으로 안 간다`);
  ok(s.k > SLOW.launch.scale * SLOW.evade.scale + 0.01,
    '★★ **곱하지 않는다** — 제일 느린 하나만 쓴다. 곱했으면 화면이 거의 멈췄다');
  ok(slowNow(s), '지금 느리다고 말할 수 있다 (화면이 이걸 읽는다)');
}

// ══ ⑤ 슬로우가 사출과 같은 길이인가 ══════════════════════════════════
head('[5] ★★ **시간이 돌아오는 순간 불이 붙나** — 둘이 한 동작으로 읽혀야 한다');
{
  const s = makeSlow();
  askSlow(s, 'launch');
  let game = 0, real = 0, endedAt = null;
  for (let i = 0; i < 600; i++) {
    const r = stepSlow(s, DT);
    real += DT; game += r.dt;
    if (endedAt === null && r.k > 0.995) endedAt = game;
  }
  console.log(`      슬로우가 실시간 ${(SLOW.launch.sec / SLOW.launch.scale).toFixed(2)}초 동안 걸린다`
    + ` · 그동안 게임 시간이 ${endedAt.toFixed(2)}초 흐른다 (사출 ${LAUNCH.ejectSec}초)`);
  // ★ 되돌아오는 구간(back)이 있어서 조금 더 흐른다 — 그만큼은 봐준다
  ok(Math.abs(endedAt - LAUNCH.ejectSec) < 0.16,
    '★★★ 슬로우가 **사출 구간과 같은 길이**다 — 풀리는 순간이 곧 점화다');
  ok(SLOW.back > 0, '뚝 끊지 않고 되돌아온다 (멀미)');
}

// ══ ⑥ 늘어난 비행 시간 ═══════════════════════════════════════════════
head('[6] ★★ **점화 때문에 늘어난 시간** — 「생동감」을 얻고 「쏠 만함」을 잃지 않았나');
{
  let worst = 0;
  for (const w of Object.values(WEAPONS)) {
    if (!slowsOnLaunch(w.key)) continue;
    const mid = (w.rMin + w.rMax) / 2;
    const rows = [w.rMin + 5, mid, w.rMax].map((d) => `${d.toFixed(0)}m +${lagOf(d, w.speed).toFixed(2)}초`);
    console.log(`      ${w.name} — ${rows.join(' · ')}`);
    for (const d of [w.rMin + 5, mid, w.rMax]) worst = Math.max(worst, lagOf(d, w.speed));
  }
  ok(worst < 0.8, `★ 제일 많이 늘어난 것이 ${worst.toFixed(2)}초 (0.8 미만) — 유도탄이 락온을 그만큼 더 붙들어야 한다`);
  ok(worst > 0.2, '★ 그래도 눈에 띄게 늘어난다 — 0 이면 사출이 없는 것과 같다');
}

// ══ ⑦ 회차 예산 ══════════════════════════════════════════════════════
head('[7] ★★★ **회차 예산** — 늘 느리면 그건 슬로우가 아니라 기본 속도다');
{
  const RUN = LEG.count * LEG.seconds;
  // 회피는 쿨다운이 막는다 — 최대한 자주 부른다고 쳐도 몇 번인가
  const most = Math.floor(RUN / SLOW.evade.cool);
  const each = SLOW.evade.maxSec;
  console.log(`      회차 ${(RUN / 60).toFixed(0)}분 · 회피 쿨다운 ${SLOW.evade.cool}초 → 최대 ${most}번`
    + ` · 한 번 ${each}초면 ${(most * each).toFixed(0)}초`);
  ok(most * each > SLOW.budget,
    `★ 쿨다운만으로는 안 막힌다 — 그래서 예산(${SLOW.budget}초)이 따로 있다`);

  const s = makeSlow();
  for (let i = 0; i < 400; i++) {
    s.cool = 0;
    askSlow(s, 'evade');
    run(s, SLOW.evade.maxSec + 0.3);
  }
  console.log(`      끝까지 불러 봤다 — 느려진 총 시간 ${s.spent.toFixed(0)}초 · ${s.times}번`);
  ok(s.dry, '예산을 다 쓰면 마른다');
  ok(s.spent <= SLOW.budget + SLOW.evade.maxSec + 1,
    `★★ 아무리 불러도 회차에 **${SLOW.budget}초 언저리**를 안 넘는다 (${(SLOW.budget / (LEG.count * LEG.seconds) * 100).toFixed(1)}%)`);
  ok(askSlow(s, 'evade').why === 'budget', '왜 안 걸리는지 말한다 (조용히 안 되면 「고장」으로 읽힌다)');

  const c = makeSlow();
  askSlow(c, 'evade');
  ok(askSlow(c, 'evade').why === 'cool', `한 번 걸리면 ${SLOW.evade.cool}초 동안 다시 안 걸린다`);
}

// ══ ⑧ 피할 틈 ════════════════════════════════════════════════════════
head('[8] ★★★ **피할 틈이 정말 생겼나**');
{
  const REACT = 0.25;   // 사람이 보고 알아채는 데 (시각 반응)
  const TURN = 0.30;    // 조종간을 밀어 기수가 도는 데
  const was = ENEMY_FIRE.fly - REACT - TURN;
  const now = ENEMY_FIRE.fly / SLOW.evade.scale - REACT - TURN;
  console.log(`      적탄 비행 ${ENEMY_FIRE.fly}초 → 슬로우면 실시간 ${(ENEMY_FIRE.fly / SLOW.evade.scale).toFixed(2)}초`);
  console.log(`      남는 시간 ${was.toFixed(2)}초 → ${now.toFixed(2)}초`);
  ok(was < 0.5, '★ 슬로우가 없으면 **사실상 못 피한다** — 이 판이 필요한 이유');
  ok(now >= 1.0, '★★★ 슬로우가 걸리면 **1초 넘게** 남는다 — 손이 할 일이 생긴다');
}

console.log(bad ? `\n✘ ${bad} 개가 안 맞습니다` : '\n✔ 전부 맞습니다');
console.log(`
  ※ **「생동감이 있나」는 여기서 안 나온다.** 여기서 나오는 것은
     「느리게 시작해 빨라지나 · 갈라지지 않나 · 겹쳐도 안 멈추나 ·
     예산을 안 넘나」뿐이다. 사출된 미사일이 눈앞을 지나가는 것이
     생동감으로 읽히는지는 **화면을 찍어야** 안다.`);
process.exit(bad ? 1 : 0);
