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
import { CIRCUITS } from '../game/chase-table.js';
import { buildCockpit, buildOutside, CANOPY, CONSOLE_PTS, SEATS } from './cockpit.js';
import {
  ZONE, MAT, rackRun, handrail, conduit, chamfer, ringFrames, hatch, sign, breakerPanel,
  servicePanel,
} from './kit.js';
import { buildChart } from './chart.js';
import { buildBench } from './bench.js';
import { buildFoodGauge, buildWinch, buildTradeHatch } from './supply-ui.js';

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
  // ★ **벽 앞으로** 낸다. -0.02 로 뒀더니 유리가 벽 안쪽 면과 정확히 겹쳐서
  //   z 다툼이 났다 — 창이 「까만 얼룩」으로 보였고, 그림자 여드름인 줄 알고
  //   엉뚱한 데(그림자 절두체)를 먼저 고쳤다. 화면을 찍어 보고서야 창이라는
  //   걸 알았다. 겹치는 면은 **눈에 보이는 만큼 띄운다**
  glass.position.z = 0.03;
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
  let chart = null;
  let bench = null;
  let foodGauge = null, winch = null, tradeHatch = null;
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

  // ★ 차단기 — **전력 배분을 여기까지 걸어와서 손으로 한다** (PLAN §7-0 축①).
  //   조종석 화면에 슬라이더를 띄우면 앉아서 다 되고, 그러면 방을 오가는
  //   긴장이 통째로 사라진다. 곁방이 없는 벽(z 2.4~4.2)에 붙였다 —
  //   조종석에서도 기관실에서도 한참 걸어야 하는 자리다.
  const breakers = breakerPanel(ship, spine.x0 + 0.06, 3.3, Math.PI / 2, CIRCUITS, CZ.accent);
  sign(ship, '배전', spine.x0 + 0.1, 2.28, 3.3, Math.PI / 2, CZ.accent, 0.4);

  // ── 점검 패널 — 고장을 손으로 고치는 자리 (game/fault.js) ──
  // ★ **방마다 하나씩, 같은 물건이다.** 고장 종류마다 다른 물건을 만들면
  //   스물여덟 종이 될 때 스물여덟 개를 만들어야 한다. 무엇이 잘못됐는지는
  //   물건이 아니라 **소리와 계기**가 말한다 (PLAN §3-1).
  //   지금은 물린 고장이 쓰는 방 셋뿐이다 — 나머지 넷은 그 방을 쓰는 고장이
  //   생기는 날 같이 넣는다. 미리 깔아 두면 아무 데도 안 닿는 물건이 넷 는다.
  const panels = {
    spine: servicePanel(ship, spine.x1 - 0.06, 5.6, -Math.PI / 2, CZ.accent),
    // ★ 정비실은 **먼 쪽 벽이 아니라 아래쪽 벽**이다. 처음엔 x1 벽에 붙였는데
    //   그 앞이 통째로 작업대·랙이라 **설 자리가 한 칸도 없었다** — 패널은
    //   보이는데 못 간다. 배를 격자로 훑어 서 있을 수 있는 칸을 세어 보고 알았다.
    //   그래서 z0 벽으로 옮겼더니 이번엔 **랙과 겹쳐서 겹쳐 그려졌다** —
    //   그건 화면을 찍어 보고 알았다. 지금은 아무것도 안 붙은 z1 벽이다.
    //   빈 벽을 눈으로 찾는 것보다 **두 번 옮기는 편이 빨랐다**
    workshop: servicePanel(ship, 2.8, R.workshop.z1 - 0.06, Math.PI, ZONE.workshop.accent),
    engine: servicePanel(ship, engine.x0 + 0.06, 12.6, Math.PI / 2, ZONE.engine.accent),
  };
  for (const [key, pnl] of Object.entries(panels)) pnl.room = key;

  // 경보등 — 추격이 붙으면 통로가 붉어진다. **어느 방에 있든 보여야** 한다
  const alarm = new THREE.PointLight(0xff3020, 0, 22, 2);
  alarm.position.set(0, H - 0.25, 3.4);
  scene.add(alarm);

  // ── 관측실 — 밖을 보는 방 ────────────────────────────────
  {
    const r = R.observ, Z = ZONE.observ;
    for (const z of [r.z0 + 1.0, (r.z0 + r.z1) / 2, r.z1 - 1.0]) port(ship, r.x0 + 0.1, z, Math.PI / 2, 0.46);
    // 해도대 — **항로를 고르는 자리.** 여기까지 걸어와야 고를 수 있다
    // (world/chart.js · docs/space/GAP.md §3-A). 전에는 판때기였다
    chart = buildChart(ship, { x: r.x0 + 1.7, z: (r.z0 + r.z1) / 2 }, blockBox, MAT);
    racks(ship, 'x', r.z1 - 0.09, r.x0 + 0.6, r.x1 - 0.7, -1, Z.accent, 2);
  }

  // ── 정비실 — 손을 쓰는 방 ────────────────────────────────
  {
    const r = R.workshop, Z = ZONE.workshop;
    const bx = r.x1 - 0.9, bz = (r.z0 + r.z1) / 2;
    const desk = new THREE.Group();
    desk.position.set(bx, 0, bz);
    ship.add(desk);
    box(desk, 1.3, 0.12, 2.2, MAT.body, 0, 0.9, 0);
    box(desk, 1.2, 0.7, 2.0, MAT.faceD, 0, 0.5, 0);
    box(desk, 0.24, 0.24, 0.24, MAT.rail, -0.3, 1.08, -0.6);        // 바이스
    for (let i = 0; i < 8; i++) box(desk, 0.05, 0.34, 0.05, MAT.rail, 0.5, 1.55, -0.9 + i * 0.26);
    box(desk, 1.1, 0.04, 0.05, new THREE.MeshBasicMaterial({ color: Z.light }), 0, 1.82, 0);
    blockBox(bx, bz, 0.68, 1.12, 0);
    // 진단대 — **계기 셋 중 마지막** (world/bench.js · GAP.md §3-C).
    // 작업대 안쪽 끝에 세워 사람(-x 쪽)을 보게 한다
    // ★ **먼 쪽 끝**에 세운다. 가까운 쪽에 두면 사람이 0.4m 앞에 서게 돼
    //   화면이 시야를 통째로 덮는다. 작업대 너비만큼 물러서야 읽힌다
    bench = buildBench(ship, { x: bx + 0.5, z: bz, ry: -Math.PI / 2 }, MAT);
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
    // 식량 계기 — **숫자는 여기에만 있다** (PLAN §5-2 「체력바를 안 만든다」).
    // 재배대(x -5.05~-3.15)를 피해 문 쪽 벽에 붙인다
    foodGauge = buildFoodGauge(ship, { x: -2.4, z: r.z0 + 0.06, ry: 0 }, MAT);
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
    // 윈치 — **멈춰서 끌어온다.** 「한 통만 더」가 여기서 난다 (PLAN §5-3)
    winch = buildWinch(ship, { x: 3.4, z: r.z0 + 0.06, ry: 0 }, MAT, blockBox);
    // 접수구 — 거점에서만 연다. 상인은 얼굴이 없다 (PLAN §1)
    tradeHatch = buildTradeHatch(ship, { x: 3.4, z: r.z1 - 0.06, ry: Math.PI }, MAT, blockBox);
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
  // ★ 그림자를 켠 뒤 화면이 **너무 어두워졌다.** 그림자가 생기면 「빛이
  //   안 닿는 곳」이 진짜로 까매지므로, 켜기 전과 같은 값이면 안 된다.
  //   바탕빛을 올리는 게 정답이다 — 스포트라이트만 올리면 등 아래만 하얗게
  //   타고 구석은 그대로 까맣다.
  scene.add(new THREE.AmbientLight(0x44536e, 2.1));

  /**
   * 천장등 하나. **SpotLight 로 만든다.**
   *
   * ★ 왜 점광원이 아닌가 — 그림자 때문이다.
   *   PointLight 의 그림자는 **여섯 면(큐브맵)** 을 그려야 한다. 방마다
   *   점광원을 두고 전부 그림자를 켜면 한 프레임에 장면을 마흔 번 넘게
   *   그리는 셈이 된다. SpotLight 는 **한 면**이면 된다.
   *   그리고 실제로도 천장에 박힌 등은 아래로 쏘는 물건이라 더 맞다.
   */
  function ceilingLamp(x, z, color, power, reach, shadow = false) {
    const l = new THREE.SpotLight(color, power, reach, Math.PI * 0.48, 0.75, 1.7);
    l.position.set(x, H - 0.22, z);
    l.target.position.set(x, 0, z);
    scene.add(l);
    scene.add(l.target);
    if (shadow) {
      l.castShadow = true;
      l.shadow.mapSize.set(1024, 1024);
      l.shadow.camera.near = 0.4;
      // ★ 그림자 절두체를 **빛보다 짧게** 자른다. 전에는 빛 도달거리(20)를
      //   그대로 썼는데, 1024짜리 그림자맵이 배 전체에 펴지면서 해상도가
      //   모자라 **관측실 링 프레임이 까만 얼룩으로** 나왔다. 조명은 멀리
      //   가도 되지만 그림자는 그 방 안에서만 있으면 된다
      l.shadow.camera.far = Math.min(reach, 9);
      // 그림자 여드름(shadow acne) 막기. 안 넣으면 벽에 줄무늬가 낀다
      l.shadow.bias = -0.0012;
      l.shadow.normalBias = 0.03;
    }
    return l;
  }

  // ★ 그림자를 **셋만** 켠다. 사람이 오래 머무는 방 셋이다.
  //   전부 켜면 예뻐지는 것보다 느려지는 게 크고, 어차피 곁방은 잠깐 들른다.
  const lampCorridor = ceilingLamp(0, 3.4, 0x93a8c0, 110, 20, true);
  ceilingLamp(0, 8.4, 0x93a8c0, 70, 16);
  ceilingLamp(R.observ.x0 + 2.1, 0.6, ZONE.observ.light, 52, 12);
  ceilingLamp(R.workshop.x1 - 1.7, 0.6, ZONE.workshop.light, 60, 12, true);
  ceilingLamp(R.garden.x0 + 1.5, (R.garden.z0 + R.garden.z1) / 2, ZONE.garden.light, 52, 12);
  ceilingLamp((R.airlock.x0 + R.airlock.x1) / 2, (R.airlock.z0 + R.airlock.z1) / 2, ZONE.airlock.light, 38, 10);

  const lampEngine = ceilingLamp(0, engine.z0 + 1.9, 0xffb072, 74, 18, true);
  void lampCorridor;

  // 반응로가 방을 데운다 — 열이 오르면 main.js 가 세기를 민다.
  // 이건 물체에서 나오는 빛이라 점광원이 맞다 (그림자는 안 켠다)
  const lampCore = new THREE.PointLight(0xff8a3c, 8, 5.5, 2);
  lampCore.position.set(0, 1.35, CORE_Z);
  scene.add(lampCore);

  // ── 그림자를 받고 드리운다 ──────────────────────────────
  // ★ 이게 없으면 **모든 물건이 붕 떠 보인다.** 지금까지 화면이 심심했던
  //   제일 큰 이유였다. 코드만으로 되는 것 중 값이 제일 크다.
  //   스스로 빛나는 것(띠조명·화면)은 그림자를 안 만든다 — 광원 시늉을
  //   하는 물건이 자기 그림자를 드리우면 이상해진다.
  ship.traverse((o) => {
    if (!o.isMesh) return;
    const basic = o.material?.isMeshBasicMaterial;
    o.castShadow = !basic;
    o.receiveShadow = true;
  });

  // skins — 무늬가 실제로 물렸나를 밖에서 볼 수 있게 내어 준다.
  // 「그림을 넣었는데 아무 일도 안 일어난다」를 화면만 보고는 못 가린다.
  // 색만 붙었는지 굴곡까지 붙었는지도 눈으로는 구분이 안 된다.
  const skins = { wall: matWall, engine: matEngine, floor: matFloor, ceil: matCeil };
  return { cock, outside, valve, wheel, breakers, chart, bench, panels,
    foodGauge, winch, tradeHatch, alarm, lampEngine, lampCore, matEngine, coreGlow, skins };
}
