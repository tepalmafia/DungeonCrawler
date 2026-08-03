// 무기 — 계열마다 다른 메시. **장착이 화면에 보이게 하는 파일이다.**
//
// ── 왜 갈라 냈는가 ───────────────────────────────────────────
// items.js 에는 무기 계열이 여섯(검·대검·도끼·둔기·단검·지팡이), 기반 무기가
// 열여덟 개 있다. 그런데 models.js 의 buildKnight() 는 **검 하나를 고정으로**
// 만들고 끝이었고, 장착이 바뀔 때 도는 코드는 `bladeMat.color.set()` 뿐이었다.
// 즉 처형자(대검 dmg 14~20)를 껴도 화면에는 짧은 한손검이 보였다.
// **무기를 바꿔 끼는 것이 이 게임의 핵심 보상인데 그 보상이 안 보였다.**
//
// ── 좌표 규약 (여기가 제일 중요하다) ─────────────────────────
//   · 원점 = **손이 쥐는 지점(손잡이 한가운데)**
//   · +Y   = **무기 끝 방향**
//
// 예전 검은 원점이 손잡이 *아래쪽* 끝이라 폼멜이 손목 안으로 0.16 들어가 있었다
// — 손이 무기를 쥔 게 아니라 무기가 손에 꽂혀 있었다. 원점을 손잡이 한가운데로
// 옮기는 것만으로 그게 사라진다. 새 무기를 추가할 때 이 두 줄만 지키면 된다.
//
// 붙일 때는 mount 그룹이 π 만큼 뒤집는다 — 그래야 칼날이 손에서 **팔 바깥쪽**
// 으로 뻗는다. 이걸 안 하면 얼음송곳 쥐듯 거꾸로 쥔 모양이 되고, 팔이 아무리
// 큰 호를 그려도 칼끝은 몸 앞에서 오르내리기만 한다 (models.js 의 긴 주석 참조).
//
// ── 재질은 만들지 않는다 ─────────────────────────────────────
// 몸이 쓰는 재질을 그대로 받아 쓴다. 이유가 둘이다:
//   1. 무기를 바꿀 때마다 재질을 새로 만들면 **피격 플래시 루프**가 도는
//      rig.materials 와 어긋난다 (player.js 는 bladeMat 하나를 예외로 건너뛴다)
//   2. bladeMat 이 **같은 객체로 유지**되어야 등급 발광(_syncBlade)이 그대로 산다
// 그래서 교체할 때 새로 생기는 것은 지오메트리뿐이고, 옛 것은 여기서 버린다.

import * as THREE from 'three';
import { prism, blade, spike, Part } from './rig.js';

/** items.js 의 fam 문자열과 같아야 한다. 창은 적 전용(해골 창병). */
export const WEAPON_FAMS = ['검', '대검', '도끼', '둔기', '단검', '지팡이', '창'];

/** 손을 감싸는 띠 — 관절을 늘리지 않고 「쥐었다」를 읽히게 하는 제일 싼 방법 */
function band(w = 0.088, h = 0.062) {
  return prism(w, w * 1.05, h, w, w * 1.05, { hang: false, sides: 6 });
}

// ───────────────────────── 계열별 ─────────────────────────
//
// 각 함수는 { group, blade, reach, twoHand, tilt } 를 돌려준다.
//   blade    등급 발광이 붙고 **타격 이펙트가 나오는 메시.** 도끼·둔기는 날이
//            아니라 머리다 — 이펙트는 「맞는 곳」에 나와야 하므로 그게 맞다.
//   reach    원점에서 끝까지. 무기 길이를 아는 곳이 여기 하나여야 한다.
//   twoHand  왼손을 손잡이로 가져오고 **방패를 숨긴다**
//   tilt     π 에서 덜어 낼 각 — 클수록 칼끝이 앞으로 눕는다

function sword(pal) {
  const g = new THREE.Group();
  new Part(g)
    .add(prism(0.045, 0.05, 0.20, 0.05, 0.055, { hang: false }), pal.wrap)          // 손잡이
    .add(prism(0.075, 0.075, 0.05, 0.10, 0.10, { hang: false, sides: 6 }), pal.accent, { y: -0.125 })
    .add(prism(0.30, 0.07, 0.055, 0.24, 0.05, { hang: false }), pal.accent, { y: 0.128 })  // 가드
    .add(band(), pal.dark)
    .finish();
  const bl = new THREE.Mesh(blade(0.10, 0.78, 0.036), pal.bladeMat);
  bl.position.y = 0.545;
  return { group: g, blade: bl, reach: 0.94, twoHand: false, tilt: 0.28 };
}

