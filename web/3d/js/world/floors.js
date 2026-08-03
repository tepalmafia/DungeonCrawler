// 층 — **한 층이 무엇인가**를 답하는 유일한 표.
//
// ── 왜 모으는가 ──────────────────────────────────────────────
// 층별 설정이 네 파일에 흩어져 있었다:
//
//   dungeon.js   THEMES · isBossFloor · 방 개수 · 함정 개수
//   elements.js  FLOOR_MIX (속성 분포)
//   shop.js      COUNTER_BY_FLOOR (상점 대항 속성)
//   enemies.js   roster · squadRate · powerMult · 정예 확률
//
// 층을 셋에서 아홉으로 늘리면 **층 하나를 추가할 때마다 네 곳을 고쳐야** 하고,
// 언젠가 한 곳을 빠뜨린다. 그러면 그 층만 조용히 이전 층의 값을 쓴다 —
// 화면에는 아무 표시도 안 난다. (슬롯 목록을 두 군데 뒀다가 이미 겪은 일이다.)
//
// ── 여기 있는 것과 없는 것 ───────────────────────────────────
// **층마다 다른 것**만 여기 있다. 층마다 같은 것(방+복도 구조, 문·스위치,
// 상점 하나, 금고 하나, 출구 규칙, AI 규칙)은 각자 파일에 그대로 둔다.
// 그게 「1층을 복사한다」의 실제 의미다 — 뼈대는 공유하고 내용만 층마다.
// (docs/FLOORS.md §0-b-3)
//
// ── 의존성 ──────────────────────────────────────────────────
// **이 파일은 아무것도 import 하지 않는다.** 순수 데이터다.
// dungeon·elements·shop·enemies 가 전부 이걸 읽으므로, 여기서 그중 하나라도
// 가져오면 순환이 된다.
//
// ── 1~3층도 바뀐다 ──────────────────────────────────────────
// 처음엔 「기존 세 층은 그대로 두고 여섯 칸만 더한다」로 적었는데, 지문을
// 재 보니 사실이 아니었다(`tools/floor-parity.js`). 세 가지가 1~3층을 바꾼다.
// 셋 다 의도한 것이므로 **무엇이 왜 바뀌었는지**를 여기 적어 둔다.
//
//   ① **보스가 매 층에 선다** (docs/FLOORS.md §5-3). 1·2층이 보스층이 되면서
//      마지막 방이 보스방으로 넓어진다 — 그래서 바닥 칸이 늘고(1층 694→914)
//      적 수가 줄었다(15→13). 층의 끝이 언제나 같은 모양이 되는 대가다.
//   ② **막이 3층씩으로 갈린다.** 예전엔 층이 셋이라 한 층이 한 막이었다.
//      아홉이 되면 1~3층이 전부 납골당이다 — 2층 테마가 침수 회랑에서
//      납골당으로 돌아간다.
//   ③ **속성 분포가 §6-3 표로 바뀐다.** 2층이 빙 특화에서 혼 특화가 되고,
//      대항 속성도 따라 바뀐다.
//
// 그리고 **3층에 금고·상점·문이 생긴다.** 예전에는 보스층이라는 이유로 통째로
// 빠져 있었는데(`dungeon.js` 의 `if (!isBossFloor)`), 보스가 매 층이 되면 그
// 조건 하나가 아홉 층 전부에서 상점을 지운다. 조건을 뺐다.
//
// ★ 그래서 **docs/FLOORS.md §8 의 1층 기준선 실측은 무효다.** 보스가 붙은
//   1층은 그때 잰 1층이 아니다. 다시 재야 한다.
//
// 맵 파라미터(아래 MAP0)는 기본값이 옛 상수와 같아 그 자체로는 `rnd` 호출
// 순서를 안 바꾼다 — 위 세 가지만이 원인이다.

/**
 * 막 — 세 층이 한 막을 이룬다. 이야기의 「착각」 하나가 한 막이다
 * (docs/STORY.md §3).
 */
export const ACTS = {
  crypt: { key: 'crypt', name: '납골당', delusion: '아직 자기 장례식 날이라고 믿는다' },
  flood: { key: 'flood', name: '침수 회랑', delusion: '물이 차오르는 걸 막는 중이라고 믿는다' },
  throne: { key: 'throne', name: '왕좌의 방', delusion: '왕이 곧 깨어난다고 믿는다' },
};

