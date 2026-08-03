// 아이템 **표** — 등급 · 기반 · 접사 · 롤 · 합산. **여기엔 그림이 없다.**
//
// ── 왜 갈라 놨는가 ──────────────────────────────────────────
// items.js 는 바닥에 떨어진 아이템의 메시를 만드느라 three 를 끌고 온다.
// 그러면 이 표를 **브라우저 밖에서 읽을 수 없다** — 밸런스를 볼 때마다
// 숫자를 손으로 옮겨 적고, 옮겨 적은 순간 원본과 갈라진다.
// (오늘 `?v=3` 과 `VERSION` 이 두 곳에 있어서 스무 번 배포되는 동안
//  어긋나 있던 것과 같은 실패다. 숫자는 한 곳에만 있어야 한다.)
//
// 그래서 **three 를 안 쓰는 부분만** 이 파일로 옮겼다. items.js 는 이걸
// 다시 내보내므로 부르는 쪽은 한 글자도 안 바뀐다. tools/sim.js 는
// 이 파일을 직접 읽어 **게임과 같은 숫자로** 계산한다.
//
// 설계는 docs/ITEM-ECONOMY.md 를 따른다. 한 문장으로 줄이면
// **가짓수는 늘리고 드랍 빈도는 줄인다.**

import { itemScale } from './growth-table.js';
import { plusMult } from './craft-table.js';
import { tierUnlock } from './economy-table.js';
import { ELEMENTS, ELEMENT_KEYS, WEAPON_ELEMENT_CHANCE, ARMOR_ELEMENT_CHANCE, defenseMult } from './elements.js';

export const RARITIES = [
  { key: 'common', name: '일반',  css: '#b8b8b8', hex: 0xb8b8b8, affixes: 1, mult: 1.00 },
  { key: 'magic',  name: '마법',  css: '#6f9fff', hex: 0x6f9fff, affixes: 2, mult: 1.18 },
  { key: 'rare',   name: '희귀',  css: '#ffd84d', hex: 0xffd84d, affixes: 3, mult: 1.40 },
  { key: 'legend', name: '전설',  css: '#ff8a2b', hex: 0xff8a2b, affixes: 4, mult: 1.75 },
];

/** 등급 기본 분포 (%). 층·티어·find 접사가 위쪽으로 민다. */
const RARITY_W = [55, 30, 12, 3];

/** 장비 슬롯 — 표시 순서이자 종이인형 배치 순서 */
export const SLOTS = ['weapon', 'helm', 'armor', 'gloves', 'belt', 'boots', 'ring', 'amulet'];
export const SLOT_NAME = {
  weapon: '무기', helm: '투구', armor: '갑옷', gloves: '장갑',
  belt: '허리띠', boots: '장화', ring: '반지', amulet: '목걸이',
};

