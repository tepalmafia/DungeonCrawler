// 적 12종 + 정예 변종 — 원칙: 모든 공격에는 예고 동작(텔레그래프)이 있다.
// 상태이상: burn(화상) / shock(감전·감속) / poison(중독) — 특성 시너지의 재료.
// 층이 깊어질수록 HP가 배율로 강화된다.

// ── 역할 태그 (AI 고도화) — 조향 오버레이(play._steer)와 예측 사격이 읽는다 ──
// 돌격(melee, 기본값): 협공 각도 / 사격(shoot): 예측 사격 + 측면 재배치 / 지원(support): 후방 유지
const ENEMY_ROLES = {
  archer: 'shoot', sniper: 'shoot', frostArcher: 'shoot', turret: 'shoot', thornPlant: 'shoot',
  wisp: 'shoot', crystal: 'shoot', imp: 'shoot', voidEye: 'shoot', mushroom: 'shoot', fireSpirit: 'shoot',
  necro: 'support', shaman: 'support',
};
function enemyRole(e) {
  return ENEMY_ROLES[e.type] || 'melee';
}

function createEnemy(type, x, y, elite = false, floorScale = 1) {
  const base = {
    type, x, y, elite,
    dead: false,
    flash: 0,
    kbx: 0, kby: 0,
    animT: Math.random() * 10,
    flip: false,
    hitCd: 0,
    spawnT: 0.35, // 등장 연출 (땅에서 솟아오름)
    status: { burn: 0, burnTick: 0, shock: 0, poison: 0, poisonTick: 0 },

    effSpeed() {
      return this.speed * (this.status.shock > 0 ? 0.55 : 1);
    },

    applyKnockback(dt) {
      if (Math.abs(this.kbx) > 1 || Math.abs(this.kby) > 1) {
        const mag = Math.hypot(this.kbx, this.kby);
        const px = this.x, py = this.y;
        World.moveEntity(this, this.kbx * dt, this.kby * dt);
        // 벽 충돌 (P2): 강한 넉백(마무리 일격·회전 베기)이 벽에 막히면 충격 피해 —
        // 지형이 무기가 된다. 적을 벽에 처박는 손맛
        if (mag > 260 && !(this._slamCd > 0) && !this.isBoss && !this.neutral && typeof Game !== 'undefined') {
          const moved = Math.hypot(this.x - px, this.y - py);
          const expected = mag * dt;
          if (expected > 2 && moved < expected * 0.25) {
            this._slamCd = 0.6;
            this.kbx = this.kby = 0;
            Game.damageEnemy(this, 2, { x: 0, y: 0 }, { feel: false, kb: 0, color: '#c8d4e4' });
            Particles.burst(this.x, this.y, { count: 8, colors: ['#c8d4e4', '#8a8074'], speed: 130, life: 0.3, size: 3 });
            Particles.text(this.x, this.y - 30, '쾅!', { color: '#c8d4e4', size: 13 });
            AudioSys.thud();
            Renderer.shake(2.5, 0.12);
            return;
          }
        }
        this.kbx *= Math.pow(0.002, dt);
        this.kby *= Math.pow(0.002, dt);
      }
    },

    tickTimers(dt) {
      this.animT += dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.hitCd > 0) this.hitCd -= dt;
      if (this._slamCd > 0) this._slamCd -= dt;
    },

    touchPlayer(game, dmg) {
      const p = game.player;
      if (this.hitCd > 0) return;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < p.r + this.r) {
        const dir = { x: (p.x - this.x) / (d || 1), y: (p.y - this.y) / (d || 1) };
        if (p.invuln > 0) {
          // 무적 중 접촉은 피해가 없지만 — 대시 무적이라면 '완벽 회피' 판정 기회다
          // (hurtPlayer의 무적 분기가 처리. 기존엔 여기서 끊겨 근접 몹 상대 완벽 회피가 불가능했다)
          if (p._dashWin > 0) game.hurtPlayer(dmg, dir);
          return;
        }
        this.hitCd = 0.8;
        // 심층 압박 (R1): 7층+ 정예·우두머리의 접촉은 2 — 후반에도 죽음이 가깝다
        if ((this.elite || this.isMini) && Dungeon.floor >= 7) dmg = Math.max(dmg, 2);
        game.hurtPlayer(dmg, dir);
      }
    },

    skin(baseImg) {
      if (this.flash > 0) return Sprites.white(baseImg);
      if (this.elite) return Sprites.tint(baseImg);
      return baseImg;
    },

    // 걷기 프레임 선택 (프레임이 정의된 적만; rate = 발걸음 속도)
    walkFrame(rate = 6) {
      const fr = Sprites.enemyFrames[this.sprite];
      if (!fr) return Sprites[this.sprite];
      return fr.walk[Math.floor(this.animT * rate) % 2];
    },

    attackFrame() {
      const fr = Sprites.enemyFrames[this.sprite];
      return (fr && fr.attack) || Sprites[this.sprite];
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
    // ── 슬라임: 통통 튀며 추적 + 가까우면 웅크렸다가 도약 공격 ──
    slime: () => ({
      hp: 3, r: 14, speed: 62, xpVal: 5, sprite: 'slime',
      state: 'chase', stateT: 0, leapCd: 1.2, leapDir: { x: 1, y: 0 },
      update(dt, game) {
        this.tickTimers(dt);
        this.applyKnockback(dt);
        this.stateT += dt;
        if (this.leapCd > 0) this.leapCd -= dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        this.flip = dx < 0;

        if (this.state === 'chase') {
          const hop = Math.max(0, Math.sin(this.animT * 6));
          const spd = this.effSpeed() * hop;
          World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
          if (d < 130 && this.leapCd <= 0) { this.state = 'crouch'; this.stateT = 0; }
        } else if (this.state === 'crouch') {
          // 텔레그래프: 납작하게 웅크림 (0.45초)
          if (this.stateT > 0.45) {
            this.state = 'leap';
            this.stateT = 0;
            this.leapDir = { x: dx / d, y: dy / d };
            AudioSys.shoot();
          }
        } else if (this.state === 'leap') {
          const spd = 390 * (this.status.shock > 0 ? 0.6 : 1);
          World.moveEntity(this, this.leapDir.x * spd * dt, this.leapDir.y * spd * dt);
          if (this.stateT > 0.32) {
            this.state = 'chase';
            this.leapCd = 2.4;
            Particles.burst(this.x, this.y + 8, { count: 6, colors: ['#a7f070', '#38b764'], speed: 70, life: 0.3, size: 2 });
          }
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        let squash = 1 + Math.sin(this.animT * 6) * 0.15;
        if (this.state === 'crouch') squash = 0.55 + this.stateT * 0.2;      // 납작
        if (this.state === 'leap') squash = 1.45;                            // 쭉 늘어남
        Renderer.drawSprite(this.skin(Sprites[this.sprite]), this.x, this.y, {
          flip: this.flip, squashX: 2 - squash, squashY: squash, shadow: true,
        });
        if (this.state === 'crouch') {
          ctx.fillStyle = '#ff4757';
          ctx.font = 'bold 14px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('!', this.x, this.y - 24);
        }
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
        const img = this.state === 'aim' ? this.attackFrame() : this.walkFrame(6);
        Renderer.drawSprite(this.skin(img), this.x, this.y - bob, { flip: this.flip, shadow: true });
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
          if (Math.hypot(p.x - this.x, p.y - this.y) < p.r + this.r + 2) { // 완벽 회피 판정 연결 (무적은 hurtPlayer가 처리)
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
        const img = this.state === 'charge' ? this.walkFrame(16)
          : this.state === 'wander' ? this.walkFrame(7) : Sprites[this.sprite];
        Renderer.drawSprite(this.skin(img), this.x + shakeX, this.y, { flip: this.flip, rot, shadow: true });
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
        const img = this.state === 'puff' ? Sprites.mushroom : this.walkFrame(4);
        Renderer.drawSprite(this.skin(img), this.x, this.y, {
          flip: this.flip, squashX: inflate, squashY: inflate, shadow: true,
        });
        this.drawStatus(ctx);
      },
    }),

    // ── 박쥐: 어지럽게 접근 + 정지 후 관통 급강하 ──
    bat: () => ({
      hp: 2, r: 11, speed: 150, xpVal: 6, sprite: 'bat',
      state: 'flit', stateT: 0, diveCd: 1.5, diveDir: { x: 1, y: 0 },
      update(dt, game) {
        this.tickTimers(dt);
        this.applyKnockback(dt);
        this.stateT += dt;
        if (this.diveCd > 0) this.diveCd -= dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        this.flip = dx < 0;

        if (this.state === 'flit') {
          // 좌우로 크게 흔들리며 접근
          const swerve = Math.sin(this.animT * 5) * 0.9;
          const vx = dx / d + (-dy / d) * swerve;
          const vy = dy / d + (dx / d) * swerve;
          const vlen = Math.hypot(vx, vy) || 1;
          const spd = this.effSpeed();
          World.moveEntity(this, (vx / vlen) * spd * dt, (vy / vlen) * spd * dt);
          if (d < 200 && d > 70 && this.diveCd <= 0) { this.state = 'aim'; this.stateT = 0; }
        } else if (this.state === 'aim') {
          // 텔레그래프: 공중 정지 + 파르르 (0.4초) 후 급강하
          if (this.stateT > 0.4) {
            this.state = 'dive';
            this.stateT = 0;
            this.diveDir = { x: dx / d, y: dy / d };
            AudioSys.shoot();
          }
        } else if (this.state === 'dive') {
          const spd = 430 * (this.status.shock > 0 ? 0.6 : 1);
          World.moveEntity(this, this.diveDir.x * spd * dt, this.diveDir.y * spd * dt);
          if (Math.random() < 0.4) {
            Particles.burst(this.x, this.y, { count: 1, colors: ['#5c5c74'], speed: 20, life: 0.2, size: 2 });
          }
          if (this.stateT > 0.42) { this.state = 'flit'; this.diveCd = 3.0; }
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        const flap = this.state === 'dive' ? 1.4 : 1 + Math.sin(this.animT * 18) * 0.25;
        const jitter = this.state === 'aim' ? (Math.random() - 0.5) * 3 : 0;
        Renderer.drawSprite(this.skin(Sprites.bat), this.x + jitter, this.y + Math.sin(this.animT * 9) * 3, {
          flip: this.flip, squashX: flap, squashY: 2 - flap, shadow: true,
        });
        if (this.state === 'aim') {
          ctx.fillStyle = '#ff4757';
          ctx.font = 'bold 14px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('!', this.x, this.y - 22);
        }
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
        const img = this.state === 'spin' ? Sprites.spider : this.walkFrame(10);
        Renderer.drawSprite(this.skin(img), this.x, this.y, {
          flip: this.flip, squashY: crouch, squashX: 2 - crouch, shadow: true,
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
        const img = this.state === 'slam' ? this.attackFrame() : this.walkFrame(3.5);
        Renderer.drawSprite(this.skin(img), this.x, this.y + lift, { flip: this.flip, shadow: true });
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
          flip: this.flip, alpha: this.phased ? 0.35 : 0.95, shadow: !this.phased,
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
          flip: this.flip, squashX: heat, squashY: heat, shadow: true,
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
        const img = this.state === 'summon' ? this.attackFrame() : this.walkFrame(5);
        Renderer.drawSprite(this.skin(img), this.x, this.y - bob + raise, { flip: this.flip, shadow: true });
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

    // ── 폭탄벌레 (6층): 빠르게 붙어서 자폭 — 자폭 시 보상 없음, 적도 휘말린다 ──
    bomber: () => ({
      hp: 3, r: 13, speed: 118, xpVal: 10, sprite: 'bomber',
      state: 'chase', fuseT: 0,
      update(dt, game) {
        this.tickTimers(dt);
        this.applyKnockback(dt);
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        this.flip = dx < 0;

        if (this.state === 'chase') {
          const spd = this.effSpeed();
          World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
          if (d < 58) { this.state = 'fuse'; this.fuseT = 0.8; AudioSys.shoot(); }
        } else {
          // 심지에 불이 붙었다 — 제자리에서 부풀며 0.8초 후 폭발
          this.fuseT -= dt;
          if (Math.random() < 0.5) {
            Particles.burst(this.x + 6, this.y - 16, { count: 1, colors: ['#ffd866', '#ff7043'], speed: 40, life: 0.25, size: 2, gravity: -160 });
          }
          if (this.fuseT <= 0) {
            this.noDrops = true; // 자폭은 처치 보상이 없다 (직접 잡으면 보상)
            game.killEnemy(this, { x: 0, y: -1 });
            game._explode(this.x, this.y, 70, 2, ['#ff7043', '#ffd866', '#e43b44'], '#ff7043');
            if (d < 70 + p.r) {
              game.hurtPlayer(2, { x: dx / d, y: dy / d }, 340);
            }
            return;
          }
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        const fusing = this.state === 'fuse';
        const puff = fusing ? 1 + (0.8 - this.fuseT) * 0.45 : 1 + Math.sin(this.animT * 8) * 0.06;
        const img = fusing && Math.floor(this.fuseT * 12) % 2 === 0
          ? Sprites.white(Sprites.bomber) : this.skin(Sprites.bomber);
        Renderer.drawSprite(img, this.x, this.y, { flip: this.flip, squashX: puff, squashY: puff, shadow: true });
        if (fusing) {
          ctx.save();
          ctx.globalAlpha = 0.22 + Math.sin(this.animT * 24) * 0.08;
          ctx.fillStyle = '#ff4757';
          ctx.beginPath();
          ctx.arc(this.x, this.y, 70, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        this.drawStatus(ctx);
      },
    }),

    // ── 가시덩굴 (7층): 움직이지 않는 포탑 — 가시 산탄 3연발 ──
    thornPlant: () => ({
      hp: 8, r: 15, speed: 0, xpVal: 12, sprite: 'thornPlant',
      state: 'idle', stateT: 0, volleys: 0,
      update(dt, game) {
        this.tickTimers(dt);
        this.applyKnockback(dt);
        this.stateT += dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        this.flip = dx < 0;

        if (this.state === 'idle') {
          if (this.stateT > 1.5 && d < 420) { this.state = 'windup'; this.stateT = 0; }
        } else if (this.state === 'windup') {
          // 텔레그래프: 웅크렸다가 (0.6초) 산탄 3연발
          if (this.stateT > 0.6) { this.state = 'burst'; this.stateT = 0; this.volleys = 0; }
        } else if (this.state === 'burst') {
          if (this.stateT > this.volleys * 0.28) {
            this.volleys++;
            AudioSys.shoot();
            const base = Math.atan2(dy, dx);
            for (let i = -2; i <= 2; i++) {
              const a = base + i * 0.22;
              game.spawnProjectile('thorn', this.x, this.y - 6, { x: Math.cos(a), y: Math.sin(a) }, { speed: 250, dmg: 1 });
            }
            if (this.volleys >= 3) { this.state = 'idle'; this.stateT = 0; }
          }
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        const crouch = this.state === 'windup' ? 1 - this.stateT * 0.3
          : this.state === 'burst' ? 1.15 : 1 + Math.sin(this.animT * 2.5) * 0.04;
        Renderer.drawSprite(this.skin(Sprites.thornPlant), this.x, this.y, {
          flip: this.flip, squashY: crouch, squashX: 2 - crouch, shadow: true,
        });
        if (this.state === 'windup') {
          ctx.fillStyle = '#ff4757';
          ctx.font = 'bold 16px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('!', this.x, this.y - 30);
        }
        this.drawStatus(ctx);
      },
    }),

    // ── 처형자 (8층): 느리게 접근, 직사각 텔레그래프 후 도끼 내려찍기 ──
    executioner: () => ({
      hp: 12, r: 18, speed: 42, xpVal: 20, sprite: 'executioner',
      state: 'walk', stateT: 0,
      slamDir: { x: 1, y: 0 },
      slamLen: 120, slamHalfW: 24,
      update(dt, game) {
        this.tickTimers(dt);
        this.applyKnockback(dt);
        this.stateT += dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;

        if (this.state === 'walk') {
          const spd = this.effSpeed();
          World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
          this.flip = dx < 0;
          if (d < 135) { this.state = 'raise'; this.stateT = 0; this.slamDir = { x: dx / d, y: dy / d }; }
        } else if (this.state === 'raise') {
          // 텔레그래프: 도끼를 들어올리고 바닥에 처형 구역 표시 (0.85초)
          this.flip = this.slamDir.x < 0;
          if (this.stateT > 0.85) {
            this.state = 'recover';
            this.stateT = 0;
            Renderer.shake(6, 0.25);
            AudioSys.thud();
            // 직사각 판정: 전방 slamLen × 폭 2×slamHalfW
            const rx = p.x - this.x, ry = p.y - this.y;
            const along = rx * this.slamDir.x + ry * this.slamDir.y;
            const perp = Math.abs(-rx * this.slamDir.y + ry * this.slamDir.x);
            if (along > -10 && along < this.slamLen && perp < this.slamHalfW + p.r) {
              game.hurtPlayer(2, this.slamDir, 380);
            }
            for (let i = 0; i < 8; i++) {
              const t = (i + 1) / 8;
              Particles.burst(this.x + this.slamDir.x * this.slamLen * t, this.y + this.slamDir.y * this.slamLen * t, {
                count: 3, colors: ['#5e5e74', '#c8d4e4', '#3d3d52'], speed: 110, life: 0.4, size: 3,
              });
            }
          }
        } else if (this.state === 'recover') {
          if (this.stateT > 1.1) { this.state = 'walk'; this.stateT = 0; }
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        if (this.state === 'raise') {
          // 바닥 처형 구역 (점점 진해짐)
          ctx.save();
          ctx.translate(this.x, this.y);
          ctx.rotate(Math.atan2(this.slamDir.y, this.slamDir.x));
          ctx.globalAlpha = 0.16 + (this.stateT / 0.85) * 0.22;
          ctx.fillStyle = '#e43b44';
          ctx.fillRect(0, -this.slamHalfW, this.slamLen, this.slamHalfW * 2);
          ctx.globalAlpha = 0.55;
          ctx.strokeStyle = '#ff4757';
          ctx.lineWidth = 2;
          ctx.strokeRect(0, -this.slamHalfW, this.slamLen, this.slamHalfW * 2);
          ctx.restore();
        }
        const lift = this.state === 'raise' ? -this.stateT * 10 : 0;
        const drop = this.state === 'recover' && this.stateT < 0.2 ? 6 : 0;
        Renderer.drawSprite(this.skin(Sprites.executioner), this.x, this.y + lift + drop, { flip: this.flip, shadow: true });
        this.drawStatus(ctx);
      },
    }),

    // ── 마그마 슬라임 (9층): 죽으면 작은 마그마 둘로 갈라진다 ──
    magmaSlime: () => ({
      ...defs.slime(),
      hp: 7, r: 16, speed: 52, xpVal: 14, sprite: 'magmaSlime',
      onDeath(game) {
        game.firePatches.push({ x: this.x, y: this.y, r: 30, life: 1.2, kind: 'fire' });
        for (let i = 0; i < 2; i++) {
          const e = createEnemy('magmaSmall', this.x + (i === 0 ? -16 : 16), this.y, false, game.enemyHpMul());
          e.spawnT = 0.2;
          game.enemies.push(e);
        }
      },
    }),

    // ── 작은 마그마 (분열체): 빠르고 약하다, 보상은 도감상 마그마 슬라임으로 집계 ──
    magmaSmall: () => ({
      ...defs.slime(),
      hp: 2, r: 10, speed: 95, xpVal: 4, sprite: 'magmaSlime', codexType: 'magmaSlime',
      draw(ctx) {
        let squash = 1 + Math.sin(this.animT * 8) * 0.18;
        if (this.state === 'crouch') squash = 0.55;
        if (this.state === 'leap') squash = 1.45;
        Renderer.drawSprite(this.skin(Sprites.magmaSlime), this.x, this.y, {
          flip: this.flip, squashX: (2 - squash) * 0.62, squashY: squash * 0.62, shadow: true,
        });
        this.drawStatus(ctx);
      },
    }),

    // ── 공허의 눈 (10층): 접근하면 순간이동으로 회피 + 추적탄 발사 ──
    voidEye: () => ({
      hp: 5, r: 13, speed: 60, xpVal: 22, sprite: 'voidEye',
      blinkCd: 0, castT: 1.4,
      update(dt, game) {
        this.tickTimers(dt);
        this.applyKnockback(dt);
        if (this.blinkCd > 0) this.blinkCd -= dt;
        this.castT -= dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        this.flip = dx < 0;

        // 플레이어가 다가오면 도약 (쿨다운 2초)
        // 단, 도망자들만 남으면 도약 2회 후 탈진 — "마지막 도망자 추격전"은 지루함만 남긴다
        // (계측: 10층에서 voidEye 1~2마리만 남은 방이 60~90초 추격전이 됐다. 1마리 조건으론 2마리 방이 그대로라 확장)
        const isLast = !game.enemies.some((e) => e !== this && !e.dead && !e.neutral && e.type !== 'voidEye');
        if (isLast) this._soloBlinks = this._soloBlinks || 0;
        const canBlink = !isLast || this._soloBlinks < 2;
        if (d < 140 && this.blinkCd <= 0 && canBlink) {
          this.blinkCd = 2.0;
          if (isLast) this._soloBlinks++;
          Particles.burst(this.x, this.y, { count: 12, colors: ['#b13ae0', '#241832'], speed: 100, life: 0.35, size: 3 });
          const pos = World.randomSpawnPos(p, 200);
          this.x = pos.x;
          this.y = pos.y;
          Particles.burst(this.x, this.y, { count: 12, colors: ['#b13ae0', '#c9b8e8'], speed: 100, life: 0.35, size: 3 });
          AudioSys.dash();
        } else if (d < 220 && canBlink) {
          // 거리 유지
          const spd = this.effSpeed();
          World.moveEntity(this, (-dx / d) * spd * dt, (-dy / d) * spd * dt);
        }

        if (this.castT <= 0) {
          this.castT = 2.4;
          AudioSys.shoot();
          game.spawnProjectile('voidorb', this.x, this.y, { x: dx / d, y: dy / d }, { speed: 150, dmg: 1, homing: true, life: 3.2 });
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        const bob = Math.sin(this.animT * 3.2) * 5;
        const charge = this.castT < 0.4 ? 1 + (0.4 - this.castT) * 0.5 : 1;
        Renderer.drawSprite(this.skin(Sprites.voidEye), this.x, this.y - bob, {
          flip: this.flip, squashX: charge, squashY: charge, shadow: true,
        });
        this.drawStatus(ctx);
      },
    }),

    // ══════════════ 확장 몬스터 20종 ══════════════

    // ── 해골 병사: 예고 후 검 찌르기 돌진 ──
    skeleton: () => ({
      hp: 4, r: 13, speed: 74, xpVal: 7, sprite: 'skeleton',
      state: 'walk', stateT: 0, stabDir: { x: 1, y: 0 },
      update(dt, game) {
        this.tickTimers(dt); this.applyKnockback(dt); this.stateT += dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
        this.flip = dx < 0;
        if (this.state === 'walk') {
          const spd = this.effSpeed();
          World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
          if (d < 110) { this.state = 'ready'; this.stateT = 0; this.stabDir = { x: dx / d, y: dy / d }; }
        } else if (this.state === 'ready') {
          if (this.stateT > 0.5) { this.state = 'stab'; this.stateT = 0; }
        } else if (this.state === 'stab') {
          World.moveEntity(this, this.stabDir.x * 340 * dt, this.stabDir.y * 340 * dt);
          if (this.stateT > 0.28) { this.state = 'walk'; this.stateT = 0; }
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        const lean = this.state === 'ready' ? -3 : this.state === 'stab' ? 4 : 0;
        Renderer.drawSprite(this.skin(this.walkFrame(6)), this.x + (this.flip ? -lean : lean), this.y, { flip: this.flip, shadow: true });
        if (this.state === 'ready') { ctx.fillStyle = '#ff4757'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.fillText('!', this.x, this.y - 26); }
        this.drawStatus(ctx);
      },
    }),

    // ── 방패 해골: 정면 방어 + 방패 밀치기 ──
    shieldSkeleton: () => ({
      hp: 7, r: 14, speed: 52, xpVal: 11, sprite: 'shieldSkeleton',
      state: 'walk', stateT: 0, faceDir: { x: 1, y: 0 },
      update(dt, game) {
        this.tickTimers(dt); this.applyKnockback(dt); this.stateT += dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
        // 방패 방향은 천천히 회전 (골렘보다 빠름) — 옆을 잡으면 뚫린다
        const target = Math.atan2(dy, dx);
        let cur = Math.atan2(this.faceDir.y, this.faceDir.x);
        let diff = target - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        cur += Math.sign(diff) * Math.min(Math.abs(diff), 1.8 * dt);
        this.faceDir = { x: Math.cos(cur), y: Math.sin(cur) };
        this.flip = this.faceDir.x < 0;
        if (this.state === 'walk') {
          const spd = this.effSpeed();
          World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
          if (d < 70) { this.state = 'bash'; this.stateT = 0; }
        } else if (this.state === 'bash') {
          if (this.stateT > 0.45) {
            this.state = 'walk'; this.stateT = 0;
            if (Math.hypot(p.x - this.x, p.y - this.y) < 60) {
              game.hurtPlayer(1, this.faceDir, 430); // 강넉백 밀치기
            }
          }
        }
        this.touchPlayer(game, 1);
      },
      blocksFrom(dir) {
        const dot = -(dir.x * this.faceDir.x + dir.y * this.faceDir.y);
        return dot > 0.6;
      },
      draw(ctx) {
        Renderer.drawSprite(this.skin(this.walkFrame(5)), this.x, this.y, { flip: this.flip, shadow: true });
        ctx.save(); ctx.globalAlpha = 0.3; ctx.strokeStyle = '#3a7ca5'; ctx.lineWidth = 3;
        const a = Math.atan2(this.faceDir.y, this.faceDir.x);
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 6, a - 0.5, a + 0.5); ctx.stroke(); ctx.restore();
        this.drawStatus(ctx);
      },
    }),

    // ── 저격 해골: 먼 거리 긴 조준 + 강한 한 발 ──
    sniper: () => ({
      hp: 3, r: 13, speed: 60, xpVal: 12, sprite: 'sniper',
      state: 'drift', stateT: 0, aimDir: { x: 1, y: 0 },
      update(dt, game) {
        this.tickTimers(dt); this.applyKnockback(dt); this.stateT += dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
        this.flip = dx < 0;
        if (this.state === 'drift') {
          const spd = this.effSpeed();
          if (d < 300) World.moveEntity(this, (-dx / d) * spd * dt, (-dy / d) * spd * dt);
          if (this.stateT > 1.4) { this.state = 'aim'; this.stateT = 0; }
        } else if (this.state === 'aim') {
          if (this.stateT < 1.1) this.aimDir = { x: dx / d, y: dy / d };
          if (this.stateT > 1.5) {
            game.spawnProjectile('arrow', this.x, this.y, this.aimDir, { speed: 560, dmg: 2 });
            AudioSys.shoot();
            this.state = 'drift'; this.stateT = 0;
          }
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        if (this.state === 'aim') {
          const locked = this.stateT >= 1.1;
          ctx.save();
          ctx.globalAlpha = locked ? 0.85 : 0.25;
          ctx.strokeStyle = locked ? '#ff4757' : '#8a6060';
          ctx.lineWidth = locked ? 2 : 1;
          ctx.setLineDash([6, 4]);
          ctx.beginPath(); ctx.moveTo(this.x, this.y);
          ctx.lineTo(this.x + this.aimDir.x * 700, this.y + this.aimDir.y * 700); ctx.stroke();
          ctx.restore();
        }
        Renderer.drawSprite(this.skin(Sprites.sniper), this.x, this.y, { flip: this.flip, shadow: true });
        this.drawStatus(ctx);
      },
    }),

    // ── 벌레 떼: 약하지만 4마리씩 몰려온다 ──
    swarm: () => ({
      hp: 1, r: 8, speed: 165, xpVal: 2, sprite: 'swarm',
      update(dt, game) {
        this.tickTimers(dt); this.applyKnockback(dt);
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
        const wob = Math.sin(this.animT * 9 + this.x * 0.05) * 0.5;
        const vx = dx / d + (-dy / d) * wob, vy = dy / d + (dx / d) * wob;
        const vl = Math.hypot(vx, vy) || 1;
        const spd = this.effSpeed();
        World.moveEntity(this, (vx / vl) * spd * dt, (vy / vl) * spd * dt);
        this.flip = dx < 0;
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        Renderer.drawSprite(this.skin(Sprites.swarm), this.x, this.y + Math.sin(this.animT * 12) * 2, { flip: this.flip, shadow: true });
        this.drawStatus(ctx);
      },
    }),

    // ── 독두꺼비: 포물선 도약 + 착지 독 장판 ──
    frog: () => ({
      hp: 5, r: 15, speed: 0, xpVal: 9, sprite: 'frog',
      state: 'sit', stateT: 0, hopDir: { x: 1, y: 0 },
      update(dt, game) {
        this.tickTimers(dt); this.applyKnockback(dt); this.stateT += dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
        this.flip = dx < 0;
        if (this.state === 'sit') {
          if (this.stateT > 1.0) { this.state = 'crouch'; this.stateT = 0; }
        } else if (this.state === 'crouch') {
          if (this.stateT > 0.35) { this.state = 'hop'; this.stateT = 0; this.hopDir = { x: dx / d, y: dy / d }; }
        } else if (this.state === 'hop') {
          World.moveEntity(this, this.hopDir.x * 300 * dt, this.hopDir.y * 300 * dt);
          if (this.stateT > 0.4) {
            this.state = 'sit'; this.stateT = 0;
            game.firePatches.push({ x: this.x, y: this.y, r: 26, life: 1.4, kind: 'poison' });
            Particles.burst(this.x, this.y + 6, { count: 5, colors: ['#6ab04c', '#4a7a3f'], speed: 60, life: 0.3, size: 2 });
          }
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        const sq = this.state === 'crouch' ? 0.7 : this.state === 'hop' ? 1.3 : 1 + Math.sin(this.animT * 3) * 0.05;
        const air = this.state === 'hop' ? -Math.sin(this.stateT / 0.4 * Math.PI) * 22 : 0;
        Renderer.drawSprite(this.skin(Sprites.frog), this.x, this.y + air, { flip: this.flip, squashY: sq, squashX: 2 - sq, shadow: true });
        this.drawStatus(ctx);
      },
    }),

    // ── 흡혈 거머리: 끈질기게 붙는다 (짧은 접촉 쿨) ──
    leech: () => ({
      hp: 3, r: 11, speed: 132, xpVal: 7, sprite: 'leech',
      update(dt, game) {
        this.tickTimers(dt); this.applyKnockback(dt);
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
        const spd = this.effSpeed() * (0.7 + Math.abs(Math.sin(this.animT * 7)) * 0.6); // 꿈틀꿈틀
        World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
        this.flip = dx < 0;
        // 접촉 쿨이 짧다 — 붙어있으면 계속 아프다
        if (this.hitCd <= 0 && d < p.r + this.r) {
          this.hitCd = 0.7; // 2층 절벽 완화
          game.hurtPlayer(1, { x: dx / d, y: dy / d }, 120);
        }
      },
      draw(ctx) {
        const wig = 1 + Math.sin(this.animT * 10) * 0.25;
        Renderer.drawSprite(this.skin(Sprites.leech), this.x, this.y, { flip: this.flip, squashX: wig, squashY: 2 - wig, shadow: true });
        this.drawStatus(ctx);
      },
    }),

    // ── 서리 슬라임: 도약 슬라임 + 죽으면 빙판 (감속) ──
    iceSlime: () => ({
      ...defs.slime(),
      hp: 4, xpVal: 8, sprite: 'iceSlime',
      onDeath(game) {
        game.firePatches.push({ x: this.x, y: this.y, r: 55, life: 3.0, kind: 'ice' });
      },
    }),

    // ── 서리 궁수: 감속 얼음 화살 2연발 ──
    frostArcher: () => ({
      ...defs.archer(),
      hp: 3, xpVal: 10, sprite: 'frostArcher',
      update(dt, game) {
        this.tickTimers(dt); this.applyKnockback(dt); this.stateT += dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
        this.flip = dx < 0;
        if (this.state === 'reposition') {
          let vx = 0, vy = 0;
          if (d < 170) { vx = -dx / d; vy = -dy / d; }
          else if (d > 250) { vx = dx / d; vy = dy / d; }
          else { vx = -dy / d * this.strafe; vy = dx / d * this.strafe; }
          const spd = this.effSpeed();
          const hit = World.moveEntity(this, vx * spd * dt, vy * spd * dt);
          if (hit.x || hit.y) this.strafe *= -1;
          if (this.stateT > 1.3) { this.state = 'aim'; this.stateT = 0; }
        } else if (this.state === 'aim') {
          if (this.stateT < 0.5) this.aimDir = { x: dx / d, y: dy / d };
          if (this.stateT > 0.75) {
            for (const off of [-0.09, 0.09]) {
              const a = Math.atan2(this.aimDir.y, this.aimDir.x) + off;
              game.spawnProjectile('ice', this.x, this.y, { x: Math.cos(a), y: Math.sin(a) }, { speed: 280, dmg: 1, slow: 1.3 });
            }
            AudioSys.shoot();
            this.state = 'reposition'; this.stateT = 0;
          }
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        if (this.state === 'aim') {
          ctx.save(); ctx.globalAlpha = this.stateT >= 0.5 ? 0.7 : 0.25;
          ctx.strokeStyle = '#5ce0e6'; ctx.lineWidth = this.stateT >= 0.5 ? 2 : 1;
          ctx.beginPath(); ctx.moveTo(this.x, this.y);
          ctx.lineTo(this.x + this.aimDir.x * 280, this.y + this.aimDir.y * 280); ctx.stroke(); ctx.restore();
        }
        Renderer.drawSprite(this.skin(Sprites.frostArcher), this.x, this.y - Math.sin(this.animT * 7) * 2, { flip: this.flip, shadow: true });
        this.drawStatus(ctx);
      },
    }),

    // ── 광전사: HP 절반 이하에서 격노 (속도·공세 급증) ──
    berserker: () => ({
      hp: 8, r: 15, speed: 66, xpVal: 13, sprite: 'berserker',
      update(dt, game) {
        this.tickTimers(dt); this.applyKnockback(dt);
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
        const enraged = this.hp <= this.maxHp * 0.5;
        const spd = this.effSpeed() * (enraged ? 1.9 : 1);
        World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
        this.flip = dx < 0;
        if (enraged && Math.random() < 0.15) {
          Particles.burst(this.x, this.y - 14, { count: 1, colors: ['#e43b44'], speed: 30, life: 0.3, size: 2, gravity: -100 });
        }
        this.touchPlayer(game, enraged ? 2 : 1);
      },
      draw(ctx) {
        const enraged = this.hp <= this.maxHp * 0.5;
        const shakeX = enraged ? (Math.random() - 0.5) * 2.5 : 0;
        Renderer.drawSprite(this.skin(Sprites.berserker), this.x + shakeX, this.y, { flip: this.flip, shadow: true });
        if (enraged) {
          ctx.fillStyle = '#e43b44'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
          ctx.fillText('격노!', this.x, this.y - 28);
        }
        this.drawStatus(ctx);
      },
    }),

    // ── 도깨비불: 나선을 그리며 접근, 스치면 아프다 ──
    wisp: () => ({
      hp: 2, r: 10, speed: 110, xpVal: 8, sprite: 'wisp',
      orbitA: Math.random() * Math.PI * 2, orbitDir: Math.random() < 0.5 ? 1 : -1,
      update(dt, game) {
        this.tickTimers(dt); this.applyKnockback(dt);
        const p = game.player;
        this.orbitA += this.orbitDir * 2.2 * dt;
        const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
        // 나선: 접근 성분 + 회전 성분
        const vx = (dx / d) * 0.6 + Math.cos(this.orbitA) * 0.8;
        const vy = (dy / d) * 0.6 + Math.sin(this.orbitA) * 0.8;
        const vl = Math.hypot(vx, vy) || 1;
        const spd = this.effSpeed();
        World.moveGhost(this, (vx / vl) * spd * dt, (vy / vl) * spd * dt);
        this.flip = dx < 0;
        if (Math.random() < 0.3) {
          Particles.burst(this.x, this.y, { count: 1, colors: ['#7ac0e8', '#3a8ac0'], speed: 15, life: 0.3, size: 2 });
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        const pulse = 1 + Math.sin(this.animT * 8) * 0.15;
        Renderer.drawSprite(this.skin(Sprites.wisp), this.x, this.y + Math.sin(this.animT * 5) * 3, { flip: this.flip, squashX: pulse, squashY: pulse, shadow: false });
        this.drawStatus(ctx);
      },
    }),

    // ── 주술사: 도망다니며 다친 아군을 치유 (최우선 처치 대상) ──
    shaman: () => ({
      hp: 4, r: 13, speed: 78, xpVal: 15, sprite: 'shaman',
      healT: 0, healTarget: null,
      update(dt, game) {
        this.tickTimers(dt); this.applyKnockback(dt);
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
        this.flip = dx < 0;
        if (d < 240) {
          const spd = this.effSpeed();
          World.moveEntity(this, (-dx / d) * spd * dt, (-dy / d) * spd * dt);
        }
        // 가장 다친 아군을 초당 2 치유
        this.healTarget = null;
        let worst = 1;
        for (const e of game.enemies) {
          if (e === this || e.dead || e.isBoss) continue;
          const ratio = e.hp / e.maxHp;
          if (ratio < worst && Math.hypot(e.x - this.x, e.y - this.y) < 260) { worst = ratio; this.healTarget = e; }
        }
        if (this.healTarget) {
          this.healT += dt;
          if (this.healT >= 0.5) {
            this.healT = 0;
            this.healTarget.hp = Math.min(this.healTarget.maxHp, this.healTarget.hp + 1);
            Particles.text(this.healTarget.x, this.healTarget.y - 24, '+1', { color: '#38b764', size: 11 });
          }
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        if (this.healTarget && !this.healTarget.dead) {
          ctx.save(); ctx.globalAlpha = 0.4 + Math.sin(this.animT * 10) * 0.2;
          ctx.strokeStyle = '#38b764'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(this.x, this.y - 8);
          ctx.lineTo(this.healTarget.x, this.healTarget.y); ctx.stroke(); ctx.restore();
        }
        Renderer.drawSprite(this.skin(Sprites.shaman), this.x, this.y - Math.sin(this.animT * 4) * 2, { flip: this.flip, shadow: true });
        this.drawStatus(ctx);
      },
    }),

    // ── 수정 정령: 죽으면 파편 4발 사방 발사 ──
    crystal: () => ({
      hp: 4, r: 12, speed: 55, xpVal: 9, sprite: 'crystal',
      update(dt, game) {
        this.tickTimers(dt); this.applyKnockback(dt);
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
        const spd = this.effSpeed();
        World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
        this.flip = dx < 0;
        this.touchPlayer(game, 1);
      },
      onDeath(game) {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          game.spawnProjectile('shard', this.x, this.y, { x: Math.cos(a), y: Math.sin(a) }, { speed: 240, dmg: 1 });
        }
      },
      draw(ctx) {
        Renderer.drawSprite(this.skin(Sprites.crystal), this.x, this.y - Math.sin(this.animT * 3.5) * 4, { flip: this.flip, shadow: true });
        this.drawStatus(ctx);
      },
    }),

    // ── 구울: 시체를 먹으면 강해진다 (최대 2회) ──
    ghoul: () => ({
      hp: 5, r: 14, speed: 70, xpVal: 10, sprite: 'ghoul',
      eaten: 0, eatT: 0,
      update(dt, game) {
        this.tickTimers(dt); this.applyKnockback(dt);
        const p = game.player;
        // 근처 시체 잔상을 향해 이동 → 먹으면 영구 강화
        let corpse = null, cd = 220;
        if (this.eaten < 2) {
          for (const c of game.corpses) {
            const dd = Math.hypot(c.x - this.x, c.y - this.y);
            if (dd < cd) { cd = dd; corpse = c; }
          }
        }
        const tx = corpse ? corpse.x : p.x, ty = corpse ? corpse.y : p.y;
        const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1;
        const spd = this.effSpeed();
        World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
        this.flip = dx < 0;
        if (corpse && d < 20) {
          corpse.t = corpse.dur; // 시체 소멸
          this.eaten++;
          this.speed *= 1.35;
          this.hp = Math.min(this.maxHp + 2, this.hp + 2);
          this.maxHp += 2;
          Particles.text(this.x, this.y - 26, '포식!', { color: '#e43b44', size: 12 });
          Particles.burst(this.x, this.y, { count: 8, colors: ['#6a7a5a', '#e43b44'], speed: 80, life: 0.35, size: 3 });
        }
        this.touchPlayer(game, this.eaten > 0 ? 2 : 1);
      },
      draw(ctx) {
        const hunch = 1 + Math.sin(this.animT * 8) * 0.06;
        Renderer.drawSprite(this.skin(Sprites.ghoul), this.x, this.y, { flip: this.flip, squashY: hunch, shadow: true });
        if (this.eaten > 0) {
          ctx.fillStyle = '#e43b44'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
          ctx.fillText('▲'.repeat(this.eaten), this.x, this.y - 26);
        }
        this.drawStatus(ctx);
      },
    }),

    // ── 뿔벌레: 3연속 짧은 재조준 돌진 ──
    charger: () => ({
      hp: 5, r: 13, speed: 60, xpVal: 10, sprite: 'charger',
      state: 'walk', stateT: 0, dashes: 0, dashDir: { x: 1, y: 0 },
      update(dt, game) {
        this.tickTimers(dt); this.applyKnockback(dt); this.stateT += dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
        if (this.state === 'walk') {
          const spd = this.effSpeed();
          World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
          this.flip = dx < 0;
          if (d < 260) { this.state = 'windup'; this.stateT = 0; this.dashes = 0; }
        } else if (this.state === 'windup') {
          this.dashDir = { x: dx / d, y: dy / d };
          this.flip = dx < 0;
          if (this.stateT > 0.35) { this.state = 'dash'; this.stateT = 0; }
        } else if (this.state === 'dash') {
          World.moveEntity(this, this.dashDir.x * 380 * dt, this.dashDir.y * 380 * dt);
          if (this.stateT > 0.3) {
            this.dashes++;
            if (this.dashes >= 3) { this.state = 'rest'; this.stateT = 0; }
            else { this.state = 'windup'; this.stateT = 0; }
          }
        } else if (this.state === 'rest') {
          if (this.stateT > 1.1) { this.state = 'walk'; this.stateT = 0; }
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        const shakeX = this.state === 'windup' ? (Math.random() - 0.5) * 3 : 0;
        Renderer.drawSprite(this.skin(Sprites.charger), this.x + shakeX, this.y, { flip: this.flip, shadow: true });
        if (this.state === 'windup') { ctx.fillStyle = '#ff4757'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.fillText('!', this.x, this.y - 22); }
        this.drawStatus(ctx);
      },
    }),

    // ── 마력 포탑: 고정, 회전 8방향 탄막 ──
    turret: () => ({
      hp: 9, r: 15, speed: 0, xpVal: 13, sprite: 'turret',
      fireT: 0, spiralA: 0,
      update(dt, game) {
        this.tickTimers(dt); this.applyKnockback(dt);
        this.fireT += dt;
        if (this.fireT >= 1.7) {
          this.fireT = 0;
          this.spiralA += 0.45; // 매번 각도가 돌아간다 — 같은 자리로는 못 피한다
          AudioSys.shoot();
          for (let i = 0; i < 8; i++) {
            const a = this.spiralA + (i / 8) * Math.PI * 2;
            game.spawnProjectile('mana', this.x, this.y - 8, { x: Math.cos(a), y: Math.sin(a) }, { speed: 165, dmg: 1 });
          }
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        const chg = this.fireT > 1.3 ? 1 + (this.fireT - 1.3) * 0.5 : 1;
        Renderer.drawSprite(this.skin(Sprites.turret), this.x, this.y, { squashX: chg, squashY: chg, shadow: true });
        this.drawStatus(ctx);
      },
    }),

    // ── 미믹: 보물상자로 위장, 다가가면 깨어난다 ──
    mimic: () => ({
      hp: 8, r: 14, speed: 118, xpVal: 16, sprite: 'mimic',
      state: 'dormant', stateT: 0,
      update(dt, game) {
        this.tickTimers(dt); this.stateT += dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
        if (this.state === 'dormant') {
          if (d < 70 || this.hp < this.maxHp) {
            this.state = 'wake'; this.stateT = 0;
            AudioSys.roar();
            Particles.burst(this.x, this.y, { count: 12, colors: ['#c09a4a', '#6a1020'], speed: 120, life: 0.4, size: 3 });
          }
          return; // 위장 중엔 미동도 없다
        }
        this.applyKnockback(dt);
        if (this.state === 'wake') {
          if (this.stateT > 0.5) this.state = 'chase';
          return;
        }
        const spd = this.effSpeed() * (0.6 + Math.abs(Math.sin(this.animT * 8)) * 0.8); // 덥썩덥썩
        World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
        this.flip = dx < 0;
        this.touchPlayer(game, 2); // 물리면 아프다
      },
      draw(ctx) {
        if (this.state === 'dormant') {
          Renderer.drawSprite(this.skin(Sprites.chest), this.x, this.y, { shadow: true });
          return;
        }
        const chomp = 1 + Math.abs(Math.sin(this.animT * 8)) * 0.25;
        Renderer.drawSprite(this.skin(Sprites.mimic), this.x, this.y, { flip: this.flip, squashY: chomp, squashX: 2 - chomp, shadow: true });
        this.drawStatus(ctx);
      },
    }),

    // ── 그림자 추적자: 사라졌다가 등 뒤에서 기습 ──
    stalker: () => ({
      hp: 5, r: 13, speed: 105, xpVal: 14, sprite: 'stalker',
      state: 'chase', stateT: 0, ambushPos: null,
      update(dt, game) {
        this.tickTimers(dt); this.stateT += dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
        this.flip = dx < 0;
        if (this.state === 'chase') {
          this.applyKnockback(dt);
          this.phased = false;
          const spd = this.effSpeed();
          World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
          if (this.stateT > 2.2 && d < 320) { this.state = 'vanish'; this.stateT = 0; this.phased = true;
            Particles.burst(this.x, this.y, { count: 10, colors: ['#241832', '#b13ae0'], speed: 90, life: 0.35, size: 3 }); }
          this.touchPlayer(game, 1);
        } else if (this.state === 'vanish') {
          // 사라진 상태 — 플레이어 등 뒤 자리를 계산
          if (this.stateT > 0.9) {
            const back = Math.hypot(p.facing.x, p.facing.y) > 0 ? p.facing : { x: 1, y: 0 };
            this.ambushPos = { x: p.x - back.x * 64, y: p.y - back.y * 64 };
            this.x = this.ambushPos.x; this.y = this.ambushPos.y;
            this.state = 'ambush'; this.stateT = 0;
          }
        } else if (this.state === 'ambush') {
          // 그림자 텔레그래프 0.4초 후 실체화 + 베기
          if (this.stateT > 0.4) {
            this.phased = false;
            this.state = 'chase'; this.stateT = 0;
            Particles.burst(this.x, this.y, { count: 8, colors: ['#b13ae0'], speed: 100, life: 0.3, size: 3 });
            const dd = Math.hypot(p.x - this.x, p.y - this.y) || 1;
            if (p.invuln <= 0 && dd < 52) {
              game.hurtPlayer(1, { x: (p.x - this.x) / dd, y: (p.y - this.y) / dd }, 260);
            }
          }
        }
      },
      draw(ctx) {
        if (this.state === 'vanish') return; // 완전히 사라짐
        if (this.state === 'ambush') {
          ctx.save(); ctx.globalAlpha = 0.35 + this.stateT * 1.2;
          ctx.fillStyle = '#241832';
          ctx.beginPath(); ctx.ellipse(this.x, this.y + 10, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          Renderer.drawSprite(this.skin(Sprites.stalker), this.x, this.y, { flip: this.flip, alpha: 0.4 + this.stateT, shadow: false });
          return;
        }
        Renderer.drawSprite(this.skin(Sprites.stalker), this.x, this.y, { flip: this.flip, shadow: true });
        this.drawStatus(ctx);
      },
    }),

    // ── 덩치: 넓은 부채꼴 몽둥이 휘두르기 ──
    brute: () => ({
      hp: 13, r: 18, speed: 40, xpVal: 18, sprite: 'brute',
      state: 'walk', stateT: 0, swingA: 0,
      update(dt, game) {
        this.tickTimers(dt); this.applyKnockback(dt); this.stateT += dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
        if (this.state === 'walk') {
          const spd = this.effSpeed();
          World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
          this.flip = dx < 0;
          if (d < 85) { this.state = 'windup'; this.stateT = 0; this.swingA = Math.atan2(dy, dx); }
        } else if (this.state === 'windup') {
          if (this.stateT > 0.7) {
            this.state = 'recover'; this.stateT = 0;
            Renderer.shake(4, 0.2);
            AudioSys.thud();
            // 부채꼴 판정 (r 78, 폭 2.2rad)
            const pd = Math.hypot(p.x - this.x, p.y - this.y);
            let ang = Math.atan2(p.y - this.y, p.x - this.x) - this.swingA;
            while (ang > Math.PI) ang -= Math.PI * 2;
            while (ang < -Math.PI) ang += Math.PI * 2;
            if (p.invuln <= 0 && pd < 78 + p.r && Math.abs(ang) < 1.1) {
              game.hurtPlayer(2, { x: (p.x - this.x) / (pd || 1), y: (p.y - this.y) / (pd || 1) }, 400);
            }
            for (let i = 0; i < 6; i++) {
              const a = this.swingA + (i / 5 - 0.5) * 2.2;
              Particles.burst(this.x + Math.cos(a) * 60, this.y + Math.sin(a) * 60, { count: 2, colors: ['#7a5a4a', '#5e3a26'], speed: 90, life: 0.3, size: 3 });
            }
          }
        } else if (this.state === 'recover') {
          if (this.stateT > 1.0) { this.state = 'walk'; this.stateT = 0; }
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        if (this.state === 'windup') {
          ctx.save(); ctx.globalAlpha = 0.15 + (this.stateT / 0.7) * 0.2; ctx.fillStyle = '#e43b44';
          ctx.beginPath(); ctx.moveTo(this.x, this.y);
          ctx.arc(this.x, this.y, 78, this.swingA - 1.1, this.swingA + 1.1); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        const lift = this.state === 'windup' ? -this.stateT * 6 : 0;
        Renderer.drawSprite(this.skin(Sprites.brute), this.x, this.y + lift, { flip: this.flip, shadow: true });
        this.drawStatus(ctx);
      },
    }),

    // ── 임프: 짧은 순간이동 + 화염구 ──
    imp: () => ({
      hp: 3, r: 11, speed: 90, xpVal: 10, sprite: 'imp',
      blinkT: 2.2, castT: 1.1,
      update(dt, game) {
        this.tickTimers(dt); this.applyKnockback(dt);
        this.blinkT -= dt; this.castT -= dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
        this.flip = dx < 0;
        if (this.blinkT <= 0) {
          this.blinkT = 2.2;
          Particles.burst(this.x, this.y, { count: 6, colors: ['#c04a3a', '#ffd866'], speed: 70, life: 0.3, size: 2 });
          const a = Math.random() * Math.PI * 2;
          const nx = p.x + Math.cos(a) * 190, ny = p.y + Math.sin(a) * 190;
          if (!World.isSolidAt(nx, ny)) { this.x = nx; this.y = ny; }
          Particles.burst(this.x, this.y, { count: 6, colors: ['#c04a3a'], speed: 70, life: 0.3, size: 2 });
        } else {
          const spd = this.effSpeed();
          if (d > 200) World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
          else World.moveEntity(this, (-dy / d) * spd * 0.6 * dt, (dx / d) * spd * 0.6 * dt);
        }
        if (this.castT <= 0 && d < 420) {
          this.castT = 1.9;
          game.spawnProjectile('fire', this.x, this.y, { x: dx / d, y: dy / d }, { speed: 230, dmg: 1 });
          AudioSys.shoot();
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        Renderer.drawSprite(this.skin(Sprites.imp), this.x, this.y - Math.sin(this.animT * 6) * 3, { flip: this.flip, shadow: true });
        this.drawStatus(ctx);
      },
    }),

    // ── 식탐귀: 숨을 들이쉬며 끌어당긴 뒤 깨문다 ──
    glutton: () => ({
      hp: 10, r: 17, speed: 46, xpVal: 17, sprite: 'glutton',
      state: 'walk', stateT: 0,
      update(dt, game) {
        this.tickTimers(dt); this.applyKnockback(dt); this.stateT += dt;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
        this.flip = dx < 0;
        if (this.state === 'walk') {
          const spd = this.effSpeed();
          World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
          if (d < 200 && this.stateT > 1.5) { this.state = 'inhale'; this.stateT = 0; }
        } else if (this.state === 'inhale') {
          // 1.1초간 플레이어를 빨아들인다 — 이동/대시로 저항
          if (d < 260 && p.dashTimer <= 0) {
            const pull = 190 * dt;
            p.kbx -= (dx / d) * pull * 8;
            p.kby -= (dy / d) * pull * 8;
          }
          if (Math.random() < 0.4) {
            const a = Math.random() * Math.PI * 2;
            Particles.burst(this.x + Math.cos(a) * 40, this.y + Math.sin(a) * 40, { count: 1, colors: ['#8a6a9a'], speed: -60, life: 0.3, size: 2 });
          }
          if (this.stateT > 1.1) {
            this.state = 'bite'; this.stateT = 0;
            if (p.invuln <= 0 && d < 62) {
              game.hurtPlayer(2, { x: dx / d, y: dy / d }, 300);
            }
            AudioSys.thud();
          }
        } else if (this.state === 'bite') {
          if (this.stateT > 0.9) { this.state = 'walk'; this.stateT = 0; }
        }
        this.touchPlayer(game, 1);
      },
      draw(ctx) {
        let sq = 1 + Math.sin(this.animT * 4) * 0.05;
        if (this.state === 'inhale') sq = 1.15 + Math.sin(this.animT * 20) * 0.05;
        if (this.state === 'bite') sq = 0.8;
        Renderer.drawSprite(this.skin(Sprites.glutton), this.x, this.y, { flip: this.flip, squashX: sq, squashY: 2 - sq, shadow: true });
        if (this.state === 'inhale') {
          ctx.save(); ctx.globalAlpha = 0.25; ctx.strokeStyle = '#8a6a9a'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(this.x, this.y, 60 + Math.sin(this.animT * 12) * 8, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
        this.drawStatus(ctx);
      },
    }),
  };

  // ── 영혼 구슬 (눅스 '어둠 장막' 기믹 표적): 공격 안 함, 제한시간 내 파괴 대상 ──
  defs.soulOrb = () => ({
    hp: 3, r: 12, speed: 0, xpVal: 3, sprite: null,
    spawnT: 0, // 등장 연출 없음 (즉시 타격 가능해야 공정)
    update(dt, game) {
      this.tickTimers(dt);
      this.applyKnockback(dt);
    },
    draw(ctx) {
      const pulse = 1 + Math.sin(this.animT * 6) * 0.15;
      const rr = 10 * pulse;
      // 외곽 글로우
      const g = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, rr * 2.4);
      g.addColorStop(0, 'rgba(177,58,224,0.5)');
      g.addColorStop(1, 'rgba(177,58,224,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.x, this.y, rr * 2.4, 0, Math.PI * 2);
      ctx.fill();
      // 본체
      ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#b13ae0';
      ctx.beginPath();
      ctx.arc(this.x, this.y, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e0c9f5';
      ctx.beginPath();
      ctx.arc(this.x - 2, this.y - 2, rr * 0.4, 0, Math.PI * 2);
      ctx.fill();
    },
  });

  const def = defs[type];
  if (!def) throw new Error('알 수 없는 적 타입: ' + type);
  const e = Object.assign(base, def());
  e.hp = Math.ceil(e.hp * floorScale);
  // 깊은 층일수록 XP도 증가 (레벨 커브 유지) — ×0.68은 개체수 +30% 보정 (BALANCE.md 커브 목표)
  e.xpVal = Math.max(1, Math.round(e.xpVal * (0.7 + 0.3 * floorScale) * 0.68));

  if (elite) {
    e.hp = Math.ceil(e.hp * 2.5);
    e.speed *= 1.15;
    e.r *= 1.15;
    e.xpVal *= 3;
  }
  e.maxHp = e.hp;
  return e;
}

// ══════════════ 중간보스 (우두머리) — 랜덤 등장 + 랜덤 특성 ══════════════
// 일반 몬스터가 거대화·강화되어 나타난다. 특성(어픽스) 1~2개를 무작위로 갖는다.
const MINI_AFFIXES = {
  swift:    { name: '신속', color: '#5ce0e6', apply(e) { e.speed *= 1.4; } },
  steel:    { name: '강철', color: '#9aa0b4', apply(e) { e.armorCap = 2; } }, // 직접 타격 경감 (지속 피해로 뚫는다)
  regen:    { name: '재생', color: '#38b764',
    tick(e, dt) { e._rgT = (e._rgT || 0) + dt; if (e._rgT >= 1) { e._rgT = 0; if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + 2); } } },
  ghostly:  { name: '유령', color: '#a9c1d8',
    tick(e, dt) {
      e._ghT = (e._ghT || 0) + dt;
      if (e.phased && e._ghT > 1.0) { e.phased = false; e._ghT = 0; }
      else if (!e.phased && e._ghT > 2.6) { e.phased = true; e._ghT = 0;
        Particles.burst(e.x, e.y, { count: 6, colors: ['#a9c1d8'], speed: 60, life: 0.3, size: 3 }); }
    } },
  summoner: { name: '소환', color: '#8a5ac2',
    tick(e, dt, game) {
      e._smT = (e._smT || 0) + dt;
      if (e._smT >= 5 && game.enemies.length < 14) {
        e._smT = 0;
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI * 2;
          game.markers.push({ x: e.x + Math.cos(a) * 60, y: e.y + Math.sin(a) * 60, type: e.type, elite: false, t: 0.7 });
        }
        Particles.burst(e.x, e.y, { count: 10, colors: ['#8a5ac2'], speed: 90, life: 0.35, size: 3 });
      }
    } },
  volatile: { name: '폭발', color: '#ff7043',
    death(e, game) {
      const p = game.player;
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      game._explode(e.x, e.y, 90, 2, ['#ff7043', '#ffd866', '#e43b44'], '#ff7043');
      if (p.invuln <= 0 && d < 90 + p.r) {
        game.hurtPlayer(1, { x: (p.x - e.x) / (d || 1), y: (p.y - e.y) / (d || 1) }, 320);
      }
    } },
  splitter: { name: '분열', color: '#a7f070',
    death(e, game) {
      for (let i = 0; i < 2; i++) {
        const m = createEnemy(e.type, e.x + (i === 0 ? -20 : 20), e.y, false, game.enemyHpMul());
        m.spawnT = 0.25;
        game.enemies.push(m);
      }
    } },
};

function createMiniboss(type, x, y, floorScale) {
  const e = createEnemy(type, x, y, false, floorScale);
  // 어픽스 1개 (6층+ 2개) 무작위 — 같은 시드면 같은 구성 (RNG 사용)
  const keys = Object.keys(MINI_AFFIXES);
  const n = Dungeon.floor >= 6 ? 2 : 1;
  const picked = [];
  while (picked.length < n && keys.length > 0) {
    picked.push(keys.splice(Math.floor(RNG.next() * keys.length), 1)[0]);
  }
  e.isMini = true;
  e.affixes = picked;
  e.hp = e.maxHp = Math.ceil(e.hp * 7);
  e.r *= 1.4;
  e.xpVal *= 8;
  e.speed *= 0.92;
  e.miniName = picked.map((k) => MINI_AFFIXES[k].name).join('·') + ' 우두머리';
  for (const k of picked) MINI_AFFIXES[k].apply?.(e);

  // update 래핑: 어픽스 틱 (유령 어픽스가 아니면 위장 phased 유지 금지)
  const origUpdate = e.update.bind(e);
  e.update = (dt, game) => {
    origUpdate(dt, game);
    for (const k of e.affixes) MINI_AFFIXES[k].tick?.(e, dt, game);
  };
  // onDeath 체이닝: 어픽스 사망 효과
  const origDeath = e.onDeath ? e.onDeath.bind(e) : null;
  e.onDeath = (game) => {
    if (origDeath) origDeath(game);
    for (const k of e.affixes) MINI_AFFIXES[k].death?.(e, game);
  };
  // draw 래핑: 1.5배 확대 + 어픽스 오라 + 이름표 + 체력바
  const origDraw = e.draw.bind(e);
  e.draw = (ctx) => {
    // 오라
    ctx.save();
    ctx.globalAlpha = 0.22 + Math.sin(e.animT * 4) * 0.08;
    ctx.strokeStyle = MINI_AFFIXES[e.affixes[0]].color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // 확대 렌더
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(1.5, 1.5);
    ctx.translate(-e.x, -e.y);
    origDraw(ctx);
    ctx.restore();
    // 이름표 + 체력바
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#08080f';
    ctx.fillText(e.miniName, e.x + 1, e.y - e.r - 21);
    ctx.fillStyle = MINI_AFFIXES[e.affixes[0]].color;
    ctx.fillText(e.miniName, e.x, e.y - e.r - 22);
    const bw = 52;
    ctx.fillStyle = '#1c1c28';
    ctx.fillRect(e.x - bw / 2, e.y - e.r - 16, bw, 5);
    ctx.fillStyle = '#e43b44';
    ctx.fillRect(e.x - bw / 2, e.y - e.r - 16, bw * Math.max(0, e.hp / e.maxHp), 5);
  };
  return e;
}

// ── 파괴 가능 오브젝트 (맵 다양화 M2·M3) — 적이 아니라 지형에 가깝다 ──
// neutral 플래그: 방 클리어 판정·자동 조준·처치 집계·도감에서 제외된다.
function createPot(x, y, rare = false) {
  return {
    type: 'pot', neutral: true, noDrops: true, rare,
    x, y, r: 12, hp: 1, maxHp: 1, speed: 0, xpVal: 0,
    dead: false, phased: false, elite: false, isBoss: false, isMini: false,
    flash: 0, kbx: 0, kby: 0, hitCd: 0, spawnT: 0, flip: false, animT: 0,
    status: { burn: 0, burnTick: 0, shock: 0, poison: 0, poisonTick: 0 },
    update(dt) { this.kbx = this.kby = 0; if (this.flash > 0) this.flash -= dt; },
    onDeath(game) {
      const n = this.rare ? 8 + Dungeon.floor : RNG.int(1, 3);
      Meta.data.shards += n;
      Particles.text(this.x, this.y - 24, `◆ +${n}`, { color: '#2ec4b6', size: this.rare ? 15 : 12 });
      if (this.rare && Math.random() < 0.5) game.pickups.push({ x: this.x, y: this.y, t: 0, r: 12 });
      AudioSys.thud();
    },
    draw(ctx) {
      const body = this.rare ? '#c09a4a' : '#7a6a5a';
      const dark = this.rare ? '#8a6a20' : '#5a4a3e';
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 9, 9, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = dark;
      ctx.fillRect(this.x - 8, this.y - 6, 16, 14);
      ctx.fillStyle = body;
      ctx.fillRect(this.x - 7, this.y - 5, 14, 9);
      ctx.fillRect(this.x - 5, this.y - 10, 10, 5);
      ctx.fillStyle = dark;
      ctx.fillRect(this.x - 4, this.y - 13, 8, 3);
      if (this.rare) {
        ctx.fillStyle = '#ffd866';
        ctx.fillRect(this.x - 1, this.y - 3, 3, 3);
      }
      if (this.flash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(this.x - 8, this.y - 13, 16, 21);
      }
    },
  };
}

// 균열 벽 — 부수면 벽 타일이 열린다 (비밀 벽감 입구). 근접·회전·투사체로 파괴 가능.
function createCrack(tx, ty, x, y) {
  return {
    type: 'crack', neutral: true, noDrops: true, tx, ty,
    x, y, r: 20, hp: 2, maxHp: 2, speed: 0, xpVal: 0,
    dead: false, phased: false, elite: false, isBoss: false, isMini: false,
    flash: 0, kbx: 0, kby: 0, hitCd: 0, spawnT: 0, flip: false, animT: 0,
    status: { burn: 0, burnTick: 0, shock: 0, poison: 0, poisonTick: 0 },
    update(dt) { this.kbx = this.kby = 0; if (this.flash > 0) this.flash -= dt; },
    onDeath() {
      World.breakWall(this.tx, this.ty);
      AudioSys.thud();
      Renderer.shake(4, 0.2);
      Particles.burst(this.x, this.y, {
        count: 18, colors: ['#8a8074', '#5a5a6e', '#3a3a48'], speed: 160, life: 0.5, size: 4, gravity: 260,
      });
      Particles.text(this.x, this.y - 22, '벽이 무너졌다!', { color: '#ffd866', size: 13 });
    },
    draw(ctx) {
      // 벽 타일 위의 균열 — 자세히 보면 눈에 띈다 (탐색 보상)
      ctx.save();
      ctx.strokeStyle = this.flash > 0 ? '#ffffff' : 'rgba(10,8,14,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.x - 6, this.y - 15);
      ctx.lineTo(this.x - 2, this.y - 5);
      ctx.lineTo(this.x - 8, this.y + 3);
      ctx.moveTo(this.x - 2, this.y - 5);
      ctx.lineTo(this.x + 5, this.y + 1);
      ctx.lineTo(this.x + 2, this.y + 12);
      ctx.stroke();
      if (this.hp < this.maxHp) {
        ctx.strokeStyle = 'rgba(255,216,102,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.x + 7, this.y - 12);
        ctx.lineTo(this.x + 3, this.y - 2);
        ctx.stroke();
      }
      ctx.restore();
    },
  };
}
