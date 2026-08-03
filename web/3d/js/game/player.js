// 플레이어 — 저폴리 기사. 메시도 전부 코드로 조립한다(외부 모델 0).

import * as THREE from 'three';
import { makeBlobShadow } from '../core/fx.js';
import { makeActor } from '../core/actor.js';
import { buildKnight } from '../core/models.js';
import { Pose } from '../core/rig.js';
import { poseHumanoid, poseRest, STANCE, stanceFor } from '../core/anim.js';
import { GROWTH, perHit } from './growth-table.js';
import { attachWeapon } from '../core/weapons.js';
import { aggregate, RARITIES, SLOTS, power } from './items.js';
import { findPath, smoothPath, toWorldPath, resolveCollision, sweep, unstick, walkable } from '../world/nav.js';
import { worldToGrid, gridToWorld } from '../world/dungeon.js';
import { MOVE_SCALE, ATTACK_SCALE } from './pace.js';
import { Sfx } from '../core/audio.js';

// 한 걸음의 보폭(월드 유닛). 격자 한 칸이 2.0 이므로 한 칸에 약 1.3 걸음이다 —
// 화면의 다리 움직임과 맞춰 귀로 들어 정한 값이다.
const STRIDE = 1.55;

const RADIUS = 0.42;
const BASE_SPEED = 6.2;

export { buildKnight };

/**
 * 기사의 자세 — 이제 **관절을 아는 곳은 core/anim.js 하나**다.
 *
 * 예전에는 이 파일 안에 knightBody() 가 있었고, 어깨와 골반 두 관절만 굽혔다.
 * 그래서 무엇을 하든 널빤지를 흔드는 것으로 보였다. 지금은 팔꿈치·무릎·목·발이
 * 생겼고, 그 관절을 굽히는 방법은 종족과 무관하게 같다 — 다른 것은 STANCE 뿐이다.
 *
 * 게임 로직(아래 update)은 여전히 동사만 고른다. 산 모델을 넣으면 GltfActor 가
 * 같은 동사를 AnimationMixer 로 수행한다 (core/actor.js).
 */
function knightPoser(rig, P) {
  // **rig 에서 매번 읽는다.** 무기를 바꿔 끼면 자세도 바뀌는데, 여기서 한 번
  // 잡아 두면 그 순간의 자세가 영원히 남는다 — 대검을 껴도 한손검 동작이 나온다.
  // 참조 하나 읽는 비용이라 프레임 예산에는 안 잡힌다.
  const st = () => rig.stanceObj || STANCE.knight;
  const body = (r, t, k, c) => poseHumanoid(r, P, st(), c);
  return {
    idle: body, walk: body, attack: body, hit: body, die: body,
    // 앉기(C) 만 따로다. 다른 동작 위에 겹치는 게 아니라 **대체**하므로.
    rest: (r, t, k, c) => poseRest(r, P, st(), c.resting, Math.min(c.dt, 0.05)),
  };
}

