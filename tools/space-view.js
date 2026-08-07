// ══════════════════════════════════════════════════════════════════════════
//  ★★★ 조종석 시야 — **얼마나 보이나** (v65 · docs/space/VIEW.md)
//
//    node tools/space-view.js
//
//  ★ 사장님: 「아직 조정석에서 보는 시야가 작은데 어떻게 해결할지 기획해봐.
//             인터넷에서 데이터를 찾던지」 → 「2로가고 12시 비우고」
//
//  ★★ **왜 브라우저를 안 쓰나.** 시야각은 좌표에서 나오는 값이라
//     `atan(크기 / 거리)` 로 끝난다. 브라우저를 띄우면 한 번에 몇 분인데
//     여기서 나오는 답은 같다 — **잴 수 있는 것은 표에서 잰다.**
//     그리고 좌표를 고치면 그 자리에서 값이 바뀌므로, 이 도구가
//     「조종석을 만질 때 옆에 켜 두는 자」가 된다.
//
//  ★ 여기서 안 나오는 것: **「넓어 보이나」.** 그건 화면을 찍어야 알고,
//    마지막 판정은 사장님이 하신다.
//
//  ── 견주는 값 (찾아본 것) ────────────────────────────────────────────
//    FAA AC 25.773-1 (여객기 조종실 시계 설계)  기수 너머 아래 **17도**
//    F-16 (틀 없는 버블)   수평 360 · 세로 195 · 기수 너머 **15도**
//    F-35 (틀 있는 캐노피) 수평 340 · 세로 188.5 · 기수 너머 **16도**
// ══════════════════════════════════════════════════════════════════════════
import { HELM_SEAT, FLY_VIEW } from '../web/space/js/game/helm-table.js';
import { CANOPY, CONSOLE_PTS, GLASS_Y, BROW_Y } from '../web/space/js/game/view-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const deg = (r) => (r * 180) / Math.PI;
const ang = (dy, dz) => deg(Math.atan2(dy, dz));

/** 정면 유리·콘솔의 z (가운데 조각) */
const GLASS_Z = CANOPY[2][1];
const CON_Z = CONSOLE_PTS[2][1];
/** 정면 유리를 가르는 기둥(멀리언)의 x */
const MULLION_X = Math.abs(CANOPY[2][0]);

/** 눈에서 본 각도들 */
function look(eyeY, eyeZ) {
  const dg = Math.abs(GLASS_Z - eyeZ);
  const dc = Math.abs(CON_Z - eyeZ);
  const downBrow = ang(eyeY - BROW_Y, dc);
  const downGlass = ang(eyeY - GLASS_Y.sill, dg);
  const down = Math.min(downBrow, downGlass);
  const up = ang(GLASS_Y.head - eyeY, dg);
  return { dg, dc, down, downBrow, downGlass, up, tall: down + up, mullion: ang(MULLION_X, dg) };
}

const FOV_WIDE = 72;

console.log('\n조종석 시야 — 얼마나 보이나');
console.log(`   좌석 z ${HELM_SEAT.seatAt.z} · 정면 유리 z ${GLASS_Z} · 콘솔 앞 z ${CON_Z}`);
console.log(`   유리 ${GLASS_Y.sill} ~ ${GLASS_Y.head} · 눈썹 차양 ${BROW_Y} · 앉은 눈 ${HELM_SEAT.eye}`);

console.log('\n[1] ★ **앉기만 했을 때** — 잡기 전에도 밖이 보여야 한다');
{
  const v = look(HELM_SEAT.eye, HELM_SEAT.seatAt.z);
  console.log(`   유리까지 ${v.dg.toFixed(2)}m · 아래 ${v.down.toFixed(1)}도 · 위 ${v.up.toFixed(1)}도`);
  console.log(`   ⇒ 세로 창 ${v.tall.toFixed(1)}도 · 화각 ${FOV_WIDE} 의 ${((v.tall / FOV_WIDE) * 100).toFixed(0)}%`);
  ok(v.tall >= 35,
    `앉기만 해도 세로 ${v.tall.toFixed(1)}도가 보인다 (35도 이상) — 잡기 전에 창이 어디 있는지 알아야 잡는다`);
  ok(v.up > 20, `위로 ${v.up.toFixed(1)}도 — 별이 보인다`);
}

