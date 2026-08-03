// 형태 — **단면을 쌓아 잇는다.** 이 파일이 몸의 모양을 결정한다.
//
// ── 지금까지 왜 형태가 안 나왔는가 ──────────────────────────
// 첫 판은 각기둥(prism)을 쌓았고, 둘째 판은 찌그러진 타원 덩어리(chunk)를
// 매달았다. 둘 다 **관절 하나에 도형 하나**라는 점이 같고, 그래서 몸이
// 「관절에 풍선을 매단 것」이 됐다. 골렘은 원래 바위 덩어리라 그게 맞았지만
// 사람과 짐승은 아니다.
//
// 사람 몸의 실루엣을 만드는 것은 **한 부위 안에서 굵기가 변하는 방식**이다:
//
//   · 어깨에서 허리로 **좁아졌다가** 골반에서 다시 벌어진다 (V 자)
//   · 허벅지는 위가 굵고 무릎에서 잘록하다
//   · 종아리는 **위쪽 1/3 이 가장 굵다** — 가운데가 아니다
//   · 팔뚝은 팔꿈치 바로 아래가 굵고 손목에서 절반으로 준다
//
// 도형 하나로는 이걸 못 한다. **높이마다 단면을 하나씩 놓고 이어 붙이면**
// 된다 — 그게 loft 다. 링 네댓 개면 위의 곡선이 전부 나온다.

import * as THREE from 'three';

/**
 * 단면 쌓기.
 *
 * @param sections  [{ y, w, d?, round?, cx?, cz? }] — **아래에서 위로** 정렬.
 *        w = 좌우 폭, d = 앞뒤 깊이(생략하면 w), cx/cz = 그 높이에서의 중심 이동
 *        (배가 앞으로 나오거나 등이 굽는 것을 이걸로 만든다)
 * @param opt.round 단면 모양. 2 = 완전한 타원 · 3~5 = 모서리가 둥근 사각
 *        (갑옷·상자 같은 것) · 큰 값일수록 각진다
 * @param opt.seg   둘레 분할. 12 면 충분하고 16 이면 매끈하다
 * @param opt.capB / opt.capT  아래·위를 막을지. 안 보이는 쪽은 안 막는다
 *
 * ── 감는 방향을 자동으로 고친다 ──────────────────────────────
 * 삼각형 방향을 손으로 맞추면 반드시 한 번은 뒤집는다(안쪽만 보이는 메시가
 * 되고, 오류는 안 나고, 화면에서는 「구멍 뚫린 몸」으로 나온다).
 * 다 만든 뒤 **부호 있는 부피**를 재서 음수면 인덱스를 뒤집는다 —
 * 재는 데 드는 비용은 무시할 수준이고 다시는 안 틀린다.
 */
export function loft(sections, opt = {}) {
  const seg = opt.seg ?? 16;
  const round = opt.round ?? 2.6;
  const pos = [];
  for (const s of sections) {
    const r = s.round ?? round;
    const e = 2 / r;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const c = Math.cos(a), n = Math.sin(a);
      // 초타원 — 지수 하나로 타원과 둥근 사각 사이를 오간다
      const x = Math.sign(c) * Math.abs(c) ** e * s.w * 0.5;
      const z = Math.sign(n) * Math.abs(n) ** e * (s.d ?? s.w) * 0.5;
      pos.push(x + (s.cx ?? 0), s.y, z + (s.cz ?? 0));
    }
  }
  const idx = [];
  for (let r = 0; r < sections.length - 1; r++) {
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      const a = r * seg + i, b = r * seg + j, c = (r + 1) * seg + j, d = (r + 1) * seg + i;
      idx.push(a, b, c, a, c, d);
    }
  }
  const capRing = (ringIdx, y, s) => {
    const cIdx = pos.length / 3;
    pos.push(s.cx ?? 0, y, s.cz ?? 0);
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      idx.push(cIdx, ringIdx * seg + i, ringIdx * seg + j);
    }
  };
  if (opt.capB !== false) capRing(0, sections[0].y, sections[0]);
  if (opt.capT !== false) capRing(sections.length - 1, sections[sections.length - 1].y, sections[sections.length - 1]);

  // 부호 있는 부피 — 발산 정리. 음수면 안팎이 뒤집힌 것이다
  let vol = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    vol += (pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1])
      - pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c])
      + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c])) / 6;
  }
  if (vol < 0) for (let t = 0; t < idx.length; t += 3) { const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s; }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // **uv 를 반드시 넣는다.** rig.js 의 도형은 three 의 기본 지오메트리에서
  // 나오므로 position·normal·uv 셋을 가진다. 속성 구성이 다르면
  // mergeGeometries 가 **조용히 null 을 돌려주고** 그 관절이 통째로 사라진다 —
  // 오류는 콘솔 경고 한 줄뿐이라 못 보고 지나가기 쉽다.
  const uv = new Float32Array((pos.length / 3) * 2);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 사지 — **관절에서 아래로 매달린다.** 위가 0, 아래가 −len.
 *
 * profile 은 [t, w, d] 의 배열이고 t 는 0(관절) ~ 1(끝)이다.
 * 굵기가 어디서 최대인지를 t 로 적는 것이라, 「종아리는 위쪽 1/3」 같은
 * 규칙을 숫자로 그대로 옮길 수 있다.
 */
export function limb(len, profile, opt = {}) {
  const secs = profile.map(([t, w, d]) => ({ y: -t * len, w, d: d ?? w }));
  secs.reverse();                    // loft 는 아래에서 위로 받는다
  return loft(secs, { seg: opt.seg ?? 14, round: opt.round ?? 2.4, capT: opt.capT, capB: opt.capB });
}

/** 앞뒤로 누운 형태 — 발·주둥이처럼 **Z 축으로 뻗는 것**. 만든 뒤 눕힌다 */
export function snout(len, profile, opt = {}) {
  const g = limb(len, profile, opt);
  g.rotateX(-Math.PI / 2);           // −Y 로 뻗던 것이 +Z 로
  return g;
}

/** 활 — 테두리·갈비·뿔 */
export const arc = (r, t, span = Math.PI, seg = 14, sides = 6) =>
  new THREE.TorusGeometry(r, t, sides, seg, span);
