// HUD + 화면 오버레이 (시작/게임오버/승리/카드 선택/보스 체력바/유물 목록)
const HUD = {
  draw(ctx, game) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // ── 하트 (HP) ──
    const p = game.player;
    for (let i = 0; i < p.maxHp; i++) {
      const img = i < p.hp ? Sprites.heart : Sprites.heartEmpty;
      ctx.drawImage(img, 14 + (i % 10) * 30, 12 + Math.floor(i / 10) * 22, img.width * 3, img.height * 3);
    }
    const hpRows = Math.ceil(p.maxHp / 10);
    const barY = 16 + hpRows * 22 + 4;

    // ── 대시 충전 (칸 표시) ──
    for (let i = 0; i < p.dashMax; i++) {
      const x = 14 + i * 46;
      ctx.fillStyle = '#1c1c28';
      ctx.fillRect(x, barY, 40, 6);
      let fill = 0;
      if (i < p.dashCharges) fill = 1;
      else if (i === p.dashCharges) fill = Math.min(1, p.dashRegenT / p.dashRegenTime());
      ctx.fillStyle = fill >= 1 ? '#5ce0e6' : '#3a7ca5';
      ctx.fillRect(x, barY, 40 * fill, 6);
    }

    // ── XP 바 + 레벨 ──
    const xpRatio = Math.min(1, game.xp / game.xpNext);
    ctx.fillStyle = '#1c1c28';
    ctx.fillRect(14, barY + 12, 86, 6);
    ctx.fillStyle = '#2ec4b6';
    ctx.fillRect(14, barY + 12, 86 * xpRatio, 6);
    ctx.fillStyle = '#9aa0b4';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Lv.${game.level}`, 104, barY + 20);

    // ── 획득 특성 아이콘 ──
    const counts = {};
    for (const id of p.traits) counts[id] = (counts[id] || 0) + 1;
    let ti = 0;
    for (const id of Object.keys(counts)) {
      const trait = TRAITS.find((t) => t.id === id);
      if (!trait) continue;
      const y = barY + 34 + ti * 22;
      if (y > Renderer.H - 60) break;
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

    // ── 유물 아이콘 (하단) ──
    p.relics.forEach((id, i) => {
      const relic = RELICS.find((r) => r.id === id);
      if (!relic) return;
      const x = 14 + i * 24;
      const y = Renderer.H - 34;
      ctx.fillStyle = '#141420';
      ctx.fillRect(x, y, 20, 20);
      ctx.strokeStyle = RARITY[relic.rarity].color;
      ctx.lineWidth = relic.rarity === 'legendary' ? 2 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, 19, 19);
      ctx.fillStyle = RARITY[relic.rarity].color;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(relic.name[0], x + 10, y + 15);
    });

    // ── 층 진행도 ──
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#e8e0cf';
    const roomLabel = Dungeon.roomType === 'boss'
      ? `${Dungeon.floor}층 보스전`
      : `${Dungeon.floor}층 ${Dungeon.floorName()} · 방 ${Dungeon.roomIndex}/${Dungeon.totalRooms}`;
    ctx.fillText(roomLabel, Renderer.W / 2, 26);

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
      ctx.fillStyle = b.color || '#f7b32b';
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
      ctx.fillText('음소거 (M)', 14, Renderer.H - 44);
    }
  },

  cardRects(n) {
    const w = n === 4 ? 210 : 236;
    const h = 190;
    const gap = n === 4 ? 16 : 26;
    const totalW = n * w + (n - 1) * gap;
    const x0 = (Renderer.W - totalW) / 2;
    const y = 175;
    const rects = [];
    for (let i = 0; i < n; i++) rects.push({ x: x0 + i * (w + gap), y, w, h });
    return rects;
  },

  // 범용 카드 선택 UI (레벨업 특성 / 보스 유물 공용)
  drawCardChoice(ctx, game, cards, title, tagFn, colorFn) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,8,15,0.78)';
    ctx.fillRect(0, 0, Renderer.W, Renderer.H);

    ctx.textAlign = 'center';
    ctx.font = 'bold 32px monospace';
    ctx.fillStyle = '#2ec4b6';
    ctx.fillText(title, Renderer.W / 2, 120);
    ctx.font = '14px monospace';
    ctx.fillStyle = '#9aa0b4';
    ctx.fillText(`선택하세요 (1~${cards.length} 키 또는 클릭)`, Renderer.W / 2, 150);

    const rects = this.cardRects(cards.length);
    const mx = Input.mouse.x, my = Input.mouse.y;

    cards.forEach((c, i) => {
      const r = rects[i];
      const color = colorFn ? colorFn(c) : c.color;
      const hover = mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
      const lift = hover ? -6 : 0;

      ctx.fillStyle = hover ? '#1d1d2e' : '#141420';
      ctx.fillRect(r.x, r.y + lift, r.w, r.h);
      ctx.strokeStyle = color;
      ctx.lineWidth = hover ? 3 : 1.5;
      ctx.strokeRect(r.x, r.y + lift, r.w, r.h);

      ctx.textAlign = 'center';
      const cx = r.x + r.w / 2;
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = color;
      ctx.fillText(tagFn(c), cx, r.y + lift + 32);
      ctx.font = 'bold 21px monospace';
      ctx.fillStyle = '#e8e0cf';
      ctx.fillText(c.name, cx, r.y + lift + 66);
      ctx.font = '13px monospace';
      ctx.fillStyle = '#9aa0b4';
      this._wrapText(ctx, c.desc, cx, r.y + lift + 100, r.w - 28, 19);
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = hover ? color : '#4a4a5c';
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
    ctx.fillText('던전 크롤러', Renderer.W / 2, 140);
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#e8e0cf';
    ctx.fillText('― 심연의 탑 ―', Renderer.W / 2, 180);

    ctx.font = '15px monospace';
    ctx.fillStyle = '#9aa0b4';
    const lines = [
      'WASD/방향키  이동',
      '마우스 클릭/J  공격 (3연격 콤보)',
      'Space/Shift  대시 (무적)',
      '5개 층의 심연을 정복하라',
    ];
    lines.forEach((l, i) => ctx.fillText(l, Renderer.W / 2, 255 + i * 26));

    if (Math.floor(blinkT * 1.6) % 2 === 0) {
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#5ce0e6';
      ctx.fillText('클릭 또는 아무 키나 눌러 시작', Renderer.W / 2, 420);
    }
    ctx.font = '12px monospace';
    ctx.fillStyle = '#4a4a5c';
    ctx.fillText('M3 프로토타입 — 심연의 탑 5층', Renderer.W / 2, 510);
  },

  drawGameOver(ctx, game, blinkT) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,8,15,0.75)';
    ctx.fillRect(0, 0, Renderer.W, Renderer.H);
    ctx.textAlign = 'center';

    ctx.font = 'bold 44px monospace';
    ctx.fillStyle = '#e43b44';
    ctx.fillText('전사했다...', Renderer.W / 2, 180);

    ctx.font = '18px monospace';
    ctx.fillStyle = '#e8e0cf';
    ctx.fillText(
      `${Dungeon.floor}층 ${Dungeon.floorName()} · 방 ${Dungeon.roomIndex} 도달`,
      Renderer.W / 2, 240);
    ctx.font = '15px monospace';
    ctx.fillStyle = '#9aa0b4';
    ctx.fillText(`Lv.${game.level} · 처치 ${game.kills} · 유물 ${game.player.relics.length}개 · ${game.time.toFixed(1)}초`,
      Renderer.W / 2, 272);

    if (Math.floor(blinkT * 1.6) % 2 === 0) {
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#5ce0e6';
      ctx.fillText('R 키 또는 클릭으로 재도전', Renderer.W / 2, 380);
    }
  },

  drawVictory(ctx, game, blinkT) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,8,15,0.8)';
    ctx.fillRect(0, 0, Renderer.W, Renderer.H);
    ctx.textAlign = 'center';

    ctx.font = 'bold 48px monospace';
    ctx.fillStyle = '#f7b32b';
    ctx.fillText('심연의 탑 정복!', Renderer.W / 2, 170);
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#e43b44';
    ctx.fillText('심연의 군주 눅스가 소멸했다', Renderer.W / 2, 208);

    ctx.font = '17px monospace';
    ctx.fillStyle = '#e8e0cf';
    ctx.fillText(`Lv.${game.level} · 처치 ${game.kills} · 유물 ${game.player.relics.length}개`, Renderer.W / 2, 265);
    ctx.font = '15px monospace';
    ctx.fillStyle = '#9aa0b4';
    ctx.fillText(`클리어 시간 ${(game.time / 60).toFixed(1)}분`, Renderer.W / 2, 295);

    if (Math.floor(blinkT * 1.6) % 2 === 0) {
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#5ce0e6';
      ctx.fillText('R 키 또는 클릭으로 새로운 런 시작', Renderer.W / 2, 400);
    }
  },
};
