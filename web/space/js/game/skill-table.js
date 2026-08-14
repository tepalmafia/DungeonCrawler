// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **스킬 — 더 화려한 전투** (v145 · 블록아웃). 기획은 `docs/space/SKILL.md`.
//
//  ★ 사장님 (2026-08-14) 「**더 화려한 전투를 하고 싶은데, 우주 전투에 있을
//    법한 스킬들을 기획해봐**」 → 「기획대로 구현해」
//
//  ══ ★★★ 이 표가 서 있는 세 개의 사실 (기획서 §0 에서 잰 것) ═══════════
//
//   ① **손이 이미 꽉 찼다** (`keys-table.js HAND_MAX = 3`). 그래서 스킬은
//      키를 **둘만** 늘린다 (4 · 5) + 지속 하나는 Ctrl 조합.
//   ② **사람 성장 아홉이 전부 수동 보정**이다. 레벨 7 에 여섯 번을 골라도
//      **화면에서는 아무 일도 안 난다** — 「화려함」이 빌 자리가 정확히 여기다.
//   ③ **전투 한 판이 1.1~12초**다 (요격기 2 · 침입선 10 · 포함 22 맷집을
//      초당 1.8 로 깎는다). 그래서 쿨은 **12~30초** — 한 교전에 한두 번.
//
//  ══ ★★★ 고르는 기준 넷 — 스무 개를 다섯으로 줄인 자 ═══════════════════
//
//   1. **새 키를 거의 안 만든다**
//   2. ★★★ **겨누는 것을 대신하지 않는다** — 전부 락온·자동이면 v114 의
//      조준 띠와 v119 의 락온이 둘 다 죽는다. 스킬은 **겨눌 기회를 만들** 뿐
//   3. ★★ **값을 치른다** — 열·추진제·탄·시간 중 하나. 공짜면 늘 켜 두는
//      것이 되고, 늘 켜 두는 것은 조작이 아니라 **설정**이다
//   4. ★★★ **이미 있는 계통에 손잡이를 단다** — 새 계통 다섯을 만드는 것이
//      아니다. 지어 놓은 다섯(v58 열 · v73 비행 · v119 락온 · v135 회피 ·
//      장면 E 정전)에 **능동 손잡이**를 하나씩 다는 것이다
//
//  ★ three.js 를 안 쓴다 — `tools/space-skill.js` 가 브라우저 없이 읽는다.
// ══════════════════════════════════════════════════════════════════════════

/**
 * ★★★ **스킬 다섯.**
 *
 *  @property slot   장착 슬롯을 먹나 (`false` 면 지속 — 슬롯을 안 먹는다)
 *  @property cool   다시 쓰기까지 (초). 12~30 (기획 §0-③)
 *  @property sec    효과가 이어지는 시간 (초)
 *  @property opens  이 레벨에서 열린다
 *  @property hooks  ★★★ **어느 계통에 물리나** — 아무것도 안 가리키면 그건
 *                   손잡이가 아니라 **새 계통을 하나 더 얹은 것**이다
 *  @property costs  무엇을 치르나 (하나 이상이어야 한다 — 기준 ③)
 *  @property why    왜 이것이 이 게임에 있어야 하나
 */
