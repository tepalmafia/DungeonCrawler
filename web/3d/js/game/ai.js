// 적 AI — 살아있게 만들되 풀링을 죽이지 않는다.
// 설계 근거는 docs/ENEMY-AI.md. 여기는 그 구현이다.
//
import { lineOfSight, walkable } from '../world/nav.js';
import { worldToGrid } from '../world/dungeon.js';

// 이 파일의 규칙 하나: **모든 행동은 플래그로 끌 수 있어야 한다.**
// 전부 켠 채로 「느낌이 나쁘다」만 남으면 원인을 못 찾는다. 실측(tools/bench3d.js)
// 에서 어떤 행동이 지표를 망쳤는지 하나씩 끄면서 좁힐 수 있어야 한다.

export const AI = {
  wander: true,     // 미발견 상태에서 각자 다른 일을 한다
  vision: true,     // 어그로가 전방위가 아니라 부채꼴이다
  reposition: true, // 벽·기둥에 사선이 막히면 옆으로 돌아 각을 연다 (§6-3)
  squads: true,     // 조 편성 (docs/ENEMY-AI.md §4)
  shout: true,      // 지원 요청 (§5) — 어그로가 아니라 **수색**을 퍼뜨린다
  noise: true,      // 전투 소음 → 수색 (§5-2)
  archerFlee: true, // 궁수 도주 (§6)
  chatter: true,    // 잡담 (§7) — game/dialogue.js
};

// ── 미발견 상태의 행동 ─────────────────────────────────────
// 무리 지어 몰려다니게 만들면 풀링이 죽는다. 대신 **각자 다른 일**을 하게 한다.
// 화면에는 살아있어 보이지만 어그로 구조는 그대로다.
export const IDLE = {
  patrol: { move: 1, pause: [1.2, 2.6], radius: [2.5, 5], look: 0.5 },
  post: { move: 0, pause: [2.0, 4.0], radius: [0, 0], look: 1.6 },
  graze: { move: 1, pause: [1.8, 3.6], radius: [1.2, 2.6], look: 0.8 },
  busy: { move: 0, pause: [3.0, 6.0], radius: [0, 0], look: 0, back: true },
};

// 종족마다 어울리는 일이 다르다. 골렘이 서성이면 육중함이 사라진다.
const BY_KIND = {
  skeleton: ['patrol', 'patrol', 'post', 'busy'],
  ghoul: ['graze', 'graze', 'busy'],
  archer: ['post', 'post', 'patrol'],
  golem: ['post'],
};

// 미발견 이동은 전투 속도의 45%. 느려야 「경계 중이 아님」이 읽힌다.
export const IDLE_SPEED = 0.45;

export function pickIdle(kind, rnd) {
  const list = BY_KIND[kind] || ['post'];
  return list[Math.floor((rnd ? rnd() : Math.random()) * list.length)];
}

/**
 * 시야 — 어그로를 전방위에서 부채꼴로 바꾼다.
 * 뒤에서 다가가는 것이 실제로 유리해야 「어떻게 접근하는가」가 판단거리가 된다.
 *
 * @returns 어그로 반경에 곱할 배수. 1 이면 그대로, 작을수록 늦게 발견한다.
 */
export function visionFactor(e, px, pz) {
  if (!AI.vision) return 1;
  const dx = px - e.pos.x, dz = pz - e.pos.z;
  let d = Math.atan2(dx, dz) - e.facing;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const a = Math.abs(d);
  // busy 는 등을 보이고 있다 — 이 상태에서만 기습이 성립한다
  const back = e.idleKind === 'busy' && IDLE.busy.back ? 0.4 : 1;
  if (a <= 1.22) return 1 * back;             // 전방 ±70°
  if (a <= 2.27) return 0.65 * back;          // 옆
  return 0.35 * back;                          // 뒤
}

/** 뒤쪽에서 발견됐을 때 반응이 늦는 시간(초) */
export function reactionDelay(e, px, pz) {
  if (!AI.vision) return 0;
  const dx = px - e.pos.x, dz = pz - e.pos.z;
  let d = Math.atan2(dx, dz) - e.facing;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d) > 2.27 ? 1.2 : 0;
}

/**
 * 미발견 상태 갱신. A* 를 쓰지 않는다 —
 * 26마리가 각자 경로를 돌리면 비용이 는다(docs/ENEMY-AI.md §10).
 * 집 주변의 점으로 직선 이동 + 충돌 해소로 충분하다.
 *
 * @returns 이동했는가 (애니메이션용 0/1)
 */
