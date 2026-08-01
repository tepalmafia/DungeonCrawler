// 리니지 초창기 화풍 시제품 — 캐릭터·몬스터를 그 언어로 다시 짓는다.
//
// **1차는 추측으로 지었고 틀렸다.** 실제 참고 이미지(글루디오 영지·글루디오
// 던전 3층·필드 전투·캐릭터 근접)를 받아보고 네 가지를 뒤집었다:
//
//  1. 비율 — 과장된 4.5등신으로 지었는데, 실제는 **날씬한 6~7등신**이다.
//     머리도 견갑도 과장이 거의 없다. 화면에서 아주 작게 보이는 대신
//     「색 덩어리」로 읽힌다. 그래서 머리를 줄이고 팔다리를 가늘게 다시 잡았다.
//  2. 음영 — 4단계 셀 음영으로 지었는데, 실제는 **부드럽게 칠한** 음영이라
//     계단이 안 보인다. 그라디언트를 8단계로 늘려 경계를 지웠다.
//  3. 환경 채도 — 따뜻한 사암으로 지었는데, 실제 던전은 **거의 무채색**이다.
//     채도가 높은 건 오직 캐릭터뿐이고, 그 대비가 이 그림의 핵심이다.
//  4. 바닥 — 정사각 타일 격자로 지었는데, 실제는 **격자가 아예 없다.**
//     물결치는 유기적 흙·바위다. 줄눈을 지우고 등고선형 얼룩으로 바꿨다.
//
// 남은 원칙 하나는 맞았다: 종족마다 실루엣이 겹치지 않아야 한다 —
// 해골은 가늘고, 좀비는 굽었고, 오크는 어깨가 넓고, 골렘은 각지고 크다.
//
// 외부 에셋 0 — 전부 코드로 조립한다. 참고 이미지는 저장소에 넣지 않는다.

import * as THREE from 'three';
import { makeRng } from '../core/rng.js';

// ── 팔레트 ────────────────────────────────────────────────
// 따뜻한 흙빛 바탕에 강조색 하나. 채도를 전부 올리면 그 시절이 아니라 캐주얼이 된다.
export const PAL = {
  steel: 0xd6dae2, steelDark: 0x8d94a2,     // 은백 — 어둠 속에서 이것만 튄다
  crimson: 0xc02a34, gold: 0xd9ad46,
  leather: 0x8a6038, leatherDark: 0x5f4126,
  skin: 0xd9a878,
  bone: 0xe6dcc0, boneDark: 0xb8ac8c,
  rot: 0x8d9182, rotDark: 0x5a5f50,          // 좀비 — 핏기 없는 회녹빛
  corpseRag: 0x4a3f4e,
  orc: 0x7d9455, orcDark: 0x556634,
  stone: 0x6f6a5e, stoneDark: 0x494539,     // 환경은 채도를 뺀다
  cloth: 0x6a5a78, rust: 0x9a6a3a,
  shadow: 0x2a2018,
  ember: 0xff7a3a, soul: 0x9a5aff,
};

// ── 계단형 음영 ────────────────────────────────────────────
// 참고 이미지의 스프라이트는 계단이 보이지 않는 「칠한」 음영이다.
// 4단계로는 셀셰이딩이 되어 다른 시대의 그림이 된다 → 8단계로 경계를 지운다.
let GRAD = null;
export function toonGradient() {
  if (GRAD) return GRAD;
  const steps = new Uint8Array([48, 72, 98, 124, 150, 174, 196, 215]);
  GRAD = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter;
  GRAD.generateMipmaps = false;
  GRAD.needsUpdate = true;
  return GRAD;
}

const MATS = [];
export function toon(color, opt = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...opt });
  MATS.push(m);
  return m;
}
export function disposeMats() { for (const m of MATS) m.dispose(); MATS.length = 0; }

// ── 파츠 헬퍼 ──────────────────────────────────────────────
const GEOS = [];
const keep = (g) => { GEOS.push(g); return g; };
export function disposeGeos() { for (const g of GEOS) g.dispose(); GEOS.length = 0; }

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), mat);
  m.position.set(x, y, z);
  return m;
}
function cyl(rt, rb, h, seg, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(keep(new THREE.CylinderGeometry(rt, rb, h, seg)), mat);
  m.position.set(x, y, z);
  return m;
}
function sph(r, mat, x = 0, y = 0, z = 0, seg = 10) {
  const m = new THREE.Mesh(keep(new THREE.SphereGeometry(r, seg, seg - 2)), mat);
  m.position.set(x, y, z);
  return m;
}
function cone(r, h, seg, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(keep(new THREE.ConeGeometry(r, h, seg)), mat);
  m.position.set(x, y, z);
  return m;
}

