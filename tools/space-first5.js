// ══════════════════════════════════════════════════════════════════════════
//  **아무것도 모르는 사람의 첫 5분.** 브라우저 없이.
//
//    node tools/space-first5.js
//
//  ★ 왜 이 도구가 새로 필요했나 — v21 이 배포된 채로 못 하는 게임이었다
//    사장님이 켜 보시고 「둘러본다 나오고 쫓아온다 나오고 아무것도 못하고
//    그냥 끝나는데」라고 하셨다. 그때 검사 도구는 **전부 초록이었다.**
//
//      space-tutor.js   가짜 사람이 **말해 준 뒤에만** 움직였다
//      space-chase.js   walk 를 떼자마자 skipTutor() 로 나머지를 건너뛰었다
//      space-sim.js     **이미 아는 사람**이 이길 수 있나만 물었다
//      space-route.js   잡힘을 **자기가 고쳐서** 돌렸다 (게임엔 그 규칙이 없었다)
//
//    **넷 다 「잘하는 사람」만 흉내냈다.** 첫 5분을 재는 도구가 하나도 없었다.
//
//  ★ 그래서 여기서는 **못하는 사람들**을 흉내낸다
//    굳은 사람 · 먼저 하는 사람 · 시키는 대로 하는 사람 · 마구 누르는 사람 ·
//    밟기만 하는 사람. 이 다섯이 5분을 넘기면 게임이 「켜진다」고 본다.
//
//  ★ 정직하게 — 이 도구는 main.js 의 프레임 순서를 **두 번째로 적은 것**이다
//    두 곳에 적으면 갈라진다. **main.js 의 systemsStep 순서를 바꾸면 여기도
//    바꾼다.** 판정에 쓰이는 것만 베끼고 화면·소리·기하는 안 베낀다.
// ══════════════════════════════════════════════════════════════════════════
import { TUTOR, LESSONS, KEYS } from '../web/space/js/game/tutor-table.js';
import { makeTutor, stepTutor, lineOf, nowKey, allDone, canFire } from '../web/space/js/game/tutor.js';
import { SIGN, CHASE, CAUGHT } from '../web/space/js/game/chase-table.js';
import { makeChase, stepChase, heatRate, canTurnOn, PHASE, signatureOf } from '../web/space/js/game/chase.js';
import { HEAT, VALVE } from '../web/space/js/game/systems-table.js';
// ★ v58 — 열이 두 칸이 됐다. 밸브 가르침이 저장고를 본다 (tutor-table.js)
import { makeHeat, stepHeat, sinkAt } from '../web/space/js/game/heat.js';
import { makeRoute, stepRoute, chooseFork, contactAt, trackMult, signMult, regionOf, RPHASE }
  from '../web/space/js/game/route.js';
import { makeFaults, stepFaults, effectsOf, wearStep, clear } from '../web/space/js/game/fault.js';
import { makeHazard, stepHazard, newLeg, HPHASE } from '../web/space/js/game/hazard.js';
import { makeSupply, stepSupply, shaky } from '../web/space/js/game/supply.js';
import { REGION_BY_KEY } from '../web/space/js/game/regions-table.js';

const DT = 1 / 30;
const MIN5 = 300;
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };

// ── 방 사이는 걸어야 한다 ───────────────────────────────────
// ★ 「손이 즉시 닿는다」로 흉내내면 이 게임의 전부(왕복)가 사라진다.
//   PLAN §11 의 방 사이 6~12초 중 가운데를 쓴다.
const WALK = 9;

