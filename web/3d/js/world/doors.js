// 문과 스위치 — 「도망칠 곳」을 만드는 장치.
//
// 격자 쪽 설계는 world/dungeon.js 의 금고 방 생성에, 통과 판정은 nav.walkable()
// 한 곳에 있다. 여기는 **보이는 것과 만지는 것**만 맡는다.
//
// 왜 문이 중요한가 (docs/DUNGEON-INTERACTIONS.md §2-2):
// 닫힌 문은 walkable() 을 막고, lineOfSight() 가 walkable() 을 쓰므로
// 시선도 같이 막힌다. 그래서 **문 너머의 적은 플레이어를 감지하지 못한다.**
// 잘못 끌었을 때 문 뒤로 빠지는 것이 정석 대응이 되고,
// 「한 마리씩 끌어낸다」는 이 게임의 전투 방식에 처음으로 **후퇴**가 생긴다.

import * as THREE from 'three';
import { CELL, gridToWorld } from './dungeon.js';
import { WALL_H } from './level.js';

const OPEN_TIME = 1.1;        // 문이 내려가는 데 걸리는 시간

export class Doors {
  constructor(scene, dg) {
    this.scene = scene;
    this.dg = dg;
    this.groups = [];
    this.lever = null;
    this.leverT = 0;

    const mat = new THREE.MeshStandardMaterial({
      color: 0x4a3b2c, roughness: 0.75, metalness: 0.35,
      emissive: 0x1a0e06, emissiveIntensity: 0.5,
    });
    this.mat = mat;
    const band = new THREE.MeshStandardMaterial({ color: 0x8a7038, roughness: 0.4, metalness: 0.9 });
    this.band = band;

    for (const door of dg.doors || []) {
      const g = new THREE.Group();
      for (const idx of door.cells) {
        const gx = idx % dg.w, gz = (idx / dg.w) | 0;
        const [x, z] = gridToWorld(gx, gz, dg.w, dg.h);
        const slab = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.98, WALL_H, CELL * 0.5), mat);
        slab.position.set(x, WALL_H / 2, z);
        slab.castShadow = slab.receiveShadow = true;
        g.add(slab);
        // 쇠띠 — 나무 판때기만 있으면 벽과 구분이 안 간다
        for (const yy of [WALL_H * 0.28, WALL_H * 0.68]) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(CELL * 1.0, 0.16, CELL * 0.56), band);
          b.position.set(x, yy, z);
          g.add(b);
        }
      }
      scene.add(g);
      this.groups.push({ door, group: g, t: 0 });
    }

    // 스위치 — **벽에 붙은** 손잡이.
    //
    // 방 한가운데 서 있으면 「어디에 달린 건지」가 안 읽힌다. 벽에 박힌 판에
    // 손잡이가 달려 있어야 「이걸 당기면 뭔가 열린다」로 보인다.
    // 멀리서도 눈에 들어오게 스스로 빛나되, 당긴 뒤에는 잦아든다.
    const sw = dg.switchAt;
    if (sw) {
      const [x, z] = gridToWorld(sw.gx, sw.gz, dg.w, dg.h);
      const grp = new THREE.Group();
      // 벽에 박은 판 — 벽 쪽으로 붙이고 방 안쪽을 본다
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.9, 0.16),
        new THREE.MeshStandardMaterial({ color: 0x4a3d2e, roughness: 0.8, metalness: 0.3 }));
      plate.position.set(0, 1.45, 0);
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.62, 0.14),
        new THREE.MeshStandardMaterial({
          color: 0xc8a24a, metalness: 0.85, roughness: 0.3,
          emissive: 0xc8a24a, emissiveIntensity: 0.8,
        }));
      handle.position.set(0, 1.5, 0.22);
      handle.rotation.x = -0.6;
      grp.add(plate, handle);

      // 벽 방향으로 밀어 붙이고, 그 반대(방 안쪽)를 향하게 돌린다
      let px = x, pz = z;
      if (sw.wall) {
        const [wx, wz] = sw.wall;
        px += wx * (CELL / 2 - 0.12);
        pz += wz * (CELL / 2 - 0.12);
        grp.rotation.y = Math.atan2(-wx, -wz);
      }
      grp.position.set(px, 0, pz);
      grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      scene.add(grp);
      this.lever = { group: grp, handle, at: sw, pulled: false, x: px, z: pz };
    }
  }

  /** 스위치를 당길 수 있는 거리인가 */
  leverInRange(px, pz, r = 2.2) {
    const l = this.lever;
    return !!l && !l.pulled && Math.hypot(l.x - px, l.z - pz) < r;
  }

  /** 스위치를 당긴다 → 이 층의 모든 문이 열린다 */
  pull(G) {
    const l = this.lever;
    if (!l || l.pulled) return false;
    l.pulled = true;
    for (const g of this.groups) g.door.open = true;
    return true;
  }

  update(dt) {
    for (const g of this.groups) {
      const want = g.door.open ? 1 : 0;
      if (g.t === want) continue;
      g.t = want === 1 ? Math.min(1, g.t + dt / OPEN_TIME) : Math.max(0, g.t - dt / OPEN_TIME);
      // 바닥으로 가라앉는다 — 옆으로 밀면 벽 안으로 파고들어 보인다
      g.group.position.y = -WALL_H * g.t;
      g.group.visible = g.t < 1;
    }
    if (this.lever) {
      const want = this.lever.pulled ? 0.75 : -0.55;
      this.lever.handle.rotation.x += (want - this.lever.handle.rotation.x) * Math.min(1, dt * 7);
      this.leverT += dt;
      if (!this.lever.pulled) {
        // 안 당긴 동안만 맥동한다 — 다 쓰고 나서도 깜빡이면 시선을 헛되이 끈다
        this.lever.handle.material.emissiveIntensity = 0.55 + Math.sin(this.leverT * 3.1) * 0.35;
      } else {
        this.lever.handle.material.emissiveIntensity = 0.15;
      }
    }
  }

  dispose() {
    for (const g of this.groups) {
      this.scene.remove(g.group);
      g.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    }
    if (this.lever) {
      this.scene.remove(this.lever.group);
      this.lever.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    }
    this.mat.dispose();
    this.band.dispose();
  }
}
