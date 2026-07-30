// 던전 구조: 5개 층 × (방 8개 + 보스방). 층마다 테마·적 구성·환경 기믹이 다르다.
// desc: 문 아래 한 줄 툴팁 (완성도 점검 ③ — 문 10종의 의미를 배울 곳이 없었다)
const ROOM_META = {
  combat:    { label: '전투',    color: '#e8e0cf', desc: '평범한 전투' },
  elite:     { label: '정예',    color: '#b13ae0', desc: '강적 — 특성 보상' },
  treasure:  { label: '보물',    color: '#f7b32b', desc: '유물 상자' },
  camp:      { label: '모닥불',  color: '#ff7043', desc: '회복 또는 담금질' },
  event:     { label: '기연',    color: '#b13ae0', desc: '정체불명 — 도박' },
  boss:      { label: '보스',    color: '#e43b44', desc: '층의 주인' },
  nextfloor: { label: '다음 층', color: '#38b764', desc: '위로 오른다' },
  shortcut:  { label: '지름길',  color: '#e43b44', desc: '한 층 스킵 — 위험' },
  vault:     { label: '금고',    color: '#ffd866', desc: '무위험 보너스' },
  siege:     { label: '습격',    color: '#e43b44', desc: '3파도 생존 → 보상' },
  merchant:  { label: '상인',    color: '#2ec4b6', desc: '골드로 구매' },
  trial:     { label: '시련',    color: '#b13ae0', desc: '강화전 → 확정 유물' },
};

// ── 설계된 위협 세트 (R2) — 무리가 '물량'이 아니라 '퍼즐'이 되도록.
// 방 구성의 45%는 랜덤 샘플 대신 손제작 조합에서 뽑는다: 우선순위 판단이 생긴다.
// 위협 세트 — 층 귀속 (min~max): 층 전용 로스터와 함께 순환. 같은 세트가 다른 층에 안 나온다
const THREAT_SETS = [
  { min: 1, max: 1, units: ['skeleton', 'skeleton', 'archer', 'archer'], wants: 'open' },         // 근접 압박 + 후방 화살
  { min: 1, max: 1, units: ['boar', 'boar', 'swarm'], wants: 'open' },                            // 교차 돌진 + 벌레 떼
  { min: 2, max: 2, units: ['sporePuff', 'sporePuff', 'frog', 'frog'], wants: 'hazard' },           // 독구름 지뢰밭 위 개구리
  { min: 2, max: 2, units: ['acidSnail', 'acidSnail', 'spider', 'spider'], wants: 'corridor' },       // 산성 지형 + 거미줄 감속
  { min: 3, max: 3, units: ['shieldSkeleton', 'shieldSkeleton', 'sniper', 'sniper'], wants: 'pillars' }, // 방패벽 뒤 저격수
  { min: 3, max: 3, units: ['golem', 'jailer', 'frostMage', 'frostMage'], wants: 'corridor' },        // 탱커+사슬 끌기+감속탄
  { min: 4, max: 4, units: ['ashWalker', 'ashWalker', 'emberMoth', 'emberMoth'], wants: 'open' }, // 불길 잠식 + 급강하
  { min: 4, max: 4, units: ['lavaHound', 'lavaHound', 'cinder', 'cinder', 'cinder'], wants: 'hazard' }, // 화염 물량 러시
  { min: 5, max: 5, units: ['shaman', 'shade', 'shade', 'acolyte'], wants: 'pillars' },              // 힐러 컷 + 그림자 습격
  { min: 5, max: 5, units: ['necro', 'necro', 'gazer', 'crystal'], wants: 'open' },               // 이중 소환 + 탄막
  { min: 6, max: 6, units: ['bomber', 'bomber', 'charger', 'charger'], wants: 'corridor' },           // 자폭 유도 + 돌진 교차
  { min: 6, max: 6, units: ['bloodBat', 'bloodBat', 'bloodBat', 'ghoul', 'ghoul'], wants: 'open' }, // 흡혈 무리
  { min: 7, max: 7, units: ['turret', 'turret', 'venomLasher', 'venomLasher'], wants: 'pillars' },   // 고정 화망 + 채찍 근접
  { min: 7, max: 7, units: ['sporeMother', 'acidSlug', 'acidSlug'], wants: 'hazard' },              // 포자 생산 + 산성 포격
  { min: 8, max: 8, units: ['executioner', 'chainWraith', 'chainWraith', 'frostArcher'], wants: 'open' }, // 처형 구역+속박
  { min: 8, max: 8, units: ['warden', 'stalker', 'stalker', 'frostGolem'], wants: 'pillars' },       // 방패벽 + 은신 기습
  { min: 9, max: 9, units: ['lavaBurster', 'flameJuggler', 'flameJuggler', 'imp'], wants: 'open' }, // 장판 포화
  { min: 9, max: 9, units: ['obsidianBeast', 'obsidianBeast', 'magmaSlime', 'magmaSlime'], wants: 'corridor' }, // 중장갑 전선
  { min: 10, max: 10, units: ['mirrorKnight', 'riftCaster', 'riftCaster', 'voidSpawn', 'voidSpawn'], wants: 'pillars' }, // 반격 기사 + 균열
  { min: 10, max: 10, units: ['voidEye', 'voidSpawn', 'voidSpawn', 'voidSpawn', 'riftCaster'], wants: 'open' }, // 공허 무리
];

