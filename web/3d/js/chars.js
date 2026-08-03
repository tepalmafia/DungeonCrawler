// 캐릭터·몬스터 디자인 시제품 — **같은 골격, 같은 자세, 다른 몸.**
//
// gfx.html 이 「방」으로 물어본 것을 여기서는 「몸」으로 물어본다.
// 위줄은 지금 게임의 몸(core/models.js), 아래줄은 제안본(core/models-hd.js).
//
// 비교가 성립하려면 **바뀌지 않은 것을 못 박아 둬야** 한다:
//
//   · 골격 18 관절 — 그대로. 동작 코드는 한 줄도 안 바뀐다
//   · 자세 — 위아래가 같다. 같은 pose() 를 두 번 부른다
//   · 카메라 — 위아래가 같다. 지금 몸의 크기로 잡아서 둘 다에 쓴다
//
// 바뀐 것은 셋이고, 캡션에 그대로 적는다: **재질 · 형태 · 조명+후처리.**
// 셋을 한 컷에 섞어 놓고 「좋아졌다」고 하면 무엇이 기여했는지 모른다 —
// 그래서 아래줄 캡션에 셋을 나눠 적었다.

import * as THREE from 'three';
import { buildKnight, buildSkeleton, buildGhoul, buildArcher, buildGolem } from './core/models.js';
import {
  buildKnightHD, buildSkeletonHD, buildGhoulHD, buildArcherHD, buildGolemHD,
} from './core/models-hd.js';
import { attachWeapon } from './core/weapons.js';
import { surface, glowDisc, tickSurfaces } from './core/surface.js';

const COLS = 5;
const CW = 320, CH = 470;
const W = CW * COLS, H = CH * 2;

const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('c') });
renderer.setSize(W, H);
renderer.setScissorTest(true);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

// ───────────────────────── 자세 ─────────────────────────
//
// **정지 컷은 자세가 절반이다.** 차렷 자세로 세워 두면 아무리 잘 만들어도
// 마네킹이다. 무게가 한쪽 다리에 실리고 어깨가 기울어야 살아 있어 보인다.
//
// 각 종족의 「그 몬스터다」 싶은 순간을 하나씩 고른다:
//   기사 — 검을 세우고 방패를 올린 겨눔
//   해골 — 어깨를 앞으로 말고 검을 늘어뜨린 배회
//   구울 — 앞발을 들고 덮치기 직전
//   망령 — 시위를 당긴 정점
//   골렘 — 주먹을 쥐고 내려다보는 정지
const POSES = {
  knight: {
    spine: [0, 0.14, 0], chest: [-0.05, -0.08, 0.03], head: [0.05, 0.16, 0],
    armR: [-0.55, 0, -0.30], foreR: [-1.05, 0, -0.12], handR: [0.15, 0, 0],
    armL: [-0.42, 0.25, 0.22], foreL: [-1.45, 0, 0],
    thighL: [-0.16, 0, 0.04], shinL: [0.10, 0, 0],
    thighR: [0.22, 0, -0.05], shinR: [-0.30, 0, 0], footR: [0.14, 0, 0],
  },
  skeleton: {
    spine: [0.14, -0.10, 0], chest: [0.10, 0.06, -0.05], head: [-0.14, -0.18, 0.08],
    armR: [-0.28, 0, -0.24], foreR: [-0.55, 0, 0], handR: [0.2, 0, 0],
    armL: [-0.10, 0, 0.30], foreL: [-0.75, 0, 0.1],
    thighL: [0.26, 0, 0.03], shinL: [-0.42, 0, 0],
    thighR: [-0.20, 0, -0.03], shinR: [-0.05, 0, 0],
  },
  ghoul: {
    spine: [0.16, 0.08, 0], chest: [0.10, -0.05, 0], head: [-0.10, 0.12, 0],
    armR: [-0.95, 0.30, -0.45], foreR: [-1.15, 0, -0.2], handR: [-0.3, 0, 0],
    armL: [-0.55, -0.2, 0.55], foreL: [-0.85, 0, 0.15],
    thighL: [-0.45, 0, 0.10], shinL: [0.70, 0, 0], footL: [-0.25, 0, 0],
    thighR: [0.30, 0, -0.10], shinR: [-0.55, 0, 0], footR: [0.25, 0, 0],
  },
  archer: {
    spine: [0, 0.10, 0], chest: [-0.04, -0.20, 0], head: [0.02, 0.30, 0],
    // 활을 든 팔은 뻗고, 시위를 당긴 팔은 접어 뒤로. **좌우가 반대여야** 활이다
    armR: [-1.42, 0.10, -0.18], foreR: [-0.12, 0, 0], handR: [0, 0, 0],
    armL: [-1.30, -0.55, 0.30], foreL: [-1.35, 0, 0],
  },
  golem: {
    spine: [0.06, -0.08, 0], chest: [0.04, 0.05, 0.03], head: [0.16, -0.10, 0],
    armR: [-0.10, 0, -0.22], foreR: [-0.35, 0, -0.08],
    armL: [-0.05, 0, 0.16], foreL: [-0.22, 0, 0.05],
    thighL: [-0.10, 0, 0.03], shinL: [0.08, 0, 0],
    thighR: [0.14, 0, -0.03], shinR: [-0.18, 0, 0],
  },
};