/** 한 판 — main.js 의 프레임 순서를 굵게 베낀다 */
function play(policy, seed = 'F5') {
  const route = makeRoute(seed);
  const chase = makeChase();
  const faults = makeFaults(seed);
  const hazard = makeHazard(seed);
  const supply = makeSupply();
  const tutor = makeTutor();
  // 정박 상태로 시작한다 (main.js 와 같아야 한다)
  const power = { thrust: false, cool: true, sensor: false };
  const me = {
    heat: HEAT.start, st: makeHeat(), coolFor: 0, turn: 0,
    walked: 0, turned: 0, flips: 0, fixed: 0, cooled: 0, hazardSeen: 0, steered: 0,
    busy: 0,                     // 걸어가는 중이면 손이 안 닿는다
  };
  const log = { shows: [], holdEnd: {}, caught: 0, released: 0, contacts: 0,
    hot: 0, maxQuiet: 0, riskAtPort: 0, hazardAtPort: 0, shownFor: {} };
  let t = 0, lastEvent = 0, openedAt = null, openKey = null;

  while (t < MIN5) {
    const atPort = route.phase === RPHASE.PORT;
    // ── 사람 ────────────────────────────────────────────
    me.busy = Math.max(0, me.busy - DT);
    if (me.busy <= 0) policy({ t, route, chase, power, me, faults, tutor, supply, atPort });

    // ── 고장 (main.js:470) ───────────────────────────────
    const calm = chase.phase !== PHASE.CHASE && route.phase === RPHASE.LEG;
    if (canFire(tutor, 'fault')) stepFaults(faults, DT, { calm, leg: route.leg });

    // ── 보급 ────────────────────────────────────────────
    stepSupply(supply, DT, { debris: REGION_BY_KEY[regionOf(route)]?.debris ?? 0 });

    // ── 위험 지대 (main.js:500) ──────────────────────────
    const hgo = hazard.phase !== HPHASE.IDLE
      || (route.phase === RPHASE.LEG && canFire(tutor, 'hazard'));
    const hev = hgo ? stepHazard(hazard, DT, { region: regionOf(route) }) : null;
    if (hev === 'warn') { me.hazardSeen++; if (atPort) log.hazardAtPort++; }

    // ── 열 ──────────────────────────────────────────────
    wearStep(faults, DT, { power, valveOpen: me.coolFor > 0, region: regionOf(route) });
    const bad = effectsOf(faults);
    me.coolFor = Math.max(0, me.coolFor - DT);
    // ★★ v58 — 열이 두 칸이다. 여기도 게임과 같은 규칙을 쓴다 (heat.js)
    me.st.hull = me.heat;
    stepHeat(me.st, DT, {
      thrust: power.thrust, cool: power.cool, valveOpen: me.coolFor > 0, extra: bad.heat,
    });
    me.heat = me.st.hull;
    if (me.heat >= HEAT.max - 0.5) log.hot += DT;

    // ── 추격 (main.js:529 — 거점 빗장) ───────────────────
    const riskWas = chase.risk;
    const ev = atPort
      ? (chase.phase === PHASE.CALM
        ? (chase.risk = Math.max(0, chase.risk - SIGN.riskFall * DT), null)
        : stepChase(chase, DT, power, me.heat, signMult(route), { contactAt: 999, trackMult: 0 }))
      : stepChase(chase, DT, power, me.heat, signMult(route),
        { contactAt: contactAt(route), trackMult: trackMult(route) });
    if (atPort && chase.risk > riskWas) log.riskAtPort += chase.risk - riskWas;
    if (ev === 'contact') log.contacts++;
    if (ev === 'caught') {
      log.caught++;
      supply.ore = 0;
      faults.wear.hull = Math.min(1, faults.wear.hull + CAUGHT.hull);
      for (let i = 0; i < CAUGHT.faults; i++) { faults.next = 0; stepFaults(faults, 0.001, { calm: true, leg: route.leg }); }
    }
    if (ev === 'released') log.released++;

    // ── 항로 ────────────────────────────────────────────
    const rev = stepRoute(route, DT, power);
    if (rev === 'arrive' || rev === 'end') newLeg(hazard);

    // ── 가르침 ──────────────────────────────────────────
    const before = nowKey(tutor);
    const tev = stepTutor(tutor, DT, {
      walked: me.walked, turned: me.turned,
      atPort, forkPicked: route.leg + (route.fork ? 1 : 0),
      heat: me.heat, sink: sinkAt(me.st), thrust: power.thrust, flips: me.flips, cooled: me.cooled,
      faultsOpen: faults.open.length, faultsFixed: me.fixed,
      hazardSeen: me.hazardSeen, dodged: hazard.dodged, steered: me.steered,
      foodLow: shaky(supply), loads: supply.loads, traded: supply.traded,
    });
    if (tev === 'show') {
      log.shows.push({ key: nowKey(tutor), at: t });
      openedAt = t; openKey = nowKey(tutor);
      log.maxQuiet = Math.max(log.maxQuiet, t - lastEvent);
      lastEvent = t;
    }
    if (tev === 'clear') {
      if (openedAt !== null && openKey) log.shownFor[openKey] = t - openedAt;
      openedAt = null; openKey = null;
      lastEvent = t;
    }
    for (const k of ['fault', 'hazard']) {
      if (log.holdEnd[k] === undefined && canFire(tutor, k)) log.holdEnd[k] = t;
    }
    t += DT;
  }
  if (openedAt !== null && openKey) log.shownFor[openKey] = t - openedAt;
  return { route, chase, faults, tutor, supply, me, log };
}

