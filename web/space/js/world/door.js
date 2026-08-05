// ══════════════════════════════════════════════════════════════════════════
//  문짝 — **배가 살아 있다고 느끼게 하는 것.**
//
//  ★ 지금까지 문틀만 있었다
//    `kit.js hatch()` 는 기둥·상인방·문턱·잠금 손잡이를 만들었지만
//    **문짝이 없었다.** 구멍이 영구히 뚫려 있었고, 그래서 배 안에서
//    **움직이는 것이 하나도 없었다.** 창밖은 흐르는데 안은 정지 화면이었다.
//
//  ★ 두 짝으로 가른다
//    한 짝이 옆으로 밀리는 것보다 **가운데서 갈라지는 것**이 압력문답고,
//    무엇보다 **열리는 게 눈에 잘 띈다** — 같은 거리를 반씩만 가면 되니
//    빠르고, 가운데가 벌어지는 것이라 시선이 가운데에 머문다.
//
//  ★ 상태는 여기서 안 갖는다 (game/door.js 가 갖는다)
//    여기는 `k`(0~1)를 받아 **그리기만** 한다. 규칙과 그림을 섞으면
//    브라우저 없이 못 재고, 못 재면 감으로 맞추게 된다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { MAT } from './kit.js';
import { DOOR } from '../game/door-table.js';

