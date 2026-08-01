// 보스 「심연의 군주」 — 3페이즈. 모든 큰 기술은 지면 예고가 먼저 뜬다(피할 수 있어야 한다).

import * as THREE from 'three';
import { Enemy, ARCHETYPES } from './enemies.js';
import { hitPlayer } from './combat.js';
import { Sfx } from '../core/audio.js';
import { gridToWorld } from '../world/dungeon.js';
import { MOVE_SCALE, ATTACK_SCALE, ATTACK_TIME } from './pace.js';

const V = new THREE.Vector3();

function m(color, opt = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.25, ...opt });
}

function buildLord() {                            // 왕관 · 장신 부유 · 낫
  const g = new THREE.Group();
  const robe = m(0x241c2e, { roughness: 1 });
  const bone = m(0xd8cfb6);
  const gold = m(0xd8a94a, { metalness: 0.85, roughness: 0.3, emissive: 0x3a2200, emissiveIntensity: 0.4 });
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xff5a2a });

  const torso = new THREE.Group();
  torso.position.y = 1.15;

  const body = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.5, 8), robe);
  body.position.y = -0.35;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.65), robe);
  chest.position.y = 0.62;

  // 어깨 — 실루엣을 지배한다
  const shGeo = new THREE.ConeGeometry(0.44, 0.6, 6);
  const shL = new THREE.Mesh(shGeo, bone); shL.position.set(-0.78, 0.9, 0); shL.rotation.z = 0.5;
  const shR = new THREE.Mesh(shGeo, bone); shR.position.set(0.78, 0.9, 0); shR.rotation.z = -0.5;

  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.46, 0.44), bone);
  skull.position.y = 1.28;

  // 왕관
  const crown = new THREE.Group();
  crown.position.y = 1.6;
  crown.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.16, 8), gold));
  for (let i = 0; i < 6; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 4), gold);
    const a = (i / 6) * Math.PI * 2;
    spike.position.set(Math.cos(a) * 0.26, 0.2, Math.sin(a) * 0.26);
    crown.add(spike);
  }

  const eyeGeo = new THREE.BoxGeometry(0.1, 0.09, 0.04);
  const eL = new THREE.Mesh(eyeGeo, emberMat); eL.position.set(-0.11, 1.31, 0.23);
  const eR = new THREE.Mesh(eyeGeo, emberMat); eR.position.set(0.11, 1.31, 0.23);

  const cape = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x1a1322, side: THREE.DoubleSide, roughness: 1 }),
  );
  cape.position.set(0, 0.1, -0.5);
  cape.rotation.x = 0.16;

  torso.add(body, chest, shL, shR, skull, crown, eL, eR, cape);

  // 낫 — 초승달 날이 보이도록 굽힌다
  const arm = new THREE.Group();
  arm.position.set(0.82, 0.75, 0);
  const fore = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), bone);
  fore.position.y = -0.4;
  const scythe = new THREE.Group();
  scythe.position.set(0, -0.8, 0.1);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 2.6, 6), m(0x3a2c22));
  shaft.position.y = 0.7;
  const bladeMat = m(0xc8cfdc, { metalness: 0.9, roughness: 0.2, emissive: 0x2a3a55, emissiveIntensity: 0.5 });
  const blade = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.055, 5, 16, Math.PI * 0.72), bladeMat);
  blade.position.set(0.0, 1.95, 0);
  blade.rotation.set(Math.PI / 2, 0, -0.4);
  blade.scale.set(1, 1, 3.2);                     // 납작한 날
  scythe.add(shaft, blade);
  scythe.rotation.x = -0.15;
  arm.add(fore, scythe);
  torso.add(arm);

  g.add(torso);
  return { group: g, torso, legL: null, legR: null, arm, mats: [robe, bone, gold], float: true, crown, scytheBladeMat: bladeMat };
}

ARCHETYPES.lord = {
  key: 'lord', name: '심연의 군주', build: buildLord,
  hp: 1500, dmg: 26, armor: 16, speed: 3.1, radius: 1.15, range: 4.2,
  windup: 0.85, recover: 0.9, aggro: 24, xp: 420, scale: 1.0, gib: 0x9a5aff,
  heavy: true, elite: true, float: true, boss: true,
};

