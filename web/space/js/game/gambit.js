// ══════════════════════════════════════════════════════════════════════════
//  승부수 — **순수 규칙.** 숫자는 `gambit-table.js` 에 있다 (v68).
//
//  ★ 여기는 three.js 도 DOM 도 안 쓴다. `tools/space-gambit.js` 가
//    브라우저 없이 2시간을 돌려 본다.
// ══════════════════════════════════════════════════════════════════════════
import { GAMBITS, GAMBIT, badChance, canOffer } from './gambit-table.js';

export const makeGambit = () => ({
  /** 지금 떠 있는 것 (없으면 null) */
  on: null,
  /** 남은 시간 — 0 이 되면 사라진다 */
  live: 0,
  /** 잡고 있은 시간 */
  held: 0,
  /** 마지막으로 뭔가 뜬 뒤 흐른 시간 */
  since: GAMBIT.gapMin,
  /** 평온할 때의 시계 (남의 미끼) */
  calmT: 0,
  /** 이번 추격에서 이미 몇 번 떴나 — 한 추격에 몰아서 뜨는 것을 막는다 */
  thisChase: 0,
  /** 기록 — 끝 화면이 「이렇게 왔다」에 쓴다 */
  log: [],
});

/** 이번 추격이 끝났다 — 셈을 되돌린다 */
export function chaseOver(g) { g.thisChase = 0; }

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * 한 걸음.
 *
 * @param o.chasing 쫓기는 중인가
 * @param o.chaseLeft 이 추격이 얼마나 남았나 (0~1) — 뜰 확률을 여기서 뽑는다
 * @param o.ore · o.hazard · o.allOff  판이 갖춰졌나
 * @param o.rnd  0~1 을 주는 함수 (검사가 씨를 고정한다)
 * @returns 'offer' | 'gone' | null
 */
export function stepGambit(g, dt, o = {}) {
  g.since += dt;
  if (g.on) {
    g.live -= dt;
    if (g.live <= 0) {
      // ★ **안 골라도 된다.** 강제하면 그건 선택이 아니라 시험이다
      g.on = null; g.held = 0; g.since = 0;
      return 'gone';
    }
    return null;
  }
  const rnd = o.rnd ?? Math.random;
  if (g.since < GAMBIT.gapMin) return null;

  // ── 평온할 때 — 남의 미끼 ────────────────────────────
  if (!o.chasing) {
    g.calmT += dt;
    if (g.calmT < GAMBIT.calmEvery) return null;
    g.calmT = 0;
    const bait = GAMBITS.find((x) => x.needs.calm);
    if (!bait || !canOffer(bait, o)) return null;
    g.on = bait; g.live = GAMBIT.live; g.held = 0;
    return 'offer';
  }

  // ── 쫓기는 중 ────────────────────────────────────────
  // ★ 한 추격에 **평균 `everyChase` 번**. 추격이 짧게 끝나면 덜 뜨는 것이
  //   맞다 — 남은 길이에 비례해 뽑는다
  if (g.thisChase >= 2) return null;
  const cand = GAMBITS.filter((x) => !x.needs.calm && canOffer(x, o));
  if (!cand.length) return null;
  // 추격 하나가 90~180초이므로, 초당 이만큼이면 평균 `everyChase` 번이다
  const per = GAMBIT.everyChase / 135;
  if (rnd() > per * dt) return null;
  g.on = cand[Math.floor(rnd() * cand.length) % cand.length];
  g.live = GAMBIT.live; g.held = 0; g.thisChase += 1;
  return 'offer';
}

/** 지금 떠 있는 것의 손잡이가 이것인가 */
export const handIs = (g, hand) => !!(g.on && g.on.hand === hand);

/**
 * 손을 대고 있다 — 다 잡으면 결판이 난다.
 * @returns null | { key, good, what, gain }
 */
export function holdGambit(g, dt, { holding = false, leg = 0, rnd = Math.random } = {}) {
  if (!g.on) return null;
  if (!holding) { g.held = Math.max(0, g.held - dt * 1.4); return null; }
  g.held += dt;
  if (g.held < g.on.hold) return null;

  const bad = rnd() < badChance(g.on, leg);
  const side = bad ? g.on.bad : g.on.good;
  const out = { key: g.on.key, name: g.on.name, good: !bad, what: side.what, gain: side };
  g.log.push({ key: g.on.key, name: g.on.name, good: !bad });
  g.on = null; g.held = 0; g.live = 0; g.since = 0;
  return out;
}

/** 얼마나 잡았나 (0~1) — 화면이 띠로 보여준다 */
export const holdAt = (g) => (g.on ? clamp01(g.held / g.on.hold) : 0);

export const summary = (g) => ({
  on: g.on ? g.on.key : null,
  name: g.on ? g.on.name : null,
  hand: g.on ? g.on.hand : null,
  lead: g.on ? g.on.lead : null,
  live: +g.live.toFixed(1),
  held: +holdAt(g).toFixed(2),
  took: g.log.length,
  good: g.log.filter((x) => x.good).length,
});
