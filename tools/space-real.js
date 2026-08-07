// ══════════════════════════════════════════════════════════════════════════
//  ★★ **말이 되나** — 미션과 설정을 통째로 검증한다 (2026-08-07)
//
//    node tools/space-real.js
//
//  ★ 사장님: 「사실적으로 만들어줄래? 냉각을 켜면 전력이 모자라서 센서를
//             못 키는게 말이 돼?」 → 「전체적으로 모두 검증해. 논리적으로
//             말이 되는 미션과 설정인지」
//
//  ★★ **왜 문서가 아니라 도구인가**
//     감사를 문서로만 쓰면 **다음에 또 같은 것을 넣는다.** 이 저장소가
//     이미 두 번 겪었다 — 옛 목적이 주석에 남아 몇 달을 갔고,
//     `space-2h.js` 는 네 판 전에 지은 것을 「다음 판이다」라고 말하고 있었다.
//     **문서는 낡아도 조용하지만 검사는 소리를 낸다** (`space-story.js` 와 같은 이유).
//
//  ★ 여기서 묻는 것은 **「말이 되나」뿐이다.** 「재미있나」는 안 묻는다.
//    묻는 것을 네 갈래로 나눈다:
//
//      [1] **가리키는 것이 있나** — 없는 방·없는 계통·안 도는 효과
//      [2] **자릿수** — 13초 만에 과열 같은 것
//      [3] **열역학** — 진공에서 열이 저절로 사라지지 않나
//      [4] **사람** — 우주복 없이 진공에 서 있지 않나
//      [5] **설정끼리 안 부딪히나** — 「스텔스는 불가능」과 「숨죽이기」
//      [6] **죽은 항목** — 계통으로 이미 지어졌는데 표에 남아 있는 것
//
//  ★ ✘ 가 나오는 것이 **지금은 정상이다.** 이 도구는 `docs/space/REAL.md`
//    의 감사 결과를 코드로 옮긴 것이라, v58·v59 를 만들면서 하나씩 초록이
//    된다. **고치기 전에 먼저 빨갛게 만들어 두는 것**이 요점이다 —
//    안 그러면 「고쳤다」를 증명할 방법이 없다.
// ══════════════════════════════════════════════════════════════════════════
import { MISSIONS, FAULT, wired } from '../web/space/js/game/mission-table.js';
import { HEAT, BODY, WEAR } from '../web/space/js/game/systems-table.js';
import { HEATING, SIGN, CIRCUITS, POWER_MAX } from '../web/space/js/game/chase-table.js';
import { heatRate } from '../web/space/js/game/chase.js';
import { totalRate } from '../web/space/js/game/heat.js';
import { FOOD } from '../web/space/js/game/supply-table.js';
import { LOCK } from '../web/space/js/game/airlock-table.js';
import { LEG } from '../web/space/js/game/route-table.js';
import { REGION_BY_KEY } from '../web/space/js/game/regions-table.js';
import { SCENES } from '../web/space/js/game/scene-table.js';
import { SINK } from '../web/space/js/game/heat-table.js';

let fail = 0, soft = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
/**
 * 아직 안 고친 것 — 세되 통과시킨다. `REAL.md` 가 판을 나눠 뒀다.
 *
 * ★ **통과했을 때는 다른 문장을 찍는다.** 처음엔 문제 문장을 그대로
 *   찍었는데, 그러면 「✔ 냉각을 켜면 센서를 못 켠다」처럼 **고쳤다는
 *   표시 옆에 안 고쳐진 문장**이 붙어서 읽는 사람이 반대로 이해한다
 */
const todo = (c, m, plan, fixed) => {
  console.log((c ? '  ✔ ' : '  ☐ ') + (c ? (fixed ?? m) : m) + (c ? '' : `   → ${plan}`));
  if (!c) soft++;
};

/** 배에 실제로 있는 방 — `world/ship.js` 의 ROOMS 와 같아야 한다 */
const ROOMS = ['cockpit', 'spine', 'observ', 'workshop', 'garden', 'airlock', 'engine'];
/** `game/fault.js effectsOf` 가 실제로 굴리는 효과 */
const EFFECTS = ['heat', 'coolValve', 'sign', 'food', 'drift', 'flaky', 'chartLie', 'noWinch', 'doorWild'];

