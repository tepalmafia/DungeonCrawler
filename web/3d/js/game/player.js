// 플레이어 — 저폴리 기사. 메시도 전부 코드로 조립한다(외부 모델 0).

import * as THREE from 'three';
import { makeBlobShadow } from '../core/fx.js';
import { aggregate, RARITIES } from './items.js';
import { findPath, smoothPath, toWorldPath, resolveCollision, unstick, walkable } from '../world/nav.js';
import { worldToGrid, gridToWorld } from '../world/dungeon.js';

const RADIUS = 0.42;
const BASE_SPEED = 6.2;

function mat(color, opt = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.22, ...opt });
}

/** 기사 메시 — 상체/하체/팔/무기를 분리해 애니메이션이 가능하게 만든다.
 *  (아트 시제품 비교에서 「현재」 패널이 실제 게임 메시를 그대로 쓰도록 내보낸다) */
export function buildKnight() {
  const g = new THREE.Group();
  const steel = mat(0x9aa2b8, { metalness: 0.82, roughness: 0.3 });
  const dark = mat(0x3f3b4d, { metalness: 0.35, roughness: 0.7 });
  const cloth = mat(0xb8434b, { roughness: 0.9, metalness: 0.05 });
  const skin = mat(0xc7a288, { roughness: 0.85, metalness: 0 });

  // 다리
  const legGeo = new THREE.BoxGeometry(0.19, 0.62, 0.22);
  const legL = new THREE.Mesh(legGeo, dark); legL.position.set(-0.15, 0.31, 0);
  const legR = new THREE.Mesh(legGeo, dark); legR.position.set(0.15, 0.31, 0);
  g.add(legL, legR);

  // 상체 (허리에서 어깨로 넓어지게 두 덩이)
  const torso = new THREE.Group();
  torso.position.y = 0.62;
  const hip = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.24, 0.28), steel);
  hip.position.y = 0.12;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.36, 0.32), steel);
  chest.position.y = 0.42;
  torso.add(hip, chest);

  // 어깨 갑주 — 실루엣의 핵심. 이게 있으면 멀리서도 "기사"로 읽힌다
  const paulGeo = new THREE.SphereGeometry(0.19, 8, 6);
  const paulL = new THREE.Mesh(paulGeo, steel); paulL.position.set(-0.34, 0.52, 0);
  const paulR = new THREE.Mesh(paulGeo, steel); paulR.position.set(0.34, 0.52, 0);
  paulL.scale.set(1, 0.8, 1); paulR.scale.set(1, 0.8, 1);
  torso.add(paulL, paulR);

  // 머리 + 투구
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), skin);
  head.position.y = 0.76;
  const helm = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.19, 0.31), steel);
  helm.position.y = 0.85;
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.3), cloth);
  crest.position.y = 1.0;
  torso.add(head, helm, crest);

  // 망토
  const cloak = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.9), new THREE.MeshStandardMaterial({
    color: 0x93343c, side: THREE.DoubleSide, roughness: 0.95, metalness: 0,
  }));
  cloak.position.set(0, 0.34, -0.2);
  cloak.rotation.x = 0.12;
  torso.add(cloak);

  // 오른팔 + 무기 (스윙 축이 어깨에 오도록 그룹 원점을 어깨에 둔다)
  const armR = new THREE.Group();
  armR.position.set(0.34, 0.5, 0);
  const upperR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.42, 0.15), dark);
  upperR.position.y = -0.2;
  armR.add(upperR);

  const weapon = new THREE.Group();
  weapon.position.set(0, -0.4, 0.05);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.07), dark);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.09), mat(0xb99a4e, { metalness: 0.8 }));
  guard.position.y = 0.14;
  const bladeMat = mat(0xd7dbe6, { metalness: 0.85, roughness: 0.25, emissive: 0x000000 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.86, 0.045), bladeMat);
  blade.position.y = 0.6;
  weapon.add(grip, guard, blade);
  weapon.rotation.x = -0.25;
  armR.add(weapon);

  // 왼팔 + 방패
  const armL = new THREE.Group();
  armL.position.set(-0.34, 0.5, 0);
  const upperL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.42, 0.15), dark);
  upperL.position.y = -0.2;
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.07), mat(0x8a6238, { roughness: 0.8 }));
  shield.position.set(-0.12, -0.28, 0.13);
  shield.rotation.y = 0.35;
  armL.add(upperL, shield);

  torso.add(armR, armL);
  g.add(torso);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  return { group: g, torso, legL, legR, armR, armL, weapon, blade, bladeMat, materials: [steel, dark, cloth, skin, bladeMat] };
}

