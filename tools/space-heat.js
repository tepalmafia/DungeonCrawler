// ══════════════════════════════════════════════════════════════════════════
//  ★★ 열 저장고 — **말이 되나, 그리고 쳇바퀴가 아닌가** (v58)
//
//    node tools/space-heat.js
//
//  ★ 사장님: 「냉각을 켜면 전력이 모자라서 센서를 못 키는게 말이 돼?」
//
//  ★★ 여기서 묻는 것 여섯. 앞의 셋은 **말이 되나**, 뒤의 셋은 **게임이 되나**다.
//     둘 다 통과해야 한다 — 말이 되는데 지루하면 그건 고친 게 아니다.
//
//       ① 자릿수    — 13초 만에 과열 같은 것이 없나
//       ② 열역학    — 라디에이터가 닫혀 있으면 **총열이 안 주나**
//       ③ 냉각의 뜻 — 옮기는 것이 추진을 **겨우** 이기나
//       ④ 숨는 시간 — 라디에이터를 안 열고 얼마나 버티나
//       ⑤ 쳇바퀴    — 회차 하나에 몇 번 여닫나
//       ⑥ 선택      — 다 켜는 것이 늘 답은 아닌가
//
//  ★★ **⑤ 가 제일 중요하다.** 2026-08-05 에 사장님이 「하루종일 열만
//     내리나? 왜 의미없는 짓을 마우스를 계속 누르고 있어야하지?」라고
//     하셨고, 그때 밸브는 26초마다 다시 돌려야 했다. 열을 말이 되게
//     고치다가 **그 자리로 되돌아가면 아무것도 안 고친 것**이다.
// ══════════════════════════════════════════════════════════════════════════
import { SINK, coolEfficiency } from '../web/space/js/game/heat-table.js';
import { makeHeat, stepHeat, hullRate, totalRate, sinkFull, hideLeft } from '../web/space/js/game/heat.js';
import { HEAT } from '../web/space/js/game/systems-table.js';
import { HEATING, SIGN, CIRCUITS, POWER_MAX } from '../web/space/js/game/chase-table.js';
import { signatureOf } from '../web/space/js/game/chase.js';
import { LEG } from '../web/space/js/game/route-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DT = 1 / 30;

/** 한 상태로 계속 굴려서 **무슨 일이 언제 나는지** 잰다 */
function run(o, { until, cap = 7200 }) {
  const s = makeHeat();
  if (o.sink !== undefined) s.sink = o.sink;
  if (o.hull !== undefined) s.hull = o.hull;
  let t = 0;
  while (t < cap && !until(s, t)) { stepHeat(s, DT, o); t += DT; }
  return { s, t };
}

console.log('\n열 저장고 — 말이 되나, 그리고 쳇바퀴가 아닌가');

console.log('\n[1] ★★ **자릿수** — 13초 만에 과열 같은 것이 없나');
{
  const hot = (o) => run(o, { until: (s) => s.hull >= HEAT.max }).t;
  const idle = hot({ thrust: false, cool: false, valveOpen: false });
  const thr = hot({ thrust: true, cool: false, valveOpen: false });
  console.log(`   다 꺼짐 → 과열까지 ${(idle / 60).toFixed(1)}분   (예전 132초)`);
  console.log(`   추진만  → 과열까지 ${thr.toFixed(0)}초        (예전 13초)`);
  ok(idle >= 900,
    `아무것도 안 하는 배가 **15분 이상** 버틴다 (${(idle / 60).toFixed(1)}분)`);
  ok(thr >= 30 && thr <= 60,
    `추진만 켜면 **30~60초**에 과열 (${thr.toFixed(0)}초) — 냉각을 켜야만 밟을 수 있다`);
}

