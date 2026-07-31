// 랜턴 — 빛을 자원으로 만든다.
//
// 전제(docs/DUNGEON-INTERACTIONS.md §1): 기본 시야가 적 어그로 반경보다 좁아야
// 랜턴이 보상이 된다. 예전엔 시야 21 / 어그로 8~12 라 모든 적을 먼저 봤고,
// 그 상태에서는 「더 밝히는 물건」이 아무 의미가 없었다.

export const BASE_LIGHT = { radius: 9, intensity: 34 };

export const LANTERNS = [
  {
    tier: 0, key: 'old', name: '낡은 랜턴', icon: '🕯',
    radius: 14, intensity: 52, fuelMax: 240, color: 0xffb257, rarityLike: 0,
  },
  {
    tier: 1, key: 'brass', name: '놋쇠 랜턴', icon: '🏮',
    radius: 18, intensity: 68, fuelMax: 360, color: 0xffc46a, rarityLike: 1,
  },
  {
    tier: 2, key: 'soul', name: '영혼 등불', icon: '🔮',
    radius: 22, intensity: 80, fuelMax: 600, color: 0xa9d8ff, rarityLike: 3,
  },
];

export const LANTERN_BY_TIER = Object.fromEntries(LANTERNS.map((l) => [l.tier, l]));

let uid = 9000;

/** 바닥에 떨어뜨릴 수 있는 「랜턴 아이템」을 만든다 */
export function makeLantern(tier, fuel = null) {
  const def = LANTERN_BY_TIER[tier] ?? LANTERNS[0];
  return {
    id: uid++,
    kind: 'lantern',           // items.js 의 장비와 구분하는 표식
    slot: 'lantern',
    tier: def.tier,
    name: def.name,
    icon: def.icon,
    rarity: def.rarityLike,    // 드랍 광기둥 색을 등급 체계와 맞춘다
    fuel: fuel == null ? def.fuelMax : fuel,
    def,
  };
}

/** 층·티어에 따라 어떤 랜턴이 나올지 */
export function rollLantern(rnd, floorNo, farmTier) {
  const luck = rnd() + floorNo * 0.08 + farmTier * 0.1;
  const tier = luck > 1.35 ? 2 : luck > 0.78 ? 1 : 0;
  return makeLantern(tier);
}

/** 적 종류별 드랍 확률 (기획안 §1-4) */
export function lanternDropChance(enemyKey, isBoss, isElite) {
  if (isBoss) return 1;
  if (isElite) return 0.22;
  if (enemyKey === 'archer') return 0.09;   // 등불을 들고 다니는 종족이라는 설정
  return 0.04;
}

/**
 * 지금 들고 있는 랜턴이 만드는 빛. 없으면 기본 등불.
 * @returns {{radius:number,intensity:number,color:number|null}}
 */
export function lightOf(lantern) {
  if (!lantern || lantern.fuel <= 0) return { ...BASE_LIGHT, color: null };
  return { radius: lantern.def.radius, intensity: lantern.def.intensity, color: lantern.def.color };
}

/**
 * 랜턴을 주웠을 때. 더 좋은 것이면 바꿔 들고, 같거나 못한 것이면 **연료로 쓴다**.
 * 랜턴이 계속 쌓이면 관리가 귀찮아지기만 한다 — 여분은 기름으로 취급한다.
 * @returns {{action:'equip'|'swap'|'fuel', gained:number}}
 */
export function acquire(player, lantern) {
  const cur = player.lantern;
  if (!cur || cur.fuel <= 0) {
    player.lantern = lantern;
    return { action: 'equip', gained: lantern.fuel };
  }
  if (lantern.tier > cur.tier) {
    player.lantern = lantern;
    return { action: 'swap', gained: lantern.fuel };
  }
  const add = Math.round(lantern.def.fuelMax * 0.6);
  const before = cur.fuel;
  cur.fuel = Math.min(cur.def.fuelMax, cur.fuel + add);
  return { action: 'fuel', gained: Math.round(cur.fuel - before) };
}