/** 자세를 **더한다.** 대입하면 구울·유령의 기본 굽은 각도가 지워진다 */
function pose(rig, spec) {
  for (const [name, [x, y, z]] of Object.entries(spec)) {
    const b = rig[name];
    if (!b) continue;                 // 유령은 다리가 없다 — 조용히 건너뛴다
    b.rotation.x += x; b.rotation.y += y; b.rotation.z += z;
  }
}

// ───────────────────────── 배경 ─────────────────────────
//
// 위아래가 **같은 배경**이어야 한다. 배경까지 바꾸면 「몸이 좋아진 것」인지
// 「배경이 좋아진 것」인지 구분이 안 된다.
//
// 처음엔 뒤에 판을 한 장 세웠다. 두 가지가 동시에 틀어졌다 —
// 판이 시야를 다 못 덮어서 **칸마다 배경 넓이가 달랐고**(카메라 거리가 다르니까),
// 게다가 ShaderMaterial 은 색공간 변환 청크가 안 붙어서 어두운 회색을 넣었는데
// 화면에는 **밝은 회색**으로 나왔다. 그냥 scene.background 를 쓴다 —
// 색공간은 three 가 알아서 맞추고, 넓이 문제도 없다.
const BG = new THREE.Color(0x0a0910);

// ───────────────────────── 한 칸 ─────────────────────────

// 정체색은 **연한 색**이어야 한다. 처음에 원색(형광 초록·새빨강)을 넣었더니
// 키가 작은 구울은 광원 안에 통째로 들어가 **몸이 초록으로 칠해졌다.**
// 색은 「이 몬스터구나」 하는 힌트지 도색이 아니다
const ROSTER = [
  { key: 'knight', name: '기사', now: buildKnight, hd: buildKnightHD, weapon: '검', accent: 0x93b0e0 },
  { key: 'skeleton', name: '해골 병사', now: () => buildSkeleton({ weapon: '창' }), hd: () => buildSkeletonHD({ weapon: '창' }), weapon: '창', accent: 0xd9866a },
  { key: 'ghoul', name: '구울', now: buildGhoul, hd: buildGhoulHD, accent: 0xa8cf8c },
  { key: 'archer', name: '망령 궁수', now: buildArcher, hd: buildArcherHD, accent: 0x9cc4e8 },
  { key: 'golem', name: '무덤 골렘', now: buildGolem, hd: buildGolemHD, accent: 0xe0985c },
];

/**
 * 지금 게임의 조명 — 성격은 그대로(횃불 + 차가운 보조)지만 **밝기는 올렸다.**
 *
 * 게임 값 그대로 두니 위줄이 거의 검은 실루엣이라 몸이 안 보였다.
 * gfx.html 에서 똑같은 실수를 했고 같은 결론이다 — **비교 컷인데 비교할 것이
 * 안 보이면 실패다.** 어둡게 두는 편이 아래줄에 유리하지만 그건 비교가 아니다.
 */
function lightNow(sc) {
  sc.add(new THREE.AmbientLight(0x3a3448, 2.0));
  const torch = new THREE.PointLight(0xffb257, 60, 16, 2);
  torch.position.set(-1.9, 2.5, 1.9);
  torch.castShadow = true; torch.shadow.mapSize.set(512, 512);
  sc.add(torch);
  const cool = new THREE.PointLight(0x6f9fff, 26, 14, 2);
  cool.position.set(2.2, 1.9, 1.4);
  sc.add(cool);
}

/**
 * 제안 조명 — **3점 + 정체색 한 점.**
 *
 * 핵심은 뒤에서 때리는 림이다. 던전은 어두워서 캐릭터가 배경에 먹히는데,
 * 뒤쪽 광원 하나면 실루엣이 배경에서 **떨어져 나온다.** 재질을 아무리 잘
 * 짜도 실루엣이 안 떨어지면 안 보인다 — 순서가 이쪽이 먼저다.
 */