// 테마 — 색·안개·횃불. 후처리의 스플릿 톤(core/post.js)이 postShadow/postHigh 를 쓴다.
// 그림자로 스미는 색과 하이라이트로 스미는 색을 달리해 온도를 가른다.
const THEME = {
  crypt: {
    key: 'crypt', name: '납골당', floor: 0x59506a, wall: 0x453c56,
    moss: '#4c6b3a', mossP: 0.30, fog: 0x07060c, torch: 0xffa04a,
    postShadow: 0x8fa8d4, postHigh: 0xffd6a0,
  },
  flood: {
    key: 'flood', name: '침수 회랑', floor: 0x4a5a5e, wall: 0x37464d,
    moss: '#3f7a68', mossP: 0.46, fog: 0x05090c, torch: 0x9fd8ff,
    postShadow: 0x7fbcd6, postHigh: 0xd8f0ff,       // 물 — 위아래 다 차갑다
  },
  throne: {
    key: 'throne', name: '왕좌의 방', floor: 0x63505c, wall: 0x4e3b48,
    moss: '#7a3a3a', mossP: 0.18, fog: 0x0b0508, torch: 0xff7a3a,
    postShadow: 0xa88ac0, postHigh: 0xffb070,       // 영혼빛 그림자 + 붉은 불
  },
};

/**
 * 맵 파라미터 기본값 — **예전에 dungeon.js 안에 상수로 박혀 있던 값 그대로.**
 *
 * 층마다 모양을 다르게 하려면(docs/FLOORS.md §4 · §5-4) 이것들이 표에
 * 있어야 한다. 그런데 여기 있는 숫자는 전부 `rnd` 호출 위에 얹혀 있어서,
 * 한 값만 건드려도 그 층의 방 배치와 적 스폰이 통째로 달라진다.
 * 그래서 **기본값은 옛 상수와 정확히 같게 두고**, 층에서 덮어쓰는 것만 다르다.
 *
 * ★ 하한이 있는 이유: 방을 3개 미만으로 만들면 `dungeon.js` 의 재시도가
 *   무한 재귀로 터진다(실측 30/30 시드). 「방 하나짜리 왕좌」는 방 개수가
 *   아니라 **보스방 크기**로 낸다.
 */
const MAP0 = {
  roomW: [6, 12],       // dungeon.js:55 rnd.int(6, 12)
  roomH: [6, 11],       // dungeon.js:55 rnd.int(6, 11)
  roomGap: 3,           // dungeon.js:57 rectsOverlap(r, o, 3)
  loops: 2,             // dungeon.js:105 여분 간선 — 막다른 길만 있으면 답답하다
  torchGap: 7,          // dungeon.js:133 MIN_GAP
  torchMax: 46,         // dungeon.js:137
  props: [1, 3],        // dungeon.js:143 rnd.int(1, 3)
  propsBoss: [1, 4],    // dungeon.js:143 보스방
  propMix: ['pillar', 'coffin', 'rubble', 'rubble'],   // dungeon.js:148
  bossRoom: 17,         // dungeon.js:75 보스방을 넓히는 한 변의 상한
};
const map = (o) => ({ ...MAP0, ...o });

/**
 * 층 표.
 *
 * 층을 늘릴 때는 **여기에 줄을 더한다.** 다른 파일은 안 건드린다.
 *
 * ── powerMult 를 아직 안 가른 이유 ────────────────────────────
 * `tools/growth.js` 실측(docs/FLOORS.md §7-b-3)은 HP 와 공격의 증가율이
 * 달라야 한다고 말한다 (HP ×0.43/층 · 공격 ×0.29/층). 맞는 말이지만
 * **이번에 같이 바꾸면 무엇 때문에 무엇이 변했는지 못 가린다.** 표를 아홉
 * 칸으로 늘리는 것과 곡선을 바꾸는 것은 다른 작업이다. 지금은 설계된 등차
 * (0.45/층)를 아홉 층까지 그대로 잇고, 가르는 것은 재고 나서 따로 한다.
 */
