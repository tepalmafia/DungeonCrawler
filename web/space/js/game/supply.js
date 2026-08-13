// ══════════════════════════════════════════════════════════════════════════
//  보급 상태 — **three.js 를 안 쓴다.**
//
//  식량이 줄고, 지나가며 광석이 쌓이고, 윈치를 잡으면 많이 쌓이고,
//  거점에서 바꾼다. 규칙만 여기 있고 화면·소리는 밖에서 한다.
// ══════════════════════════════════════════════════════════════════════════
import { FOOD, PARTS, ORE, MISSILES, SCOOP, WINCH, TRADE, isShaky } from './supply-table.js';
import { FUEL, burnMult, isDry } from './fuel-table.js';
// ★ v133 — 무기마다의 통 (사장님 「다른 무기들도 일정 비율로」)
import { makeAmmo, farmRoll, gain as ammoGain } from './ammo-table.js';

export function makeSupply() {
  return {
    food: FOOD.start,
    parts: PARTS.start,
    ore: ORE.start,
    /** ★★ 미사일 — **제 주머니다** (v69). 부품과 갈라 놓았다 */
    missiles: MISSILES.start,
    // ★★★ v133 — **무기마다 제 통** (`ammo-table.js` · 사장님 「다른 무기들도
    //   일정 비율로 가지고 시작하고, 파밍을 통해서 적절히 구할 수 있도록」).
    //   ★ 위 `missiles` 는 **거래·저장 호환**으로 남긴다 — 지우면 이어한
    //     저장이 깨진다. 쏘는 것은 이제 아래 통에서 나간다
    ammo: makeAmmo(),
    /** ★ 추진제 — **밟는 동안만** 준다 (v62 · fuel-table.js) */
    fuel: FUEL.start,
    /** 이번에 잡고 있는 윈치가 얼마나 끌어왔나 — 「한 통」을 세려고 */
    hauled: 0,
    loads: 0,        // 이번 회차에 몇 통 캤나
    traded: 0,
  };
}

/**
 * 한 프레임 — 먹고, 지나가며 줍고, **밟는 동안 태운다.**
 *
 * @param debris 지금 구역에 떠 있는 덩어리 수 (regions-table 의 debris)
 * @param thrust ★ 추진을 켜고 있나 — **켠 동안만** 추진제가 준다 (v62)
 * @param region 지금 구역 열쇠 — 빠른 길이 더 태운다 (`burnMult`)
 * @returns 'hungry' | 'dry' | 'lowFuel' | null   (한 순간에 하나만)
 */
export function stepSupply(s, dt, { debris = 0, thrust = false, region = 'empty' } = {}) {
  const was = isShaky(s.food);
  s.food = Math.max(0, s.food - FOOD.perSec * dt);
  // 줍기 — **멈추지 않아도 되고 자국도 안 는다.** 대신 변변찮다
  s.ore = Math.min(ORE.max, s.ore + debris * SCOOP.perDebris * dt);

  // ★ 추진제 — 밟는 동안만. **아끼려고 계속 끄고 있으면 압박이 쌓인다**
  //   (route-table LEG.coast). 양쪽이 다 손해라야 고르는 것이 된다
  let fuelEv = null;
  if (thrust && s.fuel > 0) {
    const wasLow = s.fuel <= FUEL.low;
    s.fuel = Math.max(0, s.fuel - FUEL.perSec * burnMult(region) * dt);
    if (s.fuel <= 0) fuelEv = 'dry';
    else if (!wasLow && s.fuel <= FUEL.low) fuelEv = 'lowFuel';
  }

  // 굶기 시작한 순간만 알린다. 매 프레임 알리면 경보가 소음이 된다
  if (!was && isShaky(s.food)) return 'hungry';
  return fuelEv;
}

/** ★ 지금 추진을 걸 수 있나 — 바닥나면 못 건다 */
export const canThrust = (s) => !isDry(s.fuel);

