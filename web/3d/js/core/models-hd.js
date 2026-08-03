// 몸 — **고품질 제안본 2차.** 지금 게임의 core/models.js 를 대체하려는 후보다.
//
// ── 1차에서 무엇이 남고 무엇이 바뀌었나 ──────────────────────
// 1차 시제품에서 사장님이 고른 것은 **골렘 하나**였다. 그래서 이번에는
// 「골렘이 왜 혼자 좋아 보였나」를 뜯어서 그것만 나머지에 적용한다.
//
// 골렘이 다른 넷과 달랐던 점은 정확히 둘이다.
//
//   ① 몸이 **덩어리(chunk)** 로 되어 있다.
//      다른 넷은 각기둥(prism)을 쌓아 만들었다. 각기둥은 아무리 모따기를
//      해도 **위아래 굵기가 다른 원통**이고, 그래서 어느 각도에서 봐도
//      「막대기를 이어 붙인 것」으로 읽힌다. 골렘만 정이십면체를 꼭짓점
//      단위로 찌그러뜨린 덩어리를 겹쳐 놨고, 그러면 실루엣에 **예측 안 되는
//      굴곡**이 생긴다. 이게 「만든 것」과 「깎인 것」을 가른다.
//   ② **안에서 빛이 샌다.**
//      가슴의 심장과 균열의 발광. 이게 있으면 어두운 화면에서 형태보다
//      먼저 읽히고, 「속이 비지 않았다」는 인상이 생긴다. 다른 넷은
//      눈 두 개가 전부라 정지 화면에서 다 비슷해 보였다.
//
// 그래서 이번 판의 규칙은 한 줄이다:
// **모든 살과 뼈와 갑옷을 덩어리로 짓고, 하나씩 속에 불을 넣는다.**
// (곡선 갈비뼈·비대칭·물질 셰이더는 1차에서 살아남았으므로 그대로 간다.)
//
// ── 그리고 플레이어는 사람이다 ───────────────────────────────
// 1차의 기사는 얼굴이 없는 통조림이었다. 투구를 닫아 두면 만들기는 쉽지만
// **감정이입할 곳이 없다.** 열린 투구로 바꾸고 안에 얼굴을 넣는다 —
// 이마·광대·코·턱·수염·머리카락. 몬스터가 다섯인데 그중 하나가 사람이면
// 그 하나가 「나」다.
//
// 골격(rig.js)은 그대로 18 관절이다. 동작 코드는 한 줄도 안 바뀌고,
// 마음에 들면 **파일 하나만 갈아 끼우면 된다.**

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { prism, slab, spike, Part, skeleton } from './rig.js';
import { surface, dissolve, crackGlow, glowDisc } from './surface.js';

// ───────────────────────── 기본 도형 ─────────────────────────

/**
 * **덩어리 — 이 파일의 기본 단위다.** (골렘에서 가져온 것)
 *
 * 정이십면체를 꼭짓점 단위로 밀어 찌그러뜨린다. 각기둥과 달리 어느 축으로도
 * 대칭이 아니라, 겹쳐 쌓으면 실루엣이 「깎인 돌」·「부은 살」·「두들겨 편 쇠」가 된다.
 *
 * @param jag  찌그러짐. 0.04 = 손으로 두들긴 갑옷 · 0.3 = 부서진 바위
 * @param detail 0 = 20 면 · 1 = 80 면 · 2 = 320 면 (얼굴처럼 둥근 것만 2)
 * @param seed **없으면 안 된다.** 잡음이 좌표에서만 나오므로 반지름이 같은
 *             덩어리는 **모양까지 똑같아진다** — 팔다리 여섯 개가 복사본이
 *             되어서 「찌그러뜨린 보람」이 통째로 사라진다. 1차에서 실제로 그랬다.
 *
 * IcosahedronGeometry 는 인덱스가 없다. 그대로 밀면 면이 찢어지므로 먼저 합친다.
 */
function chunk(r, jag = 0.3, detail = 1, seed = 0) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(r, detail));
  const p = g.attributes.position;
  const seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    let k = seen.get(key);
    if (k === undefined) {
      // 결정적 잡음 — Math.random 을 쓰면 같은 몬스터가 매번 다른 모양이 된다.
      // 그건 다양성이 아니라 **버그처럼 보이는 흔들림**이다
      const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.37) * 43758.5453;
      k = 1 + (s - Math.floor(s) - 0.5) * jag * 2;
      seen.set(key, k);
    }
    p.setXYZ(i, x * k, y * k * 0.94, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** 사지 하나 — 덩어리를 세로로 늘여 관절에 매단다. 원점이 관절에 오게 */
function limb(len, r, opt = {}) {
  const g = chunk(r, opt.jag ?? 0.14, opt.detail ?? 1, opt.seed ?? 0);
  g.scale(opt.taper ?? 1, len / (2 * r), 1);
  g.translate(0, -len / 2, 0);
  return g;
}

/**
 * 활 — 갈비뼈·투구 테두리·리커브 활. **1차에서 유일하게 확실히 산 도형이다.**
 * 토러스는 XY 평면에 눕고 +X 에서 시작해 반시계로 돈다.
 */
function arc(radius, tube, span = Math.PI, seg = 12, sides = 5) {
  return new THREE.TorusGeometry(radius, tube, sides, seg, span);
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

/**
 * **속의 불** — 골렘의 심장에서 가져온 것. 이제 넷 다 하나씩 가진다.
 *
 * 발광 덩어리 하나 + 뒤에 가산 원반. 원반이 없으면 「밝은 점」으로 끝나고,
 * 있으면 「빛난다」가 된다. 어두운 던전에서는 이게 형태보다 먼저 읽힌다.
 */
function core(parent, color, r, x, y, z, halo = r * 5) {
  const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0),
    new THREE.MeshBasicMaterial({ color }));
  c.position.set(x, y, z);
  parent.add(c);
  const h = glowDisc(color, halo);
  h.position.set(x, y, z + r * 0.6);
  parent.add(h);
  return c;
}

/** 발광하는 눈 — 몬스터용 */
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

/**
 * 사람 눈 — **발광하면 안 된다.** 사람 눈은 빛나지 않고, 빛나는 순간
 * 사람이 아니라 무언가에 씐 것이 된다.
 *
 * 이 크기(화면에서 눈 하나가 서너 픽셀)에서 눈으로 읽히게 하는 것은
 * 홍채의 색이 아니라 **어두운 구멍 + 그 안의 밝은 점 하나**다.
 * 눈꺼풀 그늘을 위에 얹어야 「뜨고 있다」로 보인다 — 없으면 놀란 표정이 된다.
 */
