// ══════════════════════════════════════════════════════════════════════════
//  구역 — **지나가는 곳마다 창밖이 달라진다.**
//
//  ★ 왜 필요한가
//    「목적지 없이 항해한다」에서 항로를 고르는 것이 유일한 큰 선택이다
//    (docs/space/PLAN.md §7-2). 그런데 어디를 골라도 창밖이 똑같으면
//    고르는 의미가 없다 — **눈으로 달라야 선택이 된다.**
//
//    그리고 각 구역은 **좋은 점과 대가가 반대 방향**이다. 성운은 숨겨 주지만
//    느리고, 잔해밭은 캘 것이 많지만 부딪힌다. 이게 §7-2 의 표 그대로다.
//
//  ★ three.js 를 쓰지 않는다
//    시뮬(`tools/`)이 브라우저 없이 읽어야 한다. 색은 숫자로만 적는다.
// ══════════════════════════════════════════════════════════════════════════

/**
 * @property bg         **하늘 자체의 색.** 이게 없으면 구역이 바뀌어도 티가
 *                      안 난다 — 안개는 물체에만 걸리는데 우주는 거의 비어
 *                      있어서 걸릴 물체가 없다. 실제로 성운을 넣고 화면을
 *                      찍었더니 빈 공간과 **구분이 안 됐다.**
 * @property fog        멀리 깔리는 색. **near 를 30 아래로 내리지 않는다** —
 *                      배 안까지 뿌예져서 통로 끝이 안 보이게 된다
 * @property stars      별 밀도 배수 (1 = 기준)
 * @property speed      순항 속도 배수
 * @property signMult   자국 배수. 성운이 0.5 라는 것이 「숨는다」의 실체다
 * @property debris     떠다니는 덩어리 개수 — 줍기(§5-3)의 눈에 보이는 근거
 */
export const REGIONS = [
  {
    key: 'empty', name: '빈 공간',
    bg: 0x03050c, fog: 0x05070d, fogNear: 70, fogFar: 340,
    stars: 1.0, tint: [0.86, 0.89, 1.0],
    speed: 1.0, signMult: 1.0, debris: 0, planet: false,
    what: '빠르고 안전하다. 대신 숨을 데가 없다',
  },
  {
    key: 'nebula', name: '성운',
    bg: 0x2a1338, fog: 0x5b2c78, fogNear: 34, fogFar: 150,
    stars: 0.42, tint: [1.0, 0.78, 0.94],
    speed: 0.72, signMult: 0.5, debris: 0, planet: false,
    what: '자국이 묻힌다. 대신 나도 못 본다',
  },
  {
    key: 'debris', name: '잔해밭',
    bg: 0x0b0f14, fog: 0x1c2530, fogNear: 42, fogFar: 220,
    stars: 0.75, tint: [0.82, 0.86, 0.96],
    speed: 0.58, signMult: 0.85, debris: 70, planet: false,
    what: '캘 것과 숨을 곳이 많다. 대신 부딪힌다',
  },
  {
    key: 'planet', name: '행성 곁',
    bg: 0x061224, fog: 0x14294a, fogNear: 60, fogFar: 320,
    stars: 0.7, tint: [0.9, 0.93, 1.0],
    speed: 0.88, signMult: 1.15, debris: 14, planet: true,
    what: '무언가 있다. 대신 눈에 잘 띈다',
  },
];

export const REGION_BY_KEY = Object.fromEntries(REGIONS.map((r) => [r.key, r]));

/**
 * 구역 하나가 얼마나 가나.
 *
 * ★ 지금은 **시간으로만** 넘어간다. 항로를 고르는 것(관측실 해도대)이
 *   생기면 여기가 아니라 그쪽이 정한다. 그때까지의 임시다 —
 *   임시라고 안 적어 두면 6개월 뒤에 「원래 이렇게 정했나 보다」가 된다.
 */
export const REGION_SECONDS = 95;

/** 색을 부드럽게 갈아타는 데 걸리는 초. 툭 바뀌면 순간이동처럼 보인다 */
export const REGION_BLEND = 6;