function lightHD(sc, accent) {
  sc.add(new THREE.AmbientLight(0x323a52, 2.2));
  const key = new THREE.DirectionalLight(0xffe2bc, 3.4);
  key.position.set(-2.6, 4.2, 3.0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const c = key.shadow.camera;
  c.left = -2.2; c.right = 2.2; c.top = 3.4; c.bottom = -0.4; c.near = 0.5; c.far = 12;
  sc.add(key);
  // 림 — 뒤 위쪽에서. 세게 준다. 이게 이 컷의 절반이다
  const rim = new THREE.DirectionalLight(0xa8c8ff, 4.2);
  rim.position.set(2.4, 3.0, -3.2);
  sc.add(rim);
  const fill = new THREE.DirectionalLight(0x7f8fb8, 1.3);
  fill.position.set(3.2, 1.0, 2.4);
  sc.add(fill);
  // 정체색 — 발치에서 위로. 몬스터마다 색이 달라 줄 세워 놓으면 구분된다.
  //
  // **처음에 9 를 줬다가 다섯 칸이 통째로 원색으로 물들었다** — 해골은 새빨갛고
  // 구울은 형광 초록이었다. 정체색은 「알아보게 하는 힌트」지 「칠하는 색」이
  // 아니다. 세기를 1/4 로 내리고 아래로 내려 **발치만** 물들인다
  // 9 → 2.2 로도 부족했다. 몸 전체가 여전히 원색으로 물들었다.
  // **바닥 웅덩이로만** 남기고 몸에는 거의 안 닿게 더 내린다
  const glow = new THREE.PointLight(accent, 1.1, 1.9, 2);
  glow.position.set(0, 0.13, 0.62);
  sc.add(glow);
}

function makeCell(entry, hd) {
  const sc = new THREE.Scene();
  sc.background = BG;
  sc.fog = new THREE.FogExp2(0x07060c, 0.10);

  const rig = (hd ? entry.hd : entry.now)();
  if (entry.weapon && rig.weaponPal && !rig.weapon) {
    attachWeapon(rig, entry.weapon, rig.weaponPal, hd ? { y: -0.05, z: 0.03 } : { y: -0.05, z: 0.03 });
  }
  pose(rig, POSES[entry.key] || {});
  sc.add(rig.group);

  // 바닥 — 그림자를 받을 자리. 없으면 캐릭터가 허공에 뜬다.
  //
  // **가장자리를 지운다.** 그냥 원반을 깔았더니 밝은 접시가 어둠 속에 떠
  // 있었고, 캐릭터보다 그 접시의 테두리가 먼저 눈에 들어왔다. 배경으로
  // 녹아 사라져야 바닥이지, 테두리가 보이면 그건 무대 장치다
  //
  // 사라지게 하는 방법으로 처음에 셰이더에서 `vUv` 를 읽었다 — **컴파일이
  // 통째로 깨졌다.** 표준 재질은 텍스처가 붙어 있을 때만 vUv 를 만든다.
  // 꼭짓점 알파로 하면 셰이더를 안 건드리고 되고, 고리를 여러 겹 준
  // RingGeometry 라 가장자리만 부드럽게 빠진다.
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x24222c, roughness: 1, metalness: 0, transparent: true, vertexColors: true,
  });
  if (hd) surface(groundMat, 'stone', { rim: 0x000000, rimAmt: 0, scale: 0.5 });
  const gg = new THREE.RingGeometry(0, 2.6, 48, 7);
  const gp = gg.attributes.position;
  const col = new Float32Array(gp.count * 4);
  for (let i = 0; i < gp.count; i++) {
    const r = Math.hypot(gp.getX(i), gp.getY(i)) / 2.6;
    const a = 1 - Math.min(1, Math.max(0, (r - 0.42) / 0.56)) ** 1.6;
    col.set([1, 1, 1, a], i * 4);
  }
  gg.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const ground = new THREE.Mesh(gg, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  sc.add(ground);

  if (hd) {
    lightHD(sc, entry.accent);
    // 발밑 얼룩 — 캐릭터가 바닥에 **닿아 있다**는 신호. 접지 그림자의 대용
    const blob = glowDisc(0x000000, 1.5);
    blob.material.blending = THREE.NormalBlending;
    blob.material.uniforms.uCol.value.set(0x05040a);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.012;
    sc.add(blob);
  } else {
    lightNow(sc);
  }
  return { sc, rig };
}

const cells = ROSTER.map((e) => ({ e, now: makeCell(e, false), hd: makeCell(e, true) }));

