// ══════════════════════════════════════════════════════════════════════════
//  항로 시뮬 — **회차 하나를 통째로 돌린다.** 브라우저 없이.
//
//    node tools/space-route.js [시드]
//    node tools/space-route.js --csv
//
//  ★ 왜 필요한가
//    「구간 8~12분 · 회차 100~140분 · 구간당 추격 1~2회」는 PLAN2H §5·§10 에
//    적어 둔 목표다 (회차 목표는 60~90 에서 옮겼다 — 20분 회차를 반복하던
//    전제가 「2시간 한 번의 여정」으로 바뀌었다). 이건 손으로 20분 돌려 봐야 아는 종류가
//    아니라 **계산으로 바로 나오는** 종류다. 감으로 맞추면 반드시
//    「한 시간짜리가 세 시간이 되거나, 추격이 아예 안 붙거나」가 된다.
//    추격 하나를 잰 것이 space-sim.js 였고, 이건 **그 위층**이다.
//
//  ★ 여기서 진짜로 묻는 것 — 「갈래가 갈래인가」
//    바 하나가 오르기만 하면 그건 선택이 아니라 시계다 (GAP.md §5).
//    그래서 **정책 넷을 서로 다르게 돌려 결과가 갈리는지** 본다.
//    다 비슷하게 나오면 그건 통과가 아니라 **설계가 실패한 것**이다.
//
//  ★ 이 시뮬이 못 보는 것
//    방 사이를 뛰는 시간이 0 이다 (space-sim.js 와 같다). 그리고 **고장을
//    고치는 시간을 안 센다** — 실제로는 평온 구간을 고장이 채우고, 하나에
//    40~70초가 든다 (tools/space-fault.js). 여기 나오는 회차 길이는 **아래끝**이다.
// ══════════════════════════════════════════════════════════════════════════
import { LEG, PRESS, allForks } from '../web/space/js/game/route-table.js';
import { makeRoute, stepRoute, chooseFork, contactAt, trackMult, signMult, relieveEscape, RPHASE }
  from '../web/space/js/game/route.js';
import { makeChase, stepChase, heatRate, PHASE } from '../web/space/js/game/chase.js';
import { CHASE } from '../web/space/js/game/chase-table.js';
import { HEAT, VALVE } from '../web/space/js/game/systems-table.js';

const DT = 0.25;                 // 항로는 분 단위 이야기라 굵게 굴려도 된다
const CSV = process.argv.includes('--csv');
const SEED = process.argv.find((a) => !a.startsWith('-') && !a.includes('/')) || 'SPACE1';

// ── 사람이 실제로 할 법한 선택 ──────────────────────────────
// 항로를 어떻게 고르나 × 배를 어떻게 모나. 둘을 갈라 놓는다.
const PICKS = {
  '늘 숨는 쪽 (성운·잔해밭)': (offer) => offer[0],
  '늘 빠른 쪽 (빈 공간·행성)': (offer) => offer[1],
  '압박을 보고 (60 넘으면 숨는다)': (offer, rt) => (rt.press > 60 ? offer[0] : offer[1]),
  '번갈아': (offer, rt) => offer[rt.leg % 2],
};

// 배를 모는 법 — **눈이 없다는 것까지 흉내낸다.**
//
// ★ 여기서 두 번 틀렸다.
//   ① 처음엔 열만 보고 몰았더니 구간마다 5번씩 붙었다. 사람은 위험이
//      보이면 발을 뗀다.
//   ② 그래서 위험을 보고 발을 떼게 했더니 **추격이 0회**가 됐다.
//      그런데 이건 시뮬이 반칙을 한 것이다 — 실제로는 **센서를 켜야
//      위험이 보이고, 셋 중 둘이라 센서를 켜면 추진이 꺼진다.**
//      즉 달리는 동안은 눈이 감겨 있다.
//
//   그래서 지금은 **가끔 멈춰 서서 본다.** 보는 동안은 안 나아간다.
//   이게 이 게임의 진짜 저울이고 (Duskers 각색 · GAP.md §2-④),
//   시뮬이 그걸 흉내내지 않으면 표를 엉뚱하게 맞추게 된다.
const HI = 70, LO = 40;
const PEEK_EVERY = 70, PEEK_FOR = 9, EASE_AT = 55;
function pilot(s) {
  // 추격 중에는 무조건 밟는다. 안 밟으면 관성뿐이라 못 뿌리친다
  if (s.chasing) { s.peek = 0; s.easing = false; return { thrust: true, cool: true, sensor: false }; }

  s.since = (s.since || 0) + s.dt;
  if (s.peeking) {
    // 보는 중 — 센서를 켜느라 추진이 꺼져 있다. 구간이 거의 안 나아간다
    if (s.since >= PEEK_FOR) { s.peeking = false; s.since = 0; s.easing = s.seen > EASE_AT; }
    else s.seen = s.risk;
    return { thrust: false, cool: true, sensor: true };
  }
  if (s.since >= PEEK_EVERY) { s.peeking = true; s.since = 0; s.seen = s.risk; }

  if (s.heat > HI) s.mode = 'cool';
  else if (s.heat < LO) s.mode = 'push';
  return { thrust: s.mode !== 'cool' && !s.easing, cool: true, sensor: false };
}

