// 적 3종 — 기획안 원칙: 모든 공격에는 예고 동작(텔레그래프)이 있어야 한다.
//  슬라임: 느린 추적 + 접촉 데미지 (기본기 연습용)
//  해골 궁수: 거리 유지, 조준선 표시 후 발사 (회피 유도)
//  멧돼지: 예고 후 직선 돌진, 벽에 박으면 그로기 (유인 플레이 유도)

function createEnemy(type, x, y) {
  const base = {
    type, x, y,
    dead: false,
    flash: 0,       // 피격 시 흰색 점멸
    kbx: 0, kby: 0, // 넉백
    animT: Math.random() * 10,
    flip: false,
    hitCd: 0,       // 접촉 데미지 쿨다운

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
  };

  if (type === 'slime') {
    return Object.assign(base, {
      hp: 3, maxHp: 3, r: 14, speed: 62,

      update(dt, game) {
        this.tickTimers(dt);
        this.applyKnockback(dt);
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        // 통통 튀며 접근 (사인파로 속도 변조)
        const hop = Math.max(0, Math.sin(this.animT * 6));
        World.moveEntity(this, (dx / d) * this.speed * hop * dt, (dy / d) * this.speed * hop * dt);
        this.flip = dx < 0;
        this.touchPlayer(game, 1);
      },

      draw() {
        const squash = 1 + Math.sin(this.animT * 6) * 0.15;
        const img = this.flash > 0 ? Sprites.white(Sprites.slime) : Sprites.slime;
        Renderer.drawSprite(img, this.x, this.y, {
          flip: this.flip, squashX: 2 - squash, squashY: squash,
        });
      },
    });
  }

  if (type === 'archer') {
    return Object.assign(base, {
      hp: 2, maxHp: 2, r: 13, speed: 88,
      state: 'reposition', // reposition → aim → shoot
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
          // 이상적 거리(170~240) 유지하며 옆걸음
          let vx = 0, vy = 0;
          if (d < 170) { vx = -dx / d; vy = -dy / d; }
          else if (d > 240) { vx = dx / d; vy = dy / d; }
          else { vx = -dy / d * this.strafe; vy = dx / d * this.strafe; }
          const hit = World.moveEntity(this, vx * this.speed * dt, vy * this.speed * dt);
          if (hit.x || hit.y) this.strafe *= -1;
          if (this.stateT > 1.1) { this.state = 'aim'; this.stateT = 0; }
        } else if (this.state === 'aim') {
          // 텔레그래프: 조준선 표시. 마지막 0.25초에 방향 고정 → 대시로 회피 가능
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
        // 조준선 텔레그래프
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
        const img = this.flash > 0 ? Sprites.white(Sprites.archer) : Sprites.archer;
        Renderer.drawSprite(img, this.x, this.y - bob, { flip: this.flip });
      },
    });
  }

  if (type === 'boar') {
    return Object.assign(base, {
      hp: 5, maxHp: 5, r: 17, speed: 55,
      state: 'wander', // wander → windup → charge → stunned
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
          World.moveEntity(this, this.wanderDir.x * this.speed * dt, this.wanderDir.y * this.speed * dt);
          this.flip = this.wanderDir.x < 0;
          // 플레이어 발견 → 돌진 준비
          if (d < 300) { this.state = 'windup'; this.stateT = 0; }
        } else if (this.state === 'windup') {
          // 텔레그래프: 제자리에서 부들부들 + 흙먼지 (0.7초)
          this.chargeDir = { x: dx / d, y: dy / d };
          this.flip = dx < 0;
          if (Math.random() < 0.35) {
            Particles.burst(this.x - this.chargeDir.x * 15, this.y + 12, {
              count: 2, colors: ['#5e3a26', '#8d5a3b'], speed: 45, life: 0.4, size: 3,
            });
          }
          if (this.stateT > 0.7) { this.state = 'charge'; this.stateT = 0; this.chargeDist = 0; }
        } else if (this.state === 'charge') {
          const step = 430 * dt;
          const hit = World.moveEntity(this, this.chargeDir.x * step, this.chargeDir.y * step);
          this.chargeDist += step;
          // 돌진 중 플레이어 타격: 큰 넉백
          if (p.invuln <= 0 && Math.hypot(p.x - this.x, p.y - this.y) < p.r + this.r + 2) {
            game.hurtPlayer(1, this.chargeDir, 420);
          }
          if (hit.x || hit.y) {
            // 벽에 박음 → 그로기 (반격 기회)
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
        if (this.state === 'windup') shakeX = (Math.random() - 0.5) * 4; // 부들부들
        if (this.state === 'charge') rot = this.flip ? -0.08 : 0.08;
        const img = this.flash > 0 ? Sprites.white(Sprites.boar) : Sprites.boar;
        Renderer.drawSprite(img, this.x + shakeX, this.y, { flip: this.flip, rot });

        // 그로기 별 표시
        if (this.state === 'stunned') {
          ctx.fillStyle = '#f7b32b';
          for (let i = 0; i < 3; i++) {
            const a = this.animT * 5 + (i * Math.PI * 2) / 3;
            ctx.fillRect(
              Math.round(this.x + Math.cos(a) * 16 - 2),
              Math.round(this.y - 28 + Math.sin(a) * 5 - 2), 4, 4);
          }
        }
        // 돌진 예고 느낌표
        if (this.state === 'windup') {
          ctx.fillStyle = '#ff4757';
          ctx.font = 'bold 18px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('!', this.x, this.y - 30);
        }
      },
    });
  }

  throw new Error('알 수 없는 적 타입: ' + type);
}

const ENEMY_STATS = {
  slime: { name: '슬라임' },
  archer: { name: '해골 궁수' },
  boar: { name: '돌진 멧돼지' },
};
