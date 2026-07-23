// 플레이어 (검사): 이동 / 3연격 콤보 / 대시(무적·충전식) + 특성·유물로 성장
function createPlayer(x, y) {
  return {
    x, y,
    r: 13,
    maxHp: 5,
    hp: 5,
    speed: 195,
    facing: { x: 1, y: 0 },
    flip: false,

    // 특성·유물로 성장하는 스탯
    bonusAtk: 0,
    atkCdMul: 1,
    critChance: 0.05,
    critMul: 2,
    rangeMul: 1,
    comboLv: 0,       // 콤보 마스터 스택
    xpMul: 1,
    magnetMul: 1,
    luckMul: 1,
    dashRegenMul: 1,
    flags: {},        // 특성 고유 효과
    rflags: {},       // 유물 고유 효과
    traits: [],
    relics: [],
    lifestealCd: 0,
    reviveUsed: false,

    // 보호막 (수호의 문장)
    shield: false,
    shieldT: 0,

    // 공격
    combo: 0,
    comboTimer: 0,
    attackCd: 0,
    slashes: [],
    dashCritReady: false, // 사냥꾼의 각반

    // 대시 (충전식 — 시간의 모래로 2회 충전)
    dashMax: 1,
    dashCharges: 1,
    dashRegenT: 0,
    dashTimer: 0,
    dashDir: { x: 1, y: 0 },
    dashHit: null,    // 돌파 특성: 이번 대시로 때린 적
    ghosts: [],
    _trailDist: 0,

    invuln: 0,
    slowT: 0,         // 거미줄 감속
    kbx: 0, kby: 0,
    animT: 0,
    moving: false,

    dashRegenTime() {
      return this.rflags.engine ? 0.05 : 1.5 * this.dashRegenMul;
    },

    update(dt, game) {
      this.animT += dt;
      if (this.attackCd > 0) this.attackCd -= dt;
      if (this.comboTimer > 0) this.comboTimer -= dt; else this.combo = 0;
      if (this.invuln > 0) this.invuln -= dt;
      if (this.lifestealCd > 0) this.lifestealCd -= dt;
      if (this.slowT > 0) this.slowT -= dt;

      // 대시 충전
      if (this.dashCharges < this.dashMax) {
        this.dashRegenT += dt;
        if (this.dashRegenT >= this.dashRegenTime()) {
          this.dashRegenT = 0;
          this.dashCharges++;
        }
      }

      // 보호막 재생
      if (this.flags.shield && !this.shield) {
        this.shieldT += dt;
        if (this.shieldT >= 8) {
          this.shield = true;
          this.shieldT = 0;
          Particles.burst(this.x, this.y, { count: 8, colors: ['#5ce0e6'], speed: 60, life: 0.4, size: 3 });
        }
      }

      // ── 이동 입력 ──
      let mx = 0, my = 0;
      if (Input.down('KeyA', 'ArrowLeft')) mx -= 1;
      if (Input.down('KeyD', 'ArrowRight')) mx += 1;
      if (Input.down('KeyW', 'ArrowUp')) my -= 1;
      if (Input.down('KeyS', 'ArrowDown')) my += 1;
      const len = Math.hypot(mx, my);
      if (len > 0) {
        mx /= len; my /= len;
        this.facing = { x: mx, y: my };
        if (mx !== 0) this.flip = mx < 0;
      }
      this.moving = len > 0;

      // ── 대시 ──
      if (Input.pressed('Space', 'ShiftLeft', 'ShiftRight') && this.dashCharges >= 1) {
        this.dashCharges--;
        this.dashTimer = 0.16;
        this.invuln = Math.max(this.invuln, 0.22);
        this.dashDir = len > 0 ? { x: mx, y: my } : { ...this.facing };
        this._trailDist = 0;
        this.dashHit = new Set();
        if (this.rflags.dashcrit) this.dashCritReady = true;
        AudioSys.dash();
        Particles.burst(this.x, this.y, {
          count: 8, colors: ['#8a8aa0', '#5c5c74'], speed: 60, life: 0.35, size: 3,
        });
      }

      if (this.dashTimer > 0) {
        this.dashTimer -= dt;
        const step = 560 * dt;
        World.moveEntity(this, this.dashDir.x * step, this.dashDir.y * step);
        this.ghosts.push({ x: this.x, y: this.y, flip: this.flip, life: 0.25 });

        // 특성: 잔전류
        if (this.flags.shocktrail) {
          this._trailDist += step;
          if (this._trailDist >= 26) {
            this._trailDist = 0;
            game.zones.push({ x: this.x, y: this.y, r: 26, life: 1.2, hit: new Set() });
          }
        }
        // 특성: 돌파 — 대시로 적을 치고 지나간다
        if (this.flags.ram) {
          for (const e of game.enemies) {
            if (e.dead || this.dashHit.has(e) || e.phased) continue;
            if (Math.hypot(e.x - this.x, e.y - this.y) < e.r + this.r + 4) {
              this.dashHit.add(e);
              game.hitEnemy(e, 1, { ...this.dashDir }, { kb: 260 });
            }
          }
        }
      } else if (len > 0) {
        const spd = this.speed * (this.slowT > 0 ? 0.55 : 1);
        World.moveEntity(this, mx * spd * dt, my * spd * dt);
      }

      if (Math.abs(this.kbx) > 1 || Math.abs(this.kby) > 1) {
        World.moveEntity(this, this.kbx * dt, this.kby * dt);
        this.kbx *= Math.pow(0.005, dt);
        this.kby *= Math.pow(0.005, dt);
      }

      for (let i = this.ghosts.length - 1; i >= 0; i--) {
        this.ghosts[i].life -= dt;
        if (this.ghosts[i].life <= 0) this.ghosts.splice(i, 1);
      }

      // ── 공격 ──
      const attackInput = Input.mouse.justDown || Input.pressed('KeyJ');
      if (attackInput && this.attackCd <= 0 && this.dashTimer <= 0) {
        let dir;
        if (Input.mouse.justDown) {
          const dx = Input.mouse.x - Renderer.offsetX - this.x;
          const dy = Input.mouse.y - Renderer.offsetY - this.y;
          const d = Math.hypot(dx, dy) || 1;
          dir = { x: dx / d, y: dy / d };
          if (dx !== 0) this.flip = dx < 0;
        } else {
          dir = { ...this.facing };
        }
        this.attack(dir, game);
      }

      for (let i = this.slashes.length - 1; i >= 0; i--) {
        this.slashes[i].life -= dt;
        if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
      }
    },

    // 현재 스탯 기준 공격력 계산 (특성·유물 보정 포함)
    currentAtk() {
      let atk = 1 + this.bonusAtk;
      if (this.flags.bloodpact && this.hp >= this.maxHp) atk += 2;
      if (this.flags.berserk && this.hp <= 2) atk += 1;
      if (this.rflags.berserkhelm && this.hp <= 3) atk += 3;
      return atk;
    },

    attack(dir, game) {
      const stage = this.combo;
      const finisher = stage === 2;
      const range = (finisher ? 78 : 64) * this.rangeMul;
      const arc = finisher ? 2.4 : 1.9;
      const baseDmg = this.currentAtk();
      const finisherMul = 2 + this.comboLv * 0.5 * 2; // 콤보 마스터: +50%/스택
      const dmg = finisher ? Math.round(baseDmg * finisherMul) : baseDmg;
      const angle = Math.atan2(dir.y, dir.x);

      let cd = (finisher ? 0.45 : 0.22) * this.atkCdMul;
      if (this.flags.berserk && this.hp <= 2) cd *= 0.7;
      this.attackCd = cd;
      this.comboTimer = 0.9;
      this.combo = (this.combo + 1) % 3;
      AudioSys.slash();

      this.slashes.push({
        angle, range, arc,
        life: finisher ? 0.16 : 0.12,
        maxLife: finisher ? 0.16 : 0.12,
        finisher,
      });

      World.moveEntity(this, dir.x * 10, dir.y * 10);

      let hitAny = false;
      for (const e of game.enemies) {
        if (e.dead || e.phased) continue; // 비물질 망령은 못 맞춘다
        const dx = e.x - this.x;
        const dy = e.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > range + e.r) continue;
        let diff = Math.atan2(dy, dx) - angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) > arc / 2 + 0.25) continue;

        const hitDir = { x: dx / (dist || 1), y: dy / (dist || 1) };

        // 골렘 정면 방어
        if (e.blocksFrom && e.blocksFrom(hitDir)) {
          Particles.text(e.x, e.y - 22, '막힘', { color: '#5ce0e6', size: 13 });
          Particles.burst(e.x - hitDir.x * 12, e.y - hitDir.y * 12, {
            count: 5, colors: ['#5ce0e6', '#94a1b8'], speed: 90, life: 0.25, size: 2,
          });
          AudioSys.clank();
          hitAny = true;
          continue;
        }

        // 크리티컬 판정 (유리 대검 / 발화점 / 각반 / 일반 확률)
        let crit = Math.random() < this.critChance;
        if (this.rflags.allcrit) crit = true;
        if (this.flags.firecrit && e.status.burn > 0) crit = true;
        if (this.dashCritReady) { crit = true; this.dashCritReady = false; }

        // 부식·정전기: 상태이상 적에게 추가 피해
        let bonus = 0;
        if (this.flags.corrode && e.status.poison > 0) bonus += 1;
        if (this.flags.static && e.status.shock > 0) bonus += 1;

        const finalDmg = (crit ? Math.round(dmg * this.critMul) : dmg) + bonus;
        const kb = finisher ? 320 : 190;
        game.hitEnemy(e, finalDmg, hitDir, { crit, kb });

        // 상태이상 부여
        if (this.flags.ignite && !e.dead && Math.random() < 0.25) {
          e.status.burn = this.flags.inferno ? 4 : 2;
          Particles.burst(e.x, e.y, { count: 4, colors: ['#ff7043', '#ffd866'], speed: 60, life: 0.3, size: 3 });
        }
        if (this.flags.poison && !e.dead && Math.random() < 0.3) {
          e.status.poison = 4;
          Particles.burst(e.x, e.y, { count: 4, colors: ['#6ab04c'], speed: 60, life: 0.3, size: 3 });
        }

        // 연쇄 번개
        if (this.flags.chain && Math.random() < 0.2) {
          let nearest = null;
          let best = 170;
          for (const o of game.enemies) {
            if (o === e || o.dead || o.phased) continue;
            const od = Math.hypot(o.x - e.x, o.y - e.y);
            if (od < best) { best = od; nearest = o; }
          }
          if (nearest) {
            nearest.status.shock = 2;
            game.damageEnemy(nearest, 2, { x: 0, y: 0 }, { feel: false, kb: 60, color: '#ffd866' });
            // 번개 시각 효과: 두 적 사이 파티클 라인
            const steps = 6;
            for (let s = 0; s <= steps; s++) {
              const lx = e.x + ((nearest.x - e.x) * s) / steps + (Math.random() - 0.5) * 10;
              const ly = e.y + ((nearest.y - e.y) * s) / steps + (Math.random() - 0.5) * 10;
              Particles.burst(lx, ly, { count: 1, colors: ['#ffd866', '#fff7c0'], speed: 15, life: 0.2, size: 3 });
            }
          }
        }
        hitAny = true;
      }
      if (hitAny && finisher) Renderer.shake(3, 0.15);
    },

    draw(ctx) {
      for (const g of this.ghosts) {
        Renderer.drawSprite(Sprites.player, g.x, g.y, {
          flip: g.flip, alpha: g.life * 1.6,
        });
      }

      const bob = this.moving ? Math.abs(Math.sin(this.animT * 11)) * 3 : Math.sin(this.animT * 3) * 1;
      const rot = this.moving ? Math.sin(this.animT * 11) * 0.08 : 0;
      const flash = this.invuln > 0 && Math.floor(this.invuln * 18) % 2 === 0;

      Renderer.drawSprite(flash ? Sprites.white(Sprites.player) : Sprites.player,
        this.x, this.y - bob, {
          flip: this.flip, rot,
          alpha: this.invuln > 0 ? 0.8 : 1,
        });

      // 보호막 링
      if (this.shield) {
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(this.animT * 5) * 0.2;
        ctx.strokeStyle = '#5ce0e6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r + 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      for (const s of this.slashes) {
        const t = s.life / s.maxLife;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(s.angle);
        ctx.globalAlpha = t * 0.85;
        const grad = ctx.createRadialGradient(0, 0, s.range * 0.3, 0, 0, s.range);
        grad.addColorStop(0, s.finisher ? 'rgba(247,179,43,0)' : 'rgba(255,255,255,0)');
        grad.addColorStop(1, s.finisher ? 'rgba(247,179,43,0.9)' : 'rgba(255,255,255,0.8)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, s.range, -s.arc / 2, s.arc / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    },
  };
}
