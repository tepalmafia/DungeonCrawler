// ══════════════════════════════════════════════════════════════════════════
//  옮길 수 있는 물건 — **「들었다 놓는다」가 아니라 「떼었다 붙인다」.**
//
//  ★ 왜 (2026-08-05 · 사장님 「들고 떨어뜨리고 누르고 뽑고, 옮길 수 있는
//    물건들도 만들고」 + docs/space/REALSHIP.md §5)
//
//    조사해 보니 실제 배에는 **놓는다는 개념이 없다.** 화물 가방(CTB)은
//    여섯 면 전부에 벨크로가 붙어 있고, 공구는 줄로 묶고, 「장비 고정
//    장치(PERS)」라는 계통이 따로 있다. 안 묶으면 날아가니까.
//
//    이게 무중력이 아니어도 **배다운 규약**이다. 그리고 게임으로도 이쪽이
//    낫다 — 「아무 데나 놓기」는 물건이 바닥에 흩어지는 것으로 끝나지만,
//    **「제자리에 붙인다」는 자리가 정해져 있으므로 찾을 데가 있다.**
//    베이 번호와 같은 이유다 (bay-table.js).
//
//  ★ 이 계통이 게임이 되는 지점은 **한 번에 하나**다
//    이 게임의 중심은 「동시에 두 곳에 못 있는다」이다 (GAP.md §3-C).
//    손도 같다 — **뭔가를 들고 있으면 두 손 쓰는 손잡이를 못 잡는다.**
//    냉매통을 안고 기관실로 가는 길에 문이 끼면, 크랭크를 돌리려고
//    **통을 어딘가 붙여 놓아야** 한다. 그게 이 계통의 전부다.
//
//  ★ 그리고 이건 이미 반쯤 있던 것을 마저 만드는 일이다
//    두 걸음짜리 고장은 벌써 「정비실에서 냉매 한 통을 챙긴다 → 기관실에서
//    갈아 넣는다」라고 말하고 있었다 (mission-table.js). 그런데 **실제로
//    들리는 것이 없었다** — 정비실 패널을 5초 잡고, 기관실 패널을 8초
//    잡으면 끝이었다. 말과 손이 어긋나 있었다.
//
//  ★ three.js 를 안 쓴다 — tools/space-carry.js 가 브라우저 없이 읽는다.
// ══════════════════════════════════════════════════════════════════════════

/**
 * 물건 종류.
 *
 * `both` 가 이 표의 핵심이다 — **두 손으로 안는 것**은 들고 있는 동안
 * 아무 손잡이도 못 잡는다. 한 손짜리는 들고도 문 크랭크 정도는 돌린다.
 * 「무겁다」를 무게 숫자가 아니라 **못 하게 되는 일**로 말한다.
 */
export const KINDS = {
  coolant: {
    name: '냉매통',
    both: true,               // 두 손 — 안고 가면 아무것도 못 잡는다
    at: 'workshop',           // 처음 붙어 있는 방
    for: 'coolant',           // 이 계통 고장에 쓴다
    tint: 0x6fd8ff,
  },
  part: {
    name: '부품 상자',
    both: true,
    at: 'workshop',
    for: null,                // 아무 데나 — 부품을 먹는 고장 전부
    tint: 0xffc46a,
  },
  tools: {
    name: '공구 가방',
    both: false,              // 한 손 — 어깨에 멘다
    at: 'workshop',
    for: null,
    tint: 0xb9c2cc,
  },
};

/**
 * 붙일 수 있는 자리.
 *
 * ★ **아무 데나 못 붙인다.** 아무 데나 붙으면 「제자리」가 없어지고,
 *   제자리가 없으면 찾을 데도 없다. 그리고 자리가 정해져 있어야
 *   「가는 길에 잠깐 붙여 둔다」가 **선택**이 된다 — 다시 오면 된다.
 */
