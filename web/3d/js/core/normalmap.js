// 높이맵 → 노멀맵 (B안 전용).
//
// 외부 에셋 0 원칙을 지키면서 「표면이 있다」는 인상을 만드는 유일한 방법이다.
// 캔버스에 요철을 회색조로 그린 뒤 기울기를 재서 노멀 벡터로 바꾼다.
// 노멀맵은 색이 아니라 방향 데이터이므로 **sRGB 변환을 걸면 안 된다**.

import * as THREE from 'three';

/** 회색조 높이 캔버스 → 노멀 캔버스 (Sobel 근사) */
export function normalFromHeight(heightCanvas, strength = 2.2) {
  const S = heightCanvas.width;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, S, S).data;
  const out = document.createElement('canvas');
  out.width = out.height = S;
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(S, S);
  // 타일링되므로 가장자리는 반대편으로 감는다 — 안 그러면 이음매에 선이 생긴다
  const h = (x, y) => src[((((y + S) % S) * S + ((x + S) % S)) * 4)] / 255;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (h(x - 1, y) - h(x + 1, y)) * strength;
      const dy = (h(x, y - 1) - h(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * S + x) * 4;
      img.data[i] = ((dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/** 노멀맵 텍스처 — 색공간 변환을 걸지 않는다 */
export function normalTexture(heightCanvas, { repeat = 1, strength = 2.2 } = {}) {
  const t = new THREE.CanvasTexture(normalFromHeight(heightCanvas, strength));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

/** 거칠기맵 — 흰색=거침, 검정=매끈(젖은 곳). 역시 색이 아니라 데이터다. */
export function dataTexture(canvas, { repeat = 1 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

/** 회색조 캔버스를 만들어 그리기 콜백에 넘긴다 */
export function grayCanvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  draw(ctx, size);
  return c;
}
