// ══════════════════════════════════════════════════════════════════════════
//  위험 지대 — **three.js 를 안 쓴다.**
//
//  예고 → 접근 → 지나감(또는 부딪힘). 숫자만 굴린다.
//
//  ★ 배의 좌우 자리(lane)를 여기서 들고 있는다
//    조종간을 잡고 밀면 lane 이 움직이고, 놓으면 가운데로 돌아온다.
//    덩어리가 지나가는 순간 `clear` 만큼 비켜 있으면 안 부딪힌다.
//    화면(창밖에 다가오는 덩어리)은 이 값을 **읽기만** 한다.
// ══════════════════════════════════════════════════════════════════════════
import { makeRng } from '../core/rng.js';
import { HAZARD, warnFor, everyFor } from './hazard-table.js';

/** 아무 일 없음 · 예고 중 · 지나가는 중 */
export const HPHASE = { IDLE: 'idle', WARN: 'warn', RUN: 'run' };

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function makeHazard(seed = 'HAZ1') {
  return {
    rnd: makeRng(`${seed}-haz`),
    phase: HPHASE.IDLE,
    next: HAZARD.firstAfter,
    t: 0,               // 지금 단계에서 흐른 초
    need: 0,            // 예고가 몇 초짜리인가
    rocks: [],          // [{ at, lane, done, hit }]
    lane: 0,            // 배가 지금 좌우 어디에 있나 (-1 ~ 1)
    inLeg: 0,           // 이번 구간에 몇 번 왔나
    hits: 0,
    dodged: 0,
    seat: 0,            // 조종석에 매여 있던 시간(초) — 안전핀을 재려고
  };
}

/** 구간이 바뀌었다 — 한 구간에 두 번까지라 세는 것을 되돌린다 */
export function newLeg(h) { h.inLeg = 0; h.next = HAZARD.firstAfter; }

/** 지금 다가오는 것이 있나 — 창밖·경보가 읽는다 */
export function incoming(h) {
  if (h.phase !== HPHASE.RUN) return null;
  const r = h.rocks.find((x) => !x.done);
  return r ? { in: r.at - h.t, lane: r.lane, left: h.rocks.filter((x) => !x.done).length } : null;
}

/** 예고가 몇 초 남았나 */
export function warnLeft(h) { return h.phase === HPHASE.WARN ? Math.max(0, h.need - h.t) : 0; }

/** 지금 비켜 있나 — 조종석 화면이 이걸 보여준다 */
export function clearOf(h) {
  const n = incoming(h);
  return n ? Math.abs(h.lane - n.lane) : 1;
}

function spawn(h, region) {
  const [r0, r1] = HAZARD.rocks;
  const n = Math.round(lerp(r0, r1, h.rnd()));
  const [g0, g1] = HAZARD.gap;
  const rocks = [];
  let at = HAZARD.lead;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    // ★ 서로 **다른 쪽**으로 온다. 같은 쪽만 오면 한 번 밀고 가만히 있으면 된다
    let lane = lerp(-0.85, 0.85, h.rnd());
    if (i > 0 && Math.abs(lane - prev) < 0.8) lane = -Math.sign(prev) * Math.abs(lane);
    prev = lane;
    rocks.push({ at, lane, done: false, hit: false });
    at += lerp(g0, g1, h.rnd());
  }
  h.rocks = rocks;
  h.phase = HPHASE.WARN;
  h.t = 0;
  h.need = warnFor(lerp(HAZARD.warn[0], HAZARD.warn[1], h.rnd()), region);
  h.inLeg++;
}

/**
 * 한 프레임.
 * @param s { region, atSeat, push }  — 어느 구역인가 · 조종간을 잡고 있나 ·
 *          밀고 있는 세기(-1 ~ 1)
 * @returns 'warn' | 'enter' | 'hit' | 'pass' | 'clear' | null
 */
/**
 * 배를 좌우로 민다 — **조종간을 잡고 있는 동안.**
 *
 * ★ 이게 `stepHazard` 안에 들어 있었다. 그런데 `stepHazard` 는 **잔해가 뜬
 *   동안에만** 불렸다 (main.js) — 거점이거나 아직 잔해가 없으면 조종간을
 *   밀어도 `lane` 이 안 움직였다. 게다가 조종간을 잡으면 마우스가 시선에서
 *   배 쪽으로 넘어가므로, **밀리지도 않고 둘러보지도 못하는** 상태가 됐다.
 *   게임은 거점에서 시작하니 **첫 몇 분 동안 조종간은 무조건 고장난 물건**
 *   이었다 (2026-08-04 · 사장님 「운전석 조정이 안되잖아」).
 *
 *   조종간은 **늘 먹어야 한다.** 막을 것은 잔해가 오는 시점이지 조종이
 *   아니다. 잡고 밀면 창밖이 흐르고 조종간이 눕는다 — 그게 「먹고 있다」다.
 */
export function steerShip(h, dt, { atSeat = false, push = 0 } = {}) {
  if (atSeat && push !== 0) {
    h.lane = clamp(h.lane + push * HAZARD.tiltRate * dt, -HAZARD.laneMax, HAZARD.laneMax);
    h.seat += dt;
  } else if (h.lane !== 0) {
    // 놓으면 가운데로 돌아온다 — **잡고 있어야 한다**는 뜻이다
    const back = HAZARD.recenter * dt;
    h.lane = Math.abs(h.lane) <= back ? 0 : h.lane - Math.sign(h.lane) * back;
  }
}

export function stepHazard(h, dt, { region = 'empty' } = {}) {
  h.t += dt;

  if (h.phase === HPHASE.IDLE) {
    if (h.inLeg >= HAZARD.maxPerLeg) return null;
    h.next -= dt;
    if (h.next > 0) return null;
    spawn(h, region);
    return 'warn';
  }

  if (h.phase === HPHASE.WARN) {
    if (h.t < h.need) return null;
    h.phase = HPHASE.RUN;
    h.t = 0;
    return 'enter';
  }

  // ── 지나가는 중 ─────────────────────────────────────────
  let ev = null;
  for (const r of h.rocks) {
    if (r.done || h.t < r.at) continue;
    r.done = true;
    if (Math.abs(h.lane - r.lane) < HAZARD.clear) { r.hit = true; h.hits++; ev = 'hit'; }
    else { h.dodged++; if (!ev) ev = 'pass'; }
  }
  if (h.rocks.every((r) => r.done)) {
    h.phase = HPHASE.IDLE;
    h.t = 0;
    const [e0, e1] = HAZARD.every;
    h.next = everyFor(lerp(e0, e1, h.rnd()), region);
    return ev ?? 'clear';
  }
  return ev;
}

/** 이번 구간에서 조종석에 매여 있던 비율 — **안전핀** (FLYING.md §4) */
export function seatShare(h, legSeconds) { return legSeconds > 0 ? h.seat / legSeconds : 0; }