// 대검 — 손잡이가 길어야 두 손 무기로 읽힌다. 날 길이보다 **손잡이 길이**가
// 「이건 양손이다」를 알려 주는 신호다.
function greatsword(pal) {
  const g = new THREE.Group();
  new Part(g)
    .add(prism(0.052, 0.058, 0.34, 0.058, 0.064, { hang: false }), pal.wrap)
    .add(prism(0.09, 0.09, 0.07, 0.12, 0.12, { hang: false, sides: 6 }), pal.accent, { y: -0.205 })
    .add(prism(0.46, 0.08, 0.06, 0.36, 0.06, { hang: false }), pal.accent, { y: 0.205 })
    .add(prism(0.10, 0.06, 0.10, 0.08, 0.05, { hang: false }), pal.dark, { y: 0.28 })   // 리카소
    .add(band(0.098, 0.07), pal.dark, { y: -0.03 })
    .add(band(0.092, 0.06), pal.dark, { y: 0.11 })                                     // 두 손 자리
    .finish();
  const bl = new THREE.Mesh(blade(0.155, 1.06, 0.042), pal.bladeMat);
  bl.position.y = 0.86;
  return { group: g, blade: bl, reach: 1.39, twoHand: true, tilt: 0.20 };
}

// 도끼 — 날을 **양쪽에** 낸다. 한쪽에만 내면 휘두르는 각도에 따라 옆면이
// 보이는 순간 널빤지가 된다. 쌍날로 두면 어느 각도에서도 도끼로 읽힌다.
function axe(pal) {
  const g = new THREE.Group();
  const back = blade(0.19, 0.20, 0.05, 0.42);
  new Part(g)
    .add(prism(0.048, 0.048, 0.80, 0.044, 0.044, { hang: false }), pal.wrap, { y: 0.17 })  // 자루
    .add(prism(0.085, 0.085, 0.06, 0.07, 0.07, { hang: false, sides: 6 }), pal.accent, { y: -0.26 })
    .add(back, pal.dark, { rz: Math.PI / 2, x: -0.13, y: 0.44 })                       // 뒷날
    .add(prism(0.10, 0.10, 0.13, 0.09, 0.09, { hang: false, sides: 6 }), pal.dark, { y: 0.44 })
    .add(spike(0.03, 0.13, 4), pal.accent, { y: 0.51 })
    .add(band(), pal.dark, { y: -0.02 })
    .finish();
  const bl = new THREE.Mesh(blade(0.27, 0.34, 0.055, 0.40), pal.bladeMat);
  bl.rotation.z = -Math.PI / 2;                 // +Y(길이) → +X. 날이 옆으로 뻗는다
  bl.position.set(0.21, 0.44, 0);
  return { group: g, blade: bl, reach: 0.60, twoHand: false, tilt: 0.24 };
}

// 둔기 — 축 대칭이라 각도를 안 탄다. 날개(flange)가 있어야 몽둥이가 아니라
// 「철퇴」로 읽힌다. 여섯 방향에 붙인다.
function mace(pal) {
  const g = new THREE.Group();
  const p = new Part(g)
    .add(prism(0.046, 0.046, 0.66, 0.042, 0.042, { hang: false }), pal.wrap, { y: 0.12 })
    .add(prism(0.082, 0.082, 0.06, 0.068, 0.068, { hang: false, sides: 6 }), pal.accent, { y: -0.21 })
    .add(band(), pal.dark, { y: -0.04 });
  const fl = blade(0.115, 0.135, 0.042, 0.55);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    p.add(fl, pal.accent, { rz: Math.PI / 2 - a, ry: 0, x: Math.cos(a) * 0.10, y: 0.47, z: Math.sin(a) * 0.10 });
  }
  p.add(spike(0.032, 0.10, 5), pal.accent, { y: 0.56 }).finish();
  const bl = new THREE.Mesh(prism(0.17, 0.17, 0.22, 0.15, 0.15, { hang: false, sides: 8 }), pal.bladeMat);
  bl.position.y = 0.47;
  return { group: g, blade: bl, reach: 0.62, twoHand: true, tilt: 0.18 };
}

