// 리그 — 「사람 모양을 어떻게 만들고 어떻게 움직이는가」를 한 곳에 모은다.
//
// ── 왜 다시 만드는가 ─────────────────────────────────────────
// 지금 캐릭터가 저퀄로 보이는 이유는 세 가지고, 그중 **두 개는 폴리곤 수와 무관**하다.
//
//   1. 관절이 두 개뿐이다.
//      팔은 어깨에서만, 다리는 골반에서만 꺾인다. 팔꿈치도 무릎도 없다.
//      그래서 무엇을 하든 **널빤지를 흔드는 것**으로 보인다. 이게 제일 크다.
//   2. idle 이 진짜로 정지해 있다.
//      기존 포저의 idle 은 관절을 0 으로 감쇠시키는 게 전부다. 살아 있는 것은
//      가만히 서 있어도 숨을 쉬고 무게중심을 옮긴다. 그게 없으면 인형이다.
//   3. 피격 동작이 없다.
//      CLIPS 에 'hit' 이 적혀 있지만 **어디서도 재생하지 않는다.** 맞으면 몸통이
//      통째로 밀리고 납작해질 뿐이다. 맞은 곳도, 맞은 방향도 몸이 모르는 셈이다.
//
// 세 번째까지 고쳐야 「타격감」이 산다 — 때리는 쪽 연출(스파크·히트스톱)은 이미
// 있는데 **맞는 쪽이 반응을 안 하고 있었다.**
//
// ── 왜 절차적으로 만드는가 ───────────────────────────────────
// 외부 에셋을 받을 수 없는 환경이고(네트워크 차단), 산 모델을 넣을 자리는
// core/actor.js 의 GltfActor 로 이미 비워 뒀다. 그때까지는 코드로 만든 몸이
// 최선인데, **코드로 만들어도 관절과 실루엣은 얼마든지 좋아진다.**
//
// ── 그리기 비용 ──────────────────────────────────────────────
// 부위를 30 개로 늘리면 드로우콜이 30 배가 된다. 그래서 Part 는 **관절마다
// 재질별로 지오메트리를 합쳐서** 메시 하나로 만든다. 관절은 움직여야 하니
// 관절 경계를 넘어서는 합치지 않는다 — 그 선이 비용과 표현의 타협점이다.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// ───────────────────────── 지오메트리 ─────────────────────────

/**
 * 모따기된 각기둥. **이 게임의 기본 단위다.**
 *
 * 상자(정육면체)가 저퀄로 읽히는 진짜 이유는 「면이 6 개라서」가 아니라
 * 모서리가 **완벽하게 날카로워서** 빛이 한 점에서 끊기기 때문이다.
 * 8 각 기둥으로 바꾸면 모서리마다 좁은 면이 하나씩 생기고, 거기서 하이라이트가
 * 흐르면서 금속·뼈·돌이 **재질로** 보이기 시작한다. 삼각형은 24 개 늘 뿐이다.
 *
 * @param wb,db  아래쪽 폭·깊이
 * @param wt,dt  위쪽 폭·깊이 (생략하면 아래와 같다 = 평행 기둥)
 * @param h      높이. 원점은 **가운데**가 아니라 **위쪽 끝**이다 —
 *               팔·다리는 관절에 매달리므로 원점이 관절에 있어야 회전이 맞는다.
 */
export function prism(wb, db, h, wt = wb, dt = db, opt = {}) {
  const sides = opt.sides || 8;
  const g = new THREE.CylinderGeometry(0.5, 0.5, 1, sides, 1, false);
  const p = g.attributes.position;
  // 8 각형은 꼭짓점이 축 위에 오도록 반 칸 돌린다 — 안 돌리면 정면이 모서리가 된다
  if (sides % 4 === 0) g.rotateY(Math.PI / sides);
  const hang = opt.hang !== false;      // true 면 원점이 위쪽 끝 (매달린다)
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = y + 0.5;                  // 0 = 아래, 1 = 위
    p.setX(i, p.getX(i) * (wb + (wt - wb) * t) / 0.5 * 0.5);
    p.setZ(i, p.getZ(i) * (db + (dt - db) * t) / 0.5 * 0.5);
    p.setY(i, hang ? (y - 0.5) * h : y * h);
  }
  g.computeVertexNormals();
  return g;
}

/** 판 — 가슴받이·어깨·방패처럼 「두께가 얇고 넓은」 것. 모따기가 들어간다. */
export function slab(w, h, d, bevel = 0.03) {
  const s = new THREE.Shape();
  const x = w / 2 - bevel, y = h / 2 - bevel;
  s.moveTo(-x, -y + bevel);
  s.lineTo(-x, y - bevel); s.quadraticCurveTo(-x, y, -x + bevel, y);
  s.lineTo(x - bevel, y); s.quadraticCurveTo(x, y, x, y - bevel);
  s.lineTo(x, -y + bevel); s.quadraticCurveTo(x, -y, x - bevel, -y);
  s.lineTo(-x + bevel, -y); s.quadraticCurveTo(-x, -y, -x, -y + bevel);
  let g = new THREE.ExtrudeGeometry(s, {
    depth: d - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: 1, curveSegments: 2,
  });
  g.translate(0, 0, -(d - bevel * 2) / 2);
  // ExtrudeGeometry 만 **인덱스가 없다.** prism·spike 는 있다. 섞인 채로
  // mergeGeometries 에 넣으면 조용히 null 이 돌아오고, 그 관절의 부위가 통째로
  // 사라진다 — 실제로 기사의 가슴받이·망토가 한 번 없어졌다.
  g = mergeVertices(g);
  g.computeVertexNormals();
  return g;
}

