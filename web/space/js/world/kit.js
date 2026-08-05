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
import { PLATE } from '../game/bay-table.js';

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

/**
 * 베이 번호판 — **랙과 패널에 「기관 3」이라고 적는다.**
 *
 * ★ 여기 있던 것은 **아무것도 안 적힌 빛나는 띠**였다. 「누가 만든
 *   물건」으로 보이라고 넣었는데, 여덟 개가 다 똑같아서 기관실 벽 앞에
 *   서면 어느 랙인지 말할 방법이 없었다 (REALSHIP.md §8-⑦).
 *
 * ★ 글자 크기를 눈대중으로 안 잡는다. `game/bay-table.js PLATE` 가
 *   「3.2m 앞에서 읽힌다」를 숫자로 들고 있고, 검사가 그 숫자를 읽는다.
 *   판에 글자를 꽉 채우면 오히려 안 읽히므로 여백을 남긴다.
 *
 * ★ 판 자체는 **안 빛난다** (MeshBasic 이지만 어두운 바탕). 다 빛나면
 *   배가 크리스마스가 되고, 정말 봐야 할 불(고장 램프)이 안 보인다.
 */
export function bayPlate(parent, text, x, y, z, tint = 0x8fd0ff, ry = 0) {
  const PX = 64;                       // 글자 높이(화소). 판 세로를 나눈다
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = Math.round(256 * PLATE.h / PLATE.w);
  const c = cv.getContext('2d');
  const hex = `#${tint.toString(16).padStart(6, '0')}`;
  c.fillStyle = '#0a0d11'; c.fillRect(0, 0, cv.width, cv.height);
  // 왼쪽에 색 띠 — 어느 구역 물건인지 글자를 안 읽어도 안다
  c.fillStyle = hex; c.fillRect(0, 0, 10, cv.height);
  c.strokeStyle = '#4a545e'; c.lineWidth = 2;
  c.strokeRect(1, 1, cv.width - 2, cv.height - 2);
  c.fillStyle = '#dbe6f2';
  c.font = `700 ${PX}px system-ui, sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, cv.width / 2 + 5, cv.height / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;                  // 비스듬히 봐도 안 뭉갠다
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(PLATE.w, PLATE.h),
    new THREE.MeshBasicMaterial({ map: tex }),
  );
  m.name = `베이 ${text}`;
  m.position.set(x, y, z);
  m.rotation.y = ry;
  parent.add(m);
  // 검사가 「이 판의 글자가 몇 m 앞에서 읽히나」를 물을 수 있게 남긴다
  m.userData.bay = { text, glyph: PLATE.h * PX / cv.height };
  return m;
}

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
export function rack(parent, x, z, ry, kind, tint, bayText = null, lift = 0) {
  const g = new THREE.Group();
  // ★ `lift` 는 **바닥에서 띄운 랙**이다 (통로용).
  //   통로는 바닥 모서리에 스탠드오프(배관 덮개)가 지나가므로 바닥까지
  //   내려오는 랙은 그것을 뚫는다. 실제 모듈도 바닥 난간 위쪽에 보관
  //   랙이 붙는다 — 아래는 배관, 위는 물건. 그대로 가져왔다
  g.position.set(x, lift, z);
  g.rotation.y = ry;
  parent.add(g);

  const W = 0.9, H = lift > 0 ? 1.9 - lift - 0.12 : 1.9, D = 0.42;
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

  // 어느 랙이든 번호판 한 장. ★ 전에는 **아무것도 안 적힌 빛나는 띠**라
  //   랙 여덟이 다 똑같았다 — 「3번 베이」라고 부를 수가 없었다
  if (bayText) {
    // ★ 번호판은 **랙 꼭대기 기준**이다. 1.79 라고 박아 뒀더니 띄운 랙
    //   (통로용 `lift`)에서 판이 랙 위 허공에 떴다 — 높이가 달라진 물건에
    //   절대 좌표를 쓰면 이렇게 된다
    bayPlate(g, bayText, 0, H - 0.11, 0.022, tint);
    g.userData.bay = bayText;
  } else {
    box(g, 0.34, 0.045, 0.03, glow(tint), -W / 2 + 0.26, H - 0.07, 0.02);
  }
  return g;
}

/**
 * 벽 한 면을 랙으로 채운다.
 * **가끔 빈칸을 둔다** — 전부 채우면 무늬가 되고, 무늬는 배로 안 읽힌다.
 */
export function rackRun(parent, axis, fixed, from, to, facing, tint, seed = 1, nextBay = null, skip = [], lift = 0) {
  const KINDS = ['panel', 'lockers', 'grill', 'pipes', 'lockers', 'panel', 'blank', 'grill'];
  const step = 0.95;
  const n = Math.floor((to - from) / step);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = from + step * (i + 0.5);
    // ★ **그 벽에 이미 붙어 있는 것 위에 서지 않는다.** 정비실에서 한 번,
    //   기관실·관측실에서 또 한 번 랙이 점검 패널을 뚫고 겹쳐 그려졌다.
    //   그때마다 패널을 빈 벽으로 **옮겨서** 넘어갔는데, 그건 그 자리만
    //   고치는 것이라 벽을 하나 늘릴 때마다 다시 난다.
    //   번호를 붙이고 나서야 눈에 띄었다 — 「기관 1」 이 랙 속에 박혀 있었다
    if (skip.some(([a, c]) => t > a && t < c)) continue;
    const kind = KINDS[(i * 3 + seed * 5) % KINDS.length];
    // ★ 번호는 **부르는 쪽(ship.js)이 매긴다.** 여기서 매기면 벽 한 줄마다
    //   1 부터 다시 시작해서 한 방에 같은 번호가 두 개 생긴다
    const bayText = nextBay ? nextBay() : null;
    if (axis === 'x') out.push(rack(parent, t, fixed, facing > 0 ? 0 : Math.PI, kind, tint, bayText, lift));
    else out.push(rack(parent, fixed, t, facing > 0 ? Math.PI / 2 : -Math.PI / 2, kind, tint, bayText, lift));
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
  // 이름을 단다 — 문간을 가로지르면 검사가 **누가 범인인지** 말해야 한다
  g.name = '난간';
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
 * ★ **스탠드오프** — 배관·배선·난간이 지나가는 **모서리 통로.**
 *
 *   ISS 데스티니 실험동은 랙과 랙이 만나는 **모서리에 통로 넷**을 두고
 *   배관·배선·공조 덕트·냉각수관을 **전부 그 안으로만** 보낸다
 *   (docs/space/REALSHIP.md §1). 벽면은 랙·패널·문이 쓴다.
 *
 *   **우리는 정반대였고 같은 병을 세 번 앓았다:**
 *     v26 링 프레임 기둥이 문 다섯을 관통
 *     v26 통로 난간이 문 넷을 관통
 *     v29 기관실 난간이 랙 면 0.5m 앞을 가로지름
 *   세 번 다 증상만 고쳤다. **지나갈 곳을 안 정해 놔서** 계속 났다.
 *
 *   그래서 자리를 규칙으로 만든다: **긴 것은 모서리에만 산다.**
 *   `STANDOFF.band` 안에 없으면 tools 가 ✘ 를 찍는다.
 *
 * @param corner ['x0'|'x1', 'y0'|'y1'] 어느 모서리인가 (좌우 · 위아래)
 * @param rail   난간도 같이 달까 (아래 모서리에만 단다 — 손이 닿는 높이)
 */
export function standoff(parent, room, H, axis, corner, tint, rail = false) {
  const g = new THREE.Group();
  g.name = '스탠드오프';
  parent.add(g);

  const [cx, cy] = corner;
  // 모서리에서 안쪽으로 파고든 자리. 벽면을 안 침범한다
  const IN = 0.30;
  const wx = cx === 'x0' ? room.x0 + IN : room.x1 - IN;
  const wz = cx === 'x0' ? room.z0 + IN : room.z1 - IN;
  const y = cy === 'y1' ? H - IN : IN + 0.22;

  const from = axis === 'z' ? room.z0 + 0.25 : room.x0 + 0.25;
  const to = axis === 'z' ? room.z1 - 0.25 : room.x1 - 0.25;
  const fixed = axis === 'z' ? wx : wz;
  const len = to - from, mid = (from + to) / 2;

  // 모서리를 덮는 **비스듬한 덮개판** — 이게 「통로」로 읽히게 하는 것이다.
  // 없으면 그냥 파이프가 공중에 떠 있다
  const sx = cx === 'x0' ? 1 : -1, sy = cy === 'y1' ? -1 : 1;
  const cover = new THREE.Mesh(new THREE.BoxGeometry(
    axis === 'z' ? 0.42 : len, 0.03, axis === 'z' ? len : 0.42,
  ), MAT.faceD);
  cover.position.set(
    axis === 'z' ? fixed + sx * 0.10 : mid,
    y + sy * 0.16,
    axis === 'z' ? mid : fixed + sx * 0.10,
  );
  cover.rotation[axis === 'z' ? 'z' : 'x'] = sx * sy * 0.72;
  g.add(cover);

  // 다발 — 굵기와 색을 섞는다. **정리하지 않는 것**이 요점이다
  const specs = [[0.075, MAT.pipe, -0.10], [0.05, MAT.pipeCold, 0], [0.032, MAT.cable, 0.08], [0.026, MAT.cable, 0.13]];
  for (const [r, mat, off] of specs) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
    if (axis === 'x') { c.rotation.z = Math.PI / 2; c.position.set(mid, y + off * 0.6, fixed + sx * off); }
    else { c.rotation.x = Math.PI / 2; c.position.set(fixed + sx * off, y + off * 0.6, mid); }
    g.add(c);
  }
  // 고정 밴드
  const n = Math.max(2, Math.round(len / 1.4));
  for (let i = 0; i <= n; i++) {
    const t = from + (len * i) / n;
    if (axis === 'x') box(g, 0.06, 0.1, 0.34, MAT.metal, t, y, fixed + sx * 0.02);
    else box(g, 0.34, 0.1, 0.06, MAT.metal, fixed + sx * 0.02, y, t);
  }
  // 띠조명 — 실제 배도 조명을 구조에 박아 넣는다. **바닥 기준면**을 만든다
  if (axis === 'x') box(g, len, 0.03, 0.05, glow(tint), mid, y + sy * 0.10, fixed + sx * 0.16);
  else box(g, 0.05, 0.03, len, glow(tint), fixed + sx * 0.16, y + sy * 0.10, mid);

  // 난간 — **아래 모서리에만.** 손이 닿는 높이이고, 벽면이 아니라 모서리다
  if (rail) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, len, 8), MAT.rail);
    const rg = new THREE.Group();
    rg.name = '난간';
    g.add(rg);
    if (axis === 'x') { bar.rotation.z = Math.PI / 2; bar.position.set(mid, y + 0.26, fixed + sx * 0.20); }
    else { bar.rotation.x = Math.PI / 2; bar.position.set(fixed + sx * 0.20, y + 0.26, mid); }
    rg.add(bar);
  }
  // ★ **아래 모서리는 몸이 부딪힌다.** 안 막으면 배관을 뚫고 걸어간다 —
  //   그리고 막으면 통로가 저절로 좁아져 실제 모듈(1.2m)에 가까워진다.
  //   위 모서리는 머리 위라 안 막는다
  g.userData.solid = cy === 'y0'
    ? { axis, fixed: fixed + sx * 0.12, half: 0.20, from, to }
    : null;
  return g;
}

/**
 * 배선·배관 다발 — 천장 모서리를 따라 지나간다.
 * **정리하지 않는 것**이 요점이다. 굵기와 색을 섞는다.
 *
 * ★ 새로 쓰지 않는다. `standoff()` 를 쓴다 — 이건 벽면을 따라 긋는 옛 방식이라
 *   문·랙 앞을 가로지르는 사고를 세 번 냈다 (REALSHIP.md §1).
 */
export function conduit(parent, axis, fixed, from, to, y, tint) {
  const g = new THREE.Group();
  // 이름을 단다 — 문간을 가로지르면 검사가 **누가 범인인지** 말해야 한다
  g.name = '배관';
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
  // ★ **양면으로 만든다.** 전에는 three 기본값(FrontSide)이라 뒷면이 아예
  //   안 그려졌고, 곁방 넷의 이름표가 방 안쪽을 향해 있어서 **통로에서는
  //   읽을 수 없었다** — 「조종석은 어딨고?」라는 말을 듣고서야 찾았다.
  //   자리는 ship.js 에서 바로잡았지만, 여기서도 양면으로 두면 다음에
  //   표지를 하나 더 달 때 같은 함정을 안 밟는다.
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 96 / 256),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
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
export function ringFrames(parent, r, H, along, step, tint, gaps = {}) {
  const W = r.x1 - r.x0, D = r.z1 - r.z0;
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const T = 0.13, P = 0.1;                      // 두께 · 안으로 튀어나오는 깊이
  const len = along === 'z' ? D : W;
  const n = Math.max(1, Math.round(len / step) - 1);
  // ★ **문구멍에는 기둥을 안 세운다** (2026-08-04 · 사장님 「문들이 쇠파이프로
  //   막혀있는데?」). 링 프레임의 세로 기둥은 벽을 따라 일정 간격으로 서는데,
  //   그 벽에 문이 나 있으면 **문 한복판에 쇠기둥이 박힌다** — 여섯 문 중
  //   다섯이 그랬다. 벽은 `wallRun` 이 구멍을 뚫는데 **기둥만 안 뚫었다.**
  //   구조재는 원래 개구부를 비켜 가고, 그래서 문틀(hatch)이 따로 있는 것이다.
  //
  //   ★ 왜 여태 안 보였나: v22 까지는 문짝이 없어서 열린 구멍 옆의 기둥이
  //     그냥 문틀처럼 보였다. 문을 단 v23 부터 「닫힌 문을 관통한 막대」가
  //     됐다. **숫자로는 아무 데도 안 걸린다** — 기둥은 충돌이 아니라 걸어는
  //     다녀지고 문도 잘 열린다. 눈에만 보이는 종류다.
  const holed = (list, at) => (list ?? []).some(([a, b]) => at > a && at < b);
  for (let i = 1; i <= n; i++) {
    const t = (along === 'z' ? r.z0 : r.x0) + (len * i) / (n + 1);
    const g = new THREE.Group();
    parent.add(g);
    if (along === 'z') {
      box(g, W, P, T, MAT.metal, cx, H - P / 2, t);                       // 천장
      box(g, W, P, T, MAT.metal, cx, P / 2, t);                          // 바닥
      for (const sx of [r.x0, r.x1]) {
        if (holed(sx === r.x0 ? gaps.x0 : gaps.x1, t)) continue;
        box(g, P, H, T, MAT.metal, sx + (sx === r.x0 ? P / 2 : -P / 2), H / 2, t);
      }
      box(g, W * 0.86, 0.03, 0.045, new THREE.MeshBasicMaterial({ color: tint }), cx, H - 0.16, t - T / 2 - 0.02);
    } else {
      box(g, T, P, D, MAT.metal, t, H - P / 2, cz);
      box(g, T, P, D, MAT.metal, t, P / 2, cz);
      for (const sz of [r.z0, r.z1]) {
        if (holed(sz === r.z0 ? gaps.z0 : gaps.z1, t)) continue;
        box(g, T, H, P, MAT.metal, t, H / 2, sz + (sz === r.z0 ? P / 2 : -P / 2));
      }
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

/**
 * 차단기 패널 — **전력 배분을 손으로 한다.**
 *
 * ★ 왜 메뉴가 아닌가
 *   화면에 배분 슬라이더를 띄우면 조종석에 서서 다 할 수 있고, 그러면
 *   방 넷을 오가는 이 게임의 긴장(PLAN §9-1)이 통째로 사라진다.
 *   **통로까지 걸어와서 레버를 내려야** 「지금 저기까지 갈 시간이 있나」가
 *   질문이 된다. 손만 나오는 게임이라는 정체성과도 맞는다.
 *
 * @param circuits [{key, name}] — 표(game/chase-table.js CIRCUITS)에서 온다
 * @returns [{key, lever, lamp, hit}] — hit 이 조준 판정을 받는 몸이다
 */
export function breakerPanel(parent, x, z, ry, circuits, tint, bayText = null) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  parent.add(g);

  const W = 0.36 * circuits.length + 0.24;
  box(g, W, 1.28, 0.12, MAT.body, 0, 1.28, -0.04);            // 판
  box(g, W, 0.08, 0.16, MAT.metal, 0, 1.92, -0.02);           // 윗테
  box(g, W, 0.08, 0.16, MAT.metal, 0, 0.64, -0.02);           // 아랫테
  if (bayText) bayPlate(g, bayText, 0, 1.84, 0.06, tint);
  else box(g, W - 0.1, 0.05, 0.04, glow(tint), 0, 1.86, 0.05);

  const out = [];
  circuits.forEach((c, i) => {
    const cx = -W / 2 + 0.24 + i * 0.36;

    // 홈 — 레버가 움직이는 자리. 있어야 「움직이는 물건」으로 읽힌다
    box(g, 0.16, 0.62, 0.05, MAT.faceD, cx, 1.32, 0.03);

    // 레버. 아래로 내리면 꺼짐, 위로 올리면 켜짐
    const lever = new THREE.Group();
    lever.position.set(cx, 1.32, 0.06);
    g.add(lever);
    box(lever, 0.075, 0.34, 0.075, MAT.rail, 0, 0.17, 0);
    box(lever, 0.13, 0.1, 0.13, new THREE.MeshStandardMaterial({
      color: 0xc4453a, roughness: 0.45, metalness: 0.3,
    }), 0, 0.34, 0);

    // 불 — 켜졌나. **레버 각도만으로는 멀리서 안 읽힌다**
    const lampMat = new THREE.MeshBasicMaterial({ color: 0x2a2f36 });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.06, 0.04), lampMat);
    lamp.position.set(cx, 0.86, 0.06);
    g.add(lamp);

    // 조준 판정용 몸 — 레버는 얇아서 그냥 두면 조준하기가 괴롭다.
    // 안 보이는 큰 상자를 하나 겹쳐 둔다
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.9, 0.24),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.position.set(cx, 1.36, 0.1);
    g.add(hit);

    out.push({ key: c.key, name: c.name, lever, lamp, lampMat, hit, tint });
  });

  // ── 철사 가드 — **잘못 건드려도 안 꺾이게** ──────────────
  // ★ 스페이스 셔틀은 토글 스위치를 **움푹 들어가게** 박고 스위치 사이에
  //   철사 가드를 넣었다. 패널을 밟거나 손이 스쳐도 안 꺾이게 한 것이고,
  //   가드는 티타늄이었다 — 불꽃이 튀면 안 되니까
  //   (docs/space/REALSHIP.md §3).
  //
  //   이 배의 차단기가 정확히 그런 물건이다: 셋 중 둘만 켤 수 있고,
  //   추격 중에 잘못 내리면 그 자리에서 붙잡힌다. **잘못 건드리면 큰일
  //   나는 것**은 생김새로 그렇게 말해야 한다.
  //
  //   조준은 안 막는다 — 조준선은 정해진 판정 상자만 쏘므로(main.js
  //   interactStep) 이 철사는 **눈에만** 있는다. 실제 가드와 같다.
  for (let i = 0; i <= circuits.length; i++) {
    const gx = -W / 2 + 0.06 + i * 0.36;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), MAT.rail);
    bar.position.set(gx, 1.42, 0.15);
    g.add(bar);
    for (const y of [1.17, 1.67]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), MAT.rail);
      arm.rotation.x = Math.PI / 2;
      arm.position.set(gx, y, 0.08);
      g.add(arm);
    }
  }
  return out;
}

/**
 * 점검 패널 — **고장을 손으로 고치는 자리** (game/fault.js).
 *
 * ★ 방마다 같은 물건 하나를 둔다
 *   고장 종류마다 다른 물건을 만들면 종류가 스물여덟이 될 때 스물여덟 개를
 *   만들어야 한다. 그건 못 한다. **자리는 하나고, 무엇이 잘못됐는지는
 *   소리와 계기가 말한다** — 그게 이 게임의 원래 규칙이기도 하다 (PLAN §3-1).
 *
 * ★ 손잡이는 **잡고 돌리는 것**이다 (밸브와 같은 규약)
 *   차단기처럼 딸깍이면 「눌렀더니 고쳐졌다」가 되어 진단이 사라진다.
 *   시간이 드는 동작이라야 「지금 여기 매여 있다」가 생긴다.
 */
export function servicePanel(parent, x, z, ry, tint, bayText = null) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  parent.add(g);

  box(g, 0.62, 0.72, 0.09, MAT.body, 0, 1.18, -0.03);          // 판
  box(g, 0.66, 0.06, 0.12, MAT.metal, 0, 1.56, -0.02);         // 윗테
  box(g, 0.66, 0.06, 0.12, MAT.metal, 0, 0.80, -0.02);         // 아랫테
  // ★ **일곱 방 전부 1번이 점검 패널이다** (bay-table.js PANEL_BAY).
  //   처음 들어간 방에서도 「1번을 찾으면 고치는 자리」를 안다 —
  //   사실성보다 **배울 수 있는 규칙** 하나가 값이 크다
  if (bayText) { bayPlate(g, bayText, 0, 1.62, 0.05, tint); g.userData.bay = bayText; }
  else box(g, 0.5, 0.02, 0.03, glow(tint), 0, 1.5, 0.04);

  // 돌리는 손잡이 — 돌아가는 것이 보여야 「먹고 있다」를 안다
  const knob = new THREE.Group();
  knob.position.set(0, 1.16, 0.06);
  g.add(knob);
  knob.add(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.028, 7, 18), MAT.rail));
  box(knob, 0.3, 0.035, 0.035, MAT.rail, 0, 0, 0.01);
  box(knob, 0.035, 0.3, 0.035, MAT.rail, 0, 0, 0.01);

  // 불 — 이 자리가 지금 문제인가. **평소엔 꺼져 있다** (다 켜 두면 안내판이 된다)
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x2a2f36 });
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.04), lampMat);
  lamp.position.set(0.22, 0.9, 0.06);
  g.add(lamp);

  // 조준 판정용 — 손잡이는 얇다 (차단기·해도대와 같은 처방)
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.7, 0.26),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.set(0, 1.18, 0.1);
  g.add(hit);

  return { group: g, knob, hit, lampMat, bay: bayText };
}
