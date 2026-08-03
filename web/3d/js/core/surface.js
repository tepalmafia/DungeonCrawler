// 표면 — **재질을 「색」이 아니라 「물질」로 만드는 층.**
//
// ── 왜 필요한가 ──────────────────────────────────────────────
// gfx.html 에서 확인한 것: 같은 메시라도 셰이더를 갈면 인상이 통째로 바뀐다.
// 그런데 거기서 만든 것은 **돌 하나뿐**이었다. 캐릭터는 뼈·강철·천·살·이끼가
// 한 몸에 붙어 있고, 지금은 그 다섯이 **전부 같은 방식으로** 칠해진다 —
// 색만 다른 매끈한 플라스틱이다. 멀리서 보면 다 똑같아 보이는 진짜 이유가
// 폴리곤이 아니라 이것이다.
//
// 물질마다 빛을 다르게 받는다. 뼈는 파이고 누렇게 절고, 강철은 결이 있고
// 모서리만 닳아 반짝이고, 천은 짜임이 있고 위쪽에 먼지가 앉는다.
// **그 차이를 코드로 넣는다** — 텍스처 파일은 여전히 0 개다.
//
// ── 좌표를 무엇으로 잡는가 (한 번 틀렸다) ────────────────────
// 처음엔 gfx.js 처럼 **월드 좌표**로 잡음을 뽑았다. 벽·바닥은 안 움직이니
// 문제가 없었는데, 캐릭터는 움직인다 — 걸으면 **무늬가 몸 위를 헤엄쳤다.**
// 지금은 지오메트리 로컬 좌표로 뽑는다. 관절마다 잡음 밭이 새로 시작하지만
// 파임·결 같은 것은 이음매가 안 보이고, 무엇보다 **몸에 붙어 따라온다.**
//
// 높이(때·이끼)만 월드 Y 를 쓴다. Y 회전으로는 안 변하니 헤엄치지 않는다.

import * as THREE from 'three';

/** 값 잡음 — 텍스처 파일의 대역품. 이 파일의 모든 얼룩이 여기서 나온다 */
export const NOISE = /* glsl */`
  float hash(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float noise(vec3 x){
    vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                   mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                   mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.03; a*=.5; } return s; }
  // 능선 잡음 — 균열·핏줄처럼 **선으로 보이는 것**은 전부 이걸로 만든다.
  // fbm 의 등고선을 쓰면 얼룩이 되고, 능선을 쓰면 선이 된다
  float ridge(vec3 p){ return 1.0 - abs(fbm(p)*2.0 - 1.0); }
`;

