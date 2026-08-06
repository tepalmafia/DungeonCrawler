// ══════════════════════════════════════════════════════════════════════════
//  행성 착륙 — **규칙.** 표는 land-table.js 가 갖는다.
//
//  ★ 여기가 굴리는 것은 **여섯 마디와 진입각 하나**뿐이다.
//    행성의 중력이나 궤도를 계산하지 않는다 — 물어야 할 것은
//    「어떻게 내려앉나」가 아니라 **「내리면 무엇을 얻고 무엇을 못 하나」**다.
//
//  ★ 무작위는 **밖에서 받는다** (`rnd`). 안에서 Math.random 을 부르면
//    tools/space-land.js 가 같은 착륙을 두 번 못 돌린다 — 갈래를 견주는
//    검사가 그 자리에서 못 쓰게 된다.
//
//  ★ three.js 를 안 쓴다.
// ══════════════════════════════════════════════════════════════════════════
import {
  STEP, LAND, WHY, whyNotLand, bandFor, pushFor,
} from './land-table.js';

export function makeLand() {
  return {
    step: STEP.NONE,
    /** 이 마디에 들어온 지 몇 초 */
    t: 0,
    /** ★ 진입각 오차 (-1~1). 0 이 정면 */
    tilt: 0,
    /** 대기가 미는 방향 (+1/-1) */
    dir: 1,
    /** 방향이 뒤집히기까지 남은 초 */
    flipIn: 0,
    /** 띠를 벗어나 있던 총 시간(초) — 「얼마나 탔나」 */
    burned: 0,
    /** 이번 착륙이 거친 대기인가 (구간 10) */
    hard: false,
    /** 지금 내릴 자리가 잡혀 있나 — 장면 B 가 켠다 */
    offered: false,
    /** 실은 것 — 이번 착륙에서 */
    got: { ore: 0, parts: 0, food: 0 },
    /** 부품 한 개까지 남은 초 */
    partsT: LAND.partsEvery,
    /** 몇 번 내렸나 — 끝 화면이 읽는다 */
    trips: 0,
    /** 왜 안 됐나 */
    blocked: null,
  };
}

/** 발견 — 장면 B 가 「내릴 자리」를 띄운다 */
export function offerPlanet(l, hard = false) {
  if (l.step !== STEP.NONE) return false;
  l.offered = true;
  l.hard = !!hard;
  l.step = STEP.FOUND;
  return true;
}

/** 지나쳤다 — 안 내리기로 했거나 장면이 끝났다 */
export function passPlanet(l) {
  if (l.step !== STEP.FOUND) return false;
  l.offered = false;
  l.step = STEP.NONE;
  return true;
}

/**
 * 내려간다 — 해도대에서 누른다.
 * @returns true 면 내려가기 시작했다. false 면 `l.blocked` 에 이유가 있다
 */
export function beginLand(l, { chase = false } = {}) {
  const why = whyNotLand({ step: l.step, chase, offered: l.offered });
  if (why) { l.blocked = why; return false; }
  l.blocked = null;
  l.step = STEP.APPROACH;
  l.t = 0;
  l.tilt = 0;
  l.burned = 0;
  l.dir = 1;
  l.flipIn = LAND.flip[0];
  l.got = { ore: 0, parts: 0, food: 0 };
  l.partsT = LAND.partsEvery;
  return true;
}

/**
 * 뜬다 — **바깥문을 닫고 나서**.
 * @returns true 면 분사가 시작됐다. false 면 `l.blocked`
 */
export function liftOff(l, { doorOpen = false } = {}) {
  if (l.step !== STEP.LANDED) { l.blocked = 'notDown'; return false; }
  // ★ 문을 열어 둔 채 뜨면 안 된다. v45 의 바깥문이 여기서 한 번 더 값을 한다 —
  //   땅에서는 열어 둬도 공기가 안 주니까 **닫을 이유가 이것 하나뿐**이고,
  //   그래서 잊는다. 잊으면 못 뜬다
  if (doorOpen) { l.blocked = 'door'; return false; }
  l.blocked = null;
  l.step = STEP.UP;
  l.t = 0;
  return true;
}

/**
 * 한 걸음.
 *
 * @param ctx.hand  조종간 값 (-1~1). 안 잡고 있으면 0
 * @param ctx.rnd   0~1 난수 함수 — 미는 방향이 뒤집히는 때를 정한다
 * @returns 마디가 바뀌면 그 이름 ('entry' · 'touch' · 'sky' …), 아니면 null
 */
