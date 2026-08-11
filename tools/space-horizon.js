// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **수평의** — 뼈대만 (v103)
//
//    node tools/space-horizon.js
//
//  ★ 사장님 「q e로 뒤집으면 반대가 되는 것 같은데?? 그렇다면 **내가 지금
//    똑바로 유지하고 있는지를 표시**해줘야 하나?」
//
//  ★★★ 묻는 것 넷
//      ① **정말 반대가 되나** — 뒤집으면 조종이 뒤집히는 것이 맞나
//      ② 부호를 뒤집어 고치면 **어떻게 되나** (똑바를 때가 망가진다)
//      ③ 계기가 **뒤집힘을 말하나**
//      ④ 「수평」과 「기움」이 갈리나
// ══════════════════════════════════════════════════════════════════════════
import {
  HORIZON, wrapDeg, isOver, isLevel, rollWord, pitchWay,
  ASSIST, levelStep, assistWord,
} from '../web/space/js/game/horizon-table.js';
import { AXES, OFF_WEIGHT } from '../web/space/js/game/flight-table.js';

const DEG = 180 / Math.PI;

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

console.log('수평의 — 뼈대만 (게임을 안 부른다)');

console.log('\n[1] ★★★ **정말 반대가 되나** — 조종은 동체 기준, 눈은 세상 기준');
{
  console.log('   기울기      계기가 하는 말                    위로 밀면');
  for (const r of [0, 30, 89, 91, 180, -180, -120, -8]) {
    console.log(`   ${String(r).padStart(5)}도   ${rollWord(r).padEnd(28)}`
      + `  세상에서 **${pitchWay(r) > 0 ? '위' : '아래'}**`);
  }
  ok(pitchWay(0) === 1, '★ 똑바르면 위로 민 것이 **위**다');
  ok(pitchWay(180) === -1,
    '★★★ 뒤집으면 위로 민 것이 **아래**다 — 사장님이 겪으신 「반대」가 이것이고,'
    + ' **버그가 아니라 물리다** (조종은 동체 기준이다)');
  ok(pitchWay(89) === 1 && pitchWay(91) === -1,
    `★ 갈리는 자리는 ${HORIZON.overAt}도다 — 옆으로 누운 것까지는 안 뒤집힌 것으로 본다`);
}

console.log('\n[2] ★★ 부호를 뒤집어 고치면 — **똑바를 때가 망가진다**');
{
  // 「반대로 간다」를 부호로 고친다는 것은 pitchWay 를 늘 −1 로 두는 것이다
  const naive = () => -1;
  ok(naive() !== pitchWay(0),
    '★★★ 늘 뒤집으면 **똑바를 때**가 반대가 된다 — 고치는 자리가 아니다.'
    + ' 실기가 푼 방법은 부호가 아니라 **계기**다');
}

console.log('\n[3] ★★★ 계기가 **뒤집힘을 말하나**');
{
  ok(rollWord(180).includes('뒤집힘'), `★★ 180도 → 「${rollWord(180)}」`);
  ok(rollWord(180).includes('반대'),
    '★★★ **왜 이상한지까지** 말한다 — 「뒤집힘」만으로는 조종이 반대인 줄 모른다');
  ok(!rollWord(0).includes('뒤집힘'), `★ 0도 → 「${rollWord(0)}」`);
  ok(isOver(-179) && isOver(179), '★ 좌우 어느 쪽으로 뒤집어도 잡는다 (감아서 잰다)');
}

console.log('\n[4] ★ 「수평」과 「기움」이 갈리나');
{
  ok(isLevel(0) && isLevel(HORIZON.levelAt - 1), `★ ${HORIZON.levelAt}도 안이면 「수평」`);
  ok(!isLevel(HORIZON.levelAt + 1), '★ 그 밖은 기울었다고 한다');
  ok(rollWord(30).includes('우') && rollWord(-30).includes('좌'),
    `★★ 어느 쪽으로 기울었는지 말한다 — 「${rollWord(30)}」 · 「${rollWord(-30)}」`);
  ok(rollWord(-30).includes('30'), '★ 얼마나 기울었는지도 숫자로 (돌려놓을 양을 알아야 한다)');
}

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ 두 번째 물음 — 사장님 「**물리방향으로 움직이니 너무 어렵다**」
//      「hud 를 만들어야하나? 아니면 **수평 유지 단축키**를 만들어야하나?」
//
//  ★ 아래 넷이 **어느 쪽이 답인지**를 재는 자리다. 고르기 전에 잰다
// ══════════════════════════════════════════════════════════════════════════

