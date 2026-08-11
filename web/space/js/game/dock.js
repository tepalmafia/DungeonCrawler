// ══════════════════════════════════════════════════════════════════════════
//  도킹 회수 — **순수 규칙.** 숫자는 `dock-table.js` 에 있다 (v101).
//
//  ★ three.js 도 DOM 도 안 쓴다. `tools/space-dock.js` 가 브라우저 없이
//    마디 넷을 통째로 돌려 본다.
//
//  ★★ **무엇이 들어오나는 여기서 안 정한다.** 꾸러미에 든 것은
//    `salvage-table.js packOf` 가 이미 안다 — 여기는 「붙었나 · 얼마나
//    들어왔나」만 본다. 두 곳에 적으면 갈라진다
// ══════════════════════════════════════════════════════════════════════════
import { DSTEP, DOCK, whyNotDock } from './dock-table.js';

export const makeDock = () => ({
  step: DSTEP.NONE,
  /** 무엇에 붙어 있나 (꾸러미 id) */
  id: null,
  /** 이 마디에 들어온 뒤 흐른 초 */
  t: 0,
  /** 이번에 몇 개나 빨아들였나 (소수점 — 1 이 될 때마다 하나) */
  got: 0,
  /** 세게 부딪혔나 — `main.js` 가 선체를 깎는다 */
  hard: false,
  /** 이번 회차에 도킹으로 회수한 수 · 몇 번 붙었나 */
  total: 0, docks: 0,
  why: null,
});

/** 붙어 있나 — 화면이 이걸로 「못 움직인다」를 말한다 */
export const docked = (d) => d.step === DSTEP.LATCH || d.step === DSTEP.PULL;

/**
 * ★ 붙으려 한다 (사람이 누른다).
 * @returns { ok, why }
 */
export function tryDock(d, o = {}) {
  const why = whyNotDock({ ...o, step: d.step });
  if (why) { d.why = why; return { ok: false, why }; }
  d.step = DSTEP.LATCH;
  d.t = 0;
  d.id = o.id ?? null;
  d.got = 0;
  d.why = null;
  // ★ **세게 닿았으면 물리기는 하되 상한다** — 못 물게 하면 「왜 안 되지」가
  //   되고, 공짜로 물리면 역추진을 만든 뜻이 없다
  d.hard = (o.close ?? 0) > DOCK.softAt * 0.72;
  d.docks += 1;
  return { ok: true, hard: d.hard };
}

/** 뗀다 — 사람이 놓거나, 멀어지거나 */
export function undock(d) {
  if (d.step === DSTEP.NONE) return false;
  d.step = DSTEP.NONE; d.id = null; d.t = 0; d.got = 0; d.hard = false;
  return true;
}

/**
 * 한 프레임.
 * @param dist 붙은 것까지 거리 (m) — 멀어지면 떨어진다
 * @param room 화물칸에 자리가 있나
 * @returns 'latch' | 'pull' | 'one' | 'off' | null — 바뀐 순간과 한 개 들어온 순간
 */
export function stepDock(d, dt, { dist = 0, room = true } = {}) {
  if (d.step === DSTEP.NONE) return null;
  d.t += dt;
  // ★ 붙어 있는데 멀어지면 떨어진다 — 끌려다니지 않는다
  if (dist > DOCK.reach * 1.35) { undock(d); return 'off'; }

  if (d.step === DSTEP.LATCH) {
    if (d.t >= DOCK.latch) { d.step = DSTEP.PULL; d.t = 0; return 'pull'; }
    return null;
  }
  if (d.step === DSTEP.PULL) {
    if (!room) return null;                 // 자리가 없으면 안 들어온다
    const was = Math.floor(d.got);
    d.got += DOCK.rate * dt;
    if (Math.floor(d.got) > was) { d.total += 1; return 'one'; }
  }
  return null;
}

/** 검사와 화면이 읽는다 */
export function summary(d) {
  return {
    step: d.step, id: d.id,
    t: +d.t.toFixed(2),
    got: Math.floor(d.got),
    hard: !!d.hard,
    total: d.total, docks: d.docks,
    why: d.why,
    docked: docked(d),
  };
}