// ── 다섯 사람 ───────────────────────────────────────────────
/** 아무것도 안 한다 — 「어디를 눌러야 할지 모르겠다」 */
const 굳은사람 = () => {};

/**
 * ★ **말해 주기 전에 먼저 해 버린다.** 이 사람이 v21 을 부쉈다.
 *   게임의 첫 화면이 「거점 · 항로를 고르십시오」라 사람은 당연히 먼저 고른다.
 */
function 먼저하는사람({ t, route, power, me, atPort }) {
  if (t > 12 && atPort && !route.fork) { chooseFork(route, route.offer[0].key); me.busy = WALK; return; }
  if (route.fork && !power.thrust && canTurnOn(power)) { power.thrust = true; me.flips++; me.busy = WALK; return; }
  // ★ v58 — 「열이 62 넘으면」이었다. 냉각이 선체를 잡아 주므로 **그 줄이
  //   영영 안 걸리게 됐고**, 그래서 이 사람이 가르침 셋에서 멈췄다.
  //   지금 라디에이터를 여는 까닭은 **저장고가 차서**다
  if ((sinkAt(me.st) > 0.6 || me.heat > 62) && me.coolFor <= 0) {
    me.coolFor = VALVE.holds; me.cooled++; me.busy = WALK;
  }
  me.walked = 99; me.turned = 99;
}

/** 시키는 대로 한다 — 줄이 뜨면 그 방까지 걸어가서 한다 */
function 시키는대로({ route, power, me, faults, tutor, supply, atPort }) {
  const k = nowKey(tutor);
  if (!k) return;
  // ══ ★★★ v116 — **첫 가르침이 `walk` 에서 `look` 으로 바뀌었다** ═══════
  //
  //  ★ v110 이 걷기를 없애면서 첫 가르침을 **둘러보기**로 바꿨다
  //    (사장님이 「WASD 로 걷고」 안내가 남아 있는 것을 보시고 고치라 하신
  //    자리다). 그런데 **이 가짜 사람이 안 따라왔다** — `look` 을 만나면
  //    아무 가지에도 안 걸려 **첫 줄에서 영영 멈췄고**, 검사는 그것을
  //    「게임이 첫 줄에서 막는다」로 읽어 빨개졌다.
  //  ★★ 「시키는 대로 하는 사람」이 **시키는 것을 못 알아듣는** 상태였다.
  //    막힌 것은 게임이 아니라 흉내였다
  if (k === 'look') { me.turned += 0.6; return; }
  if (k === 'walk') { me.walked += 0.4; me.turned += 0.1; return; }
  me.busy = WALK;
  if (k === 'route' && atPort && !route.fork) chooseFork(route, route.offer[0].key);
  if (k === 'power' && !power.thrust && canTurnOn(power)) { power.thrust = true; me.flips++; }
  if (k === 'valve') { me.coolFor = VALVE.holds; me.cooled++; }
  if (k === 'fault' && faults.open.length) { clear(faults, faults.open[0]); me.fixed++; }
  if (k === 'fly') me.steered += TUTOR.steered + 0.5;
  if (k === 'supply') supply.loads++;
}

