// ══════════════════════════════════════════════════════════════════════════
//  배 부품 키트 — **반복해서 쓰는 것들.**
//
//  ★ 왜 이 파일이 생겼나 (2026-08-03 · 실제 우주선을 조사하고)
//    조종석은 참고 사진을 받고 다시 지었는데 통로와 기관실은 여전히 민판이었다.
//    실제 우주선(ISS)과 「used future」계열 미술을 찾아보니 셋이 맞물렸다:
//
//    1. **규격 랙이 반복된다.** ISS 는 ISPR 이라는 냉장고 크기 캐비닛으로
//       벽을 채운다. 방 안에 물건이 몇 개 있느냐가 아니라 **같은 규격이
//       줄지어 있느냐**가 「배 안」을 만든다
//    2. **손잡이가 사방에 있다.** 무중력에서 몸을 끌어당기는 물건이다.
//       그리고 **손만 나오는 이 게임에 이보다 맞는 소재가 없다**
//    3. **배관·케이블·격자를 정리하지 않는다.** Alien 미술감독의 지침이
//       「보이고 싶은 것보다 세 배 더 지저분하게」였다. 지상 산업 시설을
//       그대로 옮긴 것이 우주선처럼 보이더라는 것
//
//    조사 내용과 출처는 `docs/space/INTERIOR.md` 에 적었다.
//
//  ★ 이것도 전부 기하다
//    「좋아 보이는가」가 아니라 「맞나」로 판정된다. 랙은 직육면체고 손잡이는
//    막대다. 무늬는 그림이라 사장님 몫이고, 오면 이 부품들이 그걸 입는다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';

// ── 재질 ────────────────────────────────────────────────────
// 구역마다 색을 나눈다. 게임 레벨 디자인의 오래된 문법이고, 「내가 어느
// 방에 있나」를 표지판 없이 알게 해 준다 (docs/space/INTERIOR.md §3).
export const ZONE = {
  cockpit: { light: 0x63b6ff, accent: 0xff9a3c },   // 파랑 — 조종·기술
  corridor: { light: 0x9fb4cc, accent: 0xffc46a },  // 중립 — 지나가는 곳
  engine: { light: 0xff7a3c, accent: 0xffd07a },    // 주황·빨강 — 정비·위험
  observ: { light: 0x7fd8ff, accent: 0x9a7fff },    // 차가운 파랑 — 밖을 본다
  workshop: { light: 0xffd27a, accent: 0xff8a3c },  // 노랑 — 손을 쓰는 곳
  garden: { light: 0x8fe8a0, accent: 0xd8ff7a },    // 초록 — 유일하게 살아 있다
  airlock: { light: 0xff5a4a, accent: 0xffd23a },   // 빨강 — 여기 너머는 진공
};

export const MAT = {
  body: new THREE.MeshStandardMaterial({ color: 0x393f47, roughness: 0.72, metalness: 0.45 }),
  faceD: new THREE.MeshStandardMaterial({ color: 0x1b1f25, roughness: 0.62, metalness: 0.5 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x232830, roughness: 0.5, metalness: 0.8 }),
  pipe: new THREE.MeshStandardMaterial({ color: 0x565049, roughness: 0.82, metalness: 0.5 }),
  pipeCold: new THREE.MeshStandardMaterial({ color: 0x3c4a54, roughness: 0.7, metalness: 0.6 }),
  cable: new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.95, metalness: 0.1 }),
  rail: new THREE.MeshStandardMaterial({ color: 0xb9c2cc, roughness: 0.35, metalness: 0.85 }),
};

const glow = (hex) => new THREE.MeshBasicMaterial({ color: hex });

