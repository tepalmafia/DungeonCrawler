// ══════════════════════════════════════════════════════════════════════════
//  우주복 — **규칙.** 숫자는 `suit-table.js` 가 갖는다.
//
//  ★ 상태가 넷뿐이다 — **입었나 · 입는 중 · 벗는 중 · 남은 공기.**
//    생명유지를 계통으로 만들지 않는다. §7 이 「시계는 열·추진제·식량
//    셋으로 끝」이라고 못박아 뒀고, 우주복은 **넷째 시계가 아니라
//    에어록 문의 조건**이다. 조건 하나로 두는 것이 그 약속을 지키는 방법이다.
//
//  ★ three.js 를 안 쓴다 — tools/space-suit.js 가 브라우저 없이 읽는다.
// ══════════════════════════════════════════════════════════════════════════
import { SUIT } from './suit-table.js';

export function makeSuit() {
  return {
    /** 입고 있나 */
    on: false,
    /** 입는 중 — 남은 초 (잡고 있어야 준다) */
    wearing: 0,
    /** 벗는 중 — 남은 초 */
    doffing: 0,
    /** 등에 진 공기 (초) */
    air: SUIT.air,
    /** 진공에 있었던 시간 — 검사가 「쓰이나」를 묻는다 */
    evaT: 0,
    /** 공기가 바닥나 배가 끌어들인 횟수 */
    ranOut: 0,
  };
}

/**
 * 걸이를 잡고 있다 / 놓았다.
 *
 * ★ **놓으면 되돌아간다.** 수리와 같은 규약이다 — 그래야 22초가
 *   「기다리기」가 아니라 「붙들고 있기」가 된다.
 *
 * @returns 'wore' | 'doffed' | null
 */
export function stepWear(s, dt, { hold = false } = {}) {
  if (!hold) {
    // 되돌아간다. 되돌아가는 쪽이 조금 빠르다 — 벌은 시간이지 좌절이 아니다
    s.wearing = Math.max(0, s.wearing - dt * 1.6);
    s.doffing = Math.max(0, s.doffing - dt * 1.6);
    return null;
  }
  if (!s.on) {
    s.wearing += dt;
    if (s.wearing >= SUIT.wearFor) { s.on = true; s.wearing = 0; return 'wore'; }
  } else {
    s.doffing += dt;
    if (s.doffing >= SUIT.takeOff) { s.on = false; s.doffing = 0; return 'doffed'; }
  }
  return null;
}

/**
 * 한 걸음.
 *
 * @param o.vacuum ★ 지금 진공에 있나 (바깥문이 열린 에어록 · 뚫린 방).
 *   진공이면 등에 진 공기가 준다. **아니면 배에서 채운다** — 입은 채로
 *   배 안을 돌아다니는 것은 공짜다. 벌은 공기가 아니라 **둔한 손**이다
 * @returns 'low' | 'out' | null
 */
export function stepSuit(s, dt, { vacuum = false } = {}) {
  if (!s.on) {
    // 벗어 두면 걸이에서 채워진다
    s.air = Math.min(SUIT.air, s.air + SUIT.refill * dt);
    return null;
  }
  if (!vacuum) {
    s.air = Math.min(SUIT.air, s.air + SUIT.refill * dt);
    return null;
  }
  const was = s.air;
  s.evaT += dt;
  s.air = Math.max(0, s.air - dt);
  if (s.air <= 0 && was > 0) { s.ranOut++; return 'out'; }
  if (s.air <= SUIT.low && was > SUIT.low) return 'low';
  return null;
}

/** ★ 진공에 나가도 되나 — 이 한 줄이 우주복이 하는 일 전부다 */
export const canEva = (s) => s.on && s.air > 0;

/** 손이 얼마나 더딘가 — 굶주림과 **곱해진다** (둘 다면 정말 못 한다) */
export const handMult = (s) => (s.on ? SUIT.handMult : 1);
/** 걸음이 얼마나 둔한가 */
export const moveMult = (s) => (s.on ? SUIT.moveMult : 1);

export const summary = (s) => ({
  on: s.on,
  wearing: +s.wearing.toFixed(2),
  doffing: +s.doffing.toFixed(2),
  air: +s.air.toFixed(1),
  min: +(s.air / 60).toFixed(2),
  eva: +s.evaT.toFixed(1),
  ranOut: s.ranOut,
  canEva: canEva(s),
});