console.log('\n[5] ★★★ **뒤집는 축이 정말 롤 하나뿐인가** — 여기가 갈림길이다');
{
  //  조종은 동체 기준이다. 피치·요를 아무리 돌려도 「조종간 위 → 기수 위」는
  //  안 바뀐다 — 바뀌는 것은 **어느 쪽이 세상의 위인가**뿐이고, 그것을
  //  정하는 것이 롤이다. 그래서 뒤집힘은 롤만 만든다.
  ok(pitchWay(0) === 1 && pitchWay(180) === -1,
    '★★★ 롤만이 조종을 뒤집는다 (위 [1] 에서 잰 그대로)');
  ok(OFF_WEIGHT.roll < OFF_WEIGHT.pitch && OFF_WEIGHT.roll < OFF_WEIGHT.yaw,
    `★★★ 그런데 **롤은 겨냥에 안 쓰인다** — 벌이 ${OFF_WEIGHT.roll} 로 셋 중 제일 가볍다`
    + ' (「롤은 궤도를 안 바꾼다」 · flight-table.js). 즉 **저절로 되돌려도 잃는 것이 없다**');
  ok(OFF_WEIGHT.pitch === 1 && OFF_WEIGHT.yaw === 1,
    '★★ 피치·요는 반대다 — 저절로 되돌리면 **겨냥을 뺏는 것**이라 절대 안 된다.'
    + ' 보조는 **롤에만** 건다');
}

console.log('\n[6] ★★★ 보조를 켜면 **뒤집힌 채로 머무를 수 있나**');
{
  /** 롤을 r 라디안에 놓고 손을 뗀 뒤, 뒤집힘(>90도)으로 남아 있는 시간 */
  const stuck = (r0, on) => {
    let r = r0, t = 0, over = 0;
    const dt = 1 / 60;
    while (t < 30) {
      r += levelStep(r, dt, { hand: false, on });
      t += dt;
      if (isOver(r * DEG)) over += dt;
    }
    return { over: +over.toFixed(2), end: +wrapDeg(r * DEG).toFixed(1) };
  };
  const off = stuck(Math.PI, false);
  const on = stuck(Math.PI, true);
  console.log(`   보조 끔  → 30초 뒤 ${off.end}도 · 뒤집힌 채 **${off.over}초**`);
  console.log(`   보조 켬  → 30초 뒤 ${on.end}도 · 뒤집힌 채 **${on.over}초**`);
  ok(off.over > 29,
    '★★★ **끄면 영영 뒤집혀 있다** — 이것이 지금 게임이고, 사장님이 겪으신 그것이다');
  ok(on.over < 2.2 && Math.abs(on.end) < 1,
    `★★★ **켜면 ${on.over}초 만에 빠져나오고 수평으로 선다** — 「반대」가 아예 안 생긴다`);
  ok(ASSIST.on === true,
    '★★★ 그래서 **기본이 켜짐**이다. 어렵다는 말을 들었으면 고칠 것은 기본값이다');
}

