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

  restart(seed) {
    // 시드 런: 같은 시드 + 같은 선택 = 같은 던전 (기획안 §8.1)
    if (seed == null && this._urlSeed != null) {
      seed = this._urlSeed;
      this._urlSeed = null; // URL 시드는 첫 런에만 적용
    }
    this.runSeed = seed != null ? seed : Math.floor(Math.random() * 36 ** 6);
    RNG.seed(this.runSeed);
    this.heat = Meta.heat();
    this.player = createPlayer(0, 0, Meta.data.cls);
    this.player.rerolls = Meta.lvl('reroll'); // 환생 각인: 런당 카드 리롤 횟수
    if (this.heat >= 5) {
      this.player.maxHp = Math.max(1, this.player.maxHp - 1);
      this.player.hp = this.player.maxHp;
    }
    this.paused = false;
    this.showInventory = false;
    this.gaveUp = false;
    this.runEnded = false;
    this.endless = false;
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
    this.xpNext = 36;
    this.pendingChoices = 0;
    this.traitCards = [];
    this.relicCards = [];
    this.bossRewardT = 0;
    Particles.clear();
    this.state = 'play';
    Dungeon.newRun();

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
    const floorScale = 1 + (Dungeon.floor - 1) * 0.3;

    if (type === 'combat') {
      Dungeon.combatComp(depth).forEach((s, i) => {
        this.pendingSpawns.push({ delay: 0.4 + i * 0.3, type: s.type, elite: s.elite, mini: s.mini });
      });
      // 층 첫 방이면 층 이름 배너
      if (depth === 1) {
        this.banner = { text: `${Dungeon.floor}층 — ${Dungeon.floorName()}`, life: 2.0, maxLife: 2.0 };
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
      const c = World.center();
      this.interactables.push({ kind: 'camp', x: c.x, y: c.y, r: 30, used: false, t: 0 });
    } else if (type === 'event') {
      // 기연: 받아들이기 전엔 무엇인지 모른다 — 다가가면 수락(도박), 문으로 나가면 거절
      const c = World.center();
      this.interactables.push({ kind: 'mystery', x: c.x, y: c.y, r: 26, used: false, t: 0 });
      this.banner = { text: '기이한 기운이 감돈다...', life: 1.8, maxLife: 1.8, color: '#b13ae0' };
    } else if (type === 'boss') {
      const c = World.center();
      const boss = createBoss(Dungeon.floor, c.x + TS * 4, c.y);
      if (this.heat >= 5) {
        boss.hp = boss.maxHp = Math.round(boss.maxHp * 1.5);
      }
      this.enemies.push(boss);
      this.banner = { text: boss.def.banner, life: 2.0, maxLife: 2.0 };
      AudioSys.bossAppear();
      Renderer.shake(5, 0.5);
    }
  },

  // 열기 반영 적 강화 배율
  enemyHpMul() {
    return (1 + (Dungeon.floor - 1) * 0.3) * (this.heat >= 1 ? 1.25 : 1);
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
      // 무한 모드: 승리 화면에서 C — 심연 회랑으로 계속
      if (this.state === 'victory' && Input.pressed('KeyC')) {
        this.continueEndless();
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
      if (Input.pressed('KeyE') && this.player.rerolls > 0) {
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
