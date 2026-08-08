// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **탄두** — 목적이 게임 안에 있나 (v71 · docs/space/WAR.md §3·§4·§6)
//
//    node tools/space-head.js
//
//  ★ 사장님: 「핵탄두 재료를 모아서 적 행성에 투하하는게 목적이야」
//
//  ★★ 여기서 묻는 것 여섯:
//      ① 재료 다섯이 **다른 동사**를 파나 — 같으면 심부름이 다섯 번이다
//      ② 12구간에 **번갈아** 놓였나 (미션 → 돌파 → 미션)
//      ③ ★★★ **추진을 켜면 탄두가 데워지나** — 기관실에 둔 값
//      ④ 한계에 닿으면 **일이 늘고** 안 죽나
//      ⑤ 다섯이 다 차야 무장이 열리나
//      ⑥ **못 모아도 갈 수 있나** — 결말 셋
//
//  ★ 브라우저를 안 쓴다.
// ══════════════════════════════════════════════════════════════════════════
import {
  PARTS5, CRADLE, BAKE, ENDINGS, endingOf, partAtLeg,
} from '../web/space/js/game/warhead-table.js';
import {
  makeWarhead, pickUp, holdCradle, stepWarhead, holdArm, drop, full, summary,
} from '../web/space/js/game/warhead.js';
import { LEG } from '../web/space/js/game/route-table.js';
import { HEAT } from '../web/space/js/game/systems-table.js';
// ★★ **표에서 읽는다.** `world/ship.js` 는 three 를 쓰므로 도구가 못 읽는다 —
//   v71 에 방 좌표를 `game/rooms-table.js` 로 옮긴 이유가 이것이다
import { ROOMS, AFT } from '../web/space/js/game/rooms-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DT = 1 / 30;

console.log('\n탄두 — 목적이 게임 안에 있나');
console.log(`   재료 ${PARTS5.length} · 구간 ${LEG.count} · 크레이들 기관실 후미 z ${CRADLE.at.z}`);

console.log('\n[1] ★★★ **다섯이 다른 동사를 파나** — 같으면 심부름이 다섯 번이다');
{
  for (const p of PARTS5) {
    console.log(`   ${String(p.leg).padStart(2)}구간  ${p.name.padEnd(9)} ${p.verb.padEnd(7)} ${p.from}`);
  }
  const verbs = PARTS5.map((p) => p.verb);
  ok(new Set(verbs).size === PARTS5.length,
    `동사가 다섯 다 다르다 (${verbs.join(' · ')}) — 다 「가서 줍는다」면 재료가 다섯인 게 아니라 **같은 심부름이 다섯 번**이다`);
  const froms = PARTS5.map((p) => p.from);
  ok(new Set(froms).size === PARTS5.length, '나오는 데도 다섯 다 다르다');
  ok(PARTS5.some((p) => p.verb === 'buy') && PARTS5.some((p) => p.verb === 'mine'),
    '★ 사장님이 콕 집으신 **「사거나 채굴」이 둘 다** 있다');
}

console.log('\n[2] ★★ **번갈아 놓였나** — 미션 → 돌파 → 미션');
{
  const legs = PARTS5.map((p) => p.leg).sort((a, b) => a - b);
  console.log(`   재료 구간 ${legs.join(' · ')} / 전체 ${LEG.count}`);
  ok(legs.every((l, i) => i === 0 || l - legs[i - 1] >= 2),
    '재료 구간 사이에 **적어도 한 구간**이 빈다 — 그 빈 곳이 돌파다. 붙어 있으면 계속 캐는 게임이 된다');
  ok(legs[0] >= 2, `첫 재료가 ${legs[0]}구간 — 1구간은 배를 익히는 자리다`);
  ok(legs[legs.length - 1] <= LEG.count - 2,
    `마지막 재료가 ${legs[legs.length - 1]}구간 — 끝의 두 구간(최종 방어선 · 투하)은 비워 둔다`);
  ok(!partAtLeg(1) && !!partAtLeg(legs[0]), '구간으로 물어보면 답이 나온다');
}

console.log('\n[3] ★★★ **기관실이 제일 뒤인가** — 「가장 후미에」의 답');
{
  const engine = ROOMS.find((r) => r.key === 'engine');
  const back = AFT;
  console.log(`   기관실 z ${engine.z0}~${engine.z1} · 배의 제일 뒤 z ${back}`);
  ok(engine.z1 === back, '★★ **기관실이 배의 제일 뒤다** — 새 방을 안 만들어도 「가장 후미」가 된다');
  ok(CRADLE.at.z > engine.z0 && CRADLE.at.z <= engine.z1,
    `크레이들(z ${CRADLE.at.z})이 **기관실 안**에 있다 — 후미 격벽`);
  ok(ROOMS.length === 7, `방이 일곱 그대로다 (${ROOMS.length}) — 늘리면 왕복이 길어지고, 그러면 전투 중심이 안 된다`);
}

console.log('\n[4] ★★★ **추진을 켜면 탄두가 데워지나** — 기관실에 둔 값');
{
  const w = makeWarhead();
  // 뜨거운 기관실
  let u = 0;
  while (u < 60) { stepWarhead(w, DT, { heat: HEAT.max }); u += DT; }
  console.log(`   뜨거운 채로 60초 — 탄두 ${w.bake.toFixed(0)}`);
  ok(w.bake > 20, `★★ 뜨거우면 **오른다** (${w.bake.toFixed(0)}) — 「빨리 가고 싶다 ↔ 식혀야 한다」가 매 순간 생긴다`);
  const hi = w.bake;
  let v = 0;
  while (v < 60) { stepWarhead(w, DT, { heat: 0 }); v += DT; }
  console.log(`   식히고 60초 — 탄두 ${w.bake.toFixed(0)}`);
  ok(w.bake < hi, '식히면 내려간다');
  ok(BAKE.fall < BAKE.rise,
    `★ 내려가는 것(${BAKE.fall})이 오르는 것(${BAKE.rise})보다 **느리다** —`
    + ' 빨리 식으면 「잠깐 밟았다 떼면 그만」이 되어 저울이 없다');
  ok(BAKE.safe <= HEAT.warn,
    `안전선(${BAKE.safe})이 선체 경고선(${HEAT.warn}) 이하다 — 계기가 붉어질 때 탄두도 오른다`);
}

