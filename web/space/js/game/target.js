// ══════════════════════════════════════════════════════════════════════════
//  떠도는 것들 — **규칙.** 표는 target-table.js 가 갖는다.
//
//  ★ 자리를 **방위·고도·거리**로 든다. x/y/z 로 들면 화면(three)과 규칙이
//    같은 숫자를 두 벌 갖게 되고, 그러면 「조준경에는 있는데 안 맞는」
//    종류의 어긋남이 반드시 난다. 조준도 방위·고도로 하므로 **같은 자로 잰다.**
//
//  ★ three.js 를 안 쓴다.
// ══════════════════════════════════════════════════════════════════════════
import { KINDS, TARGET, HULL, pickKind } from './target-table.js';

const span = ([a, b], rnd) => a + rnd() * (b - a);

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

/** ★★ 적 우주선을 하나 띄운다 — 장면·추격이 부른다 (v64) */
export function spawnRaider(sky) {
  const t = spawnOne(sky.rnd, sky.next++, 'raider');
  // ★ **앞쪽에서 온다.** 뒤에서 오면 화면에 안 보이는 것이 다가오는 셈이라
  //   「부수거나 부딪힌다」가 선택이 아니라 사고가 된다
  t.az = (sky.rnd() * 2 - 1) * (TARGET.azLimit * 0.55);
  t.el = (sky.rnd() * 2 - 1) * (TARGET.elLimit * 0.5);
  t.dist = TARGET.spawn[1];
  sky.list.push(t);
  return t;
}

export function makeSky(rnd) {
  return {
    rnd, list: [], next: 0, killed: 0, shots: 0, region: 'empty',
    /** ★ 이번 회차에 부딪힌 횟수 — 끝 화면과 검사가 읽는다 (v64) */
    grazes: 0, rams: 0,
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
export function stepSky(sky, dt, { moving = true } = {}) {
  const want = wantCount(sky);
  /** ★ 이번 걸음에 난 부딪힘 — main.js 가 흔들고 선체를 깎는다 (v64) */
  const bumps = [];
  for (const t of sky.list) {
    const k = KINDS[t.kind];
    t.az += t.vaz * dt;
    t.el += t.vel * dt;
    // 끝에 닿으면 **되돈다** — 그래야 시야 밖으로 다 새어 나가지 않는다
    if (Math.abs(t.az) > TARGET.azLimit) { t.az = Math.sign(t.az) * TARGET.azLimit; t.vaz *= -1; }
    if (Math.abs(t.el) > TARGET.elLimit) { t.el = Math.sign(t.el) * TARGET.elLimit; t.vel *= -1; }
    // ★ 적 우주선은 **저 혼자 다가온다** — 배가 서 있어도 온다
    if (moving) t.dist -= TARGET.closing * dt;
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
  // 지나간 것 · 비껴 간 것은 뺀다.
  // ★ 선체 바닥(21)이 「지나갔다」 선(18)보다 **바깥**이라 부딪힌 것은
  //   여기서 안 빠진다 — 비껴 간 것만 `dist = -1` 로 스스로 빠진다
  sky.list = sky.list.filter((t) => t.dist > TARGET.gone);
  // ★ 적 우주선은 **want 에 안 센다** — 장면이 부른 것이 저절로 지워지면 안 된다
  const drift = sky.list.filter((t) => !KINDS[t.kind]?.rams);
  while (drift.length < want) { const t = spawnOne(sky.rnd, sky.next++); sky.list.push(t); drift.push(t); }
  if (drift.length > want) {
    const cut = drift.slice(want);
    sky.list = sky.list.filter((t) => !cut.includes(t));
  }
  return bumps;
}

/** 지금 겨눈 쪽에 **제일 가까운 것** — 조준경이 강조한다 */
export function aimedAt(sky, az, el) {
  let best = null, bestD = 1e9;
  for (const t of sky.list) {
    const d = Math.hypot(t.az - az, t.el - el);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best ? { t: best, off: bestD } : null;
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
    raiders: sky.list.filter((t) => KINDS[t.kind]?.rams).length,
    list: sky.list.map((t) => ({
      id: t.id, kind: t.kind, az: +t.az.toFixed(1), el: +t.el.toFixed(1),
      dist: +t.dist.toFixed(0), hp: t.hp, inRange: inRange(t),
      vaz: +t.vaz.toFixed(2), vel: +t.vel.toFixed(2),
    })),
  };
}
