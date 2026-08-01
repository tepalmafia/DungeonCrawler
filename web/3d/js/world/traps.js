// 함정 — 장애물이 아니라 **도구**다.
//
// 설계는 docs/DUNGEON-INTERACTIONS.md §3.
//
// ── 원칙 하나: 예고 없는 피해는 넣지 않는다 ────────────────
// 기존 2D 게임이 무예고 40% → 0% 로 끌어내린 원칙을 그대로 따른다.
// 예고를 두 겹으로 쌓는다:
//   1. 발견 — 밝으면 바닥의 표식이 보인다. **어두우면 안 보인다.**
//      랜턴 반경이 곧 「함정을 볼 수 있는 거리」다. 빛이 정보라는 이 게임의
//      전제가 여기서 한 번 더 쓰인다.
//   2. 발동 — 밟은 뒤 실제 피해까지 지연이 있다. 붉은 예고 원이 조여든다.
//
// ── 원칙 둘: 적에게도 작동한다 ★ ─────────────────────────
// 이게 함정을 「피해야 하는 것」에서 「쓰는 것」으로 바꾼다.
// 끌어낸 적을 함정 위로 유인할 수 있고, 골렘처럼 정면으로 버거운 적을
// 함정으로 깎는 판단이 생긴다. 풀링과 정확히 같은 결의 재미다 —
// **위치를 고르는 것이 전투다.**
//
// 피해가 최대 체력 비율인 것도 그래서다. 고정값이면 층이 깊어질수록
// 플레이어에게만 무의미해지고, 적에게는 영영 안 통한다.

import * as THREE from 'three';
import { gridToWorld } from './dungeon.js';
import { hitPlayer, hitEnemy, volAt } from '../game/combat.js';
import { Projectile } from '../game/combat.js';
import { Sfx } from '../core/audio.js';

/**
 * 종류별 성질.
 *   delay   밟은 뒤 피해까지 (초). 이 시간 안에 원 밖으로 나가면 안 맞는다
 *   radius  피해 반경
 *   pct     최대 체력 대비 피해
 *   color   예고 원 색 — 종류를 색으로도 구분한다
 */
export const TRAP_KINDS = {
  spike: {
    name: '압력판 가시', delay: 0.5, radius: 1.5, pct: 0.12,
    color: 0xd8503a, mark: 0x9a6a52, tell: '바닥이 눌린다',
  },
  rock: {
    name: '낙석', delay: 0.85, radius: 2.0, pct: 0.18, stun: 0.6,
    color: 0xc8a24a, mark: 0x7a6a58, tell: '천장에서 흙이 떨어진다',
  },
  gas: {
    name: '독가스', delay: 0.35, radius: 2.4, pct: 0.03, field: 8,
    color: 0x7ac85a, mark: 0x5a7a4a, tell: '틈에서 김이 샌다',
  },
  dart: {
    name: '화살 발사기', delay: 0.3, radius: 1.2, pct: 0.08, dart: true,
    color: 0x9fd0ff, mark: 0x5a6a80, tell: '벽에 구멍이 보인다',
  },
};

const KEYS = Object.keys(TRAP_KINDS);

// ── 다시 짠 이유 ────────────────────────────────────────
//
// 처음엔 발견 반경을 랜턴 반경의 62%(약 4칸)로 뒀다. 그랬더니 함정이
// **항상 보이고 항상 피할 수 있는 것**이 됐다. 그건 함정이 아니라 장식이다.
// 「예고 없는 피해는 넣지 않는다」를 지키려다 반대편으로 넘어갔다.
//
// 두 가지를 분리해서 다시 짰다:
//   · **공정함** — 밟은 뒤에는 반드시 피할 창이 있다. 붉은 고리는 그대로 둔다.
//     이건 양보하지 않는다.
//   · **공짜 회피** — 이건 없앤다. 발견은 1.4칸 안에서만 되고, 표식은 UI 고리가
//     아니라 **금이 간 바닥**처럼 보인다. 주의를 기울인 사람만 본다.
//
// 그리고 배치를 바꿨다. 방 한가운데 있는 함정은 그냥 돌아가면 그만이다.
// **길목**(복도·문턱)에 놓으면 「돌아갈까, 해제할까, 밟고 갈까」가 판단이 된다.
// 그게 함정이 만들어야 하는 순간이다.
const SEE_DIST = 2.8;          // 발견 거리 (월드 유닛) — 격자 한 칸이 2.0
const REARM = 14;              // 터진 뒤 다시 장전되기까지. 돌아오는 길도 위험해야 한다

