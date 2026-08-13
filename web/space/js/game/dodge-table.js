// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **회피 — 경고 · 방향 · 창** — 뼈대 (v135). 기획은 `docs/space/DODGE.md`.
//
//  ★ 사장님 (2026-08-13) 「적이 미사일을 발사하고 내 화면에 **경고창**이 뜨면서
//    **특정 방향으로 틀라는 네비게이션**이 나오고 **그거대로 누르면 완벽 회피**할
//    수 있도록 해줘. **특정 타이밍 안에 늦거나 못 누르면 피해도가 커지도록** 하고.
//    기존에 겹치는 부분이 있으면 없애고」
//
//  ══ ★★★ 재 보니 **셋은 이미 있었고, 하나가 갈라져 있었다** ═══════════════
//
//  경고도(`AI_LINES.evade`) 고리도(`evade-table.js ringAt`) 방향을 말하는
//  것도(`evadeDir` → 「좌현으로」) **이미 있었다.** 그런데 판정이:
//
//      evadeGain() → Math.abs((relAz/m)*sy - (relEl/m)*sx)   ← **부호를 버린다**
//      roll: Math.abs(evade.roll)                            ← **또 버린다**
//
//  **화면은 「좌현으로」라고 말하고, 판정은 오른쪽으로 밀어도 같은 점수를
//  줬다.** 이 저장소가 이름까지 붙여 둔 병이다 — **「재는 곳을 둘로 만들지
//  않는다」.** 가리키는 자리와 매기는 자리가 v84 부터 열두 판을 갈라진 채
//  왔고, 그래서 「그거대로 누르면 완벽 회피」가 **안 됐던** 것이지 안내가
//  없어서가 아니었다.
//
//  ══ ★★★ 그래서 **누적을 접고 한 번의 판정으로** ═════════════════════════
//
//  옛 모형은 다섯 군데(밀기 · 굴리기 · 급기동 · 창 배수 · 완벽 배수)가
//  곱해져 숫자 하나가 되고 그걸 `DODGE.need` 와 견줬다. 그래서 ① 어느
//  하나를 만지면 넷이 같이 움직였고 ② **그 숫자에는 방향이 없었다.**
//
//      경고 ──▶ 방향 하나 ──▶ 창 안에 그 키를 누른다
//                              ├ 맞다 + 제때  → 완벽 (피해 0)
//                              ├ 맞다 + 늦다  → 늦을수록 아프다
//                              ├ 틀리다       → 더 아프다 (탄 쪽으로 갔다)
//                              └ 안 누른다    → 제일 아프다
//
//  ★★ **뒤집힌 것** — v84 의 「조종간만으로는 못 피한다. 급기동을 써야 하고
//    급기동은 추진제를 태운다」는 **이제 낡은 것**이다. 사장님이 「그거대로
//    누르면 완벽 회피」라고 하셨으므로 **맞추면 급기동 없이 피해진다.**
//    급기동은 죽지 않는다 — **창을 넓히는** 물건이 된다 (「피한다」가
//    「쉬워진다」로 바뀔 뿐이다). 옛 계통을 조용히 죽이지 않는 자리다.
//
//  ★ three.js 를 안 쓴다 — `tools/space-dodge.js` 가 읽는다.
// ══════════════════════════════════════════════════════════════════════════

/**
 * ★★★ **방향 넷** — 이미 손에 있는 키로만 만든다.
 *
 *   ★ 키를 새로 안 만든다. 손 배치(`keys-table.js`)가 늘면 배울 것이 늘고,
 *     이 저장소는 「일곱을 넘기지 않는다」를 지켜 왔다. 넷 다 **이미 그
 *     방향으로 배를 움직이는 키**라 뜻도 안 어긋난다.
 *
 *   ★★ **왜 굴리기가 위아래를 대신하나.** 피치는 이 게임에서 마우스이고
 *     키가 없다. 그리고 실기의 브레이크는 **굴려서 당기는 것**이라,
 *     위아래로 오는 탄에 「굴려서 뺀다」는 말이 된다.
 *
 *   @property axis  'yaw' | 'roll' — 어느 축의 일인가
 *   @property sign  -1 | +1 — 그 축의 어느 쪽인가 (판정이 **부호를 본다**)
 */
