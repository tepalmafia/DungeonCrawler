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
  for (const r of ROOMS) {
    slab(ship, matFloor, r, 0, false);
    slab(ship, matCeil, r, H, true);
  }

  // ── 조종석 ──────────────────────────────────────────────
  // 앞(z0)은 창이라 벽을 안 세운다 — **유일하게 밖이 보이는 곳**이다
  wallRun(ship, matWall, 'x', cockpit.z1, cockpit.x0, cockpit.x1, [[-DOOR, DOOR]]);  // 뒤: 통로 구멍
  wallRun(ship, matWall, 'z', cockpit.x0, cockpit.z0, cockpit.z1);
  wallRun(ship, matWall, 'z', cockpit.x1, cockpit.z0, cockpit.z1);

  // ── 통로 ────────────────────────────────────────────────
  wallRun(ship, matWall, 'z', corridor.x0, corridor.z0, corridor.z1);
  wallRun(ship, matWall, 'z', corridor.x1, corridor.z0, corridor.z1);

  // ── 기관실 ──────────────────────────────────────────────
  wallRun(ship, matEngine, 'x', engine.z0, engine.x0, engine.x1, [[-DOOR, DOOR]]);   // 앞: 통로 구멍
  wallRun(ship, matEngine, 'x', engine.z1, engine.x0, engine.x1);
  wallRun(ship, matEngine, 'z', engine.x0, engine.z0, engine.z1);
  wallRun(ship, matEngine, 'z', engine.x1, engine.z0, engine.z1);

  // ── 창 ──────────────────────────────────────────────────
  // 밖이 보이는 것은 여기뿐이다. 지금은 별만 있다 (docs/space/PLAN.md §14-2)
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(6, H),
    new THREE.MeshBasicMaterial({ color: 0x05070d, transparent: true, opacity: 0.55 }),
  );
  glass.position.set(0, H / 2, cockpit.z0 + 0.02);
  ship.add(glass);
  ship.add(starfield(cockpit.z0 - 40));

  // 창틀 — 창이 그냥 검은 사각형으로 안 보이게
  box(6.4, 0.22, 0.22, matWall, 0, H - 0.11, cockpit.z0 + 0.12, ship);
  box(6.4, 0.22, 0.22, matWall, 0, 0.11, cockpit.z0 + 0.12, ship);

  // ── 조종석 콘솔과 계기 ──────────────────────────────────
  const matMetal = new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.6, metalness: 0.6 });
  box(4.2, 0.9, 0.7, matMetal, 0, 0.45, cockpit.z0 + 0.75, ship);

  // 열 계기 — **이 게임 최초의 정보 표시.** UI 가 아니라 배에 붙은 물건이다.
  //
  // ★ 처음엔 창 쪽 벽에 붙였다가 물렀다. 콘솔(깊이 0.7)의 z 범위 안이라
  //   **계기가 콘솔 속에 박혀** 보였다 — 코드로는 안 보이고 찍어 보고 알았다.
  //   콘솔 **위에** 눕혀 놓고 사람 쪽으로 기울인다. 실제로 그렇게 생겼다.
  const gauge = new THREE.Group();
  gauge.position.set(0, 0.93, cockpit.z0 + 0.62);
  gauge.rotation.x = -0.62;                       // 앉은 눈높이로 기울인다
  ship.add(gauge);
  box(1.34, 0.36, 0.05, new THREE.MeshStandardMaterial({ color: 0x101318, roughness: 0.65 }),
    0, 0, 0, gauge);
  const needleMat = new THREE.MeshBasicMaterial({ color: 0x6fd8a0 });
  const needle = box(1.16, 0.19, 0.02, needleMat, 0, 0, 0.035, gauge);
  needle.userData.full = 1.16;

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

  const lampCockpit = new THREE.PointLight(0xa8c8ea, 55, 16, 2);
  lampCockpit.position.set(0, H - 0.35, cockpit.z0 + 3.2);
  scene.add(lampCockpit);

  // 계기판이 스스로 조금 빛나야 한다 — 조종석은 어두운 게 맞지만
  // **읽어야 할 것은 읽혀야 한다**
  const lampConsole = new THREE.PointLight(0x7fd8c0, 10, 4.5, 2);
  lampConsole.position.set(0, 1.5, cockpit.z0 + 1.5);
  scene.add(lampConsole);

  const lampCorridor = new THREE.PointLight(0x93a8c0, 26, 10, 2);
  lampCorridor.position.set(0, H - 0.3, 0.4);
  scene.add(lampCorridor);

  // 기관실 등은 **열에 따라 붉어진다.** 계기를 안 보고도 뜨겁다는 걸 알 수
  // 있어야 한다 (docs/space/PLAN.md §3-1 — 글로 안 알려준다)
  const lampEngine = new THREE.PointLight(0xffb072, 60, 18, 2);
  lampEngine.position.set(0, H - 0.35, engine.z0 + 2.2);
  scene.add(lampEngine);
  // 기관실은 9 x 7 이라 등 하나로는 뒤쪽 밸브가 안 보인다.
  // 벽에 너무 붙이면 그 벽만 하얗게 타서 밸브가 되레 안 읽힌다 — 2.8 로 뗐다
  const lampEngine2 = new THREE.PointLight(0xffa060, 20, 12, 2);
  lampEngine2.position.set(0, H - 0.45, engine.z1 - 2.8);
  scene.add(lampEngine2);

  return { needle, needleMat, valve, wheel, lampEngine, lampEngine2, matEngine };
}

/** 창밖 — 별. 그림이 아니라 점이라 지금 만들어도 규칙에 안 걸린다 */
function starfield(z) {
  const n = 900;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 260;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 180;
    pos[i * 3 + 2] = z - Math.random() * 120;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 0.5, sizeAttenuation: true }));
}