// ─────────────────────── 기반 아이템 ───────────────────────
//
// 무기는 계열마다 **속도·피해 곡선이 다르고, 계열 고유 보너스가 붙는다.**
// 숫자만 큰 상위 호환을 만들면 12종이 아니라 1종을 12단계로 나눈 것에 불과하다.
// 그래서 계열별 초당 피해(dmg 평균 × spd)를 8~11.5 안으로 좁혀 두고,
// 차이를 **고유 보너스** 쪽으로 옮겼다:
//
//   검   균형 (고유 보너스 없음 — 대신 원시 피해가 제일 높다)
//   도끼 느리고 세다
//   둔기 제일 느리다 + 기절
//   대검 느리다 + 사거리 (여러 마리에 닿는다)
//   단검 빠르다 + 치명타
//   지팡이 피해는 낮다 + 쿨감·마나 (스킬로 싸우는 사람용)
//
// lvl 은 **등장 하한**이다. floorNo + tier 가 그 이상이어야 나온다 —
// 1층에서 처형자가 나오면 계열 설계가 무의미해진다.
export const BASES = {
  weapon: [
    { name: '녹슨 검',     icon: '🗡', fam: '검',   lvl: 1, dmg: [6, 11],  spd: 1.00 },
    { name: '장검',        icon: '🗡', fam: '검',   lvl: 2, dmg: [8, 13],  spd: 0.98 },
    { name: '기사의 검',   icon: '🗡', fam: '검',   lvl: 2, dmg: [9, 14],  spd: 0.97 },
    { name: '룬검',        icon: '🗡', fam: '검',   lvl: 3, dmg: [10, 14], spd: 0.96 },
    { name: '강철 도끼',   icon: '🪓', fam: '도끼', lvl: 1, dmg: [9, 14],  spd: 0.86 },
    { name: '전투 도끼',   icon: '🪓', fam: '도끼', lvl: 2, dmg: [10, 16], spd: 0.84 },
    { name: '쌍날 도끼',   icon: '🪓', fam: '도끼', lvl: 3, dmg: [11, 17], spd: 0.82 },
    { name: '사슬 철퇴',   icon: '🔨', fam: '둔기', lvl: 1, dmg: [10, 14], spd: 0.78, base: { stun: 4 } },
    { name: '별철퇴',      icon: '🔨', fam: '둔기', lvl: 2, dmg: [11, 16], spd: 0.74, base: { stun: 6 } },
    { name: '성전 망치',   icon: '🔨', fam: '둔기', lvl: 3, dmg: [12, 18], spd: 0.70, base: { stun: 8 } },
    { name: '흑요석 대검', icon: '⚔',  fam: '대검', lvl: 1, dmg: [12, 16], spd: 0.70, base: { range: 1.40 } },
    { name: '무덤 파쇄기', icon: '⚔',  fam: '대검', lvl: 2, dmg: [13, 18], spd: 0.67, base: { range: 1.70 } },
    { name: '처형자',      icon: '⚔',  fam: '대검', lvl: 3, dmg: [14, 20], spd: 0.64, base: { range: 2.00 } },
    { name: '단검',        icon: '🔪', fam: '단검', lvl: 1, dmg: [4, 7],   spd: 1.45, base: { crit: 5 } },
    { name: '가시 단검',   icon: '🔪', fam: '단검', lvl: 2, dmg: [5, 8],   spd: 1.50, base: { crit: 6 } },
    { name: '독니',        icon: '🔪', fam: '단검', lvl: 2, dmg: [5, 9],   spd: 1.58, base: { crit: 8 } },
    { name: '재의 지팡이', icon: '🪄', fam: '지팡이', lvl: 1, dmg: [7, 10], spd: 0.95, base: { cdr: 7, mp: 20 } },
    { name: '영혼의 홀',   icon: '🪄', fam: '지팡이', lvl: 3, dmg: [8, 12], spd: 0.93, base: { cdr: 10, mp: 32 } },
  ],
  helm: [
    { name: '가죽 두건',   icon: '🧢', lvl: 1, armor: [2, 4] },
    { name: '뼈 투구',     icon: '💀', lvl: 1, armor: [3, 5] },
    { name: '사슬 투구',   icon: '⛑', lvl: 2, armor: [4, 7] },
    { name: '판금 투구',   icon: '🪖', lvl: 3, armor: [7, 11] },
    { name: '대관식 투구', icon: '👑', lvl: 3, armor: [8, 13] },
  ],
  armor: [
    { name: '누비 옷',   icon: '👕', lvl: 1, armor: [2, 5] },
    { name: '가죽 갑옷', icon: '🎽', lvl: 1, armor: [3, 6] },
    { name: '사슬 갑옷', icon: '🥋', lvl: 2, armor: [6, 11] },
    { name: '비늘 갑옷', icon: '🐉', lvl: 2, armor: [7, 12] },
    { name: '판금 갑옷', icon: '🛡', lvl: 3, armor: [10, 17] },
  ],
  gloves: [
    { name: '천 장갑',     icon: '🧤', lvl: 1, armor: [1, 3] },
    { name: '가죽 장갑',   icon: '🧤', lvl: 2, armor: [2, 5] },
    { name: '사슬 손모아', icon: '🤲', lvl: 2, armor: [3, 6] },
    { name: '판금 건틀릿', icon: '🥊', lvl: 3, armor: [4, 8] },
  ],
  belt: [
    { name: '노끈 허리띠', icon: '🪢', lvl: 1, armor: [1, 2] },
    { name: '가죽 허리띠', icon: '🩹', lvl: 1, armor: [2, 4] },
    { name: '사슬 허리띠', icon: '⛓', lvl: 2, armor: [3, 6] },
    { name: '전쟁띠',      icon: '🎗', lvl: 3, armor: [5, 9] },
  ],
  boots: [
    { name: '해진 신',     icon: '🥿', lvl: 1, armor: [1, 3] },
    { name: '가죽 장화',   icon: '👢', lvl: 1, armor: [2, 4] },
    { name: '사슬 장화',   icon: '🥾', lvl: 2, armor: [3, 6] },
    { name: '판금 강철화', icon: '🦿', lvl: 3, armor: [5, 9] },
  ],
  ring: [
    { name: '구리 반지', icon: '💍', lvl: 1, armor: [0, 1] },
    { name: '은 반지',   icon: '💍', lvl: 1, armor: [0, 2] },
    { name: '흑철 반지', icon: '💍', lvl: 2, armor: [1, 3] },
    { name: '영혼 인장', icon: '🔮', lvl: 3, armor: [1, 2] },
  ],
  amulet: [
    { name: '뼈 목걸이',   icon: '📿', lvl: 1, armor: [0, 2] },
    { name: '호박 부적',   icon: '🧿', lvl: 2, armor: [1, 3] },
    { name: '왕관의 조각', icon: '⚜', lvl: 3, armor: [1, 4] },
  ],
};

