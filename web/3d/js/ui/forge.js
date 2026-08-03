// ══════════════════════════════════════════════════════════════════════════
//  대장간 창 — 강화 · 재련 (game/craft.js · craft-table.js)
//
//  ★ 왜 상시 창인가
//    상점 안에 두면 상점을 못 찾은 층에서는 못 하고, 그러면 「돌 이유」가
//    층 운에 걸린다. 이 게임에서 **끝이 없는 소모처는 여기 하나뿐**이라
//    (docs/GRIND.md §4-1) 언제나 열려 있어야 한다.
//
//  ★ 왜 착용 중인 장비만 두드리나
//    가방 마흔 칸까지 대상이면 「무엇을 키울까」가 목록 고르기가 된다.
//    키우는 것은 **지금 쓰는 여덟 개**다. 더 좋은 걸 주우면 갈아 끼우고
//    그때부터 그걸 키운다 — 그 갈아타는 순간이 이 게임의 결정이다.
// ══════════════════════════════════════════════════════════════════════════

import { SLOTS, SLOT_NAME, RARITIES, displayName, affixLine, shown } from '../game/items.js';
import { enhance, enhanceInfo, reforge, reforgeInfo } from '../game/craft.js';
import { plusMult } from '../game/craft-table.js';
import { iconHTML } from '../core/assets.js';
import { makeRng } from '../core/rng.js';
import { Sfx } from '../core/audio.js';

export class Forge {
  constructor(G) {
    this.G = G;
    this.sel = 'weapon';
    this.seq = 0;                       // 굴림마다 달라지는 씨앗 — 같은 결과 반복 방지
    const $ = (q) => document.querySelector(q);
    this.el = {
      root: $('#forge'), scrap: $('#forgeScrap'),
      slots: $('#forgeSlots'), body: $('#forgeBody'), close: $('#forgeClose'),
    };
    this.el.close?.addEventListener('click', () => this.toggle(false));
  }

  get open() { return !!this.el.root && !this.el.root.hidden; }

  toggle(on = !this.open) {
    if (!this.el.root) return;
    // hidden 만 믿지 않는다 — CSS 가 display 를 명시하면 무시된다 (상점에서 겪었다)
    if (!on) { this.el.root.hidden = true; this.el.root.style.display = 'none'; return; }
    this.el.root.hidden = false; this.el.root.style.display = '';
    this.render();
  }

  /** 이 굴림 전용 난수. 창을 열 때마다 씨앗이 달라야 「다시 눌러 보기」가 안 된다 */
  _rng(tag) { return makeRng(`forge-${this.G.seed}-${this.seq++}-${tag}`); }

