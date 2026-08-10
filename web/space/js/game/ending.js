// ══════════════════════════════════════════════════════════════════════════
//  끝 화면의 목록을 **만든다** — 순수 함수 (PLAN2H §9 · 8판)
//
//  ★ three.js 도 DOM 도 안 쓴다. 그래야 `tools/space-end.js` 가 브라우저
//    없이 「목록이 규칙을 지키나」를 묻는다 — 화면을 띄우지 않고.
//
//  ★ **여기서 판단하지 않는다.** 좋고 나쁨은 표에도 여기에도 없다.
//    모으고, 이름을 붙이고, 빈 줄을 뺀다. 그게 전부다.
// ══════════════════════════════════════════════════════════════════════════
import { GROUPS, LINES } from './ending-table.js';

/**
 * 회차 하나를 **줄들**로 만든다.
 *
 * @param w 모아 온 것 — `main.js` 가 계통들에서 긁어 온다
 *   `{ minutes, legs, runs, fixed, trips, hits, shakyMin,
 *      scars: string[], open: string[], food, parts, ore }`
 * @returns `[{ key, name, rows: [{ label, value }] }]` — **빈 묶음은 뺀다**
 */
export function endList(w) {
  const safe = {
    minutes: 0, legs: 0, runs: 0, fixed: 0, trips: 0, hits: 0, shakyMin: 0,
    scars: [], open: [], food: 0, parts: 0, ore: 0,
    // ★ v99 — 아크 도약. 없으면 0 이라 그 줄이 안 뜬다 (`ending-table.js`)
    jumps: 0, skipped: 0,
    ...w,
  };
  return GROUPS.map((g) => ({
    key: g.key,
    name: g.name,
    rows: LINES
      .filter((l) => l.group === g.key)
      .map((l) => ({ label: l.label, value: l.of(safe) }))
      .filter((r) => r.value != null),
  })).filter((g) => g.rows.length);
}

/**
 * 한 줄 요약 — 배너와 콘솔이 쓴다.
 * ★ **점수를 안 만든다.** 「몇 분 · 흉터 몇」까지만이고 등급은 없다
 */
export function endWord(w) {
  const m = Math.round(w?.minutes ?? 0);
  const s = (w?.scars ?? []).length;
  return s ? `${m}분 · 못 고친 것 ${s}` : `${m}분 · 성한 배`;
}
