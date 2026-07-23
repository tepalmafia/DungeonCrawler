// HUD + 화면 오버레이 (시작/게임오버/웨이브 배너)
const HUD = {
  draw(ctx, game) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); // 셰이크 영향 제거

    // ── 하트 (HP) ──
    const p = game.player;
    for (let i = 0; i < p.maxHp; i++) {
      const img = i < p.hp ? Sprites.heart : Sprites.heartEmpty;
      ctx.drawImage(img, 14 + i * 30, 12, img.width * 3, img.height * 3);
    }

    // ── 대시 쿨다운 바 ──
    const cdRatio = Math.max(0, Math.min(1, 1 - p.dashCd / 1.5));
    ctx.fillStyle = '#1c1c28';
    ctx.fillRect(14, 38, 86, 6);
    ctx.fillStyle = cdRatio >= 1 ? '#5ce0e6' : '#3a7ca5';
    ctx.fillRect(14, 38, 86 * cdRatio, 6);
    ctx.fillStyle = '#9aa0b4';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('대시', 104, 45);

    // ── 웨이브 / 처치 수 ──
    ctx.textAlign = 'right';
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#e8e0cf';
    ctx.fillText(`WAVE ${game.wave}`, Renderer.W - 16, 30);
    ctx.font = '13px monospace';
    ctx.fillStyle = '#9aa0b4';
    ctx.fillText(`처치 ${game.kills}`, Renderer.W - 16, 50);

    // ── 웨이브 배너 ──
    if (game.banner) {
      const b = game.banner;
      const t = b.life / b.maxLife;
      ctx.globalAlpha = Math.min(1, t * 3);
      ctx.textAlign = 'center';
      ctx.font = 'bold 42px monospace';
      ctx.fillStyle = '#08080f';
      ctx.fillText(b.text, Renderer.W / 2 + 3, 173);
      ctx.fillStyle = '#f7b32b';
      ctx.fillText(b.text, Renderer.W / 2, 170);
      ctx.globalAlpha = 1;
    }

    // ── 피격 비네트 (화면 가장자리 빨갛게) ──
    if (game.vignette > 0) {
      const g = ctx.createRadialGradient(
        Renderer.W / 2, Renderer.H / 2, Renderer.H * 0.35,
        Renderer.W / 2, Renderer.H / 2, Renderer.H * 0.75);
      g.addColorStop(0, 'rgba(228,59,68,0)');
      g.addColorStop(1, `rgba(228,59,68,${Math.min(0.5, game.vignette)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, Renderer.W, Renderer.H);
    }

    // ── 음소거 표시 ──
    if (AudioSys.muted) {
      ctx.textAlign = 'left';
      ctx.font = '12px monospace';
      ctx.fillStyle = '#666a80';
      ctx.fillText('🔇 음소거 (M)', 14, Renderer.H - 12);
    }
  },

  drawStartScreen(ctx, blinkT) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,8,15,0.82)';
    ctx.fillRect(0, 0, Renderer.W, Renderer.H);
    ctx.textAlign = 'center';

    ctx.font = 'bold 46px monospace';
    ctx.fillStyle = '#f7b32b';
    ctx.fillText('던전 크롤러', Renderer.W / 2, 165);
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#e8e0cf';
    ctx.fillText('― 심연의 탑 ―', Renderer.W / 2, 205);

    ctx.font = '15px monospace';
    ctx.fillStyle = '#9aa0b4';
    const lines = [
      'WASD/방향키  이동',
      '마우스 클릭/J  공격 (3연격 콤보)',
      'Space/Shift  대시 (무적)',
      'M  음소거',
    ];
    lines.forEach((l, i) => ctx.fillText(l, Renderer.W / 2, 280 + i * 26));

    if (Math.floor(blinkT * 1.6) % 2 === 0) {
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#5ce0e6';
      ctx.fillText('클릭 또는 아무 키나 눌러 시작', Renderer.W / 2, 435);
    }
    ctx.font = '12px monospace';
    ctx.fillStyle = '#4a4a5c';
    ctx.fillText('M1 프로토타입 — 코어 전투', Renderer.W / 2, 510);
  },

  drawGameOver(ctx, game, blinkT) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,8,15,0.75)';
    ctx.fillRect(0, 0, Renderer.W, Renderer.H);
    ctx.textAlign = 'center';

    ctx.font = 'bold 44px monospace';
    ctx.fillStyle = '#e43b44';
    ctx.fillText('전사했다...', Renderer.W / 2, 200);

    ctx.font = '18px monospace';
    ctx.fillStyle = '#e8e0cf';
    ctx.fillText(`도달 웨이브 ${game.wave}   ·   처치 ${game.kills}`, Renderer.W / 2, 260);
    ctx.fillStyle = '#9aa0b4';
    ctx.font = '14px monospace';
    ctx.fillText(`생존 시간 ${game.time.toFixed(1)}초`, Renderer.W / 2, 290);

    if (Math.floor(blinkT * 1.6) % 2 === 0) {
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#5ce0e6';
      ctx.fillText('R 키 또는 클릭으로 재도전', Renderer.W / 2, 380);
    }
  },
};