// 층별 데이터 (기획안 §8.2)
const FLOOR_DATA = {
  // 층 전용 로스터 (2026-07 재편): 모든 몹은 정확히 한 층에만 산다 — 층마다 새 얼굴, 새 기믹
  1: { name: '죄인의 묘지', enemies: ['slime', 'slime', 'skeleton', 'archer', 'boar', 'swarm', 'bat'], rule: null },
  2: { name: '안개 낀 습지', enemies: ['mushroom', 'toxicSlime', 'spider', 'frog', 'leech', 'sporePuff', 'acidSnail'], rule: '독 안개를 피하라' },
  3: { name: '버려진 지하 감옥', enemies: ['golem', 'wraith', 'shieldSkeleton', 'iceSlime', 'sniper', 'jailer', 'frostMage'], rule: '간수의 사슬 궤도에서 비켜서라' },
  4: { name: '불타는 폐가', enemies: ['fireSpirit', 'lavaHound', 'wisp', 'berserker', 'cinder', 'ashWalker', 'emberMoth'], rule: '용암을 밟지 마라' },
  5: { name: '교수대 언덕', enemies: ['necro', 'shaman', 'crystal', 'acolyte', 'shade', 'gazer'], rule: '그림자는 실체화됐을 때만 벨 수 있다' },
  // 6~10층: 심층 — 층마다 전용 신규 몬스터가 등장한다
  6: { name: '파헤쳐진 묘역', enemies: ['bomber', 'ghoul', 'charger', 'brute', 'bloodBat', 'boneHeap', 'boneHeap'], rule: '뼈 더미를 부수지 않으면 되살아난다' },
  7: { name: '독초 늪', enemies: ['thornPlant', 'turret', 'mimic', 'venomLasher', 'sporeMother', 'acidSlug'], rule: '시체꽃 모주부터 끊어라 — 봉오리는 무한하다' },
  8: { name: '지하 심문실', enemies: ['executioner', 'stalker', 'frostArcher', 'warden', 'chainWraith', 'frostGolem'], rule: '처형자의 붉은 구역에서 벗어나라' },
  9: { name: '화형장', enemies: ['magmaSlime', 'magmaSlime', 'imp', 'obsidianBeast', 'flameJuggler', 'lavaBurster'], rule: '착탄 예고 원을 읽어라 — 장판이 겹치면 도망칠 곳이 없다' },
  10: { name: '처형인의 홀', enemies: ['voidEye', 'glutton', 'voidSpawn', 'voidSpawn', 'riftCaster', 'mirrorKnight'], rule: '거울 기사의 반격 자세가 끝나기 전에 물러나라' },
  // ── 2막: 균사 정원 (11~20층) — 탑 아래에 뿌리내린 거대 균사체의 영역 ──
  11: { name: '안개 낀 강둑', enemies: ['sporeling', 'sporeling', 'mushroom', 'sporePuff', 'fungalTick', 'frog'], rule: '물에 불은 시체가 터뜨리는 독기를 밟지 마라' },
  12: { name: '강둑 하류', enemies: ['sporeling', 'fungalTick', 'fungalTick', 'mushroom', 'sporeMother', 'acidSnail'], rule: '물에 불은 시체가 터뜨리는 독기를 밟지 마라' },
  13: { name: '하수 수문', enemies: ['frog', 'toxicSlime', 'glowShrieker', 'fungalTick', 'acidSlug', 'sporeling'], rule: '나팔수의 나팔이 토벌대를 가속시킨다 — 먼저 끊어라' },
  14: { name: '수문 안쪽', enemies: ['glowShrieker', 'toxicSlime', 'acidSlug', 'sporeling', 'sporeMother', 'spider'], rule: '나팔수의 나팔이 토벌대를 가속시킨다 — 먼저 끊어라' },
  15: { name: '관문 회랑', enemies: ['myceliumBrute', 'venomLasher', 'sporePuff', 'fungalTick', 'glowShrieker', 'sporeling'], rule: '관문 골렘의 내려찍기 자리가 오물로 물든다' },
  16: { name: '관문 내성벽', enemies: ['myceliumBrute', 'myceliumBrute', 'venomLasher', 'thornPlant', 'glowShrieker', 'fungalTick'], rule: '관문 골렘의 내려찍기 자리가 오물로 물든다' },
  17: { name: '성벽 아래 오물길', enemies: ['rotWalker', 'rotWalker', 'ghoul', 'toxicSlime', 'sporeMother', 'acidSlug'], rule: '오물 보행자의 발자국이 땅을 썩게 한다' },
  18: { name: '오물길 막장', enemies: ['rotWalker', 'myceliumBrute', 'ghoul', 'venomLasher', 'sporeMother', 'glowShrieker'], rule: '오물 보행자의 발자국이 땅을 썩게 한다' },
  19: { name: '관문 광장', enemies: ['sporeling', 'sporeling', 'myceliumBrute', 'rotWalker', 'glowShrieker', 'fungalTick'], rule: '사령부의 나팔이 멎지 않는 한 증원은 계속된다' },
  20: { name: '관문 사령부', enemies: ['sporeling', 'fungalTick', 'myceliumBrute', 'rotWalker', 'glowShrieker', 'sporeMother'], rule: '사령부의 나팔이 멎지 않는 한 증원은 계속된다' },
  // ── 3막: 영지와 재판소 (21~30층) — 나를 판결한 자들의 땅 ──
  21: { name: '영지 어귀',   enemies: ['berserker', 'boar', 'shaman', 'sniper', 'charger', 'swarm'], rule: '종군 사제를 먼저 끊어라 — 사병이 죽지 않는다' },
  22: { name: '불탄 포도밭', enemies: ['berserker', 'berserker', 'charger', 'shaman', 'sniper', 'cinder'], rule: '종군 사제를 먼저 끊어라 — 사병이 죽지 않는다' },
  23: { name: '사병 주둔지', enemies: ['golem', 'bomber', 'frostArcher', 'glowShrieker', 'brute', 'shieldSkeleton'], rule: '척탄병의 심지가 타기 전에 잡아라' },
  24: { name: '주둔지 심부', enemies: ['golem', 'golem', 'bomber', 'frostArcher', 'glowShrieker', 'warden'], rule: '척탄병의 심지가 타기 전에 잡아라' },
  25: { name: '재판소 앞뜰', enemies: ['executioner', 'stalker', 'acolyte', 'frostMage', 'shieldSkeleton', 'shade'], rule: '심문관의 붉은 구역에서 벗어나라' },
  26: { name: '대법정',      enemies: ['executioner', 'executioner', 'stalker', 'acolyte', 'frostMage', 'crystal'], rule: '심문관의 붉은 구역에서 벗어나라' },
  27: { name: '재판소 지하 감옥', enemies: ['jailer', 'chainWraith', 'wraith', 'warden', 'frostGolem', 'iceSlime'], rule: '간수의 사슬 궤도에서 비켜서라' },
  28: { name: '고문실 복도', enemies: ['jailer', 'chainWraith', 'chainWraith', 'warden', 'frostGolem', 'stalker'], rule: '간수의 사슬 궤도에서 비켜서라' },
  29: { name: '공작의 성관', enemies: ['mirrorKnight', 'riftCaster', 'brute', 'executioner', 'imp', 'acolyte'], rule: '거울기사의 반격 자세가 끝나기 전에 물러나라' },
  30: { name: '판결의 홀',   enemies: ['mirrorKnight', 'riftCaster', 'riftCaster', 'executioner', 'frostMage', 'warden'], rule: '판결봉이 내려치기 전에 — 빨리 끝내라' },
  // ── 4막: 역병의 마을 (31~40층) — 왕이 만든 재앙, '역병'이라 불린 것 ──
  31: { name: '봉쇄된 마을 어귀', enemies: ['ghoul', 'skeleton', 'swarm', 'bloodBat', 'necro', 'shieldSkeleton'], rule: '깨어난 자들은 그저 걷는다 — 벨 때마다 고맙다고 속삭인다' },
  32: { name: '썩은 밀밭',       enemies: ['ghoul', 'ghoul', 'skeleton', 'necro', 'sporePuff', 'boneHeap'], rule: '깨어난 자들은 그저 걷는다 — 벨 때마다 고맙다고 속삭인다' },
  33: { name: '좀비 거리',       enemies: ['ghoul', 'shieldSkeleton', 'boneHeap', 'shade', 'shaman', 'bloodBat'], rule: '뼈 더미를 부수지 않으면 되살아난다' },
  34: { name: '판자촌 골목',     enemies: ['ghoul', 'ghoul', 'boneHeap', 'boneHeap', 'shade', 'wraith'], rule: '뼈 더미를 부수지 않으면 되살아난다' },
  35: { name: '소각장',          enemies: ['cinder', 'ashWalker', 'flameJuggler', 'bomber', 'imp', 'lavaHound'], rule: '소각병은 증거와 함께 너도 태우려 한다' },
  36: { name: '재의 뜰',         enemies: ['ashWalker', 'ashWalker', 'flameJuggler', 'lavaBurster', 'imp', 'cinder'], rule: '소각병은 증거와 함께 너도 태우려 한다' },
  37: { name: '대성당 앞뜰',     enemies: ['acolyte', 'frostMage', 'warden', 'stalker', 'crystal', 'shieldSkeleton'], rule: '광신 복사의 기도가 끝나기 전에 끊어라' },
  38: { name: '대성당 회랑',     enemies: ['acolyte', 'acolyte', 'executioner', 'frostMage', 'warden', 'crystal'], rule: '광신 복사의 기도가 끝나기 전에 끊어라' },
  39: { name: '납골당',          enemies: ['necro', 'chainWraith', 'wraith', 'boneHeap', 'stalker', 'shade'], rule: '빈 관마다 왕실 봉인 — 이들은 어디로 갔나' },
  40: { name: '지하 성소',       enemies: ['necro', 'chainWraith', 'mirrorKnight', 'riftCaster', 'acolyte', 'wraith'], rule: '성물이 빛나는 동안 대주교는 죽지 않는다' },
  // ── 5막: 왕도 (41~50층) — 끝. 왕좌까지 열 층 ──
  41: { name: '왕도 뒷골목',   enemies: ['stalker', 'brute', 'berserker', 'bloodBat', 'sniper', 'shade'], rule: '밀정은 어둠 속에서만 칼을 꺼낸다' },
  42: { name: '빈민가 시장',   enemies: ['stalker', 'stalker', 'brute', 'sniper', 'bomber', 'shade'], rule: '밀정은 어둠 속에서만 칼을 꺼낸다' },
  43: { name: '대광장',       enemies: ['executioner', 'warden', 'frostArcher', 'acolyte', 'glowShrieker', 'shieldSkeleton'], rule: '처형대가 늘어선 광장 — 저 위에서 내가 죽었다' },
  44: { name: '처형대로',     enemies: ['executioner', 'executioner', 'warden', 'frostArcher', 'glowShrieker', 'crystal'], rule: '처형대가 늘어선 광장 — 저 위에서 내가 죽었다' },
  45: { name: '근위 관문',    enemies: ['mirrorKnight', 'warden', 'frostGolem', 'frostMage', 'jailer', 'golem'], rule: '근위대장은 알고도 침묵한 자다' },
  46: { name: '근위 병영',    enemies: ['mirrorKnight', 'warden', 'warden', 'frostGolem', 'frostMage', 'brute'], rule: '근위의 방패는 등이 비어 있다' },
  47: { name: '왕성 회랑',    enemies: ['mirrorKnight', 'riftCaster', 'crystal', 'acolyte', 'executioner', 'imp'], rule: '스테인드글라스 뒤마다 균열 심문관이 숨어 있다' },
  48: { name: '알현 복도',    enemies: ['mirrorKnight', 'mirrorKnight', 'riftCaster', 'crystal', 'acolyte', 'frostMage'], rule: '스테인드글라스 뒤마다 균열 심문관이 숨어 있다' },
  49: { name: '성배의 방',    enemies: ['riftCaster', 'chainWraith', 'necro', 'voidEye', 'glutton', 'wraith'], rule: '성배가 가깝다 — 저주가 짙어 죽은 것들이 끓는다' },
  50: { name: '왕좌',         enemies: ['riftCaster', 'mirrorKnight', 'chainWraith', 'voidEye', 'necro', 'glutton'], rule: '증거를 전부 품고 왔는가 — 왕이 기다린다' },
};

