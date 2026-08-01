// 전투 판정 — 데미지 공식, 피격 반응, 투사체.
// 연출(숫자·파티클·셰이크)까지 여기서 한 번에 처리해 호출부를 단순하게 유지한다.

import * as THREE from 'three';
import { Sfx } from '../core/audio.js';
import { resolveCollision, sweep, lineOfSight } from '../world/nav.js';
import { worldToGrid } from '../world/dungeon.js';

/**
 * 벽 너머로 때리거나 맞지 않게 막는다.
 *
 * 지금까지 모든 피해 판정이 **거리와 각도만** 봤다. 그래서 벽 하나를 사이에
 * 두고 광역기가 넘어가고, 기둥 뒤에 서 있어도 근접 공격이 들어왔다.
 * 이동 관통과는 다른 축의 버그다 — 몸은 안 지나가는데 피해만 지나갔다.
 *
 * 한계를 밝혀 둔다: 격자 기준이라 **소품(기둥·관)은 못 막는다.**
 * 기둥은 칸의 일부만 차지하므로 칸 단위 시야로는 표현할 수 없다.
 * 벽만 막는다 — 그것만으로도 「방 건너편에서 맞는」 문제는 사라진다.
 */
export function hasLine(G, ax, az, bx, bz) {
  const dg = G.dungeon;
  if (!dg) return true;
  const [gx0, gz0] = worldToGrid(ax, az, dg.w, dg.h);
  const [gx1, gz1] = worldToGrid(bx, bz, dg.w, dg.h);
  if (gx0 === gx1 && gz0 === gz1) return true;
  return lineOfSight(dg, gx0, gz0, gx1, gz1);
}

/**
 * 소리 크기 = 거리. 26마리가 같은 크기로 울면 어디서 나는지 알 수 없다.
 * 6유닛 안은 최대, 28유닛 밖은 무음.
 */
