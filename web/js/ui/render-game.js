// 게임 렌더링 — 월드/개체/이펙트를 그리고 HUD로 위임한다.
// main.js에서 Object.assign(Game, GameRender)으로 Game에 합쳐진다.
const GameRender = {
  // ── 장판 텍스처 (v116) — 단색 원이 아니라 '그 물질'로 보이게 ──
  // kind: poison(독 웅덩이) fire(불길) ice(빙판) shock(감전) smoke(연막)
  _drawGroundPatch(ctx, x, y, r, kind, alpha, t, seed) {
    if (alpha <= 0.01) return;
    // v135: 테두리 제거 — 림 스트로크를 없애고 가장자리를 그라데이션 페이드로.
    // 10각 폴리곤이 '각진 테두리'로 읽히던 것도 24분할로 완화 (실플레이 제보)
    const N = 24;
    const blob = (rad, wob) => {
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const w = 1 - wob + wob * (0.5 + 0.5 * Math.sin(seed * 3.7 + a * 3.4));
        const rr = rad * w;
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.92; // 살짝 눌린 웅덩이 원근
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };
    ctx.save();
    if (kind === 'poison') {
      // 독 웅덩이: 어두운 심연 → 가장자리로 녹아 사라지는 독기 + 떠오르는 기포
      ctx.globalAlpha = alpha;
      const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
      g.addColorStop(0, 'rgba(28,52,24,0.95)');
      g.addColorStop(0.62, 'rgba(58,96,44,0.85)');
      g.addColorStop(0.86, 'rgba(122,176,76,0.5)');
      g.addColorStop(1, 'rgba(122,176,76,0)');
      ctx.fillStyle = g;
      blob(r, 0.14); ctx.fill();
      // 기포: 자리에서 커졌다 터진다
      for (let i = 0; i < 4; i++) {
        const ph = ((t * (0.5 + (i % 3) * 0.2) + i * 0.31 + seed * 0.13) % 1);
        const ba = seed * 1.3 + i * 2.4;
        const bx = x + Math.cos(ba) * r * (0.25 + (i % 3) * 0.2);
        const by = y + Math.sin(ba) * r * 0.5 * (0.3 + (i % 2) * 0.35);
        ctx.globalAlpha = alpha * (1 - ph) * 0.9;
        ctx.strokeStyle = '#c8e89a';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(bx, by, 1.5 + ph * 3.5, 0, Math.PI * 2); ctx.stroke();
      }
    } else if (kind === 'fire') {
      // 불길: 그을린 바닥이 가장자리로 스러진다 + 일렁이는 불꽃 혀 + 잔불
      ctx.globalAlpha = alpha * 0.9;
      const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
      g.addColorStop(0, 'rgba(90,30,10,0.9)');
      g.addColorStop(0.55, 'rgba(160,60,20,0.7)');
      g.addColorStop(0.85, 'rgba(40,18,10,0.4)');
      g.addColorStop(1, 'rgba(40,18,10,0)');
      ctx.fillStyle = g;
      blob(r, 0.12); ctx.fill();
      for (let i = 0; i < 6; i++) {
        const fa = seed * 2.1 + i * 1.05;
        const fx = x + Math.cos(fa) * r * (0.2 + (i % 3) * 0.22);
        const fy = y + Math.sin(fa) * r * 0.5 * (0.25 + (i % 2) * 0.3);
        const fh = (7 + (i % 3) * 4) * (0.7 + 0.3 * Math.sin(t * 11 + i * 1.7 + seed));
        const fw = 4 + (i % 2) * 2;
        ctx.globalAlpha = alpha * (0.75 + 0.25 * Math.sin(t * 13 + i));
        ctx.fillStyle = i % 3 === 0 ? '#ffd866' : '#e25822';
        ctx.beginPath();
        ctx.moveTo(fx - fw / 2, fy);
        ctx.quadraticCurveTo(fx - fw / 2, fy - fh * 0.5, fx + Math.sin(t * 9 + i) * 2, fy - fh);
        ctx.quadraticCurveTo(fx + fw / 2, fy - fh * 0.5, fx + fw / 2, fy);
        ctx.closePath(); ctx.fill();
      }
      // 잔불 점
      for (let i = 0; i < 5; i++) {
        const ea = seed * 0.7 + i * 1.9;
        ctx.globalAlpha = alpha * (0.4 + 0.6 * ((Math.sin(t * 7 + i * 2.3) + 1) / 2));
        ctx.fillStyle = '#ffb347';
        ctx.fillRect(x + Math.cos(ea) * r * 0.7, y + Math.sin(ea) * r * 0.6, 2, 2);
      }
    } else if (kind === 'ice') {
      // 빙판: 창백한 판 + 방사 균열 + 반짝임 — 가장자리는 서리로 녹는다
      ctx.globalAlpha = alpha;
      const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
      g.addColorStop(0, 'rgba(200,228,240,0.75)');
      g.addColorStop(0.8, 'rgba(120,170,200,0.45)');
      g.addColorStop(1, 'rgba(120,170,200,0)');
      ctx.fillStyle = g;
      blob(r, 0.1); ctx.fill();
      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeStyle = '#eaf6ff';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const ca = seed * 1.7 + i * 1.55;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(ca) * r * 0.15, y + Math.sin(ca) * r * 0.12);
        ctx.lineTo(x + Math.cos(ca + 0.2) * r * 0.55, y + Math.sin(ca + 0.2) * r * 0.5);
        ctx.lineTo(x + Math.cos(ca - 0.12) * r * 0.9, y + Math.sin(ca - 0.12) * r * 0.82);
        ctx.stroke();
      }
      ctx.globalAlpha = alpha * (0.5 + 0.5 * Math.sin(t * 5 + seed));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + Math.cos(seed) * r * 0.4 - 1, y + Math.sin(seed) * r * 0.3 - 1, 2, 2);
    } else if (kind === 'shock') {
      // ⚡ 전류 지대 (v200) — 지지직 튀는 가지. 정적인 원이 아니라 **매 프레임 다른 모양**
      ctx.globalAlpha = alpha * 0.55;
      const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
      g.addColorStop(0, 'rgba(120,96,20,0.6)');
      g.addColorStop(0.7, 'rgba(90,72,16,0.32)');
      g.addColorStop(1, 'rgba(90,72,16,0)');
      ctx.fillStyle = g; blob(r, 0.1); ctx.fill();
      ctx.strokeStyle = '#ffd866'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const a0 = seed * 1.7 + i * 1.26 + t * 2.1;
        ctx.globalAlpha = alpha * (0.5 + 0.5 * Math.sin(t * 22 + i * 2));
        ctx.beginPath();
        let px = x, py = y;
        ctx.moveTo(px, py);
        for (let k = 1; k <= 4; k++) {
          const rr = (r / 4) * k;
          px = x + Math.cos(a0 + Math.sin(t * 9 + k + i) * 0.5) * rr;
          py = y + Math.sin(a0 + Math.sin(t * 9 + k + i) * 0.5) * rr * 0.55;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    } else if (kind === 'curse') {
      // 🕯 저주 지대 (v200) — 바닥에서 피어오르는 손. 보라 안개 + 솟는 획
      ctx.globalAlpha = alpha * 0.8;
      const g = ctx.createRadialGradient(x, y, r * 0.12, x, y, r);
      g.addColorStop(0, 'rgba(48,16,72,0.92)');
      g.addColorStop(0.6, 'rgba(96,36,140,0.62)');
      g.addColorStop(1, 'rgba(140,60,200,0)');
      ctx.fillStyle = g; blob(r, 0.16); ctx.fill();
      for (let i = 0; i < 6; i++) {
        const ph = ((t * 0.55 + i * 0.17 + seed * 0.11) % 1);
        const ha = seed * 2.3 + i * 1.05;
        const hx = x + Math.cos(ha) * r * (0.2 + (i % 3) * 0.24);
        const hy = y + Math.sin(ha) * r * 0.45;
        ctx.globalAlpha = alpha * (1 - ph) * 0.9;
        ctx.strokeStyle = '#c88aff'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + Math.sin(t * 3 + i) * 3, hy - 6 - ph * 14);
        ctx.stroke();
      }
    } else if (kind === 'smoke') {
      // 연막: 겹치는 회색 뭉게 — 느리게 소용돌이
      for (let i = 0; i < 5; i++) {
        const sa = t * 0.4 * (i % 2 ? 1 : -1) + i * 1.3 + seed;
        const sx = x + Math.cos(sa) * r * 0.35;
        const sy = y + Math.sin(sa) * r * 0.3;
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = i % 2 ? '#9aa0b4' : '#6e7383';
        ctx.beginPath(); ctx.arc(sx, sy, r * (0.4 + (i % 3) * 0.14), 0, Math.PI * 2); ctx.fill();
      }
    } else {
      // 감전: 가장자리로 잦아드는 대전(帶電) 원반 + 튀는 번개 아크
      ctx.globalAlpha = alpha * 0.55;
      const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
      g.addColorStop(0, 'rgba(255,216,102,0.55)');
      g.addColorStop(0.7, 'rgba(255,216,102,0.4)');
      g.addColorStop(1, 'rgba(255,216,102,0)');
      ctx.fillStyle = g;
      blob(r, 0.08); ctx.fill();
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const pulse = (Math.sin(t * 17 + i * 2.6 + seed) + 1) / 2;
        if (pulse < 0.55) continue; // 번개는 깜빡이며 친다
        ctx.globalAlpha = alpha * pulse;
        ctx.strokeStyle = i === 0 ? '#fff7c0' : '#ffd866';
        const la = seed * 2.3 + i * 2.1 + Math.floor(t * 8) * 0.7;
        ctx.beginPath();
        let lx = x + Math.cos(la) * r * 0.15, ly = y + Math.sin(la) * r * 0.15;
        ctx.moveTo(lx, ly);
        for (let s2 = 1; s2 <= 4; s2++) {
          lx = x + Math.cos(la + Math.sin(s2 * 3.1 + t * 8) * 0.5) * r * (0.15 + s2 * 0.2);
          ly = y + Math.sin(la + Math.cos(s2 * 2.7 + t * 8) * 0.5) * r * (0.15 + s2 * 0.2) * 0.9;
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  },

  // ── 무기화된 투사체 (v192) ──────────────────────────────────────────────
  // 사장: "동그라미는 불꽃이나 기타 보스가 쓰는 무기 공격으로 디자인해주고"
  // 도형으로 그린다 — 스프라이트를 새로 만들지 않는다. 픽셀 스타일과 어울리게
  // 각을 살리고(뼈), 프레임마다 형태가 흔들리게(불꽃) 한다
  _drawWeaponProj(ctx, a, style) {
    const ang = Math.atan2(a.dir.y, a.dir.x);
    ctx.save();
    ctx.translate(a.x, a.y);
    if (style.shape === 'bone') {
      // 뼛조각 — 날아가며 돈다. 무덤지기가 퍼올려 던지는 것
      ctx.rotate(a.t * 11 + (a.seed || 0));
      const L = a.r * 1.9, K = a.r * 0.62;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-L / 2 + 1, -K / 2 + 1.5, L, K);           // 밑그림자 (두께감)
      ctx.fillStyle = style.color;
      ctx.fillRect(-L / 2, -K / 2, L, K);                      // 뼈 몸통
      ctx.beginPath();                                          // 양 끝 관절 혹
      ctx.arc(-L / 2, -K * 0.55, K * 0.75, 0, Math.PI * 2);
      ctx.arc(-L / 2, K * 0.55, K * 0.75, 0, Math.PI * 2);
      ctx.arc(L / 2, -K * 0.55, K * 0.75, 0, Math.PI * 2);
      ctx.arc(L / 2, K * 0.55, K * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';                 // 위쪽 하이라이트
      ctx.fillRect(-L / 2 + 1, -K / 2, L - 2, 1.5);
    } else if (style.shape === 'wisp') {
      // 원혼 — 꼬리가 늘어지는 혼불. 진행 반대로 흩어진다
      ctx.rotate(ang);
      const w = a.r * 2.8, h = a.r * 1.6;
      const f = Math.sin(a.t * 15 + (a.seed || 0)) * 0.28;
      for (const [k, col] of [[1.0, 'rgba(60,20,80,0.5)'], [0.7, style.color], [0.36, '#e2b6ff']]) {
        ctx.beginPath();
        ctx.moveTo(a.r * 0.9 * k, 0);
        ctx.quadraticCurveTo(-w * 0.1, h * 0.55 * k * (1 + f), -w * 0.7 * k, 0);
        ctx.quadraticCurveTo(-w * 0.1, -h * 0.55 * k * (1 - f), a.r * 0.9 * k, 0);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
      }
    } else if (style.shape === 'blob') {
      // 오물·포자 덩어리 — 꿈틀거리며 날아간다
      ctx.rotate(a.t * 3.5 + (a.seed || 0));
      const N = 7;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const an = (i / N) * Math.PI * 2;
        const rr = a.r * (0.82 + 0.3 * Math.sin(an * 3 + a.t * 9 + (a.seed || 0)));
        const px = Math.cos(an) * rr, py = Math.sin(an) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = style.color; ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath(); ctx.arc(a.r * 0.22, a.r * 0.22, a.r * 0.34, 0, Math.PI * 2); ctx.fill();
    } else if (style.shape === 'shard') {
      // 파편 — 뾰족한 조각. 날아가며 돈다
      ctx.rotate(ang + a.t * 6);
      const L = a.r * 2.2, W2 = a.r * 0.9;
      ctx.beginPath();
      ctx.moveTo(L * 0.5, 0); ctx.lineTo(-L * 0.3, W2 * 0.5);
      ctx.lineTo(-L * 0.5, 0); ctx.lineTo(-L * 0.3, -W2 * 0.5);
      ctx.closePath();
      ctx.fillStyle = style.color; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(L * 0.5, 0); ctx.lineTo(-L * 0.3, -W2 * 0.5); ctx.lineTo(-L * 0.1, 0);
      ctx.closePath(); ctx.fill();
    } else if (style.shape === 'flame') {
      // 불꽃 — 진행 방향으로 눕고 꼬리가 펄럭인다
      ctx.rotate(ang);
      const w = a.r * 2.4, h = a.r * 1.5;
      const f = Math.sin(a.t * 26 + (a.seed || 0)) * 0.3;
      for (const [k, col] of [[1.0, '#8a2a10'], [0.72, style.color], [0.42, '#ffd866'], [0.2, '#fff6c8']]) {
        ctx.beginPath();
        ctx.moveTo(w * 0.5 * k, 0);
        ctx.quadraticCurveTo(0, h * 0.5 * k * (1 + f), -w * 0.62 * k, h * 0.22 * k);
        ctx.quadraticCurveTo(-w * 0.24 * k, 0, -w * 0.62 * k, -h * 0.22 * k);
        ctx.quadraticCurveTo(0, -h * 0.5 * k * (1 - f), w * 0.5 * k, 0);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
      }
    }
    ctx.restore();
  },

  render() {
    const ctx = Renderer.ctx;
    Renderer.begin();

    if (this.state === 'hub' || this.state === 'altar' || this.state === 'classes' || this.state === 'codex') {
      if (this.state === 'hub') HUD.drawHub(ctx, this.blinkT);
      else if (this.state === 'altar') HUD.drawAltar(ctx, this.blinkT);
      else if (this.state === 'classes') HUD.drawClasses(ctx, this.blinkT);
      else HUD.drawCodex(ctx, this.blinkT, this);
      // 거점 배너 (F9 리포트 복사 등) — 플레이 HUD와 별개 경로라 여기서 직접 그린다 (v146: 안 보이던 버그)
      if (this.state === 'hub' && this.banner) {
        const b = this.banner;
        ctx.save();
        ctx.globalAlpha = Math.min(1, (b.life / b.maxLife) * 3);
        ctx.font = 'bold 15px Galmuri11, monospace';
        ctx.textAlign = 'center';
        const bw = ctx.measureText(b.text).width + 30;
        ctx.fillStyle = 'rgba(8,8,15,0.85)';
        ctx.fillRect(Renderer.W / 2 - bw / 2, 26, bw, 28);
        ctx.strokeStyle = '#3a3a4c';
        ctx.strokeRect(Renderer.W / 2 - bw / 2 + 0.5, 26.5, bw - 1, 27);
        ctx.fillStyle = b.color || '#f7b32b';
        ctx.fillText(b.text, Renderer.W / 2, 45);
        ctx.restore();
      }
      if (this.showManual) HUD.drawManual(ctx, this, this.showManual);
      if (this.showSettings) HUD.drawSettings(ctx, this);
      return;
    }

    World.draw(ctx, this.blinkT);

    World.drawDoors(ctx, this.blinkT);

    // 불길/독/빙판 장판 (플레이어 위험) — 물질감 텍스처 (v116)
    for (const fp of this.firePatches) {
      const a = Math.min(0.85, fp.life * 0.75);
      this._drawGroundPatch(ctx, fp.x, fp.y, fp.r, fp.kind, a, this.blinkT, (fp.x * 7 + fp.y * 13) % 97);
      if (Math.random() < 0.2) {
        Particles.burst(fp.x + (Math.random() - 0.5) * fp.r * 1.2, fp.y + (Math.random() - 0.5) * fp.r * 1.2, {
          count: 1, colors: fp.kind === 'poison' ? ['#6ab04c'] : fp.kind === 'ice' ? ['#c8e4f0'] : ['#ff7043', '#ffd866'],
          speed: 20, life: 0.35, size: 3, gravity: -120,
        });
      }
    }

    // 가시 함정 (맵 M2) — 예열 단계에서 빛나 위치를 알린다
    for (const tr of (this.traps || [])) {
      ctx.save();
      if (tr.state === 'idle') {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#14141d';
        ctx.beginPath(); ctx.arc(tr.x, tr.y, 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a3a4c';
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 + 0.5;
          ctx.fillRect(tr.x + Math.cos(a) * 11 - 1, tr.y + Math.sin(a) * 11 - 1, 3, 3);
        }
      } else if (tr.state === 'arm') {
        ctx.globalAlpha = 0.6 + Math.sin(tr.t * 30) * 0.2;
        ctx.fillStyle = '#2a2434';
        ctx.beginPath(); ctx.arc(tr.x, tr.y, 21, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#e43b44'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(tr.x, tr.y, 22, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = '#1c1c28';
        ctx.beginPath(); ctx.arc(tr.x, tr.y, 21, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c8d4e4';
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2;
          const sx = tr.x + Math.cos(a) * 10, sy = tr.y + Math.sin(a) * 10;
          ctx.beginPath();
          ctx.moveTo(sx - 3, sy + 4); ctx.lineTo(sx, sy - 9); ctx.lineTo(sx + 3, sy + 4);
          ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
    }

    // 감전/독구름/잿불/연막 장판 (적 피해) — 물질감 텍스처 (v116)
    for (const z of this.zones) {
      // 가독성 설계 유지: 큰 장판일수록 옅게 (반경 90px 기준 감쇠) — 장판이 적을 가리면 안 된다
      const fade = Math.min(1, 90 / Math.max(90, z.r));
      const a = Math.min(0.55, z.life * 0.8) * fade;
      // 경계는 텍스처의 유기적 가장자리가 담당 — 기계적인 원형 링은 없다 (실플레이 제보)
      this._drawGroundPatch(ctx, z.x, z.y, z.r, z.kind, a, this.blinkT, (z.x * 11 + z.y * 5) % 89);
    }

    // 화살비 예고 원
    for (const r of this.rains) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#d9cbb8';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    // 메테오 예고 원
    for (const m of this.meteors) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(this.blinkT * 20) * 0.12;
      ctx.strokeStyle = '#ff7043';
      ctx.fillStyle = 'rgba(255,112,67,0.12)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // ── 왕의 인장기 예고 — 길고 또렷하게: 피할 수 있어야 공정하다 ──
    for (const s of (this.sigs || [])) {
      if (s.t >= s.tel) continue;
      const blink = 0.45 + Math.sin(this.blinkT * 16) * 0.2;
      ctx.save();
      if (s.type === 'halfSweep') {
        ctx.globalAlpha = 0.16 * blink * 2;
        ctx.fillStyle = '#e43b44';
        const half = s.side === 'R' ? [s.splitX, 0, World.cols * TS - s.splitX, World.rows * TS + 20] : [0, 0, s.splitX, World.rows * TS + 20];
        ctx.fillRect(half[0], half[1], half[2], half[3]);
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = '#e43b44'; ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.moveTo(s.splitX, 0); ctx.lineTo(s.splitX, World.rows * TS + 20); ctx.stroke();
        ctx.setLineDash([]);
      } else if (s.type === 'shieldCharge') {
        ctx.globalAlpha = 0.3 * blink * 2;
        ctx.strokeStyle = '#e43b44'; ctx.lineWidth = 124;
        ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x0 + s.dir.x * s.len, s.y0 + s.dir.y * s.len); ctx.stroke();
      } else if (s.type === 'brandZone') {
        ctx.globalAlpha = 0.5 * blink * 2;
        ctx.strokeStyle = '#e43b44'; ctx.fillStyle = 'rgba(228,59,68,0.14)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.font = 'bold 13px Galmuri11, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#e43b44';
        ctx.fillText('선고', s.x, s.y - s.r - 8);
      } else if (s.type === 'sanctPulse') {
        ctx.globalAlpha = 0.13 * blink * 2;
        ctx.fillStyle = '#e43b44';
        ctx.fillRect(-20, -20, Renderer.W + 40, Renderer.H + 40);
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = '#2ec4b6'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(s.sx, s.sy, s.sr, 0, Math.PI * 2); ctx.stroke();
        ctx.font = 'bold 12px Galmuri11, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#2ec4b6';
        ctx.fillText('성역 — 이 안으로', s.sx, s.sy - s.sr - 8);
      } else if (s.type === 'triCharge' && s.boss) {
        const b = s.boss, pl = this.player;
        const d = Math.hypot(pl.x - b.x, pl.y - b.y) || 1;
        ctx.globalAlpha = 0.3 * blink * 2;
        ctx.strokeStyle = s.dashN >= 2 ? '#e43b44' : '#c8ccd8'; ctx.lineWidth = 92;
        ctx.beginPath(); ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + ((pl.x - b.x) / d) * 460, b.y + ((pl.y - b.y) / d) * 460); ctx.stroke();
      } else if (s.type === 'kingCross') {
        ctx.globalAlpha = 0.3 * blink * 2;
        ctx.strokeStyle = '#e43b44'; ctx.lineWidth = s.w * 2;
        for (const sgn of [1, -1]) {
          ctx.beginPath();
          ctx.moveTo(s.cx - 600, s.cy - 600 * sgn);
          ctx.lineTo(s.cx + 600, s.cy + 600 * sgn);
          ctx.stroke();
        }
      } else if (s.type === 'miniSig') {
        ctx.globalAlpha = 0.4 * blink * 2;
        ctx.strokeStyle = '#e43b44'; ctx.fillStyle = 'rgba(228,59,68,0.12)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }

    // 스폰 마커
    for (const m of this.markers) {
      const r = 10 + m.t * 30;
      ctx.strokeStyle = m.elite ? `rgba(230,80,220,${0.95 - m.t})` : `rgba(160,80,190,${0.9 - m.t})`;
      ctx.lineWidth = m.elite ? 3 : 2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 충격파 링
    for (const ring of this.rings) {
      ctx.save();
      // ★ v175: 그려진 선은 width×0.6(7.2px)인데 **판정은 ±width(24px)** — 3.3배였다.
      // 링을 '보고 피했는데' 맞는 일이 여기서 났다 (사장의 사인 「정예의 강타」가 이 링이다).
      // 얇은 코어 선은 이동감 때문에 유지하고, 진짜 위험 폭을 반투명 띠로 한 겹 덧그린다
      const _bandA = 0.22 * (1 - ring.r / ring.maxR) + 0.08;
      ctx.globalAlpha = 0.7 * (1 - ring.r / ring.maxR) + 0.2;
      ctx.strokeStyle = '#e8e0cf';
      ctx.lineWidth = ring.width * 0.6;
      ctx.beginPath();
      if (ring.gapW) {
        // 간극 링: 안전 틈이 눈에 보인다 — 읽고 걸어 들어가면 산다
        ctx.arc(ring.x, ring.y, ring.r, ring.gapA + ring.gapW / 2, ring.gapA - ring.gapW / 2 + Math.PI * 2);
      } else {
        ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      }
      ctx.stroke();
      // 판정 밴드 — 실제로 맞는 폭(±width). 얇은 선 바깥 8px가 판정 안이었다
      ctx.globalAlpha = _bandA;
      ctx.lineWidth = ring.width * 2;
      ctx.stroke();
      ctx.restore();
    }

    // 상자 / 모닥불
    for (const it of this.interactables) {
      if (it.kind === 'chest') {
        const img = it.used ? Sprites.chestOpen : Sprites.chest;
        Renderer.drawSprite(img, it.x, it.y);
        if (!it.used) {
          const glow = 0.3 + Math.sin(it.t * 4) * 0.15;
          ctx.globalAlpha = glow;
          ctx.fillStyle = '#f7b32b';
          ctx.beginPath();
          ctx.arc(it.x, it.y, 34, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      } else if (it.kind === 'mystery') {
        // 미지의 기연: 소용돌이치는 보라 기운 + 물음표 — 정체는 받아야 안다
        if (!it.used) {
          ctx.globalAlpha = 0.25 + Math.sin(it.t * 3) * 0.12;
          ctx.fillStyle = '#b13ae0';
          ctx.beginPath(); ctx.arc(it.x, it.y - 4, 34 + Math.sin(it.t * 2) * 5, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = '#241832';
        ctx.fillRect(it.x - 13, it.y - 2, 26, 14);
        ctx.fillStyle = '#3d2c5c';
        ctx.fillRect(it.x - 10, it.y - 10, 20, 10);
        if (!it.used) {
          for (let k = 0; k < 3; k++) {
            const a = it.t * 1.6 + (k / 3) * Math.PI * 2;
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#c9b8e8';
            ctx.fillRect(it.x + Math.cos(a) * 20 - 1.5, it.y - 8 + Math.sin(a) * 9 - 1.5, 3, 3);
            ctx.globalAlpha = 1;
          }
          ctx.font = 'bold 16px Galmuri11, monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#b13ae0';
          ctx.fillText('?', it.x, it.y - 16);
          ctx.font = 'bold 12px Galmuri11, monospace';
          ctx.fillText('미지의 기연', it.x, it.y - 44);
          ctx.font = '11px Galmuri11, monospace';
          ctx.fillStyle = '#9aa0b4';
          ctx.fillText('받아들이기 전엔 알 수 없다', it.x, it.y - 30);
        }
      } else if (it.kind === 'gambler') {
        // 망자의 도박사: 구르는 주사위 한 쌍 + 금빛 기운
        if (!it.used) {
          ctx.globalAlpha = 0.22 + Math.sin(it.t * 3) * 0.1;
          ctx.fillStyle = '#f7b32b';
          ctx.beginPath(); ctx.arc(it.x, it.y, 32, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
        const wob = Math.sin(it.t * 5) * 3;
        ctx.fillStyle = '#e8e0cf';
        ctx.fillRect(it.x - 14, it.y - 6 + wob, 11, 11);
        ctx.fillRect(it.x + 3, it.y - 4 - wob, 11, 11);
        ctx.fillStyle = '#1a1c2c';
        ctx.fillRect(it.x - 11, it.y - 3 + wob, 2, 2); ctx.fillRect(it.x - 7, it.y + 1 + wob, 2, 2);
        ctx.fillRect(it.x + 6, it.y - 1 - wob, 2, 2); ctx.fillRect(it.x + 10, it.y + 3 - wob, 2, 2); ctx.fillRect(it.x + 8, it.y + 1 - wob, 2, 2);
        if (!it.used) {
          ctx.font = 'bold 12px Galmuri11, monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#f7b32b';
          ctx.fillText('교수대 주사위', it.x, it.y - 40);
          ctx.font = '11px Galmuri11, monospace';
          ctx.fillStyle = '#9aa0b4';
          ctx.fillText('골드 절반을 건다 — 이기면 2.2배', it.x, it.y - 26);
        }
      } else if (it.kind === 'cursedChest') {
        // 저주받은 상자: 보라 기운 + 거래 조건 라벨
        if (!it.used) {
          ctx.globalAlpha = 0.28 + Math.sin(it.t * 3) * 0.12;
          ctx.fillStyle = '#b13ae0';
          ctx.beginPath(); ctx.arc(it.x, it.y, 36, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
        Renderer.drawSprite(it.used ? Sprites.chestOpen : Sprites.chest, it.x, it.y);
        if (!it.used) {
          ctx.save();
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = '#241832';
          ctx.fillRect(it.x - 20, it.y - 20, 40, 24); // 어둠이 상자를 덮는다
          ctx.restore();
          ctx.font = 'bold 12px Galmuri11, monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#b13ae0';
          ctx.fillText('저주받은 상자', it.x, it.y - 44);
          ctx.font = '11px Galmuri11, monospace';
          ctx.fillStyle = '#9aa0b4';
          ctx.fillText('유물 +1 · 최대 HP -1', it.x, it.y - 30);
        }
      } else if (it.kind === 'bloodAltar') {
        // 피의 제단: 돌단 + 핏빛 그릇
        ctx.fillStyle = '#3d3d52';
        ctx.fillRect(it.x - 16, it.y - 4, 32, 16);
        ctx.fillStyle = '#5e5e74';
        ctx.fillRect(it.x - 12, it.y - 12, 24, 10);
        ctx.fillStyle = it.used ? '#3a1015' : '#8a1c2c';
        ctx.beginPath(); ctx.ellipse(it.x, it.y - 10, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
        if (!it.used) {
          ctx.globalAlpha = 0.2 + Math.sin(it.t * 4) * 0.08;
          ctx.fillStyle = '#e43b44';
          ctx.beginPath(); ctx.arc(it.x, it.y - 6, 30, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          if (Math.random() < 0.2) {
            Particles.burst(it.x, it.y - 12, { count: 1, colors: ['#e43b44'], speed: 20, life: 0.4, size: 2, gravity: -80 });
          }
          ctx.font = 'bold 12px Galmuri11, monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#e43b44';
          ctx.fillText('피의 제단', it.x, it.y - 44);
          ctx.font = '11px Galmuri11, monospace';
          ctx.fillStyle = '#9aa0b4';
          ctx.fillText('HP 2 → 공격력 +1', it.x, it.y - 30);
        }
      } else if (it.kind === 'clue') {
        // 증거: 어둠 속에서 홀로 빛나는 흔적
        if (!it.used) {
          ctx.save();
          ctx.globalAlpha = 0.25 + Math.sin(it.t * 3) * 0.12;
          ctx.fillStyle = '#f7b32b';
          ctx.beginPath(); ctx.arc(it.x, it.y - 6, 26, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          ctx.fillStyle = '#3d3d46';
          ctx.fillRect(it.x - 9, it.y - 12, 18, 20); // 비석/문서함
          ctx.fillStyle = '#c8c0a8';
          ctx.fillRect(it.x - 6, it.y - 9, 12, 3);
          ctx.fillRect(it.x - 6, it.y - 3, 12, 2);
          ctx.font = 'bold 12px Galmuri11, monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#f7b32b';
          ctx.fillText('증거', it.x, it.y - 26);
        }
      } else if (it.kind === 'modShrine') {
        // 원한의 세공대: 보랏빛 모루 — 스킬의 형태를 두드려 바꾼다
        if (!it.used) {
          ctx.globalAlpha = 0.25 + Math.sin(it.t * 3) * 0.12;
          ctx.fillStyle = '#b13ae0';
          ctx.beginPath(); ctx.arc(it.x, it.y, 34, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = '#241832';
        ctx.fillRect(it.x - 15, it.y - 2, 30, 13);
        ctx.fillStyle = '#3d2c5c';
        ctx.fillRect(it.x - 10, it.y - 12, 20, 10);
        ctx.fillStyle = '#b13ae0';
        ctx.fillRect(it.x - 4, it.y - 16, 8, 5);
        if (!it.used) {
          ctx.font = 'bold 12px Galmuri11, monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#b13ae0';
          ctx.fillText('원한의 세공대', it.x, it.y - 40);
          ctx.font = '11px Galmuri11, monospace';
          ctx.fillStyle = '#9aa0b4';
          ctx.fillText('스킬의 형태를 바꾼다 (택1)', it.x, it.y - 26);
        }
      } else if (it.kind === 'skillShrine') {
        // 스킬 사당: 세 갈래 빛기둥 제단 — 보조 스킬 3택1
        ctx.fillStyle = '#3d3d52';
        ctx.fillRect(it.x - 18, it.y - 2, 36, 14);
        ctx.fillStyle = '#5e5e74';
        ctx.fillRect(it.x - 13, it.y - 12, 26, 12);
        if (!it.used) {
          for (let k = -1; k <= 1; k++) {
            ctx.globalAlpha = 0.5 + Math.sin(it.t * 3 + k) * 0.25;
            ctx.fillStyle = ['#c9d94a', '#5ce0e6', '#ffd866'][k + 1];
            ctx.fillRect(it.x + k * 9 - 1.5, it.y - 34 + Math.sin(it.t * 2 + k * 2) * 3, 3, 20);
          }
          ctx.globalAlpha = 1;
          ctx.font = 'bold 12px Galmuri11, monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#c9d94a';
          ctx.fillText('스킬 사당', it.x, it.y - 46);
          ctx.font = '11px Galmuri11, monospace';
          ctx.fillStyle = '#9aa0b4';
          ctx.fillText('보조 스킬 3택1 (E키 사용)', it.x, it.y - 32);
        } else {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = '#5e5e74';
          ctx.fillRect(it.x - 1.5, it.y - 28, 3, 16);
          ctx.globalAlpha = 1;
        }
      } else if (it.kind === 'camp') {
        ctx.fillStyle = '#5e3a26';
        ctx.save();
        ctx.translate(it.x, it.y + 8);
        ctx.rotate(0.5);
        ctx.fillRect(-16, -4, 32, 8);
        ctx.rotate(-1);
        ctx.fillRect(-16, -4, 32, 8);
        ctx.restore();
        if (!it.used) {
          if (Math.random() < 0.6) {
            Particles.burst(it.x + (Math.random() - 0.5) * 14, it.y, {
              count: 1, colors: ['#ff7043', '#ffd866', '#e43b44'], speed: 40, life: 0.6, size: 4, gravity: -200,
            });
          }
          const glow = 0.14 + Math.sin(it.t * 6) * 0.04;
          ctx.globalAlpha = glow;
          ctx.fillStyle = '#ff7043';
          ctx.beginPath();
          ctx.arc(it.x, it.y, 70, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.font = 'bold 12px Galmuri11, monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ff7043';
          ctx.fillText('모닥불', it.x, it.y - 44);
          ctx.font = '11px Galmuri11, monospace';
          ctx.fillStyle = '#9aa0b4';
          ctx.fillText(`휴식 — HP +${this.pacts.heal ? 1 : 2}`, it.x, it.y - 30);
          // 숫돌과 공존 중이면 양자택일 안내 (두 오브젝트 중간 지점)
          if (this.interactables.some((o) => o.kind === 'whetstone' && !o.used)) {
            ctx.fillStyle = '#6a7086';
            ctx.fillText('둘 중 하나만 고를 수 있다', it.x + 78, it.y + 40);
          }
        }
      } else if (it.kind === 'whetstone') {
        // 숫돌: 나무 받침 + 비스듬한 회색 숫돌, 담금질 스파크
        ctx.fillStyle = '#5e3a26';
        ctx.fillRect(it.x - 12, it.y + 4, 24, 8);
        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.rotate(-0.35);
        ctx.fillStyle = it.used ? '#4a4a5c' : '#8b8ba0';
        ctx.fillRect(-14, -8, 28, 12);
        ctx.fillStyle = it.used ? '#5a5a6e' : '#b8b8cc';
        ctx.fillRect(-14, -8, 28, 4);
        ctx.restore();
        if (!it.used) {
          if (Math.random() < 0.35) {
            Particles.burst(it.x + 8, it.y - 8, {
              count: 1, colors: ['#ffd866', '#fff3c4'], speed: 70, life: 0.35, size: 2, gravity: 180,
            });
          }
          const glow = 0.1 + Math.sin(it.t * 6 + 1.5) * 0.04;
          ctx.globalAlpha = glow;
          ctx.fillStyle = '#ffd866';
          ctx.beginPath();
          ctx.arc(it.x, it.y, 46, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.font = 'bold 12px Galmuri11, monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffd866';
          ctx.fillText('숫돌', it.x, it.y - 44);
          ctx.font = '11px Galmuri11, monospace';
          ctx.fillStyle = '#9aa0b4';
          ctx.fillText('담금질 — 이번 층 공격력 +1', it.x, it.y - 30);
        }
      } else if (it.kind === 'shopRelic' || it.kind === 'shopHeal' || it.kind === 'shopReroll' || it.kind === 'shopShards' || it.kind === 'shopBlack') {
        // 상인 판매대 (G1): 받침 + 품목 아이콘 + 가격표. 살 수 있으면 금빛, 못 사면 잿빛
        if (it.used) continue;
        const afford = this.gold >= it.price;
        ctx.fillStyle = '#3a2c20';
        ctx.fillRect(it.x - 16, it.y + 2, 32, 10);
        ctx.fillStyle = '#5e3a26';
        ctx.fillRect(it.x - 13, it.y - 2, 26, 6);
        const glow = 0.16 + Math.sin(it.t * 4) * 0.06;
        ctx.globalAlpha = afford ? glow : glow * 0.4;
        ctx.fillStyle = afford ? '#2ec4b6' : '#4a4a5c';
        ctx.beginPath(); ctx.arc(it.x, it.y - 8, 30, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.textAlign = 'center';
        ctx.font = 'bold 15px Galmuri11, monospace';
        ctx.fillStyle = afford ? '#e8e0cf' : '#666a80';
        const icon = it.kind === 'shopRelic' ? '◆' : it.kind === 'shopHeal' ? '♥' : it.kind === 'shopShards' ? '◈' : it.kind === 'shopBlack' ? '☠' : '↻';
        ctx.fillText(icon, it.x, it.y - 8);
        ctx.font = 'bold 11px Galmuri11, monospace';
        ctx.fillStyle = afford ? '#2ec4b6' : '#9aa0b4';
        const name = it.kind === 'shopRelic' ? '유물' : it.kind === 'shopHeal' ? '회복 +2' : it.kind === 'shopShards' ? `한 조각 ${it.shards}` : it.kind === 'shopBlack' ? '검은 상자 (레어+)' : '리롤 +1';
        ctx.fillText(name, it.x, it.y - 40);
        ctx.fillStyle = afford ? '#ffd866' : '#8a6a20';
        ctx.fillText(`${it.price}G`, it.x, it.y - 27);
      } else if (it.kind === 'bloodAltar') {
        // 핏빛 제단 (G2): 검은 단 위에 고동치는 붉은 구슬
        ctx.fillStyle = '#241018';
        ctx.fillRect(it.x - 16, it.y, 32, 12);
        ctx.fillStyle = '#3a1822';
        ctx.fillRect(it.x - 11, it.y - 8, 22, 10);
        if (!it.used) {
          const pulse = 0.5 + Math.sin(it.t * 5) * 0.5;
          ctx.globalAlpha = 0.2 + pulse * 0.15;
          ctx.fillStyle = '#e43b44';
          ctx.beginPath(); ctx.arc(it.x, it.y - 14, 26 + pulse * 6, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#e43b44';
          ctx.beginPath(); ctx.arc(it.x, it.y - 14, 6 + pulse * 2, 0, Math.PI * 2); ctx.fill();
          ctx.textAlign = 'center';
          ctx.font = 'bold 12px Galmuri11, monospace';
          ctx.fillStyle = '#e43b44';
          ctx.fillText('핏빛 제단', it.x, it.y - 44);
          ctx.font = '11px Galmuri11, monospace';
          ctx.fillStyle = '#9aa0b4';
          ctx.fillText('최대 HP 1 → 정예급 특성 선택', it.x, it.y - 31);
        }
      }
    }

    // 픽업 — 우호 글로우: 초록(하트)/청록(XP 보석) 은은한 빛 — 붉은 테의 적 탄환과 색 언어로 구분
    for (const pk of this.pickups) {
      const bob = Math.sin(pk.t * 5) * 3;
      ctx.save();
      ctx.globalAlpha = 0.22 + Math.sin(pk.t * 4) * 0.06;
      ctx.fillStyle = '#38b764';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob * 0.5, 13, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.drawImage(Sprites.heart, Math.round(pk.x - 12), Math.round(pk.y - 9 + bob), 24, 18);
    }
    for (const o of this.orbs) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#2ec4b6';
      ctx.beginPath(); ctx.arc(o.x, o.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.drawImage(Sprites.gem, Math.round(o.x - 7), Math.round(o.y - 7), 14, 14);
    }

    // 사망 잔상 (무너져 내리며 페이드)
    for (const c of this.corpses) {
      const k = Math.min(1, c.t / c.dur);
      Renderer.drawSprite(c.img, c.x, c.y + k * 8, {
        flip: c.flip,
        alpha: (1 - k) * 0.9,
        squashY: (1 - k * 0.75) * c.scale,
        squashX: (1 + k * 0.45) * c.scale,
      });
    }
    // 절단 조각 (v126): 날아가는 동안만 엔티티로 — 멈추면 바닥에 구워져 스탬프가 된다
    for (const g of this.gibs) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.rot);
      ctx.drawImage(g.img, -g.img.width / 2, -g.img.height / 2);
      ctx.restore();
    }

    // ── 광원 목록 (v180) — 프레임당 한 번만 모은다 ──
    // 횃불·용암·모닥불이 실제로 스프라이트를 비춘다. 종전엔 바닥만 밝히고
    // 그 위에 선 캐릭터는 아무 영향을 안 받아서, 배경과 인물이 따로 놀았다
    Renderer.lights = [];
    for (const t of World.torches || []) {
      Renderer.lights.push({ x: t.x, y: t.y + World.offsetY - 4, r: t.stand ? 150 : 118, warm: true, i: 1 });
    }
    for (const lt of World.lavaTiles || []) {
      Renderer.lights.push({ x: lt.tx * 48 + 24, y: lt.ty * 48 + 24 + World.offsetY, r: 120, warm: true, i: 0.85 });
    }
    for (const it of this.interactables || []) {
      if (it.kind === 'campfire' || it.kind === 'fire') Renderer.lights.push({ x: it.x, y: it.y, r: 165, warm: true, i: 1.1 });
    }

    const drawables = [...this.enemies];
    if (this.state !== 'over') drawables.push(this.player);
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) {
      // 등장 연출: 땅에서 솟아오르며 실체화
      // v147: 스프라이트 없는 개체(영혼 구슬 등 sprite:null) 방어 — 벽 겹침 재배치(play.js)가
      // spawnT를 재부여하면 Sprites[null]=undefined를 그리려다 렌더 프레임 전체가 죽었다 (소크 간헐 크래시)
      if (d.spawnT > 0 && (d.isBoss ? d.def.sprite : d.sprite)) {
        const k = 1 - d.spawnT / (d.isBoss ? 0.6 : 0.35);
        const key = d.isBoss ? d.def.sprite : d.sprite;
        const img = d.elite ? Sprites.tint(Sprites[key]) : Sprites[key];
        const sc = d.isBoss ? d.def.scale : 1;
        Renderer.drawSprite(img, d.x, d.y + (1 - k) * 10, {
          flip: d.flip,
          alpha: 0.25 + 0.75 * k,
          squashY: (0.25 + 0.75 * k) * sc,
          squashX: (1.5 - 0.5 * k) * sc,
        });
        if (Math.random() < 0.4) {
          Particles.burst(d.x + (Math.random() - 0.5) * 24, d.y + 14, {
            count: 1, colors: ['#5c1e5e', '#8a3a8c'], speed: 40, life: 0.3, size: 3, gravity: -80,
          });
        }
        continue;
      }
      // 왕장 정예 (v130): 발밑의 금빛 각인 — 죽음이 저주를 남긴다는 예고
      if (d.royal && !d.dead) {
        ctx.save();
        ctx.strokeStyle = `rgba(247,179,43,${0.45 + 0.25 * Math.sin(this.time * 5)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y + 12, d.r + 6, (d.r + 6) * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      d.draw(ctx);
      // 헛손질 경직 — 반격의 창이 열렸다는 신호
      if (d._whiffT > 0 && !d.dead) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.55, d._whiffT);
        ctx.strokeStyle = '#5ce0e6'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 10, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      // ── 적 공격 모션 (2차): 접촉 타격 순간 무기/발톱 궤적 — 병사는 검격, 짐승·시체는 할퀴기 ──
      if (d._strikeT > 0 && !d.dead) {
        const t = d._strikeT / 0.22;
        const a0 = d._strikeA || 0;
        const rr = d.r + 18;
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(a0);
        const human = typeof HUMAN_FEAR !== 'undefined' && (HUMAN_FEAR.has(d.type) || OFFICERS.has(d.type));
        if (human) {
          // 검격: 붉은 쐐기 + 휘둘러지는 칼날 선
          ctx.globalAlpha = t * 0.4;
          const g = ctx.createRadialGradient(0, 0, rr * 0.3, 0, 0, rr);
          g.addColorStop(0, 'rgba(228,59,68,0)');
          g.addColorStop(1, 'rgba(228,59,68,0.8)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, rr, -0.55, 0.55); ctx.closePath(); ctx.fill();
          const bladeA = -0.55 + (1 - t) * 1.1;
          ctx.globalAlpha = t * 0.9;
          ctx.strokeStyle = '#f0d8d8';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(Math.cos(bladeA) * rr * 0.35, Math.sin(bladeA) * rr * 0.35);
          ctx.lineTo(Math.cos(bladeA) * rr, Math.sin(bladeA) * rr);
          ctx.stroke();
        } else {
          // 할퀴기: 3갈래 발톱 자국이 부챗살로 그어진다
          ctx.globalAlpha = t * 0.8;
          ctx.strokeStyle = '#e43b44';
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          for (let k = -1; k <= 1; k++) {
            ctx.beginPath();
            ctx.arc(0, k * 7, rr * 0.9, -0.4 + k * 0.06, 0.4 * (1 - t * 0.5) + k * 0.06);
            ctx.stroke();
          }
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }

    // ══ 예고 패스 (v175) — 몸 위에 따로 그린다 ══════════════════════════
    // v168의 접촉 예고는 y정렬 drawables 루프 **안**에서 그려졌다. 그래서 적이 플레이어보다
    // 위에 있으면 뒤이어 그려지는 플레이어 스프라이트(44x56px)가 예고를 덮었다 —
    // 실측: 위쪽 185px vs 아래쪽 937px, **위에서 오는 예고는 20%만 보였다.**
    // 예고가 화면에 없으면 그건 난이도가 아니라 정보 부족이다. 하물며 안 보이는 예고는
    // "읽고 피하라"는 이 게임의 약속을 정면으로 깬다
    for (const d of drawables) {
      if (d.dead) continue;
      // ── 무리 표시 (v185) — 몸 위에 얹지 않는다 (v183 원칙: 표식은 세계 안에) ──
      if (d._packMit > 0.1 && !d.isBoss) {
        // 군집 오라 — 발밑이 옅게 물든다. 진할수록 단단하다. 흩어놓으면 사라진다
        ctx.save();
        ctx.globalAlpha = Math.min(0.3, d._packMit * 0.7);
        ctx.fillStyle = d._led ? '#c9d94a' : '#8a8074';
        ctx.beginPath();
        ctx.ellipse(d.x, d.y + d.r * 0.78, d.r * 1.15, d.r * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (d.isLeader && !d.isBoss) {
        // 리더 — 머리 위 깃 + 이름. v185의 1.5px 막대는 사장이 못 봤다(당연하다).
        // 「누구를 먼저 쳐야 하는가」가 전술이 되려면 그게 화면에서 즉시 읽혀야 한다
        ctx.save();
        const ly = d.y - d.r - 22;
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = '#e8c04a';
        ctx.fillRect(d.x - 1, ly, 2, 16);
        ctx.beginPath();
        ctx.moveTo(d.x + 1, ly); ctx.lineTo(d.x + 13, ly + 4.5); ctx.lineTo(d.x + 1, ly + 9);
        ctx.closePath(); ctx.fill();
        // 발밑 지휘 고리 — 무리가 어디를 중심으로 도는지
        ctx.globalAlpha = 0.5 + Math.sin(this.blinkT * 3) * 0.12;
        ctx.strokeStyle = '#e8c04a'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y + d.r * 0.8, d.r * 1.35, d.r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.9;
        ctx.textAlign = 'center';
        ctx.font = 'bold 9px Galmuri11, monospace';
        ctx.fillStyle = '#08080f';
        ctx.fillText('무리 지휘', d.x + 1, ly - 3);
        ctx.fillStyle = '#e8c04a';
        ctx.fillText('무리 지휘', d.x, ly - 4);
        ctx.restore();
      }
      // 호령 여파 (v187) — 무리 전체가 **같은 순간에** 번쩍인다.
      // 동시성이 무리를 무리로 보이게 한다. 제각각 걸어오면 그냥 개체 넷이다
      if (d._rallyT > 0 && !d.isBoss) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.55, d._rallyT * 1.1);
        ctx.strokeStyle = '#e8c04a'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y + d.r * 0.75, d.r * (1.1 + (0.55 - d._rallyT) * 1.6), d.r * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (d._shakenT > 0) {
        // 동요 — 흔들리는 동안 발밑이 어긋난다
        ctx.save();
        ctx.globalAlpha = Math.min(0.5, d._shakenT * 0.25);
        ctx.strokeStyle = '#9aa0b4'; ctx.lineWidth = 1.5;
        const w = Math.sin(this.blinkT * 22) * 3;
        ctx.beginPath();
        ctx.ellipse(d.x + w, d.y + d.r * 0.8, d.r * 0.9, d.r * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      // 접촉 예고 — 붉은 부채꼴이 자란다
      if (d._windT > 0) {
        const k = 1 - d._windT / (d._windMax || 0.42);
        const rr = d.r + 20;
        // ★ v188 — 「언제 누를지」를 준다. 예고를 0.25→0.42초로 늘렸지만,
        // 긴 예고에 타이밍 신호가 없으면 "위험하다"만 길어질 뿐 회피는 여전히 찍기다.
        // 마지막 34%(약 0.14초)에 색이 붉음→백열로 넘어가고, 바깥에서 고리가 좁혀 들어와
        // 몸에 닿는 순간이 곧 타격 순간이다. 이 고리가 **누르는 시점**이다
        const imminent = k > 0.66;
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d._windA || 0);
        // 난전(3층 평균 10마리)에서 화면이 붉게 덮이지 않도록 알파를 종전보다 낮췄다.
        // 대신 테두리를 살려 윤곽으로 읽히게 한다 — 겹쳐도 개수가 세어진다
        ctx.globalAlpha = 0.15 + 0.35 * k;
        ctx.fillStyle = imminent ? 'rgba(255,238,170,0.6)' : 'rgba(228,59,68,0.55)';
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.arc(0, 0, rr * (0.55 + 0.45 * k), -0.62, 0.62); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.55 + 0.45 * k;
        ctx.strokeStyle = imminent ? '#fff6c8' : '#ffd866';
        ctx.lineWidth = imminent ? 3 : 2;
        ctx.beginPath(); ctx.arc(0, 0, rr * (0.55 + 0.45 * k), -0.62, 0.62); ctx.stroke();
        ctx.restore();
        // 조여드는 고리 — 회전과 무관하게 몸 중심을 기준으로 (방향이 아니라 **시점**을 말한다)
        ctx.save();
        ctx.globalAlpha = 0.30 + 0.55 * k;
        ctx.strokeStyle = imminent ? '#fff6c8' : '#ffd866';
        ctx.lineWidth = imminent ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r + 6 + (1 - k) * 46, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      // 강타·내려찍기 예고 (v175 신설) — 저장소에 렌더가 **0건**이었다.
      // 훨씬 약한 접촉 공격에는 부채꼴을 그려주면서, 사장을 죽인 「정예의 강타」는
      // 느낌표 하나와 파티클이 전부였다. 위험 반경 125px(실측 도달 137~138px)를 바닥에 그린다.
      // 색은 접촉 예고와 같은 붉은 계열 — 하나의 색 = 하나의 대응
      // 정예의 강타(_stompT 0.55초 · 링 maxR 125)와 골렘 내려찍기(state 'slam' 0.7초 · maxR 120).
      // 두 반경은 실측 137/138px로 1px 차 — 구분할 차이가 없으니 **같은 문법으로** 그린다
      let st = 0, stMax = 0.55, stR = 125;
      if (d._stompT > 0) { st = d._stompT; }
      else if (d.state === 'slam' && d.stateT != null && d.stateT < 0.7) { st = 0.7 - d.stateT; stMax = 0.7; stR = 120; }
      if (st > 0) {
        const k = Math.max(0, Math.min(1, 1 - st / stMax));
        ctx.save();
        ctx.globalAlpha = 0.10 + 0.25 * k;
        ctx.fillStyle = '#e43b44';
        ctx.beginPath(); ctx.arc(d.x, d.y, stR * (0.35 + 0.65 * k), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.45 + 0.45 * k;
        ctx.strokeStyle = '#ff4757'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(d.x, d.y, stR, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;

    // 투사체 — 위험 헤일로: 모든 적 탄환에 공통 붉은 테 (아이템·XP 보석과 즉시 구분되는 위험 색 언어)
    for (const a of this.arrows) {
      const style = PROJ_STYLES[a.kind] || PROJ_STYLES.arrow;
      const hr = (style.r || 6) + 5;
      ctx.save();
      ctx.globalAlpha = 0.16 + Math.sin(a.t * 12) * 0.05;
      ctx.fillStyle = '#e43b44';
      ctx.beginPath(); ctx.arc(a.x, a.y, hr + 2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = '#e43b44';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(a.x, a.y, hr, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      if (style.sprite) {
        Renderer.drawSprite(Sprites.arrow, a.x, a.y, { rot: Math.atan2(a.dir.y, a.dir.x), scale: 3 });
      } else if (style.shape) {
        this._drawWeaponProj(ctx, a, style);
      } else {
        ctx.fillStyle = style.color;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(a.x - a.dir.x * 4, a.y - a.dir.y * 4, a.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // 자동 타겟 표시 (모서리 브래킷)
    if (this.state === 'play' && this.player) {
      // v167: 브래킷은 **실제로 조준 중인 대상**을 가리킨다.
      // 종전엔 autoTarget(가장 가까운 적)을 그렸는데, 조준이 플레이어에게 넘어온 지금
      // 그대로 두면 화면이 또 거짓말을 한다 (겨눈 곳과 다른 곳에 표시)
      const t = this.player._aimTarget && !this.player._aimTarget.dead ? this.player._aimTarget : null;
      if (t) {
        // ★ v183 (사장: "npc 테두리 나오는건 고쳤어? 보기싫어")
        // 종전엔 붉은 모서리 브래킷 4개를 적 몸 위에 씌웠다 — **HUD 상자를 세계 위에 얹은 꼴**이라
        // 픽셀아트 화면에서 이물감이 컸다. 정보(어느 놈을 겨누는가)는 지키되 표현을 바꾼다:
        // 발밑에 얕은 호(弧) 하나. 세계 안의 그림자처럼 읽히고, 스프라이트를 가리지 않는다
        const r = t.r + 6;
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(this.blinkT * 5) * 0.12;
        ctx.strokeStyle = '#e8e0cf';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(t.x, t.y + t.r * 0.72, r * 0.82, r * 0.3, 0, Math.PI * 0.12, Math.PI * 0.88);
        ctx.stroke();
        // 머리 위 작은 쐐기 — 난전에서 발밑 호가 겹쳐도 어느 놈인지 한 번에 짚인다
        ctx.globalAlpha = 0.66;
        ctx.fillStyle = '#e8e0cf';
        const ty = t.y - t.r - 10;
        ctx.beginPath();
        ctx.moveTo(t.x, ty + 5); ctx.lineTo(t.x - 3.5, ty); ctx.lineTo(t.x + 3.5, ty);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }

    // 플레이어 투사체
    for (const b of this.pbolts) {
      // 게임필 (v138): 모션 스트릭 — 탄이 지나온 자리가 잠깐 빛난다 (상태 없는 렌더 트레일)
      if (b.kind !== 'pwave') {
        const tl = b.kind === 'parrow' ? 16 : 12;
        const tc = b.kind === 'parrow' ? '217,203,184' : b.kind === 'pflask' ? '201,217,74' : '197,108,240';
        const tg = ctx.createLinearGradient(b.x - b.dir.x * tl, b.y - b.dir.y * tl, b.x, b.y);
        tg.addColorStop(0, `rgba(${tc},0)`);
        tg.addColorStop(1, `rgba(${tc},${b.finisher ? 0.65 : 0.4})`);
        ctx.strokeStyle = tg;
        ctx.lineWidth = b.finisher ? 4 : 2.5;
        ctx.beginPath();
        ctx.moveTo(b.x - b.dir.x * tl, b.y - b.dir.y * tl);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      if (b.kind === 'pwave') {
        // 검기: 진행 방향에 수직인 칼날
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.dir.y, b.dir.x));
        ctx.fillStyle = '#c8d4e4';
        ctx.fillRect(-2, -10, 5, 20);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-1, -6, 3, 12);
        ctx.restore();
      } else if (b.kind === 'parrow') {
        Renderer.drawSprite(Sprites.arrow, b.x, b.y, { rot: Math.atan2(b.dir.y, b.dir.x), scale: 3 });
        if (b.finisher) {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = '#38b764';
          ctx.beginPath();
          ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      } else if (b.kind === 'pflask') {
        // 연금술사 플라스크: 회전하는 산성 병 + 방울 궤적
        const r = b.finisher ? 9 : 7;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate((b.life || 0) * 9);
        ctx.fillStyle = '#2e7a50';
        ctx.fillRect(-r * 0.35, -r - 3, r * 0.7, 4); // 병목
        ctx.fillStyle = b.catalyst ? '#ffd866' : '#c9d94a';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#eaf8c0';
        ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (Math.random() < 0.3) {
          Particles.burst(b.x, b.y, { count: 1, colors: ['#c9d94a'], speed: 20, life: 0.25, size: 2, gravity: 120 });
        }
      } else {
        const r = b.finisher ? 9 : 6;
        ctx.fillStyle = b.fire ? '#ff7043' : '#8a5ac2';
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e0c9f5';
        ctx.beginPath();
        ctx.arc(b.x, b.y, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 낙하 중인 메테오 (마지막 0.45초)
    for (const m of this.meteors) {
      if (m.t < 0.45) {
        const k = m.t / 0.45; // 1→0
        const my = m.y - k * 380;
        ctx.fillStyle = '#ff7043';
        ctx.beginPath();
        ctx.arc(m.x + k * 60, my, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff7c0';
        ctx.beginPath();
        ctx.arc(m.x + k * 60 + 3, my - 3, 6, 0, Math.PI * 2);
        ctx.fill();
        Particles.burst(m.x + k * 60, my, { count: 1, colors: ['#ff7043', '#ffd866'], speed: 30, life: 0.25, size: 3 });
      }
    }

    // 보스 검격
    for (const s of this.bossSlashes) {
      const t = s.life / s.maxLife;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.globalAlpha = t * 0.8;
      const grad = ctx.createRadialGradient(0, 0, s.range * 0.3, 0, 0, s.range);
      grad.addColorStop(0, 'rgba(228,59,68,0)');
      grad.addColorStop(1, 'rgba(228,59,68,0.9)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, s.range, -s.arc / 2, s.arc / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    Particles.draw(ctx);

    // 상시 횃불 시야 (기획 §7 다크 패스): 플레이어 주변만 밝다 — 어둠 기믹 층은 아래의 더 강한 것을 쓴다
    // v124: 오프스크린 합성으로 전환 — 횃불·화로가 어둠에 구멍을 뚫는다 (먼 방에도 초점이 생긴다)
    if (World.hazard !== 'dark' && this.state !== 'over' && this.state !== 'victory' && this.player) {
      const p = this.player;
      // 막별 어둠의 색 (비주얼 1차): 묘지의 달밤 남색 / 강둑 안개 청록 / 재판소 호박 그늘 /
      // 역병 마을 병든 녹 / 왕성 성화의 핏금 — 같은 횃불이라도 막의 밤이 다르다
      const SH = { 1: '10,8,26', 2: '4,14,14', 3: '16,10,4', 4: '6,14,6', 5: '16,5,8' }[World.act] || '4,2,8';
      const dk = this._dkCanvas || (this._dkCanvas = document.createElement('canvas'));
      if (dk.width !== Renderer.W || dk.height !== Renderer.H) { dk.width = Renderer.W; dk.height = Renderer.H; }
      const dc = dk.getContext('2d');
      dc.globalCompositeOperation = 'source-over';
      dc.clearRect(0, 0, dk.width, dk.height);
      const cm = p.rflags.candle ? 1.35 : 1; // 밤샘 초 (v128): 죽은 자의 곁을 밝힌다
      const g = dc.createRadialGradient(p.x, p.y, 150 * cm, p.x, p.y, 520 * cm);
      g.addColorStop(0, `rgba(${SH},0)`);
      g.addColorStop(0.7, `rgba(${SH},0.28)`);
      g.addColorStop(1, `rgba(${SH},0.62)`);
      dc.fillStyle = g;
      dc.fillRect(0, 0, dk.width, dk.height);
      dc.globalCompositeOperation = 'destination-out';
      for (const t of World.torches || []) {
        const ty2 = t.y + World.offsetY - 4;
        const hr = t.stand ? 118 : 92;
        const hole = dc.createRadialGradient(t.x, ty2, 4, t.x, ty2, hr);
        hole.addColorStop(0, 'rgba(0,0,0,0.8)');
        hole.addColorStop(1, 'rgba(0,0,0,0)');
        dc.fillStyle = hole;
        dc.beginPath(); dc.arc(t.x, ty2, hr + 2, 0, Math.PI * 2); dc.fill();
      }
      dc.globalCompositeOperation = 'source-over';
      ctx.drawImage(dk, 0, 0);
    }

    // 어둠 기믹 층: 시야 제한 — HUD보다 아래에
    if (World.hazard === 'dark' && this.state !== 'over' && this.state !== 'victory') {
      const p = this.player;
      const cm2 = p.rflags.candle ? 1.35 : 1; // 밤샘 초: 어둠 기믹 층에서도 유효
      const g = ctx.createRadialGradient(p.x, p.y, 130 * cm2, p.x, p.y, 300 * cm2);
      g.addColorStop(0, 'rgba(5,3,10,0)');
      g.addColorStop(1, 'rgba(5,3,10,0.88)');
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, Renderer.W + 40, Renderer.H + 40);
    }

    // 왕국의 징조 — 어둠의 눈: 하늘의 시선, 동공이 플레이어를 따라온다
    if (this._omen && this._omen.eyeT > 0 && this.player) {
      const o = this._omen;
      const a = Math.min(1, o.eyeT > 5 ? (6 - o.eyeT) * 2 : Math.min(1, o.eyeT));
      const ex = Renderer.W / 2, ey = 76;
      ctx.save();
      ctx.globalAlpha = 0.5 * a;
      const eg = ctx.createRadialGradient(ex, ey, 10, ex, ey, 280);
      eg.addColorStop(0, o.pale ? 'rgba(200,212,228,0.5)' : 'rgba(70,12,84,0.6)');
      eg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = eg;
      ctx.fillRect(0, 0, Renderer.W, 220);
      ctx.globalAlpha = 0.85 * a;
      ctx.fillStyle = '#0a060c';
      ctx.beginPath(); ctx.ellipse(ex, ey, 110, 32, 0, 0, Math.PI * 2); ctx.fill();
      const edx = this.player.x - ex, edy = this.player.y - ey, edd = Math.hypot(edx, edy) || 1;
      const ipx = ex + (edx / edd) * 32, ipy = ey + (edy / edd) * 9;
      ctx.fillStyle = o.pale ? '#c8d4e4' : '#7a1c8c';
      ctx.beginPath(); ctx.ellipse(ipx, ipy, 19, 17, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = o.pale ? '#eef4fa' : '#e43b44';
      ctx.beginPath(); ctx.arc(ipx, ipy, 7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // 핏빛 월식 틴트 — 원한이 끓는 동안 세계가 붉다
    if (this._moonT > 0) {
      ctx.fillStyle = `rgba(122,16,24,${Math.min(0.13, this._moonT * 0.05)})`;
      ctx.fillRect(-20, -20, Renderer.W + 40, Renderer.H + 40);
    }

    // 인장기 경고 — 화면 테두리가 핏빛으로 고동친다
    if (this.sigWarnT > 0) {
      const a = Math.min(0.5, this.sigWarnT) * (0.5 + Math.sin(this.blinkT * 18) * 0.3);
      const wg = ctx.createRadialGradient(Renderer.W / 2, Renderer.H / 2, Renderer.H * 0.36, Renderer.W / 2, Renderer.H / 2, Renderer.H * 0.72);
      wg.addColorStop(0, 'rgba(122,16,24,0)');
      wg.addColorStop(1, `rgba(200,20,34,${a})`);
      ctx.fillStyle = wg;
      ctx.fillRect(-20, -20, Renderer.W + 40, Renderer.H + 40);
    }

    // [아트 리마스터] 층 컬러 그레이딩 + 상시 비네트 (던전 분위기)
    ctx.fillStyle = World.theme.grade;
    ctx.fillRect(-20, -20, Renderer.W + 40, Renderer.H + 40);
    const vg = ctx.createRadialGradient(
      Renderer.W / 2, Renderer.H / 2, Renderer.H * 0.42,
      Renderer.W / 2, Renderer.H / 2, Renderer.H * 0.85);
    vg.addColorStop(0, 'rgba(5,3,10,0)');
    vg.addColorStop(1, 'rgba(5,3,10,0.34)');
    ctx.fillStyle = vg;
    ctx.fillRect(-20, -20, Renderer.W + 40, Renderer.H + 40);

    HUD.draw(ctx, this);

    // 획득 목록 오버레이 (Tab)
    if (this.showInventory && this.state === 'play') {
      HUD.drawInventory(ctx, this);
    }

    // 일시정지 오버레이 — 게임 중 언제든 열어보는 매뉴얼 (기본 조작 + 전투의 정수)
    if (this.paused && this.state === 'play' && !this.showInventory) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(8,8,15,0.82)';
      ctx.fillRect(0, 0, Renderer.W, Renderer.H);
      ctx.textAlign = 'center';
      ctx.font = 'bold 30px Galmuri11, monospace';
      ctx.fillStyle = '#e8e0cf';
      ctx.fillText('일시정지 — 매뉴얼', Renderer.W / 2, 72);

      // ── 왼쪽: 기본 조작 ──
      const lx = Renderer.W / 2 - 396;
      ctx.textAlign = 'left';
      ctx.font = 'bold 15px Galmuri11, monospace';
      ctx.fillStyle = '#5ce0e6';
      ctx.fillText('기본 조작', lx, 122);
      ctx.font = '13px Galmuri11, monospace';
      const basics = [
        ['WASD / 방향키', '이동'],
        ['클릭 / J', '공격 — 3연격, 3타째가 강하다'],
        ['Space / Shift', '대시 (짧은 무적)'],
        ['K / 우클릭', '직업 스킬'],
        ['Tab', '획득 목록 · 현재 스탯'],
        ['1 2 3', '카드 선택 (E — 리롤, 환생 각인)'],
        ['M', '음소거'],
        ['O', '설정 (음량·흔들림·섬광)'],
      ];
      basics.forEach(([k, v], i) => {
        ctx.fillStyle = '#e8e0cf';
        ctx.fillText(k, lx, 150 + i * 24);
        ctx.fillStyle = '#9aa0b4';
        ctx.fillText(v, lx + 148, 150 + i * 24);
      });

      // ── 오른쪽: 전투의 정수 (고급 기술) ──
      const rx = Renderer.W / 2 + 16;
      ctx.font = 'bold 15px Galmuri11, monospace';
      ctx.fillStyle = '#f7b32b';
      ctx.fillText('전투의 정수', rx, 122);
      const tech = [
        ['완벽 회피', '적 공격이 닿기 직전 대시로 회피', '→ 시간이 느려지고 다음 일격이 확정 크리'],
        ['대시 파생기', '대시 중 공격 — 직업별 특수기', '검사 돌진 찌르기 / 궁수 후퇴 사격 / 마도사 점멸 폭발'],
        ['벽 충돌', '3타 마무리·참수 선회로 적을 벽에 처박으면', '추가 피해 — 지형이 무기다'],
        ['스킬 진화', '직업 특성 3장 + Lv.12', '→ 스킬의 형태가 바뀐다 (회오리 베기 등)'],
        ['균열 벽', '금이 간 벽은 부술 수 있다', '→ 비밀 벽감에 보상이 숨어 있다'],
      ];
      let ty = 150;
      for (const t of tech) {
        ctx.font = 'bold 13px Galmuri11, monospace';
        ctx.fillStyle = '#ffd866';
        ctx.fillText('· ' + t[0], rx, ty);
        ctx.font = '12px Galmuri11, monospace';
        ctx.fillStyle = '#c8d4e4';
        ctx.fillText(t[1], rx + 16, ty + 18);
        ctx.fillStyle = '#8a90a4';
        ctx.fillText(t[2], rx + 16, ty + 34);
        ty += 58;
      }

      ctx.textAlign = 'center';
      ctx.font = '14px Galmuri11, monospace';
      ctx.fillStyle = '#5ce0e6';
      ctx.fillText('H 또는 / — 전체 매뉴얼 (던전·성장 안내 포함)', Renderer.W / 2, Renderer.H - 100);
      ctx.fillStyle = '#9aa0b4';
      ctx.fillText('ESC / P — 계속하기', Renderer.W / 2, Renderer.H - 78);
      ctx.fillStyle = '#2ec4b6';
      ctx.fillText('B — 저장하고 거점으로 (거점에서 이어하기)', Renderer.W / 2, Renderer.H - 56);
      ctx.fillStyle = '#e43b44';
      ctx.fillText('Q — 런 포기하고 정산 (기록 소멸)', Renderer.W / 2, Renderer.H - 34);
      ctx.fillStyle = '#4a4a5c';
      ctx.fillText(`시드 ${this.runSeed.toString(36).toUpperCase()}${this.heat > 0 ? ' · 열기 ' + this.heat : ''}`, Renderer.W / 2, Renderer.H - 12);
    }
    // 첫 조우 사연 카드 (v187): 처음 보는 얼굴에게 이름과 사연을 준다.
    // 도감에 묻어두면 아무도 안 읽는다 — 만나는 순간이 유일하게 읽히는 순간이다
    if (this._meet && this.state === 'play') {
      const mt = this._meet;
      const c = mt.c;
      const a = Math.min(1, mt.t * 2.2) * Math.min(1, (mt.max - mt.t) * 4);
      const side = Meta.sideColor(c.side);
      const r = this.meetRect();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(6,5,12,0.9)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = side;
      ctx.fillRect(r.x, r.y, 3, r.h);                 // 진영 색 띠 — 누구 편이었는지가 한눈에
      ctx.strokeStyle = 'rgba(120,114,100,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      const img = Sprites[c.sprite];
      if (!mt.open) {
        // ★ v193 접힌 막대 — 사장: "사연이 화면을 가리니깐 클릭하면 시작되도록"
        // 전투를 가리지 않는 26px 한 줄. 누르지 않으면 조용히 사라진다
        if (img) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, Math.round(r.x + 14), Math.round(r.y + r.h / 2 - img.height / 2), img.width, img.height);
        }
        ctx.textAlign = 'left';
        ctx.font = 'bold 11px Galmuri11, monospace';
        ctx.fillStyle = '#e8e0cf';
        ctx.fillText(c.name, r.x + 34, r.y + 17);
        ctx.font = '10px Galmuri11, monospace';
        ctx.fillStyle = '#8f8577';
        ctx.textAlign = 'right';
        ctx.fillText('클릭 — 사연', r.x + r.w - 12, r.y + 17);
      } else {
        if (img) {
          const s2 = Math.max(1, Math.floor(38 / Math.max(img.width, img.height)));
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, Math.round(r.x + 30 - img.width * s2 / 2), Math.round(r.y + r.h / 2 - img.height * s2 / 2),
            img.width * s2, img.height * s2);
        }
        ctx.textAlign = 'left';
        ctx.font = 'bold 16px Galmuri11, monospace';
        ctx.fillStyle = '#e8e0cf';
        ctx.fillText(c.name, r.x + 60, r.y + 25);
        const nameW = ctx.measureText(c.name).width;
        ctx.font = '11px Galmuri11, monospace';
        ctx.fillStyle = side;
        ctx.fillText(`— ${Meta.sideLabel(c.side)}`, r.x + 70 + nameW, r.y + 25);
        ctx.font = '12px Galmuri11, monospace';
        ctx.fillStyle = '#a8a294';
        HUD._wrapText(ctx, c.lore, r.x + 60, r.y + 46, r.w - 78, 16);
      }
      ctx.globalAlpha = 1;
    }
    // 보스 등장 카드 (v142): 상하 암막 + 이름·기믹 대문 — 결전의 문턱을 몸으로 느끼게
    if (this._bossIntro && this.state === 'play') {
      const bi = this._bossIntro;
      const k = Math.min(1, (2.8 - bi.t) * 3);          // 진입 페이드
      const out = bi.t < 0.5 ? bi.t / 0.5 : 1;           // 퇴장 페이드
      const a = k * out;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(5,4,10,${0.35 * a})`;
      ctx.fillRect(0, 0, Renderer.W, Renderer.H);
      ctx.fillStyle = `rgba(5,4,10,${0.85 * a})`;
      ctx.fillRect(0, 0, Renderer.W, 96 * k);
      ctx.fillRect(0, Renderer.H - 96 * k, Renderer.W, 96 * k);
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.font = 'bold 36px Galmuri11, monospace';
      ctx.fillStyle = '#0a0a12';
      ctx.fillText(bi.name, Renderer.W / 2 + 2, Renderer.H / 2 - 12);
      ctx.fillStyle = '#e43b44';
      ctx.fillText(bi.name, Renderer.W / 2, Renderer.H / 2 - 14);
      if (bi.label) {
        ctx.font = '14px Galmuri11, monospace';
        ctx.fillStyle = '#c8c2b4';
        ctx.fillText(bi.label, Renderer.W / 2, Renderer.H / 2 + 16);
      }
      // v187 죄목 — 이 자가 나에게 한 짓. 기믹보다 이게 먼저 기억에 남아야 한다
      if (bi.crime) {
        ctx.font = '13px Galmuri11, monospace';
        ctx.fillStyle = '#8f8577';
        HUD._wrapText(ctx, bi.crime, Renderer.W / 2, Renderer.H / 2 + (bi.label ? 44 : 26), 700, 18);
      }
      ctx.globalAlpha = 1;
    }
    // 자동 저장 표시 (v141): 방 입장마다 기록된다는 걸 보여준다 — '저장이 없다'는 오해 해소
    if (this._saveFlashT > 0 && this.state === 'play') {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = Math.min(1, this._saveFlashT);
      ctx.textAlign = 'right';
      ctx.font = 'bold 12px Galmuri11, monospace';
      ctx.fillStyle = '#2ec4b6';
      ctx.fillText('◈ 기록됨', Renderer.W - 14, Renderer.H - 26);
      ctx.globalAlpha = 1;
    }

    if (this.showManual && this.state === 'play') HUD.drawManual(ctx, this, this.showManual);
    if (this.showSettings && this.state === 'play') HUD.drawSettings(ctx, this);

    // 다섯 번째 손 — 관찰자의 속삭임: 하단에 낮게 스며드는 문장 (배너와 다른 결)
    if (this.whisper && this.state === 'play') {
      const w = this.whisper;
      const a = Math.min(1, w.t / 0.8) * Math.min(1, (w.maxT - w.t) / 0.6);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = a * 0.85;
      ctx.textAlign = 'center';
      ctx.font = '14px Galmuri11, monospace';
      ctx.fillStyle = '#0a0812';
      ctx.fillText(w.text, Renderer.W / 2 + 1, Renderer.H - 63);
      ctx.fillStyle = '#b8a9d8';
      ctx.fillText(w.text, Renderer.W / 2, Renderer.H - 64);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // v120 ④ 막 시작 독백 — 속삭임과 같은 자리, 뼛빛 톤 (비차단)
    // 온보딩 (v139): 첫 걸음 힌트 — 머리 위에서 한 동사씩 (걷는다 → 벤다 → 대시)
    if (this._obHints && this.state === 'play' && this.player) {
      const hint = !this._obMoved ? 'W A S D — 걷는다' : !this._obAtk ? 'J / 클릭 — 벤다' : 'Space — 대시';
      const hp2 = this.player;
      ctx.save();
      ctx.globalAlpha = 0.7 + Math.sin(this.blinkT * 4) * 0.3;
      ctx.font = 'bold 13px Galmuri11, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0a0a12';
      ctx.fillText(hint, hp2.x + 1, hp2.y - 45);
      ctx.fillStyle = '#ffd866';
      ctx.fillText(hint, hp2.x, hp2.y - 46);
      ctx.restore();
    }
    if (this.monologue && this.state === 'play') {
      const m = this.monologue;
      const a = Math.min(1, m.t / 0.8) * Math.min(1, (m.maxT - m.t) / 0.6);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = a * 0.9;
      ctx.textAlign = 'center';
      ctx.font = 'italic 14px Galmuri11, monospace';
      ctx.fillStyle = '#0a0812';
      ctx.fillText(m.text, Renderer.W / 2 + 1, Renderer.H - 63);
      ctx.fillStyle = '#c8c0a8';
      ctx.fillText(m.text, Renderer.W / 2, Renderer.H - 64);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    if (this.state === 'levelup') HUD.drawCardChoice(ctx, this, this.traitCards, this.choiceReason === 'elite' ? '정예 처치 보상!' : '레벨 업!', (t) => `[ ${t.tag} ]`);
    if (this.state === 'relic') HUD.drawCardChoice(ctx, this, this.relicCards, '유물을 선택하라', (r) => `[ ${RARITY[r.rarity].label} ]`, (r) => RARITY[r.rarity].color);
    if (this.state === 'route') HUD.drawRouteChoice(ctx, this);
    if (this.state === 'skillmod') HUD.drawCardChoice(ctx, this, this.modCards, '원한의 세공 — 스킬을 개조하라', () => '[ 개조 ]', () => '#b13ae0');
    if (this.state === 'over') HUD.drawGameOver(ctx, this, this.blinkT);
    if (this.state === 'victory') HUD.drawVictory(ctx, this, this.blinkT);
    // 정산 화면 위에 얹는 오버레이 (v162) — 정산 그림 뒤가 아니라 앞에 와야 보인다
    if (this.state === 'over' || this.state === 'victory') {
      if (this.showInventory && this.player) HUD.drawInventory(ctx, this);
      if (this.showSettings) HUD.drawSettings(ctx, this);
    }
    // v120 스토리 화면 3종
    if (this.state === 'prologue') HUD.drawPrologue(ctx, this);
    if (this.state === 'cluecard') HUD.drawClueCard(ctx, this);
    if (this.state === 'confession') HUD.drawConfession(ctx, this);

    if (this.transition) {
      // v189: 암막 알파 1.0 → 0.42. 종전엔 5프레임(83ms) 완전 암전이 있었고,
      // 그 순간 세계는 아예 사라졌다. 이제 미는 것은 Renderer.pan 이고 검정은
      // 옆방과 옆방 사이의 '틈'을 메우는 역할만 한다 — 이동이 보여야 이어진다
      const a = this.transition.phase === 'out' ? this.transition.t : 1 - this.transition.t;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = Math.min(0.42, a * 0.42);
      ctx.fillStyle = '#08080f';
      ctx.fillRect(0, 0, Renderer.W, Renderer.H);
      ctx.globalAlpha = 1;
    }
  },
};
