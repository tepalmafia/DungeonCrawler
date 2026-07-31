// 아트 방향 시제품 — 같은 장면을 세 가지로 지어 나란히 비교한다.
//
//   current : 지금 게임 그대로 (실제 게임 빌더를 그대로 불러온다 — 대조군이 거짓이면 비교가 무의미하다)
//   A       : 저폴리 스타일라이즈드 — **형태를 바꾼다** (모따기·테이퍼·불규칙 실루엣, 채도 높은 팔레트)
//   B       : 어둡고 사실적      — **표면과 빛을 바꾼다** (노멀·거칠기맵, 젖은 바닥, 낮은 채도·강한 대비)
//
// 외부 에셋은 여전히 0이다. A는 ExtrudeGeometry 의 베벨로, B는 절차 높이맵에서
// 만든 노멀맵으로 만든다 — 둘 다 three.js 코어만 쓴다.

import * as THREE from 'three';
import { floorTexture, wallTexture, wallTopTexture, flameTexture, softDot, beamTexture } from '../core/textures.js';
import { makeRng } from '../core/rng.js';
import { buildKnight } from '../game/player.js';
import { ARCHETYPES } from '../game/enemies.js';
import { themeFor } from '../world/dungeon.js';
import { normalTexture, dataTexture, grayCanvas } from '../core/normalmap.js';

const CELL = 2, WALL_H = 3.4;

// 장면 배치는 세 패널이 완전히 같다 — 다른 건 오직 아트다
const LAYOUT = {
  floor: { w: 16, d: 16 },
  // 뒤쪽 벽 한 줄 + 왼쪽 벽 한 줄 (L자) — 모서리가 보여야 벽 표현이 드러난다
  wallsBack: 8,
  wallsLeft: 5,
  torches: [{ x: -1, z: -7 }, { x: 5, z: -7 }],
  knight: { x: 0.5, z: 0.5 },
  skeleton: { x: 3.6, z: -1.6 },
  drop: { x: -3.4, z: -0.6 },
};

function disposeLater(store, ...xs) { store.push(...xs); return xs[0]; }

// ══════════════════════════════════════════════════════════════
//  공통 — 바닥/벽 격자 좌표
// ══════════════════════════════════════════════════════════════
function wallSlots() {
  const out = [];
  for (let i = 0; i < LAYOUT.wallsBack; i++) out.push({ x: (i - 3.5) * CELL, z: -7 });
  for (let i = 0; i < LAYOUT.wallsLeft; i++) out.push({ x: -8, z: (i - 3) * CELL });
  return out;
}

// ══════════════════════════════════════════════════════════════
//  current — 지금 게임
// ══════════════════════════════════════════════════════════════
function buildCurrent(scene, theme, D) {
  const floorGeo = new THREE.PlaneGeometry(LAYOUT.floor.w, LAYOUT.floor.d);
  const ft = floorTexture(theme, 1);
  ft.repeat.set(LAYOUT.floor.w / (CELL * 3), LAYOUT.floor.d / (CELL * 3));
  const floor = new THREE.Mesh(floorGeo, disposeLater(D, new THREE.MeshLambertMaterial({ map: ft })));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  D.push(floorGeo);

  const geo = disposeLater(D, new THREE.BoxGeometry(CELL, WALL_H, CELL));
  const side = disposeLater(D, new THREE.MeshLambertMaterial({ map: wallTexture(theme) }));
  const top = disposeLater(D, new THREE.MeshLambertMaterial({ map: wallTopTexture(theme) }));
  for (const s of wallSlots()) {
    const m = new THREE.Mesh(geo, [side, side, top, side, side, side]);
    m.position.set(s.x, WALL_H / 2, s.z);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }

  const k = buildKnight();
  k.group.position.set(LAYOUT.knight.x, 0, LAYOUT.knight.z);
  k.group.rotation.y = 2.6;
  scene.add(k.group);

  const sk = ARCHETYPES.skeleton.build();
  sk.group.position.set(LAYOUT.skeleton.x, 0, LAYOUT.skeleton.z);
  sk.group.rotation.y = -2.2;
  sk.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(sk.group);

  addDrop(scene, D, 0xff8a2b, 'box');
  addTorches(scene, D, theme, 'plain');
  return { ambient: 0.52, moon: 0.58, torch: 52, lamp: 62, fog: 0.03, exposure: 1.0 };
}

