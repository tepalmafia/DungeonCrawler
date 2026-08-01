// 적 — 실루엣이 서로 겹치지 않게 「머리 × 몸 비율 × 무기」를 종족마다 확정한다.
// (docs/ART-PLAN-v200.md §3-3 의 원칙을 3D 메시에 적용)

import * as THREE from 'three';
import { makeBlobShadow } from '../core/fx.js';
import { hitPlayer, Projectile, volAt } from './combat.js';
import { Sfx } from '../core/audio.js';
import { findPath, smoothPath, toWorldPath, resolveCollision, sweep, lineOfSight, unstick } from '../world/nav.js';
import { worldToGrid, gridToWorld } from '../world/dungeon.js';
import { MOVE_SCALE, ATTACK_SCALE, ATTACK_TIME } from './pace.js';
import { AI, pickIdle, updateIdle, visionFactor, reactionDelay, findFlank, SHOUT, NOISE, SEARCH, FLEE } from './ai.js';
import { TRAITS, ELITE_SKILLS, makeElite, makeAura } from './elites.js';

// 전 종족 체력 배수. 「한 마리씩 오래 싸운다」는 설계라 한 판이 길어야 하는데,
// 아이템·스킬이 늘면서 플레이어 쪽만 세졌다. 한 곳에서 올린다 —
// 종족마다 hp 를 손보면 종족 간 균형이 같이 흔들린다.
export const HP_SCALE = 1.3;

const V = new THREE.Vector3();

// 「!」 — 적이 나를 발견한 순간을 눈으로 알린다.
// 붉은 바닥 원은 발밑이라 카메라 각도에 따라 가려진다. 머리 위 표식은 안 가려진다.
let ALERT_TEX = null;
function alertTexture() {
  if (ALERT_TEX) return ALERT_TEX;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.font = 'bold 104px system-ui, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.lineWidth = 12;
  x.strokeStyle = '#1a0806';          // 검은 테두리 — 어두운 배경에서도 뜬다
  x.strokeText('!', S / 2, S / 2 + 4);
  x.fillStyle = '#ff4a3a';
  x.fillText('!', S / 2, S / 2 + 4);
  ALERT_TEX = new THREE.CanvasTexture(c);
  ALERT_TEX.colorSpace = THREE.SRGBColorSpace;
  return ALERT_TEX;
}

function m(color, opt = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1, ...opt });
}

// ───────────────────────── 메시 ─────────────────────────
function buildSkeleton() {                       // 두개골 · 장신 마름 · 검
  const g = new THREE.Group();
  const bone = m(0xcfc6ad, { roughness: 0.7 });
  const rag = m(0x4a4453);
  const legGeo = new THREE.BoxGeometry(0.12, 0.55, 0.13);
  const legL = new THREE.Mesh(legGeo, bone); legL.position.set(-0.12, 0.28, 0);
  const legR = new THREE.Mesh(legGeo, bone); legR.position.set(0.12, 0.28, 0);
  const torso = new THREE.Group(); torso.position.y = 0.55;
  const ribs = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.2), bone);
  ribs.position.y = 0.2;
  for (let i = 0; i < 3; i++) {                  // 갈비뼈 — 해골의 정체성
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.045, 0.24), bone);
    r.position.y = 0.08 + i * 0.12;
    torso.add(r);
  }
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), bone);
  skull.position.y = 0.55;
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.2), bone);
  jaw.position.y = 0.43;
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff4a2a });
  const eyeGeo = new THREE.BoxGeometry(0.055, 0.05, 0.03);
  const eL = new THREE.Mesh(eyeGeo, eyeMat); eL.position.set(-0.06, 0.57, 0.12);
  const eR = new THREE.Mesh(eyeGeo, eyeMat); eR.position.set(0.06, 0.57, 0.12);
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.6), new THREE.MeshStandardMaterial({ color: 0x3b3546, side: THREE.DoubleSide, roughness: 1 }));
  cape.position.set(0, 0.22, -0.13);
  torso.add(ribs, skull, jaw, eL, eR, cape);

  // 무기 손은 −X 다 (정면이 +Z 이므로) — player.js 의 armR 주석 참조
  const arm = new THREE.Group(); arm.position.set(-0.25, 0.38, 0);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 0.1), bone);
  upper.position.set(0, -0.17, 0);
  arm.add(upper);

  const sword = new THREE.Group(); sword.position.set(0, -0.34, 0.04);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.06), rag);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.07), m(0x8a7a5a));
  guard.position.set(0, 0.1, 0);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.035), m(0xa9b0bd, { metalness: 0.7, roughness: 0.35 }));
  blade.position.set(0, 0.42, 0);
  sword.add(grip, guard, blade);
  sword.rotation.x = -0.2;
  arm.add(sword);
  torso.add(arm);
  g.add(legL, legR, torso);
  return { group: g, torso, legL, legR, arm, mats: [bone, rag] };
}

function buildGhoul() {                          // 뿔 없음 · 왜소·굽은 몸 · 발톱
  const g = new THREE.Group();
  const skin = m(0x6d7a4e, { roughness: 0.95 });
  const claw = m(0xd8cdb0);
  const legGeo = new THREE.BoxGeometry(0.15, 0.36, 0.16);
  const legL = new THREE.Mesh(legGeo, skin); legL.position.set(-0.14, 0.18, 0);
  const legR = new THREE.Mesh(legGeo, skin); legR.position.set(0.14, 0.18, 0);
  const torso = new THREE.Group(); torso.position.y = 0.36;
  torso.rotation.x = 0.42;                       // 앞으로 굽은 자세
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), skin);
  body.scale.set(1, 0.85, 1.25);
  body.position.y = 0.2;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.3), skin);
  head.position.set(0, 0.3, 0.28);
  const maw = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 4), claw);
  maw.rotation.x = Math.PI / 2;
  maw.position.set(0, 0.25, 0.45);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd23a });
  const eL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.03), eyeMat); eL.position.set(-0.07, 0.36, 0.42);
  const eR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.03), eyeMat); eR.position.set(0.07, 0.36, 0.42);
  torso.add(body, head, maw, eL, eR);
  const arm = new THREE.Group(); arm.position.set(-0.28, 0.24, 0.1);
  const fore = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.34, 0.11), skin);
  fore.position.y = -0.16;
  for (let i = -1; i <= 1; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.19, 4), claw);
    c.position.set(i * 0.06, -0.36, 0.03);
    c.rotation.x = Math.PI;
    arm.add(c);
  }
  arm.add(fore);
  torso.add(arm);
  g.add(legL, legR, torso);
  return { group: g, torso, legL, legR, arm, mats: [skin, claw] };
}

