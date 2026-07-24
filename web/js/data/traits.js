// 특성 30종 — 태그(스탯/화염/번개/흡혈/수호/독)로 서로 시너지가 나도록 설계.
// 기획안 규칙: 모든 고유 특성은 최소 2개 이상의 다른 특성과 상호작용해야 한다.
const TRAITS = [
  // ── 스탯 (max 회까지 중복 획득 가능 — 곱연산 특성은 낮게, 덧셈 특성은 넉넉하게) ──
  { id: 'atk',     name: '힘 단련',   tag: '스탯', color: '#e8e0cf', stack: true, max: 8,
    desc: '공격력 +1', apply: (p) => { p.bonusAtk += 1; } },
  { id: 'aspd',    name: '신속',      tag: '스탯', color: '#e8e0cf', stack: true, max: 4,
    desc: '공격 속도 +14%', apply: (p) => { p.atkCdMul *= 0.86; } },
  { id: 'mov',     name: '질풍',      tag: '스탯', color: '#e8e0cf', stack: true, max: 4,
    desc: '이동 속도 +12%', apply: (p) => { p.speed *= 1.12; } },
  { id: 'hp',      name: '강골',      tag: '스탯', color: '#e8e0cf', stack: true, max: 6,
    desc: '최대 HP +1, 즉시 1 회복', apply: (p) => { p.maxHp += 1; p.hp = Math.min(p.maxHp, p.hp + 1); } },
  { id: 'crit',    name: '급소 간파', tag: '스탯', color: '#f7b32b', stack: true, max: 6,
    desc: '크리티컬 확률 +10%', apply: (p) => { p.critChance += 0.10; } },
  { id: 'critdmg', name: '파괴자',    tag: '스탯', color: '#f7b32b', stack: true, max: 5,
    desc: '크리티컬 피해 +50%', apply: (p) => { p.critMul += 0.5; } },
  { id: 'range',   name: '장검술',    tag: '스탯', color: '#e8e0cf', stack: true, max: 4,
    desc: '공격 범위 +18%', apply: (p) => { p.rangeMul *= 1.18; } },
  { id: 'combo',   name: '콤보 마스터', tag: '스탯', color: '#f7b32b', stack: true, max: 3,
    desc: '3연격 마무리 피해 +50%', apply: (p) => { p.comboLv += 1; } },
  { id: 'dashcd',  name: '바람걸음',  tag: '스탯', color: '#e8e0cf', stack: true, max: 3,
    desc: '대시 충전 속도 +25%', apply: (p) => { p.dashRegenMul *= 0.75; } },
  { id: 'magnet',  name: '탐욕',      tag: '스탯', color: '#2ec4b6', stack: true, max: 3,
    desc: 'XP 획득 +15%, 흡인 범위 +80%', apply: (p) => { p.xpMul *= 1.15; p.magnetMul *= 1.8; } },
  { id: 'luck',    name: '행운',      tag: '스탯', color: '#f7b32b', stack: true, max: 2,
    desc: '크리티컬 +5%, 하트 드랍 확률 2배', apply: (p) => { p.critChance += 0.05; p.luckMul *= 2; } },
  { id: 'regen',   name: '회복력',    tag: '스탯', color: '#e43b44',
    desc: '방 클리어 시 HP 1 회복', flag: 'regen' },
  { id: 'berserk', name: '광전사',    tag: '스탯', color: '#e43b44',
    desc: 'HP 2 이하일 때 공격력 +1, 공격 속도 +30%', flag: 'berserk' },

  // ── 화염 시너지 ──
  { id: 'ignite',   name: '점화',      tag: '화염', color: '#ff7043',
    desc: '공격 시 25% 확률로 적을 점화 (지속 피해)', flag: 'ignite' },
  { id: 'burnboom', name: '화상 폭발', tag: '화염', color: '#ff7043',
    desc: '화상 중인 적이 죽으면 폭발해 주변에 2 피해', flag: 'burnboom' },
  { id: 'firecrit', name: '발화점',    tag: '화염', color: '#ff7043',
    desc: '화상 중인 적에게는 크리티컬 확정', flag: 'firecrit' },
  { id: 'inferno',  name: '겁화',      tag: '화염', color: '#ff7043',
    desc: '화상 지속시간과 피해 간격이 2배 빨라진다', flag: 'inferno' },

  // ── 번개 시너지 ──
  { id: 'shocktrail', name: '잔전류',   tag: '번개', color: '#ffd866',
    desc: '대시 경로에 감전 장판을 남긴다 (피해 + 감속)', flag: 'shocktrail' },
  { id: 'overcharge', name: '과충전',   tag: '번개', color: '#ffd866',
    desc: '감전된 적을 처치하면 대시 충전 즉시 회복', flag: 'overcharge' },
  { id: 'chain',      name: '연쇄 번개', tag: '번개', color: '#ffd866',
    desc: '공격 시 20% 확률로 번개가 근처 적에게 튄다 (2 피해 + 감전)', flag: 'chain' },
  { id: 'static',     name: '정전기',   tag: '번개', color: '#ffd866',
    desc: '감전된 적에게 주는 피해 +1', flag: 'static' },

  // ── 흡혈 시너지 ──
  { id: 'lifesteal', name: '흡혈',      tag: '흡혈', color: '#e43b44',
    desc: '크리티컬 시 HP 1 회복 (4초에 한 번)', flag: 'lifesteal' },
  { id: 'bloodpact', name: '피의 계약', tag: '흡혈', color: '#e43b44',
    desc: 'HP가 가득 찼을 때 공격력 +2', flag: 'bloodpact' },
  { id: 'bloodlust', name: '피의 갈증', tag: '흡혈', color: '#e43b44',
    desc: '처치 시 12% 확률로 하트가 떨어진다', flag: 'bloodlust' },

  // ── 수호 시너지 ──
  { id: 'thorns', name: '가시 갑옷',   tag: '수호', color: '#5ce0e6',
    desc: '피격 시 주변 적에게 2 피해와 넉백', flag: 'thorns' },
  { id: 'shield', name: '수호의 문장', tag: '수호', color: '#5ce0e6',
    desc: '8초마다 보호막 생성 — 다음 피해를 1회 막는다', flag: 'shield' },
  { id: 'ram',    name: '돌파',        tag: '수호', color: '#5ce0e6',
    desc: '대시로 적을 통과하면 1 피해와 넉백', flag: 'ram' },

  // ── 독 시너지 ──
  { id: 'poison',  name: '독날',   tag: '독', color: '#6ab04c',
    desc: '공격 시 30% 확률로 중독 (4초간 지속 피해)', flag: 'poison' },
  { id: 'corrode', name: '부식',   tag: '독', color: '#6ab04c',
    desc: '중독된 적에게 주는 피해 +1', flag: 'corrode' },
  { id: 'plague',  name: '역병',   tag: '독', color: '#6ab04c',
    desc: '중독된 적이 죽으면 독구름을 남긴다 (적에게 지속 피해)', flag: 'plague' },

  // ── 직업 전용 (해당 직업에게만 카드로 등장) ──
  { id: 'kn_spin_cd', name: '회전 가속', tag: '검사', color: '#4a6ede', cls: 'knight', stack: true, max: 3,
    desc: '회전 베기 쿨다운 -30%', apply: (p) => { p.skillCdMul *= 0.7; } },
  { id: 'kn_wave', name: '검기 방출', tag: '검사', color: '#4a6ede', cls: 'knight',
    desc: '회전 베기가 검기 8발을 사방으로 방출한다', flag: 'kn_wave' },
  { id: 'kn_blood', name: '피의 회전', tag: '검사', color: '#4a6ede', cls: 'knight',
    desc: '회전 베기로 3마리 이상 적중 시 HP 1 회복', flag: 'kn_blood' },

  { id: 'ar_rain_cd', name: '신속 장전', tag: '궁수', color: '#38b764', cls: 'archer', stack: true, max: 3,
    desc: '화살비 쿨다운 -30%', apply: (p) => { p.skillCdMul *= 0.7; } },
  { id: 'ar_explo', name: '폭발 화살비', tag: '궁수', color: '#38b764', cls: 'archer',
    desc: '화살비의 화살이 착탄 시 폭발한다', flag: 'ar_explo' },
  { id: 'ar_double', name: '이중 사격', tag: '궁수', color: '#38b764', cls: 'archer',
    desc: '기본 공격이 화살 2발을 부채꼴로 쏜다', flag: 'ar_double' },

  { id: 'mg_meteor3', name: '유성우', tag: '마도사', color: '#8a5ac2', cls: 'mage',
    desc: '메테오가 3개 떨어진다', flag: 'mg_meteor3' },
  { id: 'mg_fireball', name: '파이어볼', tag: '마도사', color: '#8a5ac2', cls: 'mage',
    desc: '기본 마탄이 관통 화염구가 되어 착탄 시 폭발한다', flag: 'mg_fireball' },
  { id: 'mg_ash', name: '잿불 지대', tag: '마도사', color: '#8a5ac2', cls: 'mage',
    desc: '메테오 자리에 불타는 지대가 남는다 (적 지속 피해)', flag: 'mg_ash' },
];

