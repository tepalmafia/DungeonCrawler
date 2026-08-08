// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **탄두 크레이들** — 기관실 후미 격벽 (v71 · docs/space/WAR.md §3)
//
//  ★ 사장님: 「**가장 후미에 핵탄두가 장착된 것**도 만들어줘.
//             기관실에 있으면 되겟지?」 — 네, 맞습니다.
//
//  ══ ★★ 다섯 칸이 곧 진행도 ═══════════════════════════════════════════
//
//    이 배는 **글로 안 알려준다.** 「재료 3/5」라고 띄우면 그건 목표
//    목록이고, 목표 목록이 있는 순간 여정이 심부름이 된다.
//    대신 **칸에 불이 들어온다** — 기관실에 들어설 때마다 눈에 들어오고,
//    그게 「얼마나 왔나」다.
//
//  ★★ 그리고 **탄두가 데워진다.** 기관실은 열의 심장이라 추진을 켤 때마다
//    여기가 뜨거워진다 (`warhead-table.js BAKE`). 뜨거우면 **몸통이
//    붉어진다** — 숫자를 안 보고도 안다.
//
//  ★ 그림은 사장님이 주십니다 (CLAUDE.md). 여기 도형은 **주신 그림이
//    올 때까지의 임시**입니다 — 오면 통째로 걷어냅니다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { PARTS5, CRADLE, BAKE } from '../game/warhead-table.js';

const STEEL = () => new THREE.MeshStandardMaterial({ color: 0x6d7480, roughness: 0.55, metalness: 0.7 });
const DARK = () => new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.85, metalness: 0.3 });
const STRIPE = () => new THREE.MeshStandardMaterial({ color: 0xd8a63a, roughness: 0.7, metalness: 0.2 });

function box(parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/**
 * 크레이들을 세운다.
 *
 * @param parent 배 그룹
 * @returns { group, hit, update(s), at }
 */
export function buildCradle(parent) {
  const g = new THREE.Group();
  g.name = '탄두 크레이들';
  g.position.set(CRADLE.at.x, 0, CRADLE.at.z);
  parent.add(g);

  // ── 받침대 ───────────────────────────────────────────
  box(g, 3.4, 0.28, 1.1, DARK(), 0, 0.30, 0);
  for (const sx of [-1, 1]) box(g, 0.22, 0.9, 0.9, STEEL(), sx * 1.5, 0.75, 0);

  // ── ★★ 탄두 본체 — **눕혀 놓은 원뿔.** 실제 재돌입체가 그렇다
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.46, 2.0, 12),
    new THREE.MeshStandardMaterial({ color: 0x8d949e, roughness: 0.45, metalness: 0.75 }),
  );
  body.rotation.z = Math.PI / 2;
  body.position.set(0, 1.05, 0);
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.9, 12), body.material);
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(1.45, 1.05, 0);
  g.add(nose);
  // 위험 줄무늬 — 군용 표식 규약 (v50 베이 번호와 같은 줄)
  for (const x of [-0.55, 0.15]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 6, 16), STRIPE());
    band.rotation.y = Math.PI / 2;
    band.position.set(x, 1.05, 0);
    g.add(band);
  }

  // ── ★★★ 다섯 칸 — **꽂히면 불이 들어온다** ───────────
  const slots = [];
  PARTS5.forEach((p, i) => {
    const x = -1.28 + i * 0.64;
    // 소켓
    box(g, 0.36, 0.10, 0.34, DARK(), x, 1.62, 0.06);
    // 불 — 꺼져 있으면 어둡고, 꽂히면 초록
    const lampMat = new THREE.MeshBasicMaterial({ color: 0x2a3038 });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.22), lampMat);
    lamp.position.set(x, 1.69, 0.06);
    g.add(lamp);
    // 꽂힌 재료 — 작은 통. 빈 칸에는 안 보인다
    const partMat = new THREE.MeshStandardMaterial({ color: 0xb9c2cc, roughness: 0.4, metalness: 0.6 });
    const part = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.30, 8), partMat);
    part.position.set(x, 1.82, 0.06);
    part.visible = false;
    g.add(part);
    slots.push({ key: p.key, lampMat, part });
  });

  // ── 손잡이 — **잡고 있어야 꽂힌다** ───────────────────
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.40, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8a63a, roughness: 0.5, metalness: 0.4 }),
  );
  grip.rotation.z = Math.PI / 2;
  grip.position.set(0, 1.42, 0.34);
  g.add(grip);

  // ★ 판정 상자 — **넉넉하게.** 작은 것을 정확히 겨누게 하는 건
  //   어려움이 아니라 짜증이다 (v66 에 갈래 판에서 배운 것)
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1.1, 1.0),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.set(0, 1.35, 0.20);
  hit.name = '탄두 크레이들';
  g.add(hit);

  // 채움 띠 — 잡고 있는 동안 차오른다
  const barMat = new THREE.MeshBasicMaterial({ color: 0x6fd8a0 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.06), barMat);
  bar.position.set(0, 1.24, 0.36);
  bar.visible = false;
  g.add(bar);

  return {
    group: g,
    hit,
    at: { x: CRADLE.at.x, z: CRADLE.at.z },
    /**
     * @param s `warhead.js summary()` 그대로
     */
    update(s) {
      for (const sl of slots) {
        const inIt = s.in?.includes(sl.key);
        sl.lampMat.color.set(inIt ? 0x6fd8a0 : 0x2a3038);
        sl.part.visible = !!inIt;
      }
      // ══ ★★ **뜨거우면 몸통이 붉어진다** — 숫자를 안 보고도 안다 ══════
      //
      //  ★ 처음엔 `bake / max` 를 그대로 썼다. 브라우저로 찍어 보니
      //    **72 에서 이미 새빨갰다** — 그러면 「뜨겁다」와 「곧 잃는다」가
      //    구별이 안 되고, 색이 경고가 아니라 그냥 도색이 된다.
      //  ★ **경고선(`warn`)부터** 물들기 시작해야 한다. 그 아래는 회색
      //    금속이고, 거기서부터 한계까지가 눈으로 세는 구간이다
      const k = Math.max(0, Math.min(1,
        ((s.bake ?? 0) - BAKE.warn) / Math.max(1, BAKE.max - BAKE.warn)));
      body.material.emissive = body.material.emissive ?? new THREE.Color();
      body.material.emissive.setRGB(k * 0.62, k * 0.10, 0);
      // 무장했으면 **전부**가 달아오른다 — 되돌릴 수 없는 것은 눈에 띄어야 한다
      if (s.armed) body.material.emissive.setRGB(0.85, 0.30, 0.08);
      const held = s.armed ? 0 : Math.max(s.held ?? 0, s.arm ?? 0);
      bar.visible = held > 0.01;
      bar.scale.x = Math.max(0.02, held);
    },
    /** 검사가 「불이 몇 개 켜졌나」를 묻는다 */
    get seen() {
      return {
        lit: slots.filter((s) => s.part.visible).length,
        hot: body.material.emissive ? +body.material.emissive.r.toFixed(2) : 0,
      };
    },
  };
}
