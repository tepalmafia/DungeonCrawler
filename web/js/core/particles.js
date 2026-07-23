// 파티클 + 떠오르는 데미지 숫자. 전부 코드 생성 — 이미지 리소스 없음.
const Particles = {
  list: [],
  texts: [],

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
  },

  draw(ctx) {
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
  },
};
