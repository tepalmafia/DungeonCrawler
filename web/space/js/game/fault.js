// ══════════════════════════════════════════════════════════════════════════
//  고장 — **three.js 를 안 쓴다.**
//
//  ★ 재미의 중심은 「수리」가 아니라 「진단」이다 (PLAN §3-1)
//    나쁜 설계: 화면에 「기관실 냉각 밸브 파손」이 뜨고 가서 돌린다. 심부름이다.
//    그래서 여기는 **어디가 고장났는지 안 알려준다.** 알려주는 것은
//    「무언가 잘못됐다」까지 — 그게 `lead` 한 줄이다.
//
//    찾는 것은 **귀로** 한다. 고장 난 자리에 가까울수록 덜그럭거림이 커진다
//    (`nearness()` 를 core/audio.js 가 받아 쓴다). 화면을 하나도 안 늘리고
//    진단이 성립하는 유일한 길이었다.
//
//  ★ 한 방에서 끝나는 고장은 안 만든다
//    방 일곱을 쓰려고 만든 배다. `steps` 가 둘 이상이거나(정비실 → 기관실),
//    자리가 셋 중 하나여서 찾아 다녀야 한다(원인 모를 열).
//
//  ★ 시간의 대부분은 **걷는 시간**이다
//    PLAN §11 은 「문제 하나 40초~2분」인데, 손이 실제로 가 있는 것은 5~8초다.
//    잡고 있는 걸 40초로 두면 그건 진단이 아니라 진행 바를 보는 일이 된다.
// ══════════════════════════════════════════════════════════════════════════
import { makeRng } from '../core/rng.js';
import { FAULT, wired, branchWeights, BY_KEY } from './mission-table.js';
import { WEAR } from './systems-table.js';

const lerp = (a, b, t) => a + (b - a) * t;

export function makeFaults(seed = 'FAULT1') {
  return {
    rnd: makeRng(`${seed}-fault`),
    open: [],            // 지금 열려 있는 고장들
    next: FAULT.firstAfter,
    t: 0,
    fixed: 0,            // 몇 개나 고쳤나
    // 계통별 마모. **쓰는 대로 닳고, 닳은 데가 터진다** (systems-table.js WEAR)
    wear: Object.fromEntries(WEAR.keys.map((k) => [k, 0])),
    log: [],             // 이번 회차에 무엇을 고쳤나 — 진단대가 읽는다
  };
}

/**
 * 쓴 만큼 닳는다. **무작위로 터지면 대비할 방법이 없다** —
 * 대비할 수 없으면 정비실 진단대는 장식이 된다.
 */
export function wearStep(f, dt, { power, valveOpen, region }) {
  const r = WEAR.rate;
  const add = (k, v) => { f.wear[k] = Math.min(1, f.wear[k] + v * dt); };
  add('power', r.base + (power.thrust ? r.base : 0) + (power.sensor ? r.base : 0));
  add('cool', r.base + (power.cool ? r.coolOn : 0) + (valveOpen ? r.valve : 0));
  add('hull', r.base + (power.thrust ? r.thrust : 0) + (region === 'debris' ? r.debris : 0));
}

/** 차단기를 만졌다 — 한 번에 조금씩 닳는다 */
export function wearFlip(f) {
  f.wear.power = Math.min(1, f.wear.power + WEAR.perFlip);
}

/** 무게를 보고 하나 고른다 */
function pick(rnd, items) {
  const total = items.reduce((s, x) => s + x.weight, 0);
  if (total <= 0) return items[0];
  let r = rnd() * total;
  for (const x of items) { r -= x.weight; if (r <= 0) return x; }
  return items[items.length - 1];
}

/**
 * 고장 하나를 만든다.
 * @param first 첫 고장인가 — `first: true` 인 항목을 먼저 낸다. 처음 만나는
 *              고장이 「원인 모를 열」이어야 이 게임이 무슨 게임인지 알게 된다
 */
