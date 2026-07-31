// 시야 차단 해소 — 카메라와 플레이어 사이에 낀 벽을 흐린다.
//
// 쿼터뷰의 고질적인 문제다. 벽 뒤로 들어가면 캐릭터가 통째로 가려 조작이 불가능해진다.
//
// 구현 메모:
//  · 벽은 InstancedMesh 라 인스턴스마다 투명도를 따로 줄 방법이 기본으로는 없다.
//    → InstancedBufferAttribute(aFade) 를 추가하고 셰이더를 패치한다.
//  · **알파 블렌딩 대신 디더 discard 를 쓴다.** transparent = true 로 바꾸면
//    벽끼리·소품과 정렬이 틀어져 더 큰 문제가 생긴다. 디더는 깊이 버퍼를 그대로
//    쓰므로 정렬 문제가 아예 없다.
//  · aFade 를 읽는 셰이더에 속성이 없는 지오메트리를 물리면 WebGL 이 0 을 주고
//    전부 discard 된다 — 같은 재질을 쓰는 **모든** 메시에 attachFade 를 해야 한다.

import * as THREE from 'three';

const FADE_MIN = 0.3;      // 가려질 때 남기는 정도 (0 이면 벽이 통째로 사라져 방향을 잃는다)
const FADE_SPEED = 9;       // 초당 보간 속도

/** 재질을 인스턴스별 페이드가 가능하게 만든다 (한 재질에 한 번만) */
export function makeFadeable(material) {
  if (material.userData.fadeable) return material;
  material.userData.fadeable = true;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aFade;
        varying float vFade;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vFade = aFade;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vFade;
        // 정렬 디더(Bayer 8x8) — 백색 잡음 디더는 지글거려서 눈에 거슬린다.
        float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
        float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
        float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        // 디더 discard — 알파 블렌딩이 아니라 픽셀을 솎아낸다.
        // 깊이 버퍼가 그대로라 벽끼리 정렬이 틀어지지 않는다.
        if (vFade < 0.995) {
          if (bayer8(gl_FragCoord.xy) > vFade) discard;
        }`);
  };
  material.needsUpdate = true;
  return material;
}

/** InstancedMesh 에 aFade 속성을 붙인다. 페이드를 안 쓸 메시도 반드시 붙여야 한다. */
export function attachFade(mesh) {
  const n = mesh.count;
  const arr = new Float32Array(n).fill(1);
  mesh.geometry.setAttribute('aFade', new THREE.InstancedBufferAttribute(arr, 1));
  mesh.userData.fade = arr;
  mesh.userData.fadeTarget = new Float32Array(n).fill(1);
  return mesh;
}

const _dir = new THREE.Vector3();

/**
 * 선분(카메라 → 목표)이 축 정렬 상자를 통과하는가. 슬랩 방식.
 * @param bx,bz 상자 중심 · hw 반너비 · y0,y1 높이 범위
 */
function segmentHitsBox(from, to, bx, y0, y1, bz, hw) {
  _dir.subVectors(to, from);
  const len = _dir.length();
  if (len < 1e-6) return false;
  _dir.divideScalar(len);

  let tmin = 0, tmax = len;
  const lo = [bx - hw, y0, bz - hw];
  const hi = [bx + hw, y1, bz + hw];
  const o = [from.x, from.y, from.z];
  const d = [_dir.x, _dir.y, _dir.z];

  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < lo[i] || o[i] > hi[i]) return false;
      continue;
    }
    let t1 = (lo[i] - o[i]) / d[i];
    let t2 = (hi[i] - o[i]) / d[i];
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return false;
  }
  return true;
}

/**
 * 카메라와 플레이어 사이를 막는 인스턴스를 찾아 페이드 목표를 갱신한다.
 * @param groups [{ mesh, cells:[{x,z,h}], hw }] — cells 는 인스턴스와 같은 순서
 */
export function updateOcclusion(groups, camera, playerPos, dt) {
  // 플레이어의 가슴 높이를 겨냥한다. 발밑을 쓰면 바로 앞 벽이 항상 걸린다.
  const target = new THREE.Vector3(playerPos.x, 1.1, playerPos.z);
  const cam = camera.position;

  for (const g of groups) {
    const { mesh, cells, hw } = g;
    if (!mesh || !mesh.userData.fade) continue;
    const fade = mesh.userData.fade, want = mesh.userData.fadeTarget;

    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      // 플레이어 근처만 검사한다 — 멀리 있는 벽은 어차피 화면 밖이다
      const near = Math.abs(c.x - playerPos.x) < 14 && Math.abs(c.z - playerPos.z) < 14;
      want[i] = near && segmentHitsBox(cam, target, c.x, c.y0 ?? 0, c.y1 ?? c.h, c.z, hw)
        ? FADE_MIN : 1;
    }

    let changed = false;
    const k = Math.min(1, dt * FADE_SPEED);
    for (let i = 0; i < fade.length; i++) {
      const d = want[i] - fade[i];
      if (Math.abs(d) < 0.002) {
        if (fade[i] !== want[i]) { fade[i] = want[i]; changed = true; }
        continue;
      }
      fade[i] += d * k;
      changed = true;
    }
    if (changed) mesh.geometry.attributes.aFade.needsUpdate = true;
  }
}