/** 칼날 — 능선이 있는 마름모 단면. 4 각 기둥을 눕히면 빛이 날을 따라 흐른다. */
export function blade(w, len, thick, tip = 0.18) {
  return prism(w, thick, len, w * tip, thick * tip, { sides: 4, hang: false });
}

/** 뿔·발톱·송곳니 */
export function spike(r, len, sides = 5) {
  const g = new THREE.ConeGeometry(r, len, sides);
  g.translate(0, len / 2, 0);
  return g;
}

// ───────────────────────── 조립 ─────────────────────────

/**
 * 관절 하나에 붙는 것들을 모았다가 **재질별로 합쳐서** 메시로 만든다.
 *
 * 부위를 30 개로 늘려도 드로우콜은 「관절 수 × 재질 수」로 유지된다.
 * 기사는 관절 14 개 · 재질 5 종이지만 실제 메시는 22 개쯤 나온다 —
 * 모든 관절이 모든 재질을 쓰지는 않으므로.
 */
export class Part {
  constructor(group) {
    this.group = group || new THREE.Group();
    this.buckets = new Map();           // material → geometry[]
  }

  /**
   * @param geo  지오메트리 (여기서 복제하지 않는다 — 변환을 직접 먹인다)
   * @param mat  재질
   * @param tf   { x,y,z, rx,ry,rz, sx,sy,sz } 또는 생략
   */
  add(geo, mat, tf = {}) {
    const g = geo.clone();
    if (tf.sx != null || tf.sy != null || tf.sz != null) {
      g.scale(tf.sx ?? 1, tf.sy ?? 1, tf.sz ?? 1);
    }
    if (tf.rx) g.rotateX(tf.rx);
    if (tf.ry) g.rotateY(tf.ry);
    if (tf.rz) g.rotateZ(tf.rz);
    if (tf.x || tf.y || tf.z) g.translate(tf.x || 0, tf.y || 0, tf.z || 0);
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat).push(g);
    return this;
  }

  /** 대칭으로 하나 더 붙인다 — 어깨·다리처럼 좌우가 같은 것 */
  mirror(geo, mat, tf = {}) {
    this.add(geo, mat, tf);
    this.add(geo, mat, { ...tf, x: -(tf.x || 0), ry: -(tf.ry || 0), rz: -(tf.rz || 0) });
    return this;
  }

  finish() {
    for (const [mat, list] of this.buckets) {
      // mergeGeometries 는 속성 구성이 다르면 null 을 돌려준다.
      // 실패하면 조용히 넘어가지 말고 낱개로 붙인다 — **부위가 사라지는 것보다
      // 드로우콜이 느는 게 낫다.** (한 번 조용히 사라져서 몸이 반쪽이 났었다)
      // 인덱스 유무가 섞이면 mergeGeometries 가 null 을 돌려준다. 여기서 맞춘다 —
      // 위쪽(slab)에서 한 번 막았지만, 새 도형을 추가할 때 또 밟을 함정이라
      // 마지막 방어선을 하나 더 둔다.
      const indexed = list.filter((g) => g.index).length;
      if (indexed && indexed !== list.length) {
        for (let i = 0; i < list.length; i++) if (!list[i].index) list[i] = mergeVertices(list[i]);
      }
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (merged) {
        this.group.add(new THREE.Mesh(merged, mat));
      } else {
        for (const g of list) this.group.add(new THREE.Mesh(g, mat));
      }
    }
    this.buckets.clear();
    return this.group;
  }
}

/** 관절 — 부모에 매달린 빈 그룹. 이름을 주면 디버깅할 때 찾기 쉽다. */
export function bone(parent, x = 0, y = 0, z = 0, name = '') {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (name) g.name = name;
  parent.add(g);
  return g;
}

/**
 * 사람 골격 — 이 게임의 모든 인간형이 공유하는 관절 배치.
 *
 * 「정면은 +Z, 오른쪽은 −X」 (facing = atan2(dx,dz) 이므로 — player.js 주석 참조).
 * 무기는 항상 handR 에 붙고 handR 은 −X 쪽이다.
 *
 *   group ─ root ─ hips ┬ thighL ─ shinL ─ footL
 *                       ├ thighR ─ shinR ─ footR
 *                       └ spine ─ chest ┬ neck ─ head
 *                                       ├ armL ─ foreL ─ handL
 *                                       └ armR ─ foreR ─ handR ─ weapon
 *
 * 기존 코드와의 호환: rig.torso = spine, rig.legL/legR = 허벅지, rig.arm = armR.
 * 그 이름들을 게임 로직 여러 곳에서 이미 만지고 있어서 유지한다.
 */
