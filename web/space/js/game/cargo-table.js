// ══════════════════════════════════════════════════════════════════════════
//  ★★★ 화물 — **무엇을 싣고 무엇을 버리나** (v83)
//
//  ★ 사장님 「어떤 아이템들을 획득하고 필요한지 아이템 리스트를 **스토리에
//    맞게** 기획해줘. **우주에서 생존에 필요한 것들은 … 데이터 기준으로**」
//
//  ★★ 기획서는 `docs/space/ITEMS.md` 다. 여기는 **그 기획의 표**이고,
//    자료(NASA·ESA)에서 가져온 값이 근거다:
//
//      산소 **0.89 kg/일** · 물 **3.8 L/일**(회수율 98%) · 식량 **1.8 kg/일**
//      합계 4.3 kg/인/일 · 보급선 화물의 **36.4% 가 정비용**
//
//  ★★★ **규칙 하나 — 아이템마다 「없으면 무엇이 막히나」가 하나씩 있어야
//    한다.** 없으면 그건 아이템이 아니라 점수다.
//
//  ★ 그래서 `use` 칸이 있다: **이 아이템을 회수하면 배의 무엇이 늘어나나.**
//    `use` 가 없는 것은 **아직 안 떨어진다** (`dropsNow` 가 false). 소비처
//    없는 물건을 떨구면 그건 「설계에는 있는데 게임에는 없다」이고,
//    이 저장소는 그것을 `space-story.js` 로 소리 내어 센다.
//
//  ★ three.js 를 안 쓴다.
// ══════════════════════════════════════════════════════════════════════════

/** ★★ 무게 등급 다섯 — 숫자를 흩어 놓지 않으려고 등급으로 쓴다 */
export const MASS = { tiny: 1, light: 2, mid: 4, heavy: 8, huge: 20 };

/**
 * ★★★ **화물칸 100 짐.**
 *
 *   탄두 재료가 다섯 × 20 = **100** 이다. **다 모으면 화물칸이 꽉 찬다** —
 *   목적에 가까워질수록 **다른 것을 못 싣는다.** 마지막 구간이 저절로
 *   조여지도록 숫자를 그렇게 맞췄다. 그리고 이것이 **버리는 결심**을
 *   만든다: 산소 탱크를 버리고 노심을 실을 것인가
 */
export const HOLD = 100;

/** 갈래 다섯 — `story-table.js` 의 **줄기**에 하나씩 붙는다 */
export const GROUPS = {
  air: { name: '숨', thread: 'worn' },
  water: { name: '물', thread: 'hungry' },
  food: { name: '밥', thread: 'hungry' },
  fix: { name: '고칠 것', thread: 'worn' },
  war: { name: '싸울 것', thread: 'hunted' },
};

/**
 * ★★★ **열여섯.** 방이 일곱, 가르침이 일곱, 줄기가 넷인 것과 같은 이유 —
 *   사람이 **한 화면에서 훑을 수 있는 수**.
 *
 * @property use  **배의 무엇으로 들어가나** — 없으면 아직 안 떨어진다
 * @property need 없으면 무엇이 막히나
 * @property from 어디서 나오나 (foe · junk · dig · port)
 */
