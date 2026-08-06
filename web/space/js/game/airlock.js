// ══════════════════════════════════════════════════════════════════════════
//  에어록 바깥문 — **규칙.** 표는 airlock-table.js 가 갖는다.
//
//  ★ 상태가 셋뿐이다 — **열렸나 · 공기 · 못 여는 시간.**
//    문 하나에 물리를 붙이기 시작하면 끝이 없다. 물어야 할 것은
//    「기밀이 얼마나 정교한가」가 아니라 **「열면 무엇을 못 하게 되나」**다.
//
//  ★ three.js 를 안 쓴다 — tools/space-airlock.js 가 브라우저 없이 읽는다.
// ══════════════════════════════════════════════════════════════════════════
import { LOCK, whyNotOpen } from './airlock-table.js';

export function makeLock() {
  return {
    /** 바깥문이 열려 있나 */
    open: false,
    /** 도는 중 — 남은 초 */
    cycling: 0,
    /** 어느 쪽으로 도는 중인가 */
    opening: false,
    /** 공기 (0~1) */
    air: 1,
    /** 강제로 닫힌 뒤 못 여는 남은 시간 */
    lockout: 0,
    /** 열어 둔 시간 — 검사가 「쓰이나」를 묻는다 */
    t: 0,
    /** 기밀을 잃은 횟수 — 「열어 놓고 잊기」의 벌이 몇 번 왔나 */
    blown: 0,
    /** 왜 못 열었나 */
    blocked: null,
  };
}

/**
 * 문을 돌린다 (열거나 닫는다).
 * @returns true 면 돌기 시작했다. false 면 `l.blocked` 에 이유가 있다
 */
export function cycle(l, { thrust = false } = {}) {
  if (l.cycling > 0) { l.blocked = 'cycling'; return false; }
  if (!l.open) {
    const why = whyNotOpen({ thrust, air: l.air, lockout: l.lockout });
    if (why) { l.blocked = why; return false; }
  }
  l.blocked = null;
  l.opening = !l.open;
  l.cycling = LOCK.cycle;
  return true;
}

/**
 * 한 걸음.
 * @param opt.outsideAir ★ **밖에 대기가 있다** (행성에 내려앉아 있을 때).
 *   그러면 문을 열어 놔도 공기가 안 준다 — 같은 문이 상황에 따라 다른
 *   물건이 되는 것이고, 그게 「내려오면 숨통이 트인다」를 규칙 하나로 말한다
 * @returns 'open' | 'shut' | 'blown' | null
 */
export function stepLock(l, dt, { outsideAir = false } = {}) {
  if (l.lockout > 0) l.lockout = Math.max(0, l.lockout - dt);

  let ev = null;
  if (l.cycling > 0) {
    l.cycling = Math.max(0, l.cycling - dt);
    if (l.cycling === 0) { l.open = l.opening; ev = l.open ? 'open' : 'shut'; }
  }

  if (l.open) {
    l.t += dt;
    if (!outsideAir) l.air = Math.max(0, l.air - LOCK.airDrain * dt);
    if (l.air <= LOCK.airFloor) {
      // ★ **강제로 닫힌다.** 벌은 숫자가 아니라 **기다림**이다
      l.open = false; l.opening = false; l.cycling = 0;
      l.lockout = LOCK.lockout;
      l.blown++;
      return 'blown';
    }
  } else {
    l.air = Math.min(1, l.air + LOCK.airFill * dt);
  }
  return ev;
}

/** ★ **낚을 수 있나** — 바깥문이 열려 있어야 한다 */
export function canHaul(l) {
  if (LOCK.needOpenToHaul && !l.open) return false;
  return true;
}

/** 왜 못 낚나 */
export const haulWhy = (l) => (l.open ? null : (l.cycling > 0 ? 'cycling' : 'shut'));

/** ★ **바깥문이 열려 있으면 안쪽 문이 잠긴다** — 에어록에 갇힌다 */
export const innerLocked = (l) => l.open || l.cycling > 0;

/** 지금 자국에 얹히는 값 */
export const signOf = (l) => (l.open ? LOCK.sign : 0);
/** 지금 초당 빠지는 열 (양수) */
export const heatOut = (l) => (l.open ? LOCK.heatOut : 0);

export function summary(l) {
  return {
    open: l.open, cycling: +l.cycling.toFixed(2),
    air: +l.air.toFixed(3), lockout: +l.lockout.toFixed(1),
    t: +l.t.toFixed(1), blown: l.blown, blocked: l.blocked,
    canHaul: canHaul(l), innerLocked: innerLocked(l), sign: signOf(l),
  };
}
