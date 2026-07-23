// 플레이어 (검사): 이동 / 3연격 콤보 / 대시(무적) + 특성으로 성장하는 스탯
function createPlayer(x, y) {
  return {
    x, y,
    r: 13,
    maxHp: 5,
    hp: 5,
    speed: 195,
    facing: { x: 1, y: 0 },
    flip: false,

    // 특성으로 성장하는 전투 스탯
    bonusAtk: 0,
    atkCdMul: 1,
    critChance: 0.05,
    critMul: 2,
    flags: {},      // 고유 특성 (ignite, thorns 등)
    traits: [],     // 획득한 특성 id 목록 (HUD 표시용)
    lifestealCd: 0,

    // 공격
    combo: 0,
    comboTimer: 0,
    attackCd: 0,
    slashes: [],

    // 대시
    dashTimer: 0,
    dashCd: 0,
    dashDir: { x: 1, y: 0 },
    ghosts: [],
    _trailDist: 0,  // 잔전류 장판 간격 누적

    invuln: 0,
    kbx: 0, kby: 0,
    animT: 0,
    moving: false,

    update(dt, game) {
      this.animT += dt;
      if (this.attackCd > 0) this.attackCd -= dt;
      if (this.comboTimer > 0) this.comboTimer -= dt; else this.combo = 0;
      if (this.dashCd > 0) this.dashCd -= dt;
      if (this.invuln > 0) this.invuln -= dt;
      if (this.lifestealCd > 0) this.lifestealCd -= dt;

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
      if (Input.pressed('Space', 'ShiftLeft', 'ShiftRight') && this.dashCd <= 0) {
        this.dashTimer = 0.16;
        this.dashCd = 1.5;
        this.invuln = Math.max(this.invuln, 0.22);
        this.dashDir = len > 0 ? { x: mx, y: my } : { ...this.facing };
        this._trailDist = 0;
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

        // 특성: 잔전류 — 대시 경로에 감전 장판
        if (this.flags.shocktrail) {
          this._trailDist += step;
          if (this._trailDist >= 26) {
            this._trailDist = 0;
            game.zones.push({ x: this.x, y: this.y, r: 26, life: 1.2, hit: new Set() });
          }
        }
      } else if (len > 0) {
        World.moveEntity(this, mx * this.speed * dt, my * this.speed * dt);
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

    attack(dir, game) {
      const stage = this.combo;
      const finisher = stage === 2;
      const range = finisher ? 78 : 64;
      const arc = finisher ? 2.4 : 1.9;
      const baseDmg = 1 + this.bonusAtk;
      const dmg = finisher ? baseDmg * 2 : baseDmg;
      const angle = Math.atan2(dir.y, dir.x);

      this.attackCd = (finisher ? 0.45 : 0.22) * this.atkCdMul;
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
        if (e.dead) continue;
        const dx = e.x - this.x;
        const dy = e.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > range + e.r) continue;
        let diff = Math.atan2(dy, dx) - angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) > arc / 2 + 0.25) continue;

        const crit = Math.random() < this.critChance;
        const kb = finisher ? 320 : 190;
        const finalDmg = crit ? Math.round(dmg * this.critMul) : dmg;
        const hitDir = { x: dx / (dist || 1), y: dy / (dist || 1) };
        game.hitEnemy(e, finalDmg, hitDir, { crit, kb });

        // 특성: 점화
        if (this.flags.ignite && !e.dead && Math.random() < 0.25) {
          e.status.burn = 2;
          Particles.burst(e.x, e.y, { count: 4, colors: ['#ff7043', '#ffd866'], speed: 60, life: 0.3, size: 3 });
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
