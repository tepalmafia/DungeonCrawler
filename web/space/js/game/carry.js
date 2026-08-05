// ══════════════════════════════════════════════════════════════════════════
//  옮길 수 있는 물건 — **규칙.** 그림은 world/carry.js 가 그린다.
//
//  ★ 여기에 three.js 가 없어야 `tools/space-carry.js` 가 브라우저 없이
//    돌린다. 「붙였다 떼는 것이 정말 손을 묶나」는 숫자로 재는 것이지
//    화면으로 재는 것이 아니다.
// ══════════════════════════════════════════════════════════════════════════
import { KINDS, SPOTS, CARRY, fits } from './carry-table.js';

export function makeCarry() {
  // 물건은 **처음에 전부 어딘가 붙어 있다.** 떠다니는 것으로 시작하면
  // 「붙인다」가 무슨 뜻인지 배울 데가 없다
  const items = Object.keys(KINDS).map((kind, i) => ({
    kind,
    // 정비실 자리 둘에 나눠 붙인다. 셋째는 통로 자리로 — 배 안에 흩어져
    // 있어야 「어디 뒀더라」가 생기고, 그게 이 계통의 재미다
    spot: ['shop-a', 'shop-b', 'observ-a'][i] ?? SPOTS[0].key,
  }));
  return {
    items,
    /** 지금 손에 든 것의 종류 (없으면 null) */
    held: null,
    /** 떼거나 붙이는 중 — 얼마나 잡고 있었나 */
    t: 0,
    /** 무엇을 하는 중인가: 'pull' | 'stick' | null */
    doing: null,
  };
}

/** 그 자리에 붙어 있는 물건 */
export function atSpot(c, spotKey) {
  return c.items.find((it) => it.spot === spotKey) ?? null;
}

/** 그 방에 있는 자리들 */
export function spotsIn(room) {
  return SPOTS.filter((s) => s.room === room);
}

/**
 * 잡고 있는 동안 부른다.
 *
 * @param spotKey 지금 겨누고 있는 자리
 * @param hold    잡고 있나
 * @returns 'pulled' | 'stuck' | null
 */
export function carryStep(c, spotKey, hold, dt) {
  if (!spotKey || !hold) {
    // ★ 놓으면 **되돌아간다.** 딱 멈추면 손을 뗄 이유가 없다
    //   (고장 수리 `slip` 과 같은 규약 — 배 안의 모든 「잡고 있기」가
    //   같은 규칙이라야 손이 헷갈리지 않는다)
    c.t = Math.max(0, c.t - dt * 0.8);
    if (c.t === 0) c.doing = null;
    return null;
  }

  const here = atSpot(c, spotKey);

  if (c.held) {
    // 손에 든 것이 있으면 **붙이는 것**이다. 자리가 비어 있어야 한다
    if (here) { c.doing = null; c.t = 0; return null; }
    c.doing = 'stick';
    c.t += dt;
    if (c.t < CARRY.stick) return null;
    c.t = 0; c.doing = null;
    if (!fits(spotKey, c.held)) return null;
    c.items.find((it) => it.kind === c.held).spot = spotKey;
    c.held = null;
    return 'stuck';
  }

  // 빈손이면 **떼는 것**이다
  if (!here) { c.doing = null; c.t = 0; return null; }
  c.doing = 'pull';
  c.t += dt;
  if (c.t < CARRY.pull) return null;
  c.t = 0; c.doing = null;
  here.spot = null;
  c.held = here.kind;
  return 'pulled';
}

/**
 * 고장이 물건을 **준다** — 「챙긴다」 걸음을 마쳤을 때.
 * 이미 뭘 들고 있으면 안 준다: 손은 하나뿐이라는 규칙이 여기서도 같다.
 */
export function give(c, kind) {
  if (c.held) return false;
  const it = c.items.find((x) => x.kind === kind);
  if (!it) return false;
  it.spot = null;
  c.held = kind;
  return true;
}

/**
 * 고장이 물건을 **먹는다** — 「갈아 넣는다」 걸음에 필요한 것.
 * 손에 없으면 그 걸음은 **시작도 안 된다.** 이게 「챙긴다」를 진짜로 만든다.
 */
export function take(c, kind) {
  if (c.held !== kind) return false;
  c.held = null;
  // 쓴 물건은 **정비실 제자리로 돌아간다.** 배에서 없어지면 다음 회차에
  // 고칠 방법이 사라지고, 그건 고장이 아니라 사망 선고다
  const it = c.items.find((x) => x.kind === kind);
  if (it) it.spot = 'shop-a';
  return true;
}

/** 검사·화면이 읽는 요약 */
export function summary(c) {
  return {
    held: c.held,
    doing: c.doing,
    t: +c.t.toFixed(2),
    items: c.items.map((it) => ({ kind: it.kind, spot: it.spot })),
  };
}
