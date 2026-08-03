// 동작 — 사람 골격(core/rig.js) 하나로 idle·walk·attack·hit·die 를 만든다.
//
// ── 원칙: 몸은 한 덩어리가 아니다 ────────────────────────────
// 예전 동작이 인형처럼 보였던 이유는 **모든 관절이 동시에 움직였기** 때문이다.
// 실제 몸은 순서가 있다:
//
//   때릴 때  — 발 → 골반 → 가슴 → 어깨 → 손 (아래에서 위로 힘이 전달된다)
//   맞을 때  — 맞은 곳 → 가슴 → 머리 → 무릎 (충격이 퍼지며 무너진다)
//
// 그래서 여기 있는 모든 동작은 **관절마다 타이밍을 어긋나게** 준다. 그 어긋남
// (선행·지연)이 「무게」로 읽힌다. 폴리곤 하나 안 늘리고 얻는 품질이다.
//
// ── ctx 로 들어오는 것 ───────────────────────────────────────
//   dt      프레임 간격
//   moving  이동 속도(0 이면 정지)
//   walkT   보폭 시계 — 호출부가 굴린다(종족마다 속도가 다르므로)
//   swing   공격 진행도. **1 → 0 으로 줄어든다** (플레이어 쪽 기존 규약)
//   armX    공격 진행도를 각도로 미리 바꾼 값 (적 쪽 기존 규약)
//   hitT    피격 잔여 시간(초). 0 보다 크면 hit 이 walk/idle 위에 **겹친다**
//   hitDir  맞은 방향 — 몸 기준 로컬 (x: 좌우, z: 앞뒤)
//   dieK    죽음 진행도 0→1
//   facing  바라볼 방향(월드 yaw)

import { ease } from './rig.js';

const { lerp, clamp01, damp, springOut } = ease;
const TAU = Math.PI * 2;

/** 몸을 목표 방향으로 돌린다. 자세와 분리해 둔다 — LOD 가 건너뛰면 안 되므로. */
export function faceTowards(rig, facing, dt, rate = 14) {
  if (facing == null) return;
  let d = facing - rig.group.rotation.y;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  rig.group.rotation.y += d * Math.min(1, dt * rate);
}

/**
 * 종족마다 다른 것만 넘긴다. 나머지 타이밍은 전부 공유한다 —
 * **타이밍이 공유되어야 「같은 게임의 캐릭터」로 보인다.**
 */
export const STANCE = {
  // 기사 — 곧게 서고, 무기가 무거우며, 회복이 느리다
  knight: {
    stride: 0.72, kneeBend: 0.9, armSwing: 0.38, lean: 0.06,
    idleBreath: 0.035, idleSway: 0.05,
    // 내려베기 — 오른쪽 위에서 왼쪽 아래로. windup 이 드는 높이다.
    windup: 2.15, follow: 0.95, out: 0.55, across: 0.35,
    guard: 0.35, weight: 1.0,
    // 검과 방패 — 검은 **몸에서 떨어뜨려** 오른쪽 앞에 세운다.
    // 예전 값(restForeR −1.05)은 팔꿈치를 너무 접어 검이 가슴에 붙었다.
    restR: -0.55, restForeR: -0.62, restRz: -0.40,
    restL: -0.34, restForeL: -1.45, restLz: 0.16,
  },
  // 해골 — 가볍고 덜그럭거린다. 예비 동작이 짧고 회복이 길다(관절이 헐겁다)
  skeleton: {
    stride: 0.85, kneeBend: 1.05, armSwing: 0.5, lean: 0.05,
    idleBreath: 0.012, idleSway: 0.09,
    windup: 2.0, follow: 1.0, out: 0.5, across: 0.3,
    guard: 0.2, weight: 0.75, rattle: 0.05,
    restR: -0.45, restForeR: -0.55, restRz: -0.34, restL: -0.14, restForeL: -0.5,
  },
  // 구울 — 굽은 채로 종종거린다. 팔을 크게 휘두르지 않고 할퀸다
  ghoul: {
    stride: 1.05, kneeBend: 1.3, armSwing: 0.3, lean: 0.34,
    idleBreath: 0.06, idleSway: 0.11,
    // 구울은 내려치지 않고 **옆으로 할퀸다** — 드는 높이가 낮고 가로지름이 크다
    windup: 1.45, follow: 0.85, out: 0.95, across: 0.65,
    guard: 0.5, weight: 0.6,
    // 구울은 두 팔을 다 앞으로 늘어뜨린다 — 네 발로 뛸 것 같은 자세
    restR: 0.28, restForeR: -0.75, restRz: -0.2,
    restL: 0.28, restForeL: -0.75, restLz: 0.2,
  },
  // 골렘 — 느리고 무겁다. 예비 동작이 길고 멈출 때 관성이 남는다
  golem: {
    stride: 0.5, kneeBend: 0.45, armSwing: 0.22, lean: 0.03,
    idleBreath: 0.02, idleSway: 0.02,
    // 골렘은 **정직하게 위에서 아래로** 내려찍는다. 가로지름이 거의 없다
    windup: 2.35, follow: 1.15, out: 0.28, across: 0.1,
    guard: 0.15, weight: 2.2,
    // 골렘은 팔을 거의 안 굽힌다. 길게 늘어뜨린 팔이 육중함이다
    restR: -0.06, restForeR: -0.22, restL: -0.06, restForeL: -0.22,
  },
  // 심연의 군주 — 크고 느리고 뜬다. 낫이 길어 예비 동작이 제일 길다
  lord: {
    stride: 0, kneeBend: 0, armSwing: 0.3, lean: 0.02,
    idleBreath: 0.045, idleSway: 0.06,
    // 낫은 길다 — 크게 돌려 베는 궤적
    windup: 1.95, follow: 0.95, out: 0.7, across: 0.55,
    guard: 0.3, weight: 2.6, float: true, floatY: 0.35,
    restR: -0.55, restForeR: -0.45, restRz: -0.16,
    restL: -0.3, restForeL: -0.6, restLz: 0.16,
  },
  // 궁수 — 다리가 없고 뜬다. 상체만 산다
  archer: {
    stride: 0, kneeBend: 0, armSwing: 0.2, lean: 0.02,
    idleBreath: 0.03, idleSway: 0.14, windup: 1.1, follow: 1.0,
    // 활은 내려베기가 아니라 **당겼다 놓기**다 (poseDraw)
    ranged: true,
    guard: 0.3, weight: 0.5, float: true, floatY: 0.28,
    // 궁수는 활을 든 팔을 앞으로 뻗는다 — 활이 실루엣 밖으로 나와야 원거리로 읽힌다
    restR: -0.95, restForeR: -0.25, restRz: -0.3,
    restL: -0.38, restForeL: -1.05, restLz: 0.22,
  },
};