function box(parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/**
 * 규격 랙 한 칸 — 이 게임의 「벽돌」이다.
 *
 * 실제 ISS 의 ISPR 처럼 **크기를 고정한다.** 폭 0.9 · 높이 1.9 · 깊이 0.42.
 * 크기가 제각각이면 반복이 안 읽히고, 반복이 안 읽히면 배가 안 된다.
 *
 * @param kind 얼굴에 뭐가 붙나 — 'panel' 계기 | 'lockers' 서랍 | 'grill' 환기
 *             | 'pipes' 배관 | 'blank' 민판(가끔 있어야 리듬이 산다)
 */
export function rack(parent, x, z, ry, kind, tint) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  parent.add(g);

  const W = 0.9, H = 1.9, D = 0.42;
  box(g, W, H, D, MAT.body, 0, H / 2, -D / 2);                 // 몸통
  box(g, W, 0.06, D + 0.03, MAT.metal, 0, H, -D / 2);          // 윗테
  box(g, W, 0.08, D + 0.03, MAT.metal, 0, 0.04, -D / 2);       // 아랫테
  box(g, 0.05, H, D + 0.02, MAT.metal, -W / 2 + 0.02, H / 2, -D / 2);  // 세로 프레임
  box(g, 0.05, H, D + 0.02, MAT.metal, W / 2 - 0.02, H / 2, -D / 2);

  if (kind === 'lockers') {
    // 서랍 여섯. 손잡이가 있어야 「열 수 있는 것」으로 읽힌다
    for (let i = 0; i < 6; i++) {
      const y = 0.24 + i * 0.28;
      box(g, W - 0.14, 0.24, 0.05, MAT.faceD, 0, y, -0.01);
      box(g, 0.3, 0.035, 0.045, MAT.rail, 0, y - 0.07, 0.02);
    }
  } else if (kind === 'panel') {
    // 계기 뭉치 — Alien 이 말한 「시각적 잡음」이 이것이다
    box(g, W - 0.16, 0.9, 0.05, MAT.faceD, 0, 1.28, -0.01);
    for (let i = 0; i < 14; i++) {
      const cx = -0.3 + (i % 5) * 0.15;
      const cy = 0.98 + Math.floor(i / 5) * 0.16;
      box(g, 0.06, 0.05, 0.03, i % 4 === 0 ? glow(tint) : MAT.metal, cx, cy, 0.03);
    }
    box(g, W - 0.2, 0.16, 0.03, glow(0x0d2430), 0, 1.62, 0.03);   // 작은 화면
    box(g, W - 0.16, 0.5, 0.05, MAT.faceD, 0, 0.5, -0.01);
    for (let i = 0; i < 3; i++) box(g, 0.09, 0.09, 0.05, MAT.metal, -0.25 + i * 0.25, 0.5, 0.03);
  } else if (kind === 'grill') {
    // 환기구. 격자는 살(fin)을 여러 장 세워 만든다
    box(g, W - 0.16, 1.1, 0.04, MAT.faceD, 0, 1.05, -0.01);
    for (let i = 0; i < 11; i++) box(g, W - 0.2, 0.03, 0.05, MAT.metal, 0, 0.58 + i * 0.095, 0.01);
    box(g, W - 0.16, 0.42, 0.05, MAT.faceD, 0, 0.32, -0.01);
  } else if (kind === 'pipes') {
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, H - 0.2, 8), i === 1 ? MAT.pipeCold : MAT.pipe);
      p.position.set(-0.26 + i * 0.26, H / 2, 0.02);
      g.add(p);
      box(g, 0.16, 0.06, 0.16, MAT.metal, -0.26 + i * 0.26, 0.62 + i * 0.24, 0.02);  // 이음쇠
    }
  }

  // 어느 랙이든 라벨 한 줄. 「누가 만든 물건」으로 보이게 하는 것
  box(g, 0.34, 0.045, 0.03, glow(tint), -W / 2 + 0.26, 1.83, 0.02);
  return g;
}

/**
 * 벽 한 면을 랙으로 채운다.
 * **가끔 빈칸을 둔다** — 전부 채우면 무늬가 되고, 무늬는 배로 안 읽힌다.
 */
