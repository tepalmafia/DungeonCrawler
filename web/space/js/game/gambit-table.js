// ══════════════════════════════════════════════════════════════════════════
//  ★★ 승부수 — **쫓길 때의 결심 넷** (v68 · docs/space/GAMBIT.md)
//
//  ★ 왜 이제야 짓나. `mission-table.js` 에 열아홉이 적혀 있는데 **아홉이
//    게임에 안 나오고** 있었다 (`space-story.js` 가 세고 있었다). 그중
//    넷이 이것들이고, `steps` 를 못 적어서가 아니라 **적으면 안 되는
//    것들**이었다 — 「찾아서 고치는 것」이 아니라 **한 번의 결심**이다.
//
//  ★★★ **새 손잡이를 하나도 안 만든다.** 이 배의 규약이다 —
//    「같은 손잡이가 상황에 따라 다른 일을 한다」:
//
//      버리기       **화물 접수구** — 거점에서 거래하던 그 구멍
//      끌고 들어가기 **조종간**     — 잔해 지대 쪽으로 끝까지 튼다
//      숨죽이기     **통로 차단기** — 셋을 다 내린다
//      남의 미끼    **윈치**       — 우주에서 낚던 그것
//
//    UI 를 하나도 안 늘렸다. 배울 것이 없다 — **이미 있는 손이 새 뜻을
//    갖는 것**이기 때문이다.
//
//  ★★ 넷이 **다른 자원**을 판다. 같은 것을 팔면 그건 하나짜리 선택이
//    넷으로 보이는 것뿐이다 (GAMBIT.md §4).
//
//  ★ three.js 를 안 쓴다 — tools/space-gambit.js 가 브라우저 없이 읽는다.
// ══════════════════════════════════════════════════════════════════════════

/**
 * 승부수 넷.
 *
 * @property key    열쇠 — `mission-table.js` 의 것과 **같다.** 표 둘이
 *                  갈라지면 「설계에는 있는데 게임에는 없다」가 또 난다
 * @property hand   어느 손잡이인가 (`main.js` 의 조준 이름과 같다)
 * @property sells  **무엇을 파나** — 넷이 다 달라야 한다 (검사가 지킨다)
 * @property needs  뜨려면 무엇이 있어야 하나
 * @property lead   실마리 한 줄 — **무엇을 하라고 안 적는다.** 손잡이가
 *                  켜지는 것으로 말한다 (「글로 안 알려준다」 · PLAN §3-1)
 * @property good   좋은 갈래 · @property bad 나쁜 갈래
 * @property badAt0 0구간에서 나쁜 갈래가 나올 확률 (0~1)
 * @property badAt11 마지막 구간에서의 그것 — **깊어질수록 나빠진다**
 */
