// ══════════════════════════════════════════════════════════════════════════
//  배 — 방 일곱 개.
//
//  ★ 「그냥 배 같은데」를 고쳤다 (2026-08-03 · 사장님 지적 + 조사)
//    처음 만든 방은 **직육면체 + 평평한 천장**이었다. 그건 건물 논리다.
//    찾아보니 이유가 명확했다:
//
//      건물은 **중력만** 견디면 된다 → 수직 기둥 + 직각 벽
//      우주선은 **사방에서 오는 압력**을 견뎌야 한다 → 원통 + 링 프레임
//
//    그래서 셋을 넣었다 (world/kit.js):
//      · 모따기 — 벽이 바닥·천장으로 45도로 이어진다 (팔각 단면)
//      · 링 프레임 — 일정 간격으로 구조재가 방을 두른다
//      · 압력 해치 — 사각 문구멍이 아니라 모서리를 깎고 잠금쇠를 단 문
//
//  ★ 방을 일곱으로 늘렸다
//    「퀘스트를 많이 하려면 공간이 여럿이어야 한다」는 말씀이 맞다.
//    다만 이 게임 최대 위험은 왕복 노동이다 (docs/space/USER-VIEW.md §3-1).
//    그래서 **통로를 척추로 두고 곁방을 좌우에 붙였다** — 어느 방에서든
//    통로로 한 걸음이면 나온다. 방을 줄줄이 늘어세우면 그 순간 이 게임은
//    뜀박질 시뮬레이터가 된다.
//
//  ★ 문구멍은 **손으로 안 적는다**
//    방이 일곱이면 벽이 스물여덟이고, 어디에 구멍을 뚫는지를 표로 적으면
//    방을 옮길 때마다 어긋난다. **맞닿은 방에서 자동으로 뽑는다.**
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { surface } from '../core/assets.js';
import { buildCockpit, buildOutside, CANOPY, CONSOLE_PTS, SEATS } from './cockpit.js';
import {
  ZONE, MAT, rackRun, handrail, conduit, chamfer, ringFrames, hatch, sign,
} from './kit.js';

const H = 2.7;          // 천장 높이
const T = 0.16;         // 벽 두께
const DOORW = 1.1;      // 문 반폭

/**
 * 방들. **통로가 척추고 곁방이 좌우에 붙는다.**
 * 여기 숫자를 고치면 벽·문구멍·모따기·충돌이 전부 따라온다.
 */
export const ROOMS = [
  { key: 'cockpit', x0: -3.4, x1: 3.4, z0: -9.0, z1: -3.0, name: '조종석', tone: 'cockpit' },
  { key: 'spine', x0: -1.3, x1: 1.3, z0: -3.0, z1: 10.0, name: '통로', tone: 'corridor' },
  { key: 'observ', x0: -5.4, x1: -1.3, z0: -1.2, z1: 2.4, name: '관측실', tone: 'observ' },
  { key: 'workshop', x0: 1.3, x1: 5.4, z0: -1.2, z1: 2.4, name: '정비실', tone: 'workshop' },
  { key: 'garden', x0: -5.4, x1: -1.3, z0: 4.2, z1: 7.8, name: '온실', tone: 'garden' },
  { key: 'airlock', x0: 1.3, x1: 4.3, z0: 4.2, z1: 7.2, name: '에어록', tone: 'airlock' },
  { key: 'engine', x0: -4.6, x1: 4.6, z0: 10.0, z1: 16.0, name: '기관실', tone: 'engine' },
];
const R = Object.fromEntries(ROOMS.map((r) => [r.key, r]));

// ── 충돌 ────────────────────────────────────────────────────
/**
 * 못 지나가는 것들. **buildShip 이 세우면서 같이 채운다** —
 * 기하와 충돌을 두 곳에 적으면 반드시 갈라진다.
 */
export const BLOCKERS = [];
export function blockCircle(x, z, r) { BLOCKERS.push({ t: 'c', x, z, r }); }
export function blockBox(cx, cz, hw, hd, rot = 0) { BLOCKERS.push({ t: 'b', cx, cz, hw, hd, rot }); }

function hitsBlocker(x, z, r) {
  for (const b of BLOCKERS) {
    if (b.t === 'c') {
      const dx = x - b.x, dz = z - b.z, rr = b.r + r;
      if (dx * dx + dz * dz < rr * rr) return true;
    } else {
      const s = Math.sin(b.rot), c = Math.cos(b.rot);
      const dx = x - b.cx, dz = z - b.cz;
      if (Math.abs(dx * c - dz * s) < b.hw + r && Math.abs(dx * s + dz * c) < b.hd + r) return true;
    }
  }
  return false;
}

