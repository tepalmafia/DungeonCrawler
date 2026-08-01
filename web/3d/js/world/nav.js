// 길찾기 · 충돌 — 물리 엔진 없이 격자만으로 해결한다.
//   A* 로 칸 경로를 뽑고 → 시야(LOS) 검사로 웨이포인트를 솎아내 매끄럽게 만든 뒤
//   이동 중에는 원-사각형 밀어내기로 벽을 따라 미끄러진다.

import { CELL, FLOOR, DOOR, gridToWorld, worldToGrid } from './dungeon.js';

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/**
 * 걸을 수 있는 칸인가.
 *
 * **문 상태를 해석하는 곳은 여기 하나뿐이다.** A*·시야(lineOfSight)·충돌
 * (resolveCollision) 이 전부 이 함수를 지나가므로, 닫힌 문은 자동으로
 * 「길도 막고 시선도 막고 몸도 막는」다. 세 곳에 따로 적었다면 반드시
 * 한 곳이 어긋났을 것이다 — 그리고 어긋난 쪽이 어그로 차단이었을 것이다.
 */
export function walkable(dg, gx, gz) {
  const v = dg.at(gx, gz);
  if (v === FLOOR) return true;
  if (v === DOOR) {
    const d = dg.doorAt && dg.doorAt.get(gz * dg.w + gx);
    return d ? d.open : true;
  }
  return false;
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
 * 지오메트리 안에 박힌 것을 빼낸다 — 밀어내기의 최후 수단.
 *
 * resolveCollision 은 인접 칸으로만 밀기 때문에, 두께 2칸 이상인 벽 **안쪽**에
 * 들어가면 밀 곳이 전부 벽이라 영영 못 빠져나온다(실측: 벽 칸 25곳 중 3곳에서 갇힘).
 * 그럴 때만 가장 가까운 바닥 칸 중앙으로 옮긴다. 정상 플레이에서는 발동하지 않는다.
 *
 * @returns {{x:number,z:number,moved:boolean}}
 */
export function unstick(dg, x, z, fallback = null) {
  const [gx, gz] = worldToGrid(x, z, dg.w, dg.h);
  if (walkable(dg, gx, gz)) return { x, z, moved: false };
  // 탐색 반경 2칸. 예전엔 16칸이었는데, 그러면 벽에 낀 것을 빼내는 게 아니라
  // **26유닛 떨어진 다른 방으로 순간이동**시킬 수 있다. 이건 수습이 아니라 사고다.
  //
  // fallback 은 호출부가 넘겨준 「직전에 검증된 위치」다. 예전 주석은
  // 「호출부가 되돌린다」고 적어 놓고 정작 그런 코드가 없었다 — 여기서 받는다.
  const n = nearestWalkable(dg, gx, gz, 2);
  if (!n) {
    if (fallback && walkable(dg, ...worldToGrid(fallback.x, fallback.z, dg.w, dg.h)))
      return { x: fallback.x, z: fallback.z, moved: true };
    return { x, z, moved: false };
  }
  const [wx, wz] = gridToWorld(n[0], n[1], dg.w, dg.h);
  return { x: wx, z: wz, moved: true };
}

/**
 * 스윕 이동 — 한 걸음을 조각내며 매 조각마다 벽을 푼다.
 *
 * 왜 필요한가: resolveCollision 은 **도착 지점 주변 3×3 칸만** 본다.
 * 한 스텝이 한 칸(CELL=2.0)을 넘으면 지나온 벽을 아예 못 보고 통과한다.
 * 감사 결과 최악은 넉백의 60유닛(=30칸)이었다.
 *
 * 조각 크기의 근거는 한 칸(2.0)의 절반이 아니라 **대각 핀치 폭**이다.
 * 대각으로 맞물린 두 벽이 만나는 점을 45°로 지날 때 통과가 시작되는 임계는
 * r√2 이고(구울 r=0.38 → 0.537, 실측 0.540), 그 절반 아래여야 안 스친다.
 * 반지름이 작을수록 임계도 작으므로 **반지름에 연동**해야 한다 —
 * 고정 0.25 는 화살(r=0.3, 안전 상한 0.212)에서 위반이었다.
 *
 * 비용: 정상 플레이의 한 걸음은 0.06 유닛이라 조각이 1개뿐 — 사실상 무료다.
 * 비싸지는 것은 어차피 정상이 아닌 프레임(배속·큰 히치)뿐이다.
 *
 * 변위 상한: 한 스텝에 16유닛(=8칸)을 넘게 이동하는 것은 어떤 경우에도
 * 의도된 연출이 아니다. 조각을 무한정 늘리는 대신 **거리를 자른다** —
 * 늘리면 벽에 처박힌 넉백이 조각 수백 개를 헛돌며 CPU만 태운다.
 *
 * @returns {{x:number,z:number,hit:boolean,clamped:boolean}}
 */
const SWEEP_MAX_DIST = 16;

export function sweep(dg, x, z, dx, dz, r, maxStep = null) {
  let d = Math.hypot(dx, dz);
  if (d < 1e-6) return { ...resolveCollision(dg, x, z, r), clamped: false };

  let clamped = false;
  if (d > SWEEP_MAX_DIST) {
    const k = SWEEP_MAX_DIST / d;
    dx *= k; dz *= k; d = SWEEP_MAX_DIST;
    clamped = true;
  }

  const step = maxStep ?? Math.min(0.25, 0.7 * r);
  const n = Math.max(1, Math.ceil(d / step));
  const sx = dx / n, sz = dz / n;
  let cx = x, cz = z, hit = false;
  for (let i = 0; i < n; i++) {
    const res = resolveCollision(dg, cx + sx, cz + sz, r);
    if (res.hit) hit = true;
    // 전진이 사실상 멈췄으면 남은 조각은 헛돈다 — 일찍 끊는다
    if (Math.abs(res.x - cx) + Math.abs(res.z - cz) < 1e-5) { cx = res.x; cz = res.z; break; }
    cx = res.x; cz = res.z;
  }
  return { x: cx, z: cz, hit, clamped };
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

    // 소품(기둥·관) — 격자가 아니라 원으로 막는다. 벽보다 먼저 푼다:
    // 벽에 밀린 뒤 기둥에 박히는 것보다, 기둥에서 밀린 뒤 벽으로 정리되는 편이
    // 결과가 안정적이다.
    const near = dg.solidAt && dg.solidAt.get(gz * dg.w + gx);
    if (near) {
      for (const s of near) {
        const ox = x - s.x, oz = z - s.z;
        const rr = r + s.r;
        const d2 = ox * ox + oz * oz;
        if (d2 >= rr * rr) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          x = s.x + (ox / d) * rr;
          z = s.z + (oz / d) * rr;
        } else {
          x = s.x + rr;                 // 정확히 중심 — 아무 방향으로나 뺀다
        }
        hit = moved = true;
      }
    }
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
