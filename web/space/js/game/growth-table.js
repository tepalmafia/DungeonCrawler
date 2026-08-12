// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **사람이 크는 길** — RPG 의 기둥 (v115). 숫자만.
//
//  ★ 사장님 (2026-08-11) 「**우주 비행전투 rpg야 우리 장르야**」
//
//  ══ 재 보니 기둥 하나가 통째로 비어 있었다 ═══════════════════════════
//
//  `space-genre.js` 를 돌려 보니 기둥 다섯 중 **넷은 서 있고 성장의
//  절반이 없었다.** 배는 크는데(파츠 · 등급 · 개조) **사람이 안 컸다.**
//  그건 RPG 가 아니라 **장비 게임**이다 — 주운 것이 곧 힘이면 사람은
//  고르기만 하고 늘지는 않는다.
//
//  ══ ★★★ 두 갈래를 **겹치지 않게** 가른다 ═══════════════════════════
//
//      **배**   주워서 큰다 — 운이 섞인다 · 부서지면 잃는다   `parts-table.js`
//      **사람** 해서 큰다   — 운이 안 섞인다 · 안 잃는다      **여기**
//
//  ★★ 겹치면 한쪽이 죽는다. 그래서 규칙을 하나 세운다:
//
//    **파츠는 「배의 성능」을 올리고, 특성은 「다루는 법」을 바꾼다.**
//
//    즉 특성은 화력·맷집을 안 건드린다. 대신 **조준 띠 · 회피 창 ·
//    열 · 화물칸 · 개조 값** 처럼 **이미 있는 계통의 규칙**을 옮긴다.
//    「숫자만 오르는 성장」은 진행 막대지 성장이 아니다 (`genre-table.js NOT`).
//
//  ══ ★★★ 경험은 **「했다」에서만** 나온다 ═════════════════════════════
//
//  가만히 있어도 오르는 것은 없다. 넷뿐이다:
//
//    ① **격추**       — 센 것을 잡으면 많이 (전투력 그대로)
//    ② ★ **정중앙**    — 잘 맞히면 더. 「잘하면 는다」가 여기 한 줄이다
//    ③ **구간 통과**   — 뚫으면 오른다 (목적 한 줄과 붙는다)
//    ④ **탄두 재료**   — 채우면 크게 오른다. 다섯뿐이라 회차의 뼈대가 된다
//
//  ★ 새 자원을 안 만든다. 넷 다 **이미 세고 있던 것**이다 —
//    `might-table.js` · `aim-table.js` · `route-table.js` · `warhead-table.js`
//
//  ══ **2시간 안에서 다 끝난다** ═══════════════════════════════════════
//
//  「회차 배수」·「무한 반복」은 낡은 것이다 (`PLAN2H.md §8`). 레벨은
//  **한 회차에 7 까지** 가고 거기서 멈춘다. 곡선은 손으로 안 고르고
//  `tools/space-growth.js` 가 **회차 하나를 통째로 돌려서** 맞췄다.
//
//  ★ three.js 를 안 쓴다 — `tools/space-growth.js` 가 읽는다.
// ══════════════════════════════════════════════════════════════════════════
import { mightOf } from './might-table.js';

/**
 * ★★ **경험이 나오는 자리 넷.**
 *
 *   ★ `kill` 은 배수다 — 적의 전투력(`might-table.js`)에 곱한다.
 *     새 숫자를 안 만든다는 이 저장소의 규약이고, 무엇보다 **「센 것을
 *     잡으면 많이」가 저절로** 성립한다 (파편 1 · 포함 29)
 */
export const XP = {
  kill: 1.0,
  /**
   * ★★★ **정중앙으로 마무리하면 이만큼 더** (배수).
   *
   *   ★ 이 한 줄이 「RPG 인데 실력 게임」을 만든다. 같은 적을 잡아도
   *     **잘 맞힌 사람이 더 큰다.** 0.35 는 재서 골랐다 — 0.8 로 두면
   *     정중앙만 노리다 놓치는 것이 이득이 되어 **안 쏘고 기다리는**
   *     게임이 되고, 0.1 이면 있으나 마나다
   */
  bull: 0.35,
  /** 구간 하나를 뚫으면 (12구간) */
  leg: 26,
  /**
   * ★★ 탄두 재료 하나를 실으면. **다섯뿐이라 회차의 뼈대**가 된다 —
   *   목적(뚫는다·채운다·떨군다)과 성장이 같은 길 위에 있게 하는 자리
   */
  mat: 70,
};

