// ══════════════════════════════════════════════════════════════════════════
//  ※ ★★★ **접혔습니다 (v135)** — 돌리면 말하고 물러납니다.
//
//    이 검사가 지키던 설계(`evade-table.js` 의 **누적** 모형)를 v135 가
//    통째로 갈았습니다. 지금 도는 것은 `tools/space-dodge.js` 입니다.
//
//  ★★★ **왜 지우지 않고 접나.** 이 저장소가 v124 에 아홉을 접으며 적어 둔
//    그대로입니다 — 지우면 **되살릴 때 같이 안 돌아옵니다.** 그리고 이
//    검사는 접기 직전까지 **초록이었습니다**: 표가 그대로 남아 있으니
//    옛 모형은 여전히 제 규칙을 지켰고, 그래서 **죽은 설계를 초록으로
//    지키고 있었습니다.** 「낡은 초록은 낡은 빨강보다 나쁩니다」 —
//    빨강은 눈에 띄지만 초록은 「되고 있다」고 **거짓말**을 합니다.
//
//  ★ 되살리려면: `evade-table.js` 의 `export const FOLDED` 를 지우고
//    `target.js` 가 `gainAt` 을 다시 부르게 하면 됩니다.
// ══════════════════════════════════════════════════════════════════════════
import { FOLDED } from '../web/space/js/game/evade-table.js';

if (FOLDED) {
  console.log('※ 이 검사는 접혀 있습니다 (v135).');
  console.log(`   ${FOLDED.at} 에 **${FOLDED.by}** 가 대신합니다 — node tools/space-dodge.js`);
  console.log(`   까닭: ${FOLDED.why}`);
  process.exit(0);
}

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **회피 타이밍** — 뼈대만 (v111) · 아래는 접히기 전의 기록입니다
//
//    node tools/space-evade.js
//
//  ★ 사장님 「미사일이 날아올때 **q e를 써서 회피기동**을 하면 **높은
//    확률로 공격을 회피하거나 피해를 줄일 수** 있도록 해줘. 적의 미사일을
//    보고 **타이밍을 어떻게 맞출지 타이밍을 어떻게 줄지 기획**하고 적용해」
//
//  ★★★ 묻는 것 여섯
//      ① **Q/E 만으로 피해지나** — 사장님이 시키신 것이 되나
//      ② ★★ **아무 때나 굴리는 것이 답이 아닌가** — 그러면 타이밍이 없다
//      ③ ★★ **창이 사람 반응 시간보다 넓은가** — 좁으면 타이밍이 아니라 운이다
//      ④ **못 피해도 덜 맞나** (사장님 「피해를 줄일 수」)
//      ⑤ ★ **급기동 없이도 되나** — 되면 추진제 저울이 죽지 않나
//      ⑥ ★ 화면이 **언제인지 말하나** (고리)
// ══════════════════════════════════════════════════════════════════════════
import {
  EVADE, FLY, NEED, inWindow, isPerfect, gainAt, missed, hurtMult, ringAt, RING_WORD,
} from '../web/space/js/game/evade-table.js';
import { RCS } from '../web/space/js/game/flight-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const BM = RCS.burst.mult;
const dt = 1 / 60;

/**
 * 한 발을 흉내낸다 — **한 번 꺾는다** (계속 붙들고 있는 것이 아니다).
 *
 *   ★ 처음에 「`left <= at` 이면 계속 민다」로 짰다가 태웠다. 그러면
 *     **일찍 시작할수록 오래 밀게 되어** 「언제 꺾나」가 아니라 「얼마나
 *     오래 미나」를 재게 된다. 그래서 0.9초에 꺾는 것이 제일 많이 쌓였고,
 *     그건 이 계통이 말하려는 것과 **정반대**였다.
 *
 * @param at   몇 초 **남았을 때** 꺾나 (null 이면 안 꺾는다)
 * @param how  { push, roll, burst, hold } — `hold` 는 꺾고 있는 시간 (초)
 */
function shot(at, how = {}) {
  const hold = how.hold ?? 0.30;   // 한 번 꺾으면 이만큼 민다
  let got = 0;
  for (let left = FLY; left > 0; left -= dt) {
    const on = at !== null && left <= at && left > at - hold;
    if (on) got += gainAt(left, { ...how, burstMult: BM }) * dt;
  }
  return { got: +got.toFixed(2), miss: missed(got), hurt: +hurtMult(got).toFixed(2) };
}

