// 스타일 판 — **단순한 몸 하나에 셰이딩만 다섯 가지.**
//
// ── 왜 방향을 틀었나 ─────────────────────────────────────────
// 앞의 두 판(gfx.html · chars.html)에서 계속 **디테일을 더하는 쪽**으로 갔다.
// 갈비뼈를 곡선으로 바꾸고, 물질 셰이더를 넣고, 덩어리를 겹쳤다. 그런데
// 마지막 판에서 구울은 **덩어리 반죽**이 됐고 궁수는 **눈사람**이 됐다.
// 더 넣을수록 나빠지는 구간에 들어간 것이다.
//
// 문제는 세공이 아니라 **결정을 안 한 것**이었다. 「어떤 그림체인가」를
// 정하지 않고 「더 정교하게」만 하면 반드시 이렇게 된다.
//
// 그래서 이 판은 반대로 간다:
//
//   · 몸은 **덩어리 열두어 개**로 끝낸다. 실루엣만 남기고 다 버린다
//   · 다섯 칸이 **완전히 같은 지오메트리**를 쓴다. 바뀌는 것은 칠하는 법뿐
//   · 그래야 「무엇이 좋은가」가 아니라 **「어떤 쪽이 좋은가」**를 고를 수 있다
//
// 다섯은 아무거나 고른 게 아니라 **비용과 인상이 다른 축**으로 골랐다.
// 위로 갈수록 싸고 아래로 갈수록 세다.

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { prism, slab, spike, Part, skeleton } from './core/rig.js';
import { surface, glowDisc } from './core/surface.js';

const COLS = 5;
const CW = 320, CH = 470;
const W = CW * COLS, H = CH * 2;

const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('c') });
renderer.setSize(W, H);
renderer.setScissorTest(true);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

// ───────────────────────── 도형 (넷뿐이다) ─────────────────────────

