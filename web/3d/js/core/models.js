// 몸 — 전사와 몬스터 넷. **형태는 단면 쌓기(core/form.js)로 짓는다.**
//
// ── 왜 통째로 다시 썼는가 ────────────────────────────────────
// 예전 판은 관절 하나에 각기둥 하나를 매다는 방식이었다. 부위를 34 개까지
// 늘리고 모따기를 8 각으로 올려도 형태가 안 나왔는데, 이유가 부위 수나
// 폴리곤이 아니었다 — **한 부위 안에서 굵기가 안 변했기 때문**이다.
//
// 사람 몸의 실루엣은 전부 거기서 나온다:
//
//   · 어깨에서 허리로 좁아졌다가 골반에서 다시 벌어진다 (V 자)
//   · 허벅지는 위가 굵고 무릎에서 잘록하다
//   · 종아리는 **위쪽 1/4 이 가장 굵다** — 가운데가 아니다
//   · 팔뚝은 팔꿈치 바로 아래가 굵고 손목에서 절반으로 준다
//
// 도형 하나로는 못 한다. 높이마다 단면을 놓고 이어 붙인다(loft). 링 네댓
// 개면 위 곡선이 다 나오고, 위 규칙을 **숫자로 그대로** 옮길 수 있다.
// 아래의 `[0.24, 0.190, 0.205]` 같은 줄이 그 규칙 한 줄씩이다.
//
// 골렘만 예외로 **깨진 돌덩이(rock)** 를 쓴다. 살과 갑옷에 쓰면 「관절에
// 매단 풍선」이 되지만 바위한테는 그게 맞다.
//
// ── 그리고 플레이어는 사람이다 ───────────────────────────────
// 예전 기사는 얼굴 없는 통조림이었다. 몬스터 넷이 전부 얼굴 없는 것들이라
// **그 대비가 곧 주인공**이 된다 — 얼굴이 있는 쪽이 하나뿐이면 그쪽이 「나」다.
// 다만 이목구비를 세공하지는 않는다. 이 크기에서 얼굴로 읽히는 것은
// **눈두덩 그늘 · 코의 능선 · 수염 덩어리** 셋이고, 그 위치만 맞으면 된다.
//
// 골격(rig.js)은 그대로 18 관절이다 — 동작 코드는 한 줄도 안 바뀐다.

import * as THREE from 'three';
import { prism, slab, spike, Part, skeleton } from './rig.js';
import { loft, limb, snout, arc, rock } from './form.js';
import { attachWeapon, attachBuckler } from './weapons.js';

function M(color, opt = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1, ...opt });
}

/** 뜯긴 천 조각 — 아래가 좁아지는 판. 길이를 다르게 겹치면 넝마가 된다 */
const tatter = (w, h, d = 0.02) => prism(w * 0.35, d, h, w, d, { sides: 4 });

/** 모든 몸이 공통으로 하는 마무리 */
function done(rig, mats) {
  rig.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  rig.mats = mats;
  rig.materials = mats;
  return rig;
}

/** 발광하는 눈 — 몬스터용. 뒤에 가산 원반이 없으면 「밝은 점」으로 끝난다 */
function eyes(head, color, x, y, z, w = 0.03, h = 0.024) {
  const mat = new THREE.MeshBasicMaterial({ color });
  const g = prism(w, h * 0.8, h, w, h * 0.8, { hang: false, sides: 4 });
  for (const sx of [x, -x]) {
    const e = new THREE.Mesh(g, mat);
    e.position.set(sx, y, z);
    head.add(e);
  }
  return mat;
}

/**
 * **속의 불** — 골렘의 심장에서 온 것. 몬스터마다 하나씩 가진다.
 * 어두운 던전에서는 이게 형태보다 먼저 읽히고, 「속이 비지 않았다」가 된다.
 */
function core(parent, color, r, x, y, z) {
  const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0),
    new THREE.MeshBasicMaterial({ color }));
  c.position.set(x, y, z);
  parent.add(c);
  return c;
}