const ALL_FLOORS = [
  // ══════════════ 막 1 · 납골당 — 「아직 내 장례식 날이다」 ══════════════
  {
    no: 1,
    act: 'crypt',
    name: '관 안치소',
    theme: THEME.crypt,

    // ── 몬스터 ──
    // 뽑기 주머니. 같은 키를 여러 번 넣어 비율을 만든다.
    roster: ['skeleton', 'skeleton', 'ghoul', 'archer'],
    golemChance: 0.3,        // 0.2 + 층×0.1  (기존 식을 층별 값으로 편다)
    squadRate: 0.30,
    eliteChance: 0.15,       // 0.10 + 층×0.05
    powerMult: 1.00,         // 1 + (층−1)×0.45

    // ── 속성 (docs/ELEMENTS.md §4 · docs/FLOORS.md §6-3) ──
    mix: { none: 60, soul: 30, ice: 10 },
    counter: 'bolt',         // 상점 「오늘의 물건」이 파는 대항 속성

    // ── 맵 ──
    rooms: [9, 12],          // 방 개수 — 배열이면 범위, 숫자면 고정
    map: map({}),            // 작은 방 여럿 — 안치실. 배우는 층이라 기본값 그대로
    boss: 'gravedigger1',    // 보스 키 (game/boss.js 의 BOSSES). false 면 보스 없음
    chokeTraps: 5,           // 4 + 층
    looseTraps: 5,
  },
  {
    no: 2,
    act: 'crypt',
    name: '매장인의 통로',
    theme: THEME.crypt,

    // 새 변종: **해골 창병** — 사거리 2.9. 간격 관리를 가르친다 (§5-2)
    roster: ['skeleton', 'spearman', 'ghoul', 'archer'],
    golemChance: 0.4,
    squadRate: 0.45,
    eliteChance: 0.20,
    powerMult: 1.45,

    mix: { soul: 55, none: 30, ice: 15 },
    counter: 'bolt',         // 첫 상성 — 혼을 이기는 뇌

    rooms: [9, 12],
    map: map({}),            // 긴 통로 + 곁방 — 아직 기본값. 복도 문법은 §4 별건
    boss: 'gravedigger2',
    chokeTraps: 6,           // 이 층의 고유 위협 = 함정 밀도 (§3-1)
    looseTraps: 6,
  },
  {
    no: 3,
    act: 'crypt',
    name: '봉인된 묘실',
    theme: THEME.crypt,

    // 새 변종: **해골 방패병** — 정면 피해 −60%. 각도를 가르친다
    roster: ['skeleton', 'spearman', 'shieldman', 'ghoul', 'archer'],
    golemChance: 0.5,
    squadRate: 0.55,
    eliteChance: 0.25,
    powerMult: 1.90,

    mix: { soul: 45, ice: 30, bolt: 25 },
    counter: 'bolt',

    // **숫자로 둔다.** [7,7] 로 두면 rnd.int(7,7) 이 난수를 한 번 소비하는데,
    // 기존 코드는 보스층에서 난수를 안 뽑았다. 한 번의 차이로 그 뒤 모든
    // 난수가 밀려 방 배치와 적 스폰이 통째로 달라진다 — 지문 비교로 잡았다.
    rooms: 7,
    map: map({}),            // 큰 방 하나로 수렴 — 보스방 확장이 그 역할을 한다
    boss: 'gravedigger3',
    chokeTraps: 3,
    looseTraps: 3,
  },

  // ══════════════ 막 2 · 침수 회랑 — 「물을 막는 중이다」 ══════════════
  // 막이 바뀌면 몸이 바뀐다 (§2-1). 지금은 새 종족(역병 까마귀)이 아직 없어
  // 명단은 기존 넷을 쓰되 **비율과 밀도**로 성격을 낸다 — 궁수를 늘려
  // 「긴 회랑에서 거리 관리」가 되게 한다.
  {
    no: 4,
    act: 'flood',
    name: '수문',
    theme: THEME.flood,

    roster: ['skeleton', 'shieldman', 'ghoul', 'archer', 'archer'],   // 궁수 비중 ↑
    golemChance: 0.45,
    squadRate: 0.50,
    eliteChance: 0.28,
    powerMult: 2.35,

    mix: { ice: 65, none: 20, soul: 15 },   // 가장 순수한 단일 — 상성이 제일 잘 보인다
    counter: 'fire',

    rooms: [10, 13],         // 갈라졌다 합쳐지는 구조 — 방을 늘리고 고리를 늘린다
    map: map({ loops: 4, roomW: [5, 10], roomH: [5, 10] }),
    boss: 'sluice1',
    chokeTraps: 7,
    looseTraps: 6,
  },
  {
    no: 5,
    act: 'flood',
    name: '잠긴 예배당',
    theme: THEME.flood,

    // 새 변종: **익사한 순례자** — 죽은 자리가 웅덩이가 된다
    roster: ['skeleton', 'drowned', 'ghoul', 'archer'],
    golemChance: 0.5,
    squadRate: 0.55,
    eliteChance: 0.30,
    powerMult: 2.80,

    mix: { ice: 45, bolt: 35, soul: 20 },   // 둘을 섞기 시작
    counter: 'fire',

    rooms: [7, 9],           // 큰 방 하나 + 물에 잠긴 곁방
    // ★ 이 층의 고유 위협 = **어둠** (§3-3). 벽 횃불을 절반으로 줄인다.
    //   랜턴 연료가 처음으로 「있으면 좋은 것」이 아니라 **자원**이 된다.
    map: map({ roomW: [7, 14], roomH: [7, 13], torchMax: 23, torchGap: 10 }),
    boss: 'sluice2',
    chokeTraps: 6,
    looseTraps: 7,
  },
  {
    no: 6,
    act: 'flood',
    name: '수문지기의 방',
    theme: THEME.flood,

    // 새 변종: **사슬 궁수** — 화살이 관통하고 묶는다. 엄폐를 강요한다
    roster: ['skeleton', 'drowned', 'chainer', 'archer'],
    golemChance: 0.55,
    squadRate: 0.60,
    eliteChance: 0.33,
    powerMult: 3.25,

    mix: { bolt: 55, ice: 25, soul: 20 },
    counter: 'ice',

    rooms: [7, 9],           // 중앙이 낮고 둘러싸인 형태
    map: map({ roomW: [7, 13], roomH: [7, 12], loops: 3 }),
    boss: 'sluice3',
    chokeTraps: 5,
    looseTraps: 7,
  },

  // ══════════════ 막 3 · 왕좌 — 「왕이 곧 깨어난다」 ══════════════
  {
    no: 7,
    act: 'throne',
    name: '근위 회랑',
    theme: THEME.throne,

    // 새 변종: **성문 파수병** — 조 편성으로 나온다
    roster: ['gatekeeper', 'shieldman', 'golem', 'chainer'],
    golemChance: 0.6,
    squadRate: 0.62,
    // ★ 이 층의 고유 위협 = **정예 밀도** (§3-4)
    eliteChance: 0.45,
    powerMult: 3.70,

    mix: { fire: 60, soul: 25, bolt: 15 },   // 단일로 돌아온다 — 숨 고르기
    counter: 'soul',

    rooms: [8, 10],
    // 「직선. 숨을 곳이 없다」 — 고리를 없애 갈래를 줄이고 방을 좁고 길게
    map: map({ loops: 0, roomW: [5, 9], roomH: [8, 14] }),
    boss: 'guard1',
    chokeTraps: 8,
    looseTraps: 6,
  },
  {
    no: 8,
    act: 'throne',
    name: '왕관의 그림자',
    theme: THEME.throne,

    // 새 변종: **왕의 조각상** — 부술 때까지 안 움직인다. 지나칠 수 있다
    roster: ['gatekeeper', 'statue', 'chainer', 'drowned'],
    golemChance: 0.65,
    squadRate: 0.65,
    eliteChance: 0.40,
    powerMult: 4.15,

    // ★ 정답이 없는 층 (§6-4). 셋이 고르게 섞여 어느 속성을 들어도 3분의 1은
    //   손해다. 여기서는 **무속성이 오히려 안정적**이고, 그게 이 층의 교훈이다.
    mix: { fire: 35, bolt: 35, soul: 30 },
    counter: 'none',

    rooms: [6, 8],           // 기둥 많은 큰 방
    map: map({ roomW: [9, 15], roomH: [9, 14], props: [3, 6], propsBoss: [4, 7],
      propMix: ['pillar', 'pillar', 'pillar', 'rubble'] }),
    boss: 'shadow',
    chokeTraps: 4,
    looseTraps: 8,
  },
  {
    no: 9,
    act: 'throne',
    name: '왕좌의 방',
    theme: THEME.throne,

    roster: ['gatekeeper', 'statue', 'golem', 'chainer'],
    golemChance: 0.7,
    squadRate: 0.70,
    eliteChance: 0.42,
    powerMult: 4.60,

    mix: { soul: 40, ice: 30, fire: 30 },   // 보스가 페이즈마다 갈아탄다
    counter: 'bolt',

    // 「방 하나」로 두고 싶지만 방이 3개 미만이면 생성기가 무한 재귀로 터진다.
    // 방 수는 5로 두고 **보스방을 최대로 넓혀** 왕좌를 낸다.
    rooms: 5,
    map: map({ roomW: [8, 14], roomH: [8, 13], loops: 1, bossRoom: 21,
      props: [2, 5], propMix: ['pillar', 'pillar', 'rubble', 'coffin'] }),
    boss: 'lord',            // 심연의 군주 — 3페이즈, 지금 것 그대로
    chokeTraps: 3,
    looseTraps: 4,
  },
];

