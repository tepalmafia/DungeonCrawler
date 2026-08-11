// ══════════════════════════════════════════════════════════════════════════
//  화물 — **규칙.** 표는 `cargo-table.js` 가 갖는다 (v83)
//
//  ★ 사장님 「실시간으로 획득 아이템이 **q 스크린**이나 조정석에선 **조정석
//    화면**에서 획득 리스트를 보여줄 수 있도록」
//
//  ★★ 그래서 이 파일이 드는 것은 **둘**이다:
//      ① **화물칸** — 무엇이 얼마나 실려 있나 · 무게
//      ② **들어온 목록** — 방금 무엇이 들어왔나 (손목과 조종석이 읽는다)
//
//  ★ three.js 를 안 쓴다.
// ══════════════════════════════════════════════════════════════════════════
import { ITEMS, HOLD, massOf, nameOf, dropsNow, DROPPING, WHY } from './cargo-table.js';

/** 목록에 남기는 줄 수 — 넘으면 오래된 것부터 지운다 */
const LOG_MAX = 8;
/** 한 줄이 목록에 머무는 시간 (초) */
const LOG_LIVE = 22;

export function makeCargo() {
  return {
    /** key → 개수 */
    items: {},
    /** ★ 방금 들어온 것들 — { key, n, t } · 화면이 읽는다 */
    log: [],
    /** 이번 회차에 몇 개나 실었나 · 자리가 없어 몇 개나 버렸나 */
    took: 0, missed: 0,
  };
}

/** 지금 실려 있는 무게 */
export function used(c) {
  let m = 0;
  for (const [k, n] of Object.entries(c.items)) m += massOf(k) * n;
  return m;
}
export const left = (c) => Math.max(0, HOLD - used(c));

/**
 * ★★ **싣는다.**
 *
 *   ★ 자리가 모자라면 **들어갈 만큼만** 싣는다. 통째로 거절하면 「무거운
 *     것 하나 때문에 가벼운 것도 못 싣는」 일이 나고, 그건 규칙이 아니라
 *     심술이다
 *
 * @returns { took: {key:n}, missed: {key:n}, full }
 */
