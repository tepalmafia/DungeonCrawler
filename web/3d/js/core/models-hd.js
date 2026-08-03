// 몸 — **고품질 제안본.** 지금 게임의 core/models.js 를 대체하려는 후보다.
//
// ── 지금 것과 무엇이 다른가 ──────────────────────────────────
// 관절은 그대로 18 개다. 골격(rig.js)도 그대로 쓴다 — 그래야 동작 코드가
// 한 줄도 안 바뀌고, 마음에 들면 **파일 하나만 갈아 끼우면 된다.**
//
// 바뀐 것은 세 가지고, 셋 다 폴리곤 수와는 거의 무관하다.
//
//   1. **물질이 생겼다.** (core/surface.js)
//      뼈는 파이고 절었고, 강철은 결이 있고 모서리만 닳았고, 천은 짜임이 있고
//      위에 먼지가 앉는다. 지금은 다섯 물질이 전부 「매끈한 색」이라 멀리서
//      보면 다 같아 보인다. 이게 제일 크다.
//   2. **곡선이 생겼다.** 갈비뼈가 납작한 가로 막대에서 **앞으로 감기는 활**이
//      됐고, 어깨 갑주에 테두리가 생겼고, 활이 리커브가 됐다. 실루엣은
//      직선보다 곡선에서 훨씬 빨리 읽힌다.
//   3. **좌우가 달라졌다.** 구울은 한쪽 팔이 굵고, 해골은 한쪽에만 투구 잔해가
//      붙어 있고, 골렘은 한쪽 어깨가 깨져 있다. 완전 대칭은 **무생물로**
//      보인다 — 사람이 좌우 대칭을 이상하다고 느끼는 것은 본능에 가깝다.
//
// ── 그리고 하나 더: 정체성 효과 ──────────────────────────────
// 유령은 **아랫도리가 실제로 흩어지고**(discard 문턱), 골렘은 **균열에서 심장
// 빛이 새어 나온다**(발광 능선). 지금은 둘 다 「그렇게 생긴 모양」일 뿐이라
// 정지 화면에서 구분이 안 됐다.

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { prism, slab, spike, Part, skeleton } from './rig.js';
import { surface, dissolve, crackGlow, glowDisc } from './surface.js';

// ───────────────────────── 새 기본 도형 ─────────────────────────

/**
 * 활 — 갈비뼈·어깨 테두리·리커브 활·왕관. **이 파일에서 제일 값이 큰 도형이다.**
 *
 * 토러스는 XY 평면에 눕고 +X 에서 시작해 반시계로 돈다. 갈비뼈로 쓰려면
 * 「등뼈에서 시작해 앞으로 감긴다」가 되도록 돌려서 붙여야 한다.
 */
function arc(radius, tube, span = Math.PI, seg = 12, sides = 5) {
  return new THREE.TorusGeometry(radius, tube, sides, seg, span);
}

/**
 * 깨진 돌덩이 — 골렘의 몸. 정이십면체를 **꼭짓점 단위로** 밀어 찌그러뜨린다.
 *
 * IcosahedronGeometry 는 인덱스가 없다. 그대로 밀면 면이 서로 찢어지므로
 * 먼저 꼭짓점을 합친다 — rig.js 의 slab 에서 한 번 밟은 함정과 같은 뿌리다.
 */
function chunk(r, jag = 0.32, detail = 1) {
  let g = mergeVertices(new THREE.IcosahedronGeometry(r, detail));
  const p = g.attributes.position;
  const seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    let k = seen.get(key);
    if (k === undefined) {
      // 결정적 잡음 — Math.random 을 쓰면 같은 몬스터가 매번 다른 모양이 된다.
      // 그건 다양성이 아니라 **버그처럼 보이는 흔들림**이다
      const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
      k = 1 + (s - Math.floor(s) - 0.5) * jag * 2;
      seen.set(key, k);
    }
    p.setXYZ(i, x * k, y * k * 0.92, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** 뜯긴 천 조각 — 아래가 좁아지는 판. 길이를 다르게 여러 장 겹치면 넝마가 된다 */
function tatter(w, h, d = 0.02) {
  return prism(w * 0.35, d, h, w, d, { sides: 4 });
}

function M(color, opt = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1, ...opt });
}

function done(rig, mats) {
  rig.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  rig.mats = mats;
  rig.materials = mats;
  return rig;
}

/** 눈 — 발광 사각 + 뒤에 가산 원반. 원반이 없으면 「점 두 개」로 끝난다 */
function eyes(head, color, x, y, z, w = 0.045, h = 0.03, halo = 0.2) {
  const mat = new THREE.MeshBasicMaterial({ color });
  const eg = prism(w, h * 0.8, h, w, h * 0.8, { hang: false, sides: 4 });
  const discs = [];
  for (const sx of [x, -x]) {
    const e = new THREE.Mesh(eg, mat);
    e.position.set(sx, y, z);
    head.add(e);
    const d = glowDisc(color, halo);
    d.position.set(sx, y, z + 0.005);
    head.add(d);
    discs.push(d);
  }
  return discs;
}

