// ══════════════════════════════════════════════════════════════════════════
//  그림 로더 — `assets/` 에 떨어뜨리면 게임에 나온다.
//
//  ★ 왜 목록 파일(index.json)을 먼저 읽는가
//    브라우저는 폴더를 못 훑는다. 파일마다 「있나?」를 물어보면 없는 것마다
//    404 가 콘솔을 빨갛게 덮고, **그 뒤에 진짜 오류가 숨는다.**
//    그래서 목록 하나만 읽고, 목록에 있는 것만 받는다.
//
//    로컬은 `tools/serve.py` 가 요청받을 때마다 폴더를 훑어 만들어 준다.
//    배포는 `node tools/assets.js space --write` 가 파일로 굳힌다.
//
//  ★ 조용히 실패하지 않는다
//    이름이 규격표에 없으면 **콘솔이 그 자리에서 말한다.** 크기가 규격과
//    다르면 그것도 말한다. 「넣었는데 아무 일도 안 일어난다」가 이 저장소에서
//    제일 비싸게 친 실수다 (docs/POSTMORTEM.md §1-⑤).
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { ASSET_ROOT, ASSETS, COMPANION } from './asset-table.js';

const loader = new THREE.TextureLoader();

/** 열쇠 → THREE.Texture. 없는 것은 아예 열쇠가 없다 (undefined 로 구분). */
export const TEX = {};

/** 몇 장 들어왔나 — 콘솔에 한 줄 찍으려고 센다. */
export let loaded = 0;

function apply(key, tex) {
  const spec = ASSETS[key];
  // ★ 색만 sRGB 다. 굴곡·거칠기는 **선형**으로 읽어야 한다.
  //   전부 sRGB 로 읽어도 오류가 안 나고 화면도 그럴싸하게 나온다 — 다만
  //   거칠기가 감마만큼 어긋나 전체가 미끈해진다. 원인을 화면만 보고는
  //   못 찾는 종류라 **표가 들고 있는 슬롯**으로 가른다 (asset-table.js).
  tex.colorSpace = (spec.slot && spec.slot !== 'map')
    ? THREE.NoColorSpace : THREE.SRGBColorSpace;
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
    const key = String(file).replace(/\.(png|jpg|jpeg|webp)$/i, '');
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

  // 곁그림은 따로 센다. 같이 세면 색을 다 넣고도 「12장 중 4장」이라 찍혀
  // **다 넣었는데 덜 넣은 것처럼 보인다.** 속이는 숫자는 안 보게 된다.
  const main = Object.keys(ASSETS).filter((k) => !COMPANION.has(k));
  const got = main.filter((k) => TEX[k]).length;
  const side = loaded - got;
  console.log(`[assets] ${got}/${main.length}장${side ? ` (+곁그림 ${side}장)` : ''}`
    + ` — ${loaded === 0 ? '아직 없습니다. 민무늬로 돕니다' : '적용'}`);
  return loaded;
}

/**
 * 있으면 그림을 붙이고 없으면 색만 쓴다.
 * **호출하는 쪽이 「있나?」를 묻지 않게** 하는 것이 이 함수의 전부다 —
 * 물어보게 하면 언젠가 한 군데를 빠뜨린다.
 */
export function surface(key, { color, repeat = [1, 1], ...rest } = {}) {
  const maps = pick(key, repeat);
  if (!maps.map) return new THREE.MeshStandardMaterial({ color, ...rest });
  // 곁그림(굴곡·거칠기)이 왔으면 같이 붙인다. 없으면 색 한 장으로 돈다 —
  // **부르는 쪽은 어느 쪽인지 몰라도 된다.** 물어보게 하면 한 군데를 빠뜨린다.
  return new THREE.MeshStandardMaterial({ ...maps, ...rest });
}

/**
 * 열쇠 하나에 딸린 그림 전부를 재질 인자 모양으로 모은다.
 * 반복(repeat)은 **네 장이 전부 같아야 한다** — 색만 4번 반복하고 굴곡은
 * 1번 반복하면 리벳 그림자가 리벳과 어긋나 붙는다. 눈에는 「왠지 지저분함」
 * 으로만 보이고 원인은 안 보이는 종류라, 한 함수에서 같이 건다.
 */
function pick(key, repeat) {
  const out = {};
  for (const [k, spec] of Object.entries(ASSETS)) {
    if (k !== key && spec.of !== key) continue;
    const tex = TEX[k];
    if (!tex) continue;
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(repeat[0], repeat[1]);
    out[spec.slot || 'map'] = t;
  }
  return out;
}
