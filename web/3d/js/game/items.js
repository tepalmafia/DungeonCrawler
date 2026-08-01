// 아이템 — 등급 · 접사 롤 · 바닥 드랍 · 장착 스탯 합산.
// 데이터 주도: 새 접사를 AFFIXES 에 한 줄 추가하면 그대로 굴러간다.

import * as THREE from 'three';
import { softDot, beamTexture } from '../core/textures.js';

export const RARITIES = [
  { key: 'common', name: '일반',  css: '#b8b8b8', hex: 0xb8b8b8, affixes: 1, mult: 1.00 },
  { key: 'magic',  name: '마법',  css: '#6f9fff', hex: 0x6f9fff, affixes: 2, mult: 1.18 },
  { key: 'rare',   name: '희귀',  css: '#ffd84d', hex: 0xffd84d, affixes: 3, mult: 1.40 },
  { key: 'legend', name: '전설',  css: '#ff8a2b', hex: 0xff8a2b, affixes: 4, mult: 1.75 },
];

const BASES = {
  weapon: [
    { name: '녹슨 검',     icon: '🗡', dmg: [6, 11],  spd: 1.00 },
    { name: '강철 도끼',   icon: '🪓', dmg: [9, 16],  spd: 0.86 },
    { name: '사슬 철퇴',   icon: '🔨', dmg: [11, 19], spd: 0.76 },
    { name: '흑요석 대검', icon: '⚔', dmg: [14, 24], spd: 0.68 },
    { name: '단검',        icon: '🔪', dmg: [4, 8],   spd: 1.42 },
  ],
  armor: [
    { name: '가죽 갑옷', icon: '🎽', armor: [3, 6] },
    { name: '사슬 갑옷', icon: '🥋', armor: [6, 11] },
    { name: '판금 갑옷', icon: '🛡', armor: [10, 17] },
  ],
  ring: [
    { name: '구리 반지',   icon: '💍', armor: [0, 1] },
    { name: '흑철 반지',   icon: '💍', armor: [1, 3] },
    { name: '영혼 인장',   icon: '🔮', armor: [1, 2] },
  ],
};

const PREFIX = ['잔혹한', '고대의', '피에 젖은', '심연의', '불타는', '서리 낀', '왕관의', '망자의', '별빛의'];
const SUFFIX = ['학살', '수호', '탐욕', '광기', '침묵', '여명', '재앙'];

/** 접사 — roll(rnd, s) 은 배율 s(층·등급 보정) 를 받아 값을 굴린다 */
const AFFIXES = [
  { key: 'dmg',   label: '피해',            fmt: (v) => `+${v} 피해`,            roll: (r, s) => Math.round(r.range(2, 6) * s) },
  { key: 'hp',    label: '최대 체력',       fmt: (v) => `+${v} 최대 체력`,       roll: (r, s) => Math.round(r.range(9, 22) * s) },
  { key: 'armor', label: '방어도',          fmt: (v) => `+${v} 방어도`,          roll: (r, s) => Math.round(r.range(2, 5) * s) },
  { key: 'crit',  label: '치명타 확률',     fmt: (v) => `+${v}% 치명타 확률`,    roll: (r, s) => +(r.range(2, 5.5) * Math.min(2, s)).toFixed(1) },
  { key: 'cdmg',  label: '치명타 피해',     fmt: (v) => `+${v}% 치명타 피해`,    roll: (r, s) => Math.round(r.range(8, 20) * Math.min(2, s)) },
  { key: 'speed', label: '이동 속도',       fmt: (v) => `+${v}% 이동 속도`,      roll: (r, s) => +(r.range(2.5, 6) * Math.min(1.6, s)).toFixed(1) },
  { key: 'aspd',  label: '공격 속도',       fmt: (v) => `+${v}% 공격 속도`,      roll: (r, s) => +(r.range(3, 8) * Math.min(1.6, s)).toFixed(1) },
  { key: 'leech', label: '타격 시 회복',    fmt: (v) => `타격 시 ${v} 회복`,     roll: (r, s) => Math.round(r.range(1, 3) * s) },
  { key: 'mp',    label: '최대 마나',       fmt: (v) => `+${v} 최대 마나`,       roll: (r, s) => Math.round(r.range(6, 14) * s) },
  { key: 'cdr',   label: '재사용 대기시간', fmt: (v) => `-${v}% 재사용 대기시간`, roll: (r, s) => +(r.range(3, 7) * Math.min(1.5, s)).toFixed(1) },
];
const AFFIX_BY_KEY = Object.fromEntries(AFFIXES.map((a) => [a.key, a]));

let uid = 1;

/**
 * 아이템 하나를 굴린다.
 * @param rnd     시드 RNG
 * @param floorNo 층 (값 스케일)
 * @param tier    파밍 티어 (반복 회차 — 높을수록 등급이 잘 뜬다)
 * @param opt     { slot, minRarity }
 */
