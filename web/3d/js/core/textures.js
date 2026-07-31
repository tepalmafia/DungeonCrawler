// 절차 생성 텍스처 — 외부 이미지 에셋 0. 전부 캔버스에 코드로 그린다.
//
// 규칙 (docs/ART-PLAN-v200.md §2-1 의 2D 결론을 3D에 그대로 적용):
//   바닥 = 큰 석판 / 벽 = 잔 벽돌  → 패턴 크기 대비로 벽·바닥이 즉시 구분된다.
//   타일마다 시드를 달리해 균열·이끼를 뿌려 반복이 눈에 띄지 않게 한다.

import * as THREE from 'three';
import { makeRng } from './rng.js';

const cache = new Map();

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function tex(c, { repeat = 1, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shade(hex, m) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(m);
  return '#' + c.getHexString();
}

/** 톤이 살짝씩 다른 얼룩 — 단색 면을 없앤다 */
function grain(ctx, size, rnd, amount, dark = true) {
  for (let i = 0; i < amount; i++) {
    const r = rnd.range(1, size * 0.06);
    ctx.globalAlpha = rnd.range(0.02, 0.09);
    ctx.fillStyle = dark ? '#000' : '#fff';
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** 균열 — 꺾인 선 몇 개. 바닥이 "낡았다"는 신호 */
function cracks(ctx, size, rnd, n, color = 'rgba(0,0,0,.5)') {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    let x = rnd() * size, y = rnd() * size;
    let a = rnd() * Math.PI * 2;
    ctx.lineWidth = rnd.range(0.8, 2.2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = rnd.int(3, 6);
    for (let s = 0; s < segs; s++) {
      a += rnd.range(-0.7, 0.7);
      x += Math.cos(a) * rnd.range(4, size * 0.09);
      y += Math.sin(a) * rnd.range(4, size * 0.09);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// ─────────────────────────── 바닥 ───────────────────────────
/** 어긋난 석판 + 줄눈 + 균열 + 이끼. 512px 안에 4x4 석판. */
export function floorTexture(theme, seed = 1) {
  const key = `floor:${theme.key}:${seed}`;
  if (cache.has(key)) return cache.get(key);

  const S = 512, N = 4, cell = S / N;
  const c = canvas(S), ctx = c.getContext('2d');
  const rnd = makeRng(`${theme.key}-floor-${seed}`);

  ctx.fillStyle = shade(theme.floor, 0.42);   // 줄눈(석판 사이 어둠)
  ctx.fillRect(0, 0, S, S);

  for (let gy = 0; gy < N; gy++) {
    // 행마다 반 칸씩 어긋나게 → 격자로 안 읽힌다
    const off = (gy % 2) * cell * 0.5;
    for (let gx = -1; gx <= N; gx++) {
      const x = gx * cell + off + rnd.range(-1.5, 1.5);
      const y = gy * cell + rnd.range(-1.5, 1.5);
      const w = cell - rnd.range(3, 7), h = cell - rnd.range(3, 7);

      const base = new THREE.Color(theme.floor).multiplyScalar(rnd.range(0.82, 1.16));
      ctx.fillStyle = '#' + base.getHexString();
      ctx.fillRect(x, y, w, h);

      // 석판 안쪽 명암 — 위 밝음 / 아래 그늘
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, 'rgba(255,255,255,.055)');
      g.addColorStop(0.55, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,.22)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);

      // 이끼 / 얼룩
      if (rnd.chance(theme.mossP)) {
        ctx.globalAlpha = rnd.range(0.07, 0.16);
        ctx.fillStyle = theme.moss;
        const mx = x + rnd() * w, my = y + rnd() * h;
        ctx.beginPath();
        ctx.ellipse(mx, my, rnd.range(4, 11), rnd.range(3, 8), rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  cracks(ctx, S, rnd, 7);
  grain(ctx, S, rnd, 200);

  const t = tex(c, { repeat: 1 });
  cache.set(key, t);
  return t;
}

// ─────────────────────────── 벽 ───────────────────────────
/** 잔 벽돌 — 바닥 석판보다 훨씬 촘촘하게. 256px 안에 8행. */
export function wallTexture(theme) {
  const key = `wall:${theme.key}`;
  if (cache.has(key)) return cache.get(key);

  const S = 256, ROWS = 8, bh = S / ROWS, bw = S / 5;
  const c = canvas(S), ctx = c.getContext('2d');
  const rnd = makeRng(`${theme.key}-wall`);

  ctx.fillStyle = shade(theme.wall, 0.34);
  ctx.fillRect(0, 0, S, S);

  for (let r = 0; r < ROWS; r++) {
    const off = (r % 2) * bw * 0.5;
    for (let i = -1; i <= 5; i++) {
      const x = i * bw + off + 1, y = r * bh + 1;
      const w = bw - 2.5, h = bh - 2.5;
      const base = new THREE.Color(theme.wall).multiplyScalar(rnd.range(0.74, 1.2));
      ctx.fillStyle = '#' + base.getHexString();
      ctx.fillRect(x, y, w, h);

      // 벽돌 윗변 하이라이트 + 아랫변 그림자 = 부조감
      ctx.fillStyle = 'rgba(255,255,255,.09)';
      ctx.fillRect(x, y, w, 1.5);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(x, y + h - 1.5, w, 1.5);

      if (rnd.chance(0.14)) {   // 깨진 벽돌
        ctx.fillStyle = 'rgba(0,0,0,.4)';
        ctx.fillRect(x + rnd() * w * 0.6, y + rnd() * h * 0.5, rnd.range(3, 9), rnd.range(2, 5));
      }
    }
  }
  grain(ctx, S, rnd, 160);
  cracks(ctx, S, rnd, 3, 'rgba(0,0,0,.35)');

  const t = tex(c, { repeat: 1 });
  cache.set(key, t);
  return t;
}

/** 벽 윗면 — 거칠고 밝다. 위에서 빛을 받는 면이라 지형 윤곽을 만든다. */
export function wallTopTexture(theme) {
  const key = `walltop:${theme.key}`;
  if (cache.has(key)) return cache.get(key);

  const S = 128;
  const c = canvas(S), ctx = c.getContext('2d');
  const rnd = makeRng(`${theme.key}-walltop`);

  ctx.fillStyle = shade(theme.wall, 1.15);
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 120; i++) {
    const g2 = new THREE.Color(theme.wall).multiplyScalar(rnd.range(0.8, 1.45));
    ctx.fillStyle = '#' + g2.getHexString();
    ctx.fillRect(rnd() * S, rnd() * S, rnd.range(3, 16), rnd.range(3, 16));
  }
  grain(ctx, S, rnd, 90);

  const t = tex(c, { repeat: 1 });
  cache.set(key, t);
  return t;
}

// ─────────────────────── 스프라이트류 ───────────────────────
/** 부드러운 원 — 파티클·광원 헤일로·발밑 그림자에 공통으로 쓴다 */
export function softDot(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const key = `dot:${inner}:${outer}`;
  if (cache.has(key)) return cache.get(key);
  const S = 64;
  const c = canvas(S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.45, inner.replace(/[\d.]+\)$/, '0.5)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** 횃불 불꽃 — 위로 갈수록 좁아지는 물방울 */
export function flameTexture() {
  if (cache.has('flame')) return cache.get('flame');
  const S = 64;
  const c = canvas(S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S * 0.62, 1, S / 2, S * 0.62, S * 0.42);
  g.addColorStop(0, 'rgba(255,250,220,1)');
  g.addColorStop(0.3, 'rgba(255,190,90,.95)');
  g.addColorStop(0.65, 'rgba(230,110,30,.55)');
  g.addColorStop(1, 'rgba(120,40,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(S / 2, 4);
  ctx.quadraticCurveTo(S * 0.92, S * 0.62, S / 2, S - 3);
  ctx.quadraticCurveTo(S * 0.08, S * 0.62, S / 2, 4);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set('flame', t);
  return t;
}

/** 아이템 광기둥 — 위로 갈수록 사라지는 세로 그라데이션 */
export function beamTexture() {
  if (cache.has('beam')) return cache.get('beam');
  const c = canvas(64), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 64, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,.85)');
  g.addColorStop(0.45, 'rgba(255,255,255,.28)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set('beam', t);
  return t;
}

/** 지면 예고 원 (보스/정예 텔레그래프) — 링 */
export function ringTexture(thickness = 0.12) {
  const key = `ring:${thickness}`;
  if (cache.has(key)) return cache.get(key);
  const S = 128, r = S / 2;
  const c = canvas(S), ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  ctx.lineWidth = S * thickness;
  ctx.beginPath();
  ctx.arc(r, r, r - ctx.lineWidth / 2 - 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(r, r, r - ctx.lineWidth - 1, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

export function disposeTextureCache() {
  for (const t of cache.values()) if (t.dispose) t.dispose();
  cache.clear();
}