console.log('\n[7] ★★ 보조가 **조종을 없애지는 않나** — 늘 이게 답이면 조작이 아니다');
{
  const dt = 1 / 60;
  // 손으로 감는다 (Q/E 를 잡고 있다)
  let byHand = 0; { let r = Math.PI; while (Math.abs(r) > 0.02 && byHand < 30) { r -= Math.min(Math.abs(r), AXES.roll.rate * dt) * Math.sign(r); byHand += dt; } }
  // ★ 급기동(Shift)으로 감는다 — 추진제를 태우는 대신 훨씬 빠르다
  const BURST = 2.4;
  let byBurst = 0; { let r = Math.PI; while (Math.abs(r) > 0.02 && byBurst < 30) { r -= Math.min(Math.abs(r), AXES.roll.rate * BURST * dt) * Math.sign(r); byBurst += dt; } }
  // 놓고 보조에 맡긴다
  let byAid = 0; { let r = Math.PI; while (Math.abs(wrapDeg(r * DEG)) > 1 && byAid < 30) { r += levelStep(r, dt); byAid += dt; } }
  console.log(`   180도 되돌리기 — 손 **${byHand.toFixed(2)}초** · 급기동 **${byBurst.toFixed(2)}초**`
    + ` · 보조 **${byAid.toFixed(2)}초**`);
  // ══ ★★★ v111 — **여기서 주장이 뒤집혔다** ═══════════════════════════
  //
  //  v103 은 「손이 보조보다 빨라야 한다」였다 — 보조가 손을 이기면 조종이
  //  없어진다는 이유였고, 그때는 맞았다. 그런데 사장님이 실제로 돌려
  //  보시고 「**뒤집혀서 방향이 반대가 되는데 자동으로 돌아오게 해야지**」
  //  라고 하셨고, 이어서 「**회전을 계속 하다보니 안되네**」라고 원인까지
  //  짚으셨다. 보조(0.85)가 손(1.25)보다 느리니 **싸우면서 계속 굴리면
  //  영영 못 따라잡는** 것이었다.
  //
  //  ★★ 그래서 뒤집는다: **보조가 손보다 빠르다.** 대신 「조종이 없어진다」를
  //    막는 것은 **속도가 아니라 다른 둘**이다 —
  //      ① 손이 Q/E 를 잡고 있으면 보조는 **아예 안 돈다** (`hand`)
  //      ② 급기동(Shift)을 쓰면 **여전히 손이 제일 빠르다** — 대신 태운다
  ok(byAid < byHand,
    `★★★ **보조가 손보다 빠르다** (${byAid.toFixed(2)} < ${byHand.toFixed(2)}) —`
    + ' 사장님 「자동으로 돌아오게 해야지」. v103 은 반대로 정했었고,'
    + ' 그 값이 「계속 굴리면 안 돌아온다」를 만들었다');
  ok(byBurst < byAid,
    `★★★ **그래도 급기동이 제일 빠르다** (${byBurst.toFixed(2)} < ${byAid.toFixed(2)}) —`
    + ' 급하면 잡고 감는 것이 답이다. 조종이 없어지지 않는 자리가 여기다');
  // ★ 그리고 손이 밀고 있으면 보조는 **아예 안 돈다** — 그것이 진짜 안전장치
  ok(levelStep(Math.PI, dt, { hand: true }) === 0,
    '★★★ **손이 잡고 있으면 보조가 한 걸음도 안 움직인다** — 배를 굴릴 수 없으면'
    + ' 그건 보조가 아니라 금지다. 속도가 아니라 이 한 줄이 조종을 지킨다');
  // ★★ 잔 기울기는 느긋해야 한다 — 옆으로 눕혀 겨누는 것이 안 되면 안 된다
  const slow = Math.abs(levelStep(5 / DEG, dt)) * DEG / dt;
  const fast = Math.abs(levelStep(Math.PI, dt)) * DEG / dt;
  console.log(`   펴는 속도 — 5도에서 ${slow.toFixed(0)}°/초 · 180도에서 ${fast.toFixed(0)}°/초`);
  ok(fast > slow * 2,
    `★★ **기운 만큼 빨라진다** (${(fast / slow).toFixed(1)}배) — 잔 기울기는 느긋해서`
    + ' 옆으로 눕혀 겨눌 수 있고, 뒤집힌 것은 빨리 선다');
}

console.log('\n[8] ★ 그래서 **단축키를 만들 것인가** — 답: 안 만든다');
{
  //  「수평 유지 단축키」는 사람이 **뒤집힌 줄 알아야** 누른다. 그런데
  //  사장님이 겪으신 것은 「반대로 간다」였지 「뒤집혔다」가 아니었다 —
  //  즉 **누를 생각 자체를 못 하는 상태**다. 키는 그 상태를 안 푼다.
  const dt = 1 / 60;
  ok(levelStep(Math.PI, dt) !== 0,
    '★★★ 보조는 **안 눌러도 돈다** — 뒤집힌 줄 몰라도 빠져나온다. 키는 그걸 못 한다');
  ok(rollWord(120).includes('뒤집힘'),
    '★★ 계기는 남긴다 — 보조를 껐을 때와 **되돌아가는 중**을 읽어야 하므로'
    + ` (「${rollWord(120)}」)`);
  ok(!rollWord(0).includes('뒤집힘') && isLevel(0),
    '★ 다 돌아오면 조용해진다 — 늘 떠 있는 경고는 경고가 아니다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
