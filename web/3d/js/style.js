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
import { prism, slab, spike, Part, skeleton } from './core/rig.js';
import { loft, limb, snout, arc } from './core/form.js';
import { surface, glowDisc } from './core/surface.js';

const COLS = 5;
const CW = 320, CH = 470;
const W = CW * COLS, H = CH * 2;

const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('c') });
renderer.setSize(W, H);
renderer.setScissorTest(true);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

// ───────────────────────── 도형 ─────────────────────────
//
// **형태는 core/form.js 가 만든다.** 이 파일에는 천 조각 하나만 남았다.
// 찌그러진 타원 덩어리(chunk)는 걷어냈다 — 골렘한테는 맞았지만 사람과
// 짐승한테는 「관절에 매단 풍선」밖에 안 됐다.
const tatter = (w, h, d = 0.02) => prism(w * 0.35, d, h, w, d, { sides: 4 });

// ───────────────────────── 몸 (둘뿐이다) ─────────────────────────
//
// **형태를 단면으로 짓는다.** (core/form.js)
//
// 앞판까지는 관절 하나에 도형 하나를 매달았다. 그래서 아무리 다듬어도
// 「관절에 풍선을 매단 것」이었다 — 어깨도 허리도 무릎도 없었다.
// 지금은 한 부위 안에서 높이마다 단면을 놓고 잇는다. 사람 몸의 실루엣은
// 전부 **한 부위 안에서 굵기가 변하는 방식**에서 나온다:
//
//   · 어깨에서 허리로 좁아졌다가 골반에서 다시 벌어진다 (V 자)
//   · 허벅지는 위가 굵고 무릎에서 잘록하다
//   · 종아리는 **위쪽 1/3 이 가장 굵다** — 가운데가 아니다
//   · 팔뚝은 팔꿈치 바로 아래가 굵고 손목에서 절반으로 준다
//
// 아래 숫자들은 그 규칙을 그대로 적은 것이다. 링 네댓 개면 다 나온다.

