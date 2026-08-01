// 적 — 실루엣이 서로 겹치지 않게 「머리 × 몸 비율 × 무기」를 종족마다 확정한다.
// (docs/ART-PLAN-v200.md §3-3 의 원칙을 3D 메시에 적용)

import * as THREE from 'three';
import { makeBlobShadow } from '../core/fx.js';
import { hitPlayer, Projectile, volAt } from './combat.js';
import { Sfx } from '../core/audio.js';
import { findPath, smoothPath, toWorldPath, resolveCollision, lineOfSight, unstick } from '../world/nav.js';
import { worldToGrid, gridToWorld } from '../world/dungeon.js';
import { MOVE_SCALE, ATTACK_SCALE, ATTACK_TIME } from './pace.js';

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

  const arm = new THREE.Group(); arm.position.set(0.25, 0.38, 0);
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
  const arm = new THREE.Group(); arm.position.set(0.28, 0.24, 0.1);
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
  const arm = new THREE.Group(); arm.position.set(0.26, 0.15, 0.05);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.032, 5, 12, Math.PI * 1.25), m(0x5a4630));
  bow.rotation.y = Math.PI / 2;
  bow.rotation.z = Math.PI * 0.38;
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
  const arm = new THREE.Group(); arm.position.set(0.62, 0.5, 0);
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

    this.maxHp = Math.round(d.hp * powerMult);
    this.hp = this.maxHp;
    this.dmg = d.dmg * powerMult;
    this.armor = d.armor * powerMult;
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
    this.recoilDir = { x: 0, z: 1 };
    this.recoilPow = 1;
    this.knockMoved = 0;              // 넉백으로 실제 밀려난 거리 — 실측용(core/metrics.js)
    this.baseScale = d.scale;
    this.leapCd = 2 + Math.random() * 2;

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
    this.stateT += dt * ATTACK_SCALE;
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.leapCd = Math.max(0, this.leapCd - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.repathCd -= dt;

    const dist = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);

    // 어그로는 「개체별」로만 붙는다. 옆의 동료에게 번지지 않는다 —
    // 그래야 가장자리 한 마리만 끌어내는 플레이가 성립한다.
    if (!this.aggro && !p.dead && dist < this.def.aggro && this._canSee(G, p)) {
      this._pull(G);
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
    if (this.state === 'returning') {
      moving = this._returnHome(dt, G);
    } else if (this.aggro && !p.dead) {
      moving = this._combat(dt, G, p, dist);
    }

    // 넉백 감쇠
    if (this.knock.lengthSq() > 0.0001) {
      const kx = this.knock.x * dt * 9, kz = this.knock.z * dt * 9;
      const before = { x: this.pos.x, z: this.pos.z };
      const r = resolveCollision(G.dungeon, this.pos.x + kx, this.pos.z + kz, this.radius);
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
    const esc = unstick(G.dungeon, this.pos.x, this.pos.z);
    if (esc.moved) this.pos.set(esc.x, 0, esc.z);
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
        const want = d.ranged ? Math.min(d.range * 0.8, 9) : d.range * 0.85;
        if (dist <= want && this._canSee(G, p) && this.attackCd <= 0) {
          this.state = 'windup';
          this.stateT = 0;
          this._telegraph(G);
          break;
        }
        // 궁수는 너무 가까우면 물러난다 (카이팅)
        if (d.ranged && dist < d.keepAway) {
          moving = this._step(dt, G, this.pos.x * 2 - p.pos.x, this.pos.z * 2 - p.pos.z, this.speed * 0.9, true);
          break;
        }
        // 구울은 이따금 도약
        if (d.leap && dist < 7 && dist > 2.4 && this.leapCd <= 0 && this._canSee(G, p)) {
          this.leapCd = 4 + Math.random() * 2;
          this.state = 'leap';
          this.stateT = 0;
          const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
          const l = Math.hypot(dx, dz) || 1;
          // 도약도 「이동」이다 — 같은 배수를 먹인다 (거리도 그만큼 짧아진다)
          this.knock.set((dx / l) * 12 * MOVE_SCALE, 0, (dz / l) * 12 * MOVE_SCALE);
          break;
        }
        moving = this._chase(dt, G, p);
        this.state = 'chase';
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
    G.metrics?.aggroOn(this.def.key);

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
  }

  /** 귀환: 원래 자리로 돌아가며 회복하고 어그로를 푼다 */
  _returnHome(dt, G) {
    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.22 * dt);
    const d = this.pos.distanceTo(this.home);
    if (d < 0.6) {
      this.aggro = false;
      this.state = 'idle';
      this.path.length = 0;
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
    const step = speed * dt;
    const r = resolveCollision(G.dungeon, this.pos.x + (dx / l) * step, this.pos.z + (dz / l) * step, this.radius);
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
        hitPlayer(G, this.dmg);
      return;
    }

    // 근접: 예고 후에도 사거리 안에 있어야 맞는다 — 피할 수 있다
    if (dist <= d.range + 0.5) hitPlayer(G, this.dmg);
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
    const r = resolveCollision(G.dungeon, this.pos.x + px * dt * 7, this.pos.z + pz * dt * 7, this.radius);
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

    // 방 넓이에 비례하되 적게 — 한 판이 길어졌으니 마릿수로 밀지 않는다
    const area = room.w * room.h;
    let n = Math.max(1, Math.min(4, Math.round(area / 26)));
    if (floorNo >= 2 && rnd.chance(0.45)) n++;

    const kinds = [];
    for (let i = 0; i < n; i++) kinds.push(rnd.pick(roster));
    if (rnd.chance(0.2 + floorNo * 0.1 + tier * 0.05)) kinds.push('golem');

    for (const key of kinds) {
      let x = null, z = null;
      for (let tries = 0; tries < 40; tries++) {
        const gx = rnd.int(room.x + 1, room.x + room.w - 2);
        const gz = rnd.int(room.y + 1, room.y + room.h - 2);
        if (!dg.isFloor(gx, gz)) continue;
        const [wx, wz] = gridToWorld(gx, gz, dg.w, dg.h);
        if (placed.some((q) => Math.hypot(q.x - wx, q.z - wz) < MIN_GAP)) continue;
        x = wx; z = wz;
        break;
      }
      if (x == null) continue;   // 자리를 못 찾으면 그냥 덜 놓는다 — 뭉치게 두지 않는다
      placed.push({ x, z });
      out.push(new Enemy(G, key, x, z, powerMult));
    }
  }
  return out;
}