function spawn(f, leg, first) {
  const pool = wired();
  const list = first ? (pool.filter((m) => m.first).concat(pool)) : pool;
  // 같은 것이 동시에 두 개 열리지는 않게
  const openKeys = new Set(f.open.map((o) => o.key));
  const cand = list.filter((m) => !openKeys.has(m.key));
  if (!cand.length) return null;
  // ★ **닳은 계통이 더 잘 터진다.** 이게 「어떻게 몰았는지가 다음을 정한다」의
  //   실체이고, 정비실 진단대가 예고할 수 있는 근거다
  const m = first && cand[0] === list[0]
    ? cand[0]
    : pick(f.rnd, cand.map((x) => ({
      ...x, weight: 1 + (f.wear[x.sys] ?? 0) * (WEAR.bias - 1),
    })));

  const branch = pick(f.rnd, branchWeights(m, leg));
  // 자리 — 갈래가 정하거나(원인 모를 열), 표에 적힌 순서대로(냉매·배전)
  const at = branch.at ? (Array.isArray(branch.at) ? branch.at : [branch.at]) : null;
  const steps = at
    ? at.map((room) => ({ at: room, hold: m.hold ?? 7, what: null }))
    : (m.steps || []).map((s) => ({ ...s }));
  if (!steps.length) return null;

  return {
    key: m.key, name: m.name, lead: m.lead, sys: m.sys, effect: m.effect || {},
    branch: branch.key, reveal: branch.what,
    // 「한 통으로는 모자란다」 — 마지막 걸음을 한 번 더 한다
    again: !!branch.again,
    steps, step: 0, held: 0,
    // 「그 회로는 이 구간 내내 못 쓴다」 — 고쳐도 이번 구간엔 안 돌아온다
    stuck: branch.key === 'dead',
    age: 0,
  };
}

/**
 * ★ **장면이 고장 하나를 직접 연다** (game/scene.js · PLAN2H §4).
 *
 *   `stepFaults` 는 시계와 마모를 보고 뽑는다. 장면은 그러면 안 된다 —
 *   구간 6 에서 자세 제어가 죽어야 하는데 「운이 좋으면 안 죽는」 것은
 *   장면이 아니라 잔일이다. 그래서 열쇠로 곧장 연다.
 *
 *   `wired()` 는 `sceneOnly` 가 붙은 것을 거르므로, 여기로 안 열면
 *   이 고장은 **영영 안 나온다.** 그게 맞는 설계다.
 *
 * @returns 연 고장 · 이미 열려 있으면 그것 · 표에 없으면 null
 */
export function open(f, key, { branch = null } = {}) {
  const had = f.open.find((o) => o.key === key);
  if (had) return had;
  const m = BY_KEY[key];
  if (!m) return null;
  const b = branch ? m.branches.find((x) => x.key === branch) : m.branches[0];
  // ★★ **갈래가 자리를 정하는 항목도 열 수 있어야 한다** (v62).
  //   여기는 `m.steps` 만 봤고, 그래서 미소운석처럼 **갈래가 방을 뽑는**
  //   항목은 장면이 불러도 `null` 이 돌아왔다 — 조용히 아무 일도 안 났다.
  //   `spawn` 은 이미 이렇게 하고 있었으므로, 둘이 갈라져 있던 것이다
  const at = b?.at ? (Array.isArray(b.at) ? b.at : [b.at]) : null;
  const steps = at
    ? at.map((room) => ({ at: room, hold: m.hold ?? 7, what: null }))
    : (m.steps || []).map((s) => ({ ...s }));
  if (!steps.length) return null;
  const made = {
    key: m.key, name: m.name, lead: m.lead, sys: m.sys, effect: m.effect || {},
    branch: b?.key ?? null, reveal: b?.what ?? null,
    again: !!b?.again, steps, step: 0, held: 0, stuck: false, age: 0,
  };
  f.open.push(made);
  return made;
}

