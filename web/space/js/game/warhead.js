// ══════════════════════════════════════════════════════════════════════════
//  탄두 — **순수 규칙.** 숫자는 `warhead-table.js` 에 있다 (v71).
//
//  ★ three.js 도 DOM 도 안 쓴다. `tools/space-head.js` 가 브라우저 없이
//    2시간을 돌려 본다.
// ══════════════════════════════════════════════════════════════════════════
import { PARTS5, BY_KEY, CRADLE, BAKE, endingOf } from './warhead-table.js';

export const makeWarhead = () => ({
  /** 꽂힌 재료 열쇠들 */
  in: [],
  /** 손에 들고 있는 재료 (아직 안 꽂았다) */
  carrying: null,
  /** 탄두 온도 0~100 */
  bake: 0,
  /** 크레이들을 잡고 있은 시간 */
  held: 0,
  /** 무장했나 — 다섯이 다 차야 열린다 */
  armed: false,
  /** 무장 절차를 잡고 있은 시간 */
  armHeld: 0,
  /** 떨어뜨렸나 */
  dropped: false,
  /** 열에 죽은 재료 — 끝 화면이 「이렇게 왔다」에 쓴다 */
  lost: [],
});

/** 다 찼나 */
export const full = (w) => w.in.length >= PARTS5.length;
/** 이 재료가 꽂혀 있나 */
export const has = (w, key) => w.in.includes(key);

/**
 * ★★ **재료를 손에 넣었다.** 아직 꽂힌 것이 아니다 —
 *   **기관실까지 걸어가야** 한다. 그 걸음이 이 게임의 왕복이다
 */
export function pickUp(w, key) {
  if (!BY_KEY[key] || has(w, key) || w.carrying) return false;
  w.carrying = key;
  return true;
}

/**
 * 크레이들을 잡고 있다 — 다 잡으면 꽂힌다.
 * @returns 'in' | null
 */
export function holdCradle(w, dt, { holding = false } = {}) {
  if (!w.carrying) { w.held = 0; return null; }
  if (!holding) { w.held = Math.max(0, w.held - dt * 1.6); return null; }
  w.held += dt;
  if (w.held < CRADLE.hold) return null;
  w.in.push(w.carrying);
  w.carrying = null;
  w.held = 0;
  return 'in';
}

/**
 * ★★★ **한 걸음 — 탄두가 데워진다.**
 *
 *   기관실 열이 `safe` 를 넘으면 오른다. 한계에 닿으면 **꽂아 둔 것이
 *   하나 죽는다** — 죽는 대신 일이 는다 (이 배의 규약).
 *
 * @param heat 지금 선체 열 (`systems-table.js HEAT`)
 * @returns 'warn' | 'lost' | null
 */
export function stepWarhead(w, dt, { heat = 0 } = {}) {
  const before = w.bake;
  if (heat > BAKE.safe) w.bake = Math.min(BAKE.max, w.bake + BAKE.rise * dt);
  else w.bake = Math.max(0, w.bake - BAKE.fall * dt);

  if (w.bake >= BAKE.max && w.in.length) {
    // ★ **제일 나중에 꽂은 것**이 죽는다. 아무거나 죽이면 「무엇을 잃었나」가
    //   운이 되고, 마지막 것이 죽으면 **방금 한 일**을 잃는 것이라 아프다
    const gone = w.in.pop();
    w.lost.push(gone);
    w.bake = BAKE.max * 0.55;
    return 'lost';
  }
  if (before < BAKE.warn && w.bake >= BAKE.warn) return 'warn';
  return null;
}

/**
 * ★★ 무장 — **다섯이 다 차야 열린다.** 그리고 꽂기보다 훨씬 오래 잡는다.
 *   실제 무장 절차가 길고 되돌릴 수 없는 것과 같은 이유다
 * @returns 'armed' | null
 */
export function holdArm(w, dt, { holding = false } = {}) {
  if (!full(w) || w.armed) { w.armHeld = 0; return null; }
  if (!holding) { w.armHeld = Math.max(0, w.armHeld - dt * 1.2); return null; }
  w.armHeld += dt;
  if (w.armHeld < CRADLE.arm) return null;
  w.armed = true;
  return 'armed';
}

/** 얼마나 잡았나 0~1 — 화면이 띠로 보여준다 */
export const cradleAt = (w) => Math.max(0, Math.min(1, w.held / CRADLE.hold));
export const armAt = (w) => Math.max(0, Math.min(1, w.armHeld / CRADLE.arm));

/**
 * ★ **떨군다.** 무장했을 때만 나간다 — 안 했으면 지나친다.
 * @returns 결말 (`warhead-table.js ENDINGS`)
 */
export function drop(w) {
  if (!w.armed) return endingOf(w.in.length);
  w.dropped = true;
  return endingOf(w.in.length);
}

export const summary = (w) => ({
  in: [...w.in],
  n: w.in.length,
  of: PARTS5.length,
  carrying: w.carrying,
  bake: +w.bake.toFixed(1),
  hot: w.bake >= BAKE.warn,
  full: full(w),
  armed: w.armed,
  held: +cradleAt(w).toFixed(2),
  arm: +armAt(w).toFixed(2),
  lost: [...w.lost],
  dropped: w.dropped,
  ending: endingOf(w.in.length).key,
});
