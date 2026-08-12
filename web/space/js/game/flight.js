// ══════════════════════════════════════════════════════════════════════════
//  세 축 + 짐벌 — **순수 규칙.** 숫자는 `flight-table.js` 에 있다.
// ══════════════════════════════════════════════════════════════════════════
import { AXES, GIMBAL, OFF_WEIGHT, RCS } from './flight-table.js';
// ★★★ v103 — **비행 보조** (사장님 「물리방향으로 움직이니 너무 어렵다」).
//   자리를 아는 곳을 둘로 안 만든다 — 되돌리는 규칙은 `horizon-table.js` 하나다
import { levelStep, clampRoll } from './horizon-table.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const makeFlight = () => ({
  pitch: 0, yaw: 0, roll: 0,
  /** 짐벌이 지금 얼마나 기울어 있나 (방이 느끼는 것) */
  tiltX: 0, tiltZ: 0,
  /** 손이 매인 시간 — `space-fly.js` 가 15% 를 잰다 */
  seat: 0,
  /** ★★★ v73 — **반동휠에 담긴 각운동량** (rad). 차면 추진제를 쓴다 */
  wheel: 0,
  /** 이번 프레임에 태운 추진제 — `main.js` 가 빼 간다 */
  burned: 0,
});

/**
 * 한 프레임.
 *
 * @param o.atSeat  조종간을 잡고 있나
 * @param o.push    { pitch, yaw, roll } 각 −1~1. 손이 미는 양
 * @param o.manual  수동인가. **수동이면 놓아도 안 돌아온다** (v55)
 * @param o.assist  ★★★ v103 — **비행 보조.** 수동이어도 **롤만** 저절로
 *                  수평으로 돌아온다. 왜 롤만인지는 `horizon-table.js` 에
 *                  적어 뒀다: 뒤집는 축은 롤뿐이고, 롤은 겨냥에 안 쓰인다
 */