console.log('\n[2] ★★ **열역학** — 라디에이터가 닫혀 있으면 총열이 안 주나');
{
  // 총열 = 선체 + 저장고. 옮기는 것은 총열을 안 바꾼다
  const rows = [
    ['다 꺼짐', { thrust: false, valveOpen: false }],
    ['냉각만', { thrust: false, valveOpen: false }],
    ['추진+냉각', { thrust: true, valveOpen: false }],
    ['라디에이터 열림', { thrust: true, valveOpen: true }],
  ];
  for (const [n, o] of rows) {
    const r = totalRate(o);
    console.log(`   ${n.padEnd(16)} 총열 ${(r >= 0 ? '+' : '') + r.toFixed(2)}/초`);
  }
  ok(totalRate({ thrust: false, valveOpen: false }) >= 0,
    '★ 라디에이터가 닫혀 있으면 총열이 **절대 안 준다** — 진공에서 열을 버리는 길은 복사뿐이다');
  ok(totalRate({ thrust: true, valveOpen: false }) >= 0,
    '냉각을 켜도 마찬가지다 — 냉각 회로는 **옮길 뿐**이다');
  ok(totalRate({ thrust: true, valveOpen: true }) < 0,
    '★ 라디에이터를 열어야 **진짜로 나간다**');
  // 실제로 굴려서 확인 — 표가 맞아도 규칙이 틀릴 수 있다
  const a = run({ thrust: true, cool: true, valveOpen: false }, { until: (s, t) => t >= 60 });
  const before = HEAT.start + SINK.start, after = a.s.hull + a.s.sink;
  console.log(`   60초 굴려 보니 총열 ${before.toFixed(0)} → ${after.toFixed(0)}`);
  ok(after > before, '★ 실제로 굴려도 총열은 **늘기만 한다** (닫아 놓은 동안)');
}

console.log('\n[3] ★ **냉각의 뜻** — 옮기는 것이 추진을 겨우 이기나');
{
  const gen = HEATING.idle + HEATING.thrust;
  console.log(`   추진이 내는 열 ${gen.toFixed(2)}/초 · 냉각이 옮기는 양 ${SINK.moveRate}/초`);
  const margin = SINK.moveRate - gen;
  ok(margin > 0, `냉각이 추진을 **이긴다** (여유 ${margin.toFixed(2)}/초)`);
  ok(margin < gen * 0.3,
    `다만 **겨우** 이긴다 (여유가 ${(margin / gen * 100).toFixed(0)}%) — 넉넉하면 켜 두는 것으로 끝나고,`
    + ' 모자라면 냉각이 장식이 된다');
  // 저장고가 차면 냉각이 죽는다
  const at = SINK.max * 0.99;
  ok(coolEfficiency(at) < 0.5,
    `저장고가 99% 면 냉각이 ${(coolEfficiency(at) * 100).toFixed(0)}% 밖에 안 먹는다 — **가득 차면 선체가 오른다**`);
  const hotAfterFull = run(
    { thrust: true, cool: true, valveOpen: false, sink: SINK.max },
    { until: (s) => s.hull >= HEAT.max },
  ).t;
  ok(hotAfterFull > 20 && hotAfterFull < 90,
    `저장고가 가득인 채로 밟으면 ${hotAfterFull.toFixed(0)}초에 과열 — 20~90초라야 「지금 가야 한다」가 된다`);
}

console.log('\n[4] ★★ **숨는 시간** — 라디에이터를 안 열고 얼마나 버티나');
{
  const fill = run({ thrust: true, cool: true, valveOpen: false }, { until: (s) => sinkFull(s) }).t;
  const fillIdle = run({ thrust: false, cool: true, valveOpen: false }, { until: (s) => sinkFull(s) }).t;
  console.log(`   밟으면서  → ${(fill / 60).toFixed(1)}분`);
  console.log(`   멈춰서    → ${(fillIdle / 60).toFixed(1)}분`);
  // ★ 이 값이 곧 「우주에서 스텔스는 잠깐만 가능하다」의 실체다.
  //   장면 박자(120~240초)보다 길고 구간(약 8분)보다 짧아야 한다 —
  //   짧으면 장면 하나를 못 버티고, 길면 구간 내내 안 열어도 된다
  ok(fill >= 240 && fill <= 600,
    `밟으면서 **4~10분** 버틴다 (${(fill / 60).toFixed(1)}분) — 장면 하나(2~4분)는 숨을 수 있고`
    + ` 구간 하나(${(LEG.seconds / 60).toFixed(0)}분)는 못 버틴다`);
  ok(fillIdle > fill * 1.05,
    `멈추면 더 오래 숨는다 (${(fillIdle / 60).toFixed(1)}분 > ${(fill / 60).toFixed(1)}분) —`
    + ' **밟는 것이 곧 들키는 것**이라는 축과 같은 방향이다');
  const h = hideLeft({ sink: SINK.start }, { thrust: true, cool: true });
  console.log(`   화면에 뜨는 「이대로 몇 분」 = ${(h / 60).toFixed(1)}분`);
  ok(h > 0, '★ 화면이 **초가 아니라 「몇 분 더」**로 말한다 — 「저장고 62%」로는 아무것도 못 정한다');
}

