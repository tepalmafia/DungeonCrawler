// 던전 구조: 5개 층 × (방 8개 + 보스방). 층마다 테마·적 구성·환경 기믹이 다르다.
const ROOM_META = {
  combat:    { label: '전투',    color: '#e8e0cf' },
  elite:     { label: '정예',    color: '#b13ae0' },
  treasure:  { label: '보물',    color: '#f7b32b' },
  camp:      { label: '모닥불',  color: '#ff7043' },
  event:     { label: '기연',    color: '#b13ae0' },
  boss:      { label: '보스',    color: '#e43b44' },
  nextfloor: { label: '다음 층', color: '#38b764' },
  shortcut:  { label: '지름길',  color: '#e43b44' },
};

// ── 설계된 위협 세트 (R2) — 무리가 '물량'이 아니라 '퍼즐'이 되도록.
// 방 구성의 45%는 랜덤 샘플 대신 손제작 조합에서 뽑는다: 우선순위 판단이 생긴다.
const THREAT_SETS = [
  { min: 1, units: ['skeleton', 'skeleton', 'archer', 'archer'] },              // 근접 압박 + 후방 화살
  { min: 2, units: ['frog', 'frog', 'bat', 'bat', 'bat'] },                     // 독 장판 위 급강하
  { min: 3, units: ['shieldSkeleton', 'shieldSkeleton', 'sniper', 'sniper'] },  // 방패벽 뒤 저격수 — 우회 퍼즐
  { min: 3, units: ['golem', 'archer', 'archer', 'archer'] },                   // 탱커가 몸으로 막는 화력선
  { min: 4, units: ['berserker', 'berserker', 'wisp', 'wisp'] },                // 돌격 + 원거리 견제
  { min: 5, units: ['shaman', 'brute', 'brute'] },                              // 힐러 컷 퍼즐
  { min: 5, units: ['necro', 'necro', 'shieldSkeleton', 'shieldSkeleton'] },    // 이중 소환 + 방패벽
  { min: 6, units: ['bomber', 'bomber', 'boar', 'boar'] },                      // 자폭 유도 + 돌진 교차
  { min: 7, units: ['turret', 'turret', 'stalker', 'stalker'] },                // 고정 화망 + 은신 기습
  { min: 8, units: ['executioner', 'frostArcher', 'frostArcher', 'leech', 'leech'] }, // 처형 구역+빙결+흡혈
];

// 층별 데이터 (기획안 §8.2)
const FLOOR_DATA = {
  1: { name: '지하 묘지',   enemies: ['slime', 'slime', 'skeleton', 'archer', 'boar', 'swarm'], rule: null },
  2: { name: '곰팡이 동굴', enemies: ['mushroom', 'bat', 'toxicSlime', 'spider', 'frog', 'leech'], rule: '독 안개를 피하라' },
  3: { name: '잊힌 감옥',   enemies: ['golem', 'wraith', 'archer', 'shieldSkeleton', 'iceSlime', 'sniper'], rule: '골렘은 등 뒤가 약점' },
  4: { name: '용암 심층',   enemies: ['fireSpirit', 'lavaHound', 'boar', 'wisp', 'berserker', 'golem'], rule: '용암을 밟지 마라' },
  5: { name: '심연의 옥좌', enemies: ['wraith', 'fireSpirit', 'necro', 'shaman', 'crystal', 'archer', 'golem'], rule: '어둠이 시야를 가린다' },
  // 6~10층: 심층 — 층마다 전용 신규 몬스터가 등장한다
  6: { name: '피의 묘지',   enemies: ['bomber', 'bomber', 'ghoul', 'charger', 'skeleton', 'wraith', 'necro', 'swarm', 'brute'], rule: '폭탄벌레가 붉게 빛나면 도망쳐라' },
  7: { name: '맹독 심연',   enemies: ['thornPlant', 'thornPlant', 'turret', 'mimic', 'frog', 'toxicSlime', 'spider', 'necro'], rule: '가시덩굴은 움직이지 않는다 — 각도를 노려라' },
  8: { name: '절망의 감옥', enemies: ['executioner', 'executioner', 'stalker', 'brute', 'sniper', 'shieldSkeleton', 'iceSlime'], rule: '처형자의 붉은 구역에서 벗어나라' },
  9: { name: '겁화의 핵',   enemies: ['magmaSlime', 'magmaSlime', 'imp', 'wisp', 'berserker', 'lavaHound', 'fireSpirit', 'golem'], rule: '마그마 슬라임은 죽어도 끝이 아니다' },
  10: { name: '심연의 왕좌', enemies: ['voidEye', 'voidEye', 'glutton', 'frostArcher', 'stalker', 'crystal', 'shaman', 'necro'], rule: '공허의 눈은 추적탄을 쏜다 — 직각으로 대시하라' },
};

