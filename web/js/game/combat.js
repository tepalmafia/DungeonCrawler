// 전투 판정 허브 — 피해/처치/폭발/피격/투사체 생성.
// main.js에서 Object.assign(Game, GameCombat)으로 Game에 합쳐진다.
const GameCombat = {
  // 히트스톱 완화 — '탁탁' 끊기는 멈춤이 렉처럼 보인다는 피드백.
  // 0.35초 창 안에서는 첫 방만 짧게 멈추고, 나머지는 아예 멈추지 않는다 (초당 최대 ~3회).
  // 적용 여부를 돌려줘서 크리 섬광도 같은 리듬으로만 터지게 한다 (연속 번쩍임 방지).
  _applyHitstop(v) {
    if (this.time - (this._lastStopT ?? -9) > 0.35) {
      this.hitstop = Math.max(this.hitstop, v);
      this._lastStopT = this.time;
      return true;
    }
    return false;
  },

  damageEnemy(e, dmg, dir, { feel = true, crit = false, kb = 190, color } = {}) {
    if (e.dead || e.phased) return;
    // 기믹: 중장갑 — 직접 타격만 경감. 화상/중독 틱, 폭발·연쇄·장판(feel=false)은 무시
    if (e.armorCap && feel && dmg > e.armorCap) {
      dmg = e.armorCap;
      crit = false;
      Particles.text(e.x, e.y - 38, '경감!', { color: '#9aa0b4', size: 11 });
    }
    // 보스 버스트 상한 — 특성이 쌓인 빌드가 기믹·페이즈를 보기도 전에 녹이지 못하게.
    // 타격당 최대 피해 = 최대 HP의 1.5% (최소 2) — 어떤 빌드라도 보스는 ~67타를 버틴다.
    // 기준: 유일하게 "보스답다"는 평가를 받은 골렘(중장갑 flat 2, 강빌드 TTK 29s)과 같은 체급.
    // 약한 빌드에는 상한이 걸리지 않으므로 저점 난이도는 그대로다.
    if (e.isBoss) dmg = Math.min(dmg, Math.max(2, Math.round(e.maxHp * 0.015)));
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
      // 히트스톱은 크리티컬에만, 그것도 짧게 — 일반 연타마다 멈추면 '탁탁' 끊기는 스터터가 된다.
      // 일반 타격의 손맛은 흔들림 + 파티클 + 사운드가 담당한다.
      const stopped = crit ? this._applyHitstop(0.055) : false;
      Renderer.shake(crit ? 4 : 2.5, 0.13);
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
        // 화면 섬광은 히트스톱과 같은 리듬으로만 — 고크리 빌드에서 연속 번쩍임(눈 아픔) 방지
        if (stopped) this.critFlash = 0.07;
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
    // 중립 개체(항아리·균열 벽): 처치 집계·도감·드랍 없이 부서진다
    if (e.neutral) {
      Particles.burst(e.x, e.y, {
        count: 10,
        colors: e.type === 'pot' ? ['#7a6a5a', '#5a4a3e', '#c09a4a'] : ['#8a8074', '#5a5a6e'],
        speed: 140, life: 0.4, size: 3, gravity: 260,
        dir: Math.atan2(dir.y, dir.x), spread: 2.4,
      });
      if (e.onDeath) e.onDeath(this);
      return;
    }
    this.kills++;
    Meta.codexKill(e.isBoss ? 'boss' + ((Dungeon.floor - 1) % 5 + 1) : (e.codexType || e.type));
    if (e.isBoss || e.isMini || e.elite) this.hitstop = Math.max(this.hitstop, 0.09); // 굵직한 처치는 항상 강조
    else this._applyHitstop(0.05); // 잡몹 처치는 짧게 — 학살 중 '탁탁' 끊김 방지
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
    // 과충전: 물량방에서 처치가 초당 수 회 일어나면 사실상 무한 대시가 되므로 2초에 1회로 제한
    if (p.flags.overcharge && e.status.shock > 0 && p.dashCharges < p.dashMax && !(p._overchargeCd > 0)) {
      p.dashCharges = p.dashMax;
      p.dashRegenT = 0;
      p._overchargeCd = 2;
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
    // 행운(×2 중첩)·클로버(×1.8)가 겹치면 ×7.2까지 폭주 — 총 배율 상한 ×3
    const luckMul = Math.min(3, p.luckMul);
    let heartChance = 0.045 * floorDecay * bossFight * luckMul * (this.heat >= 4 ? 0.5 : 1);
    if (p.flags.bloodlust) heartChance += 0.12;
    if (p.hp >= p.maxHp) heartChance *= 0.35; // 풀피면 감쇠 — 못 먹는 하트가 바닥에 쌓이는 낭비 방지
    if ((this._roomHearts || 0) >= 2) heartChance *= 0.25; // 방당 2개 이후 급감 (물량 방 인플레 방지)
    if (Math.random() < heartChance) {
      this._roomHearts = (this._roomHearts || 0) + 1;
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


  // 사망 리포트용 — 방금 나를 때린 것의 이름 (가장 가까운 살아있는 적 추정)
  _nearestFoeName() {
    const p = this.player;
    let best = 170, name = null;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < best) {
        best = d;
        if (e.isBoss) name = e.name;
        else if (e.isMini) name = e.miniName || '우두머리';
        else {
          const c = typeof CODEX_ENEMIES !== 'undefined' && CODEX_ENEMIES.find((x) => x.id === (e.codexType || e.type));
          name = c ? c.name : e.type;
        }
        if (e.elite && !e.isBoss && !e.isMini) name = '정예 ' + name;
      }
    }
    return name;
  },

  hurtPlayer(dmg, dir, kb = 260, src = null) {
    const p = this.player;
    if (p.god) return; // 테스트 모드 무적
    if (p.invuln > 0 || this.state !== 'play') return;
    // 사인 기록: 명시된 출처(용암 등) > 최근접 적 추정
    this._lastHurtBy = src || this._nearestFoeName() || '심연의 어둠';

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
        // 제자리 부활은 용암 호수 한복판 등에서 즉사 루프를 만든다 (계측: 998연속 사망) — 방 입구에서 재기
        const rs = World.playerStart();
        p.x = rs.x;
        p.y = rs.y;
        p.kbx = p.kby = 0;
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
      // 사망 리포트 — 죽음을 다음 런의 지식으로 (무엇에게, 어디서)
      this.deathInfo = { src: this._lastHurtBy || '심연의 어둠', floor: Dungeon.floor, room: Dungeon.roomIndex };
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
