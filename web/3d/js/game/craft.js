// ══════════════════════════════════════════════════════════════════════════
//  대장간 — 강화 · 재련. 규칙은 여기, 숫자는 craft-table.js.
//
//  이 게임에서 **끝이 없는 유일한 소모처**다 (docs/GRIND.md §4-1).
//  장비 여덟 칸은 금방 차지만, 그 여덟 개를 두드리는 일은 안 끝난다.
//
//  ★ 실패해도 안 부서진다. 안 내려가지도 않는다.
//    「부서질까 봐 안 두드린다」가 되는 순간 소모처가 소모처를 못 한다.
//    잃는 것은 잔해와 시간뿐이다.
// ══════════════════════════════════════════════════════════════════════════

import { ENHANCE, REFORGE, plusCap } from './craft-table.js';
import { AFFIXES, AFFIX_BY_KEY, RARITIES } from './item-table.js';
import { itemScale } from './growth-table.js';

/** 지금 이 장비를 한 단계 올릴 때 드는 것과 될 확률 */
export function enhanceInfo(item, tier = 0) {
  const n = item?.plus || 0;
  const cap = plusCap(tier);
  return {
    plus: n, cap,
    maxed: n >= cap,
    cost: ENHANCE.cost(n),
    chance: ENHANCE.chance(n),
  };
}

/**
 * 한 단계 두드린다.
 *
 * @returns {ok, why?, success?, plus?, spent?}
 *   ok=false 는 **아예 못 두드린 것**(잔해 부족·상한)이고,
 *   ok=true·success=false 는 **두드렸는데 안 붙은 것**이다. 둘은 다르다 —
 *   같이 묶으면 화면이 「실패했다」로 뭉뚱그려져서 왜인지 모른다.
 */
export function enhance(player, item, rnd, tier = 0) {
  if (!item) return { ok: false, why: '장비를 고르세요' };
  const info = enhanceInfo(item, tier);
  if (info.maxed) return { ok: false, why: `이 회차의 상한은 +${info.cap} 입니다` };
  if ((player.scrap || 0) < info.cost) return { ok: false, why: '잔해가 모자란다' };

  player.scrap -= info.cost;
  const success = rnd.chance(info.chance);
  if (success) item.plus = info.plus + 1;
  return { ok: true, success, plus: item.plus, spent: info.cost };
}

/** 재련 값 */
export function reforgeInfo(item) {
  const r = item?.rarity ?? 0;
  return { scrap: REFORGE.scrap(r), coin: REFORGE.coin(r) };
}

/**
 * 접사 **하나만** 다시 굴린다.
 *
 * 전부 굴리면 새 장비를 먹는 것과 같아서 「이 물건을 키운다」가 안 된다.
 * 어느 접사를 굴릴지는 부르는 쪽(대장간 UI)이 고른다 — 무작위로 고르면
 * 제일 좋은 접사가 날아갈까 봐 아무도 안 쓴다.
 */
export function reforge(player, item, affixIndex, rnd, floorNo = 1, tier = 0) {
  if (!item || !item.affixes?.length) return { ok: false, why: '다시 굴릴 접사가 없다' };
  const a = item.affixes[affixIndex];
  if (!a) return { ok: false, why: '접사를 고르세요' };
  const cost = reforgeInfo(item);
  if ((player.scrap || 0) < cost.scrap) return { ok: false, why: '잔해가 모자란다' };
  if ((player.coin || 0) < cost.coin) return { ok: false, why: '영혼 조각이 모자란다' };

  // 그 자리에 올 수 있는 접사 후보 — **이미 붙어 있는 것은 뺀다.**
  // 안 빼면 같은 접사가 둘 붙어서 stats 가 조용히 두 배가 된다.
  const taken = new Set(item.affixes.map((x, i) => (i === affixIndex ? null : x.key)).filter(Boolean));
  const cand = AFFIXES.filter((x) => !taken.has(x.key)
    && !(item.slot === 'weapon' && x.key === 'armor'));
  if (!cand.length) return { ok: false, why: '바꿀 수 있는 접사가 없다' };

  const scale = itemScale(floorNo, tier) * RARITIES[item.rarity].mult;
  const pick = rnd.pick(cand);
  const value = pick.roll(rnd, scale);
  if (!value) return { ok: false, why: '굴림에 실패했다' };

  player.scrap -= cost.scrap;
  player.coin -= cost.coin;

  const before = { key: a.key, value: a.value };
  // stats 는 접사의 합이다. 갈아 끼울 때 **뺀 다음 더한다** — 더하기만 하면
  // 재련할 때마다 옛 접사의 값이 그대로 남아 쌓인다.
  item.stats[a.key] = (item.stats[a.key] || 0) - a.value;
  if (Math.abs(item.stats[a.key]) < 1e-9) delete item.stats[a.key];
  item.affixes[affixIndex] = { key: pick.key, value };
  item.stats[pick.key] = (item.stats[pick.key] || 0) + value;

  return { ok: true, before, after: { key: pick.key, value }, spent: cost };
}

/** 「좋아졌나」 — 화면이 ▲▼ 를 찍는 데 쓴다 */
export const affixName = (a) => AFFIX_BY_KEY[a.key]?.fmt(a.value) ?? '';
