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
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { KINDS, TARGET, rangeWord } from '../game/target-table.js';

const FG = '#8fe6c0';
const DIM = 'rgba(143,230,192,.45)';
const HOT = '#ff9a5c';

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
  ctx.fillStyle = '#03100c';
  ctx.fillRect(0, 0, w, h);
  const f = (k) => Math.round(h * k);

  // ★ 안 앉아 있으면 **꺼져 있다.** 늘 켜 두면 「지금 겨누는 중인가」가 안 읽힌다
  if (!s.on) {
    ctx.fillStyle = DIM;
    ctx.font = `600 ${f(0.11)}px system-ui, sans-serif`;
    ctx.fillText('조준경 — 앉으면 켜집니다', w * 0.07, h * 0.54);
    return;
  }

  // 눈금 — 방위·고도를 화면에 편다
  const cx = w / 2, cy = h / 2;
  const sx = (w * 0.5) / TARGET.azLimit;   // 도 → 화소
  const sy = (h * 0.5) / TARGET.elLimit;
  ctx.strokeStyle = 'rgba(143,230,192,.13)';
  ctx.lineWidth = 1;
  for (let a = -60; a <= 60; a += 20) {
    const x = cx + a * sx;
    ctx.beginPath(); ctx.moveTo(x, h * 0.08); ctx.lineTo(x, h * 0.92); ctx.stroke();
  }
  for (let e = -30; e <= 30; e += 15) {
    const y = cy - e * sy;
    ctx.beginPath(); ctx.moveTo(w * 0.04, y); ctx.lineTo(w * 0.96, y); ctx.stroke();
  }

  // ── 떠도는 것들 ──────────────────────────────────────────
  const aimAz = s.az ?? 0, aimEl = s.el ?? 0;
  let near = null, nearD = 1e9;
  for (const t of s.list ?? []) {
    const x = cx + (t.az - 0) * sx;
    const y = cy - (t.el - 0) * sy;
    const far = !t.inRange;
    // 가까울수록 크게 — 거리가 크기로 읽혀야 「기다렸다 쏜다」가 생긴다
    const r = Math.max(h * 0.035, h * 0.11 * (1 - t.dist / (TARGET.spawn[1] * 1.1)));
    ctx.strokeStyle = far ? 'rgba(143,230,192,.28)' : FG;
    glyph(ctx, t.kind, x, y, r);
    const d = Math.hypot(t.az - aimAz, t.el - aimEl);
    if (d < nearD) { nearD = d; near = { t, x, y, r }; }
    if (t.hp < (KINDS[t.kind]?.hits ?? 1)) {
      // 한 번 맞은 것 — 금이 갔다
      ctx.strokeStyle = HOT;
      ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.stroke();
    }
  }

  // ── 십자선 — **WASD 가 움직이는 것** ─────────────────────
  const ax = cx + aimAz * sx, ay = cy - aimEl * sy;
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
  if (locked) {
    // 물렸다 — 네 귀퉁이가 좁혀진다. **쏘면 맞는다**를 이걸로 안다
    ctx.strokeRect(near.x - near.r * 1.5, near.y - near.r * 1.5, near.r * 3, near.r * 3);
  }

  // ── 아래 한 줄 — **숫자로 안 띄운다** ────────────────────
  ctx.fillStyle = locked ? HOT : DIM;
  ctx.font = `700 ${f(0.085)}px system-ui, sans-serif`;
  const word = !near ? '떠도는 것이 없습니다'
    : locked ? `${KINDS[near.t.kind].name} — 물렸습니다`
      : `${KINDS[near.t.kind].name} · ${rangeWord(near.t.dist)}`;
  ctx.fillText(word, w * 0.05, h * 0.95);

  if (s.cool > 0) {
    ctx.fillStyle = DIM;
    ctx.textAlign = 'right';
    ctx.font = `700 ${f(0.08)}px ui-monospace, monospace`;
    ctx.fillText('재는 중', w * 0.95, h * 0.95);
    ctx.textAlign = 'left';
  }
}

/** 조준경 한 장 — turret.js 가 후드 안에 끼운다 */
export function buildSight(width = 0.66, height = 0.5) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 384;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: tex }),
  );
  mesh.name = '조준경';
  return {
    mesh,
    redraw(s) { draw(ctx, cv.width, cv.height, s || {}); tex.needsUpdate = true; },
  };
}
