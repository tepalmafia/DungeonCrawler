// ══════════════════════════════════════════════════════════════════════════
//  숨 — **규칙.** 그림과 조작은 main.js 가 한다.
//
//  ★ 여기에 three.js 가 없어야 `tools/space-run.js` 가 브라우저 없이
//    돌린다. 「9초 뛰고 14초 쉰다」가 실제로 그 값인지는 숫자로 재는
//    것이지 화면으로 재는 것이 아니다.
// ══════════════════════════════════════════════════════════════════════════
import { RUN, whyNotRun, isWinded } from './move-table.js';

export function makeMove() {
  return {
    /** 숨 0~1. 1 이 가득 */
    breath: 1,
    /** 지금 뛰고 있나 */
    running: false,
    /** 안 뛴 지 몇 초 — `restBefore` 를 지나야 숨이 찬다 */
    rest: 0,
    /** 비틀거리는 남은 시간(초) */
    stumble: 0,
    /** 못 뛴 이유 — 이번 프레임에 막혔다면 (main.js 가 말한다) */
    blocked: null,
    /** ★ 숨을 다 썼나. `recoverTo` 까지 차야 풀린다 (move-table 참고) */
    spent: false,
  };
}

/**
 * 한 프레임.
 *
 * @param want 뛰려고 하나 (Shift)
 * @param moving 실제로 움직이고 있나 — **제자리에서 Shift 만 눌러도
 *               숨이 빠지면** 그건 벌이 아니라 함정이다
 * @param s { bothHands, dark }
 * @returns 속도 배수 (1 이면 걷기)
 */
export function moveStep(m, dt, want, moving, s = {}) {
  if (m.stumble > 0) {
    m.stumble = Math.max(0, m.stumble - dt);
    m.running = false;
    // 비틀거리는 동안에도 숨은 찬다 — 벌을 두 번 주지 않는다
    breathe(m, dt);
    return 0.35;
  }

  // ★ 다 쓴 뒤에는 **절반은 차야** 다시 뛴다. 안 그러면 바닥나자마자
  //   조금 찬 숨으로 또 뛰어져서 「뛰고 서고」가 요령이 된다
  if (m.breath <= 0) m.spent = true;
  if (m.spent && m.breath >= RUN.recoverTo) m.spent = false;

  const why = whyNotRun({
    breath: m.spent ? 0 : m.breath, bothHands: s.bothHands, dark: s.dark,
  });
  // ★ **막힌 이유는 뛰려고 했을 때만 말한다.** 안 뛰는 사람에게
  //   「두 손이 찼습니다」를 계속 띄우면 그건 잔소리다
  m.blocked = want && why ? why : null;

  if (want && !why && moving) {
    m.running = true;
    m.rest = 0;
    m.breath = Math.max(0, m.breath - dt / RUN.breath);
    return RUN.mult;
  }

  m.running = false;
  breathe(m, dt);
  return 1;
}

function breathe(m, dt) {
  m.rest += dt;
  if (m.rest < RUN.restBefore) return;
  m.breath = Math.min(1, m.breath + dt / RUN.refill);
}

/** 뛰다 벽에 스쳤다 — 비틀거리고, 손에 든 것을 놓친다 */
export function bump(m) {
  if (!m.running) return false;
  m.stumble = RUN.stumble;
  m.running = false;
  return RUN.dropOnStumble;
}

/** 숨차서 손이 떨리나 — 수리 속도가 이만큼 곱해진다 */
export const handMult = (m) => (isWinded(m.breath) ? RUN.handMult : 1);

/** 검사·화면이 읽는 요약 */
export function summary(m) {
  return {
    breath: +m.breath.toFixed(3),
    running: m.running,
    spent: m.spent,
    winded: isWinded(m.breath),
    stumble: +m.stumble.toFixed(2),
    blocked: m.blocked,
  };
}
