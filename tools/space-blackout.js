// ══════════════════════════════════════════════════════════════════════════
//  E 정전 — **어둠이 벌인가** (7판 · story-table.js 「배가 낡아 간다」)
//
//    node tools/space-blackout.js
//
//  ★ 묻는 것 넷
//    ① **시계가 있나** — 오래 끌면 아픈가
//    ② **어둠이 벌인가** — 못 뛰는 것이 실제로 시간을 먹나
//    ③ **되살릴 수 있나** — 놓아도 안 되감기나
//    ④ **갇히지 않나** — 안 고쳐도 장면이 끝나나
//
//  ★★ 시계는 **새로 안 만들었다.** 이미 있었다:
//       추진+냉각  +3.70/초 → 100까지 18초
//       다 꺼짐    **+0.50/초 → 100까지 132초**   ← 정전이 이것이다
//     132초는 대응 박자(120~240초)와 거의 정확히 겹친다.
// ══════════════════════════════════════════════════════════════════════════
import { DARK, DSTEP } from '../web/space/js/game/blackout-table.js';
import {
  makeDark, killPower, stepDark, isDark, canReset, resetAt, settled, summary,
} from '../web/space/js/game/blackout.js';
import { heatRate } from '../web/space/js/game/chase.js';
import { HEATING } from '../web/space/js/game/chase-table.js';
import { HEAT } from '../web/space/js/game/systems-table.js';
import { BEAT, SCENES } from '../web/space/js/game/scene-table.js';
import { whyNotRun, WHY as WHY_RUN } from '../web/space/js/game/move-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DT = 1 / 30;

console.log('\nE 정전 — 어둠이 벌인가');

console.log('\n[1] ★★ **시계가 있나** — 오래 끌면 아픈가');
{
  // ★★ **v58 — 정전의 시계는 「다 꺼짐」이 아니라 「잔열」이다.**
  //   `HEATING.idle` 을 0.5 에서 0.06 으로 옳게 고치자 정전이 아프지
  //   않은 것이 됐고, 이 검사가 그 자리에서 빨개졌다. 진짜 답은 물리에
  //   있었다 — **냉각 펌프가 멎어서 반응로 잔열이 선체로 온다.**
  //   숫자는 예전과 같은 0.5/초인데 **이유가 생겼다**
  const rows = [
    ['추진+냉각', { thrust: true, cool: true }, 0],
    ['추진만', { thrust: true, cool: false }, 0],
    ['다 꺼짐(순항)', { thrust: false, cool: false }, 0],
    ['정전(잔열)', { thrust: false, cool: false }, HEATING.blackout],
  ];
  let outRate = 0;
  for (const [n, p, extra] of rows) {
    const r = heatRate(p, false) + extra;
    const to100 = r > 0 ? (HEAT.max - HEAT.start) / r : Infinity;
    if (n.startsWith('정전')) outRate = r;
    console.log(`   ${n.padEnd(14)} ${(r >= 0 ? '+' : '') + r.toFixed(2)}/초 → 100까지 ${
      Number.isFinite(to100) ? to100.toFixed(0) + '초' : '안 오른다'}`);
  }
  const to100 = (HEAT.max - HEAT.start) / outRate;
  ok(outRate > 0, '정전이어도 열은 **오른다** — 0 이면 시계가 없고, 시계가 없으면 서두를 이유가 없다');
  ok(to100 >= BEAT.act[0] * 0.8 && to100 <= BEAT.act[1] * 1.2,
    `100까지 ${to100.toFixed(0)}초 — 대응 박자(${BEAT.act[0]}~${BEAT.act[1]}초)와 겹친다. **새 숫자를 안 만들었다**`);
  ok(outRate < heatRate({ thrust: true, cool: false }, false) / 2,
    '그런데 추진도 꺼지므로 **급하지는 않다** — 급하면 어둠 속을 뛰게 되고, 뛸 수가 없다');
  ok(HEATING.blackout > HEATING.idle * 3,
    `★ 잔열(${HEATING.blackout})이 순항 열(${HEATING.idle})보다 훨씬 크다 — **펌프가 멎은 것**이 벌이다`);
}