/**
 * 무기 계열이 자세를 덮어쓴다 — **STANCE 위에 얹는 얇은 표.**
 *
 * 예전에는 STANCE.knight 하나뿐이라 `windup 2.15 · weight 1.0` 로 고정이었다.
 * 그래서 **단검을 껴도 대검처럼 크게 휘둘렀다.** 공격 속도(aspd 0.64~1.58,
 * 2.5 배 차이)만 빨라지므로 빠른 무기일수록 큰 동작이 잘려 보였다 —
 * 「모션이 어색하다」의 상당 부분이 이것이었다.
 *
 * 종족 자세를 **대체하지 않고 덮어쓴다.** 해골이 창을 들어도 걸음걸이와
 * 덜그럭거림은 해골 것이어야 하기 때문이다. 무기는 팔이 하는 일만 바꾼다.
 */
// ── across 를 왜 계열마다 크게 잡는가 ──
//
// 무기 끝이 바닥을 뚫는 순간은 **휘두르는 끝**이 아니라 팔이 수직을 지나는
// 순간(진행도 0.52)이다. 그때 손은 바닥에서 0.79 밖에 안 되므로, 그보다 긴
// 무기는 수직으로 지나가는 한 반드시 바닥 아래로 들어간다. 대검(끝까지 1.39)은
// −0.65 까지 내려갔다 — 실측 없이는 못 찾을 값이다 (tools/weapon-audit.js).
//
// 각도를 줄이는 걸로는 못 고친다. 지나가는 지점은 그대로이기 때문이다.
// **궤적을 옆으로 눕히면**(across) 같은 순간에 팔이 몸 밖으로 벌어져 있어서
// 무기가 비스듬히 지나간다. 길수록 더 눕혀야 한다.
export const WEAPON_STANCE = {
  검: { across: 0.52, elbowExt: -0.26 },
  // 단검 — 짧고 빠르게. 크게 드는 순간이 없어야 「빠르다」가 읽힌다
  단검: {
    windup: 1.45, follow: 0.72, out: 0.42, across: 0.52, weight: 0.55,
    restR: -0.62, restForeR: -0.95, restRz: -0.30,
  },
  // 대검 — 크게 돌려 벤다. 두 손이라 왼팔이 손잡이로 온다
  대검: {
    windup: 2.42, follow: 1.10, out: 0.82, across: 0.86, weight: 1.55, twoHand: true, elbowExt: -0.62,
    restR: -0.44, restForeR: -0.80, restRz: -0.26,
  },
  // 둔기 — 위에서 아래로 정직하게 내리찍는다. 가로지름이 거의 없다
  둔기: {
    windup: 2.34, follow: 1.08, out: 0.30, across: 0.20, weight: 1.65, twoHand: true, elbowExt: -0.18,
    restR: -0.50, restForeR: -0.84, restRz: -0.20,
  },
  도끼: { windup: 2.24, follow: 1.02, out: 0.62, across: 0.52, weight: 1.30, elbowExt: -0.22 },
  지팡이: {
    windup: 1.78, follow: 0.82, out: 0.52, across: 0.64, weight: 0.72, twoHand: true, elbowExt: -0.48,
    restR: -0.52, restForeR: -0.90, restRz: -0.16,
  },
  // 창 — **베는 게 아니라 찌른다.** 궁수가 poseDraw 로 갈라지는 것과 같은 이유로
  // 갈라진다. 1.5 미터짜리를 머리 위로 들어 내려치면 그건 창이 아니다.
  창: {
    thrust: true, weight: 1.0, twoHand: true,
    restR: -0.52, restForeR: -1.02, restRz: -0.24,
  },
};

/** STANCE 하나와 무기 계열을 합친다. 자세를 만들 때 **한 번만** 부른다. */
export function stanceFor(base, fam) {
  const w = WEAPON_STANCE[fam];
  return w ? { ...base, ...w } : base;
}

/**
 * 한 프레임의 자세를 만든다.
 *
 * @param rig  skeleton() 이 돌려준 것
 * @param P    Pose (관절별 현재값 보관 — 동작이 바뀔 때 튀지 않게)
 * @param st   STANCE 항목
 * @param c    ctx
 */
