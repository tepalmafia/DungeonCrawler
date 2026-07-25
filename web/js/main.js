// 게임 루프 + 던전 진행 + 전투 판정 허브.
// 상태: hub | altar | classes | play | levelup | relic | transition | over | victory
const PROJ_STYLES = {
  arrow: { color: '#a99e8c', sprite: true },
  soul:  { color: '#b13ae0', r: 7, wavy: true },
  spore: { color: '#8a5ac2', r: 6 },
  fire:  { color: '#ff7043', r: 6, patchOnEnd: true },
  rock:  { color: '#6b7a94', r: 6 },
  web:   { color: '#e8e0cf', r: 5 },
  thorn: { color: '#7ab04c', r: 5 },
  voidorb: { color: '#b13ae0', r: 8, wavy: false },
  ice:   { color: '#a9e3ff', r: 5 },
  shard: { color: '#c9b8e8', r: 4 },
  mana:  { color: '#b89ae8', r: 5 },
};

const Game = {
  state: 'hub',
  player: null,
  enemies: [],
  arrows: [],
  pbolts: [],       // 플레이어 투사체 (궁수 화살 / 마도사 마탄)
  rains: [],        // 궁수 스킬: 화살비
  meteors: [],      // 마도사 스킬: 메테오
  pickups: [],
  orbs: [],
  zones: [],        // 적에게 피해 주는 장판 (감전/독구름)
  firePatches: [],  // 플레이어에게 피해 주는 장판 (불길/독)
  rings: [],        // 확장 충격파 링
  markers: [],
  pendingSpawns: [],
  interactables: [],
  bossSlashes: [],
  corpses: [],      // 사망 연출 (무너져 내리는 잔상)
  kills: 0,
  time: 0,
  hitstop: 0,
  banner: null,
  vignette: 0,
  critFlash: 0,  // 크리티컬 순간 화면 백색 섬광
  hurtFlash: 0,  // 피격 순간 화면 적색 섬광
  overLockT: 0,  // 사망/승리 화면 진입 직후 입력 잠금 (오클릭 방지)
  blinkT: 0,

  xp: 0,
  level: 1,
  xpNext: 36,
  pendingChoices: 0,
  traitCards: [],
  relicCards: [],
  choiceReason: 'levelup',
  bossRewardT: 0,

  roomCleared: false,
  transition: null,
  codexTab: 0, // 도감 탭 (0 몬스터 / 1 유물 / 2 특성)
  testMode: false, // 테스트 모드 (거점에서 T, 또는 ?test=1)
  showInventory: false, // 획득 목록 (Tab)
  choiceLockT: 0,   // 카드 UI 오클릭 방지 잠금 시간
  gaveUp: false,    // 런 포기 여부 (정산 화면 문구)

  // 런 정산
  runEnded: false,
  shardsEarned: 0,
  shardAnimT: 0,
  runSeed: 0,
  heat: 0,
  paused: false,

  // 반응 학습 (완성도 점검 ②): 각 교차 반응의 첫 발동 순간에 1회 설명 —
  // 계측 결과 반응이 30분에 7회뿐(과부하 0회) = 시스템이 묻혀 있었다. 발견을 가르쳐야 쓴다
  teachReaction(id, text) {
    if (!Meta.data.rxSeen) Meta.data.rxSeen = {};
    if (Meta.data.rxSeen[id]) return;
    Meta.data.rxSeen[id] = true;
    Meta.save();
    this.banner = { text: '✦ 반응 발견! ' + text, life: 3.2, maxLife: 3.2, color: '#ffd866' };
  },

  // ── 런 중단 저장 (완성도 점검 ①): 방 입장마다 스냅샷 — 브라우저를 닫아도 이어서 ──
  // 특성/유물은 id 목록을 재적용해 복원하고, 스칼라(HP·골드·XP)는 그대로 덮어쓴다.
  saveRun() {
    if (this.testMode && !this._forceSave) return; // 봇 계측 오염 방지
    if (this.runEnded || Dungeon.floor > 40 || this.endless || this.bossRush) return; // 무한 모드·보스 러시는 저장 없음
    const p = this.player;
    try {
      localStorage.setItem('dungeoncrawler_run', JSON.stringify({
        v: 1, cls: p.classId, heat: this.heat, pacts: this.pacts,
        act: this.act || 1, sp: this.shardsPaid || 0, kp: this.killsPaid || 0,
        floor: Dungeon.floor, roomIndex: Dungeon.roomIndex, roomType: Dungeon.roomType,
        took: {
          t: Dungeon.tookTreasure, c: Dungeon.tookCamp, e: Dungeon.tookEvent,
          s: Dungeon.tookSiege, m: Dungeon.tookMerchant, tr: Dungeon.trialSeen,
        },
        level: this.level, xp: this.xp, xpNext: this.xpNext, kills: this.kills,
        time: this.time, gold: this.gold,
        traits: [...p.traits], relics: [...p.relics],
        hp: p.hp, maxHp: p.maxHp, bonusAtk: p.bonusAtk, rerolls: p.rerolls || 0,
        sub: p.subSkill || null, shrineSeen: this._shrineSeen || 0,
        ult: p.ult || 0, ultG: p.ultGauge || 0,
        floorAtk: p.floorAtk || 0, reviveUsed: !!p.reviveUsed,
      }));
    } catch (e) { /* 저장 실패는 게임을 막지 않는다 */ }
  },

  loadRunSave() {
    try {
      const raw = localStorage.getItem('dungeoncrawler_run');
      const s = raw ? JSON.parse(raw) : null;
      return s && s.v === 1 ? s : null;
    } catch (e) { return null; }
  },

  clearRunSave() {
    try { localStorage.removeItem('dungeoncrawler_run'); } catch (e) {}
  },

  resumeRun() {
    const s = this.loadRunSave();
    if (!s) return false;
    Meta.data.cls = s.cls;
    this.restart();
    // 버그 수정: 유산 각인(시작 유물 3택1)이 이어하기마다 다시 열리던 문제 —
    // 시작 보상은 원래 런에서 이미 받았다. restart가 연 선택창을 닫는다
    this.relicCards = [];
    this._relicSource = null;
    this.state = 'play';
    // 열기 서약·진행도 복원
    this.heat = s.heat;
    this.pacts = s.pacts || Meta.pactFlags(s.heat);
    this.level = s.level; this.xp = s.xp; this.xpNext = s.xpNext;
    this.kills = s.kills; this.time = s.time; this.gold = s.gold;
    // 2막 진행 복원 — 정산 이중 지급 방지 장부까지
    this.act = s.act || (s.act2 ? 2 : 1); this.shardsPaid = s.sp || 0; this.killsPaid = s.kp || 0;
    const p = this.player;
    p.traits = []; p.relics = [];
    for (const id of s.traits) { const t = TRAITS.find((x) => x.id === id); if (t) applyTrait(p, t); }
    for (const id of s.relics) { const r = RELICS.find((x) => x.id === id); if (r) applyRelic(p, r); }
    // 스칼라는 저장값이 진실 (기연·제단·상점의 흔적 포함)
    p.maxHp = s.maxHp; p.hp = s.hp; p.bonusAtk = s.bonusAtk;
    p.rerolls = s.rerolls; p.floorAtk = s.floorAtk; p.reviveUsed = s.reviveUsed;
    p.subSkill = s.sub || null; this._shrineSeen = s.shrineSeen || 0;
    p.ult = s.ult || 0; p.ultGauge = s.ultG || 0;
    Dungeon.floor = s.floor; Dungeon.roomIndex = s.roomIndex;
    Dungeon.tookTreasure = s.took.t; Dungeon.tookCamp = s.took.c; Dungeon.tookEvent = s.took.e;
    Dungeon.tookSiege = s.took.s; Dungeon.tookMerchant = s.took.m; Dungeon.trialSeen = s.took.tr;
    Dungeon.build(s.roomType);
    this.banner = { text: '이어서 도전한다 — ' + s.floor + '층', life: 2.0, maxLife: 2.0, color: '#2ec4b6' };
    return true;
  },

  restart(seed) {
    // 시드 런: 같은 시드 + 같은 선택 = 같은 던전 (기획안 §8.1)
    if (seed == null && this._urlSeed != null) {
      seed = this._urlSeed;
      this._urlSeed = null; // URL 시드는 첫 런에만 적용
    }
    this.runSeed = seed != null ? seed : Math.floor(Math.random() * 36 ** 6);
    RNG.seed(this.runSeed);
    this.heat = Meta.heat();
    this.pacts = Meta.pactFlags(this.heat); // 열기 서약 스냅샷 (골라담기)
    this.gold = 0; // 런 화폐 — 무덤까지 못 가져간다 (상인에게만 쓴다)
    this.player = createPlayer(0, 0, Meta.data.cls);
    this.player.rerolls = Meta.lvl('reroll'); // 환생 각인: 런당 카드 리롤 횟수
    if (this.pacts.boss) {
      this.player.maxHp = Math.max(1, this.player.maxHp - 1);
      this.player.hp = this.player.maxHp;
    }
    this.paused = false;
    this.showInventory = false;
    this.gaveUp = false;
    this.runEnded = false;
    this.dailyRun = false; // 오늘의 탑은 startDaily()로만 (R 재도전은 일반 런)
    this.bossRush = false; // 보스 러시는 startBossRush()로만
    this.deathInfo = null;
    this._lastHurtBy = null;
    this.slowmoT = 0; // 완벽 회피 슬로모
    this._roomMod = null;
    this.endless = false;
    this.act = 1;
    this._shrineSeen = 0;
    this._subChoice = false;
    this.shardsPaid = 0;
    this.killsPaid = 0;
    this.shardsEarned = 0;
    this.shardAnimT = 0;
    this.kills = 0;
    this.time = 0;
    this.hitstop = 0;
    this.banner = null;
    this.vignette = 0;
    this.critFlash = 0;
    this.hurtFlash = 0;
    this.xp = 0;
    this.level = 1;
    this.xpNext = 40; // 36→40: 레벨 유입 감속 (실플레이: 특성이 너무 빨리 쌓여 금방 쉬워진다)
    this.pendingChoices = 0;
    this.traitCards = [];
    this.relicCards = [];
    this.bossRewardT = 0;
    Particles.clear();
    this.state = 'play';
    Dungeon.newRun();

    // 오프닝 — 부활 연출 (기획 §2): 첫 런은 풀 시퀀스, 이후엔 한 줄만
    {
      const cls = CLASSES[Meta.data.cls] || CLASSES.knight;
      if (!Meta.data.introSeen) {
        Meta.data.introSeen = true; Meta.save();
        this._storyQ = [
          { text: '그날 밤, 죄인의 묘지에서 눈이 떠졌다.', color: '#9a9488' },
          { text: `"${cls.grudge}"`, color: '#c8c0a8' },
          { text: '기억은 온전하다. 이유만 모른다 — 단서를 모아, 왕좌로.', color: '#8a1c2c' },
        ];
      } else if (!this.bossRush && !this.dailyRun) {
        this._storyQ = [{ text: `${cls.name} — 흙을 털고 다시 일어선다. 왕좌는 아직 멀다.`, color: '#9a9488' }];
      }
    }

    // 유산 각인: 런 시작 시 커먼 유물 3택1 (기존 유물 선택 UI 재사용)
    if (Meta.lvl('legacy') > 0) {
      const commons = RELICS.filter((r) => r.rarity === 'common');
      const picks = [];
      const pool = [...commons];
      while (picks.length < 3 && pool.length > 0) {
        picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      }
      if (picks.length > 0) {
        this.relicCards = picks;
        this._relicSource = 'legacy'; // 보스 보상 흐름(다음 층 문)을 타지 않는다
        this.state = 'relic';
        this.choiceLockT = 0.4;
      }
    }
  },

  onRoomBuilt(type) {
    // 층 첫 방: 담금질(층 한정 공격력) 만료
    if (Dungeon.roomIndex === 1 && this.player) this.player.floorAtk = 0;
    this._roomHearts = 0; // 방당 하트 소프트캡 카운터 리셋
    this.enemies = [];
    this.arrows = [];
    this.pbolts = [];
    this.rains = [];
    this.meteors = [];
    this.orbs = [];
    this.zones = [];
    this.firePatches = [];
    this.rings = [];
    this.markers = [];
    this.pendingSpawns = [];
    this.interactables = [];
    this.bossSlashes = [];
    this.corpses = [];
    this.roomCleared = false;
    Particles.clear();

    const start = World.playerStart();
    this.player.x = start.x;
    this.player.y = start.y;
    this.player.kbx = this.player.kby = 0;

    const depth = Dungeon.roomIndex;
    const floorScale = this.floorHpScale();

    // 방 템플릿 오브젝트 (M2·M3): 항아리·균열 벽 — 방 클리어 판정에서 제외되는 중립 개체
    // 일반 항아리의 18%는 폭발 항아리 — 잘 터뜨리면 무기, 잘못 터뜨리면 부상 (환경 무기)
    for (const s of (World.potSpots || [])) this.enemies.push(createPot(s.x, s.y, s.rare, !s.rare && RNG.chance(0.18)));
    for (const s of (World.crackSpots || [])) this.enemies.push(createCrack(s.tx, s.ty, s.x, s.y));
    if (World.goldCrackSpot) {
      const g = World.goldCrackSpot;
      this.enemies.push(createCrack(g.tx, g.ty, g.x, g.y, true)); // 금빛 균열 — 비밀 금고의 단서
    }
    // 가시 함정 (맵 M2): 감옥 테마 전투방 — 주기적으로 솟아 편을 가리지 않고 찌른다
    this.traps = [];
    this._siege = null;
    this._trial = null;
    if (World.hazard === 'prison' && (type === 'combat' || type === 'elite' || type === 'siege')) {
      for (let i = 0; i < 2; i++) {
        const pos = World.safeSpot(RNG.range(TS * 4, TS * 16), RNG.range(TS * 2.5, TS * 8.5) + World.offsetY);
        this.traps.push({ x: pos.x, y: pos.y, t: RNG.range(0, 2.0), state: 'idle', hit: null });
      }
    }

    // 문 수식어 (P4): 위험-보상 트레이드오프 적용
    this._roomMod = (type === 'combat' || type === 'elite') ? (Dungeon.pendingMod || null) : null;
    Dungeon.pendingMod = null;
    if (this._roomMod) {
      const data = floorData(Dungeon.floor);
      if (this._roomMod.id === 'horde') {
        for (let i = 0; i < 4; i++) {
          this.pendingSpawns.push({ delay: 1.0 + i * 0.3, type: RNG.pick(data.enemies), elite: false });
        }
      } else if (this._roomMod.id === 'guarded') {
        for (let i = 0; i < 2; i++) {
          this.pendingSpawns.push({ delay: 0.8 + i * 0.4, type: RNG.pick(data.enemies), elite: true });
        }
        // safeSpot: 템플릿 방은 중앙에 기둥이 있을 수 있다 — 벽 안에 박힌 상자는 열 수 없다
        const gc = World.center();
        const gs = World.safeSpot(gc.x, gc.y - 60);
        this.interactables.push({ kind: 'chest', x: gs.x, y: gs.y, r: 24, used: false, t: 0 });
      }
      this.banner = { text: `⚠ ${this._roomMod.label}`, life: 1.8, maxLife: 1.8, color: '#e43b44' };
    }


    // 단서 오브젝트 (기획 §4): 미획득 탐사 단서가 이 층 범위에 있으면 배치.
    // c1(덧칠된 비석)은 1층 첫 방 확정 — 부활 지점에서 첫 진실을 마주한다
    {
      const cand = CLUES.filter((c) => c.how === 'explore' && c.floors && !Meta.clueOwned(c.id) &&
        Dungeon.floor >= c.floors[0] && Dungeon.floor <= c.floors[1]);
      for (const c of cand) {
        const sure = c.guaranteed && Dungeon.roomIndex === 1;
        if (sure || (Dungeon.roomIndex > 1 && type !== 'boss' && RNG.chance(0.16))) {
          const spot = World.safeSpot(World.center().x + 140, World.center().y + 60);
          this.interactables.push({ kind: 'clue', clueId: c.id, x: spot.x, y: spot.y, r: 26, used: false, t: 0 });
          if (sure) this.banner = { text: '낯익은 비석이 보인다…', life: 2.2, maxLife: 2.2, color: '#c8c0a8' };
          break; // 방당 1개
        }
      }
    }

    // 스킬 사당 (P1): 5·15·25층의 첫 방에 무조건 선다 — 문 선택과 무관하게 킷이 자란다
    if ([5, 15, 25].includes(Dungeon.floor) && Dungeon.roomIndex === 1 && this._shrineSeen !== Dungeon.floor) {
      this._shrineSeen = Dungeon.floor;
      const sc = World.safeSpot(World.center().x, World.center().y - 90);
      this.interactables.push({ kind: 'skillShrine', x: sc.x, y: sc.y, r: 30, used: false, t: 0 });
      this.banner = { text: '스킬 사당이 빛난다 — 다가가서 보조 스킬을 고르자 (E키로 사용)', life: 3.0, maxLife: 3.0, color: '#c9d94a' };
    }

    if (type === 'combat') {
      Dungeon.combatComp(depth).forEach((s, i) => {
        this.pendingSpawns.push({ delay: 0.4 + i * 0.3, type: s.type, elite: s.elite, mini: s.mini });
      });
      // 층 첫 방이면 층 이름 배너 (지름길 도착이면 경고)
      if (depth === 1) {
        this.banner = Dungeon.shortcutHot
          ? { text: `지름길 — ${Dungeon.floor}층 ${Dungeon.floorName()} (정예가 들끓는다)`, life: 2.5, maxLife: 2.5, color: '#e43b44' }
          : { text: `${Dungeon.floor}층 — ${Dungeon.floorName()}`, life: 2.0, maxLife: 2.0 };
      }
    } else if (type === 'elite') {
      Dungeon.eliteComp(depth).forEach((s, i) => {
        this.pendingSpawns.push({ delay: 0.4 + i * 0.3, type: s.type, elite: s.elite });
      });
      this.banner = { text: '정예의 방', life: 1.4, maxLife: 1.4 };
    } else if (type === 'treasure') {
      const c = World.center();
      this.interactables.push({ kind: 'chest', x: c.x, y: c.y, r: 24, used: false, t: 0 });
    } else if (type === 'camp') {
      // 모닥불: 휴식(회복) vs 담금질(이번 층 공격력) — 하나를 고르면 다른 쪽은 사라진다
      const c = World.center();
      this.interactables.push({ kind: 'camp', x: c.x - 78, y: c.y, r: 28, used: false, t: 0 });
      this.interactables.push({ kind: 'whetstone', x: c.x + 78, y: c.y, r: 28, used: false, t: 0 });
    } else if (type === 'event') {
      const c = World.center();
      if (RNG.chance(0.4) && this.player.maxHp > 2) {
        // 악마 거래 (G2): 대가를 치르는 파워 — 최대 HP 1 ↔ 정예급 특성 선택
        this.interactables.push({ kind: 'bloodAltar', x: c.x, y: c.y, r: 26, used: false, t: 0 });
        this.banner = { text: '핏빛 제단이 고동친다... (대가: 최대 HP 1)', life: 2.2, maxLife: 2.2, color: '#e43b44' };
      } else {
        // 기연: 받아들이기 전엔 무엇인지 모른다 — 다가가면 수락(도박), 문으로 나가면 거절
        this.interactables.push({ kind: 'mystery', x: c.x, y: c.y, r: 26, used: false, t: 0 });
        this.banner = { text: '기이한 기운이 감돈다...', life: 1.8, maxLife: 1.8, color: '#b13ae0' };
      }
    } else if (type === 'merchant') {
      // 상인 (G1): 골드 sink — "지금 쓸까, 아낄까"가 이 방의 콘텐츠다
      const c = World.center();
      const f = Dungeon.floor;
      // 가격은 층 비례 가파르게 (경제 계측: 수입도 층 비례 급증) + 파편 주머니 = 후반 잉여 골드 sink
      const s1 = World.safeSpot(c.x - 180, c.y);
      const s2 = World.safeSpot(c.x - 60, c.y);
      const s3 = World.safeSpot(c.x + 60, c.y);
      const s4 = World.safeSpot(c.x + 180, c.y);
      const disc = this.player.rflags.haggle ? 0.75 : 1; // 장사꾼의 저울: -25%
      this.interactables.push({ kind: 'shopRelic', x: s1.x, y: s1.y, r: 26, used: false, t: 0, price: Math.round((40 + f * 8) * disc) });
      this.interactables.push({ kind: 'shopHeal', x: s2.x, y: s2.y, r: 26, used: false, t: 0, price: Math.round((12 + f * 3) * disc) });
      this.interactables.push({ kind: 'shopReroll', x: s3.x, y: s3.y, r: 26, used: false, t: 0, price: Math.round((18 + f * 3) * disc) });
      this.interactables.push({ kind: 'shopShards', x: s4.x, y: s4.y, r: 26, used: false, t: 0, price: Math.round((30 + f * 6) * disc), shards: 10 + f * 2 });
      this.banner = { text: "장물아비 '까마귀' — 죽은 자의 편. 골드는 왕좌까지 못 가져간다", life: 2.2, maxLife: 2.2, color: '#2ec4b6' };
    } else if (type === 'trial') {
      // 시련 (G5): 다른 층의 악몽이 섞여 몰려온다 — 이기면 확정 상급 유물 + 골드
      this._trial = true;
      Dungeon.trialComp().forEach((s, i) => {
        this.pendingSpawns.push({ delay: 0.5 + i * 0.25, type: s.type, elite: s.elite });
      });
      this.banner = { text: '시련 — 다른 층의 악몽이 몰려온다!', life: 2.2, maxLife: 2.2, color: '#b13ae0' };
    } else if (type === 'vault') {
      // 비밀 금고 (맵 M3): 진행을 소모하지 않는 순수 보너스 — 상자 1 + 진귀한 항아리 2
      // (보상 감사: 상자 2개 = 유물 2개는 무위험 대비 과함 — 보물방(유물 1)의 상위 호환이 되어버린다)
      const c = World.center();
      const s1 = World.safeSpot(c.x, c.y);
      this.interactables.push({ kind: 'chest', x: s1.x, y: s1.y, r: 24, used: false, t: 0 });
      const p1 = World.safeSpot(c.x - 150, c.y - 70);
      const p2 = World.safeSpot(c.x + 150, c.y - 70);
      this.enemies.push(createPot(p1.x, p1.y, true), createPot(p2.x, p2.y, true));
      this.banner = { text: '비밀 금고 — 마음껏 챙겨라', life: 2.0, maxLife: 2.0, color: '#ffd866' };
    } else if (type === 'siege') {
      // 습격 (맵 M4): 세 번의 파도 — 버티면 정예급 보상
      this._siege = { wave: 1, total: 3 };
      Dungeon.siegeWave(1).forEach((s, i) => {
        this.pendingSpawns.push({ delay: 1.0 + i * 0.3, type: s.type, elite: s.elite });
      });
      this.banner = { text: '습격 — 세 번의 파도를 버텨라!', life: 2.2, maxLife: 2.2, color: '#e43b44' };
    } else if (type === 'boss') {
      const c = World.center();
      const boss = createBoss(Dungeon.floor, c.x + TS * 4, c.y);
      if (this.pacts.boss) {
        boss.hp = boss.maxHp = Math.round(boss.maxHp * 1.5);
      }
      this.enemies.push(boss);
      this.banner = { text: boss.def.banner, life: 2.0, maxLife: 2.0 };
      AudioSys.bossAppear();
      Renderer.shake(5, 0.5);
    }

    this.saveRun(); // 방 입장 스냅샷 — 브라우저를 닫아도 이 방부터 이어한다
  },

  // 층별 적 HP 스케일 — 심층(6층+)은 기울기 상향 (+30%→+40%/층).
  // 계측 근거: 5층부터 받은 피해가 거의 0 — 성장(공격력·진화·유물)이 +30% 기울기를 추월한다
  floorHpScale() {
    const f = Dungeon.floor;
    return f <= 5 ? 1 + (f - 1) * 0.3 : 2.2 + (f - 5) * 0.4;
  },

  // 열기 반영 적 강화 배율
  enemyHpMul() {
    // 열기 재분배 (계측: 열기5 마도사 사망의 80%가 1층) — 평면 ×1.25 대신 층 비례:
    // 1층은 가볍게(×1.06+), 10층은 묵직하게(열기5 기준 ×1.79). 열기가 '후반 도전'이 되도록
    if (!this.pacts || !this.pacts.hp) return this.floorHpScale();
    return this.floorHpScale() * (1 + 0.012 * this.heat + 0.012 * this.heat * (Dungeon.floor - 1));
  },

  // 현재 상태에 맞는 BGM 테마 결정
  _musicKey() {
    if (this.state === 'hub' || this.state === 'altar' || this.state === 'classes') return 'hub';
    if (this.state === 'over' || this.state === 'victory') return null;
    if (Dungeon.roomType === 'boss' && this.enemies.some((e) => e.isBoss && !e.dead)) return 'boss';
    // 층별 고유 테마 (1~10층), 무한 모드(11층+)는 심층 테마 순환
    const f = Dungeon.floor <= 10 ? Dungeon.floor : ((Dungeon.floor - 11) % 5) + 6;
    return 'f' + f;
  },

  // ── 메인 틱 ──
  tick(dt) {
    this.blinkT += dt;
    // 오프닝/서사 배너 큐 — 현재 배너가 끝나면 다음 줄
    if (this._storyQ && this._storyQ.length && this.state === 'play' && (!this.banner || this.banner.life <= 0)) {
      const line = this._storyQ.shift();
      this.banner = { text: line.text, life: 2.8, maxLife: 2.8, color: line.color };
    }
    Music.ensure(this._musicKey());
    if (Bot.enabled) Bot.update(this, dt);

    if (this.state === 'hub') {
      this._tickHub();
      return;
    }
    if (this.state === 'altar') {
      this._tickAltar();
      return;
    }
    if (this.state === 'classes') {
      this._tickClasses();
      return;
    }
    if (this.state === 'codex') {
      this._tickCodex();
      return;
    }
    if (this.state === 'over' || this.state === 'victory') {
      Particles.update(dt);
      // 파편 정산 카운트업 (+ 카운트 사운드)
      const prev = Math.floor(this.shardAnimT * 40);
      this.shardAnimT += dt;
      const cur = Math.min(this.shardsEarned, Math.floor(this.shardAnimT * 40));
      if (cur > prev && cur <= this.shardsEarned && cur % 3 === 0) AudioSys.shard();

      // 오클릭 방지: 진입 직후에는 입력을 받지 않는다 (죽은 줄도 모르고 넘어가는 문제)
      if (this.overLockT > 0) { this.overLockT -= dt; return; }

      if (Input.pressed('KeyR')) { this.restart(); return; }
      // 승리 화면에서 C — 1막 완수 후엔 2막(다리와 관문), 2막 완수 후엔 왕도 가도
      if (this.state === 'victory' && Input.pressed('KeyC')) {
        const MAX_ACT = 4; // 구현된 막 수 — 5막이 열리면 올린다
        if ((this.act || 1) < MAX_ACT && Dungeon.floor <= (this.act || 1) * 10) this.continueNextAct();
        else this.continueEndless();
        return;
      }
      if (Input.mouse.justDown || Input.pressed('Space', 'Enter')) {
        this.state = 'hub';
        AudioSys.pickup();
      }
      return;
    }
    if (this.state === 'levelup') {
      this.choiceLockT -= dt;
      // 환생 각인: E — 카드 다시 뽑기
      if (Input.pressed('KeyE') && this.player.rerolls > 0 && !this._subChoice) {
        this.player.rerolls--;
        this.traitCards = rollTraitCards(this.player, this.traitCards.length);
        this.choiceLockT = 0.3;
        AudioSys.chest();
      }
      this._handleCardInput(this.traitCards, (i) => this.pickTrait(i));
      return;
    }
    if (this.state === 'relic') {
      this.choiceLockT -= dt;
      this._handleCardInput(this.relicCards, (i) => this.pickRelic(i));
      return;
    }
    if (this.state === 'transition') {
      const tr = this.transition;
      tr.t += dt * 3;
      if (tr.phase === 'out' && tr.t >= 1) {
        Dungeon.pendingMod = tr.mod || null; // 문 수식어를 다음 방에 전달
        Dungeon.advance(tr.type);
        tr.phase = 'in';
        tr.t = 0;
      } else if (tr.phase === 'in' && tr.t >= 1) {
        this.transition = null;
        this.state = 'play';
        if (this.pendingChoices > 0) this.openTraitChoice('levelup');
      }
      return;
    }

    this._tickPlay(dt);
  },
};