const PREFIX = ['잔혹한', '고대의', '피에 젖은', '심연의', '불타는', '서리 낀', '왕관의', '망자의', '별빛의'];
const SUFFIX = ['학살', '수호', '탐욕', '광기', '침묵', '여명', '재앙'];

/** 접사 — roll(rnd, s) 은 배율 s(층·등급 보정) 를 받아 값을 굴린다 */
export const AFFIXES = [
  { key: 'dmg',   label: '피해',            fmt: (v) => `+${v} 피해`,            roll: (r, s) => Math.round(r.range(2, 6) * s) },
  { key: 'hp',    label: '최대 체력',       fmt: (v) => `+${v} 최대 체력`,       roll: (r, s) => Math.round(r.range(9, 22) * s) },
  { key: 'armor', label: '방어도',          fmt: (v) => `+${v} 방어도`,          roll: (r, s) => Math.round(r.range(2, 5) * s) },
  { key: 'crit',  label: '치명타 확률',     fmt: (v) => `+${v}% 치명타 확률`,    roll: (r, s) => +(r.range(2, 5.5) * Math.min(2, s)).toFixed(1) },
  { key: 'cdmg',  label: '치명타 피해',     fmt: (v) => `+${v}% 치명타 피해`,    roll: (r, s) => Math.round(r.range(8, 20) * Math.min(2, s)) },
  { key: 'speed', label: '이동 속도',       fmt: (v) => `+${v}% 이동 속도`,      roll: (r, s) => +(r.range(2.5, 6) * Math.min(1.6, s)).toFixed(1) },
  { key: 'aspd',  label: '공격 속도',       fmt: (v) => `+${v}% 공격 속도`,      roll: (r, s) => +(r.range(3, 8) * Math.min(1.6, s)).toFixed(1) },
  { key: 'leech', label: '타격 시 회복',    fmt: (v) => `타격 시 ${v} 회복`,     roll: (r, s) => Math.round(r.range(1, 3) * s) },
  { key: 'mp',    label: '최대 마나',       fmt: (v) => `+${v} 최대 마나`,       roll: (r, s) => Math.round(r.range(6, 14) * s) },
  { key: 'cdr',   label: '재사용 대기시간', fmt: (v) => `-${v}% 재사용 대기시간`, roll: (r, s) => +(r.range(3, 7) * Math.min(1.5, s)).toFixed(1) },

  // ── 아래 여섯은 이 게임에만 있는 축이다 ────────────────────
  // fuel 과 find 는 랜턴 시스템과 드랍 억제라는 두 축에 직접 붙는다.
  // 다른 게임에서 베껴 온 접사가 아니라, 이 게임이 어떤 게임인지 말하는 접사다.
  { key: 'thorns', label: '가시',        fmt: (v) => `피격 시 ${v} 반사`,      roll: (r, s) => Math.round(r.range(2, 5) * s) },
  { key: 'fuel',   label: '연료 최대치', fmt: (v) => `+${v}초 랜턴 연료`,      roll: (r, s) => Math.round(r.range(14, 34) * s) },
  { key: 'find',   label: '보물 감각',   fmt: (v) => `+${v}% 상위 등급 확률`,  roll: (r, s) => Math.round(r.range(6, 15) * Math.min(2, s)) },
  { key: 'stun',   label: '기절',        fmt: (v) => `+${v}% 기절 확률`,       roll: (r, s) => +(r.range(2, 5) * Math.min(1.8, s)).toFixed(1) },
  { key: 'range',  label: '공격 사거리', fmt: (v) => `+${v} 공격 사거리`,      roll: (r, s) => +(r.range(0.1, 0.26) * Math.min(1.5, s)).toFixed(2) },
  { key: 'regen',  label: '체력 재생',   fmt: (v) => `초당 ${v} 회복`,         roll: (r, s) => +(r.range(0.4, 1.1) * s).toFixed(1) },
];
export const AFFIX_BY_KEY = Object.fromEntries(AFFIXES.map((a) => [a.key, a]));

