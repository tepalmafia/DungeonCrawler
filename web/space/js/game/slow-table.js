// ══════════════════════════════════════════════════════════════════════════
//  ★★★ 느려지는 시간 — **발사와 회피** (v84 · docs/space/AI.md §4·§5)
//
//  ★ 사장님 (2026-08-10):
//    「무기나 어떤 물체를 발사했을때, **순간적으로 슬로우 모션으로
//     발사되어 점점 가속화** 되는 것으로 해줘. 그래야 더 **생동감**이」
//    「적으로 미사일이나 어떤 물체가 올때 **회피 기동을 하면 슬로우로
//     전환**되고, **경고**가 나올 수 있도록」
//
//  ══ ★★★ 왜 표가 **하나**인가 ═══════════════════════════════════════
//
//  발사 슬로우와 회피 슬로우를 각각 만들면 둘이 **곱해진다.**
//  0.45 × 0.45 = 0.20 이라 화면이 거의 멈춘다. 그리고 이건 드문 일이
//  아니다 — 미사일을 쏘는 순간 적탄이 오고 있는 것이 이 게임의 **보통
//  상황**이다. 그래서 **배율은 한 곳에서만 정한다**: 누가 부르든
//  `slow.js` 가 **제일 느린 하나만** 쓰고 바닥(`floor`)으로 막는다.
//
//  ══ ★★ 발사가 왜 느린가 — 연출이 아니라 **고증**이다 ═══════════════
//
//   ① **사출 발사(cold launch)** — 수직 발사관의 미사일은 가스로 **밀려
//      나온 뒤** 안전거리에서 모터에 불이 붙는다. 관 안에서 켜면 제 배를
//      태운다. **진공에서는 더 그렇다** — 배기가 흩어질 공기가 없다
//   ② **레일 발사(AIM-9 등)** 도 떨어져 나가고 나서 점화까지 지연이 있다
//   ③ **부스트 단계** — 점화 뒤 추진제가 타면서 **질량이 줄어** 가속도가
//      오른다. 「점점 가속화」는 실제 로켓의 모양 그대로다
//
//   ★★★ 그래서 **시간이 돌아오는 순간 불이 붙는다.** 슬로우가 사출
//     구간과 **정확히 같은 길이**인 이유가 이것이고 (`SLOW.launch.sec`
//     을 손으로 안 적고 `LAUNCH.ejectSec` 에서 가져오는 이유이기도 하다),
//     그러면 「느려졌다가 같이 빨라진다」가 한 동작으로 읽힌다
//
//  ★ **레이저에는 안 건다.** 빛이라 90m 를 0.03초에 간다 — 즉발인 것을
//    느리게 날리면 v57 이후 지켜 온 고증이 통째로 거짓말이 된다.
//    레이저는 **발사 임펙트**로 갚는다 (`world/shots.js`).
//    그리고 이것이 저절로 예산이 된다: 주력이 레이저이므로 슬로우는
//    **미사일을 쏠 때만** 오고, 미사일은 회차에 스물몇 발뿐이다
//
//  ★ three.js 를 안 쓴다 — tools/space-slow.js 가 브라우저 없이 읽는다.
// ══════════════════════════════════════════════════════════════════════════

/**
 * ★★ **사출 → 점화 → 가속.**
 *
 *   ★ 이 값이 **규칙과 화면 둘 다**를 움직인다. v79 에 「미사일이 날아가는
 *     궤적과 적이 격추되는 지점이 다르다」는 말씀을 들었는데, 원인이
 *     **화면은 화면대로 규칙은 규칙대로 날아간 것**이었다. 같은 함수를
 *     둘이 쓰게 해서 그 병이 다시 안 나게 한다 (`flownAt` · `flyTime`)
 *
 * @property ejectSec   가스로 밀려 나가는 시간 (초). **불이 없다**
 * @property ejectSpeed 그동안의 속도 (m/s) — 눈앞을 천천히 지나간다
 * @property boostSec   점화하고 순항 속도에 닿기까지 (초)
 */
export const LAUNCH = {
  ejectSec: 0.30,
  ejectSpeed: 14,
  boostSec: 0.80,
};

