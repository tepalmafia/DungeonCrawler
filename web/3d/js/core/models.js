// 몸 — 기사와 몬스터 다섯의 메시. core/rig.js 의 골격 위에 살을 붙인다.
//
// ── 예전 것과 무엇이 다른가 ──────────────────────────────────
//   관절   6 개  → 18 개  (팔꿈치·무릎·목·발이 생겼다)
//   부위   ~14   → ~34    (허리띠·정강이받이·손·갈비 하나하나)
//   모서리 직각  → 8 각   (모따기 — 하이라이트가 모서리를 타고 흐른다)
//   메시   ~14   → ~20    (관절마다 재질별로 합치므로 부위 수만큼 늘지 않는다)
//
// 폴리곤은 캐릭터당 1,200 ~ 2,600 삼각형이다. 저폴리의 범주 안이고,
// 화면에 20 마리가 떠도 5 만 삼각형이라 문제가 되는 규모가 아니다.
// **품질을 올린 것은 폴리곤이 아니라 관절과 실루엣이다.**

import * as THREE from 'three';
// 무기 지오메트리(blade)는 여기서 안 쓴다 — 전부 core/weapons.js 로 옮겼다.
import { prism, slab, spike, Part, skeleton } from './rig.js';
import { attachWeapon, attachBuckler } from './weapons.js';

function M(color, opt = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1, ...opt });
}

/** 모든 몸이 공통으로 하는 마무리 */
function done(rig, mats) {
  rig.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  rig.mats = mats;
  rig.materials = mats;
  return rig;
}

