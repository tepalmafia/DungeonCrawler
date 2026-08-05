// ══════════════════════════════════════════════════════════════════════════
//  손 — **1인칭 장갑 낀 두 손.**
//
//  ★ 이 파일은 이 저장소에서 제일 위험한 파일이다. 먼저 그걸 적어 둔다.
//
//    `CLAUDE.md` 와 `PLAN §12-1` 에 **「손 모양은 내가 안 만든다」**고
//    못박혀 있다. 앞 저장소에서 몸을 코드로 만드는 일을 **다섯 판** 태웠고,
//    다섯 판 내내 「그대로다」였다. 원인은 손이 아니라 **눈**이었다 —
//    내가 「좋아 보이는가」를 판정할 수 없다. 그래서 아무리 정교하게 만들어도
//    방향이 맞는지 모른다.
//
//    2026-08-04 사장님이 **직접 만들라고 지시하셔서** 만들었다. 그러니
//    이건 내가 「일단 만들어 볼까요」한 것이 아니다. 다만 위 문단이 사라지면
//    안 된다 — 다음에 내가 스스로 몸을 만들고 싶어질 때 읽을 글이다.
//
//  ★ 그래서 **갈아 끼우는 길을 먼저 뚫었다**
//    `assets/hand/open.png` 와 `hand/grip.png` 가 들어오면 도형을 **아예
//    안 만들고** 그림 두 장을 쓴다. 움직임·자리·잡는 규약은 그대로 남는다.
//
//    처음엔 주석에 「`hand.glb` 를 쓴다」고 적었는데 **GLTF 로더가 이
//    저장소에 안 들어와 있었다.** 있지도 않은 길을 적어 두는 것이 제일
//    나쁘다 — 그림을 넣어도 아무 일이 안 일어나고 오류도 안 난다
//    (POSTMORTEM §1-⑤). 그래서 이 저장소가 실제로 쓰는 그림 규약으로 고쳤다.
//
//    **오른손 한 벌만 그리면 된다.** 왼손은 좌우로 뒤집어 쓴다.
//
//  ★ 장갑으로 만든 이유 — **피부를 안 그린다**
//    맨손은 살결·손톱·주름이 있어야 사람 손으로 보이고, 그게 정확히 내가
//    판정 못 하는 것이다. **정비공의 작업 장갑**은 판과 이음매로 된 물건이라
//    「맞나 틀리나」로 판정된다 (PLAN §1 의 기하/그림 가름과 같다).
//    설정으로도 맞다 — 진공 밖으로 나가는 배의 정비공이다.
//
//  ★ 비율만은 숫자로 못박는다 — **다섯 판을 태운 것이 비율이었다**
//    1인칭 손은 **실물 크기로 만들면 안 된다.** 화면비·시야각 때문에 실제
//    비율대로 넣으면 「멀리 있는 작은 손」으로 보인다. 어느 게임이나 손을
//    1.2~1.5배로 키우고 카메라 가까이 붙인다. 그 숫자를 표에 적어 둔다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { HAND } from '../game/hand-table.js';
import { TEX } from '../core/assets.js';

const GLOVE = () => new THREE.MeshStandardMaterial({
  color: 0x3d4653, roughness: 0.82, metalness: 0.18,
});
const CUFF = () => new THREE.MeshStandardMaterial({
  color: 0x2a3038, roughness: 0.6, metalness: 0.55,
});
const PAD = () => new THREE.MeshStandardMaterial({
  color: 0x22272e, roughness: 0.95, metalness: 0.05,
});