export function poseHumanoid(rig, P, st, c) {
  const dt = Math.min(c.dt || 0, 0.05);      // 프레임이 튀어도 자세는 안 튄다
  const t = c.time || 0;

  // ── 0. 바라보는 방향 ────────────────────────────────────
  // 자세 LOD 가 프레임을 건너뛰면 이것도 같이 건너뛰어 **몸이 뚝뚝 돌아간다.**
  // 그래서 호출부(enemies.js)가 이걸 매 프레임 따로 부른다 — 여기서는
  // 건너뛰지 않은 프레임을 위해 한 번 더 부를 뿐이고, 두 번 불러도 안전하다.
  faceTowards(rig, c.facing, dt, c.turnRate);

  // ── 1. 죽음 — 다른 모든 것을 덮는다 ──────────────────────
  if (c.dieK > 0) { poseDie(rig, P, st, c, dt); return; }

  // **이름이 두 개다.** 플레이어는 `moved`, 적은 `moving` 을 넘긴다 — 원래
  // 포저가 파일마다 따로 있어서 각자 이름을 쓰던 흔적이다. 하나로 합치면서
  // `moving` 만 읽게 했더니 **플레이어가 한 번도 걷지 않았다.** 걷기 판정이
  // 늘 거짓이라 대기 자세로 미끄러져 다녔다.
  // 호출부를 고치는 대신 여기서 둘 다 받는다 — 산 모델로 갈아 끼울 때
  // 호출부는 안 바뀐다는 게 이 층의 약속이므로.
  const moving = c.moving ?? c.moved ?? 0;
  const walkT = c.walkT || 0;
  // 공격 진행도를 0(시작) → 1(끝) 로 통일한다.
  // swing 은 1→0, armX 는 각도라서 규약이 서로 달랐다. 여기서 한 번에 맞춘다.
  //
  // 「공격 중인가」는 진행도가 아니라 **따로** 본다. 휘두르기가 막 시작된
  // 프레임은 진행도가 정확히 0 이라, 0 을 「공격 아님」으로 치면 첫 프레임에
  // 겨눔 자세가 한 번 튀어나온다.
  const attacking = c.swing > 0 || (c.atk || 0) > 0;
  const atk = c.swing > 0 ? 1 - c.swing : (c.atk || 0);

  // ── 2. 걷기 / 서 있기 ───────────────────────────────────
  //
  // ── 기본값 ──
  //
  // **여기가 이 파일에서 제일 중요한 블록이다.** 아래 자세들은 각자 필요한
  // 관절만 건드리고, 특히 poseHit 은 `+=` 로 **더한다**. 그래서 어떤 자세도
  // 안 건드리는 축이 하나라도 있으면 그 축은 값이 **영원히 남는다.**
  //
  // 실제로 그렇게 사고가 났다: poseHit 이 root.x / root.z 를 더하는데
  // 되돌리는 곳이 없어서, 맞을 때마다 몸이 조금씩 밀려나 **모든 캐릭터가
  // 제자리에서 벗어났다.** 화면의 몸과 실제 좌표가 어긋나니 클릭도 안 맞았다.
  //
  // 규칙: **poseHit / poseRest 가 만지는 축은 전부 여기서 매 프레임 0 으로
  // 놓는다.** 뒤에 오는 자세가 필요하면 같은 키로 덮어쓰면 된다(나중 호출이 이긴다).
  P.set('hips', 'x', 0, 7, dt);
  P.set('head', 'x', 0, 7, dt);
  P.set('head', 'z', 0, 7, dt);
  P.set('chest', 'x', 0, 7, dt);      // poseIdle 이 호흡으로 덮어쓴다
  P.set('chest', 'z', 0, 8, dt);
  // 손목. poseAttack 만 만지므로 여기서 안 되돌리면 **공격이 끝나도 손목이
  // 꺾인 채로 남는다** — 위의 사고와 정확히 같은 함정이다.
  P.set('handR', 'x', 0, 9, dt);
  P.pos('root', 'x', 0, 16, dt);
  P.pos('root', 'z', 0, 16, dt);      // poseAttack 이 체중 싣기로 덮어쓴다

  if (st.float) {
    // 뜬다 — 다리 대신 몸 전체가 흔들린다.
    //
    // **floatY 를 잊으면 유령이 바닥에 주저앉는다.** 예전에는 궁수·보스의
    // update() 가 각자 group.position.y 를 직접 잡고 있었고, 그 코드를 여기로
    // 옮기면서 한 번 흘렸다. 뜨는 높이는 자세의 일부이므로 여기 있는 게 맞다.
    // **root 가 아니라 hips 에 얹는다.** root 에 뒀더니 아래의 poseAttack 이
    // 같은 관절·같은 축을 rate 20 으로 잡아당겨서(공격 중 살짝 가라앉는 연출)
    // 뜨는 높이를 매번 0 으로 끌어내렸다 — **궁수가 공격할 때마다 바닥에 앉았다.**
    // 한 관절의 한 축은 한 곳에서만 쓴다. 그게 이 층의 규칙이어야 한다.
    P.pos('hips', 'y', (st.floatY || 0.28) + Math.sin(t * 1.5 + (c.bobPhase || 0)) * 0.09, 9, dt);
    // 숨은 안 쉬지만 흔들리기는 한다 — 유령이라도 정지해 있으면 안 된다
    P.set('spine', 'z', Math.sin(t * 0.9 + (c.bobPhase || 0)) * st.idleSway, 4, dt);
    P.set('chest', 'x', -st.idleBreath * Math.sin(t * 1.15), 5, dt);
    P.set('head', 'y', Math.sin(t * 0.31) * 0.16, 2, dt);
  } else if (moving > 0.05) {
    poseWalk(rig, P, st, walkT, dt);
  } else {
    poseIdle(rig, P, st, t + (c.bobPhase || 0), dt);
  }

  // ── 3. 공격 — 걷기 위에 상체만 덮어쓴다 ──────────────────
  // 다리는 걷기가 계속 굴린다. 걸으면서 휘두르는 게 이 게임의 조작이므로
  // 공격이 다리를 뺏으면 이동이 끊겨 보인다.
  if (attacking) poseAttack(rig, P, st, clamp01(atk), dt);
  else restArms(rig, P, st, dt, moving, walkT);

  // ── 4. 피격 — 마지막에 **모든 것 위에** 겹친다 ────────────
  // 이게 없어서 지금까지 맞아도 몸이 아무 말을 안 했다.
  if (c.hitT > 0) poseHit(rig, P, st, c, dt);
}

