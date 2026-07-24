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
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${p.skillName()} K`, 104, barY + 19);

    // ── XP 바 + 레벨 ──
    const xpRatio = Math.min(1, game.xp / game.xpNext);
    ctx.fillStyle = '#1c1c28';
    ctx.fillRect(14, barY + 24, 86, 6);
    ctx.fillStyle = '#2ec4b6';
    ctx.fillRect(14, barY + 24, 86 * xpRatio, 6);
    ctx.fillStyle = '#9aa0b4';
    ctx.font = '11px monospace';
    ctx.fillText(`Lv.${game.level}`, 104, barY + 32);

    // ── 획득 특성 아이콘 ──
    const counts = {};
    for (const id of p.traits) counts[id] = (counts[id] || 0) + 1;
    let ti = 0;
    for (const id of Object.keys(counts)) {
      const trait = TRAITS.find((t) => t.id === id);
      if (!trait) continue;
      const y = barY + 46 + ti * 22;
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
      // 기믹 표시 — 해법은 플레이어가 연구한다
      if (boss.def && boss.def.mechanic) {
        ctx.font = '11px monospace';
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

    // ── 피격 적색 섬광 / 크리티컬 백색 섬광 (한 프레임의 손맛) ──
    if (game.hurtFlash > 0) {
      ctx.fillStyle = `rgba(228,59,68,${Math.min(0.14, game.hurtFlash * 0.6)})`;
      ctx.fillRect(0, 0, Renderer.W, Renderer.H);
    }
    if (game.critFlash > 0) {
      ctx.fillStyle = `rgba(255,247,192,${Math.min(0.08, game.critFlash * 1.0)})`; // 완화 — 번쩍임이 눈 아프지 않게
      ctx.fillRect(0, 0, Renderer.W, Renderer.H);
    }

    if (AudioSys.muted) {
      ctx.textAlign = 'left';
      ctx.font = '12px monospace';
      ctx.fillStyle = '#666a80';
      ctx.fillText('매뉴얼 (H) · 음소거 (M)', 14, Renderer.H - 44);
    }

    // ── 봇 모드 표시 + 층별 사망 리포트 ──
    if (Bot.enabled) {
      ctx.textAlign = 'right';
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#b13ae0';
      let botLabel = '🤖 봇 모드';
      if (Bot.ff > 1) botLabel += ` ×${Bot.ff}`;
      if (Bot.loop) botLabel += ` (런 ${Bot.runs}·승 ${Bot.wins})`;
      ctx.fillText(botLabel, Renderer.W - 16, 30);
      const rep = Bot.deathReport();
      if (rep.total > 0) {
        ctx.font = '11px monospace';
        ctx.fillStyle = '#e43b44';
        ctx.fillText(`사망 ${rep.total}회 — ${rep.byFloor}`, Renderer.W - 16, Renderer.H - 60);
      }
    }

    // ── 테스트 모드 표시 + 단축키 도움말 ──
    if (game.testMode) {
      ctx.textAlign = 'right';
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#e43b44';
      ctx.fillText('⚙ 테스트 모드', Renderer.W - 16, 46);
      if (p.god) {
        ctx.fillStyle = '#5ce0e6';
        ctx.fillText('무적', Renderer.W - 16, 62);
      }
      const lines = [
        'G 무적  H 회복  K 전멸',
        'L 레벨업  U 유물  O 파편',
        'B 보스방  N 다음층  V 봇  F 부활',
      ];
      if (game.reviveMode) {
        ctx.fillStyle = '#5ce0e6';
        ctx.fillText('♻ 무한 부활', Renderer.W - 16, p.god ? 78 : 62);
      }
      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(154,160,180,0.75)';
      lines.forEach((l, i) => ctx.fillText(l, Renderer.W - 16, Renderer.H - 46 + i * 14));
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
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = color;
      ctx.fillText(tagFn(c), cx, r.y + lift + 32);
      ctx.font = 'bold 21px monospace';
      ctx.fillStyle = '#e8e0cf';
      ctx.fillText(c.name, cx, r.y + lift + 66);
      ctx.font = '13px monospace';
      ctx.fillStyle = '#9aa0b4';
      this._wrapText(ctx, c.desc, cx, r.y + lift + 100, r.w - 28, 19);
      // 중첩 특성: 보유 수 / 상한 표시
      if (c.max && game.player) {
        const owned = game.player.traits.filter((id) => id === c.id).length;
        if (owned > 0) {
          ctx.font = '11px monospace';
          ctx.fillStyle = '#666a80';
          ctx.fillText(`보유 ${owned}/${c.max}`, cx, r.y + lift + r.h - 36);
        }
      }
      // 직업 특성: 스킬 진화 진행도 힌트 (직업 특성 3장 + Lv.12 → 스킬의 형태가 바뀐다)
      if (c.cls && game.player && !game.player.skillEvolved) {
        const clsOwned = game.player.traits.filter((id) => {
          const t = TRAITS.find((x) => x.id === id);
          return t && t.cls;
        }).length;
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#f7b32b';
        ctx.fillText(
          game.player.evoReady
            ? `⚡ 개화 대기 — Lv.12 (현재 ${game.level})`
            : `⚡ 스킬 진화 ${clsOwned}/3 · Lv.12`,
          cx, r.y + lift + r.h - 50);
      }
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = hover ? color : '#4a4a5c';
      ctx.fillText(String(i + 1), cx, r.y + lift + r.h - 16);
    });

    // 리롤 각인: 남은 횟수 표시
    if (game.player && game.player.rerolls > 0 && game.state === 'levelup') {
      ctx.font = 'bold 14px monospace';
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

  _shardLabel(ctx, x, y, align = 'right') {
    ctx.textAlign = align;
    ctx.font = 'bold 17px monospace';
    ctx.fillStyle = '#2ec4b6';
    ctx.fillText(`◆ ${Meta.data.shards}`, x, y);
  },

  hubButtonRects() {
    const w = 320, h = 46, gap = 10;
    const x = (Renderer.W - w) / 2;
    const y0 = 278;
    return [0, 1, 2, 3].map((i) => ({ x, y: y0 + i * (h + gap), w, h }));
  },

  heatButtonRects() {
    const cy = 243;
    return [
      { x: Renderer.W / 2 - 116, y: cy - 15, w: 26, h: 26 },
      { x: Renderer.W / 2 + 90, y: cy - 15, w: 26, h: 26 },
    ];
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
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#9aa0b4';
    ctx.fillText('돌아가기 (ESC)', r.x + r.w / 2, r.y + 25);
  },

  drawHub(ctx, blinkT) {
    this._drawHubBg(ctx, blinkT);
    ctx.textAlign = 'center';

    ctx.font = 'bold 46px monospace';
    ctx.fillStyle = '#f7b32b';
    ctx.fillText('던전 크롤러', Renderer.W / 2, 120);
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#e8e0cf';
    ctx.fillText('― 심연의 탑 ―', Renderer.W / 2, 156);

    this._shardLabel(ctx, Renderer.W - 24, 36);
    if (Meta.data.runs > 0) {
      ctx.textAlign = 'left';
      ctx.font = '12px monospace';
      ctx.fillStyle = '#666a80';
      ctx.fillText(`도전 ${Meta.data.runs}회 · 최고 ${Meta.data.bestFloor}층 · 누적 처치 ${Meta.data.totalKills}`, 24, 36);
    }

    const cls = CLASSES[Meta.data.cls];
    ctx.textAlign = 'center';
    ctx.font = '14px monospace';
    ctx.fillStyle = '#9aa0b4';
    ctx.fillText(`선택된 직업: `, Renderer.W / 2 - 30, 215);
    ctx.fillStyle = cls.color;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(cls.name, Renderer.W / 2 + 42, 215);

    // 열기(고난이도) 셀렉터 — 첫 정복 후 표시
    if (Meta.heatUnlocked()) {
      const heat = Meta.heat();
      const [minus, plus] = this.heatButtonRects();
      for (const [r, sym] of [[minus, '◀'], [plus, '▶']]) {
        const hover = Input.mouse.x >= r.x && Input.mouse.x <= r.x + r.w &&
                      Input.mouse.y >= r.y && Input.mouse.y <= r.y + r.h;
        ctx.fillStyle = hover ? '#1d1d2e' : '#141420';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = hover ? '#e43b44' : '#4a4a5c';
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = '#e8e0cf';
        ctx.textAlign = 'center';
        ctx.fillText(sym, r.x + r.w / 2, r.y + 18);
      }
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = heat > 0 ? '#e43b44' : '#666a80';
      let flames = '';
      for (let i = 0; i < 5; i++) flames += i < heat ? '♦' : '·';
      ctx.fillText(`열기 ${heat}  ${flames}`, Renderer.W / 2, 248);
      ctx.font = '11px monospace';
      ctx.fillStyle = '#666a80';
      const heatDesc = ['보통 난이도', '적 HP +25%', '+ 적 수 증가', '+ 적 속도 +15%', '+ 회복 감소', '+ 보스 강화, 시작 HP -1'][heat];
      ctx.fillText(`${heatDesc} · 파편 +${heat * 20}%`, Renderer.W / 2, 266);
    }

    const disc = Object.keys(Meta.data.codex.kills).length + Object.keys(Meta.data.codex.relics).length +
                 Object.keys(Meta.data.codex.traits).length;
    const total = CODEX_ENEMIES.length + RELICS.length + TRAITS.length;
    const labels = [
      { text: '출발', sub: '심연의 탑에 도전한다', color: '#38b764' },
      { text: '기억의 제단', sub: '영혼 파편으로 영구 강화', color: '#2ec4b6' },
      { text: '직업 선택', sub: '검사 · 궁수 · 마도사', color: '#b13ae0' },
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
      ctx.font = 'bold 17px monospace';
      ctx.fillStyle = '#e8e0cf';
      ctx.fillText(`${i + 1}. ${labels[i].text}`, r.x + 22, r.y + 20);
      ctx.font = '11px monospace';
      ctx.fillStyle = '#666a80';
      ctx.fillText(labels[i].sub, r.x + 22, r.y + 37);
    });

    // 오늘의 탑 — 날짜 시드 도전 안내 + 오늘 기록
    {
      const now = new Date();
      const key = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
      const rec = Meta.data.daily && Meta.data.daily.key === key ? Meta.data.daily : null;
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#f7b32b';
      ctx.fillText(
        rec
          ? `🗼 D — 오늘의 탑 · 오늘 기록: ${rec.floor}층${rec.victory ? ' 정복!' : ''} (${rec.runs}회 도전)`
          : '🗼 D — 오늘의 탑 (매일 바뀌는 고정 시드, 모두에게 같은 던전)',
        Renderer.W / 2, Renderer.H - 30);
    }

    ctx.textAlign = 'center';
    ctx.font = '12px monospace';
    ctx.fillStyle = '#4a4a5c';
    ctx.fillText('WASD 이동 · 클릭/J 공격 · Space 대시 · M 음소거', Renderer.W / 2, Renderer.H - 12);

    // 테스트 모드 상태 (T로 토글)
    if (Game.testMode) {
      ctx.textAlign = 'left';
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#e43b44';
      ctx.fillText('⚙ 테스트 모드 ON (T로 끄기)', 24, Renderer.H - 20);
      ctx.font = '11px monospace';
      ctx.fillStyle = '#9aa0b4';
      ctx.fillText('O 파편+500 · I 도감 완성 · Y 직업/열기 해금 · V 봇 모드 · 게임 중 G무적 K전멸 N다음층...', 24, Renderer.H - 40);
    }
  },

  altarRowRects() {
    const w = 620, h = 44, gap = 8;
    const x = (Renderer.W - w) / 2;
    const y0 = 108;
    return META_UPGRADES.map((_, i) => ({ x, y: y0 + i * (h + gap), w, h }));
  },

  drawAltar(ctx, blinkT) {
    this._drawHubBg(ctx, blinkT);
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px monospace';
    ctx.fillStyle = '#2ec4b6';
    ctx.fillText('기억의 제단', Renderer.W / 2, 70);
    this._shardLabel(ctx, Renderer.W - 24, 36);

    this.altarRowRects().forEach((r, i) => {
      const up = META_UPGRADES[i];
      const lv = Meta.lvl(up.id);
      const cost = Meta.cost(up.id);
      const maxed = cost === null;
      const affordable = !maxed && Meta.data.shards >= cost;
      const hover = Input.mouse.x >= r.x && Input.mouse.x <= r.x + r.w &&
                    Input.mouse.y >= r.y && Input.mouse.y <= r.y + r.h;

      ctx.fillStyle = hover && !maxed ? '#1d1d2e' : '#141420';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = maxed ? '#4a4a5c' : affordable ? '#2ec4b6' : '#3a3a4a';
      ctx.lineWidth = hover && affordable ? 3 : 1.5;
      ctx.strokeRect(r.x, r.y, r.w, r.h);

      ctx.textAlign = 'left';
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#e8e0cf';
      ctx.fillText(`${i + 1}. ${up.name}`, r.x + 16, r.y + 19);
      ctx.font = '12px monospace';
      ctx.fillStyle = '#9aa0b4';
      ctx.fillText(up.desc, r.x + 16, r.y + 36);

      // 레벨 핍
      for (let l = 0; l < up.max; l++) {
        ctx.fillStyle = l < lv ? '#2ec4b6' : '#2a2a3a';
        ctx.fillRect(r.x + 400 + l * 16, r.y + 17, 10, 10);
      }

      ctx.textAlign = 'right';
      ctx.font = 'bold 14px monospace';
      if (maxed) {
        ctx.fillStyle = '#666a80';
        ctx.fillText('완성', r.x + r.w - 16, r.y + 28);
      } else {
        ctx.fillStyle = affordable ? '#2ec4b6' : '#8a4a4a';
        ctx.fillText(`◆ ${cost}`, r.x + r.w - 16, r.y + 28);
      }
    });

    this._drawBackButton(ctx);
  },

  drawClasses(ctx, blinkT) {
    this._drawHubBg(ctx, blinkT);
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px monospace';
    ctx.fillStyle = '#b13ae0';
    ctx.fillText('직업 선택', Renderer.W / 2, 70);
    this._shardLabel(ctx, Renderer.W - 24, 36);

    const ids = Object.keys(CLASSES);
    const rects = this.cardRects(ids.length);
    ids.forEach((id, i) => {
      const cls = CLASSES[id];
      const unlocked = Meta.classUnlocked(id);
      const selected = Meta.data.cls === id;
      const affordable = Meta.data.shards >= cls.unlock;
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

      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = unlocked ? '#e8e0cf' : '#666a80';
      ctx.fillText(cls.name, cx, r.y + lift + 92);
      ctx.font = '12px monospace';
      ctx.fillStyle = '#9aa0b4';
      ctx.fillText(`HP ${cls.hp} · 속도 ${cls.speed}`, cx, r.y + lift + 112);
      ctx.font = '12px monospace';
      this._wrapText(ctx, cls.desc, cx, r.y + lift + 134, r.w - 26, 17);

      ctx.font = 'bold 14px monospace';
      if (selected) {
        ctx.fillStyle = '#f7b32b';
        ctx.fillText('▶ 선택됨', cx, r.y + lift + this.cardRects(ids.length)[0].h - 14);
      } else if (unlocked) {
        ctx.fillStyle = cls.color;
        ctx.fillText('클릭하여 선택', cx, r.y + lift + this.cardRects(ids.length)[0].h - 14);
      } else {
        ctx.fillStyle = affordable ? '#2ec4b6' : '#8a4a4a';
        ctx.fillText(`◆ ${cls.unlock} 해금`, cx, r.y + lift + this.cardRects(ids.length)[0].h - 14);
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
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#f7b32b';
    ctx.fillText('획득 목록', Renderer.W / 2, 42);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#666a80';
    ctx.fillText('Tab / ESC — 닫기', Renderer.W / 2, 62);

    // 현재 스탯 요약
    ctx.font = '13px monospace';
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
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#2ec4b6';
    ctx.fillText(`특성 (${traitIds.length})`, 70, 126);

    let y = 150;
    if (traitIds.length === 0) {
      ctx.font = '12px monospace';
      ctx.fillStyle = '#4a4a5c';
      ctx.fillText('아직 없음 — 레벨업으로 획득', 70, y);
    }
    const maxRows = 11;
    traitIds.slice(0, maxRows).forEach((id) => {
      const t = TRAITS.find((tr) => tr.id === id);
      if (!t) return;
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = t.color;
      const stack = counts[id] > 1 ? ` x${counts[id]}` : '';
      ctx.fillText(`[${t.tag}] ${t.name}${stack}`, 70, y);
      ctx.font = '11px monospace';
      ctx.fillStyle = '#9aa0b4';
      ctx.fillText(t.desc, 82, y + 15);
      y += 33;
    });
    if (traitIds.length > maxRows) {
      ctx.font = '11px monospace';
      ctx.fillStyle = '#666a80';
      ctx.fillText(`... 외 ${traitIds.length - maxRows}개`, 70, y);
    }

    // ── 오른쪽: 유물 ──
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#f7b32b';
    ctx.fillText(`유물 (${p.relics.length})`, 510, 126);

    y = 150;
    if (p.relics.length === 0) {
      ctx.font = '12px monospace';
      ctx.fillStyle = '#4a4a5c';
      ctx.fillText('아직 없음 — 보물상자·보스에게서 획득', 510, y);
    }
    p.relics.slice(0, maxRows).forEach((id) => {
      const rl = RELICS.find((r) => r.id === id);
      if (!rl) return;
      const rar = RARITY[rl.rarity];
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = rar.color;
      ctx.fillText(`[${rar.label}] ${rl.name}`, 510, y);
      ctx.font = '11px monospace';
      ctx.fillStyle = '#9aa0b4';
      ctx.fillText(rl.desc, 522, y + 15);
      y += 33;
    });
    if (p.relics.length > maxRows) {
      ctx.font = '11px monospace';
      ctx.fillStyle = '#666a80';
      ctx.fillText(`... 외 ${p.relics.length - maxRows}개`, 510, y);
    }
  },

  // ══════════════ 도감 ══════════════

  codexTabRects() {
    const w = 130, h = 34, gap = 10;
    const x0 = (Renderer.W - (3 * w + 2 * gap)) / 2;
    return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y: 84, w, h }));
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
    ctx.font = 'bold 30px monospace';
    ctx.fillStyle = '#f7b32b';
    ctx.fillText('도감', Renderer.W / 2, 56);

    const codex = Meta.data.codex;
    const tabs = ['몬스터', '유물', '특성'];
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
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = active ? '#f7b32b' : '#9aa0b4';
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}. ${tabs[i]}`, r.x + r.w / 2, r.y + 22);
    });

    let hovered = null;

    if (game.codexTab === 0) {
      // 몬스터: 10열 컴팩트 그리드 (42종 = 5행), 처치 수는 호버 설명에 표시
      const found = CODEX_ENEMIES.filter((e) => codex.kills[e.id.startsWith('boss') ? 'boss' + e.id.slice(4) : e.id] > 0).length;
      this._codexHeader(ctx, found, CODEX_ENEMIES.length);
      const cols = 10, cw = 94, chh = 59;
      const x0 = (Renderer.W - cols * cw) / 2;
      CODEX_ENEMIES.forEach((e, i) => {
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
          ctx.font = '10px monospace';
          ctx.fillStyle = e.boss ? '#e43b44' : '#e8e0cf';
          ctx.textAlign = 'center';
          ctx.fillText(e.name.length > 7 ? e.name.slice(0, 7) : e.name, r.x + r.w / 2, r.y + r.h - 6);
        } else {
          ctx.font = 'bold 18px monospace';
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
      RELICS.forEach((rl, i) => {
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
          ctx.font = 'bold 22px monospace';
          ctx.fillStyle = rar.color;
          ctx.fillText(rl.name[0], r.x + r.w / 2, r.y + 40);
          ctx.font = '11px monospace';
          ctx.fillStyle = '#e8e0cf';
          ctx.fillText(rl.name, r.x + r.w / 2, r.y + r.h - 12);
        } else {
          ctx.font = 'bold 24px monospace';
          ctx.fillStyle = '#33333f';
          ctx.fillText('?', r.x + r.w / 2, r.y + r.h / 2 + 8);
        }
      });
    } else {
      // 특성: 획득 횟수 표시
      const found = TRAITS.filter((t) => codex.traits[t.id] > 0).length;
      this._codexHeader(ctx, found, TRAITS.length);
      const cols = 8, cw = 112, chh = 82;
      const x0 = (Renderer.W - cols * cw) / 2;
      TRAITS.forEach((t, i) => {
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
          ctx.font = 'bold 18px monospace';
          ctx.fillStyle = t.color;
          ctx.fillText(t.name[0], r.x + r.w / 2, r.y + 30);
          ctx.font = '10px monospace';
          ctx.fillStyle = '#e8e0cf';
          ctx.fillText(t.name, r.x + r.w / 2, r.y + r.h - 20);
          ctx.fillStyle = '#666a80';
          ctx.fillText(`x${picks}`, r.x + r.w / 2, r.y + r.h - 8);
        } else {
          ctx.font = 'bold 20px monospace';
          ctx.fillStyle = '#33333f';
          ctx.fillText('?', r.x + r.w / 2, r.y + r.h / 2 + 6);
        }
      });
    }

    // 하단 상세 정보
    if (hovered) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#e8e0cf';
      ctx.fillText(hovered.name, Renderer.W / 2, Renderer.H - 92);
      ctx.font = '12px monospace';
      ctx.fillStyle = '#9aa0b4';
      ctx.fillText(hovered.desc, Renderer.W / 2, Renderer.H - 74);
    }

    this._drawBackButton(ctx);
  },

  _codexHeader(ctx, found, total) {
    ctx.textAlign = 'right';
    ctx.font = '13px monospace';
    ctx.fillStyle = found >= total ? '#f7b32b' : '#9aa0b4';
    ctx.fillText(`발견 ${found}/${total}${found >= total ? ' — 완성!' : ''}`, Renderer.W - 40, 100);
  },

  drawGameOver(ctx, game, blinkT) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,8,15,0.75)';
    ctx.fillRect(0, 0, Renderer.W, Renderer.H);
    ctx.textAlign = 'center';

    ctx.font = 'bold 44px monospace';
    ctx.fillStyle = game.gaveUp ? '#9aa0b4' : '#e43b44';
    ctx.fillText(game.gaveUp ? '런 포기' : '전사했다...', Renderer.W / 2, 180);

    // 사망 리포트 — 죽음을 다음 런의 지식으로
    if (!game.gaveUp && game.deathInfo) {
      ctx.font = '15px monospace';
      ctx.fillStyle = '#c46a6a';
      ctx.fillText(`☠ 사인: ${game.deathInfo.src}`, Renderer.W / 2, 210);
    }

    ctx.font = '18px monospace';
    ctx.fillStyle = '#e8e0cf';
    ctx.fillText(
      `${Dungeon.floor}층 ${Dungeon.floorName()} · 방 ${Dungeon.roomIndex} 도달`,
      Renderer.W / 2, 240);
    ctx.font = '15px monospace';
    ctx.fillStyle = '#9aa0b4';
    ctx.fillText(`Lv.${game.level} · 처치 ${game.kills} · 유물 ${game.player.relics.length}개 · ${game.time.toFixed(1)}초`,
      Renderer.W / 2, 272);

    // 진전 비교 — 지난 런 대비 어디까지 왔나
    ctx.font = '13px monospace';
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
      ctx.fillText(`🗼 오늘의 탑 최고 기록: ${Meta.data.daily.floor}층 (${Meta.data.daily.runs}회 도전)`, Renderer.W / 2, game.prevRun ? 316 : 298);
    }

    this._drawShardReward(ctx, game, 330);
    this._drawRunTag(ctx, game, 448);

    if (Math.floor(blinkT * 1.6) % 2 === 0) {
      ctx.font = 'bold 17px monospace';
      ctx.fillStyle = '#5ce0e6';
      ctx.fillText('R — 즉시 재도전   ·   클릭/Space — 거점으로', Renderer.W / 2, 415);
    }
  },

  // 시드·열기 표기 (시드 공유용)
  _drawRunTag(ctx, game, y) {
    ctx.textAlign = 'center';
    ctx.font = '12px monospace';
    ctx.fillStyle = '#4a4a5c';
    const heatStr = game.heat > 0 ? ` · 열기 ${game.heat}` : '';
    ctx.fillText(`시드 ${game.runSeed.toString(36).toUpperCase()}${heatStr} — ?seed=${game.runSeed.toString(36).toUpperCase()} 로 같은 던전 도전`, Renderer.W / 2, y);
  },

  // 파편 정산 카운트업 애니메이션
  _drawShardReward(ctx, game, y) {
    const shown = Math.min(game.shardsEarned, Math.floor(game.shardAnimT * 40));
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px monospace';
    ctx.fillStyle = '#2ec4b6';
    ctx.fillText(`◆ 영혼 파편 +${shown}`, Renderer.W / 2, y);
    if (shown >= game.shardsEarned) {
      ctx.font = '13px monospace';
      ctx.fillStyle = '#666a80';
      ctx.fillText(`보유: ◆ ${Meta.data.shards}`, Renderer.W / 2, y + 26);
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
    ctx.fillText('10층 — 진 심연의 군주 눅스가 소멸했다', Renderer.W / 2, 208);

    ctx.font = '17px monospace';
    ctx.fillStyle = '#e8e0cf';
    ctx.fillText(`Lv.${game.level} · 처치 ${game.kills} · 유물 ${game.player.relics.length}개`, Renderer.W / 2, 265);
    ctx.font = '15px monospace';
    ctx.fillStyle = '#9aa0b4';
    ctx.fillText(`클리어 시간 ${(game.time / 60).toFixed(1)}분`, Renderer.W / 2, 295);
    if (game.dailyRun) {
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#f7b32b';
      ctx.fillText('🗼 오늘의 탑 정복!', Renderer.W / 2, 318);
    }

    this._drawShardReward(ctx, game, 350);
    this._drawRunTag(ctx, game, 497);

    if (Math.floor(blinkT * 1.6) % 2 === 0) {
      ctx.font = 'bold 17px monospace';
      ctx.fillStyle = '#5ce0e6';
      ctx.fillText('R — 새로운 런   ·   클릭/Space — 거점으로', Renderer.W / 2, 430);
    }
    // 무한 모드 진입 안내
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#b13ae0';
    ctx.fillText('C — 심연 회랑으로 계속 (무한 모드: 빌드 유지, 끝없는 하강)', Renderer.W / 2, 462);
  },

  // ── 전체 매뉴얼 (H 또는 /) — 게임 중·거점 어디서나. 1p 조작·전투 / 2p 던전·성장 ──
  drawManual(ctx, game, page) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,8,15,0.9)';
    ctx.fillRect(0, 0, Renderer.W, Renderer.H);
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px monospace';
    ctx.fillStyle = '#e8e0cf';
    ctx.fillText(page === 1 ? '매뉴얼 1/2 — 조작과 전투' : '매뉴얼 2/2 — 던전과 성장', Renderer.W / 2, 60);

    const drawCol = (x, title, color, rows) => {
      ctx.textAlign = 'left';
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = color;
      ctx.fillText(title, x, 104);
      let y = 132;
      for (const r of rows) {
        if (r.h) { // 항목 제목
          ctx.font = 'bold 13px monospace';
          ctx.fillStyle = r.c || '#ffd866';
          ctx.fillText(r.h, x, y);
          y += 18;
        }
        if (r.t) {
          ctx.font = '12px monospace';
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
        { h: '벽 충돌', t: '마무리 일격·회전 베기로 적을 벽에 처박으면 추가 피해' },
        { h: '스킬 진화', t: '직업 특성 3장 + Lv.12 — 스킬의 형태가 바뀐다' },
        { h: '보스 기믹', t: '체력바 아래 기믹을 읽어라 — 정답 특성 트리가 있다' },
      ]);
    } else {
      drawCol(Renderer.W / 2 - 396, '던전', '#5ce0e6', [
        { h: '문 선택', t: '전투 / 정예(카드 보상) / 보물 / 모닥불 / 기연(?)' },
        { t: '⚠ 수식어가 붙은 문은 위험하지만 보상이 크다', dim: true },
        { h: '모닥불 방', t: '휴식(HP +2) vs 담금질(이번 층 공격력 +1) — 하나만' },
        { h: '미지의 기연', t: '받아들이기 전엔 정체를 모른다 — 대체로 이득, 가끔 함정' },
        { h: '우두머리', t: '층마다 나타나는 거대 변종 — 처치 시 하트 + 파편 확정' },
        { h: '지름길', t: '3·6층 보스 후 — 한 층을 건너뛰지만 도착 층이 험하다' },
        { t: '(대신 그 층의 정예가 파편을 떨군다)', dim: true },
        { h: '균열 벽 · 항아리', t: '금 간 벽과 항아리는 부술 수 있다 — 보상이 숨어 있다' },
      ]);
      drawCol(Renderer.W / 2 + 16, '성장', '#f7b32b', [
        { h: '특성 카드', t: '같은 태그를 모으면 시너지 — 트리를 파라' },
        { t: '중첩 상한은 카드에 표시 (보유 n/상한)', dim: true },
        { h: '전설 특성', t: '황금 카드 — 게임 규칙을 바꾼다 (극저확률)' },
        { h: '유물', t: '커먼~레전더리 — 보물상자와 보스가 준다' },
        { h: '도감', t: '몬스터 수집이 파편 보상으로 돌아온다 (거점 4번)' },
        { h: '기억의 제단', t: '영혼 파편으로 영구 강화 (거점 2번)' },
        { h: '열기 · 오늘의 탑', t: '정복 후 고난이도 해금(←→) · 거점 D 일일 도전' },
        { h: '무한 모드', t: '10층 정복 후 C — 빌드 유지, 끝없는 하강' },
      ]);
    }

    ctx.textAlign = 'center';
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#5ce0e6';
    ctx.fillText(page === 1 ? 'H / — 다음 페이지   ·   ESC — 닫기' : 'H / — 닫기   ·   ESC — 닫기', Renderer.W / 2, Renderer.H - 24);
  },
};