/** 덩어리 — 찌그러진 정이십면체. 골렘에서 온 것이고 이 파일의 기본 단위다 */
function chunk(r, jag = 0.16, detail = 1, seed = 0) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(r, detail));
  const p = g.attributes.position;
  const seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    let k = seen.get(key);
    if (k === undefined) {
      const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.37) * 43758.5453;
      k = 1 + (s - Math.floor(s) - 0.5) * jag * 2;
      seen.set(key, k);
    }
    p.setXYZ(i, x * k, y * k * 0.94, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** 사지 — 덩어리를 세로로 늘여 관절에 매단다 */
function limb(len, r, opt = {}) {
  const g = chunk(r, opt.jag ?? 0.12, opt.detail ?? 1, opt.seed ?? 0);
  g.scale(opt.w ?? 1, len / (2 * r), opt.d ?? 1);
  g.translate(0, -len / 2, 0);
  return g;
}

const arc = (r, t, span = Math.PI, seg = 14) => new THREE.TorusGeometry(r, t, 5, seg, span);
const tatter = (w, h, d = 0.02) => prism(w * 0.35, d, h, w, d, { sides: 4 });

// ───────────────────────── 몸 (둘뿐이다) ─────────────────────────
//
// **부위 수를 세 보면 앞판의 1/3 이다.** 기사는 34 부위였는데 여기서는 12 다.
// 화면에서 캐릭터가 백 픽셀 안팎이라는 것을 생각하면 그게 맞는 수다 —
// 안 보이는 것을 만드는 데 쓴 시간은 전부 손해였다.

/**
 * 전사 — **사람이다.** 열린 투구에 얼굴이 보인다.
 *
 * 얼굴을 이목구비로 만들지 않는다. 이 크기에서 얼굴로 읽히는 것은
 * **밝은 살덩이 하나 + 그 안의 어두운 구멍 둘 + 아래의 어두운 수염**이다.
 * 코와 입을 만들면 오히려 뭉개진다 — 앞판에서 그렇게 뭉갰다.
 */
function buildHero(mk) {
  const skin = mk(0xc99a72, 'skin', { rough: 0.8 });
  const hair = mk(0x2b1f18, 'hair', { rough: 0.95 });
  const steel = mk(0x8c96ac, 'steel', { metal: 0.85, rough: 0.32 });
  const dark = mk(0x2b2936, 'mail', { metal: 0.4, rough: 0.65 });
  const gold = mk(0xc0a054, 'steel', { metal: 0.9, rough: 0.28 });
  const cloth = mk(0x9e2f3a, 'cloth', { rough: 0.98 });
  const blade = mk(0xd8dce6, 'steel', { metal: 0.92, rough: 0.16 });

  const rig = skeleton({
    hipY: 0.98, legX: 0.14, thigh: 0.44, shin: 0.42,
    spineY: 0.04, chestY: 0.24, neckY: 0.22, headY: 0.1,
    armX: 0.28, armY: 0.12, upper: 0.32, fore: 0.30,
  });

  // 다리 — 관절당 덩어리 하나. 무릎덮개 하나만 얹어 「갑옷」임을 알린다
  for (const [th, sh, ft, s] of [[rig.thighL, rig.shinL, rig.footL, 1], [rig.thighR, rig.shinR, rig.footR, 2]]) {
    new Part(th).add(limb(0.44, 0.10, { seed: s }), dark).finish();
    new Part(sh).add(limb(0.42, 0.082, { seed: s + 4 }), dark)
      .add(chunk(0.098, 0.06, 1, s + 8), steel, { y: -0.03, sy: 0.55 }).finish();
    new Part(ft).add(chunk(0.095, 0.08, 1, s + 12), steel, { y: -0.03, z: 0.05, sy: 0.55, sz: 1.6 }).finish();
  }

  // 허리 — 덩어리 하나 + 띠 하나. 잘록해야 어깨가 넓어 보인다
  new Part(rig.hips)
    .add(chunk(0.175, 0.07, 1, 20), dark, { y: -0.05, sy: 0.72, sz: 0.8 })
    .add(arc(0.175, 0.026, Math.PI * 2, 16), gold, { y: 0.045, rx: Math.PI / 2, sz: 0.82 })
    .add(tatter(0.16, 0.30), cloth, { y: 0.0, z: 0.155 })
    .finish();

  // 가슴 — 덩어리 하나 + 문장 하나. 세로 홈도 가슴받이도 뺐다
  new Part(rig.spine).add(chunk(0.19, 0.05, 1, 21), steel, { y: 0.11, sy: 0.62, sz: 0.7 }).finish();
  const ch = new Part(rig.chest)
    .add(chunk(0.245, 0.05, 2, 22), steel, { y: 0.08, sx: 1.02, sy: 0.68, sz: 0.62 })
    .add(slab(0.10, 0.15, 0.03, 0.02), gold, { y: 0.09, z: 0.17 });
  for (let i = 0; i < 3; i++) {                 // 망토 — 세 장이면 충분하다
    const t = i - 1;
    ch.add(tatter(0.20, 0.58 - Math.abs(t) * 0.10), cloth,
      { x: t * 0.185, y: -0.13, z: -0.16, rx: 0.12, rz: -t * 0.14 });
  }
  ch.finish();

  // 어깨 — **실루엣에서 제일 중요한 부위라 여기만 두 겹이다**
  for (const [g, s, sd] of [[rig.armL, 1, 30], [rig.armR, -1, 31]]) {
    new Part(g)
      .add(chunk(0.16, 0.08, 1, sd), steel, { y: 0.035, sy: 0.8, rz: s * 0.16 })
      .add(arc(0.16, 0.028, Math.PI * 1.35, 14), gold, { y: -0.02, rx: Math.PI / 2, rz: s * 0.18 })
      .add(limb(0.32, 0.072, { seed: sd + 2 }), dark, { y: -0.05 })
      .finish();
  }
  for (const [g, sd] of [[rig.foreL, 40], [rig.foreR, 41]]) {
    new Part(g).add(limb(0.30, 0.060, { seed: sd }), dark)
      .add(chunk(0.074, 0.05, 1, sd + 2), steel, { y: -0.15, sy: 1.4, sz: 0.85 }).finish();
  }
  for (const [g, sd] of [[rig.handL, 50], [rig.handR, 51]]) {
    new Part(g).add(chunk(0.060, 0.10, 1, sd), steel, { y: -0.05, sy: 1.1 }).finish();
  }

  // 목 — 살이 보여야 머리와 몸이 이어진다
  new Part(rig.neck).add(limb(0.11, 0.05, { seed: 60 }), skin).finish();

  // 얼굴 — 덩어리 둘(머리통·턱) + 머리카락 둘 + 투구 셋. **그게 전부다**
  new Part(rig.head)
    .add(chunk(0.118, 0.05, 2, 61), skin, { y: 0.070, sy: 1.08, sz: 1.12 })
    .add(chunk(0.086, 0.06, 2, 62), skin, { y: 0.005, z: 0.025, sy: 0.70, sz: 1.0 })
    .finish();
  // 눈 — 어두운 구멍 둘. 사람 눈은 **빛나면 안 된다**
  new Part(rig.head)
    .mirror(chunk(0.024, 0.1, 1, 63), dark, { x: 0.044, y: 0.050, z: 0.082, sz: 0.55 })
    .add(chunk(0.070, 0.18, 1, 64), hair, { y: -0.042, z: 0.045, sy: 0.85, sz: 0.85 })   // 수염
    .add(chunk(0.100, 0.20, 1, 65), hair, { y: 0.030, z: -0.070, sy: 1.2, sz: 0.75 })    // 뒷머리
    .finish();
  // 투구 — 정수리 · 볼가리개 · 뿔. 얼굴 앞은 **비워 둔다**
  const helm = new Part(rig.head)
    .add(chunk(0.150, 0.04, 2, 66), steel, { y: 0.128, sy: 0.62, sz: 1.05 })
    .mirror(chunk(0.058, 0.05, 1, 67), steel, { x: 0.126, y: 0.030, z: 0.010, sx: 0.42, sy: 1.35 })
    .add(arc(0.148, 0.022, Math.PI * 1.5, 16), gold, { y: 0.098, rx: Math.PI / 2 })
    .add(spike(0.030, 0.115, 4), gold, { x: 0.112, y: 0.175, rz: -0.42 })
    .add(spike(0.030, 0.115, 4), gold, { x: -0.112, y: 0.175, rz: 0.42 });
  for (let i = 0; i < 4; i++) {
    helm.add(tatter(0.05, 0.11), cloth, { y: 0.205, z: 0.03 - i * 0.05, rx: -0.25 - i * 0.07 });
  }
  helm.finish();

  // 방패 — 납작한 덩어리 하나 + 테 하나 + 보스 하나
  const sm = new THREE.Group();
  sm.position.set(0, -0.16, 0.04); sm.rotation.x = 1.45;
  rig.foreL.add(sm);
  new Part(sm)
    .add(chunk(0.205, 0.04, 1, 70), dark, { y: -0.02, z: 0.12, sy: 1.05, sz: 0.22, ry: -0.34 })
    .add(arc(0.20, 0.022, Math.PI * 2, 20), steel, { y: -0.02, z: 0.135, ry: -0.34, sy: 1.05 })
    .add(chunk(0.055, 0.05, 1, 71), gold, { y: -0.02, z: 0.165, sz: 0.7, ry: -0.34 })
    .finish();
  rig.shield = sm;

  // 검 — 날 · 코등이 · 자루. 세 조각
  const sw = new THREE.Group();
  sw.rotation.x = Math.PI;
  new Part(sw)
    .add(prism(0.085, 0.030, 0.68, 0.020, 0.010, { sides: 4, hang: false }), blade, { y: 0.37 })
    .add(slab(0.26, 0.045, 0.045, 0.014), gold, { y: 0.03 })
    .add(prism(0.030, 0.030, 0.16, 0.034, 0.034, { hang: false }), dark, { y: -0.06 })
    .add(chunk(0.038, 0.06, 1, 80), gold, { y: -0.15, sy: 0.7 })
    .finish();
  rig.handR.add(sw);
  rig.weapon = sw; rig.bladeMat = blade;
  rig.stance = 'knight';
  rig.mats = [skin, hair, steel, dark, gold, cloth, blade];
  return rig;
}

/**
 * 구울 — **덩어리 열둘.** 앞판에서 이놈이 제일 망가졌다(반죽이 됐다).
 *
 * 망가진 이유는 덩어리를 너무 많이 겹쳐서 **실루엣의 경계가 사라졌기**
 * 때문이다. 겹치는 덩어리는 몸통에만 쓰고, 팔다리는 하나씩만 쓴다.
 * 대신 뿔·발톱·등뼈처럼 **삐져나오는 것**을 남긴다 — 실루엣은 거기서 나온다.
 */
function buildFoe(mk) {
  const skin = mk(0x64714b, 'flesh', { rough: 0.95 });
  const belly = mk(0x8e9769, 'flesh', { rough: 0.96 });
  const claw = mk(0xd4c8a8, 'bone', { rough: 0.45, metal: 0.15 });

  const rig = skeleton({
    hipY: 0.60, legX: 0.14, thigh: 0.28, shin: 0.26,
    spineY: 0.02, chestY: 0.17, neckY: 0.12, headY: 0.02,
    armX: 0.23, armY: 0.06, upper: 0.31, fore: 0.31,
  });
  rig.spine.rotation.x = 0.40; rig.chest.rotation.x = 0.20;
  rig.neck.rotation.x = -0.55; rig.chest.rotation.z = 0.07;
  rig.armL.rotation.x = 0.34; rig.armR.rotation.x = 0.28;

  for (const [th, sh, ft, s] of [[rig.thighL, rig.shinL, rig.footL, 1], [rig.thighR, rig.shinR, rig.footR, 2]]) {
    new Part(th).add(limb(0.28, 0.082, { jag: 0.16, seed: s }), skin).finish();
    new Part(sh).add(limb(0.26, 0.058, { jag: 0.16, seed: s + 4 }), skin).finish();
    const f = new Part(ft).add(chunk(0.068, 0.14, 1, s + 8), skin, { y: -0.02, z: 0.04, sy: 0.5, sz: 1.6 });
    for (let i = -1; i <= 1; i++) f.add(spike(0.021, 0.10, 4), claw, { x: i * 0.043, y: -0.04, z: 0.13, rx: 1.5 });
    f.finish();
  }

  new Part(rig.hips).add(chunk(0.150, 0.14, 1, 20), skin, { y: -0.03, sy: 0.58, sz: 0.85 }).finish();
  new Part(rig.spine).add(chunk(0.172, 0.13, 1, 21), skin, { y: 0.085, sy: 0.62, sz: 0.95 }).finish();

  const ch = new Part(rig.chest)
    .add(chunk(0.195, 0.12, 1, 22), skin, { y: 0.05, sy: 0.76, sz: 0.92 })
    .add(chunk(0.130, 0.11, 1, 23), belly, { y: 0.01, z: 0.115, sy: 0.85, sz: 0.6 });
  for (let i = 0; i < 4; i++) {              // 등뼈 — 실루엣을 위로 뾰족하게
    const t = i / 3;
    ch.add(spike(0.036 - t * 0.014, 0.15 - t * 0.05, 4), claw,
      { x: (i % 2 ? 0.012 : -0.012), y: 0.14 - i * 0.062, z: -0.135, rx: -0.55 + t * 0.25 });
  }
  ch.finish();

  new Part(rig.neck).add(limb(0.12, 0.058, { jag: 0.14, seed: 30 }), skin).finish();
  const hd = new Part(rig.head)
    .add(chunk(0.105, 0.11, 2, 31), skin, { y: 0.03, z: 0.02, sy: 0.88, sz: 1.28 })
    .add(chunk(0.076, 0.12, 1, 32), belly, { y: -0.025, z: 0.150, sy: 0.72, sz: 0.95 });
  for (let i = 0; i < 5; i++) {              // 이빨
    hd.add(spike(0.017, 0.055, 4), claw, { x: -0.05 + i * 0.025, y: -0.052, z: 0.185, rx: Math.PI });
  }
  hd.add(spike(0.032, 0.16, 4), claw, { x: 0.090, y: 0.100, z: -0.01, rz: -0.40, rx: -0.2 })
    .add(spike(0.027, 0.10, 4), claw, { x: -0.090, y: 0.092, z: -0.01, rz: 0.55, rx: -0.1 })
    .finish();

  // 팔 — 오른쪽이 굵고 길다. **비대칭은 남긴다.** 값이 싸고 효과가 크다
  for (const [g, k, sd] of [[rig.armL, 0.80, 40], [rig.armR, 1.20, 41]]) {
    new Part(g).add(limb(0.31, 0.070 * k, { jag: 0.16, seed: sd }), skin).finish();
  }
  for (const [g, k, sd] of [[rig.foreL, 0.80, 50], [rig.foreR, 1.18, 51]]) {
    new Part(g).add(limb(0.31, 0.056 * k, { jag: 0.16, seed: sd }), skin).finish();
  }
  for (const [g, k, sd] of [[rig.handL, 0.85, 60], [rig.handR, 1.20, 61]]) {
    const p = new Part(g).add(chunk(0.052 * k, 0.16, 1, sd), skin, { y: -0.045, sy: 0.95 });
    for (let i = -1; i <= 1; i++) {
      p.add(spike(0.025 * k, 0.14, 4), claw, { x: i * 0.05 * k, y: -0.10, z: 0.02, rx: Math.PI + 0.2 });
    }
    p.finish();
  }

  rig.weapon = rig.handR; rig.bladeMat = claw;
  rig.stance = 'ghoul';
  rig.mats = [skin, belly, claw];
  rig.eyeSpec = { color: 0xffd23a, x: 0.056, y: 0.055, z: 0.122, w: 0.032, h: 0.026 };
  return rig;
}

// ───────────────────────── 다섯 가지 칠하는 법 ─────────────────────────

/** 빛을 계단으로 끊는다. three 의 조명 계산은 그대로 두고 마지막에 한 줄만 */
function celify(mat, steps = 3, ref = 0.5) {
  mat.customProgramCacheKey = () => 'cel' + steps + ':' + ref;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSteps = { value: steps };
    sh.uniforms.uRef = { value: ref };
    sh.fragmentShader = 'uniform float uSteps; uniform float uRef;\n' + sh.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
       { // **직접광만** 끊는다. 처음에 앰비언트까지 섞어서 밝기를 재고 그걸
         // 끊었더니, 앰비언트가 크면 비율이 늘 1 근처라 **계단이 아예 안 생겼다** —
         // 셀 셰이딩이라고 붙여 놓고 화면은 A(평면)와 구분이 안 됐다
         // 그리고 **정규화가 필요하다.** three 는 물리 단위라 확산광 값이
         // albedo * 세기/π * NdotL 이고, 세기 3.2 · 알베도 0.5 면 최대가
         // 0.5 쯤이다. 그걸 그냥 0~1 로 끊으면 **거의 전부 맨 아래 칸**으로
         // 몰려서 화면이 캄캄해진다 — 실제로 그렇게 나왔다
         float l = dot(reflectedLight.directDiffuse, vec3(0.3333)) / uRef;
         float q = floor(clamp(l, 0.0, 1.0) * uSteps + 0.5) / uSteps;
         reflectedLight.directDiffuse *= l > 0.001 ? q / l : 1.0; }`);
  };
  return mat;
}

/**
 * 외곽선 — **법선 방향으로 밀어낸 뒷면.**
 *
 * 처음엔 gfx.js 처럼 메시를 복제해 월드 행렬을 1.1 배 키운 껍데기를 씌웠다.
 * **화면에 아무것도 안 나왔다.** 이유는 두 가지가 겹쳤다 —
 * 행렬을 키우면 관절 원점을 기준으로 커지므로 팔다리는 굵어지는 게 아니라
 * **아래로 늘어나고**, 게다가 그 행렬은 그 순간의 자세로 굳어서 몸이 움직이면
 * 따로 논다. 방 안의 벽처럼 안 움직이는 것에만 쓸 수 있는 방법이었다.
 *
 * 지금은 같은 부모에 같은 지오메트리를 하나 더 달고 **셰이더에서 법선 방향으로**
 * 민다. 자세를 따라오고, 미는 양에 카메라 거리를 곱하므로 **화면상 두께가
 * 일정하다** — 멀어져도 선이 가늘어지지 않는다.
 */
function outlineOf(root, thickness) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uT: { value: thickness } },
    vertexShader: `uniform float uT;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        mv.xyz += n * uT * max(-mv.z, 0.1) * 0.01;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'void main(){ gl_FragColor = vec4(0.035, 0.028, 0.055, 1.0); }',
  });
  const found = [];
  root.traverse((o) => { if (o.isMesh) found.push(o); });
  // 순회 중에 자식을 더하면 순회가 꼬인다 — 다 모으고 나서 단다
  for (const o of found) {
    const m = new THREE.Mesh(o.geometry, mat);
    m.castShadow = false; m.receiveShadow = false;
    o.parent.add(m);
  }
}

