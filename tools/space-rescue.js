// ══════════════════════════════════════════════════════════════════════════
//  G 구조 신호 — **가는 것이 진짜 선택인가** (7판 · story-table.js 「혼자다」)
//
//    node tools/space-rescue.js
//
//  ★ 여기서 묻는 것은 「뭉클한가」가 아니다. 넷뿐이다:
//      ① **공짜가 아닌가** — 가면 값을 치르나
//      ② **손해도 아닌가** — 치른 값보다 받는 것이 나은가
//      ③ **되돌릴 수 없나** — 껐다 켰다로 벌을 피할 수 있으면 벌이 아니다
//      ④ **안 가도 게임이 이어지나** — 지나친 것도 결과여야 한다
//
//  ★★ 기준점은 **윈치**다. 밖에 대고 뭔가 하는 동안의 벌은 이 게임에
//     이미 모양이 있고 (`WINCH.sign` 9/초 × 50초 = 접촉 위험 26%,
//     `tools/space-supply.js` 가 잰 값), 구조 신호는 그것과 **견줄 수
//     있어야** 한다. 새 저울을 만들면 두 개가 서로 안 맞는다.
// ══════════════════════════════════════════════════════════════════════════
import { RESCUE, RSTEP, RESCUE_WORD } from '../web/space/js/game/rescue-table.js';
import {
  makeRescue, hearSignal, stepRescue, passSignal,
  broadcasting, holding, alongside, settled, answerAt, summary,
} from '../web/space/js/game/rescue.js';
import { WINCH, TRADE, PARTS, FOOD } from '../web/space/js/game/supply-table.js';
import { LEG } from '../web/space/js/game/route-table.js';
import { SCENES } from '../web/space/js/game/scene-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DT = 1 / 30;

console.log('\nG 구조 신호 — 가는 것이 진짜 선택인가');

console.log('\n[1] ★★ **공짜가 아닌가** — 윈치와 견준다');
{
  const load = WINCH.load / WINCH.perSec;
  console.log(`   윈치 한 통   ${load}초 · 자국 ${WINCH.sign}/초 · 쌓이는 몫 ${(load * WINCH.sign).toFixed(0)}`);
  console.log(`   구조 신호    ${RESCUE.answer}초 · 자국 ${RESCUE.sign}/초 · 쌓이는 몫 ${(RESCUE.answer * RESCUE.sign).toFixed(0)}`);
  ok(RESCUE.sign > WINCH.sign,
    `초당 자국이 윈치보다 세다 (${RESCUE.sign} > ${WINCH.sign}) — **무전은 방송이다**`);
  ok(RESCUE.answer < load,
    `대신 시간은 짧다 (${RESCUE.answer} < ${load}초) — 2시간에 한 번뿐이라 길 이유가 없다`);
  const mine = load * WINCH.sign, call = RESCUE.answer * RESCUE.sign;
  ok(call > mine * 0.9 && call < mine * 1.6,
    `쌓이는 몫이 한 통과 견줄 만하다 (${call.toFixed(0)} vs ${mine.toFixed(0)}) — 같은 저울 위에 있다`);
  ok(RESCUE.hold === true,
    '★ 응답하는 동안 **구간이 안 나아간다** — 이걸 빼면 안 갈 이유가 없어진다');
}