/** 접사 키 전체 — aggregate 의 빈 그릇을 여기서 만든다 (추가할 때 빠뜨리지 않도록) */
const STAT_KEYS = AFFIXES.map((a) => a.key);

/**
 * 슬롯마다 잘 붙는 접사가 다르다. 안 그러면 슬롯을 5개로 늘려도
 * 「아무 데나 아무거나 붙는 칸 5개」일 뿐이라 늘린 의미가 없다.
 * 여기 적힌 것은 가중치 ×4, 나머지는 ×1 로 굴린다.
 */
const SLOT_AFFIX = {
  weapon: ['dmg', 'aspd', 'crit', 'cdmg', 'leech', 'stun', 'range'],
  helm:   ['hp', 'armor', 'mp', 'fuel', 'find'],
  armor:  ['armor', 'hp', 'thorns', 'regen'],
  gloves: ['aspd', 'crit', 'cdmg', 'dmg'],
  belt:   ['hp', 'armor', 'regen', 'thorns'],
  boots:  ['speed', 'armor', 'hp'],
  ring:   ['cdr', 'speed', 'leech', 'mp', 'find', 'fuel'],
  amulet: ['find', 'mp', 'cdr', 'cdmg', 'fuel', 'crit'],
};

let uid = 1;

/** 층·티어·find 를 반영해 등급을 굴린다 */
function rollRarity(rnd, floorNo, tier, find = 0) {
  // 상위 등급 쪽으로 미는 힘. 등급이 한 칸 올라갈 때마다 제곱으로 걸리므로
  // 전설은 층이 깊어질 때 눈에 띄게 늘고, 일반은 자연히 줄어든다.
  // **상한을 둔다.** push 는 등급마다 거듭제곱으로 걸리므로 선형으로 키우면
  // 결과가 지수로 튄다. 층이 셋일 때 9층 push 는 존재하지 않았는데, 아홉 층이
  // 되면 1.8 이 되어 전설 가중치가 3 → 17.5 (5.8배), 실효 확률이 3% → 10.6%
  // 로 뛴다. 「드랍이 억제돼 있어 장비가 바뀌는 순간이 드물다」는 이 파일의
  // 설계 전제가 후반에 무너진다 (정찰에서 잡았다).
  // 회차 해금 — 전설이 잦아지는 것이 회차의 눈에 보이는 보상이다
  const push = Math.min(2.6, (1 + (floorNo - 1) * 0.10 + find / 100) * tierUnlock(tier).legendMul);
  const w = RARITY_W.map((base, i) => base * Math.pow(push, i));
  const total = w.reduce((a, b) => a + b, 0);
  let u = rnd() * total;
  for (let i = 0; i < w.length; i++) { u -= w[i]; if (u <= 0) return i; }
  return 0;
}

/**
 * 아이템 하나를 굴린다.
 * @param rnd     시드 RNG
 * @param floorNo 층 (값 스케일)
 * @param tier    파밍 티어 (반복 회차 — 높을수록 등급이 잘 뜬다)
 * @param opt     { slot, minRarity, find, prefer }
 *                prefer: 착용 중인 슬롯 목록. 60% 확률로 이 중에서 고른다 —
 *                가짓수를 늘리면 무작위 드랍은 쓸모없는 것으로 채워지므로
 *                「내가 쓰는 부위」쪽으로 치우치게 한다 (ITEM-ECONOMY §2-2).
 */
