// ══════════════════════════════════════════════════════════════════════════
//  조준경 — **실내에서 밖을 겨누는 화면** (2026-08-06 · 사장님 요청)
//
//  ★ B-29 의 관측창 조준경을 화면으로 옮긴 것이다. 사수는 밖에 안 나가고
//    **여기를 보며** 손잡이로 원격 포탑을 돌린다.
//
//  ★ 왜 창밖이 아니라 화면인가
//    창밖으로 겨누게 하면 **카메라가 조준기가 되어** 시야와 포탑이 한 몸이
//    된다. 그러면 이 게임은 1인칭 슈터가 되고, 「손이 곧 상태창」도
//    「동시에 두 곳에 못 있는다」도 다 무너진다.
//    화면이면 **포탑은 저 위에 따로 있고 나는 여기 앉아 있다**가 유지된다.
//
//  ★ 이 배의 다른 화면과 같은 규약 — 캔버스에 데이터를 그린다.
//    「화면 속 내용은 그림이 아니라 데이터다」 (world/cockpit.js 머리말)
//
//  ══════════════════════════════════════════════════════════════════════════
//  ★★★ **v65 — 화면에서 HUD 로** (사장님 「레이더는 반투명하게, 그 대신
//     잘 보여야지 조준을 할 수 있겠지?」)
//
//  ★ 이 판이 왜 났나. 이 조준경은 **0.78 × 0.58 짜리 불투명 판**이었고
//    앉은 눈 앞 0.77m 에 서 있었다 — 계산하면 **37도**를 덮는다.
//    창의 세로 폭이 34.6도였으니 **창보다 큰 검은 판이 창 앞에** 있었던
//    셈이다. 사장님이 보신 「가운데 검은 화면」이 이것이다.
//
//  ★★ 「반투명한데 잘 보인다」는 실제 전투기가 이미 푼 문제다 — **HUD** 다.
//     ① **배경을 안 그린다.** 검은 판이 아니라 **선만 빛난다**
//     ② **가산 혼합(additive)** — 별빛 위에 얹혀도 안 지워지고, 어두운
//        우주에서는 더 또렷하다. 어두운 픽셀은 아무것도 안 가린다
//     ③ **초록 단색** — 실제 HUD 가 초록인 이유는 사람 눈이 제일 밝게
//        보는 색이라 낮에도 읽히기 때문이다
//     ④ **표적 위에 얹힌다** — 상자와 다이아몬드가 표적 자리에 그려지므로,
//        「화면을 보고 겨눈다」가 아니라 **「밖을 보면 겨눠져 있다」**가 된다
//
//  ★ 고증: F-35 는 HUD 를 아예 없애고 **헬멧 바이저 전체**를 화면으로
//    썼다 (HMDS). 가상 HUD 는 40도 × 30도다. 우리는 앞유리 한 장을
//    통째로 쓰므로 그보다 넓고, 그게 「전체 화면」이라는 말과 맞는다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { KINDS, TARGET, rangeWord } from '../game/target-table.js';
import { hudFov } from '../game/view-table.js';
import { SIGN } from '../game/chase-table.js';
// ★★★ v75 — 「왼쪽/오른쪽」을 **방위 + 고도**로 (사장님 요청 · 고증)
import { callOut } from '../game/radar-table.js';
import { RADAR } from '../game/combat-table.js';
// ★★★ v98 — **자리를 아는 곳은 `frame.js` 하나다** (블록아웃).
//   HUD 가 제 방식으로 재면 「상자는 여기, 진짜는 저기」가 난다 —
//   v68·v93·v95 가 전부 그 병이었다
import { relOf } from '../game/frame.js';
import { azDiff } from '../game/target.js';
// ★★★ v103 — **자리는 표에 있다** (사장님 「선이나 글이 의미하는 것은?」·
//   「타겟 라인이 짤리는 문제도 수정해」). `h*0.95` 같은 것을 여기 안 적는다
import { ROWS, COLS, SIGNBOX, SAFE, WOBMAX, ADI, rungs } from '../game/hud-table.js';
// ★★★ v103 — **수평의.** 「내가 지금 똑바로 유지하고 있는지」
import { HORIZON, isOver, isLevel, wrapDeg } from '../game/horizon-table.js';
// ★★★ v104 — **항로점** (사장님 「항로, 미션을 선택하면 네비게이션이 나오도록」)
import { navState } from '../game/nav-table.js';
// ★★★ v108 — **무리 색** (적 빨강 · 물건 초록 · 행성 파랑).
//   사장님 「적인지 물체인디 행성인지 알 수 있도록 … 도형으로」
import { hueOf, bandOf } from '../game/legend-table.js';
// ★★★ v114 — **조준 띠** (사장님 「중앙 타겟 영역도 키우고」)
import { RINGS } from '../game/aim-table.js';

/**
 * ★ **어느 쪽인가**를 한 마디로 (v69). 각도를 숫자로 안 띄운다 —
 *   「117도」로는 아무것도 못 정하지만 「뒤쪽」이면 몸이 안다
 */
/**
 * ★★★ **어디에 있나** — v75 에 「왼쪽/오른쪽」에서 바뀌었다.
 *
 *   사장님 「**오른쪽 왼쪽이 아니고.** 실제 레이더 시스템을 고증해서」.
 *
 *   ★ 옛 판은 「왼쪽 옆」·「바로 뒤」처럼 **말**만 했다. 세 축이 다 열린
 *     뒤로는(v73 · 360도) 그걸로 부족하다 — **위아래가 통째로 빠져서**
 *     아래에 있는 적도 「왼쪽」이라고만 떴고, 그러면 어디로 얼마나
 *     돌려야 하는지 알 수가 없다.
 *
 *   ★★ **도는 방향은 글자, 얼마나는 숫자**로 나눈다: 「좌 146° · 아래 22°」
 *     숫자만 주면 어느 쪽으로 도는 것이 가까운지 한 번 더 생각해야 하고,
 *     글자만 주면 지금까지의 문제 그대로다. 실제 관제·편대 호출이
 *     방위와 고도를 같이 부르는 것과 같은 이유다.
 */
function sideWord(t, aimAz, aimEl = 0) {
  return callOut(KINDS[t.kind]?.name ?? '표적', azDiff(t.az, aimAz), t.el - aimEl);
}

const FG = '#8fe6c0';
const DIM = 'rgba(143,230,192,.45)';
const HOT = '#ff9a5c';
// ══ ★★ v82 — **쏠 수 있나를 색으로** (사장님 「색깔로 구분하던가」) ══
const SHOOT = '#7fe6a8';                 // 사거리 안 — 초록
const FAR = 'rgba(180,190,200,.45)';     // 사거리 밖 — 흐린 회색
const WARN = '#ffcf6a';
/** 락온 원의 반지름 (도) — 규칙과 **같은 값**을 쓴다 (`RADAR.lockCone`) */
const LOCK_CONE = RADAR.lockCone;

