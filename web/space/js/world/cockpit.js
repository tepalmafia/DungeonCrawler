// ══════════════════════════════════════════════════════════════════════════
//  조종석 — **참고 이미지를 받고 다시 지었다.**
//
//  ★ 무엇이 달랐나 (2026-08-03, 사장님이 주신 조종석 사진)
//    처음 만든 조종석은 「평평한 유리 한 장 + 네모 콘솔 + 계기 하나」였다.
//    참고 사진과 나란히 놓으니 다른 점이 여섯 개였고, 전부 **화면 면적**
//    쪽이었다 (docs/POSTMORTEM.md §1-①):
//
//      1. 창이 **감싼다** — 정면 · 좌우 사선 · 머리 위. 한 장이 아니다
//      2. 창밖에 볼 것이 있다 — 행성 · 성운 · 다른 배
//      3. **빛나는 화면이 열 몇 개**고, 그게 방의 주광원이다
//      4. 창틀과 천장 리브를 따라 **띠조명** (파랑 + 주황 악센트)
//      5. 모든 면이 패널 · 리브 · 배관으로 **쪼개져** 있다. 민판이 없다
//      6. **좌석과 조종간** — 사람 크기를 알려 준다
//
//    이 파일이 1·3·4·5·6 을 만든다. 전부 **기하와 조명**이라 「좋아 보이는가」가
//    아니라 「맞나」로 판정된다 — 그래서 내가 만들어도 되는 것들이다.
//    2번(창밖 그림)은 **그림이라 사장님 몫**이다. 지금은 별과 민짜 구(球)로
//    자리만 잡아 두고, `core/asset-table.js` 에 규격을 적어 뒀다.
//
//  ★ 화면 속 내용은 왜 내가 그리나
//    저건 그림이 아니라 **데이터**다. 열이 오르면 눈금이 올라야 하므로
//    애초에 코드가 그려야 한다. 화면의 **테두리·금속 무늬**는 그림이다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { REGIONS, REGION_BLEND } from '../game/regions-table.js';
import { CIRCUITS, SIGN } from '../game/chase-table.js';
import { STEP, LAND } from '../game/land-table.js';
import { HELM_SEAT, YOKE_AT, YOKE } from '../game/helm-table.js';
import {
  CANOPY, CONSOLE_PTS, GLASS_Y, BROW_Y, browAt, browSeg,
  FACE_H, SHELF_H, PANEL_GAP, PANEL_DIST, DEP, SIDE, ROOF, STRUCTS,
} from '../game/view-table.js';
import { drawFork } from './chart.js';
import { buildStars, buildBand, buildDust, buildPlanet } from './sky.js';
// ★★★ v69 — **격추 게임으로 바뀌었다.** 떠도는 것들과 쏜 것들을 창밖에
//   세운다 (docs/space/COMBAT.md). v64 가 숫자만 만들고 **보이는 것을
//   안 만들어서** 「발사 되는게 안보이잔아? 적 비행선도 안보이고」가 났다
import { buildTargets } from './targets.js';
import { buildShots } from './shots.js';
import { buildSalvage } from './salvage.js';
import { DUST } from '../game/sky-table.js';
import { RADAR } from '../game/combat-table.js';
// ★ v75 — 데이터 블록이 표적 이름을 부른다 (「요격기」 · 「포함」)
import { KINDS } from '../game/target-table.js';
// ★★★ v75 — 레이더 계기가 고증한 값을 읽는다 (숫자와 규약은 표에만)
import {
  SYMBOL, RINGS, RWR, rwrLevel, elWord, vcWord, bearing,
  // ★★★ v80 — 소속을 모양으로 가르고, 판 안에 **범례**를 둔다
  MARK, LEGEND, PLAIN,
} from '../game/radar-table.js';
import { RUSH } from '../game/boost-table.js';

const GLASS = new THREE.MeshBasicMaterial({
  color: 0x0a1622, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
});

/** 창틀·구조재 — 어두운 금속 */
const FRAME = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.55, metalness: 0.75 });
/** 안쪽 패널 — 조금 밝다. 면을 쪼개는 데 쓴다 */
const PANEL = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.7, metalness: 0.45 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.8, metalness: 0.5 });

/** 띠조명. 스스로 빛나 보여야 하므로 조명 계산을 안 받는다 */
const stripMat = (hex) => new THREE.MeshBasicMaterial({ color: hex });
const BLUE = 0x63b6ff;
const AMBER = 0xff9a3c;

// ── 캐노피 ─────────────────────────────────────────────────
// ★★ **좌표는 `game/view-table.js` 에 있다** (v65). 시야각이 이 숫자들에서
//   나오는데, 이 파일은 three.js 를 쓰므로 `tools/` 가 못 읽는다 —
//   그래서 「시야가 몇 도인가」를 재려면 브라우저를 띄워야 했다.
//   **잴 수 있는 것은 표에서 잰다** (`tools/space-view.js`).
export { CANOPY, CONSOLE_PTS } from '../game/view-table.js';

/** 좌석이 서 있는 자리. 충돌이 같이 읽는다 */
/**
 * ★★ **하나다** (v61 · 사장님 「운전석도 하나만 하고」).
 *
 * 둘이었다. 그런데 이 배에는 **사람이 하나**다 — 「상인은 얼굴을 안
 * 만든다」(PLAN §1)와 같은 줄에서, 이 배에 다른 승무원은 없다.
 * 빈 좌석이 하나 더 있으면 그건 **없는 사람을 가리키는 물건**이다.
 *
 * ★ 그리고 **가운데를 비운다.** 좌석을 한가운데 두면 등받이가 조종간을
 *   가리고, 그게 v16 에서 「조정간이 안잡히잔아」가 났던 자리다.
 *   실제 우주선도 **급할 때 쓰는 것을 한가운데** 둔다 (크루 드래건의
 *   비상 탈출 레버 · REALSHIP.md §3) — 그 자리는 조종간 것이다.
 */
export const SEATS = [[HELM_SEAT.seatAt.x, HELM_SEAT.seatAt.z]];

const SILL = GLASS_Y.sill;   // 창 아래끝 — 표에서 (view-table.js)
/** 계기판 호 위의 z — 스위치를 얹을 때 쓴다. **손으로 안 적는다** */
const panelZof = (x) => DEP.z - PANEL_DIST * Math.sqrt(Math.max(0, 1 - (x / 2.20) ** 2));
// 조종간이 서는 z. 좌석(-6.95)보다 앞, 콘솔(-7.95~)보다 뒤 — **둘 사이**
const YOKE_Z = YOKE_AT.z;
// 조종간 가로대 높이.
// ★ 1.06 에서 올렸다. 그 높이에서는 **서서 자연스럽게 내려다보는 각도**
//   (고개 -0.2 쯤)에 안 걸리고, -0.30 까지 숙여야 겨우 한가운데 왔다.
//   콘솔 상판이 0.86 이므로 1.18 이면 여전히 「상판에서 올라온 기둥 위」로
//   읽히면서 눈에는 먼저 들어온다. 판정 상자도 같이 키웠다 —
//   **작은 것을 정확히 겨누게 하는 건 어려움이 아니라 짜증이다**
const YOKE_Y = YOKE_AT.y;
const HEAD = GLASS_Y.head;   // 창 위끝 — 표에서

function seg(a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  return {
    len: Math.hypot(dx, dz),
    mx: (a[0] + b[0]) / 2,
    mz: (a[1] + b[1]) / 2,
    rot: -Math.atan2(dz, dx),
  };
}

/** 한 구간을 덮는 판(유리든 금속이든) */
function pane(parent, a, b, y0, y1, mat, thick = 0.03) {
  const s = seg(a, b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(s.len, y1 - y0, thick), mat);
  m.position.set(s.mx, (y0 + y1) / 2, s.mz);
  m.rotation.y = s.rot;
  parent.add(m);
  return m;
}

/** 구간을 따라가는 가로 막대 — 창틀·띠조명·구조재 */
function rail(parent, a, b, y, mat, w = 0.1, h = 0.1, push = 0) {
  const s = seg(a, b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(s.len, h, w), mat);
  m.position.set(s.mx, y, s.mz + push);
  m.rotation.y = s.rot;
  parent.add(m);
  return m;
}

function box(parent, w, h, d, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  parent.add(m);
  return m;
}

// ── 화면 ───────────────────────────────────────────────────
// 캔버스에 그려서 붙인다. **이 방의 주광원이 이것들이다.**
function makeScreen(w, h, draw) {
  const cv = document.createElement('canvas');
  // ★ 픽셀 밀도를 한 곳에서 정하고, 글씨 크기는 **화면 높이에 비례**하게 쓴다.
  //   처음엔 256 에 15px·42px 처럼 박아 넣었는데, 화면마다 폭이 달라서
  //   숫자가 아래로 잘려 나갔다. 화면에 찍어 보고 알았다.
  cv.width = Math.round(w * 420);
  cv.height = Math.round(h * 420);
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex }),
  );
  const redraw = (state) => { draw(ctx, cv.width, cv.height, state); tex.needsUpdate = true; };
  return { mesh, redraw };
}

const FG = '#7fd4ff';
const DIM = 'rgba(127,212,255,.35)';

function bg(ctx, w, h) {
  ctx.fillStyle = '#04121c';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(127,212,255,.10)';
  ctx.lineWidth = 1;
  for (let y = h * 0.06; y < h; y += h * 0.075) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
}

function label(ctx, w, h, text) {
  const f = Math.round(h * 0.11);
  ctx.fillStyle = DIM;
  ctx.font = `600 ${f}px system-ui, sans-serif`;
  ctx.fillText(text, h * 0.07, h * 0.15);
  ctx.strokeStyle = DIM;
  ctx.beginPath(); ctx.moveTo(h * 0.06, h * 0.2); ctx.lineTo(w - h * 0.06, h * 0.2); ctx.stroke();
}

/**
 * ★★ 열 — **두 줄이다** (v58 · docs/space/REAL.md §4-A).
 *
 *   위: **선체 온도** — 지금 뜨거운가. 자국이 여기서 난다
 *   아래: **열 저장고** — 배 안에 쌓인 총열. 안 버리면 안 준다
 *
 * ★ 왜 한 화면에 나란히 두나. **둘의 관계가 이 계통의 전부**이기 때문이다 —
 *   「냉각을 켜면 위가 내려가고 아래가 오른다」가 눈에 한 번에 들어와야
 *   「옮기는 것이지 없애는 것이 아니다」가 설명 없이 읽힌다. 따로 두면
 *   말이 되는 대신 **어려운** 것이 되고, 그러면 칸 두 개짜리 옛 규칙이
 *   차라리 나았다 (그게 이 판에서 제일 위험한 자리다).
 *
 * ★ 그리고 **「얼마나 더 숨을 수 있나」를 초로 적는다.** 숫자가 아니라
 *   시간이라야 판단이 된다 — 「저장고 62%」로는 아무것도 못 정한다
 */
function drawHeat(ctx, w, h, s) {
  bg(ctx, w, h);
  label(ctx, w, h, '열');
  const pad = h * 0.07, bw = w - pad * 2, bh = h * 0.13;

  // ── 위: 선체 온도 ─────────────────────────────────────
  const t = Math.max(0, Math.min(1, s.heat / 100));
  const hot = t > 0.62;
  const by = h * 0.26;
  ctx.fillStyle = hot ? '#ff6a4a' : '#5fe0a8';
  ctx.fillRect(pad, by, bw * t, bh);
  ctx.strokeStyle = DIM;
  ctx.strokeRect(pad, by, bw, bh);
  // 경고선 — 이 위로는 벽이 달아오른다
  ctx.strokeStyle = 'rgba(255,140,90,.85)';
  ctx.beginPath();
  ctx.moveTo(pad + bw * 0.62, by - h * 0.03); ctx.lineTo(pad + bw * 0.62, by + bh + h * 0.03); ctx.stroke();
  ctx.font = `600 ${Math.round(h * 0.095)}px system-ui, sans-serif`;
  ctx.fillStyle = hot ? '#ffb0a0' : DIM;
  ctx.fillText('선체', pad, by - h * 0.03);
  ctx.fillStyle = hot ? '#ffb0a0' : FG;
  ctx.font = `700 ${Math.round(h * 0.16)}px ui-monospace, monospace`;
  ctx.textAlign = 'right';
  ctx.fillText(String(Math.round(s.heat)), w - pad, by - h * 0.02);
  ctx.textAlign = 'left';

  // ── 아래: 열 저장고 ───────────────────────────────────
  const k = Math.max(0, Math.min(1, s.sink ?? 0));
  const full = s.sinkFull;
  const ky = h * 0.56;
  ctx.fillStyle = full ? '#ff6a4a' : k > 0.7 ? '#ffd27a' : '#7fa8d8';
  ctx.fillRect(pad, ky, bw * k, bh);
  ctx.strokeStyle = DIM;
  ctx.strokeRect(pad, ky, bw, bh);
  ctx.font = `600 ${Math.round(h * 0.095)}px system-ui, sans-serif`;
  ctx.fillStyle = full ? '#ffb0a0' : DIM;
  ctx.fillText('저장고', pad, ky - h * 0.03);
  ctx.textAlign = 'right';
  ctx.fillText(s.sinkWord ?? '', w - pad, ky - h * 0.03);
  ctx.textAlign = 'left';

  // ── 맨 아래 한 줄 — **판단에 쓰는 것은 이 줄이다** ────
  // ★ 글자가 **화면 밖으로 넘쳤다** (찍어 보고 알았다). 이 화면은 폭이
  //   0.94 뿐이라 열여덟 자쯤이 한계다 — 짧게 쓴다
  ctx.font = `600 ${Math.round(h * 0.115)}px system-ui, sans-serif`;
  if (full) {
    ctx.fillStyle = '#ff8a6a';
    ctx.fillText('저장고가 찼다 — 버려야 한다', pad, h * 0.9);
  } else if (s.cooling) {
    ctx.fillStyle = '#ffb060';
    ctx.fillText('버리는 중 — 눈에 띈다', pad, h * 0.9);
  } else {
    ctx.fillStyle = DIM;
    // ★ 「40분쯤」이 떴다 — 밟지 않으면 저장고가 거의 안 차기 때문인데,
    //   2시간짜리에서 40분은 「신경 안 써도 된다」와 같은 말이다.
    //   15분을 넘으면 **숫자를 안 센다** — 셀 필요가 없다는 뜻이니까
    const m = Math.max(0, Math.round((s.hide ?? 0) / 60));
    ctx.fillText(m > 15 ? '한참 숨을 수 있다' : m >= 1 ? `이대로 ${m}분 더 숨는다` : '곧 버려야 한다',
      pad, h * 0.9);
  }
}

/**
 * 전력 배분 — **실제로 켠 회로**를 보여준다.
 * 여기서 바꾸지는 못한다. 바꾸는 것은 통로의 차단기다 (PLAN §7-0).
 */
function drawPower(ctx, w, h, s) {
  bg(ctx, w, h);
  label(ctx, w, h, '전력 배분');
  const f = Math.round(h * 0.1);
  CIRCUITS.forEach((c, i) => {
    const on = s.power?.[c.key];
    const y = h * (0.3 + i * 0.22);
    ctx.fillStyle = on ? FG : 'rgba(127,212,255,.22)';
    ctx.font = `600 ${f}px system-ui, sans-serif`;
    ctx.fillText(c.name, h * 0.07, y + f);
    const bx = h * 0.42, bw = w - bx - h * 0.07, bh = h * 0.13;
    ctx.strokeStyle = DIM;
    ctx.strokeRect(bx, y, bw, bh);
    if (on) { ctx.fillStyle = '#5fe0a8'; ctx.fillRect(bx, y, bw, bh); }
    else {
      // 꺼진 것은 **무엇을 못 하는지**를 적어 준다. 규칙을 외우게 하지 않는다
      ctx.fillStyle = 'rgba(255,140,90,.75)';
      ctx.font = `600 ${Math.round(h * 0.085)}px system-ui, sans-serif`;
      ctx.fillText(c.off, bx + h * 0.05, y + bh * 0.85);
    }
  });
}