console.log('\n[2] ★★★ **잡았을 때** — 여기가 「전체 화면」이다');
{
  const v = look(HELM_SEAT.eye + FLY_VIEW.rise, HELM_SEAT.seatAt.z - FLY_VIEW.lean);
  const pct = (v.tall / FLY_VIEW.fov) * 100;
  console.log(`   유리까지 ${v.dg.toFixed(2)}m · 아래 ${v.down.toFixed(1)}도 (차양 ${v.downBrow.toFixed(1)} · 유리 ${v.downGlass.toFixed(1)}) · 위 ${v.up.toFixed(1)}도`);
  console.log(`   ⇒ 세로 창 ${v.tall.toFixed(1)}도 · 화각 ${FLY_VIEW.fov} 의 ${pct.toFixed(0)}%`);
  // ★★ **기수 너머(over-the-nose)** — 실제 기준이 있는 유일한 값이다
  ok(v.down >= 15,
    `★★ 기수 너머 아래로 **${v.down.toFixed(1)}도** — F-16 이 15 · F-35 가 16 · FAA 가 17 이다.`
    + ' 가는 방향을 못 보면 그건 조종석이 아니다');
  ok(v.tall >= 60,
    `★★ 세로 창이 **${v.tall.toFixed(1)}도** (60도 이상) — v64 까지 34.6도였다`);
  ok(pct >= 65,
    `★★★ 창이 화면의 **${pct.toFixed(0)}%** (65% 이상) — v64 까지 37% 였다.`
    + ' 화각만 넓히고 유리를 안 키우면 넓어진 화각을 채울 것이 없다');
  ok(v.dg < 1.5,
    `유리가 눈에서 ${v.dg.toFixed(2)}m — F-16 이 버블인 이유는 유리가 큰 게 아니라 **머리 바로 옆**이기 때문이다`);
}

console.log('\n[3] ★★ **12시가 비어 있나** — 한복판이 막히면 넓어진 것이 안 읽힌다');
{
  const v = look(HELM_SEAT.eye + FLY_VIEW.rise, HELM_SEAT.seatAt.z - FLY_VIEW.lean);
  console.log(`   정면 유리를 가르는 기둥이 ±${v.mullion.toFixed(0)}도에 있다`);
  ok(v.mullion >= 30,
    `★ 기둥이 ±${v.mullion.toFixed(0)}도로 **밀려나 있다** (30도 밖) — 정면 한복판이 비었다`);
  // 유리 한가운데 x=0 에 세로 구조재가 없어야 한다
  ok(!CANOPY.some((p) => Math.abs(p[0]) < 0.3),
    `캐노피 점 중 x=0 근처가 **없다** — 12시에 기둥이 안 선다 (${CANOPY.map((p) => p[0]).join(', ')})`);
}

console.log('\n[4] ★ **계기가 눈 아래인가** — DEP 는 눈만 정하는 것이 아니다');
{
  ok(BROW_Y < HELM_SEAT.eye,
    `눈썹 차양(${BROW_Y})이 앉은 눈(${HELM_SEAT.eye})보다 **아래**다 — 실제 조종석은 차양 위로 밖을 본다`);
  const gap = HELM_SEAT.eye - BROW_Y;
  ok(gap >= 0.05 && gap <= 0.35,
    `그 차이가 ${(gap * 100).toFixed(0)}cm — 실제로 5~10cm 다. 너무 낮으면 계기가 안 읽힌다`);
}

console.log('\n[5] ★ **무릎이 들어가나** — 앞으로 당기다 사람을 콘솔에 붙여 놓으면 안 된다');
{
  const knee = Math.abs(CON_Z - HELM_SEAT.seatAt.z);
  ok(knee >= 1.0,
    `좌석에서 콘솔 앞까지 ${knee.toFixed(2)}m (1.0m 이상) — 기획서의 안②는 이 값을 안 봤고,`
    + ' 그대로 지었으면 0.58m 라 무릎이 안 들어갔다');
  const reach = HELM_SEAT.reach;
  ok(knee > reach, `조종간(${reach}m)이 무릎 공간(${knee.toFixed(2)}m) 안에 있다 — 손이 닿는다`);
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「넓어 보이나」는 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「몇 도가 보이나 · 화면의 몇 %인가 · 12시가 비었나」뿐이다.');
process.exit(fail ? 1 : 0);