  render() {
    if (!this.open) return;
    const G = this.G, p = G.player;
    if (!p) return;
    this.el.scrap.textContent = `잔해 ${p.scrap | 0} · 영혼 조각 ◈ ${p.coin | 0}`;

    // ── 착용 칸 여덟 ──
    this.el.slots.innerHTML = '';
    for (const slot of SLOTS) {
      const it = p.equipped[slot];
      const d = document.createElement('button');
      d.type = 'button';
      d.className = `fslot${slot === this.sel ? ' on' : ''}${it ? '' : ' empty'}`;
      d.title = it ? displayName(it) : `${SLOT_NAME[slot]} — 비었다`;
      d.innerHTML = `<i>${it ? iconHTML(it.icon) : ''}</i>`
        + `<span>${SLOT_NAME[slot]}</span>`
        + (it?.plus ? `<em>+${it.plus}</em>` : '');
      d.onclick = () => { this.sel = slot; this.render(); };
      this.el.slots.appendChild(d);
    }

    const item = p.equipped[this.sel];
    const body = this.el.body;
    body.innerHTML = '';
    if (!item) {
      body.innerHTML = `<p class="fnone">${SLOT_NAME[this.sel]} 칸이 비었다. 장비를 끼면 두드릴 수 있다.</p>`;
      return;
    }

    const r = RARITIES[item.rarity];
    const inf = enhanceInfo(item, G.tier);
    const sh = shown(item);

    const head = document.createElement('div');
    head.className = 'fhead';
    head.innerHTML = `<b style="color:${r.css}">${displayName(item)}</b>`
      + (item.slot === 'weapon'
        ? `<span>피해 ${sh.dmgMin}–${sh.dmgMax}</span>`
        : `<span>방어도 ${sh.stat('armor')}</span>`)
      + `<span class="fmul">강화 배수 ×${plusMult(item.plus).toFixed(2)}</span>`;
    body.appendChild(head);

    // ── 강화 ──
    const en = document.createElement('div');
    en.className = 'fbox';
    if (inf.maxed) {
      en.innerHTML = `<h4>강화 +${inf.plus}</h4>`
        + `<p class="fnone">이 회차의 상한(+${inf.cap})에 닿았다. <b>회차를 넘기면 상한이 +3 오른다.</b></p>`;
    } else {
      const can = (p.scrap | 0) >= inf.cost;
      en.innerHTML = `<h4>강화 +${inf.plus} → +${inf.plus + 1} <small>(상한 +${inf.cap})</small></h4>`
        + `<p>잔해 <b class="${can ? '' : 'poor'}">${inf.cost}</b>`
        + ` · 성공 확률 <b>${Math.round(inf.chance * 100)}%</b>`
        + ` · 성공하면 수치 <b>+4%</b></p>`;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'fbtn';
      b.textContent = '두드린다';
      b.disabled = !can;
      b.onclick = () => {
        const res = enhance(p, item, this._rng('enh'), G.tier);
        if (!res.ok) { G.ui.toast(res.why, '#e07272'); return; }
        p.recompute();
        if (res.success) {
          G.ui.toast(`강화 성공 — +${res.plus}`, '#7fc47a');
          Sfx.levelUp?.();
        } else {
          G.ui.toast(`강화 실패 — 잔해 ${res.spent} 을 잃었다 (장비는 그대로다)`, '#c8a24a');
        }
        this.render();
        G.inv?.render?.();
      };
      en.appendChild(b);
    }
    body.appendChild(en);

    // ── 재련 ──
    const rf = document.createElement('div');
    rf.className = 'fbox';
    const cost = reforgeInfo(item);
    rf.innerHTML = `<h4>재련 — 접사 하나만 다시 굴린다</h4>`
      + `<p>한 번에 잔해 <b>${cost.scrap}</b> · 조각 <b>◈ ${cost.coin}</b>. `
      + `<b>바꿀 접사를 직접 고른다</b> — 좋은 걸 날릴 걱정 없이 나쁜 것만 굴린다.</p>`;
    if (!item.affixes?.length) {
      rf.innerHTML += '<p class="fnone">이 장비에는 접사가 없다 (일반 등급).</p>';
    } else {
      const list = document.createElement('div');
      list.className = 'faff';
      item.affixes.forEach((a, i) => {
        const row = document.createElement('div');
        row.innerHTML = `<span>${affixLine(sh.affix(a))}</span>`;
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'fbtn small';
        b.textContent = '다시 굴린다';
        b.disabled = (p.scrap | 0) < cost.scrap || (p.coin | 0) < cost.coin;
        b.onclick = () => {
          const res = reforge(p, item, i, this._rng('rf'), G.floorNo, G.tier);
          if (!res.ok) { G.ui.toast(res.why, '#e07272'); return; }
          p.recompute();
          G.ui.toast(`재련 — ${affixLine(res.before)} → ${affixLine(res.after)}`, '#9fd0ff');
          this.render();
          G.inv?.render?.();
        };
        row.appendChild(b);
        list.appendChild(row);
      });
      rf.appendChild(list);
    }
    body.appendChild(rf);
  }
}
