// 잔해 — 죽은 자리에 무엇이 남는가.
//
// 적이 사라지고 아무것도 안 남으면 지나온 길이 읽히지 않는다. 어디를 치웠고
// 어디가 아직인지, 어느 방에서 고전했는지가 바닥에 기록되어야 한다.
//
// 종족에 맞아야 한다:
//   골렘  → 돌 파편. 무겁게 튀고 굴러서 멈춘다. 피는 안 난다.
//   해골  → 뼛조각. 가볍게 흩어진다. 피는 안 난다 — 마른 지 오래다.
//   구울  → 살점과 핏자국. 젖은 것이 남는다.
//   망령  → 아무것도 안 남는다. 실체가 없다 — 이 「없음」이 종족 설명이다.
//
// 제약과 해법:
//  · 개수가 늘면 드로우 콜이 늘고 프레임이 무너진다
//      → 종류별 InstancedMesh 하나씩. 총량에 상한을 두고 오래된 것부터 재사용한다.
//  · 핏자국은 바닥 데칼이라 z-파이팅이 난다
//      → polygonOffset 으로 살짝 띄운다. 투명 정렬은 depthWrite:false 로 피한다.

import * as THREE from 'three';

const MAX_CHUNK = 120;        // 입체 파편 총량
const MAX_STAIN = 48;         // 바닥 자국 총량
const LIFE = 26;              // 초 — 이 뒤로 서서히 사라진다
const FADE = 6;               // 마지막 몇 초에 걸쳐 사라지는가

// 종족별 처방. 여기만 고치면 잔해가 바뀐다.
export const REMAINS = {
  skeleton: { chunks: 7, color: 0xe8dfc4, size: [0.10, 0.22], stain: null, bounce: 0.35 },
  ghoul: { chunks: 5, color: 0x8d9a68, size: [0.12, 0.24], stain: 0x5a1d1d, bounce: 0.15 },
  archer: { chunks: 0, color: 0x9fd8ff, size: [0, 0], stain: null, bounce: 0 },
  golem: { chunks: 12, color: 0x9a97a2, size: [0.18, 0.40], stain: null, bounce: 0.5 },
  lord: { chunks: 10, color: 0x8a6a9a, size: [0.15, 0.30], stain: 0x3a1b4a, bounce: 0.3 },
};

const CHUNK_GEO = new THREE.DodecahedronGeometry(1, 0);
const STAIN_GEO = new THREE.CircleGeometry(1, 12);
const M4 = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const V = new THREE.Vector3();
const S = new THREE.Vector3();