// ═══════════════════════════ 기사 ═══════════════════════════
//
// 실루엣 규칙은 그대로다: **어깨가 제일 넓고, 허리가 잘록하고, 투구에 볏.**
// 여기에 세 겹을 더한다 — 골판(fauld) · 어깨 테두리 · 나뉜 망토.
//
// 골판이 왜 중요한가: 지금 기사는 허리 아래가 **통짜 한 덩이**라 다리가
// 움직여도 몸통이 안 산다. 갑옷의 「층」은 판이 겹쳐 있어서 생기는 것이고,
// 그 층이 걷는 동작에서 어긋나 보일 때 무게가 느껴진다.
export function buildKnightHD() {
  const steel = surface(M(0x8e97ad, { metalness: 0.88, roughness: 0.3 }), 'steel',
    { rim: 0x7fa8ff, rimAmt: 0.5, grime: 0.55, scale: 3.4 });
  const dark = surface(M(0x33313f, { metalness: 0.45, roughness: 0.6 }), 'mail',
    { rim: 0x6f90d0, rimAmt: 0.3, grime: 0.5, scale: 1.6 });
  const gold = surface(M(0xb99a4e, { metalness: 0.9, roughness: 0.26 }), 'steel',
    { rim: 0xffd08a, rimAmt: 0.6, scale: 3.4 });
  const cloth = surface(M(0x9a2f3c, { roughness: 0.96, metalness: 0.02 }), 'cloth',
    { rim: 0xff8080, rimAmt: 0.28, grime: 0.7, scale: 2.8 });
  const leather = surface(M(0x54402c, { roughness: 0.9, metalness: 0.04 }), 'leather',
    { rim: 0xc09060, rimAmt: 0.25, grime: 0.6, scale: 3.0 });
  const bladeMat = surface(M(0xd7dbe6, { metalness: 0.92, roughness: 0.14 }), 'steel',
    { rim: 0xcfe4ff, rimAmt: 0.7, scale: 2.6 });

  const rig = skeleton({
    hipY: 0.98, legX: 0.14, thigh: 0.44, shin: 0.42,
    spineY: 0.04, chestY: 0.24, neckY: 0.22, headY: 0.1,
    armX: 0.28, armY: 0.12, upper: 0.32, fore: 0.30,
  });

  // ── 다리 ── 정강이받이에 **세로 능선**을 넣는다. 갑옷의 홈은 장식이 아니라
  // 구조(같은 두께로 더 단단하게)이고, 그래서 있으면 「진짜 갑옷」으로 읽힌다
  const thighG = prism(0.155, 0.175, 0.44, 0.21, 0.23);
  const shinG = prism(0.13, 0.15, 0.42, 0.16, 0.18);
  const greave = slab(0.175, 0.31, 0.055, 0.02);
  const ridgeG = prism(0.028, 0.05, 0.30, 0.022, 0.04, { hang: false, sides: 4 });
  for (const [th, sh, ft] of [[rig.thighL, rig.shinL, rig.footL], [rig.thighR, rig.shinR, rig.footR]]) {
    new Part(th).add(thighG, dark)
      .add(slab(0.19, 0.20, 0.05, 0.02), steel, { y: -0.10, z: 0.09 })   // 넓적다리 판
      .finish();
    new Part(sh).add(shinG, dark)
      .add(greave, steel, { y: -0.19, z: 0.09 })
      .add(ridgeG, steel, { y: -0.19, z: 0.115 })                        // 능선
      .add(prism(0.17, 0.14, 0.07, 0.19, 0.16, { hang: false }), steel, { y: 0.0, z: 0.03 })  // 무릎덮개
      .finish();
    // 발끝을 뾰족하게 — 중세 사바통. 네모난 발은 실루엣을 뭉갠다
    new Part(ft).add(prism(0.16, 0.30, 0.10, 0.14, 0.24), steel, { y: -0.02, z: 0.05 })
      .add(prism(0.09, 0.10, 0.05, 0.04, 0.05), steel, { y: -0.06, z: 0.21, rx: -0.35 })
      .finish();
  }

  // ── 골반 · 골판 ── 세 겹의 판이 아래로 갈수록 넓어진다
  const hips = new Part(rig.hips)
    .add(prism(0.38, 0.26, 0.20, 0.34, 0.24, { hang: false }), dark, { y: -0.06 })
    .add(prism(0.40, 0.28, 0.08, 0.40, 0.28, { hang: false }), leather, { y: 0.06 })
    .add(slab(0.11, 0.09, 0.04, 0.015), gold, { y: 0.06, z: 0.15 });
  for (let i = 0; i < 3; i++) {
    const w = 0.40 + i * 0.035;
    hips.add(prism(w, 0.30 + i * 0.02, 0.075, w - 0.02, 0.28 + i * 0.02, { hang: false }),
      steel, { y: 0.015 - i * 0.062 });
  }
  hips.add(slab(0.15, 0.26, 0.03, 0.02), cloth, { y: -0.14, z: 0.15 });   // 앞치마(천)
  hips.finish();

  // ── 몸통 ── 가슴받이에 세로 홈 다섯. 「빛이 흐를 자리」를 만드는 것이다
  new Part(rig.spine)
    .add(prism(0.36, 0.24, 0.22, 0.44, 0.28, { hang: false }), steel, { y: 0.11 })
    .finish();

  const chest = new Part(rig.chest)
    .add(prism(0.48, 0.30, 0.30, 0.44, 0.28, { hang: false }), steel, { y: 0.06 })
    .add(slab(0.32, 0.26, 0.05, 0.03), steel, { y: 0.08, z: 0.15 });
  for (let i = -2; i <= 2; i++) {
    chest.add(prism(0.022, 0.03, 0.22, 0.018, 0.025, { hang: false, sides: 4 }),
      steel, { x: i * 0.058, y: 0.08, z: 0.175, rz: i * 0.06 });
  }
  chest.add(slab(0.10, 0.16, 0.03, 0.02), gold, { y: 0.10, z: 0.19 })     // 문장
    .add(arc(0.15, 0.022, Math.PI, 10), gold, { y: 0.19, z: 0.145, rx: Math.PI / 2 });  // 가슴 테
  // 망토 — 다섯 장으로 나눈다. 한 장짜리 판은 무엇을 해도 널빤지다
  for (let i = 0; i < 5; i++) {
    const t = (i - 2) / 2;
    chest.add(tatter(0.15, 0.56 - Math.abs(t) * 0.10, 0.02), cloth,
      { x: t * 0.155, y: -0.14, z: -0.17 - Math.abs(t) * 0.02, rx: 0.12 + Math.abs(t) * 0.05, rz: -t * 0.12 });
  }
  chest.finish();

  // ── 어깨 갑주 ── **테두리(arc)가 핵심이다.** 판 세 겹만으로는 계단이고,
  // 가장자리에 두툼한 테를 두르면 그때 「부어 만든 쇠」로 보인다
  for (const [g, s] of [[rig.armL, 1], [rig.armR, -1]]) {
    const p = new Part(g);
    p.add(prism(0.28, 0.28, 0.13, 0.32, 0.32, { hang: false }), steel, { y: 0.05, rz: s * 0.18 });
    p.add(arc(0.165, 0.028, Math.PI * 1.35, 14), steel, { y: -0.01, rx: Math.PI / 2, rz: s * 0.18 });
    p.add(prism(0.32, 0.32, 0.09, 0.27, 0.27, { hang: false }), steel, { y: -0.05, rz: s * 0.14 });
    p.add(arc(0.145, 0.022, Math.PI * 1.3, 12), gold, { y: -0.095, rx: Math.PI / 2, rz: s * 0.14 });
    p.add(spike(0.035, 0.13, 5), gold, { x: s * 0.15, y: 0.06, rz: s * 0.9 });
    p.add(prism(0.115, 0.125, 0.32, 0.15, 0.16), dark, { y: -0.06 });
    p.finish();
  }
  const foreG = prism(0.095, 0.105, 0.30, 0.125, 0.135);
  const bracer = slab(0.155, 0.21, 0.05, 0.02);
  for (const g of [rig.foreL, rig.foreR]) {
    new Part(g).add(foreG, dark)
      .add(bracer, steel, { y: -0.13, z: 0.07 })
      .add(arc(0.075, 0.016, Math.PI, 8), gold, { y: -0.235, z: 0.05, rx: Math.PI / 2 })
      .finish();
  }

  // ── 목 · 머리 · 투구 ──
  // 목가리개(gorget)를 두른다. 투구와 가슴 사이가 비어 있으면 머리가
  // **몸에 얹혀 있는 것**처럼 보인다 — 목은 원래 안 보이는 게 맞다
  new Part(rig.neck)
    .add(prism(0.11, 0.11, 0.10, 0.12, 0.12), dark)
    .add(arc(0.115, 0.030, Math.PI * 2, 14), steel, { y: -0.04, rx: Math.PI / 2 })
    .finish();
  const head = new Part(rig.head)
    .add(prism(0.22, 0.24, 0.25, 0.19, 0.21, { hang: false }), steel, { y: 0.06 })
    .add(prism(0.11, 0.21, 0.11, 0.06, 0.15, { hang: false }), steel, { y: -0.005, z: 0.14 });  // 얼굴가리개
  // 숨구멍 — 가로 틈 세 줄. 「투구다」를 알려 주는 가장 싼 단서
  for (let i = 0; i < 3; i++) {
    head.add(slab(0.055, 0.014, 0.03, 0.005), dark, { x: 0.035, y: -0.02 - i * 0.028, z: 0.20 });
    head.add(slab(0.055, 0.014, 0.03, 0.005), dark, { x: -0.035, y: -0.02 - i * 0.028, z: 0.20 });
  }
  head.add(slab(0.20, 0.045, 0.06, 0.012), dark, { y: 0.055, z: 0.125 })  // 눈 틈새
    .add(arc(0.115, 0.018, Math.PI, 10), gold, { y: 0.055, z: 0.10, rx: Math.PI / 2, ry: Math.PI / 2 });
  // 볏 — 판이 아니라 **부채꼴 활**. 옆에서 봐도 곡선이라 실루엣이 산다
  for (let i = 0; i < 6; i++) {
    head.add(tatter(0.055, 0.13 - Math.abs(i - 2.5) * 0.018, 0.018), cloth,
      { y: 0.20 + Math.sin(i / 5 * Math.PI) * 0.03, z: 0.09 - i * 0.045, rx: -0.25 - i * 0.06 });
  }
  head.add(spike(0.03, 0.11, 4), gold, { x: 0.105, y: 0.17, rz: -0.45 })
    .add(spike(0.03, 0.11, 4), gold, { x: -0.105, y: 0.17, rz: 0.45 })
    .finish();
  // 투구 안쪽의 빛 — 사람이 들어 있다는 유일한 단서
  eyes(rig.head, 0x9fd8ff, 0.045, 0.055, 0.155, 0.03, 0.016, 0.13);

  for (const g of [rig.handL, rig.handR]) {
    new Part(g).add(prism(0.11, 0.13, 0.12, 0.10, 0.12), steel)
      .add(prism(0.125, 0.145, 0.045, 0.12, 0.14, { hang: false }), steel, { y: -0.02 })
      .finish();
  }

  // ── 방패 ── 지금과 같은 자리(아래팔 받침). 테두리와 대갈못을 더한다
  const shieldMount = new THREE.Group();
  shieldMount.position.set(0, -0.16, 0.04);
  shieldMount.rotation.x = 1.45;
  rig.foreL.add(shieldMount);
  const sh = new Part(shieldMount)
    .add(slab(0.40, 0.42, 0.06, 0.03), leather, { y: -0.02, z: 0.12, ry: -0.34 })
    .add(prism(0.10, 0.06, 0.19, 0.37, 0.06), leather, { y: -0.23, z: 0.12, ry: -0.34 })
    .add(slab(0.39, 0.055, 0.035, 0.02), steel, { y: 0.03, z: 0.155, ry: -0.34 })
    .add(prism(0.12, 0.12, 0.055, 0.10, 0.10, { hang: false }), steel, { y: -0.04, z: 0.18, ry: -0.34 });
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2;
    sh.add(prism(0.028, 0.028, 0.02, 0.022, 0.022, { hang: false, sides: 6 }), gold,
      { x: Math.cos(a) * 0.13, y: -0.04 + Math.sin(a) * 0.13, z: 0.175, ry: -0.34 });
  }
  sh.finish();
  rig.shield = shieldMount;

  rig.weaponPal = { wrap: leather, dark, accent: gold, bladeMat };
  rig.bladeMat = bladeMat;
  rig.stance = 'knight';
  return done(rig, [steel, dark, gold, cloth, leather, bladeMat]);
}