// ═══════════════════════════ 전사 (사람) ═══════════════════════════
//
// 실루엣 규칙: **어깨가 제일 넓고, 허리가 잘록하고, 투구 위가 뾰족하다.**
// 던전은 어두워서 대부분 역광 실루엣으로만 읽힌다 — 그 셋만 지키면
// 멀리서도 「내 캐릭터」로 구분된다. 거기에 하나 더: **얼굴이 보인다.**
export function buildKnight() {
  // 색은 참고본(어둠의 던전)을 따른다 — **은백색 판금 + 청보라 천 + 금테.**
  // 예전 붉은 망토는 던전 바닥·횃불과 같은 계열이라 배경에 묻혔다.
  // 청보라는 이 던전에 **없는 색**이라 어디에 서 있어도 주인공이 먼저 보인다.
  const skin = M(0xd8ae8a, { roughness: 0.82, metalness: 0 });
  const hair = M(0x8a6a3c, { roughness: 0.95, metalness: 0 });
  const steel = M(0xc4c9d6, { metalness: 0.82, roughness: 0.30 });
  const dark = M(0x3a3a5c, { metalness: 0.35, roughness: 0.62 });
  const gold = M(0xd8b24c, { metalness: 0.9, roughness: 0.26 });
  const cloth = M(0x4a4a8c, { roughness: 0.96, metalness: 0.02 });
  const leather = M(0x5a4630, { roughness: 0.9, metalness: 0.04 });
  const bladeMat = M(0xe2e6ee, { metalness: 0.92, roughness: 0.14 });

  // hipY 는 **허벅지 + 정강이 + 발목 높이**여야 한다. 처음에 허벅지+정강이만
  // 더해 놨더니 발목까지 바닥에 파묻혀 부츠가 잘려 나왔다.
  // ── 비율 ── **머리 다섯 개 반 키.** 여덟 개가 아니다.
  //
  // 처음엔 실사 영웅 비율(8 등신)로 잡았다. 정지 컷에서는 멋있었는데
  // **게임 화면에서 캐릭터는 90 픽셀**이고, 거기서 8 등신은 머리가 11 픽셀이라
  // 그냥 막대기가 된다. 스프라이트 액션 RPG 가 전부 5~6 등신인 이유가 그거다 —
  // 작게 줄여도 머리·어깨·무기가 각각 읽히게 하려면 그 비율이어야 한다.
  //
  // 다리를 20% 줄이고 어깨를 넓히고 머리를 키운다. 키(1.6)는 게임 격자에
  // 맞춰 유지하고 **안에서 비율만 바꾼다** — 충돌·카메라는 그대로여야 한다.
  const rig = skeleton({
    hipY: 0.84, legX: 0.16, thigh: 0.35, shin: 0.33,
    spineY: 0.05, chestY: 0.29, neckY: 0.13, headY: 0.05,
    armX: 0.33, armY: 0.13, upper: 0.28, fore: 0.26,
  });
  // 머리는 통째로 키운다 — 두개골·투구·머리카락·눈이 다 따라온다.
  // 부위마다 숫자를 고치는 것보다 안 틀리고, 비율만 바꾸는 것이 목적이다
  rig.head.scale.setScalar(1.42);

  // ── 다리 ──
  // 허벅지: 사타구니 쪽이 제일 굵고 무릎에서 2/3 로 준다
  // 종아리: **위에서 1/4 지점이 최대.** 가운데를 최대로 하면 소시지가 된다
  for (const [th, sh, ft] of [[rig.thighL, rig.shinL, rig.footL], [rig.thighR, rig.shinR, rig.footR]]) {
    // 짧아진 만큼 **굵어진다.** 길이만 줄이면 난쟁이가 아니라 잘린 사람이 된다
    new Part(th).add(limb(0.35, [
      [0.00, 0.275, 0.285], [0.16, 0.280, 0.290], [0.62, 0.225, 0.240], [1.00, 0.195, 0.210],
    ], { round: 2.3 }), dark)
      .add(loft([{ y: -0.24, w: 0.235, d: 0.135 }, { y: -0.13, w: 0.275, d: 0.150 }, { y: -0.02, w: 0.250, d: 0.140 }],
        { round: 3.2 }), steel, { z: 0.088 })        // 넓적다리 판
      .finish();
    new Part(sh).add(limb(0.33, [
      [0.00, 0.205, 0.220], [0.24, 0.225, 0.240], [0.70, 0.150, 0.165], [1.00, 0.125, 0.142],
    ], { round: 2.3 }), dark)
      .add(loft([{ y: -0.235, w: 0.160, d: 0.115 }, { y: -0.125, w: 0.205, d: 0.140 }, { y: -0.01, w: 0.218, d: 0.148 }],
        { round: 3.4 }), steel, { z: 0.065 })        // 정강이받이
      .add(loft([{ y: -0.05, w: 0.175, d: 0.120 }, { y: 0.01, w: 0.220, d: 0.155 }, { y: 0.06, w: 0.185, d: 0.130 }],
        { round: 3.0 }), steel, { z: 0.035 })        // 무릎덮개
      .finish();
    // 발 — **크다.** 스프라이트 비율에서 발이 작으면 캐릭터가 넘어질 것처럼 보인다
    new Part(ft).add(snout(0.30, [
      [0.00, 0.175, 0.140], [0.30, 0.195, 0.165], [0.80, 0.150, 0.115], [1.00, 0.080, 0.065],
    ], { round: 2.8 }), steel, { y: -0.062, z: -0.06 }).finish();
  }

  // ── 골반 ── 위는 허리로 좁아지고 아래는 다시 벌어진다
  new Part(rig.hips)
    .add(loft([
      { y: -0.15, w: 0.335, d: 0.250 }, { y: -0.07, w: 0.395, d: 0.285 },
      { y: 0.02, w: 0.375, d: 0.262 }, { y: 0.07, w: 0.345, d: 0.240 },
    ], { round: 2.9 }), dark)
    .add(arc(0.200, 0.024, Math.PI * 2, 18), gold, { y: 0.035, rx: Math.PI / 2, sz: 0.78 })
    .add(tatter(0.19, 0.30), cloth, { y: 0.02, z: 0.155 })
    .finish();

  // ── 허리 ── **여기가 제일 가늘다.** V 자의 아래 꼭짓점
  new Part(rig.spine)
    .add(loft([
      { y: -0.02, w: 0.360, d: 0.250 }, { y: 0.08, w: 0.345, d: 0.235 },
      { y: 0.26, w: 0.420, d: 0.268 },
    ], { round: 2.9 }), steel)
    .finish();

  // ── 가슴 ──
  // **단면 높이가 관절과 맞아야 한다.** 위쪽 단을 0.34 까지 올린 적이 있는데,
  // 목 관절이 로컬 0.22 · 머리가 0.32 라서 **가슴이 머리를 통째로 삼켰다.**
  // 화면에는 목 없는 갑옷 덩어리가 나왔다 — 단면 높이는 장식이 아니라
  // 골격과 맞물리는 치수다.
  const ch = new Part(rig.chest)
    .add(loft([
      { y: 0.00, w: 0.420, d: 0.268 }, { y: 0.09, w: 0.530, d: 0.305 },
      { y: 0.170, w: 0.575, d: 0.305 }, { y: 0.235, w: 0.500, d: 0.272 },
      { y: 0.275, w: 0.340, d: 0.220 },
    ], { round: 3.0 }), steel)
    // 가슴받이 — 몸통보다 살짝 앞에 덧댄 판. 두 겹이라야 「입은 것」이다
    .add(loft([
      { y: 0.01, w: 0.265, d: 0.105 }, { y: 0.11, w: 0.370, d: 0.115 }, { y: 0.205, w: 0.345, d: 0.105 },
    ], { round: 3.4 }), steel, { z: 0.118 })
    .add(slab(0.12, 0.17, 0.03, 0.02), gold, { y: 0.12, z: 0.190 })
    .add(arc(0.168, 0.017, Math.PI, 14), gold, { y: 0.245, z: 0.065, rx: Math.PI / 2 });
  for (let i = 0; i < 3; i++) {                 // 망토 — 세 장이면 충분하다
    const t = i - 1;
    ch.add(tatter(0.24, 0.56 - Math.abs(t) * 0.09), cloth,
      { x: t * 0.215, y: 0.13, z: -0.163, rx: 0.12, rz: -t * 0.14 });
  }
  ch.finish();

  // ── 팔 ── 삼각근에서 팔꿈치로 좁아지고, 팔뚝은 **팔꿈치 바로 아래**가 굵다
  for (const [g, s] of [[rig.armL, 1], [rig.armR, -1]]) {
    new Part(g)
      .add(limb(0.28, [
        [0.00, 0.205, 0.210], [0.18, 0.222, 0.222], [0.70, 0.168, 0.172], [1.00, 0.152, 0.160],
      ], { round: 2.3 }), dark)
      // 어깨 갑주 — **여기를 제일 키웠다.** 스프라이트 캐릭터가 작게 줄어도
      // 「기사」로 읽히는 것은 어깨의 둥근 덩어리 둘 덕분이다
      .add(loft([
        { y: -0.150, w: 0.300, d: 0.300 }, { y: -0.055, w: 0.385, d: 0.372 },
        { y: 0.045, w: 0.372, d: 0.360 }, { y: 0.098, w: 0.265, d: 0.258 },
      ], { round: 2.6, capB: false }), steel, { rz: s * 0.15 })
      .add(arc(0.192, 0.023, Math.PI * 1.4, 16), gold, { y: -0.050, rx: Math.PI / 2, rz: s * 0.15 })
      .add(spike(0.040, 0.15, 5), gold, { x: s * 0.18, y: 0.035, rz: s * 0.95 })
      .finish();
  }
  for (const g of [rig.foreL, rig.foreR]) {
    new Part(g)
      .add(limb(0.26, [
        [0.00, 0.160, 0.170], [0.22, 0.180, 0.188], [0.75, 0.110, 0.118], [1.00, 0.096, 0.104],
      ], { round: 2.3 }), dark)
      .add(loft([{ y: -0.225, w: 0.120, d: 0.090 }, { y: -0.13, w: 0.180, d: 0.125 }, { y: -0.03, w: 0.198, d: 0.138 }],
        { round: 3.2 }), steel, { z: 0.042 })       // 팔뚝받이
      .finish();
  }
  // 손 — 주먹 하나. 손가락은 이 크기에서 안 보인다
  for (const g of [rig.handL, rig.handR]) {
    new Part(g).add(limb(0.15, [
      [0.00, 0.135, 0.148], [0.45, 0.162, 0.175], [1.00, 0.130, 0.142],
    ], { round: 3.0 }), steel).finish();
  }

  // ── 목 ── 살이 보여야 머리와 몸이 이어진다. 뒤는 목가리개로 가린다
  new Part(rig.neck)
    .add(limb(0.10, [[0, 0.140, 0.140], [1, 0.128, 0.128]], { round: 2.2 }), skin)
    .add(arc(0.132, 0.022, Math.PI * 1.25, 14), steel, { y: -0.040, rx: Math.PI / 2, ry: Math.PI })
    .finish();

  // ── 머리 ── 턱끝 → 턱 → 광대 → 관자 → 정수리. **다섯 단이면 두개골이 된다**
  new Part(rig.head)
    .add(loft([
      { y: -0.100, w: 0.120, d: 0.140, cz: 0.012 },
      { y: -0.045, w: 0.170, d: 0.200, cz: 0.010 },
      { y: 0.020, w: 0.205, d: 0.235 },
      { y: 0.095, w: 0.200, d: 0.235, cz: -0.006 },
      { y: 0.165, w: 0.152, d: 0.180, cz: -0.012 },
      { y: 0.205, w: 0.070, d: 0.090, cz: -0.015 },
    ], { round: 2.4 }), skin)
    // 코 — **능선 하나면 된다.** 콧구멍을 만들면 이 크기에서 얼룩이 된다
    .add(loft([
      { y: -0.020, w: 0.048, d: 0.055 }, { y: 0.030, w: 0.036, d: 0.048 }, { y: 0.070, w: 0.026, d: 0.030 },
    ], { round: 2.2 }), skin, { z: 0.098 })
    .finish();
  // 눈두덩 그늘 · 눈 · 수염 · 뒷머리
  new Part(rig.head)
    .add(arc(0.082, 0.017, Math.PI, 12), skin, { y: 0.075, z: 0.070, rx: Math.PI / 2, ry: Math.PI / 2 })
    // 눈은 **판이 아니라 구멍**이라 그늘에 묻히기 쉽다. 확대해 보니 수염과
    // 구분이 안 돼서 조금 키우고 앞으로 냈다
    .mirror(loft([{ y: -0.017, w: 0.060, d: 0.034 }, { y: 0.016, w: 0.050, d: 0.028 }], { round: 2.2, seg: 10 }),
      dark, { x: 0.048, y: 0.044, z: 0.092 })
    // 수염 — 턱을 감싼다. 턱선이 무거워야 「어른」으로 보인다
    .add(loft([
      { y: -0.105, w: 0.128, d: 0.150, cz: 0.012 },
      { y: -0.050, w: 0.180, d: 0.212, cz: 0.010 },
      { y: 0.005, w: 0.196, d: 0.230 },
    ], { round: 2.4, capT: false }), hair, { z: -0.004 })
    .add(loft([
      { y: 0.010, w: 0.190, d: 0.130 }, { y: 0.100, w: 0.210, d: 0.150 }, { y: 0.175, w: 0.160, d: 0.120 },
    ], { round: 2.6 }), hair, { z: -0.055 })
    .finish();

  // ── 투구 ── 정수리 그릇 + 볼가리개 + 콧대. 얼굴 앞은 **비워 둔다**
  const helm = new Part(rig.head)
    .add(loft([
      { y: 0.090, w: 0.246, d: 0.268, cz: -0.008 },
      { y: 0.150, w: 0.238, d: 0.256, cz: -0.010 },
      { y: 0.205, w: 0.180, d: 0.196, cz: -0.014 },
      { y: 0.240, w: 0.085, d: 0.095, cz: -0.016 },
    ], { round: 2.5, capB: false }), steel)
    .mirror(loft([
      { y: -0.055, w: 0.030, d: 0.135 }, { y: 0.020, w: 0.034, d: 0.175 }, { y: 0.085, w: 0.034, d: 0.190 },
    ], { round: 3.0 }), steel, { x: 0.108 })
    .add(loft([{ y: -0.035, w: 0.030, d: 0.045 }, { y: 0.085, w: 0.036, d: 0.050 }], { round: 3.0 }),
      steel, { z: 0.115 })                                    // 콧대
    .add(arc(0.150, 0.016, Math.PI * 2, 20), gold, { y: 0.094, rx: Math.PI / 2, sz: 1.06 })
    .add(spike(0.032, 0.125, 5), gold, { x: 0.115, y: 0.185, rz: -0.45 })
    .add(spike(0.032, 0.125, 5), gold, { x: -0.115, y: 0.185, rz: 0.45 });
  for (let i = 0; i < 4; i++) {                     // 볏
    helm.add(tatter(0.055, 0.12), cloth, { y: 0.225, z: 0.01 - i * 0.05, rx: -0.25 - i * 0.07 });
  }
  helm.finish();

  // ── 방패 ──
  //
  // **손이 아니라 아래팔에 단다.** 손에 달았더니 팔이 내려간 대기 자세에서
  // 방패가 무릎 옆에 매달려 「들고 있다」로 안 보였다. 실제로도 방패는 팔뚝의
  // 끈으로 고정한다.
  //
  // 그리고 **받침 그룹**에 얹는다. 아래팔에 바로 붙였더니 겨눔 자세에서
  // 아래팔이 1.45 라디안 접히는 만큼 방패도 같이 누워 가슴 높이에 널빤지가
  // 가로로 걸린 꼴이 됐다. 받침이 그 접힘을 되돌려 준다.
  const sm = new THREE.Group();
  sm.position.set(0, -0.16, 0.04);
  sm.rotation.x = 1.45;              // = -(restL + restForeL), anim.js 의 기사 자세
  rig.foreL.add(sm);
  new Part(sm)
    .add(loft([
      { y: -0.30, w: 0.075, d: 0.045 }, { y: -0.16, w: 0.300, d: 0.070 },
      { y: 0.00, w: 0.380, d: 0.085 }, { y: 0.14, w: 0.360, d: 0.070 }, { y: 0.20, w: 0.300, d: 0.050 },
    ], { round: 2.8 }), leather, { y: -0.02, z: 0.12, ry: -0.34 })
    .add(arc(0.058, 0.018, Math.PI * 2, 14), gold, { y: -0.02, z: 0.165, ry: -0.34 })
    .add(loft([{ y: 0.0, w: 0.085, d: 0.085 }, { y: 0.05, w: 0.045, d: 0.045 }], { round: 2.2 }),
      steel, { y: -0.02, z: 0.155, rx: Math.PI / 2, ry: -0.34 })
    .finish();
  rig.shield = sm;

  // ── 등의 검집 ── **비어 있다.**
  //
  // 검은 손에 들려야 싸울 수 있으니 등에 또 한 자루를 매달면 두 자루가 된다.
  // 그래서 칼집만 단다 — 「저기서 뽑아 든 것」이라는 설명이 되고, 등이
  // 밋밋하지 않아 뒤에서 봐도 실루엣이 산다. 대각선으로 매야 어깨 너머로
  // 삐져나오는 선이 생긴다(세로로 매면 망토에 묻힌다).
  const scab = new THREE.Group();
  // 칼집 입구가 머리 뒤를 가로지르지 않게 내려 단다 — 어깨 너머로만 나온다
  scab.position.set(-0.02, -0.02, -0.145);
  scab.rotation.set(-0.18, 0, 0.50);
  rig.chest.add(scab);
  new Part(scab)
    .add(loft([
      { y: -0.34, w: 0.048, d: 0.030 }, { y: -0.26, w: 0.070, d: 0.042 },
      { y: 0.22, w: 0.082, d: 0.048 }, { y: 0.30, w: 0.076, d: 0.044 },
    ], { round: 3.4, seg: 10 }), leather)
    .add(arc(0.045, 0.012, Math.PI * 2, 10), gold, { y: 0.28, rx: Math.PI / 2, sz: 0.6 })
    .add(arc(0.038, 0.012, Math.PI * 2, 10), gold, { y: -0.24, rx: Math.PI / 2, sz: 0.6 })
    .finish();
  rig.scabbard = scab;

  // ── 무기 (오른손) ── 계열별 메시는 core/weapons.js 가 만든다.
  // 예전에는 여기서 **검 하나를 고정으로** 만들어서 대검을 껴도 한손검이
  // 보였다. 지금은 팔레트만 넘기고 player.js 의 _syncWeapon() 이 갈아 끼운다.
  rig.weaponPal = { wrap: leather, dark, accent: gold, bladeMat };
  rig.bladeMat = bladeMat;
  attachWeapon(rig, '검', rig.weaponPal);
  rig.stance = 'knight';
  return done(rig, [skin, hair, steel, dark, gold, cloth, leather, bladeMat]);
}