export class Player {
  constructor(scene) {
    this.scene = scene;
    const k = buildKnight();
    this.rig = k;
    this.obj = new THREE.Group();
    this.obj.add(k.group);
    this.shadow = makeBlobShadow(1.5);
    this.obj.add(this.shadow);
    scene.add(this.obj);

    this.pos = new THREE.Vector3();
    this.facing = 0;
    this.radius = RADIUS;

    // 진행
    this.level = 1;
    this.xp = 0;
    this.xpNext = 24;
    this.potions = { hp: 5, mp: 5 };
    this.potionCd = { hp: 0, mp: 0 };
    // 랜턴 — 들고 있는 동안만 초당 1 씩 탄다. 다 타면 기본 등불로 돌아간다.
    this.lantern = null;
    this.torchRefuelT = 0;      // 벽 횃불 옆에 머문 시간

    // 장비
    this.equipped = { weapon: null, armor: null, ring: null };
    this.bag = [];
    this.bagMax = 24;

    // 이동
    this.path = [];
    this.dest = null;
    this.target = null;          // 공격 대상 (Enemy)
    // 경로 재계산 타이머는 용도별로 나눈다. 하나로 공유하면 서로를 굶겨서
    // 「클릭했는데 안 움직이는」 증상이 난다.
    this.repathCd = 0;           // 벽에 끼었을 때 자체 재계산
    this.holdRepathCd = 0;       // 좌클릭 홀드 이동
    this.chaseRepathCd = 0;      // 평타 추격
    // 끼임 감지 — 원인이 무엇이든 「앞으로 못 가는 상태」를 못 버티게 한다
    this.stuckT = 0;
    this.lastWpDist = Infinity;
    this.noSmooth = false;
    // 탈출이 몇 번 발동했는지 — 검증과 현장 진단용 (window.G3.player.stuckEvents)
    this.stuckEvents = { skipWaypoint: 0, unsmooth: 0, giveUp: 0 };

    // 전투
    this.attackCd = 0;
    this.swing = 0;              // 0..1 스윙 진행도
    this.walkT = 0;
    this.hurtT = 0;
    this.invuln = 0;
    this.dashT = 0;
    this.dashDir = new THREE.Vector3();
    this.dead = false;

    this.recompute();
    this.hp = this.maxHp;
    this.mp = this.maxMp;
  }

  // ── 스탯 ────────────────────────────────────────────────
  recompute() {
    const a = aggregate(this.equipped);
    this.bonus = a;
    const lv = this.level - 1;
    this.maxHp = 135 + lv * 18 + a.hp;   // 1대1이 길어진 만큼 버틸 여유를 준다
    this.maxMp = 60 + lv * 7 + a.mp;
    this.armor = 2 + lv * 1.2 + a.armor;
    this.critChance = 5 + a.crit;
    this.critMult = 1.8 + a.cdmg / 100;
    this.speed = BASE_SPEED * (1 + a.speed / 100);
    this.attackSpeed = a.weaponSpeed * (1 + a.aspd / 100) * (1 + lv * 0.012);
    this.cdr = Math.min(0.45, a.cdr / 100);
    this.leech = a.leech;
    this.dmgMin = a.dmgMin + a.dmg + lv * 1.6;
    this.dmgMax = a.dmgMax + a.dmg + lv * 2.4;
    this.hp = Math.min(this.hp ?? this.maxHp, this.maxHp);
    this.mp = Math.min(this.mp ?? this.maxMp, this.maxMp);
    this._syncBlade();
  }

  _syncBlade() {
    const w = this.equipped.weapon;
    const r = w ? RARITIES[w.rarity] : null;
    if (r && w.rarity >= 1) {
      this.rig.bladeMat.color.set(r.hex);
      this.rig.bladeMat.emissive.set(r.hex);
      this.rig.bladeMat.emissiveIntensity = 0.18 + w.rarity * 0.16;
    } else {
      this.rig.bladeMat.color.set(0xd7dbe6);
      this.rig.bladeMat.emissive.set(0x000000);
      this.rig.bladeMat.emissiveIntensity = 0;
    }
  }

  equip(item) {
    const prev = this.equipped[item.slot];
    this.equipped[item.slot] = item;
    const i = this.bag.indexOf(item);
    if (i >= 0) this.bag.splice(i, 1);
    if (prev) this.bag.push(prev);
    this.recompute();
    return prev;
  }

  pickUp(item) {
    if (this.bag.length >= this.bagMax) return false;
    this.bag.push(item);
    return true;
  }