/** 몸에서 스스로 빛나는 자리 — 눈. 스타일마다 세기가 다르다 */
function addEyes(rig, spec, boost) {
  if (!spec) return;
  const mat = new THREE.MeshBasicMaterial({ color: spec.color });
  const eg = prism(spec.w, spec.h * 0.8, spec.h, spec.w, spec.h * 0.8, { hang: false, sides: 4 });
  for (const sx of [spec.x, -spec.x]) {
    const e = new THREE.Mesh(eg, mat);
    e.position.set(sx, spec.y, spec.z);
    rig.head.add(e);
    if (boost > 0) {
      const d = glowDisc(spec.color, spec.w * 6 * boost);
      d.position.set(sx, spec.y, spec.z + 0.006);
      rig.head.add(d);
    }
  }
}

/**
 * 다섯 스타일. **비용이 낮은 순으로 늘어놨다.**
 *
 *   A 평면    단색 + 부드러운 명암. 셰이더를 아예 안 쓴다
 *   B 셀      3 단계 + 검은 외곽선. 인상이 제일 크게 바뀌고 값이 거의 안 든다
 *   C 질감    물질별 절차 셰이더 + 3점 조명. 지금까지 만든 것
 *   D 역광    몸을 거의 죽이고 **뒤에서 오는 빛과 발광만** 남긴다
 *   E 도트    작게 그려서 확대 + 색 8 단계. 후처리 한 겹으로 끝난다
 */
