// ══════════════════════════════════════════════════════════════════════════
//  진단대 — **정비실 작업대 위의 화면.** 계기 셋 중 마지막 (GAP.md §3-C).
//
//  ★ 셋이 서로 다른 것을 보여줘야 방이 셋일 이유가 있다
//
//      조종석   지금        열 · 자국 · 거리
//      관측실   어디로 가나  항로 · 압박 · 갈림길
//      정비실   다음        무엇이 닳았나 · 몇 걸음 남았나 · 무엇을 고쳤나
//
//    같은 것을 세 군데서 보여주면 두 방은 구경거리가 되고, 그 순간 왕복은
//    심부름이 된다. 동시에 두 방에 못 있는 것이 이 게임의 저울이다.
//
//  ★ **자리는 절대 안 알려준다**
//    계통(무엇이 닳았나)과 방(어디에 있나)은 다른 것이다. 방을 알려주는
//    순간 귀로 찾는 일이 사라지고, 그러면 진단이 심부름으로 돌아간다
//    (PLAN §3-1). 여기가 이 화면에서 제일 조심한 지점이다.
//
//  ★ 배너는 사라진다 — 여기는 안 사라진다
//    「열이 오르는데 냉각 계통은 멀쩡하다」를 놓치면 다시 볼 데가 없었다.
//    지금 열린 것과 방금 고친 것을 여기 남겨 둔다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { WEAR } from '../game/systems-table.js';
import { drawStatus } from './status.js';

const FG = '#ffc98a';
const DIM = 'rgba(255,201,138,.38)';
const BAD = '#ff7a55';

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