/** 지금 손이 가야 하는 자리 (방 이름). 다 고쳤으면 null */
export function siteOf(fault) {
  return fault.steps[fault.step]?.at ?? null;
}

/**
 * 지금 있는 방에 고칠 것이 있나 — **가장 가까운 하나**만 돌려준다.
 * 둘이 겹치면 먼저 뜬 것부터. 동시에 두 개를 잡게 하면 손이 하나인
 * 게임에서 말이 안 된다.
 */
export function hereIn(f, room) {
  return f.open.find((o) => siteOf(o) === room) ?? null;
}

/**
 * 소리로 얼마나 가까운가 0~1. **이게 진단의 전부다.**
 * 방이 맞으면 1 에 가깝고, 옆방이면 희미하고, 멀면 0 이다.
 */
export function nearness(f, room, dist) {
  let best = 0;
  for (const o of f.open) {
    const at = siteOf(o);
    if (!at) continue;
    // 같은 방이면 거리로, 다른 방이면 아주 희미하게만 — 「이 근처다」까지만 준다
    const v = at === room
      ? 1 - Math.min(1, (dist ?? 0) / FAULT.hearing) * 0.45
      : 0.12;
    if (v > best) best = v;
  }
  return best;
}

/** 고쳐지기 전까지 배에 무슨 일이 나나 */
/**
 * ★★★ **여기는 진공이 안 된다** (v82).
 *   · `spine` — 방 일곱을 잇는 **유일한 길**
 *   · `airlock` — **우주복 걸이가 있는 방** (`world/ship.js`)
 *   둘 중 하나가 막히면 사람이 아무 데도 못 간다
 */
export const NO_VACUUM = ['spine', 'airlock'];

export function effectsOf(f) {
  // ★ **고장 하나가 계통 하나를 배신한다.** 방마다 다른 것을 망가뜨리는 것이
  //   이 표의 규칙이다 — 기관실은 열, 통로는 차단기, 관측실은 해도대,
  //   온실은 식량, 에어록은 윈치, 조종석은 조종간.
  //   그래야 「그 방에 왜 가는가」가 방마다 다르다 (GAP.md §3-C).
  const out = {
    heat: 0, coolValve: 0, sign: 0, food: 0, drift: 0,
    flaky: false, chartLie: false, noWinch: false, doorWild: false,
    /**
     * ★★ **뚫려서 진공이 된 방** (v62 · 미소운석).
     *   아직 **안 막은** 걸음의 방만 들어간다 — 한 방을 막으면 그 방은
     *   곧 다시 기밀이 되고 다음 방이 남는다. 그래야 「흩뿌려 맞았다」의
     *   「막았는데 왜 아직 새지」가 규칙 하나로 성립한다
     */
    vacuum: [],
  };
  for (const o of f.open) {
    if (o.effect.heat) out.heat += o.effect.heat;
    if (o.effect.coolValve) out.coolValve += o.effect.coolValve;
    if (o.effect.sign) out.sign += o.effect.sign;       // 자국이 는다 (새는 공기·문 소리)
    if (o.effect.food) out.food += o.effect.food;       // 식량이 빨리 준다
    if (o.effect.drift) out.drift += o.effect.drift;    // 배가 저절로 흐른다
    if (o.effect.flaky) out.flaky = true;
    if (o.effect.chartLie) out.chartLie = true;         // 해도대가 거짓말한다
    if (o.effect.noWinch) out.noWinch = true;           // 윈치를 못 쓴다
    if (o.effect.doorWild) out.doorWild = true;         // 문이 제멋대로 여닫힌다
    if (o.effect.air) {
      // ★ **아직 안 막은 걸음의 방만** 진공이다 (v62)
      for (const s of o.steps.slice(o.step)) {
        // ══ ★★★ **막다른 길을 안 만든다** (v82) ═══════════════════════
        //  사장님 「우주복을 입어야한다고 방에 들어갈 수 없는데?
        //          **게임 진행이 안되**」 — 두 군데가 그랬다:
        //
        //    · **에어록** — 우주복 걸이가 거기 있다. 우주복을 가지러
        //      우주복이 필요하다
        //    · **통로** — 방 일곱을 잇는 유일한 길. 막히면 배가 통째로 잠긴다
        //
        //  ★ 표(`mission-table.js`)에서 그 갈래를 뺐지만 **여기서도 막는다.**
        //    표는 사람이 고치는 것이고, 언젠가 누가 다시 넣는다.
        //    「갇히면 그건 긴장이 아니라 사고다」는 **규칙이어야** 한다
        if (NO_VACUUM.includes(s.at)) continue;
        if (s.at && !out.vacuum.includes(s.at)) out.vacuum.push(s.at);
      }
    }
  }
  return out;
}