/**
 * ★★★ **레이더 — 화면 밖을 보는 유일한 계기** (v69 · docs/space/WAR.md §5-④)
 *
 *   사장님: 「**레이더도 만들고. 레이더 감지과 레이더 사운드도** 넣어줘」
 *          「**직관적으로 적에서 방향을 맞출 수 있도록**」
 *
 *   ★★ 왜 필요한가 — HUD 가 **26도**뿐이다 (v66 에서 F-16 Block 60 고증대로
 *     94도에서 줄였다). 표적은 이제 **사방(±180)** 에 뜬다. 그러면 옆과
 *     뒤에 있는 것은 **아무 데도 안 나온다** — 「직관적으로 방향을 맞춘다」의
 *     앞 절반이 통째로 빈다. 조준 보조(지시선·선도 점)는 **이미 어디 있는지
 *     알 때** 돕는 것이고, 레이더는 **어디 있는지를 알려주는** 것이다.
 *
 *   ★ **위에서 내려다본 원**이다. 가운데가 나, **위가 기수.**
 *     뒤에 있으면 원의 **아래쪽**에 찍힌다 — 그게 「바로 뒤로 선회」의 근거다.
 *     고도는 안 그린다: 두 축을 한 원에 그리면 둘 다 안 읽힌다.
 *     위아래는 HUD 가 맡는다 (거기는 각도 1:1 이다)
 *
 *   ★★ **두 겹이다** (`combat-table.js PASSIVE`)
 *     · 원뿔 안(±66도) — 밝은 점. **거리까지** 안다 (반지름이 곧 거리)
 *     · 원뿔 밖 — **엔진을 켠 것만** 흐린 점. 거리를 모르므로 **테두리**에
 *       붙여 그린다. 「저쪽에 뭔가 있다, 얼마나 먼지는 모른다」
 *     죽은 위성과 파편은 원뿔 밖에서 **안 보인다** — 열이 없다.
 *     그래서 등 뒤의 점 하나가 곧 **「적이다」**가 된다
 */
// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **레이더 계기** — 실제 레이더를 고증해서 다시 (v75)
//
//  사장님 「레이더 시스템을 더 **정교하게 직관적으로**. **오른쪽 왼쪽이
//          아니고.** 실제 레이더 시스템을 고증해서」
//
//  ★ v74 까지 이 계기가 말하는 것은 **방위 하나**였다. 세 축을 다 열어
//    놓고(v73 · 360도) 계기는 평면 하나였던 셈이라, 적이 아래에 있으면
//    「왼쪽」이라고만 떴다 — 어디로 기수를 돌릴지 알 수가 없었다.
//
//  ★★ 고증한 것 다섯을 넣는다 (`game/radar-table.js` 머리말):
//      ① 고리마다 **거리 숫자**
//      ② 점 옆에 **상대 고도** — PPI 에 못 담는 축이라 실제로도 숫자다
//      ③ 점 옆에 **접근율** — 부호 하나가 곧 추격 곡선이다
//      ④ **심볼로 상태를 나눈다** — 색만으로 나누면 어두울 때 죽는다
//      ⑤ ★★★ **RWR** — 저쪽이 나를 겨누면 그쪽에 경고가 뜬다
// ══════════════════════════════════════════════════════════════════════════
/** ★ v75 — 숫자를 적어 주는 접촉 수. 넷을 넘으면 글자가 겹쳐 하나도 안 읽힌다 */
const RADAR_READ_MAX = 4;

