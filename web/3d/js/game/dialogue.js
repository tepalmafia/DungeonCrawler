// 몬스터 대사 — 「엿듣는 것」이지 읽는 것이 아니다.
//
// 원본은 docs/STORY.md §6 이다. 여기 표는 그것을 그대로 옮긴 것이고,
// 고칠 일이 있으면 문서를 먼저 고친다.
//
// 이 게임의 몬스터는 자기가 몬스터인 줄 모른다. 해골은 아직 교대를 기다리고,
// 시체 먹는 자는 배가 고프며, 망령 궁수만 어렴풋이 안다. 그 **착각**이 대사다.
//
// ── 빈도가 곧 설계다 ─────────────────────────────────────
// 26마리가 동시에 중얼거리면 대사가 아니라 웅성거림이다. 그래서 세 겹으로 막는다:
//   1. 가까이(14유닛) 있고 **벽 너머가 아닐 때만**
//   2. 개체당 최소 24초 간격
//   3. **전역으로 동시에 하나만** ← 이게 제일 중요하다
// 어그로가 붙은 개체는 혼잣말을 안 한다 — 싸우면서 딴생각하지 않는다.

import * as THREE from 'three';
import { hasLine } from './combat.js';

export const LINES = {
  skeleton: {
    idle: ['…교대 시간이 지났는데.', '문을 닫아라. 문을… 닫아라.', '내 이름이… 뭐였더라.', '아직 아무도 안 왔다. 아직.'],
    spot: ['누구냐! 정지!', '침입자다!', '거기 서라!'],
    combat: ['물러서라!', '명령이다!'],
    die: ['교대는…', '문을…', '아…'],
  },
  ghoul: {
    idle: ['배가… 배가.', '아무리 먹어도.', '엄마.'],
    spot: ['고기다!', '살아 있어…!'],
    combat: ['내 거야!'],
    die: ['으윽… 웩…', '배가…'],
  },
  archer: {
    idle: ['성벽은 벌써 무너졌는데.', '나는 몇 번이나 이 화살을 쐈지?', '돌아가고 싶다.'],
    spot: ['거리 스물! 사격 준비!', '살아 있는 자다!'],
    combat: ['거리를 벌려라!', '닿지 못한다!'],
    flee: ['물러난다! 물러난다!', '가까이 오지 마라!'],
    die: ['고맙…다.'],       // 이 한 줄이 이 게임의 이야기 전부다
  },
  // 무덤 골렘은 말이 없다. 비워 두는 것도 캐릭터다 —
  // 넷 중 하나가 말이 없으면 나머지 셋의 말이 더 들린다.
  golem: {},
  lord: {
    spot: ['오셨습니까. 오래 걸리셨군요.'],
    combat: ['이것을 벗기시려고요? …그럼 저들은 어떻게 됩니까.'],
    die: ['고맙습니다. …이제 다들 자게 해 주십시오.'],
  },
};

const NEAR = 14;              // 이 거리 밖은 안 들린다
const PER_ENTITY_CD = 24;     // 개체당 최소 간격 (초)
const GLOBAL_CD = 6;          // 전역 최소 간격
const IDLE_CHANCE = 0.32;     // 조건이 맞아도 매번 말하지는 않는다
const LIFE = 2.6;
const POOL = 4;