console.log('\n말이 되나 — 미션과 설정을 통째로');

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[1] ★★ **가리키는 것이 있나** — 없는 방 · 없는 계통 · 안 도는 효과');
{
  const badRoom = [], badSys = [], badEff = [], badBranch = [];
  const rooms = (m) => [
    ...(m.where ?? []),
    ...(m.steps ?? []).map((s) => s.at),
    ...m.branches.flatMap((b) => (Array.isArray(b.at) ? b.at : b.at ? [b.at] : [])),
  ];
  for (const m of MISSIONS) {
    for (const r of rooms(m)) {
      if (r !== 'any' && !ROOMS.includes(r)) badRoom.push(`${m.key} → '${r}'`);
    }
    if (m.sys && !WEAR.keys.includes(m.sys)) badSys.push(`${m.key} → '${m.sys}'`);
    for (const k of Object.keys(m.effect ?? {})) {
      if (!EFFECTS.includes(k)) badEff.push(`${m.key} → effect.${k}`);
    }
    // ★ `sceneOnly` 는 예외다 — 장면이 부르는 것은 **정해진 일**이라
    //   갈래가 하나인 것이 맞다 (자동 조종이 죽으면 자이로를 간다, 끝).
    //   무작위로 뜨는 고장만 「고를 것이 있어야」 한다
    const n = m.branches.length;
    if ((n < 2 && !m.sceneOnly) || n > 4) badBranch.push(`${m.key} (${n}개)`);
  }
  // ★★ 여기서 실제로 나온다 — `cargo` 는 **배에 없는 방**이다.
  //   방은 일곱이고 화물칸은 그중에 없다. 미션 셋이 없는 방을 가리킨다
  ok(badRoom.length === 0,
    badRoom.length
      ? `**없는 방을 가리킨다** (${badRoom.length}): ${badRoom.join(' · ')}\n`
        + `      배에 있는 방은 일곱뿐이다 — ${ROOMS.join(' · ')}`
      : '모든 미션이 **있는 방**만 가리킨다');
  ok(badSys.length === 0,
    badSys.length ? `없는 계통: ${badSys.join(' · ')}` : `계통이 전부 WEAR 에 있다 (${WEAR.keys.join(' · ')})`);
  ok(badEff.length === 0,
    badEff.length
      ? `**게임이 안 굴리는 효과** (${badEff.length}): ${badEff.join(' · ')}\n`
        + '      `fault.js effectsOf` 가 안 읽으면 그 미션은 **아무 일도 안 낸다**'
      : '모든 효과를 게임이 실제로 굴린다');
  ok(badBranch.length === 0,
    badBranch.length ? `갈래가 2~4를 벗어난다: ${badBranch.join(' · ')}` : '갈래가 전부 2~4개');
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[2] ★★ **자릿수** — 방향은 맞는데 10배 틀린 것 (REAL.md §2-B)');
{
  const t = (p, v) => {
    const r = heatRate({ thrust: !!p.thrust, cool: !!p.cool }, v);
    return r > 0 ? (HEAT.max - HEAT.start) / r : Infinity;
  };
  const idle = t({}, false), thr = t({ thrust: 1 }, false);
  console.log(`   다 꺼짐 → 과열까지 ${Number.isFinite(idle) ? idle.toFixed(0) + '초' : '안 오른다'}`);
  console.log(`   추진만  → 과열까지 ${Number.isFinite(thr) ? thr.toFixed(0) + '초' : '안 오른다'}`);
  todo(idle >= 900,
    `아무것도 안 하는 배가 **15분은 버틴다** (지금 ${Number.isFinite(idle) ? idle.toFixed(0) : '∞'}초)`,
    'v58 · HEATING.idle 0.5 → 0.06',
    `★ 아무것도 안 하는 배가 ${(idle / 60).toFixed(0)}분 버틴다 (예전 132초)`);
  todo(thr >= 30 && thr <= 60,
    `추진만 켜면 **30~60초**에 과열 (지금 ${thr.toFixed(0)}초)`,
    'v58 · HEATING.thrust 4.6 → 1.9',
    `★ 추진만 켜면 ${thr.toFixed(0)}초에 과열 (예전 13초) — 냉각을 켜야만 밟을 수 있다`);
  // 사람 — 걷기라고 부르는 값이 정말 걸음인가
  todo(BODY.speed <= 1.6 || BODY.gravity !== undefined,
    `걷기 ${BODY.speed} m/s — 사람 걸음은 1.3~1.5 다. 그보다 빠르면 **왜 빠른지**가 표에 있어야 한다`,
    'v59 · BODY.gravity 0.4 를 적고 주석의 「뛰지 않는다」를 지운다');
  // 식량 — 이게 정말 식량의 시계인가
  const foodMin = 100 / FOOD.perSec / 60;
  todo(foodMin >= 60,
    `식량 100 → 0 이 ${foodMin.toFixed(1)}분. 밥 먹고 ${((100 - FOOD.shaky) / FOOD.perSec / 60).toFixed(0)}분 뒤에 손이 떨리는 사람은 없다`,
    'v59 · 10분 시계는 추진제로 옮기고 식량은 2시간에 2~3끼');
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[3] ★★ **열역학** — 진공에서 열이 저절로 사라지나 (REAL.md §2-B·I)');
{
  // ★★ **선체가 아니라 「총열」로 묻는다** (v58). 냉각 회로는 선체를
  //   식히는 것이 맞다 — 다만 그 열이 **저장고로 옮겨갈 뿐** 안 없어진다.
  //   그래서 선체 온도로 재면 영영 답이 안 나온다
  const closed = totalRate({ thrust: true, valveOpen: false });
  console.log(`   냉각 ON · 라디에이터 닫힘 → 총열 ${closed >= 0 ? '+' : ''}${closed.toFixed(2)}/초`);
  todo(closed >= 0,
    '라디에이터가 닫혀 있으면 **총열은 안 준다** — 진공에서 열을 버리는 길은 복사뿐이고,'
    + ' 냉각 회로는 열을 **옮길 뿐**이다',
    '(v58 에서 고쳤다 — game/heat.js)',
    '★ 라디에이터가 닫혀 있으면 **총열이 절대 안 준다** — 냉각 회로는 옮길 뿐이다');
  // 자국 — 열을 버리는 두 가지가 부호가 반대다
  // ★★ **v58 에서 이 검사의 뜻이 뒤집혔다.** 예전에는 「둘 다 열을 버리는
  //   일인데 부호가 반대다」를 틀렸다고 봤다. 지금은 **둘이 다른 일**이라
  //   부호가 반대인 것이 **맞다**:
  //     냉각    — 선체에서 저장고로 **미룬다.** 선체가 식으니 적외선이 준다 (−)
  //     라디에이터 — 저장고에서 우주로 **버린다.** 몰아서 값을 치른다 (+)
  //   대신 **미루는 것이 공짜면 안 된다** — 나중에 치르는 쪽이 더 커야 한다
  console.log(`   자국: 냉각 ${SIGN.cool}(미루기) · 라디에이터 ${SIGN.valveOpen}(값 치르기)`);
  todo(SIGN.cool < 0 && SIGN.valveOpen > 0 && Math.abs(SIGN.valveOpen) > Math.abs(SIGN.cool),
    `냉각(${SIGN.cool})과 라디에이터(${SIGN.valveOpen})가 **둘 다 열을 버리는 일**인데 부호가 반대다`,
    'v58 · 냉각은 미루기(−), 라디에이터는 값 치르기(+)',
    `★ 미루면 자국이 ${-SIGN.cool} 줄고 버릴 때 ${SIGN.valveOpen} 오른다 —`
    + ' **미루는 것이 공짜가 아니다.** 「스텔스는 잠깐만 가능하다」가 이 두 숫자다');
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[4] ★★ **전력** — 사장님이 짚으신 것 (REAL.md §2-A)');
{
  console.log(`   회로 ${CIRCUITS.length} 중 ${POWER_MAX} 만: ${CIRCUITS.map((c) => c.name).join(' · ')}`);
  todo(POWER_MAX >= CIRCUITS.length,
    '**냉각을 켜면 센서를 못 켠다.** 주 추진은 수십 MW, 냉각 펌프는 수 kW,'
    + ' 센서 수신기는 수백 W 다 — 전구를 켜면 엔진이 꺼지는 자동차다',
    'v58 · POWER_MAX 를 없앤다. 묶는 것은 전력이 아니라 열이다',
    `★ 회로 ${CIRCUITS.length} 을 **다 켤 수 있다.** 묶는 것은 전력이 아니라 **열**이다 —`
    + ' 다 켜면 저장고가 빨리 차고, 차면 라디에이터를 열어야 하고, 열면 자국이 폭발한다');
  // 방향까지 반대다 — 추진을 켜면 냉각이 제일 필요한데 그때 못 켠다
  todo(POWER_MAX >= 3,
    '그리고 **방향이 반대다** — 추진이 열을 제일 많이 내므로 그때 냉각이 제일 필요한데,'
    + ' 지금 규칙은 바로 그때 냉각을 막는다',
    'v58 · 같이 풀린다',
    '★ 추진을 켠 채로 냉각을 켤 수 있다 — 열이 제일 많이 날 때 식힐 수 있다');
  // 능동 탐지의 값이 너무 싸다
  todo(SIGN.sensor >= 15,
    `센서 자국이 ${SIGN.sensor} — 능동 레이더는 **등대를 켜는 것**이다. 그런데 추진(${SIGN.thrust})의 6분의 1 이다`,
    'v58 · 수동/능동으로 가르고 능동은 20',
    `★ 능동 탐지 자국이 ${SIGN.sensor} — 켜면 접촉 기준(${SIGN.contactAt})을 넘긴다.`
    + ' 수동 청취는 늘 켜져 있고, 끄는 것은 **거리**다');
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[5] ★★ **사람** — 우주복 없이 진공에 서 있지 않나 (REAL.md §2-C)');
{
  const secs = (1 - LOCK.airFloor) / LOCK.airDrain;
  console.log(`   바깥문 열고 사람이 그 안에 ${secs.toFixed(0)}초 버틴다`);
  todo(LOCK.suit !== undefined,
    `우주복이 표에 없다. 진공에서 사람은 **15초**면 의식을 잃는데 여기서는 ${secs.toFixed(0)}초 동안 윈치를 잡는다`,
    'v59 · suit-table.js (입는 22초 · 등에 진 공기 · 둔한 장갑)');
  todo(secs <= 20,
    '「공기가 준다」가 벌인데, 에어록은 **배와 격리된 칸**이다 — 배 전체 공기가 줄면 그건 에어록이 아니다',
    'v59 · 공기는 에어록 한 칸 것으로');
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[6] ★★ **설정끼리 안 부딪히나**');
{
  // 「우주에서 스텔스는 불가능하다」(CHASE2) vs 「숨죽이기」(mission)
  const silent = MISSIONS.find((m) => m.key === 'silentRun');
  todo(SINK.max > 0 && SINK.dumpRate > 0,
    `「우주에서 스텔스는 불가능하다」(CHASE2)를 적어 놓고 미션에 「${silent.name}」(전부 끄고 기다린다)이 있다`,
    'v58 · 열 저장고',
    `★ 「${silent.name}」이 이제 말이 된다 — 저장고에 담는 동안은 숨고, 차면 못 숨는다.`
    + ' **스텔스는 불가능한 게 아니라 잠깐만 가능하다** (space-heat.js [4])');
  // 버리기 — 던지면 뿌리쳐지나
  const jet = MISSIONS.find((m) => m.key === 'jettison');
  todo(!jet.branches.some((b) => /뿌리친다/.test(b.what)),
    `「${jet.name}」 — 「${jet.branches[0].what}」. 화물을 던져도 질량은 조금 줄 뿐이고,`
    + ' 던진 것은 **새 표적**이 되어 오히려 자국이 된다',
    'v59 · 「뿌리친다」가 아니라 「저쪽이 그걸 줍느라 늦는다」로',
    `★ 「${jet.name}」이 **시간을 사는 것**이 됐다 — 「${jet.branches[0].what}」.`
    + ' 「남의 미끼」와 짝이 맞는다: 내가 던진 것을 언젠가 누가 줍는다');
  // 미소운석 — 뚫린 방에 들어가 7초를 고친다
  const micro = MISSIONS.find((m) => m.key === 'micrometeor');
  todo(!micro.effect.sign || micro.effect.air,
    `「${micro.name}」 — 벽이 뚫렸는데 벌이 **자국**뿐이다 (effect.sign ${micro.effect.sign}).`
    + ' 그리고 뚫린 방에 사람이 들어가 6초 동안 손으로 막는다',
    'v59 · 뚫린 방은 문이 잠기고, 들어가려면 우주복을 입는다 (C 와 같은 표)');
  // 성간 공백 — 별이 준다
  todo(REGION_BY_KEY.void.stars >= 0.8,
    `성간 공백의 별이 ${REGION_BY_KEY.void.stars} 배다. 원반을 벗어나면 **은하수 띠**가 사라지지`
    + ' 별이 주는 것이 아니다 — 먼지가 없어 오히려 또렷하다',
    'v58 · void.stars 0.16 → 0.95, 띠만 따로 0 으로');
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[7] ★ **죽은 항목** — 계통으로 이미 지어졌는데 표에 남아 있는 것');
{
  // 표의 항목이 나중에 제 계통으로 다시 지어지면, 표 쪽은 **영영 안 뜨는데**
  // 목록에는 남아서 「아직 할 일이 있다」로 읽힌다
  const built = [
    ['distress', 'G 구조 신호 (rescue-table.js · v54)'],
    ['deadSat', '떠도는 것들 (target-table.js · v49)'],
  ];
  for (const [key, where] of built) {
    const m = MISSIONS.find((x) => x.key === key);
    todo(!m, `「${m.name}」이 표에 남아 있는데 **${where}** 로 이미 지어졌다 — 표 쪽은 영영 안 뜬다`,
      'v59 · 표에서 빼거나 「지어졌다」를 적는다');
  }
  const live = wired();
  console.log(`   지금 실제로 뜨는 고장: ${live.length}종 / 표 ${MISSIONS.length}개`);
  ok(live.length >= 6, `${live.length}종이 실제로 뜬다 — 6종 미만이면 같은 것만 반복된다`);
  const never = MISSIONS.filter((m) => !live.includes(m) && !m.sceneOnly);
  console.log(`   한 번도 안 뜨는 것: ${never.length}개 — ${never.map((m) => m.name).join(' · ')}`);
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[8] ★ **장면** — 표가 가리키는 것이 다 있나');
{
  const missing = Object.entries(SCENES).filter(([, s]) => !s.built).map(([k, s]) => `${k}(${s.lead})`);
  console.log(`   장면 ${Object.keys(SCENES).length}개 중 안 지어진 것: ${missing.length}`);
  if (missing.length) console.log('   ' + missing.join(' · '));
  ok(missing.length <= 1, `안 지어진 장면이 ${missing.length}개 — 둘 이상이면 12구간에 구멍이 난다`);
}

console.log('');
console.log(fail ? `✘ ${fail} 군데 — **지금 틀린 것**` : '✔ 지금 틀린 것은 없다');
console.log(soft ? `☐ ${soft} 군데 — **고치기로 한 것** (docs/space/REAL.md)` : '');
console.log('\n  ※ ☐ 는 실패가 아니라 **약속**이다. `REAL.md` 가 v58·v59 로 나눠 뒀고,');
console.log('     고칠 때마다 하나씩 ✔ 로 바뀐다. 고치기 전에 먼저 빨갛게 만들어');
console.log('     두는 이유는, 안 그러면 **「고쳤다」를 증명할 방법이 없기** 때문이다.');
process.exit(fail ? 1 : 0);