function buildArcher() {                         // 두건 · 부유(다리 없음) · 활
  const g = new THREE.Group();
  const robe = m(0x3a4a63, { roughness: 1 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff });
  const torso = new THREE.Group(); torso.position.y = 0.85;
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.0, 7), robe);
  body.position.y = -0.15;
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 6), robe);
  hood.position.y = 0.4;
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.13, 0.05), new THREE.MeshBasicMaterial({ color: 0x0a0d14 }));
  face.position.set(0, 0.33, 0.15);
  const eL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.02), glowMat); eL.position.set(-0.04, 0.34, 0.18);
  const eR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.02), glowMat); eR.position.set(0.04, 0.34, 0.18);
  torso.add(body, hood, face, eL, eR);
  const arm = new THREE.Group(); arm.position.set(-0.26, 0.15, 0.05);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.032, 5, 12, Math.PI * 1.25), m(0x5a4630));
  bow.rotation.y = -Math.PI / 2;          // 손을 옮겼으니 활의 배도 같이 뒤집는다
  bow.rotation.z = -Math.PI * 0.38;
  arm.add(bow);
  torso.add(arm);
  g.add(torso);
  return { group: g, torso, legL: null, legR: null, arm, mats: [robe], float: true };
}

function buildGolem() {                          // 투구 · 육중 · 맨손
  const g = new THREE.Group();
  const stone = m(0x6b6a72, { roughness: 0.95 });
  const core = new THREE.MeshBasicMaterial({ color: 0xff7a2a });
  const legGeo = new THREE.BoxGeometry(0.3, 0.5, 0.32);
  const legL = new THREE.Mesh(legGeo, stone); legL.position.set(-0.24, 0.25, 0);
  const legR = new THREE.Mesh(legGeo, stone); legR.position.set(0.24, 0.25, 0);
  const torso = new THREE.Group(); torso.position.y = 0.5;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.75, 0.6), stone);
  body.position.y = 0.38;
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), core);
  heart.position.set(0, 0.42, 0.31);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.36), stone);
  head.position.y = 0.92;
  const shGeo = new THREE.BoxGeometry(0.34, 0.34, 0.44);
  const shL = new THREE.Mesh(shGeo, stone); shL.position.set(-0.62, 0.6, 0);
  const shR = new THREE.Mesh(shGeo, stone); shR.position.set(0.62, 0.6, 0);
  torso.add(body, heart, head, shL, shR);
  const arm = new THREE.Group(); arm.position.set(-0.62, 0.5, 0);
  const fore = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.3), stone);
  fore.position.y = -0.34;
  const fist = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.42), stone);
  fist.position.y = -0.7;
  arm.add(fore, fist);
  const armL2 = new THREE.Group(); armL2.position.set(-0.62, 0.5, 0);
  armL2.add(fore.clone(), fist.clone());
  torso.add(arm, armL2);
  g.add(legL, legR, torso);
  return { group: g, torso, legL, legR, arm, mats: [stone] };
}

// ───────────────────────── 데이터 ─────────────────────────
// ── 설계: 「한 마리씩 끌어와 1대1로 오래 싸운다」 ──────────────────
// 그래서 (1) 어그로가 무리로 번지지 않고, (2) 어그로 반경이 좁고,
// (3) 개체 HP가 높아 한 판이 길고, (4) 너무 멀어지면 제자리로 돌아간다(리쉬).
// 궁수만 어그로 반경이 넓다 — 잘못 끌면 곤란해지는 존재가 하나는 있어야 한다.
export const ARCHETYPES = {
  skeleton: {
    key: 'skeleton', name: '해골 병사', build: buildSkeleton,
    hp: 92, dmg: 8, armor: 4, speed: 3.0, radius: 0.42, range: 1.6,
    windup: 0.45, recover: 0.85, aggro: 8.5, leash: 20, xp: 16, scale: 1.0, gib: 0xd6cdb4,
  },
  ghoul: {
    key: 'ghoul', name: '구울', build: buildGhoul,
    hp: 58, dmg: 6, armor: 1, speed: 5.0, radius: 0.38, range: 1.4,
    windup: 0.3, recover: 0.6, aggro: 9.5, leash: 22, xp: 14, scale: 1.0, gib: 0x7d8a5a,
    leap: true,
  },
  archer: {
    key: 'archer', name: '망령 궁수', build: buildArcher,
    hp: 66, dmg: 9, armor: 2, speed: 3.2, radius: 0.4, range: 11,
    windup: 0.7, recover: 1.3, aggro: 12.5, leash: 24, xp: 20, scale: 1.0, gib: 0x7fb4d6,
    ranged: true, keepAway: 6.5, float: true,
  },
  golem: {
    key: 'golem', name: '무덤 골렘', build: buildGolem,
    hp: 330, dmg: 19, armor: 13, speed: 2.3, radius: 0.75, range: 2.4,
    windup: 0.9, recover: 1.25, aggro: 8, leash: 18, xp: 75, scale: 1.15, gib: 0x8a8a92,
    heavy: true, elite: true, slam: 3.4,
  },
};

