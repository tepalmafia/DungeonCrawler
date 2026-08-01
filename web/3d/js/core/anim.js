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

/**
 * 종족마다 다른 것만 넘긴다. 나머지 타이밍은 전부 공유한다 —
 * **타이밍이 공유되어야 「같은 게임의 캐릭터」로 보인다.**
 */
export const STANCE = {
  // 기사 — 곧게 서고, 무기가 무거우며, 회복이 느리다
  knight: {
    stride: 0.72, kneeBend: 0.9, armSwing: 0.38, lean: 0.06,
    idleBreath: 0.035, idleSway: 0.05, windup: 1.25, follow: 1.5,
    guard: 0.35, weight: 1.0,
    // 검과 방패 — 검은 어깨 옆에 세우고, 방패는 몸 앞을 가린다
    restR: -0.30, restForeR: -1.05, restRz: -0.14,
    restL: -0.34, restForeL: -1.45, restLz: 0.16,
  },
  // 해골 — 가볍고 덜그럭거린다. 예비 동작이 짧고 회복이 길다(관절이 헐겁다)
  skeleton: {
    stride: 0.85, kneeBend: 1.05, armSwing: 0.5, lean: 0.05,
    idleBreath: 0.012, idleSway: 0.09, windup: 1.35, follow: 1.6,
    guard: 0.2, weight: 0.75, rattle: 0.05,
    restR: -0.24, restForeR: -0.9, restL: -0.14, restForeL: -0.5,
  },
  // 구울 — 굽은 채로 종종거린다. 팔을 크게 휘두르지 않고 할퀸다
  ghoul: {
    stride: 1.05, kneeBend: 1.3, armSwing: 0.3, lean: 0.34,
    idleBreath: 0.06, idleSway: 0.11, windup: 1.0, follow: 1.9,
    guard: 0.5, weight: 0.6,
    // 구울은 두 팔을 다 앞으로 늘어뜨린다 — 네 발로 뛸 것 같은 자세
    restR: 0.28, restForeR: -0.75, restRz: -0.2,
    restL: 0.28, restForeL: -0.75, restLz: 0.2,
  },
  // 골렘 — 느리고 무겁다. 예비 동작이 길고 멈출 때 관성이 남는다
  golem: {
    stride: 0.5, kneeBend: 0.45, armSwing: 0.22, lean: 0.03,
    idleBreath: 0.02, idleSway: 0.02, windup: 1.5, follow: 1.2,
    guard: 0.15, weight: 2.2,
    // 골렘은 팔을 거의 안 굽힌다. 길게 늘어뜨린 팔이 육중함이다
    restR: -0.06, restForeR: -0.22, restL: -0.06, restForeL: -0.22,
  },
  // 심연의 군주 — 크고 느리고 뜬다. 낫이 길어 예비 동작이 제일 길다
  lord: {
    stride: 0, kneeBend: 0, armSwing: 0.3, lean: 0.02,
    idleBreath: 0.045, idleSway: 0.06, windup: 1.55, follow: 1.7,
    guard: 0.3, weight: 2.6, float: true, floatY: 0.35,
    restR: -0.55, restForeR: -0.45, restRz: -0.16,
    restL: -0.3, restForeL: -0.6, restLz: 0.16,
  },
  // 궁수 — 다리가 없고 뜬다. 상체만 산다
  archer: {
    stride: 0, kneeBend: 0, armSwing: 0.2, lean: 0.02,
    idleBreath: 0.03, idleSway: 0.14, windup: 1.1, follow: 1.0,
    guard: 0.3, weight: 0.5, float: true, floatY: 0.28,
    // 궁수는 활을 든 팔을 앞으로 뻗는다 — 활이 실루엣 밖으로 나와야 원거리로 읽힌다
    restR: -0.95, restForeR: -0.25, restRz: -0.3,
    restL: -0.38, restForeL: -1.05, restLz: 0.22,
  },
};

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
  if (c.facing != null) {
    let d = c.facing - rig.group.rotation.y;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    rig.group.rotation.y += d * Math.min(1, dt * (c.turnRate || 14));
  }

  // ── 1. 죽음 — 다른 모든 것을 덮는다 ──────────────────────
  if (c.dieK > 0) { poseDie(rig, P, st, c, dt); return; }

  const moving = c.moving || 0;
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
  // 앉기(poseRest)만 쓰는 관절은 여기서 되돌린다. 대기·걷기가 안 건드리는 축은
  // Pose 에 값이 그대로 남으므로, **일어서도 골반과 고개가 계속 숙여져 있다.**
  // 「어떤 자세가 무엇을 건드리는가」의 합집합을 매 프레임 0 으로 놓는 자리다.
  P.set('hips', 'x', 0, 7, dt);
  P.set('head', 'x', 0, 7, dt);

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
  else restArms(rig, P, st, dt, moving);

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
  const sn = Math.sin(walkT);
  const cs = Math.cos(walkT);
  const s = st.stride;

  if (rig.thighL) {
    P.set('thighL', 'x', sn * s, 22, dt);
    P.set('thighR', 'x', -sn * s, 22, dt);
    // 무릎: 다리가 뒤로 간 쪽만 접힌다 (음수 구간만) → max(0, -sn)
    P.set('shinL', 'x', -Math.max(0, -sn) * st.kneeBend - 0.06, 20, dt);
    P.set('shinR', 'x', -Math.max(0, sn) * st.kneeBend - 0.06, 20, dt);
    // 발끝은 착지 직전에 들린다
    P.set('footL', 'x', Math.max(0, -sn) * st.kneeBend * 0.55 + 0.06, 18, dt);
    P.set('footR', 'x', Math.max(0, sn) * st.kneeBend * 0.55 + 0.06, 18, dt);
  }

  // 골반과 가슴은 **서로 반대로** 돈다. 이 비틀림이 걷기의 정체성이다
  P.set('hips', 'y', -sn * 0.14, 16, dt);
  P.set('chest', 'y', sn * 0.17, 14, dt);
  P.set('hips', 'z', cs * 0.05, 14, dt);
  P.set('spine', 'x', st.lean + 0.05, 10, dt);
  // 위아래 흔들림은 **보폭의 두 배** 주기 — 한 걸음마다 한 번 솟는다
  P.pos('root', 'y', Math.abs(Math.sin(walkT)) * 0.045 * (st.stride || 1), 18, dt);
  P.set('head', 'y', -sn * 0.06, 8, dt);   // 고개는 가슴과 반대로 = 시선 고정
}