console.log('\n[5] ★★ **쳇바퀴가 아닌가** — 회차 하나에 몇 번 여닫나');
{
  // 라디에이터를 언제 여나: 저장고가 차면 열고, 비면 잠근다 (사람이 할 법한 것)
  const s = makeHeat();
  let t = 0, opens = 0, open = false, openT = 0, exposed = 0;
  const RUN = LEG.seconds * 12;          // 회차 하나 (12구간)
  while (t < RUN) {
    if (!open && sinkFull(s)) { open = true; opens++; openT = t; }
    if (open && s.sink <= SINK.max * 0.06) { open = false; exposed += t - openT; }
    stepHeat(s, DT, { thrust: true, cool: true, valveOpen: open });
    t += DT;
  }
  const perOpen = opens ? exposed / opens : 0;
  console.log(`   회차 ${(RUN / 60).toFixed(0)}분에 **${opens}번** 열었다`);
  console.log(`   한 번 열면 ${perOpen.toFixed(0)}초 동안 열려 있다 (그동안 자국 +${SIGN.valveOpen})`);
  console.log(`   손이 가는 횟수 = ${opens * 2}회 (열고 잠그고) — 약 ${(RUN / 60 / (opens * 2)).toFixed(1)}분에 한 번`);
  ok(opens >= 6 && opens <= 14,
    `**6~14번** — 1~2번이면 결정이 아니고, 30번이면 「하루종일 열만 내리는」 그 자리로 되돌아간다`);
  ok(perOpen >= 60 && perOpen <= 300,
    `한 번 열면 ${perOpen.toFixed(0)}초 — **1~5분 동안 눈에 띈다.** 그게 값이다`);
  ok(RUN / (opens * 2) >= 240,
    `손이 가는 것이 ${(RUN / 60 / (opens * 2)).toFixed(1)}분에 한 번 — 4분보다 잦으면 잔일이다`
    + ' (예전 밸브는 **26초**마다였다)');
}

console.log('\n[6] ★★ **선택** — 다 켜는 것이 늘 답은 아닌가');
{
  console.log(`   회로 ${CIRCUITS.length} 중 ${POWER_MAX} — ${POWER_MAX >= CIRCUITS.length ? '**다 켜진다**' : '제한이 남아 있다'}`);
  ok(POWER_MAX >= CIRCUITS.length,
    '★ 전력 제한이 없다 — 냉각을 켜도 능동 탐지가 켜진다 (사장님이 짚으신 것)');
  const heat = 30;
  const combos = [
    ['추진+냉각', { thrust: true, cool: true, sensor: false }],
    ['추진+냉각+능동', { thrust: true, cool: true, sensor: true }],
    ['냉각만', { thrust: false, cool: true, sensor: false }],
  ];
  for (const [n, p] of combos) {
    const dark = signatureOf(p, heat, 1, false);
    const open = signatureOf(p, heat, 1, true);
    console.log(`   ${n.padEnd(16)} 자국 ${dark.toFixed(0)} (라디에이터 열면 ${open.toFixed(0)}) · 접촉 기준 ${SIGN.contactAt}`);
  }
  const a = signatureOf({ thrust: true, cool: true, sensor: false }, heat, 1, false);
  const b = signatureOf({ thrust: true, cool: true, sensor: true }, heat, 1, false);
  ok(b - a >= 15,
    `능동 탐지를 켜면 자국이 **${(b - a).toFixed(0)} 오른다** — 등대를 켜는 것이다. 그래서 늘 켜 두는 것이 답이 아니다`);
  ok(a < SIGN.contactAt && b > SIGN.contactAt,
    `★ 그리고 그 ${(b - a).toFixed(0)} 이 **접촉 기준(${SIGN.contactAt})을 넘긴다** (${a.toFixed(0)} → ${b.toFixed(0)}) —`
    + ' 거리를 알 것인가 안 들킬 것인가가 진짜 선택이 된다');
  const c = signatureOf({ thrust: true, cool: true, sensor: false }, heat, 1, true);
  ok(c > SIGN.contactAt,
    `라디에이터를 열면 그것만으로도 넘긴다 (${c.toFixed(0)}) — **버리는 동안은 반드시 눈에 띈다**`);
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「이해되나」는 여기서 안 나온다.** 계기 두 줄을 보고');
console.log('     「냉각은 옮기고 라디에이터가 버린다」가 읽히는지는 화면이 답한다.');
console.log('     그게 이 판에서 제일 위험한 자리다 — 안 읽히면 말이 되는 대신');
console.log('     **어려운** 것이 되고, 그러면 칸 두 개짜리 옛 규칙이 차라리 나았다.');
process.exit(fail ? 1 : 0);
