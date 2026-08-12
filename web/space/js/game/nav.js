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
  /** ★ v126 — 좌우·위아래로 몇 도 (부호가 있다). 「어느 쪽」이 여기서 나온다 */
  rel: null,
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
  n.to = forkAt(fork, seed);
  return n.to;
}

/**
 * ★★★ v128 — **이 갈래는 하늘의 어디인가** — 걸지 않고 **묻기만** 한다.
 *
 *   ★ 사장님 (2026-08-12) 「**왜 항로 네비게이션이 안 나와?**」
 *
 *   ══ 재 보니 **거점에 서 있는 동안은 갈 곳이 없었다** ═══════════════
 *
 *   새 게임을 켜고 재면 이랬다:
 *
 *       nav.to = null · route.fork = null · phase = port
 *
 *   즉 항법이 고장난 것이 아니라 **가리킬 것이 없었다.** 갈래를 고르기
 *   전까지는 목적지가 정해지지 않으므로 v104~v126 이 만든 것(마름모 ·
 *   항로 문 · 가장자리 화살표)이 **셋 다 조용했다.** 그리고 회차는
 *   **거점에서 시작한다** — 그래서 켜자마자 아무것도 안 나왔다.
 *
 *   ★★ 그런데 거점은 「갈 곳이 없는 곳」이 아니라 **갈림길**이다. 고를
 *     것이 둘 있고, 둘 다 하늘의 어딘가다. 그것을 안 보여 준 것뿐이다.
 *     그래서 **고르기 전에도 두 길을 보여 준다** — 고르는 일이
 *     차림표 고르기에서 **방향 고르기**가 된다.
 *
 *   ★★★ 그러려면 「걸지 않고 자리만 묻는」 길이 있어야 한다. 여기다 —
 *     `setFork` 도 이것을 쓰므로 **고른 뒤에도 자리가 안 옮겨간다.**
 *     자리를 두 곳에서 내면 고르는 순간 목적지가 홱 움직인다
 *
 * @param kind `'fork'` 고른 것 · `'port'` 아직 고르기 전의 후보
 */
export function forkAt(fork, seed = [0.5, 0.5], kind = 'fork') {
  if (!fork) return null;
  return {
    kind,
    key: fork.key ?? fork.region ?? '?',
    name: fork.name ?? '목적지',
    az: wrapDeg((seed[0] * 2 - 1) * NAV.azSpread),
    el: (seed[1] * 2 - 1) * NAV.elSpread,
    // ★ 갈래는 **구간 끝**이라 거리를 안 쓴다 — 남은 것은 `route.t` 가 안다.
    //   여기 억지 숫자를 넣으면 두 곳이 「얼마나 남았나」를 말하게 된다
    dist: null,
  };
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
export function stepNav(n, dt, { off = null, auto = false, rel = null } = {}) {
  if (!n.to) { n.off = 0; n.mult = 1; n.rel = null; return 1; }
  if (off !== null) n.off = Math.abs(wrapDeg(off));
  // ★★★ v126 — **어느 쪽인지를 들고 있는다.** 계기 셋(조준경 아랫줄 ·
  //   항로 화살표 · 점검 모드)이 **같은 것**을 읽어야 한 쪽만 딴말을 안 한다
  if (rel) n.rel = { az: wrapDeg(rel.az), el: rel.el };
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
    // ★★★ v126 — **어느 쪽인지도 담는다** (사장님 「우주라서 방향을 못 찾잖아」).
    //   `rel` 은 `stepNav` 이 받은 것을 그대로 들고 있다 — 여기서 다시 재면
    //   「화살표는 좌라는데 아랫줄은 우」가 난다
    word: navWord(n.to, n.to ? n.off : null, n.rel),
    rel: n.rel ? { az: +n.rel.az.toFixed(1), el: +n.rel.el.toFixed(1) } : null,
    auto: !!auto,
  };
}

export { NAV, courseMult, navWord, navState };
