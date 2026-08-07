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
// ★★ v58 — 열이 두 칸이 됐다. 시뮬도 같은 규칙을 써야 한다 (heat.js)
import { makeHeat, stepHeat, sinkFull } from '../web/space/js/game/heat.js';
import { SINK } from '../web/space/js/game/heat-table.js';
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
  const st = makeHeat();
  let coolFor = 0;
  let t = 0, contactAt = force ? 0 : -1;
  const trip = { valve: 0, breaker: 0 };
  let last = null;

  while (t < CAP) {
    const p = plan({ t, heat, coolFor, chase: c, sign: c.sign, sink: st.sink, sinkFull: sinkFull(st) });
    // 밸브를 열러 갔다면 걸린다 (실제로는 기관실까지 뛰어야 한다 — 위 주의)
    // ★ **잠금식이다.** 26초 걸림이 아니라 「열면 잠글 때까지」 —
    //   `coolFor` 는 이제 「열려 있나」다 (0 또는 1)
    if (p.turnValve !== (coolFor > 0)) { coolFor = p.turnValve ? 1 : 0; if (p.turnValve) trip.valve++; }

    const power = { thrust: p.thrust, cool: p.cool, sensor: p.sensor };
    const key = `${p.thrust}${p.cool}${p.sensor}`;
    if (last !== null && key !== last) trip.breaker++;
    last = key;

    // ★★ **v58 — 두 곳을 고쳤다.**
    //   ① 열이 두 칸이 됐다. 예전에는 `heatRate` 한 번이라 **저장고가
    //      차는 것을 시뮬이 못 봤다** — 그래서 「밀어붙이기」가 영원히
    //      안 붙는 것으로 나왔다. 실제로는 6분쯤 뒤에 저장고가 차고,
    //      차면 냉각이 죽어 선체가 오르고, 그때 붙는다
    //   ② **밸브를 `stepChase` 에 안 넘기고 있었다.** 그래서 라디에이터를
    //      열어도 자국이 안 올랐고, 「열면 뿌리친다 · 잠그면 뿌리친다」로
    //      나와서 밸브가 아무 뜻이 없어 보였다. 표에는 `SIGN.valveOpen`
    //      17 이 있었는데 **시뮬이 그 줄을 안 읽고 있었다**
    st.hull = heat;
    stepHeat(st, DT, { thrust: power.thrust, cool: power.cool, valveOpen: coolFor > 0 });
    heat = st.hull;
    const ev = stepChase(c, DT, power, heat, mult, { valveOpen: coolFor > 0 });
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
//
//  ★★ **v58 에서 통째로 다시 썼다.** 예전 전략 다섯은 전부
//     「밸브를 계속 열어 둔다」였고, 그때는 그게 정답이었다 — 밸브가
//     열을 없애는 유일한 길이었으니까.
//
//     지금은 **반대다.** 라디에이터를 열면 자국이 +17 이라
//     추격 중에는 **여는 순간 진다** (붙는 속도가 벌어지는 속도를 넘는다).
//     대신 **열 저장고**가 6분쯤 버텨 주므로, 추격 동안은 닫아 두고
//     **뿌리친 뒤에 비운다.** 밸브의 자리가 추격 **안**에서 추격
//     **사이**로 옮겨간 것이다.
//
//     그래서 여기 전략도 그 축으로 다시 짰다 — 안 그러면 시뮬이
//     **옛 정답을 흉내 내는 사람**을 재게 되고, 그건 아무것도 못 잰다.
const PLANS = {
  // ★ 새 정답 — 저장고에 담아 두고 달린다
  '저장고로 버틴다 (추진+냉각, 라디에이터 닫음)': () => ({
    thrust: true, cool: true, sensor: false, turnValve: false,
  }),
  // ★ 예전 정답 — 이제는 진다. 「늘 하던 것이 안 통한다」
  '라디에이터를 연 채 (예전 정답)': () => ({
    thrust: true, cool: true, sensor: false, turnValve: true,
  }),
  '눈 뜨고 달리기 (능동 탐지까지)': () => ({
    thrust: true, cool: true, sensor: true, turnValve: false,
  }),
  '냉각을 안 켠다 (선체가 오른다)': () => ({
    thrust: true, cool: false, sensor: false, turnValve: false,
  }),
  '안 민다 (냉각만)': () => ({
    thrust: false, cool: true, sensor: false, turnValve: false,
  }),
  // ★ 저장고가 차면 어쩔 수 없이 연다 — **추격이 길어지면 값을 치른다**
  '버티다 차면 연다': (s) => ({
    thrust: true, cool: true, sensor: false, turnValve: !!s.sinkFull,
  }),
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
//  ★★ **v58 — 이 검사의 뜻이 뒤집혔다.**
//     예전에는 「같은 길을 밸브만 잠근 채 가면 잡혀야 한다」를 물었다.
//     밸브가 열을 없애는 유일한 길이었으므로 그게 맞았다.
//
//     지금은 반대다 — 라디에이터를 여는 것은 **열을 버리는 것이고 곧
//     나를 밝히는 것**(자국 +17)이라, 추격 중에는 **닫아야 이긴다.**
//     저장고가 6분쯤 버텨 주므로 추격(90~180초)은 닫은 채로 난다.
//
//     그러니 물어야 할 것은 이것이다:
//     **「추격 중에 여는 것이 손해인가」** — 손해가 아니면 저장고가
//     있으나 마나 하고, 「스텔스는 잠깐만 가능하다」도 뜻을 잃는다.
const shut = run(() => ({ thrust: true, cool: true, sensor: false, turnValve: false }),
  { force: true });
const open = run(() => ({ thrust: true, cool: true, sensor: false, turnValve: true }),
  { force: true });
const ok5 = shut.ok && !open.ok;
console.log(`  ${ok5 ? '✔' : '✘'} ★ 추격 중엔 닫아야 이긴다        `
  + `닫으면 ${shut.ok ? `${shut.chaseSec.toFixed(0)}초에 뿌리친다` : '잡힌다'}`
  + ` · 열면 ${open.ok ? '뿌리친다' : '잡힌다'} (자국 +${SIGN.valveOpen})`);
console.log('     (밸브의 자리가 추격 **안**에서 추격 **사이**로 옮겨갔다 —');
console.log('      달리는 동안 저장고에 담고, 뿌리친 뒤에 비운다)');


console.log('\n  ※ 방 사이를 뛰는 시간이 0 으로 계산된다. 실제 플레이는 이보다 길다.');
console.log('  ※ 「재미있나」는 여기서 안 나온다 — 직접 돌려 봐야 안다.\n');
process.exit(ok1 && ok2 && ok3 && ok4 && ok5 ? 0 : 1);
