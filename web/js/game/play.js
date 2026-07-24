// 플레이 상태 프레임 갱신 — 환경 위험/스폰/적/장판/투사체/스킬 이펙트/픽업/방 클리어.
// Game.tick(main.js)이 상태 분기 후 매 프레임 호출한다.
const GamePlay = {
  // AI 고도화 — 개체 상태 기계를 건드리지 않는 '조향 오버레이'.
  // 역할(돌격/사격/지원)에 따라 이동에 보정을 더한다: 협공 각도 / 측면 재배치 / 후방 유지 / 광역 예고 산개.
  // 보스·우두머리·중립(항아리 등)·고정형(speed 0)은 제외 — 개성은 각자의 상태 기계가 지킨다.
  _steer(e, dt, p) {
    if (e.neutral || e.isBoss || e.isMini || e.phased || !e.speed) return;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;

    // 산개: 메테오 예고 반경 안이면 탈출이 최우선 — 광역기가 '조준하는 재미'가 된다
    for (const m of this.meteors) {
      if (m.t > 0) {
        const md = Math.hypot(e.x - m.x, e.y - m.y);
        if (md < m.r + 10) {
          World.moveEntity(e, ((e.x - m.x) / (md || 1)) * e.speed * 0.9 * dt, ((e.y - m.y) / (md || 1)) * e.speed * 0.9 * dt);
          return;
        }
      }
    }

    const role = enemyRole(e);
    if (!e._flank) e._flank = (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.5);
    const tx = -dy / d, ty = dx / d; // 접선 방향

    if (role === 'melee' && d > 140 && d < 420) {
      // 협공: 접근 궤적을 옆으로 벌린다 — 전원이 한 방향에서 몰리지 않게 (도착 각도가 갈라진다)
      World.moveEntity(e, tx * e.speed * 0.35 * e._flank * dt, ty * e.speed * 0.35 * e._flank * dt);
    } else if (role === 'shoot' && d > 150 && d < 480 && this.bb && this.bb.meleeEngaged >= 1) {
      // 재배치: 아군 돌격조가 플레이어와 붙었으면 측면으로 — 사선이 분산된다
      World.moveEntity(e, tx * e.speed * 0.4 * e._flank * dt, ty * e.speed * 0.4 * e._flank * dt);
    } else if (role === 'support' && d < 200) {
      // 지원(강령술사·주술사): 플레이어에게서 물러나 아군 뒤에 숨는다
      World.moveEntity(e, (-dx / d) * e.speed * 0.5 * dt, (-dy / d) * e.speed * 0.5 * dt);
    }
  },

  _tickPlay(dt) {
    // 완벽 회피 슬로모 — 세계가 0.35배로 늘어진다 (보상의 손맛)
    if (this.slowmoT > 0) {
      this.slowmoT -= dt;
      dt *= 0.35;
    }
    if (Input.pressed('KeyM')) {
      AudioSys.toggleMute();
      Meta.data.muted = AudioSys.muted;
      Meta.save();
    }

    // 획득 목록 (Tab) — 열려 있는 동안 게임 정지
    if (Input.pressed('Tab')) {
      this.showInventory = !this.showInventory;
      AudioSys.pickup();
    }
    if (this.showInventory) {
      if (Input.pressed('Escape', 'KeyP')) this.showInventory = false;
      return;
    }

    // 매뉴얼 (H 또는 /) — 게임 중 언제든: 1페이지(조작·전투) → 2페이지(던전·성장) → 닫기
    // 테스트 모드에서 H는 회복 치트와 겹치므로 /만 사용
    if (Input.pressed('Slash') || (Input.pressed('KeyH') && !this.testMode)) {
      this.showManual = ((this.showManual || 0) + 1) % 3;
      AudioSys.pickup();
    }
    if (this.showManual) {
      if (Input.pressed('Escape', 'KeyP')) this.showManual = 0;
      return; // 매뉴얼이 열려 있는 동안 게임 정지
    }

    // 일시정지 (Q로 런 포기 가능)
    if (Input.pressed('Escape', 'KeyP')) {
      this.paused = !this.paused;
      AudioSys.pickup();
    }
    if (this.paused) {
      if (Input.pressed('KeyQ')) {
        this.paused = false;
        this.gaveUp = true;
        this.endRun(false);
        this.state = 'over';
        AudioSys.gameover();
      }
      return;
    }

    // 테스트 모드 치트
    if (this.testMode) {
      this._tickCheats();
      if (this.state !== 'play') return; // 층 이동/승리로 상태가 바뀌었으면 중단
    }

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }

    this.time += dt;
    if (this.vignette > 0) this.vignette -= dt * 1.5;
    if (this.critFlash > 0) this.critFlash -= dt * 3;
    if (this.hurtFlash > 0) this.hurtFlash -= dt * 2;
    if (this.pdodgeFlash > 0) this.pdodgeFlash -= dt * 1.5; // 완벽 회피 청록 섬광

    // 교착 방지 실드: 벽 안에 갇힌 적(벽 통과 이동의 잔재 등)을 2초마다 유효 위치로 재소환
    this._wallCheckT = (this._wallCheckT || 0) + dt;
    if (this._wallCheckT > 2) {
      this._wallCheckT = 0;
      for (const e of this.enemies) {
        if (e.dead || e.neutral || e.isBoss || e.phased) continue;
        if (World.isSolidAt(e.x, e.y)) {
          const pos = World.randomSpawnPos(this.player, 120);
          e.x = pos.x;
          e.y = pos.y;
          e.spawnT = 0.35;
        }
      }
    }
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }

    // 보스 보상 지연 타이머
    if (this.bossRewardT > 0) {
      this.bossRewardT -= dt;
      if (this.bossRewardT <= 0) {
        this.openRelicChoice();
        return;
      }
    }

    if (window.__demoBot) window.__demoBot(this, dt);

    this.player.update(dt, this);

    // ── 환경 위험: 용암 / 독 안개 / 불길 장판 ──
    const p = this.player;
    if (!World.inFog(p.x, p.y) && p._fogT > 0) p._fogT = Math.max(0, p._fogT - dt * 2); // 안개 밖: 유예 회복
    if (p.invuln <= 0 && p.dashTimer <= 0) {
      if (World.isLavaAt(p.x, p.y + 10)) {
        this.hurtPlayer(1, { x: 0, y: -1 }, 180, '용암');
        Particles.text(p.x, p.y - 28, '용암!', { color: '#ff7043', size: 13 });
      } else if (World.inFog(p.x, p.y)) {
        // 유예: 스쳐 지나가는 건 안전 — 0.5초 이상 머물러야 독이 스며든다 (2층 절벽 완화)
        p._fogT = (p._fogT || 0) + dt;
        if (p._fogT > 0.5) {
          this.hurtPlayer(1, { x: 0, y: 0 }, 60, '독 안개');
          Particles.text(p.x, p.y - 28, '독!', { color: '#6ab04c', size: 13 });
        } else if (Math.random() < 0.2) {
          Particles.burst(p.x, p.y - 8, { count: 1, colors: ['#6ab04c'], speed: 25, life: 0.3, size: 2, gravity: -80 });
        }
      } else {
        for (const fp of this.firePatches) {
          if (Math.hypot(p.x - fp.x, p.y - fp.y) < fp.r) {
            if (fp.kind === 'ice') {
              p.slowT = Math.max(p.slowT, 0.35); // 빙판: 피해 없이 미끄러운 감속
            } else {
              this.hurtPlayer(1, { x: 0, y: 0 }, 60, '불길');
              break;
            }
          }
        }
      }
    }

    // ── 스폰 ──
    for (let i = this.pendingSpawns.length - 1; i >= 0; i--) {
      const s = this.pendingSpawns[i];
      s.delay -= dt;
      if (s.delay <= 0) {
        const pos = World.randomSpawnPos(this.player);
        this.markers.push({ x: pos.x, y: pos.y, type: s.type, elite: s.elite, mini: s.mini, t: s.mini ? 1.1 : 0.7 });
        this.pendingSpawns.splice(i, 1);
      }
    }
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const m = this.markers[i];
      m.t -= dt;
      if (m.t <= 0) {
        const e = m.mini
          ? createMiniboss(m.type, m.x, m.y, this.enemyHpMul())
          : createEnemy(m.type, m.x, m.y, m.elite, this.enemyHpMul());
        e.speed *= Math.min(1.3, 1 + 0.02 * (Dungeon.floor - 1)); // 층당 +2%, 상한 +30% (무한 모드)
        if (this.heat >= 3) e.speed *= 1.15;
        this.enemies.push(e);
        if (m.mini) {
          this.banner = { text: `⚠ ${e.miniName} 출현!`, life: 1.8, maxLife: 1.8, color: '#e43b44' };
          AudioSys.roar();
          Renderer.shake(4, 0.3);
          Particles.ring(m.x, m.y, { r0: 8, r1: 70, life: 0.4, color: '#e43b44', width: 4 });
        }
        Particles.burst(m.x, m.y, { count: m.mini ? 16 : 8, colors: ['#5c1e5e', '#8a3a8c'], speed: 90, life: 0.35, size: 3 });
        this.markers.splice(i, 1);
      }
    }

    // ── 사망 연출 잔상 수명 ──
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      this.corpses[i].t += dt;
      if (this.corpses[i].t >= this.corpses[i].dur) this.corpses.splice(i, 1);
    }

    // ── 전장 정보(blackboard) — 개체 AI가 읽는 공용 데이터 (AI 고도화) ──
    // 플레이어 이동 속도 추정(스무딩·대시 스파이크 클램프): 예측 사격이 읽는다
    if (!this._bbPrev) this._bbPrev = { x: p.x, y: p.y };
    {
      const rvx = (p.x - this._bbPrev.x) / Math.max(dt, 1e-4);
      const rvy = (p.y - this._bbPrev.y) / Math.max(dt, 1e-4);
      let pvx = (this.bb ? this.bb.pvx : 0) * 0.8 + rvx * 0.2;
      let pvy = (this.bb ? this.bb.pvy : 0) * 0.8 + rvy * 0.2;
      const pv = Math.hypot(pvx, pvy);
      if (pv > 240) { pvx *= 240 / pv; pvy *= 240 / pv; }
      let engaged = 0;
      for (const e of this.enemies) {
        if (!e.dead && !e.neutral && enemyRole(e) === 'melee' && Math.hypot(e.x - p.x, e.y - p.y) < 95) engaged++;
      }
      this.bb = { pvx, pvy, meleeEngaged: engaged };
      this._bbPrev = { x: p.x, y: p.y };
    }

    // ── 적 갱신 + 상태이상 ──
    for (const e of this.enemies) {
      if (e.dead) continue;
      // 등장 연출 중에는 행동하지 않는다 (플레이어 공격은 가능)
      if (e.spawnT > 0) {
        e.spawnT -= dt;
        e.animT += dt;
        continue;
      }
      if (e.status.burn > 0) {
        e.status.burn -= dt;
        e.status.burnTick -= dt;
        if (e.status.burnTick <= 0) {
          e.status.burnTick = p.flags.inferno ? 0.25 : 0.5;
          this.damageEnemy(e, 1, { x: 0, y: -0.3 }, { feel: false, kb: 0, color: '#ff7043' });
        }
      }
      if (!e.dead && e.status.poison > 0) {
        e.status.poison -= dt;
        e.status.poisonTick -= dt;
        if (e.status.poisonTick <= 0) {
          e.status.poisonTick = 1.0;
          this.damageEnemy(e, 1, { x: 0, y: -0.3 }, { feel: false, kb: 0, color: '#6ab04c' });
        }
      }
      if (e.status.shock > 0) e.status.shock -= dt;
      if (!e.dead) e.update(dt, this);
      if (!e.dead) this._steer(e, dt, p);
    }
    this.enemies = this.enemies.filter((e) => !e.dead);

    // ── 장판 (적 피해: 감전/독구름) ──
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.life -= dt;
      if (z.life <= 0) { this.zones.splice(i, 1); continue; }
      if (z.kind === 'poison' || z.kind === 'fire') {
        z.tickT -= dt;
        if (z.tickT <= 0) {
          z.tickT = 0.8;
          for (const e of this.enemies) {
            if (e.dead || e.phased) continue;
            if (Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) {
              if (z.kind === 'poison') e.status.poison = Math.max(e.status.poison, 1.5);
              else e.status.burn = Math.max(e.status.burn, 1.2);
              this.damageEnemy(e, 1, { x: 0, y: 0 }, { feel: false, kb: 0, color: z.kind === 'poison' ? '#6ab04c' : '#ff7043' });
            }
          }
        }
      } else {
        for (const e of this.enemies) {
          if (e.dead || e.phased || z.hit.has(e)) continue;
          if (Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) {
            z.hit.add(e);
            e.status.shock = 2;
            this.damageEnemy(e, 1, { x: 0, y: 0 }, { feel: false, kb: 0, color: '#ffd866' });
          }
        }
      }
    }

    // ── 불길/독 장판 수명 (플레이어 피해는 위에서) ──
    for (let i = this.firePatches.length - 1; i >= 0; i--) {
      const fp = this.firePatches[i];
      fp.life -= dt;
      if (fp.life <= 0) this.firePatches.splice(i, 1);
    }

    // ── 가시 함정 (맵 M2): 예열(빛남) → 솟음 — 편을 가리지 않는다. 적을 함정 위로 유인하라 ──
    for (const tr of (this.traps || [])) {
      tr.t += dt;
      if (tr.state === 'idle' && tr.t > 2.2) {
        tr.state = 'arm'; tr.t = 0;
      } else if (tr.state === 'arm' && tr.t > 0.6) {
        tr.state = 'up'; tr.t = 0; tr.hit = new Set();
        AudioSys.thud();
        Particles.burst(tr.x, tr.y, { count: 5, colors: ['#c8d4e4', '#8a9ab4'], speed: 90, life: 0.25, size: 2, gravity: -80 });
      } else if (tr.state === 'up') {
        if (!tr.hit.has('p') && Math.hypot(p.x - tr.x, p.y - tr.y) < 22 + p.r) {
          tr.hit.add('p');
          this.hurtPlayer(1, { x: 0, y: -1 }, 140, '가시 함정');
        }
        for (const e of this.enemies) {
          if (e.dead || e.neutral || e.phased || e.isBoss || tr.hit.has(e)) continue;
          if (Math.hypot(e.x - tr.x, e.y - tr.y) < 22 + e.r) {
            tr.hit.add(e);
            this.damageEnemy(e, 2, { x: 0, y: 0 }, { feel: false, kb: 0, color: '#c8d4e4' });
          }
        }
        if (tr.t > 0.35) { tr.state = 'idle'; tr.t = 0; }
      }
    }

    // ── 충격파 링 ──
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.r += ring.speed * dt;
      const pd = Math.hypot(p.x - ring.x, p.y - ring.y);
      if (Math.abs(pd - ring.r) < ring.width) {
        // 무적 중이어도 hurtPlayer로 — 대시 관통 시 완벽 회피 판정이 살아난다
        const dir = { x: (p.x - ring.x) / (pd || 1), y: (p.y - ring.y) / (pd || 1) };
        this.hurtPlayer(ring.dmg, dir, 300);
      }
      if (ring.r > ring.maxR) this.rings.splice(i, 1);
    }

    // ── 투사체 ──
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.life -= dt;
      a.t += dt;
      // 추적탄 (공허의 눈): 플레이어를 향해 천천히 선회 — 직각으로 대시하면 뿌리칠 수 있다
      if (a.homing) {
        const cur = Math.atan2(a.dir.y, a.dir.x);
        const tgt = Math.atan2(p.y - a.y, p.x - a.x);
        let diff = tgt - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const na = cur + Math.sign(diff) * Math.min(Math.abs(diff), 2.1 * dt);
        a.dir = { x: Math.cos(na), y: Math.sin(na) };
      }
      let vx = a.dir.x, vy = a.dir.y;
      if (PROJ_STYLES[a.kind]?.wavy) {
        const wave = Math.sin(a.t * 9) * 0.35;
        vx += -a.dir.y * wave;
        vy += a.dir.x * wave;
      }
      a.x += vx * a.speed * dt;
      a.y += vy * a.speed * dt;
      const pdist = Math.hypot(p.x - a.x, p.y - a.y);
      if (p.invuln > 0) {
        // 대시 무적 중 스치는 탄(+12px 그레이즈) = 완벽 회피 판정 — 탄은 그대로 지나간다
        if (a.dmg > 0 && pdist < p.r + a.r + 12) this.hurtPlayer(a.dmg, a.dir);
      } else if (pdist < p.r + a.r) {
        if (a.slow > 0) {
          p.slowT = Math.max(p.slowT, a.slow);
          Particles.text(p.x, p.y - 26, '끈적!', { color: '#e8e0cf', size: 13 });
          Particles.burst(p.x, p.y, { count: 6, colors: ['#e8e0cf'], speed: 60, life: 0.3, size: 2 });
        }
        if (a.dmg > 0) this.hurtPlayer(a.dmg, a.dir);
        this.arrows.splice(i, 1);
        continue;
      }
      const hitWall = (a.kind === 'arrow' || a.kind === 'rock' || a.kind === 'web' || a.kind === 'fire') && World.isSolidAt(a.x, a.y);
      if (a.life <= 0 || hitWall) {
        if (PROJ_STYLES[a.kind]?.patchOnEnd) {
          this.firePatches.push({ x: a.x, y: a.y, r: 34, life: 2.0, kind: 'fire' });
        }
        Particles.burst(a.x, a.y, {
          count: 4, colors: [PROJ_STYLES[a.kind]?.color || '#a99e8c'], speed: 70, life: 0.25, size: 2,
        });
        this.arrows.splice(i, 1);
      }
    }

    for (let i = this.bossSlashes.length - 1; i >= 0; i--) {
      this.bossSlashes[i].life -= dt;
      if (this.bossSlashes[i].life <= 0) this.bossSlashes.splice(i, 1);
    }

    // ── 플레이어 투사체 (궁수 화살 / 마도사 유도 마탄) ──
    for (let i = this.pbolts.length - 1; i >= 0; i--) {
      const b = this.pbolts[i];
      b.life -= dt;

      // 유도: 가장 가까운 적을 향해 선회
      if (b.homing) {
        let target = null;
        let best = 280;
        for (const e of this.enemies) {
          if (e.dead || e.phased) continue;
          const ed = Math.hypot(e.x - b.x, e.y - b.y);
          if (ed < best) { best = ed; target = e; }
        }
        if (target) {
          const want = Math.atan2(target.y - b.y, target.x - b.x);
          let cur = Math.atan2(b.dir.y, b.dir.x);
          let diff = want - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          cur += Math.sign(diff) * Math.min(Math.abs(diff), b.homing * dt);
          b.dir = { x: Math.cos(cur), y: Math.sin(cur) };
        }
      }

      b.x += b.dir.x * b.speed * dt;
      b.y += b.dir.y * b.speed * dt;

      // 마탄 잔광
      if (b.kind === 'pbolt' && Math.random() < 0.5) {
        Particles.burst(b.x, b.y, { count: 1, colors: ['#c56cf0', '#8a5ac2'], speed: 12, life: 0.25, size: 2 });
      }

      let remove = b.life <= 0 || World.isSolidAt(b.x, b.y);
      // 도탄 (특성): 벽에서 한 번 튕긴다 — 막힌 축만 반사
      if (remove && b.life > 0 && b.bounces > 0) {
        b.bounces--;
        const hitX = World.isSolidAt(b.x, b.y - b.dir.y * 9);
        const hitY = World.isSolidAt(b.x - b.dir.x * 9, b.y);
        if (hitX) b.dir.x *= -1;
        if (hitY) b.dir.y *= -1;
        if (!hitX && !hitY) { b.dir.x *= -1; b.dir.y *= -1; }
        b.x += b.dir.x * 12;
        b.y += b.dir.y * 12;
        b.hit = new Set(); // 튕긴 화살은 같은 적을 다시 맞힐 수 있다
        Particles.burst(b.x, b.y, { count: 3, colors: ['#ffd866', '#ffffff'], speed: 70, life: 0.2, size: 2 });
        remove = false;
      }
      // 벽에 맞은 투사체가 균열 벽이면 균열에 피해 — 원거리 직업도 비밀 벽감을 열 수 있다
      if (remove && b.life > 0) {
        const crack = this.enemies.find((e) => e.type === 'crack' && !e.dead &&
          Math.abs(e.x - b.x) < TS * 0.8 && Math.abs(e.y - b.y) < TS * 0.8);
        if (crack) this.damageEnemy(crack, 1, b.dir || { x: 1, y: 0 }, { feel: false });
      }
      if (!remove) {
        for (const e of this.enemies) {
          if (e.dead || e.phased || b.hit.has(e)) continue;
          if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 7) {
            b.hit.add(e);
            const res = p.strike(this, e, { ...b.dir }, {
              finisher: b.finisher,
              kb: b.finisher ? 300 : 170,
            });
            if (b.aoe) {
              this._explode(b.x, b.y, b.aoe, Math.max(1, Math.ceil(p.currentAtk() * 0.6)), ['#8a5ac2', '#c56cf0', '#ffd866'], '#c56cf0'); // 파이어볼 폭발 하향 (리그 +79%→목표 ~45%)
            }
            if (res === 'blocked' || !b.pierce) remove = true;
            break;
          }
        }
      }
      if (remove) {
        if (b.aoe && b.hit.size === 0) {
          // 벽에 맞아도 대마탄은 폭발
          this._explode(b.x, b.y, b.aoe, Math.max(1, Math.ceil(p.currentAtk() * 0.6)), ['#8a5ac2', '#c56cf0', '#ffd866'], '#c56cf0'); // 파이어볼 폭발 하향 (리그 +79%→목표 ~45%)
        }
        Particles.burst(b.x, b.y, {
          count: 4,
          colors: b.kind === 'pbolt' ? ['#c56cf0'] : ['#d9cbb8'],
          speed: 70, life: 0.25, size: 2,
        });
        this.pbolts.splice(i, 1);
      }
    }

    // ── 궁수 스킬: 화살비 ──
    for (let i = this.rains.length - 1; i >= 0; i--) {
      const r = this.rains[i];
      r.t += dt;
      if (r.fired < r.shots) {
        r.next -= dt;
        if (r.next <= 0) {
          r.next = 0.08;
          r.fired++;
          const a = Math.random() * Math.PI * 2;
          const rr = Math.sqrt(Math.random()) * r.r * 0.9;
          const ix = r.x + Math.cos(a) * rr;
          const iy = r.y + Math.sin(a) * rr;
          AudioSys.rainHit();
          Particles.burst(ix, iy, { count: 5, colors: ['#d9cbb8', '#38b764'], speed: 90, life: 0.25, size: 2 });
          Particles.ring(ix, iy, { r0: 3, r1: 20, life: 0.18, color: '#d9cbb8', width: 2 });
          for (const e of this.enemies) {
            if (e.dead || e.phased) continue;
            const dd = Math.hypot(e.x - ix, e.y - iy);
            if (dd < 30 + e.r) {
              p.strike(this, e, { x: (e.x - ix) / (dd || 1), y: (e.y - iy) / (dd || 1) }, { kb: 130 });
              if (!e.dead) e.status.shock = Math.max(e.status.shock, 0.9); // 화살비 지역 장악: 잠깐 감속
            }
          }
          if (r.explo) {
            this._explode(ix, iy, 36, 2, ['#38b764', '#ffd866'], '#38b764'); // 폭발 화살비 상향
          }
        }
      } else if (r.t > 2) {
        this.rains.splice(i, 1);
      }
    }

    // ── 마도사 스킬: 메테오 ──
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.t -= dt;
      if (m.t <= 0) {
        Renderer.shake(6, 0.3);
        this.hitstop = Math.max(this.hitstop, 0.07);
        AudioSys.meteorImpact();
        Particles.burst(m.x, m.y, { count: 26, colors: ['#ff7043', '#ffd866', '#e25822'], speed: 240, life: 0.5, size: 4, gravity: 150 });
        Particles.ring(m.x, m.y, { r0: 10, r1: m.r, life: 0.35, color: '#ff7043', width: 6 });
        Particles.ring(m.x, m.y, { r0: 6, r1: m.r * 0.6, life: 0.25, color: '#fff7c0', width: 3 });
        Particles.star(m.x, m.y, { size: 40, color: '#ffd866' });
        for (const e of this.enemies) {
          if (e.dead || e.phased) continue;
          const dd = Math.hypot(e.x - m.x, e.y - m.y);
          if (dd < m.r + e.r) {
            const dir = { x: (e.x - m.x) / (dd || 1), y: (e.y - m.y) / (dd || 1) };
            const dmg = p.currentAtk() * 4;
            const crit = p.rflags.allcrit || Math.random() < Math.min(0.8, p.critChance);
            this.hitEnemy(e, crit ? Math.round(dmg * p.critMul) : dmg, dir, { crit, kb: 320 });
            if (!e.dead) e.status.burn = Math.max(e.status.burn, p.flags.inferno ? 4 : 2);
          }
        }
        if (p.flags.mg_ash) {
          this.zones.push({ x: m.x, y: m.y, r: 70, life: 5, kind: 'fire', tickT: 0.4, hit: null }); // 잿불 지대 상향
        }
        this.meteors.splice(i, 1);
      }
    }

    // ── XP 보석 ──
    const magnetR = (this.roomCleared || p.rflags.magnetall) ? 9999 : 95 * p.magnetMul;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      const dx = p.x - o.x, dy = p.y - o.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < magnetR) {
        const pull = 900 * dt;
        o.vx += (dx / d) * pull;
        o.vy += (dy / d) * pull;
      }
      o.vx *= Math.pow(0.1, dt);
      o.vy *= Math.pow(0.1, dt);
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (d < p.r + 8) {
        this.orbs.splice(i, 1);
        AudioSys.orb();
        this.gainXp(o.val);
        if (this.state !== 'play') return;
      }
    }

    // ── 하트 픽업 ──
    const heartMagnet = p.rflags.magnetall ? 9999 : 0;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.t += dt;
      if (heartMagnet > 0) {
        const dx = p.x - pk.x, dy = p.y - pk.y;
        const d = Math.hypot(dx, dy) || 1;
        pk.x += (dx / d) * 250 * dt;
        pk.y += (dy / d) * 250 * dt;
      }
      if (Math.hypot(p.x - pk.x, p.y - pk.y) < p.r + pk.r) {
        if (p.hp < p.maxHp) p.hp++;
        AudioSys.pickup();
        Particles.burst(pk.x, pk.y, { count: 8, colors: ['#e43b44', '#f5817e'], speed: 100, life: 0.4, size: 3 });
        this.pickups.splice(i, 1);
      }
    }

    // ── 상자 / 모닥불 ──
    for (const it of this.interactables) {
      it.t += dt;
      if (it.used) continue;
      if (Math.hypot(p.x - it.x, p.y - it.y) < p.r + it.r) {
        it.used = true;
        if (it.kind === 'chest') {
          Renderer.shake(2, 0.1);
          // 보물상자: 유물 1개 (루트의 도파민!)
          const rolled = rollRelics(p, 1, false);
          if (rolled.length > 0) {
            this.acquireRelic(rolled[0]);
          } else {
            AudioSys.chest();
          }
          for (let k = 0; k < 5; k++) {
            const a = Math.random() * Math.PI * 2;
            this.orbs.push({ x: it.x, y: it.y, val: 3, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160 - 60 });
          }
          Particles.burst(it.x, it.y - 10, { count: 14, colors: ['#f7b32b', '#ffd866'], speed: 150, life: 0.5, size: 3, gravity: 200 });
        } else if (it.kind === 'camp') {
          AudioSys.pickup();
          const heal = this.heat >= 4 ? 1 : 2; // 열기 4: 모닥불 회복 감소
          p.hp = Math.min(p.maxHp, p.hp + heal);
          Particles.text(p.x, p.y - 28, '+' + heal, { color: '#e43b44', size: 18 });
          Particles.burst(it.x, it.y, { count: 12, colors: ['#ff7043', '#ffd866'], speed: 80, life: 0.6, size: 3, gravity: -120 });
          for (const o of this.interactables) if (o.kind === 'whetstone') o.used = true; // 양자택일
        } else if (it.kind === 'whetstone') {
          // 담금질: 이번 층 동안 공격력 +1 (풀피일 때 모닥불의 가치)
          p.floorAtk = (p.floorAtk || 0) + 1;
          this.banner = { text: '담금질 — 이번 층 공격력 +1', life: 1.8, maxLife: 1.8, color: '#ffd866' };
          AudioSys.crit();
          Particles.burst(it.x, it.y, { count: 14, colors: ['#ffd866', '#c8d4e4'], speed: 110, life: 0.5, size: 3 });
          Particles.text(p.x, p.y - 30, '공격력 +1', { color: '#ffd866', size: 15 });
          for (const o of this.interactables) if (o.kind === 'camp') o.used = true; // 양자택일
        } else if (it.kind === 'mystery') {
          // 미지의 기연: 수락하는 순간 정체가 드러난다 (60% 순이익 / 25% 대가 있는 이익 / 15% 손해)
          const roll = Math.random();
          this.hurtFlash = 0.15;
          Renderer.shake(4, 0.25);
          Particles.burst(it.x, it.y, { count: 20, colors: ['#b13ae0', '#ffd866', '#241832'], speed: 160, life: 0.5, size: 3 });
          if (roll < 0.25) {
            const rolled = rollRelics(p, 1, false);
            if (rolled.length > 0) this.acquireRelic(rolled[0]);
            else { Meta.data.shards += 40; Meta.save(); Particles.text(p.x, p.y - 30, '◆ +40', { color: '#2ec4b6', size: 15 }); }
            this.banner = { text: '기연 — 잠들어 있던 유물을 얻었다!', life: 2.0, maxLife: 2.0, color: '#f7b32b' };
          } else if (roll < 0.40) {
            p.bonusAtk += 1;
            this.banner = { text: '기연 — 힘이 깃든다 (공격력 +1)', life: 2.0, maxLife: 2.0, color: '#ffd866' };
            AudioSys.crit();
          } else if (roll < 0.55) {
            p.maxHp += 1; p.hp = Math.min(p.maxHp, p.hp + 1);
            this.banner = { text: '기연 — 생명력이 차오른다 (최대 HP +1)', life: 2.0, maxLife: 2.0, color: '#e43b44' };
            AudioSys.pickup();
          } else if (roll < 0.60) {
            const bonus = 30 + Dungeon.floor * 3;
            Meta.data.shards += bonus; Meta.save();
            Particles.text(p.x, p.y - 30, `◆ +${bonus}`, { color: '#2ec4b6', size: 16 });
            this.banner = { text: '기연 — 영혼 파편이 쏟아진다!', life: 2.0, maxLife: 2.0, color: '#2ec4b6' };
            AudioSys.buy();
          } else if (roll < 0.85) {
            // 대가 있는 이익: 저주받은 유물 (유물 풀 고갈 시 파편으로 대체 — 보상 없는 저주 방지)
            const rolled = rollRelics(p, 1, false);
            if (rolled.length > 0) {
              this.acquireRelic(rolled[0]);
              p.maxHp = Math.max(2, p.maxHp - 1); // 도박 저주는 하한 2 — 선택한 적 없는 1칸 인생 방지
              p.hp = Math.min(p.hp, p.maxHp);
              this.banner = { text: '기연 — 유물을 얻었지만... 저주가 스며든다 (최대 HP -1)', life: 2.2, maxLife: 2.2, color: '#b13ae0' };
              AudioSys.hurt();
            } else {
              Meta.data.shards += 40; Meta.save();
              Particles.text(p.x, p.y - 30, '◆ +40', { color: '#2ec4b6', size: 15 });
              this.banner = { text: '기연 — 영혼 파편을 얻었다', life: 1.8, maxLife: 1.8, color: '#2ec4b6' };
            }
          } else {
            // 손해: 피의 대가 (한도: HP 1까지만)
            p.hp = Math.max(1, p.hp - 2);
            this.banner = { text: '기연 — 함정이었다! (HP -2)', life: 2.0, maxLife: 2.0, color: '#e43b44' };
            this.hurtFlash = 0.22;
            AudioSys.hurt();
          }
        } else if (it.kind === 'cursedChest') {
          // 저주받은 상자: 유물 +1, 최대 HP -1
          const rolled = rollRelics(p, 1, false);
          if (rolled.length > 0) this.acquireRelic(rolled[0]);
          p.maxHp = Math.max(1, p.maxHp - 1);
          p.hp = Math.min(p.hp, p.maxHp);
          this.banner = { text: '저주가 스며든다... (최대 HP -1)', life: 2.0, maxLife: 2.0, color: '#b13ae0' };
          this.hurtFlash = 0.18;
          AudioSys.hurt();
          Renderer.shake(4, 0.25);
          Particles.burst(it.x, it.y, { count: 18, colors: ['#b13ae0', '#241832', '#f7b32b'], speed: 150, life: 0.5, size: 3 });
        } else if (it.kind === 'bloodAltar') {
          // 피의 제단: HP 2를 바치고 공격력 +1 (HP 3 미만이면 거부)
          if (p.hp < 3) {
            it.used = false; // 소모되지 않음 — 회복하고 다시 올 수 있다
            if (!it._deniedT || it.t - it._deniedT > 1.5) {
              it._deniedT = it.t;
              Particles.text(p.x, p.y - 28, '피가 부족하다...', { color: '#8a1c2c', size: 13 });
              AudioSys.deny();
            }
          } else {
            p.hp -= 2;
            p.bonusAtk += 1;
            this.banner = { text: '피의 계약 — 공격력 +1', life: 2.0, maxLife: 2.0, color: '#e43b44' };
            this.hurtFlash = 0.2;
            AudioSys.crit();
            Renderer.shake(5, 0.3);
            Particles.burst(it.x, it.y, { count: 20, colors: ['#e43b44', '#8a1c2c', '#ffd866'], speed: 170, life: 0.5, size: 3 });
            Particles.text(p.x, p.y - 30, '공격력 +1', { color: '#ffd866', size: 16 });
          }
        }
      }
    }

    Particles.update(dt);

    // ── 방 클리어 ── (항아리·균열 벽 같은 중립 개체는 남아 있어도 클리어)
    if (!this.roomCleared &&
        this.enemies.every((e) => e.neutral) && this.markers.length === 0 && this.pendingSpawns.length === 0 &&
        this.bossRewardT <= 0 && this.state === 'play') {
      // 습격방 (맵 M4): 파도가 남았으면 클리어 대신 다음 파도가 밀려온다
      if (this._siege && this._siege.wave < this._siege.total) {
        this._siege.wave++;
        Dungeon.siegeWave(this._siege.wave).forEach((s, i) => {
          this.pendingSpawns.push({ delay: 0.8 + i * 0.25, type: s.type, elite: s.elite });
        });
        this.banner = { text: `파도 ${this._siege.wave} / ${this._siege.total}`, life: 1.6, maxLife: 1.6, color: '#e43b44' };
        AudioSys.bossAppear();
        return;
      }
      this.roomCleared = true;
      Meta.save(); // 도감 킬 기록 등 방 단위 저장
      // 습격 완주 보상: 파편 뭉치 + 정예급 특성 선택
      if (this._siege) {
        this._siege = null;
        const bonus = 14 + Dungeon.floor * 2;
        Meta.data.shards += bonus;
        Particles.text(p.x, p.y - 34, `◆ +${bonus}`, { color: '#2ec4b6', size: 16 });
        this.banner = { text: '습격을 버텨냈다!', life: 1.8, maxLife: 1.8, color: '#ffd866' };
        this.pendingChoices++;
        this.openTraitChoice('elite');
        AudioSys.buy();
      }
      // 문 수식어 보상: 사나운 무리 — 위험을 감수한 만큼 파편으로 돌려준다
      if (this._roomMod && this._roomMod.id === 'horde') {
        const bonus = 10 + Dungeon.floor * 2;
        Meta.data.shards += bonus;
        Particles.text(p.x, p.y - 34, `◆ +${bonus}`, { color: '#2ec4b6', size: 16 });
        AudioSys.buy();
      }
      this._roomMod = null;
      if (p.flags.regen && p.hp < p.maxHp) {
        p.hp++;
        Particles.text(p.x, p.y - 28, '+1', { color: '#e43b44', size: 14 });
      }
      if (Dungeon.roomType !== 'boss') {
        World.openDoors(Dungeon.doorOptions());
        if (Dungeon.roomType === 'elite') {
          this.pendingChoices++;
          this.openTraitChoice('elite');
        }
      }
      // 보스방 클리어 시 문은 유물 선택 후 열림 (_afterBossReward)
    }

    // ── 문 진입 ──
    if (this.roomCleared && World.doorsActive) {
      for (const door of World.doors) {
        if (Math.hypot(p.x - door.x, p.y - door.y) < 30) {
          this.state = 'transition';
          this.transition = { phase: 'out', t: 0, type: door.opt.type, mod: door.opt.mod || null };
          AudioSys.dash();
          break;
        }
      }
    }
  },
};
