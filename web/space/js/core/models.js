// ══════════════════════════════════════════════════════════════════════════
//  ★★★ 3D 모델 로더 — **있으면 쓰고, 없으면 지금 그대로** (v85)
//
//  ★ 규격은 `core/model-table.js` 한 곳이다. 여기는 그것을 **읽어서
//    물리는 일**만 한다 — 숫자를 여기 다시 안 적는다.
//
//  ══ ★★★ 지켜야 할 두 가지 ═══════════════════════════════════════════
//
//   ① **없어도 게임이 돈다.** 파일이 하나도 없는 지금 상태가 기본이고,
//      떨어뜨린 것만 갈아 끼운다. 「에셋이 없으면 안 켜지는」 게임이
//      되면 사장님이 하나 뽑을 때마다 게임이 멈춘다
//
//   ② **조용히 실패하지 않는다.** 이 저장소가 제일 크게 데인 것이
//      「파일을 넣었는데 아무 일도 안 일어나고 오류도 안 난다」다
//      (`POSTMORTEM.md §1-⑤`). 그래서 **한 장마다 콘솔에 한 줄**을
//      남긴다 — 들어왔는지 · 왜 안 들어왔는지.
//      `SPACE.models` 로 밖에서도 읽을 수 있다
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SLOTS, RULES, LIMITS, MODEL_ROOT, pathOf, fitScale } from './model-table.js';

/** 들어온 것들 — key → { scene, long, tris, engine, mb } */
const LOADED = new Map();
/** 무슨 일이 있었나 — 검사와 콘솔이 읽는다 */
const LOG = [];

/** 제일 긴 변 (m) */
export function bboxLong(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const s = new THREE.Vector3();
  box.getSize(s);
  return Math.max(s.x, s.y, s.z);
}

/** 삼각형 수 — 한도를 넘었나 말해 주려고 센다 */
function trisOf(obj) {
  let n = 0;
  obj.traverse((o) => {
    const g = o.geometry;
    if (!g) return;
    n += g.index ? g.index.count / 3 : (g.attributes?.position?.count ?? 0) / 3;
  });
  return Math.round(n);
}

/**
 * ★★ **엔진 자리를 찾는다** — `engine` 이라는 이름의 노드.
 *   없으면 null 이고, 그때는 부르는 쪽이 꽁무니 한가운데에 붙인다
 */
function engineOf(obj) {
  let at = null;
  obj.traverse((o) => {
    if (at) return;
    const n = String(o.name ?? '').toLowerCase();
    if (n === RULES.engineNode || n.startsWith(`${RULES.engineNode}_`)) at = o;
  });
  if (!at) return null;
  const v = new THREE.Vector3();
  at.getWorldPosition(v);
  return v;
}

/**
 * ★★★ **다 불러온다.** 없는 것은 조용히 건너뛴다 (그게 기본 상태다).
 *
 * @returns Promise<로그 배열>
 */
export async function loadModels() {
  const loader = new GLTFLoader();
  const keys = Object.keys(SLOTS);
  await Promise.all(keys.map(async (key) => {
    const url = pathOf(key);
    // ★ 먼저 있나 본다. 없으면 GLTFLoader 가 콘솔에 빨간 줄을 뱉는데,
    //   **파일이 없는 것은 잘못이 아니라 기본 상태**라 빨갛게 두면 안 된다
    let head;
    try {
      head = await fetch(url, { method: 'HEAD' });
    } catch {
      LOG.push({ key, ok: false, why: '못 읽었습니다' });
      return;
    }
    if (!head.ok) { LOG.push({ key, ok: false, why: '없습니다 (코드 도형을 씁니다)' }); return; }
    const mb = +((+(head.headers.get('content-length') ?? 0)) / 1048576).toFixed(2);

    try {
      const gltf = await new Promise((res, rej) => loader.load(url, res, undefined, rej));
      const scene = gltf.scene ?? gltf.scenes?.[0];
      if (!scene) { LOG.push({ key, ok: false, why: '안이 비었습니다' }); return; }
      const long = bboxLong(scene);
      const tris = trisOf(scene);
      const engine = engineOf(scene);
      LOADED.set(key, { scene, long, tris, engine, mb });
      // ★★ **재서 말한다.** 한도를 넘어도 **막지 않는다** — 「무거워서
      //   안 쓴다」는 판정은 사장님 몫이고, 조용히 거절하면 「넣었는데
      //   안 나온다」가 된다
      const over = [];
      if (tris > LIMITS.tris) over.push(`삼각형 ${tris} (한도 ${LIMITS.tris})`);
      if (mb > LIMITS.mb) over.push(`${mb}MB (한도 ${LIMITS.mb}MB)`);
      LOG.push({
        key, ok: true, long: +long.toFixed(2), tris, mb,
        engine: !!engine,
        why: over.length ? `들어왔습니다 — 다만 ${over.join(' · ')}` : '들어왔습니다',
      });
    } catch (e) {
      LOG.push({ key, ok: false, why: `못 읽었습니다 — ${e?.message ?? e}` });
    }
  }));

  // ★ **한 줄씩 남긴다.** 「넣었는데 아무 일도 안 일어난다」를 없애는 것이
  //   이 계통의 절반이다
  const got = LOG.filter((l) => l.ok).length;
  console.log(`[모델] ${got}/${keys.length} — ${MODEL_ROOT}*.glb`);
  for (const l of LOG) {
    const tag = l.ok ? '✔' : '·';
    console.log(`  ${tag} ${l.key}${RULES.ext} — ${l.why}`
      + (l.ok ? ` · ${l.long}m · ${l.tris} 삼각형 · 엔진 자리 ${l.engine ? '있음' : '없음'}` : ''));
  }
  return LOG;
}

/**
 * ★★ **이 자리에 쓸 몸을 하나 준다** — 없으면 null (부르는 쪽이 코드 도형).
 *
 * @param base 부르는 쪽이 나중에 곱할 배수 (`KINDS.size * 1.6`).
 *   ★ 크기는 **표가 정한다** — 여기서 `long` 미터에 맞춰 놓되, 부르는 쪽이
 *     그 배수를 또 곱하므로 미리 나눠 둔다. 안 나누면 두 번 곱해진다
 */
export function modelFor(key, base = 1) {
  const m = LOADED.get(key);
  if (!m) return null;
  const g = new THREE.Group();
  g.name = `모델:${key}`;
  const body = m.scene.clone(true);
  const k = fitScale(key, m.long) / Math.max(1e-6, base);
  body.scale.setScalar(k);
  // ★ 원점을 **덩어리 한가운데**로 — 규약 ③ 을 안 지킨 파일도 돌게
  const box = new THREE.Box3().setFromObject(body);
  const c = new THREE.Vector3();
  box.getCenter(c);
  body.position.sub(c);
  g.add(body);
  return g;
}

/** 이 자리에 그림이 들어와 있나 */
export const hasModel = (key) => LOADED.has(key);

/**
 * ★ 엔진 자리 (모델 안 기준 · `modelFor` 가 준 그룹에 그대로 쓴다).
 *   없으면 null — 부르는 쪽이 꽁무니 한가운데에 붙인다
 */
export function engineAt(key, base = 1) {
  const m = LOADED.get(key);
  if (!m?.engine) return null;
  const k = fitScale(key, m.long) / Math.max(1e-6, base);
  return m.engine.clone().multiplyScalar(k);
}

/** 검사·점검 모드가 읽는다 */
export const modelLog = () => LOG.map((l) => ({ ...l }));