export function rackRun(parent, axis, fixed, from, to, facing, tint, seed = 1) {
  const KINDS = ['panel', 'lockers', 'grill', 'pipes', 'lockers', 'panel', 'blank', 'grill'];
  const step = 0.95;
  const n = Math.floor((to - from) / step);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = from + step * (i + 0.5);
    const kind = KINDS[(i * 3 + seed * 5) % KINDS.length];
    if (axis === 'x') out.push(rack(parent, t, fixed, facing > 0 ? 0 : Math.PI, kind, tint));
    else out.push(rack(parent, fixed, t, facing > 0 ? Math.PI / 2 : -Math.PI / 2, kind, tint));
  }
  return out;
}

/**
 * 손잡이 — **이 게임에서 제일 값싼 좋은 물건.**
 * 실제 우주선에 사방으로 붙어 있고, 손만 나오는 이 게임에서는 나중에
 * 「잡는다」가 그대로 동사가 된다 (docs/space/PLAN.md §8).
 */
export function handrail(parent, axis, fixed, from, to, y, off) {
  const g = new THREE.Group();
  parent.add(g);
  const len = to - from;
  const mid = (from + to) / 2;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, len, 8), MAT.rail);
  if (axis === 'x') {
    bar.rotation.z = Math.PI / 2;
    bar.position.set(mid, y, fixed + off);
    for (const t of [from + 0.08, to - 0.08]) box(g, 0.05, 0.05, Math.abs(off), MAT.metal, t, y, fixed + off / 2);
  } else {
    bar.rotation.x = Math.PI / 2;
    bar.position.set(fixed + off, y, mid);
    for (const t of [from + 0.08, to - 0.08]) box(g, Math.abs(off), 0.05, 0.05, MAT.metal, fixed + off / 2, y, t);
  }
  g.add(bar);
  return g;
}

/**
 * 배선·배관 다발 — 천장 모서리를 따라 지나간다.
 * **정리하지 않는 것**이 요점이다. 굵기와 색을 섞는다.
 */
export function conduit(parent, axis, fixed, from, to, y, tint) {
  const g = new THREE.Group();
  parent.add(g);
  const len = to - from;
  const mid = (from + to) / 2;
  const specs = [[0.075, MAT.pipe, -0.14], [0.05, MAT.pipeCold, 0], [0.032, MAT.cable, 0.11], [0.026, MAT.cable, 0.16]];
  for (const [r, mat, off] of specs) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
    if (axis === 'x') { c.rotation.z = Math.PI / 2; c.position.set(mid, y + off * 0.5, fixed + off); }
    else { c.rotation.x = Math.PI / 2; c.position.set(fixed + off, y + off * 0.5, mid); }
    g.add(c);
  }
  // 고정 밴드 — 일정 간격으로. 이게 있어야 「매달려 있다」로 읽힌다
  const n = Math.max(2, Math.round(len / 1.3));
  for (let i = 0; i <= n; i++) {
    const t = from + (len * i) / n;
    if (axis === 'x') box(g, 0.06, 0.1, 0.42, MAT.metal, t, y, fixed + 0.02);
    else box(g, 0.42, 0.1, 0.06, MAT.metal, fixed + 0.02, y, t);
  }
  // 띠조명 하나를 같이 매단다 — 실제 우주선도 조명을 구조에 박아 넣는다
  if (axis === 'x') box(g, len, 0.03, 0.05, glow(tint), mid, y - 0.12, fixed + 0.2);
  else box(g, 0.05, 0.03, len, glow(tint), fixed + 0.2, y - 0.12, mid);
  return g;
}

/** 글자 표지 — 방 이름·번호. 캔버스라 그림이 아니라 데이터다 */
export function sign(parent, text, x, y, z, ry, tint = 0x8fd0ff, w = 0.62) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 96;
  const c = cv.getContext('2d');
  c.fillStyle = '#0d1218'; c.fillRect(0, 0, 256, 96);
  c.strokeStyle = `#${tint.toString(16).padStart(6, '0')}`;
  c.lineWidth = 3; c.strokeRect(4, 4, 248, 88);
  c.fillStyle = `#${tint.toString(16).padStart(6, '0')}`;
  c.font = '700 44px system-ui, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 128, 50);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 96 / 256), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  parent.add(m);
  return m;
}