export const WAYS = {
  left: { key: 'KeyA', name: 'A', word: '좌현으로 뺍니다', axis: 'yaw', sign: -1 },
  right: { key: 'KeyD', name: 'D', word: '우현으로 뺍니다', axis: 'yaw', sign: +1 },
  rollL: { key: 'KeyQ', name: 'Q', word: '좌로 굴려 뺍니다', axis: 'roll', sign: -1 },
  rollR: { key: 'KeyE', name: 'E', word: '우로 굴려 뺍니다', axis: 'roll', sign: +1 },
};

/** 열쇠 넷 — 검사와 화면이 **같은 것**을 센다 */
export const WAY_KEYS = Object.keys(WAYS);

export const DODGE2 = {
  /**
   * ★★ **경고가 뜨는 때** — 남은 초. 탄이 0.9초를 나므로 **쏘자마자**다.
   *   사람 반응 시간이 0.20~0.25초이니 그 **세 배**는 줘야 「보고 누른다」가 된다
   */
  warnFrom: 0.9,
  /**
   * ★★★ **완벽 창** — 남은 시간이 이 사이에 맞는 키를 누르면 **피해 0**.
   *   ★ 0.4초짜리다 — 반응 시간의 **약 두 배**. 이보다 좁으면 「보고 누르는」
   *     것이 불가능해지고, 그러면 타이밍이 아니라 **운**이다 (v111 이 적어 둔 것)
   */
  perfect: [0.15, 0.55],
  /** ★ **늦음 창** — 눌리기는 하는데 아프다 (남은 0.15초부터 닿을 때까지) */
  lateTo: 0.15,

  /** 피해 배수 넷 — 「완벽 · 늦음 · 틀림 · 안 누름」 */
  hurt: {
    perfect: 0,
    /** 늦음은 **범위**다 — 늦을수록 아프다 (막 늦었다 → 다 늦었다) */
    late: [1.0, 1.6],
    /** ★★ 틀린 방향은 **안 누른 것보다는 낫다.** 반대로 꺾어도 옆으로는 갔다 */
    wrong: 1.3,
    none: 1.8,
  },

  /**
   * ★★ **급기동(Shift)이 창을 넓힌다** (초 · 양쪽으로).
   *   v84 의 급기동을 안 죽인다 — 상이 「피한다」에서 **「쉬워진다」**로 바뀐다
   */
  agileWide: 0.08,
};

/**
 * ★★★ **어느 쪽으로 빼라고 할까** — 오는 방위에서 **하나**를 고른다.
 *
 *   ★ 옆에서 오면 **요**로 뺀다 (좌/우). 위아래에서 오면 **굴려서** 뺀다.
 *     「탄이 오는 선의 수직」이라는 뜻은 `evadeDir` 과 같지만, 여기서는
 *     **넷 중 하나로 굳힌다** — 판정이 부호를 봐야 하기 때문이다.
 *
 *   ★★ 정면(0,0)이면 수직이 무한히 많다. 그때는 **좌현**으로 굳힌다 —
 *     「아무 쪽이나」라고 말하면 그건 지시가 아니다
 *
 * @param relAz 탄이 오는 자리 (기수 기준 · 도) — 오른쪽이 +
 * @param relEl 〃 위가 +
 * @returns WAYS 의 열쇠 하나
 */
export function wayFor(relAz = 0, relEl = 0) {
  const m = Math.hypot(relAz, relEl);
  if (m < 1e-3) return 'left';
  // 옆에서 오나 · 위아래에서 오나
  if (Math.abs(relAz) >= Math.abs(relEl)) {
    // 오른쪽에서 오면 **왼쪽**으로 뺀다
    return relAz > 0 ? 'left' : 'right';
  }
  // 위에서 오면 **오른쪽으로 굴려** 내려간다 (부호는 굳히기만 하면 된다)
  return relEl > 0 ? 'rollR' : 'rollL';
}

/** 사람이 읽는 한 마디 — 「A — 좌현으로 뺍니다」 */
export const wayWord = (way) => {
  const w = WAYS[way];
  return w ? `${w.name} — ${w.word}` : '';
};

/**
 * ★★★ **지금 누른 것이 맞나** — 창과 방향을 **한 번에** 본다.
 *
 * @param way     지시한 방향 (WAYS 의 열쇠)
 * @param pressed 지금 눌린 방향들 (열쇠 배열) — 마우스로 민 것도 여기 넣는다
 * @param left    닿기까지 남은 초
 * @param agile   급기동 중인가 (창이 넓어진다)
 * @param wide    「반사」 특성이 더 넓히는 양 (초 · `growth-table.js`)
 * @returns { band, hurt, why }
 *          band 'perfect' | 'late' | 'wrong' | 'none' | 'early'
 */
