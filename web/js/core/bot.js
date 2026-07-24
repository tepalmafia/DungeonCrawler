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

  // 벽 인지 회피: 가려는 방향이 막혔으면 가까운 열린 각도로 회전 — "벽에 몸 비비기" 방지
  _freeDir(p, dir, dist = 90) {
    const base = Math.atan2(dir.y, dir.x);
    for (const off of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.2, -2.2, Math.PI]) {
      const a = base + off;
      const ca = Math.cos(a), sa = Math.sin(a);
      if (!World.isSolidAt(p.x + ca * dist * 0.5, p.y + sa * dist * 0.5) &&
          !World.isSolidAt(p.x + ca * dist, p.y + sa * dist)) {
        return { x: ca, y: sa, dash: dir.dash };
      }
    }
    return dir;
  },

  // 타일 BFS 경로 탐색 — 벽 너머 목표로 가는 다음 경유지를 돌려준다 (250ms 캐시)
  // 경로 스무딩: 시야가 열리는 가장 먼 노드로 직행해 지그재그를 줄인다
  _pathStep(p, tx, ty) {
    const oy = World.offsetY || 0;
    const sx = Math.max(0, Math.min(World.cols - 1, Math.floor(p.x / TS)));
    const sy = Math.max(0, Math.min(World.rows - 1, Math.floor((p.y - oy) / TS)));
    const gx = Math.max(0, Math.min(World.cols - 1, Math.floor(tx / TS)));
    const gy = Math.max(0, Math.min(World.rows - 1, Math.floor((ty - oy) / TS)));
    const key = sx + ',' + sy + ':' + gx + ',' + gy;
    const now = performance.now();
    if (this._pc && this._pc.key === key && now - this._pc.at < 250) return this._pc.step;
    // 1차: 용암(2)까지 피해서 탐색, 실패 시 2차: 용암 허용 (지나가며 1 피해 감수)
    const bfs = (avoidLava) => {
      const prev = new Map();
      prev.set(sx + ',' + sy, null);
      const q = [[sx, sy]];
      while (q.length) {
        const [cx, cy] = q.shift();
        if (cx === gx && cy === gy) return prev;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= World.cols || ny >= World.rows) continue;
          const k = nx + ',' + ny;
          const tile = World.map[ny] ? World.map[ny][nx] : 1;
          if (prev.has(k) || tile === 1 || (avoidLava && tile === 2)) continue;
          prev.set(k, cx + ',' + cy);
          q.push([nx, ny]);
        }
      }
      return null;
    };
    const prev = bfs(true) || bfs(false);
    const found = !!prev;
    let step = null;
    if (found) {
      const path = [];
      let cur = gx + ',' + gy;
      while (cur) { path.push(cur); cur = prev.get(cur); }
      path.reverse();
      for (let i = Math.min(path.length - 1, 7); i >= 1; i--) {
        const [nx, ny] = path[i].split(',').map(Number);
        const wx = nx * TS + TS / 2, wy = ny * TS + TS / 2 + oy;
        // 몸통 폭 시야로 스무딩 — 모서리에 몸이 걸리는 경유지는 건너뛰지 않는다
        if (this._hasLoSFat(p.x, p.y, wx, wy)) { step = { x: wx, y: wy }; break; }
      }
      if (!step && path.length > 1) {
        const [nx, ny] = path[1].split(',').map(Number);
        step = { x: nx * TS + TS / 2, y: ny * TS + TS / 2 + oy };
      }
    }
    this._pc = { key, step, at: now };
    return step;
  },

  _move(p, tx, ty) {
    this._releaseKeys();
    // 벽 너머(또는 몸이 모서리에 걸릴) 목표면 BFS 경유지로 치환 — 벽에 대고 걷는 대신 돌아간다
    if (!this._hasLoSFat(p.x, p.y, tx, ty)) {
      const step = this._pathStep(p, tx, ty);
      if (step) {
        // 경유지에 도달했으면 캐시를 깨서 즉시 다음 경유지로 — 멈칫거림 방지
        if (Math.hypot(step.x - p.x, step.y - p.y) < 22 && this._pc) this._pc.at = 0;
        tx = step.x; ty = step.y;
      }
    }
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
    // ── 배속 토글 (관전용): 플레이/거점 중 1~4 키 = ×1~×4 ──
    // (카드 선택 화면에서는 숫자가 카드 선택이므로 제외)
    if (game.state === 'play' || game.state === 'hub') {
      for (let k = 1; k <= 4; k++) {
        if (Input.justPressed['Digit' + k]) this.ff = k;
      }
    }
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
      // 우회 방향은 열린 쪽에서만 뽑는다 — 무작위가 다시 벽을 고르면 끼임이 반복된다
      const cands = [];
      for (let k = 0; k < 8; k++) {
        const a2 = (k / 8) * Math.PI * 2 + Math.random() * 0.4;
        if (!World.isSolidAt(p.x + Math.cos(a2) * 70, p.y + Math.sin(a2) * 70)) cands.push(a2);
      }
      const a = cands.length ? cands[Math.floor(Math.random() * cands.length)] : Math.random() * Math.PI * 2;
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

    // ── 구석 몰림 탈출: 벽에 등을 대고 포위당하면 가장 열린 방향으로 대시 관통 ──
    // (회피가 "적 반대 = 벽 안쪽"만 가리키며 갇히는 사고 방지. 대시 무적이 포위망 돌파 수단 —
    //  근접몹을 뚫으며 완벽 회피 판정까지 챙길 수 있다)
    if (this._cornerCd > 0) this._cornerCd -= dt;
    else {
      let solidSides = 0;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        if (World.isSolidAt(p.x + Math.cos(a) * 55, p.y + Math.sin(a) * 55)) solidSides++;
      }
      let nearFoes = 0, cx = 0, cy = 0;
      for (const e of game.enemies) {
        if (e.dead || e.neutral || e.phased) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < 120) { nearFoes++; cx += e.x; cy += e.y; }
      }
      if (solidSides >= 4 && nearFoes >= 2) {
        cx /= nearFoes; cy /= nearFoes;
        let best = null, bestScore = -Infinity;
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          const dx2 = Math.cos(a), dy2 = Math.sin(a);
          let open = 0;
          for (const d2 of [50, 100, 150]) {
            if (!World.isSolidAt(p.x + dx2 * d2, p.y + dy2 * d2)) open++;
          }
          const cd = Math.hypot(p.x - cx, p.y - cy) || 1;
          const away = (dx2 * (p.x - cx) + dy2 * (p.y - cy)) / cd;
          // 열린 정도가 우선, 적 반대쪽 약한 가점 — 필요하면 적을 뚫고라도 나간다
          const score = open * 2 + away;
          if (score > bestScore) { bestScore = score; best = { x: dx2, y: dy2 }; }
        }
        if (best) {
          this._cornerCd = 1.5;
          this._detour = best;
          this._detourT = 0.55;
          Bot.stats.cornerEscapes = (Bot.stats.cornerEscapes || 0) + 1;
          if (p.dashCharges >= 1) this._dash();
          this._move(p, p.x + best.x * 140, p.y + best.y * 140);
          return;
        }
      }
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
        // 하드 스톨 계측: 5회 누적 시 방 상태를 콘솔에 덤프 — 간헐 교착의 범인을 잡는다
        if (this._roomStalls === 5 || this._roomStalls === 12) {
          const snap = game.enemies.filter((e) => !e.dead).map((e) => ({
            t: e.type, x: Math.round(e.x), y: Math.round(e.y), hp: Math.round(e.hp),
            ph: !!e.phased, sp: +(e.spawnT || 0).toFixed(2), neu: !!e.neutral,
            wall: World.isSolidAt(e.x, e.y), st: e.state || null,
          }));
          console.log('[BOT-STALL]', JSON.stringify({
            floor: Dungeon.floor, room: Dungeon.roomIndex, type: Dungeon.roomType,
            time: Math.round(game.time), px: Math.round(p.x), py: Math.round(p.y),
            cls: p.classId, skillCd: +p.skillCd.toFixed(1),
            pend: game.pendingSpawns.length, markers: game.markers.length, enemies: snap,
          }));
        }
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
    // 회피 방향이 벽이면 열린 각도로 회전 (벽 인지) — 구석으로 밀려 들어가지 않는다
    const dodgeRaw = this._threat(game, p);
    const dodge = dodgeRaw ? this._freeDir(p, dodgeRaw, 100) : null;
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
        if (i.used || i._botSkip) return false;
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
          else if (opt.type === 'vault') s = 5.5; // 비밀 금고: 공짜 보상 — 최우선
          else if (opt.type === 'camp') s = p.hp < p.maxHp * 0.7 ? 4.5 : 1.5;
          else if (opt.type === 'event') s = 4;
          else if (opt.type === 'elite') s = 3;
          else if (opt.type === 'siege') s = p.hp >= p.maxHp * 0.6 ? 3 : 1.2; // 습격: 버틸 체력일 때만
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

  // 몸통 폭(±r)을 고려한 시야 — 가는 선은 통과해도 몸이 모서리에 걸리는 경로를 걸러낸다
  // (통로 이동이 덜컹거리는 주범: 중심선 LoS만 보고 직진하다 모서리에 몸이 끼는 것)
  _hasLoSFat(x0, y0, x1, y1, r = 11) {
    const d = Math.hypot(x1 - x0, y1 - y0) || 1;
    const px = (-(y1 - y0) / d) * r, py = ((x1 - x0) / d) * r;
    return this._hasLoS(x0 + px, y0 + py, x1 + px, y1 + py) &&
           this._hasLoS(x0 - px, y0 - py, x1 - px, y1 - py);
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
      this._goalFails = 0;
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
        this._goalFails = (this._goalFails || 0) + 1;
        // 같은 목표에 6회 연속 실패 = 도달 불가로 판정 — 덤프 남기고 상호작용물은 포기
        // (문은 포기 불가 — 덤프만 남긴다. 소크가 게임 버그에 인질로 잡히지 않게)
        if (this._goalFails >= 6 && ref) {
          if (ref.kind) ref._botSkip = true;
          console.log('[BOT-GOALSTUCK]', JSON.stringify({
            kind: ref.kind || (ref.opt ? 'door:' + ref.opt.type : 'obj'),
            x: Math.round(ref.x), y: Math.round(ref.y),
            floor: Dungeon.floor, room: Dungeon.roomIndex, tpl: World.lastTemplate || null,
            fog: World.inFog(p.x, p.y), cleared: !!Game.roomCleared,
          }));
          this._goalFails = 0;
        }
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
    // 단, 방 클리어 후 안개는 그냥 걸어서 통과한다 — 문 앞 안개 웅덩이에서 회피가
    // 이동을 영원히 가로막는 진동 스톨(대시 2000회 계측)의 범인이었다. 독 틱은 감수
    if (World.isLavaAt(p.x, p.y + 10) || (!game.roomCleared && World.inFog(p.x, p.y))) {
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