// 각 물질이 무엇을 하는지 — **한 줄 요약**
//
//   bone     파임 + 세로 결 + 누런 절음. 끝으로 갈수록 어둡다
//   steel    긴 결 + 모서리만 닳아 밝다 + 오목한 데 때
//   cloth    짜임 + 위쪽에 먼지 + 가장자리 보풀(빛이 천을 통과하는 흉내)
//   flesh    큰 얼룩(보라·붉은 쪽으로) + 젖은 광 얼룩 + 잔 모공
//   stone    큰 균열 + 이끼(위쪽만) + 알갱이
//   leather  가로 주름 + 접힌 데 어둠
//   mail     아주 잔 격자 — 사슬 갑옷은 「무늬가 촘촘하다」로만 읽혀도 된다
//
// ── 세기 (여기서 두 번째로 크게 틀렸다) ──────────────────────
// 처음 쓴 계수는 `d *= 0.80 + pit*0.34` 같은 것들이었다. fbm 의 실제 값이
// 0.4~0.6 에 몰려 있으므로 이건 **밝기가 ±6% 흔들린다**는 뜻이고, 화면에서는
// 아무 일도 안 일어난다. 확대 컷을 찍고 나서야 알았다 — 전신 컷에서는 원래
// 안 보이니까 「되고 있다」고 착각한 것이다.
//
// 물질이 보이려면 대비가 **두 배 안팎**은 나야 한다. gfx.js 의 돌이
// `0.55 + g*0.75` 였고 그게 유일하게 눈에 보였던 이유다.
const BODY = {
  bone: /* glsl */`
    float pit = fbm(lp*38.0);
    float grain = fbm(vec3(lp.x*46.0, lp.y*7.0, lp.z*46.0));
    // 처음 고친 값(0.52 + 1.05)은 이번엔 **너무 셌다.** 뼈가 코르크처럼
    // 보였다 — 물질감이 아니라 위장 무늬가 된다. 대비는 「보이는 최소」가 맞다
    d *= 0.66 + pit*0.72;
    d *= 0.85 + grain*0.30;
    // 파인 곳에 때가 낀다 — 파임의 골짜기만 골라 어둡게
    d *= mix(1.0, 0.48, smoothstep(0.44, 0.16, pit));
    // 누런 절음: 붉은 쪽을 살리고 푸른 쪽을 죽인다
    d *= vec3(1.0, 0.94, 0.76);
    rg *= 0.55 + pit*0.95;`,
  steel: /* glsl */`
    // 결은 **한 축으로 늘인 잡음**이다. 늘이지 않으면 그냥 얼룩이 된다
    float brush = fbm(vec3(lp.x*70.0, lp.y*3.0, lp.z*70.0));
    float blotch = fbm(lp*11.0);
    d *= 0.66 + brush*0.72;
    d *= 0.74 + blotch*0.55;
    // 모서리만 닳는다 — 실제로 갑옷은 튀어나온 데만 반짝인다.
    // 프레넬이 곡률의 싸구려 대용이다.
    // 1.9 배는 너무 셌다 — 기사의 정강이 능선이 **형광등**처럼 빛났다
    d = mix(d, d*1.45 + 0.03, wear*0.5);
    rg *= mix(1.35, 0.22, wear);
    // 오목한 데(아래를 보는 면) 때
    d *= mix(1.0, 0.42, down*0.75);
    mt = mix(mt, 0.25, blotch*0.35);`,
  mail: /* glsl */`
    float g1 = sin(lp.x*230.0)*sin(lp.y*230.0);
    float g2 = sin((lp.x+lp.z)*190.0)*sin(lp.y*190.0);
    d *= 0.42 + abs(g1)*0.55 + abs(g2)*0.42;
    rg *= 0.7 + abs(g1)*0.7;`,
  cloth: /* glsl */`
    // 짜임 — 직교하는 두 결. 잡음으로 흔들어야 「프린트」가 아니라 「천」이다
    float wob = fbm(lp*9.0);
    float weave = abs(sin(lp.x*150.0 + wob*3.0)) * abs(sin(lp.y*150.0 + wob*3.0));
    float wear2 = fbm(lp*4.0);
    d *= 0.62 + weave*0.80;
    d *= 0.60 + wear2*0.95;
    // 위를 보는 면에 먼지 — 던전에서 제일 값싸고 제일 효과가 큰 한 줄
    d = mix(d, d*0.45 + vec3(0.20,0.19,0.16), up*0.5);
    rg = 1.0;`,
  leather: /* glsl */`
    float fold = fbm(vec3(lp.x*8.0, lp.y*44.0, lp.z*8.0));
    float pore = fbm(lp*60.0);
    d *= 0.52 + fold*1.05;
    d *= 0.80 + pore*0.42;
    rg *= 0.62 + fold*0.95;`,
  flesh: /* glsl */`
    // 얼룩을 잘게 — 7 은 덩어리가 커서 **젖소 무늬**가 됐다
    float blot = fbm(lp*12.0);
    float vein = ridge(lp*13.0);
    float pore = fbm(lp*70.0);
    d *= 0.64 + blot*0.76;
    // 핏줄·멍 — 보라 쪽으로 민다. 초록 살에 보라를 섞으면 「썩은 것」이 된다
    d = mix(d, d*vec3(1.35,0.48,0.92), smoothstep(0.58,0.94,vein)*0.5);
    d *= 0.82 + pore*0.36;
    // 젖은 광이 **얼룩져야** 산다. 전체를 매끈하게 하면 비닐이 된다
    rg *= mix(1.25, 0.22, smoothstep(0.35,0.75,blot));`,
  stone: /* glsl */`
    float bulk = fbm(lp*4.2);
    float grit = fbm(lp*34.0);
    float crack = smoothstep(0.72, 0.96, ridge(lp*6.5));
    d *= 0.60 + bulk*0.72;
    d *= 0.88 + grit*0.24;
    d *= mix(1.0, 0.30, crack);
    // 이끼 — 위를 보는 면의 오목한 데만. 방향과 잡음을 **둘 다** 걸어야
    // 「초록 칠」이 아니라 「낀 것」으로 보인다.
    // 처음 값(0.45~0.8 · 0.55)은 **바닥 전체를 잔디밭으로** 만들었다. 바닥은
    // 전부 위를 보는 면이라 up=1 이고 잡음 문턱이 헐거우면 다 걸린다
    d = mix(d, vec3(0.13,0.18,0.10), up*smoothstep(0.58,0.78,bulk)*0.34);
    rg *= 0.75 + grit*0.5;`,
  wood: /* glsl */`
    float ring = fract(fbm(vec3(lp.x*22.0, lp.y*2.5, lp.z*22.0))*7.0);
    d *= 0.72 + ring*0.4;
    d *= 0.9 + fbm(lp*40.0)*0.2;
    rg *= 0.85 + ring*0.35;`,
};

