// ══════════════════════════════════════════════════════════════════════════
//  보급의 물건들 — 온실 계기 · 에어록 윈치 · 접수구 (PLAN §5).
//
//  ★ 식량 숫자는 **온실에만** 있다
//    화면 구석에 바를 달면 그 순간 이 게임은 「자원 관리 UI 를 보는 게임」이
//    된다 (PLAN §5-2 「체력바를 안 만든다」). 몸 상태는 손이 말하고 —
//    굶으면 떨린다 — 숫자는 식량이 자라는 방에 가야 있다.
//    계기 넷이 전부 다른 방에 있고 전부 다른 것을 말한다.
//
//  ★ 윈치는 **잡고 있는 것**이다
//    누르는 순간 광석이 들어오면 「버튼을 연타하는 게임」이 된다.
//    잡고 있는 동안 배는 멈춰 있고, 멈춰 있는 동안 위험이 쌓인다 —
//    그 저울이 「한 통만 더」다 (PLAN §5-3).
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { FOOD, PARTS, ORE, WINCH, TRADE } from '../game/supply-table.js';

function makeScreen(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * 420);
  cv.height = Math.round(h * 420);
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  return { mesh, redraw: (s) => { draw(ctx, cv.width, cv.height, s); tex.needsUpdate = true; } };
}

const GREEN = '#9fe08a';
const GDIM = 'rgba(159,224,138,.4)';
const BAD = '#ff7a55';

/** 온실 계기 — **「다음 거점까지 갈 식량이 있나」** 하나만 답한다 */
function drawFood(ctx, w, h, s) {
  ctx.fillStyle = '#0c1a0c';
  ctx.fillRect(0, 0, w, h);
  const f = (k) => Math.round(h * k);
  ctx.fillStyle = GDIM;
  ctx.font = `600 ${f(0.085)}px system-ui, sans-serif`;
  ctx.fillText('식량', w * 0.05, h * 0.13);

  const t = Math.max(0, Math.min(1, (s.food ?? 0) / FOOD.max));
  const low = (s.food ?? 0) < FOOD.shaky;
  const pad = w * 0.05, bw = w - pad * 2, by = h * 0.2, bh = h * 0.17;
  ctx.fillStyle = low ? BAD : GREEN;
  ctx.fillRect(pad, by, bw * t, bh);
  ctx.strokeStyle = GDIM; ctx.lineWidth = 1;
  ctx.strokeRect(pad, by, bw, bh);
  // 손이 떨리기 시작하는 선 — 넘기 전에 알아야 대비가 된다
  ctx.strokeStyle = 'rgba(255,122,85,.85)';
  ctx.beginPath();
  const wx = pad + bw * (FOOD.shaky / FOOD.max);
  ctx.moveTo(wx, by - h * 0.03); ctx.lineTo(wx, by + bh + h * 0.03); ctx.stroke();

  // ★ 이 게임의 질문 — 「다음 거점까지 갈 식량이 있나?」
  const legs = s.legsOnFood ?? 0;
  ctx.fillStyle = legs < 1 ? BAD : GREEN;
  ctx.font = `700 ${f(0.26)}px ui-monospace, monospace`;
  ctx.fillText(legs.toFixed(1), pad, h * 0.72);
  ctx.fillStyle = GDIM;
  ctx.font = `600 ${f(0.095)}px system-ui, sans-serif`;
  ctx.fillText(legs < 1 ? '구간 — 다음 거점까지 못 간다' : '구간을 더 갈 수 있다',
    pad + w * 0.24, h * 0.7);

  ctx.fillStyle = low ? BAD : GDIM;
  ctx.font = `600 ${f(0.09)}px system-ui, sans-serif`;
  ctx.fillText(low ? '손이 떨린다' : `광석 ${Math.floor(s.ore ?? 0)} · 부품 ${s.parts ?? 0}`,
    pad, h * 0.92);
}

export function buildFoodGauge(parent, at, MAT) {
  const g = new THREE.Group();
  g.position.set(at.x, 0, at.z);
  g.rotation.y = at.ry;
  parent.add(g);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.56, 0.06), MAT.body);
  frame.position.set(0, 1.55, -0.02);
  g.add(frame);
  const sc = makeScreen(0.92, 0.48, drawFood);
  sc.mesh.position.set(0, 1.55, 0.02);
  g.add(sc.mesh);
  return { at, update: (s) => sc.redraw(s) };
}

// ── 에어록 ────────────────────────────────────────────────
const AM = '#ffd27a';
const ADIM = 'rgba(255,210,122,.42)';