export const SKILLS = [
  {
    key: 'chaff', name: '기만체', slot: true, cool: 16, sec: 0.8,
    ammo: 3, opens: 2, hooks: 'lock', costs: ['ammo'],
    /** 나를 문 락온이 풀린다 · 날아오던 탄이 이 각만큼 빗나간다 */
    breaks: true, bend: 26,
    why: '지금 쫓기는 것에 대해 할 수 있는 일이 **「피한다」뿐**이다 (v135).'
      + ' 떼어 내는 길이 하나 더 생기면 「맞기 전에 꺾는다」와 「물리기 전에'
      + ' 턴다」가 갈린다. 통이 3발이라 **언제 쓰나**가 결심이 된다',
    fx: '은박이 뒤로 흩날리며 반짝인다',
  },
  {
    //  ★★ 벤치마크 넷 중 넷이 쓴다 (Elite pips · SC 전력 삼각 · FS ETS …).
    //    이 배는 이미 차단기로 전력을 나누므로(v58) 자리가 있다
    key: 'pips', name: '전력 몰기', slot: false, cool: 0, sec: 0,
    opens: 3, hooks: 'heat', costs: ['time'],
    /** 몰아준 쪽이 이만큼 좋아지고 나머지 둘이 이만큼 나빠진다 */
    gain: 0.20, lose: 0.14, swap: 1.5,
    why: '쿨이 **없는** 대신 **늘 하나만** 고를 수 있다. 그게 값이다 —'
      + ' 무기에 몰면 센서가 짧아지고, 센서에 몰면 열이 빨리 오른다',
    fx: '계기 막대가 옮겨 붙고 창 테두리 색이 바뀐다',
  },
  {
    key: 'drift', name: '관성 정지', slot: true, cool: 12, sec: 0.9,
    opens: 4, hooks: 'flight', costs: ['fuel', 'time'],
    /** 추진제를 이만큼 태우고, 도는 동안 **못 쏜다** */
    fuel: 10, mute: true, spin: 3.4,
    /**
     * ★★★ **뒤를 잡은 자세가 이어지는 시간** (초) — 이 스킬의 **세기 손잡이**다.
     *   ★ 처음에 이 값을 바깥 가정(`YARD.rearSec`)에 뒀다가, 밸런스를 재면서
     *     「관성 정지만 유독 약하다」가 나왔다. 그런데 **기수를 얼마나 홱
     *     돌려 주느냐**는 바깥 사정이 아니라 **이 스킬이 하는 일**이다 —
     *     `spin` 이 빠를수록 오래 물고 있는다. 가정이 아니라 손잡이다
     */
    rear: 7,
    why: '**제일 「우주다운」 기동**이다 — 공기가 없으니 기수와 진행 방향이'
      + ' 따로 논다. 뒤를 잡힌 채로 **기수만 돌려 쏘고 다시 도망**갈 수 있고,'
      + ' 그러면 v137 의 어스펙트(뒤가 아프다)가 **양쪽으로** 성립한다',
    fx: '별이 옆으로 흐르는데 기수는 딴 데를 본다 (v144 속도감이 그대로 산다)',
  },
  {
    key: 'overdrive', name: '과부하', slot: true, cool: 22, sec: 3.5,
    opens: 6, hooks: 'laser', costs: ['heat'],
    /** 레이저 피해 배수 · 끝나면 이만큼 열이 얹힌다 (과열) */
    dmg: 3, heat: 20,
    why: '레이저는 **탄이 무한이고 열이 값**이다 (v141). 그 저울을 잠깐 크게'
      + ' 기울인다 — 포함(맷집 22)을 12초 → 5초에 깎지만, 끝나면 과열이라'
      + ' **한동안 못 숨는다**',
    fx: '총열이 하얗게 달아오르고 빔이 굵어진다',
  },
  {
    key: 'emp', name: 'EMP 방출', slot: true, cool: 20, sec: 5,
    opens: 7, hooks: 'dark', costs: ['time'],
    /** 이 반경 안의 적이 멈춘다 · **내 계기도 이만큼 꺼진다** */
    r: 120, blind: 2,
    why: '「내 계기가 꺼진다」가 **이미 지어져 있다** (장면 E · 정전). 그래서'
      + ' 양날이 저절로 선다: 적을 4초 멈추는 대신 나도 2초 눈을 감는다.'
      + ' **여러 대에 둘러싸였을 때만** 이득이다',
    fx: '푸른 고리가 퍼져 나가고 적 엔진 불이 꺼진다',
  },
];

export const BY_KEY = Object.fromEntries(SKILLS.map((s) => [s.key, s]));

/** ★★★ 다섯 중 **둘만** 장착한다 — 다 못 가지므로 회차마다 다른 배가 된다 */
export const SLOTS = 2;

/** 전력을 몰 수 있는 세 갈래 */
export const LANES = [
  { key: 'weapon', name: '무기', what: '레이저 열이 덜 오른다' },
  { key: 'agile', name: '기동', what: '기수가 빨리 돈다' },
  { key: 'sensor', name: '센서', what: '레이더가 멀리 본다' },
];

/**
 * ★★★ **화면 규칙** (기획 §6).
 *   화려함은 「밝고 큰 것」이 아니라 **「무슨 일이 났는지 한눈에 읽히는 것」**이다.
 *   v87 에 속도감을 주려고 알갱이를 키웠다가 **쫓던 적이 그 뒤로 사라졌다**
 */
