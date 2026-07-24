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
    name: '무덤지기 카론', sprite: 'boss', scale: 1, r: 26, hp: 95, speed: 42,
    banner: '무덤지기 카론',
    p1: ['sweep', 'fan:soul'],
    p2: ['sweep', 'fan:soul', 'curse'],
    rageText: '카론이 분노한다!',
    deathPalette: ['#b13ae0', '#241832', '#e8e0cf'],
  },
  2: {
    name: '포자왕 믹서스', sprite: 'bossSpore', scale: 1.1, r: 32, hp: 220, speed: 34,
    mechanic: { type: 'regen', label: '포자 갑피 — 부하가 살아있는 동안 재생한다' },
    banner: '포자왕 믹서스',
    p1: ['fan:spore', 'ring', 'summon:mushroom'],
    p2: ['fan:spore', 'ring', 'summon:toxicSlime', 'curse'],
    rageText: '포자가 미친 듯이 흩날린다!',
    deathPalette: ['#38b764', '#d8f070', '#8a5ac2'],
  },
  3: {
    name: '간수장 바르곤', sprite: 'bossGolem', scale: 1.1, r: 33, hp: 190, speed: 30,
    mechanic: { type: 'armor', cap: 2, label: '중장갑 — 강한 일격을 경감한다' },
    banner: '간수장 바르곤',
    p1: ['charge', 'ring'],
    p2: ['charge', 'fan:rock', 'ring', 'charge'],
    rageText: '바르곤의 사슬이 풀렸다!',
    deathPalette: ['#6b7a94', '#454f63', '#e43b44'],
  },
  4: {
    name: '용암 심장 이그니스', sprite: 'bossIgnis', scale: 1.2, r: 30, hp: 430, speed: 44,
    mechanic: { type: 'rage', label: '백열 — 시간이 지날수록 빨라진다' },
    banner: '용암 심장 이그니스',
    p1: ['fan:fire', 'charge:trail'],
    p2: ['fan:fire', 'charge:trail', 'curse:fire', 'ring'],
    rageText: '이그니스가 백열한다!',
    deathPalette: ['#ff7043', '#ffd866', '#7a1010'],
  },
  5: {
    name: '심연의 군주 눅스', sprite: 'bossAbyss', scale: 1.4, r: 28, hp: 700, speed: 50,
    mechanic: { type: 'veil', label: '어둠 장막 — 영혼 구슬을 파괴하라' },
    banner: '심연의 군주 눅스',
    p1: ['sweep', 'fan:soul', 'ring'],
    p2: ['sweep', 'fan:soul', 'curse', 'summon:wraith:elite'],
    rageText: '심연이 깨어난다...!',
    deathPalette: ['#e43b44', '#16101f', '#c9b8e8'],
  },
  // ── 6~10층 각성 보스: 같은 존재의 심층 강화판 (기믹 강화 + 패턴 확장) ──
  6: {
    awakened: true, name: '원혼 카론', sprite: 'bossWraith', scale: 1.2, r: 26, hp: 550, speed: 48,
    banner: '원혼 카론',
    p1: ['sweep', 'spiral:soul', 'curse'],
    p2: ['sweep', 'spiral:soul', 'curse', 'summon:boneHeap', 'spiral:soul'],
    rageText: '원혼이 울부짖는다!',
    deathPalette: ['#e43b44', '#241832', '#e8e0cf'],
  },
  7: {
    awakened: true, name: '역병왕 믹서스', sprite: 'bossPlague', scale: 1.2, r: 32, hp: 680, speed: 38,
    mechanic: { type: 'regen', label: '포자 갑피 — 부하가 살아있는 동안 재생한다' },
    banner: '역병왕 믹서스',
    p1: ['fan:spore', 'ring', 'summon:sporePuff', 'geyser:poison'],
    p2: ['fan:spore', 'geyser:poison', 'summon:sporePuff', 'ring', 'fan:spore'],
    rageText: '역병이 들끓는다!',
    deathPalette: ['#6ab04c', '#8a3a8c', '#d8f070'],
  },
  8: {
    awakened: true, name: '절망의 바르곤', sprite: 'bossDespair', scale: 1.2, r: 33, hp: 650, speed: 34,
    mechanic: { type: 'armor', cap: 2, label: '중장갑 — 강한 일격을 경감한다' },
    banner: '절망의 바르곤',
    p1: ['charge', 'snare', 'fan:rock', 'ring'],
    p2: ['snare', 'charge', 'fan:rock', 'ring', 'snare', 'charge'],
    rageText: '절망이 짓누른다!',
    deathPalette: ['#383850', '#a9c1d8', '#e43b44'],
  },
  9: {
    awakened: true, name: '겁화의 이그니스', sprite: 'bossInferno', scale: 1.3, r: 30, hp: 850, speed: 48,
    mechanic: { type: 'rage', label: '백열 — 시간이 지날수록 빨라진다' },
    banner: '겁화의 이그니스',
    p1: ['fan:fire', 'charge:trail', 'geyser:fire'],
    p2: ['geyser:fire', 'charge:trail', 'fan:fire', 'ring', 'charge:trail', 'geyser:fire'],
    rageText: '겁화가 폭주한다!',
    deathPalette: ['#ffd866', '#ff7043', '#7a1010'],
  },
  10: {
    awakened: true, name: '진 심연의 군주 눅스', sprite: 'bossVoid', scale: 1.6, r: 30, hp: 1300, speed: 54,
    mechanic: { type: 'veil', label: '어둠 장막 — 영혼 구슬을 파괴하라', veils: [0.75, 0.5, 0.25] },
    banner: '진 심연의 군주 눅스',
    p1: ['sweep', 'spiral:soul', 'ring', 'curse'],
    p2: ['spiral:soul', 'sweep', 'curse', 'summon:voidSpawn', 'ring', 'spiral:soul'],
    rageText: '심연이 모든 것을 삼킨다...!',
    deathPalette: ['#e43b44', '#0a0612', '#c9b8e8'],
  },
};