// 단검 — **작다는 것이 정체성**이다. 크게 만들면 그냥 짧은 검이 된다.
function dagger(pal) {
  const g = new THREE.Group();
  new Part(g)
    .add(prism(0.038, 0.042, 0.14, 0.042, 0.046, { hang: false }), pal.wrap)
    .add(prism(0.058, 0.058, 0.035, 0.045, 0.045, { hang: false, sides: 6 }), pal.accent, { y: -0.088 })
    .add(prism(0.15, 0.05, 0.035, 0.12, 0.04, { hang: false }), pal.accent, { y: 0.088 })
    .add(band(0.082, 0.055), pal.dark)
    .finish();
  const bl = new THREE.Mesh(blade(0.072, 0.30, 0.026, 0.12), pal.bladeMat);
  bl.position.y = 0.256;
  return { group: g, blade: bl, reach: 0.41, twoHand: false, tilt: 0.34 };
}

// 지팡이 — 발광하는 것이 **날이 아니라 구슬**이다. 등급 발광이 제일 잘 보이는
// 계열이고, 그래서 지팡이를 끼면 등급이 한눈에 읽힌다.
function staff(pal) {
  const g = new THREE.Group();
  const p = new Part(g)
    .add(prism(0.044, 0.044, 1.22, 0.038, 0.038, { hang: false }), pal.wrap, { y: 0.22 })
    .add(prism(0.072, 0.072, 0.07, 0.058, 0.058, { hang: false, sides: 6 }), pal.accent, { y: -0.40 })
    .add(band(0.086, 0.065), pal.dark, { y: -0.02 })
    .add(prism(0.10, 0.10, 0.06, 0.085, 0.085, { hang: false, sides: 6 }), pal.accent, { y: 0.74 });
  for (let i = 0; i < 3; i++) {                 // 구슬을 감싸는 갈래 셋
    const a = (i / 3) * Math.PI * 2;
    p.add(spike(0.026, 0.20, 4), pal.accent,
      { x: Math.cos(a) * 0.085, y: 0.78, z: Math.sin(a) * 0.085, rz: -Math.cos(a) * 0.34, rx: Math.sin(a) * 0.34 });
  }
  p.finish();
  const bl = new THREE.Mesh(prism(0.13, 0.13, 0.14, 0.10, 0.10, { hang: false, sides: 8 }), pal.bladeMat);
  bl.position.y = 0.86;
  return { group: g, blade: bl, reach: 0.96, twoHand: true, tilt: 0.10 };
}

// 창 — 적 전용(해골 창병). **길이가 규칙이다**: 사거리 2.9 를 눈으로 알려 주는
// 것은 숫자가 아니라 이 자루 길이다. 짧게 만들면 「왜 저기서 맞지」가 된다.
function spear(pal) {
  const g = new THREE.Group();
  new Part(g)
    .add(prism(0.042, 0.042, 1.60, 0.036, 0.036, { hang: false }), pal.wrap, { y: 0.34 })
    .add(prism(0.07, 0.07, 0.06, 0.055, 0.055, { hang: false, sides: 6 }), pal.accent, { y: -0.49 })
    .add(prism(0.062, 0.062, 0.09, 0.05, 0.05, { hang: false, sides: 6 }), pal.accent, { y: 1.10 })
    .add(band(0.084, 0.06), pal.dark, { y: -0.02 })
    .add(band(0.078, 0.055), pal.dark, { y: 0.24 })
    .finish();
  const bl = new THREE.Mesh(blade(0.095, 0.36, 0.028, 0.10), pal.bladeMat);
  bl.position.y = 1.32;
  return { group: g, blade: bl, reach: 1.50, twoHand: true, tilt: 0.06 };
}

const BUILD = { 검: sword, 대검: greatsword, 도끼: axe, 둔기: mace, 단검: dagger, 지팡이: staff, 창: spear };

/**
 * 계열 하나를 만든다. **손에 붙이지는 않는다** — 붙이는 것은 attachWeapon.
 * @param pal { wrap, dark, accent, bladeMat }
 */
export function buildWeapon(fam, pal) {
  const spec = (BUILD[fam] || sword)(pal);
  spec.group.add(spec.blade);
  spec.fam = BUILD[fam] ? fam : '검';
  spec.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return spec;
}

/**
 * 손에 붙인다 — 여기서만 π 뒤집기와 쥐는 위치를 안다.
 *
 * grip 은 **손 메시의 한가운데**여야 한다. 손은 handR 에서 아래로 0.13 쯤
 * 매달려 있으므로 y 는 그 절반만큼 음수다. 0 으로 두면 손잡이가 주먹 위쪽
 * 끝에 걸려서 「손끝으로 집었다」가 된다.
 */