function humanEyes(head, dark, x, y, z) {
  const socket = chunk(0.026, 0.15, 1, 31);
  const p = new Part(head)
    .mirror(socket, dark, { x, y, z: z - 0.004, sz: 0.5 })
    .mirror(slab(0.055, 0.016, 0.02, 0.005), dark, { x, y: y + 0.026, z, rz: -0.18 });  // 눈꺼풀 그늘
  p.finish();
  const glint = new THREE.MeshBasicMaterial({ color: 0xcfd6e0 });
  const gg = prism(0.009, 0.008, 0.009, 0.009, 0.008, { hang: false, sides: 4 });
  for (const sx of [x - 0.004, -x - 0.004]) {
    const m = new THREE.Mesh(gg, glint);
    m.position.set(sx, y + 0.002, z + 0.012);
    head.add(m);
  }
}

// ═══════════════════════════ 전사 (사람) ═══════════════════════════
//
// 실루엣 규칙은 그대로다: **어깨가 제일 넓고, 허리가 잘록하고, 위가 뾰족하다.**
// 여기에 하나가 더 붙는다 — **얼굴이 보인다.**
//
// 투구를 열면 잃는 것이 있다. 닫힌 투구는 실루엣이 단단하고 만들기 쉽다.
// 그래도 여는 이유는, 몬스터 넷이 전부 얼굴 없는 것들이라 **그 대비가
// 곧 주인공**이기 때문이다. 얼굴이 있는 쪽이 하나뿐이면 그쪽이 「나」다.
export function buildKnightHD() {
  const skin = surface(M(0xc08e6a, { roughness: 0.78, metalness: 0 }), 'skin',
    { rim: 0xffcf9a, rimAmt: 0.30, scale: 6.5 });
  const hair = surface(M(0x2e2119, { roughness: 0.92, metalness: 0 }), 'hair',
    { rim: 0xc9a06a, rimAmt: 0.45, scale: 5.0 });
  const steel = surface(M(0x8e97ad, { metalness: 0.88, roughness: 0.3 }), 'steel',
    { rim: 0x7fa8ff, rimAmt: 0.5, grime: 0.55, scale: 3.4 });
  const dark = surface(M(0x2e2c39, { metalness: 0.45, roughness: 0.6 }), 'mail',
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

  // ── 다리 ── 덩어리로. 각기둥이었을 때는 「원통 두 개」였는데, 허벅지에
  // 근육 덩어리를 하나 겹치면 **무릎 위가 부풀어** 사람 다리가 된다
  for (const [th, sh, ft, sd] of [[rig.thighL, rig.shinL, rig.footL, 1], [rig.thighR, rig.shinR, rig.footR, 2]]) {
    new Part(th)
      .add(limb(0.44, 0.105, { jag: 0.10, seed: sd }), dark)
      .add(chunk(0.115, 0.10, 1, sd + 40), steel, { y: -0.13, sy: 0.9, sz: 1.05 })   // 넓적다리 판
      .finish();
    new Part(sh)
      .add(limb(0.42, 0.085, { jag: 0.10, seed: sd + 4 }), dark)
      .add(chunk(0.10, 0.06, 1, sd + 8), steel, { y: -0.02, sy: 0.62 })              // 무릎덮개
      .add(chunk(0.095, 0.05, 1, sd + 12), steel, { y: -0.19, sy: 1.7, sz: 0.75, z: 0.03 })  // 정강이받이
      .add(prism(0.024, 0.045, 0.28, 0.018, 0.035, { hang: false, sides: 4 }), steel, { y: -0.19, z: 0.095 })
      .finish();
    // 발끝을 뾰족하게 — 중세 사바통. 네모난 발은 실루엣을 뭉갠다
    new Part(ft)
      .add(chunk(0.10, 0.08, 1, sd + 16), steel, { y: -0.03, z: 0.05, sy: 0.55, sz: 1.7 })
      .add(spike(0.055, 0.10, 5), steel, { y: -0.045, z: 0.21, rx: 1.35 })
      .finish();
  }

  // ── 골반 · 골판 ── 납작한 덩어리 세 겹이 아래로 갈수록 넓어진다
  const hips = new Part(rig.hips)
    .add(chunk(0.19, 0.08, 1, 21), dark, { y: -0.05, sy: 0.62, sz: 0.78 })
    .add(arc(0.185, 0.028, Math.PI * 2, 16), leather, { y: 0.055, rx: Math.PI / 2, sz: 0.8 })
    .add(chunk(0.055, 0.04, 1, 22), gold, { y: 0.055, z: 0.15, sz: 0.5 });
  for (let i = 0; i < 3; i++) {
    hips.add(chunk(0.20 + i * 0.018, 0.05, 1, 23 + i), steel,
      { y: 0.015 - i * 0.062, sy: 0.20, sz: 0.74 });
  }
  hips.add(tatter(0.17, 0.30, 0.02), cloth, { y: 0.0, z: 0.16 });     // 앞치마(천)
  hips.finish();

  // ── 몸통 ── 가슴 덩어리 위에 흉갑 덩어리를 얹는다. 두 겹이라야 「입은 것」이다
  new Part(rig.spine)
    .add(chunk(0.20, 0.07, 1, 31), steel, { y: 0.11, sy: 0.62, sz: 0.66 })
    .finish();

  const chest = new Part(rig.chest)
    .add(chunk(0.25, 0.06, 2, 32), steel, { y: 0.08, sx: 1.02, sy: 0.66, sz: 0.60 })
    .add(chunk(0.16, 0.05, 2, 33), steel, { y: 0.07, z: 0.10, sy: 0.85, sz: 0.55 });   // 가슴받이
  // 세로 홈 다섯 — 갑옷의 홈은 장식이 아니라 구조다. 빛이 흐를 자리를 만든다
  for (let i = -2; i <= 2; i++) {
    chest.add(prism(0.020, 0.028, 0.20, 0.016, 0.022, { hang: false, sides: 4 }),
      steel, { x: i * 0.055, y: 0.08, z: 0.165, rz: i * 0.06 });
  }
  chest.add(slab(0.10, 0.15, 0.03, 0.02), gold, { y: 0.10, z: 0.185 })    // 문장
    .add(arc(0.155, 0.024, Math.PI, 12), gold, { y: 0.20, z: 0.10, rx: Math.PI / 2 });
  // 망토 — 다섯 장. 한 장짜리 판은 무엇을 해도 널빤지다
  for (let i = 0; i < 5; i++) {
    const t = (i - 2) / 2;
    chest.add(tatter(0.15, 0.58 - Math.abs(t) * 0.10, 0.02), cloth,
      { x: t * 0.155, y: -0.13, z: -0.16 - Math.abs(t) * 0.02, rx: 0.12 + Math.abs(t) * 0.05, rz: -t * 0.12 });
  }
  chest.finish();

  // ── 어깨 갑주 ── 덩어리 두 겹 + 테두리 + 뿔. 실루엣의 핵심
  for (const [g, s, sd] of [[rig.armL, 1, 51], [rig.armR, -1, 52]]) {
    new Part(g)
      .add(chunk(0.165, 0.09, 1, sd), steel, { y: 0.04, sy: 0.78, rz: s * 0.16 })
      .add(arc(0.165, 0.030, Math.PI * 1.35, 14), steel, { y: -0.01, rx: Math.PI / 2, rz: s * 0.18 })
      .add(chunk(0.145, 0.07, 1, sd + 2), steel, { y: -0.06, sy: 0.55, rz: s * 0.13 })
      .add(arc(0.14, 0.020, Math.PI * 1.3, 12), gold, { y: -0.10, rx: Math.PI / 2, rz: s * 0.14 })
      .add(spike(0.036, 0.14, 5), gold, { x: s * 0.15, y: 0.06, rz: s * 0.95 })
      .add(limb(0.32, 0.075, { jag: 0.10, seed: sd + 4 }), dark, { y: -0.05 })
      .finish();
  }
  for (const [g, sd] of [[rig.foreL, 61], [rig.foreR, 62]]) {
    new Part(g)
      .add(limb(0.30, 0.062, { jag: 0.10, seed: sd }), dark)
      .add(chunk(0.078, 0.05, 1, sd + 2), steel, { y: -0.14, sy: 1.5, sz: 0.85, z: 0.02 })  // 팔뚝받이
      .add(arc(0.072, 0.016, Math.PI, 8), gold, { y: -0.235, z: 0.03, rx: Math.PI / 2 })
      .finish();
  }
  for (const [g, sd] of [[rig.handL, 71], [rig.handR, 72]]) {
    new Part(g)
      .add(chunk(0.062, 0.10, 1, sd), steel, { y: -0.055, sy: 1.1, sz: 1.15 })
      .add(chunk(0.055, 0.14, 1, sd + 2), steel, { y: -0.02, sy: 0.42 })   // 손등 마디
      .finish();
  }

  // ── 목 ── 목가리개를 두른다. 투구와 가슴 사이가 비면 머리가 얹혀 보인다
  new Part(rig.neck)
    .add(limb(0.11, 0.052, { jag: 0.06, seed: 81 }), skin)
    .add(arc(0.105, 0.030, Math.PI * 2, 14), steel, { y: -0.055, rx: Math.PI / 2 })
    .finish();

  // ── 얼굴 ─────────────────────────────────────────────────
  //
  // 얼굴이 얼굴로 읽히려면 필요한 것은 이목구비의 정확도가 아니라
  // **면이 꺾이는 자리**다: 이마 → 눈두덩(그늘) → 광대 → 볼(들어감) → 턱.
  // 그 다섯 단계가 있으면 삼각형 300 개로도 사람이 된다.
  const face = new Part(rig.head)
    .add(chunk(0.115, 0.05, 2, 91), skin, { y: 0.075, sy: 1.10, sz: 1.14 })            // 머리통
    .add(chunk(0.088, 0.06, 2, 92), skin, { y: 0.005, z: 0.025, sy: 0.72, sz: 1.02 })  // 턱
    .mirror(chunk(0.040, 0.07, 1, 93), skin, { x: 0.070, y: 0.045, z: 0.070, sy: 0.7 }) // 광대
    .add(arc(0.078, 0.018, Math.PI, 10), skin, { y: 0.082, z: 0.070, rx: Math.PI / 2, ry: Math.PI / 2 })  // 눈두덩
    .add(prism(0.026, 0.032, 0.062, 0.020, 0.046, { hang: false }), skin, { y: 0.020, z: 0.095, rx: 0.22 }) // 코
    .add(chunk(0.020, 0.10, 1, 94), skin, { y: -0.008, z: 0.112, sy: 0.7 })            // 코끝
    .mirror(chunk(0.028, 0.10, 1, 95), skin, { x: 0.115, y: 0.035, sx: 0.4, sy: 1.1 }); // 귀
  face.finish();
  humanEyes(rig.head, dark, 0.042, 0.048, 0.088);
  // 입 — 그늘 한 줄이면 된다. 입술을 만들면 이 크기에서는 **부리**가 된다
  new Part(rig.head).add(slab(0.042, 0.010, 0.02, 0.004), dark, { y: -0.030, z: 0.100 }).finish();

  // ── 머리카락 · 수염 ── 얼굴의 절반은 **머리카락 덩어리의 실루엣**이다.
  // 셰이더가 가닥을 그리므로 여기서는 덩어리만 놓는다
  const hairP = new Part(rig.head)
    .add(chunk(0.128, 0.16, 1, 101), hair, { y: 0.085, z: -0.020, sy: 1.02, sz: 1.10 })
    .add(chunk(0.095, 0.20, 1, 102), hair, { y: 0.020, z: -0.075, sy: 1.25, sz: 0.75 })  // 뒷머리
    .mirror(chunk(0.052, 0.22, 1, 103), hair, { x: 0.098, y: 0.030, z: -0.010, sx: 0.55, sy: 1.5 });
  // 수염 — 턱선을 따라. 있으면 턱이 무거워져서 「어른」으로 보인다
  hairP.add(chunk(0.072, 0.22, 1, 104), hair, { y: -0.040, z: 0.045, sy: 0.85, sz: 0.85 })
    .mirror(chunk(0.036, 0.24, 1, 105), hair, { x: 0.070, y: 0.000, z: 0.030, sy: 1.1 });
  hairP.finish();

  // ── 투구 ── **열린 투구.** 정수리·뒤통수·볼가리개·콧대만 있고 얼굴은 뚫려 있다.
  // 한 덩어리로 씌우면 얼굴이 통째로 묻힌다 — 조각을 나눠 붙이는 이유가 그것이다
  const helm = new Part(rig.head)
    .add(chunk(0.152, 0.045, 2, 111), steel, { y: 0.125, sy: 0.66, sz: 1.06 })         // 정수리
    .add(chunk(0.132, 0.05, 1, 112), steel, { y: 0.055, z: -0.055, sy: 1.05, sz: 0.72 }) // 뒤통수
    .mirror(chunk(0.062, 0.05, 1, 113), steel, { x: 0.128, y: 0.030, z: 0.015, sx: 0.42, sy: 1.35, sz: 1.15 }) // 볼가리개
    .add(prism(0.024, 0.030, 0.135, 0.020, 0.030, { hang: false, sides: 4 }), steel, { y: 0.030, z: 0.118, rx: 0.1 }) // 콧대
    .add(arc(0.150, 0.022, Math.PI * 1.5, 16), gold, { y: 0.098, rx: Math.PI / 2, rz: 0.0 })  // 이마 띠
    .add(spike(0.030, 0.115, 4), gold, { x: 0.112, y: 0.175, rz: -0.42 })
    .add(spike(0.030, 0.115, 4), gold, { x: -0.112, y: 0.175, rz: 0.42 });
  for (let i = 0; i < 6; i++) {                     // 볏
    helm.add(tatter(0.052, 0.125 - Math.abs(i - 2.5) * 0.016, 0.018), cloth,
      { y: 0.205 + Math.sin(i / 5 * Math.PI) * 0.028, z: 0.055 - i * 0.042, rx: -0.22 - i * 0.06 });
  }
  helm.finish();

  // ── 방패 ── 납작한 덩어리 + 테두리 + 대갈못. 아래가 뾰족한 연꼴
  const shieldMount = new THREE.Group();
  shieldMount.position.set(0, -0.16, 0.04);
  shieldMount.rotation.x = 1.45;
  rig.foreL.add(shieldMount);
  const sh = new Part(shieldMount)
    .add(chunk(0.21, 0.05, 1, 121), leather, { y: -0.02, z: 0.12, sy: 1.05, sz: 0.24, ry: -0.34 })
    .add(spike(0.16, 0.20, 6), leather, { y: -0.235, z: 0.12, rx: Math.PI, sz: 0.24, ry: -0.34 })
    .add(arc(0.205, 0.020, Math.PI * 2, 18), steel, { y: -0.02, z: 0.135, ry: -0.34, sy: 1.05 })
    .add(chunk(0.058, 0.06, 1, 122), steel, { y: -0.03, z: 0.165, sz: 0.7, ry: -0.34 });
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    sh.add(chunk(0.017, 0.10, 0, 123 + i), gold,
      { x: Math.cos(a) * 0.135, y: -0.03 + Math.sin(a) * 0.135, z: 0.155, ry: -0.34 });
  }
  sh.finish();
  rig.shield = shieldMount;

  rig.weaponPal = { wrap: leather, dark, accent: gold, bladeMat };
  rig.bladeMat = bladeMat;
  rig.stance = 'knight';
  return done(rig, [skin, hair, steel, dark, gold, cloth, leather, bladeMat]);
}

