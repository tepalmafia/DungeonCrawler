// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **항로 문 — 목적지까지 길이 보인다** (v121). 창밖에 그린다.
//
//  ★ 사장님 (2026-08-12) 「**네비게이션을 만들고 항로가 목적지까지 희미하게
//    표시 되도록 해서 내가 목적지로 향하고 있다는 것을 시각적으로 표시**」
//
//  ══ ★★★ 여기는 **그리기만** 한다 ═════════════════════════════════════
//
//  문이 어디에 몇 개 있는지 · 얼마나 진한지는 `game/nav-table.js gatesOf`
//  가 정하고, 자리를 좌표로 옮기는 것은 `game/frame.js pointOf` 가 한다.
//  둘 다 three 를 안 쓰므로 `tools/space-nav.js` 가 브라우저 없이 잰다.
//
//  ★ **이 파일이 각을 다시 세지 않는다.** 세기 시작하면 「마름모는 저기인데
//    길은 이리로」가 나고, 그게 이 저장소가 v91~v98 네 판을 태운 병이다.
//
//  ══ ★★ 왜 고리인가 (선이 아니라) ═════════════════════════════════════
//
//  배에서 목적지로 잇는 **곧은 선은 눈과 한 줄로 서 있어서 화면에서 점이
//  된다** — `space-nav.js` 가 그것을 0.000도로 찍는다. 그래서 굵기를 가진
//  것을 거리마다 놓는다. 세상 크기가 같으니 가까운 것이 크고 먼 것이 작아,
//  겹쳐 보이는 동심원이 곧 **터널**이 된다. 실기의 HITS 와 같은 이유·같은 꼴.
//
//  ★ 선(`LineLoop`)으로 그린다. 굵기가 늘 1화소라 **저절로 희미하고**,
//    면이 없으므로 뒤의 별과 적을 안 가린다 — 사장님 「희미하게」의 답이다
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { pointOf } from '../game/frame.js';
import { HITS } from '../game/nav-table.js';

/** 매 프레임 새로 만들면 쓰레기가 쌓인다 — 하나씩 두고 돌려 쓴다 */
const DIR = new THREE.Vector3();
const FWD = new THREE.Vector3(0, 0, 1);

/** 항로 상태마다 색 — 조준경의 항로점과 **같은 말**을 쓴다 (`navState`) */
const TONE = {
  on: 0x8fe6c0,      // 항로 위 — 조준경 초록
  drift: 0xffcf6a,   // 틀어졌다 — 노랑
  off: 0xff9a5c,     // 벗어났다 — 주황
};

/** 고리 하나 — 원 + 사방 네 눈금 (원만 그리면 「거품」으로 읽힌다) */
function ringGeo(seg = 48) {
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push(Math.cos(a), Math.sin(a), 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

/** 사방 눈금 — 안쪽으로 짧게 뻗는 네 토막. 「문」으로 읽히게 한다 */
function tickGeo() {
  const pts = [];
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const c = Math.cos(a), s = Math.sin(a);
    pts.push(c, s, 0, c * 0.78, s * 0.78, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

/**
 * ★★ **길을 세운다** — `parent` 는 창밖 그룹이다.
 *   ★ 원점을 눈에 붙이는 것은 부르는 쪽이 한다 (`cockpit.js` 의 `EYEG`) —
 *     안 붙이면 배가 돌 때 8.5m 짜리 팔이 휘둘린다 (v93·v98 이 그 병이었다)
 */
export function buildRoad(parent) {
  const group = new THREE.Group();
  group.name = '항로문';
  parent.add(group);

  const rg = ringGeo(), tg = tickGeo();
  /** 문 다섯을 **미리** 만들어 두고 자리만 옮긴다 — 매 프레임 만들면 깜빡인다 */
  const gates = [];
  for (let i = 0; i < HITS.gates; i++) {
    const o = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({
      color: TONE.on, transparent: true, opacity: 0, depthWrite: false,
    });
    const ring = new THREE.LineLoop(rg, mat);
    const tick = new THREE.LineSegments(tg, mat);
    o.add(ring, tick);
    o.visible = false;
    group.add(o);
    gates.push({ o, mat });
  }

  return {
    group,
    /**
     * ★★★ **한 프레임** — 표가 준 문 목록을 그대로 놓는다.
     * @param list `nav-table.js gatesOf(...)` 가 준 것 (없으면 빈 배열 → 다 끈다)
     */
    update(list) {
      for (let k = 0; k < gates.length; k++) {
        // ★ 이름표(`g.i`)로 찾지 않고 **차례대로** 쓴다. 목록은 이미 가까운
        //   것부터 정렬돼 있고, 물체는 어차피 다 같이 생겼다 — 이름표는
        //   검사가 「같은 문이 다가오나」를 물으려고 있는 것이다
        const g = list[k];
        const it = gates[k];
        if (!g) { it.o.visible = false; continue; }
        const p = pointOf(g);
        it.o.visible = true;
        it.o.position.set(p.x, p.y, p.z);
        it.o.scale.setScalar(g.r);
        // ══ ★★★ **`lookAt(0,0,0)` 을 쓰면 안 된다** ═══════════════════
        //
        //  ★ 처음에 그렇게 썼다. `Object3D.lookAt` 은 인자를 **세상 좌표**로
        //    읽는데, 이 그룹은 배를 따라 돌고 원점이 **눈**에 붙어 있다
        //    (`cockpit.js` 의 `EYEG`). 즉 세상 원점은 눈이 아니라 **엉뚱한
        //    곳**이고, 고리들이 제각기 다른 쪽을 보고 있었다.
        //  ★★ 화면에서는 **그럴듯해 보였다** — 기울어진 원은 그냥 타원이라
        //    「원근이 이런가 보다」로 읽힌다. 3D 는 틀려도 그럴듯해 보인다는
        //    `CLAUDE.md` 의 그 말이 이 자리다.
        //  ★★★ 그래서 **각을 세상에 안 묻고** 이 그룹 안에서 푼다: 고리의
        //    법선(+z)을 문이 놓인 방향에 맞춘다. 길과 직각이라야 「지나가는
        //    문」으로 읽힌다
        DIR.set(p.x, p.y, p.z).normalize();
        it.o.quaternion.setFromUnitVectors(FWD, DIR);
        it.mat.opacity = g.alpha;
        it.mat.color.setHex(TONE[g.state] ?? TONE.on);
      }
    },
    // ★ `clear()` 를 따로 안 둔다 — 갈 곳이 없으면 `update([])` 가 다 끈다.
    //   끄는 길을 둘로 만들면 한쪽만 부르는 자리가 반드시 생긴다
  };
}
