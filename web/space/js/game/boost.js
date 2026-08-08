// ══════════════════════════════════════════════════════════════════════════
//  급가속 — **순수 규칙.** 숫자는 `boost-table.js` 에 있다 (v73).
//
//  ★ three.js 도 DOM 도 안 쓴다 — `tools/space-boost.js` 가 브라우저 없이 읽는다.
// ══════════════════════════════════════════════════════════════════════════
import { BOOST, speedMult } from './boost-table.js';

export const makeBoost = () => ({
  /** 지금 얼마나 밀고 있나 0~1 */
  k: 0,
  /** 이번 프레임에 태운 추진제 · 오른 열 — `main.js` 가 빼 간다 */
  fuel: 0, heat: 0,
  /** 이번 회차에 밀고 있은 시간 (초) — 검사와 끝 화면이 읽는다 */
  used: 0,
  /** 추진제가 모자라 못 민 적이 있나 */
  starved: false,
});

/**
 * 한 걸음.
 *
 * @param on    급가속 키를 누르고 있나
 * @param fuel  지금 남은 추진제 — 모자라면 **안 걸린다**
 * @returns 'on' | 'off' | 'dry' | null   (한 순간에 하나만)
 */
export function stepBoost(b, dt, { on = false, fuel = 100 } = {}) {
  const was = b.k;
  b.fuel = 0; b.heat = 0;
  // ★ 마지막 한 방울까지 태우면 구간을 못 넘긴다 — 바닥을 남긴다
  const canPush = on && fuel > BOOST.minFuel;
  if (on && !canPush && was < 0.02) { b.starved = true; return 'dry'; }

  if (canPush) {
    b.k = Math.min(1, b.k + dt / BOOST.spin);
    b.used += dt;
    // ★★ 값 셋 — 추진제 · 열 · 자국. **다 이미 있는 축**이다
    b.fuel = BOOST.fuel * b.k * dt;
    b.heat = BOOST.heat * b.k * dt;
  } else {
    // ★ 놓으면 **서서히** 준다 — 관성으로 미끄러지는 것이 우주다.
    //   딱 끊기면 「브레이크를 밟았다」가 되고, 우주에 브레이크는 없다
    b.k = Math.max(0, b.k - dt / BOOST.fade);
  }
  if (was < 0.02 && b.k >= 0.02) return 'on';
  if (was >= 0.02 && b.k < 0.02) return 'off';
  return null;
}

/** 지금 순항 대비 몇 배로 가나 */
export const boostMult = (b) => speedMult(b.k);
/** 자국에 더할 값 */
export const boostSign = (b) => BOOST.sign * b.k;
/** 밀고 있나 (화면이 이걸로 갈린다) */
export const boosting = (b) => b.k >= 0.02;

export const summary = (b) => ({
  k: +b.k.toFixed(2),
  mult: +boostMult(b).toFixed(2),
  on: boosting(b),
  used: +b.used.toFixed(1),
  starved: b.starved,
});
