// 속성 — 「공략할 수 있게」 만드는 것.
//
// 설계는 docs/ELEMENTS.md. 성공 조건은 하나로 못박아 뒀다:
//
//   **처음 보는 몬스터를 만났을 때, 툴팁을 안 열고도
//     「저건 뭐로 때려야 하는지」가 보여야 한다.**
//
// 이게 안 되면 속성은 그냥 곱하기 표가 하나 는 것이고, 표를 못 읽으면
// 공략이 아니라 운이다. 그래서 이 파일에는 규칙뿐 아니라 **보여주는 방법**
// (색·입자)까지 같이 들어 있다. 둘이 떨어져 있으면 반드시 한쪽이 뒤처진다.

/**
 * 순환 넷.  화 → 빙 → 뇌 → 혼 → 화
 *
 * 오행(화수목금토)을 그대로 쓰지 않았다. 상생상극이 10가지 관계라 외울 사람이
 * 없고, 표를 못 외우면 공략이 아니라 시행착오다. 넷으로 줄이면 한 문장이 된다:
 * **「불은 얼음을, 얼음은 번개를, 번개는 영혼을, 영혼은 불을 이긴다.」**
 */
export const ELEMENTS = {
  none:  { key: 'none',  name: '무',   css: '#c8c8c8', hex: 0xc8c8c8, beats: null,   icon: '◇' },
  fire:  { key: 'fire',  name: '화',   css: '#ff8a2b', hex: 0xff7a2a, beats: 'ice',  icon: '🔥' },
  ice:   { key: 'ice',   name: '빙',   css: '#7fd8e8', hex: 0x7fd8e8, beats: 'bolt', icon: '❄' },
  bolt:  { key: 'bolt',  name: '뇌',   css: '#b98aff', hex: 0xa87aff, beats: 'soul', icon: '⚡' },
  soul:  { key: 'soul',  name: '혼',   css: '#8fe0a0', hex: 0x7ad894, beats: 'fire', icon: '👁' },
};

export const ELEMENT_KEYS = Object.keys(ELEMENTS);

/**
 * 배율.
 *
 * ×2.0 이면 「맞는 속성이 없으면 못 잡는다」가 되어 자물쇠가 된다 —
 * 이 게임은 드랍이 억제돼 있어(4.5%) 원하는 속성 무기가 없을 수 있다.
 * ×1.3 이면 무시하고 세게 때리는 게 이득이라 시스템이 장식이 된다.
 * 1.6 은 처치 시간이 눈에 띄게 줄되(약 −37%) 없어도 잡을 수 있는 구간이다.
 */
export const STRONG = 1.6, WEAK = 0.6;

/**
 * 공격 속성 → 방어 속성 배율.
 * **무속성은 어디서나 1.0 이다.** 안전한 기본값이 없으면 좋은 무기를 주워도
 * 못 쓴다 — 속성이 「선택」이 되려면 안 고르는 선택지도 있어야 한다.
 */
export function elementalMult(atk, def) {
  if (!atk || !def || atk === 'none' || def === 'none') return 1;
  if (ELEMENTS[atk]?.beats === def) return STRONG;
  if (ELEMENTS[def]?.beats === atk) return WEAK;
  return 1;
}

/** 몬스터 기본 속성 (docs/ELEMENTS.md §4) */
export const ENEMY_ELEMENT = {
  skeleton: 'none',   // 성문을 지키던 하급병. 특별할 것 없는 뼈다
  ghoul: 'soul',      // 죽지 못한 굶주림 그 자체
  archer: 'ice',      // 성벽 위에서 얼어 죽었다
  golem: 'bolt',      // 왕관의 벌로 움직이는 돌
  lord: 'soul',       // 보스는 페이즈마다 바뀐다 (game/boss.js)
};

/**
 * 층별 분포. 2층이 이 시스템의 **교육 지점**이다 —
 * 빙 특화층이라, 1층에서 화염 무기를 하나 챙겼다면 눈에 띄게 쉬워진다.
 * 그 한 번의 경험이 「속성을 챙겨야 하는구나」를 가르친다. 설명문으로는 못 가르친다.
 */
export const FLOOR_MIX = [
  { none: 60, soul: 30, ice: 10 },
  { ice: 50, soul: 25, bolt: 25 },
  { bolt: 40, soul: 40, fire: 20 },
];

/** 층 분포에 따라 속성을 굴린다. 종족 기본값을 덮어쓴다. */
export function rollElement(rnd, floorNo) {
  const mix = FLOOR_MIX[Math.min(FLOOR_MIX.length - 1, floorNo - 1)];
  const total = Object.values(mix).reduce((a, b) => a + b, 0);
  let u = rnd() * total;
  for (const [k, w] of Object.entries(mix)) { u -= w; if (u <= 0) return k; }
  return 'none';
}

/** 보스 페이즈별 속성 — 무기를 두 개 이상 챙길 이유를 만든다 (§5) */
export const BOSS_PHASE_ELEMENT = ['soul', 'bolt', 'fire'];

/**
 * 무기에 붙는 속성 접사 등장률.
 * 일반 등급에는 안 붙는다 — 일반 무기가 「안전한 기본값」으로 남아야 한다.
 */
export const WEAPON_ELEMENT_CHANCE = 0.28;