/** 이 적을 잡으면 얼마나 — `bull` 이면 정중앙 마무리 */
export const xpForKill = (kind, bull = false) =>
  +(mightOf(kind) * XP.kill * (bull ? 1 + XP.bull : 1)).toFixed(1);

/**
 * ★★★ **레벨 일곱.**
 *
 *   ★ 왜 일곱인가: 이 저장소가 가르침도 일곱, 부위도 일곱이다 —
 *     **사람이 한 번에 붙들 수 있는 수**라는 같은 이유다. 그리고 12구간에
 *     일곱이면 **두 구간에 한 번쯤** 오르므로, 오르는 것이 사건이 되면서도
 *     드물지 않다.
 *   ★★ 레벨 1 로 시작하므로 **고르는 것은 여섯 번**이다
 */
export const MAX_LV = 7;

/**
 * ★★ **다음 레벨까지 얼마나**: `base * lv^curve`.
 *
 *   ★ 두 값은 **손으로 안 골랐다.** `space-growth.js` 가 회차 하나를
 *     통째로 돌려(12구간 · 적 시계 · 재료 다섯) 「끝에 7 이 되나 ·
 *     너무 일찍 다 크지 않나」로 맞췄다.
 *   ★★ 처음에 `base` 를 **132** 로 적었다가 빨개졌다 — 회차를 다 돌아도
 *     **Lv5 에서 끝났다.** 2시간을 꼬박 굴렀는데 끝을 못 보는 성장은
 *     성장이 아니라 **못 채운 막대**다. 73 으로 내리니 보통 손이 끝에
 *     Lv7, 서툰 손이 Lv6, 절반에서 Lv4 다. **재기 전에 적었으면 또 틀렸다**
 */
export const CURVE = { base: 73, curve: 1.42 };

/** 레벨 `lv` → `lv+1` 에 드는 경험 */
export const needFor = (lv) =>
  Math.round(CURVE.base * Math.pow(Math.max(1, lv), CURVE.curve));

/** 처음부터 이 레벨이 되기까지의 총 경험 */
export function totalFor(lv) {
  let s = 0;
  for (let i = 1; i < lv; i++) s += needFor(i);
  return s;
}

/** 총 경험 → 지금 레벨 · 다음까지 얼마나 */
export function levelAt(xp = 0) {
  let lv = 1;
  while (lv < MAX_LV && xp >= totalFor(lv + 1)) lv++;
  const into = xp - totalFor(lv);
  const need = lv >= MAX_LV ? 0 : needFor(lv);
  return { lv, into: Math.max(0, Math.round(into)), need, k: need ? Math.min(1, into / need) : 1 };
}

/**
 * ══ ★★★ **특성 아홉 — 여섯만 고른다** ═══════════════════════════════
 *
 *  ★ 왜 다 못 고르게 하나. 다 가지면 **회차마다 같은 사람**이 되고,
 *    그러면 그건 성장이 아니라 해금이다. 셋을 못 고르므로 **이번 회차의
 *    나는 지난 회차와 다르다** — 2시간짜리 한 번의 여정에서 그 다름이
 *    다시 켜는 이유가 된다.
 *
 *  ★★ **아홉이 다 다른 계통을 건드린다.** 둘이 같은 것을 올리면 하나는
 *    있으나 마나이고, `space-growth.js` 가 그것을 센다.
 *
 * @property at   어느 계통을 바꾸나 — **이미 있는 것만**
 * @property how  사람이 읽는 말
 * @property val  게임이 읽는 값 (`effectOf` 가 모아서 준다)
 */
