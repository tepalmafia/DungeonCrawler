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
  // ★ v135 — `evadeGain` 은 **안 부른다.** 부호를 버리던 그 함수다
  DODGE, evadeDir, ENGAGE, PARTS, partOf, FLEE, comesBack,
} from './target-table.js';
// ★★★ v98 — **자리를 아는 곳은 `frame.js` 하나다** (블록아웃).
//   여기는 「무엇이 어디에 떠 있나」를 들고 있을 뿐, **재는 일은 안 한다**
import { wrap, relOf } from './frame.js';
// ★★★ v142 — **가림.** 여기서 각을 다시 안 잰다 — 묻기만 한다 (`COVER.md §4`)
import { coverOf, isHidden, hideBehind, HIDE } from './cover-table.js';
// ══════════════════════════════════════════════════════════════════════════
//  ★★★ v135 — **회피가 누적에서 「한 번의 판정」이 됐다** (`dodge-table.js`).
//
//  ★ v111 의 `gainAt`·`hurtMult` 는 **접었다** (지우지 않는다 — 왜 접었는지가
//    `evade-table.js` 머리에 남아 있고, 되살릴 일이 있으면 거기서 시작한다).
//  ★★ 접은 까닭은 하나다: **그 모형에는 방향이 없었다.** `evadeGain` 이
//    `Math.abs` 로 부호를 버려서, 화면이 「좌현으로」라고 말한 다음 사람이
//    **오른쪽으로 밀어도 점수가 같았다** — 「재는 곳을 둘로 만들지 않는다」를
//    v84 부터 열두 판 어기고 있었다
// ══════════════════════════════════════════════════════════════════════════
import { wayFor, judge, DODGE2 } from './dodge-table.js';
// ★★★ v137 — **어스펙트와 적 기동** (`docs/space/FIGHT.md`)
import { aspectOf, aspectMult, partAt, multFor } from './aspect-table.js';
import { makeFoe, stepFoe } from './foe-table.js';

const span = ([a, b], rnd) => a + rnd() * (b - a);

/**
 * ★★★ **방위의 차이는 빼기가 아니다** (도).
 *
 *   v69 에 방위가 한 바퀴(±180)가 되면서, 179도와 −179도가 **2도 차이**인데
 *   그냥 빼면 358 이 된다. 조준·락온·레이더가 전부 이 값을 쓰므로, 안
 *   감으면 **기수 바로 뒤에서 조준이 통째로 죽는다** — 게다가 조용히
 *   죽는다(「저기 있는데 안 잡힌다」).
 *
 *   ★ v98 — 셈은 `frame.js wrap()` 으로 옮겼다. 이름은 남긴다: 부르는
 *     곳이 열 군데가 넘고, **이름을 바꾸는 것은 갈아 끼우는 것이 아니라
 *     흔드는 것**이다. 셈이 한 곳에 있으면 이름은 둘이어도 안 갈라진다
 */
export const azDiff = (a, b) => wrap(a - b);

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
    /**
     * ★★★ v137 — **기동과 어스펙트** (`foe-table.js`).
     *   v136 까지 적이 하는 일은 표류 두 줄이 전부였다 — 내가 뒤를 잡든
     *   마주보든 **똑같았다.** 그건 전투가 아니라 과녁 쏘기다
     */
    foe: makeFoe(),
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

/**
 * ★★★ **적 하나의 교전 한 걸음** (v84) — 접근 · 유지 · 이탈 · 재접근.
 *
 *   ★ `standoff` 가 없는 것은 예전 그대로다: **자폭정**(몸이 탄이라
 *     끝까지 들어온다)과 **호송선**(`closes` 가 음수라 멀어진다)
 */
