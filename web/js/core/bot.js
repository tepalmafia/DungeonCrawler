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
  deaths: {},    // 층별 사망 횟수 {층: 회수} — 무한 부활 모드에서 난이도 리포트
  // 자가 진단 카운터 — 봇이 '제대로 싸우고 있는지' 검증하는 계기판
  stats: { attacks: 0, skills: 0, dashes: 0, explores: 0, stalls: 0 },

  _lastX: 0, _lastY: 0, _stuckT: 0,
  _detourT: 0, _detour: { x: 1, y: 0 },
  _skillT: 0, _restartT: 0,
  // 목표 진행 감시: 목표에 3초간 가까워지지 못하면 탐색 모드로 우회
  _goalKey: null, _bestD: Infinity, _noProgressT: 0,
  _exploreT: 0, _explorePt: null,

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this._releaseKeys();
  },

  // 사망 기록 (무한 부활·실사망 공통) — 층별 난이도 리포트의 재료
  onDeath(floor) {
    this.deaths[floor] = (this.deaths[floor] || 0) + 1;
  },

  deathReport() {
    const keys = Object.keys(this.deaths).map(Number).sort((a, b) => a - b);
    const total = keys.reduce((s, k) => s + this.deaths[k], 0);
    return { total, byFloor: keys.map((k) => `${k}층:${this.deaths[k]}`).join(' ') };
  },

  _dash() {
    Bot.stats.dashes++;
    Input.justPressed['Space'] = true;
  },

  _releaseKeys() {
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) Input.keys[k] = false;
  },

  _move(p, tx, ty) {
    this._releaseKeys();
    let ax = tx < p.x - 3 ? -1 : tx > p.x + 3 ? 1 : 0;
    let ay = ty < p.y - 3 ? -1 : ty > p.y + 3 ? 1 : 0;
    // 벽 슬라이드: 대각 이동 중 한 축이 벽에 막히면 그 축만 포기하고 미끄러진다 (사람의 벽 타기)
    if (ax !== 0 && ay !== 0) {
      const bx = World.isSolidAt(p.x + ax * 26, p.y);
      const by = World.isSolidAt(p.x, p.y + ay * 26);
      if (bx && !by) ax = 0;
      else if (by && !bx) ay = 0;
    }
    if (ax < 0) Input.keys['KeyA'] = true;
    if (ax > 0) Input.keys['KeyD'] = true;
    if (ay < 0) Input.keys['KeyW'] = true;
    if (ay > 0) Input.keys['KeyS'] = true;
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
        this._dash();
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
      if (p.dashCharges >= 1) this._dash();
    }
    if (this._detourT > 0) {
      this._detourT -= dt;
      this._move(p, p.x + this._detour.x * 100, p.y + this._detour.y * 100);
      return;
    }

    // ── 탐색 모드: 벽 너머 목표에 계속 막히면 방의 다른 지점으로 크게 우회 ──
    if (this._exploreT > 0) {
      this._exploreT -= dt;
      if (this._explorePt) this._move(p, this._explorePt.x, this._explorePt.y);
      return;
    }

    // ── 킬 진행 감시: 적이 살아있는데 10초간 처치가 없으면 교착 — 위치를 크게 바꾼다 ──
    // (원거리 직업이 벽 너머 적과 대치하는 경우: 거리 감시로는 안 잡힌다)
    // (보스·우두머리전은 제외 — 킬 없이 오래 싸우는 게 정상이라 오탐이 난다)
    if (!this._killWatch) this._killWatch = { kills: -1, t: 0 };
    const inLongFight = game.enemies.some((e) => (e.isBoss || e.isMini) && !e.dead);
    if (game.kills !== this._killWatch.kills || inLongFight) {
      this._killWatch.kills = game.kills;
      this._killWatch.t = 0;
    } else if (game.enemies.some((e) => !e.dead && !e.neutral && e.spawnT <= 0)) {
      this._killWatch.t += dt;
      if (this._killWatch.t > 7) {
        this._killWatch.t = 0;
        this._explorePt = World.randomSpawnPos(p, 160);
        this._exploreT = 2.0;
        Bot.stats.stalls++;
        Bot.stats.explores++;
        // 같은 방 교착 누적 추적 — 3회부터는 스킬 강제 + 밀착 강행으로 판을 깬다
        const roomKey = Dungeon.floor * 100 + Dungeon.roomIndex;
        if (this._stallRoom === roomKey) this._roomStalls = (this._roomStalls || 0) + 1;
        else { this._stallRoom = roomKey; this._roomStalls = 1; }
        if (p.dashCharges >= 1) this._dash();
      }
    }

    // ── 부활 직후: 무적이 남아있는 동안 적 무리에서 물러나 전열을 정비 ──
    if (game.reviveMode && p.invuln > 1.2) {
      let near = null, nd = 170;
      for (const e of game.enemies) {
        if (e.dead || e.phased || e.neutral) continue;
        const dd = Math.hypot(e.x - p.x, e.y - p.y);
        if (dd < nd) { nd = dd; near = e; }
      }
      if (near) { this._move(p, p.x * 2 - near.x, p.y * 2 - near.y); return; }
    }

    // ── 위협 회피 (텔레그래프 읽기) — 이동보다 우선. 원거리는 회피 중에도 무빙샷 ──
    const dodge = this._threat(game, p);
    if (dodge) {
      this._move(p, p.x + dodge.x * 120, p.y + dodge.y * 120);
      if (dodge.dash && p.dashCharges >= 1) this._dash();
      if (p.classId !== 'knight' && p.attackCd <= 0) {
        let nt = null, ntd = 460;
        for (const e of game.enemies) {
          if (e.dead || e.phased || e.neutral) continue;
          const dd = Math.hypot(e.x - p.x, e.y - p.y);
          if (dd < ntd && this._hasLoS(p.x, p.y, e.x, e.y)) { ntd = dd; nt = e; }
        }
        if (nt) { Input.justPressed['KeyJ'] = true; Bot.stats.attacks++; }
      }
      return;
    }

    // ── 체력이 낮으면 하트부터 줍는다 ──
    if (p.hp <= Math.max(2, p.maxHp * 0.4) && game.pickups.length > 0) {
      let heart = null, hd = 420;
      for (const pk of game.pickups) {
        const dd = Math.hypot(pk.x - p.x, pk.y - p.y);
        if (dd < hd) { hd = dd; heart = pk; }
      }
      if (heart) { this._move(p, heart.x, heart.y); return; }
    }

    // ── 타겟 선정: 영혼 구슬(장막) > 강령술사 > 보스전 부하 > 최근접 ──
    // 보스전에서 부하를 먼저 끊는 건 정석 플레이 (재생 기믹의 컨트롤 해법이기도 하다)
    let target = null, best = Infinity, near = 0;
    const bossFight = game.enemies.some((e) => e.isBoss && !e.dead);
    const prio = (e) =>
      e.type === 'soulOrb' ? 0 :
      e.type === 'necro' ? 1 :
      (bossFight && !e.isBoss) ? 2 :
      e.isBoss ? 3 : 2;
    for (const e of game.enemies) {
      if (e.dead || e.phased || e.neutral) continue; // 항아리·균열은 전투 타겟이 아니다
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < 300) near++;
      // 시야가 막힌 적은 후순위 — 보이는 적부터 잡는다 (벽 뒤 대치 방지)
      const losPenalty = this._hasLoS(p.x, p.y, e.x, e.y) ? 0 : 2000;
      const score = prio(e) * 10000 + d + losPenalty;
      if (score < best) { best = score; target = e; }
    }

    if (target) {
      const d = Math.hypot(target.x - p.x, target.y - p.y) || 1;
      // 스킬: 적이 몰려있거나 보스전이면 쿨마다
      // (KeyK는 테스트 모드에서 '전멸' 치트와 겹치므로 직접 호출한다)
      // 스킬 사용: 무리/보스 + 방패병(정면 막기는 스킬·광역이 정답) + 교착 3회 이상이면 무조건
      const blocker = !!target.blocksFrom;
      if (this._skillT > 1 && p.skillCd <= 0 && p.dashTimer <= 0 &&
          (near >= 2 || target.isBoss || blocker || this._roomStalls >= 3) && d < 320) {
        p.useSkill(game);
        Bot.stats.skills++;
        this._skillT = 0;
      }
      if (p.classId !== 'knight') {
        // 원거리: 카이팅 (접근이 필요할 때만 진행 감시 — 카이팅 후퇴는 정상 동작)
        const los = this._hasLoS(p.x, p.y, target.x, target.y);
        if (!los) {
          // 장애물이 조준선을 막고 있다 — 옆으로 돌아 시야를 연다
          this._strafeForLoS(p, target, dt);
        } else if (this._roomStalls >= 3 && d > 110) {
          this._move(p, target.x, target.y); // 교착 강행 돌파: 밀착해서 스킬·근접 판정으로 끝낸다
        } else if (d < 160) this._move(p, p.x * 2 - target.x, p.y * 2 - target.y);
        else if (d > 340) { this._move(p, target.x, target.y); this._watchGoal(target, d, dt, p); }
        else this._releaseKeys();
        if (los && p.attackCd <= 0 && d < 500) { Input.justPressed['KeyJ'] = true; Bot.stats.attacks++; }
        if (d < 90 && p.dashCharges >= 1) this._dash();
      } else {
        // 근접: 히트&런 — 준비되면 파고들어 베고, 쿨 중엔 몸을 뺀다
        this._watchGoal(target, d, dt, p);
        if (p.attackCd <= 0) {
          this._move(p, target.x, target.y);
          if (d < 80) {
            p.facing = { x: (target.x - p.x) / d, y: (target.y - p.y) / d };
            Input.justPressed['KeyJ'] = true; Bot.stats.attacks++;
          }
        } else if (d < 62) {
          this._move(p, p.x * 2 - target.x, p.y * 2 - target.y);
        } else {
          this._releaseKeys();
        }
        // 몸이 겹치면 대시로 이탈
        if (d < 32 && p.dashCharges >= 1) this._dash();
      }
    } else {
      // 적 없음: 상호작용(상자/모닥불) → 문
      // 상호작용: 상자/모닥불은 항상, 기연은 이득 조건일 때만 수락
      const it = game.interactables.find((i) => {
        if (i.used) return false;
        if (i.kind === 'chest') return true;
        if (i.kind === 'camp') {
          // 숫돌이 살아 있으면 다쳤을 때만 휴식, 아니면 담금질 쪽으로
          const ws = game.interactables.some((o) => o.kind === 'whetstone' && !o.used);
          return !ws || p.hp < p.maxHp * 0.7;
        }
        if (i.kind === 'whetstone') return p.hp >= p.maxHp * 0.7;                 // 건강하면 공격력을 갈아둔다
        if (i.kind === 'mystery') return p.maxHp >= 4 && p.hp >= 3;              // 도박은 최악을 감당할 수 있을 때만
        if (i.kind === 'cursedChest') return p.maxHp >= 3;                       // 최대 HP 여유가 있으면 유물 거래 수락
        if (i.kind === 'bloodAltar') return p.hp >= 4 && p.hp >= p.maxHp - 1;    // 체력이 넉넉할 때만 피의 계약
        return false;
      });
      if (it) {
        this._move(p, it.x, it.y);
        this._watchGoal(it, Math.hypot(it.x - p.x, it.y - p.y), dt, p);
      } else if (game.enemies.some((e) => !e.dead && e.neutral)) {
        // 항아리·균열 벽 부수기 — 방을 떠나기 전 파괴 가능 오브젝트 회수
        let brk = null, bd = Infinity;
        for (const e of game.enemies) {
          if (e.dead || !e.neutral) continue;
          const dd = Math.hypot(e.x - p.x, e.y - p.y);
          if (dd < bd) { bd = dd; brk = e; }
        }
        this._move(p, brk.x, brk.y);
        this._watchGoal(brk, bd, dt, p);
        if (bd < 70 && p.attackCd <= 0) {
          p.facing = { x: (brk.x - p.x) / (bd || 1), y: (brk.y - p.y) / (bd || 1) };
          Input.justPressed['KeyJ'] = true;
          Bot.stats.attacks++;
        }
      } else if (World.doorsActive && World.doors.length > 0) {
        // 문 선택: 이점이 있는 방을 고른다 — 보물 > 모닥불(다쳤을 때) > 기연 > 정예(카드 보상) > 전투
        const doorScore = (opt) => {
          let s;
          if (opt.type === 'treasure') s = 5;
          else if (opt.type === 'camp') s = p.hp < p.maxHp * 0.7 ? 4.5 : 1.5;
          else if (opt.type === 'event') s = 4;
          else if (opt.type === 'elite') s = 3;
          else if (opt.type === 'shortcut') s = p.hp >= p.maxHp * 0.7 ? 3.5 : 1; // 건강할 때만 지름길
          else s = 2;
          // 문 수식어: 체력이 넉넉하면 위험-보상 문을 선호
          if (opt.mod && p.hp >= p.maxHp * 0.6) s += opt.mod.id === 'guarded' ? 1.5 : 0.8;
          return s;
        };
        let door = World.doors[0];
        for (const d2 of World.doors) {
          if (doorScore(d2.opt) > doorScore(door.opt)) door = d2;
        }
        this._move(p, door.x, door.y);
        this._watchGoal(door, Math.hypot(door.x - p.x, door.y - p.y), dt, p);
      } else this._releaseKeys();
    }
  },

  // 시야(LoS) 판정 — 목표까지 직선상에 벽이 있는가 (24px 간격 샘플링)
  _hasLoS(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(d / 24));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (World.isSolidAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  },

  // 시야가 막혔을 때: 목표를 중심으로 옆으로 돌아 조준선을 연다
  _strafeForLoS(p, target, dt) {
    this._losT = (this._losT || 0) + dt;
    if (this._losT > 1.2) { this._losT = 0; this._losSign = -(this._losSign || 1); }
    const s = this._losSign || 1;
    const dx = target.x - p.x, dy = target.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    // 접선 방향 + 접근 성분 (멀수록 강하게 — 모퉁이를 돌며 다가가야 시야가 열린다)
    const app = d > 200 ? 75 : 25;
    this._move(p, p.x + (-dy / d) * 85 * s + (dx / d) * app, p.y + (dx / d) * 85 * s + (dy / d) * app);
  },

  // 목표 진행 감시 — 3초간 목표에 가까워지지 못하면 탐색 모드 발동 (벽 뒤 목표 우회)
  _watchGoal(ref, dist, dt, p) {
    if (ref !== this._goalKey) {
      this._goalKey = ref;
      this._bestD = dist;
      this._noProgressT = 0;
      return;
    }
    if (dist < this._bestD - 6) {
      this._bestD = dist;
      this._noProgressT = 0;
    } else {
      this._noProgressT += dt;
      if (this._noProgressT > 3) {
        this._explorePt = World.randomSpawnPos(p, 140);
        this._exploreT = 1.8;
        Bot.stats.explores++;
        this._noProgressT = 0;
        this._bestD = Infinity;
        if (p.dashCharges >= 1) this._dash();
      }
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
    // 보스 저주 장판: 예고 원 안에 서 있으면 터지기 전에 벗어난다
    for (const e of game.enemies) {
      if (!e.isBoss || e.dead || !e.curses) continue;
      for (const c of e.curses) {
        const dd = Math.hypot(p.x - c.x, p.y - c.y);
        if (dd < 62 + p.r) {
          return { x: (p.x - c.x) / (dd || 1), y: (p.y - c.y) / (dd || 1), dash: c.t < 0.35 };
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
    // 8방향을 샘플링해 가장 가까운 안전한 방향으로 — 맵 중앙으로 무작정 걷다 더 깊이 빠지지 않게
    if (World.isLavaAt(p.x, p.y + 10) || World.inFog(p.x, p.y)) {
      for (const dist of [70, 130]) {
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const nx = p.x + Math.cos(a) * dist, ny = p.y + Math.sin(a) * dist;
          if (!World.inFog(nx, ny) && !World.isLavaAt(nx, ny + 10) && !World.isSolidAt(nx, ny)) {
            return { x: Math.cos(a), y: Math.sin(a), dash: p.dashCharges >= 1 };
          }
        }
      }
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
