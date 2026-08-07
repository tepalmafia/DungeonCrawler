// ══════════════════════════════════════════════════════════════════════════
//  ★★★ 조종석 전투 — **레이더 · 락온 · 미사일** (v64 · 사장님 요청)
//
//  ★ 사장님: 「주포도 없애고 공격은 조정석에서 다 이루어질 수 있도록 해줘.
//             공격하는건 기존 전투기들 전투 데이터를 참고해서 전체적으로
//             만들어줘. 레이더, 미사일, 락온 등」
//
//  ══ 먼저 밝혀 둘 것 — **내가 「안 한다」고 적어 뒀던 것이다** ══════════
//
//    `CHASE2.md §5` 에 이렇게 적혀 있다:
//      | 안 한다 | 왜 |
//      | **미사일·함포** | 정비공이 아니라 함장이 된다 |
//
//    v44 에 주포로 한 번 뒤집혔고, v64 에 레이더·미사일까지 왔다.
//    **걱정이 사라지는 것은 아니다.** 그래서 이 표는 걱정을 숫자로 붙든다:
//    아래 `GENRE` 가 「조종석에 매인 시간」의 안전핀이고, 도구가 그걸 잰다.
//
//  ══ ★★ 고증 — 실제 전투기가 어떻게 싸우나 ═══════════════════════════
//
//   ① **레이더는 원뿔이다.** F-16 급 기수 레이더가 방위 ±60° · 고도 ±60°
//      쯤을 훑는다. 원뿔 밖은 **아예 안 보인다** — 그래서 「어디를 향하고
//      있나」가 곧 「무엇을 볼 수 있나」다.
//
//   ② **탐색 → 추적 → 락온.** 훑기만 하면 「뭔가 있다」까지고, 한 놈에
//      **묶어 두면**(STT) 거리·속도가 정확해지고 유도탄을 쏠 수 있다.
//      묶는 데 시간이 들고, **원뿔 밖으로 나가면 깨진다.**
//
//   ③ ★★★ **레이더를 켜면 상대가 그걸 안다** (RWR · 레이더 경보 수신기).
//      이게 이 게임에 **그대로 들어맞는다** — 우리 「자국」이 정확히 RWR 이
//      하는 일이다. 실제 조종사가 「언제 켜고 언제 끄나」로 싸우는 것이
//      우리가 v58 에 만든 「능동 탐지를 켜면 접촉 기준을 넘긴다」와 같다.
//      **새 개념을 안 만들고 이미 있는 축에 얹는다.**
//
//   ④ **발사 봉투(launch envelope).** 미사일은 아무 데서나 못 쏜다 —
//      너무 멀면 연료가 모자라 못 닿고(R_max), 너무 가까우면 신관이
//      안 서서 그냥 지나간다(R_min). 조준경에 「사거리」가 뜨는 이유다.
//
//   ⑤ **열추적 vs 유도.** 열추적(IR)은 **쏘고 잊는다** — 대신 가깝고
//      잘 놓친다. 반능동 유도(SARH)는 **락온을 끝까지 유지**해야 하고,
//      유지한다는 것은 **레이더를 켠 채로 있다**는 뜻이다.
//      → 이 대비가 이 게임의 축과 정확히 겹친다:
//        **가까이 붙어 조용히** vs **멀리서 밝게.**
//
//   ⑥ **기총은 선도(lead)를 준다.** 탄이 날아가는 데 시간이 걸리므로
//      표적이 가는 쪽 앞을 쏜다. 사거리는 1~2km 로 아주 짧다.
//
//  ★ three.js 를 안 쓴다 — tools/space-combat.js 가 브라우저 없이 읽는다.
// ══════════════════════════════════════════════════════════════════════════
import { TARGET } from './target-table.js';

/**
 * 레이더 — **켜면 보이고, 켜면 보인다.**
 *
 * ★ 두 번째 「보인다」가 이 계통의 전부다. 자국은 `chase-table.js SIGN.sensor`
 *   가 이미 들고 있고 (v58 에 5 → 20 으로 올렸다), 여기서 **다시 안 적는다** —
 *   두 곳에 적으면 반드시 갈라진다.
 */