// ═══════════════════════════ 기사 ═══════════════════════════
//
// 실루엣 규칙: **어깨가 제일 넓고, 허리가 잘록하고, 투구에 볏이 있다.**
// 던전은 어두워서 대부분 역광 실루엣으로만 읽힌다 — 그 셋만 지키면
// 멀리서도 「내 캐릭터」로 구분된다.
export function buildKnight() {
  const steel = M(0x9aa2b8, { metalness: 0.86, roughness: 0.28 });
  const dark = M(0x3a3746, { metalness: 0.4, roughness: 0.62 });
  const gold = M(0xb99a4e, { metalness: 0.85, roughness: 0.3 });
  const cloth = M(0xa93b45, { roughness: 0.95, metalness: 0.02 });
  const leather = M(0x59422e, { roughness: 0.88, metalness: 0.04 });
  const bladeMat = M(0xd7dbe6, { metalness: 0.9, roughness: 0.18 });

  // hipY 는 **허벅지 + 정강이 + 발목 높이**여야 한다. 처음에 허벅지+정강이만
  // 더해 놨더니 다섯 중 셋이 발목까지 바닥에 파묻혀 부츠가 잘려 나왔다.
  const rig = skeleton({
    hipY: 0.98, legX: 0.14, thigh: 0.44, shin: 0.42,   // 0.44+0.42+발목 0.12
    spineY: 0.04, chestY: 0.24, neckY: 0.22, headY: 0.1,
    armX: 0.28, armY: 0.12, upper: 0.32, fore: 0.30,
  });

  // ── 다리 ── 허벅지는 위가 굵고 아래가 가늘다. 정강이받이는 판을 덧댄다.
  // prism(아래폭, 아래깊이, 높이, 위폭, 위깊이) 다 — 처음에 뒤집어 적어서
  // 허벅지가 무릎보다 가늘었다. 사지는 **관절 쪽(위)이 굵다.**
  const thighG = prism(0.155, 0.175, 0.44, 0.21, 0.23);
  const shinG = prism(0.13, 0.15, 0.42, 0.16, 0.18);
  const greave = slab(0.17, 0.30, 0.06, 0.02);
  const footG = prism(0.16, 0.30, 0.10, 0.14, 0.24);
  for (const [th, sh, ft] of [[rig.thighL, rig.shinL, rig.footL], [rig.thighR, rig.shinR, rig.footR]]) {
    new Part(th).add(thighG, dark).finish();
    new Part(sh).add(shinG, dark).add(greave, steel, { y: -0.19, z: 0.09 }).finish();
    new Part(ft).add(footG, steel, { y: -0.02, z: 0.05 }).finish();
  }

  // ── 골반 · 허리띠 ── 허리를 좁히면 어깨가 상대적으로 넓어 보인다
  new Part(rig.hips)
    .add(prism(0.38, 0.26, 0.20, 0.34, 0.24, { hang: false }), dark, { y: -0.06 })
    .add(prism(0.40, 0.28, 0.08, 0.40, 0.28, { hang: false }), leather, { y: 0.06 })
    .add(slab(0.11, 0.09, 0.04, 0.015), gold, { y: 0.06, z: 0.15 })     // 버클
    .add(slab(0.13, 0.22, 0.03, 0.02), leather, { y: -0.06, z: 0.14 })  // 앞치마
    .finish();

  // ── 몸통 ── 두 덩이로 나눠 허리에서 가슴으로 넓어지게
  new Part(rig.spine)
    .add(prism(0.36, 0.24, 0.22, 0.44, 0.28, { hang: false }), steel, { y: 0.11 })
    .finish();

  const chest = new Part(rig.chest)
    .add(prism(0.48, 0.30, 0.30, 0.44, 0.28, { hang: false }), steel, { y: 0.06 })
    .add(slab(0.30, 0.24, 0.05, 0.03), steel, { y: 0.08, z: 0.15 })        // 가슴받이
    .add(slab(0.10, 0.16, 0.03, 0.02), gold, { y: 0.10, z: 0.18 })         // 문장
    // 망토 — 두 겹으로 접어 두면 평면 한 장보다 훨씬 천처럼 보인다
    .add(slab(0.46, 0.62, 0.02, 0.03), cloth, { y: -0.16, z: -0.17, rx: 0.1 })
    .add(slab(0.34, 0.44, 0.02, 0.03), cloth, { y: -0.24, z: -0.21, rx: 0.2 });
  chest.finish();

  // ── 어깨 갑주 ── 실루엣의 핵심. 세 겹으로 겹쳐 「층」을 만든다
  for (const [g, s] of [[rig.armL, 1], [rig.armR, -1]]) {
    const p = new Part(g);
    p.add(prism(0.26, 0.26, 0.12, 0.30, 0.30, { hang: false }), steel, { y: 0.04, rz: s * 0.18 });
    p.add(prism(0.30, 0.30, 0.08, 0.26, 0.26, { hang: false }), steel, { y: -0.04, rz: s * 0.14 });
    p.add(prism(0.115, 0.125, 0.32, 0.15, 0.16), dark, { y: -0.06 });      // 위팔
    p.finish();
  }
  const foreG = prism(0.095, 0.105, 0.30, 0.125, 0.135);
  const bracer = slab(0.15, 0.20, 0.05, 0.02);
  new Part(rig.foreL).add(foreG, dark).add(bracer, steel, { y: -0.13, z: 0.07 }).finish();
  new Part(rig.foreR).add(foreG, dark).add(bracer, steel, { y: -0.13, z: 0.07 }).finish();

  // ── 목 · 머리 · 투구 ── 볏이 있으면 실루엣이 위로 뾰족해진다
  new Part(rig.neck).add(prism(0.11, 0.11, 0.10, 0.12, 0.12), dark).finish();
  new Part(rig.head)
    .add(prism(0.22, 0.24, 0.24, 0.20, 0.22, { hang: false }), steel, { y: 0.06 })
    .add(slab(0.20, 0.05, 0.06, 0.015), dark, { y: 0.04, z: 0.12 })        // 눈 틈새
    .add(prism(0.10, 0.20, 0.10, 0.06, 0.14, { hang: false }), steel, { y: 0.0, z: 0.14 })  // 얼굴가리개
    .add(slab(0.04, 0.16, 0.26, 0.015), cloth, { y: 0.21 })                // 볏
    .add(spike(0.03, 0.10, 4), gold, { x: 0.10, y: 0.16, rz: -0.4 })
    .add(spike(0.03, 0.10, 4), gold, { x: -0.10, y: 0.16, rz: 0.4 })
    .finish();

  // ── 손 ── 있으면 팔이 「끝나는」 곳이 생겨서 팔꿈치가 읽힌다
  new Part(rig.handL).add(prism(0.11, 0.13, 0.12, 0.10, 0.12), steel).finish();
  new Part(rig.handR).add(prism(0.11, 0.13, 0.12, 0.10, 0.12), steel).finish();

  // ── 방패 ── 아래가 뾰족한 연꼴. 사각형보다 중세로 읽힌다.
  //
  // **손이 아니라 아래팔에 단다.** 손에 달았더니 팔이 내려간 대기 자세에서
  // 방패가 무릎 옆에 매달려 「들고 있다」로 안 보였다. 실제로도 방패는 팔뚝의
  // 끈으로 고정한다 — 팔꿈치를 굽히면 방패가 몸 앞으로 올라온다.
  //
  // 방패는 **받침 그룹**에 얹는다. 아래팔에 바로 붙였더니, 겨눔 자세에서
  // 아래팔이 1.45 라디안 접히는 만큼 방패도 같이 누워서 가슴 높이에 널빤지가
  // 가로로 걸린 꼴이 됐다. 받침이 그 접힘을 되돌려 주면 **평소에는 앞을 보고,
  // 팔이 움직일 때만 따라 기운다** — 원하는 건 정확히 그것이다.
  const shieldMount = new THREE.Group();
  shieldMount.position.set(0, -0.16, 0.04);
  shieldMount.rotation.x = 1.45;             // = -(restL + restForeL), anim.js 의 기사 자세
  rig.foreL.add(shieldMount);
  new Part(shieldMount)
    .add(slab(0.40, 0.42, 0.06, 0.03), leather, { y: -0.02, z: 0.12, ry: -0.34 })
    .add(prism(0.10, 0.06, 0.18, 0.36, 0.06), leather, { y: -0.23, z: 0.12, ry: -0.34 })
    .add(slab(0.38, 0.06, 0.03, 0.02), steel, { y: 0.02, z: 0.16, ry: -0.34 })
    .add(prism(0.11, 0.11, 0.05, 0.11, 0.11, { hang: false }), steel, { y: -0.04, z: 0.17, ry: -0.34 })
    .finish();
  rig.shield = shieldMount;

  // ── 무기 (오른손) ── 계열별 메시는 core/weapons.js 가 만든다.
  //
  // 예전에는 여기서 **검 하나를 고정으로** 만들었다. 그래서 대검을 껴도
  // 화면에는 짧은 한손검이 보였다. 지금은 팔레트만 넘기고, 장착이 바뀌면
  // player.js 의 _syncWeapon() 이 같은 팔레트로 갈아 끼운다.
  //
  // 쥐는 방향(π 뒤집기)과 쥐는 위치는 전부 weapons.js 가 안다 — 그게 무기의
  // 성질이지 몸의 성질이 아니기 때문이다.
  rig.weaponPal = { wrap: leather, dark: dark, accent: gold, bladeMat };
  rig.bladeMat = bladeMat;
  attachWeapon(rig, '검', rig.weaponPal);
  rig.stance = 'knight';
  return done(rig, [steel, dark, gold, cloth, leather, bladeMat]);
}