/**
 * 전사 — **사람이다.** 머리 여덟 개 반 키(영웅 비율), 어깨는 머리 셋 폭.
 *
 * 열린 투구에 얼굴이 보인다. 다만 이목구비를 세공하지는 않는다 —
 * 이 크기에서 얼굴로 읽히는 것은 **눈두덩 그늘 · 코의 능선 · 수염 덩어리**
 * 셋이고, 그 셋의 위치만 맞으면 사람이 된다.
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
    hipY: 0.98, legX: 0.15, thigh: 0.44, shin: 0.42,
    spineY: 0.04, chestY: 0.24, neckY: 0.22, headY: 0.1,
    armX: 0.29, armY: 0.12, upper: 0.32, fore: 0.30,
  });

  // ── 다리 ──
  // 허벅지: 사타구니 쪽이 제일 굵고 무릎에서 2/3 로 준다
  // 종아리: **위에서 1/4 지점이 최대.** 가운데를 최대로 하면 소시지가 된다
  for (const [th, sh, ft] of [[rig.thighL, rig.shinL, rig.footL], [rig.thighR, rig.shinR, rig.footR]]) {
    new Part(th).add(limb(0.44, [
      [0.00, 0.235, 0.245], [0.16, 0.240, 0.250], [0.62, 0.190, 0.205], [1.00, 0.160, 0.175],
    ], { round: 2.3 }), dark)
      .add(loft([{ y: -0.30, w: 0.20, d: 0.115 }, { y: -0.16, w: 0.235, d: 0.13 }, { y: -0.02, w: 0.215, d: 0.12 }],
        { round: 3.2 }), steel, { z: 0.075 })       // 넓적다리 판
      .finish();
    new Part(sh).add(limb(0.42, [
      [0.00, 0.170, 0.185], [0.24, 0.190, 0.205], [0.70, 0.120, 0.135], [1.00, 0.098, 0.115],
    ], { round: 2.3 }), dark)
      .add(loft([{ y: -0.30, w: 0.135, d: 0.10 }, { y: -0.16, w: 0.175, d: 0.12 }, { y: -0.01, w: 0.185, d: 0.125 }],
        { round: 3.4 }), steel, { z: 0.055 })        // 정강이받이
      .add(loft([{ y: -0.06, w: 0.145, d: 0.10 }, { y: 0.01, w: 0.185, d: 0.13 }, { y: 0.06, w: 0.155, d: 0.11 }],
        { round: 3.0 }), steel, { z: 0.03 })         // 무릎덮개
      .finish();
    // 발 — 앞으로 뻗고 앞코가 좁다. 발등이 발목보다 낮아야 「선 발」이다
    new Part(ft).add(snout(0.30, [
      [0.00, 0.135, 0.115], [0.30, 0.150, 0.135], [0.80, 0.115, 0.095], [1.00, 0.060, 0.055],
    ], { round: 2.8 }), steel, { y: -0.055, z: -0.06 }).finish();
  }

  // ── 골반 ── 위는 허리로 좁아지고 아래는 다시 벌어진다
  new Part(rig.hips)
    .add(loft([
      { y: -0.16, w: 0.29, d: 0.215 }, { y: -0.07, w: 0.345, d: 0.245 },
      { y: 0.02, w: 0.325, d: 0.225 }, { y: 0.07, w: 0.300, d: 0.205 },
    ], { round: 2.9 }), dark)
    .add(arc(0.175, 0.028, Math.PI * 2, 18), gold, { y: 0.035, rx: Math.PI / 2, sz: 0.78 })
    .add(tatter(0.17, 0.32), cloth, { y: 0.02, z: 0.135 })
    .finish();

  // ── 허리 ── **여기가 제일 가늘다.** V 자의 아래 꼭짓점
  new Part(rig.spine)
    .add(loft([
      { y: -0.02, w: 0.310, d: 0.215 }, { y: 0.09, w: 0.295, d: 0.200 },
      { y: 0.24, w: 0.360, d: 0.230 },
    ], { round: 2.9 }), steel)
    .finish();

  // ── 가슴 ── 위로 갈수록 벌어졌다가 목 밑에서 접힌다
  const ch = new Part(rig.chest)
    // **높이가 관절과 맞아야 한다.** 처음에 위쪽 단을 0.34 까지 올렸는데,
    // 목 관절이 로컬 0.22 · 머리가 0.32 라서 **가슴이 머리를 통째로 삼켰다.**
    // 화면에는 목 없는 갑옷 덩어리가 나왔다 — 단면 높이는 장식이 아니라
    // 골격과 맞물리는 치수다
    .add(loft([
      { y: 0.00, w: 0.360, d: 0.230 }, { y: 0.07, w: 0.455, d: 0.265 },
      { y: 0.135, w: 0.495, d: 0.265 }, { y: 0.185, w: 0.430, d: 0.235 },
      { y: 0.220, w: 0.290, d: 0.190 },
    ], { round: 3.0 }), steel)
    // 가슴받이 — 몸통보다 살짝 앞에 덧댄 판. 두 겹이라야 「입은 것」이다
    .add(loft([
      { y: 0.01, w: 0.230, d: 0.09 }, { y: 0.09, w: 0.320, d: 0.10 }, { y: 0.165, w: 0.300, d: 0.09 },
    ], { round: 3.4 }), steel, { z: 0.10 })
    .add(slab(0.10, 0.15, 0.03, 0.02), gold, { y: 0.10, z: 0.165 })
    .add(arc(0.145, 0.015, Math.PI, 14), gold, { y: 0.195, z: 0.055, rx: Math.PI / 2 });
  for (let i = 0; i < 3; i++) {                 // 망토 — 세 장이면 충분하다
    const t = i - 1;
    ch.add(tatter(0.21, 0.60 - Math.abs(t) * 0.10), cloth,
      { x: t * 0.185, y: 0.10, z: -0.14, rx: 0.12, rz: -t * 0.14 });
  }
  ch.finish();

  // ── 팔 ── 어깨(삼각근)에서 팔꿈치로 좁아지고, 팔뚝은 **팔꿈치 바로 아래**가 굵다
  for (const [g, s] of [[rig.armL, 1], [rig.armR, -1]]) {
    new Part(g)
      .add(limb(0.32, [
        [0.00, 0.175, 0.180], [0.18, 0.190, 0.190], [0.70, 0.140, 0.145], [1.00, 0.128, 0.135],
      ], { round: 2.3 }), dark)
      // 어깨 갑주 — 위가 넓고 아래로 접힌 그릇 모양
      .add(loft([
        { y: -0.145, w: 0.245, d: 0.245 }, { y: -0.06, w: 0.310, d: 0.300 },
        { y: 0.035, w: 0.300, d: 0.290 }, { y: 0.085, w: 0.215, d: 0.210 },
      ], { round: 2.6, capB: false }), steel, { rz: s * 0.15 })
      .add(arc(0.155, 0.026, Math.PI * 1.4, 16), gold, { y: -0.055, rx: Math.PI / 2, rz: s * 0.15 })
      .add(spike(0.034, 0.13, 5), gold, { x: s * 0.15, y: 0.03, rz: s * 0.95 })
      .finish();
  }
  for (const g of [rig.foreL, rig.foreR]) {
    new Part(g)
      .add(limb(0.30, [
        [0.00, 0.135, 0.145], [0.22, 0.152, 0.158], [0.75, 0.090, 0.098], [1.00, 0.078, 0.085],
      ], { round: 2.3 }), dark)
      .add(loft([{ y: -0.26, w: 0.100, d: 0.075 }, { y: -0.15, w: 0.150, d: 0.105 }, { y: -0.03, w: 0.165, d: 0.115 }],
        { round: 3.2 }), steel, { z: 0.035 })       // 팔뚝받이
      .finish();
  }
  // 손 — 손등 판 하나 + 주먹. 손가락은 이 크기에서 안 보인다
  for (const g of [rig.handL, rig.handR]) {
    new Part(g).add(limb(0.14, [
      [0.00, 0.105, 0.115], [0.45, 0.125, 0.135], [1.00, 0.100, 0.110],
    ], { round: 3.0 }), steel).finish();
  }

  // ── 목 ── 살이 보여야 머리와 몸이 이어진다. 뒤는 목가리개로 가린다
  new Part(rig.neck)
    .add(limb(0.12, [[0, 0.115, 0.115], [1, 0.105, 0.105]], { round: 2.2 }), skin)
    .add(arc(0.108, 0.018, Math.PI * 1.25, 14), steel, { y: -0.045, rx: Math.PI / 2, ry: Math.PI })
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
  // 눈두덩 그늘 · 눈 — 어두운 구멍 둘. 사람 눈은 **빛나면 안 된다**
  new Part(rig.head)
    .add(arc(0.082, 0.017, Math.PI, 12), skin, { y: 0.075, z: 0.070, rx: Math.PI / 2, ry: Math.PI / 2 })
    // 눈은 **판이 아니라 구멍**이라 그늘에 묻히기 쉽다. 확대해 보니
    // 수염과 구분이 안 됐다 — 조금 키우고 앞으로 낸다
    .mirror(loft([{ y: -0.017, w: 0.060, d: 0.034 }, { y: 0.016, w: 0.050, d: 0.028 }], { round: 2.2, seg: 10 }),
      dark, { x: 0.048, y: 0.044, z: 0.092 })
    // 수염 — 턱을 감싼다. 턱선이 무거워야 「어른」으로 보인다
    .add(loft([
      { y: -0.105, w: 0.128, d: 0.150, cz: 0.012 },
      { y: -0.050, w: 0.180, d: 0.212, cz: 0.010 },
      { y: 0.005, w: 0.196, d: 0.230 },
    ], { round: 2.4, capT: false }), hair, { z: -0.004 })
    // 뒷머리
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
    ], { round: 3.0 }), steel, { x: 0.108, cz: 0 })
    .add(loft([{ y: -0.035, w: 0.030, d: 0.045 }, { y: 0.085, w: 0.036, d: 0.050 }], { round: 3.0 }),
      steel, { z: 0.115 })                                    // 콧대
    .add(arc(0.150, 0.016, Math.PI * 2, 20), gold, { y: 0.094, rx: Math.PI / 2, sz: 1.06 })
    .add(spike(0.032, 0.125, 5), gold, { x: 0.115, y: 0.185, rz: -0.45 })
    .add(spike(0.032, 0.125, 5), gold, { x: -0.115, y: 0.185, rz: 0.45 });
  for (let i = 0; i < 4; i++) {
    helm.add(tatter(0.055, 0.12), cloth, { y: 0.225, z: 0.01 - i * 0.05, rx: -0.25 - i * 0.07 });
  }
  helm.finish();

  // ── 방패 ── 아래가 뾰족한 연꼴. 가운데가 앞으로 볼록해야 판때기가 아니다
  const sm = new THREE.Group();
  sm.position.set(0, -0.16, 0.04); sm.rotation.x = 1.45;
  rig.foreL.add(sm);
  new Part(sm)
    .add(loft([
      { y: -0.30, w: 0.075, d: 0.045 }, { y: -0.16, w: 0.300, d: 0.070 },
      { y: 0.00, w: 0.380, d: 0.085 }, { y: 0.14, w: 0.360, d: 0.070 }, { y: 0.20, w: 0.300, d: 0.050 },
    ], { round: 2.8 }), dark, { y: -0.02, z: 0.12, ry: -0.34 })
    .add(arc(0.058, 0.020, Math.PI * 2, 14), gold, { y: -0.02, z: 0.165, ry: -0.34 })
    .add(loft([{ y: 0.0, w: 0.085, d: 0.085 }, { y: 0.05, w: 0.045, d: 0.045 }], { round: 2.2 }),
      steel, { y: -0.02, z: 0.155, rx: Math.PI / 2, ry: -0.34 })
    .finish();
  rig.shield = sm;

  // ── 검 ── 등에 맨다. 칼집 + 그 안의 검 + 어깨 너머로 나온 자루.
  //
  // 날은 **끝으로 갈수록 좁아지고 얇아진다.** 균일한 막대는 자가 된다.
  // 대각선으로 매야 어깨 너머로 삐져나오는 선이 생긴다 — 세로로 매면
  // 망토에 묻혀서 등에 아무것도 없는 것과 같아진다.
  const sw = new THREE.Group();
  // 자루가 **머리 뒤를 가로지르면 안 된다.** 처음 높이(0.06)에서는 자루가
  // 투구 뒤로 십자를 그어서 「등에 맨 검」이 아니라 「머리에 꽂힌 것」이 됐다.
  // 내려서 어깨 너머로만 나오게 한다
  sw.position.set(-0.02, -0.04, -0.155);
  sw.rotation.set(-0.20, 0, 0.50);
  new Part(sw)
    // 칼집 — 검보다 살짝 굵고 끝이 막혔다
    .add(loft([
      { y: -0.36, w: 0.055, d: 0.034 }, { y: -0.28, w: 0.080, d: 0.048 },
      { y: 0.20, w: 0.094, d: 0.054 }, { y: 0.28, w: 0.088, d: 0.050 },
    ], { round: 3.4, seg: 10 }), dark)
    .add(arc(0.050, 0.013, Math.PI * 2, 10), gold, { y: 0.26, rx: Math.PI / 2, sz: 0.6 })
    .add(arc(0.042, 0.013, Math.PI * 2, 10), gold, { y: -0.26, rx: Math.PI / 2, sz: 0.6 })
    .finish();
  new Part(sw)
    // 칼집 밖으로 나온 부분만 보인다 — 코등이 · 자루 · 자루끝
    .add(loft([
      { y: 0.28, w: 0.086, d: 0.026 }, { y: 0.33, w: 0.084, d: 0.025 },
    ], { round: 3.6 }), blade)
    .add(slab(0.26, 0.048, 0.048, 0.014), gold, { y: 0.35 })
    .add(limb(0.17, [[0, 0.042, 0.036], [0.5, 0.036, 0.030], [1, 0.044, 0.038]], { round: 2.6 }), dark, { y: 0.52 })
    .add(loft([{ y: 0.52, w: 0.05, d: 0.05 }, { y: 0.56, w: 0.078, d: 0.072 }, { y: 0.59, w: 0.05, d: 0.05 }],
      { round: 2.2 }), gold)
    .finish();
  rig.chest.add(sw);
  rig.weapon = sw; rig.bladeMat = blade;
  rig.stance = 'knight';
  rig.mats = [skin, hair, steel, dark, gold, cloth, blade];
  return rig;
}

/**
 * 구울 — **짐승 비율.** 사람과 다르게 만드는 것은 세 가지다.
 *
 *   · 가슴이 골반보다 훨씬 굵다 (사람은 어깨가 넓고 가슴은 얇다)
 *   · **팔이 다리보다 길다.** 그래서 앞으로 짚는 자세가 자연스럽다
 *   · 머리가 몸보다 **앞에** 있다 — 목이 앞으로 뻗는다
 *
 * 좌우 비대칭은 남긴다. 오른팔이 굵고 길다. 값이 싸고 효과가 크다.
 */