export function volAt(G, pos) {
  const d = Math.hypot(pos.x - G.player.pos.x, pos.z - G.player.pos.z);
  return Math.max(0, Math.min(1, 1 - (d - 6) / 22));
}

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
  // 벽 너머로는 안 닿는다. 투사체는 이미 스윕으로 벽에서 죽으므로 예외다
  // (los: false). 장판도 예외 — 바닥에 깔린 것은 자기 위치가 곧 근원이다.
  if (opts.los !== false) {
    const src = opts.from || G.player.pos;
    if (!hasLine(G, src.x, src.z, e.pos.x, e.pos.z)) return 0;
  }
  const dmg = Math.max(1, Math.round(mitigate(rawDmg, e.armor, G.player.level)));
  e.hp -= dmg;
  e.flash = 0.14;
  e.aggro = true;

  const c = e.center();
  G.fx.number(c.clone().setY(c.y + 0.5), dmg, {
    color: opts.crit ? '#ffe066' : '#ffffff',
    big: !!opts.crit,
  });
  // 타격 방향 — 스파크가 이 방향으로 뿜어져야 「어디서 맞았는지」가 보인다
  const src = opts.from || G.player.pos;
  const hx = e.pos.x - src.x, hz = e.pos.z - src.z;
  const hd = Math.hypot(hx, hz) || 1;
  const dir = { x: hx / hd, z: hz / hd };

  G.fx.burst(c, {
    count: opts.crit ? 26 : 14,
    color: opts.color ?? (opts.crit ? 0xffd070 : 0xff6a4a),
    speed: opts.crit ? 9 : 6,
    size: 0.34, life: 0.4, grav: 11,
    dir, cone: opts.crit ? 0.75 : 0.55,
  });

  // 넉백 — 근원에서 멀어지는 방향.
  //
  // 이 값이 곧 밀려나는 「거리」다. 감쇠가 지수라 이동량 ≈ 임펄스이고,
  // 격자 한 칸이 2.0 이다. 예전 평타 2.0 은 한 대에 정확히 한 칸을 밀어내서
  // 근접 사거리(1.6~2.2) 밖으로 보냈고, 매 스윙마다 다시 붙어야 했다.
  // 넉백은 타격의 강조지 위치를 바꾸는 수단이 아니다 → 사거리를 넘지 않게 잡는다.
  const knock = opts.knock ?? (opts.crit ? 0.9 : 0.5);
  if (knock && !e.heavy) {
    e.knock.set(dir.x * knock, 0, dir.z * knock);
  }

  // 리코일 — 위치를 옮기지 않고 「움찔」하게 만든다.
  // 밀어내기를 줄인 만큼의 손맛을 이쪽으로 옮겼다.
  e.recoilT = 1;
  e.recoilDir = dir;
  e.recoilPow = opts.crit ? 1.5 : 1;

  const vol = volAt(G, e.pos);
  if (!opts.silent) Sfx.enemyHit(e.def.key, opts.crit, vol);

  // 히트스톱 — 프레임을 잠깐 붙잡는다. 크리티컬은 두 배 이상 길게.
  if (!opts.silent) G.hitStop = Math.max(G.hitStop || 0, opts.crit ? 0.09 : 0.04);
  G.fx.addShake(opts.crit ? 0.075 : 0.022);

  // 흡혈
  if (G.player.leech && !e.dead) {
    G.player.hp = Math.min(G.player.maxHp, G.player.hp + G.player.leech);
  }

  // 기절 — 둔기 계열과 stun 접사가 굴린다.
  // 정예·보스는 안 걸린다. 보스가 기절로 잠기면 페이즈 설계가 통째로 무너진다.
  const stun = (opts.stun !== false) ? (G.player.stunChance || 0) : 0;
  if (stun > 0 && !e.dead && !e.elite && !e.isBoss && Math.random() * 100 < stun) {
    e.stunT = Math.max(e.stunT || 0, 0.9);
    G.fx.burst(c.clone().setY(c.y + 0.55), {
      count: 8, color: 0xffe9a0, speed: 2.4, size: 0.3, life: 0.5, grav: -1, up: 1.2,
    });
  }

  // 전투 소음 — 타격은 소리를 낸다 (docs/ENEMY-AI.md §5-2).
  // 어그로가 아니라 **수색**만 퍼진다. 그리고 닫힌 문을 넘지 않는다
  // (hear() 가 lineOfSight 를 쓰고, 그게 walkable() 을 쓰므로 자동이다).
  // 문을 닫고 싸우면 옆방이 안 온다 — 문 기획과 여기서 맞물린다.
  if (!opts.silent) G.makeNoise?.(G.player.pos, opts.skill ? 11 : 7);

  G.metrics?.hit(e, dmg, !!opts.crit);

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
  // 죽은 자리에 종족에 맞는 잔해를 남긴다 (world/remains.js)
  G.remains?.spawn(e.def.key, e.pos, e.def.scale || 1);
  // 마지막 말. 망령 궁수의 「고맙…다.」 가 이 게임 이야기의 전부다 (docs/STORY.md §6-3).
  G.dialogue?.say(G, e, 'die');
  // 정예 「타오르는」 — 죽을 때 터진다. 마지막 순간까지 방심할 수 없게.
  if (e.deathBlast) {
    G.fx.burst(c, { count: 34, color: 0xff8a2b, speed: 9, size: 0.5, life: 0.7, grav: 6 });
    G.fx.ground(e.pos, { r0: 0.4, r1: 3.4, color: 0xff8a2b, life: 0.45, opacity: 0.8 });
    G.lighting?.flash(c, 0xff8a2b, 70, 0.3);
    G.fx.addShake(0.16, 1.6);
    const p2 = G.player;
    if (!p2.dead && Math.hypot(p2.pos.x - e.pos.x, p2.pos.z - e.pos.z) < 3.4) {
      hitPlayer(G, p2.maxHp * e.deathBlast, { from: e.pos, ranged: true });
    }
  }

  Sfx.enemyDie(e.def.key, volAt(G, e.pos));
  G.hitStop = Math.max(G.hitStop || 0, 0.11);      // 마무리 일격은 더 길게 붙잡는다

  G.metrics?.kill(e);
  G.onEnemyKilled(e);
}