export const SLOW = {
  /**
   * ★★★ **아무리 겹쳐도 이 밑으로 안 간다.** 0.30 이면 3배 느린 것이고,
   *   그 밑은 「느리다」가 아니라 「멈췄다」로 읽힌다
   */
  floor: 0.30,
  /** 슬로우가 풀릴 때 이만큼(실시간 초)에 걸쳐 돌아온다 — 뚝 끊으면 멀미가 난다 */
  back: 0.25,
  /** 발사 — **사출 구간과 같은 길이**. 시간이 돌아오는 순간 불이 붙는다 */
  launch: { scale: 0.45, sec: LAUNCH.ejectSec, only: ['ir', 'arh'] },
  /**
   * 회피 — **손이 먼저 움직여야 걸린다** (사장님 「회피 기동을 하면」).
   * @property cool   한 번 걸리면 이만큼(실시간 초) 다시 안 걸린다
   * @property maxSec 한 번의 길이 천장 (실시간 초)
   */
  evade: { scale: 0.45, cool: 14, maxSec: 2.6 },
  /**
   * ★★ **회차에 느려질 수 있는 총 시간 (실시간 초).**
   *   회차가 98분(5880초)이므로 **1.5%** 다. `GENRE.seatShareMax` 와 같은
   *   안전핀 — 넘으면 `tools/space-slow.js` 가 빨개진다
   */
  budget: 90,
};

/** 부르는 쪽 이름 — 표에 없는 이름으로 부르면 도구가 잡는다 */
export const WHO = ['launch', 'evade'];

/**
 * ★★ **이 무기에 발사 슬로우가 걸리나.**
 *   즉발(레이저)은 안 걸린다 — 여기가 유일한 판정 자리다
 */
export const slowsOnLaunch = (key) => SLOW.launch.only.includes(key);

/**
 * ★★★ **쏜 지 t 초에 얼마나 갔나 (m).**
 *
 *   사출(등속) → 점화(등가속) → 순항(등속). 규칙과 화면이 **이 함수
 *   하나**를 같이 쓴다
 */
export function flownAt(t, cruise) {
  const L = LAUNCH;
  if (t <= 0) return 0;
  if (t <= L.ejectSec) return L.ejectSpeed * t;
  const dEject = L.ejectSpeed * L.ejectSec;
  const tb = Math.min(t - L.ejectSec, L.boostSec);
  // 등가속: v(τ) = eject + (cruise-eject)·τ/boostSec
  const dBoost = L.ejectSpeed * tb + ((cruise - L.ejectSpeed) * tb * tb) / (2 * L.boostSec);
  const rest = Math.max(0, t - L.ejectSec - L.boostSec);
  return dEject + dBoost + cruise * rest;
}

/** 지금 속도 (m/s) — 화면이 꼬리 불의 크기를 이걸로 정한다 */
export function speedAt(t, cruise) {
  const L = LAUNCH;
  if (t <= L.ejectSec) return L.ejectSpeed;
  const tb = Math.min(t - L.ejectSec, L.boostSec);
  return L.ejectSpeed + (cruise - L.ejectSpeed) * (tb / L.boostSec);
}

/** ★ **불이 붙었나** — 사출 중에는 꺼져 있다. 이 대비가 「사출되고 나서 붙었다」를 눈에 보이게 한다 */
export const lit = (t) => t > LAUNCH.ejectSec;

/**
 * ★★ **이만큼 가는 데 몇 초 걸리나** — `flownAt` 의 역함수.
 *
 *   ★ 규칙(`combat.js fire`)이 이걸로 비행 시간을 잡는다. 예전처럼
 *     `dist / speed` 로 두면 **화면은 사출하고 규칙은 순항**이라 다시
 *     갈라진다
 */
export function flyTime(dist, cruise) {
  const L = LAUNCH;
  if (dist <= 0) return 0;
  const dEject = L.ejectSpeed * L.ejectSec;
  if (dist <= dEject) return dist / L.ejectSpeed;
  const dBoost = L.ejectSpeed * L.boostSec + ((cruise - L.ejectSpeed) * L.boostSec) / 2;
  if (dist <= dEject + dBoost) {
    const r = dist - dEject;
    const a = (cruise - L.ejectSpeed) / (2 * L.boostSec);
    if (a <= 1e-9) return L.ejectSec + r / L.ejectSpeed;
    const b = L.ejectSpeed;
    return L.ejectSec + (-b + Math.sqrt(b * b + 4 * a * r)) / (2 * a);
  }
  return L.ejectSec + L.boostSec + (dist - dEject - dBoost) / cruise;
}

/**
 * ★★ **점화 때문에 늘어난 시간 (초).**
 *
 *   ★ 이걸 함수로 두는 이유: 사출·점화를 넣으면 비행이 **반드시** 길어지고,
 *     길어지면 유도탄은 **락온을 그만큼 더 붙들어야** 한다. 즉 이 값이
 *     곧 난이도다. 도구가 이걸 재서 **0.8초를 넘지 않는지** 본다 —
 *     넘으면 「생동감」을 얻고 「쏠 만함」을 잃은 것이다
 */
export const lagOf = (dist, cruise) => +(flyTime(dist, cruise) - dist / cruise).toFixed(3);