// ═══════════════════════════ 해골 병사 ═══════════════════════════
// 실루엣: **키가 크고 얇다.** 갈비뼈 사이가 비어 있어 뒤가 비쳐 보인다.
export function buildSkeleton(opt = {}) {
  const bone = M(0xcfc6ad, { roughness: 0.62, metalness: 0.05 });
  const rag = M(0x453f4e, { roughness: 1 });
  const rust = M(0x7d6a52, { roughness: 0.6, metalness: 0.5 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff4a2a });

  const rig = skeleton({
    hipY: 0.84, legX: 0.11, thigh: 0.40, shin: 0.38,   // 0.40+0.38+발목 0.06
    spineY: 0.03, chestY: 0.22, neckY: 0.20, headY: 0.08,
    armX: 0.21, armY: 0.10, upper: 0.30, fore: 0.28,
  });

  const boneG = prism(0.075, 0.075, 0.40, 0.06, 0.06, { sides: 6 });
  const jointG = prism(0.10, 0.10, 0.07, 0.10, 0.10, { sides: 6, hang: false });
  for (const [th, sh, ft] of [[rig.thighL, rig.shinL, rig.footL], [rig.thighR, rig.shinR, rig.footR]]) {
    new Part(th).add(jointG, bone, { y: -0.02 }).add(boneG, bone).finish();
    new Part(sh).add(jointG, bone, { y: -0.02 }).add(boneG, bone, { sy: 0.95 }).finish();
    new Part(ft).add(prism(0.10, 0.22, 0.06, 0.09, 0.18), bone, { z: 0.05 }).finish();
  }

  new Part(rig.hips)
    .add(prism(0.26, 0.16, 0.14, 0.22, 0.14, { hang: false, sides: 6 }), bone, { y: -0.04 })
    .add(slab(0.30, 0.34, 0.02, 0.02), rag, { y: -0.16, z: -0.05 })       // 넝마
    .finish();

  new Part(rig.spine).add(prism(0.07, 0.07, 0.22, 0.08, 0.08, { hang: false, sides: 6 }), bone, { y: 0.1 }).finish();

  // 갈비뼈 — 가로 막대 다섯. **해골의 정체성이라 개수와 간격이 중요하다.**
  const chest = new Part(rig.chest);
  chest.add(prism(0.08, 0.08, 0.26, 0.09, 0.09, { hang: false, sides: 6 }), bone, { y: 0.06 });
  for (let i = 0; i < 5; i++) {
    const w = 0.34 - Math.abs(i - 1.6) * 0.035;
    chest.add(prism(w, 0.20, 0.035, w * 0.95, 0.18, { hang: false, sides: 6 }), bone, { y: -0.03 + i * 0.075 });
  }
  chest.add(slab(0.30, 0.10, 0.03, 0.02), rust, { y: 0.19, z: 0.02 });    // 어깨 갑주 잔해
  chest.add(slab(0.40, 0.52, 0.02, 0.03), rag, { y: -0.02, z: -0.13, rx: 0.12 });  // 망토
  chest.finish();

  for (const [g, s] of [[rig.armL, 1], [rig.armR, -1]]) {
    new Part(g)
      .add(jointG, bone, { y: 0.01 })
      .add(prism(0.065, 0.065, 0.30, 0.055, 0.055, { sides: 6 }), bone, { y: -0.02 })
      .add(slab(0.16, 0.09, 0.05, 0.02), rust, { y: 0.03, rz: s * 0.2 })
      .finish();
  }
  const armBone = prism(0.055, 0.055, 0.28, 0.05, 0.05, { sides: 6 });
  new Part(rig.foreL).add(armBone, bone).finish();
  new Part(rig.foreR).add(armBone, bone).finish();
  const handG = prism(0.08, 0.09, 0.09, 0.07, 0.08, { sides: 6 });
  new Part(rig.handL).add(handG, bone).finish();
  new Part(rig.handR).add(handG, bone).finish();

  new Part(rig.neck).add(prism(0.06, 0.06, 0.08, 0.07, 0.07, { sides: 6 }), bone).finish();
  new Part(rig.head)
    .add(prism(0.20, 0.22, 0.19, 0.17, 0.19, { hang: false, sides: 8 }), bone, { y: 0.07 })  // 두개골
    .add(prism(0.14, 0.14, 0.07, 0.13, 0.16, { hang: false }), bone, { y: -0.02, z: 0.05 })  // 턱
    .add(slab(0.06, 0.05, 0.04, 0.01), rag, { x: 0.05, y: 0.08, z: 0.10 })                   // 눈구멍
    .add(slab(0.06, 0.05, 0.04, 0.01), rag, { x: -0.05, y: 0.08, z: 0.10 })
    .finish();
  // 눈빛은 발광 재질이라 합치지 않는다
  const eg = prism(0.045, 0.03, 0.04, 0.045, 0.03, { hang: false, sides: 4 });
  for (const x of [0.05, -0.05]) {
    const e = new THREE.Mesh(eg, eyeMat);
    e.position.set(x, 0.08, 0.115);
    rig.head.add(e);
  }

  // ── 무기 ── **변종마다 다르다.**
  //
  // 해골 창병은 사거리가 2.9 로 원본(1.6)의 두 배 가까이 되는데, 지금까지
  // 같은 녹슨 검을 들고 있었다. 규칙만 다르고 화면은 같으니 「왜 저기서
  // 맞지」가 된다 — 사거리를 눈으로 알려 주는 것은 숫자가 아니라 자루 길이다.
  // 방패병도 같다: frontGuard 0.6 이 규칙으로만 있고 표시가 없었다.
  const bladeMat = M(0xa9b0bd, { metalness: 0.72, roughness: 0.42 });
  rig.weaponPal = { wrap: rag, dark: rag, accent: rust, bladeMat };
  rig.bladeMat = bladeMat;
  attachWeapon(rig, opt.weapon || '검', rig.weaponPal, { y: -0.05, z: 0.03 });
  // 방패는 무기보다 **먼저** 볼 것이 아니다 — attachWeapon 이 두 손 무기일 때
  // rig.shield 를 숨기므로, 방패는 그 뒤에 단다 (창 + 방패는 없다).
  if (opt.shield && !rig.twoHand) attachBuckler(rig, rig.weaponPal, 1.0);
  rig.stance = 'skeleton';
  return done(rig, [bone, rag, rust, bladeMat]);
}

