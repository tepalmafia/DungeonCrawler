// ══════════════════════════════════════════════════════════════════════════
//  추격 시뮬 — **게임과 같은 표를 읽어서** 추격 하나를 통째로 돌린다.
//
//    node tools/space-sim.js
//
//  ★ 왜 필요한가
//    「추격 90초 ~ 3분」은 docs/space/PLAN.md §11 에 적어 둔 목표다.
//    이건 손으로 20분 돌려 봐야 아는 종류가 아니라 **계산으로 바로 나오는**
//    종류다. 감으로 맞추면 반드시 「너무 빨리 끝나거나 영영 안 끝나거나」가
//    된다.
//
//  ★ 숫자를 여기 적지 않는다
//    game/chase-table.js 를 그대로 import 한다. 표가 바뀌면 이 답도 바뀐다.
//    (그러려고 game/chase.js 에서 three.js 를 뺐다)
//
//  ★ 이 시뮬이 못 보는 것 — 읽는 사람이 알아야 한다
//    **방 사이를 뛰는 시간이 0 으로 계산된다.** 실제로는 차단기를 바꾸러
//    통로까지 6~12초, 밸브를 열러 기관실까지 또 그만큼 걸린다. 여기 나오는
//    시간은 **아래끝**이고, 실제 플레이는 이보다 길다.
//    그리고 「재미있나」는 여기서 절대 안 나온다 — 그건 직접 돌려 봐야 한다.
// ══════════════════════════════════════════════════════════════════════════
import { SIGN, CHASE, POWER_MAX } from '../web/space/js/game/chase-table.js';
import { makeChase, stepChase, heatRate, signatureOf, PHASE } from '../web/space/js/game/chase.js';
import { HEAT, VALVE, wantValve } from '../web/space/js/game/systems-table.js';
import { REGION_BY_KEY } from '../web/space/js/game/regions-table.js';

const DT = 1 / 60;
const CAP = 600;          // 10분이면 실패로 본다

/**
 * 한 판 돌린다.
 * @param plan (state) => { thrust, cool, sensor, turnValve } — 매 순간의 선택
 */
function run(plan, { regionKey = 'empty', force = false } = {}) {
  const mult = REGION_BY_KEY[regionKey].signMult;
  const c = makeChase();
  // ★ `risk = 100` 으로는 안 붙었다. stepChase 가 **더한 뒤에** 견주므로
  //   그 프레임에 riskFall 이 빠져서 99.96 이 된다. 단계를 직접 넣는다.
  if (force) { c.phase = PHASE.CHASE; c.dist = CHASE.startDist; c.timer = 0; }
  let heat = HEAT.start;
  let coolFor = 0;
  let t = 0, contactAt = force ? 0 : -1;
  const trip = { valve: 0, breaker: 0 };
  let last = null;

  while (t < CAP) {
    const p = plan({ t, heat, coolFor, chase: c, sign: c.sign });
    // 밸브를 열러 갔다면 걸린다 (실제로는 기관실까지 뛰어야 한다 — 위 주의)
    // ★ **잠금식이다.** 26초 걸림이 아니라 「열면 잠글 때까지」 —
    //   `coolFor` 는 이제 「열려 있나」다 (0 또는 1)
    if (p.turnValve !== (coolFor > 0)) { coolFor = p.turnValve ? 1 : 0; if (p.turnValve) trip.valve++; }

    const power = { thrust: p.thrust, cool: p.cool, sensor: p.sensor };
    const key = `${p.thrust}${p.cool}${p.sensor}`;
    if (last !== null && key !== last) trip.breaker++;
    last = key;

    heat = Math.max(0, Math.min(HEAT.max, heat + heatRate(power, coolFor > 0) * DT));
    const ev = stepChase(c, DT, power, heat, mult);
    t += DT;
    if (ev === 'contact') contactAt = t;
    if (ev === 'escaped') return { ok: true, chaseSec: t - contactAt, toContact: contactAt, heat, trip };
    if (ev === 'caught') return { ok: false, why: '잡힘', chaseSec: t - contactAt, toContact: contactAt, heat, trip };
  }
  return {
    ok: false,
    why: c.phase === PHASE.CHASE ? '10분 안에 못 뿌리침' : '접촉조차 안 됨',
    chaseSec: contactAt < 0 ? 0 : t - contactAt, toContact: contactAt, heat, trip,
  };
}

