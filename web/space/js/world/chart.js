// ══════════════════════════════════════════════════════════════════════════
//  해도대 — **관측실에서 항로를 고르는 물건.**
//
//  ★ 왜 메뉴가 아니라 물건인가
//    「어디로 갈까」를 화면 구석 버튼으로 만들면 관측실은 구경거리로 남는다.
//    손으로 눌러야 하고, 누르려면 **거기까지 걸어가야** 한다 — 그게 이
//    게임에서 방이 존재하는 이유다 (PLAN §7-0 · §9-1).
//
//  ★ 그리고 여기서만 보인다 (Duskers 각색 · GAP.md §2-④)
//    조종석 계기는 거리와 자국을 보여주고, 여기는 **항로와 압박**을 보여준다.
//    동시에 두 방에 못 있으므로, 이동이 심부름이 아니라 **「무엇을 안 보고
//    갈까」라는 선택**이 된다. 왕복이 지겨운 이유는 거리가 멀어서가 아니라
//    뛰는 동안 아무 판단도 안 하기 때문이다.
//
//  ★ 판때기가 아니라 **눌리는 것**이다
//    통로의 차단기와 같은 규약을 쓴다 — 안 보이는 큰 상자를 겹쳐 조준을
//    쉽게 하고, 눌린 순간에만 먹는다. 손맛이 두 개로 갈리면 안 된다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { LEG, PRESS, contactAtFor } from '../game/route-table.js';

const FG = '#8ee6c0';
const DIM = 'rgba(142,230,192,.38)';
const WARN = '#ffb060';

/** 캔버스 화면 하나. 글씨 크기는 **화면 높이에 비례**한다 —
 *  픽셀로 박아 두면 화면 폭이 바뀔 때 아래로 잘려 나간다 (cockpit.js 와 같은 사고) */
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

function bg(ctx, w, h) {
  ctx.fillStyle = '#04160f';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(142,230,192,.09)';
  ctx.lineWidth = 1;
  for (let y = h * 0.08; y < h; y += h * 0.09) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
}

/**
 * 위판 — 어디까지 왔고 압박이 얼마인가.
 *
 * ★ **중요한 것을 사람 쪽(아래)에 둔다.** 눕힌 판은 먼 쪽이 납작하게
 *   찌그러져 보인다 — 처음엔 항로 줄을 맨 위에 뒀는데, 서서 내려다보니
 *   제일 중요한 것이 제일 안 읽혔다. 화면을 찍어 보고 뒤집었다.
 */