function createBoss(floor, x, y) {
  // 11층+ (무한 모드): 각성 보스(6~10층)를 순환하며 층당 +15% HP로 강해진다
  const defKey = floor <= 10 ? floor : ((floor - 11) % 5) + 6;
  const def = BOSS_DEFS[defKey] || BOSS_DEFS[1];
  const hpScale = floor > 10 ? 1 + 0.15 * (floor - 10) : 1;
  const hp = Math.round(def.hp * hpScale);
  return {
    type: 'boss', isBoss: true,
    name: def.name,
    def,
    x, y,
    hp, maxHp: hp,
    r: def.r || 24,
    speed: def.speed, xpVal: 0,
    dead: false, elite: false,
    spawnT: 0.6, // 등장 연출
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
    // 기믹 상태
    armorCap: def.mechanic?.type === 'armor' ? def.mechanic.cap : 0,
    rageT: 0,
    rageStacks: 0,
    veilsDone: 0,
    phased: false,    // 어둠 장막 중 무적
    _regenTick: 0,
    _regenPause: 0,
    fightT: 0,        // 전투 경과 시간 — 소프트 인레이지
    enrage: 0,        // 45초마다 +1 (최대 3): 패턴 가속
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

      // ── 소프트 인레이지: 오래 끌수록 보스가 빨라진다 (45초마다, 최대 3중첩) ──
      // 긴장감의 시간 축 — "언젠가는 잡겠지"가 아니라 "빨리 잡아야 한다"
      if (this.state !== 'enter') {
        this.fightT += dt;
        const want = Math.min(3, Math.floor(this.fightT / 45));
        if (want > this.enrage) {
          this.enrage = want;
          game.banner = { text: `${this.name}의 살기가 짙어진다! (×${this.enrage})`, life: 1.6, maxLife: 1.6, color: '#e43b44' };
          AudioSys.roar();
          Particles.ring(this.x, this.y, { r0: 10, r1: 110, life: 0.5, color: '#e43b44', width: 4 });
        }
      }

      // ── 기믹: 포자 갑피 (부하 생존 시 재생) ──
      // 컨트롤 해법: 부하를 처치하면 재생이 5초 멈춘다 — 광역 트리가 없어도
      // 부하를 빠르게 끊으면서 보스를 때리면 뚫을 수 있다.
      if (this.def.mechanic?.type === 'regen' && this.state !== 'enter') {
        const minionCount = game.enemies.filter((o) => !o.isBoss && !o.dead).length;
        if (this._lastMinions !== undefined && minionCount < this._lastMinions) {
          this._regenPause = 5;
          Particles.text(this.x, this.y - 40, '재생 정지!', { color: '#ffd866', size: 13 });
        }
        this._lastMinions = minionCount;
        if (this._regenPause > 0) this._regenPause -= dt;
        if (minionCount > 0 && this._regenPause <= 0 && this.hp < this.maxHp) {
          // 계측 (검사·열기5): 2층 피해 110+ = 전층 최대 — 근접 단일딜은 부하 정리가 느려
          // 재생을 뚫는 데 오래 걸린다. 6→4/s (재생 정지 컨트롤 해법은 그대로 유효)
          this.hp = Math.min(this.maxHp, this.hp + 4 * dt);
          this._regenTick += dt;
          if (this._regenTick >= 1.0) {
            this._regenTick = 0;
            Particles.text(this.x, this.y - 40, '재생 +4', { color: '#38b764', size: 12 });
          }
        }
      }

      // ── 기믹: 백열 (16초마다 가속, 최대 4중첩) ──
      if (this.def.mechanic?.type === 'rage' && this.state !== 'enter') {
        this.rageT += dt;
        if (this.rageT >= 16 && this.rageStacks < 4) {
          this.rageT = 0;
          this.rageStacks++;
          game.banner = { text: `이그니스가 더 뜨거워진다! (×${this.rageStacks})`, life: 1.3, maxLife: 1.3, color: '#ff7043' };
          AudioSys.roar();
          Particles.burst(this.x, this.y, { count: 18, colors: ['#ff7043', '#ffd866'], speed: 180, life: 0.5, size: 4 });
        }
      }

      // ── 기믹: 어둠 장막 (HP 70%·35%에서 무적 + 영혼 구슬) ──
      if (this.def.mechanic?.type === 'veil' && this.state !== 'veil' && this.state !== 'enter') {
        const thresholds = this.def.mechanic.veils || [0.7, 0.35];
        if (this.veilsDone < thresholds.length && this.hp <= this.maxHp * thresholds[this.veilsDone]) {
          this.state = 'veil';
          this.stateT = 0;
          this.phased = true;
          this.attack = null;
          game.banner = { text: '영혼 구슬을 파괴하라!', life: 2.0, maxLife: 2.0, color: '#b13ae0' };
          AudioSys.roar();
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2 + Math.random();
            const pos = {
              x: Math.min(Math.max(this.x + Math.cos(a) * 200, TS * 1.5), TS * (World.cols - 1.5)),
              y: Math.min(Math.max(this.y + Math.sin(a) * 150, World.offsetY + TS * 1.5), World.offsetY + TS * (World.rows - 1.5)),
            };
            game.enemies.push(createEnemy('soulOrb', pos.x, pos.y, false, 1 + (Dungeon.floor - 1) * 0.3));
          }
        }
      }

      // ── 3페이즈 '맹공' (각성 보스 전용, HP 25%↓): 수치가 아니라 판정 밀도로 조인다 —
      // 패턴 간격 단축 + 시전마다 추적 장판 1개 중첩. 전부 피할 수 있지만 안전한 틈이 좁아진다
      if (!this._onslaught && this.def.awakened && this.phase === 2 && this.hp <= this.maxHp * 0.25 && this.state !== 'veil') {
        this._onslaught = true;
        game.banner = { text: `${this.name} — 최후의 맹공!`, life: 1.8, maxLife: 1.8, color: '#e43b44' };
        AudioSys.roar();
        Renderer.shake(6, 0.35);
        Particles.ring(this.x, this.y, { r0: 12, r1: 140, life: 0.6, color: '#e43b44', width: 5 });
      }

      // 페이즈 전환
      if (this.phase === 1 && this.hp <= this.maxHp / 2 && this.state !== 'veil') {
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
          const wait = (this.phase === 2 ? 0.75 : 1.1) * Math.pow(0.87, this.rageStacks) * Math.pow(0.85, this.enrage) * (this._onslaught ? 0.6 : 1);
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
          const windups = { sweep: 0.55, fan: 0.65, curse: 0.5, summon: 0.6, charge: 0.75, ring: 0.6, spiral: 0.7, snare: 0.55, geyser: 0.6 };
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
            if (pd < 95 + p.r) { // 무적 게이트 제거 — 대시 관통 시 완벽 회피 판정 (hurtPlayer가 무적 처리)
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
          if (Math.hypot(p.x - this.x, p.y - this.y) < p.r + this.r) {
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

        case 'veil': {
          const orbs = game.enemies.filter((o) => o.type === 'soulOrb' && !o.dead);
          if (orbs.length === 0) {
            // 성공: 장막 붕괴 → 긴 그로기 (집중 딜 타임)
            this.phased = false;
            this.veilsDone++;
            this.state = 'stunned';
            this.stateT = -1.4; // 그로기 단축 — 고딜 빌드의 공짜 딜타임 방지
            game.banner = { text: '장막이 깨졌다!', life: 1.6, maxLife: 1.6, color: '#f7b32b' };
            Renderer.shake(6, 0.4);
            AudioSys.thud();
          } else if (this.stateT > 8) {
            // 실패: 구슬 회수 → 15% 회복 + 반격
            for (const o of orbs) {
              o.dead = true;
              Particles.burst(o.x, o.y, { count: 10, colors: ['#b13ae0', '#5c1e5e'], speed: 120, life: 0.4, size: 3 });
            }
            this.phased = false;
            this.veilsDone++;
            this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25); // 실패는 아프게 — 25% 회복
            game.banner = { text: '눅스가 영혼을 흡수했다...', life: 1.8, maxLife: 1.8, color: '#e43b44' };
            AudioSys.roar();
            const baseAngle = Math.atan2(p.y - this.y, p.x - this.x);
            for (let i = 0; i < 9; i++) {
              const a = baseAngle + (i - 4) * 0.22;
              game.spawnProjectile('soul', this.x, this.y, { x: Math.cos(a), y: Math.sin(a) }, { speed: 210, dmg: 1 });
            }
            this.state = 'idle';
            this.stateT = 0;
          }
          break;
        }
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
          if (Math.hypot(p.x - c.x, p.y - c.y) < 48 + p.r) {
            const ddx = p.x - c.x, ddy = p.y - c.y;
            const dd = Math.hypot(ddx, ddy) || 1;
            game.hurtPlayer(1, { x: ddx / dd, y: ddy / dd });
          }
          if (c.fire) {
            game.firePatches.push({ x: c.x, y: c.y, r: 44, life: 2.4, kind: 'fire' });
          }
          if (c.poison) {
            game.firePatches.push({ x: c.x, y: c.y, r: 44, life: 3.0, kind: 'poison' });
          }
          if (c.snare && Math.hypot(p.x - c.x, p.y - c.y) < 55 + p.r) {
            p.slowT = Math.max(p.slowT, 1.6);
            Particles.text(p.x, p.y - 30, '속박!', { color: '#c05060', size: 13 });
          }
          this.curses.splice(i, 1);
        }
      }

      // 접촉 데미지 (장막 중 제외) — 2페이즈부터는 몸 자체가 흉기다
      if (this.state !== 'veil' && this.hitCd <= 0 && Math.hypot(p.x - this.x, p.y - this.y) < p.r + this.r) {
        this.hitCd = 0.8;
        game.hurtPlayer(this.phase === 2 ? 2 : 1, { x: dx / d, y: dy / d });
      }
    },

    _execute(game, dx, dy, d) {
      const { kind, opt } = this.attack;
      const p = game.player;
      // 맹공: 어떤 패턴을 쓰든 플레이어 발밑에 예고 장판 1개가 따라붙는다 (중첩 압박)
      if (this._onslaught) {
        this.curses.push({ x: p.x, y: p.y, t: 1.0 });
      }

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
      } else if (kind === 'spiral') {
        // 나선 탄막 (심층 시그니처): 시전마다 회전하는 2겹 8방 탄 — 겹 사이 속도차가 나선을 그린다
        const projKind = opt[0] || 'soul';
        const rot = this.patternIdx * 0.45;
        for (let i = 0; i < 8; i++) {
          const a = rot + (i / 8) * Math.PI * 2;
          game.spawnProjectile(projKind, this.x, this.y, { x: Math.cos(a), y: Math.sin(a) }, { speed: 200, dmg: 1 });
          const a2 = a + Math.PI / 8;
          game.spawnProjectile(projKind, this.x, this.y, { x: Math.cos(a2), y: Math.sin(a2) }, { speed: 130, dmg: 1 });
        }
        AudioSys.shoot();
        this.state = 'idle';
      } else if (kind === 'snare') {
        // 사슬 속박 (감옥 계열 시그니처): 예고 원 → 안에 있으면 피해 + 속박
        this.curses.push({ x: p.x, y: p.y, t: 0.85, snare: true });
        for (let i = 0; i < 2; i++) {
          this.curses.push({
            x: p.x + (Math.random() - 0.5) * 220,
            y: Math.min(Math.max(p.y + (Math.random() - 0.5) * 170, World.offsetY + TS * 1.5), World.offsetY + TS * (World.rows - 1.5)),
            t: 0.95 + i * 0.1, snare: true,
          });
        }
        AudioSys.shoot();
        this.state = 'idle';
      } else if (kind === 'geyser') {
        // 간헐천 (화염/맹독 시그니처): 플레이어를 쫓는 4연속 분출 — 계속 움직여야 산다
        const flag = opt[0] === 'poison' ? { poison: true } : { fire: true };
        for (let i = 0; i < 4; i++) {
          this.curses.push({
            x: p.x + (Math.random() - 0.5) * 120 * i,
            y: Math.min(Math.max(p.y + (Math.random() - 0.5) * 100 * i, World.offsetY + TS * 1.5), World.offsetY + TS * (World.rows - 1.5)),
            t: 0.8 + i * 0.22, ...flag,
          });
        }
        AudioSys.shoot();
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
      ctx.ellipse(this.x, this.y + this.r + 8, this.r * 1.05, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      const shakeX = this.state === 'windup' && this.attack?.kind === 'charge' ? (Math.random() - 0.5) * 5 : 0;
      Renderer.drawSprite(img, this.x + shakeX, this.y - bob, {
        flip: this.flip,
        alpha: this.phased ? 0.35 : 1,
        squashX: this.def.scale,
        squashY: this.def.scale,
      });
    },
  };
}
