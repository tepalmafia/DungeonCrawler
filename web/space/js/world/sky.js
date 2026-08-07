// ══════════════════════════════════════════════════════════════════════════
//  하늘을 짓는다 — **별 · 은하수 · 먼지 · 행성** (2026-08-07 · v57)
//
//  ★ 왜 파일을 갈랐나
//    `cockpit.js` 안에 있던 것을 꺼냈다. 조종석은 이미 1,100 줄이었고,
//    하늘은 **조종석과 아무 상관이 없다** — 관측실 창에서도 에어록 밖에서도
//    같은 하늘이다. 한 방의 파일 안에 온 우주가 들어 있는 것이 이상했다.
//
//  ★ 숫자는 여기 없다 — `game/sky-table.js` 한 곳이다.
//    거기에 **왜 그 값인지**(고증)가 적혀 있고, 여기는 **어떻게 그리나**만 있다.
//
//  ★★ 조명(Light)을 하나도 안 만든다.
//     행성의 낮/밤은 **자기 셰이더 안**에서만 계산한다. 예전에 태양을
//     `DirectionalLight` 로 놓았다가 거리가 없어서 **배 안까지 밝아졌다** —
//     창밖을 고치려다 실내 조명을 통째로 망가뜨리는 종류의 사고였다.
//     장면의 조명 목록에 아무것도 안 보태면 실내로 샐 길이 없다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { MAGS, STAR_COUNT, SPECTRA, MILKYWAY, DUST, PLANET, DOME_R, SUN }
  from '../game/sky-table.js';

/**
 * 같은 하늘을 늘 같게 — **난수도 표처럼 굴린다.**
 * 켤 때마다 별자리가 바뀌면 그건 하늘이 아니고, 무엇보다
 * **화면을 찍어 견줄 수가 없다** (「고쳤는데 그대로다」를 못 가린다).
 */
function rng(seed = 20260807) {
  let h = seed >>> 0;
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507)) >>> 0) / 4294967296;
}

/** 은하면의 좌표계 — 별을 몰아 줄 때도, 띠를 그릴 때도 같은 것을 쓴다 */
function galacticFrame() {
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(MILKYWAY.tilt, MILKYWAY.yaw, 0, 'YXZ'),
  );
  const m = new THREE.Matrix4().makeRotationFromQuaternion(q);
  return { q, mat3: new THREE.Matrix3().setFromMatrix4(m).transpose() };
}

// ── 값 잡음 — 은하수의 필라멘트와 행성의 무늬가 같은 것을 쓴다 ──────────
const NOISE_GLSL = `
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  return 0.53 * vnoise(p) + 0.27 * vnoise(p * 2.13) + 0.13 * vnoise(p * 4.31)
       + 0.07 * vnoise(p * 8.7);
}`;

// ══════════════════════════════════════════════════════════════════════════
//  별 — **박아 둔다. 흐르지 않는다.**
// ══════════════════════════════════════════════════════════════════════════
/**
 * @returns {{ points, setDensity(k), setFade(a), setTint(c), count }}
 */