export function stepFlight(f, dt, {
  atSeat = false, push = {}, manual = false, burst = false, assist = true,
} = {}) {
  const before = { pitch: f.pitch, yaw: f.yaw, roll: f.roll };

  for (const k of ['pitch', 'yaw', 'roll']) {
    const A = AXES[k];
    const p = clamp(push[k] ?? 0, -1, 1);
    if (atSeat && p !== 0) {
      // ★★★ v73 — **급기동** (Shift). 추력기를 세게 문다 — 추진제로 낸다
      const rate = A.rate * (burst ? RCS.burst.mult : 1);
      f[k] = clamp(f[k] + p * rate * dt, -A.max, A.max);
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
  // ══ ★★★ v103 — **비행 보조: 롤만 저절로 수평으로** ═══════════════════
  //
  //  ★ 사장님 「**물리방향으로 움직이니 게임이 너무 어렵게 느껴지는데?**」
  //
  //  ★★ 위의 자동 항법(`!manual`)과 **겹치지 않는다**: 자동일 때는 이미
  //    위에서 롤을 되돌렸으므로 여기서 할 일이 없고(0 이 나온다), 값이
  //    같아서(`ASSIST.rate` = `AXES.roll.back`) 두 번 돌아도 속도가 안 는다.
  //    이 줄이 사는 자리는 **수동인데 손을 뗀 때** — 사장님이 겪으신 그 상태다.
  //
  //  ★★★ **손이 Q/E 를 잡고 있으면 안 건드린다.** 안 그러면 배를 굴릴
  //    수가 없고, 그러면 「보조」가 아니라 「금지」다
  {
    const hand = atSeat && (push.roll ?? 0) !== 0;
    const d = levelStep(f.roll, dt, { hand, on: assist });
    if (d !== 0) f.roll += d;
    // ══ ★★★ v121 — **보조가 켜져 있으면 여기서 멈춘다** ═══════════════
    //
    //  ★ 사장님 「계속 회피하다 보니 또 뒤집혀서 정상적으로 안 돌아오는데」
    //
    //  ★★ 속도로는 못 푼다 — 재 봤다. 보조를 손보다 빠르게 해도 **꺾는
    //    시간이 길면 쌓이고**, 잡은 동안에도 보조를 걸면 이번엔 **보통
    //    롤이 90도에서 막힌다.** 하나를 고치면 하나가 깨진다.
    //  ★★★ 그래서 자세를 **한계 안에서만** 놀게 한다 (장르의 정석).
    //    그러면 보조가 켜진 동안 「뒤집힘」이 **일어날 수가 없다** —
    //    v103 이 적어 둔 「뒤집힌 채로 머무를 수가 없다」가 사실이 된다.
    //  ★ 끄면(L) 그대로 360도다. 자르는 것은 **보조가 하는 일**이지
    //    이 배가 못 하는 일이 아니다
    f.roll = clampRoll(f.roll, assist);
  }
  if (atSeat) f.seat += dt;

  // ══ ★★★ **도는 데 값이 든다** (v73 · `RCS`) ═══════════════════════
  //
  //  ★ 우주에는 공기가 없어 저절로 안 멈춘다 — 그건 v55 에 이미 넣었다.
  //    여기서 더하는 것은 **무엇으로 도나**다:
  //      천천히 → **반동휠** (공짜. 대신 바퀴가 찬다)
  //      급하게 → **추력기** (추진제를 태운다)
  //    바퀴가 다 차면 잔 조정도 추력기가 맡는다. 그래서 「마음껏 돌려라」가
  //    아니라 **「돌 수 있는데 값이 있다」**가 된다
  const spun = Math.abs(f.pitch - before.pitch)
    + Math.abs(f.yaw - before.yaw)
    + Math.abs(f.roll - before.roll);
  f.burned = 0;
  if (spun > 1e-6) {
    const rate = spun / Math.max(dt, 1e-6);
    // 바퀴가 감당하는 몫과 넘치는 몫
    const room = Math.max(0, RCS.wheelCap - f.wheel);
    // ★ **급기동이면 바퀴를 아예 못 쓴다** — 바퀴는 굼뜬 물건이라
    //   그만한 각가속을 못 낸다. 전부 추력기다
    const byWheel = burst ? 0 : Math.min(spun, Math.min(rate, RCS.wheelRate) * dt, room);
    f.wheel = Math.min(RCS.wheelCap, f.wheel + byWheel);
    // ★ 나머지는 **태운다.** 급할수록 · 바퀴가 찼을수록 많이 든다
    f.burned = (spun - byWheel) * RCS.burn * (burst ? RCS.burst.burn : 1);
  } else {
    // 안 돌릴 때 바퀴가 조금씩 풀린다 — 실제로는 자기토커·짐벌이 하는 몫
    f.wheel = Math.max(0, f.wheel - RCS.wheelDump * dt);
  }

  // ══ ★★ 짐벌 — **방은 수평을 지킨다** ══════════════════════════
  //  선체가 도는 만큼의 일부만 **새어 들어왔다가** 곧 바로 선다.
  //  ★ 완전히 안 기울게 하면 배가 도는지 몸으로 모른다. 많이 기울면
  //    걷다가 넘어지는 게임이 된다 — `maxTilt` 가 그 선이다
  const dPitch = (f.pitch - before.pitch) / Math.max(dt, 1e-6);
  const dRoll = (f.roll - before.roll) / Math.max(dt, 1e-6);
  // ★ v73 — 급기동이면 **더 기운다.** 급한 것은 눈이 아니라 몸으로 느껴야 한다
  const give = GIMBAL.give * (burst ? RCS.burst.tilt : 1);
  f.tiltX = clamp(f.tiltX + dPitch * give * dt, -GIMBAL.maxTilt, GIMBAL.maxTilt);
  f.tiltZ = clamp(f.tiltZ + dRoll * give * dt, -GIMBAL.maxTilt, GIMBAL.maxTilt);
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
  /** 한 바퀴로 접는다 — 360도를 돈 것과 0도는 같은 자세다 */
  const fold = (v) => {
    let a = Math.abs(((v % TWO) + TWO) % TWO);
    return a > Math.PI ? TWO - a : a;
  };
  const r = fold(f.roll);
  // ★ v73 — 위아래도 한계를 없앴으므로 **접는다.** 좌우에서 이미 겪은
  //   병이다: 한계로 나누던 자리를 안 고치면 벌이 NaN 이 되어 조용히 죽는다
  const p = fold(f.pitch) / Math.PI;
  // ★★★ **v69 — 옆미끄러짐도 접는다.** `max` 를 Infinity 로 열자
  //   `|yaw| / Infinity` 가 **늘 0** 이 됐다 — 즉 아무리 돌아서도
  //   「항로에서 안 벗어난 것」이 되어 v55 의 벌이 통째로 죽었다.
  //   한계를 없앨 때 **그 한계로 나누던 자리**를 같이 안 고치면 이렇게
  //   조용히 죽는다. 비틀기가 쓰던 접기를 그대로 쓴다
  const y = fold(f.yaw) / Math.PI;
  const ro = r / Math.PI;
  const w = OFF_WEIGHT;
  const sum = p * w.pitch + y * w.yaw + ro * w.roll;
  return clamp(sum / (w.pitch + w.yaw + w.roll), 0, 1);
}

/** 짐벌이 소리를 낼 만큼 기울었나 */
export const gimbalBusy = (f) =>
  Math.abs(f.tiltX) > GIMBAL.sound || Math.abs(f.tiltZ) > GIMBAL.sound;

/** 바퀴가 얼마나 찼나 0~1 — 계기가 띠로 보여준다 */
export const wheelAt = (f) => Math.max(0, Math.min(1, f.wheel / RCS.wheelCap));
/** 바퀴가 다 찼나 — 이 뒤로는 도는 것이 전부 추진제다 */
export const wheelFull = (f) => f.wheel >= RCS.wheelCap - 1e-6;

export const summary = (f) => ({
  burst: !!f.burst,
  wheel: +wheelAt(f).toFixed(2),
  burned: +(f.burned ?? 0).toFixed(4),
  pitch: +f.pitch.toFixed(3),
  yaw: +f.yaw.toFixed(3),
  roll: +f.roll.toFixed(3),
  tilt: +Math.max(Math.abs(f.tiltX), Math.abs(f.tiltZ)).toFixed(3),
  off: +offCourse(f).toFixed(3),
});