/** 윈치 계기 — 이번 통이 얼마나 찼나 */
function drawWinch(ctx, w, h, s) {
  ctx.fillStyle = '#1c1608';
  ctx.fillRect(0, 0, w, h);
  const f = (k) => Math.round(h * k);
  ctx.fillStyle = ADIM;
  ctx.font = `600 ${f(0.13)}px system-ui, sans-serif`;
  ctx.fillText(s.moving ? '추진 중 — 못 끈다' : '윈치', w * 0.06, h * 0.2);

  const t = Math.max(0, Math.min(1, (s.hauled ?? 0) / WINCH.load));
  const pad = w * 0.06, bw = w - pad * 2, by = h * 0.3, bh = h * 0.22;
  ctx.fillStyle = s.moving ? 'rgba(255,210,122,.25)' : AM;
  ctx.fillRect(pad, by, bw * t, bh);
  ctx.strokeStyle = ADIM; ctx.lineWidth = 1;
  ctx.strokeRect(pad, by, bw, bh);

  ctx.fillStyle = AM;
  ctx.font = `700 ${f(0.24)}px ui-monospace, monospace`;
  ctx.fillText(`${Math.floor(s.ore ?? 0)}`, pad, h * 0.9);
  ctx.fillStyle = ADIM;
  ctx.font = `600 ${f(0.11)}px system-ui, sans-serif`;
  ctx.fillText(`광석 · ${s.loads ?? 0}통`, pad + w * 0.26, h * 0.88);
}

/**
 * 윈치 — 드럼과 손잡이. **잡고 있으면 끌어온다.**
 * 추진이 켜져 있으면 안 걸린다 — 멈춰야 캔다.
 */
export function buildWinch(parent, at, MAT, block) {
  const g = new THREE.Group();
  g.position.set(at.x, 0, at.z);
  g.rotation.y = at.ry;
  parent.add(g);

  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return m;
  };
  box(0.9, 0.5, 0.34, MAT.body, 0, 0.9, -0.1);          // 몸통
  box(0.94, 0.07, 0.4, MAT.metal, 0, 1.18, -0.08);      // 윗판

  // 드럼 — 돌아가는 것이 보여야 「먹고 있다」를 안다
  const drum = new THREE.Group();
  drum.position.set(0, 0.9, 0.14);
  drum.rotation.z = Math.PI / 2;
  g.add(drum);
  drum.add(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.5, 14), MAT.rail));
  for (const sx of [-0.26, 0.26]) {
    const cheek = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 16), MAT.metal);
    cheek.position.y = sx;
    drum.add(cheek);
  }
  // 손잡이 — 드럼에 매달려 같이 돈다
  const crank = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.3), MAT.rail);
  crank.position.set(0.3, 0.19, 0);
  drum.add(crank);

  const sc = makeScreen(0.62, 0.26, drawWinch);
  sc.mesh.position.set(0, 1.42, 0.02);
  sc.mesh.rotation.x = -0.18;
  g.add(sc.mesh);

  // ★ 조준 상자를 **눈높이 쪽으로** 키운다. 처음엔 0.65~1.35 였는데
  //   서서 내려다보는 각도에서는 조준선이 그 위로 지나갔다 —
  //   「윈치가 있는데 안 잡힌다」로 보인다
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 1.0, 0.44),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.set(0, 1.15, 0.16);
  g.add(hit);
  block(at.x, at.z, 0.48, 0.3, at.ry);

  return { at, hit, drum, update: (s) => sc.redraw(s) };
}

/** 접수구 계기 — 거점에서만 돈다. 상인은 얼굴이 없다 (PLAN §1) */
function drawTrade(ctx, w, h, s) {
  ctx.fillStyle = '#101a20';
  ctx.fillRect(0, 0, w, h);
  const f = (k) => Math.round(h * k);
  const on = s.atPort;
  ctx.fillStyle = on ? '#7fd4ff' : 'rgba(127,212,255,.3)';
  ctx.font = `700 ${f(0.15)}px system-ui, sans-serif`;
  ctx.fillText(on ? '접수구 — 열림' : '접수구 — 항행 중', w * 0.06, h * 0.24);

  ctx.fillStyle = 'rgba(127,212,255,.5)';
  ctx.font = `600 ${f(0.125)}px ui-monospace, monospace`;
  ctx.fillText(`광석 ${TRADE.ore}  →  식량 ${TRADE.food} · 부품 ${TRADE.parts}`, w * 0.06, h * 0.52);

  const ok = on && (s.ore ?? 0) >= TRADE.ore;
  ctx.fillStyle = ok ? '#7fd4ff' : 'rgba(255,122,85,.85)';
  ctx.font = `700 ${f(0.135)}px system-ui, sans-serif`;
  ctx.fillText(
    !on ? '거점에서만 받는다'
      : ok ? '잡고 있으면 넘어간다'
        : `광석이 ${Math.max(0, TRADE.ore - Math.floor(s.ore ?? 0))} 모자란다`,
    w * 0.06, h * 0.82,
  );
}

export function buildTradeHatch(parent, at, MAT, block) {
  const g = new THREE.Group();
  g.position.set(at.x, 0, at.z);
  g.rotation.y = at.ry;
  parent.add(g);
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); g.add(m); return m;
  };
  box(0.86, 0.9, 0.2, MAT.body, 0, 1.2, -0.06);
  box(0.66, 0.3, 0.1, MAT.faceD, 0, 0.98, 0.04);       // 구멍
  box(0.9, 0.06, 0.24, MAT.metal, 0, 1.68, -0.04);

  const sc = makeScreen(0.66, 0.3, drawTrade);
  sc.mesh.position.set(0, 1.42, 0.06);
  g.add(sc.mesh);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.8, 0.3),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.set(0, 1.2, 0.12);
  g.add(hit);

  return { at, hit, update: (s) => sc.redraw(s) };
}

export { FOOD, PARTS, ORE };
