// ══════════════════════════════════════════════════════════════════════════
//  수리 네 동작 — **풀고 · 뽑고 · 꽂고 · 조인다.**
//
//  ★ 왜 (2026-08-05 · 사장님 「누르고 뽑고 당기고 다 가능하게. 물체에
//    맞게 손이 손가락이 움직이도록 해」 + docs/space/REALSHIP.md §6)
//
//    지금 수리는 **잡고 있으면 고쳐진다** 하나뿐이다. 5초든 8초든 손이
//    하는 일은 똑같고, 화면에는 아무 변화가 없다. 그래서 정비가
//    「기다리기」로 읽힌다 — 정비공의 일인데 정비하는 느낌이 없다.
//
//    실제 궤도 정비는 부품을 고치지 않는다. **모듈을 통째로 간다** —
//    ORU(궤도 교체 유닛)라고 부르고, 볼트를 풀고 · 빼고 · 새것을 넣고 ·
//    다시 조인다. 주력 공구가 권총형 전동 드라이버인 것도 그래서다.
//
//  ★ **총 시간은 안 바뀐다** — 이게 이 표에서 제일 조심한 곳
//    네 동작은 원래 있던 `hold` 초를 **나눠 가진다.** 늘리면 층·회차
//    길이가 통째로 밀리고, 그러면 `space-sim`·`space-fault`·`space-route`
//    가 전부 어긋난다. 손맛을 넣자고 밸런스를 흔들지 않는다.
//    (`share` 를 다 더하면 1 이어야 하고, 검사가 그걸 본다)
//
//  ★ 손가락 모양이 **넷 다 달라야** 뜻이 있다
//    네 동작에 같은 주먹을 쥐면 그건 그냥 네 번 기다리는 것이다.
//    `pose` 가 손가락 넷과 엄지를 따로 접고, 손목을 돌린다.
//
//  ★ three.js 를 안 쓴다 — tools/space-repair.js 가 브라우저 없이 읽는다.
// ══════════════════════════════════════════════════════════════════════════

/**
 * 네 동작.
 *
 * `pose` 는 손 모양이다:
 *   `fingers` 손가락 넷을 얼마나 접나 0~1 (검지부터 새끼까지)
 *   `thumb`   엄지를 얼마나 접나 0~1
 *   `roll`    손목을 얼마나 돌리나 (라디안 · 한 동작 동안 이만큼 돈다)
 *   `push`    앞뒤로 얼마나 움직이나 (m · 음수가 앞으로)
 */
export const ACTS = [
  {
    key: 'unbolt',
    what: '볼트를 푼다',
    share: 0.34,
    // 드라이버를 쥐고 **돌린다.** 손가락은 다 감고 엄지로 눌러 잡는다
    pose: { fingers: [0.9, 0.95, 0.9, 0.85], thumb: 0.7, roll: -6.2, push: 0 },
  },
  {
    key: 'pull',
    what: '모듈을 뽑는다',
    share: 0.22,
    // **당긴다.** 손가락을 갈고리로 걸고 몸쪽으로 온다. 엄지는 안 쓴다
    pose: { fingers: [0.75, 0.8, 0.8, 0.75], thumb: 0.15, roll: 0, push: 0.09 },
  },
  {
    key: 'seat',
    what: '새것을 꽂는다',
    share: 0.22,
    // **민다.** 손바닥을 펴고 밀어 넣는다 — 네 동작 중 유일하게 편 손이다
    pose: { fingers: [0.1, 0.1, 0.12, 0.15], thumb: 0.05, roll: 0, push: -0.11 },
  },
  {
    key: 'tighten',
    what: '다시 조인다',
    share: 0.22,
    // 다시 **돌린다.** 그런데 반대로, 그리고 짧게 — 풀 때와 눈에 달라야 한다
    pose: { fingers: [0.95, 1.0, 0.95, 0.9], thumb: 0.85, roll: 3.4, push: -0.02 },
  },
];

export const ACT_KEYS = ACTS.map((a) => a.key);

/**
 * 이 걸음을 `held` 초 잡았을 때 **몇 번째 동작 중인가.**
 *
 * @param held 지금까지 잡은 시간(초)
 * @param hold 이 걸음이 요구하는 전체 시간(초)
 * @returns { i, act, k }  k 는 그 동작 안에서의 진행 0~1
 */
export function actAt(held, hold) {
  if (!(hold > 0)) return { i: 0, act: ACTS[0], k: 0 };
  const p = Math.max(0, Math.min(0.999999, held / hold));
  let acc = 0;
  for (let i = 0; i < ACTS.length; i++) {
    const w = ACTS[i].share;
    if (p < acc + w) return { i, act: ACTS[i], k: (p - acc) / w };
    acc += w;
  }
  return { i: ACTS.length - 1, act: ACTS[ACTS.length - 1], k: 1 };
}

/**
 * 그 순간의 손 모양 — **동작 사이를 이어 준다.**
 * 딱딱 끊기면 손이 순간이동하는 것으로 보인다.
 */
export function poseAt(held, hold) {
  const { act, k } = actAt(held, hold);
  const p = act.pose;
  // 동작이 시작할 때 살짝 풀렸다가 잡히도록 — 「다시 쥐는」 것이 보인다
  const ease = Math.min(1, k * 4);
  return {
    fingers: p.fingers.map((v) => v * ease),
    thumb: p.thumb * ease,
    // 돌리는 동작은 **진행에 따라 계속 돈다**. 멈춰 있으면 안 도는 것이다
    roll: p.roll * k,
    push: p.push * ease,
    key: act.key,
    what: act.what,
  };
}
