// 정예 — 「같은 몬스터인데 이번 것은 다르다」
//
// 디아블로의 챔피언·유니크와 같은 구조다. 종족은 그대로 두고 **특성**을 얹는다.
// 새 몬스터를 만드는 것보다 이쪽이 나은 이유:
//   · 실루엣을 이미 아는 놈이라 「무엇이 오는지」는 안다. 모르는 것은 **어떻게**다.
//   · 같은 해골이 어떤 판에서는 광포하고 어떤 판에서는 재생한다 —
//     방 하나하나가 다르게 읽힌다.
//
// ── 규칙 하나: 특성은 전부 「보이는」 것이어야 한다 ────────────
// 숨은 수치만 올리면 플레이어는 그냥 「이 놈은 왜 안 죽지」로 느낀다.
// 그래서 특성마다 색·입자·움직임 중 하나를 반드시 가진다.
//
// ── 규칙 둘: 정예도 한 마리씩 끌린다 ──────────────────────
// 정예 스킬 중 **주변 아군을 부르는 것은 넣지 않았다.** 이 게임의 전투 방식이
// 「한 마리씩 끌어내기」이고, 그걸 깨는 순간 난전이 되기 때문이다.
// 어렵게 만들되 설계를 어기지는 않는다.

import * as THREE from 'three';
import { MOVE_SCALE } from './pace.js';

// 정예 이동 속도 상한.
//
// 특성이 곱해지면 「날랜 광포한」 조합이 7.73 까지 나왔다 — 플레이어(4.34)의
// 1.8배다. 이 게임은 잘못 끌었을 때 **문 뒤로 빠지는 것**이 정석 대응인데,
// 따라잡히기만 하면 그 선택지가 통째로 사라진다. 어렵게 만드는 것과
// 대응할 수 없게 만드는 것은 다르다.
//
// 플레이어보다 조금 빠른 정도까지만 허용한다. 쫓기는 긴장은 남고,
// 문·모서리를 이용하면 떼어낼 수 있다.
const PLAYER_SPEED = 6.2 * MOVE_SCALE;
const SPEED_CAP = PLAYER_SPEED * 1.22;

/**
 * 특성.
 *   apply(e)  개체 생성 직후 한 번
 *   tick      매 프레임 (있으면)
 *   color     정예 오라 색 — 첫 특성의 색을 쓴다
 */
export const TRAITS = {
  frenzy: {
    name: '광포한', color: 0xff5a3a,
    desc: '공격과 이동이 빠르다',
    apply: (e) => { e.speed *= 1.38; e.atkSpeedMul = (e.atkSpeedMul || 1) * 1.35; },
  },
  ironskin: {
    name: '강철 피부의', color: 0x9fb4d8,
    desc: '방어도가 세 배',
    apply: (e) => { e.armor *= 3; },
  },
  regen: {
    name: '되살아나는', color: 0x7ac85a,
    desc: '초당 최대 체력 2% 회복',
    apply: (e) => { e.regenPct = 0.02; },
    tick: (e, dt) => {
      if (e.hp <= 0 || e.hp >= e.maxHp) return;
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.regenPct * dt);
    },
  },
  thorns: {
    name: '가시 돋친', color: 0xc9a44a,
    desc: '근접 피격을 반사한다',
    apply: (e) => { e.reflect = 0.28; },
  },
  swift: {
    name: '날랜', color: 0x9fd0ff,
    desc: '아주 빠르지만 무르다',
    apply: (e) => { e.speed *= 1.6; e.maxHp = Math.round(e.maxHp * 0.78); e.hp = e.maxHp; },
  },
  burning: {
    name: '타오르는', color: 0xff8a2b,
    desc: '죽을 때 터진다',
    apply: (e) => { e.deathBlast = 0.22; },
  },
};

/**
 * 스킬 — 정예 하나당 하나.
 *
 * 전부 **예고가 먼저**다. 예고 없는 큰 피해는 이 게임에 없다
 * (docs/DUNGEON-INTERACTIONS.md §3-1 과 같은 원칙).
 */