const STYLES = [
  {
    key: 'flat', name: 'A · 평면',
    mk: (c, kind, o = {}) => new THREE.MeshStandardMaterial({
      color: c, roughness: o.rough ?? 0.9, metalness: (o.metal ?? 0) * 0.4,
    }),
    eye: 0,
    light: (sc) => {
      sc.add(new THREE.AmbientLight(0x8892a8, 1.9));
      const k = new THREE.DirectionalLight(0xfff2dc, 2.6);
      k.position.set(-2.4, 4.0, 3.2); k.castShadow = true; sc.add(k);
      const f = new THREE.DirectionalLight(0x9fb0d0, 1.0);
      f.position.set(3.0, 1.2, 1.6); sc.add(f);
    },
    bg: 0x232634,
  },
  {
    key: 'cel', name: 'B · 셀 + 외곽선',
    mk: (c, kind, o = {}) => celify(new THREE.MeshStandardMaterial({
      color: c, roughness: o.rough ?? 0.9, metalness: 0,
    }), 4, 0.62),
    eye: 0.6, outline: 0.5,   // 화면상 두께. 1.9 는 **검은 후광**이 되어 몸을 삼켰다
    light: (sc) => {
      sc.add(new THREE.AmbientLight(0x6b7691, 1.9));
      // 셀은 **점광원이 많으면 계단이 뭉개진다.** 방향광 하나로 간다
      const k = new THREE.DirectionalLight(0xffe8c8, 3.2);
      k.position.set(-2.6, 4.4, 3.0); k.castShadow = true; sc.add(k);
    },
    bg: 0x1b1f2e,
  },
  {
    key: 'mat', name: 'C · 질감',
    mk: (c, kind, o = {}) => surface(new THREE.MeshStandardMaterial({
      color: c, roughness: o.rough ?? 0.9, metalness: o.metal ?? 0,
    }), kind, { rim: 0x9fc0ff, rimAmt: 0.4, scale: kind === 'skin' ? 6.5 : kind === 'hair' ? 5 : 3.4 }),
    eye: 0.9,
    light: (sc) => {
      sc.add(new THREE.AmbientLight(0x323a52, 2.0));
      const k = new THREE.DirectionalLight(0xffe2bc, 3.2);
      k.position.set(-2.6, 4.2, 3.0); k.castShadow = true; sc.add(k);
      const r = new THREE.DirectionalLight(0xa8c8ff, 3.0);
      r.position.set(2.4, 3.0, -3.2); sc.add(r);
      const f = new THREE.DirectionalLight(0x7f8fb8, 1.1);
      f.position.set(3.2, 1.0, 2.4); sc.add(f);
    },
    bg: 0x0d0c14,
  },
  {
    key: 'noir', name: 'D · 역광',
    // 바탕색을 **죽여서** 넘긴다. 조명만 어둡게 하면 그냥 어두운 그림이고,
    // 재질까지 어두워야 **실루엣만 남는다**
    mk: (c, kind, o = {}) => {
      const col = new THREE.Color(c).multiplyScalar(0.22);
      const m = new THREE.MeshStandardMaterial({ color: col, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0 });
      return surface(m, kind, { rim: 0x8fd0ff, rimAmt: 1.5, rimPow: 2.2, scale: 3.4 });
    },
    eye: 1.6,
    light: (sc) => {
      sc.add(new THREE.AmbientLight(0x1a2030, 1.0));
      const r = new THREE.DirectionalLight(0xbcd8ff, 6.5);
      r.position.set(1.6, 3.2, -3.4); sc.add(r);
      const r2 = new THREE.DirectionalLight(0xffb070, 3.0);
      r2.position.set(-2.6, 2.0, -2.2); sc.add(r2);
      const k = new THREE.DirectionalLight(0x6a7ea8, 0.5);
      k.position.set(-2.0, 3.0, 3.0); sc.add(k);
    },
    bg: 0x060710,
  },
  {
    key: 'dot', name: 'E · 도트',
    mk: (c, kind, o = {}) => new THREE.MeshStandardMaterial({
      color: c, roughness: o.rough ?? 0.9, metalness: (o.metal ?? 0) * 0.3,
    }),
    eye: 0.5, pixel: 4,
    light: (sc) => {
      sc.add(new THREE.AmbientLight(0x7a8298, 1.7));
      const k = new THREE.DirectionalLight(0xfff0d8, 2.8);
      k.position.set(-2.4, 4.0, 3.0); k.castShadow = true; sc.add(k);
      const f = new THREE.DirectionalLight(0x90a8d0, 1.0);
      f.position.set(3.0, 1.0, 1.8); sc.add(f);
    },
    bg: 0x1c2030,
  },
];

