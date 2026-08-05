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
// 정면에서 좌우로 꺾여 들어오는 여섯 점. **평면 하나가 아니라 꺾인 띠**다 —
// 이것 하나로 「감싸는 조종석」이 되는지 아닌지가 갈린다.
export const CANOPY = [
  [-3.00, -7.40],
  [-2.55, -8.85],
  [-1.05, -9.46],
  [1.05, -9.46],
  [2.55, -8.85],
  [3.00, -7.40],
];
/** 콘솔이 그리는 호. **충돌도 이 값을 읽는다** — 두 곳에 적으면 갈라진다 */
export const CONSOLE_PTS = [
  [-2.30, -7.95], [-1.30, -8.62], [-0.45, -8.88],
  [0.45, -8.88], [1.30, -8.62], [2.30, -7.95],
];

/** 좌석이 서 있는 자리. 충돌이 같이 읽는다 */
export const SEATS = [[-1.05, -6.95], [1.05, -6.95]];

const SILL = 0.82;      // 창 아래끝
// 조종간이 서는 z. 좌석(-6.95)보다 앞, 콘솔(-7.95~)보다 뒤 — **둘 사이**
const YOKE_Z = -7.42;
// 조종간 가로대 높이.
// ★ 1.06 에서 올렸다. 그 높이에서는 **서서 자연스럽게 내려다보는 각도**
//   (고개 -0.2 쯤)에 안 걸리고, -0.30 까지 숙여야 겨우 한가운데 왔다.
//   콘솔 상판이 0.86 이므로 1.18 이면 여전히 「상판에서 올라온 기둥 위」로
//   읽히면서 눈에는 먼저 들어온다. 판정 상자도 같이 키웠다 —
//   **작은 것을 정확히 겨누게 하는 건 어려움이 아니라 짜증이다**
const YOKE_Y = 1.18;
const HEAD = 2.34;      // 창 위끝

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

