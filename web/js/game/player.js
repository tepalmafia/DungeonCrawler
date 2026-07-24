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
    finisherHealCd: 0, // 전투 본능 (검사): 마무리 적중 회복 쿨다운
    reviveUsed: false,

    shield: false,
    shieldT: 0,

    combo: 0,
    comboTimer: 0,
    attackCd: 0,
    slashes: [],
    dashCritReady: false,
    pdodgeCrit: false, // 완벽 회피 보상: 다음 일격 확정 크리
    _pdodged: false,
    dashAtkT: 0, // 대시 파생기 입력 창
    _dashWin: 0, // 완벽 회피 판정 창

    // 직업 스킬 (K / 우클릭): 검사 회전 베기 / 궁수 화살비 / 마도사 메테오
    skillCd: 0,
    skillCdMul: 1,
    spinT: 0, // 회전 베기 연출
    skillEvolved: false, // 스킬 진화 발동됨 (회오리 베기/화살 폭풍/쌍둥이 메테오)
    evoReady: false,     // 직업 특성 3장 수집 완료 — Lv.12 도달 시 진화 (rewards.checkEvolution)
    _spinPulseT: 0,      // [진화] 회오리 베기 추가 타격 주기

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
      // 무한 대시 차단 — 어떤 조합(제단 강화 × 바람걸음 × 깃털 × 폭주 기관)이라도 충전 하한을 지킨다.
      // 대시 무적(0.22s)이 상시 유지되면 회피가 아니라 면역이 된다.
      if (this.rflags.engine) return 0.45; // 폭주 기관: 최속 고정 (기존 '쿨다운 소멸'은 무한 대시라 재설계)
      return Math.max(0.6, 1.5 * this.dashRegenMul);
    },

    skillMaxCd() {
      const base = { knight: 5, archer: 6, mage: 7 }[this.classId] || 5;
      // 스킬 쿨 하한 (밸런스 점검): 시간 왜곡 × 직업 쿨감 3중첩 + 처치 시 -0.3s가 겹치면
      // 사실상 상시 스킬이 된다 — 최소 1.5초는 유지
      return Math.max(1.5, base * this.skillCdMul);
    },

    skillName() {
      if (this.skillEvolved) {
        return { knight: '회오리 베기', archer: '화살 폭풍', mage: '쌍둥이 메테오' }[this.classId];
      }
      return { knight: '회전 베기', archer: '화살비', mage: '메테오' }[this.classId];
    },

    // 스킬 조준점: 자동 타겟 위치 > 마우스 > 바라보는 방향 앞
    _skillTarget(game) {
      const t = this.autoTarget(game);
      if (t) return { x: t.x, y: t.y };
      return { x: this.x + this.facing.x * 180, y: this.y + this.facing.y * 180 };
    },

    useSkill(game) {
      this.skillCd = this.skillMaxCd();
      if (this.flags.mgward) this.invuln = Math.max(this.invuln, 0.6); // 마력 장막

      if (this.classId === 'knight') {
        // 회전 베기: 360° 강타 + 강넉백 + 시전 중 무적 — 포위당했을 때의 탈출 버튼
        // [진화] 회오리 베기: 1.1초간 이동하며 회전 — 0.35초마다 추가 타격 펄스
        this.spinT = this.skillEvolved ? 1.1 : 0.35;
        this._spinPulseT = this.skillEvolved ? 0.35 : 0;
        this.invuln = Math.max(this.invuln, this.skillEvolved ? 0.5 : 0.4);
        AudioSys.spin();
        Renderer.shake(4, 0.2);
        Particles.ring(this.x, this.y, { r0: 20, r1: 100, life: 0.3, color: '#4a6ede', width: 5 });
        Particles.ring(this.x, this.y, { r0: 10, r1: 70, life: 0.22, color: '#ffffff', width: 3 });
        let hits = 0;
        for (const e of game.enemies) {
          if (e.dead || e.phased) continue;
          const dx = e.x - this.x, dy = e.y - this.y;
          const d = Math.hypot(dx, dy);
          if (d > 100 + e.r) continue;
          const dir = { x: dx / (d || 1), y: dy / (d || 1) };
          const dmg = this.currentAtk() * 3;
          const crit = this.rflags.allcrit || Math.random() < Math.min(0.8, this.critChance);
          game.hitEnemy(e, crit ? Math.round(dmg * this.critMul) : dmg, dir, { crit, kb: 380 });
          hits++;
        }
        // 검기 방출
        if (this.flags.kn_wave) {
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            game.pbolts.push({
              kind: 'pwave', x: this.x, y: this.y,
              dir: { x: Math.cos(a), y: Math.sin(a) },
              speed: 340, finisher: false, pierce: true, life: 0.4, hit: new Set(),
            });
          }
        }
        // 피의 회전
        if (this.flags.kn_blood && hits >= 3 && this.hp < this.maxHp) {
          this.hp++;
          Particles.text(this.x, this.y - 28, '+1', { color: '#e43b44', size: 15 });
        }
      } else if (this.classId === 'archer') {
        // 화살비: 지점 광역 폭격 — [진화] 화살 폭풍: 범위·화살 수 대폭 증가
        const t = this._skillTarget(game);
        AudioSys.rainCast();
        game.rains.push({
          x: t.x, y: t.y, r: this.skillEvolved ? 140 : 110, t: 0, next: 0.25,
          shots: this.skillEvolved ? 24 : 14, fired: 0,
          explo: this.flags.ar_explo,
        });
      } else {
        // 메테오: 예고 후 대광역 낙하 — [진화] 쌍둥이 메테오: 두 번째 낙하가 뒤따른다
        const t = this._skillTarget(game);
        AudioSys.meteorCast();
        game.meteors.push({ x: t.x, y: t.y, t: 0.7, r: 105 });
        if (this.skillEvolved) {
          const side = Math.random() < 0.5 ? -1 : 1;
          game.meteors.push({ x: t.x + side * 120, y: t.y + (Math.random() - 0.5) * 90, t: 1.0, r: 105 });
        }
        if (this.flags.mg_meteor3) {
          for (let i = 0; i < 2; i++) {
            game.meteors.push({
              x: t.x + (Math.random() - 0.5) * 190,
              y: t.y + (Math.random() - 0.5) * 150,
              t: 0.9 + i * 0.25, r: 90,
            });
          }
        }
      }
    },

    update(dt, game) {
      this.animT += dt;
      if (this.attackCd > 0) this.attackCd -= dt;
      if (this.attackPoseT > 0) this.attackPoseT -= dt;
      if (this.skillCd > 0) {
        this.skillCd -= dt;
        if (this.skillCd <= 0) {
          // 스킬 준비 완료 — 은은한 차임 + 표시 (잊고 안 쓰는 것 방지)
          AudioSys.skillReady();
          Particles.text(this.x, this.y - 36, this.skillName() + ' 준비!', { color: '#5ce0e6', size: 12 });
        }
      }
      if (this.spinT > 0) {
        this.spinT -= dt;
        // [진화] 회오리 베기: 회전이 유지되는 동안 주기적 추가 타격 (이동하며 썰어낸다)
        if (this.skillEvolved && this.classId === 'knight' && this._spinPulseT > 0) {
          this._spinPulseT -= dt;
          if (this._spinPulseT <= 0 && this.spinT > 0.05) {
            this._spinPulseT = 0.35;
            Particles.ring(this.x, this.y, { r0: 14, r1: 96, life: 0.25, color: '#4a6ede', width: 4 });
            for (const e of game.enemies) {
              if (e.dead || e.phased) continue;
              const dx = e.x - this.x, dy = e.y - this.y;
              const d = Math.hypot(dx, dy);
              if (d > 96 + e.r) continue;
              const dir = { x: dx / (d || 1), y: dy / (d || 1) };
              const dmg = Math.max(1, Math.round(this.currentAtk() * 1.5));
              const crit = this.rflags.allcrit || Math.random() < Math.min(0.8, this.critChance);
              game.hitEnemy(e, crit ? Math.round(dmg * this.critMul) : dmg, dir, { crit, kb: 260 });
            }
          }
        }
      }
      if (this.comboTimer > 0) this.comboTimer -= dt; else this.combo = 0;
      if (this.invuln > 0) this.invuln -= dt;
      if (this.lifestealCd > 0) this.lifestealCd -= dt;
      if (this._overchargeCd > 0) this._overchargeCd -= dt;
      if (this.dashAtkT > 0) this.dashAtkT -= dt;
      if (this._huntT > 0) this._huntT -= dt;
      if (this._dashWin > 0) this._dashWin -= dt;
      if (this.finisherHealCd > 0) this.finisherHealCd -= dt;
      if (this.slowT > 0) this.slowT -= dt;

      if (this.dashCharges < this.dashMax) {
        this.dashRegenT += dt;
        if (this.dashRegenT >= this.dashRegenTime()) {
          this.dashRegenT = 0;
          this.dashCharges++;
        }
      }

      // 보호막 충전: 수호의 문장 특성(8초) 또는 검사 고유 '철벽'(11초)
      const shieldCd = this.flags.shield ? 8 : (this.classId === 'knight' ? 11 : 0);
      if (shieldCd > 0 && !this.shield) {
        this.shieldT += dt;
        if (this.shieldT >= shieldCd) {
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
        this._pdodged = false; // 완벽 회피: 대시당 1회
        this._dashWin = 0.24; // 완벽 회피 판정 창 — 대시 무적(0.22s) 전체를 커버 (기존 0.16s는 무적보다 짧았다)
        this.dashAtkT = 0.35; // 대시 파생기 입력 창: 대시 중 + 직후 0.19초 (0.16초는 너무 빡빡했다)
        if (this.flags.hunterstep) this._huntT = 1.5; // 사냥꾼의 호흡: 대시 후 공속 창
        if (this.rflags.dashcrit) this.dashCritReady = true;
        // 불꽃 대시 (특성): 대시 궤적에 불타는 자취
        if (this.flags.dashfire) {
          for (let k = 0; k < 3; k++) {
            game.zones.push({
              x: this.x + this.dashDir.x * k * 34, y: this.y + this.dashDir.y * k * 34,
              r: 26, life: 1.6, kind: 'fire', tickT: 0.15 + k * 0.1, hit: null,
            });
          }
        }
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

      // 스킬 (K / 우클릭)
      if ((Input.pressed('KeyK') || Input.mouse.rightJustDown) && this.skillCd <= 0 && this.dashTimer <= 0) {
        this.useSkill(game);
      }

      const attackInput = Input.mouse.justDown || Input.pressed('KeyJ');
      // 대시 파생기 (P2): 대시 중·직후 입력 창(0.35초) 안에 공격 — 직업별 특수기
      if (attackInput && this.attackCd <= 0 && this.dashAtkT > 0) {
        this.dashAttack(game);
      } else if (attackInput && this.attackCd <= 0 && this.dashTimer <= 0) {
        // 자동 타겟팅: 가장 가까운 적을 자동 조준. 적이 없으면 마우스/이동 방향
        let dir = null;
        const target = this.autoTarget(game);
        if (target) {
          const dx = target.x - this.x;
          const dy = target.y - this.y;
          const d = Math.hypot(dx, dy) || 1;
          dir = { x: dx / d, y: dy / d };
        } else if (Input.mouse.justDown) {
          const dx = Input.mouse.x - Renderer.offsetX - this.x;
          const dy = Input.mouse.y - Renderer.offsetY - this.y;
          const d = Math.hypot(dx, dy) || 1;
          dir = { x: dx / d, y: dy / d };
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

    // 자동 타겟: 사거리 내 가장 가까운 적 (비물질 망령 제외)
    autoTarget(game) {
      const maxRange = this.classId === 'knight' ? 240 : this.classId === 'archer' ? 440 : 520;
      let best = maxRange;
      let target = null;
      for (const e of game.enemies) {
        if (e.dead || e.phased || e.spawnT > 0 || e.neutral) continue; // 항아리 등 중립 개체는 조준 안 함
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d < best) { best = d; target = e; }
      }
      return target;
    },

    currentAtk() {
      let atk = 1 + this.bonusAtk + (this.floorAtk || 0); // floorAtk: 모닥불 담금질 (이번 층 한정)
      if (this.flags.bloodpact && this.hp >= this.maxHp) atk += 1; // DPS 리그: +2는 +59%로 과함
      if (this.flags.berserk && this.hp <= 2) atk += 1;
      if (this.rflags.berserkhelm && this.hp <= 3) atk += 4; // 에픽 가치 밴드 보정
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

      let crit = Math.random() < Math.min(0.8, this.critChance);
      if (this.rflags.allcrit) crit = true;
      if (this.flags.firecrit && e.status.burn > 0) crit = true;
      if (this.dashCritReady) { crit = true; this.dashCritReady = false; }
      if (this.pdodgeCrit) { crit = true; this.pdodgeCrit = false; } // 완벽 회피 보상: 다음 일격 확정 크리

      let bonus = 0;
      if (this.flags.corrode && e.status.poison > 0) bonus += 1;
      if (this.flags.static && e.status.shock > 0) bonus += 2; // 번개 트리 상향

      const baseDmg = this.currentAtk();
      const dmg = finisher ? Math.round(baseDmg * (2 + this.comboLv + (this.flags.bowmaster ? 1 : 0))) : baseDmg;
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
      if (this.flags.chain && Math.random() < 0.3) { // 번개 트리 상향 (20%→30%)
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
      const comboStep = this.combo; // 사운드용: 0/1/2타
      this.comboTimer = 0.9;
      this.combo = (this.combo + 1) % 3;

      let cdBase;
      if (this.classId === 'knight') cdBase = finisher ? 0.45 : 0.22;
      else if (this.classId === 'archer') cdBase = finisher ? 0.58 : 0.33; // 밸런스: 원거리 저위험 보상
      else cdBase = finisher ? 0.58 : 0.32;
      let cd = cdBase * this.atkCdMul;
      if (this.flags.berserk && this.hp <= 2) cd *= 0.7;
      if (this._huntT > 0) cd *= 0.7; // 사냥꾼의 호흡
      // 공속 하한 (밸런스 점검): 신속×4 + 민첩의 룬 + 광폭 중첩 시 10타/초까지 치솟는 폭주 차단
      this.attackCd = Math.max(0.12, cd);
      this.attackPoseT = 0.18;
      if (dir.x !== 0) this.flip = dir.x < 0; // 공격 방향을 바라본다

      if (this.classId === 'knight') {
        this._meleeAttack(dir, game, finisher, comboStep);
      } else if (this.classId === 'archer') {
        AudioSys.bow(finisher);
        World.moveEntity(this, -dir.x * 5, -dir.y * 5); // 반동
        // 이중 사격: 부채꼴 2발
        const angles = this.flags.ar_double ? [-0.11, 0.11] : [0];
        for (const off of angles) {
          const a = Math.atan2(dir.y, dir.x) + off;
          const d2 = { x: Math.cos(a), y: Math.sin(a) };
          game.pbolts.push({
            kind: 'parrow', x: this.x + d2.x * 14, y: this.y + d2.y * 14,
            dir: d2, speed: finisher ? 560 : 480,
            finisher, pierce: finisher, life: 1.1, hit: new Set(),
            bounces: this.flags.rebound ? 1 : 0, // 도탄 특성
          });
        }
        Particles.burst(this.x + dir.x * 16, this.y + dir.y * 16, {
          count: 3, colors: ['#d9cbb8', '#38b764'], speed: 50, life: 0.2, size: 2,
        });
      } else {
        AudioSys.bolt(finisher);
        // 파이어볼: 관통 + 상시 착탄 폭발
        const fireball = this.flags.mg_fireball;
        game.pbolts.push({
          kind: 'pbolt', x: this.x + dir.x * 14, y: this.y + dir.y * 14,
          dir: { ...dir }, speed: finisher ? 260 : 300,
          finisher, pierce: fireball, homing: 5.0,
          aoe: finisher ? 70 : (fireball ? 40 : 0),
          fire: fireball,
          life: 2.0, hit: new Set(),
          bounces: this.flags.rebound ? 1 : 0, // 도탄 특성
        });
        Particles.burst(this.x + dir.x * 16, this.y + dir.y * 16, {
          count: 4, colors: fireball ? ['#ff7043', '#ffd866'] : ['#c56cf0', '#8a5ac2'], speed: 60, life: 0.25, size: 3,
        });
      }

      // 지진파 (특성): 마무리 일격이 전방으로 관통 충격파를 쏜다
      if (finisher && this.flags.quake) {
        game.pbolts.push({
          kind: 'pwave', x: this.x + dir.x * 12, y: this.y + dir.y * 12,
          dir: { ...dir }, speed: 330, finisher: false, pierce: true, life: 0.55, hit: new Set(),
        });
      }
    },

    // 대시 파생기 — 대시의 기세를 공격으로 잇는다 (손맛 동사 확장)
    dashAttack(game) {
      this.attackCd = 0.5 * this.atkCdMul;
      this.attackPoseT = 0.18;
      this.dashAtkT = 0; // 파생기는 대시당 1회
      const dir = { ...this.dashDir };
      const angle = Math.atan2(dir.y, dir.x);
      if (dir.x !== 0) this.flip = dir.x < 0;
      // 파생기 체감: 순간 잔상 + 흔들림 + 발동 표시
      Renderer.shake(3, 0.14);
      Particles.text(this.x, this.y - 34, '파생기!', { color: '#5ce0e6', size: 13 });
      this.ghosts.push({ x: this.x, y: this.y, flip: this.flip, life: 0.3 });

      if (this.classId === 'knight') {
        // 돌진 찌르기: 좁고 긴 관통 일격 (대시 방향으로 꿰뚫는다)
        AudioSys.slash(2);
        this.slashes.push({ angle, range: 108, arc: 0.7, life: 0.14, maxLife: 0.14, finisher: true });
        World.moveEntity(this, dir.x * 14, dir.y * 14);
        for (const e of game.enemies) {
          if (e.dead || e.phased) continue;
          const dx = e.x - this.x, dy = e.y - this.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 108 + e.r) continue;
          let diff = Math.atan2(dy, dx) - angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (Math.abs(diff) > 0.35 + 0.25) continue;
          const hitDir = { x: dx / (dist || 1), y: dy / (dist || 1) };
          const dmg = Math.round(this.currentAtk() * 2);
          let crit = this.rflags.allcrit || Math.random() < Math.min(0.8, this.critChance);
          if (this.pdodgeCrit) { crit = true; this.pdodgeCrit = false; }
          game.hitEnemy(e, crit ? Math.round(dmg * this.critMul) : dmg, hitDir, { crit, kb: 360 });
        }
      } else if (this.classId === 'archer') {
        // 후퇴 사격: 물러나며 3발 부채꼴 — 카이팅의 리듬
        AudioSys.bow(true);
        World.moveEntity(this, -dir.x * 30, -dir.y * 30);
        for (const off of [-0.22, 0, 0.22]) {
          const a = angle + off;
          const d2 = { x: Math.cos(a), y: Math.sin(a) };
          game.pbolts.push({
            kind: 'parrow', x: this.x + d2.x * 14, y: this.y + d2.y * 14,
            dir: d2, speed: 540, finisher: false, pierce: false, life: 1.0, hit: new Set(),
            bounces: this.flags.rebound ? 1 : 0,
          });
        }
      } else {
        // 점멸 폭발: 대시로 빠져나온 자리가 터진다
        AudioSys.bolt(true);
        game._explode(
          this.x - dir.x * 34, this.y - dir.y * 34, 80,
          Math.max(1, Math.round(this.currentAtk() * 1.5)),
          ['#c56cf0', '#8a5ac2', '#ffd866'], '#c56cf0');
      }
    },

    _meleeAttack(dir, game, finisher, comboStep = 0) {
      const range = (finisher ? 94 : 77) * this.rangeMul; // 밸런스: 근접 리스크 보상 (+10% 상향)
      const arc = finisher ? 2.4 : 1.9;
      const angle = Math.atan2(dir.y, dir.x);
      AudioSys.slash(comboStep);
      if (finisher) {
        // 마무리 일격: 살짝 파고들며 화면이 함께 울린다
        World.moveEntity(this, dir.x * 6, dir.y * 6);
        Renderer.shake(2.5, 0.12);
      }

      this.slashes.push({
        angle, range, arc,
        life: finisher ? 0.16 : 0.12,
        maxLife: finisher ? 0.16 : 0.12,
        finisher,
      });

      // 칼날 궤적 스파크 (부채꼴 가장자리를 따라)
      const sparkN = finisher ? 7 : 4;
      for (let i = 0; i < sparkN; i++) {
        const a = angle + (i / (sparkN - 1) - 0.5) * arc;
        Particles.burst(this.x + Math.cos(a) * range * 0.9, this.y + Math.sin(a) * range * 0.9, {
          count: 1, colors: finisher ? ['#ffd866', '#fff7c0'] : ['#ffffff', '#c8d4e4'],
          speed: 60, life: 0.22, size: 2, dir: a, spread: 0.6,
        });
      }

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
      if (hitAny && finisher) {
        Renderer.shake(3, 0.15);
        // 전투 본능 (검사 고유): 마무리 일격이 적중하면 HP 1 회복 (6초에 한 번)
        // — 근접의 리스크를 "잘 싸우면 버틴다"로 보상한다
        if (this.finisherHealCd <= 0 && this.hp < this.maxHp) {
          this.hp++;
          this.finisherHealCd = 4;
          Particles.text(this.x, this.y - 26, '전투 본능 +1', { color: '#e43b44', size: 13 });
          AudioSys.pickup();
        }
      }
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
      let rot = this.moving ? Math.sin(this.animT * 11) * 0.04 : 0;
      if (this.spinT > 0) rot = ((this.skillEvolved && this.classId === 'knight' ? 1.1 : 0.35) - this.spinT) * 18; // 회전 베기: 계속 돌기
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

      // ── 유물 시각 흔적 — 레어 이상 유물은 캐릭터에 보이는 표식을 남긴다 (런마다 다른 모습) ──
      {
        const notable = this.relics.filter((id) => {
          const r = RELICS.find((x) => x.id === id);
          return r && r.rarity !== 'common';
        });
        // 궤도를 도는 유물 문장 (등급색 점)
        for (let i = 0; i < Math.min(notable.length, 8); i++) {
          const r = RELICS.find((x) => x.id === notable[i]);
          const a = this.animT * 1.4 + (i / Math.min(notable.length, 8)) * Math.PI * 2;
          const ox = this.x + Math.cos(a) * 21;
          const oy = this.y - 6 + Math.sin(a) * 8 - Math.abs(Math.cos(a)) * 2;
          ctx.save();
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = RARITY[r.rarity].color;
          ctx.fillRect(Math.round(ox) - 1.5, Math.round(oy) - 1.5, 3, 3);
          ctx.globalAlpha = 0.25;
          ctx.fillRect(Math.round(ox) - 3, Math.round(oy) - 3, 6, 6);
          ctx.restore();
        }
        // 광전사의 투구: 위기(HP≤3)에 붉은 아우라가 타오른다
        if (this.rflags.berserkhelm && this.hp <= 3) {
          ctx.save();
          ctx.globalAlpha = 0.16 + Math.sin(this.animT * 8) * 0.06;
          ctx.fillStyle = '#e43b44';
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.r + 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // 불사조 깃털(미사용): 이따금 불씨가 피어오른다
        if (this.rflags.revive && !this.reviveUsed && Math.random() < 0.06) {
          Particles.burst(this.x + (Math.random() - 0.5) * 14, this.y - 14, {
            count: 1, colors: ['#ff7043', '#ffd866'], speed: 26, life: 0.5, size: 2, gravity: -90,
          });
        }
        // 유리 대검: 서릿발 같은 흰 섬광이 반짝인다
        if (this.rflags.allcrit && Math.random() < 0.08) {
          Particles.burst(this.x + (Math.random() - 0.5) * 18, this.y - 8 + (Math.random() - 0.5) * 14, {
            count: 1, colors: ['#ffffff', '#fff7c0'], speed: 8, life: 0.35, size: 2,
          });
        }
      }

      for (const s of this.slashes) {
        const t = s.life / s.maxLife;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(s.angle);
        // 웨지 (그라데이션)
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
        // 칼날 궤적 (밝은 외곽 호 — 시간에 따라 휘둘러지는 느낌)
        const sweep = (1 - t) * s.arc; // 진행도만큼 호가 그려짐
        ctx.globalAlpha = t;
        ctx.strokeStyle = s.finisher ? '#ffd866' : '#ffffff';
        ctx.lineWidth = s.finisher ? 4 : 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, s.range * 0.94, -s.arc / 2, -s.arc / 2 + Math.max(sweep, s.arc * 0.35));
        ctx.stroke();
        // 안쪽 보조 호
        ctx.globalAlpha = t * 0.5;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, s.range * 0.6, -s.arc / 2, s.arc / 2);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    },
  };
}
