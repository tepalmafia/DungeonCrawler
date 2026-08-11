// ══════════════════════════════════════════════════════════════════════════
//  발사관 — **순수 규칙.** 숫자는 `mount-table.js` 에 있다 (v100).
//
//  ★ three.js 도 DOM 도 안 쓴다. `tools/space-mount.js` 가 브라우저 없이
//    통째로 돌려 본다 — **게임에 붙이기 전에** 맞는지 본다.
//
//  ★★ **자리를 재지 않는다.** 표적이 기수에서 몇 도인지는 `frame.js relOf`
//    가 이미 안다. 여기는 「발사관이 **거기까지 따라갔나**」만 본다 —
//    재는 곳을 둘로 만들면 v93 의 병이 다른 얼굴로 돌아온다
// ══════════════════════════════════════════════════════════════════════════
import { MOUNT } from './mount-table.js';

const wrap = (d) => ((d + 180) % 360 + 360) % 360 - 180;

export const makeMount = () => ({
  /** 지금 무엇을 따라가고 있나 (표적 id · 없으면 null) */
  id: null,
  /** 발사관이 지금 가리키는 곳 — **기수 기준** 도 */
  az: 0, el: 0,
  /** 흔들림 (도). 동체를 굴리면 오르고 놓으면 잦아든다 */
  wob: 0,
  /** 짐벌 끝에 닿아 있나 — 계기가 「한계」라고 적는다 */
  pinned: false,
  /** 끝에 붙어 있는 동안 새어 나간 양 (0~1). 1 이 되면 놓친다 */
  leak: 0,
});

/** 기수에서 벗어난 각 (도) — 발사관이 지금 어디를 보나 */
export const offOf = (m) => Math.hypot(m.az, m.el);

/**
 * 한 프레임.
 *
 * @param aim  표적이 **기수 기준** 어디인가 `{ az, el }` (`frame.js relOf`)
 *             — 없으면 null (놓친다)
 * @param id   그 표적의 id
 * @param spin 동체가 지금 초당 몇 도 도나 (요·피치·롤을 합친 크기)
 * @returns 'lost' | null — 놓친 순간만
 */
export function stepMount(m, dt, { aim = null, id = null, spin = 0 } = {}) {
  // ── 흔들림: 동체가 도는 만큼 오르고, 안 돌면 잦아든다 ──────────
  //  ★ **오르는 것은 즉시, 내리는 것은 천천히.** 반대로 두면 톡톡 끊어
  //    치는 것으로 벌을 피할 수 있고, 그러면 값이 없어진다
  //  ★ 순간이동은 안 센다 (`MOUNT.maxSpin`) — 사람이 못 내는 속도로
  //    계기가 폭발하면 그건 계기가 아니다 (브라우저에서 잡았다)
  const want = Math.min(spin, MOUNT.maxSpin) * MOUNT.wobble;
  m.wob = want > m.wob ? want : Math.max(want, m.wob - MOUNT.settle * dt);

  if (!aim || id === null) {
    m.id = null; m.pinned = false; m.leak = 0;
    return null;
  }
  // 표적이 바뀌면 처음부터 — 짐벌은 순간이동하지 않는다
  if (m.id !== id) { m.id = id; m.leak = 0; }

  // ── 따라간다 — **한 번에 못 붙는다** ────────────────────────
  const step = MOUNT.slew * dt;
  const dAz = wrap(aim.az - m.az);
  const dEl = (aim.el ?? 0) - m.el;
  m.az = wrap(m.az + Math.max(-step, Math.min(step, dAz)));
  m.el += Math.max(-step, Math.min(step, dEl));

  // ── 짐벌 한계 — **넘어가면 끝에 붙는다** ────────────────────
  //  ★ 여기가 사장님이 말씀하신 「**방향은 유지**」다: 못 따라가도
  //    발사관은 **그쪽을 보고 있다.** 놓는 것이 아니라 끝에 걸린다
  const off = offOf(m);
  if (off > MOUNT.cone) {
    const k = MOUNT.cone / off;
    m.az *= k; m.el *= k;
    m.pinned = true;
    // ★ 다만 **영영 버티지는 못한다.** 끝에 붙은 채로 계속 돌면 샌다
    m.leak = Math.min(1, m.leak + MOUNT.pinnedLeak * dt);
    if (m.leak >= 1) { m.id = null; m.pinned = false; m.leak = 0; return 'lost'; }
  } else {
    m.pinned = false;
    m.leak = Math.max(0, m.leak - MOUNT.pinnedLeak * dt);
  }
  return null;
}

/**
 * ★★★ **발사관이 표적에서 몇 도 벗어나 있나** (도) — 명중 판정이 쓴다.
 *
 *   따라가다 뒤처진 몫(`lag`)과 흔들리는 몫(`wob`)을 **합친다.**
 *   둘 다 「동체를 굴린 값」이고, 그래서 회피는 표적을 버리는 일이
 *   아니라 **정확도를 내주는 일**이 된다
 */
export function errOf(m, aim) {
  if (!aim) return Infinity;
  const lag = Math.hypot(wrap((aim.az ?? 0) - m.az), (aim.el ?? 0) - m.el);
  return lag + Math.max(0, m.wob);
}

/** 검사와 화면이 읽는다 */
export function summary(m, aim = null) {
  return {
    id: m.id,
    az: +m.az.toFixed(2), el: +m.el.toFixed(2),
    off: +offOf(m).toFixed(2),
    wob: +m.wob.toFixed(2),
    pinned: !!m.pinned,
    leak: +m.leak.toFixed(2),
    err: aim ? +errOf(m, aim).toFixed(2) : null,
  };
}
