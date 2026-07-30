// Canvas 렌더링 + 카메라 셰이크. 24px 픽셀아트는 2배 확대(픽셀 퍼펙트)로 그린다.
const SCALE = 2;

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
    // 설정: 화면 흔들림 강도 (0이면 완전 끔)
    const s = (typeof Meta !== 'undefined' && Meta.data && Meta.data.opts) ? (Meta.data.opts.shake ?? 1) : 1;
    if (s <= 0) return;
    mag *= s;
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

  // ── 카메라 (v189) ──────────────────────────────────────────────────────
  // 사장: "맵도 계속 이어져 있다는 느낌이 들어야해."
  // 실측: 방 전환 450회가 전부 방향 없는 666ms 검정 페이드였고, 런당 300초(5분)가
  // 검정 화면이었다. 방 사이에 '이동'이 없고 '암전'이 있었다.
  // panX/panY는 그 암전을 **이동**으로 바꾸는 최소 장치이자, 앞으로 들어올
  // 스크롤 카메라가 앉을 자리다 — 월드 변환 지점은 여기 한 곳뿐이다
  panX: 0,
  panY: 0,

  begin() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = '#08080f';
    this.ctx.fillRect(0, 0, this.W, this.H);
    this.ctx.translate(Math.round(this.offsetX + this.panX), Math.round(this.offsetY + this.panY));
  },

  // 스프라이트를 중심 기준으로 그린다. squash: 스쿼시&스트레치, shadow: 발밑 그림자
  // 이 지점을 비추는 가장 센 광원 → {a: 방향, k: 세기, warm}
  // 광원이 없으면 약한 상단광(달빛)으로 떨어진다 — 완전 무광이면 실루엣이 납작해진다
  lights: [],
  lightAt(x, y) {
    let best = null, bk = 0;
    for (const L of this.lights) {
      const dx = L.x - x, dy = L.y - y;
      const d = Math.hypot(dx, dy);
      if (d > L.r) continue;
      const k = (1 - d / L.r) * (L.i || 1);
      if (k > bk) { bk = k; best = { a: Math.atan2(dy, dx), k: Math.min(0.8, k * 0.95), warm: !!L.warm }; }
    }
    return best || { a: -Math.PI / 2, k: 0.2, warm: false }; // 위에서 오는 창백한 기본광
  },

  drawSprite(img, x, y, { flip = false, alpha = 1, squashX = 1, squashY = 1, rot = 0, scale = SCALE, shadow = false, light = null } = {}) {
    // 고유 배율(__ds): 원본 해상도를 올린 스프라이트가 화면에서 거인이 되지 않게 한다.
    // 호출부가 배율을 명시하지 않은 경우에만 적용한다 (보스 def.scale 등은 그대로 존중)
    if (scale === SCALE && img && img.__ds) scale = img.__ds;
    // 프레임 누락 방어 (v147): undefined가 오면 이 프레임의 렌더 전체가 예외로 죽는다 (소크에서 간헐 관측).
    // 스킵하고 호출 스택을 기록해 원인 스프라이트를 추적한다
    if (!img) {
      if (!window.__spriteErr) { window.__spriteErr = new Error().stack; console.warn('drawSprite: undefined img\n', window.__spriteErr); }
      return;
    }
    const ctx = this.ctx;
    const w = img.width * scale * squashX;
    const h = img.height * scale * squashY;

    if (shadow) {
      ctx.save();
      ctx.globalAlpha = 0.28 * alpha;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(Math.round(x), Math.round(y + h / 2 - 4), w * 0.26, w * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (rot) ctx.rotate(rot);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, Math.round(-w / 2), Math.round(-h / 2), w, h);
    // ── 림라이트 (v180) — 광원 쪽 가장자리만 밝다 ──
    // 이게 없으면 횃불 옆 해골과 구석 해골이 똑같이 밝아, 캐릭터가 배경 '위'에 얹혀 보인다.
    // light = {a: 광원 방향(rad), k: 세기 0~1, warm: 불빛인가}
    if (light && light.k > 0.02 && typeof Sprites !== 'undefined' && Sprites.rim) {
      // ① 몸 전체가 빛을 받는다 — **이게 substance고 림은 detail이다.**
      // 실측 교훈: 가장자리만 밝히면 화면 변화가 0.04%라 "작동하지만 안 보인다".
      // 횃불 옆 해골은 테두리만이 아니라 **몸이 따뜻해져야** 장면 안에 있는 것으로 읽힌다
      // ★ v184: **흰 실루엣이 아니라 스프라이트 자신**을 겹친다.
      // `Sprites.white()`는 자동 생성된 검은 아웃라인까지 흰색으로 만들기 때문에,
      // 그걸 `lighter`로 얹으면 **테두리가 흰 후광이 된다**(사장 스크린샷으로 발각).
      // 자기 자신을 겹치면 밝은 곳은 더 밝아지고 **검은 아웃라인은 검은 채로 남는다** —
      // 픽셀아트의 윤곽선이 살아 있어야 형태가 읽힌다
      ctx.globalAlpha = alpha * Math.min(0.3, light.k * 0.38);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(img, Math.round(-w / 2), Math.round(-h / 2), w, h);
      // ② 광원 쪽 가장자리 (rim)
      // flip 상태에서는 좌우가 뒤집히므로 방향도 뒤집어야 빛이 같은 쪽에 남는다
      const ang = flip ? Math.PI - light.a : light.a;
      const n = Sprites.RIM_DIRS || 8;
      const di = ((Math.round((ang / (Math.PI * 2)) * n) % n) + n) % n;
      ctx.globalAlpha = alpha * Math.min(0.34, light.k * 0.5);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(Sprites.rim(img, di, !!light.warm), Math.round(-w / 2), Math.round(-h / 2), w, h);
    }
    ctx.restore();
  },
};