// ═══════════════════════════ 해골 병사 ═══════════════════════════
//
// 뼈를 덩어리로 짓는다. 「뼈는 매끈한데?」 싶지만 아니다 — 관절머리는
// 울퉁불퉁하고 두개골은 좌우가 다르며, 무엇보다 **오래된 뼈는 삭는다.**
// 각기둥으로 만든 뼈가 대나무처럼 보였던 진짜 이유가 그것이다.
//
// 갈비는 활 그대로 둔다 (1차에서 유일하게 확실히 산 형태다).
// 그리고 **가슴 안에 혼불을 넣는다** — 골렘의 심장과 같은 자리, 같은 역할.
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

  // ── 사지 ── 뼈는 **가운데가 가늘고 양 끝이 굵다.** 관절머리를 위아래
  // 둘 다 덩어리로 얹으면 그것만으로 대나무가 뼈가 된다
  const knob = (s) => chunk(0.048, 0.22, 1, s);
  for (const [th, sh, ft, sd] of [[rig.thighL, rig.shinL, rig.footL, 1], [rig.thighR, rig.shinR, rig.footR, 2]]) {
    new Part(th)
      .add(knob(sd), bone, { y: -0.02, sy: 0.85 })
      .add(limb(0.40, 0.026, { jag: 0.20, seed: sd + 10 }), bone)
      .add(knob(sd + 20), bone, { y: -0.375, sx: 0.85, sz: 0.85 })
      .finish();
    new Part(sh)
      .add(knob(sd + 30), bone, { y: -0.015, sx: 0.8, sz: 0.8 })
      .add(limb(0.38, 0.023, { jag: 0.20, seed: sd + 40 }), bone)
      .add(limb(0.34, 0.013, { jag: 0.18, seed: sd + 50 }), bone, { x: 0.042, y: -0.02 })  // 종아리뼈 둘째
      .add(knob(sd + 60), bone, { y: -0.355, sx: 0.7, sz: 0.7 })
      .finish();
    const f = new Part(ft).add(chunk(0.052, 0.16, 1, sd + 70), bone, { y: -0.02, z: 0.02, sy: 0.6, sz: 1.7 });
    for (let i = -1; i <= 1; i++) {
      f.add(limb(0.10, 0.010, { jag: 0.2, seed: sd + 80 + i }), bone, { x: i * 0.030, y: -0.02, z: 0.11, rx: 1.55 });
    }
    f.finish();
  }

  // ── 골반 ── 가운데가 뚫린 고리 + 좌우로 벌어진 날개
  new Part(rig.hips)
    .add(arc(0.10, 0.032, Math.PI * 2, 14), bone, { y: -0.05, rx: Math.PI / 2 })
    .mirror(chunk(0.070, 0.20, 1, 101), bone, { x: 0.098, y: 0.010, sx: 0.35, sy: 1.05, rz: 0.5, ry: 0.35 })
    .add(tatter(0.30, 0.36, 0.02), rag, { y: -0.16, z: -0.05 })
    .add(tatter(0.16, 0.28, 0.02), rag, { x: 0.13, y: -0.14, z: -0.02, rz: 0.2 })
    .finish();

  // ── 척추 ── 마디 여섯 + 뒤로 튀어나온 돌기
  const spine = new Part(rig.spine);
  for (let i = 0; i < 5; i++) {
    spine.add(chunk(0.030, 0.18, 0, 110 + i), bone, { y: 0.01 + i * 0.045, sy: 0.6 });
    spine.add(spike(0.016, 0.042, 4), bone, { y: 0.01 + i * 0.045, z: -0.048, rx: 2.1 });
  }
  spine.finish();

  // ── 갈비 ── 활 반쪽을 좌우 다섯 쌍. **1차에서 제일 잘 산 부분이라 그대로 둔다**
  const chest = new Part(rig.chest);
  chest.add(limb(0.30, 0.026, { jag: 0.18, seed: 120 }), bone, { y: 0.20, z: -0.055 });
  for (let i = 0; i < 5; i++) {
    const r = 0.155 - i * 0.012;
    const y = 0.20 - i * 0.062;
    const rib = arc(r, 0.016, Math.PI * 0.92, 10, 4);
    chest.add(rib, bone, { y, z: -0.05, rx: Math.PI / 2, ry: Math.PI / 2, rz: -0.12 - i * 0.03 });
    chest.add(rib, bone, { y, z: -0.05, rx: Math.PI / 2, ry: -Math.PI / 2, rz: 0.12 + i * 0.03 });
  }
  chest.add(chunk(0.032, 0.14, 1, 130), bone, { y: 0.06, z: 0.105, sy: 3.6, sz: 0.7 });   // 복장뼈
  chest.mirror(limb(0.20, 0.013, { jag: 0.2, seed: 131 }), bone,
    { x: 0.10, y: 0.21, z: 0.04, rz: Math.PI / 2 - 0.25, ry: -0.3 });                     // 쇄골
  // 갑주 잔해는 **한쪽에만.** 좌우가 같으면 「제복」이고 한쪽만이면 「주워 입은 것」
  chest.add(chunk(0.088, 0.12, 1, 132), rust, { x: 0.12, y: 0.20, sy: 0.5, rz: 0.25 });
  for (let i = 0; i < 4; i++) {
    const t = (i - 1.5) / 1.5;
    chest.add(tatter(0.13, 0.50 - Math.abs(t) * 0.14, 0.02), rag,
      { x: t * 0.13, y: 0.0, z: -0.13, rx: 0.14, rz: -t * 0.1 });
  }
  chest.finish();

  // **혼불** — 골렘의 심장과 같은 자리다. 갈비 안이 비어 있으면 해골은
  // 그냥 뼈 무더기지만, 거기서 불이 새어 나오면 **무엇이 이 뼈를 세우고
  // 있는가**에 대한 답이 된다. 눈빛과 같은 색이라야 한 몬스터로 읽힌다
  core(rig.chest, 0xff5a2a, 0.045, 0, 0.06, -0.01, 0.42);

  for (const [g, s, sd] of [[rig.armL, 1, 140], [rig.armR, -1, 141]]) {
    new Part(g)
      .add(knob(sd), bone, { y: 0.01, sx: 0.8, sz: 0.8 })
      .add(limb(0.30, 0.022, { jag: 0.20, seed: sd + 2 }), bone, { y: -0.02 })
      .add(knob(sd + 4), bone, { y: -0.27, sx: 0.7, sz: 0.7 })
      .add(chunk(0.082, 0.12, 1, sd + 6), rust, { y: 0.03, sy: 0.5, rz: s * 0.2 })
      .finish();
  }
  for (const [g, sd] of [[rig.foreL, 150], [rig.foreR, 151]]) {
    new Part(g)
      .add(limb(0.28, 0.018, { jag: 0.20, seed: sd }), bone)
      .add(limb(0.26, 0.012, { jag: 0.18, seed: sd + 2 }), bone, { x: 0.030, y: -0.01 })
      .add(knob(sd + 4), bone, { y: -0.26, sx: 0.6, sz: 0.6 })
      .finish();
  }
  for (const [g, sd] of [[rig.handL, 160], [rig.handR, 161]]) {
    const p = new Part(g).add(chunk(0.032, 0.16, 1, sd), bone, { y: -0.035, sy: 1.1, sz: 0.45 });
    for (let i = -1; i <= 2; i++) {
      p.add(limb(0.075, 0.007, { jag: 0.2, seed: sd + 10 + i }), bone, { x: i * 0.019, y: -0.065, rz: i * 0.12 });
    }
    p.add(limb(0.05, 0.007, { jag: 0.2, seed: sd + 20 }), bone, { x: -0.035, y: -0.035, rz: -0.9 });
    p.finish();
  }

  // ── 두개골 ── 덩어리로. 각기둥 세 개였을 때는 어느 각도에서도 「양동이」였다.
  // 머리통은 위로 좁아지고 뒤통수가 튀어나오고, **눈구멍은 깊어야 한다**
  new Part(rig.neck).add(limb(0.085, 0.020, { jag: 0.2, seed: 170 }), bone).finish();
  const skull = new Part(rig.head)
    .add(chunk(0.098, 0.09, 2, 171), bone, { y: 0.075, sy: 1.02, sz: 1.14 })
    .add(chunk(0.062, 0.12, 1, 172), bone, { y: 0.085, z: -0.075, sy: 0.95, sz: 0.7 })   // 뒤통수
    .mirror(chunk(0.040, 0.14, 1, 173), bone, { x: 0.072, y: 0.030, z: 0.045, sy: 0.75 }) // 광대
    .add(chunk(0.072, 0.10, 1, 174), bone, { y: -0.030, z: 0.038, sy: 0.42, sz: 0.95 })   // 아래턱
    .mirror(chunk(0.030, 0.12, 1, 175), bone, { x: 0.052, y: 0.052, z: 0.070, sz: 0.5 });  // 눈구멍 테
  // 눈구멍은 **파야** 한다 — 검은 판을 얹으면 그냥 검은 점이다
  skull.mirror(chunk(0.030, 0.10, 1, 176), rag, { x: 0.052, y: 0.052, z: 0.080, sz: 0.85 });
  skull.add(prism(0.024, 0.026, 0.042, 0.010, 0.018, { hang: false, sides: 4 }), rag, { y: 0.010, z: 0.098 }); // 코 구멍
  for (let i = -2; i <= 2; i++) {                    // 이빨
    skull.add(prism(0.014, 0.012, 0.024, 0.011, 0.010, { hang: false, sides: 4 }), bone,
      { x: i * 0.022, y: -0.014, z: 0.088 - Math.abs(i) * 0.006 });
    skull.add(prism(0.014, 0.012, 0.022, 0.011, 0.010, { hang: false, sides: 4 }), bone,
      { x: i * 0.022, y: -0.040, z: 0.088 - Math.abs(i) * 0.006 });
  }
  skull.add(chunk(0.052, 0.14, 1, 177), rust, { x: 0.088, y: 0.070, sx: 0.35, sy: 1.1, rz: 0.2, ry: -0.4 }); // 투구 잔해
  skull.finish();
  eyes(rig.head, 0xff5a2a, 0.052, 0.052, 0.072, 0.024, 0.017, 0.12);

  rig.weaponPal = { wrap: rag, dark: rag, accent: rust, bladeMat };
  rig.bladeMat = bladeMat;
  rig.stance = 'skeleton';
  return done(rig, [bone, rag, rust, bladeMat]);
}