function finish(g) {
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ══════════════════════════════════════════════════════════
//  사람 비율 — 참고 이미지 기준 약 6.5~7 등신.
//  머리 지름 0.25 · 총 키 1.72 가 기준이고, 팔다리는 가늘다.
//  1차에서 과장했던 견갑·투구를 실제 크기로 되돌렸다.
// ══════════════════════════════════════════════════════════
const H = { head: 0.125, tall: 1.72 };

/** 사람형 골격 — 종족마다 굵기·색만 바꿔 쓴다 */
function humanoid({ skin, cloth, limb, broad = 1, thin = 1 }) {
  const g = new THREE.Group();
  const r = (v) => v * thin;
  for (const sx of [-1, 1]) {
    g.add(cyl(r(0.072), r(0.058), 0.7, 6, limb, sx * 0.098, 0.37));
    g.add(box(r(0.15), 0.075, 0.21, limb, sx * 0.1, 0.045, 0.035));
  }
  g.add(cyl(r(0.155), r(0.145), 0.14, 7, cloth, 0, 0.79));            // 골반
  g.add(cyl(r(0.19 * broad), r(0.15), 0.46, 8, cloth, 0, 1.08));      // 흉곽
  for (const sx of [-1, 1]) {
    const p = sph(r(0.098 * broad), cloth, sx * 0.2 * broad, 1.27, 0, 8);
    p.scale.set(1, 0.72, 1);
    g.add(p);
    g.add(cyl(r(0.049), r(0.042), 0.5, 6, limb, sx * 0.215 * broad, 1.04, 0.015));
  }
  g.add(cyl(r(0.045), r(0.045), 0.08, 6, skin, 0, 1.35));             // 목
  const head = sph(H.head, skin, 0, 1.47, 0.005, 10);
  head.scale.set(1, 1.06, 0.98);
  g.add(head);
  return { g, headY: 1.47 };
}

// ══════════════════════════════════════════════════════════
//  기사 — 플레이어
//  어두운 배경에서 「은백 + 진홍」 두 색만으로 읽혀야 한다.
//  참고 이미지의 기사·요정이 정확히 그 방식이다.
// ══════════════════════════════════════════════════════════
export function buildKnightL() {
  const steel = toon(PAL.steel), dark = toon(PAL.steelDark);
  const red = toon(PAL.crimson), gold = toon(PAL.gold), skin = toon(PAL.skin);
  const { g } = humanoid({ skin, cloth: steel, limb: dark, broad: 1.05 });

  g.add(cyl(0.16, 0.16, 0.055, 8, gold, 0, 0.86));                    // 허리띠
  // 투구 — 머리보다 아주 조금 크다. 1차에서는 여기를 과장해 인형이 됐다.
  const helm = sph(0.133, steel, 0, 1.49, 0, 10);
  helm.scale.set(1, 1.04, 1.02);
  g.add(helm);
  g.add(box(0.25, 0.035, 0.04, gold, 0, 1.46, 0.11));                 // 이마 금띠
  g.add(box(0.05, 0.16, 0.05, red, 0, 1.64, -0.03));                  // 짧은 깃
  // 망토 — 어깨에서 종아리까지. 뒤에서 보면 붉은 면이 크게 잡힌다
  const cloak = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(0.17, 0.31, 0.92, 8, 1, true)),
    toon(PAL.crimson, { side: THREE.DoubleSide }));
  cloak.position.set(0, 0.92, -0.13);
  g.add(cloak);
  // 롱소드
  const sw = new THREE.Group();
  sw.position.set(0.26, 1.06, 0.1);
  sw.rotation.z = -0.34;
  sw.add(box(0.068, 0.88, 0.03, steel, 0, 0.5));
  sw.add(box(0.24, 0.055, 0.07, gold, 0, 0.06));
  sw.add(cyl(0.032, 0.036, 0.18, 6, dark, 0, -0.05));
  g.add(sw);
  // 카이트 실드
  const sh = new THREE.Group();
  sh.position.set(-0.28, 1.04, 0.12);
  sh.rotation.z = 0.1;
  const plate = cyl(0.185, 0.185, 0.045, 8, red, 0, 0.04);
  plate.rotation.x = Math.PI / 2;
  const tip = cone(0.185, 0.22, 8, red, 0, -0.15);
  tip.rotation.x = Math.PI / 2;
  tip.rotation.z = Math.PI;
  sh.add(plate, tip);
  sh.add(sph(0.045, gold, 0, 0.04, 0.045, 6));
  g.add(sh);

  return finish(g);
}

