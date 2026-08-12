// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **자리를 아는 곳 하나** — 전투의 블록아웃 (v96)
//
//  ★ 사장님 「**거리측정, 타겟 락온, 레이더와 실제 우주에 보이는 물체와
//    일관성**」 · 「전투 관련 코딩 다 삭제하고 기획부터 다시」
//
//  ══ 왜 다시 짓나 — 지금까지 틀린 것이 다 같은 병이었다 ═══════════════
//
//  전투의 어긋남을 세 판(v91·v93·v95) 연달아 고쳤는데, 매번 **다른 파일**을
//  고쳤다. 재 보고서야 알았다 — 자리를 아는 곳이 **넷**이었다:
//
//      ① `target.js`      표: 각(az·el)과 거리. **배 중심** 기준
//      ② `world/targets.js` 3D 메시. 창밖 그룹의 원점 기준
//      ③ `world/gunsight.js` HUD 표식. 판 위의 화소
//      ④ `combat.js`      레이더. ①의 값을 기수와 견줌
//
//  넷이 각자 자기 방식으로 계산했고, **하나를 고치면 나머지 셋과 갈라졌다.**
//  8.5m 시차(v93) · 판을 굴려 글씨가 기움(v95) · 각도만 보고 쏨(v93) —
//  전부 「두 곳이 같은 것을 따로 안다」의 다른 얼굴이다.
//
//  ══ ★★★ 그래서 이 파일의 규칙은 하나다 ═══════════════════════════════
//
//      **눈에서 잰다. 그리고 여기서만 잰다.**
//
//    · 세상 자리(월드)는 **여기 들어올 때 한 번** 눈 기준으로 바뀐다
//    · 레이더·HUD·광학·3D 는 **전부 이 파일이 준 값**을 쓴다
//    · 어느 쪽도 제 방식으로 다시 계산하지 않는다
//
//  ★ 이것이 「블록아웃」이다 — 모양이 아니라 **뼈대**를 먼저 세운 것.
//    `tools/space-block.js` 가 이 뼈대만으로 셋(거리·락온·일관성)을
//    시뮬해서, 게임에 붙이기 **전에** 맞는지 본다.
//
//  ★ three.js 를 안 쓴다.
// ══════════════════════════════════════════════════════════════════════════

const DEG = Math.PI / 180;
const R2D = 180 / Math.PI;

/** 각을 −180~180 으로 감는다. **자르지 않는다** — 한 바퀴를 도는 배다 */
export const wrap = (d) => ((d + 180) % 360 + 360) % 360 - 180;

/**
 * ★★ **눈의 자세.** 배가 아니라 **눈**이다 — 조종석은 짐벌로 수평을
 *   지키므로 둘이 다르고, 그 차이가 v95 의 「글씨가 기운다」였다.
 *
 * @property yaw   기수 방위 (도)
 * @property pitch 기수 고도 (도)
 * @property roll  하늘이 기운 각 (도). **표식만 이만큼 돈다**
 */
export const makeEye = () => ({ yaw: 0, pitch: 0, roll: 0 });

/**
 * ★★★ 세상 자리 하나를 **눈 기준**으로 바꾼다.
 *
 *   ★ 여기가 이 파일의 심장이다. `x,y,z` 는 **눈에서 잰 미터**이고,
 *     `az/el/dist` 는 그것을 각으로 옮긴 것뿐이다 — 두 값이 **같은
 *     하나**에서 나오므로 영영 안 갈라진다.
 *
 * @param p   눈에서 잰 자리 { x, y, z } (−z 가 기수 앞)
 * @param eye 눈의 자세
 */
