// 옛 리그 — **비교용 냉동 사본.** 게임은 이걸 쓰지 않는다.
//
// 「좋아졌다」는 말은 옆에 나란히 놓고 봐야 확인된다. 그래서 개선 전 메시와
// 포저를 그대로 복사해 둔다. 원본(player.js·enemies.js)이 바뀌어도 이 파일은
// 안 바뀌므로, actors.html 의 「현재」 열은 언제나 **개선 직전 상태**를 가리킨다.
//
// 커밋 454df49 기준 사본이다.

import * as THREE from 'three';

function mat(color, opt = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.22, ...opt });
}

/** 기사 메시 — 상체/하체/팔/무기를 분리해 애니메이션이 가능하게 만든다.
 *  (아트 시제품 비교에서 「현재」 패널이 실제 게임 메시를 그대로 쓰도록 내보낸다) */
export function oldKnight() {
  const g = new THREE.Group();
  const steel = mat(0x9aa2b8, { metalness: 0.82, roughness: 0.3 });
  const dark = mat(0x3f3b4d, { metalness: 0.35, roughness: 0.7 });
  const cloth = mat(0xb8434b, { roughness: 0.9, metalness: 0.05 });
  const skin = mat(0xc7a288, { roughness: 0.85, metalness: 0 });

  // 다리
  const legGeo = new THREE.BoxGeometry(0.19, 0.62, 0.22);
  const legL = new THREE.Mesh(legGeo, dark); legL.position.set(-0.15, 0.31, 0);
  const legR = new THREE.Mesh(legGeo, dark); legR.position.set(0.15, 0.31, 0);
  g.add(legL, legR);

  // 상체 (허리에서 어깨로 넓어지게 두 덩이)
  const torso = new THREE.Group();
  torso.position.y = 0.62;
  const hip = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.24, 0.28), steel);
  hip.position.y = 0.12;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.36, 0.32), steel);
  chest.position.y = 0.42;
  torso.add(hip, chest);

  // 어깨 갑주 — 실루엣의 핵심. 이게 있으면 멀리서도 "기사"로 읽힌다
  const paulGeo = new THREE.SphereGeometry(0.19, 8, 6);
  const paulL = new THREE.Mesh(paulGeo, steel); paulL.position.set(-0.34, 0.52, 0);
  const paulR = new THREE.Mesh(paulGeo, steel); paulR.position.set(0.34, 0.52, 0);
  paulL.scale.set(1, 0.8, 1); paulR.scale.set(1, 0.8, 1);
  torso.add(paulL, paulR);

  // 머리 + 투구
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), skin);
  head.position.y = 0.76;
  const helm = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.19, 0.31), steel);
  helm.position.y = 0.85;
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.3), cloth);
  crest.position.y = 1.0;
  torso.add(head, helm, crest);

  // 망토
  const cloak = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.9), new THREE.MeshStandardMaterial({
    color: 0x93343c, side: THREE.DoubleSide, roughness: 0.95, metalness: 0,
  }));
  cloak.position.set(0, 0.34, -0.2);
  cloak.rotation.x = 0.12;
  torso.add(cloak);

  // 오른팔 + 무기 (스윙 축이 어깨에 오도록 그룹 원점을 어깨에 둔다)
  //
  // **x 는 음수다.** facing = atan2(dx, dz) 라 모델의 정면이 +Z 이고,
  // 오른손 좌표계에서 정면 +Z · 위 +Y 이면 오른쪽은 −X 다.
  // 그동안 +0.34 에 무기를 달아 두어서 플레이어도 몬스터도 전부 왼손잡이였다.
  const armR = new THREE.Group();
  armR.position.set(-0.34, 0.5, 0);
  const upperR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.42, 0.15), dark);
  upperR.position.y = -0.2;
  armR.add(upperR);

  const weapon = new THREE.Group();
  weapon.position.set(0, -0.4, 0.05);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.07), dark);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.09), mat(0xb99a4e, { metalness: 0.8 }));
  guard.position.y = 0.14;
  const bladeMat = mat(0xd7dbe6, { metalness: 0.85, roughness: 0.25, emissive: 0x000000 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.86, 0.045), bladeMat);
  blade.position.y = 0.6;
  weapon.add(grip, guard, blade);
  weapon.rotation.x = -0.25;
  armR.add(weapon);

  // 왼팔 + 방패
  const armL = new THREE.Group();
  armL.position.set(0.34, 0.5, 0);
  const upperL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.42, 0.15), dark);
  upperL.position.y = -0.2;
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.07), mat(0x8a6238, { roughness: 0.8 }));
  shield.position.set(0.12, -0.28, 0.13);
  shield.rotation.y = -0.35;
  armL.add(upperL, shield);

  torso.add(armR, armL);
  g.add(torso);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  return { group: g, torso, legL, legR, armR, armL, weapon, blade, bladeMat, materials: [steel, dark, cloth, skin, bladeMat] };
}