/**
 * 공격 중이 아닐 때의 팔 — **겨눔 자세.**
 *
 * 처음에는 팔을 거의 편 채로 뒀는데, 그러면 무기가 무릎 옆에 매달려서
 * 「들고 있다」가 아니라 「끌고 다닌다」로 보였다. 시제품 첫 컷에서 기사의
 * 검이 화면 밖으로 나갈 뻔했다. 팔꿈치를 접어 무기를 **몸 앞 가슴 높이**로
 * 올리면, 가만히 서 있어도 「지금 싸우는 중」으로 읽힌다.
 */
function restArms(rig, P, st, dt, moving) {
  const swing = moving > 0.05 ? 1 : 0;
  P.set('armR', 'x', st.restR ?? -0.25, 8, dt);
  P.set('armR', 'z', st.restRz ?? 0, 8, dt);
  P.set('foreR', 'x', st.restForeR ?? -1.0, 8, dt);
  P.set('armL', 'x', (st.restL ?? -0.28) + swing * 0.05, 8, dt);
  P.set('armL', 'z', st.restLz ?? 0, 8, dt);
  P.set('foreL', 'x', st.restForeL ?? -1.15, 8, dt);
  P.set('chest', 'z', 0, 8, dt);
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
  let armX, armZ, chestY, chestZ, rootY = 0, lunge = 0, fore;

  if (k < 0.30) {                              // 예비
    const u = k / 0.30;
    const e = u * u;                           // 천천히 시작해서 가속
    armX = lerp(0, -st.windup, e);
    fore = lerp(-st.guard, -1.35, e);          // 팔꿈치를 접어 무기를 어깨 뒤로
    armZ = lerp(0, -0.42, e);
    chestY = lerp(0, -0.34, e);                // 몸통을 **반대로** 비튼다
    chestZ = lerp(0, 0.1, e);
    rootY = -0.03 * e;                         // 살짝 가라앉는다 = 힘을 모은다
  } else if (k < 0.42) {                       // 정지
    armX = -st.windup; fore = -1.35; armZ = -0.42; chestY = -0.34; chestZ = 0.1;
    rootY = -0.03;
  } else if (k < 0.60) {                       // 타격
    const u = (k - 0.42) / 0.18;
    const e = 1 - (1 - u) * (1 - u) * (1 - u); // 급가속 후 감속
    armX = lerp(-st.windup, st.follow, e);
    fore = lerp(-1.35, -0.1, Math.min(1, e * 1.6));  // 팔꿈치가 **먼저** 펴진다
    armZ = lerp(-0.42, 0.3, e);
    chestY = lerp(-0.34, 0.42, e);
    chestZ = lerp(0.1, -0.12, e);
    rootY = lerp(-0.03, 0.01, e);
    lunge = Math.sin(u * Math.PI) * 0.1 * st.weight;  // 앞으로 체중을 싣는다
  } else {                                     // 여운
    const u = (k - 0.60) / 0.40;
    armX = lerp(st.follow, -st.guard * 0.4, u);
    fore = lerp(-0.1, -st.guard, u);
    armZ = lerp(0.3, 0, u);
    chestY = lerp(0.42, 0, u);
    chestZ = lerp(-0.12, 0, u);
  }

  const r = 26;                                // 공격은 빠르게 붙어야 한다
  P.set('armR', 'x', armX, r, dt);
  P.set('armR', 'z', armZ, r, dt);
  P.set('foreR', 'x', fore, r, dt);
  P.set('chest', 'y', chestY, r * 0.8, dt);
  P.set('chest', 'z', chestZ, r * 0.8, dt);
  P.set('hips', 'y', -chestY * 0.35, r * 0.6, dt);   // 골반은 가슴을 늦게 따라간다
  P.set('head', 'y', chestY * 0.4, r * 0.5, dt);     // 고개는 표적을 계속 본다
  P.set('armL', 'x', -chestY * 0.5 - st.guard * 0.3, r * 0.7, dt);  // 반대 팔이 균형을 잡는다
  P.pos('root', 'y', rootY, 20, dt);
  P.pos('root', 'z', lunge, 22, dt);
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