// ── 한 회차는 **여섯 층**이다 ───────────────────────────────
//
// 아홉 층이면 한 회차가 28분이다. 목표는 15~25분이고(docs/GRIND.md §9),
// **회차를 넘는 순간이 이 게임의 제일 큰 보상 겹**인데 28분에 한 번은
// 너무 뜸하다. 여섯 층이면 19분이다.
//
// 층을 버리는 게 아니라 **막마다 가운데를 접는다.** 막 셋의 처음과 끝을
// 남기면 테마 셋, 보스 여섯, 변종 여섯이 전부 살아남는다 —
// 접힌 것은 「매장인의 통로 · 잠긴 예배당 · 왕관의 그림자」 셋이고,
// 그 로스터(창병·순례자·조각상)는 남은 층이 이미 데리고 있다.
//
// **아홉 칸 정의는 지우지 않는다.** 회차마다 다른 여섯을 돌게 하거나
// 다시 아홉으로 늘릴 때 그대로 쓴다 — 지우면 그때 다시 써야 한다.
const RUN_FLOORS = [1, 3, 4, 6, 7, 9];

// 배수도 여섯 칸으로 다시 편다. 상한은 4.60 → **4.00** 이다 —
// 여섯 칸에 4.6배를 넣으면 층마다 뛰는 폭이 커지는데 레벨은 그만큼 안 오른다.
// 실제로 6층 TTK 가 4.1초로 목표(1.5~3)를 벗어났다. 4.0 이면 2.9초다.
// 장기 성장은 회차 배수(1.55^tier)가 맡으므로 한 회차 안의 폭은 좁아도 된다.
export const FLOORS = RUN_FLOORS.map((src, i) => ({
  ...ALL_FLOORS[src - 1],
  no: i + 1,
  powerMult: +(1 + i * ((4.0 - 1) / (RUN_FLOORS.length - 1))).toFixed(2),
}));

/**
 * 층 번호 → 설정.
 *
 * 표에 없는 층은 **마지막 항목으로 고정**한다. 아홉 칸을 채웠으므로 이제
 * 클램프가 걸리는 것은 tier(반복 회차)로 9층을 넘어갈 때뿐이다.
 */
export function floorDef(no) {
  const i = Math.max(0, Math.min(FLOORS.length - 1, (no | 0) - 1));
  return FLOORS[i];
}

/** 테마만 필요한 곳 (dungeon.themeFor 가 이걸 부른다) */
export function themeFor(no) { return floorDef(no).theme; }

/** 그 층의 막 */
export function actFor(no) { return ACTS[floorDef(no).act]; }

/** 맵 파라미터 — 표에 없으면 기본값 */
export function mapOf(no) { return floorDef(no).map || MAP0; }

/** 한 회차의 층 수. main.js 의 MAX_FLOOR 가 이걸 읽는다 —
 *  두 곳에 적으면 표를 줄여도 게임만 아홉 층을 돈다 */
export const DEFINED_FLOORS = FLOORS.length;
export const FLOORS_PER_RUN = FLOORS.length;