function drawRadar(ctx, w, h, s) {
  bg(ctx, w, h);
  label(ctx, w, h, '레이더');
  // ★★ v75 — **키웠다.** 화면을 찍어 보니 숫자 둘이 서로 겹쳐 못 읽었다.
  //   정교하게 만들려고 적은 숫자가 안 읽히면 그건 정교한 것이 아니다
  const cx = w / 2, cy = h * 0.54, R = Math.min(w * 0.36, h * 0.40);
  const f = (k) => Math.round(h * k);

  // 꺼져 있으면 **아무것도 안 그린다.** 전력 배분이 살아 있다
  if (!s.radar?.on) {
    ctx.fillStyle = 'rgba(255,140,90,.75)';
    ctx.font = `600 ${f(0.11)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('능동 탐지 꺼짐', cx, cy);
    ctx.textAlign = 'left';
    return;
  }

  // ── 고리 · 눈금 ──────────────────────────────────────
  // ★ ① **고리마다 거리를 적는다** (고증). 안 적으면 「가운데에 가깝다」
  //   까지만 알고 몇 미터인지 모른다 — 실제 스코프는 반드시 적는다
  ctx.strokeStyle = DIM;
  ctx.lineWidth = 1.5;
  ctx.font = `600 ${f(0.052)}px ui-monospace, monospace`;
  ctx.textAlign = 'left';
  for (const k of RINGS) {
    ctx.beginPath(); ctx.arc(cx, cy, R * k, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(143,230,192,.42)';
    ctx.fillText(`${Math.round(RADAR.range * k)}`, cx + 3, cy - R * k - 2);
  }
  ctx.beginPath();
  ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
  ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
  ctx.stroke();

  // ★★ **원뿔을 칠한다** — 「여기까지가 잘 보이는 데」가 그림으로 보여야
  //   점이 밝은지 흐린지의 뜻이 산다
  const cone = (RADAR.az * Math.PI) / 180;
  ctx.fillStyle = 'rgba(95,224,168,.10)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, R, -Math.PI / 2 - cone, -Math.PI / 2 + cone);
  ctx.closePath();
  ctx.fill();

  // 기수 표시 — 작은 세모
  ctx.fillStyle = FG;
  ctx.beginPath();
  ctx.moveTo(cx, cy - R - f(0.05));
  ctx.lineTo(cx - f(0.035), cy - R - f(0.005));
  ctx.lineTo(cx + f(0.035), cy - R - f(0.005));
  ctx.closePath();
  ctx.fill();

  // ── 점들 ─────────────────────────────────────────────
  const blips = s.radar.blips ?? [];
  // ══ ★★ **디클러터** — 숫자는 몇 개만 적는다 ═══════════════════════
  //
  //  ★ 화면을 찍어 보니 접촉 여섯에 숫자를 다 적으니 **서로 겹쳐서 하나도
  //    안 읽혔다.** 정교하게 만들려고 적은 숫자가 안 읽히면 그건 정교한
  //    것이 아니라 그냥 지저분한 것이다.
  //  ★★ 실제 스코프도 그래서 **디클러터**를 한다 — 전부 적지 않고
  //    가까운 것·물린 것부터 적는다. 「우선순위 표적」이라는 말이 그것이다.
  const readable = new Set(
    blips
      .filter((b) => b.level === 'full')
      .sort((x, y) => (y.locked ? 1 : 0) - (x.locked ? 1 : 0) || x.dist - y.dist)
      .slice(0, RADAR_READ_MAX)
      .map((b) => b.id),
  );
  for (const b of blips) {
    // ★ 화면 각 = 상대 방위. 0 이 위(기수), 시계 방향
    const a = (b.relAz * Math.PI) / 180 - Math.PI / 2;
    const rr = b.level === 'full' ? R * Math.min(1, b.dist / RADAR.range) : R * 0.97;
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;

    // ★ ④ **심볼로 나눈다.** 원뿔 밖(수색)은 **빈 고리** — 「있는 줄만
    //   안다」가 모양으로 보인다. 채워 그리면 아는 것처럼 보인다
    // ══ ★★★ **소속을 모양으로 가른다** (v80) ═══════════════════════
    //  ★ 사장님 「**적이 뭔지 물체가 뭔지 알 수가 없네**」.
    //    v79 까지 모양은 **「얼마나 잘 아는가」**만 말했다 (수색/추적/락온).
    //    그건 레이더 기술자의 관심사이고, 조종사가 묻는 것은 **「저게 나를
    //    죽이나」** 하나다. 실제 전술 심볼로지도 **소속을 모양으로** 가른다
    //    (적대는 뾰족하게, 중립은 둥글게 — 색맹인 사람에게도 읽히라고).
    if (b.level === 'blip') {
      // 원뿔 밖 — **미확인.** 네모난 것이 「아직 뭔지 모른다」다
      const m0 = MARK.unknown;
      const q0 = f(m0.size);
      ctx.strokeStyle = m0.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(px - q0, py - q0, q0 * 2, q0 * 2);
      continue;
    }
    const mk = b.foe ? MARK.foe : MARK.thing;
    const q = f(mk.size);
    ctx.fillStyle = mk.color;
    if (mk.shape === 'wedge') {
      // ▽ — 적. 뾰족한 것이 위험한 것이다
      ctx.beginPath();
      ctx.moveTo(px - q, py - q * 0.8);
      ctx.lineTo(px + q, py - q * 0.8);
      ctx.lineTo(px, py + q);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(px, py, q, 0, Math.PI * 2); ctx.fill();
    }

    // ★★★ ②③ **점 옆에 두 줄** — 여기가 「오른쪽 왼쪽이 아니고」의 답이다.
    //   고도는 PPI 에 담을 수 없는 축이라 숫자로 내고, 접근율은 실제
    //   스코프가 늘 적는 값이다. 둘 다 **원뿔 안일 때만** — 원뿔 밖에서
    //   거리를 아는 척하면 그건 레이더가 아니라 전지(全知)다
    // ★★★ **점 옆에는 고도 하나만** — 여기가 「오른쪽 왼쪽이 아니고」의 답이다.
    //   PPI 는 세로축이 거리라 고도를 담을 데가 없으므로 숫자로 낸다.
    //   ★ 접근율까지 점 옆에 적었더니 **글자 둘이 서로 겹쳐 하나도 안
    //     읽혔다** (화면을 찍어서 알았다). 자세한 것은 아래 **데이터 블록**이
    //     맡는다 — 실제 스코프가 우선순위 표적 하나에 그렇게 한다
    // ★★★ v80 — **이름을 적는다.** 모양을 외우게 하는 것보다 「요격기」라고
    //   적는 편이 빠르다. 계기가 사람에게 맞추는 것이지 그 반대가 아니다.
    //   ★ 디클러터 안에 든 것만 — 전부 적으면 겹쳐서 하나도 안 읽힌다
    //     (v75 에 숫자 둘로 그 꼴을 이미 겪었다)
    if (readable.has(b.id)) {
      const rt = px > cx ? 'left' : 'right';
      const dx = px + (px > cx ? f(0.05) : -f(0.05));
      ctx.textAlign = rt;
      ctx.font = `700 ${f(0.058)}px system-ui, sans-serif`;
      ctx.fillStyle = mk.color;
      ctx.fillText(KINDS[b.kind]?.name ?? '?', dx, py - f(0.01));
      // ★ `elWord` 는 **수평이면 null 을 준다** (`READ.elMin` 4도 아래).
      //   그대로 그렸더니 점 밑에 **「null」이라고 찍혔다** — 화면을 찍어서
      //   알았다. 없을 때는 「수평」이라고 적는다 (아랫줄 데이터 블록과 같은 말)
      ctx.font = `700 ${f(0.052)}px ui-monospace, monospace`;
      ctx.fillStyle = 'rgba(220,245,235,.86)';
      ctx.fillText(elWord(b.relEl) ?? '수평', dx, py + f(0.062));
      ctx.textAlign = 'left';
    }

    // 물린 것은 **마름모로 감싼다** — 네모(TD 상자)와 갈라 둔다
    if (b.locked) {
      const q = f(SYMBOL.lock.size);
      ctx.strokeStyle = SYMBOL.lock.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(px, py - q); ctx.lineTo(px + q, py);
      ctx.lineTo(px, py + q); ctx.lineTo(px - q, py);
      ctx.closePath(); ctx.stroke();
    }
  }

  // ══ ★★ **데이터 블록** — 우선순위 표적 하나를 자세히 ════════════════
  //
  //  실제 사격통제 스코프는 **물린 표적 하나**에만 상세를 적는다
  //  (종류 · 방위 · 고도 · 거리 · 접근율). 전부 적으면 겹쳐서 하나도
  //  안 읽히기 때문이다 — 화면을 찍어 그걸 그대로 겪었다.
  //  ★ 물린 것이 없으면 **제일 가까운 것**을 쓴다. 빈 칸으로 두면
  //    계기가 절반만 사는 것이고, 대개 제일 가까운 것이 제일 급하다
  // ══ ★★★ **범례** — 판 안에 늘 있다 (v80) ═══════════════════════════
  //  ★ 사장님 「**튜토리얼이 필요한것 같아. 툴팁이나**」.
  //    한 번 알려 주고 마는 것보다 **계기에 늘 적혀 있는** 편이 낫다 —
  //    2시간짜리에서 30분 전에 본 설명은 없는 것과 같다. 이 저장소가
  //    「문서는 낡아도 조용하다」로 여러 번 겪은 것과 같은 이야기다
  {
    ctx.font = `700 ${f(0.050)}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    // ★ **맨 아래**에 둔다. 처음에 판 위쪽(0.215)에 뒀더니 **점 이름과
    //   겹쳤다** — 화면을 찍어서 알았다. 스코프 원이 판을 세로로 거의 다
    //   먹으므로 글자를 놓을 수 있는 데는 **맨 위와 맨 아래**뿐이고,
    //   맨 위는 제목과 고리 숫자가 쓴다
    let lx = w * 0.04;
    const ly = h * 0.978;
    for (const g of LEGEND) {
      const col = g.key === 'lock' ? SYMBOL.lock.color : (MARK[g.key]?.color ?? DIM);
      ctx.fillStyle = col;
      ctx.fillText(g.mark, lx, ly);
      ctx.fillStyle = 'rgba(200,230,220,.62)';
      ctx.fillText(g.what, lx + f(0.055), ly);
      lx += f(0.055) + ctx.measureText(g.what).width + f(0.045);
    }
  }

  const prime = blips.filter((x) => x.level === 'full')
    .sort((x, y) => (y.locked ? 1 : 0) - (x.locked ? 1 : 0) || x.dist - y.dist)[0];
  if (prime) {
    ctx.font = `700 ${f(0.062)}px ui-monospace, monospace`;
    ctx.textAlign = 'left';
    ctx.fillStyle = prime.locked ? SYMBOL.lock.color : 'rgba(143,230,192,.72)';
    const nm = KINDS[prime.kind]?.name ?? '표적';
    ctx.fillText(`${prime.locked ? '◆' : '·'} ${nm}`, w * 0.04, h * 0.845);
    ctx.fillStyle = 'rgba(220,245,235,.86)';
    const vc = vcWord(prime.closing);
    ctx.fillText(
      `방위 ${bearing(prime.relAz)}  ${elWord(prime.relEl) ?? '수평'}  ${Math.round(prime.dist)}m${vc ? `  ${vc}` : ''}`,
      w * 0.04, h * 0.905,
    );
  }

  // ── ★★★ ⑤ RWR — **저쪽이 나를 겨눈다** ───────────────────────────
  //  실제 전투기의 레이더 경고 수신기다. v74 까지 이게 없어서 **맞기
  //  전까지 아무 예고가 없었다** — 적은 겨눔을 쌓고 나서 쏘는데
  //  (`target.js` 의 `t.aim`) 그 시간이 화면에 하나도 안 나왔다.
  //  ★ 다만 알려 주는 것은 **방위뿐**이다. 피하는 것은 여전히 손이고,
  //    「알고도 못 피한다」가 있어야 긴박하다
  //  ★★ 처음엔 **원 바깥에** 쐐기를 세웠다. 이 계기는 가로로 넓고 세로가
  //    짧아서 원 위아래로는 **자리가 없다** — 화면을 찍으니 쐐기가 판
  //    밖으로 나가 하나도 안 보였다. 그래서 **접촉 바로 옆**에 붙인다.
  //    실제 RWR 은 별개 화면이지만, 계기가 하나뿐인 배에서는 「이 놈이
  //    나를 겨눈다」를 **그 점에 붙여 두는 것**이 더 곧다
  let worst = 0;
  for (const b of blips) {
    const lv = rwrLevel(b.aiming ?? 0);
    if (!lv) continue;
    worst = Math.max(worst, b.aiming);
    const now = s.radar.clock ?? 0;
    // ★ `s.clock` 이라고 썼다가 **깜빡임이 영영 멈춰 있었다** — 시계를
    //   `s.radar.clock` 에 담아 놓고 한 칸 위에서 읽었다. 값이 늘
    //   undefined → 0 이라 `sin(0)=0`, 즉 경고가 한 번도 안 켜졌다
    const on = lv === 'hot'
      ? (Math.sin(now * RWR.blink * 2.2) > -0.2)
      : (Math.sin(now * RWR.blink) > 0);
    if (!on) continue;
    const a = (b.relAz * Math.PI) / 180 - Math.PI / 2;
    const rr = b.level === 'full' ? R * Math.min(1, b.dist / RADAR.range) : R * 0.97;
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
    // 점을 **감싸는 붉은 고리** + 바깥을 가리키는 쐐기
    ctx.strokeStyle = SYMBOL.threat.color;
    ctx.lineWidth = lv === 'hot' ? 3 : 2;
    ctx.beginPath(); ctx.arc(px, py, f(SYMBOL.threat.size), 0, Math.PI * 2); ctx.stroke();
    const q = f(SYMBOL.threat.size);
    ctx.fillStyle = SYMBOL.threat.color;
    ctx.beginPath();
    ctx.moveTo(px + Math.cos(a) * q * 2.0, py + Math.sin(a) * q * 2.0);
    ctx.lineTo(px + Math.cos(a - 0.6) * q * 1.1, py + Math.sin(a - 0.6) * q * 1.1);
    ctx.lineTo(px + Math.cos(a + 0.6) * q * 1.1, py + Math.sin(a + 0.6) * q * 1.1);
    ctx.closePath(); ctx.fill();
  }
  if (worst >= RWR.from) {
    ctx.fillStyle = worst >= RWR.hot ? SYMBOL.threat.color : 'rgba(255,150,90,.85)';
    // ★ 데이터 블록과 **안 겹치는 자리**로 — 둘 다 아래에 두면 서로 먹는다
    ctx.font = `800 ${f(0.072)}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    // ★★ v80 — **군용 약어를 풀어 쓴다.** 사장님이 화면의 「피조준」을
    //   보시고 「직관적이지 않다」고 하셨다. 아는 사람만 읽는 말은
    //   계기에 안 적는다 (`radar-table.js PLAIN`)
    ctx.fillText(worst >= RWR.hot ? '적이 나를 조준 — 쏜다' : PLAIN.threat, w * 0.96, h * 0.26);
    ctx.textAlign = 'left';
  }
}

/**
 * 선체 도면 — **방 일곱이 다 보이고, 내가 있는 칸이 켜진다.**
 *
 * ★ 두 가지가 틀려 있었다 (v21 · 「조종석은 어딨고?」를 듣고 찾음)
 *   ① 방을 **셋만** 그렸다 (조종석·통로·기관실). 관측실·정비실·온실·
 *      에어록은 도면에 아예 없어서, 정작 찾아가야 하는 방들이 안 보였다
 *   ② `'corridor'` 와 견주고 있었는데 통로의 열쇠는 `'spine'` 이다
 *      (`'corridor'` 는 tone 값이다). **통로 칸이 영원히 안 켜졌다** —
 *      배에서 제일 오래 서 있는 방인데
 *
 * ★ 좌표를 **배에서 받아 온다.** 여기 사각형을 손으로 적어 두면 방을
 *   옮길 때마다 어긋나고, 그건 「도면이 거짓말을 한다」가 된다.
 *   화면이 가로로 넓으므로 **배를 눕혀** 그린다 — 앞(조종석)이 왼쪽.
 */
let PLAN = [];
export function setPlan(rooms) { PLAN = rooms; }

function drawShip(ctx, w, h, s) {
  bg(ctx, w, h);
  label(ctx, w, h, '선체');
  if (!PLAN.length) return;
  const pad = h * 0.1;
  const top = h * 0.26, bot = h - pad;
  const z0 = Math.min(...PLAN.map((r) => r.z0)), z1 = Math.max(...PLAN.map((r) => r.z1));
  const x0 = Math.min(...PLAN.map((r) => r.x0)), x1 = Math.max(...PLAN.map((r) => r.x1));
  // 배의 z(앞뒤) → 화면 가로, 배의 x(좌우) → 화면 세로
  const sx = (w - pad * 2) / (z1 - z0), sy = (bot - top) / (x1 - x0);
  ctx.font = `600 ${Math.round(h * 0.075)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const r of PLAN) {
    const px = pad + (r.z0 - z0) * sx, pw = (r.z1 - r.z0) * sx;
    const py = top + (r.x0 - x0) * sy, ph = (r.x1 - r.x0) * sy;
    const here = s.room === r.key;
    ctx.strokeStyle = here ? '#5fe0a8' : DIM;
    ctx.lineWidth = here ? 3 : 1.5;
    ctx.strokeRect(px, py, pw, ph);
    if (here) { ctx.fillStyle = 'rgba(95,224,168,.18)'; ctx.fillRect(px, py, pw, ph); }
    // 이름을 적는다. **칸만 그리면 어느 칸이 어느 방인지 모른다**
    ctx.fillStyle = here ? '#8ff0c4' : 'rgba(150,175,200,.7)';
    ctx.fillText(r.name, px + pw / 2, py + ph / 2);
  }
}

/**
 * 항로 — 평온할 때는 「어디쯤 왔나」, **추격 중에는 거리**다.
 * 화면을 하나 더 만드는 대신 하나가 두 일을 한다 — 조종석은 이미 빽빽하고,
 * 급할 때 봐야 할 것이 흩어져 있으면 못 읽는다.
 */
function drawCourse(ctx, w, h, s) {
  bg(ctx, w, h);
  // ★ 위험 지대가 제일 급하다 — 있으면 이 화면이 그걸 맡는다.
  //   화면을 하나 더 만들지 않는다. 조종석은 이미 빽빽하고, 급할 때 봐야 할
  //   것이 흩어져 있으면 못 읽는다 (아래 「하나가 두 일을 한다」와 같은 이유)
  if (s.hazPhase === 'warn' || s.hazPhase === 'run') {
    const warning = s.hazPhase === 'warn';
    label(ctx, w, h, warning ? '전방 잔해' : '잔해 지대');
    const f = (k) => Math.round(h * k);
    if (warning) {
      ctx.fillStyle = '#ffb060';
      ctx.font = `700 ${f(0.34)}px ui-monospace, monospace`;
      ctx.fillText(`${Math.ceil(s.hazWarn)}`, h * 0.07, h * 0.78);
      ctx.font = `600 ${f(0.11)}px system-ui, sans-serif`;
      ctx.fillStyle = DIM;
      ctx.fillText('초 뒤 · 조종간을 잡으십시오', h * 0.07 + w * 0.2, h * 0.74);
      return;
    }
    // 지나가는 중 — **배의 자리와 덩어리의 자리**를 나란히 보여준다
    const cx = w / 2, y = h * 0.55, half = w * 0.4;
    ctx.strokeStyle = DIM; ctx.lineWidth = Math.max(1, h * 0.012);
    ctx.beginPath(); ctx.moveTo(cx - half, y); ctx.lineTo(cx + half, y); ctx.stroke();
    const inc = s.incoming;
    if (inc) {
      const safe = (s.clearBy ?? 1) >= 0.46;
      ctx.fillStyle = safe ? '#5fe0a8' : '#ff6a4a';
      ctx.beginPath(); ctx.arc(cx + inc.lane * half, y, h * 0.09, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = safe ? '#5fe0a8' : '#ff6a4a';
      ctx.font = `700 ${f(0.14)}px ui-monospace, monospace`;
      ctx.fillText(`${inc.in.toFixed(1)}초 · ${inc.left}개 남음`, h * 0.07, h * 0.94);
    }
    // 배 — 삼각형
    ctx.fillStyle = '#ffffff';
    const px = cx + (s.lane ?? 0) * half;
    ctx.beginPath();
    ctx.moveTo(px, y + h * 0.1); ctx.lineTo(px - h * 0.06, y + h * 0.22);
    ctx.lineTo(px + h * 0.06, y + h * 0.22); ctx.closePath(); ctx.fill();
    return;
  }
  if (s.chase?.phase === 'chase') {
    label(ctx, w, h, '거리');
    // ★ 못 읽는 이유가 둘이다. **둘을 갈라 말한다** — 「센서 꺼짐」과
    //   「성운이라 안 읽힘」은 대응이 정반대다. 하나로 뭉치면 차단기를
    //   만지러 통로까지 헛걸음한다
    if (!s.power?.sensor || s.blind) {
      ctx.fillStyle = 'rgba(255,140,90,.8)';
      ctx.font = `700 ${Math.round(h * 0.16)}px system-ui, sans-serif`;
      ctx.fillText(s.blind ? '성운 · 안 읽힘' : '센서 꺼짐', h * 0.07, h * 0.62);
      return;
    }
    const d = Math.max(0, Math.min(1, s.chase.dist / 100));
    const pad = h * 0.07, bw = w - pad * 2, by = h * 0.32, bh = h * 0.22;
    ctx.strokeStyle = DIM; ctx.strokeRect(pad, by, bw, bh);
    ctx.fillStyle = d > 0.6 ? '#5fe0a8' : d > 0.3 ? '#ffd27a' : '#ff6a4a';
    ctx.fillRect(pad, by, bw * d, bh);
    ctx.fillStyle = FG;
    ctx.font = `700 ${Math.round(h * 0.2)}px ui-monospace, monospace`;
    ctx.fillText(String(Math.round(s.chase.dist)), pad, h * 0.92);
    ctx.font = `600 ${Math.round(h * 0.1)}px system-ui, sans-serif`;
    ctx.fillStyle = DIM;
    ctx.fillText('100 이면 뿌리친다', w * 0.34, h * 0.92);
    return;
  }
  label(ctx, w, h, '항로');
  ctx.strokeStyle = DIM;
  ctx.beginPath(); ctx.moveTo(h * 0.07, h * 0.62); ctx.lineTo(w - h * 0.07, h * 0.62); ctx.stroke();
  for (let i = 0; i <= 6; i++) {
    const x = h * 0.07 + ((w - h * 0.14) * i) / 6;
    ctx.beginPath(); ctx.moveTo(x, h * 0.55); ctx.lineTo(x, h * 0.69); ctx.stroke();
  }
  // ★ 전에는 `t * 0.012` 로 **그냥 흘렀다** — 어디에도 안 닿는 눈금이었다.
  //   지금은 진짜 항로 진행이다 (game/route.js). 가짜 계기는 한 번 들키면
  //   나머지 계기까지 안 믿게 된다
  const p = Math.max(0, Math.min(1, s.progress ?? 0));
  ctx.fillStyle = s.atPort ? '#ffffff' : '#5fe0a8';
  ctx.beginPath(); ctx.arc(h * 0.07 + (w - h * 0.14) * p, h * 0.62, h * 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = DIM;
  ctx.font = `600 ${Math.round(h * 0.1)}px system-ui, sans-serif`;
  ctx.fillText(s.atPort ? '거점 · 항로를 고르십시오' : `다음 거점까지 · 남은 ${s.legsLeft ?? '?'}`, h * 0.07, h * 0.94);
  // 지금 어느 구역인가 — 창밖이 왜 저 색인지 여기서 확인된다
  const rg = REGIONS.find((x) => x.key === s.region);
  if (rg) {
    ctx.fillStyle = '#5fe0a8';
    ctx.textAlign = 'right';
    ctx.fillText(rg.name, w - h * 0.07, h * 0.94);
    ctx.textAlign = 'left';
  }
}

/**
 * 자국 — 얼마나 눈에 띄나. **판단의 근거라 숫자로 보여준다** (PLAN §6 ★).
 *
 * 다만 **센서를 끄면 못 본다.** 그게 「센서를 끈다」의 진짜 대가다 —
 * 자국이 줄어드는 게 아니라 **내가 안 보이게 된다.**
 */
function drawSign(ctx, w, h, s) {
  bg(ctx, w, h);
  label(ctx, w, h, '자국');
  const cx = w / 2, cy = h * 0.6, r = Math.min(w, h) * 0.3;
  ctx.strokeStyle = DIM;
  for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(cx, cy, (r * i) / 3, 0, Math.PI * 2); ctx.stroke(); }

  if (!s.power?.sensor) {
    ctx.fillStyle = 'rgba(255,140,90,.8)';
    ctx.font = `700 ${Math.round(h * 0.14)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('센서 꺼짐', cx, cy + h * 0.05);
    ctx.textAlign = 'left';
    return;
  }
  // ★ 접촉 기준은 이제 **고정이 아니다.** 항로의 압박이 끌어내린다
  //   (game/route-table.js). 원이 조여 오는 것이 눈에 보여야 한다
  const at = s.contactAt ?? SIGN.contactAt;
  const v = Math.min(1, (s.chase?.sign ?? 0) / SIGN.max);
  const over = (s.chase?.sign ?? 0) > at;
  ctx.fillStyle = over ? 'rgba(255,110,80,.55)' : 'rgba(95,224,168,.42)';
  ctx.beginPath(); ctx.arc(cx, cy, r * v, 0, Math.PI * 2); ctx.fill();
  // 접촉 기준선 — 이 안쪽이면 안전하다는 것이 눈에 보여야 한다
  ctx.strokeStyle = 'rgba(255,140,90,.9)';
  ctx.beginPath(); ctx.arc(cx, cy, r * (at / SIGN.max), 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = over ? '#ffb0a0' : FG;
  ctx.font = `700 ${Math.round(h * 0.16)}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(s.chase?.sign ?? 0)), cx, h * 0.96);
  ctx.textAlign = 'left';
}

/** 잡다한 기록 — 배가 「돌아가고 있다」는 느낌은 이런 데서 온다 */
function drawLog(ctx, w, h, s) {
  bg(ctx, w, h);
  label(ctx, w, h, '기록');
  const lines = [
    '순환 펌프 3 — 압력 낮음',
    '격벽 B — 이상 없음',
    '냉매 잔량 74%',
    '외부 온도 -211',
    '수신 없음',
  ];
  ctx.font = `600 ${Math.round(h * 0.1)}px ui-monospace, monospace`;
  lines.forEach((t, i) => {
    const on = ((s.t * 0.9 + i * 3) | 0) % 11 !== 0;   // 가끔 깜빡인다
    ctx.fillStyle = on ? DIM : 'rgba(127,212,255,.75)';
    ctx.fillText(t, h * 0.07, h * (0.32 + i * 0.14));
  });
}

/**
 * 조종석을 짓는다.
 * @param room 조종석 사각형 (world/ship.js ROOMS)
 * @param H 천장 높이
 */
export function buildCockpit(parent, room, H) {
  const g = new THREE.Group();
  parent.add(g);
  const screens = [];

  // ══ ★★★ **캐노피 — 유리가 천장까지 올라간다** (v66) ══════════════
  //  v65 까지 유리 위끝이 2.62 였고 그 위로 **「위 선체띠 + 위 창틀」**이
  //  한 줄 둘려 있었다. 즉 창의 **위쪽이 잘려** 있었고, 그 바로 위가
  //  머리 위 창이라 「유리 — 쇠띠 — 유리」로 끊겼다.
  //  실제 버블 캐노피는 안 끊긴다 (F-16 은 조종사 앞에 활대가 아예 없다).
  //  이제 정면은 **바닥 0.45 에서 천장까지 유리 한 장**이고, 천장에서
  //  머리 위 창이 이어받는다.
  for (let i = 0; i < CANOPY.length - 1; i++) {
    const a = CANOPY[i], b = CANOPY[i + 1];
    pane(g, a, b, SILL, HEAD, GLASS);                 // 유리 — 천장까지
    pane(g, a, b, 0, SILL, PANEL, 0.14);              // 아래 선체
    rail(g, a, b, SILL - 0.06, FRAME, 0.2, 0.14);     // 아래 창틀
    // ★ 띠조명을 **창턱으로 내렸다.** 위에 있으면 그게 곧 「위를 자르는 것」
    //   이다 — 눈 아래에서 유리를 훑는 편이 실제 조종석 조명과도 맞다
    rail(g, a, b, SILL + 0.05, stripMat(BLUE), 0.05, 0.035, 0.02);
  }
  // 창 사이 기둥(멀리언) — 없으면 창이 한 장짜리로 보인다.
  // ★★ **전부 `CLEAR.yaw`(60도) 밖에 선다** — 앞 것이 ±2.05 로 밀려난
  //   이유가 그것이다 (v65 는 ±1.05 = 43도라 정면 안쪽이었다)
  for (const p of CANOPY) {
    box(g, 0.16, H, 0.16, FRAME, p[0], H / 2, p[1]);
  }

  // ── 머리 위 창 ────────────────────────────────────────
  // ★ 자리는 `view-table.js ROOF` 가 정한다 — 검사가 「유리 위끝에서
  //   이어받나」를 물으려면 그 값을 알아야 한다
  const roofW = ROOF.x1 - ROOF.x0, roofD = ROOF.z1 - ROOF.z0;
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(roofW, roofD), GLASS);
  roof.rotation.x = Math.PI / 2;
  roof.position.set((ROOF.x0 + ROOF.x1) / 2, H - 0.02, (ROOF.z0 + ROOF.z1) / 2);
  g.add(roof);
  // ★★★ **12시를 비운다.** 구조재의 자리는 `STRUCTS` 가 말하고,
  //   `space-view.js` 가 그 목록을 통째로 훑어 정면 원뿔을 지킨다.
  //   v65 는 여기서 `x = 0` 리브를 지웠는데 **진짜 기둥은 ship.js 에**
  //   있었다 — 한 파일만 보면 못 잡는다
  for (const s of STRUCTS) box(g, s.w, s.h, s.d, FRAME, s.x, s.y, s.z);
  box(g, roofW * 0.9, 0.04, 0.05, stripMat(BLUE), 0, H - 0.15, ROOF.z1 - 0.08);

  // ── 천장 리브 ─────────────────────────────────────────
  // 민판 천장이 제일 싸구려로 보인다. 구조재를 지르면 배가 된다
  // ★ v66 — 첫 리브가 z −7.4 였는데 그건 **머리 위 창 구멍 안**이다.
  //   유리를 가로지르는 쇠막대가 된다. 구멍 뒤(−7.05)에서 시작한다
  for (let i = 0; i < 4; i++) {
    const z = -7.05 + i * 1.05;
    box(g, 6.0, 0.16, 0.18, FRAME, 0, H - 0.09, z);
    box(g, 5.4, 0.035, 0.05, stripMat(BLUE), 0, H - 0.19, z + 0.11);
  }
  // 배관 두 줄이 천장을 따라 지나간다
  for (const x of [-2.35, 2.35]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6.0, 10), DARK);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(x, H - 0.28, -6.3);
    g.add(pipe);
  }

  // ── 옆벽 패널 ─────────────────────────────────────────
  // 벽을 쪼갠다. 같은 색이라도 틈이 있으면 「만든 물건」으로 보인다
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const z = -6.9 + i * 1.15;
      box(g, 0.06, 1.5, 0.95, PANEL, sx * 2.95, 1.35, z);
      box(g, 0.05, 0.035, 0.8, stripMat(AMBER), sx * 2.9, 0.62, z);
    }
  }

  // ── 콘솔 · 화면 ───────────────────────────────────────
  // 참고 사진의 핵심. 화면이 여럿이고 **그게 빛난다**
  // ══ ★★ **콘솔을 다시** (v61 · 사장님 「조종석 계기판이나 스크린 모니터
  //    등도 고증해서 직관적으로 다시 설계해」) ══════════════════════════
  //
  //  ★ 무엇이 틀려 있었나 — **화면이 허공에 떠 있었다.**
  //    콘솔 몸통은 0~0.86, 상판은 0.88, 그런데 화면은 1.16 에 있었다.
  //    사이 **28cm 가 텅 비어** 있어서, 여섯 장이 어디에도 안 붙은 채
  //    공중에 걸린 것으로 보였다. 조종간이 뜬 것과 같은 병이다.
  //
  //  ★ 고증 (REALSHIP.md §3 · 크루 드래건)
  //    「큰 터치스크린 셋 + 물리 버튼 약 30개. 버튼 상당수가 **투명 덮개
  //     아래**. 한가운데 **큰 물리 레버**」
  //    → 화면은 **대시에 박혀 있고**, 그 아래에 **물리 스위치 띠**가 있고,
  //      가운데는 손잡이 몫으로 비운다.
  //
  //  그래서 층이 넷이 된다 — 아래에서 위로:
  //    ① 무릎 가림판 (0~0.58)   다리가 들어가는 자리는 비운다
  //    ② 스위치 선반 (0.58~0.84) **물리 버튼이 사는 층**
  //    ③ 대시 얼굴  (0.84~1.30) **화면이 여기 박힌다** (가운데 1.00)
  //    ④ 눈썹 차양  (1.12)      빛을 막는다. 화면이 창빛에 안 씻긴다
  //
  //  ★★★ **v63 에서 통째로 17cm 내렸다** (사장님 「앉기만 하니깐 우주가
  //     안보여서 운전을 못하고」).
  //
  //     v61 이 앉은 눈을 1.20 으로 못박아 놓고 **콘솔은 안 옮겼다.**
  //     그래서 대시 얼굴(1.17)과 눈썹 차양(1.47)이 **앉은 눈 높이와
  //     그 위**에 있었다 — 앉으면 눈앞이 계기고, 창은 그 위 좁은 띠였다.
  //
  //     DEP 로 짓는다는 것은 눈높이만 정하는 것이 아니라 **눈 아래로
  //     계기를 내리는 것**까지다. 실제 조종석의 눈썹 차양은 DEP 보다
  //     5~10cm **아래**에 있고, 조종사는 그 위로 밖을 본다.
  //     지금 차양이 1.12 이고 앉은 눈이 1.20 이므로 **8cm 아래**다.
  //
  //     ★ v61 에서 「28cm 구멍을 네 겹으로 메웠다」고 적었는데, 그 네 겹의
  //       **높이가 틀렸던 것**이다. 겹의 수가 아니라 자리가 문제였다.
  //  ★★★ **v66 — 계기판이 좁아지고, 가운데가 비고, 위끝이 곡면이 됐다**
  //
  //   ① **좁아졌다** (±2.30 → ±1.55). 실제 전투기의 주계기판은 폭 0.5m
  //      남짓이다 (F-16 은 125mm MFD 셋). 4.6m 짜리는 조종석이 아니라
  //      관제실이고, 무엇보다 **바깥쪽이 시야를 먹고 있었다**
  //   ② **가운데 칸을 비운다** (`PANEL_GAP`). 조종간이 그 앞에 서 있어
  //      화면을 박아 봐야 절반이 가린다 — F-15 · F-22 · Su-27 이
  //      가운데 조종간을 쓰면서 계기판을 좌우로 가르는 이유가 이것이다.
  //      그 자리는 **HUD** 몫이다
  //   ③ **위끝이 자리마다 다르다** (`browSeg`). 높이를 하나로 두면 바깥쪽이
  //      **눈에는 더 높아 보인다** — 같은 높이라도 멀면 내려다보는 각이
  //      얕아지기 때문이다. 실제 차양이 좌우로 갈수록 뚝 떨어지는 이유고,
  //      검사가 이걸로 두 번 잡아 줬다
  const CONSOLE = CONSOLE_PTS;
  /** 이 칸의 차양 높이 · 대시 · 선반 — 전부 위끝에서 내려온다 */
  const layers = (a, b) => {
    const top = browSeg(a, b);
    return { top, faceLo: top - FACE_H, shelfLo: top - FACE_H - SHELF_H };
  };
  for (let i = 0; i < CONSOLE.length - 1; i++) {
    const a = CONSOLE[i], b = CONSOLE[i + 1];
    const L = layers(a, b);
    pane(g, a, b, 0, L.shelfLo, DARK, 0.44);              // ① 무릎 가림판
    pane(g, a, b, L.shelfLo, L.faceLo, PANEL, 0.52);      // ② 스위치 선반
    rail(g, a, b, L.faceLo, FRAME, 0.54, 0.05);           // 선반 테
    // ③ **대시 얼굴** — 화면이 박히는 판. 가운데 칸에는 안 세운다
    if (i !== PANEL_GAP) {
      const s0 = seg(a, b);
      const face = new THREE.Mesh(new THREE.BoxGeometry(s0.len, FACE_H, 0.07), DARK);
      face.position.set(s0.mx, L.top - FACE_H / 2, s0.mz + 0.10);
      face.rotation.y = s0.rot;
      face.rotateX(-0.36);
      g.add(face);
    }
    // ④ **눈썹 차양** — 창빛을 막는다. **이 선이 곧 기수 너머 17도**다
    rail(g, a, b, L.top, FRAME, 0.30, 0.06, 0.12);
  }

  /** 항로 갈래 판 둘 — 안쪽 계기 화면 위에 얹힌다 (아래 루프에서 채운다) */
  const plates = [];
  // ★ 화면 **넷** — 가운데를 비웠으므로 다섯이 아니다.
  //   밀려난 **자국**은 HUD 로 올렸다 (`world/gunsight.js`) — 자국은 모는
  //   동안 보는 것이라 원래 거기 있어야 했다
  // ★★ **v69 — 안쪽 왼쪽 칸이 레이더가 됐다.** 격추 게임에서 「어디에
  //   있나」보다 자주 보는 계기는 없고, 안쪽 두 칸이 눈에서 제일 가깝다.
  //   밀려난 **전력 배분**은 없어진 것이 아니라 **앉으면 뜨는 상태창**으로
  //   올라갔다 (사장님 「기타 다른것들은 hud처럼 … 냉각이나 속도 이런
  //   것들도 표시」) — 거기가 원래 있어야 할 자리였다
  const DRAWERS = { 0: drawShip, 1: drawRadar, 3: drawCourse, 4: drawHeat };
  for (let i = 0; i < CONSOLE.length - 1; i++) {
    if (!DRAWERS[i]) continue;
    const a = CONSOLE[i], b = CONSOLE[i + 1];
    const s = seg(a, b);
    const L = layers(a, b);
    // ★ 테두리와 화면을 **한 묶음(Group)** 으로 만든다.
    //   처음엔 테두리를 만들고 `position.add(0,0,0.02)` 로 밀었는데, 그건
    //   **월드 좌표**라 각도가 있는 화면은 테두리가 앞을 덮어 버렸다.
    //   묶어 두면 안쪽 좌표라 각도가 어떻든 앞뒤가 안 바뀐다
    const slot = new THREE.Group();
    slot.position.set(s.mx, L.top - FACE_H / 2, s.mz + 0.145);
    slot.rotation.y = s.rot;
    slot.rotateX(-0.36);                               // 사람 쪽으로 눕힌다
    g.add(slot);

    const wid = s.len - 0.10;
    const bez = new THREE.Mesh(new THREE.BoxGeometry(wid + 0.06, FACE_H - 0.03, 0.04), FRAME);
    bez.position.z = -0.02;
    slot.add(bez);

    const sc = makeScreen(wid, FACE_H - 0.10, DRAWERS[i]);
    sc.mesh.position.z = 0.012;
    slot.add(sc.mesh);
    screens.push(sc);

    // ══ ★★★ **항로 갈래는 계기 화면이 「쪽을 바꿔」 띄운다** (v66) ══════
    //  사장님: 「항로도 조정석에서 해야하는거 아냐?? 왜 다른곳에 있어?」
    //
    //  ★ 처음엔 선반에 판 둘을 따로 세웠다. 화면을 찍어 보니 **계기
    //    화면을 통째로 덮고** 있었다 — 조종석에 자리가 그만큼 없다.
    //    실제 MFD 는 이럴 때 **쪽을 바꾼다.** 화면 하나가 상황에 따라
    //    다른 것을 보여주는 것은 이 배의 규약이기도 하다 (drawCourse 가
    //    평소엔 항로, 추격 중엔 거리를 띄운다).
    //  ★ 그래서 **고를 것이 있을 때만** 안쪽 화면 둘 위에 뜬다.
    //    없으면 사라지고 원래 계기가 그대로 보인다
    // ★★ **바깥 화면 둘에 얹는다** (v66 · 안쪽에서 옮겼다).
    //   안쪽(±0.34~0.95)은 조종간과 **같은 방향**이라, 조준선이 늘
    //   더 가까운 조종간을 먼저 잡는다 — 판은 보이는데 눌리는 것은
    //   조종간이었다. 그리고 그 조종간이 수동 조종을 켜서, 화면에는
    //   「눌렀더니 자동 항법이 꺼졌습니다」만 떴다.
    //   바깥(±0.95~1.55)은 방위 47~62도라 조종간과 안 겹친다
    if (i === 0 || i === 4) {
      const pi = i === 0 ? 0 : 1;
      const fk = makeScreen(wid, FACE_H - 0.10, drawFork);
      fk.mesh.position.z = 0.028;
      fk.mesh.visible = false;
      slot.add(fk.mesh);
      // ★★ **넉넉하게 잡는다.** 배는 늘 미세하게 떨리므로(`sw`) 판정 상자가
      //   빠듯하면 **누르는 그 프레임에만 벗어나** 있는 일이 난다 —
      //   그러면 앉은 사람은 「빈 데를 눌렀다」고 보고 일어나 버린다.
      //   검사가 「눌렀더니 배가 간다 → 『일어납니다』」로 두 번 잡아 줬다.
      //   **작은 것을 정확히 겨누게 하는 건 어려움이 아니라 짜증이다**
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(wid + 0.34, FACE_H + 0.34, 0.42),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hit.position.z = 0.05;
      hit.name = `항로 갈래 ${pi}`;
      slot.add(hit);
      plates[pi] = { i: pi, hit, sc: fk, fork: null, land: null };
    }
  }

  // 선반 위 작은 스위치들 — 손이 갈 데가 많아 보여야 한다.
  // ★ v66 — 자리를 **선반에서 뽑는다.** 전에는 y 0.94 로 박아 놨는데,
  //   차양이 곡면이 된 지금 그 높이는 자리에 따라 **차양 위**다 —
  //   즉 스위치가 창을 먹는다. 높이를 손으로 적으면 반드시 이렇게 된다
  for (let i = 0; i < 18; i++) {
    const t = i / 17;
    const x = -1.42 + t * 2.84;
    const z = panelZof(x);
    const y = browAt(x, z) - FACE_H + 0.03;
    box(g, 0.07, 0.045, 0.07, i % 3 === 0 ? stripMat(AMBER) : DARK, x, y, z + 0.16);
  }

  // ══ ★★ **옆 콘솔** — 스로틀은 왼쪽, 자동 항법은 오른쪽 (v66) ══════
  //  고증: 실제 전투기는 **스로틀을 왼쪽 콘솔**에 둔다 (F-16 · F-15 ·
  //  Su-27 다 같다). 왼손은 늘 추력에 있고 오른손이 조종간이다.
  //  v65 까지 이 배는 **추진을 통로의 차단기로** 켰다 — 「모든 비행 조작은
  //  운전석에 있어야지」(사장님)가 정확히 맞는 지적이었다.
  //  방위각 60도 밖이라 시야는 하나도 안 먹는다
  //  ★ **띠조명을 여기 달았다가 뺐다** — 화면을 찍어 보니 눈에서 1m 도
  //    안 되는 자리라 **주황 덩어리 넷이 창을 가로막고** 있었다.
  //    같은 폭이라도 가까우면 화면에서 크다 (`atan`). 조종석 안쪽 물건에
  //    악센트를 다는 것은 벽에 다는 것과 완전히 다른 일이다
  //  ★★ **v69 — 큰 콘솔을 팔걸이로 줄였다.** ±1.45 에 세운 덩어리가
  //    사장님 화면에서 **계기를 가리고** 있었다. 팔걸이는 좌석에 붙는
  //    작은 것이라 아무것도 안 가린다
  for (const sx of [-1, 1]) {
    box(g, 0.14, 0.10, 0.62, PANEL, sx * SIDE.x, 0.70, SIDE.z);        // 팔걸이 상판
    box(g, 0.10, 0.30, 0.10, DARK, sx * SIDE.x, 0.53, SIDE.z + 0.22);  // 받침
  }

  // ── 좌석 둘 ───────────────────────────────────────────
  // 크기를 알려 주는 물건. 이게 없으면 방이 얼마나 큰지 안 읽힌다
  // ★ 처음 만든 좌석은 **너무 컸다.** 등받이가 눈높이까지 올라와 조종석
  //   한가운데를 막았다 — 앉은 사람 것인데 선 사람 눈으로 만들었다.
  //   앉은 어깨높이(바닥에서 1.25)를 넘지 않게 낮췄다.
  let helmSeatHit = null;
  for (const [sx, sz] of SEATS) {
    // ★★ **좌석을 겨눌 수 있게 한다** (v61 · 사장님 「좌석은 센터에 있어야지.
    //   어떻게 앉아서 조정을 할 수 있을지 먼저 생각해봐」).
    //   좌석이 한가운데로 오면 등받이가 조종간을 가린다 — 서서 잡을 수가
    //   없다. 그러면 답은 하나다: **앉고 나서 잡는다.** 주포 좌석과 같은
    //   얼개다 (`world/turret.js` 의 seatHit). 넉넉하게 잡는다 —
    //   작은 것을 정확히 겨누게 하면 그건 어려움이 아니라 짜증이다
    helmSeatHit = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 1.35, 1.15),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    helmSeatHit.position.set(sx, 0.85, sz + 0.05);
    helmSeatHit.name = '조종석 좌석';
    g.add(helmSeatHit);

    const seat = new THREE.Group();
    seat.position.set(sx, 0, sz);
    g.add(seat);
    box(seat, 0.16, 0.36, 0.16, DARK, 0, 0.18, 0);           // 기둥
    box(seat, 0.54, 0.1, 0.52, PANEL, 0, 0.41, 0);           // 방석
    box(seat, 0.54, 0.72, 0.11, PANEL, 0, 0.82, 0.22);       // 등받이
    box(seat, 0.34, 0.18, 0.12, DARK, 0, 1.24, 0.21);        // 머리받이
    box(seat, 0.04, 0.42, 0.035, stripMat(AMBER), 0.26, 0.82, 0.17);
    box(seat, 0.04, 0.42, 0.035, stripMat(AMBER), -0.26, 0.82, 0.17);
  }

  // ── 조종간 ────────────────────────────────────────────
  // ★ **좌석 앞에 두 개 있었는데 안 보였다** (2026-08-04 · 사장님
  //   「조정간이 안잡히잔아」). 좌석 등받이(높이 1.24)가 가려서, 서 있는
  //   눈높이에서는 **한 번도 보이지 않았다.** 그런데 조준 판정 상자는
  //   폭 2.8m 짜리 통짜라 **아무것도 없는 콘솔 표면**을 겨눠도 잡혔다 —
  //   보이는 것과 잡히는 것이 달랐다.
  //
  // ★ 실제 우주선을 보고 다시 잡았다 (docs/space/REALSHIP.md §3)
  //   크루 드래건은 터치스크린이 셋인데도 **한가운데 큰 물리 레버**를
  //   남겼다. 이유가 분명하다 — **급할 때 쓰는 것은 크고 한가운데 있다.**
  //   몇 G 를 받으며 화면을 더듬을 수는 없다.
  //
  //   그래서 좌석 **사이**, 콘솔 위로 올라온 기둥에 **T 자 조종간 하나**를
  //   세운다. 좌석 둘 사이가 비어 있으므로 서서도 앉아서도 보인다.
  const yokes = [];
  const yoke = new THREE.Group();
  // ★ 이름을 붙인다. **검사가 「지금 눈에 걸리는 게 조종간인가」를 물으려면**
  //   부딪힌 메시에서 거슬러 올라가 이름을 읽어야 한다. 이름이 없으면
  //   「뭔가 맞긴 했다」밖에 못 말하고, 그건 이번에 난 사고(보이는 것과
  //   잡히는 것이 다르다)를 그대로 통과시킨다
  yoke.name = '조종간';
  yoke.position.set(0, YOKE_Y, YOKE_Z);
  g.add(yoke);
  yokes.push(yoke);

  // ══ ★★ **바닥에서 올라온다** (v61 · 사장님 「조정 핸들이 공중에 떠
  //    있는 것도 고치고」) ═══════════════════════════════════════════
  //  ★ 기둥이 **y 0.80 에서 시작하고 있었다.** 「콘솔 상판(0.86)에서
  //    올라온다」고 주석에 적어 놓았는데, 조종간은 z −7.42 라 콘솔
  //    (z −7.95~−8.88)보다 **앞**이다 — 상판이 거기까지 안 온다.
  //    그래서 기둥도 밑동도 **허공에 80cm 떠 있었다.**
  //    주석이 거짓말을 하고 있었고, 그걸 몇 판 동안 아무도 안 봤다
  //    (`REAL.md §0` 의 ①거짓말 — 서 있는 자리에서는 안 보인다).
  //
  //  ★ 실제 우주선의 조종 기둥은 **바닥에 박혀 있다** (셔틀의 control
  //    column · 드래건의 가운데 레버 · REALSHIP.md §3). 여기도 그렇게 한다:
  //    바닥 받침 → 기둥 → 목 → T 자
  const PED_R = 0.30;
  // 받침 — 바닥에 볼트로 박은 판. **넓어야 「박혀 있다」로 읽힌다**
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(PED_R, PED_R + 0.05, 0.07, 16), DARK);
  plinth.position.set(0, 0.035, YOKE_Z);
  g.add(plinth);
  // 볼트 여섯 — 「뜯을 수 있는 물건」의 문법 (REALSHIP §6)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    box(g, 0.045, 0.02, 0.045, FRAME,
      Math.cos(a) * (PED_R - 0.05), 0.08, YOKE_Z + Math.sin(a) * (PED_R - 0.05));
  }
  // 기둥 — **바닥부터** 조종간까지. 아래가 굵고 위가 가늘다
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.15, YOKE_Y - 0.14, 12), FRAME,
  );
  post.name = '조종간기둥';
  post.position.set(0, (YOKE_Y - 0.14) / 2 + 0.07, YOKE_Z);
  g.add(post);
  // 무릎 높이 가로대 — 발을 걸치는 자리. 이게 있어야 기둥이 「가구」가 된다
  box(g, 0.44, 0.05, 0.05, FRAME, 0, 0.30, YOKE_Z - 0.02);
  // 밑동 덮개 — 셔틀 문법. 급한 조작기는 **움푹한 자리에 앉는다**
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.06, 12), DARK);
  collar.name = '조종간밑동';
  collar.position.set(0, YOKE_Y - 0.20, YOKE_Z);
  g.add(collar);

  // T 자 — 가로대 하나에 손잡이 둘. 이 모양이라야 「좌우로 민다」가 읽힌다
  box(yoke, 0.52, 0.075, 0.075, FRAME, 0, 0, 0);
  for (const sx of [-1, 1]) {
    box(yoke, 0.10, 0.16, 0.16, DARK, sx * 0.26, 0.02, 0);     // 손잡이
    box(yoke, 0.035, 0.05, 0.17, stripMat(AMBER), sx * 0.26, 0.11, 0);  // 표시등
  }
  box(yoke, 0.075, 0.20, 0.075, FRAME, 0, -0.13, 0);           // 목

  // ★ 조준 판정 — **보이는 것과 같은 크기.** 전에는 2.8 × 0.8 × 0.6 짜리
  //   통짜라 콘솔 절반이 「조종간」이었다. 손잡이보다 조금 넉넉한 정도로
  //   (작은 것을 정확히 겨누게 하면 그건 어려움이 아니라 짜증이다)
  const yokeHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.56, 0.42),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  yokeHit.position.set(0, YOKE_Y, YOKE_Z);
  g.add(yokeHit);

  // ══ ★★★ **추력 레버 — 왼손** (v66 · 사장님 「추진도 그렇고 모든 비행
  //    조작은 운전석에 있어야지」) ═══════════════════════════════════════
  //
  //  ★ 여태 추진은 **통로의 차단기**였다. 그건 「전력을 어디로 돌리나」의
  //    한 칸이었을 뿐, 배를 모는 손잡이가 아니었다. 조종석에 앉아서
  //    출발을 못 하는 배였던 셈이다.
  //  ★ 고증대로 **왼쪽 콘솔**에 둔다. 그리고 **레버**다 — 딸깍이 아니라
  //    밀고 당기는 것이라야 「추력」으로 읽힌다 (실제 스로틀에도 IDLE ·
  //    MIL 디텐트가 있어 두 자리로 딱딱 걸린다)
  const TH = SIDE.throttle;
  box(g, 0.24, 0.10, 0.46, DARK, TH.x, TH.y - 0.22, TH.z);      // 레버 홈
  const thrLever = new THREE.Group();
  thrLever.position.set(TH.x, TH.y - 0.18, TH.z);
  thrLever.name = '추력 레버';
  g.add(thrLever);
  box(thrLever, 0.07, 0.30, 0.07, FRAME, 0, 0.15, 0);            // 자루
  const thrLamp = new THREE.MeshBasicMaterial({ color: 0x2a2f36 });
  box(thrLever, 0.15, 0.13, 0.20, DARK, 0, 0.31, 0);             // 손잡이
  box(thrLever, 0.10, 0.04, 0.12, thrLamp, 0, 0.385, 0.02);      // 불
  // ★ 넉넉하게 — 배가 떨리므로 빠듯하면 누르는 프레임에만 벗어난다
  // ★★★ **v69 — 상자를 줄였다. 0.70 × 0.86 × 0.90 이 콘솔을 먹고 있었다.**
  //
  //   `space-endtoend.js [0]` 이 「갈래 판을 잡는다 → **추력 레버**」로
  //   빨개져서 찾았다. 재 보니: 앉은 눈(0, 1.20, −8.30)에서 왼쪽 갈래
  //   판(−1.25, 0.83, −9.00)으로 쏜 광선이 **z −8.75 를 지날 때 x −0.80 ·
  //   y 0.96** 인데, 옛 상자는 x −0.97~−0.27 · y 0.49~1.35 · z −8.75~−7.85
  //   이라 **그 점을 품고 있었다.** 즉 팔걸이 손잡이가 눈과 콘솔 사이를
  //   가로막아, 조종석에서 항로를 고르는 길이 통째로 막혀 있었다.
  //
  //   ★ v66 에 「넉넉하게 잡는다」로 키운 것이 옳았지만 **깊이까지** 키운
  //     것이 잘못이었다. 손잡이는 **옆구리에 붙어 있다** — 앞뒤로 90cm 나
  //     뻗을 이유가 없다. 폭·높이는 손이 닿을 만큼 두고 깊이만 뺀다
  const thrHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.42, 0.26),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  thrHit.position.set(TH.x, TH.y, TH.z);
  thrHit.name = '추력 레버';
  g.add(thrHit);
  const setThrust = (on) => {
    thrLamp.color.set(on ? 0xff9a3c : 0x2a2f36);
    thrLever.rotation.x = on ? -0.42 : 0.30;      // 밀면 켜짐 · 당기면 꺼짐
  };
  setThrust(false);

  // ── ★★ 자동 항법 스위치 (2026-08-06 · 사장님) ──────────────
  // 「수동으로 운전할때는 자동항법 꺼지는 걸로」
  //
  // ★ **끄는 것은 조종간이 하고, 켜는 것은 이 스위치가 한다.** 둘을 같은
  //   손잡이에 얹으면 「잡았더니 켜졌다 껐다」가 되어 지금 어느 쪽인지를
  //   모른다. 그리고 **불로 말한다** — 초록이면 자동, 주황이면 수동
  // ★ v66 — **오른쪽으로 옮겼다.** 왼쪽은 스로틀 몫이다 (고증)
  const AU = SIDE.auto;
  const autoLamp = new THREE.MeshBasicMaterial({ color: 0x6fd8a0 });
  const autoBox = box(g, 0.26, 0.16, 0.16, DARK, AU.x, AU.y, AU.z);
  autoBox.name = '자동항법';
  const autoLight = box(g, 0.17, 0.055, 0.10, autoLamp, AU.x, AU.y + 0.085, AU.z + 0.02);
  autoLight.name = '자동항법등';
  box(g, 0.09, AU.y - 0.55, 0.09, FRAME, AU.x, (0.55 + AU.y) / 2, AU.z);
  // ★ 추력 레버와 같은 이유로 줄였다 (바로 위 주석)
  const autoHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.40, 0.26),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  autoHit.position.set(AU.x, AU.y, AU.z);
  autoHit.name = '자동 항법 스위치';
  g.add(autoHit);
  const setAuto = (on) => { autoLamp.color.set(on ? 0x6fd8a0 : 0xff9a3c); };

  // ══ ★★★ **항로 갈래 판 둘 — 조종석으로 왔다** (v66) ═══════════════
  //  사장님: 「항로도 조정석에서 해야하는거 아냐?? 왜 다른곳에 있어?」
  //
  //  ★ 맞다. 여태 항로는 **관측실 해도대**에서만 골랐다. 「어디로 갈까」를
  //    정하는 자리와 **가는 자리**가 달랐던 셈이다. 여객기가 항로를 넣는
  //    판(MCP)을 차양 언저리에 두는 것과 같은 자리로 가져온다.
  //  ★ 다만 **해도대를 없애지는 않는다.** 거기는 이제 「고르는 곳」이
  //    아니라 **「보는 곳」**이다 — 압박과 항로 전경은 여전히 관측실에서만
  //    보이고, 그래서 「무엇을 안 보고 갈까」가 그대로 산다
  //  ★ 그리고 **배전 차단기는 통로에 남긴다.** 그건 뛰어가서 내리는
  //    것이고, 손에 닿는 순간 추격의 긴장이 죽는다
  // (갈래 판은 위 화면 루프에서 계기 화면 위에 얹는다)
  let aimedPlate = -1;

  // ── 조명 ──────────────────────────────────────────────
  // 참고 사진은 **찬 파랑 + 따뜻한 주황** 두 색이다. 한 색이면 밋밋하다
  const key = new THREE.PointLight(0x9fc8f0, 26, 11, 2);
  key.position.set(0, H - 0.45, -6.6);
  g.add(key);
  const warm = new THREE.PointLight(0xffa758, 10, 6, 2);
  warm.position.set(0, 1.1, -5.2);
  g.add(warm);

  /** 매 프레임 화면을 다시 그린다 — 여섯 장이라 비싸지 않다 */
  function update(state) {
    for (const s of screens) s.redraw(state);
    // ══ ★★★ **조종간이 내 손을 따라간다 · 놓으면 가운데로** (v79) ══
    //  사장님 「**조정간 움직임은 보이고 손을 떼면 자동으로 센터로 돌아오도록**」
    //
    //  ★ v78 까지 `state.lane`(항로에서 벗어난 정도)만 보고 누웠다.
    //    미는 것과 눕는 것이 **다른 값**이었으므로, 밀어도 굼뜨게 조금
    //    눕고 놓아도 항로가 안 돌아오면 눕은 채로 있었다.
    //    조종간은 계기가 아니라 **내 손**이다.
    //
    //  ★★ 놓으면 **스스로 돌아온다.** 실제 조종간의 센터링 스프링이 하는
    //    일이고, 없으면 「지금 밀고 있나」가 손에서 안 읽힌다
    const yk = state.yoke ?? null;
    const wantZ = yk?.held ? -(yk.yaw ?? 0) * YOKE.tilt : 0;
    const wantX = yk?.held ? (yk.pitch ?? 0) * YOKE.pitchTilt : 0;
    const k = Math.min(1, (state.dt ?? 0.016) * YOKE.back);
    for (const y of yokes) {
      y.rotation.z += (wantZ - y.rotation.z) * k;
      y.rotation.x += (wantX - y.rotation.x) * k;
    }
    // ★ 자동 항법 등 — **초록이면 자동, 주황이면 수동.** 지금 어느 쪽인지를
    //   조종석에 들어서는 순간 알아야 한다
    setAuto(state.auto !== false);
    setThrust(!!state.thrust);
    // ★★ 갈래 판 — 해도대에 있던 규약을 그대로 가져왔다
    const land = !state.atPort && state.land?.offered ? state.land : null;
    plates.forEach((p, i) => {
      p.fork = !land && state.atPort ? state.offer?.[i] : null;
      p.land = land ? { go: i === 0, hard: !!land.hard } : null;
      const show = !!(p.fork || p.land);
      p.sc.mesh.visible = show;
      // ★★ **고를 것이 없으면 판정 상자도 없앤다** (v66). 화면만 끄고
      //   상자를 남기면 **빈 판이 눌린다** — 「보이는데 안 잡힌다」의 반대,
      //   즉 「안 보이는데 잡힌다」다. 이 저장소가 둘 다 겪었다.
      //   `Raycaster` 는 `visible === false` 인 물체를 건너뛴다
      p.hit.visible = show;
      if (show) p.sc.redraw({ fork: p.fork, land: p.land, lit: aimedPlate === i });
    });
  }
  return {
    update, yokeHit, autoHit, helmSeatHit, thrHit, plates,
    /** 조준선이 어느 갈래 판에 걸렸나 — 밖에서 넣어 준다 */
    setAim(i) { aimedPlate = i; },
    keyAt(i) { return plates[i]?.fork?.key ?? null; },
    landAt(i) { return plates[i]?.land ?? null; },
  };
}

