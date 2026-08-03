// ══════════════════════════════════════════════════════════════════════════
//  그림 로더 — `assets/` 에 떨어뜨리면 게임에 나온다.
//
//  ★ 왜 목록 파일(index.json)을 먼저 읽는가
//    브라우저는 폴더를 못 훑는다. 파일마다 「있나?」를 물어보면 없는 것마다
//    404 가 콘솔을 빨갛게 덮고, **그 뒤에 진짜 오류가 숨는다.**
//    그래서 목록 하나만 읽고, 목록에 있는 것만 받는다.
//
//    로컬은 `tools/serve.py` 가 요청받을 때마다 폴더를 훑어 만들어 준다.
//    배포는 `node tools/assets.js --write` 가 파일로 굳힌다.
//
//  ★ 조용히 실패하지 않는다
//    이름이 규격표에 없으면 **콘솔이 그 자리에서 말한다.** 크기가 규격과
//    다르면 그것도 말한다. 「넣었는데 아무 일도 안 일어난다」가 이 저장소에서
//    제일 비싸게 친 실수다 (docs/POSTMORTEM.md §1-⑤).
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { ASSET_ROOT, ASSETS } from './asset-table.js';

const loader = new THREE.TextureLoader();

/** 열쇠 → THREE.Texture. 없는 것은 아예 열쇠가 없다 (undefined 로 구분). */
export const TEX = {};

/** 몇 장 들어왔나 — 콘솔에 한 줄 찍으려고 센다. */
export let loaded = 0;

function apply(key, tex) {
  const spec = ASSETS[key];
  tex.colorSpace = THREE.SRGBColorSpace;
  if (spec.tile) {
    tex.wrapS = spec.tile.includes('x') ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = spec.tile.includes('y') ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  }
  tex.anisotropy = 4;
  // 규격과 다르면 말한다. 게임은 그래도 돈다 — 늘어난 채로 보이는 게
  // 아무 일도 안 일어나는 것보다 낫다. 눈에 보여야 고친다.
  const { width: w, height: h } = tex.image;
  if (spec.w && (w !== spec.w || h !== spec.h)) {
    console.warn(`[assets] ${key} 크기가 규격과 다릅니다 — 넣은 것 ${w}x${h}, 규격 ${spec.w}x${spec.h}`);
  }
  TEX[key] = tex;
  loaded++;
}

/**
 * 목록을 읽고 있는 것만 받는다.
 * **하나도 없어도 정상으로 끝난다** — 게임은 민무늬로 돈다.
 */
export async function preload() {
  let list = [];
  try {
    const res = await fetch(`${ASSET_ROOT}index.json`, { cache: 'no-store' });
    if (res.ok) list = await res.json();
  } catch {
    // 목록이 없는 것은 오류가 아니다. 아직 그림이 한 장도 없는 상태다.
  }

  const jobs = [];
  for (const file of list) {
    const key = String(file).replace(/\.(png|jpg|webp)$/i, '');
    if (!ASSETS[key]) {
      console.warn(`[assets] 규격표에 없는 이름입니다 — ${file} (게임이 안 읽습니다)`);
      continue;
    }
    jobs.push(new Promise((done) => {
      loader.load(
        `${ASSET_ROOT}${file}`,
        (t) => { apply(key, t); done(); },
        undefined,
        () => { console.warn(`[assets] 못 읽었습니다 — ${file}`); done(); },
      );
    }));
  }
  await Promise.all(jobs);

  const total = Object.keys(ASSETS).length;
  console.log(`[assets] ${loaded}/${total}장 — ${loaded === 0 ? '아직 없습니다. 민무늬로 돕니다' : '적용'}`);
  return loaded;
}

/**
 * 있으면 그림을 붙이고 없으면 색만 쓴다.
 * **호출하는 쪽이 「있나?」를 묻지 않게** 하는 것이 이 함수의 전부다 —
 * 물어보게 하면 언젠가 한 군데를 빠뜨린다.
 */
export function surface(key, { color, repeat = [1, 1], ...rest } = {}) {
  const tex = TEX[key];
  if (tex) {
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(repeat[0], repeat[1]);
    return new THREE.MeshStandardMaterial({ map: t, ...rest });
  }
  return new THREE.MeshStandardMaterial({ color, ...rest });
}