// 분리된 모듈을 Game에 합친다 (combat/rewards/play/screens/render-game)
Object.assign(Game, GameCombat, GameRewards, GamePlay, GameScreens, GameRender);

// ── 부트스트랩 ──
(function boot() {
  const canvas = document.getElementById('game');
  Renderer.init(canvas);
  Input.init(canvas);
  Meta.load();
  AudioSys.muted = Meta.data.muted;

  const qs = new URLSearchParams(location.search);
  if (qs.has('test')) Game.testMode = true;
  if (qs.has('class') && Meta.classUnlocked(qs.get('class'))) {
    Meta.selectClass(qs.get('class'));
  }
  if (qs.has('seed')) {
    const parsed = parseInt(qs.get('seed'), 36);
    if (!Number.isNaN(parsed)) Game._urlSeed = parsed >>> 0;
  }
  if (qs.has('bot')) {
    Bot.enabled = true;
    Game.testMode = true;   // 봇 모드는 테스트 도구 — 단축키도 함께 켠다
    Game.reviveMode = true; // 기본 무한 부활: 층별 사망 수를 세며 끝까지 진행 (F로 끄기)
  }
  window.BotReport = () => ({
    floor: Dungeon.floor, room: Dungeon.roomIndex, time: Math.round(Game.time),
    level: Game.level, kills: Game.kills, runs: Bot.runs, wins: Bot.wins,
    deaths: { ...Bot.deaths }, ...Bot.deathReport(), stats: { ...Bot.stats },
  });
  if (qs.has('botloop')) { Bot.enabled = true; Bot.loop = true; Game.testMode = true; }
  if (qs.has('human')) Bot.human = true; // 휴먼 모드 봇 (§0 원칙 B — 표준 난이도 검증용)
  if (qs.has('ff')) Bot.ff = Math.min(8, Math.max(1, parseInt(qs.get('ff'), 10) || 1));
  if (qs.has('autostart') || qs.has('demo') || Bot.enabled) Game.restart();
  if (qs.has('demo')) installDemoBot();
  if (qs.has('floor')) {
    // 테스트용: 특정 층 직행
    Dungeon.floor = Math.min(10, Math.max(1, parseInt(qs.get('floor'), 10) || 1));
    Dungeon.roomIndex = 1;
    Dungeon.build('combat');
  }
  if (qs.get('jump') === 'boss') {
    Dungeon.roomIndex = Dungeon.totalRooms;
    Dungeon.build('boss');
  }
  window.Game = Game;

  const STEP = 1 / 60;
  let last = performance.now();
  let acc = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    acc += dt;
    while (acc >= STEP) {
      // 배속 (?ff=N): 프레임당 N틱 — 봇 소크 테스트용
      for (let i = 0; i < Bot.ff; i++) {
        Game.tick(STEP);
        Input.endFrame();
      }
      acc -= STEP;
    }
    Renderer.update(dt);
    Game.render();
  }
  requestAnimationFrame(frame);
})();