export const FX = {
  /** 효과 하나가 화면에 머무는 최대 (초) — EMP 고리와 과부하만 예외 */
  maxSec: 0.6,
  /** 전투 원뿔 — 이 안쪽은 **안 덮는다** (`screen-table.js CONE` 과 같은 값) */
  cone: 0.45,
};

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ v147 — **효과가 화면에서 읽히나** (블록아웃)
//
//  ★ 사장님 (2026-08-14) 「스킬 쓸 때 화면 효과 스크린샷 찍어서 보여줘」
//
//  ══ 찍어 보니 **넷 중 하나만 읽혔다** ═════════════════════════════════
//
//  효과를 재생 중간(12%)에 멈춰 세우고 계산된 값을 읽으니 **넷 다 켜져
//  있었다** (opacity 0.81 · z 4 · visible). 안 보인 까닭은 안 켜져서가
//  아니라 **칠하는 자리와 진하기**였다:
//
//      EMP        복판을 가로지르는 고리         → 바로 읽힘
//      기만체     화면 **아래 118%** 가 중심     → 아래 끝 얇은 띠. 안 보임
//      관성 정지  좌우 34% 에 **0.20**           → 거의 안 보임
//      과부하     테두리 안쪽 130px 그림자       → 가장자리에만. 안 보임
//
//  ★★★ v145 의 `style.css` 에 「효과는 **테두리에서만** 논다 — 복판을
//    덮으면 v87 의 흰 공이다」라고 적어 뒀다. 그 말은 맞다. 그런데
//    **가리지 않기를 지키다 안 보이는 데까지 갔다.** 「안 가린다」와
//    「안 보인다」 사이에 자가 없었던 것이 병이다 — 그 자가 이 표다.
//
//  ★★ EMP 가 답을 갖고 있었다: **복판을 지나가되 속이 빈 고리**라
//    적을 안 가린다. 그리고 **움직인다.** 멈춰 있는 물감은 「화면 색이
//    좀 변했나?」가 되고, 움직이는 것은 눈이 저절로 잡는다.
//
//  ★ three.js 를 안 쓴다 — `tools/space-skill.js` 가 브라우저 없이 읽고,
//    같은 도구의 `--see` 가 **진짜 화면의 화소**로 되짚는다.
//    한쪽만 읽으면 「둘이 같나」를 못 묻는다 (v98 규약).
// ══════════════════════════════════════════════════════════════════════════

/**
 * ★★★ **효과 하나가 화면에서 하는 일.**
 *
 *  @property kind  모양 — `burst`(터진다) · `sweep`(훑는다) · `rim`(테두리가
 *                  달아오른다) · `ring`(고리가 퍼진다) · `none`(화면 효과 없음)
 *  @property peak  제일 진한 곳의 알파 (0~1). **`READFX.minPeak` 밑이면 없는 것과 같다**
 *  @property band  칠하는 띠 — 화면 복판에서의 거리 [안쪽, 바깥쪽] (0=복판, 1=가장자리)
 *  @property sec   화면에 머무는 시간 (초)
 *  @property moves 움직이나 — **멈춘 물감은 안 읽힌다**
 *  @property hold  ★★ 이 스킬이 **내 상태를 바꾸는 동안** 화면이 말해야 하는
 *                  시간 (초). 0 이면 순간기다. 버프인데 여기가 0 이면
 *                  「지금 세다」를 화면이 안 말하는 것이다
 */
export const FXSHAPE = {
  //  아래에서 은박이 확 퍼지고 사선 결이 흘러간다. 복판 위쪽은 안 건드린다
  chaff: { kind: 'burst', peak: 0.90, band: [0.52, 1.00], sec: 0.9, moves: true, hold: 0 },
  //  좌우로 속도선이 훑고 지나간다 — 가운데 40% 는 **비워 둔다**
  drift: { kind: 'sweep', peak: 0.62, band: [0.60, 1.00], sec: 1.1, moves: true, hold: 0.9 },
  //  ★★ 테두리에 **선**이 선다. 그림자만으로는 안 읽혔다 (v145) —
  //    번지는 것은 배경에 묻히고, 선은 안 묻힌다
  overdrive: { kind: 'rim', peak: 0.85, band: [0.86, 1.00], sec: 3.5, moves: true, hold: 3.5 },
  //  v145 에서 **유일하게 읽혔던 것.** 나머지 셋이 이것의 문법을 따라간다
  //  ★★ 고리는 0.9초면 끝나지만 **내 눈은 2초를 감는다.** v147 검사가
  //    그 1.1초를 「화면이 조용한 시간」으로 잡아 빨개졌고, 그 말이 맞다 —
  //    그래서 고리 뒤에 **푸른 잔상**을 1.1초 더 붙였다 (`fxblind`)
  emp: { kind: 'ring', peak: 0.42, band: [0.30, 1.00], sec: 2.0, moves: true, hold: 2 },
  //  ★ 전력 몰기는 **화면 효과가 없는 것이 맞다** — 늘 켜져 있는 것이라
  //    번쩍이면 회차 내내 번쩍인다. 계기 한 줄로 말한다
  pips: { kind: 'none', peak: 0, band: [0, 0], sec: 0, moves: false, hold: 0 },
};