// ───────────────────────── 서 있기 ─────────────────────────
//
// 「가만히 서 있음」이 제일 어렵다. 진짜로 안 움직이면 죽은 것처럼 보이고,
// 크게 움직이면 산만하다. 실제 사람은 **호흡(느림) + 무게중심 이동(더 느림)**
// 두 개가 서로 다른 주기로 겹쳐서, 반복이 눈에 안 띈다.
function poseIdle(rig, P, st, t, dt) {
  const breath = Math.sin(t * 1.15);          // ~5.5 초 주기
  const sway = Math.sin(t * 0.43);            // ~14 초 주기 — 호흡과 안 맞아떨어진다
  const b = st.idleBreath;

  P.set('chest', 'x', -b * 0.9 * breath, 5, dt);
  P.set('spine', 'x', b * 0.4 * breath + st.lean, 5, dt);
  P.set('hips', 'z', st.idleSway * sway, 3, dt);
  P.set('spine', 'z', -st.idleSway * 0.7 * sway, 3, dt);
  P.set('neck', 'z', st.idleSway * 0.4 * sway, 3, dt);
  // 고개는 무게중심보다 **늦게** 따라간다 — 그 지연이 살아 있음으로 읽힌다
  P.set('head', 'y', Math.sin(t * 0.31) * 0.16, 2, dt);
  P.pos('root', 'y', b * 0.5 * breath, 6, dt);

  if (rig.thighL) {
    P.set('thighL', 'x', 0.02, 6, dt); P.set('thighR', 'x', -0.02, 6, dt);
    P.set('shinL', 'x', -0.04, 6, dt); P.set('shinR', 'x', -0.04, 6, dt);
    // 발은 항상 바닥과 평행해야 한다 — 정강이가 굽은 만큼 되돌린다
    P.set('footL', 'x', 0.04, 6, dt); P.set('footR', 'x', 0.04, 6, dt);
  }
  if (st.rattle) {           // 해골은 가만히 있어도 덜그럭거린다
    P.set('head', 'z', Math.sin(t * 7.3) * st.rattle * 0.35, 12, dt);
  }
}

// ───────────────────────── 걷기 ─────────────────────────
//
// 무릎이 생기면서 처음으로 「걸음」이 된다. 핵심은 **무릎은 뒤로만 굽는다**는 것:
// 허벅지가 뒤로 갈 때 정강이가 따라 접히고, 앞으로 뻗을 때는 펴진다.
// 예전에는 다리 전체가 통짜라 앞뒤로 흔들리는 진자였다.
function poseWalk(rig, P, st, walkT, dt) {
  const phi = walkT;
  const c = Math.cos(phi), sn = Math.sin(phi);
  const stride = st.stride;

  if (rig.thighL) {
    // 허벅지 — **음수가 앞**이다. 사지는 관절에서 아래로 뻗으므로 몸통(위로
    // 뻗음)과 부호가 반대다. 이 부호를 추측했다가 한 번 틀렸으므로 적어 둔다.
    // φ=0 에서 왼발이 제일 앞(디딤), φ=π 에서 제일 뒤(차고 나감).
    P.set('thighL', 'x', -c * stride, 22, dt);
    P.set('thighR', 'x', c * stride, 22, dt);

    // 무릎 — **뒤로만 굽는다(양수).**
    //
    // 처음에 음수로 줘서 무릎이 **앞으로** 꺾였다. 새 다리처럼 보였고,
    // 그게 「걷는 게 이상하다」의 절반이었다. 사람 무릎은 한 방향으로만 굽는다.
    //
    // 굽는 때가 두 번인 것도 중요하다:
    //   · 들어 올릴 때(유각기) 크게 — 안 굽히면 발끝이 땅에 끌린다
    //   · 디딜 때(입각기) 조금 — 체중을 받아 살짝 주저앉는다. 이게 없으면
    //     통통 튀는 인형처럼 보인다.
    const kneeL = st.kneeBend * (Math.max(0, -sn) * 0.95 + Math.max(0, sn) * 0.18);
    const kneeR = st.kneeBend * (Math.max(0, sn) * 0.95 + Math.max(0, -sn) * 0.18);
    P.set('shinL', 'x', kneeL + 0.05, 20, dt);
    P.set('shinR', 'x', kneeR + 0.05, 20, dt);

    // 발목 — 발은 정강이에 매달려 있으니 무릎이 굽은 만큼 되돌려야 바닥과
    // 나란해진다. 거기에 두 가지를 더한다:
    //   · 차고 나가는 순간 발끝을 민다 (양수 = 발끝 아래)
    //   · 디디기 직전 발끝을 든다 (뒤꿈치부터 닿는다)
    const push = 0.42, lift = 0.2;
    const toeL = Math.max(0, Math.sin(phi - 2.4)) * push - Math.max(0, c) * lift;
    const toeR = Math.max(0, Math.sin(phi + Math.PI - 2.4)) * push - Math.max(0, -c) * lift;
    P.set('footL', 'x', -kneeL * 0.55 + toeL, 18, dt);
    P.set('footR', 'x', -kneeR * 0.55 + toeR, 18, dt);
  }

  // 골반과 가슴은 **서로 반대로** 돈다. 이 비틀림이 걷기의 정체성이다.
  // 앞으로 나가는 다리 쪽 골반이 따라 나가고, 어깨는 반대로 남는다.
  P.set('hips', 'y', -c * 0.13, 16, dt);
  P.set('chest', 'y', c * 0.16, 14, dt);
  // 골반은 **들린 다리 쪽이 내려간다** (지지하는 다리가 없으니까)
  P.set('hips', 'z', sn * 0.055, 14, dt);
  P.set('spine', 'x', st.lean + 0.05, 10, dt);
  P.set('head', 'y', -c * 0.09, 8, dt);   // 고개는 가슴과 반대로 = 시선 고정

  // 위아래 흔들림 — **한 걸음에 한 번**(주기의 두 배)씩 솟는다.
  // 제일 높은 때가 다리가 몸 아래를 지날 때, 제일 낮은 때가 두 발이 다 닿을 때.
  P.pos('root', 'y', (1 - Math.cos(phi * 2)) * 0.5 * 0.05 * (stride || 1), 18, dt);
}
/**
 * 공격 중이 아닐 때의 팔 — **겨눔 자세.**
 *
 * 처음에는 팔을 거의 편 채로 뒀는데, 그러면 무기가 무릎 옆에 매달려서
 * 「들고 있다」가 아니라 「끌고 다닌다」로 보였다. 시제품 첫 컷에서 기사의
 * 검이 화면 밖으로 나갈 뻔했다. 팔꿈치를 접어 무기를 **몸 앞 가슴 높이**로
 * 올리면, 가만히 서 있어도 「지금 싸우는 중」으로 읽힌다.
 */
