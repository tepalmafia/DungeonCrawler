// 적 3종 + 정예 변종 — 기획안 원칙: 모든 공격에는 예고 동작(텔레그래프)이 있어야 한다.
//  슬라임: 느린 추적 + 접촉 데미지 (기본기 연습용)
//  해골 궁수: 거리 유지, 조준선 표시 후 발사 (회피 유도)
//  멧돼지: 예고 후 직선 돌진, 벽에 박으면 그로기 (유인 플레이 유도)
// 상태이상: burn(지속 피해) / shock(감속) — 특성 시너지의 재료

function createEnemy(type, x, y, elite = false) {
  const base = {
    type, x, y, elite,
    dead: false,
    flash: 0,
    kbx: 0, kby: 0,
    animT: Math.random() * 10,
    flip: false,
    hitCd: 0,
    status: { burn: 0, burnTick: 0, shock: 0 },

    // 감전 시 감속된 실효 속도
    effSpeed() {
      return this.speed * (this.status.shock > 0 ? 0.55 : 1);
    },

    applyKnockback(dt) {
      if (Math.abs(this.kbx) > 1 || Math.abs(this.kby) > 1) {
        World.moveEntity(this, this.kbx * dt, this.kby * dt);
        this.kbx *= Math.pow(0.002, dt);
        this.kby *= Math.pow(0.002, dt);
      }
    },

    tickTimers(dt) {
      this.animT += dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.hitCd > 0) this.hitCd -= dt;
    },

    touchPlayer(game, dmg) {
      const p = game.player;
      if (this.hitCd > 0 || p.invuln > 0) return;
      if (Math.hypot(p.x - this.x, p.y - this.y) < p.r + this.r) {
        this.hitCd = 0.8;
        const d = Math.hypot(p.x - this.x, p.y - this.y) || 1;
        game.hurtPlayer(dmg, { x: (p.x - this.x) / d, y: (p.y - this.y) / d });
      }
    },

    // 스프라이트 선택: 피격 플래시 > 정예 색조 > 기본
    skin(baseImg) {
      if (this.flash > 0) return Sprites.white(baseImg);
      if (this.elite) return Sprites.tint(baseImg);
      return baseImg;
    },

    drawStatus(ctx) {
      if (this.status.burn > 0 && Math.random() < 0.25) {
        Particles.burst(this.x + (Math.random() - 0.5) * 14, this.y - 8, {
          count: 1, colors: ['#ff7043', '#ffd866'], speed: 30, life: 0.35, size: 3, gravity: -140,
        });
      }
      if (this.status.shock > 0 && Math.random() < 0.2) {
        ctx.fillStyle = '#ffd866';
        ctx.fillRect(this.x + (Math.random() - 0.5) * 22, this.y + (Math.random() - 0.5) * 18, 3, 3);
      }
    },
  };

  let e;

  if (type === 'slime') {
    e = Object.assign(base, {
      hp: 3, maxHp: 3, r: 14, speed: 62, xpVal: 5,

      update(dt, game) {
        this.tickTimers(dt);
        this.applyKnockback(dt);
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        const hop = Math.max(0, Math.sin(this.animT * 6));
        const spd = this.effSpeed() * hop;
        World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
        this.flip = dx < 0;
        this.touchPlayer(game, 1);
      },

      draw(ctx) {
        const squash = 1 + Math.sin(this.animT * 6) * 0.15;
        Renderer.drawSprite(this.skin(Sprites.slime), this.x, this.y, {
          flip: this.flip, squashX: 2 - squash, squashY: squash,
        });
        this.drawStatus(ctx);
      },
    });
  } else if (type === 'archer') {
    e = Object.assign(base, {
      hp: 2, maxHp: 2, r: 13, speed: 88, xpVal: 7,
      state: 'reposition',
      stateT: 0,
      aimDir: { x: 1, y: 0 },
      strafe: Math.random() < 0.5 ? 1 : -1,

      update(dt, game) {
        this.tickTimers(dt);
        this.applyKnockback(dt);
        this.stateT += dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        this.flip = dx < 0;

        if (this.state === 'reposition') {
          let vx = 0, vy = 0;
          if (d < 170) { vx = -dx / d; vy = -dy / d; }
          else if (d > 240) { vx = dx / d; vy = dy / d; }
          else { vx = -dy / d * this.strafe; vy = dx / d * this.strafe; }
          const spd = this.effSpeed();
          const hit = World.moveEntity(this, vx * spd * dt, vy * spd * dt);
          if (hit.x || hit.y) this.strafe *= -1;
          if (this.stateT > 1.1) { this.state = 'aim'; this.stateT = 0; }
        } else if (this.state === 'aim') {
          // 텔레그래프: 조준선. 마지막 0.25초에 방향 고정 → 대시로 회피 가능
          if (this.stateT < 0.45) this.aimDir = { x: dx / d, y: dy / d };
          if (this.stateT > 0.7) {
            game.spawnArrow(this.x, this.y, this.aimDir);
            AudioSys.shoot();
            this.state = 'reposition';
            this.stateT = 0;
          }
        }
        this.touchPlayer(game, 1);
      },

      draw(ctx) {
        if (this.state === 'aim') {
          const locked = this.stateT >= 0.45;
          ctx.save();
          ctx.globalAlpha = locked ? 0.75 : 0.3 + Math.sin(this.animT * 20) * 0.15;
          ctx.strokeStyle = locked ? '#ff4757' : '#a06060';
          ctx.lineWidth = locked ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(this.x, this.y);
          ctx.lineTo(this.x + this.aimDir.x * 300, this.y + this.aimDir.y * 300);
          ctx.stroke();
          ctx.restore();
        }
        const bob = Math.sin(this.animT * 7) * 2;
        Renderer.drawSprite(this.skin(Sprites.archer), this.x, this.y - bob, { flip: this.flip });
        this.drawStatus(ctx);
      },
    });
  } else if (type === 'boar') {
    e = Object.assign(base, {
      hp: 5, maxHp: 5, r: 17, speed: 55, xpVal: 12,
      state: 'wander',
      stateT: 0,
      chargeDir: { x: 1, y: 0 },
      wanderDir: { x: 1, y: 0 },
      chargeDist: 0,

      update(dt, game) {
        this.tickTimers(dt);
        this.applyKnockback(dt);
        this.stateT += dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;

        if (this.state === 'wander') {
          if (this.stateT > 1.2) {
            this.stateT = 0;
            const a = Math.random() * Math.PI * 2;
            this.wanderDir = { x: Math.cos(a), y: Math.sin(a) };
          }
          const spd = this.effSpeed();
          World.moveEntity(this, this.wanderDir.x * spd * dt, this.wanderDir.y * spd * dt);
          this.flip = this.wanderDir.x < 0;
          if (d < 300) { this.state = 'windup'; this.stateT = 0; }
        } else if (this.state === 'windup') {
          this.chargeDir = { x: dx / d, y: dy / d };
          this.flip = dx < 0;
          if (Math.random() < 0.35) {
            Particles.burst(this.x - this.chargeDir.x * 15, this.y + 12, {
              count: 2, colors: ['#5e3a26', '#8d5a3b'], speed: 45, life: 0.4, size: 3,
            });
          }
          if (this.stateT > 0.7) { this.state = 'charge'; this.stateT = 0; this.chargeDist = 0; }
        } else if (this.state === 'charge') {
          const step = 430 * (this.status.shock > 0 ? 0.7 : 1) * dt;
          const hit = World.moveEntity(this, this.chargeDir.x * step, this.chargeDir.y * step);
          this.chargeDist += step;
          if (p.invuln <= 0 && Math.hypot(p.x - this.x, p.y - this.y) < p.r + this.r + 2) {
            game.hurtPlayer(1, this.chargeDir, 420);
          }
          if (hit.x || hit.y) {
            this.state = 'stunned';
            this.stateT = 0;
            Renderer.shake(5, 0.25);
            AudioSys.thud();
            Particles.burst(this.x + this.chargeDir.x * 15, this.y, {
              count: 14, colors: ['#5e5e74', '#3d3d52', '#8d5a3b'], speed: 150, life: 0.5, size: 4,
            });
          } else if (this.chargeDist > 620) {
            this.state = 'wander';
            this.stateT = 0;
          }
        } else if (this.state === 'stunned') {
          if (this.stateT > 1.3) { this.state = 'wander'; this.stateT = 0; }
        }

        if (this.state !== 'charge') this.touchPlayer(game, 1);
      },

      draw(ctx) {
        let shakeX = 0;
        let rot = 0;
        if (this.state === 'windup') shakeX = (Math.random() - 0.5) * 4;
        if (this.state === 'charge') rot = this.flip ? -0.08 : 0.08;
        Renderer.drawSprite(this.skin(Sprites.boar), this.x + shakeX, this.y, { flip: this.flip, rot });

        if (this.state === 'stunned') {
          ctx.fillStyle = '#f7b32b';
          for (let i = 0; i < 3; i++) {
            const a = this.animT * 5 + (i * Math.PI * 2) / 3;
            ctx.fillRect(
              Math.round(this.x + Math.cos(a) * 16 - 2),
              Math.round(this.y - 28 + Math.sin(a) * 5 - 2), 4, 4);
          }
        }
        if (this.state === 'windup') {
          ctx.fillStyle = '#ff4757';
          ctx.font = 'bold 18px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('!', this.x, this.y - 30);
        }
        this.drawStatus(ctx);
      },
    });
  } else {
    throw new Error('알 수 없는 적 타입: ' + type);
  }

  // 정예 보정: HP·속도·크기·XP 강화
  if (elite) {
    e.hp = Math.ceil(e.hp * 2.5);
    e.maxHp = e.hp;
    e.speed *= 1.15;
    e.r *= 1.15;
    e.xpVal *= 3;
  }
  return e;
}
