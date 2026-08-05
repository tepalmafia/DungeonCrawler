// ══════════════════════════════════════════════════════════════════════════
//  조종 — **규칙.** 표는 helm-table.js 가 갖는다.
//
//  ★ 상태가 하나뿐이다 — **얼마나 벗어나 있나** (0~1).
//    방향(좌/우)은 화면에만 쓴다. 「왼쪽으로 벗어난 것」과 「오른쪽으로
//    벗어난 것」이 게임적으로 다르면 그건 계산이 두 배가 되는데,
//    다를 이유가 없다 — 어느 쪽으로 틀든 목적지에서 멀어지는 것은 같다.
//
//  ★ three.js 를 안 쓴다 — tools/space-helm.js 가 브라우저 없이 읽는다.
// ══════════════════════════════════════════════════════════════════════════
import { HELM, legMult, signMult, canDock } from './helm-table.js';

export function makeHelm() {
  return {
    /** 얼마나 벗어나 있나 (0~1) */
    off: 0,
    /** 어느 쪽으로 (-1 ~ 1). 화면(배가 기우는 방향)에만 쓴다 */
    way: 0,
    /** 벗어나 있던 시간 — 검사가 「쓰이나」를 묻는다 */
    t: 0,
    /** 거점을 지나친 횟수 — 「틀어 놓고 잊기」의 벌 */
    missed: 0,
  };
}

/**
 * 한 걸음.
 * @param push  조종간을 얼마나 밀고 있나 (-1 ~ 1). 0 이면 안 잡고 있다
 * @param inField 잔해 지대 안인가 — 안이면 조종간은 바위를 피하는 데 쓰인다
 */
export function stepHelm(h, dt, push = 0, inField = false) {
  const want = HELM.notInField && inField ? 0 : push;
  if (Math.abs(want) > 0.02) {
    h.off = Math.min(1, h.off + HELM.turnRate * Math.abs(want) * dt);
    // 방향은 **처음 튼 쪽**을 따라간다. 밀다 말다 하면서 좌우가 뒤집히면
    // 창밖이 흔들리기만 하고 「틀었다」가 안 읽힌다
    if (h.off > 0.02 && h.way === 0) h.way = Math.sign(want);
  } else {
    h.off = Math.max(0, h.off - HELM.backRate * dt);
    if (h.off <= 0.001) { h.off = 0; h.way = 0; }
  }
  if (h.off > 0.02) h.t += dt;
  return null;
}

/** 거점에 닿으려는데 벗어나 있다 — 지나친다 */
export function tryDock(h) {
  if (canDock(h.off)) return true;
  h.missed++;
  return false;
}

/** 구간이 이만큼 나아간다 */
export const legOf = (h) => legMult(h.off);
/** 자국이 이만큼 */
export const signOf = (h) => signMult(h.off);
/** 창밖이 이만큼 기운다 (라디안) — `drift.js radians()` 와 같은 자리에 더해진다 */
export const radians = (h) => h.way * h.off * 0.42;

export function summary(h) {
  return {
    off: +h.off.toFixed(3), way: h.way,
    leg: +legOf(h).toFixed(3), sign: +signOf(h).toFixed(3),
    t: +h.t.toFixed(1), missed: h.missed, canDock: canDock(h.off),
  };
}
