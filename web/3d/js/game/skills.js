// 스킬 4종 — 마나를 계속 쓰면서 싸우는 리듬을 만든다.
// 데이터 + cast() 만 추가하면 새 스킬이 붙는다.

import { SKILL_CD_SCALE } from './pace.js';
import { SKILL_NUM, DECOY_DMG } from './skill-table.js';
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
    cost: SKILL_NUM.cleave.cost, cd: SKILL_NUM.cleave.cd,
    desc: '전방을 크게 휩쓴다.',
    cast(G, aim) {
      const p = G.player;
      p.facing = Math.atan2(aim.x - p.pos.x, aim.z - p.pos.z);
      p.swing = 1;
      // 스킬 트리가 값을 곱한다 (game/skilltree.js). **안 찍었으면 전부 1**
      // 이므로 지금 값과 한 글자도 다르지 않다 — 그게 단계 A 의 계약이다.
      const M = G.tree ? G.tree.mods('cleave') : {};
      const N = SKILL_NUM.cleave;
      const spread = N.spread * (M.spread ?? 1), radius = N.radius * (M.radius ?? 1);
      G.fx.arc(p.pos, p.facing, { radius, spread, color: 0xffe0a0, life: 0.24 });
      G.fx.addShake(0.03);
      Sfx.swing();

      const hits = enemiesInArc(G, p.pos, p.facing, radius, spread);
      for (const e of hits) {
        const r = playerRoll(p);
        // 소용돌이 베기는 **무기 속성을 따른다** — 무기를 휘두르는 동작이므로.
        // element 를 안 넘기면 hitEnemy 가 무기 속성을 쓴다.
        // 넉백 없음 — 이건 무기를 휘두르는 동작이다. 평타의 넓은 판본이지
        // 밀어내는 기술이 아니다 (combat.js 의 넉백 주석).
        hitEnemy(G, e, r.dmg * N.dmg * (M.dmg ?? 1),
          { crit: r.crit, knock: 0, color: 0xffd090, skill: true, armorPierce: M.pierce ?? 0 });
      }

      // 「연격」 — 한 박자 뒤에 한 번 더. 같은 자리가 아니라 **그때의 조준**을
      // 다시 본다: 첫 타로 밀려난 적을 두 번째가 못 맞히면 연격이 아니다.
      if (M.twice) {
        G.timers.push({
          t: 0.22,
          fn: () => {
            if (p.dead) return;
            G.fx.arc(p.pos, p.facing, { radius, spread, color: 0xffd0b0, life: 0.2 });
            Sfx.swing();
            for (const e2 of enemiesInArc(G, p.pos, p.facing, radius, spread)) {
              const r2 = playerRoll(p);
              hitEnemy(G, e2, r2.dmg * N.dmg * (M.dmg ?? 1) * M.twice,
                { crit: r2.crit, knock: 0, color: 0xffc080, skill: true, armorPierce: M.pierce ?? 0 });
            }
          },
        });
      }
      return true;
    },
  },

  {
    key: 'dash', name: '그림자 돌진', label: 'W', hot: 'KeyW', icon: '💨',
    cost: SKILL_NUM.dash.cost, cd: SKILL_NUM.dash.cd, element: 'soul',   // 그림자 — 혼
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
      const M = G.tree ? G.tree.mods('dash') : {};
      G.pendingDashHits = { hitSet, until: SKILL_NUM.dash.window, mods: M };

      // 「충격」 — 끝나는 지점에서 터진다. 돌진이 도망치는 기술에서
      // **파고드는 기술**로 성격이 바뀐다.
      if (M.endBlast) {
        G.timers.push({
          t: 0.26,
          fn: () => {
            const at = { x: p.pos.x, z: p.pos.z };
            const R = M.endBlast;
            G.fx.shockwave(p.pos, { r0: 0.4, r1: R, color: 0x9a6bff, life: 0.4, y: 0.3 });
            G.fx.burst(p.center(), { count: 24, color: 0x9a6bff, speed: 7, size: 0.5, life: 0.5 });
            G.lighting?.flash(p.center(), 0x9a6bff, 70, 0.25);
            for (const e of enemiesInArc(G, at, 0, R, Math.PI * 2)) {
              const r = playerRoll(p);
              hitEnemy(G, e, r.dmg * SKILL_NUM.dash.dmg, {
                crit: r.crit, knock: 1.6, color: 0x9a6bff, element: 'soul', skill: true, from: at,
              });
            }
          },
        });
      }
      // 「잔상」 — 적 시선을 끈다. 자리만 남기고 실제 처리는 ai 가 본다.
      if (M.decoy) {
        G.decoy = { x: p.pos.x, z: p.pos.z, t: M.decoy };
        // 보이게 한다 — 적이 엉뚱한 데로 걸어가는데 이유가 안 보이면
        // 고장으로 읽힌다. 바닥 원 + 연기가 「저기 뭔가 있다」를 말한다.
        G.fx.ground(G.decoy, { r0: SKILL_NUM.dash.decoyRadius, color: 0x8a6bff, life: M.decoy, opacity: 0.5 });
        G.fx.burst({ x: G.decoy.x, y: 0.8, z: G.decoy.z },
          { count: 14, color: 0x8a6bff, speed: 1.1, size: 0.5, life: M.decoy * 0.8, grav: -0.4 });
      }
      return true;
    },
  },

  {
    key: 'nova', name: '화염 신성', label: 'E', hot: 'KeyE', icon: '🔥',
    cost: SKILL_NUM.nova.cost, cd: SKILL_NUM.nova.cd, element: 'fire',   // 화염 신성 — 화
    desc: '주변으로 불길이 퍼지고 잠시 장판이 남는다.',
    cast(G) {
      const p = G.player;
      const M = G.tree ? G.tree.mods('nova') : {};
      const N = SKILL_NUM.nova;
      const radius = N.radius * (M.radius ?? 1);
      G.fx.shockwave(p.pos, { r0: 0.6, r1: radius, color: 0xff8a3a, life: 0.55, y: 0.35 });
      G.fx.burst(p.center(), { count: 46, color: 0xff9a3a, speed: 9, size: 0.55, life: 0.7, grav: 5 });
      G.fx.ground(p.pos, { r0: radius, color: 0xff6a2a, life: 0.5 });
      G.lighting.flash(p.center(), 0xff8a3a, 110, 0.45);
      G.fx.addShake(0.12);
      Sfx.nova();

      for (const e of enemiesInArc(G, p.pos, 0, radius, Math.PI * 2)) {
        const r = playerRoll(p);
        hitEnemy(G, e, r.dmg * N.dmg * (M.dmg ?? 1),
          { crit: r.crit, knock: 2.0, color: 0xff9a4a, element: 'fire', skill: true });
      }
      // 장판 — 계속 서 있으면 계속 아프다
      G.fields.push({
        x: p.pos.x, z: p.pos.z, r: radius * N.field.r, life: N.field.life * (M.fieldLife ?? 1), tick: 0,
        dps: (p.dmgMin + p.dmgMax) * N.field.dps * (M.fieldDps ?? 1), color: 0xff6a2a,
      });
      return true;
    },
  },

  {
    key: 'meteor', name: '운석 낙하', label: 'R', hot: 'KeyR', icon: '☄',
    cost: SKILL_NUM.meteor.cost, cd: SKILL_NUM.meteor.cd, element: 'fire',  // 운석 — 화
    desc: '지정한 곳에 운석을 떨어뜨린다.',
    cast(G, aim) {
      const p = G.player;
      const M = G.tree ? G.tree.mods('meteor') : {};
      const N = SKILL_NUM.meteor;
      const radius = N.radius * (M.radius ?? 1);
      const delay = N.delay * (M.delay ?? 1);
      const target = { x: aim.x, z: aim.z };
      G.fx.ground(target, { r0: radius, color: 0xff3a2a, life: 0.85, fade: 'in', opacity: 0.75 });
      Sfx.meteor();

      G.timers.push({
        t: delay,
        fn: () => {
          const pos = new THREE.Vector3(target.x, 0, target.z);
          G.fx.shockwave(pos, { r0: 0.8, r1: radius * 1.5, color: 0xffb04a, life: 0.7, y: 0.4 });
          G.fx.burst(pos.clone().setY(0.6), { count: 70, color: 0xffa03a, speed: 13, size: 0.7, life: 1.0, grav: 14 });
          G.fx.burst(pos.clone().setY(0.4), { count: 30, color: 0x552211, speed: 6, size: 0.9, life: 1.2, grav: 8 });
          G.fx.ground(target, { r0: radius, r1: radius * 1.25, color: 0xff5a2a, life: 0.9 });
          G.lighting.flash(pos.clone().setY(1.5), 0xffb04a, 190, 0.7);
          G.fx.addShake(0.35, 4);

          // 「파편」 — 본체 주변에 작은 운석 셋. 본체는 약해진 대신 범위가 넓다.
          if (M.shards) {
            for (let i = 0; i < M.shards; i++) {
              const a = (i / M.shards) * Math.PI * 2 + 0.4;
              // **본체 범위와 겹치게** 둔다. 처음에 1.15배 밖에 뒀더니
              // 뭉친 적에게는 본체가 25% 약해진 만큼만 손해였다 —
              // 「넓어지는 대신 약해진다」가 아니라 그냥 약해지는 칸이었다.
              // (tools/tree-audit.js 가 −1% 로 잡았다.)
              const sx = target.x + Math.cos(a) * radius * N.shard.at;
              const sz = target.z + Math.sin(a) * radius * N.shard.at;
              G.timers.push({
                t: 0.18 + i * 0.09,
                fn: () => {
                  const sp = new THREE.Vector3(sx, 0, sz);
                  G.fx.shockwave(sp, { r0: 0.3, r1: radius * N.shard.r, color: 0xffa03a, life: 0.4, y: 0.3 });
                  G.fx.burst(sp.clone().setY(0.4), { count: 18, color: 0xffa03a, speed: 6, size: 0.5, life: 0.6, grav: 8 });
                  for (const e of G.enemies) {
                    if (e.dead) continue;
                    const dd = Math.hypot(e.pos.x - sx, e.pos.z - sz);
                    if (dd > radius * N.shard.r + e.radius) continue;
                    const rr = playerRoll(p);
                    hitEnemy(G, e, rr.dmg * N.shard.dmg, {
                      crit: rr.crit, knock: 0.8, color: 0xffa03a, element: 'fire',
                      skill: true, from: { x: sx, z: sz },
                    });
                  }
                },
              });
            }
          }
          // 「여운」 — 떨어진 자리가 잠시 적을 느리게 한다. 젖은 칸과 같은 원리.
          if (M.slow) G.slowZones.push({ x: target.x, z: target.z, r: radius, t: M.slow, mul: 0.6 });

          for (const e of G.enemies) {
            if (e.dead) continue;
            const d = Math.hypot(e.pos.x - target.x, e.pos.z - target.z);
            if (d > radius + e.radius) continue;
            const r = playerRoll(p);
            let falloff = 1 - Math.min(N.falloff, (d / radius) * N.falloff);
            // 「직격」 — 중심 반경 안이면 두 배. 조준이 판단거리가 된다.
            if (M.core && d < 1.5) falloff *= M.core;
            hitEnemy(G, e, r.dmg * N.dmg * falloff, { crit: r.crit, knock: 2.6, color: 0xffb04a, from: pos, element: 'fire', skill: true });
          }
          G.fields.push({ x: target.x, z: target.z, r: radius * N.field.r, life: N.field.life, tick: 0, dps: (p.dmgMin + p.dmgMax) * N.field.dps, color: 0xff7a2a });
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

/**
 * 이 자리에 장판이 있나 — 「재점화」가 처치 시점에 묻는다.
 * 처치 처리(main.js)가 스킬 내부를 몰라도 되게 여기서 답한다.
 */
export function fieldAt(G, x, z) {
  for (const f of G.fields) {
    if (f.rekindled) continue;                 // 재점화가 또 재점화하면 끝없이 번진다
    if (Math.hypot(f.x - x, f.z - z) < f.r) return f;
  }
  return null;
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
      // 넉백 없음 — 뚫고 **지나가는** 기술이다. 밀어내면 내가 지나갈 자리가
      // 사라져서 돌진이 적을 앞에서 밀고 가는 모양이 된다.
      hitEnemy(G, e, r.dmg * DECOY_DMG, { crit: r.crit, knock: 0, color: 0x8a6bff, element: 'soul', skill: true });
    }
  }
}