// 데모 봇: 자동 플레이 (검증용, ?demo=1)
function installDemoBot() {
  let t = 0;
  window.__demoBot = (game, dt) => {
    t += dt;
    const p = game.player;
    const moveToward = (tx, ty, stopDist = 8) => {
      Input.keys['KeyW'] = Input.keys['KeyA'] = Input.keys['KeyS'] = Input.keys['KeyD'] = false;
      if (tx < p.x - stopDist) Input.keys['KeyA'] = true;
      if (tx > p.x + stopDist) Input.keys['KeyD'] = true;
      if (ty < p.y - stopDist) Input.keys['KeyW'] = true;
      if (ty > p.y + stopDist) Input.keys['KeyS'] = true;
    };

    let target = null;
    let best = Infinity;
    for (const e of game.enemies) {
      if (e.phased) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < best) { best = d; target = e; }
    }

    if (target) {
      const ranged = p.classId !== 'knight';
      if (ranged) {
        // 원거리: 카이팅 — 거리 유지하며 쿨마다 사격
        if (best < 180) moveToward(p.x * 2 - target.x, p.y * 2 - target.y, 4); // 반대로 도주
        else if (best > 360) moveToward(target.x, target.y, 40);
        else Input.keys['KeyW'] = Input.keys['KeyA'] = Input.keys['KeyS'] = Input.keys['KeyD'] = false;
        if (p.attackCd <= 0 && best < 500) Input.justPressed['KeyJ'] = true;
        if (best < 100 && p.dashCharges >= 1) Input.justPressed['Space'] = true;
      } else {
        moveToward(target.x, target.y, 40);
        if (best < 80 && p.attackCd <= 0) {
          p.facing = { x: (target.x - p.x) / best, y: (target.y - p.y) / best };
          Input.justPressed['KeyJ'] = true;
        }
        if (t > 2.5) { Input.justPressed['Space'] = true; t = 0; }
      }
    } else {
      const it = game.interactables.find((i) => !i.used);
      if (it) moveToward(it.x, it.y, 4);
      else if (World.doorsActive && World.doors.length > 0) {
        moveToward(World.doors[0].x, World.doors[0].y, 4);
      }
    }
  };
  const origTick = Game.tick.bind(Game);
  Game.tick = function (dt) {
    if (this.state === 'levelup' || this.state === 'relic') Input.justPressed['Digit1'] = true;
    origTick(dt);
  };
}
