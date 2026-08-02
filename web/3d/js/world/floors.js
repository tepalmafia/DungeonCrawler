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
 * 층 표.
 *
 * **지금 값은 기존 동작과 한 글자도 다르지 않다.** 이번 작업은 옮기기만 하는
 * 것이고, 값을 바꾸는 건 다음 단계다 (docs/FLOORS.md §9 의 D~F).
 * 그래서 4층 이후를 아직 안 채운다 — `floorDef()` 가 예전처럼 마지막 항목으로
 * 고정하므로 동작이 같다.
 *
 * 층을 늘릴 때는 **여기에 줄을 더한다.** 다른 파일은 안 건드린다.
 */
export const FLOORS = [
  {
    no: 1,
    act: 'crypt',
    name: '납골당',
    theme: THEME.crypt,

    // ── 몬스터 ──
    // 뽑기 주머니. 같은 키를 여러 번 넣어 비율을 만든다.
    roster: ['skeleton', 'skeleton', 'ghoul', 'archer'],
    golemChance: 0.3,        // 0.2 + 층×0.1  (기존 식을 층별 값으로 편다)
    squadRate: 0.30,
    eliteChance: 0.15,       // 0.10 + 층×0.05
    powerMult: 1.00,         // 1 + (층−1)×0.45

    // ── 속성 (docs/ELEMENTS.md §4) ──
    mix: { none: 60, soul: 30, ice: 10 },
    counter: 'bolt',         // 상점 「오늘의 물건」이 파는 대항 속성

    // ── 맵 ──
    rooms: [9, 12],          // 방 개수 — 배열이면 범위, 숫자면 고정
    boss: false,             // 보스방 레이아웃 (마지막 방을 크게 넓힌다)
    chokeTraps: 5,           // 4 + 층
    looseTraps: 5,
  },
  {
    no: 2,
    // ※ 지금은 층이 셋뿐이라 한 층이 한 막이다. 아홉으로 늘리면
    //    막마다 세 층이 되고 이 값이 바뀐다 (docs/FLOORS.md §2).
    act: 'flood',
    name: '침수 회랑',
    theme: THEME.flood,

    roster: ['skeleton', 'skeleton', 'ghoul', 'archer'],
    golemChance: 0.4,
    squadRate: 0.45,
    eliteChance: 0.20,
    powerMult: 1.45,

    mix: { ice: 50, soul: 25, bolt: 25 },
    counter: 'fire',

    rooms: [9, 12],
    boss: false,
    chokeTraps: 6,
    looseTraps: 6,
  },
  {
    no: 3,
    act: 'throne',
    name: '왕좌의 방',
    theme: THEME.throne,

    roster: ['skeleton', 'skeleton', 'ghoul', 'archer'],
    golemChance: 0.5,
    squadRate: 0.55,
    eliteChance: 0.25,
    powerMult: 1.90,

    mix: { bolt: 40, soul: 40, fire: 20 },
    counter: 'ice',

    // **숫자로 둔다.** [7,7] 로 두면 rnd.int(7,7) 이 난수를 한 번 소비하는데,
    // 기존 코드는 보스층에서 난수를 안 뽑았다. 한 번의 차이로 그 뒤 모든
    // 난수가 밀려 방 배치와 적 스폰이 통째로 달라진다 — 지문 비교로 잡았다.
    rooms: 7,
    boss: true,
    chokeTraps: 3,
    looseTraps: 3,
  },
];

/**
 * 층 번호 → 설정.
 *
 * 표에 없는 층은 **마지막 항목으로 고정**한다. 기존 코드가 전부
 * `min(층−1, 길이−1)` 로 클램프하고 있었으므로 동작이 같다.
 * (그래서 지금 4층 이후는 3층의 복사본이다 — 그게 이 표를 만든 이유다.)
 */
export function floorDef(no) {
  const i = Math.max(0, Math.min(FLOORS.length - 1, (no | 0) - 1));
  return FLOORS[i];
}

/** 테마만 필요한 곳 (dungeon.themeFor 가 이걸 부른다) */
export function themeFor(no) { return floorDef(no).theme; }

/** 그 층의 막 */
export function actFor(no) { return ACTS[floorDef(no).act]; }

/** 아직 만든 층 수 — MAX_FLOOR 가 이걸 넘으면 뒤는 복사본이 된다 */
export const DEFINED_FLOORS = FLOORS.length;
