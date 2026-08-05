// ══════════════════════════════════════════════════════════════════════════
//  옮길 수 있는 물건 — **그림.** 규칙은 game/carry.js 가 갖는다.
//
//  ★ 붙이는 자리는 **베이다**
//    `carry-table.js SPOTS` 는 자리를 「기관 4」처럼 **베이 번호**로 부른다.
//    그래서 여기서는 좌표를 새로 적지 않고 **그 번호를 단 랙을 찾아** 그
//    앞면에 붙인다. 좌표를 여기 또 적으면 랙을 옮길 때마다 자리가
//    허공에 남고, 그건 「분명히 있는데 못 붙인다」가 된다.
//    (번호를 붙여 둔 것이 여기서 두 번째로 값을 한다 — 첫 번째는 랙이
//     점검 패널을 뚫고 있던 것을 드러낸 일이었다)
//
//  ★ 물건은 **손에 들면 카메라에 붙는다**
//    세상에 둔 채 카메라를 따라다니게 하면 벽을 뚫고 물건이 끌려간다.
//    부모를 바꾸는 편이 간단하고, 「내 손에 있다」가 화면에서 분명해진다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { MAT } from './kit.js';
import { KINDS, SPOTS, CARRY } from '../game/carry-table.js';

function box(parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** 물건 하나의 몸 — 종류마다 다르게 생겨야 멀리서 구분된다 */
function body(kind) {
  const g = new THREE.Group();
  const k = KINDS[kind];
  const tint = new THREE.MeshBasicMaterial({ color: k.tint });
  if (kind === 'coolant') {
    // 통 — 눕혀서 안는다. 실제 냉매통은 원통이고 띠가 둘러 있다
    const can = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.44, 14),
      // ★ 금속기를 낮춘다. 0.7 로 뒀더니 조종석 주황 점광 하나에
      //   **하얗게 타서** 통이 아니라 빛 덩어리로 보였다 (손목 껍데기가
      //   같은 이유로 누렇게 떴던 것과 같은 함정 — 방마다 조명이 다르다)
      new THREE.MeshStandardMaterial({ color: 0x3d4a52, roughness: 0.7, metalness: 0.35 }),
    );
    can.rotation.z = Math.PI / 2;
    g.add(can);
    for (const x of [-0.12, 0.12]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.016, 6, 14), MAT.rail);
      band.rotation.y = Math.PI / 2;
      band.position.x = x;
      g.add(band);
    }
    box(g, 0.05, 0.05, 0.05, tint, 0.24, 0, 0);            // 밸브 쪽 표시
  } else if (kind === 'part') {
    // 상자 — 실제 화물 가방(CTB)의 비율(대략 25×43×24cm)
    box(g, 0.43, 0.24, 0.25, new THREE.MeshStandardMaterial({
      color: 0x4a4f45, roughness: 0.9, metalness: 0.1,
    }), 0, 0, 0);
    box(g, 0.45, 0.04, 0.27, MAT.rail, 0, 0.12, 0);        // 뚜껑 테
    box(g, 0.16, 0.03, 0.03, tint, 0, 0.145, 0.09);        // 손잡이
  } else {
    // 공구 가방 — 한 손으로 멘다. 어깨끈이 있어야 그렇게 읽힌다
    box(g, 0.34, 0.2, 0.16, new THREE.MeshStandardMaterial({
      color: 0x2f3439, roughness: 0.95, metalness: 0.05,
    }), 0, 0, 0);
    box(g, 0.36, 0.035, 0.03, tint, 0, 0.06, 0.08);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 5, 14, Math.PI), MAT.cable);
    strap.position.y = 0.1;
    g.add(strap);
  }
  g.name = k.name;
  return g;
}

/**
 * @param byBay  베이 번호 → 그 번호를 단 물건의 THREE.Group
 * @returns { spots, items, hold(kind), drop(kind, spotKey), aimTargets }
 */
export function buildCarry(ship, camera, byBay) {
  const spots = {};
  const missing = [];
  for (const s of SPOTS) {
    const host = byBay[s.name];
    if (!host) { missing.push(s.name); continue; }

    const g = new THREE.Group();
    // 랙 앞면(로컬 z ≈ 0) 조금 앞. 사람 손이 닿는 높이
    g.position.set(0, 0.95, 0.05);
    host.add(g);

    // 벨크로 자리 — **네 귀퉁이 물림쇠.** 무늬 하나로 「여기 붙인다」가
    // 읽혀야 한다. 빈 자리와 찬 자리가 눈에 달라야 하므로 물림쇠는
    // 물건이 붙어도 보이게 바깥으로 뺀다
    box(g, 0.5, 0.3, 0.02, new THREE.MeshStandardMaterial({
      color: 0x14171b, roughness: 1, metalness: 0,
    }), 0, 0, 0);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      box(g, 0.05, 0.05, 0.045, MAT.rail, sx * 0.23, sy * 0.14, 0.015);
    }

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.5, 0.3),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.position.set(0, 0, 0.1);
    g.add(hit);

    spots[s.key] = { key: s.key, name: s.name, group: g, hit };
  }
  if (missing.length) {
    // ★ **조용히 넘어가지 않는다.** 자리가 없으면 물건을 영영 못 놓는데,
    //   그건 화면만 봐서는 「원래 없는 자리」로 보인다
    console.warn(`[carry] 붙일 자리를 못 찾았습니다: ${missing.join(' · ')}`
      + ' — game/carry-table.js SPOTS 의 이름이 베이 번호와 다릅니다');
  }

  // 물건들
  const items = {};
  for (const kind of Object.keys(KINDS)) {
    const g = body(kind);
    ship.add(g);
    items[kind] = g;
  }

  // 손에 든 것이 앉는 자리 — 카메라의 자식. 화면 아래를 조금만 먹는다.
  //
  // ★ 첫 판은 **화면 한복판 아래**였다. 조준선은 안 가렸지만 냉매통이
  //   시야의 아래 절반을 통째로 채워서, 창밖도 콘솔도 안 보였다.
  //   손과 같은 처방으로 고쳤다 — **오른쪽 아래 구석으로 밀고 줄인다**
  //   (game/hand-table.js 의 rest 자리와 같은 이유).
  const inHand = new THREE.Group();
  inHand.position.set(0.30, -0.44, -0.66);
  inHand.rotation.set(-0.26, 0.44, 0.14);
  inHand.scale.setScalar(0.78);
  camera.add(inHand);

  /**
   * 지금 상태대로 물건들을 제자리에 놓는다.
   * @param held 손에 든 종류 (없으면 null)
   * @param at   종류 → 붙어 있는 자리 키
   */
  function place(held, at) {
    for (const [kind, g] of Object.entries(items)) {
      if (kind === held) {
        if (g.parent !== inHand) { inHand.add(g); g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); }
        g.visible = true;
        continue;
      }
      const spot = spots[at[kind]];
      if (!spot) { g.visible = false; continue; }
      if (g.parent !== spot.group) { spot.group.add(g); }
      g.position.set(0, 0, 0.16);
      g.rotation.set(0, 0, 0);
      g.visible = true;
    }
  }

  return {
    spots,
    items,
    inHand,
    place,
    /** 조준 판정에 넣을 것들 */
    get aimTargets() { return Object.values(spots).map((s) => s.hit); },
    /** 조준선이 걸린 것이 어느 자리인가 */
    spotOf(obj) {
      for (const s of Object.values(spots)) if (s.hit === obj) return s.key;
      return null;
    },
  };
}
