// ══════════════════════════════════════════════════════════════════════════
//  배 — 방 둘과 통로 하나. **1단계의 전부다.**
//
//  ★ 이건 그림이 아니라 기하다
//    CLAUDE.md 의 절대 규칙은 「그림은 사장님이 주신다」다. 벽의 **무늬**가
//    그림이고, 벽이 **어디 서 있나**는 기하다. 후자는 「좋아 보이는가」가
//    아니라 「맞나」로 판정되므로 내가 만든다 (docs/space/PLAN.md §1).
//
//  ★ 배는 좁아야 한다
//    이 게임 최대 위험은 왕복 노동이다 (docs/space/USER-VIEW.md §3-1).
//    방을 넓게 만들고 싶은 유혹을 여기서 눌러 둔다 — 조종석에서 기관실까지
//    **걸어서 8초 안쪽**이다. 넓히려면 그 숫자부터 다시 이야기한다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { surface } from '../core/assets.js';
import { buildCockpit, buildOutside } from './cockpit.js';
import { ZONE, MAT, rackRun, handrail, conduit, doorFrame, sign } from './kit.js';

const H = 2.7;          // 천장 높이
const T = 0.16;         // 벽 두께
const DOOR = 1.1;       // 통로 반폭 — 문구멍이 이만큼 뚫린다

/** 걸어 다닐 수 있는 사각형들. 충돌은 이 목록만 본다 */
export const ROOMS = [
  { key: 'cockpit', x0: -3.0, x1: 3.0, z0: -9.5, z1: -3.0, name: '조종석' },
  { key: 'corridor', x0: -DOOR, x1: DOOR, z0: -3.0, z1: 3.5, name: '통로' },
  { key: 'engine', x0: -4.5, x1: 4.5, z0: 3.5, z1: 10.5, name: '기관실' },
];

/** 점 하나가 배 안인가 (반지름만큼 안쪽으로) */
export function inside(x, z, r = 0) {
  for (const m of ROOMS) {
    if (x > m.x0 + r && x < m.x1 - r && z > m.z0 + r && z < m.z1 - r) return true;
  }
  return false;
}

/** 지금 어느 방에 있나 — 조명·소리를 방마다 다르게 하려고 쓴다 */
export function roomAt(x, z) {
  for (const m of ROOMS) {
    if (x >= m.x0 && x <= m.x1 && z >= m.z0 && z <= m.z1) return m.key;
  }
  return null;
}

// ── 만들기 도우미 ───────────────────────────────────────────
function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/**
 * 벽 한 줄. `gaps` 에 적힌 구간은 **비워 둔다** — 문구멍이다.
 * 문을 따로 만들지 않고 벽을 나눠 세우는 쪽을 골랐다. 벽에 구멍을 뚫으려면
 * 형상 연산이 필요한데, 그건 지금 필요 없는 복잡함이다.
 */
function wallRun(parent, mat, axis, fixed, from, to, gaps = []) {
  const segs = [];
  let cur = from;
  for (const [a, b] of gaps.sort((p, q) => p[0] - q[0])) {
    if (a > cur) segs.push([cur, a]);
    cur = Math.max(cur, b);
  }
  if (cur < to) segs.push([cur, to]);

  for (const [a, b] of segs) {
    const len = b - a;
    if (len <= 0.01) continue;
    const mid = (a + b) / 2;
    if (axis === 'x') box(len, H, T, mat, mid, H / 2, fixed, parent);
    else box(T, H, len, mat, fixed, H / 2, mid, parent);
  }
}