// ══════════════════════════════════════════════════════════════
//  A — 저폴리 스타일라이즈드 : 형태를 바꾼다
// ══════════════════════════════════════════════════════════════

/** 모따기된 상자 — RoundedBoxGeometry(애드온) 없이 ExtrudeGeometry 로 만든다 */
function beveledBox(w, h, d, bevel = 0.12) {
  const s = new THREE.Shape();
  const hw = w / 2 - bevel, hd = d / 2 - bevel;
  s.moveTo(-hw, -hd); s.lineTo(hw, -hd); s.lineTo(hw, hd); s.lineTo(-hw, hd); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: h - bevel * 2, bevelEnabled: true,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1,
  });
  g.rotateX(-Math.PI / 2);          // 압출 축을 Y 로
  g.translate(0, h / 2 - bevel, 0);
  return g;
}

/** 그래픽한 바닥 — 잔무늬를 걷고 큰 면과 굵은 줄눈만 남긴다 */
function styleAFloorTexture(theme) {
  const S = 512, N = 3, cell = S / N;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const rnd = makeRng('A-floor');
  const base = new THREE.Color(theme.floor).offsetHSL(0.02, 0.04, 0.04);

  ctx.fillStyle = '#' + base.clone().multiplyScalar(0.55).getHexString();
  ctx.fillRect(0, 0, S, S);
  for (let gy = 0; gy < N; gy++) {
    for (let gx = -1; gx <= N; gx++) {
      const off = (gy % 2) * cell * 0.5;
      const x = gx * cell + off, y = gy * cell;
      const w = cell - 7, h = cell - 7;
      const tone = base.clone().multiplyScalar(rnd.range(0.9, 1.15));
      ctx.fillStyle = '#' + tone.getHexString();
      ctx.fillRect(x + 3, y + 3, w, h);
      // 한쪽만 밝은 면 — 손으로 칠한 듯한 인상
      ctx.fillStyle = 'rgba(255,255,255,.1)';
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + 3 + w, y + 3); ctx.lineTo(x + 3, y + 3 + h); ctx.closePath();
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 저폴리 기사 — 상자를 버리고 원뿔·테이퍼·모따기로 실루엣을 만든다 */
function buildKnightA() {
  const g = new THREE.Group();
  const M = (c, opt = {}) => new THREE.MeshLambertMaterial({ color: c, ...opt });
  const steel = M(0xd2d9ea), cloth = M(0xe2606a), dark = M(0x6a6482), gold = M(0xf0c260);

  // 다리 — 아래로 갈수록 좁아진다
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.62, 5), dark);
    leg.position.set(sx * 0.15, 0.31, 0);
    g.add(leg);
  }
  // 몸통 — 허리 좁고 어깨 넓은 사다리꼴
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.2, 0.78, 6), steel);
  torso.position.y = 1.0;
  g.add(torso);
  // 어깨 — 원뿔 견갑. 상자 어깨와 실루엣이 확연히 다르다
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.3, 6), steel);
    p.position.set(sx * 0.36, 1.3, 0);
    p.rotation.z = sx * 0.42;
    g.add(p);
  }
  // 머리 + 뾰족 투구
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 5), M(0xd8b18f));
  head.position.y = 1.55;
  const helm = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.32, 6), steel);
  helm.position.y = 1.68;
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.26, 4), cloth);
  crest.position.y = 1.92;
  g.add(head, helm, crest);
  // 망토 — 아래로 퍼지는 사다리꼴
  const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 0.8, 6, 1, true),
    M(0xc04a52, { side: THREE.DoubleSide }));
  cloak.position.set(0, 0.9, -0.26);
  g.add(cloak);
  // 검 — 모따기된 날 + 굵은 코등이
  const sword = new THREE.Group();
  sword.position.set(0.42, 1.05, 0.12);
  sword.rotation.z = -0.5;
  const blade = new THREE.Mesh(beveledBox(0.13, 1.0, 0.05, 0.03), steel);
  blade.position.y = 0.55;
  const guard = new THREE.Mesh(beveledBox(0.4, 0.08, 0.11, 0.03), gold);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.24, 5), dark);
  grip.position.y = -0.14;
  sword.add(blade, guard, grip);
  g.add(sword);
  // 방패 — 아래가 뾰족한 연꼴
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.02, 0.1, 5), M(0x9a6a3a));
  shield.position.set(-0.42, 1.0, 0.16);
  shield.rotation.set(Math.PI / 2, 0, 0.2);
  g.add(shield);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** 저폴리 해골 — 갈비뼈를 링으로, 두개골을 각진 다면체로 */
