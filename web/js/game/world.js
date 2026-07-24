// 절차 생성 방 + 타일 충돌 + 출구 문 + 층 테마/환경 기믹.
// 타일: 0=바닥, 1=벽, 2=용암(비고체, 플레이어 피해)
const TS = 48;

// 층 테마 팔레트 (기획안 §8.2) — 같은 렌더 코드에 색만 갈아끼운다
// roof: 벽 윗면, grade: 층 컬러 그레이딩, accent: 횃불 빛, decals: 바닥 장식 종류
const FLOOR_THEMES = {
  1: { // 지하 묘지
    floor: ['#1b1b26', '#1e1e2a', '#191922', '#1d1d29'],
    wallBase: '#2a2a3a', wallFace: '#3d3d52', wallDark: '#1c1c28', roof: '#14141d',
    grade: 'rgba(60,60,110,0.05)', accent: '#ff9a3c',
    decals: ['skull', 'bones', 'crack', 'pebbles'],
  },
  2: { // 곰팡이 동굴 (독 안개)
    floor: ['#16211b', '#182419', '#141f17', '#17231c'],
    wallBase: '#22382a', wallFace: '#2f4d3a', wallDark: '#101a14', roof: '#0d1710',
    grade: 'rgba(50,140,70,0.06)', accent: '#8adf76',
    decals: ['moss', 'spore', 'puddle', 'pebbles'],
  },
  3: { // 잊힌 감옥 (좁은 감방 구조)
    floor: ['#20202a', '#232330', '#1d1d26', '#212130'],
    wallBase: '#33334a', wallFace: '#474766', wallDark: '#191924', roof: '#16161f',
    grade: 'rgba(90,90,140,0.05)', accent: '#a9c1d8',
    decals: ['chain', 'crack', 'bones', 'pebbles'],
  },
  4: { // 용암 심층 (바닥 용암)
    floor: ['#241416', '#281618', '#1f1213', '#261517'],
    wallBase: '#3a1f1f', wallFace: '#57302a', wallDark: '#1a0d0e', roof: '#170b0c',
    grade: 'rgba(220,90,30,0.06)', accent: '#ff7043',
    decals: ['ember', 'crack', 'pebbles'],
  },
  5: { // 심연의 옥좌 (어둠)
    floor: ['#171022', '#191226', '#140e1e', '#181126'],
    wallBase: '#2a1f3d', wallFace: '#3d2c5c', wallDark: '#120b1c', roof: '#0e0817',
    grade: 'rgba(120,40,140,0.06)', accent: '#b13ae0',
    decals: ['skull', 'crack', 'voidspeck'],
  },
  // ── 6~10층 심층: 더 어둡고 핏빛으로 물든 변주 ──
  6: { // 피의 묘지
    floor: ['#221419', '#26161c', '#1d1216', '#24151a'],
    wallBase: '#3a222c', wallFace: '#522e3d', wallDark: '#1c1014', roof: '#170c10',
    grade: 'rgba(200,40,60,0.07)', accent: '#e43b44',
    decals: ['skull', 'bones', 'crack', 'pebbles'],
  },
  7: { // 맹독 심연
    floor: ['#101c14', '#121f12', '#0e1a10', '#111e15'],
    wallBase: '#1a2e20', wallFace: '#26422e', wallDark: '#0b140e', roof: '#08110b',
    grade: 'rgba(80,180,60,0.08)', accent: '#6ab04c',
    decals: ['moss', 'spore', 'puddle', 'bones'],
  },
  8: { // 절망의 감옥
    floor: ['#181820', '#1b1b25', '#15151d', '#191924'],
    wallBase: '#282838', wallFace: '#383850', wallDark: '#12121a', roof: '#0e0e15',
    grade: 'rgba(70,70,120,0.08)', accent: '#a9c1d8',
    decals: ['chain', 'crack', 'bones', 'skull'],
  },
  9: { // 겁화의 핵
    floor: ['#2a1210', '#2e1412', '#25100e', '#2c1311'],
    wallBase: '#451f18', wallFace: '#663026', wallDark: '#1e0d0a', roof: '#1a0a08',
    grade: 'rgba(255,90,30,0.09)', accent: '#ffd866',
    decals: ['ember', 'crack'],
  },
  10: { // 심연의 왕좌
    floor: ['#120a1c', '#140b20', '#0f0818', '#130a1f'],
    wallBase: '#241636', wallFace: '#352052', wallDark: '#0e0716', roof: '#0a0511',
    grade: 'rgba(150,30,160,0.09)', accent: '#e43b44',
    decals: ['skull', 'voidspeck', 'crack'],
  },
};

