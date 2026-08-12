// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **줍겠습니까 · 무엇을 주웠나** — 뼈대만 (v121)
//
//    node tools/space-loot.js
//
//  ★ 사장님 (2026-08-12) 「적을 격추하거나 물체를 격추하면 **아이템을
//    회수하겠습니까? 질문이 나오고** 회수하는 것으로. 그리고 **아이템을
//    먹으면 아이템 요약이 뜨도록** 해줘. **형태와 요약.**」
//
//  ★★ 묻는 것 넷:
//      ① 부수면 **묻나** — 그리고 코앞의 것은 안 묻나 (잔소리가 아닌가)
//      ② 「아니오」가 **진짜 답인가** — 늘 「예」면 질문이 아니라 절차다
//      ③ 안 답하면 **물음만** 사라지나 — 꾸러미까지 사라지면 그건 벌이다
//      ④ 주우면 **형태와 요약**이 뜨나 · 같은 것은 한 장으로 묶이나
//
//  ★ three 를 안 쓴다 — 게임을 안 부른다
// ══════════════════════════════════════════════════════════════════════════
import { ASK, CARD, shapeOf, toneOf, summaryOf, summaryLine, wayFor } from '../web/space/js/game/loot-table.js';
import { makeLoot, broke, stepLoot, answer, gained, gainedPart, summary } from '../web/space/js/game/loot.js';
import { makePart, TIER_BY } from '../web/space/js/game/parts-table.js';
import { ITEMS } from '../web/space/js/game/cargo-table.js';
import { WAYS, timeOf } from '../web/space/js/game/cargo-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const DT = 1 / 60;
const run = (L, sec) => { for (let i = 0; i < sec / DT; i++) stepLoot(L, DT); };

console.log('줍겠습니까 · 무엇을 주웠나 — 뼈대만 (게임을 안 부른다)');
console.log(`   물음 ${ASK.window}초 · 코앞 ${ASK.auto}m 안은 안 묻는다 · 사이 ${ASK.minGap}초`
  + ` · 카드 ${CARD.hold}초 · 최대 ${CARD.max}장`);

// ══ ① 부수면 묻나 ═════════════════════════════════════════════════════
console.log('\n[①] 부수면 묻나 — 그리고 코앞의 것은 안 묻나');
{
  const L = makeLoot();
  const items = [{ key: 'ore', n: 1 }, { key: 'spare', n: 1 }];
  ok(broke(L, items, 60) === 'ask', '★★★ 60m 에서 부수니 **묻는다**');
  const s = summary(L);
  console.log(`   「${s.ask.line}」  (${s.ask.dist}m · ${WAYS[s.ask.way].name})`);
  ok(/회수하겠습니까/.test(s.ask.line), '★★ 물음에 **무엇이 나왔는지 같이** 적힌다 — 「회수?」만으로는 못 정한다');
  ok(s.ask.way === 'net', `★ 60m 는 **그물**이 골라진다 (${WAYS[s.ask.way].name}) — 「그래서 뭘 누르지」를 안 만든다`);

  const L2 = makeLoot();
  // ★★★ v125 — **8m 는 이제 묻는다.** 사장님 「너무 가까이 붙어서 **충돌하는
  //   것 같아서 현실감이 떨어져**」 — 12m 는 부딪히기 직전이고, 그 거리에서
  //   말없이 팔이 나가면 「회수」가 아니라 「들이받고 주웠다」로 보인다.
  //   `ASK.auto` 를 12 → 4 로 줄였다. 안 묻는 자리는 **정말 코앞**만 남는다
  ok(broke(L2, items, 8) === 'ask',
    `★★★ 8m 는 **묻는다** (안 묻는 자리는 ${ASK.auto}m 안뿐) — 부딪히기 직전에`
    + ' 말없이 팔이 나가면 그건 회수가 아니라 들이받고 줍는 것이다');
  const L2b = makeLoot();
  ok(broke(L2b, items, ASK.auto - 1) === 'auto',
    `★ 그래도 ${ASK.auto}m 안이면 안 묻는다 — 코앞까지 물으면 질문이 잔소리가 된다`);

  const L3 = makeLoot();
  broke(L3, items, 60);
  run(L3, 0.3);
  ok(broke(L3, items, 60) === null,
    `★★ ${ASK.minGap}초 안에 또 부수면 **안 묻는다** — 연달아 물으면 화면이 물음표로 덮인다`);
}

