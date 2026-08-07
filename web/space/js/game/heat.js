// ══════════════════════════════════════════════════════════════════════════
//  열 — **순수 규칙.** 숫자는 `heat-table.js` · `chase-table.js` 에 있다.
//
//  ★ 한 함수가 두 칸을 같이 굴린다 (`stepHeat`). 갈라 놓으면 「선체는
//    식었는데 저장고가 안 찼다」 같은 어긋남이 반드시 생긴다 —
//    옮기는 양은 **한 번만** 세어야 하고, 그러려면 한 자리에서 굴려야 한다.
// ══════════════════════════════════════════════════════════════════════════
import { HEAT } from './systems-table.js';
import { HEATING } from './chase-table.js';
import { SINK, coolEfficiency } from './heat-table.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const makeHeat = () => ({ hull: HEAT.start, sink: SINK.start });

/**
 * 한 프레임.
 *
 * @param s        { hull, sink }
 * @param o.thrust    추진 회로가 켜져 있나 — **열을 내는 것은 이것뿐이다**
 * @param o.cool      냉각 회로가 켜져 있나 — 선체에서 저장고로 **옮긴다**
 * @param o.valveOpen 라디에이터가 열려 있나 — **여기서만 진짜로 나간다**
 * @param o.extra     고장·분사·잔해가 얹는 선체 열 (초당)
 * @param o.noCool    이륙 분사 중 — 방열판을 접었으므로 냉각이 통째로 안 먹는다
 * @returns { gen, moved, dumped }  이번 프레임에 각각 얼마였나 (계기가 읽는다)
 */
export function stepHeat(s, dt, { thrust, cool, valveOpen, extra = 0, noCool = false }) {
  // ① 열이 **생긴다** — 배가 켜져 있으면 조금, 밟으면 많이
  const gen = HEATING.idle + (thrust ? HEATING.thrust : 0) + extra;

  // ② 냉각 회로 — 선체에서 저장고로 **옮긴다.**
  //    ★★ 여기가 이 판의 전부다. 예전에는 이 줄이 열을 **없앴다** —
  //      밸브가 닫혀 있어도 냉각만 켜면 열이 내려갔다. 진공에서는 그럴 수 없다
  let moved = 0;
  if (cool && !noCool) {
    // 저장고가 차 오면 **점점 안 먹는다.** 뚝 끊으면 「왜 갑자기」가 된다
    const room = SINK.max - s.sink;
    // ★★ **없는 열은 못 옮긴다** (`space-heat.js [4]` 가 잡았다).
    //   처음엔 이 줄이 없어서 냉각을 켜기만 하면 선체가 0 이어도 저장고가
    //   2.1/초로 찼다 — **멈춰 있어도 5.7분 뒤엔 들키는 배**였고, 그러면
    //   「밟는 것이 곧 들키는 것」이라는 이 게임의 축이 통째로 죽는다.
    //   퍼 올릴 수 있는 것은 **선체에 있는 것 + 지금 나는 것**뿐이다.
    const have = s.hull / Math.max(dt, 1e-6) + gen;
    moved = Math.min(SINK.moveRate * coolEfficiency(s.sink), room / Math.max(dt, 1e-6), have);
    moved = Math.max(0, moved);
  }

  // ③ 라디에이터 — 저장고에서 우주로 **버린다**
  let dumped = 0;
  if (valveOpen) dumped = Math.min(SINK.dumpRate, s.sink / Math.max(dt, 1e-6));

  s.sink = clamp(s.sink + (moved - dumped) * dt, 0, SINK.max);
  s.hull = clamp(s.hull + (gen - moved) * dt, 0, HEAT.max);
  return { gen, moved, dumped };
}

/**
 * 선체 온도가 초당 얼마나 변하나 — **계기와 시뮬이 같이 읽는다.**
 * (예전 `chase.js heatRate` 를 대신한다)
 */
export function hullRate(s, { thrust, cool, valveOpen, extra = 0 }) {
  const gen = HEATING.idle + (thrust ? HEATING.thrust : 0) + extra;
  const moved = cool ? SINK.moveRate * coolEfficiency(s?.sink ?? 0) : 0;
  return gen - moved;
}

/**
 * ★★ **배 안의 총열**이 초당 얼마나 변하나 — 선체와 저장고를 합친 것.
 *
 *   이게 열역학이 맞는지를 묻는 자리다: **라디에이터가 닫혀 있으면
 *   이 값은 절대 음수가 될 수 없다.** 열을 옮기는 것은 총열을 안 바꾼다.
 *   `tools/space-real.js [3]` 이 정확히 이걸 잰다.
 */
export function totalRate({ thrust, valveOpen, extra = 0 }) {
  const gen = HEATING.idle + (thrust ? HEATING.thrust : 0) + extra;
  return gen - (valveOpen ? SINK.dumpRate : 0);
}

/** 저장고가 가득이라 냉각이 안 먹나 */
export const sinkFull = (s) => s.sink >= SINK.max * SINK.fullAt;
/** 0~1 */
export const sinkAt = (s) => s.sink / SINK.max;

/**
 * ★ **얼마나 더 숨어 있을 수 있나** (초). 라디에이터를 안 열고 버티는 시간.
 *   이게 「우주에서 스텔스는 잠깐만 가능하다」의 실체이고, 화면에 뜨는 값이다.
 */
export function hideLeft(s, { thrust, cool }) {
  if (!cool) return 0;
  const gen = HEATING.idle + (thrust ? HEATING.thrust : 0);
  // ★ **채우는 것은 「지금 나는 열」이지 냉각 회로의 힘이 아니다.**
  //   선체에 고인 것을 퍼낸 뒤로는 나는 만큼만 옮겨진다 — 그래서
  //   **밟으면 빨리 차고 멈추면 거의 안 찬다.** 그게 이 게임의 축이다
  const rate = Math.min(SINK.moveRate * coolEfficiency(s.sink), gen);
  if (rate <= 0) return 9999;
  const room = Math.max(0, SINK.max * SINK.fullAt - s.sink);
  return Math.min(9999, room / rate);
}

export const summary = (s) => ({
  hull: +s.hull.toFixed(1),
  sink: +s.sink.toFixed(1),
  at: +sinkAt(s).toFixed(3),
  full: sinkFull(s),
});
