// ══════════════════════════════════════════════════════════════════════════
//  보급 상태 — **three.js 를 안 쓴다.**
//
//  식량이 줄고, 지나가며 광석이 쌓이고, 윈치를 잡으면 많이 쌓이고,
//  거점에서 바꾼다. 규칙만 여기 있고 화면·소리는 밖에서 한다.
// ══════════════════════════════════════════════════════════════════════════
import { FOOD, PARTS, ORE, SCOOP, WINCH, TRADE, isShaky } from './supply-table.js';

export function makeSupply() {
  return {
    food: FOOD.start,
    parts: PARTS.start,
    ore: ORE.start,
    /** 이번에 잡고 있는 윈치가 얼마나 끌어왔나 — 「한 통」을 세려고 */
    hauled: 0,
    loads: 0,        // 이번 회차에 몇 통 캤나
    traded: 0,
  };
}

/**
 * 한 프레임 — 먹고, 지나가며 줍는다.
 * @param debris 지금 구역에 떠 있는 덩어리 수 (regions-table 의 debris)
 */
export function stepSupply(s, dt, { debris = 0 } = {}) {
  const was = isShaky(s.food);
  s.food = Math.max(0, s.food - FOOD.perSec * dt);
  // 줍기 — **멈추지 않아도 되고 자국도 안 는다.** 대신 변변찮다
  s.ore = Math.min(ORE.max, s.ore + debris * SCOOP.perDebris * dt);
  // 굶기 시작한 순간만 알린다. 매 프레임 알리면 경보가 소음이 된다
  return !was && isShaky(s.food) ? 'hungry' : null;
}

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

/** 거래 한 번 — 광석을 내고 식량과 부품을 받는다 */
export function trade(s) {
  if (!canTrade(s)) return false;
  s.ore -= TRADE.ore;
  s.food = Math.min(FOOD.max, s.food + TRADE.food);
  s.parts = Math.min(PARTS.max, s.parts + TRADE.parts);
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
