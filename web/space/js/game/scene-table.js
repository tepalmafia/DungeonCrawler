// ══════════════════════════════════════════════════════════════════════════
//  장면 — **긴장에 모양을 준다** (docs/space/PLAN2H.md §1~§6)
//
//  ★ 앞 판에서 내가 틀린 것
//    「겹침을 1 → 2 → 3 으로 늘린다」고 적었다. 그건 **음량 조절이지
//    설계가 아니다.** 시끄러움을 키우는 것과 무서워지는 것은 다르다.
//    사장님이 그 자리를 정확히 짚으셨다 — 「계속 일들이 겹치면 안 되고」.
//
//  ★ 그래서 뒤집었다
//    사건이 **무작위로 오는 것**을 **배치로** 바꾼다. 구간마다 **이름이
//    있는 장면 하나**가 오고, 겹치는 것은 2시간에 **딱 두 번**이다.
//    그래서 그 두 번이 무섭다.
//
//  ★ 여덟이 **다 다른 방에 사람을 묶는다**
//    그게 「같은 것 또 하네」를 막는 유일한 방법이다. 세기를 올리는 것으로는
//    안 된다 — 같은 방에서 같은 손짓을 세게 하면 그냥 더 지겹다.
//
//  ★ **네 박자를 표가 갖는다** (§2)
//    예고 → 대응 → 해소 → 여운. 특히 **여운을 표에 적어 둔다** —
//    「여기가 시간 가는 줄 모른다의 자리」인데, 코드에 흩어 두면 장면을
//    하나 보탤 때마다 조용히 빠진다.
//
//  ★ three.js 를 안 쓴다 — tools/space-2h.js 가 브라우저 없이 읽는다.
// ══════════════════════════════════════════════════════════════════════════

/**
 * 네 박자의 길이(초). **장면마다 다르지 않다** — 여기 한 곳에 둔다.
 *
 * ★ 장면별로 따로 주고 싶어지는데 참는다. 여덟 개가 저마다 다른 박자를
 *   가지면 「무엇이 오는지 몰라도 리듬은 안다」가 무너진다. 다르게 하는
 *   것은 **묶이는 방과 손이 하는 일**이지 박자가 아니다.
 */
export const BEAT = {
  /** 「온다」 — 준비할 시간이 있어야 **선택**이 된다. 없으면 사고다 */
  warn: [20, 40],
  /** 「어떻게든」 — 여기가 긴장이다 */
  act: [120, 240],
  /** 「됐다」 — 이미 만든 「뿌리친 3초」가 여기 붙는다 */
  clear: [3, 10],
  /**
   * 「정리한다」 — ★ **여기가 「시간 가는 줄 모른다」의 자리다.**
   * 여운이 없으면 지치고, 여운이 길면 시계를 본다.
   */
  after: [40, 90],
};

/**
 * 장면 여덟. **`room` 이 서로 달라야 한다** — 그게 이 표의 검사 조건이다.
 *
 * | 칸 | 뜻 |
 * |---|---|
 * | `key` | 배치표가 부르는 이름 |
 * | `name` | 사람에게 보이는 이름 (끝 화면 목록에 그대로 쓴다) |
 * | `lead` | 예고 박자에 뜨는 한 줄. **어디가 잘못됐나는 안 가르친다** |
 * | `room` | **사람이 묶이는 방.** 여덟이 다 달라야 한다 |
 * | `hands` | 손이 하는 일 (한 줄) |
 * | `uses` | 어느 계통을 켜나 — 이미 있는 것에 얹는지 새로 만드는지가 여기서 보인다 |
 * | `built` | **지금 게임에 있나.** 없으면 배치는 해 두되 안 뜬다 |
 */
export const SCENES = {
  A: {
    key: 'A', name: '적이 붙는다',
    lead: '자국이 굵어집니다',
    room: 'engine', hands: '열을 내린다 · 전력을 고른다',
    uses: ['chase', 'power', 'heat'],
    built: true,          // game/chase.js — 이미 돈다
  },
  B: {
    key: 'B', name: '행성을 만난다',
    lead: '전방에 중력원 — 항로를 확인하십시오',
    room: 'obs', hands: '스윙바이할지 돌지 고른다',
    uses: ['route', 'chart'],
    built: false,
  },
  C: {
    key: 'C', name: '자동 조종이 죽는다',
    lead: '밀집 구역 — 자세 제어를 확인하십시오',
    room: 'cockpit', hands: '조종간을 잡고 있는다 — 놓으면 배가 돈다',
    uses: ['hazard', 'yoke', 'fault'],
    built: false,
    /**
     * ★ **이 게임의 정체를 한 장면에 담는다.** 정비공 게임의 축이
     *   「동시에 두 곳에 못 있는다」인데 지금까지 한 번도 안 켜졌다.
     *   조종석에 사람이 있어야 하는데 **고칠 것은 조종석 밖에 있다.**
     */
    star: true,
  },
  D: {
    key: 'D', name: '잔해밭',
    lead: '전방에 잔해',
    room: 'cockpit', hands: '비킨다 — 맞으면 일이 는다',
    uses: ['hazard'],
    built: true,          // game/hazard.js — 이미 돈다
  },
  E: {
    key: 'E', name: '정전',
    lead: '전력 계통 이상',
    room: 'hall', hands: '어둠 속에서 차단기를 찾는다',
    uses: ['power', 'dark'],
    built: false,
  },
  F: {
    key: 'F', name: '감압',
    lead: '기밀 경보',
    room: 'any', hands: '문을 닫거나 구멍을 메운다',
    uses: ['door', 'air'],
    built: false,
  },
  G: {
    key: 'G', name: '구조 신호',
    lead: '조난 신호를 받았습니다',
    room: 'airlock', hands: '가거나 안 간다 — 가면 시간과 자국',
    uses: ['route', 'supply'],
    built: false,
  },
  H: {
    key: 'H', name: '성간 공백',
    lead: '아무것도 잡히지 않습니다',
    room: 'all', hands: '혼자 배를 끌고 간다',
    uses: ['supply', 'fault'],
    built: false,
  },
};