// ───────────────────────── 장면 ─────────────────────────

const CHARS = [
  { key: 'hero', build: buildHero },
  { key: 'foe', build: buildFoe },
];

const POSE = {
  hero: {
    spine: [0, 0.14, 0], chest: [-0.05, -0.08, 0.03], head: [0.05, 0.16, 0],
    armR: [-0.55, 0, -0.30], foreR: [-1.05, 0, -0.12], handR: [0.15, 0, 0],
    armL: [-0.42, 0.25, 0.22], foreL: [-1.45, 0, 0],
    thighL: [-0.16, 0, 0.04], shinL: [0.10, 0, 0],
    thighR: [0.22, 0, -0.05], shinR: [-0.30, 0, 0], footR: [0.14, 0, 0],
  },
  foe: {
    spine: [0.16, 0.08, 0], chest: [0.10, -0.05, 0], head: [-0.10, 0.12, 0],
    armR: [-0.95, 0.30, -0.45], foreR: [-1.15, 0, -0.2], handR: [-0.3, 0, 0],
    armL: [-0.55, -0.2, 0.55], foreL: [-0.85, 0, 0.15],
    thighL: [-0.45, 0, 0.10], shinL: [0.70, 0, 0], footL: [-0.25, 0, 0],
    thighR: [0.30, 0, -0.10], shinR: [-0.55, 0, 0], footR: [0.25, 0, 0],
  },
};