export const GAMBITS = [
  {
    key: 'jettison', name: '버리기', hand: 'hatch', sells: 'ore',
    lead: '실은 것을 던지면 산다',
    // ★ 광석이 있어야 던진다. 빈손으로 뜨면 「할 수 있는데 할 게 없다」다
    needs: { ore: 12 },
    hold: 3.0,
    good: { what: '저쪽이 그걸 줍느라 늦습니다', dist: 34 },
    bad: { what: '거들떠보지도 않습니다 — 광석만 잃었습니다', dist: 0 },
    badAt0: 0.30, badAt11: 0.45,
  },
  {
    key: 'intoDebris', name: '끌고 들어가기', hand: 'yoke', sells: 'hull',
    lead: '잔해밭이 앞에 있다. 쫓기는 채로 들어갈까',
    // ★ **잔해 지대가 앞에 있을 때만.** 그래서 이 승부수는 「아무 때나」가
    //   아니라 지대가 오는 그 30초에만 산다 — 잡을 수 있는 때가 좁을수록
    //   잡았을 때 무게가 있다
    needs: { hazard: true },
    hold: 2.2,
    good: { what: '잔해가 저쪽을 막았습니다 — 뿌리쳤습니다', dist: 58 },
    bad: { what: '뿌리쳤지만 선체가 상했습니다', dist: 58, hull: 0.16 },
    badAt0: 0.34, badAt11: 0.56,
  },
  {
    key: 'silentRun', name: '숨죽이기', hand: 'breakers', sells: 'time',
    lead: '전부 끄고 지나가기를 기다린다',
    // ★ 회로 셋을 **다 내려야** 한다. 하나라도 켜져 있으면 자국이 남는다 —
    //   「전력 배분」이 이 승부수의 손잡이가 되는 자리다
    needs: { allOff: true },
    hold: 6.0,
    good: { what: '지나갔습니다', dist: 100, sign: 0 },
    bad: { what: '이쪽이 먼저 못 버팁니다 — 다시 켭니다', dist: 0, food: 6, air: 8 },
    badAt0: 0.28, badAt11: 0.50,
  },
  {
    key: 'othersBait', name: '남의 미끼', hand: 'winch', sells: 'sign',
    lead: '화물이 떠 있다. 누가 살려고 던진 것이다',
    // ★ **쫓기지 않을 때 뜬다.** 넷 중 하나는 평온할 때 뜨는 것이라야
    //   「추격 메뉴」가 안 된다 — 그리고 이건 **다음 추격을 앞당기는**
    //   선택이므로, 평온할 때 골라야 무게가 산다
    needs: { calm: true },
    hold: 4.0,
    good: { what: '그는 무사히 갔나 봅니다 — 부품과 식량', parts: 2, food: 14 },
    bad: { what: '쫓던 것이 이쪽을 봤습니다', parts: 2, food: 14, sign: 26 },
    badAt0: 0.32, badAt11: 0.54,
  },
];

export const BY_KEY = Object.fromEntries(GAMBITS.map((g) => [g.key, g]));

/**
 * ★★ 언제 뜨나.
 *
 * @property everyChase 추격 한 번에 **평균 몇 번** 뜨나. 1 을 넘기면
 *   추격이 「고르는 화면」이 된다 — 이 게임은 정비공이지 지휘관이 아니다
 * @property gapMin  뜬 것끼리 이만큼은 떨어진다 (초). 겹치면 어느 쪽
 *   결과인지 못 가린다
 * @property live    뜨고 나서 이만큼 안에 안 잡으면 **사라진다.**
 *   ★ 강제가 아니다 — 안 골라도 되는 것이 선택이다
 * @property calmEvery 평온할 때(남의 미끼)는 이 초마다 한 번쯤
 */
export const GAMBIT = {
  everyChase: 1.1,
  gapMin: 26,
  live: 30,
  calmEvery: 300,
};

/** 구간이 깊어질수록 나쁜 갈래가 는다 — `mission-table.js` 와 같은 규약 */
export function badChance(g, leg = 0) {
  const t = Math.max(0, Math.min(1, (leg ?? 0) / 11));
  return g.badAt0 + (g.badAt11 - g.badAt0) * t;
}

/**
 * 지금 이 승부수가 뜰 수 있나 — **판이 갖춰졌나**를 묻는다.
 * @param s.chasing 쫓기는 중인가 · s.ore 광석 · s.hazard 잔해 지대가 오나
 */
export function canOffer(g, s = {}) {
  if (g.needs.calm) return !s.chasing;
  if (!s.chasing) return false;                 // 나머지 셋은 쫓길 때만
  if (g.needs.ore) return (s.ore ?? 0) >= g.needs.ore;
  if (g.needs.hazard) return !!s.hazard;
  return true;                                  // 숨죽이기 — 늘 걸 수 있다
}

/**
 * 사람에게 보이는 한 줄 — **무엇을 하라고 안 적는다.**
 * 실마리만 주고, 손잡이가 켜지는 것으로 말한다 (PLAN §3-1)
 */
export const gambitWord = (g) => (g ? g.lead : null);