// ═══════════════════════════ 구울 ═══════════════════════════
//
// 덩어리가 제일 잘 맞는 몸이다. **부은 시체는 원래 덩어리다** —
// 각기둥으로 만들면 아무리 색을 잘 칠해도 「초록 사람」이 된다.
//
// 좌우 비대칭도 그대로 간다: 오른팔이 굵고 길다, 한쪽 갈비가 터져 나왔다,
// 눈 크기가 다르다. 그리고 터진 가슴 안에 **희미한 불**을 넣는다 —
// 골렘처럼 밝지는 않다. 이건 심장이 아니라 썩는 열이다.
export function buildGhoulHD() {
  const skin = surface(M(0x63704a, { roughness: 0.95, metalness: 0 }), 'flesh',
    { rim: 0xa8ff8a, rimAmt: 0.4, grime: 0.4, scale: 5.5 });
  const belly = surface(M(0x8d9668, { roughness: 0.96, metalness: 0 }), 'flesh',
    { rim: 0xc0ff9a, rimAmt: 0.35, grime: 0.4, scale: 4.5 });
  const claw = surface(M(0xd2c6a6, { roughness: 0.45, metalness: 0.18 }), 'bone',
    { rim: 0xfff0c0, rimAmt: 0.5, scale: 5.0 });
  const gore = surface(M(0x5e1c24, { roughness: 0.35, metalness: 0.05 }), 'flesh',
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
  rig.chest.rotation.z = 0.07;      // 어깨 하나를 낮춘다 — 기울어진 몸

  for (const [th, sh, ft, sd] of [[rig.thighL, rig.shinL, rig.footL, 1], [rig.thighR, rig.shinR, rig.footR, 2]]) {
    new Part(th).add(limb(0.26, 0.085, { jag: 0.18, seed: sd }), skin).finish();
    new Part(sh)
      .add(limb(0.24, 0.062, { jag: 0.18, seed: sd + 4 }), skin)
      .add(chunk(0.036, 0.18, 1, sd + 8), skin, { y: -0.05, z: -0.05, sy: 1.9, rx: -0.2 })  // 아킬레스
      .finish();
    const f = new Part(ft).add(chunk(0.072, 0.16, 1, sd + 12), skin, { y: -0.02, z: 0.04, sy: 0.5, sz: 1.6 });
    for (let i = -1; i <= 1; i++) f.add(spike(0.022, 0.10, 4), claw, { x: i * 0.045, y: -0.045, z: 0.135, rx: 1.5 });
    f.finish();
  }

  new Part(rig.hips).add(chunk(0.155, 0.16, 1, 20), skin, { y: -0.03, sy: 0.55, sz: 0.82 }).finish();
  new Part(rig.spine)
    .add(chunk(0.170, 0.15, 1, 21), skin, { y: 0.08, sy: 0.58, sz: 0.92 })
    // 처진 배 — 아래로 늘어진다. 굶은 시체가 아니라 **불은 시체**다
    .add(chunk(0.125, 0.13, 1, 22), belly, { y: 0.055, z: 0.105, sy: 1.15, sz: 0.85 })
    .finish();

  const ch = new Part(rig.chest)
    .add(chunk(0.185, 0.14, 1, 30), skin, { y: 0.05, sy: 0.72, sz: 0.92 })
    .add(chunk(0.135, 0.12, 1, 31), belly, { y: 0.015, z: 0.115, sy: 0.82, sz: 0.62 });
  // 터져 나온 갈비 — **한쪽만.** 살(구멍)을 먼저 파고 그 위에 뼈를 얹는다
  ch.add(chunk(0.078, 0.22, 1, 32), gore, { x: 0.105, y: 0.055, z: 0.135, sz: 0.75 });
  for (let i = 0; i < 3; i++) {
    ch.add(arc(0.075 - i * 0.008, 0.011, Math.PI * 0.55, 8, 4), claw,
      { x: 0.11, y: 0.115 - i * 0.05, z: 0.145, rx: Math.PI / 2, ry: -Math.PI / 2 + 0.3, rz: 0.2 });
  }
  // 등뼈 돌기 — 굽은 등의 실루엣이 여기서 나온다
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    ch.add(spike(0.038 - t * 0.014, 0.14 - t * 0.05, 4), claw,
      { x: (i % 2 ? 0.012 : -0.012), y: 0.15 - i * 0.058, z: -0.135 - Math.sin(t * 3) * 0.01, rx: -0.55 + t * 0.25 });
  }
  ch.finish();
  // 썩는 열 — 골렘처럼 밝지 않다. **터진 자리에서만** 겨우 새어 나온다
  core(rig.chest, 0xff7a4a, 0.024, 0.105, 0.055, 0.150, 0.16);

  new Part(rig.neck).add(limb(0.12, 0.062, { jag: 0.16, seed: 40 }), skin).finish();
  // ── 머리 ── 길쭉한 두개골 · 큰 턱관절 · 이빨 · **눈 크기가 다르다**
  const head = new Part(rig.head)
    .add(chunk(0.108, 0.13, 2, 41), skin, { y: 0.03, z: 0.02, sy: 0.85, sz: 1.30 })
    .add(chunk(0.078, 0.14, 1, 42), belly, { y: -0.025, z: 0.155, sy: 0.72, sz: 0.95 })   // 주둥이
    .mirror(chunk(0.048, 0.16, 1, 43), skin, { x: 0.098, y: 0.0, z: 0.055, sy: 0.75 });   // 턱관절
  for (let i = 0; i < 6; i++) {
    const x = -0.06 + i * 0.024;
    head.add(spike(0.016 + (i % 2) * 0.006, 0.05 + (i % 2) * 0.03, 4), claw, { x, y: -0.055, z: 0.195, rx: Math.PI });
    head.add(spike(0.014, 0.04, 4), claw, { x, y: -0.085, z: 0.185 });
  }
  head.add(spike(0.032, 0.15, 4), claw, { x: 0.095, y: 0.105, z: -0.02, rz: -0.4, rx: -0.2 })  // 귀 — 길이가 다르다
    .add(spike(0.028, 0.10, 4), claw, { x: -0.095, y: 0.095, z: -0.02, rz: 0.55, rx: -0.1 })
    .finish();
  const [eL] = eyes(rig.head, 0xffd23a, 0.058, 0.055, 0.125, 0.034, 0.028, 0.15);
  eL.scale.setScalar(1.45);          // 한쪽 눈만 크다 — 대칭을 깨는 마지막 한 수

  // ── 팔 ── **오른팔이 굵고 길다.** 왼팔은 말랐다
  for (const [g, k, sd] of [[rig.armL, 0.80, 50], [rig.armR, 1.20, 51]]) {
    new Part(g).add(limb(0.30, 0.072 * k, { jag: 0.18, seed: sd }), skin).finish();
  }
  for (const [g, k, sd] of [[rig.foreL, 0.80, 60], [rig.foreR, 1.18, 61]]) {
    new Part(g)
      .add(limb(0.30, 0.058 * k, { jag: 0.18, seed: sd }), skin)
      .add(spike(0.024, 0.09, 5), claw, { x: 0.05 * k, y: -0.02, rz: 0.35 })   // 튀어나온 뼈
      .finish();
  }
  for (const [g, k, sd] of [[rig.handL, 0.85, 70], [rig.handR, 1.20, 71]]) {
    const p = new Part(g).add(chunk(0.055 * k, 0.18, 1, sd), skin, { y: -0.045, sy: 0.95 });
    for (let i = -1; i <= 1; i++) {
      // 손톱을 **굽힌다.** 곧은 원뿔은 못이고, 두 마디로 꺾으면 발톱이다
      p.add(spike(0.026 * k, 0.13, 4), claw, { x: i * 0.05 * k, y: -0.10, z: 0.02, rx: Math.PI + 0.15 });
      p.add(spike(0.020 * k, 0.11, 4), claw, { x: i * 0.05 * k, y: -0.19, z: 0.055, rx: Math.PI + 0.75 });
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
// 1차에서 제일 안 됐던 것. 각기둥 원뿔에 자락을 두른 것이라 **얼음 결정**처럼
// 뻣뻣했다. 덩어리로 지으면 옷이 몸을 덮은 모양이 되고, 거기에 흩어짐
// (잡음 문턱 discard)이 걸리면 아래가 연기처럼 풀린다.
//
// 그리고 두건 속에 **등불**을 넣는다. 얼굴이 없는 것들 중에서도 이놈은
// 특히 아무것도 없어서, 어두운 데서는 파란 덩어리 하나였다.
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

  // ── 옷자락 ── 덩어리 세 겹이 아래로 갈수록 좁아지고, 그 아래에 찢어진 자락.
  // 덩어리라 옆구리가 울퉁불퉁해서 **천이 몸을 덮은 모양**이 된다
  const hips = new Part(rig.hips)
    .add(chunk(0.17, 0.16, 1, 1), robe, { y: -0.10, sy: 1.15, sz: 0.95 })
    .add(chunk(0.13, 0.18, 1, 2), robe, { y: -0.34, sy: 1.05, sz: 0.95 });
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2;
    const len = 0.38 + ((i * 4) % 5) * 0.11;
    hips.add(tatter(0.15, len, 0.022), inner,
      { x: Math.sin(a) * 0.15, z: Math.cos(a) * 0.15, y: -0.30,
        rx: Math.cos(a) * 0.15, rz: -Math.sin(a) * 0.15, ry: -a });
  }
  hips.finish();
  new Part(rig.spine).add(chunk(0.155, 0.14, 1, 3), robe, { y: 0.10, sy: 0.90, sz: 0.92 }).finish();
  const chest = new Part(rig.chest)
    .add(chunk(0.175, 0.13, 1, 4), robe, { y: 0.05, sy: 0.85, sz: 0.86 })
    // 어깨 망토 — 유령의 어깨선을 만들어 준다. 없으면 그냥 자루다
    .add(chunk(0.215, 0.15, 1, 5), inner, { y: 0.115, sy: 0.36, sz: 0.88 });
  for (let i = 0; i < 5; i++) {
    const t = (i - 2) / 2;
    chest.add(tatter(0.14, 0.50 - Math.abs(t) * 0.12, 0.02), inner,
      { x: t * 0.13, y: -0.06, z: -0.14, rx: 0.1, rz: -t * 0.12 });
  }
  chest.finish();

  new Part(rig.neck).add(limb(0.09, 0.045, { jag: 0.14, seed: 6 }), inner).finish();
  // ── 두건 ── 깊게 판다. **얼굴 자리는 진짜로 비어 있어야** 무섭다
  new Part(rig.head)
    .add(chunk(0.125, 0.12, 1, 7), robe, { y: 0.075, sy: 1.15, sz: 1.05 })
    .add(spike(0.075, 0.16, 6), robe, { y: 0.135 })                            // 두건 끝
    .add(chunk(0.098, 0.10, 1, 8), inner, { y: 0.020, z: 0.062, sy: 0.95, sz: 0.6 })
    .add(arc(0.112, 0.022, Math.PI * 1.1, 12), robe, { y: 0.045, z: 0.085, rx: Math.PI / 2, ry: Math.PI / 2 })
    .finish();
  // 두건 속의 등불 — 눈 두 개보다 **하나의 빛**이 더 무섭다. 얼굴이 없다는
  // 사실을 감추는 게 아니라 **강조**하는 쪽이다
  core(rig.head, 0x9fd8ff, 0.026, 0, 0.048, 0.075, 0.30);
  eyes(rig.head, 0xbfe8ff, 0.040, 0.048, 0.105, 0.024, 0.016, 0.13);

  for (const [g, s, sd] of [[rig.armL, 1, 10], [rig.armR, -1, 11]]) {
    new Part(g).add(limb(0.26, 0.070, { jag: 0.16, seed: sd }), robe, { rz: s * 0.1 }).finish();
  }
  for (const [g, sd] of [[rig.foreL, 20], [rig.foreR, 21]]) {
    new Part(g).add(limb(0.24, 0.052, { jag: 0.16, seed: sd }), robe).finish();
  }
  // 손 — 소매에서 **뼈만** 나온다. 유령의 손은 옷의 일부가 아니다
  for (const [g, sd] of [[rig.handL, 30], [rig.handR, 31]]) {
    const p = new Part(g).add(chunk(0.026, 0.16, 1, sd), boneM, { y: -0.03, sy: 1.15, sz: 0.55 });
    for (let i = -1; i <= 1; i++) {
      p.add(limb(0.075, 0.006, { jag: 0.2, seed: sd + 2 + i }), boneM, { x: i * 0.018, y: -0.055, rz: i * 0.15 });
    }
    p.finish();
  }

  // ── 활 ── 리커브. 팔 넷(안쪽 둘 + 끝 둘)이 서로 반대로 휜다
  const bow = new THREE.Group();
  bow.rotation.x = 1.16;
  const bp = new Part(bow)
    .add(prism(0.05, 0.075, 0.15, 0.045, 0.065, { hang: false }), wood);
  for (const s of [1, -1]) {
    bp.add(prism(0.036, 0.055, 0.26, 0.026, 0.04, { hang: false }), wood,
      { y: s * 0.20, rz: -s * 0.30, rx: -s * 0.10 });
    bp.add(prism(0.024, 0.038, 0.16, 0.014, 0.022, { hang: false }), wood,
      { y: s * 0.40, z: -0.045, rz: s * 0.34, rx: s * 0.16 });
    bp.add(chunk(0.020, 0.12, 1, 40 + s), boneM, { y: s * 0.47, z: -0.075 });
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
  // 「반쯤 지워진 그림」이 된다. 위쪽은 문턱을 안 넘으니 안 사라진다
  for (const m of [robe, inner]) dissolve(m, 0.62, -0.02);

  return done(rig, [robe, inner, wood, boneM, stringMat]);
}

// ═══════════════════════════ 무덤 골렘 ═══════════════════════════
//
// **여기는 안 건드린다.** 이번 판의 기준이 이놈이다.
// 깨진 돌덩이 · 균열에서 새어 나오는 심장 빛 · 위쪽 면에만 이끼 ·
// 왼쪽 어깨가 깨져 나감 · 가슴의 룬 세 줄.
export function buildGolemHD() {
  // 돌 셰이더가 균열·알갱이로 깎아 내리는 만큼 **기본색을 올려 둬야** 한다.
  // 게임 값(0x6b6a72)을 그대로 넣었더니 깎이고 깎여 **석탄 더미**가 됐다
  const stone = surface(M(0x8a8894, { roughness: 0.98, metalness: 0.02 }), 'stone',
    { rim: 0xff9a4a, rimAmt: 0.35, grime: 0.6, scale: 2.4 });
  const dark = surface(M(0x56555f, { roughness: 0.99, metalness: 0 }), 'stone',
    { rim: 0xff8040, rimAmt: 0.25, grime: 0.5, scale: 2.8 });
  crackGlow(stone, 0xff7a2a, 0.9);
  const runeMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a });

  const rig = skeleton({
    hipY: 0.90, legX: 0.24, thigh: 0.40, shin: 0.36,
    spineY: 0.06, chestY: 0.30, neckY: 0.26, headY: 0.02,
    armX: 0.52, armY: 0.14, upper: 0.44, fore: 0.40,
  });

  for (const [th, sh, ft, sd] of [[rig.thighL, rig.shinL, rig.footL, 1], [rig.thighR, rig.shinR, rig.footR, 2]]) {
    new Part(th)
      .add(chunk(0.20, 0.26, 1, sd), stone, { y: -0.13, sy: 1.5 })
      .add(chunk(0.19, 0.3, 1, sd + 10), dark, { y: -0.03, sy: 0.7 })
      .finish();
    new Part(sh).add(chunk(0.185, 0.28, 1, sd + 20), stone, { y: -0.16, sy: 1.35 }).finish();
    new Part(ft).add(chunk(0.20, 0.22, 1, sd + 30), stone, { y: -0.04, z: 0.05, sy: 0.6, sz: 1.25 }).finish();
  }

  new Part(rig.hips).add(chunk(0.30, 0.24, 1, 40), stone, { y: -0.05, sy: 0.72, sz: 0.78 }).finish();
  new Part(rig.spine).add(chunk(0.32, 0.26, 1, 41), stone, { y: 0.12, sy: 0.62, sz: 0.72 }).finish();

  new Part(rig.chest)
    .add(chunk(0.44, 0.22, 1, 42), stone, { y: 0.15, sy: 0.62, sz: 0.66 })
    // 왼쪽 어깨가 깨져 나갔다 — 어둠으로 파고, 그 자리에서 심장이 더 밝게 샌다
    .add(chunk(0.20, 0.35, 1, 43), dark, { x: 0.30, y: 0.28, sy: 0.75 })
    .add(prism(0.30, 0.14, 0.32, 0.20, 0.10, { hang: false }), dark, { y: 0.16, z: 0.24 })
    .finish();
  rig.core = core(rig.chest, 0xffb050, 0.15, 0, 0.17, 0.28, 0.72);
  for (let i = 0; i < 3; i++) {                    // 룬 — 어둠 속에서 먼저 읽힌다
    const r = new THREE.Mesh(slab(0.18 - i * 0.03, 0.022, 0.02, 0.006), runeMat);
    r.position.set(0, 0.38 - i * 0.05, 0.30);
    rig.chest.add(r);
  }

  // ── 머리 ── 부서진 석상 얼굴. 왕관 조각이 한쪽만 남았다.
  // 「어깨가 머리보다 높다」는 골렘의 규칙이지만 어깨 돌기까지 더하니
  // 머리가 **아예 안 보였다.** 조금 올리고 키워서 실루엣에 남긴다
  new Part(rig.head)
    .add(chunk(0.23, 0.2, 1, 50), stone, { y: 0.16, sy: 0.82 })
    .add(prism(0.26, 0.12, 0.10, 0.24, 0.10, { hang: false }), dark, { y: 0.08, z: 0.17 })
    .add(prism(0.07, 0.11, 0.13, 0.05, 0.09, { hang: false }), stone, { y: 0.0, z: 0.16 })   // 코
    .add(spike(0.05, 0.17, 4), stone, { x: 0.14, y: 0.17, rz: -0.5 })
    .add(spike(0.038, 0.11, 4), stone, { x: -0.14, y: 0.15, rz: 0.5 })                        // 짧다 = 부러졌다
    .add(chunk(0.05, 0.3, 1, 51), dark, { x: -0.15, y: 0.20, rz: 0.4 })
    .finish();
  eyes(rig.head, 0xffb050, 0.082, 0.085, 0.19, 0.05, 0.038, 0.24);

  for (const [g, s, sd] of [[rig.armL, 1, 60], [rig.armR, -1, 61]]) {
    const p = new Part(g)
      .add(chunk(0.24, 0.22, 1, sd), stone, { y: 0.02, sy: 0.72 })
      .add(chunk(0.185, 0.26, 1, sd + 2), stone, { y: -0.26, sy: 1.3 });
    for (let i = 0; i < 3; i++) {      // 어깨에서 삐죽 나온 돌 — 골렘의 실루엣
      p.add(spike(0.045, 0.15 - i * 0.03, 4), stone,
        { x: s * (0.14 + i * 0.02), y: 0.10 - i * 0.09, rz: s * (0.8 + i * 0.2) });
    }
    p.finish();
  }
  for (const [g, sd] of [[rig.foreL, 70], [rig.foreR, 71]]) {
    new Part(g).add(chunk(0.185, 0.24, 1, sd), stone, { y: -0.18, sy: 1.25 }).finish();
  }
  for (const [g, sd] of [[rig.handL, 80], [rig.handR, 81]]) {
    new Part(g)
      .add(chunk(0.24, 0.28, 1, sd), stone, { y: -0.14, sy: 0.9 })
      .add(chunk(0.09, 0.35, 1, sd + 2), dark, { y: -0.26, z: 0.10 })
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
