// ══════════════════════════════════════════════════════════════════════════
//  추격 상태 — **three.js 를 안 쓴다.**
//
//  화면·소리·기하는 전부 밖에서 한다. 여기는 숫자만 굴린다:
//    · 자국이 얼마인가
//    · 붙을 위험이 얼마나 쌓였나
//    · 지금 거리가 얼마인가
//
//  이렇게 갈라 두면 `tools/` 가 브라우저 없이 **추격 하나를 통째로 돌려**
//  「90초~3분에 끝나나」(PLAN §11)를 잴 수 있다. 화면과 섞어 놓으면 그걸
//  영영 못 재고, 못 재면 감으로 맞추게 된다.
// ══════════════════════════════════════════════════════════════════════════
import { SIGN, CHASE, CAUGHT, HEATING, POWER_MAX } from './chase-table.js';

/** 평온 · 추격 · 뿌리침 직후 · 잡힘 */
export const PHASE = { CALM: 'calm', CHASE: 'chase', SHAKEN: 'shaken', CAUGHT: 'caught' };

export function makeChase() {
  return {
    phase: PHASE.CALM,
    risk: 0,          // 붙을 위험 0~100
    dist: 0,          // 추격 중일 때의 거리 0~100
    sign: 0,          // 지금 자국
    timer: 0,         // 지금 단계에서 흐른 시간
    lastEscapeAt: -999,
    runs: 0,          // 몇 번 뿌리쳤나
  };
}

/** 지금 자국이 얼마인가. **켠 회로와 열과 구역에서 나온다** */
export function signatureOf(power, heat, regionMult = 1) {
  let s = SIGN.base + heat * SIGN.perHeat;
  if (power.thrust) s += SIGN.thrust;
  if (power.cool) s += SIGN.cool;
  if (power.sensor) s += SIGN.sensor;
  return Math.max(0, Math.min(SIGN.max, s * regionMult));
}

/** 열이 이번 프레임에 얼마나 움직이나 */
export function heatRate(power, valveOpen) {
  let r = HEATING.idle;
  if (power.thrust) r += HEATING.thrust;
  if (power.cool) r += valveOpen ? HEATING.coolValve : HEATING.coolOnly;
  return r;
}

/** 켤 수 있는 개수를 넘겼나 — 넘기면 마지막에 켠 것이 안 켜진다 */
export function powerCount(power) {
  return (power.thrust ? 1 : 0) + (power.cool ? 1 : 0) + (power.sensor ? 1 : 0);
}
export function canTurnOn(power) {
  return powerCount(power) < POWER_MAX;
}

/**
 * 한 프레임 굴린다.
 * @param opt.contactAt  붙기 시작하는 자국 기준. **항로의 압박이 이걸 끌어내린다**
 *                       (game/route-table.js) — 자국이 같아도 뒤쪽 구간에서는
 *                       붙는다. 그게 「좁혀 온다」의 실체다.
 *                       안 넘기면 표의 고정값 그대로라, 추격 하나만 재는
 *                       `tools/space-sim.js` 는 고칠 것이 없다
 * @param opt.trackMult  상대가 붙는 속도 배수. 잔해밭 0.75 · 압박 넘침 1.25
 * @returns 방금 일어난 일 — 'contact' | 'escaped' | 'caught' | null
 *          (소리·연출은 밖에서 이 값을 보고 한다)
 */
export function stepChase(c, dt, power, heat, regionMult, opt = {}) {
  const contactAt = opt.contactAt ?? SIGN.contactAt;
  const trackMult = opt.trackMult ?? 1;
  c.timer += dt;
  c.sign = signatureOf(power, heat, regionMult);

  if (c.phase === PHASE.SHAKEN) {
    if (c.timer >= CHASE.calmAfter) { c.phase = PHASE.CALM; c.timer = 0; c.risk = 0; }
    return null;
  }

  // ★ **잡힌 뒤에도 게임은 계속된다** (PLAN §4-4).
  //   v21 까지 여기에 분기가 **아예 없어서** CAUGHT 가 그대로 통과했고,
  //   잡히면 게임이 위협 없는 빈 상자가 됐다. 지금은 배를 뒤지는 동안
  //   (CAUGHT.hold) 붙들려 있다가 **놓아준다** — 뺏기고, 일이 늘고, 계속.
  if (c.phase === PHASE.CAUGHT) {
    if (c.timer >= CAUGHT.hold) {
      c.phase = PHASE.SHAKEN;   // 놓아준 뒤의 유예는 뿌리친 것과 같은 자리를 쓴다
      c.timer = CHASE.calmAfter - CAUGHT.calm;   // 표가 정한 만큼 안도를 준다
      c.risk = 0;
      c.dist = 0;
      return 'released';
    }
    return null;
  }

  if (c.phase === PHASE.CALM) {
    // 자국이 기준을 넘긴 채로 오래 있으면 붙는다. **즉시가 아니라 쌓인다** —
    // 그래야 「지금 잠깐 밟아도 된다」는 판단이 생긴다
    c.risk += (c.sign > contactAt ? SIGN.riskRise : -SIGN.riskFall) * dt;
    c.risk = Math.max(0, Math.min(100, c.risk));
    if (c.risk >= 100) {
      c.phase = PHASE.CHASE;
      c.dist = CHASE.startDist;
      c.timer = 0;
      return 'contact';
    }
    return null;
  }

  if (c.phase === PHASE.CHASE) {
    // 접촉 직후 잠깐은 안 좁혀진다 — 뭘 해 보기도 전에 급해지면 판단이 안 된다
    const grace = c.timer < CHASE.graceAfterContact;
    const gain = (power.thrust ? CHASE.thrustGain : CHASE.drift) * dt;
    const track = grace ? 0 : (CHASE.trackBase + c.sign * CHASE.trackPerSign) * trackMult * dt;
    c.dist += gain - track;

    if (c.dist >= CHASE.escapeAt) {
      c.phase = PHASE.SHAKEN;
      c.timer = 0;
      c.risk = 0;
      c.runs++;
      return 'escaped';
    }
    if (c.dist <= 0) {
      c.dist = 0;
      c.phase = PHASE.CAUGHT;
      c.timer = 0;
      return 'caught';
    }
  }
  return null;
}

/** 잡힌 뒤 다시 시작 — 2단계에는 나포도 거점도 없으므로 그냥 되돌린다 */
export function resetChase(c) {
  c.phase = PHASE.CALM;
  c.risk = 0;
  c.dist = 0;
  c.timer = 0;
}
