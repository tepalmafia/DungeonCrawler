// ══════════════════════════════════════════════════════════════════════════
//  ★★★ 쏘는 것이 **날아간다** (v69 · docs/space/COMBAT.md §2-②)
//
//  ★ 사장님: 「**발사 되는게 안보이잔아?**」 · 「미사일도 제작하고 **임펙트**」
//
//  ★★ v64 까지 쏘면 **숫자만 줬다.** 열이 오르고 광석이 줄고 표적의 hp 가
//    빠졌다 — 화면에서는 아무 일도 안 일어났다. 격추 게임에서 그건
//    **쏘는 맛이 아예 없는 것**이다.
//
//  ★ 셋이 **다르게 보여야** 한다. 같은 빛이 날아가면 무기를 고른 뜻이 없다:
//
//      레이저    기수에서 표적까지 **한 줄기 빛** — 즉발, 0.12초 번쩍
//      열추적탄  작은 불꽃이 **휘며** 간다 — 쏘고 잊는다
//      유도탄    **곧게** 간다 — 묶고 있는 동안만 끝까지
//
//  ★ 창밖 그룹에 매단다 — 배를 틀면 같이 흐른다 (`targets.js` 와 같은 이유)
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';

const DEG = Math.PI / 180;
/** 기수 — 탄이 나가는 자리. 조종석 유리 조금 앞 */
const MUZZLE = new THREE.Vector3(0, -0.4, -11);

const beamMat = () => new THREE.MeshBasicMaterial({
  color: 0x9cf0ff, transparent: true, opacity: 0.9,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const fireMat = (hex) => new THREE.MeshBasicMaterial({
  color: hex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
});

/** 각도와 거리 → 자리. `targets.js` 와 **같은 식**을 쓴다 */
export function atOf(az, el, dist) {
  const a = az * DEG, e = el * DEG;
  return new THREE.Vector3(
    Math.sin(a) * Math.cos(e) * dist,
    Math.sin(e) * dist,
    -Math.cos(a) * Math.cos(e) * dist,
  );
}

export function buildShots(parent) {
  const g = new THREE.Group();
  g.name = '쏜것들';
  parent.add(g);

  /** 날아가는 것들 */
  const live = [];
  let fired = 0;

  /**
   * 한 발 쏜다.
   * @param kind 'laser' | 'ir' | 'arh'
   * @param to   { az, el, dist } 표적 — 없으면 정면으로 나간다
   */
  function fire(kind, to = null) {
    fired++;
    const dst = to ? atOf(to.az, to.el, to.dist) : atOf(0, 0, 300);
    if (kind === 'laser') {
      // ★ **즉발이다.** 미사일처럼 날아가면 그건 레이저가 아니다 —
      //   기수에서 표적까지 **한 줄기**를 그어 놓고 곧 지운다
      const len = MUZZLE.distanceTo(dst);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.12, len, 6), beamMat());
      const mid = MUZZLE.clone().lerp(dst, 0.5);
      m.position.copy(mid);
      m.lookAt(dst);
      m.rotateX(Math.PI / 2);
      g.add(m);
      live.push({ m, kind, t: 0, live: 0.12, beam: true });
      return;
    }
    // 미사일 둘 — **몸통 + 꼬리 불**
    const s = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.22, 1.1, 3, 6),
      new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.5, metalness: 0.6 }),
    );
    body.rotation.x = Math.PI / 2;
    s.add(body);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 1.4, 6),
      fireMat(kind === 'ir' ? 0xff9a4a : 0x7ad4ff),
    );
    flame.rotation.x = -Math.PI / 2;
    flame.position.z = 1.1;
    s.add(flame);
    s.position.copy(MUZZLE);
    g.add(s);
    live.push({
      m: s, kind, t: 0, live: 4.0,
      from: MUZZLE.clone(), to: dst,
      // ★ 열추적탄은 **휜다** — 쏘고 잊는 대신 곧게 안 간다.
      //   유도탄은 곧다 — 묶고 있어야 하는 대신 정확하다
      wobble: kind === 'ir' ? 1 : 0,
      speed: kind === 'ir' ? 95 : 140,
      flame,
    });
  }

  /** 터짐 — 맞은 자리에서 (`targets.js` 의 것과 나란히 쓴다) */
  function pop(at) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), fireMat(0xffd08a));
    m.position.copy(at);
    g.add(m);
    live.push({ m, kind: 'pop', t: 0, live: 0.35, pop: true });
  }

  return {
    group: g,
    fire,
    pop,
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const s = live[i];
        s.t += dt;
        if (s.beam) {
          // 번쩍하고 사라진다
          s.m.material.opacity = 0.9 * (1 - s.t / s.live);
        } else if (s.pop) {
          const k = s.t / s.live;
          s.m.scale.setScalar(1 + k * 5);
          s.m.material.opacity = 1 - k;
        } else {
          const dir = s.to.clone().sub(s.from);
          const total = dir.length();
          const gone = Math.min(1, (s.t * s.speed) / Math.max(1, total));
          s.m.position.copy(s.from).addScaledVector(dir, gone);
          if (s.wobble) {
            // 휜다 — 옆으로 흔들리며 간다
            s.m.position.x += Math.sin(s.t * 9) * 3.2 * (1 - gone);
            s.m.position.y += Math.cos(s.t * 7) * 2.4 * (1 - gone);
          }
          s.m.lookAt(s.to);
          if (s.flame) s.flame.scale.setScalar(0.7 + Math.random() * 0.5);
          if (gone >= 1) {
            pop(s.m.position);
            g.remove(s.m); live.splice(i, 1);
            continue;
          }
        }
        if (s.t >= s.live) { g.remove(s.m); live.splice(i, 1); }
      }
    },
    /** 검사가 「쏘면 정말 뭔가 날아가나」를 묻는다 */
    get seen() { return { fired, live: live.length }; },
  };
}
