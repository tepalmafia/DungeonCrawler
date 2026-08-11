// ══════════════════════════════════════════════════════════════════════════
//  부위와 등급 — **순수 규칙.** 숫자는 `parts-table.js` 에 있다 (v107).
//
//  ★ three.js 도 DOM 도 안 쓴다. `tools/space-parts.js` 가 브라우저 없이
//    통째로 돌려 본다 — **게임에 붙이기 전에** 맞는지 본다
// ══════════════════════════════════════════════════════════════════════════
import {
  SLOTS, SLOT_BY, TIERS, TIER_BY, tierIdx, UPGRADE, CRAFT, oreFor,
  makePart, multOf, partName, partsMight, PWHY,
} from './parts-table.js';

/** 처음 배 — 일곱 자리에 **표준**이 달려 있다 */
export const makeFit = () => ({
  /** 부위마다 달린 것 */
  on: Object.fromEntries(SLOTS.map((s) => [s.key, makePart(s.key, 'stock')])),
  /** 안 단 것들 (파밍으로 들어온 것) */
  spare: [],
  /** 얼마나 갈아 끼웠나 — 끝 화면이 읽는다 */
  swapped: 0, made: 0, upped: 0,
});

/** 지금 전투력 */
export const mightOf = (f) => partsMight(f.on);

/** 그 부위의 여분들 (등급 높은 것부터) */
export const sparesFor = (f, slot) =>
  f.spare.filter((p) => p.slot === slot).sort((a, b) => tierIdx(b.tier) - tierIdx(a.tier));

/**
 * ★★ **파밍으로 하나 들어왔다.** 어디에도 안 달고 여분으로 쌓는다 —
 *   **자동으로 갈아 끼우지 않는다.** 저절로 좋아지면 I 창을 볼 이유가
 *   없어지고, 그러면 「고르는 것」이 사라진다
 */
export function gainPart(f, slot, tier = 'stock') {
  if (!SLOT_BY[slot] || !TIER_BY[tier]) return null;
  const p = makePart(slot, tier);
  f.spare.push(p);
  return p;
}

/**
 * **단다** — 여분 하나를 그 자리에 끼우고, 있던 것은 여분으로 내린다.
 * @param idx `sparesFor` 에서 몇 번째
 */
export function equip(f, slot, idx = 0) {
  const list = sparesFor(f, slot);
  const p = list[idx];
  if (!p) return { ok: false, why: 'slot' };
  const was = f.on[slot];
  if (was && was.tier === p.tier) return { ok: false, why: 'same' };
  f.spare.splice(f.spare.indexOf(p), 1);
  f.on[slot] = p;
  if (was) f.spare.push(was);
  f.swapped++;
  return { ok: true, why: null, put: p, took: was };
}

/**
 * ★★★ **개조** — 같은 부위의 여분 둘 + 광석을 태워 한 등급 올린다.
 *
 * @param have { ore }  갖고 있는 것 — **여기서 안 깎는다.** 깎는 것은
 *   게임이 한다 (`main.js`). 규칙과 곳간을 한 자리에 두면 검사가 못 돈다
 */
export function upgrade(f, slot, have = {}) {
  const cur = f.on[slot];
  if (!cur) return { ok: false, why: 'slot' };
  const i = tierIdx(cur.tier);
  if (i >= tierIdx(UPGRADE.maxTier)) return { ok: false, why: 'max' };
  const spares = sparesFor(f, slot);
  if (spares.length < UPGRADE.spare) return { ok: false, why: 'spare' };
  const ore = oreFor(cur.tier);
  if ((have.ore ?? 0) < ore) return { ok: false, why: 'ore' };
  // 태운다 — **등급이 낮은 것부터** (아까운 것을 남긴다)
  for (let n = 0; n < UPGRADE.spare; n++) {
    const worst = spares[spares.length - 1 - n];
    f.spare.splice(f.spare.indexOf(worst), 1);
  }
  f.on[slot] = makePart(slot, TIERS[i + 1].key);
  f.upped++;
  return { ok: true, why: null, ore, to: f.on[slot] };
}

/** **제작** — 재료로 표준 파츠 하나를 만든다 (여분으로 들어간다) */
export function craft(f, slot, have = {}) {
  if (!SLOT_BY[slot]) return { ok: false, why: 'slot' };
  if ((have.ore ?? 0) < CRAFT.ore) return { ok: false, why: 'ore' };
  if ((have.parts ?? 0) < CRAFT.parts) return { ok: false, why: 'parts' };
  const p = makePart(slot, CRAFT.tier);
  f.spare.push(p);
  f.made++;
  return { ok: true, why: null, ore: CRAFT.ore, parts: CRAFT.parts, made: p };
}

/** 화면과 검사가 읽는다 — I 창이 그리는 것이 이것이다 */
export function summary(f) {
  return {
    might: mightOf(f),
    slots: SLOTS.map((s) => {
      const p = f.on[s.key];
      const sp = sparesFor(f, s.key);
      return {
        key: s.key, name: s.name, what: s.what,
        tier: p?.tier ?? null, mult: multOf(p), label: partName(p),
        spares: sp.length,
        best: sp[0] ? partName(sp[0]) : null,
        canUp: tierIdx(p?.tier ?? 'stock') < tierIdx(UPGRADE.maxTier) && sp.length >= UPGRADE.spare,
        oreUp: p ? oreFor(p.tier) : 0,
      };
    }),
    spare: f.spare.length,
    swapped: f.swapped, made: f.made, upped: f.upped,
  };
}

export { SLOTS, TIERS, PWHY, partName, oreFor, UPGRADE, CRAFT };