export function seen(p, eye) {
  // 기수를 원점으로 돌린다 — 요 → 피치 차례 (롤은 표식만 돈다)
  const cy = Math.cos(-eye.yaw * DEG), sy = Math.sin(-eye.yaw * DEG);
  const x1 = p.x * cy - p.z * sy;
  const z1 = p.x * sy + p.z * cy;
  const cp = Math.cos(-eye.pitch * DEG), sp = Math.sin(-eye.pitch * DEG);
  const y2 = p.y * cp - z1 * sp;
  const z2 = p.y * sp + z1 * cp;
  const dist = Math.hypot(x1, y2, z2);
  return {
    x: x1, y: y2, z: z2,
    dist,
    /** 기수에서 좌우로 몇 도 (오른쪽 +) */
    az: Math.atan2(x1, -z2) * R2D,
    /** 기수에서 위아래로 몇 도 (위 +) */
    el: Math.atan2(y2, Math.hypot(x1, z2)) * R2D,
    /** 기수에서 벗어난 각 — 조준·락온이 다 이 하나를 쓴다 */
    off: Math.acos(Math.max(-1, Math.min(1, -z2 / Math.max(1e-6, dist)))) * R2D,
    /** 뒤에 있나 */
    behind: z2 > 0,
  };
}

/**
 * ★★ **화면에 어디 찍히나** — 레이더도 HUD 도 3D 도 이 하나를 쓴다.
 *
 *   ★ 판은 **수평으로 둔다.** 표식만 롤만큼 돈다 (v95 에 판을 굴렸다가
 *     글씨까지 기울었다). 실제 HUD 도 수평의만 돈다.
 *
 * @param s    `seen()` 이 준 것
 * @param fovH 화면이 덮는 가로 각 (도)
 * @param fovV 세로 각
 * @param eye  눈의 자세 (롤을 쓴다)
 * @returns { u, v } −1~1. 화면 밖이면 |u|·|v| 가 1 을 넘는다. null 이면 뒤
 */
export function mark(s, fovH, fovV, eye) {
  if (s.behind) return null;
  // 평면에 찍히는 자리는 **tan** 이다 (도에 정비례가 아니다 — v91)
  const u0 = Math.tan(s.az * DEG) / Math.tan(fovH / 2 * DEG);
  const v0 = Math.tan(s.el * DEG) / Math.tan(fovV / 2 * DEG);
  const cr = Math.cos(eye.roll * DEG), sr = Math.sin(eye.roll * DEG);
  return { u: u0 * cr - v0 * sr, v: u0 * sr + v0 * cr };
}

/**
 * ★★★ **탄이 지나가는 길에 있는 것** — 각도만 보면 코앞의 바위를 지나
 *   뒤의 적을 맞힌다 (v93 에 잡은 것).
 *
 * @param list `{ id, p, size }` 목록 (p 는 눈 기준 자리)
 * @param eye  눈의 자세
 * @param tol  조준선의 굵기 (도). 큰 것은 넉넉하게 — `size` 를 곱한다
 * @returns 제일 **가까운** 것 (없으면 null)
 */
export function firstOnPath(list, eye, tol) {
  let best = null;
  for (const t of list) {
    const s = seen(t.p, eye);
    if (s.behind) continue;
    if (s.off > tol * (t.size ?? 1)) continue;
    if (!best || s.dist < best.s.dist) best = { t, s };
  }
  return best;
}

/** 조준선에 제일 가까운 것 — 길에 아무것도 없을 때 (조준 보조·광학이 읽는다) */
export function nearestToAim(list, eye) {
  let best = null;
  for (const t of list) {
    const s = seen(t.p, eye);
    if (!best || s.off < best.s.off) best = { t, s };
  }
  return best;
}

/**
 * ══ ★★★ **락온** — 묶기 · 유지 · 놓기가 **각각 다른 값**이다 ═══════════
 *
 *  ★ 사장님 「락온이 되면 물체가 움직여서 타겟을 놓치더라도 **일정 범위
 *    안에서는 자동 추격**」 · 「**약간 느리게 따라갈 수는 있지만 지금은
 *    위치가 완전 다르잔아**」
 *
 *  ★★ 실제 STT(단일 표적 추적)가 그렇다:
 *      · **묶을 때**는 좁게 겨눠야 한다 (`lockCone`)
 *      · **묶은 뒤**에는 안테나가 표적을 따라가므로 넓게 버틴다 (`holdCone`)
 *      · 그 밖으로 나가도 **잠깐은 외삽**한다 (`grace`)
 *  ★ 그리고 **따라가는 데 시간이 걸린다** (`slew`) — 그게 사장님이 말씀하신
 *    「약간 느리게 따라간다」다. 즉각 붙으면 계기가 아니라 자석이다
 */
