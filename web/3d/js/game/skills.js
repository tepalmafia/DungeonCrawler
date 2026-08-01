// 스킬 4종 — 마나를 계속 쓰면서 싸우는 리듬을 만든다.
// 데이터 + cast() 만 추가하면 새 스킬이 붙는다.

import { SKILL_CD_SCALE } from './pace.js';
import * as THREE from 'three';
import { Sfx } from '../core/audio.js';
import { playerRoll, hitEnemy } from './combat.js';

const V = new THREE.Vector3();

/** 각도 차 (-π..π) */
function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function enemiesInArc(G, origin, facing, radius, spread) {
  return G.enemies.filter((e) => {
    if (e.dead) return false;
    const dx = e.pos.x - origin.x, dz = e.pos.z - origin.z;
    const d = Math.hypot(dx, dz);
    if (d > radius + e.radius) return false;
    if (spread >= Math.PI * 2) return true;
    return Math.abs(angDiff(Math.atan2(dx, dz), facing)) <= spread / 2;
  });
}

export const SKILLS = [
  {
    key: 'cleave', name: '회전 베기', label: 'Q', hot: 'KeyQ', icon: '🌀',
    cost: 12, cd: 0.9,
    desc: '전방을 크게 휩쓴다.',
    cast(G, aim) {
      const p = G.player;
      p.facing = Math.atan2(aim.x - p.pos.x, aim.z - p.pos.z);
      p.swing = 1;
      const spread = Math.PI * 0.78, radius = 3.5;
      G.fx.arc(p.pos, p.facing, { radius, spread, color: 0xffe0a0, life: 0.24 });
      G.fx.addShake(0.03);
      Sfx.swing();

      const hits = enemiesInArc(G, p.pos, p.facing, radius, spread);
      for (const e of hits) {
        const r = playerRoll(p);
        // 소용돌이 베기는 **무기 속성을 따른다** — 무기를 휘두르는 동작이므로.
        // element 를 안 넘기면 hitEnemy 가 무기 속성을 쓴다.
        hitEnemy(G, e, r.dmg * 1.35, { crit: r.crit, knock: 1.1, color: 0xffd090, skill: true });
      }
      return true;
    },
  },

  {
    key: 'dash', name: '그림자 돌진', label: 'W', hot: 'KeyW', icon: '💨',
    cost: 20, cd: 5, element: 'soul',   // 그림자 — 혼
    desc: '커서 방향으로 돌진한다. 돌진 중 무적.',
    cast(G, aim) {
      const p = G.player;
      const dir = V.set(aim.x - p.pos.x, 0, aim.z - p.pos.z);
      if (dir.lengthSq() < 0.01) dir.set(Math.sin(p.facing), 0, Math.cos(p.facing));
      p.dash(dir, 0.24);
      Sfx.dash();
      G.fx.burst(p.center(), { count: 22, color: 0x8a6bff, speed: 5, size: 0.42, life: 0.4, grav: 2 });

      // 지나간 자리의 적을 벤다
      const hitSet = new Set();
      G.pendingDashHits = { hitSet, until: 0.28 };
      return true;
    },
  },

  {
    key: 'nova', name: '화염 신성', label: 'E', hot: 'KeyE', icon: '🔥',
    cost: 35, cd: 9, element: 'fire',   // 화염 신성 — 화
    desc: '주변으로 불길이 퍼지고 잠시 장판이 남는다.',
    cast(G) {
      const p = G.player;
      const radius = 6.4;
      G.fx.shockwave(p.pos, { r0: 0.6, r1: radius, color: 0xff8a3a, life: 0.55, y: 0.35 });
      G.fx.burst(p.center(), { count: 46, color: 0xff9a3a, speed: 9, size: 0.55, life: 0.7, grav: 5 });
      G.fx.ground(p.pos, { r0: radius, color: 0xff6a2a, life: 0.5 });
      G.lighting.flash(p.center(), 0xff8a3a, 110, 0.45);
      G.fx.addShake(0.12);
      Sfx.nova();

      for (const e of enemiesInArc(G, p.pos, 0, radius, Math.PI * 2)) {
        const r = playerRoll(p);
        hitEnemy(G, e, r.dmg * 2.2, { crit: r.crit, knock: 2.0, color: 0xff9a4a, element: 'fire', skill: true });
      }
      // 장판 — 계속 서 있으면 계속 아프다
      G.fields.push({
        x: p.pos.x, z: p.pos.z, r: radius * 0.72, life: 3.4, tick: 0,
        dps: (p.dmgMin + p.dmgMax) * 0.28, color: 0xff6a2a,
      });
      return true;
    },
  },

  {
    key: 'meteor', name: '운석 낙하', label: 'R', hot: 'KeyR', icon: '☄',
    cost: 60, cd: 22, element: 'fire',  // 운석 — 화
    desc: '지정한 곳에 운석을 떨어뜨린다.',
    cast(G, aim) {
      const p = G.player;
      const radius = 4.6;
      const target = { x: aim.x, z: aim.z };
      G.fx.ground(target, { r0: radius, color: 0xff3a2a, life: 0.85, fade: 'in', opacity: 0.75 });
      Sfx.meteor();

      G.timers.push({
        t: 0.85,
        fn: () => {
          const pos = new THREE.Vector3(target.x, 0, target.z);
          G.fx.shockwave(pos, { r0: 0.8, r1: radius * 1.5, color: 0xffb04a, life: 0.7, y: 0.4 });
          G.fx.burst(pos.clone().setY(0.6), { count: 70, color: 0xffa03a, speed: 13, size: 0.7, life: 1.0, grav: 14 });
          G.fx.burst(pos.clone().setY(0.4), { count: 30, color: 0x552211, speed: 6, size: 0.9, life: 1.2, grav: 8 });
          G.fx.ground(target, { r0: radius, r1: radius * 1.25, color: 0xff5a2a, life: 0.9 });
          G.lighting.flash(pos.clone().setY(1.5), 0xffb04a, 190, 0.7);
          G.fx.addShake(0.35, 4);

          for (const e of G.enemies) {
            if (e.dead) continue;
            const d = Math.hypot(e.pos.x - target.x, e.pos.z - target.z);
            if (d > radius + e.radius) continue;
            const r = playerRoll(p);
            const falloff = 1 - Math.min(0.55, (d / radius) * 0.55);
            hitEnemy(G, e, r.dmg * 5.0 * falloff, { crit: r.crit, knock: 2.6, color: 0xffb04a, from: pos, element: 'fire', skill: true });
          }
          G.fields.push({ x: target.x, z: target.z, r: radius * 0.8, life: 2.6, tick: 0, dps: (p.dmgMin + p.dmgMax) * 0.3, color: 0xff7a2a });
        },
      });
      return true;
    },
  },
];

