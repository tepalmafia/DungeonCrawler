// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **무기마다 따로 · 비율로 시작 · 파밍으로 채운다** — 뼈대 (v133).
//
//  ★ 사장님 (2026-08-13) 「**레이저는 무한으로 다른 무기들도 일정 비율로
//    가지고 시작하고, 파밍을 통해서 적절히 구할 수 있도록 해줘**」
//
//  ══ 재 보니 **절반은 이미 되어 있었다** ═══════════════════════════════
//
//  · **레이저는 이미 무한**이다 — 탄약 칸이 없고 대신 **열**이 오른다
//    (`combat-table.js WEAPONS.laser`). 그건 그대로 둔다
//  · 미사일도 **8발 중 4발**로 시작하고 있었다 (`MISSILES.start`)
//
//  ★★★ 그런데 **한 통이었다.** 열추적탄과 유도탄이 같은 `missiles` 를
//    나눠 썼다. 그러면 무기가 셋이 아니라 **둘**이다 — 「가까운 것을 쏠까
//    먼 것을 쏠까」가 아니라 「지금 뭘 쏘든 같은 통이 준다」가 되고,
//    사장님이 말씀하신 「**다른 무기들도**」의 「들」이 성립하지 않는다.
//
//  ★★ 그래서 **무기마다 제 통**을 준다. 그러면 저절로 생기는 것:
//    · 유도탄을 아끼면 **열추적탄으로 붙어야** 한다 (거리가 결심이 된다)
//    · 파밍이 **무엇을 줬나**가 다음 싸움의 방식을 정한다
//
//  ══ ★ 비율로 적는 까닭 ════════════════════════════════════════════════
//
//  「4발로 시작」이 아니라 「**최대치의 절반**」으로 적는다. 최대치는
//  파츠(`parts-table.js`)로 늘 수 있고, 그때 시작 개수를 손으로 안 고쳐도
//  따라오게 하려는 것이다 — 「두 곳에 적으면 갈라진다」의 그 자리다.
//
//  ★ three.js 를 안 쓴다 — `tools/space-ammo.js` 가 읽는다.
// ══════════════════════════════════════════════════════════════════════════
import { WEAPON_LIST, inEnvelope } from './combat-table.js';

/**
 * ★★★ **무기마다의 통.**
 *
 *  @property max     가득 찼을 때 몇 발
 *  @property startAt 시작할 때 **최대치의 몇 할** (0~1) — 개수가 아니라 비율
 *  @property farm    파밍에서 나오는 것 — `w` 는 뽑기 무게, `n` 은 한 번에 몇 발
 *  @property why     이 무기를 왜 아끼게 되나
 */
export const AMMO = {
  laser: {
    infinite: true,
    why: '탄약이 없다 — 대신 **뜨거워진다.** 아끼는 것은 발수가 아니라 열이다',
  },
  ir: {
    max: 6, startAt: 0.5, farm: { w: 3, n: 2 },
    why: '가깝고 잘 놓친다 — 흔하게 주워지고 흔하게 쓴다',
  },
  arh: {
    max: 4, startAt: 0.5, farm: { w: 1, n: 1 },
    why: '멀리 가고 잘 맞는다 — 드물게 주워지므로 **언제 쓸지**가 결심이다',
  },
};

/** 유한한 무기들 (레이저 뺀) — 검사와 화면이 같은 것을 센다 */
export const FINITE = Object.keys(AMMO).filter((k) => !AMMO[k].infinite);

/** 이 무기를 몇 발 들고 시작하나 — **비율에서 낸다** */
export const startOf = (key) => (AMMO[key]?.infinite
  ? Infinity
  : Math.round((AMMO[key]?.max ?? 0) * (AMMO[key]?.startAt ?? 0)));

/** 처음 재고 — `{ ir: 3, arh: 2 }` */
export const makeAmmo = () => Object.fromEntries(FINITE.map((k) => [k, startOf(k)]));

/** 이 무기를 쏠 수 있나 (레이저는 늘 참) */
export const canFire = (ammo, key) =>
  (AMMO[key]?.infinite ? true : (ammo?.[key] ?? 0) > 0);

/** 한 발 쓴다 — @returns 정말 썼나 */
export function spend(ammo, key) {
  if (AMMO[key]?.infinite) return true;
  if (!canFire(ammo, key)) return false;
  ammo[key] -= 1;
  return true;
}

/** 넣는다 — 넘치면 버린다. @returns 정말 들어간 발수 */
export function gain(ammo, key, n = 1) {
  const a = AMMO[key];
  if (!a || a.infinite) return 0;
  const was = ammo[key] ?? 0;
  ammo[key] = Math.min(a.max, was + n);
  return ammo[key] - was;
}

/**
 * ★★★ **파밍이 무엇을 주나** — 무게로 뽑는다.
 *
 *   ★ 유도탄이 드물어야 「언제 쓸지」가 결심이 된다. 열추적탄이 흔해야
 *     붙어서 싸우는 길이 늘 열려 있다 — 둘 다 흔하면 고를 것이 없고,
 *     둘 다 드물면 레이저만 쓰는 게임이 된다
 *
 * @param r 0~1 짜리 값 하나 (씨앗에서 뽑아 넘긴다 — `Math.random` 을 안 쓴다)
 */
export function farmRoll(r = 0.5) {
  const tot = FINITE.reduce((s, k) => s + AMMO[k].farm.w, 0);
  let x = Math.max(0, Math.min(0.999999, r)) * tot;
  for (const k of FINITE) {
    x -= AMMO[k].farm.w;
    if (x < 0) return { key: k, n: AMMO[k].farm.n };
  }
  return { key: FINITE[FINITE.length - 1], n: 1 };
}