/** ★★★ **읽히나 · 가리나**의 바닥과 상한 */
export const READFX = {
  /** 이보다 옅으면 **없는 것과 같다** — v145 의 관성 정지가 0.20 이었다 */
  minPeak: 0.40,
  /** 칠하는 띠의 안쪽 끝은 여기보다 바깥이어야 한다 (`ring` 만 예외 — 속이 비었다) */
  minBand: 0.50,
  /** 화면에서 잰 밝기 오름의 바닥 (0~255) — `--see` 가 쓴다 */
  minLift: 8,
  /**
   * ★★★ **가린다」는 평균이 아니라 「덮인 넓이」다.**
   *
   *  ★ 처음에 「원뿔 안 평균 밝기가 6 이하」로 쟀다. 그러면 **EMP 고리가
   *    빨개진다** — 고리는 원뿔을 **가로지르지만 덮지는 않는다.** 속이
   *    비어 있어서 그 뒤의 적이 그대로 보인다. 그런데 v145 에 넷 중
   *    **유일하게 읽혔던 것**이 바로 그 고리다. 평균으로 재면 이 게임에서
   *    제일 잘 된 효과가 빨개지고, 그러면 자를 믿고 그것을 지우게 된다.
   *  ★★ v87 에 진짜로 났던 사고는 「주먹만 한 **흰 공**이 쫓던 적을 덮었다」
   *    이고, 그건 **넓이**다. 그래서 재는 것을 바꾼다 —
   *    **반쯤 이상 덮인 화소가 원뿔의 몇 할인가.**
   */
  hideAt: 40,
  maxConeShare: 0.12,
};

/** 이 스킬의 화면 효과가 몇 초짜리인가 — **화면과 표가 여기 하나를 본다** */
export const fxSecOf = (key) => FXSHAPE[key]?.sec ?? FX.maxSec;

/**
 * ★★★ **버프인데 화면이 조용하지 않나.**
 *   내 상태가 바뀌어 있는 동안(`hold`)은 효과도 붙어 있어야 한다 —
 *   v145 의 과부하가 **3.5초 세면서 화면은 3초에 꺼졌다.**
 */
export const fxHolds = (key) => fxSecOf(key) >= (FXSHAPE[key]?.hold ?? 0) - 1e-6;

/** 스킬 한 벌 — 저장에 그대로 들어간다 */
export function makeSkills() {
  return {
    /** 장착한 열쇠 (최대 `SLOTS` 개) */
    on: [],
    /** 열린 것 (레벨이 열어 준다) */
    open: [],
    /** 남은 쿨 (초) */
    cool: {},
    /** 지금 도는 효과의 남은 시간 (초) */
    live: {},
    /** 기만체 통 */
    ammo: { chaff: BY_KEY.chaff.ammo },
    /** 전력을 어디에 몰았나 · 바꾸는 중이면 남은 시간 */
    lane: 'weapon', swapT: 0,
    /**
     * ★★★ v147 — **내 눈이 감긴 남은 시간** (초 · EMP).
     *
     *  ★ v145 에 「내 계기도 2초 꺼집니다」라고 **말만 했다.** 재 보니
     *    `blind` 를 읽는 줄이 게임에 **한 곳도 없었다** — 적만 멈추고
     *    나는 멀쩡했다. 즉 EMP 는 **양날이 아니라 그냥 좋은 것**이었고,
     *    밸런스(v146)는 있지도 않은 값을 빼고 셈했다.
     *  ★★ 「말은 하는데 안 하는 것」은 「안 하고 말도 안 하는 것」보다 나쁘다.
     *    말을 믿고 쓰는 사람이 손해를 보기 때문이다
     */
    blind: 0,
  };
}

