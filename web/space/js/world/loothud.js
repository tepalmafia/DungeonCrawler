// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **줍겠습니까 · 무엇을 주웠나** — 화면 (v121)
//
//  ★ 사장님 (2026-08-12) 「적을 격추하거나 물체를 격추하면 **아이템을
//    회수하겠습니까? 질문이 나오고** 회수하는 것으로. 그리고 **아이템을
//    먹으면 아이템 요약이 뜨도록** 해줘. **형태와 요약.**」
//
//  ══ ★★ 어디에 그리나 ═════════════════════════════════════════════════
//
//  ★ **전투 원뿔(가운데 0.45)을 안 먹는다.** `screen-table.js` 가
//    「계기 셋이 화면의 14% 이하 · 원뿔이 비어야 한다」를 지키고 있고,
//    이건 계기가 아니라 **잠깐 뜨는 것**이라 더 조심해야 한다.
//    · 물음은 **아래 한복판 조금 위** — 답해야 하는 것이므로 눈에 든다
//    · 카드는 **오른쪽 위** — 지나가는 것이므로 곁눈으로 본다
//
//  ★★ 판은 **카메라의 자식**이다 (v118). 그래야 둘러봐도 정면이다 —
//    이미지 평면과 나란한 평면은 **언제나 직사각형으로** 투영된다
//
//  ★★★ **도형은 여기서 짓지 않는다.** 무엇이 무슨 도형인지는
//    `loot-table.js SHAPES` 가 정하고, 여기는 **그리기만** 한다 —
//    「재는 곳을 둘로 만들지 않는다」가 그림에도 같다
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { toneOf } from '../game/loot-table.js';

/** 물음과 카드가 앉는 자리 (화면 정규 좌표 −1~1) */
export const LOOT_AT = {
  ask: { nx: 0, ny: -0.62 },
  cards: { nx: 0.62, ny: 0.72 },
};

/**
 * ★★★ **형태 하나를 그린다** — 네 가지.
 *   `legend-table.js` 가 하늘의 것을 도형으로 가르는 것과 같은 규약을 잇는다
 */
export function drawShape(ctx, kind, x, y, r, tone) {
  ctx.save();
  ctx.strokeStyle = tone; ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  if (kind === 'drum') {
    // 통 — 위아래가 둥근 원기둥
    const w = r * 1.1, h = r * 1.5;
    ctx.beginPath(); ctx.ellipse(x, y - h / 2, w / 2, r * 0.28, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y - h / 2); ctx.lineTo(x - w / 2, y + h / 2);
    ctx.ellipse(x, y + h / 2, w / 2, r * 0.28, 0, Math.PI, 0, true);
    ctx.lineTo(x + w / 2, y - h / 2);
    ctx.stroke();
  } else if (kind === 'cell') {
    // 전지 — 네모에 칸 셋 (아크 전지)
    const w = r * 1.3, h = r * 1.6;
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);
    ctx.beginPath();
    ctx.moveTo(x - w * 0.18, y - h / 2 - r * 0.22); ctx.lineTo(x + w * 0.18, y - h / 2 - r * 0.22);
    ctx.stroke();
    ctx.fillStyle = tone;
    for (let i = 0; i < 3; i++) ctx.fillRect(x - w * 0.3, y - h * 0.28 + i * h * 0.26, w * 0.6, h * 0.12);
  } else if (kind === 'pack') {
    // 봉지 — 위가 접힌 무른 것
    const w = r * 1.5, h = r * 1.4;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y - h / 2 + r * 0.3);
    ctx.quadraticCurveTo(x, y - h / 2 - r * 0.16, x + w / 2, y - h / 2 + r * 0.3);
    ctx.lineTo(x + w / 2, y + h / 2); ctx.lineTo(x - w / 2, y + h / 2);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    // 네모 — 쌓이는 것 (부품 · 광석). 모서리를 깎아 「상자」로 읽히게
    const w = r * 1.5, h = r * 1.35, c = r * 0.24;
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + c, y - h / 2);
    ctx.lineTo(x + w / 2, y - h / 2); ctx.lineTo(x + w / 2, y + h / 2 - c);
    ctx.lineTo(x + w / 2 - c, y + h / 2); ctx.lineTo(x - w / 2, y + h / 2);
    ctx.lineTo(x - w / 2, y - h / 2 + c);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

/** 캔버스 하나에 그리는 판 — 물음과 카드를 같이 든다 */
function makePane(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { cv, ctx, tex };
}

/**
 * ★★ 물음 판 — 아래 한복판 조금 위.
 * @param s `game/loot.js summary()` 의 `ask`
 */