/** 열 — 1단계에서 실제로 도는 유일한 수치 */
function drawHeat(ctx, w, h, s) {
  bg(ctx, w, h);
  label(ctx, w, h, '열 · HEAT');
  const t = Math.max(0, Math.min(1, s.heat / 100));
  const hot = t > 0.62;
  const pad = h * 0.07, bw = w - pad * 2, by = h * 0.28, bh = h * 0.16;
  ctx.fillStyle = hot ? '#ff6a4a' : '#5fe0a8';
  ctx.fillRect(pad, by, bw * t, bh);
  ctx.strokeStyle = DIM;
  ctx.strokeRect(pad, by, bw, bh);
  ctx.strokeStyle = 'rgba(255,140,90,.85)';
  ctx.beginPath();
  ctx.moveTo(pad + bw * 0.62, by - h * 0.04); ctx.lineTo(pad + bw * 0.62, by + bh + h * 0.04); ctx.stroke();
  ctx.fillStyle = hot ? '#ffb0a0' : FG;
  ctx.font = `700 ${Math.round(h * 0.3)}px ui-monospace, monospace`;
  ctx.fillText(String(Math.round(s.heat)), pad, h * 0.86);
  ctx.font = `600 ${Math.round(h * 0.1)}px system-ui, sans-serif`;
  ctx.fillStyle = hot ? '#ffb0a0' : DIM;
  ctx.fillText(s.cooling ? '냉각 열림' : '냉각 막힘', w * 0.45, h * 0.86);
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

  // ── 캐노피 · 창틀 · 띠조명 ────────────────────────────
  for (let i = 0; i < CANOPY.length - 1; i++) {
    const a = CANOPY[i], b = CANOPY[i + 1];
    pane(g, a, b, SILL, HEAD, GLASS);                 // 유리
    pane(g, a, b, 0, SILL, PANEL, 0.14);              // 아래 선체
    pane(g, a, b, HEAD, H, FRAME, 0.14);              // 위 선체
    rail(g, a, b, SILL - 0.06, FRAME, 0.2, 0.14);     // 아래 창틀
    rail(g, a, b, HEAD + 0.06, FRAME, 0.2, 0.14);     // 위 창틀
    // ★ 띠조명. 참고 사진에서 이게 방의 성격을 절반쯤 만들고 있었다
    rail(g, a, b, HEAD - 0.02, stripMat(BLUE), 0.05, 0.035, 0);
  }
  // 창 사이 기둥(멀리언) — 없으면 창이 한 장짜리로 보인다
  for (const p of CANOPY) {
    box(g, 0.16, H, 0.16, FRAME, p[0], H / 2, p[1]);
  }

  // ── 머리 위 창 ────────────────────────────────────────
  // 참고 사진에서 제일 인상적이었던 것. 위를 보면 우주가 있다
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.5), GLASS);
  roof.rotation.x = Math.PI / 2;
  roof.position.set(0, H - 0.02, -8.62);
  g.add(roof);
  for (const x of [-1.7, 0, 1.7]) box(g, 0.12, 0.14, 1.6, FRAME, x, H - 0.07, -8.62);
  box(g, 3.6, 0.14, 0.14, FRAME, 0, H - 0.07, -7.86);
  box(g, 3.3, 0.04, 0.05, stripMat(BLUE), 0, H - 0.15, -7.82);

  // ── 천장 리브 ─────────────────────────────────────────
  // 민판 천장이 제일 싸구려로 보인다. 구조재를 지르면 배가 된다
  for (let i = 0; i < 4; i++) {
    const z = -7.4 + i * 1.05;
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
  const CONSOLE = CONSOLE_PTS;
  for (let i = 0; i < CONSOLE.length - 1; i++) {
    const a = CONSOLE[i], b = CONSOLE[i + 1];
    pane(g, a, b, 0, 0.86, DARK, 0.5);                 // 콘솔 몸통
    rail(g, a, b, 0.88, FRAME, 0.52, 0.06);            // 상판
  }

  const DRAWERS = [drawShip, drawPower, drawHeat, drawCourse, drawSign, drawLog];
  const WID = [0.72, 0.82, 0.94, 0.82, 0.62, 0.62];
  for (let i = 0; i < CONSOLE.length - 1; i++) {
    const a = CONSOLE[i], b = CONSOLE[i + 1];
    const s = seg(a, b);
    // ★ 테두리와 화면을 **한 묶음(Group)** 으로 만든다.
    //   처음엔 테두리를 만들고 `position.add(0,0,0.02)` 로 밀었는데, 그건
    //   **월드 좌표**라 각도가 있는 화면은 테두리가 앞을 덮어 버렸다 —
    //   화면 여섯 장이 전부 민판으로 보였고, 코드에는 아무 이상이 없었다.
    //   묶어 두면 안쪽 좌표라 각도가 어떻든 앞뒤가 안 바뀐다.
    const slot = new THREE.Group();
    slot.position.set(s.mx, 1.16, s.mz + 0.14);
    slot.rotation.y = s.rot;
    slot.rotateX(-0.36);                               // 사람 쪽으로 눕힌다
    g.add(slot);

    const bez = new THREE.Mesh(new THREE.BoxGeometry(WID[i] + 0.07, 0.57, 0.04), FRAME);
    bez.position.z = -0.02;
    slot.add(bez);

    const sc = makeScreen(WID[i], 0.5, DRAWERS[i]);
    sc.mesh.position.z = 0.012;
    slot.add(sc.mesh);
    screens.push(sc);

    // ★ 여기 점광원 둘이 있었는데 **뺐다.**
    //   점광원은 화면에 보이는 모든 픽셀에서 계산된다 — 이 방 한구석을
    //   조금 파랗게 하려고 배 전체의 픽셀값을 두 번 더 계산하는 셈이었다.
    //   화면 자체가 이미 스스로 빛나는(MeshBasicMaterial) 물건이라,
    //   빼도 「화면이 밝다」는 그대로다. 잃은 것은 콘솔 상판의 옅은 파란
    //   반사뿐이고, 그건 환경맵(main.js)이 절반쯤 대신한다.
  }

  // 콘솔 위 작은 스위치들 — 손이 갈 데가 많아 보여야 한다
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    const x = -2.1 + t * 4.2;
    const z = -8.0 - Math.cos((t - 0.5) * 2.0) * 0.85;
    box(g, 0.07, 0.045, 0.07, i % 3 === 0 ? stripMat(AMBER) : DARK, x, 0.92, z);
  }

  // ── 좌석 둘 ───────────────────────────────────────────
  // 크기를 알려 주는 물건. 이게 없으면 방이 얼마나 큰지 안 읽힌다
  // ★ 처음 만든 좌석은 **너무 컸다.** 등받이가 눈높이까지 올라와 조종석
  //   한가운데를 막았다 — 앉은 사람 것인데 선 사람 눈으로 만들었다.
  //   앉은 어깨높이(바닥에서 1.25)를 넘지 않게 낮췄다.
  for (const [sx, sz] of SEATS) {
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

  // 기둥 — 콘솔 상판(0.86)에서 올라온다. 어디서 나온 물건인지 보여야 한다
  box(g, 0.13, YOKE_Y - 0.80, 0.13, FRAME, 0, (0.80 + YOKE_Y) / 2, YOKE_Z).name = '조종간기둥';
  // 밑동 덮개 — 셔틀 문법. 급한 조작기는 **움푹한 자리에 앉는다**
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.06, 12), DARK);
  collar.name = '조종간밑동';
  collar.position.set(0, 0.83, YOKE_Z);
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
    // 조종간이 기운 만큼 눕는다 — **먹고 있다는 것이 눈에 보여야** 한다
    const tilt = (state.lane ?? 0) * 0.5;
    for (const y of yokes) y.rotation.z = -tilt;
  }
  return { update, yokeHit };
}

