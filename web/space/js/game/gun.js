// ══════════════════════════════════════════════════════════════════════════
//  주포 — **규칙.** 표는 gun-table.js 가 갖는다.
//
//  ★ 여기서 제일 조심한 것 — **쏘는 것이 공짜가 아니게**
//    쏘면 ① 수리 재료가 줄고 ② 자국이 오르고 ③ 그동안 배를 못 고친다.
//    셋 중 하나라도 빠지면 「쏠 수 있을 때 늘 쏜다」가 답이 되고,
//    그러면 주포는 선택이 아니라 **쿨다운이 있는 스위치**다.
//
//  ★ three.js 를 안 쓴다 — tools/space-gun.js 가 브라우저 없이 읽는다.
// ══════════════════════════════════════════════════════════════════════════
import { GUN, ammoFor, whyNotFire } from './gun-table.js';

export function makeGun() {
  return {
    /** 포탑에 올라가 있나 */
    up: false,
    /** 오르내리는 중 — 남은 초. 0 보다 크면 사다리 위다 (아무것도 못 한다) */
    moving: 0,
    /** 어디로 가는 중인가 (true 면 올라가는 중) */
    goingUp: false,
    /** 다음 발까지 남은 초 */
    cool: 0,
    /** 쏜 횟수 · 맞힌 횟수 — 끝 화면이 읽는다 */
    shots: 0,
    hits: 0,
    /** 섬광이 남은 초 — 이 동안 자국이 크다 */
    flash: 0,
    /** 포탑에 있던 시간 — 「장르가 안 바뀌었나」를 도구가 잰다 */
    t: 0,
    /** 왜 못 쐈나 — 마지막 이유. **조용히 안 나가면 「고장」으로 읽힌다** */
    blocked: null,
  };
}

/** 사다리를 탄다 (오르거나 내린다). 이미 움직이는 중이면 무시 */
export function climb(g) {
  if (g.moving > 0) return false;
  g.goingUp = !g.up;
  g.moving = GUN.climb;
  return true;
}

/**
 * 한 걸음.
 * @returns 'up' | 'down' | null — 사다리를 다 탔을 때
 */
export function stepGun(g, dt) {
  if (g.cool > 0) g.cool = Math.max(0, g.cool - dt);
  if (g.flash > 0) g.flash = Math.max(0, g.flash - dt);
  if (g.up) g.t += dt;

  if (g.moving > 0) {
    g.moving = Math.max(0, g.moving - dt);
    if (g.moving === 0) { g.up = g.goingUp; return g.up ? 'up' : 'down'; }
  }
  return null;
}

/**
 * 쏜다.
 *
 * ★ **여기서 supply 를 직접 깎는다.** 「탄약이 곧 수리 재료」가 이 판의
 *   전부라, 그 연결을 밖에 두면 언젠가 한쪽만 고쳐진다.
 *
 * @returns { ok, kind, hit, dist, why } — `ok` 가 false 면 `why` 를 말해 준다
 */
export function fire(g, { supply, chasing, aim = 1 } = {}) {
  const why = whyNotFire({ supply, chasing, aim, cool: g.cool });
  if (why) { g.blocked = why; return { ok: false, why }; }
  g.blocked = null;

  const kind = ammoFor(supply);
  if (kind === 'ore') supply.ore -= GUN.costOre;
  else supply.parts -= GUN.costParts;

  g.shots++;
  g.cool = GUN.reload;
  // ★ 쏘면 **밝아진다.** 총구 섬광은 숨을 수 없다
  g.flash = GUN.flashFor;

  // ★ **쫓기지 않을 때도 쏜다** (사장님 「적이 있던 없던 가능하도록해」).
  //   다만 **맞을 것이 없다** — 탄약과 섬광만 버린다. 그게 값이고,
  //   그래서 막지 않아도 「늘 쏘는 것」이 답이 안 된다
  if (!chasing) return { ok: true, kind, hit: false, dist: 0, atNothing: true };

  // 겨눈 만큼 맞는다 — 아슬아슬하게 겨누면 빗나가기도 한다
  const hit = aim >= GUN.aimNeed + (1 - GUN.aimNeed) * 0.35;
  if (hit) g.hits++;
  return { ok: true, kind, hit, dist: hit ? GUN.hitDist : GUN.missDist };
}

/** 지금 자국에 얹히는 값 (열 단위 아님 — 자국 그대로) */
export const flashSign = (g) => (g.flash > 0 ? GUN.flashSign : 0);

/** 포탑에 있어서 **배를 못 고치나** — 사다리 중간도 못 고친다 */
export const busy = (g) => g.up || g.moving > 0;

export function summary(g) {
  return {
    up: g.up, moving: +g.moving.toFixed(2), cool: +g.cool.toFixed(2),
    shots: g.shots, hits: g.hits, flash: +g.flash.toFixed(1),
    t: +g.t.toFixed(1), blocked: g.blocked, busy: busy(g),
  };
}
