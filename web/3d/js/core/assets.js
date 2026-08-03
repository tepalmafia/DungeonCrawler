// ══════════════════════════════════════════════════════════════════════════
//  그림 통로 — `web/3d/assets/` 에 파일을 떨어뜨리면 게임이 그걸 쓴다.
//
//  ★ 왜 이걸 게임 로직보다 먼저 만드나 (docs/POSTMORTEM.md §2 0단계)
//    통로가 없어서, 그림이 없는 동안 내가 코드로 그림을 만들었고 그게 전부
//    버려졌다. 통로가 있었으면 나는 시스템만 만들고 기다렸을 것이다.
//
//  ★ 왜 404 로 더듬지 않고 목록을 읽나
//    「있는지 없는지」를 파일마다 요청해서 알아내면 콘솔에 빨간 404 가
//    일흔 줄 쌓인다. 그 벽 뒤에 진짜 오류가 숨는다 — 이번에 하루를 태운 게
//    정확히 그 종류다 (POSTMORTEM §1-⑤ 「조용히 실패하는 것들」).
//    그래서 `assets/index.json` 하나만 읽는다. 없으면 요청 한 번으로 끝나고
//    전부 코드 그림으로 돌아간다.
//
//    목록은 손으로 안 적는다:
//      · 로컬 — `tools/serve.py` 가 요청받을 때마다 폴더를 훑어 만들어 준다
//        (파일을 넣고 새로고침하면 바로 나온다)
//      · 배포 — `node tools/assets.js` 가 만들어 커밋한다
//
//  ★ 이름이 틀리면 **시끄럽게 알린다**
//    규격에 없는 이름이 들어오면 콘솔에 경고를 찍는다. 조용히 무시하면
//    「넣었는데 안 나온다」가 되고, 그건 원인을 찾는 데 하루가 걸린다.
// ══════════════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { ASSET_ROOT, ASSET_SPEC, ICON_BY_GLYPH, ICON_BY_NODE, assetPath, REQUIRED_IDS } from './asset-table.js';

const images = new Map();     // id → HTMLImageElement
const texCache = new Map();   // 열쇠 → THREE.Texture / canvas
let report = { ready: false, found: [], missing: [], unknown: [], bad: [] };

/** 크기가 규격과 맞나. 정확한 픽셀이 아니라 **비율**을 본다 — 512x870 을
 *  1024x1740 으로 주셔도 게임은 잘 돌아간다. 늘어나는 것만 잡으면 된다. */
function checkSize(id, img) {
  const s = ASSET_SPEC[id];
  const want = s.w / s.h, got = img.naturalWidth / img.naturalHeight;
  if (Math.abs(got - want) / want > 0.02) {
    return `${id} — 비율이 다릅니다. 규격 ${s.w}x${s.h} (${want.toFixed(2)}), 받은 것 `
      + `${img.naturalWidth}x${img.naturalHeight} (${got.toFixed(2)}). 화면에서 늘어납니다`;
  }
  return null;
}

function loadImage(url) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
}

/**
 * 부팅 때 한 번. **끝나기 전에는 텍스처를 만들면 안 된다** —
 * 만들어 버리면 코드 그림이 캐시에 박혀서 파일을 넣어도 안 바뀐다.
 */
export async function preloadAssets() {
  let list = [];
  try {
    const r = await fetch(`${ASSET_ROOT}index.json`, { cache: 'no-store' });
    if (r.ok) list = await r.json();
  } catch { /* 목록이 없으면 전부 코드 그림 — 정상 경로다 */ }
  if (!Array.isArray(list)) list = [];

  const found = [], unknown = [], bad = [];
  await Promise.all(list.map(async (file) => {
    const id = String(file).replace(/\.png$/i, '');
    if (!ASSET_SPEC[id]) { unknown.push(file); return; }
    const img = await loadImage(`${ASSET_ROOT}${id}.png`);
    if (!img) { bad.push(`${id} — 파일을 못 읽었습니다 (깨졌거나 PNG 가 아닙니다)`); return; }
    const why = checkSize(id, img);
    if (why) bad.push(why);
    images.set(id, img);
    found.push(id);
  }));

  report = {
    ready: true,
    found: found.sort(),
    missing: REQUIRED_IDS.filter((id) => !images.has(id)),
    unknown, bad,
  };

  // 한 줄 보고 — 「넣었는데 안 나온다」를 여기서 끊는다
  console.info(`[에셋] ${found.length} / ${REQUIRED_IDS.length}장 적용 · 나머지는 코드 그림`);
  for (const u of unknown)
    console.warn(`[에셋] 규격에 없는 이름입니다 — ${u} (core/asset-table.js 의 이름과 맞춰 주세요)`);
  for (const b of bad) console.warn(`[에셋] ${b}`);
  return report;
}

/** 지금 상태 — `window.G3.assets()` 로 확인한다 */
export function assetReport() { return report; }

export function hasAsset(id) { return images.has(id); }
export function assetImage(id) { return images.get(id) || null; }

/** 파일이 있으면 텍스처, 없으면 null (부르는 쪽이 코드 그림으로 넘어간다) */
export function assetTexture(id, { repeat = 1, srgb = true } = {}) {
  const img = images.get(id);
  if (!img) return null;
  const key = `t:${id}:${repeat}:${srgb}`;
  if (texCache.has(key)) return texCache.get(key);
  const t = new THREE.Texture(img);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  texCache.set(key, t);
  return t;
}

/**
 * 흰 그림에 색을 입혀 텍스처로. `softDot` 처럼 **부르는 쪽이 색을 정하는**
 * 자리에 쓴다 — 발밑 그림자는 검정이고 출구 광채는 하늘색인데, 흰 그림을
 * 그대로 쓰면 발밑 그림자가 하얗게 빛난다.
 * (알파는 그림 것을 그대로 두고 RGB 만 갈아 끼운다 = `source-in`)
 */
export function tintedAssetTexture(id, css) {
  const img = images.get(id);
  if (!img) return null;
  const key = `tint:${id}:${css}`;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

/**
 * 높이맵용 — 캔버스로 돌려준다.
 * `core/normalmap.js` 가 픽셀을 직접 읽어야 해서 이미지로는 안 된다.
 */
export function assetCanvas(id) {
  const img = images.get(id);
  if (!img) return null;
  const key = `c:${id}`;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext('2d').drawImage(img, 0, 0);
  texCache.set(key, c);
  return c;
}

/**
 * UI 아이콘 — 그림이 있으면 `<img>`, 없으면 이모지 글자 그대로.
 *
 * 부르는 쪽은 지금까지처럼 이모지를 넘기면 된다 (`item-table.js` 를 안 건드린다).
 * @param glyph 지금 쓰고 있는 이모지
 * @param node  스킬트리처럼 칸 id 로 찾는 경우
 */
export function iconHTML(glyph, node = null) {
  const id = node ? ICON_BY_NODE[node] : ICON_BY_GLYPH[glyph];
  if (id && images.has(id)) return `<img class="ico" src="${assetPath(id)}" alt="">`;
  return glyph ?? '';
}

export function disposeAssetCache() {
  for (const v of texCache.values()) if (v?.dispose) v.dispose();
  texCache.clear();
}