/**
 * 상자 기사의 자세 — **관절을 아는 유일한 곳.**
 *
 * 게임 로직은 이제 `actor.play('walk')` 만 부른다. 여기 있는 코드는 그 동사를
 * 상자 리그로 수행하는 방법이고, 산 모델을 넣으면 GltfActor 가 같은 동사를
 * AnimationMixer 로 수행한다 (core/actor.js).
 *
 * 한 가지 다른 점: 상자 리그는 **걷기와 휘두르기를 동시에** 한다 (다리와 팔이
 * 따로 놀 수 있으므로). 그래서 idle/walk/attack 이 전부 같은 몸통 함수를 부르고
 * ctx 의 raw 값(moved·swing)으로 갈린다. 산 모델은 클립 하나만 재생하므로
 * 그때는 이름이 실제로 갈라진다 — 그래도 **호출부는 안 바뀐다.**
 */
export function oldKnightBody(rig, c) {
  const { dt, moved, swing, walkT } = c;
  let d = c.facing - rig.group.rotation.y;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  rig.group.rotation.y += d * Math.min(1, dt * 16);

  if (moved > 0.05) {
    const sn = Math.sin(walkT);
    rig.legL.rotation.x = sn * 0.75;
    rig.legR.rotation.x = -sn * 0.75;
    rig.torso.position.y = 0.62 + Math.abs(Math.sin(walkT * 2)) * 0.045;
    rig.armL.rotation.x = -sn * 0.34;
  } else {
    rig.legL.rotation.x *= 1 - Math.min(1, dt * 9);
    rig.legR.rotation.x *= 1 - Math.min(1, dt * 9);
    rig.armL.rotation.x *= 1 - Math.min(1, dt * 9);
    rig.torso.position.y += (0.62 - rig.torso.position.y) * Math.min(1, dt * 9);
  }

  if (swing > 0) {
    const k = 1 - swing;                       // 0 → 1
    const a = k < 0.32 ? -1.15 * (k / 0.32) : -1.15 + 2.5 * ((k - 0.32) / 0.68);
    rig.armR.rotation.x = a;
    rig.armR.rotation.z = 0.25 * Math.sin(k * Math.PI);
    rig.torso.rotation.y = 0.3 * Math.sin(k * Math.PI);
  } else {
    rig.armR.rotation.x += (0.05 - rig.armR.rotation.x) * Math.min(1, dt * 9);
    rig.armR.rotation.z *= 1 - Math.min(1, dt * 9);
    rig.torso.rotation.y *= 1 - Math.min(1, dt * 9);
  }
}


