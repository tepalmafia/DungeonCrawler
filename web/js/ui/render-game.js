// 게임 렌더링 — 월드/개체/이펙트를 그리고 HUD로 위임한다.
// main.js에서 Object.assign(Game, GameRender)으로 Game에 합쳐진다.
const GameRender = {
  render() {
    const ctx = Renderer.ctx;
    Renderer.begin();

    if (this.state === 'hub' || this.state === 'altar' || this.state === 'classes' || this.state === 'codex') {
      if (this.state === 'hub') HUD.drawHub(ctx, this.blinkT);
      else if (this.state === 'altar') HUD.drawAltar(ctx, this.blinkT);
      else if (this.state === 'classes') HUD.drawClasses(ctx, this.blinkT);
      else HUD.drawCodex(ctx, this.blinkT, this);
      if (this.showManual) HUD.drawManual(ctx, this, this.showManual);
      return;
    }

    World.draw(ctx, this.blinkT);

    World.drawDoors(ctx, this.blinkT);

    // 불길/독 장판 (플레이어 위험)
    for (const fp of this.firePatches) {
      const col = fp.kind === 'poison' ? '106,176,76' : '255,112,67';
      ctx.globalAlpha = Math.min(0.45, fp.life * 0.4) * (0.75 + Math.random() * 0.25);
      ctx.fillStyle = `rgba(${col},0.5)`;
      ctx.beginPath();
      ctx.arc(fp.x, fp.y, fp.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (Math.random() < 0.25) {
        Particles.burst(fp.x + (Math.random() - 0.5) * fp.r * 1.4, fp.y + (Math.random() - 0.5) * fp.r * 1.4, {
          count: 1, colors: fp.kind === 'poison' ? ['#6ab04c'] : ['#ff7043', '#ffd866'],
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

    // 감전/독구름/잿불 장판 (적 피해)
    for (const z of this.zones) {
      const col = z.kind === 'poison' ? '#6ab04c' : z.kind === 'fire' ? '#ff7043' : '#ffd866';
      ctx.globalAlpha = Math.min(0.4, z.life) * (0.7 + Math.random() * 0.3);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
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
      ctx.globalAlpha = 0.7 * (1 - ring.r / ring.maxR) + 0.2;
      ctx.strokeStyle = '#e8e0cf';
      ctx.lineWidth = ring.width * 0.6;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
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
          ctx.font = 'bold 16px monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#b13ae0';
          ctx.fillText('?', it.x, it.y - 16);
          ctx.font = 'bold 12px monospace';
          ctx.fillText('미지의 기연', it.x, it.y - 44);
          ctx.font = '11px monospace';
          ctx.fillStyle = '#9aa0b4';
          ctx.fillText('받아들이기 전엔 알 수 없다', it.x, it.y - 30);
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
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#b13ae0';
          ctx.fillText('저주받은 상자', it.x, it.y - 44);
          ctx.font = '11px monospace';
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
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#e43b44';
          ctx.fillText('피의 제단', it.x, it.y - 44);
          ctx.font = '11px monospace';
          ctx.fillStyle = '#9aa0b4';
          ctx.fillText('HP 2 → 공격력 +1', it.x, it.y - 30);
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
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ff7043';
          ctx.fillText('모닥불', it.x, it.y - 44);
          ctx.font = '11px monospace';
          ctx.fillStyle = '#9aa0b4';
          ctx.fillText(`휴식 — HP +${this.heat >= 4 ? 1 : 2}`, it.x, it.y - 30);
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
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffd866';
          ctx.fillText('숫돌', it.x, it.y - 44);
          ctx.font = '11px monospace';
          ctx.fillStyle = '#9aa0b4';
          ctx.fillText('담금질 — 이번 층 공격력 +1', it.x, it.y - 30);
        }
      }
    }

    for (const pk of this.pickups) {
      const bob = Math.sin(pk.t * 5) * 3;
      ctx.drawImage(Sprites.heart, Math.round(pk.x - 12), Math.round(pk.y - 9 + bob), 24, 18);
    }
    for (const o of this.orbs) {
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

    const drawables = [...this.enemies];
    if (this.state !== 'over') drawables.push(this.player);
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) {
      // 등장 연출: 땅에서 솟아오르며 실체화
      if (d.spawnT > 0) {
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
      d.draw(ctx);
    }

    // 투사체
    for (const a of this.arrows) {
      const style = PROJ_STYLES[a.kind] || PROJ_STYLES.arrow;
      if (style.sprite) {
        Renderer.drawSprite(Sprites.arrow, a.x, a.y, { rot: Math.atan2(a.dir.y, a.dir.x), scale: 3 });
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
      const t = this.player.autoTarget(this);
      if (t) {
        const r = t.r + 8;
        const L = 6;
        ctx.save();
        ctx.strokeStyle = 'rgba(228,59,68,0.75)';
        ctx.lineWidth = 2;
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          ctx.beginPath();
          ctx.moveTo(t.x + sx * r, t.y + sy * r - sy * L);
          ctx.lineTo(t.x + sx * r, t.y + sy * r);
          ctx.lineTo(t.x + sx * r - sx * L, t.y + sy * r);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 플레이어 투사체
    for (const b of this.pbolts) {
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

    // 어둠 기믹 층: 시야 제한 — HUD보다 아래에
    if (World.hazard === 'dark' && this.state !== 'over' && this.state !== 'victory') {
      const p = this.player;
      const g = ctx.createRadialGradient(p.x, p.y, 130, p.x, p.y, 300);
      g.addColorStop(0, 'rgba(5,3,10,0)');
      g.addColorStop(1, 'rgba(5,3,10,0.88)');
      ctx.fillStyle = g;
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
      ctx.font = 'bold 30px monospace';
      ctx.fillStyle = '#e8e0cf';
      ctx.fillText('일시정지 — 매뉴얼', Renderer.W / 2, 72);

      // ── 왼쪽: 기본 조작 ──
      const lx = Renderer.W / 2 - 396;
      ctx.textAlign = 'left';
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#5ce0e6';
      ctx.fillText('기본 조작', lx, 122);
      ctx.font = '13px monospace';
      const basics = [
        ['WASD / 방향키', '이동'],
        ['클릭 / J', '공격 — 3연격, 3타째가 강하다'],
        ['Space / Shift', '대시 (짧은 무적)'],
        ['K / 우클릭', '직업 스킬'],
        ['Tab', '획득 목록 · 현재 스탯'],
        ['1 2 3', '카드 선택 (E — 리롤, 환생 각인)'],
        ['M', '음소거'],
      ];
      basics.forEach(([k, v], i) => {
        ctx.fillStyle = '#e8e0cf';
        ctx.fillText(k, lx, 150 + i * 24);
        ctx.fillStyle = '#9aa0b4';
        ctx.fillText(v, lx + 148, 150 + i * 24);
      });

      // ── 오른쪽: 전투의 정수 (고급 기술) ──
      const rx = Renderer.W / 2 + 16;
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#f7b32b';
      ctx.fillText('전투의 정수', rx, 122);
      const tech = [
        ['완벽 회피', '적 공격이 닿기 직전 대시로 회피', '→ 시간이 느려지고 다음 일격이 확정 크리'],
        ['대시 파생기', '대시 중 공격 — 직업별 특수기', '검사 돌진 찌르기 / 궁수 후퇴 사격 / 마도사 점멸 폭발'],
        ['벽 충돌', '3타 마무리·회전 베기로 적을 벽에 처박으면', '추가 피해 — 지형이 무기다'],
        ['스킬 진화', '직업 특성 3장 + Lv.12', '→ 스킬의 형태가 바뀐다 (회오리 베기 등)'],
        ['균열 벽', '금이 간 벽은 부술 수 있다', '→ 비밀 벽감에 보상이 숨어 있다'],
      ];
      let ty = 150;
      for (const t of tech) {
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = '#ffd866';
        ctx.fillText('· ' + t[0], rx, ty);
        ctx.font = '12px monospace';
        ctx.fillStyle = '#c8d4e4';
        ctx.fillText(t[1], rx + 16, ty + 18);
        ctx.fillStyle = '#8a90a4';
        ctx.fillText(t[2], rx + 16, ty + 34);
        ty += 58;
      }

      ctx.textAlign = 'center';
      ctx.font = '14px monospace';
      ctx.fillStyle = '#5ce0e6';
      ctx.fillText('H 또는 / — 전체 매뉴얼 (던전·성장 안내 포함)', Renderer.W / 2, Renderer.H - 100);
      ctx.fillStyle = '#9aa0b4';
      ctx.fillText('ESC / P — 계속하기', Renderer.W / 2, Renderer.H - 78);
      ctx.fillStyle = '#e43b44';
      ctx.fillText('Q — 런 포기하고 정산', Renderer.W / 2, Renderer.H - 56);
      ctx.fillStyle = '#4a4a5c';
      ctx.fillText(`시드 ${this.runSeed.toString(36).toUpperCase()}${this.heat > 0 ? ' · 열기 ' + this.heat : ''}`, Renderer.W / 2, Renderer.H - 32);
    }

    if (this.showManual && this.state === 'play') HUD.drawManual(ctx, this, this.showManual);

    if (this.state === 'levelup') HUD.drawCardChoice(ctx, this, this.traitCards, this.choiceReason === 'elite' ? '정예 처치 보상!' : '레벨 업!', (t) => `[ ${t.tag} ]`);
    if (this.state === 'relic') HUD.drawCardChoice(ctx, this, this.relicCards, '유물을 선택하라', (r) => `[ ${RARITY[r.rarity].label} ]`, (r) => RARITY[r.rarity].color);
    if (this.state === 'over') HUD.drawGameOver(ctx, this, this.blinkT);
    if (this.state === 'victory') HUD.drawVictory(ctx, this, this.blinkT);

    if (this.transition) {
      const a = this.transition.phase === 'out' ? this.transition.t : 1 - this.transition.t;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = Math.min(1, a);
      ctx.fillStyle = '#08080f';
      ctx.fillRect(0, 0, Renderer.W, Renderer.H);
      ctx.globalAlpha = 1;
    }
  },
};