// ── 사람이 실제로 할 법한 선택들 ───────────────────────────
// **셋 중 둘**이라는 규칙 안에서만 짠다.
// 「번갈아」는 **틈(hysteresis)** 을 둔다 — 안 그러면 기준선에서 매 프레임
// 왔다 갔다 해서 차단기를 만 번 만지는 사람이 된다. 사람은 그렇게 안 한다.
const HI = 70, LO = 40;
const PLANS = {
  '밀어붙이기 (추진+냉각, 밸브 계속)': (s) => ({
    thrust: true, cool: true, sensor: false, turnValve: wantValve(s.heat, true),
  }),
  '눈 뜨고 달리기 (추진+센서)': () => ({
    thrust: true, cool: false, sensor: true, turnValve: false,
  }),
  '숨죽이기 (냉각+센서, 안 민다)': (s) => ({
    thrust: false, cool: true, sensor: true, turnValve: wantValve(s.heat, false),
  }),
  '번갈아 (뜨거우면 식히고 식으면 민다)': (s) => {
    if (s.heat > HI) s.mode = 'cool';
    else if (s.heat < LO) s.mode = 'push';
    const push = s.mode !== 'cool';
    return { thrust: push, cool: true, sensor: false, turnValve: wantValve(s.heat, push) };
  },
  '번갈아 + 눈 (거리를 보며)': (s) => {
    if (s.heat > HI) s.mode = 'cool';
    else if (s.heat < LO) s.mode = 'push';
    if (s.mode === 'cool') return { thrust: false, cool: true, sensor: true, turnValve: wantValve(s.heat, false) };
    return { thrust: true, cool: false, sensor: true, turnValve: false };
  },
};

// ── 1) 평온 — 접촉까지 얼마나 ────────────────────────────────
// **접촉을 피하는 것이 잘하는 것이다.** 「영영 안 붙음」은 실패가 아니라
// 정답이고, 그런 길이 하나는 있어야 「조심해서 가는 판」이 성립한다.
console.log(`\n전력 ${POWER_MAX}/3 · 접촉 기준 자국 ${SIGN.contactAt} · 시작 거리 ${CHASE.startDist}`);
console.log('\n[1] 평온 — 이렇게 가면 언제 붙나');
console.log('  ' + '─'.repeat(62));
const calm = [];
for (const [name, plan] of Object.entries(PLANS)) {
  const st = { mode: 'push' };
  const r = run((x) => plan(Object.assign(st, x)), {});
  calm.push([name, r]);
  const when = r.toContact < 0 ? '안 붙는다' : `${r.toContact.toFixed(0)}초`;
  console.log(`  ${name.padEnd(34)} ${when.padStart(10)}   (끝 열 ${Math.round(r.heat)})`);
}

// ── 2) 추격 — 붙은 뒤 얼마나 가나 ────────────────────────────
console.log('\n[2] 추격 — 붙여 놓고 잰다');
console.log('  ' + '─'.repeat(62));
const runs = [];
for (const [name, plan] of Object.entries(PLANS)) {
  const st = { mode: 'push' };
  const r = run((x) => plan(Object.assign(st, x)), { force: true });
  runs.push([name, r]);
  const mark = r.ok ? '✔' : '✘';
  const how = r.ok ? `${r.chaseSec.toFixed(0)}초에 뿌리침` : r.why;
  console.log(`  ${mark} ${name.padEnd(34)} ${how.padStart(16)}   밸브 ${r.trip.valve} · 차단기 ${r.trip.breaker}`);
}