export function buildStars(parent) {
  const rnd = rng();
  const { q } = galacticFrame();
  const n = STAR_COUNT + 1;                  // +1 은 태양
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const siz = new Float32Array(n);
  const idx = new Float32Array(n);

  /** 분광형 하나를 뽑는다 — 무게대로 */
  const pickClass = () => {
    let r = rnd();
    for (const s of SPECTRA) { r -= s.w; if (r <= 0) return s; }
    return SPECTRA[SPECTRA.length - 1];
  };

  const d = new THREE.Vector3();
  let k = 0;
  // ★ **밝은 띠부터 채운다.** 구역이 별을 지울 때(성운·성간 공백)
  //   뒤에서부터 자르므로, 이 차례가 곧 **어두운 것부터 사라진다**가 된다.
  //   그게 실제 성운의 소광(먼지가 빛을 먹는 것)과 같은 방향이다 —
  //   밝은 별은 성운 속에서도 보인다
  for (const band of MAGS) {
    for (let i = 0; i < band.n; i++, k++) {
      // 은하면 쪽으로 얼마쯤 몰아 준다
      const inBand = rnd() < MILKYWAY.crowd;
      const l = rnd() * Math.PI * 2;
      // 몰린 별은 은하 위도가 0 근처에 쏠린다. 꼬리가 두꺼운 분포라야
      // **띠 바깥에도 별이 있다** — 안 그러면 띠와 빈 하늘로 두 동강 난다
      const b = inBand
        ? Math.atan(Math.tan((rnd() - 0.5) * Math.PI * 0.94) * MILKYWAY.width)
        : Math.asin(2 * rnd() - 1);
      d.set(Math.cos(b) * Math.cos(l), Math.sin(b), Math.cos(b) * Math.sin(l));
      d.applyQuaternion(q).multiplyScalar(DOME_R);
      pos[k * 3] = d.x; pos[k * 3 + 1] = d.y; pos[k * 3 + 2] = d.z;

      // 색 — 분광형에서 오되, **어두우면 색을 잃는다** (원추세포가 안 켜진다)
      const sp = pickClass();
      const wm = band.warm;
      col[k * 3] = (1 - wm + sp.rgb[0] * wm) * band.lum;
      col[k * 3 + 1] = (1 - wm + sp.rgb[1] * wm) * band.lum;
      col[k * 3 + 2] = (1 - wm + sp.rgb[2] * wm) * band.lum;
      // 같은 등급 안에서도 조금씩 다르게 — 자로 잰 듯 같으면 격자로 보인다
      siz[k] = band.size * (0.82 + rnd() * 0.36);
      idx[k] = k;
    }
  }
  // ★ 태양 — 행성에 낮과 밤이 있는데 **비추는 것이 하늘에 없으면**
  //   「왜 저쪽만 밝지」가 된다. 늘 보여야 하므로 번호 0 으로 두면 좋겠지만
  //   차례가 밝기순이라 맨 뒤에 놓고 **자르기에서 뺀다**(uCut 은 별만 센다)
  const sun = new THREE.Vector3(...PLANET.sun).normalize().multiplyScalar(DOME_R);
  pos[k * 3] = sun.x; pos[k * 3 + 1] = sun.y; pos[k * 3 + 2] = sun.z;
  col[k * 3] = SUN.rgb[0] * SUN.lum;
  col[k * 3 + 1] = SUN.rgb[1] * SUN.lum;
  col[k * 3 + 2] = SUN.rgb[2] * SUN.lum;
  siz[k] = SUN.size;
  idx[k] = -1;                               // 음수 = 늘 보인다

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
  g.setAttribute('aIdx', new THREE.BufferAttribute(idx, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uPix: { value: Math.min(2, globalThis.devicePixelRatio || 1) },
      uCut: { value: STAR_COUNT },
      uFade: { value: 1 },
      uTint: { value: new THREE.Color(1, 1, 1) },
    },
    // ★★ **여기가 「하얀 네모」를 고치는 자리다.** three 의 기본 점은
    //   지도를 안 주면 정사각형을 그린다 — 900 개가 전부 흰 사각형이라
    //   별이 아니라 눈보라였다. `gl_PointCoord` 로 둥글게 깎고 가운데를
    //   세게 준다. 개수를 줄인 게 아니라 **모양을 별로** 만든 것이다
    vertexShader: `
      attribute vec3 aCol;
      attribute float aSize;
      attribute float aIdx;
      uniform float uPix, uCut;
      varying vec3 vCol;
      void main() {
        vCol = aCol;
        float on = step(aIdx, uCut);          // 번호가 자르는 선 안쪽인가
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPix * on;
      }`,
    fragmentShader: `
      uniform float uFade;
      uniform vec3 uTint;
      varying vec3 vCol;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
        float a = 1.0 - d * d;
        if (a <= 0.0) discard;
        gl_FragColor = vec4(vCol * uTint, a * a * uFade);
      }`,
    // ★★ **`depthTest: false` 로 두었다가 화면을 찍고 잡았다.**
    //   투명한 것은 불투명한 것을 **다 그린 뒤에** 그려지므로, 깊이 검사를
    //   끄면 별이 **천장·콘솔·계기 위에 그대로 찍힌다** — 실제로 조종석
    //   안쪽이 온통 별이었다. `renderOrder` 만으로는 못 막는다. 그건
    //   투명한 것들끼리의 차례일 뿐이다. 깊이 검사를 켜 두면 선체가
    //   알아서 가린다
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(g, mat);
  // ★ 안개를 안 먹인다. 별은 무한히 멀리 있으므로 **가까운 안개에 흐려지면
  //   안 된다** — 예전엔 구역 안개(fogFar 340)가 천구(반지름 330)를 물어서
  //   성운에서 별이 통째로 보라색으로 물들었다. 그건 성운이 아니라 색칠이다
  points.frustumCulled = false;
  points.renderOrder = -10;                  // 배경. 무엇보다 먼저 그린다
  parent.add(points);

  return {
    points,
    count: STAR_COUNT,
    setDensity(kk) { mat.uniforms.uCut.value = STAR_COUNT * kk; },
    setFade(a) { mat.uniforms.uFade.value = a; points.visible = a > 0.01; },
    setTint(c) { mat.uniforms.uTint.value.copy(c); },
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  은하수 — **띠**. 화면에서 제일 크게 달라지는 것
// ══════════════════════════════════════════════════════════════════════════
export function buildBand(parent) {
  const { mat3 } = galacticFrame();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uGal: { value: mat3 },
      uWidth: { value: MILKYWAY.width },
      uGlow: { value: MILKYWAY.glow },
      uDust: { value: MILKYWAY.dust },
      uFade: { value: 1 },
      uTint: { value: new THREE.Color(1, 1, 1) },
    },
    vertexShader: `
      uniform mat3 uGal;
      varying vec3 vG;
      void main() {
        vG = uGal * normalize(position);      // 은하 좌표로 옮긴다
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `${NOISE_GLSL}
      uniform float uWidth, uGlow, uDust, uFade;
      uniform vec3 uTint;
      varying vec3 vG;
      void main() {
        vec3 g = normalize(vG);
        float b = asin(clamp(g.y, -1.0, 1.0));      // 은하 위도
        float l = atan(g.z, g.x);                   // 은하 경도
        // 띠 — 가운데가 밝고 위아래로 흐려진다
        float t = b / uWidth;
        float band = exp(-t * t * 0.85);
        // 은하 중심 쪽이 더 밝다 (실제로 궁수자리 쪽이 압도적이다)
        band *= 0.55 + 0.45 * exp(-l * l * 0.6);
        // 필라멘트 — 낱개로 안 갈라지는 별무리. 매끈한 띠는 물감으로 보인다.
        // ★ 대비를 세게 준다(제곱). 밋밋하게 섞으면 세기를 아무리 낮춰도
        //   「띠」가 아니라 「뿌연 데」로 보인다 — 처음에 그렇게 찍혔다
        float f = fbm(vec2(l * 2.6, b * 7.0));
        band *= 0.22 + 1.7 * f * f;
        // ★ 먼지 줄기 — 은하수를 **가르는 검은 띠**(석탄자루). 이게 없으면
        //   은하수가 아니라 그냥 밝은 구름이다
        float lane = fbm(vec2(l * 1.7 + 9.3, b * 3.1 + 4.1));
        band *= 1.0 - uDust * smoothstep(0.42, 0.78, lane) * exp(-t * t * 2.2);
        float a = band * uGlow * uFade;
        if (a <= 0.002) discard;
        gl_FragColor = vec4(uTint * vec3(0.86, 0.87, 0.95), a);
      }`,
    // 깊이 검사를 켠다 — 별과 같은 까닭 (위 ★★)
    side: THREE.BackSide, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(DOME_R * 1.04, 32, 20), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -11;                    // 별보다도 먼저 — 별이 위에 얹힌다
  parent.add(mesh);
  return {
    mesh,
    setFade(a) { mat.uniforms.uFade.value = a; mesh.visible = a > 0.01; },
    setTint(c) { mat.uniforms.uTint.value.copy(c); },
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  먼지 — **흐르는 것은 이제 이것뿐이다**
// ══════════════════════════════════════════════════════════════════════════
/**
 * @param z 창 앞 기준 z (조종석 앞끝)
 */
export function buildDust(parent, z) {
  const rnd = rng(77);
  const zNear = z - DUST.near, zFar = z - DUST.far;
  const pos = new Float32Array(DUST.n * 3);
  const siz = new Float32Array(DUST.n);
  const place = (i, zz) => {
    const a = rnd() * Math.PI * 2;
    const rad = Math.sqrt(rnd()) * DUST.spread;
    pos[i * 3] = Math.cos(a) * rad;
    pos[i * 3 + 1] = Math.sin(a) * rad * 0.7;
    pos[i * 3 + 2] = zz;
  };
  for (let i = 0; i < DUST.n; i++) {
    place(i, zFar + rnd() * (zNear - zFar));
    siz[i] = DUST.size * (0.7 + rnd() * 0.6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uPix: { value: Math.min(2, globalThis.devicePixelRatio || 1) },
      uFade: { value: 1 },
      uCol: { value: new THREE.Vector3(...DUST.rgb).multiplyScalar(DUST.lum) },
      uNear: { value: zNear }, uFar: { value: zFar },
      uIn: { value: DUST.fadeIn }, uOut: { value: DUST.fadeOut },
    },
    // ★ 나타나고 사라지는 것을 **셰이더가 한다.** 자바스크립트에서 색을
    //   고치면 매 프레임 130 칸을 다시 올려야 하는데, 그게 예전에 별
    //   900 개로 하던 짓이다 — 그리고 **툭 켜지고 툭 꺼졌다**
    vertexShader: `
      attribute float aSize;
      uniform float uPix, uNear, uFar, uIn, uOut;
      varying float vA;
      void main() {
        float zz = position.z;
        vA = smoothstep(uFar, uFar + uIn, zz) * (1.0 - smoothstep(uNear - uOut, uNear, zz));
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPix * (300.0 / max(1.0, -mv.z));
      }`,
    fragmentShader: `
      uniform float uFade;
      uniform vec3 uCol;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
        float a = 1.0 - d * d;
        if (a <= 0.0) discard;
        gl_FragColor = vec4(uCol, a * a * vA * uFade);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  parent.add(points);
  const attr = g.attributes.position;

  return {
    points,
    setFade(a) { mat.uniforms.uFade.value = a; points.visible = a > 0.01; },
    /** @param d 이번 프레임에 몇 유닛 흘렀나 */
    flow(d) {
      const arr = attr.array;
      for (let i = 0; i < DUST.n; i++) {
        const k = i * 3 + 2;
        arr[k] += d;
        if (arr[k] > zNear) place(i, zFar);
      }
      attr.needsUpdate = true;
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  행성 — **터미네이터와 대기 테두리**
// ══════════════════════════════════════════════════════════════════════════
const V3 = (a) => new THREE.Vector3(...a);

export function buildPlanet(parent, r = 46) {
  const sun = V3(PLANET.sun).normalize();

  const body = new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: sun.clone() },
      uDay: { value: V3(PLANET.day) },
      uDark: { value: V3(PLANET.dark) },
      uTwi: { value: V3(PLANET.twilight) },
      uSoft: { value: PLANET.soft },
      uNight: { value: PLANET.night },
      uMottle: { value: PLANET.mottle },
      uTwiW: { value: PLANET.twiWidth },
      uTwiS: { value: PLANET.twiStrength },
    },
    vertexShader: `
      varying vec3 vN;
      void main() {
        vN = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    // ★ 빛 계산을 **물체 좌표에서** 한다. 배가 돌면(drift) 창밖이 통째로
    //   기우는데, 월드 좌표로 계산하면 **행성만 따라 돌아 낮면이 옮겨간다** —
    //   배가 도는데 해가 같이 도는 셈이라 눈이 바로 안다
    fragmentShader: `${NOISE_GLSL}
      uniform vec3 uSun, uDay, uDark, uTwi;
      uniform float uSoft, uNight, uMottle, uTwiW, uTwiS;
      varying vec3 vN;
      void main() {
        vec3 n = normalize(vN);
        float l = dot(n, uSun);
        // 터미네이터는 **또렷한 선이 아니다** — 대기가 빛을 흩어 번진다
        float day = smoothstep(-uSoft, uSoft, l);
        // ★ 지표 무늬. 민짜 공은 행성이 아니라 그냥 공으로 보인다.
        //   ★ 처음엔 fbm(n.xz*2.6 + n.y*1.9) 로 넣었다가 화면에서 **곧은
        //     대각선 이음매**가 났다 — 공 위의 점을 평면 좌표로 그냥 던지면
        //     그렇게 된다. 위도·경도로 풀어 준다.
        //   그리고 **가로 줄무늬**를 준다. 큰 행성은 자전이 대기를 위도로
        //   찢어 놓기 때문에 실제로 줄무늬가 진다 (목성·토성)
        float lat = n.y;
        float lon = atan(n.z, n.x);
        float m = 1.0 - uMottle
          + uMottle * 1.35 * fbm(vec2(lon * 1.9, lat * 5.0))
          + uMottle * 0.65 * (0.5 + 0.5 * sin(lat * 11.0 + fbm(vec2(lon * 1.2, lat * 2.0)) * 4.0));
        vec3 night = uDark + uDay * uNight;   // 밤면도 **0 이 아니다** (별빛)
        vec3 col = mix(night, uDay * m, day);
        // ★ 황혼 — **경계에만 실오라기처럼.** 폭을 uSoft 로 쓰다가
        //   (셰이더는 템플릿 문자열 안이라 여기 **역따옴표를 못 쓴다** —
        //    한 번 썼다가 문자열이 그 자리에서 끊겨 게임이 안 떴다)
        //   원반의 3분의 1 이 주황으로 물들어 분홍 반죽이 됐다 (sky-table ★★)
        float t = l / uTwiW;
        col += uTwi * exp(-t * t) * uTwiS;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), body);
  parent.add(planet);

  const airMat = new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: sun.clone() },
      uSky: { value: V3(PLANET.sky) },
      uLimb: { value: PLANET.limb },
      uPow: { value: PLANET.limbPow },
      uSoft: { value: PLANET.soft },
    },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vNv;
      varying vec3 vView;
      void main() {
        vN = normalize(position);
        vNv = normalMatrix * normal;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    // ★ **얇아야 고증이다.** 우주비행사 Ed Lu 는 지평선의 대기를
    //   「1도 남짓 — 팔 뻗은 손가락 굵기」라고 했다. 두껍게 주면 그건
    //   대기가 아니라 후광이고, 그러면 행성이 만화가 된다.
    //   가장자리에서만 서게 하는 것은 프레넬 — 시선과 면이 스칠수록 세다
    fragmentShader: `
      uniform vec3 uSun, uSky;
      uniform float uLimb, uPow, uSoft;
      varying vec3 vN;
      varying vec3 vNv;
      varying vec3 vView;
      void main() {
        float f = 1.0 - abs(dot(normalize(vNv), normalize(vView)));
        float rim = pow(clamp(f, 0.0, 1.0), uPow);
        // 낮면에서만 밝다 — 밤쪽 테두리까지 파랗게 빛나면 그건 후광이다
        float day = smoothstep(-uSoft * 2.2, uSoft * 1.2, dot(normalize(vN), uSun));
        float a = rim * uLimb * mix(0.06, 1.0, day);
        if (a <= 0.003) discard;
        gl_FragColor = vec4(uSky, a);
      }`,
    side: THREE.BackSide, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const air = new THREE.Mesh(new THREE.SphereGeometry(r * PLANET.air, 48, 32), airMat);
  parent.add(air);

  /**
   * 우주에서 보는 행성 ↔ 내려가는 행성.
   * ★ 예전에 색을 **바꿔 놓고 안 되돌려서**, 착륙 한 번 하면 그 뒤로 모든
   *   구역에서 행성이 갈색으로 떴다. 그래서 한 함수가 둘을 다 맡는다 —
   *   되돌리는 길이 따로 있으면 그 길을 안 부르는 날이 온다
   */
  function setMood(landing) {
    body.uniforms.uDay.value.set(...(landing ? PLANET.landDay : PLANET.day));
    body.uniforms.uDark.value.set(...(landing ? PLANET.landDark : PLANET.dark));
    airMat.uniforms.uSky.value.set(...(landing ? PLANET.landSky : PLANET.sky));
  }

  return {
    planet, air, setMood,
    set visible(v) { planet.visible = v; air.visible = v; },
    get visible() { return planet.visible; },
    setScale(s) { planet.scale.setScalar(s); air.scale.setScalar(s); },
    setPos(x, y, zz) { planet.position.set(x, y, zz); air.position.copy(planet.position); },
    get pos() { return planet.position; },
  };
}
