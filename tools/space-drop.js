// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **투하** — 「떨군다」가 성립하나 (v93 · docs/space/WAR.md §6)
//
//    node tools/space-drop.js
//
//  ★ 사장님 「적을 뚫고 **적 본진 행성에 핵폭탄을 투하**해서 폭발시키는 것」
//
//  ★★ 목적 한 줄이 **뚫는다 · 채운다 · 떨군다**인데 세 번째가 통째로
//    없었다. 2시간을 쓰고도 **끝이 없었다** — 마지막 구간이 아직
//    옛 목적의 잔재(성간 공백 = 도망)였기 때문이다.
//
//  ★★★ 묻는 것 일곱:
//      ① **마디 넷이 다 지나가나** (진입 → 창 → 낙하 → 폭발)
//      ② **다 합쳐 5분 안인가** — WAR.md 「2시간의 마지막 5분이 투하」
//      ③ **무장 안 하면 못 떨구나** · 창이 닫히면 **지나치나**
//      ④ **결말 셋이 다 나오나** (5/5 · 3~4 · 0~2)
//      ⑤ **이탈이 결심인가** — 밟으면 되고 안 밟으면 안 되나
//      ⑥ **못 벌려도 안 죽나** (벌은 죽음이 아니라 일이 는다)
//      ⑦ **창이 무장을 기다려 주지 않나** — 기다려 주면 결심이 아니다
//
//  ★ 브라우저를 안 쓴다.
// ══════════════════════════════════════════════════════════════════════════
import { PHASE, DROP, ESCAPE, hurtAt, SAY } from '../web/space/js/game/drop-table.js';
import {
  makeDrop, stepDrop, pull, canDrop, windowLeft, blastIn, foeMult, summary,
} from '../web/space/js/game/drop.js';
import { ENDINGS, endingOf } from '../web/space/js/game/warhead-table.js';
import { CRUISE } from '../web/space/js/game/systems-table.js';
import { BOOST } from '../web/space/js/game/boost-table.js';
import { LEG } from '../web/space/js/game/route-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const head = (t) => console.log(`\n${t}`);
const DT = 1 / 30;

/** 한 회차의 마지막을 통째로 돌린다 */
function run({ armWhen = 0, filled = 5, speed = CRUISE.speed, dropAt = 3 } = {}) {
  const d = makeDrop();
  const log = [];
  let armed = false, t = 0, dropped = false;
  for (let i = 0; i < 30 * 900; i++) {
    t += DT;
    if (armWhen && t >= armWhen) armed = true;
    const ev = stepDrop(d, DT, { at: true, armed, speed });
    if (ev) log.push([+t.toFixed(1), ev]);
    // 창이 열리고 `dropAt` 초 뒤에 떨군다
    if (!dropped && d.phase === PHASE.WINDOW && d.t >= dropAt) {
      if (pull(d, { armed, filled })) { dropped = true; log.push([+t.toFixed(1), 'pull']); }
    }
    if (d.phase === PHASE.OVER) break;
  }
  return { d, log, total: t, dropped };
}

console.log('\n투하 — 「떨군다」가 성립하나');
console.log(`   진입 ${DROP.run}초 · 창 ${DROP.window}초 · 낙하 ${DROP.fall}초 · 폭발 ${DROP.blast}초`);

// ══ ① 마디 넷 ════════════════════════════════════════════════════════
head('[1] ★★★ **마디 넷이 다 지나가나** — 진입 → 창 → 낙하 → 폭발');
{
  const { d, log, total } = run({ armWhen: 10 });
  for (const [at, ev] of log) console.log(`   ${String(at).padStart(6)}초  ${ev}`);
  const seen = log.map(([, e]) => e);
  ok(seen.includes('run'), '① 진입한다');
  ok(seen.includes('window'), '② 투하 창이 열린다');
  ok(seen.includes('pull'), '③ 떨군다');
  ok(seen.includes('blast'), '④ 터진다');
  ok(d.phase === PHASE.OVER, '끝난다 — **회차에 끝이 생겼다**');
  console.log(`   다 해서 ${total.toFixed(0)}초 (${(total / 60).toFixed(1)}분)`);
  ok(total <= 300,
    `② ★★ **5분 안**이다 — WAR.md 「2시간의 마지막 5분이 투하」`);
  ok(total >= 120, '너무 짧지도 않다 (2분 이상) — 마디 넷이 다 읽혀야 한다');
  ok(LEG.seconds >= total,
    `구간 하나(${LEG.seconds}초) 안에 들어간다 — 넘치면 구간이 끝나며 잘린다`);
}

// ══ ③ 무장 · 놓침 ════════════════════════════════════════════════════
head('[3] ★★★ **무장 안 하면 못 떨군다** · 창이 닫히면 지나친다');
{
  const d = makeDrop();
  stepDrop(d, DT, { at: true });
  ok(!canDrop(d, false), '진입 중에는 못 떨군다 (창이 아직 안 열렸다)');
  // 창까지 보낸다
  for (let i = 0; i < 30 * (DROP.run + 1); i++) stepDrop(d, DT, { at: true, armed: false });
  ok(d.phase === PHASE.WINDOW, '창이 열렸다');
  ok(!canDrop(d, false), '★★ 무장을 안 했으면 **창이 열려도 못 떨군다**');
  ok(!pull(d, { armed: false, filled: 2 }), '눌러도 안 먹는다');
  ok(canDrop(d, true), '★ 무장하면 그 자리에서 떨굴 수 있다');

  // 놓치면
  const e = makeDrop();
  for (let i = 0; i < 30 * (DROP.run + DROP.window + 2); i++) stepDrop(e, DT, { at: true, armed: false });
  ok(e.phase === PHASE.OVER && e.missed,
    `★★★ ${DROP.window}초를 흘리면 **지나친다** — 창은 무장을 기다려 주지 않는다`);
  ok(!canDrop(e, true), '지나친 뒤에는 무장해도 못 떨군다');
}