/** 종류마다 다른 모양 — **무엇을 쏘는지가 보여야 고를 이유가 생긴다** */
function glyph(ctx, kind, x, y, r) {
  ctx.lineWidth = Math.max(1.5, r * 0.22);
  if (kind === 'sat') {
    // 죽은 위성 — 몸통 + 태양전지판 둘
    ctx.strokeRect(x - r * 0.45, y - r * 0.45, r * 0.9, r * 0.9);
    ctx.beginPath();
    ctx.moveTo(x - r * 1.5, y); ctx.lineTo(x - r * 0.45, y);
    ctx.moveTo(x + r * 0.45, y); ctx.lineTo(x + r * 1.5, y);
    ctx.stroke();
  } else if (kind === 'raider') {
    // ★ v69 — **적 우주선.** v68 까지 이것만 모양이 없어서 파편으로
    //   그려졌다. 격추 게임에서 「저게 적인가 돌인가」가 안 읽히면
    //   조준경이 제 일을 안 하는 것이다. 쐐기 — 창밖 실루엣과 같은 모양
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.2);
    ctx.lineTo(x + r * 1.1, y + r * 0.9);
    ctx.lineTo(x, y + r * 0.4);
    ctx.lineTo(x - r * 1.1, y + r * 0.9);
    ctx.closePath();
    ctx.stroke();
  } else if (kind === 'fighter') {
    // 요격기 — 작은 쐐기. 적 우주선과 **같은 방향**이되 작고 가늘다
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.7, y + r * 0.8);
    ctx.lineTo(x - r * 0.7, y + r * 0.8);
    ctx.closePath();
    ctx.stroke();
  } else if (kind === 'gunship') {
    // 포함 — **덩어리.** 두꺼운 네모 + 포탑 둘
    ctx.strokeRect(x - r * 0.9, y - r * 0.6, r * 1.8, r * 1.2);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y - r * 0.6); ctx.lineTo(x - r * 0.5, y - r * 1.1);
    ctx.moveTo(x + r * 0.5, y - r * 0.6); ctx.lineTo(x + r * 0.5, y - r * 1.1);
    ctx.stroke();
  } else if (kind === 'drone') {
    // 자폭정 — **마름모.** 작고 뾰족하다
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.9); ctx.lineTo(x + r * 0.7, y);
    ctx.lineTo(x, y + r * 0.9); ctx.lineTo(x - r * 0.7, y);
    ctx.closePath();
    ctx.stroke();
  } else if (kind === 'turret') {
    // 방공 포대 — **바닥에 붙은 것.** 반원 + 포신
    ctx.beginPath();
    ctx.arc(x, y + r * 0.3, r * 0.8, Math.PI, 0);
    ctx.moveTo(x - r * 0.9, y + r * 0.3); ctx.lineTo(x + r * 0.9, y + r * 0.3);
    ctx.moveTo(x, y - r * 0.5); ctx.lineTo(x, y - r * 1.2);
    ctx.stroke();
  } else if (kind === 'convoy') {
    // 호송선 — **길다.** 화물통이 줄줄이
    ctx.strokeRect(x - r * 1.4, y - r * 0.35, r * 2.8, r * 0.7);
    ctx.beginPath();
    for (const k of [-0.7, 0, 0.7]) {
      ctx.moveTo(x + r * k, y - r * 0.35); ctx.lineTo(x + r * k, y + r * 0.35);
    }
    ctx.stroke();
  } else if (kind === 'tank') {
    // 연료통 — 길쭉한 통
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.5, r * 1.0, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // 파편 — 모난 조각
    ctx.beginPath();
    ctx.moveTo(x - r, y - r * 0.3);
    ctx.lineTo(x - r * 0.2, y - r);
    ctx.lineTo(x + r, y - r * 0.1);
    ctx.lineTo(x + r * 0.3, y + r);
    ctx.closePath();
    ctx.stroke();
  }
}

