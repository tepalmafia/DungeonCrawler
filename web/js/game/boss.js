// 1층 보스: 무덤지기 카론 — 기획안 패턴:
//  ① 낫 3연 휘두르기 (근접 돌진 베기, 붉은 부채꼴 텔레그래프)
//  ② 영혼 투사체 부채꼴
//  ③ (HP 50% 이하) 바닥 저주 지대 + 잡몹 소환
function createBoss(x, y) {
  return {
    type: 'boss', isBoss: true,
    name: '무덤지기 카론',
    x, y,
    hp: 60, maxHp: 60,
    r: 24, speed: 42, xpVal: 0,
    dead: false, elite: false,
    flash: 0,
    kbx: 0, kby: 0, // 보스는 넉백에 강한 저항 (hitEnemy에서 값은 들어오지만 감쇠가 빠름)
    animT: 0,
    flip: false,
    hitCd: 0,
    status: { burn: 0, burnTick: 0, shock: 0 },
    phase: 1,
    state: 'enter', // enter → idle → (scythe | soulfan | curse) 순환
    stateT: 0,
    cycle: 0,
    swingCount: 0,
    swingMax: 3,
    aimDir: { x: -1, y: 0 },
    curses: [],     // 저주 지대 텔레그래프

    effSpeed() { return this.speed * (this.status.shock > 0 ? 0.7 : 1); },

    tickTimers(dt) {
      this.animT += dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.hitCd > 0) this.hitCd -= dt;
    },

    update(dt, game) {
      this.tickTimers(dt);
      this.stateT += dt;
      const p = game.player;
      const dx = p.x - this.x, dy = p.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.flip = dx < 0;

      // 넉백 저항 (빠른 감쇠)
      if (Math.abs(this.kbx) > 1 || Math.abs(this.kby) > 1) {
        World.moveEntity(this, this.kbx * 0.3 * dt, this.kby * 0.3 * dt);
        this.kbx *= Math.pow(0.0001, dt);
        this.kby *= Math.pow(0.0001, dt);
      }

      // 페이즈 전환
      if (this.phase === 1 && this.hp <= this.maxHp / 2) {
        this.phase = 2;
        this.state = 'idle';
        this.stateT = -0.8; // 잠시 멈칫
        this.swingMax = 4;
        game.banner = { text: '카론이 분노한다!', life: 1.6, maxLife: 1.6 };
        Renderer.shake(7, 0.4);
        AudioSys.roar();
        Particles.burst(this.x, this.y, {
          count: 26, colors: ['#b13ae0', '#4a3070', '#e8e0cf'], speed: 200, life: 0.7, size: 4,
        });
      }

      if (this.state === 'enter') {
        if (this.stateT > 1.2) { this.state = 'idle'; this.stateT = 0; }
      } else if (this.state === 'idle') {
        // 천천히 플레이어에게 접근하며 다음 패턴 선택
        const spd = this.effSpeed();
        World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
        const wait = this.phase === 2 ? 0.8 : 1.15;
        if (this.stateT >= wait) {
          this.stateT = 0;
          this.cycle++;
          if (this.phase === 2 && this.cycle % 3 === 0) {
            this.state = 'curseWindup';
          } else if (d < 160 || this.cycle % 2 === 1) {
            this.state = 'scytheWindup';
          } else {
            this.state = 'fanWindup';
          }
        }
      } else if (this.state === 'scytheWindup') {
        // 텔레그래프: 붉은 부채꼴 (0.55초)
        this.aimDir = { x: dx / d, y: dy / d };
        if (this.stateT > 0.55) {
          this.state = 'scythe';
          this.stateT = 0;
          this.swingCount = 0;
        }
      } else if (this.state === 'scythe') {
        // 낫 연속 휘두르기: 짧은 돌진 + 부채꼴 판정, 휘두를 때마다 재조준
        if (this.stateT > 0.32) {
          this.stateT = 0;
          this.swingCount++;
          this.aimDir = { x: dx / d, y: dy / d };
          World.moveEntity(this, this.aimDir.x * 85, this.aimDir.y * 85);
          AudioSys.slash();
          Renderer.shake(3, 0.12);
          game.bossSlashes.push({
            x: this.x, y: this.y,
            angle: Math.atan2(this.aimDir.y, this.aimDir.x),
            range: 92, arc: 2.2, life: 0.15, maxLife: 0.15,
          });
          // 부채꼴 안 플레이어 타격
          const pdx = p.x - this.x, pdy = p.y - this.y;
          const pd = Math.hypot(pdx, pdy);
          if (pd < 92 + p.r && p.invuln <= 0) {
            let diff = Math.atan2(pdy, pdx) - Math.atan2(this.aimDir.y, this.aimDir.x);
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            if (Math.abs(diff) < 1.35) {
              game.hurtPlayer(1, { x: pdx / (pd || 1), y: pdy / (pd || 1) });
            }
          }
          if (this.swingCount >= this.swingMax) { this.state = 'idle'; this.stateT = 0; }
        }
      } else if (this.state === 'fanWindup') {
        // 텔레그래프: 보라색 기 모으기 (0.7초)
        if (Math.random() < 0.5) {
          Particles.burst(this.x + (Math.random() - 0.5) * 40, this.y + (Math.random() - 0.5) * 40, {
            count: 1, colors: ['#b13ae0', '#8a3a8c'], speed: -60, life: 0.35, size: 3,
          });
        }
        if (this.stateT > 0.7) {
          this.stateT = 0;
          this.state = 'idle';
          const baseAngle = Math.atan2(dy, dx);
          const n = this.phase === 2 ? 9 : 7;
          for (let i = 0; i < n; i++) {
            const a = baseAngle + (i - (n - 1) / 2) * 0.22;
            game.arrows.push({
              kind: 'soul',
              x: this.x, y: this.y,
              dir: { x: Math.cos(a), y: Math.sin(a) },
              speed: 195, r: 7, life: 4, t: 0,
            });
          }
          AudioSys.shoot();
        }
      } else if (this.state === 'curseWindup') {
        // 저주 지대: 플레이어 위치 + 주변 3곳 텔레그래프 (0.9초 후 폭발)
        if (this.stateT < 0.05 && this.curses.length === 0) {
          this.curses.push({ x: p.x, y: p.y, t: 0.9 });
          for (let i = 0; i < 3; i++) {
            this.curses.push({
              x: p.x + (Math.random() - 0.5) * 260,
              y: Math.min(Math.max(p.y + (Math.random() - 0.5) * 200, World.offsetY + TS * 1.5), World.offsetY + TS * (World.rows - 1.5)),
              t: 0.9 + i * 0.12,
            });
          }
          // 잡몹 소환 (최대 4마리 유지)
          const minions = game.enemies.filter((e) => !e.isBoss && !e.dead).length;
          for (let i = 0; i < Math.min(2, 4 - minions); i++) {
            const pos = World.randomSpawnPos(p, 140);
            game.markers.push({ x: pos.x, y: pos.y, type: RNG.pick(['slime', 'archer']), elite: false, t: 0.7 });
          }
        }
        if (this.stateT > 1.6) { this.state = 'idle'; this.stateT = 0; }
      }

      // 저주 지대 폭발 처리
      for (let i = this.curses.length - 1; i >= 0; i--) {
        const c = this.curses[i];
        c.t -= dt;
        if (c.t <= 0) {
          Particles.burst(c.x, c.y, {
            count: 16, colors: ['#b13ae0', '#4a3070', '#e8e0cf'], speed: 160, life: 0.45, size: 4,
          });
          AudioSys.thud();
          if (p.invuln <= 0 && Math.hypot(p.x - c.x, p.y - c.y) < 48 + p.r) {
            const ddx = p.x - c.x, ddy = p.y - c.y;
            const dd = Math.hypot(ddx, ddy) || 1;
            game.hurtPlayer(1, { x: ddx / dd, y: ddy / dd });
          }
          this.curses.splice(i, 1);
        }
      }

      // 접촉 데미지
      if (this.hitCd <= 0 && p.invuln <= 0 && Math.hypot(p.x - this.x, p.y - this.y) < p.r + this.r) {
        this.hitCd = 0.8;
        game.hurtPlayer(1, { x: dx / d, y: dy / d });
      }
    },

    draw(ctx) {
      // 낫 휘두르기 텔레그래프 (붉은 부채꼴)
      if (this.state === 'scytheWindup') {
        const a = Math.atan2(this.aimDir.y, this.aimDir.x);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(a);
        ctx.globalAlpha = 0.25 + Math.sin(this.animT * 18) * 0.1;
        ctx.fillStyle = '#e43b44';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 92, -1.1, 1.1);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      // 저주 지대 텔레그래프
      for (const c of this.curses) {
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(c.t * 25) * 0.12;
        ctx.strokeStyle = '#b13ae0';
        ctx.fillStyle = 'rgba(177,58,224,0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      const bob = Math.sin(this.animT * 2.2) * 4; // 유령처럼 둥실둥실
      const img = this.flash > 0 ? Sprites.white(Sprites.boss) : Sprites.boss;
      // 그림자 없는 부유감: 아래 어둠
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 30, 22, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      Renderer.drawSprite(img, this.x, this.y - bob, { flip: this.flip });
    },
  };
}