export const SPOTS = [
  { key: 'shop-a', room: 'workshop', name: '정비 2' },
  { key: 'shop-b', room: 'workshop', name: '정비 3' },
  { key: 'observ-a', room: 'observ', name: '관측 2' },
  { key: 'engine-a', room: 'engine', name: '기관 4' },
  { key: 'engine-b', room: 'engine', name: '기관 6' },
];

// ★ **통로에는 아직 붙일 자리가 없다.** 「가는 길에 잠깐 붙여 둔다」는
//   통로가 제일 좋은데, 통로 벽이 아직 맨 벽이라 랙이 하나도 없다.
//   그건 REALSHIP.md §8-③ 「맨 벽 없애기」가 할 일이고, 그때 통로 자리를
//   더한다. 지금 좌표만 찍어서 허공에 자리를 만들면 **번호가 안 붙은
//   자리**가 생기고, 그건 「저기 어디」로 되돌아가는 것이다.

export const CARRY = {
  /** 떼는 데 걸리는 시간(초). 딸깍이면 물건이 가벼워 보인다 */
  pull: 0.9,
  /** 붙이는 데 걸리는 시간(초). 뗄 때보다 빨라야 한다 —
   *  급할 때 내려놓는 동작이 느리면 그건 벌이 아니라 짜증이다 */
  stick: 0.5,
  /** 손에 든 것이 조준을 얼마나 가리나 (0~1). 화면 아래쪽만 먹는다 */
  cover: 0.22,
};

/** 그 물건을 들고 이 손잡이를 잡을 수 있나 */
export function canGrab(holding, aim) {
  if (!holding) return true;
  if (!KINDS[holding]?.both) return true;
  // 두 손으로 안고 있으면 **아무것도 못 잡는다.** 다만 「붙이는 자리」는
  // 잡을 수 있어야 한다 — 아니면 영영 못 내려놓는다
  return typeof aim === 'string' && aim.startsWith('spot:');
}

/** 그 자리에 그 물건을 붙일 수 있나 — 지금은 자리가 종류를 안 가린다 */
export function fits(spotKey, kind) {
  return SPOTS.some((s) => s.key === spotKey) && !!KINDS[kind];
}

/**
 * 그 고장이 **무엇을 들고 가야 하는 일인가.**
 *
 * ★ 표에 새 칸을 만들지 않는다. 이미 적혀 있는 말에서 읽는다 — 칸을
 *   늘리면 고장 스물여덟 종을 전부 다시 적어야 하고, 그러면 안 한다.
 *
 * ★ **「주는 걸음」만 말로 찾고, 「먹는 걸음」은 자리로 찾는다.**
 *   처음엔 둘 다 말로 찾았다 — `/갈아 넣는다|메운다|튼다/`. 그랬더니
 *   네 고장 중 둘만 걸렸다: 「눈금을 다시 맞춘다」와 「조종간 밑을
 *   조인다」가 빠졌다. 두 걸음짜리 고장의 **뒷걸음은 전부 앞걸음에서
 *   챙긴 것을 쓰는 것**이므로, 말을 늘려 가며 쫓을 일이 아니었다.
 *   말로 규칙을 만들면 말이 늘 때마다 규칙이 샌다.
 *
 * @returns null | { giveAt, takeAt, kind }
 */
export function carryPlan(steps) {
  if (!steps || steps.length < 2) return null;
  const giveAt = steps.findIndex((s) => /챙긴다/.test(s?.what ?? ''));
  if (giveAt < 0 || giveAt === steps.length - 1) return null;
  return { giveAt, takeAt: giveAt + 1, kind: kindFor(steps[giveAt].what) };
}

/** 「냉매 한 통을 챙긴다」 → 냉매통. 그 밖은 전부 부품 상자다 */
function kindFor(what = '') {
  if (/냉매/.test(what)) return 'coolant';
  return 'part';
}

/** 이 걸음이 물건을 주나·먹나 — `carryPlan` 을 걸음 하나에서 묻는 꼴 */
export function needsCarry(steps, i) {
  const p = carryPlan(steps);
  if (!p) return null;
  if (i === p.giveAt) return 'give';
  if (i === p.takeAt) return 'take';
  return null;
}