function drawMap(ctx, w, h, s) {
  bg(ctx, w, h);
  const f = (k) => Math.round(h * k);

  // ── 먼 쪽: 압박 ──────────────────────────────────────
  ctx.fillStyle = DIM;
  ctx.font = `600 ${f(0.075)}px system-ui, sans-serif`;
  ctx.fillText('압박 · 뿌리쳐도 안 사라진다', w * 0.05, h * 0.11);

  const pad = w * 0.05, bw = w * 0.62, by = h * 0.17, bh = h * 0.13;
  const t = Math.max(0, Math.min(1, s.press / PRESS.max));
  ctx.fillStyle = t > 0.75 ? '#ff6a4a' : t > 0.45 ? WARN : '#5fe0a8';
  ctx.fillRect(pad, by, bw * t, bh);
  ctx.strokeStyle = DIM; ctx.lineWidth = 1;
  ctx.strokeRect(pad, by, bw, bh);
  ctx.fillStyle = t > 0.75 ? '#ffb0a0' : FG;
  ctx.font = `700 ${f(0.155)}px ui-monospace, monospace`;
  ctx.fillText(String(Math.round(s.press)), pad + bw + w * 0.03, by + bh);
  ctx.fillStyle = DIM;
  ctx.font = `600 ${f(0.07)}px system-ui, sans-serif`;
  // 압박이 접촉 기준을 얼마나 끌어내렸나 — 「좁혀 온다」를 숫자로 보여준다
  ctx.fillText(`접촉 기준 ${contactAtFor(s.press).toFixed(0)}`, pad, h * 0.43);

  // ── 가까운 쪽: 항로 ─────────────────────────────────
  const y = h * 0.68, x0 = w * 0.06, x1 = w * 0.94;
  ctx.strokeStyle = DIM; ctx.lineWidth = Math.max(1, h * 0.008);
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  for (let i = 0; i <= LEG.count; i++) {
    const px = x0 + (x1 - x0) * (i / LEG.count);
    const past = i <= s.leg;
    const last = i === LEG.count;
    ctx.beginPath();
    ctx.arc(px, y, h * (last ? 0.055 : 0.034), 0, Math.PI * 2);
    ctx.fillStyle = past ? FG : 'rgba(142,230,192,.18)';
    ctx.fill();
    if (last) { ctx.strokeStyle = past ? FG : DIM; ctx.lineWidth = h * 0.01; ctx.stroke(); }
  }
  // 지금 자리 — 구간을 가는 중이면 두 거점 사이를 실제로 움직인다
  const px = x0 + (x1 - x0) * ((s.leg + s.progress) / LEG.count);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(px, y - h * 0.1); ctx.lineTo(px - h * 0.045, y - h * 0.19);
  ctx.lineTo(px + h * 0.045, y - h * 0.19); ctx.closePath(); ctx.fill();

  ctx.font = `700 ${f(0.1)}px system-ui, sans-serif`;
  if (s.atPort) {
    ctx.fillStyle = '#ffffff';
    ctx.fillText('거점 — 항로를 고르십시오', x0, h * 0.94);
  } else {
    ctx.fillStyle = DIM;
    ctx.fillText(`다음 거점까지 · 남은 ${LEG.count - s.leg}`, x0, h * 0.94);
  }
  ctx.fillStyle = DIM;
  ctx.font = `600 ${f(0.08)}px system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('따라오지 못하는 곳', x1, h * 0.94);
  ctx.textAlign = 'left';
}

/** 갈래 판 하나 */
function drawFork(ctx, w, h, s) {
  bg(ctx, w, h);
  // ★ **내릴 자리** — 항행 중에 장면 B 가 켜면 같은 판 둘이 다른 것을 묻는다.
  //   판을 새로 만들지 않는다. 「고르는 자리는 해도대」라는 규약이 이미 있고,
  //   새 판을 달면 사람은 **또 어디를 봐야 하나**를 배워야 한다
  if (s.land) {
    const f = (k) => Math.round(h * k);
    ctx.fillStyle = s.lit ? '#ffffff' : (s.land.go ? '#ffd08a' : FG);
    ctx.font = `700 ${f(0.19)}px system-ui, sans-serif`;
    ctx.fillText(s.land.go ? '내린다' : '지나친다', w * 0.06, h * 0.3);
    ctx.fillStyle = DIM;
    ctx.font = `600 ${f(0.12)}px system-ui, sans-serif`;
    ctx.fillText(s.land.go ? '광석 · 부품 · 식량' : '항로를 그대로', w * 0.06, h * 0.56);
    ctx.fillStyle = 'rgba(255,170,110,.6)';
    ctx.font = `600 ${f(0.105)}px system-ui, sans-serif`;
    ctx.fillText(s.land.go
      ? (s.land.hard ? '대기가 거칠다 · 땅에서는 못 도망간다' : '땅에서는 못 도망간다')
      : '지금은 위험을 안 진다', w * 0.06, h * 0.79);
    if (s.lit) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, h * 0.014);
      ctx.strokeRect(2, 2, w - 4, h - 4);
    }
    return;
  }
  if (!s.fork) {
    ctx.fillStyle = DIM;
    ctx.font = `600 ${Math.round(h * 0.13)}px system-ui, sans-serif`;
    ctx.fillText('— 항행 중 —', w * 0.08, h * 0.55);
    return;
  }
  const f = (k) => Math.round(h * k);
  ctx.fillStyle = s.lit ? '#ffffff' : FG;
  ctx.font = `700 ${f(0.17)}px system-ui, sans-serif`;
  ctx.fillText(s.fork.name, w * 0.06, h * 0.26);

  ctx.fillStyle = DIM;
  ctx.font = `600 ${f(0.13)}px ui-monospace, monospace`;
  const min = (s.fork.seconds / 60).toFixed(1);
  const gain = Math.round(PRESS.perLeg * s.fork.signMult);
  ctx.fillText(`${min}분   압박 +${gain}`, w * 0.06, h * 0.5);

  ctx.fillStyle = 'rgba(142,230,192,.55)';
  ctx.font = `600 ${f(0.105)}px system-ui, sans-serif`;
  // 대가는 **길게 적지 않는다.** 눌러 보고 알게 하는 편이 낫다
  ctx.fillText(s.fork.what, w * 0.06, h * 0.75);

  if (s.lit) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, h * 0.014);
    ctx.strokeRect(2, 2, w - 4, h - 4);
  }
}

/**
 * 해도대를 세운다.
 * @param at   {x, z} 방 안의 자리
 * @param block 충돌 상자를 등록하는 함수 (ship.js 가 넘긴다)
 */
export function buildChart(parent, at, block, MAT) {
  const g = new THREE.Group();
  g.position.set(at.x, 0, at.z);
  parent.add(g);

  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return m;
  };

  // ★ **긴 쪽을 사람 쪽으로 돌려 놓는다.** 처음엔 방과 나란히(x 로 1.5) 놨는데,
  //   사람은 +x 쪽에서 다가오므로 **폭 1.0 · 깊이 1.5** 인 상을 보게 된다 —
  //   가로로 긴 해도를 세로로 긴 판에 그리는 꼴이라 글씨가 옆으로 누웠다.
  //   화면을 찍어 보고 알았다 (docs/POSTMORTEM.md §1-③).
  box(1.0, 0.1, 1.5, MAT.body, 0, 0.92, 0);
  for (const sx of [-0.4, 0.4]) for (const sz of [-0.65, 0.65]) box(0.1, 0.9, 0.1, MAT.metal, sx, 0.45, sz);
  block(at.x, at.z, 0.53, 0.78, 0);

  // 위판 — 눕혀 놓는다. 해도는 들여다보는 것이다.
  //
  // ★ 눕히는 것만으로는 안 된다. rotation.x 만 주면 그림의 「오른쪽」이
  //   **사람 쪽(+x)** 을 향해서 글씨가 90도 누워 읽힌다. 사람의 오른쪽은
  //   -z 이므로 제 평면 안에서 한 번 더 돌려 준다 (rotation.z).
  const map = makeScreen(1.34, 0.60, drawMap);
  map.mesh.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  // 사람 쪽으로 조금 당겨 놓는다 — 안 당기면 **갈래 판이 해도의 위쪽을 가린다**
  map.mesh.position.set(0.2, 0.981, 0);
  g.add(map.mesh);

  // ── 갈래 판 둘 ────────────────────────────────────────
  // 먼 쪽 가장자리에서 **사람 쪽으로 기울여** 세운다. 눕혀 두면 서서
  // 내려다볼 때 글씨가 납작해져 안 읽힌다 — 조종석에서 이미 겪었다.
  const plates = [];
  // ★ 두 판의 폭(0.74)과 간격(±0.37)을 **딱 맞춘다.** 조금이라도 벌리면
  //   가운데에 틈이 생겨 정면으로 서면 아무것도 안 잡힌다 —
  //   화면으로는 「판이 있는데 안 눌린다」로만 보인다
  for (const [i, sz] of [[0, -0.37], [1, 0.37]]) {
    const arm = new THREE.Group();
    arm.position.set(-0.34, 0.97, sz);
    arm.rotation.y = Math.PI / 2;      // 사람(+x) 쪽을 본다
    g.add(arm);

    const sc = makeScreen(0.7, 0.34, drawFork);
    sc.mesh.rotation.x = -0.55;        // 뒤로 눕힌다
    sc.mesh.position.set(0, 0.13, 0.02);
    arm.add(sc.mesh);

    // 조준 판정용 — 화면은 얇아서 그냥 두면 조준하기가 괴롭다 (차단기와 같은 처방)
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(0.74, 0.4, 0.34),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.position.set(0, 0.13, 0.02);
    arm.add(hit);

    plates.push({ i, hit, sc, fork: null });
  }

  let aimed = -1;
  return {
    plates,
    /** 조준선이 어느 판에 걸렸나 — 밖에서 넣어 준다 */
    setAim(i) { aimed = i; },
    /** 이 판이 지금 무슨 갈래인가 (밖에서 누를 때 쓴다) */
    keyAt(i) { return plates[i]?.fork?.key ?? null; },
    /** ★ 이 판이 지금 「내린다/지나친다」인가 — 밖에서 누를 때 쓴다 */
    landAt(i) { return plates[i]?.land ?? null; },
    update(s) {
      map.redraw(s);
      // ★ 착륙 제안은 **항행 중에만** 뜬다. 거점에서는 갈래가 우선이다 —
      //   한 판이 두 가지를 동시에 물으면 뭘 누르는지 모른다
      const land = !s.atPort && s.land?.offered ? s.land : null;
      plates.forEach((p, i) => {
        p.fork = !land && s.atPort ? s.offer[i] : null;
        p.land = land ? { go: i === 0, hard: !!land.hard } : null;
        p.sc.redraw({ fork: p.fork, land: p.land, lit: aimed === i && !!(p.fork || p.land) });
      });
    },
  };
}