/**
 * 재질 하나에 물질감을 심는다. **three 의 조명 계산은 건드리지 않는다** —
 * 확산색·거칠기·금속도만 갈아 끼우고 마지막에 림을 더한다. 그래야 그림자·
 * 점광원·안개가 전부 그대로 산다. (gfx.js 에서 배운 것)
 *
 * @param mat  MeshStandardMaterial
 * @param kind BODY 의 키
 * @param opt  { rim, rimPow, rimAmt, grime, grimeTo, scale }
 *             grime = 때가 차오르는 높이(월드 Y). 0 이면 안 쓴다
 */
export function surface(mat, kind, opt = {}) {
  const body = BODY[kind];
  if (!body) throw new Error('모르는 물질: ' + kind);
  mat.userData.surface = kind;

  // ── 이게 없으면 **전부 헛일이다.** (제일 오래 헤맨 함정) ──────
  //
  // three 는 컴파일된 셰이더 프로그램을 캐시하고, 그 키에 재질의
  // `customProgramCacheKey()` 를 넣는다. 기본 구현은 **`onBeforeCompile` 의
  // 소스 문자열**을 돌려준다. 그런데 여기서 넘기는 함수는 재질마다 다른 게
  // 아니라 **이 파일에 한 번 적힌 같은 화살표 함수**다 — 문자열이 같다.
  //
  // 그래서 뼈·강철·살·천이 전부 같은 키가 되고, **제일 먼저 컴파일된
  // 하나의 프로그램을 다 같이 쓴다.** 기사가 먼저 만들어지니 해골의 뼈도
  // 구울의 살도 전부 기사의 강철 셰이더로 그려지고 있었다.
  //
  // 증상이 지독한 이유: 오류가 하나도 안 난다. 그림도 멀쩡히 나온다.
  // 「대비가 약한가 보다」 하고 계수만 두 번 올렸는데 화면이 안 바뀌었고,
  // 값을 잡음 그대로 출력해 보고 나서야 **코드가 아예 안 도는 것**을 알았다.
  // 셰이더가 의심스러우면 계수를 만지지 말고 **값을 화면에 찍어야 한다.**
  mat.customProgramCacheKey = () => `surface:${kind}:${opt.grime > 0 ? 'g' : ''}`;

  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: new THREE.Color(opt.rim ?? 0x8ab4ff) };
    sh.uniforms.uRimAmt = { value: opt.rimAmt ?? 0.45 };
    sh.uniforms.uRimPow = { value: opt.rimPow ?? 3.2 };
    sh.uniforms.uGrime = { value: opt.grime ?? 0 };
    sh.uniforms.uScale = { value: opt.scale ?? 1 };

    sh.vertexShader = 'varying vec3 vLP; varying vec3 vWP; varying vec3 vWN;\n'
      + sh.vertexShader
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vLP = transformed;')
        .replace('#include <worldpos_vertex>',
          `#include <worldpos_vertex>
           vWP = (modelMatrix * vec4(transformed,1.0)).xyz;
           vWN = normalize(mat3(modelMatrix) * objectNormal);`);

    sh.fragmentShader =
      `uniform vec3 uRim; uniform float uRimAmt; uniform float uRimPow;
       uniform float uGrime; uniform float uScale;
       varying vec3 vLP; varying vec3 vWP; varying vec3 vWN;\n` + NOISE
      + sh.fragmentShader
        .replace('#include <color_fragment>',
          `#include <color_fragment>
           vec3 lp = vLP * uScale;
           vec3 wn = normalize(vWN);
           vec3 vd = normalize(cameraPosition - vWP);
           float up   = clamp(wn.y, 0.0, 1.0);
           float down = clamp(-wn.y, 0.0, 1.0);
           float wear = pow(1.0 - clamp(dot(wn, vd), 0.0, 1.0), 2.2);
           vec3 d = diffuseColor.rgb;
           float rg = 1.0, mt = 0.0;
           ${body}
           // 때 — **아래로 갈수록 어둡다.** 한 줄인데 「신품」과 「굴러다닌 것」을
           // 가른다. 발치가 밝으면 무엇을 해도 장난감으로 보인다
           if (uGrime > 0.0) {
             float k = 1.0 - smoothstep(0.0, uGrime, vWP.y);
             d *= mix(1.0, 0.42, k*k*0.9);
           }
           diffuseColor.rgb = d;
           vSurfRough = rg; vSurfMetal = mt;`)
        .replace('void main() {', 'float vSurfRough = 1.0; float vSurfMetal = 0.0;\nvoid main() {')
        .replace('#include <roughnessmap_fragment>',
          '#include <roughnessmap_fragment>\n roughnessFactor = clamp(roughnessFactor * vSurfRough, 0.03, 1.0);')
        .replace('#include <metalnessmap_fragment>',
          '#include <metalnessmap_fragment>\n metalnessFactor = clamp(metalnessFactor + vSurfMetal, 0.0, 1.0);')
        .replace('#include <dithering_fragment>',
          `#include <dithering_fragment>
           float fres = pow(1.0 - max(dot(normalize(vWN), normalize(cameraPosition - vWP)), 0.0), uRimPow);
           gl_FragColor.rgb += uRim * fres * uRimAmt;`);
  };
  mat.needsUpdate = true;
  return mat;
}