/**
 * 한 프레임.
 * @param calm 평온한가 (추격 중에는 새로 안 뜬다 — 겹치면 5개가 되고,
 *             5개면 사람은 포기한다. PLAN §11 「동시 1~2개」)
 * @returns 'spawn' | null  (뜬 고장은 f.open 의 마지막)
 */
export function stepFaults(f, dt, { calm, leg }) {
  f.t += dt;
  for (const o of f.open) o.age += dt;
  if (!calm) return null;

  f.next -= dt;
  if (f.next > 0 || f.open.length >= FAULT.maxOpen) return null;

  const made = spawn(f, leg, f.fixed === 0 && f.open.length === 0);
  const [lo, hi] = FAULT.every;
  const scale = Math.max(0.45, 1 + leg * FAULT.everyPerLeg);
  f.next = lerp(lo, hi, f.rnd()) * scale;
  if (!made) return null;
  f.open.push(made);
  return 'spawn';
}

/**
 * 그 자리에서 잡고 있다.
 * @returns 'step' | 'fixed' | null
 */
export function repairStep(fault, dt) {
  const s = fault.steps[fault.step];
  if (!s) return null;
  fault.held += dt;
  if (fault.held < s.hold) return null;

  fault.held = 0;
  fault.step++;
  // 「한 통으로는 모자란다」 — 마지막 걸음을 한 번 더 시킨다
  if (fault.again && fault.step >= fault.steps.length) {
    fault.again = false;
    fault.steps.push({ ...fault.steps[fault.steps.length - 1] });
  }
  return fault.step >= fault.steps.length ? 'fixed' : 'step';
}

/** 다 고쳤다 — 목록에서 빼고, 그 계통의 마모를 던다 */
export function clear(f, fault) {
  const i = f.open.indexOf(fault);
  if (i >= 0) f.open.splice(i, 1);
  f.fixed++;
  const sys = fault.sys;
  if (sys && f.wear[sys] != null) f.wear[sys] = Math.max(0, f.wear[sys] - WEAR.relief);
  // 기록 — 배너는 사라진다. **다시 볼 데가 있어야** 「무슨 증상이었지」가 안 남는다
  // ★ v62 — `key` 를 같이 남긴다. 「무엇을 고쳤나」를 이름으로만 찾으면
  //   장면(F)이 이름 문자열에 매이고, 이름은 바뀌기 쉽다
  f.log.unshift({ key: fault.key, name: fault.name, reveal: fault.reveal, at: +f.t.toFixed(0) });
  if (f.log.length > 6) f.log.pop();
}

/** 잡고 있던 것을 놓았다 — 조금 되돌아간다. 딱 멈추면 손을 뗄 이유가 없다 */
export function slip(fault, dt) {
  if (fault) fault.held = Math.max(0, fault.held - dt * 0.8);
}

/** 지금 열려 있는 것들 — 화면·검사가 읽는다 */
export function openList(f) {
  return f.open.map((o) => ({
    key: o.key, name: o.name, lead: o.lead, at: siteOf(o),
    step: o.step, steps: o.steps.length, age: +o.age.toFixed(1),
    progress: +(o.held / (o.steps[o.step]?.hold ?? 1)).toFixed(2),
  }));
}
