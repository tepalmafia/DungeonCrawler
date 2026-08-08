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
import { ROOMS, ROOM } from '../game/rooms-table.js';
import { surface } from '../core/assets.js';
import { CIRCUITS } from '../game/chase-table.js';
import { buildRadio } from './radio.js';
import { buildCockpit, buildOutside, setPlan, CANOPY, CONSOLE_PTS, SEATS } from './cockpit.js';
import {
  ZONE, MAT, rackRun, standoff, chamfer, ringFrames, hatch, sign, breakerPanel,
  servicePanel,
} from './kit.js';
import { bay, PANEL_BAY, FIRST_RACK } from '../game/bay-table.js';
import { buildChart } from './chart.js';
import { buildBench } from './bench.js';
import { buildCradle } from './cradle.js';
import { buildFoodGauge, buildWinch, buildTradeHatch, buildOuterDoor } from './supply-ui.js';
import { buildDoor } from './door.js';
import { DOOR } from '../game/door-table.js';
// ★ v64 — 주포(포탑·사다리·조준석)를 걷어냈다. 조준경만 남는다
import { LADDER } from './turret.js';
import { buildSight } from './gunsight.js';
import { buildStatusHud } from './status.js';
import { DEP, ROOF, HUD as HUDV } from '../game/view-table.js';

const H = 2.7;          // 천장 높이
const T = 0.16;         // 벽 두께
// ★ 문 반폭은 **표가 갖는다.** 여기 따로 적으면 문짝과 문구멍이 갈라지고,
//   그건 「분명히 문이 있는데 못 지나간다」가 된다
const DOORW = DOOR.half;

/**
 * 창 — **방의 주인공이다** (docs/space/REF.md).
 * 참고 여섯 장 전부 벽 한 면이 통째로 창이고, 밖이 방을 밝힌다.
 * 우리 것은 지름 0.42m 짜리 동그라미 셋이었다.
 */
/**
 * 어느 방의 어느 벽에 창을 내나 — **바깥으로 난 벽**이다.
 * 조종석은 캐노피가 이미 창이고, 통로는 양쪽이 다 방이라 창이 없다.
 */
const WINDOWS = {
  observ: 'x0',     // 관측실 — 「밖을 본다」가 목적인 방
  garden: 'x0',     // 온실 — 빛이 들어와야 자란다
  workshop: 'z1',   // 정비실 — 아래쪽 벽이 바깥
  airlock: 'z1',
};

const WIN = {
  sill: 0.95,     // 아래턱 — 사람 허리께. 이보다 낮으면 바닥이 보인다
  head: 2.10,     // 위턱 — 천장(2.7) 아래 리브가 지나갈 자리를 남긴다
  half: 1.15,     // 창 하나의 반폭
};

/**
 * 방들 — **표에서 읽는다** (`game/rooms-table.js`).
 *
 * ★★ v71 에 옮겼다. 이 파일은 three 를 쓰므로 `tools/*.js` 가 못 읽는데,
 *   방 좌표는 **도구도 물어봐야 하는 것**이다 (「기관실이 정말 제일
 *   뒤인가」). 여기서 그대로 다시 내보내므로 쓰던 곳은 안 고쳐도 된다
 */
export { ROOMS } from '../game/rooms-table.js';
const R = ROOM;

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
    // ★ **꺼져 있는 막이는 없는 것이다.** 문이 열리면 여기가 꺼진다 —
    //   목록에서 넣었다 뺐다 하면 순서가 흔들려 언젠가 엉뚱한 것이 지워진다
    if (b.off) continue;
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

/**
 * 벽 한 줄. `gaps` 는 **위아래로 통째로 뚫린** 구멍(문)이고,
 * `wins` 는 **창구멍** — 가운데 띠만 뚫리고 위아래는 벽이 남는다.
 *
 * ★ 창구멍이 왜 필요했나 (2026-08-05 · 사장님이 참고 사진 여섯 장)
 *   곁방 창은 **창이 아니었다.** 벽에는 구멍이 없고, `port()` 가 만든
 *   검은 원반이 솔리드 벽 **앞에 붙어** 있었다. 「창을 만들었다」가
 *   코드에는 있는데 화면에는 없었고, 화면을 찍어 보고서야 알았다.
 *   관측실은 「밖을 본다」가 목적인 방인데 새까만 원반 셋이 전부였다.
 */
function wallRun(parent, mat, axis, fixed, from, to, gaps = [], wins = []) {
  const put = (a, b, y0, y1) => {
    if (b - a <= 0.01 || y1 - y0 <= 0.01) return;
    const mid = (a + b) / 2, h = y1 - y0, cy = (y0 + y1) / 2;
    if (axis === 'x') box(parent, b - a, h, T, mat, mid, cy, fixed);
    else box(parent, T, h, b - a, mat, fixed, cy, mid);
  };
  for (const [a, b] of segments(from, to, gaps)) {
    if (b - a <= 0.01) continue;
    // 이 구간 안에 든 창구멍만 본다
    const here = wins.filter(([wa, wb]) => wb > a && wa < b)
      .map(([wa, wb]) => [Math.max(a, wa), Math.min(b, wb)]);
    if (!here.length) { put(a, b, 0, H); continue; }
    // 창 아래턱 · 위턱은 벽이 남고, 가운데 띠만 창구멍으로 비운다
    put(a, b, 0, WIN.sill);
    put(a, b, WIN.head, H);
    for (const [ca, cb] of segments(a, b, here)) put(ca, cb, WIN.sill, WIN.head);
  }
}

function slab(parent, mat, r, y, flip) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), mat);
  m.rotation.x = flip ? Math.PI / 2 : -Math.PI / 2;
  m.position.set((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2);
  parent.add(m);
  return m;
}

/**
 * **큰 팔각 창** — 방 하나에 하나. 참고 여섯 장이 전부 이렇다 (REF.md).
 *
 * ★ 여기가 「창을 만들었다」와 「창이 있다」의 차이다.
 *   전에는 `port()` 가 **벽 앞에 붙인 검은 원반**이었다. 벽에는 구멍이
 *   없었고 유리는 투명이 아니라 **검정을 칠한 것**이었다. 코드에는 창이
 *   있는데 화면에는 없었다 — 화면을 찍어 보고서야 알았다.
 *   지금은 `wallRun` 이 구멍을 뚫고, 여기는 **틀만** 두른다.
 */