// ══ ② 「아니오」가 진짜 답인가 ═════════════════════════════════════════
console.log('\n[②] 「아니오」가 진짜 답인가');
{
  const L = makeLoot();
  broke(L, [{ key: 'ore', n: 1 }], 60);
  const r = answer(L, false);
  ok(r?.passed === true, '★★★ 「아니오」를 고를 수 있다 — 지나치는 것이 조작이다');
  ok(summary(L).ask === null, '★ 답하면 물음이 사라진다');
  ok(summary(L).passed === 1 && summary(L).took === 0, '★ 지나친 것을 **센다** — 회차 끝 화면이 읽는다');

  const L2 = makeLoot();
  broke(L2, [{ key: 'ore', n: 1 }], 60);
  const y = answer(L2, true);
  ok(!!y?.way, `★★★ 「예」를 고르면 **방법이 골라져 나간다** (${WAYS[y.way].name}) — 새 조작을 안 만든다`);
  // ★ 줍는 것이 공짜가 아니어야 「아니오」가 산다
  ok(WAYS[y.way].sign > 0,
    `★★★ 줍는 동안 **자국이 오른다** (+${WAYS[y.way].sign}) — 공짜면 늘 「예」가 답이고, 그러면 질문이 아니라 절차다`);
}

// ══ ③ 안 답하면 물음만 사라지나 ═══════════════════════════════════════
console.log('\n[③] 안 답하고 두면');
{
  const L = makeLoot();
  broke(L, [{ key: 'arc', n: 1 }], 60);
  run(L, ASK.window - 0.5);
  ok(summary(L).ask !== null, `★ ${(ASK.window - 0.5).toFixed(1)}초까지는 **떠 있다**`);
  run(L, 1.0);
  ok(summary(L).ask === null && summary(L).missed === 1,
    `★★★ ${ASK.window}초가 지나면 **물음만** 사라진다 — 꾸러미는 남으므로 F/G/B 로 여전히 줍는다.`
    + ' 「못 봤다」가 「못 줍는다」가 되면 그건 결심이 아니라 벌이다');
}

// ══ ④ 주우면 형태와 요약이 뜨나 ═══════════════════════════════════════
console.log('\n[④] 주우면 — **형태와 요약**');
{
  const L = makeLoot();
  gained(L, 'ore', 1);
  const c = summary(L).cards[0];
  console.log(`   ${shapeOf('ore')} ${toneOf('ore')}  「${summaryLine('ore', 1)}」`);
  ok(!!c && c.key === 'ore', '★★ 주우면 **카드가 뜬다**');
  ok(!!c.name && !!c.gain, `★★★ **요약이 있다** — 「${c.name} — ${c.gain} · ${c.use}」`);
  ok(!!shapeOf('ore') && !!toneOf('ore'),
    `★★★ **형태와 색이 있다** (${shapeOf('ore')} · ${toneOf('ore')}) — 싸우는 중에는 글을 안 읽는다`);

  // 같은 것을 또 주우면 **한 장에 묶인다**
  gained(L, 'ore', 2);
  ok(summary(L).cards.length === 1 && summary(L).cards[0].count === 3,
    `★★ 같은 것은 **한 장에 개수로** 묶인다 (×${summary(L).cards[0].count}) — 안 묶으면 카드가 아니라 비다`);
  // 다른 것은 따로
  gained(L, 'meal', 1);
  ok(summary(L).cards.length === 2, '★ 다른 것은 **따로** 뜬다');
  run(L, CARD.hold + 0.2);
  ok(summary(L).cards.length === 0, `★ ${CARD.hold}초가 지나면 사라진다 — 늘 떠 있으면 그건 계기가 아니다`);
}