// ══════════════════════════════════════════════════════════
//  해골 — 가늘다. 뼈 사이가 비어 보여야 한다.
// ══════════════════════════════════════════════════════════
export function buildSkeletonL() {
  const g = new THREE.Group();
  const bone = toon(PAL.bone), dk = toon(PAL.boneDark), rust = toon(PAL.rust);

  for (const sx of [-1, 1]) {
    g.add(cyl(0.042, 0.034, 0.66, 6, bone, sx * 0.09, 0.35));
    g.add(box(0.12, 0.06, 0.19, dk, sx * 0.09, 0.04, 0.03));
  }
  g.add(cyl(0.045, 0.055, 0.52, 6, bone, 0, 0.94));                   // 척추
  for (let i = 0; i < 4; i++) {
    const r = new THREE.Mesh(keep(new THREE.TorusGeometry(0.125 - i * 0.016, 0.018, 4, 9)), bone);
    r.position.y = 0.82 + i * 0.115;
    r.rotation.x = Math.PI / 2;
    r.scale.z = 0.6;
    g.add(r);
  }
  g.add(cyl(0.13, 0.12, 0.1, 7, dk, 0, 0.68));                        // 골반
  for (const sx of [-1, 1]) {
    g.add(box(0.17, 0.035, 0.035, bone, sx * 0.1, 1.26, 0));
    g.add(cyl(0.032, 0.027, 0.48, 5, bone, sx * 0.185, 1.03, 0.015));
  }
  const skull = sph(0.115, bone, 0, 1.44, 0.005, 9);
  skull.scale.set(1, 1.1, 1.03);
  g.add(skull);
  g.add(box(0.12, 0.05, 0.1, bone, 0, 1.35, 0.03));
  const eye = toon(PAL.ember, { emissive: PAL.ember, emissiveIntensity: 0.9 });
  for (const sx of [-1, 1]) g.add(sph(0.024, eye, sx * 0.045, 1.46, 0.098, 6));
  // 녹슨 시미터
  const sw = new THREE.Group();
  sw.position.set(0.21, 1.02, 0.06);
  sw.rotation.z = -0.7;
  for (let i = 0; i < 3; i++) {
    const b = box(0.055, 0.26, 0.022, rust, i * 0.028, 0.24 + i * 0.235, 0);
    b.rotation.z = -i * 0.13;
    sw.add(b);
  }
  sw.add(box(0.16, 0.045, 0.05, dk, 0, 0.08));
  g.add(sw);
  const shield = cyl(0.145, 0.145, 0.04, 8, toon(PAL.leatherDark), -0.23, 1.02, 0.1);
  shield.rotation.x = Math.PI / 2;
  g.add(shield);

  return finish(g);
}

// ══════════════════════════════════════════════════════════
//  좀비 — 굽었다. 이 각도 하나가 「살아있지 않다」의 전부다.
// ══════════════════════════════════════════════════════════
export function buildZombieL() {
  const g = new THREE.Group();
  const rot = toon(PAL.rot), dk = toon(PAL.rotDark), rag = toon(PAL.corpseRag);

  for (const sx of [-1, 1]) {
    const leg = cyl(0.075, 0.06, 0.62, 6, dk, sx * 0.095, 0.33);
    leg.rotation.z = sx * 0.07;
    g.add(leg);
    g.add(box(0.14, 0.07, 0.2, dk, sx * 0.1, 0.04, 0.035));
  }
  const torso = new THREE.Group();
  torso.position.set(0, 0.62, 0);
  torso.rotation.x = 0.44;
  torso.add(cyl(0.185, 0.16, 0.48, 7, rot, 0, 0.24));
  const shirt = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(0.2, 0.22, 0.3, 7, 1, true)),
    toon(PAL.corpseRag, { side: THREE.DoubleSide }));
  shirt.position.y = 0.14;
  torso.add(shirt);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.2, 0.44, 0.02);
    arm.rotation.x = -1.0 - (sx > 0 ? 0.28 : 0);
    arm.rotation.z = sx * 0.14;
    arm.add(cyl(0.052, 0.043, 0.52, 6, rot, 0, -0.25));
    arm.add(sph(0.055, dk, 0, -0.52, 0, 7));
    torso.add(arm);
  }
  const head = sph(0.122, rot, 0, 0.68, 0.03, 9);
  head.scale.set(1, 1.04, 0.96);
  head.rotation.z = 0.3;
  torso.add(head);
  const eye = toon(0x14100c);
  for (const sx of [-1, 1]) torso.add(sph(0.022, eye, sx * 0.045, 0.7, 0.11, 6));
  torso.add(box(0.12, 0.025, 0.025, rag, 0, 0.74, 0.075));

  g.add(torso);
  return finish(g);
}

