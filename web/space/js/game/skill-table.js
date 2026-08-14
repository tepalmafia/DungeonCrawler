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
    key: 'chaff', name: '기만체', slot: true, cool: 12, sec: 0.8,
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
    gain: 0.35, lose: 0.2, swap: 1.5,
    why: '쿨이 **없는** 대신 **늘 하나만** 고를 수 있다. 그게 값이다 —'
      + ' 무기에 몰면 센서가 짧아지고, 센서에 몰면 열이 빨리 오른다',
    fx: '계기 막대가 옮겨 붙고 창 테두리 색이 바뀐다',
  },
  {
    key: 'drift', name: '관성 정지', slot: true, cool: 18, sec: 1.2,
    opens: 4, hooks: 'flight', costs: ['fuel', 'time'],
    /** 추진제를 이만큼 태우고, 도는 동안 **못 쏜다** */
    fuel: 14, mute: true, spin: 3.4,
    why: '**제일 「우주다운」 기동**이다 — 공기가 없으니 기수와 진행 방향이'
      + ' 따로 논다. 뒤를 잡힌 채로 **기수만 돌려 쏘고 다시 도망**갈 수 있고,'
      + ' 그러면 v137 의 어스펙트(뒤가 아프다)가 **양쪽으로** 성립한다',
    fx: '별이 옆으로 흐르는데 기수는 딴 데를 본다 (v144 속도감이 그대로 산다)',
  },
  {
    key: 'overdrive', name: '과부하', slot: true, cool: 25, sec: 3,
    opens: 6, hooks: 'laser', costs: ['heat'],
    /** 레이저 피해 배수 · 끝나면 이만큼 열이 얹힌다 (과열) */
    dmg: 3, heat: 38,
    why: '레이저는 **탄이 무한이고 열이 값**이다 (v141). 그 저울을 잠깐 크게'
      + ' 기울인다 — 포함(맷집 22)을 12초 → 5초에 깎지만, 끝나면 과열이라'
      + ' **한동안 못 숨는다**',
    fx: '총열이 하얗게 달아오르고 빔이 굵어진다',
  },
  {
    key: 'emp', name: 'EMP 방출', slot: true, cool: 30, sec: 4,
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
  /** 효과 하나가 화면에 머무는 최대 (초) — EMP 고리만 예외 */
  maxSec: 0.6,
  /** 전투 원뿔 — 이 안쪽은 **안 덮는다** (`screen-table.js CONE` 과 같은 값) */
  cone: 0.45,
};

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
  return { ok: true, key, sec: k.sec, fx: k.fx, fuel: k.fuel ?? 0 };
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
  return done;
}

/** 지금 도는 중인가 */
export const isLive = (st, key) => (st?.live?.[key] ?? 0) > 0;

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
