// 후처리 — 「디아블로 같은 공기」의 대부분이 여기서 나온다.
//
// 진단: 화면이 평평하고 상자처럼 보이는 이유는 모델보다 **빛의 처리**에 있었다.
// 톤 매핑만 걸려 있고 블룸도 색보정도 비네트도 없으니, 횃불이 그냥 밝은 점이고
// 어둠이 그냥 검정이다. 모델을 사서 넣어도 이 상태로는 그다지 안 달라진다.
//
// 세 겹으로 쌓는다:
//   1. 블룸    — 횃불·전설 아이템·보스의 눈이 번져 나온다. 어둠 속의 광원은
//                번져야 「빛」으로 보인다. 안 번지면 스티커다.
//   2. 색보정  — 스플릿 톤. 그림자는 차갑게(달빛), 하이라이트는 따뜻하게(횃불).
//                이 대비가 던전의 온도를 만든다. 채도·대비·리프트도 여기서.
//   3. 비네트  — 가장자리를 떨궈 시선을 가운데로 몬다. 랜턴 설계와 짝이 맞는다.
//
// 순서가 중요하다. **두 작업이 서로 다른 공간을 요구한다.**
//
//   블룸은 톤 매핑 **전** 선형 공간에서. 톤 매핑 후엔 밝은 부분이 이미 눌려
//   있어 번질 것이 남지 않는다.
//
//   색보정은 톤 매핑 **후** 표시 공간에서. 이걸 틀려서 한 번 크게 헤맸다 —
//   `(c-0.5)*대비 + 0.5 + 리프트` 는 sRGB 의 식인데 선형 HDR 에 걸었더니,
//   선형에서 중간 회색은 0.5 가 아니라 0.18 이고 이 던전의 휘도 중앙값은
//   0.017 이라 어두운 픽셀마다 0.042 씩 깎여 **바깥이 통째로 검정으로 잘렸다**
//   (실측: 바깥 밝기 23.5 → 3.0, −87%). 눈으로는 「분위기 있네」로 보여서
//   더 위험했다.
//
// 그래서 RenderPass → 자르기 → 블룸 → OutputPass(톤 매핑) → 색보정 순이다.
//
// 비용: 블룸은 해상도를 반씩 줄여 가며 5단계를 오간다. 실기 GPU 에서는
// 싸지만 소프트웨어 렌더링에서는 비싸다. ?post=0 으로 끌 수 있다.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * 광원 코어를 자른다 — 블룸이 태울 「연료」를 줄이는 장치.
 *
 * HDR 분포를 실측해 보니(휘도 중앙값 0.017 · p99 0.162 · **최대 36.6**),
 * 1.0 을 넘는 픽셀은 화면의 0.12% 뿐이었다. 문턱은 이미 충분히 높았다.
 * 진짜 원인은 **코어가 주변보다 200배 밝다**는 것이다. UnrealBloomPass 는
 * 그 36 을 그대로 넓게 퍼뜨리고, 주변 바닥은 0.05 밖에 안 되니
 * 거기에 0.3 만 얹혀도 6배가 된다 — 랜턴 하나가 바닥을 통째로 태웠다.
 *
 * 그런데 ACES 톤 매핑에서 2.5 는 이미 sRGB 97.5%, 36 은 100% 다.
 * 즉 **코어를 2.5 로 잘라도 눈에는 거의 같은 흰색**이면서
 * 번질 재료는 14배 줄어든다. 공짜에 가까운 교환이다.
 *
 * 채널별로 자르면 따뜻한 등불이 흰색이 되어 버리므로,
 * 가장 큰 채널을 기준으로 rgb 를 통째로 축소해 **색상을 유지**한다.
 */