export class Player {
  constructor(scene) {
    this.scene = scene;
    const k = buildKnight();
    this.rig = k;
    // 게임 로직과 메시 사이의 벽 (core/actor.js). 에셋 교체의 전제다.
    this.pose = new Pose(k);
    this.actor = makeActor(k, knightPoser(k, this.pose));
    this.obj = new THREE.Group();
    this.obj.add(k.group);
    this.shadow = makeBlobShadow(1.5);
    this.obj.add(this.shadow);
    scene.add(this.obj);

    this.pos = new THREE.Vector3();
    this.facing = 0;
    this.radius = RADIUS;
    // 발소리 — 걸은 거리를 모아 한 걸음씩 낸다
    this._stepAcc = 0;
    this._stepFromX = 0; this._stepFromZ = 0;
    this._stepRight = false;
    this.rootT = 0;              // 속박 남은 시간 (사슬 궁수)

    // 진행
    this.level = 1;
    this.xp = 0;
    this.xpNext = GROWTH.xp.first;
    this.potions = { hp: 5, mp: 5 };
    this.potionCd = { hp: 0, mp: 0 };
    // 랜턴 — 들고 있는 동안만 초당 1 씩 탄다. 다 타면 기본 등불로 돌아간다.
    this.lantern = null;
    this.torchRefuelT = 0;      // 벽 횃불 옆에 머문 시간

    // 장비 — 슬롯 8칸. **SLOTS 에서 만든다.**
    // 손으로 적어 뒀더니 슬롯을 5 → 8 로 늘릴 때 여기만 5칸으로 남아 있었다.
    // 목록이 두 군데 있으면 반드시 한쪽이 뒤처진다.
    this.equipped = Object.fromEntries(SLOTS.map((k) => [k, null]));
    this.bag = [];
    // 10×4 = 40. 디아블로2 의 가방과 같은 크기다.
    // 「인벤이 꽉 차면 줍질 못한다」는 지적이 있었고, 슬롯이 8칸으로 늘어난 만큼
    // 갈아입을 후보를 들고 다닐 자리도 있어야 한다.
    this.bagMax = 40;
    // 영혼 조각 — 잡몹이 확정으로 떨군다. 장비가 안 나와도 판이 헛되지 않게 하는 장치.
    this.coin = 0;

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
    this.lastGood = null;        // 마지막으로 걸을 수 있는 칸에 있었던 위치

    // 전투
    this.attackCd = 0;
    this.swing = 0;              // 0..1 스윙 진행도
    this.walkT = 0;
    this.hurtT = 0;
    // 피격 동작 (core/anim.js). hurtT 는 재질 플래시, hitT 는 자세다 — 서로 다르다.
    this.hitT = 0;
    this.hitDur = 0.38;
    this.hitPow = 1;
    this.hitFrom = null;
    this.invuln = 0;
    this.dashT = 0;
    this.dashDir = new THREE.Vector3();
    this.dead = false;
    this.resting = 0;            // 0=서 있음, 1=완전히 앉음 (game/rest.js)

    this.recompute();
    this.hp = this.maxHp;
    this.mp = this.maxMp;
  }

