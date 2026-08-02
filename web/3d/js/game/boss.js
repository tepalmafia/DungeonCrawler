// 보스 「심연의 군주」 — 3페이즈. 모든 큰 기술은 지면 예고가 먼저 뜬다(피할 수 있어야 한다).

import * as THREE from 'three';
import { Enemy, ARCHETYPES } from './enemies.js';
import { BOSS_PHASE_ELEMENT, ELEMENTS } from './elements.js';
import { hitPlayer } from './combat.js';
import { Sfx } from '../core/audio.js';
import { gridToWorld } from '../world/dungeon.js';
import { MOVE_SCALE, ATTACK_SCALE, ATTACK_TIME } from './pace.js';
import { prism, slab, spike, Part, skeleton } from '../core/rig.js';

const V = new THREE.Vector3();

function m(color, opt = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.25, ...opt });
}

// 「심연의 군주」 — 왕관 · 부유 · 낫.
//
// 잡몹과 같은 골격(core/rig.js)을 쓴다. 크기만 다르다. 그래야 **같은 동작 코드**가
// 보스에게도 걸린다 — 예전에는 보스만 따로 팔 하나를 흔들었고, 그래서 보스전이
// 잡몹전보다 오히려 뻣뻣했다. 층의 마지막에 만나는 것이 제일 안 움직이면 곤란하다.
//
// 실루엣 규칙: **어깨가 머리보다 높고 넓다.** 위로 뻗은 왕관과 낫이 그 위에 얹혀,
// 방에 들어선 순간 화면에서 제일 큰 삼각형이 된다.
function buildLord() {
  const robe = m(0x241c2e, { roughness: 1, metalness: 0 });
  const inner = m(0x140f1c, { roughness: 1, metalness: 0 });
  const bone = m(0xd8cfb6, { roughness: 0.55, metalness: 0.08 });
  const gold = m(0xd8a94a, { metalness: 0.85, roughness: 0.3, emissive: 0x3a2200, emissiveIntensity: 0.4 });
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xff5a2a });

  const rig = skeleton({
    hipY: 1.55, legX: 0, thigh: 0, shin: 0,
    spineY: 0.10, chestY: 0.44, neckY: 0.30, headY: 0.12,
    armX: 0.62, armY: 0.20, upper: 0.52, fore: 0.48,
  });
  rig.hips.remove(rig.thighL, rig.thighR);
  rig.thighL = rig.thighR = rig.shinL = rig.shinR = rig.footL = rig.footR = null;
  rig.legL = rig.legR = null;
  rig.float = true;

  // 아래로 갈수록 사라지는 옷자락 — 궁수와 같은 문법이되 세 배 크다
  new Part(rig.hips)
    .add(prism(0.62, 0.56, 0.62, 0.78, 0.70), robe, { y: 0.04 })
    .add(prism(0.34, 0.31, 0.52, 0.60, 0.55), robe, { y: -0.56 })
    .add(prism(0.06, 0.06, 0.40, 0.32, 0.30), inner, { y: -1.06 })
    .finish();
  new Part(rig.spine)
    .add(prism(0.66, 0.52, 0.44, 0.86, 0.62, { hang: false }), robe, { y: 0.20 })
    .finish();

  new Part(rig.chest)
    .add(prism(0.92, 0.64, 0.52, 0.80, 0.58, { hang: false }), robe, { y: 0.10 })
    .add(slab(0.52, 0.36, 0.06, 0.03), inner, { y: 0.12, z: 0.32 })
    // 망토 — 세 겹. 보스는 뒤에서 봐도 보스여야 한다
    .add(slab(1.30, 1.70, 0.03, 0.04), inner, { y: -0.42, z: -0.38, rx: 0.14 })
    .add(slab(0.96, 1.20, 0.03, 0.04), robe, { y: -0.58, z: -0.46, rx: 0.24 })
    .finish();

  new Part(rig.neck).add(prism(0.18, 0.18, 0.22, 0.22, 0.22), bone).finish();
  new Part(rig.head)
    .add(prism(0.40, 0.42, 0.40, 0.34, 0.36, { hang: false }), bone, { y: 0.12 })
    .add(prism(0.28, 0.14, 0.14, 0.24, 0.12, { hang: false }), bone, { y: -0.02, z: 0.12 })  // 턱
    .finish();
  const eg = prism(0.09, 0.07, 0.06, 0.09, 0.07, { hang: false, sides: 4 });
  for (const x of [0.11, -0.11]) {
    const e = new THREE.Mesh(eg, emberMat);
    e.position.set(x, 0.16, 0.21);
    rig.head.add(e);
  }

  // 왕관 — 천천히 돈다 (아래 _animate 가 돌린다)
  const crown = new THREE.Group();
  crown.position.y = 0.36;
  const cp = new Part(crown).add(prism(0.32, 0.32, 0.16, 0.30, 0.30, { hang: false }), gold);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    cp.add(spike(0.055, 0.30, 4), gold, { x: Math.cos(a) * 0.27, y: 0.10, z: Math.sin(a) * 0.27 });
  }
  cp.finish();
  rig.head.add(crown);

  // 어깨 — 실루엣을 지배한다. 뿔 세 개씩
  for (const [g2, s2] of [[rig.armL, 1], [rig.armR, -1]]) {
    const p = new Part(g2);
    p.add(prism(0.44, 0.44, 0.24, 0.52, 0.52, { hang: false }), bone, { y: 0.08, rz: s2 * 0.2 });
    p.add(spike(0.09, 0.34, 5), bone, { x: s2 * 0.20, y: 0.16, rz: s2 * 0.9 });
    p.add(spike(0.07, 0.26, 5), bone, { x: s2 * 0.10, y: 0.20, z: -0.16, rz: s2 * 0.6 });
    p.add(prism(0.17, 0.17, 0.52, 0.22, 0.22), bone, { y: -0.10 });
    p.finish();
  }
  const foreG = prism(0.14, 0.14, 0.48, 0.18, 0.18);
  new Part(rig.foreL).add(foreG, bone).finish();
  new Part(rig.foreR).add(foreG, bone).finish();
  new Part(rig.handL).add(prism(0.15, 0.16, 0.16, 0.14, 0.15), bone).finish();
  new Part(rig.handR).add(prism(0.15, 0.16, 0.16, 0.14, 0.15), bone).finish();

  // 낫 — 초승달 날. 겨눔 자세의 팔 접힘을 되돌려 자루를 세운다
  const scythe = new THREE.Group();
  scythe.position.set(0, -0.08, 0.06);
  // 낫도 마찬가지 — 자루가 손 바깥으로 뻗어야 초승달 날이 궤적을 그린다.
  // 반대로 달아 두면 날이 등 뒤에서 오르내릴 뿐이다.
  scythe.rotation.x = Math.PI - 0.34;
  new Part(scythe)
    .add(prism(0.055, 0.055, 2.5, 0.06, 0.06, { sides: 6, hang: false }), m(0x3a2c22), { y: 0.75 })
    .finish();
  const bladeMat = m(0xc8cfdc, { metalness: 0.9, roughness: 0.2, emissive: 0x2a3a55, emissiveIntensity: 0.5 });
  const blade = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.055, 5, 16, Math.PI * 0.72), bladeMat);
  blade.position.set(0, 1.9, 0);
  blade.rotation.set(Math.PI / 2, 0, -0.4);
  blade.scale.set(1, 1, 3.2);                     // 납작한 날
  blade.castShadow = true;
  scythe.add(blade);
  rig.handR.add(scythe);

  rig.weapon = scythe;
  rig.blade = blade;
  rig.bladeMat = bladeMat;
  rig.scytheBladeMat = bladeMat;
  rig.crown = crown;
  rig.stance = 'lord';
  rig.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  rig.mats = [robe, inner, bone, gold];
  rig.materials = rig.mats;
  return rig;
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
    // 페이즈마다 속성이 바뀐다 (docs/ELEMENTS.md §5).
    //
    // 이유는 하나다: **무기를 두 개 이상 챙길 이유를 만드는 것.** 지금 보스전은
    // 「피하고 때린다」뿐이라 판단할 것이 없다. 가방에 속성 무기를 몇 개 들고
    // 다니다가 페이즈마다 바꿔 끼는 것이 보스전의 조작이 된다.
    this.setElement(BOSS_PHASE_ELEMENT[Math.min(this.phase, BOSS_PHASE_ELEMENT.length - 1)]);
    G.ui.toast(`군주가 ${ELEMENTS[this.element].name}으로 물든다`, ELEMENTS[this.element].css);
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
          if (d < 5.4 && Math.abs(ad) < Math.PI * 0.35) hitPlayer(G, this.dmg * 1.5, { from: this.pos });
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
          if (dist < 4.4) hitPlayer(G, this.dmg * 0.85, { from: this.pos });
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
        if (dist < this.radius + p.radius + 1.1) { hitPlayer(G, this.dmg * 1.15, { from: this.pos }); done(); }
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
                if (Math.hypot(G.player.pos.x - sx, G.player.pos.z - sz) < 2.3)
                  hitPlayer(G, this.dmg * 0.9, { from: { x: sx, z: sz } });
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
        if (d < RANGE && Math.abs(ad) < 0.22) hitPlayer(G, this.dmg * 0.55, { from: this.pos });
        if (this.sweepT > 3.2) done();
        return 0;
      }
    }
    done();
    return 0;
  }

  _stepRaw(G, dx, dz) {
    // 돌진은 초당 15유닛이라 한 번에 밀면 벽을 뚫는다 (감사 최악 12.1유닛)
    const r = G.nav.sweep(G.dungeon, this.pos.x, this.pos.z, dx, dz, this.radius);
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
    // 기술마다 「공격 진행도」를 만들어 준다. 예전에는 여기서 팔 각도를 직접
    // 대입했고, 그래서 보스는 **몸통 없이 팔만** 움직였다 — 층의 마지막에
    // 만나는 것이 제일 뻣뻣했다. 이제 진행도만 넘기고 자세는 공용 코드가 만든다.
    if (this.move === 'cleave') {
      this.bossAtk = this.state === 'attack' ? 0.5
        : 0.3 * Math.min(1, this.moveT / this.windupDur);
    } else if (this.move === 'combo') {
      this.bossAtk = (this.moveT * 1.4) % 1;      // 연타 — 계속 감는다
    } else if (this.move === 'sweep') {
      this.bossAtk = 0.36;                        // 젖힌 채 버틴다
    } else {
      this.bossAtk = 0;
    }
    super._animate(dt, moving);
    this.rig.crown.rotation.y += dt * 0.5;
    this.walkT += dt * 1.4;
  }
}

/** 보스룸 중앙에 배치 */
export function spawnBoss(G, dg, floorNo, tier) {
  const room = dg.bossRoom || dg.rooms[dg.rooms.length - 1];
  const [x, z] = gridToWorld(room.cx, room.cy, dg.w, dg.h);
  const boss = new Boss(G, x, z, 1 + (floorNo - 1) * 0.4 + tier * 0.42);
  return boss;
}
