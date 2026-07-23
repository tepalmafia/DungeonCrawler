// 파티클 + 떠오르는 데미지 숫자. 전부 코드 생성 — 이미지 리소스 없음.
const Particles = {
  list: [],
  texts: [],
  rings: [],   // 확장 충격파 링 (타격 이펙트)
  slashes: [], // 임팩트 스타 (교차 섬광선)

  // 타격 지점에서 퍼지는 링
  ring(x, y, { r0 = 4, r1 = 30, life = 0.22, color = '#ffffff', width = 3 } = {}) {
    this.rings.push({ x, y, r0, r1, life, maxLife: life, color, width });
  },

  // 크리티컬용 교차 섬광 (4방향 별)
  star(x, y, { size = 26, life = 0.16, color = '#fff7c0' } = {}) {
    this.slashes.push({ x, y, size, life, maxLife: life, color, rot: Math.random() * Math.PI });
  },

  burst(x, y, { count = 8, colors = ['#ffffff'], speed = 120, life = 0.4, size = 3, gravity = 0, spread = Math.PI * 2, dir = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = dir + (Math.random() - 0.5) * spread;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.list.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life * (0.6 + Math.random() * 0.7),
        maxLife: life,
        size: size * (0.7 + Math.random() * 0.6),
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity,
      });
    }
  },

  text(x, y, str, { color = '#ffffff', size = 15, life = 0.7 } = {}) {
    this.texts.push({ x, y, str, color, size, life, maxLife: life, vy: -55 });
  },

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.vx *= Math.pow(0.02, dt); // 감쇠
      p.vy *= Math.pow(0.05, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) { this.texts.splice(i, 1); continue; }
      t.y += t.vy * dt;
      t.vy *= Math.pow(0.1, dt);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].life -= dt;
      if (this.rings[i].life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      this.slashes[i].life -= dt;
      if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
    }
  },

  draw(ctx) {
    // 충격파 링
    for (const r of this.rings) {
      const k = 1 - r.life / r.maxLife; // 0→1
      const rad = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - k, 2)); // ease-out
      ctx.save();
      ctx.globalAlpha = (r.life / r.maxLife) * 0.85;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(1, r.width * (r.life / r.maxLife));
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // 임팩트 스타 (교차 섬광선)
    for (const s of this.slashes) {
      const k = s.life / s.maxLife;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.globalAlpha = k;
      ctx.strokeStyle = s.color;
      ctx.lineCap = 'round';
      for (const [len, w] of [[s.size * (1.4 - k * 0.4), 3], [s.size * 0.55, 2]]) {
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(-len, 0); ctx.lineTo(len, 0);
        ctx.moveTo(0, -len); ctx.lineTo(0, len);
        ctx.stroke();
        ctx.rotate(Math.PI / 4);
      }
      ctx.restore();
    }

    for (const p of this.list) {
      ctx.globalAlpha = Math.min(1, p.life / (p.maxLife * 0.5));
      ctx.fillStyle = p.color;
      const s = Math.max(1, Math.round(p.size * (p.life / p.maxLife + 0.3)));
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const pop = t.maxLife - t.life < 0.1 ? 1.4 : 1; // 등장 직후 살짝 커지는 팝 효과
      ctx.globalAlpha = Math.min(1, t.life / (t.maxLife * 0.4));
      ctx.font = `bold ${Math.round(t.size * pop)}px monospace`;
      ctx.fillStyle = '#08080f';
      ctx.fillText(t.str, Math.round(t.x) + 2, Math.round(t.y) + 2);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, Math.round(t.x), Math.round(t.y));
    }
    ctx.globalAlpha = 1;
  },

  clear() {
    this.list.length = 0;
    this.texts.length = 0;
    this.rings.length = 0;
    this.slashes.length = 0;
  },
};