  // ── 스탯 ────────────────────────────────────────────────
  recompute() {
    const a = aggregate(this.equipped);
    this.bonus = a;
    const lv = this.level - 1;
    // 성장식은 game/growth-table.js 한 곳에 있다 — tools/sim.js 도 같은 걸 읽는다
    this.maxHp = GROWTH.hp.base + lv * GROWTH.hp.per + a.hp;
    this.maxMp = GROWTH.mp.base + lv * GROWTH.mp.per + a.mp;
    this.armor = GROWTH.armor.base + lv * GROWTH.armor.per + a.armor;
    this.critChance = GROWTH.crit.base + a.crit;
    this.critMult = GROWTH.critMult.base + a.cdmg / 100;
    // 전체 템포는 pace.js 가 정한다 (game/pace.js). 장비 보너스는 그 위에 얹힌다 —
    // 순서를 바꾸면 「+5% 이동 속도」가 체감상 다른 값이 되어버린다.
    this.speed = BASE_SPEED * MOVE_SCALE * (1 + a.speed / 100);
    this.attackSpeed = a.weaponSpeed * ATTACK_SCALE * (1 + a.aspd / 100) * (1 + lv * GROWTH.aspd.per);
    this.cdr = Math.min(0.45, a.cdr / 100);
    this.leech = a.leech;
    // ── 평평한 피해는 **초당**이지 타격당이 아니다 ──────────────
    //
    // 레벨 보너스와 「+피해」 접사를 타격마다 그냥 더하면, **빠른 무기가
    // 그 보너스를 더 자주 적용해서** 계열 균형이 레벨과 함께 무너진다.
    // 기반 표는 계열별 초당 피해를 8~11.5 안에 맞춰 뒀는데(items.js),
    // 실제로 9층에서 재 보니 단검 92.5 대 대검 77.3 으로 21% 벌어져 있었다.
    // 원인은 무기 표가 아니라 이 두 줄이었다.
    //
    // 공격 속도로 나누면 **초당 기여가 계열과 무관해진다.** 느린 무기는
    // 한 대가 커지고(대검이 큰 숫자를 띄운다) 빠른 무기는 작아진다 —
    // 그게 원래 의도한 그림이기도 하다.
    //
    // **무기 속도로만 나눈다.** attackSpeed 로 나누면 「+공격 속도」 접사가
    // 스스로를 상쇄해서 아무 효과가 없는 접사가 된다.
    const ph = perHit(a.weaponSpeed);
    this.dmgMin = a.dmgMin + (a.dmg + lv * GROWTH.dmgMin.per) * ph;
    this.dmgMax = a.dmgMax + (a.dmg + lv * GROWTH.dmgMax.per) * ph;
    // 이 게임에만 있는 축들 (docs/ITEM-ECONOMY.md §3-3).
    // 접사를 스탯으로만 두고 아무 데서도 안 읽으면 그건 그냥 툴팁 장식이다 —
    // 여섯 개 전부 실제로 쓰이는 곳을 정해 뒀다.
    this.thorns = a.thorns;               // combat.hitPlayer 가 반사한다
    this.fuelBonus = a.fuel;              // game/lantern.js 의 연료 상한에 더해진다
    this.find = a.find;                   // rollItem 의 등급 밀기
    this.stunChance = a.stun;             // combat.hitEnemy 가 굴린다
    this.reach = a.range;                 // 평타 사거리에 더해진다
    this.regen = a.regen;                 // 초당 회복
    this.element = a.element || 'none';   // 무기 속성 — combat.hitEnemy 가 읽는다
    // 방어 속성 — combat.hitPlayer 가 읽는다 (docs/ELEMENTS.md §6-5).
    // **여기서 한 번 계산해 둔다.** 매 타격마다 장비를 훑으면 스물여섯 마리가
    // 때릴 때 그 일을 스물여섯 번 한다.
    this.defElement = a.defElement || 'none';
    this.defCover = a.defCover || 0;
    this.hp = Math.min(this.hp ?? this.maxHp, this.maxHp);
    this.mp = Math.min(this.mp ?? this.maxMp, this.maxMp);
    this._syncWeapon();
    this._syncBlade();
  }