// 11층+ (무한 모드 '심연 회랑'): 6~10층 구성을 순환하며 끝없이 강해진다
function floorData(floor) {
  if (FLOOR_DATA[floor]) return FLOOR_DATA[floor];
  const base = FLOOR_DATA[((floor - 11) % 5) + 6];
  return { name: `심연 회랑 ${floor}층`, enemies: base.enemies, rule: base.rule };
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

  newRun() {
    this.floor = 1;
    this.roomIndex = 1;
    this.tookTreasure = false;
    this.tookCamp = false;
    this.tookEvent = false;
    this.miniSeen = false;
    this.shortcutHot = false;
    this.build('combat');
  },

  nextFloor() {
    this.floor++;
    this.roomIndex = 1;
    this.tookTreasure = false;
    this.tookCamp = false;
    this.tookEvent = false;
    this.miniSeen = false;
    this.shortcutHot = false; // 지름길 효과는 도착 층에서만
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
      this.tookCamp = false;
      this.tookEvent = false;
      this.miniSeen = false;
      this.shortcutHot = true;
      this.build('combat');
      return;
    }
    if (type === 'treasure') this.tookTreasure = true;
    if (type === 'camp') this.tookCamp = true;
    if (type === 'event') this.tookEvent = true;
    this.roomIndex++;
    this.build(type);
  },

  build(type) {
    this.roomType = type;
    World.buildRoom(this.roomIndex, type, this.floor);
    Game.onRoomBuilt(type);
  },

  floorName() {
    return floorData(this.floor).name;
  },

  doorOptions() {
    const next = this.roomIndex + 1;
    if (next >= this.totalRooms) {
      return [{ type: 'boss', ...ROOM_META.boss }];
    }
    const options = ['combat'];
    const pool = [];
    if (next >= 3) pool.push('elite', 'elite');
    // 보물·모닥불은 층당 1회만 — 한 번 들어가면 그 층에서는 다시 나오지 않는다
    if (!this.tookTreasure) pool.push('treasure');
    if (!this.tookCamp && next >= 4) pool.push('camp');
    if (!this.tookEvent && next >= 3) pool.push('event'); // 기연: 리스크-리워드 이벤트
    pool.push('combat');

    const n = RNG.int(2, 3);
    while (options.length < n && pool.length > 0) {
      const pick = pool.splice(Math.floor(RNG.next() * pool.length), 1)[0];
      if (!options.includes(pick)) options.push(pick);
    }
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(RNG.next() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
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
    const heatBonus = Game.heat >= 2 ? 2 : 0; // 열기 2: 적 수 증가
    // 물량감: 로그라이크다운 무리 전투. 곡선 뒤집기(R1): 1~2층은 -2 — 사망의 90%가
    // 1~2층에 몰리는 역전 곡선 보정 (신규 이탈 구간 완화)
    const earlyEase = this.floor <= 2 ? 2 : 0;
    const n = Math.max(3, Math.min(16, 3 + Math.ceil(depth * 0.9) + Math.floor((this.floor - 1) * 0.9) + heatBonus - earlyEase));
    let eliteChance = Math.min(0.4, 0.03 + (this.floor - 1) * 0.04); // 층당 4%, 상한 40% (무한 모드)
    if (this.shortcutHot) eliteChance = Math.min(0.5, eliteChance * 2); // 지름길 층: 정예 2배

    // 설계된 위협 세트 (R2): 45% 확률로 손제작 조합이 무리의 뼈대가 된다
    const sets = THREAT_SETS.filter((s) => this.floor >= s.min);
    if (sets.length && RNG.chance(0.45)) {
      const set = RNG.pick(sets);
      for (const t of set.units) comp.push({ type: t, elite: RNG.chance(eliteChance * 0.5) });
      comp.setUsed = true;
    }
    while (comp.length < n) {
      const type = RNG.pick(data.enemies);
      comp.push({ type, elite: RNG.chance(eliteChance) });
      // 벌레 떼는 4마리씩 몰려온다 (1마리 몫으로 취급)
      if (type === 'swarm') {
        for (let k = 0; k < 3; k++) comp.push({ type: 'swarm', elite: false });
      }
    }
    // 중간보스 (우두머리): 층당 최소 1회 보장 — 12% 운빨로는 절반의 층을 그냥 지나쳤다 (기대 0.6회/층)
    // 방마다 14%, 층 후반(보스 전 4방)까지 안 나왔으면 확정 난입. 심층(6층+)은 두 번째 우두머리 12%.
    // 단, 확정 보장은 3층부터 — 2층 확정은 초반 약체 빌드에 과했다 (계측: 검사 2층 사망 1→11회)
    // R1: 2층 확률 14→8% (초반 완화), 지름길 층은 25% + 2번째 해금
    if (this.floor >= 2) {
      const roomsLeft = this.totalRooms - 1 - this.roomIndex; // 보스방 전까지 남은 방 수
      const force = !this.miniSeen && roomsLeft <= 4 && this.floor >= 3;
      let chance = this.miniSeen
        ? ((this.floor >= 6 || this.shortcutHot) ? 0.12 : 0)
        : (this.shortcutHot ? 0.25 : this.floor === 2 ? 0.08 : 0.14);
      if (force || RNG.chance(chance)) {
        comp.push({ type: RNG.pick(data.enemies.filter((t) => t !== 'swarm')), elite: false, mini: true });
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
