// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **가림 — 앞에 뭐가 있으면** — 뼈대 (v142). 기획은 `docs/space/COVER.md`.
//
//  ★ 사장님 (2026-08-13) 「**락온 했는데 앞에 장애물이 있으면 어떻게 되지?**」
//
//  ══ ★★★ 재 보니 **가림이 아예 없었다** ═══════════════════════════════
//
//  `combat-table.js` · `target.js` 어디에도 「사이에 뭐가 있나」를 묻는 줄이
//  없었다. 파편 뒤에 숨은 적도 그냥 맞고, 레이저가 바위를 통과하고,
//  락온은 영원히 붙어 있었다 — 즉 **「숨는다」가 이 게임에 없었다.**
//
//  ★★ 이건 v137 의 어스펙트·기동과 **짝이 되는 자리**다. 뒤로 돌아 들어가는
//    것에 값이 생겼으니, **가릴 것 뒤로 숨는 것**에도 값이 생기면
//    「어디에 서 있나」가 한 겹 더 깊어진다.
//
//  ★★★ **각으로 잰다 — 3D 광선을 안 쏜다.** 이 게임의 자리는 이미
//    방위·고도·거리이고(`frame.js`), 가림도 **같은 자로** 재야 갈라지지
//    않는다. 광선을 쓰면 그 순간 「자리를 아는 곳」이 둘이 된다.
//
//  ★ three.js 를 안 쓴다 — `tools/space-cover.js` 가 읽는다.
// ══════════════════════════════════════════════════════════════════════════
import { lenOf } from './target-table.js';

/** ★ 이것들만 가린다 — **안 움직이는 것**. 적끼리 가리면 매 프레임 바뀐다 */
export const BLOCKERS = ['hulk', 'ice', 'junk', 'sat', 'tank'];

export const COVER = {
  /**
   * ★★ **반쯤 가림의 폭.** 각 차이가 「가림막 반지름 × 이 값」 안이면
   *   완전히 가려지고, `1.0` 까지는 **반쯤** 가려진다.
   *   ★ 있고 없고 둘뿐이면 **가장자리로 쏠 이유가 없다**
   */
  full: 0.6,
  /** 반쯤 가려졌을 때 명중률 배수 — 막히지는 않되 잘 안 맞는다 */
  grazeHit: 0.55,

  /**
   * ★★★ **락온이 가려진 채 버티는 시간** (초).
   *   ★ 즉시 풀면 파편 하나가 스쳐도 끊겨서 **전투가 운**이 된다.
   *     2.5초는 「일부러 숨은 것」과 「지나가는 것에 걸린 것」을 가르는 값이다
   */
  hold: 2.5,

  /** 무기마다 가림을 어떻게 타나 (`docs/space/COVER.md §2`) */
  weapon: {
    laser: { blocked: true, why: '직진하는 빛이라 **막힌다**' },
    ir: { blocked: true, why: '눈이 없고 열만 봐서 **막힌다**' },
    //  ★★★ 셋이 다 막히면 **「숨으면 무적」**이 된다. 유도탄이 돌아가야
    //    숨은 적을 꺼낼 방법이 남고, 「어느 무기를 쏘나」에 이유가 하나 는다
    arh: { blocked: false, slow: 0.4, why: '유도가 붙어 **돌아간다** — 대신 느리다' },
  },
};

/**
 * ★★★ **이 표적이 가려졌나** — 각으로 잰다.
 *
 * @param target 표적 `{ az, el, dist }`
 * @param list   하늘에 떠 있는 것들 (표적 자신도 들어 있어도 된다)
 * @returns { by, k } — `by` 는 가린 것(없으면 null) · `k` 는 0(안 가림)~1(다 가림)
 */
export function coverOf(target, list = []) {
  if (!target) return { by: null, k: 0 };
  let best = { by: null, k: 0 };
  for (const o of list) {
    if (o === target || o.id === target.id) continue;
    if (!BLOCKERS.includes(o.kind)) continue;
    // ★★★ **표적보다 가까워야** 가린다 — 뒤에 있는 것은 못 가린다
    if (!(o.dist < target.dist)) continue;
    // 각 차이 (도) — 방위는 한 바퀴를 감아야 한다
    const dAz = ((o.az - target.az + 540) % 360) - 180;
    const dEl = (o.el ?? 0) - (target.el ?? 0);
    const off = Math.hypot(dAz, dEl);
    // 가림막의 각지름 절반
    const half = Math.atan((lenOf(o.kind) / 2) / Math.max(1, o.dist)) * 180 / Math.PI;
    if (half <= 0) continue;
    const r = off / half;                       // 0 이면 정확히 뒤, 1 이면 가장자리
    if (r >= 1) continue;
    const k = r <= COVER.full ? 1 : 1 - (r - COVER.full) / (1 - COVER.full);
    if (k > best.k) best = { by: o, k: +k.toFixed(2) };
  }
  return best;
}

