// ══════════════════════════════════════════════════════════════════════════
//  아크 도약 — **순수 규칙.** 숫자는 `arc-table.js` 에 있다 (v99).
//
//  ★ three.js 도 DOM 도 안 쓴다. `tools/space-arc.js` 가 브라우저 없이
//    마디 셋을 통째로 돌려 본다 — **게임에 붙이기 전에** 맞는지 본다.
//
//  ★★ **여기가 하는 것은 「언제 뛸 수 있나 · 뛰면 무슨 일이 나나」뿐이다.**
//    전지를 몇 개 들었나는 화물칸(`cargo.js`)이 알고, 열은 `heat-table.js`
//    가 안다. 그 둘을 여기로 베껴 오면 두 곳이 되고, 두 곳이면 갈라진다
// ══════════════════════════════════════════════════════════════════════════
import { PHASE, ARC, WHY, whyNotJump } from './arc-table.js';

export const makeArc = () => ({
  phase: PHASE.NONE,
  /** 이 마디에 들어온 뒤 흐른 초 */
  t: 0,
  /** 남은 재사용 대기 (초) */
  cool: 0,
  /** 이번 회차에 몇 번 뛰었나 — 끝 화면과 검사가 읽는다 */
  jumps: 0,
  /**
   * ★★★ **건너뛴 초의 합.** 이것이 곧 「못 주운 것」의 크기다.
   *   끝 화면이 「이만큼을 건너뛰었습니다」로 읽는다 — 점수가 아니라 **목록**이다
   */
  skipped: 0,
  /** 마지막에 왜 못 뛰었나 (화면이 한 줄로 말한다) */
  why: null,
});

/** 재는 중인가 — 화면이 이걸로 계기를 켠다 */
export const charging = (a) => a.phase === PHASE.CHARGE;
/** 뛰는 중인가 — 이 동안은 조종도 사격도 안 먹는다 */
export const jumping = (a) => a.phase === PHASE.JUMP;

/** 얼마나 쟀나 0~1 — 계기가 막대로 그린다 */
export const chargeK = (a) => (a.phase === PHASE.CHARGE
  ? Math.max(0, Math.min(1, a.t / ARC.charge)) : 0);

/**
 * ★ 재기 시작한다. **여기서 전지를 태운다** — 다 재고 나서 태우면
 *   중간에 그만뒀을 때 공짜가 되고, 그러면 「일단 걸어 두기」가 정답이 된다.
 *
 * @returns { ok, why } — 못 하면 `why` 에 까닭
 */
export function beginCharge(a, o = {}) {
  const why = whyNotJump({ ...o, phase: a.phase, cool: a.cool });
  if (why) { a.why = why; return { ok: false, why }; }
  a.phase = PHASE.CHARGE;
  a.t = 0;
  a.why = null;
  // ★ 태우는 것은 **부르는 쪽**이 한다 (화물칸이 제 것을 안다).
  //   여기서 화물칸을 만지면 순수 규칙이 아니게 된다
  return { ok: true, cells: ARC.cells };
}

/**
 * ★★ 그만둔다. **전지는 안 돌려준다** — 태운 것은 태운 것이다.
 *   돌려주면 「위험할 때 걸고 아니면 무르기」가 공짜가 된다
 */
export function stopCharge(a) {
  if (a.phase !== PHASE.CHARGE) return false;
  a.phase = PHASE.NONE;
  a.t = 0;
  return true;
}

/**
 * 한 프레임.
 *
 * @param o.sinkAt 열 저장고가 얼마나 찼나 (0~1) — 재다가 차면 **끊긴다**
 * @param o.legSec 지금 구간의 길이 (초). 건너뛰는 양을 여기서 잰다
 * @returns 'ready' | 'jump' | 'land' | 'abort' | null — **바뀐 순간만**
 */
export function stepArc(a, dt, { sinkAt = 0, legSec = 490 } = {}) {
  if (a.cool > 0) a.cool = Math.max(0, a.cool - dt);
  if (a.phase === PHASE.NONE) return null;
  a.t += dt;

  if (a.phase === PHASE.CHARGE) {
    // ★★ **재다가 저장고가 차면 끊긴다.** 그래야 「냉각을 켜 둘까 센서를
    //   켜 둘까」가 도약과도 물린다 — 새 저울을 안 만들고 있는 것에 얹었다
    if (sinkAt >= 0.98) { a.phase = PHASE.NONE; a.t = 0; return 'abort'; }
    if (a.t >= ARC.charge) { a.phase = PHASE.JUMP; a.t = 0; return 'jump'; }
    return null;
  }
  if (a.phase === PHASE.JUMP) {
    if (a.t < ARC.fly) return null;
    a.phase = PHASE.NONE;
    a.t = 0;
    a.cool = ARC.cool;
    a.jumps += 1;
    a.skipped += legSec * ARC.skip;
    return 'land';
  }
  return null;
}

/** 이번 프레임에 저장고로 가는 열 — `main.js` 가 그대로 더한다 */
export function heatOf(a, dt) {
  if (a.phase === PHASE.CHARGE) return ARC.heatRate * dt;
  return 0;
}

/** 뛰는 순간 한 번에 오는 열 */
export const burstHeat = () => ARC.heatBurst;

/**
 * ★★★ **이번 도약이 구간을 얼마나 건너뛰나** (0~1).
 *   `route.js` 가 이 비율만큼 구간 시계를 앞으로 민다
 */
export const skipOf = () => ARC.skip;

/** 검사와 화면이 읽는다 */
export function summary(a) {
  return {
    phase: a.phase,
    t: +a.t.toFixed(2),
    k: +chargeK(a).toFixed(3),
    cool: +a.cool.toFixed(1),
    jumps: a.jumps,
    skipped: +a.skipped.toFixed(0),
    why: a.why,
    word: a.why ? WHY[a.why] : null,
  };
}
