// 절차 생성 방 + 타일 충돌 + 출구 문 + 층 테마/환경 기믹.
// 타일: 0=바닥, 1=벽, 2=용암(비고체, 플레이어 피해)
const TS = 48;

// 층 테마 팔레트 (기획안 §8.2) — 같은 렌더 코드에 색만 갈아끼운다
const FLOOR_THEMES = {
  1: { // 지하 묘지
    floor: ['#1b1b26', '#1e1e2a', '#191922', '#1d1d29'],
    wallBase: '#2a2a3a', wallFace: '#3d3d52', wallDark: '#1c1c28',
  },
  2: { // 곰팡이 동굴 (독 안개)
    floor: ['#16211b', '#182419', '#141f17', '#17231c'],
    wallBase: '#22382a', wallFace: '#2f4d3a', wallDark: '#101a14',
  },
  3: { // 잊힌 감옥 (좁은 감방 구조)
    floor: ['#20202a', '#232330', '#1d1d26', '#212130'],
    wallBase: '#33334a', wallFace: '#474766', wallDark: '#191924',
  },
  4: { // 용암 심층 (바닥 용암)
    floor: ['#241416', '#281618', '#1f1213', '#261517'],
    wallBase: '#3a1f1f', wallFace: '#57302a', wallDark: '#1a0d0e',
  },
  5: { // 심연의 옥좌 (어둠)
    floor: ['#171022', '#191226', '#140e1e', '#181126'],
    wallBase: '#2a1f3d', wallFace: '#3d2c5c', wallDark: '#120b1c',
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
    this.theme = FLOOR_THEMES[floor] || FLOOR_THEMES[1];
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
      const nObstacles = (floor === 3 ? 2 : 0) + RNG.int(2, 4 + Math.min(2, Math.floor(depth / 3)));
      for (let i = 0; i < nObstacles; i++) {
        for (let tries = 0; tries < 20; tries++) {
          const tx = RNG.int(4, this.cols - 5);
          const ty = RNG.int(2, this.rows - 3);
          if (ty === 5) continue; // 가운데 통로 확보
          const vertical = floor === 3 && RNG.chance(0.6); // 감옥 창살
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

    // 2층: 독 안개 지대
    if (floor === 2 && combatRoom) {
      const n = RNG.int(2, 3);
      for (let i = 0; i < n; i++) {
        this.fogZones.push({
          x: RNG.range(TS * 4, TS * (this.cols - 4)),
          y: RNG.range(TS * 2.5, TS * (this.rows - 2.5)) + this.offsetY,
          r: RNG.range(48, 72),
        });
      }
    }

    // 4층: 용암 웅덩이 (보스방 포함)
    if (floor === 4 && (combatRoom || type === 'boss')) {
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

  _prerenderFloor() {
    const c = document.createElement('canvas');
    c.width = this.cols * TS;
    c.height = this.rows * TS;
    const ctx = c.getContext('2d');
    const th = this.theme;

    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const x = tx * TS;
        const y = ty * TS;
        const tile = this.map[ty][tx];
        if (tile === 1) {
          ctx.fillStyle = th.wallBase;
          ctx.fillRect(x, y, TS, TS);
          ctx.fillStyle = th.wallFace;
          ctx.fillRect(x + 3, y + 3, TS - 6, TS - 9);
          ctx.fillStyle = th.wallDark;
          ctx.fillRect(x, y + TS - 4, TS, 4);
          ctx.fillStyle = th.wallBase;
          ctx.fillRect(x, y + TS / 2 - 1, TS, 2);
          ctx.fillRect(x + TS / 2 - 1, y + 3, 2, TS / 2 - 4);
        } else if (tile === 2) {
          // 용암: 어두운 테두리 + 밝은 중심 + 기포
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
        } else {
          ctx.fillStyle = RNG.pick(th.floor);
          ctx.fillRect(x, y, TS, TS);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(x, y, TS, 1);
          ctx.fillRect(x, y, 1, TS);
          if (RNG.chance(0.18)) {
            ctx.fillStyle = 'rgba(120,120,150,0.13)';
            const px = x + RNG.int(6, TS - 12);
            const py = y + RNG.int(6, TS - 12);
            ctx.fillRect(px, py, RNG.int(3, 8), 3);
          }
        }
      }
    }
    this._floorCanvas = c;
  },

  draw(ctx, animT = 0) {
    ctx.drawImage(this._floorCanvas, 0, this.offsetY);

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
      const glow = 0.5 + Math.sin(animT * 4) * 0.2;
      ctx.fillStyle = '#120d16';
      ctx.fillRect(d.x - 16, d.y - 26, 32, 52);
      ctx.strokeStyle = d.opt.color;
      ctx.globalAlpha = glow;
      ctx.lineWidth = 3;
      ctx.strokeRect(d.x - 16, d.y - 26, 32, 52);
      ctx.globalAlpha = 1;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#08080f';
      ctx.fillText(d.opt.label, d.x + 1, d.y - 33);
      ctx.fillStyle = d.opt.color;
      ctx.fillText(d.opt.label, d.x, d.y - 34);
    }
  },
};
