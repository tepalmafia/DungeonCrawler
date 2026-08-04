// ══════════════════════════════════════════════════════════════════════════
//  문 — **three.js 를 안 쓴다.**
//
//  닫힘 → (가까이 오면) 열림 → (지나가면) 닫힘. 가끔 **끼인다.**
//  문짝·소리·충돌은 밖에서 이 값을 **읽기만** 한다.
//
//  ★ 「지금 서 있는 문은 안 닫힌다」
//    사람이 문 안에 서 있는데 닫히면 그건 문이 아니라 덫이다.
//    가까이 있는 동안은 계속 열려 있고, 떠난 뒤에야 dwell 을 센다.
//
//  ★ 끼인 문도 **언제나 손으로 열린다** (door-table.js 참고).
//    갇힘은 시간 손해지 벽이 아니다.
// ══════════════════════════════════════════════════════════════════════════
import { makeRng } from '../core/rng.js';
import { DOOR, canPass } from './door-table.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * @param spec [{ key, name, x, z, ry }] — 배가 준다 (world/ship.js HATCHES)
 */
export function makeDoors(spec, seed = 'DOOR') {
  return {
    rnd: makeRng(`${seed}-door`),
    list: spec.map((s) => ({
      ...s,
      k: 0,            // 얼마나 열렸나 0~1
      wear: 0,         // 쓴 만큼 낡는다
      jammed: false,
      held: 0,         // 크랭크를 얼마나 돌렸나 0~1
      force: 0,        // 크랭크로 연 뒤 강제로 열어 두는 남은 초
      dwell: 0,        // 떠난 뒤 열어 둘 남은 초
      cycles: 0,
    })),
    t: 0,
    next: DOOR.firstAfter,
    jams: 0,
  };
}

export const byKey = (ds, key) => ds.list.find((d) => d.key === key);
/** 지금 낀 문 (없으면 null) */
export const jammedOne = (ds) => ds.list.find((d) => d.jammed) ?? null;

/**
 * 그 자리를 지나갈 수 있나 — **충돌이 이걸 본다.**
 * 문이 아닌 곳은 언제나 참이다.
 */
export function blocks(d) { return !canPass(d); }

/**
 * 한 프레임.
 * @param s.near     지금 사람이 가까이 있는 문 (없으면 null) — door-table nearDoor
 * @param s.cranking 지금 크랭크를 잡고 있는 문 (없으면 null)
 * @returns [{ what, door }] — 'open' | 'shut' | 'jam' | 'freed'
 */
export function stepDoors(ds, dt, { near = null, cranking = null, calm = true } = {}) {
  ds.t += dt;
  ds.next -= dt;
  const out = [];

  for (const d of ds.list) {
    const wantOpen = (!d.jammed && d === near) || d.force > 0;
    d.force = Math.max(0, d.force - dt);

    // ── 크랭크 — **끼어도 손으로 열린다** ──────────────
    if (d === cranking && d.jammed) {
      d.held = clamp01(d.held + dt / DOOR.crank);
      if (d.held >= 1) {
        d.jammed = false;
        d.held = 0;
        d.wear = 0;
        d.force = DOOR.afterCrank;
        out.push({ what: 'freed', door: d });
      }
    } else if (d.held > 0) {
      // 놓으면 되돌아간다 — 밸브·점검 패널과 같은 규약
      d.held = Math.max(0, d.held - DOOR.slip * dt);
    }

    // ── 열리고 닫힌다 ──────────────────────────────────
    if (wantOpen) {
      d.dwell = DOOR.dwell;
      const was = d.k;
      d.k = clamp01(d.k + dt / DOOR.openTime);
      if (was < 1 && d.k >= 1) out.push({ what: 'open', door: d });
    } else if (d.dwell > 0) {
      d.dwell -= dt;
      d.k = clamp01(d.k + dt / DOOR.openTime);
    } else if (d.k > 0) {
      const was = d.k;
      d.k = clamp01(d.k - dt / DOOR.closeTime);
      if (was > 0 && d.k <= 0) {
        // 한 번 여닫았다 — **쓴 만큼 낡는다**
        d.cycles++;
        d.wear += DOOR.wearPerCycle;
        out.push({ what: 'shut', door: d });
      }
    }
  }

  // ── 끼임 ────────────────────────────────────────────
  // ★ **닳은 문일수록 잘 낀다.** 많이 다니는 길이 먼저 말썽을 부린다 —
  //   그게 이 게임의 결이다 (왕복이 잦은 곳에 벌이 온다)
  if (calm && ds.next <= 0 && ds.list.filter((d) => d.jammed).length < DOOR.maxJammed) {
    const worn = ds.list.filter((d) => d.wear >= DOOR.jamAt && !d.jammed);
    if (worn.length) {
      // 제일 많이 닳은 것
      const d = worn.reduce((a, b) => (b.wear > a.wear ? b : a));
      d.jammed = true;
      d.k = 0;
      d.dwell = 0;
      ds.jams++;
      ds.next = DOOR.jamGap;
      out.push({ what: 'jam', door: d });
    } else {
      ds.next = 5;      // 아직 덜 닳았다 — 조금 뒤에 다시 본다
    }
  }
  return out;
}

/** 검사·화면용 */
export function summary(ds) {
  return ds.list.map((d) => ({
    key: d.key, k: +d.k.toFixed(2), jammed: d.jammed,
    wear: +d.wear.toFixed(2), held: +d.held.toFixed(2), cycles: d.cycles,
  }));
}