// ───────────────────────── 개체 ─────────────────────────
export class Enemy {
  constructor(G, defKey, x, z, powerMult = 1) {
    this.G = G;
    this.def = ARCHETYPES[defKey];
    const d = this.def;

    const rig = d.build();
    this.rig = rig;
    this.obj = new THREE.Group();
    rig.group.scale.setScalar(d.scale);
    this.obj.add(rig.group);
    this.shadow = makeBlobShadow(d.radius * 3.1);
    this.obj.add(this.shadow);
    this.obj.position.set(x, 0, z);
    rig.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    G.scene.add(this.obj);

    this.pos = new THREE.Vector3(x, 0, z);
    this.knock = new THREE.Vector3();
    this.facing = Math.random() * Math.PI * 2;

    this.maxHp = Math.round(d.hp * powerMult * HP_SCALE);
    this.hp = this.maxHp;
    this.dmg = d.dmg * powerMult;
    this.armor = d.armor * powerMult;
    this.atkSpeedMul = 1;      // 정예 특성이 올린다
    this.speed = d.speed * MOVE_SCALE;   // 전체 템포는 game/pace.js
    this.radius = d.radius;
    this.heavy = !!d.heavy;
    this.elite = !!d.elite;

    this.state = 'idle';
    this.stateT = 0;
    this.aggro = false;
    this.home = new THREE.Vector3(x, 0, z);   // 리쉬 — 여기서 너무 멀어지면 돌아간다
    this.flash = 0;
    this.dead = false;
    this.dieT = 0;
    this.walkT = Math.random() * 10;
    this.bobPhase = Math.random() * 7;
    this.path = [];
    this.repathCd = Math.random() * 0.4;
    this.attackCd = 0;
    this.recoilT = 0;
    this.stunT = 0;              // 기절 남은 시간 (둔기·stun 접사)
    this.recoilDir = { x: 0, z: 1 };
    this.recoilPow = 1;
    this.knockMoved = 0;              // 넉백으로 실제 밀려난 거리 — 실측용(core/metrics.js)
    this.lastGood = null;             // 마지막으로 걸을 수 있는 칸에 있었던 위치

    // 미발견 상태의 「하는 일」 (game/ai.js). 종족마다 어울리는 것이 다르다.
    this.idleKind = pickIdle(defKey);
    this.idleT = Math.random() * 2.5;
    this.idleMoving = false;
    this.idleTarget = null;
    this.idleFace = null;
    this.spotT = 0;                   // 뒤에서 발견했을 때의 반응 지연
    this.flankCd = 0;                 // 우회 지점 재탐색 쿨다운
    this.flankTarget = null;
    this.baseScale = d.scale;
    this.leapCd = 2 + Math.random() * 2;

    this.shouted = false;         // 층당 1회 (docs/ENEMY-AI.md §5-1)
    this.shoutT = 0;              // 외침 시전 남은 시간
    this.searchAt = null;         // 수색 목표 지점
    this.searchT = 0;
    this.fledTimes = 0;           // 이탈 횟수 — 개체당 1회
    this.braceT = 0;              // 돌아서는 경직
    this.skill = null;
    this.skillCd = 0;
    this.traits = null;
    this.chargeT = 0;
    this.xpMul = 1;

    // 피격 시 원래 색으로 되돌리기 위해 보관
    this.baseColors = rig.mats.map((mm) => mm.color.clone());
    this.mats = rig.mats;

    this._buildHpBar();
  }

