// ══════════════════════════════════════════════════════════════════════════
//  등대 — **규칙.** 표는 `ai-table.js` 가 갖는다 (v84)
//
//  ★★★ **이 파일의 존재 이유 한 줄: 말하는 구멍이 하나다.**
//    v83 까지 `main.js` 에 `banner = '…'; bannerT = 2.4;` 가 **112곳**
//    흩어져 있었고, 그래서 아무나 아무 때나 덮어썼다. 셋이 한꺼번에
//    들어오면 **마지막 하나**만 남는데 그게 제일 안 급한 것일 수도 있었다.
//
//  ★ three.js 를 안 쓴다 — tools/space-ai.js 가 브라우저 없이 읽는다.
// ══════════════════════════════════════════════════════════════════════════
import { VOICE, RANKS, MUTE, tellsWhere } from './ai-table.js';

export function makeAI() {
  return {
    /** 지금 하는 말 · 급한 정도 · 남은 시간 */
    line: '', rank: null, t: 0,
    /** 이 열쇠를 마지막으로 말한 뒤 흐른 시간 — 반복을 막는다 */
    said: new Map(),
    /** 지금 뜬 줄이 떠 있은 시간 (`VOICE.minShow`) */
    shown: 0,
    // ── 재는 것 (도구와 끝 화면이 읽는다) ─────────────────
    /** 말한 총 시간 · 전체 시간 · 몇 마디 · 막힌 마디 */
    spoke: 0, ran: 0, count: 0, held: 0,
    /** 지금 조용한 지 얼마나 · 이번 회차의 제일 긴 침묵 */
    quiet: 0, quietBest: 0,
    /** ★ 「어디가 잘못됐나」를 말한 횟수 — **0 이어야 한다** */
    slips: 0,
  };
}

/**
 * ★ 숫자를 뺀 열쇠 — 「격추 · 지원 28초」와 「격추 · 지원 31초」는
 *   **같은 말**이다. 안 지우면 반복 억제가 통째로 헛돈다
 */
const keyOf = (text) => String(text ?? '').replace(/[0-9]+/g, '#');

/**
 * ★★★ **말한다.** 이것이 이 배의 **유일한 말하는 구멍**이다.
 *
 * @param rank 'alarm' | 'warn' | 'tell' | 'teach'
 * @returns { ok, why? } — 'rank'(더 급한 것이 떠 있다) · 'same'(방금 한 말) ·
 *                          'hold'(앞엣것이 아직 안 읽혔다)
 */
export function say(ai, text, rank = 'tell') {
  const line = String(text ?? '').trim();
  if (!line) return { ok: false, why: 'empty' };
  const r = RANKS[rank] ?? RANKS.tell;

  // ★ 「어디가 잘못됐나」를 말하면 **센다.** 막지는 않는다 — 막으면 화면이
  //   조용해져서 오히려 못 찾는다. 대신 도구가 이 숫자를 보고 빨개진다
  if (tellsWhere(line)) ai.slips++;

  const k = keyOf(line);
  const last = ai.said.get(k);
  if (last !== undefined && ai.ran - last < MUTE) { ai.held++; return { ok: false, why: 'same' }; }

  if (ai.t > 0) {
    const cur = RANKS[ai.rank] ?? RANKS.tell;
    // ★★ **급한 것이 덜 급한 것을 밀어낸다.** 같은 급이면 새것이 이기되,
    //   앞엣것이 `minShow` 만큼은 읽히고 나서 밀린다
    if (r.w < cur.w) { ai.held++; return { ok: false, why: 'rank' }; }
    if (r.w === cur.w && ai.shown < VOICE.minShow) { ai.held++; return { ok: false, why: 'hold' }; }
  }

  ai.line = line;
  ai.rank = rank;
  ai.t = r.hold;
  ai.shown = 0;
  ai.said.set(k, ai.ran);
  ai.count++;
  // 침묵이 끊겼다 — 제일 길었던 것을 기억해 둔다
  ai.quietBest = Math.max(ai.quietBest, ai.quiet);
  ai.quiet = 0;
  return { ok: true };
}

/** 지금 하는 말을 곧 거둔다 (그 일이 끝났을 때) */
export function hush(ai) { ai.t = 0; ai.line = ''; ai.rank = null; }

/** 한 걸음 */
export function stepAI(ai, dt) {
  ai.ran += dt;
  if (ai.t > 0) {
    ai.t = Math.max(0, ai.t - dt);
    ai.shown += dt;
    ai.spoke += dt;
    if (ai.t === 0) { ai.line = ''; ai.rank = null; }
  } else {
    ai.quiet += dt;
    ai.quietBest = Math.max(ai.quietBest, ai.quiet);
  }
}

/** 지금 화면에 뜰 줄 (없으면 null) */
export const nowSaying = (ai) => (ai.t > 0 ? { line: ai.line, rank: ai.rank } : null);

/** 검사·화면이 읽는다 */
export function summary(ai) {
  return {
    name: VOICE.name,
    line: ai.line, rank: ai.rank, t: +ai.t.toFixed(2),
    /** ★ 말하고 있는 시간의 몫 — `SHARE_MAX` 안이어야 한다 */
    share: ai.ran > 0 ? +(ai.spoke / ai.ran).toFixed(3) : 0,
    count: ai.count, held: ai.held,
    quiet: +ai.quiet.toFixed(1), quietBest: +ai.quietBest.toFixed(1),
    slips: ai.slips,
    ran: +ai.ran.toFixed(1),
  };
}

export { VOICE, RANKS };