console.log('\n[2] ★★ **손해도 아닌가** — 치른 값보다 받는 것이 나은가');
{
  const g = RESCUE.gives;
  console.log(`   받는 것 — 부품 ${g.parts} · 식량 ${g.food} (광석은 없다)`);
  console.log(`   거점 거래 한 번 — 광석 ${TRADE.ore} → 식량 ${TRADE.food} + 부품 ${TRADE.parts}`);
  ok(!g.ore, '**광석은 안 준다** — 광석은 내가 캐는 것이다 (PLAN §5-3)');
  ok(g.parts >= TRADE.parts * 2,
    `부품 ${g.parts} 는 **거래 ${(g.parts / TRADE.parts).toFixed(0)}번어치** — 그게 「갈 만하다」의 크기다`);
  ok(g.parts <= PARTS.max / 3,
    `다만 창고(${PARTS.max})의 ${(g.parts / PARTS.max * 100).toFixed(0)}% 다 — 한 번에 채워 주면 정비가 시시해진다`);
  // ★★ **재는 단위가 v62 에서 바뀌었다** (열여섯 번째).
  //   예전에는 「식량 ${'$'}{g.food} 이 몇 **분**어치인가 (2~8분)」를 물었다.
  //   그런데 v62 에 식량 시계가 13분 → 61분으로 옮겨 가면서 (REAL.md §2-D)
  //   **같은 30 이 4분어치에서 18분어치가 됐다** — 보상은 한 톨도 안 바꿨는데
  //   검사가 빨개진 것이다. 즉 이 줄은 보상을 잰 것이 아니라 **시계를**
  //   재고 있었다.
  //
  //   바로 위 부품 줄은 **창고의 몇 %** 로 재고 있었고 그건 안 흔들렸다.
  //   같은 단위로 맞춘다 — 「한 번에 채워 주면 시시해진다」가 요점이므로
  //   **가득의 몇 %** 가 물어야 할 것이다.
  const pct = (g.food / FOOD.max) * 100;
  const min = g.food / FOOD.perSec / 60;
  ok(pct >= 15 && pct <= 40,
    `식량 ${g.food} 는 가득의 **${pct.toFixed(0)}%** (15~40%) — 거래 한 번(${TRADE.food})과 비슷하다.`
    + ` 회차에 한 번뿐인 일이므로 그만큼은 준다 (${min.toFixed(0)}분어치)`);
  const spent = (RESCUE.answer + RESCUE.take) / LEG.seconds * 100;
  console.log(`   드는 시간 ${RESCUE.answer + RESCUE.take}초 = 구간의 ${spent.toFixed(0)}%`);
  ok(spent >= 8 && spent <= 20, `구간의 ${spent.toFixed(0)}% (8~20%) — 우회인데 구간을 통째로 먹으면 안 된다`);
}

console.log('\n[3] ★★ **되돌릴 수 없나** — 껐다 켜며 자국을 피할 수 있으면 벌이 아니다');
{
  // ★ **켰다 껐다 해 본다.** 여기서 400프레임(=13초)만 돌렸다가 빨개졌다 —
  //   42초짜리를 13초로 재고 「안 된다」고 한 것이다. 검사가 짧으면 게임이
  //   아니라 검사가 틀린다
  const r = makeRescue();
  hearSignal(r);
  let on = 0, held = 0, t3 = 0;
  while (t3 < 90 && !alongside(r)) {
    const hold = Math.floor(t3) % 2 === 0;   // 1초 잡고 1초 놓는다
    if (broadcasting(r)) on += DT;
    if (hold && broadcasting(r)) held += DT;
    stepRescue(r, DT, hold);
    t3 += DT;
  }
  console.log(`   1초씩 끊어 잡았더니 — 켜져 있던 ${on.toFixed(0)}초 중 실제로 잡은 것은 ${held.toFixed(0)}초`);
  console.log(`   ${t3.toFixed(0)}초 걸렸다 (내리 잡으면 ${RESCUE.answer}초)`);
  ok(on > held * 1.5,
    `★ **놓아도 방송은 나간다** (${on.toFixed(0)}초) — 진행은 잡은 만큼(${held.toFixed(0)}초)만 는다`);
  ok(t3 > RESCUE.answer * 1.5,
    `그래서 끊어 잡으면 **손해만 난다** (${t3.toFixed(0)}초 > ${RESCUE.answer}초) — 한 번 켠 것은 되돌릴 수 없다`);
  // 그리고 진행은 잡은 만큼만 는다
  const r2 = makeRescue();
  hearSignal(r2);
  let t = 0;
  while (t < 400 && !alongside(r2)) { stepRescue(r2, DT, true); t += DT; }
  ok(Math.abs(t - RESCUE.answer) < 1,
    `내리 잡으면 ${t.toFixed(0)}초에 붙는다 (표는 ${RESCUE.answer})`);
}

