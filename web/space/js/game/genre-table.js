// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **장르 — 우주 비행전투 RPG** (v115). 이 게임이 무엇인가.
//
//  ★ 사장님 (2026-08-11) 「**우주 비행전투 rpg야 우리 장르야**」
//
//  ══ 왜 표로 적나 ═══════════════════════════════════════════════════
//
//  이 저장소는 **목적이 두 번 바뀌었고 두 번 다 옛 목적이 주석에 남아
//  몇 달을 갔다** (`GRIND.md §7` · `WAR.md §9`). 그림으로 그린 기획은
//  반드시 잊히므로, 이야기를 `story-table.js` 에 적었듯 **장르도 표에
//  적는다.** 그러면 기둥 하나가 비었을 때 문서가 아니라 **검사가**
//  소리를 낸다 (`tools/space-genre.js`).
//
//  ══ ★★★ 「우주 비행전투 RPG」는 기둥이 **다섯**이다 ═══════════════════
//
//    ① **우주**   — 진공·관성·고증. 하늘이 배경이 아니라 규칙이다
//    ② **비행**   — 세 축으로 몬다. 조종이 곧 손이다
//    ③ **전투**   — 겨누고 · 맞히고 · 맞는다. 잘하면 다르다
//    ④ ★★★ **성장** — **하면 는다.** RPG 를 RPG 로 만드는 유일한 기둥
//    ⑤ **여정**   — 이야기와 세계가 있다. 판이 아니라 **한 번의 길**이다
//
//  ★★ 이 다섯 중 **넷은 슈팅에도 있다.** RPG 라는 말이 더하는 것은
//    **④ 하나**뿐이고, 그래서 이 표에서 ④ 가 제일 무겁다.
//
//  ══ ★★★ 그리고 **성장은 두 갈래여야 한다** ═════════════════════════
//
//  이 게임에는 이미 **배가 크는 길**이 있다 (`parts-table.js` 부위 일곱 ·
//  등급 다섯 · 개조). 그런데 그것만으로는 RPG 가 아니라 **장비 게임**이다 —
//  주운 것이 곧 힘이면 사람은 **고르기만** 하고 **늘지는** 않는다.
//
//    **배**   주워서 큰다 — 운이 섞인다 · 잃을 수 있다 (파츠)
//    **사람** 해서 큰다   — 운이 안 섞인다 · 안 잃는다 (경험 · 특성)
//
//  ★ 둘을 가르는 이유: 배만 크면 「운이 나쁘면 회차가 망한다」가 되고,
//    사람만 크면 「주울 이유가 없다」가 된다. **둘 다 있어야 파밍도 살고
//    솜씨도 산다** — 사장님이 v110 에 말씀하신 「오직 전투와 파밍」이
//    RPG 로 서려면 여기가 받쳐야 한다.
//
//  ★ three.js 를 안 쓴다 — `tools/space-genre.js` 가 읽는다.
// ══════════════════════════════════════════════════════════════════════════

/** ★ 한 줄 — 무엇을 만드는가. 모든 판단이 여기로 돌아온다 */
export const GENRE = '우주 비행전투 RPG';

/**
 * ★★★ **기둥 다섯.**
 *
 * @property need  이 기둥이 서려면 무엇이 있어야 하나 (사람이 읽는 말)
 * @property by    그것을 드는 표·모듈 — **없으면 검사가 빨개진다**
 * @property tool  그 기둥을 재는 도구
 * @property rpg   RPG 라는 말이 **더하는** 기둥인가
 */