// 층별 환경 기믹 (테마 순환)
const FLOOR_HAZARDS = { 2: 'fog', 3: 'prison', 4: 'lava', 5: 'dark', 7: 'fog', 8: 'prison', 9: 'lava', 10: 'dark' };

// 바닥 장식 그리기 루틴 — 전부 코드 픽셀
const DECAL_PAINTERS = {
  skull(ctx, x, y) {
    ctx.fillStyle = '#c9c2b2';
    ctx.fillRect(x, y, 10, 8);
    ctx.fillRect(x + 2, y + 8, 6, 3);
    ctx.fillStyle = '#1a1c2c';
    ctx.fillRect(x + 2, y + 3, 2, 3);
    ctx.fillRect(x + 6, y + 3, 2, 3);
  },
  bones(ctx, x, y) {
    ctx.fillStyle = '#a99e8c';
    ctx.fillRect(x, y + 4, 14, 2);
    ctx.fillRect(x + 4, y, 2, 10);
    ctx.fillStyle = '#c9c2b2';
    ctx.fillRect(x - 1, y + 3, 3, 4);
    ctx.fillRect(x + 12, y + 3, 3, 4);
  },
  crack(ctx, x, y) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    let cx = x, cy = y;
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(cx, cy, 3, 2);
      cx += RNG.int(2, 5);
      cy += RNG.int(-2, 4);
    }
  },
  pebbles(ctx, x, y) {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = RNG.pick(['#4a4a5c', '#3a3a48', '#5c5c70']);
      ctx.fillRect(x + RNG.int(0, 14), y + RNG.int(0, 10), 3, 2);
    }
  },
  moss(ctx, x, y) {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = RNG.pick(['#2f6b3a', '#38b76433', '#245530']);
      ctx.fillRect(x + RNG.int(0, 16), y + RNG.int(0, 12), RNG.int(2, 5), 2);
    }
  },
  spore(ctx, x, y) {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = RNG.pick(['#8a5ac2', '#c56cf0']);
      ctx.fillRect(x + RNG.int(0, 14), y + RNG.int(0, 12), 2, 2);
    }
  },
  puddle(ctx, x, y) {
    ctx.fillStyle = 'rgba(60,180,100,0.15)';
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 6, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  chain(ctx, x, y) {
    ctx.strokeStyle = '#5c5c70';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.strokeRect(x + 2, y + i * 6, 5, 5);
    }
  },
  ember(ctx, x, y) {
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = RNG.pick(['#e2582266', '#ffd86655', '#7a101088']);
      ctx.fillRect(x + RNG.int(0, 14), y + RNG.int(0, 10), 3, 3);
    }
  },
  voidspeck(ctx, x, y) {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = RNG.pick(['#b13ae044', '#5c1e5e66']);
      ctx.fillRect(x + RNG.int(0, 14), y + RNG.int(0, 12), 2, 2);
    }
  },
};