/**
 * 창밖 — **여기가 이 게임 화면의 절반이다.**
 *
 * 참고 사진에서 아름다운 부분은 전부 창밖이었다 (행성 · 성운 · 은하 · 다른 배).
 * 그런데 그건 **그림이라 내가 안 만든다.** 지금은 별과 민짜 구(球)로 자리만
 * 잡아 두고, 규격은 `core/asset-table.js` 의 `sky/*` 에 적어 뒀다.
 * 그림이 오면 이 함수는 통째로 걷힌다 — 다듬는 데 시간을 더 쓰지 않는다.
 */
export function buildOutside(scene, z) {
  const out = new THREE.Group();
  scene.add(out);

  // ── 먼 하늘 ─────────────────────────────────────────────
  // 아주 멀어서 **거의 안 움직인다.** 이건 배경이고, 그림(sky/deep)이
  // 오면 통째로 이걸로 바뀐다.
  const FAR = 2200;
  const fp = new Float32Array(FAR * 3);
  const fc = new Float32Array(FAR * 3);
  for (let i = 0; i < FAR; i++) {
    const r = 200 + Math.random() * 90;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    // ★ **배를 통째로 감싼다.** 전에는 `z - abs(...)` 라 별이 조종석
    //   **앞쪽으로만** 뿌려졌다. 조종석에서는 멀쩡해 보였지만, 곁방 창은
    //   옆으로 나 있어서 구멍을 뚫어도 **볼 것이 하나도 없었다.**
    //   관측실이 「밖을 본다」가 목적인데 밖이 없었던 이유의 절반이다
    //   (docs/space/REF.md).
    fp[i * 3] = r * Math.sin(ph) * Math.cos(th);
    fp[i * 3 + 1] = r * Math.cos(ph) * 0.6;
    fp[i * 3 + 2] = z + r * Math.sin(ph) * Math.sin(th);
    const w = 0.62 + Math.random() * 0.32;
    fc[i * 3] = w; fc[i * 3 + 1] = w; fc[i * 3 + 2] = 1;
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  fg.setAttribute('color', new THREE.BufferAttribute(fc, 3));
  const farStars = new THREE.Points(fg, new THREE.PointsMaterial({ size: 0.85, sizeAttenuation: true, vertexColors: true }));
  out.add(farStars);

  // ── 가까이 흐르는 것 ────────────────────────────────────
  //
  // ★ 이게 없어서 **배가 서 있었다.** 사장님 지적이 정확했다 —
  //   「목적지 없이 항해한다」가 전제인데 창밖이 정지 화면이면 그 전제가
  //   통째로 무너진다. 별을 아무리 많이 뿌려도 **안 움직이면 벽지**다.
  //
  //   먼 것만 있으면 시차(parallax)가 안 생겨 움직여도 티가 안 난다.
  //   그래서 **가까운 층을 따로 둔다.** 깊이를 넓게 흩어 놓으면 원근 때문에
  //   가까운 것은 빠르게, 먼 것은 느리게 지나간다 — 시차는 공짜로 나온다.
  const NEAR = 900;
  const SPREAD = 90;          // 좌우·위아래로 흩어지는 폭
  // ★ 되돌리는 지점이 **배 안쪽**이었다 (z + 6 = 조종석 한복판).
  //   그래서 잔해 덩어리가 조종석 안으로 날아 들어와, 화면 절반을 덮는
  //   흰 사각형으로 보였다 — 가까운 면 하나가 실내 조명을 받은 것이었다.
  //   창 바로 앞에서 되돌린다. 어차피 그 뒤는 선체가 가려서 안 보인다.
  const Z_NEAR = z - 0.5;     // 이보다 뒤로 가면 되돌린다
  const Z_FAR = z - 190;      // 되돌아가는 자리
  const np = new Float32Array(NEAR * 3);
  const nc = new Float32Array(NEAR * 3);
  const place = (i, zz) => {
    // 창 정면에만 몰리지 않게 원판으로 흩는다
    const a = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random()) * SPREAD;
    np[i * 3] = Math.cos(a) * rad;
    np[i * 3 + 1] = Math.sin(a) * rad * 0.7;
    np[i * 3 + 2] = zz;
    const w = 0.75 + Math.random() * 0.25;
    nc[i * 3] = w; nc[i * 3 + 1] = w * 0.97; nc[i * 3 + 2] = 1;
  };
  for (let i = 0; i < NEAR; i++) place(i, Z_FAR + Math.random() * (Z_NEAR - Z_FAR));
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', new THREE.BufferAttribute(np, 3));
  ng.setAttribute('color', new THREE.BufferAttribute(nc, 3));
  const nearStars = new THREE.Points(ng, new THREE.PointsMaterial({ size: 1.15, sizeAttenuation: true, vertexColors: true }));
  out.add(nearStars);

  // ── 행성 ────────────────────────────────────────────────
  // **자리만 잡아 둔 것.** 그림(sky/planet)이 오면 이 구는 사라진다.
  //
  // ★ 조명을 안 쓴다 (MeshBasicMaterial). 처음엔 태양을 하나 놓았는데,
  //   DirectionalLight 는 거리가 없어서 **배 안까지 같이 밝혔다** —
  //   창밖을 예쁘게 하려다 실내 조명이 통째로 망가지는 종류의 실수다.
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(46, 40, 28),
    new THREE.MeshBasicMaterial({ color: 0x22406b }),
  );
  planet.position.set(-62, 6, z - 108);
  out.add(planet);
  const air = new THREE.Mesh(
    new THREE.SphereGeometry(48.6, 40, 28),
    new THREE.MeshBasicMaterial({ color: 0x5aa8ff, transparent: true, opacity: 0.22, side: THREE.BackSide }),
  );
  air.position.copy(planet.position);
  out.add(air);

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

  const nearPos = ng.attributes.position;
  const nearCol = ng.attributes.color;

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
  function update(dt, speed, lane = 0, inc = null) {
    // 배가 기울면 창밖이 반대로 밀린다 — 그게 「내가 움직였다」로 읽힌다
    out.position.x += (-lane * 3.2 - out.position.x) * Math.min(1, dt * 3);
    out.rotation.z += (lane * 0.06 - out.rotation.z) * Math.min(1, dt * 3);

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

    const d = speed * want.speed * dt;
    const arr = nearPos.array, col = nearCol.array;
    const shown = Math.round(NEAR * cur.stars);
    for (let i = 0; i < NEAR; i++) {
      const k3 = i * 3;
      arr[k3 + 2] += d;
      if (arr[k3 + 2] > Z_NEAR) place(i, Z_FAR);
      // 밀도는 **색을 죽여서** 흉내 낸다. 개수를 바꾸면 버퍼를 다시 만들어야
      // 하는데, 그건 구역이 바뀔 때마다 뚝 끊긴다
      const on = i < shown ? 1 : 0;
      col[k3] = cur.tint.r * on;
      col[k3 + 1] = cur.tint.g * on;
      col[k3 + 2] = cur.tint.b * on;
    }
    nearPos.needsUpdate = true;
    nearCol.needsUpdate = true;

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

    // 먼 하늘은 아주 천천히 돈다. 배가 미세하게 틀어지고 있다는 뜻이고,
    // 이게 있어야 오래 봐도 「멈춰 있다」는 느낌이 안 든다
    farStars.rotation.y += dt * 0.0016;

    // 행성 — 구역에 따라 있고 없다
    const showPlanet = want.planet;
    planet.visible = showPlanet;
    air.visible = showPlanet;
    if (showPlanet) {
      planet.position.z += d * 0.045;
      air.position.copy(planet.position);
      if (planet.position.z > z - 40) {
        planet.position.set(-62 - Math.random() * 40, 6, z - 190);
        air.position.copy(planet.position);
      }
    }
  }

  return { update, setRegion, get region() { return regionKey; } };
}