/**
 * 12구간 배치 — **같은 장면이 이어 붙지 않는다** (§5)
 *
 * ★ 왜 표로 두나. 무작위로 뽑으면 반드시 「A 다음에 또 A」가 나오고,
 *   막으려고 규칙을 붙이면 그건 **표를 코드로 쓴 것**이다. 그럴 바에는
 *   표로 둔다 — 눈으로 읽히고, 도구가 셀 수 있고, 고칠 때 한 줄이다.
 *
 * ★ **구간 1 은 비어 있다.** 첫 장면이 12분 뒤에 온다. 그 전에 배를
 *   익힌다 — 가르침 일곱이 도는 자리이기도 하다 (TUTORIAL.md).
 *
 * ★ **A 는 세 번, C 는 두 번.** 같은 장면도 두 번째는 조건이 다르다
 *   (`hard` · `permanent`). 그게 「배운 것을 쓴다」와 「또 이거」의 차이다.
 */
export const PLACEMENT = [
  { leg: 1, scenes: [], note: '배를 익힌다 — 첫 장면은 12분 뒤' },
  { leg: 2, scenes: ['A'], note: '이 게임이 무엇인지' },
  { leg: 3, scenes: ['B'], note: '숨 돌리고 고르는 맛' },
  { leg: 4, scenes: ['A'], hard: true, note: '배운 것을 쓴다' },
  { leg: 5, scenes: ['D'], note: '조종을 처음 쓴다' },
  { leg: 6, scenes: ['C'], note: '2막의 절정' },
  { leg: 7, scenes: ['G'], note: '긴장이 아니라 선택 — 곡선의 골' },
  { leg: 8, scenes: ['E'], note: '어둠 — 완전히 다른 결' },
  { leg: 9, scenes: ['A', 'F'], hard: true, note: '★ 겹침 하나 — 2막의 마지막' },
  { leg: 10, scenes: ['B'], hard: true, note: '여기서 못 벌면 못 간다' },
  // ★ 여기서 기획서가 저 혼자 어긋나 있었다. §5 표는 구간 11 을 「C 하나」로
  //   적어 놓고 §6 「겹침은 딱 두 번」은 구간 11 을 「자동 조종(영구) + 마지막
  //   추격」이라고 적었다. 표로 옮기니 그 자리에서 드러났다 —
  //   **글로 두 번 쓰면 갈라지고, 표로 한 번 쓰면 갈라질 수가 없다.**
  //   §6 을 따른다: 3막의 절정이 장면 하나면 절정이 아니다. A 는 네 번이 된다.
  { leg: 11, scenes: ['C', 'A'], permanent: true, hard: true, note: '★ 겹침 둘 — 이번엔 못 고친다' },
  { leg: 12, scenes: ['H'], note: '쫓기지 않는데 긴장이 남는다' },
];

/**
 * 목표 숫자 — **도구가 이걸 보고 ✔/✘ 를 찍는다** (§10)
 *
 * ★ 여기 없는 것은 검사도 안 한다. 「긴장감 있나」를 재려면 재는 모양으로
 *   적어야 한다 — 그게 `docs/PLANNING.md` 가 말한 완료 조건이다.
 */
export const GOALS = {
  /** 장면 수 = 구간 수. 하나도 안 비고 하나도 안 남는다 (구간 1 빼고) */
  scenes: 11,
  /** 같은 장면이 **이어 붙는** 횟수 */
  backToBack: 0,
  /** 겹치는 구간 수 — **정확히 둘.** 흔하면 안 무섭다 */
  overlaps: 2,
  /** 장면 사이 간격(분) */
  gap: [6, 12],
  /** 한 장면이 같은 방에 묶는 비율 상한 — 여덟이 다 다른 방이어야 한다 */
  distinctRooms: 6,
};

/** 이 구간에 오는 장면들 (1부터 센다) */
export function scenesAt(leg) {
  const row = PLACEMENT.find((r) => r.leg === leg);
  return (row?.scenes ?? []).map((k) => ({ ...SCENES[k], ...row, scenes: undefined }));
}

/** 지금 게임에 **정말 있는** 장면만 — 없는 것은 배치해 둬도 안 뜬다 */
export const builtKeys = () => Object.keys(SCENES).filter((k) => SCENES[k].built);

/**
 * 배치가 규칙을 지키나 — **도구와 게임이 같은 함수를 본다.**
 * ★ 검사용으로 따로 세면 검사만 맞고 게임은 틀린 상태가 생긴다.
 */
export function audit(rows = PLACEMENT) {
  const filled = rows.filter((r) => r.scenes.length);
  let backToBack = 0;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1].scenes, b = rows[i].scenes;
    if (a.some((k) => b.includes(k))) backToBack++;
  }
  const rooms = new Set(filled.flatMap((r) => r.scenes).map((k) => SCENES[k]?.room));
  return {
    scenes: filled.length,
    overlaps: rows.filter((r) => r.scenes.length > 1).length,
    backToBack,
    rooms: rooms.size,
    /** 몇 번씩 나오나 */
    counts: rows.flatMap((r) => r.scenes).reduce((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {}),
    /** 아직 안 만든 것 — **배치는 해 뒀지만 안 뜨는 장면** */
    missing: [...new Set(rows.flatMap((r) => r.scenes))].filter((k) => !SCENES[k]?.built),
  };
}
