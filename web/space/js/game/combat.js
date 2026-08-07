// ══════════════════════════════════════════════════════════════════════════
//  조종석 전투 — **규칙.** 숫자는 `combat-table.js` 가 갖는다.
//
//  ★ 자리를 **방위·고도·거리**로 든다 — `target.js` 와 **같은 자**다.
//    x/y/z 로 들면 조준경과 규칙이 두 벌이 되고, 그러면 「보이는데 안 맞는」
//    어긋남이 반드시 난다 (v49 에 이미 그렇게 정해 뒀다).
//
//  ★ three.js 를 안 쓴다 — tools/space-combat.js 가 브라우저 없이 읽는다.
// ══════════════════════════════════════════════════════════════════════════
import { RADAR, WEAPONS, WEAPON_LIST, whyNotFire, hitChance, inCone } from './combat-table.js';
import { KINDS } from './target-table.js';

export function makeCombat() {
  return {
    /** 지금 고른 무기 */
    slot: 1,
    /** 남은 재는 시간 */
    cool: 0,
    /** 레이더 — 켜졌나 · 묶는 중인 시간 · 묶은 표적 id · 놓친 뒤 유예 */
    radar: { on: false, t: 0, id: null, grace: 0 },
    /** 날아가는 미사일들 */
    shots: [],
    /** 센 것 — 검사와 끝 화면이 읽는다 */
    fired: 0, hits: 0, kills: 0, misses: 0,
    /** 조종석에 매인 시간 (초) — 장르 안전핀 */
    seat: 0,
  };
}

export const weaponOf = (c) => WEAPON_LIST.find((w) => w.slot === c.slot) ?? WEAPONS.cannon;
export const isLocked = (c, t) => !!(c.radar.on && c.radar.id !== null && t && t.id === c.radar.id);

/**
 * ★★ 레이더 한 걸음 — **탐색 → 묶는 중 → 묶었다.**
 *
 * @param aimed 지금 조준선이 잡은 것 `{ t, off }` (없으면 null)
 * @returns 'lock' | 'break' | null
 */
export function stepRadar(c, dt, aimed) {
  const r = c.radar;
  if (!r.on) { r.t = 0; r.id = null; r.grace = 0; return null; }

  const t = aimed?.t ?? null;
  const good = !!t
    && aimed.off <= RADAR.lockCone
    && t.dist <= RADAR.range
    && inCone(t.az, t.el);

  // 이미 묶었나
  if (r.id !== null) {
    const still = t && t.id === r.id && t.dist <= RADAR.breakRange
      && aimed.off <= RADAR.lockCone && inCone(t.az, t.el);
    if (still) { r.grace = RADAR.holdGrace; return null; }
    // ★ **잠깐 벗어난 것으로는 안 깨진다.** 0 으로 두면 손이 한 번 떨릴 때마다
    //   깨져서 묶는 것이 벌이 된다 — 실제 레이더도 짧은 이탈은 외삽한다
    r.grace -= dt;
    if (r.grace > 0) return null;
    r.id = null; r.t = 0;
    return 'break';
  }

  if (!good) { r.t = Math.max(0, r.t - dt * 1.6); return null; }
  r.t += dt;
  if (r.t >= RADAR.lockFor) { r.id = t.id; r.t = RADAR.lockFor; r.grace = RADAR.holdGrace; return 'lock'; }
  return null;
}

/** 묶은 표적이 사라졌다 (부서졌다) — 락온도 같이 놓는다 */
export function forgetLock(c, id) {
  if (c.radar.id === id) { c.radar.id = null; c.radar.t = 0; c.radar.grace = 0; }
}

/**
 * ★ 쏜다.
 *
 * @param aimed 조준선이 잡은 것 · supply 보급 · rnd 난수
 * @returns { ok, why, shot } — 못 쏘면 `why` 에 이유
 */
