// ══════════════════════════════════════════════════════════════════════════
//  E 정전 — **규칙.** 숫자는 blackout-table.js 가 갖는다.
//
//  ★ three.js 도 DOM 도 안 쓴다 — tools/space-blackout.js 가 브라우저 없이
//    「어둠이 벌인가 · 되살릴 수 있나 · 오래 끌면 아픈가」를 잰다.
//
//  ★ 한 방향으로만 간다: none → out → resetting → back
//    되돌아가는 가지가 없다. 「올리다 놓으면 처음부터」로 만들면 그건
//    벌이 아니라 짜증이다 — 잡은 만큼은 남는다.
// ══════════════════════════════════════════════════════════════════════════
import { DARK, DSTEP } from './blackout-table.js';

export function makeDark() {
  return {
    step: DSTEP.NONE,
    /** 주 차단기를 올린 시간 */
    t: 0,
    /** 어둠 속에 있던 시간 — 끝 화면과 도구가 읽는다 */
    inDark: 0,
  };
}

/** 전력이 나간다 — 장면 E 의 「대응」 박자가 부른다 */
export function killPower(d) {
  if (d.step !== DSTEP.NONE) return false;
  d.step = DSTEP.OUT;
  d.t = 0;
  return true;
}

/** 지금 어두운가 — 조명·달리기·계기가 전부 이걸 본다 */
export const isDark = (d) => d.step === DSTEP.OUT || d.step === DSTEP.RESETTING;
/** 주 차단기가 손에 잡히나 */
export const canReset = (d) => isDark(d);
/** 얼마나 올렸나 (0~1) */
export const resetAt = (d) => Math.min(1, d.t / DARK.reset);
/** 이 장면이 끝났나 */
export const settled = (d) => d.step === DSTEP.BACK;

/**
 * 한 프레임.
 * @param hold 주 차단기를 잡고 있나
 * @returns 'back' | null
 */
export function stepDark(d, dt, hold) {
  if (!isDark(d)) return null;
  d.inDark += dt;
  if (hold) {
    d.step = DSTEP.RESETTING;
    d.t += dt;
    if (d.t >= DARK.reset) { d.step = DSTEP.BACK; return 'back'; }
  } else if (d.step === DSTEP.RESETTING) {
    // ★ 놓으면 **멈추되 안 되감긴다.** 처음부터 다시 시키면 그건 벌이
    //   아니라 짜증이고, 어둠 속에서 그건 「고장난 줄 알았다」가 된다
    d.step = DSTEP.OUT;
  }
  return null;
}

/** 화면에 뭐라고 쓸까 */
export function word(d) {
  if (d.step === DSTEP.OUT) return DARK.hit;
  if (d.step === DSTEP.RESETTING) return DARK.fixing;
  if (d.step === DSTEP.BACK) return DARK.back;
  return null;
}

/** 검사와 손목이 읽는 한 덩어리 */
export function summary(d) {
  return {
    step: d.step, dark: isDark(d),
    at: +resetAt(d).toFixed(3), inDark: +d.inDark.toFixed(1),
  };
}
