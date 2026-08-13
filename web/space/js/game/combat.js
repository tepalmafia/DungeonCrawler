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
  RADAR, WEAPONS, WEAPON_LIST, whyNotFire, hitChance, inCone, contactLevel, PICK,
} from './combat-table.js';
import { KINDS, isFoe, ENEMY_FIRE } from './target-table.js';
// ★★★ v98 — **자리를 아는 곳은 `frame.js` 하나다** (블록아웃).
//   레이더가 제 방식으로 다시 재면, 화면이 그리는 자리와 갈라진다 —
//   그게 사장님이 「**레이더와 실제 우주에 보이는 물체의 일관성**」이라고
//   말씀하신 바로 그 자리다
import { wrap, relOf } from './frame.js';
import { flyTime, slowsOnLaunch } from './slow-table.js';
import { MISSILES } from './supply-table.js';
// ★★★ v100 — **발사관.** 기수 고정(레이저)과 짐벌(유도탄)을 가른다
import { isGimbaled } from './mount-table.js';

export function makeCombat() {
  return {
    /** 지금 고른 무기 */
    slot: 1,
    /** 남은 재는 시간 */
    cool: 0,
    /** 레이더 — 켜졌나 · 묶는 중인 시간 · 묶은 표적 id · 놓친 뒤 유예 */
    /** ★ v73 — `was` 는 지난 프레임의 거리 (줄고 있나를 잰다) · `chasing` 은 그 답 */
    /**
     * ★★ v75 — `seen` 은 **표적마다** 지난 거리를 들고 있다.
     *   v73 은 **묶은 것 하나**만 접근율을 쟀다 — 그래서 계기가
     *   「저기 뭔가 다가온다」를 말할 수가 없었다. 실제 스코프는
     *   **모든 접촉**에 접근율을 적는다 (`radar-table.js` 고증 ②)
     */
    // ★ v97 — `atAz/atEl` 은 **표식이 지금 가리키는 자리** (기수 기준 도).
    //   표적을 쫓아간다 (`RADAR.slew`) — 즉각 안 붙는다
    // ★ v119 — `wasD` 는 **묶은 표적**의 지난 거리 (노치용 시선 속도) ·
    //   `notch` 는 접근율이 죽어 있던 시간 · `why` 는 놓친 이유
    radar: {
      on: false, t: 0, id: null, grace: 0, was: null, chasing: false, seen: new Map(),
      atAz: 0, atEl: 0, wasD: null, notch: 0, why: null,
    },
    /** 날아가는 미사일들 */
    shots: [],
    /** 센 것 — 검사와 끝 화면이 읽는다 */
    fired: 0, hits: 0, kills: 0, misses: 0,
    /** 조종석에 매인 시간 (초) — 장르 안전핀 */
    seat: 0,
    /** ★★★ v85 — **지정한 표적** (T · Tab). 락온과 **다른 것**이다 */
    pick: null,
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
  if (!r.on) {
    r.t = 0; r.id = null; r.grace = 0; r.atAz = 0; r.atEl = 0;
    r.notch = 0; r.wasD = null;
    return null;
  }

  const t = aimed?.t ?? null;
  const good = !!t
    && aimed.off <= RADAR.lockCone
    && t.dist <= RADAR.range
    && inCone(aimed.relAz, aimed.relEl);

  // 이미 묶었나
  if (r.id !== null) {
    // ══ ★★★ v119 — **도플러 두 성분**을 잰다 (노치 · frame.js LOCK) ══
    //  ★ 거리는 내가 고개를 돌려도 안 변하므로 시선 속도는 그냥 재도 맞고,
    //    옆 속도는 표적이 **제 힘으로** 흐르는 몫(`vaz`·`vel`, 세상 기준)
    //    에서 온다. 이걸 눈 기준으로 재면 **내가 휘저을 때마다 노치**가
    //    되어 사장님이 요청하신 것과 **정반대**의 게임이 된다
    const closing = (t && r.wasD !== null && r.wasD !== undefined)
      ? (r.wasD - t.dist) / Math.max(dt, 1e-6) : null;
    r.wasD = t ? t.dist : null;
    const side = t ? t.dist * Math.hypot(t.vaz ?? 0, t.vel ?? 0) * (Math.PI / 180) : 0;
    if (closing !== null && Math.abs(closing) < RADAR.notch && side >= RADAR.notchSide) {
      r.notch = (r.notch ?? 0) + dt;
    } else r.notch = 0;
    const notched = (r.notch ?? 0) >= RADAR.notchFor;
    // ★★★ v119 — 유지 한계가 **짐벌**이다 (holdCone 32 → RADAR.gimbal 60).
    //   조준선이 아니라 「안테나가 돌아갈 수 있나」를 묻는다
    const still = t && t.id === r.id && t.dist <= RADAR.breakRange
      && aimed.off <= RADAR.gimbal && !notched;
    if (still) {
      r.grace = RADAR.holdGrace;
      // ★★★ v97 — **표식이 표적을 쫓아간다** (`RADAR.slew` · frame.js 블록아웃).
      //   즉각 붙이면 계기가 아니라 자석이고, 안 붙이면 「위치가 완전 다르다」다
      const step = RADAR.slew * dt;
      const dAz = wrap(aimed.relAz - r.atAz);
      r.atAz += Math.max(-step, Math.min(step, dAz));
      r.atEl += Math.max(-step, Math.min(step, aimed.relEl - r.atEl));
      return null;
    }
    // ★ **잠깐 벗어난 것으로는 안 깨진다.** 0 으로 두면 손이 한 번 떨릴 때마다
    //   깨져서 묶는 것이 벌이 된다 — 실제 레이더도 짧은 이탈은 외삽한다
    r.grace -= dt;
    if (r.grace > 0) return null;
    // ★ v119 — **왜 놓쳤는지**를 남긴다. 「놓쳤습니다」만 뜨면 사람은
    //   무엇을 고쳐야 하는지 모른다 — 짐벌 아웃과 노치는 답이 정반대다
    //   (전자는 기수를 끌어와야 하고, 후자는 밀어붙여야 한다)
    r.why = notched ? 'notch' : (!t || t.dist > RADAR.breakRange) ? 'range' : 'gimbal';
    r.id = null; r.t = 0; r.notch = 0; r.wasD = null;
    return 'break';
  }

  if (!good) { r.t = Math.max(0, r.t - dt * 1.6); r.was = null; return null; }

  // ══ ★★★ **붙어서 따라가면 빨리 물린다** (v73 · BFM.md §3-①) ═══════
  //
  //  ★ 추격 곡선 셋 중 **선도 추격**의 표시가 「거리가 줄어든다」다.
  //    겨누고 · 가깝고 · 줄어들고 — 셋이 다 참이면 잘 쫓고 있는 것이고,
  //    그때 묶는 시간이 절반으로 준다.
  //  ★★ 그러면 락온이 「올려 두고 기다리기」에서 **「쫓아서 해내기」**가
  //    된다. 기다리는 것은 조작이 아니지만 쫓는 것은 조작이다
  const closing = r.was !== null ? (r.was - t.dist) / Math.max(dt, 1e-6) : 0;
  r.was = t.dist;
  const C = RADAR.chase;
  const chasing = t.dist <= C.closeIn && closing >= C.closing;
  r.chasing = chasing;
  r.t += dt * (chasing ? 1 / C.fast : 1);
  if (r.t >= RADAR.lockFor) {
    r.id = t.id; r.t = RADAR.lockFor; r.grace = RADAR.holdGrace;
    r.notch = 0; r.wasD = t.dist; r.why = null;
    return 'lock';
  }
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
export function radarBlips(c, list, noseAz, noseEl = 0, dt = 0) {
  if (!c.radar.on) { c.radar.seen.clear(); return []; }
  const out = [];
  const alive = new Set();
  const eye = { yaw: noseAz, pitch: noseEl };
  for (const t of list ?? []) {
    // ★★★ v98 — **조준선이 쓰는 것과 같은 함수**로 잰다 (`frame.js relOf`).
    //   v97 까지 여기서 직접 뺐고, 조준은 `aimedAt` 이 따로 뺐다 — 값이
    //   같아 보여도 **두 곳이면 반드시 갈라진다**. 한 곳에서 나와야 한다
    const r = relOf(t, eye);
    const rel = { relAz: r.az, relEl: r.el, dist: r.dist };
    // ★ **엔진을 켠 것만** 원뿔 밖에서 잡힌다 — 파편과 죽은 위성은 열이 없다
    const hot = !!KINDS[t.kind]?.closes;
    const level = contactLevel(rel, hot);
    if (!level) continue;
    alive.add(t.id);

    // ══ ★★ **접근율** (v75 · 고증 ②) ═══════════════════════════════
    //  실제 스코프가 표적 옆에 반드시 적는 숫자다. 거리보다 중요하다 —
    //  **부호 하나가 곧 추격 곡선**이다 (BFM.md): 줄면 선도 추격,
    //  그대로면 순수 추격, 늘면 지연 추격이다.
    //  ★ v73 은 **묶은 것 하나**만 쟀다. 계기가 「저기 뭔가 다가온다」를
    //    말하려면 접촉 전부에 있어야 한다
    const was = c.radar.seen.get(t.id);
    const closing = (was !== undefined && dt > 1e-6) ? (was - t.dist) / dt : null;
    c.radar.seen.set(t.id, t.dist);

    out.push({
      id: t.id, relAz: rel.relAz, dist: t.dist, level,
      // ★★★ **위아래** — 여기가 「오른쪽 왼쪽이 아니고」의 답이다.
      //   PPI 는 세로축이 거리라 고도를 담을 데가 없다. 실제 레이더가
      //   그러듯 **점 옆에 숫자로** 낸다 (`radar-table.js elWord`)
      relEl: rel.relEl,
      closing,
      // ★★★ v80 — **「들이받나」가 아니라 「적인가」다.** 방공 포대와
      //   보급 호송선은 안 들이받지만 적이고, v79 까지 이 한 줄 때문에
      //   **파편과 같은 초록 점**으로 떴다 (`target-table.js isFoe`)
      foe: isFoe(t.kind),
      locked: c.radar.id === t.id,
      kind: t.kind,
      /**
       * ★★ **저쪽이 나를 겨누고 있나** 0~1 — RWR 이 이걸 그린다.
       *   적은 겨눔을 쌓고 나서 쏘는데(`target.js` 의 `t.aim`), v74 까지
       *   그 시간이 **화면에 하나도 안 나왔다.** 그래서 피격은 늘 예고가
       *   없었다. 실제 조종사가 제일 먼저 보는 계기가 이것이다
       */
      aiming: Math.max(0, Math.min(1, (t.aim ?? 0) / Math.max(1e-6, ENEMY_FIRE.every))),
    });
  }
  // 사라진 것은 기억에서 지운다 — 안 지우면 id 가 돌아왔을 때 엉뚱한 값이 나온다
  for (const id of [...c.radar.seen.keys()]) if (!alive.has(id)) c.radar.seen.delete(id);
  return out;
}

/**
 * ══ ★★★ **표적 지정** — 키 하나로 제일 가까운 적 (v85) ═══════════════
 *
 *  ★ 사장님 「목표물을 타겟할 수가 없잔아! … **가장 직관적인 시스템**을」
 *
 *  ★★ 이 장르가 거의 예외 없이 쓰는 것을 그대로 가져온다: **T 로 제일
 *    가까운 적 · Tab 으로 다음 것.** 조준선으로 찾아내라고 하지 않는다 —
 *    하늘은 사방(±180)이고 적은 작다.
 *
 *  ★★★ 그런데 **지정은 락온이 아니다.** 지정은 「저놈을 본다」이고,
 *    묶는 것은 여전히 **조준선에 2.6초 올려 두는 손의 일**이다.
 *    지정이 락온까지 해 주면 유도탄이 버튼 하나가 되고, 그러면
 *    「최종 결정은 플레이어가」(v84)가 무너진다
 *
 * @param list  `sky.list`
 * @param next  true 면 **지금 것 다음**을 고른다 (Tab)
 * @returns 고른 표적 (없으면 null)
 */
export function pickTarget(c, list, noseAz = 0, noseEl = 0, next = false) {
  const foes = (list ?? [])
    .filter((t) => isFoe(t.kind) && t.dist <= PICK.range)
    // ★ 가까운 것 먼저 · 같은 거리면 **정면 쪽**이 먼저
    .map((t) => {
      // ★ v98 — 「정면 쪽」도 `frame.js` 가 잰 벗어난 각을 쓴다
      const off = relOf(t, { yaw: noseAz, pitch: noseEl }).off;
      return { t, score: t.dist + off * PICK.front * 4 };
    })
    .sort((a, b) => a.score - b.score)
    .map((x) => x.t);
  if (!foes.length) { c.pick = null; return null; }
  if (!next || c.pick === null) { c.pick = foes[0].id; return foes[0]; }
  const i = foes.findIndex((t) => t.id === c.pick);
  const pickd = foes[(i + 1) % foes.length];
  c.pick = pickd.id;
  return pickd;
}

/** 지금 지정한 것 (없거나 부서졌으면 null) */
export function picked(c, list) {
  if (c.pick === null) return null;
  const t = (list ?? []).find((x) => x.id === c.pick) ?? null;
  if (!t) c.pick = null;
  return t;
}

/** 지정을 놓는다 */
export const dropPick = (c) => { c.pick = null; };

/** 묶은 표적이 사라졌다 (부서졌다) — 락온도 같이 놓는다 */
export function forgetLock(c, id) {
  if (c.radar.id === id) { c.radar.id = null; c.radar.t = 0; c.radar.grace = 0; }
}

/**
 * ★ 쏜다.
 *
 * @param aimed  조준선이 잡은 것 · supply 보급 · rnd 난수
 * @param locked ★ v119 — **묶은 표적** `{ t, off, relAz, relEl }`.
 *   `onLock` 무기는 조준선이 아니라 이것을 쏜다 (레이더 유도 고증)
 * @returns { ok, why, shot } — 못 쏘면 `why` 에 이유
 */
export function fire(c, {
  aimed, locked = null, supply, rnd = Math.random, mount = null, mountAt = null,
}) {
  const w = weaponOf(c);
  // ══ ★★★ v119 — **묶었으면 그놈을 쏜다** (조준선이 아니다) ══════════
  //
  //  ★ 사장님 「락온 시키면 자동으로 타겟을 따라가도록 해줘. 내가 타겟을
  //    조준을 크게 벗어나면 **다시 조준해야 해서 불편해**」
  //
  //  ★★ 불편의 나머지 절반이 여기였다. v118 까지 락온은 **유지만** 됐고
  //    (v94 가 표적을 id 로 따라가게 만들었다), **쏘는 순간에는 이 함수가
  //    `aimed`(조준선)만 봤다.** 그래서 「묶여 있는데도 다시 겨눠야」
  //    했고, 그게 사장님이 겪으신 그것이다.
  //
  //  ★★★ 고증: 레이더 유도탄은 **트랙 파일**을 쏜다 — 조준선이 아니라
  //    레이더가 물고 있는 그놈이 표적이다. 기총(레이저)만 기수 고정이라
  //    겨눠야 맞는다 (`onLock: false`). 그 차이가 **장르 안전핀**이기도
  //    하다 — 전부 락온을 쏘면 v114 의 조준 띠가 통째로 죽는다
  const useLock = !!(w.onLock && locked?.t && isLocked(c, locked.t)
    && locked.off <= (w.onLockCone ?? RADAR.gimbal));
  const src = useLock ? locked : aimed;
  const t = src?.t ?? null;
  const why = whyNotFire({
    weapon: w, target: t, locked: isLocked(c, t),
    supply, cool: c.cool, radar: c.radar.on,
  });
  if (why) return { ok: false, why };

  // 값을 치른다.
  // ★★ v69 — 미사일은 **제 주머니**를 쓴다 (`supply-table.js MISSILES`).
  //   레이저는 여기서 아무것도 안 낸다 — 대신 `main.js` 가 **열**을 더한다
  // ★ v84 — **시험 동안 안 닳는다** (`supply-table.js MISSILES.infinite`)
  if (!MISSILES.infinite) {
    supply.ore = Math.max(0, (supply.ore ?? 0) - (w.cost.ore ?? 0));
    supply.parts = Math.max(0, (supply.parts ?? 0) - (w.cost.parts ?? 0));
    // ★★★ v133 — **제 통에서 뺀다** (`ammo-table.js`). 옛 저장(통이 없는
    //   경우)은 지금까지처럼 `missiles` 를 쓴다 — 이어한 사람이 안 막히게
    if (supply.ammo && supply.ammo[w.key] !== undefined) {
      supply.ammo[w.key] = Math.max(0, supply.ammo[w.key] - 1);
    } else {
      supply.missiles = Math.max(0, (supply.missiles ?? 0) - (w.cost.missiles ?? 0));
    }
  }
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
  // ══ ★★★ v84 — **사출 → 점화 → 가속** (`slow-table.js LAUNCH`) ══════
  //
  //  ★ `dist / speed` 였다. 그러면 **화면은 사출하고 규칙은 순항**이라
  //    둘이 갈라진다 — v79 에 사장님이 「미사일이 날아가는 궤적과 적이
  //    격추되는 지점이 다르게 보인다」고 하신 그 병과 **같은 병**이다.
  //    같은 함수를 둘이 쓴다
  //
  //  ★★ 그리고 이건 **난이도를 바꾼다**: 비행이 0.6초쯤 길어지므로
  //    유도탄은 락온을 그만큼 더 붙들어야 한다. 그 값이 `lagOf` 이고
  //    `tools/space-slow.js` 가 0.8초를 넘는지 본다
  // ★★★ **즉발에는 사출을 안 씌운다** (v85 · 사장님 「발사체가 적이나
  //   물체로 시각적으로 날아가야하는데 **엉뚱한 곳에서 터지는데??**」)
  //
  //  ★ v84 에 이 줄을 무기 **전부**에 걸었다. 그런데 레이저는 즉발이라
  //    화면은 **한 줄기 빛을 0.12초 긋고 끝**인데, 규칙은 사출(0.3초)+
  //    가속을 씌워 **0.51초**를 기다렸다. 그 사이 표적이 움직이니
  //    **빛이 지나간 자리와 터지는 자리가 갈라졌다.**
  //  ★★ v79 에 고쳤던 바로 그 병(「궤적의 끝과 격추 지점이 다르다」)을
  //    **사출을 넣으면서 되살린 것**이다. 사출이 있는 것에만 씌운다
  const flight = slowsOnLaunch(w.key) ? flyTime(t.dist, w.speed) : t.dist / w.speed;
  const leadAz = w.lead ? t.vaz * flight : 0;
  const leadEl = w.lead ? t.vel * flight : 0;
  // 겨눠야 하는 자리는 표적이 아니라 **선도점**이다
  // ★ v119 — **묶은 것을 쏘면 여기도 묶은 것에서 잰다.** `aimed` 로 재면
  //   「락온으로 쐈는데 명중 판정은 조준선」이 되어 둘이 갈라진다 —
  //   이 저장소가 v79·v85 에 두 번 겪은 「궤적과 격추 지점이 다르다」와
  //   **같은 병**이다. 표적을 고른 곳과 재는 곳은 늘 같아야 한다
  let off = w.lead
    ? Math.hypot((src.relAz ?? 0) - leadAz, (src.relEl ?? 0) - leadEl)
    : src.off;
  // ══ ★★★ v100 — **발사관에 실린 무기는 기수가 아니라 발사관에서 잰다** ══
  //
  //  ★ 사장님 「적을 계속 타겟팅 하면서 회피 기동이 가능하도록」.
  //    v99 까지 명중 판정이 **기수 기준**이라, 옆으로 빼는 순간
  //    `off` 가 허용각(4.2도)을 넘어 **한 발도 못 맞혔다.**
  //
  //  ★★ 이제 짐벌 무기는 `mount` 가 준 오차를 쓴다 — 따라가다 뒤처진
  //    몫과 **흔들린 몫**을 합친 값이다 (`mount.js errOf`). 그래서
  //    「피하면서 쏜다」가 되고, 대신 **정확도를 내준다.**
  //  ★ 레이저는 그대로 기수 고정이다 — 기총이므로 겨눠야 맞는다.
  //    그 둘의 차이가 「붙어서 훑을까 빼면서 물까」를 만든다
  // ★★★ v119 — **발사관의 오차도 「고른 그것」에서 잰다.** `mountAt` 을
  //   받으면 `src` 로 다시 잰다 — 락온으로 쏘는데 오차는 조준선에서 재면
  //   38도가 그대로 오차가 되어 **묶어 놓고도 100% 빗나간다.** 처음에
  //   그렇게 짜 놓고 검사에서 「피해 0.00」을 보고 알았다.
  //   발사관은 이미 묶은 표적을 쫓고 있으므로, 제대로 재면 남는 것은
  //   **뒤처진 몫 + 흔들린 몫**뿐이다 — 그게 「피하면서 쏘면 정확도를
  //   내준다」(v100)의 원래 뜻이다
  const mnt = mountAt ? mountAt({ az: src.relAz ?? 0, el: src.relEl ?? 0 }) : mount;
  if (mnt && isGimbaled(w.key)) off = mnt.err ?? off;

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
    /**
     * ★ v119 — **날아가고 있는 것들.** 「어느 것에게 나갔나」를 밖에서
     *   물을 길이 없었다 — 그래서 락온 사격이 정말 묶은 것으로 가는지를
     *   브라우저로 재 볼 수가 없었다 (`tools/space-endtoend.js` 가 읽는다)
     */
    shotList: c.shots.map((s) => ({ id: s.id, weapon: s.weapon, target: s.target, off: +s.off.toFixed(1) })),
    fired: c.fired, hits: c.hits, kills: c.kills, misses: c.misses,
    seat: +c.seat.toFixed(1),
  };
}
