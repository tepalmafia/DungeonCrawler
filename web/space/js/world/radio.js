// ══════════════════════════════════════════════════════════════════════════
//  무전기 — **에어록 벽에 붙은 한 대** (G 구조 신호 · 7판)
//
//  ★ 왜 에어록인가
//    받는 것이 **바깥문으로 들어오기** 때문이다. 무전을 다른 방에 두면
//    「잡고 있다가 뛰어가서 문을 연다」가 되는데, 그건 이 장면의 손짓이
//    아니다 — 여기서는 **한 방에서 두 동작**을 한다: 응답하고, 문을 연다.
//
//  ★ 평소에는 **꺼져 있다.** 2시간에 딱 한 번 켜지는 것이고, 늘 켜져
//    있으면 그 한 번이 안 무겁다. 꺼져 있을 때는 조준에도 안 잡힌다.
//
//  ★ **화면 하나에 다 말한다** — 지금 무엇을 하는 중인지. 조용히
//    잡고만 있으면 「되고 있나」를 알 수가 없다 (윈치에서 배운 것).
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { RESCUE, RSTEP } from '../game/rescue-table.js';

function makeScreen(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * 420); cv.height = Math.round(h * 420);
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  return { mesh, redraw(s) { draw(ctx, cv.width, cv.height, s); tex.needsUpdate = true; } };
}

function drawRadio(ctx, w, h, s) {
  ctx.fillStyle = '#0d1418';
  ctx.fillRect(0, 0, w, h);
  const f = (k) => Math.round(h * k);
  const step = s?.step ?? RSTEP.NONE;
  if (step === RSTEP.NONE) {
    ctx.fillStyle = 'rgba(150,170,190,.30)';
    ctx.font = `600 ${f(0.17)}px ui-monospace, monospace`;
    ctx.fillText('무전 — 잡히는 것 없음', w * 0.07, h * 0.6);
    return;
  }
  // ★ 신호가 오면 **초록이 아니라 주황**이다. 좋은 소식이 아니다 —
  //   응답하는 순간 나를 가리키게 된다
  const hot = step === RSTEP.ANSWERING;
  ctx.fillStyle = hot ? '#ffb45c' : '#8fd0ff';
  ctx.font = `700 ${f(0.19)}px system-ui, sans-serif`;
  const head = step === RSTEP.HEARD ? '신호 수신'
    : step === RSTEP.ANSWERING ? '송신 중'
      : step === RSTEP.NEAR ? '접현' : step === RSTEP.TOOK ? '수령 완료' : '신호 끊김';
  ctx.fillText(head, w * 0.07, h * 0.3);

  ctx.fillStyle = 'rgba(190,210,230,.62)';
  ctx.font = `600 ${f(0.13)}px system-ui, sans-serif`;
  const say = step === RSTEP.HEARD ? '잡으면 응답합니다'
    : step === RSTEP.ANSWERING ? '송신은 방송입니다'
      : step === RSTEP.NEAR ? '바깥문을 여십시오' : '';
  if (say) ctx.fillText(say, w * 0.07, h * 0.53);

  // 진행 막대 — 응답 중에만
  if (step === RSTEP.ANSWERING || step === RSTEP.NEAR) {
    const p = step === RSTEP.NEAR ? 1 : (s.at ?? 0);
    ctx.fillStyle = 'rgba(255,180,92,.18)';
    ctx.fillRect(w * 0.07, h * 0.68, w * 0.86, h * 0.17);
    ctx.fillStyle = '#ffb45c';
    ctx.fillRect(w * 0.07, h * 0.68, w * 0.86 * p, h * 0.17);
  }
}

/**
 * 에어록 벽의 무전기.
 * @returns `{ hit, update(s) }` — `hit` 은 조준 상자, `s` 는 `rescue.summary()`
 */
export function buildRadio(parent, at, MAT) {
  const g = new THREE.Group();
  g.position.set(at.x, 0, at.z);
  g.rotation.y = at.ry ?? 0;
  parent.add(g);

  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return m;
  };
  // 벽에 붙은 상자 — 두껍고 낮다. 손이 닿는 높이(1.25)에 온다
  box(0.62, 0.46, 0.2, MAT.body, 0, 1.28, 0);
  box(0.66, 0.06, 0.24, MAT.metal, 0, 1.53, 0);
  // 송수화기 — **잡는 것이 이것**이라 눈에 띄어야 한다
  const handset = box(0.12, 0.26, 0.1, MAT.rail, -0.36, 1.28, 0.02);
  handset.rotation.z = 0.12;
  // 줄 — 벽과 송수화기를 잇는다. 「뗄 수 있는 것」으로 읽힌다
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), MAT.rail);
  cord.position.set(-0.24, 1.14, 0.02);
  cord.rotation.z = -0.9;
  g.add(cord);

  // 불 — 신호가 오면 켜진다. **꺼져 있을 때는 아무것도 아니다**
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0x2a2f36, emissive: 0x2a2f36, emissiveIntensity: 1.2, roughness: 0.4,
  });
  box(0.1, 0.1, 0.06, lampMat, 0.22, 1.46, 0.11);

  const sc = makeScreen(0.5, 0.22, drawRadio);
  sc.mesh.position.set(0.02, 1.3, 0.101);
  g.add(sc.mesh);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.72, 0.42),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.set(0, 1.28, 0.12);
  g.add(hit);

  // ★★ **바뀔 때만 다시 그린다.** 처음엔 매 프레임 `redraw` 했는데,
  //   그건 캔버스를 다시 칠하고 **텍스처를 GPU 로 다시 올리는** 일이라
  //   프레임이 눈에 띄게 떨어졌다 (헤드리스 검사가 90초에 0.6초밖에 못
  //   나아가서 드러났다). 이 화면은 1초에 몇 번 바뀔 일이 없다.
  let last = '';
  return {
    hit,
    update(s) {
      const step = s?.step ?? RSTEP.NONE;
      const live = step !== RSTEP.NONE && step !== RSTEP.TOOK && step !== RSTEP.MISSED;
      lampMat.emissive.set(live ? (step === RSTEP.ANSWERING ? 0xffb45c : 0x8fd0ff) : 0x2a2f36);
      lampMat.emissiveIntensity = live ? 3.0 : 1.2;
      // 막대는 1% 단위로만 새로 그린다 — 눈으로는 같고 일은 백분의 일이다
      const key = `${step}|${Math.round((s?.at ?? 0) * 100)}`;
      if (key === last) return;
      last = key;
      sc.redraw(s);
    },
  };
}