export function skeleton(dim) {
  const group = new THREE.Group();
  const root = bone(group, 0, 0, 0, 'root');
  const hips = bone(root, 0, dim.hipY, 0, 'hips');

  const thighL = bone(hips, dim.legX, 0, 0, 'thighL');
  const shinL = bone(thighL, 0, -dim.thigh, 0, 'shinL');
  const footL = bone(shinL, 0, -dim.shin, 0, 'footL');
  const thighR = bone(hips, -dim.legX, 0, 0, 'thighR');
  const shinR = bone(thighR, 0, -dim.thigh, 0, 'shinR');
  const footR = bone(shinR, 0, -dim.shin, 0, 'footR');

  const spine = bone(hips, 0, dim.spineY, 0, 'spine');
  const chest = bone(spine, 0, dim.chestY, 0, 'chest');
  const neck = bone(chest, 0, dim.neckY, 0, 'neck');
  const head = bone(neck, 0, dim.headY, 0, 'head');

  const armL = bone(chest, dim.armX, dim.armY, 0, 'armL');
  const foreL = bone(armL, 0, -dim.upper, 0, 'foreL');
  const handL = bone(foreL, 0, -dim.fore, 0, 'handL');
  const armR = bone(chest, -dim.armX, dim.armY, 0, 'armR');
  const foreR = bone(armR, 0, -dim.upper, 0, 'foreR');
  const handR = bone(foreR, 0, -dim.fore, 0, 'handR');

  return {
    group, root, hips, spine, chest, neck, head,
    thighL, shinL, footL, thighR, shinR, footR,
    armL, foreL, handL, armR, foreR, handR,
    dim,
    // ── 옛 이름 (게임 로직이 직접 만지는 것들) ──
    torso: spine, legL: thighL, legR: thighR, arm: armR,
  };
}

// ───────────────────────── 자세 ─────────────────────────

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** 감쇠 — 프레임률과 무관하게 같은 속도로 목표에 붙는다 */
const damp = (cur, to, rate, dt) => cur + (to - cur) * (1 - Math.exp(-rate * dt));
/**
 * 튕기며 잦아든다 — 피격 회복에 쓴다. 그냥 감쇠하면 「스르륵」이라 안 아파 보인다.
 *
 * 진동수가 중요하다. 처음에 `cos(k * 13.5)` 로 잡았는데, 그건 0.42 초 안에
 * **두 번 넘게 왕복**한다는 뜻이라 「휘청」이 아니라 「부르르」로 보였다.
 * 더 나쁜 건, 맞은 지 0.1 초만 지나도 부호가 뒤집혀서 **맞은 반대쪽으로 꺾여
 * 있었다** — 방향성 검사(actor.hitDirectional)가 그걸 잡아냈다.
 * 한 번 크게 물러났다가 한 번 되돌아오는 정도가 맞다.
 */
const springOut = (k) => Math.exp(-4.6 * k) * Math.cos(k * 6.2);

export const ease = { lerp, clamp01, damp, springOut };

/**
 * 자세 저장소 — 관절마다 「지금 값」을 들고 있다가 매 프레임 목표로 감쇠시킨다.
 *
 * 동작을 바꿀 때 관절이 **뚝 끊기지 않게** 하는 유일한 방법이다. 예전 포저는
 * 동작마다 각도를 직접 대입해서, 걷다가 때리면 다리가 한 프레임에 튀었다.
 */
export class Pose {
  constructor(rig) {
    this.rig = rig;
    this.v = new Map();                 // 'armR.x' → 현재 각도
    // 관절의 **원래 자리**를 붙잡아 둔다. pos() 는 여기서의 어긋남을 다루므로
    // 「엉덩이를 3cm 내린다」가 골격 치수와 무관하게 항상 3cm 다.
    this.base = new Map();
    for (const k of Object.keys(rig)) {
      const b = rig[k];
      if (b && b.isObject3D) this.base.set(k, b.position.clone());
    }
  }

  /** 목표 각도로 rate 속도로 다가간다 */
  set(joint, axis, to, rate, dt) {
    const key = joint + axis;
    const cur = this.v.get(key) ?? 0;
    const next = damp(cur, to, rate, dt);
    this.v.set(key, next);
    const b = this.rig[joint];
    if (b) b.rotation[axis] = next;
    return next;
  }

  /** 감쇠 없이 바로 — 격한 동작(피격 초반)은 즉시 꺾여야 아파 보인다 */
  hard(joint, axis, to) {
    this.v.set(joint + axis, to);
    const b = this.rig[joint];
    if (b) b.rotation[axis] = to;
  }

  /** 원래 자리에서 얼마나 어긋날지 (절대 좌표가 아니다) */
  pos(joint, axis, to, rate, dt) {
    const key = joint + '@' + axis;
    const cur = this.v.get(key) ?? 0;
    const next = damp(cur, to, rate, dt);
    this.v.set(key, next);
    const b = this.rig[joint];
    const base = this.base.get(joint);
    if (b && base) b.position[axis] = base[axis] + next;
    return next;
  }
}
