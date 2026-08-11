// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **부위와 등급** — 파밍이 「더 강한 것」이 된다 (v107). 숫자만.
//
//  ★ 사장님 (2026-08-11)
//    「파밍은 **더 강한 무기, 더 강한 파츠, 더 강한 장갑, 보급품, 식량**을 얻을 거야」
//    「**i창을 통해 비행기 모양이 모이고 각 부분 별 파츠를 볼 수 있게** 하자.
//      파츠도 파밍, 혹은 **재료로 개조, 제작**이 가능하게」
//    그리고 「개수를 없애고 부위 장착으로 갈아엎을까요」에 **「가」**.
//
//  ══ 재 보니 「**더 강한**」이 아예 없었다 ═════════════════════════════
//
//  파밍으로 나오는 것이 열여섯인데 그중 **열둘이 수리·생존용**이었고,
//  사장님이 말씀하신 무기·장갑은 `weapon`·`armor` **둘뿐**이었다.
//  게다가 둘 다 **개수**만 있었다:
//
//      m += 0.9 · pow(loot.weapon, 0.62) + 0.7 · pow(loot.armor, 0.62)
//
//  즉 파밍이 「**더 강한 무기**」가 아니라 「**무기 몇 개**」였다.
//  등급도, 부위도, 장착도 없었다. 「파츠」라는 개념 자체가 없었다.
//
//  ══ ★★★ 그래서 **개수를 버리고 부위에 단다** (사장님 「가」) ══════════
//
//  개수를 남기고 등급을 얹으면 **두 곳에서 재게** 되고, 이 저장소가 제일
//  자주 갈라지는 자리가 정확히 그것이다 (v98 의 자리 넷 · v103 의 줄
//  다섯). 그래서 `loot.weapon`·`loot.armor` 는 **죽는다.**
//
//  ★ three.js 를 안 쓴다 — `tools/space-parts.js` 가 읽는다.
// ══════════════════════════════════════════════════════════════════════════

/**
 * ★★★ **부위 일곱** — 기체를 이렇게 나눈다.
 *
 *   ★ 일곱인 것은 이 저장소의 오랜 규약이다 (방 일곱 · 가르침 일곱).
 *     사람이 한 화면에서 붙들 수 있는 수이고, 여덟째를 넣고 싶으면
 *     하나를 접는다.
 *   ★★ **부위마다 이미 게임에 있는 값에 붙는다.** 새 값을 안 만든다 —
 *     `mult` 가 곱해질 자리를 `feeds` 로 적어 두었고, 도구가 그것이
 *     정말 있는지 본다. 없는 것을 가리키면 빨개진다
 */
export const SLOTS = [
  { key: 'gun', name: '주포', feeds: 'WEAPONS.laser.dmg', what: '레이저 한 발의 무게' },
  { key: 'tube', name: '발사관', feeds: 'MOUNT.cone', what: '짐벌이 도는 각 — 넓을수록 회피하며 문다' },
  { key: 'armor', name: '장갑', feeds: 'HITS.hull', what: '맞을 때 덜 닳는다' },
  { key: 'engine', name: '엔진', feeds: 'AXES.*.rate', what: '기수가 도는 속도 · 급기동' },
  { key: 'sensor', name: '센서', feeds: 'RADAR.reach', what: '레이더가 보는 거리 · 락온이 빨라진다' },
  { key: 'sink', name: '열 저장고', feeds: 'SINK.cap', what: '열을 얼마나 담나 — 오래 쏜다' },
  { key: 'hold', name: '화물칸', feeds: 'CARGO.hold', what: '얼마나 싣나 — 많이 줍는다' },
];

export const SLOT_BY = Object.fromEntries(SLOTS.map((s) => [s.key, s]));

/**
 * ★★★ **등급 다섯.**
 *
 *   ★ 던전 쪽 `item-table.js` 가 이미 등급·접사·롤을 갖고 있지만
 *     **그대로 안 가져온다** — 저기는 「수백 번 굴리는 전리품」이고
 *     여기는 **부위 일곱에 하나씩**이다. 굴릴 것이 없으므로 접사도 없다.
 *   ★★ 배수가 **1 에서 시작한다.** 「낡은 것」이 0.8 이면 시작하자마자
 *     손해 보는 기분이고, 그건 파밍의 출발점으로 나쁘다 —
 *     **오르기만 하는 것**이 파밍의 맛이다
 */