function makeCell(char, st) {
  const sc = new THREE.Scene();
  sc.background = new THREE.Color(st.bg);
  const rig = char.build(st.mk);
  addEyes(rig, rig.eyeSpec, st.eye);
  for (const [n, [x, y, z]] of Object.entries(POSE[char.key])) {
    const b = rig[n]; if (!b) continue;
    b.rotation.x += x; b.rotation.y += y; b.rotation.z += z;
  }
  rig.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  sc.add(rig.group);

  // 바닥 — 그림자만 받고 가장자리는 사라진다 (꼭짓점 알파)
  const gm = new THREE.MeshStandardMaterial({
    color: st.key === 'noir' ? 0x14141c : 0x3a3844,
    roughness: 1, metalness: 0, transparent: true, vertexColors: true,
  });
  const gg = new THREE.RingGeometry(0, 2.6, 40, 6);
  const gp = gg.attributes.position;
  const col = new Float32Array(gp.count * 4);
  for (let i = 0; i < gp.count; i++) {
    const r = Math.hypot(gp.getX(i), gp.getY(i)) / 2.6;
    col.set([1, 1, 1, 1 - Math.min(1, Math.max(0, (r - 0.40) / 0.58)) ** 1.6], i * 4);
  }
  gg.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const ground = new THREE.Mesh(gg, gm);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  sc.add(ground);

  st.light(sc);
  for (const l of sc.children) {
    if (l.isDirectionalLight && l.castShadow) {
      l.shadow.mapSize.set(1024, 1024);
      const c = l.shadow.camera;
      c.left = -2.2; c.right = 2.2; c.top = 3.4; c.bottom = -0.4; c.near = 0.5; c.far = 12;
    }
  }
  if (st.outline) outlineOf(rig.group, st.outline);
  return { sc, rig };
}