/** 회차 하나를 끝까지 돌린다 */
function runLap(pick, seed) {
  const rt = makeRoute(seed);
  const c = makeChase();
  const st = { mode: 'push' };
  let heat = HEAT.start, coolFor = 0, t = 0;
  const legs = [];
  let legStart = 0, legChases = 0, legCaught = 0, overruns = 0;
  let curKey = null;

  const CAP = 3 * 3600;          // 3시간이면 뭔가 잘못된 것이다
  while (t < CAP) {
    if (rt.phase === RPHASE.END) break;
    if (rt.phase === RPHASE.PORT) {
      // 거점에 서면 **고른다.** 고르는 데 걸리는 시간은 0 으로 본다 —
      // 실제로는 관측실까지 걸어가야 하고, 그건 §11 의 「방 사이 6~12초」다
      curKey = pick(rt.offer, rt).key;
      chooseFork(rt, curKey);
      legStart = t; legChases = 0; legCaught = 0;
      continue;
    }

    const p = pilot(Object.assign(st, { heat, risk: c.risk, chasing: c.phase === PHASE.CHASE, dt: DT }));
    // 밸브 — 뜨거우면 열러 간다 (space-sim.js 와 같은 규칙)
    if (coolFor <= 0 && heat > LO) coolFor = VALVE.holds;
    coolFor = Math.max(0, coolFor - DT);
    heat = Math.max(0, Math.min(HEAT.max, heat + heatRate(p, coolFor > 0) * DT));

    const ev = stepChase(c, DT, p, heat, signMult(rt),
      { contactAt: contactAt(rt), trackMult: trackMult(rt) });
    if (ev === 'contact') legChases++;
    if (ev === 'escaped') relieveEscape(rt);
    // ★★ 여기에 **게임에 없는 규칙이 적혀 있었다.**
    //   「잡혀도 그 자리에서 또 안 붙는다」며 이 도구가 직접 SHAKEN 으로
    //   되돌리고 있었는데, 정작 게임(chase.js)에는 CAUGHT 에서 나가는
    //   가지가 **아예 없었다.** 그래서 **회차 시뮬은 잘 돌고 게임만 죽어
    //   있었다** — 잡히면 위협이 영구히 사라진 빈 상자가 됐다.
    //   도구가 게임보다 앞서 있으면 검사는 영원히 초록이다.
    //   규칙은 게임(chase-table.js CAUGHT)으로 옮겼다. 여기서는 세기만 한다.
    if (ev === 'caught') legCaught++;

    const rev = stepRoute(rt, DT, p);
    // ★ 그물이 닫혔다 — 자국이 얼마든 붙는다
    if (rev === 'overrun') {
      overruns++;
      if (c.phase === PHASE.CALM) { c.phase = PHASE.CHASE; c.dist = CHASE.startDist; c.timer = 0; legChases++; }
    }
    if (rev === 'arrive' || rev === 'end') {
      legs.push({
        key: curKey, sec: t - legStart, chases: legChases,
        caught: legCaught, press: rt.press,
      });
    }
    t += DT;
  }
  return { legs, sec: t, press: rt.press, overruns, done: rt.phase === RPHASE.END };
}

// ── 갈래 자체를 먼저 찍는다 ─────────────────────────────────
console.log(`\n항로 — 구간 ${LEG.count}개 · 기준 ${LEG.seconds}초 · 시드 ${SEED}`);
console.log('\n[1] 갈래 넷 — 이 표가 서로 다른가');
console.log('  ' + '─'.repeat(74));
console.log('  ' + '갈래'.padEnd(22) + '분'.padStart(6) + '압박'.padStart(8)
  + '붙는속도'.padStart(10) + '  대가');
for (const f of allForks()) {
  const min = f.seconds / 60;
  const gain = f.pressRate * f.seconds;
  console.log(`  ${f.name.padEnd(20)} ${min.toFixed(1).padStart(6)} ${gain.toFixed(0).padStart(8)}`
    + `${f.trackMult.toFixed(2).padStart(10)}  ${f.what}`);
}
console.log(`  (거점에서 압박 ×${PRESS.portKeep} · 접촉 기준 `
  + `${PRESS.contactFrom} → ${PRESS.contactTo})`);

