// ══════════════════════════════════════════════════════════════════════════
//  자세 제어가 죽었다 — **규칙.** 표는 drift-table.js 가 갖는다.
//
//  ★ 모형이 단순해야 하는 이유
//    이 장면은 **손이 무엇을 하느냐**가 전부다. 물리를 정교하게 만들면
//    정교해지는 것은 계산이지 선택이 아니다. 그래서 상태는 둘뿐이다 —
//    **각속도**와 **틀어진 각도.** 놓으면 각속도가 오르고, 각도가 한계를
//    넘으면 부딪히고, 잡으면 각속도가 죽는다.
//
//  ★ 「즉시 멎지 않는다」가 이 규칙의 핵심이다
//    잡자마자 멎으면 **「위험할 때만 톡 잡는다」가 공짜**가 되어 세 갈래 중
//    하나가 압도적 정답이 된다. 잡아도 되돌리는 데 시간이 들어야
//    「언제 놓을까」가 계산이 된다.
//
//  ★ three.js 를 안 쓴다 — tools/space-drift.js 가 브라우저 없이 읽는다.
// ══════════════════════════════════════════════════════════════════════════
import { DRIFT } from './drift-table.js';

export function makeDrift() {
  return {
    /** 자세 제어가 죽었나 */
    dead: false,
    /** 못 고치는 판인가 (3막) */
    permanent: false,
    /** 지금 각속도 (도/초) */
    spin: 0,
    /** 얼마나 틀어져 있나 (도). 부호가 있다 — 화면이 어느 쪽으로 도는지 */
    angle: 0,
    /** 몇 번 부딪혔나 */
    hits: 0,
    /** 조종간을 잡고 있던 시간 */
    held: 0,
    /** 죽어 있던 시간 */
    t: 0,
    /** 어느 쪽으로 도나 (+1 · -1) */
    way: 1,
  };
}

/** 자세 제어가 나갔다 */
export function kill(d, { permanent = false, way = 1 } = {}) {
  d.dead = true;
  d.permanent = permanent;
  d.spin = DRIFT.spin0;
  d.angle = 0;
  d.way = way >= 0 ? 1 : -1;
  d.t = 0;
}

/** 고쳤다 — 조종석 **밖에서** */
export function fixed(d) {
  if (d.permanent) return false;
  d.dead = false;
  d.spin = 0;
  d.angle = 0;
  return true;
}

/**
 * 한 걸음.
 * @param grip 조종간을 잡고 있나
 * @returns 'hit' | null
 */
export function stepDrift(d, dt, grip = false) {
  if (!d.dead) {
    // 살아 있으면 남은 기울기를 스스로 편다
    d.angle -= Math.sign(d.angle) * Math.min(Math.abs(d.angle), DRIFT.settle * 4 * dt);
    return null;
  }
  d.t += dt;

  if (grip) {
    d.held += dt;
    // ★ **즉시 멎지 않는다.** 잡아도 각속도가 죽는 데 시간이 든다
    d.spin = Math.max(0, d.spin - DRIFT.settle * dt);
    // ★ **되돌리는 것은 각속도와 따로 돈다.**
    //   처음엔 「각속도가 0 이 된 뒤에」 되돌리게 짰는데, 그러면 잡는 순간
    //   각도가 거의 안 줄고 놓으면 곧바로 최고 속도로 돌아간다. 그래서
    //   **위험선 바로 아래에서 잡았다 놓았다를 무한히 반복**하는 것이
    //   공짜가 됐다 — 도구가 「반쯤」의 조종석 점유를 95% 로 찍어서 알았다.
    //   잡고 있으면 **꾸준히 되돌아와야** 「언제 놓을까」가 계산이 된다
    d.angle -= Math.sign(d.angle) * Math.min(Math.abs(d.angle), DRIFT.settle * 2 * dt);
    if (d.spin <= 0.001) return null;
  } else {
    // 놓으면 **점점 빨라진다**
    d.spin = Math.min(DRIFT.spinMax, Math.max(DRIFT.spin0, d.spin) + DRIFT.ramp * dt);
  }

  d.angle += d.way * d.spin * dt;
  if (Math.abs(d.angle) >= DRIFT.hitAt) {
    // 부딪혔다 — 툭 치이면서 자세가 흐트러진다
    d.hits++;
    d.angle = 0;
    return 'hit';
  }
  return null;
}

/** 잡고 있는 동안 오르는 열 (초당) — **가만히 있는 것의 값** */
export const holdHeat = (d, grip) => (d.dead && grip ? DRIFT.holdHeat : 0);

/** 창밖이 얼마나 돌아가 있나 — 라디안. world 가 이걸 그대로 쓴다 */
export const radians = (d) => (d.angle * Math.PI) / 180;

/** 얼마나 위험한가 (0~1) — 소리·흔들림이 읽는다. **숫자로 안 띄운다** */
export const danger = (d) => (d.dead ? Math.min(1, Math.abs(d.angle) / DRIFT.hitAt) : 0);

export function summary(d) {
  return {
    dead: d.dead, permanent: d.permanent,
    spin: +d.spin.toFixed(2), angle: +d.angle.toFixed(1),
    hits: d.hits, held: +d.held.toFixed(1), t: +d.t.toFixed(1),
    danger: +danger(d).toFixed(2),
  };
}