const cells = [];
for (let r = 0; r < CHARS.length; r++) {
  for (let c = 0; c < COLS; c++) cells.push({ ...makeCell(CHARS[r], STYLES[c]), st: STYLES[c], row: r, col: c });
}

// 카메라 — 캐릭터마다 하나. **다섯 스타일이 같은 카메라를 쓴다**
const ASPECT = CW / CH;
const CAMS = CHARS.map((_, r) => {
  const cell = cells[r * COLS];
  const box = new THREE.Box3().setFromObject(cell.rig.group);
  const size = new THREE.Vector3(), mid = new THREE.Vector3();
  box.getSize(size); box.getCenter(mid);
  const span = Math.max(size.y, Math.hypot(size.x, size.z * 0.5) / ASPECT, 0.9) * 1.20;
  const fov = 24;
  const dist = (span * 0.5) / Math.tan((fov * Math.PI / 180) / 2);
  const cam = new THREE.PerspectiveCamera(fov, ASPECT, 0.05, 60);
  const at = new THREE.Vector3(mid.x, mid.y, 0);
  cam.position.copy(new THREE.Vector3(0.42, 0.18, 1).normalize()).multiplyScalar(dist).add(at);
  cam.lookAt(at);
  return cam;
});

// ── 도트 후처리 ──────────────────────────────────────────────
//
// 작은 렌더타깃에 그리고 **최근접**으로 확대한다. 그리고 색을 8 단계로 끊는다.
// 오프스크린이라 톤매핑·sRGB 가 안 걸리므로 **여기서 직접 한다** —
// chars.js 에서 이걸 몰라 아래줄이 세 배 어두웠다.
const DOT_FS = /* glsl */`
  uniform sampler2D tDiffuse; uniform float uExp; uniform float uLevels; varying vec2 vUv;
  vec3 rrt(vec3 v){ vec3 a=v*(v+0.0245786)-0.000090537; vec3 b=v*(0.983729*v+0.4329510)+0.238081; return a/b; }
  vec3 aces(vec3 c){
    const mat3 I = mat3(0.59719,0.07600,0.02840, 0.35458,0.90834,0.13383, 0.04823,0.01566,0.83777);
    const mat3 O = mat3(1.60475,-0.10208,-0.00327, -0.53108,1.10813,-0.07276, -0.07367,-0.00605,1.07602);
    c *= uExp / 0.6; return clamp(O * rrt(I * c), 0.0, 1.0);
  }
  vec3 srgb(vec3 c){ return mix(c*12.92, 1.055*pow(max(c,vec3(0.0)),vec3(0.41666))-0.055, step(vec3(0.0031308), c)); }
  void main(){
    vec3 c = srgb(aces(texture2D(tDiffuse, vUv).rgb));
    gl_FragColor = vec4(floor(c * uLevels + 0.5) / uLevels, 1.0);
  }`;