export function fire(c, { aimed, supply, rnd = Math.random }) {
  const w = weaponOf(c);
  const t = aimed?.t ?? null;
  const why = whyNotFire({
    weapon: w, target: t, locked: isLocked(c, t),
    supply, cool: c.cool, radar: c.radar.on,
  });
  if (why) return { ok: false, why };

  // 값을 치른다 — **탄약이 곧 수리 재료다**
  supply.ore = Math.max(0, (supply.ore ?? 0) - (w.cost.ore ?? 0));
  supply.parts = Math.max(0, (supply.parts ?? 0) - (w.cost.parts ?? 0));
  c.cool = w.reload;
  c.fired++;

  // ★ 겨눔이 얼마나 정확한가 — 무기마다 허용 각이 다르다.
  //   기총은 **선도**를 줘야 한다: 표적이 흐르는 만큼 앞을 쏴야 맞는다
  const flight = t.dist / w.speed;
  const lead = w.lead ? Math.hypot(t.vaz * flight, t.vel * flight) : 0;
  const off = w.lead
    ? Math.hypot(aimed.off, 0) - 0 + lead * 0   // 선도는 아래 `leadMiss` 로 센다
    : aimed.off;

  const shot = {
    id: c.fired,
    weapon: w.key,
    target: t.id,
    /** 날아가는 남은 시간 */
    t: flight,
    /** 쏠 때 잰 것 — 명중 판정에 쓴다 */
    off, dist: t.dist,
    /** ★ 기총은 선도를 못 주면 빗나간다 */
    leadMiss: w.lead ? lead : 0,
    fireForget: !!w.fireForget,
    dmg: w.dmg,
    pk: hitChance(w, t.dist),
    rnd: rnd(),
    lost: false,
  };
  c.shots.push(shot);
  return { ok: true, shot, weapon: w };
}

/**
 * ★★ 날아가는 미사일 한 걸음.
 *
 * @param find  id 로 표적을 찾는 함수 (없으면 null)
 * @returns 이번에 도착한 것들 `[{ shot, hit, target }]`
 */
export function stepShots(c, dt, { find, lockedId = null } = {}) {
  const done = [];
  for (const s of c.shots) {
    s.t -= dt;
    // ★ **유도탄은 락온이 끊기면 길을 잃는다.** 열추적은 상관없다 —
    //   이 한 줄이 두 무기를 다른 물건으로 만든다
    if (!s.fireForget && lockedId !== s.target) s.lost = true;
    if (s.t > 0) continue;
    const t = find ? find(s.target) : null;
    const w = WEAPONS[s.weapon];
    let hit = false;
    if (t && !s.lost) {
      const tol = w.tol * (KINDS[t.kind]?.size ?? 1);
      const aimOk = s.off <= tol && s.leadMiss <= tol;
      hit = aimOk && s.rnd < s.pk;
    }
    done.push({ shot: s, hit, target: t ?? null });
    if (hit) c.hits++; else c.misses++;
  }
  if (done.length) c.shots = c.shots.filter((s) => !done.some((d) => d.shot === s));
  return done;
}

/** 재는 시간이 흐른다 */
export function stepCool(c, dt, { atSeat = false } = {}) {
  if (c.cool > 0) c.cool = Math.max(0, c.cool - dt);
  if (atSeat) c.seat += dt;
}

/** 무기를 고른다 (1·2·3) */
export function pickSlot(c, n) {
  if (WEAPON_LIST.some((w) => w.slot === n)) { c.slot = n; return weaponOf(c); }
  return null;
}

export function summary(c) {
  const w = weaponOf(c);
  return {
    weapon: w.key, name: w.name, slot: c.slot,
    cool: +c.cool.toFixed(2),
    radar: { ...c.radar, t: +c.radar.t.toFixed(2), grace: +c.radar.grace.toFixed(2) },
    flying: c.shots.length,
    fired: c.fired, hits: c.hits, kills: c.kills, misses: c.misses,
    seat: +c.seat.toFixed(1),
  };
}