// ═══════════════════════════ 해골 병사 ═══════════════════════════
// 실루엣: **키가 크고 얇다.** 갈비 사이가 비어 뒤가 비쳐 보인다.
//
// 뼈도 단면으로 짓는다. 「뼈는 매끈한데?」 싶지만, 사람 뼈는 **가운데가
// 가늘고 양 끝이 굵다** — 각기둥으로 만든 뼈가 대나무처럼 보였던 이유가
// 정확히 그것이다. 관절머리를 위아래 둘 다 넣으면 그것만으로 뼈가 된다.
export function buildSkeleton(opt = {}) {
  const bone = M(0xc9bfa4, { roughness: 0.68, metalness: 0.03 });
  const rag = M(0x3d3846, { roughness: 1 });
  const rust = M(0x7a6449, { roughness: 0.62, metalness: 0.55 });
  const bladeMat = M(0x9aa2b0, { metalness: 0.75, roughness: 0.45 });

  const rig = skeleton({
    hipY: 0.84, legX: 0.11, thigh: 0.40, shin: 0.38,
    spineY: 0.03, chestY: 0.22, neckY: 0.20, headY: 0.08,
    armX: 0.21, armY: 0.10, upper: 0.30, fore: 0.28,
  });

  for (const [th, sh, ft] of [[rig.thighL, rig.shinL, rig.footL], [rig.thighR, rig.shinR, rig.footR]]) {
    new Part(th).add(limb(0.40, [
      [0.00, 0.095, 0.095], [0.12, 0.062, 0.062], [0.85, 0.058, 0.058], [1.00, 0.088, 0.088],
    ], { round: 2.2, seg: 10 }), bone).finish();
    new Part(sh).add(limb(0.38, [
      [0.00, 0.086, 0.086], [0.14, 0.052, 0.052], [0.86, 0.046, 0.046], [1.00, 0.072, 0.072],
    ], { round: 2.2, seg: 10 }), bone)
      // 종아리뼈는 **둘**이다. 하나면 막대기고 둘이면 정강이다
      .add(limb(0.34, [[0, 0.028, 0.028], [1, 0.024, 0.024]], { round: 2.2, seg: 8 }), bone, { x: 0.042, y: -0.02 })
      .finish();
    const f = new Part(ft).add(snout(0.20, [
      [0.00, 0.085, 0.055], [0.40, 0.090, 0.052], [1.00, 0.050, 0.030],
    ], { round: 2.4, seg: 10 }), bone, { y: -0.02, z: -0.02 });
    f.finish();
  }

  // 골반 — 가운데가 뚫린 고리 + 좌우로 벌어진 날개
  new Part(rig.hips)
    .add(arc(0.10, 0.032, Math.PI * 2, 14), bone, { y: -0.05, rx: Math.PI / 2 })
    .mirror(loft([{ y: -0.08, w: 0.048, d: 0.10 }, { y: 0.02, w: 0.062, d: 0.135 }, { y: 0.07, w: 0.040, d: 0.10 }],
      { round: 2.6, seg: 10 }), bone, { x: 0.095, rz: 0.45, ry: 0.35 })
    .add(tatter(0.30, 0.36), rag, { y: -0.16, z: -0.05 })
    .add(tatter(0.16, 0.28), rag, { x: 0.13, y: -0.14, z: -0.02, rz: 0.2 })
    .finish();

  // 척추 — 마디 다섯 + 뒤로 튀어나온 돌기. 통짜 기둥이 아니다
  const spine = new Part(rig.spine);
  for (let i = 0; i < 5; i++) {
    spine.add(loft([{ y: -0.016, w: 0.058, d: 0.058 }, { y: 0.016, w: 0.052, d: 0.052 }], { round: 3, seg: 8 }),
      bone, { y: 0.01 + i * 0.045 });
    spine.add(spike(0.016, 0.042, 4), bone, { y: 0.01 + i * 0.045, z: -0.048, rx: 2.1 });
  }
  spine.finish();

  // 갈비 — 활 반쪽을 좌우 다섯 쌍. **해골의 정체성이라 개수와 간격이 중요하다.**
  // 예전에는 납작한 가로 막대 다섯이었고, 옆에서 보면 널빤지 더미였다.
  // 갈비는 등뼈에서 나와 **앞으로 감겨** 가슴 앞에서 만난다.
  const chest = new Part(rig.chest);
  chest.add(limb(0.30, [[0, 0.052, 0.052], [1, 0.046, 0.046]], { round: 2.4, seg: 8 }), bone, { y: 0.20, z: -0.055 });
  for (let i = 0; i < 5; i++) {
    const r = 0.155 - i * 0.012;
    const y = 0.20 - i * 0.062;
    const rib = arc(r, 0.016, Math.PI * 0.92, 10, 4);
    chest.add(rib, bone, { y, z: -0.05, rx: Math.PI / 2, ry: Math.PI / 2, rz: -0.12 - i * 0.03 });
    chest.add(rib, bone, { y, z: -0.05, rx: Math.PI / 2, ry: -Math.PI / 2, rz: 0.12 + i * 0.03 });
  }
  chest.add(loft([{ y: -0.06, w: 0.032, d: 0.026 }, { y: 0.06, w: 0.048, d: 0.030 }], { round: 3, seg: 8 }),
    bone, { y: 0.06, z: 0.105 })                                      // 복장뼈
    .mirror(limb(0.20, [[0, 0.020, 0.020], [1, 0.018, 0.018]], { round: 2.4, seg: 8 }), bone,
      { x: 0.10, y: 0.21, z: 0.04, rz: Math.PI / 2 - 0.25, ry: -0.3 })  // 쇄골
    // 갑주 잔해는 **한쪽에만.** 좌우가 같으면 「제복」이고 한쪽만이면 「주워 입은 것」
    .add(loft([{ y: -0.04, w: 0.155, d: 0.115 }, { y: 0.04, w: 0.175, d: 0.125 }], { round: 3.2, seg: 10 }),
      rust, { x: 0.12, y: 0.20, rz: 0.25 });
  for (let i = 0; i < 4; i++) {
    const t = (i - 1.5) / 1.5;
    chest.add(tatter(0.13, 0.50 - Math.abs(t) * 0.14), rag,
      { x: t * 0.13, y: 0.0, z: -0.13, rx: 0.14, rz: -t * 0.1 });
  }
  chest.finish();

  // **혼불** — 갈비 안이 비어 있으면 해골은 그냥 뼈 무더기지만, 거기서 불이
  // 새어 나오면 **무엇이 이 뼈를 세우고 있는가**에 대한 답이 된다.
  // 눈빛과 같은 색이라야 한 몬스터로 읽힌다.
  rig.core = core(rig.chest, 0xff5a2a, 0.042, 0, 0.06, -0.01);

  for (const [g, s] of [[rig.armL, 1], [rig.armR, -1]]) {
    new Part(g).add(limb(0.30, [
      [0.00, 0.086, 0.086], [0.14, 0.052, 0.052], [0.86, 0.046, 0.046], [1.00, 0.070, 0.070],
    ], { round: 2.2, seg: 10 }), bone)
      .add(loft([{ y: -0.03, w: 0.145, d: 0.105 }, { y: 0.05, w: 0.165, d: 0.115 }], { round: 3.2, seg: 10 }),
        rust, { y: 0.02, rz: s * 0.2 })
      .finish();
  }
  for (const g of [rig.foreL, rig.foreR]) {
    new Part(g).add(limb(0.28, [
      [0.00, 0.070, 0.070], [0.14, 0.044, 0.044], [0.86, 0.038, 0.038], [1.00, 0.058, 0.058],
    ], { round: 2.2, seg: 10 }), bone)
      .add(limb(0.26, [[0, 0.024, 0.024], [1, 0.020, 0.020]], { round: 2.2, seg: 8 }), bone, { x: 0.030, y: -0.01 })
      .finish();
  }
  // 손 — 손바닥 + 손가락 넷. 뭉툭한 덩이 하나면 「장갑」이지 「해골 손」이 아니다
  for (const g of [rig.handL, rig.handR]) {
    const p = new Part(g).add(loft([{ y: -0.07, w: 0.052, d: 0.024 }, { y: 0, w: 0.062, d: 0.028 }],
      { round: 3, seg: 8 }), bone);
    for (let i = -1; i <= 2; i++) {
      p.add(limb(0.075, [[0, 0.014, 0.014], [1, 0.010, 0.010]], { round: 2.2, seg: 6 }), bone,
        { x: i * 0.019, y: -0.065, rz: i * 0.12 });
    }
    p.add(limb(0.05, [[0, 0.015, 0.015], [1, 0.011, 0.011]], { round: 2.2, seg: 6 }), bone,
      { x: -0.035, y: -0.035, rz: -0.9 });
    p.finish();
  }

  // ── 두개골 ── 각기둥 두 개였을 때는 어느 각도에서도 **양동이**였다.
  // 머리통은 위로 좁아지고 뒤통수가 튀어나오고, 눈구멍은 **깊어야** 한다
  new Part(rig.neck).add(limb(0.085, [[0, 0.042, 0.042], [1, 0.036, 0.036]], { round: 2.2, seg: 8 }), bone).finish();
  rig.head.scale.setScalar(1.34);          // 스프라이트 비율
  const skull = new Part(rig.head)
    .add(loft([
      { y: -0.075, w: 0.120, d: 0.145, cz: 0.014 },
      { y: -0.030, w: 0.165, d: 0.195, cz: 0.008 },
      { y: 0.030, w: 0.196, d: 0.225 },
      { y: 0.100, w: 0.185, d: 0.215, cz: -0.010 },
      { y: 0.155, w: 0.120, d: 0.145, cz: -0.014 },
    ], { round: 2.4 }), bone)
    // 눈구멍 — 검은 판을 얹으면 그냥 검은 점이다. **파야** 한다
    .mirror(loft([{ y: -0.026, w: 0.058, d: 0.040 }, { y: 0.026, w: 0.052, d: 0.036 }], { round: 2.4, seg: 10 }),
      rag, { x: 0.050, y: 0.052, z: 0.080 })
    .add(prism(0.024, 0.026, 0.042, 0.010, 0.018, { hang: false, sides: 4 }), rag, { y: 0.010, z: 0.098 })  // 코 구멍
    // 아래턱 — 위턱보다 좁다
    .add(loft([{ y: -0.058, w: 0.118, d: 0.130, cz: 0.014 }, { y: -0.012, w: 0.150, d: 0.165, cz: 0.008 }],
      { round: 2.6 }), bone);
  for (let i = -2; i <= 2; i++) {                    // 이빨
    skull.add(prism(0.014, 0.012, 0.024, 0.011, 0.010, { hang: false, sides: 4 }), bone,
      { x: i * 0.022, y: -0.014, z: 0.088 - Math.abs(i) * 0.006 });
    skull.add(prism(0.014, 0.012, 0.022, 0.011, 0.010, { hang: false, sides: 4 }), bone,
      { x: i * 0.022, y: -0.040, z: 0.088 - Math.abs(i) * 0.006 });
  }
  skull.add(loft([{ y: -0.06, w: 0.030, d: 0.115 }, { y: 0.05, w: 0.034, d: 0.130 }], { round: 3, seg: 10 }),
    rust, { x: 0.088, y: 0.070, rz: 0.2, ry: -0.4 });   // 투구 잔해 — 한쪽만
  skull.finish();
  eyes(rig.head, 0xff4a2a, 0.050, 0.052, 0.078, 0.026, 0.018);

  // ── 무기 ── **변종마다 다르다.**
  // 해골 창병은 사거리가 원본의 두 배 가까이 되는데 같은 검을 들고 있었다.
  // 사거리를 눈으로 알려 주는 것은 숫자가 아니라 자루 길이다.
  rig.weaponPal = { wrap: rag, dark: rag, accent: rust, bladeMat };
  rig.bladeMat = bladeMat;
  attachWeapon(rig, opt.weapon || '검', rig.weaponPal, { y: -0.05, z: 0.03 });
  // 방패는 무기보다 **먼저** 볼 것이 아니다 — attachWeapon 이 두 손 무기일 때
  // rig.shield 를 숨기므로 방패는 그 뒤에 단다 (창 + 방패는 없다)
  if (opt.shield && !rig.twoHand) attachBuckler(rig, rig.weaponPal, 1.0);
  rig.stance = 'skeleton';
  return done(rig, [bone, rag, rust, bladeMat]);
}