// ══════════════════════════════════════════════════════════
//  오크 궁수 — 어깨가 넓고 다리가 짧다. 사람보다 굵되 인형은 아니다.
// ══════════════════════════════════════════════════════════
export function buildOrcArcherL() {
  const skin = toon(PAL.orc), dk = toon(PAL.orcDark);
  const lea = toon(PAL.leather), leaD = toon(PAL.leatherDark), bone = toon(PAL.bone);
  const { g } = humanoid({ skin, cloth: skin, limb: skin, broad: 1.32, thin: 1.25 });

  g.add(cyl(0.22, 0.2, 0.1, 7, lea, 0, 0.82));                        // 허리 가죽
  const strap = box(0.09, 0.5, 0.3, lea, -0.06, 1.1, 0);              // 어깨끈 하나
  strap.rotation.z = 0.45;
  g.add(strap);
  // 아래턱이 앞으로 나오고 엄니가 위로 솟는다 — 오크의 전부
  g.add(box(0.17, 0.075, 0.1, dk, 0, 1.4, 0.09));
  for (const sx of [-1, 1]) {
    const t = cone(0.024, 0.09, 5, bone, sx * 0.052, 1.43, 0.115);
    t.rotation.x = -0.18;
    g.add(t);
  }
  for (const sx of [-1, 1]) {
    const e = cone(0.035, 0.11, 5, skin, sx * 0.135, 1.5, -0.015);
    e.rotation.z = sx * 1.15;
    g.add(e);
  }
  const eye = toon(0xf2d24a, { emissive: 0xf2d24a, emissiveIntensity: 0.5 });
  for (const sx of [-1, 1]) g.add(sph(0.02, eye, sx * 0.05, 1.49, 0.115, 6));
  // 짧은 활
  const bow = new THREE.Group();
  bow.position.set(0.33, 1.06, 0.12);
  bow.rotation.z = 0.22;
  for (const sy of [-1, 1]) {
    const limb = box(0.036, 0.34, 0.045, leaD, 0, sy * 0.18, 0);
    limb.rotation.z = sy * 0.3;
    bow.add(limb);
  }
  bow.add(box(0.01, 0.66, 0.01, bone, 0.08, 0, 0));
  g.add(bow);
  const q = cyl(0.065, 0.058, 0.28, 6, lea, -0.13, 1.12, -0.16);
  q.rotation.set(0.28, 0, -0.28);
  g.add(q);
  for (let i = 0; i < 3; i++)
    g.add(box(0.014, 0.16, 0.014, bone, -0.11 + i * 0.03, 1.3, -0.19));

  return finish(g);
}

// ══════════════════════════════════════════════════════════
//  스톤 골렘 — 각지고 크다. 사람 옆에 서면 두 배는 되어야 한다.
// ══════════════════════════════════════════════════════════
export function buildStoneGolemL() {
  const g = new THREE.Group();
  const st = toon(PAL.stone), dk = toon(PAL.stoneDark), moss = toon(0x4d5a38);
  const rnd = makeRng('L-golem');

  for (const sx of [-1, 1]) {
    g.add(box(0.3, 0.58, 0.32, dk, sx * 0.22, 0.31, 0));
    g.add(box(0.36, 0.14, 0.44, dk, sx * 0.22, 0.07, 0.05));
  }
  g.add(box(0.78, 0.74, 0.54, st, 0, 0.99));
  g.add(box(0.62, 0.14, 0.46, dk, 0, 0.62));
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.56, 1.2, 0);
    arm.rotation.z = sx * 0.12;
    arm.add(box(0.32, 0.42, 0.36, st, 0, -0.18));
    arm.add(box(0.28, 0.4, 0.32, st, 0, -0.56));
    arm.add(box(0.38, 0.27, 0.4, dk, 0, -0.86));
    g.add(arm);
  }
  g.add(box(0.38, 0.32, 0.36, st, 0, 1.53));
  g.add(box(0.42, 0.08, 0.4, dk, 0, 1.67));
  const eye = toon(PAL.ember, { emissive: PAL.ember, emissiveIntensity: 1.1 });
  for (const sx of [-1, 1]) g.add(box(0.07, 0.045, 0.03, eye, sx * 0.09, 1.54, 0.19));
  for (let i = 0; i < 8; i++) {
    const s = rnd.range(0.08, 0.17);
    const c = box(s, s, s, i % 2 ? moss : dk,
      rnd.range(-0.42, 0.42), rnd.range(0.72, 1.44), rnd.range(-0.3, 0.3));
    c.rotation.set(rnd() * 2, rnd() * 2, rnd() * 2);
    g.add(c);
  }
  return finish(g);
}

