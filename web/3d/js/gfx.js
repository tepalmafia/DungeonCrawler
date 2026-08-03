// 그래픽 시제품 — **에셋 없이 어디까지 가는가.**
//
// 이 저장소에는 아티스트도 없고 외부 에셋도 못 받는다(네트워크 차단).
// 그래서 「퀄리티를 올린다」는 곧 **셰이더와 조명을 짠다**는 뜻이다.
// 폴리곤을 늘리는 게 아니다 — 같은 메시를 어떻게 비추고 어떻게 칠하느냐다.
//
// 세 가지를 같은 장면에 나란히 걸어 비교한다:
//
//   A 현재       three.js 기본 PBR + 점광원. 지금 게임 화면이다
//   B 셀 셰이딩  빛을 계단으로 끊고 외곽선을 두른다. **인상이 통째로 바뀐다**
//   C 시네마틱   삼중 투영 절차 텍스처 · 림 라이트 · 빛기둥 · 그레인
//
// 셋 다 **에셋 파일 0개**다. 텍스처도 셰이더 안에서 만든다.

import * as THREE from 'three';
import { buildKnight } from './core/models.js';

const W = 1600, H = 560;
const PANEL = W / 3;

const host = document.getElementById('gfx');
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('c') });
renderer.setSize(W, H);
renderer.setScissorTest(true);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

// ───────────────────────── 셰이더 조각 ─────────────────────────

/** 값 잡음 — 텍스처 파일 대신 쓴다. 돌·금속의 얼룩이 전부 여기서 나온다 */
const NOISE = /* glsl */`
  float hash(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float noise(vec3 x){
    vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                   mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                   mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=.5; } return s; }
`;

/**
 * B — 셀 셰이딩. **빛을 계단으로 끊는다.**
 *
 * three.js 의 기본 조명 계산을 통째로 갈아엎지 않고, 최종 확산광을
 * 단계로 양자화하는 한 줄만 끼워 넣는다. 그래야 그림자·점광원·안개 같은
 * 나머지 기능이 전부 그대로 산다.
 */
function celify(mat, steps = 3) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSteps = { value: steps };
    sh.fragmentShader = 'uniform float uSteps;\n' + sh.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
       {
         float l = dot(normalize(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse), vec3(0.3333));
         float q = floor(l * uSteps + 0.5) / uSteps;
         float k = l > 0.001 ? q / l : 1.0;
         reflectedLight.directDiffuse *= k;
       }`);
  };
  mat.needsUpdate = true;
  return mat;
}

/**
 * 외곽선 — **뒤집힌 껍데기**다. 같은 메시를 조금 부풀려 앞면을 버리고
 * 검게 칠하면 실루엣만 테두리로 남는다. 후처리 없이 되고 아주 싸다.
 */
function outline(root, thickness = 0.035) {
  const shell = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x08060c, side: THREE.BackSide });
  root.traverse((o) => {
    if (!o.isMesh) return;
    const m = new THREE.Mesh(o.geometry, mat);
    o.updateWorldMatrix(true, false);
    m.matrixAutoUpdate = false;
    m.matrix.copy(o.matrixWorld).scale(new THREE.Vector3(1 + thickness, 1 + thickness, 1 + thickness));
    shell.add(m);
  });
  return shell;
}

/**
 * C — 삼중 투영 절차 재질. **UV 도 텍스처 파일도 없이** 돌을 만든다.
 *
 * 월드 좌표로 잡음을 세 축에서 뽑아 법선 가중치로 섞는다. 이음매가 없고,
 * 벽·바닥·기둥이 각자 다른 크기로 알아서 갈라진다.
 * 림 라이트를 얹어 어두운 방에서도 실루엣이 살아 있게 한다.
 */
function stoneMaterial(base, rim = 0x6f9fff) {
  const m = new THREE.MeshStandardMaterial({ color: base, roughness: 1, metalness: 0.02 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: new THREE.Color(rim) };
    sh.vertexShader = 'varying vec3 vWP; varying vec3 vWN;\n' + sh.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
       vWP = (modelMatrix * vec4(transformed,1.0)).xyz;
       vWN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = 'uniform vec3 uRim; varying vec3 vWP; varying vec3 vWN;\n' + NOISE
      + sh.fragmentShader
        .replace('#include <color_fragment>',
          `#include <color_fragment>
           vec3 an = abs(normalize(vWN)); an /= (an.x+an.y+an.z);
           float g = fbm(vWP*0.9)*an.y + fbm(vWP.yzx*0.9)*an.x + fbm(vWP.zxy*0.9)*an.z;
           // 큰 얼룩 + 잔 알갱이. 둘을 섞어야 「돌」이 되고 하나만 쓰면 「노이즈」다
           float grit = fbm(vWP*7.0);
           diffuseColor.rgb *= 0.55 + g*0.75;
           diffuseColor.rgb *= 0.88 + grit*0.24;
           // 틈새 — 잡음의 능선을 어둡게 파면 벽돌 사이가 생긴다
           float seam = smoothstep(0.46,0.5,abs(fract(g*3.0)-0.5));
           diffuseColor.rgb *= mix(1.0, 0.45, seam);`)
        .replace('#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
           roughnessFactor *= 0.62 + fbm(vWP*3.1)*0.6;`)
        .replace('#include <dithering_fragment>',
          `#include <dithering_fragment>
           float fres = pow(1.0 - max(dot(normalize(vWN), normalize(cameraPosition - vWP)), 0.0), 3.5);
           gl_FragColor.rgb += uRim * fres * 0.5;`);
  };
  return m;
}

