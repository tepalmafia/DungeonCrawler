// ══════════════════════════════════════════════════════════════════════════
//  스로틀 — **순수 규칙.** 숫자는 `throttle-table.js` 에 있다 (v101).
//
//  ★ three.js 도 DOM 도 안 쓴다. `tools/space-throttle.js` 가 브라우저
//    없이 돌려 본다 — **게임에 붙이기 전에** 맞는지 본다.
// ══════════════════════════════════════════════════════════════════════════
import { THROTTLE, isFwd, isBack, legMult } from './throttle-table.js';

export const makeThrottle = () => ({
  /** −0.45 ~ 1. 0 이 타성 */
  v: 0,
  /** 이번 회차에 역추진으로 보낸 초 — 끝 화면과 검사가 읽는다 */
  backSec: 0,
});

/**
 * 한 프레임.
 * @param up   W 를 누르고 있나
 * @param down S 를 누르고 있나
 * @param dry  추진제가 바닥났나 — **그러면 못 민다**
 */
export function stepThrottle(t, dt, { up = false, down = false, dry = false } = {}) {
  if (dry) {
    // ★ 추진제가 없으면 **스로틀이 안 먹는다.** 다만 값을 0 으로 홱
    //   내리지는 않는다 — 관성은 그대로 가는 것이 맞다
    t.v = Math.max(0, Math.min(t.v, 0));
  } else if (up && !down) {
    t.v = Math.min(THROTTLE.max, t.v + THROTTLE.rate * dt);
  } else if (down && !up) {
    t.v = Math.max(THROTTLE.min, t.v - THROTTLE.rate * dt);
  }
  // ★ 놓아도 **안 돌아온다** (`selfCenter` false · v55 규약)
  if (isBack(t.v)) t.backSec += dt;
  return t.v;
}

/** 항로가 나아가는 배수 */
export const legOf = (t, coast) => legMult(t.v, coast);
/** 이번 프레임에 태우는 추진제 배수 — 뒤로 갈 때 더 든다 */
export const fuelMult = (t) => (isBack(t.v) ? Math.abs(t.v) * THROTTLE.backFuel
  : Math.max(0, t.v));
/** 이번 프레임에 오르는 열 (역추진 몫) */
export const backHeat = (t, dt) => (isBack(t.v) ? THROTTLE.backHeat * Math.abs(t.v) * dt : 0);
/** 적과 벌어지는 속도 (m/초) — 앞으로 갈 때는 0 */
export const awayOf = (t) => (isBack(t.v) ? THROTTLE.backAway * Math.abs(t.v) / 0.45 : 0);

/** 검사와 화면이 읽는다 */
export function summary(t) {
  return {
    v: +t.v.toFixed(2),
    fwd: isFwd(t.v), back: isBack(t.v),
    backSec: +t.backSec.toFixed(1),
  };
}