const dotRT = new THREE.WebGLRenderTarget(Math.round(CW / 4), Math.round(CH / 4));
dotRT.texture.minFilter = THREE.NearestFilter;
dotRT.texture.magFilter = THREE.NearestFilter;
const quadScene = new THREE.Scene();
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const dotMat = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: dotRT.texture }, uLevels: { value: 8 },
    uExp: { value: renderer.toneMappingExposure },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
  fragmentShader: DOT_FS,
});
quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dotMat));

window.STYLE_PAUSE = false;
let t = 0;
function frame() {
  requestAnimationFrame(frame);
  if (window.STYLE_PAUSE && window.STYLE_READY) return;
  t += 1 / 60;
  const yaw = Math.sin(t * 0.22) * 0.20;
  for (const c of cells) c.rig.group.rotation.y = yaw;

  for (const c of cells) {
    // GL 은 아래가 y=0 — 위줄(전사)이 y=CH 다
    const x = c.col * CW, y = c.row === 0 ? CH : 0;
    if (c.st.pixel) {
      renderer.setRenderTarget(dotRT);
      renderer.setScissorTest(false);
      renderer.render(c.sc, CAMS[c.row]);
      renderer.setRenderTarget(null);
      renderer.setScissorTest(true);
      renderer.setViewport(x, y, CW, CH);
      renderer.setScissor(x, y, CW, CH);
      renderer.render(quadScene, quadCam);
    } else {
      renderer.setViewport(x, y, CW, CH);
      renderer.setScissor(x, y, CW, CH);
      renderer.render(c.sc, CAMS[c.row]);
    }
  }
  window.STYLE_READY = true;
}
frame();
