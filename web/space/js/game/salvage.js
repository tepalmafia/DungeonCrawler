// ══════════════════════════════════════════════════════════════════════════
//  회수 — **규칙.** 표는 `salvage-table.js` 가 갖는다 (v80)
//
//  ★ 자리를 **방위·고도·거리**로 든다. 떠도는 것(`target.js`)과 **같은 자**를
//    쓴다 — 두 벌로 두면 「조준경에는 있는데 그물이 안 닿는」 종류의
//    어긋남이 반드시 난다. v69 의 `inCone` 이 정확히 그랬다.
//
//  ★ three.js 를 안 쓴다.
// ══════════════════════════════════════════════════════════════════════════
import { NET, PACK, CALL, packOf, callIn, inReach, reelTime, WHY } from './salvage-table.js';
import { azDiff } from './target.js';

export function makeSalvage() {
  return {
    /** 떠 있는 잔해 꾸러미들 */
    packs: [],
    next: 0,
    /** 지금 날아가거나 감고 있는 그물 — 하나뿐이다 */
    net: null,
    /** 다시 쏠 수 있을 때까지 (초) */
    cool: 0,
    /** ★ 지원이 오기까지 (초). 0 이면 안 오고 있다 */
    call: 0,
    /** 이번 회차에 몇 개나 주웠나 · 몇 개나 흩어졌나 — 끝 화면과 검사가 읽는다 */
    got: 0, lost: 0,
    /** 마지막으로 회수한 것 (배너·광학 창이 읽는다) */
    last: null,
  };
}

/**
 * ★★ **부쉈다** — 그 자리에 꾸러미를 떨구고 지원을 부른다.
 *
 * @param t 부순 표적 { kind, az, el, dist }
 * @param part 같이 떨어지는 탄두 재료 ('core' | 'shell' | null)
 */
export function dropPack(s, t, part = null) {
  const has = packOf(t.kind);
  if (!has) return null;
  const p = {
    id: s.next++,
    kind: t.kind,
    az: t.az, el: t.el, dist: t.dist,
    t: PACK.live,
    has, part,
  };
  s.packs.push(p);
  // ★ 지원 — **더 빨리 오는 쪽으로만** 당긴다. 이미 20초 남았는데 포함을
  //   부숴서 28초가 되면 그건 늦춰 주는 것이고, 그러면 「부수면 몰려온다」가
  //   거꾸로 「부수면 한숨 돌린다」가 된다
  const inS = callIn(t.kind);
  s.call = s.call > 0 ? Math.min(s.call, inS) : inS;
  return p;
}

/** 한 걸음 — 꾸러미가 흩어지고, 그물이 날아가고 감기고, 지원이 다가온다 */
export function stepSalvage(s, dt, { moving = true } = {}) {
  const out = { faded: [], landed: null, called: false };
  if (s.cool > 0) s.cool = Math.max(0, s.cool - dt);

  // ── 지원 시계 ────────────────────────────────────────
  if (s.call > 0) {
    s.call = Math.max(0, s.call - dt);
    if (s.call === 0) out.called = true;
  }

  // ── 꾸러미 ───────────────────────────────────────────
  for (let i = s.packs.length - 1; i >= 0; i--) {
    const p = s.packs[i];
    p.t -= dt;
    // 배가 나아가면 멀어진다 — 가만히 안 있는다
    if (moving) p.dist += PACK.drift * dt;
    if (p.t <= 0) {
      // ★ 감고 있던 것이 흩어지면 **그물도 놓친다**
      if (s.net && s.net.pack === p.id) s.net = null;
      s.packs.splice(i, 1);
      s.lost++;
      out.faded.push(p);
    }
  }

  // ── 그물 ─────────────────────────────────────────────
  if (s.net) {
    const p = s.packs.find((x) => x.id === s.net.pack);
    if (!p) {
      s.net = null;
    } else if (s.net.phase === 'out') {
      s.net.t -= dt;
      if (s.net.t <= 0) {
        s.net.phase = 'reel';
        s.net.t = reelTime(p.dist);
        s.net.total = s.net.t;
      }
    } else {
      s.net.t -= dt;
      // 감기는 만큼 **꾸러미가 다가온다** — 화면이 그걸 그린다
      p.dist = Math.max(2, p.dist * Math.max(0, s.net.t) / Math.max(0.01, s.net.total));
      if (s.net.t <= 0) {
        s.packs = s.packs.filter((x) => x !== p);
        s.net = null;
        s.cool = NET.cool;
        s.got++;
        s.last = p;
        out.landed = p;
      }
    }
  }
  return out;
}

/**
 * ★ 지금 겨눈 쪽에서 **제일 가까운** 꾸러미. 그물은 표적을 고르는 물건이
 *   아니라 **던지는** 물건이라, 대충 그쪽을 보고 있으면 걸린다
 */
export function aimedPack(s, az, el, tol = 26) {
  let best = null, bestOff = 1e9;
  for (const p of s.packs) {
    const off = Math.hypot(azDiff(p.az, az), p.el - el);
    if (off > tol) continue;
    if (off < bestOff) { best = p; bestOff = off; }
  }
  return best;
}

/**
 * ★★ **쏜다** — 왜 못 쏘는지도 말한다 (v64 규약).
 * @returns { ok, why?, pack? }
 */
export function fireNet(s, { az, el, seated = true } = {}) {
  if (!seated) return { ok: false, why: 'seat' };
  if (s.net) return { ok: false, why: 'busy' };
  if (s.cool > 0) return { ok: false, why: 'cool' };
  const p = aimedPack(s, az, el);
  if (!p) return { ok: false, why: 'none' };
  if (!inReach(p.dist)) return { ok: false, why: 'far' };
  s.net = { pack: p.id, phase: 'out', t: p.dist / NET.outSpeed, total: 0 };
  return { ok: true, pack: p };
}

/** 지금 감고 있나 — **추진이 묶인다** (`NET.holdsThrust`) */
export const reeling = (s) => !!(s.net && s.net.phase === 'reel');
export const thrustHeld = (s) => NET.holdsThrust && reeling(s);

/** 지원이 곧 오나 — 경보 */
export const callWarn = (s) => s.call > 0 && s.call <= CALL.warn;

/** 검사·화면이 읽는다 */
export function summary(s) {
  return {
    packs: s.packs.map((p) => ({
      id: p.id, kind: p.kind,
      az: +p.az.toFixed(1), el: +p.el.toFixed(1), dist: +p.dist.toFixed(0),
      t: +p.t.toFixed(1), part: p.part ?? null, has: { ...p.has },
    })),
    net: s.net ? { pack: s.net.pack, phase: s.net.phase, t: +s.net.t.toFixed(2) } : null,
    cool: +s.cool.toFixed(2),
    call: +s.call.toFixed(1), warn: callWarn(s),
    reeling: reeling(s), thrustHeld: thrustHeld(s),
    got: s.got, lost: s.lost,
  };
}

export { WHY };
