// 유물 20종 — 등급별 드랍 (기획안 §7: 커먼 60 / 레어 27 / 에픽 10 / 레전더리 3%).
// 레전더리는 수치 강화가 아니라 게임 규칙을 바꾼다.
const RARITY = {
  common:    { label: '커먼',     color: '#e8e0cf', weight: 60 },
  rare:      { label: '레어',     color: '#5c9ded', weight: 27 },
  epic:      { label: '에픽',     color: '#b13ae0', weight: 10 },
  legendary: { label: '레전더리', color: '#f7b32b', weight: 3 },
};

const RELICS = [
  // ── 커먼 ──
  { id: 'oldsword',  rarity: 'common', name: '낡은 검',
    desc: '공격력 +1', apply: (p) => { p.bonusAtk += 1; } },
  { id: 'boots',     rarity: 'common', name: '가죽 장화',
    desc: '이동 속도 +10%', apply: (p) => { p.speed *= 1.10; } },
  { id: 'heartbit',  rarity: 'common', name: '심장 조각',
    desc: '최대 HP +1, 즉시 1 회복', apply: (p) => { p.maxHp += 1; p.hp = Math.min(p.maxHp, p.hp + 1); } },
  { id: 'whetstone', rarity: 'common', name: '숫돌',
    desc: '크리티컬 확률 +7%', apply: (p) => { p.critChance += 0.07; } },
  { id: 'feather',   rarity: 'common', name: '깃털 장식',
    desc: '대시 충전 속도 +15%', apply: (p) => { p.dashRegenMul *= 0.85; } },
  { id: 'crystal',   rarity: 'common', name: '수정 조각',
    desc: 'XP 획득 +15%', apply: (p) => { p.xpMul *= 1.15; } },
  { id: 'coin',      rarity: 'common', name: '행운의 동전',
    desc: '하트 드랍 확률 +80%', apply: (p) => { p.luckMul *= 1.8; } },

  // ── 레어 ──
  { id: 'greaves',   rarity: 'rare', name: '사냥꾼의 각반',
    desc: '대시 직후 첫 공격은 크리티컬 확정', flag: 'dashcrit' },
  { id: 'greatsword', rarity: 'rare', name: '무거운 대검',
    desc: '공격력 +2, 공격 속도 -10%', apply: (p) => { p.bonusAtk += 2; p.atkCdMul *= 1.1; } },
  { id: 'fang',      rarity: 'rare', name: '흡혈 송곳니',
    desc: '처치 시 8% 확률로 HP 1 회복', flag: 'fang' },
  { id: 'bombbag',   rarity: 'rare', name: '폭탄 주머니',
    desc: '처치 시 15% 확률로 폭발 (주변 2 피해)', flag: 'bomb' },
  { id: 'spikeshield', rarity: 'rare', name: '가시 방패',
    desc: '피격 시 주변 적에게 2 피해', flag: 'spikeshield' },
  { id: 'agirune',   rarity: 'rare', name: '민첩의 룬',
    desc: '공격 속도 +15%', apply: (p) => { p.atkCdMul *= 0.85; } },

  // ── 에픽 ──
  { id: 'berserkhelm', rarity: 'epic', name: '광전사의 투구',
    desc: 'HP 3 이하일 때 공격력 +3', flag: 'berserkhelm' },
  { id: 'timesand',  rarity: 'epic', name: '시간의 모래',
    desc: '대시를 2회 연속 사용할 수 있다', apply: (p) => { p.dashMax = 2; } },
  { id: 'phoenix',   rarity: 'epic', name: '불사조 깃털',
    desc: '죽음에 이르는 피해를 받으면 1회 부활 (HP 3)', flag: 'revive' },
  { id: 'magnetglove', rarity: 'epic', name: '자석 장갑',
    desc: 'XP와 하트를 방 전체에서 끌어당긴다', flag: 'magnetall' },

  // ── 레전더리 (규칙 변경) ──
  { id: 'glasssword', rarity: 'legendary', name: '유리 대검',
    desc: '모든 공격이 크리티컬. 대신 최대 HP -2',
    apply: (p) => { p.maxHp = Math.max(1, p.maxHp - 2); p.hp = Math.min(p.hp, p.maxHp); },
    flag: 'allcrit' },
  { id: 'engine',    rarity: 'legendary', name: '폭주 기관',
    desc: '대시 쿨다운이 사라진다. 대신 이동 속도 -25%',
    apply: (p) => { p.speed *= 0.75; }, flag: 'engine' },
  { id: 'kingseal',  rarity: 'legendary', name: '왕의 인장',
    desc: '레벨업 선택지가 4장이 되고, 즉시 특성 1개를 얻는다', flag: 'kingseal' },
];

// 등급 가중치 추첨. bossRoll=true면 상위 등급 확률 대폭 상승 (보스 보상)
function rollRelicRarity(bossRoll = false) {
  const weights = bossRoll
    ? { common: 25, rare: 42, epic: 25, legendary: 8 }
    : { common: 60, rare: 27, epic: 10, legendary: 3 };
  let total = 0;
  for (const k of Object.keys(weights)) total += weights[k];
  let roll = Math.random() * total;
  for (const k of Object.keys(weights)) {
    roll -= weights[k];
    if (roll <= 0) return k;
  }
  return 'common';
}

// 미보유 유물 중에서 뽑기. 원하는 등급이 소진되면 아래 등급으로 대체.
function rollRelics(player, n, bossRoll = false) {
  const owned = new Set(player.relics);
  const pool = RELICS.filter((r) => !owned.has(r.id));
  const out = [];
  const order = ['legendary', 'epic', 'rare', 'common'];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const want = rollRelicRarity(bossRoll);
    let candidates = pool.filter((r) => r.rarity === want && !out.includes(r));
    if (candidates.length === 0) {
      for (const rar of order.slice(order.indexOf(want))) {
        candidates = pool.filter((r) => r.rarity === rar && !out.includes(r));
        if (candidates.length > 0) break;
      }
    }
    if (candidates.length === 0) {
      candidates = pool.filter((r) => !out.includes(r));
    }
    if (candidates.length === 0) break;
    out.push(candidates[Math.floor(Math.random() * candidates.length)]);
  }
  return out;
}

function applyRelic(player, relic) {
  if (relic.apply) relic.apply(player);
  if (relic.flag) player.rflags[relic.flag] = true;
  player.relics.push(relic.id);
}
