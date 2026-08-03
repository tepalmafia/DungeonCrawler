// 적 **표** — 종족 넷과 변종 여섯의 숫자. **여기엔 그림도 소리도 없다.**
//
// ── 왜 갈라 놨는가 ──────────────────────────────────────────
// enemies.js 는 메시·소리·길찾기·AI 를 전부 끌고 오므로 브라우저 밖에서
// 읽을 수 없다. 그러면 밸런스를 볼 때마다 숫자를 손으로 옮겨 적게 되고,
// 옮겨 적는 순간 원본과 갈라진다 (item-table.js 머리말 참조).
//
// **`build` 대신 `body`** — 함수 참조를 넣으면 모델 파일을 끌고 오게 되어
// 표가 다시 안 순수해진다. 「어느 몸을 쓰는가」는 문자열이면 충분하고,
// 그 문자열을 실제 빌더로 바꾸는 일은 enemies.js 가 한다.
// 덤으로 변종이 무기·방패를 어떻게 바꾸는지가 표에서 바로 읽힌다.

export const ARCHETYPES = {
  skeleton: {
    key: 'skeleton', name: '해골 병사', body: 'skeleton',
    hp: 92, dmg: 8, armor: 4, speed: 3.0, radius: 0.42, range: 1.6,
    windup: 0.45, recover: 0.85, aggro: 8.5, leash: 20, xp: 16, scale: 1.0, gib: 0xd6cdb4,
  },
  ghoul: {
    key: 'ghoul', name: '구울', body: 'ghoul',
    hp: 58, dmg: 8, armor: 1, speed: 5.0, radius: 0.38, range: 1.4,
    windup: 0.3, recover: 0.6, aggro: 9.5, leash: 22, xp: 14, scale: 1.0, gib: 0x7d8a5a,
    leap: true,
  },
  archer: {
    key: 'archer', name: '망령 궁수', body: 'archer',
    hp: 66, dmg: 11, armor: 2, speed: 3.2, radius: 0.4, range: 11,
    windup: 0.7, recover: 1.05, aggro: 12.5, leash: 24, xp: 20, scale: 1.0, gib: 0x7fb4d6,
    ranged: true, keepAway: 6.5, float: true,
  },
  golem: {
    key: 'golem', name: '무덤 골렘', body: 'golem',
    hp: 265, dmg: 21, armor: 13, speed: 2.3, radius: 0.75, range: 2.4,
    windup: 0.9, recover: 1.25, aggro: 8, leash: 18, xp: 75, scale: 1.15, gib: 0x8a8a92,
    heavy: true, elite: true, slam: 3.4,
  },
};

// ───────────────────────── 변종 ─────────────────────────
//
// **같은 몸, 다른 규칙** (docs/FLOORS.md §1-2 · §5-2).
// 종족을 새로 만드는 것보다 훨씬 싸고, 난이도 설계에는 더 좋다 —
// 「아는 실루엣인데 규칙이 다르다」가 「모르는 실루엣」보다 긴장을 만든다.
//
// ★ **`key` 는 원본 그대로 둔다.** 이게 이 파일에서 제일 중요한 규칙이다.
//   저장소에 종족 키로 찾는 표가 여덟 개 있다 — 소리(VOICE) · 시체(REMAINS) ·
//   대사(LINES·TINT) · 정예 기술(SKILL_BY_KIND) · 외침(SHOUT) · 대기 자세
//   (BY_KIND) · 속성(ENEMY_ELEMENT) · 랜턴 드랍. 새 키를 주면 **여덟 곳이
//   전부 조용히 기본값으로 떨어진다** — 소리 없는 어그로, 시체 없는 죽음,
//   벙어리, 전부 대지 강타. 오류는 한 줄도 안 난다. (정찰에서 확인했다.)
//
//   그래서 인덱스 이름만 새로 주고 `key` 는 원본을 쓴다.
//   구분은 `variant`(계측·검사용)와 **규칙 필드**로 한다.
const variant = (base, over) => ({ ...ARCHETYPES[base], ...over });

// 해골 창병 — 사거리가 길고 선딜이 길다. **간격 관리**를 가르친다 (2층)
// **무기가 규칙을 설명한다.** 사거리 2.9 는 숫자로는 안 보이고 자루 길이로
// 보인다. 이게 없으면 원본과 똑같이 생긴 해골이 두 배 먼 데서 때리는 꼴이라
// 「왜 저기서 맞지」가 된다.
ARCHETYPES.spearman = variant('skeleton', {
  variant: 'spearman', name: '해골 창병', body: 'skeleton', weapon: '창',
  range: 2.9, windup: 0.68, recover: 0.95, dmg: 9, xp: 19,
});

// 해골 방패병 — 정면이 단단하다. **각도**를 가르친다 (3층)
ARCHETYPES.shieldman = variant('skeleton', {
  variant: 'shieldman', name: '해골 방패병', body: 'skeleton', shield: true,
  hp: 110, armor: 6, speed: 2.7, xp: 22,
  frontGuard: 0.6,       // 정면 60도 안에서 온 피해를 60% 막는다
});

// 성문 파수병 — 조 편성으로 나온다. 혼자면 평범하다 (7층)
ARCHETYPES.gatekeeper = variant('skeleton', {
  variant: 'gatekeeper', name: '성문 파수병', body: 'skeleton', weapon: '둔기',
  hp: 120, dmg: 11, armor: 7, aggro: 10, xp: 24,
});

// 익사한 순례자 — 죽으면 웅덩이를 남긴다. **죽인 자리가 함정이 된다** (5층)
ARCHETYPES.drowned = variant('ghoul', {
  variant: 'drowned', name: '익사한 순례자',
  hp: 70, speed: 4.6, xp: 18,
  deathPuddle: { r: 2.6, t: 5, mul: 0.55 },
});

// 사슬 궁수 — 화살이 관통하고 잠깐 묶는다. **엄폐를 강요한다** (6층)
ARCHETYPES.chainer = variant('archer', {
  variant: 'chainer', name: '사슬 궁수',
  hp: 78, dmg: 10, recover: 1.5, xp: 26,
  arrowPierce: 2, arrowRoot: 0.55,
});

// 왕의 조각상 — 부술 때까지 안 움직인다. **선택할 수 있는 위협**이다 (8층)
ARCHETYPES.statue = variant('golem', {
  variant: 'statue', name: '왕의 조각상',
  hp: 300, dmg: 21, armor: 16, aggro: 6, xp: 90,
  immobile: true,
});
