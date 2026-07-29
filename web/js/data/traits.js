// 특성 30종 — 태그(스탯/화염/번개/흡혈/수호/독)로 서로 시너지가 나도록 설계.
// 기획안 규칙: 모든 고유 특성은 최소 2개 이상의 다른 특성과 상호작용해야 한다.
const TRAITS = [
  // ── 스탯 (max 회까지 중복 획득 가능 — 곱연산 특성은 낮게, 덧셈 특성은 넉넉하게) ──
  { id: 'atk',     name: '힘 단련',   tag: '스탯', color: '#e8e0cf', stack: true, max: 3, peak: 'atkPeak',
    desc: '공격력 +1 · 3장이면 「완력의 정점」 — 타격이 적을 두 배로 밀어낸다', apply: (p) => { p.bonusAtk += 1; } },
  { id: 'aspd',    name: '신속',      tag: '스탯', color: '#e8e0cf', stack: true, max: 2,
    desc: '공격 속도 +14%', apply: (p) => { p.atkCdMul *= 0.86; } },
  { id: 'mov',     name: '질풍',      tag: '스탯', color: '#e8e0cf', stack: true, max: 2,
    desc: '이동 속도 +12%', apply: (p) => { p.speed *= 1.12; } },
  { id: 'hp',      name: '강골',      tag: '스탯', color: '#e8e0cf', stack: true, max: 3, peak: 'hpPeak',
    desc: '최대 HP +1, 즉시 1 회복 · 3장이면 「불굴」 — 런당 1회, 치명상을 버틴다', apply: (p) => { p.maxHp += 1; p.hp = Math.min(p.maxHp, p.hp + 1); } },
  { id: 'crit',    name: '급소 간파', tag: '스탯', color: '#f7b32b', stack: true, max: 3, peak: 'critPeak',
    desc: '크리티컬 확률 +10% · 3장이면 「간파의 정점」 — 크리티컬이 적의 다음 접촉 예고를 지운다', apply: (p) => { p.critChance += 0.10; } },
  { id: 'critdmg', name: '파괴자',    tag: '스탯', color: '#f7b32b', stack: true, max: 2,
    desc: '크리티컬 피해 +50%', apply: (p) => { p.critMul += 0.5; } },
  { id: 'range',   name: '장검술',    tag: '스탯', color: '#e8e0cf', stack: true, max: 2,
    desc: '공격 범위 +18%', apply: (p) => { p.rangeMul *= 1.18; } },
  { id: 'combo',   name: '콤보 마스터', tag: '스탯', color: '#f7b32b', stack: true, max: 2,
    desc: '3연격 마무리 피해 +50%', apply: (p) => { p.comboLv += 1; } },
  { id: 'dashcd',  name: '바람걸음',  tag: '스탯', color: '#e8e0cf', stack: true, max: 2, peak: 'dashPeak',
    desc: '대시 충전 속도 +25% · 2장이면 「바람의 정점」 — 완벽 회피 시 대시가 즉시 1충전', apply: (p) => { p.dashRegenMul *= 0.75; } },
  { id: 'magnet',  name: '탐욕',      tag: '스탯', color: '#2ec4b6', stack: true, max: 1,
    desc: 'XP 획득 +15%, 흡인 범위 +80%', apply: (p) => { p.xpMul *= 1.15; p.magnetMul *= 1.8; } },
  { id: 'luck', unlock: { stat: 'totalKills', n: 1000, label: '누적 1000킬' },    name: '행운',      tag: '스탯', color: '#f7b32b', stack: true, max: 1,
    desc: '크리티컬 +5%, 하트 드랍 확률 2배', apply: (p) => { p.critChance += 0.05; p.luckMul *= 2; } },
  { id: 'regen',   name: '회복력',    tag: '스탯', color: '#e43b44',
    desc: '방 클리어 시 HP 1 회복', flag: 'regen' },
  { id: 'berserk', unlock: { stat: 'runs', n: 5, label: '5회 도전' }, name: '광전사',    tag: '스탯', color: '#e43b44',
    desc: 'HP 2 이하일 때 공격력 +1, 공격 속도 +30%', flag: 'berserk' },

  // ── 화염 시너지 ──
  { id: 'ignite',   name: '점화',      tag: '화염', color: '#ff7043',
    desc: '공격 시 25% 확률로 적을 점화 (지속 피해)', flag: 'ignite' },
  { id: 'burnboom', name: '화상 폭발', tag: '화염', color: '#ff7043',
    desc: '화상 중인 적이 죽으면 폭발해 주변에 2 피해', flag: 'burnboom' },
  { id: 'firecrit', name: '발화점',    tag: '화염', color: '#ff7043',
    desc: '화상 중인 적에게는 크리티컬 확정', flag: 'firecrit' },
  { id: 'inferno', unlock: { stat: 'bestFloor', n: 2, label: '2층 도달' },  name: '겁화',      tag: '화염', color: '#ff7043',
    desc: '화상 지속시간과 피해 간격이 2배 빨라진다', flag: 'inferno' },

  // ── 번개 시너지 ──
  { id: 'shocktrail', name: '잔전류',   tag: '번개', color: '#ffd866',
    desc: '대시 경로에 감전 장판을 남긴다 (피해 + 감속)', flag: 'shocktrail' },
  { id: 'overcharge', unlock: { stat: 'bestFloor', n: 4, label: '4층 도달' }, name: '과충전',   tag: '번개', color: '#ffd866',
    desc: '감전된 적을 처치하면 대시 충전 즉시 회복 (2초에 1회)', flag: 'overcharge' },
  // ── 동사 특성 (P3): 숫자가 아니라 행동의 모양을 바꾼다 ──
  { id: 'quake', unlock: { stat: 'bestFloor', n: 3, label: '3층 도달' },    name: '지진파',    tag: '스탯', color: '#c8d4e4',
    desc: '마무리 일격이 전방으로 관통 충격파를 쏜다', flag: 'quake' },
  { id: 'rebound', unlock: { stat: 'totalKills', n: 500, label: '누적 500킬' },  name: '도탄',      tag: '스탯', color: '#ffd866',
    desc: '화살과 마탄이 벽에서 한 번 튕긴다', flag: 'rebound' },
  { id: 'dashfire', unlock: { stat: 'bestFloor', n: 5, label: '5층 도달' }, name: '불꽃 대시', tag: '화염', color: '#ff7043',
    desc: '대시가 불타는 자취를 남긴다 (적 지속 피해)', flag: 'dashfire' },
  { id: 'chain',      name: '연쇄 번개', tag: '번개', color: '#ffd866',
    desc: '공격 시 30% 확률로 번개가 근처 적에게 튄다 (2 피해 + 감전)', flag: 'chain' },
  { id: 'static', unlock: { stat: 'totalKills', n: 300, label: '누적 300킬' },     name: '정전기',   tag: '번개', color: '#ffd866',
    desc: '감전된 적에게 주는 피해 +2', flag: 'static' },

  // ── 흡혈 시너지 ──
  { id: 'lifesteal', name: '흡혈',      tag: '흡혈', color: '#e43b44',
    desc: '크리티컬 시 HP 1 회복 (4초에 한 번)', flag: 'lifesteal' },
  { id: 'bloodpact', name: '피의 계약', tag: '흡혈', color: '#e43b44',
    desc: 'HP가 가득 찼을 때 공격력 +1', flag: 'bloodpact' },
  { id: 'bloodlust', unlock: { stat: 'totalKills', n: 800, label: '누적 800킬' }, name: '피의 갈증', tag: '흡혈', color: '#e43b44',
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
  { id: 'plague', unlock: { stat: 'runs', n: 3, label: '3회 도전' },  name: '역병',   tag: '독', color: '#6ab04c',
    desc: '중독된 적이 죽으면 독구름을 남긴다 (적에게 지속 피해)', flag: 'plague' },

  // ── 직업 전용 (해당 직업에게만 카드로 등장) ──
  { id: 'kn_spin_cd', name: '선회 가속', tag: '검사', color: '#4a6ede', cls: 'knight', stack: true, max: 3,
    desc: '참수 선회 쿨다운 -30%', apply: (p) => { p.skillCdMul *= 0.7; } },
  { id: 'kn_wave', name: '검기 방출', tag: '검사', color: '#4a6ede', cls: 'knight',
    desc: '참수 선회가 검기 8발을 사방으로 방출한다', flag: 'kn_wave' },
  { id: 'kn_blood', name: '피의 회전', tag: '검사', color: '#4a6ede', cls: 'knight',
    desc: '참수 선회로 3마리 이상 적중 시 HP 1 회복', flag: 'kn_blood' },

  { id: 'ar_rain_cd', name: '신속 장전', tag: '궁수', color: '#38b764', cls: 'archer', stack: true, max: 3,
    desc: '뼈화살 비 쿨다운 -30%', apply: (p) => { p.skillCdMul *= 0.7; } },
  { id: 'ar_explo', name: '폭발 뼈화살', tag: '궁수', color: '#38b764', cls: 'archer',
    desc: '뼈화살 비의 화살이 착탄 시 폭발한다', flag: 'ar_explo' },
  { id: 'ar_double', name: '이중 사격', tag: '궁수', color: '#38b764', cls: 'archer',
    desc: '기본 공격이 화살 2발을 부채꼴로 쏜다', flag: 'ar_double' },

  { id: 'mg_meteor3', name: '유성우', tag: '마도사', color: '#8a5ac2', cls: 'mage',
    desc: '별의 심판이 3개 떨어진다', flag: 'mg_meteor3' },
  { id: 'mg_fireball', name: '파이어볼', tag: '마도사', color: '#8a5ac2', cls: 'mage',
    desc: '기본 마탄이 관통 화염구가 되어 착탄 시 폭발한다', flag: 'mg_fireball' },
  { id: 'mg_ash', name: '잿불 지대', tag: '마도사', color: '#8a5ac2', cls: 'mage',
    desc: '별의 심판 자리에 불타는 지대가 남는다 (적 지속 피해)', flag: 'mg_ash' },
  // ── 직업 심화 (P4): 직업당 5종 — 검사/궁수/마도사 런이 서로 다른 빌드가 되도록 ──
  { id: 'kn_slam', name: '강철 파쇄', tag: '검사', color: '#4a6ede', cls: 'knight',
    desc: '벽 충돌 강타 피해 2→5, 더 약한 넉백에도 발동', flag: 'slammaster' },
  { id: 'kn_guardcrit', name: '기사도', tag: '검사', color: '#4a6ede', cls: 'knight',
    desc: '보호막이 피해를 막으면 다음 일격이 확정 크리티컬', flag: 'guardcrit' },
  { id: 'ar_focus', name: '사냥꾼의 호흡', tag: '궁수', color: '#38b764', cls: 'archer',
    desc: '대시 후 1.5초간 공격 속도 +30%', flag: 'hunterstep' },
  { id: 'ar_power', name: '중력 시위', tag: '궁수', color: '#38b764', cls: 'archer',
    desc: '3발째 강화 화살의 위력이 한 단계 더 강해진다', flag: 'bowmaster' },
  { id: 'mg_cdr', name: '과부하 회로', tag: '마도사', color: '#8a5ac2', cls: 'mage', stack: true, max: 2,
    desc: '스킬 쿨다운 -15%', apply: (p) => { p.skillCdMul *= 0.85; } },
  { id: 'mg_ward', name: '마력 장막', tag: '마도사', color: '#8a5ac2', cls: 'mage',
    desc: '스킬 시전 순간 0.6초 무적', flag: 'mgward' },
  // ── 연금술사 (4직업 — 반응 특화) ──
  { id: 'al_cd', name: '증류 가속', tag: '연금', color: '#c9d94a', cls: 'alch', stack: true, max: 3,
    desc: '독배 쿨다운 -30%', apply: (p) => { p.skillCdMul *= 0.7; } },
  { id: 'al_radius', name: '증폭 용액', tag: '연금', color: '#c9d94a', cls: 'alch', stack: true, max: 2,
    desc: '플라스크·독배 폭발 반경 +25%', apply: (p) => { p.flaskRadMul = Math.min(2.0, (p.flaskRadMul || 1) * 1.25); } }, // 상한 ×2 — 무한 중첩이 화면을 덮었다
  { id: 'al_double', name: '쌍병 투척', tag: '연금', color: '#c9d94a', cls: 'alch',
    desc: '투척 20% 확률로 2연투', flag: 'al_double' },
  { id: 'al_acid', name: '농축 산', tag: '연금', color: '#c9d94a', cls: 'alch',
    desc: '중독 지속 +2초 (플라스크·독배)', flag: 'al_acid' },
  { id: 'al_react', name: '연쇄 촉진', tag: '연금', color: '#c9d94a', cls: 'alch',
    desc: '과부하 폭발 반경·마비 지속 +30%', flag: 'al_react' },

  // ── 공격 변형 (S2) — 기본 공격의 리듬 자체를 바꾼다: 런 정체성의 축 ──
  { id: 'kn_greatsword', name: '대검화', tag: '검사', color: '#f7b32b', cls: 'knight',
    unlock: { stat: 'bestFloor', n: 4, label: '4층 도달' },
    desc: '공격이 무거워진다 — 속도 ×0.55, 피해 ×2.2, 범위 +45%', flag: 'greatsword',
    apply: (p) => { p.rangeMul *= 1.45; p.atkCdMul *= 1.8; } },
  { id: 'ar_twinbow', name: '쌍궁', tag: '궁수', color: '#f7b32b', cls: 'archer',
    unlock: { stat: 'bestFloor', n: 4, label: '4층 도달' },
    desc: '화살을 2발 부채꼴로 — 공격 속도 -35% (이중 사격과 중첩 시 4발)', flag: 'twinbow',
    apply: (p) => { p.atkCdMul *= 1.55; } },
  { id: 'mg_snipe', name: '직격 마탄', tag: '마도사', color: '#f7b32b', cls: 'mage',
    unlock: { stat: 'bestFloor', n: 4, label: '4층 도달' },
    desc: '유도를 버리고 직사한다 — 탄속 2배, 모든 마탄이 착탄 폭발', flag: 'mgsnipe' },
  { id: 'al_catalyst', name: '촉매 폭탄', tag: '연금', color: '#f7b32b', cls: 'alch',
    unlock: { stat: 'bestFloor', n: 4, label: '4층 도달' },
    desc: '탄속 -15%, 착탄마다 무작위 원소(화상/중독/감전) — 혼자서 반응을 제조한다', flag: 'al_catalyst' },

  // ── 전설 (극저확률 — 규칙을 부수는 카드. "미쳐 날뛰는 런"의 씨앗) ──
  { id: 'unbound',   name: '무한의 갈망', tag: '전설', color: '#ffd866', legend: true,
    desc: '스탯 특성의 중첩 상한이 사라진다', flag: 'unbound' },
  { id: 'timeflux', unlock: { stat: 'bestFloor', n: 6, label: '6층 도달' },  name: '시간 왜곡',   tag: '전설', color: '#ffd866', legend: true,
    desc: '스킬 쿨다운이 60% 짧아진다', apply: (p) => { p.skillCdMul *= 0.4; } },
  { id: 'glasssoul', unlock: { stat: 'totalKills', n: 2000, label: '누적 2000킬' }, name: '유리 영혼',   tag: '전설', color: '#ffd866', legend: true,
    desc: '공격력 +3, 최대 HP -2', apply: (p) => {
      p.bonusAtk += 3;
      p.maxHp = Math.max(1, p.maxHp - 2);
      p.hp = Math.min(p.hp, p.maxHp);
    } },
  { id: 'monarch', unlock: { stat: 'wins', n: 1, label: '첫 복수' },   name: '왕의 권능',   tag: '전설', color: '#ffd866', legend: true,
    desc: '처치 시 5% 확률로 영혼 폭발 (주변에 3 피해)', flag: 'monarch' },

  // ── 희귀 (v151 "특성이 단조롭다"): 수치 채우기가 아니라 결정이 되는 카드 ──
  // 양날 — 힘에는 값이 있다
  { id: 'bloodprice', rare: true, name: '핏값', tag: '희귀', color: '#c9b8e8',
    desc: '공격력 +2 — 대신 피격마다 골드 8을 흘린다', flag: 'bloodprice', apply: (p) => { p.bonusAtk += 2; } },
  // v157: v151 희귀 14종 중 **유일하게 flag도 max도 없어** 무한 중첩됐다 (실측 런당 평균 2장,
  // 최대 8장 = HP+24·이속 ×0.43). 게다가 '희귀' 태그 공명이 희귀 전체 가중을 밀어올려
  // 희귀 등장률이 사양 10.2% → 최대 16.5%로 팽창하는 되먹임까지 만들었다.
  // flag가 없는 특성은 반드시 max를 준다 — rollTraitCards의 제외 조건이 그 둘뿐이다
  { id: 'heavyplate', rare: true, name: '중갑 서약', tag: '희귀', color: '#c9b8e8', stack: true, max: 2,
    desc: '최대 HP +3, 즉시 3 회복 — 대신 이동 속도 -10%',
    apply: (p) => { p.maxHp += 3; p.hp = Math.min(p.maxHp, p.hp + 3); p.speed *= 0.9; } },
  { id: 'gambler', rare: true, name: '도박사의 피', tag: '희귀', color: '#c9b8e8',
    desc: '크리티컬 확률 +20% — 대신 크리티컬이 아닌 일격은 피해 -1', flag: 'gambler', apply: (p) => { p.critChance += 0.20; } },
  // 조건부 — 상황을 읽는 자의 카드
  { id: 'underdog', rare: true, name: '역전의 명수', tag: '희귀', color: '#c9b8e8',
    desc: 'HP가 절반 이하일 때 공격 속도 +25%', flag: 'underdog' },
  { id: 'firststrike', rare: true, name: '선제일격', tag: '희귀', color: '#c9b8e8',
    desc: '방에 들어선 뒤 첫 일격은 확정 크리티컬', flag: 'firststrike' },
  { id: 'execeye', rare: true, name: '처형인의 눈', tag: '희귀', color: '#c9b8e8',
    desc: 'HP 30% 이하의 적에게 주는 피해 +2', flag: 'execeye' },
  { id: 'regicide', rare: true, unlock: { stat: 'bestFloor', n: 5, label: '5층 도달' }, name: '군주 살해자', tag: '희귀', color: '#c9b8e8',
    desc: '보스·정예에게 주는 피해 +12%', flag: 'regicide' },
  { id: 'collector', rare: true, name: '수집가', tag: '희귀', color: '#c9b8e8',
    desc: '유물 2개마다 공격력 +1', flag: 'collector' },
  { id: 'duelist', rare: true, name: '결투가', tag: '희귀', color: '#c9b8e8',
    desc: '방에 홀로 남은 적에게 주는 피해 +3', flag: 'duelist' },
  { id: 'reapstep', rare: true, name: '사신의 걸음', tag: '희귀', color: '#c9b8e8',
    desc: '처치 후 1.5초간 이동 속도 +30%', flag: 'reapstep' },
  // 동사 — 리듬을 바꾸는 카드
  { id: 'echostrike', rare: true, unlock: { stat: 'totalKills', n: 400, label: '누적 400킬' }, name: '메아리 일격', tag: '희귀', color: '#c9b8e8',
    desc: '네 번째 일격마다 잔격이 한 번 더 때린다 (50% 피해)', flag: 'echostrike' },
  { id: 'riposte', rare: true, unlock: { stat: 'bestFloor', n: 3, label: '3층 도달' }, name: '반격 충격파', tag: '희귀', color: '#c9b8e8',
    desc: '완벽 회피 순간 주변 적에게 3 피해와 넉백', flag: 'riposte' },
  // 전설 신설
  { id: 'vengeblood', unlock: { stat: 'runs', n: 8, label: '8회 도전' }, name: '원한 폭주', tag: '전설', color: '#ffd866', legend: true,
    desc: '피격당하면 3초간 공격력 +3 — 상처가 칼이 된다', flag: 'vengeblood' },
  { id: 'kingsoath', unlock: { stat: 'wins', n: 1, label: '첫 복수' }, name: '왕의 유산', tag: '전설', color: '#ffd866', legend: true,
    desc: '새 층에 들어설 때마다 무작위 스탯 특성 1개를 자동으로 얻는다', flag: 'kingsoath' },
];

// 레벨업 카드 뽑기 — 이미 가진 고유(flag) 특성은 제외.
// 태그 시너지 가중치: 보유한 태그의 특성이 더 자주 등장한다 (트리를 "판다"는
// 플레이 성립 — 보스 기믹의 정답 트리를 연구해 완성할 수 있게 지원).
// ── 정점 보너스 (v169) ─────────────────────────────────────────────────
// 스탯 중복 상한을 조인 대신, **마지막 한 장이 규칙을 바꾼다**.
// "공격력 +1을 여덟 번"이 아니라 "세 번째 힘 단련이 전투 방식을 바꾼다"가 되도록.
// 카드 한 장의 값을 키우지 않으면, 장수만 줄이는 건 도파민만 깎는 짓이다
function applyTraitPeak(player, t) {
  if (!t.peak) return null;
  const cnt = player.traits.filter((x) => x === t.id).length;
  if (cnt < (t.max || 1)) return null;
  if (player.flags[t.peak]) return null;
  player.flags[t.peak] = true;
  return { atkPeak: '완력의 정점', hpPeak: '불굴', critPeak: '간파의 정점', dashPeak: '바람의 정점' }[t.peak];
}

// ── 온보딩 화력 안전망 (v172) ──────────────────────────────────────────
// 게임이 플레이어를 방치하지 않는다. 1~3층에서 화력이 바닥이면 카드 한 자리를 화력으로 보장한다.
// 실측: v169~v171에서 1층 카드 4장을 뽑고도 공격력이 1 그대로일 확률이 **67%**였다
// (화력 카드가 한 번도 안 뜰 확률 31.8%). 그 몸으로 95HP 보스를 만나면 95타를 쳐야 한다.
// 곡선이 아니라 **바닥**이다 — 이 선 위로는 아무것도 강제하지 않는다
const DMG_TRAIT_IDS = ['atk', 'aspd', 'crit', 'critdmg', 'combo'];
function _needsFirepower(player) {
  if (typeof Dungeon === 'undefined' || Dungeon.floor > 3) return false;
  return player.currentAtk() < 1 + Dungeon.floor * 0.5; // 1.5 / 2.0 / 2.5
}

function rollTraitCards(player, n = 3) {
  // 직업 전용 특성은 해당 직업에게만, 상한(max) 도달한 특성은 제외
  const countOf = (id) => player.traits.filter((x) => x === id).length;
  const pool = TRAITS.filter((t) =>
    Meta.isUnlocked(t) &&
    (!t.flag || !player.flags[t.flag]) &&
    (!t.cls || t.cls === player.classId) &&
    // 무한의 갈망: 중첩 상한 해제
    (!t.max || countOf(t.id) < t.max || player.flags.unbound));
  const tagCount = {};
  for (const id of player.traits) {
    const tr = TRAITS.find((x) => x.id === id);
    if (tr) tagCount[tr.tag] = (tagCount[tr.tag] || 0) + 1;
  }
  const ELEM_TAGS = ['화염', '번개', '독']; // 교차 반응의 재료 원소
  const hasElemTree = ELEM_TAGS.some((el) => (tagCount[el] || 0) >= 2);
  const weightOf = (t) => {
    if (t.legend) return 0.1; // 전설: 극저확률 — 나오면 런이 특별해진다 (풀 확대에 맞춰 0.08→0.1)
    // 태그 공명은 **시너지 계열**(화염·번개·독·수호·흡혈·직업)에만 준다.
    // v157: '희귀'는 계열이 아니라 **등급**인데 태그를 공유하는 바람에, 희귀를 한 장 집으면
    // 희귀 전체 가중이 오르는 되먹임이 생겼다 — 실측 등장률이 사양 10%의 1.7배(16.7%)까지 팽창.
    // 등급 태그는 공명 계수 0 (스탯은 종전대로 0.2로 감쇠)
    const reso = t.tag === '희귀' ? 0 : t.tag === '스탯' ? 0.2 : 1;
    let w = (1 + 0.7 * (tagCount[t.tag] || 0) * reso) * (t.cls ? 1.5 : 1);
    // v169: 스탯 카드 등장 가중 ×0.6. 보상을 1/3로 줄인 지금(v166), 남은 몇 장이 또
    // '공격력 +1'이면 그 런에는 **아무 결정도 없다**. 카드는 규칙을 바꿔야 한다.
    // 중복 상한도 함께 조였다 (스탯 총량 52장 → 22장) — 힘 단련 8장은 빌드가 아니라 곱셈이었다
    // v172 (사장 F9: 1층 보스에게 3연속 사망 · 실측 "카드 4장 뽑아도 공격력 1 그대로" 67%):
    // 감쇠를 온보딩까지 적용한 게 잘못이었다. 1~2층은 뽑을 카드 자체가 몇 장 없어서,
    // 스탯을 눌러버리면 **화력을 얻을 창이 통째로 닫힌다** — 공1로 95HP 보스를 만난다
    if (t.tag === '스탯') w *= (typeof Dungeon !== 'undefined' && Dungeon.floor <= 2) ? 1 : 0.6;
    if (t.rare) w *= 0.42; // 희귀 (v151): 세 판에 한 번쯤 — 나왔을 때 '오늘 런의 방향'이 되는 빈도
    // 교차 원소 유도 (반응 노출 계측: 30분에 7회 발동 — 믹스가 안 나와서 반응이 묻혔다):
    // 원소 트리 하나를 2픽 이상 팠으면, 아직 안 판 다른 원소 카드가 더 자주 보인다
    if (hasElemTree && ELEM_TAGS.includes(t.tag) && (tagCount[t.tag] || 0) <= 1) w += 0.6;
    // 계열 공명 (v137): 첫 임계(2)에 도달한 계열은 게임이 응답한다 — 등장 가중 ×1.5.
    // 마일스톤을 '복권'이 아니라 '커밋의 결과'로 만드는 에이전시 밸브
    const sk = SECT_BY_TAG[t.tag];
    if (sk && typeof Game !== 'undefined' && Game.sects && Game.sects[sk] >= 1) w *= 1.5;
    return w;
  };

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
  // 화력 안전망 (v172): 1~3층에서 공격력이 바닥이면 한 자리를 화력으로 바꾼다.
  // **힘 단련을 먼저** 찾는다 — 치명타·연격·공속은 곱셈이라, 곱해질 원판(공격력 1)이 없으면
  // 네 장을 다 화력으로 골라도 보스 앞에서 여전히 1타 1딜이다.
  // 그 자리를 맨 앞에 놓아 먼저 읽히게 한다. 고르는 건 여전히 플레이어다 — 바닥일 뿐 곡선이 아니다
  if (cards.length && _needsFirepower(player)) {
    const pick = (id) => avail.find((t) => t.id === id) || pool.find((t) => t.id === id && !cards.includes(t));
    let swap = cards.some((c) => c.id === 'atk') ? null : pick('atk');
    if (!swap && !cards.some((c) => DMG_TRAIT_IDS.includes(c.id))) {
      for (const id of DMG_TRAIT_IDS) { swap = pick(id); if (swap) break; } // 힘 단련이 상한이면 차선책
    }
    if (swap) {
      cards[cards.length - 1] = swap;
      cards.unshift(cards.pop());
    }
  }
  return cards;
}

function applyTrait(player, trait) {
  if (trait.apply) trait.apply(player);
  if (trait.flag) player.flags[trait.flag] = true;
  player.traits.push(trait.id);

  // 정점 도달 (v169) — 마지막 한 장이 규칙을 바꾼다. 화면이 그 순간을 알린다
  const peak = applyTraitPeak(player, trait);
  if (peak && typeof Particles !== 'undefined') {
    Particles.text(player.x, player.y - 46, '✦ ' + peak, { color: '#ffd866', size: 15 });
    if (typeof Game !== 'undefined') {
      Game.banner = { text: `✦ ${peak} — ${trait.name} 정점에 닿았다`, life: 2.8, maxLife: 2.8, color: '#ffd866' };
      if (typeof AudioSys !== 'undefined') AudioSys.relic && AudioSys.relic('epic');
    }
  }

  // 스킬 진화 준비 — 직업 특성 3장을 모으면 '개화 대기' 상태가 된다.
  // 실제 진화는 Lv.12부터 (Game.checkEvolution) — 봇 계측 결과 3장만으로는 평균 1.7층에
  // 진화해버려서, 완성의 순간이 중반(4~5층)에 오도록 레벨 게이트를 건다.
  if (trait.cls && !player.skillEvolved && !player.evoReady) {
    const clsCount = player.traits.filter((id) => {
      const t = TRAITS.find((x) => x.id === id);
      return t && t.cls;
    }).length;
    if (clsCount >= 3) {
      player.evoReady = true;
      if (typeof Game !== 'undefined' && Game.banner !== undefined && Game.level < 12) {
        Game.banner = { text: '힘이 무르익는다... (Lv.12에 스킬 개화)', life: 2.5, maxLife: 2.5, color: '#f7b32b' };
      }
    }
  }
  if (typeof Game !== 'undefined' && Game.checkEvolution) Game.checkEvolution();
}

// ══ 계열 「원한의 길」 (v137) — 드래프트의 목적지: 특성+유물+계승 형상을 통합 집계 ══
// 임계 2/4/6 (풀 실측 기반 — 특성만으론 3~5장이 상한이라 유물·형상까지 세어야 6이 열린다).
// 보너스는 새 피해 곱연산이 아니라 기존 메커닉의 증폭만 — 파워 인플레 구조적 차단.
const SECT_THRESH = [2, 4, 6];
const SECTS = {
  fire:  { name: '화염', color: '#ff7043', tag: '화염',
    relics: ['ashcloak', 'brandiron'], forms: ['ash'],
    tiers: ['화상 지속 +50%', '화상이 더 빠르게 탄다 (0.5→0.35초)', '「대화재」 — 화상 중인 적이 죽으면 불길이 남는다'] },
  volt:  { name: '번개', color: '#ffd866', tag: '번개',
    relics: ['stormneedle', 'shackle', 'gallowsrope'], forms: ['noose'],
    tiers: ['감전 지속 +50%', '감전된 적에게 크리티컬 +15%p', '「낙뢰」 — 감전된 적 처치 시 주변 2체로 전이'] },
  venom: { name: '독', color: '#6ab04c', tag: '독',
    relics: ['greenvial', 'antidote'], forms: ['plague'],
    tiers: ['독 지속 +50%', '독이 더 빠르게 스민다 (1.0→0.7초)', '「창궐」 — 독구름 반경 +40%'] },
  guard: { name: '수호', color: '#5ce0e6', tag: '수호',
    relics: ['spikeshield', 'husbandring', 'wolfpelt', 'martyrblood'], forms: ['guard'],
    tiers: ['보호막 충전 -15%', '피격 후 무적 +0.25초', '「성채」 — 보호막이 깨질 때 주변에 2 피해'] },
  blood: { name: '혈맹', color: '#e43b44', tag: '흡혈',
    relics: ['fang', 'butcherhook'], forms: ['chalice'],
    tiers: ['흡혈 쿨다운 -25%', '하트 드랍 +25%', '「피의 축제」 — 처치 시 4% 확률로 HP 1 회복'] },
};
const SECT_BY_TAG = {};
for (const k of Object.keys(SECTS)) SECT_BY_TAG[SECTS[k].tag] = k;