// ── 회차를 돌린다 ───────────────────────────────────────────
console.log('\n[2] 회차 — 정책마다 끝까지 가 본다');
console.log('  ' + '─'.repeat(74));
const laps = [];
for (const [name, pick] of Object.entries(PICKS)) {
  const r = runLap(pick, SEED);
  laps.push([name, r]);
  const mins = r.legs.map((l) => l.sec / 60);
  const lo = Math.min(...mins), hi = Math.max(...mins);
  const chases = r.legs.reduce((s, l) => s + l.chases, 0);
  console.log(`  ${name.padEnd(26)} ${(r.sec / 60).toFixed(0).padStart(3)}분  `
    + `구간 ${lo.toFixed(1)}~${hi.toFixed(1)}분  추격 ${chases}회  `
    + `끝 압박 ${r.press.toFixed(0)}  넘침 ${r.overruns}`);
}

if (CSV) {
  console.log('\npolicy,leg,fork,minutes,chases,caught,press');
  for (const [name, r] of laps) {
    r.legs.forEach((l, i) => console.log(
      `${name},${i + 1},${l.key},${(l.sec / 60).toFixed(2)},${l.chases},${l.caught},${l.press.toFixed(1)}`));
  }
}

// ── 목표와 견주기 ───────────────────────────────────────────
const allLegs = laps.flatMap(([, r]) => r.legs);
const legMins = allLegs.map((l) => l.sec / 60);
const lapMins = laps.map(([, r]) => r.sec / 60);
const chasePerLeg = allLegs.map((l) => l.chases);

const ok1 = legMins.every((m) => m >= 8 && m <= 12);
// ★ **회차 목표가 바뀌었다** — 20분 회차를 반복하던 전제가 「2시간 한 번의
//   여정」으로 바뀌었고(PLAN2H.md · 2026-08-05), 구간이 8 → 12 가 됐다.
//   여기 60~90 을 그대로 두면 **옛 기획서를 지키는 검사**가 되어, 맞게 고친
//   쪽이 빨개진다. 숫자를 안 고치고 놔두면 도구가 게임을 뒤로 끈다.
//   PLAN2H §5 의 배치표가 0~132분이므로 100~140 으로 잡는다.
const ok2 = lapMins.every((m) => m >= 100 && m <= 140);
// 구간당 추격 1~2회. **평균**으로 본다 — 구간마다 0회가 섞이는 것은 정상이다
// (조심해서 간 구간은 안 붙는 게 맞다). 0회만 있거나 3회 넘으면 실패다
const avgChase = chasePerLeg.reduce((s, x) => s + x, 0) / chasePerLeg.length;
const ok3 = avgChase >= 1 && avgChase <= 2 && chasePerLeg.every((x) => x <= 3);
const ok4 = laps.every(([, r]) => r.done);
// ★ 제일 중요한 것 — 정책에 따라 결과가 갈리나
const pressSpread = Math.max(...laps.map(([, r]) => r.press)) - Math.min(...laps.map(([, r]) => r.press));
const timeSpread = Math.max(...lapMins) - Math.min(...lapMins);
const ok5 = pressSpread >= 20 && timeSpread >= 6;
// 늘 숨는 쪽이 압박은 제일 낮고 시간은 제일 길어야 한다 — 거래가 성립하나
const hide = laps.find(([n]) => n.startsWith('늘 숨는'))[1];
const fast = laps.find(([n]) => n.startsWith('늘 빠른'))[1];
const ok6 = hide.press < fast.press && hide.sec > fast.sec;

console.log('\n  목표 (docs/space/PLAN.md §11 · GAP.md §4)');
console.log(`  ${ok1 ? '✔' : '✘'} 구간 하나가 8~12분          ${Math.min(...legMins).toFixed(1)} ~ ${Math.max(...legMins).toFixed(1)}분`);
console.log(`  ${ok2 ? '✔' : '✘'} 회차 하나가 100~140분       ${lapMins.map((m) => m.toFixed(0) + '분').join(' · ')}`);
console.log(`  ${ok3 ? '✔' : '✘'} 구간당 추격 평균 1~2회      ${avgChase.toFixed(2)}회 (최대 ${Math.max(...chasePerLeg)})`);
console.log(`  ${ok4 ? '✔' : '✘'} 어느 길로도 끝까지 간다     ${laps.filter(([, r]) => r.done).length}/${laps.length}`);
console.log(`  ${ok5 ? '✔' : '✘'} 고르는 것이 결과를 가른다   압박 차 ${pressSpread.toFixed(0)} · 시간 차 ${timeSpread.toFixed(0)}분`);
console.log(`  ${ok6 ? '✔' : '✘'} 숨으면 안전하고 느리다      압박 ${hide.press.toFixed(0)} vs ${fast.press.toFixed(0)} · ${(hide.sec / 60).toFixed(0)}분 vs ${(fast.sec / 60).toFixed(0)}분`);

console.log('\n  ※ 방 사이를 뛰는 시간이 0 이고, **고장을 고치는 시간도 안 센다**');
console.log('     평온 구간이 비어 있다 — 실제 회차는 이보다 길다 (고장 하나에 40~70초).');
console.log('  ※ 「재미있나」는 여기서 안 나온다 — 직접 20분 돌려 봐야 한다.\n');
process.exit(ok1 && ok2 && ok3 && ok4 && ok5 && ok6 ? 0 : 1);