export function oldEnemyBody(rig, t, k, c) {
  const { dt, moving, walkT, armX } = c;
  let d = c.facing - rig.group.rotation.y;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  rig.group.rotation.y += d * Math.min(1, dt * 12);

  if (rig.float) {
    rig.group.position.y = 0.28 + Math.sin(walkT * 1.6 + c.bobPhase) * 0.12;
  } else if (moving > 0.05) {
    const sn = Math.sin(walkT);
    if (rig.legL) rig.legL.rotation.x = sn * 0.8;
    if (rig.legR) rig.legR.rotation.x = -sn * 0.8;
    rig.group.position.y = Math.abs(Math.sin(walkT * 2)) * 0.05;
  } else {
    if (rig.legL) rig.legL.rotation.x *= 1 - Math.min(1, dt * 8);
    if (rig.legR) rig.legR.rotation.x *= 1 - Math.min(1, dt * 8);
    rig.group.position.y *= 1 - Math.min(1, dt * 8);
  }

  // 팔: 예비 동작에서 크게 젖혔다가 타격에서 내려친다
  if (rig.arm) rig.arm.rotation.x += (armX - rig.arm.rotation.x) * Math.min(1, dt * 18);
}


function m(color, opt = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1, ...opt });
}

// ───────────────────────── 메시 ─────────────────────────
export function oldSkeleton() {                       // 두개골 · 장신 마름 · 검
  const g = new THREE.Group();
  const bone = m(0xcfc6ad, { roughness: 0.7 });
  const rag = m(0x4a4453);
  const legGeo = new THREE.BoxGeometry(0.12, 0.55, 0.13);
  const legL = new THREE.Mesh(legGeo, bone); legL.position.set(-0.12, 0.28, 0);
  const legR = new THREE.Mesh(legGeo, bone); legR.position.set(0.12, 0.28, 0);
  const torso = new THREE.Group(); torso.position.y = 0.55;
  const ribs = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.2), bone);
  ribs.position.y = 0.2;
  for (let i = 0; i < 3; i++) {                  // 갈비뼈 — 해골의 정체성
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.045, 0.24), bone);
    r.position.y = 0.08 + i * 0.12;
    torso.add(r);
  }
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), bone);
  skull.position.y = 0.55;
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.2), bone);
  jaw.position.y = 0.43;
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff4a2a });
  const eyeGeo = new THREE.BoxGeometry(0.055, 0.05, 0.03);
  const eL = new THREE.Mesh(eyeGeo, eyeMat); eL.position.set(-0.06, 0.57, 0.12);
  const eR = new THREE.Mesh(eyeGeo, eyeMat); eR.position.set(0.06, 0.57, 0.12);
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.6), new THREE.MeshStandardMaterial({ color: 0x3b3546, side: THREE.DoubleSide, roughness: 1 }));
  cape.position.set(0, 0.22, -0.13);
  torso.add(ribs, skull, jaw, eL, eR, cape);

  // 무기 손은 −X 다 (정면이 +Z 이므로) — player.js 의 armR 주석 참조
  const arm = new THREE.Group(); arm.position.set(-0.25, 0.38, 0);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 0.1), bone);
  upper.position.set(0, -0.17, 0);
  arm.add(upper);

  const sword = new THREE.Group(); sword.position.set(0, -0.34, 0.04);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.06), rag);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.07), m(0x8a7a5a));
  guard.position.set(0, 0.1, 0);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.035), m(0xa9b0bd, { metalness: 0.7, roughness: 0.35 }));
  blade.position.set(0, 0.42, 0);
  sword.add(grip, guard, blade);
  sword.rotation.x = -0.2;
  arm.add(sword);
  torso.add(arm);
  g.add(legL, legR, torso);
  return { group: g, torso, legL, legR, arm, mats: [bone, rag] };
}

