// ══════════════════════════════════════════════════════════════════════════
//  ★★★ 떠도는 것들 — **창밖에 진짜로 세운다** (v69 · docs/space/COMBAT.md)
//
//  ★ 사장님: 「**발사 되는게 안보이잔아? 적 비행선도 안보이고.**
//             이젠 최고 목적은 우주 전투니깐 기획 자체를 바꿔.
//             **우주선 격추 게임으로**」
//
//  ★★★ **v64 가 전투를 만들었는데 보이는 것을 안 만들었다.**
//    레이더 · 락온 · 미사일 세 종 · 적 우주선 · 충돌 — **숫자는 다 있다.**
//    그런데 `world/` 에 적도 탄도 그리는 파일이 **없었다.** 전부 HUD
//    캔버스의 초록 글리프뿐이었고, 그래서 창밖에는 별과 바위만 있었다.
//    **격추 게임인데 격추가 안 보였다.**
//
//  ★ 자리는 **표가 이미 정해 뒀다** (`target.js` 의 az · el · dist).
//    새 숫자를 안 만든다 — 여기는 **그 값을 눈에 보이게** 할 뿐이다.
//
//  ★★ **창밖 그룹에 매단다.** 그래야 배를 틀면 같이 흐른다 — 따로 매달면
//    조종간을 틀어도 적이 안 움직이고, 그건 첫 프레임에 들킨다.
//
//  ★ 그림은 사장님이 주신다 (CLAUDE.md). 여기 도형은 **주신 그림이 올
//    때까지의 임시**다 — 그림이 오면 통째로 걷어낸다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { KINDS } from '../game/target-table.js';

const DEG = Math.PI / 180;

/** 금속 — 어둡고 거칠다. 우주에는 빛이 하나뿐이라 대비가 세다 */
const METAL = () => new THREE.MeshStandardMaterial({ color: 0x6a6f78, roughness: 0.72, metalness: 0.62 });
const DARKM = () => new THREE.MeshStandardMaterial({ color: 0x2f343c, roughness: 0.9, metalness: 0.3 });
const PANELM = () => new THREE.MeshStandardMaterial({ color: 0x25406b, roughness: 0.35, metalness: 0.55 });
const GLOW = (hex) => new THREE.MeshBasicMaterial({ color: hex });

/**
 * ★★ 넷을 **HUD 글리프와 같은 모양**으로 만든다.
 *   화면 속 그림과 창밖이 다르면 「같은 것인지」를 사람이 못 잇는다 —
 *   `world/gunsight.js` 의 `glyph()` 가 위성을 「몸통 + 판 둘」로 그리므로
 *   여기도 그렇게 만든다
 */
function buildOne(kind) {
  const g = new THREE.Group();
  g.name = `표적:${kind}`;
  if (kind === 'sat') {
    // 죽은 위성 — 몸통 + 태양전지판 둘
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 2.2), METAL());
    g.add(body);
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 1.5), PANELM());
      p.position.x = sx * 2.5;
      g.add(p);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.14), DARKM());
      arm.position.x = sx * 1.2;
      g.add(arm);
    }
    // 죽은 것이라 **불이 없다** — 살아 있는 것과 갈라 보여야 한다
  } else if (kind === 'tank') {
    // 버려진 연료통 — 길쭉한 통. 맞으면 크게 터진다
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 2.6, 4, 10), METAL());
    c.rotation.z = Math.PI / 2;
    g.add(c);
    for (const sx of [-1, 1]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.09, 6, 14), DARKM());
      band.rotation.y = Math.PI / 2;
      band.position.x = sx * 0.8;
      g.add(band);
    }
  } else if (kind === 'raider') {
    // ★★ **적 우주선** — 나머지는 떠 있고 **이것만 몬다.**
    //   날렵한 쐐기 + 엔진 불. 실루엣이 달라야 「저건 적이다」가 즉시 읽힌다
    const hull = new THREE.Mesh(new THREE.ConeGeometry(1.15, 4.6, 4), METAL());
    hull.rotation.x = -Math.PI / 2;      // 코가 앞(-z)을 본다
    hull.rotation.z = Math.PI / 4;
    g.add(hull);
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 1.2), DARKM());
      wing.position.set(sx * 1.5, 0, 1.1);
      wing.rotation.y = sx * 0.34;
      g.add(wing);
    }
    // 엔진 불 — **살아 있는 것**의 표시. 죽은 위성과 갈라진다
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.8, 8), GLOW(0xff7a3c));
    fire.rotation.x = Math.PI / 2;
    fire.position.z = 2.7;
    fire.name = '엔진불';
    g.add(fire);
  } else {
    // 파편 — 부순 금속. 불규칙해야 「부서진 것」으로 읽힌다
    const r = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), METAL());
    r.scale.set(1, 0.62, 1.35);
    g.add(r);
    const chip = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.7), DARKM());
    chip.rotation.set(0.4, 0.8, 0.3);
    g.add(chip);
  }
  return g;
}

