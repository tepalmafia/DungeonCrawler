// 보스 기술 — **하나의 기술이 무엇인가**를 답하는 표.
//
// ── 왜 나누는가 ──────────────────────────────────────────────
// 기술이 `boss.js` 안에서 `switch (this.move)` 두 덩이(_start 6개 · _runMove 6개)로
// 하드코딩돼 있었다. 보스가 하나뿐일 때는 그게 제일 짧은 길이었다.
//
// 그런데 보스를 층마다 두기로 했다 (docs/FLOORS.md §5-3). 그러면 이 구조는
// **두 번째 보스에서 case 가 스무 개가 되고, 세 번째에서 손을 못 댄다.**
// 게다가 「이 보스는 이 기술을 쓴다」를 적을 자리가 없다 — 지금은 PHASES 라는
// 모듈 상수 하나가 전부라 보스마다 다를 수가 없다.
//
// ── 기술 하나의 모양 ────────────────────────────────────────
//   {
//     windup: (b) => 0.8 / b.enrage,     예비 동작 길이 (초, ATTACK_SCALE 시계)
//     start:  (b, G, p) => {},           예비 시작 — 지면 예고를 여기서 띄운다
//     run:    (b, dt, G, p, dist, done) => 0|1,   매 프레임. 1 이면 「움직였다」
//     minDist / maxDist / instead        거리에 안 맞으면 다른 기술로 바꾼다
//   }
//
// `b` 는 보스 인스턴스다. 기술이 보스의 상태(moveT · state · comboLeft …)를
// 직접 만지는 것은 그대로 둔다 — 기술마다 필요한 상태가 다르고, 그걸 전부
// 일반화하면 표가 코드보다 어려워진다.
//
// ── 옮기면서 값을 바꾸지 않았다 ──────────────────────────────
// 이 파일의 숫자는 전부 옛 switch 문에서 그대로 옮긴 것이다.
// `tools/boss-moves.js` 가 기술별 지문(예비 길이·지속·피해·타수·소환·이동)을
// 찍어 확인한다. 옮기기 전후가 **한 줄도 다르면 안 된다.**

import * as THREE from 'three';
import { hitPlayer } from './combat.js';
import { Sfx } from '../core/audio.js';
import { MOVE_SCALE, ATTACK_SCALE, ATTACK_TIME } from './pace.js';

const V = new THREE.Vector3();

/** 보스 정면 부채꼴 안에 플레이어가 있나 */
function inCone(b, p, range, halfAngle) {
  const dx = p.pos.x - b.pos.x, dz = p.pos.z - b.pos.z;
  const d = Math.hypot(dx, dz);
  let ad = Math.atan2(dx, dz) - b.facing;
  while (ad > Math.PI) ad -= Math.PI * 2;
  while (ad < -Math.PI) ad += Math.PI * 2;
  return d < range && Math.abs(ad) < halfAngle;
}