// ══ ⑤ 물건마다 형태가 갈리나 · 요약이 표에서 나오나 ═══════════════════
console.log('\n[⑤] 물건 여섯이 서로 갈리나');
{
  const keys = Object.keys(ITEMS);
  console.log('   열쇠      형태    색        한 줄');
  for (const k of keys) {
    console.log(`   ${k.padEnd(9)} ${shapeOf(k).padEnd(6)} ${toneOf(k).padEnd(9)} ${summaryLine(k, 1)}`);
  }
  const shapes = new Set(keys.map(shapeOf));
  ok(shapes.size >= 3, `★★ 형태가 **${shapes.size} 가지**로 갈린다 — 다 같으면 형태가 아니다`);
  ok(keys.every((k) => summaryOf(k).gain),
    '★★★ 여섯이 **다 요약을 갖는다** — 하나라도 비면 그 물건은 주워도 뭔지 모른다');
  // ★ 요약은 **표에서** 나온다 — 손으로 안 적는다
  ok(summaryOf('ore').gain.includes(String(ITEMS.ore.use.ore)),
    `★★★ 요약의 숫자가 **표의 값**이다 (${ITEMS.ore.use.ore}) — 손으로 적으면 표가 바뀔 때 갈라진다`);
}

// ══ ⑥ 거리마다 방법이 갈리나 ══════════════════════════════════════════
console.log('\n[⑥] 거리가 방법을 고른다');
{
  for (const d of [10, 20, 60, 150]) {
    console.log(`   ${String(d).padStart(3)}m → ${d <= ASK.auto ? '안 묻고 줍는다' : WAYS[wayFor(d)].name}`);
  }
  // ══ ★★★ v125 — **뒤집혔다.** 「가까우면 팔」이 낡은 것이다 ══════════
  //
  //  ★ 사장님 「**너무 가까이 붙이지 말고 … 물체가 보일 정도에서 회수**」
  //
  //  ★★ 옛 규칙은 `dist <= 25 ? 'arm'` 이라 **가까울수록 도킹 팔**이었고,
  //    도킹 팔은 표에 적힌 그대로 「바짝 붙어야 한다 — **들이받힐 자리**」다.
  //    물음에 「예」만 해도 그 방법이 골라지니 회수는 늘 부딪힐 만큼
  //    다가가는 일이 됐다.
  //  ★★★ 이제 **닿는 것 중 제일 멀리서 되는 것**을 고른다. 도킹 팔은
  //    안 없앤다 — **F 로 일부러 고르는** 빠른 길로 남는다 (1.2초 vs
  //    그물 1.4~5.7초). 「빠르지만 위험하다」가 그때 비로소 결심이 된다
  ok(wayFor(20) === 'net' && wayFor(60) === 'net' && wayFor(150) === 'bot',
    '★★★ **「예」는 안 붙어도 되는 방법을 고른다** — 그물이 닿으면 그물, 넘으면 로봇');
  ok(WAYS.arm.reach > 0 && WAYS.arm.kb,
    `★★ 도킹 팔은 **안 없앴다** — ${WAYS.arm.kb} 로 일부러 고르면 ${WAYS.arm.fixed}초다`
    + ` (그물은 20m 에 ${timeOf('net', 20)}초). 빠른 대신 붙어야 한다는 것이 곧 결심이다`);
}

console.log('\n[⑦] ★★★ **파츠 카드 — 등급이 보이나** (v125 · 사장님 「등급도 나오게 해줘」)');
{
  const L = makeLoot();
  gainedPart(L, makePart('gun', 'loot'));
  const c = summary(L).cards[0];
  console.log(`   「${c.name}」  등급 ${c.tier}  ·  ${c.gain}  ·  ${c.use}`);
  ok(!!c.tier, `★★★ **등급이 제 칸으로 온다** (${c.tier}) — v124 까지 파츠는 배너 한 줄로`
    + ' 스쳐 갔다. 회차에서 제일 귀한 것이 제일 안 보였다');
  ok(c.tier === TIER_BY.loot.name, `★ 등급 이름을 **표에서** 가져온다 (${TIER_BY.loot.name})`);
  ok(!!c.shape && !!c.use && !!c.gain,
    '★★ 모양 · 쓰임 · 늘어나는 것이 다 있다 — 사장님이 말씀하신 셋');
  const L2 = makeLoot();
  gainedPart(L2, makePart('gun', 'stock'));
  gainedPart(L2, makePart('gun', 'ace'));
  ok(summary(L2).cards.length === 2,
    '★★ 같은 부위라도 **등급이 다르면 안 묶는다** — 다른 물건이다');
  ok(CARD.max === 2 && CARD.hold >= 4.5,
    `★★ 카드가 커졌으므로 **${CARD.max} 장만 · ${CARD.hold}초** — 읽을 것이 늘면 읽을 시간도 늘어야 한다`);
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 묻고 · 고르고 · 주우면 형태와 요약이 뜬다');
process.exit(bad ? 1 : 0);
