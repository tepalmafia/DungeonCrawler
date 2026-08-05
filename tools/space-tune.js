// ══════════════════════════════════════════════════════════════════════════
//  항로 숫자 쓸어보기 — **손으로 맞추지 않는다.**
//
//    node tools/space-tune.js          제일 잘 맞는 조합 10개
//    node tools/space-tune.js --all    통과한 것 전부
//
//  ★ 왜 만들었나
//    항로에는 서로 물린 숫자가 여섯이다 (구간 기준 길이 · 관성 · 압박 속도 ·
//    시간 몫 · 거점 감쇠 · 지형 속도 둘). 하나를 고치면 나머지 다섯의 답이
//    같이 움직인다. 실제로 손으로 여섯 번 고쳤는데 **고칠 때마다 다른 지표가
//    깨졌다** — 구간 길이를 맞추면 추격이 0회가 되고, 추격을 맞추면 정책 간
//    차이가 사라졌다.
//
//    이건 감으로 맞출 수 있는 종류가 아니다. **쓸어 보고 고르는 것**이 맞다.
//
//  ★ 이건 검사가 아니라 도구다
//    통과 여부를 찍는 것은 `tools/space-route.js` 다. 이건 그 목표를 만족하는
//    조합을 **찾아 주는** 것이고, 찾은 값은 표에 손으로 옮겨 적는다.
//    표가 진실이어야 하지, 이 스크립트가 진실이면 안 된다.
// ══════════════════════════════════════════════════════════════════════════
import { LEG, PRESS } from '../web/space/js/game/route-table.js';
import { REGION_BY_KEY } from '../web/space/js/game/regions-table.js';
import { makeRoute, stepRoute, chooseFork, contactAt, trackMult, signMult, relieveEscape, RPHASE }
  from '../web/space/js/game/route.js';
import { makeChase, stepChase, heatRate, PHASE } from '../web/space/js/game/chase.js';
import { CHASE } from '../web/space/js/game/chase-table.js';
import { HEAT, VALVE, wantValve } from '../web/space/js/game/systems-table.js';

const DT = 0.5;                       // 쓸어보기라 굵게. 목표는 분 단위다
const ALL = process.argv.includes('--all');

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

const PICKS = {
  hide: (o) => o[0],
  fast: (o) => o[1],
  watch: (o, rt) => (rt.press > 60 ? o[0] : o[1]),
  alt: (o, rt) => o[rt.leg % 2],
};

function runLap(pick, seed) {
  const rt = makeRoute(seed);
  const c = makeChase();
  const st = { mode: 'push' };
  let heat = HEAT.start, coolFor = 0, t = 0;
  const legs = [];
  let legStart = 0, legChases = 0;
  const CAP = 4 * 3600;
  while (t < CAP && rt.phase !== RPHASE.END) {
    if (rt.phase === RPHASE.PORT) {
      chooseFork(rt, pick(rt.offer, rt).key);
      legStart = t; legChases = 0;
      continue;
    }
    const p = pilot(Object.assign(st, { heat, risk: c.risk, chasing: c.phase === PHASE.CHASE, dt: DT }));
    coolFor = wantValve(heat, p.thrust) ? 1 : 0;
    heat = Math.max(0, Math.min(HEAT.max, heat + heatRate(p, coolFor > 0) * DT));

    const ev = stepChase(c, DT, p, heat, signMult(rt),
      { contactAt: contactAt(rt), trackMult: trackMult(rt), valveOpen: coolFor > 0 });
    if (ev === 'contact') legChases++;
    if (ev === 'escaped') relieveEscape(rt);
    // 잡혀도 **그 자리에서 또 안 붙는다.** 뿌리친 뒤와 같은 유예를 준다 —
    // 안 그러면 잡히고 30초 만에 또 붙어서 한 구간이 통째로 추격이 된다
    if (ev === 'caught') { c.phase = PHASE.SHAKEN; c.risk = 0; c.dist = 0; c.timer = 0; }

    const rev = stepRoute(rt, DT, p);
    if (rev === 'overrun' && c.phase === PHASE.CALM) {
      c.phase = PHASE.CHASE; c.dist = CHASE.startDist; c.timer = 0; legChases++;
    }
    if (rev === 'arrive' || rev === 'end') legs.push({ sec: t - legStart, chases: legChases });
    t += DT;
  }
  return { legs, sec: t, press: rt.press, done: rt.phase === RPHASE.END };
}