export function stepLand(l, dt, { hand = 0, rnd = null } = {}) {
  if (l.step === STEP.NONE || l.step === STEP.FOUND) return null;
  l.t += dt;
  const r = rnd ?? (() => 0.5);

  if (l.step === STEP.APPROACH) {
    if (l.t >= LAND.approach) {
      l.step = STEP.ENTRY; l.t = 0;
      l.flipIn = LAND.flip[0] + r() * (LAND.flip[1] - LAND.flip[0]);
      return 'entry';
    }
    return null;
  }

  if (l.step === STEP.ENTRY) {
    // ★ 미는 방향이 몇 초마다 **뒤집힌다.** 이게 이 조작의 전부다 —
    //   계속 한쪽으로 밀고 있으면 뒤집힌 뒤에 반대로 넘어간다
    l.flipIn -= dt;
    if (l.flipIn <= 0) {
      l.dir = -l.dir;
      l.flipIn = LAND.flip[0] + r() * (LAND.flip[1] - LAND.flip[0]);
    }
    const push = pushFor(l.hard), band = bandFor(l.hard);
    l.tilt += (l.dir * push + Math.max(-1, Math.min(1, hand)) * LAND.hand) * dt;
    l.tilt = Math.max(-1.4, Math.min(1.4, l.tilt));
    if (Math.abs(l.tilt) > band) l.burned += dt;
    if (l.t >= LAND.entry) { l.step = STEP.DOWN; l.t = 0; return 'down'; }
    return null;
  }

  if (l.step === STEP.DOWN) {
    // 내려가는 동안 각은 저절로 펴진다 — 대기가 두꺼워지면 배가 바로 선다
    l.tilt += (0 - l.tilt) * Math.min(1, dt * 1.2);
    if (l.t >= LAND.down) {
      l.step = STEP.LANDED; l.t = 0; l.tilt = 0; l.trips++;
      return 'touch';
    }
    return null;
  }

  if (l.step === STEP.UP) {
    if (l.t >= LAND.burn + LAND.rise) {
      l.step = STEP.NONE; l.t = 0; l.offered = false;
      return 'sky';
    }
    if (l.t >= LAND.burn && l.t - dt < LAND.burn) return 'coast';
    return null;
  }
  return null;
}

/** 지금 이륙 분사 중인가 — 열이 오르고 **냉각이 안 먹는다** */
export const burning = (l) => l.step === STEP.UP && l.t < LAND.burn;

/** 땅에 있나 */
export const onGround = (l) => l.step === STEP.LANDED;

/** 하늘과 땅 사이 어디쯤인가 — 이 동안은 배를 못 몬다 */
export const moving = (l) =>
  l.step === STEP.APPROACH || l.step === STEP.ENTRY || l.step === STEP.DOWN || l.step === STEP.UP;

/** 착륙과 관련해 무언가 도는 중인가 — 저장·화면이 묻는다 */
export const busy = (l) => l.step !== STEP.NONE && l.step !== STEP.FOUND;

/** ★ 실을 수 있나 — **땅에 있고 바깥문이 열려 있어야 한다** */
export function canLoad(l, { doorOpen = false } = {}) {
  return onGround(l) && doorOpen;
}

/** 왜 못 싣나 */
export function loadWhy(l, { doorOpen = false } = {}) {
  if (!onGround(l)) return 'notDown';
  if (!doorOpen) return 'shut';
  return null;
}

/**
 * 싣는다 — 잡고 있는 동안. **얻은 것을 돌려준다.**
 * ★ 광석만 나는 우주 낚시와 달리 **부품과 식량이 같이 난다.**
 *   그게 「왜 내리나」의 답이고, 여기 말고 다른 데 적으면 갈라진다
 */
export function loadStep(l, dt) {
  const got = { ore: 0, parts: 0, food: 0 };
  if (!onGround(l)) return got;
  got.ore = LAND.oreSec * dt;
  got.food = LAND.foodSec * dt;
  l.partsT -= dt;
  while (l.partsT <= 0) { got.parts++; l.partsT += LAND.partsEvery; }
  l.got.ore += got.ore;
  l.got.food += got.food;
  l.got.parts += got.parts;
  return got;
}

/** 지금 자국에 얹히는 값 — 이륙 분사는 멀리서도 보인다 */
export const signOf = (l) => (burning(l) ? LAND.burnSign : 0);
/** 지금 초당 오르는 열 */
export const heatOf = (l) => (burning(l) ? LAND.burnHeat : 0);
/** 이 동안은 냉각이 안 먹는다 — 방열판을 접었으니까 */
export const noCool = (l) => burning(l);

/** 왜 안 됐나를 사람 말로 */
export const whyWord = (key) => WHY[key] ?? null;

export function summary(l) {
  return {
    step: l.step, t: +l.t.toFixed(2), tilt: +l.tilt.toFixed(3),
    burned: +l.burned.toFixed(2), hard: l.hard, offered: l.offered,
    trips: l.trips, blocked: l.blocked,
    got: {
      ore: +l.got.ore.toFixed(1), parts: l.got.parts, food: +l.got.food.toFixed(1),
    },
    onGround: onGround(l), burning: burning(l), busy: busy(l),
  };
}