function restArms(rig, P, st, dt, moving, walkT) {
  // 걸을 때는 **다리와 반대로** 흔든다.
  //
  // 이게 없어서 다리만 움직이고 팔은 얼어 있었다. 다리를 아무리 잘 만들어도
  // 팔이 안 흔들리면 「걷는다」가 아니라 「미끄러진다」로 보인다.
  // poseWalk 가 아니라 여기서 하는 이유는, 여기가 poseWalk **뒤에** 불려서
  // 팔을 마지막으로 잡는 곳이기 때문이다. poseWalk 에서 하면 덮인다.
  const w = moving > 0.05 ? 1 : 0;
  const c = Math.cos(walkT || 0) * w;
  const sw = st.armSwing;

  const armRx = (st.restR ?? -0.25) - c * sw;
  const foreRx = (st.restForeR ?? -1.0) - Math.max(0, c) * sw * 0.55;
  P.set('armR', 'x', armRx, 10, dt);
  P.set('armR', 'z', st.restRz ?? 0, 8, dt);
  // 팔꿈치는 앞으로 나올 때 조금 더 접힌다 — 뒤로 갈 때는 펴진다
  P.set('foreR', 'x', foreRx, 10, dt);

  if (st.twoHand) {
    // 두 손 무기는 **걸을 때도 왼손이 손잡이에 있다.** 팔을 반대로 흔들면
    // 대검을 든 채 왼팔만 앞뒤로 흔드는 꼴이 된다 — 그게 「무기가 안 무거워
    // 보인다」의 절반이다. 흔들림은 두 팔이 **같이** 받는다.
    P.set('armL', 'x', armRx * 0.84 + 0.10, 10, dt);
    P.set('armL', 'z', -0.42, 8, dt);      // 음수 = 몸을 가로질러 손잡이로
    P.set('foreL', 'x', foreRx * 0.72 - 0.36, 10, dt);
  } else {
    P.set('armL', 'x', (st.restL ?? -0.28) + c * sw, 10, dt);
    P.set('armL', 'z', st.restLz ?? 0, 8, dt);
    P.set('foreL', 'x', (st.restForeL ?? -1.15) - Math.max(0, -c) * sw * 0.55, 10, dt);
  }
}

