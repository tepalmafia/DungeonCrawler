// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **적의 기동 셋** — 뼈대 (v137). 기획은 `docs/space/FIGHT.md §3`.
//
//  ★ 사장님 (2026-08-13) 「실감나는 전투를 위해 무기와 **적의 기동 임펙트** …
//    우주 전투시뮬레이션 RPG에 맞게. 벤치마크할 게임을 찾고」
//
//  ══ ★★★ 재 보니 **적은 기동을 안 했다** ═══════════════════════════════
//
//  `target.js` 가 매 걸음 하는 일은 이 두 줄이 전부였다:
//
//      t.az += t.vaz * dt;
//      t.el += t.vel * dt;
//
//  **표류다.** 처음 뽑은 속도로 계속 흘러갈 뿐, 내가 뒤를 잡든 정면에서
//  맞붙든 **적이 하는 일이 똑같았다.** 그래서 전투가 「가만히 있는 과녁을
//  따라가며 쏘기」였고, 사장님이 「실감나는」이라고 하신 것이 여기다.
//
//  ══ ★★ 벤치마크에서 하나만 (`FIGHT.md §1`) ═══════════════════════════
//
//  Freespace 2 · Wing Commander 의 **브레이크**를 가져온다 — 물리면 꺾고,
//  못 떼면 되꺾어 마주본다. EVE 의 **각속도**를 값으로 쓴다: 꺾는 동안은
//  잘 안 맞고, **꺾고 나면 느려져서 잘 맞는다.**
//
//  ★★★ **셋을 넘기지 않는다.** 사람이 「저 놈이 뭘 하려는지」를 읽을 수
//    있어야 기동이 값을 갖는다. 넷이 되면 그냥 무작위로 보이고, 무작위는
//    아무리 정교해도 **읽을 수 없으므로 대응할 수도 없다.**
//
//  ★ three.js 를 안 쓴다 — `tools/space-foe.js` 가 읽는다.
// ══════════════════════════════════════════════════════════════════════════
import { ASPECT } from './aspect-table.js';

/**
 * ★★★ **기동 셋.**
 *
 *  @property when  언제 들어가나 (사람이 읽는 말 — 조건은 `stepFoe` 가 판단)
 *  @property secs  얼마나 하나
 *  @property turn  이 동안 초당 몇 도 꺾나 (어스펙트가 이만큼 벌어진다)
 *  @property slow  이 동안 속도가 몇 배 (★ 꺾으면 느려진다 — EVE 의 값)
 *  @property tell  사람에게 뭐라고 알리나
 */
export const MOVES = {
  break: {
    key: 'break', name: '브레이크', secs: 1.6, turn: 62, slow: 0.62,
    when: '뒤를 잡히고 0.8초 넘게 물려 있을 때',
    tell: '적이 급선회합니다',
    what: '옆으로 급선회 — 각속도가 확 는다. **앞을 질러 쏘거나 놓아 주고 다시 잡는다**',
  },
  reverse: {
    key: 'reverse', name: '되꺾기', secs: 2.2, turn: 84, slow: 0.40,
    when: '브레이크로 못 뗐을 때 (두 번 연속)',
    tell: '적이 기수를 돌립니다 — 정면 교차',
    what: '감속하며 기수를 나에게 돌린다. **서로 정면 = 서로 ×0.75** — 지나친 뒤 누가 먼저 도느냐',
  },
  extend: {
    key: 'extend', name: '이탈', secs: 3.4, turn: 22, slow: 1.35,
    when: '부위가 깨졌거나 체력이 낮을 때',
    tell: '적이 등을 보이고 밀어붙입니다',
    what: '등을 보이고 밀어붙인다. **이미 있는 `FLEE` 를 잇는다** — 쫓을지 놓을지가 결심',
  },
};

/** 셋 — 검사와 화면이 **같은 것**을 센다 */
export const MOVE_KEYS = Object.keys(MOVES);