export function rollItem(rnd, floorNo, tier = 0, opt = {}) {
  let slot = opt.slot;
  if (!slot) {
    const prefer = opt.prefer && opt.prefer.length ? opt.prefer : null;
    slot = (prefer && rnd() < 0.6) ? rnd.pick(prefer) : rnd.pick(SLOTS);
  }

  // 등장 하한을 넘긴 기반만. 전부 걸러지면(이론상 없음) 제일 낮은 것으로 떨어진다.
  const depth = floorNo + tier;
  const pool = BASES[slot].filter((b) => (b.lvl ?? 1) <= depth);
  const base = rnd.pick(pool.length ? pool : [BASES[slot][0]]);

  // rarity 는 **덮어쓰기**, minRarity 는 **하한**이다. 둘을 헷갈리면 조용히 샌다 —
  // 갬블이 minRarity 로 등급을 지정했더니 자체 롤과 최댓값을 취해
  // 전설이 설계값 4% 대신 12% 로 나왔다. 실측하지 않았으면 못 봤을 것이다.
  let ri = opt.rarity != null ? opt.rarity : rollRarity(rnd, floorNo, tier, opt.find || 0);
  if (opt.minRarity != null) ri = Math.max(ri, opt.minRarity);
  const rarity = RARITIES[ri];

  const scale = itemScale(floorNo, tier) * rarity.mult;

  const item = {
    id: uid++,
    slot, icon: base.icon,
    rarity: ri,
    ilvl: floorNo + tier,
    fam: base.fam || null,
    stats: {},
    baseStats: {},      // 계열 고유 보너스 — 접사와 구분해서 보여준다
    affixes: [],
    // 강화 단계 (game/craft-table.js). 굴릴 때는 늘 0 이고 대장간이 올린다.
    // **원본 수치는 안 건드린다** — 배수를 따로 두어야 「+7 을 떼고 보면
    // 원래 어땠나」를 언제든 되돌려 볼 수 있고, 재련이 안전해진다.
    plus: 0,
  };

  if (slot === 'weapon') {
    item.dmgMin = Math.max(1, Math.round(base.dmg[0] * scale));
    item.dmgMax = Math.max(item.dmgMin + 1, Math.round(base.dmg[1] * scale));
    item.aspd = base.spd;
  } else {
    item.stats.armor = Math.round(rnd.int(base.armor[0], base.armor[1]) * scale);
  }
  item.baseName = base.name;

  // 계열 고유 보너스는 배율을 안 받는다. 「단검이라서 치명타」는 등급이 아니라
  // 계열의 성질이고, 배율을 먹이면 전설 단검이 치명타 20% 를 달고 나온다.
  if (base.base) {
    for (const [k, v] of Object.entries(base.base)) {
      item.baseStats[k] = v;
      item.stats[k] = (item.stats[k] || 0) + v;
    }
  }

  // 접사 — 슬롯에 맞는 것에 가중치를 준다
  const bias = SLOT_AFFIX[slot] || [];
  const cand = AFFIXES.filter((a) => !(slot === 'weapon' && a.key === 'armor'));
  const bag = [];
  for (const a of cand) {
    const n = bias.includes(a.key) ? 4 : 1;
    for (let i = 0; i < n; i++) bag.push(a);
  }
  rnd.shuffle(bag);
  const used = new Set();
  for (const a of bag) {
    if (item.affixes.length >= rarity.affixes) break;
    if (used.has(a.key)) continue;
    const v = a.roll(rnd, scale);
    if (!v) continue;
    used.add(a.key);
    item.affixes.push({ key: a.key, value: v });
    item.stats[a.key] = (item.stats[a.key] || 0) + v;
  }

  // 속성 — **무기에만**, 마법 등급 이상에만 붙는다.
  // 일반 무기가 「안전한 기본값」으로 남아야 속성이 선택이 된다 (docs/ELEMENTS.md §6-1).
  // ★ **방어구에도 붙는다** (docs/ELEMENTS.md §6-5). 4순환은 같고 배율만 작다.
  //   방어구가 일곱 칸이라 확률을 낮게 둔다 — 무기와 같으면 거의 항상 붙어서
  //   「맞췄다」가 선택이 아니라 기본값이 된다.
  //
  //   ※ 이 변경은 **난수 소비를 늘린다.** 예전에는 무기일 때만 chance() 를
  //     뽑았으므로, 방어구에서 한 번 더 뽑으면 그 뒤 모든 굴림이 밀린다
  //     (드랍·상점·층 지문). 기능상 불가피하고, tools/floor-parity.js 로
  //     무엇이 달라졌는지 확인해 기록한다.
  item.element = 'none';
  const elChance = slot === 'weapon' ? WEAPON_ELEMENT_CHANCE : ARMOR_ELEMENT_CHANCE;
  if (ri >= 1 && rnd.chance(elChance)) {
    item.element = rnd.pick(ELEMENT_KEYS.filter((k) => k !== 'none'));
  }
  // 호출한 쪽이 속성을 지정할 수 있다 — 상점의 「오늘의 물건」이 층별 대항 속성을
  // 놓을 때 쓴다. 확률을 건드리지 않고 결과만 덮어쓴다(minRarity 와 rarity 의
  // 관계와 같다 — 하한과 덮어쓰기를 섞으면 확률이 샌다).
  if (opt.element && slot === 'weapon') item.element = opt.element;

  item.name = ri === 0 ? base.name
    : ri === 1 ? `${rnd.pick(PREFIX)} ${base.name}`
      : `${rnd.pick(PREFIX)} ${base.name}의 ${rnd.pick(SUFFIX)}`;
  // 속성이 붙으면 이름 앞에 표식 — 가방에서 아이콘만 봐도 구분된다
  if (item.element !== 'none') item.name = `${ELEMENTS[item.element].icon} ${item.name}`;

  return item;
}