function bigWindow(parent, x, z, ry, half = WIN.half) {
  const g = new THREE.Group();
  g.position.set(x, (WIN.sill + WIN.head) / 2, z);
  g.rotation.y = ry;
  g.name = '창';
  parent.add(g);
  const h = (WIN.head - WIN.sill) / 2;
  // 팔각 — 네 귀퉁이를 45도로 잘라 낸다. 사각 구멍은 건물이고
  // 모서리를 깎으면 압력 용기가 된다 (kit.js chamfer 와 같은 이유)
  const c = Math.min(half, h) * 0.42;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(c * 1.9, 0.14, 0.3), MAT.metal);
    m.position.set(sx * (half - c * 0.5), sy * (h - c * 0.5), 0);
    m.rotation.z = -sx * sy * Math.PI / 4;
    g.add(m);
  }
  // 틀 네 변
  box(g, half * 2 + 0.2, 0.16, 0.3, MAT.metal, 0, h, 0);
  box(g, half * 2 + 0.2, 0.16, 0.3, MAT.metal, 0, -h, 0);
  box(g, 0.16, h * 2, 0.3, MAT.metal, -half, 0, 0);
  box(g, 0.16, h * 2, 0.3, MAT.metal, half, 0, 0);
  // 가운데 세로 살 — 참고 사진의 창은 전부 살로 나뉘어 있다
  box(g, 0.09, h * 2, 0.22, MAT.metal, 0, 0, 0);

  // ★ **창이 방을 밝힌다** — 등을 켜서 밝히는 것이 아니다 (REF.md).
  //   우리 배는 어두운 채로 둔다(「낡은 미래」). 그러면 빛이 어디서
  //   오는지가 컨셉이 되고, 답은 **밖과 계기**다. 창 안쪽에 차고 약한
  //   빛을 하나 두면 창가가 밝고 방 안쪽이 어두워져 **대비가 산다** —
  //   전에는 방 전체가 고르게 까매서 아무것도 안 읽혔다.
  const glow = new THREE.PointLight(0xa8c8ff, 9, 5.5, 2);
  glow.position.set(0, 0, 0.7);
  g.add(glow);
  return g;
}

/** 둥근 현창 — 작은 보조 창. 큰 창이 없는 벽에 쓴다 */
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

/**
 * 아래 모서리 통로에 **몸이 부딪히게** 한다.
 * ★ 안 막으면 배관을 뚫고 걸어간다. 그리고 막으면 통로가 저절로 좁아져
 *   실제 모듈(가운데 통로 1.2m · REALSHIP.md §2)에 가까워진다 — 좁으면
 *   짧고, 짧으면 덜 뛴다 (USER-VIEW §3-1 왕복 노동)
 */
function solid(g) {
  const s = g.userData.solid;
  if (!s) return g;
  const mid = (s.from + s.to) / 2, len = (s.to - s.from) / 2;
  if (s.axis === 'z') blockBox(s.fixed, mid, s.half, len);
  else blockBox(mid, s.fixed, len, s.half);
  return g;
}

/**
 * 방마다 다음 베이 번호가 몇 번인가. **방 하나에 같은 번호가 두 개 나오면
 * 번호가 아니다** — 벽이 두 줄이면 두 줄이 이어서 매겨져야 한다.
 * 1번은 점검 패널 몫이라 랙은 2번부터다 (game/bay-table.js).
 */
const bayNext = {};
/**
 * 베이 번호 → 그 번호를 단 물건. **벨크로 자리가 이걸 읽는다**
 * (world/carry.js — 「기관 4」에 붙인다는 말이 좌표를 안 적고도 성립한다).
 */
const byBay = {};
function nextBayOf(room) {
  return () => {
    bayNext[room] = (bayNext[room] ?? FIRST_RACK - 1) + 1;
    return bay(room, bayNext[room]);
  };
}

/**
 * 그 벽에 **이미 붙어 있는 것들**의 자리를 뽑는다 — 랙이 그 위에 겹쳐
 * 서지 않게. 손으로 「여기는 비워라」라고 적지 않는다: 패널을 옮길 때마다
 * 같이 고쳐야 하고, 그러면 언젠가 어긋난다 (문구멍을 자동으로 뽑는 것과
 * 같은 이유).
 *
 * `half` 는 랙 반폭(0.45) + 패널 반폭(0.33) 이다. 이만큼 안 떨어지면 겹친다.
 */
function taken(objs, axis, fixed, half = 0.8) {
  const out = [];
  for (const o of objs) {
    const g = o.group ?? o;
    const on = axis === 'z' ? g.position.x : g.position.z;
    const at = axis === 'z' ? g.position.z : g.position.x;
    if (Math.abs(on - fixed) > 0.4) continue;      // 다른 벽이면 상관없다
    out.push([at - half, at + half]);
  }
  return out;
}