/** 마구 누른다 — 시드로 굴린다 (Math.random 을 안 쓴다: 다시 돌면 같아야 한다) */
function 마구누르는사람({ t, route, power, me, atPort }) {
  const r = Math.abs(Math.sin(t * 12.9898) * 43758.5453) % 1;
  me.walked += 0.2; me.turned += 0.05;
  if (t % 3 > DT) return;
  me.busy = 2;
  if (r < 0.3) { const k = ['thrust', 'cool', 'sensor'][Math.floor(r * 10) % 3];
    if (power[k]) power[k] = false; else if (canTurnOn(power)) power[k] = true; me.flips++; }
  else if (r < 0.5 && me.coolFor <= 0) { me.coolFor = VALVE.holds; me.cooled++; }
  else if (r < 0.7 && atPort && !route.fork) chooseFork(route, route.offer[0].key);
}

/** ★ **밟기만 한다.** 밸브를 영영 안 만진다 — 잡히는 사람 */
function 밟기만하는사람({ route, power, me, atPort }) {
  me.walked = 99; me.turned = 99;
  if (atPort && !route.fork) { chooseFork(route, route.offer[0].key); return; }
  if (!power.thrust && canTurnOn(power)) { power.thrust = true; me.flips++; }
}

const PEOPLE = [
  ['굳은 사람', 굳은사람],
  ['먼저 하는 사람', 먼저하는사람],
  ['시키는 대로', 시키는대로],
  ['마구 누르는 사람', 마구누르는사람],
  ['밟기만 하는 사람', 밟기만하는사람],
];

// ── 1) 표만 보고 ────────────────────────────────────────────
console.log('\n[1] 표만 보고 — **떠나기 전에 이미 지고 있지 않나**');
console.log('  ' + '─'.repeat(64));
{
  const docked = { thrust: false, cool: true, sensor: false };
  const rate = heatRate(docked, false);
  const signEq = (CHASE.thrustGain - CHASE.trackBase) / CHASE.trackPerSign;
  const heatEq = (signEq - (SIGN.base + SIGN.thrust + SIGN.cool)) / SIGN.perHeat;
  console.log(`  정박 중 열 변화   ${rate.toFixed(2)}/초   (전에는 +3.70 이었다)`);
  console.log(`  추격 균형 자국    ${signEq.toFixed(1)}  →  균형 열 ${heatEq.toFixed(1)}`);
  console.log(`  시작 열           ${HEAT.start}`);
  ok(rate < 0, `정박 중에는 열이 **내려간다** (${rate.toFixed(2)}/초)`);
  ok(signatureOf(docked, HEAT.start, 1) < SIGN.contactAt,
    `정박 중 자국이 접촉 기준 아래 (${signatureOf(docked, HEAT.start, 1).toFixed(1)} < ${SIGN.contactAt})`);
  // 떠날 때쯤(20초 뒤)이면 균형점 아래로 내려가 있어야 한다
  const atLeave = HEAT.start + rate * 20;
  ok(atLeave < heatEq, `20초 뒤 떠나면 균형점 아래다 (열 ${atLeave.toFixed(1)} < ${heatEq.toFixed(1)})`);
}

// ── 2) 다섯 사람 ────────────────────────────────────────────
console.log('\n[2] 다섯 사람의 첫 5분');
console.log('  ' + '─'.repeat(76));
console.log('  ' + '누구'.padEnd(16) + '뜬 가르침'.padStart(10) + '뗀 것'.padStart(8)
  + '접촉'.padStart(6) + '잡힘'.padStart(6) + '놓여남'.padStart(8) + '빗장 풀림'.padStart(11));
const runs = PEOPLE.map(([name, fn]) => {
  const r = play(fn);
  const hn = (k) => (r.log.holdEnd[k] === undefined ? '—' : `${r.log.holdEnd[k].toFixed(0)}s`);
  console.log(`  ${name.padEnd(16)}${String(r.log.shows.length).padStart(10)}`
    + `${String(r.tutor.done.length).padStart(8)}${String(r.log.contacts).padStart(6)}`
    + `${String(r.log.caught).padStart(6)}${String(r.log.released).padStart(8)}`
    + `${(hn('fault') + '/' + hn('hazard')).padStart(13)}`);
  return { name, ...r };
});