  /**
   * 장착한 무기의 **계열이 화면에 보이게** 한다.
   *
   * 예전에는 이 함수가 없었고 _syncBlade(색만 바꿈)가 전부였다. 그래서
   * 처형자(대검)를 껴도 짧은 한손검이 보였고, 단검을 껴도 대검처럼 휘둘렀다.
   * 무기를 바꿔 끼는 것이 이 게임의 핵심 보상인데 그게 화면에 없었다.
   *
   * **계열이 그대로면 아무것도 안 한다.** 이 함수는 recalc() 를 타고
   * 레벨업·물약·층 이동마다 불리는데, 매번 메시를 새로 만들면 지오메트리를
   * 계속 버리고 만들게 된다.
   */
  _syncWeapon() {
    const fam = this.equipped.weapon?.fam || '검';
    if (fam === this.rig.weaponFam) return;
    attachWeapon(this.rig, fam, this.rig.weaponPal);
    // 자세도 같이 간다 — 무기가 바뀌면 **팔이 하는 일**이 바뀐다.
    // 한 번 합쳐서 들고 있는다. 매 프레임 합치면 프레임마다 객체가 하나 생긴다.
    this.rig.stanceObj = stanceFor(STANCE.knight, this.rig.weaponFam);
    this._syncBlade();     // 새 날에 등급 발광을 다시 입힌다
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
    // 「실제로 갈아입었는가」가 드랍 설계의 진짜 지표다 (ITEM-ECONOMY §7-1).
    // 주운 개수가 아니라 이 숫자가 0 이면 드랍은 보상이 아니라 소음이다.
    if (power(item) > power(prev)) this._onUpgrade?.();
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
      // 1.42 는 너무 가팔랐다. 경험치에 층 배수가 없으므로(파밍 방지 —
      // docs/FLOORS.md §7-b-4) 곡선이 성장의 전부인데, 5층부터 9층까지
      // 다섯 층 동안 레벨이 10 → 12 로 두 칸밖에 안 올랐다. 그동안 적은
      // powerMult 2.80 → 4.60 으로 강해진다. 1.34 로 낮추면 같은 구간이
      // 11 → 14 가 되어 스킬 포인트도 셋 더 나온다.
      this.xpNext = Math.round(this.xpNext * GROWTH.xp.mul + GROWTH.xp.add);
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
    // 속박 — 사슬 궁수(docs/FLOORS.md §5-2). 남은 동안은 못 걷는다.
    // 스킬과 공격은 막지 않는다: 완전히 아무것도 못 하면 조작을 뺏는 것이다.
    if (this.rootT > 0) {
      this.rootT -= dt;
      if (this.rootT <= 0) this.rootT = 0;
      else this.path.length = 0;
    }
    if (this.dead) { this._animate(dt, 0); return; }

    this.attackCd = Math.max(0, this.attackCd - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.repathCd = Math.max(0, this.repathCd - dt);
    this.holdRepathCd = Math.max(0, this.holdRepathCd - dt);
    this.chaseRepathCd = Math.max(0, this.chaseRepathCd - dt);
    for (const k of ['hp', 'mp']) this.potionCd[k] = Math.max(0, this.potionCd[k] - dt);

    // 마나 자연 회복 — 스킬을 계속 쓸 수 있게 넉넉히
    this.mp = Math.min(this.maxMp, this.mp + (GROWTH.mpRegen.base + this.level * GROWTH.mpRegen.per) * dt);
    // 체력은 기본으로는 안 찬다. regen 접사가 붙었을 때만 — 물약이 자원이어야 하므로.
    if (this.regen) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);

    // 랜턴 연료 — 시간이 자원이다
    if (this.lantern && this.lantern.fuel > 0) {
      // 「랜턴 심지」가 소모를 줄인다 (game/skilltree.js). 안 찍었으면 1 이다.
      this.lantern.fuel -= dt * (G.tree ? (G.tree.mods('common').fuelBurn ?? 1) : 1);
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
      // 대시는 초당 21유닛이다. 한 번에 밀면 벽을 뚫는다(감사 최악 16.8유닛).
      const r = sweep(dg, this.pos.x, this.pos.z, this.dashDir.x * step, this.dashDir.z * step, this.radius);
      this.pos.set(r.x, 0, r.z);
      this.facing = Math.atan2(this.dashDir.x, this.dashDir.z);
      moved = 1;
      if (r.hit) this.dashT = 0;
    } else if (this.rootT > 0) {
      // 묶여 있는 동안은 안 걷는다. 대시(위)는 **막지 않는다** —
      // 벗어날 수단이 하나는 있어야 「묶였다」가 사고가 아니라 판단이 된다.
      moved = 0;
    } else if (this.path.length) {
      const wp = this.path[0];
      const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.22) {
        this.path.shift();
        this._resetProgress();
      } else {
        const step = Math.min(d, this.speed * dt);
        const r = sweep(dg, this.pos.x, this.pos.z, (dx / d) * step, (dz / d) * step, this.radius);
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
    // 벽 안에 박혔으면 빼낸다. 못 빼내면 **직전에 검증된 위치**로 되돌린다 —
    // 예전엔 실패 시 그냥 두어서, 비보행 칸에 남은 채 경로가 비면 영구 정지했다.
    const esc = unstick(dg, this.pos.x, this.pos.z, this.lastGood);
    if (esc.moved) this.pos.set(esc.x, 0, esc.z);
    this._footsteps(dt, dg);
    // 이번 프레임 위치가 합법이면 다음 사고 때 쓸 안전지대로 기억한다
    {
      const [lgx, lgz] = worldToGrid(this.pos.x, this.pos.z, dg.w, dg.h);
      if (walkable(dg, lgx, lgz)) {
        if (!this.lastGood) this.lastGood = { x: this.pos.x, z: this.pos.z };
        else { this.lastGood.x = this.pos.x; this.lastGood.z = this.pos.z; }
      }
    }

    this.obj.position.copy(this.pos);
    this._animate(dt, moved);
  }

  /**
   * 발소리 — **걸은 거리**로 낸다. 시간으로 내면 벽에 밀려 제자리걸음 할 때도
   * 소리가 나고, 이동 속도 접사를 붙이면 걸음과 소리가 어긋난다.
   *
   * 이 게임에서 발소리는 분위기가 아니라 정보다: 랜턴 반경(9) 밖은 안 보이므로
   * **귀가 눈을 대신하는 구간**이 있다. 걸음마다 발을 번갈아 내야 두 걸음이
   * 한 소리로 뭉치지 않는다.
   */
  _footsteps(dt, dg) {
    const d = Math.hypot(this.pos.x - this._stepFromX, this.pos.z - this._stepFromZ);
    this._stepFromX = this.pos.x; this._stepFromZ = this.pos.z;
    if (this.dead || this.resting) { this._stepAcc = STRIDE * 0.6; return; }
    this._stepAcc += d;
    if (this._stepAcc < STRIDE) return;
    this._stepAcc -= STRIDE;
    this._stepRight = !this._stepRight;
    Sfx.step({ vol: 0.62, right: this._stepRight, wet: dg?.act === 'flood' });
  }

  _animate(dt, moved) {
    // 여기서 하는 일은 **동사를 고르는 것**뿐이다. 관절은 core/anim.js 가 안다.
    // 모델을 사서 갈아 끼우면 이 함수는 한 줄도 안 바뀐다 (core/actor.js).
    if (moved > 0.05) this.walkT += dt * 11 * MOVE_SCALE;
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 4.4 * ATTACK_SCALE);
    if (this.hitT > 0) this.hitT = Math.max(0, this.hitT - dt);
    // 대기 동작(호흡·무게중심)의 시계. 게임 시각과 따로 두는 이유는
    // 층을 넘어도 호흡이 이어져야 하기 때문 — G.time 은 층마다 초기화된다.
    this.animT = (this.animT || 0) + dt;

    const clip = this.dead ? 'die'
      : this.resting > 0 ? 'rest'
        : this.swing > 0 ? 'attack'
          : moved > 0.05 ? 'walk' : 'idle';

    // 앉았다 일어설 때 몸이 바닥에 박힌 채로 남지 않게 — **이제는 필요 없다.**
    // 옛 앉기는 group.position.y 를 직접 눌렀고, 그래서 일어설 때 손으로
    // 되돌려야 했다. 지금은 관절(root·hips·무릎)로 앉으므로 자세가 스스로
    // 풀린다. poseHumanoid 가 앉기 전용 축까지 매 프레임 0 으로 놓는다.

    // 맞은 방향을 **몸 기준**으로 돌린다. 월드 방향 그대로 쓰면 내가 어느 쪽을
    // 보고 있든 늘 같은 쪽으로 꺾여서, 등 뒤에서 맞아도 앞으로 넘어간다.
    let hx = 0, hz = 1;
    if (this.hitT > 0 && this.hitFrom) {
      const c = Math.cos(-this.facing), s = Math.sin(-this.facing);
      hx = this.hitFrom.x * c - this.hitFrom.z * s;
      hz = this.hitFrom.x * s + this.hitFrom.z * c;
    }

    this.actor.play(clip, {
      dt, moved, swing: this.swing, resting: this.resting,
      facing: this.facing, walkT: this.walkT, time: this.animT,
      // 피격은 다른 동작을 **대체하지 않고 위에 겹친다** — 맞았다고 걸음이
      // 멈추면 조작이 끊긴다. 그래서 clip 이 아니라 ctx 로 넘어간다.
      hitT: this.hitT || 0, hitDur: this.hitDur || 0.38, hitPow: this.hitPow || 1,
      hitDirX: hx, hitDirZ: hz,
    });
    this.actor.update(dt);

    // 피격 플래시는 자세가 아니라 **재질**이라 Actor 밖에 둔다.
    // 산 모델로 갈아 끼워도 이 코드는 그대로 쓸 수 있어야 한다.
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
