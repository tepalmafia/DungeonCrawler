// ══════════════════════════════════════════════════════════════════════════
//  느려지는 시간 — **규칙.** 표는 `slow-table.js` 가 갖는다 (v84)
//
//  ★★★ **이 파일의 존재 이유 한 줄: 배율은 한 곳에서만 정한다.**
//    발사와 회피가 각자 `dt` 를 곱하면 0.45×0.45 = 0.20 이 되어 화면이
//    거의 멈춘다. 여기서는 **부른 것 중 제일 느린 하나만** 쓰고 바닥으로
//    막는다. 그리고 **회차 예산**을 여기서 센다 — 안 세면 「몇 번쯤
//    걸리겠지」가 되고, 이 저장소는 그 짐작으로 두 번 틀렸다.
//
//  ★ three.js 를 안 쓴다.
// ══════════════════════════════════════════════════════════════════════════
import { SLOW } from './slow-table.js';

export function makeSlow() {
  return {
    /** 지금 걸려 있는 것들 — { who: 남은 실시간 초 } */
    on: {},
    /** 지금 배율 (1 이면 보통 속도). 화면·소리가 읽는다 */
    k: 1,
    /** 풀리는 중 남은 시간 (실시간 초) */
    back: 0,
    /** 회피 슬로우 재사용 대기 */
    cool: 0,
    /** ★ 이번 회차에 느려진 총 실시간 (초) · 몇 번 걸렸나 — 도구와 끝 화면이 읽는다 */
    spent: 0, times: 0,
    /** 예산을 다 썼나 */
    dry: false,
  };
}

/**
 * ★★ **부른다.** 못 걸면 왜 못 거는지 돌려준다 (v64 규약 — 조용히 안
 *   되면 「고장」으로 읽힌다).
 *
 * @param who 'launch' | 'evade'
 * @param sec 실시간 몇 초 (안 주면 표가 정한 길이)
 * @returns { ok, why? }
 */
export function askSlow(s, who, sec = null) {
  const cfg = SLOW[who];
  if (!cfg) return { ok: false, why: 'who' };
  // ★★ 예산이 회차 단위라 **여기서 막는다.** 도구에서만 재면 「검사는
  //   통과인데 실제로는 넘는」 일이 난다 — 검사는 씨 하나를 볼 뿐이다
  if (s.spent >= SLOW.budget) { s.dry = true; return { ok: false, why: 'budget' }; }
  if (who === 'evade' && s.cool > 0) return { ok: false, why: 'cool' };

  // 발사 슬로우의 `sec` 은 **게임 시간**(사출 구간)이라 실시간으로 옮긴다.
  // ★ 이걸 안 옮기면 「사출이 끝나기 전에 시간이 돌아온다」 — 그러면
  //   불이 붙는 순간과 시간이 돌아오는 순간이 어긋나고, 이 계통의
  //   요점(둘이 한 동작)이 그대로 없어진다
  const real = sec ?? (who === 'launch' ? cfg.sec / cfg.scale : cfg.maxSec);
  s.on[who] = Math.max(s.on[who] ?? 0, Math.min(real, SLOW.evade.maxSec * 2));
  s.times++;
  if (who === 'evade') s.cool = SLOW.evade.cool;
  return { ok: true };
}

/** 이 부름을 지금 놓는다 (회피는 탄이 닿으면 곧 놓는다) */
export function dropSlow(s, who) {
  if (s.on[who] !== undefined) { delete s.on[who]; s.back = SLOW.back; }
}

/**
 * ★★★ **한 걸음** — 실시간 dt 를 받아 **게임 시간 dt** 를 돌려준다.
 *
 *   ★ 부르는 쪽(`main.js`)이 이 한 줄만 통과시키면 아래 계통 전부가
 *     같이 느려진다. 계통마다 「지금 느린가」를 묻게 하면 반드시 하나를
 *     빠뜨린다 (멈춤 처리를 `dt = 0` 한 줄로 둔 것과 같은 이유)
 *
 * @returns { dt, k } 게임 시간 dt 와 지금 배율
 */
export function stepSlow(s, dtReal) {
  if (s.cool > 0) s.cool = Math.max(0, s.cool - dtReal);

  // 걸려 있는 것들이 실시간으로 삭는다
  let want = 1;
  for (const who of Object.keys(s.on)) {
    s.on[who] -= dtReal;
    if (s.on[who] <= 0) { delete s.on[who]; s.back = SLOW.back; continue; }
    // ★★ **제일 느린 하나만.** 곱하지 않는다 — 이 파일의 존재 이유
    want = Math.min(want, SLOW[who]?.scale ?? 1);
  }
  want = Math.max(SLOW.floor, want);

  if (want < 1) {
    s.k = want;
    s.back = 0;
  } else if (s.back > 0) {
    // 풀리는 중 — 뚝 끊지 않고 되돌아온다
    s.back = Math.max(0, s.back - dtReal);
    const k = 1 - s.back / SLOW.back;
    s.k = s.k + (1 - s.k) * Math.max(0, Math.min(1, k));
    if (s.back <= 0) s.k = 1;
  } else {
    s.k = 1;
  }

  if (s.k < 1) s.spent += dtReal;
  if (s.spent >= SLOW.budget) s.dry = true;
  return { dt: dtReal * s.k, k: s.k };
}

/** 지금 느린가 — 화면이 가장자리를 물들이고 소리가 낮아진다 */
export const slowNow = (s) => s.k < 0.995;

/** 검사·화면이 읽는다 */
export function summary(s) {
  return {
    k: +s.k.toFixed(3),
    on: Object.keys(s.on),
    cool: +s.cool.toFixed(2),
    spent: +s.spent.toFixed(1), times: s.times, dry: s.dry,
    budget: SLOW.budget,
  };
}

export { SLOW };
