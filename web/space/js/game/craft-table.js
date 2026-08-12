// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **제조 — 실은 것을 쓸 것으로 바꾼다** (v114). 숫자만.
//
//  ★ 사장님 (2026-08-11) 「**인벤토리도 만들어야지. 제조하는 것도 만들고**」
//
//  ══ 왜 이것이 「화물칸이 찬다」와 한 판인가 ═══════════════════════════
//
//  v113 까지 화물칸에는 **나가는 문이 없었다.** 아이템은 주우면 통으로
//  들어가고(그러면서 화물칸에도 남고 — 그게 v114 가 막은 구멍이다),
//  남은 것은 **버리는 것 말고 할 일이 없었다.** 곳간에 문이 하나뿐이면
//  그건 곳간이 아니라 **쓰레기통**이다.
//
//  ★★ 제조가 그 두 번째 문이다. 그리고 이 게임의 문법으로 만든다:
//
//    ① **재료는 이미 있는 것만 쓴다.** 새 아이템을 안 만든다 —
//       열여섯을 여섯으로 줄인 것이 v110 이고, 다시 늘리면 그 판을 무른다
//    ② **만드는 것은 「지금 모자란 것」이다.** 미사일 · 아크 전지 ·
//       냉각제 · 식량 — 넷 다 **회차 중에 떨어져서 막히는** 것들이다
//    ③ ★★★ **공짜가 아니라 손해다.** 바꾸면 **무게가 늘거나 값이 는다.**
//       광석은 파츠를 올리는 돈이기도 하므로(`parts-table.js UPGRADE`),
//       미사일을 만들면 **개조를 못 한다.** 「쏘면 못 고친다」(v44 주포)와
//       같은 저울이고, 이 저장소의 벌은 늘 숫자가 아니라 **일**이었다
//    ④ **시간이 든다.** 즉발이면 싸우다가 눌러 버리는 단추가 되고,
//       그러면 「보급이 모자란다」가 통째로 없어진다
//
//  ══ ★★★ 물리로 말이 되나 (`REAL.md` 규약) ═══════════════════════════
//
//  ★ 원소를 만들어 내지 않는다 — **있는 것을 조립할 뿐**이다. 광석에서
//    금속을, 정비 부품에서 기구를 뜯어 쓰는 그림이다. 그래서 **탄두 재료
//    다섯은 제조에 없다** (`warhead-table.js`): 그건 핵물질이고 광석을
//    빻아 나오는 물건이 아니다. 만들 수 있으면 「적진을 뚫고 들어가
//    모은다」는 이 게임의 목적이 통째로 없어진다.
//  ★ 아크 전지는 만들 수 있게 두되 **제일 비싸다.** 적에게서 뜯는 것이
//    본길이고(`cargo-table.js arc.why`), 제조는 「정 급하면」의 자리다
//
//  ★ three.js 를 안 쓴다 — `tools/space-craft.js` 가 읽는다.
// ══════════════════════════════════════════════════════════════════════════
import { ITEMS, MASS } from './cargo-table.js';
import { MISSILES } from './supply-table.js';

/**
 * ★★ **만드는 데 걸리는 시간의 밑값** (초).
 *   ★ 싸우는 중에는 못 만든다 — `busy` 를 보고 `main.js` 가 막는다.
 *     즉발이면 「모자란다」가 단추 하나로 풀려 계통이 죽는다
 */
export const CRAFT = {
  /** 이보다 자주 누를 수는 없다 (초) */
  gap: 0.4,
  /** ★ 쫓기는 중에는 못 만든다 — 손이 조종간에 있다 */
  needCalm: true,
};

/**
 * ★★★ **조리법 넷.**
 *
 * @property give  무엇이 되나 — `to` 가 아이템이면 화물칸으로,
 *                 `field` 면 배의 계통으로 바로 들어간다
 * @property cost  드는 것 (화물칸의 아이템)
 * @property sec   걸리는 시간
 * @property why   **왜 이 값인가** — 손으로 고를 때 근거가 없으면 흔들린다
 */