const PHASES = [
  { at: 1.00, name: '1페이즈', moves: ['cleave', 'combo', 'charge'] },
  { at: 0.66, name: '2페이즈 — 소환', moves: ['cleave', 'summon', 'firering', 'combo'] },
  { at: 0.33, name: '3페이즈 — 격노', moves: ['sweep', 'combo', 'firering', 'charge', 'cleave'] },
];

export class Boss extends Enemy {
  constructor(G, x, z, powerMult = 1) {
    super(G, 'lord', x, z, powerMult);
    this.phase = 0;
    this.move = null;
    this.moveT = 0;
    this.nextMove = 1.2;
    this.comboLeft = 0;
    this.sweepAngle = 0;
    this.isBoss = true;
    this.hpBar.visible = false;   // 화면 상단 전용 바를 쓴다
    this.enrage = 1;
  }

  _checkPhase(G) {
    const k = this.hp / this.maxHp;
    let want = 0;
    for (let i = PHASES.length - 1; i >= 0; i--) if (k <= PHASES[i].at) { want = i; break; }
    if (want <= this.phase) return;
    this.phase = want;
    this.enrage = 1 + this.phase * 0.22;
    this.speed = this.def.speed * MOVE_SCALE * this.enrage;
    G.ui.setBossPhase(PHASES[this.phase].name);
    G.ui.center(PHASES[this.phase].name, '심연이 요동친다');
    G.fx.shockwave(this.pos, { r0: 1, r1: 12, color: 0x9a5aff, life: 0.9, y: 0.5 });
    G.fx.burst(this.center(), { count: 70, color: 0x9a5aff, speed: 11, size: 0.7, life: 1.1, grav: 3 });
    G.lighting.flash(this.center(), 0x9a5aff, 180, 0.9);
    G.fx.addShake(0.4, 3);
    Sfx.bossRoar();
    // 페이즈 전환 시 즉시 소환
    if (this.phase >= 1) this._summon(G, 3);
  }

  _combat(dt, G, p, dist) {
    this._checkPhase(G);
    this.hpBar.visible = false;

    // 왕관과 낫이 늘 미세하게 빛난다
    this.rig.scytheBladeMat.emissiveIntensity = 0.4 + Math.sin(G.time * 3) * 0.18 + this.phase * 0.25;

    if (this.move) return this._runMove(dt, G, p, dist);

    this.nextMove -= dt * this.enrage * ATTACK_SCALE;
    if (this.nextMove <= 0) {
      const moves = PHASES[this.phase].moves;
      let pick = moves[Math.floor(Math.random() * moves.length)];
      // 거리에 안 맞는 기술은 다시 뽑는다
      if ((pick === 'cleave' || pick === 'combo') && dist > 6) pick = 'charge';
      if (pick === 'charge' && dist < 4) pick = 'cleave';
      this._start(G, pick, p);
      return 0;
    }

    // 평상시엔 사거리를 유지하며 접근
    if (dist > this.def.range * 0.8) return this._chase(dt, G, p);
    this._face(p.pos.x, p.pos.z);
    return 0;
  }

