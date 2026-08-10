// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **등대** — 배가 말을 한다, 그러나 몰지는 않는다 (v84 · docs/space/AI.md)
//
//    node tools/space-ai.js
//
//  ★ 사장님 「**우주선 내에 ai를 도입**해서 … 튜토리얼, 도움말, 조언,
//    경고 … **하지만 최종 결정은 플레이어가**」
//
//  ★★ 여기서 묻는 것은 「똑똑한가」가 아니다. 잴 수 있는 것만 묻는다:
//
//      ① **넷이 정말 하나로 모였나** — `banner =` 직접 대입이 남았나
//      ② 한 번에 하나만 말하나 · **급한 것이 이기나**
//      ③ 같은 말을 잇달아 반복 안 하나
//      ④ 말하는 총 시간이 **천장 안**인가
//      ⑤ **조용한 때**가 있나
//      ⑥ 「어디가 잘못됐나」를 **안 말하나**
//      ⑦ **배를 안 모나** — 조종·발사·회수를 못 부르나
//
//  ★★★ ①과 ⑦이 이 판의 핵심이다. 통합했다고 문서에만 적고 배너를 몇 곳
//    남겨 두면 **그 몇 곳이 규칙을 안 지킨다.** 그리고 AI 가 손잡이를
//    부르기 시작하면 그 순간 「최종 결정은 플레이어가」가 없어진다.
//
//  ★ 브라우저를 안 쓴다.
// ══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import {
  VOICE, RANKS, MUTE, SHARE_MAX, QUIET_RUN, LINES, ROOMS, FAULT_WORDS,
  tellsWhere, sideWord, NEVER_CALLS,
} from '../web/space/js/game/ai-table.js';
import { makeAI, say, hush, stepAI, nowSaying, summary } from '../web/space/js/game/ai.js';
import { LESSONS } from '../web/space/js/game/tutor-table.js';
import { JOBS } from '../web/space/js/game/wrist-table.js';
import { LEG } from '../web/space/js/game/route-table.js';

const ROOT = new URL('..', import.meta.url).pathname;
const main = readFileSync(`${ROOT}web/space/js/main.js`, 'utf8');
const aiSrc = readFileSync(`${ROOT}web/space/js/game/ai.js`, 'utf8');
const aiTab = readFileSync(`${ROOT}web/space/js/game/ai-table.js`, 'utf8');

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const head = (t) => console.log(`\n${t}`);
const DT = 1 / 30;
const run = (a, sec) => { for (let t = 0; t < sec; t += DT) stepAI(a, DT); };

console.log(`\n등대 — 배가 말을 한다, 그러나 몰지는 않는다`);
console.log(`   이름 ${VOICE.name} · 급한 정도 ${Object.keys(RANKS).length} · 같은 말 ${MUTE}초 침묵`
  + ` · 말하는 몫 천장 ${(SHARE_MAX * 100).toFixed(0)}%`);

