// HUD + 화면 오버레이 (시작/게임오버/승리/카드 선택/보스 체력바/유물 목록)
const HUD = {
  draw(ctx, game) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // ── 하트 (HP) — 피격 직후엔 부르르 떨린다 ──
    const p = game.player;
    const hShake = game.hurtFlash > 0 ? game.hurtFlash * 22 : 0;
    for (let i = 0; i < p.maxHp; i++) {
      const img = i < p.hp ? Sprites.heart : Sprites.heartEmpty;
      const jx = hShake ? (Math.random() - 0.5) * hShake : 0;
      const jy = hShake ? (Math.random() - 0.5) * hShake : 0;
      ctx.drawImage(img, 14 + (i % 10) * 32 + jx, 12 + Math.floor(i / 10) * 25 + jy, img.width * 3, img.height * 3);
    }
    const hpRows = Math.ceil(p.maxHp / 10);
    const barY = 18 + hpRows * 25 + 4;

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

    // ── 스킬 쿨다운 (K / 우클릭) ──
    const skRatio = Math.max(0, Math.min(1, 1 - p.skillCd / p.skillMaxCd()));
    ctx.fillStyle = '#1c1c28';
    ctx.fillRect(14, barY + 12, 86, 6);
    ctx.fillStyle = skRatio >= 1 ? '#f7b32b' : '#8a6a2b';
    ctx.fillRect(14, barY + 12, 86 * skRatio, 6);
    ctx.fillStyle = skRatio >= 1 ? '#f7b32b' : '#666a80';
    ctx.font = '10px Galmuri11, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${p.skillName()} K`, 104, barY + 19);

    // ── 궁극기 게이지 (R) — 10층 전리품 '처형 선고' ──
    if (p.ult > 0) {
      const ur = Math.max(0, Math.min(1, p.ultGauge / p.ultMax));
      ctx.fillStyle = '#1c1c28';
      ctx.fillRect(210, barY, 56, 6);
      ctx.fillStyle = ur >= 1 ? '#e43b44' : '#5e1420';
      ctx.fillRect(210, barY, 56 * ur, 6);
      ctx.fillStyle = ur >= 1 ? '#e43b44' : '#666a80';
      ctx.font = '10px Galmuri11, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`처형 선고 R${p.ult >= 2 ? '+' : ''}`, 272, barY + 7);
    }

    // ── 보조 스킬 쿨다운 (E) — 스킬 사당에서 획득 ──
    if (p.subSkill) {
      const sd = p.subSkillDef();
      if (sd) {
        const subR = Math.max(0, Math.min(1, 1 - p.subCd / sd.cd));
        ctx.fillStyle = '#1c1c28';
        ctx.fillRect(210, barY + 12, 56, 6);
        ctx.fillStyle = subR >= 1 ? '#c9d94a' : '#6a7a2a';
        ctx.fillRect(210, barY + 12, 56 * subR, 6);
        ctx.fillStyle = subR >= 1 ? '#c9d94a' : '#666a80';
        ctx.font = '10px Galmuri11, monospace';
        ctx.fillText(`${sd.name} E`, 272, barY + 19);
      }
    }

    // ── XP 바 + 레벨 ──
    const xpRatio = Math.min(1, game.xp / game.xpNext);
    ctx.fillStyle = '#1c1c28';
    ctx.fillRect(14, barY + 24, 86, 6);
    ctx.fillStyle = '#2ec4b6';
    ctx.fillRect(14, barY + 24, 86 * xpRatio, 6);
    ctx.fillStyle = '#9aa0b4';
    ctx.font = '11px Galmuri11, monospace';
    ctx.fillText(`Lv.${game.level}`, 104, barY + 32);

    // ── 골드 (G1) — 상인에게만 쓰는 런 화폐 (Lv 옆, 특성 칩과 겹치지 않게) ──
    if (game.gold > 0) {
      ctx.fillStyle = '#ffd866';
      ctx.font = 'bold 12px Galmuri11, monospace';
      ctx.fillText(`${game.gold}G`, 158, barY + 32);
    }

    // ── 획득 특성 아이콘 (UI 정리: 최근 8종 + 요약 — 전체는 Tab에서) ──
    const counts = {};
    for (const id of p.traits) counts[id] = (counts[id] || 0) + 1;
    const traitIds = Object.keys(counts).filter((id) => TRAITS.find((t) => t.id === id));
    const maxTraitChips = 8;
    const shownTraits = traitIds.slice(-maxTraitChips); // 최근 획득 순으로 보여준다
    shownTraits.forEach((id, ti) => {
      const trait = TRAITS.find((t) => t.id === id);
      const y = barY + 46 + ti * 22;
      ctx.fillStyle = '#141420';
      ctx.fillRect(14, y, 18, 18);
      ctx.strokeStyle = trait.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(14.5, y + 0.5, 17, 17);
      ctx.drawImage(Icons.trait(id), 15, y + 1, 16, 16);
      if (counts[id] > 1) {
        ctx.fillStyle = '#e8e0cf';
        ctx.font = '10px Galmuri11, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('x' + counts[id], 35, y + 13);
      }
    });
    if (traitIds.length > maxTraitChips) {
      const y = barY + 46 + shownTraits.length * 22;
      ctx.fillStyle = '#666a80';
      ctx.font = '10px Galmuri11, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`+${traitIds.length - maxTraitChips} (Tab)`, 14, y + 12);
    }

    // ── 유물 아이콘 (하단, 최대 10개 + 요약) ──
    const maxRelicChips = 10;
    p.relics.slice(0, maxRelicChips).forEach((id, i) => {
      const relic = RELICS.find((r) => r.id === id);
      if (!relic) return;
      const x = 14 + i * 24;
      const y = Renderer.H - 34;
      ctx.fillStyle = '#141420';
      ctx.fillRect(x, y, 20, 20);
      ctx.strokeStyle = RARITY[relic.rarity].color;
      ctx.lineWidth = relic.rarity === 'legendary' ? 2 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, 19, 19);
      ctx.drawImage(Icons.relic(id), x + 1, y + 1, 18, 18);
    });
    if (p.relics.length > maxRelicChips) {
      ctx.fillStyle = '#666a80';
      ctx.font = '10px Galmuri11, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`+${p.relics.length - maxRelicChips}`, 14 + maxRelicChips * 24, Renderer.H - 20);
    }

    // ── 층 진행도 ──
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px Galmuri11, monospace';
    ctx.fillStyle = '#e8e0cf';
    const roomLabel = Dungeon.roomType === 'boss'
      ? `${Dungeon.floor}층 보스전`
      : `${Dungeon.floor}층 ${Dungeon.floorName()} · 방 ${Dungeon.roomIndex}/${Dungeon.totalRooms}`;
    ctx.fillText(roomLabel, Renderer.W / 2, 26);

    ctx.textAlign = 'right';
    ctx.font = '13px Galmuri11, monospace';
    ctx.fillStyle = '#9aa0b4';
    ctx.fillText(`처치 ${game.kills}`, Renderer.W - 16, 26);

    // ── 미니맵: 이 층의 여정 — 지나온 방(색 마름모) · 남은 방(점) · 보스(☠) ──
    if (Dungeon.roomLog && Dungeon.roomLog.length && Dungeon.roomType !== 'boss') {
      const cells = Dungeon.roomLog.map((t, i) => ({ t, seen: true, cur: i === Dungeon.roomLog.length - 1 }));
      for (let i = 0, n = Math.max(0, Dungeon.totalRooms - Dungeon.roomIndex - 1); i < n; i++) cells.push({ t: null });
      cells.push({ t: 'boss' });
      const cw = 15;
      let mx = Renderer.W / 2 - (cells.length * cw) / 2 + cw / 2;
      const my = 40;
      for (const c of cells) {
        if (c.t === 'boss') {
          ctx.textAlign = 'center';
          ctx.font = '12px Galmuri11, monospace';
          ctx.fillStyle = '#e43b44';
          ctx.fillText('☠', mx, my + 4);
        } else if (!c.t) {
          ctx.fillStyle = '#3a3a4c'; // 아직 모르는 방
          ctx.fillRect(mx - 2, my - 2, 4, 4);
        } else {
          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = (ROOM_META[c.t] || ROOM_META.combat).color;
          ctx.globalAlpha = c.cur ? 1 : 0.55;
          const s = c.cur ? 5 : 4;
          ctx.fillRect(-s / 2, -s / 2, s, s);
          if (c.cur) {
            ctx.strokeStyle = '#e8e0cf';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-4.5, -4.5, 9, 9);
          }
          ctx.restore();
        }
        mx += cw;
      }
    }

    // ── 보스 체력바 ──
    const boss = game.enemies.find((e) => e.isBoss && !e.dead);
    if (boss) {
      const w = 420;
      const x = (Renderer.W - w) / 2;
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px Galmuri11, monospace';
      ctx.fillStyle = '#b13ae0';
      ctx.fillText(boss.name, Renderer.W / 2, 52);
      ctx.fillStyle = '#1c1c28';
      ctx.fillRect(x, 58, w, 10);
      ctx.fillStyle = boss.phase === 2 ? '#e43b44' : '#b13ae0';
      ctx.fillRect(x, 58, w * Math.max(0, boss.hp / boss.maxHp), 10);
      ctx.strokeStyle = '#3a3a4a';
      ctx.strokeRect(x + 0.5, 58.5, w - 1, 9);
      // 기믹 표시 — 해법은 플레이어가 연구한다
      if (boss.def && boss.def.mechanic) {
        ctx.font = '11px Galmuri11, monospace';
        ctx.fillStyle = boss.phased ? '#b13ae0' : '#9aa0b4';
        ctx.fillText(boss.def.mechanic.label, Renderer.W / 2, 82);
      }
    }

    // ── 배너 ──
    if (game.banner) {
      const b = game.banner;
      const t = b.life / b.maxLife;
      ctx.globalAlpha = Math.min(1, t * 3);
      ctx.textAlign = 'center';
      ctx.font = 'bold 38px Galmuri11, monospace';
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

    // ── 피격 적색 섬광 / 크리티컬 백색 섬광 (한 프레임의 손맛) ──
    const fl = Meta.data.opts?.flash ?? 1; // 설정: 섬광 강도 (광과민성 배려 — 0이면 끔)
    if (game.hurtFlash > 0 && fl > 0) {
      ctx.fillStyle = `rgba(228,59,68,${Math.min(0.14, game.hurtFlash * 0.6) * fl})`;
      ctx.fillRect(0, 0, Renderer.W, Renderer.H);
    }
    if (game.critFlash > 0 && fl > 0) {
      ctx.fillStyle = `rgba(255,247,192,${Math.min(0.08, game.critFlash * 1.0) * fl})`; // 완화 — 번쩍임이 눈 아프지 않게
      ctx.fillRect(0, 0, Renderer.W, Renderer.H);
    }
    if (game.pdodgeFlash > 0 && fl > 0) {
      // 완벽 회피: 청록 섬광 — 슬로모와 함께 '해냈다'는 확실한 신호
      ctx.fillStyle = `rgba(92,224,230,${Math.min(0.14, game.pdodgeFlash * 0.5) * fl})`;
      ctx.fillRect(0, 0, Renderer.W, Renderer.H);
    }

    if (AudioSys.muted) {
      ctx.textAlign = 'left';
      ctx.font = '12px Galmuri11, monospace';
      ctx.fillStyle = '#666a80';
      ctx.fillText('🔇 음소거 (M)', 14, Renderer.H - 44);
    }

    // ── 상시 단축키 바 — 최하단 중앙, 흐리게 (플레이 방해 없이 항상 보인다) ──
    ctx.textAlign = 'center';
    ctx.font = '11px Galmuri11, monospace';
    ctx.fillStyle = 'rgba(154,160,180,0.45)';
    ctx.fillText('WASD 이동 · J/클릭 공격 · Space 대시 · K 스킬 · Tab 목록 · H 도움말 · ESC 일시정지', Renderer.W / 2, Renderer.H - 6);

    // ── 봇 모드 표시 + 층별 사망 리포트 ──
    if (Bot.enabled) {
      ctx.textAlign = 'right';
      ctx.font = 'bold 12px Galmuri11, monospace';
      ctx.fillStyle = '#b13ae0';
      let botLabel = `🤖 봇 모드${Bot.human ? ' · 휴먼' : ''} ×${Bot.ff} (1~4 배속)`;
      if (Bot.loop) botLabel += ` · 런 ${Bot.runs}·승 ${Bot.wins}`;
      ctx.fillText(botLabel, Renderer.W - 16, 30);
      const rep = Bot.deathReport();
      if (rep.total > 0) {
        ctx.font = '11px Galmuri11, monospace';
        ctx.fillStyle = '#e43b44';
        ctx.fillText(`사망 ${rep.total}회 — ${rep.byFloor}`, Renderer.W - 16, Renderer.H - 60);
      }
    }

    // ── 테스트 모드 표시 + 단축키 도움말 ──
    if (game.testMode) {
      ctx.textAlign = 'right';
      ctx.font = 'bold 12px Galmuri11, monospace';
      ctx.fillStyle = '#e43b44';
      ctx.fillText('⚙ 테스트 모드', Renderer.W - 16, 46);
      if (p.god) {
        ctx.fillStyle = '#5ce0e6';
        ctx.fillText('무적', Renderer.W - 16, 62);
      }
      const lines = [
        'G 무적  H 회복  K 전멸',
        'L 레벨업  U 유물  O 한 조각',
        'B 보스방  N 다음층  V 봇  F 부활',
      ];
      if (game.reviveMode) {
        ctx.fillStyle = '#5ce0e6';
        ctx.fillText('♻ 무한 부활', Renderer.W - 16, p.god ? 78 : 62);
      }
      ctx.font = '10px Galmuri11, monospace';
      ctx.fillStyle = 'rgba(154,160,180,0.75)';
      lines.forEach((l, i) => ctx.fillText(l, Renderer.W - 16, Renderer.H - 46 + i * 14));
    }
  },

  cardRects(n, h = 165) {
    // UI 정리: 선택 카드 축소 (236×190 → 204×165, 화면 폭 79%→67%) — 전장이 계속 보인다
    const w = n === 4 ? 182 : 204;
    const gap = n === 4 ? 14 : 18;
    const totalW = n * w + (n - 1) * gap;
    const x0 = (Renderer.W - totalW) / 2;
    const y = 168;
    const rects = [];
    for (let i = 0; i < n; i++) rects.push({ x: x0 + i * (w + gap), y, w, h });
    return rects;
  },

  // 범용 카드 선택 UI (레벨업 특성 / 보스 유물 공용)
  // ── 왕국 진군 지도 (양피지) — 막 시작마다 길을 고른다: 선택이 막의 성격을 정한다 ──
  drawRouteChoice(ctx, game) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,6,4,0.82)';
    ctx.fillRect(0, 0, Renderer.W, Renderer.H);

    // 양피지 판 — 태운 가장자리 + 얼룩
    const px = 90, py = 34, pw = Renderer.W - 180, ph = Renderer.H - 68;
    ctx.fillStyle = '#2a2318';
    ctx.fillRect(px - 6, py - 6, pw + 12, ph + 12);
    ctx.fillStyle = '#c9b98d';
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = 'rgba(120,90,50,0.18)';
    for (let i = 0; i < 14; i++) {
      const bx = px + ((i * 149) % (pw - 60)), by = py + ((i * 83) % (ph - 40));
      ctx.beginPath(); ctx.ellipse(bx + 30, by + 20, 26 + (i % 3) * 12, 12 + (i % 4) * 5, i, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(60,40,20,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(px + 7, py + 7, pw - 14, ph - 14);

    ctx.textAlign = 'center';
    ctx.font = 'bold 22px Galmuri11, monospace';
    ctx.fillStyle = '#3a2c1a';
    ctx.fillText(`왕국 진군 지도 — ${game.act}막`, Renderer.W / 2, py + 42);

    // 행군로: 묘지 → 다리 → 재판소 → 마을 → 왕좌 (현재 막 강조)
    const LM = ['† 묘지', '≋ 다리', '⚖ 재판소', '✝ 마을', '♛ 왕좌'];
    const mapY = py + 84;
    const step = (pw - 160) / 4;
    ctx.strokeStyle = 'rgba(90,60,30,0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(px + 80, mapY);
    ctx.lineTo(px + 80 + step * 4, mapY);
    ctx.stroke();
    ctx.setLineDash([]);
    LM.forEach((name, i) => {
      const lx = px + 80 + step * i;
      const here = i === game.act - 1;
      ctx.fillStyle = here ? '#7a1c28' : 'rgba(60,40,20,0.85)';
      ctx.beginPath(); ctx.arc(lx, mapY, here ? 8 : 5, 0, Math.PI * 2); ctx.fill();
      ctx.font = here ? 'bold 13px Galmuri11, monospace' : '11px Galmuri11, monospace';
      ctx.fillStyle = here ? '#7a1c28' : 'rgba(60,40,20,0.8)';
      ctx.fillText(name, lx, mapY - 16);
      if (here) ctx.fillText('▼', lx, mapY + 24);
    });

    ctx.font = '12px Galmuri11, monospace';
    ctx.fillStyle = 'rgba(60,40,20,0.8)';
    ctx.fillText('어느 길로 진군하는가 (1~3 키 또는 클릭)', Renderer.W / 2, mapY + 46);

    // 루트 3택 — 양피지 위의 낡은 카드
    const rects = this.cardRects(3);
    const mx = Input.mouse.x, my = Input.mouse.y;
    game.routeCards.forEach((c, i) => {
      const r = rects[i];
      const hover = mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
      const lift = hover ? -5 : 0;
      ctx.fillStyle = hover ? '#efe2bd' : '#d9c99b';
      ctx.fillRect(r.x, r.y + lift, r.w, r.h);
      ctx.strokeStyle = c.color;
      ctx.lineWidth = hover ? 3 : 1.5;
      ctx.strokeRect(r.x, r.y + lift, r.w, r.h);
      const cx = r.x + r.w / 2;
      ctx.font = 'bold 11px Galmuri11, monospace';
      ctx.fillStyle = c.color;
      ctx.fillText(`[ ${c.tag} ]`, cx, r.y + lift + 26);
      ctx.font = 'bold 17px Galmuri11, monospace';
      ctx.fillStyle = '#3a2c1a';
      ctx.fillText(c.name, cx, r.y + lift + 52);
      ctx.font = '12px Galmuri11, monospace';
      ctx.fillStyle = '#5a4630';
      this._wrapText(ctx, c.desc, cx, r.y + lift + 80, r.w - 24, 16);
      ctx.font = 'italic 10.5px Galmuri11, monospace';
      ctx.fillStyle = 'rgba(90,60,30,0.75)';
      this._wrapText(ctx, `"${c.lore}"`, cx, r.y + lift + r.h - 44, r.w - 26, 14);
      ctx.font = 'bold 14px Galmuri11, monospace';
      ctx.fillStyle = hover ? c.color : 'rgba(60,40,20,0.5)';
      ctx.fillText(String(i + 1), cx, r.y + lift + r.h - 12);
    });
  },

  drawCardChoice(ctx, game, cards, title, tagFn, colorFn) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,8,15,0.78)';
    ctx.fillRect(0, 0, Renderer.W, Renderer.H);

    ctx.textAlign = 'center';
    ctx.font = 'bold 24px Galmuri11, monospace';
    ctx.fillStyle = '#2ec4b6';
    ctx.fillText(title, Renderer.W / 2, 112);
    ctx.font = '12px Galmuri11, monospace';
    ctx.fillStyle = '#9aa0b4';
    ctx.fillText(`선택하세요 (1~${cards.length} 키 또는 클릭)`, Renderer.W / 2, 138);

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
      // 전설 카드: 이중 황금 테두리 + 반짝임
      if (c.legend) {
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.006) * 0.3;
        ctx.strokeStyle = '#fff7c0';
        ctx.lineWidth = 1;
        ctx.strokeRect(r.x - 4, r.y + lift - 4, r.w + 8, r.h + 8);
        ctx.restore();
      }

      ctx.textAlign = 'center';
      const cx = r.x + r.w / 2;
      ctx.font = 'bold 11px Galmuri11, monospace';
      ctx.fillStyle = color;
      ctx.fillText(tagFn(c), cx, r.y + lift + 26);
      // 픽셀 아이콘 (우상단 장식) — 유물은 rarity, 특성은 tag로 구분
      if (c.id) {
        const ic = c.rarity ? Icons.relic(c.id) : Icons.trait(c.id);
        if (ic) ctx.drawImage(ic, r.x + r.w - 32, r.y + lift + 8, 24, 24);
      }
      ctx.font = 'bold 18px Galmuri11, monospace';
      ctx.fillStyle = '#e8e0cf';
      ctx.fillText(c.name, cx, r.y + lift + 52);
      ctx.font = '12px Galmuri11, monospace';
      ctx.fillStyle = '#9aa0b4';
      this._wrapText(ctx, c.desc, cx, r.y + lift + 80, r.w - 24, 16);
      // 기억 한 줄 (유물 lore) — 모든 힘은 과거에서 온다. 전용 유물(heir)은 표기도 함께
      if (c.lore) {
        ctx.font = 'italic 10.5px Galmuri11, monospace';
        ctx.fillStyle = '#7a7060';
        this._wrapText(ctx, `"${c.lore}"`, cx, r.y + lift + r.h - (c.heir ? 60 : 46), r.w - 26, 14);
        if (c.heir) {
          ctx.font = 'bold 10px Galmuri11, monospace';
          ctx.fillStyle = '#b08d4a';
          const cn = CLASSES[c.heir];
          ctx.fillText(`◆ ${cn ? cn.name : c.heir}의 유품`, cx, r.y + lift + r.h - 26);
        }
      }
      // 중첩 특성: 보유 수 / 상한 표시
      if (c.max && game.player) {
        const owned = game.player.traits.filter((id) => id === c.id).length;
        if (owned > 0) {
          ctx.font = '11px Galmuri11, monospace';
          ctx.fillStyle = '#666a80';
          ctx.fillText(`보유 ${owned}/${c.max}`, cx, r.y + lift + r.h - 30);
        }
      }
      // 직업 특성: 스킬 진화 진행도 힌트 (직업 특성 3장 + Lv.12 → 스킬의 형태가 바뀐다)
      if (c.cls && game.player && !game.player.skillEvolved) {
        const clsOwned = game.player.traits.filter((id) => {
          const t = TRAITS.find((x) => x.id === id);
          return t && t.cls;
        }).length;
        ctx.font = 'bold 10px Galmuri11, monospace';
        ctx.fillStyle = '#f7b32b';
        ctx.fillText(
          game.player.evoReady
            ? `⚡ 개화 대기 — Lv.12 (현재 ${game.level})`
            : `⚡ 스킬 진화 ${clsOwned}/3 · Lv.12`,
          cx, r.y + lift + r.h - 44);
      }
      ctx.font = 'bold 14px Galmuri11, monospace';
      ctx.fillStyle = hover ? color : '#4a4a5c';
      ctx.fillText(String(i + 1), cx, r.y + lift + r.h - 12);
    });

    // 리롤 각인: 남은 횟수 표시
    if (game.player && game.player.rerolls > 0 && game.state === 'levelup') {
      ctx.font = 'bold 14px Galmuri11, monospace';
      ctx.fillStyle = '#2ec4b6';
      ctx.fillText(`E — 다시 뽑기 (남은 ${game.player.rerolls}회)`, Renderer.W / 2, Renderer.H - 60);
    }
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

  // ══════════════ 거점 (기억의 제단 앞) ══════════════

  _drawHubBg(ctx, blinkT) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0912';
    ctx.fillRect(0, 0, Renderer.W, Renderer.H);
    // 별처럼 흩날리는 영혼 입자
    ctx.fillStyle = '#2ec4b6';
    for (let i = 0; i < 24; i++) {
      const sx = (i * 173 + 89) % Renderer.W;
      const sy = ((i * 97 + blinkT * 12 * ((i % 3) + 1)) % Renderer.H);
      ctx.globalAlpha = 0.15 + (i % 4) * 0.08;
      ctx.fillRect(sx, Renderer.H - sy, 2, 2);
    }
    ctx.globalAlpha = 1;
  },

  // ── 거점 야영 장면 (첫인상 스프린트 ①) — 무덤 언덕의 밤, 모닥불에 모인 네 망자 ──
  _drawHubScene(ctx, t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const W = Renderer.W, H = Renderer.H;
    // 하늘: 검은 남보라 → 지평선의 죽은 자주빛
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7);
    sky.addColorStop(0, '#07060e');
    sky.addColorStop(0.7, '#120c1e');
    sky.addColorStop(1, '#1c1226');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // 별 (영혼 입자 겸용)
    for (let i = 0; i < 40; i++) {
      const sx = (i * 173 + 89) % W;
      const sy = (i * 97 + 31) % Math.round(H * 0.55);
      ctx.globalAlpha = 0.10 + (i % 4) * 0.07 + Math.sin(t * 1.5 + i) * 0.04;
      ctx.fillStyle = i % 7 === 0 ? '#2ec4b6' : '#c8ccd8';
      ctx.fillRect(sx, sy, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;
    // 창백한 달 — 다섯 번째 손의 시선이 걸려 있는 곳
    const mx = 796, my = 96, mr = 34;
    const glow = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 3.4);
    glow.addColorStop(0, 'rgba(216,211,197,0.20)');
    glow.addColorStop(1, 'rgba(216,211,197,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(mx - mr * 3.4, my - mr * 3.4, mr * 6.8, mr * 6.8);
    ctx.fillStyle = '#d8d3c5';
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b8b2a2';
    ctx.beginPath(); ctx.arc(mx - 10, my - 6, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 8, my + 10, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 12, my - 12, 3, 0, Math.PI * 2); ctx.fill();
    // 지평선 왕성 실루엣 — 복수의 끝이 보이는 곳
    ctx.fillStyle = '#0d0a16';
    ctx.fillRect(700, 296, 220, 60);
    for (const [tx, tw, th] of [[706, 26, 38], [756, 34, 62], [818, 30, 48], [872, 24, 70]]) {
      ctx.fillRect(tx, 296 - th, tw, th + 20);
      ctx.fillRect(tx - 3, 296 - th, tw + 6, 7); // 총안
    }
    ctx.fillStyle = 'rgba(247,179,43,0.35)'; // 왕성의 불 켜진 창 — 왕은 잠들지 못한다
    ctx.fillRect(764, 252, 4, 5); ctx.fillRect(880, 240, 3, 5); ctx.fillRect(826, 268, 3, 4);
    // 무덤 언덕 실루엣 (2겹)
    ctx.fillStyle = '#0f0c18';
    ctx.beginPath();
    ctx.moveTo(0, 356);
    ctx.quadraticCurveTo(240, 306, 520, 348);
    ctx.quadraticCurveTo(760, 382, W, 352);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    // 언덕 위 비석·십자가 실루엣
    ctx.fillStyle = '#171226';
    for (const [gx, gy, gw, gh, cross] of [[96, 328, 14, 22, 0], [150, 318, 10, 18, 1], [214, 314, 16, 24, 0], [420, 330, 12, 20, 1], [500, 338, 14, 20, 0], [610, 356, 10, 16, 1]]) {
      if (cross) {
        ctx.fillRect(gx + gw / 2 - 2, gy - 8, 4, gh + 8);
        ctx.fillRect(gx, gy - 1, gw, 4);
      } else {
        ctx.fillRect(gx, gy, gw, gh);
        ctx.fillRect(gx + 2, gy - 4, gw - 4, 5);
      }
    }
    // 죽은 나무 (좌측)
    ctx.strokeStyle = '#171226';
    ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(52, 352); ctx.quadraticCurveTo(60, 280, 44, 232); ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(52, 292); ctx.quadraticCurveTo(88, 268, 104, 244); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(48, 262); ctx.quadraticCurveTo(20, 240, 14, 214); ctx.stroke();
    // 전경 지면
    const gnd = ctx.createLinearGradient(0, H * 0.66, 0, H);
    gnd.addColorStop(0, '#151020');
    gnd.addColorStop(1, '#0b0912');
    ctx.fillStyle = gnd;
    ctx.fillRect(0, H * 0.66, W, H);
    // 안개 띠 (느리게 흐름)
    for (let k = 0; k < 3; k++) {
      const fy = 344 + k * 16;
      ctx.globalAlpha = 0.05 + k * 0.02;
      ctx.fillStyle = '#9aa0b4';
      const off = (t * (6 + k * 4)) % (W + 400) - 200;
      ctx.beginPath();
      ctx.ellipse(off, fy, 260, 10 + k * 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse((off + 520) % (W + 400), fy + 6, 220, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // ── 모닥불 (좌측 전경) + 네 망자 ──
    const fx = 260, fy = 442;
    const flick = 0.85 + Math.sin(t * 11) * 0.1 + Math.sin(t * 23 + 1.7) * 0.05;
    // 불빛
    const light = ctx.createRadialGradient(fx, fy - 8, 10, fx, fy - 8, 190 * flick);
    light.addColorStop(0, 'rgba(255,150,60,0.22)');
    light.addColorStop(0.5, 'rgba(200,90,30,0.10)');
    light.addColorStop(1, 'rgba(200,90,30,0)');
    ctx.fillStyle = light;
    ctx.fillRect(fx - 200, fy - 200, 400, 400);
    // 네 망자 — 불가에 둘러앉은 동료들 (선택 직업은 또렷하게, 나머지는 어둡게)
    const seats = { knight: [-84, -4, false], archer: [72, -2, true], mage: [-30, -34, false], alch: [34, 16, true] };
    for (const id of Object.keys(seats)) {
      const cls = CLASSES[id];
      const fr = Sprites.playerFrames[cls.sprite];
      if (!fr) continue;
      const [ox, oy, flip] = seats[id];
      const img = fr[0];
      const px = fx + ox, py = fy + oy;
      const sel = Meta.data.cls === id;
      const bob = Math.sin(t * 2.2 + ox) * 1.5;
      ctx.save();
      // 그림자
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(px, py + 30, 20, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = sel ? 1 : 0.62;
      ctx.translate(px, py + bob);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(img, -img.width * 1.5, -img.height * 1.5, img.width * 3, img.height * 3);
      ctx.restore();
      if (sel) {
        ctx.globalAlpha = 0.9;
        ctx.textAlign = 'center';
        ctx.font = 'bold 12px Galmuri11, monospace';
        ctx.fillStyle = cls.color;
        ctx.fillText(cls.name, px, py - 34);
      }
      ctx.globalAlpha = 1;
    }
    // 장작 + 불꽃 (망자들 위에 그려 앞장면 유지)
    ctx.fillStyle = '#3a2c1a';
    ctx.fillRect(fx - 16, fy + 6, 32, 5);
    ctx.fillRect(fx - 12, fy + 10, 24, 4);
    for (let k = 0; k < 3; k++) {
      const fh = (26 - k * 7) * flick;
      const fw = 16 - k * 4;
      ctx.fillStyle = ['#e25822', '#f7b32b', '#fff7c0'][k];
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(fx - fw / 2, fy + 6);
      ctx.quadraticCurveTo(fx - fw / 2 + Math.sin(t * 9 + k) * 3, fy - fh * 0.6, fx + Math.sin(t * 13 + k * 2) * 2.5, fy + 6 - fh);
      ctx.quadraticCurveTo(fx + fw / 2 + Math.sin(t * 11 + k) * 3, fy - fh * 0.5, fx + fw / 2, fy + 6);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 불티
    for (let i = 0; i < 7; i++) {
      const ph = ((t * (0.5 + (i % 3) * 0.22) + i * 0.37) % 1);
      const ex = fx + Math.sin(t * 2 + i * 2.4) * (8 + ph * 22);
      const ey = fy - ph * 90;
      ctx.globalAlpha = (1 - ph) * 0.75;
      ctx.fillStyle = i % 2 ? '#ffd866' : '#e25822';
      ctx.fillRect(ex, ey, 2, 2);
    }
    ctx.globalAlpha = 1;
  },

  _shardLabel(ctx, x, y, align = 'right') {
    ctx.textAlign = align;
    ctx.font = 'bold 17px Galmuri11, monospace';
    ctx.fillStyle = '#2ec4b6';
    ctx.fillText(`◆ ${Meta.data.shards}`, x, y);
  },

  hubButtonRects() {
    const w = 320, h = 46, gap = 10;
    const x = Renderer.W - 404; // 우측 열 — 좌측은 모닥불 야영 장면
    const y0 = 268;
    return [0, 1, 2, 3].map((i) => ({ x, y: y0 + i * (h + gap), w, h }));
  },

  heatButtonRects() {
    const cy = 243;
    return [
      { x: Renderer.W / 2 - 156, y: cy - 15, w: 26, h: 26 },
      { x: Renderer.W / 2 + 130, y: cy - 15, w: 26, h: 26 },
    ];
  },

  // 열기 서약 칩 — 서약 편집 패널(로드아웃 줄 클릭)에서만 표시
  pactChipRects() {
    const n = HEAT_PACTS.length;
    const w = n > 5 ? 100 : 108, h = 18, gap = 5;
    const total = n * w + (n - 1) * gap;
    const x0 = (Renderer.W - total) / 2;
    return HEAT_PACTS.map((_, i) => ({ x: x0 + i * (w + gap), y: 224, w, h }));
  },

  // 로드아웃 한 줄 (직업 · 열기) — 클릭 영역 (우측 열 상단)
  loadoutLineRect() {
    return { x: Renderer.W - 374, y: 190, w: 260, h: 34 };
  },

  // 이어하기 슬림 버튼 (우측 열)
  resumeButtonRect() {
    return { x: Renderer.W - 404, y: 234, w: 320, h: 26 };
  },

  backButtonRect() {
    return { x: Renderer.W / 2 - 90, y: Renderer.H - 62, w: 180, h: 40 };
  },

  _drawBackButton(ctx) {
    const r = this.backButtonRect();
    const hover = Input.mouse.x >= r.x && Input.mouse.x <= r.x + r.w &&
                  Input.mouse.y >= r.y && Input.mouse.y <= r.y + r.h;
    ctx.fillStyle = hover ? '#1d1d2e' : '#141420';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = hover ? '#9aa0b4' : '#4a4a5c';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px Galmuri11, monospace';
    ctx.fillStyle = '#9aa0b4';
    ctx.fillText('돌아가기 (ESC)', r.x + r.w / 2, r.y + 25);
  },

  drawHub(ctx, blinkT) {
    this._drawHubScene(ctx, blinkT);
    ctx.textAlign = 'center';

    // 타이틀 타이포 — 그림자 → 핏빛 그라데이션 → 상단 하이라이트 3겹
    {
      const cx = Renderer.W / 2;
      ctx.font = 'bold 50px Galmuri11, monospace';
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillText('무덤에서 왕좌까지', cx + 3, 116 + 4);
      const tg = ctx.createLinearGradient(0, 74, 0, 122);
      tg.addColorStop(0, '#e8503f');
      tg.addColorStop(0.55, '#a81e2c');
      tg.addColorStop(1, '#5e0f1c');
      ctx.fillStyle = tg;
      ctx.fillText('무덤에서 왕좌까지', cx, 116);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#ffd8c0';
      ctx.fillText('무덤에서 왕좌까지', cx, 114);
      ctx.globalAlpha = 1;
      // 장식 괘선 + 마름모
      ctx.strokeStyle = '#6a5a40';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx - 240, 142); ctx.lineTo(cx - 70, 142); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 70, 142); ctx.lineTo(cx + 240, 142); ctx.stroke();
      ctx.fillStyle = '#b08d4a';
      ctx.save(); ctx.translate(cx - 58, 142); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore();
      ctx.save(); ctx.translate(cx + 58, 142); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore();
      ctx.font = 'bold 16px Galmuri11, monospace';
      ctx.fillStyle = '#9a9488';
      ctx.fillText('죄인의 묘지', cx, 147);
    }

    // 거점 반응 서사 (④): 기록에 따라 탑이 다르게 말을 건다
    {
      const w = Meta.data.wins, bf = Meta.data.bestFloor;
      const line = w >= 10 ? '왕은 이제 잠들지 못한다. 너의 이름이 저주가 되었다.'
        : w >= 5 ? '왕도의 벽마다 네 목의 값이 새로 붙는다 — 값은 오르기만 한다.'
        : w >= 2 ? '왕이 토벌대를 두 배로 늘렸다. 두려움의 크기다.'
        : w >= 1 ? '처형인이 죽었다는 소문이 왕성에 닿았다. 왕이 잔을 떨어뜨렸다.'
        : bf >= 8 ? '단서가 모이고 있다. 진실이 형태를 갖추기 시작한다.'
        : bf >= 5 ? '토벌대가 묘지 쪽을 흘끔거린다 — 무언가 걸어나온 걸 아는 눈치다.'
        : bf >= 2 ? '흙을 털고 일어섰다. 무덤은 너를 붙잡지 못했다.'
        : '그날 밤, 죄인의 묘지에서 눈이 떠졌다.';
      ctx.font = '12px Galmuri11, monospace';
      ctx.fillStyle = '#666a80';
      ctx.fillText(line, Renderer.W / 2, 176);
    }



    this._shardLabel(ctx, Renderer.W - 24, 36);
    if (Meta.data.runs > 0) {
      ctx.textAlign = 'left';
      ctx.font = '12px Galmuri11, monospace';
      ctx.fillStyle = '#666a80';
      ctx.fillText(`도전 ${Meta.data.runs}회 · 최고 ${Meta.data.bestFloor}층 · 누적 처치 ${Meta.data.totalKills}`, 24, 36);
    }

    const cls = CLASSES[Meta.data.cls];
    ctx.textAlign = 'center';
    ctx.font = '14px Galmuri11, monospace';
    ctx.fillStyle = '#9aa0b4';
    // 로드아웃 한 줄 (UI 개편): 직업 + 열기 통합 — 클릭하면 서약 편집 패널이 열린다
    {
      const heat = Meta.heatUnlocked() ? Meta.heat() : 0;
      const lr = this.loadoutLineRect();
      const hover = Input.mouse.x >= lr.x && Input.mouse.x <= lr.x + lr.w &&
                    Input.mouse.y >= lr.y && Input.mouse.y <= lr.y + lr.h;
      const rcx = lr.x + lr.w / 2; // 우측 열 중심
      ctx.font = 'bold 15px Galmuri11, monospace';
      ctx.fillStyle = cls.color;
      const heatStr = Meta.heatUnlocked() ? (heat >= 8 ? '  ·  ☠ 왕의 진노' : `  ·  현상금 ${heat}단계`) : '';
      ctx.fillText(cls.name + heatStr, rcx, lr.y + 15);
      if (Meta.heatUnlocked() && heat > 0) {
        ctx.font = '11px Galmuri11, monospace';
        ctx.fillStyle = '#666a80';
        ctx.fillText(`한 조각 +${heat * 20}%`, rcx, lr.y + 44);
      }
      if (!Meta.heatUnlocked()) {
        // 잠금 안내 — 조건 없이는 기능이 숨겨진 것처럼 보인다 (실플레이 제보)
        ctx.font = '10px Galmuri11, monospace';
        ctx.fillStyle = '#4a4a5c';
        ctx.fillText('🔒 현상금(난이도) — 5층 도달 또는 첫 승리 시 해금', rcx, lr.y + 30);
      }
      if (Meta.heatUnlocked()) {
        const FLAVOR = [
          '수배 없음 — 왕은 아직 너를 모른다',
          '방이 붙었다', '토벌대가 소집된다', '현상금이 두 배로 뛰었다',
          '정예가 움직인다', '왕실 밀정이 붙었다', '토벌령이 전 영지에 내렸다',
          '왕이 네 이름을 기억했다',
          '왕이 직접 토벌을 명했다 — 살아서 왕좌에 닿은 자는 없다',
        ];
        ctx.font = '10px Galmuri11, monospace';
        ctx.fillStyle = heat >= 8 ? '#e43b44' : hover ? '#9aa0b4' : '#4a4a5c';
        ctx.fillText(`${FLAVOR[Math.min(8, heat)]} · ←→ 조절`, rcx, lr.y + 30);
      }
    }

    // (난이도 개편) 서약 편집 패널 제거 — 세부는 은닉, 단계만 남는다

    // 이어하기 슬림 버튼 — 중단된 런이 있을 때만
    {
      const rs = Game.loadRunSave && Game.loadRunSave();
      if (rs && !Game._pactEdit) {
        const r = this.resumeButtonRect();
        const hover = Input.mouse.x >= r.x && Input.mouse.x <= r.x + r.w &&
                      Input.mouse.y >= r.y && Input.mouse.y <= r.y + r.h;
        ctx.fillStyle = hover ? '#132a28' : '#0f2220';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = '#2ec4b6';
        ctx.lineWidth = hover ? 2 : 1;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.font = 'bold 13px Galmuri11, monospace';
        ctx.fillStyle = '#2ec4b6';
        ctx.textAlign = 'center';
        ctx.fillText(`C — 이어하기  (${rs.floor}층 · Lv.${rs.level}${rs.heat > 0 ? ' · 현상금 ' + rs.heat : ''})`, r.x + r.w / 2, r.y + 18);
      }
    }

    const disc = Object.keys(Meta.data.codex.kills).length + Object.keys(Meta.data.codex.relics).length +
                 Object.keys(Meta.data.codex.traits).length;
    const total = CODEX_ENEMIES.length + RELICS.length + TRAITS.length;
    const labels = [
      { text: '출발', sub: '왕좌를 향해 걷는다', color: '#8a1c2c' },
      { text: '비석의 맹세', sub: '한(恨) 조각으로 영구 강화', color: '#2ec4b6' },
      { text: '망자 선택', sub: '가레스 · 레나 · 오르빈 · 이졸데', color: '#b13ae0' },
      { text: '도감', sub: `수집 기록 ${disc}/${total}`, color: '#f7b32b' },
    ];
    this.hubButtonRects().forEach((r, i) => {
      const hover = Input.mouse.x >= r.x && Input.mouse.x <= r.x + r.w &&
                    Input.mouse.y >= r.y && Input.mouse.y <= r.y + r.h;
      ctx.fillStyle = hover ? '#1d1d2e' : '#141420';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = labels[i].color;
      ctx.lineWidth = hover ? 3 : 1.5;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.textAlign = 'left';
      ctx.font = 'bold 17px Galmuri11, monospace';
      ctx.fillStyle = '#e8e0cf';
      ctx.fillText(`${i + 1}. ${labels[i].text}`, r.x + 22, r.y + 20);
      ctx.font = '11px Galmuri11, monospace';
      ctx.fillStyle = '#666a80';
      ctx.fillText(labels[i].sub, r.x + 22, r.y + 37);
    });

    // 오늘의 탑 — 날짜 시드 도전 안내 + 오늘 기록
    {
      const now = new Date();
      const key = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
      const rec = Meta.data.daily && Meta.data.daily.key === key ? Meta.data.daily : null;
      // 도전 모드 통합 한 줄 (UI 개편): 러시 | 오늘의 탑 — 좌우 분산·장문 제거
      ctx.font = 'bold 13px Galmuri11, monospace';
      const rrec = Meta.data.rushBest;
      if (Meta.data.wins > 0) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#e43b44';
        ctx.fillText(`⚔ B 원수 연전${rrec && rrec.floor > 0 ? ` · ${rrec.floor}원수` : ''}`, Renderer.W / 2 - 24, Renderer.H - 30);
      }
      ctx.textAlign = Meta.data.wins > 0 ? 'left' : 'center';
      ctx.fillStyle = '#f7b32b';
      ctx.fillText(
        rec ? `📜 D 오늘의 수배령 · 오늘 ${rec.floor}층${rec.victory ? ' 완수!' : ''}` : '📜 D 오늘의 수배령 — 매일 같은 시드',
        Meta.data.wins > 0 ? Renderer.W / 2 + 24 : Renderer.W / 2, Renderer.H - 30);
      // 왕도 직행 — 왕좌 정복자에게만 열리는 지름길
      if (Meta.data.epilogueSeen || Meta.data.bestFloor >= 50) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd866';
        ctx.fillText('👑 G 왕도 직행 — 3막부터, 시작 빌드 지급', Renderer.W / 2, Renderer.H - 48);
      }
    }

    ctx.textAlign = 'center';
    ctx.font = '12px Galmuri11, monospace';
    ctx.fillStyle = '#4a4a5c';
    ctx.fillText('WASD 이동 · 클릭/J 공격 · Space 대시 · M 음소거 · O 설정', Renderer.W / 2, Renderer.H - 12);

    // 테스트 모드 상태 (T로 토글)
    if (Game.testMode) {
      ctx.textAlign = 'left';
      ctx.font = 'bold 12px Galmuri11, monospace';
      ctx.fillStyle = '#e43b44';
      ctx.fillText('⚙ 테스트 모드 ON (T로 끄기)', 24, Renderer.H - 20);
      ctx.font = '11px Galmuri11, monospace';
      ctx.fillStyle = '#9aa0b4';
      ctx.fillText('O 한 조각+500 · I 도감 완성 · Y 직업/열기 해금 · V 봇 모드 · 게임 중 G무적 X전멸 N다음층...', 24, Renderer.H - 40);
    }
  },

  // 제단 목록 — 정복자에게는 깨어진 비석(상위 열)이 함께 열린다
  altarList() {
    return Meta.brokenUnlocked() ? META_UPGRADES.concat(BROKEN_STONES) : META_UPGRADES;
  },

  altarRowRects() {
    const broken = Meta.brokenUnlocked();
    const h = 44, gap = 8;
    if (!broken) {
      const w = 620, x = (Renderer.W - w) / 2, y0 = 108;
      return META_UPGRADES.map((_, i) => ({ x, y: y0 + i * (h + gap), w, h }));
    }
    // 2열: 좌 원한의 비석 7 / 우 깨어진 비석 5
    const w = 460, y0 = 130;
    const rects = META_UPGRADES.map((_, i) => ({ x: Renderer.W / 2 - w - 10, y: y0 + i * (h + gap), w, h }));
    BROKEN_STONES.forEach((_, i) => rects.push({ x: Renderer.W / 2 + 10, y: y0 + i * (h + gap), w, h }));
    return rects;
  },

  drawAltar(ctx, blinkT) {
    this._drawHubBg(ctx, blinkT);
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px Galmuri11, monospace';
    ctx.fillStyle = '#2ec4b6';
    ctx.fillText('원한의 비석', Renderer.W / 2, 70);
    this._shardLabel(ctx, Renderer.W - 24, 36);

    const list = this.altarList();
    const broken = Meta.brokenUnlocked();
    if (broken) {
      ctx.font = 'bold 14px Galmuri11, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#2ec4b6';
      ctx.fillText('원한의 비석', Renderer.W / 2 - 240, 118);
      ctx.fillStyle = '#ffd866';
      ctx.fillText('👑 깨어진 비석 — 정복의 증표', Renderer.W / 2 + 240, 118);
    }
    this.altarRowRects().forEach((r, i) => {
      const up = list[i];
      const isBroken = i >= META_UPGRADES.length;
      const accent = isBroken ? '#ffd866' : '#2ec4b6';
      const lv = Meta.lvl(up.id);
      const cost = Meta.cost(up.id);
      const maxed = cost === null;
      const affordable = !maxed && Meta.data.shards >= cost;
      const hover = Input.mouse.x >= r.x && Input.mouse.x <= r.x + r.w &&
                    Input.mouse.y >= r.y && Input.mouse.y <= r.y + r.h;

      ctx.fillStyle = hover && !maxed ? '#1d1d2e' : '#141420';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = maxed ? '#4a4a5c' : affordable ? accent : '#3a3a4a';
      ctx.lineWidth = hover && affordable ? 3 : 1.5;
      ctx.strokeRect(r.x, r.y, r.w, r.h);

      ctx.textAlign = 'left';
      ctx.font = 'bold 15px Galmuri11, monospace';
      ctx.fillStyle = '#e8e0cf';
      ctx.fillText(`${isBroken ? '👑' : (i + 1) + '.'} ${up.name}`, r.x + 16, r.y + 19);
      ctx.font = '12px Galmuri11, monospace';
      ctx.fillStyle = '#9aa0b4';
      ctx.fillText(up.desc, r.x + 16, r.y + 36);

      // 레벨 핍
      const pipX = r.x + r.w - 150;
      for (let l = 0; l < up.max; l++) {
        ctx.fillStyle = l < lv ? accent : '#2a2a3a';
        ctx.fillRect(pipX + l * 16, r.y + 17, 10, 10);
      }

      ctx.textAlign = 'right';
      ctx.font = 'bold 14px Galmuri11, monospace';
      if (maxed) {
        ctx.fillStyle = '#666a80';
        ctx.fillText('완성', r.x + r.w - 16, r.y + 28);
      } else {
        ctx.fillStyle = affordable ? accent : '#8a4a4a';
        ctx.fillText(`◆ ${cost}`, r.x + r.w - 16, r.y + 28);
      }
    });

    this._drawBackButton(ctx);
  },

  drawClasses(ctx, blinkT) {
    this._drawHubBg(ctx, blinkT);
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px Galmuri11, monospace';
    ctx.fillStyle = '#b13ae0';
    ctx.fillText('망자 선택 — 왕에게 죽은 네 사람', Renderer.W / 2, 70);
    this._shardLabel(ctx, Renderer.W - 24, 36);

    const ids = Object.keys(CLASSES);
    const rects = this.cardRects(ids.length, 190); // 직업 카드는 정보량이 많아 기존 높이 유지
    ids.forEach((id, i) => {
      const cls = CLASSES[id];
      const unlocked = Meta.classUnlocked(id);
      const selected = Meta.data.cls === id;
      const r = rects[i];
      const hover = Input.mouse.x >= r.x && Input.mouse.x <= r.x + r.w &&
                    Input.mouse.y >= r.y && Input.mouse.y <= r.y + r.h;
      const lift = hover ? -6 : 0;

      ctx.fillStyle = hover ? '#1d1d2e' : '#141420';
      ctx.fillRect(r.x, r.y + lift, r.w, r.h);
      ctx.strokeStyle = selected ? '#f7b32b' : unlocked ? cls.color : '#3a3a4a';
      ctx.lineWidth = selected || hover ? 3 : 1.5;
      ctx.strokeRect(r.x, r.y + lift, r.w, r.h);

      const cx = r.x + r.w / 2;
      ctx.textAlign = 'center';

      // 스프라이트 미리보기
      const img = Sprites[cls.sprite];
      ctx.save();
      if (!unlocked) ctx.globalAlpha = 0.35;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, cx - img.width, r.y + lift + 14, img.width * 2, img.height * 2);
      ctx.restore();

      ctx.font = 'bold 20px Galmuri11, monospace';
      ctx.fillStyle = unlocked ? '#e8e0cf' : '#666a80';
      ctx.fillText(cls.name, cx, r.y + lift + 90);
      if (cls.title) {
        ctx.font = '11px Galmuri11, monospace';
        ctx.fillStyle = '#8a1c2c';
        ctx.fillText(cls.title, cx, r.y + lift + 104);
      }
      ctx.font = '12px Galmuri11, monospace';
      ctx.fillStyle = '#9aa0b4';
      ctx.fillText(`HP ${cls.hp} · 속도 ${cls.speed}`, cx, r.y + lift + 117);
      ctx.font = '12px Galmuri11, monospace';
      this._wrapText(ctx, cls.desc, cx, r.y + lift + 130, r.w - 26, 14); // 3줄까지 라벨(h-14)과 안 겹치게

      ctx.font = 'bold 14px Galmuri11, monospace';
      if (selected) {
        ctx.fillStyle = '#f7b32b';
        ctx.fillText('▶ 선택됨', cx, r.y + lift + 176); // 직업 카드 h=190 기준 (기본 165 참조 버그 수정)
      } else if (unlocked) {
        ctx.fillStyle = cls.color;
        ctx.fillText('클릭하여 선택', cx, r.y + lift + 176); // 직업 카드 h=190 기준 (기본 165 참조 버그 수정)
      } else {
        // 조건 해금 (2026-07): 파편 구매 → 도전 과제 — 달성하면 자동으로 열린다
        ctx.fillStyle = '#8a4a4a';
        ctx.fillText(`잠김 — ${cls.cond ? cls.cond.label : '?'}`, cx, r.y + lift + 176); // 직업 카드 h=190 기준 (기본 165 참조 버그 수정)
      }
    });

    this._drawBackButton(ctx);
  },

  // ══════════════ 획득 목록 (게임 중 Tab) ══════════════

  drawInventory(ctx, game) {
    const p = game.player;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,8,15,0.85)';
    ctx.fillRect(0, 0, Renderer.W, Renderer.H);

    ctx.textAlign = 'center';
    ctx.font = 'bold 24px Galmuri11, monospace';
    ctx.fillStyle = '#f7b32b';
    ctx.fillText('획득 목록', Renderer.W / 2, 42);
    ctx.font = '12px Galmuri11, monospace';
    ctx.fillStyle = '#666a80';
    ctx.fillText('Tab / ESC — 닫기', Renderer.W / 2, 62);

    // 현재 스탯 요약
    ctx.font = '13px Galmuri11, monospace';
    ctx.fillStyle = '#9aa0b4';
    const stats = [
      `공격력 ${p.currentAtk()}`,
      `크리 ${Math.round(p.critChance * 100)}% ×${p.critMul.toFixed(1)}`,
      `이동 ${Math.round(p.speed)}`,
      `대시 ${p.dashMax}회`,
      `XP ×${p.xpMul.toFixed(2)}`,
    ];
    ctx.fillText(stats.join('   ·   '), Renderer.W / 2, 90);

    // ── 왼쪽: 특성 ──
    const counts = {};
    for (const id of p.traits) counts[id] = (counts[id] || 0) + 1;
    const traitIds = Object.keys(counts);

    ctx.textAlign = 'left';
    ctx.font = 'bold 15px Galmuri11, monospace';
    ctx.fillStyle = '#2ec4b6';
    ctx.fillText(`특성 (${traitIds.length})`, 70, 126);

    let y = 150;
    if (traitIds.length === 0) {
      ctx.font = '12px Galmuri11, monospace';
      ctx.fillStyle = '#4a4a5c';
      ctx.fillText('아직 없음 — 레벨업으로 획득', 70, y);
    }
    const maxRows = 11;
    traitIds.slice(0, maxRows).forEach((id) => {
      const t = TRAITS.find((tr) => tr.id === id);
      if (!t) return;
      ctx.font = 'bold 13px Galmuri11, monospace';
      ctx.fillStyle = t.color;
      const stack = counts[id] > 1 ? ` x${counts[id]}` : '';
      ctx.fillText(`[${t.tag}] ${t.name}${stack}`, 70, y);
      ctx.font = '11px Galmuri11, monospace';
      ctx.fillStyle = '#9aa0b4';
      ctx.fillText(t.desc, 82, y + 15);
      y += 33;
    });
    if (traitIds.length > maxRows) {
      ctx.font = '11px Galmuri11, monospace';
      ctx.fillStyle = '#666a80';
      ctx.fillText(`... 외 ${traitIds.length - maxRows}개`, 70, y);
    }

    // ── 오른쪽: 유물 ──
    ctx.font = 'bold 15px Galmuri11, monospace';
    ctx.fillStyle = '#f7b32b';
    ctx.fillText(`유물 (${p.relics.length})`, 510, 126);

    y = 150;
    if (p.relics.length === 0) {
      ctx.font = '12px Galmuri11, monospace';
      ctx.fillStyle = '#4a4a5c';
      ctx.fillText('아직 없음 — 보물상자·보스에게서 획득', 510, y);
    }
    p.relics.slice(0, maxRows).forEach((id) => {
      const rl = RELICS.find((r) => r.id === id);
      if (!rl) return;
      const rar = RARITY[rl.rarity];
      ctx.font = 'bold 13px Galmuri11, monospace';
      ctx.fillStyle = rar.color;
      ctx.fillText(`[${rar.label}] ${rl.name}`, 510, y);
      ctx.font = '11px Galmuri11, monospace';
      ctx.fillStyle = '#9aa0b4';
      ctx.fillText(rl.desc, 522, y + 15);
      y += 33;
    });
    if (p.relics.length > maxRows) {
      ctx.font = '11px Galmuri11, monospace';
      ctx.fillStyle = '#666a80';
      ctx.fillText(`... 외 ${p.relics.length - maxRows}개`, 510, y);
    }
  },

  // ══════════════ 도감 ══════════════

  // 도감 페이지네이션 — 페이지 클램프 + 우하단 표시, 현재 페이지의 시작 인덱스를 돌려준다
  _codexPager(ctx, game, total, pageSize) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    game.codexPage = Math.min(Math.max(0, game.codexPage || 0), pages - 1);
    if (pages > 1) {
      ctx.textAlign = 'right';
      ctx.font = '12px Galmuri11, monospace';
      ctx.fillStyle = '#8f8577';
      ctx.fillText(`◀ ${game.codexPage + 1} / ${pages} ▶  (←→ 페이지)`, Renderer.W - 24, 122);
    }
    return game.codexPage * pageSize;
  },

  codexTabRects() {
    const w = 124, h = 34, gap = 10;
    const x0 = (Renderer.W - (4 * w + 3 * gap)) / 2;
    return [0, 1, 2, 3].map((i) => ({ x: x0 + i * (w + gap), y: 84, w, h }));
  },

  // 스프라이트를 지정한 상자 안에 픽셀 퍼펙트로 맞춰 그린다
  _fitSprite(ctx, img, cx, cy, box) {
    const s = Math.max(1, Math.floor(box / Math.max(img.width, img.height)));
    const w = img.width * s;
    const h = img.height * s;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
  },

  drawCodex(ctx, blinkT, game) {
    this._drawHubBg(ctx, blinkT);
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px Galmuri11, monospace';
    ctx.fillStyle = '#f7b32b';
    ctx.fillText('도감', Renderer.W / 2, 56);

    const codex = Meta.data.codex;
    const tabs = ['몬스터', '유물', '특성', '증거'];
    const mx = Input.mouse.x, my = Input.mouse.y;

    // 탭
    this.codexTabRects().forEach((r, i) => {
      const active = game.codexTab === i;
      const hover = mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
      ctx.fillStyle = active ? '#1d1d2e' : hover ? '#181826' : '#141420';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = active ? '#f7b32b' : '#4a4a5c';
      ctx.lineWidth = active ? 2 : 1;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.font = 'bold 14px Galmuri11, monospace';
      ctx.fillStyle = active ? '#f7b32b' : '#9aa0b4';
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}. ${tabs[i]}`, r.x + r.w / 2, r.y + 22);
    });

    let hovered = null;

    if (game.codexTab === 0) {
      // 몬스터: 10열 컴팩트 그리드 — 89종+ 페이지네이션 (한 화면 6행 = 60칸)
      const found = CODEX_ENEMIES.filter((e) => codex.kills[e.id.startsWith('boss') ? 'boss' + e.id.slice(4) : e.id] > 0).length;
      this._codexHeader(ctx, found, CODEX_ENEMIES.length);
      const cols = 10, cw = 94, chh = 59;
      const x0 = (Renderer.W - cols * cw) / 2;
      const start = this._codexPager(ctx, game, CODEX_ENEMIES.length, 60);
      CODEX_ENEMIES.slice(start, start + 60).forEach((e, i) => {
        const killKey = e.boss ? 'boss' + e.id.slice(4) : e.id;
        const kills = codex.kills[killKey] || 0;
        const r = { x: x0 + (i % cols) * cw + 3, y: 132 + Math.floor(i / cols) * chh, w: cw - 6, h: chh - 6 };
        const hover = mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
        if (hover) hovered = { name: kills > 0 ? `${e.name} (처치 ${kills})` : '???', desc: kills > 0 ? e.desc : '아직 만나지 못했다...' };
        ctx.fillStyle = hover ? '#1d1d2e' : '#141420';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = kills > 0 ? (e.boss ? '#e43b44' : '#4a4a5c') : '#26262f';
        ctx.lineWidth = 1;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        if (kills > 0) {
          this._fitSprite(ctx, Sprites[e.sprite], r.x + r.w / 2, r.y + 22, 30);
          ctx.font = '10px Galmuri11, monospace';
          ctx.fillStyle = e.boss ? '#e43b44' : '#e8e0cf';
          ctx.textAlign = 'center';
          ctx.fillText(e.name.length > 7 ? e.name.slice(0, 7) : e.name, r.x + r.w / 2, r.y + r.h - 6);
        } else {
          ctx.font = 'bold 18px Galmuri11, monospace';
          ctx.fillStyle = '#33333f';
          ctx.textAlign = 'center';
          ctx.fillText('?', r.x + r.w / 2, r.y + r.h / 2 + 6);
        }
      });
    } else if (game.codexTab === 1) {
      // 유물: 등급색 테두리
      const found = RELICS.filter((rl) => codex.relics[rl.id]).length;
      this._codexHeader(ctx, found, RELICS.length);
      const cols = 7, cw = 128, chh = 96;
      const x0 = (Renderer.W - cols * cw) / 2;
      const start = this._codexPager(ctx, game, RELICS.length, 21);
      RELICS.slice(start, start + 21).forEach((rl, i) => {
        const owned = !!codex.relics[rl.id];
        const rar = RARITY[rl.rarity];
        const r = { x: x0 + (i % cols) * cw + 4, y: 138 + Math.floor(i / cols) * chh, w: cw - 8, h: chh - 8 };
        const hover = mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
        if (hover) hovered = { name: owned ? `[${rar.label}] ${rl.name}` : '???', desc: owned ? rl.desc : '아직 발견하지 못했다...' };
        ctx.fillStyle = hover ? '#1d1d2e' : '#141420';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = owned ? rar.color : '#26262f';
        ctx.lineWidth = owned && rl.rarity === 'legendary' ? 2 : 1;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.textAlign = 'center';
        if (owned) {
          const ic = Icons.relic(rl.id);
          ctx.drawImage(ic, r.x + r.w / 2 - 21, r.y + 12, 42, 42);
          ctx.font = '11px Galmuri11, monospace';
          ctx.fillStyle = '#e8e0cf';
          ctx.fillText(rl.name, r.x + r.w / 2, r.y + r.h - 12);
        } else {
          ctx.font = 'bold 24px Galmuri11, monospace';
          ctx.fillStyle = '#33333f';
          ctx.fillText('?', r.x + r.w / 2, r.y + r.h / 2 + 8);
        }
      });
    } else if (game.codexTab === 2) {
      // 특성: 획득 횟수 표시
      const found = TRAITS.filter((t) => codex.traits[t.id] > 0).length;
      this._codexHeader(ctx, found, TRAITS.length);
      const cols = 8, cw = 112, chh = 82;
      const x0 = (Renderer.W - cols * cw) / 2;
      const start = this._codexPager(ctx, game, TRAITS.length, 32);
      TRAITS.slice(start, start + 32).forEach((t, i) => {
        const picks = codex.traits[t.id] || 0;
        const r = { x: x0 + (i % cols) * cw + 3, y: 138 + Math.floor(i / cols) * chh, w: cw - 6, h: chh - 6 };
        const hover = mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
        if (hover) hovered = { name: picks > 0 ? `[${t.tag}] ${t.name}` : '???', desc: picks > 0 ? t.desc : '아직 선택하지 못했다...' };
        ctx.fillStyle = hover ? '#1d1d2e' : '#141420';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = picks > 0 ? t.color : '#26262f';
        ctx.lineWidth = 1;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.textAlign = 'center';
        if (picks > 0) {
          const ic = Icons.trait(t.id);
          ctx.drawImage(ic, r.x + r.w / 2 - 16, r.y + 7, 32, 32);
          ctx.font = '10px Galmuri11, monospace';
          ctx.fillStyle = '#e8e0cf';
          ctx.fillText(t.name, r.x + r.w / 2, r.y + r.h - 20);
          ctx.fillStyle = '#666a80';
          ctx.fillText(`x${picks}`, r.x + r.w / 2, r.y + r.h - 8);
        } else {
          ctx.font = 'bold 20px Galmuri11, monospace';
          ctx.fillStyle = '#33333f';
          ctx.fillText('?', r.x + r.w / 2, r.y + r.h / 2 + 6);
        }
      });
    } else {
      // 증거 수집록 (기획 §4): 모은 진실의 목록 — 막별 구분, 미획득은 ???
      this._codexHeader(ctx, Meta.clueCount(), CLUES.length);
      const x0 = Renderer.W / 2 - 380;
      let y = 142;
      let lastAct = 0;
      for (const c of CLUES) {
        // 미도달 막(콘텐츠 없음)은 한 줄 요약 — 화면을 넘치지 않게
        if (c.text === null) {
          if (c.act !== lastAct) {
            lastAct = c.act;
            ctx.textAlign = 'left';
            ctx.font = 'bold 13px Galmuri11, monospace';
            ctx.fillStyle = '#3a3a46';
            const actNames = { 3: '3막 — 영지와 재판소', 4: '4막 — 역병의 마을', 5: '5막 — 왕도와 왕좌' };
            ctx.fillText(`${actNames[c.act] || '?'} — 아직 닿을 수 없는 곳 (단서 ${CLUES.filter((x) => x.act === c.act).length}개)`, x0, y);
            y += 20;
          }
          continue;
        }
        if (c.act !== lastAct) {
          lastAct = c.act;
          ctx.textAlign = 'left';
          ctx.font = 'bold 13px Galmuri11, monospace';
          const actDone = CLUES.filter((x) => x.act === c.act).every((x) => Meta.clueOwned(x.id));
          ctx.fillStyle = actDone ? '#e43b44' : '#666a80';
          const actNames = { 1: '1막 — 변경', 2: '2막 — 다리와 관문', 3: '3막 — 영지와 재판소', 4: '4막 — 역병의 마을', 5: '5막 — 왕도와 왕좌' };
          ctx.fillText(actNames[c.act] + (actDone ? '  ✦ 사무친 원한 (+1 HP)' : ''), x0, y);
          y += 20;
        }
        const owned = Meta.clueOwned(c.id);
        const reachable = c.text !== null;
        ctx.font = '12px Galmuri11, monospace';
        ctx.fillStyle = owned ? '#f7b32b' : reachable ? '#9aa0b4' : '#3a3a46';
        ctx.fillText(owned ? `■ ${c.name}` : reachable ? `□ ${c.name} — ${c.how === 'boss' ? '막보스의 자백' : '탐사로 발견'}` : '□ ??? — 아직 닿을 수 없는 곳', x0 + 14, y);
        y += 17;
        if (owned && c.text) {
          ctx.font = '11px Galmuri11, monospace';
          ctx.fillStyle = '#7a7468';
          const words = c.text;
          // 2줄 래핑 (간단)
          if (words.length > 62) {
            ctx.fillText(words.slice(0, 62), x0 + 28, y); y += 15;
            ctx.fillText(words.slice(62), x0 + 28, y); y += 17;
          } else {
            ctx.fillText(words, x0 + 28, y); y += 17;
          }
        }
      }
      ctx.textAlign = 'center';
    }

    // 하단 상세 정보
    if (hovered) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px Galmuri11, monospace';
      ctx.fillStyle = '#e8e0cf';
      ctx.fillText(hovered.name, Renderer.W / 2, Renderer.H - 92);
      ctx.font = '12px Galmuri11, monospace';
      ctx.fillStyle = '#9aa0b4';
      ctx.fillText(hovered.desc, Renderer.W / 2, Renderer.H - 74);
    }

    this._drawBackButton(ctx);
  },

  _codexHeader(ctx, found, total) {
    ctx.textAlign = 'right';
    ctx.font = '13px Galmuri11, monospace';
    ctx.fillStyle = found >= total ? '#f7b32b' : '#9aa0b4';
    ctx.fillText(`발견 ${found}/${total}${found >= total ? ' — 완성!' : ''}`, Renderer.W - 40, 100);
  },

  drawGameOver(ctx, game, blinkT) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,8,15,0.75)';
    ctx.fillRect(0, 0, Renderer.W, Renderer.H);
    ctx.textAlign = 'center';

    ctx.font = 'bold 44px Galmuri11, monospace';
    ctx.fillStyle = game.gaveUp ? '#9aa0b4' : '#e43b44';
    ctx.fillText(game.gaveUp ? '런 포기' : '전사했다...', Renderer.W / 2, 180);

    // 사망 리포트 — 죽음을 다음 런의 지식으로
    if (!game.gaveUp && game.deathInfo) {
      ctx.font = '15px Galmuri11, monospace';
      ctx.fillStyle = '#c46a6a';
      ctx.fillText(`☠ 사인: ${game.deathInfo.src}`, Renderer.W / 2, 210);
      // 마이크로 서사 (S3): 왕국의 목소리 — 죽음마다 세계가 한 줄 말을 건다
      const EPITAPHS = [
        '왕국은 또 하나의 시체를 묻었다. 묻힌 것이 전부 잠드는 건 아니다.',
        '왕은 서두르지 않는다. 너는 다시 기어오를 테니까.',
        '뱃사공이 노를 젓는 소리가 들린다… 아직은 아니다.',
        '네가 흘린 한(恨)은 흙 속에서도 식지 않는다.',
        '교수대의 밧줄이 오늘 하나 더 걸렸다.',
      ];
      ctx.font = 'italic 12px Galmuri11, monospace';
      ctx.fillStyle = '#8a8aa0';
      ctx.fillText(EPITAPHS[(Dungeon.floor + game.kills) % EPITAPHS.length], Renderer.W / 2, 232);
    }

    ctx.font = '18px Galmuri11, monospace';
    ctx.fillStyle = '#e8e0cf';
    ctx.fillText(
      `${Dungeon.floor}층 ${Dungeon.floorName()} · 방 ${Dungeon.roomIndex} 도달`,
      Renderer.W / 2, 240);
    ctx.font = '15px Galmuri11, monospace';
    ctx.fillStyle = '#9aa0b4';
    ctx.fillText(`Lv.${game.level} · 처치 ${game.kills} · 유물 ${game.player.relics.length}개 · ${game.time.toFixed(1)}초`,
      Renderer.W / 2, 272);

    // 진전 비교 — 지난 런 대비 어디까지 왔나
    ctx.font = '13px Galmuri11, monospace';
    if (game.prevRun) {
      const up = Dungeon.floor > game.prevRun.floor;
      const same = Dungeon.floor === game.prevRun.floor;
      ctx.fillStyle = up ? '#38b764' : same ? '#9aa0b4' : '#666a80';
      ctx.fillText(
        `지난 런 ${game.prevRun.floor}층 Lv.${game.prevRun.level} → 이번 ${Dungeon.floor}층 Lv.${game.level} ${up ? '▲' : same ? '—' : '▼'}`,
        Renderer.W / 2, 298);
    }
    if (game.dailyRun && Meta.data.daily) {
      ctx.fillStyle = '#f7b32b';
      ctx.fillText(`📜 오늘의 수배령 최고 기록: ${Meta.data.daily.floor}층 (${Meta.data.daily.runs}회 도전)`, Renderer.W / 2, game.prevRun ? 316 : 298);
    }

    this._drawShardReward(ctx, game, 330);
    this._drawRunTag(ctx, game, 448);

    if (Math.floor(blinkT * 1.6) % 2 === 0) {
      ctx.font = 'bold 17px Galmuri11, monospace';
      ctx.fillStyle = '#5ce0e6';
      ctx.fillText('R — 즉시 재도전   ·   클릭/Space — 거점으로', Renderer.W / 2, 415);
    }
  },

  // 시드·열기 표기 (시드 공유용)
  _drawRunTag(ctx, game, y) {
    ctx.textAlign = 'center';
    ctx.font = '12px Galmuri11, monospace';
    ctx.fillStyle = '#4a4a5c';
    const heatStr = game.heat > 0 ? ` · 현상금 ${game.heat}` : '';
    ctx.fillText(`시드 ${game.runSeed.toString(36).toUpperCase()}${heatStr} — ?seed=${game.runSeed.toString(36).toUpperCase()} 로 같은 던전 도전`, Renderer.W / 2, y);
  },

  // 파편 정산 카운트업 애니메이션
  _drawShardReward(ctx, game, y) {
    const shown = Math.min(game.shardsEarned, Math.floor(game.shardAnimT * 40));
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px Galmuri11, monospace';
    ctx.fillStyle = '#2ec4b6';
    ctx.fillText(`◆ 한(恨) 조각 +${shown}`, Renderer.W / 2, y);
    if (shown >= game.shardsEarned) {
      ctx.font = '13px Galmuri11, monospace';
      ctx.fillStyle = '#666a80';
      ctx.fillText(`보유: ◆ ${Meta.data.shards}`, Renderer.W / 2, y + 26);
    }
  },

  drawVictory(ctx, game, blinkT) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // 연출 타이머: 진입 순간부터 경과 시간 (초)
    if (game._vicStart === undefined) game._vicStart = blinkT;
    const t = Math.max(0, blinkT - game._vicStart);
    const ease = (x) => 1 - Math.pow(1 - Math.min(1, x), 3);
    const cx = Renderer.W / 2;

    ctx.fillStyle = 'rgba(8,8,15,0.82)';
    ctx.fillRect(0, 0, Renderer.W, Renderer.H);

    // ── 다섯 번째 손 — 정복 에필로그: 정산보다 먼저, 네 망자가 화면 밖을 본다 ──
    if (game._epi && !game._epi.done) {
      ctx.fillStyle = 'rgba(4,3,8,0.96)';
      ctx.fillRect(0, 0, Renderer.W, Renderer.H);
      const PAGES = [
        [
          ['#e8e0cf', '왕좌는 비었다. 넷은 한동안 말이 없었다.'],
          ['', ''],
          ['#c8b89a', '가레스  "끝났군. …그런데 줄곧 이상했다."'],
          ['#c8b89a', '        "갈림길마다 — 누가 등을 밀어주는 것 같았어."'],
          ['', ''],
          ['#9fc6a8', '레나    "나도 느꼈어. 시위를 놓는 순간마다,"'],
          ['#9fc6a8', '        "손가락이 하나 더 있는 것 같았지."'],
        ],
        [
          ['#a9c1d8', '오르빈  "별을 읽던 시절부터 알고 있었다."'],
          ['#a9c1d8', '        "우리를 내려다보던 창백한 시선 — 적의 없는."'],
          ['#a9c1d8', '        "…다섯 번째 손이다."'],
          ['', ''],
          ['#d8a9c1', '이졸데  "그래서? 그 손이 우리를 이끌었다 치자."'],
          ['#d8a9c1', '        "흙을 털고 일어선 건 우리야. 걸은 것도,"'],
          ['#d8a9c1', '        "벤 것도, 서로를 붙든 것도."'],
        ],
        [
          ['#c8b89a', '가레스  "……거기 있는 거, 안다."'],
          ['#c8b89a', '        "처음부터 함께였던 — 다섯 번째 손."'],
          ['', ''],
          ['#d8a9c1', '이졸데  "네 세상에도 보이지 않는 손이 있겠지."'],
          ['#9fc6a8', '레나    "그래도 기억해. 손이 몇 개든 —"'],
          ['', ''],
          ['#ffd866', '넷이 함께   "결국, 인생은 우리가 선택한다."'],
          ['', ''],
          ['#8f8577', '(고맙다, 관찰자여. 이 복수는 너와 함께였다.)'],
        ],
      ];
      const page = PAGES[Math.min(game._epi.page, PAGES.length - 1)];
      ctx.textAlign = 'center';
      ctx.font = 'bold 15px Galmuri11, monospace';
      ctx.fillStyle = '#6a6478';
      ctx.fillText(`— 다섯 번째 손 · ${Math.min(game._epi.page + 1, 3)}/3 —`, cx, 110);
      ctx.textAlign = 'left';
      const lx = cx - 300;
      let ly = 180;
      ctx.font = '16px Galmuri11, monospace';
      for (const [col, line] of page) {
        if (line) { ctx.fillStyle = col; ctx.fillText(line, lx, ly); }
        ly += 34;
      }
      ctx.textAlign = 'center';
      ctx.font = '13px Galmuri11, monospace';
      ctx.fillStyle = '#8f8577';
      ctx.globalAlpha = 0.6 + Math.sin(blinkT * 3) * 0.3;
      ctx.fillText('아무 키 — 계속', cx, Renderer.H - 46);
      ctx.globalAlpha = 1;
      return;
    }

    // 회전 광선 (타이틀 뒤) — 승리의 무대 조명
    ctx.save();
    ctx.translate(cx, 165);
    ctx.globalAlpha = 0.10 * ease(t * 1.2);
    for (let i = 0; i < 10; i++) {
      const a = t * 0.25 + (i / 10) * Math.PI * 2;
      ctx.fillStyle = i % 2 === 0 ? '#f7b32b' : '#ffd866';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 420, a, a + 0.16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 황금 불티 (자립 애니메이션 — 파티클 시스템 없이 결정적 루프)
    ctx.save();
    for (let i = 0; i < 36; i++) {
      const seed = i * 137.51;
      const px = ((seed * 7.13) % Renderer.W);
      const cycle = 5 + (i % 5);
      const k = ((t * (24 + (i % 4) * 9) + seed) % (Renderer.H + 60));
      const py = Renderer.H + 30 - k;
      ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(seed + t * 2));
      ctx.fillStyle = i % 3 === 0 ? '#ffd866' : i % 3 === 1 ? '#f7b32b' : '#fff7d0';
      const s = 2 + (i % 3);
      ctx.fillRect(px + Math.sin(t * 1.4 + seed) * 14, py, s, s);
    }
    ctx.restore();

    ctx.textAlign = 'center';

    // 타이틀: 위에서 떨어지며 착지 (0.5s) + 착지 후 은은한 금빛 맥동
    const drop = ease(t / 0.5);
    const ty = 170 - (1 - drop) * 120;
    ctx.save();
    ctx.globalAlpha = drop;
    ctx.font = 'bold 48px Galmuri11, monospace';
    ctx.fillStyle = '#f7b32b';
    if (t > 0.5) {
      ctx.shadowColor = '#ffd866';
      ctx.shadowBlur = 14 + Math.sin(t * 3) * 8;
    }
    const act = game.act || 1;
    const vTitle = { 1: '1막 완수 — 변경을 벗어났다', 2: '2막 돌파 — 관문이 열렸다!', 3: '3막 심판 — 재판소가 무너졌다!', 4: '4막 폭로 — 교회가 침묵을 잃었다!', 5: '복수 완수 — 왕좌가 비었다' };
    const vLine = {
      1: "10층 — 왕실 처형인 '무거운 손'이 쓰러졌다",
      2: "20층 — 관문 사령관 '철벽 로트가르'가 쓰러졌다",
      3: "30층 — 대재판관 '발디아 공작'이 쓰러졌다",
      4: "40층 — 대주교 '이노첸시오'가 쓰러졌다",
      5: '50층 — 왕 바르텐 3세. 성배가 깨졌다',
    };
    const vSub = {
      1: '"명단은… 재판소가 아니라… 성에서 내려왔다…" — 첫 번째 자백을 얻었다.',
      2: '"마차 호위는… 명예였다… 안을 보기 전까지는…" — 왕도가 가까워진다.',
      3: '"성배가 마르면… 왕국이 마른다고 했다…" — 이제 교회다.',
      4: '"신의 이름으로… 우리가… 시작했다…" — 남은 것은 왕좌뿐.',
      5: '성배가 깨지자 저주도 풀렸다. 깨어났던 자들이 하나둘, 편히 잠든다.',
    };
    ctx.fillText(vTitle[act] || `${act}막 완수`, cx, ty);
    ctx.restore();
    if (t > 0.55) {
      ctx.font = 'bold 16px Galmuri11, monospace';
      ctx.fillStyle = '#e43b44';
      ctx.fillText(vLine[act] || `${act * 10}층 — 길이 열렸다`, cx, 208);
      ctx.font = 'italic 13px Galmuri11, monospace';
      ctx.fillStyle = '#9a9ab8';
      ctx.fillText(vSub[act] || '', cx, 230);
    }

    // 기록 요약: 순차 등장 (0.8s부터 0.15s 간격)
    const rows = [];
    if (act >= 5) {
      // 엔딩 (기획 §2): 복수 + 진실 공표 + 안식 — 롱테이크 세 줄
      const n = Meta.clueCount();
      rows.push({ f: 'italic 13px Galmuri11, monospace', c: '#c8c0a8', y: 252, s: '광장 벽에 증거를 전부 붙였다. 백성들이 하나둘 멈춰 서서 읽는다.' });
      rows.push({ f: 'italic 13px Galmuri11, monospace', c: '#c8c0a8', y: 270, s: `수집한 진실 ${n}/${CLUES.length}건${n >= CLUES.length ? ' — 빠짐없이. 왕국은 이제 전부 안다.' : ' — 나머지는 소문이 채울 것이다.'}` });
      rows.push({ f: 'italic 13px Galmuri11, monospace', c: '#9a9488', y: 288, s: '그리고 처음으로 — 묘지가 평온하다. 이제 누워도 된다.' });
      rows.push({ f: '15px Galmuri11, monospace', c: '#666a80', y: 314, s: `Lv.${game.level} · 처치 ${game.kills} · ${(game.time / 60).toFixed(1)}분의 복수` });
    } else {
    rows.push({ f: '17px Galmuri11, monospace', c: '#e8e0cf', y: 262, s: `Lv.${game.level} · 처치 ${game.kills} · 유물 ${game.player.relics.length}개 · 특성 ${game.player.traits.length}장` });
    const timeStr = `클리어 시간 ${(game.time / 60).toFixed(1)}분` + (game.heat > 0 ? ` · 현상금 ${game.heat}` : '');
    rows.push({ f: '15px Galmuri11, monospace', c: '#9aa0b4', y: 290, s: timeStr });
    }
    if (game._newRecord) rows.push({ f: 'bold 15px Galmuri11, monospace', c: '#5ce0e6', y: 314, s: '★ 최속 클리어 신기록!' });
    if (game.dailyRun) rows.push({ f: 'bold 14px Galmuri11, monospace', c: '#f7b32b', y: game._newRecord ? 334 : 314, s: '📜 오늘의 수배령 완수!' });
    rows.forEach((r, i) => {
      const rt = (t - 0.8 - i * 0.15) / 0.25;
      if (rt <= 0) return;
      ctx.save();
      ctx.globalAlpha = ease(rt);
      ctx.font = r.f;
      ctx.fillStyle = r.c;
      ctx.fillText(r.s, cx, r.y + (1 - ease(rt)) * 10);
      ctx.restore();
    });

    if (t > 1.3) this._drawShardReward(ctx, game, 352);
    this._drawRunTag(ctx, game, 497);

    if (t > 1.6 && Math.floor(blinkT * 1.6) % 2 === 0) {
      ctx.font = 'bold 17px Galmuri11, monospace';
      ctx.fillStyle = '#5ce0e6';
      ctx.fillText('R — 새로운 런   ·   클릭/Space — 거점으로', cx, 432);
    }
    if (t > 1.6) {
      ctx.font = 'bold 16px Galmuri11, monospace';
      const cNext = {
        1: 'C — 2막 다리와 관문으로 (빌드 유지, 11~20층: 왕도로 가는 길)',
        2: 'C — 3막 영지와 재판소로 (빌드 유지, 21~30층: 판결한 자들에게)',
        3: 'C — 4막 역병의 마을로 (빌드 유지, 31~40층: 왕이 만든 재앙 속으로)',
        4: 'C — 5막 왕도로 (빌드 유지, 41~50층: 마지막 열 층)',
      };
      ctx.fillStyle = cNext[act] ? '#c9d94a' : '#b13ae0';
      ctx.fillText(cNext[act] || 'C — 왕도 가도로 계속 (무한 모드: 빌드 유지)', cx, 462);
    }
  },

  // ── 설정 패널 (O) — 거점·일시정지 공용 오버레이 ──
  drawSettings(ctx, game) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,8,15,0.86)';
    ctx.fillRect(0, 0, Renderer.W, Renderer.H);
    const o = Meta.data.opts;
    const cx = Renderer.W / 2;
    const px = cx - 250, pw = 500, py = 78, ph = 386; // 6줄 (전체화면 추가)
    ctx.fillStyle = '#14101e';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#6a5a40';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px Galmuri11, monospace';
    ctx.fillStyle = '#e8e0cf';
    ctx.fillText('설 정', cx, py + 44);

    const volBar = (v) => '■'.repeat(Math.round((v ?? 0.8) * 10)).padEnd(10, '·') + `  ${Math.round((v ?? 0.8) * 100)}%`;
    const triLbl = (v) => (v ?? 1) <= 0 ? '끔' : (v ?? 1) < 1 ? '약하게' : '보통';
    const fsOn = window.desktop ? !!game._fsOn : !!document.fullscreenElement;
    const rows = [
      ['음악 음량', volBar(o.bgm)],
      ['효과음 음량', volBar(o.sfx)],
      ['화면 흔들림', triLbl(o.shake)],
      ['피해 숫자 표시', o.dmgNum ? '켬' : '끔'],
      ['화면 섬광', triLbl(o.flash) + '  (광과민성 배려)'],
      ['전체화면', fsOn ? '켬' : '끔'],
    ];
    const ry0 = py + 92, rh = 40;
    rows.forEach(([name, val], i) => {
      const sel = (game._setRow || 0) === i;
      const y = ry0 + i * rh;
      if (sel) {
        ctx.fillStyle = 'rgba(177,58,224,0.14)';
        ctx.fillRect(px + 14, y - 24, pw - 28, 34);
      }
      ctx.textAlign = 'left';
      ctx.font = sel ? 'bold 16px Galmuri11, monospace' : '15px Galmuri11, monospace';
      ctx.fillStyle = sel ? '#e8e0cf' : '#9a917e';
      ctx.fillText((sel ? '▶ ' : '  ') + name, px + 28, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = sel ? '#ffd866' : '#8f8577';
      ctx.fillText(val, px + pw - 28, y);
    });

    ctx.textAlign = 'center';
    ctx.font = '13px Galmuri11, monospace';
    ctx.fillStyle = '#8f8577';
    ctx.fillText('↑↓ 항목 이동 · ←→ 조절 · O/Esc 닫기 (자동 저장)', cx, py + ph - 22);
  },

  // ── 전체 매뉴얼 (H 또는 /) — 게임 중·거점 어디서나. 1p 조작·전투 / 2p 던전·성장 ──
  drawManual(ctx, game, page) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,8,15,0.9)';
    ctx.fillRect(0, 0, Renderer.W, Renderer.H);
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px Galmuri11, monospace';
    ctx.fillStyle = '#e8e0cf';
    ctx.fillText(page === 1 ? '매뉴얼 1/2 — 조작과 전투' : '매뉴얼 2/2 — 던전과 성장', Renderer.W / 2, 60);

    const drawCol = (x, title, color, rows) => {
      ctx.textAlign = 'left';
      ctx.font = 'bold 15px Galmuri11, monospace';
      ctx.fillStyle = color;
      ctx.fillText(title, x, 104);
      let y = 132;
      for (const r of rows) {
        if (r.h) { // 항목 제목
          ctx.font = 'bold 13px Galmuri11, monospace';
          ctx.fillStyle = r.c || '#ffd866';
          ctx.fillText(r.h, x, y);
          y += 18;
        }
        if (r.t) {
          ctx.font = '12px Galmuri11, monospace';
          ctx.fillStyle = r.dim ? '#8a90a4' : '#c8d4e4';
          ctx.fillText(r.t, x + (r.h === undefined ? 0 : 12), y);
          y += 18;
        }
        y += r.gap || 6;
      }
    };

    if (page === 1) {
      drawCol(Renderer.W / 2 - 396, '기본 조작', '#5ce0e6', [
        { h: 'WASD / 방향키', t: '이동' },
        { h: '클릭 / J', t: '공격 — 3연격, 3타째(마무리)가 강하고 넓다' },
        { h: 'Space / Shift', t: '대시 — 짧은 무적, 벽 너머는 못 간다' },
        { h: 'K / 우클릭', t: '직업 스킬 (처치할 때마다 쿨다운 감소)' },
        { h: 'Tab', t: '획득 목록 · 현재 스탯' },
        { h: '1 2 3 / E', t: '카드 선택 / 다시 뽑기 (환생 각인)' },
        { h: 'ESC · M · H(/)', t: '일시정지 · 음소거 · 이 매뉴얼' },
      ]);
      drawCol(Renderer.W / 2 + 16, '전투의 정수', '#f7b32b', [
        { h: '완벽 회피', t: '적 공격이 닿기 직전 대시로 회피하면' },
        { t: '시간이 느려지고 다음 일격이 확정 크리티컬', dim: true },
        { h: '대시 파생기', t: '대시 중 공격 — 직업별 특수기가 나간다' },
        { t: '검사 돌진 찌르기 / 궁수 후퇴 사격 / 마도사 점멸 폭발', dim: true },
        { h: '벽 충돌', t: '마무리 일격·참수 선회로 적을 벽에 처박으면 추가 피해' },
        { h: '스킬 진화', t: '직업 특성 3장 + Lv.12 — 스킬의 형태가 바뀐다' },
        { h: '보스 기믹', t: '체력바 아래 기믹을 읽어라 — 정답 특성 트리가 있다' },
      ]);
    } else {
      drawCol(Renderer.W / 2 - 396, '던전', '#5ce0e6', [
        { h: '문 선택', t: '전투 / 정예(카드 보상) / 보물 / 모닥불 / 기연(?)' },
        { t: '⚠ 수식어가 붙은 문은 위험하지만 보상이 크다', dim: true },
        { h: '모닥불 방', t: '휴식(HP +2) vs 담금질(이번 층 공격력 +1) — 하나만' },
        { h: '미지의 기연', t: '받아들이기 전엔 정체를 모른다 — 대체로 이득, 가끔 함정' },
        { h: '우두머리', t: '층마다 나타나는 거대 변종 — 처치 시 하트 + 한 조각 확정' },
        { h: '지름길', t: '3·6층 보스 후 — 한 층을 건너뛰지만 도착 층이 험하다' },
        { t: '(대신 그 층의 정예가 한 조각을 떨군다)', dim: true },
        { h: '균열 벽 · 항아리', t: '금 간 벽과 항아리는 부술 수 있다 — 보상이 숨어 있다' },
      ]);
      drawCol(Renderer.W / 2 + 16, '성장', '#f7b32b', [
        { h: '특성 카드', t: '같은 태그를 모으면 시너지 — 트리를 파라' },
        { t: '중첩 상한은 카드에 표시 (보유 n/상한)', dim: true },
        { h: '전설 특성', t: '황금 카드 — 게임 규칙을 바꾼다 (극저확률)' },
        { h: '유물', t: '커먼~레전더리 — 보물상자와 보스가 준다' },
        { h: '도감', t: '침공 기록이 한 조각 보상으로 돌아온다 (거점 4번)' },
        { h: '비석의 맹세', t: '한(恨) 조각으로 영구 강화 (거점 2번)' },
        { h: '현상금 · 오늘의 수배령', t: '1막 완수 후 해금(←→) — 왕이 네 목에 값을 건다 · 거점 D 오늘의 수배령' },
        { h: '2막 · 왕도 가도', t: '1막 완수 후 C — 2막 다리와 관문(11~20층), 2막 완수 후 C — 왕도 가도' },
        { h: '보조 스킬', t: '5·15·25층 스킬 사당에서 3택1 획득 — E키로 사용' },
        { h: '처형 선고', t: '10층 보스의 도끼를 빼앗아 획득 — 처치로 충전, R키로 집행 (20층에서 강화)' },
      ]);
    }

    ctx.textAlign = 'center';
    ctx.font = 'bold 14px Galmuri11, monospace';
    ctx.fillStyle = '#5ce0e6';
    ctx.fillText(page === 1 ? 'H / — 다음 페이지   ·   ESC — 닫기' : 'H / — 닫기   ·   ESC — 닫기', Renderer.W / 2, Renderer.H - 24);
  },
};