/** 장비 5칸을 합산해 최종 보너스를 만든다 */
export function aggregate(equipped) {
  const s = Object.fromEntries(STAT_KEYS.map((k) => [k, 0]));
  let dmgMin = 2, dmgMax = 4, wSpd = 1, element = 'none';
  // 방어 속성 — **다수결**이다. 몇 칸이나 같은 속성인지가 세기를 정한다
  // (docs/ELEMENTS.md §6-5). 한 칸만 맞춘 사람과 다 맞춘 사람이 같으면
  // 「모으는 것」이 의미가 없다.
  const tally = {};
  let armorSlots = 0;
  for (const it of Object.values(equipped)) {
    if (!it) continue;
    // 강화 배수는 **여기 한 곳에서만** 곱한다. 굴릴 때 수치에 박아 넣으면
    // 재련이 원본을 못 되돌리고, 두 군데서 곱하면 조용히 두 배가 된다.
    const pm = plusMult(it.plus);
    for (const [k, v] of Object.entries(it.stats)) s[k] = (s[k] || 0) + v * pm;
    if (it.slot === 'weapon') {
      dmgMin = it.dmgMin * pm; dmgMax = it.dmgMax * pm; wSpd = it.aspd;
      element = it.element || 'none';
    } else {
      armorSlots++;
      const e = it.element || 'none';
      if (e !== 'none') tally[e] = (tally[e] || 0) + 1;
    }
  }
  let defElement = 'none', best = 0;
  for (const [k, n] of Object.entries(tally)) if (n > best) { best = n; defElement = k; }
  // 착용한 방어구 칸 수 기준이다. 두 칸만 낀 사람이 그 둘을 맞췄으면
  // 「다 맞춘 것」이 맞다 — 안 낀 칸까지 세면 초반이 영원히 0 이 된다.
  const defCover = armorSlots ? best / armorSlots : 0;
  return { ...s, dmgMin, dmgMax, weaponSpeed: wSpd, element, defElement, defCover };
}

/** 지금 장비로 이 속성 공격을 얼마나 받나 — UI 와 전투가 같은 답을 쓰게 */
export function incomingMult(agg, atkElement) {
  return defenseMult(atkElement, agg.defElement, agg.defCover);
}

/** 대략적인 강함 — 비교 화살표용 */
export function power(item) {
  if (!item) return 0;
  let p = 0;
  if (item.slot === 'weapon') p += (item.dmgMin + item.dmgMax) * 0.5 * (item.aspd || 1) * 3;
  const w = {
    dmg: 3, hp: 0.5, armor: 1.6, crit: 3.2, cdmg: 0.7, speed: 2.4, aspd: 2.6, leech: 3.4, mp: 0.35, cdr: 2.8,
    thorns: 1.1, fuel: 0.4, find: 1.0, stun: 2.2, range: 9, regen: 6,
  };
  for (const [k, v] of Object.entries(item.stats)) p += (w[k] || 1) * v;
  return Math.round(p * plusMult(item.plus));
}

export function affixLine(a) { return AFFIX_BY_KEY[a.key].fmt(a.value); }

/**
 * 화면에 쓰는 이름. 강화했으면 뒤에 `+7` 이 붙는다.
 *
 * **`item.name` 을 직접 고치지 않는다.** 강화할 때마다 이름에 덧붙이면
 * 「+1 +2 +3 검」이 되고, 되돌릴 방법도 없어진다.
 */