/**
 * 창밖 — **여기가 이 게임 화면의 절반이다.**
 *
 * ★★ **다시 지었다** (2026-08-07 · v57 · 사장님 「우주 배경을 실사화해줘.
 *    인터넷에서 고증해서. 행성도 그렇고 지금은 하얀색이 너무 많이 날아오는데?」)
 *
 *    ★ 무엇이 틀려 있었나 — **두 가지가 겹쳐 있었다**
 *      ① 별이 **흰 정사각형**이었다. three 의 기본 점은 지도를 안 주면
 *         네모를 그린다. 900 개가 전부 같은 크기의 흰 네모라 별하늘이
 *         아니라 눈보라였다
 *      ② 별이 **흘렀다.** 이건 고증으로 틀렸다 — 제일 가까운 별도 4광년이라
 *         어떤 배로도 별은 한 번도 안 움직인다. 흐르는 별은 영화에서 온
 *         그림이지 우주에서 온 것이 아니다
 *
 *    ★ 그래서 고친 것은 **개수가 아니라 무엇이 흐르는가**다.
 *      별은 **천구에 박아 두고**(`world/sky.js`), 흐르는 것은 **먼지**로
 *      바꿨다. 「배가 움직인다」는 먼지 130 알이면 나고, 별 900 개는
 *      그 일을 하고 있지도 않았다.
 *
 *    숫자와 고증한 근거는 전부 `game/sky-table.js` 한 곳이다.
 *
 * ★ 그림(sky/deep · sky/planet)이 오면 그것이 이 위에 얹힌다. 여기 있는 것은
 *   **기하와 빛**이라 「좋아 보이는가」가 아니라 「맞나」로 판정된다 —
 *   그래서 내가 만들어도 되는 것들이다 (CLAUDE.md 「그림은 내가 안 그린다」).
 */