// ══════════════════════════════════════════════════════════════════════════
//  압력 용기 문법 — **「그냥 배 같다」를 고치는 것들.**
//
//  ★ 왜 배처럼 보였나 (2026-08-03 · 사장님 지적 + 조사)
//    내가 만든 방은 **직육면체 + 평평한 천장**이었다. 그건 건물 논리다.
//    조사해 보니 이유가 명확했다:
//
//      건물은 **중력만** 견디면 된다 → 수직 기둥 + 직각 벽
//      우주선은 **사방에서 오는 압력**을 견뎌야 한다 → 원통 + 링 프레임
//
//    압력은 방향이 없으므로 모서리가 있으면 거기 힘이 몰린다. 그래서 실제
//    우주선의 내압 껍데기는 **원통**이고, 일정 간격으로 **링 프레임**이 돈다.
//    안쪽에는 바닥·벽·천장을 따로 깔아 장비를 덮는다 — 그래서 바닥 밑과
//    천장 위에 공간이 있고, 패널을 열면 배선이 나온다.
//
//    원통을 그대로 만들면 걷기와 물건 배치가 다 어려워진다. 그래서
//    **모따기(chamfer)** 로 흉내 낸다 — 벽과 바닥/천장이 만나는 모서리를
//    45도로 깎는다. 팔각 단면이 되고, 이것만으로 「상자 방」이 사라진다.
// ══════════════════════════════════════════════════════════════════════════

/** 모따기 폭. 이보다 크면 걸어 다닐 바닥이 줄고, 작으면 티가 안 난다 */
export const CHAMFER = 0.42;

/**
 * 모서리를 깎는다 — 벽이 바닥·천장으로 45도로 이어진다.
 * **이 함수 하나가 「건물」과 「우주선」을 가른다.**
 *
 * `gaps` 는 문구멍이다. 바닥 쪽 모따기가 문 앞을 막으면 못 지나간다 —
 * 벽과 **똑같은 구멍**을 내야 한다.
 */
export function chamfer(parent, r, H, mat, gapsBySide = {}) {
  const c = CHAMFER, diag = c * Math.SQRT2;
  const segs = (from, to, gaps = []) => {
    const out = [];
    let cur = from;
    for (const [a, b] of [...gaps].sort((p, q) => p[0] - q[0])) {
      if (a > cur) out.push([cur, a]);
      cur = Math.max(cur, b);
    }
    if (cur < to) out.push([cur, to]);
    return out;
  };

  for (const [y, up] of [[0, 1], [H, -1]]) {
    // 천장 쪽(up = -1)은 구멍이 필요 없다 — 문은 바닥에서 2.05 까지다
    const g = (side) => (up > 0 ? (gapsBySide[side] || []) : []);

    for (const [zz, dir, side] of [[r.z0, 1, 'z0'], [r.z1, -1, 'z1']]) {
      for (const [a, b] of segs(r.x0, r.x1, g(side))) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(b - a, 0.08, diag), mat);
        m.position.set((a + b) / 2, y + up * c * 0.5, zz + dir * c * 0.5);
        m.rotation.x = dir * up * Math.PI / 4;
        parent.add(m);
      }
    }
    for (const [xx, dir, side] of [[r.x0, 1, 'x0'], [r.x1, -1, 'x1']]) {
      for (const [a, b] of segs(r.z0, r.z1, g(side))) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(diag, 0.08, b - a), mat);
        m.position.set(xx + dir * c * 0.5, y + up * c * 0.5, (a + b) / 2);
        m.rotation.z = -dir * up * Math.PI / 4;
        parent.add(m);
      }
    }
  }
}

/**
 * 링 프레임 — 압력 껍데기를 두르는 구조재. **일정 간격**이라는 것이 요점이다.
 * 간격이 들쭉날쭉하면 구조재가 아니라 장식으로 보인다.
 */