/** 점이 배 안(방들의 합집합)에 있나. **경계를 포함한다** */
function inUnion(x, z) {
  for (const m of ROOMS) {
    if (x >= m.x0 && x <= m.x1 && z >= m.z0 && z <= m.z1) return true;
  }
  return false;
}

const PROBE = [];
for (let i = 0; i < 8; i++) PROBE.push([Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)]);

/**
 * 점 하나에 설 수 있나.
 *
 * ★ 여기서 **게임을 못 하게 만드는 버그**가 났었다. 처음엔 「어느 한 방의
 *   사각형 안에, 반지름만큼 여유를 두고」로 봤다. 방 하나만 보면 맞는데,
 *   방과 방이 만나는 문턱에서 **아무 방에도 안 속하는 띠**가 생긴다 —
 *   문이 뚫려 있는데 못 지나간다. 방이 일곱이 되면서 그런 문턱이 여섯이다.
 *   그래서 한 방이 아니라 **배 전체(합집합)** 를 본다.
 */
export function inside(x, z, r = 0) {
  if (!inUnion(x, z)) return false;
  if (r > 0) {
    for (const [dx, dz] of PROBE) if (!inUnion(x + dx * r, z + dz * r)) return false;
  }
  return !hitsBlocker(x, z, r);
}

/** 지금 어느 방에 있나 — 조명·소리·창밖을 방마다 다르게 하려고 쓴다 */
export function roomAt(x, z) {
  for (const m of ROOMS) {
    if (x >= m.x0 && x <= m.x1 && z >= m.z0 && z <= m.z1) return m.key;
  }
  return null;
}

// ── 문구멍 뽑기 ─────────────────────────────────────────────
/**
 * 어느 벽에 구멍이 뚫리나 — **맞닿은 방에서 자동으로 뽑는다.**
 * 표로 적으면 방을 옮길 때마다 어긋나고, 그건 「분명히 문이 있는데 못
 * 지나간다」가 된다.
 */
function doorGaps(room, side) {
  const out = [];
  for (const o of ROOMS) {
    if (o === room) continue;
    let touch = false, a = 0, b = 0;
    if (side === 'z0' && Math.abs(o.z1 - room.z0) < 1e-6) { touch = true; a = Math.max(o.x0, room.x0); b = Math.min(o.x1, room.x1); }
    if (side === 'z1' && Math.abs(o.z0 - room.z1) < 1e-6) { touch = true; a = Math.max(o.x0, room.x0); b = Math.min(o.x1, room.x1); }
    if (side === 'x0' && Math.abs(o.x1 - room.x0) < 1e-6) { touch = true; a = Math.max(o.z0, room.z0); b = Math.min(o.z1, room.z1); }
    if (side === 'x1' && Math.abs(o.x0 - room.x1) < 1e-6) { touch = true; a = Math.max(o.z0, room.z0); b = Math.min(o.z1, room.z1); }
    if (!touch || b - a < 0.5) continue;
    // 맞닿은 폭이 아무리 넓어도 문은 문이다. 가운데로 잘라 낸다
    const mid = (a + b) / 2;
    out.push([Math.max(a, mid - DOORW), Math.min(b, mid + DOORW)]);
  }
  return out;
}

// ── 만들기 도우미 ───────────────────────────────────────────
function box(parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function segments(from, to, gaps = []) {
  const out = [];
  let cur = from;
  for (const [a, b] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (a > cur) out.push([cur, a]);
    cur = Math.max(cur, b);
  }
  if (cur < to) out.push([cur, to]);
  return out;
}

function wallRun(parent, mat, axis, fixed, from, to, gaps = []) {
  for (const [a, b] of segments(from, to, gaps)) {
    if (b - a <= 0.01) continue;
    const mid = (a + b) / 2;
    if (axis === 'x') box(parent, b - a, H, T, mat, mid, H / 2, fixed);
    else box(parent, T, H, b - a, mat, fixed, H / 2, mid);
  }
}

function slab(parent, mat, r, y, flip) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), mat);
  m.rotation.x = flip ? Math.PI / 2 : -Math.PI / 2;
  m.position.set((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2);
  parent.add(m);
  return m;
}

