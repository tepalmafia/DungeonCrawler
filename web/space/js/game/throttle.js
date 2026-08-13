// ══════════════════════════════════════════════════════════════════════════
//  스로틀 — **순수 규칙.** 숫자는 `throttle-table.js` 에 있다 (v101).
//
//  ★ three.js 도 DOM 도 안 쓴다. `tools/space-throttle.js` 가 브라우저
//    없이 돌려 본다 — **게임에 붙이기 전에** 맞는지 본다.
// ══════════════════════════════════════════════════════════════════════════
import { THROTTLE, isFwd, isBack, legMult } from './throttle-table.js';
// ★ v133 — 기본 순항값은 `drive-table.js` 가 안다 (여기서 또 안 적는다)
import { DRIVE } from './drive-table.js';

export const makeThrottle = () => ({
  /**
   * −0.45 ~ 1.
   * ★★★ v133 — **시작이 0 이 아니라 순항이다** (`DRIVE.base` · 사장님
   *   「앞으로 이동은 기본 베이스로」). 이 게임의 목적 한 줄은 「뚫는다·
   *   채운다·떨군다」이고, 뚫는 것은 **가고 있는 것**이 전제다.
   *   0 이면 매 회차 첫 동작이 「출발」이 되고, 그건 여정이 아니라 시동이다.
   *   ★ 내리는 것도 뒤로 가는 것도 그대로다 — 바뀌는 것은 **가만히 있을 때**뿐
   */
  v: DRIVE.base,
  /** 이번 회차에 역추진으로 보낸 초 — 끝 화면과 검사가 읽는다 */
  backSec: 0,
});

/**
 * 한 프레임.
 * @param up   W 를 누르고 있나
 * @param down S 를 누르고 있나
 * @param dry  추진제가 바닥났나 — **그러면 못 민다**
 */
export function stepThrottle(t, dt, { up = false, down = false, dry = false, cap = 1 } = {}) {
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
  // ══ ★★★ v133 — **과열되면 최대 속도가 깎인다** (사장님 「엔진 과열이
  //   되서 속도가 느려진다는 컨셉으로」) ═════════════════════════════════
  //  ★ 얼마나 깎이는지는 `drive-table.js capOf` 하나가 안다 — 여기서
  //    다시 재면 「계기는 74%인데 배는 100%로 간다」가 난다.
  //  ★★ 뒤로 가는 것은 **안 깎는다.** 과열은 밀어붙이는 것을 막는 것이지
  //    물러나는 것을 막는 것이 아니다 (막으면 갇힌다)
  if (cap < 1 && t.v > cap) t.v = cap;
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
