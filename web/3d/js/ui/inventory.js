// 인벤토리 — 종이인형 배치 + 가방 격자. 호버 시 착용 중인 장비와 비교해서 보여준다.
//
// 배치 근거: 디아블로 계열의 종이인형은 「어디에 걸치는가」가 위치로 읽힌다.
// 왼쪽은 손에 든 것, 가운데는 몸에 걸친 것, 오른쪽은 곁들이는 것.
// 지금 슬롯은 셋뿐이지만 배치가 그 규칙을 따르므로, 투구·장갑이 늘어도
// 각 열에 한 칸씩 얹으면 된다 (docs/ITEM-ECONOMY.md §3-1).

import { RARITIES, tooltipHtml, power } from '../game/items.js';

const SLOTS = ['weapon', 'armor', 'ring'];

// 정렬 순서 — 같은 부위끼리 모으고, 그 안에서 좋은 것이 앞에 온다.
// 「좋은 것」은 등급이 아니라 power() 다. 고급 무기가 희귀 반지보다 나을 수 있다.
const SLOT_ORDER = { weapon: 0, armor: 1, ring: 2 };

const $ = (s) => document.querySelector(s);

export class Inventory {
  constructor(G) {
    this.G = G;
    this.root = $('#inv');
    this.bag = $('#bagGrid');
    this.statList = $('#statList');
    this.bagCount = $('#bagCount');
    this.tooltip = $('#tooltip');
    this.lantern = $('#invLantern');
    this.open = false;

    const close = $('#invClose');
    if (close) close.addEventListener('click', () => this.toggle(false));

    const sort = $('#bagSort');
    if (sort) sort.addEventListener('click', () => this.sort());

    // 가방 안에서는 브라우저 기본 메뉴가 뜨면 안 된다 — 우클릭이 「버리기」다
    this.bag.addEventListener('contextmenu', (e) => e.preventDefault());

    this.root.addEventListener('mousemove', (e) => this._moveTooltip(e));
    this.root.addEventListener('mouseleave', () => this._hideTooltip());
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.open) this.toggle(false);
    });
  }

  /** 부위별로 모으고 그 안에서 좋은 것부터 */
  sort() {
    const p = this.G.player;
    p.bag.sort((a, b) => {
      const s = (SLOT_ORDER[a.slot] ?? 9) - (SLOT_ORDER[b.slot] ?? 9);
      if (s) return s;
      const r = b.rarity - a.rarity;
      if (r) return r;
      return power(b) - power(a);
    });
    this.render();
    this.G.ui.toast('가방 정렬', '#cbbd9f');
  }

  /** 바닥에 버린다 — 발밑에 떨어뜨리므로 마음이 바뀌면 다시 주우면 된다 */
  drop(item) {
    const p = this.G.player;
    const i = p.bag.indexOf(item);
    if (i < 0) return;
    p.bag.splice(i, 1);
    if (this.G.dropItem) this.G.dropItem(item, p.pos, 0);
    this.G.ui.toast(`${item.name} 버림`, '#9b9078');
    this.render();
    this._hideTooltip();
  }

  toggle(force) {
    this.open = force == null ? !this.open : force;
    this.root.hidden = !this.open;
    if (this.open) this.render();
    else this._hideTooltip();
  }

  /** 칸 하나를 채운다. 등급 색을 테두리에도 물려야 격자에서 한눈에 읽힌다. */
  _fill(cell, item) {
    if (!item) {
      cell.innerHTML = '';
      cell.classList.remove('filled');
      cell.style.removeProperty('--rc');
      return;
    }
    const r = RARITIES[item.rarity];
    cell.innerHTML = `<span style="color:${r.css}">${item.icon}</span>`;
    cell.classList.add('filled');
    cell.style.setProperty('--rc', r.css);
  }

  render() {
    const p = this.G.player;

    // 장비 슬롯
    for (const slot of SLOTS) {
      const el = this.root.querySelector(`.slot[data-slot="${slot}"] .cell`);
      if (!el) continue;
      const cell = el;
      const item = p.equipped[slot];
      this._fill(cell, item);
      cell.onmouseenter = () => item && this._showTooltip(item, null);
      cell.onmouseleave = () => this._hideTooltip();
      cell.onclick = () => {
        if (!item) return;
        p.equipped[slot] = null;
        p.bag.push(item);
        p.recompute();
        this.render();
      };
    }

    // 가방
    this.bag.innerHTML = '';
    this.bagCount.textContent = `${p.bag.length} / ${p.bagMax}`;
    // 꽉 찬 것이 눈에 보여야 한다. 토스트는 지나가면 사라지고,
    // 그러면 「왜 안 주워지지」로 남는다.
    const head = this.bagCount.parentElement;
    if (head) head.classList.toggle('full', p.bag.length >= p.bagMax);
    const cells = Math.max(p.bagMax, p.bag.length);
    for (let i = 0; i < cells; i++) {
      const item = p.bag[i];
      const d = document.createElement('div');
      d.className = 'cell' + (item ? '' : ' empty');
      this._fill(d, item);
      if (item) {
        d.title = '좌클릭 장착 · 우클릭 버리기';
        d.onmouseenter = () => this._showTooltip(item, p.equipped[item.slot]);
        d.onmouseleave = () => this._hideTooltip();
        d.oncontextmenu = (e) => { e.preventDefault(); this.drop(item); };
        d.onclick = () => {
          const gain = power(item) - power(p.equipped[item.slot]);
          p.equip(item);
          this.G.ui.toast(`${item.name} 장착 ${gain >= 0 ? '▲ +' : '▼ '}${gain}`, RARITIES[item.rarity].css);
          this.render();
          this._hideTooltip();
        };
      }
      this.bag.appendChild(d);
    }

    this._renderStats();
    this._renderLantern();
  }

  /** 랜턴은 장비가 아니라 들고 다니는 것 — 연료가 보여야 판단이 된다 */
  _renderLantern() {
    if (!this.lantern) return;
    const l = this.G.player.lantern;
    if (!l) {
      this.lantern.innerHTML = '<b>맨손</b><br>기본 등불만';
      return;
    }
    const pct = Math.max(0, Math.min(1, l.fuel / l.fuelMax));
    this.lantern.innerHTML = `<b>${l.name}</b><br>연료 ${Math.round(l.fuel)}초`
      + `<span class="fuel"><i style="width:${(pct * 100).toFixed(1)}%"></i></span>`;
  }

  _renderStats() {
    const p = this.G.player;
    const rows = [
      ['피해', `${Math.round(p.dmgMin)} – ${Math.round(p.dmgMax)}`],
      ['공격 속도', `${p.attackSpeed.toFixed(2)} /초`],
      ['치명타', `${p.critChance.toFixed(1)}% · ×${p.critMult.toFixed(2)}`],
      ['방어도', Math.round(p.armor)],
      ['최대 체력', p.maxHp],
      ['최대 마나', p.maxMp],
      ['이동 속도', p.speed.toFixed(1)],
      ['재사용 감소', `${(p.cdr * 100).toFixed(0)}%`],
      ['타격 시 회복', p.leech || 0],
    ];
    // 두 열로 나눠 담는다 — 한 줄씩 세로로 쌓으면 창이 길어져 가방이 밀린다
    this.statList.innerHTML = rows.map(([k, v]) => `<div>${k} <span>${v}</span></div>`).join('');
  }

  _showTooltip(item, equippedSame) {
    this.tooltip.innerHTML = tooltipHtml(item, equippedSame);
    this.tooltip.hidden = false;
  }
  _hideTooltip() { this.tooltip.hidden = true; }
  _moveTooltip(e) {
    if (this.tooltip.hidden) return;
    const w = 250, h = this.tooltip.offsetHeight;
    let x = e.clientX + 16, y = e.clientY + 14;
    if (x + w > window.innerWidth) x = e.clientX - w - 12;
    if (y + h > window.innerHeight) y = window.innerHeight - h - 8;
    this.tooltip.style.left = x + 'px';
    this.tooltip.style.top = y + 'px';
  }
}