export const ITEMS = {
  // ── ① 숨 ────────────────────────────────────────────────
  o2: {
    key: 'o2', group: 'air', name: '산소 탱크', mass: 'heavy', from: ['foe', 'port'],
    use: { suitAir: 150 },
    need: '우주복 공기를 못 채운다 — 진공에 못 나간다',
    why: '82kg 우주인이 하루 0.89 kg 을 쓴다',
  },
  scrub: {
    key: 'scrub', group: 'air', name: '이산화탄소 흡수통', mass: 'light', from: ['foe', 'junk'],
    use: { suitAir: 60 },
    need: '방 공기가 나빠진다 — **산소가 있어도** 죽는다',
    why: '사람을 죽이는 것은 모자란 산소가 아니라 못 내보낸 이산화탄소다 (아폴로 13)',
  },
  n2: {
    key: 'n2', group: 'air', name: '질소 병', mass: 'heavy', from: ['port'],
    need: '감압된 방을 다시 못 채운다',
    why: '공기의 78% 는 질소다 — v84 에 감압과 물린다',
  },
  // ── ② 물 ────────────────────────────────────────────────
  filter: {
    key: 'filter', group: 'water', name: '물 필터', mass: 'light', from: ['foe', 'junk', 'port'],
    need: '회수율이 떨어진다 — 물이 줄기 시작한다',
    why: '98% 를 되돌리므로 실제로 드는 것은 물이 아니라 필터다 — v84',
  },
  ice: {
    key: 'ice', group: 'water', name: '얼음 덩어리', mass: 'heavy', from: ['dig'],
    need: '(필터가 없을 때의 비상 수단)',
    why: '실제 ISRU 의 첫 목표가 얼음이다 — v84',
  },
  // ── ③ 밥 ────────────────────────────────────────────────
  meal: {
    key: 'meal', group: 'food', name: '식량 팩', mass: 'mid', from: ['foe', 'port'],
    use: { food: 26 },
    need: '손이 떨린다 — 수리가 미끄러진다',
    why: '하루 1.8 kg (포장 포함). 포장이 15%',
  },
  seed: {
    key: 'seed', group: 'food', name: '배양조 씨앗', mass: 'tiny', from: ['port', 'junk'],
    need: '배양조가 안 돈다 — 식량이 안 늘어난다',
    why: '장기 임무의 유일한 답이 재배다 — v84 (온실)',
  },
  ration: {
    key: 'ration', group: 'food', name: '비상 배급', mass: 'tiny', from: ['foe', 'junk'],
    use: { food: 9 },
    need: '(굶주림을 잠깐 막는다)',
    why: '안 먹고 남기는 몫이 10% — 비상용은 따로 센다',
  },
  // ── ④ 고칠 것 ──────────────────────────────────────────
  oru: {
    key: 'oru', group: 'fix', name: '교체 유닛', mass: 'heavy', from: ['foe', 'junk'],
    use: { parts: 3 },
    need: '큰 고장을 못 고친다 (반응로 · 자세 제어)',
    why: '보급선 화물의 36.4% 가 정비용이다',
  },
  seal: {
    key: 'seal', group: 'fix', name: '밀봉재', mass: 'tiny', from: ['foe', 'junk', 'dig', 'port'],
    use: { parts: 1 },
    need: '감압을 못 막는다 (선체 균열)',
    why: '제일 흔하고 제일 가볍다 — 늘 들고 다니게',
  },
  wire: {
    key: 'wire', group: 'fix', name: '배선 다발', mass: 'tiny', from: ['foe', 'junk'],
    use: { parts: 1 },
    need: '정전을 못 되돌린다 (차단기)',
    why: '',
  },
  coolant: {
    key: 'coolant', group: 'fix', name: '냉각제', mass: 'mid', from: ['dig', 'port', 'foe'],
    use: { sink: -18 },
    need: '열이 안 내려간다 — 라디에이터가 헛돈다',
    why: '열 저장고를 한 번에 덜어 준다 (v58 과 물린다)',
  },
  // ── ⑤ 싸울 것 · 목적 ───────────────────────────────────
  weapon: {
    key: 'weapon', group: 'war', name: '노획 무기', mass: 'mid', from: ['foe'],
    use: { lootWeapon: 1 },
    need: '전투력이 안 오른다',
    why: '쏘는 적에게서만 나온다 — 없는 것을 뜯을 수는 없다',
  },
  armor: {
    key: 'armor', group: 'war', name: '장갑판', mass: 'heavy', from: ['foe'],
    use: { lootArmor: 1 },
    need: '전투력이 안 오른다 · 잘 깨진다',
    why: '두꺼운 적에게서 더 나온다',
  },
  ore: {
    key: 'ore', group: 'war', name: '광석', mass: 'mid', from: ['foe', 'junk', 'dig'],
    use: { ore: 22 },
    need: '거점에서 아무것도 못 산다',
    why: '이 배의 돈이다 (이미 있는 계통)',
  },
  /**
   * ★★★ **아크 전지 — 적에게서만 나온다.**
   *   거점에서 살 수 있으면 「싸워야 얻고 · 얻어야 뛰고 · 뛰어야 다음 싸움을
   *   고른다」는 고리가 끊어진다 (`WAR.md §14-3`). v84 의 광속 이동이 태운다
   */
  arc: {
    key: 'arc', group: 'war', name: '아크 전지', mass: 'mid', from: ['foe'],
    need: '광속 이동을 못 한다',
    why: '적의 것을 뜯어야만 나온다 — 거점에서 안 판다. v84',
  },
};