function draw(ctx, w, h, s) {
  ctx.fillStyle = '#1a1008';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,201,138,.08)';
  ctx.lineWidth = 1;
  for (let y = h * 0.06; y < h; y += h * 0.06) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const f = (k) => Math.round(h * k);

  ctx.fillStyle = DIM;
  ctx.font = `600 ${f(0.07)}px system-ui, sans-serif`;
  ctx.fillText('진단대 · 무엇이 닳았나', w * 0.04, h * 0.09);

  // ══ ★★★ **배의 상태 — 조종석과 같은 여섯 줄** (v69) ═══════════════
  //  사장님 「**운전석에 탔을때 외에도 다른 모니터에서 확인**할 수 있도록」.
  //
  //  ★ 여기가 그 「다른 모니터」다. 정비실은 **고치는 방**이고, 고치려면
  //    「지금 열이 몇인가 · 냉각이 도나 · 전력이 어디 가 있나」를 알아야
  //    한다 — 그걸 보려고 조종석까지 25m 를 걸어갔다 오는 것이 v68 이었다.
  //
  //  ★★ **같은 함수를 부른다** (`world/status.js drawStatus`). 여기서
  //    다시 그리면 두 화면이 반드시 갈라진다 — 이 저장소가 두 번 겪은 것.
  //    색만 이 방의 호박색으로 입힌다
  if (s.status) drawStatus(ctx, w * 0.60, h * 0.14, w * 0.36, h * 0.52, s.status, 'bench');

  // ── 계통별 마모 — **다음에 무엇이 터지나** ────────────
  const x0 = w * 0.04, bw = w * 0.32, bh = h * 0.075;
  WEAR.keys.forEach((k, i) => {
    const y = h * (0.17 + i * 0.115);
    const v = Math.max(0, Math.min(1, s.wear?.[k] ?? 0));
    const hot = v >= WEAR.warn;
    ctx.fillStyle = DIM;
    ctx.font = `600 ${f(0.075)}px system-ui, sans-serif`;
    ctx.fillText(WEAR.name[k], x0, y + bh * 0.85);
    ctx.strokeStyle = DIM; ctx.lineWidth = 1;
    ctx.strokeRect(x0 + w * 0.1, y, bw, bh);
    ctx.fillStyle = hot ? BAD : '#e0a35c';
    ctx.fillRect(x0 + w * 0.1, y, bw * v, bh);
    // 경고선 — 이 위로는 곧 터진다
    ctx.strokeStyle = 'rgba(255,122,85,.8)';
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.1 + bw * WEAR.warn, y - h * 0.012);
    ctx.lineTo(x0 + w * 0.1 + bw * WEAR.warn, y + bh + h * 0.012);
    ctx.stroke();
    ctx.fillStyle = hot ? BAD : DIM;
    ctx.font = `700 ${f(0.072)}px ui-monospace, monospace`;
    ctx.fillText(`${Math.round(v * 100)}%`, x0 + w * 0.1 + bw + w * 0.02, y + bh * 0.9);
  });

  // ── 지금 열린 것 — 증상과 남은 걸음 ────────────────────
  const oy = h * 0.56;
  ctx.strokeStyle = DIM;
  ctx.beginPath(); ctx.moveTo(x0, oy - h * 0.03); ctx.lineTo(w - x0, oy - h * 0.03); ctx.stroke();
  ctx.fillStyle = DIM;
  ctx.font = `600 ${f(0.055)}px system-ui, sans-serif`;
  ctx.fillText('지금', x0, oy + h * 0.04);

  const open = s.open ?? [];
  if (!open.length) {
    ctx.fillStyle = 'rgba(160,220,180,.9)';
    ctx.font = `700 ${f(0.075)}px system-ui, sans-serif`;
    ctx.fillText('이상 없음', x0 + w * 0.12, oy + h * 0.045);
  } else {
    open.slice(0, 2).forEach((o, i) => {
      const y = oy + h * (0.045 + i * 0.085);
      ctx.fillStyle = FG;
      ctx.font = `700 ${f(0.07)}px system-ui, sans-serif`;
      ctx.fillText(o.name, x0 + w * 0.12, y);
      ctx.fillStyle = DIM;
      ctx.font = `600 ${f(0.062)}px system-ui, sans-serif`;
      // ★ **증상만.** 어느 방인지는 여기서 절대 안 말한다 — 그건 귀가 찾는다
      ctx.fillText(o.lead, x0 + w * 0.12, y + h * 0.045);
      const left = o.steps - o.step;
      ctx.fillStyle = left > 1 ? BAD : DIM;
      ctx.font = `700 ${f(0.055)}px ui-monospace, monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(left > 1 ? `아직 ${left}군데` : '한 군데', w - x0, y);
      ctx.textAlign = 'left';
    });
  }

  // ── 고친 기록 — 배너는 사라지지만 여기는 남는다 ────────
  const ly = h * 0.79;
  ctx.strokeStyle = DIM;
  ctx.beginPath(); ctx.moveTo(x0, ly - h * 0.03); ctx.lineTo(w - x0, ly - h * 0.03); ctx.stroke();
  ctx.fillStyle = DIM;
  ctx.font = `600 ${f(0.055)}px system-ui, sans-serif`;
  ctx.fillText(`고친 것 ${s.fixed ?? 0}`, x0, ly + h * 0.035);
  (s.log ?? []).slice(0, 2).forEach((l, i) => {
    ctx.fillStyle = 'rgba(255,201,138,.6)';
    ctx.font = `600 ${f(0.058)}px system-ui, sans-serif`;
    ctx.fillText(`· ${l.reveal}`, x0 + w * 0.16, ly + h * (0.035 + i * 0.065));
  });

  // ── ★★ 영구 손상 — **안 없어지는 것** (PLAN2H §8) ────────
  // ★ 여기 말고 둘 데가 없다. 배너는 사라지고 손목은 「지금 할 일」만
  //   말하는데, 흉터는 **일이 아니라 배의 상태**다. 그리고 진단대가
  //   원래 「무엇이 닳았나」를 말하는 화면이므로 자리가 맞는다.
  //   **우회로까지 적는다** — 못 고치는 것에 길이 안 보이면 그건 벽이다
  const sc = s.scars ?? [];
  if (sc.length) {
    ctx.fillStyle = BAD;
    ctx.font = `700 ${f(0.058)}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText('영구 손상 · 못 고침', w - x0, ly + h * 0.035);
    ctx.textAlign = 'left';
    sc.slice(0, 2).forEach((c, i) => {
      const y = ly + h * (0.1 + i * 0.062);
      ctx.fillStyle = BAD;
      ctx.font = `700 ${f(0.056)}px system-ui, sans-serif`;
      ctx.fillText(`✕ ${c.name}`, x0 + w * 0.02, y);
      ctx.fillStyle = 'rgba(255,201,138,.55)';
      ctx.font = `600 ${f(0.05)}px system-ui, sans-serif`;
      ctx.fillText(`→ ${c.around}`, x0 + w * 0.30, y);
    });
  }
}

/**
 * 작업대 위에 화면을 세운다.
 * @param at {x, z, ry} 작업대 자리와 바라보는 쪽
 */
export function buildBench(parent, at, MAT) {
  const g = new THREE.Group();
  g.position.set(at.x, 0, at.z);
  g.rotation.y = at.ry;
  parent.add(g);

  // 받침대 — 화면이 허공에 떠 있으면 「UI」로 읽힌다. 물건에 붙어 있어야 한다
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.06), MAT.rail);
  // ★ 화면보다 **뒤에** 둔다. 0.06 에 뒀더니 기둥이 화면을 뚫고 나와
  //   가운데를 가렸다 — 화면을 찍어 보고 알았다
  post.position.set(0, 1.15, -0.02);
  post.castShadow = true;
  g.add(post);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.62, 0.05), MAT.body);
  frame.position.set(0, 1.62, 0.04);
  frame.rotation.x = -0.2;
  g.add(frame);

  const sc = makeScreen(0.9, 0.54, draw);
  sc.mesh.rotation.x = -0.2;
  sc.mesh.position.set(0, 1.62, 0.072);
  g.add(sc.mesh);

  return { at, update: (s) => sc.redraw(s) };
}
