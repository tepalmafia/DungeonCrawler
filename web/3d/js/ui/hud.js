// HUD — 전부 DOM. 텍스트 선명도·툴팁·CSS 애니메이션을 공짜로 얻는다.
// 미니맵만 별도 2D 캔버스에 직접 그린다.

import { SKILLS } from '../game/skills.js';
import { FLOOR, worldToGrid } from '../world/dungeon.js';
import { RARITIES } from '../game/items.js';
import { fuelCap } from '../game/lantern.js';

const $ = (s) => document.querySelector(s);

export class UI {
  constructor(G) {
    this.G = G;
    this.el = {
      hud: $('#hud'),
      hpFill: $('#orbHp .fill'), hpNum: $('#orbHp .num'),
      mpFill: $('#orbMp .fill'), mpNum: $('#orbMp .num'),
      xpFill: $('#xpbar .fill'), lv: $('#lvLabel'),
      lanternBar: $('#lanternBar'), lanternIcon: $('#lanternBar .lic'),
      lanternFill: $('#lanternBar .lfill'), lanternRefuel: $('#lanternBar .lrefuel'),
      lanternNum: $('#lanternBar .lnum'),
      skillbar: $('#skillbar'),
      toasts: $('#toasts'),
      center: $('#center'),
      hurt: $('#hurt'),
      floor: $('#floorLabel'),
      tier: $('#tierLabel'),
      enemyLeft: $('#enemyLeft'),
      bossbar: $('#bossbar'),
      bossFill: $('#bossbar .bfill'),
      bossPhase: $('#bossbar .bphase'),
      bossName: $('#bossbar .bname'),
      minimap: $('#minimap'),
      overlay: $('#overlay'),
      titleCard: $('#titleCard'),
      interact: $('#interact'),
      shop: $('#shop'),
      shopList: $('#shopList'),
      shopCoin: $('#shopCoin'),
    };
    const sc = $('#shopClose');
    if (sc) sc.addEventListener('click', () => this.setShop(null));
    this.mm = this.el.minimap.getContext('2d');
    this._buildSkillbar();
    this._centerT = 0;
    this._hurtT = 0;
    this.toastList = [];
  }

  show() { this.el.hud.hidden = false; }

  /** 위 줄 = 스킬 4종, 아래 줄 = 물약 + 예비 칸. 두 줄 다 4칸으로 폭을 맞춘다. */
  _buildSkillbar() {
    this.skillEls = {};
    this.el.skillbar.innerHTML = '';

    const rowTop = document.createElement('div');
    rowTop.className = 'skillrow';
    const rowBottom = document.createElement('div');
    rowBottom.className = 'skillrow';
    this.el.skillbar.append(rowTop, rowBottom);

    const cell = (label, icon, cost, title, cls = 'skill') => {
      const d = document.createElement('div');
      d.className = cls;
      if (title) d.title = title;
      d.innerHTML = `<span class="key">${label}</span><span>${icon}</span>`
        + `<span class="cost">${cost}</span><div class="cd"></div><div class="cdnum"></div>`;
      return d;
    };

    for (const s of SKILLS) {
      const d = cell(s.label, s.icon, s.cost, `${s.name} — ${s.desc} (마나 ${s.cost})`);
      rowTop.appendChild(d);
      this.skillEls[s.key] = d;
    }

    for (const p of [
      { key: 'potHp', label: '1', icon: '🧪', title: '체력 물약' },
      { key: 'potMp', label: '2', icon: '🔵', title: '마나 물약' },
    ]) {
      const d = cell(p.label, p.icon, '', p.title);
      rowBottom.appendChild(d);
      this.skillEls[p.key] = d;
    }
    // 예비 칸 — 두 줄의 폭을 맞추고, 늘어날 자리가 있다는 걸 보여준다
    for (const label of ['3', '4'])
      rowBottom.appendChild(cell(label, '', '', '', 'skill slot-empty'));
  }

  fireSkill(key) {
    const el = this.skillEls[key];
    if (!el) return;
    el.classList.remove('fire');
    void el.offsetWidth;      // 리플로우로 애니메이션 재시작
    el.classList.add('fire');
  }

  toast(text, color = '#e8e2d6') {
    const d = document.createElement('div');
    d.className = 'toast';
    d.style.color = color;
    d.textContent = text;
    this.el.toasts.appendChild(d);
    this.toastList.push({ el: d, t: 3.2 });
    while (this.toastList.length > 7) {
      const old = this.toastList.shift();
      old.el.remove();
    }
  }

  center(text, sub = '') {
    this.el.center.innerHTML = text + (sub ? `<span class="sub">${sub}</span>` : '');
    this.el.center.classList.remove('show');
    void this.el.center.offsetWidth;
    this.el.center.classList.add('show');
    this._centerT = 2.4;
  }

  hurtFlash(k) { this._hurtT = Math.max(this._hurtT, 0.25 * Math.min(1, k) + 0.1); this.el.hurt.style.opacity = Math.min(0.9, k); }

