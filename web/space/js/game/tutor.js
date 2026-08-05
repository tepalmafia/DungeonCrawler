// ══════════════════════════════════════════════════════════════════════════
//  가르침 — **three.js 를 안 쓴다.**
//
//  뜬다 → (안 하면 세진다) → **하면** 사라진다.
//
//  ★ 시간으로 안 사라진다
//    「안 읽는다」에 대한 유일하게 정직한 대책이다. 몇 초 뒤에 없어지면
//    못 읽고 넘어갈 수 있고, 그러면 안내판과 똑같아진다.
//
//  ★ 순서가 **구조로** 보장된다
//    앞의 것을 다 떼기 전에는 다음 것의 `arm` 을 아예 안 본다. 그래서
//    「둘이 동시에 뜬다」가 코드로 불가능하다 — 검사로 막는 게 아니다.
// ══════════════════════════════════════════════════════════════════════════
import { TUTOR, LESSONS, aimKind, GRIPS, GRIP_SHOW, ARMS_FULL } from './tutor-table.js';

export function makeTutor() {
  return {
    i: 0,          // 지금 몇 번째를 가르치는 중인가
    open: false,   // 지금 떠 있나
    t: 0,          // 뜬 뒤 흐른 초 — 세지는 데 쓴다
    rest: 0,       // 다음 것이 뜰 때까지 쉬는 초
    wait: 0,       // 조건을 기다린 초 — 영영 안 오는 조건을 위한 것
    armed: false,  // 뜰 조건이 **한 번이라도** 참이었나 (아래 걸쇠)
    age: 0,        // 켠 뒤 흐른 초 — 빗장의 나이
    done: [],      // 뗀 것들의 열쇠
    shown: 0,      // 몇 개를 보여 줬나 — 「다시 안 뜨나」를 재려고
    // 손잡이별로 손 쓰는 법을 몇 번 봤나. **일곱과 따로 산다** (gripLine)
    grips: {},
  };
}

/** 다 뗐나 — 다 떼면 빗장이 풀리고 아무것도 안 뜬다 */
export const allDone = (t) => t.i >= LESSONS.length;

/**
 * 지금 무엇이 **막혀 있나**.
 * 앞의 것을 안 배웠으면 그 사건이 안 온다 (TUTORIAL §2-2).
 * 다 떼면 빈 것이 나오고, 그때부터는 표대로 온다.
 */
export function holds(t) {
  const out = new Set();
  // ★ **빗장에도 끝이 있다** (tutor-table.js holdMax).
  //   빗장은 「아직 안 배운 사람을 지켜 주는 것」이지 「배울 때까지 게임을
  //   멈추는 것」이 아니다. v21 에는 끝이 없어서 **가르침 하나가 막히자
  //   게임의 절반이 통째로 안 왔다.** 첫 구간이 곧 튜토리얼이므로
  //   빗장도 첫 구간까지다 — 그 뒤에는 배웠든 말든 표대로 온다.
  if (allDone(t) || t.age >= TUTOR.holdMax) return out;
  // 아직 안 뗀 것들이 걸어 둔 빗장을 전부 모은다
  for (let k = t.i; k < LESSONS.length; k++) {
    if (LESSONS[k].holds) out.add(LESSONS[k].holds);
  }
  return out;
}

/** 그 사건이 지금 와도 되나 — main.js 가 이걸 보고 참는다 */
export const canFire = (t, what) => !holds(t).has(what);

/**
 * 한 프레임.
 * @param s 게임이 지금 어떤가 (걸은 거리 · 열 · 고장 수 …)
 * @param aim 조준선이 잡고 있는 것 (`panel:workshop` 같은 것)
 * @returns 'show' | 'clear' | null
 */