/** 이 레벨에서 열려 있어야 하는 것들 */
export const opensAt = (lv = 1) => SKILLS.filter((s) => s.opens <= lv).map((s) => s.key);

/** 슬롯이 몇 개 열렸나 — 레벨 2 에 하나, 5 에 둘 */
export const slotsAt = (lv = 1) => (lv >= 5 ? 2 : (lv >= 2 ? 1 : 0));

/**
 * ★★★ **지금 쓸 수 있나** — 못 쓰면 **까닭을 돌려준다.**
 *   ★ v143 에 배운 것 그대로다: 「막혔는데 말이 없는 것」이 제일 나쁘다
 */
export function whyNotSkill(st, key, s = {}) {
  const k = BY_KEY[key];
  if (!k) return 'none';
  if (!st.open?.includes(key)) return 'locked';
  if (k.slot && !st.on?.includes(key)) return 'unequipped';
  if ((st.cool?.[key] ?? 0) > 0) return 'cool';
  if ((st.live?.[key] ?? 0) > 0) return 'live';
  if (k.ammo !== undefined && (st.ammo?.[key] ?? 0) <= 0) return 'ammo';
  if (k.costs?.includes('fuel') && (s.fuel ?? 0) < k.fuel) return 'fuel';
  if (!s.seat) return 'seat';
  return null;
}

/** 못 쓰는 까닭 → 사람이 읽는 말. **빈 말이 없다** (v143 규약) */
export const SKILL_WHY = {
  none: '그런 스킬이 없습니다',
  locked: '아직 안 열렸습니다 — 레벨을 올립니다',
  unequipped: '장착하지 않았습니다 — I 를 눌러 슬롯에 넣습니다',
  cool: '아직 준비 중입니다',
  live: '이미 쓰는 중입니다',
  ammo: '기만체가 없습니다 — 잔해에서 나옵니다',
  fuel: '추진제가 모자랍니다',
  seat: '조종석에 앉아야 씁니다',
};

export const skillWhyWord = (why) => (why ? (SKILL_WHY[why] ?? '지금은 못 씁니다') : '');

/**
 * ★★★ **쓴다.** 값을 치르고, 효과를 켜고, **무엇이 일어났는지 돌려준다.**
 * @returns { ok, why, key, sec, fx }
 */
export function useSkill(st, key, s = {}) {
  const why = whyNotSkill(st, key, s);
  if (why) return { ok: false, why };
  const k = BY_KEY[key];
  if (k.ammo !== undefined) st.ammo[key] = Math.max(0, (st.ammo[key] ?? 0) - 1);
  st.cool[key] = k.cool;
  if (k.sec > 0) st.live[key] = k.sec;
  //  ★★★ v147 — **내 눈도 감긴다** (EMP). 여기서 켜야 「말은 하는데 안 하는」
  //    상태가 안 난다 — 화면 쪽이 아니라 **규칙 쪽**이 켜는 자리다
  if (k.blind) st.blind = Math.max(st.blind ?? 0, k.blind);
  return { ok: true, key, sec: k.sec, fx: k.fx, fuel: k.fuel ?? 0, blind: k.blind ?? 0 };
}

/** 시간이 흐른다 — 끝난 것들의 열쇠를 돌려준다 (화면이 그걸로 말한다) */
export function stepSkills(st, dt = 0) {
  const done = [];
  for (const k of Object.keys(st.cool)) {
    if (st.cool[k] > 0) st.cool[k] = Math.max(0, st.cool[k] - dt);
  }
  for (const k of Object.keys(st.live)) {
    if (st.live[k] > 0) {
      st.live[k] = Math.max(0, st.live[k] - dt);
      if (st.live[k] === 0) done.push(k);
    }
  }
  if (st.swapT > 0) st.swapT = Math.max(0, st.swapT - dt);
  if (st.blind > 0) st.blind = Math.max(0, st.blind - dt);
  return done;
}

/** 지금 도는 중인가 */
export const isLive = (st, key) => (st?.live?.[key] ?? 0) > 0;

/**
 * ★★★ v147 — **지금 내 눈이 감겨 있나** (EMP 반동).
 *   ★ 레이더 전원을 읽는 **그 한 줄**이 이것을 같이 묻는다 —
 *     새 계통을 만들지 않는다 (`main.js combat.radar.on`)
 */
export const blinded = (st) => (st?.blind ?? 0) > 0;