export const RADAR = {
  /**
   * 원뿔 (도). **표적이 뜨는 범위(`TARGET.azLimit` 62 · `elLimit` 34)보다
   * 넓다** — 좁으면 「화면에 보이는데 레이더에 없는」 것이 생기고, 그건
   * 계기가 거짓말하는 것이다
   */
  az: 66,
  el: 40,
  /** 탐지 거리 (m). 표적이 나는 거리(90~220)보다 멀어야 「먼저 본다」가 된다 */
  range: 260,

  /**
   * ★ **묶는 데 걸리는 초.** 0 이면 락온이 아니라 그냥 조준이다.
   *   2.6 초는 「조준선에 올려 두고 하나 세는」 길이 — 지나가는 것을
   *   따라가며 붙들어야 하므로 손이 논다는 느낌이 안 난다
   */
  lockFor: 2.6,
  /** 묶으려면 조준선이 이 안에 있어야 한다 (도) */
  lockCone: 9,
  /**
   * ★ 묶은 뒤 벗어나도 이만큼은 버틴다 (초). 0 이면 손이 한 번 떨릴 때마다
   *   깨져서 **묶는 것이 벌이 된다** — 실제 레이더도 잠깐의 이탈은 외삽한다
   */
  holdGrace: 1.1,
  /** 이보다 멀어지면 묶여 있어도 놓친다 */
  breakRange: 300,
};

/**
 * ★★ 무기 셋 — **하나가 다른 둘을 못 대신해야** 고르는 것이 된다.
 *
 * | | 락온 | 사거리 | 값 | 대신 |
 * |---|---|---|---|---|
 * | 기총 | 필요 없다 | 아주 짧다 | 싸다 | 선도를 줘야 맞는다 |
 * | 열추적 | 필요 없다 | 중간 | 부품 1 | 잘 놓친다 |
 * | 유도 | **끝까지 유지** | 길다 | 부품 2 | **그동안 레이더가 켜져 있다** |
 *
 * ★ 마지막 칸이 이 표의 요점이다. 제일 센 무기가 **제일 밝다.**
 */
export const WEAPONS = {
  cannon: {
    key: 'cannon', name: '기총', slot: 1,
    needLock: false,
    /** 사거리 (m) — 실제 항공 기총이 1~2km 다. 여기서는 표적 거리에 맞춘다 */
    rMin: 0, rMax: 70,
    /** 맞히려면 이 각도 안 (도). `target-table.js aimTol` 과 같은 자 */
    tol: 4.2,
    /** ★ **탄이 날아가는 시간**이 있으므로 가는 쪽 앞을 쏴야 한다 (선도) */
    lead: true,
    speed: 220,
    /** 한 발에 드는 것 — **탄약이 곧 수리 재료다** (v44 규약) */
    cost: { ore: 6, parts: 0 },
    /** 쏘고 다시 쏘기까지 */
    reload: 0.55,
    /** 맞으면 깎는 맷집 */
    dmg: 1,
    /** 쏘면 자국이 이만큼 (초 동안 남는다) */
    sign: 10, signFor: 8,
    what: '싸고 빠르다. 대신 붙어야 하고 앞을 쏴야 한다',
  },
  ir: {
    key: 'ir', name: '열추적탄', slot: 2,
    needLock: false,
    /**
     * ★ **R_min 이 0 이 아니다.** 너무 가까우면 신관이 안 선다 —
     *   실제 미사일의 최소 사거리가 바로 이것이고, 「붙었으면 기총」이라는
     *   갈림이 여기서 생긴다
     */
    rMin: 25, rMax: 120,
    tol: 11,
    lead: false,
    speed: 95,
    cost: { ore: 0, parts: 1 },
    reload: 4.0,
    dmg: 3,
    /** ★ **쏘고 잊는다** — 날아가는 동안 아무것도 안 해도 된다 */
    fireForget: true,
    /** 맞을 확률 (거리에 따라 깎인다) */
    pk: 0.74,
    sign: 22, signFor: 14,
    what: '쏘고 잊는다. 대신 가깝고 잘 놓친다',
  },
  arh: {
    key: 'arh', name: '유도탄', slot: 3,
    /** ★★ **락온이 있어야 쏜다** */
    needLock: true,
    rMin: 45, rMax: 240,
    tol: 14,
    lead: false,
    speed: 140,
    cost: { ore: 0, parts: 2 },
    reload: 6.5,
    dmg: 5,
    /**
     * ★★ **날아가는 동안 락온을 유지해야 한다.** 깨지면 미사일이 길을
     *   잃는다 — 그리고 유지한다는 것은 **레이더를 켠 채로 있다**는 뜻이다.
     *   제일 센 무기가 제일 밝다: 이 표에서 제일 중요한 한 줄
     */
    fireForget: false,
    pk: 0.92,
    sign: 30, signFor: 20,
    what: '멀리 간다. 대신 끝까지 묶고 있어야 하고, 그동안 훤히 보인다',
  },
};