/** 랙 한 줄을 세우고 **충돌까지 같이 등록한다** — 따로 하면 언젠가 빠뜨린다 */
function racks(parent, axis, fixed, from, to, facing, tint, seed, room = null, avoid = [],
  lift = 0, skipRanges = []) {
  const out = rackRun(parent, axis, fixed, from, to, facing, tint, seed,
    room ? nextBayOf(room) : null, [...taken(avoid, axis, fixed), ...skipRanges], lift);
  for (const g of out) {
    if (g.userData.bay) byBay[g.userData.bay] = g;
    // ★ **띄운 랙은 충돌을 안 건다.** 통로는 이미 아래 스탠드오프가
    //   ±0.62 를 먹어 폭이 1.36m 다 — 실제 모듈의 1.2m 에 거의 닿았고
    //   (REALSHIP.md §2), 여기 또 막으면 사람이 못 지나간다.
    //   좁히는 일은 ① 이 이미 했고, ③ 이 할 일은 **맨 벽을 없애는 것**이다
    if (lift > 0) continue;
    const ry = g.rotation.y;
    blockBox(g.position.x - 0.21 * Math.sin(ry), g.position.z - 0.21 * Math.cos(ry), 0.45, 0.21, ry);
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════════════
export function buildShip(scene, camera = null) {
  let chart = null;
  let bench = null;
  let foodGauge = null, winch = null, tradeHatch = null, radio = null, suitRack = null;
  const ship = new THREE.Group();
  scene.add(ship);
  BLOCKERS.length = 0;
  for (const k of Object.keys(bayNext)) delete bayNext[k];
  for (const k of Object.keys(byBay)) delete byBay[k];

  const matWall = surface('surf/hull_wall', { color: 0x4a4f57, roughness: 0.85, metalness: 0.18, repeat: [2, 1] });
  const matEngine = surface('surf/engine_wall', { color: 0x4b423c, roughness: 0.95, metalness: 0.22, repeat: [3, 1] });
  const matFloor = surface('surf/hull_floor', { color: 0x35383d, roughness: 0.9, metalness: 0.12, repeat: [4, 4] });
  const matCeil = surface('surf/hull_ceil', { color: 0x2a2d31, roughness: 1.0, repeat: [3, 3] });
  const wallOf = (r) => (r.key === 'engine' || r.key === 'airlock' ? matEngine : matWall);

  const cockpit = R.cockpit, spine = R.spine, engine = R.engine;

  // ── 껍데기 ──────────────────────────────────────────────
  // 방마다 바닥·천장·벽·모따기·링 프레임이 **한 곳에서 다 돈다** —
  // 방을 늘릴 때 ROOMS 에 한 줄만 더하면 되게.
  // 조종석 머리 위 창 — **자리는 `view-table.js` 가 정한다** (v66).
  //   유리 위끝(천장)에서 이어받아야 하므로 시야 표와 같은 값이어야 한다
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
    // ★ **창은 바깥으로 난 벽에만.** 곁방은 통로 반대쪽 벽이 바깥이다.
    //   창밖이 방을 밝히므로 이게 조명 설계이기도 하다 (REF.md)
    const winsX0 = WINDOWS[r.key] === 'x0'
      ? [[(r.z0 + r.z1) / 2 - WIN.half, (r.z0 + r.z1) / 2 + WIN.half]] : [];
    const winsZ1 = WINDOWS[r.key] === 'z1'
      ? [[(r.x0 + r.x1) / 2 - WIN.half, (r.x0 + r.x1) / 2 + WIN.half]] : [];
    // 조종석 앞은 벽이 아니라 캐노피다. 옆벽도 캐노피가 시작하는 데서 끝난다
    if (r.key !== 'cockpit') wallRun(ship, w, 'x', r.z0, r.x0, r.x1, gaps.z0);
    wallRun(ship, w, 'x', r.z1, r.x0, r.x1, gaps.z1, winsZ1);
    wallRun(ship, w, 'z', r.x0, r.key === 'cockpit' ? -7.2 : r.z0, r.z1, gaps.x0, winsX0);
    wallRun(ship, w, 'z', r.x1, r.key === 'cockpit' ? -7.2 : r.z0, r.z1, gaps.x1);

    // 창틀 — **구멍과 같은 자리에서 세운다.** 두 곳에 적으면 갈라지고,
    // 그건 「틀은 있는데 구멍이 없다」(또는 그 반대)가 된다
    if (winsX0.length) bigWindow(ship, r.x0 + 0.02, (r.z0 + r.z1) / 2, Math.PI / 2);
    if (winsZ1.length) bigWindow(ship, (r.x0 + r.x1) / 2, r.z1 - 0.02, 0);

    // ★ 「배 같다」를 고치는 둘
    chamfer(ship, r, H, w, gaps);
    // ══ ★★★ **캐노피도 개구부다** (v66 · 사장님 「중앙에 철이 막고 있잔아」) ══
    //  조종석은 폭 6.8 · 깊이 6.0 이라 `along = 'x'` 로 갈리고 `n = 1` 이라
    //  **딱 한 줄이 `t = 0` 에 선다.** 그 줄이 앞뒤 벽에 세로 기둥을 세우는데,
    //  조종석의 앞(z0)은 **벽이 아니라 캐노피**다 — 벽이 없는 자리에 벽
    //  기둥을 세우고 있었고, 그게 **높이 2.7m 짜리 쇠기둥이 정확히 12시**에
    //  서 있던 이유다.
    //
    //  ★ 새 규칙이 아니다. 「문구멍에는 기둥을 안 세운다」(v23)를 그대로
    //    쓴다 — **캐노피도 구멍이라고 말해 주면 된다.** `wallRun` 은
    //    이미 조종석 앞을 안 세우는데 `ringFrames` 만 모르고 있었다
    const rgaps = r.key === 'cockpit'
      ? { ...gaps, z0: [[r.x0 - 1, r.x1 + 1]] }
      : gaps;
    ringFrames(ship, r, H, (r.z1 - r.z0) >= (r.x1 - r.x0) ? 'z' : 'x', 3.2, tone.light, rgaps);
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
  // ★ **문짝이 여기서 생긴다.** v22 까지 문틀만 있고 구멍은 영구히 뚫려
  //   있었다 — 배 안에서 움직이는 것이 하나도 없었던 이유의 절반이다
  const doors = [];
  for (const [to, x, z, ry] of HATCHES) {
    hatch(ship, x, z, DOORW, H, ry, ZONE[R[to].tone].light);
    const d = buildDoor(ship, x, z, DOORW, H, ry, ZONE[R[to].tone].light);
    // 닫히면 못 지나간다. **문틀 두께만큼만** 막는다 — 두꺼우면 열려 있어도
    // 걸리는 느낌이 나고, 얇으면 빠른 걸음에 뚫린다
    blockBox(x, z, DOORW, 0.13, ry);
    const bar = BLOCKERS[BLOCKERS.length - 1];
    bar.off = true;                     // 켤 때는 열려 있다고 본다
    doors.push({ key: to, name: R[to].name, x, z, ry, view: d, bar });
    // ★ **이름표를 통로 쪽으로 내민다.** 전에는 `+sin·0.26` 이라 표지가
    //   **자기가 바라보는 쪽으로**, 즉 들어가는 방 안으로 밀려났다.
    //   조종석·기관실은 통로가 z축이라 부호가 우연히 맞아떨어져 보였고,
    //   **곁방 넷(관측실·정비실·온실·에어록)은 방 안쪽을 향해 있어서
    //   통로에서는 하나도 안 읽혔다.** 「내가 어디인지」는 알려주면서
    //   「저 문 너머가 어디인지」는 절대 안 알려주는, 정확히 거꾸로였다.
    //   INTERIOR.md 는 「문 위에 방 이름 일곱」이라고 적어 뒀는데 거짓이었다.
    //   부호를 뒤집어 **읽는 사람이 서 있는 통로 쪽**에 건다.
    sign(ship, R[to].name, x - Math.sin(ry) * 0.26, 2.34, z - Math.cos(ry) * 0.26, ry, ZONE[R[to].tone].light, 0.48);
  }

  // ── 조종석 ──────────────────────────────────────────────
  // ★ 조종석 선체 도면이 **방 좌표를 여기서 받아 간다.** 저쪽에 사각형을
  //   손으로 적어 두면 방을 옮길 때마다 어긋나고, 그건 「도면이 거짓말을
  //   한다」가 된다 — 실제로 방 셋만 그려져 있었고 통로 칸은 열쇠가 안 맞아
  //   영원히 안 켜졌다 (cockpit.js drawShip 참고)
  setPlan(ROOMS);
  const cock = buildCockpit(ship, cockpit, H);
  const outside = buildOutside(scene, cockpit.z0);

  // ── 통로 ────────────────────────────────────────────────
  // 좁으니 **얇은 것만** 붙인다. 억지로 채우면 못 지나가고, 그러면 왕복
  // 노동이 더 나빠진다.
  const CZ = ZONE.corridor;
  // ★ **모서리 통로(스탠드오프) 넷.** 배관·배선·난간이 여기로만 지나간다 —
  //   벽면은 랙·패널·문이 쓴다 (REALSHIP.md §1 · ISS 데스티니와 같은 규칙).
  //
  //   전에는 벽면을 따라 죽 그었다. 그래서 **문 넷을 관통**했고, 끊어 붙이는
  //   땜질을 했다. 지나갈 곳을 정해 놓으면 끊을 일 자체가 없다 —
  //   문은 벽 가운데에 있고 통로는 모서리에 있다.
  for (const cx of ['x0', 'x1']) {
    // 위 모서리는 문 구멍(2.05) 위라 안 끊어도 된다
    standoff(ship, spine, H, 'z', [cx, 'y1'], CZ.accent);
    // ★ **아래 모서리는 문 앞에서 끊는다.** 안 끊었더니 곁방 넷이 통째로
    //   못 가게 됐다 — `space-walk.js` 가 「닿는 칸 0」으로 잡았다.
    //   실제 모듈은 해치가 **끝단(엔드콘)** 에 있어서 이 문제가 없다.
    //   우리 곁방은 긴 벽에 붙어 있어서 생기는 것이고, 그건 ⑦에서 다시 본다
    for (const [a, b] of segments(spine.z0 + 0.25, spine.z1 - 0.25,
      doorGaps(spine, cx).map(([p0, p1]) => [p0 - 0.25, p1 + 0.25]))) {
      if (b - a < 0.6) continue;
      solid(standoff(ship, { ...spine, z0: a - 0.25, z1: b + 0.25 }, H, 'z', [cx, 'y0'], CZ.light, true));
    }
  }

  // ★ 차단기 — **전력 배분을 여기까지 걸어와서 손으로 한다** (PLAN §7-0 축①).
  //   조종석 화면에 슬라이더를 띄우면 앉아서 다 되고, 그러면 방을 오가는
  //   긴장이 통째로 사라진다. 곁방이 없는 벽(z 2.4~4.2)에 붙였다 —
  //   조종석에서도 기관실에서도 한참 걸어야 하는 자리다.
  const breakers = breakerPanel(ship, spine.x0 + 0.06, 3.3, Math.PI / 2, CIRCUITS, CZ.accent,
    nextBayOf('spine')());
  sign(ship, '배전', spine.x0 + 0.1, 2.28, 3.3, Math.PI / 2, CZ.accent, 0.4);

  // ── 점검 패널 — 고장을 손으로 고치는 자리 (game/fault.js) ──
  // ★ **방마다 하나씩, 같은 물건이다.** 고장 종류마다 다른 물건을 만들면
  //   스물여덟 종이 될 때 스물여덟 개를 만들어야 한다. 무엇이 잘못됐는지는
  //   물건이 아니라 **소리와 계기**가 말한다 (PLAN §3-1).
  //   지금은 물린 고장이 쓰는 방 셋뿐이다 — 나머지 넷은 그 방을 쓰는 고장이
  //   생기는 날 같이 넣는다. 미리 깔아 두면 아무 데도 안 닿는 물건이 넷 는다.
  const panels = {
    // ★ 5.6 에 있었는데 **에어록 문(z 5.7 · 폭 ±1.1)의 한복판**이었다.
    //   문짝이 없던 v22 까지는 「구멍 옆에 붙은 판」으로 보였고, 문을 단 뒤로
    //   닫힌 문 속에 패널이 박혔다. 문 없는 구간(z 1.7~4.6)으로 옮긴다 —
    //   차단기(왼쪽 벽 3.3)와 마주 보는 자리라 통로 가운데가 일할 곳이 된다
    spine: servicePanel(ship, spine.x1 - 0.06, 3.0, -Math.PI / 2, CZ.accent, bay('spine', PANEL_BAY)),
    // ★ 정비실은 **먼 쪽 벽이 아니라 아래쪽 벽**이다. 처음엔 x1 벽에 붙였는데
    //   그 앞이 통째로 작업대·랙이라 **설 자리가 한 칸도 없었다** — 패널은
    //   보이는데 못 간다. 배를 격자로 훑어 서 있을 수 있는 칸을 세어 보고 알았다.
    //   그래서 z0 벽으로 옮겼더니 이번엔 **랙과 겹쳐서 겹쳐 그려졌다** —
    //   그건 화면을 찍어 보고 알았다. 지금은 아무것도 안 붙은 z1 벽이다.
    //   빈 벽을 눈으로 찾는 것보다 **두 번 옮기는 편이 빨랐다**
    workshop: servicePanel(ship, 2.8, R.workshop.z1 - 0.06, Math.PI, ZONE.workshop.accent, bay('workshop', PANEL_BAY)),
    engine: servicePanel(ship, engine.x0 + 0.06, 12.6, Math.PI / 2, ZONE.engine.accent, bay('engine', PANEL_BAY)),
    // ★ **방 일곱에 다 깔았다 (v24).** 위 주석은 「고장이 쓰는 방 셋뿐」이라
    //   나머지를 미뤄 뒀는데, 그게 거꾸로였다 — **패널이 없어서 고장을 못
    //   만들고 있었다.** 미소운석은 설계 의도가 「방을 다 훑게 만든다」인데
    //   훑을 자리가 없어서 여섯 달 동안 한 번도 안 나왔다.
    //   빈 벽을 골랐다. 관측실은 해도대 반대편, 온실은 재배대를 피한 z1 벽,
    //   에어록은 윈치·접수구가 없는 z0 벽, 조종석은 콘솔 뒤 오른쪽 벽이다
    observ: servicePanel(ship, -3.0, R.observ.z1 - 0.06, Math.PI, ZONE.observ.accent, bay('observ', PANEL_BAY)),
    garden: servicePanel(ship, -2.6, R.garden.z1 - 0.06, Math.PI, ZONE.garden.accent, bay('garden', PANEL_BAY)),
    // ★ 에어록은 **두 번째 자리**다. 처음엔 z0 벽(2.2, 4.26)에 붙였는데
    //   방호복 걸이(x 1.55~2.15)가 바로 앞이라 **설 자리는 있는데 조준선이
    //   안 잡혔다** — 서는 칸을 세는 것만으로는 못 잡는 종류다. 정비실에서
    //   두 번 옮긴 것과 같은 함정이고, 이번엔 **조준까지 재는 검사**로 찾았다
    airlock: servicePanel(ship, 2.6, R.airlock.z1 - 0.06, Math.PI, ZONE.airlock.accent, bay('airlock', PANEL_BAY)),
    cockpit: servicePanel(ship, R.cockpit.x1 - 0.06, -4.2, -Math.PI / 2, ZONE.cockpit.accent, bay('cockpit', PANEL_BAY)),
  };
  for (const [key, pnl] of Object.entries(panels)) pnl.room = key;
  /** 벽에 이미 붙은 것들 — 랙을 세울 때 이 자리를 비운다 */
  const onWall = [...Object.values(panels), { position: breakers[0].hit.parent.position }];

  // ── 통로 벽 — **맨 벽을 없앤다** (REALSHIP.md §8-③) ──────
  // ★ 실제 모듈은 **네 면이 전부 랙**이고 가운데 통로가 1.2m 다. 우리
  //   통로는 13m 짜리 복도인데 벽에 아무것도 없었다 — 배에서 제일 오래
  //   서 있는 방이 제일 휑했다.
  //
  // ★ **좁히는 일은 ① 이 이미 했다.** 아래 스탠드오프가 좌우 0.62m 씩
  //   먹어 실제 폭이 1.36m 다. 그래서 여기 랙은 **띄워 붙이고 충돌을 안
  //   건다** — 아래는 배관, 위는 물건. 실제 모듈도 바닥 난간 위에 랙이
  //   붙는다. 여기서 또 막으면 사람이 못 지나간다.
  //
  // ★ 문간은 비운다. 랙 반폭(0.45)만큼 더 벌린다 — 문 옆에 딱 붙으면
  //   지나갈 때마다 어깨가 스치는 것으로 보인다
  const doorSkip = (side) => doorGaps(spine, side).map(([a, b]) => [a - 0.5, b + 0.5]);
  racks(ship, 'z', spine.x0 + 0.09, spine.z0 + 0.7, spine.z1 - 0.7, 1, CZ.accent, 5,
    'spine', onWall, 0.78, doorSkip('x0'));
  racks(ship, 'z', spine.x1 - 0.09, spine.z0 + 0.7, spine.z1 - 0.7, -1, CZ.accent, 7,
    'spine', onWall, 0.78, doorSkip('x1'));

  // 경보등 — 추격이 붙으면 통로가 붉어진다. **어느 방에 있든 보여야** 한다
  const alarm = new THREE.PointLight(0xff3020, 0, 22, 2);
  alarm.position.set(0, H - 0.25, 3.4);
  scene.add(alarm);

  // ── 관측실 — 밖을 보는 방 ────────────────────────────────
  {
    const r = R.observ, Z = ZONE.observ;
    // 해도대 — **항로를 고르는 자리.** 여기까지 걸어와야 고를 수 있다
    // (world/chart.js · docs/space/GAP.md §3-A). 전에는 판때기였다
    chart = buildChart(ship, { x: r.x0 + 1.7, z: (r.z0 + r.z1) / 2 }, blockBox, MAT);
    racks(ship, 'x', r.z1 - 0.09, r.x0 + 0.6, r.x1 - 0.7, -1, Z.accent, 2, 'observ', onWall);
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
    racks(ship, 'x', r.z0 + 0.09, r.x0 + 0.7, r.x1 - 0.6, 1, Z.accent, 4, 'workshop', onWall);
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
      // 생장등 — 이 방의 성격이 여기서 나온다.
      // ★ `Z.accent`(0xd8ff7a) 를 그대로 썼더니 **온실이 통째로 연두색
      //   안개**가 됐다. MeshBasic 은 조명 계산을 안 받아 늘 최대 밝기인데
      //   거기에 블룸이 얹혀 번졌다 — 화면을 찍어 보고 알았다.
      //   빛나 보이되 안 타는 값으로 내린다 (REF.md: 참고는 밝되 **고르다**)
      box(tray, 1.8, 0.06, 0.14, new THREE.MeshBasicMaterial({ color: 0x86b552 }), 0, 1.74, 0);
      blockBox(r.x0 + 1.3, z, 0.95, 0.31, 0);
    }
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
    // ★★ 우주복 걸이 둘 — **v62 부터 진짜로 입는다.**
    //   v45~v61 동안 이건 **장식**이었다. 걸이는 서 있는데 사람은 우주복
    //   없이 진공에 나가 125초 동안 윈치를 잡았다 (REAL.md §2-C).
    //   그림은 이미 여기 있었고 규칙만 없었던 셈이다.
    //
    //   ★ **앞쪽(z-0.85) 하나만 잡힌다.** 둘 다 잡히면 「어느 것이 내
    //     것인가」가 생기는데, 사람이 하나뿐인 배에서 그건 없는 질문이다.
    //     뒤쪽 것은 그대로 두어 **여벌이 있다**는 것만 말한다
    for (const sz of [-0.85, 0.85]) {
      const suit = new THREE.Group();
      suit.position.set(r.x0 + 0.55, 0, (r.z0 + r.z1) / 2 + sz);
      ship.add(suit);
      box(suit, 0.5, 1.05, 0.34, MAT.body, 0, 1.15, 0);
      box(suit, 0.34, 0.3, 0.3, new THREE.MeshStandardMaterial({ color: 0x9aa6b4, roughness: 0.4, metalness: 0.5 }), 0, 1.85, 0);
      box(suit, 0.26, 0.16, 0.05, new THREE.MeshBasicMaterial({ color: 0x1a2a38 }), 0, 1.87, 0.16);
      box(suit, 0.5, 0.06, 0.34, MAT.metal, 0, 2.06, 0);
      blockBox(r.x0 + 0.55, (r.z0 + r.z1) / 2 + sz, 0.3, 0.22, 0);
      if (sz > 0) continue;
      // ── 잡히는 쪽 ──
      // 걸이 불 — 입고 있으면 꺼지고 걸려 있으면 켜진다 (「여기 있다」)
      const lampMat = new THREE.MeshBasicMaterial({ color: Z.accent });
      box(suit, 0.1, 0.04, 0.04, lampMat, 0.21, 2.0, 0.17);
      // ★ 조준용 상자는 **보이지 않되 넉넉하게.** 우주복 몸통만 재면
      //   서서 볼 때 헬멧에 가려 안 잡힌다 — v16 의 조종간에서 겪은 것
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 1.55, 0.6),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hit.position.set(0, 1.32, 0.1);
      hit.name = '우주복 걸이';
      suit.add(hit);
      suitRack = {
        hit,
        group: suit,
        /** 입으면 걸이가 빈다 — **화면에서도 없어져야** 입은 것이 보인다 */
        setWorn(on) {
          for (const c of suit.children) if (c !== hit) c.visible = !on;
          lampMat.color.set(on ? 0x2a2f36 : Z.accent);
        },
      };
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
    // ★ 무전기 — **바깥문 옆 벽**에 붙인다 (G 구조 신호 · 7판).
    //   받는 것이 바깥문으로 들어오므로 **한 방에서 두 동작**이 되게 한다.
    //   다른 방에 두면 「잡고 있다가 뛰어가서 문을 연다」가 되는데
    //   그건 이 장면의 손짓이 아니다
    radio = buildRadio(ship, { x: r.x1 - 0.14, z: (r.z0 + r.z1) / 2 - 1.05, ry: -Math.PI / 2 }, MAT);
  }

  // ── 기관실 ──────────────────────────────────────────────
  const EZ = ZONE.engine;
  racks(ship, 'z', engine.x0 + 0.09, engine.z0 + 0.8, engine.z1 - 0.8, 1, EZ.accent, 1, 'engine', onWall);
  racks(ship, 'z', engine.x1 - 0.09, engine.z0 + 0.8, engine.z1 - 0.8, -1, EZ.accent, 3, 'engine', onWall);
  // ★ 기관실도 **모서리 통로**로 (REALSHIP.md §1). 여기 난간이 랙 면
  //   0.5m 앞을 가로지르고 있었다 — 벽면을 따라 그었기 때문이다.
  //   모서리로 옮기면 랙 앞이 비고, 잡을 것도 그대로 남는다
  for (const cx of ['x0', 'x1']) {
    standoff(ship, engine, H, 'z', [cx, 'y1'], EZ.light);
    solid(standoff(ship, engine, H, 'z', [cx, 'y0'], EZ.accent, true));
  }

  // ★★ 주 차단기 — **정전 때 여기까지 걸어와야 한다** (E 장면 · 7판).
  //   반응로 옆 벽에 붙인 큰 레버 하나. 평소에는 아무 일도 안 하고,
  //   어두울 때만 잡힌다. **비상등이 여기만 붉게 켜지므로** 어둠 속에서
  //   어디로 가야 하는지는 알 수 있다 — 다만 **무엇이 고장인지는
  //   여전히 안 가르친다** (규칙은 규칙이다)
  const mainBreaker = new THREE.Group();
  mainBreaker.position.set(engine.x1 - 0.14, 0, engine.z0 + 2.6);
  mainBreaker.rotation.y = -Math.PI / 2;
  ship.add(mainBreaker);
  {
    const B = mainBreaker;
    const put = (w, h2, d, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h2, d), mat);
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
      B.add(m); return m;
    };
    put(0.9, 1.1, 0.22, MAT.body, 0, 1.15, 0);          // 함
    put(0.96, 0.07, 0.28, MAT.metal, 0, 1.74, 0);       // 차양
    const lever = put(0.16, 0.5, 0.12, MAT.rail, 0, 1.1, 0.14);
    lever.rotation.x = 0.5;                              // 내려간 채다
    // 비상등 — 어두울 때만 켜진다
    const emMat = new THREE.MeshStandardMaterial({
      color: 0x3a1a18, emissive: 0x3a1a18, emissiveIntensity: 1.0, roughness: 0.5,
    });
    put(0.24, 0.1, 0.08, emMat, 0, 1.66, 0.12);
    // ★★ **세기를 두 번 낮췄다.** 처음엔 9 · 도달 7 이었는데 기관실이
    //   통째로 붉게 타고 차단기가 **하얀 덩어리**가 됐다 (블룸이 얹혀서
    //   더 심했다). 비상등이 할 일은 「여기다」이지 「앞이 안 보인다」가
    //   아니다 — 어둠을 없애면 어둠을 만든 뜻이 사라진다
    const emLight = new THREE.PointLight(0xff4a30, 0, 3.4, 2);
    emLight.position.set(0, 1.7, 0.4);
    B.add(emLight);
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.5, 0.7),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.position.set(0, 1.15, 0.2);
    hit.name = '주 차단기';
    B.add(hit);
    blockBox(engine.x1 - 0.2, engine.z0 + 2.6, 0.24, 0.9, -Math.PI / 2);
    mainBreaker.userData.api = {
      hit,
      /** @param s `blackout.summary()` */
      update(s) {
        const on = !!s?.dark;
        emMat.emissive.set(on ? 0xff4a30 : 0x3a1a18);
        emMat.emissiveIntensity = on ? 1.8 : 1.0;
        emLight.intensity = on ? 2.2 : 0;
        // 올리는 만큼 레버가 선다 — **되고 있다는 것이 눈에 보여야 한다**
        lever.rotation.x = 0.5 - 0.5 * (s?.at ?? 0);
      },
    };
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
  // ★ **조준 판정용 원판.** 밸브만 이게 없어서 **실제 바퀴 모양으로
  //   판정**했다 — 살 사이가 뻥 뚫려 있고, 잡으면 바퀴가 **돌기 시작하니까**
  //   구멍이 조준선 밑으로 지나가는 순간 손이 놓쳤다. 한 프레임 잡히고
  //   다음 프레임에 놓치기를 되풀이해서 「안 잡힌다」로 보였다
  //   (2026-08-04 · 사장님 「조정간이 안잡히잔아」를 쫓다가 밸브에서 나왔다).
  //   원기둥은 제 축으로 돌아도 모양이 안 변하므로 같이 돌아도 된다.
  const valveHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.46, 0.22, 14),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  valveHit.rotation.x = Math.PI / 2;
  valve.add(valveHit);

  // ── 움푹한 자리 — **급한 조작기는 테 안에 앉는다** ────────
  // ★ 셔틀은 조작기를 패널에 **움푹 들어가게** 박았다. 밟아도 안 꺾이게
  //   한 것이고, 덤으로 「이건 아무 데나 붙은 손잡이가 아니라 **자리가
  //   정해진 물건**」으로 읽힌다 (docs/space/REALSHIP.md §3).
  //   밸브는 이 배에서 제일 급할 때 잡는 것인데 여태 벽에 붕 떠 있었다.
  const bezel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.58, 0.16, 16, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x2b3138, roughness: 0.7, metalness: 0.6, side: THREE.DoubleSide,
    }),
  );
  bezel.rotation.x = Math.PI / 2;
  bezel.position.z = 0.06;
  valve.add(bezel);
  const backPlate = new THREE.Mesh(
    new THREE.CircleGeometry(0.58, 16),
    new THREE.MeshStandardMaterial({ color: 0x1b1f25, roughness: 0.8, metalness: 0.4 }),
  );
  backPlate.position.z = -0.02;
  valve.add(backPlate);

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
  const ambient = new THREE.AmbientLight(0x44536e, 2.1);
  ambient.userData.full = 2.1;
  scene.add(ambient);

  /**
   * 천장등 하나. **SpotLight 로 만든다.**
   *
   * ★ 왜 점광원이 아닌가 — 그림자 때문이다.
   *   PointLight 의 그림자는 **여섯 면(큐브맵)** 을 그려야 한다. 방마다
   *   점광원을 두고 전부 그림자를 켜면 한 프레임에 장면을 마흔 번 넘게
   *   그리는 셈이 된다. SpotLight 는 **한 면**이면 된다.
   *   그리고 실제로도 천장에 박힌 등은 아래로 쏘는 물건이라 더 맞다.
   */
  /** ★ 정전 때 한꺼번에 죽이려고 모아 둔다 (E 장면 · blackout-table.js) */
  const lamps = [];
  function ceilingLamp(x, z, color, power, reach, shadow = false) {
    const l = new THREE.SpotLight(color, power, reach, Math.PI * 0.48, 0.75, 1.7);
    l.userData.full = power;
    lamps.push(l);
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
  // ★ 관측실 천장등을 **낮춘다.** 창이 주광이라야 「밖을 보는 방」이 된다.
  //   52 로 두면 등이 창을 이겨서 창이 벽에 난 무늬가 된다 (REF.md)
  ceilingLamp(R.observ.x0 + 2.1, 0.6, ZONE.observ.light, 26, 12);
  ceilingLamp(R.workshop.x1 - 1.7, 0.6, ZONE.workshop.light, 60, 12, true);
  // ★ 온실 천장등은 **색을 뺐다.** 초록 등 + 초록 생장등 + 블룸이 겹쳐
  //   방이 연두색 안개가 됐다. 방 색은 물건이 내고 등은 하얗게 비춘다 —
  //   참고 사진 여섯 장이 전부 그렇다 (REF.md)
  ceilingLamp(R.garden.x0 + 1.5, (R.garden.z0 + R.garden.z1) / 2, 0xd8f0d4, 34, 12);
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
  // ── 안내선이 목표로 삼는 자리 ─────────────────────────
  // ★ **좌표를 두 번 적지 않는다.** 물건을 세운 그 자리에서 그대로 받아
  //   간다 — 저쪽에 손으로 옮겨 적으면 물건을 옮길 때 안내선만 옛 자리를
  //   가리키고, 그건 「계기가 거짓말을 한다」가 된다
  const marks = {
    chart: { x: R.observ.x0 + 1.7, z: (R.observ.z0 + R.observ.z1) / 2 },
    breaker: { x: spine.x0 + 0.5, z: 3.3 },
    valve: { x: 0, z: engine.z1 - 0.9 },
    winch: { x: 3.0, z: R.airlock.z0 + 0.7 },
    yoke: { x: 0, z: -7.9 },
  };

  // ★ `group` — tools 가 배 안에만 광선을 쏘려고 쓴다 (창밖·성운은 뺀다)
  // ── 에어록 바깥문 — **열고 우주에서 낚는다** (사장님 요청) ──
  // ★ **바깥벽(x1)에 단다.** 윈치가 z0 벽에 있으므로 마주 보지 않는다 —
  //   한 벽에 둘을 붙이면 조준선이 늘 엉뚱한 것을 잡는다
  // ★ **벽 안쪽 면(x1 - T/2 = x1 - 0.08)에 딱 붙여 놨었다.** 그러니 문짝
  //   뒤에 깔아 둔 「우주」가 벽 두께 안에 파묻혀 **열어도 벽만 보였다** —
  //   열린 화면과 닫힌 화면이 거의 똑같았다. 방 쪽으로 0.26 내밀어 세운다
  const outerDoor = buildOuterDoor(ship,
    { x: R.airlock.x1 - 0.26, z: (R.airlock.z0 + R.airlock.z1) / 2, ry: -Math.PI / 2 }, MAT,
    ZONE.airlock.accent);
  // 내밀어 세웠으니 **몸으로 뚫고 들어가지 못하게** 막이를 둔다
  blockBox(R.airlock.x1 - 0.14, (R.airlock.z0 + R.airlock.z1) / 2, 0.2, 0.95);

  // ── 주포 — **조종석 위로 올라간다** (사장님 요청 · world/turret.js) ──
  // ★ 사다리 밑동에 **막이를 안 세운다.** 세우면 사다리 앞에 못 서고,
  //   그러면 「보이는데 못 잡는」 물건이 하나 더 는다. 사다리는 벽에
  //   붙어 있어서 걸어다니는 데 방해가 안 된다
  // ★★ **조준석은 배 안이다** (사장님 「실내에 조준석에서 조준해야지」).
  //   조준경 한 장을 만들어 후드 안에 끼워 준다 — 사수는 밖에 안 나간다
  // ══ ★★★ **주포를 걷어냈다** (v64 · 사장님 「주포도 없애고 공격은
  //    조정석에서 다 이루어질 수 있도록 해줘」) ═══════════════════════
  //
  //  v44~v63 동안 배 안에 **좌석이 둘**이었다 — 조종석과 조준석. 그래서
  //  「올라가 있으면 아래 것을 못 잡는다」 같은 규칙을 따로 만들어야 했고,
  //  사장님은 그 자리에 **앉지도 못하셨다** (v59·v63 에서 두 번 고쳤다).
  //
  //  실제 전투기는 **좌석이 하나**다. 기총은 기수에 고정이고 조종간이
  //  곧 조준이다 — 그러면 「어디를 보느냐」와 「어디로 가느냐」가 같은
  //  손짓이 되고, 좌석 하나로 끝난다.
  //
  //  ★ 조준경(`sight`)은 **남긴다.** 이제 조종석 대시에 붙는다 —
  //    화면에 표적과 락온을 그리는 것은 여전히 필요하다
  // ★★★ **v65 — 판이 아니라 HUD 다.** 0.78 × 0.58 짜리 **불투명 판**이
  //   앉은 눈 앞 0.77m 에 서서 **37도**를 덮고 있었다 (창이 34.6도였으니
  //   창보다 큰 검은 판이 창 앞에 있었던 셈이다). 사장님이 보신
  //   「가운데 검은 화면」이 이것이다.
  //   이제 **앞유리 한 장 크기**로 키우고 배경을 지웠다 — 커졌는데
  //   **덜 가린다.** 선만 빛나기 때문이다 (gunsight.js 머리말)
  //   ★★★ **v66 — 다시 줄였다. 2.2 × 1.55 는 94도 × 74도였다.**
  //     「크게 만들면 잘 보인다」고 생각했는데 실제 HUD 는 **작다** —
  //     F-16 Block 60 이 25도 × 25도다. 94도짜리는 HUD 가 아니라
  //     **창을 통째로 덮은 초록 격자**이고, 사장님 화면의 그 격자다.
  //     크기·거리는 `view-table.js HUD` 가 정하고 `space-view.js` 가 지킨다
  // ══ ★★★ **탄두 크레이들 — 기관실 후미 격벽** (v71) ═══════════════
  //  사장님 「가장 후미에 핵탄두가 장착된 것도 만들어줘. 기관실에
  //  있으면 되겟지?」 — 기관실이 배의 제일 뒤(z 16)라 맞습니다.
  //  ★ 방을 안 늘립니다. 그리고 거기가 **열의 심장**이라, 추진을 켤
  //    때마다 탄두가 데워집니다 (`warhead-table.js BAKE`)
  const cradle = buildCradle(ship);

  const sight = buildSight(HUDV.w, HUDV.h);
  // ★★ **조준경을 조종석 대시에 붙인다** (v64).
  //   예전에는 `buildTurret` 이 붙여 줬다 — 포탑을 걷어내면서 **조준경이
  //   같이 떨어졌다.** 화면은 그려지는데 배에 없으니 아무 데도 안 보인다.
  //   「보이는데 못 잡는」의 반대 — **잡히는데 안 보이는** 것이고, 둘 다 없는 것이다.
  //   자리는 조종간 바로 위, 앉은 눈(1.20)에서 살짝 아래다
  // ★ **유리 바로 안쪽**에 세운다 (앞유리 z −9.30). 눕히지 않는다 —
  //   HUD 는 밖을 보는 판이라 창과 나란해야 표적 위에 얹힌다
  // ★★ **앉은 눈높이에 놓는다.** HUD 는 DEP 에 맞춰져 있어야 표적 위에
  //   얹힌다 — v65 는 눈이 30cm 뜨는데 HUD 는 고정이라 어긋나 있었고,
  //   그 어긋남을 **크게 만들어 덮고** 있었다
  sight.mesh.position.set(0, DEP.y + 0.06, DEP.z - HUDV.dist);
  ship.add(sight.mesh);

  // ══ ★★★ **상태창 — 앉으면 뜬다** (v69 · `world/status.js`) ══════════
  //  사장님 「기타 다른것들은 **hud처럼 조정석에 앉았을때 보이도록** …
  //          **퀘스트 안내창처럼**」
  //
  //  ★ 자리를 **조준경 왼쪽 아래**로 둔다. 겹치면 둘 다 못 읽고, 가운데에
  //    두면 창을 먹는다 (v65 에 한 번 겪었다 — 조준경이 창을 덮고 있었다).
  //    왼쪽 아래는 실제 전투기가 연료·무장 상태를 두는 자리이기도 하다
  const statusHud = buildStatusHud(HUDV.w * 1.15, HUDV.h * 1.05);
  statusHud.mesh.position.set(
    -HUDV.w * 1.18, DEP.y - HUDV.h * 0.52, DEP.z - HUDV.dist - 0.01,
  );
  ship.add(statusHud.mesh);
  const turret = {
    group: null, sight,
    // ★ 없어진 손잡이들 — `null` 이라야 `main.js` 의 조준 목록에서 걸러진다.
    //   지우지 않고 `null` 로 두는 이유: 이름이 사라지면 저쪽이 조용히
    //   `undefined` 를 읽고, 그건 「안 잡힌다」와 구별이 안 된다
    seatHit: null, standHit: null, gripHit: null,
    ladderHit: null, hatchHit: null, gunHit: null,
    fired() { /* 총구 섬광은 이제 조종석 화면이 낸다 */ },
    update() {},
  };

  return { group: ship, cock, outside, valve, wheel, breakers, chart, bench, panels, doors,
    turret, sight, statusHud, cradle, outerDoor, marks, byBay,
    /**
     * ★★ **정전** — 등을 한꺼번에 죽인다 (E 장면 · 7판).
     *   `k` 는 0~1. 0.14 면 실루엣은 보이고 글씨는 안 보인다 —
     *   완전한 암흑은 무서운 게 아니라 **아무것도 못 하는 것**이라
     *   사람이 「게임이 꺼졌나」로 읽는다 (blackout-table.js DARK.lamp).
     */
    setDark(k = 1, amb = 1) {
      for (const l of lamps) l.intensity = l.userData.full * k;
      ambient.intensity = ambient.userData.full * amb;
    },
    mainBreaker: mainBreaker.userData.api,
    foodGauge, winch, tradeHatch, radio, suitRack, alarm, lampEngine, lampCore, matEngine, coreGlow, skins };
}