// ═══════════════════════════ 구울 ═══════════════════════════
// 실루엣: **낮고 넓다.** 앞으로 굽은 등 · 긴 팔 · 머리가 몸보다 앞에 있다.
export function buildGhoul() {
  const skin = M(0x6d7a4e, { roughness: 0.96, metalness: 0 });
  const belly = M(0x8a9464, { roughness: 0.98, metalness: 0 });
  const claw = M(0xd8cdb0, { roughness: 0.5, metalness: 0.15 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd23a });

  const rig = skeleton({
    hipY: 0.57, legX: 0.13, thigh: 0.26, shin: 0.24,   // 0.26+0.24+발목 0.07
    spineY: 0.02, chestY: 0.16, neckY: 0.12, headY: 0.02,
    armX: 0.22, armY: 0.06, upper: 0.30, fore: 0.30,
  });
  // 굽은 자세는 **기본 각도**로 넣는다 — 매 프레임 더하면 동작이 이걸 못 이긴다
  rig.spine.rotation.x = 0.38;
  rig.chest.rotation.x = 0.22;
  rig.neck.rotation.x = -0.5;                 // 목은 반대로 들어 앞을 본다
  rig.armL.rotation.x = 0.3; rig.armR.rotation.x = 0.3;

  const thighG = prism(0.135, 0.155, 0.26, 0.18, 0.20);
  const shinG = prism(0.105, 0.115, 0.24, 0.13, 0.15);
  for (const [th, sh, ft] of [[rig.thighL, rig.shinL, rig.footL], [rig.thighR, rig.shinR, rig.footR]]) {
    new Part(th).add(thighG, skin).finish();
    new Part(sh).add(shinG, skin).finish();
    const f = new Part(ft).add(prism(0.14, 0.22, 0.07, 0.12, 0.18), skin, { z: 0.04 });
    for (let i = -1; i <= 1; i++) f.add(spike(0.022, 0.09, 4), claw, { x: i * 0.045, y: -0.05, z: 0.13, rx: 1.5 });
    f.finish();
  }

  new Part(rig.hips).add(prism(0.30, 0.24, 0.16, 0.28, 0.24, { hang: false }), skin, { y: -0.03 }).finish();
  new Part(rig.spine).add(prism(0.30, 0.28, 0.18, 0.34, 0.32, { hang: false }), skin, { y: 0.08 }).finish();

  new Part(rig.chest)
    .add(prism(0.38, 0.36, 0.26, 0.30, 0.28, { hang: false }), skin, { y: 0.04 })
    .add(prism(0.26, 0.16, 0.20, 0.22, 0.14, { hang: false }), belly, { y: 0.02, z: 0.14 })  // 배
    // 등뼈 돌기 — 굽은 등을 실루엣으로 보이게 하는 것
    .add(spike(0.035, 0.11, 4), claw, { y: 0.14, z: -0.14, rx: -0.5 })
    .add(spike(0.03, 0.09, 4), claw, { y: 0.02, z: -0.15, rx: -0.4 })
    .add(spike(0.025, 0.07, 4), claw, { y: -0.08, z: -0.14, rx: -0.3 })
    .finish();

  new Part(rig.neck).add(prism(0.13, 0.13, 0.12, 0.14, 0.14), skin).finish();
  const head = new Part(rig.head)
    .add(prism(0.22, 0.24, 0.18, 0.19, 0.26, { hang: false }), skin, { y: 0.03, z: 0.03 })
    .add(prism(0.15, 0.16, 0.10, 0.11, 0.12, { hang: false }), belly, { y: -0.02, z: 0.16 });  // 주둥이
  for (let i = 0; i < 4; i++) {                // 이빨
    head.add(spike(0.018, 0.06, 4), claw, { x: -0.045 + i * 0.03, y: -0.05, z: 0.19, rx: Math.PI });
  }
  head.add(spike(0.03, 0.13, 4), claw, { x: 0.09, y: 0.11, z: -0.02, rz: -0.35 });   // 귀
  head.add(spike(0.03, 0.13, 4), claw, { x: -0.09, y: 0.11, z: -0.02, rz: 0.35 });
  head.finish();
  const eg = prism(0.04, 0.03, 0.035, 0.04, 0.03, { hang: false, sides: 4 });
  for (const x of [0.06, -0.06]) {
    const e = new THREE.Mesh(eg, eyeMat);
    e.position.set(x, 0.06, 0.13);
    rig.head.add(e);
  }

  for (const g of [rig.armL, rig.armR]) {
    new Part(g).add(prism(0.105, 0.115, 0.30, 0.14, 0.15), skin).finish();
  }
  for (const g of [rig.foreL, rig.foreR]) {
    new Part(g).add(prism(0.085, 0.095, 0.30, 0.115, 0.125), skin).finish();
  }
  // 손톱 — 구울의 무기다. 세 개씩, 길고 굽었다
  for (const g of [rig.handL, rig.handR]) {
    const p = new Part(g).add(prism(0.10, 0.11, 0.09, 0.10, 0.11), skin);
    for (let i = -1; i <= 1; i++) {
      p.add(spike(0.028, 0.20, 4), claw, { x: i * 0.05, y: -0.14, z: 0.02, rx: Math.PI + 0.2 });
    }
    p.finish();
  }

  rig.weapon = rig.handR;
  rig.blade = rig.handR;
  rig.bladeMat = claw;
  rig.stance = 'ghoul';
  return done(rig, [skin, belly, claw]);
}