/**
 * ★★ **전력을 옮긴다** — 바꾸는 데 시간이 든다 (`swap`).
 *   ★ 즉시 바뀌면 급할 때마다 옮기게 되고, 그러면 「미리 정해 두는 것」이라는
 *     뜻이 사라진다
 */
export function setLane(st, lane) {
  if (!LANES.some((l) => l.key === lane)) return { ok: false, why: 'none' };
  if (st.swapT > 0) return { ok: false, why: 'cool' };
  if (st.lane === lane) return { ok: false, why: 'live' };
  st.lane = lane; st.swapT = BY_KEY.pips.swap;
  return { ok: true, lane };
}

/**
 * ★★★ **전력 몰기가 지금 무엇을 바꾸나** — 계통들이 **묻기만** 한다.
 *   @returns { heatMult, agileMult, radarAdd } — 1 이면 그대로
 */
export function laneEffect(st) {
  const p = BY_KEY.pips;
  const on = st?.open?.includes('pips') ? st.lane : null;
  const up = 1 - p.gain; const down = 1 + p.lose;
  return {
    //  ★ 무기에 몰면 **열이 덜 오르고**, 안 몰면 조금 더 오른다
    heatMult: on === null ? 1 : (on === 'weapon' ? up : down),
    //  ★ 기동에 몰면 **빨리 돈다**
    agileMult: on === null ? 1 : (on === 'agile' ? 1 + p.gain : 1 - p.lose),
    //  ★ 센서에 몰면 **멀리 본다** (m)
    radarAdd: on === 'sensor' ? 60 : 0,
  };
}

/** 레이저 피해 배수 — 과부하가 도는 동안만 */
export const dmgMult = (st) => (isLive(st, 'overdrive') ? BY_KEY.overdrive.dmg : 1);

/** 관성 정지 중에는 **못 쏜다** — 그것이 값이다 */
export const muted = (st) => isLive(st, 'drift');

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **밸런스 — 세기와 쿨을 같은 자로 잰다** (v146)
//
//  ★ 사장님 (2026-08-14) 「**스킬 세기랑 쿨 밸런스 확인해봐**」
//
//  ★★★ **「12~30초 안인가」는 밸런스가 아니다.** 그건 범위이고, 밸런스는
//    **「한 번 쓰면 얼마를 벌고, 얼마나 자주 쓰나」**다. 그래서 다섯을
//    **하나의 자**로 환산한다 — **레이저 초당 피해**(1/0.55 = 1.82).
//
//  ★★ 환산이 정확할 필요는 없다. **다섯이 서로 몇 배나 벌어지나**만
//    맞으면 된다 — 넷은 쓸 만한데 하나가 4배면 **그 하나만 쓴다.**
//    그러면 다섯을 만든 뜻이 사라진다 (「다 못 가지나」가 무의미해진다).
// ══════════════════════════════════════════════════════════════════════════

/**
 * ★★★ 환산에 쓰는 **바깥 숫자들.** 여기서 다시 안 잰다 — 딴 표에서 온 값을
 *   적어 두는 자리다. 그 표가 바뀌면 이 값도 같이 고쳐야 하므로
 *   `tools/space-skill.js [10]` 이 **진짜 표와 대조**한다
 */
export const YARD = {
  /** 레이저 한 발 피해 · 재장전 (`combat-table.js WEAPONS.laser`) */
  laserDmg: 1, laserReload: 0.55,
  /** 레이저 한 발이 올리는 열 · 열 상한·시작·식는 속도 (`systems-table.js HEAT`) */
  laserHeat: 4.5, heatMax: 100, heatStart: 34, heatFall: 7.4,
  /** 적이 몇 초마다 쏘나 · 맞을 확률 · 한 발이 깎는 선체 (`target-table.js`) */
  foeEvery: 3.4, foeHit: 0.62, foeHull: 0.03,
  /** 교전에 보통 몇 대가 붙나 — 회차 기준 (`space-war.js` 가 재는 값에 맞췄다) */
  foes: 3,
  /** 뒤를 잡으면 피해 배수 (`aspect-table.js` rear) · 그 자세가 이어지는 시간 */
  rearMult: 1.45, rearSec: 5,
  /** 선체 1 을 레이저 피해 몇 점으로 칠까 — 「안 맞는 것」과 「깎는 것」의 환율 */
  hullWorth: 120,
};