export function judge(way, pressed = [], left = 0, { agile = false, wide = 0 } = {}) {
  const w = (agile ? DODGE2.agileWide : 0) + wide / 2;
  const [lo, hi] = DODGE2.perfect;
  const list = Array.isArray(pressed) ? pressed : [pressed].filter(Boolean);

  // ══ ★★★ **넷을 다 누르는 것이 답이 되면 안 된다** ═════════════════════
  //  ★ 「어느 하나가 맞으면 통과」로 두면 **A·D·Q·E 를 다 눌러 놓는 것**이
  //    최적해가 되고, 그러면 방향이 없어진다. 그래서 **하나만** 눌러야
  //    맞은 것으로 친다 — 실기에서도 좌우로 동시에 꺾는 조종은 없다
  const only = list.length === 1 ? list[0] : null;
  const hit = only === way;
  const anyWrong = list.length > 0;

  if (!anyWrong) {
    // 아직 안 눌렀다 — 창이 남았으면 「기다린다」, 지났으면 「안 눌렀다」
    return left > hi + w
      ? { band: 'early', hurt: null, why: '아직 이르다' }
      : (left > 0 ? { band: 'none', hurt: null, why: '아직 안 눌렀다' }
        : { band: 'none', hurt: DODGE2.hurt.none, why: '안 눌렀다' });
  }
  if (!hit) {
    return {
      band: 'wrong',
      hurt: DODGE2.hurt.wrong,
      why: list.length > 1 ? '한 번에 하나만' : '반대로 꺾었다',
    };
  }
  if (left > hi + w) return { band: 'early', hurt: null, why: '너무 이르다 — 유도가 다시 문다' };
  if (left >= lo - w) return { band: 'perfect', hurt: DODGE2.hurt.perfect, why: '완벽' };
  // ★★ **늦음은 범위다** — 막 늦은 것과 다 늦은 것이 같으면 그건 벌이 아니다
  const k = Math.max(0, Math.min(1, 1 - left / Math.max(1e-6, lo - w)));
  const [a, b] = DODGE2.hurt.late;
  return { band: 'late', hurt: a + (b - a) * k, why: '늦었다' };
}

/**
 * ★★★ **시간만 보고 어느 띠인가** — 화면이 고리를 그릴 때 쓴다.
 *
 *   ★★ **`judge` 와 같은 창을 본다.** 화면이 「지금」이라고 했는데 판정이
 *     아니면 그 계기는 그 뒤로 아무도 안 믿는다 — 이 배의 오랜 규약이고,
 *     v134 까지 고리는 `evade-table.js` 의 창을, 판정은 누적을 보고 있었다
 *
 * @returns 'early' | 'now' | 'late'
 */
export function bandAt(left, { agile = false, wide = 0 } = {}) {
  const w = (agile ? DODGE2.agileWide : 0) + wide / 2;
  const [lo, hi] = DODGE2.perfect;
  if (left > hi + w) return 'early';
  return left >= lo - w ? 'now' : 'late';
}

/** 고리 크기 0~1 (1 이면 크다 · 0 이면 붙었다) — **경고가 뜬 때**를 기준으로 */
export const ringAt2 = (left) =>
  Math.max(0, Math.min(1, left / DODGE2.warnFrom));

/**
 * ★★ **화살표가 가리킬 쪽** — 「어디로 가라」를 그린다.
 *   ★ 굴리기는 옆으로 미는 것이 아니라 **위아래에서 오는 것을 피하는 것**이라
 *     화살표도 위아래다. 지시(글)와 화살표가 **같은 표**에서 나온다
 */
export const arrowOf = (way) => ({
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  rollL: { x: 0, y: 1 },
  rollR: { x: 0, y: -1 },
}[way] ?? { x: -1, y: 0 });

/** 화면이 쓰는 한 마디 */
export const BAND_WORD = {
  now: '★ 지금',
  early: '기다립니다',
  perfect: '★★ 완벽 회피',
  late: '늦었습니다',
  wrong: '반대입니다',
  none: '★ 지금',
};
