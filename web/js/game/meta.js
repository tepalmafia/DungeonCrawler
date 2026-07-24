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
    hp: 4, speed: 200, unlock: 300,
    desc: '빠른 화살 연사. 3발째는 관통 강화 화살.',
  },
  mage: {
    id: 'mage', name: '마도사', sprite: 'playerMage', color: '#8a5ac2',
    hp: 3, speed: 190, unlock: 800,
    desc: '유도 마탄. 3발째는 폭발하는 대마탄.',
  },
};

// 도감 — 몬스터 목록 (일반 17종 + 보스 5종). 처치하면 발견된다.
const CODEX_ENEMIES = [
  { id: 'slime',      name: '슬라임',       sprite: 'slime',      desc: '던전에서 가장 흔한 주민. 통통 튀며 다가온다.' },
  { id: 'toxicSlime', name: '독 슬라임',    sprite: 'toxicSlime', desc: '죽으면 독구름을 남긴다. 시체 위를 밟지 마라.' },
  { id: 'archer',     name: '해골 궁수',    sprite: 'archer',     desc: '조준선이 붉게 고정되면 발사된다. 대시로 피하라.' },
  { id: 'boar',       name: '돌진 멧돼지',  sprite: 'boar',       desc: '벽으로 유인하면 스스로 부딪혀 그로기에 빠진다.' },
  { id: 'lavaHound',  name: '용암 개',      sprite: 'lavaHound',  desc: '더 빠른 돌진, 그리고 지나간 자리에 불길을 남긴다.' },
  { id: 'mushroom',   name: '버섯',         sprite: 'mushroom',   desc: '가까이 다가가면 부풀어 올라 포자를 사방에 터뜨린다.' },
  { id: 'bat',        name: '박쥐',         sprite: 'bat',        desc: '어지러운 궤도로 날아든다. 예측하지 말고 반응하라.' },
  { id: 'spider',     name: '독거미',       sprite: 'spider',     desc: '거미줄에 맞으면 발이 느려진다.' },
  { id: 'golem',      name: '간수 골렘',    sprite: 'golem',      desc: '정면 공격은 막아낸다. 등 뒤가 약점.' },
  { id: 'wraith',     name: '망령',         sprite: 'wraith',     desc: '비물질 상태로 벽을 통과한다. 실체화됐을 때만 벨 수 있다.' },
  { id: 'fireSpirit', name: '화염 정령',    sprite: 'fireSpirit', desc: '화염구의 착탄 지점에 불길이 남는다.' },
  { id: 'necro',      name: '강령술사',     sprite: 'necro',      desc: '도망다니며 부하를 소환한다. 최우선으로 처치하라.' },
  { id: 'bomber',      name: '폭탄벌레',     sprite: 'bomber',      desc: '붙으면 심지에 불을 붙이고 자폭한다. 자폭당하면 보상도 없다 — 터지기 전에 잡아라.' },
  { id: 'thornPlant',  name: '가시덩굴',     sprite: 'thornPlant',  desc: '움직이지 않는 대신 가시 산탄을 3연발로 퍼붓는다. 산탄 사이 틈으로 파고들어라.' },
  { id: 'executioner', name: '처형자',       sprite: 'executioner', desc: '바닥에 붉은 처형 구역을 그린 뒤 도끼를 내려찍는다. 구역 밖이면 안전하다.' },
  { id: 'magmaSlime',  name: '마그마 슬라임', sprite: 'magmaSlime', desc: '죽으면 불길을 남기고 작은 마그마 둘로 갈라진다. 광역기로 한꺼번에 정리하라.' },
  { id: 'voidEye',     name: '공허의 눈',    sprite: 'voidEye',     desc: '다가가면 순간이동으로 도망치며 추적탄을 쏜다. 추적탄은 직각 대시로 뿌리쳐라.' },
  { id: 'boss1', boss: true, name: '무덤지기 카론',     sprite: 'boss',      desc: '1층의 주인. 낫 연격과 영혼 부채꼴, 그리고 저주 지대.' },
  { id: 'boss2', boss: true, name: '포자왕 믹서스',     sprite: 'bossSpore', desc: '2층의 주인. 부하가 살아있는 동안 재생한다 — 부하를 한꺼번에 쓸어담을 수단을 연구하라.' },
  { id: 'boss3', boss: true, name: '간수장 바르곤',     sprite: 'bossGolem', desc: '3층의 주인. 중장갑이 강한 일격을 경감한다 — 갑옷을 무시하고 스며드는 피해가 열쇠.' },
  { id: 'boss4', boss: true, name: '용암 심장 이그니스', sprite: 'bossIgnis', desc: '4층의 주인. 시간이 지날수록 백열해 빨라진다 — 속전속결하거나, 오래 버틸 몸을 만들라.' },
  { id: 'boss5', boss: true, name: '심연의 군주 눅스',   sprite: 'bossAbyss', desc: '탑의 정점. 어둠 장막 중에는 영혼 구슬만이 유일한 약점 — 흩어진 구슬을 잡을 기동력을 갖춰라.' },
];

