// HUD + 화면 오버레이 (시작/게임오버/승리/레벨업 카드/보스 체력바)
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

    // ── XP 바 + 레벨 ──
    const xpRatio = Math.min(1, game.xp / game.xpNext);
    ctx.fillStyle = '#1c1c28';
    ctx.fillRect(14, 50, 86, 6);
    ctx.fillStyle = '#2ec4b6';
    ctx.fillRect(14, 50, 86 * xpRatio, 6);
    ctx.fillStyle = '#9aa0b4';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Lv.${game.level}`, 104, 58);

    // ── 획득 특성 아이콘 (왼쪽 세로 스택) ──
    const counts = {};
    for (const id of p.traits) counts[id] = (counts[id] || 0) + 1;
    let ti = 0;
    for (const id of Object.keys(counts)) {
      const trait = TRAITS.find((t) => t.id === id);
      if (!trait) continue;
      const y = 72 + ti * 22;
      ctx.fillStyle = '#141420';
      ctx.fillRect(14, y, 18, 18);
      ctx.strokeStyle = trait.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(14.5, y + 0.5, 17, 17);
      ctx.fillStyle = trait.color;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(trait.name[0], 23, y + 13);
      if (counts[id] > 1) {
        ctx.fillStyle = '#e8e0cf';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('x' + counts[id], 35, y + 13);
      }
      ti++;
    }

    // ── 층 진행도 (상단 중앙) ──
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#e8e0cf';
    const roomLabel = Dungeon.roomType === 'boss'
      ? '보스전'
      : `${Dungeon.floor}층 · 방 ${Dungeon.roomIndex}/${Dungeon.totalRooms}`;
    ctx.fillText(roomLabel, Renderer.W / 2, 26);

    // ── 처치 수 ──
    ctx.textAlign = 'right';
    ctx.font = '13px monospace';
    ctx.fillStyle = '#9aa0b4';
    ctx.fillText(`처치 ${game.kills}`, Renderer.W - 16, 26);

    // ── 보스 체력바 ──
    const boss = game.enemies.find((e) => e.isBoss && !e.dead);
    if (boss) {
      const w = 420;
      const x = (Renderer.W - w) / 2;
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#b13ae0';
      ctx.fillText(boss.name, Renderer.W / 2, 52);
      ctx.fillStyle = '#1c1c28';
      ctx.fillRect(x, 58, w, 10);
      ctx.fillStyle = boss.phase === 2 ? '#e43b44' : '#b13ae0';
      ctx.fillRect(x, 58, w * Math.max(0, boss.hp / boss.maxHp), 10);
      ctx.strokeStyle = '#3a3a4a';
      ctx.strokeRect(x + 0.5, 58.5, w - 1, 9);
    }

    // ── 배너 ──
    if (game.banner) {
      const b = game.banner;
      const t = b.life / b.maxLife;
      ctx.globalAlpha = Math.min(1, t * 3);
      ctx.textAlign = 'center';
      ctx.font = 'bold 38px monospace';
      ctx.fillStyle = '#08080f';
      ctx.fillText(b.text, Renderer.W / 2 + 3, 173);
      ctx.fillStyle = '#f7b32b';
      ctx.fillText(b.text, Renderer.W / 2, 170);
      ctx.globalAlpha = 1;
    }

    // ── 피격 비네트 ──
    if (game.vignette > 0) {
      const g = ctx.createRadialGradient(
        Renderer.W / 2, Renderer.H / 2, Renderer.H * 0.35,
        Renderer.W / 2, Renderer.H / 2, Renderer.H * 0.75);
      g.addColorStop(0, 'rgba(228,59,68,0)');
      g.addColorStop(1, `rgba(228,59,68,${Math.min(0.5, game.vignette)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, Renderer.W, Renderer.H);
    }

    if (AudioSys.muted) {
      ctx.textAlign = 'left';
      ctx.font = '12px monospace';
      ctx.fillStyle = '#666a80';
      ctx.fillText('음소거 (M)', 14, Renderer.H - 12);
    }
  },

  // 레벨업 카드 UI — 3장 중 선택 (1/2/3 키 또는 클릭)
  cardRects(n) {
    const w = 236, h = 190, gap = 26;
    const totalW = n * w + (n - 1) * gap;
    const x0 = (Renderer.W - totalW) / 2;
    const y = 175;
    const rects = [];
    for (let i = 0; i < n; i++) rects.push({ x: x0 + i * (w + gap), y, w, h });
    return rects;
  },

  drawLevelUp(ctx, game) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,8,15,0.78)';
    ctx.fillRect(0, 0, Renderer.W, Renderer.H);

    ctx.textAlign = 'center';
    ctx.font = 'bold 32px monospace';
    ctx.fillStyle = '#2ec4b6';
    ctx.fillText(game.choiceReason === 'elite' ? '정예 처치 보상!' : '레벨 업!', Renderer.W / 2, 120);
    ctx.font = '14px monospace';
    ctx.fillStyle = '#9aa0b4';
    ctx.fillText('특성을 선택하세요 (1 / 2 / 3 키 또는 클릭)', Renderer.W / 2, 150);

    const rects = this.cardRects(game.traitCards.length);
    const mx = Input.mouse.x, my = Input.mouse.y;

    game.traitCards.forEach((t, i) => {
      const r = rects[i];
      const hover = mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
      const lift = hover ? -6 : 0;

      ctx.fillStyle = hover ? '#1d1d2e' : '#141420';
      ctx.fillRect(r.x, r.y + lift, r.w, r.h);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = hover ? 3 : 1.5;
      ctx.strokeRect(r.x, r.y + lift, r.w, r.h);

      ctx.textAlign = 'center';
      const cx = r.x + r.w / 2;
      // 태그 배지
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = t.color;
      ctx.fillText(`[ ${t.tag} ]`, cx, r.y + lift + 32);
      // 이름
      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = '#e8e0cf';
      ctx.fillText(t.name, cx, r.y + lift + 66);
      // 설명 (줄바꿈)
      ctx.font = '13px monospace';
      ctx.fillStyle = '#9aa0b4';
      this._wrapText(ctx, t.desc, cx, r.y + lift + 100, r.w - 30, 19);
      // 단축키
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = hover ? t.color : '#4a4a5c';
      ctx.fillText(String(i + 1), cx, r.y + lift + r.h - 16);
    });
  },

  _wrapText(ctx, text, cx, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, cx, y);
        line = word;
        y += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx, y);
  },

  drawStartScreen(ctx, blinkT) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,8,15,0.82)';
    ctx.fillRect(0, 0, Renderer.W, Renderer.H);
    ctx.textAlign = 'center';

    ctx.font = 'bold 46px monospace';
    ctx.fillStyle = '#f7b32b';
    ctx.fillText('던전 크롤러', Renderer.W / 2, 150);
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#e8e0cf';
    ctx.fillText('― 심연의 탑 ―', Renderer.W / 2, 190);

    ctx.font = '15px monospace';
    ctx.fillStyle = '#9aa0b4';
    const lines = [
      'WASD/방향키  이동',
      '마우스 클릭/J  공격 (3연격 콤보)',
      'Space/Shift  대시 (무적)',
      '방을 클리어하고 원하는 문으로 나아가라',
    ];
    lines.forEach((l, i) => ctx.fillText(l, Renderer.W / 2, 265 + i * 26));

    if (Math.floor(blinkT * 1.6) % 2 === 0) {
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#5ce0e6';
      ctx.fillText('클릭 또는 아무 키나 눌러 시작', Renderer.W / 2, 425);
    }
    ctx.font = '12px monospace';
    ctx.fillStyle = '#4a4a5c';
    ctx.fillText('M2 프로토타입 — 던전 루프 · 1층', Renderer.W / 2, 510);
  },

  drawGameOver(ctx, game, blinkT) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,8,15,0.75)';
    ctx.fillRect(0, 0, Renderer.W, Renderer.H);
    ctx.textAlign = 'center';

    ctx.font = 'bold 44px monospace';
    ctx.fillStyle = '#e43b44';
    ctx.fillText('전사했다...', Renderer.W / 2, 190);

    ctx.font = '18px monospace';
    ctx.fillStyle = '#e8e0cf';
    ctx.fillText(
      `${Dungeon.floor}층 방 ${Dungeon.roomIndex} 도달  ·  Lv.${game.level}  ·  처치 ${game.kills}`,
      Renderer.W / 2, 250);
    ctx.fillStyle = '#9aa0b4';
    ctx.font = '14px monospace';
    ctx.fillText(`생존 시간 ${game.time.toFixed(1)}초`, Renderer.W / 2, 280);

    if (Math.floor(blinkT * 1.6) % 2 === 0) {
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#5ce0e6';
      ctx.fillText('R 키 또는 클릭으로 재도전', Renderer.W / 2, 380);
    }
  },

  drawVictory(ctx, game, blinkT) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,8,15,0.75)';
    ctx.fillRect(0, 0, Renderer.W, Renderer.H);
    ctx.textAlign = 'center';

    ctx.font = 'bold 46px monospace';
    ctx.fillStyle = '#f7b32b';
    ctx.fillText('1층 클리어!', Renderer.W / 2, 180);
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#b13ae0';
    ctx.fillText('무덤지기 카론을 쓰러뜨렸다', Renderer.W / 2, 215);

    ctx.font = '17px monospace';
    ctx.fillStyle = '#e8e0cf';
    ctx.fillText(`Lv.${game.level}  ·  처치 ${game.kills}  ·  ${game.time.toFixed(1)}초`, Renderer.W / 2, 270);
    ctx.font = '13px monospace';
    ctx.fillStyle = '#9aa0b4';
    ctx.fillText('(2층부터는 다음 업데이트에서!)', Renderer.W / 2, 300);

    if (Math.floor(blinkT * 1.6) % 2 === 0) {
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#5ce0e6';
      ctx.fillText('R 키 또는 클릭으로 새로운 런 시작', Renderer.W / 2, 390);
    }
  },
};