export const LOCK = {
  lockCone: 9,
  /**
   * ══ ★★★ v119 — **유지 한계는 「짐벌」이다** (32 → 60) ═══════════════
   *
   *  ★ 사장님 (2026-08-12) 「락온 시키면 **자동으로 타겟을 따라가도록**
   *    해줘. 내가 타겟을 조준을 크게 벗어나면 다시 조준해야 해서 불편해.
   *    무슨 말인지 모르면 **전투기 레이더 추적은 어떻게 하는지 고증**해서
   *    적용하던지」
   *
   *  ★★ 고증: 기계식 주사 안테나의 STT 는 **안테나가 표적을 따라간다.**
   *    조종사가 기수를 그쪽에 둘 필요가 없고, 끊기는 것은 안테나가
   *    **더 못 돌아갈 때**다 — 그게 **짐벌 한계**이고 F-16 급이 ±60도다.
   *    (그래서 조종사들이 「짐벌 아웃」이라고 부른다)
   *
   *  ★★★ 32 도는 **그 어느 것도 아닌 숫자**였다. 묶는 각(9)보다 넓다는
   *    것 말고는 근거가 없었고, 붙어서 도는 개싸움에서는 45~90도를
   *    예사로 넘기므로 **묶는 족족 풀렸다.** 사장님이 「다시 조준해야
   *    해서 불편하다」고 하신 것의 절반이 이것이다
   */
  gimbal: 60,
  lockFor: 2.6,
  grace: 1.1,
  range: 260,
  /** 표식이 표적을 따라가는 속도 (도/초). 무한이면 자석이다 */
  slew: 90,

  /**
   * ══ ★★★ v119 — **노치** (빔 기동) ═════════════════════════════════
   *
   *  ★ 짐벌만 넓히면 「묶으면 끝」이 된다. 그러면 락온이 **결심이 아니라
   *    절차**가 되고, 이 저장소가 계속 경계해 온 「늘 그게 답인 조작」이다.
   *
   *  ★★ 고증이 마침 그 자리를 채운다. 도플러 레이더는 **접근율**로
   *    표적을 지면·잡음에서 갈라낸다. 표적이 내 시선에 **수직으로**
   *    날면 접근율이 0 이 되어 필터가 걸러 버린다 — 이게 **노치(빔)**
   *    기동이고, 실제 조종사가 락온을 떨구는 첫째 수단이다.
   *
   *  ★★★ 그래서 이 게임에서도 **적이 옆으로 빼면 놓친다.** 쫓는 쪽은
   *    「각을 안 뺏기는 것」이 아니라 **「접근율을 살려 두는 것」**이
   *    일이 된다 — 붙어서 밀어붙이면 유지되고, 겉돌면 떨어진다
   *
   *  ★★★ **가만히 있는 것은 노치가 아니다.** 처음에 「접근율이 작으면」
   *    하나로만 재 봤더니, **제자리에서 쏘는 저격수**(`target-table` 의
   *    standoff 종류 · 거리를 유지한다)가 통째로 못 물리는 것이 됐다.
   *    그건 「빔 기동을 했다」가 아니라 **「안 움직였다」**다.
   *
   *  ★ 노치의 정의는 **「시선을 가로질러 빠르게 난다」**이다 — 시선
   *    방향 속도는 0 인데 **옆 방향 속도는 크다.** 둘을 같이 봐야 한다.
   *    (그리고 옆 속도는 **세상 기준**으로 잰다 — 내가 고개를 돌린 것은
   *    표적의 도플러를 안 바꾼다. 이걸 눈 기준으로 재면 **내가 휘저을
   *    때마다 노치**가 되어 정반대의 게임이 된다)
   *
   *  @property notch     시선 방향 속도가 이보다 작으면 (m/초 · 절대값)
   *  @property notchSide **그리고** 옆 방향 속도가 이보다 커야 (m/초)
   *  @property notchFor  그 상태가 이만큼 이어져야 놓는다 (초) — 한 번
   *                      스치는 것으로 깨면 그건 노치가 아니라 잡음이다
   */
  notch: 4,
  notchSide: 11,
  notchFor: 1.4,
};

