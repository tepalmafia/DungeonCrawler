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
import { SUIT } from './suit-table.js';

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
    /**
     * ★ **우주복 없이 진공에 서 있은 시간** (v62).
     *   `SUIT.grace` 를 넘기면 배가 억지로 닫는다
     */
    bare: 0,
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
 * @param opt.suited ★★ **우주복을 입었나** (v62). 입었으면 칸이 비어도
 *   아무 일이 없다 — 진공은 벌이 아니라 절차다. 안 입었으면 칸이 빈
 *   순간부터 `SUIT.grace` 를 세고, 넘기면 배가 억지로 닫는다
 * @returns 'open' | 'shut' | 'blown' | null
 */
export function stepLock(l, dt, { outsideAir = false, suited = false } = {}) {
  if (l.lockout > 0) l.lockout = Math.max(0, l.lockout - dt);

  let ev = null;
  if (l.cycling > 0) {
    l.cycling = Math.max(0, l.cycling - dt);
    if (l.cycling === 0) { l.open = l.opening; ev = l.open ? 'open' : 'shut'; }
  }

  if (l.open) {
    l.t += dt;
    if (!outsideAir) l.air = Math.max(0, l.air - LOCK.airDrain * dt);
    // ══ ★★ **여기가 v62 에서 뒤집힌 자리다** ══════════════════
    //  예전에는 `air <= airFloor` 자체가 강제 닫힘이었다. 그러면
    //  「문을 열면 133초 뒤 무조건 사고」라는 뜻인데, 실제 에어록은
    //  **열면 12초에 비는 것이 정상**이다. 벌을 절차에 붙여 놨던 것이다.
    //  지금 벌은 **우주복을 안 입은 쪽**에만 붙는다
    const vac = !outsideAir && l.air <= LOCK.airFloor;
    if (vac && !suited) {
      l.bare += dt;
      if (l.bare >= SUIT.grace) {
        // ★ 배가 억지로 끌어들이고 닫는다. **죽이지 않는다** —
        //   이 게임의 벌은 늘 **기다림**이다 (45초 못 연다)
        l.open = false; l.opening = false; l.cycling = 0;
        l.lockout = LOCK.lockout;
        l.bare = 0;
        l.blown++;
        return 'blown';
      }
    } else {
      l.bare = 0;
    }
  } else {
    l.bare = 0;
    l.air = Math.min(1, l.air + LOCK.airFill * dt);
  }
  return ev;
}

/** ★ 지금 이 칸이 진공인가 — 우주복의 공기가 여기서 준다 */
export const isVacuum = (l) => l.open && l.air <= LOCK.airFloor;
/** 우주복 없이 서 있어서 배가 닫기까지 남은 초 (아니면 null) */
export const bareLeft = (l, suited) =>
  (!suited && isVacuum(l) ? Math.max(0, SUIT.grace - l.bare) : null);

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
    bare: +l.bare.toFixed(2), vacuum: isVacuum(l),
    canHaul: canHaul(l), innerLocked: innerLocked(l), sign: signOf(l),
  };
}