console.log('회피 타이밍 — 뼈대만 (게임을 안 부른다)');
console.log(`   탄이 나는 시간 ${FLY}초 · 빗나가려면 ${NEED} · 급기동 배수 ${BM}`);
console.log(`   창 ${EVADE.window[0]}~${EVADE.window[1]}초 남았을 때`
  + ` · 완벽 ${EVADE.perfect[0]}~${EVADE.perfect[1]}초`);

console.log('\n[1] ★★★ **Q/E 만으로 피해지나** (사장님이 시키신 것)');
{
  const late = shot(EVADE.window[1], { roll: 1 });            // 창이 열리자마자
  const any = shot(FLY, { roll: 1 });                          // 쏘자마자 계속 굴린다
  console.log(`   창에 맞춰 굴린다   — 쌓임 ${late.got} · ${late.miss ? '**빗나갔다**' : '맞았다'}`);
  console.log(`   쏘자마자 계속 굴린다 — 쌓임 ${any.got} · ${any.miss ? '빗나갔다' : '맞았다'}`);
  ok(late.miss,
    '★★★ **Q/E 만으로 빗나간다** — 창에 맞춰 굴리면. 사장님 「q e를 써서'
    + ' 회피기동을 하면 높은 확률로 공격을 회피」');
  ok(!any.miss || any.got <= late.got,
    '★★★ **쏘자마자 계속 굴리는 것이 더 낫지는 않다** — 그러면 Q 를 붙들고'
    + ' 있는 것이 답이 되고, 타이밍이 통째로 없어진다');
}

console.log('\n[2] ★★ **언제 꺾느냐로 갈리나** — 갈리지 않으면 타이밍이 아니다');
{
  const rows = [];
  for (const at of [0.9, 0.7, 0.55, 0.44, 0.35, 0.26, 0.18, 0.10, 0.05]) {
    const r = shot(at, { roll: 1, push: 0.6 });
    rows.push({ at, ...r });
    const w = isPerfect(at) ? '★★완벽' : inWindow(at) ? '★창' : (at > EVADE.window[1] ? '이르다' : '늦다');
    console.log(`   ${at.toFixed(2)}초 남았을 때 꺾는다 ${w.padEnd(6)}`
      + ` 쌓임 ${String(r.got).padStart(5)} ${r.miss ? '**빗나감**' : `맞음 (피해 ×${r.hurt})`}`);
  }
  const early = rows.find((r) => r.at === 0.9);
  const good = rows.find((r) => r.at === 0.44);
  const best = rows.reduce((a, b) => (b.got > a.got ? b : a));
  ok(good.got > early.got * 1.5,
    `★★★ **일찍 꺾으면 헛일이다** (0.9초 ${early.got} → 0.44초 ${good.got}) —`
    + ' 실기와 같다: 미사일이 붙었을 때 꺾어야 피해진다');
  // ★ **꺾는 데 0.3초가 걸리므로** 창이 열리기 조금 전에 시작하는 것이
  //   제일 좋을 수 있다 — 그건 틀린 게 아니라 「준비 동작」이다.
  //   물어야 할 것은 「제일 좋은 꺾음이 완벽 창을 **덮나**」다
  const covers = (r) => r.at >= EVADE.perfect[0] && (r.at - 0.30) <= EVADE.perfect[1];
  ok(covers(best),
    `★★★ **제일 많이 쌓이는 꺾음이 완벽 창을 덮는다** (${best.at}초에 시작) —`
    + ' 표가 말하는 자리와 실제로 제일 좋은 자리가 갈라지면 그건 거짓말이다');
  ok(rows.filter((r) => r.miss).length >= 3 && rows.filter((r) => !r.miss).length >= 2,
    '★★ 되는 자리와 안 되는 자리가 **둘 다 있다** — 다 되면 타이밍이 없고'
    + ' 다 안 되면 조작이 아니다');
}

console.log('\n[3] ★★ **창이 사람 반응 시간보다 넓은가**');
{
  const w = EVADE.window[1] - EVADE.window[0];
  const p = EVADE.perfect[1] - EVADE.perfect[0];
  console.log(`   창 ${(w * 1000).toFixed(0)}ms · 완벽 ${(p * 1000).toFixed(0)}ms`
    + ' · 사람 반응 시간 200~250ms');
  ok(w >= 0.40,
    `★★★ 창이 **${(w * 1000).toFixed(0)}ms** — 반응 시간의 ${(w / 0.22).toFixed(1)}배다.`
    + ' 좁으면 「보고 누르는」 것이 불가능해지고, 그러면 타이밍이 아니라 운이다');
  ok(p < 0.22,
    `★★ 완벽은 **${(p * 1000).toFixed(0)}ms** — 반응 시간보다 좁다.`
    + ' 「보고」는 못 맞추고 **익혀서** 맞춘다. 그래서 보상이 크다');
  ok(EVADE.ringFrom >= EVADE.window[1],
    '★ 고리가 **창보다 먼저** 뜬다 — 뜨자마자 눌러야 하면 준비할 틈이 없다');
}