/** 계기가 읽는 한 줄 — 「레이저 ∞ · 열추적 3/6 · 유도 2/4」 */
export const ammoWord = (ammo) => WEAPON_LIST
  .map((w) => (AMMO[w.key]?.infinite
    ? `${w.name} ∞`
    : `${w.name} ${ammo?.[w.key] ?? 0}/${AMMO[w.key]?.max ?? 0}`))
  .join(' · ');

/** 검사와 화면이 읽는다 */
export const summary = (ammo) => ({
  ...ammo,
  word: ammoWord(ammo),
  full: FINITE.every((k) => (ammo?.[k] ?? 0) >= AMMO[k].max),
  dry: FINITE.every((k) => (ammo?.[k] ?? 0) <= 0),
});

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **어느 무기가 닿나** (v133 · 사장님 「공격이 안되는 이유는?」)
//
//  ★ 138m 에서 레이저를 쏘시고 「너무 멉니다」를 보셨다. 맞는 말이지만
//    **어느 무기가 닿는지는 안 알려 줬다** — 사거리를 외우고 있어야만
//    알 수 있는 상태였고, 그건 「뭘 어떻게 고르라는거야」와 같은 병이다.
//  ★★ 「안 된다」까지만 말하는 안내는 안내가 아니다. **다음 손**을 말해야 한다
// ══════════════════════════════════════════════════════════════════════════

/** 이 거리에 닿는 무기들 (재고가 있는 것만) */
export const reachAt = (dist, ammo = null) => WEAPON_LIST.filter((w) =>
  inEnvelope(w, dist) && (ammo === null || canFire(ammo, w.key)));

/**
 * ★★★ **못 쏠 때 붙이는 한 마디** — 「너무 멉니다 **— 3번 유도탄이 닿습니다**」
 *   ★ 닿는 것이 없으면 **거리를 말한다.** 「없다」로 끝내면 또 막다른 길이다
 */
export function reachWord(dist, ammo = null) {
  const hit = reachAt(dist, ammo);
  if (hit.length) return `${hit.map((w) => `${w.slot}번 ${w.name}`).join(' · ')} 이(가) 닿습니다`;
  // ★★★ **닿는 것이 없으면 「얼마나 붙어야 하나」를 말한다.**
  //   ★ 처음에 「제일 먼 무기」로 쟀다가 **유도탄이 떨어졌을 때** 「더
  //     떨어져야 합니다」라는 거짓말이 나왔다 (재서 잡았다) — 없는 무기의
  //     사거리로 재고 있었던 것이다. **지금 쏠 수 있는 것**으로만 잰다
  const have = WEAPON_LIST.filter((w) => ammo === null || canFire(ammo, w.key));
  const far = have.reduce((b, w) => (w.rMax > (b?.rMax ?? 0) ? w : b), null);
  if (!far) return '쏠 것이 없습니다';
  if (dist > far.rMax) return `${Math.round(dist - far.rMax)}m 더 붙어야 합니다`;
  const nearW = have.reduce((b, w) => (w.rMin < (b?.rMin ?? 1e9) ? w : b), null);
  return `${Math.round(nearW.rMin - dist)}m 더 떨어져야 합니다`;
}


// ══════════════════════════════════════════════════════════════════════════
//  ★★★ v141 — **기본은 무한, 좋은 것은 재료를 먹는다** (사장님 지시)
//
//  ★ 사장님 (2026-08-13) 「**기본 탄약은 무한대로** 하고, 더 좋은 무기는
//    **파츠를 구해서 업그레이드**하는 걸로 하자. 업그레이드한 무기는 쓸려면
//    **재료가 필요해서 재료가 떨어지면 기본 무기로 발사**되게」
//
//  ══ ★★★ 이 한 줄이 방금 찾은 버그를 **원천적으로 없앤다** ═══════════════
//
//  사장님이 「**락온해도 안되는 경우가 있어**」라고 하셨고, 재 보니 탄이
//  없을 때 `whyNotFire` 가 조용히 통과시켜 **아무 일도 안 나고 있었다.**
//  그런데 「떨어지면 기본 무기로 나간다」로 두면 **불발이라는 상태 자체가
//  사라진다** — 방아쇠를 당기면 **언제나 무언가 나간다.**
//
//  ★★ 이것이 「안 된다」를 없애는 옳은 방법이다. v133 에 「어느 무기가
//    닿는지 말한다」로 **말**을 고쳤는데, 이번엔 **말할 일이 없게** 만든다.
// ══════════════════════════════════════════════════════════════════════════

/** ★★★ **기본 무기** — 늘 나간다. 이것이 있어서 「못 쏨」이 없다 */
export const BASE = 'laser';

/**
 * ★★★ **방아쇠를 당기면 실제로 무엇이 나가나.**
 *
 *   ★ 고른 무기를 쏠 수 있으면 그것, 재료가 떨어졌으면 **기본 무기**.
 *     `null` 은 안 돌려준다 — **언제나 무언가 나간다**는 것이 이 규칙의 전부다.
 *
 * @returns { key, fell } — `fell` 이 참이면 **기본으로 떨어진 것**이다
 */
export function firedKey(wantKey, ammo) {
  if (canFire(ammo, wantKey)) return { key: wantKey, fell: false };
  return { key: BASE, fell: true };
}

/** 떨어졌을 때 화면이 하는 말 — **왜 다른 게 나갔는지** 말해야 한다 */
export const fellWord = (wantName, baseName = '레이저') =>
  `${wantName} 이(가) 떨어져 ${baseName} 로 나갑니다`;