export class Remains {
  constructor(scene) {
    this.scene = scene;

    // vertexColors 를 켜면 안 된다 — 도데카헤드론에는 정점 색 속성이 없어서
    // 색이 통째로 검정이 된다. InstancedMesh 의 instanceColor 는 그것과 무관하게
    // 자동으로 적용된다(three 가 USE_INSTANCING_COLOR 를 정의한다).
    this.chunkMat = new THREE.MeshStandardMaterial({
      roughness: 0.92, metalness: 0.05,
    });
    this.chunks = new THREE.InstancedMesh(CHUNK_GEO, this.chunkMat, MAX_CHUNK);
    this.chunks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.chunks.castShadow = true;
    this.chunks.receiveShadow = true;
    this.chunks.frustumCulled = false;
    this.chunks.count = 0;
    this.chunks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_CHUNK * 3), 3);
    scene.add(this.chunks);

    this.stainMat = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.72,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.stains = new THREE.InstancedMesh(STAIN_GEO, this.stainMat, MAX_STAIN);
    this.stains.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.stains.frustumCulled = false;
    this.stains.count = 0;
    this.stains.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_STAIN * 3), 3);
    scene.add(this.stains);

    // 상태는 병렬 배열로 둔다 — 객체 배열이면 매 프레임 GC 압력이 생긴다
    this.c = { n: 0, head: 0, x: [], y: [], z: [], vx: [], vy: [], vz: [], rx: [], ry: [], rz: [], s: [], life: [], rest: [] };
    this.s = { n: 0, head: 0, x: [], z: [], r: [], rot: [], life: [] };
  }

  /** 적이 죽은 자리에 종족에 맞는 잔해를 남긴다 */
  spawn(kind, pos, scale = 1) {
    const R = REMAINS[kind];
    if (!R) return;

    for (let i = 0; i < R.chunks; i++) {
      const k = this.c.head = (this.c.head + 1) % MAX_CHUNK;
      if (this.c.n < MAX_CHUNK) this.c.n++;
      const a = Math.random() * Math.PI * 2;
      const sp = 1.4 + Math.random() * 2.6;
      this.c.x[k] = pos.x; this.c.y[k] = 0.5 + Math.random() * 0.4; this.c.z[k] = pos.z;
      this.c.vx[k] = Math.cos(a) * sp; this.c.vy[k] = 2 + Math.random() * 2.6; this.c.vz[k] = Math.sin(a) * sp;
      this.c.rx[k] = Math.random() * 6; this.c.ry[k] = Math.random() * 6; this.c.rz[k] = Math.random() * 6;
      this.c.s[k] = (R.size[0] + Math.random() * (R.size[1] - R.size[0])) * scale;
      this.c.life[k] = LIFE * (0.75 + Math.random() * 0.5);
      this.c.rest[k] = R.bounce;
      const col = new THREE.Color(R.color).multiplyScalar(0.75 + Math.random() * 0.5);
      this.chunks.instanceColor.setXYZ(k, col.r, col.g, col.b);
    }

    if (R.stain) {
      const k = this.s.head = (this.s.head + 1) % MAX_STAIN;
      if (this.s.n < MAX_STAIN) this.s.n++;
      this.s.x[k] = pos.x; this.s.z[k] = pos.z;
      this.s.r[k] = (0.55 + Math.random() * 0.45) * scale;
      this.s.rot[k] = Math.random() * Math.PI;
      this.s.life[k] = LIFE * 1.4;                 // 자국은 파편보다 오래 남는다
      const col = new THREE.Color(R.stain);
      this.stains.instanceColor.setXYZ(k, col.r, col.g, col.b);
    }

    this.chunks.count = this.c.n;
    this.stains.count = this.s.n;
    this.chunks.instanceColor.needsUpdate = true;
    this.stains.instanceColor.needsUpdate = true;
  }

  update(dt) {
    const c = this.c;
    for (let k = 0; k < c.n; k++) {
      if (c.life[k] <= 0) { S.setScalar(0); M4.compose(V.set(0, -999, 0), Q.identity(), S); this.chunks.setMatrixAt(k, M4); continue; }
      c.life[k] -= dt;
      if (c.vy[k] !== 0 || c.y[k] > c.s[k]) {
        c.vy[k] -= 22 * dt;
        c.x[k] += c.vx[k] * dt; c.y[k] += c.vy[k] * dt; c.z[k] += c.vz[k] * dt;
        c.rx[k] += c.vx[k] * dt * 2; c.rz[k] += c.vz[k] * dt * 2;
        if (c.y[k] <= c.s[k]) {                    // 착지 — 튀었다가 멈춘다
          c.y[k] = c.s[k];
          if (Math.abs(c.vy[k]) > 1.2) {
            c.vy[k] = -c.vy[k] * c.rest[k];
            c.vx[k] *= 0.55; c.vz[k] *= 0.55;
          } else {
            c.vy[k] = 0; c.vx[k] = 0; c.vz[k] = 0;
          }
        }
      }
      // 마지막 몇 초에 걸쳐 작아지며 사라진다 — 툭 없어지면 눈에 띈다
      const f = c.life[k] < FADE ? Math.max(0, c.life[k] / FADE) : 1;
      E.set(c.rx[k], c.ry[k], c.rz[k]);
      Q.setFromEuler(E);
      M4.compose(V.set(c.x[k], c.y[k], c.z[k]), Q, S.setScalar(c.s[k] * f));
      this.chunks.setMatrixAt(k, M4);
    }
    if (c.n) this.chunks.instanceMatrix.needsUpdate = true;

    const s = this.s;
    let minFade = 1;
    for (let k = 0; k < s.n; k++) {
      if (s.life[k] <= 0) { M4.compose(V.set(0, -999, 0), Q.identity(), S.setScalar(0)); this.stains.setMatrixAt(k, M4); continue; }
      s.life[k] -= dt;
      const f = s.life[k] < FADE ? Math.max(0, s.life[k] / FADE) : 1;
      minFade = Math.min(minFade, f);
      E.set(-Math.PI / 2, 0, s.rot[k]);
      Q.setFromEuler(E);
      M4.compose(V.set(s.x[k], 0.02, s.z[k]), Q, S.setScalar(s.r[k]));
      this.stains.setMatrixAt(k, M4);
    }
    if (s.n) this.stains.instanceMatrix.needsUpdate = true;
    // 자국은 크기를 줄이면 이상하다(피가 오그라들지 않는다) → 불투명도로 지운다.
    // 인스턴스별 알파는 셰이더를 고쳐야 하므로, 여기서는 전체 알파로 근사한다.
    this.stainMat.opacity = 0.72 * (0.35 + 0.65 * minFade);
  }

  clear() {
    this.c.n = this.c.head = 0;
    this.s.n = this.s.head = 0;
    this.chunks.count = 0;
    this.stains.count = 0;
  }

  dispose() {
    this.scene.remove(this.chunks, this.stains);
    this.chunkMat.dispose();
    this.stainMat.dispose();
  }
}
