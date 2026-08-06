// ══════════════════════════════════════════════════════════════════════════
//  영구 손상 — **규칙.** 표는 scar-table.js 가 갖는다.
//
//  ★ 상태가 둘뿐이다 — **계통별 점수**와 **생긴 흉터 목록.**
//    흉터는 **안 없어진다.** 지우는 함수를 아예 안 만든다 — 있으면
//    언젠가 「어쩌다 지워지는」 길이 생기고, 그러면 영구가 영구가 아니다.
//
//  ★ three.js 를 안 쓴다.
// ══════════════════════════════════════════════════════════════════════════
import { SCAR, SCARS, EARNED, worn } from './scar-table.js';

export function makeScars() {
  return {
    /** 계통별로 **닳은 채 고친** 횟수 */
    hits: Object.fromEntries(EARNED.map((s) => [s.sys, 0])),
    /** 생긴 흉터들 (열쇠) — 순서가 곧 「이렇게 왔다」다 */
    got: [],
    /** 언제 생겼나 (분) — 끝 화면이 읽는다 */
    at: {},
  };
}

/**
 * ★ 고장 하나를 다 고쳤다 — **닳아 있었으면 한 점.**
 *
 *   `fault.js clear()` 를 부르는 그 자리에서 같이 부른다. 다만 **마모를
 *   덜기 전에** 불러야 한다 — `clear()` 가 `WEAR.relief`(0.34)를 빼므로,
 *   뒤에 부르면 방금 혹사한 것이 멀쩡한 것으로 읽힌다.
 *
 * @param sys  고친 고장의 계통
 * @param wear 지금 계통별 마모 (fault 의 `f.wear`)
 * @param min  지금 몇 분째인가 — 끝 화면이 「언제 생겼나」를 쓴다
 * @returns 새로 생긴 흉터 열쇠 · 없으면 null
 */
export function noteFix(sc, sys, wear, min = 0) {
  if (!sys || sc.hits[sys] == null) return null;
  if (!worn(wear, sys)) return null;
  sc.hits[sys]++;
  if (sc.hits[sys] < SCAR.need) return null;
  const s = EARNED.find((x) => x.sys === sys);
  if (!s || sc.got.includes(s.key)) return null;
  sc.got.push(s.key);
  sc.at[s.key] = Math.round(min);
  return s.key;
}

/**
 * ★ 장면이 주는 흉터 — 자세 제어(구간 11).
 *   닳아서 생기는 것이 아니라 **배치가 정한 것**이라 따로 들어온다
 */
export function noteScene(sc, key, min = 0) {
  if (!SCARS[key] || sc.got.includes(key)) return null;
  sc.got.push(key);
  sc.at[key] = Math.round(min);
  return key;
}

/** 이 흉터가 있나 */
export const has = (sc, key) => sc.got.includes(key);

/** 밸브 돌리는 시간이 몇 배인가 — 냉각 흉터가 있으면 두 배 */
export const valveMult = (sc) => (has(sc, 'cool') ? SCARS.cool.valveMult : 1);

/** 지금 자국에 얹히는 값 — 선체 흉터가 있으면 늘 조금 더 굵다 */
export const signOf = (sc) => (has(sc, 'hull') ? SCARS.hull.sign : 0);

/** 사람이 읽는 목록 — 진단대와 끝 화면이 쓴다 */
export const list = (sc) => sc.got.map((k) => ({
  key: k, name: SCARS[k].name, what: SCARS[k].what, around: SCARS[k].around, at: sc.at[k] ?? 0,
}));

export function summary(sc) {
  return {
    hits: { ...sc.hits }, got: [...sc.got], at: { ...sc.at },
    valveMult: valveMult(sc), sign: signOf(sc),
  };
}
