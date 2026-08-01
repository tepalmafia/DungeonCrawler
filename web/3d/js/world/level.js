// 격자 → 메시. 드로우콜을 낮게 유지한다:
//   바닥 = 병합 지오메트리 1개, 벽 = InstancedMesh 1개, 소품 = 종류별 InstancedMesh.

import * as THREE from 'three';
import { CELL, FLOOR, DOOR, gridToWorld } from './dungeon.js';
import {
  floorTexture, wallTexture, wallTopTexture, flameTexture, beamTexture, softDot,
  floorHeight, wallHeight, floorRough,
} from '../core/textures.js';
import { normalTexture, dataTexture } from '../core/normalmap.js';
import { makeRng } from '../core/rng.js';
import { makeFadeable, attachFade, updateOcclusion } from './occlusion.js';

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
        const cv = dg.at(gx, gz);
        // 문 칸에도 바닥을 깐다 — 열리면 지나다니는 곳이라 구멍이면 안 된다
        if (cv !== FLOOR && cv !== DOOR) continue;
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

    // 표면이 평평하면 아무리 그려도 스티커가 된다 — 노멀맵으로 요철을,
    // 거칠기맵으로 젖은 자국을 준다. 젖은 곳이 횃불을 반사해 「축축한 지하」가 된다.
    const nrm = normalTexture(floorHeight(dg.theme), { repeat: 1, strength: 2.6 });
    const rgh = dataTexture(floorRough(dg.theme), { repeat: 1 });
    const mat = new THREE.MeshStandardMaterial({
      map: floorTexture(dg.theme, dg.floorNo),
      normalMap: nrm, roughnessMap: rgh,
      roughness: 1, metalness: 0.06,
    });
    mat.normalScale.set(1.15, 1.15);
    this.disposables.push(nrm, rgh);
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
    const wn = normalTexture(wallHeight(dg.theme), { repeat: 1, strength: 3.0 });
    const side = new THREE.MeshStandardMaterial({
      map: wallTexture(dg.theme), normalMap: wn, roughness: 0.95, metalness: 0.04,
    });
    side.normalScale.set(1.45, 1.45);
    const top = new THREE.MeshStandardMaterial({ map: wallTopTexture(dg.theme), roughness: 1 });
    // BoxGeometry 그룹 순서: +x, -x, +y, -y, +z, -z
    const mats = [side, side, top, side, side, side];

    const mesh = new THREE.InstancedMesh(geo, mats, list.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // 높이를 조금씩 달리한다. 전부 같은 높이의 정육면체가 줄지어 선 것이
    // 「마인크래프트 같다」의 절반이다. 충돌 격자는 그대로라 게임성엔 영향이 없다.
    const rnd = makeRng(`${dg.seed}-wallvar-${dg.floorNo}`);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    const heights = [];
    list.forEach(([gx, gz], i) => {
      const [x, z] = gridToWorld(gx, gz, dg.w, dg.h);
      const k = rnd.range(0.9, 1.1);
      heights.push(k * WALL_H);
      sc.set(1, k, 1);
      m.compose(new THREE.Vector3(x, (k * WALL_H) / 2, z), q, sc);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.wallMesh = mesh;
    this.group.add(mesh);
    this.disposables.push(geo, side, top, wn);

    // 카메라와 플레이어 사이를 막으면 흐려진다 (occlusion.js)
    makeFadeable(side);
    makeFadeable(top);
    attachFade(mesh);
    this.fadeGroups = [{
      mesh, hw: CELL / 2,
      cells: list.map(([gx, gz], i) => {
        const [x, z] = gridToWorld(gx, gz, dg.w, dg.h);
        return { x, z, y0: 0, y1: heights[i] };
      }),
    }];

    this._buildWallDetail(list, heights, side, rnd);
  }

  /**
   * 벽 윗단 파편과 밑동 잔해.
   * 윗단이 깨져 있으면 실루엣이 일정한 톱니가 아니게 되고,
   * 밑동에 돌이 깔리면 바닥과 벽이 만나는 직선이 흐려진다 — 둘 다 격자감을 죽인다.
   */
  _buildWallDetail(list, heights, mat, rnd) {
    const { dg } = this;
    const caps = [], rubble = [];
    list.forEach(([gx, gz], i) => {
      const [x, z] = gridToWorld(gx, gz, dg.w, dg.h);
      if (rnd.chance(0.42)) {
        caps.push({ x, z, y: heights[i] + 0.1, w: rnd.range(0.3, 0.75), h: rnd.range(0.18, 0.5),
          ox: rnd.range(-0.5, 0.5), oz: rnd.range(-0.5, 0.5), rot: rnd.range(-0.4, 0.4) });
      }
      // 바닥과 맞닿은 면 쪽으로만 잔해를 깐다
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (dg.at(gx + dx, gz + dz) !== FLOOR) continue;
        if (!rnd.chance(0.3)) continue;
        rubble.push({
          x: x + dx * (CELL / 2 + rnd.range(0.05, 0.3)),
          z: z + dz * (CELL / 2 + rnd.range(0.05, 0.3)),
          s: rnd.range(0.11, 0.26), rot: [rnd() * 3, rnd() * 3, rnd() * 3],
        });
      }
    });

    if (caps.length) {
      const g = new THREE.BoxGeometry(1, 1, 1);
      const im = new THREE.InstancedMesh(g, mat, caps.length);
      im.castShadow = im.receiveShadow = true;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      caps.forEach((c, i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.rot);
        s.set(CELL * c.w, c.h, CELL * 0.88);
        m.compose(new THREE.Vector3(c.x + c.ox, c.y, c.z + c.oz), q, s);
        im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true;
      attachFade(im);
      this.fadeGroups.push({
        mesh: im, hw: CELL * 0.44,
        cells: caps.map((c) => ({ x: c.x + c.ox, z: c.z + c.oz, y0: c.y - c.h / 2, y1: c.y + c.h / 2 })),
      });
      this.group.add(im);
      this.disposables.push(g);
    }

    if (rubble.length) {
      const g = new THREE.DodecahedronGeometry(1, 0);
      const im = new THREE.InstancedMesh(g, mat, rubble.length);
      im.castShadow = im.receiveShadow = true;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
      rubble.forEach((r, i) => {
        e.set(r.rot[0], r.rot[1], r.rot[2]);
        q.setFromEuler(e);
        s.setScalar(r.s);
        m.compose(new THREE.Vector3(r.x, r.s * 0.7, r.z), q, s);
        im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true;
      // 잔해는 낮아서 가리지 않지만, 같은 재질을 쓰므로 속성은 반드시 붙인다
      attachFade(im);
      this.group.add(im);
      this.disposables.push(g);
    }
  }

  _buildProps() {
    const { dg } = this;
    const kinds = {
      pillar: new THREE.CylinderGeometry(0.42, 0.5, WALL_H, 8),
      coffin: new THREE.BoxGeometry(0.9, 0.78, 1.95),   // 납작하면 바닥의 검은 구멍으로 읽힌다
      rubble: new THREE.DodecahedronGeometry(0.42, 0),
    };
    // 소품이 어두우면 바닥에 뚫린 구멍처럼 보인다. 벽면과 같은 요철을 주고
    // 색을 올려 「빛을 받는 입체」로 읽히게 한다.
    const pn = normalTexture(wallHeight(dg.theme), { repeat: 1, strength: 2.2 });
    const mat = makeFadeable(new THREE.MeshStandardMaterial({
      map: wallTexture(dg.theme), normalMap: pn,
      color: 0xc9bfae, roughness: 0.88, metalness: 0.05,
    }));
    this.disposables.push(pn);
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
        const y = kind === 'pillar' ? WALL_H / 2 : kind === 'coffin' ? 0.4 : 0.3;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot);
        if (kind === 'rubble') s.set(1, 0.7, 1);
        m.compose(new THREE.Vector3(x, y, z), q, s);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      attachFade(mesh);
      if (kind === 'pillar' || kind === 'coffin') {
        const half = kind === 'pillar' ? WALL_H / 2 : 0.4;
        this.fadeGroups.push({
          mesh, hw: kind === 'pillar' ? 0.5 : 0.98,
          cells: items.map((p) => {
            const [x, z] = gridToWorld(p.gx, p.gz, dg.w, dg.h);
            return { x, z, y0: 0, y1: half * 2 };
          }),
        });
      }
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

  /** 카메라와 플레이어 사이를 막는 벽·기둥을 흐린다 */
  updateOcclusion(camera, playerPos, dt) {
    if (this.fadeGroups) updateOcclusion(this.fadeGroups, camera, playerPos, dt);
  }

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