export const makeLock = () => ({
  id: null, t: 0, grace: 0,
  /** 표식이 지금 가리키는 자리 (도) — 표적을 **쫓아간다** */
  atAz: 0, atEl: 0,
  /** ★ v119 — 접근율이 죽어 있던 시간 (초). `notchFor` 를 넘기면 놓는다 */
  notch: 0,
  /** 지난 프레임의 거리 — 접근율을 여기서 잰다 */
  was: null,
});

/**
 * 한 프레임.
 * @param aim  지금 조준선에 제일 가까운 것 `{ t, s }` 또는 null
 * @param find id 로 표적을 찾는 함수 (묶은 것을 계속 본다)
 * @returns 'lock' | 'break' | null
 */
export function stepLock(L, dt, aim, find, eye) {
  // 묶여 있으면 **그 표적**을 본다 — 「제일 가운데 있는 것」이 아니다 (v94)
  if (L.id !== null) {
    const t = find(L.id);
    const s = t ? seen(t.p, eye) : null;
    // ══ ★★★ v119 — **도플러 두 성분**을 잰다 (노치의 재료) ═══════════
    //  ★ 거리는 **내가 고개를 돌려도 안 변한다** — 그래서 시선 속도는
    //    여기서 그냥 재도 맞는다. 옆 속도는 표적이 제 힘으로 흐르는 몫
    //    (`vaz`·`vel`, 도/초 · 세상 기준)에서 온다 — 내 회전을 안 섞는다
    const closing = (s && L.was !== null) ? (L.was - s.dist) / Math.max(dt, 1e-6) : null;
    L.was = s ? s.dist : null;
    const side = (s && t) ? s.dist * Math.hypot(t.vaz ?? 0, t.vel ?? 0) * DEG : 0;
    // ★ 시선 속도가 죽어 **있으면서** 옆으로 빠르게 흐를 때만 시계가 돈다.
    //   살아나면 **0 으로 돌아간다** — 쌓아 두면 「한 번 겉돌면 영영 못
    //   문다」가 되어 벌이 너무 무겁다
    if (closing !== null && Math.abs(closing) < LOCK.notch && side >= LOCK.notchSide) L.notch += dt;
    else L.notch = 0;
    const notched = L.notch >= LOCK.notchFor;
    // ★★★ v119 — 유지 한계가 **짐벌**이다 (holdCone 32 → gimbal 60).
    //   조준선이 아니라 **안테나가 돌아갈 수 있나**를 묻는다
    const ok = s && !s.behind && s.dist <= LOCK.range && s.off <= LOCK.gimbal && !notched;
    if (ok) {
      L.grace = LOCK.grace;
      // ★ 표식이 **쫓아간다** — 한 번에 안 붙는다
      const step = LOCK.slew * dt;
      L.atAz += Math.max(-step, Math.min(step, wrap(s.az - L.atAz)));
      L.atEl += Math.max(-step, Math.min(step, s.el - L.atEl));
      return null;
    }
    L.grace -= dt;
    if (L.grace > 0) return null;
    const why = notched ? 'notch' : (!s || s.dist > LOCK.range) ? 'range' : 'gimbal';
    L.id = null; L.t = 0; L.notch = 0; L.was = null;
    L.why = why;
    return 'break';
  }
  if (!aim || aim.s.behind || aim.s.off > LOCK.lockCone || aim.s.dist > LOCK.range) {
    L.t = Math.max(0, L.t - dt * 1.6);
    return null;
  }
  L.t += dt;
  if (L.t < LOCK.lockFor) return null;
  L.id = aim.t.id;
  L.atAz = aim.s.az; L.atEl = aim.s.el;
  L.notch = 0; L.was = aim.s.dist;
  return 'lock';
}