export function put(c, gain) {
  const took = {}; const missed = {};
  let room = left(c);
  for (const [k, n0] of Object.entries(gain ?? {})) {
    if (!ITEMS[k] || !n0) continue;
    const m = massOf(k);
    const fit = m > 0 ? Math.min(n0, Math.floor(room / m)) : n0;
    if (fit > 0) {
      c.items[k] = (c.items[k] ?? 0) + fit;
      took[k] = fit;
      room -= m * fit;
      c.took += fit;
      note(c, k, fit);
    }
    if (fit < n0) { missed[k] = n0 - fit; c.missed += n0 - fit; }
  }
  return { took, missed, full: room <= 0 };
}

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ v114 — **쓴 것은 화물칸에서 빠진다** (사장님 「화물칸이 벌써 다
//     찼다는데? 필요한 아이템 드랍률을 낮춰」)
//
//  ══ 재 보니 드랍률이 아니라 **새는 구멍**이었다 ═══════════════════════
//
//  `takeSalvage` 가 이렇게 하고 있었다:
//
//      ① 꾸러미를 **화물칸에 싣는다**  (무게를 먹는다)
//      ② `useOf` 로 **배의 계통에 붓는다** (`supply.parts += 1` …)
//      ③ ★★★ **①에 실은 것을 안 뺀다**
//
//  즉 정비 부품은 수리통에 들어갔는데 **화물칸에도 그대로 남아** 있었다.
//  광석도 식량도 냉각제도 같았다. 화물칸에 쌓이던 것은 짐이 아니라
//  **이미 써 버린 것의 그림자**다. 재 보니 **5.6 마리면 100 짐이 꽉 찬다** —
//  두 시간짜리 회차에서 이건 「금방」이 아니라 **처음 몇 분**이다.
//
//  ★★ 그래서 드랍률을 낮추면 안 된다. 낮춰도 새는 것은 그대로라 **조금
//    늦게 같은 일이 난다.** 구멍을 막는 것이 답이다.
//
//  ★★★ 그리고 막고 나면 화물칸이 **뜻을 갖는다**: 남는 것은 **배가 아직
//    못 받은 것**뿐이다 (수리통이 꽉 찼다 · 열이 안 올라 냉각제를 못 쓴다 ·
//    아크 전지처럼 원래 실어 두는 것). 그게 「무엇을 버릴지」의 진짜 재료다.
// ══════════════════════════════════════════════════════════════════════════

/**
 * ★★★ **실은 것 중 배가 삼킨 만큼을 화물칸에서 뺀다.**
 *
 *   ★ 통이 꽉 차 있으면 **안 삼킨다** — 그건 진짜 짐이고, 화물칸에 남는
 *     것이 맞다. 여기가 「자리가 모자란다」가 처음으로 뜻을 갖는 자리다.
 *   ★★ 냉각제는 **열이 있을 때만** 삼킨다. 시원할 때 부으면 그냥 버리는
 *     것이고, 그러면 「식히려고 아껴 둔다」가 없어진다
 *
 * @param c    화물칸
 * @param took 방금 실은 것 { key: n }
 * @param room 배가 더 받을 수 있는 양 { food, parts, ore, sink }
 * @returns { ate: {field: 값}, kept: {key: n} } — 삼킨 값과 남은 것
 */
export function settle(c, took, room = {}) {
  const ate = {}; const kept = {};
  for (const [k, n] of Object.entries(took ?? {})) {
    const u = ITEMS[k]?.use;
    if (!u || !n) { kept[k] = (kept[k] ?? 0) + (n ?? 0); continue; }
    let fit = n;
    for (const [f, v] of Object.entries(u)) {
      // ★ `sink` 는 **내리는** 값이라 부호가 반대다 — 열이 남은 만큼만 삼킨다
      const space = v < 0 ? (room[f] ?? 0) / -v : (room[f] ?? 0) / v;
      // ★★ 자리를 아예 안 준 칸(`room` 에 없는 것 = 아크 전지)은 **안 삼킨다**
      fit = Math.min(fit, room[f] === undefined ? 0 : Math.floor(space));
    }
    fit = Math.max(0, Math.min(n, fit));
    if (fit > 0) {
      drop(c, k, fit);
      for (const [f, v] of Object.entries(u)) ate[f] = (ate[f] ?? 0) + v * fit;
    }
    if (fit < n) kept[k] = (kept[k] ?? 0) + (n - fit);
  }
  return { ate, kept };
}

/** ★ 버린다 — 「무엇을 버릴지」가 이 게임의 두 번째 층이다 */
export function drop(c, key, n = 1) {
  const have = c.items[key] ?? 0;
  const go = Math.min(have, n);
  if (go <= 0) return 0;
  c.items[key] = have - go;
  if (c.items[key] <= 0) delete c.items[key];
  note(c, key, -go);
  return go;
}

/** 쓴다 — 배가 아이템을 소비할 때 (수리 · 우주복 채우기 …) */
export function take(c, key, n = 1) {
  return drop(c, key, n);
}

/**
 * ★★★ **들어온 목록** — 사장님 「**실시간으로** 획득 아이템이 …
 *   획득 리스트를 보여줄 수 있도록」.
 *
 *   ★ 배너 한 줄로는 안 된다. 배너는 **하나씩 덮어쓰므로** 세 개가
 *     한꺼번에 들어오면 마지막 하나만 보인다. 목록이라야 「무엇 무엇이
 *     들어왔나」가 남는다
 */
function note(c, key, n) {
  // ★★ 같은 것이 또 들어오면 **줄을 안 늘리고 숫자만 올린다** —
  //   「밀봉재 1 · 밀봉재 1 · 밀봉재 1」은 목록이 아니라 소음이다.
  //
  //   ★ 처음엔 **맨 윗줄**하고만 합쳤다. 그러면 「밀봉재 · 식량 · 밀봉재」에서
  //     밀봉재가 두 줄이 된다 — 한 꾸러미에서 여러 가지가 한꺼번에
  //     들어오므로 그 꼴이 흔하다. **아직 안 삭은 같은 줄**을 찾아 합치고
  //     맨 위로 올린다 (실시간 목록은 「방금 무엇이」이지 순서 기록이 아니다)
  const i = c.log.findIndex((l) => l.key === key && Math.sign(l.n) === Math.sign(n));
  if (i >= 0) {
    const row = c.log.splice(i, 1)[0];
    row.n += n;
    row.t = LOG_LIVE;
    c.log.unshift(row);
    return;
  }
  c.log.unshift({ key, n, t: LOG_LIVE });
  if (c.log.length > LOG_MAX) c.log.length = LOG_MAX;
}

/** 한 걸음 — 목록이 삭는다 */
export function stepCargo(c, dt) {
  for (let i = c.log.length - 1; i >= 0; i--) {
    c.log[i].t -= dt;
    if (c.log[i].t <= 0) c.log.splice(i, 1);
  }
}

/**
 * ★★ **아이템을 배의 계통으로 옮긴다** — `ITEMS[k].use` 가 정한다.
 *
 *   ★ 여기서 숫자를 안 적는다. 표가 「이 아이템은 식량 26」이라고 적어
 *     두었고 여기는 **그대로 옮길 뿐**이다. 두 곳에 적으면 갈라진다
 *
 * @returns 합친 효과 { food, parts, ore, suitAir, sink, lootWeapon, lootArmor }
 */
export function useOf(gain) {
  const out = {};
  for (const [k, n] of Object.entries(gain ?? {})) {
    const u = ITEMS[k]?.use;
    if (!u || !n) continue;
    for (const [f, v] of Object.entries(u)) out[f] = (out[f] ?? 0) + v * n;
  }
  return out;
}

/** 사람이 읽는 한 줄 */
export function word(gain) {
  const bits = Object.entries(gain ?? {})
    .filter(([, n]) => n)
    .map(([k, n]) => (n > 1 ? `${nameOf(k)} ×${n}` : nameOf(k)));
  return bits.length ? bits.join(' · ') : '쓸 것이 없습니다';
}

/** 검사·화면이 읽는다 */
export function summary(c) {
  return {
    items: { ...c.items },
    used: used(c), left: left(c), hold: HOLD,
    log: c.log.map((l) => ({ key: l.key, name: nameOf(l.key), n: l.n, t: +l.t.toFixed(1) })),
    took: c.took, missed: c.missed,
  };
}

export { WHY, dropsNow, DROPPING };