// ═══════════════════════════ 구울 ═══════════════════════════
// 실루엣: **낮고 넓다.** 앞으로 굽은 등 · 긴 팔 · 머리가 몸보다 앞에 있다.
//
// 사람과 다르게 만드는 것은 셋이다:
//   · 가슴이 골반보다 훨씬 굵다 (사람은 어깨가 넓고 가슴은 얇다)
//   · **팔이 다리보다 길다.** 그래서 앞으로 짚는 자세가 자연스럽다
//   · 목이 앞으로 뻗어 머리가 몸보다 앞에 온다
//
// 좌우 비대칭은 남긴다. 오른팔이 굵고 길다 — 값이 싸고 효과가 크다.
export function buildGhoul() {
  // ── 색 ── **초록이 아니다.** 참고본의 구울은 창백한 회갈색 시체다.
  // 초록은 오크의 색이고, 둘 다 초록이면 같은 종류로 보인다 —
  // 몬스터를 색으로 구분하는 것이 형태로 구분하는 것보다 훨씬 빠르다.
  const skin = M(0xb8ab92, { roughness: 0.96, metalness: 0 });
  const belly = M(0xd2c7ae, { roughness: 0.97, metalness: 0 });
  const claw = M(0x8a6a5c, { roughness: 0.5, metalness: 0.1 });

  const rig = skeleton({
    hipY: 0.62, legX: 0.145, thigh: 0.30, shin: 0.27,
    spineY: 0.02, chestY: 0.17, neckY: 0.17, headY: 0.07,
    armX: 0.235, armY: 0.06, upper: 0.34, fore: 0.33,
  });
  // 굽은 자세는 **기본 각도**로 넣는다 — 매 프레임 더하면 동작이 이걸 못 이긴다
  rig.spine.rotation.x = 0.42; rig.chest.rotation.x = 0.18;
  rig.neck.rotation.x = -0.62; rig.chest.rotation.z = 0.06;
  rig.armL.rotation.x = 0.32; rig.armR.rotation.x = 0.26;
  rig.head.scale.setScalar(1.30);          // 스프라이트 비율 — 머리를 키운다

  // 짐승은 허벅지가 아주 굵고 정강이가 가늘다 (도약용)
  for (const [th, sh, ft] of [[rig.thighL, rig.shinL, rig.footL], [rig.thighR, rig.shinR, rig.footR]]) {
    new Part(th).add(limb(0.30, [
      [0.00, 0.205, 0.215], [0.22, 0.215, 0.230], [0.70, 0.150, 0.165], [1.00, 0.120, 0.135],
    ], { round: 2.2 }), skin).finish();
    new Part(sh).add(limb(0.27, [
      [0.00, 0.130, 0.145], [0.20, 0.148, 0.165], [0.75, 0.078, 0.090], [1.00, 0.066, 0.076],
    ], { round: 2.2 }), skin).finish();
    const f = new Part(ft).add(snout(0.24, [
      [0.00, 0.120, 0.095], [0.35, 0.135, 0.105], [0.85, 0.100, 0.075], [1.00, 0.070, 0.055],
    ], { round: 2.4 }), skin, { y: -0.04, z: -0.05 });
    for (let i = -1; i <= 1; i++) f.add(spike(0.020, 0.10, 4), claw, { x: i * 0.042, y: -0.045, z: 0.155, rx: 1.5 });
    f.finish();
  }

  new Part(rig.hips).add(loft([
    { y: -0.11, w: 0.235, d: 0.215 }, { y: -0.02, w: 0.265, d: 0.240 }, { y: 0.06, w: 0.240, d: 0.225 },
  ], { round: 2.3 }), skin).finish();

  new Part(rig.spine).add(loft([
    { y: -0.01, w: 0.245, d: 0.235 }, { y: 0.09, w: 0.290, d: 0.285, cz: 0.015 },
    { y: 0.18, w: 0.330, d: 0.310, cz: 0.010 },
  ], { round: 2.3 }), skin).finish();

  const ch = new Part(rig.chest)
    .add(loft([
      { y: 0.00, w: 0.330, d: 0.310, cz: 0.010 },
      { y: 0.055, w: 0.395, d: 0.330, cz: 0.005 },
      { y: 0.115, w: 0.390, d: 0.305 },
      { y: 0.165, w: 0.270, d: 0.225, cz: -0.010 },
    ], { round: 2.4 }), skin)
    // 배 — 앞으로 늘어진다. 굶은 시체가 아니라 **불은 시체**다
    .add(loft([
      { y: -0.02, w: 0.190, d: 0.120 }, { y: 0.05, w: 0.250, d: 0.150 }, { y: 0.115, w: 0.205, d: 0.120 },
    ], { round: 2.3 }), belly, { z: 0.115 });
  // 등뼈 돌기 — 굽은 등을 실루엣으로 보이게 하는 것
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    ch.add(spike(0.036 - t * 0.013, 0.155 - t * 0.05, 4), claw,
      { x: (i % 2 ? 0.012 : -0.012), y: 0.135 - i * 0.052, z: -0.135 - t * 0.01, rx: -0.55 + t * 0.25 });
  }
  ch.finish();

  // 목 — 앞으로 뻗는다. **짧으면 아무리 각도를 줘도 어깨 사이에 파묻힌다**
  new Part(rig.neck).add(limb(0.18, [
    [0, 0.145, 0.155], [0.5, 0.135, 0.145], [1, 0.120, 0.130],
  ], { round: 2.2 }), skin).finish();

  // 머리 — 두개골(세로) + 주둥이(가로). 둘을 나눠야 「주둥이」가 된다
  const hd = new Part(rig.head)
    .add(loft([
      { y: -0.075, w: 0.150, d: 0.175, cz: 0.020 },
      { y: -0.020, w: 0.195, d: 0.235, cz: 0.010 },
      { y: 0.050, w: 0.205, d: 0.240 },
      { y: 0.110, w: 0.145, d: 0.180, cz: -0.010 },
    ], { round: 2.4 }), skin)
    .add(snout(0.20, [
      [0.00, 0.180, 0.150], [0.35, 0.165, 0.130], [0.80, 0.130, 0.100], [1.00, 0.105, 0.080],
    ], { round: 2.5 }), skin, { y: -0.012, z: 0.055 })
    // 아래턱 — 위턱보다 짧고 넓다. 이빨이 밖으로 삐져나온다
    .add(snout(0.155, [
      [0.00, 0.155, 0.075], [0.45, 0.145, 0.070], [1.00, 0.098, 0.052],
    ], { round: 2.6 }), belly, { y: -0.068, z: 0.070 });
  for (let i = 0; i < 5; i++) {
    const x = -0.052 + i * 0.026;
    hd.add(spike(0.017, 0.060, 4), claw, { x, y: -0.030, z: 0.150 - Math.abs(i - 2) * 0.008, rx: Math.PI });
    hd.add(spike(0.014, 0.045, 4), claw, { x, y: -0.072, z: 0.145 });
  }
  hd.add(spike(0.033, 0.17, 4), claw, { x: 0.092, y: 0.095, z: -0.02, rz: -0.40, rx: -0.25 })   // 귀 — 길이가 다르다
    .add(spike(0.027, 0.11, 4), claw, { x: -0.092, y: 0.088, z: -0.02, rz: 0.55, rx: -0.12 })
    .finish();
  eyes(rig.head, 0xd83a2a, 0.055, 0.040, 0.115, 0.030, 0.024);

  for (const [g, k] of [[rig.armL, 0.82], [rig.armR, 1.18]]) {
    new Part(g).add(limb(0.34, [
      [0.00, 0.165 * k, 0.170 * k], [0.20, 0.180 * k, 0.185 * k],
      [0.72, 0.120 * k, 0.128 * k], [1.00, 0.108 * k, 0.115 * k],
    ], { round: 2.2 }), skin).finish();
  }
  for (const [g, k] of [[rig.foreL, 0.82], [rig.foreR, 1.18]]) {
    new Part(g).add(limb(0.33, [
      [0.00, 0.118 * k, 0.126 * k], [0.24, 0.132 * k, 0.140 * k],
      [0.78, 0.078 * k, 0.086 * k], [1.00, 0.068 * k, 0.074 * k],
    ], { round: 2.2 }), skin).finish();
  }
  // 손톱 — 구울의 무기다. 세 개씩, 길고 굽었다
  for (const [g, k] of [[rig.handL, 0.85], [rig.handR, 1.20]]) {
    const p = new Part(g).add(limb(0.13, [
      [0.00, 0.085 * k, 0.095 * k], [0.50, 0.105 * k, 0.115 * k], [1.00, 0.080 * k, 0.090 * k],
    ], { round: 2.6 }), skin);
    for (let i = -1; i <= 1; i++) {
      p.add(spike(0.024 * k, 0.145, 4), claw, { x: i * 0.048 * k, y: -0.105, z: 0.015, rx: Math.PI + 0.22 });
    }
    p.finish();
  }

  rig.weapon = rig.handR;
  rig.blade = rig.handR;
  rig.bladeMat = claw;
  rig.stance = 'ghoul';
  return done(rig, [skin, belly, claw]);
}

