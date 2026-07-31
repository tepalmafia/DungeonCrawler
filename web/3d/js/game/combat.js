// 전투 판정 — 데미지 공식, 피격 반응, 투사체.
// 연출(숫자·파티클·셰이크)까지 여기서 한 번에 처리해 호출부를 단순하게 유지한다.

import * as THREE from 'three';
import { Sfx } from '../core/audio.js';
import { resolveCollision } from '../world/nav.js';

/** 방어도 감산 — 수확 체감. 층이 깊어져도 방어도가 무의미해지지 않는다. */
export function mitigate(raw, armor, level = 1) {
  const k = armor / (armor + 42 + level * 9);
  return Math.max(1, raw * (1 - k));
}

export function playerRoll(p) {
  const base = p.dmgMin + Math.random() * (p.dmgMax - p.dmgMin);
  const crit = Math.random() * 100 < p.critChance;
  return { dmg: base * (crit ? p.critMult : 1), crit };
}

/**
 * 적에게 피해. 넉백·플래시·숫자·파티클을 함께 처리한다.
 * @param opts { crit, knock, color, from, silent, skill }
 */
export function hitEnemy(G, e, rawDmg, opts = {}) {
  if (!e || e.dead) return 0;
  const dmg = Math.max(1, Math.round(mitigate(rawDmg, e.armor, G.player.level)));
  e.hp -= dmg;
  e.flash = 0.14;
  e.aggro = true;

  const c = e.center();
  G.fx.number(c.clone().setY(c.y + 0.5), dmg, {
    color: opts.crit ? '#ffe066' : '#ffffff',
    big: !!opts.crit,
  });
  G.fx.burst(c, {
    count: opts.crit ? 20 : 10,
    color: opts.color ?? (opts.crit ? 0xffd070 : 0xff6a4a),
    speed: opts.crit ? 6.5 : 4.2,
    size: 0.34, life: 0.4, grav: 11,
  });

  // 넉백 — 근원에서 멀어지는 방향
  const knock = opts.knock ?? (opts.crit ? 3.4 : 2.0);
  if (knock && !e.heavy) {
    const from = opts.from || G.player.pos;
    const dx = e.pos.x - from.x, dz = e.pos.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    e.knock.set((dx / d) * knock, 0, (dz / d) * knock);
  }

  if (!opts.silent) Sfx.hit(opts.crit);
  if (opts.crit) G.fx.addShake(0.045);

  // 흡혈
  if (G.player.leech && !e.dead) {
    G.player.hp = Math.min(G.player.maxHp, G.player.hp + G.player.leech);
  }

  if (e.hp <= 0) killEnemy(G, e);
  return dmg;
}

export function killEnemy(G, e) {
  if (e.dead) return;
  e.dead = true;
  e.dieT = 0.55;
  const c = e.center();
  G.fx.burst(c, { count: 30, color: e.def.gib ?? 0xb03a3a, speed: 6.5, size: 0.42, life: 0.75, grav: 13 });
  G.fx.burst(c, { count: 14, color: 0x6a4a7a, speed: 2.4, size: 0.7, life: 1.0, grav: -1, up: 1.4 });
  G.fx.ground(e.pos, { r0: 0.7, r1: 1.7, color: 0x8a2a2a, life: 0.5 });
  Sfx.enemyDie();

  G.onEnemyKilled(e);
}

/** 플레이어 피격 */
export function hitPlayer(G, rawDmg, opts = {}) {
  const p = G.player;
  if (p.dead || p.invuln > 0) return 0;
  const dmg = Math.max(1, Math.round(mitigate(rawDmg, p.armor, p.level)));
  p.hp -= dmg;
  p.hurtT = 0.18;
  p.invuln = Math.max(p.invuln, 0.12);

  G.fx.number(p.center().setY(1.85), dmg, { color: '#ff8080' });
  G.fx.burst(p.center(), { count: 12, color: 0xd03a3a, speed: 4.2, size: 0.35, life: 0.42 });
  G.fx.addShake(0.06 + Math.min(0.16, dmg / p.maxHp));
  G.ui.hurtFlash(Math.min(1, dmg / (p.maxHp * 0.28)));
  Sfx.playerHurt();

  if (p.hp <= 0) { p.hp = 0; G.onPlayerDeath(); }
  return dmg;
}

// ───────────────────────── 투사체 ─────────────────────────
const PROJ_GEO = new THREE.SphereGeometry(0.17, 8, 6);

export class Projectile {
  constructor(G, { from, dir, speed = 13, dmg = 8, color = 0x9a6bff, life = 3, fromPlayer = false, radius = 0.3, pierce = 0 }) {
    this.G = G;
    this.pos = from.clone();
    this.dir = dir.clone().setY(0).normalize();
    this.speed = speed;
    this.dmg = dmg;
    this.life = life;
    this.fromPlayer = fromPlayer;
    this.radius = radius;
    this.pierce = pierce;
    this.hitSet = new Set();
    this.dead = false;

    this.mat = new THREE.MeshBasicMaterial({ color });
    this.mesh = new THREE.Mesh(PROJ_GEO, this.mat);
    this.mesh.position.copy(this.pos);
    G.scene.add(this.mesh);

    const glow = new THREE.PointLight(color, 12, 6, 2);
    this.mesh.add(glow);
    this.color = color;
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) return this.kill();

    const step = this.speed * dt;
    this.pos.x += this.dir.x * step;
    this.pos.z += this.dir.z * step;
    this.mesh.position.copy(this.pos);

    if (Math.random() < 0.6)
      this.G.fx.burst(this.pos, { count: 1, color: this.color, speed: 0.5, size: 0.24, life: 0.25, grav: 0 });

    // 벽
    const r = resolveCollision(this.G.dungeon, this.pos.x, this.pos.z, this.radius);
    if (r.hit) {
      this.G.fx.burst(this.pos, { count: 10, color: this.color, speed: 3.5, size: 0.3, life: 0.35 });
      return this.kill();
    }

    if (this.fromPlayer) {
      for (const e of this.G.enemies) {
        if (e.dead || this.hitSet.has(e)) continue;
        if (this.pos.distanceTo(e.pos) < e.radius + this.radius + 0.2) {
          this.hitSet.add(e);
          hitEnemy(this.G, e, this.dmg, { color: this.color, from: this.pos, knock: 2.2 });
          if (this.pierce-- <= 0) return this.kill();
        }
      }
    } else {
      const p = this.G.player;
      if (!p.dead && this.pos.distanceTo(p.pos) < p.radius + this.radius + 0.25) {
        hitPlayer(this.G, this.dmg);
        return this.kill();
      }
    }
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    this.G.scene.remove(this.mesh);
    this.mat.dispose();
  }
}