// ── 목표와 견주기 ───────────────────────────────────────────
const TARGET = { lo: 90, hi: 180 };
const won = runs.filter(([, r]) => r.ok);
const inRange = won.filter(([, r]) => r.chaseSec >= TARGET.lo && r.chaseSec <= TARGET.hi);
const safe = calm.filter(([, r]) => r.toContact < 0);
const ok1 = won.length >= 1;
const ok2 = won.length < runs.length;
const ok3 = inRange.length >= 1;
const ok4 = safe.length >= 1 && safe.length < calm.length;

console.log('\n  목표 (docs/space/PLAN.md §11)');
console.log(`  ${ok1 ? '✔' : '✘'} 뿌리칠 수 있는 길이 있다        ${won.length}/${runs.length}개 성공`);
console.log(`  ${ok2 ? '✔' : '✘'} 아무거나 해서는 안 된다         ${runs.length - won.length}개 실패`);
console.log(`  ${ok3 ? '✔' : '✘'} 추격 하나가 ${TARGET.lo}~${TARGET.hi}초          `
  + (won.length ? won.map(([, r]) => `${r.chaseSec.toFixed(0)}초`).join(' · ') : '없음'));
console.log(`  ${ok4 ? '✔' : '✘'} 조심하면 안 붙을 수 있다        ${safe.length}/${calm.length}개가 안 붙음`);
// ★ **「방 이동 3~8회」를 은퇴시키고 질문을 바꿨다** (2026-08-05 · 사장님).
//
//   전에는 `밸브 + 차단기` 를 셌다. 그런데 밸브가 26초마다 풀렸으므로
//   그 숫자의 **대부분이 「밸브를 다시 돌리러 간 횟수」**였다 — 즉 이 검사는
//   손이 바쁜 것을 잰 게 아니라 **쳇바퀴를 세고 있었다.** 그리고 초록이었다.
//
//   「하루종일 열만 내리나? 왜 의미없는 짓을 마우스를 계속 누르고 있어야하지?」
//
//   밸브를 잠금식으로 바꾸자 그 횟수가 1로 떨어졌다. 그래서 「차단기를 몇 번
//   바꾸나」로 바꿔 봤는데 **그것도 0 이었고, 그건 맞는 값이었다** —
//   추격 중에는 추진을 켜야만 거리가 벌어지므로(`CHASE.thrustGain`)
//   차단기를 만질 이유가 없다. 차단기의 자리는 **평온할 때**다.
//
//   그러니 추격에서 물어야 할 것은 횟수가 아니라 이것이다:
//   **「밸브가 답에 쓰이나」** — 같은 길을 밸브만 잠근 채 가면 잡혀야 한다.
//   안 그러면 밸브는 있으나 마나 한 물건이다.
const shut = run((s) => ({ thrust: true, cool: true, sensor: false, turnValve: false }),
  { force: true });
const openWin = won.find(([n]) => n.startsWith('밀어붙이기'))?.[1];
const ok5 = !!openWin?.ok && !shut.ok;
console.log(`  ${ok5 ? '✔' : '✘'} ★ 밸브가 답에 쓰인다            `
  + `열면 ${openWin?.ok ? '뿌리친다' : '못 뿌리친다'} · 잠그면 ${shut.ok ? '뿌리친다' : '잡힌다'}`);
console.log('     (추격 중 차단기는 안 센다 — 추진을 켜야 거리가 벌어지므로 만질 이유가 없다.');
console.log('      차단기의 자리는 평온할 때 「열을 미리 낮춰 둘 것인가」이다)');


console.log('\n  ※ 방 사이를 뛰는 시간이 0 으로 계산된다. 실제 플레이는 이보다 길다.');
console.log('  ※ 「재미있나」는 여기서 안 나온다 — 직접 돌려 봐야 안다.\n');
process.exit(ok1 && ok2 && ok3 && ok4 && ok5 ? 0 : 1);