// ═══════════════════════════ 유령 궁수 ═══════════════════════════
// 실루엣: **다리가 없고 아래가 흩어진다.** 유일하게 바닥에 닿지 않는 적.
export function buildArcher() {
  const robe = M(0x3a4a63, { roughness: 1, metalness: 0 });
  const inner = M(0x24304a, { roughness: 1, metalness: 0 });
  const wood = M(0x5a4630, { roughness: 0.85 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff });

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

  // 아래로 갈수록 **가늘어지며 흩어지는** 옷자락 — 세 겹으로 층을 만든다.
  //
  // prism(아래폭, 아래깊이, 높이, 위폭, 위깊이) 다. 처음에 아래를 넓게 적어서
  // 위아래가 뒤집힌 원기둥이 되었고, 게다가 세 겹 합이 골반보다 길어 바닥을
  // 뚫었다 — 화면에는 **그냥 상자**로 나왔다. 유령은 아래가 사라져야 유령이다.
  new Part(rig.hips)
    .add(prism(0.30, 0.28, 0.34, 0.36, 0.33), robe, { y: 0.02 })
    .add(prism(0.20, 0.19, 0.28, 0.29, 0.27), robe, { y: -0.30 })
    .add(prism(0.05, 0.05, 0.22, 0.19, 0.18), inner, { y: -0.56 })
    .finish();
  new Part(rig.spine).add(prism(0.30, 0.28, 0.26, 0.34, 0.30, { hang: false }), robe, { y: 0.1 }).finish();
  new Part(rig.chest)
    .add(prism(0.36, 0.30, 0.28, 0.30, 0.26, { hang: false }), robe, { y: 0.04 })
    .add(slab(0.34, 0.44, 0.02, 0.03), inner, { y: -0.06, z: -0.15, rx: 0.1 })   // 등 뒤 천
    .finish();

  new Part(rig.neck).add(prism(0.10, 0.10, 0.08, 0.11, 0.11), inner).finish();
  new Part(rig.head)
    // 두건 — 위가 뾰족한 원뿔. 얼굴 자리는 **비워 둔다**(검은 재질)
    .add(prism(0.24, 0.24, 0.26, 0.02, 0.02, { hang: false, sides: 6 }), robe, { y: 0.06 })
    .add(prism(0.17, 0.10, 0.16, 0.15, 0.10, { hang: false }), inner, { y: 0.02, z: 0.08 })
    .finish();
  const eg = prism(0.035, 0.028, 0.03, 0.035, 0.028, { hang: false, sides: 4 });
  for (const x of [0.045, -0.045]) {
    const e = new THREE.Mesh(eg, glowMat);
    e.position.set(x, 0.04, 0.14);
    rig.head.add(e);
  }

  for (const [g, s] of [[rig.armL, 1], [rig.armR, -1]]) {
    new Part(g).add(prism(0.14, 0.14, 0.26, 0.10, 0.10), robe, { rz: s * 0.1 }).finish();
  }
  new Part(rig.foreL).add(prism(0.10, 0.10, 0.24, 0.08, 0.08), robe).finish();
  new Part(rig.foreR).add(prism(0.10, 0.10, 0.24, 0.08, 0.08), robe).finish();
  new Part(rig.handL).add(prism(0.08, 0.08, 0.08, 0.07, 0.07), inner).finish();
  new Part(rig.handR).add(prism(0.08, 0.08, 0.08, 0.07, 0.07), inner).finish();

  // 활 — 오른손. 굽은 팔 두 개 + 시위. 토러스보다 실루엣이 명확하다.
  //
  // **활대는 세로다.** 처음에 z 로 90 도 눕혀 놨더니 화면에서 막대기 하나로
  // 보였다 — 활은 실루엣이 곧 정체성인 물건이라 그러면 활을 든 줄 모른다.
  // 시위는 그립보다 **뒤(−Z)** 에 있어야 한다. 화살은 +Z 로 날아가므로.
  const bow = new THREE.Group();
  // 활도 마찬가지 — 겨눔 자세의 팔 접힘(−1.2)을 되돌려 세로로 세운다
  bow.rotation.x = 1.16;
  new Part(bow)
    .add(prism(0.035, 0.05, 0.32, 0.02, 0.03, { hang: false }), wood, { y: 0.18, rz: -0.26, rx: -0.12 })
    .add(prism(0.035, 0.05, 0.32, 0.02, 0.03, { hang: false }), wood, { y: -0.18, rz: 0.26, rx: 0.12 })
    .add(prism(0.05, 0.07, 0.14, 0.045, 0.06, { hang: false }), wood)
    .finish();
  const stringMat = M(0xbfb49a, { roughness: 0.9 });
  const str = new THREE.Mesh(prism(0.012, 0.012, 0.66, 0.012, 0.012, { sides: 4, hang: false }), stringMat);
  str.position.z = -0.07;
  bow.add(str);
  rig.handR.add(bow);
  rig.weapon = bow; rig.blade = str; rig.bladeMat = stringMat;
  rig.bowString = str;
  rig.stance = 'archer';
  return done(rig, [robe, inner, wood, stringMat]);
}

