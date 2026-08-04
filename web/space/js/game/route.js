// ══════════════════════════════════════════════════════════════════════════
//  항로 상태 — **three.js 를 안 쓴다.**
//
//  화면·소리는 밖에서 한다. 여기는 「지금 몇 번째 구간이고, 얼마나 왔고,
//  압박이 얼마인가」만 굴린다. 이렇게 갈라 둬야 `tools/space-route.js` 가
//  브라우저 없이 **회차 하나를 통째로 돌려** 「구간이 8~12분인가」를 잰다.
//
//  ★ 거점에 서면 **저절로 안 간다.** 골라야 간다
//    처음엔 「고르면 좋고 안 고르면 알아서」로 만들려 했는데, 그러면 관측실에
//    한 번도 안 가는 사람이 생기고 그 사람에게 이 게임은 **여전히 제자리
//    돌기**다. 골라야만 움직인다 — 그래서 게임이 거점에서 시작한다.
//    첫 화면에서 「항로를 고르십시오」가 뜨는 것이 이 게임의 첫 문장이다.
// ══════════════════════════════════════════════════════════════════════════
import { makeRng } from '../core/rng.js';
import { LEG, PRESS, forkOf, offerFor, contactAtFor } from './route-table.js';

/** 거점에 서 있나 · 구간을 가는 중인가 · 끝에 닿았나 */
export const RPHASE = { PORT: 'port', LEG: 'leg', END: 'end' };

export function makeRoute(seed = 'SPACE1') {
  const rnd = makeRng(seed);
  const rt = {
    phase: RPHASE.PORT,
    leg: 0,              // 지금까지 지난 구간 수 (= 지나온 거점 수)
    press: 0,
    t: 0,                // 이번 구간에서 흐른 초
    need: 0,             // 이번 구간이 몇 초짜리인가
    fork: null,          // 지금 가고 있는 갈래
    offer: null,         // 거점에서 고를 두 갈래
    overrun: false,      // 이번 구간에서 압박이 넘쳤나
    rnd,
  };
  rt.offer = offerFor(rnd);
  return rt;
}

/** 지금 창밖은 어느 구역인가. 거점에 서 있으면 **직전 갈래**를 그대로 둔다 */
export function regionOf(rt) {
  return (rt.fork || forkOf('empty')).region;
}

/** 지금 접촉 기준 자국 — 압박이 끌어내린다 */
export function contactAt(rt) { return contactAtFor(rt.press); }

/** 지금 상대가 붙는 속도 배수 — 지형과 넘침이 정한다 */
export function trackMult(rt) {
  const base = rt.fork ? rt.fork.trackMult : 1;
  return base * (rt.overrun ? PRESS.overrunTrack : 1);
}

/** 지금 자국 배수 (구역이 정한다) */
export function signMult(rt) { return rt.fork ? rt.fork.signMult : 1; }

/** 지금 센서가 먹통인가 — 성운이면 거리를 못 읽는다 */
export function isBlind(rt) { return rt.phase === RPHASE.LEG && !!rt.fork?.blind; }

/** 이번 구간을 얼마나 왔나 0~1 */
export function progress(rt) { return rt.need > 0 ? Math.min(1, rt.t / rt.need) : 0; }

/**
 * 갈래를 고른다 — 거점에서만 된다.
 * @returns 골라졌나
 */
export function chooseFork(rt, key) {
  if (rt.phase !== RPHASE.PORT) return false;
  const f = rt.offer.find((o) => o.key === key);
  if (!f) return false;
  rt.fork = f;
  rt.need = f.seconds;
  rt.t = 0;
  rt.overrun = false;
  rt.phase = RPHASE.LEG;
  return true;
}

/**
 * 한 프레임 굴린다.
 *
 * ★ **압박은 진짜 시간으로 쌓이고, 구간은 추진이 밀어 준다.**
 *   그래서 밟으면 압박을 덜 쌓고 지나갈 수 있다 — 대신 자국이 커진다.
 *   둘을 같은 시계로 굴리면 이 저울이 사라진다.
 *
 * @param power 지금 켜 둔 회로. 추진이 켜져 있으면 구간이 빨리 지난다
 * @returns 'arrive' | 'overrun' | 'end' | null
 */
export function stepRoute(rt, dt, power = {}) {
  if (rt.phase !== RPHASE.LEG) return null;

  rt.t += dt * (power.thrust ? 1 : LEG.coast);
  rt.press = Math.min(PRESS.max, rt.press + rt.fork.pressRate * dt);

  // 넘침 — **한 번만 알린다.** 매 프레임 알리면 경보가 소음이 된다
  if (!rt.overrun && rt.press >= PRESS.max) {
    rt.overrun = true;
    return 'overrun';
  }

  if (rt.t >= rt.need) {
    rt.leg++;
    rt.press = Math.max(0, rt.press * PRESS.portKeep);
    rt.overrun = false;
    if (rt.leg >= LEG.count) { rt.phase = RPHASE.END; return 'end'; }
    rt.phase = RPHASE.PORT;
    rt.offer = offerFor(rt.rnd);
    return 'arrive';
  }
  return null;
}

/** 남은 거점 수 — 「얼마나 더 가야 하나」 */
export function legsLeft(rt) { return Math.max(0, LEG.count - rt.leg); }

/**
 * 뿌리쳤다 — 항로에도 남긴다.
 *
 * ★ 이게 없으면 「뿌리쳐도 아무것도 안 쌓인다」가 그대로 남는다.
 *   추격을 이긴 것이 **다음 구간을 조금 편하게** 만들어야, 그 3초가
 *   무엇을 향한 3초인지가 생긴다 (docs/space/GAP.md §1-1).
 */
export function relieveEscape(rt) {
  rt.press = Math.max(0, rt.press - PRESS.escapeRelief);
}