// ═══════════════════════════ 해골 병사 ═══════════════════════════
//
// 지금 해골의 갈비뼈는 **가로로 놓인 납작한 막대 다섯**이다. 정면에서만
// 갈비처럼 보이고 옆에서 보면 널빤지 더미다. 갈비는 등뼈에서 나와 **앞으로
// 감겨 가슴 앞에서 만나는** 것이고, 그 곡선이 해골의 전부다.
//
// 그리고 두개골. 지금은 상자 두 개(머리 + 턱)라 어느 각도에서도 얼굴이
// 아니다. 이마 능선 · 광대 · 코 구멍 · 이빨을 넣으면 **삼각형 40 개**로
// 얼굴이 된다.
export function buildSkeletonHD(opt = {}) {
  const bone = surface(M(0xc9bfa4, { roughness: 0.68, metalness: 0.03 }), 'bone',
    { rim: 0x9fd0ff, rimAmt: 0.5, grime: 0.5, scale: 4.2 });
  const rag = surface(M(0x3d3846, { roughness: 1 }), 'cloth',
    { rim: 0x7f9ad0, rimAmt: 0.25, grime: 0.7, scale: 2.8 });
  const rust = surface(M(0x7a6449, { roughness: 0.62, metalness: 0.55 }), 'steel',
    { rim: 0xffb070, rimAmt: 0.35, grime: 0.5, scale: 3.2 });
  const bladeMat = surface(M(0x9aa2b0, { metalness: 0.75, roughness: 0.45 }), 'steel',
    { rim: 0xcfe4ff, rimAmt: 0.5, grime: 0.4, scale: 2.6 });

  const rig = skeleton({
    hipY: 0.84, legX: 0.11, thigh: 0.40, shin: 0.38,
    spineY: 0.03, chestY: 0.22, neckY: 0.20, headY: 0.08,
    armX: 0.21, armY: 0.10, upper: 0.30, fore: 0.28,
  });

  // ── 사지 ── 뼈는 **가운데가 가늘고 양 끝이 굵다.** 지금은 위만 굵어서
  // 대나무처럼 보인다. 관절구를 위아래 둘 다 넣으면 그것만으로 뼈가 된다
  const shaftG = prism(0.048, 0.048, 0.40, 0.048, 0.048, { sides: 6 });
  const knob = prism(0.088, 0.088, 0.075, 0.088, 0.088, { sides: 6, hang: false });
  for (const [th, sh, ft] of [[rig.thighL, rig.shinL, rig.footL], [rig.thighR, rig.shinR, rig.footR]]) {
    new Part(th).add(knob, bone, { y: -0.02 }).add(shaftG, bone)
      .add(knob, bone, { y: -0.38, sx: 0.9, sz: 0.9 }).finish();
    new Part(sh).add(knob, bone, { y: -0.02, sx: 0.85, sz: 0.85 })
      .add(shaftG, bone, { sy: 0.95 })
      // 종아리뼈 — 두 개다. 하나만 있으면 「막대기」고 두 개면 「정강이」다
      .add(prism(0.026, 0.026, 0.34, 0.026, 0.026, { sides: 5 }), bone, { x: 0.045, y: -0.02 })
      .add(knob, bone, { y: -0.35, sx: 0.8, sz: 0.8 }).finish();
    const f = new Part(ft).add(prism(0.055, 0.10, 0.05, 0.05, 0.09), bone, { z: 0.02 });
    for (let i = -1; i <= 1; i++) {                    // 발가락뼈
      f.add(prism(0.022, 0.13, 0.026, 0.018, 0.10, { hang: false }), bone,
        { x: i * 0.032, y: -0.045, z: 0.10, rz: i * 0.1 });
    }
    f.finish();
  }

  // ── 골반 ── 가운데가 뚫린 고리 + 좌우로 벌어진 날개
  new Part(rig.hips)
    .add(arc(0.10, 0.035, Math.PI * 2, 12), bone, { y: -0.05, rx: Math.PI / 2 })
    .add(slab(0.13, 0.16, 0.035, 0.02), bone, { x: 0.10, y: 0.01, rz: 0.5, ry: 0.35 })
    .add(slab(0.13, 0.16, 0.035, 0.02), bone, { x: -0.10, y: 0.01, rz: -0.5, ry: -0.35 })
    .add(tatter(0.30, 0.36, 0.02), rag, { y: -0.16, z: -0.05 })
    .add(tatter(0.16, 0.28, 0.02), rag, { x: 0.13, y: -0.14, z: -0.02, rz: 0.2 })
    .finish();

  // ── 척추 ── 마디 여섯 + 뒤로 튀어나온 돌기. 통짜 기둥이 아니다
  const spine = new Part(rig.spine);
  for (let i = 0; i < 5; i++) {
    spine.add(prism(0.055, 0.055, 0.032, 0.055, 0.055, { hang: false, sides: 6 }), bone, { y: 0.01 + i * 0.045 });
    spine.add(prism(0.02, 0.045, 0.028, 0.016, 0.03, { hang: false, sides: 4 }), bone,
      { y: 0.01 + i * 0.045, z: -0.045, rx: 0.4 });
  }
  spine.finish();

  // ── 갈비 ── **이 파일에서 제일 중요한 열 줄이다.**
  //
  // 활을 반쪽(π)만 쓰고, 등뼈 쪽에서 시작해 앞으로 감기게 돌린다.
  // 좌우가 각각 다섯 쌍. 아래로 갈수록 작아지고 앞으로 더 감긴다.
  const chest = new Part(rig.chest);
  chest.add(prism(0.05, 0.05, 0.28, 0.06, 0.06, { hang: false, sides: 6 }), bone, { y: 0.04, z: -0.055 });
  for (let i = 0; i < 5; i++) {
    const r = 0.155 - i * 0.012;
    const y = 0.20 - i * 0.062;
    const rib = arc(r, 0.016, Math.PI * 0.92, 10, 4);
    // rx=π/2 로 눕히고 ry 로 좌우를 가른다. 앞쪽 끝이 살짝 모이도록 rz 를 준다
    chest.add(rib, bone, { y, z: -0.05, rx: Math.PI / 2, ry: Math.PI / 2, rz: -0.12 - i * 0.03 });
    chest.add(rib, bone, { y, z: -0.05, rx: Math.PI / 2, ry: -Math.PI / 2, rz: 0.12 + i * 0.03 });
  }
  // 복장뼈 — 갈비 끝이 만나는 자리. 없으면 앞이 뻥 뚫려 보인다
  chest.add(prism(0.035, 0.03, 0.24, 0.05, 0.03, { hang: false, sides: 4 }), bone, { y: 0.06, z: 0.10 });
  // 쇄골 — 어깨가 몸통에 붙어 있다는 표시
  chest.add(prism(0.02, 0.02, 0.20, 0.022, 0.022, { hang: false, sides: 5 }), bone,
    { x: 0.10, y: 0.21, z: 0.04, rz: Math.PI / 2 - 0.25, ry: -0.3 });
  chest.add(prism(0.02, 0.02, 0.20, 0.022, 0.022, { hang: false, sides: 5 }), bone,
    { x: -0.10, y: 0.21, z: 0.04, rz: -(Math.PI / 2 - 0.25), ry: 0.3 });
  // 갑주 잔해는 **한쪽에만.** 좌우가 같으면 「제복」이고 한쪽만이면 「주워 입은 것」
  chest.add(slab(0.17, 0.10, 0.05, 0.02), rust, { x: 0.12, y: 0.21, rz: 0.25 });
  for (let i = 0; i < 4; i++) {
    const t = (i - 1.5) / 1.5;
    chest.add(tatter(0.13, 0.50 - Math.abs(t) * 0.14, 0.02), rag,
      { x: t * 0.13, y: 0.0, z: -0.13, rx: 0.14, rz: -t * 0.1 });
  }
  chest.finish();

  for (const [g, s] of [[rig.armL, 1], [rig.armR, -1]]) {
    new Part(g)
      .add(knob, bone, { y: 0.01, sx: 0.85, sz: 0.85 })
      .add(prism(0.042, 0.042, 0.30, 0.042, 0.042, { sides: 6 }), bone, { y: -0.02 })
      .add(knob, bone, { y: -0.27, sx: 0.75, sz: 0.75 })
      .add(slab(0.16, 0.09, 0.05, 0.02), rust, { y: 0.03, rz: s * 0.2 })
      .finish();
  }
  for (const g of [rig.foreL, rig.foreR]) {
    new Part(g)
      .add(prism(0.036, 0.036, 0.28, 0.036, 0.036, { sides: 6 }), bone)
      .add(prism(0.024, 0.024, 0.26, 0.024, 0.024, { sides: 5 }), bone, { x: 0.032, y: -0.01 })
      .add(knob, bone, { y: -0.26, sx: 0.65, sz: 0.65 })
      .finish();
  }
  // 손 — 손바닥 + 손가락 넷. 뭉툭한 덩이 하나면 「장갑」이지 「해골 손」이 아니다
  for (const g of [rig.handL, rig.handR]) {
    const p = new Part(g).add(prism(0.062, 0.028, 0.07, 0.055, 0.026), bone);
    for (let i = -1; i <= 2; i++) {
      p.add(prism(0.014, 0.014, 0.075, 0.012, 0.012), bone, { x: i * 0.019, y: -0.07, rz: i * 0.12 });
    }
    p.add(prism(0.015, 0.015, 0.05, 0.013, 0.013), bone, { x: -0.035, y: -0.035, rz: -0.9 });  // 엄지
    p.finish();
  }

  // ── 두개골 ── 이마 능선 · 광대 · 코 구멍 · 아래턱 · 이빨
  new Part(rig.neck)
    .add(prism(0.038, 0.038, 0.085, 0.045, 0.045, { sides: 6 }), bone)
    .finish();
  // 처음엔 위쪽을 넓은 상자로 뒀더니 정면에서 **양동이**처럼 보였다.
  // 사람 머리는 위로 갈수록 좁아지고 뒤통수가 뒤로 튀어나온다 — 그 둘만
  // 지키면 상자 세 개로도 두개골이 된다
  const skull = new Part(rig.head)
    .add(prism(0.185, 0.205, 0.10, 0.145, 0.165, { hang: false }), bone, { y: 0.135 })  // 정수리
    .add(prism(0.195, 0.215, 0.09, 0.185, 0.205, { hang: false }), bone, { y: 0.06 })   // 머리 위쪽
    .add(prism(0.15, 0.10, 0.13, 0.13, 0.09, { hang: false }), bone, { y: 0.09, z: -0.10 })  // 뒤통수
    .add(prism(0.20, 0.22, 0.07, 0.19, 0.21, { hang: false }), bone, { y: 0.02 })      // 관자놀이
    .add(arc(0.085, 0.022, Math.PI, 10), bone, { y: 0.085, z: 0.105, rx: Math.PI / 2, ry: Math.PI / 2 })  // 눈두덩
    .add(prism(0.155, 0.09, 0.07, 0.13, 0.08, { hang: false }), bone, { y: -0.005, z: 0.055 })   // 광대
    .add(prism(0.028, 0.03, 0.05, 0.012, 0.02, { hang: false, sides: 4 }), rag, { y: 0.01, z: 0.12 })  // 코 구멍
    // 눈구멍은 **깊어야** 한다. 검은 판을 얕게 붙이면 그냥 검은 점이다
    .add(prism(0.062, 0.05, 0.055, 0.055, 0.045, { hang: false }), rag, { x: 0.052, y: 0.055, z: 0.085 })
    .add(prism(0.062, 0.05, 0.055, 0.055, 0.045, { hang: false }), rag, { x: -0.052, y: 0.055, z: 0.085 });
  // 아래턱 + 이빨
  skull.add(prism(0.15, 0.11, 0.055, 0.145, 0.13, { hang: false }), bone, { y: -0.055, z: 0.045 });
  for (let i = -2; i <= 2; i++) {
    skull.add(prism(0.016, 0.014, 0.028, 0.013, 0.012, { hang: false, sides: 4 }), bone,
      { x: i * 0.024, y: -0.026, z: 0.098 - Math.abs(i) * 0.006 });
    skull.add(prism(0.016, 0.014, 0.026, 0.013, 0.012, { hang: false, sides: 4 }), bone,
      { x: i * 0.024, y: -0.052, z: 0.098 - Math.abs(i) * 0.006 });
  }
  // 투구 잔해 — 한쪽 관자놀이에만 녹슨 조각
  skull.add(slab(0.09, 0.13, 0.03, 0.015), rust, { x: 0.095, y: 0.07, z: 0.01, rz: 0.2, ry: -0.4 });
  skull.finish();
  // 눈구멍 **안쪽 깊이**에 둔다. 앞으로 빼면 두 개의 빨간 판이 되어
  // 두개골이 아니라 **로봇 바이저**로 읽힌다 — 한 번 그렇게 나왔다
  eyes(rig.head, 0xff5a2a, 0.052, 0.055, 0.072, 0.026, 0.018, 0.12);

  rig.weaponPal = { wrap: rag, dark: rag, accent: rust, bladeMat };
  rig.bladeMat = bladeMat;
  rig.stance = 'skeleton';
  rig.hdWeapon = opt.weapon || '검';
  rig.hdShield = !!opt.shield;
  return done(rig, [bone, rag, rust, bladeMat]);
}

