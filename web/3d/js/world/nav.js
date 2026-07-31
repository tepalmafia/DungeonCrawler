// 길찾기 · 충돌 — 물리 엔진 없이 격자만으로 해결한다.
//   A* 로 칸 경로를 뽑고 → 시야(LOS) 검사로 웨이포인트를 솎아내 매끄럽게 만든 뒤
//   이동 중에는 원-사각형 밀어내기로 벽을 따라 미끄러진다.

import { CELL, FLOOR, gridToWorld, worldToGrid } from './dungeon.js';

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

export function walkable(dg, gx, gz) {
  return dg.at(gx, gz) === FLOOR;
}

/** 두 칸 사이가 뚫려 있는가 (Bresenham) */
export function lineOfSight(dg, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (let guard = 0; guard < 4096; guard++) {
    if (!walkable(dg, x, y)) return false;
    if (x === x1 && y === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    // 대각선으로 벽 모서리를 뚫지 않도록 양옆도 확인
    if (e2 > -dy && e2 < dx && (!walkable(dg, x, y - sy) && !walkable(dg, x - sx, y))) return false;
  }
  return false;
}

/** 가장 가까운 걸을 수 있는 칸 (클릭 지점이 벽일 때) */
export function nearestWalkable(dg, gx, gz, maxR = 12) {
  if (walkable(dg, gx, gz)) return [gx, gz];
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (walkable(dg, gx + dx, gz + dy)) return [gx + dx, gz + dy];
      }
  }
  return null;
}

/** A* — 칸 좌표 배열을 돌려준다. 실패하면 null */
export function findPath(dg, sx, sz, tx, tz, maxNodes = 6000) {
  if (!walkable(dg, sx, sz)) {
    const n = nearestWalkable(dg, sx, sz, 3);
    if (!n) return null;
    [sx, sz] = n;
  }
  if (!walkable(dg, tx, tz)) {
    const n = nearestWalkable(dg, tx, tz);
    if (!n) return null;
    [tx, tz] = n;
  }
  if (sx === tx && sz === tz) return [[sx, sz]];

  const W = dg.w, size = dg.w * dg.h;
  const g = new Float32Array(size).fill(Infinity);
  const f = new Float32Array(size).fill(Infinity);
  const prev = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const si = sz * W + sx, ti = tz * W + tx;
  const hx = (i) => {
    const x = i % W, y = (i / W) | 0;
    const dx = Math.abs(x - tx), dy = Math.abs(y - tz);
    return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };

  g[si] = 0; f[si] = hx(si);
  const open = [si];
  let expanded = 0;

  while (open.length) {
    // 작은 격자라 선형 최소 탐색으로 충분하다 (54x54)
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur === ti) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (++expanded > maxNodes) return null;

    const cx = cur % W, cy = (cur / W) | 0;
    for (const [dx, dy, cost] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!walkable(dg, nx, ny)) continue;
      // 대각 이동은 양옆이 모두 뚫려 있을 때만 (모서리 통과 금지)
      if (dx && dy && (!walkable(dg, cx + dx, cy) || !walkable(dg, cx, cy + dy))) continue;
      const ni = ny * W + nx;
      if (closed[ni]) continue;
      const ng = g[cur] + cost;
      if (ng < g[ni]) {
        g[ni] = ng; f[ni] = ng + hx(ni); prev[ni] = cur;
        open.push(ni);
      }
    }
  }
  if (prev[ti] === -1 && ti !== si) return null;

  const out = [];
  for (let i = ti; i !== -1; i = prev[i]) out.push([i % W, (i / W) | 0]);
  return out.reverse();
}

/** LOS 로 중간 웨이포인트를 솎아낸다 — 계단식 경로가 직선이 된다 */
export function smoothPath(dg, path) {
  if (!path || path.length <= 2) return path || [];
  const out = [path[0]];
  let i = 0;
  while (i < path.length - 1) {
    let j = path.length - 1;
    for (; j > i + 1; j--) if (lineOfSight(dg, path[i][0], path[i][1], path[j][0], path[j][1])) break;
    out.push(path[j]);
    i = j;
  }
  return out;
}

/** 격자 경로 → 월드 좌표 웨이포인트 */
export function toWorldPath(dg, path) {
  return (path || []).map(([gx, gz]) => {
    const [x, z] = gridToWorld(gx, gz, dg.w, dg.h);
    return { x, z };
  });
}

/**
 * 원(반지름 r)이 벽에 파고들었으면 밀어낸다. 벽면을 따라 자연스럽게 미끄러진다.
 * @returns {{x:number,z:number,hit:boolean}}
 */
export function resolveCollision(dg, x, z, r) {
  let hit = false;
  for (let pass = 0; pass < 2; pass++) {
    const [gx, gz] = worldToGrid(x, z, dg.w, dg.h);
    let moved = false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = gx + dx, cz = gz + dy;
        if (walkable(dg, cx, cz)) continue;
        // 칸의 AABB
        const [wx, wz] = gridToWorld(cx, cz, dg.w, dg.h);
        const minX = wx - CELL / 2, maxX = wx + CELL / 2;
        const minZ = wz - CELL / 2, maxZ = wz + CELL / 2;
        const px = Math.max(minX, Math.min(x, maxX));
        const pz = Math.max(minZ, Math.min(z, maxZ));
        let ox = x - px, oz = z - pz;
        let d2 = ox * ox + oz * oz;
        if (d2 >= r * r) continue;

        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          x += (ox / d) * (r - d);
          z += (oz / d) * (r - d);
        } else {
          // 중심이 칸 안 — 가장 얕은 면으로 밀어낸다
          const l = x - minX, rr = maxX - x, t = z - minZ, b = maxZ - z;
          const m = Math.min(l, rr, t, b);
          if (m === l) x = minX - r; else if (m === rr) x = maxX + r;
          else if (m === t) z = minZ - r; else z = maxZ + r;
        }
        hit = moved = true;
      }
    }
    if (!moved) break;
  }
  return { x, z, hit };
}
