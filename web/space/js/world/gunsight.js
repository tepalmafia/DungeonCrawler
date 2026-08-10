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
  ctx.strokeStyle = 'rgba(143,230,192,.13)';
  ctx.lineWidth = 1;
  for (let a = -10; a <= 10; a += 5) {
    const x = cx + a * sx;
    ctx.beginPath(); ctx.moveTo(x, h * 0.08); ctx.lineTo(x, h * 0.92); ctx.stroke();
  }
  for (let e = -8; e <= 8; e += 4) {
    const y = cy - e * sy;
    ctx.beginPath(); ctx.moveTo(w * 0.04, y); ctx.lineTo(w * 0.96, y); ctx.stroke();
  }

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
      const foe = KINDS[t.kind]?.rams;
      ctx.strokeStyle = foe ? HOT : (t.inRange ? FG : DIM);
      ctx.lineWidth = Math.max(2, h * (foe ? 0.014 : 0.009));
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * R0, cy + Math.sin(ang) * R0);
      ctx.lineTo(cx + Math.cos(ang) * (R0 + (R1 - R0) * (0.35 + away)), cy + Math.sin(ang) * (R0 + (R1 - R0) * (0.35 + away)));
      ctx.stroke();
      continue;
    }
    const far = !t.inRange;
    // 가까울수록 크게 — 거리가 크기로 읽혀야 「기다렸다 쏜다」가 생긴다
    const r = Math.max(h * 0.035, h * 0.11 * (1 - t.dist / (TARGET.spawn[1] * 1.1)));
    ctx.strokeStyle = far ? 'rgba(143,230,192,.28)' : FG;
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
    const rr = LOCK_CONE * sx;
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
  ctx.fillStyle = locked ? HOT : DIM;
  ctx.font = `700 ${f(0.085)}px system-ui, sans-serif`;
  // ★ 화면 안에 있으면 그것을, 없으면 **제일 가까운 것이 어느 쪽인지**를
  //   말한다. 「없습니다」는 하늘이 정말 빌 때만 쓴다
  const word = near
    ? (locked ? `${KINDS[near.t.kind].name} — 물렸습니다`
      : `${KINDS[near.t.kind].name} · ${rangeWord(near.t.dist, s.wMax ?? null)}`)
    : any
      ? sideWord(any, aimAz, aimEl)
      : '떠도는 것이 없습니다';
  ctx.fillText(word, w * 0.05, h * 0.95);

  if (s.cool > 0) {
    ctx.fillStyle = DIM;
    ctx.textAlign = 'right';
    ctx.font = `700 ${f(0.08)}px ui-monospace, monospace`;
    ctx.fillText('재는 중', w * 0.95, h * 0.95);
    ctx.textAlign = 'left';
  }
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
function drawSign(ctx, w, h, s) {
  if (!s.power?.sensor) {
    ctx.fillStyle = 'rgba(255,154,92,.85)';
    ctx.font = `600 ${Math.round(h * 0.055)}px system-ui, sans-serif`;
    ctx.fillText('탐지 꺼짐', w * 0.05, h * 0.95);
    return;
  }
  const at = s.contactAt ?? SIGN.contactAt;
  const v = Math.max(0, Math.min(1, (s.sign ?? 0) / SIGN.max));
  const over = (s.sign ?? 0) > at;
  const bx = w * 0.05, by = h * 0.90, bw = w * 0.20, bh = h * 0.035;
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
  ctx.font = `600 ${Math.round(h * 0.05)}px ui-monospace, monospace`;
  ctx.fillText(`자국 ${Math.round(s.sign ?? 0)}`, bx, by - h * 0.022);
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
