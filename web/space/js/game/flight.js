// ══════════════════════════════════════════════════════════════════════════
//  세 축 + 짐벌 — **순수 규칙.** 숫자는 `flight-table.js` 에 있다.
// ══════════════════════════════════════════════════════════════════════════
import { AXES, GIMBAL, OFF_WEIGHT } from './flight-table.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const makeFlight = () => ({
  pitch: 0, yaw: 0, roll: 0,
  /** 짐벌이 지금 얼마나 기울어 있나 (방이 느끼는 것) */
  tiltX: 0, tiltZ: 0,
  /** 손이 매인 시간 — `space-fly.js` 가 15% 를 잰다 */
  seat: 0,
});

/**
 * 한 프레임.
 *
 * @param o.atSeat  조종간을 잡고 있나
 * @param o.push    { pitch, yaw, roll } 각 −1~1. 손이 미는 양
 * @param o.manual  수동인가. **수동이면 놓아도 안 돌아온다** (v55)
 */
export function stepFlight(f, dt, { atSeat = false, push = {}, manual = false } = {}) {
  const before = { pitch: f.pitch, yaw: f.yaw, roll: f.roll };

  for (const k of ['pitch', 'yaw', 'roll']) {
    const A = AXES[k];
    const p = clamp(push[k] ?? 0, -1, 1);
    if (atSeat && p !== 0) {
      f[k] = clamp(f[k] + p * A.rate * dt, -A.max, A.max);
    } else if (!manual) {
      // ★ 자동 항법이 되돌린다. **수동이면 안 돌아온다** — v55 에서
      //   사장님이 「놓으면 가운데로 돌아온다」를 고치라고 하신 자리다
      if (k === 'roll') {
        // 비틀기는 **제일 가까운 한 바퀴**로 간다. 720도를 되감으면
        // 그건 조종이 아니라 기다림이다
        const TWO = Math.PI * 2;
        let t = f.roll % TWO;
        if (t > Math.PI) t -= TWO;
        if (t < -Math.PI) t += TWO;
        const step = Math.min(Math.abs(t), A.back * dt) * Math.sign(t);
        f.roll -= step;
        if (Math.abs(f.roll % TWO) < 1e-3) f.roll = 0;
      } else {
        const step = Math.min(Math.abs(f[k]), A.back * dt) * Math.sign(f[k]);
        f[k] -= step;
      }
    }
  }
  if (atSeat) f.seat += dt;

  // ══ ★★ 짐벌 — **방은 수평을 지킨다** ══════════════════════════
  //  선체가 도는 만큼의 일부만 **새어 들어왔다가** 곧 바로 선다.
  //  ★ 완전히 안 기울게 하면 배가 도는지 몸으로 모른다. 많이 기울면
  //    걷다가 넘어지는 게임이 된다 — `maxTilt` 가 그 선이다
  const dPitch = (f.pitch - before.pitch) / Math.max(dt, 1e-6);
  const dRoll = (f.roll - before.roll) / Math.max(dt, 1e-6);
  f.tiltX = clamp(f.tiltX + dPitch * GIMBAL.give * dt, -GIMBAL.maxTilt, GIMBAL.maxTilt);
  f.tiltZ = clamp(f.tiltZ + dRoll * GIMBAL.give * dt, -GIMBAL.maxTilt, GIMBAL.maxTilt);
  const k = Math.min(1, dt * GIMBAL.lag);
  f.tiltX -= f.tiltX * k;
  f.tiltZ -= f.tiltZ * k;
  return f;
}

/**
 * 항로에서 얼마나 벗어났나 0~1 — **세 축을 하나로 합친다.**
 * 그래야 v55 의 벌(느려지고 자국이 준다)이 축을 늘려도 그대로 돈다.
 */
export function offCourse(f) {
  const TWO = Math.PI * 2;
  let r = Math.abs(((f.roll % TWO) + TWO) % TWO);
  if (r > Math.PI) r = TWO - r;               // 뒤집힌 것도 「많이 벗어난」 것
  const p = Math.abs(f.pitch) / AXES.pitch.max;
  const y = Math.abs(f.yaw) / AXES.yaw.max;
  const ro = r / Math.PI;
  const w = OFF_WEIGHT;
  const sum = p * w.pitch + y * w.yaw + ro * w.roll;
  return clamp(sum / (w.pitch + w.yaw + w.roll), 0, 1);
}

/** 짐벌이 소리를 낼 만큼 기울었나 */
export const gimbalBusy = (f) =>
  Math.abs(f.tiltX) > GIMBAL.sound || Math.abs(f.tiltZ) > GIMBAL.sound;

export const summary = (f) => ({
  pitch: +f.pitch.toFixed(3),
  yaw: +f.yaw.toFixed(3),
  roll: +f.roll.toFixed(3),
  tilt: +Math.max(Math.abs(f.tiltX), Math.abs(f.tiltZ)).toFixed(3),
  off: +offCourse(f).toFixed(3),
});
