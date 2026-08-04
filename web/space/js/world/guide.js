// ══════════════════════════════════════════════════════════════════════════
//  바닥 안내선 — **튜토리얼 동안만** 목표 쪽으로 흐른다.
//
//  ★ 왜 만들었나 (2026-08-04 · 사장님)
//    「튜토리얼은 처음 시작 시 무조건 시작되고 진행 방향으로 바닥에 선으로
//     목표 방향을 알려줘」
//
//    앞선 두 마디(「아직 뭘 해야할지 모르겠다」·「불친절하고」)와 같은
//    뿌리다. 가르침은 **동사**를 말하고(§1-1) 방은 **20초 뒤에야** 말한다.
//    그 20초 동안 처음 하는 사람은 배 안을 헤맨다 — 방이 일곱이고 통로가
//    13m 다. 「글로 안 알려준다」를 지킨다고 **길을 안 알려주는 것**은
//    다른 문제였다.
//
//  ★ 그런데 이건 이 게임의 심장에 손대는 물건이다
//    「어디인지는 안 말한다」(PLAN §3-1)가 무너지면 소리로 방을 찾는 일도,
//    방 일곱을 도는 일도 전부 심부름이 된다. 그래서 선을 긋는다:
//
//      · **가르침 일곱이 도는 동안에만** 그린다. 다 떼면 두 번 다시 안 나온다
//      · 고장(`fault`)은 **가르침 글이 방을 말해 주는 그때**부터 그린다
//        (TUTOR.showWhere). 그 전에는 안 그린다 — 그 가르침의 내용 자체가
//        「덜그럭거리는 쪽으로 간다」라서, 처음부터 선을 그으면 **가르치려는
//        것을 그 가르침이 없애 버린다**
//      · 목표는 **방까지**다. 방 안에서 물건을 찾는 것은 여전히 눈이 한다
//
//  ★ HUD 가 아니다 — 바닥에 깔린 물건이다 (PLAN §5-2).
//    화살표를 화면에 얹으면 조준점 말고는 안 만든다는 규칙이 깨진다.
//    바닥에 깐 판은 방 조명을 받고, 문에 가리고, 모퉁이를 돌면 안 보인다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';

const N = 40;          // 화살표 개수. 길이에 따라 쓰는 만큼만 켠다
const GAP = 0.55;      // 화살표 사이 간격(m)
const SPEED = 1.6;     // 흐르는 속도(m/s) — 걷는 속도보다 조금 빠르다
const COLOR = 0x7fe8bf;

/** 꺾인 길의 길이 */
function lengths(pts) {
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    seg.push(d);
    total += d;
  }
  return { seg, total };
}

/** 길 위에서 s(m) 만큼 간 자리와 그때의 방향 */
function at(pts, seg, s) {
  let rest = Math.max(0, s);
  for (let i = 0; i < seg.length; i++) {
    if (rest <= seg[i] || i === seg.length - 1) {
      const t = seg[i] > 1e-6 ? Math.min(1, rest / seg[i]) : 0;
      const a = pts[i], b = pts[i + 1];
      return {
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        ry: Math.atan2(b.x - a.x, b.z - a.z),
      };
    }
    rest -= seg[i];
  }
  return { x: pts[0].x, z: pts[0].z, ry: 0 };
}

export function buildGuide(scene) {
  const g = new THREE.Group();
  g.name = '안내선';
  scene.add(g);

  // ★ 화살표 모양 — 삼각형이다. 네모난 점을 늘어놓으면 **어느 쪽으로
  //   가라는 건지** 안 보인다. 방향이 이 물건의 전부다
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0.19, -0.13, 0, -0.10, 0.13, 0, -0.10,
  ], 3));
  tri.setIndex([0, 1, 2]);
  tri.computeVertexNormals();

  const marks = [];
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(tri, new THREE.MeshBasicMaterial({
      color: COLOR, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide,
    }));
    m.rotation.x = Math.PI;     // 위에서 보이게 눕힌다
    m.position.y = 0.035;       // 바닥에 딱 붙이면 z 다툼이 난다
    m.visible = false;
    g.add(m);
    marks.push(m);
  }

  let pts = null, seg = null, total = 0, phase = 0;

  /** @param p 꺾은점 배열 [{x,z}, ...] · null 이면 끈다 */
  function setPath(p) {
    if (!p || p.length < 2) { pts = null; return; }
    pts = p;
    ({ seg, total } = lengths(p));
  }

  function update(dt) {
    if (!pts || total < 0.4) {
      for (const m of marks) m.visible = false;
      return;
    }
    phase = (phase + dt * SPEED) % GAP;
    const n = Math.min(N, Math.floor(total / GAP) + 1);
    for (let i = 0; i < N; i++) {
      const m = marks[i];
      if (i >= n) { m.visible = false; continue; }
      const s = phase + i * GAP;
      const p = at(pts, seg, s);
      m.position.x = p.x;
      m.position.z = p.z;
      m.rotation.y = p.ry;
      m.visible = true;
      // 끝으로 갈수록 옅어진다 — **가까운 것이 제일 밝다.** 멀리까지
      // 똑같이 밝으면 목표가 아니라 길바닥이 눈에 들어온다
      m.material.opacity = 0.85 * (1 - (s / total) * 0.65);
    }
  }

  return { group: g, setPath, update, get on() { return !!pts; } };
}
