// 플레이 상태 프레임 갱신 — 환경 위험/스폰/적/장판/투사체/스킬 이펙트/픽업/방 클리어.
// Game.tick(main.js)이 상태 분기 후 매 프레임 호출한다.

// ── 인간 드라마 AI (M1) — 산 자만이 죽음을 두려워한다 ──
// 왕의 병사는 기계가 아니다: 침입자를 발견하고(!), 동료의 죽음에 무너지고, 도망치고, 항복하고,
// 때로는 거짓 항복으로 배신한다. 늦게 잡으면 전령이 증원을 부른다. 언데드·광신도·정예는 동요하지 않는다.
const HUMAN_FEAR = new Set(['sniper', 'berserker', 'brute', 'bomber', 'frostArcher', 'frostMage',
  'shaman', 'jailer', 'flameJuggler', 'stalker', 'glowShrieker']);
const FORM_UNITS = new Set([...HUMAN_FEAR, 'skeleton', 'shieldSkeleton', 'warden', 'executioner', 'acolyte', 'mirrorKnight']);
const ACT_MORALE = { 1: 0.35, 2: 0.25, 3: 0.18, 4: 0.15, 5: 0.06 }; // 왕좌에 가까울수록 도망치지 않는다
const ROUT_CRY = ['살려줘…!', '도, 도망쳐!', '이건 사람이 아니야!', '괴물이다—!', '왕이고 뭐고…!'];
const SURR_CRY = ['하, 항복이다! 제발…', '살려주시오…!', '집에 아이가 있소…', '자비를…!'];
const AMBUSH_TYPES = new Set(['mimic', 'turret', 'thornPlant']); // 매복형은 원래 행동 유지
// M2: 장교 — 도망치는 부하를 왕법으로 처형한다. 왕의 군대엔 의리가 없다
const OFFICERS = new Set(['executioner', 'warden', 'mirrorKnight']);
const DESERT_CRY = ['난 처음부터 반대였어… 이걸 받아.', '명단을 봤어… 전부 조작이야. 받아 둬.', '너희에게 빚이 있다… 이거라도.'];

