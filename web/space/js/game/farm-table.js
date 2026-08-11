// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **파밍** — 무엇을 부수면 무엇이 나오나 (v110). 숫자만.
//
//  ★ 사장님 (2026-08-11)
//    「파밍은 **더 강한 무기, 더 강한 파츠, 더 강한 장갑, 보급품, 식량** 등을
//      얻을 거야」
//    「기존에 뒤로 가서 냉각을 켠다거나 이런 부분은 **모두 없애줘. 오직
//      전투와 파밍으로** 갈거야」
//
//  ══ 재 보니 **파츠가 한 개도 안 떨어지고 있었다** ═══════════════════════
//
//  v107 에 부위 일곱 · 등급 다섯을 지어 놓고, **떨구는 자리를 안 만들었다.**
//  `SPACE.givePart()` (점검용 구멍)로만 나왔다. 즉 사장님이 제일 먼저
//  말씀하신 「더 강한 무기 · 파츠 · 장갑」이 **표에만 있고 게임에는 없었다.**
//
//  그리고 실제로 떨어지던 것을 세 보니 (회차 하나 · 12구간):
//
//      노획 무기 **108개** · 장갑판 **288개**  ← 둘 다 `loot.weapon/armor` 로
//                                                 들어가는데, v107 이 그 둘을
//                                                 전투력에서 **뺐다**. 죽은 칸이다
//      이산화탄소 흡수통 48개               ← `suitAir` 로 들어간다. 그런데
//                                              v109 이후 **밖에 나갈 일이 없다**
//      질소 · 필터 · 얼음 · 씨앗              ← 소비처가 아예 없어 **안 떨어진다**
//
//  ★★★ 즉 **제일 많이 떨어지던 두 가지가 아무 데도 안 쓰였다.**
//    「소비처 없는 물건을 표에 두지 않는다」는 이 저장소의 규칙을 v107 이
//    반쯤만 지켰다 — 새 자리를 만들면서 **옛 자리를 안 지웠다.**
//
//  ══ ★★★ 그래서 갈래를 **사장님이 말씀하신 다섯**으로 다시 짠다 ═════════
//
//      ① 무기   주포 · 발사관        ┐
//      ② 파츠   엔진 · 센서 · 열저장고 · 화물칸  ├ `parts-table.js` 의 **부위**다
//      ③ 장갑   장갑                ┘  등급이 붙어 나온다 — 그것이 「더 강한」이다
//      ④ 보급품 정비 부품 · 광석 · 아크 전지 · 냉각제
//      ⑤ 식량   식량 팩 · 비상 배급
//
//  ★★ **①②③ 은 화물이 아니다.** 부위 파츠는 격납고 랙에 걸리고
//    (`SPARE_MAX`), 화물칸은 ④⑤ 만 센다. 재는 곳을 하나로 두려는 것이다 —
//    한 물건이 두 곳간에 걸치면 「얼마나 찼나」의 답이 둘이 된다
//
//  ★ three.js 를 안 쓴다 — `tools/space-farm.js` 가 읽는다.
// ══════════════════════════════════════════════════════════════════════════
import { KINDS } from './target-table.js';
import { TIERS, tierIdx } from './parts-table.js';
import { mightOf } from './might-table.js';

/**
 * ★★★ **갈래 다섯** — 사장님 말씀 그대로다.
 *
 *   ★ 옛 갈래는 숨 · 물 · 밥 · 고칠 것 · 싸울 것이었다. 그건 **생존
 *     게임**의 갈래이고, 목적이 「오직 전투와 파밍」으로 바뀌었으므로
 *     갈래도 같이 바뀐다. 갈래만 놔두면 그 갈래가 다시 물건을 불러들인다
 */
export const GROUPS = {
  gun: { key: 'gun', name: '무기', what: '주포 · 발사관 — 더 세게 · 더 넓게 문다', part: true },
  fit: { key: 'fit', name: '파츠', what: '엔진 · 센서 · 열 저장고 · 화물칸', part: true },
  armor: { key: 'armor', name: '장갑', what: '맞아도 덜 닳는다', part: true },
  supply: { key: 'supply', name: '보급품', what: '고치고 · 개조하고 · 도약한다', part: false },
  food: { key: 'food', name: '식량', what: '손이 안 떨린다', part: false },
};
export const GROUP_LIST = Object.values(GROUPS);

/** 부위가 어느 갈래인가 — 사장님이 무기·장갑을 **따로** 말씀하셨다 */
export const GROUP_OF_SLOT = {
  gun: 'gun', tube: 'gun',
  armor: 'armor',
  engine: 'fit', sensor: 'fit', sink: 'fit', hold: 'fit',
};