function buildSkeletonA() {
  const g = new THREE.Group();
  const bone = new THREE.MeshLambertMaterial({ color: 0xe4dcc2 });
  const rag = new THREE.MeshLambertMaterial({ color: 0x5c5570 });
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.58, 5), bone);
    leg.position.set(sx * 0.13, 0.29, 0);
    g.add(leg);
  }
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.55, 5), bone);
  spine.position.y = 0.85;
  g.add(spine);
  for (let i = 0; i < 3; i++) {                    // 갈비뼈 = 납작한 링
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.19 - i * 0.03, 0.028, 4, 8), bone);
    rib.position.y = 0.72 + i * 0.15;
    rib.rotation.x = Math.PI / 2;
    rib.scale.z = 0.55;
    g.add(rib);
  }
  const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), bone);
  skull.position.y = 1.28;
  const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.12, 5), bone);
  jaw.position.y = 1.16; jaw.rotation.x = Math.PI;
  g.add(skull, jaw);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xff5a2a });
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), eyeM);
    e.position.set(sx * 0.06, 1.3, 0.14);
    g.add(e);
  }
  const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.36, 0.6, 5, 1, true),
    new THREE.MeshLambertMaterial({ color: 0x4a4358, side: THREE.DoubleSide }));
  cape.position.set(0, 0.8, -0.1);
  g.add(cape);
  const sword = new THREE.Mesh(beveledBox(0.1, 0.75, 0.04, 0.025), new THREE.MeshLambertMaterial({ color: 0xb9c0cc }));
  sword.position.set(0.3, 0.95, 0.05);
  sword.rotation.z = -0.9;
  g.add(sword);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function buildA(scene, theme, D) {
  const ft = disposeLater(D, styleAFloorTexture(theme));
  ft.repeat.set(LAYOUT.floor.w / (CELL * 3), LAYOUT.floor.d / (CELL * 3));
  const floorGeo = disposeLater(D, new THREE.PlaneGeometry(LAYOUT.floor.w, LAYOUT.floor.d));
  const floor = new THREE.Mesh(floorGeo, disposeLater(D, new THREE.MeshLambertMaterial({ map: ft })));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // 벽 — 높이가 제각각이고 살짝 돌아가 있으며 모서리가 깎여 있다.
  // 같은 정육면체를 격자에 세우는 것과 실루엣이 완전히 달라진다.
  const rnd = makeRng('A-walls');
  const wallCol = new THREE.Color(theme.wall).offsetHSL(0.02, 0.06, 0.08);
  const matSide = disposeLater(D, new THREE.MeshLambertMaterial({ color: wallCol }));
  const matTop = disposeLater(D, new THREE.MeshLambertMaterial({ color: wallCol.clone().multiplyScalar(1.45) }));
  for (const s of wallSlots()) {
    const h = WALL_H * rnd.range(0.82, 1.18);
    const g = disposeLater(D, beveledBox(CELL * 0.99, h, CELL * 0.99, 0.16));
    // ExtrudeGeometry 는 면 그룹이 1개라 재질 배열이 안 먹는다 → 옆면 재질 하나로 두고
    // 윗면은 아래에서 별도 판(cap)으로 얹는다
    const m = new THREE.Mesh(g, matSide);
    m.position.set(s.x, h / 2, s.z);
    m.rotation.y = rnd.range(-0.05, 0.05);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    // 윗면 밝은 판 — 위에서 빛을 받는 면을 분리해 높이를 읽히게 한다
    const cap = new THREE.Mesh(
      disposeLater(D, new THREE.BoxGeometry(CELL * 0.86, 0.12, CELL * 0.86)), matTop);
    cap.position.set(s.x, h + 0.02, s.z);
    cap.rotation.y = m.rotation.y;
    scene.add(cap);
  }
  // 벽 밑 바위 — 격자선을 깨뜨린다
  const rockMat = disposeLater(D, new THREE.MeshLambertMaterial({ color: wallCol.clone().multiplyScalar(0.85) }));
  for (let i = 0; i < 14; i++) {
    const s = wallSlots()[rnd.int(0, wallSlots().length - 1)];
    const r = new THREE.Mesh(
      disposeLater(D, new THREE.DodecahedronGeometry(rnd.range(0.22, 0.5), 0)), rockMat);
    r.position.set(s.x + rnd.range(-1.1, 1.1), rnd.range(0.1, 0.3), s.z + rnd.range(0.9, 1.5));
    r.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    r.castShadow = true;
    scene.add(r);
  }

  const k = buildKnightA();
  k.position.set(LAYOUT.knight.x, 0, LAYOUT.knight.z);
  k.rotation.y = 2.6;
  scene.add(k);

  const sk = buildSkeletonA();
  sk.position.set(LAYOUT.skeleton.x, 0, LAYOUT.skeleton.z);
  sk.rotation.y = -2.2;
  scene.add(sk);

  addDrop(scene, D, 0xffb03a, 'gem');
  addTorches(scene, D, theme, 'stylized');
  // 스타일라이즈드는 조금 더 밝고 채도가 높아야 산다
  return { ambient: 0.7, moon: 0.7, torch: 50, lamp: 60, fog: 0.024, exposure: 1.05 };
}