export function rollItem(rnd, floorNo, tier = 0, opt = {}) {
  const slot = opt.slot || rnd.pick(['weapon', 'weapon', 'armor', 'ring']);
  const base = rnd.pick(BASES[slot]);

  // 등급 — 층·티어가 오를수록 위로 밀린다
  let ri = 0;
  const luck = rnd() + tier * 0.09 + floorNo * 0.035;
  if (luck > 1.42) ri = 3; else if (luck > 1.12) ri = 2; else if (luck > 0.72) ri = 1;
  if (opt.minRarity != null) ri = Math.max(ri, opt.minRarity);
  const rarity = RARITIES[ri];

  const scale = (1 + (floorNo - 1) * 0.42 + tier * 0.3) * rarity.mult;

  const item = {
    id: uid++,
    slot, icon: base.icon,
    rarity: ri,
    ilvl: floorNo + tier,
    stats: {},
    affixes: [],
  };

  if (slot === 'weapon') {
    item.dmgMin = Math.max(1, Math.round(base.dmg[0] * scale));
    item.dmgMax = Math.max(item.dmgMin + 1, Math.round(base.dmg[1] * scale));
    item.aspd = base.spd;
    item.baseName = base.name;
  } else {
    item.stats.armor = Math.round(rnd.int(base.armor[0], base.armor[1]) * scale);
    item.baseName = base.name;
  }

  // 접사
  const pool = AFFIXES.filter((a) => !(slot === 'weapon' && a.key === 'armor'));
  rnd.shuffle(pool);
  for (let i = 0; i < rarity.affixes && i < pool.length; i++) {
    const a = pool[i];
    const v = a.roll(rnd, scale);
    if (!v) continue;
    item.affixes.push({ key: a.key, value: v });
    item.stats[a.key] = (item.stats[a.key] || 0) + v;
  }

  // 이름
  item.name = ri === 0 ? base.name
    : ri === 1 ? `${rnd.pick(PREFIX)} ${base.name}`
      : `${rnd.pick(PREFIX)} ${base.name}의 ${rnd.pick(SUFFIX)}`;

  return item;
}

/** 장비 3칸을 합산해 최종 보너스를 만든다 */
export function aggregate(equipped) {
  const s = { dmg: 0, hp: 0, armor: 0, crit: 0, cdmg: 0, speed: 0, aspd: 0, leech: 0, mp: 0, cdr: 0 };
  let dmgMin = 2, dmgMax = 4, wSpd = 1;
  for (const it of Object.values(equipped)) {
    if (!it) continue;
    for (const [k, v] of Object.entries(it.stats)) s[k] = (s[k] || 0) + v;
    if (it.slot === 'weapon') { dmgMin = it.dmgMin; dmgMax = it.dmgMax; wSpd = it.aspd; }
  }
  return { ...s, dmgMin, dmgMax, weaponSpeed: wSpd };
}

/** 대략적인 강함 — 비교 화살표용 */
export function power(item) {
  if (!item) return 0;
  let p = 0;
  if (item.slot === 'weapon') p += (item.dmgMin + item.dmgMax) * 0.5 * (item.aspd || 1) * 3;
  const w = { dmg: 3, hp: 0.5, armor: 1.6, crit: 3.2, cdmg: 0.7, speed: 2.4, aspd: 2.6, leech: 3.4, mp: 0.35, cdr: 2.8 };
  for (const [k, v] of Object.entries(item.stats)) p += (w[k] || 1) * v;
  return Math.round(p);
}

export function affixLine(a) { return AFFIX_BY_KEY[a.key].fmt(a.value); }

/** 툴팁 HTML (비교 포함) */
export function tooltipHtml(item, equippedSame) {
  const r = RARITIES[item.rarity];
  const kind = { weapon: '무기', armor: '방어구', ring: '반지' }[item.slot];
  let h = `<div class="tname" style="color:${r.css}">${item.name}</div>`;
  h += `<div class="tkind">${r.name} ${kind} · 아이템 레벨 ${item.ilvl}</div>`;
  if (item.slot === 'weapon')
    h += `<div>피해 <b>${item.dmgMin}–${item.dmgMax}</b> · 속도 ${item.aspd.toFixed(2)}</div>`;
  if (item.stats.armor && item.slot !== 'weapon')
    h += `<div>방어도 <b>${item.stats.armor}</b></div>`;
  for (const a of item.affixes) h += `<div class="taff">${affixLine(a)}</div>`;

  if (equippedSame && equippedSame.id !== item.id) {
    const d = power(item) - power(equippedSame);
    const cls = d > 0 ? 'up' : d < 0 ? 'dn' : '';
    h += `<div class="tcmp">착용 중: ${equippedSame.name}<br>`
      + `종합 <span class="${cls}">${d > 0 ? '▲ +' : d < 0 ? '▼ ' : ''}${d}</span></div>`;
  }
  return h;
}

// ─────────────────────── 바닥 드랍 ───────────────────────
const ITEM_GEO = {
  weapon: new THREE.BoxGeometry(0.13, 0.9, 0.13),
  armor: new THREE.BoxGeometry(0.5, 0.55, 0.22),
  ring: new THREE.TorusGeometry(0.22, 0.07, 6, 14),
  lantern: new THREE.CylinderGeometry(0.16, 0.2, 0.42, 6),
};