function box(parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/**
 * 문짝 두 짝 + 비상 크랭크.
 * @param half 문 반폭 — 문틀과 같아야 한다 (door-table.js DOOR.half)
 * @returns { group, leaves, crank, hit, lamp, update(k, jammed, held) }
 */
export function buildDoor(parent, x, z, half, H, ry, tint) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  parent.add(g);

  const h = Math.min(H - 0.3, 2.05) - 0.1;
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x2e343c, roughness: 0.55, metalness: 0.72,
  });

  // 두 짝. 닫히면 가운데서 만난다
  const leaves = [];
  for (const sx of [-1, 1]) {
    const leaf = new THREE.Group();
    g.add(leaf);
    box(leaf, half - 0.02, h, 0.1, leafMat, sx * half / 2, h / 2 + 0.06, 0);
    // 결 — 민무늬 판이면 안 움직이는 것처럼 보인다. 세로 홈 둘
    for (const u of [0.32, 0.66]) {
      box(leaf, 0.035, h - 0.3, 0.115, MAT.metal, sx * half * u, h / 2 + 0.06, 0);
    }
    // 맞물리는 쪽 가장자리에 발광 띠 — **열리는 것이 눈에 띄는 이유의 절반**
    const edge = box(leaf, 0.05, h - 0.24, 0.12,
      new THREE.MeshBasicMaterial({ color: tint }), sx * 0.03, h / 2 + 0.06, 0);
    leaves.push({ leaf, sx, edge });
  }

  // ── 비상 크랭크 — **끼어도 손으로 연다** ────────────────
  // 문틀 기둥 안쪽, 손이 닿는 높이. 밸브와 같은 규약(잡고 돌린다)이라
  // 생김새도 밸브의 작은 판이다.
  //
  // ★ 처음엔 문 밖(`half + 0.26` = 1.36m 옆)에 뒀다. 그런데 **통로 폭이
  //   ±1.3m** 라 통로 벽 **바깥**이었다 — 크랭크가 벽에 파묻혔다.
  //   조준용 히트 박스만 커서 뚫고 나와 있었으므로 `SPACE.aim` 은
  //   `crank:engine` 을 잡고 손도 먹었다. **되는데 안 보이는** 상태였고,
  //   그건 코드로는 절대 못 찾는다 — 화면을 찍어 보고서야 알았다.
  //   지금은 **문틀 기둥 안쪽**이다. 실제 비상 개방 손잡이가 붙는 자리이고,
  //   지나는 사람은 가운데로 다니므로 걸리지도 않는다.
  const crank = new THREE.Group();
  // 문틀 기둥(hatch 의 jamb: ±half, 두께 0.17, 깊이 0.4)의 **앞면**에 붙인다.
  // 문짝은 z=0 부근(두께 0.1)에서 미끄러지므로 z=0.22 면 안 겹친다
  crank.position.set(-half, 1.16, 0.22);
  g.add(crank);
  box(crank, 0.3, 0.36, 0.07, MAT.body, 0, 0, 0);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 8, 18), MAT.rail);
  wheel.position.z = 0.07;
  crank.add(wheel);
  box(crank, 0.026, 0.19, 0.026, MAT.rail, 0, 0, 0.09);        // 손잡이
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x2a2f36 });
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.02), lampMat);
  lamp.position.set(0, 0.14, 0.08);
  crank.add(lamp);

  // ── 덮개 — **쓸 일이 없어야 하는 것은 덮여 있다** ───────
  // ★ 크루 드래건은 물리 버튼 서른 개 중 상당수가 **투명 덮개 아래**
  //   있다. 「자주 쓰는 것」과 「진짜 급할 때만 쓰는 것」을 생김새로
  //   가르는 문법이다 (docs/space/REALSHIP.md §3).
  //
  //   비상 크랭크가 정확히 그런 물건이다. 그리고 여기서 덮개는 장식이
  //   아니라 **계기**다 — 닫혀 있으면 「이 문은 멀쩡하다」, 젖혀져
  //   있으면 「여기가 끼었다」. 불 하나보다 멀리서 읽힌다.
  const cover = new THREE.Group();
  cover.position.set(0, 0.19, 0.10);          // 위 경첩 — 위로 젖혀진다
  crank.add(cover);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.34, 0.015),
    new THREE.MeshStandardMaterial({
      color: 0xa8c4d8, roughness: 0.18, metalness: 0.1,
      transparent: true, opacity: 0.26,
    }),
  );
  glass.position.set(0, -0.17, 0);
  cover.add(glass);
  // 테 — 유리만 있으면 안 보인다. 「덮개가 있다」는 테가 말한다
  box(cover, 0.30, 0.03, 0.03, MAT.rail, 0, -0.34, 0);        // 아래
  box(cover, 0.03, 0.34, 0.03, MAT.rail, -0.135, -0.17, 0);   // 왼쪽
  box(cover, 0.03, 0.34, 0.03, MAT.rail, 0.135, -0.17, 0);    // 오른쪽

  // 조준용 — **보이는 것보다 크게.** 작은 것을 정확히 겨누게 하면
  // 그건 어려움이 아니라 짜증이다 (밸브·윈치와 같은 이유)
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.7, 0.5),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.copy(crank.position);
  g.add(hit);

  /**
   * @param k      얼마나 열렸나 0~1
   * @param jammed 끼었나 — 크랭크 불이 켜진다
   * @param held   크랭크를 얼마나 돌렸나 0~1
   * @param dt     ★ 덮개가 젖혀지는 속도를 프레임 수에 매달지 않으려고 받는다.
   *               헤드리스는 1fps 남짓이라 프레임당 고정 비율로 움직이면
   *               검사에서만 굼뜨게 열린다 — 그러면 검사가 게임을 탓한다
   */
  function update(k, jammed, held, dt = 0.016) {
    for (const { leaf, sx } of leaves) leaf.position.x = sx * k * (half - 0.02);
    wheel.rotation.z = -held * Math.PI * 3;
    // ★ **끼었을 때만 켜진다.** 늘 켜 두면 안내판이 되고, 그러면
    //   「어느 문이 끼었나」를 소리로 찾을 이유가 사라진다
    lampMat.color.set(jammed ? (held > 0 ? 0xffd27a : 0xff6a4a) : 0x2a2f36);
    // 덮개는 **끼었을 때만 젖혀진다.** 불과 같은 규칙이지만 멀리서 읽힌다.
    // 스르륵 젖혀야 눈에 띈다 — 딱 붙었다 떨어지면 없는 것과 같다
    const want = jammed ? -1.9 : 0;
    const rate = Math.min(1, dt * 7);
    cover.rotation.x += (want - cover.rotation.x) * rate;
  }
  update(0, false, 0);

  return { group: g, leaves, crank, cover, hit, update };
}
