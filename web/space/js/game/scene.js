// ══════════════════════════════════════════════════════════════════════════
//  장면 — **규칙.** 표는 scene-table.js 가 갖는다.
//
//  ★ 여기가 바꾸는 것 하나
//    지금까지 사건은 **저마다 제 타이머로** 왔다. 잔해밭은 230~400초마다,
//    추격은 자국이 차면, 고장은 90~150초마다. 그래서 **아무 때나 겹쳤고,
//    아무 때도 안 겹쳤다.** 겹치는 것이 우연이면 절정이 없다.
//
//    이제 **구간이 장면을 부른다.** 타이머는 그대로 두되 「지금 이 장면이
//    도는가」가 문을 연다. 배치표에 없는 구간에서는 그 사건이 안 온다.
//
//  ★ **대응 박자에는 잔일을 안 넣는다** (PLAN2H §7)
//    그때 새 고장이 뜨면 그건 긴장이 아니라 **방해**다. 앞 판에서 내가
//    틀린 게 정확히 이것이라, 규칙으로 못박는다 — `allowChore()`.
//
//  ★ **아직 안 만든 장면은 조용히 건너뛴다**
//    배치표에는 여덟이 다 적혀 있지만 게임에는 둘(A·D)뿐이다. 없는 것을
//    부르면 「예고만 뜨고 아무 일도 안 나는 구간」이 되고, 그건 버그로
//    읽힌다. `built` 가 아닌 장면은 배치에서 걸러 낸다 — 그리고 **몇 개를
//    걸렀는지 말한다.** 조용히 줄이면 「12구간 다 찼다」로 착각한다.
//
//  ★ three.js 를 안 쓴다 — tools/space-2h.js 가 브라우저 없이 읽는다.
// ══════════════════════════════════════════════════════════════════════════
import { SCENES, PLACEMENT, BEAT } from './scene-table.js';

/** 네 박자 */
export const BPHASE = {
  /** 아직 안 왔다 */
  WAIT: 'wait',
  /** 「온다」 */
  WARN: 'warn',
  /** 「어떻게든」 */
  ACT: 'act',
  /** 「됐다」 */
  CLEAR: 'clear',
  /** 「정리한다」 — ★ 여기가 「시간 가는 줄 모른다」의 자리다 */
  AFTER: 'after',
  /** 이 구간의 장면이 끝났다 */
  DONE: 'done',
};

/** 배치에서 **정말 뜰 수 있는** 것만 남긴다 */
export function playable(rows = PLACEMENT) {
  return rows.map((r) => ({
    ...r,
    scenes: r.scenes.filter((k) => SCENES[k]?.built),
    /** 표에는 있는데 아직 못 만든 것 — 도구가 이걸 센다 */
    notYet: r.scenes.filter((k) => !SCENES[k]?.built),
  }));
}

export function makeScenes(seed = 'SC1') {
  let h = 2166136261;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507)) >>> 0) / 4294967296;
  return {
    rnd,
    /** 지금 구간 (1부터) */
    leg: 1,
    /** 이 구간에 도는 장면 열쇠들 */
    keys: [],
    phase: BPHASE.WAIT,
    /** 이 박자에 들어온 지 몇 초 */
    t: 0,
    /** 이 박자가 몇 초짜리인가 */
    need: 0,
    /** 구간이 시작되고 몇 초 뒤에 예고가 뜨나 */
    at: 0,
    /** 구간이 시작되고 흐른 시간 */
    inLeg: 0,
    /** 지나온 장면들 — 끝 화면이 읽는다 (「이렇게 왔다」 · PLAN2H §9) */
    done: [],
  };
}

const pick = (rnd, [a, b]) => a + rnd() * (b - a);

/**
 * 구간이 바뀌었다 — **다음 장면을 예약한다.**
 * @param leg 1부터
 */
export function newLeg(s, leg) {
  s.leg = leg;
  s.inLeg = 0;
  s.t = 0;
  const row = playable()[leg - 1];
  s.keys = row?.scenes ?? [];
  s.hard = !!row?.hard;
  s.permanent = !!row?.permanent;
  if (!s.keys.length) { s.phase = BPHASE.DONE; s.need = 0; s.at = 0; return; }
  s.phase = BPHASE.WAIT;
  // ★ 구간 한복판에 오게 둔다. 거점을 나서자마자 오면 숨 돌릴 자리가 없고,
  //   구간 끝에 오면 여운이 거점에 먹힌다 — 여운은 **가는 동안**의 것이다
  s.at = 0.22 + s.rnd() * 0.16;    // 구간 길이의 22~38% 지점
  s.need = 0;
}

/**
 * 한 걸음. 박자가 바뀌면 그 이름을 돌려준다 (`'warn'` · `'act'` · …).
 * @param legSeconds 이 구간이 몇 초짜리인가 — 예고 시점을 여기에 비례해 잡는다
 */
export function stepScene(s, dt, legSeconds = 600) {
  s.inLeg += dt;
  if (s.phase === BPHASE.DONE) return null;

  if (s.phase === BPHASE.WAIT) {
    if (s.inLeg < legSeconds * s.at) return null;
    s.phase = BPHASE.WARN; s.t = 0; s.need = pick(s.rnd, BEAT.warn);
    return 'warn';
  }
  s.t += dt;
  if (s.t < s.need) return null;

  s.t = 0;
  if (s.phase === BPHASE.WARN) {
    s.phase = BPHASE.ACT; s.need = pick(s.rnd, BEAT.act);
    return 'act';
  }
  if (s.phase === BPHASE.ACT) {
    s.phase = BPHASE.CLEAR; s.need = pick(s.rnd, BEAT.clear);
    return 'clear';
  }
  if (s.phase === BPHASE.CLEAR) {
    s.phase = BPHASE.AFTER; s.need = pick(s.rnd, BEAT.after);
    return 'after';
  }
  // 여운이 끝났다 — 이 구간의 장면은 여기까지
  s.phase = BPHASE.DONE; s.need = 0;
  s.done.push(...s.keys);
  return 'done';
}

/** 지금 이 장면이 도는가 — 계통들이 이걸 보고 문을 연다 */
export function running(s, key) {
  return s.keys.includes(key)
    && (s.phase === BPHASE.WARN || s.phase === BPHASE.ACT || s.phase === BPHASE.CLEAR);
}

/** 예고 박자인가 — 「온다」를 화면에 띄우는 자리 */
export const warning = (s, key) => s.keys.includes(key) && s.phase === BPHASE.WARN;

/**
 * ★ **지금 잔일을 내도 되나** (PLAN2H §7)
 *
 *   대응 박자에 새 고장이 뜨면 그건 긴장이 아니라 **방해**다.
 *   예고와 여운에는 낸다 — 예고 때 고장이 하나 있으면 「하던 일을 마치고
 *   갈까」가 생기고, 그게 예고를 선택으로 만든다.
 */
export const allowChore = (s) => s.phase !== BPHASE.ACT;

/** 사람이 읽는 한 줄 — 배너와 끝 화면이 쓴다 */
export function leadOf(s) {
  const k = s.keys[0];
  return k ? SCENES[k]?.lead ?? null : null;
}

/** 이 구간 요약 — 검사가 읽는다 */
export function summary(s) {
  return {
    leg: s.leg, keys: [...s.keys], phase: s.phase,
    inLeg: +s.inLeg.toFixed(1), left: +Math.max(0, s.need - s.t).toFixed(1),
    done: [...s.done], hard: !!s.hard, permanent: !!s.permanent,
  };
}