// ══════════════════════════════════════════════════════════
//  군주 — 보스. 로브가 바닥까지 덮여 발이 안 보인다.
// ══════════════════════════════════════════════════════════
export function buildLordL() {
  const g = new THREE.Group();
  const robe = toon(0x3a2c48), robeD = toon(0x241a2e);
  const gold = toon(PAL.gold), bone = toon(PAL.bone);
  const soul = toon(PAL.soul, { emissive: PAL.soul, emissiveIntensity: 0.8 });

  const skirt = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(0.32, 0.62, 1.24, 9, 1, true)),
    toon(0x3a2c48, { side: THREE.DoubleSide }));
  skirt.position.y = 0.62;
  g.add(skirt);
  g.add(cyl(0.33, 0.29, 0.6, 8, robe, 0, 1.5));
  g.add(cyl(0.34, 0.34, 0.08, 8, gold, 0, 1.22));
  for (const sx of [-1, 1]) {
    const p = cone(0.2, 0.26, 6, robeD, sx * 0.36, 1.83, 0);
    p.rotation.z = sx * 0.5;
    g.add(p);
    g.add(cyl(0.075, 0.06, 0.46, 6, robe, sx * 0.36, 1.54, 0.03));
  }
  const skull = sph(0.14, bone, 0, 1.95, 0.015, 9);
  skull.scale.set(1, 1.12, 1);
  g.add(skull);
  g.add(box(0.14, 0.06, 0.12, bone, 0, 1.86, 0.045));
  for (const sx of [-1, 1]) g.add(sph(0.028, soul, sx * 0.05, 1.97, 0.12, 6));
  g.add(cyl(0.155, 0.155, 0.09, 8, gold, 0, 2.09));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(cone(0.026, 0.12, 4, gold, Math.cos(a) * 0.14, 2.18, Math.sin(a) * 0.14));
  }
  const sc = new THREE.Group();
  sc.position.set(0.5, 1.2, 0.1);
  sc.rotation.z = -0.16;
  sc.add(cyl(0.035, 0.035, 1.8, 6, robeD, 0, 0.4));
  for (let i = 0; i < 4; i++) {
    const b = box(0.09, 0.26, 0.028, soul, -0.08 - i * 0.11, 1.18 + i * 0.16, 0);
    b.rotation.z = 0.42 + i * 0.24;
    sc.add(b);
  }
  g.add(sc);
  return finish(g);
}

// ══════════════════════════════════════════════════════════
//  지도 — 참고 이미지의 던전 바닥에는 **격자가 없다.**
//  물결치는 흙·바위와 얼룩뿐이고, 채도는 거의 0에 가깝다.
//  1차의 정사각 타일 + 또렷한 줄눈은 틀린 그림이었다.
// ══════════════════════════════════════════════════════════
function canvasTex(S, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  draw(c.getContext('2d'), S);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(repeat, repeat);
  return t;
}

