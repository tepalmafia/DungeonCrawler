// 아이템 — **바닥에 떨어진 모습**과 습득. 숫자 표는 item-table.js 에 있다.
//
// 표를 가른 이유: 이 파일은 메시를 만드느라 three 를 끌고 오는데, 그러면
// 표를 브라우저 밖에서 못 읽는다 (item-table.js 머리말 참조).
// 부르는 쪽이 안 바뀌도록 표를 그대로 다시 내보낸다.

import * as THREE from 'three';
import { softDot, beamTexture } from '../core/textures.js';
import { ELEMENTS } from './elements.js';
import {
  RARITIES, SLOTS, SLOT_NAME, AFFIX_BY_KEY,
  rollItem, aggregate, incomingMult, power, affixLine, tooltipHtml, priceOf,
} from './item-table.js';

export {
  RARITIES, SLOTS, SLOT_NAME, AFFIX_BY_KEY,
  rollItem, aggregate, incomingMult, power, affixLine, tooltipHtml, priceOf,
};

// ─────────────────────── 바닥 드랍 ───────────────────────
const ITEM_GEO = {
  weapon: new THREE.BoxGeometry(0.13, 0.9, 0.13),
  helm: new THREE.SphereGeometry(0.26, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
  armor: new THREE.BoxGeometry(0.5, 0.55, 0.22),
  gloves: new THREE.BoxGeometry(0.26, 0.3, 0.18),
  belt: new THREE.TorusGeometry(0.26, 0.055, 5, 12),
  boots: new THREE.BoxGeometry(0.22, 0.24, 0.4),
  ring: new THREE.TorusGeometry(0.22, 0.07, 6, 14),
  amulet: new THREE.TorusGeometry(0.17, 0.05, 5, 12),
  lantern: new THREE.CylinderGeometry(0.16, 0.2, 0.42, 6),
  coin: new THREE.CylinderGeometry(0.17, 0.17, 0.05, 10),
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

    const coin = item.kind === 'coin';
    const tint = coin ? 0xd8b45e : r.hex;
    const mat = new THREE.MeshStandardMaterial({
      color: tint, emissive: tint, emissiveIntensity: coin ? 0.7 : 0.55,
      roughness: 0.4, metalness: coin ? 0.9 : 0.6,
    });
    this.mesh = new THREE.Mesh(ITEM_GEO[item.slot] || ITEM_GEO.ring, mat);
    if (coin) this.mesh.rotation.x = Math.PI / 2.6;   // 비스듬히 눕혀 원반으로 읽히게
    this.mesh.position.y = 0.55;
    this.mesh.rotation.z = 0.4;
    this.group.add(this.mesh);
    this.mat = mat;

    // ── 등급이 멀리서도 읽혀야 한다 ────────────────────────
    // 어두운 던전에서 바닥의 물건은 「빛기둥의 크기」로 먼저 판별된다.
    // 등급 사이 차이를 선형으로 두면 전설이 희귀와 구분이 안 간다 — 벌린다.
    const R = item.rarity;
    const beam = new THREE.Sprite(new THREE.SpriteMaterial({
      map: beamTexture(), color: tint, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: [0.34, 0.5, 0.72, 0.95][R],
    }));
    beam.scale.set([0.9, 1.15, 1.5, 1.95][R], [2.2, 2.9, 4.0, 5.4][R], 1);
    beam.position.y = [1.1, 1.4, 1.9, 2.5][R];
    this.group.add(beam);
    this.beam = beam;

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softDot(), color: tint, blending: THREE.AdditiveBlending,
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

    this.labelTex = labelTexture(item.name, coin ? '#d8b45e' : r.css);
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