// ── 카메라 ── **지금 몸의 크기로 잡아서 위아래 둘 다에 쓴다.**
// 제안본 크기로 잡으면 제안본만 딱 맞게 담겨서 그것만으로도 유리해 보인다.
//
// 담기는 폭을 계산할 때 **가로세로비를 나눠 줘야** 한다. 칸이 320×470 이라
// 가로 시야가 세로의 0.68 배뿐인데, 처음에 세로 기준으로만 잡았더니 검을 든
// 기사와 활을 든 궁수가 **양옆으로 잘려 나갔다.**
//
// `?closeup=1` — **상반신만 크게.** 320 픽셀짜리 칸에서는 뼈의 파임도 강철의
// 결도 한 픽셀 아래라 안 보인다. 「재질을 바꿨다」는 주장을 눈으로 확인하려면
// 얼굴이 화면의 절반은 차지해야 한다. 전신 컷과 확대 컷은 **묻는 것이 다르다** —
// 전신은 실루엣을, 확대는 표면을 묻는다.
const CLOSEUP = new URLSearchParams(location.search).get('closeup') === '1';
const ASPECT = CW / CH;
for (const c of cells) {
  const box = new THREE.Box3().setFromObject(c.now.rig.group);
  const size = new THREE.Vector3(), mid = new THREE.Vector3();
  box.getSize(size); box.getCenter(mid);
  // 3/4 각도라 화면에 비치는 폭은 x 와 z 를 섞은 값이다
  const wide = Math.hypot(size.x, size.z * 0.5);
  let span = Math.max(size.y, wide / ASPECT, 0.9) * 1.22;
  let aimY = mid.y;
  if (CLOSEUP) {
    // **머리 관절의 실제 위치**로 겨눈다. 처음에 경계상자 위쪽을 썼더니
    // 해골은 창끝, 궁수는 활 끝이 상자의 꼭대기라 얼굴이 화면 밖으로 나갔다.
    // 상자는 「무엇이 있는가」를 알지만 「어디가 얼굴인가」는 모른다
    const hp = new THREE.Vector3();
    (c.now.rig.head || c.now.rig.chest).getWorldPosition(hp);
    span *= 0.52; aimY = hp.y - 0.06;
  }
  const fov = 24;
  const dist = (span * 0.5) / Math.tan((fov * Math.PI / 180) / 2);
  const cam = new THREE.PerspectiveCamera(fov, ASPECT, 0.05, 60);
  const dir = new THREE.Vector3(0.42, 0.18, 1).normalize();
  const at = new THREE.Vector3(mid.x, aimY, 0);
  cam.position.copy(dir).multiplyScalar(dist).add(at);
  cam.lookAt(at);
  c.cam = cam;
  c.at = at;
}