  gainXp(n) {
    this.xp += n;
    let ups = 0;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Math.round(this.xpNext * 1.42 + 8);
      ups++;
    }
    if (ups) {
      this.recompute();
      this.hp = this.maxHp;
      this.mp = this.maxMp;
    }
    return ups;
  }

  // ── 이동 ────────────────────────────────────────────────
  setPosition(x, z) {
    this.pos.set(x, 0, z);
    this.obj.position.copy(this.pos);
    this.path = [];
    this.dest = null;
  }

  moveTo(dg, wx, wz) {
    this.target = null;
    return this._path(dg, wx, wz);
  }

  /**
   * @param smooth false 면 스무딩을 끈다 — 칸 단위 경로는 인접 칸만 잇기 때문에
   *   반드시 통과 가능하다. 스무딩된 대각선이 벽 모서리에 걸릴 때의 탈출구다.
   */
  _path(dg, wx, wz, smooth = true) {
    const [sgx, sgz] = worldToGrid(this.pos.x, this.pos.z, dg.w, dg.h);
    const [tgx, tgz] = worldToGrid(wx, wz, dg.w, dg.h);
    const raw = findPath(dg, sgx, sgz, tgx, tgz);
    if (!raw) { this.path = []; this.dest = null; return false; }
    this.path = toWorldPath(dg, smooth ? smoothPath(dg, raw) : raw);

    // 마지막 웨이포인트를 클릭한 지점 그대로 쓰되, **그 지점이 걸을 수 있을 때만**.
    // 벽 안을 클릭했는데 그대로 목표로 삼으면 영영 도달할 수 없다.
    if (this.path.length && walkable(dg, tgx, tgz))
      this.path[this.path.length - 1] = { x: wx, z: wz };

    if (this.path.length > 1) this.path.shift();     // 현재 칸은 버린다
    this.dest = this.path.length ? this.path[this.path.length - 1] : null;
    this.noSmooth = !smooth;
    this._resetProgress();
    return true;
  }

  /** 웨이포인트 진척도 추적 초기화 */
  _resetProgress() {
    this.stuckT = 0;
    this.lastWpDist = Infinity;
  }

  stop() { this.path = []; this.dest = null; this._resetProgress(); }

  dash(dir, dur = 0.22) {
    this.dashT = dur;
    this.dashDir.copy(dir).setY(0).normalize();
    this.invuln = Math.max(this.invuln, dur + 0.06);
    this.stop();
  }

  // ── 프레임 ──────────────────────────────────────────────
  update(dt, G) {
    if (this.dead) { this._animate(dt, 0); return; }

    this.attackCd = Math.max(0, this.attackCd - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.repathCd = Math.max(0, this.repathCd - dt);
    this.holdRepathCd = Math.max(0, this.holdRepathCd - dt);
    this.chaseRepathCd = Math.max(0, this.chaseRepathCd - dt);
    for (const k of ['hp', 'mp']) this.potionCd[k] = Math.max(0, this.potionCd[k] - dt);

    // 마나 자연 회복 — 스킬을 계속 쓸 수 있게 넉넉히
    this.mp = Math.min(this.maxMp, this.mp + (3.2 + this.level * 0.35) * dt);

    // 랜턴 연료 — 시간이 자원이다
    if (this.lantern && this.lantern.fuel > 0) {
      this.lantern.fuel -= dt;
      if (this.lantern.fuel <= 0) {
        this.lantern.fuel = 0;
        G.onLanternOut(this.lantern);
        this.lantern = null;
      }
    }

    let moved = 0;
    const dg = G.dungeon;

    if (this.dashT > 0) {
      this.dashT -= dt;
      const step = 21 * dt;
      const nx = this.pos.x + this.dashDir.x * step;
      const nz = this.pos.z + this.dashDir.z * step;
      const r = resolveCollision(dg, nx, nz, this.radius);
      this.pos.set(r.x, 0, r.z);
      this.facing = Math.atan2(this.dashDir.x, this.dashDir.z);
      moved = 1;
      if (r.hit) this.dashT = 0;
    } else if (this.path.length) {
      const wp = this.path[0];
      const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.22) {
        this.path.shift();
        this._resetProgress();
      } else {
        const step = Math.min(d, this.speed * dt);
        const nx = this.pos.x + (dx / d) * step;
        const nz = this.pos.z + (dz / d) * step;
        const r = resolveCollision(dg, nx, nz, this.radius);
        this.pos.set(r.x, 0, r.z);
        this.facing = Math.atan2(dx, dz);
        moved = Math.min(1, step / (this.speed * dt || 1));

        // ── 끼임 감지: 웨이포인트에 가까워지고 있는가 ──────────────
        // 「벽에 닿았나(r.hit)」로 판단하면 벽을 따라 정상적으로 미끄러지는
        // 경우까지 끼임으로 오해한다. 실제로 거리가 줄고 있는지만 본다.
        const nd = Math.hypot(wp.x - this.pos.x, wp.z - this.pos.z);
        if (nd > this.lastWpDist - 0.008) this.stuckT += dt;
        else this.stuckT = 0;
        this.lastWpDist = nd;

        if (this.stuckT > 0.35) {
          this.stuckT = 0;
          this.lastWpDist = Infinity;
          if (this.path.length > 1) {
            // 1단계 — 걸린 웨이포인트를 버리고 다음 것으로 간다
            this.stuckEvents.skipWaypoint++;
            this.path.shift();
          } else if (this.dest && !this.noSmooth) {
            this.stuckEvents.unsmooth++;
            // 2단계 — 스무딩을 끄고 칸 단위 경로로 다시 뽑는다.
            //   스무딩된 대각선이 벽 모서리에 걸린 경우가 여기서 풀린다.
            this._path(dg, this.dest.x, this.dest.z, false);
          } else {
            // 3단계 — 그래도 못 가면 포기한다. 계속 벽을 밀고 있는 것보다 낫다.
            this.stuckEvents.giveUp++;
            this.stop();
          }
        }
      }
    }

    // 어떤 이유로든 벽 안에 박혔으면 가장 가까운 바닥으로 빼낸다.
    // 밀어내기만으로는 두께 2칸 이상의 벽 안쪽에서 빠져나오지 못한다.
    const esc = unstick(dg, this.pos.x, this.pos.z);
    if (esc.moved) this.pos.set(esc.x, 0, esc.z);

    this.obj.position.copy(this.pos);
    this._animate(dt, moved);
  }

  _animate(dt, moved) {
    const r = this.rig;
    // 몸통은 진행 방향을 부드럽게 따라간다
    let d = this.facing - r.group.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    r.group.rotation.y += d * Math.min(1, dt * 16);

    // 걷기: 다리 교차 + 상체 상하
    if (moved > 0.05) {
      this.walkT += dt * 11;
      const s = Math.sin(this.walkT);
      r.legL.rotation.x = s * 0.75;
      r.legR.rotation.x = -s * 0.75;
      r.torso.position.y = 0.62 + Math.abs(Math.sin(this.walkT * 2)) * 0.045;
      r.armL.rotation.x = -s * 0.34;
    } else {
      r.legL.rotation.x *= 1 - Math.min(1, dt * 9);
      r.legR.rotation.x *= 1 - Math.min(1, dt * 9);
      r.armL.rotation.x *= 1 - Math.min(1, dt * 9);
      r.torso.position.y += (0.62 - r.torso.position.y) * Math.min(1, dt * 9);
    }

    // 공격 스윙: 예비(뒤로) → 타격(앞으로) → 복귀
    if (this.swing > 0) {
      this.swing = Math.max(0, this.swing - dt * 4.4);
      const k = 1 - this.swing;                  // 0 → 1
      const a = k < 0.32 ? -1.15 * (k / 0.32) : -1.15 + 2.5 * ((k - 0.32) / 0.68);
      r.armR.rotation.x = a;
      r.armR.rotation.z = -0.25 * Math.sin(k * Math.PI);
      r.torso.rotation.y = 0.3 * Math.sin(k * Math.PI);
    } else {
      r.armR.rotation.x += (0.05 - r.armR.rotation.x) * Math.min(1, dt * 9);
      r.armR.rotation.z *= 1 - Math.min(1, dt * 9);
      r.torso.rotation.y *= 1 - Math.min(1, dt * 9);
    }

    // 피격 플래시
    const f = this.hurtT > 0 ? this.hurtT / 0.18 : 0;
    for (const m of this.rig.materials) {
      if (m === this.rig.bladeMat) continue;
      m.emissive.setRGB(f * 0.85, f * 0.12, f * 0.12);
    }
  }

  /** 무기 끝 월드 좌표 — 타격 이펙트를 붙이는 곳 */
  weaponTip(out = new THREE.Vector3()) {
    this.rig.blade.getWorldPosition(out);
    return out;
  }

  center(out = new THREE.Vector3()) {
    return out.set(this.pos.x, 0.95, this.pos.z);
  }
}