/** 플레이어 피격 */
export function hitPlayer(G, rawDmg, opts = {}) {
  const p = G.player;
  if (p.dead || p.invuln > 0) return 0;
  if (opts.from && !hasLine(G, opts.from.x, opts.from.z, p.pos.x, p.pos.z)) return 0;
  const dmg = Math.max(1, Math.round(mitigate(rawDmg, p.armor, p.level)));
  p.hp -= dmg;
  p.hurtT = 0.18;
  p.invuln = Math.max(p.invuln, 0.12);

  G.fx.number(p.center().setY(1.85), dmg, { color: '#ff8080' });
  G.fx.burst(p.center(), { count: 12, color: 0xd03a3a, speed: 4.2, size: 0.35, life: 0.42 });
  G.fx.addShake(0.06 + Math.min(0.16, dmg / p.maxHp));
  G.ui.hurtFlash(Math.min(1, dmg / (p.maxHp * 0.28)));
  Sfx.playerHurt();
  Sfx.playerGrunt(Math.min(1, 0.5 + dmg / (p.maxHp * 0.3)));

  G.metrics?.taken(dmg);

  // 정예 「가시 돋친」 — 근접으로 때린 놈이 되받는다. 플레이어의 thorns 와
  // 반대 방향이고, 규칙(근접만)은 같다.
  if (opts.attacker?.reflect && !opts.ranged) {
    p.hp -= Math.max(1, Math.round(dmg * opts.attacker.reflect));
    G.fx.burst(p.center(), { count: 8, color: 0xc9a44a, speed: 3, size: 0.28, life: 0.35 });
  }

  // 가시 — 때린 놈에게 되돌려준다. 근접해서 때린 경우만이다:
  // 화살에 반사가 걸리면 화면 밖 궁수가 스스로 죽는 우스운 그림이 된다.
  if (p.thorns > 0 && opts.attacker && !opts.attacker.dead && !opts.ranged) {
    hitEnemy(G, opts.attacker, p.thorns, {
      color: 0xc0d8ff, knock: 0, silent: true, los: false, stun: false, crit: false,
    });
  }

  if (p.hp <= 0) { p.hp = 0; G.onPlayerDeath(); }
  return dmg;
}

// ───────────────────────── 투사체 ─────────────────────────
const PROJ_GEO = new THREE.SphereGeometry(0.17, 8, 6);

export class Projectile {
  constructor(G, { from, dir, speed = 13, dmg = 8, color = 0x9a6bff, life = 3, fromPlayer = false, radius = 0.3, pierce = 0, neutral = false }) {
    this.G = G;
    this.pos = from.clone();
    this.dir = dir.clone().setY(0).normalize();
    this.speed = speed;
    this.dmg = dmg;
    this.life = life;
    this.fromPlayer = fromPlayer;
    this.radius = radius;
    this.pierce = pierce;
    // 함정이 쏜 화살은 **편이 없다.** 적이 맞으면 적이 아프다 —
    // 함정을 「도구」로 쓰는 플레이가 성립하려면 여기가 중립이어야 한다.
    this.neutral = neutral;
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

    // 화살은 초당 15유닛이다. 예전엔 이동시킨 뒤 도착 지점만 검사해서
    // 프레임이 끊기면 벽을 지나 반대편 적을 맞췄다.
    //
    // 벽 검사 반지름은 화살의 실제 굵기(0.12)를 쓴다. 판정용 radius(0.3)로
    // 벽을 재면 벽면을 스치듯 나는 화살이 애먼 데서 터진다.
    const step = this.speed * dt;
    const from = { x: this.pos.x, z: this.pos.z };
    const sw = sweep(this.G.dungeon, this.pos.x, this.pos.z,
      this.dir.x * step, this.dir.z * step, 0.12);
    this.pos.x = sw.x;
    this.pos.z = sw.z;
    this.mesh.position.copy(this.pos);
    this.blocked = sw.hit;

    if (Math.random() < 0.6)
      this.G.fx.burst(this.pos, { count: 1, color: this.color, speed: 0.5, size: 0.24, life: 0.25, grav: 0 });

    // 벽
    const r = { hit: this.blocked };
    if (r.hit) {
      this.G.fx.burst(this.pos, { count: 10, color: this.color, speed: 3.5, size: 0.3, life: 0.35 });
      return this.kill();
    }

    // 지나간 **구간**과의 최근접 거리로 판정한다. 끝점만 보면 한 프레임에
    // 12유닛을 건너뛸 때 적을 통과하며 안 맞는다.
    const segDist = (px, pz) => {
      const vx = this.pos.x - from.x, vz = this.pos.z - from.z;
      const L2 = vx * vx + vz * vz;
      if (L2 < 1e-9) return Math.hypot(px - this.pos.x, pz - this.pos.z);
      let t = ((px - from.x) * vx + (pz - from.z) * vz) / L2;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(px - (from.x + vx * t), pz - (from.z + vz * t));
    };

    if (this.fromPlayer || this.neutral) {
      for (const e of this.G.enemies) {
        if (e.dead || this.hitSet.has(e)) continue;
        if (segDist(e.pos.x, e.pos.z) < e.radius + this.radius + 0.2) {
          this.hitSet.add(e);
          hitEnemy(this.G, e, this.dmg, { color: this.color, from: this.pos, knock: 0.7, los: false });
          if (this.pierce-- <= 0) return this.kill();
        }
      }
    }
    if (!this.fromPlayer) {
      const p = this.G.player;
      if (!p.dead && segDist(p.pos.x, p.pos.z) < p.radius + this.radius + 0.25) {
        hitPlayer(this.G, this.dmg, { ranged: true });
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