console.log('\n[5] ★★★ **한계에 닿으면 일이 늘고 안 죽나**');
{
  const w = makeWarhead();
  w.in = ['shell', 'booster', 'lens'];
  w.bake = BAKE.max - 1;
  let ev = null, u = 0;
  while (u < 10 && ev !== 'lost') { ev = stepWarhead(w, DT, { heat: HEAT.max }); u += DT; }
  ok(ev === 'lost', '★ 한계에 닿으면 **꽂아 둔 것이 하나 죽는다**');
  ok(w.in.length === 2, `셋에서 둘로 (${w.in.join('·')}) — 죽는 것이 아니라 **일이 는다**`);
  ok(w.lost[0] === 'lens',
    '★★ **제일 나중에 꽂은 것**이 죽는다 — 아무거나 죽이면 「무엇을 잃었나」가 운이 되고,'
    + ' 마지막 것이면 **방금 한 일**을 잃는 것이라 아프다');
  ok(w.bake < BAKE.max, '온도가 조금 내려간다 — 안 내려가면 남은 것이 줄줄이 죽는다');
}

console.log('\n[6] ★★ **손에 들고 걸어가서 꽂나** — 딸깍이면 무게가 없다');
{
  const w = makeWarhead();
  ok(pickUp(w, 'shell'), '손에 넣었다');
  ok(!pickUp(w, 'booster'), '★ 두 개를 한꺼번에 못 든다 — 한 손이다');
  ok(w.in.length === 0, '★★ 손에 든 것은 **아직 꽂힌 것이 아니다** — 기관실까지 걸어가야 한다');
  let out = null, u = 0;
  while (u < CRADLE.hold - 0.4) { out = holdCradle(w, DT, { holding: true }); u += DT; }
  ok(out === null, `${CRADLE.hold}초를 다 안 잡으면 아무 일도 안 난다`);
  while (u < CRADLE.hold + 0.6 && out !== 'in') { out = holdCradle(w, DT, { holding: true }); u += DT; }
  ok(out === 'in' && w.in.includes('shell'), '★ 다 잡으니 **꽂힌다**');
  // 놓으면 되감긴다
  const w2 = makeWarhead();
  pickUp(w2, 'lens');
  holdCradle(w2, 1.0, { holding: true });
  const a = w2.held;
  holdCradle(w2, 1.0, { holding: false });
  ok(w2.held < a, `놓으면 되감긴다 (${a.toFixed(1)} → ${w2.held.toFixed(1)})`);
}

console.log('\n[7] ★★ **다섯이 다 차야 무장이 열리나**');
{
  const w = makeWarhead();
  w.in = PARTS5.slice(0, 4).map((p) => p.key);
  let out = null, u = 0;
  while (u < CRADLE.arm + 2) { out = holdArm(w, DT, { holding: true }); u += DT; }
  ok(out === null && !w.armed, '넷으로는 **아무리 잡아도 안 열린다**');
  w.in.push(PARTS5[4].key);
  ok(full(w), '다섯이 다 찼다');
  let v = 0;
  while (v < CRADLE.arm + 2 && out !== 'armed') { out = holdArm(w, DT, { holding: true }); v += DT; }
  ok(out === 'armed' && w.armed, `★ ${CRADLE.arm}초를 잡으니 **무장이 열린다**`);
  ok(CRADLE.arm > CRADLE.hold * 2,
    `무장(${CRADLE.arm}초)이 꽂기(${CRADLE.hold}초)보다 훨씬 길다 — 되돌릴 수 없는 일은 길어야 한다`);
}

console.log('\n[8] ★★★ **못 모아도 갈 수 있나** — 결말 셋');
{
  for (const e of ENDINGS) console.log(`   ${e.min}칸 이상 → ${e.name.padEnd(6)} ${e.what}`);
  ok(new Set(ENDINGS.map((e) => e.key)).size === 3, '결말이 셋이다');
  ok(endingOf(5).key === 'full' && endingOf(4).key === 'dud' && endingOf(1).key === 'none',
    '5 → 터졌다 · 4 → 불발 · 1 → 못 떨굼');
  // 무장 안 하고 떨궈 본다
  const w = makeWarhead();
  w.in = ['shell', 'booster'];
  const r = drop(w);
  ok(!w.dropped && r.key === 'none', '★ 무장을 안 했으면 **안 나간다** — 지나친다');
  const w2 = makeWarhead();
  w2.in = PARTS5.map((p) => p.key);
  w2.armed = true;
  ok(drop(w2).key === 'full' && w2.dropped, '다 채우고 무장하면 **터진다**');
  // ★ 2시간을 쓰고 끝을 못 보는 회차가 없어야 한다
  ok(ENDINGS.every((e) => e.what && !/점수|등급/.test(e.what)),
    '★★ 결말이 **점수도 등급도 아니다** — 목록이지 성적표가 아니다 (v56 규약)');
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「모으는 것이 재미있나」는 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「다섯이 다른 일인가 · 데워지나 · 일이 느나 · 못 모아도 가나」뿐이다.');
process.exit(fail ? 1 : 0);
