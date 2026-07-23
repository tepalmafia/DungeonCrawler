// 플레이어 — 직업 3종 (검사: 근접 3연격 / 궁수: 화살 / 마도사: 유도 마탄).
// 타격 판정(strike)은 공용: 크리·상태이상·시너지가 모든 직업에서 동일하게 작동한다.
function createPlayer(x, y, classId = 'knight') {
  const cls = CLASSES[classId] || CLASSES.knight;
  return {
    x, y,
    r: 13,
    classId: cls.id,
    maxHp: cls.hp + Meta.lvl('vit'),
    hp: cls.hp + Meta.lvl('vit'),
    speed: cls.speed,
    facing: { x: 1, y: 0 },
    flip: false,

    bonusAtk: Meta.lvl('pow'),
    atkCdMul: 1,
    critChance: 0.05,
    critMul: 2,
    rangeMul: 1,
    comboLv: 0,
    xpMul: 1,
    magnetMul: 1,
    luckMul: 1,
    dashRegenMul: Math.pow(0.9, Meta.lvl('dash')),
    flags: {},
    rflags: {},
    traits: [],
    relics: [],
    lifestealCd: 0,
    reviveUsed: false,

    shield: false,
    shieldT: 0,

    combo: 0,
    comboTimer: 0,
    attackCd: 0,
    slashes: [],
    dashCritReady: false,

    dashMax: 1,
    dashCharges: 1,
    dashRegenT: 0,
    dashTimer: 0,
    dashDir: { x: 1, y: 0 },
    dashHit: null,
    ghosts: [],
    _trailDist: 0,

    invuln: 0,
    slowT: 0,
    kbx: 0, kby: 0,
    animT: 0,
    moving: false,
    attackPoseT: 0, // 공격 자세 프레임 유지 시간

    sprImg() {
      return Sprites[cls.sprite];
    },

    dashRegenTime() {
      return this.rflags.engine ? 0.05 : 1.5 * this.dashRegenMul;
    },

    update(dt, game) {
      this.animT += dt;
      if (this.attackCd > 0) this.attackCd -= dt;
      if (this.attackPoseT > 0) this.attackPoseT -= dt;
      if (this.comboTimer > 0) this.comboTimer -= dt; else this.combo = 0;
      if (this.invuln > 0) this.invuln -= dt;
      if (this.lifestealCd > 0) this.lifestealCd -= dt;
      if (this.slowT > 0) this.slowT -= dt;

      if (this.dashCharges < this.dashMax) {
        this.dashRegenT += dt;
        if (this.dashRegenT >= this.dashRegenTime()) {
          this.dashRegenT = 0;
          this.dashCharges++;
        }
      }

      if (this.flags.shield && !this.shield) {
        this.shieldT += dt;
        if (this.shieldT >= 8) {
          this.shield = true;
          this.shieldT = 0;
          Particles.burst(this.x, this.y, { count: 8, colors: ['#5ce0e6'], speed: 60, life: 0.4, size: 3 });
        }
      }

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

        if (this.flags.shocktrail) {
          this._trailDist += step;
          if (this._trailDist >= 26) {
            this._trailDist = 0;
            game.zones.push({ x: this.x, y: this.y, r: 26, life: 1.2, hit: new Set() });
          }
        }
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

    currentAtk() {
      let atk = 1 + this.bonusAtk;
      if (this.flags.bloodpact && this.hp >= this.maxHp) atk += 2;
      if (this.flags.berserk && this.hp <= 2) atk += 1;
      if (this.rflags.berserkhelm && this.hp <= 3) atk += 3;
      return atk;
    },

    // ── 공용 타격 판정: 크리·추가피해·상태이상·연쇄를 한 곳에서 ──
    // 반환: 'blocked' | 'hit'
    strike(game, e, hitDir, { finisher = false, kb = 190 } = {}) {
      if (e.blocksFrom && e.blocksFrom(hitDir)) {
        Particles.text(e.x, e.y - 22, '막힘', { color: '#5ce0e6', size: 13 });
        Particles.burst(e.x - hitDir.x * 12, e.y - hitDir.y * 12, {
          count: 5, colors: ['#5ce0e6', '#94a1b8'], speed: 90, life: 0.25, size: 2,
        });
        AudioSys.clank();
        return 'blocked';
      }

      let crit = Math.random() < this.critChance;
      if (this.rflags.allcrit) crit = true;
      if (this.flags.firecrit && e.status.burn > 0) crit = true;
      if (this.dashCritReady) { crit = true; this.dashCritReady = false; }

      let bonus = 0;
      if (this.flags.corrode && e.status.poison > 0) bonus += 1;
      if (this.flags.static && e.status.shock > 0) bonus += 1;

      const baseDmg = this.currentAtk();
      const dmg = finisher ? Math.round(baseDmg * (2 + this.comboLv)) : baseDmg;
      const finalDmg = (crit ? Math.round(dmg * this.critMul) : dmg) + bonus;
      game.hitEnemy(e, finalDmg, hitDir, { crit, kb });

      if (this.flags.ignite && !e.dead && Math.random() < 0.25) {
        e.status.burn = this.flags.inferno ? 4 : 2;
        Particles.burst(e.x, e.y, { count: 4, colors: ['#ff7043', '#ffd866'], speed: 60, life: 0.3, size: 3 });
      }
      if (this.flags.poison && !e.dead && Math.random() < 0.3) {
        e.status.poison = 4;
        Particles.burst(e.x, e.y, { count: 4, colors: ['#6ab04c'], speed: 60, life: 0.3, size: 3 });
      }
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
          const steps = 6;
          for (let s = 0; s <= steps; s++) {
            const lx = e.x + ((nearest.x - e.x) * s) / steps + (Math.random() - 0.5) * 10;
            const ly = e.y + ((nearest.y - e.y) * s) / steps + (Math.random() - 0.5) * 10;
            Particles.burst(lx, ly, { count: 1, colors: ['#ffd866', '#fff7c0'], speed: 15, life: 0.2, size: 3 });
          }
        }
      }
      return 'hit';
    },

    attack(dir, game) {
      const finisher = this.combo === 2;
      this.comboTimer = 0.9;
      this.combo = (this.combo + 1) % 3;

      let cdBase;
      if (this.classId === 'knight') cdBase = finisher ? 0.45 : 0.22;
      else if (this.classId === 'archer') cdBase = finisher ? 0.5 : 0.28;
      else cdBase = finisher ? 0.58 : 0.32;
      let cd = cdBase * this.atkCdMul;
      if (this.flags.berserk && this.hp <= 2) cd *= 0.7;
      this.attackCd = cd;
      this.attackPoseT = 0.18;
      if (dir.x !== 0) this.flip = dir.x < 0; // 공격 방향을 바라본다

      if (this.classId === 'knight') {
        this._meleeAttack(dir, game, finisher);
      } else if (this.classId === 'archer') {
        AudioSys.bow();
        World.moveEntity(this, -dir.x * 5, -dir.y * 5); // 반동
        game.pbolts.push({
          kind: 'parrow', x: this.x + dir.x * 14, y: this.y + dir.y * 14,
          dir: { ...dir }, speed: finisher ? 560 : 480,
          finisher, pierce: finisher, life: 1.1, hit: new Set(),
        });
        Particles.burst(this.x + dir.x * 16, this.y + dir.y * 16, {
          count: 3, colors: ['#d9cbb8', '#38b764'], speed: 50, life: 0.2, size: 2,
        });
      } else {
        AudioSys.bolt();
        game.pbolts.push({
          kind: 'pbolt', x: this.x + dir.x * 14, y: this.y + dir.y * 14,
          dir: { ...dir }, speed: finisher ? 260 : 300,
          finisher, pierce: false, homing: 5.0,
          aoe: finisher ? 70 : 0,
          life: 2.0, hit: new Set(),
        });
        Particles.burst(this.x + dir.x * 16, this.y + dir.y * 16, {
          count: 4, colors: ['#c56cf0', '#8a5ac2'], speed: 60, life: 0.25, size: 3,
        });
      }
    },

    _meleeAttack(dir, game, finisher) {
      const range = (finisher ? 78 : 64) * this.rangeMul;
      const arc = finisher ? 2.4 : 1.9;
      const angle = Math.atan2(dir.y, dir.x);
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
        if (e.dead || e.phased) continue;
        const dx = e.x - this.x;
        const dy = e.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > range + e.r) continue;
        let diff = Math.atan2(dy, dx) - angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) > arc / 2 + 0.25) continue;

        const hitDir = { x: dx / (dist || 1), y: dy / (dist || 1) };
        this.strike(game, e, hitDir, { finisher, kb: finisher ? 320 : 190 });
        hitAny = true;
      }
      if (hitAny && finisher) Renderer.shake(3, 0.15);
    },

    draw(ctx) {
      for (const g of this.ghosts) {
        Renderer.drawSprite(this.sprImg(), g.x, g.y, {
          flip: g.flip, alpha: g.life * 1.6,
        });
      }

      // 애니메이션: 공격 자세 > 걷기 사이클(벌림-정지-모음-정지) > 정지
      const frames = Sprites.playerFrames[cls.sprite];
      const cycle = [1, 0, 2, 0];
      let img;
      if (this.attackPoseT > 0) img = frames[3];
      else if (this.moving) img = frames[cycle[Math.floor(this.animT * 9) % 4]];
      else img = frames[0];
      const bob = this.moving ? Math.abs(Math.sin(this.animT * 11)) * 1.5 : Math.sin(this.animT * 3) * 1;
      const rot = this.moving ? Math.sin(this.animT * 11) * 0.04 : 0;
      const flash = this.invuln > 0 && Math.floor(this.invuln * 18) % 2 === 0;

      Renderer.drawSprite(flash ? Sprites.white(img) : img,
        this.x, this.y - bob, {
          flip: this.flip, rot, shadow: true,
          alpha: this.invuln > 0 ? 0.8 : 1,
        });

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
