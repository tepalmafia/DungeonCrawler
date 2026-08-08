// ══════════════════════════════════════════════════════════════════════════
//  조종석 전투 — **규칙.** 숫자는 `combat-table.js` 가 갖는다.
//
//  ★ 자리를 **방위·고도·거리**로 든다 — `target.js` 와 **같은 자**다.
//    x/y/z 로 들면 조준경과 규칙이 두 벌이 되고, 그러면 「보이는데 안 맞는」
//    어긋남이 반드시 난다 (v49 에 이미 그렇게 정해 뒀다).
//
//  ★ three.js 를 안 쓴다 — tools/space-combat.js 가 브라우저 없이 읽는다.
// ══════════════════════════════════════════════════════════════════════════
import {
  RADAR, WEAPONS, WEAPON_LIST, whyNotFire, hitChance, inCone, contactLevel,
} from './combat-table.js';
import { KINDS } from './target-table.js';
import { azDiff } from './target.js';

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

export const weaponOf = (c) => WEAPON_LIST.find((w) => w.slot === c.slot) ?? WEAPONS.laser;
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
    && inCone(aimed.relAz, aimed.relEl);

  // 이미 묶었나
  if (r.id !== null) {
    const still = t && t.id === r.id && t.dist <= RADAR.breakRange
      && aimed.off <= RADAR.lockCone && inCone(aimed.relAz, aimed.relEl);
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

/**
 * ★★★ **레이더가 지금 아는 것** (v69) — 계기가 이 목록을 그대로 그린다.
 *
 *   ★ **여기가 유일한 자리다.** 계기(`world/cockpit.js`)에서 직접 하늘을
 *     훑게 두면 「화면에는 있는데 규칙은 모르는」 표적이 생기고, 그건 이
 *     저장소가 두 번 겪은 「표가 둘이면 반드시 갈라진다」다.
 *
 * @param list  `sky.list` — 세상 기준 az
 * @param noseAz 기수가 보는 방위 (도)
 * @returns [{ id, relAz, dist, level, foe, locked }]
 */
export function radarBlips(c, list, noseAz, noseEl = 0) {
  if (!c.radar.on) return [];
  const out = [];
  for (const t of list ?? []) {
    const rel = { relAz: azDiff(t.az, noseAz), relEl: t.el - noseEl, dist: t.dist };
    // ★ **엔진을 켠 것만** 원뿔 밖에서 잡힌다 — 파편과 죽은 위성은 열이 없다
    const hot = !!KINDS[t.kind]?.closes;
    const level = contactLevel(rel, hot);
    if (!level) continue;
    out.push({
      id: t.id, relAz: rel.relAz, dist: t.dist, level,
      foe: !!KINDS[t.kind]?.rams,
      locked: c.radar.id === t.id,
    });
  }
  return out;
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

  // 값을 치른다.
  // ★★ v69 — 미사일은 **제 주머니**를 쓴다 (`supply-table.js MISSILES`).
  //   레이저는 여기서 아무것도 안 낸다 — 대신 `main.js` 가 **열**을 더한다
  supply.ore = Math.max(0, (supply.ore ?? 0) - (w.cost.ore ?? 0));
  supply.parts = Math.max(0, (supply.parts ?? 0) - (w.cost.parts ?? 0));
  supply.missiles = Math.max(0, (supply.missiles ?? 0) - (w.cost.missiles ?? 0));
  c.cool = w.reload;
  c.fired++;

  // ══ ★★★ **선도(lead) — v69 에서 뜻이 바뀌었다** ═══════════════════
  //
  //  v68 까지: `leadMiss` 를 따로 세어 **선도가 크면 무조건 빗나갔다.**
  //    즉 빠르게 흐르는 표적은 **어디를 겨눠도 못 맞혔다** — 사람이
  //    할 수 있는 일이 없는데 벌만 있었던 셈이다. 이건 난이도가 아니라
  //    **없는 조작**이다.
  //
  //  v69 부터: **앞을 겨누면 맞는다.** 표적이 갈 자리(선도점)를 재고,
  //    거기서 얼마나 벗어났는지로 판정한다. HUD 가 그 자리에 **점**을
  //    찍어 주므로(`world/gunsight.js`), 「점에 십자선을 얹어라」가
  //    글 없이 전해진다 — 실제 전투기의 LCOS 가 정확히 이 일을 한다
  const flight = t.dist / w.speed;
  const leadAz = w.lead ? t.vaz * flight : 0;
  const leadEl = w.lead ? t.vel * flight : 0;
  // 겨눠야 하는 자리는 표적이 아니라 **선도점**이다
  const off = w.lead
    ? Math.hypot((aimed.relAz ?? 0) - leadAz, (aimed.relEl ?? 0) - leadEl)
    : aimed.off;

  const shot = {
    id: c.fired,
    weapon: w.key,
    target: t.id,
    /** 날아가는 남은 시간 */
    t: flight,
    /** 쏠 때 잰 것 — 명중 판정에 쓴다. 선도 무기는 **선도점 기준**이다 */
    off, dist: t.dist,
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
      // ★ v69 — `leadMiss` 를 없앴다. 선도는 이제 **겨눌 수 있는 것**이라
      //   `off` 안에 들어 있다 (`fire()` 주석). 따로 두면 「앞을 겨눴는데도
      //   빗나간다」가 남는다
      const tol = w.tol * (KINDS[t.kind]?.size ?? 1);
      hit = s.off <= tol && s.rnd < s.pk;
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