/**
 * ★★★ **누구에게서 무엇을 뜯나** — 없는 것을 뜯을 수는 없다.
 *
 *   ★ 이것이 「무엇을 골라 부술지」를 만든다. 엔진이 급한데 포함만
 *     보이면 그건 **지금 부술 값이 없다**는 뜻이다.
 *   ★★ 물건(위성 · 연료통)에서도 나온다 — 범례가 「물건: 부수면 재료가
 *     나온다」라고 말해 놓고 안 나오면 그 말이 거짓이 된다
 */
export const SLOT_FROM = {
  raider: ['gun', 'armor', 'engine', 'sensor'],
  fighter: ['engine', 'gun', 'sensor'],
  gunship: ['armor', 'gun', 'tube', 'sink'],
  turret: ['sensor', 'gun', 'armor'],
  convoy: ['hold', 'sink', 'engine'],
  sat: ['sensor'],
  tank: ['sink'],
  // ★ 자폭정 · 파편에는 뜯을 부위가 없다 — 자폭정은 **몸이 탄**이라
  //   부서지면 남는 것이 광석뿐이고, 파편은 원래 남은 것이다
  drone: [],
  junk: [],
};

/**
 * ★★ **파츠가 나올 확률** — 전투력에 붙는다.
 *
 *   ★ 왜 확률인가: 늘 나오면 회차 하나에 부위가 **쉰 개**가 되고, 그러면
 *     I 창이 창고 정리가 된다. 안 나오면 파밍이 아니다. 아래 값은
 *     `tools/space-farm.js` 로 쓸어 보고 골랐다 — 회차 하나에 부위 일곱을
 *     **두 번 채울 만큼**이 나오게
 */
export const PART_DROP = {
  /** 바닥 확률 — 뜯을 부위가 있는 것이면 이만큼은 나온다 */
  base: 0.18,
  /** 전투력 1 당 이만큼 더 (포함 29 → +0.29) */
  perMight: 0.010,
  /** 아무리 세도 이 위로는 안 간다 — 「부수면 무조건 파츠」가 되면 안 된다 */
  cap: 0.52,
};

export function partChance(kind) {
  const list = SLOT_FROM[kind];
  if (!list || !list.length) return 0;
  return +Math.min(PART_DROP.cap,
    PART_DROP.base + mightOf(kind) * PART_DROP.perMight).toFixed(3);
}

/**
 * ★★★ **센 것에서 좋은 등급이 나온다.**
 *
 *   ★ 이것이 「강하면 피한다」(v79)를 **뒤집을 수 있게** 만든다. 피하면
 *     안전하지만 좋은 것이 안 나오고, 붙으면 위험하지만 시제품이 나온다.
 *     그 갈림이 없으면 전투력 표시는 **도망 안내판**일 뿐이다.
 *   ★★ 등급의 바탕 확률은 `parts-table.js TIERS.find` 다 — **여기서 다시
 *     안 적는다.** 여기가 하는 일은 그 확률을 **좋은 쪽으로 미는 것**뿐이다
 */
export const TIER_LIFT = {
  /** 이 아래로는 밀지 않는다 — 잡몹은 **바탕 확률 그대로** */
  floor: 6,
  /** 이 전투력이면 밀기가 최대 (포함 29 · 방공 포대 21.2) */
  at: 30,
  /**
   * ★★★ **몇 번 굴려 좋은 쪽을 쓰나** (센 것일수록 여러 번).
   *
   *   ★ 처음엔 `r ** (1 + lift*pow)` 로 밀었다가 태웠다. 거듭제곱은
   *     **꼭대기를 터뜨린다** — 포함에서 「격추왕의 것」이 **21%** 나왔다
   *     (바탕은 2%). 제일 귀한 것이 열 배로 흔해지면 그건 등급이 아니다.
   *   ★★ 「n 번 굴려 제일 좋은 것」은 **꼭대기가 안 터진다**:
   *     P(격추왕) = 1 − 0.98ⁿ 이라 네 번을 굴려도 8% 다. 반면 「노획품
   *     이상」은 28% → 73% 로 크게 오른다 — **중간이 두꺼워지는** 모양이고,
   *     그게 「센 것을 부수면 쓸 만한 것이 나온다」의 올바른 그림이다
   */
  rolls: 3,
};

/**
 * 좋은 쪽부터의 누적 확률 — 「r 이 작을수록 좋은 것」.
 *
 *   ★ **처음에 `unshift` 로 쌓았다가 태웠다.** 그러면 배열이
 *     `[stock 1.00, field 0.58, …]` 로 **거꾸로** 서고, 아래에서 첫 칸부터
 *     훑으므로 **무엇을 넣어도 표준**이 나온다. 회차 하나를 돌려 보니
 *     스무 개가 다 표준이라 알았다 — 뼈대만 도는 도구가 아니었으면
 *     게임에 넣고 나서야 「등급이 안 오르네」로 만났을 것이다
 */
const CUM = (() => {
  const out = []; let s = 0;
  for (let i = TIERS.length - 1; i >= 0; i--) { s += TIERS[i].find; out.push({ key: TIERS[i].key, upTo: s }); }
  return out; // [ace 0.02, proto 0.10, loot 0.28, field 0.58, stock 1.00]
})();