function slab(parent, mat, r, y, flip) {
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = flip ? Math.PI / 2 : -Math.PI / 2;
  m.position.set((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2);
  parent.add(m);
  return m;
}

/**
 * 배를 세운다.
 * @returns 게임 로직이 만질 것들 — 계기 바늘 · 밸브 · 열에 반응하는 재질
 */
export function buildShip(scene) {
  const ship = new THREE.Group();
  scene.add(ship);

  // 재질. 그림이 아직 없으면 색만 쓴다 (core/assets.js surface)
  const matWall = surface('surf/hull_wall', { color: 0x4a4f57, roughness: 0.85, metalness: 0.15, repeat: [2, 1] });
  const matEngine = surface('surf/engine_wall', { color: 0x4b423c, roughness: 0.95, metalness: 0.2, repeat: [3, 1] });
  const matFloor = surface('surf/hull_floor', { color: 0x35383d, roughness: 0.9, metalness: 0.1, repeat: [4, 4] });
  const matCeil = surface('surf/hull_ceil', { color: 0x2a2d31, roughness: 1.0, repeat: [3, 3] });

  const [cockpit, corridor, engine] = ROOMS;

  // 바닥·천장
  //
  // ★ 조종석 천장에는 **구멍이 있다.** 머리 위 창(world/cockpit.js) 자리다.
  //   통째로 덮었다가 「위를 봐도 천장뿐」이 됐다 — 창을 만들어 놓고 그 위에
  //   천장을 덮은 것이라 코드로는 아무 이상이 없었다.
  const ROOF = { x0: -1.75, x1: 1.75, z0: -9.42, z1: -7.86 };
  for (const r of ROOMS) {
    slab(ship, matFloor, r, 0, false);
    if (r.key !== 'cockpit') { slab(ship, matCeil, r, H, true); continue; }
    slab(ship, matCeil, { ...r, z0: ROOF.z1 }, H, true);                       // 구멍 뒤
    slab(ship, matCeil, { ...r, z1: ROOF.z0 }, H, true);                       // 구멍 앞
    slab(ship, matCeil, { ...r, x1: ROOF.x0, z0: ROOF.z0, z1: ROOF.z1 }, H, true);  // 왼쪽
    slab(ship, matCeil, { ...r, x0: ROOF.x1, z0: ROOF.z0, z1: ROOF.z1 }, H, true);  // 오른쪽
  }

  // ── 조종석 ──────────────────────────────────────────────
  // 앞쪽은 벽이 아니라 **감싸는 캐노피**다 (world/cockpit.js). 옆벽은
  // 캐노피가 시작하는 z = -7.4 에서 끝난다 — 더 길게 세우면 창을 뚫는다
  wallRun(ship, matWall, 'x', cockpit.z1, cockpit.x0, cockpit.x1, [[-DOOR, DOOR]]);  // 뒤: 통로 구멍
  wallRun(ship, matWall, 'z', cockpit.x0, -7.4, cockpit.z1);
  wallRun(ship, matWall, 'z', cockpit.x1, -7.4, cockpit.z1);

  // ── 통로 ────────────────────────────────────────────────
  wallRun(ship, matWall, 'z', corridor.x0, corridor.z0, corridor.z1);
  wallRun(ship, matWall, 'z', corridor.x1, corridor.z0, corridor.z1);

  // ── 기관실 ──────────────────────────────────────────────
  wallRun(ship, matEngine, 'x', engine.z0, engine.x0, engine.x1, [[-DOOR, DOOR]]);   // 앞: 통로 구멍
  wallRun(ship, matEngine, 'x', engine.z1, engine.x0, engine.x1);
  wallRun(ship, matEngine, 'z', engine.x0, engine.z0, engine.z1);
  wallRun(ship, matEngine, 'z', engine.x1, engine.z0, engine.z1);

  // ── 조종석 안 ───────────────────────────────────────────
  // 캐노피 · 화면 · 좌석 · 띠조명. 참고 사진을 받고 통째로 다시 지었다
  const cock = buildCockpit(ship, cockpit, H);
  buildOutside(scene, cockpit.z0);

  // ── 통로 ────────────────────────────────────────────────
  // 실제 우주선의 문법대로 짓는다: **규격 랙이 벽을 채우고, 가운데만
  // 사람이 지나가고, 손잡이가 사방에 있고, 배관은 정리하지 않는다.**
  // (조사 내용은 docs/space/INTERIOR.md)
  //
  // ★ 통로가 좁아서 랙을 못 세운다 — 폭이 2.2 뿐이다. 그래서 통로에는
  //   **얇은 것**만 붙인다. 랙은 넓은 기관실 몫이다. 좁은 데를 억지로
  //   채우면 지나갈 수가 없고, 그러면 왕복 노동이 더 나빠진다.
  const CZ = ZONE.corridor;
  for (const sx of [-1, 1]) {
    conduit(ship, 'z', sx * (DOOR - 0.14), corridor.z0 + 0.2, corridor.z1 - 0.2, H - 0.3, CZ.accent);
    handrail(ship, 'z', sx * DOOR, corridor.z0 + 0.3, corridor.z1 - 0.3, 1.32, -sx * 0.12);
    // 얇은 정비 패널 몇 장 — 벽이 비어 있으면 통로가 복도가 된다
    for (let i = 0; i < 4; i++) {
      const z = corridor.z0 + 1.0 + i * 1.35;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.7), MAT.faceD);
      p.position.set(sx * (DOOR - 0.05), 0.95, z);
      ship.add(p);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.5),
        new THREE.MeshBasicMaterial({ color: CZ.accent }));
      led.position.set(sx * (DOOR - 0.09), 1.34, z);
      ship.add(led);
    }
  }
  conduit(ship, 'z', 0.34, corridor.z0, corridor.z1, H - 0.14, CZ.light);

  // 문틀 — **발광시킨다.** 추격 중에 통로 입구를 못 찾으면 그것만으로 죽는다
  doorFrame(ship, 0, cockpit.z1, DOOR, H, 0, ZONE.cockpit.light);
  doorFrame(ship, 0, engine.z0, DOOR, H, Math.PI, ZONE.engine.light);
  sign(ship, '조종석', 0, 2.35, cockpit.z1 + 0.03, 0, ZONE.cockpit.light, 0.5);
  sign(ship, '기관실', 0, 2.35, engine.z0 - 0.03, Math.PI, ZONE.engine.light, 0.5);

  // ── 기관실 안 ───────────────────────────────────────────
  // 여기가 랙이 진짜로 서는 곳이다. 폭 9 라 양쪽 벽을 채워도 가운데가 남는다
  const EZ = ZONE.engine;
  rackRun(ship, 'z', engine.x0 + 0.09, engine.z0 + 0.7, engine.z1 - 0.7, 1, EZ.accent, 1);
  rackRun(ship, 'z', engine.x1 - 0.09, engine.z0 + 0.7, engine.z1 - 0.7, -1, EZ.accent, 3);
  for (const sx of [-1, 1]) {
    handrail(ship, 'z', sx * (engine.x1 - 0.56), engine.z0 + 1.0, engine.z1 - 1.0, 1.42, 0);
    conduit(ship, 'z', sx * (engine.x1 - 0.3), engine.z0 + 0.3, engine.z1 - 0.3, H - 0.32, EZ.light);
  }
  conduit(ship, 'x', engine.z1 - 0.9, engine.x0 + 0.6, engine.x1 - 0.6, H - 0.3, EZ.light);

  // 반응로 — 방 한가운데 서 있는 덩어리. 「여기가 심장」이라고 말해 준다.
  // 지나갈 수 있게 벽에서 떼어 놓는다 (걷기 충돌은 아직 방 사각형만 본다)
  const core = new THREE.Group();
  // ★ 위치를 옮겼다. 처음엔 z0+2.4 였는데 **기관실 등이 정확히 그 안에**
  //   들어가 있었다 — 반응로가 새까맣게 나왔고, 나는 금속 재질(환경맵) 탓인
  //   줄 알고 엉뚱한 데를 고쳤다. 등이 물체 속에 있으면 그 물체는 안 밝다.
  //   물체와 조명의 자리를 **같이** 봐야 한다.
  core.position.set(0, 0, engine.z0 + 3.6);
  ship.add(core);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 2.1, 14), MAT.metal);
  drum.position.y = 1.05;
  core.add(drum);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.05, 8, 20), MAT.pipe);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.45 + i * 0.62;
    core.add(ring);
  }
  // 반응로가 스스로 빛난다 — 열이 오르면 main.js 가 이 색을 민다
  const coreGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.34, 14),
    new THREE.MeshBasicMaterial({ color: 0xff9a4a }),
  );
  coreGlow.position.y = 1.28;
  core.add(coreGlow);
  // 반응로에서 천장으로 올라가는 관 넷.
  // ★ 처음엔 비스듬히 기울였더니 **방을 가로지르는 거대한 막대**로 보였다.
  //   좁은 방에서 기울어진 긴 것은 전부 시야를 막는다. 수직으로 세웠다.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, H - 2.1, 8), MAT.pipe);
    up.position.set(Math.cos(a) * 0.66, 2.1 + (H - 2.1) / 2, Math.sin(a) * 0.66 + engine.z0 + 3.6);
    ship.add(up);
  }

  // ── 기관실 밸브 ─────────────────────────────────────────
  // 뒷벽에 붙어 있다. **끝까지 돌려야** 냉각이 열린다
  const valve = new THREE.Group();
  valve.position.set(0, 1.35, engine.z1 - 0.30);
  ship.add(valve);

  // 관은 **밸브 뒤로** 지나간다. 처음엔 앞에 뒀다가 밸브를 통째로 가렸다 —
  // 찍어 보기 전에는 몰랐다 (docs/POSTMORTEM.md §1-③ 움직이는 화면으로 본다).
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x5a5048, roughness: 0.8, metalness: 0.5 });
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, H, 12), pipeMat);
  pipe.position.set(0, H / 2, engine.z1 - 0.15);
  ship.add(pipe);
  const wheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.055, 10, 28),
    new THREE.MeshStandardMaterial({ color: 0x9a4a34, roughness: 0.5, metalness: 0.7 }),
  );
  valve.add(wheel);
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.05, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x8c4530, roughness: 0.5, metalness: 0.7 }),
    );
    spoke.rotation.z = (i * Math.PI) / 4;
    valve.add(spoke);
  }
  // ── 조명 ────────────────────────────────────────────────
  // ★ 숫자가 옛 감각과 다르다 — three r155 부터 조명이 **물리 단위**다.
  //   처음에 예전 감각으로 14 · 5 · 16 을 넣었더니 화면이 거의 검게 나왔다.
  //   「어두운 우주선 분위기」가 아니라 그냥 안 보이는 것이었다.
  //   포스트모템 §1-④ 대로 계수를 더듬지 않고 **찍어서** 확인했다.
  scene.add(new THREE.AmbientLight(0x38455c, 1.1));

  // 조종석 등은 world/cockpit.js 가 스스로 켠다 (화면·띠조명과 같이 잡아야 한다)

  const lampCorridor = new THREE.PointLight(0x93a8c0, 26, 10, 2);
  lampCorridor.position.set(0, H - 0.3, 0.4);
  scene.add(lampCorridor);

  // 기관실 등은 **열에 따라 붉어진다.** 계기를 안 보고도 뜨겁다는 걸 알 수
  // 있어야 한다 (docs/space/PLAN.md §3-1 — 글로 안 알려준다)
  const lampEngine = new THREE.PointLight(0xffb072, 34, 14, 2);
  lampEngine.position.set(0, H - 0.35, engine.z0 + 1.1);   // 문 쪽. 반응로에서 뗀다
  scene.add(lampEngine);
  // 기관실은 9 x 7 이라 등 하나로는 뒤쪽 밸브가 안 보인다.
  // 벽에 너무 붙이면 그 벽만 하얗게 타서 밸브가 되레 안 읽힌다 — 2.8 로 뗐다
  const lampEngine2 = new THREE.PointLight(0xffa060, 14, 10, 2);
  lampEngine2.position.set(0, H - 0.45, engine.z1 - 1.3);  // 밸브 쪽
  scene.add(lampEngine2);
  // 반응로가 방을 데운다 — 열이 오르면 main.js 가 세기를 민다
  const lampCore = new THREE.PointLight(0xff8a3c, 8, 5.5, 2);
  lampCore.position.set(0, 1.35, engine.z0 + 3.6);
  scene.add(lampCore);

  return { cock, valve, wheel, lampEngine, lampEngine2, lampCore, matEngine, coreGlow };
}