console.log('\n[2] ★★ **어둠이 벌인가** — 못 뛰는 것이 실제로 시간을 먹나');
{
  ok(DARK.noRun === true, '어두우면 못 뛴다');
  const why = whyNotRun({ breath: 1, holding: null, bothHands: false, dark: true });
  ok(why === 'dark', `막는 까닭을 **말한다** — 「${WHY_RUN[why]}」`);
  ok(whyNotRun({ breath: 1, holding: null, bothHands: false, dark: false }) !== 'dark',
    '밝으면 안 막는다');
  // 방 사이 — space-run 이 잰 값 (걸어서 6~11초 · 뛰어서 4~7초)
  console.log('   방 사이 걸어서 6~11초 · 뛰어서 4~7초 (space-run 이 잰 값)');
  console.log('   조종석 ↔ 기관실 왕복이면 어둠 속에서 **20초가 넘는다**');
}

console.log('\n[3] ★ **어둡되 아무것도 못 하지는 않나**');
{
  console.log(`   등 ${DARK.lamp} · 바탕빛 ${DARK.ambient} · 비상등 ${DARK.emergency}`);
  ok(DARK.lamp > 0.05 && DARK.lamp < 0.3,
    `등이 ${DARK.lamp} (0.05~0.3) — **0 이 아니다.** 완전한 암흑은 무서운 게 아니라 「게임이 꺼졌나」다`);
  ok(DARK.ambient > DARK.lamp,
    `바탕빛(${DARK.ambient})을 등(${DARK.lamp})보다 남긴다 — 벽에 부딪히며 다니면 그건 조작 사고다`);
  ok(DARK.emergency > DARK.ambient,
    '★ 비상등이 제일 밝다 — **어디로 가야 하는지**는 말해 주되 무엇이 고장인지는 안 가르친다');
}

console.log('\n[4] ★★ **되살릴 수 있나** — 놓아도 안 되감기나');
{
  const d = makeDark();
  ok(killPower(d) && isDark(d), '① 전력이 나간다');
  ok(!killPower(d), '두 번 안 나간다');
  ok(canReset(d), '② 주 차단기가 손에 잡힌다 — **어두울 때만**');

  // 끊어 잡아 본다
  let t = 0;
  while (t < 40 && !settled(d)) {
    stepDark(d, DT, Math.floor(t) % 2 === 0);   // 1초 잡고 1초 놓고
    t += DT;
  }
  console.log(`   1초씩 끊어 잡으니 ${t.toFixed(1)}초 (내리 잡으면 ${DARK.reset}초)`);
  ok(settled(d), '③ 끊어 잡아도 **결국 올라간다** — 놓으면 처음부터는 짜증이지 벌이 아니다');
  ok(t > DARK.reset * 1.5 && t < DARK.reset * 4,
    `다만 두 배쯤 걸린다 (${t.toFixed(1)}초) — 붙들고 있는 편이 낫다`);

  const d2 = makeDark();
  killPower(d2);
  let u = 0;
  while (u < 40 && !settled(d2)) { stepDark(d2, DT, true); u += DT; }
  ok(Math.abs(u - DARK.reset) < 0.3, `내리 잡으면 ${u.toFixed(1)}초 (표는 ${DARK.reset})`);
  ok(!isDark(d2) && !canReset(d2), '④ 돌아오면 불이 켜지고 차단기는 다시 안 잡힌다');
  ok(d2.inDark > 0, `⑤ 어둠 속에 있던 시간을 센다 (${d2.inDark.toFixed(1)}초)`);
}

console.log('\n[5] ★ **갇히지 않나** — 안 고쳐도 장면이 끝나나');
{
  const d = makeDark();
  killPower(d);
  let t = 0;
  while (t < BEAT.act[1] && !settled(d)) { stepDark(d, DT, false); t += DT; }
  ok(isDark(d), '한 번도 안 잡으면 **저절로 안 켜진다** — 장면 시계가 끝낸다');
  // 게임은 `scenes.overdue` 로 닫는다 — 그 길이 있다는 것만 여기서 확인한다
  d.step = DSTEP.BACK;
  ok(settled(d) && !isDark(d), '장면이 끝나면 불이 돌아온다 — 영영 어두운 배는 멈춘 게임이다');
}

console.log('\n[6] 장면 표와 안 갈라졌나');
{
  console.log(`   E — 「${SCENES.E.lead}」 · 방 ${SCENES.E.room} · ${SCENES.E.hands}`);
  ok(SCENES.E.built === true, '장면 E 가 지어졌다');
  ok(SCENES.E.uses.includes('dark'), '표가 `dark` 를 쓴다고 적어 뒀다');
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「어둠이 무서운가」는 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「시계가 있나 · 못 뛰나 · 되살릴 수 있나 · 갇히지 않나」뿐이다.');
console.log('     정말 어두워 보이나는 화면으로 봐야 한다.');
process.exit(fail ? 1 : 0);