  setBoss(boss) {
    this.boss = boss;
    this.el.bossbar.hidden = !boss;
    if (boss) {
      this.el.bossName.textContent = boss.def.name;
      this.setBossPhase('1페이즈');
    }
  }
  setBossPhase(t) { this.el.bossPhase.textContent = t; }

  /** 벽 횃불 보충 진행도 (0~1) */
  setRefuel(k) { this.el.lanternRefuel.style.width = (k * 100).toFixed(0) + '%'; }

  /** 손 닿는 곳의 안내 — 스위치·행상. null 이면 감춘다 */
  setInteract(it) {
    const el = this.el.interact;
    if (!el) return;
    if (!it) { el.hidden = true; return; }
    if (el.textContent !== it.label) el.textContent = it.label;
    el.hidden = false;
  }

  /**
   * 상점 창. shop 이 null 이면 닫는다.
   *
   * 인벤토리와 같은 창에 넣지 않았다 — 던전 안에서 여는 창이라
   * 「잠깐 멈춰서 고른다」는 감각이 인벤토리와 달라야 한다.
   */
  setShop(shop) {
    const el = this.el.shop;
    if (!el) return;
    this.shop = shop || null;
    if (!shop) { el.hidden = true; return; }
    el.hidden = false;
    this.renderShop();
  }