/**
 * 윈치를 잡고 있다 — **멈춰서 끌어온다.**
 * @returns 'load' | null  (한 통을 채웠나)
 */
export function winchStep(s, dt) {
  s.ore = Math.min(ORE.max, s.ore + WINCH.perSec * dt);
  s.hauled += WINCH.perSec * dt;
  if (s.hauled < WINCH.load) return null;
  s.hauled -= WINCH.load;
  s.loads++;
  return 'load';
}

/** 윈치를 놓았다 — 통은 안 비운다. 다음에 이어서 채운다 */
export function winchRelease(s) { /* 지금은 아무것도 안 한다. 자리를 남겨 둔다 */ }

/** 지금 거래할 수 있나 */
export function canTrade(s) { return s.ore >= TRADE.ore; }

/**
 * ★★ **미사일을 살 수 있나** (v69).
 *   식량보다 비싸다 — 「이번엔 굶고 쏠까」가 결심이 되려면 그래야 한다
 */
export function canBuyMissiles(s) {
  return s.ore >= TRADE.missileOre && s.missiles < MISSILES.max;
}

/** 미사일을 산다 — 광석을 내고 `MISSILES.perBuy` 발 */
export function buyMissiles(s) {
  if (!canBuyMissiles(s)) return false;
  s.ore -= TRADE.missileOre;
  s.missiles = Math.min(MISSILES.max, s.missiles + MISSILES.perBuy);
  return true;
}

/**
 * ★ **주워 온다** — 표류선·구조 신호에서. 사는 것보다 많다 (`perSalvage`).
 *   위험한 데를 뒤진 값이 커야 「가는 것이 진짜 선택」이 된다
 */
export function salvageMissiles(s, n = MISSILES.perSalvage, r = 0.5) {
  const before = s.missiles;
  s.missiles = Math.min(MISSILES.max, s.missiles + n);
  // ══ ★★★ v133 — **파밍이 무기별 통에도 넣는다** ═══════════════════════
  //  ★ 사장님 「**파밍을 통해서 적절히 구할 수 있도록** 해줘」
  //  ★★ 무엇이 나오나는 `ammo-table.js farmRoll` 이 정한다 — 열추적탄이
  //    흔하고 유도탄이 드물다. 여기서 무게를 다시 적으면 두 곳이 된다.
  //  ★ `Math.random` 을 안 쓴다 — 부르는 쪽이 씨앗에서 뽑아 넘긴다
  //    (같은 자리를 다시 뒤졌을 때 다른 것이 나오면 그건 저장이 아니다)
  if (s.ammo) {
    const got = farmRoll(r);
    ammoGain(s.ammo, got.key, got.n);
  }
  return s.missiles - before;
}

/** 거래 한 번 — 광석을 내고 식량·부품·**추진제**를 받는다 (v62) */
export function trade(s) {
  if (!canTrade(s)) return false;
  s.ore -= TRADE.ore;
  s.food = Math.min(FOOD.max, s.food + TRADE.food);
  s.parts = Math.min(PARTS.max, s.parts + TRADE.parts);
  s.fuel = Math.min(FUEL.max, s.fuel + FUEL.perTrade);
  s.traded++;
  return true;
}

/** 고치는 데 부품이 드나 · 있나 */
export function canRepair(s, need = 0) { return s.parts >= need; }
export function spendParts(s, need = 0) { s.parts = Math.max(0, s.parts - need); }

/** 굶어서 손이 떨리나 */
export function shaky(s) { return isShaky(s.food); }

/** 지금 수리가 미끄러지는 배수 — 굶으면 잡고 있어도 되돌아간다 */
export function slipMult(s) { return shaky(s) ? FOOD.slipMult : 1; }

/**
 * 이 식량으로 몇 구간을 갈 수 있나 — 온실 계기가 이걸 보여준다.
 * **「다음 거점까지 갈 식량이 있나」가 이 게임의 질문이다** (PLAN §5-1).
 */
export function legsLeftOnFood(s, legSeconds) {
  return s.food / FOOD.perSec / legSeconds;
}
