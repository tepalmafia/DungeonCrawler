// ══════════════════════════════════════════════════════════════════════════
//  떠도는 것들 — **규칙.** 표는 target-table.js 가 갖는다.
//
//  ★ 자리를 **방위·고도·거리**로 든다. x/y/z 로 들면 화면(three)과 규칙이
//    같은 숫자를 두 벌 갖게 되고, 그러면 「조준경에는 있는데 안 맞는」
//    종류의 어긋남이 반드시 난다. 조준도 방위·고도로 하므로 **같은 자로 잰다.**
//
//  ★ three.js 를 안 쓴다.
// ══════════════════════════════════════════════════════════════════════════
import {
  KINDS, TARGET, HULL, pickKind, ENEMY_FIRE, enemyHitChance, pickHit, FAULT_CHANCE,
} from './target-table.js';

const span = ([a, b], rnd) => a + rnd() * (b - a);

/**
 * ★★★ **방위의 차이는 빼기가 아니다** (도).
 *
 *   v69 에 방위가 한 바퀴(±180)가 되면서, 179도와 −179도가 **2도 차이**인데
 *   그냥 빼면 358 이 된다. 조준·락온·레이더가 전부 이 값을 쓰므로, 안
 *   감으면 **기수 바로 뒤에서 조준이 통째로 죽는다** — 게다가 조용히
 *   죽는다(「저기 있는데 안 잡힌다」). 한 곳에 두고 다 여기를 부른다
 */
