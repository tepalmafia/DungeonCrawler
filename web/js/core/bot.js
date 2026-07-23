// 봇 모드 — 자동 플레이 테스트 (?bot=1 또는 테스트 모드에서 V)
// 데모 봇(?demo=1, 검증 스크립트용)과 달리 텔레그래프 회피·우선순위 타겟팅·
// 카드 선택 휴리스틱·끼임 탈출·자동 재시작을 갖춘 "테스터" 봇이다.
// ?ff=N (1~8): 배속 / ?botloop=1: 사망·클리어 시 자동 재시작 (소크 테스트)
const Bot = {
  enabled: false,
  loop: false,
  ff: 1,
  runs: 0,       // loop 모드에서 끝낸 런 수
  wins: 0,

  _lastX: 0, _lastY: 0, _stuckT: 0,
  _detourT: 0, _detour: { x: 1, y: 0 },
  _skillT: 0, _restartT: 0,

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this._releaseKeys();
  },

  _releaseKeys() {
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) Input.keys[k] = false;
  },

  _move(p, tx, ty) {
    this._releaseKeys();
    if (tx < p.x - 3) Input.keys['KeyA'] = true;
    if (tx > p.x + 3) Input.keys['KeyD'] = true;
    if (ty < p.y - 3) Input.keys['KeyW'] = true;
    if (ty > p.y + 3) Input.keys['KeyS'] = true;
  },

  // 레벨업 카드 휴리스틱: 이미 보유한 태그(스탯 제외)와 같은 태그 우선, 없으면 1번
  _bestCard(game) {
    const p = game.player;
    const tagCount = {};
    for (const id of p.traits) {
      const tr = TRAITS.find((x) => x.id === id);
      if (tr && tr.tag !== '스탯') tagCount[tr.tag] = (tagCount[tr.tag] || 0) + 1;
    }
    let best = 0, bestScore = -1;
    game.traitCards.forEach((c, i) => {
      const score = (tagCount[c.tag] || 0) + (c.cls ? 0.5 : 0);
      if (score > bestScore) { bestScore = score; best = i; }
    });
    return best;
  },

  update(game, dt) {
    // ── 카드/보상 화면: 자동 선택 ──
    if (game.state === 'levelup') {
      Input.justPressed['Digit' + (this._bestCard(game) + 1)] = true;
      return;
    }
    if (game.state === 'relic') {
      Input.justPressed['Digit1'] = true;
      return;
    }
    // ── 사망/클리어: loop 모드면 재시작 ──
    if (game.state === 'over' || game.state === 'victory') {
      if (!this.loop) return;
      this._restartT += dt;
      if (this._restartT > 1.2) {
        this._restartT = 0;
        this.runs++;
        if (game.state === 'victory') this.wins++;
        Input.justPressed['KeyR'] = true;
      }
      return;
    }
    // ── 거점: 잠시 후 출발 ──
    if (game.state === 'hub') {
      this._restartT += dt;
      if (this._restartT > 0.8) {
        this._restartT = 0;
        Input.justPressed['Space'] = true;
      }
      return;
    }
    if (game.state !== 'play') return;

    const p = game.player;
    if (!p) return;
    this._skillT += dt;

    // ── 끼임 감지: 이동 의사가 있는데 0.7초간 제자리면 1초간 무작위 우회 ──
    const moved = Math.hypot(p.x - this._lastX, p.y - this._lastY);
    this._lastX = p.x; this._lastY = p.y;
    const wantsMove = Input.keys['KeyW'] || Input.keys['KeyA'] || Input.keys['KeyS'] || Input.keys['KeyD'];
    if (wantsMove && moved < 0.4) this._stuckT += dt;
    else this._stuckT = Math.max(0, this._stuckT - dt * 2);
    if (this._stuckT > 0.7) {
      const a = Math.random() * Math.PI * 2;
      this._detour = { x: Math.cos(a), y: Math.sin(a) };
      this._detourT = 1.0;
      this._stuckT = 0;
      if (p.dashCharges >= 1) Input.justPressed['Space'] = true;
    }
    if (this._detourT > 0) {
      this._detourT -= dt;
      this._move(p, p.x + this._detour.x * 100, p.y + this._detour.y * 100);
      return;
    }

    // ── 위협 회피 (텔레그래프 읽기) — 이동보다 우선 ──
    const dodge = this._threat(game, p);
    if (dodge) {
      this._move(p, p.x + dodge.x * 120, p.y + dodge.y * 120);
      if (dodge.dash && p.dashCharges >= 1) Input.justPressed['Space'] = true;
      return;
    }

    // ── 타겟 선정: 영혼 구슬(장막) > 강령술사 > 최근접 ──
    let target = null, best = Infinity, near = 0;
    const prio = (e) => (e.type === 'soulOrb' ? 0 : e.type === 'necro' ? 1 : 2);
    for (const e of game.enemies) {
      if (e.dead || e.phased) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < 300) near++;
      const score = prio(e) * 10000 + d;
      if (score < best) { best = score; target = e; }
    }

    if (target) {
      const d = Math.hypot(target.x - p.x, target.y - p.y) || 1;
      // 스킬: 적이 몰려있거나 보스전이면 쿨마다
      if (this._skillT > 1 && p.skillCd <= 0 && (near >= 2 || target.isBoss) && d < 320) {
        Input.justPressed['KeyK'] = true;
        this._skillT = 0;
      }
      if (p.classId !== 'knight') {
        // 원거리: 카이팅
        if (d < 160) this._move(p, p.x * 2 - target.x, p.y * 2 - target.y);
        else if (d > 340) this._move(p, target.x, target.y);
        else this._releaseKeys();
        if (p.attackCd <= 0 && d < 500) Input.justPressed['KeyJ'] = true;
        if (d < 90 && p.dashCharges >= 1) Input.justPressed['Space'] = true;
      } else {
        // 근접: 접근 + 콤보
        this._move(p, target.x, target.y);
        if (d < 80 && p.attackCd <= 0) {
          p.facing = { x: (target.x - p.x) / d, y: (target.y - p.y) / d };
          Input.justPressed['KeyJ'] = true;
        }
      }
    } else {
      // 적 없음: 상호작용(상자/모닥불) → 문
      const it = game.interactables.find((i) => !i.used);
      if (it) this._move(p, it.x, it.y);
      else if (World.doorsActive && World.doors.length > 0) {
        this._move(p, World.doors[0].x, World.doors[0].y);
      } else this._releaseKeys();
    }
  },

  // 위협 스캔 — 회피 방향 {x, y, dash?} 반환, 없으면 null
  _threat(game, p) {
    // 자폭 직전 폭탄벌레: 반경 밖으로
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (e.type === 'bomber' && e.state === 'fuse') {
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        if (d < 95) {
          return { x: (p.x - e.x) / (d || 1), y: (p.y - e.y) / (d || 1), dash: d < 60 };
        }
      }
      // 처형자 처형 구역: 직사각 판정 안이면 수직으로 이탈
      if (e.type === 'executioner' && e.state === 'raise') {
        const rx = p.x - e.x, ry = p.y - e.y;
        const along = rx * e.slamDir.x + ry * e.slamDir.y;
        const perp = -rx * e.slamDir.y + ry * e.slamDir.x;
        if (along > -20 && along < e.slamLen + 15 && Math.abs(perp) < e.slamHalfW + p.r + 12) {
          const s = perp >= 0 ? 1 : -1;
          return { x: -e.slamDir.y * s, y: e.slamDir.x * s };
        }
      }
      // 멧돼지/용암 개 돌진: 경로에서 수직으로 이탈
      if ((e.type === 'boar' || e.type === 'lavaHound') && (e.state === 'windup' || e.state === 'charge')) {
        const rx = p.x - e.x, ry = p.y - e.y;
        const along = rx * e.chargeDir.x + ry * e.chargeDir.y;
        const perp = -rx * e.chargeDir.y + ry * e.chargeDir.x;
        if (along > 0 && along < 500 && Math.abs(perp) < 50) {
          const s = perp >= 0 ? 1 : -1;
          return { x: -e.chargeDir.y * s, y: e.chargeDir.x * s, dash: e.state === 'charge' };
        }
      }
    }
    // 확장 충격파 링: 가장자리가 가까우면 대시로 통과
    for (const ring of game.rings) {
      const d = Math.hypot(p.x - ring.x, p.y - ring.y);
      if (Math.abs(d - ring.r) < ring.width + 18) {
        return { x: (p.x - ring.x) / (d || 1), y: (p.y - ring.y) / (d || 1), dash: true };
      }
    }
    // 서 있는 자리가 위험 지대(용암/독 안개/불길)면 이탈
    if (World.isLavaAt(p.x, p.y + 10) || World.inFog(p.x, p.y)) {
      const cx = (World.cols * TS) / 2, cy = (World.rows * TS) / 2;
      return { x: Math.sign(cx - p.x) || 1, y: Math.sign(cy - p.y) || 1 };
    }
    for (const fp of game.firePatches) {
      const d = Math.hypot(p.x - fp.x, p.y - fp.y);
      if (d < fp.r + 8) {
        return { x: (p.x - fp.x) / (d || 1), y: (p.y - fp.y) / (d || 1) };
      }
    }
    // 근접한 적 투사체: 대시 회피
    for (const a of game.arrows) {
      const d = Math.hypot(p.x - a.x, p.y - a.y);
      const closing = a.dir.x * (p.x - a.x) + a.dir.y * (p.y - a.y) > 0;
      if (d < 55 && closing && a.dmg > 0) {
        return { x: -a.dir.y, y: a.dir.x, dash: p.dashCharges >= 1 };
      }
    }
    return null;
  },
};