export function oldGhoul() {                          // 뿔 없음 · 왜소·굽은 몸 · 발톱
  const g = new THREE.Group();
  const skin = m(0x6d7a4e, { roughness: 0.95 });
  const claw = m(0xd8cdb0);
  const legGeo = new THREE.BoxGeometry(0.15, 0.36, 0.16);
  const legL = new THREE.Mesh(legGeo, skin); legL.position.set(-0.14, 0.18, 0);
  const legR = new THREE.Mesh(legGeo, skin); legR.position.set(0.14, 0.18, 0);
  const torso = new THREE.Group(); torso.position.y = 0.36;
  torso.rotation.x = 0.42;                       // 앞으로 굽은 자세
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), skin);
  body.scale.set(1, 0.85, 1.25);
  body.position.y = 0.2;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.3), skin);
  head.position.set(0, 0.3, 0.28);
  const maw = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 4), claw);
  maw.rotation.x = Math.PI / 2;
  maw.position.set(0, 0.25, 0.45);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd23a });
  const eL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.03), eyeMat); eL.position.set(-0.07, 0.36, 0.42);
  const eR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.03), eyeMat); eR.position.set(0.07, 0.36, 0.42);
  torso.add(body, head, maw, eL, eR);
  const arm = new THREE.Group(); arm.position.set(-0.28, 0.24, 0.1);
  const fore = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.34, 0.11), skin);
  fore.position.y = -0.16;
  for (let i = -1; i <= 1; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.19, 4), claw);
    c.position.set(i * 0.06, -0.36, 0.03);
    c.rotation.x = Math.PI;
    arm.add(c);
  }
  arm.add(fore);
  torso.add(arm);
  g.add(legL, legR, torso);
  return { group: g, torso, legL, legR, arm, mats: [skin, claw] };
}

export function oldArcher() {                         // 두건 · 부유(다리 없음) · 활
  const g = new THREE.Group();
  const robe = m(0x3a4a63, { roughness: 1 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff });
  const torso = new THREE.Group(); torso.position.y = 0.85;
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.0, 7), robe);
  body.position.y = -0.15;
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 6), robe);
  hood.position.y = 0.4;
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.13, 0.05), new THREE.MeshBasicMaterial({ color: 0x0a0d14 }));
  face.position.set(0, 0.33, 0.15);
  const eL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.02), glowMat); eL.position.set(-0.04, 0.34, 0.18);
  const eR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.02), glowMat); eR.position.set(0.04, 0.34, 0.18);
  torso.add(body, hood, face, eL, eR);
  const arm = new THREE.Group(); arm.position.set(-0.26, 0.15, 0.05);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.032, 5, 12, Math.PI * 1.25), m(0x5a4630));
  bow.rotation.y = -Math.PI / 2;          // 손을 옮겼으니 활의 배도 같이 뒤집는다
  bow.rotation.z = -Math.PI * 0.38;
  arm.add(bow);
  torso.add(arm);
  g.add(torso);
  return { group: g, torso, legL: null, legR: null, arm, mats: [robe], float: true };
}

export function oldGolem() {                          // 투구 · 육중 · 맨손
  const g = new THREE.Group();
  const stone = m(0x6b6a72, { roughness: 0.95 });
  const core = new THREE.MeshBasicMaterial({ color: 0xff7a2a });
  const legGeo = new THREE.BoxGeometry(0.3, 0.5, 0.32);
  const legL = new THREE.Mesh(legGeo, stone); legL.position.set(-0.24, 0.25, 0);
  const legR = new THREE.Mesh(legGeo, stone); legR.position.set(0.24, 0.25, 0);
  const torso = new THREE.Group(); torso.position.y = 0.5;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.75, 0.6), stone);
  body.position.y = 0.38;
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), core);
  heart.position.set(0, 0.42, 0.31);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.36), stone);
  head.position.y = 0.92;
  const shGeo = new THREE.BoxGeometry(0.34, 0.34, 0.44);
  const shL = new THREE.Mesh(shGeo, stone); shL.position.set(-0.62, 0.6, 0);
  const shR = new THREE.Mesh(shGeo, stone); shR.position.set(0.62, 0.6, 0);
  torso.add(body, heart, head, shL, shR);
  const arm = new THREE.Group(); arm.position.set(-0.62, 0.5, 0);
  const fore = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.3), stone);
  fore.position.y = -0.34;
  const fist = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.42), stone);
  fist.position.y = -0.7;
  arm.add(fore, fist);
  const armL2 = new THREE.Group(); armL2.position.set(-0.62, 0.5, 0);
  armL2.add(fore.clone(), fist.clone());
  torso.add(arm, armL2);
  g.add(legL, legR, torso);
  return { group: g, torso, legL, legR, arm, mats: [stone] };
}