export const RECIPES = {
  missile: {
    key: 'missile', name: '유도탄 조립',
    cost: { ore: 3, spare: 2 },
    to: { field: 'missiles', n: 1 },
    sec: 22,
    /**
     * ★★★ 이 판에서 제일 중요한 조리법이다. `MISSILES.infinite` 를 끄면
     *   **미사일이 진짜로 떨어지고**, 그때 이 조리법이 유일한 보충 길이 된다.
     *   값(광석 3 · 부품 2 = 22 짐)이 무거운 이유: 미사일 한 발은
     *   **개조 한 번**(`UPGRADE`)과 맞바꾸는 것이라야 고를 것이 생긴다
     */
    why: '광석과 부품을 뜯어 탄체를 만든다 — 개조 한 번과 맞바꾸는 값',
  },
  arc: {
    key: 'arc', name: '아크 전지 충전',
    cost: { ore: 8, spare: 3 },
    to: { item: 'arc', n: 1 },
    sec: 40,
    why: '★ 제일 비싸다 — 본길은 **적에게서 뜯는 것**이다 (WAR.md §14-3)',
  },
  coolant: {
    key: 'coolant', name: '냉각제 합성',
    cost: { ore: 4 },
    to: { item: 'coolant', n: 1 },
    sec: 14,
    why: '광석에서 휘발분을 뽑는다 — 제일 싸고 제일 자주 쓴다',
  },
  meal: {
    key: 'meal', name: '식량 재포장',
    cost: { ration: 3 },
    to: { item: 'meal', n: 1 },
    sec: 8,
    /**
     * ★★ **무게가 준다** (비상 배급 3 × 1 = 3 → 식량 팩 4). 어? 는다.
     *   ★ 그런데 **먹이는 양**은 9×3 = 27 → 26 으로 거의 같다. 즉 이건
     *     이득이 아니라 **정리**다 — 목록에서 줄이 하나 줄고, 그 대신
     *     아주 조금 손해다. 곳간을 정리하는 일이 공짜면 안 된다
     */
    why: '부스러기를 모아 한 끼로 — 정리하는 일이지 이득이 아니다',
  },
};

export const RECIPE_LIST = Object.values(RECIPES);

/** 이 조리법의 재료 무게 · 나오는 것의 무게 */
export function massOf(r) {
  const inn = Object.entries(r.cost)
    .reduce((a, [k, n]) => a + (MASS[ITEMS[k]?.mass] ?? 0) * n, 0);
  const out = r.to.item ? (MASS[ITEMS[r.to.item]?.mass] ?? 0) * r.to.n : 0;
  return { in: inn, out, saved: inn - out };
}

/** 지금 만들 수 있나 — 못 만들면 왜인지 */
export function canMake(key, { items = {}, calm = true, busy = false } = {}) {
  const r = RECIPES[key];
  if (!r) return { ok: false, why: 'none' };
  if (busy) return { ok: false, why: 'busy' };
  if (CRAFT.needCalm && !calm) return { ok: false, why: 'calm' };
  for (const [k, n] of Object.entries(r.cost)) {
    if ((items[k] ?? 0) < n) return { ok: false, why: 'short', short: k };
  }
  return { ok: true, r };
}

export const WHY = {
  none: '그런 것은 못 만듭니다',
  busy: '이미 만드는 중입니다',
  calm: '★ 쫓기는 중에는 못 만듭니다 — 손이 조종간에 있습니다',
  short: '재료가 모자랍니다',
};

/** 사람이 읽는 한 줄 — 인벤토리 창이 쓴다 */
export function costWord(r) {
  return Object.entries(r.cost)
    .map(([k, n]) => `${ITEMS[k]?.name ?? k} ${n}`).join(' · ');
}

/** ★ 미사일을 진짜로 세는가 — 무한이면 이 조리법은 장식이다 */
export const missilesReal = () => !MISSILES.infinite;