console.log('\n  목표');
{
  const stuck = runs.filter((r) => r.name !== '굳은 사람' && r.tutor.done.length < 2);
  ok(stuck.length === 0,
    `가르침이 첫 줄에서 멈춘 사람이 없다 — ${stuck.map((r) => r.name).join(', ') || '없다'}`);
  const eager = runs.find((r) => r.name === '먼저 하는 사람');
  ok(eager.tutor.done.length >= 4,
    `**먼저 하는 사람도 이어진다** — ${eager.tutor.done.join(' → ')}`);
  ok(eager.log.holdEnd.fault !== undefined,
    `먼저 해 버려도 빗장이 풀린다 — 고장 ${eager.log.holdEnd.fault?.toFixed(0)}초`);
  // ★ v21 은 여기서 죽었다
  const died = runs.filter((r) => r.log.caught > 0 && r.log.released === 0);
  ok(died.length === 0, `잡히고 못 나온 사람이 없다 — ${died.map((r) => r.name).join(', ') || '없다'}`);
}

// ── 3) 거점은 안전한가 ──────────────────────────────────────
console.log('\n[3] 거점은 안전한가 — **주석에만 적혀 있던 규칙** (PLAN §4-2)');
{
  const risk = runs.reduce((a, r) => a + r.log.riskAtPort, 0);
  const haz = runs.reduce((a, r) => a + r.log.hazardAtPort, 0);
  console.log(`  거점에서 오른 위험 합 ${risk.toFixed(2)} · 거점에서 뜬 위험 지대 ${haz}회`);
  ok(risk < 0.01, `거점에서는 위험이 안 오른다 (${risk.toFixed(2)})`);
  ok(haz === 0, `거점에서는 위험 지대가 안 온다 (${haz}회)`);
  const idle = runs.find((r) => r.name === '굳은 사람');
  ok(idle.log.contacts === 0,
    `**아무것도 안 해도 5분을 산다** — 접촉 ${idle.log.contacts}회 (v21 은 34초에 붙고 69초에 잡혔다)`);
}

// ── 4) 첫 줄이 읽히나 ───────────────────────────────────────
console.log('\n[4] 첫 줄이 **읽을 만큼** 떠 있나');
{
  const spans = runs.flatMap((r) => Object.entries(r.log.shownFor));
  const worst = spans.reduce((a, b) => (b[1] < a[1] ? b : a), ['—', 99]);
  console.log(`  제일 짧게 떠 있던 것 — ${worst[0]} ${worst[1].toFixed(1)}초 (최소 ${TUTOR.minShow}초)`);
  ok(worst[1] >= TUTOR.minShow - 0.1,
    `한 프레임 만에 사라진 가르침이 없다 (제일 짧은 것 ${worst[1].toFixed(1)}초)`);
}

// ── 5) 잡히면 나올 수 있나 ──────────────────────────────────
console.log('\n[5] 잡히면 나올 수 있나 — **v21 은 여기가 막다른 길이었다**');
{
  const c = makeChase();
  c.phase = PHASE.CAUGHT; c.timer = 0; c.dist = 0; c.risk = 100;
  let t = 0, out = null;
  while (t < 60 && !out) { out = stepChase(c, DT, { thrust: true }, 50, 1); t += DT; }
  console.log(`  잡힌 뒤 ${t.toFixed(1)}초에 ${out ?? '아무 일도 안 남'} · 그 뒤 상태 ${c.phase}`);
  ok(out === 'released', `${CAUGHT.hold}초 뒤에 놓아준다 — 종착 상태가 아니다`);
  ok(c.phase !== PHASE.CAUGHT, `놓여난 뒤 잡힘에서 벗어난다 (${c.phase})`);
  console.log(`  뺏기는 것 — 광석 전부 · 고장 ${CAUGHT.faults}개 · 선체 +${(CAUGHT.hull * 100).toFixed(0)}%`);
  ok(CAUGHT.faults > 0, '벌이 숫자가 아니라 **일**이다');
}

console.log('\n  ※ 방 사이 이동을 9초로 굵게 본다. 실제는 6~12초이고 사람마다 다르다.');
console.log('  ※ **「읽히나 · 재미있나」는 여기서 안 나온다** — 직접 5분 돌려 봐야 한다.\n');
process.exit(fail ? 1 : 0);