export function lineageFloorTexture(repeat = 1) {
  return canvasTex(512, (ctx, S) => {
    const rnd = makeRng('L-floor3');
    ctx.fillStyle = '#463e30';
    ctx.fillRect(0, 0, S, S);
    // 큰 얼룩 — 흙의 높낮이. 경계가 흐려야 격자로 안 읽힌다.
    for (let i = 0; i < 40; i++) {
      const x = rnd() * S, y = rnd() * S, r = rnd.range(30, 110);
      const v = rnd.range(0.78, 1.24);
      const grd = ctx.createRadialGradient(x, y, 1, x, y, r);
      grd.addColorStop(0, `rgba(${(96 * v) | 0},${(85 * v) | 0},${(65 * v) | 0},.5)`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, S, S);
    }
    // 등고선 — 물결치는 결. 직선이 하나도 없어야 한다.
    ctx.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      ctx.strokeStyle = `rgba(44,37,27,${rnd.range(0.14, 0.32).toFixed(2)})`;
      ctx.beginPath();
      let y = rnd() * S;
      ctx.moveTo(0, y);
      for (let x = 0; x <= S; x += 16) { y += rnd.range(-7, 7); ctx.lineTo(x, y); }
      ctx.stroke();
    }
    for (let i = 0; i < 150; i++) {          // 잔돌
      const v = rnd.range(0.82, 1.3);
      ctx.fillStyle = `rgba(${(112 * v) | 0},${(102 * v) | 0},${(80 * v) | 0},.5)`;
      ctx.beginPath();
      ctx.ellipse(rnd() * S, rnd() * S, rnd.range(2, 7), rnd.range(1.5, 5), rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, repeat);
}

export function lineageWallTexture(repeat = 1) {
  return canvasTex(512, (ctx, S) => {
    const rnd = makeRng('L-wall3');
    ctx.fillStyle = '#39342a';                 // 줄눈(흙) — 돌 사이로만 보인다
    ctx.fillRect(0, 0, S, S);
    // 쌓다 만 돌무더기 — 벽돌 「열」이 아니라 크기가 제각각인 돌이 면을 메운다.
    // 성기게 그리면 어두운 바탕이 드러나 색종이처럼 보인다 → 겹치게 채운다.
    const ROWS = 7, rh = S / ROWS;
    for (let r = -1; r <= ROWS; r++) {
      let x = -rnd.range(20, 70);
      while (x < S + 40) {
        const w = rnd.range(52, 104), h = rh * rnd.range(0.92, 1.22);
        const y = r * rh + rnd.range(-5, 5);
        const v = rnd.range(0.8, 1.18);
        ctx.save();
        ctx.translate(x + w / 2, y + rh / 2);
        ctx.rotate(rnd.range(-0.05, 0.05));
        ctx.fillStyle = `rgb(${(104 * v) | 0},${(97 * v) | 0},${(78 * v) | 0})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(240,232,210,.13)';    // 윗면이 빛을 받는다
        ctx.beginPath();
        ctx.ellipse(0, -h * 0.24, w / 2.3, h / 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(28,24,17,.3)';        // 아랫면 그늘
        ctx.beginPath();
        ctx.ellipse(0, h * 0.3, w / 2.4, h / 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        x += w * rnd.range(0.72, 0.9);               // 겹치게 — 틈을 남기지 않는다
      }
    }
    for (let i = 0; i < 26; i++) {              // 이끼
      ctx.fillStyle = `rgba(70,84,46,${rnd.range(0.12, 0.3).toFixed(2)})`;
      ctx.beginPath();
      ctx.ellipse(rnd() * S, rnd() * S, rnd.range(10, 34), rnd.range(6, 20), rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, repeat);
}

/** 벽 윗면 — 카메라가 위에서 내려다보므로 실제로는 이 면이 가장 많이 보인다 */
export function lineageWallTopTexture(repeat = 1) {
  return canvasTex(256, (ctx, S) => {
    const rnd = makeRng('L-walltop');
    ctx.fillStyle = '#4a4436';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 60; i++) {
      const v = rnd.range(0.75, 1.25);
      ctx.fillStyle = `rgba(${(96 * v) | 0},${(90 * v) | 0},${(72 * v) | 0},.85)`;
      ctx.beginPath();
      ctx.ellipse(rnd() * S, rnd() * S, rnd.range(6, 22), rnd.range(5, 16), rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = `rgba(70,84,46,${rnd.range(0.14, 0.36).toFixed(2)})`;
      ctx.beginPath();
      ctx.ellipse(rnd() * S, rnd() * S, rnd.range(6, 20), rnd.range(4, 13), rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, repeat);
}

// ══════════════════════════════════════════════════════════
export const CAST = [
  { key: 'knight', label: '기사', sub: '플레이어', build: buildKnightL },
  { key: 'skeleton', label: '해골', sub: '해골 병사', build: buildSkeletonL },
  { key: 'zombie', label: '좀비', sub: '구울 자리', build: buildZombieL },
  { key: 'orc', label: '오크 궁수', sub: '망령 궁수 자리', build: buildOrcArcherL },
  { key: 'golem', label: '스톤 골렘', sub: '무덤 골렘', build: buildStoneGolemL },
  { key: 'lord', label: '군주', sub: '보스', build: buildLordL },
];