export function updateIdle(e, dt, G) {
  if (!AI.wander) return 0;
  const cfg = IDLE[e.idleKind] || IDLE.post;

  e.idleT -= dt;
  if (e.idleT <= 0) {
    if (e.idleMoving) {
      // 도착했거나 시간이 다 됐다 → 쉰다
      e.idleMoving = false;
      e.idleT = cfg.pause[0] + Math.random() * (cfg.pause[1] - cfg.pause[0]);
      // 쉬는 동안 두리번거릴 방향을 정한다
      e.idleFace = e.facing + (Math.random() * 2 - 1) * Math.PI * cfg.look;
    } else if (cfg.move) {
      // 집 주변의 새 목적지. 리쉬 반경을 절대 안 넘는다 —
      // 던전을 떠도는 적은 계획을 불가능하게 만든다.
      const [r0, r1] = cfg.radius;
      const a = Math.random() * Math.PI * 2;
      const r = r0 + Math.random() * (r1 - r0);
      e.idleTarget = { x: e.home.x + Math.cos(a) * r, z: e.home.z + Math.sin(a) * r };
      e.idleMoving = true;
      e.idleT = 3.5;                       // 못 가면 이 시간 뒤 포기한다
    } else {
      e.idleT = cfg.pause[0] + Math.random() * (cfg.pause[1] - cfg.pause[0]);
      e.idleFace = e.facing + (Math.random() * 2 - 1) * Math.PI * cfg.look;
    }
  }

  if (e.idleMoving && e.idleTarget) {
    const d = Math.hypot(e.idleTarget.x - e.pos.x, e.idleTarget.z - e.pos.z);
    if (d < 0.35) { e.idleMoving = false; e.idleT = 0; return 0; }
    return e._step(dt, G, e.idleTarget.x, e.idleTarget.z, e.speed * IDLE_SPEED);
  }

  // 서 있을 때는 정해둔 방향으로 천천히 고개를 돌린다
  if (e.idleFace != null) {
    let d = e.idleFace - e.facing;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    e.facing += d * Math.min(1, dt * 1.6);
  }
  return 0;
}


/**
 * 사선이 막혔을 때 「돌아서 갈 곳」을 찾는다 (docs/ENEMY-AI.md §6-3).
 *
 * 왜 필요한가: 지금까지 기둥이 사이에 끼면 궁수는 뒤로 물러나기만 하고
 * 영영 못 쐈다. 근접도 사거리 안에서 사선이 막히면 공격 조건이 성립하지
 * 않는데 이미 가까워서 추격도 의미가 없어 그 자리에 굳었다.
 *
 * 방법: 플레이어 방향의 **수직**으로 좌우를 시험해, 걸을 수 있고 사선이
 * 열리는 가장 가까운 지점을 고른다. A* 를 안 쓰는 이유는 이 판단이 매
 * 0.5초마다 최대 26마리에게서 일어나기 때문이다 — 싸야 한다.
 *
 * @returns {{x:number,z:number}|null} 없으면 null (그때는 평소대로 추격한다)
 */
export function findFlank(e, G, p) {
  if (!AI.reposition) return null;
  const dg = G.dungeon;
  const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z;
  const l = Math.hypot(dx, dz) || 1;
  const nx = -dz / l, nz = dx / l;                 // 플레이어 방향의 수직
  const [tx, tz] = worldToGrid(p.pos.x, p.pos.z, dg.w, dg.h);

  let best = null, bestStep = Infinity;
  for (const side of [1, -1]) {
    for (const step of [2.0, 3.2, 4.6, 6.0]) {
      const x = e.pos.x + nx * side * step;
      const z = e.pos.z + nz * side * step;
      const [gx, gz] = worldToGrid(x, z, dg.w, dg.h);
      if (!walkable(dg, gx, gz)) continue;
      if (!lineOfSight(dg, gx, gz, tx, tz)) continue;
      // 좌우 중 **덜 돌아가는 쪽**을 고른다. 멀리 도는 쪽을 고르면
      // 플레이어 눈에는 도망치는 것처럼 보인다.
      if (step < bestStep) { bestStep = step; best = { x, z }; }
      break;                                        // 이 방향의 최단 해를 찾았다
    }
  }
  return best;
}

// ─────────────────────── 외침 · 소음 · 수색 ───────────────────────
//
// **이 게임에서 어그로가 번지는 경로는 여기 하나뿐이다.**
// 그리고 번지는 것은 어그로가 아니라 **수색**이다 — 소리를 들은 적은
// 「플레이어가 저기 있다」가 아니라 「저기서 무슨 소리가 났다」만 안다.
//
// 왜 이 구분이 중요한가: 소음이 곧 어그로면 한 번 싸울 때마다 방 전체가 오고,
// 그러면 「한 마리씩 끌어낸다」는 이 게임의 전투 방식이 성립하지 않는다.
// 수색은 **완충 장치**다 — 플레이어에게 도망칠 시간을 준다.
//
// 실측으로 지킬 선: concurrentAggro 중앙값 ≤ 1 (docs/ENEMY-AI.md §8-1).
// 이 값이 1 을 넘으면 난전이 된 것이고, 그 변경은 되돌려야 한다.

/** 종족별 외침 (§5-1). 골렘은 0 — 정예가 지원까지 부르면 「못 이긴다」가 된다. */
export const SHOUT = {
  skeleton: { chance: 0.25, radius: 9, cast: 0.9 },
  ghoul: { chance: 0.15, radius: 7, cast: 0.7 },
  // 궁수는 원래 「잘못 끌면 곤란해지는 존재」로 설계됐다 (어그로 반경 12.5).
  // 외침도 그 정체성 위에 얹는다.
  archer: { chance: 0.60, radius: 13, cast: 1.1 },
  golem: null,
  lord: null,
};

/** 전투 소음 반경 (§5-2). 스킬이 더 시끄럽다. */
export const NOISE = { hit: 7, skill: 11 };

/** 수색 (§5-3) */
export const SEARCH = { look: 4.0, speed: 0.8 };

/** 궁수 이탈 (§6-2) */
export const FLEE = {
  hpPct: 0.35,       // 이 아래로 떨어지면 도망
  brace: 1.2,        // 돌아서는 경직 — 이때 붙으면 못 도망친다
  speedMul: 1.05,    // 전투 속도의 105% 까지만. 못 잡으면 AI 가 아니라 벽이다
  maxTimes: 1,       // 개체당 1회. 두 번째는 싸운다
};
