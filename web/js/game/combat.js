// 전투 판정 허브 — 피해/처치/폭발/피격/투사체 생성.
// main.js에서 Object.assign(Game, GameCombat)으로 Game에 합쳐진다.
const GameCombat = {
  damageEnemy(e, dmg, dir, { feel = true, crit = false, kb = 190, color } = {}) {
    if (e.dead || e.phased) return;
    // 기믹: 중장갑 — 직접 타격만 경감. 화상/중독 틱, 폭발·연쇄·장판(feel=false)은 무시
    if (e.armorCap && feel && dmg > e.armorCap) {
      dmg = e.armorCap;
      crit = false;
      Particles.text(e.x, e.y - 38, '경감!', { color: '#9aa0b4', size: 11 });
    }
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
      this.hitstop = Math.max(this.hitstop, crit ? 0.1 : 0.045);
      Renderer.shake(crit ? 5 : 2.5, 0.13);
      Particles.burst(e.x, e.y, {
        count: crit ? 16 : 9,
        colors: ['#ffffff', '#f7b32b', '#ffd866'],
        speed: crit ? 220 : 170, life: 0.32, size: 3,
        dir: Math.atan2(dir.y, dir.x), spread: 1.6,
      });
      // 타격 충격파 링 (크리는 이중 링 + 임팩트 스타)
      Particles.ring(e.x, e.y, { r0: 4, r1: crit ? 40 : 26, life: crit ? 0.28 : 0.2, color: crit ? '#ffd866' : '#ffffff', width: crit ? 4 : 3 });
      if (crit) {
        Particles.ring(e.x, e.y, { r0: 2, r1: 22, life: 0.18, color: '#ffffff', width: 2 });
        Particles.star(e.x, e.y, { size: 30, color: '#fff7c0' });
      }
      if (crit) {
        AudioSys.crit();
        this.critFlash = 0.09; // 화면 전체가 한순간 번쩍 — 크리의 손맛
      } else {
        AudioSys.hit();
      }

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
    Meta.codexKill(e.isBoss ? 'boss' + ((Dungeon.floor - 1) % 5 + 1) : (e.codexType || e.type));
    this.hitstop = Math.max(this.hitstop, 0.08);
    Renderer.shake(3, 0.15);
    AudioSys.die(e.isBoss ? 'boss' : e.elite ? 'elite' : 'small');

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
      bomber: ['#5c3a3a', '#ff4757', '#ffd866'],
      thornPlant: ['#4a7a3f', '#7ab04c'],
      executioner: ['#3d3d52', '#5d6b84', '#c8d4e4'],
      magmaSlime: ['#4a1f1a', '#ff7043', '#ffd866'],
      magmaSmall: ['#4a1f1a', '#ff7043'],
      voidEye: ['#241832', '#b13ae0', '#c9b8e8'],
      skeleton: ['#d8d3c5', '#8a8074'],
      shieldSkeleton: ['#d8d3c5', '#3a7ca5'],
      sniper: ['#3d3d52', '#d8d3c5', '#e43b44'],
      swarm: ['#5c3a5c', '#8a5a8a'],
      frog: ['#4a7a3f', '#7ab04c'],
      leech: ['#6a1c2c', '#a43a4a'],
      iceSlime: ['#7ab8d8', '#b8e0f0'],
      frostArcher: ['#3a6a9a', '#5ce0e6'],
      berserker: ['#a43a3a', '#ffd866'],
      wisp: ['#3a8ac0', '#7ac0e8'],
      shaman: ['#6a4a8a', '#38b764'],
      crystal: ['#7a5ac2', '#b89ae8', '#f0e8ff'],
      ghoul: ['#6a7a5a', '#e43b44'],
      charger: ['#5a3a2a', '#8a5a3a', '#d8d3c5'],
      turret: ['#8a5ac2', '#5d6b84'],
      mimic: ['#c09a4a', '#6a1020'],
      stalker: ['#241832', '#b13ae0'],
      brute: ['#7a5a4a', '#5e3a26'],
      imp: ['#c04a3a', '#ffd866'],
      glutton: ['#8a6a9a', '#4a1020'],
      boss: e.def ? e.def.deathPalette : ['#b13ae0'],
    };
    Particles.burst(e.x, e.y, {
      count: e.isBoss ? 48 : 22,
      colors: palettes[e.type] || ['#ffffff'],
      speed: 210, life: 0.55, size: 4,
      gravity: 300, dir: Math.atan2(dir.y, dir.x), spread: 2.6,
    });
    const killPal = palettes[e.type] || ['#ffffff'];
    Particles.ring(e.x, e.y, { r0: 6, r1: e.isBoss ? 90 : 44, life: e.isBoss ? 0.45 : 0.3, color: killPal[0], width: 4 });
    Particles.star(e.x, e.y, { size: e.isBoss ? 46 : 26, color: '#ffffff' });
    if (e.isBoss) {
      Particles.ring(e.x, e.y, { r0: 4, r1: 140, life: 0.6, color: '#ffffff', width: 3 });
      Particles.ring(e.x, e.y, { r0: 2, r1: 60, life: 0.35, color: killPal[1] || killPal[0], width: 5 });
    }

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

    // 처치 시 스킬 쿨다운 0.3초 감소 — 무리를 잘 쓸수록 스킬이 자주 돈다
    if (p.skillCd > 0) p.skillCd = Math.max(0, p.skillCd - 0.3);

    // 사망 시 발동 효과 (적 고유 + 특성 + 유물)
    if (e.onDeath) e.onDeath(this);

    // 왕의 권능 (전설): 처치 시 5% 영혼 폭발
    if (p.flags.monarch && Math.random() < 0.05) {
      this._explode(e.x, e.y, 90, 3, ['#ffd866', '#fff7c0', '#b13ae0'], '#ffd866');
      Particles.text(e.x, e.y - 34, '왕의 권능!', { color: '#ffd866', size: 14 });
    }
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

    if (e.noDrops) return; // 폭탄벌레 자폭 등 — 보상 없는 죽음

    // 중간보스(우두머리) 처치 보상: 하트 확정 + 영혼 파편 즉시 지급
    if (e.isMini) {
      this.pickups.push({ x: e.x, y: e.y, t: 0, r: 12 });
      const bonus = 6 + Dungeon.floor * 2;
      Meta.data.shards += bonus;
      Meta.save();
      Particles.text(e.x, e.y - 40, `◆ +${bonus}`, { color: '#2ec4b6', size: 16 });
      this.banner = { text: `${e.miniName} 격파!`, life: 1.5, maxLife: 1.5, color: '#2ec4b6' };
      Renderer.shake(5, 0.3);
    }

    let val = e.xpVal;
    while (val > 0) {
      const v = Math.min(3, val);
      val -= v;
      const a = Math.random() * Math.PI * 2;
      this.orbs.push({ x: e.x, y: e.y, val: v, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 });
    }
    // 하트: 기본 4.5% (개체수 +30% 보정) + 층이 깊을수록 감소 (최저 50%)
    // 보스전 중에는 절반 — 부하가 회복 셔틀이 되지 않게 (긴장 유지)
    const floorDecay = Math.max(0.5, 1 - 0.04 * (Dungeon.floor - 1));
    const bossFight = this.enemies.some((b) => b.isBoss && !b.dead) ? 0.5 : 1;
    let heartChance = 0.045 * floorDecay * bossFight * p.luckMul * (this.heat >= 4 ? 0.5 : 1);
    if (p.flags.bloodlust) heartChance += 0.12;
    if (Math.random() < heartChance) {
      this.pickups.push({ x: e.x, y: e.y, t: 0, r: 12 });
    }
  },

  _explode(x, y, radius, dmg, colors, textColor) {
    Particles.burst(x, y, { count: 20, colors, speed: 220, life: 0.4, size: 4 });
    Particles.ring(x, y, { r0: 8, r1: radius, life: 0.3, color: colors[0], width: 5 });
    Particles.ring(x, y, { r0: 4, r1: radius * 0.6, life: 0.22, color: '#ffffff', width: 2 });
    Renderer.shake(3.5, 0.16);
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


  hurtPlayer(dmg, dir, kb = 260) {
    const p = this.player;
    if (p.god) return; // 테스트 모드 무적
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
    p.invuln = p.classId === 'knight' ? 1.2 : 0.9; // 검사: 근접 리스크 보상 — 다굴 방지
    p.kbx = dir.x * kb;
    p.kby = dir.y * kb;
    this.hitstop = Math.max(this.hitstop, 0.09); // 얻어맞는 순간은 세계가 함께 멈춘다
    this.vignette = 0.8;
    this.hurtFlash = 0.22; // 화면 전체 적색 섬광 + HUD 하트 흔들림
    Renderer.shake(7, 0.35);
    AudioSys.hurt();
    Particles.burst(p.x, p.y, {
      count: 13, colors: ['#e43b44', '#8a1c2c'], speed: 160, life: 0.4, size: 3,
    });
    Particles.ring(p.x, p.y, { r0: 6, r1: 38, life: 0.25, color: '#e43b44', width: 4 });

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
      // 테스트 모드 무한 부활 (F 토글): 죽음 직전 상황을 계속 테스트할 수 있다
      if (this.testMode && this.reviveMode) {
        if (Bot.enabled) Bot.onDeath(Dungeon.floor); // 층별 사망 집계
        p.hp = p.maxHp;
        p.invuln = 2;
        this.banner = { text: '♻ 부활 (테스트 모드)', life: 1.2, maxLife: 1.2, color: '#5ce0e6' };
        Particles.burst(p.x, p.y, { count: 16, colors: ['#5ce0e6', '#a9fff7'], speed: 160, life: 0.5, size: 3 });
        return;
      }
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
      if (Bot.enabled) Bot.onDeath(Dungeon.floor); // 실사망도 집계
      this.endRun(false);
      this.state = 'over';
      AudioSys.gameover();
      Renderer.shake(8, 0.5);
      Particles.burst(p.x, p.y, {
        count: 30, colors: ['#3b5dc9', '#94a1b8', '#f0c297'], speed: 220, life: 0.8, size: 4, gravity: 250,
      });
    }
  },

  spawnProjectile(kind, x, y, dir, { speed = 250, dmg = 1, slow = 0, homing = false, life = 4 } = {}) {
    const style = PROJ_STYLES[kind] || PROJ_STYLES.arrow;
    this.arrows.push({ kind, x, y, dir, speed, dmg, slow, homing, r: style.r || 4, life, t: 0 });
  },
};
