// 적 12종 + 정예 변종 — 원칙: 모든 공격에는 예고 동작(텔레그래프)이 있다.
// 상태이상: burn(화상) / shock(감전·감속) / poison(중독) — 특성 시너지의 재료.
// 층이 깊어질수록 HP가 배율로 강화된다.

function createEnemy(type, x, y, elite = false, floorScale = 1) {
  const base = {
    type, x, y, elite,
    dead: false,
    flash: 0,
    kbx: 0, kby: 0,
    animT: Math.random() * 10,
    flip: false,
    hitCd: 0,
    status: { burn: 0, burnTick: 0, shock: 0, poison: 0, poisonTick: 0 },

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
      if (this.status.poison > 0 && Math.random() < 0.2) {
        Particles.burst(this.x + (Math.random() - 0.5) * 14, this.y - 10, {
          count: 1, colors: ['#6ab04c', '#8a3a8c'], speed: 20, life: 0.4, size: 3, gravity: -100,
        });
      }
      if (this.status.shock > 0 && Math.random() < 0.2) {
        ctx.fillStyle = '#ffd866';
        ctx.fillRect(this.x + (Math.random() - 0.5) * 22, this.y + (Math.random() - 0.5) * 18, 3, 3);
      }
    },
  };

  const defs = {
    // ── 슬라임: 통통 튀며 추적 ──
    slime: () => ({
      hp: 3, r: 14, speed: 62, xpVal: 5, sprite: 'slime',
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
        Renderer.drawSprite(this.skin(Sprites[this.sprite]), this.x, this.y, {
          flip: this.flip, squashX: 2 - squash, squashY: squash,
        });
        this.drawStatus(ctx);
      },
    }),

    // ── 독 슬라임: 죽으면 독구름 (플레이어 피해) ──
    toxicSlime: () => ({
      ...defs.slime(),
      hp: 3, xpVal: 7, sprite: 'toxicSlime',
      onDeath(game) {
        game.firePatches.push({ x: this.x, y: this.y, r: 52, life: 2.6, kind: 'poison' });
      },
    }),

    // ── 해골 궁수: 거리 유지 + 조준선 텔레그래프 ──
    archer: () => ({
      hp: 2, r: 13, speed: 88, xpVal: 7, sprite: 'archer',
      state: 'reposition', stateT: 0,
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
          if (this.stateT < 0.45) this.aimDir = { x: dx / d, y: dy / d };
          if (this.stateT > 0.7) {
            game.spawnProjectile('arrow', this.x, this.y, this.aimDir, { speed: 310, dmg: 1 });
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
        Renderer.drawSprite(this.skin(Sprites[this.sprite]), this.x, this.y - bob, { flip: this.flip });
        this.drawStatus(ctx);
      },
    }),

    // ── 멧돼지: 예고 후 돌진, 벽에 박으면 그로기 ──
    boar: () => ({
      hp: 5, r: 17, speed: 55, xpVal: 12, sprite: 'boar',
      chargeSpeed: 430, trail: false,
      state: 'wander', stateT: 0,
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
          const step = this.chargeSpeed * (this.status.shock > 0 ? 0.7 : 1) * dt;
          const hit = World.moveEntity(this, this.chargeDir.x * step, this.chargeDir.y * step);
          this.chargeDist += step;
          if (this.trail && Math.random() < 0.5) {
            game.firePatches.push({ x: this.x, y: this.y, r: 22, life: 1.4, kind: 'fire' });
          }
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
        Renderer.drawSprite(this.skin(Sprites[this.sprite]), this.x + shakeX, this.y, { flip: this.flip, rot });
        if (this.state === 'stunned') {
          ctx.fillStyle = '#f7b32b';
          for (let i = 0; i < 3; i++) {
            const a = this.animT * 5 + (i * Math.PI * 2) / 3;
            ctx.fillRect(Math.round(this.x + Math.cos(a) * 16 - 2), Math.round(this.y - 28 + Math.sin(a) * 5 - 2), 4, 4);
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
    }),

    // ── 용암 개: 더 빠른 돌진 + 불길 흔적 ──
    lavaHound: () => ({
      ...defs.boar(),
      hp: 6, xpVal: 15, sprite: 'lavaHound', chargeSpeed: 500, trail: true,
    }),

    // ── 버섯: 접근하면 부풀며 포자 파열 ──
    mushroom: () => ({
      hp: 4, r: 14, speed: 22, xpVal: 8, sprite: 'mushroom',
      state: 'idle', stateT: 0,
      update(dt, game) {
        this.tickTimers(dt);
        this.applyKnockback(dt);
        this.stateT += dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        this.flip = dx < 0;

        if (this.state === 'idle') {
          const spd = this.effSpeed();
          World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
          if (d < 130) { this.state = 'puff'; this.stateT = 0; }
        } else if (this.state === 'puff') {
          // 텔레그래프: 부풀어 오름 (0.6초)
          if (this.stateT > 0.6) {
            this.state = 'idle';
            this.stateT = 0;
            AudioSys.shoot();
            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * Math.PI * 2;
              game.spawnProjectile('spore', this.x, this.y, { x: Math.cos(a), y: Math.sin(a) }, { speed: 130, dmg: 1 });
            }
            Particles.burst(this.x, this.y - 8, { count: 10, colors: ['#8a5ac2', '#6ab04c'], speed: 80, life: 0.4, size: 3 });
          }
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        const inflate = this.state === 'puff' ? 1 + this.stateT * 0.5 : 1 + Math.sin(this.animT * 3) * 0.04;
        Renderer.drawSprite(this.skin(Sprites.mushroom), this.x, this.y, {
          flip: this.flip, squashX: inflate, squashY: inflate,
        });
        this.drawStatus(ctx);
      },
    }),

    // ── 박쥐: 빠르고 궤도가 어지러움 ──
    bat: () => ({
      hp: 2, r: 11, speed: 150, xpVal: 6, sprite: 'bat',
      update(dt, game) {
        this.tickTimers(dt);
        this.applyKnockback(dt);
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        // 좌우로 크게 흔들리며 접근
        const swerve = Math.sin(this.animT * 5) * 0.9;
        const vx = dx / d + (-dy / d) * swerve;
        const vy = dy / d + (dx / d) * swerve;
        const vlen = Math.hypot(vx, vy) || 1;
        const spd = this.effSpeed();
        World.moveEntity(this, (vx / vlen) * spd * dt, (vy / vlen) * spd * dt);
        this.flip = dx < 0;
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        const flap = 1 + Math.sin(this.animT * 18) * 0.25;
        Renderer.drawSprite(this.skin(Sprites.bat), this.x, this.y + Math.sin(this.animT * 9) * 3, {
          flip: this.flip, squashX: flap, squashY: 2 - flap,
        });
        this.drawStatus(ctx);
      },
    }),

    // ── 독거미: 거미줄 발사 (감속) ──
    spider: () => ({
      hp: 3, r: 13, speed: 120, xpVal: 9, sprite: 'spider',
      state: 'scuttle', stateT: 0,
      update(dt, game) {
        this.tickTimers(dt);
        this.applyKnockback(dt);
        this.stateT += dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        this.flip = dx < 0;

        if (this.state === 'scuttle') {
          // 다다닥 움직이고 멈추기를 반복
          if (Math.sin(this.stateT * 7) > -0.2) {
            const spd = this.effSpeed();
            World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
          }
          if (this.stateT > 1.4 && d < 260) { this.state = 'spin'; this.stateT = 0; }
        } else if (this.state === 'spin') {
          // 텔레그래프: 웅크림 (0.5초) 후 거미줄 발사
          if (this.stateT > 0.5) {
            game.spawnProjectile('web', this.x, this.y, { x: dx / d, y: dy / d }, { speed: 270, dmg: 0, slow: 1.6 });
            AudioSys.shoot();
            this.state = 'scuttle';
            this.stateT = 0;
          }
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        const crouch = this.state === 'spin' ? 0.75 : 1;
        Renderer.drawSprite(this.skin(Sprites.spider), this.x, this.y, {
          flip: this.flip, squashY: crouch, squashX: 2 - crouch,
        });
        if (this.state === 'spin') {
          ctx.fillStyle = '#ff4757';
          ctx.font = 'bold 16px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('!', this.x, this.y - 26);
        }
        this.drawStatus(ctx);
      },
    }),

    // ── 간수 골렘: 정면 방어 (등 뒤가 약점), 내려찍기 충격파 ──
    golem: () => ({
      hp: 10, r: 18, speed: 34, xpVal: 16, sprite: 'golem',
      state: 'walk', stateT: 0,
      faceDir: { x: 1, y: 0 }, // 방패 방향 (천천히 회전)
      update(dt, game) {
        this.tickTimers(dt);
        this.applyKnockback(dt);
        this.stateT += dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;

        // 방패 방향은 천천히 플레이어를 따라 회전 → 빙 돌면 등을 잡을 수 있다
        const target = Math.atan2(dy, dx);
        let cur = Math.atan2(this.faceDir.y, this.faceDir.x);
        let diff = target - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        cur += Math.sign(diff) * Math.min(Math.abs(diff), 1.1 * dt);
        this.faceDir = { x: Math.cos(cur), y: Math.sin(cur) };
        this.flip = this.faceDir.x < 0;

        if (this.state === 'walk') {
          const spd = this.effSpeed();
          World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
          if (d < 95) { this.state = 'slam'; this.stateT = 0; }
        } else if (this.state === 'slam') {
          // 텔레그래프: 들어올리기 (0.7초) → 충격파 링
          if (this.stateT > 0.7) {
            this.state = 'walk';
            this.stateT = 0;
            Renderer.shake(4, 0.2);
            AudioSys.thud();
            game.rings.push({ x: this.x, y: this.y, r: 20, maxR: 120, speed: 260, width: 14, dmg: 1 });
            Particles.burst(this.x, this.y + 14, { count: 10, colors: ['#5d6b84', '#3d4a5c'], speed: 120, life: 0.4, size: 4 });
          }
        }
        this.touchPlayer(game, 1);
      },
      // 정면 60도는 피해 무효 — main.hitEnemy에서 호출
      blocksFrom(dir) {
        const dot = -(dir.x * this.faceDir.x + dir.y * this.faceDir.y);
        return dot > 0.5; // 정면에서 온 공격
      },
      draw(ctx) {
        const lift = this.state === 'slam' ? -this.stateT * 8 : 0;
        Renderer.drawSprite(this.skin(Sprites[this.sprite]), this.x, this.y + lift, { flip: this.flip });
        // 방패 방향 표시 (전방 호)
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#5ce0e6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        const a = Math.atan2(this.faceDir.y, this.faceDir.x);
        ctx.arc(this.x, this.y, this.r + 7, a - 0.55, a + 0.55);
        ctx.stroke();
        ctx.restore();
        if (this.state === 'slam') {
          ctx.fillStyle = '#ff4757';
          ctx.font = 'bold 18px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('!', this.x, this.y - 34);
        }
        this.drawStatus(ctx);
      },
    }),

    // ── 망령: 비물질(무적) ↔ 실체화 반복, 벽 통과 ──
    wraith: () => ({
      hp: 3, r: 13, speed: 95, xpVal: 11, sprite: 'wraith',
      phased: true, // 비물질 상태로 시작
      stateT: 0,
      update(dt, game) {
        this.tickTimers(dt);
        this.stateT += dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        this.flip = dx < 0;

        if (this.phased) {
          // 벽 통과로 접근, 공격 불가·피격 무효
          World.moveGhost(this, (dx / d) * this.speed * 1.2 * dt, (dy / d) * this.speed * 1.2 * dt);
          if (this.stateT > 1.6) {
            this.phased = false;
            this.stateT = 0;
            Particles.burst(this.x, this.y, { count: 8, colors: ['#a9c1d8', '#5d6b84'], speed: 70, life: 0.35, size: 3 });
          }
        } else {
          this.applyKnockback(dt);
          const spd = this.effSpeed();
          World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
          this.touchPlayer(game, 1);
          if (this.stateT > 2.2) {
            this.phased = true;
            this.stateT = 0;
          }
        }
      },
      draw(ctx) {
        const bob = Math.sin(this.animT * 3) * 4;
        Renderer.drawSprite(this.skin(Sprites[this.sprite]), this.x, this.y - bob, {
          flip: this.flip, alpha: this.phased ? 0.35 : 0.95,
        });
        this.drawStatus(ctx);
      },
    }),

    // ── 화염 정령: 거리 유지 + 화염구 (착탄 지점에 불길) ──
    fireSpirit: () => ({
      hp: 3, r: 13, speed: 92, xpVal: 13, sprite: 'fireSpirit',
      state: 'drift', stateT: 0,
      strafe: Math.random() < 0.5 ? 1 : -1,
      update(dt, game) {
        this.tickTimers(dt);
        this.applyKnockback(dt);
        this.stateT += dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        this.flip = dx < 0;

        if (this.state === 'drift') {
          let vx = 0, vy = 0;
          if (d < 180) { vx = -dx / d; vy = -dy / d; }
          else if (d > 260) { vx = dx / d; vy = dy / d; }
          else { vx = -dy / d * this.strafe; vy = dx / d * this.strafe; }
          const spd = this.effSpeed();
          const hit = World.moveEntity(this, vx * spd * dt, vy * spd * dt);
          if (hit.x || hit.y) this.strafe *= -1;
          if (this.stateT > 1.6) { this.state = 'cast'; this.stateT = 0; }
        } else if (this.state === 'cast') {
          // 텔레그래프: 붉게 달아오름 (0.6초)
          if (this.stateT > 0.6) {
            game.spawnProjectile('fire', this.x, this.y, { x: dx / d, y: dy / d }, { speed: 220, dmg: 1 });
            AudioSys.shoot();
            this.state = 'drift';
            this.stateT = 0;
          }
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        const bob = Math.sin(this.animT * 4) * 4;
        const heat = this.state === 'cast' ? 1 + this.stateT * 0.3 : 1;
        Renderer.drawSprite(this.skin(Sprites[this.sprite]), this.x, this.y - bob, {
          flip: this.flip, squashX: heat, squashY: heat,
        });
        if (Math.random() < 0.3) {
          Particles.burst(this.x, this.y - bob + 10, { count: 1, colors: ['#ff9a3c', '#ffd866'], speed: 25, life: 0.4, size: 3, gravity: -120 });
        }
        this.drawStatus(ctx);
      },
    }),

    // ── 강령술사: 도망다니며 잡몹 소환 ──
    necro: () => ({
      hp: 4, r: 13, speed: 82, xpVal: 18, sprite: 'necro',
      state: 'flee', stateT: 0,
      update(dt, game) {
        this.tickTimers(dt);
        this.applyKnockback(dt);
        this.stateT += dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        this.flip = dx < 0;

        if (this.state === 'flee') {
          if (d < 280) {
            const spd = this.effSpeed();
            World.moveEntity(this, (-dx / d) * spd * dt, (-dy / d) * spd * dt);
          }
          if (this.stateT > 3.0 && game.enemies.length < 10) {
            this.state = 'summon';
            this.stateT = 0;
          }
        } else if (this.state === 'summon') {
          // 텔레그래프: 두 팔을 들어올림 (0.8초)
          if (this.stateT > 0.8) {
            this.state = 'flee';
            this.stateT = 0;
            AudioSys.roar();
            for (let i = 0; i < 2; i++) {
              const pos = World.randomSpawnPos(p, 120);
              game.markers.push({ x: pos.x, y: pos.y, type: 'slime', elite: false, t: 0.7 });
            }
          }
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        const bob = Math.sin(this.animT * 4) * 2;
        const raise = this.state === 'summon' ? -this.stateT * 6 : 0;
        Renderer.drawSprite(this.skin(Sprites.necro), this.x, this.y - bob + raise, { flip: this.flip });
        if (this.state === 'summon') {
          ctx.fillStyle = '#38b764';
          ctx.globalAlpha = 0.5 + Math.sin(this.animT * 15) * 0.3;
          ctx.beginPath();
          ctx.arc(this.x, this.y - 30, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        this.drawStatus(ctx);
      },
    }),
  };

  const def = defs[type];
  if (!def) throw new Error('알 수 없는 적 타입: ' + type);
  const e = Object.assign(base, def());
  e.hp = Math.ceil(e.hp * floorScale);

  if (elite) {
    e.hp = Math.ceil(e.hp * 2.5);
    e.speed *= 1.15;
    e.r *= 1.15;
    e.xpVal *= 3;
  }
  e.maxHp = e.hp;
  return e;
}