const ClampShader = {
  name: 'ClampShader',
  uniforms: { tDiffuse: { value: null }, uMax: { value: 2.5 } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uMax;
    varying vec2 vUv;
    void main() {
      vec4 t = texture2D(tDiffuse, vUv);
      float m = max(max(t.r, t.g), t.b);
      if (m > uMax) t.rgb *= uMax / m;   // 비율을 지킨 채로 크기만 줄인다
      gl_FragColor = t;
    }`,
};

/** 색보정 — 스플릿 톤 + 대비 + 채도 + 비네트를 한 패스에 몰아넣는다 */
const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uShadow: { value: new THREE.Color(0x9fb4d8) },   // 그림자로 스미는 색 (차가운 달빛)
    uHigh: { value: new THREE.Color(0xffd9a8) },     // 하이라이트로 스미는 색 (횃불)
    // 아래 값들은 실측으로 내렸다. 처음 쓴 값(0.16 / 1.06 / -0.012 / 1.15)은
    // 화면 바깥 밝기를 −51% 까지 깎았다. 눈으로는 「분위기 있네」로 보이지만
    // 던전 대부분이 안 보이게 되는 값이다. 아래는 −31% — 어둡되 읽힌다.
    uSplit: { value: 0.12 },                          // 스플릿 톤 세기 — 0.35 는 필터를 씌운 것처럼 보였다
    uContrast: { value: 1.04 },
    uLift: { value: -0.004 },                         // 검정을 조금 더 눌러 깊이를 낸다
    uSat: { value: 1.06 },
    uVig: { value: 1.0 },                             // 비네트 세기
    uVigSoft: { value: 0.55 },                        // 가장자리가 얼마나 부드럽게 떨어지나
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec3 uShadow;
    uniform vec3 uHigh;
    uniform float uSplit, uContrast, uLift, uSat, uVig, uVigSoft;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 c = texel.rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));

      // 스플릿 톤 — 어두운 쪽과 밝은 쪽에 서로 다른 색을 섞는다.
      // 전체에 한 가지 색을 덮으면 필터를 씌운 것처럼 보이지만,
      // 명암에 따라 나누면 「그 공간의 빛」처럼 읽힌다.
      vec3 tint = mix(uShadow, uHigh, smoothstep(0.08, 0.62, l));
      c = mix(c, c * tint, uSplit);

      c = (c - 0.5) * uContrast + 0.5 + uLift;
      c = mix(vec3(l), c, uSat);

      // 비네트 — 가장자리를 떨군다. 랜턴 반경과 같은 방향으로 시선을 몬다.
      vec2 d = (vUv - 0.5) * vec2(1.0, 0.92);
      float v = smoothstep(0.78, uVigSoft, length(d) * uVig);
      c *= mix(0.55, 1.0, v);

      // 표시 공간이므로 0‥1 밖은 의미가 없다
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), texel.a);
    }`,
};

/** 블룸 설정 — 값의 근거는 위 ClampShader 주석과 tune.json 실측표에 있다 */
export const BLOOM = { strength: 0.26, radius: 0.4, threshold: 1.0, clamp: 2.5 };

export class Post {
  /**
   * @param quality 'high' | 'low' | 'off'
   *   high — 블룸 + 색보정 + 비네트
   *   low  — 색보정 + 비네트만 (블룸이 무거운 기기용)
   *   off  — 후처리 없음. 예전과 같은 화면.
   */
  constructor(renderer, scene, camera, quality = 'high') {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.quality = quality;
    this.enabled = quality !== 'off';
    if (!this.enabled) return;

    const size = renderer.getSize(new THREE.Vector2());
    // 반정밀 부동소수 버퍼. 8비트로 받으면 밝은 부분이 이미 잘려서
    // 블룸이 번질 재료가 남지 않는다.
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: 0,
    });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));

    if (quality === 'high') {
      // 자르기 → 번지기 순서. 자르지 않으면 아래 세기·반경을 아무리 낮춰도
      // 코어가 36 이라 halo 가 남는다 (실측으로 확인).
      this.clamp = new ShaderPass(ClampShader);
      this.composer.addPass(this.clamp);

      // 문턱은 **1.0 근처**여야 한다. 여기는 톤 매핑 이전의 HDR 선형 공간이라
      // 「화면에서 흰색」이 곧 1.0 이고, 광원 코어만 그 위로 넘어간다.
      // 세기·반경은 감이 아니라 실측으로 골랐다 — tune.json 참조.
      // 판단 기준은 「캐릭터 몸통이 배경 대비 얼마나 남는가」였다.
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
      this.composer.addPass(this.bloom);
    }

    // 톤 매핑 + 색공간 변환. 블룸보다 **뒤**, 색보정보다 **앞**.
    this.composer.addPass(new OutputPass());

    // 색보정은 톤 매핑된 표시 공간 위에서. 여기서는 0.5 가 진짜 중간이다.
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
  }

  /** 광원 코어를 자를 상한. 0 이하면 자르지 않는다 (튜닝 도구가 쓴다) */
  setClamp(v) {
    if (this.clamp) this.clamp.uniforms.uMax.value = v > 0 ? v : 1e9;
  }

  setSize(w, h) {
    if (!this.enabled) return;
    this.composer.setSize(w, h);
    if (this.bloom) this.bloom.setSize(w, h);
  }

  /** 층 테마에 맞춰 색을 갈아끼운다 — 수몰층은 더 푸르고, 왕좌는 더 붉다 */
  setTheme(theme) {
    if (!this.enabled || !theme) return;
    const u = this.grade.uniforms;
    u.uShadow.value.set(theme.postShadow ?? 0x9fb4d8);
    u.uHigh.value.set(theme.postHigh ?? 0xffd9a8);
  }

  render() {
    if (!this.enabled) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.composer.render();
  }

  dispose() {
    if (!this.enabled) return;
    this.composer.dispose?.();
    this.bloom?.dispose?.();
    this.clamp?.dispose?.();
    this.grade?.dispose?.();
  }
}