// 목표 지향 이동 + 벽 우회 — 탈영병/전령처럼 update()를 쓰지 않는 연출 이동용.
// 직선이 막히면 0.5초간 수직 우회를 섞는다 (진행률로 감지)
function dramaMove(e, tx, ty, spd, dt) {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
  const x0 = e.x, y0 = e.y;
  if (e._detourT > 0) {
    e._detourT -= dt;
    World.moveEntity(e, e._detourX * spd * dt, e._detourY * spd * dt);
  } else {
    World.moveEntity(e, (dx / d) * spd * dt, (dy / d) * spd * dt);
  }
  const moved = Math.hypot(e.x - x0, e.y - y0);
  if (moved < spd * dt * 0.35) {
    e._dStuckT = (e._dStuckT || 0) + dt;
    if (e._dStuckT > 0.2) {
      e._dStuckT = 0;
      e._detourT = 0.5;
      const sgn = Math.random() < 0.5 ? 1 : -1;
      e._detourX = (-dy / d) * sgn;
      e._detourY = (dx / d) * sgn;
    }
  } else {
    e._dStuckT = 0;
  }
  e.flip = dx < 0;
  return d;
}

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

  // ── 왕의 인장기: 피할 수는 있지만 막을 수는 없다 (예고 1.2s+ → 관통 피해 + 낙인) ──
  sigActive() { return (this.sigs || []).length > 0; },

  startSignature(boss, type) {
    if (!this.sigs) this.sigs = [];
    const p = this.player;
    const sig = { type, boss, t: 0, phase: 'tel' };
    if (type === 'halfSweep') {
      sig.tel = 1.35; sig.side = p.x >= World.cols * TS / 2 ? 'R' : 'L'; // 플레이어 쪽 절반을 벤다
      sig.splitX = World.cols * TS / 2;
    } else if (type === 'shieldCharge') {
      sig.tel = 1.25; sig.x0 = boss.x; sig.y0 = boss.y;
      const d = Math.hypot(p.x - boss.x, p.y - boss.y) || 1;
      sig.dir = { x: (p.x - boss.x) / d, y: (p.y - boss.y) / d };
      sig.len = 640;
    } else if (type === 'brandZone') {
      sig.tel = 1.5; sig.lock = 0.45; sig.x = p.x; sig.y = p.y; sig.r = 95;
    } else if (type === 'sanctPulse') {
      sig.tel = 1.5;
      const s = World.safeSpot(p.x + (Math.random() - 0.5) * 260, p.y + (Math.random() - 0.5) * 180);
      sig.sx = s.x; sig.sy = s.y; sig.sr = 96; // 안전지대 한 곳
    } else if (type === 'triCharge') {
      sig.tel = 1.1; sig.dashes = 3; sig.dashN = 0;
    } else if (type === 'kingCross') {
      sig.tel = 1.55; sig.cx = boss.x; sig.cy = boss.y; sig.w = 74; // X자 참격 폭
    } else if (type === 'miniSig') {
      sig.tel = 1.15; sig.x = boss.x; sig.y = boss.y; sig.r = 150;
    }
    this.sigs.push(sig);
    this.sigWarnT = sig.tel;
    this.banner = { text: `⚠ ${boss.name} — 인장기!`, life: 1.4, maxLife: 1.4, color: '#e43b44' };
    AudioSys.roar();
    Renderer.shake(3, 0.3);
  },

  // 인장기 관통 명중 — 보호막을 뚫고 하트 2 + 낙인 5초 (대시 무적은 존중: 피할 수 있다)
  _sigHit(sig, dmg = 2) {
    const p = this.player;
    if (p.invuln > 0 || p.god) return; // 회피 성공
    p.brandT = Meta.lvl('b_brand') > 0 ? 3 : 5; // 깨어진 비석 「낙인 무딤」
    const hadShield = p.shield;
    p.shield = false; // 보호막 관통
    this.hurtPlayer(dmg, { x: 0, y: -0.6 }, 320, (sig.boss && sig.boss.name) || '인장기');
    Particles.text(p.x, p.y - 44, hadShield ? '관통! 낙인 — 5초간 회복 불가' : '낙인 — 5초간 회복 불가', { color: '#e43b44', size: 13 });
  },

  _tickSignatures(dt) {
    if (!this.sigs || !this.sigs.length) return;
    const p = this.player;
    for (let i = this.sigs.length - 1; i >= 0; i--) {
      const s = this.sigs[i];
      s.t += dt;
      if (s.type === 'brandZone' && s.t < s.tel) { // 낙인진은 발밑을 따라온다 (마지막 0.45s 고정)
        if (s.t < s.tel - s.lock) { s.x += (p.x - s.x) * Math.min(1, dt * 3.2); s.y += (p.y - s.y) * Math.min(1, dt * 3.2); }
        continue;
      }
      if (s.t < s.tel) continue;
      // ── 발동 ──
      Renderer.shake(6, 0.35);
      AudioSys.meteorImpact();
      if (s.type === 'halfSweep') {
        const inHalf = s.side === 'R' ? p.x >= s.splitX : p.x < s.splitX;
        Particles.ring(s.splitX, World.rows * TS / 2, { r0: 30, r1: 400, life: 0.5, color: '#e43b44', width: 8 });
        if (inHalf) this._sigHit(s);
        this.sigs.splice(i, 1);
      } else if (s.type === 'shieldCharge') {
        const b = s.boss;
        // 경로 캡슐 판정 + 보스 순간 돌진
        const tx = s.x0 + s.dir.x * s.len, ty = s.y0 + s.dir.y * s.len;
        const px = p.x - s.x0, py = p.y - s.y0;
        const tproj = Math.max(0, Math.min(s.len, px * s.dir.x + py * s.dir.y));
        const perp = Math.hypot(px - s.dir.x * tproj, py - s.dir.y * tproj);
        if (perp < 62 + p.r) this._sigHit(s, 1); // 방패 파쇄: 하트 1 + 보호막 파괴
        if (b && !b.dead) { const e2 = World.safeSpot(tx, ty); b.x = e2.x; b.y = e2.y; }
        Particles.burst((s.x0 + tx) / 2, (s.y0 + ty) / 2, { count: 24, colors: ['#e43b44', '#c8ccd8'], speed: 260, life: 0.5, size: 4 });
        this.sigs.splice(i, 1);
      } else if (s.type === 'brandZone') {
        if (Math.hypot(p.x - s.x, p.y - s.y) < s.r + p.r) this._sigHit(s);
        Particles.ring(s.x, s.y, { r0: 10, r1: s.r, life: 0.4, color: '#e43b44', width: 6 });
        this.sigs.splice(i, 1);
      } else if (s.type === 'sanctPulse') {
        if (Math.hypot(p.x - s.sx, p.y - s.sy) > s.sr) this._sigHit(s);
        Particles.ring(s.sx, s.sy, { r0: s.sr, r1: 500, life: 0.5, color: '#f7b32b', width: 7 });
        this.sigs.splice(i, 1);
      } else if (s.type === 'triCharge') {
        const b = s.boss;
        s.dashN++;
        if (b && !b.dead) {
          const d = Math.hypot(p.x - b.x, p.y - b.y) || 1;
          const dir = { x: (p.x - b.x) / d, y: (p.y - b.y) / d };
          const dest = World.safeSpot(b.x + dir.x * Math.min(420, d + 60), b.y + dir.y * Math.min(420, d + 60));
          // 경로 판정 — 셋째 창격만 관통, 1·2타는 일반 피해
          const len2 = Math.hypot(dest.x - b.x, dest.y - b.y) || 1;
          const ux = (dest.x - b.x) / len2, uy = (dest.y - b.y) / len2;
          const px = p.x - b.x, py = p.y - b.y;
          const tp = Math.max(0, Math.min(len2, px * ux + py * uy));
          const perp = Math.hypot(px - ux * tp, py - uy * tp);
          if (perp < 46 + p.r) {
            if (s.dashN >= 3) this._sigHit(s);
            else this.hurtPlayer(1, { x: ux, y: uy }, 280, b.name);
          }
          b.x = dest.x; b.y = dest.y;
          Particles.burst(b.x, b.y, { count: 14, colors: ['#c8ccd8', '#e43b44'], speed: 220, life: 0.4, size: 3 });
        }
        if (s.dashN >= 3 || !b || b.dead) this.sigs.splice(i, 1);
        else { s.t = s.tel - 0.55; } // 다음 돌진 0.55s 후
      } else if (s.type === 'kingCross') {
        // X자: 중심 기준 대각 두 축 — 축까지의 수직거리
        const dx = p.x - s.cx, dy = p.y - s.cy;
        const d1 = Math.abs(dx - dy) / Math.SQRT2; // y=x 축
        const d2 = Math.abs(dx + dy) / Math.SQRT2; // y=-x 축
        if (d1 < s.w || d2 < s.w) this._sigHit(s);
        Particles.ring(s.cx, s.cy, { r0: 20, r1: 460, life: 0.55, color: '#e43b44', width: 9 });
        this.sigs.splice(i, 1);
      } else if (s.type === 'miniSig') {
        if (Math.hypot(p.x - s.x, p.y - s.y) < s.r + p.r) this._sigHit(s, 1);
        Particles.ring(s.x, s.y, { r0: 16, r1: s.r, life: 0.4, color: '#e43b44', width: 5 });
        this.sigs.splice(i, 1);
      } else {
        this.sigs.splice(i, 1);
      }
    }
  },

  // ── 다섯 번째 손: 관찰자의 속삭임 — 선택의 순간, 4번째 벽 너머에서 스며드는 문장 ──
  showWhisper(text) {
    this.whisper = { text, t: 4.2, maxT: 4.2 };
  },

  // ── v120 ④ 막 시작 독백 — 층에 도착한 망자의 혼잣말 (비차단 하단 텍스트, 층당 1회) ──
  showMonologue(text) {
    this.monologue = { text, t: 3.8, maxT: 3.8 };
  },
  _floorMonologue() {
    if (Dungeon.roomIndex > 1 || this.bossRush) return;
    this._monoDone = this._monoDone || {};
    const f = Dungeon.floor;
    if (this._monoDone[f]) return;
    const MONO = {
      5: '목매단 나무가 보인다. 밧줄이… 셀 수 없이 많다.',
      10: '처형인의 홀. 내 목을 친 도끼가 저 안에 있다.',
      11: '다리를 건넌다. 검은 마차가 지나갔다는 그 다리다.',
      21: '포도밭이 보인다. 배심원들이 상으로 받았다는 그 땅이다.',
      31: '판자로 막은 창문들. 이 마을은 역병이 아니라 비밀에 봉쇄됐다.',
      41: '왕도의 불빛. 저 안 어딘가에서 내 사형이 서명됐다.',
      44: '처형대가 늘어서 있다. 저 중 하나가 — 내 것이었다.',
      49: '문 너머에서 심장 소리가 들린다. 내 것이 아니다. 성배의 것이다.',
    };
    if (MONO[f]) {
      this._monoDone[f] = true;
      this.showMonologue(MONO[f]);
    }
  },

  // 선택 직후 호출 — 자각 단계 1+에서 낮은 확률로 속삭인다 (선택이라는 행위 자체에 대한 물음)
  maybeWhisper(chance = 0.15) {
    if (!Meta.data.fifthHand || Meta.data.fifthHand.stage < 1) return;
    if (Math.random() >= chance) return;
    const POOL = [
      '…방금 그 길 — 네가 고른 것이냐, 골라진 것이냐.',
      '다섯 번째 손은 패를 섞을 뿐. 쥐는 손은 언제나 넷… 아니, 다섯.',
      '별을 읽던 자는 알고 있었다 — 읽히는 쪽이 누구인지.',
      '누군가 아주 오래전부터 함께 걷고 있다.',
      '골라진 길이라도, 걷는 발은 네 것이다.',
    ];
    this.showWhisper(POOL[Math.floor(Math.random() * POOL.length)]);
  },

  // 징조: 무너진 길 — 세 갈래 중 하나가 잔해에 막혀 있다 (선택지 2개는 항상 보장)
  _maybeCollapseDoor(opts) {
    if (opts.length >= 3 && Math.random() < 0.08) {
      const cut = opts.splice(1 + Math.floor(Math.random() * (opts.length - 1)), 1)[0];
      this.banner = { text: `길이 무너져 있다 — [${cut.label}] 쪽으로는 갈 수 없다`, life: 2.4, maxLife: 2.4, color: '#8f8577' };
    }
    return opts;
  },

  // 사기 판정 (드라마 AI) — 동료가 죽는 걸 본 산 자는 무너질 수 있다. killEnemy가 호출.
  // 잔혹 처치(brutal)와 누적 전사자가 공포를 키운다. 언데드·광신도·정예·보스는 동요하지 않는다.
  _fearCheck(dead, brutal) {
    if (!this._drama || !HUMAN_FEAR.has(dead.type)) return;
    this._sqDead = (this._sqDead || 0) + 1;
    const act = Math.min(5, Math.ceil((Dungeon.floor <= 50 ? Dungeon.floor : 46) / 10));
    const base = ACT_MORALE[act] || 0.1;
    let routed = 0; // 동시 붕괴 상한 2 — 한 번의 처치로 방이 통째로 비지 않게
    for (const e of this.enemies) {
      if (routed >= 2) break;
      if (e.dead || e.neutral || e.elite || e.isMini || e.isBoss || e._rout || e._surrender != null || e._runner) continue;
      if (!HUMAN_FEAR.has(e.type) || !e.speed) continue;
      if (Math.hypot(e.x - dead.x, e.y - dead.y) > 190) continue;
      let c = base * (brutal ? 1.6 : 1) * (this._sqDead >= 3 ? 1.5 : 1);
      if (e.hp <= e.maxHp * 0.4) c *= 1.6; // 만신창이는 더 쉽게 무너진다
      if (Math.random() < c) {
        e._rout = true; e._routT = 0; e._aware = true;
        routed++;
        Particles.text(e.x, e.y - 32, ROUT_CRY[Math.floor(Math.random() * ROUT_CRY.length)], { color: '#ffd866', size: 12 });
        // M2: 장교가 보고 있었다면 40% — 도망병 처형 추격 (왕의 군대엔 의리가 없다)
        if (Math.random() < 0.4) {
          const officer = this.enemies.find((o) => !o.dead && !o.neutral && OFFICERS.has(o.type) &&
            !o._executeTarget && o._aware !== false && Math.hypot(o.x - e.x, o.y - e.y) < 300);
          if (officer) {
            officer._executeTarget = e;
            Particles.text(officer.x, officer.y - 34, '탈영은 반역이다!', { color: '#e43b44', size: 12 });
          }
        }
      }
    }
  },

  // 투사체 착탄 폭발 — 연금술사 플라스크는 상태이상(중독/촉매 랜덤 원소)을 함께 뿌린다
  _boltExplode(b, p) {
    const cols = b.venom ? ['#c9d94a', '#6ada8a', '#38b764'] : ['#8a5ac2', '#c56cf0', '#ffd866'];
    this._explode(b.x, b.y, b.aoe, Math.max(1, Math.ceil(p.currentAtk() * 0.6)), cols, b.venom ? '#c9d94a' : '#c56cf0'); // 파이어볼 폭발 하향 (리그 +79%→목표 ~45%)
    if (!b.venom) return;
    // 직업 분화 (실플레이 "마도사와 구분 안 됨"): 플라스크는 자리에 산성 웅덩이를 남긴다 —
    // 마도사 = 순간 폭발 누커, 연금술사 = 바닥을 장악하는 지역전
    this.zones.push({ x: b.x, y: b.y, r: Math.max(30, Math.round(b.aoe * 0.9)), life: 2.2, kind: 'poison', tickT: 0.4 });
    const elem = b.catalyst ? ['poison', 'burn', 'shock'][Math.floor(Math.random() * 3)] : 'poison';
    const dur = elem === 'poison' ? (p.flags.al_acid ? 5 : 3) : elem === 'burn' ? 2.5 : 2;
    for (const e of this.enemies) {
      if (e.dead || e.phased || e.neutral) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < b.aoe + e.r) {
        e.status[elem] = Math.max(e.status[elem] || 0, dur);
      }
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

    // 일시정지 (Q로 런 포기 가능) — 설정 패널이 열려 있으면 Escape는 패널을 닫는 데 쓴다
    if (!this.showSettings && Input.pressed('Escape', 'KeyP')) {
      this.paused = !this.paused;
      AudioSys.pickup();
    }
    if (this.paused) {
      // 설정 (O) — 일시정지 중에도 조절 가능
      if (this.showSettings) { this._tickSettings(); return; }
      if (Input.pressed('KeyO')) {
        this.showSettings = true;
        this._setRow = 0;
        AudioSys.pickup();
        return;
      }
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
    if (this.whisper) { this.whisper.t -= dt; if (this.whisper.t <= 0) this.whisper = null; }
    if (this.monologue) { this.monologue.t -= dt; if (this.monologue.t <= 0) this.monologue = null; }
    if (this.vignette > 0) this.vignette -= dt * 1.5;
    if (this.critFlash > 0) this.critFlash -= dt * 3;
    if (this.hurtFlash > 0) this.hurtFlash -= dt * 2;
    if (this.pdodgeFlash > 0) this.pdodgeFlash -= dt * 1.5; // 완벽 회피 청록 섬광

    // 교착 방지 실드: 벽 안에 갇힌 적(벽 통과 이동의 잔재 등)을 2초마다 유효 위치로 재소환
    this._wallCheckT = (this._wallCheckT || 0) + dt;
    if (this._wallCheckT > 2) {
      this._wallCheckT = 0;
      for (const e of this.enemies) {
        if (e.dead || e.neutral || e.phased) continue;
        if (World.isSolidAt(e.x, e.y)) {
          // 보스도 포함 — 벽에 박힌 보스는 소프트락(문이 영영 안 열림)이라 더 치명적이다 (14층 계측)
          const pos = e.isBoss ? World.safeSpot(e.x, e.y) : World.randomSpawnPos(this.player, 120);
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
              this.hurtPlayer(1, { x: 0, y: 0 }, 60, fp.by || (fp.kind === 'poison' ? '독 웅덩이' : '불길'));
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
        let pos;
        // 대형 스폰 (드라마 AI): 통로·홀 방에서 병사류는 방 안쪽에 3열 방진으로 정렬해 기다린다
        if (this._formation && !this._roomAlert && !s.mini && !s.elite && FORM_UNITS.has(s.type) && this._formN < 9) {
          const k = this._formN++;
          const col = Math.floor(k / 3), row = k % 3;
          pos = World.safeSpot(TS * (World.cols - 5) + col * 34, TS * 5.5 + World.offsetY + (row - 1) * 56);
        } else {
          pos = World.randomSpawnPos(this.player);
        }
        this.markers.push({ x: pos.x, y: pos.y, type: s.type, elite: s.elite, mini: s.mini, omen: s.omen, t: s.mini ? 1.1 : 0.7 });
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
        if (this.pacts.speed) e.speed *= 1.15;
        if (this.pacts.wrath) e.speed *= 1.08; // 왕의 진노
        if (m.omen) { e._aware = true; e.speed *= 1.1; e.flash = 0.5; } // 어둠의 눈이 되살린 것 — 이미 깨어 있다
        // 발견 체계 (드라마 AI): 경보 전이면 비인지 상태로 배치 — 침입자를 아직 모른다.
        // 매복형·보스방·경보 후 증원은 제외 (=== false 게이트: 소환수 등 직접 push된 개체는 그대로)
        if (this._drama && !this._roomAlert && !m.mini && !AMBUSH_TYPES.has(m.type) && !e.isBoss) e._aware = false;
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

      // ── 드라마 AI: 발견 체계 — 아직 침입자를 모르는 병사는 제자리를 지킨다 ──
      if (e._aware === false) {
        e.animT += dt * 0.45;
        const dP = Math.hypot(e.x - p.x, e.y - p.y);
        if (this._roomAlert || dP < 230) {
          e._aware = true;
          e._alertT = dP < 150 ? 0.25 : 0.25 + Math.random() * 0.45; // 전파 스태거
          if (!this._roomAlert) { this._roomAlert = true; AudioSys.shoot(); }
          Particles.text(e.x, e.y - 30, '!', { color: '#e43b44', size: 18 });
        } else {
          continue;
        }
      }
      if (e._alertT > 0) { e._alertT -= dt; e.animT += dt; continue; }
      if (e._dodgeCd > 0) e._dodgeCd -= dt;

      // ── M2: 탈영병 — 싸우지 않는다. 다가와 건네고, 사라진다 ──
      if (e._deserter) {
        e.animT += dt;
        const ddx = p.x - e.x, ddy = p.y - e.y, ddd = Math.hypot(ddx, ddy) || 1;
        if (e._deserter === 'approach') {
          dramaMove(e, p.x, p.y, e.speed * 0.55, dt);
          if (ddd < 110) {
            e._deserter = 'give'; e._giveT = 1.4;
            Particles.text(e.x, e.y - 34, DESERT_CRY[Math.floor(Math.random() * DESERT_CRY.length)], { color: '#c8c0ac', size: 12 });
          }
        } else if (e._deserter === 'give') {
          e._giveT -= dt;
          if (e._giveT <= 0) {
            this.pickups.push({ x: e.x, y: e.y - 6, t: 0, r: 12 }); // 품에서 꺼낸 것 — 하트
            Particles.text(e.x, e.y - 30, '무사하길…', { color: '#c8c0ac', size: 11 });
            e._deserter = 'flee';
          }
        } else {
          const fx = e.x < World.cols * TS / 2 ? TS : TS * (World.cols - 1);
          dramaMove(e, fx, TS * 5.5 + World.offsetY, e.speed * 1.1, dt);
          if (e.x < TS * 1.5 || e.x > TS * (World.cols - 1.5)) {
            e.dead = true;
            Particles.burst(e.x, e.y, { count: 6, colors: ['#8f8577'], speed: 60, life: 0.3, size: 2 });
          }
        }
        continue;
      }

      // ── M2: 처형 목격 — 장교가 도망병을 뒤쫓아 벤다. 그 광경이 더 큰 공포를 부른다 ──
      if (e._executeTarget) {
        const t = e._executeTarget;
        e._huntT = (e._huntT || 0) + dt;
        if (t.dead || t._surrender != null || e._huntT > 4.5) {
          e._executeTarget = null; e._huntT = 0;
        } else {
          e.animT += dt;
          const hx = t.x - e.x, hy = t.y - e.y, hd = Math.hypot(hx, hy) || 1;
          e.flip = hx < 0;
          World.moveEntity(e, (hx / hd) * e.speed * 1.5 * dt, (hy / hd) * e.speed * 1.5 * dt);
          if (hd < 36) {
            t.dead = true; // 왕법 집행 — 처치 집계·전리품 없음 (플레이어의 손이 아니다)
            Particles.burst(t.x, t.y, { count: 14, colors: ['#8a1c2c', '#5a1016', '#c22030'], speed: 190, life: 0.5, size: 3, gravity: 260, dir: Math.atan2(hy, hx), spread: 1.2 });
            World.stampBlood(t.x, t.y, 9, 0.5);
            Particles.text(t.x, t.y - 32, '처형', { color: '#e43b44', size: 13 });
            Particles.text(e.x, e.y - 34, '겁쟁이는 왕법으로 다스린다.', { color: '#e43b44', size: 12 });
            e._executeTarget = null; e._huntT = 0;
            this._fearCheck(t, true); // 목격 연쇄
          }
          continue;
        }
      }

      // ── 드라마 AI: 전령 — 문으로 달려가 증원을 부른다. 막지 못하면 토벌대가 불어난다 ──
      if (e._runner && !e.dead) {
        e.animT += dt;
        const exitX = e.x < World.cols * TS / 2 ? TS * 1.3 : TS * (World.cols - 1.3);
        const exitY = TS * 5.5 + World.offsetY;
        const dd = dramaMove(e, exitX, exitY, e.speed * 1.3, dt);
        if (dd < 30) {
          e.dead = true; // 탈출 — 처치 집계 없음
          Particles.burst(e.x, e.y, { count: 8, colors: ['#8f8577'], speed: 80, life: 0.3, size: 2 });
          this.banner = { text: '⚠ 전령이 빠져나갔다 — 증원이 온다!', life: 2.0, maxLife: 2.0, color: '#e43b44' };
          const data = floorData(Dungeon.floor);
          for (let k = 0; k < 3; k++) this.pendingSpawns.push({ delay: 1.0 + k * 0.5, type: RNG.pick(data.enemies), elite: false });
        }
        continue;
      }

      // ── 드라마 AI: 항복 — 무릎 꿇은 자. 자비(방치)든 처형(공격)이든 선택은 플레이어의 것 ──
      if (e._surrender != null) {
        e._surrender += dt;
        e.animT += dt * 0.2;
        const dP = Math.hypot(e.x - p.x, e.y - p.y);
        if (e._feign && e._surrender > 0.9 && dP < 130) {
          // 거짓 항복 — 배신. 왕의 밀정은 마지막까지 기만한다
          e._surrender = null; e.neutral = false; e._feign = false;
          Particles.text(e.x, e.y - 32, '어리석군!', { color: '#e43b44', size: 13 });
          Particles.ring(e.x, e.y, { r0: 6, r1: 40, life: 0.3, color: '#e43b44', width: 3 });
          continue;
        }
        if (e._surrender > 3.2) {
          e.dead = true; // 목숨을 건졌다 — 어둠 속으로 사라진다
          Particles.burst(e.x, e.y, { count: 6, colors: ['#8f8577', '#5e564b'], speed: 60, life: 0.4, size: 2 });
        }
        continue;
      }

      // ── 드라마 AI: 사기 붕괴 — 도망친다. 구석에 몰리면 항복, 문에 닿으면 탈출 ──
      if (e._rout && !e.dead) {
        e._routT = (e._routT || 0) + dt;
        e.animT += dt * 1.4;
        const fdx = e.x - p.x, fdy = e.y - p.y, fd = Math.hypot(fdx, fdy) || 1;
        const px0 = e.x, py0 = e.y;
        World.moveEntity(e, (fdx / fd) * e.speed * 1.15 * dt, (fdy / fd) * e.speed * 1.15 * dt);
        e._routStuck = (Math.hypot(e.x - px0, e.y - py0) < e.speed * 0.4 * dt) ? (e._routStuck || 0) + dt : 0;
        if (e.x < TS * 1.6 || e.x > TS * (World.cols - 1.6)) {
          e.dead = true; // 문틈으로 탈출 — 놓쳤다
          Particles.text(e.x, e.y - 26, '…놓쳤다', { color: '#8f8577', size: 11 });
        } else if (e._routStuck > 0.5 && fd < 200) {
          // 구석에 몰렸다 — 무기를 버리고 무릎 꿇는다 (12%는 거짓 항복)
          e._rout = false; e._surrender = 0; e.neutral = true;
          e._feign = Math.random() < 0.12;
          Particles.text(e.x, e.y - 32, SURR_CRY[Math.floor(Math.random() * SURR_CRY.length)], { color: '#ffd866', size: 12 });
        }
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

      // ── 원소 교차 반응 (S1) — 두 상태가 한 몸에 공존하는 순간 화학이 터진다 ──
      // 트리를 하나만 파면 단일 원소, 두 트리를 섞으면 반응 — 조합 발견이 곧 콘텐츠
      if (!e.dead && !e.neutral) {
        if (e.status.burn > 0 && e.status.shock > 0) {
          // 과부하: 화상×감전 = 번개 폭발 (두 상태 소비)
          e.status.burn = 0; e.status.shock = 0;
          Particles.text(e.x, e.y - 34, '⚡과부하!', { color: '#ffd866', size: 15 });
          this.teachReaction('overload', '과부하 — 화상×감전 = 번개 폭발');
          const rxAmp = this.player.flags.al_react ? 1.3 : 1; // 연쇄 촉진 (연금술사)
          this._explode(e.x, e.y, 80 * rxAmp, 4, ['#ffd866', '#ff7043', '#ffffff'], '#ffd866');
        } else if (e.status.poison > 0 && e.status.shock > 0 && !e.isBoss && !(e._stunT > 0)) {
          // 마비: 독×감전 = 신경 마비 1.1초 (감전 소비, 중독 유지)
          e.status.shock = 0;
          e._stunT = this.player.flags.al_react ? 1.43 : 1.1; // 연쇄 촉진 (연금술사)
          Particles.text(e.x, e.y - 34, '마비!', { color: '#c9d94a', size: 14 });
          this.teachReaction('stun', '마비 — 독×감전 = 행동 정지');
          Particles.burst(e.x, e.y, { count: 8, colors: ['#c9d94a', '#ffd866'], speed: 90, life: 0.35, size: 3 });
        } else if (e.status.burn > 0 && e.status.poison > 0 && !e._venomBurn) {
          // 맹독 연소: 화상×독 = 두 지속 피해의 틱 가속 (표시 1회)
          e._venomBurn = true;
          e.status.burn += 1; e.status.poison += 1;
          Particles.text(e.x, e.y - 34, '맹독 연소!', { color: '#8a3a8c', size: 14 });
          this.teachReaction('venom', '맹독 연소 — 화상×독 = 지속 피해 2배속');
        }
        // 맹독 연소 지속 효과: 두 상태 공존 동안 틱 2배속
        if (e._venomBurn && e.status.burn > 0 && e.status.poison > 0) {
          e.status.burnTick -= dt;
          e.status.poisonTick -= dt;
        } else if (e._venomBurn && (e.status.burn <= 0 || e.status.poison <= 0)) {
          e._venomBurn = false;
        }
      }

      // 마비 상태: 행동 정지 (피해 판정은 그대로 받는다)
      if (e._stunT > 0) {
        e._stunT -= dt;
        e.animT += dt * 0.2;
        if (Math.random() < 0.15) {
          Particles.burst(e.x + (Math.random() - 0.5) * 16, e.y - 12, { count: 1, colors: ['#c9d94a'], speed: 20, life: 0.3, size: 2, gravity: -60 });
        }
        continue;
      }
      // 우두머리 약식 인장기 (4막+): HP 60% 이하에서 1회 — 왕의 인장을 받은 자들
      if (e.isMini && !e.dead && !e._sigDone && Dungeon.floor >= 31 && e.hp <= e.maxHp * 0.6 && !this.sigActive()) {
        e._sigDone = true;
        this.startSignature(e, 'miniSig');
      }
      if (!e.dead) e.update(dt, this);
      if (!e.dead) this._steer(e, dt, p);
    }
    this.enemies = this.enemies.filter((e) => !e.dead);

    // ── 왕의 인장기 ──
    this._tickSignatures(dt);
    if (this.sigWarnT > 0) this.sigWarnT -= dt;
    if (p.brandT > 0) {
      p.brandT -= dt;
      if (Math.random() < 0.12) {
        Particles.burst(p.x + (Math.random() - 0.5) * 20, p.y - 20, { count: 1, colors: ['#e43b44'], speed: 24, life: 0.4, size: 2, gravity: -70 });
      }
    }

    // ── 왕국의 징조 발동 ──
    if (this._omen && !this._omen.fired && !this.roomCleared && this.enemies.some((e) => !e.dead && !e.neutral)) {
      this._omen.delay -= dt;
      if (this._omen.delay <= 0) {
        const o = this._omen;
        o.fired = true;
        if (o.type === 'eye') {
          o.pale = Math.random() < 0.12; // 창백한 눈 — 적의가 없다 (…무엇이지?)
          o.eyeT = 6;
          if (o.pale) {
            this.banner = { text: '…하늘의 눈이 나를 본다. 이 시선은… 적의가 없다…?', life: 3, maxLife: 3, color: '#c8d4e4' };
            Meta.data.paleEyeSeen = (Meta.data.paleEyeSeen || 0) + 1;
            // 다섯 번째 손 — 첫 목격: 시선의 자각. 이때부터 선택의 순간마다 속삭임이 스며든다
            if (Meta.data.fifthHand.stage < 1) {
              Meta.data.fifthHand.stage = 1;
              this.showWhisper('…누구지. 처음부터 지켜보고 있었던 것 같은데.');
            } else {
              this.showWhisper('또 그 시선이다. …나쁜 시선은 아니다. 오히려—');
            }
            Meta.save();
          } else {
            this.banner = { text: '어둠의 눈이 내려다본다 — 죽은 것들이 꿈틀거린다!', life: 2.6, maxLife: 2.6, color: '#b13ae0' };
            const rev = (this._omenKills || []).slice(-2);
            if (rev.length) {
              for (const k of rev) this.pendingSpawns.push({ delay: 0.6, type: k.type, elite: false, omen: true });
            } else {
              for (const e of this.enemies) if (!e.dead && !e.neutral && !e.isBoss) { e.speed *= 1.15; e.flash = 0.4; }
            }
            AudioSys.roar();
            Renderer.shake(3, 0.3);
          }
        } else if (o.type === 'moon') {
          this._moonT = 10;
          p.bonusAtk += 1;
          p.speed *= 1.1;
          this.banner = { text: '달이 핏빛으로 물든다 — 원한이 끓어오른다 (공격 +1 · 10초)', life: 2.6, maxLife: 2.6, color: '#e43b44' };
          AudioSys.levelup();
        } else if (o.type === 'horn') {
          for (const e of this.enemies) if (!e.dead && !e.neutral && !e.isBoss) { e.speed *= 1.12; e.flash = 0.35; }
          this.banner = { text: '먼 곳에서 왕의 나팔이 울린다 — 토벌대가 사기를 얻는다', life: 2.4, maxLife: 2.4, color: '#e43b44' };
          AudioSys.roar();
        }
      }
    }
    if (this._omen && this._omen.eyeT > 0) this._omen.eyeT -= dt;
    if (this._moonT > 0) {
      this._moonT -= dt;
      if (this._moonT <= 0) { p.bonusAtk -= 1; p.speed /= 1.1; }
    }

    // ── 드라마 AI: 방 전투 시계 — 5초 지나면 무조건 발각, 18초를 끌면 전령이 증원을 부르러 뛴다 ──
    if (this._drama && !this.roomCleared && this.enemies.some((e) => !e.dead && !e.neutral)) {
      this._roomFightT = (this._roomFightT || 0) + dt;
      if (!this._roomAlert && this._roomFightT > 5) this._roomAlert = true;
      if (!this._runnerCalled && this._roomFightT > 18) {
        const cand = this.enemies.find((e) => !e.dead && !e.neutral && !e.elite && !e.isMini && !e.isBoss &&
          !e._rout && e._surrender == null && HUMAN_FEAR.has(e.type) && e.speed > 0);
        if (cand) {
          this._runnerCalled = true;
          cand._runner = true; cand._aware = true;
          Particles.text(cand.x, cand.y - 32, '증원을 불러라!', { color: '#e43b44', size: 13 });
          this.banner = { text: '⚠ 전령이 문으로 달린다 — 빠져나가기 전에 잡아라!', life: 2.2, maxLife: 2.2, color: '#e43b44' };
        } else {
          this._runnerCalled = true; // 부를 사람이 없다 (언데드·정예뿐)
        }
      }
    }

    // ── 장판 (적 피해: 감전/독구름) ──
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      if (z.r > 300) z.r = 300; // 전역 하드 클램프 — 어떤 생성 경로도 화면을 뒤덮을 수 없다
      z.life -= dt;
      if (z.life <= 0) { this.zones.splice(i, 1); continue; }
      if (z.kind === 'smoke') {
        // 연막 (연금 보조 스킬): 피해 없음 — 안의 적을 크게 둔화 (지속 갱신)
        z.tickT -= dt;
        if (z.tickT <= 0) {
          z.tickT = 0.4;
          for (const e of this.enemies) {
            if (e.dead || e.phased) continue;
            if (Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) {
              e.status.shock = Math.max(e.status.shock, 1.0);
            }
          }
        }
      } else if (z.kind === 'poison' || z.kind === 'fire') {
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
      // 간극 링 (P2): 안전 부채꼴 안에 있으면 통과
      let inGap = false;
      if (ring.gapW) {
        let da = Math.atan2(p.y - ring.y, p.x - ring.x) - ring.gapA;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        inGap = Math.abs(da) < ring.gapW / 2;
      }
      if (!inGap && Math.abs(pd - ring.r) < ring.width) {
        // 무적 중이어도 hurtPlayer로 — 대시 관통 시 완벽 회피 판정이 살아난다
        const dir = { x: (p.x - ring.x) / (pd || 1), y: (p.y - ring.y) / (pd || 1) };
        this.hurtPlayer(ring.dmg, dir, 300, ring.by);
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
        if (a.dmg > 0 && pdist < p.r + a.r + 12) this.hurtPlayer(a.dmg, a.dir, 260, a.by);
      } else if (pdist < p.r + a.r) {
        if (a.slow > 0) {
          p.slowT = Math.max(p.slowT, a.slow);
          Particles.text(p.x, p.y - 26, '끈적!', { color: '#e8e0cf', size: 13 });
          Particles.burst(p.x, p.y, { count: 6, colors: ['#e8e0cf'], speed: 60, life: 0.3, size: 2 });
        }
        if (a.dmg > 0) this.hurtPlayer(a.dmg, a.dir, 260, a.by);
        this.arrows.splice(i, 1);
        continue;
      }
      const hitWall = (a.kind === 'arrow' || a.kind === 'rock' || a.kind === 'web' || a.kind === 'fire') && World.isSolidAt(a.x, a.y);
      if (a.life <= 0 || hitWall) {
        if (PROJ_STYLES[a.kind]?.patchOnEnd) {
          this.firePatches.push({ x: a.x, y: a.y, r: 34, life: 2.0, kind: 'fire', by: a.by });
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
            // M2: 산 자의 몸놀림 — 인간 병사는 가끔 화살을 옆걸음으로 흘린다 (18%, 쿨 3초)
            if (HUMAN_FEAR.has(e.type) && !e.elite && !e.isMini && !e._rout && e._surrender == null &&
                e._aware !== false && !(e._dodgeCd > 0) && Math.random() < 0.18) {
              e._dodgeCd = 3;
              b.hit.add(e); // 이 화살은 다시 못 맞힌다
              const sgn = Math.random() < 0.5 ? 1 : -1;
              e.kbx += -b.dir.y * sgn * 260;
              e.kby += b.dir.x * sgn * 260;
              Particles.text(e.x, e.y - 26, '휙', { color: '#9aa0b4', size: 11 });
              continue;
            }
            b.hit.add(e);
            const res = p.strike(this, e, { ...b.dir }, {
              finisher: b.finisher,
              kb: b.finisher ? 300 : 170,
            });
            if (b.aoe) this._boltExplode(b, p);
            if (res === 'blocked' || !b.pierce) remove = true;
            break;
          }
        }
      }
      if (remove) {
        if (b.aoe && b.hit.size === 0) {
          // 벽에 맞아도 대마탄·플라스크는 폭발
          this._boltExplode(b, p);
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
      // 개조 「추적하는 비」: 구름이 가장 가까운 적을 따라간다
      if (r.track) {
        let tgt = null, best = 9999;
        for (const e of this.enemies) {
          if (e.dead || e.neutral) continue;
          const dd = Math.hypot(e.x - r.x, e.y - r.y);
          if (dd < best) { best = dd; tgt = e; }
        }
        if (tgt) {
          const dd = Math.hypot(tgt.x - r.x, tgt.y - r.y) || 1;
          r.x += ((tgt.x - r.x) / dd) * 85 * dt;
          r.y += ((tgt.y - r.y) / dd) * 85 * dt;
        }
      }
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
              p.strike(this, e, { x: (e.x - ix) / (dd || 1), y: (e.y - iy) / (dd || 1) }, { kb: 130, dmgMul: r.dmgMul || 1 });
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
            const dmg = Math.max(1, Math.round(p.currentAtk() * 4 * (m.dmgMul || 1)));
            const crit = p.rflags.allcrit || Math.random() < Math.min(0.8, p.critChance);
            this.hitEnemy(e, crit ? Math.round(dmg * p.critMul) : dmg, dir, { crit, kb: m.pull ? -260 : 320 });
            if (!e.dead) e.status.burn = Math.max(e.status.burn, p.flags.inferno ? 4 : 2);
          }
        }
        // 개조 「별의 인력」: 착탄 반경 밖 1.6배까지 끌어당긴다
        if (m.pull) {
          for (const e of this.enemies) {
            if (e.dead || e.neutral || e.isBoss) continue;
            const dd = Math.hypot(e.x - m.x, e.y - m.y);
            if (dd > m.r && dd < m.r * 1.7) {
              e.kbx -= ((e.x - m.x) / dd) * 340;
              e.kby -= ((e.y - m.y) / dd) * 340;
            }
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
        // 마시다 만 해독제 (이졸데 유품): 하트 회복량 +1 — 낙인 중에는 회복이 막힌다
        const heal = 1 + (p.heartBonus || 0);
        if (p.brandT > 0) Particles.text(p.x, p.y - 30, '낙인 — 회복 불가', { color: '#e43b44', size: 12 });
        else if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + heal);
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
        // ── 상인 판매대 (G1): 골드가 모자라면 사지 못한다 — 소비되지 않고 남는다 ──
        if (it.kind === 'shopRelic' || it.kind === 'shopHeal' || it.kind === 'shopReroll' || it.kind === 'shopShards') {
          if (this.gold < it.price) {
            if (!it._hintT || it.t > it._hintT) {
              it._hintT = it.t + 1.2;
              Particles.text(it.x, it.y - 32, `골드 부족 (${it.price}G)`, { color: '#e43b44', size: 12 });
            }
            continue;
          }
          if (it.kind === 'shopHeal' && p.hp >= p.maxHp) {
            if (!it._hintT || it.t > it._hintT) {
              it._hintT = it.t + 1.2;
              Particles.text(it.x, it.y - 32, '이미 체력이 가득하다', { color: '#666a80', size: 12 });
            }
            continue;
          }
          this.gold -= it.price;
          it.used = true;
          AudioSys.buy();
          Particles.burst(it.x, it.y - 8, { count: 10, colors: ['#ffd866', '#2ec4b6'], speed: 120, life: 0.4, size: 3 });
          if (it.kind === 'shopRelic') {
            const rolled = rollRelics(p, 1, true);
            if (rolled.length > 0) this.acquireRelic(rolled[0]);
            else { this.gold += Math.round(it.price / 2); Particles.text(it.x, it.y - 30, '매물 소진 — 절반 환불', { color: '#ffd866', size: 12 }); }
          } else if (it.kind === 'shopHeal') {
            p.hp = Math.min(p.maxHp, p.hp + 2);
            Particles.text(p.x, p.y - 28, '+2', { color: '#e43b44', size: 18 });
          } else if (it.kind === 'shopReroll') {
            p.rerolls = (p.rerolls || 0) + 1;
            Particles.text(p.x, p.y - 28, '리롤 +1 (E)', { color: '#2ec4b6', size: 14 });
          } else if (it.kind === 'shopBlack') {
            // 검은 상자: 레어 이상 확정 — 죽은 자의 물건 중에서도 값나가는 것
            const owned = new Set(p.relics);
            const pool = RELICS.filter((r) => !owned.has(r.id) && Meta.isUnlocked(r) &&
              (!r.heir || r.heir === p.classId) && r.rarity !== 'common');
            if (pool.length) {
              const w = { rare: 60, epic: 30, legendary: 10 };
              let tot = 0; for (const r of pool) tot += w[r.rarity] || 1;
              let roll = Math.random() * tot; let picked = pool[0];
              for (const r of pool) { roll -= w[r.rarity] || 1; if (roll <= 0) { picked = r; break; } }
              this.acquireRelic(picked);
            } else {
              this.gold += Math.round(it.price / 2);
              Particles.text(it.x, it.y - 30, '상자가 비었다 — 절반 환불', { color: '#ffd866', size: 12 });
            }
          } else if (it.kind === 'shopShards') {
            // 파편 주머니: 잉여 골드 → 메타 화폐 (죽으면 사라질 골드에 마지막 쓸모)
            Meta.data.shards += it.shards; Meta.save();
            Particles.text(p.x, p.y - 28, `◆ +${it.shards}`, { color: '#2ec4b6', size: 15 });
          }
          continue;
        }
        // ── 핏빛 제단 (G2): 최대 HP 1을 바치면 정예급 특성을 고른다 ──
        if (it.kind === 'bloodAltar') {
          if (p.maxHp <= 2) {
            if (!it._hintT || it.t > it._hintT) {
              it._hintT = it.t + 1.2;
              Particles.text(it.x, it.y - 32, '바칠 피가 모자라다...', { color: '#666a80', size: 12 });
            }
            continue;
          }
          it.used = true;
          p.maxHp -= 1;
          p.hp = Math.min(p.hp, p.maxHp);
          this.hurtFlash = 0.2;
          Renderer.shake(5, 0.3);
          AudioSys.hurt();
          Particles.burst(it.x, it.y, { count: 22, colors: ['#e43b44', '#8a1a2a', '#241832'], speed: 170, life: 0.6, size: 3 });
          this.banner = { text: '피의 대가 — 힘을 골라라 (최대 HP -1)', life: 2.0, maxLife: 2.0, color: '#e43b44' };
          this.pendingChoices++;
          this.openTraitChoice('elite');
          continue;
        }
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
          const heal = this.pacts.heal ? 1 : 2; // 서약 '메마른 샘': 모닥불 회복 감소
          p.hp = Math.min(p.maxHp, p.hp + heal);
          Particles.text(p.x, p.y - 28, '+' + heal, { color: '#e43b44', size: 18 });
          Particles.burst(it.x, it.y, { count: 12, colors: ['#ff7043', '#ffd866'], speed: 80, life: 0.6, size: 3, gravity: -120 });
          for (const o of this.interactables) if (o.kind === 'whetstone') o.used = true; // 양자택일
        } else if (it.kind === 'clue') {
          // 증거 획득 (기획 §4): 서사 + 파편 — 수집이 성장으로 이어진다
          const c = Meta.gainClue(it.clueId);
          if (c) {
            const reward = 15 + c.act * 10;
            Meta.data.shards += reward; Meta.save();
            // v120 ②: 흘러가는 배너 대신 증거 카드 — 시간이 멈추고, 읽고, 아무 키로 닫는다
            this.clueCard = { clue: c, reward, t: 0 };
            this.state = 'cluecard';
            Particles.text(p.x, p.y - 30, `◆ +${reward}`, { color: '#2ec4b6', size: 15 });
            Particles.burst(it.x, it.y - 8, { count: 14, colors: ['#f7b32b', '#c8c0a8'], speed: 110, life: 0.5, size: 3, gravity: -60 });
            AudioSys.chest();
          }
        } else if (it.kind === 'modShrine') {
          it.used = true;
          this.openModChoice();
        } else if (it.kind === 'skillShrine') {
          // 스킬 사당 (P1): 보조 스킬 3택1 — 액티브 킷이 런 중간에 자란다
          AudioSys.levelup();
          Particles.burst(it.x, it.y - 10, { count: 16, colors: ['#c9d94a', '#5ce0e6', '#ffd866'], speed: 130, life: 0.5, size: 3 });
          this.openSubSkillChoice();
        } else if (it.kind === 'whetstone') {
          // 담금질: 이번 층 동안 공격력 +1 (풀피일 때 모닥불의 가치)
          p.floorAtk = (p.floorAtk || 0) + 1;
          this.banner = { text: '담금질 — 이번 층 공격력 +1', life: 1.8, maxLife: 1.8, color: '#ffd866' };
          AudioSys.crit();
          Particles.burst(it.x, it.y, { count: 14, colors: ['#ffd866', '#c8d4e4'], speed: 110, life: 0.5, size: 3 });
          Particles.text(p.x, p.y - 30, '공격력 +1', { color: '#ffd866', size: 15 });
          for (const o of this.interactables) if (o.kind === 'camp') o.used = true; // 양자택일
        } else if (it.kind === 'gambler') {
          // 교수대 주사위: 골드 절반을 건다 — 이기면 2.2배로 돌아온다 (기대값 -6%: 집이 이긴다)
          const stake = Math.floor(this.gold / 2);
          if (stake < 10) {
            this.banner = { text: '도박사가 코웃음 친다 — "그 푼돈으로는…"', life: 1.6, maxLife: 1.6, color: '#8f8577' };
          } else if (Math.random() < 0.47) {
            this.gold += Math.round(stake * 1.2);
            this.banner = { text: `교수대 주사위 — 이겼다! +${Math.round(stake * 1.2)}G`, life: 2.2, maxLife: 2.2, color: '#f7b32b' };
            AudioSys.buy();
            Particles.burst(it.x, it.y, { count: 16, colors: ['#ffd866', '#f7b32b'], speed: 150, life: 0.5, size: 3 });
          } else {
            this.gold -= stake;
            this.banner = { text: `교수대 주사위 — 잃었다. -${stake}G "죽은 자의 운이란…"`, life: 2.2, maxLife: 2.2, color: '#8f8577' };
            AudioSys.deny();
          }
          Renderer.shake(3, 0.2);
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
      // 시련 완주 보상 (G5): 확정 에픽+ 유물 + 골드 뭉치
      if (this._trial) {
        this._trial = null;
        const g = 40 + Dungeon.floor * 5;
        this.gold += g;
        Particles.text(p.x, p.y - 34, `+${g}G`, { color: '#ffd866', size: 16 });
        const owned = new Set(p.relics);
        const highPool = RELICS.filter((r) => !owned.has(r.id) && Meta.isUnlocked(r) && (r.rarity === 'epic' || r.rarity === 'legendary'));
        if (highPool.length > 0) {
          this.acquireRelic(highPool[Math.floor(RNG.next() * highPool.length)]);
        } else {
          const rolled = rollRelics(p, 1, true);
          if (rolled.length > 0) this.acquireRelic(rolled[0]);
        }
        this.banner = { text: '시련을 이겨냈다!', life: 2.0, maxLife: 2.0, color: '#b13ae0' };
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
        World.openDoors(this._maybeCollapseDoor(Dungeon.doorOptions()));
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