  _buildHpBar() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 16;
    this.hpCanvas = c;
    this.hpCtx = c.getContext('2d');
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    this.hpTex = t;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    s.scale.set(1.5, 0.19, 1);
    s.renderOrder = 15;
    s.visible = false;
    this.hpBar = s;
    this.obj.add(s);
    this._drawHpBar();
  }

  _drawHpBar() {
    const ctx = this.hpCtx;
    ctx.clearRect(0, 0, 128, 16);
    ctx.fillStyle = 'rgba(8,6,12,.85)';
    ctx.fillRect(0, 0, 128, 16);
    ctx.strokeStyle = this.elite ? '#c8a24a' : '#3a3145';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 126, 14);
    const k = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = this.elite ? '#e0a03a' : '#d0402f';
    ctx.fillRect(3, 3, 122 * k, 10);
    this.hpTex.needsUpdate = true;
  }

  center(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.def.float ? 1.1 : this.radius * 1.9 + 0.25, this.pos.z);
  }

  get headY() { return (this.def.float ? 1.9 : this.radius * 3.2 + 0.5) * this.def.scale; }

  // ─────────────────── 프레임 ───────────────────
  /** 화면에 보이는 이름. 정예는 특성이 앞에 붙는다 */
  get displayName() { return this.eliteName || this.def.name; }

  /** 정예로 승격 — spawnFloor 가 부른다 (game/elites.js) */
  promote(rnd, floorNo) {
    makeElite(this, rnd, floorNo);
    const a = makeAura(this);
    this.aura = a.mesh;
    this.auraColor = a.color;
    this.obj.add(this.aura);
    // 몸에도 색을 스민다 — 발밑 고리는 각도에 따라 가려진다
    for (const mm of this.mats) mm.emissive?.setHex?.(a.color), (mm.emissiveIntensity = 0.16);
    this.rig.group.scale.multiplyScalar(1.12);
    this.baseScale *= 1.12;
    return this;
  }

  update(dt, G) {
    if (this.dead) {
      this.dieT -= dt;
      const k = Math.max(0, this.dieT / 0.55);
      this.rig.group.scale.setScalar(this.def.scale * k);
      this.rig.group.rotation.z += dt * 6;
      this.rig.group.position.y = (1 - k) * -0.6;
      this.shadow.material.opacity = 0.5 * k;
      this.hpBar.visible = false;
      this.obj.position.copy(this.pos);
      return;
    }

    const p = G.player;
    // 공격 상태 시계 자체를 늦춘다 — windup/attack/recover/leap 임계값이 전부
    // 이 시계로 재므로, 임계값을 한 줄씩 고치다 하나를 빠뜨려 예고와 타격이
    // 어긋나는 사고가 원천적으로 안 생긴다. 애니메이션(stateT/def.windup)도
    // 같은 시계를 쓰니 자동으로 맞는다.
    this.stateT += dt * ATTACK_SCALE * (this.atkSpeedMul || 1);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.leapCd = Math.max(0, this.leapCd - dt);
    this.flankCd = Math.max(0, this.flankCd - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.repathCd -= dt;

    // 외침 시전 — 끝나야 전파된다. 도중에 죽거나 기절하면 아무 일도 없다.
    if (this.shoutT > 0) {
      this.shoutT -= dt;
      if (this.shoutMark) {
        this.shoutMark.position.set(0, this.headY + 0.85, 0);
        this.shoutMark.scale.setScalar(0.42 + Math.sin(G.time * 18) * 0.08);
      }
      if (this.shoutT <= 0) {
        this._shoutOut(G);
        if (this.shoutMark) this.shoutMark.visible = false;
      }
    }

    // 정예 — 특성 지속 효과와 스킬 쿨다운
    if (this.traits) {
      for (const t of this.traits) TRAITS[t].tick?.(this, dt);
      this.skillCd = Math.max(0, this.skillCd - dt);
      this.chargeT = Math.max(0, this.chargeT - dt);
      if (this.aura) {
        this.aura.rotation.z += dt * 1.1;
        this.aura.material.opacity = 0.42 + Math.sin(G.time * 2.6 + this.bobPhase) * 0.18;
      }
    }

    const dist = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);

    // 기절 — 둔기 계열과 stun 접사가 건다 (game/combat.js).
    //
    // 상태를 유지한 채 **행동만** 멈춘다. state 를 'idle' 같은 걸로 바꿔 버리면
    // 선딜 중에 기절한 놈이 깨어나며 예고 없이 때린다 — 예고 링과 타격이
    // 어긋나는 그 사고다. 그래서 stateT 를 되돌려 공격 시계까지 같이 세운다.
    if (this.stunT > 0) {
      // 기절은 외침을 끊는다 — 「입을 막으면 지원이 안 온다」
      if (this.shoutT > 0) { this.shoutT = 0; if (this.shoutMark) this.shoutMark.visible = false; }
      this.stunT -= dt;
      this.stateT -= dt * ATTACK_SCALE;
      this.rig.group.rotation.z = Math.sin(G.time * 17) * 0.11;   // 비틀거린다
      this.obj.position.copy(this.pos);
      this._animate(dt, 0);
      const showS = (this.hp < this.maxHp || G.hover === this) && dist < 22;
      this.hpBar.visible = showS;
      if (showS) {
        this.hpBar.position.set(0, this.headY + 0.35, 0);
        this._drawHpBar();
      }
      return;
    }
    if (this.rig.group.rotation.z) this.rig.group.rotation.z = 0;

    // 어그로는 「개체별」로만 붙는다. 옆의 동료에게 번지지 않는다 —
    // 그래야 가장자리 한 마리만 끌어내는 플레이가 성립한다.
    // 시야가 부채꼴이라 같은 거리라도 앞뒤에 따라 발견 시점이 다르다.
    // busy(등을 보이고 뭔가를 뒤지는 중)는 뒤가 특히 무디다 — 기습이 성립한다.
    if (!this.aggro && !p.dead && this._canSee(G, p)) {
      const reach = this.def.aggro * visionFactor(this, p.pos.x, p.pos.z);
      if (dist < reach) {
        // 뒤에서 다가오면 알아채는 데 시간이 걸린다
        this.spotT += dt;
        if (this.spotT >= reactionDelay(this, p.pos.x, p.pos.z)) this._pull(G);
      } else {
        this.spotT = 0;
      }
    }

    // 리쉬 — 처음 자리에서 너무 멀어지면 돌아가며 체력을 회복한다.
    // 여러 마리를 한꺼번에 끌고 도망다니는 플레이를 막는 장치이자,
    // 잘못 끈 적을 떼어낼 수 있는 안전장치이기도 하다.
    if (this.aggro && !this.summoned && this.def.leash) {
      if (this.state !== 'returning' && this.pos.distanceTo(this.home) > this.def.leash) {
        this.state = 'returning';
        this.stateT = 0;
        this.path.length = 0;
      }
    }

    let moving = 0;
    if (this.state === 'search') {
      moving = this._search(dt, G, p);
    } else if (this.state === 'returning') {
      moving = this._returnHome(dt, G);
    } else if (this.aggro && !p.dead) {
      moving = this._combat(dt, G, p, dist);
    } else if (!this.aggro) {
      // 아직 못 봤다 — 각자 자기 일을 한다 (game/ai.js)
      moving = updateIdle(this, dt, G);
    }

    // 넉백 감쇠
    if (this.knock.lengthSq() > 0.0001) {
      const kx = this.knock.x * dt * 9, kz = this.knock.z * dt * 9;
      const before = { x: this.pos.x, z: this.pos.z };
      // 감사 최악값이 여기였다 — 60유닛(=격자 30칸). 반드시 쪼개서 민다.
      const r = sweep(G.dungeon, this.pos.x, this.pos.z, kx, kz, this.radius);
      this.pos.set(r.x, 0, r.z);
      // 벽에 막히면 임펄스만큼 못 밀린다 — 그래서 「의도한 값」이 아니라
      // 실제 이동 합계를 잰다. 이게 사장님이 화면에서 보는 거리다.
      this.knockMoved += Math.hypot(this.pos.x - before.x, this.pos.z - before.z);
      this.knock.multiplyScalar(Math.max(0, 1 - dt * 9));
    } else if (this.knockMoved > 0) {
      G.metrics?.knock(this.knockMoved);
      this.knockMoved = 0;
    }

    this._separate(dt, G);
    // 밀치기·넉백이 겹쳐 벽 안으로 밀려 들어갔으면 빼낸다
    const esc = unstick(G.dungeon, this.pos.x, this.pos.z, this.lastGood);
    if (esc.moved) this.pos.set(esc.x, 0, esc.z);
    {
      const [lgx, lgz] = worldToGrid(this.pos.x, this.pos.z, G.dungeon.w, G.dungeon.h);
      if (G.dungeon.at(lgx, lgz) === 1) {
        if (!this.lastGood) this.lastGood = { x: this.pos.x, z: this.pos.z };
        else { this.lastGood.x = this.pos.x; this.lastGood.z = this.pos.z; }
      }
    }
    this.obj.position.copy(this.pos);
    this._animate(dt, moving);

    // HP바는 다쳤거나 커서가 올라갔을 때만
    // 맞았는데 상태가 idle 이면 바로 추격으로 전환한다
    if (this.aggro && this.state === 'idle') { this.state = 'chase'; this.stateT = 0; }

    const show = (this.hp < this.maxHp || G.hover === this) && dist < 22;
    this.hpBar.visible = show;
    if (show) {
      this.hpBar.position.set(0, this.headY + 0.35, 0);
      this._drawHpBar();
    }
  }

  _combat(dt, G, p, dist) {
    const d = this.def;
    let moving = 0;

    switch (this.state) {
      case 'idle':
      case 'chase': {
        // 이탈 — 체력이 바닥나면 전투를 포기하고 도망친다 (§6-2).
        //
        // **이 판정은 공격 판정보다 먼저여야 한다.** 처음엔 아래쪽에 뒀는데,
        // 사거리 안이면 그 전에 windup 으로 빠져 이탈이 영영 안 걸렸다
        // (실측: 체력 20% 로 160프레임을 굴려도 flee 상태가 한 번도 안 나옴).
        //
        // 이 행동이 기획 전체에서 제일 위험하다: **잘못 만들면 궁수를 못 잡는다.**
        // 그래서 안전장치가 셋이다.
        //   · 개체당 1회. 두 번째는 도망치지 않고 싸운다
        //   · 도망 속도는 전투 속도의 105% 까지 — 플레이어(4.34)가 잡을 수 있다
        //   · 시작할 때 1.2초 경직. 돌아서는 동작이라, 이때 붙으면 못 도망친다
        if (AI.archerFlee && d.ranged && this.fledTimes < FLEE.maxTimes
            && this.hp < this.maxHp * FLEE.hpPct) {
          this.fledTimes++;
          this.state = 'flee';
          this.stateT = 0;
          this.braceT = FLEE.brace;
          this.path.length = 0;
          G.dialogue?.say(G, this, 'flee');
          // 도망 중 외침 1회는 무료다 — 「도망가서 다른 적들을 불러온다」
          if (AI.shout && SHOUT[d.key]) { this.shouted = false; this.shoutT = SHOUT[d.key].cast; }
          break;
        }
        const want = d.ranged ? Math.min(d.range * 0.8, 9) : d.range * 0.85;
        const see = this._canSee(G, p);
        if (dist <= want && see && this.attackCd <= 0) {
          this.state = 'windup';
          this.stateT = 0;
          this._telegraph(G);
          break;
        }
        // 사거리 안인데 벽·기둥이 사선을 막았다 → 옆으로 돌아 각을 연다.
        // 이 분기가 없으면 궁수는 뒤로 물러나기만 하고 영영 못 쏘고,
        // 근접은 이미 가까워 추격도 의미가 없어 그 자리에 굳는다.
        // **후퇴(카이팅)보다 먼저 판단해야 한다** — 순서를 바꾸면 궁수가
        // 막힌 채로 계속 물러나기만 한다.
        if (dist <= want && !see) {
          if (this.flankCd <= 0 || !this.flankTarget) {
            this.flankCd = 0.5;
            this.flankTarget = findFlank(this, G, p);
          }
          if (this.flankTarget) {
            const fd = Math.hypot(this.flankTarget.x - this.pos.x, this.flankTarget.z - this.pos.z);
            if (fd < 0.45) {
              this.flankTarget = null;          // 도착 — 다음 프레임에 사선을 다시 본다
            } else {
              moving = this._step(dt, G, this.flankTarget.x, this.flankTarget.z, this.speed);
              break;
            }
          }
        } else {
          this.flankTarget = null;
        }
        // 궁수는 너무 가까우면 물러난다 (카이팅) — 단, 사선이 열려 있을 때만.
        if (d.ranged && dist < d.keepAway && see) {
          moving = this._step(dt, G, this.pos.x * 2 - p.pos.x, this.pos.z * 2 - p.pos.z, this.speed * 0.9, true);
          break;
        }
        // 정예 스킬 — 예고가 먼저다. 예고 없는 큰 피해는 이 게임에 없다.
        if (this.skill && this.skillCd <= 0 && this._canSee(G, p)) {
          const sk = ELITE_SKILLS[this.skill];
          if (dist >= sk.minRange && dist <= sk.maxRange) {
            this.state = 'cast';
            this.stateT = 0;
            this.skillCd = sk.cd[0] + Math.random() * (sk.cd[1] - sk.cd[0]);
            G.fx.ground(this.pos, {
              r0: 0.3, r1: this.radius * 3.4, color: this.auraColor ?? 0xffd070, life: sk.tell,
            });
            G.ui?.toast(`${this.eliteName} — ${sk.name}`, '#ffd070');
            break;
          }
        }

        // 구울은 이따금 도약
        if (d.leap && dist < 5.5 && dist > 2.6 && this.leapCd <= 0 && this._canSee(G, p)) {
          this.leapCd = 4 + Math.random() * 2;
          this.state = 'leap';
          this.stateT = 0;
          const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
          const l = Math.hypot(dx, dz) || 1;
          // 도약 거리는 **지금 벌어진 간격**에서 나온다.
          //
          // 예전엔 고정 임펄스 12(×0.7=8.4)를 썼다. 그런데 넉백 감쇠가 지수라
          // **이동량 ≈ 임펄스**다 — 격자 한 칸이 2.0 이니 8.4 는 네 칸이다.
          // 2.6 유닛 앞에서도 8.4 를 날아가 플레이어를 지나쳐 등 뒤에 떨어졌고,
          // 그게 「엄청 멀리 날아온다」로 보였다. 도약은 간격을 좁히는 동작이지
          // 순간이동이 아니다.
          const gap = Math.max(1.4, Math.min(3.6, dist - d.range * 0.9));
          this.knock.set((dx / l) * gap, 0, (dz / l) * gap);
          break;
        }
        moving = this._chase(dt, G, p);
        this.state = 'chase';
        break;
      }

      case 'flee': {
        // 경직 — 돌아서는 동안은 못 움직인다. 추격이 보상받는 창이다.
        if (this.braceT > 0) {
          this.braceT -= dt;
          this._face(p.pos.x, p.pos.z);
          break;
        }
        // 목적지: 가장 가까운 **다른 적**. 없으면 집.
        // 다른 적에게 닿으면 그 적이 수색 상태가 된다 — 어그로가 아니다.
        let dest = this.home, best = Infinity;
        for (const o of G.enemies) {
          if (o === this || o.dead || o.aggro) continue;
          const dd = Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z);
          if (dd < best) { best = dd; dest = o.pos; }
        }
        moving = this._step(dt, G, dest.x, dest.z, this.speed * FLEE.speedMul);
        // 도망 중에는 안 쏜다 — 등을 보이므로 추격이 보상받아야 한다
        if (Math.hypot(dest.x - this.pos.x, dest.z - this.pos.z) < 2.2
            || this.stateT > 6) {
          this.state = 'chase';
          this.stateT = 0;
        }
        break;
      }

      case 'cast': {
        this._face(p.pos.x, p.pos.z);
        const sk = ELITE_SKILLS[this.skill];
        if (this.stateT >= sk.tell) {
          sk.fire(G, this);
          this.state = 'recover';
          this.stateT = 0;
        }
        break;
      }

      case 'leap':
        moving = 1;
        if (this.stateT > 0.45) { this.state = 'chase'; this.stateT = 0; }
        break;

      case 'windup':
        this._face(p.pos.x, p.pos.z);
        if (this.stateT >= d.windup) {
          this.state = 'attack';
          this.stateT = 0;
          this._strike(G, p, dist);
        }
        break;

      case 'attack':
        if (this.stateT >= 0.16) { this.state = 'recover'; this.stateT = 0; }
        break;

      case 'recover':
        if (this.stateT >= d.recover) { this.state = 'chase'; this.stateT = 0; }
        break;
    }
    return moving;
  }

  /** 어그로가 붙는 순간 — 어느 놈이 반응했는지 눈에 보여야 한다 */
  _pull(G) {
    this.aggro = true;
    this.state = 'chase';
    this.stateT = 0;
    G.fx.ground(this.pos, { r0: this.radius * 2.6, color: 0xff3a3a, life: 0.7 });
    G.fx.burst(this.center(), { count: 6, color: 0xff5a4a, speed: 1.6, size: 0.32, life: 0.5, grav: -1 });
    Sfx.enemyAggro(this.def.key, volAt(G, this.pos));
    // 등을 보이고 있을 때 걸렸는가 — 기습이 실제로 성립하는지 재는 지표
    G.metrics?.aggroOn(this.def.key, this.idleKind === 'busy');

    // 머리 위 느낌표 — 튀어올랐다가 사그라든다
    if (!this.alert) {
      this.alert = new THREE.Sprite(new THREE.SpriteMaterial({
        map: alertTexture(), transparent: true, depthTest: false,
      }));
      this.alert.renderOrder = 990;      // 벽·안개에 묻히지 않게
      this.alert.scale.setScalar(0.6);
      this.obj.add(this.alert);
    }
    this.alert.visible = true;
    this.alertT = 1.25;

    // 「누구냐! 정지!」 — 발견의 순간에만 말한다. 대사 조건(거리·벽·간격)은
    // game/dialogue.js 가 판단하므로 여기서는 부르기만 한다.
    G.dialogue?.say(G, this, 'spot');

    // 외침 — 어그로가 붙는 순간 확률로 시전한다 (§5-1).
    // **개체당 층당 1회.** 반복 호출로 방 전체가 오는 일은 없다.
    const sh = AI.shout && SHOUT[this.def.key];
    if (sh && !this.shouted && Math.random() < sh.chance) {
      this.shouted = true;
      this.shoutT = sh.cast;
      // 시전 중 머리 위 표식. 죽거나 기절하면 전파되지 않는다 —
      // 「입을 막으면 지원이 안 온다」가 플레이어의 판단거리가 된다.
      if (!this.shoutMark) {
        this.shoutMark = new THREE.Sprite(new THREE.SpriteMaterial({
          map: alertTexture(), color: 0xffd070, transparent: true, depthTest: false,
        }));
        this.shoutMark.renderOrder = 991;
        this.obj.add(this.shoutMark);
      }
      this.shoutMark.visible = true;
      Sfx.enemyAggro(this.def.key, volAt(G, this.pos) * 1.1);
    }
  }

  /**
   * 소리를 듣는다 — 어그로가 **아니다.** 「저기서 무슨 소리가 났다」만 안다.
   * 소리가 난 지점으로 가 보고, 거기서 플레이어를 보면 그때 어그로가 붙는다.
   * 이 완충이 없으면 소음 = 즉시 추가 교전이 되어 풀링이 무너진다 (§5-3).
   */
  hear(G, srcX, srcZ, toX = srcX, toZ = srcZ) {
    if (this.dead || this.aggro || this.state === 'search') return false;
    // 들리는지는 **소리가 난 곳**까지로 잰다. 처음엔 듣는 쪽에서 플레이어까지의
    // 시야를 봤는데, 그건 정반대다 — 외침의 존재 이유가 「안 보이는 것을
    // 알려주는 것」이다. 그렇게 두니 전파가 아예 안 됐다(실측 0마리).
    //
    // 닫힌 문은 소리를 막는다. lineOfSight 가 walkable() 을 쓰고 그게 문 상태를
    // 보므로 자동이다 — 문을 닫고 싸우면 옆방이 안 온다.
    if (!lineOfSight(G.dungeon,
      ...worldToGrid(this.pos.x, this.pos.z, G.dungeon.w, G.dungeon.h),
      ...worldToGrid(srcX, srcZ, G.dungeon.w, G.dungeon.h))) return false;
    this.state = 'search';
    this.stateT = 0;
    // 가 볼 곳은 **소리가 가리킨 곳**이다. 외침이면 외친 놈이 본 플레이어 위치.
    this.searchAt = { x: toX, z: toZ };
    this.searchT = 0;
    this.path.length = 0;
    return true;
  }

  /**
   * 수색 — 소리가 난 곳으로 가 보고 두리번거린다.
   * **플레이어 위치를 모른다.** 가는 길에 눈에 들어와야 어그로가 붙는다.
   */
  _search(dt, G, p) {
    // 가는 도중이라도 실제로 보이면 그때 어그로. 이것만이 수색 → 전투 경로다.
    if (!p.dead && this._canSee(G, p)) {
      const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
      if (d < this.def.aggro * visionFactor(this, p.pos.x, p.pos.z)) { this._pull(G); return 0; }
    }
    const t = this.searchAt;
    if (!t) { this.state = 'returning'; return 0; }
    const d = Math.hypot(t.x - this.pos.x, t.z - this.pos.z);
    if (d > 1.4) {
      return this._step(dt, G, t.x, t.z, this.speed * SEARCH.speed);
    }
    // 도착 — 두리번거린다. 못 찾으면 집으로.
    this.searchT += dt;
    this.facing += dt * 1.6;
    if (this.searchT >= SEARCH.look) {
      this.searchAt = null;
      this.state = 'returning';
      this.stateT = 0;
    }
    return 0;
  }

  /** 외침이 닿는 범위의 적들을 수색 상태로 (어그로가 아니다) */
  _shoutOut(G) {
    const sh = SHOUT[this.def.key];
    if (!sh) return;
    let n = 0;
    for (const o of G.enemies) {
      if (o === this || o.dead) continue;
      if (Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z) > sh.radius) continue;
      // 들리는 기준은 **외친 놈의 위치**, 가 볼 곳은 그가 본 플레이어 위치
      if (o.hear(G, this.pos.x, this.pos.z, G.player.pos.x, G.player.pos.z)) n++;
    }
    G.fx.ground(this.pos, { r0: 0.5, r1: sh.radius, color: 0xffd070, life: 0.6, opacity: 0.35 });
    if (n) G.ui?.toast(`${this.displayName}의 외침 — ${n}마리가 움직인다`, '#ffd070');
  }

  /** 귀환: 원래 자리로 돌아가며 회복하고 어그로를 푼다 */
  _returnHome(dt, G) {
    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.22 * dt);
    const d = this.pos.distanceTo(this.home);
    if (d < 0.6) {
      this.aggro = false;
      this.state = 'idle';
      this.path.length = 0;
      // 집에 돌아왔으면 하던 일을 처음부터 다시 시작한다.
      // 안 지우면 귀환 전에 잡아둔 낡은 목적지로 곧장 걸어간다.
      this.idleMoving = false;
      this.idleTarget = null;
      this.idleT = 0.5 + Math.random();
      this.spotT = 0;
      return 0;
    }
    if (this.repathCd <= 0 || !this.path.length) {
      this.repathCd = 0.5;
      const [sx, sz] = worldToGrid(this.pos.x, this.pos.z, G.dungeon.w, G.dungeon.h);
      const [tx, tz] = worldToGrid(this.home.x, this.home.z, G.dungeon.w, G.dungeon.h);
      const raw = findPath(G.dungeon, sx, sz, tx, tz, 2200);
      this.path = raw ? toWorldPath(G.dungeon, smoothPath(G.dungeon, raw)).slice(1) : [];
    }
    const wp = this.path.length ? this.path[0] : this.home;
    if (this.path.length && Math.hypot(wp.x - this.pos.x, wp.z - this.pos.z) < 0.4) this.path.shift();
    return this._step(dt, G, wp.x, wp.z, this.speed * 1.3);
  }

  _canSee(G, p) {
    const [ax, az] = worldToGrid(this.pos.x, this.pos.z, G.dungeon.w, G.dungeon.h);
    const [bx, bz] = worldToGrid(p.pos.x, p.pos.z, G.dungeon.w, G.dungeon.h);
    return lineOfSight(G.dungeon, ax, az, bx, bz);
  }

  /** 시야가 트이면 직진, 막히면 A* */
  _chase(dt, G, p) {
    if (this._canSee(G, p)) {
      this.path.length = 0;
      return this._step(dt, G, p.pos.x, p.pos.z, this.speed);
    }
    if (this.repathCd <= 0 || !this.path.length) {
      this.repathCd = 0.45 + Math.random() * 0.3;
      const [sx, sz] = worldToGrid(this.pos.x, this.pos.z, G.dungeon.w, G.dungeon.h);
      const [tx, tz] = worldToGrid(p.pos.x, p.pos.z, G.dungeon.w, G.dungeon.h);
      const raw = findPath(G.dungeon, sx, sz, tx, tz, 2200);
      this.path = raw ? toWorldPath(G.dungeon, smoothPath(G.dungeon, raw)).slice(1) : [];
    }
    if (!this.path.length) return 0;
    const wp = this.path[0];
    if (Math.hypot(wp.x - this.pos.x, wp.z - this.pos.z) < 0.4) this.path.shift();
    return this._step(dt, G, wp.x, wp.z, this.speed);
  }

  _step(dt, G, tx, tz, speed, away = false) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const l = Math.hypot(dx, dz);
    if (l < 0.001) return 0;
    // 목표를 지나치지 않도록 먼저 자르고, 그 다음 쪼개 민다
    const step = Math.min(l, speed * dt);
    const r = sweep(G.dungeon, this.pos.x, this.pos.z, (dx / l) * step, (dz / l) * step, this.radius);
    this.pos.set(r.x, 0, r.z);
    if (!away) this._face(tx, tz); else this.facing = Math.atan2(dx, dz);
    return 1;
  }

  _face(x, z) { this.facing = Math.atan2(x - this.pos.x, z - this.pos.z); }

  /** 예고 — 플레이어가 피할 시간을 준다 */
  _telegraph(G) {
    const d = this.def;
    if (d.slam) {
      // 링은 실시간으로 자란다. 선딜은 느려진 시계로 재므로 실제 초로 환산해야
      // 예고가 끝나는 순간과 타격이 정확히 겹친다.
      G.fx.ground(this.pos, { r0: d.slam, color: 0xff4a2a, life: d.windup * ATTACK_TIME, fade: 'in', opacity: 0.7 });
    } else if (d.ranged) {
      G.fx.burst(this.center(), { count: 5, color: 0x9fd8ff, speed: 1.2, size: 0.3, life: 0.4, grav: -2 });
    }
  }

  _strike(G, p, dist) {
    const d = this.def;
    Sfx.enemyAttack(d.key, volAt(G, this.pos));
    // 이 쿨다운만 실시간(dt)으로 줄어드니 여기서 환산해 둔다
    this.attackCd = (d.recover * 0.8 + 0.25) * ATTACK_TIME;

    if (d.ranged) {
      const from = this.center();
      const dir = V.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
      G.projectiles.push(new Projectile(G, {
        from, dir, speed: 15, dmg: this.dmg, color: 0x9fd8ff, fromPlayer: false, life: 2.4,
      }));
      return;
    }

    if (d.slam) {
      G.fx.shockwave(this.pos, { r0: 0.5, r1: d.slam, color: 0xff6a2a, life: 0.45, y: 0.2 });
      G.fx.burst(this.pos, { count: 26, color: 0xff8a3a, speed: 7, size: 0.5, life: 0.6 });
      G.fx.addShake(0.14);
      G.lighting.flash(this.center(), 0xff7a2a, 70, 0.3);
      if (Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) < d.slam)
        hitPlayer(G, this.dmg, { from: this.pos, attacker: this });
      return;
    }

    // 근접: 예고 후에도 사거리 안에 있어야 맞는다 — 피할 수 있다
    if (dist <= d.range + 0.5) hitPlayer(G, this.dmg, { from: this.pos, attacker: this });
    G.fx.arc(this.pos, this.facing, { radius: d.range, spread: Math.PI * 0.55, color: 0xff9a7a, life: 0.16 });
  }

  /** 서로 겹치지 않게 살짝 밀어낸다 */
  _separate(dt, G) {
    let px = 0, pz = 0, n = 0;
    for (const o of G.enemies) {
      if (o === this || o.dead) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz;
      const rr = this.radius + o.radius;
      if (d2 > rr * rr || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      px += (dx / d) * (rr - d);
      pz += (dz / d) * (rr - d);
      n++;
    }
    if (!n) return;
    const r = sweep(G.dungeon, this.pos.x, this.pos.z, px * dt * 7, pz * dt * 7, this.radius);
    this.pos.set(r.x, 0, r.z);
  }

  _animate(dt, moving) {
    const rig = this.rig;

    // 발견 표식 — 위로 튀었다가 천천히 내려오며 사라진다
    if (this.alert && this.alertT > 0) {
      this.alertT = Math.max(0, this.alertT - dt);
      const k = this.alertT / 1.25;                 // 1 → 0
      const pop = Math.min(1, (1 - k) * 7);         // 처음 0.18초에 솟아오른다
      this.alert.position.set(0, this.headY + 0.55 + pop * 0.35, 0);
      this.alert.scale.setScalar(0.28 + pop * 0.36);
      this.alert.material.opacity = k > 0.65 ? 1 : k / 0.65;
      if (this.alertT === 0) this.alert.visible = false;
    }

    // 리코일 — 맞은 방향으로 움찔하고 납작해진다.
    // 위치(this.pos)는 건드리지 않는다 — 이건 순전히 연출이라 충돌·경로와 무관하다.
    if (this.recoilT > 0) {
      this.recoilT = Math.max(0, this.recoilT - dt * 6.5);
      const k = this.recoilT * this.recoilPow;
      const back = 0.13 * k;
      rig.group.position.x = this.recoilDir.x * back;
      rig.group.position.z = this.recoilDir.z * back;
      const sq = this.baseScale;
      rig.group.scale.set(sq * (1 + 0.1 * k), sq * (1 - 0.14 * k), sq * (1 + 0.1 * k));
      if (this.recoilT === 0) {
        rig.group.position.x = rig.group.position.z = 0;
        rig.group.scale.setScalar(sq);
      }
    }
    let d = this.facing - rig.group.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    rig.group.rotation.y += d * Math.min(1, dt * 12);

    if (rig.float) {
      rig.group.position.y = 0.28 + Math.sin(this.walkT * 1.6 + this.bobPhase) * 0.12;
      this.walkT += dt * 2.2;
    } else if (moving > 0.05) {
      this.walkT += dt * (7 + this.speed);
      const s = Math.sin(this.walkT);
      if (rig.legL) rig.legL.rotation.x = s * 0.8;
      if (rig.legR) rig.legR.rotation.x = -s * 0.8;
      rig.group.position.y = Math.abs(Math.sin(this.walkT * 2)) * 0.05;
    } else {
      if (rig.legL) rig.legL.rotation.x *= 1 - Math.min(1, dt * 8);
      if (rig.legR) rig.legR.rotation.x *= 1 - Math.min(1, dt * 8);
      rig.group.position.y *= 1 - Math.min(1, dt * 8);
    }

    // 팔: 예비 동작에서 크게 젖혔다가 타격에서 내려친다
    let armX = 0;
    if (this.state === 'windup') armX = -1.5 * Math.min(1, this.stateT / this.def.windup);
    else if (this.state === 'attack') armX = 1.15;
    else if (this.state === 'recover') armX = 1.15 * Math.max(0, 1 - this.stateT / this.def.recover);
    if (rig.arm) rig.arm.rotation.x += (armX - rig.arm.rotation.x) * Math.min(1, dt * 18);

    // 피격 플래시
    const f = this.flash > 0 ? this.flash / 0.14 : 0;
    for (let i = 0; i < this.mats.length; i++) {
      const base = this.baseColors[i];
      this.mats[i].color.setRGB(
        base.r + (1 - base.r) * f,
        base.g + (1 - base.g) * f * 0.8,
        base.b + (1 - base.b) * f * 0.8,
      );
    }
  }

  dispose() {
    this.G.scene.remove(this.obj);
    this.obj.traverse((o) => {
      if (o.isMesh || o.isSprite) {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach((mm) => mm.dispose());
        else o.material?.dispose?.();
      }
    });
    this.hpTex.dispose();
  }
}