// ═══════════════════════════ 석상 골렘 ═══════════════════════════
// 실루엣: **어깨가 머리보다 높다.** 목이 없고 팔이 땅에 닿을 만큼 길다.
export function buildGolem() {
  const stone = M(0x6b6a72, { roughness: 0.97, metalness: 0.02 });
  const dark = M(0x4a4950, { roughness: 0.98, metalness: 0 });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a });

  const rig = skeleton({
    hipY: 0.90, legX: 0.24, thigh: 0.40, shin: 0.36,   // 0.40+0.36+발목 0.14
    spineY: 0.06, chestY: 0.30, neckY: 0.26, headY: 0.02,
    armX: 0.52, armY: 0.14, upper: 0.44, fore: 0.40,
  });

  const thighG = prism(0.255, 0.275, 0.40, 0.31, 0.33);
  const shinG = prism(0.255, 0.275, 0.36, 0.29, 0.31);
  for (const [th, sh, ft] of [[rig.thighL, rig.shinL, rig.footL], [rig.thighR, rig.shinR, rig.footR]]) {
    new Part(th).add(thighG, stone).add(prism(0.34, 0.34, 0.10, 0.32, 0.32, { hang: false }), dark, { y: -0.02 }).finish();
    new Part(sh).add(shinG, stone).finish();
    new Part(ft).add(prism(0.32, 0.44, 0.14, 0.30, 0.38), stone, { z: 0.06 }).finish();
  }

  new Part(rig.hips).add(prism(0.56, 0.42, 0.26, 0.52, 0.40, { hang: false }), stone, { y: -0.06 }).finish();
  new Part(rig.spine).add(prism(0.54, 0.40, 0.26, 0.72, 0.48, { hang: false }), stone, { y: 0.13 }).finish();

  new Part(rig.chest)
    .add(prism(0.80, 0.52, 0.44, 0.92, 0.56, { hang: false }), stone, { y: 0.14 })
    // 갈라진 틈 — 여기서 심장이 비친다
    .add(prism(0.30, 0.12, 0.30, 0.22, 0.10, { hang: false }), dark, { y: 0.16, z: 0.24 })
    .finish();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), coreMat);
  core.position.set(0, 0.16, 0.30);
  rig.chest.add(core);
  rig.core = core;

  // 목이 없다 — 머리가 어깨 사이에 파묻힌다
  new Part(rig.head)
    .add(prism(0.34, 0.34, 0.28, 0.30, 0.30, { hang: false }), stone, { y: 0.06 })
    .add(prism(0.26, 0.12, 0.10, 0.24, 0.10, { hang: false }), dark, { y: 0.08, z: 0.17 })
    .add(spike(0.05, 0.16, 4), stone, { x: 0.14, y: 0.16, rz: -0.5 })
    .add(spike(0.05, 0.16, 4), stone, { x: -0.14, y: 0.16, rz: 0.5 })
    .finish();
  const eg = prism(0.05, 0.04, 0.04, 0.05, 0.04, { hang: false, sides: 4 });
  for (const x of [0.08, -0.08]) {
    const e = new THREE.Mesh(eg, coreMat);
    e.position.set(x, 0.08, 0.19);
    rig.head.add(e);
  }

  for (const [g, s] of [[rig.armL, 1], [rig.armR, -1]]) {
    new Part(g)
      .add(prism(0.36, 0.38, 0.16, 0.40, 0.42, { hang: false }), stone, { y: 0.04, rz: s * 0.1 })
      .add(prism(0.255, 0.275, 0.44, 0.29, 0.31), stone, { y: -0.06 })
      .add(spike(0.05, 0.14, 4), stone, { x: s * 0.16, y: 0.1, rz: s * 0.8 })
      .finish();
  }
  for (const g of [rig.foreL, rig.foreR]) {
    new Part(g).add(prism(0.255, 0.275, 0.40, 0.275, 0.295), stone).finish();
  }
  // 주먹 — 골렘의 무기. 팔보다 굵어야 「내려찍는 것」으로 읽힌다
  for (const g of [rig.handL, rig.handR]) {
    new Part(g)
      .add(prism(0.36, 0.38, 0.30, 0.34, 0.36), stone, { y: -0.02 })
      .add(prism(0.12, 0.12, 0.10, 0.10, 0.10, { hang: false }), dark, { y: -0.24, z: 0.10 })
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