// ───────────────────────── 공격 ─────────────────────────
//
// 네 박자다. 예전에는 두 박자(젖혔다 내린다)뿐이라 「휘둘렀다」가 아니라
// 「팔이 지나갔다」로 보였다.
//
//   0.00–0.30  예비  — 반대로 크게 젖힌다. **어디로 갈지 미리 알려주는 구간.**
//                     이게 짧으면 갑툭튀라 피할 수 없고, 길면 답답하다.
//   0.30–0.42  정지  — 젖힌 채로 아주 잠깐 멈춘다. 힘이 모인 것처럼 보인다.
//   0.42–0.60  타격  — 가장 빠른 구간. 여기서만 실제로 맞는다.
//   0.60–1.00  여운  — 지나간 뒤 몸이 따라 돌고 되돌아온다.
function poseAttack(rig, P, st, k, dt) {
  if (st.ranged) return poseDraw(rig, P, st, k, dt);
  if (st.thrust) return poseThrust(rig, P, st, k, dt);

  // 어깨 회전의 부호는 **넣어 보고** 정했다 (추측하면 반대로 나온다):
  //   armR.x 음수 = 팔이 위로·뒤로  (= 든다)      양수 = 아래로·앞으로 (= 내려친다)
  //   armR.z 음수 = 팔이 몸 밖으로  (= 벌린다)    양수 = 몸 쪽으로 (= 가로지른다)
  //
  // 그래서 이 동작은 **오른쪽 위 → 왼쪽 아래 대각선**이다. 위에서 아래로
  // 내려오면서 몸을 가로지른다 — 검을 쥔 사람이 실제로 하는 궤적이고,
  // 화면에서도 궤적이 제일 길게 보인다.
  // 타격 순간 팔꿈치를 **얼마나 펴는가.**
  //
  // 예전에는 −0.08(거의 곧게)로 고정이었다. 짧은 검은 그래도 됐지만, 긴
  // 무기는 팔이 수직을 지나는 그 순간(진행도 0.52) 무기가 팔의 연장이 되어
  // 그대로 바닥에 박힌다 — 손 높이가 0.94 인데 대검은 끝까지 1.39 다.
  // 실제로 큰 무기를 휘두르는 사람도 팔꿈치를 다 펴지 않는다. 다 펴면
  // 무기 무게에 팔이 끌려간다.
  const ext = st.elbowExt ?? -0.08;
  let armX, armZ, fore, chestY, chestZ, rootY = 0, lunge = 0;

  if (k < 0.30) {                              // 예비 — 높이 든다
    const u = k / 0.30;
    const e = u * u;
    armX = lerp(st.restR ?? -0.3, -st.windup, e);
    armZ = lerp(st.restRz ?? 0, -(st.out ?? 0.5), e);
    // **팔꿈치를 펴면서** 든다. 접은 채로 들면 검이 가슴 옆에 박힌다 —
    // 처음에 −1.35 로 접어 놨더니 「무기가 몸통에 붙어 있다」가 됐다.
    fore = lerp(st.restForeR ?? -1.0, -0.62, e);
    chestY = lerp(0, -0.36, e);                // 몸통을 반대로 비튼다
    chestZ = lerp(0, 0.12, e);
    rootY = -0.03 * e;
  } else if (k < 0.42) {                       // 정지 — 힘이 모인다
    armX = -st.windup; armZ = -(st.out ?? 0.5); fore = -0.62;
    chestY = -0.36; chestZ = 0.12; rootY = -0.03;
  } else if (k < 0.60) {                       // 타격 — 내려베기
    const u = (k - 0.42) / 0.18;
    const e = 1 - (1 - u) * (1 - u) * (1 - u);
    armX = lerp(-st.windup, st.follow, e);
    armZ = lerp(-(st.out ?? 0.5), st.across ?? 0.3, e);
    fore = lerp(-0.62, ext, Math.min(1, e * 1.5));     // 팔꿈치가 **먼저** 펴진다
    chestY = lerp(-0.36, 0.44, e);
    chestZ = lerp(0.12, -0.14, e);
    rootY = lerp(-0.03, 0.01, e);
    // 앞으로 체중을 싣는다. **작게** 둔다 — 이건 눈에 보이는 위치 이동이라
    // 벽을 등지고 때리면 그만큼 벽에 들어간다. 충돌은 이걸 모른다.
    lunge = Math.sin(u * Math.PI) * 0.045 * st.weight;
  } else if (k < 0.72) {
    // ── 여운(follow-through) ── **지나친다.**
    //
    // 예전에는 여기가 없었다. 0.60 을 넘으면 곧장 대기 자세로 보간해서,
    // 검이 최저점을 **찍고 곧바로 되돌아왔다.** 실제로는 관성 때문에 최저점을
    // 지나쳐서 잠깐 멈췄다가 되돌아온다 — 조사한 애니메이션 원칙이 이걸
    // 「물리적 무게를 알리는 주요 신호」로 꼽는다.
    //
    // 지나치는 양은 **무게에 비례**한다. 대검(1.55)은 크게 지나치고
    // 단검(0.55)은 거의 안 지나친다 — 그게 무기의 무게 차이로 읽힌다.
    const u = (k - 0.60) / 0.12;
    const over = 1 + 0.14 * (st.weight ?? 1) * Math.sin(u * Math.PI);
    armX = (st.follow) * over;
    armZ = (st.across ?? 0.3) * over;
    fore = ext;
    chestY = 0.44 * over;
    chestZ = -0.14;
  } else {                                     // 회수
    const u = (k - 0.72) / 0.28;
    armX = lerp(st.follow, st.restR ?? -0.3, u);
    armZ = lerp(st.across ?? 0.3, st.restRz ?? 0, u);
    // **팔꿈치를 먼저 접는다.** 어깨보다 두 배 빠르게 돌려놓는다.
    //
    // 이유가 둘이다. 하나는 사람이 실제로 그렇게 한다 — 큰 것부터 되돌리는
    // 게 아니라 작은 관절부터 추스른다. 다른 하나는 **바닥이다**: 어깨가
    // 되돌아오는 길에 팔이 수직을 한 번 더 지나는데, 그때 팔꿈치가 펴져
    // 있으면 대검 칼끝이 바닥 아래 0.58 까지 내려간다. 팔꿈치를 먼저 접으면
    // 그 순간 무기가 몸 쪽으로 접혀 올라온다.
    fore = lerp(ext, st.restForeR ?? -1.0, Math.min(1, u * 2));
    chestY = lerp(0.44, 0, u);
    chestZ = lerp(-0.14, 0, u);
  }

  // ── 관절마다 도착 시점을 어긋나게 한다 ──
  //
  // 「주니어 애니메이터가 가장 흔히 하는 실수는 캐릭터의 모든 요소가 같은
  // 순간에 시작하고 같은 순간에 도착하게 하는 것」 — 조사 문서의 지적이고,
  // 이 함수가 정확히 그랬다. armR·foreR·chest 가 전부 rate 26 이었다.
  // 어깨를 먼저(32), 팔꿈치를 늦게(21), 손목을 제일 늦게(16) 붙이면
  // 같은 궤적이 채찍처럼 이어진다. **값은 그대로고 타이밍만 어긋난다.**
  P.set('armR', 'x', armX, 32, dt);
  P.set('armR', 'z', armZ, 30, dt);
  P.set('foreR', 'x', fore, 21, dt);
  // 손목 — 팔꿈치가 펴진 만큼 무기 끝이 뒤늦게 따라 넘어간다
  P.set('handR', 'x', (armX - (st.restR ?? -0.3)) * 0.22, 16, dt);
  P.set('chest', 'y', chestY, 21, dt);
  P.set('chest', 'z', chestZ, 21, dt);
  P.set('hips', 'y', -chestY * 0.35, 16, dt);   // 골반은 가슴을 늦게 따라간다
  P.set('head', 'y', chestY * 0.4, 13, dt);     // 고개는 표적을 계속 본다
  if (st.twoHand) {
    // 두 손 무기 — 왼손이 **손잡이를 같이 쥔다.** 오른팔을 따라가되 조금
    // 덜 벌린다. 균형을 잡는 반대 팔(아래)과는 정반대의 움직임이라,
    // 이 갈래가 없으면 대검을 한 손으로 휘두르면서 왼팔은 뒤로 벌어진다.
    // **armL.z 는 음수여야 한다.** 왼어깨는 +X 쪽이므로 양수면 몸 **밖**으로
    // 벌어진다 — 처음에 `-armZ*0.62 + 0.26` 으로 뒀더니 예비 동작에서 0.77 이
    // 되어 왼팔이 오른손 반대편 허공으로 뻗었다. 두 손으로 쥔 게 아니라
    // 만세를 부르는 모양이었다. 몸을 가로질러야 손잡이에 닿는다.
    P.set('armL', 'x', armX * 0.84 + 0.10, 28, dt);
    P.set('armL', 'z', -0.55 + armZ * 0.35, 26, dt);
    P.set('foreL', 'x', fore * 0.72 - 0.36, 20, dt);
  } else {
    // 반대 팔이 균형을 잡는다 — 벌린 만큼 반대로 벌린다
    P.set('armL', 'x', -chestY * 0.5 + (st.restL ?? -0.3), 18, dt);
    P.set('armL', 'z', -armZ * 0.45 + (st.restLz ?? 0), 18, dt);
  }
  P.pos('root', 'y', rootY, 20, dt);
  P.pos('root', 'z', lunge, 22, dt);
}

/**
 * 찌르기 — 창 전용. 내려베기와 아예 다른 동작이라 갈라 둔다 (poseDraw 와 같은 이유).
 *
 * 해골 창병은 사거리가 2.9 다. 그 거리에서 머리 위로 크게 들어 내려치면
 * 무기가 표적 앞 허공을 지나간다 — **동작과 판정이 따로 논다.** 찌르기는
 * 팔꿈치를 펴는 것이 곧 사거리라 둘이 맞아떨어진다.
 *
 * 핵심은 **어깨가 아니라 팔꿈치**다. 어깨는 거의 안 움직이고, 접힌 팔꿈치가
 * 펴지면서 창끝이 나간다. 그래서 예비 동작에서 팔꿈치를 깊이 접는다.
 */