// 기억의 제단 — 영구 업그레이드 (밸런스 원칙: 초반 체감 +30% 이내)
const META_UPGRADES = [
  { id: 'vit',    name: '육체', desc: '시작 최대 HP +1',        max: 3, costs: [40, 90, 180] },
  { id: 'pow',    name: '완력', desc: '시작 공격력 +1',          max: 2, costs: [120, 320] },
  { id: 'dash',   name: '바람', desc: '대시 충전 속도 +10%',     max: 3, costs: [50, 110, 220] },
  { id: 'choice', name: '기회', desc: '레벨업 선택지 3장 → 4장', max: 1, costs: [250] },
  { id: 'greed',  name: '수확', desc: '영혼 파편 획득 +15%',     max: 3, costs: [60, 130, 260] },
  { id: 'reroll', name: '환생', desc: '레벨업 카드 다시 뽑기 +1회/런 (E)', max: 3, costs: [150, 300, 500] },
  { id: 'legacy', name: '유산', desc: '런 시작 시 커먼 유물 3택1',  max: 1, costs: [400] },
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
      wins: 0,
      bestFloor: 0,
      totalKills: 0,
      heat: 0,       // 열기 (고난이도 0~5, 첫 클리어 후 해금)
      muted: false,
      codex: { kills: {}, relics: {}, traits: {} }, // 도감 기록
      welcomed: false, // 환영 파편 지급 여부
    };
  },

  load() {
    try {
      const raw = localStorage.getItem('dungeoncrawler_meta');
      this.data = raw ? { ...this._default(), ...JSON.parse(raw) } : this._default();
    } catch (e) {
      this.data = this._default();
    }
    // 환영 선물: 처음부터 다른 직업을 해금해 볼 수 있도록 파편 지급 (1회)
    if (!this.data.welcomed) {
      this.data.welcomed = true;
      this.data.shards += 800;
      this.save();
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

  // ── 도감 기록 (kills는 방 클리어/정산 시점에 저장) ──
  codexKill(key) {
    this.data.codex.kills[key] = (this.data.codex.kills[key] || 0) + 1;
  },

  codexRelic(id) {
    if (!this.data.codex.relics[id]) {
      this.data.codex.relics[id] = true;
      this.save();
    }
  },

  codexTrait(id) {
    this.data.codex.traits[id] = (this.data.codex.traits[id] || 0) + 1;
  },

  // 열기(고난이도)는 탑을 한 번 정복해야 해금된다
  heatUnlocked() {
    return this.data.wins > 0 || this.data.bestFloor >= 5;
  },

  heat() {
    return this.heatUnlocked() ? Math.min(5, Math.max(0, this.data.heat)) : 0;
  },

  setHeat(h) {
    this.data.heat = Math.min(5, Math.max(0, h));
    this.save();
  },

  // 런 정산: 도달 층수·처치 수 비례 + 열기 보너스 (기획안 §2-5)
  runReward(floor, roomIndex, kills, victory, heat = 0) {
    const base = kills + (floor - 1) * 25 + (roomIndex - 1) * 2 + (victory ? 100 : 0);
    return Math.max(1, Math.round(base * (1 + 0.15 * this.lvl('greed')) * (1 + 0.2 * heat)));
  },

  endRun(floor, roomIndex, kills, victory, heat = 0) {
    const earned = this.runReward(floor, roomIndex, kills, victory, heat);
    this.data.shards += earned;
    this.data.runs++;
    this.data.totalKills += kills;
    if (victory) this.data.wins++;
    this.data.bestFloor = Math.max(this.data.bestFloor, victory ? 10 : floor);
    this.save();
    return earned;
  },
};