export const TIERS = [
  { key: 'stock', name: '표준', mult: 1.00, tone: 'dim', find: 0.42 },
  { key: 'field', name: '야전 개수', mult: 1.18, tone: 'ok', find: 0.30 },
  { key: 'loot', name: '노획품', mult: 1.40, tone: 'good', find: 0.18 },
  { key: 'proto', name: '시제품', mult: 1.68, tone: 'hot', find: 0.08 },
  { key: 'ace', name: '격추왕의 것', mult: 2.05, tone: 'ace', find: 0.02 },
];

export const TIER_BY = Object.fromEntries(TIERS.map((t) => [t.key, t]));
/** 등급이 몇 번째인가 (0 이 표준) */
export const tierIdx = (k) => TIERS.findIndex((t) => t.key === k);

/**
 * ★★ **개조** — 같은 부위의 파츠를 태워 한 등급 올린다.
 *
 *   ★ 재료가 **두 가지**다: 같은 부위의 여분 파츠 + 광석.
 *     여분만 쓰면 「많이 주우면 끝」이고, 광석만 쓰면 「어느 부위든 상관
 *     없다」가 된다. 둘을 다 쓰게 해야 **무엇을 주울지**가 생긴다
 */
export const UPGRADE = {
  /** 한 등급 올리는 데 태우는 **같은 부위 여분** 개수 */
  spare: 2,
  /** 그리고 광석 — 등급이 오를수록 많이 든다 (아래 `oreFor`) */
  oreBase: 26,
  oreStep: 1.9,
  /** 올릴 수 있는 끝 — 「격추왕의 것」은 **주워야만** 나온다 */
  maxTier: 'proto',
};

/** 이 등급에서 다음으로 올리는 데 드는 광석 */
export const oreFor = (fromKey) =>
  Math.round(UPGRADE.oreBase * (UPGRADE.oreStep ** Math.max(0, tierIdx(fromKey))));

/**
 * ★★ **제작** — 재료로 없는 부위를 새로 만든다.
 *   ★ 등급은 늘 **표준**이다. 만들어서 시제품이 나오면 주울 이유가 없어진다
 */
export const CRAFT = { ore: 40, parts: 3, tier: 'stock' };

/** 파츠 하나 */
export const makePart = (slot, tier = 'stock') => ({ slot, tier });

/** 그 파츠의 배수 */
export const multOf = (p) => (p ? (TIER_BY[p.tier]?.mult ?? 1) : 0);

/** 사람이 읽는 이름 — 「노획품 발사관」 */
export const partName = (p) =>
  (p ? `${TIER_BY[p.tier]?.name ?? '?'} ${SLOT_BY[p.slot]?.name ?? '?'}` : '비어 있음');

/**
 * ★★★ **전투력** — 개수가 아니라 **달린 것**으로 낸다.
 *
 *   ★ `might-table.js MINE.loot`(개수의 거듭제곱)를 **대신한다.**
 *     둘을 같이 두면 두 곳에서 재게 되고, 그러면 반드시 갈라진다.
 *   ★★ 부위마다 무게가 다르다 — 주포·장갑이 제일 크고 화물칸이 제일
 *     작다. 화물칸은 **싸움에 안 쓰이지만** 파밍에는 쓰이므로 0 이 아니다
 */
export const WEIGHT = {
  gun: 3.4, tube: 2.8, armor: 3.0, engine: 2.2, sensor: 1.8, sink: 1.4, hold: 0.6,
};

export function partsMight(fit = {}) {
  let m = 0;
  for (const s of SLOTS) m += (WEIGHT[s.key] ?? 1) * multOf(fit[s.key]);
  return +m.toFixed(2);
}

/** 다 표준일 때의 전투력 — 「올랐나」를 견주는 바닥 */
export const BASE_MIGHT = partsMight(
  Object.fromEntries(SLOTS.map((s) => [s.key, makePart(s.key, 'stock')])),
);

export const PWHY = {
  slot: '그 자리에 달 것이 없습니다',
  spare: `여분이 모자랍니다 — 같은 부위 ${UPGRADE.spare}개가 필요합니다`,
  ore: '광석이 모자랍니다',
  parts: '부품이 모자랍니다',
  max: '더 올릴 수 없습니다 — 그 위는 주워야 나옵니다',
  same: '이미 달려 있습니다',
};