// 레벨업 카드 뽑기 — 이미 가진 고유(flag) 특성은 제외.
// 태그 시너지 가중치: 보유한 태그의 특성이 더 자주 등장한다 (트리를 "판다"는
// 플레이 성립 — 보스 기믹의 정답 트리를 연구해 완성할 수 있게 지원).
function rollTraitCards(player, n = 3) {
  // 직업 전용 특성은 해당 직업에게만, 상한(max) 도달한 특성은 제외
  const countOf = (id) => player.traits.filter((x) => x === id).length;
  const pool = TRAITS.filter((t) =>
    (!t.flag || !player.flags[t.flag]) &&
    (!t.cls || t.cls === player.classId) &&
    (!t.max || countOf(t.id) < t.max));
  const tagCount = {};
  for (const id of player.traits) {
    const tr = TRAITS.find((x) => x.id === id);
    if (tr) tagCount[tr.tag] = (tagCount[tr.tag] || 0) + 1;
  }
  const weightOf = (t) =>
    (1 + 0.7 * (tagCount[t.tag] || 0) * (t.tag === '스탯' ? 0.2 : 1)) * (t.cls ? 1.5 : 1);

  const cards = [];
  const avail = [...pool];
  while (cards.length < n && avail.length > 0) {
    let total = 0;
    for (const t of avail) total += weightOf(t);
    let roll = Math.random() * total;
    let idx = 0;
    for (; idx < avail.length - 1; idx++) {
      roll -= weightOf(avail[idx]);
      if (roll <= 0) break;
    }
    cards.push(avail.splice(idx, 1)[0]);
  }
  return cards;
}

function applyTrait(player, trait) {
  if (trait.apply) trait.apply(player);
  if (trait.flag) player.flags[trait.flag] = true;
  player.traits.push(trait.id);
}