/** 묶은 표식이 표적에서 몇 도 벗어나 있나 — 「따라가는 중」의 크기 */
export const lagOf = (L, s) => (L.id === null ? 0
  : Math.hypot(wrap(s.az - L.atAz), s.el - L.atEl));

/**
 * ══ ★★★ v98 — **각으로 적힌 표를 받는 입구** ═══════════════════════════
 *
 *  ★ 이 저장소의 표(`target.js`)는 자리를 **각과 거리**로 적는다
 *    (`az`·`el`·`dist`, 배 기준). 그걸 좌표로 바꿔 저장하면 이어하기
 *    저장과 도구 여남은 개가 통째로 깨진다 — **그건 갈아 끼우는 것이
 *    아니라 부수는 것**이다.
 *
 *  ★★ 그래서 **저장 방식은 두고 셈만 하나로** 모은다. 여기가 그 입구다:
 *    표에 적힌 각을 받아 `seen()` 과 **똑같은 모양**을 돌려준다.
 *    조준·레이더·HUD·3D 가 전부 이 함수 하나를 부르면, 자리를 아는 곳은
 *    (저장이 어디에 있든) **한 곳**이 된다.
 *
 *  ══ ★★★ **여기서 한 번 틀렸다** — 적어 둔다 ═══════════════════════
 *
 *  처음엔 이 함수를 「빼기」로 썼다: `az − yaw`, `el − pitch`.
 *  그러면 `seen()` 과 **같은 값이 안 나온다** — 기수를 들면 갈라진다.
 *  카메라가 `YXZ`(요 → 피치) 순서로 도는데(`main.js`), 요를 먼저 돌린
 *  뒤의 피치는 **고도만 깎는 것이 아니라 방위도 함께 민다.** 정면
 *  (az=0)에서만 우연히 맞고, 옆으로 갈수록 벌어진다.
 *
 *  ★ 그런데 그게 정확히 **여태 고쳐 온 병**이다. 「고쳤다」면서 같은
 *    병을 새 함수 안에 다시 넣을 뻔했다 — 두 입구가 **거의** 같은 것이
 *    제일 나쁘다. 늘 틀리면 금방 잡히는데, 정면에서만 맞으면
 *    **검사도 통과하고 눈에도 안 띄다가** 기수를 든 순간 어긋난다.
 *
 *  ★★ 그래서 흉내가 아니라 **정말 같은 것을 쓴다**: 각을 자리로 펴서
 *    (`pointOf`) `seen()` 에 그대로 넣는다. 같은 값이 나오는 게 아니라
 *    **같은 함수**다. `tools/space-block.js [6]` 이 그것을 지킨다
 *
 * @param t   { az, el, dist } — 배 기준 각과 거리 (도 · m)
 * @param eye { yaw, pitch, roll } — 기수가 보는 곳 (도)
 */
export function relOf(t, eye) {
  return seen(pointOf(t), eye);
}

/**
 * ★★★ 표에 적힌 **각+거리**를 배 기준 **자리**로 (m).
 *
 *  ★ `world/targets.js` 가 3D 물체를 놓는 데 쓰던 바로 그 식이다 —
 *    거기 있던 것을 여기로 **옮겨 왔다.** 화면에 놓는 식과 규칙이 재는
 *    식이 다른 파일에 따로 있으면, 한쪽만 고쳐도 아무도 안 운다
 */
export function pointOf(t) {
  const a = (t.az ?? 0) * DEG, e = (t.el ?? 0) * DEG;
  const d = Math.max(1e-3, t.dist ?? 0);
  return {
    x: Math.sin(a) * Math.cos(e) * d,
    y: Math.sin(e) * d,
    z: -Math.cos(a) * Math.cos(e) * d,
  };
}