export const displayName = (item) => (item?.plus ? `${item.name} +${item.plus}` : (item?.name ?? ''));

/** 강화가 반영된 수치 — 툴팁·비교가 화면에 찍는 값 */
export function shown(item) {
  const m = plusMult(item.plus);
  return {
    dmgMin: Math.round((item.dmgMin ?? 0) * m),
    dmgMax: Math.round((item.dmgMax ?? 0) * m),
    stat: (k) => Math.round((item.stats[k] || 0) * m),
    // **반올림해서 보여 준다.** 강화 배수를 곱하면 「초당 1.488 회복」 같은
    // 값이 나온다 — 계산은 그 값 그대로 하되(정확해야 한다) 화면에는
    // 소수 한 자리까지만. 정수면 소수점을 안 찍는다.
    affix: (a) => {
      const v = a.value * m;
      const r = Math.round(v * 10) / 10;
      return { key: a.key, value: Number.isInteger(r) ? r : r };
    },
  };
}

/** 툴팁 HTML (비교 포함) */
export function tooltipHtml(item, equippedSame) {
  const r = RARITIES[item.rarity];
  const kind = SLOT_NAME[item.slot] || item.slot;
  const sh = shown(item);
  let h = `<div class="tname" style="color:${r.css}">${displayName(item)}</div>`;
  h += `<div class="tkind">${r.name} ${item.fam ? `${item.fam} ` : ''}${kind} · 아이템 레벨 ${item.ilvl}</div>`;
  if (item.slot === 'weapon') {
    h += `<div>피해 <b>${sh.dmgMin}–${sh.dmgMax}</b> · 속도 ${item.aspd.toFixed(2)}</div>`;
    if (item.element && item.element !== 'none') {
      const el = ELEMENTS[item.element];
      h += `<div class="telem" style="color:${el.css}">${el.icon} ${el.name} 속성 — `
        + `${ELEMENTS[el.beats].name}에 강하다</div>`;
    }
  }
  if (item.stats.armor && item.slot !== 'weapon')
    h += `<div>방어도 <b>${sh.stat('armor')}</b></div>`;
  // 방어구 속성 — 무기와 **반대로 읽어야** 한다. 무기는 「무엇을 이기나」,
  // 방어구는 「무엇을 막나」다. 같은 표를 쓰지만 문장이 다르다.
  if (item.slot !== 'weapon' && item.element && item.element !== 'none') {
    const el = ELEMENTS[item.element];
    h += `<div class="telem" style="color:${el.css}">${el.icon} ${el.name} 방어 — `
      + `${ELEMENTS[el.beats].name} 공격을 덜 받는다</div>`;
  }
  // 계열 고유 보너스는 접사와 색을 달리한다 — 「이건 이 무기의 성질이지
  // 운 좋게 붙은 게 아니다」가 읽혀야 계열을 고르는 재미가 생긴다
  for (const [k, v] of Object.entries(item.baseStats || {}))
    h += `<div class="tbase">${AFFIX_BY_KEY[k].fmt(v)}</div>`;
  for (const a of item.affixes) h += `<div class="taff">${affixLine(sh.affix(a))}</div>`;
  if (item.plus) h += `<div class="tplus">강화 +${item.plus} — 수치 ${Math.round(plusMult(item.plus) * 100 - 100)}% 증가</div>`;

  if (equippedSame && equippedSame.id !== item.id) {
    const d = power(item) - power(equippedSame);
    const cls = d > 0 ? 'up' : d < 0 ? 'dn' : '';
    h += `<div class="tcmp">착용 중: ${displayName(equippedSame)}<br>`
      + `종합 <span class="${cls}">${d > 0 ? '▲ +' : d < 0 ? '▼ ' : ''}${d}</span></div>`;
  }
  return h;
}

/**
 * 가격 — 파는 값. 사는 값은 이것의 3.5배다 (ITEM-ECONOMY §4-2).
 * power() 를 그대로 쓰면 무기가 방어구보다 10배 비싸지므로 제곱근으로 눌러
 * 슬롯 사이 격차를 좁힌다.
 */
export function priceOf(item) {
  if (!item) return 0;
  const p = Math.max(1, power(item));
  return Math.max(4, Math.round(Math.sqrt(p) * 7 * (1 + item.rarity * 0.45)));
}
