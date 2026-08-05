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
import { SCENES, PLACEMENT, BEAT, EMBER } from './scene-table.js';

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
    /** 이번 구간에서 **이미 끝난** 장면들 — 겹친 구간에서 둘 다 끝나야 해소다 */
    ended: [],
    /** 여운에 낼 일을 몇 초 뒤에 낼 것인가. 0 이면 이미 냈다 */
    ember: 0,
    /** 대응 시계가 다 됐는데 계통이 아직 안 끝냈나 — main.js 가 매 프레임 읽는다 */
    overdue: false,
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
  s.ended = [];
  s.ember = 0;
  s.overdue = false;
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

  if (s.phase === BPHASE.ACT) {
    // ★ **조용히 넘어가지 않는다.** 여기서 그냥 CLEAR 로 가면 「장면은
    //   끝났는데 적은 아직 붙어 있는」 상태가 된다 — 해소가 「됐다」인데
    //   아무것도 안 됐다. 계통에게 **끝내라고 말하고**, 계통이 끝내면
    //   `resolve()` 로 돌아온다. 그때까지 대응 박자에 머문다.
    //
    // ★ 한 번만 외치고 **깃발로 남긴다.** `s.t` 를 되돌려 다시 외치게 하면
    //   「끝내라」가 `need` 초마다 반복되고, 그 사이 계통은 못 끝낸 채로
    //   있는데 아무도 안 재촉하는 구멍이 생긴다. 깃발이면 매 프레임 읽힌다
    if (!s.overdue) { s.overdue = true; return 'act-end'; }
    return null;
  }

  s.t = 0;
  if (s.phase === BPHASE.WARN) {
    s.phase = BPHASE.ACT; s.need = pick(s.rnd, BEAT.act); s.overdue = false;
    return 'act';
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

/** 지금 이 장면이 도는가 — 「이 구간의 장면인가」에 가깝다 */
export function running(s, key) {
  return s.keys.includes(key)
    && (s.phase === BPHASE.WARN || s.phase === BPHASE.ACT || s.phase === BPHASE.CLEAR);
}

/**
 * ★ **계통의 문이 열렸나** — `running` 과 다르다.
 *
 *   `running` 은 「이 구간의 장면인가」이고, 이것은 **「지금 와도 되나」**다.
 *   전에는 둘을 같은 함수로 썼고, 그래서 **예고 중에 이미 적이 붙었다.**
 *   「온다」와 「왔다」가 같은 순간이면 그건 예고가 아니라 사고다 (§2).
 *
 *   여는 박자는 장면마다 다르다 (`SCENES[key].opensAt`) —
 *   잔해(D)는 제 예고를 이미 갖고 있어서 예고부터 연다.
 */
export function opens(s, key) {
  if (!s.keys.includes(key)) return false;
  const at = SCENES[key]?.opensAt ?? 'act';
  if (s.phase === BPHASE.ACT || s.phase === BPHASE.CLEAR) return true;
  return at === 'warn' && s.phase === BPHASE.WARN;
}

/**
 * ★ **해소는 시계가 아니라 사건이 정한다.**
 *
 *   뿌리쳤다 · 지대를 나왔다 · 고쳤다 — 계통이 실제로 끝난 그 순간에
 *   장면도 해소로 간다. 시계로만 넘기면 「뿌리쳤는데 장면은 아직 대응」
 *   이거나 그 반대가 되고, 그러면 **해소에 붙여 놓은 「뿌리친 3초」가
 *   엉뚱한 데서 난다.** 이 게임 최고의 자산을 헛 자리에 쓰는 셈이다.
 *
 * @returns 'clear' 면 해소로 갔다. null 이면 지금 받을 상태가 아니다
 */
export function resolve(s, key) {
  if (!s.keys.includes(key)) return null;
  if (s.phase !== BPHASE.ACT) return null;
  // 겹친 구간(9·11)에서는 **둘 다 끝나야** 해소다. 하나만 끝난 것은 해소가 아니다
  s.ended = [...new Set([...(s.ended ?? []), key])];
  const live = s.keys.filter((k) => SCENES[k]?.built);
  if (live.some((k) => !s.ended.includes(k))) return null;
  s.phase = BPHASE.CLEAR; s.t = 0; s.overdue = false;
  s.need = pick(s.rnd, BEAT.clear);
  return 'clear';
}

/**
 * 여운에 **일이 하나 온다** — 언제 낼 것인가 (초).
 * ★ 해소 직후 0초에 내지 않는다. 「뿌리친 3초」 위에 일을 얹으면
 *   보상이 사라진다 (`EMBER.within` 참고)
 */
export const emberAt = (s) => 3 + s.rnd() * Math.max(0, EMBER.within - 3);

/** 여운에 낼 만큼 닳았나 */
export const emberWorth = (wear) =>
  EMBER.chore && Object.values(wear ?? {}).some((v) => v >= EMBER.needWear);

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
    leg: s.leg, keys: [...s.keys], phase: s.phase, ended: [...(s.ended ?? [])],
    ember: +(s.ember ?? 0).toFixed(1), overdue: !!s.overdue,
    inLeg: +s.inLeg.toFixed(1), left: +Math.max(0, s.need - s.t).toFixed(1),
    done: [...s.done], hard: !!s.hard, permanent: !!s.permanent,
  };
}
