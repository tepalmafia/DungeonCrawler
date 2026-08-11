// ══════════════════════════════════════════════════════════════════════════
//  포획 — **순수 규칙.** 숫자는 `catch-table.js` 에 있다 (v103).
//
//  ★ three.js 도 DOM 도 안 쓴다. `tools/space-catch.js` 가 브라우저 없이
//    통째로 돌려 본다 — **게임에 붙이기 전에** 맞는지 본다.
//
//  ★★ **자리를 재지 않는다.** 꾸러미가 어디 있는지는 `salvage.js` 가 알고,
//    무는 것은 `dock.js` 가 한다. 여기는 **「따라붙는 동안」**만 맡는다 —
//    재는 곳을 둘로 만들면 v93 의 병이 다른 얼굴로 돌아온다
// ══════════════════════════════════════════════════════════════════════════
import { CATCH, CWHY } from './catch-table.js';

const wrap = (d) => ((d + 180) % 360 + 360) % 360 - 180;

export const makeCatch = () => ({
  /** 무엇을 쫓고 있나 (꾸러미 id · 없으면 null) */
  id: null,
  /** 지금 남은 거리 (m) · 기수에서 벗어난 각 (도) */
  dist: 0, off: 0,
  /** 닿았나 — 이때 `dock.js` 가 물면 된다 */
  arrived: false,
  /** 붙은 동안 태운 것 — `main.js` 가 빼 간다 */
  burned: 0, signed: 0, heated: 0,
  /** 얼마나 붙어 있었나 (초) — 검사가 읽는다 */
  t: 0,
});

/** 지금 쫓고 있나 */
export const chasing = (c) => c.id !== null && !c.arrived;

/**
 * 포획을 건다.
 *
 * @returns { ok, why }
 */
export function beginCatch(c, {
  has = false, id = null, dist = 999, seated = true, dry = false, full = false,
} = {}) {
  if (c.id !== null) return { ok: false, why: 'busy' };
  if (!seated) return { ok: false, why: 'seat' };
  if (!has || id === null) return { ok: false, why: 'none' };
  if (dist > CATCH.reach) return { ok: false, why: 'far' };
  if (dry) return { ok: false, why: 'dry' };
  if (full) return { ok: false, why: 'full' };
  c.id = id; c.dist = dist; c.off = 0; c.arrived = false; c.t = 0;
  return { ok: true, why: null };
}

/** 끊는다 — **아무 때나 된다.** 갇히면 그건 벌이 아니라 고장이다 */
export function stopCatch(c) {
  const was = c.id;
  c.id = null; c.arrived = false; c.dist = 0; c.off = 0; c.t = 0;
  return was;
}

/**
 * 한 프레임.
 *
 * @param o.dist  꾸러미까지 실제 거리 (`salvage.js` 가 준다)
 * @param o.off   기수에서 벗어난 각 (도)
 * @param o.hit   이번 프레임에 맞았나 — **맞으면 풀린다**
 * @param o.gone  꾸러미가 흩어졌나
 * @param o.dry   추진제가 바닥났나
 * @param o.reach 이 거리 안에 들면 닿은 것으로 본다 (`DOCK.reach`)
 * @returns 'arrived' | 'hit' | 'gone' | 'dry' | null
 */
export function stepCatch(c, dt, {
  dist = null, off = null, hit = false, gone = false, dry = false, reach = 32,
} = {}) {
  c.burned = 0; c.signed = 0; c.heated = 0;
  if (c.id === null || c.arrived) return null;
  if (gone) { stopCatch(c); return 'gone'; }
  // ★★★ **맞으면 풀린다.** 이 한 줄이 「전투 중에는 못 줍는다」이고,
  //   그래서 「지금 주울까 나중에 주울까」가 생긴다
  if (hit && CATCH.breakOnHit) { stopCatch(c); return 'hit'; }
  if (dry) { stopCatch(c); return 'dry'; }

  if (dist !== null) c.dist = dist;
  if (off !== null) c.off = Math.abs(wrap(off));
  c.t += dt;

  // ── 기수를 돌린다 — **손보다 느리다** ────────────────────
  const turn = CATCH.turn * dt;
  c.off = Math.max(0, c.off - turn);

  // ── 다가간다 — **보고 있어야 간다** ──────────────────────
  //  ★ 옆을 본 채로 다가가면 그건 옆으로 미끄러지는 것이고, 이 배는
  //    주 엔진이 뒤에 달렸으므로 그렇게 못 간다. 각이 좁혀진 만큼만 간다
  const facing = c.off <= CATCH.cone;
  if (facing) c.dist = Math.max(0, c.dist - CATCH.speed * dt);

  // ── 값 — **공짜가 아니다** ───────────────────────────────
  c.burned = CATCH.fuel * dt;
  c.signed = CATCH.sign * dt;
  c.heated = CATCH.heat * dt;

  if (c.dist <= reach && facing) { c.arrived = true; return 'arrived'; }
  return null;
}

/** 검사와 화면이 읽는다 */
export function summary(c) {
  return {
    id: c.id,
    dist: +c.dist.toFixed(1),
    off: +c.off.toFixed(1),
    arrived: !!c.arrived,
    chasing: chasing(c),
    t: +c.t.toFixed(2),
  };
}

export { CWHY };