/** 슬롯 번호로 (1·2·3 키) */
export const BY_SLOT = Object.fromEntries(Object.values(WEAPONS).map((w) => [w.slot, w]));
export const WEAPON_LIST = Object.values(WEAPONS).sort((a, b) => a.slot - b.slot);

/**
 * ★★ **장르 안전핀** — 넘으면 정비공이 아니라 전투기 조종사다.
 *
 *   `FLYING.md` 가 조종석에 15% 를 걸어 뒀고 (`space-fly.js`),
 *   `gun-table.js` 가 포탑에 12% 를 걸어 뒀다. 주포를 없애고 둘을
 *   조종석 하나로 합쳤으므로 **안전핀도 하나**여야 한다.
 *
 *   ★ 22% 는 두 값을 그냥 더한 것이 아니다 — 15 + 12 = 27 이면 회차의
 *     4분의 1 이 넘고, 그건 「가는 동안 고친다」가 아니라 「싸우다 가끔
 *     고친다」다. 합치면서 **줄인다**
 */
export const GENRE = {
  seatShareMax: 0.22,
  /** 한 회차에 이보다 많이 싸우면 그것도 장르가 바뀐 것이다 */
  fightsMax: 14,
};

/** 왜 못 쏘나 — **조용히 안 나가면 「고장났다」로 읽힌다** */
export const WHY = {
  ammo: '실을 것이 없습니다',
  reload: '재는 중입니다',
  lock: '묶어야 쏩니다 — 레이더를 켜고 겨눕니다',
  far: '너무 멉니다',
  near: '너무 가깝습니다 — 기총을 씁니다',
  none: '겨눈 것이 없습니다',
  radar: '레이더가 꺼져 있습니다',
};

/**
 * 이 무기를 지금 쏠 수 있나.
 * @param s.weapon 무기 · s.target 겨눈 것(없으면 null) · s.locked 묶여 있나
 * @param s.supply 보급 · s.cool 남은 재는 시간 · s.radar 레이더가 켜졌나
 */
export function whyNotFire(s = {}) {
  const w = s.weapon;
  if (!w) return 'none';
  const sup = s.supply ?? {};
  if ((w.cost.ore ?? 0) > (sup.ore ?? 0) || (w.cost.parts ?? 0) > (sup.parts ?? 0)) return 'ammo';
  if ((s.cool ?? 0) > 0) return 'reload';
  if (!s.target) return 'none';
  if (w.needLock && !s.radar) return 'radar';
  if (w.needLock && !s.locked) return 'lock';
  if (s.target.dist > w.rMax) return 'far';
  if (s.target.dist < w.rMin) return 'near';
  return null;
}

/** 발사 봉투 안인가 — 조준경이 「사거리」를 이걸로 띄운다 */
export const inEnvelope = (w, dist) => dist >= w.rMin && dist <= w.rMax;

/**
 * 맞을 확률 — **봉투의 끝으로 갈수록 떨어진다.**
 * 실제로도 R_max 근처에서 미사일은 에너지가 없어 잘 못 맞힌다.
 */
export function hitChance(w, dist) {
  if (!inEnvelope(w, dist)) return 0;
  const mid = (w.rMin + w.rMax) / 2;
  const half = (w.rMax - w.rMin) / 2;
  const off = Math.abs(dist - mid) / half;          // 0 가운데 · 1 끝
  return (w.pk ?? 1) * (1 - 0.45 * off * off);
}

/** 사람에게 — **숫자로 안 띄운다** */
export function lockWord(l) {
  if (!l.on) return '레이더 꺼짐';
  if (l.locked) return '묶었습니다';
  if (l.t > 0) return '묶는 중';
  return '탐색 중';
}

/** 겨눈 것이 원뿔 안인가 */
export const inCone = (az, el) =>
  Math.abs(az) <= RADAR.az && Math.abs(el) <= RADAR.el;

/** 표적이 뜨는 범위가 레이더 원뿔 안에 들어오나 — 어긋나면 계기가 거짓말한다 */
export const coneCoversSky = () =>
  RADAR.az >= TARGET.azLimit && RADAR.el >= TARGET.elLimit;