export function buildLootHud(camera, dist) {
  const A = makePane(1024, 172);
  // ★★★ v125 — 560×420 → **860×620**. 사장님 「**뭘 했는지 창이 너무 작아.
  //   더 크게 하고 물체나 아이템 모양도 나오고 어디에 쓰는건지도. 등급도**」
  const C = makePane(860, 620);

  const paneMesh = ({ tex }, wm, hm, order) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(wm, hm),
      new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, depthTest: false, opacity: 0.95,
      }),
    );
    m.renderOrder = order;
    m.visible = false;
    camera.add(m);
    return m;
  };
  // 미터 크기는 `dist` 에서 화면 몫으로 잡는다 — 창이 바뀌어도 같은 몫
  const askMesh = paneMesh(A, dist * 0.62, dist * 0.104, 952);
  const cardMesh = paneMesh(C, dist * 0.42, dist * 0.303, 951);

  const place = (mesh, nx, ny, halfW, halfH) => {
    const t = Math.tan((camera.fov * Math.PI) / 360) * dist;
    const a = camera.aspect || 1;
    mesh.position.set((nx - Math.sign(nx) * halfW) * t * a, (ny - Math.sign(ny) * halfH) * t, -dist);
    mesh.rotation.set(0, 0, 0);
  };

  function drawAsk(ask) {
    const { ctx, cv, tex } = A;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!ask) { tex.needsUpdate = true; return; }
    // 남은 시간이 **띠로** 준다 — 「6초」라고 쓰면 아무도 안 센다
    const k = Math.max(0, Math.min(1, ask.left / 6));
    ctx.fillStyle = 'rgba(6,12,16,.72)';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = '#7fd8c0'; ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, cv.width - 4, cv.height - 4);
    ctx.fillStyle = '#7fd8c0';
    ctx.fillRect(2, cv.height - 10, (cv.width - 4) * k, 8);
    ctx.font = '700 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8f6f2';
    ctx.fillText(ask.line, cv.width / 2, 62);
    ctx.font = '600 30px system-ui, sans-serif';
    ctx.fillStyle = '#9fb6c8';
    ctx.fillText(`${ask.dist}m · ${ask.wayName ?? ''}`, cv.width / 2, 110);
    ctx.textAlign = 'left';
    tex.needsUpdate = true;
  }

  function drawCards(cards) {
    const { ctx, cv, tex } = C;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!cards?.length) { tex.needsUpdate = true; return; }
    // ★★ 한 장이 커졌으므로 **두 장**만 든다 (`CARD.max`). 셋이면 화면을 덮는다
    const rowH = 300;
    cards.slice(-2).forEach((c, i) => {
      const y = 10 + i * rowH;
      const fade = Math.max(0.15, Math.min(1, c.left / 1.2));
      ctx.globalAlpha = fade;
      // ★ 색은 **카드가 준다** (`c.tone`). 여기서 `toneOf` 를 다시 부르면
      //   파츠 카드(등급 색)가 재료 색으로 덮인다 — 첫 판에 그랬다
      const tone = c.tone ?? toneOf(c.key);
      ctx.fillStyle = 'rgba(6,12,16,.78)';
      ctx.fillRect(0, y, cv.width, rowH - 14);
      ctx.strokeStyle = tone; ctx.lineWidth = 3;
      ctx.strokeRect(2, y + 2, cv.width - 4, rowH - 18);
      // ── 모양 — 크게 (사장님 「물체나 아이템 모양도 나오고」) ──
      drawShape(ctx, c.shape, 92, y + 122, 66, tone);
      // ── 이름 ──
      ctx.fillStyle = '#e8f6f2';
      ctx.font = '700 52px system-ui, sans-serif';
      ctx.fillText(`${c.name}${c.count > 1 ? ` ×${c.count}` : ''}`, 186, y + 74);
      // ── ★★★ 등급 — 파츠에만 있다. **이름 옆이 아니라 제 칸**에 (v125) ──
      if (c.tier) {
        const w = ctx.measureText(`${c.name} `).width;
        ctx.fillStyle = tone;
        ctx.font = '700 34px system-ui, sans-serif';
        ctx.fillText(`［${c.tier}］`, 186 + w, y + 74);
      }
      // ── 늘어나는 것 ──
      ctx.fillStyle = tone;
      ctx.font = '600 40px system-ui, sans-serif';
      ctx.fillText(c.gain, 186, y + 138);
      // ── ★ 어디에 쓰는가 (사장님 「어디에 쓰는건지도」) ──
      if (c.use) {
        ctx.fillStyle = '#b9cbd8';
        ctx.font = '500 34px system-ui, sans-serif';
        ctx.fillText(c.use, 186, y + 196);
      }
      // ── 무게 — 화물칸이 차는 이유 ──
      if (c.mass) {
        ctx.fillStyle = '#7f93a3';
        ctx.font = '500 28px system-ui, sans-serif';
        ctx.fillText(`무게 ${c.mass}`, 186, y + 244);
      }
      ctx.globalAlpha = 1;
    });
    tex.needsUpdate = true;
  }

  return {
    askMesh,
    cardMesh,
    /** @param s `game/loot.js summary()` + `on` (앉아 있나) */
    redraw(s) {
      const on = !!s.on;
      askMesh.visible = on && !!s.ask;
      cardMesh.visible = on && !!s.cards?.length;
      if (askMesh.visible) { drawAsk(s.ask); place(askMesh, LOOT_AT.ask.nx, LOOT_AT.ask.ny, 0, 0.052); }
      if (cardMesh.visible) { drawCards(s.cards); place(cardMesh, LOOT_AT.cards.nx, LOOT_AT.cards.ny, 0.21, 0.152); }
    },
  };
}