export function stepTutor(t, dt, s = {}, aim = null) {
  t.age += dt;
  if (allDone(t)) return null;

  if (t.open) {
    t.t += dt;
    // ★ **하면** 사라진다. 읽어서가 아니다.
    //   다만 **최소 표시 시간**은 지킨다 — 첫 줄이 2~4초 만에 사라져서
    //   읽기도 전에 없어졌다는 보고를 받았다 (v21). 「하면 사라진다」가
    //   「깜빡이고 만다」가 되면 안내가 아니라 잔상이다
    if (t.t >= TUTOR.minShow && LESSONS[t.i].done(s)) {
      finish(t, LESSONS[t.i].key);
      return 'clear';
    }
    return null;
  }

  // ★★ **이미 한 것은 조용히 건너뛴다** — v21 의 교착을 푼 한 수.
  //
  //   전에는 뜬 것(`t.open`)만 `done` 을 봤다. 그래서 **말해 주기 전에 먼저
  //   해 버리면 영영 못 넘어갔다.** 그리고 하필 게임의 첫 화면이
  //   「거점 · 항로를 고르십시오」라, **게임이 시키는 첫 행동이 자기
  //   튜토리얼을 부수고 있었다.** 고르는 순간 atPort 가 거짓이 되고,
  //   route 의 arm 이 다시는 참이 안 되어 나머지 여섯이 영영 안 떴다.
  //
  //   조건을 하나씩 단조롭게 고치는 길도 있었지만 그러면 여덟째를 넣을 때
  //   또 틀린다. **「이미 한 사람에게는 안 가르친다」가 그 자체로 옳다.**
  //   건너뛴 것도 빗장을 푼다 — `holds` 는 `t.i` 만 보기 때문이다.
  let skipped = false;
  while (!allDone(t) && LESSONS[t.i].done(s)) { finish(t, LESSONS[t.i].key, true); skipped = true; }
  if (allDone(t)) return skipped ? 'clear' : null;

  const L = LESSONS[t.i];
  // ★ **뜰 조건은 걸쇠다.** 한 번 참이면 계속 참으로 둔다.
  //   「그 순간에만 참인 조건」이 있다 — 거점에 서 있다 · 고장이 열려 있다 ·
  //   식량이 모자란다. 20초 쉬는 사이에 그 순간이 지나가면 옛 코드는
  //   그 가르침을 안 띄웠다. 걸쇠로 두면 **지나간 순간도 남는다.**
  //   쉬는 동안에도 본다 — 그래야 쉬는 사이에 지나간 것을 안 놓친다
  if (!t.armed && L.arm(s)) t.armed = true;

  // 쉬는 중 — 몰아치면 둘 다 안 읽는다
  if (t.rest > 0) { t.rest -= dt; return null; }
  // ★ 앞의 것을 다 뗀 뒤에만 여기 온다. 그래서 순서가 저절로 지켜진다
  t.wait += dt;
  // 조건이 안 와도 너무 오래 기다렸으면 그냥 뜬다 — **영영 안 오는 조건**이
  // 있다 (추진을 안 켜면 열이 안 오른다). 그 조건에 빗장이 걸려 있으면
  // 게임의 절반이 안 온다. `wait` 가 없는 것은 안 뜬다 — 거짓말이 되니까
  if (!t.armed && !(L.wait && t.wait >= L.wait)) return null;
  t.open = true;
  t.t = 0;
  t.wait = 0;
  t.armed = false;
  t.shown++;
  return 'show';
}

/** 하나를 뗀다. @param quiet 안 뜬 채로 넘어간 것인가 (먼저 해 버린 경우) */
function finish(t, key, quiet = false) {
  t.done.push(quiet ? `${key}(먼저함)` : key);
  t.i++;
  t.open = false;
  t.t = 0;
  t.wait = 0;
  t.armed = false;
  // 먼저 해 버린 것은 **쉬지 않는다.** 안 뜬 것을 쉬면 다음 줄만 늦어진다
  t.rest = quiet ? 0 : TUTOR.gap;
}

/**
 * 지금 화면에 뭐라고 쓰나 — **세 단계** (TUTORIAL §3-B).
 *   처음 → 무엇을 하나만
 *   25초 → 어느 방인지 붙는다
 *   조준선이 그 물건에 닿으면 → 손 쓰는 법
 * @returns { text, dim } 또는 null
 */
export function lineOf(t, aim = null) {
  if (!t.open || allDone(t)) return null;
  const L = LESSONS[t.i];
  // ★ 물건 앞에 서 있는 **그 순간**에 조작법이 나온다. 이게 제일 중요한
  //   단계다 — 읽을 이유가 생기는 유일한 자리라서 그렇다
  if (L.at && L.hands && aimKind(aim) === L.at) return { text: L.hands, dim: false };
  const text = t.t >= TUTOR.showWhere ? L.where : L.line;
  return { text, dim: t.t >= TUTOR.fade };
}

/**
 * **손 쓰는 법** — 가르침과 따로 산다 (tutor-table.js GRIPS).
 *
 * ★ 일곱 가르침은 끝이 있지만 **동사는 계속 는다.** 「떼었다 붙인다」와
 *   「수리 네 동작」이 v31~v32 에 들어왔는데 아무도 안 가르쳤다.
 *   여덟째 가르침을 만들면 또 설명서가 되므로, **겨누고 있는 그 순간에만**
 *   뜨는 한 줄로 따로 뺐다.
 *
 * ★ 순서도 빗장도 없다. 다만 **몇 번 보고 나면 그친다** — 늘 뜨면 안내판이다.
 *
 * @param st { armsFull } 두 손으로 뭘 안고 있나
 * @returns null | { text, dim }
 */
export function gripLine(t, aim, st = {}) {
  if (!aim) return null;
  // ★ **두 손이 찼을 때가 제일 급하다.** 조용히 안 잡히면 「고장났다」로
  //   읽히므로, 이 줄만은 셈을 안 보고 늘 띄운다
  if (st.armsFull && !String(aim).startsWith('spot:')) return { text: ARMS_FULL, dim: false };
  const k = aimKind(aim);
  const line = GRIPS[k];
  if (!line) return null;
  const seen = t.grips?.[k] ?? 0;
  if (seen >= GRIP_SHOW) return null;
  return { text: line, dim: false };
}

/**
 * 그 손잡이의 손 쓰는 법을 **한 번 봤다**고 센다.
 * ★ 뜬 프레임마다 세면 1초에 예순 번이라 즉시 그친다. **잡은 순간에만**
 *   센다 — main.js 가 그때 부른다
 */
export function markGrip(t, aim) {
  const k = aimKind(aim);
  if (!k || !GRIPS[k]) return;
  t.grips = t.grips ?? {};
  t.grips[k] = (t.grips[k] ?? 0) + 1;
}

/** 지금 가르치는 것의 열쇠 — 검사·표시용 */
export const nowKey = (t) => (t.open && !allDone(t) ? LESSONS[t.i].key : null);