export function buildOutside(scene, z) {
  const out = new THREE.Group();
  // ══ ★★★ v98 — **도는 차례가 틀려 있었다** (three 의 기본 XYZ) ═══════
  //
  //  ★ 기본값 `XYZ` 는 행렬이 `Rx·Ry·Rz` 라서 **롤이 제일 먼저** 먹는다.
  //    즉 배가 기울 때 **세상의 z 축**을 도는 셈이고, 그건 「기수를 축으로
  //    도는 것」이 아니다. 조종석에서 보면 표적이 **옆으로 미끄러진다.**
  //
  //  ★★ 규칙(`frame.js`)은 요 → 피치로 재고, 롤은 **표식만** 돌린다
  //    (v95). 그 둘이 맞으려면 창밖도 **요 → 피치 → 롤** 이어야 한다 —
  //    즉 `ZXY` (`Rz·Rx·Ry`, 벡터에는 Ry 부터 먹는다).
  //
  //  ★★★ 재서 확정했다 (`SPACE.align()`): 시차를 없앤 뒤에도 **기울었을
  //    때만** 4~5도가 남았다. 안 기울면 0.00 도였다 — 「가끔 어긋난다」의
  //    마지막 조각이 이 한 줄이다
  out.rotation.order = 'ZXY';
  scene.add(out);

  // ── 별 · 은하수 · 먼지 ──────────────────────────────────
  // ★ 천구와 띠는 **눈을 따라다닌다** (아래 update). 별은 무한히 멀리
  //   있으므로 통로를 걸어가도 자리가 안 바뀌어야 한다 — 예전엔 천구가
  //   조종석에 박혀 있어서 **기관실까지 25m 를 걸으면 별자리가 밀렸다**
  const band = buildBand(out);
  const stars = buildStars(out);
  const targets = buildTargets(out);
  const shots = buildShots(out);
  // ★★★ v81 — **회수.** 꾸러미·그물·줄. 창밖 그룹이라 배를 틀면 같이 흐른다
  const salvage = buildSalvage(out);
  // ══ ★★★ v94 — **표는 눈에서 잰다** (여기가 모든 어긋남의 뿌리였다) ══
  //
  //  사장님 「**화면에 보이는 물체와 레이더 표적이 나오는걸 왜 동일하게
  //          못 맞추는거지?**」 · 「락온은 왼쪽인데 적은 우측 상단」 ·
  //          「레이저랑 방향 전환이 다르게 움직인다」 —
  //  **셋이 다 이 한 줄이었다.**
  //
  //  ★ 재서 확정했다 (`SPACE.hudGap()`):
  //      표가 아는 자리   방위 9.18도 · 89.1m
  //      화면에 그려진 것 방위 10.14도 · **80.6m**
  //    89.1 − 80.6 = **8.5m** = 배 중심에서 조종석 눈까지의 거리다.
  //
  //  ★★ 즉 **표는 「배 중심」에서 재고 화면은 「눈」에서 본다.** 그 시차가
  //    통째로 어긋남이 된다. 90m 에서 1도지만 **30m 에서는 16도**다 —
  //    가까울수록 못 맞추고, 그래서 레이더·락온·조준선·발사체가 다 따로 논다.
  //
  //  ★★★ 고치는 방법은 **값을 만지는 것이 아니라 원점을 옮기는 것**이다.
  //    떠도는 것·쏜 것·회수물의 원점을 **조종석 눈(DEP)**으로 옮기면,
  //    `az/el/dist` 가 「눈에서 본 각과 거리」라는 **한 뜻**이 된다.
  //    별·먼지는 그대로 둔다 — 저건 무한히 멀어서 시차가 없다 (v57 고증).
  //  ══ ★★★ v98 — **한 번 놓고 마는 것으로는 모자랐다** ═══════════════
  //
  //   ★ v93 에 여기서 `grp.position.set(DEP…)` 를 했다. 가만히 있을 때는
  //     맞았다 — 그런데 **이 그룹은 `out` 안에 있고 `out` 은 배가 돌 때
  //     같이 돈다.** 즉 눈까지의 8.5m 짜리 팔이 **배와 함께 휘둘린다.**
  //     기수를 틀면 원점이 눈에서 **7m 까지 벌어졌다** (`SPACE.align()`
  //     으로 쟀다: 0.19m → 0.06도, 6.9m → **5.7도**).
  //
  //   ★★ 그래서 v93 은 「가만히 있으면 맞고 돌리면 어긋나는」 반쪽짜리
  //     고침이었다. 사장님이 「**아직 레이저랑 방향 전환이랑 다르게
  //     움직이잔아**」라고 하신 것이 이 남은 절반이다.
  //
  //   ★★★ 고치는 법은 이미 이 파일 안에 있었다 — **천구가 하던 그대로**다
  //     (아래 `DOME`): 매 프레임 카메라 자리를 `out` 안쪽 좌표로 옮겨
  //     거기에 원점을 둔다. 그러면 배가 아무리 돌아도 원점은 **눈에
  //     붙어 있다.** 별은 무한히 멀어서 시차가 없고, 표적은 100m 라
  //     시차가 있으니 **더더욱** 이래야 했다.
  //   ★ 여기 한 번 놓는 것은 **첫 프레임용**으로만 남긴다 (`update` 전에
  //     한 프레임 그려지는 일이 있다)
  const EYEG = [targets.group, shots.group, salvage.group].filter(Boolean);
  for (const grp of EYEG) grp.position.set(DEP.x, DEP.y, DEP.z);
  const dust = buildDust(out, z);
  const Z_NEAR = z - DUST.near;
  const Z_FAR = z - DUST.far;

  // ── 행성 ────────────────────────────────────────────────
  // ★ 민짜 공이 아니다 — **터미네이터(낮/밤 경계)와 대기 테두리**가 있다.
  //   빛은 행성 자기 셰이더 안에서만 돈다. 장면에 조명을 안 보태므로
  //   예전처럼 **배 안까지 같이 밝아지는** 일이 없다 (world/sky.js)
  const world = buildPlanet(out, 46);
  world.setPos(-62, 6, z - 108);
  /** 천구를 눈에 붙일 때 쓰는 그릇. 매 프레임 새로 만들면 쓰레기가 쌓인다 */
  const DOME = new THREE.Vector3();

  // ── 잔해 ────────────────────────────────────────────────
  // 잔해밭 구역에서만 보인다. 별과 같은 방식으로 흘려보내되 **덩어리**라
  // 회전한다 — 점은 흘러도 「지나간다」로만 읽히고, 도는 덩어리라야
  // 「저기 뭐가 떠 있다」가 된다.
  const MAXDEB = 70;
  // 배 밖에는 등이 없어서 덩어리가 **까만 구멍**으로만 보였다. 아주 조금
  // 스스로 빛나게 해서 「저기 뭐가 떠 있다」로 읽히게 한다. 별빛을 받는
  // 정도라고 보면 된다
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x4a4740, roughness: 1, metalness: 0.15, emissive: 0x1a1c20,
  });
  const rocks = [];
  for (let i = 0; i < MAXDEB; i++) {
    const s2 = 0.7 + (i % 7) * 0.62;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s2, 0), rockMat);
    m.position.set(0, 0, Z_FAR);
    m.visible = false;
    m.userData.spin = new THREE.Vector3((i % 5 - 2) * 0.1, (i % 3 - 1) * 0.13, (i % 7 - 3) * 0.07);
    out.add(m);
    rocks.push(m);
  }
  // ★ `spread` 가 없으면 **잔해밭에 들어서도 한참 아무것도 안 보인다.**
  //   처음엔 전부 제일 먼 자리(Z_FAR)에 놓았는데, 거기서 여기까지 오는 데
  //   한참 걸린다 — 구역이 바뀐 티가 안 났다. 처음 켤 때는 **구간 전체에**
  //   흩어 놓고, 지나간 것만 뒤로 되돌린다.
  const placeRock = (m, spread = false) => {
    const a = Math.random() * Math.PI * 2;
    // 반지름을 좁혔다. 넓게 흩으면 **화면 가장자리로만 지나가서** 안 보인다
    // 선체 반폭(≈5.5)보다 밖에서 지나가야 한다. 안쪽이면 배를 뚫는다
    const rad = 9 + Math.sqrt(Math.random()) * 22;
    const zz = spread ? Z_FAR + Math.random() * (Z_NEAR - Z_FAR) : Z_FAR + Math.random() * 40;
    m.position.set(Math.cos(a) * rad, Math.sin(a) * rad * 0.6, zz);
  };

  // ── 구역 ────────────────────────────────────────────────
  // 색·별 밀도·안개를 **부드럽게 갈아탄다.** 툭 바뀌면 순간이동처럼 보인다.
  const fog = new THREE.Fog(0x05070d, 70, 340);
  scene.fog = fog;
  // 하늘 자체의 색. **이게 구역을 알아보게 하는 것의 8할이다**
  const bg = new THREE.Color(0x03050c);
  scene.background = bg;
  const cur = { fog: new THREE.Color(0x05070d), near: 70, far: 340, stars: 1, tint: new THREE.Color(0.86, 0.89, 1) };
  let want = REGIONS[0];
  /** ★ v88 — 마지막으로 받은 눈. `view` 가 「줄이 화면에서 몇 화소인가」를 잰다 */
  let camRef = null;
  let regionKey = REGIONS[0].key;

  /** @param instant 검사용 — 색 갈아타기를 건너뛴다. 게임은 안 쓴다 */
  function setRegion(key, instant = false) {
    const r = REGIONS.find((x) => x.key === key);
    if (!r) return;
    want = r;
    regionKey = key;
    if (instant) {
      bg.set(r.bg);
      cur.fog.set(r.fog); cur.near = r.fogNear; cur.far = r.fogFar;
      cur.stars = r.stars; cur.tint.setRGB(...r.tint);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  ★ 착륙 — **화면이 바뀐다** (2026-08-06 · 사장님 「화면이 바뀌는 것」)
  //
  //  ★ 여기가 이 판에서 제일 중요한 자리다. 표와 규칙은 브라우저 없이도
  //    검사할 수 있지만, **「내려가고 있다」는 오직 화면이 말한다.**
  //    v45 의 바깥문에서 「검사는 다 ✔ 인데 열린 문과 닫힌 문이 똑같았다」를
  //    밟았으므로, 여기서는 **바뀌는 것을 먼저 정하고** 만든다:
  //
  //      ① 별이 **느려지다 멎는다** (고도가 0 이면 흐를 것이 없다)
  //      ② 하늘색이 **우주 → 지표**로 갈아탄다 (구역 갈아타기와 같은 길)
  //      ③ 대기 진입에 **주황 발광**이 창을 덮는다 (제일 뜨거운 순간이 한가운데)
  //      ④ **땅이 올라온다** — 지면과 능선. 이게 없으면 「내렸다」가 안 읽힌다
  //
  //  ★ 지면을 `out` 에 넣는다. 배가 기울면 창밖이 반대로 밀리는데(시차),
  //    지면만 안 밀리면 **땅이 배와 따로 논다**
  // ══════════════════════════════════════════════════════════════════════
  const SURFACE = {
    bg: new THREE.Color(0x7a4a2e),
    fog: new THREE.Color(0xa46b42),
    near: 30, far: 460,
  };
  const groundG = new THREE.Group();
  groundG.visible = false;
  out.add(groundG);
  {
    const dirt = new THREE.MeshStandardMaterial({
      color: 0x7d6046, roughness: 1, metalness: 0.02, emissive: 0x2a1e14,
    });
    const floorM = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), dirt);
    floorM.rotation.x = -Math.PI / 2;
    floorM.position.set(0, 0, z - 200);
    groundG.add(floorM);
    // ★ **능선이 있어야 지평선이 생긴다.** 평면만 깔면 「갈색 바닥」이지
    //   행성이 아니다 — 멀리 뭔가 서 있어야 거리가 읽힌다
    const rock = new THREE.MeshStandardMaterial({
      color: 0x5f4a38, roughness: 1, flatShading: true, emissive: 0x1d1610,
    });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + 0.3;
      const rad = 190 + ((i * 37) % 90);
      const h = 16 + ((i * 53) % 46);
      const m = new THREE.Mesh(new THREE.ConeGeometry(h * (0.7 + (i % 3) * 0.25), h, 5), rock);
      m.position.set(Math.cos(a) * rad, h / 2 - 4, z - 200 + Math.sin(a) * rad);
      m.rotation.y = i;
      groundG.add(m);
    }
    // 가까운 바위 몇 — 「내려앉은 자리」가 있어야 착지가 읽힌다
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 1.1;
      const rad = 16 + (i % 4) * 7;
      const s2 = 1.1 + (i % 3) * 0.9;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s2, 0), rock);
      m.position.set(Math.cos(a) * rad, s2 * 0.4, z - 26 + Math.sin(a) * rad);
      groundG.add(m);
    }
  }

  // 대기 진입 발광 — **배와 무관하다.** out 에 넣으면 기울 때 같이 기운다
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff7a2a, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(190, 120), glowMat);
  glow.position.set(0, 1.6, z - 22);
  glow.visible = false;
  scene.add(glow);

  let land = { step: STEP.NONE, t: 0 };
  /** main.js 가 매 프레임 준다 — 착륙이 어디까지 왔나 */
  function setLand(s) { land = s && s.step ? s : { step: STEP.NONE, t: 0 }; }

  /**
   * 고도 — **1 이 우주, 0 이 땅.** 이 한 숫자가 화면 넷을 다 몬다.
   * ★ 마디마다 따로 그리지 않는다. 따로 그리면 마디가 바뀌는 순간
   *   화면이 툭 끊기고, 그건 「순간이동」으로 읽힌다 (구역 갈아타기와 같은 병)
   */
  function altOf() {
    const { step, t } = land;
    const f = (a, b) => Math.max(0, Math.min(1, a / b));
    if (step === STEP.APPROACH) return 1 - 0.35 * f(t, LAND.approach);
    if (step === STEP.ENTRY) return 0.65 - 0.4 * f(t, LAND.entry);
    if (step === STEP.DOWN) return 0.25 * (1 - f(t, LAND.down));
    if (step === STEP.LANDED) return 0;
    if (step === STEP.UP) return t < LAND.burn ? 0 : f(t - LAND.burn, LAND.rise);
    return 1;
  }

  /** 대기 발광 — 진입 한복판이 제일 뜨겁다 */
  function glowOf() {
    const { step, t } = land;
    if (step === STEP.ENTRY) return Math.sin(Math.min(1, t / LAND.entry) * Math.PI) * 0.85;
    if (step === STEP.UP && t < LAND.burn) return 0.3;
    return 0;
  }

  // ★ 다가오는 덩어리 — **부딪히는 것.** 창밖의 잔해와 달리 이건 **위치가
  //   정해져 있고 실제로 부딪힌다** (game/hazard.js). 크게 하나만 만든다:
  //   여럿 띄우면 어느 것을 피해야 하는지 안 보인다.
  // ★ **스스로 빛나게 한다.** 배 밖에는 등이 없다 — 잔해 덩어리에서 이미
  //   한 번 밟은 함정인데(위 rockMat 참고) 여기서 또 밟았다. 처음엔
  //   emissive 없이 두었더니 까만 하늘에 **까만 덩어리**라 창밖으로는
  //   아무것도 안 보였고, 조종석 화면(계기)만 보고 피하게 됐다.
  //   그러면 「창으로 판단한다」(FLYING.md §3-B)가 거짓말이 된다.
  //   작은 잔해보다 밝게 준다 — 이건 **피해야 하는 것**이라 눈에 띄어야 한다.
  const bigRock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.4, 1),
    new THREE.MeshStandardMaterial({
      color: 0xa89880, roughness: 1, flatShading: true, emissive: 0x6a5a46,
    }),
  );
  bigRock.visible = false;
  // ★ **`out` 에 안 넣는다.** out 은 배가 기울면 통째로 반대로 밀리는데
  //   (아래 시차), 그 폭(3.2)과 덩어리의 폭(5.4)이 달라서 **비켰는데도
  //   덩어리가 안 비켜 보이고, 부딪히는데도 가운데로 안 왔다.**
  //   덩어리는 「내 자리에 대해 어디 있나」라야 창으로 판단이 된다 —
  //   그래서 시차 밖에 두고 **상대 자리**로 놓는다.
  scene.add(bigRock);

  /**
   * 한 프레임 흘려보낸다.
   * @param speed 초당 몇 유닛. 표(game/systems-table.js CRUISE)에서 온다
   * @param lane  배가 좌우 어디에 있나 (-1 ~ 1). 창밖이 **반대로** 흐른다
   * @param inc   다가오는 덩어리 { in, lane } 또는 null
   */
  /**
   * @param rush ★★★ v73 — **급가속** 0~1. 먼지가 쏟아지고 길어진다
   *             (`boost-table.js RUSH`). ★ 별은 안 흘린다 (v57 고증)
   */
  function update(dt, speed, lane = 0, inc = null, camera = null, rush = 0) {
    camRef = camera;                          // ★ v88 — `view` 가 화소를 재려면 눈이 있어야 한다
    // ══ ★★★ v91 — **옆으로 밀던 것을 걷어냈다** ═══════════════════════
    //
    //  여기 `out.position.x += (-lane * 3.2 - out.position.x) * …` 이 있었다.
    //  「배가 기울면 창밖이 반대로 밀린다 — 그게 내가 움직였다로 읽힌다」는
    //  v12 무렵의 눈속임인데, **창밖 그룹에는 이제 적이 서 있다.**
    //  그룹을 3.2 유닛 옆으로 밀면 90m 앞의 적이 **2도쯤 옆으로 그려진다** —
    //  즉 **레이더가 말하는 방위와 눈에 보이는 자리가 갈라진다.**
    //
    //  ★ 화소로 쟀다 (`SPACE.hudGap()`): HUD 판을 눈에 맞춘 뒤에도
    //    3.5화소가 남았고, 그 3.5화소가 정확히 이 밀림이었다.
    //  ★★ 사장님 「**타겟팅해도 적이 안잡히잔아**」의 마지막 조각이다.
    //    보이는 자리로 겨누면 실제로는 2도 옆을 겨누는 것이라, 락온 원뿔
    //    (9도) 가장자리에서 **붙었다 떨어졌다** 한다.
    //  ★ 기울어 보이는 느낌은 **짐벌(아래 setAttitude)**이 이미 만든다 —
    //    없어진 것이 아니라 **거짓말하지 않는 쪽만 남긴 것**이다
    out.position.x = 0;

    // ══ ★★ **세 축** (v60) — 배가 돌면 **창밖이 돈다** ══════════════
    //  사장님: 「비행이가 360도 회전도 가능하게, 위 아래로 조정이
    //           가능하게」 → 「실제 우주선 개념으로 가자」
    //
    //  ★ **배를 굴리지 않고 밖을 굴린다.** 배(선체·방·물건)를 굴리면
    //    걸어다니는 사람과 충돌이 통째로 어긋난다 — 정비공이 벽을 뚫는다.
    //    그리고 이게 곧 **짐벌**이다: 거주 구획은 제 수평을 지키고
    //    선체만 도는 것 (game/flight-table.js GIMBAL).
    //  ★ `drift`(장면 C)의 굴림과 **더한다.** 둘 중 하나가 덮어쓰면
    //    자세 제어가 죽은 채로 조종간을 잡을 때 한쪽이 사라진다
    // ══ ★★★ **부호를 뒤집었다** (v73) ═══════════════════════════════
    //
    //  사장님 「**운전 방향 전환이 모두 반대**잔아!」
    //
    //  ★ 화면에 점을 박고 쟀다 (`SPACE.screenOf('raider')`):
    //      pitch +0.25 → 표적이 y −0.079 **→ +0.052** (위로 움직인다)
    //    즉 **기수가 아래로** 돈 것이다. 그런데 `noseAim()` 은
    //    `el = +fly3.pitch` 로 세므로 **위를 본다**고 여긴다 —
    //    창밖과 조준경이 **서로 반대로** 돌고 있었다.
    //
    //  ★★ 그래서 표적을 아래로 쫓으면: 밀면 세상은 위로 가고, HUD 상자는
    //    또 반대로 가서 **어느 쪽으로 밀어야 하는지 몸이 못 배운다.**
    //    좌우(v66)와 같은 병이고, 같은 방법으로 잡았다 —
    //    **부호는 머리로 맞히는 것이 아니라 화면에 점을 박고 재는 것이다.**
    // ══ ★★★ v85 — **늦게 따라가고 있었다** ═══════════════════════════
    //
    //  ★ 사장님 「왜 **락온이랑 적 비행기나 물체의 위치가 다르지??**」
    //
    //  ★★ 여기가 `+= (want - now) * min(1, dt*3)` 이었다 — **한 박자
    //    늦게** 따라가는 부드러움이다. 그런데 조준경(HUD)은 `fly3` 를
    //    **그 자리에서** 읽어 상자를 그린다. 즉:
    //
    //      HUD 상자 = 지금 기수 기준 ·  창밖 = 0.3초쯤 전 기수 기준
    //
    //    돌리는 동안 **둘이 벌어진다.** 가만히 있으면 맞으므로 「가끔
    //    어긋난다」로 보이고, 그래서 여태 안 잡혔다. v85 에 위아래를
    //    2.7배 빠르게 만들면서 **눈에 띄게 벌어진 것**이다.
    //
    //  ★★★ 부드러움은 **한 곳에서만** 만든다. 창밖은 기수를 **정확히**
    //    따라가고(계기와 같은 자), 출렁임은 짐벌(`fly3.tiltX`)이 낸다 —
    //    그건 카메라에 걸리므로 조준과 안 갈라진다
    out.rotation.x = -att.pitch;
    out.rotation.z = driftRoll + att.roll + lane * 0.06;
    // ★★★ 좌우. 이 한 줄이 v66 이전에 통째로 없었다.
    //
    //  ★★ **v69 — 부호를 뒤집었다.** v66 에서 「배가 오른쪽으로 틀면 창밖은
    //    왼쪽으로 흐른다」고 적고 `-att.yaw` 를 넣었는데, 사장님이
    //    「좌우 조정이 반대로 움직이는데?」라고 하셨고 **재 보니 맞았다.**
    //    창밖 그룹에 표시점을 박고 오른쪽으로 밀어 보니:
    //
    //        밀기 전  x  0.000
    //        오른쪽   x +0.223   ← 같이 오른쪽으로 갔다
    //
    //    **글로 쓴 추론이 틀렸다.** 세 축의 부호는 머리로 맞히는 것이
    //    아니라 화면에 점을 박고 재는 것이다 (`scratchpad/dir.mjs`)
    // ★ 좌우도 같은 이유로 **정확히** (위 주석)
    out.rotation.y = att.yaw;

    // ★★ **천구를 눈에 붙인다.** 별은 무한히 멀리 있으므로 배 안에서
    //   어디로 걸어가든 자리가 안 바뀌어야 한다. 예전엔 천구가 조종석
    //   앞에 박혀 있어서 **기관실까지 25m 를 걸으면 별자리가 밀렸고**,
    //   반지름이 330 이라 카메라 far(400)에 잘리기도 했다.
    //   기울기(out.rotation.z)는 그대로 받는다 — **배가 돌면 하늘도 돈다**
    if (camera) {
      DOME.copy(camera.position);
      out.worldToLocal(DOME);
      stars.points.position.copy(DOME);
      band.mesh.position.copy(DOME);
      // ★★★ v98 — **떠도는 것·쏜 것·회수물도 눈에 붙인다** (위 주석).
      //   천구와 **같은 한 줄**이다. 별은 시차가 없어서 붙였고, 이것들은
      //   시차가 **있어서** 붙인다 — 표의 `az/el/dist` 가 「눈에서 본
      //   각과 거리」라는 한 뜻이 되려면 원점이 눈이어야 한다
      for (const grp of EYEG) grp.position.copy(DOME);
    }

    // 다가오는 덩어리 — 남은 시간이 곧 거리다.
    // ★ 높이 1.5 는 **눈높이**다 (BODY.eye 1.62). 처음엔 -0.4 에 뒀더니
    //   콘솔 화면 뒤로 가려서 창밖에서는 안 보였다 — 계기만 보고 피하게 된다
    if (inc && inc.in > 0 && inc.in < 14) {
      bigRock.visible = true;
      bigRock.position.set((inc.lane - lane) * 5.4, 1.5, z - inc.in * 9);
      bigRock.rotation.x += dt * 0.5;
      bigRock.rotation.y += dt * 0.35;
    } else bigRock.visible = false;

    // 구역 갈아타기 — 색은 천천히, 개수는 바로
    const k = Math.min(1, dt / REGION_BLEND);
    bg.lerp(new THREE.Color(want.bg), k);
    cur.fog.lerp(new THREE.Color(want.fog), k);
    cur.near += (want.fogNear - cur.near) * k;
    cur.far += (want.fogFar - cur.far) * k;
    cur.stars += (want.stars - cur.stars) * k;
    cur.tint.lerp(new THREE.Color(...want.tint), k);
    fog.color.copy(cur.fog);
    fog.near = cur.near;
    fog.far = cur.far;

    // ── ★ 착륙 — 고도 하나가 화면 넷을 몬다 ─────────────────
    const alt = altOf();
    const down = 1 - alt;                  // 0 = 우주, 1 = 땅
    if (down > 0.001) {
      // ② 하늘색이 지표 쪽으로 — **구역 위에 덧칠한다.** 구역 갈아타기를
      //    건드리면 착륙을 끝내고 돌아왔을 때 원래 구역 색을 잃는다.
      //    ★ 처음엔 `down * 1.35` 라 **다가가는 중에 이미 하늘이 갈색**이었다.
      //      아직 우주에 있는데 지표 색이면 그건 「내려간다」가 아니라
      //      「색이 이상하다」다. 고도 0.62 아래로 들어와야 물들기 시작한다
      const mix = Math.max(0, Math.min(1, (0.62 - alt) / 0.62));
      bg.lerp(SURFACE.bg, mix);
      fog.color.copy(cur.fog).lerp(SURFACE.fog, mix);
      fog.near = cur.near + (SURFACE.near - cur.near) * mix;
      fog.far = cur.far + (SURFACE.far - cur.far) * mix;
      // ④ 땅이 올라온다. 고도가 0.45 아래로 내려가야 보인다
      const rise = Math.max(0, (0.45 - alt) / 0.45);
      groundG.visible = rise > 0.002;
      groundG.position.y = -2.0 - (1 - rise) * 240;
    } else groundG.visible = false;

    // ③ 대기 발광
    const gl = glowOf();
    glow.visible = gl > 0.004;
    glowMat.opacity = gl;

    // ① **흐르는 것은 먼지뿐이다.** 별은 안 흐른다 (위 ★★ 참고)
    const d = speed * want.speed * dt * (0.12 + 0.88 * alt);
    // ★★ **별이 땅에서도 그대로 떠 있었다.** 지면과 능선을 다 만들어 놓고
    //   화면을 찍어 보니 「갈색 벽 앞에 우주」였다 — 대기가 있는 행성에
    //   내려앉았는데 별이 총총하면 그건 착륙이 아니다. 고도가 낮아지면
    //   **대기가 별을 지운다**
    const starFade = Math.max(0, Math.min(1, (alt - 0.06) / 0.44));
    stars.setFade(starFade);
    stars.setTint(cur.tint);
    // ★ 밀도는 **개수를 자르는 것**으로 한다. 예전엔 색을 죽여 흉내 냈는데,
    //   검게 칠한 점은 사라지지 않고 **갈색 하늘 위의 까만 점**으로 남았다.
    //   셰이더가 자르면 아예 안 그려진다. 그리고 차례가 밝기순이라
    //   **어두운 별부터 사라진다** — 성운의 먼지가 하는 일이 정확히 그것이다
    stars.setDensity(cur.stars);
    // ★★ **띠는 별과 따로 간다** (v58 · REAL.md §2-H).
    //   전에는 `cur.stars` 하나로 둘을 같이 흐렸는데, 그러면 성간 공백에서
    //   **별까지 사라졌다** — 고증으로 틀렸다. 원반을 벗어나면 띠만 없어지고
    //   별은 먼지가 없어 오히려 또렷하다. 구역이 `band` 를 따로 적으면
    //   그 값을 쓰고, 안 적으면 예전처럼 `stars` 를 따라간다
    band.setFade(starFade * Math.min(1, (want.band ?? cur.stars) * 1.1));
    band.setTint(cur.tint);
    // ★ 여기에 `* (1 + rush * 0.9)` 를 얹고 있었다 — 밝기를 **두 군데**서
    //   올리니 알갱이가 흰 공이 됐다. 밝기는 `RUSH.glow` 한 곳에서만 올린다
    dust.setFade(starFade);
    // ★★★ **먼지가 쏟아진다** — 속도감은 여기서 나온다.
    //   별을 흘리면 v57 고증이 거짓말이 되므로 **정말 흐르는 것**만 흘린다
    // ★★★ v88 — **줄은 `rush` 가 아니라 「정말 얼마나 흐르나」가 켠다.**
    //   급가속은 이 값을 올릴 뿐이라 저절로 따라온다 — 축이 하나다.
    //   v87 에 `rush` 로 켰다가 화면을 찍고 잡았다: R 을 안 누르면
    //   **등속 화면이 한 톨도 안 바뀌어** 있었다 (사장님이 물으신 그 상태)
    const fd = d * (1 + rush * (RUSH.dust - 1));
    // ★★★ v103 — **절댓값이다.** 역추진(v101)이면 `fd` 가 음수라
    //   `streakLen` 의 `mps > STREAK.min` 이 안 서고, 그래서 **뒤로 가는
    //   동안 속도감이 통째로 없어졌다** (사장님 「반대로 가면 … 속도감이
    //   반대」의 나머지 절반이다). 길이는 빠르기가 정하고, **방향은
    //   `flow()` 가 정한다** — 둘을 한 값에 섞으면 이런 일이 난다
    dust.setRush(rush, Math.abs(fd) / Math.max(dt, 1e-4));
    dust.flow(fd);

    // 잔해
    const nd = want.debris;
    for (let i = 0; i < MAXDEB; i++) {
      const m = rocks[i];
      if (i >= nd) { m.visible = false; continue; }
      if (!m.visible) { m.visible = true; placeRock(m, true); }
      m.position.z += d * 1.15;
      m.rotation.x += m.userData.spin.x * dt;
      m.rotation.y += m.userData.spin.y * dt;
      m.rotation.z += m.userData.spin.z * dt;
      if (m.position.z > Z_NEAR) placeRock(m);
    }

    // ★ 하늘은 아주 천천히 돈다. 배가 미세하게 틀어지고 있다는 뜻이고,
    //   이게 있어야 오래 봐도 「멈춰 있다」는 느낌이 안 든다.
    //   **별과 은하수가 같이 돈다** — 따로 돌면 그 순간 가짜가 된다
    stars.points.rotation.y += dt * 0.0016;
    band.mesh.rotation.y = stars.points.rotation.y;

    // ★ 착륙 중에는 행성이 **정면에서 커진다** — 「저기로 내려간다」
    //   ★ 여기를 안 건드렸을 때 화면이 심심했다. 구역용 행성은 화면 왼쪽
    //     구석에 작게 떠 있어서, 내려가는 동안 **아무것도 안 커졌다**
    if (down > 0.001 && land.step !== STEP.LANDED) {
      // ★ **구역용 색으로는 아무것도 안 보였다.** 어두운 하늘에 어두운 파란
      //   공이라 화면에서 사라진다 — 잔해 덩어리에서 두 번 밟은 함정을
      //   세 번째로 밟았다. 내려갈 행성은 **밝고 따뜻하게** 간다
      world.setMood(true);
      // ★ **처음엔 다가가기 시작하자마자 행성이 창을 다 덮었다.**
      //   커지는 것만 만들고 **멀리서 시작하는 것**을 안 만들었기 때문이다 —
      //   「다가간다」는 작던 것이 커지는 것이지 처음부터 큰 것이 아니다.
      //   멀리서 작게 떠 있다가 가까워지며 아래로 커진다
      const g = 1 + down * 2.6;
      const dist = 520 - down * 360;
      world.visible = alt > 0.08;
      world.setScale(g);
      world.setPos(0, 14 - 46 * g * 0.85 * down, z - dist);
      return;
    }
    world.setScale(1);
    // 착륙이 끝나면 **구역용 색으로 되돌린다** — 안 되돌리면 그 뒤로 모든
    // 구역에서 행성이 갈색으로 뜬다 (한 번 바꿔 놓고 안 되돌리는 종류의 사고)
    world.setMood(false);

    // 행성 — 구역에 따라 있고 없다
    world.visible = want.planet;
    if (want.planet) {
      const p = world.pos;
      p.z += d * 0.045;
      if (p.z > z - 40) p.set(-62 - Math.random() * 40, 6, z - 190);
      world.setPos(p.x, p.y, p.z);
    }
  }

  /**
   * ★ **배가 돈다** (PLAN2H §4-4 · game/drift.js).
   *
   *   자세 제어가 죽으면 창밖이 기운다. 밖을 통째로 굴리는 것이라
   *   **어느 방에 있든 보인다** — 곁방 창에서도, 관측실에서도.
   *   고장 하나를 배 전체로 말하는 유일한 수단이고, 지금까지 고장은
   *   배너 한 줄과 덜그럭 소리뿐이었다.
   *
   *   ★ 배를 굴리지 않고 **밖을 굴린다.** 배(선체·방·물건)를 굴리면
   *     걸어다니는 사람과 충돌이 통째로 어긋난다 — 정비공이 벽을 뚫는다.
   *     보이는 것만 굴리면 「배가 돈다」는 읽히고 손은 멀쩡하다.
   */
  let driftRoll = 0;
  const roll = (rad) => { driftRoll = rad; };

  /**
   * ★★ **선체 자세** (v60). 세 축을 밖에서 받는다 — 값은 `game/flight.js`
   *   가 굴리고, 여기는 **보여 주기만** 한다 (순수/그림 가르기).
   */
  const att = { pitch: 0, yaw: 0, roll: 0 };
  // ★★★ **v66 — `yaw` 가 빠져 있었다. 그게 「핸들 운전이 안되잔아」다.**
  //   조종간 좌우(마우스 X · A/D)는 `fly3.yaw` 를 움직이고, 그 값이 항로
  //   이탈·잔해 회피·조준 기수각까지 다 먹인다. 그런데 **창밖 그룹의
  //   `rotation.y` 를 아무도 안 물렸다** — 숫자는 다 도는데 별이 한 톨도
  //   안 움직였다. 사람에게는 「안 먹는다」와 완전히 같다.
  //   계통 검사는 전부 초록이었다. **눈에만 보이는 종류**였기 때문이다
  const setAttitude = (a) => {
    att.pitch = a.pitch ?? 0; att.roll = a.roll ?? 0; att.yaw = a.yaw ?? 0;
  };

  return {
    update, setRegion, roll, setLand, setAttitude,
    // ★★★ v69 — 창밖의 표적과 탄. **창밖 그룹에 매달아야** 배를 틀 때
    //   같이 흐른다 — 따로 매달면 조종간을 틀어도 적이 안 움직인다
    targets, shots, salvage,
    /** ★ v79 — 광학 창의 카메라가 여기 매달린다. 표적 좌표가 이 그룹 기준이라
     *   다른 데 매달면 배를 틀 때마다 좌표를 두 번 옮기게 된다 */
    group: out,
    get region() { return regionKey; },
    /**
     * ★★★ v91 — **하늘이 지금 얼마나 기울어 있나** (rad).
     *
     *   사장님 「**왜 락온은 왼쪽인데 적은 우측 상단에 있지?**」
     *
     *   ★ 배는 안 굴리고 **하늘만 굴린다**(v60 짐벌). 그런데 HUD 판은
     *     조종석에 붙박이라 **안 돈다.** 그래서 배를 기울일수록 표식이
     *     적에게서 **원을 그리며 벗어난다** — 화소로 쟀다:
     *       롤 0도 → 4화소 · 15도 → 10 · 30도 → 23 · **45도 → 36화소**
     *     (사장님 화면은 먼지 줄이 비스듬했다. 즉 기울어 있었다)
     *   ★★ HUD 는 **하늘 위에 얹히는 판**이므로 하늘과 같이 돌아야 한다.
     *     실제 전투기는 조종사와 HUD 가 같이 도니 문제가 안 생기는데,
     *     이 배는 거주 구획이 짐벌로 수평을 지키므로 **HUD 만 따로 돌린다**
     */
    get skyRoll() { return out.rotation.z; },
    /** 검사가 「화면이 정말 바뀌었나」를 묻는다 — 고도·발광·땅 */
    get view() {
      return {
        alt: +altOf().toFixed(3), glow: +glowOf().toFixed(3),
        ground: groundG.visible, groundY: +groundG.position.y.toFixed(1),
        sky: `#${bg.getHexString()}`, planetScale: +world.planet.scale.x.toFixed(2),
        // ★★ **v57 — 「별이 흐르나」를 화면 없이 물을 수 있어야 한다.**
        //   이 판에서 고친 것이 정확히 그것이라, 여기 안 내놓으면
        //   `space-sky.js` 는 「예쁜가」밖에 못 묻는다.
        //   `star0` 은 첫 별의 버퍼 z — **한 번도 안 변해야 한다.**
        //   `dust0` 은 첫 먼지의 z — **변해야 한다.** 둘을 나란히 놓는다
        star0: +stars.points.geometry.attributes.position.array[2].toFixed(3),
        dust0: +dust.points.geometry.attributes.position.array[2].toFixed(3),
        // ★★★ v87 — **속도감은 점이 아니라 줄이 만든다.** 「급가속할 때만
        //   줄이 켜지나」를 여기서 묻는다 — 등속에 줄이 있으면 거짓말이다
        streak: dust.streak.on, streakLen: dust.streak.len,
        // ★★★ 세계 좌표 길이는 「보이나」의 답이 **아니다** — 화소로도 잰다
        streakPx: dust.streakPx(camRef, globalThis.innerWidth, globalThis.innerHeight),
        // 천구가 눈을 따라온 만큼. 걸어가면 이게 따라 움직여야 별이 안 밀린다
        domeZ: +stars.points.position.z.toFixed(2),
        band: +band.mesh.material.uniforms.uFade.value.toFixed(3),
        starFade: +stars.points.material.uniforms.uFade.value.toFixed(3),
        cut: Math.round(stars.points.material.uniforms.uCut.value),
        // ★ **별 밀도** (8판 · 성간 공백). 「비어 보이나」를 눈으로 판정하면
        //   덜 갈아탄 화면을 「안 바뀌었다」로 읽는다 — 색 갈아타기는 6초라
        //   헤드리스에서는 실제로 2분이 걸린다. 숫자로 묻는다
        stars: +cur.stars.toFixed(3), wantStars: want.stars,
      };
    },
  };
}


// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **레이더 HUD** — 앉으면 눈앞에 뜬다 (v78)
//
//  사장님 「레이더가 **hud처럼 나와야지. 앉아있을때는 알 수가 없잔아.**
//          직관적으로 바꿔」
//
//  ★ 맞는 말이다. 레이더는 **콘솔에 박힌 판**이라 보려면 고개를 숙여야
//    하는데, 조종석에 앉으면 시선이 창으로 올라간다 (v63). 즉 **싸우는
//    동안에는 레이더를 볼 수가 없었다** — 화면 밖을 보는 유일한 계기인데.
//
//  ★★ 콘솔의 판은 **그대로 둔다.** 그건 배에 실제로 달린 계기이고,
//    서서 들여다보는 자리다. HUD 는 **앉았을 때의 같은 계기**다 —
//    상태창(v69)이 이미 그 규약으로 서 있으므로 새 문법이 아니다.
//
//  ★ 그리는 것은 `drawRadar` **한 곳**이다. 두 벌로 그리면 언젠가
//    한쪽만 고쳐지고, 그때 어긋남은 화면으로 원인을 못 찾는다
// ══════════════════════════════════════════════════════════════════════════
export function buildRadarHud(w, h) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * 900);
  cv.height = Math.round(h * 900);
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map: tex, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false,
      // ★ 상태창과 **같은 불투명도**. 둘이 다르면 하나가 더 급해 보인다
      opacity: 0.52,
    }),
  );
  mesh.renderOrder = 941;
  mesh.visible = false;
  return {
    mesh,
    redraw(s) {
      // ★ 앉아 있을 때만. 걸어다니는 동안 계기가 따라다니면 안 된다
      mesh.visible = !!s.on;
      if (!s.on) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      drawRadar(ctx, cv.width, cv.height, s);
      tex.needsUpdate = true;
    },
  };
}
