// Canvas 렌더링 + 카메라 셰이크. 픽셀아트는 3배 확대(픽셀 퍼펙트)로 그린다.
const SCALE = 3;

const Renderer = {
  canvas: null,
  ctx: null,
  W: 960,
  H: 540,
  _shakeMag: 0,
  _shakeDur: 0,
  offsetX: 0,
  offsetY: 0,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
  },

  shake(mag, dur = 0.2) {
    // 더 강한 셰이크가 이미 진행 중이면 유지
    if (mag >= this._shakeMag) {
      this._shakeMag = mag;
      this._shakeDur = dur;
    }
  },

  update(dt) {
    if (this._shakeDur > 0) {
      this._shakeDur -= dt;
      const m = this._shakeMag * Math.min(1, this._shakeDur * 5);
      this.offsetX = (Math.random() * 2 - 1) * m;
      this.offsetY = (Math.random() * 2 - 1) * m;
      if (this._shakeDur <= 0) this._shakeMag = 0;
    } else {
      this.offsetX = 0;
      this.offsetY = 0;
    }
  },

  begin() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = '#08080f';
    this.ctx.fillRect(0, 0, this.W, this.H);
    this.ctx.translate(Math.round(this.offsetX), Math.round(this.offsetY));
  },

  // 스프라이트를 중심 기준으로 그린다. squash: 스쿼시&스트레치 애니메이션용
  drawSprite(img, x, y, { flip = false, alpha = 1, squashX = 1, squashY = 1, rot = 0 } = {}) {
    const ctx = this.ctx;
    const w = img.width * SCALE * squashX;
    const h = img.height * SCALE * squashY;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (rot) ctx.rotate(rot);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, Math.round(-w / 2), Math.round(-h / 2), w, h);
    ctx.restore();
  },
};