/** 빛기둥 — 원뿔에 프레넬을 반대로 걸어 가장자리만 밝게. 볼류메트릭 흉내 */
function lightShaft(color = 0xffcf9a) {
  const g = new THREE.ConeGeometry(2.6, 7, 24, 1, true);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uCol: { value: new THREE.Color(color) }, uT: { value: 0 } },
    vertexShader: `varying vec3 vP; varying vec3 vN;
      void main(){ vP=position; vN=normalize(normalMatrix*normal);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: NOISE + `uniform vec3 uCol; uniform float uT; varying vec3 vP; varying vec3 vN;
      void main(){
        // 아래로 갈수록 옅어진다 — 빛이 먼지에 흩어져 사라지는 모양
        float h = smoothstep(-3.5, 3.5, vP.y);
        float edge = pow(1.0 - abs(dot(vN, vec3(0.0,0.0,1.0))), 1.2);
        float dust = fbm(vec3(vP.xz*1.4, uT*0.25));
        gl_FragColor = vec4(uCol, h * 0.32 * (0.55 + edge*0.8) * (0.6 + dust*0.8));
      }`,
  });
  return new THREE.Mesh(g, m);
}

// ───────────────────────── 장면 ─────────────────────────
//
// **셋이 같은 장면이어야 비교가 된다.** 지오메트리는 한 번만 만들고
// 재질과 조명만 갈아 끼운다.

function makeScene(mode) {
  const sc = new THREE.Scene();
  sc.fog = new THREE.FogExp2(mode === 'cel' ? 0x14121c : 0x07060c, mode === 'cine' ? 0.035 : 0.04);

  const stone = mode === 'cine' ? stoneMaterial(0x6a6076, 0x8ab4ff)
    : new THREE.MeshStandardMaterial({ color: 0x6a6076, roughness: 0.92, metalness: 0.04 });
  const dark = mode === 'cine' ? stoneMaterial(0x4a4356, 0x6f9fff)
    : new THREE.MeshStandardMaterial({ color: 0x4a4356, roughness: 0.95, metalness: 0.03 });
  if (mode === 'cel') { celify(stone, 4); celify(dark, 4); }

  // 바닥과 벽 — 게임의 격자와 같은 비율
  const floor = new THREE.Mesh(new THREE.BoxGeometry(26, 0.6, 26), stone);
  floor.position.y = -0.3; floor.receiveShadow = true; sc.add(floor);
  for (const [x, z, w, d] of [[-7, 0, 1.2, 18], [7, 0, 1.2, 18], [0, -9, 15, 1.2]]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 5.2, d), dark);
    wall.position.set(x, 2.6, z); wall.castShadow = true; wall.receiveShadow = true;
    sc.add(wall);
  }
  // 기둥 — 삼중 투영이 축마다 다르게 갈라지는 것을 보여 주는 자리
  for (const x of [-3.4, 3.4]) {
    for (const z of [-5.2, -1.2]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 5.2, 12), stone);
      p.position.set(x, 2.6, z); p.castShadow = true; p.receiveShadow = true; sc.add(p);
    }
  }

  // 기사 — 게임과 같은 몸
  const rig = buildKnight();
  rig.group.position.set(0, 0, 1.2);
  rig.group.rotation.y = 0.7;
  rig.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  if (mode === 'cel') for (const m of rig.mats) celify(m, 4);
  sc.add(rig.group);
  if (mode === 'cel') sc.add(outline(rig.group, 0.075));

  // ── 조명 ──
  //
  // **채움광을 셋 다 넣는다.** 처음엔 분위기만 보고 광원을 아꼈더니 세
  // 컷 전부 기사가 검은 실루엣으로 뭉쳐서 **재질 차이가 아예 안 보였다** —
  // 비교 컷인데 비교할 것이 안 보이면 실패다.
  const fill = new THREE.PointLight(0xbfd0ff, 26, 12, 2);
  fill.position.set(2.6, 2.4, 4.2);
  sc.add(fill);

  if (mode === 'cel') {
    // 셀 셰이딩은 **점광원이 많으면 계단이 뭉개진다.** 방향광 하나로 간다
    sc.add(new THREE.AmbientLight(0x4a5270, 0.7));
    const key = new THREE.DirectionalLight(0xffe6c0, 2.4);
    key.position.set(-5, 9, 5); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -14; key.shadow.camera.right = 14;
    key.shadow.camera.top = 14; key.shadow.camera.bottom = -14;
    sc.add(key);
  } else {
    sc.add(new THREE.AmbientLight(0x2a2436, mode === 'cine' ? 1.5 : 1.0));
    const torch = new THREE.PointLight(0xffb257, mode === 'cine' ? 150 : 60, 26, 2);
    torch.position.set(-4.2, 3.4, -3);
    torch.castShadow = true; torch.shadow.mapSize.set(1024, 1024);
    sc.add(torch);
    const cool = new THREE.PointLight(0x6f9fff, mode === 'cine' ? 80 : 28, 22, 2);
    cool.position.set(4.6, 3.0, 2.5);
    sc.add(cool);
    if (mode === 'cine') {
      // 위에서 떨어지는 빛기둥 — 시선을 캐릭터로 모은다
      const shaft = lightShaft(0xffcf9a);
      shaft.position.set(-4.2, 4.2, -3);
      sc.add(shaft);
      const key = new THREE.DirectionalLight(0xbfd4ff, 1.1);
      key.position.set(2, 8, 6); sc.add(key);
    }
  }
  return { sc, rig };
}

// **가까이 붙인다.** 처음에 12.5 에서 찍었더니 기사가 백 픽셀도 안 돼서
// 재질과 외곽선 차이가 아예 안 보였다 — 비교 컷의 목적을 놓친 것이다.
const cam = new THREE.PerspectiveCamera(32, PANEL / H, 0.1, 120);
cam.position.set(3.4, 3.0, 7.8);
cam.lookAt(-0.2, 1.5, 0.6);

const MODES = ['now', 'cel', 'cine'];
const scenes = MODES.map((m) => makeScene(m));

// ── C 전용 후처리 — 그레인 · 색수차 · 비네트 ────────────────
//
// 후처리는 「있으면 좋은 것」이 아니라 **인상을 정하는 층**이다.
// 같은 픽셀에 그레인과 색수차를 얹는 것만으로 「게임 화면」이
// 「촬영된 화면」으로 넘어간다.
const GRAIN_FS = /* glsl */`
  uniform sampler2D tDiffuse; uniform float uT; varying vec2 vUv;
  void main(){
    vec2 d = vUv - 0.5;
    float r2 = dot(d,d);
    // 색수차 — 가장자리로 갈수록 채널이 어긋난다
    float ca = 0.0022 * r2;
    vec3 c;
    c.r = texture2D(tDiffuse, vUv - d*ca).r;
    c.g = texture2D(tDiffuse, vUv).g;
    c.b = texture2D(tDiffuse, vUv + d*ca).b;
    // 필름 그레인 — 어두운 데서 더 보인다 (실제 필름이 그렇다)
    float l = dot(c, vec3(0.299,0.587,0.114));
    float n = fract(sin(dot(vUv*vec2(1234.5,6789.1) + uT, vec2(12.9898,78.233))) * 43758.5453);
    c += (n - 0.5) * 0.075 * (1.0 - l*0.7);
    // 비네트 + 살짝 청록으로 미는 색보정
    c *= 1.0 - smoothstep(0.22, 0.95, r2) * 0.55;
    c = mix(c, c * vec3(0.92, 1.0, 1.08), 0.35);
    gl_FragColor = vec4(c, 1.0);
  }`;

const rt = new THREE.WebGLRenderTarget(PANEL * 2, H * 2);
const quadScene = new THREE.Scene();
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const grainMat = new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: rt.texture }, uT: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
  fragmentShader: GRAIN_FS,
});
quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), grainMat));

let t = 0;
function frame() {
  requestAnimationFrame(frame);
  t += 1 / 60;
  for (const { rig } of scenes) rig.group.rotation.y = 0.7 + Math.sin(t * 0.25) * 0.35;
  for (const { sc } of scenes) sc.traverse((o) => {
    if (o.material?.uniforms?.uT) o.material.uniforms.uT.value = t;
  });

  for (let i = 0; i < MODES.length; i++) {
    const x = i * PANEL;
    if (MODES[i] === 'cine') {
      // 시네마틱만 오프스크린으로 그린 뒤 후처리를 통과시킨다
      renderer.setScissorTest(false);
      renderer.setRenderTarget(rt);
      renderer.setViewport(0, 0, PANEL * 2, H * 2);
      renderer.render(scenes[i].sc, cam);
      renderer.setRenderTarget(null);
      renderer.setScissorTest(true);
      grainMat.uniforms.uT.value = t;
      renderer.setViewport(x, 0, PANEL, H);
      renderer.setScissor(x, 0, PANEL, H);
      renderer.render(quadScene, quadCam);
    } else {
      renderer.setViewport(x, 0, PANEL, H);
      renderer.setScissor(x, 0, PANEL, H);
      renderer.render(scenes[i].sc, cam);
    }
  }
  window.GFX_READY = true;
}
frame();
void host;
