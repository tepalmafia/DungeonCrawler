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
import { FAULT, wired, branchWeights } from './mission-table.js';

const lerp = (a, b, t) => a + (b - a) * t;

export function makeFaults(seed = 'FAULT1') {
  return {
    rnd: makeRng(`${seed}-fault`),
    open: [],            // 지금 열려 있는 고장들
    next: FAULT.firstAfter,
    t: 0,
    fixed: 0,            // 몇 개나 고쳤나
  };
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
  const m = cand[0] === list[0] && first ? cand[0] : cand[Math.floor(f.rnd() * cand.length)];

  const branch = pick(f.rnd, branchWeights(m, leg));
  // 자리 — 갈래가 정하거나(원인 모를 열), 표에 적힌 순서대로(냉매·배전)
  const at = branch.at ? (Array.isArray(branch.at) ? branch.at : [branch.at]) : null;
  const steps = at
    ? at.map((room) => ({ at: room, hold: m.hold ?? 7, what: null }))
    : (m.steps || []).map((s) => ({ ...s }));
  if (!steps.length) return null;

  return {
    key: m.key, name: m.name, lead: m.lead, effect: m.effect || {},
    branch: branch.key, reveal: branch.what,
    // 「한 통으로는 모자란다」 — 마지막 걸음을 한 번 더 한다
    again: !!branch.again,
    steps, step: 0, held: 0,
    // 「그 회로는 이 구간 내내 못 쓴다」 — 고쳐도 이번 구간엔 안 돌아온다
    stuck: branch.key === 'dead',
    age: 0,
  };
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
export function effectsOf(f) {
  const out = { heat: 0, coolValve: 0, flaky: false };
  for (const o of f.open) {
    if (o.effect.heat) out.heat += o.effect.heat;
    if (o.effect.coolValve) out.coolValve += o.effect.coolValve;
    if (o.effect.flaky) out.flaky = true;
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

/** 다 고쳤다 — 목록에서 뺀다 */
export function clear(f, fault) {
  const i = f.open.indexOf(fault);
  if (i >= 0) f.open.splice(i, 1);
  f.fixed++;
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
