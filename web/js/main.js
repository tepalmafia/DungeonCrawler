// 게임 루프 + 던전 진행 + 전투 판정 허브.
// 상태: hub | altar | classes | play | levelup | relic | transition | over | victory
const PROJ_STYLES = {
  arrow: { color: '#a99e8c', sprite: true },
  soul:  { color: '#b13ae0', r: 7, wavy: true },
  spore: { color: '#8a5ac2', r: 6 },
  fire:  { color: '#ff7043', r: 6, patchOnEnd: true },
  rock:  { color: '#6b7a94', r: 6 },
  web:   { color: '#e8e0cf', r: 5 },
};

const Game = {
  state: 'hub',
  player: null,
  enemies: [],
  arrows: [],
  pbolts: [],       // 플레이어 투사체 (궁수 화살 / 마도사 마탄)
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
  blinkT: 0,

  xp: 0,
  level: 1,
  xpNext: 18,
  pendingChoices: 0,
  traitCards: [],
  relicCards: [],
  choiceReason: 'levelup',
  bossRewardT: 0,

  roomCleared: false,
  transition: null,

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
    if (this.heat >= 5) {
      this.player.maxHp = Math.max(1, this.player.maxHp - 1);
      this.player.hp = this.player.maxHp;
    }
    this.paused = false;
    this.runEnded = false;
    this.shardsEarned = 0;
    this.shardAnimT = 0;
    this.kills = 0;
    this.time = 0;
    this.hitstop = 0;
    this.banner = null;
    this.vignette = 0;
    this.xp = 0;
    this.level = 1;
    this.xpNext = 18;
    this.pendingChoices = 0;
    this.traitCards = [];
    this.relicCards = [];
    this.bossRewardT = 0;
    Particles.clear();
    this.state = 'play';
    Dungeon.newRun();
  },

  onRoomBuilt(type) {
    this.enemies = [];
    this.arrows = [];
    this.pbolts = [];
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
        this.pendingSpawns.push({ delay: 0.4 + i * 0.3, type: s.type, elite: s.elite });
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
    } else if (type === 'boss') {
      const c = World.center();
      const boss = createBoss(Dungeon.floor, c.x + TS * 4, c.y);
      if (this.heat >= 5) {
        boss.hp = boss.maxHp = Math.round(boss.maxHp * 1.5);
      }
      this.enemies.push(boss);
      this.banner = { text: BOSS_DEFS[Dungeon.floor].banner, life: 2.0, maxLife: 2.0 };
      AudioSys.roar();
    }
  },

  // 열기 반영 적 강화 배율
  enemyHpMul() {
    return (1 + (Dungeon.floor - 1) * 0.3) * (this.heat >= 1 ? 1.25 : 1);
  },

  damageEnemy(e, dmg, dir, { feel = true, crit = false, kb = 190, color } = {}) {
    if (e.dead || e.phased) return;
    e.hp -= dmg;
    e.flash = 0.1;
    if (kb && !e.isBoss) {
      e.kbx += dir.x * kb;
      e.kby += dir.y * kb;
    } else if (kb) {
      e.kbx += dir.x * kb * 0.25;
      e.kby += dir.y * kb * 0.25;
    }

    if (feel) {
      this.hitstop = Math.max(this.hitstop, crit ? 0.09 : 0.04);
      Renderer.shake(crit ? 4 : 2, 0.12);
      Particles.burst(e.x, e.y, {
        count: crit ? 12 : 6,
        colors: ['#ffffff', '#f7b32b', '#ffd866'],
        speed: 160, life: 0.3, size: 3,
        dir: Math.atan2(dir.y, dir.x), spread: 1.6,
      });
      if (crit) AudioSys.crit(); else AudioSys.hit();

      const p = this.player;
      if (crit && p.flags.lifesteal && p.lifestealCd <= 0 && p.hp < p.maxHp) {
        p.hp++;
        p.lifestealCd = 4;
        Particles.text(p.x, p.y - 26, '+1', { color: '#e43b44', size: 14 });
        AudioSys.pickup();
      }
    }
    Particles.text(e.x, e.y - 22, String(dmg), {
      color: color || (crit ? '#f7b32b' : '#ffffff'),
      size: crit ? 22 : feel ? 15 : 12,
    });

    if (e.hp <= 0) this.killEnemy(e, dir);
  },

  hitEnemy(e, dmg, dir, opts = {}) {
    this.damageEnemy(e, dmg, dir, { ...opts, feel: true });
  },

  killEnemy(e, dir) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    this.hitstop = Math.max(this.hitstop, 0.08);
    Renderer.shake(3, 0.15);
    AudioSys.die();

    const palettes = {
      slime: ['#38b764', '#a7f070', '#257179'],
      toxicSlime: ['#8a3a8c', '#c56cf0', '#5c1e5e'],
      archer: ['#e8e0cf', '#a99e8c'],
      boar: ['#8d5a3b', '#5e3a26'],
      lavaHound: ['#d35400', '#7a1010', '#ffd866'],
      mushroom: ['#8a5ac2', '#d8c8f0'],
      bat: ['#5c5c74', '#3a2a52'],
      spider: ['#241832', '#3a3a4a', '#e43b44'],
      golem: ['#5d6b84', '#3d4a5c'],
      wraith: ['#a9c1d8', '#5d6b84'],
      fireSpirit: ['#ff9a3c', '#ffd866', '#7a1010'],
      necro: ['#2a4a3a', '#38b764'],
      boss: e.def ? e.def.deathPalette : ['#b13ae0'],
    };
    Particles.burst(e.x, e.y, {
      count: e.isBoss ? 40 : 18,
      colors: palettes[e.type] || ['#ffffff'],
      speed: 190, life: 0.55, size: 4,
      gravity: 300, dir: Math.atan2(dir.y, dir.x), spread: 2.6,
    });

    // 사망 연출: 무너져 내리는 잔상
    const spriteKey = e.isBoss ? e.def.sprite : e.sprite;
    if (spriteKey && Sprites[spriteKey]) {
      this.corpses.push({
        img: e.elite ? Sprites.tint(Sprites[spriteKey]) : Sprites[spriteKey],
        x: e.x, y: e.y, flip: e.flip,
        t: 0, dur: e.isBoss ? 0.7 : 0.35,
        scale: e.isBoss ? e.def.scale : 1,
      });
    }

    const p = this.player;

    // 사망 시 발동 효과 (적 고유 + 특성 + 유물)
    if (e.onDeath) e.onDeath(this);

    if (p.flags.burnboom && e.status.burn > 0) {
      this._explode(e.x, e.y, 80, 2, ['#ff7043', '#ffd866', '#e43b44'], '#ff7043');
    }
    if (p.flags.plague && e.status.poison > 0) {
      this.zones.push({ x: e.x, y: e.y, r: 50, life: 2.5, kind: 'poison', tickT: 0, hit: null });
    }
    if (p.rflags.bomb && Math.random() < 0.15) {
      this._explode(e.x, e.y, 70, 2, ['#f7b32b', '#ff7043'], '#f7b32b');
    }
    if (p.flags.overcharge && e.status.shock > 0 && p.dashCharges < p.dashMax) {
      p.dashCharges = p.dashMax;
      p.dashRegenT = 0;
      Particles.text(p.x, p.y - 26, '충전!', { color: '#ffd866', size: 13 });
    }
    if (p.rflags.fang && Math.random() < 0.08 && p.hp < p.maxHp) {
      p.hp++;
      Particles.text(p.x, p.y - 26, '+1', { color: '#e43b44', size: 14 });
    }

    if (e.isBoss) {
      this.onBossDead();
      return;
    }

    let val = e.xpVal;
    while (val > 0) {
      const v = Math.min(3, val);
      val -= v;
      const a = Math.random() * Math.PI * 2;
      this.orbs.push({ x: e.x, y: e.y, val: v, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 });
    }
    let heartChance = 0.1 * p.luckMul * (this.heat >= 4 ? 0.5 : 1);
    if (p.flags.bloodlust) heartChance += 0.12;
    if (Math.random() < heartChance) {
      this.pickups.push({ x: e.x, y: e.y, t: 0, r: 12 });
    }
  },

  _explode(x, y, radius, dmg, colors, textColor) {
    Particles.burst(x, y, { count: 16, colors, speed: 200, life: 0.4, size: 4 });
    Renderer.shake(3, 0.15);
    AudioSys.thud();
    for (const other of this.enemies) {
      if (other.dead || other.phased) continue;
      const dd = Math.hypot(other.x - x, other.y - y);
      if (dd < radius && dd > 0.01) {
        const ddir = { x: (other.x - x) / dd, y: (other.y - y) / dd };
        this.damageEnemy(other, dmg, ddir, { feel: false, kb: 150, color: textColor });
      }
    }
  },

  // 런 종료 정산 — 영혼 파편 지급 (1회만)
  endRun(victory) {
    if (this.runEnded) return;
    this.runEnded = true;
    this.shardsEarned = Meta.endRun(Dungeon.floor, Dungeon.roomIndex, this.kills, victory, this.heat);
    this.shardAnimT = 0;
  },

  onBossDead() {
    this.arrows = [];
    this.rings = [];
    if (Dungeon.floor >= 5) {
      this.endRun(true);
      this.state = 'victory';
      Renderer.shake(8, 0.6);
      AudioSys.gameover();
      setTimeout(() => AudioSys.levelup(), 500);
      return;
    }
    this.banner = { text: `${Dungeon.floor}층 클리어!`, life: 2.0, maxLife: 2.0 };
    Renderer.shake(8, 0.6);
    AudioSys.chest();
    this.bossRewardT = 1.2; // 잠시 후 유물 선택
  },

  hurtPlayer(dmg, dir, kb = 260) {
    const p = this.player;
    if (p.invuln > 0 || this.state !== 'play') return;

    // 보호막: 피해 1회 무효
    if (p.shield) {
      p.shield = false;
      p.shieldT = 0;
      p.invuln = Math.max(p.invuln, 0.5);
      p.kbx = dir.x * kb * 0.5;
      p.kby = dir.y * kb * 0.5;
      Particles.text(p.x, p.y - 26, '막음!', { color: '#5ce0e6', size: 15 });
      Particles.burst(p.x, p.y, { count: 10, colors: ['#5ce0e6', '#a9fff7'], speed: 130, life: 0.35, size: 3 });
      AudioSys.clank();
      return;
    }

    p.hp -= dmg;
    p.invuln = 0.9;
    p.kbx = dir.x * kb;
    p.kby = dir.y * kb;
    this.hitstop = Math.max(this.hitstop, 0.06);
    this.vignette = 0.6;
    Renderer.shake(6, 0.3);
    AudioSys.hurt();
    Particles.burst(p.x, p.y, {
      count: 10, colors: ['#e43b44', '#8a1c2c'], speed: 140, life: 0.4, size: 3,
    });

    // 가시 갑옷 (특성) + 가시 방패 (유물)
    if (p.flags.thorns || p.rflags.spikeshield) {
      for (const e of this.enemies) {
        if (e.dead || e.phased) continue;
        const dd = Math.hypot(e.x - p.x, e.y - p.y);
        if (dd < 75) {
          const ddir = { x: (e.x - p.x) / (dd || 1), y: (e.y - p.y) / (dd || 1) };
          this.damageEnemy(e, 2, ddir, { feel: false, kb: 280, color: '#5ce0e6' });
        }
      }
      Particles.burst(p.x, p.y, { count: 10, colors: ['#5ce0e6'], speed: 180, life: 0.3, size: 3 });
    }

    if (p.hp <= 0) {
      // 불사조 깃털: 1회 부활
      if (p.rflags.revive && !p.reviveUsed) {
        p.reviveUsed = true;
        p.hp = 3;
        p.invuln = 2.5;
        this.banner = { text: '불사조의 깃털이 불탄다!', life: 1.8, maxLife: 1.8 };
        Renderer.shake(8, 0.5);
        AudioSys.levelup();
        Particles.burst(p.x, p.y, {
          count: 30, colors: ['#ff7043', '#ffd866', '#f7b32b'], speed: 240, life: 0.8, size: 4, gravity: -150,
        });
        return;
      }
      p.hp = 0;
      this.endRun(false);
      this.state = 'over';
      AudioSys.gameover();
      Renderer.shake(8, 0.5);
      Particles.burst(p.x, p.y, {
        count: 30, colors: ['#3b5dc9', '#94a1b8', '#f0c297'], speed: 220, life: 0.8, size: 4, gravity: 250,
      });
    }
  },

  spawnProjectile(kind, x, y, dir, { speed = 250, dmg = 1, slow = 0 } = {}) {
    const style = PROJ_STYLES[kind] || PROJ_STYLES.arrow;
    this.arrows.push({ kind, x, y, dir, speed, dmg, slow, r: style.r || 4, life: 4, t: 0 });
  },

  gainXp(v) {
    this.xp += Math.round(v * this.player.xpMul);
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Math.round(this.xpNext * 1.38);
      this.pendingChoices++;
    }
    if (this.pendingChoices > 0 && this.state === 'play') {
      this.openTraitChoice('levelup');
    }
  },

  traitCardCount() {
    return Math.min(4, 3 + (this.player.rflags.kingseal ? 1 : 0) + Meta.lvl('choice'));
  },

  openTraitChoice(reason) {
    this.choiceReason = reason;
    const n = this.traitCardCount();
    this.traitCards = rollTraitCards(this.player, n);
    if (this.traitCards.length === 0) { this.pendingChoices = 0; return; }
    this.state = 'levelup';
    AudioSys.levelup();
    Particles.burst(this.player.x, this.player.y, {
      count: 16, colors: ['#2ec4b6', '#a9fff7'], speed: 130, life: 0.6, size: 3, gravity: -80,
    });
  },

  pickTrait(i) {
    const t = this.traitCards[i];
    if (!t) return;
    applyTrait(this.player, t);
    Particles.text(this.player.x, this.player.y - 30, t.name + '!', { color: t.color, size: 16 });
    this.pendingChoices = Math.max(0, this.pendingChoices - 1);
    if (this.pendingChoices > 0) {
      const n = this.traitCardCount();
      this.traitCards = rollTraitCards(this.player, n);
      if (this.traitCards.length === 0) { this.pendingChoices = 0; this.state = 'play'; }
    } else {
      this.state = 'play';
    }
  },

  openRelicChoice() {
    this.relicCards = rollRelics(this.player, 3, true);
    if (this.relicCards.length === 0) {
      this._afterBossReward();
      return;
    }
    this.state = 'relic';
    AudioSys.chest();
  },

  pickRelic(i) {
    const r = this.relicCards[i];
    if (!r) return;
    this.acquireRelic(r);
    this.state = 'play';
    this._afterBossReward();
  },

  _afterBossReward() {
    World.openDoors([{ type: 'nextfloor', ...ROOM_META.nextfloor }]);
    // 왕의 인장 즉시 특성
    if (this.pendingChoices > 0) this.openTraitChoice('levelup');
  },

  acquireRelic(relic) {
    applyRelic(this.player, relic);
    const rar = RARITY[relic.rarity];
    this.banner = { text: `[${rar.label}] ${relic.name}`, life: 2.0, maxLife: 2.0, color: rar.color };
    Particles.text(this.player.x, this.player.y - 30, relic.name, { color: rar.color, size: 17 });
    AudioSys.relic(relic.rarity);
    Particles.burst(this.player.x, this.player.y, {
      count: relic.rarity === 'legendary' ? 30 : 14,
      colors: [rar.color, '#ffffff'], speed: 150, life: 0.6, size: 3, gravity: -100,
    });
    if (relic.flag === 'kingseal') {
      this.pendingChoices++;
    }
  },

  // 현재 상태에 맞는 BGM 테마 결정
  _musicKey() {
    if (this.state === 'hub' || this.state === 'altar' || this.state === 'classes') return 'hub';
    if (this.state === 'over' || this.state === 'victory') return null;
    if (Dungeon.roomType === 'boss' && this.enemies.some((e) => e.isBoss && !e.dead)) return 'boss';
    return 'f' + Math.min(5, Dungeon.floor);
  },

  // ── 메인 틱 ──
  tick(dt) {
    this.blinkT += dt;
    Music.ensure(this._musicKey());

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
    if (this.state === 'over' || this.state === 'victory') {
      Particles.update(dt);
      // 파편 정산 카운트업 (+ 카운트 사운드)
      const prev = Math.floor(this.shardAnimT * 40);
      this.shardAnimT += dt;
      const cur = Math.min(this.shardsEarned, Math.floor(this.shardAnimT * 40));
      if (cur > prev && cur <= this.shardsEarned && cur % 3 === 0) AudioSys.shard();

      if (Input.pressed('KeyR')) { this.restart(); return; }
      if (Input.mouse.justDown || Input.pressed('Space', 'Enter')) {
        this.state = 'hub';
        AudioSys.pickup();
      }
      return;
    }
    if (this.state === 'levelup') {
      this._handleCardInput(this.traitCards, (i) => this.pickTrait(i));
      return;
    }
    if (this.state === 'relic') {
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

    if (Input.pressed('KeyM')) {
      AudioSys.toggleMute();
      Meta.data.muted = AudioSys.muted;
      Meta.save();
    }

    // 일시정지
    if (Input.pressed('Escape', 'KeyP')) {
      this.paused = !this.paused;
      AudioSys.pickup();
    }
    if (this.paused) return;

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }

    this.time += dt;
    if (this.vignette > 0) this.vignette -= dt * 1.5;
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }

    // 보스 보상 지연 타이머
    if (this.bossRewardT > 0) {
      this.bossRewardT -= dt;
      if (this.bossRewardT <= 0) {
        this.openRelicChoice();
        return;
      }
    }

    if (window.__demoBot) window.__demoBot(this, dt);

    this.player.update(dt, this);

    // ── 환경 위험: 용암 / 독 안개 / 불길 장판 ──
    const p = this.player;
    if (p.invuln <= 0 && p.dashTimer <= 0) {
      if (World.isLavaAt(p.x, p.y + 10)) {
        this.hurtPlayer(1, { x: 0, y: -1 }, 180);
        Particles.text(p.x, p.y - 28, '용암!', { color: '#ff7043', size: 13 });
      } else if (World.inFog(p.x, p.y)) {
        this.hurtPlayer(1, { x: 0, y: 0 }, 60);
        Particles.text(p.x, p.y - 28, '독!', { color: '#6ab04c', size: 13 });
      } else {
        for (const fp of this.firePatches) {
          if (Math.hypot(p.x - fp.x, p.y - fp.y) < fp.r) {
            this.hurtPlayer(1, { x: 0, y: 0 }, 60);
            break;
          }
        }
      }
    }

    // ── 스폰 ──
    for (let i = this.pendingSpawns.length - 1; i >= 0; i--) {
      const s = this.pendingSpawns[i];
      s.delay -= dt;
      if (s.delay <= 0) {
        const pos = World.randomSpawnPos(this.player);
        this.markers.push({ x: pos.x, y: pos.y, type: s.type, elite: s.elite, t: 0.7 });
        this.pendingSpawns.splice(i, 1);
      }
    }
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const m = this.markers[i];
      m.t -= dt;
      if (m.t <= 0) {
        const e = createEnemy(m.type, m.x, m.y, m.elite, this.enemyHpMul());
        if (this.heat >= 3) e.speed *= 1.15;
        this.enemies.push(e);
        Particles.burst(m.x, m.y, { count: 8, colors: ['#5c1e5e', '#8a3a8c'], speed: 90, life: 0.35, size: 3 });
        this.markers.splice(i, 1);
      }
    }

    // ── 사망 연출 잔상 수명 ──
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      this.corpses[i].t += dt;
      if (this.corpses[i].t >= this.corpses[i].dur) this.corpses.splice(i, 1);
    }

    // ── 적 갱신 + 상태이상 ──
    for (const e of this.enemies) {
      if (e.dead) continue;
      // 등장 연출 중에는 행동하지 않는다 (플레이어 공격은 가능)
      if (e.spawnT > 0) {
        e.spawnT -= dt;
        e.animT += dt;
        continue;
      }
      if (e.status.burn > 0) {
        e.status.burn -= dt;
        e.status.burnTick -= dt;
        if (e.status.burnTick <= 0) {
          e.status.burnTick = p.flags.inferno ? 0.25 : 0.5;
          this.damageEnemy(e, 1, { x: 0, y: -0.3 }, { feel: false, kb: 0, color: '#ff7043' });
        }
      }
      if (!e.dead && e.status.poison > 0) {
        e.status.poison -= dt;
        e.status.poisonTick -= dt;
        if (e.status.poisonTick <= 0) {
          e.status.poisonTick = 1.0;
          this.damageEnemy(e, 1, { x: 0, y: -0.3 }, { feel: false, kb: 0, color: '#6ab04c' });
        }
      }
      if (e.status.shock > 0) e.status.shock -= dt;
      if (!e.dead) e.update(dt, this);
    }
    this.enemies = this.enemies.filter((e) => !e.dead);

    // ── 장판 (적 피해: 감전/독구름) ──
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.life -= dt;
      if (z.life <= 0) { this.zones.splice(i, 1); continue; }
      if (z.kind === 'poison') {
        z.tickT -= dt;
        if (z.tickT <= 0) {
          z.tickT = 0.8;
          for (const e of this.enemies) {
            if (e.dead || e.phased) continue;
            if (Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) {
              e.status.poison = Math.max(e.status.poison, 1.5);
              this.damageEnemy(e, 1, { x: 0, y: 0 }, { feel: false, kb: 0, color: '#6ab04c' });
            }
          }
        }
      } else {
        for (const e of this.enemies) {
          if (e.dead || e.phased || z.hit.has(e)) continue;
          if (Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) {
            z.hit.add(e);
            e.status.shock = 2;
            this.damageEnemy(e, 1, { x: 0, y: 0 }, { feel: false, kb: 0, color: '#ffd866' });
          }
        }
      }
    }

    // ── 불길/독 장판 수명 (플레이어 피해는 위에서) ──
    for (let i = this.firePatches.length - 1; i >= 0; i--) {
      const fp = this.firePatches[i];
      fp.life -= dt;
      if (fp.life <= 0) this.firePatches.splice(i, 1);
    }

    // ── 충격파 링 ──
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.r += ring.speed * dt;
      const pd = Math.hypot(p.x - ring.x, p.y - ring.y);
      if (p.invuln <= 0 && Math.abs(pd - ring.r) < ring.width) {
        const dir = { x: (p.x - ring.x) / (pd || 1), y: (p.y - ring.y) / (pd || 1) };
        this.hurtPlayer(ring.dmg, dir, 300);
      }
      if (ring.r > ring.maxR) this.rings.splice(i, 1);
    }

    // ── 투사체 ──
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.life -= dt;
      a.t += dt;
      let vx = a.dir.x, vy = a.dir.y;
      if (PROJ_STYLES[a.kind]?.wavy) {
        const wave = Math.sin(a.t * 9) * 0.35;
        vx += -a.dir.y * wave;
        vy += a.dir.x * wave;
      }
      a.x += vx * a.speed * dt;
      a.y += vy * a.speed * dt;
      if (p.invuln <= 0 && Math.hypot(p.x - a.x, p.y - a.y) < p.r + a.r) {
        if (a.slow > 0) {
          p.slowT = Math.max(p.slowT, a.slow);
          Particles.text(p.x, p.y - 26, '끈적!', { color: '#e8e0cf', size: 13 });
          Particles.burst(p.x, p.y, { count: 6, colors: ['#e8e0cf'], speed: 60, life: 0.3, size: 2 });
        }
        if (a.dmg > 0) this.hurtPlayer(a.dmg, a.dir);
        this.arrows.splice(i, 1);
        continue;
      }
      const hitWall = (a.kind === 'arrow' || a.kind === 'rock' || a.kind === 'web' || a.kind === 'fire') && World.isSolidAt(a.x, a.y);
      if (a.life <= 0 || hitWall) {
        if (PROJ_STYLES[a.kind]?.patchOnEnd) {
          this.firePatches.push({ x: a.x, y: a.y, r: 34, life: 2.0, kind: 'fire' });
        }
        Particles.burst(a.x, a.y, {
          count: 4, colors: [PROJ_STYLES[a.kind]?.color || '#a99e8c'], speed: 70, life: 0.25, size: 2,
        });
        this.arrows.splice(i, 1);
      }
    }

    for (let i = this.bossSlashes.length - 1; i >= 0; i--) {
      this.bossSlashes[i].life -= dt;
      if (this.bossSlashes[i].life <= 0) this.bossSlashes.splice(i, 1);
    }

    // ── 플레이어 투사체 (궁수 화살 / 마도사 유도 마탄) ──
    for (let i = this.pbolts.length - 1; i >= 0; i--) {
      const b = this.pbolts[i];
      b.life -= dt;

      // 유도: 가장 가까운 적을 향해 선회
      if (b.homing) {
        let target = null;
        let best = 280;
        for (const e of this.enemies) {
          if (e.dead || e.phased) continue;
          const ed = Math.hypot(e.x - b.x, e.y - b.y);
          if (ed < best) { best = ed; target = e; }
        }
        if (target) {
          const want = Math.atan2(target.y - b.y, target.x - b.x);
          let cur = Math.atan2(b.dir.y, b.dir.x);
          let diff = want - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          cur += Math.sign(diff) * Math.min(Math.abs(diff), b.homing * dt);
          b.dir = { x: Math.cos(cur), y: Math.sin(cur) };
        }
      }

      b.x += b.dir.x * b.speed * dt;
      b.y += b.dir.y * b.speed * dt;

      // 마탄 잔광
      if (b.kind === 'pbolt' && Math.random() < 0.5) {
        Particles.burst(b.x, b.y, { count: 1, colors: ['#c56cf0', '#8a5ac2'], speed: 12, life: 0.25, size: 2 });
      }

      let remove = b.life <= 0 || World.isSolidAt(b.x, b.y);
      if (!remove) {
        for (const e of this.enemies) {
          if (e.dead || e.phased || b.hit.has(e)) continue;
          if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 7) {
            b.hit.add(e);
            const res = p.strike(this, e, { ...b.dir }, {
              finisher: b.finisher,
              kb: b.finisher ? 300 : 170,
            });
            if (b.aoe) {
              this._explode(b.x, b.y, b.aoe, Math.max(1, p.currentAtk()), ['#8a5ac2', '#c56cf0', '#ffd866'], '#c56cf0');
            }
            if (res === 'blocked' || !b.pierce) remove = true;
            break;
          }
        }
      }
      if (remove) {
        if (b.aoe && b.hit.size === 0) {
          // 벽에 맞아도 대마탄은 폭발
          this._explode(b.x, b.y, b.aoe, Math.max(1, p.currentAtk()), ['#8a5ac2', '#c56cf0', '#ffd866'], '#c56cf0');
        }
        Particles.burst(b.x, b.y, {
          count: 4,
          colors: b.kind === 'pbolt' ? ['#c56cf0'] : ['#d9cbb8'],
          speed: 70, life: 0.25, size: 2,
        });
        this.pbolts.splice(i, 1);
      }
    }

    // ── XP 보석 ──
    const magnetR = (this.roomCleared || p.rflags.magnetall) ? 9999 : 95 * p.magnetMul;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      const dx = p.x - o.x, dy = p.y - o.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < magnetR) {
        const pull = 900 * dt;
        o.vx += (dx / d) * pull;
        o.vy += (dy / d) * pull;
      }
      o.vx *= Math.pow(0.1, dt);
      o.vy *= Math.pow(0.1, dt);
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (d < p.r + 8) {
        this.orbs.splice(i, 1);
        AudioSys.orb();
        this.gainXp(o.val);
        if (this.state !== 'play') return;
      }
    }

    // ── 하트 픽업 ──
    const heartMagnet = p.rflags.magnetall ? 9999 : 0;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.t += dt;
      if (heartMagnet > 0) {
        const dx = p.x - pk.x, dy = p.y - pk.y;
        const d = Math.hypot(dx, dy) || 1;
        pk.x += (dx / d) * 250 * dt;
        pk.y += (dy / d) * 250 * dt;
      }
      if (Math.hypot(p.x - pk.x, p.y - pk.y) < p.r + pk.r) {
        if (p.hp < p.maxHp) p.hp++;
        AudioSys.pickup();
        Particles.burst(pk.x, pk.y, { count: 8, colors: ['#e43b44', '#f5817e'], speed: 100, life: 0.4, size: 3 });
        this.pickups.splice(i, 1);
      }
    }

    // ── 상자 / 모닥불 ──
    for (const it of this.interactables) {
      it.t += dt;
      if (it.used) continue;
      if (Math.hypot(p.x - it.x, p.y - it.y) < p.r + it.r) {
        it.used = true;
        if (it.kind === 'chest') {
          Renderer.shake(2, 0.1);
          // 보물상자: 유물 1개 (루트의 도파민!)
          const rolled = rollRelics(p, 1, false);
          if (rolled.length > 0) {
            this.acquireRelic(rolled[0]);
          } else {
            AudioSys.chest();
          }
          for (let k = 0; k < 5; k++) {
            const a = Math.random() * Math.PI * 2;
            this.orbs.push({ x: it.x, y: it.y, val: 3, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160 - 60 });
          }
          Particles.burst(it.x, it.y - 10, { count: 14, colors: ['#f7b32b', '#ffd866'], speed: 150, life: 0.5, size: 3, gravity: 200 });
        } else if (it.kind === 'camp') {
          AudioSys.pickup();
          const heal = this.heat >= 4 ? 1 : 2; // 열기 4: 모닥불 회복 감소
          p.hp = Math.min(p.maxHp, p.hp + heal);
          Particles.text(p.x, p.y - 28, '+' + heal, { color: '#e43b44', size: 18 });
          Particles.burst(it.x, it.y, { count: 12, colors: ['#ff7043', '#ffd866'], speed: 80, life: 0.6, size: 3, gravity: -120 });
        }
      }
    }

    Particles.update(dt);

    // ── 방 클리어 ──
    if (!this.roomCleared &&
        this.enemies.length === 0 && this.markers.length === 0 && this.pendingSpawns.length === 0 &&
        this.bossRewardT <= 0 && this.state === 'play') {
      this.roomCleared = true;
      if (p.flags.regen && p.hp < p.maxHp) {
        p.hp++;
        Particles.text(p.x, p.y - 28, '+1', { color: '#e43b44', size: 14 });
      }
      if (Dungeon.roomType !== 'boss') {
        World.openDoors(Dungeon.doorOptions());
        if (Dungeon.roomType === 'elite') {
          this.pendingChoices++;
          this.openTraitChoice('elite');
        }
      }
      // 보스방 클리어 시 문은 유물 선택 후 열림 (_afterBossReward)
    }

    // ── 문 진입 ──
    if (this.roomCleared && World.doorsActive) {
      for (const door of World.doors) {
        if (Math.hypot(p.x - door.x, p.y - door.y) < 30) {
          this.state = 'transition';
          this.transition = { phase: 'out', t: 0, type: door.opt.type };
          AudioSys.dash();
          break;
        }
      }
    }
  },

  // ── 거점 화면들 ──
  _tickHub() {
    if (Input.pressed('KeyM')) { AudioSys.toggleMute(); Meta.data.muted = AudioSys.muted; Meta.save(); }

    // 열기(고난이도) 조절 — 첫 정복 후 해금
    if (Meta.heatUnlocked()) {
      if (Input.pressed('ArrowLeft')) { Meta.setHeat(Meta.data.heat - 1); AudioSys.orb(); }
      if (Input.pressed('ArrowRight')) { Meta.setHeat(Meta.data.heat + 1); AudioSys.orb(); }
      if (Input.mouse.justDown) {
        const [minus, plus] = HUD.heatButtonRects();
        const mx = Input.mouse.x, my = Input.mouse.y;
        if (mx >= minus.x && mx <= minus.x + minus.w && my >= minus.y && my <= minus.y + minus.h) {
          Meta.setHeat(Meta.data.heat - 1); AudioSys.orb();
        }
        if (mx >= plus.x && mx <= plus.x + plus.w && my >= plus.y && my <= plus.y + plus.h) {
          Meta.setHeat(Meta.data.heat + 1); AudioSys.orb();
        }
      }
    }

    const rects = HUD.hubButtonRects();
    let act = -1;
    if (Input.pressed('Digit1') || Input.pressed('Space', 'Enter')) act = 0;
    if (Input.pressed('Digit2')) act = 1;
    if (Input.pressed('Digit3')) act = 2;
    if (Input.mouse.justDown) {
      rects.forEach((r, i) => {
        if (Input.mouse.x >= r.x && Input.mouse.x <= r.x + r.w &&
            Input.mouse.y >= r.y && Input.mouse.y <= r.y + r.h) act = i;
      });
    }
    if (act === 0) { AudioSys.buy(); this.restart(); }
    else if (act === 1) { AudioSys.pickup(); this.state = 'altar'; }
    else if (act === 2) { AudioSys.pickup(); this.state = 'classes'; }
  },

  _tickAltar() {
    if (Input.pressed('Escape', 'Digit0', 'Backspace')) { this.state = 'hub'; return; }
    let act = -1;
    for (let i = 0; i < META_UPGRADES.length; i++) {
      if (Input.pressed('Digit' + (i + 1))) act = i;
    }
    const rects = HUD.altarRowRects();
    const back = HUD.backButtonRect();
    if (Input.mouse.justDown) {
      if (Input.mouse.x >= back.x && Input.mouse.x <= back.x + back.w &&
          Input.mouse.y >= back.y && Input.mouse.y <= back.y + back.h) {
        this.state = 'hub';
        return;
      }
      rects.forEach((r, i) => {
        if (Input.mouse.x >= r.x && Input.mouse.x <= r.x + r.w &&
            Input.mouse.y >= r.y && Input.mouse.y <= r.y + r.h) act = i;
      });
    }
    if (act >= 0) {
      const up = META_UPGRADES[act];
      if (Meta.buy(up.id)) AudioSys.buy();
      else AudioSys.deny();
    }
  },

  _tickClasses() {
    if (Input.pressed('Escape', 'Digit0', 'Backspace')) { this.state = 'hub'; return; }
    let act = -1;
    const ids = Object.keys(CLASSES);
    for (let i = 0; i < ids.length; i++) {
      if (Input.pressed('Digit' + (i + 1))) act = i;
    }
    const rects = HUD.cardRects(ids.length);
    const back = HUD.backButtonRect();
    if (Input.mouse.justDown) {
      if (Input.mouse.x >= back.x && Input.mouse.x <= back.x + back.w &&
          Input.mouse.y >= back.y && Input.mouse.y <= back.y + back.h) {
        this.state = 'hub';
        return;
      }
      rects.forEach((r, i) => {
        if (Input.mouse.x >= r.x && Input.mouse.x <= r.x + r.w &&
            Input.mouse.y >= r.y && Input.mouse.y <= r.y + r.h) act = i;
      });
    }
    if (act >= 0) {
      const id = ids[act];
      if (Meta.classUnlocked(id)) {
        Meta.selectClass(id);
        AudioSys.pickup();
      } else if (Meta.unlockClass(id)) {
        AudioSys.relic('epic');
      } else {
        AudioSys.deny();
      }
    }
  },

  _handleCardInput(cards, pick) {
    for (let i = 0; i < cards.length; i++) {
      if (Input.pressed('Digit' + (i + 1))) { pick(i); return; }
    }
    if (Input.mouse.justDown) {
      const rects = HUD.cardRects(cards.length);
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (Input.mouse.x >= r.x && Input.mouse.x <= r.x + r.w &&
            Input.mouse.y >= r.y && Input.mouse.y <= r.y + r.h) {
          pick(i);
          return;
        }
      }
    }
  },

  render() {
    const ctx = Renderer.ctx;
    Renderer.begin();

    if (this.state === 'hub' || this.state === 'altar' || this.state === 'classes') {
      if (this.state === 'hub') HUD.drawHub(ctx, this.blinkT);
      else if (this.state === 'altar') HUD.drawAltar(ctx, this.blinkT);
      else HUD.drawClasses(ctx, this.blinkT);
      return;
    }

    World.draw(ctx, this.blinkT);

    World.drawDoors(ctx, this.blinkT);

    // 불길/독 장판 (플레이어 위험)
    for (const fp of this.firePatches) {
      const col = fp.kind === 'poison' ? '106,176,76' : '255,112,67';
      ctx.globalAlpha = Math.min(0.45, fp.life * 0.4) * (0.75 + Math.random() * 0.25);
      ctx.fillStyle = `rgba(${col},0.5)`;
      ctx.beginPath();
      ctx.arc(fp.x, fp.y, fp.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (Math.random() < 0.25) {
        Particles.burst(fp.x + (Math.random() - 0.5) * fp.r * 1.4, fp.y + (Math.random() - 0.5) * fp.r * 1.4, {
          count: 1, colors: fp.kind === 'poison' ? ['#6ab04c'] : ['#ff7043', '#ffd866'],
          speed: 20, life: 0.35, size: 3, gravity: -120,
        });
      }
    }

    // 감전/독구름 장판 (적 피해)
    for (const z of this.zones) {
      const col = z.kind === 'poison' ? '#6ab04c' : '#ffd866';
      ctx.globalAlpha = Math.min(0.4, z.life) * (0.7 + Math.random() * 0.3);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 스폰 마커
    for (const m of this.markers) {
      const r = 10 + m.t * 30;
      ctx.strokeStyle = m.elite ? `rgba(230,80,220,${0.95 - m.t})` : `rgba(160,80,190,${0.9 - m.t})`;
      ctx.lineWidth = m.elite ? 3 : 2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 충격파 링
    for (const ring of this.rings) {
      ctx.save();
      ctx.globalAlpha = 0.7 * (1 - ring.r / ring.maxR) + 0.2;
      ctx.strokeStyle = '#e8e0cf';
      ctx.lineWidth = ring.width * 0.6;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 상자 / 모닥불
    for (const it of this.interactables) {
      if (it.kind === 'chest') {
        const img = it.used ? Sprites.chestOpen : Sprites.chest;
        Renderer.drawSprite(img, it.x, it.y);
        if (!it.used) {
          const glow = 0.3 + Math.sin(it.t * 4) * 0.15;
          ctx.globalAlpha = glow;
          ctx.fillStyle = '#f7b32b';
          ctx.beginPath();
          ctx.arc(it.x, it.y, 34, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      } else if (it.kind === 'camp') {
        ctx.fillStyle = '#5e3a26';
        ctx.save();
        ctx.translate(it.x, it.y + 8);
        ctx.rotate(0.5);
        ctx.fillRect(-16, -4, 32, 8);
        ctx.rotate(-1);
        ctx.fillRect(-16, -4, 32, 8);
        ctx.restore();
        if (!it.used) {
          if (Math.random() < 0.6) {
            Particles.burst(it.x + (Math.random() - 0.5) * 14, it.y, {
              count: 1, colors: ['#ff7043', '#ffd866', '#e43b44'], speed: 40, life: 0.6, size: 4, gravity: -200,
            });
          }
          const glow = 0.14 + Math.sin(it.t * 6) * 0.04;
          ctx.globalAlpha = glow;
          ctx.fillStyle = '#ff7043';
          ctx.beginPath();
          ctx.arc(it.x, it.y, 70, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }

    for (const pk of this.pickups) {
      const bob = Math.sin(pk.t * 5) * 3;
      ctx.drawImage(Sprites.heart, Math.round(pk.x - 12), Math.round(pk.y - 9 + bob), 24, 18);
    }
    for (const o of this.orbs) {
      ctx.drawImage(Sprites.gem, Math.round(o.x - 7), Math.round(o.y - 7), 14, 14);
    }

    // 사망 잔상 (무너져 내리며 페이드)
    for (const c of this.corpses) {
      const k = Math.min(1, c.t / c.dur);
      Renderer.drawSprite(c.img, c.x, c.y + k * 8, {
        flip: c.flip,
        alpha: (1 - k) * 0.9,
        squashY: (1 - k * 0.75) * c.scale,
        squashX: (1 + k * 0.45) * c.scale,
      });
    }

    const drawables = [...this.enemies];
    if (this.state !== 'over') drawables.push(this.player);
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) {
      // 등장 연출: 땅에서 솟아오르며 실체화
      if (d.spawnT > 0) {
        const k = 1 - d.spawnT / (d.isBoss ? 0.6 : 0.35);
        const key = d.isBoss ? d.def.sprite : d.sprite;
        const img = d.elite ? Sprites.tint(Sprites[key]) : Sprites[key];
        const sc = d.isBoss ? d.def.scale : 1;
        Renderer.drawSprite(img, d.x, d.y + (1 - k) * 10, {
          flip: d.flip,
          alpha: 0.25 + 0.75 * k,
          squashY: (0.25 + 0.75 * k) * sc,
          squashX: (1.5 - 0.5 * k) * sc,
        });
        if (Math.random() < 0.4) {
          Particles.burst(d.x + (Math.random() - 0.5) * 24, d.y + 14, {
            count: 1, colors: ['#5c1e5e', '#8a3a8c'], speed: 40, life: 0.3, size: 3, gravity: -80,
          });
        }
        continue;
      }
      d.draw(ctx);
    }

    // 투사체
    for (const a of this.arrows) {
      const style = PROJ_STYLES[a.kind] || PROJ_STYLES.arrow;
      if (style.sprite) {
        Renderer.drawSprite(Sprites.arrow, a.x, a.y, { rot: Math.atan2(a.dir.y, a.dir.x), scale: 3 });
      } else {
        ctx.fillStyle = style.color;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(a.x - a.dir.x * 4, a.y - a.dir.y * 4, a.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // 자동 타겟 표시 (모서리 브래킷)
    if (this.state === 'play' && this.player) {
      const t = this.player.autoTarget(this);
      if (t) {
        const r = t.r + 8;
        const L = 6;
        ctx.save();
        ctx.strokeStyle = 'rgba(228,59,68,0.75)';
        ctx.lineWidth = 2;
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          ctx.beginPath();
          ctx.moveTo(t.x + sx * r, t.y + sy * r - sy * L);
          ctx.lineTo(t.x + sx * r, t.y + sy * r);
          ctx.lineTo(t.x + sx * r - sx * L, t.y + sy * r);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 플레이어 투사체
    for (const b of this.pbolts) {
      if (b.kind === 'parrow') {
        Renderer.drawSprite(Sprites.arrow, b.x, b.y, { rot: Math.atan2(b.dir.y, b.dir.x), scale: 3 });
        if (b.finisher) {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = '#38b764';
          ctx.beginPath();
          ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      } else {
        const r = b.finisher ? 9 : 6;
        ctx.fillStyle = '#8a5ac2';
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e0c9f5';
        ctx.beginPath();
        ctx.arc(b.x, b.y, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 보스 검격
    for (const s of this.bossSlashes) {
      const t = s.life / s.maxLife;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.globalAlpha = t * 0.8;
      const grad = ctx.createRadialGradient(0, 0, s.range * 0.3, 0, 0, s.range);
      grad.addColorStop(0, 'rgba(228,59,68,0)');
      grad.addColorStop(1, 'rgba(228,59,68,0.9)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, s.range, -s.arc / 2, s.arc / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    Particles.draw(ctx);

    // 5층: 어둠 (시야 제한) — HUD보다 아래에
    if (World.floor === 5 && this.state !== 'over' && this.state !== 'victory') {
      const p = this.player;
      const g = ctx.createRadialGradient(p.x, p.y, 130, p.x, p.y, 300);
      g.addColorStop(0, 'rgba(5,3,10,0)');
      g.addColorStop(1, 'rgba(5,3,10,0.88)');
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, Renderer.W + 40, Renderer.H + 40);
    }

    // [아트 리마스터] 층 컬러 그레이딩 + 상시 비네트 (던전 분위기)
    ctx.fillStyle = World.theme.grade;
    ctx.fillRect(-20, -20, Renderer.W + 40, Renderer.H + 40);
    const vg = ctx.createRadialGradient(
      Renderer.W / 2, Renderer.H / 2, Renderer.H * 0.42,
      Renderer.W / 2, Renderer.H / 2, Renderer.H * 0.85);
    vg.addColorStop(0, 'rgba(5,3,10,0)');
    vg.addColorStop(1, 'rgba(5,3,10,0.34)');
    ctx.fillStyle = vg;
    ctx.fillRect(-20, -20, Renderer.W + 40, Renderer.H + 40);

    HUD.draw(ctx, this);

    // 일시정지 오버레이
    if (this.paused && this.state === 'play') {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(8,8,15,0.6)';
      ctx.fillRect(0, 0, Renderer.W, Renderer.H);
      ctx.textAlign = 'center';
      ctx.font = 'bold 36px monospace';
      ctx.fillStyle = '#e8e0cf';
      ctx.fillText('일시정지', Renderer.W / 2, 250);
      ctx.font = '14px monospace';
      ctx.fillStyle = '#9aa0b4';
      ctx.fillText('ESC / P — 계속하기', Renderer.W / 2, 290);
      ctx.fillText(`시드 ${this.runSeed.toString(36).toUpperCase()}${this.heat > 0 ? ' · 열기 ' + this.heat : ''}`, Renderer.W / 2, 316);
    }

    if (this.state === 'levelup') HUD.drawCardChoice(ctx, this, this.traitCards, this.choiceReason === 'elite' ? '정예 처치 보상!' : '레벨 업!', (t) => `[ ${t.tag} ]`);
    if (this.state === 'relic') HUD.drawCardChoice(ctx, this, this.relicCards, '유물을 선택하라', (r) => `[ ${RARITY[r.rarity].label} ]`, (r) => RARITY[r.rarity].color);
    if (this.state === 'over') HUD.drawGameOver(ctx, this, this.blinkT);
    if (this.state === 'victory') HUD.drawVictory(ctx, this, this.blinkT);

    if (this.transition) {
      const a = this.transition.phase === 'out' ? this.transition.t : 1 - this.transition.t;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = Math.min(1, a);
      ctx.fillStyle = '#08080f';
      ctx.fillRect(0, 0, Renderer.W, Renderer.H);
      ctx.globalAlpha = 1;
    }
  },
};

// ── 부트스트랩 ──
(function boot() {
  const canvas = document.getElementById('game');
  Renderer.init(canvas);
  Input.init(canvas);
  Meta.load();
  AudioSys.muted = Meta.data.muted;

  const qs = new URLSearchParams(location.search);
  if (qs.has('class') && Meta.classUnlocked(qs.get('class'))) {
    Meta.selectClass(qs.get('class'));
  }
  if (qs.has('seed')) {
    const parsed = parseInt(qs.get('seed'), 36);
    if (!Number.isNaN(parsed)) Game._urlSeed = parsed >>> 0;
  }
  if (qs.has('autostart') || qs.has('demo')) Game.restart();
  if (qs.has('demo')) installDemoBot();
  if (qs.has('floor')) {
    // 테스트용: 특정 층 직행
    Dungeon.floor = Math.min(5, Math.max(1, parseInt(qs.get('floor'), 10) || 1));
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
      Game.tick(STEP);
      Input.endFrame();
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
      moveToward(target.x, target.y, 40);
      if (best < 80 && p.attackCd <= 0) {
        p.facing = { x: (target.x - p.x) / best, y: (target.y - p.y) / best };
        Input.justPressed['KeyJ'] = true;
      }
      if (t > 2.5) { Input.justPressed['Space'] = true; t = 0; }
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