export const FOE = {
  /** 뒤를 이만큼 물고 있으면 브레이크가 들어온다 (초) */
  holdToBreak: 0.8,
  /** 브레이크를 이만큼 연달아 실패하면 되꺾는다 */
  breaksToReverse: 2,
  /** 체력이 이 아래면 이탈 */
  extendAt: 0.34,
  /** 기동과 기동 사이 — 숨 돌리는 틈 (초). 없으면 쉼 없이 꺾는다 */
  rest: 1.1,
  /**
   * ★★★ **꺾는 동안 잘 안 맞는다** — 명중률에 곱하는 값.
   *   ★ EVE 의 각속도를 값 하나로 접었다. 0 으로 두면 「꺾으면 절대 못
   *     맞는다」가 되어 **브레이크가 무적기**가 된다
   */
  turnMiss: 0.55,
};

/** 처음 상태 */
export const makeFoe = () => ({
  move: null, t: 0, rest: 0, held: 0, breaks: 0, aspect: 180,
});

/**
 * ★★★ **한 걸음.**
 *
 * @param f      `makeFoe()` 가 낸 것
 * @param dt     초
 * @param locked 내가 이 적을 물고 있나 (조준선에 들어와 있나)
 * @param hp01   남은 체력 0~1
 * @param dead   부위가 깨졌나
 * @returns { move, aspect, slow, miss, tell }
 *          aspect 는 **적 기수에서 나까지의 각** — `aspect-table.js` 가 읽는다
 */
export function stepFoe(f, dt, { locked = false, hp01 = 1, dead = false } = {}) {
  let tell = null;
  // ── 지금 하고 있는 기동을 이어 간다 ────────────────────
  if (f.move) {
    f.t -= dt;
    const m = MOVES[f.move];
    // ★★ **기동은 어스펙트를 벌린다.** 브레이크·되꺾기는 나를 정면으로
    //   돌리려 하고(각을 줄이고), 이탈은 등을 보인다(각을 늘린다)
    const to = f.move === 'extend' ? 180 : 0;
    const step = m.turn * dt;
    f.aspect += Math.sign(to - f.aspect) * Math.min(step, Math.abs(to - f.aspect));
    if (f.t <= 0) {
      // ★ 브레이크가 끝났는데 **아직 물려 있으면** 실패로 센다
      if (f.move === 'break' && locked) f.breaks += 1;
      else if (f.move === 'break') f.breaks = 0;
      f.move = null;
      f.rest = FOE.rest;
    }
    return {
      move: f.move, aspect: f.aspect, slow: m.slow,
      miss: FOE.turnMiss, tell,
    };
  }
  // ── 쉬는 중 ────────────────────────────────────────────
  if (f.rest > 0) f.rest = Math.max(0, f.rest - dt);
  // ★ 물고 있는 시간을 센다 — **놓으면 0 으로 돌아간다**
  f.held = locked ? f.held + dt : 0;

  // ── 무엇을 할까 ────────────────────────────────────────
  //  ★★★ **순서가 뜻이다.** 이탈이 제일 위다 — 죽을 판이면 꺾는 것보다
  //    사는 것이 먼저다. 그 다음이 되꺾기(브레이크로 못 뗐다), 마지막이
  //    브레이크. 아래에서부터 보면 「가벼운 것이 무거운 것을 가린다」
  let want = null;
  if (dead || hp01 <= FOE.extendAt) want = 'extend';
  else if (f.breaks >= FOE.breaksToReverse) want = 'reverse';
  else if (locked && f.held >= FOE.holdToBreak) want = 'break';

  if (want && f.rest <= 0) {
    f.move = want;
    f.t = MOVES[want].secs;
    f.held = 0;
    if (want === 'reverse') f.breaks = 0;
    tell = MOVES[want].tell;
  }
  return { move: f.move, aspect: f.aspect, slow: 1, miss: 1, tell };
}

/** 사람이 읽는 한 마디 */
export const foeWord = (f) => (f?.move ? MOVES[f.move].name : '기동 없음');

/** 지금 이 적이 나에게 몇 도인가 — `aspect-table.js` 가 읽는 값 */
export const aspectDeg = (f) => f?.aspect ?? 180;

/** 검사와 화면이 읽는다 */
export const summary = (f) => ({
  move: f?.move ?? null, word: foeWord(f), aspect: +(f?.aspect ?? 180).toFixed(1),
  held: +(f?.held ?? 0).toFixed(2), breaks: f?.breaks ?? 0,
  zone: Object.values(ASPECT).find((a) => {
    const d = Math.abs(f?.aspect ?? 180);
    return d >= a.from && d <= a.to;
  })?.name ?? '',
});
