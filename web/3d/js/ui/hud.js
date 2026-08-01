// HUD — 전부 DOM. 텍스트 선명도·툴팁·CSS 애니메이션을 공짜로 얻는다.
// 미니맵만 별도 2D 캔버스에 직접 그린다.

import * as THREE from 'three';
import { SKILLS } from '../game/skills.js';
import { FLOOR, worldToGrid } from '../world/dungeon.js';
import { RARITIES, priceOf } from '../game/items.js';
import { fuelCap } from '../game/lantern.js';
import { SELL_MULT } from '../game/shop.js';

const $ = (s) => document.querySelector(s);
const V = new THREE.Vector3();      // 투영용 재사용 벡터

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
      enemyName: $('#enemyName'),
      gambleList: $('#gambleList'),
      sellList: $('#sellList'),
      shopCoin: $('#shopCoin'),
      beltSlots: $('#beltSlots'),
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

  /**
   * 단축바 — 디아블로2 배치. 스킬은 한 줄, 물약은 **벨트**로 따로 뺀다.
   *
   * 예전엔 두 줄로 쌓아 뒀는데, 그러면 스킬과 소모품이 같은 종류로 읽힌다.
   * 실제로는 성격이 다르다 — 스킬은 마나와 쿨다운, 물약은 개수다.
   * 나란히 놓고 사이에 선을 하나 그으면 그 차이가 보인다.
   */
  _buildSkillbar() {
    this.skillEls = {};
    this.el.skillbar.innerHTML = '';
    const belt = this.el.beltSlots;
    if (belt) belt.innerHTML = '';

    const cell = (label, icon, cost, title, cls = 'skill') => {
      const d = document.createElement('div');
      d.className = cls;
      if (title) d.title = title;
      d.innerHTML = `<span class="key">${label}</span><span>${icon}</span>`
        + `<span class="cost">${cost}</span><div class="cd"></div><div class="cdnum"></div>`;
      return d;
    };

    const row = document.createElement('div');
    row.className = 'skillrow';
    this.el.skillbar.appendChild(row);
    for (const s of SKILLS) {
      const d = cell(s.label, s.icon, s.cost, `${s.name} — ${s.desc} (마나 ${s.cost})`);
      row.appendChild(d);
      this.skillEls[s.key] = d;
    }

    // 벨트 4칸 — 앞 둘은 물약, 뒤 둘은 아직 비어 있다.
    // 빈 칸을 보여 주는 이유: 늘어날 자리가 있다는 것도 정보다.
    for (const p of [
      { key: 'potHp', label: '1', icon: '🧪', title: '체력 물약' },
      { key: 'potMp', label: '2', icon: '🔵', title: '마나 물약' },
    ]) {
      const d = cell(p.label, p.icon, '', p.title, 'skill belt');
      (belt || row).appendChild(d);
      this.skillEls[p.key] = d;
    }
    for (const label of ['3', '4'])
      (belt || row).appendChild(cell(label, '', '', '', 'skill belt slot-empty'));
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
    // hidden 속성 **하나만** 믿지 않는다. CSS 가 display 를 명시하면 hidden 은
    // 무시되고, 전면을 덮는 창이 클릭을 통째로 삼킨다 — 실제로 겪었다.
    // 인라인 style 은 스타일시트를 이기므로 CSS 가 낡아 있어도 안전하다.
    if (!shop) { el.hidden = true; el.style.display = 'none'; return; }
    el.hidden = false;
    el.style.display = '';
    this.renderShop();
  }

  renderShop() {
    const shop = this.shop;
    if (!shop) return;
    const p = this.G.player;
    this.el.shopCoin.textContent = `◈ ${p.coin}`;

    // ── 재고 ──
    const body = this.el.shopList;
    body.innerHTML = '';
    shop.stock.forEach((s, i) => {
      const row = this._srow(s.icon, s.sold ? '— 팔림 —' : s.name, s.price,
        s.item && s.item.rarity != null ? RARITIES[s.item.rarity] : null,
        { sold: s.sold, poor: p.coin < s.price });
      if (!s.sold) {
        if (s.item && s.item.slot) this._hover(row, s.item);
        row.onclick = () => {
          const r = shop.buy(this.G, i);
          if (!r.ok) return this.toast(r.why, '#e07272');
          this.toast(`${s.name} 구입`, '#d8b45e');
          this.renderShop();
        };
      }
      body.appendChild(row);
    });

    // ── 갬블 ──
    // 부위만 보이고 등급은 사고 나서야 안다. 그게 갬블이다.
    const gb = this.el.gambleList;
    if (gb) {
      gb.innerHTML = '';
      shop.gamble.forEach((g, i) => {
        const row = this._srow(g.icon, g.name, g.price, null, { poor: p.coin < g.price });
        row.classList.add('gam');
        row.onclick = () => {
          const r = shop.gambleBuy(this.G, i);
          if (!r.ok) return this.toast(r.why, '#e07272');
          const rr = RARITIES[r.item.rarity];
          this.toast(`${r.item.name}`, rr.css);
          // 등급이 높으면 화면에도 알린다 — 목록만 바뀌면 뭘 뽑았는지 놓친다
          if (r.item.rarity >= 2) {
            this.center(r.item.name, `${rr.name} ${r.item.baseName}`);
            this.G.fx?.burst(this.G.player.center(), {
              count: 30, color: rr.hex, speed: 5, size: 0.5, life: 0.9, grav: -2,
            });
          }
          this.renderShop();
        };
        gb.appendChild(row);
      });
    }

    // ── 팔기 ──
    // 갬블을 넣으면 조각이 금방 마른다. 팔 곳이 없으면 갬블이 한 번 쓰고 끝나는
    // 버튼이 된다 — 안 쓰는 장비를 조각으로 바꾸는 출구가 같이 있어야 돈다.
    const sl = this.el.sellList;
    if (sl) {
      sl.innerHTML = '';
      const bag = p.bag.filter((it) => it.slot && it.kind !== 'lantern');
      if (!bag.length) {
        sl.innerHTML = '<p class="shopline">팔 물건이 없다.</p>';
      } else {
        for (const it of bag) {
          const got = Math.max(1, Math.round(priceOf(it) * SELL_MULT));
          const row = this._srow(it.icon, it.name, got, RARITIES[it.rarity], {});
          row.classList.add('sell');
          this._hover(row, it);
          row.onclick = () => {
            const r = shop.sell(this.G, it);
            if (!r.ok) return;
            this.toast(`${it.name} 판매 ◈ +${r.got}`, '#d8b45e');
            this.G.inv._hideTooltip();
            this.renderShop();
          };
          sl.appendChild(row);
        }
      }
    }
  }

  /** 상점 줄 하나 — 재고·갬블·팔기가 같은 모양을 쓴다 */
  _srow(icon, name, price, rar, { sold = false, poor = false } = {}) {
    const row = document.createElement('div');
    row.className = 'srow' + (sold ? ' sold' : '') + (poor ? ' poor' : '');
    row.innerHTML = `<span class="si">${icon}</span>`
      + `<span class="sn"${rar ? ` style="color:${rar.css}"` : ''}>${name}</span>`
      + `<span class="sp">◈ ${price}</span>`;
    return row;
  }

  /**
   * 커서가 가리킨 적의 이름을 머리 위에 띄운다.
   *
   * 3D 스프라이트가 아니라 DOM 이다. 이름은 화면 픽셀에 딱 맞아야 읽히는데,
   * 스프라이트는 원근에 따라 크기가 변하고 안개·블룸에도 먹힌다.
   * 위치만 3D 에서 가져와 투영한다.
   */
  _hoverName(G) {
    const el = this.el.enemyName;
    if (!el) return;
    const e = G.hover;
    if (!e || e.dead || G.state !== 'play') {
      if (!el.hidden) { el.hidden = true; el.style.display = 'none'; }
      return;
    }
    const v = e.center();
    V.set(v.x, (e.headY ?? 1.6) + 0.75, v.z).project(G.camera);
    // 카메라 뒤로 넘어가면 투영이 뒤집혀 엉뚱한 데 붙는다
    if (V.z > 1) { el.hidden = true; el.style.display = 'none'; return; }
    const c = G.renderer.domElement;
    el.style.left = ((V.x * 0.5 + 0.5) * c.clientWidth).toFixed(0) + 'px';
    el.style.top = ((-V.y * 0.5 + 0.5) * c.clientHeight).toFixed(0) + 'px';
    const cls = e.isBoss ? 'boss' : e.elite ? 'elite' : '';
    if (el.className !== cls) el.className = cls;
    // 레벨 숫자는 안 쓴다 — 이 게임에 적 레벨 개념이 없으므로 지어내면 거짓말이다.
    // 대신 「정예/보스」를 붙인다. 그건 실제로 규칙이 다른 구분이다.
    const tag = e.isBoss ? '보스' : e.elite ? '정예' : '';
    const label = (e.displayName || e.def.name) + (tag ? `<span class="lv">${tag}</span>` : '');
    if (el.innerHTML !== label) el.innerHTML = label;
    el.hidden = false;
    el.style.display = '';
  }

  _hover(row, item) {
    const same = this.G.player.equipped[item.slot];
    row.onmouseenter = () => this.G.inv._showTooltip(item, same);
    row.onmouseleave = () => this.G.inv._hideTooltip();
  }

  _shopTip(item, same) { this.G.inv._showTooltip(item, same); }

  update(dt) {
    const G = this.G, p = G.player;
    if (!p) return;

    this._hoverName(G);

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

  /**
   * 층별 「밟아 본 칸」 기록. 층이 바뀌면(=다른 던전 객체) 새로 만든다 —
   * 층을 넘어가며 지도가 남으면 안개가 한 판만 유효한 장치가 된다.
   */
  _seenFor(dg) {
    if (this._seenDg !== dg) {
      this._seenDg = dg;
      this._seen = new Uint8Array(dg.w * dg.h);
    }
    return this._seen;
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

    // ── 안개 — 지나온 길만 남는다 ──────────────────────────
    //
    // 층 전체 지도를 처음부터 보여 주면 미니맵이 「가 볼 곳」을 알려주는 정찰
    // 도구가 된다. 그러면 어둠 속을 더듬는다는 설계가 통째로 무너진다.
    // 걸어서 밝힌 칸만 남기고, 그 기록은 층마다 새로 시작한다.
    //
    // 밝히는 반경은 **랜턴 반경**이다. 여기서도 빛이 곧 정보다 —
    // 좋은 랜턴을 들면 지도가 더 빨리 채워진다.
    const seen = this._seenFor(dg);
    const lampR = (G.lighting ? G.lighting.lamp.radius : 9) / 2;   // 칸 단위
    const R = Math.ceil(lampR);
    for (let dz = -R; dz <= R; dz++)
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dz * dz > lampR * lampR) continue;
        const gx = pgx + dx, gz = pgz + dz;
        if (gx < 0 || gz < 0 || gx >= dg.w || gz >= dg.h) continue;
        seen[gz * dg.w + gx] = 1;
      }

    for (let z = z0; z < z1; z++)
      for (let x = x0; x < x1; x++) {
        if (!seen[z * dg.w + x]) continue;
        const v = dg.at(x, z);
        if (v !== FLOOR && v !== 3) continue;      // 3 = DOOR (열리면 지나다닌다)
        ctx.fillStyle = v === 3 ? '#6a5236' : '#3b3448';
        ctx.fillRect(ox + x * scale, oz + z * scale, scale + 0.6, scale + 0.6);
      }

    // 출구 — **밟아 본 곳일 때만.** 안 가 본 출구를 찍어 주면 안개가 무의미해진다
    if (G.level && G.level.exitOpen && seen[dg.exit.gz * dg.w + dg.exit.gx]) {
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
