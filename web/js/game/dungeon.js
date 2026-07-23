// 던전 구조: 1층 = 방 8개 + 보스방. 갈림길에서 다음 방 종류를 보고 선택한다.
const ROOM_META = {
  combat:   { label: '전투',   color: '#e8e0cf' },
  elite:    { label: '정예',   color: '#b13ae0' },
  treasure: { label: '보물',   color: '#f7b32b' },
  camp:     { label: '모닥불', color: '#ff7043' },
  boss:     { label: '보스',   color: '#e43b44' },
};

const Dungeon = {
  floor: 1,
  roomIndex: 1,
  totalRooms: 9, // 일반 8 + 보스 1
  roomType: 'combat',

  newRun() {
    this.roomIndex = 1;
    this.build('combat');
  },

  advance(type) {
    this.roomIndex++;
    this.build(type);
  },

  build(type) {
    this.roomType = type;
    World.buildRoom(this.roomIndex, type);
    Game.onRoomBuilt(type);
  },

  // 다음 방 갈림길 옵션 (2~3개). 마지막 방 다음은 무조건 보스.
  doorOptions() {
    const next = this.roomIndex + 1;
    if (next >= this.totalRooms) {
      return [{ type: 'boss', ...ROOM_META.boss }];
    }
    const options = ['combat']; // 최소 1개는 전투 (XP 수급 보장)
    const pool = [];
    if (next >= 3) pool.push('elite', 'elite');
    pool.push('treasure');
    if (next >= 2) pool.push('camp');
    pool.push('combat');

    const n = RNG.int(2, 3);
    while (options.length < n && pool.length > 0) {
      const pick = pool.splice(Math.floor(RNG.next() * pool.length), 1)[0];
      if (!options.includes(pick)) options.push(pick);
    }
    // 순서 섞기 (전투가 항상 첫 번째가 되지 않도록)
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(RNG.next() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return options.map((t) => ({ type: t, ...ROOM_META[t] }));
  },

  // 전투방 적 구성 — 깊이에 따라 수와 종류 증가
  combatComp(depth) {
    const comp = [];
    const n = 2 + Math.ceil(depth * 0.8);
    for (let i = 0; i < n; i++) {
      let type = 'slime';
      if (depth >= 2 && RNG.chance(0.3)) type = 'archer';
      if (depth >= 3 && RNG.chance(0.18)) type = 'boar';
      comp.push({ type, elite: false });
    }
    return comp;
  },

  eliteComp(depth) {
    const comp = [];
    const nElites = depth >= 6 ? 2 : 1;
    for (let i = 0; i < nElites; i++) {
      comp.push({ type: RNG.pick(['slime', 'archer', 'boar']), elite: true });
    }
    comp.push({ type: 'slime', elite: false }, { type: 'slime', elite: false });
    return comp;
  },
};