// ═══════════════════════════ 망령 궁수 ═══════════════════════════
// 실루엣: **다리가 없고 아래가 흩어진다.** 유일하게 바닥에 닿지 않는 적.
//
// 예전에는 아래가 가늘어지기만 하는 **원뿔**이었다. 유령은 「아래가 없다」가
// 아니라 「아래가 사라지는 중이다」여야 하고, 그건 아래로 갈수록 좁아지는
// 단면 + 길이가 제각각인 자락이 만든다.
export function buildArcher() {
  // 색을 올렸다. 던전이 어둡고 이 몸까지 어두우면 **검은 덩어리 하나**가 되어
  // 형태를 아무리 고쳐도 화면에서 안 보인다 — 어두운 무대의 어두운 옷은
  // 실루엣이 아니라 공백이다
  const robe = M(0x4a5c78, { roughness: 1, metalness: 0 });
  const inner = M(0x28324a, { roughness: 1, metalness: 0 });
  const wood = M(0x5a4630, { roughness: 0.85 });
  const boneM = M(0xb9b09a, { roughness: 0.6 });

  const rig = skeleton({
    hipY: 0.98, legX: 0, thigh: 0, shin: 0,
    spineY: 0.06, chestY: 0.26, neckY: 0.18, headY: 0.06,
    armX: 0.24, armY: 0.10, upper: 0.26, fore: 0.24,
  });
  // 다리가 없다 — 골격에서 떼어낸다. 포저가 rig.thighL 을 보고 건너뛴다
  rig.hips.remove(rig.thighL, rig.thighR);
  rig.thighL = rig.thighR = rig.shinL = rig.shinR = rig.footL = rig.footR = null;
  rig.legL = rig.legR = null;
  rig.float = true;

  const hips = new Part(rig.hips)
    .add(loft([
      { y: -0.60, w: 0.075, d: 0.075 }, { y: -0.38, w: 0.230, d: 0.222 },
      { y: -0.14, w: 0.335, d: 0.322 }, { y: 0.04, w: 0.348, d: 0.330 },
    ], { round: 2.4 }), robe);
  // 찢어진 자락 — **길이가 제각각**이라야 아래 경계가 들쭉날쭉해진다
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    const len = 0.30 + ((i * 4) % 5) * 0.09;
    hips.add(tatter(0.16, len), inner,
      { x: Math.sin(a) * 0.165, z: Math.cos(a) * 0.165, y: -0.18,
        rx: Math.cos(a) * 0.13, rz: -Math.sin(a) * 0.13, ry: -a });
  }
  hips.finish();
  new Part(rig.spine).add(loft([
    { y: -0.02, w: 0.300, d: 0.285 }, { y: 0.26, w: 0.340, d: 0.300 },
  ], { round: 2.5 }), robe).finish();
  const chest = new Part(rig.chest)
    .add(loft([
      { y: 0.00, w: 0.340, d: 0.300 }, { y: 0.12, w: 0.360, d: 0.300 }, { y: 0.22, w: 0.260, d: 0.220 },
    ], { round: 2.5 }), robe)
    // 어깨 망토 — 유령의 어깨선을 만들어 준다. 없으면 그냥 자루다.
    // **폭을 몸통보다 조금만 키운다.** 0.43 으로 크게 둘렀더니 어두운 재질이
    // 몸통을 통째로 덮어서 화면에는 **검은 널빤지 하나**로 나왔다 —
    // 어깨선을 만들려던 것이 실루엣을 지워 버렸다
    .add(loft([
      { y: 0.06, w: 0.375, d: 0.325 }, { y: 0.15, w: 0.330, d: 0.285 }, { y: 0.20, w: 0.250, d: 0.215 },
    ], { round: 2.5 }), inner);
  for (let i = 0; i < 5; i++) {
    const t = (i - 2) / 2;
    chest.add(tatter(0.14, 0.50 - Math.abs(t) * 0.12), inner,
      { x: t * 0.13, y: 0.04, z: -0.14, rx: 0.1, rz: -t * 0.12 });
  }
  chest.finish();

  new Part(rig.neck).add(limb(0.09, [[0, 0.100, 0.100], [1, 0.092, 0.092]], { round: 2.2, seg: 10 }), inner).finish();
  rig.head.scale.setScalar(1.22);          // 스프라이트 비율
  // 두건 — 위가 뾰족하고 **얼굴 자리는 비워 둔다**(검은 재질)
  new Part(rig.head)
    .add(loft([
      { y: -0.04, w: 0.250, d: 0.250 }, { y: 0.06, w: 0.235, d: 0.240 },
      { y: 0.15, w: 0.150, d: 0.155 }, { y: 0.22, w: 0.030, d: 0.030 },
    ], { round: 2.4 }), robe)
    // 얼굴 자리 — **작고 깊어야** 「비어 있다」로 읽힌다. 크게 잡으면
    // 두건이 아니라 검은 상자가 머리에 얹힌 꼴이 된다
    .add(loft([{ y: -0.03, w: 0.130, d: 0.085 }, { y: 0.075, w: 0.120, d: 0.080 }], { round: 2.6 }),
      inner, { z: 0.075 })
    .add(arc(0.112, 0.020, Math.PI * 1.1, 12), robe, { y: 0.02, z: 0.085, rx: Math.PI / 2, ry: Math.PI / 2 })
    .finish();
  eyes(rig.head, 0x9fd8ff, 0.042, 0.030, 0.105, 0.026, 0.018);
  // 두건 속의 등불 — 눈 두 개보다 **하나의 빛**이 더 무섭다
  rig.core = core(rig.head, 0x9fd8ff, 0.022, 0, 0.035, 0.055);

  for (const [g, s] of [[rig.armL, 1], [rig.armR, -1]]) {
    new Part(g).add(limb(0.26, [
      [0.00, 0.185, 0.185], [0.30, 0.170, 0.170], [1.00, 0.130, 0.130],
    ], { round: 2.4 }), robe, { rz: s * 0.1 }).finish();
  }
  for (const g of [rig.foreL, rig.foreR]) {
    new Part(g).add(limb(0.24, [
      [0.00, 0.138, 0.138], [0.35, 0.128, 0.128], [1.00, 0.088, 0.088],
    ], { round: 2.4 }), robe).finish();
  }
  // 손 — 소매에서 **뼈만** 나온다. 유령의 손은 옷의 일부가 아니다
  for (const g of [rig.handL, rig.handR]) {
    const p = new Part(g).add(loft([{ y: -0.06, w: 0.044, d: 0.024 }, { y: 0, w: 0.052, d: 0.028 }],
      { round: 3, seg: 8 }), boneM);
    for (let i = -1; i <= 1; i++) {
      p.add(limb(0.07, [[0, 0.012, 0.012], [1, 0.008, 0.008]], { round: 2.2, seg: 6 }), boneM,
        { x: i * 0.018, y: -0.055, rz: i * 0.15 });
    }
    p.finish();
  }

  // ── 활 ── 리커브. **활대는 세로다.** z 로 눕히면 막대기 하나로 보인다.
  // 시위는 그립보다 **뒤(−Z)** 에 있어야 한다 — 화살은 +Z 로 날아가므로.
  const bow = new THREE.Group();
  bow.rotation.x = 1.16;             // 겨눔 자세의 팔 접힘을 되돌려 세로로 세운다
  const bp = new Part(bow)
    .add(loft([{ y: -0.075, w: 0.048, d: 0.070 }, { y: 0.075, w: 0.048, d: 0.070 }], { round: 3, seg: 8 }), wood);
  for (const s of [1, -1]) {
    bp.add(loft([{ y: -0.13, w: 0.040, d: 0.058 }, { y: 0.13, w: 0.026, d: 0.040 }], { round: 3, seg: 8 }),
      wood, { y: s * 0.20, rz: -s * 0.30, rx: -s * 0.10 });
    bp.add(loft([{ y: -0.08, w: 0.026, d: 0.040 }, { y: 0.08, w: 0.014, d: 0.022 }], { round: 3, seg: 8 }),
      wood, { y: s * 0.40, z: -0.045, rz: s * 0.34, rx: s * 0.16 });     // 끝이 반대로 휜다
  }
  bp.finish();
  const stringMat = M(0xd8cfb4, { roughness: 0.9, emissive: 0x2a3a55, emissiveIntensity: 0.6 });
  const str = new THREE.Mesh(prism(0.010, 0.010, 0.92, 0.010, 0.010, { sides: 4, hang: false }), stringMat);
  str.position.z = -0.075;
  bow.add(str);
  rig.handR.add(bow);
  rig.weapon = bow; rig.blade = str; rig.bladeMat = stringMat;
  rig.bowString = str;
  rig.stance = 'archer';
  return done(rig, [robe, inner, wood, boneM, stringMat]);
}

