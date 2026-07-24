// 던전 구조: 5개 층 × (방 8개 + 보스방). 층마다 테마·적 구성·환경 기믹이 다르다.
const ROOM_META = {
  combat:    { label: '전투',    color: '#e8e0cf' },
  elite:     { label: '정예',    color: '#b13ae0' },
  treasure:  { label: '보물',    color: '#f7b32b' },
  camp:      { label: '모닥불',  color: '#ff7043' },
  event:     { label: '기연',    color: '#b13ae0' },
  boss:      { label: '보스',    color: '#e43b44' },
  nextfloor: { label: '다음 층', color: '#38b764' },
};

// 층별 데이터 (기획안 §8.2)
const FLOOR_DATA = {
  1: { name: '지하 묘지',   enemies: ['slime', 'slime', 'skeleton', 'archer', 'boar', 'swarm'], rule: null },
  2: { name: '곰팡이 동굴', enemies: ['mushroom', 'bat', 'toxicSlime', 'spider', 'frog', 'leech'], rule: '독 안개를 피하라' },
  3: { name: '잊힌 감옥',   enemies: ['golem', 'wraith', 'archer', 'shieldSkeleton', 'iceSlime', 'sniper'], rule: '골렘은 등 뒤가 약점' },
  4: { name: '용암 심층',   enemies: ['fireSpirit', 'lavaHound', 'boar', 'wisp', 'berserker', 'golem'], rule: '용암을 밟지 마라' },
  5: { name: '심연의 옥좌', enemies: ['wraith', 'fireSpirit', 'necro', 'shaman', 'crystal', 'archer'], rule: '어둠이 시야를 가린다' },
  // 6~10층: 심층 — 층마다 전용 신규 몬스터가 등장한다
  6: { name: '피의 묘지',   enemies: ['bomber', 'bomber', 'ghoul', 'charger', 'skeleton', 'wraith', 'necro', 'swarm'], rule: '폭탄벌레가 붉게 빛나면 도망쳐라' },
  7: { name: '맹독 심연',   enemies: ['thornPlant', 'thornPlant', 'turret', 'mimic', 'frog', 'toxicSlime', 'spider', 'necro'], rule: '가시덩굴은 움직이지 않는다 — 각도를 노려라' },
  8: { name: '절망의 감옥', enemies: ['executioner', 'executioner', 'stalker', 'brute', 'sniper', 'shieldSkeleton', 'iceSlime'], rule: '처형자의 붉은 구역에서 벗어나라' },
  9: { name: '겁화의 핵',   enemies: ['magmaSlime', 'magmaSlime', 'imp', 'wisp', 'berserker', 'lavaHound', 'fireSpirit'], rule: '마그마 슬라임은 죽어도 끝이 아니다' },
  10: { name: '심연의 왕좌', enemies: ['voidEye', 'voidEye', 'glutton', 'frostArcher', 'stalker', 'crystal', 'shaman', 'necro'], rule: '공허의 눈은 추적탄을 쏜다 — 직각으로 대시하라' },
};

// 11층+ (무한 모드 '심연 회랑'): 6~10층 구성을 순환하며 끝없이 강해진다
function floorData(floor) {
  if (FLOOR_DATA[floor]) return FLOOR_DATA[floor];
  const base = FLOOR_DATA[((floor - 11) % 5) + 6];
  return { name: `심연 회랑 ${floor}층`, enemies: base.enemies, rule: base.rule };
}

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
    this.build('combat');
  },

  nextFloor() {
    this.floor++;
    this.roomIndex = 1;
    this.tookTreasure = false;
    this.tookCamp = false;
    this.tookEvent = false;
    this.build('combat');
  },

  advance(type) {
    if (type === 'nextfloor') {
      this.nextFloor();
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
    return options.map((t) => ({ type: t, ...ROOM_META[t] }));
  },

  // 전투방 적 구성 — 깊이·층에 따라 수와 정예 확률 증가
  combatComp(depth) {
    const data = floorData(this.floor);
    const comp = [];
    const heatBonus = Game.heat >= 2 ? 2 : 0; // 열기 2: 적 수 증가
    // 물량감: 로그라이크다운 무리 전투 — 기존보다 +30% 수준 (XP·하트는 마리당 하향으로 보정)
    const n = Math.min(16, 3 + Math.ceil(depth * 0.9) + Math.floor((this.floor - 1) * 0.9) + heatBonus);
    const eliteChance = Math.min(0.4, 0.03 + (this.floor - 1) * 0.04); // 층당 4%, 상한 40% (무한 모드)
    for (let i = 0; i < n; i++) {
      const type = RNG.pick(data.enemies);
      comp.push({ type, elite: RNG.chance(eliteChance) });
      // 벌레 떼는 4마리씩 몰려온다 (1마리 몫으로 취급)
      if (type === 'swarm') {
        for (let k = 0; k < 3; k++) comp.push({ type: 'swarm', elite: false });
      }
    }
    // 중간보스 (우두머리): 2층부터 방마다 12% 확률로 난입 — 그 방의 난이도가 확 뛴다
    if (this.floor >= 2 && RNG.chance(0.12)) {
      comp.push({ type: RNG.pick(data.enemies.filter((t) => t !== 'swarm')), elite: false, mini: true });
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