function poseThrust(rig, P, st, k, dt) {
  let armX, fore, chestY, lunge = 0, wrist = 0;
  const rest = st.restForeR ?? -1.0;
  if (k < 0.32) {                              // 예비 — 뒤로 뺀다
    const u = k / 0.32; const e = u * u;
    armX = lerp(st.restR ?? -0.5, -0.72, e);
    fore = lerp(rest, -1.75, e);               // 팔꿈치를 깊이 접는다
    chestY = lerp(0, -0.40, e);
  } else if (k < 0.44) {                       // 정지
    armX = -0.72; fore = -1.75; chestY = -0.40;
  } else if (k < 0.56) {                       // 찌른다 — 여기서만 맞는다
    const u = (k - 0.44) / 0.12;
    const e = 1 - (1 - u) * (1 - u) * (1 - u);
    armX = lerp(-0.72, -0.92, e);
    fore = lerp(-1.75, -0.05, e);              // 곧게 편다 = 사거리
    chestY = lerp(-0.40, 0.30, e);
    lunge = Math.sin(u * Math.PI) * 0.08 * (st.weight ?? 1);
    wrist = e * 0.10;
  } else if (k < 0.66) {                       // 여운 — 조금 더 뻗는다
    const u = (k - 0.56) / 0.10;
    armX = -0.92; fore = -0.05 + 0.03 * Math.sin(u * Math.PI);
    chestY = 0.30; lunge = 0.03 * (1 - u); wrist = 0.10;
  } else {                                     // 회수 — 뺄 때가 더 느리다
    const u = (k - 0.66) / 0.34;
    armX = lerp(-0.92, st.restR ?? -0.5, u);
    fore = lerp(-0.05, rest, u);
    chestY = lerp(0.30, 0, u);
    wrist = 0.10 * (1 - u);
  }
  P.set('armR', 'x', armX, 30, dt);
  P.set('armR', 'z', st.restRz ?? -0.24, 16, dt);
  P.set('foreR', 'x', fore, 24, dt);
  P.set('handR', 'x', wrist, 16, dt);
  P.set('chest', 'y', chestY, 20, dt);
  P.set('hips', 'y', -chestY * 0.35, 15, dt);
  P.set('head', 'y', chestY * 0.35, 12, dt);
  // 왼손이 자루 뒤쪽을 잡는다 — 두 손으로 밀어 넣는 모양
  P.set('armL', 'x', armX * 0.70 + 0.14, 26, dt);
  P.set('armL', 'z', -0.30, 20, dt);
  P.set('foreL', 'x', fore * 0.55 - 0.50, 22, dt);
  P.pos('root', 'z', lunge, 22, dt);
}

/**
 * 활 당기기 — 궁수 전용. 내려베기와는 아예 다른 동작이라 갈라 둔다.
 *
 * 활을 든 팔(오른손)은 **앞으로 뻗어 고정**하고, 반대 손이 시위를 당긴다.
 * 「든 팔이 흔들리면」 활을 쏘는 것으로 안 보인다 — 고정된 쪽이 있어야 한다.
 */
function poseDraw(rig, P, st, k, dt) {
  let bowX, drawX, drawFore, chestY;
  if (k < 0.42) {                              // 당긴다
    const u = k / 0.42;
    bowX = lerp(st.restR ?? -0.95, -1.25, u);
    drawX = lerp(st.restL ?? -0.4, -1.05, u);
    drawFore = lerp(st.restForeL ?? -1.0, -1.9, u);   // 팔꿈치를 뒤로 접는다
    chestY = lerp(0, 0.22, u);
  } else if (k < 0.52) {                       // 놓는다 — 시위가 튄다
    const u = (k - 0.42) / 0.10;
    bowX = -1.25;
    drawX = lerp(-1.05, -0.5, u);
    drawFore = lerp(-1.9, -0.35, u);
    chestY = lerp(0.22, -0.06, u);
  } else {                                     // 되돌아온다
    const u = (k - 0.52) / 0.48;
    bowX = lerp(-1.25, st.restR ?? -0.95, u);
    drawX = lerp(-0.5, st.restL ?? -0.4, u);
    drawFore = lerp(-0.35, st.restForeL ?? -1.0, u);
    chestY = lerp(-0.06, 0, u);
  }
  P.set('armR', 'x', bowX, 22, dt);
  P.set('armR', 'z', st.restRz ?? -0.3, 14, dt);
  P.set('foreR', 'x', st.restForeR ?? -0.25, 18, dt);
  P.set('armL', 'x', drawX, 24, dt);
  P.set('armL', 'z', st.restLz ?? 0.22, 14, dt);
  P.set('foreL', 'x', drawFore, 26, dt);
  P.set('chest', 'y', chestY, 16, dt);
  P.set('head', 'y', -chestY * 0.6, 12, dt);
}

