// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **어느 쪽으로 틀어야 하나** — 화면 가장자리의 화살표 (v126)
//
//  ★ 사장님 (2026-08-12) 「목적지까지 네비게이션 만들어달라고. **비행선이
//    가야할 방향. 우주라서 방향을 못 찾잖아**」
//
//  ══ 왜 있던 것으로는 모자랐나 ═════════════════════════════════════════
//
//  · **항로점 마름모**(v104) — 목적지가 **앞에 있을 때만** 보인다
//  · **항로 문**(v121) — 길을 보여 주지만, 그 길이 **화면 밖이면** 없다
//  · **조준경의 가장자리 세모**(v104) — 있긴 한데 그 판이 화면 복판
//    **40도**짜리다. 세모가 서는 곳은 화면 가장자리가 아니라 **작은 판의
//    가장자리**라, 방향을 잃은 눈에는 안 든다
//
//  ★★★ 즉 셋 다 **「이미 대충 그쪽을 보고 있을 때」**만 돕는다. 우주에는
//    산도 길도 없으므로, 완전히 등을 돌렸을 때 **아무것도 안 남는다.**
//    그 자리를 메우는 것이 이 화살표다 — **늘 화면 가장자리에** 서서
//    「이쪽으로 틀어라」만 말한다.
//
//  ★★ 카메라의 자식이라 둘러봐도 정면이다 (v118 · 회수 카드와 같은 규약).
//    자리와 말은 `game/nav-table.js` 가 정하고 여기는 **그리기만** 한다
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { NAVHUD, navArrow, navState } from '../game/nav-table.js';

/** 항로 상태마다 색 — 항로 문·조준경과 **같은 말**을 쓴다 */
const TONE = { on: '#8fe6c0', drift: '#ffcf6a', off: '#ff9a5c' };

export function buildNavHud(camera, dist) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 512;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(dist * NAVHUD.size * 2, dist * NAVHUD.size * 2),
    new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, depthTest: false, opacity: 0.95,
    }),
  );
  mesh.renderOrder = 953;
  mesh.visible = false;
  camera.add(mesh);

  // ── 글자는 따로 판을 쓴다 — 화살표는 돌고 **글자는 안 돌아야** 읽힌다 ──
  const tv = document.createElement('canvas');
  // ★ 글이 길다 (「★ 행성 — 항로를 벗어났습니다 — 좌 139° · 아래 13°」).
  //   판이 좁으면 자동 축소가 계속 먹혀 **작아서 못 읽는다** — 판을 넓힌다
  tv.width = 1280; tv.height = 132;
  const tctx = tv.getContext('2d');
  const ttex = new THREE.CanvasTexture(tv);
  ttex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(dist * 0.62, dist * 0.064),
    new THREE.MeshBasicMaterial({
      map: ttex, transparent: true, depthWrite: false, depthTest: false, opacity: 0.95,
    }),
  );
  label.renderOrder = 953;
  label.visible = false;
  camera.add(label);

  let drawnTone = null;
  function drawArrow(tone) {
    if (drawnTone === tone) return;
    drawnTone = tone;
    ctx.clearRect(0, 0, 512, 512);
    // ★ 속이 빈 세모 + 꼬리. 채우면 별을 가리고, 선만이면 안 보인다 —
    //   가운데를 옅게 채워 **둘 다** 얻는다
    ctx.translate(256, 256);
    ctx.beginPath();
    ctx.moveTo(190, 0); ctx.lineTo(-60, -150); ctx.lineTo(-10, 0); ctx.lineTo(-60, 150);
    ctx.closePath();
    ctx.fillStyle = `${tone}44`; ctx.fill();
    ctx.strokeStyle = tone; ctx.lineWidth = 16; ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    tex.needsUpdate = true;
  }
  function drawLabel(word, tone) {
    tctx.clearRect(0, 0, 1280, 132);
    tctx.fillStyle = 'rgba(6,12,16,.72)';
    tctx.fillRect(0, 0, 1280, 132);
    tctx.strokeStyle = tone; tctx.lineWidth = 3;
    tctx.strokeRect(2, 2, 1276, 128);
    tctx.fillStyle = '#e8f6f2';
    tctx.textAlign = 'center'; tctx.textBaseline = 'middle';
    // ★★ **폭에 맞춰 줄인다.** 60px 로 못박았다가 「★ 행성 — 항로를
    //   벗어났습니다 — 좌 139°」가 **양끝이 잘려** 나갔다 (화면으로 보고
    //   알았다). 글은 길이가 정해져 있지 않으므로 판이 글에 맞춰야 한다
    let px = 60;
    for (; px > 26; px -= 2) {
      tctx.font = `700 ${px}px system-ui, sans-serif`;
      if (tctx.measureText(word).width <= 1230) break;
    }
    tctx.fillText(word, 640, 68);
    tctx.textAlign = 'left'; tctx.textBaseline = 'alphabetic';
    ttex.needsUpdate = true;
  }

  return {
    mesh,
    label,
    /**
     * ★★★ 한 프레임.
     * @param s `{ on, to, rel: {az, el, off}, word }` — 자리·말은 표가 만든다
     */
    redraw(s) {
      const show = !!s.on && !!s.to && !!s.rel && Math.abs(s.rel.off) >= NAVHUD.showFrom;
      mesh.visible = show; label.visible = show;
      if (!show) return;
      const tone = TONE[navState(s.rel.off)] ?? TONE.on;
      drawArrow(tone);
      drawLabel(s.word ?? '', tone);
      const a = navArrow(s.rel.az, s.rel.el);
      const t = Math.tan((camera.fov * Math.PI) / 360) * dist;
      const asp = camera.aspect || 1;
      mesh.position.set(a.nx * t * asp, a.ny * t, -dist);
      mesh.rotation.set(0, 0, -a.rot);
      // ★ 글자는 **화살표 안쪽**에 둔다 — 가장자리에 붙이면 잘린다.
      //   그리고 **안 돌린다**: 돌아간 글자는 못 읽는다
      label.position.set(a.nx * 0.62 * t * asp, a.ny * 0.62 * t, -dist);
      label.rotation.set(0, 0, 0);
    },
  };
}
