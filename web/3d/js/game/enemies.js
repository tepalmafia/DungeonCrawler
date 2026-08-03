// 적 — 실루엣이 서로 겹치지 않게 「머리 × 몸 비율 × 무기」를 종족마다 확정한다.
// (docs/ART-PLAN-v200.md §3-3 의 원칙을 3D 메시에 적용)

import * as THREE from 'three';
import { makeBlobShadow } from '../core/fx.js';
import { hitPlayer, Projectile, volAt } from './combat.js';
import { Sfx } from '../core/audio.js';
import { findPath, smoothPath, toWorldPath, resolveCollision, sweep, lineOfSight, unstick } from '../world/nav.js';
import { worldToGrid, gridToWorld } from '../world/dungeon.js';
import { MOVE_SCALE, ATTACK_SCALE, ATTACK_TIME, DIE_TIME } from './pace.js';
import { AI, pickIdle, updateIdle, visionFactor, reactionDelay, findFlank, SHOUT, NOISE, SEARCH, FLEE } from './ai.js';
import { TRAITS, ELITE_SKILLS, makeElite, makeAura } from './elites.js';
import { makeActor } from '../core/actor.js';
import { buildSkeleton, buildGhoul, buildArcher, buildGolem } from '../core/models.js';
import { Pose } from '../core/rig.js';
import { poseHumanoid, faceTowards, STANCE, stanceFor } from '../core/anim.js';
import { ELEMENTS, ENEMY_ELEMENT, rollElement } from './elements.js';
import { floorDef } from '../world/floors.js';

// 전 종족 체력 배수. 「한 마리씩 오래 싸운다」는 설계라 한 판이 길어야 하는데,
// 아이템·스킬이 늘면서 플레이어 쪽만 세졌다. 한 곳에서 올린다 —
// 종족마다 hp 를 손보면 종족 간 균형이 같이 흔들린다.
export const HP_SCALE = 1.3;

const V = new THREE.Vector3();

// 개체마다 다른 상수 하나. 완전히 겹친 둘을 떼어낼 때 방향을 만드는 데 쓴다 —
// 같은 방향으로 밀면 둘이 나란히 움직여 영원히 겹쳐 있다.
let UID = 0;

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

/**
 * 적의 자세 — **관절을 아는 곳은 core/anim.js 하나**다 (core/actor.js 참조).
 *
 * 종족마다 리그가 다르지만(궁수는 다리가 없고 부유한다) 동작 이름은 같다.
 * 다른 것은 STANCE 하나뿐이다 — 보폭·무릎 굽힘·예비 동작 길이·무게.
 * 산 모델을 넣으면 GltfActor 가 같은 이름의 클립을 재생한다.
 */
function enemyPoser(rig) {
  const P = new Pose(rig);
  // 무기 계열이 자세를 덮어쓴다 — 창을 든 해골은 베지 않고 **찌른다.**
  // 종족 자세를 대체하는 게 아니라 얹는 것이라, 걸음걸이와 덜그럭거림은
  // 해골 것으로 남는다. 적은 무기를 바꿔 끼지 않으므로 여기서 한 번만 합친다.
  const st = stanceFor(STANCE[rig.stance] || STANCE.skeleton, rig.weaponFam);
  const body = (r, t, k, c) => poseHumanoid(r, P, st, c);
  return { idle: body, walk: body, attack: body, hit: body, die: body };
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
    hp: 58, dmg: 8, armor: 1, speed: 5.0, radius: 0.38, range: 1.4,
    windup: 0.3, recover: 0.6, aggro: 9.5, leash: 22, xp: 14, scale: 1.0, gib: 0x7d8a5a,
    leap: true,
  },
  archer: {
    key: 'archer', name: '망령 궁수', build: buildArcher,
    hp: 66, dmg: 11, armor: 2, speed: 3.2, radius: 0.4, range: 11,
    windup: 0.7, recover: 1.05, aggro: 12.5, leash: 24, xp: 20, scale: 1.0, gib: 0x7fb4d6,
    ranged: true, keepAway: 6.5, float: true,
  },
  golem: {
    key: 'golem', name: '무덤 골렘', build: buildGolem,
    hp: 265, dmg: 21, armor: 13, speed: 2.3, radius: 0.75, range: 2.4,
    windup: 0.9, recover: 1.25, aggro: 8, leash: 18, xp: 75, scale: 1.15, gib: 0x8a8a92,
    heavy: true, elite: true, slam: 3.4,
  },
};