console.log('\n[4] ★★ **못 피해도 덜 맞나** (사장님 「피해를 줄일 수」)');
{
  for (const got of [0, 0.25, 0.5, 0.75, 1.0]) {
    console.log(`   쌓임 ${got.toFixed(2)} → 피해 ×${hurtMult(got).toFixed(2)}`
      + `${missed(got) ? '  (아예 빗나감)' : ''}`);
  }
  ok(hurtMult(0) === 1, '★ 아무것도 안 하면 그대로 맞는다');
  ok(hurtMult(0.5) < 0.85 && hurtMult(0.5) > 0.5,
    `★★★ **반쯤 피하면 피해가 ${((1 - hurtMult(0.5)) * 100).toFixed(0)}% 준다** —`
    + ' 되거나 안 되거나 둘뿐이면 「거의 피했다」가 없어진다');
  ok(hurtMult(1) < hurtMult(0.5), '★ 많이 쌓을수록 덜 맞는다');
}

console.log('\n[5] ★ **급기동 없이도 되나** — 되면 추진제 저울이 죽나');
{
  const noB = shot(EVADE.perfect[1], { roll: 1, push: 0.5, burst: false });
  const yesB = shot(EVADE.perfect[1], { roll: 1, push: 0.5, burst: true });
  const pushOnly = shot(FLY, { push: 1, burst: false, hold: FLY });   // 끝까지 붙들고 있어도
  console.log(`   완벽 창 · 급기동 없이 ${noB.got} ${noB.miss ? '빗나감' : '맞음'}`
    + `  ·  급기동 ${yesB.got} ${yesB.miss ? '빗나감' : '맞음'}`);
  console.log(`   밀기만 · 끝까지 · 급기동 없이 ${pushOnly.got} ${pushOnly.miss ? '빗나감' : '맞음'}`);
  ok(noB.miss,
    '★★★ **타이밍을 맞추면 급기동 없이도 피한다** — 추진제를 안 태우고 피하는'
    + ' 길이 생겼다. 그것이 「기술」의 자리다');
  ok(!pushOnly.miss,
    `★★ **밀기만으로는 여전히 못 피한다** (${pushOnly.got} < ${NEED}) — v84 의 저울`
    + ' (「급기동을 써야 피해지고 급기동은 추진제를 태운다」)이 안 죽었다.'
    + ' 바뀐 것은 **그 값을 타이밍으로도 치를 수 있게 된 것**이다');
  ok(yesB.got > noB.got, '★ 급기동을 같이 쓰면 더 확실하다 — 안전을 돈으로 산다');
}

console.log('\n[6] ★ 화면이 **언제인지 말하나** (고리)');
{
  for (const left of [0.90, 0.70, 0.55, 0.35, 0.15, 0.05]) {
    const r = ringAt(left);
    console.log(`   ${left.toFixed(2)}초 남음 → 고리 ${(r.r * 100).toFixed(0)}%`
      + ` · ${r.band.padEnd(7)} 「${RING_WORD[r.band]}」`);
  }
  ok(ringAt(0.9).r > ringAt(0.1).r,
    '★★ **고리가 줄어든다** — 표적 표시에 닿는 순간이 「지금」이다.'
    + ' 숫자를 띄우면 안 읽히고, 줄어드는 고리는 눈이 잘 읽는다');
  ok(new Set(['wait', 'now', 'perfect', 'late'].map((k) => RING_WORD[k])).size === 4,
    '★ 네 상태가 다 다른 말을 한다');
  ok(ringAt(0.35).band === 'perfect' && ringAt(0.8).band === 'wait',
    '★★ 고리가 **창과 같은 것을 본다** — 화면과 규칙이 갈라지면 화면이 거짓말을 한다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
console.log(`
  ※ **「피하는 맛이 나나」는 여기서 안 나온다.** 여기서 나오는 것은
     「Q/E 로 되나 · 언제 꺾느냐로 갈리나 · 창이 넓은가 · 덜 맞나」뿐이다.
     고리가 화면에 정말 뜨나는 space-endtoend.js 가 본다.`);
process.exit(bad ? 1 : 0);
