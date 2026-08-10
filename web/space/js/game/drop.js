// ══════════════════════════════════════════════════════════════════════════
//  투하 — **순수 규칙.** 숫자는 `drop-table.js` 에 있다 (v93).
//
//  ★ three.js 도 DOM 도 안 쓴다. `tools/space-drop.js` 가 브라우저 없이
//    마디 넷을 통째로 돌려 본다.
//
//  ★★ **결말은 여기서 안 만든다.** 몇 칸 찼나로 고르는 것은 이미
//    `warhead-table.js endingOf` 한 곳에 있다 — 두 곳에 적으면 갈라진다.
//    여기가 하는 것은 **언제 떨굴 수 있나 · 떨군 뒤에 무슨 일이 나나**뿐이다.
// ══════════════════════════════════════════════════════════════════════════
import { PHASE, DROP, ESCAPE, hurtAt } from './drop-table.js';

export const makeDrop = () => ({
  phase: PHASE.NONE,
  /** 이 마디에 들어온 뒤 흐른 초 */
  t: 0,
  /** 떨군 뒤 벌린 거리 (m). `main.js` 가 배 속도로 채운다 */
  away: 0,
  /** 이탈 실패로 선체가 얼마나 상했나 (0~1) — 끝 화면이 한 줄로 읽는다 */
  hurt: 0,
  /** 창이 열렸다 닫혔나 — **놓친 것**과 아직 안 온 것은 다르다 */
  missed: false,
  /** 떨어뜨릴 때 몇 칸이 차 있었나. 결말은 이 수가 정한다 */
  filled: 0,
});

/** 지금 떨굴 수 있나 — **창이 열려 있고 무장했을 때만** */
export const canDrop = (d, armed) => d.phase === PHASE.WINDOW && !!armed;

/**
 * 한 프레임.
 *
 * ★ `at` 이 참이 되는 순간 진입이 시작된다 (12구간). 거기서부터는
 *   **시계가 혼자 간다** — 사람이 멈출 수 있는 것은 「떨구느냐」뿐이다.
 *
 * @param o.at     지금 마지막 구간(적 행성 상공)인가
 * @param o.armed  탄두가 무장돼 있나
 * @param o.speed  지금 배가 초당 몇 유닛 가나 (이탈 거리를 채운다)
 * @returns 'run' | 'window' | 'late' | 'blast' | 'over' | null — **바뀐 순간만**
 */
export function stepDrop(d, dt, { at = false, armed = false, speed = 0 } = {}) {
  if (!at) {
    // ★ 12구간을 벗어나면(검사가 되돌리거나 이어했을 때) 처음으로
    if (d.phase !== PHASE.NONE && d.phase !== PHASE.OVER) { d.phase = PHASE.NONE; d.t = 0; }
    return null;
  }
  if (d.phase === PHASE.NONE) { d.phase = PHASE.RUN; d.t = 0; return 'run'; }
  d.t += dt;

  if (d.phase === PHASE.RUN) {
    if (d.t >= DROP.run) { d.phase = PHASE.WINDOW; d.t = 0; return 'window'; }
    return null;
  }
  if (d.phase === PHASE.WINDOW) {
    // ★ **창은 무장을 기다려 주지 않는다.** 그래야 「기관실까지 언제
    //   갔다 오나」가 회차 내내 살아 있는 결심이 된다
    if (d.t >= DROP.window) { d.phase = PHASE.OVER; d.missed = true; d.t = 0; return 'late'; }
    return null;
  }
  if (d.phase === PHASE.FALL) {
    // ★★ **보고 있는 동안 도망친다.** 떨어지는 것을 보느라 안 밟으면
    //   그 값을 치른다 — 이 게임의 마지막 결심이다
    d.away += Math.max(0, speed) * dt;
    if (d.t >= DROP.fall) {
      d.phase = PHASE.BLAST; d.t = 0;
      d.hurt = hurtAt(d.away) * ESCAPE.max;
      return 'blast';
    }
    return null;
  }
  if (d.phase === PHASE.BLAST) {
    if (d.t >= DROP.blast) { d.phase = PHASE.OVER; d.t = 0; return 'over'; }
    return null;
  }
  return null;
}

/**
 * ★★★ **떨군다.** 창이 열려 있고 무장했을 때만 먹는다.
 * @returns 참이면 떨어졌다
 */
export function pull(d, { armed = false, filled = 0 } = {}) {
  if (!canDrop(d, armed)) return false;
  d.phase = PHASE.FALL;
  d.t = 0;
  d.away = 0;
  d.filled = filled;
  return true;
}

/** 창이 닫히기까지 몇 초 남았나 (창이 아니면 0) */
export const windowLeft = (d) => (d.phase === PHASE.WINDOW ? Math.max(0, DROP.window - d.t) : 0);
/** 터지기까지 몇 초 남았나 (떨어지는 중이 아니면 0) */
export const blastIn = (d) => (d.phase === PHASE.FALL ? Math.max(0, DROP.fall - d.t) : 0);
/** 진입 중 적이 몇 배로 오나 — 진입할 때만 두껍다 */
export const foeMult = (d) => (d.phase === PHASE.RUN || d.phase === PHASE.WINDOW ? DROP.foes : 1);

export const summary = (d) => ({
  phase: d.phase,
  t: +d.t.toFixed(1),
  away: Math.round(d.away),
  hurt: +d.hurt.toFixed(2),
  missed: d.missed,
  filled: d.filled,
  windowLeft: +windowLeft(d).toFixed(1),
  blastIn: +blastIn(d).toFixed(1),
});