// 51층+ (무한 모드 '무너진 왕국'): 5막 심부(46~50층) 구성을 순환하며 끝없이 강해진다
function floorData(floor) {
  if (FLOOR_DATA[floor]) return FLOOR_DATA[floor];
  const base = FLOOR_DATA[((floor - 51) % 5) + 46];
  return { name: `무너진 왕국 ${floor}구역`, enemies: base.enemies, rule: base.rule };
}

// 문 수식어 — 위험을 감수하면 보상이 커진다 (문 선택이 고정 순위표가 되지 않게)
const DOOR_MODS = [
  { id: 'horde', label: '사나운 무리', desc: '적 증원 — 클리어 시 파편 보너스' },
  { id: 'guarded', label: '보물 지킴이', desc: '정예 2기가 상자를 지킨다' },
];

const Dungeon = {
  floor: 1,
  roomIndex: 1,
  totalRooms: 9,
  roomType: 'combat',

  // ── 방 좌표계 (v189) ──────────────────────────────────────────────────
  // 사장: "맵도 계속 이어져 있다는 느낌이 들어야해."
  // 실측이 근본 원인을 지목했다 — **Dungeon에 좌표가 한 개도 없었다.**
  // 비함수 키 전수 확인 결과 공간 정보는 roomIndex 정수 하나가 전부였고,
  // 그건 '다음 방'만 있고 '옆방'이 없다는 뜻이다. 이어져 있다고 느끼려면
  // 먼저 **이어져 있어야** 한다. 오른쪽 문으로 나가면 오른쪽 칸으로 간다.
  mapPos: { x: 0, y: 0 },
  mapNodes: [],      // [{x, y, type, index, floor}] — 지나온 방의 실제 배치
  mapEdges: [],      // [{x0, y0, x1, y1}] — 어느 방이 어느 방에 붙어 있는가
  entryY: null,      // 이번 방에 들어설 세로 위치 (나온 문의 높이를 그대로 잇는다)
  pendingDy: 0,      // 마지막으로 고른 문의 상하 방향 (-1 위 / 0 정면 / +1 아래)

  _resetMap() {
    this.mapPos = { x: 0, y: 0 };
    this.mapNodes = [];
    this.mapEdges = [];
    this.entryY = null;
    this.pendingDy = 0;
  },

  // 방 한 칸 이동 — 오른쪽으로 한 칸, 고른 문에 따라 위/아래로.
  // 층 첫 방(step=false)은 이동 없이 자리에만 찍는다
  _stepMap(type, step) {
    if (step) {
      this.mapPos = { x: this.mapPos.x + 1, y: this.mapPos.y + (this.pendingDy || 0) };
      const prev = this.mapNodes[this.mapNodes.length - 1];
      if (prev) this.mapEdges.push({ x0: prev.x, y0: prev.y, x1: this.mapPos.x, y1: this.mapPos.y });
    }
    this.mapNodes.push({ x: this.mapPos.x, y: this.mapPos.y, type, index: this.roomIndex, floor: this.floor });
    if (this.mapNodes.length > 400) this.mapNodes.splice(0, this.mapNodes.length - 400);
  },

  newRun() {
    this.floor = 1;
    this.roomIndex = 1;
    this.tookTreasure = false;
    this.tookRelicChest = false; // v166: 층당 유물 상자 1개
    this.tookEliteCard = false;  // v166: 층당 정예 특성 카드 1장
    this.tookCamp = false;
    this.tookEvent = false;
    this.tookSiege = false;
    this.tookMerchant = false;
    this.trialSeen = false; // 시련의 문은 런당 1회 (층이 아니라)
    this.vaultFound = false;
    this.vaultCrackPlaced = false;
    this.miniSeen = false;
    this.shortcutHot = false;
    this._resetMap();          // v189: 런이 새로 시작하면 지도도 비운다
    this._noStep = true;
    this.build('combat');
  },

  nextFloor() {
    this.floor++;
    this.roomIndex = 1;
    this.tookTreasure = false;
    this.tookRelicChest = false; // v166: 층당 유물 상자 1개
    this.tookEliteCard = false;  // v166: 층당 정예 특성 카드 1장
    this.tookCamp = false;
    this.tookEvent = false;
    this.tookSiege = false;
    this.tookMerchant = false;
    this.vaultFound = false;
    this.vaultCrackPlaced = false;
    this.miniSeen = false;
    this.shortcutHot = false; // 지름길 효과는 도착 층에서만
    // v189: 층을 오르면 지도에서 **한 줄 위로** 옮겨 앉는다 — 50층 탑이 세로로 쌓인다
    this.mapPos = { x: 0, y: this.mapPos.y - 3 };
    this.pendingDy = 0;
    this.entryY = null;
    this._noStep = true;
    this.build('combat');
  },

  advance(type) {
    if (type === 'nextfloor') {
      this.nextFloor();
      return;
    }
    // 지름길 (R3): 한 층을 건너뛴다 — 도착 층은 정예·우두머리가 들끓지만 정예가 파편을 떨군다
    if (type === 'shortcut') {
      this.floor += 2;
      this.roomIndex = 1;
      this.tookTreasure = false;
    this.tookRelicChest = false; // v166: 층당 유물 상자 1개
    this.tookEliteCard = false;  // v166: 층당 정예 특성 카드 1장
      this.tookCamp = false;
      this.tookEvent = false;
    this.tookSiege = false;
    this.tookMerchant = false;
    this.vaultFound = false;
    this.vaultCrackPlaced = false;
      this.miniSeen = false;
      this.shortcutHot = true;
      this.build('combat');
      // 보상 감사: 층 스킵은 그 층의 XP·유물 기회를 통째로 버리는 것 — 위험(정예 들끓음)만 있고
      // 런 파워 보상이 없었다. 도착 즉시 특성 1장으로 손실을 일부 보전 (그래도 정상 진행보다 약간 손해 = 의도)
      Game.pendingChoices++;
      // 버그 수정: 여기서 카드를 바로 열면 화면 전환(페이드) 도중 상태가 바뀌어
      // 검은 오버레이가 걸린 채 멈춘다 — 전환 완료 시점(main.js transition 'in' 종료)이 알아서 연다
      return;
    }
    // 금고방 (맵 M3): 진행을 소모하지 않는 보너스 방 — roomIndex 유지, 나올 때 같은 갈림길
    if (type === 'vault') {
      this.vaultFound = false;
      this.build('vault');
      return;
    }
    if (type === 'treasure') this.tookTreasure = true;
    if (type === 'camp') this.tookCamp = true;
    if (type === 'event') this.tookEvent = true;
    if (type === 'siege') this.tookSiege = true;
    if (type === 'merchant') this.tookMerchant = true;
    if (type === 'trial') this.trialSeen = true;
    this.roomIndex++;
    this.build(type);
  },

  build(type) {
    this.roomType = type;
    // v189: 좌표를 먼저 옮긴다 — 방을 짓기 전에 그 방이 '어디'인지 정해져 있어야 한다
    this._stepMap(type, !this._noStep);
    this._noStep = false;
    // 방 시드 (v163): 이 방을 만든 난수 씨앗을 기억한다.
    // 「저장하고 거점」 → 「이어하기」가 restart()를 거치면서 **런 시드를 새로 뽑았고**,
    // 그 결과 이어하기가 방을 통째로 다시 굴렸다 — 불리한 방을 만나면 저장하고 나갔다
    // 들어오는 것만으로 무한 리롤이 됐다. 이제 같은 씨앗으로 **같은 방**이 복원된다
    if (this._forceSeed != null) { this.roomSeed = this._forceSeed >>> 0; this._forceSeed = null; }
    else this.roomSeed = RNG.int(1, 0x7ffffffe);
    RNG.seed(this.roomSeed);
    // 미니맵: 이 층에서 지나온 방 이력 (roomIndex 1이면 새 층 시작)
    if (this.roomIndex === 1 && type === 'combat') this.roomLog = [];
    (this.roomLog = this.roomLog || []).push(type);
    World.buildRoom(this.roomIndex, type, this.floor);
    Game.onRoomBuilt(type);
  },

  // 습격방 웨이브 구성 (맵 M4): 파도가 갈수록 거세진다 — 3파도는 정예 섞임
  siegeWave(wave) {
    const data = floorData(this.floor);
    const comp = [];
    const n = Math.min(14, 3 + Math.min(8, this.floor) + wave * 2);
    const eliteChance = wave >= 3 ? Math.min(0.5, 0.1 + this.floor * 0.03) : 0.05;
    while (comp.length < n) {
      const type = RNG.pick(data.enemies);
      comp.push({ type, elite: RNG.chance(eliteChance) });
      if (type === 'swarm') {
        for (let k = 0; k < 3; k++) comp.push({ type: 'swarm', elite: false });
      }
    }
    return comp;
  },

  floorName() {
    return floorData(this.floor).name;
  },

  // 시련 구성 (G5): 이웃 층(±2)의 손제작 위협 세트 2개를 섞는다 — HP 스케일 격차가 너무 벌어지지 않는 범위
  trialComp() {
    const lo = Math.max(1, this.floor - 2), hi = Math.min(10, this.floor + 2);
    const pool = THREAT_SETS.filter((s) => s.min >= lo && s.min <= hi && s.min !== this.floor);
    const comp = [];
    const picks = [];
    while (picks.length < 2 && pool.length > 0) {
      picks.push(pool.splice(Math.floor(RNG.next() * pool.length), 1)[0]);
    }
    for (const set of picks) {
      for (const u of set.units) comp.push({ type: u, elite: RNG.chance(0.25) });
    }
    return comp;
  },

  doorOptions() {
    const next = this.roomIndex + 1;
    if (next >= this.totalRooms) {
      // 금빛 균열을 부쉈다면 보스 직전이라도 금고는 들를 수 있다
      if (this.vaultFound) return [{ type: 'vault', ...ROOM_META.vault }, { type: 'boss', ...ROOM_META.boss }];
      return [{ type: 'boss', ...ROOM_META.boss }];
    }
    const options = ['combat'];
    const pool = [];
    if (next >= 3) pool.push('elite', 'elite');
    // 보물·모닥불은 층당 1회만 — 한 번 들어가면 그 층에서는 다시 나오지 않는다
    if (!this.tookTreasure) pool.push('treasure');
    if (!this.tookCamp && next >= 4) pool.push('camp');
    if (!this.tookEvent && next >= 3) {
      pool.push('event'); // 기연: 리스크-리워드 이벤트
      if (typeof Game !== 'undefined' && Game.route === 'old') pool.push('event'); // 기억의 옛길: 기이한 일이 잦다
    }
    if (this.floor >= 3 && !this.tookSiege) pool.push('siege'); // 습격 (맵 M4): 3층+ 웨이브 생존 도전
    if (this.floor >= 2 && !this.tookMerchant && next >= 3) {
      pool.push('merchant'); // 상인 (G1): 층당 1회
      if (typeof Game !== 'undefined' && Game.route === 'mist') pool.push('merchant'); // 안개의 샛길: 까마귀와 자주 마주친다
    }
    if (this.floor >= 4 && !this.trialSeen && RNG.chance(0.3)) pool.push('trial'); // 시련 (G5): 런당 1회, 희귀
    pool.push('combat');

    // 금고 발견 시: 문 3개 상한을 지키려 일반 문을 2개로 줄이고 금고 문을 끼운다
    const n = this.vaultFound ? 2 : RNG.int(2, 3);
    while (options.length < n && pool.length > 0) {
      const pick = pool.splice(Math.floor(RNG.next() * pool.length), 1)[0];
      if (!options.includes(pick)) options.push(pick);
    }
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(RNG.next() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    if (this.vaultFound) options.unshift('vault');
    return options.map((t) => {
      const opt = { type: t, ...ROOM_META[t] };
      // 문 수식어 (P4): 전투/정예 문에 35% 확률로 위험-보상 트레이드오프가 붙는다 —
      // "안전한 전투 vs 위험하지만 보상 큰 전투"가 상태(체력/빌드)에 따라 다른 답이 되도록
      if ((t === 'combat' || t === 'elite') && RNG.chance(0.35)) {
        opt.mod = RNG.pick(DOOR_MODS);
      }
      return opt;
    });
  },

  // 전투방 적 구성 — 깊이·층에 따라 수와 정예 확률 증가
  combatComp(depth) {
    const data = floorData(this.floor);
    const comp = [];
    const heatBonus = (Game.pacts && Game.pacts.count && this.floor >= 3) ? 2 : 0; // 서약 '물량 공세' (1~2층 제외 — 초반 절벽 방지)
    // 물량감: 로그라이크다운 무리 전투. 곡선 뒤집기(R1): 1~2층은 -2 — 사망의 90%가
    // 1~2층에 몰리는 역전 곡선 보정 (신규 이탈 구간 완화)
    const earlyEase = this.floor <= 2 ? 2 : 0;
    // 물량 상향 (2026-07 몬스터 확장): 기본 +1, 층 기울기 0.9→1.0, 상한 16→18
    const mistEase = (typeof Game !== 'undefined' && Game.route === 'mist') ? 1 : 0; // 안개의 샛길: 무리 -1
    const n = Math.max(3, Math.min(18, 4 + Math.ceil(depth * 0.9) + Math.floor((this.floor - 1) * 1.0) + heatBonus - earlyEase - mistEase));
    let eliteChance = Math.min(0.4, 0.03 + (this.floor - 1) * 0.04); // 층당 4%, 상한 40% (무한 모드)
    if (typeof Game !== 'undefined' && Game.route === 'war') eliteChance = Math.min(0.6, eliteChance + 0.08); // 전화의 길
    if (Game.pacts && Game.pacts.elite) eliteChance = Math.min(0.55, eliteChance + 0.10); // 서약 '성난 망령'
    if (Game.pacts && Game.pacts.wrath) eliteChance = Math.min(0.65, eliteChance + 0.10); // 왕의 진노
    if (this.shortcutHot) eliteChance = Math.min(0.5, eliteChance * 2); // 지름길 층: 정예 2배

    // ══ 방 규격 (v187) — 기준 구간 1~3층에서 잡고 50층까지 그대로 쓴다 ═══════
    // 사장: "적들도 군집이나 여러 행동들에 대한 체감이 없는데?"
    // 실측이 원인을 지목했다 — 1~3층 24개 방 **전부** 무리 1개·리더 1기·적 3.5마리.
    // 즉 무리가 죽어 있던 게 아니라 **상수**였다. 항상 무리면 무리가 안 보인다.
    //
    // 그래서 방에 성격을 준다. 그리고 난이도를 건드리지 않기 위해
    // **위협 예산을 보존**한다: 몸 수를 늘리면 개체를 그만큼 약하게 만든다.
    //   홑몸 — 몸 0.65배 / 개체 1.50배 : 조용한 방. 하나하나가 무겁다
    //   무리 — 몸 1.40배 / 개체 0.62배 : 떼로 몰려온다. 광역기의 밥
    //   이중 — 몸 1.20배 / 개체 0.78배 : 두 무리, "어느 쪽부터"가 문제
    // 이 규칙은 층 번호를 파라미터로만 받으므로 1층과 50층에서 똑같이 동작한다
    const ROOM_KINDS = [
      { id: 'solo', p: 0.25, bodies: 0.65, unit: 1.50, packs: 0 },
      { id: 'pack', p: 0.45, bodies: 1.40, unit: 0.62, packs: 1 },
      { id: 'duo',  p: 0.25, bodies: 1.20, unit: 0.78, packs: 2 },
      { id: 'host', p: 0.05, bodies: 1.55, unit: 0.58, packs: 1 }, // 대무리 — 드물게 오는 압도
    ];
    let roll = RNG.next(), kind = ROOM_KINDS[1];
    for (const k of ROOM_KINDS) { if (roll < k.p) { kind = k; break; } roll -= k.p; }
    const bodyN = Math.max(2, Math.min(20, Math.round(n * kind.bodies)));
    const unitMul = kind.unit;
    comp.roomKind = kind.id;

    // 설계된 위협 세트 (R2): 45% 확률로 손제작 조합이 무리의 뼈대가 된다
    // 층 귀속 (min~max) — 무한 모드는 순환 테마의 유효 층으로 매칭
    const ef = this.floor <= 10 ? this.floor : ((this.floor - 11) % 5) + 6;
    const sets = THREAT_SETS.filter((s) => ef >= s.min && ef <= (s.max || 99));
    // ★ v181 — 무리가 기본이고 랜덤이 예외다 (사장 지적: "랜덤으로 흩어져서 나오는데 …
    // 긴장감이 전혀 없어"). 종전엔 손제작 세트가 **45%**만 걸리고 나머지 55%는
    // `RNG.pick(적_목록)`으로 채웠다 — 그러면 무리가 아니라 **개체 5개**가 각자 걸어온다.
    // 무리를 깨는 순서가 문제가 되려면, 먼저 무리여야 한다
    const tag = (typeof World !== 'undefined' && World.lastTemplateTag) || 'open';
    const pickSet = () => {
      const matched = sets.filter((s) => s.wants === tag);
      return matched.length && RNG.chance(0.75) ? RNG.pick(matched) : RNG.pick(sets);
    };
    if (sets.length && kind.packs > 0) {
      // 첫 무리 — 지형에 맞는 조합이 뼈대가 된다.
      // v185: 무리마다 **번호와 리더**를 붙인다. 리더는 무리를 묶는 매듭이고, 끊으면 무리가 흔들린다
      let packId = 0;
      const stamp = (units, wants) => {
        const id = ++packId;
        const start = comp.length;
        for (const t of units) comp.push({ type: t, elite: RNG.chance(eliteChance * 0.5), pack: id, hpMul: unitMul });
        // 리더는 무리의 첫 유닛 — THREAT_SETS는 앞쪽이 그 무리의 성격을 대표한다
        if (comp.length > start + 1) comp[start].leader = true;
        return { units: units.length, wants };
      };
      const set = pickSet();
      comp.setUsed = true;
      comp.packs = [stamp(set.units, set.wants)];
      // v187: 무리 방은 **한 무리를 크게** 키운다 (같은 세트를 겹쳐 붙인다) —
      // 넷은 무리로 안 보이고 여덟은 보인다. 이중 방만 서로 다른 무리를 부른다
      let guard = 0;
      while (comp.length < bodyN - 1 && guard++ < 6) {
        const s2 = kind.packs >= 2 ? pickSet() : set;
        if (kind.packs >= 2 && comp.packs.length < 2) comp.packs.push(stamp(s2.units, s2.wants));
        else {
          // 같은 무리에 몸을 더 붙인다 — 리더는 그대로 하나
          const id = comp.packs.length ? 1 : 0;
          for (const t of s2.units) {
            if (comp.length >= bodyN) break;
            comp.push({ type: t, elite: RNG.chance(eliteChance * 0.4), pack: id || 1, hpMul: unitMul });
          }
          comp.packs[comp.packs.length - 1].units += s2.units.length;
        }
      }
    }
    // 홑몸 방(무리 없음)과, 세트가 없는 층의 남는 자리는 낱개로 — 무리 번호를 주지 않는다
    while (comp.length < bodyN) {
      const type = RNG.pick(data.enemies);
      comp.push({ type, elite: RNG.chance(eliteChance), hpMul: unitMul });
      // 벌레 떼는 4마리씩 몰려온다 (1마리 몫으로 취급)
      if (type === 'swarm') {
        for (let k = 0; k < 3; k++) comp.push({ type: 'swarm', elite: false, hpMul: unitMul });
      }
    }
    // 중간보스 (우두머리): 층당 최소 1회 보장 — 12% 운빨로는 절반의 층을 그냥 지나쳤다 (기대 0.6회/층)
    // 방마다 14%, 층 후반(보스 전 4방)까지 안 나왔으면 확정 난입. 심층(6층+)은 두 번째 우두머리 12%.
    // 단, 확정 보장은 3층부터 — 2층 확정은 초반 약체 빌드에 과했다 (계측: 검사 2층 사망 1→11회)
    // R1: 2층 확률 14→8% (초반 완화), 지름길 층은 25% + 2번째 해금
    if (this.floor >= 2) {
      const roomsLeft = this.totalRooms - 1 - this.roomIndex; // 보스방 전까지 남은 방 수
      const force = !this.miniSeen && roomsLeft <= 4 && this.floor >= 3;
      // 심층 2번째 우두머리 12→20% (2026-07 몬스터 확장 — 중간보스 조우 상향)
      let chance = this.miniSeen
        ? ((this.floor >= 6 || this.shortcutHot) ? 0.2 : 0)
        : (this.shortcutHot ? 0.25 : this.floor === 2 ? 0.08 : 0.14);
      if (force || RNG.chance(chance)) {
        // 소형 쫄은 우두머리 감이 아니다 (거대화해도 위협 패턴이 빈약)
        const MINI_EXCLUDE = ['swarm', 'sporePuff', 'cinder', 'voidSpawn', 'bat', 'bloodBat'];
        const pool = data.enemies.filter((t) => !MINI_EXCLUDE.includes(t));
        comp.push({ type: RNG.pick(pool.length ? pool : data.enemies), elite: false, mini: true });
        this.miniSeen = true;
      }
    }
    return comp;
  },

  eliteComp(depth) {
    const data = floorData(this.floor);
    const comp = [];
    const nElites = depth >= 6 || this.floor >= 4 ? 2 : 1;
    for (let i = 0; i < nElites; i++) {
      comp.push({ type: RNG.pick(data.enemies), elite: true });
    }
    comp.push({ type: RNG.pick(data.enemies), elite: false });
    comp.push({ type: RNG.pick(data.enemies), elite: false });
    comp.push({ type: RNG.pick(data.enemies), elite: false });
    comp.push({ type: RNG.pick(data.enemies), elite: false });
    return comp;
  },
};