  _start(G, move, p) {
    this.move = move;
    this.moveT = 0;
    this.state = 'windup';

    switch (move) {
      case 'cleave':
        this.windupDur = 0.8 / this.enrage;
        G.fx.ground(this.pos, { r0: 5.4, color: 0xff3a5a, life: this.windupDur * ATTACK_TIME, fade: 'in', opacity: 0.55 });
        this._face(p.pos.x, p.pos.z);
        break;
      case 'combo':
        this.windupDur = 0.42 / this.enrage;
        this.comboLeft = 3;
        break;
      case 'charge':
        this.windupDur = 0.6 / this.enrage;
        this.chargeDir = V.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize().clone();
        this._face(p.pos.x, p.pos.z);
        G.fx.burst(this.center(), { count: 20, color: 0x9a5aff, speed: 3, size: 0.5, life: 0.5, grav: -2 });
        break;
      case 'summon':
        this.windupDur = 0.9;
        G.fx.ground(this.pos, { r0: 3.2, color: 0x9a5aff, life: 0.9 * ATTACK_TIME, fade: 'in', opacity: 0.6 });
        break;
      case 'firering':
        this.windupDur = 0.4;
        this.ringSpots = [];
        break;
      case 'sweep':
        this.windupDur = 0.7;
        this.sweepAngle = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z) - Math.PI;
        this.sweepT = 0;
        G.fx.ground(this.pos, { r0: 9, color: 0xff6a2a, life: 0.7 * ATTACK_TIME, fade: 'in', opacity: 0.4 });
        break;
    }
    Sfx.cast();
  }

  _runMove(dt, G, p, dist) {
    // 기술 진행도 시계를 늦춘다 — windupDur 과 그 뒤의 모든 분기(+0.45, beat,
    // +0.85, +1.5)가 이 시계를 쓰므로 한 번에 30% 느려진다. 대신 이 시계는
    // 「초」가 아니게 되니, 실시간으로 도는 것(지면 예고 링·이동)은 따로 환산한다.
    this.moveT += dt * ATTACK_SCALE;
    const done = () => { this.move = null; this.state = 'recover'; this.stateT = 0; this.nextMove = (1.5 + Math.random() * 1.2) / this.enrage; };

    switch (this.move) {
      case 'cleave': {
        if (this.moveT < this.windupDur) { this._face(p.pos.x, p.pos.z); return 0; }
        if (this.state === 'windup') {
          this.state = 'attack';
          G.fx.arc(this.pos, this.facing, { radius: 5.4, spread: Math.PI * 0.62, color: 0xff5a7a, life: 0.28 });
          G.fx.addShake(0.16);
          G.lighting.flash(this.center(), 0xff4a6a, 80, 0.3);
          const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
          const d = Math.hypot(dx, dz);
          let ad = Math.atan2(dx, dz) - this.facing;
          while (ad > Math.PI) ad -= Math.PI * 2;
          while (ad < -Math.PI) ad += Math.PI * 2;
          if (d < 5.4 && Math.abs(ad) < Math.PI * 0.35) hitPlayer(G, this.dmg * 1.5);
          Sfx.swing();
        }
        if (this.moveT > this.windupDur + 0.45) done();
        return 0;
      }

      case 'combo': {
        const beat = this.windupDur + 0.28;
        const idx = Math.floor(this.moveT / beat);
        if (idx > 3 - this.comboLeft && this.comboLeft > 0) {
          this.comboLeft--;
          this.state = 'attack';
          G.fx.arc(this.pos, this.facing, { radius: 4.0, spread: Math.PI * 0.5, color: 0xffaa7a, life: 0.18 });
          if (dist < 4.4) hitPlayer(G, this.dmg * 0.85);
          Sfx.swing();
          this._face(p.pos.x, p.pos.z);
        }
        if (this.comboLeft <= 0 && this.moveT > beat * 3.2) done();
        return 0;
      }

      case 'charge': {
        if (this.moveT < this.windupDur) return 0;
        const step = 15 * MOVE_SCALE * this.enrage * dt;   // 돌진도 이동이다
        const r = this._stepRaw(G, this.chargeDir.x * step, this.chargeDir.z * step);
        G.fx.burst(this.center(), { count: 3, color: 0x9a5aff, speed: 1.5, size: 0.5, life: 0.35, grav: 0 });
        if (dist < this.radius + p.radius + 1.1) { hitPlayer(G, this.dmg * 1.15); done(); }
        else if (r.hit || this.moveT > this.windupDur + 0.85) {
          if (r.hit) { G.fx.addShake(0.2); G.fx.burst(this.center(), { count: 26, color: 0x8a7a6a, speed: 6, size: 0.5, life: 0.6 }); }
          done();
        }
        return 1;
      }

      case 'summon': {
        if (this.moveT < this.windupDur) return 0;
        this._summon(G, 4);
        done();
        return 0;
      }

      case 'firering': {
        // 플레이어 주변에 원이 순차적으로 점화된다 — 계속 움직이게 만든다
        if (this.moveT >= this.windupDur && this.ringSpots.length < 7) {
          const want = Math.floor((this.moveT - this.windupDur) / 0.18);
          while (this.ringSpots.length <= want && this.ringSpots.length < 7) {
            const a = Math.random() * Math.PI * 2;
            const rr = 1.5 + Math.random() * 6;
            const sx = p.pos.x + Math.cos(a) * rr, sz = p.pos.z + Math.sin(a) * rr;
            this.ringSpots.push({ x: sx, z: sz });
            G.fx.ground({ x: sx, z: sz }, { r0: 2.1, color: 0xff5a2a, life: 0.9, fade: 'in', opacity: 0.7 });
            G.timers.push({
              t: 0.9,
              fn: () => {
                const pos = new THREE.Vector3(sx, 0, sz);
                G.fx.shockwave(pos, { r0: 0.4, r1: 2.4, color: 0xff8a3a, life: 0.4, y: 0.3 });
                G.fx.burst(pos.clone().setY(0.4), { count: 24, color: 0xff9a3a, speed: 8, size: 0.5, life: 0.6 });
                G.lighting.flash(pos.clone().setY(1), 0xff8a3a, 55, 0.3);
                if (Math.hypot(G.player.pos.x - sx, G.player.pos.z - sz) < 2.3) hitPlayer(G, this.dmg * 0.9);
              },
            });
          }
        }
        if (this.moveT > this.windupDur + 1.5) done();
        this._face(p.pos.x, p.pos.z);
        return 0;
      }

      case 'sweep': {
        if (this.moveT < this.windupDur) return 0;
        // 회전하는 광선 — 사거리 밖으로 도망치거나 뒤를 잡아야 한다
        // 회전이 느려진 만큼 지속도 늘려야 쓸고 지나가는 각도가 그대로다
        this.sweepT += dt * ATTACK_SCALE;
        const speed = 2.1 * this.enrage;
        this.sweepAngle += dt * speed * ATTACK_SCALE;
        this.facing = this.sweepAngle;
        const RANGE = 9.5;
        for (let i = 1; i <= 5; i++) {
          const d = (i / 5) * RANGE;
          G.fx.burst({ x: this.pos.x + Math.sin(this.sweepAngle) * d, y: 0.6, z: this.pos.z + Math.cos(this.sweepAngle) * d },
            { count: 1, color: 0xff7a3a, speed: 0.8, size: 0.7, life: 0.35, grav: -1 });
        }
        const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        let ad = Math.atan2(dx, dz) - this.sweepAngle;
        while (ad > Math.PI) ad -= Math.PI * 2;
        while (ad < -Math.PI) ad += Math.PI * 2;
        if (d < RANGE && Math.abs(ad) < 0.22) hitPlayer(G, this.dmg * 0.55);
        if (this.sweepT > 3.2) done();
        return 0;
      }
    }
    done();
    return 0;
  }

  _stepRaw(G, dx, dz) {
    const { resolveCollision } = G.nav;
    const r = resolveCollision(G.dungeon, this.pos.x + dx, this.pos.z + dz, this.radius);
    this.pos.set(r.x, 0, r.z);
    return r;
  }

  _summon(G, n) {
    const dg = G.dungeon;
    Sfx.bossRoar();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      const rr = 3 + Math.random() * 2.5;
      const x = this.pos.x + Math.cos(a) * rr, z = this.pos.z + Math.sin(a) * rr;
      const e = new Enemy(G, Math.random() < 0.5 ? 'skeleton' : 'ghoul', x, z, 1 + G.floorNo * 0.25 + G.tier * 0.3);
      e.aggro = true;
      e.summoned = true;
      G.enemies.push(e);
      G.fx.burst(e.center(), { count: 18, color: 0x9a5aff, speed: 4, size: 0.5, life: 0.6, grav: -2 });
      G.fx.ground(e.pos, { r0: 1.4, color: 0x9a5aff, life: 0.6 });
    }
  }

  _animate(dt, moving) {
    super._animate(dt, moving);
    this.rig.crown.rotation.y += dt * 0.5;
    // 부유 — 위아래로 천천히
    this.rig.group.position.y = 0.35 + Math.sin(this.walkT * 1.2 + this.bobPhase) * 0.14;
    this.walkT += dt * 1.4;
    // 낫 스윙
    let armX = 0;
    if (this.move === 'cleave') armX = this.state === 'attack' ? 1.3 : -1.5 * Math.min(1, this.moveT / this.windupDur);
    else if (this.move === 'combo') armX = Math.sin(this.moveT * 9) * 1.2;
    else if (this.move === 'sweep') armX = -0.5;
    this.rig.arm.rotation.x += (armX - this.rig.arm.rotation.x) * Math.min(1, dt * 14);
  }
}

/** 보스룸 중앙에 배치 */
export function spawnBoss(G, dg, floorNo, tier) {
  const room = dg.bossRoom || dg.rooms[dg.rooms.length - 1];
  const [x, z] = gridToWorld(room.cx, room.cy, dg.w, dg.h);
  const boss = new Boss(G, x, z, 1 + (floorNo - 1) * 0.4 + tier * 0.42);
  return boss;
}
