// ══════════════════════════════════════════════════════════════════════════
//  창 배치 — **순수 규칙.** 숫자는 `layout-table.js` 에 있다 (v127).
//
//  ★ three.js 도 DOM 도 안 쓴다 — `tools/space-layout.js` 가 브라우저 없이
//    통째로 돌려 본다 (게임에 붙이기 전에).
//
//  ★★ **자리를 두 벌로 안 만든다.** 여기가 들고 있는 것은 「사람이 옮긴
//    자리」뿐이고, 안 옮긴 창은 **아무것도 안 들고 있는다** — 그래야
//    기본값(`ANCHOR`)이 바뀌면 안 옮긴 창은 따라 움직인다. 옮기는 순간
//    복사해 두면 「고쳤는데 화면이 그대로」가 된다
// ══════════════════════════════════════════════════════════════════════════
import { canMove, clampAt, LAYOUT } from './layout-table.js';

export const makeLayout = () => ({
  /** 사람이 옮긴 것만 — `{ 이름: {x, y} }` */
  at: {},
  /** 지금 배치 모드인가 */
  open: false,
  /** 지금 끌고 있는 창 (없으면 null) */
  drag: null,
});

/** 배치 모드를 여닫는다 — @returns 지금 열렸나 */
export function setLayout(L, on = null) {
  L.open = on === null ? !L.open : !!on;
  if (!L.open) L.drag = null;
  return L.open;
}

/**
 * ★★ **집는다** — 배치 모드일 때만.
 * @returns 집었나
 */
export function grab(L, name, at = null) {
  if (!L.open || !canMove(name)) return false;
  L.drag = { name, from: at ? { ...at } : null };
  return true;
}

/** 놓는다 — @returns 놓은 창 이름 (안 잡고 있었으면 null) */
export function drop(L) {
  const n = L.drag?.name ?? null;
  L.drag = null;
  return n;
}

/**
 * ★★★ **끈다** — 복판을 여기로 옮긴다 (정규 좌표).
 *
 *   ★ 화면 밖으로 못 나가는 것과 격자에 붙는 것은 **표가 한다**
 *     (`clampAt`) — 여기서 또 자르면 자르는 곳이 둘이 된다
 * @returns 옮겨진 자리 (못 옮기면 null)
 */
export function moveTo(L, name, nx, ny, halfW = 0, halfH = 0) {
  if (!canMove(name)) return null;
  L.at[name] = clampAt(nx, ny, halfW, halfH);
  return { ...L.at[name] };
}

/** 이 창의 자리 — **안 옮겼으면 null** (그때는 기본값을 쓴다) */
export const atOf = (L, name) => (L.at[name] ? { ...L.at[name] } : null);

/**
 * ★★ **되돌린다.** 이름을 주면 하나만, 안 주면 전부.
 *   ★ 지우는 것이지 기본값을 적어 넣는 것이 아니다 — 적어 넣으면
 *     기본값이 바뀔 때 안 따라온다
 */
export function resetLayout(L, name = null) {
  if (name) { delete L.at[name]; return 1; }
  const n = Object.keys(L.at).length;
  L.at = {};
  return n;
}

/** 저장에 넣을 것 — 옮긴 것만 나간다 (없으면 아무것도 안 남는다) */
export const saveLayout = (L) => (Object.keys(L.at).length ? { at: { ...L.at } } : null);

/**
 * 저장에서 꺼낸다.
 * ★ 못 옮기는 창이 저장에 들어 있으면 **버린다** — 옛 저장이 새 규칙을
 *   뚫고 들어오는 자리다 (조준경을 옮길 수 있던 판이 있었다면)
 */
export function loadLayout(L, raw) {
  L.at = {};
  for (const [k, v] of Object.entries(raw?.at ?? {})) {
    if (!canMove(k) || typeof v?.x !== 'number' || typeof v?.y !== 'number') continue;
    L.at[k] = clampAt(v.x, v.y);
  }
  return Object.keys(L.at).length;
}

/** 검사와 화면이 읽는다 */
export const summary = (L) => ({
  open: !!L.open,
  drag: L.drag?.name ?? null,
  moved: Object.keys(L.at).length,
  at: { ...L.at },
  key: LAYOUT.keyName,
});