// ───────────────────────── 피격 ─────────────────────────
//
// **새로 만든 동작.** 지금까지 맞으면 몸통이 통째로 뒤로 밀리고 납작해질 뿐이었다.
// 그건 「밀렸다」지 「맞았다」가 아니다.
//
// 세 가지를 한다:
//   1. 방향  — 맞은 쪽에서 **멀어지게** 상체가 꺾인다. 옆에서 맞으면 옆으로 접힌다.
//   2. 순서  — 가슴이 먼저 꺾이고, 머리가 뒤늦게 따라 젖혀지고, 무릎이 마지막에 꺾인다.
//   3. 되돌아옴 — 스프링으로 튕기며 잦아든다. 그냥 감쇠하면 「스르륵」이라 안 아프다.
//
// hit 은 다른 동작을 **대체하지 않고 위에 더한다.** 맞았다고 걸음이 멈추면
// 조작감이 끊긴다 — 비틀거리면서도 계속 움직여야 한다.
function poseHit(rig, P, st, c, dt) {
  const dur = c.hitDur || 0.42;
  const k = clamp01(1 - c.hitT / dur);          // 0 = 방금 맞음
  // 앞 15% 는 즉발(damp 없이), 나머지는 튕기며 잦아든다
  const punch = k < 0.15 ? k / 0.15 : springOut((k - 0.15) / 0.85);
  // 무거운 것은 덜 흔들린다. 골렘(2.2)은 휘청이지 않고 버틴다 — 그게 골렘이다.
  // 위쪽은 막아 둔다: 해골(0.75)에서 1.33 이 나오는데, 그 이상 가면 팔이 직각으로
  // 벌어져 「맞았다」가 아니라 「분해됐다」로 보인다.
  const amp = Math.min(1.35, (c.hitPow || 1) / (st.weight || 1));

  // hitDir 은 몸 기준 로컬. z>0 = 정면에서 맞음 → 뒤로 젖혀진다
  const dz = c.hitDirZ ?? 1;
  const dx = c.hitDirX ?? 0;

  const bend = punch * amp * 0.55;
  rig.chest.rotation.x += -dz * bend;
  rig.chest.rotation.z += dx * bend * 0.9;
  rig.spine.rotation.x += -dz * bend * 0.45;

  // 머리는 가슴보다 **늦게** 젖혀진다 (지연 0.06)
  const hk = clamp01(1 - (c.hitT + 0.06) / dur);
  const hp = hk < 0.15 ? hk / 0.15 : springOut((hk - 0.15) / 0.85);
  rig.head.rotation.x += -dz * hp * amp * 0.75;
  rig.head.rotation.z += dx * hp * amp * 0.6;

  // 팔은 힘이 빠져 바깥으로 튕긴다
  if (rig.armR) { rig.armR.rotation.z += -punch * amp * 0.38; rig.armR.rotation.x += punch * amp * 0.26; }
  if (rig.armL) { rig.armL.rotation.z += punch * amp * 0.38; rig.armL.rotation.x += punch * amp * 0.26; }

  // 무릎은 제일 늦게, 그리고 방향과 무관하게 꺾인다 (충격을 받는다)
  if (rig.shinL) {
    const kk = clamp01(1 - (c.hitT + 0.1) / dur);
    const kp = kk < 0.2 ? kk / 0.2 : springOut((kk - 0.2) / 0.8);
    rig.shinL.rotation.x += -Math.abs(kp) * amp * 0.42;
    rig.shinR.rotation.x += -Math.abs(kp) * amp * 0.42;
    rig.root.position.y -= Math.abs(kp) * amp * 0.06;
  }
  // 몸 전체가 맞은 방향으로 밀린다 — 기존의 리코일과 같은 값이지만 여기서는
  // **관절 반응과 같은 시계**를 쓰므로 밀림과 꺾임이 어긋나지 않는다
  rig.root.position.z += -dz * punch * amp * 0.09;
  rig.root.position.x += dx * punch * amp * 0.09;
}

// ───────────────────────── 죽음 ─────────────────────────
//
// 예전에는 z 축으로 90 도 돌리는 게 전부라 **막대가 쓰러지듯** 넘어갔다.
// 실제로는 무릎이 먼저 풀리고, 골반이 내려앉고, 상체가 마지막에 넘어간다.
function poseDie(rig, P, st, c, dt) {
  const k = clamp01(c.dieK);
  const knee = clamp01(k / 0.35);               // 0.00–0.35 무릎이 풀린다
  const drop = clamp01((k - 0.2) / 0.5);        // 0.20–0.70 골반이 내려앉는다
  const fall = clamp01((k - 0.35) / 0.65);      // 0.35–1.00 상체가 넘어간다
  const f = fall * fall;                        // 가속하며 넘어간다

  if (rig.thighL) {
    rig.thighL.rotation.x = knee * 0.9;
    rig.thighR.rotation.x = knee * 1.15;
    rig.shinL.rotation.x = -knee * 2.0;
    rig.shinR.rotation.x = -knee * 1.7;
  }
  // 뜨는 것은 뜬 높이에서 내려앉는다 — 골반 높이만큼 떨구면 바닥을 뚫는다.
  // 높이가 hips 에 얹혀 있으므로(위 참조) 여기서도 hips 를 쓴다.
  if (st.float) {
    const base = st.floatY || 0.28;
    rig.hips.position.y = rig.dim.hipY + base * (1 - drop) - drop * 0.15;
    rig.root.position.y = 0;
  } else {
    rig.root.position.y = -drop * (rig.dim.hipY * 0.72);
  }
  rig.hips.rotation.x = f * 0.5;
  rig.spine.rotation.x = f * 0.85;
  rig.chest.rotation.x = f * 0.6;
  rig.chest.rotation.z = f * 0.35;              // 옆으로 비틀며 무너진다
  rig.head.rotation.x = f * 0.9;                // 고개가 마지막에 떨군다
  if (rig.armR) { rig.armR.rotation.x = f * 1.5; rig.armR.rotation.z = -f * 0.5; }
  if (rig.armL) { rig.armL.rotation.x = f * 1.3; rig.armL.rotation.z = f * 0.6; }
  if (rig.foreR) rig.foreR.rotation.x = -f * 0.6;
  if (rig.foreL) rig.foreL.rotation.x = -f * 0.5;
}

/** 앉기 — 휴식(C). 무릎을 접고 상체를 낮춘다. */
export function poseRest(rig, P, st, r, dt) {
  P.pos('root', 'y', -rig.dim.hipY * 0.55 * r, 6, dt);
  P.set('hips', 'x', 0.12 * r, 6, dt);
  P.set('spine', 'x', 0.26 * r, 6, dt);
  P.set('chest', 'x', 0.1 * r, 6, dt);
  P.set('head', 'x', 0.18 * r, 5, dt);
  if (rig.thighL) {
    P.set('thighL', 'x', -1.25 * r, 6, dt); P.set('thighR', 'x', -0.5 * r, 6, dt);
    P.set('shinL', 'x', -1.5 * r, 6, dt); P.set('shinR', 'x', -1.9 * r, 6, dt);
    P.set('footL', 'x', 0.6 * r, 6, dt); P.set('footR', 'x', 0.9 * r, 6, dt);
  }
  P.set('armR', 'x', -0.55 * r, 6, dt); P.set('foreR', 'x', -0.9 * r, 6, dt);
  P.set('armL', 'x', -0.5 * r, 6, dt); P.set('foreL', 'x', -1.0 * r, 6, dt);
}
