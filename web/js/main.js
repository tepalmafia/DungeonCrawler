// 게임 루프 + 던전 진행 + 전투 판정 허브 (타격감 연출은 hitEnemy/hurtPlayer에 집중)
const Game = {
  state: 'start', // start | play | levelup | transition | over | victory
  player: null,
  enemies: [],
  arrows: [],       // kind: 'arrow'(궁수) | 'soul'(보스)
  pickups: [],      // 하트
  orbs: [],         // XP 보석
  zones: [],        // 감전 장판 (잔전류 특성)
  markers: [],      // 스폰 예고 마커
  pendingSpawns: [],
  interactables: [], // 상자 / 모닥불
  bossSlashes: [],
  kills: 0,
  time: 0,
  hitstop: 0,
  banner: null,
  vignette: 0,
  blinkT: 0,

  // 성장
  xp: 0,
  level: 1,
  xpNext: 18,
  pendingChoices: 0,
  traitCards: [],
  choiceReason: 'levelup', // levelup | elite

  roomCleared: false,
  transition: null, // {phase:'out'|'in', t, type}

  restart() {
    this.player = createPlayer(0, 0);
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
    Particles.clear();
    this.state = 'play';
    Dungeon.newRun();
  },

  // 방 생성 직후 호출 — 엔티티 초기화 + 방 콘텐츠 배치
  onRoomBuilt(type) {
    this.enemies = [];
    this.arrows = [];
    this.orbs = [];
    this.zones = [];
    this.markers = [];
    this.pendingSpawns = [];
    this.interactables = [];
    this.bossSlashes = [];
    this.roomCleared = false;
    Particles.clear();

    const start = World.playerStart();
    this.player.x = start.x;
    this.player.y = start.y;
    this.player.kbx = this.player.kby = 0;

    const depth = Dungeon.roomIndex;
    if (type === 'combat') {
      Dungeon.combatComp(depth).forEach((s, i) => {
        this.pendingSpawns.push({ delay: 0.4 + i * 0.3, type: s.type, elite: s.elite });
      });
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
      this.enemies.push(createBoss(c.x + TS * 4, c.y));
      this.banner = { text: '무덤지기 카론', life: 2.0, maxLife: 2.0 };
      AudioSys.roar();
    }
  },

  // ── 데미지 처리 (feel=true: 히트스톱·셰이크 등 타격감 연출 포함) ──
  damageEnemy(e, dmg, dir, { feel = true, crit = false, kb = 190, color } = {}) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.1;
    if (kb && !e.isBoss) {
      e.kbx += dir.x * kb;
      e.kby += dir.y * kb;
    } else if (kb) {
      e.kbx += dir.x * kb * 0.25; // 보스는 넉백 저항
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

      // 특성: 흡혈 — 크리티컬 시 회복
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
      archer: ['#e8e0cf', '#a99e8c'],
      boar: ['#8d5a3b', '#5e3a26'],
      boss: ['#b13ae0', '#241832', '#e8e0cf'],
    };
    Particles.burst(e.x, e.y, {
      count: e.isBoss ? 40 : 18,
      colors: palettes[e.type] || ['#ffffff'],
      speed: 190, life: 0.55, size: 4,
      gravity: 300, dir: Math.atan2(dir.y, dir.x), spread: 2.6,
    });

    const p = this.player;

    // 특성: 화상 폭발 — 화상 중 사망 시 주변 폭발
    if (p.flags.burnboom && e.status.burn > 0) {
      Particles.burst(e.x, e.y, {
        count: 16, colors: ['#ff7043', '#ffd866', '#e43b44'], speed: 200, life: 0.4, size: 4,
      });
      Renderer.shake(3, 0.15);
      AudioSys.thud();
      for (const other of this.enemies) {
        if (other === e || other.dead) continue;
        const dd = Math.hypot(other.x - e.x, other.y - e.y);
        if (dd < 80) {
          const ddir = { x: (other.x - e.x) / (dd || 1), y: (other.y - e.y) / (dd || 1) };
          this.damageEnemy(other, 2, ddir, { feel: false, kb: 150, color: '#ff7043' });
        }
      }
    }

    // 특성: 과충전 — 감전된 적 처치 시 대시 초기화
    if (p.flags.overcharge && e.status.shock > 0 && p.dashCd > 0) {
      p.dashCd = 0;
      Particles.text(p.x, p.y - 26, '충전!', { color: '#ffd866', size: 13 });
    }

    if (e.isBoss) {
      this.onBossDead();
      return;
    }

    // XP 보석 드랍
    let val = e.xpVal;
    while (val > 0) {
      const v = Math.min(3, val);
      val -= v;
      const a = Math.random() * Math.PI * 2;
      this.orbs.push({
        x: e.x, y: e.y, val: v,
        vx: Math.cos(a) * 90, vy: Math.sin(a) * 90,
      });
    }
    // 하트 드랍
    if (Math.random() < 0.1) {
      this.pickups.push({ x: e.x, y: e.y, t: 0, r: 12 });
    }
  },

  onBossDead() {
    this.state = 'victory';
    Renderer.shake(8, 0.6);
    AudioSys.gameover(); // 하강 스팅어 재활용 (보스 소멸)
    setTimeout(() => AudioSys.wave(), 500);
  },

  hurtPlayer(dmg, dir, kb = 260) {
    const p = this.player;
    if (p.invuln > 0 || this.state !== 'play') return;
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

    // 특성: 가시 갑옷 — 피격 시 반격
    if (p.flags.thorns) {
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dd = Math.hypot(e.x - p.x, e.y - p.y);
        if (dd < 75) {
          const ddir = { x: (e.x - p.x) / (dd || 1), y: (e.y - p.y) / (dd || 1) };
          this.damageEnemy(e, 2, ddir, { feel: false, kb: 280, color: '#5ce0e6' });
        }
      }
      Particles.burst(p.x, p.y, { count: 10, colors: ['#5ce0e6'], speed: 180, life: 0.3, size: 3 });
    }

    if (p.hp <= 0) {
      p.hp = 0;
      this.state = 'over';
      AudioSys.gameover();
      Renderer.shake(8, 0.5);
      Particles.burst(p.x, p.y, {
        count: 30, colors: ['#3b5dc9', '#94a1b8', '#f0c297'], speed: 220, life: 0.8, size: 4, gravity: 250,
      });
    }
  },

  spawnArrow(x, y, dir) {
    this.arrows.push({ kind: 'arrow', x, y, dir, speed: 310, r: 4, life: 3, t: 0 });
  },

  // ── XP & 레벨업 ──
  gainXp(v) {
    this.xp += v;
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

  openTraitChoice(reason) {
    this.choiceReason = reason;
    this.traitCards = rollTraitCards(this.player, 3);
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
      this.traitCards = rollTraitCards(this.player, 3);
      if (this.traitCards.length === 0) { this.pendingChoices = 0; this.state = 'play'; }
    } else {
      this.state = 'play';
    }
  },

  // ── 메인 틱 ──
  tick(dt) {
    this.blinkT += dt;

    if (this.state === 'start') {
      if (Input.anyKeyPressed || Input.mouse.justDown) this.restart();
      return;
    }
    if (this.state === 'over' || this.state === 'victory') {
      Particles.update(dt);
      if (Input.pressed('KeyR') || Input.mouse.justDown) this.restart();
      return;
    }
    if (this.state === 'levelup') {
      // 카드 선택: 1/2/3 키 또는 클릭
      for (let i = 0; i < this.traitCards.length; i++) {
        if (Input.pressed('Digit' + (i + 1))) { this.pickTrait(i); return; }
      }
      if (Input.mouse.justDown) {
        const rects = HUD.cardRects(this.traitCards.length);
        for (let i = 0; i < rects.length; i++) {
          const r = rects[i];
          if (Input.mouse.x >= r.x && Input.mouse.x <= r.x + r.w &&
              Input.mouse.y >= r.y && Input.mouse.y <= r.y + r.h) {
            this.pickTrait(i);
            return;
          }
        }
      }
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
        // 이월된 레벨업이 있으면 새 방에서 바로 처리
        if (this.pendingChoices > 0) this.openTraitChoice('levelup');
      }
      return;
    }

    if (Input.pressed('KeyM')) AudioSys.toggleMute();

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

    if (window.__demoBot) window.__demoBot(this, dt);

    this.player.update(dt, this);

    // ── 스폰 대기열 → 예고 마커 → 적 등장 ──
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
        this.enemies.push(createEnemy(m.type, m.x, m.y, m.elite));
        Particles.burst(m.x, m.y, { count: 8, colors: ['#5c1e5e', '#8a3a8c'], speed: 90, life: 0.35, size: 3 });
        this.markers.splice(i, 1);
      }
    }

    // ── 적 갱신 + 상태이상 ──
    for (const e of this.enemies) {
      if (e.dead) continue;
      // 화상: 0.5초마다 1 피해
      if (e.status.burn > 0) {
        e.status.burn -= dt;
        e.status.burnTick -= dt;
        if (e.status.burnTick <= 0) {
          e.status.burnTick = 0.5;
          this.damageEnemy(e, 1, { x: 0, y: -0.3 }, { feel: false, kb: 0, color: '#ff7043' });
        }
      }
      if (e.status.shock > 0) e.status.shock -= dt;
      if (!e.dead) e.update(dt, this);
    }
    this.enemies = this.enemies.filter((e) => !e.dead);

    // ── 감전 장판 ──
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.life -= dt;
      if (z.life <= 0) { this.zones.splice(i, 1); continue; }
      for (const e of this.enemies) {
        if (e.dead || z.hit.has(e)) continue;
        if (Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) {
          z.hit.add(e);
          e.status.shock = 2;
          this.damageEnemy(e, 1, { x: 0, y: 0 }, { feel: false, kb: 0, color: '#ffd866' });
        }
      }
    }

    // ── 투사체 (화살 / 영혼구) ──
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.life -= dt;
      a.t += dt;
      let vx = a.dir.x, vy = a.dir.y;
      if (a.kind === 'soul') {
        // 영혼구는 수직 방향으로 흔들리며 날아온다
        const wave = Math.sin(a.t * 9) * 0.35;
        vx += -a.dir.y * wave;
        vy += a.dir.x * wave;
      }
      a.x += vx * a.speed * dt;
      a.y += vy * a.speed * dt;
      const p = this.player;
      if (p.invuln <= 0 && Math.hypot(p.x - a.x, p.y - a.y) < p.r + a.r) {
        this.hurtPlayer(1, a.dir);
        this.arrows.splice(i, 1);
        continue;
      }
      if (a.life <= 0 || (a.kind === 'arrow' && World.isSolidAt(a.x, a.y))) {
        Particles.burst(a.x, a.y, {
          count: 4,
          colors: a.kind === 'soul' ? ['#b13ae0'] : ['#a99e8c'],
          speed: 70, life: 0.25, size: 2,
        });
        this.arrows.splice(i, 1);
      }
    }

    // ── 보스 검격 이펙트 수명 ──
    for (let i = this.bossSlashes.length - 1; i >= 0; i--) {
      this.bossSlashes[i].life -= dt;
      if (this.bossSlashes[i].life <= 0) this.bossSlashes.splice(i, 1);
    }

    // ── XP 보석 (자석 흡인) ──
    const p = this.player;
    const magnetR = this.roomCleared ? 9999 : 95; // 방 클리어 시 전부 흡수
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
        if (this.state !== 'play') return; // 레벨업 UI가 열렸으면 중단
      }
    }

    // ── 하트 픽업 ──
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.t += dt;
      if (Math.hypot(p.x - pk.x, p.y - pk.y) < p.r + pk.r) {
        if (p.hp < p.maxHp) p.hp++;
        AudioSys.pickup();
        Particles.burst(pk.x, pk.y, { count: 8, colors: ['#e43b44', '#f5817e'], speed: 100, life: 0.4, size: 3 });
        this.pickups.splice(i, 1);
      }
    }

    // ── 상자 / 모닥불 상호작용 ──
    for (const it of this.interactables) {
      it.t += dt;
      if (it.used) continue;
      if (Math.hypot(p.x - it.x, p.y - it.y) < p.r + it.r) {
        it.used = true;
        if (it.kind === 'chest') {
          AudioSys.chest();
          Renderer.shake(2, 0.1);
          this.pickups.push({ x: it.x - 30, y: it.y + 10, t: 0, r: 12 });
          this.pickups.push({ x: it.x + 30, y: it.y + 10, t: 0, r: 12 });
          for (let k = 0; k < 6; k++) {
            const a = Math.random() * Math.PI * 2;
            this.orbs.push({ x: it.x, y: it.y, val: 3, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160 - 60 });
          }
          Particles.burst(it.x, it.y - 10, { count: 14, colors: ['#f7b32b', '#ffd866'], speed: 150, life: 0.5, size: 3, gravity: 200 });
        } else if (it.kind === 'camp') {
          AudioSys.pickup();
          p.hp = Math.min(p.maxHp, p.hp + 2);
          Particles.text(p.x, p.y - 28, '+2', { color: '#e43b44', size: 18 });
          Particles.burst(it.x, it.y, { count: 12, colors: ['#ff7043', '#ffd866'], speed: 80, life: 0.6, size: 3, gravity: -120 });
        }
      }
    }

    Particles.update(dt);

    // ── 방 클리어 → 출구 문 개방 ──
    if (!this.roomCleared &&
        this.enemies.length === 0 && this.markers.length === 0 && this.pendingSpawns.length === 0) {
      this.roomCleared = true;
      if (Dungeon.roomType !== 'boss') {
        World.openDoors(Dungeon.doorOptions());
        // 정예방 클리어 보상: 무료 특성 선택
        if (Dungeon.roomType === 'elite') {
          this.pendingChoices++;
          this.openTraitChoice('elite');
        }
      }
    }

    // ── 문 진입 판정 ──
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

  render() {
    const ctx = Renderer.ctx;
    Renderer.begin();
    World.draw(ctx);

    if (this.state === 'start') {
      HUD.drawStartScreen(ctx, this.blinkT);
      return;
    }

    World.drawDoors(ctx, this.blinkT);

    // 감전 장판
    for (const z of this.zones) {
      ctx.globalAlpha = Math.min(0.4, z.life) * (0.7 + Math.random() * 0.3);
      ctx.fillStyle = '#ffd866';
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 스폰 예고 마커
    for (const m of this.markers) {
      const r = 10 + m.t * 30;
      ctx.strokeStyle = m.elite ? `rgba(230,80,220,${0.95 - m.t})` : `rgba(160,80,190,${0.9 - m.t})`;
      ctx.lineWidth = m.elite ? 3 : 2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      ctx.stroke();
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
        // 장작 (코드 드로잉)
        ctx.fillStyle = '#5e3a26';
        ctx.save();
        ctx.translate(it.x, it.y + 8);
        ctx.rotate(0.5);
        ctx.fillRect(-16, -4, 32, 8);
        ctx.rotate(-1);
        ctx.fillRect(-16, -4, 32, 8);
        ctx.restore();
        if (!it.used) {
          // 불꽃 파티클 + 빛 번짐
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

    // 하트 픽업
    for (const pk of this.pickups) {
      const bob = Math.sin(pk.t * 5) * 3;
      ctx.drawImage(Sprites.heart, Math.round(pk.x - 12), Math.round(pk.y - 9 + bob), 24, 18);
    }

    // XP 보석
    for (const o of this.orbs) {
      ctx.drawImage(Sprites.gem, Math.round(o.x - 7), Math.round(o.y - 7), 14, 14);
    }

    // y좌표 정렬 렌더링
    const drawables = [...this.enemies];
    if (this.state !== 'over') drawables.push(this.player);
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw(ctx);

    // 투사체
    for (const a of this.arrows) {
      if (a.kind === 'soul') {
        ctx.fillStyle = '#b13ae0';
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e0a9f0';
        ctx.beginPath();
        ctx.arc(a.x - a.dir.x * 3, a.y - a.dir.y * 3, a.r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        if (Math.random() < 0.4) {
          Particles.burst(a.x, a.y, { count: 1, colors: ['#b13ae0'], speed: 15, life: 0.3, size: 2 });
        }
      } else {
        Renderer.drawSprite(Sprites.arrow, a.x, a.y, { rot: Math.atan2(a.dir.y, a.dir.x) });
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
    HUD.draw(ctx, this);

    if (this.state === 'levelup') HUD.drawLevelUp(ctx, this);
    if (this.state === 'over') HUD.drawGameOver(ctx, this, this.blinkT);
    if (this.state === 'victory') HUD.drawVictory(ctx, this, this.blinkT);

    // 방 전환 페이드
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

  const qs = new URLSearchParams(location.search);
  if (qs.has('autostart') || qs.has('demo')) Game.restart();
  if (qs.has('demo')) installDemoBot();
  if (qs.get('jump') === 'boss') {
    // 테스트용: 보스방 직행
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

// 데모 봇: 자동 플레이 (스크린샷/플로우 검증용, ?demo=1)
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
      // 적이 없으면: 상호작용 → 문 순서로 이동
      const it = game.interactables.find((i) => !i.used);
      if (it) moveToward(it.x, it.y, 4);
      else if (World.doorsActive && World.doors.length > 0) {
        moveToward(World.doors[0].x, World.doors[0].y, 4);
      }
    }
  };
  // 레벨업 카드는 항상 1번 선택
  const origTick = Game.tick.bind(Game);
  Game.tick = function (dt) {
    if (this.state === 'levelup') Input.justPressed['Digit1'] = true;
    origTick(dt);
  };
}
