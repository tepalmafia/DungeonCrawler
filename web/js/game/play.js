// 플레이 상태 프레임 갱신 — 환경 위험/스폰/적/장판/투사체/스킬 이펙트/픽업/방 클리어.
// Game.tick(main.js)이 상태 분기 후 매 프레임 호출한다.
const GamePlay = {
  _tickPlay(dt) {
    if (Input.pressed('KeyM')) {
      AudioSys.toggleMute();
      Meta.data.muted = AudioSys.muted;
      Meta.save();
    }

    // 획득 목록 (Tab) — 열려 있는 동안 게임 정지
    if (Input.pressed('Tab')) {
      this.showInventory = !this.showInventory;
      AudioSys.pickup();
    }
    if (this.showInventory) {
      if (Input.pressed('Escape', 'KeyP')) this.showInventory = false;
      return;
    }

    // 일시정지 (Q로 런 포기 가능)
    if (Input.pressed('Escape', 'KeyP')) {
      this.paused = !this.paused;
      AudioSys.pickup();
    }
    if (this.paused) {
      if (Input.pressed('KeyQ')) {
        this.paused = false;
        this.gaveUp = true;
        this.endRun(false);
        this.state = 'over';
        AudioSys.gameover();
      }
      return;
    }

    // 테스트 모드 치트
    if (this.testMode) {
      this._tickCheats();
      if (this.state !== 'play') return; // 층 이동/승리로 상태가 바뀌었으면 중단
    }

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
        e.speed *= 1 + 0.02 * (Dungeon.floor - 1); // 층당 +2% 속도 — 심층일수록 압박
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
      if (z.kind === 'poison' || z.kind === 'fire') {
        z.tickT -= dt;
        if (z.tickT <= 0) {
          z.tickT = 0.8;
          for (const e of this.enemies) {
            if (e.dead || e.phased) continue;
            if (Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) {
              if (z.kind === 'poison') e.status.poison = Math.max(e.status.poison, 1.5);
              else e.status.burn = Math.max(e.status.burn, 1.2);
              this.damageEnemy(e, 1, { x: 0, y: 0 }, { feel: false, kb: 0, color: z.kind === 'poison' ? '#6ab04c' : '#ff7043' });
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
      // 추적탄 (공허의 눈): 플레이어를 향해 천천히 선회 — 직각으로 대시하면 뿌리칠 수 있다
      if (a.homing) {
        const cur = Math.atan2(a.dir.y, a.dir.x);
        const tgt = Math.atan2(p.y - a.y, p.x - a.x);
        let diff = tgt - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const na = cur + Math.sign(diff) * Math.min(Math.abs(diff), 2.1 * dt);
        a.dir = { x: Math.cos(na), y: Math.sin(na) };
      }
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

    // ── 궁수 스킬: 화살비 ──
    for (let i = this.rains.length - 1; i >= 0; i--) {
      const r = this.rains[i];
      r.t += dt;
      if (r.fired < r.shots) {
        r.next -= dt;
        if (r.next <= 0) {
          r.next = 0.08;
          r.fired++;
          const a = Math.random() * Math.PI * 2;
          const rr = Math.sqrt(Math.random()) * r.r * 0.9;
          const ix = r.x + Math.cos(a) * rr;
          const iy = r.y + Math.sin(a) * rr;
          AudioSys.rainHit();
          Particles.burst(ix, iy, { count: 5, colors: ['#d9cbb8', '#38b764'], speed: 90, life: 0.25, size: 2 });
          Particles.ring(ix, iy, { r0: 3, r1: 20, life: 0.18, color: '#d9cbb8', width: 2 });
          for (const e of this.enemies) {
            if (e.dead || e.phased) continue;
            const dd = Math.hypot(e.x - ix, e.y - iy);
            if (dd < 30 + e.r) {
              p.strike(this, e, { x: (e.x - ix) / (dd || 1), y: (e.y - iy) / (dd || 1) }, { kb: 130 });
            }
          }
          if (r.explo) {
            this._explode(ix, iy, 36, 1, ['#38b764', '#ffd866'], '#38b764');
          }
        }
      } else if (r.t > 2) {
        this.rains.splice(i, 1);
      }
    }

    // ── 마도사 스킬: 메테오 ──
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.t -= dt;
      if (m.t <= 0) {
        Renderer.shake(6, 0.3);
        this.hitstop = Math.max(this.hitstop, 0.07);
        AudioSys.meteorImpact();
        Particles.burst(m.x, m.y, { count: 26, colors: ['#ff7043', '#ffd866', '#e25822'], speed: 240, life: 0.5, size: 4, gravity: 150 });
        Particles.ring(m.x, m.y, { r0: 10, r1: m.r, life: 0.35, color: '#ff7043', width: 6 });
        Particles.ring(m.x, m.y, { r0: 6, r1: m.r * 0.6, life: 0.25, color: '#fff7c0', width: 3 });
        Particles.star(m.x, m.y, { size: 40, color: '#ffd866' });
        for (const e of this.enemies) {
          if (e.dead || e.phased) continue;
          const dd = Math.hypot(e.x - m.x, e.y - m.y);
          if (dd < m.r + e.r) {
            const dir = { x: (e.x - m.x) / (dd || 1), y: (e.y - m.y) / (dd || 1) };
            const dmg = p.currentAtk() * 3;
            const crit = p.rflags.allcrit || Math.random() < p.critChance;
            this.hitEnemy(e, crit ? Math.round(dmg * p.critMul) : dmg, dir, { crit, kb: 320 });
            if (!e.dead) e.status.burn = Math.max(e.status.burn, p.flags.inferno ? 4 : 2);
          }
        }
        if (p.flags.mg_ash) {
          this.zones.push({ x: m.x, y: m.y, r: 70, life: 3, kind: 'fire', tickT: 0.4, hit: null });
        }
        this.meteors.splice(i, 1);
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
      Meta.save(); // 도감 킬 기록 등 방 단위 저장
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
};