export function attachWeapon(rig, fam, pal, grip = { y: -0.06, z: 0.035 }) {
  disposeWeapon(rig);
  const spec = buildWeapon(fam, pal);
  const mount = spec.group;
  mount.position.set(0, grip.y, grip.z);
  mount.rotation.x = Math.PI - spec.tilt;
  rig.handR.add(mount);

  rig.weapon = mount;
  rig.blade = spec.blade;
  // 다시 뽑을 때 되돌릴 값 — setSheathed 가 쓴다
  rig.gripY = grip.y; rig.gripZ = grip.z; rig.weaponTilt = spec.tilt;
  rig.sheathed = false;
  rig.weaponFam = spec.fam;
  rig.weaponReach = spec.reach;
  rig.twoHand = !!spec.twoHand;
  // 두 손 무기는 방패를 숨긴다 — 안 그러면 대검을 양손으로 쥔 채 방패가
  // 왼팔에 매달려 있다. 방패를 없애는 게 아니라 **가리는** 것이라 되돌아온다.
  if (rig.shield) rig.shield.visible = !spec.twoHand;
  return spec;
}

/**
 * 검을 **등의 칼집에 넣었다 뺐다** 한다.
 *
 * 「누가 검을 들고 걸어 다니냐, 평소엔 등에 매고 있다가 공격할 때 뽑아야지」 —
 * 맞는 말이고, 이게 캐릭터가 살아 있어 보이게 하는 몇 안 되는 값싼 장치다.
 * 늘 뽑아 든 캐릭터는 **마네킹**이다.
 *
 * 구현은 **부모를 바꾸는 것**뿐이다. 애니메이션으로 손을 등까지 보내려면
 * IK 가 필요하고 그건 이 규모에 과하다. 손 ↔ 칼집 사이를 옮기고, 옮기는
 * 순간이 스윙의 예비 동작에 묻히면 눈에는 「뽑았다」로 보인다.
 *
 * 칼집에 넣을 때는 **거꾸로** 꽂는다(rotation.x = π). 무기는 원점이 손잡이고
 * +Y 가 칼끝이라, 그대로 두면 칼끝이 하늘을 보고 칼집 밖으로 솟는다.
 *
 * 두 손 무기는 칼집에 안 들어간다 — 대검을 등에 매려면 칼집이 아니라
 * 띠가 필요하고, 지금 몸에는 그게 없다. 그런 무기는 늘 들고 있는다.
 */
export function setSheathed(rig, on) {
  const w = rig.weapon;
  if (!w || !rig.scabbard || rig.twoHand || w === rig.handR) return false;
  const want = !!on;
  if (rig.sheathed === want) return false;
  rig.sheathed = want;
  if (want) {
    rig.scabbard.add(w);
    w.position.set(0, 0.21, 0);
    w.rotation.set(Math.PI, 0, 0);
  } else {
    rig.handR.add(w);
    w.position.set(0, rig.gripY ?? -0.06, rig.gripZ ?? 0.035);
    w.rotation.set(Math.PI - (rig.weaponTilt ?? 0), 0, 0);
  }
  return true;
}

/** 옛 무기를 버린다. 재질은 몸이 공유하므로 **지오메트리만** 버린다. */
export function disposeWeapon(rig) {
  const old = rig.weapon;
  if (!old || old === rig.handR) return;
  old.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
  old.parent?.remove(old);
  rig.weapon = null;
  rig.blade = null;
}

/**
 * 방패 — 해골 방패병용. 기사의 방패와 같은 이유로 **손이 아니라 아래팔**에
 * 단다 (models.js 주석 참조). 정면 방어(frontGuard 0.6)가 규칙으로만 있고
 * 화면에 아무 표시가 없었다 — 이게 그 표시다.
 */
export function attachBuckler(rig, pal, foreFold = 1.2) {
  const mount = new THREE.Group();
  mount.position.set(0, -0.14, 0.03);
  mount.rotation.x = foreFold;
  rig.foreL.add(mount);
  new Part(mount)
    .add(prism(0.34, 0.34, 0.05, 0.30, 0.30, { hang: false, sides: 8 }), pal.dark, { y: -0.02, z: 0.11, rx: -Math.PI / 2 })
    .add(prism(0.13, 0.13, 0.07, 0.10, 0.10, { hang: false, sides: 8 }), pal.accent, { y: -0.02, z: 0.16, rx: -Math.PI / 2 })
    .add(spike(0.028, 0.11, 4), pal.accent, { y: -0.02, z: 0.20, rx: Math.PI / 2 })
    .finish();
  mount.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  rig.shield = mount;
  return mount;
}
