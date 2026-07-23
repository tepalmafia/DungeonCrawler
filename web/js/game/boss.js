// 층 보스 5종 — 공격 프리미티브(휘두르기/투사체 부채꼴/장판/소환/돌진/충격파 링)를
// 조합해 보스별 패턴을 만든다. HP 50% 이하에서 페이즈 2 (패턴 추가 + 가속).
//
// 프리미티브:
//  sweep      근접 연속 베기 (부채꼴 텔레그래프 → 짧은 돌진 + 호 판정)
//  fan:KIND   투사체 부채꼴 (soul/spore/fire/rock)
//  curse      바닥 장판 (예고 원 → 폭발). opt.fire면 불길이 남는다
//  summon     잡몹 소환
//  charge     긴 돌진 (벽에 부딪히면 그로기). opt.trail이면 불길 흔적
//  ring       확장 충격파 링 (대시로 통과)

const BOSS_DEFS = {
  1: {
    name: '무덤지기 카론', sprite: 'boss', scale: 1, hp: 60, speed: 42,
    banner: '무덤지기 카론',
    p1: ['sweep', 'fan:soul'],
    p2: ['sweep', 'fan:soul', 'curse'],
    rageText: '카론이 분노한다!',
    deathPalette: ['#b13ae0', '#241832', '#e8e0cf'],
  },
  2: {
    name: '포자왕 믹서스', sprite: 'bossSpore', scale: 1.9, hp: 95, speed: 34,
    banner: '포자왕 믹서스',
    p1: ['fan:spore', 'ring', 'summon:mushroom'],
    p2: ['fan:spore', 'ring', 'summon:toxicSlime', 'curse'],
    rageText: '포자가 미친 듯이 흩날린다!',
    deathPalette: ['#38b764', '#d8f070', '#8a5ac2'],
  },
  3: {
    name: '간수장 바르곤', sprite: 'bossGolem', scale: 1.8, hp: 125, speed: 30,
    banner: '간수장 바르곤',
    p1: ['charge', 'ring'],
    p2: ['charge', 'fan:rock', 'ring', 'charge'],
    rageText: '바르곤의 사슬이 풀렸다!',
    deathPalette: ['#6b7a94', '#454f63', '#e43b44'],
  },
  4: {
    name: '용암 심장 이그니스', sprite: 'bossIgnis', scale: 1.8, hp: 140, speed: 44,
    banner: '용암 심장 이그니스',
    p1: ['fan:fire', 'charge:trail'],
    p2: ['fan:fire', 'charge:trail', 'curse:fire', 'ring'],
    rageText: '이그니스가 백열한다!',
    deathPalette: ['#ff7043', '#ffd866', '#7a1010'],
  },
  5: {
    name: '심연의 군주 눅스', sprite: 'bossAbyss', scale: 1.5, hp: 175, speed: 50,
    banner: '심연의 군주 눅스',
    p1: ['sweep', 'fan:soul', 'ring'],
    p2: ['sweep', 'fan:soul', 'curse', 'summon:wraith:elite'],
    rageText: '심연이 깨어난다...!',
    deathPalette: ['#e43b44', '#16101f', '#c9b8e8'],
  },
};