function buildFoe(mk) {
  const skin = mk(0x64714b, 'flesh', { rough: 0.95 });
  const belly = mk(0x8e9769, 'flesh', { rough: 0.96 });
  const claw = mk(0xd4c8a8, 'bone', { rough: 0.45, metal: 0.15 });

  const rig = skeleton({
    hipY: 0.62, legX: 0.145, thigh: 0.30, shin: 0.27,
    // 목을 늘리고 머리를 올렸다. 짐승은 **머리가 몸보다 앞에** 있어야 하는데,
    // 목이 짧으면 아무리 각도를 줘도 어깨 사이에 파묻힌다
    spineY: 0.02, chestY: 0.17, neckY: 0.17, headY: 0.07,
    armX: 0.235, armY: 0.06, upper: 0.34, fore: 0.33,
  });
  rig.spine.rotation.x = 0.42; rig.chest.rotation.x = 0.18;
  rig.neck.rotation.x = -0.62; rig.chest.rotation.z = 0.06;
  rig.armL.rotation.x = 0.32; rig.armR.rotation.x = 0.26;

  // 다리 — 짐승은 허벅지가 아주 굵고 정강이가 가늘다(도약용)
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

  // 몸통 — 아래(허리)가 가늘고 위(가슴)로 갈수록 크게 부푼다
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
  for (let i = 0; i < 4; i++) {              // 등뼈 — 실루엣을 위로 뾰족하게
    const t = i / 3;
    ch.add(spike(0.036 - t * 0.013, 0.155 - t * 0.05, 4), claw,
      { x: (i % 2 ? 0.012 : -0.012), y: 0.135 - i * 0.052, z: -0.135 - t * 0.01, rx: -0.55 + t * 0.25 });
  }
  ch.finish();

  // 목 — 앞으로 뻗는다. 머리가 몸보다 앞에 오게 하는 것이 이 짐승의 핵심
  new Part(rig.neck).add(limb(0.18, [
    [0, 0.145, 0.155], [0.5, 0.135, 0.145], [1, 0.120, 0.130],
  ], { round: 2.2 }), skin).finish();

  // 머리 — 두개골(세로 loft) + 주둥이(가로 loft). 둘을 나눠야 「주둥이」가 된다
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
    hd.add(spike(0.017, 0.060, 4), claw, { x, y: -0.030, z: 0.150 + Math.abs(i - 2) * -0.008, rx: Math.PI });
    hd.add(spike(0.014, 0.045, 4), claw, { x, y: -0.072, z: 0.145 });
  }
  hd.add(spike(0.033, 0.17, 4), claw, { x: 0.092, y: 0.095, z: -0.02, rz: -0.40, rx: -0.25 })
    .add(spike(0.027, 0.11, 4), claw, { x: -0.092, y: 0.088, z: -0.02, rz: 0.55, rx: -0.12 })
    .finish();

  // 팔 — 오른쪽이 굵고 길다
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
  for (const [g, k] of [[rig.handL, 0.85], [rig.handR, 1.20]]) {
    const p = new Part(g).add(limb(0.13, [
      [0.00, 0.085 * k, 0.095 * k], [0.50, 0.105 * k, 0.115 * k], [1.00, 0.080 * k, 0.090 * k],
    ], { round: 2.6 }), skin);
    for (let i = -1; i <= 1; i++) {
      p.add(spike(0.024 * k, 0.145, 4), claw, { x: i * 0.048 * k, y: -0.105, z: 0.015, rx: Math.PI + 0.22 });
    }
    p.finish();
  }

  rig.weapon = rig.handR; rig.bladeMat = claw;
  rig.stance = 'ghoul';
  rig.mats = [skin, belly, claw];
  rig.eyeSpec = { color: 0xffd23a, x: 0.055, y: 0.040, z: 0.115, w: 0.030, h: 0.024 };
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
    // **검을 앞으로 뻗지 않는다.** 팔을 수평으로 내밀면 「겨눔」이 아니라
    // 「무언가를 가리키는 사람」으로 보인다 — 정지 컷에서 제일 어색한 자세다.
    // 검은 등에 매고 오른팔은 자연스럽게 내린다. 왼팔의 방패만 살짝 올려서
    // 「싸울 준비는 되어 있다」를 남긴다
    spine: [0, 0.14, 0], chest: [-0.05, -0.08, 0.03], head: [0.05, 0.16, 0],
    armR: [0.10, 0, -0.16], foreR: [-0.32, 0, -0.10], handR: [0.10, 0, 0],
    armL: [-0.30, 0.22, 0.20], foreL: [-1.30, 0, 0],
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
//
// `?closeup=1` — 얼굴만 크게. 전신 컷은 **실루엣**을 묻고 확대 컷은
// **형태**를 묻는다. 320 픽셀 칸에서 얼굴은 스무 픽셀이라, 얼굴이 제대로
// 만들어졌는지는 전신 컷으로는 판정이 안 된다
const CLOSEUP = new URLSearchParams(location.search).get('closeup') === '1';
const ASPECT = CW / CH;
const CAMS = CHARS.map((_, r) => {
  const cell = cells[r * COLS];
  const box = new THREE.Box3().setFromObject(cell.rig.group);
  const size = new THREE.Vector3(), mid = new THREE.Vector3();
  box.getSize(size); box.getCenter(mid);
  let span = Math.max(size.y, Math.hypot(size.x, size.z * 0.5) / ASPECT, 0.9) * 1.20;
  let aimY = mid.y, aimZ = 0;
  if (CLOSEUP) {
    // **머리 관절의 실제 위치**로 겨눈다. 경계상자 위쪽을 쓰면 검끝·뿔이
    // 꼭대기라 얼굴이 화면 밖으로 나간다
    const hp = new THREE.Vector3();
    cell.rig.head.getWorldPosition(hp);
    span *= 0.30; aimY = hp.y; aimZ = hp.z;
  }
  const fov = 24;
  const dist = (span * 0.5) / Math.tan((fov * Math.PI / 180) / 2);
  const cam = new THREE.PerspectiveCamera(fov, ASPECT, 0.02, 60);
  const at = new THREE.Vector3(mid.x, aimY, aimZ);
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