export const SKILL_BY_HOT = Object.fromEntries(SKILLS.map((s) => [s.hot, s]));

/** 쿨다운·마나 확인 후 시전 */
export function trySkill(G, skill, aim) {
  const p = G.player;
  if (p.dead) return false;
  const cdLeft = G.cooldowns[skill.key] || 0;
  if (cdLeft > 0) return false;
  if (p.mp < skill.cost) {
    G.ui.toast('마나가 부족하다', '#6f9fff');
    return false;
  }
  if (!skill.cast(G, aim || p.pos)) return false;
  p.mp -= skill.cost;
  // 배수는 pace.js 가 정한다. SKILLS 의 cd 를 하나씩 고치면 언젠가 하나를 빠뜨린다.
  G.cooldowns[skill.key] = skill.cd * SKILL_CD_SCALE * (1 - p.cdr);
  G.ui.fireSkill(skill.key);
  return true;
}

/** 장판 데미지 — 0.35초마다 틱 */
export function updateFields(G, dt) {
  for (let i = G.fields.length - 1; i >= 0; i--) {
    const f = G.fields[i];
    f.life -= dt;
    f.tick -= dt;
    if (f.life <= 0) { G.fields.splice(i, 1); continue; }
    if (Math.random() < dt * 14)
      G.fx.burst({ x: f.x + (Math.random() - 0.5) * f.r * 1.6, y: 0.1, z: f.z + (Math.random() - 0.5) * f.r * 1.6 },
        { count: 1, color: f.color, speed: 1.2, size: 0.5, life: 0.6, grav: -2 });
    if (f.tick > 0) continue;
    f.tick = 0.35;
    for (const e of G.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.pos.x - f.x, e.pos.z - f.z) < f.r + e.radius)
        // 장판은 바닥에 깔린 것이라 근원이 장판 중심이다
        hitEnemy(G, e, f.dps * 0.35, { knock: 0, color: f.color, silent: true, from: f.pos ?? f });
    }
  }
}

/** 돌진 중 스친 적을 벤다 */
export function updateDashHits(G, dt) {
  const d = G.pendingDashHits;
  if (!d) return;
  d.until -= dt;
  if (d.until <= 0) { G.pendingDashHits = null; return; }
  const p = G.player;
  for (const e of G.enemies) {
    if (e.dead || d.hitSet.has(e)) continue;
    if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < e.radius + p.radius + 0.7) {
      d.hitSet.add(e);
      const r = playerRoll(p);
      hitEnemy(G, e, r.dmg * 1.1, { crit: r.crit, knock: 1.6, color: 0x8a6bff, element: 'soul', skill: true });
    }
  }
}