/**
 * 떠도는 것들을 창밖에 세운다.
 *
 * @param parent 창밖 그룹 — **여기 매달아야 배를 틀 때 같이 흐른다**
 * @returns { update(list, dt), burst(t) }
 */
export function buildTargets(parent) {
  const g = new THREE.Group();
  g.name = '떠도는것들';
  parent.add(g);

  /** id → { group, kind } */
  const live = new Map();
  /** 터진 조각들 */
  const bits = [];

  /**
   * ★★ **각도와 거리를 자리로 바꾼다.** 표가 도(度)로 적어 두었으므로
   *   여기서 한 번만 옮긴다 — 두 곳에서 옮기면 화면과 계기가 갈라진다.
   *   기수가 −z 이므로 방위각은 그 둘레의 회전이다
   */
  const place = (o, t) => {
    const az = t.az * DEG, el = t.el * DEG;
    const d = t.dist;
    o.position.set(
      Math.sin(az) * Math.cos(el) * d,
      Math.sin(el) * d,
      -Math.cos(az) * Math.cos(el) * d,
    );
    // 적은 **이쪽을 본다** — 죽은 것과 갈라지는 두 번째 표시
    if (t.kind === 'raider') o.lookAt(0, 0, 0);
  };

  /** 터짐 — 조각이 튄다. 「맞았나」를 숫자로 안 알려준다 */
  function burst(at, big = false) {
    const n = big ? 14 : 8;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        new THREE.TetrahedronGeometry(big ? 0.55 : 0.34, 0),
        GLOW(i % 3 === 0 ? 0xffd27a : 0xff8a4a),
      );
      m.position.copy(at);
      const s = (big ? 26 : 16) * (0.4 + Math.random());
      bits.push({
        m,
        v: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
          .normalize().multiplyScalar(s),
        t: 0, live: big ? 1.5 : 1.0,
      });
      g.add(m);
    }
  }

  let clock = 0;
  return {
    group: g,
    burst,
    /**
     * @param list `SPACE.sky.list` 와 같은 것 — { id, kind, az, el, dist, hp }
     */
    update(list, dt) {
      clock += dt;
      const seen = new Set();
      for (const t of list ?? []) {
        seen.add(t.id);
        let o = live.get(t.id);
        if (!o) {
          o = buildOne(t.kind);
          // ★ 크기는 표가 정한다 (`KINDS[kind].size`) — 조준 허용각과 **같은
          //   값**을 쓴다. 눈에 큰 것이 맞히기도 쉬워야 한다
          const k = KINDS[t.kind];
          o.scale.setScalar((k?.size ?? 1) * 1.6);
          g.add(o);
          live.set(t.id, o);
        }
        place(o, t);
        // 떠 있는 것은 천천히 돈다 — 멈춰 있으면 그림으로 보인다
        if (t.kind !== 'raider') {
          o.rotation.x += dt * 0.22;
          o.rotation.z += dt * 0.15;
        } else {
          const fire = o.getObjectByName('엔진불');
          if (fire) fire.scale.setScalar(0.8 + Math.sin(clock * 14) * 0.25);
        }
      }
      // 사라진 것 — **터뜨리고** 치운다
      for (const [id, o] of [...live]) {
        if (seen.has(id)) continue;
        burst(o.position, o.name === '표적:raider' || o.name === '표적:tank');
        g.remove(o);
        live.delete(id);
      }
      // 조각들
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        b.t += dt;
        b.m.position.addScaledVector(b.v, dt);
        b.m.rotation.x += dt * 6; b.m.rotation.y += dt * 4;
        const k = 1 - b.t / b.live;
        b.m.scale.setScalar(Math.max(0.01, k));
        if (b.t >= b.live) { g.remove(b.m); bits.splice(i, 1); }
      }
    },
    /** 검사가 「창밖에 정말 있나」를 묻는다 */
    get seen() {
      return { n: live.size, kinds: [...live.values()].map((o) => o.name), bits: bits.length };
    },
  };
}