/** 둥근 현창 — 곁방에서 밖을 보는 창. 조종석 말고도 밖이 보여야 한다 */
function port(parent, x, z, ry, rad = 0.42) {
  const g = new THREE.Group();
  g.position.set(x, 1.5, z);
  g.rotation.y = ry;
  parent.add(g);
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(rad, 20),
    new THREE.MeshBasicMaterial({ color: 0x060b14, side: THREE.DoubleSide }),
  );
  glass.position.z = -0.02;
  g.add(glass);
  g.add(new THREE.Mesh(new THREE.TorusGeometry(rad + 0.05, 0.07, 8, 24), MAT.metal));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    box(g, 0.07, 0.07, 0.09, MAT.rail, Math.cos(a) * (rad + 0.13), Math.sin(a) * (rad + 0.13), 0.02);
  }
  return g;
}

/** 랙 한 줄을 세우고 **충돌까지 같이 등록한다** — 따로 하면 언젠가 빠뜨린다 */
function racks(parent, axis, fixed, from, to, facing, tint, seed) {
  const out = rackRun(parent, axis, fixed, from, to, facing, tint, seed);
  for (const g of out) {
    const ry = g.rotation.y;
    blockBox(g.position.x - 0.21 * Math.sin(ry), g.position.z - 0.21 * Math.cos(ry), 0.45, 0.21, ry);
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════════════
export function buildShip(scene) {
  const ship = new THREE.Group();
  scene.add(ship);
  BLOCKERS.length = 0;

  const matWall = surface('surf/hull_wall', { color: 0x4a4f57, roughness: 0.85, metalness: 0.18, repeat: [2, 1] });
  const matEngine = surface('surf/engine_wall', { color: 0x4b423c, roughness: 0.95, metalness: 0.22, repeat: [3, 1] });
  const matFloor = surface('surf/hull_floor', { color: 0x35383d, roughness: 0.9, metalness: 0.12, repeat: [4, 4] });
  const matCeil = surface('surf/hull_ceil', { color: 0x2a2d31, roughness: 1.0, repeat: [3, 3] });
  const wallOf = (r) => (r.key === 'engine' || r.key === 'airlock' ? matEngine : matWall);

  const cockpit = R.cockpit, spine = R.spine, engine = R.engine;

  // ── 껍데기 ──────────────────────────────────────────────
  // 방마다 바닥·천장·벽·모따기·링 프레임이 **한 곳에서 다 돈다** —
  // 방을 늘릴 때 ROOMS 에 한 줄만 더하면 되게.
  const ROOF = { x0: -1.75, x1: 1.75, z0: -8.9, z1: -7.4 };   // 조종석 머리 위 창
  for (const r of ROOMS) {
    const tone = ZONE[r.tone];
    const gaps = { z0: doorGaps(r, 'z0'), z1: doorGaps(r, 'z1'), x0: doorGaps(r, 'x0'), x1: doorGaps(r, 'x1') };

    slab(ship, matFloor, r, 0, false);
    if (r.key !== 'cockpit') slab(ship, matCeil, r, H, true);
    else {
      // 조종석 천장에는 구멍이 있다 — 머리 위 창 자리다
      slab(ship, matCeil, { ...r, z0: ROOF.z1 }, H, true);
      slab(ship, matCeil, { ...r, z1: ROOF.z0 }, H, true);
      slab(ship, matCeil, { ...r, x1: ROOF.x0, z0: ROOF.z0, z1: ROOF.z1 }, H, true);
      slab(ship, matCeil, { ...r, x0: ROOF.x1, z0: ROOF.z0, z1: ROOF.z1 }, H, true);
    }

    const w = wallOf(r);
    // 조종석 앞은 벽이 아니라 캐노피다. 옆벽도 캐노피가 시작하는 데서 끝난다
    if (r.key !== 'cockpit') wallRun(ship, w, 'x', r.z0, r.x0, r.x1, gaps.z0);
    wallRun(ship, w, 'x', r.z1, r.x0, r.x1, gaps.z1);
    wallRun(ship, w, 'z', r.x0, r.key === 'cockpit' ? -7.2 : r.z0, r.z1, gaps.x0);
    wallRun(ship, w, 'z', r.x1, r.key === 'cockpit' ? -7.2 : r.z0, r.z1, gaps.x1);

    // ★ 「배 같다」를 고치는 둘
    chamfer(ship, r, H, w, gaps);
    ringFrames(ship, r, H, (r.z1 - r.z0) >= (r.x1 - r.x0) ? 'z' : 'x', 3.2, tone.light);
  }

  // ── 해치 ────────────────────────────────────────────────
  // 색은 **들어가는 방**의 색이다 — 문 색만 보고도 저쪽이 어디인지 안다
  const HATCHES = [
    ['cockpit', 0, spine.z0, 0],
    ['engine', 0, spine.z1, Math.PI],
    ['observ', spine.x0, 0.6, -Math.PI / 2],
    ['workshop', spine.x1, 0.6, Math.PI / 2],
    ['garden', spine.x0, 6.0, -Math.PI / 2],
    ['airlock', spine.x1, 5.7, Math.PI / 2],
  ];
  for (const [to, x, z, ry] of HATCHES) {
    hatch(ship, x, z, DOORW, H, ry, ZONE[R[to].tone].light);
    sign(ship, R[to].name, x + Math.sin(ry) * 0.26, 2.34, z + Math.cos(ry) * 0.26, ry, ZONE[R[to].tone].light, 0.48);
  }

  // ── 조종석 ──────────────────────────────────────────────
  const cock = buildCockpit(ship, cockpit, H);
  const outside = buildOutside(scene, cockpit.z0);

  // ── 통로 ────────────────────────────────────────────────
  // 좁으니 **얇은 것만** 붙인다. 억지로 채우면 못 지나가고, 그러면 왕복
  // 노동이 더 나빠진다.
  const CZ = ZONE.corridor;
  for (const sx of [-1, 1]) {
    conduit(ship, 'z', sx * (spine.x1 - 0.2), spine.z0 + 0.3, spine.z1 - 0.3, H - 0.36, CZ.accent);
    handrail(ship, 'z', sx * spine.x1, spine.z0 + 0.4, spine.z1 - 0.4, 1.32, -sx * 0.13);
  }
  conduit(ship, 'z', 0.34, spine.z0, spine.z1, H - 0.16, CZ.light);

  // ── 관측실 — 밖을 보는 방 ────────────────────────────────
  {
    const r = R.observ, Z = ZONE.observ;
    for (const z of [r.z0 + 1.0, (r.z0 + r.z1) / 2, r.z1 - 1.0]) port(ship, r.x0 + 0.1, z, Math.PI / 2, 0.46);
    // 해도대 — 항로를 고르는 자리 (docs/space/PLAN.md §7-2)
    const t = new THREE.Group();
    t.position.set(r.x0 + 1.7, 0, (r.z0 + r.z1) / 2);
    ship.add(t);
    box(t, 1.5, 0.1, 1.0, MAT.body, 0, 0.92, 0);
    box(t, 1.3, 0.03, 0.82, new THREE.MeshBasicMaterial({ color: 0x0b2233 }), 0, 0.98, 0);
    for (const sx of [-0.65, 0.65]) for (const sz of [-0.4, 0.4]) box(t, 0.1, 0.9, 0.1, MAT.metal, sx, 0.45, sz);
    blockBox(r.x0 + 1.7, (r.z0 + r.z1) / 2, 0.78, 0.53, 0);
    racks(ship, 'x', r.z1 - 0.09, r.x0 + 0.6, r.x1 - 0.7, -1, Z.accent, 2);
  }

  // ── 정비실 — 손을 쓰는 방 ────────────────────────────────
  {
    const r = R.workshop, Z = ZONE.workshop;
    const bench = new THREE.Group();
    bench.position.set(r.x1 - 0.9, 0, (r.z0 + r.z1) / 2);
    ship.add(bench);
    box(bench, 1.3, 0.12, 2.2, MAT.body, 0, 0.9, 0);
    box(bench, 1.2, 0.7, 2.0, MAT.faceD, 0, 0.5, 0);
    box(bench, 0.24, 0.24, 0.24, MAT.rail, -0.3, 1.08, -0.6);        // 바이스
    for (let i = 0; i < 8; i++) box(bench, 0.05, 0.34, 0.05, MAT.rail, 0.5, 1.55, -0.9 + i * 0.26);
    box(bench, 1.1, 0.04, 0.05, new THREE.MeshBasicMaterial({ color: Z.light }), 0, 1.82, 0);
    blockBox(r.x1 - 0.9, (r.z0 + r.z1) / 2, 0.68, 1.12, 0);
    racks(ship, 'x', r.z0 + 0.09, r.x0 + 0.7, r.x1 - 0.6, 1, Z.accent, 4);
  }

  // ── 온실 — 배에서 유일하게 살아 있는 방 ──────────────────
  {
    const r = R.garden, Z = ZONE.garden;
    for (let i = 0; i < 3; i++) {
      const z = r.z0 + 0.95 + i * 1.0;
      const tray = new THREE.Group();
      tray.position.set(r.x0 + 1.3, 0, z);
      ship.add(tray);
      box(tray, 1.9, 0.16, 0.62, MAT.body, 0, 0.78, 0);
      box(tray, 1.74, 0.06, 0.5, new THREE.MeshStandardMaterial({ color: 0x2c3a24, roughness: 1 }), 0, 0.87, 0);
      // 자라는 것 — 몸이 아니라 **덩어리**라 만들어도 규칙에 안 걸린다
      for (let k = 0; k < 7; k++) {
        const leaf = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.22 + Math.abs(Math.sin(k * 2.3)) * 0.16, 0.1),
          new THREE.MeshStandardMaterial({ color: 0x4e8f45, roughness: 0.9, emissive: 0x0c2a10 }),
        );
        leaf.position.set(-0.7 + k * 0.235, 1.02, 0);
        leaf.rotation.y = k;
        tray.add(leaf);
      }
      // 생장등 — 이 방의 성격이 여기서 나온다
      box(tray, 1.8, 0.06, 0.14, new THREE.MeshBasicMaterial({ color: Z.accent }), 0, 1.74, 0);
      blockBox(r.x0 + 1.3, z, 0.95, 0.31, 0);
    }
    port(ship, r.x0 + 0.1, r.z1 - 0.85, Math.PI / 2, 0.4);
  }

  // ── 에어록 — 여기 너머는 진공 ────────────────────────────
  {
    const r = R.airlock, Z = ZONE.airlock;
    // 바깥문. **안 열린다** — 아직 선외 작업이 없다 (PLAN §13 5단계)
    hatch(ship, r.x1 - 0.03, (r.z0 + r.z1) / 2, 0.95, H, -Math.PI / 2, Z.light);
    blockBox(r.x1 - 0.22, (r.z0 + r.z1) / 2, 0.22, 1.0, 0);
    // 방호복 걸이 둘 — 사람은 없지만 **입을 것은 있다**
    for (const sz of [-0.85, 0.85]) {
      const suit = new THREE.Group();
      suit.position.set(r.x0 + 0.55, 0, (r.z0 + r.z1) / 2 + sz);
      ship.add(suit);
      box(suit, 0.5, 1.05, 0.34, MAT.body, 0, 1.15, 0);
      box(suit, 0.34, 0.3, 0.3, new THREE.MeshStandardMaterial({ color: 0x9aa6b4, roughness: 0.4, metalness: 0.5 }), 0, 1.85, 0);
      box(suit, 0.26, 0.16, 0.05, new THREE.MeshBasicMaterial({ color: 0x1a2a38 }), 0, 1.87, 0.16);
      box(suit, 0.5, 0.06, 0.34, MAT.metal, 0, 2.06, 0);
      blockBox(r.x0 + 0.55, (r.z0 + r.z1) / 2 + sz, 0.3, 0.22, 0);
    }
    // 바닥 위험 줄무늬 — 이 방의 정체
    for (let i = 0; i < 9; i++) {
      box(ship, 1.3, 0.012, 0.22, new THREE.MeshBasicMaterial({ color: i % 2 ? 0x181818 : 0xd8a13a }),
        (r.x0 + r.x1) / 2 + 0.5, 0.008, r.z0 + 0.5 + i * 0.24);
    }
  }

  // ── 기관실 ──────────────────────────────────────────────
  const EZ = ZONE.engine;
  racks(ship, 'z', engine.x0 + 0.09, engine.z0 + 0.8, engine.z1 - 0.8, 1, EZ.accent, 1);
  racks(ship, 'z', engine.x1 - 0.09, engine.z0 + 0.8, engine.z1 - 0.8, -1, EZ.accent, 3);
  for (const sx of [-1, 1]) {
    handrail(ship, 'z', sx * (engine.x1 - 0.58), engine.z0 + 1.0, engine.z1 - 1.0, 1.42, 0);
    conduit(ship, 'z', sx * (engine.x1 - 0.32), engine.z0 + 0.4, engine.z1 - 0.4, H - 0.36, EZ.light);
  }

  // 반응로 — 방 한가운데 서 있는 덩어리. 「여기가 심장」이라고 말해 준다
  const CORE_Z = engine.z0 + 2.6;
  const core = new THREE.Group();
  core.position.set(0, 0, CORE_Z);
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
  const coreGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.34, 14),
    new THREE.MeshBasicMaterial({ color: 0xff9a4a }),
  );
  coreGlow.position.y = 1.28;
  core.add(coreGlow);
  // 반응로에서 천장으로 올라가는 관 넷. **수직**이어야 한다 — 기울이면
  // 좁은 방을 가로지르는 막대가 되어 시야를 막는다
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, H - 2.1, 8), MAT.pipe);
    up.position.set(Math.cos(a) * 0.66, 2.1 + (H - 2.1) / 2, Math.sin(a) * 0.66 + CORE_Z);
    ship.add(up);
  }

  // 냉각 밸브 — 1단계의 유일한 상호작용. **끝까지 돌려야** 열린다
  const valve = new THREE.Group();
  valve.position.set(0, 1.35, engine.z1 - 0.30);
  ship.add(valve);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, H, 12), MAT.pipe);
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

  // ── 나머지 충돌 ─────────────────────────────────────────
  const segRot = (a, b) => -Math.atan2(b[1] - a[1], b[0] - a[0]);
  const segLen = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (let i = 0; i < CANOPY.length - 1; i++) {
    const a = CANOPY[i], b = CANOPY[i + 1];
    blockBox((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, segLen(a, b) / 2, 0.16, segRot(a, b));
  }
  for (let i = 0; i < CONSOLE_PTS.length - 1; i++) {
    const a = CONSOLE_PTS[i], b = CONSOLE_PTS[i + 1];
    blockBox((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, segLen(a, b) / 2, 0.26, segRot(a, b));
  }
  for (const [sx, sz] of SEATS) blockBox(sx, sz, 0.34, 0.34, 0);
  blockCircle(0, CORE_Z, 0.82);
  blockCircle(0, engine.z1 - 0.30, 0.30);

  // ── 조명 ────────────────────────────────────────────────
  // ★ 점광원은 화면에 보이는 **모든 픽셀**에서 계산된다. 방마다 등을 늘리면
  //   그 값을 배 전체가 치른다 — 조명 9개를 6개로 줄여 15% 빨라졌다.
  //   방이 일곱이 됐어도 **방마다 하나**를 넘기지 않는다. 나머지 방은
  //   띠조명·생장등 같은 **스스로 빛나는 물건**으로 버틴다 (공짜다).
  //   three r155 부터 조명이 물리 단위라 값이 예전 감각보다 훨씬 크다.
  scene.add(new THREE.AmbientLight(0x38455c, 1.15));

  const lampCorridor = new THREE.PointLight(0x93a8c0, 46, 18, 2);
  lampCorridor.position.set(0, H - 0.3, 3.4);
  scene.add(lampCorridor);

  const lampObserv = new THREE.PointLight(ZONE.observ.light, 20, 9, 2);
  lampObserv.position.set(R.observ.x0 + 2.1, H - 0.4, 0.6);
  scene.add(lampObserv);

  const lampWork = new THREE.PointLight(ZONE.workshop.light, 22, 9, 2);
  lampWork.position.set(R.workshop.x1 - 1.7, H - 0.4, 0.6);
  scene.add(lampWork);

  const lampGarden = new THREE.PointLight(ZONE.garden.light, 20, 9, 2);
  lampGarden.position.set(R.garden.x0 + 1.5, 2.1, (R.garden.z0 + R.garden.z1) / 2);
  scene.add(lampGarden);

  const lampAir = new THREE.PointLight(ZONE.airlock.light, 14, 7, 2);
  lampAir.position.set((R.airlock.x0 + R.airlock.x1) / 2, H - 0.4, (R.airlock.z0 + R.airlock.z1) / 2);
  scene.add(lampAir);

  const lampEngine = new THREE.PointLight(0xffb072, 44, 17, 2);
  lampEngine.position.set(0, H - 0.35, engine.z0 + 1.9);
  scene.add(lampEngine);

  // 반응로가 방을 데운다 — 열이 오르면 main.js 가 세기를 민다
  const lampCore = new THREE.PointLight(0xff8a3c, 8, 5.5, 2);
  lampCore.position.set(0, 1.35, CORE_Z);
  scene.add(lampCore);

  return { cock, outside, valve, wheel, lampEngine, lampCore, matEngine, coreGlow };
}
