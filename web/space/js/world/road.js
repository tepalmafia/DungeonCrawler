// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **항로 — 목적지까지 뻗는 굵은 한 줄** (v130). 창밖에 그린다.
//
//  ★ 사장님 (2026-08-12) 「**항로가 목적지까지 희미하게 표시 되도록 해서
//    내가 목적지로 향하고 있다는 것을 시각적으로**」
//    (2026-08-13) 「**중앙에 큰 원이 네비게이션이야?? 너무 시야를 가리잖아.
//    희미한 굵은 한 줄로 표시해.**」
//
//  ══ v121 은 **고리 다섯**이었다 ═══════════════════════════════════════
//
//  그때 고리를 고른 까닭은 맞았다 — 축 위에 곧게 그은 선은 눈과 한 줄로
//  서 있어서 **화면에서 점이 된다** (`space-nav.js [7]` 이 0.000도로 찍는다).
//  그런데 고리는 **가까운 것이 커야** 길로 읽히고, 그러면 화면 복판을 먹는다.
//  화면으로 재 보니 제일 가까운 고리가 화면 반쪽의 **0.39** 였다 —
//  전투 원뿔(0.45)을 거의 다 채운 것이다. 사장님이 보신 그 원이다.
//
//  ★★★ **답은 선을 눕히는 것이다** (`nav-table.js ROAD.drop`). 길을 축에서
//    아래로 내리면 가까운 끝은 발밑에, 먼 끝은 목적지에 붙는다 —
//    화면에서 **한 줄로 뻗어 사라지는 길**이 되고, 복판은 빈다.
//    실제 길이 그렇게 보이는 까닭과 같다: 길은 눈높이가 아니라 발밑에 있다.
//
//  ══ ★★ 왜 `Line` 이 아니라 띠(mesh)인가 ═══════════════════════════════
//
//  `LineBasicMaterial` 의 굵기는 대부분의 브라우저에서 **늘 1화소**다
//  (WebGL 이 `lineWidth` 를 안 먹는다). 사장님은 「**굵은** 한 줄」이라
//  하셨으므로 굵기를 가진 것이 필요하고, 그러려면 띠여야 한다.
//  ★ 굵기는 **세상 크기(m)** 다 — 멀수록 저절로 가늘어져 원근이 산다.
//
//  ══ ★★★ 여기는 **그리기만** 한다 ═════════════════════════════════════
//
//  마디가 어디에 몇 개 있고 얼마나 진한지는 `nav-table.js roadOf` 가 정하고,
//  자리를 좌표로 옮기는 것은 `frame.js pointOf` 가 한다. 둘 다 three 를
//  안 쓰므로 `tools/space-nav.js` 가 브라우저 없이 잰다.
//  ★ **이 파일이 각을 다시 세지 않는다.** 세기 시작하면 「마름모는 저기인데
//    길은 이리로」가 나고, 그게 이 저장소가 v91~v98 네 판을 태운 병이다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { pointOf } from '../game/frame.js';
import { ROAD } from '../game/nav-table.js';

/** 매 프레임 새로 만들면 쓰레기가 쌓인다 — 하나씩 두고 돌려 쓴다 */
const P = new THREE.Vector3();
const SIDE = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** 항로 상태마다 색 — 조준경의 항로점과 **같은 말**을 쓴다 (`navState`) */
const TONE = {
  on: [0.561, 0.902, 0.753],      // #8fe6c0 항로 위
  drift: [1.0, 0.812, 0.416],     // #ffcf6a 틀어졌다
  off: [1.0, 0.604, 0.361],       // #ff9a5c 벗어났다
};

/**
 * ★★ **길을 세운다** — `parent` 는 창밖 그룹이다.
 *   ★ 원점을 눈에 붙이는 것은 부르는 쪽이 한다 (`cockpit.js` 의 `EYEG`) —
 *     안 붙이면 배가 돌 때 8.5m 짜리 팔이 휘둘린다 (v93·v98 이 그 병이었다)
 */
export function buildRoad(parent) {
  const group = new THREE.Group();
  group.name = '항로';
  parent.add(group);

  // ★ 마디 수는 표가 정한다 — 여기서 또 세면 둘이 갈라진다
  const N = ROAD.seg + 1;
  const pos = new Float32Array(N * 2 * 3);
  const col = new Float32Array(N * 2 * 4);      // ★ 알파까지 넷 — 마디마다 진하기가 다르다
  const idx = [];
  for (let i = 0; i < N - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    // ★ 뒤의 별과 적을 **안 가린다** — 깊이를 안 적으므로 이 뒤로 다 그려진다
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;    // ★ 눈에 붙은 그룹이라 경계 상자를 못 믿는다
  mesh.renderOrder = 6;
  mesh.visible = false;
  group.add(mesh);

  return {
    group,
    mesh,
    /**
     * ★★★ **한 프레임** — 표가 준 마디를 그대로 잇는다.
     * @param list `nav-table.js roadOf(...)` 가 준 것 (없거나 짧으면 끈다)
     */
    update(list) {
      if (!list || list.length < 2) { mesh.visible = false; return; }
      mesh.visible = true;
      const tone = TONE[list[0].state] ?? TONE.on;
      for (let i = 0; i < N; i++) {
        // ★ 표가 마디를 덜 주면 마지막 것을 늘려 쓴다 — 길이가 갑자기
        //   달라져도 도형이 안 깨진다 (표가 늘 `seg+1` 을 주지만, 그것에
        //   기대어 짜 두면 표를 고치는 날 조용히 찌그러진다)
        const g = list[Math.min(i, list.length - 1)];
        const p = pointOf(g);
        P.set(p.x, p.y, p.z);
        // ══ ★★ **옆으로 벌리는 방향** — 눈에서 본 가로다 ═══════════════
        //  ★ 길을 「바닥에 눕힌 판」으로 만들면 비스듬히 보게 되어 화면에서
        //    **실처럼 가늘어진다.** 그래서 눈과 마디를 잇는 선에 직각인
        //    가로 방향으로 벌린다 — 어느 자세에서도 굵기가 산다
        SIDE.crossVectors(P, UP);
        if (SIDE.lengthSq() < 1e-8) SIDE.set(1, 0, 0);   // 바로 위·아래일 때
        SIDE.normalize().multiplyScalar(g.width / 2);
        const a = i * 2;
        pos[a * 3] = p.x - SIDE.x; pos[a * 3 + 1] = p.y - SIDE.y; pos[a * 3 + 2] = p.z - SIDE.z;
        pos[a * 3 + 3] = p.x + SIDE.x; pos[a * 3 + 4] = p.y + SIDE.y; pos[a * 3 + 5] = p.z + SIDE.z;
        for (let s = 0; s < 2; s++) {
          const c = (a + s) * 4;
          col[c] = tone[0]; col[c + 1] = tone[1]; col[c + 2] = tone[2];
          col[c + 3] = g.alpha;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
    // ★ `clear()` 를 따로 안 둔다 — 갈 곳이 없으면 `update([])` 가 끈다.
    //   끄는 길을 둘로 만들면 한쪽만 부르는 자리가 반드시 생긴다
  };
}
