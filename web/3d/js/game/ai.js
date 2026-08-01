// 적 AI — 살아있게 만들되 풀링을 죽이지 않는다.
// 설계 근거는 docs/ENEMY-AI.md. 여기는 그 구현이다.
//
// 이 파일의 규칙 하나: **모든 행동은 플래그로 끌 수 있어야 한다.**
// 전부 켠 채로 「느낌이 나쁘다」만 남으면 원인을 못 찾는다. 실측(tools/bench3d.js)
// 에서 어떤 행동이 지표를 망쳤는지 하나씩 끄면서 좁힐 수 있어야 한다.

export const AI = {
  wander: true,     // 미발견 상태에서 각자 다른 일을 한다
  vision: true,     // 어그로가 전방위가 아니라 부채꼴이다
  squads: false,    // 조 편성 (docs/ENEMY-AI.md §4) — 미구현
  shout: false,     // 지원 요청 (§5) — 미구현
  noise: false,     // 전투 소음 → 수색 (§5-2) — 미구현
  archerFlee: false, // 궁수 도주 (§6) — 미구현
  chatter: false,   // 잡담 (§7) — 스토리 기획 뒤
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