// ───────────────────────── 변종 ─────────────────────────
//
// **같은 몸, 다른 규칙** (docs/FLOORS.md §1-2 · §5-2).
// 종족을 새로 만드는 것보다 훨씬 싸고, 난이도 설계에는 더 좋다 —
// 「아는 실루엣인데 규칙이 다르다」가 「모르는 실루엣」보다 긴장을 만든다.
//
// ★ **`key` 는 원본 그대로 둔다.** 이게 이 파일에서 제일 중요한 규칙이다.
//   저장소에 종족 키로 찾는 표가 여덟 개 있다 — 소리(VOICE) · 시체(REMAINS) ·
//   대사(LINES·TINT) · 정예 기술(SKILL_BY_KIND) · 외침(SHOUT) · 대기 자세
//   (BY_KIND) · 속성(ENEMY_ELEMENT) · 랜턴 드랍. 새 키를 주면 **여덟 곳이
//   전부 조용히 기본값으로 떨어진다** — 소리 없는 어그로, 시체 없는 죽음,
//   벙어리, 전부 대지 강타. 오류는 한 줄도 안 난다. (정찰에서 확인했다.)
//
//   그래서 인덱스 이름만 새로 주고 `key` 는 원본을 쓴다.
//   구분은 `variant`(계측·검사용)와 **규칙 필드**로 한다.
const variant = (base, over) => ({ ...ARCHETYPES[base], ...over });

// 해골 창병 — 사거리가 길고 선딜이 길다. **간격 관리**를 가르친다 (2층)
// **무기가 규칙을 설명한다.** 사거리 2.9 는 숫자로는 안 보이고 자루 길이로
// 보인다. 이게 없으면 원본과 똑같이 생긴 해골이 두 배 먼 데서 때리는 꼴이라
// 「왜 저기서 맞지」가 된다.
ARCHETYPES.spearman = variant('skeleton', {
  variant: 'spearman', name: '해골 창병', build: () => buildSkeleton({ weapon: '창' }),
  range: 2.9, windup: 0.68, recover: 0.95, dmg: 9, xp: 19,
});

// 해골 방패병 — 정면이 단단하다. **각도**를 가르친다 (3층)
ARCHETYPES.shieldman = variant('skeleton', {
  variant: 'shieldman', name: '해골 방패병', build: () => buildSkeleton({ shield: true }),
  hp: 110, armor: 6, speed: 2.7, xp: 22,
  frontGuard: 0.6,       // 정면 60도 안에서 온 피해를 60% 막는다
});

// 성문 파수병 — 조 편성으로 나온다. 혼자면 평범하다 (7층)
ARCHETYPES.gatekeeper = variant('skeleton', {
  variant: 'gatekeeper', name: '성문 파수병', build: () => buildSkeleton({ weapon: '둔기' }),
  hp: 120, dmg: 11, armor: 7, aggro: 10, xp: 24,
});

// 익사한 순례자 — 죽으면 웅덩이를 남긴다. **죽인 자리가 함정이 된다** (5층)
ARCHETYPES.drowned = variant('ghoul', {
  variant: 'drowned', name: '익사한 순례자',
  hp: 70, speed: 4.6, xp: 18,
  deathPuddle: { r: 2.6, t: 5, mul: 0.55 },
});

// 사슬 궁수 — 화살이 관통하고 잠깐 묶는다. **엄폐를 강요한다** (6층)
ARCHETYPES.chainer = variant('archer', {
  variant: 'chainer', name: '사슬 궁수',
  hp: 78, dmg: 10, recover: 1.5, xp: 26,
  arrowPierce: 2, arrowRoot: 0.55,
});

