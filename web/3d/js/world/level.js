// 격자 → 메시. 드로우콜을 낮게 유지한다:
//   바닥 = 병합 지오메트리 1개, 벽 = InstancedMesh 1개, 소품 = 종류별 InstancedMesh.

import * as THREE from 'three';
import { CELL, FLOOR, gridToWorld } from './dungeon.js';
import { floorTexture, wallTexture, wallTopTexture, flameTexture, beamTexture, softDot } from '../core/textures.js';

export const WALL_H = 3.4;

export class Level {
  constructor(scene, dg) {
    this.scene = scene;
    this.dg = dg;
    this.group = new THREE.Group();
    this.disposables = [];
    scene.add(this.group);

    this._buildFloor();
    this._buildWalls();
    this._buildProps();
    this._buildTorches();
    this._buildExit();
  }

  // ── 바닥: 바닥 칸만 모아 하나의 지오메트리로 ──────────────
  _buildFloor() {
    const { dg } = this;
    const pos = [], uv = [], idx = [];
    let n = 0;
    const TILE = CELL * 3;    // 텍스처 1장이 3x3 칸을 덮는다 → 석판 1개 ≈ 1.5 유닛

    for (let gz = 0; gz < dg.h; gz++)
      for (let gx = 0; gx < dg.w; gx++) {
        if (dg.at(gx, gz) !== FLOOR) continue;
        const [cx, cz] = gridToWorld(gx, gz, dg.w, dg.h);
        const x0 = cx - CELL / 2, x1 = cx + CELL / 2;
        const z0 = cz - CELL / 2, z1 = cz + CELL / 2;
        pos.push(x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1);
        uv.push(x0 / TILE, z0 / TILE, x1 / TILE, z0 / TILE, x1 / TILE, z1 / TILE, x0 / TILE, z1 / TILE);
        idx.push(n, n + 2, n + 1, n, n + 3, n + 2);
        n += 4;
      }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({ map: floorTexture(dg.theme, dg.floorNo) });
    this.floorMesh = new THREE.Mesh(geo, mat);
    this.floorMesh.receiveShadow = true;
    this.group.add(this.floorMesh);
    this.disposables.push(geo, mat);
  }