function createBoss(floor, x, y) {
  const def = BOSS_DEFS[floor] || BOSS_DEFS[1];
  return {
    type: 'boss', isBoss: true,
    name: def.name,
    def,
    x, y,
    hp: def.hp, maxHp: def.hp,
    r: 24 * Math.max(1, def.scale * 0.7),
    speed: def.speed, xpVal: 0,
    dead: false, elite: false,
    flash: 0,
    kbx: 0, kby: 0,
    animT: 0,
    flip: false,
    hitCd: 0,
    status: { burn: 0, burnTick: 0, shock: 0, poison: 0, poisonTick: 0 },
    phase: 1,
    state: 'enter',
    stateT: 0,
    patternIdx: 0,
    attack: null,     // 현재 공격 {kind, opt}
    swingCount: 0,
    aimDir: { x: -1, y: 0 },
    curses: [],

    effSpeed() { return this.speed * (this.status.shock > 0 ? 0.7 : 1) * (this.phase === 2 ? 1.15 : 1); },

    tickTimers(dt) {
      this.animT += dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.hitCd > 0) this.hitCd -= dt;
    },

    _nextPattern() {
      const list = this.phase === 2 ? this.def.p2 : this.def.p1;
      const raw = list[this.patternIdx % list.length];
      this.patternIdx++;
      const [kind, ...opts] = raw.split(':');
      return { kind, opt: opts };
    },

    update(dt, game) {
      this.tickTimers(dt);
      this.stateT += dt;
      const p = game.player;
      const dx = p.x - this.x, dy = p.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      if (this.state !== 'charge') this.flip = dx < 0;

      // 넉백 저항
      if (Math.abs(this.kbx) > 1 || Math.abs(this.kby) > 1) {
        World.moveEntity(this, this.kbx * 0.3 * dt, this.kby * 0.3 * dt);
        this.kbx *= Math.pow(0.0001, dt);
        this.kby *= Math.pow(0.0001, dt);
      }

      // 페이즈 전환
      if (this.phase === 1 && this.hp <= this.maxHp / 2) {
        this.phase = 2;
        this.state = 'idle';
        this.stateT = -0.8;
        this.attack = null;
        game.banner = { text: this.def.rageText, life: 1.6, maxLife: 1.6 };
        Renderer.shake(7, 0.4);
        AudioSys.roar();
        Particles.burst(this.x, this.y, {
          count: 26, colors: this.def.deathPalette, speed: 200, life: 0.7, size: 4,
        });
      }

      switch (this.state) {
        case 'enter':
          if (this.stateT > 1.2) { this.state = 'idle'; this.stateT = 0; }
          break;

        case 'idle': {
          const spd = this.effSpeed();
          World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
          const wait = this.phase === 2 ? 0.75 : 1.1;
          if (this.stateT >= wait) {
            this.attack = this._nextPattern();
            this.state = 'windup';
            this.stateT = 0;
            this.aimDir = { x: dx / d, y: dy / d };
          }
          break;
        }

        case 'windup': {
          const k = this.attack.kind;
          // 조준 갱신 (마지막 순간 고정)
          if (this.stateT < 0.35) this.aimDir = { x: dx / d, y: dy / d };
          const windups = { sweep: 0.55, fan: 0.65, curse: 0.5, summon: 0.6, charge: 0.75, ring: 0.6 };
          if ((k === 'fan' || k === 'curse') && Math.random() < 0.4) {
            Particles.burst(this.x + (Math.random() - 0.5) * 40, this.y + (Math.random() - 0.5) * 40, {
              count: 1, colors: this.def.deathPalette, speed: -60, life: 0.3, size: 3,
            });
          }
          if (this.stateT >= (windups[k] || 0.6)) {
            this.stateT = 0;
            this._execute(game, dx, dy, d);
          }
          break;
        }

        case 'sweep': {
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
              range: 95, arc: 2.2, life: 0.15, maxLife: 0.15,
            });
            const pdx = p.x - this.x, pdy = p.y - this.y;
            const pd = Math.hypot(pdx, pdy);
            if (pd < 95 + p.r && p.invuln <= 0) {
              let diff = Math.atan2(pdy, pdx) - Math.atan2(this.aimDir.y, this.aimDir.x);
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              if (Math.abs(diff) < 1.35) {
                game.hurtPlayer(1, { x: pdx / (pd || 1), y: pdy / (pd || 1) });
              }
            }
            const maxSwings = this.phase === 2 ? 4 : 3;
            if (this.swingCount >= maxSwings) { this.state = 'idle'; this.stateT = 0; }
          }
          break;
        }

        case 'charge': {
          const trail = this.attack.opt.includes('trail');
          const step = 480 * dt;
          const hit = World.moveEntity(this, this.aimDir.x * step, this.aimDir.y * step);
          if (trail && Math.random() < 0.6) {
            game.firePatches.push({ x: this.x, y: this.y, r: 26, life: 1.6, kind: 'fire' });
          }
          if (p.invuln <= 0 && Math.hypot(p.x - this.x, p.y - this.y) < p.r + this.r) {
            game.hurtPlayer(1, this.aimDir, 420);
          }
          if (hit.x || hit.y || this.stateT > 1.4) {
            Renderer.shake(6, 0.3);
            AudioSys.thud();
            Particles.burst(this.x + this.aimDir.x * 20, this.y, {
              count: 16, colors: ['#5e5e74', ...this.def.deathPalette], speed: 170, life: 0.5, size: 4,
            });
            game.rings.push({ x: this.x, y: this.y, r: 16, maxR: 110, speed: 240, width: 13, dmg: 1 });
            this.state = 'stunned';
            this.stateT = 0;
          }
          break;
        }

        case 'stunned':
          if (this.stateT > (this.phase === 2 ? 0.6 : 1.0)) { this.state = 'idle'; this.stateT = 0; }
          break;
      }

      // 저주 장판 폭발 처리
      for (let i = this.curses.length - 1; i >= 0; i--) {
        const c = this.curses[i];
        c.t -= dt;
        if (c.t <= 0) {
          Particles.burst(c.x, c.y, {
            count: 16, colors: this.def.deathPalette, speed: 160, life: 0.45, size: 4,
          });
          AudioSys.thud();
          if (p.invuln <= 0 && Math.hypot(p.x - c.x, p.y - c.y) < 48 + p.r) {
            const ddx = p.x - c.x, ddy = p.y - c.y;
            const dd = Math.hypot(ddx, ddy) || 1;
            game.hurtPlayer(1, { x: ddx / dd, y: ddy / dd });
          }
          if (c.fire) {
            game.firePatches.push({ x: c.x, y: c.y, r: 44, life: 2.4, kind: 'fire' });
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

    _execute(game, dx, dy, d) {
      const { kind, opt } = this.attack;
      const p = game.player;

      if (kind === 'sweep') {
        this.state = 'sweep';
        this.swingCount = 0;
      } else if (kind === 'fan') {
        const projKind = opt[0] || 'soul';
        const n = this.phase === 2 ? 9 : 7;
        const baseAngle = Math.atan2(dy, dx);
        const speeds = { soul: 195, spore: 150, fire: 210, rock: 250 };
        for (let i = 0; i < n; i++) {
          const a = baseAngle + (i - (n - 1) / 2) * 0.22;
          game.spawnProjectile(projKind, this.x, this.y, { x: Math.cos(a), y: Math.sin(a) }, {
            speed: speeds[projKind] || 200, dmg: 1,
          });
        }
        AudioSys.shoot();
        this.state = 'idle';
      } else if (kind === 'curse') {
        const fire = opt.includes('fire');
        this.curses.push({ x: p.x, y: p.y, t: 0.9, fire });
        for (let i = 0; i < 3; i++) {
          this.curses.push({
            x: p.x + (Math.random() - 0.5) * 260,
            y: Math.min(Math.max(p.y + (Math.random() - 0.5) * 200, World.offsetY + TS * 1.5), World.offsetY + TS * (World.rows - 1.5)),
            t: 0.9 + i * 0.12,
            fire,
          });
        }
        this.state = 'idle';
      } else if (kind === 'summon') {
        const mType = opt[0] || 'slime';
        const isElite = opt.includes('elite');
        const minions = game.enemies.filter((e) => !e.isBoss && !e.dead).length;
        for (let i = 0; i < Math.min(2, 5 - minions); i++) {
          const pos = World.randomSpawnPos(p, 140);
          game.markers.push({ x: pos.x, y: pos.y, type: mType, elite: isElite, t: 0.7 });
        }
        AudioSys.roar();
        this.state = 'idle';
      } else if (kind === 'charge') {
        this.state = 'charge';
      } else if (kind === 'ring') {
        Renderer.shake(4, 0.2);
        AudioSys.thud();
        game.rings.push({ x: this.x, y: this.y, r: 24, maxR: 340, speed: 300, width: 15, dmg: 1 });
        if (this.phase === 2) {
          game.rings.push({ x: this.x, y: this.y, r: 24, maxR: 340, speed: 210, width: 15, dmg: 1 });
        }
        this.state = 'idle';
      } else {
        this.state = 'idle';
      }
      this.stateT = 0;
    },

    draw(ctx) {
      // 텔레그래프
      if (this.state === 'windup') {
        const k = this.attack?.kind;
        if (k === 'sweep') {
          const a = Math.atan2(this.aimDir.y, this.aimDir.x);
          ctx.save();
          ctx.translate(this.x, this.y);
          ctx.rotate(a);
          ctx.globalAlpha = 0.25 + Math.sin(this.animT * 18) * 0.1;
          ctx.fillStyle = '#e43b44';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, 95, -1.1, 1.1);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          ctx.globalAlpha = 1;
        } else if (k === 'charge') {
          ctx.save();
          ctx.globalAlpha = 0.3 + Math.sin(this.animT * 16) * 0.12;
          ctx.strokeStyle = '#e43b44';
          ctx.lineWidth = this.r * 1.6;
          ctx.beginPath();
          ctx.moveTo(this.x, this.y);
          ctx.lineTo(this.x + this.aimDir.x * 520, this.y + this.aimDir.y * 520);
          ctx.stroke();
          ctx.restore();
        }
      }
      // 저주 장판 텔레그래프
      for (const c of this.curses) {
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(c.t * 25) * 0.12;
        ctx.strokeStyle = c.fire ? '#ff7043' : '#b13ae0';
        ctx.fillStyle = c.fire ? 'rgba(255,112,67,0.15)' : 'rgba(177,58,224,0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      const bob = Math.sin(this.animT * 2.2) * 4;
      const img = this.flash > 0 ? Sprites.white(Sprites[this.def.sprite]) : Sprites[this.def.sprite];
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 26 * this.def.scale, 22 * this.def.scale, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      const shakeX = this.state === 'windup' && this.attack?.kind === 'charge' ? (Math.random() - 0.5) * 5 : 0;
      Renderer.drawSprite(img, this.x + shakeX, this.y - bob, {
        flip: this.flip,
        squashX: this.def.scale,
        squashY: this.def.scale,
      });
    },
  };
}
