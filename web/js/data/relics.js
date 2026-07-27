// 유물 60종 — 등급별 드랍 (기획안 §7: 커먼 60 / 레어 27 / 에픽 10 / 레전더리 3%).
// 레전더리는 수치 강화가 아니라 게임 규칙을 바꾼다.
// v128 확장: 시너지 태그 중심 — 화상/감전/독/완벽 회피/대시/골드/저주/단서가 서로 맞물린다.
const RARITY = {
  common:    { label: '커먼',     color: '#e8e0cf', weight: 60 },
  rare:      { label: '레어',     color: '#5c9ded', weight: 27 },
  epic:      { label: '에픽',     color: '#b13ae0', weight: 10 },
  legendary: { label: '레전더리', color: '#f7b32b', weight: 3 },
};

const RELICS = [
  // ── 커먼 ──
  { id: 'oldsword',  rarity: 'common', name: '내 처형검',
    lore: '나를 벤 뒤 부러뜨려 함께 묻은 검. 이제 내가 쥔다.',
    desc: '공격력 +1', apply: (p) => { p.bonusAtk += 1; } },
  { id: 'boots',     rarity: 'common', name: '순찰병의 장화',
    lore: '나를 묘지까지 끌고 온 자의 것. 밑창에 아직 그날의 흙이 묻어 있다.',
    desc: '이동 속도 +10%', apply: (p) => { p.speed *= 1.10; } },
  { id: 'heartbit',  rarity: 'common', name: '식지 않은 심장 조각',
    lore: '관 속에서도 뛰기를 멈추지 않았던 조각.',
    desc: '최대 HP +1, 즉시 1 회복', apply: (p) => { p.maxHp += 1; p.hp = Math.min(p.maxHp, p.hp + 1); } },
  { id: 'whetstone', rarity: 'common', name: '처형대의 연마석',
    lore: '처형 도끼를 갈던 돌 — 이제 내 원한을 간다.',
    desc: '크리티컬 확률 +10%', apply: (p) => { p.critChance += 0.10; } }, // 밸런스 점검: 모닥불 방 '숫돌'과 이름 중복 해소
  { id: 'feather',   rarity: 'common', name: '교수대 까마귀 깃털',
    lore: '내 처형을 끝까지 지켜본 새의 깃털.',
    desc: '대시 충전 속도 +15%', apply: (p) => { p.dashRegenMul *= 0.85; } },
  { id: 'crystal',   rarity: 'common', name: '성화 수정 조각',
    lore: '성화(聖火)라 불렀지만, 저 빛은 죄 없는 피로 타오른다.',
    desc: 'XP 획득 +15%', apply: (p) => { p.xpMul *= 1.15; } },
  { id: 'coin',      rarity: 'common', name: '뱃삯 동전',
    lore: '죽은 자의 눈에 얹는 동전. 나는 강을 건너지 않기로 했다.',
    desc: '하트 드랍 확률 +80%', apply: (p) => { p.luckMul *= 1.8; } },

  // ── 레어 ──
  { id: 'greaves',   rarity: 'rare', heir: 'archer', name: '밀렵꾼의 각반',
    lore: '숲을 소리 없이 걷던 자의 것.',
    desc: '대시 직후 첫 공격은 크리티컬 확정', flag: 'dashcrit' },
  { id: 'greatsword', rarity: 'rare', unlock: { stat: 'bestFloor', n: 3, label: '3층 도달' }, name: '몰수당한 대검',
    lore: '재판소가 몰수한 증거품 제3호. 원 주인은 처형됐다.',
    desc: '공격력 +2, 공격 속도 -10%', apply: (p) => { p.bonusAtk += 2; p.atkCdMul *= 1.1; } },
  { id: 'fang',      rarity: 'rare', name: '식시귀의 송곳니',
    lore: '굶주림을 아는 이빨은 살아 있는 것을 놓치지 않는다.',
    desc: '처치 시 8% 확률로 HP 1 회복', flag: 'fang' },
  { id: 'bombbag',   rarity: 'rare', name: '도굴꾼의 화약 주머니',
    lore: '도굴꾼은 무덤을 열었다 — 나는 무덤에서 나왔다.',
    desc: '처치 시 15% 확률로 폭발 (주변 2 피해)', flag: 'bomb' },
  { id: 'spikeshield', rarity: 'rare', unlock: { stat: 'totalKills', n: 400, label: '누적 400킬' }, name: '가시 박힌 관 뚜껑',
    lore: '박힌 못이 전부 안쪽을 향해 있었다. 이제 바깥을 향한다.',
    desc: '피격 시 주변 적에게 2 피해', flag: 'spikeshield' },
  { id: 'agirune',   rarity: 'rare', name: '탈옥수의 룬',
    lore: '지하 감옥 벽에 손톱으로 새겨져 있던 문자.',
    desc: '공격 속도 +20%', apply: (p) => { p.atkCdMul *= 0.80; } },

  // ── 에픽 ──
  { id: 'berserkhelm', rarity: 'epic', unlock: { stat: 'totalKills', n: 1500, label: '누적 1500킬' }, name: '참수당한 용병의 투구',
    lore: '목이 잘린 뒤에도 사흘을 싸웠다는 용병의 투구.',
    desc: 'HP 3 이하일 때 공격력 +4', flag: 'berserkhelm' },
  { id: 'timesand',  rarity: 'epic', unlock: { stat: 'bestFloor', n: 5, label: '5층 도달' }, name: '멎은 모래시계',
    lore: '내가 죽던 순간에 멎은 모래시계. 그 시간은 아직 흐르지 않았다.',
    desc: '대시를 2회 연속 사용할 수 있다', apply: (p) => { p.dashMax = 2; } },
  { id: 'phoenix',   rarity: 'epic', unlock: { stat: 'wins', n: 1, label: '첫 복수' }, name: '꺼지지 않은 원한',
    lore: '원한은 재가 되어도 식지 않는다.',
    desc: '죽음에 이르는 피해를 받으면 1회 부활 (HP 3)', flag: 'revive' },
  { id: 'magnetglove', rarity: 'epic', unlock: { stat: 'runs', n: 6, label: '6회 도전' }, name: '수의(壽衣) 자석 장갑',
    lore: '수의를 짓던 손은 죽은 자의 것을 끌어당긴다.',
    desc: 'XP와 하트를 방 전체에서 끌어당긴다', flag: 'magnetall' },

  // ── 레전더리 (규칙 변경) ──
  { id: 'glasssword', rarity: 'legendary', unlock: { stat: 'bestFloor', n: 7, label: '7층 도달' }, name: '유리 대검',
    lore: '왕실 유리세공사가 아들의 처형 후 만든 마지막 작품.',
    desc: '모든 공격이 크리티컬. 대신 최대 HP -2',
    apply: (p) => { p.maxHp = Math.max(1, p.maxHp - 2); p.hp = Math.min(p.hp, p.maxHp); },
    flag: 'allcrit' },
  { id: 'engine',    rarity: 'legendary', name: '심장 대신 도는 기관',
    lore: '심장이 썩은 자리에 재판소의 태엽을 넣었다.',
    desc: '대시 충전이 극한까지 빨라진다 (0.45초). 대신 이동 속도 -25%',
    apply: (p) => { p.speed *= 0.75; }, flag: 'engine' },
  { id: 'kingseal',  rarity: 'legendary', unlock: { stat: 'wins', n: 2, label: '2회 복수' }, name: '위조된 왕의 인장',
    lore: '위조범은 처형됐다 — 인장이 진짜와 똑같아서.',
    desc: '레벨업 선택지가 4장이 되고, 즉시 특성 1개를 얻는다', flag: 'kingseal' },

  // ── 확장 10종 (다회차 사이클): 골드·반응·완벽 회피 등 기존 시스템과 맞물린다 ──
  { id: 'hunterseye', rarity: 'common', heir: 'archer', name: '밀렵꾼의 눈',
    lore: '표적의 숨소리까지 읽던 눈.',
    desc: '크리티컬 확률 +7%', apply: (p) => { p.critChance += 0.07; } },
  { id: 'charm',      rarity: 'common', name: '이웃이 쥐여준 부적',
    lore: '밀고장에 서명하지 않은 이웃이 마지막으로 쥐여준 것.',
    desc: '런 정산 영혼 파편 +15%', flag: 'charm' },
  { id: 'scale',      rarity: 'rare', unlock: { stat: 'runs', n: 8, label: '8회 도전' }, name: '까마귀의 저울',
    lore: '까마귀는 죽은 자의 편이다 — 저울도 그렇다.',
    desc: '상인 가격 -25%', flag: 'haggle' },
  { id: 'stormneedle', rarity: 'rare', name: '벼락 맞은 첨탑 조각',
    lore: '왕좌를 내리쳤어야 할 벼락이 첨탑에 떨어졌다.',
    desc: '크리티컬 시 20% 확률로 감전 (반응의 재료)', flag: 'stormcrit' },
  { id: 'ashcloak',   rarity: 'rare', unlock: { stat: 'totalKills', n: 600, label: '누적 600킬' }, name: '화형대의 잿불 망토',
    lore: '화형대의 재는 아직 뜨겁다.',
    desc: '피격 시 주변 적에게 화상', flag: 'ashcloak' },
  { id: 'butcherhook', rarity: 'epic', unlock: { stat: 'bestFloor', n: 6, label: '6층 도달' }, name: '도살자의 갈고리',
    lore: '도살자는 크기로 값을 매겼다. 나도 그렇다.',
    desc: '정예·우두머리·보스 처치 시 HP 1 회복', flag: 'butcher' },
  { id: 'goldenheart', rarity: 'epic', name: '왕실 금고의 심장',
    lore: '왕의 금고 깊은 곳에서 뛰고 있던 것 — 누구의 심장이었을까.',
    desc: '최대 HP +1, 골드 획득 +30%', flag: 'goldheart',
    apply: (p) => { p.maxHp += 1; p.hp = Math.min(p.maxHp, p.hp + 1); } },
  { id: 'hungryblade', rarity: 'epic', name: '굶주린 처형도',
    lore: '벨수록 가벼워지는 칼. 무엇을 먹고 있는지는 묻지 마라.',
    desc: '40회 처치마다 공격력 +1 (최대 +3)', flag: 'hungry' },
  { id: 'clockhand',  rarity: 'legendary', unlock: { stat: 'totalKills', n: 3000, label: '누적 3000킬' }, name: '멈춘 종탑의 시곗바늘',
    lore: '종탑은 내 처형 시각에 멈췄다. 시곗바늘은 내가 가져왔다.',
    desc: '완벽 회피 시 스킬 쿨다운 -1.5초', flag: 'clockhand' },
  { id: 'crownshard', rarity: 'legendary', unlock: { stat: 'bestFloor', n: 9, label: '9층 도달' }, name: '부서진 왕관의 파편',
    lore: '왕관은 언젠가 부서진다. 이건 그 증거다.',
    desc: '우두머리·보스에게 피해 +15%, 그들의 골드 2배', flag: 'crownshard' },
  // ── 캐릭터 전용 유물 (개인사 §3.5) — 그 사람의 런에만 나타나는 유품 ──
  { id: 'oathsword', rarity: 'rare', heir: 'knight', name: '부러진 서약검',
    lore: '15년을 함께한 검 — 부러져도 서약은 남는다.',
    desc: '공격력 +1, 공격 범위 +12%', apply: (p) => { p.bonusAtk += 1; p.rangeMul *= 1.12; } },
  { id: 'marthaneck', rarity: 'epic', heir: 'knight', name: '마르타의 목걸이',
    lore: '아내가 매일 아침 걸어주던 것. 그 온기가 아직 남아 있다.',
    desc: '최대 HP +2, 즉시 2 회복', apply: (p) => { p.maxHp += 2; p.hp = Math.min(p.maxHp, p.hp + 2); } },
  { id: 'fatherstring', rarity: 'rare', heir: 'archer', name: '아버지의 활시위',
    lore: '손에 감으면 아버지의 손놀림이 기억난다.',
    desc: '공격 속도 +15%', apply: (p) => { p.atkCdMul *= 0.85; } },
  { id: 'siblingarrow', rarity: 'epic', heir: 'archer', name: '동생이 깎은 첫 화살',
    lore: '서툴게 깎은 촉이 가장 아픈 곳을 찾아간다.',
    desc: '크리티컬 확률 +12%, 크리티컬 피해 +25%', apply: (p) => { p.critChance += 0.12; p.critMul += 0.5; } },
  { id: 'piomap', rarity: 'rare', heir: 'mage', name: '피오의 별지도',
    lore: '화형대로 끌려가는 스승의 품에 제자가 찔러넣은 것.',
    desc: '스킬 쿨다운 -20%', apply: (p) => { p.skillCdMul *= 0.8; } },
  { id: 'sootring', rarity: 'epic', heir: 'mage', name: '그을린 성좌 반지',
    lore: '불 속에서도 별은 녹지 않았다.',
    desc: 'XP 획득 +25%, 크리티컬 +5%', apply: (p) => { p.xpMul *= 1.25; p.critChance += 0.05; } },
  { id: 'husbandring', rarity: 'epic', heir: 'alch', name: '남편의 결혼 반지',
    lore: '그 사람은 언제나 한 번은 막아줬다.',
    desc: '10초마다 보호막 — 다음 피해를 1회 막는다', flag: 'ringshield' },
  { id: 'antidote', rarity: 'rare', heir: 'alch', name: '마시다 만 해독제',
    lore: '이번엔 늦지 않게 마신다.',
    desc: '하트 회복량 +1, 하트 드랍 +40%', apply: (p) => { p.heartBonus = (p.heartBonus || 0) + 1; p.luckMul *= 1.4; } },

  // ── v128 확장 22종: 시너지 태그 중심 (38→60) ──
  // 커먼 5
  { id: 'tornbanner', rarity: 'common', name: '찢긴 왕기(王旗)',
    lore: '광장에 걸렸던 왕의 깃발. 처형날마다 그 아래서 북이 울렸다.',
    desc: '공격 범위 +10%', apply: (p) => { p.rangeMul *= 1.10; } },
  { id: 'gravebell', rarity: 'common', name: '무덤의 종',
    lore: '생매장을 두려워한 귀족들이 관에 매단 종. 나는 종 없이도 나왔다.',
    desc: '완벽 회피 판정 창 +60%', flag: 'bell' },
  { id: 'candle', rarity: 'common', name: '밤샘 초',
    lore: '시신 곁을 지키는 밤샘의 초. 내 곁엔 아무도 없었으니, 이제 내가 든다.',
    desc: '주변이 밝아진다 — 시야 광원 +35%', flag: 'candle' },
  { id: 'shovel', rarity: 'common', name: '묘지기의 삽',
    lore: '나를 묻은 삽. 손잡이에 동전 몇 닢이 숨겨져 있었다.',
    desc: '잡몹 처치 시 8% 확률로 골드 +2', flag: 'shovel' },
  { id: 'wolftooth', rarity: 'common', name: '흰 늑대의 이빨',
    lore: '재판소 사냥개들이 두려워한 단 하나의 짐승.',
    desc: '정예·우두머리·보스에게 피해 +10%', flag: 'wolftooth' },
  // 레어 7
  { id: 'brandiron', rarity: 'rare', name: '낙인 인두',
    lore: '죄인의 어깨에 왕장(王章)을 지지던 쇠. 아직 뜨겁다.',
    desc: '화상 중인 적에게 피해 +25%', flag: 'brand' },
  { id: 'greenvial', rarity: 'rare', name: '초록 유리병',
    lore: '이졸데의 가게 선반에 있던 것과 같은 병. 라벨은 지워졌다.',
    desc: '중독된 적 처치 시 독구름이 남는다', flag: 'venomburst' },
  { id: 'shackle', rarity: 'rare', unlock: { stat: 'totalKills', n: 800, label: '누적 800킬' }, name: '사형수의 쇠고랑',
    lore: '번개 치던 밤, 호송 마차에서 사형수가 사라졌다. 고랑만 남기고.',
    desc: '감전된 적 타격 시 근처 적에게 감전이 옮는다', flag: 'conduct' },
  { id: 'horn', rarity: 'rare', name: '밀렵꾼의 뿔나팔',
    lore: '사냥의 시작을 알리는 소리. 이제 사냥감이 분다.',
    desc: '대시 파생기 발동 후 2초간 공격력 +1', flag: 'horn' },
  { id: 'shroudpin', rarity: 'rare', name: '수의 고정핀',
    lore: '수의가 벗겨지지 않게 꽂는 핀. 뽑으면 죽은 자가 빨라진다는 미신이 있다.',
    desc: '피격 후 2.5초간 이동 속도 +40%', flag: 'panic' },
  { id: 'deathknell', rarity: 'rare', unlock: { stat: 'bestFloor', n: 4, label: '4층 도달' }, name: '세 번째 타종(打鐘)',
    lore: '조종(弔鐘)은 세 번 울린다. 세 번째가 가장 크다.',
    desc: '마무리 일격(3타째) 피해 +30%', flag: 'knell' },
  { id: 'mirrorshard', rarity: 'rare', unlock: { stat: 'runs', n: 12, label: '12회 도전' }, name: '검은 거울 조각',
    lore: '왕비의 거울이었다. 왕이 비치자 금이 갔다.',
    desc: '완벽 회피 시 주변 적에게 3 피해', flag: 'mirror' },
  // 에픽 6
  { id: 'wolfpelt', rarity: 'epic', unlock: { stat: 'bestFloor', n: 8, label: '8층 도달' }, name: '흰 늑대의 가죽',
    lore: '45층의 그 짐승이 아니다 — 그 어미의 것이다.',
    desc: '상처가 없을 때 받는 피해 1회 무효 (12초마다)', flag: 'pelt' },
  { id: 'blackcandle', rarity: 'epic', unlock: { stat: 'wins', n: 1, label: '첫 복수' }, name: '왕의 검은 초',
    lore: '왕이 밤마다 켜는 초. 심지가 비명 소리를 낸다.',
    desc: '저주(열기) 1단마다 공격력 +0.5', flag: 'blackcandle' },
  { id: 'gallowsrope', rarity: 'epic', unlock: { stat: 'totalKills', n: 1000, label: '누적 1000킬' }, name: '교수대의 밧줄',
    lore: '레나를 매달았던 그 밧줄이다. 이제 내 손에 있다.',
    desc: '감전·속박된 적에게 피해 +35%', flag: 'gallows' },
  { id: 'martyrblood', rarity: 'epic', name: '순교자의 피',
    lore: '진실을 말하고 죽은 자의 피는 마르지 않는다.',
    desc: '체력이 가득할 때 하트가 보호막이 된다', flag: 'martyr' },
  { id: 'sinnerchain', rarity: 'epic', name: '죄인의 사슬',
    lore: '수감번호 여든아홉. 이 사슬을 끊고 나간 자는 없다 — 안에서는.',
    desc: '3초 안에 3명 처치 시 대시 완전 충전', flag: 'chain3' },
  { id: 'headsmanglove', rarity: 'epic', unlock: { stat: 'totalKills', n: 2000, label: '누적 2000킬' }, name: '집행인의 장갑',
    lore: '목을 벨 때 피가 튀지 않게 만든 장갑. 이제 피가 어디로 튀는지 보라.',
    desc: '크리티컬로 처치 시 폭발 (주변 2 피해)', flag: 'headsman' },
  // 레전더리 4 (규칙 변경)
  { id: 'kingsdebt', rarity: 'legendary', unlock: { stat: 'runs', n: 10, label: '10회 도전' }, name: '왕의 차용증',
    lore: '왕은 전쟁 빚을 갚지 않았다. 채권자들은 전부 반역자가 되었다.',
    desc: '소지 골드 60마다 공격력 +1 (최대 +5)', flag: 'debt' },
  { id: 'coffinnail', rarity: 'legendary', unlock: { stat: 'bestFloor', n: 10, label: '10층 도달' }, name: '첫 관의 못',
    lore: '내 관에 박힌 여덟 개 중 첫 번째 못. 안에서 뽑았다.',
    desc: '잃은 HP 1마다 공격력 +0.7', flag: 'nail' },
  { id: 'usurpersign', rarity: 'legendary', unlock: { stat: 'wins', n: 2, label: '2회 복수' }, name: '찬탈자의 서명',
    lore: '스무 해 전, 선왕의 유언장에 잉크가 마르기도 전에 남은 서명.',
    desc: '레벨업마다 HP 1 회복, 5레벨마다 최대 HP +1', flag: 'usurper' },
  { id: 'lastwill', rarity: 'legendary', unlock: { stat: 'wins', n: 1, label: '첫 복수' }, name: '스무 번째 유언장',
    lore: '스물한 개의 진실 중 마지막 하나는 아직 쓰이지 않았다 — 그건 왕의 것이다.',
    desc: '모은 단서 1개마다 공격력 +0.15', flag: 'lastwill' },
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
  // 전용 유물(cls): 그 캐릭터의 런에만 나타난다 — 유품은 주인을 찾아간다
  const pool = RELICS.filter((r) => !owned.has(r.id) && Meta.isUnlocked(r) &&
    (!r.heir || r.heir === player.classId));
  const out = [];
  const order = ['legendary', 'epic', 'rare', 'common'];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const want = rollRelicRarity(bossRoll);
    let candidates = pool.filter((r) => r.rarity === want && !out.includes(r));
    // 깨어진 비석 「유품의 부름」: 유품이 후보에 있으면 단계당 1번 더 이름을 올린다 (등장 가중)
    const heirW = typeof Meta !== 'undefined' ? Meta.lvl('b_heir') : 0;
    if (heirW > 0) {
      for (const r of candidates.slice()) {
        if (r.heir) for (let k = 0; k < heirW; k++) candidates.push(r);
      }
    }
    // 계열 공명 (v137): 첫 임계에 도달한 계열의 유물은 이름을 한 번 더 올린다 (×~1.5)
    if (typeof Game !== 'undefined' && Game.sects && typeof SECTS !== 'undefined') {
      for (const r of candidates.slice()) {
        for (const k of Object.keys(SECTS)) {
          if (Game.sects[k] >= 1 && SECTS[k].relics.includes(r.id)) { candidates.push(r); break; }
        }
      }
    }
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