function box(parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/**
 * 손가락 하나 — 마디 셋. **접히는 축이 밑동에 있어야** 주먹이 쥐어진다.
 * @returns { root, bend(t) }  t 0=편 손 1=쥔 주먹
 */
function finger(parent, len, thick, x, y, z, spread) {
  const root = new THREE.Group();
  root.position.set(x, y, z);
  root.rotation.y = spread;
  parent.add(root);

  const seg = [];
  let p = root;
  const L = [len * 0.44, len * 0.33, len * 0.23];
  for (let i = 0; i < 3; i++) {
    const j = new THREE.Group();
    j.position.z = i === 0 ? 0 : -L[i - 1];
    p.add(j);
    const t = thick * (1 - i * 0.13);
    box(j, t, t * 0.92, L[i], GLOVE(), 0, 0, -L[i] / 2);
    // 마디 위의 보호판 — 이게 있어야 「장갑」이고 없으면 소시지다
    box(j, t * 0.78, t * 0.22, L[i] * 0.66, PAD(), 0, t * 0.5, -L[i] / 2);
    seg.push(j);
    p = j;
  }
  return {
    root,
    bend(t) {
      // 밑동이 제일 많이, 끝이 제일 적게 — 실제 손이 그렇다
      seg[0].rotation.x = -t * 1.45;
      seg[1].rotation.x = -t * 1.25;
      seg[2].rotation.x = -t * 0.85;
    },
  };
}

/**
 * 손 하나.
 * @param side -1 왼손 · +1 오른손
 */
function oneHand(side) {
  const g = new THREE.Group();
  const S = HAND.scale;

  // 손등 — 납작한 상자. **두께가 얇아야** 손이지, 두꺼우면 벙어리장갑이다
  const pw = 0.085 * S, ph = 0.032 * S, pd = 0.095 * S;
  box(g, pw, ph, pd, GLOVE(), 0, 0, -pd / 2);
  box(g, pw * 0.86, ph * 0.35, pd * 0.8, PAD(), 0, ph * 0.5, -pd / 2);

  // 소매 — 손이 어디서 나왔는지 보여 준다. 없으면 잘린 손이 떠 있다.
  // ★ 처음엔 반지름을 `pw * 0.62` 로 뒀다. **손바닥 폭보다 굵은 소매**라
  //   화면 아래 절반이 커다란 통 두 개가 됐다 — 손목은 손바닥보다 가늘다
  const cuff = new THREE.Mesh(
    new THREE.CylinderGeometry(pw * 0.32, pw * 0.38, 0.075 * S, 10),
    CUFF(),
  );
  cuff.rotation.x = Math.PI / 2;
  // 소매는 **화면 밖으로 빠져야** 한다 — 보여야 할 것은 손등이지 소매가 아니다
  cuff.position.z = 0.062 * S;
  g.add(cuff);
  // 소매 끝 링 — 기압복의 잠금 링. 이 배의 다른 금속과 같은 문법이다
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(pw * 0.36, 0.006 * S, 6, 14), CUFF(),
  );
  ring.position.z = 0.096 * S;
  g.add(ring);

  // 손가락 넷 — 검지가 제일 길고 새끼가 제일 짧다
  const fs = [];
  const LEN = [0.070, 0.076, 0.070, 0.056].map((v) => v * S);
  for (let i = 0; i < 4; i++) {
    // 왼손·오른손은 **손가락 차례가 뒤집힌다**
    const ix = side > 0 ? i : 3 - i;
    const x = (-0.030 + ix * 0.020) * S;
    fs.push(finger(g, LEN[i], 0.019 * S, x, 0, -pd, (i - 1.5) * 0.05 * side));
  }
  // 엄지 — 옆에서 **가로로** 붙는다. 이거 하나로 손이 손처럼 보인다
  const th = finger(g, 0.058 * S, 0.022 * S, -side * pw * 0.52, -0.004 * S, -pd * 0.42, 0);
  th.root.rotation.set(0.2, side * 1.05, side * 0.35);

  return {
    group: g,
    /** @param t 0 편 손 · 1 쥔 손 */
    grip(t) {
      for (const f of fs) f.bend(t);
      th.bend(t * 0.8);
    },
    /**
     * **손가락을 따로 접는다** — 수리 네 동작이 여기를 쓴다
     * (game/repair-table.js). 「누르고 뽑고 당기고」가 같은 주먹이면
     * 그건 네 번 기다리는 것이지 손맛이 아니다.
     * @param p { fingers:[4], thumb }
     */
    pose(p) {
      for (let i = 0; i < fs.length; i++) fs[i].bend(p.fingers[i] ?? 0);
      th.bend(p.thumb ?? 0);
    },
  };
}

/**
 * 그림으로 만든 손 — **사장님이 주신 두 장.**
 *
 * 판 하나에 「편 손」을 깔고, 그 위에 「쥔 손」을 겹쳐 두고 **투명도를
 * 오간다.** 마디를 접는 것보다 훨씬 단순한데, 그림이 있으면 그게 맞다 —
 * 그림 두 장이 내가 만든 관절 열두 개보다 낫다.
 *
 * @param side -1 왼손 · +1 오른손. 왼손은 **좌우로 뒤집는다**
 */
function drawnHand(side, art) {
  const g = new THREE.Group();
  const S = HAND.scale, w = 0.20 * S, h = 0.20 * S;
  const quad = (tex, z) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    m.position.z = z;
    // 왼손은 뒤집는다 — 그래서 오른손 한 벌만 그리면 된다
    m.scale.x = side;
    g.add(m);
    return m;
  };
  const open = quad(art.open, 0);
  const grip = quad(art.grip, 0.001);
  grip.material.opacity = 0;
  return {
    group: g,
    grip(t) { open.material.opacity = 1 - t; grip.material.opacity = t; },
    // 그림 손은 마디가 없으므로 **손가락 평균만큼 쥔다.** 그림이 두
    // 장뿐이라 할 수 있는 것이 이것뿐이고, 그림이 늘면 여기가 늘어난다
    pose(p) {
      const t = (p.fingers.reduce((a, v) => a + v, 0) / 4) * 0.75 + (p.thumb ?? 0) * 0.25;
      open.material.opacity = 1 - t; grip.material.opacity = t;
    },
  };
}

