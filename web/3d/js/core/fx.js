// 타격감 담당 — 데미지 숫자 · 파티클 · 예고 원 · 참격 호 · 발밑 그림자 · 카메라 셰이크.
// 전부 풀링한다. 전투 중에 객체를 새로 만들면 GC 가 프레임을 먹는다.

import * as THREE from 'three';
import { softDot, ringTexture } from './textures.js';

const MAX_PARTICLES = 700;
const MAX_NUMBERS = 36;
const MAX_DECALS = 24;

// ── 파티클: 입자마다 크기·알파가 달라야 해서 작은 전용 셰이더를 쓴다 ──
const PARTICLE_VS = `
attribute float aSize;
attribute vec3 aColor;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (320.0 / max(0.001, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;

const PARTICLE_FS = `
uniform sampler2D uMap;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 t = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(vColor, 1.0) * t * vAlpha;
  if (gl_FragColor.a < 0.01) discard;
  #include <colorspace_fragment>
}`;

export class FX {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.shake = 0;
    this.shakeDecay = 1;

    this._initParticles();
    this._initNumbers();
    this._initDecals();
    this.transients = [];      // 참격 호 등 일회성 메시
  }

  // ─────────────────────── 파티클 ───────────────────────
  _initParticles() {
    const N = MAX_PARTICLES;
    this.p = {
      pos: new Float32Array(N * 3),
      vel: new Float32Array(N * 3),
      col: new Float32Array(N * 3),
      size: new Float32Array(N),
      alpha: new Float32Array(N),
      life: new Float32Array(N),
      max: new Float32Array(N),
      grav: new Float32Array(N),
      head: 0,
    };
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.p.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.p.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.p.alpha, 1));
    g.setDrawRange(0, N);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);  // 컬링 방지

    const m = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: softDot() } },
      vertexShader: PARTICLE_VS,
      fragmentShader: PARTICLE_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.scene.add(this.points);
    this.pGeo = g;
    this.pMat = m;
  }

  /** 파티클 한 줌 */
  burst(pos, {
    count = 14, color = 0xffb060, speed = 4.5, size = 0.5,
    life = 0.5, spread = 1, grav = 9, up = 1,
  } = {}) {
    const p = this.p;
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const k = p.head = (p.head + 1) % MAX_PARTICLES;
      const a = Math.random() * Math.PI * 2;
      const el = Math.random() * Math.PI * 0.5 * spread;
      const s = speed * (0.45 + Math.random() * 0.75);
      p.pos[k * 3] = pos.x; p.pos[k * 3 + 1] = pos.y; p.pos[k * 3 + 2] = pos.z;
      p.vel[k * 3] = Math.cos(a) * Math.cos(el) * s;
      p.vel[k * 3 + 1] = Math.sin(el) * s * up;
      p.vel[k * 3 + 2] = Math.sin(a) * Math.cos(el) * s;
      p.col[k * 3] = c.r; p.col[k * 3 + 1] = c.g; p.col[k * 3 + 2] = c.b;
      p.size[k] = size * (0.6 + Math.random() * 0.8);
      p.max[k] = p.life[k] = life * (0.7 + Math.random() * 0.6);
      p.grav[k] = grav;
      p.alpha[k] = 1;
    }
  }

  _updateParticles(dt) {
    const p = this.p;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (p.life[i] <= 0) { if (p.alpha[i] !== 0) p.alpha[i] = 0; continue; }
      p.life[i] -= dt;
      const k = Math.max(0, p.life[i] / p.max[i]);
      p.alpha[i] = k * k;
      p.vel[i * 3 + 1] -= p.grav[i] * dt;
      p.pos[i * 3] += p.vel[i * 3] * dt;
      p.pos[i * 3 + 1] += p.vel[i * 3 + 1] * dt;
      p.pos[i * 3 + 2] += p.vel[i * 3 + 2] * dt;
      if (p.pos[i * 3 + 1] < 0.05) {          // 바닥에서 튕긴다
        p.pos[i * 3 + 1] = 0.05;
        p.vel[i * 3 + 1] *= -0.32;
        p.vel[i * 3] *= 0.7; p.vel[i * 3 + 2] *= 0.7;
      }
    }
    this.pGeo.attributes.position.needsUpdate = true;
    this.pGeo.attributes.aColor.needsUpdate = true;
    this.pGeo.attributes.aSize.needsUpdate = true;
    this.pGeo.attributes.aAlpha.needsUpdate = true;
  }

  // ─────────────────── 부유 데미지 숫자 ───────────────────
  _initNumbers() {
    this.numTexCache = new Map();
    this.numbers = [];
    for (let i = 0; i < MAX_NUMBERS; i++) {
      const mat = new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false });
      const s = new THREE.Sprite(mat);
      s.visible = false;
      s.renderOrder = 20;
      this.scene.add(s);
      this.numbers.push({ sprite: s, life: 0, max: 1, vy: 0, vx: 0, scale: 1 });
    }
    this.numHead = 0;
  }

  _numberTexture(text, color, big) {
    const key = `${text}|${color}|${big ? 1 : 0}`;
    if (this.numTexCache.has(key)) return this.numTexCache.get(key);
    const W = 256, H = 128;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.font = `${big ? 'bold ' : ''}${big ? 78 : 62}px Galmuri11, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(0,0,0,.92)';
    ctx.strokeText(text, W / 2, H / 2);
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, H / 2);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (this.numTexCache.size > 220) {          // 무한 증식 방지
      const first = this.numTexCache.keys().next().value;
      this.numTexCache.get(first).dispose();
      this.numTexCache.delete(first);
    }
    this.numTexCache.set(key, t);
    return t;
  }

  /** @param {string} text @param {object} opt */
  number(pos, text, { color = '#ffe9c0', big = false, life = 0.95, scale = 1 } = {}) {
    const slot = this.numbers[this.numHead = (this.numHead + 1) % MAX_NUMBERS];
    slot.sprite.material.map = this._numberTexture(String(text), color, big);
    slot.sprite.material.needsUpdate = true;
    slot.sprite.position.set(pos.x + (Math.random() - 0.5) * 0.5, pos.y, pos.z + (Math.random() - 0.5) * 0.5);
    slot.sprite.visible = true;
    slot.max = slot.life = life;
    slot.vy = 2.6;
    slot.vx = (Math.random() - 0.5) * 1.3;
    slot.scale = (big ? 1.75 : 1.15) * scale;
    slot.sprite.scale.set(slot.scale * 2, slot.scale, 1);
  }

  _updateNumbers(dt) {
    for (const n of this.numbers) {
      if (n.life <= 0) continue;
      n.life -= dt;
      if (n.life <= 0) { n.sprite.visible = false; continue; }
      const k = n.life / n.max;
      n.vy -= 3.6 * dt;
      n.sprite.position.y += n.vy * dt;
      n.sprite.position.x += n.vx * dt;
      n.sprite.material.opacity = Math.min(1, k * 2.2);
      const pop = 1 + (1 - k) * 0.12;
      n.sprite.scale.set(n.scale * 2 * pop, n.scale * pop, 1);
    }
  }

  // ─────────────── 지면 데칼 (예고 원 · 장판) ───────────────
  _initDecals() {
    this.decalGeo = new THREE.PlaneGeometry(1, 1);
    this.decals = [];
    for (let i = 0; i < MAX_DECALS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: ringTexture(), transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(this.decalGeo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.04;
      m.visible = false;
      m.renderOrder = 3;
      this.scene.add(m);
      this.decals.push({ mesh: m, life: 0, max: 1, r0: 1, r1: 1, fade: 'out' });
    }
    this.decalHead = 0;
  }

  /**
   * 지면 원. fade='in' 이면 점점 진해진다(예고), 'out' 이면 퍼지며 사라진다(폭발).
   */
  ground(pos, { r0 = 1, r1 = null, color = 0xff5a3a, life = 0.8, fade = 'out', opacity = 0.85 } = {}) {
    const d = this.decals[this.decalHead = (this.decalHead + 1) % MAX_DECALS];
    d.mesh.position.set(pos.x, 0.04, pos.z);
    d.mesh.material.color.set(color);
    d.mesh.visible = true;
    d.r0 = r0; d.r1 = r1 == null ? r0 : r1;
    d.max = d.life = life;
    d.fade = fade;
    d.opacity = opacity;
    return d;
  }

  _updateDecals(dt) {
    for (const d of this.decals) {
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) { d.mesh.visible = false; continue; }
      const k = 1 - d.life / d.max;                    // 0 → 1 진행도
      const r = d.r0 + (d.r1 - d.r0) * k;
      d.mesh.scale.set(r * 2, r * 2, 1);
      d.mesh.material.opacity = d.fade === 'in'
        ? d.opacity * (0.25 + k * 0.75)                 // 예고: 점점 선명
        : d.opacity * (1 - k);                          // 폭발: 점점 옅게
    }
  }

  // ─────────────────── 참격 호 (일회성) ───────────────────
  /** 부채꼴이 훑고 지나가는 연출 */
  arc(pos, angle, { radius = 2.8, spread = Math.PI * 0.8, color = 0xffe3b0, life = 0.22 } = {}) {
    const geo = new THREE.RingGeometry(radius * 0.35, radius, 24, 1, -spread / 2, spread);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -angle + Math.PI / 2;
    m.position.set(pos.x, 0.75, pos.z);
    m.renderOrder = 6;
    this.scene.add(m);
    this.transients.push({ mesh: m, geo, mat, life, max: life, kind: 'arc' });
  }

  /** 확장하는 링 (노바) */
  shockwave(pos, { r0 = 0.4, r1 = 6, color = 0xff8a3a, life = 0.5, y = 0.3 } = {}) {
    const geo = new THREE.TorusGeometry(1, 0.09, 6, 40);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = Math.PI / 2;
    m.position.set(pos.x, y, pos.z);
    m.renderOrder = 6;
    this.scene.add(m);
    this.transients.push({ mesh: m, geo, mat, life, max: life, kind: 'wave', r0, r1 });
  }

  _updateTransients(dt) {
    for (let i = this.transients.length - 1; i >= 0; i--) {
      const t = this.transients[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        t.geo.dispose(); t.mat.dispose();
        this.transients.splice(i, 1);
        continue;
      }
      const k = t.life / t.max;
      t.mat.opacity = k;
      if (t.kind === 'wave') {
        const r = t.r0 + (t.r1 - t.r0) * (1 - k);
        t.mesh.scale.set(r, r, 1 + (1 - k) * 2);
      } else if (t.kind === 'arc') {
        t.mesh.scale.setScalar(0.82 + (1 - k) * 0.3);
      }
    }
  }

  // ─────────────────── 카메라 셰이크 ───────────────────
  addShake(amount, decay = 6) {
    this.shake = Math.min(0.55, this.shake + amount);
    this.shakeDecay = decay;
  }
  shakeOffset(dt) {
    if (this.shake <= 0.0001) return { x: 0, y: 0 };
    this.shake = Math.max(0, this.shake - this.shakeDecay * this.shake * dt - 0.02 * dt);
    const s = this.shake;
    return { x: (Math.random() - 0.5) * s, y: (Math.random() - 0.5) * s };
  }

  update(dt) {
    this._updateParticles(dt);
    this._updateNumbers(dt);
    this._updateDecals(dt);
    this._updateTransients(dt);
  }

  clearTransients() {
    for (const t of this.transients) { this.scene.remove(t.mesh); t.geo.dispose(); t.mat.dispose(); }
    this.transients.length = 0;
    for (const d of this.decals) { d.life = 0; d.mesh.visible = false; }
    for (const n of this.numbers) { n.life = 0; n.sprite.visible = false; }
    this.p.life.fill(0);
    this.p.alpha.fill(0);
  }
}

/** 엔티티 발밑 그림자 — 실제 그림자 없이도 접지감을 준다 */
export function makeBlobShadow(size = 1) {
  const geo = new THREE.PlaneGeometry(size, size);
  const mat = new THREE.MeshBasicMaterial({
    map: softDot('rgba(0,0,0,1)'), transparent: true, opacity: 0.38,
    depthWrite: false, color: 0x000000,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  m.renderOrder = 2;
  return m;
}