/** 지금 표로 목표 여섯을 재고 점수를 매긴다 (0 이 완벽) */
function score(seeds = ['SPACE1', 'DRIFT7', 'KOR42']) {
  const laps = {};
  for (const k of Object.keys(PICKS)) {
    laps[k] = seeds.map((s) => runLap(PICKS[k], s));
  }
  const flat = Object.values(laps).flat();
  if (flat.some((r) => !r.done || r.legs.length === 0)) return null;

  const legMins = flat.flatMap((r) => r.legs.map((l) => l.sec / 60));
  const lapMins = flat.map((r) => r.sec / 60);
  const chases = flat.flatMap((r) => r.legs.map((l) => l.chases));
  const avgChase = chases.reduce((a, b) => a + b, 0) / chases.length;
  const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

  const hideP = avg(laps.hide.map((r) => r.press)), fastP = avg(laps.fast.map((r) => r.press));
  const hideT = avg(laps.hide.map((r) => r.sec)), fastT = avg(laps.fast.map((r) => r.sec));

  const m = {
    legLo: Math.min(...legMins), legHi: Math.max(...legMins),
    lapLo: Math.min(...lapMins), lapHi: Math.max(...lapMins),
    avgChase, maxChase: Math.max(...chases),
    pressSpread: fastP - hideP, timeSpread: (hideT - fastT) / 60,
    hideP, fastP,
  };
  // 벗어난 만큼만 벌점 — 「몇 점」이 아니라 「얼마나 벗어났나」로 고른다
  const out = (v, lo, hi) => (v < lo ? lo - v : v > hi ? v - hi : 0);
  m.penalty =
    out(m.legLo, 8, 12) * 2 + out(m.legHi, 8, 12) * 2
    + out(m.lapLo, 60, 90) * 0.3 + out(m.lapHi, 60, 90) * 0.3
    + out(m.avgChase, 1, 2) * 12 + out(m.maxChase, 0, 3) * 6
    + out(m.pressSpread, 20, 999) * 0.5
    + out(m.timeSpread, 6, 999) * 0.8;
  m.pass = m.penalty === 0;
  return m;
}

// ── 쓸어본다 ────────────────────────────────────────────────
const GRID = {
  seconds: [460, 490, 520, 550],
  coast: [0.3, 0.45, 0.6],
  perLeg: [32, 40, 48, 56],
  drift: [0.012, 0.022, 0.032],
  portKeep: [0.45, 0.55, 0.65],
  nebulaSpeed: [0.70, 0.78, 0.85],
  debrisSpeed: [0.72, 0.80],
};

const keep = { ...LEG }, keepP = { ...PRESS };
const neb = REGION_BY_KEY.nebula, deb = REGION_BY_KEY.debris;
const keepN = neb.speed, keepD = deb.speed;

const found = [];
let tried = 0;
for (const seconds of GRID.seconds)
  for (const coast of GRID.coast)
    for (const perLeg of GRID.perLeg)
      for (const drift of GRID.drift)
        for (const portKeep of GRID.portKeep)
          for (const ns of GRID.nebulaSpeed)
            for (const ds of GRID.debrisSpeed) {
              LEG.seconds = seconds; LEG.coast = coast;
              PRESS.perLeg = perLeg; PRESS.drift = drift; PRESS.portKeep = portKeep;
              neb.speed = ns; deb.speed = ds;
              tried++;
              const m = score();
              if (m && (ALL ? m.pass : true)) {
                found.push({ seconds, coast, perLeg, drift, portKeep, ns, ds, ...m });
              }
            }

Object.assign(LEG, keep); Object.assign(PRESS, keepP);
neb.speed = keepN; deb.speed = keepD;

found.sort((a, b) => a.penalty - b.penalty);
const show = ALL ? found.filter((f) => f.pass) : found.slice(0, 10);

console.log(`\n조합 ${tried}개를 시드 3개씩 돌렸다. 통과 ${found.filter((f) => f.pass).length}개\n`);
console.log('  벌점  구간초 관성 구간압박 시간몫 거점 성운 잔해   구간분      회차분    추격  압박차 시간차');
console.log('  ' + '─'.repeat(92));
for (const f of show) {
  console.log('  '
    + f.penalty.toFixed(2).padStart(5)
    + String(f.seconds).padStart(7) + f.coast.toFixed(2).padStart(6)
    + String(f.perLeg).padStart(8) + f.drift.toFixed(3).padStart(8)
    + f.portKeep.toFixed(2).padStart(6) + f.ns.toFixed(2).padStart(6) + f.ds.toFixed(2).padStart(6)
    + `  ${f.legLo.toFixed(1)}~${f.legHi.toFixed(1)}`.padStart(12)
    + `  ${f.lapLo.toFixed(0)}~${f.lapHi.toFixed(0)}`.padStart(9)
    + f.avgChase.toFixed(2).padStart(7)
    + f.pressSpread.toFixed(0).padStart(7) + f.timeSpread.toFixed(0).padStart(7));
}
console.log('\n  고른 값은 **표에 손으로 옮겨 적는다** — 이 스크립트가 진실이면 안 된다.\n');