export function ringFrames(parent, r, H, along, step, tint) {
  const W = r.x1 - r.x0, D = r.z1 - r.z0;
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const T = 0.13, P = 0.1;                      // 두께 · 안으로 튀어나오는 깊이
  const len = along === 'z' ? D : W;
  const n = Math.max(1, Math.round(len / step) - 1);
  for (let i = 1; i <= n; i++) {
    const t = (along === 'z' ? r.z0 : r.x0) + (len * i) / (n + 1);
    const g = new THREE.Group();
    parent.add(g);
    if (along === 'z') {
      box(g, W, P, T, MAT.metal, cx, H - P / 2, t);                       // 천장
      box(g, W, P, T, MAT.metal, cx, P / 2, t);                          // 바닥
      for (const sx of [r.x0, r.x1]) box(g, P, H, T, MAT.metal, sx + (sx === r.x0 ? P / 2 : -P / 2), H / 2, t);
      box(g, W * 0.86, 0.03, 0.045, new THREE.MeshBasicMaterial({ color: tint }), cx, H - 0.16, t - T / 2 - 0.02);
    } else {
      box(g, T, P, D, MAT.metal, t, H - P / 2, cz);
      box(g, T, P, D, MAT.metal, t, P / 2, cz);
      for (const sz of [r.z0, r.z1]) box(g, T, H, P, MAT.metal, t, H / 2, sz + (sz === r.z0 ? P / 2 : -P / 2));
      box(g, 0.045, 0.03, D * 0.86, new THREE.MeshBasicMaterial({ color: tint }), t - T / 2 - 0.02, H - 0.16, cz);
    }
  }
}

/**
 * 압력 해치 — 사각 문구멍을 **우주선 문**으로 바꾼다.
 * 모서리를 둥글게(모따기로) 깎고, 잠금 손잡이(dog)를 넷 붙인다.
 * 실제 우주선 문이 이렇게 생긴 이유도 압력이다 — 모서리에 힘이 몰린다.
 */
export function hatch(parent, x, z, half, H, ry, tint) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  parent.add(g);
  const h = Math.min(H - 0.3, 2.05);
  const R = 0.34;                                // 모서리를 깎는 크기

  for (const sx of [-1, 1]) {
    box(g, 0.17, h - R, 0.4, MAT.metal, sx * half, (h - R) / 2, 0);
    box(g, 0.05, h - R - 0.2, 0.045, new THREE.MeshBasicMaterial({ color: tint }), sx * (half - 0.11), (h - R) / 2, 0.2);
    // 모서리 — 45도로 깎는다. 이 하나로 「문」이 「해치」가 된다
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.17, R * 1.42, 0.4), MAT.metal);
    c.position.set(sx * (half - R / 2), h - R / 2, 0);
    c.rotation.z = sx * Math.PI / 4;
    g.add(c);
  }
  box(g, half * 2 - R * 2 + 0.17, 0.18, 0.4, MAT.metal, 0, h - 0.09, 0);
  box(g, half * 2 - R * 2, 0.05, 0.045, new THREE.MeshBasicMaterial({ color: tint }), 0, h - 0.19, 0.2);
  box(g, half * 2, 0.06, 0.36, MAT.metal, 0, 0.03, 0);                    // 문턱

  // 잠금 손잡이 넷 — 압력문의 상징이다
  for (const [dx, dy] of [[-1, 0.34], [1, 0.34], [-1, 0.74], [1, 0.74]]) {
    box(g, 0.16, 0.05, 0.05, MAT.rail, dx * (half - 0.09), h * dy, 0.21);
  }
  // 위험 줄무늬 — 문턱에. 「여기 압력 경계」라고 말해 준다
  for (let i = 0; i < 7; i++) {
    box(g, 0.12, 0.012, 0.3, new THREE.MeshBasicMaterial({ color: i % 2 ? 0x1a1a1a : 0xd8a13a }),
      -half + 0.2 + i * (half * 2 - 0.4) / 6, 0.065, 0);
  }
  return g;
}
