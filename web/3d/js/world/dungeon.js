// 절차적 던전 — 시드 기반 방 배치 + L자 복도.
// 격자만 만든다. 메시 생성은 level.js, 길찾기는 nav.js 가 맡는다.

import { makeRng } from '../core/rng.js';

export const CELL = 2;            // 한 칸 = 2 월드 유닛
// DOOR 는 「열려 있으면 바닥, 닫혀 있으면 벽」인 칸이다. 상태는 격자가 아니라
// dg.doorAt 이 들고 있고, nav.walkable() 한 곳에서만 해석한다 —
// 길찾기·시야·충돌이 전부 walkable() 을 지나가므로 거기만 맞으면 셋 다 맞는다.
export const VOID = 0, FLOOR = 1, WALL = 2, DOOR = 3;

/** 격자 좌표 → 월드 좌표(칸 중심) */
export function gridToWorld(gx, gz, w, h) {
  return [(gx - w / 2 + 0.5) * CELL, (gz - h / 2 + 0.5) * CELL];
}
/** 월드 좌표 → 격자 좌표 */
export function worldToGrid(x, z, w, h) {
  return [Math.floor(x / CELL + w / 2), Math.floor(z / CELL + h / 2)];
}

// postShadow/postHigh 는 후처리의 스플릿 톤(core/post.js)이 쓴다.
// 그림자로 스미는 색과 하이라이트로 스미는 색을 층마다 달리해 온도를 가른다.
const THEMES = [
  { key: 'crypt',  name: '납골당', floor: 0x59506a, wall: 0x453c56, moss: '#4c6b3a', mossP: 0.30, fog: 0x07060c, torch: 0xffa04a,
    postShadow: 0x8fa8d4, postHigh: 0xffd6a0 },
  { key: 'flood',  name: '침수 회랑', floor: 0x4a5a5e, wall: 0x37464d, moss: '#3f7a68', mossP: 0.46, fog: 0x05090c, torch: 0x9fd8ff,
    postShadow: 0x7fbcd6, postHigh: 0xd8f0ff },   // 물 — 위아래 다 차갑다
  { key: 'throne', name: '왕좌의 방', floor: 0x63505c, wall: 0x4e3b48, moss: '#7a3a3a', mossP: 0.18, fog: 0x0b0508, torch: 0xff7a3a,
    postShadow: 0xa88ac0, postHigh: 0xffb070 },   // 영혼빛 그림자 + 붉은 불
];
export function themeFor(floorNo) {
  return THEMES[Math.min(floorNo - 1, THEMES.length - 1)];
}

// 함정 종류 뽑기 주머니. 압력판이 제일 흔하고 낙석이 제일 드물다 —
// 제일 아픈 것(18%)이 제일 자주 나오면 함정이 벌이 된다.
const TRAP_POOL = ['spike', 'spike', 'spike', 'dart', 'dart', 'gas', 'rock'];

function rectsOverlap(a, b, pad) {
  return !(a.x - pad > b.x + b.w || a.x + a.w + pad < b.x || a.y - pad > b.y + b.h || a.y + a.h + pad < b.y);
}

/**
 * @param {number} floorNo  1..3 (3층은 보스층 — 마지막 방이 크게 열린다)
 * @param {string|number} seed
 */
