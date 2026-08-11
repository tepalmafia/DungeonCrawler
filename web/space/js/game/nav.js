// ══════════════════════════════════════════════════════════════════════════
//  항법 — **순수 규칙.** 숫자는 `nav-table.js` 에 있다 (v104).
//
//  ★ three.js 도 DOM 도 안 쓴다. `tools/space-nav.js` 가 브라우저 없이
//    통째로 돌려 본다 — **게임에 붙이기 전에** 맞는지 본다.
//
//  ★★ **자리를 재지 않는다.** 항로점이 기수에서 몇 도인지는 `frame.js relOf`
//    가 이미 안다. 여기는 「벗어난 만큼 얼마나 느려지나」만 본다 —
//    재는 곳을 둘로 만들면 v93 의 병이 다른 얼굴로 돌아온다
// ══════════════════════════════════════════════════════════════════════════
import { NAV, courseMult, navWord, navState, wrapDeg } from './nav-table.js';

export const makeNav = () => ({
  /** 지금 걸린 항로점 (없으면 null) */
  to: null,
  /** 마지막으로 잰 벗어남 (도) — 계기가 읽는다 */
  off: 0,
  /** 이번 프레임의 배수 — `route.js` 가 곱한다 */
  mult: 1,
});

/**
 * ★★★ **갈래를 고르면 항로점이 생긴다.**
 *
 *   ★ 자리는 **씨앗으로 뽑는다.** `Math.random` 을 쓰면 저장하고 이어했을
 *     때 목적지가 옮겨 가고, 그러면 「아까 저기였는데」가 된다 (v56 에
 *     저장으로 한 번 겪었다). 씨앗은 이미 회차마다 있다
 *
 * @param seed  0~1 짜리 값 둘 `[a, b]` — 회차 씨앗에서 뽑아 넘긴다
 */
export function setFork(n, fork, seed = [0.5, 0.5]) {
  if (!fork) { n.to = null; return null; }
  n.to = {
    kind: 'fork',
    key: fork.key ?? fork.region ?? '?',
    name: fork.name ?? '목적지',
    az: wrapDeg((seed[0] * 2 - 1) * NAV.azSpread),
    el: (seed[1] * 2 - 1) * NAV.elSpread,
    // ★ 갈래는 **구간 끝**이라 거리를 안 쓴다 — 남은 것은 `route.t` 가 안다.
    //   여기 억지 숫자를 넣으면 두 곳이 「얼마나 남았나」를 말하게 된다
    dist: null,
  };
  return n.to;
}

/**
 * ★★ **미션을 고르면 그쪽으로 걸린다** — 항로에서 벗어난 자리다.
 *   벗어난 동안 느려지는 것이 곧 「들를까 말까」의 값이다
 */
export function setMission(n, m, seed = [0.5, 0.5]) {
  if (!m) { n.to = null; return null; }
  n.to = {
    kind: 'mission',
    key: m.key ?? '?',
    name: m.name ?? '마주친 것',
    az: wrapDeg((seed[0] * 2 - 1) * NAV.missionAz),
    el: (seed[1] * 2 - 1) * NAV.elSpread,
    dist: NAV.missionDist,
  };
  return n.to;
}

/** 걸린 것을 푼다 — **아무 때나 된다.** 갇히면 그건 벌이 아니라 고장이다 */
export function clearNav(n) { const was = n.to; n.to = null; n.off = 0; n.mult = 1; return was; }

/** 지금 갈 곳이 있나 */
export const hasNav = (n) => !!n.to;

/**
 * 한 프레임.
 *
 * @param o.off   기수가 항로점에서 몇 도 벗어났나 (`frame.js relOf` 가 준다)
 * @param o.auto  자동 항법인가 — **자동이면 늘 1** (장르를 안 바꾼다)
 * @returns 이번 프레임의 배수 (0~1)
 */
export function stepNav(n, dt, { off = null, auto = false } = {}) {
  if (!n.to) { n.off = 0; n.mult = 1; return 1; }
  if (off !== null) n.off = Math.abs(wrapDeg(off));
  n.mult = courseMult(n.off, auto);
  return n.mult;
}

/** 검사와 화면이 읽는다 */
export function summary(n, auto = false) {
  return {
    to: n.to ? { ...n.to } : null,
    off: +(n.off ?? 0).toFixed(1),
    mult: +(n.mult ?? 1).toFixed(2),
    state: n.to ? navState(n.off) : null,
    word: navWord(n.to, n.to ? n.off : null),
    auto: !!auto,
  };
}

export { NAV, courseMult, navWord, navState };
