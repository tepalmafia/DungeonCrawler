// ══════════════════════════════════════════════════════════════════════════
//  떠도는 것들 — **규칙.** 표는 target-table.js 가 갖는다.
//
//  ★ 자리를 **방위·고도·거리**로 든다. x/y/z 로 들면 화면(three)과 규칙이
//    같은 숫자를 두 벌 갖게 되고, 그러면 「조준경에는 있는데 안 맞는」
//    종류의 어긋남이 반드시 난다. 조준도 방위·고도로 하므로 **같은 자로 잰다.**
//
//  ★ three.js 를 안 쓴다.
// ══════════════════════════════════════════════════════════════════════════
import { KINDS, TARGET, pickKind } from './target-table.js';

const span = ([a, b], rnd) => a + rnd() * (b - a);

/** 하나 새로 띄운다 */
function spawnOne(rnd, id) {
  const k = pickKind(rnd);
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
  };
}

export function makeSky(rnd) {
  return { rnd, list: [], next: 0, killed: 0, shots: 0, region: 'empty' };
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
  for (const t of sky.list) {
    t.az += t.vaz * dt;
    t.el += t.vel * dt;
    // 끝에 닿으면 **되돈다** — 그래야 시야 밖으로 다 새어 나가지 않는다
    if (Math.abs(t.az) > TARGET.azLimit) { t.az = Math.sign(t.az) * TARGET.azLimit; t.vaz *= -1; }
    if (Math.abs(t.el) > TARGET.elLimit) { t.el = Math.sign(t.el) * TARGET.elLimit; t.vel *= -1; }
    if (moving) t.dist -= TARGET.closing * dt;
    if (t.flash > 0) t.flash = Math.max(0, t.flash - dt);
  }
  // 지나간 것은 뺀다
  sky.list = sky.list.filter((t) => t.dist > TARGET.gone);
  while (sky.list.length < want) sky.list.push(spawnOne(sky.rnd, sky.next++));
  if (sky.list.length > want) sky.list.length = want;
  return null;
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
    list: sky.list.map((t) => ({
      id: t.id, kind: t.kind, az: +t.az.toFixed(1), el: +t.el.toFixed(1),
      dist: +t.dist.toFixed(0), hp: t.hp, inRange: inRange(t),
    })),
  };
}