// ───────────────────────── 스폰 ─────────────────────────
/**
 * 배치 — 「무리」가 아니라 「흩어져 있는 개체」로 둔다.
 * 서로 최소 MIN_GAP 만큼 떨어뜨려서, 가장자리 한 마리에게 다가가
 * 그놈만 끌어내는 판단이 가능하게 만든다. 시작 방은 비워 둔다.
 */
export function spawnFloor(G, dg, rnd, floorNo, tier) {
  const out = [];
  const powerMult = 1 + (floorNo - 1) * 0.45 + tier * 0.35;
  const MIN_GAP = 6.5;          // 월드 유닛 — 어그로 반경(8~9)보다 조금 좁다
  const placed = [];

  const roster = ['skeleton', 'skeleton', 'ghoul', 'archer'];

  for (const room of dg.rooms) {
    if (room === dg.startRoom || room.boss) continue;
    // 금고 방에는 적을 두지 않는다. 문이 닫혀 있으면 갇힌 적을 못 잡고,
    // 그러면 「적을 다 잡으면 포탈이 열린다」가 영원히 성립하지 않는다.
    // 이 방의 위험은 적이 아니라 함정과 값이다.
    if (room.vault) continue;

    // 방 넓이에 비례하되 적게 — 한 판이 길어졌으니 마릿수로 밀지 않는다
    const area = room.w * room.h;
    let n = Math.max(1, Math.min(4, Math.round(area / 26)));
    if (floorNo >= 2 && rnd.chance(0.45)) n++;

    let roomElite = false;
    const kinds = [];
    for (let i = 0; i < n; i++) kinds.push(rnd.pick(roster));

    // 조 편성 (docs/ENEMY-AI.md §4) — 「세 마리가 모여 있다」는 그림은 나오되
    // **어그로는 여전히 개별**이다. 가장자리 한 마리에게 다가가면 그 한 마리만 온다.
    //
    // 다만 가까이 있으므로 외침이 닿을 확률이 높다 — 그래서 「조를 어떻게 흩뜨릴까」가
    // 판단거리가 된다. 뭉치는 것 자체가 벌이 아니라 **문제**여야 한다.
    //
    // 나머지는 단독으로 둔다. 단독 개체가 있어야 안전한 시작점이 남는다.
    const squadRate = [0.30, 0.45, 0.55][Math.min(2, floorNo - 1)] ?? 0.55;
    const squadSize = AI.squads && rnd.chance(squadRate) ? rnd.int(2, 3) : 0;
    let squadCenter = null;
    if (rnd.chance(0.2 + floorNo * 0.1 + tier * 0.05)) kinds.push('golem');

    let inSquad = 0;
    for (const key of kinds) {
      let x = null, z = null;
      // 조원은 조 중심 근처에, 그 밖은 방 전체에 흩어 놓는다.
      // 조원끼리는 MIN_GAP 을 줄여 실제로 「모여 있게」 한다.
      const squad = squadCenter && inSquad < squadSize;
      const gap = squad ? 2.6 : MIN_GAP;
      for (let tries = 0; tries < 40; tries++) {
        let gx, gz;
        if (squad) {
          gx = squadCenter.gx + rnd.int(-2, 2);
          gz = squadCenter.gz + rnd.int(-2, 2);
        } else {
          gx = rnd.int(room.x + 1, room.x + room.w - 2);
          gz = rnd.int(room.y + 1, room.y + room.h - 2);
        }
        if (!dg.isFloor(gx, gz)) continue;
        const [wx, wz] = gridToWorld(gx, gz, dg.w, dg.h);
        if (placed.some((q) => Math.hypot(q.x - wx, q.z - wz) < gap)) continue;
        x = wx; z = wz;
        if (squad) inSquad++;
        else if (squadSize && !squadCenter) {
          // 첫 개체가 조의 중심이 된다
          squadCenter = { gx, gz };
          inSquad = 1;
        }
        break;
      }
      if (x == null) continue;   // 자리를 못 찾으면 그냥 덜 놓는다 — 뭉치게 두지 않는다
      placed.push({ x, z });
      const e = new Enemy(G, key, x, z, powerMult);
      // 정예 승격 — 층이 깊을수록 잦다. 골렘은 이미 정예 취급이라 제외한다.
      // 방마다 하나까지만: 정예 둘이 같은 방에 있으면 「한 마리씩」이 성립하지 않는다.
      if (key !== 'golem' && !roomElite && rnd.chance(0.10 + floorNo * 0.05 + tier * 0.03)) {
        e.promote(rnd, floorNo);
        roomElite = true;
      }
      out.push(e);
    }
  }
  return out;
}