export const PILLARS = [
  {
    key: 'space', name: '우주', rpg: false,
    need: '진공이라 밖은 조용하고 · 별은 안 흐르고 · 열은 복사로만 나간다',
    by: ['sky-table.js', 'heat-table.js', 'fuel-table.js'],
    tool: 'space-sky.js · space-heat.js · space-sound.js',
  },
  {
    key: 'fly', name: '비행', rpg: false,
    need: '세 축으로 돌고 · 스로틀이 있고 · 뒤집으면 반대가 된다',
    by: ['flight-table.js', 'throttle-table.js', 'horizon-table.js'],
    tool: 'space-bfm.js · space-throttle.js · space-horizon.js',
  },
  {
    key: 'fight', name: '전투', rpg: false,
    need: '겨눈 만큼 아프고 · 피할 수 있고 · 부위가 있다',
    by: ['aim-table.js', 'evade-table.js', 'combat-table.js', 'target-table.js'],
    tool: 'space-aim.js · space-evade.js · space-combat.js',
  },
  {
    // ══ ★★★ 여기가 「RPG」라는 말이 더하는 유일한 기둥이다 ═══════════
    key: 'grow', name: '성장', rpg: true,
    need: '**배가 크고**(주워서) · **사람이 큰다**(해서). 둘이 다른 길이어야 한다',
    by: ['parts-table.js', 'growth-table.js'],
    tool: 'space-parts.js · space-growth.js',
  },
  {
    key: 'journey', name: '여정', rpg: true,
    need: '줄기가 있고 · 구간이 있고 · 끝이 있다. 판이 아니라 한 번의 길이다',
    by: ['story-table.js', 'scene-table.js', 'route-table.js', 'ending-table.js'],
    tool: 'space-story.js · space-2h.js · space-end.js',
  },
];

export const PILLAR_BY = Object.fromEntries(PILLARS.map((p) => [p.key, p]));

/**
 * ★★★ **성장의 두 갈래** — 이 표가 「장비 게임」과 「RPG」를 가른다.
 *
 * @property from  무엇을 해야 크나
 * @property luck  운이 섞이나
 * @property lose  잃을 수 있나
 * @property by    드는 표
 */
export const AXES = [
  {
    key: 'ship', name: '배', from: '주워서 (파밍)', luck: true, lose: true,
    by: 'parts-table.js',
    what: '부위 일곱 · 등급 다섯 · 개조 — **운이 섞이고 부서지면 잃는다**',
  },
  {
    key: 'pilot', name: '사람', from: '해서 (경험)', luck: false, lose: false,
    by: 'growth-table.js',
    what: '★ 격추·구간·회수가 경험이 되고, 레벨마다 **특성 하나**를 고른다',
  },
];

/**
 * ★★ **RPG 가 아니게 되는 다섯 가지** — 이 목록이 곧 안 하는 것이다.
 *   기둥을 세우는 것보다 **안 무너뜨리는 것**이 더 자주 어긋난다
 */
export const NOT = [
  {
    what: '숫자만 오르는 성장',
    why: '레벨이 오르는데 **하는 일이 그대로**면 그건 진행 막대지 성장이 아니다.'
      + ' 그래서 특성은 다 **이미 있는 계통의 규칙을 바꾼다** (조준 띠 · 회피 창 · 열)',
  },
  {
    what: '회차를 반복해서 크는 것',
    why: '**2시간 한 번의 여정**이다 (`PLAN2H.md`). 「회차 배수」·「무한 반복」은'
      + ' 낡은 것이고, 성장은 **그 두 시간 안에서** 다 일어나야 한다',
  },
  {
    what: '고를 것이 없는 성장',
    why: '레벨마다 **저절로** 세지면 결심이 없다. 특성은 **고르는 것**이고,'
      + ' 다 못 고른다 — 그래야 이 회차의 내가 지난 회차와 다르다',
  },
  {
    what: '사람이 크면 배가 필요 없어지는 것',
    why: '두 갈래가 **같은 것을 올리면** 한쪽이 죽는다. 특성은 **다루는 법**을,'
      + ' 파츠는 **배의 성능**을 올린다 — 겹치면 파밍이 장식이 된다',
  },
  {
    what: '이야기 없는 성장',
    why: '레벨이 올라도 **가는 곳이 그대로**면 RPG 가 아니라 사격장이다.'
      + ' 성장은 `story-table.js` 의 줄기 넷과 같은 길 위에 있어야 한다',
  },
];