// 왕의 조각상 — 부술 때까지 안 움직인다. **선택할 수 있는 위협**이다 (8층)
ARCHETYPES.statue = variant('golem', {
  variant: 'statue', name: '왕의 조각상',
  hp: 300, dmg: 21, armor: 16, aggro: 6, xp: 90,
  immobile: true,
});

// ───────────────────────── 개체 ─────────────────────────
export class Enemy {
  constructor(G, defKey, x, z, powerMult = 1) {
    this.G = G;
    this.uid = ++UID;
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
    // ── 피해는 체력보다 빨리 오른다 ────────────────────────────
    //
    // 셋 다 powerMult 를 그냥 곱했더니, 층이 깊어져도 **긴장이 안 올랐다.**
    // 내가 죽는 데 걸리는 시간 ÷ 적을 죽이는 데 걸리는 시간(여유)을 재 보면
    // 1층 8.8 · 9층 7.6 이다 — 아홉 층을 내려가는 동안 거의 그대로다.
    // 플레이어도 레벨과 장비로 같은 비율로 세지기 때문이다.
    //
    // 체력만 올리면 「더 오래 두들기는」 게임이 되고, 피해를 같이 올려야
    // 「조심하는」 게임이 된다. 지수 1.24 면 1층은 그대로(1^1.28 = 1)이고
    // 9층만 4.60 → 6.9 로 오른다 — **초반은 안 건드리고 후반만 조인다.**
    this.dmg = d.dmg * Math.pow(powerMult, 1.24);
    this.armor = d.armor * powerMult;
    this.atkSpeedMul = 1;      // 정예 특성이 올린다
    // 속성 — 기본은 종족값. spawnFloor 가 층 분포로 덮어쓴다 (game/elements.js).
    // **`defKey` 가 아니라 `d.key` 로 찾는다.** 둘은 지금 같지만 곧 갈라진다 —
    // 변종(해골 창병 등)은 ARCHETYPES 인덱스가 'spearman' 이면서 `key: 'skeleton'`
    // 을 들고 있게 된다(docs/FLOORS.md §5-2). 인덱스로 찾으면 그 순간
    // `ENEMY_ELEMENT['spearman']` 이 undefined 가 되어 **조용히 무속성**이 된다.
    // 층 스폰은 setElement 가 덮어써서 안 보이지만 보스 소환은 안 덮는다.
    this.element = ENEMY_ELEMENT[d.key] || 'none';
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
    this.poseTick = (Math.random() * 4) | 0;   // LOD 갱신 프레임을 흩뜨린다
    this.poseDt = 0;
    this.dist2Player = 0;
    // 피격 자세 (core/anim.js). recoil 은 몸통 전체 이동, hit 은 관절 반응이다.
    this.hitT = 0;
    this.hitDur = 0.42;
    this.hitPow = 1;
    this.hitFrom = null;
    this.stunT = 0;              // 기절 남은 시간 (둔기·stun 접사)
    this.recoilDir = { x: 0, z: 1 };
    this.recoilPow = 1;
    this.knockMoved = 0;              // 넉백으로 실제 밀려난 거리 — 실측용(core/metrics.js)
    this.lastGood = null;             // 마지막으로 걸을 수 있는 칸에 있었던 위치
    this._stepAcc = Math.random() * 1.5;   // 발 맞춰 걷지 않게 흩뜨린다
    this._stepFromX = x; this._stepFromZ = z;
    this._stepRight = Math.random() < 0.5;

    // 미발견 상태의 「하는 일」 (game/ai.js). 종족마다 어울리는 것이 다르다.
    // 위와 같은 이유로 `d.key`. 인덱스로 찾으면 변종이 전부 'post'(기본값)로
    // 떨어져 **모두가 같은 자세로 서 있게** 된다 — 오류는 안 난다.
    this.idleKind = pickIdle(d.key);
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
    this.actor = makeActor(rig, enemyPoser(rig));   // core/actor.js — 에셋 교체의 전제
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
  /**
   * 속성을 **몸에 입힌다.**
   *
   * 툴팁이나 이름표로만 알리면 「읽어야 아는」 정보가 된다. 이미 빛나고 있는
   * 부위(눈·핵·불꽃)의 색을 갈아끼우면 멀리서 색 하나로 판별된다 —
   * 그게 docs/ELEMENTS.md §0 의 성공 조건이다.
   */
  setElement(key) {
    this.element = key;
    const el = ELEMENTS[key];
    if (!el || key === 'none') return this;
    this.obj.traverse((o) => {
      // MeshBasicMaterial 로 만든 것이 곧 「스스로 빛나는 부위」다
      if (o.isMesh && o.material?.isMeshBasicMaterial) o.material.color.setHex(el.hex);
    });
    for (const mm of this.mats) {
      if (!mm.emissive) continue;
      mm.emissive.setHex(el.hex);
      mm.emissiveIntensity = Math.max(mm.emissiveIntensity || 0, 0.1);
    }
    return this;
  }

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
      // ── 죽음 ──
      // 예전에는 **줄어들면서 팽이처럼 도는** 것이 전부였다. 그건 「사라졌다」지
      // 「쓰러졌다」가 아니다. 이제 자세(무릎 → 골반 → 상체, core/anim.js)가
      // 무너짐을 만들고, 여기서는 **남은 것을 지우는 일**만 한다.
      //
      // 그래서 시간이 두 배가 됐다. 0.55 초는 넘어지는 동작이 다 나오기 전에
      // 몸이 사라지는 길이다 — 잡은 손맛의 절반은 상대가 무너지는 걸 **보는** 데서 온다.
      this.dieT -= dt;
      const k = Math.max(0, this.dieT / DIE_TIME);
      const fade = Math.min(1, k / 0.42);        // 마지막 42% 구간에서만 옅어진다
      this.rig.group.scale.setScalar(this.def.scale * (0.82 + 0.18 * fade));
      this.rig.group.position.y = (1 - fade) * -0.45;
      for (const mm of this.mats) { mm.transparent = true; mm.opacity = fade; }
      this.shadow.material.opacity = 0.5 * fade;
      this.hpBar.visible = false;
      this.obj.position.copy(this.pos);
      this.actor.play('die', {
        dt, dieK: Math.min(1, 1 - k), facing: this.facing, time: this.animT || 0,
      });
      this.actor.update(dt);
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
    this.dist2Player = dist;          // 자세 LOD 가 읽는다 (_animate)

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
    // 「여운」 — 운석 자리가 잠시 느리게 한다 (game/skilltree.js).
    // 젖은 칸(docs/FLOORS.md §3-2)과 같은 원리라, 그게 들어오면 여기 합친다.
    this.slowMul = 1;
    if (G.slowZones && G.slowZones.length) {
      for (const z of G.slowZones)
        if (Math.hypot(this.pos.x - z.x, this.pos.z - z.z) < z.r + this.radius) {
          this.slowMul = Math.min(this.slowMul, z.mul);
        }
    }

    this._footsteps(G, moving);
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
    // ★ **잔상** — 「그림자 돌진」의 「잔상」 칸이 남긴 미끼 (game/skilltree.js).
    //   지나간 자리로 시선을 끈다: 돌진이 「도망치는 기술」에서
    //   **「떼어내는 기술」**이 된다.
    //
    //   미끼를 쫓을지 말지는 **거리로 정한다.** 무조건 쫓게 하면 코앞의
    //   플레이어를 두고 뒤돌아 걷는 우스운 그림이 나온다 — 미끼가 나보다
    //   가까울 때만 쫓는다.
    if (G.decoy && !this.isBoss) {
      const dd = Math.hypot(G.decoy.x - this.pos.x, G.decoy.z - this.pos.z);
      const dp = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
      if (dd < dp && dd > 0.6) {
        this.path.length = 0;
        return this._step(dt, G, G.decoy.x, G.decoy.z, this.speed);
      }
    }
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
    // 왕의 조각상 — **부술 때까지 안 움직인다.** 그래서 「지금 상대할지
    // 지나칠지」를 고를 수 있다 — 이 게임에 그런 위협이 하나도 없었다.
    // 시선은 돌린다: 완전히 굳어 있으면 조형물로 읽혀 위협이 안 된다.
    if (this.def.immobile) { this._face(tx, tz); return 0; }
    speed *= this.slowMul ?? 1;      // 느린 구역 (「여운」)
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
      // 사슬 궁수 — 화살이 **관통하고 잠깐 묶는다.** 엄폐를 강요한다:
      // 한 마리 뒤에 숨어도 화살이 지나오고, 맞으면 잠깐 못 움직인다.
      G.projectiles.push(new Projectile(G, {
        from, dir, speed: 15, dmg: this.dmg,
        color: d.arrowRoot ? 0xc8b0ff : 0x9fd8ff, fromPlayer: false, life: 2.4,
        pierce: d.arrowPierce || 0, root: d.arrowRoot || 0,
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

  /**
   * 몸이 겹치지 않게 밀어낸다 — **서로도, 플레이어와도.**
   *
   * 예전 판에는 두 가지 구멍이 있었다.
   *
   *   ① **플레이어가 목록에 없었다.** 적끼리만 밀어냈으므로 몬스터가
   *      플레이어 몸 안으로 그대로 걸어 들어왔다. 근접 사거리가 1.4~2.4 라
   *      「붙어서 때린다」가 「겹쳐서 때린다」가 됐다.
   *   ② **밀어내기가 너무 약했다.** `px * dt * 7` 은 스프링이라 한 프레임에
   *      겹침의 일부만 푼다. 그런데 추격은 매 프레임 다시 밀고 들어오므로,
   *      추격 속도가 밀어내는 속도보다 빠르면 **영영 안 풀린다.** 실제로
   *      여러 마리가 한 점에 뭉쳐 하나처럼 보였다.
   *
   * 그래서 **겹친 만큼을 그 프레임에 바로 없앤다**(dt 와 무관). 둘이 겹치면
   * 각자 절반씩 물러나므로 서로 밀어내는 셈이 되고, 진동하지 않는다.
   * 플레이어는 안 민다 — 조작 중인 몸이 밀리면 조작감이 무너진다. 적만 물러난다.
   *
   * 벽 안으로 밀려 들어가는 것은 `sweep` 이 막고, 그래도 끼면 바로 뒤의
   * `unstick` 이 빼낸다.
   */
  _separate(dt, G) {
    let px = 0, pz = 0, n = 0;

    const push = (ox, oz, orad, share) => {
      const dx = this.pos.x - ox, dz = this.pos.z - oz;
      const d2 = dx * dx + dz * dz;
      const rr = this.radius + orad;
      if (d2 > rr * rr) return;
      let ux, uz, d;
      if (d2 < 1e-6) {
        // 완전히 같은 자리 — 방향이 없으므로 하나 만들어 준다.
        // 개체마다 다른 각도를 써야 둘이 같은 쪽으로 밀려 계속 겹치지 않는다.
        const a = (this.uid ?? 0) * 2.399963;      // 황금각 — 고르게 흩어진다
        ux = Math.sin(a); uz = Math.cos(a); d = 0;
      } else {
        d = Math.sqrt(d2); ux = dx / d; uz = dz / d;
      }
      const overlap = (rr - d) * share;
      px += ux * overlap; pz += uz * overlap;
      n++;
    };

    for (const o of G.enemies) {
      if (o === this || o.dead) continue;
      push(o.pos.x, o.pos.z, o.radius, 0.5);       // 둘이 절반씩 물러난다
    }
    // ★ 플레이어. **플레이어는 안 밀고 적만 물러난다** — 조작 중인 몸이
    //   떠밀리면 「내가 움직였다」와 「밀렸다」가 구분이 안 된다.
    const p = G.player;
    if (p && !p.dead) push(p.pos.x, p.pos.z, p.radius, 1.0);

    if (!n) return;
    const r = sweep(G.dungeon, this.pos.x, this.pos.z, px, pz, this.radius);
    this.pos.set(r.x, 0, r.z);
  }

  /**
   * 적 발소리 — **가까운 놈만.**
   *
   * 랜턴 반경(9) 밖은 안 보이므로 「뭔가 다가온다」를 귀로 먼저 알 수 있어야
   * 한다. 다만 스물여섯 마리가 다 소리를 내면 그건 정보가 아니라 소음이다.
   * volAt() 이 거리로 깎고(28유닛 밖은 무음), 골렘은 무겁게 운다.
   * 궁수는 떠다니므로 발소리가 없다 — 그게 실루엣과도 맞다.
   */
  _footsteps(G, moving) {
    if (this.dead || !moving || this.def.float) return;
    const d = Math.hypot(this.pos.x - this._stepFromX, this.pos.z - this._stepFromZ);
    this._stepFromX = this.pos.x; this._stepFromZ = this.pos.z;
    const stride = 1.55 * (this.def.scale || 1);
    this._stepAcc += d;
    if (this._stepAcc < stride) return;
    this._stepAcc -= stride;
    this._stepRight = !this._stepRight;
    const v = volAt(G, this.pos);
    if (v < 0.06) return;
    Sfx.step({
      vol: v * 0.4, right: this._stepRight,
      heavy: this.heavy ? 1 : 0,
      wet: G.dungeon?.act === 'flood',
    });
  }

  _animate(dt, moving) {
    const rig = this.rig;
    // 시선은 **자세 LOD 와 무관하게** 매 프레임 돈다. 같이 건너뛰면 몸이
    // 뚝뚝 돌아가서, 걷는 것보다 그게 더 부산스럽게 보인다.
    faceTowards(rig, this.facing, dt, 12);

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
    // 자세가 아니라 **전체 변환**이라 Actor 밖에 둔다.
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

    // 보폭 시계는 여기서 굴린다 — 종족마다 속도가 달라 포저가 알 수 없다
    if (rig.float) this.walkT += dt * 2.2;
    else if (moving > 0.05) this.walkT += dt * (7 + this.speed);

    // 상태 → 공격 진행도(0~1). 예비 0.00~0.42 · 타격 0.42~0.60 · 여운 0.60~1.00
    // 은 core/anim.js 의 네 박자와 같은 구간이다. 둘이 어긋나면 예고가 거짓말이 된다.
    let armX = 0, atkK = 0;
    if (this.state === 'windup') {
      const u = Math.min(1, this.stateT / this.def.windup);
      armX = -1.5 * u;
      atkK = 0.42 * u;
    } else if (this.state === 'attack') {
      armX = 1.15;
      atkK = 0.42 + 0.18 * Math.min(1, this.stateT / 0.12);
    } else if (this.state === 'recover') {
      const u = Math.min(1, this.stateT / this.def.recover);
      armX = 1.15 * (1 - u);
      atkK = 0.60 + 0.399 * u;
    }

    const clip = this.dead ? 'die'
      : (this.state === 'windup' || this.state === 'attack' || this.state === 'recover') ? 'attack'
        : moving > 0.05 ? 'walk' : 'idle';
    // 피격 동작 — 맞은 방향을 **몸 기준**으로 돌린다. 월드 방향 그대로 넘기면
    // 적이 어느 쪽을 보든 늘 같은 쪽으로 꺾여, 등을 보인 적이 앞으로 넘어간다.
    if (this.hitT > 0) this.hitT = Math.max(0, this.hitT - dt);
    let hx = 0, hz = 1;
    if (this.hitT > 0 && this.hitFrom) {
      const co = Math.cos(-this.facing), si = Math.sin(-this.facing);
      hx = this.hitFrom.x * co - this.hitFrom.z * si;
      hz = this.hitFrom.x * si + this.hitFrom.z * co;
    }
    // ── 거리 LOD ──────────────────────────────────────────
    //
    // 관절이 6 개에서 18 개로 늘면서 자세 계산이 마리당 3 배가 됐다. 26 마리를
    // 매 프레임 전부 굴리니 시뮬레이션 중앙값이 3.8 → 6.2ms 로 올라 예산(6ms)을
    // 넘었다. 실측이 아니었으면 「좀 무거워졌나」로 넘어갔을 값이다.
    //
    // 처음에 16 유닛 밖을 2 프레임, 30 밖을 4 프레임에 한 번으로 잡았다.
    // **틀렸다.** 등불 반경(9)을 기준으로 삼았는데, 등불이 안 닿아도 달빛과
    // 앰비언트로 화면에는 보인다 — 카메라 거리가 19~34 다. 그 구간의 적들은
    // 위치는 매 프레임 움직이는데 다리만 띄엄띄엄 갱신돼서, 미끄러지며
    // **순간이동하는 것처럼** 보였다. 실제로 그 보고를 받았다.
    //
    // 기준을 카메라 최대 거리(34)로 올린다. 아낀 비용은 감쇠 계수 캐시로
    // 되찾는다(core/rig.js) — 건너뛰기는 눈에 보이고 그건 안 보인다.
    //
    // **건너뛰기는 자세만이다.** 예전에 여기서 return 해 버렸더니 아래 피격
    // 플래시까지 같이 건너뛰어, 멀리서 맞은 적이 흰색으로 굳어 있었다.
    // 시선 회전도 마찬가지라 위에서 매 프레임 따로 돌린다.
    this.poseDt = (this.poseDt || 0) + dt;
    const near = this.dist2Player || 0;
    const every = near < 38 ? 1 : 3;
    const pdt = this.poseDt;
    if ((++this.poseTick % every) === 0) {
      this.poseDt = 0;
      this._pose(clip, pdt, moving, armX, atkK, hx, hz);
    }

    // 피격 플래시 — **매 프레임** 돌아야 한다 (LOD 와 무관)
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

  /** 자세 한 프레임 — LOD 가 이걸 건너뛴다 */
  _pose(clip, pdt, moving, armX, atkK, hx, hz) {
    this.actor.play(clip, {
      dt: pdt, moving, walkT: this.walkT, armX, facing: this.facing, bobPhase: this.bobPhase,
      // 공격 진행도 0→1. 잡몹은 상태 시계로, 보스는 기술마다 따로 만든다
      // (보스의 「연타」는 한 번에 여러 번 감는다 — 상태 시계로는 표현이 안 된다).
      atk: this.bossAtk != null ? this.bossAtk : atkK,
      time: this.animT = (this.animT || 0) + pdt,
      // 죽음은 여기로 안 온다 — update() 의 dead 분기가 먼저 처리하고 돌아간다.
      dieK: 0,
      hitT: this.hitT || 0, hitDur: this.hitDur || 0.42, hitPow: this.hitPow || 1,
      hitDirX: hx, hitDirZ: hz,
    });
    this.actor.update(pdt);
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
  // 층별 값은 전부 world/floors.js 에서 온다. tier(반복 회차)만 여기서 얹는다 —
  // 층은 「새로운 것」이고 tier 는 「같은 것이 더 세다」라 역할이 다르다
  // (docs/FLOORS.md §1-4).
  const F = floorDef(floorNo);
  const powerMult = F.powerMult + tier * 0.35;
  const MIN_GAP = 6.5;          // 월드 유닛 — 어그로 반경(8~9)보다 조금 좁다
  const placed = [];

  const roster = F.roster;

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
    const squadRate = F.squadRate;
    const squadSize = AI.squads && rnd.chance(squadRate) ? rnd.int(2, 3) : 0;
    let squadCenter = null;
    if (rnd.chance(F.golemChance + tier * 0.05)) kinds.push('golem');

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
      // 층 분포가 종족 기본값을 덮는다 — 2층이 빙 특화층이 되는 것이 설계다
      e.setElement(rollElement(rnd, floorNo));
      // 정예 승격 — 층이 깊을수록 잦다. 골렘은 이미 정예 취급이라 제외한다.
      // 방마다 하나까지만: 정예 둘이 같은 방에 있으면 「한 마리씩」이 성립하지 않는다.
      // `key`(스폰 문자열)가 아니라 `e.def.key`(종족)로 판단한다. 변종이
      // 들어오면 스폰 문자열이 'statue' 같은 것이 되는데, 그건 골렘 몸이면서
      // 이름이 달라 **이미 정예인 놈이 또 정예로 승격**된다.
      if (e.def.key !== 'golem' && !roomElite && rnd.chance(F.eliteChance + tier * 0.03)) {
        e.promote(rnd, floorNo);
        roomElite = true;
      }
      out.push(e);
    }
  }
  return out;
}