// ══ ④ 결말 셋 ════════════════════════════════════════════════════════
head('[4] ★★ **결말 셋이 다 나오나** — 다 못 모아도 간다 (WAR.md §6)');
{
  console.log('   찬 칸  결말');
  for (const n of [5, 4, 3, 2, 0]) {
    const e = endingOf(n);
    console.log(`   ${String(n).padStart(4)}   ${e.name} — ${e.what}`);
  }
  const keys = new Set([5, 4, 3, 2, 1, 0].map((n) => endingOf(n).key));
  ok(keys.size === 3, `셋이 다 나온다 (${[...keys].join(' · ')})`);
  ok(endingOf(5).key === 'full' && endingOf(4).key === 'dud' && endingOf(2).key === 'none',
    '★ 5/5 만 터진다 · 3~4 는 불발 · 0~2 는 못 떨굼');
  ok(ENDINGS.every((e) => e.what && e.name), '셋 다 **사람이 읽는 문장**이 있다 — 점수가 아니라 목록이다');
  // 못 떨군 결말은 **떨굴 수 없는 것**과 같은 말이라야 한다
  const two = run({ armWhen: 0, filled: 2 });
  ok(!two.dropped && two.d.missed,
    '★★ 0~2 칸이면 무장이 안 되므로 **떨구는 일 자체가 안 일어난다** — 표와 게임이 같은 말을 한다');
}

// ══ ⑤⑥ 이탈 ══════════════════════════════════════════════════════════
head('[5] ★★★ **이탈이 결심인가** — 밟으면 되고 안 밟으면 안 되나');
{
  const cruise = CRUISE.speed;
  const boost = CRUISE.speed * BOOST.mult;
  const dCruise = cruise * DROP.fall;
  const dBoost = boost * DROP.fall;
  console.log(`   순항 ${cruise} u/s → ${DROP.fall}초에 ${dCruise.toFixed(0)}m`);
  console.log(`   급가속 ${boost.toFixed(0)} u/s → ${dBoost.toFixed(0)}m · 벌려야 하는 것 ${ESCAPE.need}m`);
  ok(dCruise < ESCAPE.need,
    `★★ **가만히 가면 못 벌린다** (${dCruise.toFixed(0)} < ${ESCAPE.need})`);
  ok(dBoost > ESCAPE.need,
    `★★ **밟으면 벌린다** (${dBoost.toFixed(0)} > ${ESCAPE.need}) — 그래서 마지막 몇 초가 결심이다`);

  const fast = run({ armWhen: 10, speed: boost });
  const slow = run({ armWhen: 10, speed: cruise });
  console.log(`   밟았을 때 ${fast.d.away}m → 상함 ${(fast.d.hurt * 100).toFixed(0)}%`);
  console.log(`   안 밟았을 때 ${slow.d.away}m → 상함 ${(slow.d.hurt * 100).toFixed(0)}%`);
  ok(fast.d.hurt === 0, '★ 밟았으면 **멀쩡하다**');
  ok(slow.d.hurt > 0, '★ 안 밟았으면 **상한다**');
  ok(slow.d.hurt <= ESCAPE.max,
    `⑥ ★★★ 제일 못 벌려도 ${(ESCAPE.max * 100).toFixed(0)}% 까지만 상한다 — **안 죽인다.**`
    + ' 2시간을 쓰고 마지막 3초에 처음부터 다시면 그건 벌이 아니라 낭비다');
  ok(hurtAt(ESCAPE.need) === 0 && hurtAt(ESCAPE.hurt) === 1,
    '상하는 정도가 **거리에 따라 이어진다** — 층계면 「조금 모자란 것」이 안 읽힌다');
}

// ══ ⑦ 방공 ══════════════════════════════════════════════════════════
head('[6] ★ **진입이 제일 두꺼운가** — 「방공이 제일 두껍다」 (WAR.md §6)');
{
  const d = makeDrop();
  stepDrop(d, DT, { at: true });
  ok(foeMult(d) > 1, `진입 중 적이 ${foeMult(d)}배로 온다`);
  for (let i = 0; i < 30 * (DROP.run + 1); i++) stepDrop(d, DT, { at: true });
  ok(foeMult(d) > 1, '창이 열려도 아직 두껍다 — 떨구는 동안이 제일 무섭다');
  pull(d, { armed: true, filled: 5 });
  ok(foeMult(d) === 1,
    '★ 떨어뜨린 뒤에는 안 두껍다 — 그때 할 일은 **도망**이지 싸움이 아니다');
}

// ══ 말 ═══════════════════════════════════════════════════════════════
head('[7] ★ **말이 다 있나** — 화면에 안 나오면 없는 것과 같다');
{
  for (const k of ['run', 'armFirst', 'window', 'late', 'dropped', 'blast', 'close']) {
    ok(!!SAY[k], `${k} — 「${SAY[k] ?? '(없다)'}」`);
  }
}

console.log(bad ? `\n✘ ${bad} 개가 안 맞습니다` : '\n✔ 전부 맞습니다');
console.log(`
  ※ **「끝이 시원한가」는 여기서 안 나온다.** 여기서 나오는 것은
     「마디가 지나가나 · 5분 안인가 · 못 떨구는 길이 있나 · 이탈이
     결심인가」뿐이다. 떨어지는 것이 **창밖에 보이나**는 화면이 답한다.`);
process.exit(bad ? 1 : 0);
