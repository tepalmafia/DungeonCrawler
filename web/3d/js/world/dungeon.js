// 절차적 던전 — 시드 기반 방 배치 + L자 복도.
// 격자만 만든다. 메시 생성은 level.js, 길찾기는 nav.js 가 맡는다.

import { makeRng } from '../core/rng.js';

export const CELL = 2;            // 한 칸 = 2 월드 유닛
export const VOID = 0, FLOOR = 1, WALL = 2;

/** 격자 좌표 → 월드 좌표(칸 중심) */
export function gridToWorld(gx, gz, w, h) {
  return [(gx - w / 2 + 0.5) * CELL, (gz - h / 2 + 0.5) * CELL];
}
/** 월드 좌표 → 격자 좌표 */
export function worldToGrid(x, z, w, h) {
  return [Math.floor(x / CELL + w / 2), Math.floor(z / CELL + h / 2)];
}

const THEMES = [
  { key: 'crypt',  name: '납골당', floor: 0x59506a, wall: 0x453c56, moss: '#4c6b3a', mossP: 0.30, fog: 0x07060c, torch: 0xffa04a },
  { key: 'flood',  name: '침수 회랑', floor: 0x4a5a5e, wall: 0x37464d, moss: '#3f7a68', mossP: 0.46, fog: 0x05090c, torch: 0x9fd8ff },
  { key: 'throne', name: '왕좌의 방', floor: 0x63505c, wall: 0x4e3b48, moss: '#7a3a3a', mossP: 0.18, fog: 0x0b0508, torch: 0xff7a3a },
];
export function themeFor(floorNo) {
  return THEMES[Math.min(floorNo - 1, THEMES.length - 1)];
}

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

  // ── 시작 / 출구 ─────────────────────────────────────────
  const spawn = { gx: startRoom.cx, gz: startRoom.cy };
  const exitRoom = isBossFloor ? bossRoom : rooms.reduce((far, r) => {
    const d = (r.cx - startRoom.cx) ** 2 + (r.cy - startRoom.cy) ** 2;
    const fd = (far.cx - startRoom.cx) ** 2 + (far.cy - startRoom.cy) ** 2;
    return d > fd ? r : far;
  }, rooms[1] || rooms[0]);
  const exit = { gx: exitRoom.cx, gz: exitRoom.cy };

  return {
    w, h, cells, rooms, spawn, exit, torches, props,
    startRoom, bossRoom, isBossFloor,
    theme: themeFor(floorNo),
    floorNo, seed,
    isFloor: (gx, gz) => at(gx, gz) === FLOOR,
    at,
  };
}