  renderShop() {
    const shop = this.shop;
    if (!shop) return;
    const p = this.G.player;
    const body = this.el.shopList;
    this.el.shopCoin.textContent = `◈ ${p.coin}`;
    body.innerHTML = '';
    shop.stock.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'srow' + (s.sold ? ' sold' : '') + (p.coin < s.price ? ' poor' : '');
      const rar = s.item && s.item.rarity != null ? RARITIES[s.item.rarity] : null;
      row.innerHTML = `<span class="si">${s.icon}</span>`
        + `<span class="sn" ${rar ? `style="color:${rar.css}"` : ''}>${s.sold ? '— 팔림 —' : s.name}</span>`
        + `<span class="sp">◈ ${s.price}</span>`;
      if (!s.sold) {
        row.onmouseenter = () => { if (s.item && s.item.slot) this._shopTip(s.item, p.equipped[s.item.slot]); };
        row.onmouseleave = () => { this.G.inv._hideTooltip(); };
        row.onclick = () => {
          const r = shop.buy(this.G, i);
          if (!r.ok) { this.toast(r.why, '#e07272'); return; }
          this.toast(`${s.name} 구입`, '#d8b45e');
          this.renderShop();
        };
      }
      body.appendChild(row);
    });
  }

  _shopTip(item, same) { this.G.inv._showTooltip(item, same); }

  update(dt) {
    const G = this.G, p = G.player;
    if (!p) return;

    // 랜턴 — 연료가 자원이므로 남은 시간을 초 단위로 보여준다
    const lan = p.lantern;
    this.el.lanternBar.hidden = !lan;
    if (lan) {
      const k = Math.max(0, lan.fuel / fuelCap(lan, p));
      this.el.lanternIcon.textContent = lan.icon;
      this.el.lanternFill.style.width = (k * 100).toFixed(1) + '%';
      this.el.lanternNum.textContent = `${Math.ceil(lan.fuel)}초`;
      this.el.lanternBar.classList.toggle('low', lan.fuel < 45);
    }

    // 구슬
    const hk = Math.max(0, p.hp / p.maxHp), mk = Math.max(0, p.mp / p.maxMp);
    this.el.hpFill.style.height = (hk * 100).toFixed(1) + '%';
    this.el.mpFill.style.height = (mk * 100).toFixed(1) + '%';
    this.el.hpNum.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    this.el.mpNum.textContent = `${Math.ceil(p.mp)} / ${p.maxMp}`;

    this.el.xpFill.style.width = ((p.xp / p.xpNext) * 100).toFixed(1) + '%';
    this.el.lv.textContent = `Lv ${p.level}  ·  ${Math.floor(p.xp)} / ${p.xpNext}`;

    // 스킬 쿨다운
    for (const s of SKILLS) {
      const el = this.skillEls[s.key];
      const left = G.cooldowns[s.key] || 0;
      const full = s.cd * (1 - p.cdr);
      const k = left > 0 ? left / full : 0;
      el.querySelector('.cd').style.setProperty('--p', (k * 360).toFixed(1) + 'deg');
      el.querySelector('.cdnum').textContent = left > 0.05 ? left.toFixed(1) : '';
      el.classList.toggle('off', p.mp < s.cost && left <= 0);
    }
    for (const [key, kind] of [['potHp', 'hp'], ['potMp', 'mp']]) {
      const el = this.skillEls[key];
      const left = p.potionCd[kind];
      el.querySelector('.cd').style.setProperty('--p', (Math.max(0, left / 8) * 360).toFixed(1) + 'deg');
      el.querySelector('.cdnum').textContent = left > 0.05 ? left.toFixed(1) : '';
      el.querySelector('.cost').textContent = `×${p.potions[kind]}`;
      el.classList.toggle('off', p.potions[kind] <= 0);
    }

    // 층 / 남은 적
    this.el.floor.textContent = `${G.floorNo}층 — ${G.dungeon.theme.name}`;
    this.el.tier.textContent = G.tier > 0 ? `파밍 ${G.tier + 1}회차` : '';
    const alive = G.enemies.filter((e) => !e.dead).length;
    this.el.enemyLeft.textContent = G.boss && !G.boss.dead ? '보스전' : `남은 적 ${alive}`;

    // 보스 바
    if (this.boss) {
      if (this.boss.dead) { this.el.bossbar.hidden = true; this.boss = null; }
      else this.el.bossFill.style.width = Math.max(0, (this.boss.hp / this.boss.maxHp) * 100).toFixed(1) + '%';
    }

    // 페이드
    if (this._centerT > 0) {
      this._centerT -= dt;
      this.el.center.style.opacity = Math.min(1, this._centerT / 0.6);
      if (this._centerT <= 0) this.el.center.innerHTML = '';
    }
    if (this._hurtT > 0) {
      this._hurtT -= dt;
      if (this._hurtT <= 0) this.el.hurt.style.opacity = 0;
    }
    for (let i = this.toastList.length - 1; i >= 0; i--) {
      const t = this.toastList[i];
      t.t -= dt;
      if (t.t <= 0) { t.el.remove(); this.toastList.splice(i, 1); }
      else if (t.t < 0.6) t.el.style.opacity = (t.t / 0.6).toFixed(2);
    }

    this._drawMinimap();
  }

  _drawMinimap() {
    const G = this.G, dg = G.dungeon, ctx = this.mm;
    const S = 180, SPAN = 34;                     // 주변 34칸을 보여준다
    const scale = S / SPAN;
    const [pgx, pgz] = worldToGrid(G.player.pos.x, G.player.pos.z, dg.w, dg.h);

    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(6,5,10,.75)';
    ctx.fillRect(0, 0, S, S);

    const ox = S / 2 - pgx * scale, oz = S / 2 - pgz * scale;
    const x0 = Math.max(0, pgx - SPAN / 2 - 1), x1 = Math.min(dg.w, pgx + SPAN / 2 + 1);
    const z0 = Math.max(0, pgz - SPAN / 2 - 1), z1 = Math.min(dg.h, pgz + SPAN / 2 + 1);

    ctx.fillStyle = '#3b3448';
    for (let z = z0; z < z1; z++)
      for (let x = x0; x < x1; x++)
        if (dg.at(x, z) === FLOOR) ctx.fillRect(ox + x * scale, oz + z * scale, scale + 0.6, scale + 0.6);

    // 출구
    if (G.level && G.level.exitOpen) {
      ctx.fillStyle = '#8fd6ff';
      ctx.fillRect(ox + dg.exit.gx * scale - 2, oz + dg.exit.gz * scale - 2, scale + 4, scale + 4);
    }
    // 드랍
    for (const d of G.drops) {
      const [gx, gz] = worldToGrid(d.pos.x, d.pos.z, dg.w, dg.h);
      ctx.fillStyle = RARITIES[d.item.rarity].css;
      ctx.fillRect(ox + gx * scale - 1, oz + gz * scale - 1, scale + 2, scale + 2);
    }
    // ── 적 ────────────────────────────────────────────────
    // 전부 찍어 주면 미니맵이 정찰 도구가 되어 「어둠 속을 더듬는다」는 설계가
    // 통째로 무너진다. 랜턴 반경 안에 들어온 놈만 보이고, 벗어나면 마지막 위치가
    // 잠깐 남았다가 사라진다 — 기억은 하되 추적은 못 한다.
    const sense = (G.lighting ? G.lighting.lamp.radius : 9) + 2;
    const MEM = 4;                                 // 시야에서 벗어난 뒤 남는 초
    for (const e of G.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.pos.x - G.player.pos.x, e.pos.z - G.player.pos.z);
      // 어그로가 붙은 놈은 거리와 무관하게 보인다 — 이미 쫓아오는 걸 아는 상태다
      const visible = d <= sense || e.aggro;
      if (visible) {
        e._mmSeen = G.time;
        e._mmX = e.pos.x; e._mmZ = e.pos.z;
      } else if (e._mmSeen == null || G.time - e._mmSeen > MEM) {
        continue;
      }
      const age = visible ? 0 : (G.time - e._mmSeen) / MEM;
      const [gx, gz] = worldToGrid(e._mmX, e._mmZ, dg.w, dg.h);
      ctx.globalAlpha = visible ? 1 : Math.max(0, 1 - age);
      ctx.fillStyle = e.isBoss ? '#ff4a8a' : e.elite ? '#e0a03a' : '#d0402f';
      const s = e.isBoss ? scale + 4 : e.elite ? scale + 2 : scale;
      ctx.fillRect(ox + gx * scale, oz + gz * scale, s, s);
    }
    ctx.globalAlpha = 1;
    // 플레이어
    ctx.fillStyle = '#ffe9c0';
    ctx.beginPath();
    ctx.arc(S / 2 + scale / 2, S / 2 + scale / 2, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}