export const MOVES = {
  // ── 내려베기 — 정면 부채꼴. 지면 예고가 먼저 뜬다 ──────────
  cleave: {
    maxDist: 6, instead: 'charge',
    windup: (b) => 0.8 / b.enrage,
    start(b, G, p) {
      G.fx.ground(b.pos, { r0: 5.4, color: 0xff3a5a, life: b.windupDur * ATTACK_TIME, fade: 'in', opacity: 0.55 });
      b._face(p.pos.x, p.pos.z);
    },
    run(b, dt, G, p, dist, done) {
      if (b.moveT < b.windupDur) { b._face(p.pos.x, p.pos.z); return 0; }
      if (b.state === 'windup') {
        b.state = 'attack';
        G.fx.arc(b.pos, b.facing, { radius: 5.4, spread: Math.PI * 0.62, color: 0xff5a7a, life: 0.28 });
        G.fx.addShake(0.16);
        G.lighting.flash(b.center(), 0xff4a6a, 80, 0.3);
        if (inCone(b, p, 5.4, Math.PI * 0.35)) hitPlayer(G, b.dmg * 1.5, { from: b.pos, attacker: b });
        Sfx.swing();
      }
      if (b.moveT > b.windupDur + 0.45) done();
      return 0;
    },
  },

  // ── 연타 — 세 번. 박자마다 다시 조준한다 ────────────────────
  combo: {
    maxDist: 6, instead: 'charge',
    windup: (b) => 0.42 / b.enrage,
    start(b) { b.comboLeft = 3; },
    run(b, dt, G, p, dist, done) {
      const beat = b.windupDur + 0.28;
      const idx = Math.floor(b.moveT / beat);
      if (idx > 3 - b.comboLeft && b.comboLeft > 0) {
        b.comboLeft--;
        b.state = 'attack';
        G.fx.arc(b.pos, b.facing, { radius: 4.0, spread: Math.PI * 0.5, color: 0xffaa7a, life: 0.18 });
        if (dist < 4.4) hitPlayer(G, b.dmg * 0.85, { from: b.pos, attacker: b });
        Sfx.swing();
        b._face(p.pos.x, p.pos.z);
      }
      if (b.comboLeft <= 0 && b.moveT > beat * 3.2) done();
      return 0;
    },
  },

  // ── 돌진 — 벽에 부딪히거나 닿으면 끝난다 ────────────────────
  charge: {
    minDist: 4, instead: 'cleave',
    windup: (b) => 0.6 / b.enrage,
    start(b, G, p) {
      b.chargeDir = V.set(p.pos.x - b.pos.x, 0, p.pos.z - b.pos.z).normalize().clone();
      b._face(p.pos.x, p.pos.z);
      G.fx.burst(b.center(), { count: 20, color: 0x9a5aff, speed: 3, size: 0.5, life: 0.5, grav: -2 });
    },
    run(b, dt, G, p, dist, done) {
      if (b.moveT < b.windupDur) return 0;
      const step = 15 * MOVE_SCALE * b.enrage * dt;   // 돌진도 이동이다
      const r = b._stepRaw(G, b.chargeDir.x * step, b.chargeDir.z * step);
      G.fx.burst(b.center(), { count: 3, color: 0x9a5aff, speed: 1.5, size: 0.5, life: 0.35, grav: 0 });
      if (dist < b.radius + p.radius + 1.1) { hitPlayer(G, b.dmg * 1.15, { from: b.pos, attacker: b }); done(); }
      else if (r.hit || b.moveT > b.windupDur + 0.85) {
        if (r.hit) { G.fx.addShake(0.2); G.fx.burst(b.center(), { count: 26, color: 0x8a7a6a, speed: 6, size: 0.5, life: 0.6 }); }
        done();
      }
      return 1;
    },
  },

  // ── 소환 ────────────────────────────────────────────────
  summon: {
    windup: () => 0.9,
    start(b, G) {
      G.fx.ground(b.pos, { r0: 3.2, color: 0x9a5aff, life: 0.9 * ATTACK_TIME, fade: 'in', opacity: 0.6 });
    },
    run(b, dt, G, p, dist, done) {
      if (b.moveT < b.windupDur) return 0;
      b._summon(G, 4);
      done();
      return 0;
    },
  },

  // ── 화염 고리 — 플레이어 주변에 순차 점화. 계속 움직이게 만든다 ──
  firering: {
    windup: () => 0.4,
    start(b) { b.ringSpots = []; },
    run(b, dt, G, p, dist, done) {
      if (b.moveT >= b.windupDur && b.ringSpots.length < 7) {
        const want = Math.floor((b.moveT - b.windupDur) / 0.18);
        while (b.ringSpots.length <= want && b.ringSpots.length < 7) {
          const a = Math.random() * Math.PI * 2;
          const rr = 1.5 + Math.random() * 6;
          const sx = p.pos.x + Math.cos(a) * rr, sz = p.pos.z + Math.sin(a) * rr;
          b.ringSpots.push({ x: sx, z: sz });
          G.fx.ground({ x: sx, z: sz }, { r0: 2.1, color: 0xff5a2a, life: 0.9, fade: 'in', opacity: 0.7 });
          G.timers.push({
            t: 0.9,
            fn: () => {
              const pos = new THREE.Vector3(sx, 0, sz);
              G.fx.shockwave(pos, { r0: 0.4, r1: 2.4, color: 0xff8a3a, life: 0.4, y: 0.3 });
              G.fx.burst(pos.clone().setY(0.4), { count: 24, color: 0xff9a3a, speed: 8, size: 0.5, life: 0.6 });
              G.lighting.flash(pos.clone().setY(1), 0xff8a3a, 55, 0.3);
              if (Math.hypot(G.player.pos.x - sx, G.player.pos.z - sz) < 2.3)
                hitPlayer(G, b.dmg * 0.9, { from: { x: sx, z: sz }, attacker: b });
            },
          });
        }
      }
      if (b.moveT > b.windupDur + 1.5) done();
      b._face(p.pos.x, p.pos.z);
      return 0;
    },
  },

  // ── 회전 광선 — 사거리 밖으로 도망치거나 뒤를 잡아야 한다 ────
  sweep: {
    windup: () => 0.7,
    start(b, G, p) {
      b.sweepAngle = Math.atan2(p.pos.x - b.pos.x, p.pos.z - b.pos.z) - Math.PI;
      b.sweepT = 0;
      G.fx.ground(b.pos, { r0: 9, color: 0xff6a2a, life: 0.7 * ATTACK_TIME, fade: 'in', opacity: 0.4 });
    },
    run(b, dt, G, p, dist, done) {
      if (b.moveT < b.windupDur) return 0;
      // 회전이 느려진 만큼 지속도 늘려야 쓸고 지나가는 각도가 그대로다
      b.sweepT += dt * ATTACK_SCALE;
      const speed = 2.1 * b.enrage;
      b.sweepAngle += dt * speed * ATTACK_SCALE;
      b.facing = b.sweepAngle;
      const RANGE = 9.5;
      for (let i = 1; i <= 5; i++) {
        const d = (i / 5) * RANGE;
        G.fx.burst({ x: b.pos.x + Math.sin(b.sweepAngle) * d, y: 0.6, z: b.pos.z + Math.cos(b.sweepAngle) * d },
          { count: 1, color: 0xff7a3a, speed: 0.8, size: 0.7, life: 0.35, grav: -1 });
      }
      if (inCone(b, p, RANGE, 0.22)) hitPlayer(G, b.dmg * 0.55, { from: b.pos, attacker: b });
      if (b.sweepT > 3.2) done();
      return 0;
    },
  },
};

/**
 * 거리에 안 맞는 기술을 바꾼다.
 *
 * 예전에는 이 규칙이 `_combat` 안에 기술 이름으로 하드코딩돼 있었다:
 *   if ((pick === 'cleave' || pick === 'combo') && dist > 6) pick = 'charge';
 * 기술이 늘 때마다 그 두 줄을 고쳐야 했다. 이제 기술이 자기 조건을 들고 있다.
 */
export function pickForDistance(name, dist) {
  const m = MOVES[name];
  if (!m) return name;
  if (m.maxDist != null && dist > m.maxDist) return m.instead || name;
  if (m.minDist != null && dist < m.minDist) return m.instead || name;
  return name;
}