function draw(ctx, w, h, s) {
  // ★★ **배경을 안 칠한다** (v65). 여기 `fillRect('#03100c')` 가 있었고,
  //   그것 하나가 이 물건을 「창 앞의 검은 판」으로 만들고 있었다.
  //   지우면 선만 남고, 가산 혼합이 그 선을 별빛 위에 얹는다
  ctx.clearRect(0, 0, w, h);
  const f = (k) => Math.round(h * k);

  // ★ 안 앉아 있으면 **꺼져 있다.** 늘 켜 두면 「지금 겨누는 중인가」가 안 읽힌다
  if (!s.on) {
    ctx.fillStyle = DIM;
    ctx.font = `600 ${f(0.11)}px system-ui, sans-serif`;
    ctx.fillText('조준경 — 앉으면 켜집니다', w * 0.07, h * 0.54);
    return;
  }

  // ══ ★★★ **눈금이 실제 각도와 1:1 이다** (v66) ═══════════════════════
  //  v65 까지 `sx = (w/2) / TARGET.azLimit` 였다 — **화면 폭에 ±60도를
  //  구겨 넣은** 것이다. 그런데 그 판은 94도를 덮고 있었으므로 눈금과
  //  실제 하늘이 어긋나 있었고, 「밖을 보면 겨눠져 있다」가 성립할 수 없었다.
  //  이제 HUD 는 **26도**고, 눈금도 **26도**다 — 표적 상자가 진짜 표적
  //  위에 얹힌다. 실제 HUD 가 좁은 이유가 이것이다: **좁아야 맞는다.**
  //  ★ 밖에 있는 것은 **가장자리 화살표**로 가리킨다 (실제 HUD 의
  //    target locator line 이 하는 일이다)
  const cx = w / 2, cy = h / 2;
  const FOVH = hudFov();
  // ══ ★★★ v91 — **도를 화소에 곧바로 비례시키면 안 된다** ═══════════
  //  판은 눈앞의 **평면**이라 각 θ 는 `tan θ` 자리에 찍힌다. 비례로 놓으면
  //  가운데는 맞고 **가장자리로 갈수록 벌어진다** — 화소로 재니 9도에서
  //  3.8화소였다 (사장님 「락온은 왼쪽인데 적은 우측 상단」의 마지막 조각).
  //  ★ `sx`·`sy` 는 **눈금선**이 쓴다 (거기서는 비례가 오히려 읽기 쉽다).
  //    표적을 놓는 것은 아래 `pxH`·`pxV` — **tan** 이다
  const sx = (w * 0.5) / (FOVH.h / 2);
  const sy = (h * 0.5) / (FOVH.v / 2);
  const RAD = Math.PI / 180;
  const TANH = Math.tan((FOVH.h / 2) * RAD);
  const TANV = Math.tan((FOVH.v / 2) * RAD);
  /** 좌우 몇 도 → 판 위 몇 화소. 90도 밖은 뒤라 `tan` 이 뒤집힌다 — 막는다 */
  const pxH = (d) => (Math.abs(d) >= 80 ? Math.sign(d) * w : (w * 0.5) * Math.tan(d * RAD) / TANH);
  const pxV = (d) => (Math.abs(d) >= 80 ? Math.sign(d) * h : (h * 0.5) * Math.tan(d * RAD) / TANV);
  // ★★★ v95 — **롤만큼 돌려서 찍는다** (판이 아니라 표식이 돈다).
  //   하늘은 도는데 판은 수평이므로, 여기서 한 번 돌려야 표식이 실제 적
  //   위에 얹힌다. 글씨·눈금은 안 돌아서 그대로 읽힌다.
  //   ★ v97 — 반복문 안에 있던 것을 **위로 올렸다** — 락온 원도 같은 것을
  //     쓰는데 거기서는 없는 이름이라 터졌다 (`node --check` 는 통과한다)
  const cr = Math.cos(s.roll ?? 0), sr = Math.sin(s.roll ?? 0);
  // ══ ★★★ v105 — **격자를 지웠다** ═════════════════════════════════
  //  ★ 사장님 「글씨가 작게 여러개 있는데 읽을 수가 없고 **조잡하잔아**」.
  //    가로 다섯 · 세로 다섯 줄이 늘 깔려 있었는데, 이 격자는 **아무도
  //    안 읽는다** — 도(度)를 세는 사람이 없다. 뜻이 없는 선은 배경이고,
  //    배경은 읽을 것을 가린다. `sx`·`sy` 도 이제 락온 원이 안 쓴다(v103)

  // ══ ★★★ **떠도는 것들 — 기수 기준으로 그린다** (v69) ═══════════════
  //
  //  ★★ **v68 까지 세상 기준으로 그리고 있었다.** `x = cx + t.az * sx` —
  //    그런데 HUD 판은 조종석에 **붙박이**라 화면 한가운데가 곧 기수다.
  //    즉 기수를 15도 틀면 표적 상자가 진짜 표적에서 **15도 어긋난** 채
  //    떠 있었다. 기수가 ±62도를 못 벗어나던 v68 까지는 십자선도 같이
  //    어긋나서 둘이 서로를 가려 줬는데, v69 에 **한 바퀴를 돌게** 되면서
  //    바로 드러난다. 상자와 실물이 어긋나는 조준경은 없는 것만 못하다.
  const aimAz = s.az ?? 0, aimEl = s.el ?? 0;
  let near = null, nearD = 1e9;
  // ★★★ **화면 밖의 것도 센다** (v69). 처음엔 화면 안의 것만 `near` 로
  //   잡았는데, 브라우저로 찍어 보니 표적 넷이 옆에 떠 있는데도 아랫줄이
  //   **「떠도는 것이 없습니다」**라고 말하고 있었다 — 지시선은 가리키는데
  //   글은 없다고 하는, 계기 둘이 서로 다른 말을 하는 상태다.
  //   숫자로는 안 잡힌다: 도구는 캔버스 글씨를 안 읽는다
  let any = null, anyD = 1e9;
  const eye = { yaw: aimAz, pitch: aimEl };
  for (const t of s.list ?? []) {
    // ★★★ v98 — **상대 각도를 여기서 안 센다.** 조준(`aimedAt`)·레이더
    //   (`radarBlips`)와 **같은 함수**가 준 값을 그린다. v97 까지 세 곳이
    //   각자 뺐고, 그래서 「상자는 여기인데 잡히는 것은 저기」가 났다
    const r0 = relOf(t, eye);
    const raz = r0.az, rel = r0.el;
    { const dd = r0.off; if (dd < anyD) { anyD = dd; any = t; } }
    const px0 = pxH(raz), py0 = pxV(rel);
    let x = cx + (px0 * cr - py0 * sr);
    let y = cy - (px0 * sr + py0 * cr);
    // ★★ HUD 밖이면 **표적 지시선(TLL)** — 실제 전투기가 쓰는 것 그대로다.
    //   조종사는 이 선을 따라 **상자가 나타날 때까지 기수를 끈다.**
    //   HUD 는 26도뿐인데 표적은 사방에 있으므로, 이게 없으면 옆과 뒤가
    //   **아무 데도 안 나온다** (사장님 「직관적으로 방향을 맞출 수 있도록」)
    if (x < w * 0.06 || x > w * 0.94 || y < h * 0.08 || y > h * 0.92) {
      // 화면 밖 — 중심에서 그쪽으로 뻗는 선을 테두리에 붙여 그린다.
      //   ★ 길이가 **얼마나 멀리 돌아야 하나**를 말한다: 뒤에 있을수록 길다
      const ang = Math.atan2(y - cy, x - cx);
      const R0 = Math.min(w, h) * 0.30, R1 = Math.min(w, h) * 0.44;
      const away = Math.min(1, r0.off / 180);
      // ★★★ v108 — **무리 색이 이긴다.** 「사거리 안/밖」은 굵기로 말한다 —
      //   무엇인지가 먼저고 쏠 수 있나가 다음이다 (사장님 「적인지 물체인디」)
      ctx.strokeStyle = hueOf(t.kind);
      // ★ v108 — `foe` 는 무리 색이 대신한다. 굵기는 **적이면 굵게** —
      //   색을 못 보는 사람도 「저건 급한 것」을 굵기로 안다
      ctx.lineWidth = Math.max(2, h * (bandOf(t.kind).key === 'foe' ? 0.014 : 0.009));
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * R0, cy + Math.sin(ang) * R0);
      ctx.lineTo(cx + Math.cos(ang) * (R0 + (R1 - R0) * (0.35 + away)), cy + Math.sin(ang) * (R0 + (R1 - R0) * (0.35 + away)));
      ctx.stroke();
      continue;
    }
    const far = !t.inRange;
    // 가까울수록 크게 — 거리가 크기로 읽혀야 「기다렸다 쏜다」가 생긴다
    const r = Math.max(h * 0.035, h * 0.11 * (1 - t.dist / (TARGET.spawn[1] * 1.1)));
    // ★★★ v108 — **무리 색이 먼저다** (적 빨강 · 물건 초록 · 행성 파랑).
    //   「무엇인지」가 「쏠 수 있나」보다 먼저 읽혀야 한다 —
    //   사거리 밖은 **흐리게** 해서 말한다 (색을 뺏지 않는다)
    ctx.strokeStyle = far ? `${hueOf(t.kind)}66` : hueOf(t.kind);
    glyph(ctx, t.kind, x, y, r);
    const d = r0.off;
    if (d < nearD) { nearD = d; near = { t, x, y, r, raz, rel }; }
    // ══ ★★ **쏠 수 있나를 색으로** (v82) ═══════════════════════════
    //  ★ 사장님 「**거리가 멀어서 공격이 안되는 것을 직관적으로** 알 수
    //    잇게 하는 방법은? **색깔로 구분**하던가」
    //  ★★ 지금 든 무기의 사거리로 가른다 — 무기를 바꾸면 **색이 바뀐다.**
    //    그게 「무기를 왜 셋이나 두었나」를 눈으로 말해 준다
    if (s.wMax) {
      const canHit = t.dist <= s.wMax;
      ctx.strokeStyle = canHit ? SHOOT : FAR;
      ctx.lineWidth = Math.max(1.4, h * 0.007);
      ctx.beginPath();
      ctx.arc(x, y, r * 1.25, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (t.hp < (KINDS[t.kind]?.hits ?? 1)) {
      // 한 번 맞은 것 — 금이 갔다
      ctx.strokeStyle = HOT;
      ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.stroke();
    }
  }

  // ══ ★★★ **선도 점 (LCOS)** — 「여기를 쏴라」 ═══════════════════════
  //
  //  탄이 날아가는 데 시간이 걸리므로 **표적이 갈 자리**를 쏴야 한다.
  //  그걸 글로 알려주지 않는다 — **점 하나**로 말한다. 실제 전투기의
  //  선도 계산 조준기(LCOS)가 하는 일이고, 조종사는 「점에 십자선을
  //  얹는다」만 배운다.
  //
  //  ★ v68 까지는 선도를 **벌로만** 썼다 (`leadMiss`) — 빠른 표적은
  //    어디를 겨눠도 안 맞았고, 사람이 할 수 있는 일이 없었다.
  //    이제 `combat.js fire()` 가 **선도점 기준으로 판정**하므로
  //    이 점이 곧 진짜 과녁이다
  if (near && s.lead && near.t.inRange) {
    const fl = near.t.dist / s.lead.speed;
    // ══ ★★★ v98 — **점과 상자가 같은 자로 찍힌다** ═══════════════════
    //
    //  ★ v97 까지 이 두 줄만 `* sx` · `* sy` 였다 — 즉 **선도점은 도에
    //    정비례(선형)로, 표적 상자는 tan 으로** 찍고 있었다. 그리고
    //    선도점만 **롤을 안 돌았다.**
    //  ★★ 그래서 「점에 십자선을 얹어라」가 화면 가장자리와 기울어진
    //    하늘에서 **거짓말**이 됐다: 판정은 선도점 기준인데(`combat.js
    //    fire()`) 눈에 보이는 점은 다른 자리였다. 같은 두 줄이 v91 에
    //    HUD 를, v95 에 락온 원을 틀리게 했던 그 자리다 — **찍는 자는
    //    하나여야 한다**
    const lraz = near.raz + (near.t.vaz ?? 0) * fl;
    const lrel = near.rel + (near.t.vel ?? 0) * fl;
    const lp = pxH(lraz), lq = pxV(lrel);
    const lx = cx + (lp * cr - lq * sr);
    const ly = cy - (lp * sr + lq * cr);
    ctx.strokeStyle = HOT;
    ctx.lineWidth = Math.max(1.6, h * 0.010);
    ctx.beginPath(); ctx.arc(lx, ly, h * 0.026, 0, Math.PI * 2); ctx.stroke();
    // 표적에서 점까지 실선 — 「이만큼 앞」이 눈에 보인다
    ctx.strokeStyle = 'rgba(255,180,120,.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(near.x, near.y); ctx.lineTo(lx, ly); ctx.stroke();
  }

  // ══ ★★★ v102 — **발사관이 어디를 보고 있나** ═════════════════════════
  //
  //  ★ 사장님 「**계기에 표시되도록** 해줘」. v100 에 발사관을 만들면서
  //    규칙만 만들고 **화면에는 안 냈다** — 규칙이 있는데 안 보이면
  //    없는 것과 같다 (v82 에 락온 원으로 똑같이 겪었다).
  //
  //  ★★ 십자선(기수)과 **따로** 그린다. 그 둘이 벌어져 있는 것이 곧
  //    「동체는 돌았는데 발사관은 물고 있다」이고, 사장님이 말씀하신
  //    「방향은 유지」가 눈에 보이는 자리다.
  //  ★ 자리는 `mount.js` 가 준다 — **여기서 다시 안 잰다** (frame.js 규약)
  if (s.mount && s.mount.id !== null) {
    const m = s.mount;
    const mp = pxH(m.az), mq = pxV(m.el);
    const mx = cx + (mp * cr - mq * sr);
    const my = cy - (mp * sr + mq * cr);
    const r0 = h * 0.045;
    // ★ 흔들리면 **원이 커진다** — 「불안정」을 글이 아니라 크기로 먼저 말한다
    // ★★★ v103 — **끝이 있다.** 여태 `pxH(20°)*0.5` 라 400화소까지 커졌고,
    //   판이 768 이라 **위아래가 통째로 잘렸다** (사장님 사진의 잘린 주황 원).
    //   고리는 「이 안 어딘가로 간다」는 뜻이므로 판을 넘으면 뜻을 잃는다 —
    //   넘는 순간부터는 크기가 아니라 **색**이 말한다 (`mountWord` 의 「불안정」)
    const wob = Math.max(0, m.wob ?? 0);
    const rw = Math.min(h * WOBMAX, r0 + pxH(Math.min(20, wob)) * 0.5);
    ctx.strokeStyle = m.pinned ? HOT : (wob > 3 ? 'rgba(255,180,120,.85)' : FG);
    ctx.lineWidth = Math.max(1.4, h * 0.008);
    // 마름모 — 십자선(십자)과 **모양이 달라야** 둘이 안 헷갈린다
    ctx.beginPath();
    ctx.moveTo(mx, my - r0); ctx.lineTo(mx + r0, my);
    ctx.lineTo(mx, my + r0); ctx.lineTo(mx - r0, my);
    ctx.closePath(); ctx.stroke();
    if (wob > 0.4) {
      // 흔들림 고리 — 이 안 어딘가로 간다는 뜻이다
      ctx.strokeStyle = 'rgba(255,180,120,.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(mx, my, rw, 0, Math.PI * 2); ctx.stroke();
    }
    // 기수에서 발사관까지 — **얼마나 벌어졌나**가 선으로 보인다
    ctx.strokeStyle = 'rgba(143,230,192,.30)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(mx, my); ctx.stroke();
    ctx.fillStyle = m.pinned ? HOT : DIM;
    ctx.font = `700 ${Math.round(h * 0.036)}px system-ui, sans-serif`;
    // ★★★ v103 — **판 밖으로 안 나간다** (사장님 「타겟 라인이 짤리는 문제」).
    //   여태 마름모 오른쪽에 그냥 붙였는데, 마름모가 오른쪽 끝에 있으면
    //   글이 판을 넘어갔다 — 사장님 사진의 「…적 중」이 그것이다.
    //   넘칠 것 같으면 **왼쪽에** 적는다
    const word = m.word ?? '';
    const wpx = ctx.measureText(word).width;
    const rightOK = mx + r0 + w * 0.008 + wpx <= w * SAFE.x1;
    ctx.textAlign = rightOK ? 'left' : 'right';
    ctx.fillText(word,
      rightOK ? mx + r0 + w * 0.008 : Math.max(w * SAFE.x0 + wpx, mx - r0 - w * 0.008),
      Math.max(h * (SAFE.y0 + 0.03), Math.min(h * 0.62, my + h * 0.012)));
    ctx.textAlign = 'center';
  }

  // ══ ★★★ v102 — **도킹** — 붙을 수 있나 · 얼마나 빠른가 ═══════════════
  //
  //  ★ 도킹은 **조준이 아니라 조종**이라 숫자 둘이 있어야 손이 움직인다:
  //    **거리**와 **다가가는 속도**다. 속도가 한계를 넘으면 걸쇠가 튕기므로
  //    (「너무 빠릅니다 — 역추진으로 줄이십시오」) 그 값이 안 보이면
  //    사람은 왜 안 물리는지 모른다
  //  ★★★ v103 — **자리를 표에서 읽는다** (`hud-table.js ROWS`). 여태 여기
  //    `h*0.80` 이라고 적혀 있었고, 아랫줄·자국 막대도 각자 제 숫자를
  //    갖고 있었다 — 그래서 셋이 겹치는 것을 아무도 못 봤다
  // ══ ★★★ v105 — **넷을 한 줄로** (사장님 「글씨가 작게 여러개 있는데
  //  읽을 수가 없고 조잡하잔아」) ══════════════════════════════════════
  //
  //  ★★ 여태 도킹·까닭·수평의·항로점이 **각자 제 줄**을 갖고 동시에 떴다.
  //    판이 화면에서 185화소인데 줄 넷을 7화소로 쌓았으니 못 읽는 것이
  //    당연하다. **하나만 고른다** — 급한 것부터.
  //  ★ 고르는 순서가 곧 「지금 뭘 해야 하나」다: 붙는 중 > 붙을 수 있음 >
  //    뒤집힘 > 항로. 위가 있으면 아래는 말할 자리가 아니다
  {
    let act = null, tone = DIM;
    if (s.fix && s.fix.hold > 0) {
      // ★★★ v106 — **수리가 제일 위다.** 누르고 있는 동안은 그것만 말한다
      act = `수리 중 — P 를 누르고 계십시오 ${(s.fix.need - s.fix.hold).toFixed(1)}초`;
      tone = WARN;
    } else if (s.catchS && s.catchS.id !== null) {
      act = s.catchS.word; tone = HOT;
    } else if (s.dock && s.dock.docked) {
      act = `도킹 ${s.dock.word} — 들어온 것 ${s.dock.got ?? 0}`; tone = FG;
    } else if (s.dock && s.dock.near && !s.dock.blocked) {
      act = `H — 붙는다 (${s.dock.near.dist}m)`; tone = SHOOT;
    } else if (isOver(wrapDeg((s.roll ?? 0) * 180 / Math.PI))) {
      act = '★ 뒤집힘 — 조종이 반대입니다'; tone = HOT;
    } else if (s.fix && s.fix.can && s.fix.cool <= 0) {
      act = '★ P — 수리'; tone = WARN;
    } else if (s.fitUp) {
      // ══ ★★★ v110 — **더 좋은 파츠가 랙에 있다** ═══════════════════════
      //  회수한 파츠는 **저절로 안 달린다** (저절로 달면 I 창을 볼 이유가
      //  없어지고 「고르는 것」이 사라진다). 그런데 안 부르면 랙에 쌓아
      //  놓고 못 보고 지나간다 — v107 이 파츠를 만들고 아무도 못 쓴 것과
      //  같은 병이다. **고르게 하되, 고를 것이 생긴 것은 말해 준다**
      act = `★ I — ${s.fitUp} 가 랙에 있습니다`; tone = WARN;
    } else if (s.nav && s.nav.to && !(s.nav.auto && navState(s.nav.off) === 'on')) {
      act = s.nav.word;
      tone = navState(s.nav.off) === 'on' ? SHOOT
        : (navState(s.nav.off) === 'off' ? HOT : WARN);
    }
    if (act) {
      ctx.fillStyle = tone;
      ctx.textAlign = 'center';
      ctx.font = `700 ${Math.round(h * ROWS.act.size)}px system-ui, sans-serif`;
      ctx.fillText(act, cx, h * ROWS.act.y);
    }
  }

  // ══ ★★★ v104 — **항로점** — 지금 어디로 가는 중인가 ═════════════════
  //
  //  ★ 사장님 「**항로, 미션을 선택하면 네비게이션이 나오도록 해줘.
  //    그래야 수동으로도 이동할 수 있게.**」
  //
  //  ★★ **표적과 같은 자로 놓는다** (`pxH`·`pxV`). 여기서 제 방식으로
  //    다시 재면 「계기에는 저기, 창밖에는 여기」가 또 난다 —
  //    v91~v98 이 네 판 내내 그 병이었다.
  //  ★ 모양은 **속 빈 마름모**다. 표적(상자·쐐기)과도, 발사관(꽉 찬
  //    마름모)과도 안 헷갈려야 한다
  if (s.nav && s.nav.to) {
    const n = s.nav;
    const st = navState(n.off);
    const col = st === 'on' ? SHOOT : (st === 'off' ? HOT : WARN);
    // ★★ **표적과 똑같이 놓는다** — `relOf` 가 준 각을 `pxH`·`pxV` 로
    //   찍고 표식 회전(`cr`·`sr`)을 얹는다. 여기서 다시 세지 않는다
    const nz = relOf({ az: n.to.az, el: n.to.el, dist: n.to.dist ?? 1000 },
      { yaw: s.az ?? 0, pitch: s.el ?? 0 });
    const np = pxH(nz.az), nq = pxV(nz.el);
    const nx = cx + (np * cr - nq * sr);
    const ny = cy - (np * sr + nq * cr);
    const R = h * 0.030;
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(1.4, h * 0.006);
    const inPlate = !nz.behind
      && nx > w * 0.06 && nx < w * 0.94 && ny > h * 0.08 && ny < h * 0.62;
    if (inPlate) {
      // 판 안 — 마름모 + 둘레 고리
      ctx.beginPath();
      ctx.moveTo(nx, ny - R); ctx.lineTo(nx + R, ny);
      ctx.lineTo(nx, ny + R); ctx.lineTo(nx - R, ny);
      ctx.closePath();
      ctx.stroke();
      // ★ 항로 위일 때만 고리를 씌운다 — 「지금 맞다」를 한 번에 알린다
      if (st === 'on') {
        ctx.beginPath();
        ctx.arc(nx, ny, R * 1.75, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // ★★ 판 밖 — **가장자리 세모**로 어느 쪽인지 가리킨다.
      //   숫자만 주면 「우 96도」로는 어느 쪽으로 도는 것이 가까운지
      //   한 번 더 생각해야 한다 (v75 에서 배운 것과 같은 규약)
      const ang = Math.atan2(-(ny - cy), nx - cx);
      const rr = Math.min(w, h) * 0.40;
      const ex = cx + Math.cos(ang) * rr, ey = cy - Math.sin(ang) * rr;
      const T = h * 0.034;
      ctx.beginPath();
      ctx.moveTo(ex + Math.cos(ang) * T, ey - Math.sin(ang) * T);
      ctx.lineTo(ex + Math.cos(ang + 2.5) * T, ey - Math.sin(ang + 2.5) * T);
      ctx.lineTo(ex + Math.cos(ang - 2.5) * T, ey - Math.sin(ang - 2.5) * T);
      ctx.closePath();
      ctx.stroke();
    }
    // ★ 글은 여기서 안 적는다 — 위의 **한 줄**이 대신 말한다 (v105)
  }

  // ══ ★★★ v103 — **수평의** — 「내가 지금 똑바로 유지하고 있나」 ═══════
  //
  //  ★ 사장님 「비행기를 **q e로 뒤집으면 반대가 되는 것 같은데??**
  //    그렇다면 **내가 지금 똑바로 유지하고 있는지를 표시**해줘야 하나?」
  //
  //  ★★ 물으신 끝에 스스로 답하신 그대로다. 뒤집히면 조종이 반대가 되는
  //    것은 **버그가 아니라 물리**이고 (조종은 동체 기준, 눈은 세상 기준),
  //    실기가 그것을 푼 방법이 **수평의**다.
  //
  //  ★★★ 그리는 것은 **비스듬한 선 하나**다. 세상의 수평선을 판 위에
  //    얹으면 십자선(동체)과의 각이 곧 지금 기울기이므로, **숫자를 읽기
  //    전에 눈이 먼저 안다.** 숫자는 그 아래 한 줄로 거든다.
  //  ★ 표식 회전(`cr`·`sr`)을 **그대로 쓴다** — 여기서 다시 세지 않는다
  {
    const rdeg = wrapDeg((s.roll ?? 0) * 180 / Math.PI);
    const over = isOver(rdeg), lv = isLevel(rdeg);
    const col = over ? HOT : (Math.abs(rdeg) > HORIZON.warnAt ? WARN : DIM);
    // ══ ★★★ v103 (두 번째 판) — **피치도 넣는다** ════════════════════
    //
    //  ★ 사장님 「**비행기 현재 회전 상때도 도입했어?**」
    //
    //  ★★ 첫 판은 절반이었다: 선을 **늘 복판**에 그려서 롤만 보였다.
    //    실기 자세계는 「복판에 못박힌 기수 표시 + **오르내리는** 수평선」이
    //    한 벌이고, **그 사이의 벌어짐이 곧 기수 각**이다. 선을 복판에
    //    못박으면 그 정보가 통째로 사라진다.
    //  ★ 접는 이유(`ADI.squeeze`)는 표에 적어 뒀다 — 판이 세로 20도라
    //    참 크기로는 **기수 10도에 벌써 판 끝**이다
    const eldeg = s.el ?? 0;
    // 수평선이 판에서 얼마나 내려가 있나 (기수를 들면 아래로)
    const drop0 = -pxV(Math.max(-79, Math.min(79, eldeg))) * ADI.squeeze;
    // ★ 판을 넘으면 **가장자리에 붙여 남긴다** — 사라지면 「얼마나
    //   들렸나」를 볼 방법이 없어진다
    const lim = h * ADI.pin;
    const pinned = Math.abs(drop0) > lim;
    const drop = pinned ? Math.sign(drop0) * lim : drop0;
    const ux = cr, uy = -sr;                    // 세상의 가로 방향
    const vx = sr, vy = cr;                     // 세상의 위아래 방향
    /** 수평선 기준으로 (앞으로 a, 아래로 b) 만큼 간 자리 */
    const P = (a, b) => [cx + ux * a + vx * (drop + b), cy + uy * a + vy * (drop + b)];

    // ── 수평선 — 가운데는 십자선 자리라 비운다 ─────────────
    // ★ 가운데를 **넉넉히** 비운다. 처음에 0.075 로 뒀더니 십자선이 선에
    //   묻혔다 — 화면으로 잡았다. 수평의는 거드는 것이지 주인공이 아니다
    const L = w * 0.32, G = w * 0.125;
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(1.4, h * (lv ? 0.007 : 0.010));
    ctx.beginPath();
    ctx.moveTo(...P(-L, 0)); ctx.lineTo(...P(-G, 0));
    ctx.moveTo(...P(G, 0)); ctx.lineTo(...P(L, 0));
    // ★ 양 끝에 **아래로 꺾인 날개** — 어느 쪽이 하늘인지 선만으로는 모른다.
    //   실제 수평의의 눈금이 하는 일이 이것이다
    const dn = h * 0.035;
    for (const sgn of [-1, 1]) {
      ctx.moveTo(...P(L * sgn, 0)); ctx.lineTo(...P(L * sgn, dn));
    }
    ctx.stroke();

    // ── ★★ 피치 사다리 — 10도마다 ────────────────────────
    //  ★ 짧게 · 옅게 긋는다. 수평선보다 눈에 띄면 「지금 수평이 어디냐」가
    //    안 읽힌다 — 사다리는 눈금이지 주인공이 아니다
    //  ★★★ **꺾여 있으면 안 그린다.** 수평선이 판 밖이라 `drop` 을 붙여
    //    놓은 상태에서 사다리를 그리면 눈금이 제자리가 아닌 곳에 **뭉친다** —
    //    화면을 찍어 잡았다. 뜻이 없는 눈금은 눈금이 아니라 얼룩이다.
    //    이때는 **가장자리 화살표**만 어느 쪽인지 말한다
    ctx.strokeStyle = DIM;
    ctx.lineWidth = Math.max(1, h * 0.004);
    ctx.font = `600 ${Math.round(h * 0.058)}px ui-monospace, monospace`;
    ctx.fillStyle = DIM;
    ctx.textAlign = 'center';
    const RL = w * 0.10, RG = w * 0.125;
    if (pinned) {
      // 붙은 쪽을 가리키는 꺾쇠 — 「수평선은 저 아래(위)에 있다」
      const sgn = Math.sign(drop0);
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(1.4, h * 0.008);
      ctx.beginPath();
      const a0 = w * 0.045, b0 = h * 0.030 * sgn;
      ctx.moveTo(...P(-a0, 0)); ctx.lineTo(...P(0, b0)); ctx.lineTo(...P(a0, 0));
      ctx.stroke();
    } else if (Math.abs(rdeg) > ADI.showFrom || Math.abs(eldeg) > ADI.showFrom) {
      // ★★★ v105 — **할 말이 있을 때만 그린다.** 수평일 때 사다리는
      //   아무것도 안 말하는데 늘 그려서 판을 빗금으로 덮고 있었다
      for (const d of rungs()) {
      // 눈금은 수평선에서 **d 도만큼 떨어진** 자리다 (같은 자로 접는다)
      const b = pxV(d) * ADI.squeeze;
      if (Math.abs(drop + b) > h * 0.46) continue;   // 판 밖은 안 그린다
      ctx.beginPath();
      for (const sgn of [-1, 1]) {
        ctx.moveTo(...P(RG * sgn, b)); ctx.lineTo(...P((RG + RL) * sgn, b));
        // ★ 아래쪽 눈금은 **끝을 위로 꺾는다** — 위아래를 모양으로 가른다
        //   (실기 사다리의 규약이다. 색이나 굵기로 가르면 흐린 화면에서 진다)
        if (d < 0) { ctx.moveTo(...P((RG + RL) * sgn, b)); ctx.lineTo(...P((RG + RL) * sgn, b - dn * 0.6)); }
      }
      ctx.stroke();
      const [tx, ty] = P(-(RG + RL) - w * 0.030, b);
      ctx.fillText(String(Math.abs(d)), tx, ty + h * 0.012);
      }
    }

    // ★★★ v105 — **말은 위의 한 줄이 한다.** 여기는 **선만** 그린다.
    //   기울기는 선이 이미 눈으로 말하고 있고, 그 위에 글까지 얹으면
    //   그게 사장님이 보신 「작게 여러 개」다
  }

  // ── 십자선 — **기수가 보는 곳.** 곧 화면 한가운데다 ──────
  const ax = cx, ay = cy;
  // ══ ★★★ v97 — **락온 원은 표적 위에 얹힌다** ═══════════════════════
  //  사장님 「락온이 되면 … **약간 느리게 타겟이 따라갈 수는 있지만
  //          지금은 위치가 완전 다르잔아**」
  //  ★ 여태 원이 `cx, cy` 에 못박혀 있었다 — 즉 **묶었다는 것이 화면에
  //    아무 데도 안 나왔다.** 실제 HUD 의 표적 지시자는 표적 위에 있다.
  //  ★★ 자리는 `combat.js` 가 **쫓아가며** 준다 (`RADAR.slew`) —
  //    여기서 다시 계산하지 않는다 (자리를 아는 곳은 하나다 · frame.js 규약)
  let lx0 = cx, ly0 = cy;
  if (s.lockAt) {
    const p0 = pxH(s.lockAt.az), q0 = pxV(s.lockAt.el);
    lx0 = cx + (p0 * cr - q0 * sr);
    ly0 = cy - (p0 * sr + q0 * cr);
  }
  const locked = near && nearD <= (TARGET.aimTol * (KINDS[near.t.kind]?.size ?? 1)) && near.t.inRange;
  // ══ ★★★ v114 — **중앙 타겟 영역을 그린다** (`aim-table.js RINGS`) ═════
  //
  //  ★ 사장님 「**중앙 타겟 영역도 키우고 정확히 안쪽을 맞출 수록
  //    데이미지가 들어가도록**」 — 규칙만 고치면 **화면에 없는 규칙**이 된다.
  //    이 저장소는 그 병을 여러 번 앓았다 (락온 원이 v64~v82 내내 안 보였다).
  //
  //  ★★ **지금 겨눈 것의 자로 그린다.** 큰 것은 크게, 작은 것은 작게 —
  //    허용 각이 표적 크기를 곱한 값이기 때문이다(`tolOf`). 고정 크기로
  //    그리면 「보이는 고리와 맞는 각」이 갈라지고, 그게 v98 의 병이다.
  //  ★ 반지름 비율도 여기서 안 정한다 — 표(`RINGS`)가 정한다
  if (near && near.t.inRange) {
    const tolDeg = TARGET.aimTol * (KINDS[near.t.kind]?.size ?? 1);
    const nowK = nearD / Math.max(1e-6, tolDeg);
    for (const ring of RINGS) {
      const rr2 = pxH(tolDeg * ring.r);
      // ★ **지금 든 띠만 진하다.** 넷을 다 진하게 그리면 과녁이 아니라
      //   무늬가 되고, 그러면 「지금 어디인가」를 못 읽는다
      const on = nowK <= ring.r && nowK > (RINGS[RINGS.indexOf(ring) - 1]?.r ?? 0);
      ctx.strokeStyle = on
        ? (ring.tone === 'hot' ? HOT : ring.tone === 'good' ? FG : WARN)
        : 'rgba(143,230,192,.16)';
      ctx.lineWidth = Math.max(1, h * (on ? 0.009 : 0.004));
      ctx.beginPath(); ctx.arc(ax, ay, rr2, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.strokeStyle = locked ? HOT : FG;
  ctx.lineWidth = Math.max(1.6, h * 0.012);
  const g2 = h * 0.055;
  ctx.beginPath();
  ctx.moveTo(ax - g2 * 2, ay); ctx.lineTo(ax - g2 * 0.5, ay);
  ctx.moveTo(ax + g2 * 0.5, ay); ctx.lineTo(ax + g2 * 2, ay);
  ctx.moveTo(ax, ay - g2 * 2); ctx.lineTo(ax, ay - g2 * 0.5);
  ctx.moveTo(ax, ay + g2 * 0.5); ctx.lineTo(ax, ay + g2 * 2);
  ctx.stroke();
  // ══ ★★★ **락온 원을 보이게 한다** (v82) ═══════════════════════════
  //
  //  ★ 사장님 「**강제 락온**을 시키는 방법은 재미가 있나? **특정 원 안에
  //    들어오면 락온** 시키고 발사하는?」
  //
  //  ★★ **규칙은 v64 부터 이미 그것이다** — `RADAR.lockCone` 9도 안에
  //    `RADAR.lockFor` 2.6초를 두면 저절로 물린다. 그런데 **그 원이 화면에
  //    없었다.** 규칙이 있는데 안 보이면 없는 것과 같다 — 이 저장소가
  //    레이더 심볼로 방금 겪은 그것이다 (v80).
  //
  //  ★ 그리고 **발사는 손이 한다.** 저절로 쏘면 겨눌 이유가 없어지고,
  //    그러면 이 게임의 손이 통째로 없어진다. **잡는 것은 레이더,
  //    맞히는 것은 손** — v79 부터의 규약이다
  {
    // ★★★ v103 — `LOCK_CONE * sx` 였다. `sx` 는 **눈금선용 비례**라
    //   표적을 놓는 자(`pxH` · tan)와 다르다 — 즉 **원의 크기와 표적의
    //   자리가 서로 다른 자로** 그려지고 있었다. v98 에 선도점에서 고친
    //   그 자리이고, 락온 원만 남아 있었다. **찍는 자는 하나여야 한다**
    const rr = pxH(LOCK_CONE);
    ctx.strokeStyle = locked ? HOT : 'rgba(143,230,192,.30)';
    ctx.lineWidth = Math.max(1.2, h * 0.006);
    ctx.setLineDash(locked ? [] : [h * 0.03, h * 0.03]);
    ctx.beginPath(); ctx.arc(lx0, ly0, rr, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // ★ 물리는 중이면 **호가 차오른다** — 「얼마나 더 붙들고 있어야 하나」
    if (!locked && (s.lockK ?? 0) > 0.02) {
      ctx.strokeStyle = WARN;
      ctx.lineWidth = Math.max(2, h * 0.011);
      ctx.beginPath();
      ctx.arc(lx0, ly0, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.lockK);
      ctx.stroke();
    }
  }
  if (locked) {
    // 물렸다 — **표적 지시자 상자(TD box)**. 실제 HUD 와 같은 약속이다
    ctx.strokeRect(near.x - near.r * 1.5, near.y - near.r * 1.5, near.r * 3, near.r * 3);
  }

  // ── 아래 한 줄 — **숫자로 안 띄운다** ────────────────────
  //  ★★★ v103 — **0.085 → 0.055.** 65화소짜리 글씨가 자국 막대(h·0.90)를
  //    뚫고 지나가고 있었다 — 사장님 사진의 「좌 3?■■· 위 34°」가 그것이다.
  //    글씨를 줄이고 자국은 위로 옮겼다 (`hud-table.js SIGNBOX`)
  ctx.fillStyle = locked ? HOT : DIM;
  ctx.textAlign = 'left';
  ctx.font = `700 ${f(ROWS.foot.size)}px system-ui, sans-serif`;
  // ★ 화면 안에 있으면 그것을, 없으면 **제일 가까운 것이 어느 쪽인지**를
  //   말한다. 「없습니다」는 하늘이 정말 빌 때만 쓴다
  const word = near
    ? (locked ? `${KINDS[near.t.kind].name} — 물렸습니다`
      : `${KINDS[near.t.kind].name} · ${rangeWord(near.t.dist, s.wMax ?? null)}`)
    : any
      ? sideWord(any, aimAz, aimEl)
      : '떠도는 것이 없습니다';
  ctx.fillText(word, w * COLS.left, h * ROWS.foot.y);

  if (s.cool > 0) {
    ctx.fillStyle = DIM;
    ctx.textAlign = 'right';
    ctx.font = `700 ${f(ROWS.foot.size)}px ui-monospace, monospace`;
    ctx.fillText('재는 중', w * COLS.right, h * ROWS.foot.y);
  }
  ctx.textAlign = 'center';
}

/**
 * ★★★ **HUD 한 장** — 앞유리 안쪽에 선다 (v65).
 *
 *   `transparent` + `AdditiveBlending` + `depthWrite: false` 셋이 한 벌이다:
 *     · `transparent` 없이는 검은 배경이 그대로 칠해진다
 *     · 가산 혼합이라야 **어두운 픽셀이 아무것도 안 가린다**
 *     · `depthWrite: false` 라야 뒤의 별과 표적이 이 판에 안 잘린다
 *
 *   ★ `depthTest` 는 **켜 둔다.** v57 에서 별을 `depthTest: false` 로 두었다가
 *     천장과 계기 위에까지 그려진 일이 있다 — 투명한 것은 불투명한 것보다
 *     **나중에** 그려지므로, 깊이 검사를 끄면 앞뒤가 통째로 무너진다
 */
/**
 * ★★ **자국** — 계기판이 좁아지면서 화면 한 장이 밀려났다 (v66).
 *   HUD 로 올린다. **모는 동안 보는 것**이라 원래 여기 있어야 했다:
 *   왼쪽 아래 구석에 숫자와 막대만. 자리를 많이 안 먹는다
 */
// ══ ★★★ v103 — **왼쪽 아래에서 오른쪽 위로** ═══════════════════════════
//  ★ 여기가 `w*0.05, h*0.90` 이었고 아랫줄 글도 `w*0.05, h*0.95` 였다 —
//    **같은 구석에 둘**이라 글자가 막대를 뚫고 지나갔다 (사장님 사진).
//  ★★ 자국은 「지금 얼마나 눈에 띄나」라 **늘 떠 있는 값**이고, 늘 떠
//    있는 것은 구석으로 간다. 아랫줄은 바뀌는 값이라 눈이 가는 자리에 둔다
function drawSign(ctx, w, h, s) {
  ctx.textAlign = 'left';
  if (!s.power?.sensor) {
    ctx.fillStyle = 'rgba(255,154,92,.85)';
    ctx.font = `600 ${Math.round(h * SIGNBOX.label)}px system-ui, sans-serif`;
    ctx.fillText('탐지 꺼짐', w * SIGNBOX.x, h * (SIGNBOX.y + SIGNBOX.h));
    ctx.textAlign = 'center';
    return;
  }
  const at = s.contactAt ?? SIGN.contactAt;
  const v = Math.max(0, Math.min(1, (s.sign ?? 0) / SIGN.max));
  const over = (s.sign ?? 0) > at;
  const bx = w * SIGNBOX.x, by = h * SIGNBOX.y, bw = w * SIGNBOX.w, bh = h * SIGNBOX.h;
  ctx.strokeStyle = DIM; ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = over ? HOT : FG;
  ctx.fillRect(bx, by, bw * v, bh);
  // 접촉 기준선 — 이 안쪽이면 안 붙는다
  ctx.strokeStyle = HOT;
  ctx.beginPath();
  ctx.moveTo(bx + bw * (at / SIGN.max), by - h * 0.012);
  ctx.lineTo(bx + bw * (at / SIGN.max), by + bh + h * 0.012);
  ctx.stroke();
  ctx.fillStyle = over ? HOT : DIM;
  ctx.font = `600 ${Math.round(h * SIGNBOX.label)}px ui-monospace, monospace`;
  ctx.fillText(`자국 ${Math.round(s.sign ?? 0)}`, bx, by - h * 0.014);
  ctx.textAlign = 'center';
}

export function buildSight(width = 2.1, height = 1.5) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 768;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  mesh.renderOrder = 6;
  mesh.name = 'HUD';
  return {
    mesh,
    redraw(s) {
      draw(ctx, cv.width, cv.height, s || {});
      if (s?.on) drawSign(ctx, cv.width, cv.height, s);
      tex.needsUpdate = true;
    },
  };
}
