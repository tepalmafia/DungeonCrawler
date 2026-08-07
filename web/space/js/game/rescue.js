// ══════════════════════════════════════════════════════════════════════════
//  G 구조 신호 — **규칙.** 숫자는 rescue-table.js 가 갖는다.
//
//  ★ three.js 도 DOM 도 안 쓴다 — tools/space-rescue.js 가 브라우저 없이
//    「가는 것이 손해도 이득도 아닌가」를 잰다.
//
//  ★ 상태가 한 방향으로만 간다 — 되돌아가는 가지가 없다.
//      none → heard → answering → near → took
//                   ↘ missed        ↘ missed
//    되돌릴 수 있게 만들면 「무전을 껐다 켰다 하며 자국을 조절」할 수 있고,
//    그러면 벌이 벌이 아니게 된다. **한 번 켠 것은 되돌릴 수 없다.**
// ══════════════════════════════════════════════════════════════════════════
import { RESCUE, RSTEP } from './rescue-table.js';

export function makeRescue() {
  return {
    step: RSTEP.NONE,
    /** 응답한 시간 (초) */
    t: 0,
    /** 붙어 있어 준 시간 (초) — `waitFor` 를 넘으면 떠난다 */
    wait: 0,
    /** 받는 중인 시간 */
    took: 0,
    /** 받은 것 — 끝 화면과 배너가 읽는다 */
    got: { parts: 0, food: 0 },
  };
}

/** 신호가 온다 — 장면 G 의 「대응」 박자가 부른다 */
export function hearSignal(r) {
  if (r.step !== RSTEP.NONE) return false;
  r.step = RSTEP.HEARD;
  r.t = 0; r.wait = 0; r.took = 0;
  return true;
}

/** 무전기가 손에 잡히나 — 신호가 와 있고 아직 응답 중일 때만 */
export const canAnswer = (r) => r.step === RSTEP.HEARD || r.step === RSTEP.ANSWERING;
/** 지금 무전이 켜져 있나 — **자국이 오르는 조건** */
export const broadcasting = (r) => r.step === RSTEP.ANSWERING;
/** 구간을 멈춰 세우나 — 다가가는 중 */
export const holding = (r) => RESCUE.hold && r.step === RSTEP.ANSWERING;
/** 옆에 붙어 있나 — 바깥문을 열면 받는다 */
export const alongside = (r) => r.step === RSTEP.NEAR;
/** 이 장면이 끝났나 */
export const settled = (r) => r.step === RSTEP.TOOK || r.step === RSTEP.MISSED;

/** 얼마나 응답했나 (0~1) — 손목과 조준선이 읽는다 */
export const answerAt = (r) => Math.min(1, r.t / RESCUE.answer);

/**
 * 한 프레임.
 *
 * @param hold  무전기를 잡고 있나
 * @param opt.outerOpen 바깥문이 열려 있나 — 붙은 뒤 받는 조건
 * @returns 'answered' | 'took' | 'left' | 'passed' | null
 */
export function stepRescue(r, dt, hold, opt = {}) {
  if (r.step === RSTEP.HEARD) {
    if (hold) { r.step = RSTEP.ANSWERING; }
    return null;
  }
  if (r.step === RSTEP.ANSWERING) {
    // ★ **놓으면 되감기지 않는다.** 켠 만큼은 이미 나간 것이다 —
    //   껐다 켜며 자국을 조절하는 길을 막는다
    if (hold) r.t += dt;
    if (r.t >= RESCUE.answer) { r.step = RSTEP.NEAR; r.wait = 0; return 'answered'; }
    return null;
  }
  if (r.step === RSTEP.NEAR) {
    r.wait += dt;
    if (opt.outerOpen) {
      r.took += dt;
      if (r.took >= RESCUE.take) {
        r.step = RSTEP.TOOK;
        r.got = { ...RESCUE.gives };
        return 'took';
      }
    }
    // ★ 너무 오래 안 열면 떠난다. **떠나는 것도 결과다** — 조용히
    //   영원히 기다리면 장면이 안 끝나고, 안 끝나는 장면은 멈춘 게임이다
    if (r.wait >= RESCUE.waitFor) { r.step = RSTEP.MISSED; return 'left'; }
    return null;
  }
  return null;
}

/** 응답 안 한 채 장면이 끝났다 — 장면 시계가 다 됐을 때 밖에서 부른다 */
export function passSignal(r) {
  if (r.step === RSTEP.HEARD || r.step === RSTEP.ANSWERING) {
    r.step = RSTEP.MISSED;
    return true;
  }
  return false;
}

/** 지금 화면에 뭐라고 쓸까 */
export function word(r) {
  if (r.step === RSTEP.HEARD) return RESCUE.heard;
  if (r.step === RSTEP.ANSWERING) return RESCUE.answering;
  if (r.step === RSTEP.NEAR) return RESCUE.near;
  if (r.step === RSTEP.TOOK) return RESCUE.took;
  if (r.step === RSTEP.MISSED) return RESCUE.passed;
  return null;
}

/** 검사와 손목이 읽는 한 덩어리 */
export function summary(r) {
  return {
    step: r.step,
    at: +answerAt(r).toFixed(3),
    wait: +r.wait.toFixed(1),
    took: +r.took.toFixed(1),
    got: { ...r.got },
    broadcasting: broadcasting(r),
    holding: holding(r),
  };
}