function stepEngage(t, k, dt, rnd, list = []) {
  const so = k.standoff;
  // ══ ★★★ v86 — **엔진이 깨지면 못 움직인다** ═══════════════════════
  //  ★ 사장님 「엔진을 정확히 타격하거나 핵심 시설을 타격해야 그나마
  //    빨리 승리」. 그 값이 여기다 — 엔진을 깨면 **못 도망가고 못 온다.**
  //    그래서 「엔진부터 깰까」가 결심이 된다
  if (t.dead?.move) return;
  //  ★ v145 — EMP 를 맞은 동안은 **못 움직인다** (엔진이 죽은 것과 같다)
  if ((t.emp ?? 0) > 0) return;
  // ══ ★★★ v86 — **맞으면 도망간다** (사장님 「더 버티던지 도망가던지」) ══
  //  ★ 큰 것만. 자폭정은 몸이 탄이라 안 뺀다. 그리고 **엔진이 살아
  //    있어야** 뺀다 — 안 그러면 「깎아 놓으면 다 도망가서 못 잡는」
  //    게임이 된다. 여기가 부위와 도망을 잇는 자리다
  // ══ ★★★ v138 — **도망갔다 돌아온다** ═════════════════════════════════
  //  ★ 사장님 「적이 자꾸 **도망만 가는데 도망가다가 돌아와서 공격**하도록
  //    해. **도망만 가는건** 보급함이나 이런 함대들만」
  //  ★★★ v137 까지 맷집이 32% 아래면 **영영** 등을 보였다. 그러면 싸움이
  //    「깎다가 놓친다」로 끝나고, 무엇보다 **뒤를 잡는 재미(v137)가 벌이
  //    된다** — 뒤를 잡으면 도망가 버리니까
  if ((k.hits ?? 1) >= FLEE.big && t.hp / (k.hits ?? 1) <= FLEE.at) {
    if (!t.fleeing) { t.fleeing = true; t.fleeT = 0; t.runs = (t.runs ?? 0) + 1; }
    t.fleeT = (t.fleeT ?? 0) + dt;
    t.dist += Math.abs(k.closes ?? 6) * ENGAGE.breakMult * dt;
    // ══ ★★★ v142 — **숨을 곳이 있으면 그리로 뺀다** (`COVER.md §4`) ══
    //
    //  ★ 가림이 **나만 쓰는 것**이면 규칙이 아니라 편의다. 여기가 그 자리다 —
    //    맷집이 깎인 적이 표류선 뒤로 붙으면, v138 의 「도망갔다 돌아온다」가
    //    **갈 곳**을 갖는다. 그냥 멀어지는 것과 저기로 숨는 것은 다른 일이다.
    //  ★★ 그러면 사람이 할 일이 셋으로 는다: **돌아 들어가거나**(v137
    //    어스펙트) · **유도탄을 쓰거나**(§2) · **기다리거나**
    const hide = hideBehind(t, list);
    if (hide) {
      const step = HIDE.turn * dt;
      const dAz = wrap(hide.az - t.az);
      t.az = wrap(t.az + Math.max(-step, Math.min(step, dAz)));
      const dEl = (hide.el ?? 0) - (t.el ?? 0);
      t.el += Math.max(-step, Math.min(step, dEl));
    }
    // ★★ **숨을 고르고 되돌아선다.** 보급함 같은 것들은 안 돌아온다 —
    //   싣고 다니는 것들이라 **쫓아가 잡는 것이 상**이기 때문이다
    if (comesBack(t.kind) && t.fleeT >= FLEE.back && (t.runs ?? 1) <= FLEE.rounds) {
      t.fleeing = false; t.fleeT = 0;
      // ★ 숨을 고른 만큼 맷집이 조금 돌아온다 — 안 그러면 돌아오자마자
      //   또 문턱 아래라 **한 걸음 만에 다시 도망간다** (덜덜 떠는 적이 된다)
      t.hp = Math.min(k.hits ?? 1, t.hp + (k.hits ?? 1) * FLEE.heal);
      t.cameBack = true;
    }
    return;
  }
  if (!so) { t.dist -= k.closes * dt; return; }
  if (!t.eng) t.eng = { phase: 'in', held: 0, holdFor: span(ENGAGE.hold, rnd), way: rnd() < 0.5 ? -1 : 1 };
  const e = t.eng;
  if (e.phase === 'out') {
    // ★ 이탈 — **붙을 때보다 빠르게** 뺀다. 실제로도 이탈이 더 급하다
    t.dist += k.closes * ENGAGE.breakMult * dt;
    if (t.dist >= ENGAGE.breakTo) {
      e.phase = 'in'; e.held = 0;
      e.holdFor = span(ENGAGE.hold, rnd);
      e.az0 = undefined;
      // ★ 돌아올 때 **도는 쪽을 바꾼다** — 매번 같은 쪽이면 버릇이 된다
      e.way = rnd() < 0.5 ? -1 : 1;
    }
    return;
  }
  if (t.dist > so[1]) { t.dist -= k.closes * dt; e.held = 0; return; }
  // 너무 붙었으면 물러선다 (내가 밀고 들어가면 저쪽이 자리를 다시 잡는다)
  if (t.dist < so[0]) t.dist += k.closes * 0.7 * dt;
  // ══ ★★ 자리를 지키며 **좌우로 흔든다** ═══════════════════════════
  //  ★ 처음엔 한쪽으로 **돌게** 했다(초당 8도). 그러면 5초 만에 제
  //    사격 각(±38도) 밖으로 저절로 나가서 **아무것도 안 하는데 안
  //    맞는** 상태가 된다 — 「옆으로 빼면 안 맞는다」를 적이 대신 해
  //    주는 꼴이라 v84 의 회피가 통째로 헐거워진다.
  //  ★★ 실제 교전도 그렇다: 사격 위치에 든 기체는 **한 바퀴 돌지 않고**
  //    표적을 조준선에 물고 흔든다. 그래서 **되돌아오는 흔들림**이다 —
  //    탄이 오는 방위는 매번 다르되, 싸움에서 이탈하지는 않는다
  if (e.az0 === undefined) e.az0 = t.az;
  e.ph = (e.ph ?? 0) + ENGAGE.weaveRate * dt;
  t.az = e.az0 + Math.sin(e.ph) * ENGAGE.weave * e.way;
  e.held += dt;
  if (e.held >= e.holdFor) { e.phase = 'out'; e.held = 0; }
}

