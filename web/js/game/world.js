// 전투 아레나(M1은 고정 맵 1개, M2에서 절차 생성으로 교체 예정) + 타일 충돌
const TS = 48; // 타일 크기 (16px 스프라이트 × 3배)

const World = {
  cols: 20,
  rows: 11,
  offsetY: 6, // 540 - 11*48 = 12px, 위아래 6px씩 여백
  map: [],
  _floorCanvas: null,

  init() {
    const layout = [
      '####################',
      '#..................#',
      '#..................#',
      '#....#........#....#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#....#........#....#',
      '#..................#',
      '#..................#',
      '####################',
    ];
    this.map = layout.map((row) => row.split('').map((c) => (c === '#' ? 1 : 0)));
    this._prerenderFloor();
  },

  isSolidTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return true;
    return this.map[ty][tx] === 1;
  },

  // 점(월드 좌표)이 벽 안인지
  isSolidAt(x, y) {
    return this.isSolidTile(Math.floor(x / TS), Math.floor((y - this.offsetY) / TS));
  },

  // 반지름 r의 사각 히트박스가 벽과 겹치는지
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

  // 플레이어와 충분히 떨어진 무작위 바닥 위치 (적 스폰용)
  randomSpawnPos(player, minDist = 190) {
    for (let tries = 0; tries < 60; tries++) {
      const tx = RNG.int(1, this.cols - 2);
      const ty = RNG.int(1, this.rows - 2);
      if (this.map[ty][tx] !== 0) continue;
      const x = tx * TS + TS / 2;
      const y = ty * TS + TS / 2 + this.offsetY;
      if (Math.hypot(x - player.x, y - player.y) >= minDist) return { x, y };
    }
    return { x: TS * 2, y: TS * 2 + this.offsetY };
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
          // 벽: 석재 블록
          ctx.fillStyle = '#2a2a3a';
          ctx.fillRect(x, y, TS, TS);
          ctx.fillStyle = '#3d3d52';
          ctx.fillRect(x + 3, y + 3, TS - 6, TS - 9);
          ctx.fillStyle = '#1c1c28';
          ctx.fillRect(x, y + TS - 4, TS, 4);
          // 벽돌 줄눈
          ctx.fillStyle = '#2a2a3a';
          ctx.fillRect(x, y + TS / 2 - 1, TS, 2);
          ctx.fillRect(x + TS / 2 - 1, y + 3, 2, TS / 2 - 4);
        } else {
          // 바닥: 어두운 석판 + 무작위 명암
          const shade = RNG.pick(['#1b1b26', '#1e1e2a', '#191922', '#1d1d29']);
          ctx.fillStyle = shade;
          ctx.fillRect(x, y, TS, TS);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(x, y, TS, 1);
          ctx.fillRect(x, y, 1, TS);
          // 가끔 균열/자갈 디테일
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
};