/**
 * 이 전투력의 적에게서 나오는 등급.
 * @param r 0~1 (검사가 정해서 넣는다 — 표는 난수를 안 만든다)
 */
export function tierRoll(might, r) {
  const { floor, at, rolls } = TIER_LIFT;
  const lift = Math.max(0, Math.min(1, (might - floor) / (at - floor)));
  // ★ 「n 번 굴려 제일 작은 것」을 **한 번의 난수로** 낸다.
  //   균등난수 n 개의 최솟값은 `1 − (1−u)^(1/n)` 이다 — n 이 소수여도 된다
  const n = 1 + rolls * lift;
  const u = Math.max(0, Math.min(1, r));
  const rr = 1 - (1 - u) ** (1 / n);
  for (const c of CUM) if (rr <= c.upTo) return c.key;
  return TIERS[0].key;
}

/**
 * ★★ **어느 부위가 나오나** — 앞에 적힌 것이 잘 나온다.
 *   (첫째가 절반, 나머지가 나눠 갖는다. 「이 적은 이것을 준다」가 읽히게)
 */
export function slotRoll(kind, r) {
  const list = SLOT_FROM[kind] ?? [];
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  const rr = Math.max(0, Math.min(1, r));
  if (rr < 0.5) return list[0];
  const rest = Math.floor(((rr - 0.5) / 0.5) * (list.length - 1));
  return list[Math.min(list.length - 1, 1 + rest)];
}

/**
 * ★★★ 부수면 파츠가 하나 나오나 — **최대 하나다.**
 *
 *   ★ 한 번에 우수수 쏟아지면 그건 파밍이 아니라 청소다. 그리고 회수는
 *     **한 꾸러미에 대한 한 번의 결정**이라야 「줍고 버리고」가 성립한다
 *
 * @param r  0~1 두 개 — 나오나 · 어느 등급인가 (표는 난수를 안 만든다)
 * @returns { slot, tier } · 없으면 null
 */
export function partOf(kind, rDrop = 0, rTier = 0.5, rSlot = 0.25) {
  if (rDrop >= partChance(kind)) return null;
  const slot = slotRoll(kind, rSlot);
  if (!slot) return null;
  return { slot, tier: tierRoll(mightOf(kind), rTier) };
}

/**
 * ★★ **랙 열두 자리.** 여분 파츠는 화물칸이 아니라 여기에 걸린다.
 *
 *   ★ 화물칸으로 같이 세면 「얼마나 찼나」를 재는 곳이 둘이 된다.
 *     그런데 한도가 아예 없으면 「무엇을 버릴까」가 파츠 쪽에는 안 생긴다 —
 *     그래서 곳간을 **둘로 나누고 한도를 각각** 준다
 *   ★★ 넘치면 **제일 낮은 등급**부터 떨어져 나간다. 사람이 고르게 하면
 *     싸우는 중에 창을 열어야 하고, 그건 v109 가 없앤 「뒤로 가서」와
 *     같은 병이다
 */
export const SPARE_MAX = 12;

/** 넘칠 때 무엇을 버리나 — 등급이 낮은 것부터 (같으면 먼저 들어온 것) */
export function overflow(spare = []) {
  if (spare.length <= SPARE_MAX) return [];
  const sorted = spare
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (tierIdx(a.p.tier) - tierIdx(b.p.tier)) || (a.i - b.i));
  return sorted.slice(0, spare.length - SPARE_MAX).map((x) => x.p);
}

/**
 * ★ **접은 것들** — 없애면서 왜 없앴는지를 남긴다.
 *
 *   지우기만 하면 다음에 「생존 아이템이 없네」 하고 **다시 넣게** 된다.
 *   이 저장소는 옛 목적이 주석에 남아 몇 달을 간 적이 있다
 */
export const RETIRED = [
  ['o2', '산소 탱크', 'v109 조종석 고정 — 진공에 나갈 일이 없다'],
  ['scrub', '이산화탄소 흡수통', '같음. 회차마다 48개가 죽은 칸으로 들어가고 있었다'],
  ['n2', '질소 병', '감압이 없어졌다 (고장 계통 · v106)'],
  ['filter', '물 필터', '물 계통을 접었다 — 「오직 전투와 파밍」'],
  ['ice', '얼음 덩어리', '같음. 캐러 내리는 일이 없어졌다'],
  ['seed', '배양조 씨앗', '온실이 없어졌다 (방 여섯 · v109)'],
  ['oru', '교체 유닛', '수리가 단추 하나가 됐다 (v106) — 부품 하나로 합쳤다'],
  ['seal', '밀봉재', '같음'],
  ['wire', '배선 다발', '같음'],
  ['weapon', '노획 무기', '★ 개수를 부위로 갈아엎었다 (v107 「가」). 등급이 대신한다'],
  ['armorPlate', '장갑판', '같음'],
];