export function generate(floorNo, seed) {
  const rnd = makeRng(`${seed}-f${floorNo}`);
  const isBossFloor = floorNo >= 3;

  const w = 54, h = 54;
  const cells = new Uint8Array(w * h);          // 기본값 VOID
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h ? cells[y * w + x] : VOID;
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < w && y < h) cells[y * w + x] = v; };

  // ── 방 배치 ──────────────────────────────────────────────
  const rooms = [];
  const want = isBossFloor ? 7 : rnd.int(9, 12);
  for (let tries = 0; tries < 400 && rooms.length < want; tries++) {
    const rw = rnd.int(6, 12), rh = rnd.int(6, 11);
    const r = { x: rnd.int(2, w - rw - 3), y: rnd.int(2, h - rh - 3), w: rw, h: rh };
    if (rooms.some((o) => rectsOverlap(r, o, 3))) continue;
    r.cx = Math.floor(r.x + r.w / 2);
    r.cy = Math.floor(r.y + r.h / 2);
    rooms.push(r);
  }
  if (rooms.length < 3) return generate(floorNo, String(seed) + 'x');   // 극단적 실패 시 재시도

  // 보스층: 시작에서 가장 먼 방을 크게 넓혀 보스룸으로 쓴다
  rooms.sort((a, b) => (a.cx + a.cy) - (b.cx + b.cy));
  const startRoom = rooms[0];
  let bossRoom = null;
  if (isBossFloor) {
    let far = rooms[1], best = -1;
    for (const r of rooms.slice(1)) {
      const d = (r.cx - startRoom.cx) ** 2 + (r.cy - startRoom.cy) ** 2;
      if (d > best) { best = d; far = r; }
    }
    far.x = Math.max(2, far.cx - 8); far.y = Math.max(2, far.cy - 8);
    far.w = Math.min(17, w - far.x - 3); far.h = Math.min(17, h - far.y - 3);
    far.cx = Math.floor(far.x + far.w / 2);
    far.cy = Math.floor(far.y + far.h / 2);
    far.boss = true;
    bossRoom = far;
  }

  for (const r of rooms)
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) set(x, y, FLOOR);

  // ── 복도: 가까운 방부터 잇는다(최소 신장 트리 근사) + 여분 간선 ──
  const linked = [rooms[0]];
  const rest = rooms.slice(1);
  const carveH = (x0, x1, y) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) { set(x, y, FLOOR); set(x, y + 1, FLOOR); } };
  const carveV = (y0, y1, x) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) { set(x, y, FLOOR); set(x + 1, y, FLOOR); } };
  const connect = (a, b) => {
    if (rnd.chance(0.5)) { carveH(a.cx, b.cx, a.cy); carveV(a.cy, b.cy, b.cx); }
    else { carveV(a.cy, b.cy, a.cx); carveH(a.cx, b.cx, b.cy); }
  };
  while (rest.length) {
    let bi = 0, bj = 0, bd = Infinity;
    for (let i = 0; i < linked.length; i++)
      for (let j = 0; j < rest.length; j++) {
        const d = (linked[i].cx - rest[j].cx) ** 2 + (linked[i].cy - rest[j].cy) ** 2;
        if (d < bd) { bd = d; bi = i; bj = j; }
      }
    connect(linked[bi], rest[bj]);
    linked.push(rest.splice(bj, 1)[0]);
  }
  for (let i = 0; i < 2; i++) {   // 고리 — 막다른 길만 있는 던전은 답답하다
    const a = rnd.pick(rooms), b = rnd.pick(rooms);
    if (a !== b) connect(a, b);
  }

  // ── 벽: 바닥에 인접한 VOID 칸 ────────────────────────────
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (at(x, y) !== VOID) continue;
      let touch = false;
      for (let dy = -1; dy <= 1 && !touch; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (at(x + dx, y + dy) === FLOOR) { touch = true; break; }
      if (touch) set(x, y, WALL);
    }

  // ── 횃불: 바닥과 맞닿은 벽 중 일정 간격으로 ──────────────
  const torches = [];
  const candidates = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      if (at(x, y) !== WALL) continue;
      // 바닥이 어느 쪽인지 (불꽃을 그쪽으로 띄운다)
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => at(x + dx, y + dy) === FLOOR);
      if (dirs.length !== 1) continue;   // 모서리는 제외 — 벽면이 애매하다
      candidates.push({ gx: x, gz: y, dir: dirs[0] });
    }
  rnd.shuffle(candidates);
  const MIN_GAP = 7;
  for (const c of candidates) {
    if (torches.some((t) => Math.abs(t.gx - c.gx) + Math.abs(t.gz - c.gz) < MIN_GAP)) continue;
    torches.push(c);
    if (torches.length >= 46) break;
  }

  // ── 소품: 방 안쪽 바닥 칸 몇 개 ──────────────────────────
  const props = [];
  for (const r of rooms) {
    const n = rnd.int(1, r.boss ? 4 : 3);
    for (let i = 0; i < n; i++) {
      const gx = rnd.int(r.x + 1, r.x + r.w - 2);
      const gz = rnd.int(r.y + 1, r.y + r.h - 2);
      if (Math.abs(gx - r.cx) < 2 && Math.abs(gz - r.cy) < 2) continue;   // 중앙은 비워둔다
      props.push({ gx, gz, kind: rnd.pick(['pillar', 'coffin', 'rubble', 'rubble']), rot: rnd() * Math.PI * 2 });
    }
  }

  // ── 소품 충돌 ───────────────────────────────────────────
  // 지금까지 소품은 **격자를 전혀 건드리지 않는 순수 장식**이었다.
  // walkable() 이 바닥인지만 보므로 기둥도 관도 그냥 통과했다.
  //
  // 칸 전체를 막지는 않는다. 기둥은 지름 1.0 인데 칸은 2.0 이라,
  // 칸을 통째로 막으면 「기둥 근처에 못 간다」가 되어 답답해진다.
  // 실제 크기의 원으로 막고 그 옆으로 미끄러지게 한다.
  // 잔해(rubble)는 높이 0.3 짜리라 밟고 지나가는 게 맞다.
  const SOLID_R = { pillar: 0.5, coffin: 0.75 };
  const solids = [];
  for (const p of props) {
    const r = SOLID_R[p.kind];
    if (!r) continue;
    const [px, pz] = gridToWorld(p.gx, p.gz, w, h);
    solids.push({ x: px, z: pz, r });
  }
  // 칸별로 미리 묶어 둔다 — 충돌 판정이 매 프레임 26마리에게서 돌기 때문에
  // 전체 목록을 훑으면 안 된다. 반지름이 칸 경계를 넘으므로 이웃 칸에도 등록한다.
  const solidAt = new Map();
  for (const sd of solids) {
    const [sgx, sgz] = worldToGrid(sd.x, sd.z, w, h);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const k = (sgz + dz) * w + (sgx + dx);
        let list = solidAt.get(k);
        if (!list) solidAt.set(k, (list = []));
        list.push(sd);
      }
  }

  // ── 시작 / 출구 ─────────────────────────────────────────
  const spawn = { gx: startRoom.cx, gz: startRoom.cy };
  const exitRoom = isBossFloor ? bossRoom : rooms.reduce((far, r) => {
    const d = (r.cx - startRoom.cx) ** 2 + (r.cy - startRoom.cy) ** 2;
    const fd = (far.cx - startRoom.cx) ** 2 + (far.cy - startRoom.cy) ** 2;
    return d > fd ? r : far;
  }, rooms[1] || rooms[0]);
  const exit = { gx: exitRoom.cx, gz: exitRoom.cy };

  // ── 금고 방: 문으로 봉하고, 스위치를 찾아야 열린다 ─────────
  //
  // 사장님 지시는 「문에 스위치를 찾아서 문을 열어주고」였다.
  // 문의 진짜 기능은 **어그로를 끊는 것**이다(docs/DUNGEON-INTERACTIONS.md §2-2):
  // 닫힌 문은 walkable() 이 막으므로 lineOfSight 도 같이 막히고,
  // 그러면 문 너머의 적은 플레이어를 감지하지 못한다. 도망칠 곳이 생긴다.
  //
  // 안에는 상점(재의 행상)이 들어간다. 「함정이 도사리는 특정한 방」이라는
  // 지시와 맞물려, 여기가 이 층에서 유일하게 판단이 필요한 장소가 된다.
  const doors = [];
  const doorAt = new Map();
  let vaultRoom = null, switchAt = null;
  if (!isBossFloor) {
    // 후보: 시작도 출구도 아닌 방 중 시작에서 먼 순서
    const cands = rooms
      .filter((r) => r !== startRoom && r !== exitRoom && !r.boss)
      .sort((a, b) => ((b.cx - startRoom.cx) ** 2 + (b.cy - startRoom.cy) ** 2)
        - ((a.cx - startRoom.cx) ** 2 + (a.cy - startRoom.cy) ** 2));

    for (const r of cands) {
      // 방을 둘러싼 고리에서 바닥인 칸 = 드나드는 목
      const seal = [];
      for (let x = r.x - 1; x <= r.x + r.w; x++) {
        for (const y of [r.y - 1, r.y + r.h]) if (at(x, y) === FLOOR) seal.push([x, y]);
      }
      for (let y = r.y; y < r.y + r.h; y++) {
        for (const x of [r.x - 1, r.x + r.w]) if (at(x, y) === FLOOR) seal.push([x, y]);
      }
      if (!seal.length || seal.length > 14) continue;   // 목이 너무 넓으면 문이 아니라 벽이다

      // **닫은 채로 출구까지 갈 수 있는지 먼저 확인한다.** 이걸 안 하면
      // 언젠가 열쇠 없이 층이 잠기는 시드가 나오고, 그건 재현이 어려운 사고다.
      for (const [x, y] of seal) set(x, y, DOOR);
      const ok = reachable(spawn, exit);
      if (!ok) { for (const [x, y] of seal) set(x, y, FLOOR); continue; }

      const door = { cells: seal.map(([x, y]) => y * w + x), open: false, room: r };
      doors.push(door);
      for (const i of door.cells) doorAt.set(i, door);
      r.vault = true;
      vaultRoom = r;

      // 스위치는 **다른 방**에 둔다. 문 옆에 두면 그냥 문이 두 번 열리는 것과 같다.
      //
      // 다만 「가장 먼 방」은 아니다. 그렇게 뒀더니 시작점에서 중앙값 30칸,
      // 금고는 39칸이 나왔다 — 미니맵 안개까지 겹치면 존재 자체를 모른다.
      // 금고에서 **중간쯤** 떨어진 방을 고른다: 찾을 거리는 남기되 순례는 아니게.
      const swCands = rooms.filter((o) => o !== r && o !== startRoom);
      swCands.sort((a, b) => ((a.cx - r.cx) ** 2 + (a.cy - r.cy) ** 2)
        - ((b.cx - r.cx) ** 2 + (b.cy - r.cy) ** 2));
      const swRoom = swCands[Math.floor(swCands.length * 0.45)] || swCands[0] || startRoom;

      // **벽면에 붙인다.** 방 한가운데 서 있는 손잡이는 어디에 달린 건지 안 읽힌다.
      // 방 안쪽 바닥 칸 중 벽과 맞닿은 곳을 찾아, 벽이 있는 방향을 같이 넘긴다.
      let swCell = null;
      const wallCands = [];
      for (let y = swRoom.y; y < swRoom.y + swRoom.h; y++)
        for (let x = swRoom.x; x < swRoom.x + swRoom.w; x++) {
          if (at(x, y) !== FLOOR) continue;
          const walls = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => at(x + dx, y + dy) === WALL);
          if (walls.length !== 1) continue;      // 모서리는 제외 — 어느 벽인지 애매하다
          wallCands.push({ gx: x, gz: y, wall: walls[0] });
        }
      if (wallCands.length) swCell = rnd.pick(wallCands);
      switchAt = swCell
        ? { gx: swCell.gx, gz: swCell.gz, wall: swCell.wall, room: swRoom, door }
        : { gx: swRoom.cx, gz: swRoom.cy, wall: null, room: swRoom, door };
      break;
    }
  }

  // ── 함정 ────────────────────────────────────────────────
  //
  // 두 종류의 밀도를 쓴다:
  //   · 금고 방 — **빽빽하게.** 사장님 지시가 「상점은 함정이 도사리는 방에」였다.
  //     스위치를 찾아 문을 열고도 대가가 남아야 「갈지 말지」가 판단이 된다.
  //   · 그 밖 — **드물게.** 복도와 방에 흩어 둔다. 자주 밟으면 함정이 아니라 지형이다.
  //
  // 시작 방과 출구 주변에는 놓지 않는다. 시작하자마자 밟는 함정은 예고가 아니라 사고다.
  const traps = [];
  const trapTaken = new Set();
  const farFrom = (gx, gz, p, r) => Math.abs(gx - p.gx) + Math.abs(gz - p.gz) > r;

  const addTrap = (gx, gz, kind) => {
    const key = gz * w + gx;
    if (trapTaken.has(key)) return false;
    if (at(gx, gz) !== FLOOR) return false;
    if (!farFrom(gx, gz, spawn, 6) || !farFrom(gx, gz, exit, 4)) return false;
    if (traps.some((t) => Math.abs(t.gx - gx) + Math.abs(t.gz - gz) < 3)) return false;
    // 화살 발사기는 벽을 등져야 한다 — 허공에서 화살이 나오면 안 된다
    let dir = null;
    if (kind === 'dart') {
      const walls = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => at(gx + dx, gz + dz) === WALL);
      if (!walls.length) return false;
      const back = rnd.pick(walls);
      dir = [-back[0], -back[1]];        // 벽 반대쪽으로 쏜다
    }
    trapTaken.add(key);
    traps.push({ gx, gz, kind, dir });
    return true;
  };

  if (vaultRoom) {
    const v = vaultRoom;
    for (let tries = 0; tries < 90 && traps.length < 7; tries++) {
      addTrap(rnd.int(v.x, v.x + v.w - 1), rnd.int(v.y, v.y + v.h - 1), rnd.pick(TRAP_POOL));
    }
  }
  // ── 길목에 놓는다 ────────────────────────────────────
  //
  // 방 한가운데 함정은 그냥 돌아가면 그만이라 아무 결정도 만들지 않는다.
  // **양옆이 벽인 칸**(복도·문턱)에 놓으면 돌아갈 길이 없다 —
  // 「해제할까(2초 멈춤), 밟고 갈까」가 진짜 판단이 된다.
  const chokes = [];
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      if (at(x, y) !== FLOOR) continue;
      const ns = at(x - 1, y) === WALL && at(x + 1, y) === WALL;
      const ew = at(x, y - 1) === WALL && at(x, y + 1) === WALL;
      if (ns || ew) chokes.push([x, y]);
    }
  rnd.shuffle(chokes);
  const wantChoke = isBossFloor ? 3 : 4 + floorNo;
  let placedChoke = 0;
  for (const [cx, cy] of chokes) {
    if (placedChoke >= wantChoke) break;
    if (addTrap(cx, cy, rnd.pick(TRAP_POOL))) placedChoke++;
  }

  const wantLoose = isBossFloor ? 3 : 4 + Math.floor(floorNo);
  const before = traps.length;
  for (let tries = 0; tries < 400 && traps.length < before + wantLoose; tries++) {
    addTrap(rnd.int(2, w - 3), rnd.int(2, h - 3), rnd.pick(TRAP_POOL));
  }

  /** 문을 닫은 상태로 a → b 가 이어지는가 (BFS) */
  function reachable(a, b) {
    const seen = new Uint8Array(w * h);
    const q = [a.gz * w + a.gx];
    seen[q[0]] = 1;
    const goal = b.gz * w + b.gx;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi];
      if (i === goal) return true;
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (seen[ni] || at(nx, ny) !== FLOOR) continue;
        seen[ni] = 1;
        q.push(ni);
      }
    }
    return false;
  }

  return {
    w, h, cells, rooms, spawn, exit, torches, props,
    solids, solidAt,
    doors, doorAt, vaultRoom, switchAt, traps,
    startRoom, bossRoom, isBossFloor,
    theme: themeFor(floorNo),
    floorNo, seed,
    isFloor: (gx, gz) => at(gx, gz) === FLOOR,
    at,
  };
}
