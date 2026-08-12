// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **창을 손으로 옮긴다** — 자리는 사람이 정한다 (v127). 숫자만.
//
//  ★ 사장님 (2026-08-12) 「**상태창 광학창 레이더 등 모든 창들을 마우스로
//    위치를 자유자재로 옮길 수 있게** 해줘」
//
//  ══ 왜 표를 하나 더 만드나 ════════════════════════════════════════════
//
//  자리는 이미 `screen-table.js ANCHOR` 가 정한다. 그런데 그것은 **내가
//  고르는 자리**이고, 이제 필요한 것은 **사장님이 고른 자리**다. 둘은
//  다른 것이라 한 표에 섞으면 안 된다:
//
//      ANCHOR  — **기본값.** 처음 켰을 때 · 되돌리기를 눌렀을 때
//      여기    — **사람이 옮긴 자리.** 저장에 남고 기본값을 덮는다
//
//  ★★ 섞으면 「되돌리기」를 만들 수가 없다 — 기본값이 어디였는지 잊는다.
//
//  ══ ★★★ 조준경은 **못 옮긴다** ═══════════════════════════════════════
//
//  사장님이 「모든 창들」이라고 하셨지만 조준경은 뺀다. 이유가 취향이
//  아니라 **규칙**이라서다: 조준경은 표적 상자와 락온 고리를 **하늘의
//  진짜 자리 위에** 그린다 (`space-align.js` 가 0.01도로 지킨다).
//  판을 옆으로 옮기면 그 그림이 통째로 어긋나 **「창밖의 저것」과
//  「계기의 저것」이 갈라진다** — 이 저장소가 네 판(v91·v93·v95·v98)을
//  태운 바로 그 병이다. 옮길 수 있는 것은 **읽는 창**뿐이다.
//
//  ★ three.js 를 안 쓴다 — `tools/space-layout.js` 가 읽는다.
// ══════════════════════════════════════════════════════════════════════════
import { ANCHOR, PANELS, EDGE, centerFor } from './screen-table.js';

/** 배치 모드를 여닫는 키 — 맡은 키와 안 겹친다 (`keys-table.js` 확인함) */
export const LAYOUT = {
  key: 'KeyU',
  keyName: 'U',
  /**
   * ★ 끌 때 이만큼씩 딱딱 붙는다 (정규 좌표). 0.005 는 1600화소 화면에서
   *   4화소다 — 손 떨림은 먹고 「거기 두고 싶다」는 살린다
   */
  grid: 0.005,
  /**
   * ★★ 화면 밖으로 못 나간다. 판의 **반쪽 크기까지 세어서** 막는다 —
   *   복판만 보고 막으면 가장자리로 끌었을 때 **절반이 잘린다**
   */
  edge: EDGE,
  what: '창 배치 — U 를 누르면 마우스가 풀리고 창을 끌 수 있다',
};

/** ★★★ 옮길 수 있는 창 — **읽는 창**만이다 */
export const MOVABLE = ['광학창', '상태창', '레이더'];

/** 못 옮기는 것과 **그 까닭** — 까닭 없이 뺀 것이 없어야 한다 */
export const FIXED = {
  조준경: '기수에 못박혀 있다 — 옮기면 「창밖의 저것」과 「계기의 저것」이 갈라진다',
};

/** 이 창을 옮길 수 있나 */
export const canMove = (name) => MOVABLE.includes(name);

/**
 * ★★★ **기본 자리** (복판 · 정규 좌표).
 *
 *   ★ `ANCHOR` 는 **바깥 모서리**를 적어 둔 것이라 판 크기를 알아야
 *     복판이 나온다. 사람이 끌 때는 **복판**을 잡으므로 여기서 한 번
 *     바꿔 둔다 — 두 좌표계를 오가면 반드시 어긋난다
 */
export const defaultAt = (name, halfW = 0, halfH = 0) => centerFor(name, halfW, halfH);

/** 격자에 붙인다 */
export const snap = (v) => Math.round(v / LAYOUT.grid) * LAYOUT.grid;

/**
 * ★★ **화면 안으로 민다** — 판의 반쪽 크기를 세어서.
 *
 * @param halfW,halfH 판의 반쪽 크기 (정규 좌표)
 */
export function clampAt(nx, ny, halfW = 0, halfH = 0) {
  const mx = Math.max(0, LAYOUT.edge - halfW);
  const my = Math.max(0, LAYOUT.edge - halfH);
  return {
    x: +Math.min(mx, Math.max(-mx, snap(nx))).toFixed(4),
    y: +Math.min(my, Math.max(-my, snap(ny))).toFixed(4),
  };
}

/**
 * ★★★ **전투 원뿔을 먹나** — 옮겨도 여기는 비워야 한다.
 *
 *   ★ 막지는 **않는다.** 사장님이 굳이 복판에 두시겠다면 그건 사장님
 *     선택이다 — 다만 **말은 해 준다** (`space-screen.js` 가 기본값에
 *     대해 지키는 것과 같은 규약이되, 여기서는 경고지 금지가 아니다)
 */
export const hitsCone = (nx, ny, halfW = 0, halfH = 0) =>
  Math.hypot(Math.max(0, Math.abs(nx) - halfW), Math.max(0, Math.abs(ny) - halfH)) < 0.45;

/** 사람이 읽는 한 줄 — 배치 모드에 뜬다 */
export const layoutWord = (name = null, moved = 0) => (name
  ? `${name} 을(를) 끌고 있습니다 — 놓으면 그 자리입니다`
  : `창 배치 — 끌어서 옮깁니다 · R 되돌리기 · ${LAYOUT.keyName} 닫기`
    + (moved ? ` (옮긴 창 ${moved})` : ''));

export { PANELS };