// ══ ① 넷이 하나로 모였나 ═════════════════════════════════════════════
head('[1] ★★★ **넷이 정말 하나로 모였나** — 남은 구멍이 없나');
{
  // ★ 주석 줄은 빼고 센다 — 이 판을 왜 했는지 적어 둔 줄에 `banner =` 라는
  //   글자가 들어 있고, 그것까지 세면 **설명을 지워야 초록이 되는** 검사가 된다
  const left = main.split('\n')
    .filter((l) => !/^\s*(\*|\/\/)/.test(l))
    .filter((l) => /\bbanner = /.test(l)).length;
  const says = (main.match(/say\(ai,/g) ?? []).length;
  console.log(`      say(ai, …) ${says}곳 · 남은 banner= ${left}곳`);
  ok(left === 0,
    '★★★ `banner =` 직접 대입이 **하나도 안 남았다** — 남은 곳은 규칙을 안 지킨다');
  ok(says >= 100, `말하는 구멍이 하나로 모였다 (${says}곳이 같은 문을 쓴다)`);
  // 넷은 그대로 있다 — **없앤 것이 아니라 모은 것**이다
  ok(LESSONS.length === 7, `가르침은 그대로 일곱 — 목소리가 생겼을 뿐 줄이 안 늘었다`);
  ok(JOBS.length >= 10, `손목의 할 일 ${JOBS.length}줄도 그대로`);
  ok(main.includes('help-fight'), 'F1 도움말도 그대로 — 등대는 **가리키기만** 한다');
}

// ══ ② 한 번에 하나 · 급한 것이 이긴다 ════════════════════════════════
head('[2] ★★ **급한 것이 덜 급한 것을 밀어낸다**');
{
  const a = makeAI();
  say(a, '추력 — 켬', 'tell');
  run(a, 1.0);
  ok(nowSaying(a).line === '추력 — 켬', '하나가 떠 있다');
  const r = say(a, '진공 — 나가서 우주복을 입습니다', 'alarm');
  ok(r.ok && nowSaying(a).line.includes('진공'), '★★ 경보가 알림을 **밀어낸다**');
  const back = say(a, '광석을 실었습니다', 'tell');
  ok(!back.ok && back.why === 'rank', '★★ 그 반대는 안 된다 — 알림이 경보를 못 밀어낸다');
  run(a, 0.2);
  const same = say(a, '다른 알림', 'tell');
  ok(!same.ok, '경보가 떠 있는 동안 덜 급한 것은 기다린다');
}
{
  // 같은 급이면 새것이 이기되, 앞엣것이 읽힐 시간은 준다
  const a = makeAI();
  say(a, '첫 줄', 'tell');
  const fast = say(a, '둘째 줄', 'tell');
  ok(!fast.ok && fast.why === 'hold',
    `★ ${VOICE.minShow}초는 안 밀린다 — 안 그러면 **읽히기도 전에** 지워진다`);
  run(a, VOICE.minShow + 0.1);
  ok(say(a, '둘째 줄', 'tell').ok, '읽을 시간이 지나면 새것이 이긴다');
}

// ══ ③ 반복 ═══════════════════════════════════════════════════════════
head('[3] **같은 말을 잇달아 안 한다** — 반복은 소음이고 소음은 안 읽힌다');
{
  const a = makeAI();
  say(a, '적 우주선 격추 — 잔해가 남았습니다 · 지원 28초', 'tell');
  run(a, 3);
  const again = say(a, '적 우주선 격추 — 잔해가 남았습니다 · 지원 31초', 'tell');
  ok(!again.ok && again.why === 'same',
    '★★ **숫자만 다른 것은 같은 말이다** — 안 지우면 반복 억제가 통째로 헛돈다');
  run(a, MUTE + 1);
  ok(say(a, '적 우주선 격추 — 잔해가 남았습니다 · 지원 24초', 'tell').ok,
    `${MUTE}초가 지나면 다시 말한다`);
}

// ══ ④ 말하는 몫 · ⑤ 조용한 때 ════════════════════════════════════════
head('[4] ★★★ **말하는 총 시간에 천장이 있다** — 없으면 어느 날 화면이 말로 덮인다');
{
  // 있는 힘껏 떠들게 해 본다 — 구간 하나(490초)
  const a = makeAI();
  let i = 0;
  for (let t = 0; t < LEG.seconds; t += DT) {
    // 0.5초마다 새 말을 던진다 (실제보다 훨씬 수다스럽게)
    if (Math.floor(t * 2) !== i) { i = Math.floor(t * 2); say(a, `무슨 일 ${i}`, 'tell'); }
    stepAI(a, DT);
  }
  const s = summary(a);
  console.log(`      구간 하나(${LEG.seconds}초) 내내 떠들게 했다 — 말한 몫 ${(s.share * 100).toFixed(0)}%`
    + ` · ${s.count}마디 · 막힌 것 ${s.held}마디`);
  ok(s.held > 0, '★ 규칙이 **실제로 막는다** — 여태 이런 규칙이 하나도 없었다');
}
{
  // 실제 빈도로 — 회차에 300마디쯤 (배너 112곳 + 경고)
  const a = makeAI();
  const RUN = LEG.count * LEG.seconds;
  let next = 0, n = 0;
  for (let t = 0; t < RUN; t += DT) {
    if (t >= next) { say(a, `일 ${n++}`, n % 9 === 0 ? 'alarm' : 'tell'); next = t + 18; }
    stepAI(a, DT);
  }
  const s = summary(a);
  console.log(`      회차 ${(RUN / 60).toFixed(0)}분 · ${n}마디 — 말한 몫 **${(s.share * 100).toFixed(1)}%**`
    + ` · 제일 긴 침묵 ${s.quietBest.toFixed(0)}초`);
  ok(s.share <= SHARE_MAX,
    `★★★ 말하는 몫이 ${(s.share * 100).toFixed(1)}% — 천장 ${(SHARE_MAX * 100).toFixed(0)}% 안 (GENRE 안전핀과 같은 자리)`);
  ok(s.quietBest >= QUIET_RUN,
    `★★ **${s.quietBest.toFixed(0)}초 동안 아무 말도 안 하는 때**가 있다 (${QUIET_RUN}초 이상)`);
}

// ══ ⑥ 「어디가 잘못됐나」를 안 말한다 ════════════════════════════════
head('[6] ★★★ **어디가 고장인지 안 말한다** — 이 게임의 진단이 거기 걸려 있다');
{
  ok(tellsWhere('기관실 냉각 밸브가 잠겼습니다'),
    '★ 방 이름 + 고장 = **하면 안 되는 말**로 잡힌다');
  ok(!tellsWhere('조종석에 앉아야 광학 창을 엽니다'),
    '★★ 「조종석에 앉으십시오」는 괜찮다 — 그건 진단이 아니라 **내가 하려는 일**이다');
  ok(!tellsWhere('덜그럭거리는 것이 있습니다'), '「무엇이 났나」까지는 말한다');

  // 표에 든 문구 전부
  const lines = [
    LINES.aiming('우현'), LINES.evade('좌현으로'), LINES.evaded,
    LINES.odds('열세'), LINES.help,
  ];
  const slip = lines.filter(tellsWhere);
  ok(slip.length === 0, `등대의 문구 ${lines.length}줄에 **어디인지가 없다**`);

  // 게임이 실제로 던지는 말들 — 소스에서 뽑아 본다
  const said = [...main.matchAll(/say\(ai, '([^']{2,60})'/g)].map((m) => m[1]);
  const slips = said.filter(tellsWhere);
  console.log(`      게임이 던지는 고정 문구 ${said.length}줄을 훑었다`);
  ok(slips.length === 0,
    slips.length ? `✘ 「어디가 잘못됐나」를 말하는 줄: ${slips.join(' / ')}` : '★★★ 하나도 없다');

  // 규칙 자체가 세고 있나
  const a = makeAI();
  say(a, '기관실이 고장났습니다', 'warn');
  ok(summary(a).slips === 1, '★ 규칙이 **세고 있다** — 막지 않고 센다 (막으면 화면이 조용해져 더 못 찾는다)');
}

// ══ ⑦ 배를 안 몬다 ═══════════════════════════════════════════════════
head('[7] ★★★ **등대는 길을 비출 뿐 배를 몰지 않는다** — 이름이 곧 설계다');
{
  const calls = NEVER_CALLS.filter((f) => aiSrc.includes(`${f}(`) || aiTab.includes(`${f}(`));
  console.log(`      금지 목록 ${NEVER_CALLS.length}개: ${NEVER_CALLS.join(' · ')}`);
  ok(calls.length === 0,
    calls.length ? `✘ 등대가 부른다: ${calls.join(' / ')}` : '★★★ 조종·발사·회수를 **하나도 안 부른다**');
  // ★ `includes('three')` 였다 — **주석의 「three.js 를 안 쓴다」에 걸려**
  //   늘 빨갰다. 「안 쓴다」고 적어 둔 글자 때문에 안 쓴다는 검사가 실패하는,
  //   검사가 검사를 못 하는 모양이다. **가져오는 줄**을 본다
  ok(!/from ['"]three/.test(aiSrc), 'three.js 를 안 쓴다 — 이 검사가 브라우저 없이 읽는다');
  // 회피는 **말만** 한다
  ok(main.includes("say(ai, AI_LINES.evade("),
    '★★ 회피는 「좌현으로 빼십시오」라고 **말만** 한다');
  ok(!main.includes('autoEvade') && !main.includes('autoAim'),
    '★★★ **자동 회피도 자동 조준도 없다** — 조종간은 손이 잡는다');
}

// ══ ⑧ 이름 ═══════════════════════════════════════════════════════════
head('[8] ★ 화면에 **이름이 보이나** — 규칙이 있는데 안 보이면 없는 것과 같다');
{
  const css = readFileSync(`${ROOT}web/space/css/style.css`, 'utf8');
  ok(css.includes(`content: '${VOICE.name}'`), `배너에 「${VOICE.name}」 이름표가 붙는다`);
  ok(css.includes('data-rank="alarm"'),
    '★ 급한 정도에 따라 **색이 바뀐다** — 여태 「진공」과 「추력 켬」이 똑같이 생겼었다');
  ok(main.includes('hud.dataset.rank'), '화면이 급한 정도를 받아 쓴다');
}

console.log(bad ? `\n✘ ${bad} 개가 안 맞습니다` : '\n✔ 전부 맞습니다');
console.log(`
  ※ **「등대가 똑똑한가」는 여기서 안 나온다.** 여기서 나오는 것은
     「하나로 모였나 · 급한 것이 이기나 · 반복 안 하나 · 조용한 때가
     있나 · 선을 안 넘나」뿐이다. 말이 도움이 되는지는 2시간 돌려 봐야 안다.`);
process.exit(bad ? 1 : 0);
