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
 * @returns 'on' | 'off' | null   (한 순간에 하나만)
 * ★ v136 — `'dry'` 는 **없앴다.** 추진제는 이제 급가속을 안 막는다
 */
export function stepBoost(b, dt, { on = false, fuel = 100 } = {}) {
  const was = b.k;
  b.fuel = 0; b.heat = 0;
  // ══ ★★★ v136 — **추진제가 급가속을 막지 않는다** ═════════════════════
  //
  //  ★ 사장님 (2026-08-13) 「**추진제가 없다고 가속이 안되잔아.
  //    스테미나 형식으로 변경하라고 했지?**」
  //
  //  ★★★ 맞는 말씀이고, v133 이 **절반만** 고친 자리다. 그때 여력(스태미나)을
  //    만들어 `drive-table.js` 에 넣었는데, **옛 문지기를 안 걷어냈다** —
  //    여기 `fuel > BOOST.minFuel` 이 그대로 남아서 문이 **둘**이 됐다.
  //    그래서 여력이 가득해도 추진제가 6 아래면 「추진제가 모자라 못
  //    밀어붙입니다」가 떴다. **새 계통을 얹으면서 옛 계통을 안 걷어내는
  //    것**이 이 저장소가 제일 자주 밟는 함정이고, 이번에도 그랬다.
  //
  //  ★★ 이제 문은 **여력 하나**다 (`drive-table.js stepDrive` 가 지킨다).
  //    추진제는 **여전히 준다** — v62 가 세운 10분 시계는 안 죽인다.
  //    다만 **막지는 않는다**: 바닥이면 태울 것이 없어 그냥 0 이 나갈 뿐이다.
  //  ★ 「없으면 못 한다」와 「없으면 안 준다」는 다르다. 앞은 문이고 뒤는 값이다
  const canPush = on;

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
