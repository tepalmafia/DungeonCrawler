// ══════════════════════════════════════════════════════════════════════════
//  ★★★ 회수 — **창밖에 진짜로 뜬다** (v81)
//
//  ★ 사장님 「파괴하고 **적의 지원이 오기전에** 파괴된 적기의 무기나 …
//    회수하고」 · 「우주쓰레기 중 필요한 것들을 **조종석에서 그물이나
//    기타 회수 장비를 쏘아 회수**해서 보충하는 것」
//
//  ★★ 이 저장소가 v64 에서 밟은 함정을 안 밟는다: 그때 **규칙은 다
//    있는데 그리는 파일이 없어서** 「격추 게임인데 격추가 안 보였다」.
//    회수도 똑같다 — 꾸러미가 안 보이면 「주울 것이 있다」가 성립하지
//    않고, 그러면 지원 시계도 아무 뜻이 없다.
//
//  ★ 그리려는 것 셋:
//      ① **꾸러미** — 부순 자리에 남는 덩어리. 천천히 돈다
//      ② **그물** — 기수에서 날아가 꾸러미를 감싼다
//      ③ **줄** — 그물과 배를 잇는다. **감기는 동안 짧아진다**
//
//  ★ 창밖 그룹에 매단다 — 배를 틀면 같이 흐른다 (`targets.js` 와 같은 이유)
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { PACK } from '../game/salvage-table.js';

const DEG = Math.PI / 180;
/** 그물이 나가는 자리 — 탄과 **같은 기수**를 쓴다 (`shots.js` MUZZLE) */
const MUZZLE = new THREE.Vector3(0, -0.4, -11);

const CRATE = () => new THREE.MeshStandardMaterial({
  color: 0x7a6a4a, roughness: 0.85, metalness: 0.35, emissive: 0x241c10,
});
const BAND = () => new THREE.MeshStandardMaterial({
  color: 0x2f343c, roughness: 0.9, metalness: 0.3,
});
const GLOW = (hex, o = 1) => new THREE.MeshBasicMaterial({
  color: hex, transparent: o < 1, opacity: o,
});

/** 자리 — `targets.js` · `shots.js` 와 **같은 식** */
function atOf(az, el, dist) {
  const a = az * DEG, e = el * DEG;
  return new THREE.Vector3(
    Math.sin(a) * Math.cos(e) * dist,
    Math.sin(e) * dist,
    -Math.cos(a) * Math.cos(e) * dist,
  );
}

/**
 * ★ 꾸러미 하나 — **부서진 것에서 뜯어낸 덩어리**로 보여야 한다.
 *   떠도는 파편(`targets.js` 의 junk)과 실루엣이 달라야 「저건 주울 것」이
 *   된다: 파편은 불규칙한 바위, 이것은 **띠를 두른 궤짝**이다
 */
function buildPack(hasPart) {
  const g = new THREE.Group();
  g.name = '잔해꾸러미';
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.5), CRATE());
  g.add(body);
  for (const ax of ['x', 'y']) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(ax === 'x' ? 1.62 : 0.16, ax === 'x' ? 0.16 : 1.22, 1.62),
      BAND(),
    );
    g.add(band);
  }
  // ★ **불이 깜빡인다.** 우주에서 검은 덩어리는 안 보인다 — 실제 구명
  //   장비에도 스트로브가 달린다. 그리고 이게 「아직 여기 있다」를 말한다
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), GLOW(0x9ad4ff));
  lamp.name = '표시등';
  lamp.position.set(0, 0.72, 0);
  g.add(lamp);
  // ★★ 탄두 재료가 든 것은 **다른 색**이다 — 이건 지나치면 안 되는 것이다
  if (hasPart) {
    const mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), GLOW(0xffd27a));
    mark.name = '재료표시';
    mark.position.set(0, -0.78, 0);
    g.add(mark);
  }
  return g;
}