  // ── 벽: 인스턴싱 박스. 옆면(잔 벽돌) / 윗면(거친 돌) 재질 분리 ──
  _buildWalls() {
    const { dg } = this;
    const list = [];
    for (let gz = 0; gz < dg.h; gz++)
      for (let gx = 0; gx < dg.w; gx++)
        if (dg.at(gx, gz) === 2) list.push([gx, gz]);

    const geo = new THREE.BoxGeometry(CELL, WALL_H, CELL);
    const side = new THREE.MeshLambertMaterial({ map: wallTexture(dg.theme) });
    const top = new THREE.MeshLambertMaterial({ map: wallTopTexture(dg.theme) });
    // BoxGeometry 그룹 순서: +x, -x, +y, -y, +z, -z
    const mats = [side, side, top, side, side, side];

    const mesh = new THREE.InstancedMesh(geo, mats, list.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const m = new THREE.Matrix4();
    list.forEach(([gx, gz], i) => {
      const [x, z] = gridToWorld(gx, gz, dg.w, dg.h);
      m.makeTranslation(x, WALL_H / 2, z);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.wallMesh = mesh;
    this.group.add(mesh);
    this.disposables.push(geo, side, top);
  }

  _buildProps() {
    const { dg } = this;
    const kinds = {
      pillar: new THREE.CylinderGeometry(0.42, 0.5, WALL_H, 8),
      coffin: new THREE.BoxGeometry(0.85, 0.55, 1.9),
      rubble: new THREE.DodecahedronGeometry(0.42, 0),
    };
    const mat = new THREE.MeshLambertMaterial({ map: wallTopTexture(dg.theme), color: 0xa89f92 });
    this.disposables.push(mat);

    for (const [kind, geo] of Object.entries(kinds)) {
      const items = dg.props.filter((p) => p.kind === kind);
      if (!items.length) { geo.dispose(); continue; }
      const mesh = new THREE.InstancedMesh(geo, mat, items.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
      items.forEach((p, i) => {
        const [x, z] = gridToWorld(p.gx, p.gz, dg.w, dg.h);
        const y = kind === 'pillar' ? WALL_H / 2 : kind === 'coffin' ? 0.28 : 0.3;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot);
        if (kind === 'rubble') s.set(1, 0.7, 1);
        m.compose(new THREE.Vector3(x, y, z), q, s);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
      this.disposables.push(geo);
    }
  }

  // ── 횃불: 벽에 붙은 받침 + 불꽃 스프라이트. 광원은 lighting.js 가 풀에서 배정 ──
  _buildTorches() {
    const { dg } = this;
    this.torches = [];
    const bracketGeo = new THREE.BoxGeometry(0.18, 0.5, 0.18);
    const bracketMat = new THREE.MeshLambertMaterial({ color: 0x1d1a20 });
    const flameMat = new THREE.SpriteMaterial({
      map: flameTexture(), color: dg.theme.torch,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    });
    this.disposables.push(bracketGeo, bracketMat, flameMat);

    const brackets = new THREE.InstancedMesh(bracketGeo, bracketMat, dg.torches.length);
    const m = new THREE.Matrix4();

    dg.torches.forEach((t, i) => {
      const [wx, wz] = gridToWorld(t.gx, t.gz, dg.w, dg.h);
      // 불꽃은 벽면에서 바닥 쪽으로 살짝 나와 있다
      const ox = t.dir[0] * (CELL / 2 + 0.16), oz = t.dir[1] * (CELL / 2 + 0.16);
      const px = wx + ox, py = 2.15, pz = wz + oz;

      m.makeTranslation(px, py - 0.3, pz);
      brackets.setMatrixAt(i, m);

      const flame = new THREE.Sprite(flameMat.clone());
      flame.position.set(px, py, pz);
      flame.scale.set(0.62, 0.86, 1);
      this.group.add(flame);

      this.torches.push({ pos: new THREE.Vector3(px, py, pz), flame, phase: i * 1.7 });
    });
    brackets.instanceMatrix.needsUpdate = true;
    this.group.add(brackets);
  }

  // ── 출구 포탈 (보스층에서는 보스 처치 후 열린다) ────────────
  _buildExit() {
    const { dg } = this;
    const [x, z] = gridToWorld(dg.exit.gx, dg.exit.gz, dg.w, dg.h);
    this.exitPos = new THREE.Vector3(x, 0, z);

    const g = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(1.05, 0.11, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x8fd6ff, transparent: true, opacity: 0.95 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    g.add(ring);

    const beamMat = new THREE.SpriteMaterial({
      map: beamTexture(), color: 0x8fd6ff,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.75,
    });
    const beam = new THREE.Sprite(beamMat);
    beam.scale.set(2.0, 4.2, 1);
    beam.position.y = 2.1;
    g.add(beam);

    const glowMat = new THREE.SpriteMaterial({
      map: softDot('rgba(160,220,255,1)'), color: 0x8fd6ff,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(3.4, 3.4, 1);
    glow.position.y = 0.15;
    g.add(glow);

    g.position.copy(this.exitPos);
    g.visible = !dg.isBossFloor;      // 보스층은 처치 후 열린다
    this.group.add(g);
    this.exitMesh = g;
    this.exitRing = ring;
    this.disposables.push(ringGeo, ringMat, beamMat, glowMat);
  }

  openExit() { this.exitMesh.visible = true; }
  get exitOpen() { return this.exitMesh.visible; }

  update(t, dt) {
    // 불꽃 흔들림 — 크기와 밝기를 서로 다른 주파수로 흔들면 규칙성이 사라진다
    for (const tr of this.torches) {
      const f = 1 + Math.sin(t * 9 + tr.phase) * 0.11 + Math.sin(t * 21.3 + tr.phase * 2.1) * 0.06;
      tr.flame.scale.set(0.62 * f, 0.86 * (0.94 + f * 0.08), 1);
      tr.flame.material.opacity = 0.82 + Math.sin(t * 13 + tr.phase) * 0.14;
    }
    if (this.exitMesh.visible) {
      this.exitRing.rotation.z += dt * 1.1;
      this.exitMesh.children[1].material.opacity = 0.6 + Math.sin(t * 3) * 0.16;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.isSprite && o.material) o.material.dispose();
    });
    for (const d of this.disposables) d.dispose?.();
    this.disposables.length = 0;
  }
}
