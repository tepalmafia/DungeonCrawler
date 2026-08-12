// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **기체 도해 — 3D** (v116). `hull-table.js` 를 **읽어서 세우기만** 한다.
//
//  ★ 사장님 (2026-08-11) 「**너무 허접하잔아. 3d로 기체도 나오고 각 파츠의
//    역할도 나오고 상세하게 예쁘게 꾸며, 인터넷에서 비행선 데이터를
//    참고해서**」
//
//  ══ 여기가 하는 일과 안 하는 일 ═══════════════════════════════════════
//
//    **한다**    세우고 · 비추고 · 돌리고 · 고른 파츠를 빛낸다
//    **안 한다**  **자리를 정하지 않는다.** 그건 `hull-table.js` 가 한다
//
//  ★ 자리를 여기서 한 줄이라도 다시 적으면 그때부터 표와 갈라진다 —
//    이 저장소가 전투에서 그 병으로 네 판을 연달아 태웠다 (v91~v98).
//    그래서 이 파일에는 **미터 값이 하나도 없다.**
//
//  ══ ★★★ 왜 이것이 「그림」이 아니라 「도해」인가 ═══════════════════════
//
//  이 저장소의 절대 규칙은 **「그림은 사장님이 주신다」**이다 (다섯 판을
//  태우고 얻은 것). 그 규칙이 말하는 그림은 **캐릭터·몬스터·타일·아이콘** —
//  「좋아 보이나」를 내가 판정할 수 없는 것들이다.
//
//  ★ 이것은 **계기**다. 「어느 파츠가 배의 어디에 붙어 무엇을 하나」를
//    도형으로 말하는 것이고, 맞고 틀림이 **표와 대조해서 판정된다**
//    (`space-hull.js`). 조준경·레이더·수평의와 같은 자리다.
//
//  ══ 빛과 색 (v57 규약 그대로) ═════════════════════════════════════════
//
//  ★ `MeshStandardMaterial` 은 빛이 없으면 **까맣게** 나온다 — 이 저장소가
//    창밖에서 이미 겪었다. 도해는 어두운 창에 뜨므로 **스스로 빛나는
//    색**(`emissive`)을 준다. 그러면 조명 하나만으로도 형태가 읽힌다
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { HULL, SECTIONS, VIEW, SPIN } from '../game/hull-table.js';
import { TIER_BY } from '../game/parts-table.js';

/** 등급 색 — **표의 등급 이름만** 안다. 숫자는 표가 갖는다 */
const TIER_HUE = {
  stock: 0x6b7b8c, worn: 0x7e6a52, fine: 0x5fa9d6, rare: 0xa07bd6, ace: 0xe0a34a,
};
/** 파츠가 안 붙은 구조물 · 껍질 */
const BONE = 0x4a5866;
const GLOW = 0x8fe6c0;

/**
 * ★ **쐐기** — 창밖 실루엣·조준경 표식과 같은 모양이라 「저게 내 배구나」가
 *   한 번에 읽힌다. 앞이 뾰족하고 뒤가 넓다 (+z 가 앞)
 */