export function buildSalvage(parent) {
  const g = new THREE.Group();
  g.name = '회수';
  parent.add(g);

  /** id → mesh */
  const live = new Map();

  // ── 그물과 줄 ────────────────────────────────────────
  const net = new THREE.Group();
  net.name = '그물';
  net.visible = false;
  // 벌어진 고리 넷 — 「감싼다」가 실루엣으로 읽혀야 한다
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.09, 6, 14), GLOW(0x9ff0c8, 0.95));
  net.add(ring);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.1), GLOW(0x6fd8a0, 0.8));
    const a = (i / 4) * Math.PI * 2;
    arm.position.set(Math.cos(a) * 0.85, Math.sin(a) * 0.85, -0.5);
    net.add(arm);
  }
  g.add(net);

  // ★ 줄 — 두 점을 잇는다. 매 프레임 **끝점만** 옮긴다 (다시 만들면 쓰레기가 쌓인다)
  const ropeGeo = new THREE.BufferGeometry();
  ropeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const rope = new THREE.Line(ropeGeo, new THREE.LineBasicMaterial({
    color: 0x8fe6c0, transparent: true, opacity: 0.55,
  }));
  rope.name = '줄';
  rope.visible = false;
  g.add(rope);

  let clock = 0;

  return {
    group: g,
    /**
     * @param s  `salvage.js summary()` 가 준 것 — { packs, net }
     * @param netAt 그물이 지금 어디쯤 (0~1). 규칙이 든 값에서 뽑는다
     */
    update(s, dt) {
      clock += dt;
      const seen = new Set();
      for (const p of s?.packs ?? []) {
        seen.add(p.id);
        let o = live.get(p.id);
        if (!o) {
          o = buildPack(!!p.part);
          g.add(o);
          live.set(p.id, o);
        }
        o.position.copy(atOf(p.az, p.el, p.dist));
        // 천천히 돈다 — 멈춰 있으면 그림으로 보인다
        o.rotation.x += dt * 0.4;
        o.rotation.y += dt * 0.26;
        // ★★ **흩어지기 시작하면 빨리 깜빡인다** — 「지금 안 주우면 없어진다」를
        //   글자 없이 말한다 (배너는 이미 다른 것으로 차 있다)
        const lamp = o.getObjectByName('표시등');
        if (lamp) {
          const hurry = p.t <= PACK.fading;
          const k = Math.sin(clock * (hurry ? 13 : 3.4));
          lamp.material.color.setHex(hurry ? 0xffb45c : 0x9ad4ff);
          lamp.scale.setScalar(0.7 + (k * 0.5 + 0.5) * (hurry ? 1.1 : 0.5));
        }
        // 크기 — 멀어도 점이 안 되게 (`targets.js` 와 같은 규약)
        const up = Math.max(1, Math.min(3.6, 34 / Math.max(1, p.dist)));
        o.scale.setScalar(up);
      }
      for (const [id, o] of [...live]) {
        if (seen.has(id)) continue;
        g.remove(o);
        live.delete(id);
      }

      // ── 그물 ─────────────────────────────────────────
      const n = s?.net ?? null;
      if (!n) {
        net.visible = false;
        rope.visible = false;
        return;
      }
      const target = live.get(n.pack);
      if (!target) { net.visible = false; rope.visible = false; return; }
      net.visible = true;
      rope.visible = true;
      if (n.phase === 'out') {
        // 날아가는 중 — 기수에서 꾸러미로
        const k = 1 - Math.max(0, Math.min(1, n.t / Math.max(0.01, n.t + 0.0001)));
        net.position.copy(MUZZLE).lerp(target.position, Math.max(0.05, k));
      } else {
        // 감는 중 — **꾸러미에 붙어 있다**
        net.position.copy(target.position);
      }
      net.lookAt(0, 0, 0);
      ring.rotation.z += dt * 2.2;
      const a = ropeGeo.attributes.position.array;
      a[0] = MUZZLE.x; a[1] = MUZZLE.y; a[2] = MUZZLE.z;
      a[3] = net.position.x; a[4] = net.position.y; a[5] = net.position.z;
      ropeGeo.attributes.position.needsUpdate = true;
    },
    /** 검사가 「창밖에 정말 있나」를 묻는다 */
    get seen() {
      return { packs: live.size, net: net.visible, rope: rope.visible };
    },
  };
}