console.log('\n[4] ★ **받는 데 바깥문이 필요한가** — 있던 동작을 다시 쓴다');
{
  const r = makeRescue();
  hearSignal(r);
  let t = 0;
  while (!alongside(r) && t < 200) { stepRescue(r, DT, true); t += DT; }
  ok(alongside(r), '붙었다');
  // 문을 안 열면 못 받는다
  let u = 0;
  while (u < RESCUE.take * 2 && !settled(r)) { stepRescue(r, DT, false, { outerOpen: false }); u += DT; }
  ok(!settled(r) && r.got.parts === 0, '★ **바깥문을 안 열면 못 받는다** — 새 동사를 안 만들었다');
  // 열면 받는다
  let v = 0;
  while (!settled(r) && v < RESCUE.take * 3) { stepRescue(r, DT, false, { outerOpen: true }); v += DT; }
  ok(r.step === RSTEP.TOOK && r.got.parts === RESCUE.gives.parts,
    `열었더니 받는다 — 부품 ${r.got.parts} · 식량 ${r.got.food}`);
}

console.log('\n[5] ★★ **안 가도 게임이 이어지나** — 지나친 것도 결과다');
{
  // ① 아예 응답 안 함
  const a = makeRescue();
  hearSignal(a);
  for (let i = 0; i < 600; i++) stepRescue(a, DT, false);
  ok(a.step === RSTEP.HEARD, '응답 안 하면 **저절로 안 끝난다** — 장면 시계가 끝낸다');
  ok(passSignal(a) && a.step === RSTEP.MISSED, '장면이 끝나면 지나친 것으로 닫힌다');

  // ② 붙었는데 안 받음 — 떠난다
  const b = makeRescue();
  hearSignal(b);
  let t = 0;
  while (!alongside(b) && t < 200) { stepRescue(b, DT, true); t += DT; }
  let u = 0, ev = null;
  while (!settled(b) && u < RESCUE.waitFor * 2) { ev = stepRescue(b, DT, false, { outerOpen: false }) ?? ev; u += DT; }
  ok(b.step === RSTEP.MISSED && ev === 'left',
    `${u.toFixed(0)}초 안 열었더니 **떠난다** (표는 ${RESCUE.waitFor}초) — 영원히 기다리면 멈춘 게임이다`);
  ok(RESCUE.waitFor > RESCUE.take * 4,
    `기다려 주는 ${RESCUE.waitFor}초는 받는 ${RESCUE.take}초보다 넉넉하다 — 「몰라서 놓쳤다」는 함정이지 벌이 아니다`);

  ok(Object.keys(RESCUE_WORD).length === 2,
    '★ 간 것도 안 간 것도 **끝 화면 목록에 남는다** — 그래야 고른 것이 뜻을 갖는다');
}

console.log('\n[6] 장면 표와 안 갈라졌나');
{
  // ══ ★★★ v112 — **방을 견주던 자리다** ═══════════════════════════════
  //  「장면 G 의 방(에어록)과 무전기 자리가 같나」를 물었다. v109 가 방을
  //  없애고 v112 가 장면 표의 축을 **`from`(무엇이 오는가)**으로 바꾸면서
  //  둘 다 사라졌다. ★ G 는 원래 **항로를 트는 결심**이라 방이 없어져도
  //  그대로 산다 — 그래서 이제 「사람에게서 오나」를 묻는다
  ok(SCENES.G.from === 'soul',
    `★★ 장면 G 는 **사람에게서 온다** (${SCENES.G.from}) — 일곱 중 이것 하나뿐이다.`
    + ' 2시간에 딱 한 번 남의 목소리를 듣는 자리이므로 결이 달라야 한다');
  console.log(`   G — 「${SCENES.G.lead}」 · 쓰는 계통 ${SCENES.G.uses.join('·')}`);
  ok(SCENES.G.built === true, '장면 G 가 지어졌다');
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「뭉클한가」는 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「공짜가 아닌가 · 손해도 아닌가 · 되돌릴 수 없나 · 안 가도 이어지나」뿐이다.');
console.log('     무전기가 손에 닿나는 space-endtoend.js 가 손으로 본다.');
process.exit(fail ? 1 : 0);
