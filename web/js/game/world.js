// 절차 생성 방 + 타일 충돌 + 출구 문. 방마다 장애물 배치가 달라진다.
const TS = 48; // 타일 크기 (16px 스프라이트 × 3배)

const World = {
  cols: 20,
  rows: 11,
  offsetY: 6,
  map: [],
  doors: [],        // 출구 문 (방 클리어 시 활성화)
  doorsActive: false,
  _floorCanvas: null,

  // 방 생성 — 테두리 벽 + 타입별 장애물 패턴
  buildRoom(depth, type) {
    this.map = [];
    for (let y = 0; y < this.rows; y++) {
      const row = [];
      for (let x = 0; x < this.cols; x++) {
        row.push(y === 0 || y === this.rows - 1 || x === 0 || x === this.cols - 1 ? 1 : 0);
      }
      this.map.push(row);
    }

    // 전투방에만 장애물 (보스방/보물방/모닥불방은 개방형)
    if (type === 'combat' || type === 'elite') {
      const nObstacles = RNG.int(2, 4 + Math.min(2, Math.floor(depth / 3)));
      for (let i = 0; i < nObstacles; i++) {
        for (let tries = 0; tries < 20; tries++) {
          const tx = RNG.int(4, this.cols - 5); // 입구(좌)·문(우) 근처 회피
          const ty = RNG.int(2, this.rows - 3);
          if (ty === 5) continue; // 가운데 통로는 항상 확보 (막힘 방지)
          const wide = RNG.chance(0.4);
          if (this.map[ty][tx] === 0 && (!wide || this.map[ty][tx + 1] === 0)) {
            this.map[ty][tx] = 1;
            if (wide && tx + 1 < this.cols - 2) this.map[ty][tx + 1] = 1;
            break;
          }
        }
      }
    }

    this.doors = [];
    this.doorsActive = false;
    this._prerenderFloor();
  },

  // 방 클리어 → 출구 문 생성. options: [{type,label,color}]
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

  boxCollides(x, y, r) {
    return (
      this.isSolidAt(x - r, y - r) || this.isSolidAt(x + r, y - r) ||
      this.isSolidAt(x - r, y + r) || this.isSolidAt(x + r, y + r)
    );
  },

  // 축 분리 이동 — 벽에 막히면 해당 축만 멈춘다. 충돌한 축 정보를 반환.
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

    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const x = tx * TS;
        const y = ty * TS;
        if (this.map[ty][tx] === 1) {
          ctx.fillStyle = '#2a2a3a';
          ctx.fillRect(x, y, TS, TS);
          ctx.fillStyle = '#3d3d52';
          ctx.fillRect(x + 3, y + 3, TS - 6, TS - 9);
          ctx.fillStyle = '#1c1c28';
          ctx.fillRect(x, y + TS - 4, TS, 4);
          ctx.fillStyle = '#2a2a3a';
          ctx.fillRect(x, y + TS / 2 - 1, TS, 2);
          ctx.fillRect(x + TS / 2 - 1, y + 3, 2, TS / 2 - 4);
        } else {
          const shade = RNG.pick(['#1b1b26', '#1e1e2a', '#191922', '#1d1d29']);
          ctx.fillStyle = shade;
          ctx.fillRect(x, y, TS, TS);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(x, y, TS, 1);
          ctx.fillRect(x, y, 1, TS);
          if (RNG.chance(0.18)) {
            ctx.fillStyle = '#26263442';
            const px = x + RNG.int(6, TS - 12);
            const py = y + RNG.int(6, TS - 12);
            ctx.fillRect(px, py, RNG.int(3, 8), 3);
          }
        }
      }
    }
    this._floorCanvas = c;
  },

  draw(ctx) {
    ctx.drawImage(this._floorCanvas, 0, this.offsetY);
  },

  drawDoors(ctx, animT) {
    if (!this.doorsActive) return;
    for (const d of this.doors) {
      const glow = 0.5 + Math.sin(animT * 4) * 0.2;
      // 문 아치
      ctx.fillStyle = '#120d16';
      ctx.fillRect(d.x - 16, d.y - 26, 32, 52);
      ctx.strokeStyle = d.opt.color;
      ctx.globalAlpha = glow;
      ctx.lineWidth = 3;
      ctx.strokeRect(d.x - 16, d.y - 26, 32, 52);
      ctx.globalAlpha = 1;
      // 방 종류 라벨
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#08080f';
      ctx.fillText(d.opt.label, d.x + 1, d.y - 33);
      ctx.fillStyle = d.opt.color;
      ctx.fillText(d.opt.label, d.x, d.y - 34);
    }
  },
};
