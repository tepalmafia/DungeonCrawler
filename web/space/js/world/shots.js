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
import { flownAt, speedAt, lit, LAUNCH } from '../game/slow-table.js';

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
    // ★★★ **어느 표적을 쫓는지 기억한다** (v79). 아래 `update` 가 매 프레임
    //   그 표적의 **지금 자리**로 종점을 고쳐 잡는다 — 이유는 update 주석에
    const chase = to?.id ?? null;
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
      // ★ 레이저의 몫 — **슬로우 대신 임펙트** (v84)
      muzzle(0x9cf0ff, 0.7);
      return;
    }
    // ══ ★★★ v84 — **미사일 · 사출되어 나가고 점화되어 멀어진다** ═══════
    //  몸통 + **꼬리 불** + 배기. 불은 **처음엔 꺼져 있다** (사출 중) —
    //  그 대비가 「밀려 나갔다가 붙었다」를 글자 없이 알려 준다
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
    // ★★ **사출 중에는 불이 없다.** 가스로 밀려 나가는 동안은 모터가
    //   안 켜져 있다 — 관 안에서 켜면 제 배를 태운다 (진공이면 더욱)
    flame.visible = false;
    s.add(flame);
    // ★ 배기 자국 — 점화 뒤에만. 진공이라 **금방 흩어진다** (짧다)
    const trail = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 5.0, 5, 1, true),
      fireMat(kind === 'ir' ? 0xff7a2a : 0x4aa8ff),
    );
    trail.material.opacity = 0.42;
    trail.rotation.x = -Math.PI / 2;
    trail.position.z = 3.2;
    trail.visible = false;
    s.add(trail);
    s.position.copy(MUZZLE);
    g.add(s);
    live.push({
      m: s, kind, t: 0, live: 6.0,
      from: MUZZLE.clone(), to: dst, chase,
      // ★ 열추적탄은 **휜다** — 쏘고 잊는 대신 곧게 안 간다.
      //   유도탄은 곧다 — 묶고 있어야 하는 대신 정확하다
      wobble: kind === 'ir' ? 1 : 0,
      // ★ **순항** 속도다. 지금 속도는 `speedAt` 이 정한다 (사출 14 → 순항)
      speed: kind === 'ir' ? 95 : 140,
      flame, trail,
    });
    // ★★ **사출 섬광** — 관에서 밀려 나오는 그 순간. 미사일이 아직 느려서
    //   눈앞에 있으므로, 이 빛이 없으면 「어디서 나왔는지」가 안 보인다
    muzzle(kind === 'ir' ? 0xffc890 : 0x9cd8ff, 0.9);
  }

  /**
   * ★★ **총구 섬광** — 쏘는 순간 기수 앞이 번쩍한다.
   *
   *   ★ 레이저는 즉발이라 **슬로우가 안 걸린다** (`slow-table.js`).
   *     빛을 느리게 날리면 v57 이후의 고증이 거짓말이 된다. 대신
   *     이 섬광으로 갚는다 — 「쐈다」가 몸으로 느껴져야 한다
   */
  function muzzle(hex, big = 1) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.1 * big, 7, 5), fireMat(hex));
    m.position.copy(MUZZLE);
    m.position.z += 1.2;
    g.add(m);
    live.push({ m, kind: 'flash', t: 0, live: 0.16, pop: true });
  }

  /** 터짐 — 맞은 자리에서 (`targets.js` 의 것과 나란히 쓴다) */
  function pop(at) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), fireMat(0xffd08a));
    m.position.copy(at);
    g.add(m);
    live.push({ m, kind: 'pop', t: 0, live: 0.35, pop: true });
  }

  /**
   * ★★★ **적탄이 날아온다** (v70). 사장님 「긴박감있고 긴장감 있고」.
   *
   *   ★ **보여야 피한다.** 규칙에 0.9초의 비행 시간을 둔 이유가 이것인데,
   *     그 0.9초 동안 화면에 아무것도 없으면 그건 없는 시간이다 —
   *     「피할 수 있었다」와 「그냥 맞았다」가 구별이 안 된다.
   *
   *   ★ 우리 탄과 **색이 반대**다. 우리 것은 푸른 계열, 적의 것은
   *     붉은 계열 — 화면에 둘이 섞여 날 때 어느 쪽이 위험한지가
   *     글자 없이 읽혀야 한다
   */
  function incoming(from, left, total) {
    const k = 1 - Math.max(0, Math.min(1, left / Math.max(0.01, total)));
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.55 + k * 0.9, 6, 5),
      fireMat(0xff4a3a),
    );
    // 멀리서 가까이 — 자리를 매 프레임 다시 준다 (규칙이 시계를 들고 있다)
    m.position.copy(from).multiplyScalar(1 - k * 0.92);
    return m;
  }
  /** 지금 날아오는 것들 — 규칙이 준 목록 그대로 다시 그린다 */
  let inGroup = new THREE.Group();
  inGroup.name = '적탄';
  g.add(inGroup);

  return {
    group: g,
    fire,
    pop,
    /**
     * ★ 규칙이 든 목록을 **통째로 다시 그린다.** 낱낱이 짝을 맞춰
     *   들고 있으면 「부순 적의 탄이 남는다」 같은 어긋남이 나는데,
     *   개수가 몇 개뿐이라 다시 그리는 편이 싸고 안 갈라진다
     */
    setIncoming(list) {
      g.remove(inGroup);
      inGroup = new THREE.Group();
      inGroup.name = '적탄';
      for (const s of list ?? []) {
        inGroup.add(incoming(atOf(s.az, s.el, s.dist), s.t, 0.9));
      }
      g.add(inGroup);
    },
    /**
     * ★★★ **날아가는 것이 표적을 따라간다** (v79).
     *
     *   ★ 사장님 「현재 **미사일이 날아가는 궤적과 적이 격추되는 지점이
     *     다르게 보이니**」 — 맞는 말이고, 원인은 여기였다.
     *
     *   v78 까지 탄은 **쏜 순간의 자리**로 곧게 날아갔다 (`to` 를 그때
     *   한 번 계산했다). 그런데 규칙(`combat.js stepShots`)은 **닿는 순간의
     *   표적**으로 맞고 안 맞고를 가른다. 표적은 그동안 흐르고 다가오므로
     *   (`target.js` 의 vaz·vel·closes) 둘이 **다른 자리**가 된다:
     *
     *     탄은 「거기 있던 자리」에서 터지고, 적은 「지금 있는 자리」에서
     *     부서진다. 사장님이 보신 것이 정확히 이것이다.
     *
     *   ★★ 유도탄이 유도탄인 이유가 이것이므로, 고침도 **말이 되는 쪽**이다:
     *     탄이 표적을 **쫓는다.** 그러면 궤적의 끝과 격추 지점이 **같은
     *     자리일 수밖에 없다** — 맞춰 놓는 것이 아니라 구조상 같아진다.
     *
     *   @param posOf (id) => Vector3|null — 지금 그 표적이 어디 있나
     */
    update(dt, posOf = null) {
      for (let i = live.length - 1; i >= 0; i--) {
        const s = live[i];
        s.t += dt;
        // ★ 쫓는다. 표적이 사라졌으면(이미 부서졌으면) 마지막 자리로 간다
        if (s.chase != null && posOf) {
          const now = posOf(s.chase);
          if (now) s.to.copy(now);
        }
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
          // ══ ★★★ v84 — **사출 → 점화 → 가속** (`slow-table.js flownAt`) ══
          //  `s.t * s.speed` 였다 — 처음부터 순항 속도라 「점점 가속화」가
          //  없었고, 무엇보다 **규칙(`combat.js`)이 쓰는 비행 시간과 달랐다.**
          //  이제 규칙과 화면이 **같은 함수**를 쓴다
          const gone = Math.min(1, flownAt(s.t, s.speed) / Math.max(1, total));
          s.m.position.copy(s.from).addScaledVector(dir, gone);
          if (s.wobble) {
            // 휜다 — 옆으로 흔들리며 간다.
            // ★ 사출 중에는 안 휜다 — 아직 조종면이 안 산다 (불이 없다)
            const w = lit(s.t) ? 1 : 0;
            s.m.position.x += Math.sin(s.t * 9) * 3.2 * (1 - gone) * w;
            s.m.position.y += Math.cos(s.t * 7) * 2.4 * (1 - gone) * w;
          }
          s.m.lookAt(s.to);
          // ★★ **불은 점화 뒤에만.** 그리고 **속도만큼 길어진다** —
          //   부스트가 도는 동안 꼬리가 자라는 것이 「가속」으로 읽힌다
          if (s.flame) {
            const on = lit(s.t);
            s.flame.visible = on;
            if (s.trail) s.trail.visible = on;
            if (on) {
              const k = speedAt(s.t, s.speed) / Math.max(1, s.speed);   // 0.15 → 1
              s.flame.scale.set(0.8 + Math.random() * 0.3, 0.5 + k * 1.6, 0.8 + Math.random() * 0.3);
              if (s.trail) s.trail.scale.setScalar(0.4 + k * 0.9);
            }
          }
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
    get seen() { return { fired, live: live.length, incoming: inGroup.children.length }; },
  };
}