// ══════════════════════════════════════════════════════════════
//  B — 어둡고 사실적 : 표면과 빛을 바꾼다
// ══════════════════════════════════════════════════════════════
function bStoneMaps(seed, { bricks = false } = {}) {
  const S = 512;
  const rnd = makeRng('B-' + seed);
  // 높이 — 요철
  const height = grayCanvas(S, (ctx) => {
    if (bricks) {
      const ROWS = 7, bh = S / ROWS, bw = S / 4;
      for (let r = 0; r < ROWS; r++) {
        const off = (r % 2) * bw * 0.5;
        for (let i = -1; i <= 4; i++) {
          const x = i * bw + off, y = r * bh;
          ctx.fillStyle = `rgb(${(150 + rnd.range(-28, 28)) | 0},${(150) | 0},${150})`;
          ctx.fillRect(x + 3, y + 3, bw - 6, bh - 6);
          ctx.fillStyle = 'rgba(40,40,40,1)';       // 줄눈은 깊게 파인다
          ctx.fillRect(x, y, bw, 3);
          ctx.fillRect(x, y, 3, bh);
        }
      }
    } else {
      const N = 4, cell = S / N;
      for (let gy = 0; gy < N; gy++)
        for (let gx = -1; gx <= N; gx++) {
          const off = (gy % 2) * cell * 0.5;
          const v = (140 + rnd.range(-22, 30)) | 0;
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(gx * cell + off + 2, gy * cell + 2, cell - 5, cell - 5);
        }
      ctx.fillStyle = 'rgba(30,30,30,1)';
      for (let i = 0; i < 40; i++)                  // 균열은 깊다
        ctx.fillRect(rnd() * S, rnd() * S, rnd.range(1, 3), rnd.range(6, 40));
    }
    // 잔 요철
    for (let i = 0; i < 900; i++) {
      const v = (128 + rnd.range(-38, 38)) | 0;
      ctx.fillStyle = `rgba(${v},${v},${v},.5)`;
      ctx.beginPath();
      ctx.arc(rnd() * S, rnd() * S, rnd.range(1, 5), 0, Math.PI * 2);
      ctx.fill();
    }
  });
  // 거칠기 — 검정일수록 매끈(젖음). 물기 웅덩이를 넣으면 횃불이 반사된다.
  const rough = grayCanvas(S, (ctx) => {
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(0, 0, S, S);
    if (!bricks) {
      for (let i = 0; i < 9; i++) {
        const g = ctx.createRadialGradient(rnd() * S, rnd() * S, 2, rnd() * S, rnd() * S, rnd.range(30, 90));
        g.addColorStop(0, 'rgba(40,40,40,.95)');
        g.addColorStop(1, 'rgba(216,216,216,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, S, S);
      }
    }
  });
  return { height, rough };
}

function buildB(scene, theme, D) {
  const fm = bStoneMaps('floor');
  const rep = LAYOUT.floor.w / (CELL * 3);
  const ft = floorTexture(theme, 1);
  ft.repeat.set(rep, rep);
  const floorMat = disposeLater(D, new THREE.MeshStandardMaterial({
    map: ft,
    normalMap: disposeLater(D, normalTexture(fm.height, { repeat: rep, strength: 2.6 })),
    roughnessMap: disposeLater(D, dataTexture(fm.rough, { repeat: rep })),
    color: 0x6a6472, roughness: 1, metalness: 0.06,
  }));
  floorMat.normalScale.set(1.1, 1.1);
  const floor = new THREE.Mesh(
    disposeLater(D, new THREE.PlaneGeometry(LAYOUT.floor.w, LAYOUT.floor.d)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wm = bStoneMaps('wall', { bricks: true });
  const wallMat = disposeLater(D, new THREE.MeshStandardMaterial({
    map: wallTexture(theme),
    normalMap: disposeLater(D, normalTexture(wm.height, { repeat: 1, strength: 3.0 })),
    roughnessMap: disposeLater(D, dataTexture(wm.rough)),
    color: 0x5e586a, roughness: 1, metalness: 0.04,
  }));
  wallMat.normalScale.set(1.4, 1.4);
  const rnd = makeRng('B-walls');
  for (const s of wallSlots()) {
    // 높이를 조금씩 달리하고 윗단을 깨뜨린다 — 일정한 정육면체 열이 안 보이게
    const h = WALL_H * rnd.range(0.92, 1.06);
    const m = new THREE.Mesh(disposeLater(D, new THREE.BoxGeometry(CELL, h, CELL)), wallMat);
    m.position.set(s.x, h / 2, s.z);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    if (rnd.chance(0.45)) {                       // 부서진 윗단
      const c = new THREE.Mesh(
        disposeLater(D, new THREE.BoxGeometry(CELL * rnd.range(0.3, 0.7), rnd.range(0.2, 0.5), CELL * 0.9)), wallMat);
      c.position.set(s.x + rnd.range(-0.5, 0.5), h + 0.15, s.z);
      c.castShadow = true;
      scene.add(c);
    }
  }
  // 벽 밑 잔해 — 바닥과 벽이 만나는 선을 흐린다
  for (let i = 0; i < 18; i++) {
    const s = wallSlots()[rnd.int(0, wallSlots().length - 1)];
    const r = new THREE.Mesh(
      disposeLater(D, new THREE.DodecahedronGeometry(rnd.range(0.12, 0.3), 0)), wallMat);
    r.position.set(s.x + rnd.range(-1, 1), rnd.range(0.05, 0.16), s.z + rnd.range(0.9, 1.4));
    r.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    r.castShadow = true;
    scene.add(r);
  }

  // 캐릭터 — 실루엣은 유지하되 금속 재질로 바꾼다 (표면이 주인공인 안이다)
  const k = buildKnight();
  k.group.position.set(LAYOUT.knight.x, 0, LAYOUT.knight.z);
  k.group.rotation.y = 2.6;
  k.group.traverse((o) => {
    if (!o.isMesh) return;
    const c = o.material.color ? o.material.color.clone() : new THREE.Color(0x888888);
    o.material = new THREE.MeshStandardMaterial({
      color: c.multiplyScalar(0.72), metalness: 0.75, roughness: 0.34,
    });
    D.push(o.material);
  });
  scene.add(k.group);

  const sk = ARCHETYPES.skeleton.build();
  sk.group.position.set(LAYOUT.skeleton.x, 0, LAYOUT.skeleton.z);
  sk.group.rotation.y = -2.2;
  sk.group.traverse((o) => {
    if (!o.isMesh) return;
    const c = o.material.color ? o.material.color.clone() : new THREE.Color(0x888888);
    o.material = new THREE.MeshStandardMaterial({ color: c.multiplyScalar(0.8), roughness: 0.72, metalness: 0.2 });
    o.castShadow = true;
    D.push(o.material);
  });
  scene.add(sk.group);

  addDrop(scene, D, 0xff8a2b, 'metal');
  addTorches(scene, D, theme, 'plain');
  // 어둡고 대비가 강해야 이 안의 장점(젖은 반사·요철 그림자)이 보인다
  return { ambient: 0.5, moon: 0.62, torch: 78, lamp: 68, fog: 0.03, exposure: 1.05 };
}

// ══════════════════════════════════════════════════════════════
//  공통 소품
// ══════════════════════════════════════════════════════════════
function addTorches(scene, D, theme, kind) {
  for (const t of LAYOUT.torches) {
    const bracket = new THREE.Mesh(
      disposeLater(D, new THREE.BoxGeometry(0.16, 0.5, 0.16)),
      disposeLater(D, new THREE.MeshLambertMaterial({ color: 0x1d1a20 })));
    bracket.position.set(t.x, 1.85, t.z + 1.15);
    scene.add(bracket);

    const mat = disposeLater(D, new THREE.SpriteMaterial({
      map: flameTexture(), color: theme.torch,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    const flame = new THREE.Sprite(mat);
    flame.position.set(t.x, 2.2, t.z + 1.15);
    const big = kind === 'stylized';
    flame.scale.set(big ? 0.95 : 0.62, big ? 1.3 : 0.86, 1);
    scene.add(flame);
  }
}

function addDrop(scene, D, color, kind) {
  const g = new THREE.Group();
  g.position.set(LAYOUT.drop.x, 0, LAYOUT.drop.z);
  let geo;
  if (kind === 'gem') geo = new THREE.OctahedronGeometry(0.3, 0);
  else if (kind === 'metal') geo = new THREE.BoxGeometry(0.13, 0.9, 0.13);
  else geo = new THREE.BoxGeometry(0.13, 0.9, 0.13);
  const mat = disposeLater(D, new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.7,
  }));
  const m = new THREE.Mesh(disposeLater(D, geo), mat);
  m.position.y = kind === 'gem' ? 0.5 : 0.55;
  m.rotation.z = 0.4;
  g.add(m);

  const beam = new THREE.Sprite(disposeLater(D, new THREE.SpriteMaterial({
    map: beamTexture(), color, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0.75,
  })));
  beam.scale.set(1.1, 3.0, 1);
  beam.position.y = 1.4;
  g.add(beam);

  const glow = new THREE.Sprite(disposeLater(D, new THREE.SpriteMaterial({
    map: softDot(), color, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0.5,
  })));
  glow.scale.set(1.6, 1.6, 1);
  glow.position.y = 0.12;
  g.add(glow);
  scene.add(g);
}

// ══════════════════════════════════════════════════════════════
export const STYLES = [
  { key: 'current', label: '현재', note: '축 정렬 상자 · 격자 벽' },
  { key: 'A', label: 'A · 저폴리 스타일라이즈드', note: '형태를 바꾼다 — 모따기·테이퍼·불규칙 높이' },
  { key: 'B', label: 'B · 어둡고 사실적', note: '표면을 바꾼다 — 노멀·거칠기맵, 젖은 바닥' },
];

/** 한 패널을 통째로 짓는다. { scene, camera, dispose } 반환 */
export function buildPanel(styleKey, floorNo = 1) {
  const theme = themeFor(floorNo);
  const scene = new THREE.Scene();
  const D = [];

  const cfg = styleKey === 'A' ? buildA(scene, theme, D)
    : styleKey === 'B' ? buildB(scene, theme, D)
      : buildCurrent(scene, theme, D);

  scene.fog = new THREE.FogExp2(theme.fog, cfg.fog);
  scene.background = new THREE.Color(theme.fog);

  const hemi = new THREE.HemisphereLight(0x272038, 0x08060d, cfg.ambient);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x8296c8, cfg.moon);
  moon.position.set(6, 14, 8);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  const sc = moon.shadow.camera;
  sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 40;
  sc.updateProjectionMatrix();
  moon.shadow.bias = -0.0016;
  moon.shadow.normalBias = 0.035;
  scene.add(moon, moon.target);

  const lamp = new THREE.PointLight(theme.torch, cfg.lamp, 20, 2);
  lamp.position.set(LAYOUT.knight.x, 1.9, LAYOUT.knight.z);
  scene.add(lamp);
  for (const t of LAYOUT.torches) {
    const l = new THREE.PointLight(theme.torch, cfg.torch, 18, 2);
    l.position.set(t.x, 2.2, t.z + 1.15);
    scene.add(l);
  }

  // 시제품은 「벽·바닥·캐릭터가 한 화면에」 들어와야 비교가 된다.
  // 게임 각(52°)보다 낮게 눕히고 목표점을 벽 쪽으로 당긴다.
  const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 200);
  const pitch = 40 * Math.PI / 180, dist = 17;
  const look = new THREE.Vector3(LAYOUT.knight.x, 1.1, LAYOUT.knight.z - 3.2);
  camera.position.set(look.x, look.y + Math.sin(pitch) * dist, look.z + Math.cos(pitch) * dist);
  camera.lookAt(look);

  return {
    scene, camera, exposure: cfg.exposure,
    dispose() { for (const d of D) d.dispose?.(); },
  };
}