export function makeSky(rnd) {
  return {
    rnd, list: [], next: 0, killed: 0, shots: 0, region: 'empty',
    /** ★ 이번 회차에 부딪힌 횟수 — 끝 화면과 검사가 읽는다 (v64) */
    grazes: 0, rams: 0, noseAz: 0, noseEl: 0,
    /** ★★ v69 — 다음 적까지 남은 초. 0 이 되면 하나 온다 */
    nextRaider: span(TARGET.raiderEvery, rnd),
    /** ★★★ v70 — **날아오는 적탄.** 맞기 전에 피할 시간이 있다 */
    incoming: [],
    /** 이번 회차에 몇 대 맞았나 — 끝 화면과 검사가 읽는다 */
    tookHits: 0, dodged: 0,
    /** ★★★ v84 — **손으로 피한 것.** `dodged`(주사위가 빗나간 것)와 **다른 칸**이다 */
    evaded: 0,
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
export function setNose(sky, az, el = 0) { sky.noseAz = az; sky.noseEl = el; }

/**
 * @param close 다가오는 속도의 배수 — **급가속이 여기로 온다** (v81).
 *   1 이 평소다. 이 값이 없으면 R 을 눌러도 표적이 더 빨리 안 온다
 */
/**
 * @param evade 지금 **옆으로 밀고 있는 양** `{ x, y }` (조종간 편향 × 급기동
 *   배수 · az·el 축). v84 — 이것이 없으면 명중이 **주사위**다
 */
export function stepSky(sky, dt, {
  moving = true, quiet = false, close = 1, evade = null,
  /** ★ v115 — 「반사」 특성이 넓힌 회피 창 (`growth-table.js`) */
  evadeWide = 0,
  /**
   * ★★★ v135 — **이번 걸음에 「새로」 눌린 회피 키들** (`dodge-table.js WAYS`).
   *
   *   ★★ **누른 순간(edge)만** 온다. 눌러 「놓고 있는 것」을 매 걸음 세면
   *     A 를 처음부터 잡고 있는 것이 답이 되고, 그러면 타이밍이 없어진다 —
   *     v111 이 굴리기를 창 안에서만 센 것과 같은 까닭이고, 이번에는
   *     아예 **한 번의 결심**으로 만든다
   */
  dodgeKeys = null,
  /** 급기동 중인가 — 창이 넓어진다 (v84 의 급기동을 안 죽인다) */
  agile = false,
} = {}) {
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
    // ══ ★★★ v137 — **적이 기동한다** (`foe-table.js`) ═══════════════════
    //  ★ 뒤를 물고 있으면 브레이크, 못 떼면 되꺾기, 죽을 판이면 이탈.
    //    **꺾는 동안은 느려진다** — 안 그러면 계속 꺾는 것이 답이 되어
    //    영영 못 잡는다 (EVE 의 각속도를 값 하나로 접었다)
    //  ★★ `locked` 는 **내가 이 적의 뒤를 물고 있나**다. 「조준선에
    //    들어와 있나」가 아니라 **어스펙트가 후미인가**로 본다 —
    //    앞에서 겨누는 것은 무는 것이 아니다
    {
      const rear = aspectOf(t.foe?.aspect ?? 180) === 'rear';
      const near = t.dist <= (ENGAGE?.lock ?? 240);
      const fv = stepFoe(t.foe, dt, {
        locked: rear && near && !!t.aimedByMe,
        hp01: t.hp / Math.max(1, KINDS[t.kind]?.hits ?? 1),
        dead: !!t.dead,
      });
      // ★ 기동이 어스펙트를 바꾼다 — 화면·판정·검사가 **같은 값**을 본다
      t.aspect = fv.aspect;
      t.moveNow = fv.move;
      t.slowNow = fv.slow;
      t.missNow = fv.miss;
      if (fv.tell) t.tell = fv.tell;
      // ★★ **꺾으면 느려진다.** 표류에 곱한다 — 새 축을 안 만든다
      t.az += t.vaz * dt * fv.slow;
      t.el += t.vel * dt * fv.slow;
    }
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
    // ══ ★★★ v84 — **다가와서 박지 않는다** (`ENGAGE`) ═══════════════
    //  ★ v83 까지 `t.dist -= k.closes * dt` 한 줄이었다 — 즉 **다섯 중
    //    넷이 선체에 닿을 때까지 곧장 들어왔다.** 「지금 붙을까 뺄까」를
    //    물으려면 저쪽도 거리를 골라야 한다
    if (k?.closes) stepEngage(t, k, dt, sky.rnd, sky.list);
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
    // ★★ v86 — **무기를 깨면 안 쏜다.** 부위를 노리는 값의 절반이 여기다
    if (t.dead?.shoot) { t.aim = 0; continue; }
    //  ★★★ v145 — **EMP 를 맞으면 못 쏜다** (`skill-table.js emp`).
    //    ★ 겨눔(`aim`)까지 지운다 — 「멈췄다」는 뜻이므로 풀린 뒤 다시
    //      세어야 한다. 안 지우면 4초 뒤에 **모아 둔 것이 한꺼번에** 나간다
    if ((t.emp ?? 0) > 0) { t.aim = 0; continue; }
    // 우리를 겨누고 있나 — 적은 기수를 우리 쪽으로 돌려야 쏜다
    const onUs = Math.abs(azDiff(t.az, sky.noseAz ?? 0)) <= ENEMY_FIRE.aimCone;
    if (!onUs) { t.aim = 0; continue; }
    // ══ ★★★ v142 — **가려져 있으면 저쪽도 못 쏜다** (`cover-table.js`) ══
    //
    //  ★ 가림이 **나만 쓰는 것**이면 그건 규칙이 아니라 편의다. 내가 표류선
    //    뒤의 적을 못 쏘는 동안 저쪽은 나를 쏜다면, 숨은 적은 그냥 **공짜로
    //    이기는** 자리가 된다.
    //  ★★ 그래서 같은 자로 잰다 — `coverOf` 에게 **묻기만** 한다.
    //    겨눔(`t.aim`)은 안 지운다: 가림막을 지나 다시 나오는 순간 첫 발이
    //    나가야 「엄폐물 뒤에서 나오며 쏜다」가 된다
    if (isHidden(coverOf(t, sky.list))) continue;
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
      /** ★★★ v84 — **여태 옆으로 뺀 양.** ※ v135 에 접혔다 (아래 `way` 를 본다) */
      dodge: 0,
      /**
       * ★★★ v135 — **어느 쪽으로 빼라고 했나.** 쏘는 순간에 굳힌다.
       *
       *   ★★ **굳히는 것이 핵심이다.** 매 걸음 다시 재면 기수를 돌리는
       *     동안 지시가 뒤집히고, **뒤집히는 지시는 못 따른다.**
       *     사장님이 「**특정** 방향으로 틀라는 네비게이션」이라고 하신 것이
       *     그 뜻이다 — 「특정」은 **안 바뀐다**는 말이다
       */
      way: wayFor(
        wrap((t.az ?? 0) - (sky.noseAz ?? 0)),
        (t.el ?? 0) - (sky.noseEl ?? 0),
      ),
      /** 판정 — 첫 결심 한 번만 들어간다 (`null` 이면 아직 안 눌렀다) */
      band: null,
      hurt: null,
      /** 이 탄이 맞을 것인가 — **주사위는 쏘는 순간 이미 던져졌다.**
       *  ★ 화면이 이걸 읽어서 **맞을 것에만** 경고와 화살표를 낸다.
       *    빗나갈 탄에까지 경고하면 그건 거짓말이고, 한 번 거짓말한
       *    계기는 그 뒤로 안 믿는다 (이 배의 오랜 규약) */
      willHit: sky.rnd() <= enemyHitChance(t.dist),
    });
  }
  // 날아오는 것들이 닿는다
  for (let i = sky.incoming.length - 1; i >= 0; i--) {
    const s = sky.incoming[i];
    s.t -= dt;
    // ══ ★★★ v84 — **옆으로 뺀 만큼 쌓인다** ═══════════════════════════
    //  ★ 정면으로 파고들거나 뒤로 물러나는 것은 회피가 아니다 (빔 기동).
    //    `evade` 는 이미 급기동 배수가 곱해져서 온다 (`main.js`)
    // ══ ★★★ v135 — **한 번의 결심** ═══════════════════════════════════
    //  ★ 사장님 「**그거대로 누르면 완벽 회피** … **늦거나 못 누르면
    //    피해도가 커지도록**」
    //
    //  ★★★ **첫 누름 하나만 센다.** 두 번째부터 안 세는 까닭:
    //    ① 안 그러면 **연타가 답**이 되어 「특정 타이밍」이 없어진다
    //    ② 그리고 지시가 「특정 방향」이므로, 여러 번 눌러 맞히는 것은
    //       지시를 따른 것이 아니라 **훑은** 것이다
    //  ★ 이르게 누른 것도 **결심으로 친다** — 실기에서 일찍 꺾으면 유도가
    //    다시 문다. 「일단 눌러 놓고 본다」가 공짜면 타이밍이 다시 없어진다
    if (s.willHit && s.band === null && dodgeKeys?.length) {
      //  ★★★ v153 — **얼마나 빨리 가고 있나를 같이 넘긴다.** 회피는 방향을
      //    바꾸는 일이 아니라 **자리를 옮기는 일**이라 속도가 없으면 못 뺀다
      //    (사장님 「그대로 서 있는 자세에서 뒤집는거면 문제가 있는거 아냐?」).
      //  ★★ `close` 는 창밖 속도에서 나온 그 배수다 (v152 `speed-table.js closeK`) —
      //    **여기서 새로 안 잰다.** 새로 재면 그게 곧 v152 의 되풀이다
      const r = judge(s.way, dodgeKeys, s.t, { agile, wide: evadeWide, speed: moving ? close : 0 });
      if (r.band !== 'none') {
        s.band = r.band;
        // ★ 이른 것은 「너무 일렀다」로 굳고, 벌은 반대로 꺾은 것과 같다 —
        //   둘 다 **지시를 안 따른 것**이라 값이 같아야 앞뒤가 맞는다
        s.hurt = r.band === 'early' ? DODGE2.hurt.wrong : r.hurt;
      }
    }
    if (s.t > 0) continue;
    sky.incoming.splice(i, 1);
    // ★★ **쏜 놈이 이미 부서졌으면 그 탄도 없던 일이다.** 안 그러면
    //   격추한 다음 순간에 죽은 적한테 맞는 일이 나고, 그건 말이 안 된다
    if (!sky.list.some((x) => x.id === s.from)) continue;
    // ══ ★★★ v84 — **주사위 더하기 손** ═══════════════════════════════
    //  ★ 「빗나갔다」와 「피했다」를 **이름부터 가른다.** v83 까지 둘이
    //    같은 칸(`dodged`)이었고, 그래서 「피할 시간을 줬다」는 말이
    //    실제로는 「주사위를 늦게 굴렸다」였다
    //  ★★★ v135 — **완벽하게 맞췄으면 빗나간다.** v134 까지는 쌓은 양이
    //    `DODGE.need` 를 넘느냐였고, 그 양은 **급기동(추진제) 없이는
    //    원천적으로 못 채웠다.** 사장님 「그거대로 누르면 완벽 회피」로
    //    그 저울이 뒤집혔다 (`docs/space/DODGE.md §9`)
    if (s.band === 'perfect') { sky.evaded++; hits.push({ miss: true, evaded: true }); continue; }
    if (s.roll > s.pk) { sky.dodged++; hits.push({ miss: true }); continue; }
    sky.tookHits++;
    // ★★★ v137 — **어디를 맞았나는 어스펙트가 같이 정한다.**
    //   v136 까지 `pickHit` 은 씨앗만 봤다 — 그래서 `PARTS` 주석이 v70 부터
    //   약속한 「뒤를 잡으면 엔진이 나온다」가 **한 번도 성립한 적이 없다**
    //  ══ ★★★ **적이 나를 때릴 때는 어스펙트를 안 쓴다** (v137) ═════════
    //   ① 처음에 **적의** 어스펙트를 썼다가 태웠다. `foe.aspect` 는
    //     「적 기수에서 나까지」의 각이라, 그걸 쓰면 **내가 뒤를 잡을수록
    //     내가 급소를 맞는다** — 뜻이 정반대다.
    //   ② 그래서 **내** 각으로 바꿨더니 이번엔 `space-combat.js` 가
    //     「안 부수면 **0.2분**에 죽는다」로 빨개졌다 (목표 1.5~5분).
    //     까닭은 `partAt` 의 무게가 **선체 말고도** 무기(×1.6)를 자주 내서,
    //     적 탄 하나하나가 옛 `pickHit` 보다 아파진 것이다.
    //   ★★★ 그래서 **받는 쪽은 옛 셈 그대로 둔다.** 어스펙트는 이번 판에
    //     **때리는 쪽**의 일이고, 받는 쪽까지 같이 바꾸면 v70~v136 이
    //     맞춰 둔 회차 저울이 통째로 흔들린다. 「새 계통을 얹으면서 옛
    //     계통을 깨뜨리는 것」이 이 저장소가 제일 자주 밟는 함정이다.
    //   ★ 받는 쪽 어스펙트는 `docs/space/FIGHT.md` 에 남겨 두고 **다음 판**
    //     에 저울을 같이 재면서 넣는다 (그때 `space-combat.js` 도 같이 본다)
    const where = pickHit(sky.rnd);
    hits.push({
      miss: false, where,
      // ══ ★★★ v135 — **늦거나 틀리거나 안 눌렀거나** ═══════════════════
      //   ★ 사장님 「늦거나 못 누르면 **피해도가 커지도록**」.
      //   ★★ 이름은 `soft` 그대로 둔다 (읽는 자리가 여럿이다) — 다만 뜻이
      //     **뒤집혔다**: v134 까지는 「1 보다 작아지는 경감」이었고, 이제는
      //     **1 보다 커질 수 있는 배수**다. 안 누르면 ×1.8 이다
      soft: +(s.hurt ?? DODGE2.hurt.none).toFixed(2),
      /** 화면이 왜 아팠는지 말할 수 있게 — 「늦었습니다」 · 「반대입니다」 */
      band: s.band ?? 'none',
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

/**
 * ★★★ **지금 나를 맞힐 탄** (v84) — 화면과 AI 가 같은 것을 읽는다.
 *
 *   ★ **맞을 것만** 돌려준다. 빗나갈 탄에까지 경고와 화살표를 내면 그건
 *     거짓말이고, 한 번 거짓말한 계기는 그 뒤로 안 믿는다.
 *   ★ 이미 다 뺀 것도 안 돌려준다 — 「피했다」가 화면에서 곧 사라져야
 *     「해냈다」가 된다
 *
 * @param sx/sy 지금 조종간 편향 — 화살표가 **시작한 방향을 안 뒤집게** 쓴다
 */
export function threatNow(sky, sx = 0, sy = 0) {
  let best = null;
  for (const s of sky.incoming) {
    // ★★★ v135 — 이미 **결심이 끝난** 탄은 안 돌려준다. 완벽하게 피했으면
    //   화면에서 곧 사라져야 「해냈다」가 되고, 틀렸으면 더 시킬 것이 없다
    if (!s.willHit || s.band !== null) continue;
    if (!best || s.t < best.t) best = s;
  }
  if (!best) return null;
  const r = relOf(best, { yaw: sky.noseAz ?? 0, pitch: sky.noseEl ?? 0 });
  const relAz = r.az, relEl = r.el;
  return {
    id: best.id, t: +best.t.toFixed(2), relAz, relEl,
    /**
     * ★★★ v135 — **쏘는 순간에 굳은 지시**를 그대로 돌려준다.
     *   ★ 여기서 다시 재면 기수를 돌리는 동안 지시가 뒤집히고, **뒤집히는
     *     지시는 못 따른다.** 사장님이 「**특정** 방향」이라고 하신 뜻이 그것이다.
     *   ★★ 그리고 이것이 「재는 곳을 둘로 만들지 않는다」의 자리다 —
     *     화면·판정·검사가 **같은 `way`** 를 본다
     */
    way: best.way,
    band: best.band,
    /** 옛 화살표를 쓰는 자리가 있어 남긴다 — **뜻은 `way` 가 갖는다** */
    dir: evadeDir(relAz, relEl, sx, sy),
  };
}

/**
 * ★★ **곧 쏜다** (v84) — 겨눔이 `DODGE.warnAt` 을 넘긴 적.
 *   ★ 쏘고 나서 알리면 늦다. 적은 `ENEMY_FIRE.every` 초 동안 겨누고
 *     나서 쏘므로, 그 끝자락에 한 번 말해 주면 **0.9초 앞선다**
 */
export function aimingSoon(sky) {
  for (const t of sky.list) {
    if (!KINDS[t.kind]?.shoots) continue;
    if ((t.aim ?? 0) < DODGE.warnAt) continue;
    if (t.dist > ENEMY_FIRE.range) continue;
    return { id: t.id, kind: t.kind, relAz: azDiff(t.az, sky.noseAz ?? 0), dist: t.dist };
  }
  return null;
}

/**
 * ★★ **내가 저쪽 뒤에 있나** 0~1 (v86).
 *
 *   ★ 표적은 늘 이쪽을 보게 그려진다(`targets.js lookAt`). 그래서 「뒤」를
 *     방향으로 잴 수가 없다 — 대신 **무엇을 하고 있나**로 잰다:
 *       · 이탈 중이거나 도망 중 → 꽁무니를 보인다 → **엔진이 나온다**
 *       · 사거리 밖에서 다가오는 중 → 기수를 들이민다 → **무기가 나온다**
 *   ★★ 그러면 「도망가는 놈을 쫓아가 쏘면 엔진이 깨진다」가 성립하고,
 *     그건 사장님이 말씀하신 「도망가던지」와 맞물린다
 */
export function behindOf(t) {
  // ══ ★★★ v137 — **이제 진짜 각으로 잰다** ═══════════════════════════════
  //  ★ 위 주석이 「방향으로 잴 수가 없다 — 대신 **무엇을 하고 있나**로
  //    잰다」고 적어 두고 있었다. 그건 v86 에 **어스펙트가 없어서** 쓴
  //    임시 방편이었고, v137 이 `foe-table.js` 로 진짜 각을 만들었다.
  //  ★★ 임시 방편은 **그럴듯했지만 갈라져 있었다**: 「도망 중이면 뒤」라
  //    했으므로 **도망 안 가는 적은 영영 뒤가 안 잡혔다.** 뒤로 돌아
  //    들어가도 정면과 같은 판정이었다 — 사장님이 「후미를 공격햇을때
  //    데미지」라고 하신 것이 정확히 이 자리다
  if (typeof t.aspect === 'number') {
    const z = aspectOf(t.aspect);
    return z === 'rear' ? 1 : (z === 'side' ? 0.4 : 0);
  }
  // ★ 아직 기동 상태가 없는 것(파편 따위)은 옛 셈을 그대로 쓴다
  const k = KINDS[t.kind];
  if (t.fleeing || t.eng?.phase === 'out') return 1;
  if (k?.standoff && t.dist > k.standoff[1]) return 0;
  return 0.4;
}

/**
 * ★★★ **맞았다 — 어느 부위인가** (v86).
 *
 * @returns { part, dmg, killed } — `dmg` 는 부위 배수가 곱해진 값
 */
export function hitPart(t, { off = 0, tol = 6, dmg = 1, rnd = Math.random, weapon = 'laser' } = {}) {
  const part = partOf(off, tol, behindOf(t), rnd);
  // ══ ★★★ v137 — **어느 쪽에서 때렸나가 피해를 정한다** ═════════════════
  //  ★ 후미 ×1.45 · 측면 ×1.15 · **정면 ×0.75**. 정면이 손해라야
  //    「뒤로 돌아 들어가는 30초」가 값을 갖는다 — 그게 이 판의 알맹이다.
  //  ★★ 무기마다 다르게 탄다 (`aspect-table.js WEAPON_ASPECT`):
  //    열추적탄은 후미에서 더 물고(열원이 분사구다), 유도탄은 각도를 덜 가린다
  const asp = typeof t.aspect === 'number' ? t.aspect : 90;
  const real = dmg * part.mult * multFor(weapon, asp);
  t.hp -= real;
  // ★ 부위가 깨지는 것은 **그 부위를 맞혔을 때만.** 선체를 아무리 때려도
  //   엔진이 안 죽는다 — 그래야 「어디를 겨눌까」가 남는다
  if (part.kills) {
    t.dead = t.dead ?? {};
    t.dead[part.kills] = true;
  }
  return { part, dmg: +real.toFixed(2), killed: t.hp <= 0 };
}

/**
 * 지금 겨눈 쪽에 **제일 가까운 것** — 조준경이 강조한다.
 *
 * ★★★ v98 — 재는 일은 **한 줄도 여기서 안 한다.** `relOf()` 가 준
 *   `az·el·off·behind` 를 읽기만 한다. 그러면 레이더·HUD·3D 가 쓰는 값과
 *   **같은 함수에서 나온 같은 값**이라, v93 의 「보이는 데는 저기인데
 *   잡히는 것은 여기」가 원리적으로 못 생긴다
 */
export function aimedAt(sky, az, el) {
  // ══ ★★★ v94 — **탄이 지나가는 길에 있는 것이 맞는다** ═══════════════
  //
  //  사장님 「적 비행선 말고도 **물체가 앞을 가로막고 있으면 미사일 궤적에
  //          있다면 격추해야지**」 · 「미사일이 발사되는 경로에 물체가
  //          있으면 **이 물체가 맞아야지**」
  //
  //  ★ 맞는 말이고, 여태 그게 아니었다. 여기는 **각도만** 보고 제일
  //    가운데 있는 하나를 골랐다 — 그래서 **코앞의 바위를 지나 뒤의 적을
  //    맞히는** 일이 났다. 탄은 직선으로 가므로 **먼저 만나는 것**이 맞는다.
  //
  //  ★★ 그래서 두 걸음으로 나눈다:
  //    ① 조준선의 **제 굵기 안**(`tolOf`)에 든 것을 다 모은다 — 그게
  //       「궤적에 있다」의 뜻이다
  //    ② 그중 **제일 가까운 것**이 맞는다
  //    ③ 아무것도 안 걸리면 예전처럼 제일 가운데 있는 것을 준다
  //       (조준 보조·광학이 그걸 읽으므로 없애면 안 된다)
  const eye = { yaw: az, pitch: el };
  let best = null, bestS = null;
  let onPath = null, onPathS = null;
  for (const t of sky.list) {
    // ★ 감기·벗어난 각·뒤인지 — **셋 다 여기서 안 센다** (`frame.js`)
    const r = relOf(t, eye);
    if (!bestS || r.off < bestS.off) { bestS = r; best = t; }
    // ★ 뒤에 있는 것은 길이 아니다 (90도 넘으면 탄이 그리로 안 간다)
    if (r.off <= tolOf(t) && !r.behind && (!onPathS || t.dist < onPath.dist)) {
      onPath = t; onPathS = r;
    }
  }
  if (onPath) {
    return { t: onPath, off: onPathS.off, relAz: onPathS.az, relEl: onPathS.el, onPath: true };
  }
  // ★★ v69 — `relAz`·`relEl` 을 같이 준다. 레이더 원뿔은 **기수 기준**인데
  //   v68 까지 `inCone(t.az, t.el)` 로 **세상 기준** 값을 넣고 있었다.
  //   그때는 기수가 ±62 를 못 벗어나 티가 안 났다 — 이제 한 바퀴를 돌므로
  //   안 고치면 「뒤를 보고 있는데 앞의 것이 원뿔 안이라고 나온다」
  return best ? { t: best, off: bestS.off, relAz: bestS.az, relEl: bestS.el } : null;
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
    // ★ v85 — **기수가 어디를 보나.** 검사가 「위아래 조준이 34도를 넘나」를
    //   물으려면 이 둘이 밖으로 나와야 한다
    noseAz: +(sky.noseAz ?? 0).toFixed(1), noseEl: +(sky.noseEl ?? 0).toFixed(1),
    raiders: sky.list.filter((t) => (KINDS[t.kind]?.weight ?? 0) === 0).length,
    cameRaiders: sky.cameRaiders,
    nextRaider: +sky.nextRaider.toFixed(1),
    // ★★ v70 — **날아오는 적탄.** 화면이 이걸 그리고, 검사가 「피할 시간이
    //   있나」를 여기서 묻는다
    incoming: sky.incoming.map((s) => ({
      id: s.id, az: +s.az.toFixed(1), el: +s.el.toFixed(1),
      dist: +s.dist.toFixed(0), t: +s.t.toFixed(2),
      // ★★★ v84 — **맞을 것인가 · 얼마나 뺐나.** 화면이 이 둘을 읽어
      //   「맞을 것에만」 경고와 화살표를 낸다
      willHit: !!s.willHit, dodge: +(s.dodge ?? 0).toFixed(2),
      need: DODGE.need,
      /** ★★★ v135 — **어느 쪽으로 빼라고 했나 · 결심이 어떻게 났나** */
      way: s.way ?? null, band: s.band, hurt: s.hurt,
    })),
    tookHits: sky.tookHits, dodged: sky.dodged, evaded: sky.evaded,
    list: sky.list.map((t) => ({
      id: t.id, kind: t.kind, az: +t.az.toFixed(1), el: +t.el.toFixed(1),
      dist: +t.dist.toFixed(0), hp: +t.hp.toFixed(1), inRange: inRange(t),
      // ★ v86 — 부위가 깨졌나 · 도망 중인가 (화면과 검사가 읽는다)
      dead: t.dead ? { ...t.dead } : null, fleeing: !!t.fleeing,
      // ★★★ v138 — 몇 번 도망쳤나 · 돌아왔나 (검사와 계기가 읽는다)
      runs: t.runs ?? 0, cameBack: !!t.cameBack,
      // ★★★ v137 — **어느 쪽을 보고 있나 · 무슨 기동 중인가.**
      //   화면·검사·판정이 **같은 값**을 본다 (「재는 곳을 둘로 안 만든다」)
      aspect: typeof t.aspect === 'number' ? +t.aspect.toFixed(1) : null,
      move: t.moveNow ?? null,
      vaz: +t.vaz.toFixed(2), vel: +t.vel.toFixed(2),
    })),
  };
}
