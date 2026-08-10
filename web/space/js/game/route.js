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
import { VOID, isVoid } from './void-table.js';

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

/**
 * 지금 창밖은 어느 구역인가. 거점에 서 있으면 **직전 갈래**를 그대로 둔다.
 *
 * ★★★ **성간 공백에는 제 구역이 있다** (v67 에서 찾았다).
 *   여기가 갈래만 보고 있었다. 마지막 구간은 **고를 갈래가 없어서**
 *   `forkOf('empty')` 가 그대로 남고, 그래서 창밖이 「빈 공간」이었다.
 *
 *   `main.js` 는 **매 프레임** `regionOf(route)` 로 창밖을 되돌린다.
 *   그래서 도착할 때 한 번 `setRegion('void')` 를 불러 봐야 **다음
 *   프레임에 지워진다** — 실제로 그렇게 고쳤다가 검사가 다시 잡았다.
 *   구역은 **한 곳에서** 나와야 한다.
 *
 *   이 게임의 목적 한 줄이 「따라오지 못하는 곳까지 간다」인데, 정작
 *   거기 도착하면 창밖이 그대로였다. 별도 안 줄고 떠도는 것도 그대로라
 *   8판이 만든 「다 보이는데 볼 것이 없다」가 통째로 안 났다
 */
export function regionOf(rt) {
  // ★ v93 — **표가 말하게 한다.** 여기 `'void'` 를 손으로 적어 뒀더니
  //   구역을 갈아치울 때 한 곳이 남았다 (`VOID.region` 과 갈라짐)
  if (isVoid(rt.leg) && rt.phase === RPHASE.LEG) return VOID.region;
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
 * @param opt.hold ★ **땅에 내려앉아 있다** — 구간은 안 나아가고 압박만 쌓인다
 * @returns 'arrive' | 'overrun' | 'end' | null
 */
export function stepRoute(rt, dt, power = {}, opt = {}) {
  if (rt.phase !== RPHASE.LEG) return null;

  // ★★ **멈춘 것과 안 쫓기는 것은 다르다** (v46 · 행성 착륙).
  //   밖에서 `dt` 를 0 으로 줄여 세우려다 압박까지 같이 멎을 뻔했다 —
  //   그러면 「내려앉아 있으면 시간이 안 간다」가 되어, 내리는 것이
  //   공짜가 된다. 규칙은 **이 파일이 갖는다**: 구간만 세우고 압박은 굴린다
  rt.t += opt.hold ? 0 : dt * (power.thrust ? 1 : LEG.coast);
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
    // ★★ **마지막 구간에는 거점이 없다** (PLAN2H §9 · `void-table.js`).
    //   고를 갈래도, 살 것도 없다 — 그대로 성간 공백으로 들어선다.
    //   여기서 거점을 하나 더 주면 「남은 것으로 간다」가 통째로 사라진다:
    //   식량을 채우고 부품을 사서 들어가면 그건 열두 번째 구간일 뿐이다
    if (isVoid(rt.leg)) {
      rt.fork = forkOf(VOID.region);
      rt.need = rt.fork.seconds;
      rt.t = 0;
      rt.overrun = false;
      rt.offer = [];
      rt.phase = RPHASE.LEG;
      return 'void';
    }
    rt.phase = RPHASE.PORT;
    rt.offer = offerFor(rt.rnd);
    return 'arrive';
  }
  return null;
}

/**
 * ★ **거점을 지나쳤다** — 항로를 벗어난 채로 닿았을 때 (helm-table.js).
 *
 *   `stepRoute` 는 이미 `leg` 를 올리고 거점(PORT)으로 넘겨 놨으므로
 *   **그것을 되돌린다.** 밖에서 `route.t` 만 만지면 leg 가 하나 앞선 채로
 *   남아서, 「구간 7/12」인데 실제로는 6번째를 가고 있는 배가 된다 —
 *   그런 어긋남은 화면에도 저장에도 그대로 새어 나간다.
 *
 *   압박은 **안 되돌린다.** 지나친 것은 시간을 버린 것이고, 그동안
 *   쫓는 쪽은 계속 다가온다.
 */
export function missPort(rt) {
  rt.leg = Math.max(0, rt.leg - 1);
  rt.phase = RPHASE.LEG;
  // 조금 되돌아간다 — 다시 닿으려면 항로로 돌아와서 그만큼 더 가야 한다
  rt.t = rt.need * 0.82;
  rt.offer = [];
  return rt.leg;
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