/** 다 가려졌나 · 반쯤인가 — 화면과 판정이 **같은 말**을 쓴다 */
export const isHidden = (c) => (c?.k ?? 0) >= 1;
export const isGrazed = (c) => (c?.k ?? 0) > 0 && (c?.k ?? 0) < 1;

/**
 * ★★★ **이 무기가 이 가림을 뚫나.**
 * @returns { blocked, hitMult, slow } — `blocked` 면 아예 안 나간다
 */
export function throughCover(weaponKey, cover) {
  const w = COVER.weapon[weaponKey] ?? { blocked: true };
  const k = cover?.k ?? 0;
  if (k <= 0) return { blocked: false, hitMult: 1, slow: 0 };
  if (!w.blocked) return { blocked: false, hitMult: 1, slow: (w.slow ?? 0) * k };
  //  ★ 반쯤 가림이면 **막히지는 않되 잘 안 맞는다** — 가장자리로 쏘는 길
  if (k < 1) return { blocked: false, hitMult: COVER.grazeHit, slow: 0 };
  return { blocked: true, hitMult: 0, slow: 0 };
}

/**
 * ★★ **가려진 채 얼마나 버텼나** — 락온이 풀리는가.
 * @returns { lost, left } — `left` 는 남은 초 (계기가 세어 준다)
 */
export function holdLock(heldT) {
  const left = Math.max(0, COVER.hold - (heldT ?? 0));
  return { lost: left <= 0, left: +left.toFixed(1) };
}

/**
 * ★★★ **적도 쓴다** — 숨을 곳을 고른다 (`COVER.md §4`).
 *
 *   ★ 가림이 **나만 쓰는 것**이면 그건 규칙이 아니라 **편의**다. 맷집이
 *     깎인 적이 가림막 뒤로 붙으면, v137 의 `extend`(빠지는 기동)가
 *     비로소 **갈 곳**을 갖는다 — 「그냥 멀어진다」가 「저기로 숨는다」가 된다.
 *   ★★ 그래서 사람이 하게 되는 것이 셋으로 는다: **돌아 들어가거나**
 *     (v137 어스펙트) · **유도탄을 쓰거나**(§2) · **기다리거나**.
 *
 * @returns 숨을 만한 가림막 (없으면 null)
 */
export const HIDE = {
  /** 이 각 안에 있는 것만 노린다 (도) — 하늘 반대편까지 가면 그건 도망이다 */
  look: 50,
  /** 숨으러 도는 속도 (초당 도) */
  turn: 24,
};

export function hideBehind(t, list = []) {
  if (!t) return null;
  let best = null; let score = -Infinity;
  for (const o of list) {
    if (o === t || o.id === t.id) continue;
    if (!BLOCKERS.includes(o.kind)) continue;
    if (!(o.dist < t.dist)) continue;
    const dAz = ((o.az - t.az + 540) % 360) - 180;
    const dEl = (o.el ?? 0) - (t.el ?? 0);
    const off = Math.hypot(dAz, dEl);
    if (off > HIDE.look) continue;
    //  ★ **큰 것이 가깝게 있으면 제일 좋다.** 각지름에서 「가는 품」을 뺀다 —
    //    코앞의 파편보다 조금 떨어진 표류선이 나은 경우가 실제로 있다
    const half = Math.atan((lenOf(o.kind) / 2) / Math.max(1, o.dist)) * 180 / Math.PI;
    const s = half - off * 0.12;
    if (s > score) { score = s; best = o; }
  }
  return best;
}

/** 화면이 하는 말 — **무엇에 막혔는지 이름을 댄다** */
export const coverWord = (cover, names = {}) => {
  if (!cover?.by) return '';
  const n = names[cover.by.kind] ?? '무언가';
  return isHidden(cover) ? `${n}에 가렸습니다` : `${n}에 반쯤 가렸습니다`;
};