// ═══════════════════════════ 석상 골렘 ═══════════════════════════
// 실루엣: **어깨가 머리보다 높다.** 목이 없고 팔이 땅에 닿을 만큼 길다.
//
// **여기만 단면이 아니라 깨진 돌덩이(rock)다.** 골렘은 원래 「깎인 것」이고
// 단면이 매끈하면 안 된다. 그리고 균열에서 심장 빛이 샌다 — 어두운 화면에서
// 형태보다 먼저 읽히고 「속이 비지 않았다」는 인상을 준다.
export function buildGolem() {
  // 참고본의 골렘은 **사암색**이다. 푸른 회색으로 두면 던전 벽과 같은 계열이라
  // 큰 덩치가 배경에 묻힌다 — 제일 큰 적이 제일 안 보이면 안 된다
  const stone = M(0xc2b49a, { roughness: 0.98, metalness: 0.02 });
  const dark = M(0x8a7d68, { roughness: 0.99, metalness: 0 });
  const runeMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a });

  const rig = skeleton({
    hipY: 0.90, legX: 0.24, thigh: 0.40, shin: 0.36,
    spineY: 0.06, chestY: 0.30, neckY: 0.26, headY: 0.02,
    armX: 0.52, armY: 0.14, upper: 0.44, fore: 0.40,
  });

  for (const [th, sh, ft, sd] of [[rig.thighL, rig.shinL, rig.footL, 1], [rig.thighR, rig.shinR, rig.footR, 2]]) {
    new Part(th)
      .add(rock(0.20, 0.26, 1, sd), stone, { y: -0.13, sy: 1.5 })
      .add(rock(0.19, 0.30, 1, sd + 10), dark, { y: -0.03, sy: 0.7 })
      .finish();
    new Part(sh).add(rock(0.185, 0.28, 1, sd + 20), stone, { y: -0.16, sy: 1.35 }).finish();
    new Part(ft).add(rock(0.20, 0.22, 1, sd + 30), stone, { y: -0.04, z: 0.05, sy: 0.6, sz: 1.25 }).finish();
  }

  new Part(rig.hips).add(rock(0.30, 0.24, 1, 40), stone, { y: -0.05, sy: 0.72, sz: 0.78 }).finish();
  new Part(rig.spine).add(rock(0.32, 0.26, 1, 41), stone, { y: 0.12, sy: 0.62, sz: 0.72 }).finish();

  new Part(rig.chest)
    .add(rock(0.44, 0.22, 1, 42), stone, { y: 0.15, sy: 0.62, sz: 0.66 })
    // 왼쪽 어깨가 깨져 나갔다 — 어둠으로 파고 그 자리에서 심장이 더 밝게 샌다
    .add(rock(0.20, 0.35, 1, 43), dark, { x: 0.30, y: 0.28, sy: 0.75 })
    .add(prism(0.30, 0.14, 0.32, 0.20, 0.10, { hang: false }), dark, { y: 0.16, z: 0.24 })
    .finish();
  rig.core = core(rig.chest, 0xffb050, 0.15, 0, 0.17, 0.28);
  for (let i = 0; i < 3; i++) {                    // 룬 — 어둠 속에서 먼저 읽힌다
    const r = new THREE.Mesh(slab(0.18 - i * 0.03, 0.022, 0.02, 0.006), runeMat);
    r.position.set(0, 0.38 - i * 0.05, 0.30);
    rig.chest.add(r);
  }

  // 목이 없다 — 머리가 어깨 사이에 파묻힌다. 다만 **아예 안 보이면 안 된다**
  rig.head.scale.setScalar(1.18);          // 스프라이트 비율
  new Part(rig.head)
    .add(rock(0.23, 0.20, 1, 50), stone, { y: 0.16, sy: 0.82 })
    .add(prism(0.26, 0.12, 0.10, 0.24, 0.10, { hang: false }), dark, { y: 0.08, z: 0.17 })
    .add(prism(0.07, 0.11, 0.13, 0.05, 0.09, { hang: false }), stone, { y: 0.0, z: 0.16 })   // 코
    .add(spike(0.05, 0.17, 4), stone, { x: 0.14, y: 0.17, rz: -0.5 })
    .add(spike(0.038, 0.11, 4), stone, { x: -0.14, y: 0.15, rz: 0.5 })                        // 짧다 = 부러졌다
    .add(rock(0.05, 0.30, 1, 51), dark, { x: -0.15, y: 0.20, rz: 0.4 })
    .finish();
  eyes(rig.head, 0xff7a2a, 0.082, 0.085, 0.19, 0.05, 0.038);

  for (const [g, s, sd] of [[rig.armL, 1, 60], [rig.armR, -1, 61]]) {
    const p = new Part(g)
      .add(rock(0.24, 0.22, 1, sd), stone, { y: 0.02, sy: 0.72 })
      .add(rock(0.185, 0.26, 1, sd + 2), stone, { y: -0.26, sy: 1.3 });
    for (let i = 0; i < 3; i++) {      // 어깨에서 삐죽 나온 돌 — 골렘의 실루엣
      p.add(spike(0.045, 0.15 - i * 0.03, 4), stone,
        { x: s * (0.14 + i * 0.02), y: 0.10 - i * 0.09, rz: s * (0.8 + i * 0.2) });
    }
    p.finish();
  }
  for (const [g, sd] of [[rig.foreL, 70], [rig.foreR, 71]]) {
    new Part(g).add(rock(0.185, 0.24, 1, sd), stone, { y: -0.18, sy: 1.25 }).finish();
  }
  // 주먹 — 골렘의 무기. 팔보다 굵어야 「내려찍는 것」으로 읽힌다
  for (const [g, sd] of [[rig.handL, 80], [rig.handR, 81]]) {
    new Part(g)
      .add(rock(0.24, 0.28, 1, sd), stone, { y: -0.14, sy: 0.9 })
      .add(rock(0.09, 0.35, 1, sd + 2), dark, { y: -0.26, z: 0.10 })
      .finish();
  }

  rig.weapon = rig.handR;
  rig.blade = rig.handR;
  rig.bladeMat = stone;
  rig.stance = 'golem';
  return done(rig, [stone, dark]);
}

export const BUILDERS = {
  knight: buildKnight, skeleton: buildSkeleton,
  ghoul: buildGhoul, archer: buildArcher, golem: buildGolem,
};
