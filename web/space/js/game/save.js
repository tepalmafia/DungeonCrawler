// ══════════════════════════════════════════════════════════════════════════
//  저장 — **규칙.** 어디에 쓰느냐(localStorage)는 core/store.js 가 한다.
//
//  ★ 여기에 three.js 도 브라우저 API 도 없어야 `tools/space-save.js` 가
//    브라우저 없이 돌린다. 「저장했다 불러오면 같은가」는 숫자로 재는
//    것이지 화면으로 재는 것이 아니다.
// ══════════════════════════════════════════════════════════════════════════
import { SAVE_VERSION, FIELDS, usable } from './save-table.js';
import { LEG } from './route-table.js';

/**
 * 지금 상태에서 **적어 둘 칸만** 골라 담는다.
 * @param world { route, chase, supply, faults, hazard, move, carry, tutor, ship, me }
 */
export function pack(world) {
  const out = { v: SAVE_VERSION, at: null };
  for (const [key, fields] of Object.entries(FIELDS)) {
    const src = world[key];
    if (!src) continue;
    const box = {};
    for (const f of fields) {
      const val = src[f];
      if (val === undefined) continue;
      // ★ **깊은 복사를 한 번 한다.** 안 하면 저장한 뒤에도 게임이 같은
      //   객체를 계속 고쳐서, 「저장한 순간」이 아니라 「지금」이 저장된다.
      //   wear·items·done 이 전부 그런 것들이다
      box[f] = val && typeof val === 'object' ? JSON.parse(JSON.stringify(val)) : val;
    }
    out[key] = box;
  }
  return out;
}

/**
 * 불러온 것을 지금 세계에 **덮어씌운다.**
 *
 * ★ **새로 만들지 않고 덮는다.** `route` 에는 난수 발생기가, 다른 곳에는
 *   함수가 들어 있어서 통째로 갈아 끼우면 그것들이 사라진다.
 *   그래서 `makeRoute()` 등으로 멀쩡한 것을 먼저 만들고 **칸만** 채운다.
 *
 * @returns true 면 이어했다. false 면 못 읽어서 새로 시작한다
 */
export function apply(world, raw) {
  if (!usable(raw)) return false;
  for (const [key, fields] of Object.entries(FIELDS)) {
    const dst = world[key], src = raw[key];
    if (!dst || !src) continue;
    for (const f of fields) {
      if (src[f] === undefined) continue;
      dst[f] = src[f] && typeof src[f] === 'object'
        ? JSON.parse(JSON.stringify(src[f])) : src[f];
    }
  }
  return true;
}

/**
 * 저장된 것이 **어디까지 갔던 것인가** — 이어하기 물음과 멈춤 화면이 쓴다.
 * 「구간 7/8 · 62분째」처럼 사람이 읽는 한 줄.
 *
 * ★ 구간 수를 **여기 안 적는다.** `LEG.count` 하나를 읽는다 —
 *   PLAN2H 대로 12구간이 되면 표만 고치면 되고, 두 곳에 적으면
 *   반드시 갈라진다 (`?v=` 와 `VERSION` 이 그랬다).
 */
export function where(raw, legs = LEG.count) {
  if (!usable(raw)) return null;
  const leg = raw.route?.leg ?? 0;
  const min = Math.round((raw.ship?.clock ?? 0) / 60);
  return {
    leg, legs, min,
    left: Math.max(0, legs - leg),
    text: `구간 ${Math.min(leg + 1, legs)}/${legs} · ${min}분째`,
  };
}