// ═══════════════════════════ 구울 ═══════════════════════════
//
// 지금 구울은 **좌우가 완벽하게 같다.** 그게 「썩은 것」이 안 되는 제일 큰
// 이유다. 시체는 고르게 썩지 않는다 — 한쪽이 더 부었고, 갈비가 한쪽만 터져
// 나왔고, 한쪽 팔이 더 길다.
//
// 그리고 살. 초록 하나로 칠하면 「초록 사람」이고, 큰 얼룩 + 보랏빛 멍 +
// 얼룩진 젖은 광이 있어야 「썩은 살」이다. 그건 전부 surface('flesh') 가 한다.
export function buildGhoulHD() {
  const skin = surface(M(0x63704a, { roughness: 0.95, metalness: 0 }), 'flesh',
    { rim: 0xa8ff8a, rimAmt: 0.4, grime: 0.4, scale: 5.5 });
  const belly = surface(M(0x8d9668, { roughness: 0.96, metalness: 0 }), 'flesh',
    { rim: 0xc0ff9a, rimAmt: 0.35, grime: 0.4, scale: 4.5 });
  const claw = surface(M(0xd2c6a6, { roughness: 0.45, metalness: 0.18 }), 'bone',
    { rim: 0xfff0c0, rimAmt: 0.5, scale: 5.0 });
  const gore = surface(M(0x6b2028, { roughness: 0.35, metalness: 0.05 }), 'flesh',
    { rim: 0xff6060, rimAmt: 0.45, scale: 7.0 });

  const rig = skeleton({
    hipY: 0.57, legX: 0.13, thigh: 0.26, shin: 0.24,
    spineY: 0.02, chestY: 0.16, neckY: 0.12, headY: 0.02,
    armX: 0.22, armY: 0.06, upper: 0.30, fore: 0.30,
  });
  rig.spine.rotation.x = 0.40;
  rig.chest.rotation.x = 0.20;
  rig.neck.rotation.x = -0.55;
  rig.armL.rotation.x = 0.34; rig.armR.rotation.x = 0.28;
  // 어깨 하나를 낮춘다 — 이 한 줄이 「기울어진 몸」을 만든다
  rig.chest.rotation.z = 0.07;

  const thighG = prism(0.135, 0.155, 0.26, 0.18, 0.20);
  const shinG = prism(0.105, 0.115, 0.24, 0.13, 0.15);
  for (const [th, sh, ft] of [[rig.thighL, rig.shinL, rig.footL], [rig.thighR, rig.shinR, rig.footR]]) {
    new Part(th).add(thighG, skin).finish();
    new Part(sh).add(shinG, skin)
      .add(prism(0.045, 0.05, 0.16, 0.035, 0.04, { sides: 5 }), skin, { z: -0.06, rx: -0.2 })  // 아킬레스
      .finish();
    const f = new Part(ft).add(prism(0.14, 0.22, 0.07, 0.12, 0.18), skin, { z: 0.04 });
    for (let i = -1; i <= 1; i++) f.add(spike(0.022, 0.10, 4), claw, { x: i * 0.045, y: -0.05, z: 0.14, rx: 1.5 });
    f.finish();
  }

  new Part(rig.hips).add(prism(0.30, 0.24, 0.16, 0.28, 0.24, { hang: false }), skin, { y: -0.03 }).finish();
  new Part(rig.spine)
    .add(prism(0.30, 0.28, 0.18, 0.34, 0.32, { hang: false }), skin, { y: 0.08 })
    // 처진 배 — 아래로 늘어진다. 굶은 시체가 아니라 **불은 시체**다
    .add(prism(0.26, 0.22, 0.15, 0.22, 0.20), belly, { y: 0.09, z: 0.11 })
    .finish();

  const ch = new Part(rig.chest)
    .add(prism(0.38, 0.36, 0.26, 0.30, 0.28, { hang: false }), skin, { y: 0.04 })
    .add(prism(0.27, 0.17, 0.21, 0.23, 0.15, { hang: false }), belly, { y: 0.02, z: 0.14 });
  // 터져 나온 갈비 — **한쪽만.** 살(구멍)을 먼저 파고 그 위에 뼈를 얹는다
  ch.add(prism(0.16, 0.10, 0.14, 0.13, 0.08, { hang: false }), gore, { x: 0.11, y: 0.06, z: 0.15 });
  for (let i = 0; i < 3; i++) {
    ch.add(arc(0.075 - i * 0.008, 0.011, Math.PI * 0.55, 8, 4), claw,
      { x: 0.11, y: 0.12 - i * 0.05, z: 0.15, rx: Math.PI / 2, ry: -Math.PI / 2 + 0.3, rz: 0.2 });
  }
  // 등뼈 돌기 — 다섯으로 늘리고 곡선으로. 굽은 등의 실루엣이 여기서 나온다
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    ch.add(spike(0.038 - t * 0.014, 0.14 - t * 0.05, 4), claw,
      { x: (i % 2 ? 0.012 : -0.012), y: 0.15 - i * 0.058, z: -0.14 - Math.sin(t * 3) * 0.01, rx: -0.55 + t * 0.25 });
  }
  ch.finish();

  new Part(rig.neck).add(prism(0.13, 0.13, 0.12, 0.14, 0.14), skin).finish();
  // ── 머리 ── 길쭉한 두개골 · 큰 턱관절 · 이빨 여섯 · **눈 크기가 다르다**
  const head = new Part(rig.head)
    .add(prism(0.21, 0.26, 0.19, 0.18, 0.28, { hang: false }), skin, { y: 0.03, z: 0.02 })
    .add(prism(0.155, 0.17, 0.11, 0.115, 0.13, { hang: false }), belly, { y: -0.025, z: 0.17 })   // 주둥이
    .add(prism(0.09, 0.08, 0.07, 0.07, 0.07, { hang: false }), skin, { x: 0.10, y: 0.0, z: 0.06 })  // 턱관절
    .add(prism(0.09, 0.08, 0.07, 0.07, 0.07, { hang: false }), skin, { x: -0.10, y: 0.0, z: 0.06 });
  for (let i = 0; i < 6; i++) {
    const x = -0.06 + i * 0.024;
    head.add(spike(0.016 + (i % 2) * 0.006, 0.05 + (i % 2) * 0.03, 4), claw,
      { x, y: -0.055, z: 0.20, rx: Math.PI });
    head.add(spike(0.014, 0.04, 4), claw, { x, y: -0.085, z: 0.19 });
  }
  head.add(spike(0.032, 0.15, 4), claw, { x: 0.095, y: 0.11, z: -0.02, rz: -0.4, rx: -0.2 })   // 귀 — 길이가 다르다
    .add(spike(0.028, 0.10, 4), claw, { x: -0.095, y: 0.10, z: -0.02, rz: 0.55, rx: -0.1 })
    .finish();
  const [eL] = eyes(rig.head, 0xffd23a, 0.062, 0.06, 0.135, 0.038, 0.03, 0.16);
  eL.scale.setScalar(1.45);          // 한쪽 눈만 크다 — 대칭을 깨는 마지막 한 수

  // ── 팔 ── **오른팔이 굵고 길다.** 왼팔은 말랐다
  for (const [g, k] of [[rig.armL, 0.82], [rig.armR, 1.18]]) {
    new Part(g).add(prism(0.105 * k, 0.115 * k, 0.30, 0.14 * k, 0.15 * k), skin).finish();
  }
  for (const [g, k] of [[rig.foreL, 0.82], [rig.foreR, 1.16]]) {
    new Part(g).add(prism(0.085 * k, 0.095 * k, 0.30, 0.115 * k, 0.125 * k), skin)
      .add(prism(0.03, 0.03, 0.10, 0.02, 0.02, { sides: 5 }), claw, { x: 0.05 * k, y: -0.02, rz: 0.2 })  // 튀어나온 뼈
      .finish();
  }
  for (const [g, k] of [[rig.handL, 0.85], [rig.handR, 1.2]]) {
    const p = new Part(g).add(prism(0.10 * k, 0.11 * k, 0.09, 0.10 * k, 0.11 * k), skin);
    for (let i = -1; i <= 1; i++) {
      // 손톱을 **굽힌다.** 곧은 원뿔은 못이고, 두 마디로 꺾으면 발톱이다
      p.add(spike(0.026 * k, 0.13, 4), claw, { x: i * 0.05 * k, y: -0.12, z: 0.02, rx: Math.PI + 0.15 });
      p.add(spike(0.020 * k, 0.11, 4), claw, { x: i * 0.05 * k, y: -0.21, z: 0.055, rx: Math.PI + 0.75 });
    }
    p.finish();
  }

  rig.weapon = rig.handR;
  rig.blade = rig.handR;
  rig.bladeMat = claw;
  rig.stance = 'ghoul';
  return done(rig, [skin, belly, claw, gore]);
}