export const TRAITS = [
  {
    key: 'gunner', name: '사수', at: 'aim',
    how: '**정중앙 띠가 넓어진다** — 같은 손으로 더 깊게 박힌다',
    val: { bull: 0.07 },
    why: '조준(`aim-table.js BULL` 0.24)이 이 게임에서 제일 자주 쓰는 규칙이다',
  },
  {
    key: 'reflex', name: '반사', at: 'evade',
    how: '**회피 창이 넓어진다** — 늦게 꺾어도 걸린다',
    val: { window: 0.10 },
    why: '창이 0.45초다 (`evade-table.js`). 넓히면 「보고 누른다」가 쉬워진다',
  },
  {
    key: 'cool', name: '냉정', at: 'heat',
    how: '**레이저 열이 덜 오른다** — 오래 쏜다',
    val: { heatMult: 0.78 },
    why: '열은 v58 부터 이 배의 목줄이다 — 쏘면 못 숨는다',
  },
  {
    key: 'hauler', name: '짐꾼', at: 'hold',
    how: '**화물칸이 는다** — 더 싣고 덜 버린다',
    val: { hold: 22 },
    why: 'v114 가 화물칸에 뜻을 만들었다. 그 뜻을 사람이 늘릴 수 있게',
  },
  {
    key: 'tinker', name: '손끝', at: 'upgrade',
    how: '**개조에 드는 광석이 준다** — 같은 광석으로 더 올린다',
    val: { oreMult: 0.75 },
    why: '★ 사람 갈래가 **배 갈래를 돕는** 자리. 둘이 서로를 안 죽인다',
  },
  {
    key: 'eye', name: '눈', at: 'radar',
    how: '**레이더가 멀리 본다** — 먼저 고른다',
    val: { range: 45 },
    why: '「강하면 피한다」(v79)는 먼저 봐야 성립한다',
  },
  {
    key: 'wrench', name: '정비', at: 'fix',
    how: '**수리가 빨라진다** — 맞고도 덜 멈춘다',
    val: { fixMult: 0.72 },
    why: '수리는 v106 이 단추 하나로 만들었다. 그 시간이 곧 벌이다',
  },
  {
    key: 'engineer', name: '기관사', at: 'boost',
    how: '**급가속 추진제가 덜 든다** — 더 자주 뿌리친다',
    val: { fuelMult: 0.76 },
    why: '급가속은 v84 가 세운 저울이다 — 값을 낮추되 없애지는 않는다',
  },
  {
    key: 'maker', name: '손재주', at: 'craft',
    how: '**제조가 빨라진다** — 걸어 놓고 덜 기다린다',
    val: { craftMult: 0.65 },
    why: 'v114 의 제조가 8~40초다. 사람이 늘면 그 기다림이 준다',
  },
];

export const TRAIT_BY = Object.fromEntries(TRAITS.map((t) => [t.key, t]));

/** 한 회차에 고를 수 있는 수 = 레벨업 횟수 */
export const PICKS = MAX_LV - 1;

/**
 * ★★★ **고른 특성들이 합쳐서 무엇을 바꾸나** — **여기가 유일한 답이다.**
 *
 *   ★ 계통들이 제 방식으로 「내가 사수인가」를 물으면 그때부터 갈라진다.
 *     다 **여기 하나**를 부르고 값을 읽기만 한다 (`frame.js` 와 같은 규약)
 */
export function effectOf(picked = []) {
  const e = {
    bull: 0, window: 0, hold: 0, range: 0,
    heatMult: 1, oreMult: 1, fixMult: 1, fuelMult: 1, craftMult: 1,
  };
  for (const k of picked) {
    const t = TRAIT_BY[k];
    if (!t) continue;
    for (const [f, v] of Object.entries(t.val)) {
      // ★ 배수는 곱하고 더하는 값은 더한다 — 이름 끝의 `Mult` 로 가른다
      if (f.endsWith('Mult')) e[f] *= v; else e[f] += v;
    }
  }
  return e;
}

/** 새 파일럿 */
export const makePilot = () => ({ xp: 0, lv: 1, picked: [], owed: 0 });

/**
 * ★★ **경험을 준다** — 레벨이 오르면 `owed`(고를 빚)가 는다.
 *
 *   ★ 오르자마자 창을 띄우지 않는다. 싸우는 중일 수 있고, 그때 창이
 *     뜨면 그건 보상이 아니라 방해다. **빚으로 쌓아 두고** 사람이 열 때
 *     고른다 (I 창) — v109 이 없앤 「뒤로 가서」와 같은 병을 안 만든다
 */
export function gain(p, xp) {
  if (!(xp > 0)) return { up: 0 };
  p.xp += xp;
  const was = p.lv;
  p.lv = levelAt(p.xp).lv;
  const up = p.lv - was;
  if (up > 0) p.owed += up;
  return { up, lv: p.lv };
}

/** 특성을 고른다 — 빚이 있어야 고른다 */
export function pick(p, key) {
  if (!TRAIT_BY[key]) return { ok: false, why: 'none' };
  if (p.picked.includes(key)) return { ok: false, why: 'had' };
  if (!(p.owed > 0)) return { ok: false, why: 'owe' };
  p.picked.push(key);
  p.owed--;
  return { ok: true, trait: TRAIT_BY[key] };
}

export const PICK_WHY = {
  none: '그런 특성이 없습니다',
  had: '이미 고른 것입니다',
  owe: '고를 것이 없습니다 — 레벨이 올라야 고릅니다',
};