// 위의 `.replace('void main() {', ...)` 은 **전역 변수를 함수 밖에 선언**하려는
// 것이다. GLSL 에는 블록 밖으로 값을 빼는 다른 방법이 없고, 청크 사이는
// 서로 다른 블록이라 color_fragment 에서 만든 값을 roughnessmap_fragment 가
// 못 본다. 처음에 그걸 모르고 지역 변수로 썼다가 **거칠기 조정이 통째로
// 무시됐다** — 컴파일은 되고 그림만 안 바뀌어서 한참 찾았다.

/**
 * 흩어지는 몸 — 유령용. **투명이 아니라 버리기(discard)다.**
 *
 * 반투명으로 하면 정렬이 틀어져 옷자락 뒤로 몸통이 비친다(예전 유령이 그랬다).
 * 잡음 문턱으로 픽셀을 버리면 깊이가 정확하고, 알갱이가 흩어지는 모양이
 * 오히려 **연기처럼** 보인다 — 정렬 문제도 없고 그림도 낫다.
 *
 * @param from 이 높이(월드 Y) 아래부터 사라지기 시작
 * @param to   이 높이 아래는 전부 사라진다
 */
export function dissolve(mat, from = 0.55, to = -0.05) {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey?.() ?? '';
  mat.customProgramCacheKey = () => prevKey + '|dissolve';
  mat.onBeforeCompile = (sh) => {
    if (prev) prev(sh);
    sh.uniforms.uDisFrom = { value: from };
    sh.uniforms.uDisTo = { value: to };
    sh.uniforms.uDisT = { value: 0 };
    mat.userData.disUniforms = sh.uniforms;
    if (!/varying vec3 vWP;/.test(sh.vertexShader)) {
      sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\n vWP = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = 'varying vec3 vWP;\n' + sh.fragmentShader;
    }
    if (!/float hash\(vec3/.test(sh.fragmentShader)) sh.fragmentShader = NOISE + sh.fragmentShader;
    sh.fragmentShader = 'uniform float uDisFrom; uniform float uDisTo; uniform float uDisT;\n'
      + sh.fragmentShader.replace('#include <color_fragment>',
        `#include <color_fragment>
         float dz = smoothstep(uDisTo, uDisFrom, vWP.y);
         float n = fbm(vec3(vWP.xz*14.0, uDisT*0.6));
         if (n > dz*1.35) discard;
         // 사라지는 경계는 **밝다.** 타들어 가는 종이의 가장자리와 같다
         diffuseColor.rgb += vec3(0.35,0.55,0.75) * smoothstep(0.0, 0.25, n - dz*1.35 + 0.25) * (1.0-dz);`);
  };
  mat.transparent = false;
  mat.needsUpdate = true;
  return mat;
}

/**
 * 균열이 빛난다 — 골렘용. 심장이 몸통 밖으로 새어 나오는 표현.
 * 능선 잡음의 마루만 골라 발광에 더한다. 균열은 **면을 가로질러야** 하므로
 * 로컬 좌표가 아니라 월드 좌표로 뽑는다(골렘은 통짜라 헤엄이 안 보인다).
 */
export function crackGlow(mat, color = 0xff7a2a, amount = 1.6) {
  const prev = mat.onBeforeCompile;
  // 겹쳐 걸 때도 키를 이어 붙인다 — 안 그러면 surface 만 건 재질과
  // 같은 프로그램을 써서 균열이 통째로 사라진다
  const prevKey = mat.customProgramCacheKey?.() ?? '';
  mat.customProgramCacheKey = () => prevKey + '|crack';
  mat.onBeforeCompile = (sh) => {
    if (prev) prev(sh);
    sh.uniforms.uCrk = { value: new THREE.Color(color) };
    sh.uniforms.uCrkAmt = { value: amount };
    sh.uniforms.uCrkT = { value: 0 };
    mat.userData.crkUniforms = sh.uniforms;
    if (!/float hash\(vec3/.test(sh.fragmentShader)) sh.fragmentShader = NOISE + sh.fragmentShader;
    sh.fragmentShader = 'uniform vec3 uCrk; uniform float uCrkAmt; uniform float uCrkT;\n'
      + sh.fragmentShader.replace('#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         // 문턱을 **좁게** 잡는다. 처음에 0.80~0.99 로 넓게 잡았더니 몸의 절반이
         // 빛나서 골렘이 아니라 **용암 덩어리**가 됐다. 균열은 가늘어야 균열이다.
         //
         // 0.93 으로 올려도 여전히 용암이었다. 이유: ridge = 1-|fbm*2-1| 은
         // **fbm 이 0.5 근처인 모든 곳**에서 1 에 가깝고, 그게 부피의 대부분이다.
         // 문턱만 올리는 게 아니라 거듭제곱으로 마루를 뾰족하게 깎아야 선이 된다
         float cr = pow(smoothstep(0.90, 1.0, ridge(vWP*6.5)), 5.0);
         // 숨쉬듯 밝아진다 — 고정 발광은 스티커처럼 보인다
         totalEmissiveRadiance += uCrk * cr * uCrkAmt * (0.65 + 0.35*sin(uCrkT*1.7));`);
  };
  mat.needsUpdate = true;
  return mat;
}

/**
 * 눈빛 후광 — 발광 재질만으로는 **점 두 개**다. 뒤에 덧대는 가산 원반이
 * 있어야 「빛난다」로 읽힌다. 후처리 블룸의 값싼 대용이고, 던전처럼 어두운
 * 화면에서는 차이가 크다.
 */
export function glowDisc(color = 0xff4a2a, size = 0.16) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uCol: { value: new THREE.Color(color) }, uT: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uCol; uniform float uT; varying vec2 vUv;
      void main(){
        float r = length(vUv-0.5)*2.0;
        float a = pow(max(0.0, 1.0-r), 2.6) * (0.8 + 0.2*sin(uT*3.1));
        gl_FragColor = vec4(uCol, a);
      }`,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), m);
}

/** 매 프레임 시간 우니폼을 돌린다 — 흩어짐·균열·눈빛이 전부 살아 움직이게 */
export function tickSurfaces(root, t) {
  root.traverse((o) => {
    const m = o.material;
    if (!m) return;
    if (m.uniforms?.uT) m.uniforms.uT.value = t;
    if (m.userData?.disUniforms) m.userData.disUniforms.uDisT.value = t;
    if (m.userData?.crkUniforms) m.userData.crkUniforms.uCrkT.value = t;
  });
}