/** 말풍선 한 장 — 캔버스로 굽고 텍스트별로 캐시한다 */
const texCache = new Map();
function bubbleTexture(text, tint) {
  const key = text + '|' + tint;
  const hit = texCache.get(key);
  if (hit) return hit;

  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  const font = '34px Galmuri11, system-ui, sans-serif';
  ctx.font = font;
  const w = Math.min(492, ctx.measureText(text).width + 40);
  const x0 = (512 - w) / 2, y0 = 22, h = 62;

  // 판때기 — 반투명 검정에 종족 색 테두리. 던전이 어두워 흰 배경은 눈이 아프다.
  ctx.fillStyle = 'rgba(6,4,10,.82)';
  ctx.strokeStyle = tint;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x0, y0, w, h, 8);
  ctx.fill();
  ctx.stroke();
  // 꼬리 — 말하는 쪽이 어디인지
  ctx.beginPath();
  ctx.moveTo(256 - 9, y0 + h);
  ctx.lineTo(256 + 9, y0 + h);
  ctx.lineTo(256, y0 + h + 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e8e2d4';
  ctx.fillText(text, 256, y0 + h / 2, w - 24);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

/** 종족별 말풍선 테두리 색 — 목소리와 같은 계열로 맞춘다 */
const TINT = {
  skeleton: '#cfc6a8', ghoul: '#8fa25e', archer: '#9fd0ff', golem: '#9a97a2', lord: '#c88ad8',
};

export class Dialogue {
  constructor(scene) {
    this.scene = scene;
    this.slots = [];
    for (let i = 0; i < POOL; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        depthTest: false, transparent: true, opacity: 0,
      }));
      s.scale.set(3.4, 0.85, 1);
      s.renderOrder = 20;
      s.visible = false;
      scene.add(s);
      this.slots.push({ sprite: s, life: 0, owner: null });
    }
    this.globalCd = 0;
    this.idleT = 0;
  }

  /**
   * 한 줄 말한다. 조건은 호출부가 아니라 **여기서** 판단한다 —
   * 호출부마다 조건을 적으면 반드시 한 곳이 어긋난다.
   * @returns 말했으면 true
   */
  say(G, e, kind, opts = {}) {
    if (!e || e.dead && kind !== 'die') return false;
    const table = LINES[e.def?.key];
    const pool = table && table[kind];
    if (!pool || !pool.length) return false;

    const p = G.player;
    const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
    if (d > NEAR) return false;
    if (!hasLine(G, e.pos.x, e.pos.z, p.pos.x, p.pos.z)) return false;
    // 전역 간격은 「발견」과 「죽음」에도 건다. 다만 죽음은 좀 더 관대하게 —
    // 마지막 말이 잘리면 그게 제일 아깝다.
    const minGap = kind === 'die' ? GLOBAL_CD * 0.35 : GLOBAL_CD;
    const since = GLOBAL_CD - this.globalCd;      // 마지막 대사 이후 흐른 시간
    if (!opts.force && since < minGap) return false;

    const text = pool[(Math.random() * pool.length) | 0];
    const slot = this._freeSlot();
    slot.sprite.material.map = bubbleTexture(text, TINT[e.def.key] || '#cfc6a8');
    slot.sprite.material.needsUpdate = true;
    slot.sprite.material.opacity = 1;
    slot.sprite.visible = true;
    slot.life = LIFE;
    slot.owner = e;
    slot.headY = (e.headY ?? 1.6) + 1.05;
    e._sayT = 0;
    this.globalCd = GLOBAL_CD;
    return true;
  }

  /** 빈 자리가 없으면 제일 오래된 것을 밀어낸다 — 새 말이 늘 이긴다 */
  _freeSlot() {
    let best = this.slots[0];
    for (const s of this.slots) {
      if (s.life <= 0) return s;
      if (s.life < best.life) best = s;
    }
    return best;
  }

  /** 아직 못 본 적들의 혼잣말. 매 프레임 호출한다. */
  update(dt, G) {
    this.globalCd = Math.max(0, this.globalCd - dt);

    for (const s of this.slots) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) { s.sprite.visible = false; s.owner = null; continue; }
      const e = s.owner;
      if (e) s.sprite.position.set(e.pos.x, (e.pos.y || 0) + s.headY, e.pos.z);
      // 끝 0.5초에 사라진다 — 툭 꺼지면 못 읽은 것 같은 기분이 남는다
      s.sprite.material.opacity = Math.min(1, s.life / 0.5);
    }

    // 혼잣말 — 0.9초에 한 번만 후보를 고른다. 매 프레임 26마리를 훑을 이유가 없다.
    this.idleT += dt;
    if (this.idleT < 0.9) return;
    this.idleT = 0;
    if (this.globalCd > 0) return;

    const p = G.player;
    if (p.dead) return;
    let best = null, bestD = NEAR;
    for (const e of G.enemies) {
      if (e.dead || e.aggro) continue;              // 싸우면서 딴생각하지 않는다
      e._sayT = (e._sayT ?? PER_ENTITY_CD) + 0.9;
      if (e._sayT < PER_ENTITY_CD) continue;
      const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (best && Math.random() < IDLE_CHANCE) this.say(G, best, 'idle');
  }

  dispose() {
    for (const s of this.slots) {
      this.scene.remove(s.sprite);
      s.sprite.material.dispose();
    }
  }
}