// ═══════════════════════════ 망령 궁수 ═══════════════════════════
//
// 지금 유령은 **아래가 가늘어지기만 한다.** 원뿔이지 유령이 아니다.
// 유령은 「아래가 없다」가 아니라 **「아래가 사라지는 중이다」**여야 한다 —
// 그건 모양이 아니라 셰이더가 하는 일이다(surface.js 의 dissolve).
//
// 활도 바꾼다. 지금은 굽은 막대 둘이라 정면에서 막대기로 보인다.
// 리커브(끝이 반대로 휘는)로 만들면 어느 각도에서도 활이다.
export function buildArcherHD() {
  const robe = surface(M(0x33445e, { roughness: 1, metalness: 0 }), 'cloth',
    { rim: 0x9fd8ff, rimAmt: 0.55, grime: 0, scale: 2.6 });
  const inner = surface(M(0x141c2e, { roughness: 1, metalness: 0 }), 'cloth',
    { rim: 0x6fa8ff, rimAmt: 0.3, scale: 2.6 });
  const wood = surface(M(0x53412c, { roughness: 0.85 }), 'wood',
    { rim: 0xc0d8ff, rimAmt: 0.35, scale: 3.0 });
  const boneM = surface(M(0xb9b09a, { roughness: 0.6 }), 'bone',
    { rim: 0xcfe8ff, rimAmt: 0.5, scale: 4.2 });

  const rig = skeleton({
    hipY: 0.98, legX: 0, thigh: 0, shin: 0,
    spineY: 0.06, chestY: 0.26, neckY: 0.18, headY: 0.06,
    armX: 0.24, armY: 0.10, upper: 0.26, fore: 0.24,
  });
  rig.hips.remove(rig.thighL, rig.thighR);
  rig.thighL = rig.thighR = rig.shinL = rig.shinR = rig.footL = rig.footR = null;
  rig.legL = rig.legR = null;
  rig.float = true;

  // ── 옷자락 ── 통짜 원뿔 대신 **찢어진 자락 일곱 장.** 길이가 제각각이라
  // 아래 경계가 들쭉날쭉하고, 거기에 흩어짐이 걸리면 연기처럼 풀린다
  // 자락은 **몸통보다 밖으로** 나와야 한다. 처음에 반지름 0.11 로 안쪽에
  // 둘렀더니 위쪽 원뿔의 실루엣에 통째로 먹혀서 **여전히 원뿔 하나**였다.
  // 위쪽을 좁히고(0.30) 자락 고리를 넓혀서(0.19) 종 모양이 되게 한다
  const hips = new Part(rig.hips)
    .add(prism(0.22, 0.21, 0.30, 0.34, 0.31), robe, { y: 0.02 });
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2;
    const len = 0.38 + ((i * 4) % 5) * 0.11;
    // 벌림을 0.30 → 0.15 로 줄였다. 크게 벌리니 **얼음 결정**처럼 뻣뻣해서
    // 천으로 안 보였다. 천은 몸을 따라 흐르고 아래에서만 갈라진다
    hips.add(tatter(0.15, len, 0.022), inner,
      { x: Math.sin(a) * 0.17, z: Math.cos(a) * 0.17, y: -0.20,
        rx: Math.cos(a) * 0.15, rz: -Math.sin(a) * 0.15, ry: -a });
  }
  hips.finish();
  new Part(rig.spine).add(prism(0.30, 0.28, 0.26, 0.34, 0.30, { hang: false }), robe, { y: 0.1 }).finish();
  const chest = new Part(rig.chest)
    .add(prism(0.36, 0.30, 0.28, 0.30, 0.26, { hang: false }), robe, { y: 0.04 })
    // 어깨 망토 — 유령의 어깨선을 만들어 준다. 없으면 그냥 자루다
    .add(prism(0.44, 0.38, 0.14, 0.30, 0.26, { hang: false }), inner, { y: 0.12 });
  for (let i = 0; i < 5; i++) {
    const t = (i - 2) / 2;
    chest.add(tatter(0.14, 0.50 - Math.abs(t) * 0.12, 0.02), inner,
      { x: t * 0.13, y: -0.06, z: -0.15, rx: 0.1, rz: -t * 0.12 });
  }
  chest.finish();

  new Part(rig.neck).add(prism(0.09, 0.09, 0.08, 0.10, 0.10), inner).finish();
  // ── 두건 ── 깊게 판다. **얼굴 자리는 진짜로 비어 있어야** 무섭다
  new Part(rig.head)
    .add(prism(0.25, 0.25, 0.28, 0.03, 0.03, { hang: false, sides: 6 }), robe, { y: 0.05 })
    .add(prism(0.20, 0.13, 0.20, 0.18, 0.12, { hang: false }), inner, { y: 0.02, z: 0.07 })
    .add(arc(0.115, 0.022, Math.PI * 1.1, 12), robe, { y: 0.05, z: 0.10, rx: Math.PI / 2, ry: Math.PI / 2 })
    .finish();
  eyes(rig.head, 0x9fd8ff, 0.048, 0.045, 0.135, 0.032, 0.022, 0.19);

  for (const [g, s] of [[rig.armL, 1], [rig.armR, -1]]) {
    new Part(g).add(prism(0.15, 0.15, 0.26, 0.11, 0.11), robe, { rz: s * 0.1 }).finish();
  }
  for (const g of [rig.foreL, rig.foreR]) {
    new Part(g).add(prism(0.11, 0.11, 0.24, 0.085, 0.085), robe).finish();
  }
  // 손 — 소매에서 **뼈만** 나온다. 유령의 손은 옷의 일부가 아니다
  for (const g of [rig.handL, rig.handR]) {
    const p = new Part(g).add(prism(0.05, 0.028, 0.06, 0.045, 0.026), boneM);
    for (let i = -1; i <= 1; i++) {
      p.add(prism(0.012, 0.012, 0.075, 0.009, 0.009), boneM, { x: i * 0.018, y: -0.06, rz: i * 0.15 });
    }
    p.finish();
  }

  // ── 활 ── 리커브. 팔 넷(안쪽 둘 + 끝 둘)이 서로 반대로 휜다
  const bow = new THREE.Group();
  bow.rotation.x = 1.16;
  const bp = new Part(bow)
    .add(prism(0.05, 0.075, 0.15, 0.045, 0.065, { hang: false }), wood);         // 손잡이
  for (const s of [1, -1]) {
    bp.add(prism(0.036, 0.055, 0.26, 0.026, 0.04, { hang: false }), wood,
      { y: s * 0.20, rz: -s * 0.30, rx: -s * 0.10 });
    bp.add(prism(0.024, 0.038, 0.16, 0.014, 0.022, { hang: false }), wood,
      { y: s * 0.40, z: -0.045, rz: s * 0.34, rx: s * 0.16 });                    // 끝이 반대로
    bp.add(prism(0.028, 0.028, 0.035, 0.024, 0.024, { hang: false, sides: 6 }), boneM, { y: s * 0.47, z: -0.075 });
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

  // ── 흩어짐 ── **몸 재질 전부에 건다.** 옷자락에만 걸면 경계가 생겨서
  // 「반쯤 지워진 그림」이 된다. 위쪽은 어차피 문턱을 안 넘으니 안 사라진다
  for (const m of [robe, inner]) dissolve(m, 0.62, -0.02);

  return done(rig, [robe, inner, wood, boneM, stringMat]);
}

