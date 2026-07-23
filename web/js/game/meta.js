// 메타 프로그레션 — 죽어도 남는 것 (기획안 §6.2).
// 영혼 파편으로 영구 업그레이드·직업 해금. localStorage에 저장된다.

// 직업 3종 (기획안 §5) — 조작 감각 자체가 다르다
const CLASSES = {
  knight: {
    id: 'knight', name: '검사', sprite: 'player', color: '#3b5dc9',
    hp: 5, speed: 195, unlock: 0,
    desc: '3연격 근접 베기. 3타째는 강한 마무리.',
  },
  archer: {
    id: 'archer', name: '궁수', sprite: 'playerArcher', color: '#38b764',
    hp: 4, speed: 210, unlock: 300,
    desc: '빠른 화살 연사. 3발째는 관통 강화 화살.',
  },
  mage: {
    id: 'mage', name: '마도사', sprite: 'playerMage', color: '#8a5ac2',
    hp: 3, speed: 190, unlock: 800,
    desc: '유도 마탄. 3발째는 폭발하는 대마탄.',
  },
};

// 기억의 제단 — 영구 업그레이드 (밸런스 원칙: 초반 체감 +30% 이내)
const META_UPGRADES = [
  { id: 'vit',    name: '육체', desc: '시작 최대 HP +1',        max: 3, costs: [40, 90, 180] },
  { id: 'pow',    name: '완력', desc: '시작 공격력 +1',          max: 2, costs: [120, 320] },
  { id: 'dash',   name: '바람', desc: '대시 충전 속도 +10%',     max: 3, costs: [50, 110, 220] },
  { id: 'choice', name: '기회', desc: '레벨업 선택지 3장 → 4장', max: 1, costs: [250] },
  { id: 'greed',  name: '수확', desc: '영혼 파편 획득 +15%',     max: 3, costs: [60, 130, 260] },
];

const Meta = {
  data: null,

  _default() {
    return {
      shards: 0,
      up: {},                      // 업그레이드 레벨 {vit:1, ...}
      classes: { knight: true },   // 해금된 직업
      cls: 'knight',               // 선택된 직업
      runs: 0,
      bestFloor: 0,
      totalKills: 0,
      muted: false,
    };
  },

  load() {
    try {
      const raw = localStorage.getItem('dungeoncrawler_meta');
      this.data = raw ? { ...this._default(), ...JSON.parse(raw) } : this._default();
    } catch (e) {
      this.data = this._default();
    }
  },

  save() {
    try {
      localStorage.setItem('dungeoncrawler_meta', JSON.stringify(this.data));
    } catch (e) { /* 시크릿 모드 등 저장 불가 환경 무시 */ }
  },

  lvl(id) {
    return this.data.up[id] || 0;
  },

  upgradeDef(id) {
    return META_UPGRADES.find((u) => u.id === id);
  },

  cost(id) {
    const def = this.upgradeDef(id);
    const lv = this.lvl(id);
    return lv >= def.max ? null : def.costs[lv];
  },

  buy(id) {
    const c = this.cost(id);
    if (c === null || this.data.shards < c) return false;
    this.data.shards -= c;
    this.data.up[id] = this.lvl(id) + 1;
    this.save();
    return true;
  },

  classUnlocked(id) {
    return !!this.data.classes[id];
  },

  unlockClass(id) {
    const cls = CLASSES[id];
    if (!cls || this.classUnlocked(id) || this.data.shards < cls.unlock) return false;
    this.data.shards -= cls.unlock;
    this.data.classes[id] = true;
    this.data.cls = id;
    this.save();
    return true;
  },

  selectClass(id) {
    if (!this.classUnlocked(id)) return false;
    this.data.cls = id;
    this.save();
    return true;
  },

  // 런 정산: 도달 층수·처치 수 비례 (기획안 §2-5)
  runReward(floor, roomIndex, kills, victory) {
    const base = kills + (floor - 1) * 25 + (roomIndex - 1) * 2 + (victory ? 100 : 0);
    return Math.max(1, Math.round(base * (1 + 0.15 * this.lvl('greed'))));
  },

  endRun(floor, roomIndex, kills, victory) {
    const earned = this.runReward(floor, roomIndex, kills, victory);
    this.data.shards += earned;
    this.data.runs++;
    this.data.totalKills += kills;
    this.data.bestFloor = Math.max(this.data.bestFloor, victory ? 5 : floor);
    this.save();
    return earned;
  },
};