export function azDiff(a, b) {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/**
 * 하나 새로 띄운다.
 * @param kind ★ 정해서 띄운다 (적 우주선). 안 주면 무게로 뽑는다
 */
function spawnOne(rnd, id, kind = null) {
  const k = kind ? KINDS[kind] : pickKind(rnd);
  return {
    id,
    kind: k.key,
    /** 방위 (도) — 0 이 정면, 오른쪽이 + */
    az: (rnd() * 2 - 1) * TARGET.azLimit,
    /** 고도 (도) — 0 이 눈높이 */
    el: (rnd() * 2 - 1) * TARGET.elLimit,
    dist: span(TARGET.spawn, rnd),
    /** 흐르는 속도 (도/초) */
    vaz: span(TARGET.driftAz, rnd),
    vel: span(TARGET.driftEl, rnd),
    /** 남은 맷집 */
    hp: k.hits,
    /** 맞은 표시 — 화면이 잠깐 밝힌다 */
    flash: 0,
    /** ★ 부딪힌 뒤 잠깐 (한 번에 한 번만 부딪힌다) */
    bump: 0,
  };
}

/**
 * ★★★ **적 하나를 띄운다** — 종류를 골라서 (v70).
 *
 *   v69 까지 `spawnRaider` 하나뿐이었다. 이제 다섯이므로 **무엇을 부를지**를
 *   여기서 정한다. 떼로 오는 것(`pack`)은 한 번에 여럿이 온다.
 */
export function spawnFoe(sky, kind = 'raider') {
  const k = KINDS[kind];
  const n = k?.pack ?? 1;
  const made = [];
  for (let i = 0; i < n; i++) {
    const t = spawnOne(sky.rnd, sky.next++, kind);
    t.az = (sky.rnd() * 2 - 1) * TARGET.raiderAz;
    t.el = (sky.rnd() * 2 - 1) * (TARGET.elLimit * 0.5);
    // ★ 떼는 **흩어져 온다** — 한 점에 겹쳐 나면 하나로 보인다
    if (n > 1) t.az += (i - (n - 1) / 2) * 9;
    t.dist = TARGET.spawn[1];
    sky.list.push(t);
    made.push(t);
  }
  return made[0];
}

/** ★★ 적 우주선을 하나 띄운다 — 장면·추격이 부른다 (v64) */
export function spawnRaider(sky) {
  const t = spawnOne(sky.rnd, sky.next++, 'raider');
  // ★ **앞쪽에서 온다.** 뒤에서 오면 화면에 안 보이는 것이 다가오는 셈이라
  //   「부수거나 부딪힌다」가 선택이 아니라 사고가 된다
  t.az = (sky.rnd() * 2 - 1) * TARGET.raiderAz;
  t.el = (sky.rnd() * 2 - 1) * (TARGET.elLimit * 0.5);
  t.dist = TARGET.spawn[1];
  sky.list.push(t);
  return t;
}

export function makeSky(rnd) {
  return {
    rnd, list: [], next: 0, killed: 0, shots: 0, region: 'empty',
    /** ★ 이번 회차에 부딪힌 횟수 — 끝 화면과 검사가 읽는다 (v64) */
    grazes: 0, rams: 0, noseAz: 0,
    /** ★★ v69 — 다음 적까지 남은 초. 0 이 되면 하나 온다 */
    nextRaider: span(TARGET.raiderEvery, rnd),
    /** ★★★ v70 — **날아오는 적탄.** 맞기 전에 피할 시간이 있다 */
    incoming: [],
    /** 이번 회차에 몇 대 맞았나 — 끝 화면과 검사가 읽는다 */
    tookHits: 0, dodged: 0,
    /** 저절로 온 적이 몇이나 됐나 — 검사가 「정말 계속 오나」를 묻는다 */
    cameRaiders: 0,
    /** ★★ v70 — 지금 오고 있는 물결. 남은 수와 다음 것까지의 초 */
    waveLeft: 0, waveNext: 0,
  };
}

/** 구역이 바뀌었다 — 몇 개나 떠 있어야 하나가 달라진다 */
export function setRegion(sky, region) { sky.region = region; }

/** 지금 몇 개나 떠 있어야 하나 */
export const wantCount = (sky) =>
  Math.min(TARGET.max, TARGET.byRegion[sky.region] ?? 3);

/**
 * 한 걸음. 흘러가고, 지나간 것은 새로 난다.
 * @param moving 배가 나아가고 있나 — 서 있으면 안 다가온다
 */
/**
 * ★★ 기수가 어디를 보는지 알려 준다 (v70). 적은 **우리를 겨눠야** 쏘고,
 *   「겨눈다」는 **우리 기수와 견주는 것**이 아니라 저쪽에서 본 우리 자리다.
 *   여기서는 우리 방위를 기준점으로만 쓴다 — 옆으로 빠지면 사격 각이 죽는다
 */
export function setNose(sky, az) { sky.noseAz = az; }

/**
 * @param close 다가오는 속도의 배수 — **급가속이 여기로 온다** (v81).
 *   1 이 평소다. 이 값이 없으면 R 을 눌러도 표적이 더 빨리 안 온다
 */
export function stepSky(sky, dt, { moving = true, quiet = false, close = 1 } = {}) {
  const want = wantCount(sky);

  // ══ ★★★ **적이 저절로 온다** (v69) ═══════════════════════════════
  //  사장님 「테스트 차원에서 적우주선 … 나타나도록 해줘. **계속**」.
  //  ★ `quiet` 는 「여기서는 안 온다」 — 성간 공백처럼 아무것도 없는
  //    구역과, 거점에 대고 있을 때. 거점에서 얻어맞으면 사는 일이 벌이 된다
  if (!quiet && want > 0) {
    const foesNow = () => sky.list.filter((t) => KINDS[t.kind]?.shoots || KINDS[t.kind]?.rams).length;
    /** 통에서 하나 뽑아 띄운다 */
    const send = () => {
      // ★★ **종류를 섞는다.** 하나뿐이면 「쏜다」밖에 없고, 여럿이면
      //   매번 「무엇을 먼저 · 무엇으로 · 붙을까 뺄까」가 생긴다
      const pool = TARGET.foePool;
      const kind = pool[Math.floor(sky.rnd() * pool.length) % pool.length];
      spawnFoe(sky, kind);
      sky.cameRaiders++;
    };
    if (sky.waveLeft > 0) {
      // ── ★★★ **물결이 오는 중** ─────────────────────────
      //  하나를 부수면 끝나는 것이 아니라 **다음이 온다.** 그래야 싸움
      //  하나가 40~90초가 되고, 그 사이에 「붙을까 뺄까」가 생긴다
      sky.waveNext -= dt;
      if (sky.waveNext <= 0) {
        if (foesNow() < TARGET.raiderMax) { send(); sky.waveLeft -= 1; }
        sky.waveNext = span(TARGET.wave.gap, sky.rnd);
      }
    } else {
      sky.nextRaider -= dt;
      if (sky.nextRaider <= 0) {
        sky.nextRaider = span(TARGET.raiderEvery, sky.rnd);
        const [a, b] = TARGET.wave.size;
        sky.waveLeft = Math.round(a + sky.rnd() * (b - a));
        sky.waveNext = 0;
      }
    }
  }

  /** ★ 이번 걸음에 난 부딪힘 — main.js 가 흔들고 선체를 깎는다 (v64) */
  const bumps = [];
  /** ★★★ 이번 걸음에 **맞은 것** — main.js 가 고장을 연다 (v70) */
  const hits = [];
  for (const t of sky.list) {
    const k = KINDS[t.kind];
    t.az += t.vaz * dt;
    t.el += t.vel * dt;
    // ★★ v69 — 방위는 **감는다**, 고도는 **되돈다.**
    //   방위가 한 바퀴(±180)가 되면서 「끝」이 없어졌다. 180 에서 되돌리면
    //   등 뒤에 **보이지 않는 벽**이 생겨서 적이 거기 붙어 떠는데,
    //   원래 한 바퀴인 것에 끝을 만든 것이라 말이 안 된다.
    //   고도는 다르다 — 위아래는 정말로 끝이 있다 (천정과 천저)
    if (t.az > 180) t.az -= 360;
    if (t.az < -180) t.az += 360;
    if (Math.abs(t.el) > TARGET.elLimit) { t.el = Math.sign(t.el) * TARGET.elLimit; t.vel *= -1; }
    // ★ 적 우주선은 **저 혼자 다가온다** — 배가 서 있어도 온다
    // ★★★ v81 — **급가속이 여기에 먹는다.** v80 까지 이 줄에 배수가
    //   없어서 「R 을 눌러도 안 빨라지는」 상태였다 (`boost-table.js RUSH.close`)
    if (moving) t.dist -= TARGET.closing * close * dt;
    if (k?.closes) t.dist -= k.closes * dt;
    if (t.flash > 0) t.flash = Math.max(0, t.flash - dt);
    if (t.bump > 0) t.bump = Math.max(0, t.bump - dt);

    // ══ ★★★ **선체 안으로는 못 들어온다** (v64) ═══════════════════
    //  예전에는 `gone`(18m)에서 목록에서 빠졌다 — 「지나갔다」로 친 것이라
    //  부딪히는 일이 아예 없었고, 화면에서는 **뚫고 들어오는 것처럼** 보였다.
    //  안 부딪히는 것과 뚫고 지나가는 것은 다르다.
    if (t.dist <= HULL.radius) {
      t.dist = HULL.radius;               // ★ 바닥. 더는 못 온다
      // ★ **정면에 있는 것만 부딪힌다.** 옆으로 비켜 가는 것까지 다
      //   들이받으면 70초에 일곱 번이고, 그건 우주가 아니라 자갈길이다
      const onLine = Math.abs(t.az) <= HULL.hitAz && Math.abs(t.el) <= HULL.hitEl;
      const ram = !!k?.rams;
      if (t.bump <= 0 && (onLine || ram)) {
        t.bump = HULL.cooldown;
        bumps.push({ id: t.id, kind: t.kind, ram });
        if (ram) sky.rams++; else sky.grazes++;
        // ★ 들이받는 것은 **물러났다 다시 온다** — 붙어서 계속 치면 5초에 죽는다
        if (ram) t.dist = HULL.backoff;
        else t.dist = -1;
      } else if (!ram) {
        t.dist = -1;                      // 비켜 갔다 — 조용히 지나간다
      }
    }
  }
  // ══ ★★★ **적이 쏜다** (v70 · `target-table.js ENEMY_FIRE`) ══════════
  //
  //  ★ 「부수거나 기다리거나」밖에 없던 것에 **맞는다**가 붙는다.
  //    그리고 맞은 것은 숫자로 끝나지 않고 **고장으로** 이어진다 —
  //    이 배가 제일 잘하는 일(고치기)의 일감이 전투에서 나온다.
  //
  //  ★★ **정면일 때만 쏜다** (`aimCone`). 옆으로 빠지면 상대의 사격 각이
  //    죽는다 — 실제 공중전이 그렇고, 그래서 v69 에 연 **360도 선회가
  //    곧 회피**가 된다. 도는 것이 조준이면서 동시에 방어다
  for (const t of sky.list) {
    if (!KINDS[t.kind]?.shoots) continue;
    // 우리를 겨누고 있나 — 적은 기수를 우리 쪽으로 돌려야 쏜다
    const onUs = Math.abs(azDiff(t.az, sky.noseAz ?? 0)) <= ENEMY_FIRE.aimCone;
    if (!onUs) { t.aim = 0; continue; }
    // ★★★ **달려오면서 겨눈다** (v70 에 고쳤다).
    //
    //   처음엔 「사거리에 들어와야 겨누기 시작」이었다. 그랬더니 **빠르고
    //   약한 적은 한 발도 못 쏘고 죽었다** — 요격기는 사거리에 들어온 뒤
    //   3.4초를 세는데, 그 전에 우리 레이저가 1.8초에 부순다. 즉
    //   요격기·자폭정이 **아무 위협도 아닌** 상태였고, 회차에 맞는 것이
    //   여덟 대뿐이었다 (`space-war.js [5]` 가 잡았다).
    //
    //   ★ 실제로도 달려오는 동안 이미 겨누고 있다. 겨눔은 늘 쌓되
    //     **쏘는 것만** 사거리 안에서 한다 — 그러면 사거리에 들어오는
    //     순간 첫 발이 나가고, 「달려들며 쏜다」가 성립한다
    t.aim = (t.aim ?? 0) + dt;
    if (t.aim < ENEMY_FIRE.every) continue;
    if (t.dist > ENEMY_FIRE.range) { t.aim = ENEMY_FIRE.every; continue; }
    t.aim = 0;
    // ★ **날아오는 데 시간이 든다.** 0 이면 피할 수가 없고, 피할 수 없는
    //   것은 벌이지 싸움이 아니다
    sky.incoming.push({
      id: sky.next++, from: t.id, kind: t.kind,
      az: t.az, el: t.el, dist: t.dist,
      t: ENEMY_FIRE.fly,
      pk: enemyHitChance(t.dist),
      roll: sky.rnd(),
    });
  }
  // 날아오는 것들이 닿는다
  for (let i = sky.incoming.length - 1; i >= 0; i--) {
    const s = sky.incoming[i];
    s.t -= dt;
    if (s.t > 0) continue;
    sky.incoming.splice(i, 1);
    // ★★ **쏜 놈이 이미 부서졌으면 그 탄도 없던 일이다.** 안 그러면
    //   격추한 다음 순간에 죽은 적한테 맞는 일이 나고, 그건 말이 안 된다
    if (!sky.list.some((x) => x.id === s.from)) continue;
    if (s.roll > s.pk) { sky.dodged++; hits.push({ miss: true }); continue; }
    sky.tookHits++;
    const where = pickHit(sky.rnd);
    hits.push({
      miss: false, where,
      // ★ 포함은 한 발이 더 아프다 (`punch`) — 「두껍고 세다」의 뒷절반
      punch: KINDS[s.kind]?.punch ?? 1,
      // ★ 세 번에 한 번만 고장이 난다 — 매번이면 회차가 고장 목록이 된다
      fault: sky.rnd() < FAULT_CHANCE ? where.fault : null,
    });
  }

  // 지나간 것 · 비껴 간 것은 뺀다.
  // ★ 선체 바닥(21)이 「지나갔다」 선(18)보다 **바깥**이라 부딪힌 것은
  //   여기서 안 빠진다 — 비껴 간 것만 `dist = -1` 로 스스로 빠진다
  sky.list = sky.list.filter((t) => t.dist > TARGET.gone);
  // ★★★ **부른 것은 want 에 안 센다** — 저절로 지워지면 안 된다.
  //
  //   ★ v70 에 여기서 두 종류가 조용히 사라졌다. 판정이 `rams` 였는데,
  //     새로 만든 **방공 포대와 호송선은 안 들이받는다** — 그래서 「떠도는
  //     쓰레기」로 세어져 청소됐다. 브라우저로 다섯을 나란히 세워 보고
  //     둘이 없어서 찾았다.
  //   ★ 판정은 `weight === 0` 이 맞다: 「무게가 0 이면 저절로 안 뜬다」,
  //     즉 **누가 불러서 온 것**이고, 부른 것은 부른 쪽이 치운다
  const drift = sky.list.filter((t) => (KINDS[t.kind]?.weight ?? 0) > 0);
  while (drift.length < want) { const t = spawnOne(sky.rnd, sky.next++); sky.list.push(t); drift.push(t); }
  if (drift.length > want) {
    const cut = drift.slice(want);
    sky.list = sky.list.filter((t) => !cut.includes(t));
  }
  return { bumps, hits };
}

/** 지금 겨눈 쪽에 **제일 가까운 것** — 조준경이 강조한다 */
export function aimedAt(sky, az, el) {
  let best = null, bestD = 1e9, bestRel = 0;
  for (const t of sky.list) {
    // ★ **감아서 잰다** — 안 그러면 기수 바로 뒤에서 조준이 죽는다
    const rel = azDiff(t.az, az);
    const d = Math.hypot(rel, t.el - el);
    if (d < bestD) { bestD = d; best = t; bestRel = rel; }
  }
  // ★★ v69 — `relAz`·`relEl` 을 같이 준다. 레이더 원뿔은 **기수 기준**인데
  //   v68 까지 `inCone(t.az, t.el)` 로 **세상 기준** 값을 넣고 있었다.
  //   그때는 기수가 ±62 를 못 벗어나 티가 안 났다 — 이제 한 바퀴를 돌므로
  //   안 고치면 「뒤를 보고 있는데 앞의 것이 원뿔 안이라고 나온다」
  return best ? { t: best, off: bestD, relAz: bestRel, relEl: best.el - el } : null;
}

/** 이만큼 벗어나도 맞나 (도) — 큰 것은 넉넉하다 */
export const tolOf = (t) => TARGET.aimTol * (KINDS[t.kind]?.size ?? 1);

/** 사거리 안인가 */
export const inRange = (t) => t.dist <= TARGET.range;

/**
 * ★ 쏜다 — **겨눈 각도로 판정한다.**
 * @returns { hit, kind, broke, gives } — 못 맞히면 hit:false
 */
export function shootSky(sky, az, el) {
  sky.shots++;
  const a = aimedAt(sky, az, el);
  if (!a || !inRange(a.t) || a.off > tolOf(a.t)) return { hit: false };
  const t = a.t;
  t.hp--;
  t.flash = 0.5;
  if (t.hp > 0) return { hit: true, kind: t.kind, broke: false };
  sky.list = sky.list.filter((x) => x !== t);
  sky.killed++;
  return { hit: true, kind: t.kind, broke: true, gives: { ...KINDS[t.kind].gives } };
}

/** 검사·화면이 읽는다 */
export function summary(sky) {
  return {
    region: sky.region, want: wantCount(sky), n: sky.list.length,
    killed: sky.killed, shots: sky.shots,
    grazes: sky.grazes, rams: sky.rams,
    raiders: sky.list.filter((t) => (KINDS[t.kind]?.weight ?? 0) === 0).length,
    cameRaiders: sky.cameRaiders,
    nextRaider: +sky.nextRaider.toFixed(1),
    // ★★ v70 — **날아오는 적탄.** 화면이 이걸 그리고, 검사가 「피할 시간이
    //   있나」를 여기서 묻는다
    incoming: sky.incoming.map((s) => ({
      id: s.id, az: +s.az.toFixed(1), el: +s.el.toFixed(1),
      dist: +s.dist.toFixed(0), t: +s.t.toFixed(2),
    })),
    tookHits: sky.tookHits, dodged: sky.dodged,
    list: sky.list.map((t) => ({
      id: t.id, kind: t.kind, az: +t.az.toFixed(1), el: +t.el.toFixed(1),
      dist: +t.dist.toFixed(0), hp: t.hp, inRange: inRange(t),
      vaz: +t.vaz.toFixed(2), vel: +t.vel.toFixed(2),
    })),
  };
}
