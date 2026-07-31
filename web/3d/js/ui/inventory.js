// 인벤토리 — 장비 3칸 + 가방 그리드. 호버 시 착용 중인 장비와 비교해서 보여준다.

import { RARITIES, tooltipHtml, power } from '../game/items.js';

const $ = (s) => document.querySelector(s);

export class Inventory {
  constructor(G) {
    this.G = G;
    this.root = $('#inv');
    this.bag = $('#bagGrid');
    this.statList = $('#statList');
    this.bagCount = $('#bagCount');
    this.tooltip = $('#tooltip');
    this.open = false;

    this.root.addEventListener('mousemove', (e) => this._moveTooltip(e));
    this.root.addEventListener('mouseleave', () => this._hideTooltip());
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.open) this.toggle(false);
    });
  }

  toggle(force) {
    this.open = force == null ? !this.open : force;
    this.root.hidden = !this.open;
    if (this.open) this.render();
    else this._hideTooltip();
  }

  _cellHtml(item) {
    if (!item) return '';
    return `<span style="color:${RARITIES[item.rarity].css}">${item.icon}</span>`;
  }

  render() {
    const p = this.G.player;

    // 장비 슬롯
    for (const slot of ['weapon', 'armor', 'ring']) {
      const cell = this.root.querySelector(`.slot[data-slot="${slot}"] .cell`);
      const item = p.equipped[slot];
      cell.innerHTML = this._cellHtml(item);
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
    const cells = Math.max(p.bagMax, p.bag.length);
    for (let i = 0; i < cells; i++) {
      const item = p.bag[i];
      const d = document.createElement('div');
      d.className = 'cell' + (item ? '' : ' empty');
      d.innerHTML = this._cellHtml(item);
      if (item) {
        d.title = '클릭해서 장착';
        d.onmouseenter = () => this._showTooltip(item, p.equipped[item.slot]);
        d.onmouseleave = () => this._hideTooltip();
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
    this.statList.innerHTML = rows.map(([k, v]) => `${k} <span>${v}</span>`).join('<br>');
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