export class Traps {
  constructor(scene, dg, rnd) {
    this.scene = scene;
    this.dg = dg;
    this.list = [];

    const ringGeo = new THREE.RingGeometry(0.5, 0.78, 20);
    const tellGeo = new THREE.RingGeometry(0.1, 1.0, 24);
    this.ringGeo = ringGeo;
    this.tellGeo = tellGeo;

    for (const t of dg.traps || []) {
      const k = TRAP_KINDS[t.kind];
      const [x, z] = gridToWorld(t.gx, t.gz, dg.w, dg.h);

      // 발견 표식 — **UI 가 아니라 지형처럼** 보여야 한다.
      // 밝은 고리를 그리면 「여기 밟지 마시오」 표지판이 된다. 어두운 금·눌린 자국은
      // 보는 사람만 본다. 가산 합성을 쓰지 않는 이유도 그것이다.
      const mark = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: k.mark, transparent: true, opacity: 0,
        depthWrite: false, side: THREE.DoubleSide,
      }));
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(x, 0.03, z);
      mark.scale.setScalar(k.radius / 0.78);
      scene.add(mark);

      // 발동 예고 — 붉게 조여드는 고리. 이건 발견 여부와 무관하게 보인다:
      // 못 봤어도 밟은 뒤에는 피할 기회를 줘야 한다.
      const tell = new THREE.Mesh(tellGeo, new THREE.MeshBasicMaterial({
        color: k.color, transparent: true, opacity: 0,
        depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      }));
      tell.rotation.x = -Math.PI / 2;
      tell.position.set(x, 0.05, z);
      tell.visible = false;
      scene.add(tell);

      this.list.push({
        kind: t.kind, def: k, x, z,
        state: 'armed',        // armed | warning | spent | disarmed
        found: false,          // 밝은 데서 봤는가
        t: 0,
        mark, tell,
        dir: t.dir || null,    // 화살 발사기의 발사 방향
      });
    }
  }

  /** 손이 닿는 곳의 「발견된」 함정 — 해제 안내에 쓴다 */
  nearestDisarmable(px, pz, r = 2.0) {
    let best = null, bd = r;
    for (const t of this.list) {
      if (t.state !== 'armed' || !t.found) continue;
      const d = Math.hypot(t.x - px, t.z - pz);
      // 발동 반경 **밖**에서만 해제할 수 있다. 위에 올라선 채로 해제하는 건
      // 「밟고 있는데 안 터진다」라 규칙이 이상해진다.
      if (d < t.def.radius * 0.85) continue;
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  disarm(G, t) {
    if (!t || t.state !== 'armed') return false;
    t.state = 'disarmed';
    t.mark.material.color.set(0x4a5a4a);
    G.player.gainXp(3 + G.floorNo * 2);
    G.fx.ground({ x: t.x, y: 0, z: t.z }, { r0: 0.4, r1: t.def.radius, color: 0x8fd08a, life: 0.5 });
    Sfx.pickup(0);
    return true;
  }

  update(dt, G) {
    const p = G.player;
    // 발견 거리는 짧게 고정한다. 랜턴이 밝다고 층 전체의 함정이 드러나면
    // 「지도를 받는」 것과 같아진다 — 어두우면 아예 안 보인다는 규칙만 남긴다.
    const lit = (G.lighting?.lamp?.radius ?? 9) > 6;
    const lampR = lit ? SEE_DIST : SEE_DIST * 0.45;

    for (const t of this.list) {
      const k = t.def;

      // ── 발견 ─────────────────────────────────────────
      // 토스트는 띄우지 않는다. 화면 구석의 글자로 알려 주면 그것도 결국
      // 「표지판」이다. 바닥을 보고 알아채야 한다.
      if (!t.found && t.state === 'armed' && !p.dead) {
        if (Math.hypot(t.x - p.pos.x, t.z - p.pos.z) < lampR) t.found = true;
      }
      // 표식은 가까울수록 진해지되 최대 0.34 다. 진한 고리는 표지판이 된다.
      if (t.state !== 'spent') {
        const d = Math.hypot(t.x - p.pos.x, t.z - p.pos.z);
        const want = t.found ? Math.max(0, Math.min(0.34, (SEE_DIST * 1.6 - d) / (SEE_DIST * 2))) : 0;
        const mm = t.mark.material;
        mm.opacity += (want - mm.opacity) * Math.min(1, dt * 6);
      }

      // 재장전 — 터진 함정이 영영 죽어 있으면, 돌아오는 길은 안전한 복도가 된다.
      // 다시 장전되면 「아까 그 자리」를 기억해야 하고, 적을 유인하는 도구로도
      // 계속 쓸 수 있다.
      if (t.state === 'spent') {
        t.rearmT = (t.rearmT ?? REARM) - dt;
        if (t.rearmT <= 0) { t.state = 'armed'; t.rearmT = REARM; t.found = false; }
      }

      // ── 독가스 구름 ──────────────────────────────────
      if (t.cloud) {
        t.cloud.life -= dt;
        t.cloud.tick -= dt;
        if (Math.random() < dt * 16) {
          G.fx.burst({
            x: t.x + (Math.random() - 0.5) * k.radius * 1.7, y: 0.15,
            z: t.z + (Math.random() - 0.5) * k.radius * 1.7,
          }, { count: 1, color: k.color, speed: 0.9, size: 0.75, life: 1.1, grav: -1.4 });
        }
        if (t.cloud.tick <= 0) {
          t.cloud.tick = 0.4;
          this._damage(G, t, new THREE.Vector3(t.x, 0, t.z), k.pct * 0.4, false);
        }
        if (t.cloud.life <= 0) t.cloud = null;
      }

      // ── 발동 대기 ────────────────────────────────────
      if (t.state === 'armed') {
        if (this._steppedOn(G, t)) {
          t.state = 'warning';
          t.t = 0;
          t.tell.visible = true;
          Sfx.enemyAggro('golem', volAt(G, { x: t.x, z: t.z }));
        }
        continue;
      }

      if (t.state === 'warning') {
        t.t += dt;
        const kk = Math.min(1, t.t / k.delay);
        // 고리가 **조여든다.** 커지는 예고는 「퍼진다」로 읽혀 피할 방향이 헷갈린다.
        t.tell.scale.setScalar(k.radius * (1.9 - kk * 0.9));
        t.tell.material.opacity = 0.35 + kk * 0.5;
        if (t.t >= k.delay) this._fire(G, t);
      }
    }
  }

  /** 플레이어든 적이든, 밟으면 터진다 */
  _steppedOn(G, t) {
    const p = G.player;
    if (!p.dead && Math.hypot(t.x - p.pos.x, t.z - p.pos.z) < t.def.radius * 0.6) return true;
    for (const e of G.enemies) {
      if (e.dead) continue;
      if (Math.hypot(t.x - e.pos.x, t.z - e.pos.z) < t.def.radius * 0.6) return true;
    }
    return false;
  }

  _fire(G, t) {
    const k = t.def;
    t.state = 'spent';
    t.tell.visible = false;
    t.mark.material.opacity = 0;
    const at = new THREE.Vector3(t.x, 0, t.z);

    G.fx.addShake(k.pct * 0.9);
    G.fx.ground(at, { r0: 0.3, r1: k.radius * 1.15, color: k.color, life: 0.45, opacity: 0.7 });
    G.lighting?.flash(at.clone().setY(1), k.color, 40, 0.25);

    if (k.dart) {
      // 화살 — 벽에서 가로질러 날아간다. 판정은 Projectile 이 그대로 맡는다
      // (스윕이라 벽을 안 뚫는다).
      const dir = new THREE.Vector3(t.dir?.[0] ?? 1, 0, t.dir?.[1] ?? 0);
      G.projectiles.push(new Projectile(G, {
        from: at.clone().setY(0.9), dir, speed: 17, color: k.color,
        dmg: Math.round(G.player.maxHp * k.pct), radius: 0.28, life: 2.2,
        neutral: true,      // 맞는 쪽이 아프다 — 함정은 편을 들지 않는다
      }));
      Sfx.swing();
      return;
    }

    G.fx.burst(at.clone().setY(0.35), {
      count: k.field ? 26 : 22, color: k.color,
      speed: k.field ? 2.2 : 6.5, size: k.field ? 0.7 : 0.36,
      life: k.field ? 1.4 : 0.6, grav: k.field ? -0.6 : 9, up: k.field ? 1.1 : 0,
    });

    // 독가스는 구름을 남긴다 — 밟은 순간이 아니라 **머무는 동안** 아프다.
    //
    // G.fields 를 쓰지 않는다. 그쪽은 스킬 장판이라 **적만** 때리게 돼 있고,
    // 거기에 「플레이어도 때림」 분기를 넣으면 스킬 장판이 언젠가 자해를 한다.
    // 규칙이 다른 것은 따로 두는 편이 낫다.
    if (k.field) {
      t.cloud = { life: k.field, tick: 0 };
      Sfx.enemyDie('ghoul', volAt(G, at) * 0.5);
      return;
    }

    this._damage(G, t, at, k.pct, true);
    Sfx.enemyHit('golem', true, volAt(G, at));
  }

  /**
   * 반경 안의 **모두**에게 피해. 적도 예외가 아니다 (§3-3).
   * 최대 체력 비율이라 골렘 같은 큰 놈에게도 유효하다.
   */
  _damage(G, t, at, pct, knock) {
    const k = t.def;
    const p = G.player;
    if (!p.dead && Math.hypot(t.x - p.pos.x, t.z - p.pos.z) < k.radius) {
      hitPlayer(G, p.maxHp * pct, { from: { x: t.x, z: t.z }, ranged: true });
    }
    for (const e of G.enemies) {
      if (e.dead) continue;
      if (Math.hypot(t.x - e.pos.x, t.z - e.pos.z) >= k.radius) continue;
      hitEnemy(G, e, e.maxHp * pct, {
        from: at, color: k.color, los: false, stun: false,
        knock: knock ? 0.6 : 0,
      });
      if (k.stun && !e.dead && !e.isBoss) e.stunT = Math.max(e.stunT || 0, k.stun);
    }
  }

  dispose() {
    for (const t of this.list) {
      this.scene.remove(t.mark, t.tell);
      t.mark.material.dispose();
      t.tell.material.dispose();
    }
    this.ringGeo.dispose();
    this.tellGeo.dispose();
    this.list.length = 0;
  }
}

export { KEYS as TRAP_KEYS };