// ═══════════════════════════ 무덤 골렘 ═══════════════════════════
//
// 지금 골렘은 **매끈한 팔각기둥 더미**다. 돌은 그렇게 안 생겼다 —
// 깨진 면과 모서리가 있고, 균열이 있고, 위쪽에 이끼가 낀다.
//
// 그리고 심장. 지금은 가슴 구멍 안의 공 하나라 정면에서만 보인다.
// 균열을 몸 전체에 내고 **거기서 빛이 새어 나오면** 어느 각도에서도
// 「안에 뭔가 들어 있다」가 읽힌다.
export function buildGolemHD() {
  // 돌 셰이더가 균열·알갱이로 깎아 내리는 만큼 **기본색을 올려 둬야** 한다.
  // 게임 값(0x6b6a72)을 그대로 넣었더니 깎이고 깎여 **석탄 더미**가 됐다
  const stone = surface(M(0x8a8894, { roughness: 0.98, metalness: 0.02 }), 'stone',
    { rim: 0xff9a4a, rimAmt: 0.35, grime: 0.6, scale: 2.4 });
  const dark = surface(M(0x56555f, { roughness: 0.99, metalness: 0 }), 'stone',
    { rim: 0xff8040, rimAmt: 0.25, grime: 0.5, scale: 2.8 });
  crackGlow(stone, 0xff7a2a, 0.9);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffb050 });
  const runeMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a });

  const rig = skeleton({
    hipY: 0.90, legX: 0.24, thigh: 0.40, shin: 0.36,
    spineY: 0.06, chestY: 0.30, neckY: 0.26, headY: 0.02,
    armX: 0.52, armY: 0.14, upper: 0.44, fore: 0.40,
  });

  // 돌덩이를 겹쳐 쌓는다 — 기둥 하나보다 **깨진 것**으로 보인다
  for (const [th, sh, ft] of [[rig.thighL, rig.shinL, rig.footL], [rig.thighR, rig.shinR, rig.footR]]) {
    new Part(th)
      .add(chunk(0.20, 0.26), stone, { y: -0.13, sy: 1.5 })
      .add(chunk(0.19, 0.3), dark, { y: -0.03, sy: 0.7 })
      .finish();
    new Part(sh)
      .add(chunk(0.185, 0.28), stone, { y: -0.16, sy: 1.35 })
      .finish();
    new Part(ft)
      .add(chunk(0.20, 0.22), stone, { y: -0.04, z: 0.05, sy: 0.6, sz: 1.25 })
      .finish();
  }

  new Part(rig.hips).add(chunk(0.30, 0.24), stone, { y: -0.05, sy: 0.72, sz: 0.78 }).finish();
  new Part(rig.spine).add(chunk(0.32, 0.26), stone, { y: 0.12, sy: 0.62, sz: 0.72 }).finish();

  const ch = new Part(rig.chest)
    .add(chunk(0.44, 0.22), stone, { y: 0.15, sy: 0.62, sz: 0.66 })
    // 왼쪽 어깨가 깨져 나갔다 — 어둠으로 파고, 그 자리에서 심장이 더 밝게 샌다
    .add(chunk(0.20, 0.35), dark, { x: 0.30, y: 0.28, sy: 0.75 })
    .add(prism(0.30, 0.14, 0.32, 0.20, 0.10, { hang: false }), dark, { y: 0.16, z: 0.24 });
  ch.finish();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), coreMat);
  core.position.set(0, 0.17, 0.28);
  rig.chest.add(core);
  const halo = glowDisc(0xff9040, 0.72);
  halo.position.set(0, 0.17, 0.33);
  rig.chest.add(halo);
  rig.core = core;
  // 룬 — 가슴에 새긴 세 줄. 발광 재질이라 어둠 속에서 먼저 읽힌다
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(slab(0.18 - i * 0.03, 0.022, 0.02, 0.006), runeMat);
    r.position.set(0, 0.38 - i * 0.05, 0.30);
    rig.chest.add(r);
  }

  // ── 머리 ── 부서진 석상 얼굴. 왕관 조각이 한쪽만 남았다.
  // 「어깨가 머리보다 높다」는 골렘의 규칙이지만, 어깨 돌기까지 더하니
  // 머리가 **아예 안 보였다.** 조금 올리고 키워서 실루엣에 남긴다
  new Part(rig.head)
    .add(chunk(0.23, 0.2), stone, { y: 0.16, sy: 0.82 })
    .add(prism(0.26, 0.12, 0.10, 0.24, 0.10, { hang: false }), dark, { y: 0.08, z: 0.17 })
    .add(prism(0.07, 0.11, 0.13, 0.05, 0.09, { hang: false }), stone, { y: 0.0, z: 0.16 })   // 코
    .add(spike(0.05, 0.17, 4), stone, { x: 0.14, y: 0.17, rz: -0.5 })
    .add(spike(0.038, 0.11, 4), stone, { x: -0.14, y: 0.15, rz: 0.5 })                        // 짧다 = 부러졌다
    .add(slab(0.09, 0.07, 0.05, 0.015), dark, { x: -0.15, y: 0.20, rz: 0.4 })
    .finish();
  eyes(rig.head, 0xffb050, 0.082, 0.085, 0.19, 0.05, 0.038, 0.24);

  for (const [g, s] of [[rig.armL, 1], [rig.armR, -1]]) {
    const p = new Part(g)
      .add(chunk(0.24, 0.22), stone, { y: 0.02, sy: 0.72 })
      .add(chunk(0.185, 0.26), stone, { y: -0.26, sy: 1.3 });
    // 어깨에서 삐죽 나온 돌 — 골렘의 실루엣은 어깨가 만든다
    for (let i = 0; i < 3; i++) {
      p.add(spike(0.045, 0.15 - i * 0.03, 4), stone,
        { x: s * (0.14 + i * 0.02), y: 0.10 - i * 0.09, rz: s * (0.8 + i * 0.2) });
    }
    p.finish();
  }
  for (const g of [rig.foreL, rig.foreR]) {
    new Part(g).add(chunk(0.185, 0.24), stone, { y: -0.18, sy: 1.25 }).finish();
  }
  for (const g of [rig.handL, rig.handR]) {
    new Part(g)
      .add(chunk(0.24, 0.28), stone, { y: -0.14, sy: 0.9 })
      .add(chunk(0.09, 0.35), dark, { y: -0.26, z: 0.10 })
      .finish();
  }

  rig.weapon = rig.handR;
  rig.blade = rig.handR;
  rig.bladeMat = stone;
  rig.stance = 'golem';
  return done(rig, [stone, dark]);
}

export const BUILDERS_HD = {
  knight: buildKnightHD, skeleton: buildSkeletonHD,
  ghoul: buildGhoulHD, archer: buildArcherHD, golem: buildGolemHD,
};