/**
 * 두 손을 카메라에 매단다.
 *
 * @returns { group, update(s, dt) }
 *   s.reach  0~1  손잡이에 손을 뻗고 있나 (조준선이 잡았나)
 *   s.grip   0~1  잡고 있나
 *   s.shaky  굶어서 떨리나 (PLAN §5-2)
 *   s.both   양손을 쓰나 (조종간·밸브) — 아니면 오른손만 나간다
 *   s.pose   수리 네 동작의 손 모양 (game/repair-table.js poseAt). 없으면 보통 쥠
 */
export function buildHands(camera) {
  const g = new THREE.Group();
  g.name = '손';
  camera.add(g);

  // ★ 그림이 왔으면 **도형을 아예 안 만든다.** 「덧그리는」 게 아니라
  //   갈아 끼우는 것이다 — 도형이 뒤에 남아 있으면 그림 사이로 비친다
  const art = TEX['hand/open'] && TEX['hand/grip'] ? {
    open: TEX['hand/open'], grip: TEX['hand/grip'],
  } : null;
  const L = art ? drawnHand(-1, art) : oneHand(-1);
  const R = art ? drawnHand(1, art) : oneHand(1);
  g.add(L.group, R.group);

  let reach = 0, grip = 0, both = 0, sway = 0;
  // 수리 동작의 손목 돌림·밀기는 **이어서 따라간다.** 딱딱 끊기면
  // 손이 순간이동한다
  let roll = 0, push = 0;

  function update(s, dt = 0.016) {
    const k = (a, b, sp) => a + (b - a) * Math.min(1, dt * sp);
    reach = k(reach, s.reach ?? 0, HAND.reachSpeed);
    grip = k(grip, s.grip ?? 0, HAND.gripSpeed);
    both = k(both, s.both ? 1 : 0, 6);
    roll = k(roll, s.pose?.roll ?? 0, 10);
    push = k(push, s.pose?.push ?? 0, 10);
    sway += dt;

    // ★ 굶으면 **떨린다** — 「손이 곧 상태창」 (PLAN §5-2). 체력바를 안 만드는
    //   대신 이걸로 말한다. 이 한 줄이 그 설계가 처음으로 화면에 나온 것이다
    const shake = s.shaky ? HAND.shake : 0;
    const jx = shake * Math.sin(sway * 27.3), jy = shake * Math.sin(sway * 31.7);

    // 숨쉬기 — 가만히 있어도 아주 조금 움직인다. 이게 없으면 붙여 놓은 그림이다
    const br = Math.sin(sway * 1.6) * 0.004;

    for (const [h, side] of [[L, -1], [R, 1]]) {
      const out = side > 0 ? 1 : both;   // 왼손은 양손 작업일 때만 나간다
      const rest = HAND.rest, aim = HAND.aim;
      h.group.position.set(
        side * (rest.x + (aim.x - rest.x) * reach * out) + jx,
        rest.y + (aim.y - rest.y) * reach * out + br + jy,
        rest.z + (aim.z - rest.z) * reach * out,
      );
      h.group.rotation.set(
        rest.rx + (aim.rx - rest.rx) * reach * out,
        side * (rest.ry + (aim.ry - rest.ry) * reach * out),
        side * (rest.rz + (aim.rz - rest.rz) * reach * out),
      );
      // ★ 수리 중이면 **손 모양이 동작을 따라간다.** 아니면 보통 쥠
      if (s.pose && out > 0.5) h.pose({
        fingers: s.pose.fingers.map((v) => v * grip),
        thumb: s.pose.thumb * grip,
      });
      else h.grip(grip * out);
      // 손목을 돌리고 앞뒤로 민다 — 「돌리는 중」·「미는 중」이 눈에 보여야
      // 네 동작이 넷으로 읽힌다
      h.group.rotation.z += side * roll * out;
      h.group.position.z += push * out;
    }
  }
  update({}, 1);

  return {
    group: g,
    update,
    get at() { return { reach: +reach.toFixed(2), grip: +grip.toFixed(2), both: +both.toFixed(2),
      roll: +roll.toFixed(2), push: +push.toFixed(3) }; },
  };
}