// ── 후처리 (아래줄만) ── 그레인 · 색수차 · 비네트 · 살짝 청록.
// gfx.html 에서 확인한 것: 이 층이 「게임 화면」과 「촬영된 화면」을 가른다
//
// ── 오프스크린을 **칸마다 따로** 두는 이유 ────────────────────
// 처음엔 큰 렌더타깃 하나(3200×940)에 다섯 칸을 뷰포트로 나눠 그렸다.
// 화면에는 **골렘 하나가 가로로 늘어난 그림**만 나왔다 — 렌더타깃 안에서
// 뷰포트를 옮겨 가며 여러 번 그리는 것이 안 먹혔고, 마지막 칸이 전체를
// 덮어썼다. 원인을 파고들 값이 아니라 **틀릴 수 없는 구조**로 바꾼다:
// 칸마다 렌더타깃 하나, 한 번 그리고 한 번 옮긴다.
// ── 색공간 (여기서 크게 한 번 틀렸다) ────────────────────────
//
// **오프스크린에 그리면 톤매핑도 sRGB 변환도 안 걸린다.** 캔버스에 직접
// 그릴 때만 three 가 그 둘을 재질 셰이더에 끼워 넣기 때문이다.
// 그걸 모르고 선형 값을 그대로 화면에 뱉었더니 아래줄 전체가 **위줄보다
// 세 배쯤 어두웠다.** 조명이 약한 줄 알고 세기를 계속 올리고 있었는데,
// 원인은 조명이 아니라 감마였다 — 값을 올려서 맞추려 했으면 색이 다 깨졌다.
//
// 그래서 후처리에서 three 와 **똑같은 순서로** 직접 한다:
// 톤매핑(ACES) → sRGB 변환 → 그 위에 그레인·색수차·비네트.
const POST_FS = /* glsl */`
  uniform sampler2D tDiffuse; uniform float uT; uniform float uSeed; uniform float uExp;
  varying vec2 vUv;
  vec3 rrt(vec3 v){ vec3 a=v*(v+0.0245786)-0.000090537; vec3 b=v*(0.983729*v+0.4329510)+0.238081; return a/b; }
  vec3 aces(vec3 c){
    const mat3 IN = mat3(0.59719,0.07600,0.02840, 0.35458,0.90834,0.13383, 0.04823,0.01566,0.83777);
    const mat3 OUT = mat3(1.60475,-0.10208,-0.00327, -0.53108,1.10813,-0.07276, -0.07367,-0.00605,1.07602);
    c *= uExp / 0.6;
    return clamp(OUT * rrt(IN * c), 0.0, 1.0);
  }
  vec3 srgb(vec3 c){ return mix(c*12.92, 1.055*pow(max(c,vec3(0.0)),vec3(0.41666))-0.055, step(vec3(0.0031308), c)); }
  void main(){
    vec2 d = vUv - 0.5;
    float r2 = dot(d,d);
    float ca = 0.0018 * r2;
    vec3 c;
    c.r = texture2D(tDiffuse, vUv - d*ca).r;
    c.g = texture2D(tDiffuse, vUv).g;
    c.b = texture2D(tDiffuse, vUv + d*ca).b;
    c = srgb(aces(c));
    float l = dot(c, vec3(0.299,0.587,0.114));
    float n = fract(sin(dot(vUv*vec2(1234.5,6789.1) + uT + uSeed, vec2(12.9898,78.233))) * 43758.5453);
    c += (n - 0.5) * 0.06 * (1.0 - l*0.7);
    c *= 1.0 - smoothstep(0.16, 0.62, r2) * 0.5;
    c = mix(c, c * vec3(0.93, 1.0, 1.07), 0.32);
    gl_FragColor = vec4(c, 1.0);
  }`;

const SS = 2;                       // 오프스크린 배율 — 계단을 줄인다
const quadScene = new THREE.Scene();
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postMat = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: null }, uT: { value: 0 }, uSeed: { value: 0 },
    uExp: { value: renderer.toneMappingExposure },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
  fragmentShader: POST_FS,
});
quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
for (const c of cells) c.rt = new THREE.WebGLRenderTarget(CW * SS, CH * SS, { samples: 4 });

// 한 프레임이 무겁다 — 장면 10 개 + 그림자 5 장 + 3200×940 오프스크린이다.
// 실기에서는 문제가 없지만 **소프트웨어 렌더러로 스크린샷을 찍을 때** 프레임이
// 30 초 넘게 걸려 캡처가 통째로 실패했다. 그려 놓고 멈출 수 있어야 한다.
window.CHARS_PAUSE = false;

let t = 0;
function frame() {
  requestAnimationFrame(frame);
  if (window.CHARS_PAUSE && window.CHARS_READY) return;
  t += 1 / 60;
  // 아주 조금만 돈다. 정지 컷을 찍어야 하는 페이지라 크게 돌면 각도가 매번 다르다
  const yaw = Math.sin(t * 0.22) * 0.20;
  for (const c of cells) {
    c.now.rig.group.rotation.y = yaw;
    c.hd.rig.group.rotation.y = yaw;
    tickSurfaces(c.hd.sc, t);
  }

  // 위줄 — 지금. GL 은 아래가 y=0 이므로 위줄이 y=CH 다
  for (let i = 0; i < COLS; i++) {
    renderer.setViewport(i * CW, CH, CW, CH);
    renderer.setScissor(i * CW, CH, CW, CH);
    renderer.render(cells[i].now.sc, cells[i].cam);
  }

  // 아래줄 — 제안본. **칸마다** 오프스크린에 그리고 후처리를 통과시켜 옮긴다
  for (let i = 0; i < COLS; i++) {
    const c = cells[i];
    renderer.setRenderTarget(c.rt);
    renderer.setScissorTest(false);
    renderer.render(c.hd.sc, c.cam);
    renderer.setRenderTarget(null);
    renderer.setScissorTest(true);
    postMat.uniforms.tDiffuse.value = c.rt.texture;
    postMat.uniforms.uT.value = t;
    postMat.uniforms.uSeed.value = i * 17.3;   // 칸마다 그레인이 달라야 반복이 안 보인다
    renderer.setViewport(i * CW, 0, CW, CH);
    renderer.setScissor(i * CW, 0, CW, CH);
    renderer.render(quadScene, quadCam);
  }

  window.CHARS_READY = true;
}
frame();