function wedge(w, h, d) {
  const g = new THREE.BufferGeometry();
  const x = w / 2; const y = h / 2; const z = d / 2;
  // 앞은 한 점에 가깝게 모으고 뒤는 네모 — 여덟 점짜리 사다리 기둥
  const n = 0.22;                       // 코의 남은 폭 비율
  const v = new Float32Array([
    // 뒤 네모 (z = −z)
    -x, -y, -z, x, -y, -z, x, y, -z, -x, y, -z,
    // 앞 (좁다)
    -x * n, -y * n, z, x * n, -y * n, z, x * n, y * n, z, -x * n, y * n, z,
  ]);
  const idx = [
    0, 1, 2, 0, 2, 3, // 뒤
    4, 6, 5, 4, 7, 6, // 앞
    0, 4, 5, 0, 5, 1, // 아래
    3, 2, 6, 3, 6, 7, // 위
    0, 3, 7, 0, 7, 4, // 왼
    1, 5, 6, 1, 6, 2, // 오른
  ];
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * ★★★ **도해 하나를 만든다.**
 *
 * @param canvas 그릴 곳
 * @returns { setTiers, highlight, spin, render, resize, dispose, pick }
 */
export function buildBay3D(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 200);

  // ── 빛 — 셋 (키·필·림) ────────────────────────────────
  //  ★ 실제 제품 사진의 세 점 조명 그대로다. 하나만 두면 반대쪽이
  //    통째로 까매져서 **덩어리 절반이 안 보인다**
  //  ★★★ 처음에 세기를 1.0/1.5/0.6/0.9 로 뒀다가 **화면을 찍어 보고** 올렸다 —
  //    거의 안 보이는 검은 덩어리였다. 도해는 어두운 창 위에 뜨므로
  //    창밖(우주)보다 훨씬 밝아야 형태가 읽힌다. 「두 번 올려도 안 바뀌면
  //    세기 문제가 아니라 코드가 안 도는 것」이라는 규약대로, **찍어서** 정했다
  scene.add(new THREE.AmbientLight(0x8098b0, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 3.0); key.position.set(4, 7, 6); scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fc8e6, 1.4); fill.position.set(-6, 2, 3); scene.add(fill);
  const rim = new THREE.DirectionalLight(0x8fe6c0, 1.8); rim.position.set(-2, 3, -8); scene.add(rim);

  const root = new THREE.Group();
  scene.add(root);

  /** 덩어리마다 메시 하나 — `hull-table.js` 순서 그대로 */
  const parts = [];
  for (const s of SECTIONS) {
    const [w, h, d] = s.size;
    let geo;
    if (s.kind === 'wedge') geo = wedge(w, h, d);
    // ★★ 껍질도 **쐐기**다 (찍어 보고 고쳤다). 네모 상자로 두니 배가 아니라
    //   **궤짝**으로 읽혔다 — 창밖 실루엣도 조준경 표식도 쐐기인데 도해만
    //   상자면 「저게 내 배구나」가 안 된다
    else if (s.kind === 'shell') geo = wedge(w * 0.98, h * 0.98, d * 0.98);
    else geo = new THREE.BoxGeometry(w, h, d);
    const shell = s.kind === 'shell';
    const mat = new THREE.MeshStandardMaterial({
      color: BONE,
      // ★ 어두운 창에 뜨므로 **스스로 빛난다** — 안 그러면 까만 덩어리다
      emissive: BONE, emissiveIntensity: 0.45,
      metalness: 0.35, roughness: 0.55,
      transparent: shell, opacity: shell ? 0.13 : 1,
      // ★★ 껍질은 **안쪽에서 보이게** 뒤집는다 — 그래야 속의 덩어리가 안 가려진다
      side: shell ? THREE.BackSide : THREE.FrontSide,
      depthWrite: !shell,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...s.at);
    m.userData.sec = s;
    root.add(m);
    // ── 테두리 — 도해는 **선이 있어야 읽힌다** ─────────────
    if (!shell) {
      const line = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo, 25),
        new THREE.LineBasicMaterial({ color: 0x9fb4c6, transparent: true, opacity: 0.55 }),
      );
      m.add(line);
      m.userData.line = line;
    }
    parts.push(m);
  }

  // ── 척추선 — 앞뒤를 한눈에 ──────────────────────────────
  {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, -HULL.len / 2), new THREE.Vector3(0, 0, HULL.len / 2 + 1.4),
    ]);
    root.add(new THREE.Line(g, new THREE.LineBasicMaterial({
      color: GLOW, transparent: true, opacity: 0.30,
    })));
  }

  // ★ 껍질 테두리는 **따로 그린다** — 속이 비치는 판은 선이 없으면
  //   어디까지가 배인지 모른다
  {
    const sh = parts.find((m) => m.userData.sec.kind === 'shell');
    if (sh) {
      const line = new THREE.LineSegments(
        new THREE.EdgesGeometry(sh.geometry, 20),
        new THREE.LineBasicMaterial({ color: GLOW, transparent: true, opacity: 0.34 }),
      );
      sh.add(line);
    }
  }

  let yaw = (VIEW.yaw * Math.PI) / 180;
  let pitch = (VIEW.pitch * Math.PI) / 180;
  let lit = null;                          // 지금 빛나는 슬롯
  let t = 0;

  function place() {
    const d = VIEW.dist;
    camera.position.set(
      Math.sin(yaw) * Math.cos(pitch) * d,
      Math.sin(pitch) * d,
      Math.cos(yaw) * Math.cos(pitch) * d,
    );
    camera.lookAt(0, 0, 0);
  }
  place();

  return {
    /** 등급을 입힌다 — `{slot: tierKey}` */
    setTiers(tiers = {}) {
      for (const m of parts) {
        const s = m.userData.sec;
        if (!s.slot) continue;
        const tk = tiers[s.slot];
        const c = TIER_HUE[tk] ?? BONE;
        m.material.color.setHex(c);
        m.material.emissive.setHex(c);
        // ★ 좋은 등급일수록 **더 빛난다** — 표의 순서를 그대로 읽는다
        const i = Math.max(0, Object.keys(TIER_HUE).indexOf(tk));
        m.material.emissiveIntensity = 0.40 + i * 0.09;
      }
    },
    /** ★★ 이 슬롯을 **빛낸다** — 줄에 손을 얹으면 몸이 어디인지 보인다 */
    highlight(slot) {
      lit = slot;
      for (const m of parts) {
        const s = m.userData.sec;
        const on = !!slot && s.slot === slot;
        const dim = !!slot && s.slot !== slot;
        if (m.userData.line) m.userData.line.material.opacity = on ? 1 : (dim ? 0.16 : 0.55);
        if (s.kind !== 'shell') m.material.opacity = dim ? 0.5 : 1;
        m.material.transparent = s.kind === 'shell' || dim;
      }
    },
    /** 손으로 돌린다 (라디안 증분) */
    spin(dx, dy) {
      yaw -= dx * SPIN.rate;
      const lo = (SPIN.pitchMin * Math.PI) / 180; const hi = (SPIN.pitchMax * Math.PI) / 180;
      pitch = Math.max(lo, Math.min(hi, pitch + dy * SPIN.rate));
      place();
    },
    /** 한 프레임 — 가만히 두면 **천천히 돈다** (도해가 살아 있다는 표시) */
    render(dt = 0.016, idle = true) {
      if (idle) { yaw += dt * 0.16; place(); }
      t += dt;
      // ★ 빛나는 덩어리는 **숨 쉰다** — 어느 것이 골라졌는지 눈이 안 놓친다
      if (lit) {
        const k = 0.55 + 0.45 * Math.sin(t * 3.4);
        for (const m of parts) {
          if (m.userData.sec.slot === lit) m.material.emissiveIntensity = 0.25 + 0.5 * k;
        }
      }
      renderer.render(scene, camera);
    },
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    },
    /** 검사가 읽는다 — **자리를 여기서 다시 세지 않는다는 것**을 보인다 */
    info() {
      return parts.map((m) => ({
        key: m.userData.sec.key, slot: m.userData.sec.slot,
        at: m.position.toArray().map((v) => +v.toFixed(2)),
        lit: m.userData.sec.slot === lit,
      }));
    },
    dispose() {
      for (const m of parts) { m.geometry.dispose(); m.material.dispose(); }
      renderer.dispose();
    },
  };
}
