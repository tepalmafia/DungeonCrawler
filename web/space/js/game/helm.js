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
import { HELM, legMult, signMult, canDock, closingIn } from './helm-table.js';

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
    /**
     * ★★ **자동 항법이 켜져 있나** (사장님 「수동으로 운전할때는 자동항법
     *   꺼지는 걸로」). 켜져 있으면 놓았을 때 저절로 항로로 돌아온다.
     *   꺼져 있으면 **틀어 놓은 채 그대로 간다** — 그게 「운전한다」다
     */
    auto: true,
    /** 스위치를 눌러 항로로 되돌리는 중인가 */
    homing: false,
    /** ★ 행성에 얼마나 다가갔나 (0~1). 1 이면 박는다 — **수동일 때만** */
    near: 0,
    /** 박았나 — 게임 오버 */
    wrecked: false,
    /** 수동으로 몬 시간 — 끝 화면이 읽는다 */
    manualT: 0,
  };
}

/** ★ 조종간을 잡았다 — **자동 항법이 꺼진다** */
export function takeHelm(h) {
  if (!h.auto) return false;
  h.auto = false;
  h.homing = false;
  return true;
}

/** ★ 스위치를 눌렀다 — 자동 항법을 다시 켠다. 배가 천천히 항로로 돌아온다 */
export function engageAuto(h) {
  if (h.auto) return false;
  h.auto = true;
  h.homing = true;
  return true;
}

/**
 * 한 걸음.
 * @param push  조종간을 얼마나 밀고 있나 (-1 ~ 1). 0 이면 안 잡고 있다
 * @param inField 잔해 지대 안인가 — 안이면 조종간은 바위를 피하는 데 쓰인다
 * @param ctx.region · ctx.thrust — 행성에 끌려가는가를 보는 데 쓴다
 * @returns 'warn' | 'wreck' | 'home' | null
 */
export function stepHelm(h, dt, push = 0, inField = false, ctx = {}) {
  const want = HELM.notInField && inField ? 0 : push;
  let ev = null;
  if (Math.abs(want) > 0.02) {
    h.off = Math.min(1, h.off + HELM.turnRate * Math.abs(want) * dt);
    // 방향은 **처음 튼 쪽**을 따라간다. 밀다 말다 하면서 좌우가 뒤집히면
    // 창밖이 흔들리기만 하고 「틀었다」가 안 읽힌다
    if (h.off > 0.02 && h.way === 0) h.way = Math.sign(want);
  } else {
    // ★★ **여기가 「운전이 안 된다」의 자리였다.** 놓으면 늘 저절로
    //   돌아왔으므로 사람이 한 일이 아무 자국도 안 남았다.
    //   수동이면 **안 돌아온다** — 되돌리는 것도 내 손이다
    const back = h.auto ? (h.homing ? HELM.autoBack : HELM.backRate) : HELM.manualBack;
    h.off = Math.max(0, h.off - back * dt);
    if (h.off <= 0.001) {
      h.off = 0; h.way = 0;
      if (h.homing) { h.homing = false; ev = 'home'; }
    }
  }
  if (h.off > 0.02) h.t += dt;
  if (!h.auto) h.manualT += dt;

  // ── ★ 행성에 끌려간다 — **수동일 때만** ────────────────
  const was = h.near;
  if (closingIn({ manual: !h.auto, region: ctx.region, thrust: ctx.thrust, off: h.off })) {
    h.near = Math.min(1, h.near + HELM.hitRate * dt);
  } else {
    h.near = Math.max(0, h.near - HELM.hitBack * dt);
  }
  if (h.near >= 1 && !h.wrecked) { h.wrecked = true; return 'wreck'; }
  if (was <= HELM.warnAt && h.near > HELM.warnAt) return 'warn';
  return ev;
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
    auto: h.auto, homing: h.homing,
    near: +h.near.toFixed(3), wrecked: h.wrecked, manualT: +h.manualT.toFixed(1),
  };
}