/** 레이저 초당 피해 — **모든 환산의 자** */
export const dpsLaser = () => YARD.laserDmg / YARD.laserReload;

/**
 * ★★★ **스킬 하나가 초당 얼마를 버나** (레이저 dps 환산).
 *
 *   ★ 「한 번 쓰면 버는 것」 ÷ 쿨. 지속인 것(전력 몰기)은 **늘 켜져 있으므로**
 *     그대로 초당 이득이다.
 *   ★★ 값(열·못 쏘는 시간)은 **빼서** 넣는다 — 그래야 「세다」가 「공짜로
 *     세다」와 안 섞인다
 *
 * @returns { gain, cost, net, per } — per 가 **초당 순이득**이다
 */
export function worthOf(key) {
  const k = BY_KEY[key];
  if (!k) return { gain: 0, cost: 0, net: 0, per: 0 };
  const dps = dpsLaser();
  let gain = 0; let cost = 0;
  if (key === 'overdrive') {
    //  버는 것: 3초 동안 배수가 는 몫. 치르는 것: 쏜 열 + 끝나고 얹히는 열을
    //  **식히는 데 걸리는 시간**만큼 못 쏘는 것으로 친다
    const shots = k.sec / YARD.laserReload;
    gain = shots * YARD.laserDmg * (k.dmg - 1);
    //  ★★★ **쏘는 열은 값이 아니다** — 과부하를 안 써도 그 3초를 쏘면 같은
    //    열이 난다. 여기서 그걸 같이 세면 **값을 두 번 물리는 것**이고,
    //    처음에 그렇게 셌다가 「과부하는 쓰면 손해」(초당 −0.178)라는
    //    엉뚱한 답이 나왔다. **과부하가 추가로 지우는 것은 `heat` 하나**다
    cost = (k.heat / YARD.heatFall) * dps;
  } else if (key === 'chaff') {
    //  버는 것: 붙은 적들이 겨눔을 잃어 **한 사이클을 다시 센다**
    gain = YARD.foes * YARD.foeHit * YARD.foeHull * YARD.hullWorth;
    cost = 0;                                   // 값은 통(3발)이지 시간이 아니다
  } else if (key === 'emp') {
    //  버는 것: 반경 안의 적이 `sec` 동안 못 쏜다. 치르는 것: 내 눈이 감긴다
    gain = YARD.foes * (k.sec / YARD.foeEvery) * YARD.foeHit * YARD.foeHull * YARD.hullWorth;
    cost = k.blind * dps;                       // 안 보이는 동안은 못 겨눈다
  } else if (key === 'drift') {
    //  버는 것: 뒤를 잡아 그 자세가 이어지는 동안 피해가 는 몫
    //  ★ 뒤를 무는 시간은 **이 스킬의 값**에서 읽는다 (바깥 가정이 아니다)
    gain = ((k.rear ?? YARD.rearSec) / YARD.laserReload) * YARD.laserDmg * (YARD.rearMult - 1);
    cost = k.sec * dps;                         // 도는 동안 못 쏜다
  } else if (key === 'pips') {
    //  ★ 지속이다 — 무기에 몰면 **같은 열로 더 쏜다.** 열 한 사이클에 는 발수
    const room = YARD.heatMax - YARD.heatStart;
    const was = room / YARD.laserHeat;
    const now = room / (YARD.laserHeat * (1 - k.gain));
    const cycle = room / YARD.heatFall;         // 그 사이클이 도는 데 걸리는 시간
    return {
      gain: +(now - was).toFixed(2), cost: 0,
      net: +(now - was).toFixed(2),
      per: +((now - was) / cycle).toFixed(3),
    };
  }
  const net = gain - cost;
  return {
    gain: +gain.toFixed(2), cost: +cost.toFixed(2), net: +net.toFixed(2),
    per: +(net / Math.max(1, k.cool)).toFixed(3),
  };
}

/** 회차(2시간) 동안 몇 번 쓸 수 있나 — 전투가 회차의 이만큼이라 치고 */
export const usesPerRun = (key, runSec = 7200, fightShare = 0.35) => {
  const k = BY_KEY[key];
  if (!k || k.cool <= 0) return Infinity;
  const n = Math.floor((runSec * fightShare) / k.cool);
  //  ★ 통이 있는 것은 **통이 먼저 바닥난다** — 쿨이 아니라 그쪽이 한계다
  return k.ammo !== undefined ? Math.min(n, k.ammo * 4) : n;
};