function labelTexture(text, css) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.font = '40px Galmuri11, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(4,3,8,.8)';
  const w = Math.min(500, ctx.measureText(text).width + 34);
  ctx.fillRect((512 - w) / 2, 20, w, 56);
  ctx.strokeStyle = css;
  ctx.lineWidth = 2;
  ctx.strokeRect((512 - w) / 2, 20, w, 56);
  ctx.fillStyle = css;
  ctx.fillText(text, 256, 49);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Drop {
  constructor(scene, item, pos) {
    this.item = item;
    this.pos = pos.clone();
    this.t = Math.random() * 6;
    const r = RARITIES[item.rarity];

    this.group = new THREE.Group();
    this.group.position.copy(pos);

    const mat = new THREE.MeshStandardMaterial({
      color: r.hex, emissive: r.hex, emissiveIntensity: 0.55,
      roughness: 0.4, metalness: 0.6,
    });
    this.mesh = new THREE.Mesh(ITEM_GEO[item.slot], mat);
    this.mesh.position.y = 0.55;
    this.mesh.rotation.z = 0.4;
    this.group.add(this.mesh);
    this.mat = mat;

    // ── 등급이 멀리서도 읽혀야 한다 ────────────────────────
    // 어두운 던전에서 바닥의 물건은 「빛기둥의 크기」로 먼저 판별된다.
    // 등급 사이 차이를 선형으로 두면 전설이 희귀와 구분이 안 간다 — 벌린다.
    const R = item.rarity;
    const beam = new THREE.Sprite(new THREE.SpriteMaterial({
      map: beamTexture(), color: r.hex, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: [0.34, 0.5, 0.72, 0.95][R],
    }));
    beam.scale.set([0.9, 1.15, 1.5, 1.95][R], [2.2, 2.9, 4.0, 5.4][R], 1);
    beam.position.y = [1.1, 1.4, 1.9, 2.5][R];
    this.group.add(beam);
    this.beam = beam;

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softDot(), color: r.hex, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: 0.5,
    }));
    glow.scale.setScalar([1.2, 1.6, 2.2, 3.0][R]);
    glow.position.y = 0.1;
    this.group.add(glow);
    this.glow = glow;

    // 희귀 이상은 바닥에 도는 고리가 하나 더 붙는다 — 빛기둥만으로는
    // 벽 너머에서 안 보이는데, 바닥 고리는 위에서 내려다보는 각도에 잘 걸린다.
    if (R >= 2) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.62 + (R - 2) * 0.22, 24),
        new THREE.MeshBasicMaterial({
          color: r.hex, transparent: true, opacity: 0.5,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      this.group.add(ring);
      this.ring = ring;
    }

    // 전설은 주위를 도는 불티까지 — 여기까지 오면 「특별한 게 떨어졌다」가
    // 소리를 듣지 않아도 눈으로 전달된다.
    if (R >= 3) {
      this.motes = [];
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Sprite(new THREE.SpriteMaterial({
          map: softDot(), color: r.hex, blending: THREE.AdditiveBlending,
          depthWrite: false, transparent: true, opacity: 0.85,
        }));
        m.scale.setScalar(0.3);
        m.userData.phase = (i / 5) * Math.PI * 2;
        this.group.add(m);
        this.motes.push(m);
      }
    }

    this.labelTex = labelTexture(item.name, r.css);
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.labelTex, depthTest: false, transparent: true,
    }));
    this.label.scale.set(3.2, 0.6, 1);
    this.label.position.y = 1.55;
    this.label.renderOrder = 18;
    this.label.visible = false;
    this.group.add(this.label);

    scene.add(this.group);
    this.scene = scene;
  }

  update(t, dt, showLabel) {
    this.t += dt;
    this.mesh.rotation.y += dt * 1.6;
    this.mesh.position.y = 0.55 + Math.sin(this.t * 2.2) * 0.09;
    this.glow.material.opacity = 0.38 + Math.sin(this.t * 3.1) * 0.14;
    if (this.ring) {
      this.ring.rotation.z += dt * 0.9;
      this.ring.material.opacity = 0.35 + Math.sin(this.t * 2.4) * 0.18;
    }
    if (this.motes) {
      for (const m of this.motes) {
        const a = this.t * 1.5 + m.userData.phase;
        m.position.set(Math.cos(a) * 0.55, 0.35 + Math.sin(a * 1.7) * 0.42, Math.sin(a) * 0.55);
        m.material.opacity = 0.55 + Math.sin(a * 2.3) * 0.35;
      }
    }
    this.label.visible = showLabel;
  }

  dispose() {
    this.scene.remove(this.group);
    this.mat.dispose();
    this.beam.material.dispose();
    this.glow.material.dispose();
    // 등급별 추가 연출도 같이 버린다 — 빠뜨리면 층을 넘길 때마다 조금씩 샌다
    if (this.ring) { this.ring.geometry.dispose(); this.ring.material.dispose(); }
    if (this.motes) for (const m of this.motes) m.material.dispose();
    this.label.material.dispose();
    this.labelTex.dispose();
  }
}