const World = {
  cols: 20,
  rows: 11,
  offsetY: 6,
  map: [],
  doors: [],
  doorsActive: false,
  fogZones: [],   // 독 안개 (2층) — 플레이어 피해
  lavaTiles: [],  // 용암 타일 좌표 (4층 발광 연출용)
  theme: FLOOR_THEMES[1],
  floor: 1,
  _floorCanvas: null,

  buildRoom(depth, type, floor = 1) {
    this.floor = floor;
    // 11층+ (무한 모드): 6~10층 테마·기믹을 순환
    const themeKey = floor <= 10 ? floor : ((floor - 11) % 5) + 6;
    this.theme = FLOOR_THEMES[themeKey] || FLOOR_THEMES[1];
    this.hazard = floor <= 10 ? (FLOOR_HAZARDS[floor] || null) : (FLOOR_HAZARDS[themeKey] || null);
    this.fogZones = [];
    this.lavaTiles = [];

    this.map = [];
    for (let y = 0; y < this.rows; y++) {
      const row = [];
      for (let x = 0; x < this.cols; x++) {
        row.push(y === 0 || y === this.rows - 1 || x === 0 || x === this.cols - 1 ? 1 : 0);
      }
      this.map.push(row);
    }

    const combatRoom = type === 'combat' || type === 'elite';

    if (combatRoom) {
      // 장애물 (3층 감옥은 세로 창살 느낌으로 더 많이)
      const nObstacles = (this.hazard === 'prison' ? 2 : 0) + RNG.int(2, 4 + Math.min(2, Math.floor(depth / 3)));
      for (let i = 0; i < nObstacles; i++) {
        for (let tries = 0; tries < 20; tries++) {
          const tx = RNG.int(4, this.cols - 5);
          const ty = RNG.int(2, this.rows - 3);
          if (ty === 5) continue; // 가운데 통로 확보
          const vertical = this.hazard === 'prison' && RNG.chance(0.6); // 감옥 창살
          const wide = !vertical && RNG.chance(0.4);
          if (this.map[ty][tx] !== 0) continue;
          this.map[ty][tx] = 1;
          if (vertical && ty + 1 < this.rows - 2 && ty + 1 !== 5 && this.map[ty + 1][tx] === 0) {
            this.map[ty + 1][tx] = 1;
          } else if (wide && tx + 1 < this.cols - 2 && this.map[ty][tx + 1] === 0) {
            this.map[ty][tx + 1] = 1;
          }
          break;
        }
      }
    }

    // 독 안개 지대
    if (this.hazard === 'fog' && combatRoom) {
      const n = RNG.int(2, 3);
      for (let i = 0; i < n; i++) {
        this.fogZones.push({
          x: RNG.range(TS * 4, TS * (this.cols - 4)),
          y: RNG.range(TS * 2.5, TS * (this.rows - 2.5)) + this.offsetY,
          r: RNG.range(48, 72),
        });
      }
    }

    // 용암 웅덩이 (보스방 포함)
    if (this.hazard === 'lava' && (combatRoom || type === 'boss')) {
      const n = type === 'boss' ? 3 : RNG.int(2, 4);
      for (let i = 0; i < n; i++) {
        const tx = RNG.int(3, this.cols - 5);
        const ty = RNG.int(2, this.rows - 4);
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            if (this.map[ty + dy][tx + dx] === 0 && ty + dy !== 5) {
              this.map[ty + dy][tx + dx] = 2;
              this.lavaTiles.push({ tx: tx + dx, ty: ty + dy });
            }
          }
        }
      }
    }

    this.doors = [];
    this.doorsActive = false;
    this._prerenderFloor();
  },

  openDoors(options) {
    const slots = { 1: [5], 2: [3, 7], 3: [2, 5, 8] }[options.length] || [5];
    this.doors = options.map((opt, i) => ({
      x: (this.cols - 1.5) * TS,
      y: slots[i] * TS + TS / 2 + this.offsetY,
      opt,
    }));
    this.doorsActive = true;
  },

  isSolidTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return true;
    return this.map[ty][tx] === 1;
  },

  isSolidAt(x, y) {
    return this.isSolidTile(Math.floor(x / TS), Math.floor((y - this.offsetY) / TS));
  },

  // 용암 위에 서 있는지 (플레이어 발 위치 기준)
  isLavaAt(x, y) {
    const tx = Math.floor(x / TS);
    const ty = Math.floor((y - this.offsetY) / TS);
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return false;
    return this.map[ty][tx] === 2;
  },

  // 독 안개 안에 있는지
  inFog(x, y) {
    return this.fogZones.some((f) => Math.hypot(x - f.x, y - f.y) < f.r);
  },

  boxCollides(x, y, r) {
    return (
      this.isSolidAt(x - r, y - r) || this.isSolidAt(x + r, y - r) ||
      this.isSolidAt(x - r, y + r) || this.isSolidAt(x + r, y + r)
    );
  },

  moveEntity(e, dx, dy) {
    const hit = { x: false, y: false };
    if (dx !== 0) {
      if (!this.boxCollides(e.x + dx, e.y, e.r)) e.x += dx;
      else hit.x = true;
    }
    if (dy !== 0) {
      if (!this.boxCollides(e.x, e.y + dy, e.r)) e.y += dy;
      else hit.y = true;
    }
    return hit;
  },

  // 벽 무시 이동 (망령 비물질 상태)
  moveGhost(e, dx, dy) {
    e.x = Math.min(Math.max(e.x + dx, TS * 0.7), TS * (this.cols - 0.7));
    e.y = Math.min(Math.max(e.y + dy, this.offsetY + TS * 0.7), this.offsetY + TS * (this.rows - 0.7));
  },

  randomSpawnPos(player, minDist = 190) {
    for (let tries = 0; tries < 60; tries++) {
      const tx = RNG.int(2, this.cols - 3);
      const ty = RNG.int(1, this.rows - 2);
      if (this.map[ty][tx] !== 0) continue;
      const x = tx * TS + TS / 2;
      const y = ty * TS + TS / 2 + this.offsetY;
      if (Math.hypot(x - player.x, y - player.y) >= minDist) return { x, y };
    }
    return { x: TS * 2.5, y: TS * 2 + this.offsetY };
  },

  center() {
    return { x: (this.cols / 2) * TS, y: (this.rows / 2) * TS + this.offsetY };
  },

  playerStart() {
    return { x: TS * 1.7, y: (this.rows / 2) * TS + this.offsetY };
  },

  _wallAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return true;
    return this.map[ty][tx] === 1;
  },

  // [아트 리마스터] 오토타일 벽(정면/윗면 구분) + 테마 데코 + 벽 그림자 + 횃불 배치
  _prerenderFloor() {
    const c = document.createElement('canvas');
    c.width = this.cols * TS;
    c.height = this.rows * TS;
    const ctx = c.getContext('2d');
    const th = this.theme;
    this.torches = [];

    // 1) 바닥 + 용암
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const x = tx * TS;
        const y = ty * TS;
        const tile = this.map[ty][tx];
        if (tile === 1) continue;
        if (tile === 2) {
          ctx.fillStyle = '#7a1010';
          ctx.fillRect(x, y, TS, TS);
          ctx.fillStyle = '#c0392b';
          ctx.fillRect(x + 2, y + 2, TS - 4, TS - 4);
          ctx.fillStyle = '#e25822';
          ctx.fillRect(x + 6, y + 6, TS - 12, TS - 12);
          ctx.fillStyle = '#ffd866';
          for (let i = 0; i < 3; i++) {
            ctx.fillRect(x + RNG.int(8, TS - 12), y + RNG.int(8, TS - 12), 4, 4);
          }
          continue;
        }
        // 석판 바닥: 명암 변화 + 줄눈
        ctx.fillStyle = RNG.pick(th.floor);
        ctx.fillRect(x, y, TS, TS);
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(x, y, TS, 1);
        ctx.fillRect(x, y, 1, TS);
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(x + 1, y + 1, TS - 2, 1);
        if (RNG.chance(0.15)) {
          ctx.fillStyle = 'rgba(120,120,150,0.1)';
          ctx.fillRect(x + RNG.int(6, TS - 12), y + RNG.int(6, TS - 12), RNG.int(3, 8), 3);
        }
      }
    }

    // 2) 바닥 데코 (테마별, 스폰 위치 회피 불필요 — 순수 장식)
    const nDecals = RNG.int(9, 15);
    for (let i = 0; i < nDecals; i++) {
      const tx = RNG.int(1, this.cols - 2);
      const ty = RNG.int(1, this.rows - 2);
      if (this.map[ty][tx] !== 0) continue;
      const painter = DECAL_PAINTERS[RNG.pick(th.decals)];
      if (painter) painter(ctx, tx * TS + RNG.int(6, TS - 22), ty * TS + RNG.int(6, TS - 18));
    }

    // 3) 벽 (오토타일: 아래가 바닥이면 정면, 아니면 윗면)
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        if (this.map[ty][tx] !== 1) continue;
        const x = tx * TS;
        const y = ty * TS;
        const faceDown = !this._wallAt(tx, ty + 1); // 아래가 바닥 → 벽 정면이 보임

        if (faceDown) {
          // 정면: 벽돌 쌓기 + 윗면 캡 + 아래 어두운 립
          ctx.fillStyle = th.wallBase;
          ctx.fillRect(x, y, TS, TS);
          ctx.fillStyle = th.wallFace;
          ctx.fillRect(x + 1, y + 8, TS - 2, TS - 14);
          // 벽돌 줄눈 (엇갈린 패턴)
          ctx.fillStyle = th.wallBase;
          ctx.fillRect(x, y + 8 + 13, TS, 2);
          ctx.fillRect(x + TS / 2 - 1, y + 8, 2, 13);
          ctx.fillRect(x + TS / 4 - 1, y + 23, 2, 12);
          ctx.fillRect(x + (TS * 3) / 4 - 1, y + 23, 2, 12);
          // 윗면 캡
          ctx.fillStyle = th.roof;
          ctx.fillRect(x, y, TS, 8);
          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          ctx.fillRect(x, y + 7, TS, 1);
          // 아래 립
          ctx.fillStyle = th.wallDark;
          ctx.fillRect(x, y + TS - 6, TS, 6);
          // 벽돌 하이라이트
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(x + 2, y + 9, TS / 2 - 3, 2);
        } else {
          // 윗면(지붕): 어둡고 평평하게 + 미세 노이즈
          ctx.fillStyle = th.roof;
          ctx.fillRect(x, y, TS, TS);
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          for (let i = 0; i < 3; i++) {
            ctx.fillRect(x + RNG.int(2, TS - 8), y + RNG.int(2, TS - 4), RNG.int(3, 6), 1);
          }
          // 바닥과 접한 좌우 모서리에 얇은 하이라이트
          if (!this._wallAt(tx - 1, ty)) {
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.fillRect(x, y, 2, TS);
          }
          if (!this._wallAt(tx + 1, ty)) {
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.fillRect(x + TS - 2, y, 2, TS);
          }
        }

        // 횃불 배치: 정면 벽에 일정 간격으로
        if (faceDown && tx % 5 === 2 && RNG.chance(0.85)) {
          this.torches.push({ x: x + TS / 2, y: y + TS - 16, seed: RNG.next() * 10 });
        }
      }
    }

    // 4) 벽 아래 바닥 그림자 (입체감)
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        if (this.map[ty][tx] === 1) continue;
        const x = tx * TS;
        const y = ty * TS;
        if (this._wallAt(tx, ty - 1)) {
          const g = ctx.createLinearGradient(0, y, 0, y + 14);
          g.addColorStop(0, 'rgba(0,0,0,0.4)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x, y, TS, 14);
        }
        if (this._wallAt(tx - 1, ty)) {
          const g = ctx.createLinearGradient(x, 0, x + 8, 0);
          g.addColorStop(0, 'rgba(0,0,0,0.25)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x, y, 8, TS);
        }
      }
    }

    this._floorCanvas = c;
  },

  draw(ctx, animT = 0) {
    ctx.drawImage(this._floorCanvas, 0, this.offsetY);

    // 횃불: 깜빡이는 불꽃 + 따뜻한 빛 번짐
    for (const t of this.torches || []) {
      const y = t.y + this.offsetY;
      const flick = Math.sin(animT * 11 + t.seed) * 0.5 + Math.sin(animT * 23 + t.seed * 3) * 0.3;
      // 받침대
      ctx.fillStyle = '#3d2418';
      ctx.fillRect(t.x - 2, y, 4, 8);
      // 불꽃 (3단)
      ctx.fillStyle = '#ff7043';
      ctx.fillRect(t.x - 3, y - 6 + flick, 6, 6);
      ctx.fillStyle = '#ffd866';
      ctx.fillRect(t.x - 2, y - 9 + flick * 1.4, 4, 5);
      ctx.fillStyle = '#fff7c0';
      ctx.fillRect(t.x - 1, y - 7 + flick, 2, 3);
      // 빛 번짐
      const glow = ctx.createRadialGradient(t.x, y - 4, 4, t.x, y - 4, 66 + flick * 6);
      glow.addColorStop(0, 'rgba(255,150,60,0.13)');
      glow.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(t.x, y - 4, 70, 0, Math.PI * 2);
      ctx.fill();
    }

    // 용암 발광 펄스
    if (this.lavaTiles.length > 0) {
      ctx.globalAlpha = 0.15 + Math.sin(animT * 3) * 0.08;
      ctx.fillStyle = '#ffd866';
      for (const t of this.lavaTiles) {
        ctx.fillRect(t.tx * TS, t.ty * TS + this.offsetY, TS, TS);
      }
      ctx.globalAlpha = 1;
    }

    // 독 안개 (초록 원, 일렁임)
    for (const f of this.fogZones) {
      const pulse = 1 + Math.sin(animT * 2 + f.x) * 0.06;
      const g = ctx.createRadialGradient(f.x, f.y, f.r * 0.2, f.x, f.y, f.r * pulse);
      g.addColorStop(0, 'rgba(106,176,76,0.30)');
      g.addColorStop(1, 'rgba(106,176,76,0.04)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawDoors(ctx, animT) {
    if (!this.doorsActive) return;
    for (const d of this.doors) {
      const c = d.opt.color;
      const pulse = 0.5 + Math.sin(animT * 3 + d.y * 0.01) * 0.18;

      // 바닥 빛 웅덩이
      ctx.save();
      ctx.globalAlpha = 0.16 + pulse * 0.1;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y + 30, 26, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 석조 프레임 (기둥 + 아치 + 쐐기돌)
      ctx.fillStyle = '#0d0a12';
      ctx.fillRect(d.x - 20, d.y - 22, 40, 52); // 안쪽 어둠
      ctx.fillStyle = '#2a2438';
      ctx.fillRect(d.x - 26, d.y - 22, 7, 54);  // 왼 기둥
      ctx.fillRect(d.x + 19, d.y - 22, 7, 54);  // 오른 기둥
      ctx.beginPath();                          // 아치
      ctx.arc(d.x, d.y - 20, 26, Math.PI, 0);
      ctx.arc(d.x, d.y - 20, 19, 0, Math.PI, true);
      ctx.fill();
      ctx.fillStyle = '#3a3450';                // 기둥 하이라이트 + 쐐기돌
      ctx.fillRect(d.x - 25, d.y - 22, 2, 54);
      ctx.fillRect(d.x + 20, d.y - 22, 2, 54);
      ctx.fillRect(d.x - 4, d.y - 48, 8, 9);
      ctx.fillStyle = '#1a1626';                // 받침돌
      ctx.fillRect(d.x - 27, d.y + 28, 54, 5);

      // 포탈 내부 발광 (방 타입 색)
      ctx.save();
      ctx.beginPath();
      ctx.rect(d.x - 19, d.y - 21, 38, 50);
      ctx.arc(d.x, d.y - 20, 19, Math.PI, 0);
      ctx.clip();
      const g = ctx.createRadialGradient(d.x, d.y + 2, 3, d.x, d.y + 2, 34);
      g.addColorStop(0, c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.34 + pulse * 0.22;
      ctx.fillStyle = g;
      ctx.fillRect(d.x - 20, d.y - 42, 40, 74);
      // 세로 일렁임
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#ffffff';
      for (let k = 0; k < 3; k++) {
        const sx = d.x - 12 + k * 12 + Math.sin(animT * 2 + k * 2.1) * 3;
        ctx.fillRect(sx, d.y - 38, 2, 66);
      }
      // 상승 입자 (결정적 애니메이션 — 랜덤 없음)
      ctx.fillStyle = c;
      for (let k = 0; k < 4; k++) {
        const ph = (animT * 22 + k * 17) % 52;
        ctx.globalAlpha = 0.5 * (1 - ph / 52);
        ctx.fillRect(d.x - 10 + k * 7, d.y + 24 - ph, 2, 2);
      }
      ctx.restore();

      // 타입 아이콘 (포탈 중앙)
      this._doorIcon(ctx, d.opt.type, d.x, d.y - 2, c, pulse);

      // 명판 (라벨)
      const w = ctx.measureText ? Math.max(40, d.opt.label.length * 13 + 14) : 46;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#0d0a12';
      ctx.fillRect(d.x - w / 2, d.y - 66, w, 18);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c;
      ctx.lineWidth = 1;
      ctx.strokeRect(d.x - w / 2, d.y - 66, w, 18);
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = c;
      ctx.fillText(d.opt.label, d.x, d.y - 53);
    }
  },

  // 방 타입별 문 아이콘 — 외부 폰트 없이 도형으로 그린다
  _doorIcon(ctx, type, x, y, color, pulse) {
    ctx.save();
    ctx.globalAlpha = 0.75 + pulse * 0.25;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    if (type === 'combat') {
      // 교차하는 두 자루 검
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x - 8 * s, y + 8);
        ctx.lineTo(x + 8 * s, y - 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - 8 * s, y + 4);
        ctx.lineTo(x - 4 * s, y + 8);
        ctx.stroke();
      }
    } else if (type === 'elite') {
      // 왕관
      ctx.beginPath();
      ctx.moveTo(x - 9, y + 6); ctx.lineTo(x - 9, y - 3); ctx.lineTo(x - 4, y + 1);
      ctx.lineTo(x, y - 7); ctx.lineTo(x + 4, y + 1); ctx.lineTo(x + 9, y - 3);
      ctx.lineTo(x + 9, y + 6); ctx.closePath();
      ctx.fill();
    } else if (type === 'treasure') {
      // 보물상자
      ctx.fillRect(x - 9, y - 2, 18, 9);
      ctx.beginPath();
      ctx.arc(x, y - 2, 9, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#0d0a12';
      ctx.fillRect(x - 1.5, y - 2, 3, 5);
    } else if (type === 'camp') {
      // 모닥불 불꽃
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.quadraticCurveTo(x + 8, y - 1, x + 5, y + 5);
      ctx.quadraticCurveTo(x + 3, y + 8, x, y + 8);
      ctx.quadraticCurveTo(x - 6, y + 7, x - 5, y + 1);
      ctx.quadraticCurveTo(x - 4, y - 3, x, y - 9);
      ctx.fill();
    } else if (type === 'boss') {
      // 해골
      ctx.beginPath();
      ctx.arc(x, y - 2, 8, Math.PI * 0.9, Math.PI * 0.1);
      ctx.fill();
      ctx.fillRect(x - 8, y - 2, 16, 6);
      ctx.fillRect(x - 5, y + 4, 3, 4);
      ctx.fillRect(x + 2, y + 4, 3, 4);
      ctx.fillStyle = '#0d0a12';
      ctx.beginPath();
      ctx.arc(x - 3.5, y - 2, 2.2, 0, Math.PI * 2);
      ctx.arc(x + 3.5, y - 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'nextfloor') {
      // 아래로 향하는 계단 화살표
      ctx.beginPath();
      ctx.moveTo(x, y + 8); ctx.lineTo(x - 8, y - 2); ctx.lineTo(x - 3, y - 2);
      ctx.lineTo(x - 3, y - 8); ctx.lineTo(x + 3, y - 8); ctx.lineTo(x + 3, y - 2);
      ctx.lineTo(x + 8, y - 2); ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  },
};
