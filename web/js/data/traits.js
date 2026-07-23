// 특성 12종 — 기획안 원칙: 태그(화염/번개/흡혈/수호)로 서로 시너지가 나도록 설계
const TRAITS = [
  // ── 스탯 강화 (중복 획득 가능) ──
  { id: 'atk',      name: '힘 단련',   tag: '스탯', color: '#e8e0cf', stack: true,
    desc: '공격력 +1', apply: (p) => { p.bonusAtk += 1; } },
  { id: 'aspd',     name: '신속',      tag: '스탯', color: '#e8e0cf', stack: true,
    desc: '공격 속도 +14%', apply: (p) => { p.atkCdMul *= 0.86; } },
  { id: 'mov',      name: '질풍',      tag: '스탯', color: '#e8e0cf', stack: true,
    desc: '이동 속도 +12%', apply: (p) => { p.speed *= 1.12; } },
  { id: 'hp',       name: '강골',      tag: '스탯', color: '#e8e0cf', stack: true,
    desc: '최대 HP +1, 즉시 1 회복', apply: (p) => { p.maxHp += 1; p.hp = Math.min(p.maxHp, p.hp + 1); } },
  { id: 'crit',     name: '급소 간파', tag: '스탯', color: '#f7b32b', stack: true,
    desc: '크리티컬 확률 +10%', apply: (p) => { p.critChance += 0.10; } },
  { id: 'critdmg',  name: '파괴자',    tag: '스탯', color: '#f7b32b', stack: true,
    desc: '크리티컬 피해 +50%', apply: (p) => { p.critMul += 0.5; } },

  // ── 화염 시너지 ──
  { id: 'ignite',   name: '점화',      tag: '화염', color: '#ff7043',
    desc: '공격 시 25% 확률로 적을 점화 (2초간 지속 피해)', flag: 'ignite' },
  { id: 'burnboom', name: '화상 폭발', tag: '화염', color: '#ff7043',
    desc: '화상 중인 적이 죽으면 폭발해 주변에 2 피해', flag: 'burnboom' },

  // ── 번개 시너지 ──
  { id: 'shocktrail', name: '잔전류',  tag: '번개', color: '#ffd866',
    desc: '대시 경로에 감전 장판을 남긴다 (피해 + 감속)', flag: 'shocktrail' },
  { id: 'overcharge', name: '과충전',  tag: '번개', color: '#ffd866',
    desc: '감전된 적을 처치하면 대시 쿨다운 초기화', flag: 'overcharge' },

  // ── 흡혈 / 수호 ──
  { id: 'lifesteal', name: '흡혈',     tag: '흡혈', color: '#e43b44',
    desc: '크리티컬 시 HP 1 회복 (4초에 한 번)', flag: 'lifesteal' },
  { id: 'thorns',    name: '가시 갑옷', tag: '수호', color: '#5ce0e6',
    desc: '피격 시 주변 적에게 2 피해와 넉백', flag: 'thorns' },
];

// 레벨업 카드 3장 뽑기 — 이미 가진 고유(flag) 특성은 제외
function rollTraitCards(player, n = 3) {
  const pool = TRAITS.filter((t) => !t.flag || !player.flags[t.flag]);
  const cards = [];
  const used = new Set();
  while (cards.length < n && used.size < pool.length) {
    const t = pool[Math.floor(Math.random() * pool.length)];
    if (used.has(t.id)) continue;
    used.add(t.id);
    cards.push(t);
  }
  return cards;
}

function applyTrait(player, trait) {
  if (trait.apply) trait.apply(player);
  if (trait.flag) player.flags[trait.flag] = true;
  player.traits.push(trait.id);
}
