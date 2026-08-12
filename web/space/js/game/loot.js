// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **묻고 · 줍고 · 보여 준다** — 순수 상태 기계 (v121). three 를 안 쓴다.
//
//  ★ 사장님 「격추하면 **회수하겠습니까? 질문이 나오고** 회수하는 것으로.
//    **아이템을 먹으면 아이템 요약이 뜨도록**」
//
//  ★★ 여기는 **묻는 것과 보여 주는 것**만 한다. 실제로 끌어오는 일은
//    이미 `game/salvage.js` 가 한다 — 이 파일이 다시 끌어오면 **끌어오는
//    곳이 둘**이 되고, 그게 이 저장소가 네 판을 태운 병이다.
//    「예」는 `wayFor` 로 고른 방법을 **부탁만** 한다.
// ══════════════════════════════════════════════════════════════════════════
import { ASK, CARD, PART_CARD, askLine, summaryOf, wayFor, shapeOf, toneOf } from './loot-table.js';
// ★★★ v125 — **파츠는 등급이 있다** (사장님 「등급도 나오게 해줘」)
import { TIER_BY, SLOT_BY } from './parts-table.js';
import { WAYS } from './cargo-table.js';

export const makeLoot = () => ({
  /** 지금 뜬 물음 — `{ id, items, dist, t }` (없으면 null) */
  ask: null,
  /** 마지막으로 물은 뒤 지난 시간 — 연달아 묻지 않으려고 */
  since: ASK.minGap,
  /** 떠 있는 요약 카드들 — `{ key, count, t }` */
  cards: [],
  /** 센 것 — 검사가 읽는다 */
  asked: 0, took: 0, passed: 0, missed: 0,
});

/**
 * ★★ **부쉈다** — 물어볼지 정한다.
 *
 * @param items `[{ key, n }]` 나온 것 · dist 꾸러미까지 (m)
 * @returns 'auto' 묻지 않고 줍는다 · 'ask' 물었다 · null 아무 일 없음
 */
export function broke(L, items, dist) {
  if (!items?.length) return null;
  // ★ **코앞이면 안 묻는다.** 도킹 팔 사거리 안의 것까지 물으면 질문이
  //   잔소리가 된다 — 물어보는 값이 물어보는 뜻보다 커진다
  if (dist <= ASK.auto) return 'auto';
  // ★ 연달아 부수면 물음이 쌓여 화면이 물음표로 덮인다. **간격을 둔다**
  if (L.since < ASK.minGap) return null;
  // ★ 이미 물어 놓은 것이 있으면 **새 것으로 갈아 끼운다.** 쌓아 두면
  //   답한 것이 무엇에 대한 답인지 모르게 된다
  L.ask = { id: (L.asked += 1), items, dist, t: ASK.window };
  L.since = 0;
  return 'ask';
}

/**
 * 한 프레임 — 물음이 삭고 카드가 사라진다.
 * @returns 'gone' 물음이 시간에 밀려 사라졌다 · null
 */
export function stepLoot(L, dt) {
  L.since += dt;
  for (let i = L.cards.length - 1; i >= 0; i--) {
    L.cards[i].t -= dt;
    if (L.cards[i].t <= 0) L.cards.splice(i, 1);
  }
  if (!L.ask) return null;
  L.ask.t -= dt;
  if (L.ask.t > 0) return null;
  // ★ **꾸러미는 안 없앤다.** 물음만 사라진다 — 「못 봤다」가 「못 줍는다」가
  //   되면 그건 결심이 아니라 벌이다 (F/G/B 로 여전히 주울 수 있다)
  L.ask = null; L.missed += 1;
  return 'gone';
}

/**
 * ★★★ **답한다.**
 * @returns null 물음이 없다 · `{ way }` 줍는다 · `{ passed: true }` 지나친다
 */
export function answer(L, yes) {
  if (!L.ask) return null;
  const a = L.ask;
  L.ask = null;
  if (!yes) { L.passed += 1; return { passed: true }; }
  L.took += 1;
  return { way: wayFor(a.dist), items: a.items, dist: a.dist };
}

/**
 * ★★ **주웠다** — 요약 카드를 얹는다.
 *   ★ 같은 것을 연달아 주우면 **한 장에 개수로** 묶는다 (`CARD.stack`).
 *     안 묶으면 광석 셋을 주울 때 카드 셋이 뜨고, 그러면 카드가 아니라 비다
 */
export function gained(L, key, n = 1) {
  if (!key) return null;
  const old = CARD.stack ? L.cards.find((c) => c.key === key && !c.part) : null;
  if (old) { old.count += n; old.t = CARD.hold; return old; }
  L.cards.push({ key, count: n, t: CARD.hold });
  while (L.cards.length > CARD.max) L.cards.shift();
  return L.cards[L.cards.length - 1];
}

/**
 * ★★★ **파츠를 주웠다** — 등급이 있는 것 (v125).
 *
 *   ★ 사장님 「**등급도 나오게** 해줘」. v124 까지 파츠는 배너 한 줄로
 *     스쳐 갔다 (「★ 노획품 주포」) — 회차에서 제일 귀한 것이 제일 안
 *     보였다. 재료와 **같은 카드**로 온다.
 *   ★★ 파츠는 **안 묶는다** — 같은 부위라도 등급이 다르면 다른 물건이다
 */
export function gainedPart(L, part) {
  if (!part?.slot) return null;
  L.cards.push({ key: `part:${part.slot}:${part.tier}`, count: 1, t: CARD.hold, part });
  while (L.cards.length > CARD.max) L.cards.shift();
  return L.cards[L.cards.length - 1];
}

/** 화면과 검사가 읽는다 — **여기가 유일한 자리다** */
export function summary(L) {
  return {
    ask: L.ask ? {
      line: askLine(L.ask.items), left: +L.ask.t.toFixed(2),
      dist: Math.round(L.ask.dist), way: wayFor(L.ask.dist),
      // ★ 화면이 「그물」이라고 적을 수 있게 **이름까지** 준다 —
      //   화면에서 `WAYS` 를 또 읽으면 읽는 곳이 둘이 된다
      wayName: WAYS[wayFor(L.ask.dist)]?.name ?? '',
      n: L.ask.items.length,
    } : null,
    cards: L.cards.map((c) => {
      // ★★★ **파츠는 재료와 다른 것을 말한다** — 이름·등급·부위 (v125)
      if (c.part) {
        const t = TIER_BY[c.part.tier];
        return {
          key: c.key, count: 1, left: +c.t.toFixed(2),
          shape: PART_CARD.shape, tone: PART_CARD.tone,
          name: `${t?.name ?? '?'} ${SLOT_BY[c.part.slot]?.name ?? c.part.slot}`,
          /** ★ 등급 — 이름과 **따로** 준다. 화면이 크게 찍을 수 있게 */
          tier: t?.name ?? '?', tierKey: c.part.tier, tierTone: t?.tone ?? 'dim',
          gain: `힘 ×${(t?.mult ?? 1).toFixed(2)}`,
          use: SLOT_BY[c.part.slot]?.what ?? '배에 단다 — I 창에서 갈아 끼운다',
          mass: 0,
        };
      }
      return {
        key: c.key, count: c.count, left: +c.t.toFixed(2),
        // ★★ **형태와 색도 여기서 준다.** 화면이 `SHAPES` 를 따로 읽으면
        //   물건을 하나 더할 때 한쪽만 고치게 된다
        shape: shapeOf(c.key), tone: toneOf(c.key),
        ...summaryOf(c.key, c.count),
      };
    }),
    asked: L.asked, took: L.took, passed: L.passed, missed: L.missed,
  };
}