export const ITEM_LIST = Object.values(ITEMS);

/**
 * ★★ **지금 떨어지는 것** — `use` 가 있는 것만.
 *
 *   소비처 없는 물건을 떨구면 그건 **점수**이지 아이템이 아니고,
 *   「설계에는 있는데 게임에는 없다」가 된다. 표에는 열여섯이 다 있고
 *   (기획이 잊히지 않게), **떨어지는 것은 그중 소비처가 선 것**이다
 */
export const dropsNow = (key) => !!ITEMS[key]?.use;
export const DROPPING = ITEM_LIST.filter((i) => i.use);

export const massOf = (key) => MASS[ITEMS[key]?.mass] ?? 0;
export const nameOf = (key) => ITEMS[key]?.name ?? key;

/** 어디서 나오나 — **네 곳이 서로 다른 것**을 준다 */
export const fromWhere = (where) => DROPPING.filter((i) => i.from.includes(where));

/**
 * ★★ **회수 방법 셋** (사장님 「회수를 누르면 **도킹을 하던지 로봇을
 *   보내던지**」).
 *
 *   ★ 그물 하나만 있으면 「주우려면 도망 못 친다」가 늘 같은 무게라
 *     결심이 하나뿐이다. 셋이면 셋이 된다 — **거리 · 빠르기 · 묶임**을
 *     서로 다르게 판다
 */
export const WAYS = {
  arm: {
    key: 'arm', name: '도킹 팔', kb: 'KeyF',
    // ★ 1.2초 — **그물보다 확실히 빨라야** 한다. 처음에 2.0 으로 뒀더니
    //   20m 에서 그물이 1.43초라 **팔을 쓸 이유가 없었다.** 바짝 붙는
    //   값을 치르게 해 놓고 이득이 없으면 그건 선택이 아니다
    reach: 25, speed: null, fixed: 1.2, holds: true, sign: 2,
    what: '제일 빠르다. 대신 **바짝 붙어야** 한다 — 들이받힐 자리다',
  },
  net: {
    key: 'net', name: '그물', kb: 'KeyG',
    reach: 80, speed: 14, fixed: null, holds: true, sign: 6,
    what: '거리는 넉넉하다. 감는 동안 **못 나아간다**',
  },
  bot: {
    // ★★ v85 — **T 에서 B 로 옮겼다.** T 는 이 장르에서 **표적 지정**의
    //   자리다 (Elite · Star Citizen · Freelancer). 회수는 몇 초에 한 번
    //   쓰지만 표적 지정은 **싸우는 내내** 쓰므로, 부딪히면 자주 쓰는
    //   쪽이 정석 자리를 갖는 것이 맞다. B 는 bot 의 머리글자다
    key: 'bot', name: '회수 로봇', kb: 'KeyB',
    reach: 160, speed: null, fixed: 12.0, holds: false, sign: 4,
    what: '**안 묶인다** — 대신 느리다',
  },
};
export const WAY_LIST = Object.values(WAYS);

/** 이 방법으로 이 거리를 회수하는 데 걸리는 시간 (초). 못 닿으면 null */
export function timeOf(wayKey, dist) {
  const w = WAYS[wayKey];
  if (!w || dist > w.reach) return null;
  return w.fixed ?? +(dist / w.speed).toFixed(2);
}

/** 사람이 읽는 한 줄 — 화물칸이 얼마나 찼나 */
export function holdWord(used) {
  const k = used / HOLD;
  if (k >= 1) return '꽉 찼습니다';
  if (k > 0.85) return '거의 찼습니다';
  if (k > 0.6) return '반 넘게';
  return '자리가 있습니다';
}

export const WHY = {
  full: '화물칸이 꽉 찼습니다 — 무언가를 버려야 합니다',
  none: '실을 것이 없습니다',
};