export const ELITE_SKILLS = {
  slam: {
    name: '대지 강타', cd: [6, 9], tell: 0.75, minRange: 0, maxRange: 4.5,
    fire: (G, e) => {
      const c = { x: e.pos.x, z: e.pos.z };
      G.fx.ground(e.pos, { r0: 0.4, r1: 4.2, color: 0xff7a3a, life: 0.4, opacity: 0.8 });
      G.fx.burst(e.center(), { count: 30, color: 0xff9a5a, speed: 8, size: 0.45, life: 0.6, grav: 10 });
      G.fx.addShake(0.2, 2);
      G.lighting?.flash(e.center(), 0xff7a3a, 60, 0.3);
      const p = G.player;
      if (!p.dead && Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < 4.2) {
        G.hitPlayerFrom(e, e.dmg * 1.5);
      }
    },
  },
  volley: {
    name: '삼연사', cd: [5, 8], tell: 0.6, minRange: 3, maxRange: 14,
    fire: (G, e) => {
      const p = G.player;
      const base = Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
      for (const off of [-0.22, 0, 0.22]) {
        const a = base + off;
        G.spawnEnemyShot(e, new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), e.dmg * 0.7);
      }
    },
  },
  charge: {
    name: '돌진', cd: [7, 10], tell: 0.55, minRange: 3.5, maxRange: 9,
    fire: (G, e) => {
      const p = G.player;
      const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z;
      const l = Math.hypot(dx, dz) || 1;
      // 도약과 같은 규칙 — 임펄스가 곧 이동 거리다. 간격만큼만 준다.
      const gap = Math.max(2, Math.min(6.5, l - e.def.range * 0.8));
      e.knock.set((dx / l) * gap, 0, (dz / l) * gap);
      e.chargeT = 0.6;
      G.fx.burst(e.center(), { count: 16, color: 0xffd070, speed: 3, size: 0.4, life: 0.45, grav: -1 });
    },
  },
};

const TRAIT_KEYS = Object.keys(TRAITS);
const SKILL_KEYS = Object.keys(ELITE_SKILLS);

/** 종족에 어울리는 스킬만 준다 — 궁수가 대지 강타를 쓰면 종족이 무의미해진다 */
const SKILL_BY_KIND = {
  skeleton: ['slam', 'charge'],
  ghoul: ['charge'],
  archer: ['volley'],
  golem: ['slam'],
};

/**
 * 개체를 정예로 승격시킨다.
 * @returns {{traits:string[], skill:string, name:string}}
 */
export function makeElite(e, rnd, floorNo = 1) {
  // 특성 수 — 층이 깊을수록 둘 붙을 확률이 오른다.
  //
  // **상한이 필요하다.** 층이 셋일 때는 0.25 + 3×0.1 = 0.55 라 문제가 없었는데,
  // 아홉 층이 되면 8층에서 1.05 가 되고 `rnd.chance` 는 `rnd() < p` 라
  // **p ≥ 1 이면 항상 참**이다 — 8·9층의 모든 정예가 무조건 2특성이 된다.
  // 확률이 조용히 확률이 아니게 되는 자리다 (정찰에서 잡았다).
  const n = rnd.chance(Math.min(0.85, 0.25 + floorNo * 0.1)) ? 2 : 1;
  const pool = TRAIT_KEYS.slice();
  rnd.shuffle(pool);
  const traits = pool.slice(0, n);

  e.elite = true;
  // 정예의 기본 배수. 특성이 여기에 더 얹힌다.
  e.maxHp = Math.round(e.maxHp * 2.4);
  e.hp = e.maxHp;
  e.dmg *= 1.35;
  e.xpMul = 4;
  e.traits = traits;

  for (const t of traits) TRAITS[t].apply(e);
  e.speed = Math.min(e.speed, SPEED_CAP);

  const skillPool = SKILL_BY_KIND[e.def.key] || ['slam'];
  e.skill = rnd.pick(skillPool);
  const sk = ELITE_SKILLS[e.skill];
  e.skillCd = rnd.range(sk.cd[0] * 0.5, sk.cd[1]);

  // 이름 — 특성이 앞에 붙는다. 커서를 올리면 무엇이 다른지 바로 읽힌다.
  e.eliteName = traits.map((t) => TRAITS[t].name).join(' ') + ' ' + e.def.name;

  return { traits, skill: e.skill, name: e.eliteName };
}

/** 정예 오라 — 첫 특성 색으로 발밑에 고리를 깐다 */
export function makeAura(e) {
  const color = TRAITS[e.traits[0]].color;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.78, 22),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  ring.scale.setScalar(e.radius * 1.9);
  return { mesh: ring, color };
}
