// 휴식 — 모닥불을 피우고 앉는다.
//
// 왜 필요한가: 이 게임은 「한 마리씩 끌어와 오래 싸운다」인데, 교전과 교전
// 사이에 **아무것도 안 하는 시간**이 없었다. 물약 쿨다운이 24초로 늘어난 뒤로는
// 특히 그렇다 — 회복 수단이 물약뿐이면 기다리는 것 말고 할 게 없다.
//
// 휴식은 그 빈틈을 「선택」으로 바꾼다:
//
//   · 체력·마나가 빠르게 찬다
//   · 대신 **랜턴 연료가 3배로 탄다.** 불을 피워 두는 값이다
//   · **적이 다가오면 강제로 일어난다.** 안전한 곳을 고르는 것이 판단이 된다
//   · 모닥불은 밝다 — 쉬는 동안은 눈에 잘 띈다
//
// 즉 「지금 쉴 것인가, 연료를 아끼고 밀어붙일 것인가」다.
// 그냥 회복 버튼이 아니다.

import * as THREE from 'three';

export const REST = {
  hpPerSec: 0.055,       // 최대 체력 대비
  mpPerSec: 0.09,
  fuelMul: 3,            // 쉬는 동안 연료가 타는 배수
  breakRange: 7.5,       // 이 안에 적이 들어오면 일어난다
  sitTime: 0.55,         // 앉는 데 걸리는 시간
};

export class Rest {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.t = 0;

    const g = new THREE.Group();
    // 장작 — 통나무 셋을 비스듬히
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.95 });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.72, 6), wood);
      log.position.set(Math.cos(a) * 0.16, 0.2, Math.sin(a) * 0.16);
      log.rotation.set(Math.cos(a) * 0.62, a, Math.sin(a) * 0.62);
      g.add(log);
    }
    // 돌 테두리 — 「누가 만들어 둔 자리」로 보이게
    const stone = new THREE.MeshStandardMaterial({ color: 0x555055, roughness: 1 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13, 0), stone);
      s.position.set(Math.cos(a) * 0.6, 0.07, Math.sin(a) * 0.6);
      s.scale.set(1, 0.6, 1);
      g.add(s);
    }
    // 불꽃 — 겹친 원뿔 둘. 가산 합성이라 어둠 속에서 뜬다
    this.flames = [];
    for (const [r, h, c, o] of [[0.26, 0.7, 0xffb257, 0.9], [0.16, 1.0, 0xffe6a0, 0.75]]) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7),
        new THREE.MeshBasicMaterial({
          color: c, transparent: true, opacity: o,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
      f.position.y = 0.28 + h / 2;
      g.add(f);
      this.flames.push(f);
    }
    this.light = new THREE.PointLight(0xffa84a, 0, 11, 2);
    this.light.position.y = 0.8;
    g.add(this.light);

    g.visible = false;
    scene.add(g);
    this.group = g;
  }

  /** @returns {{ok:boolean, why?:string}} */
  start(G) {
    const p = G.player;
    if (this.active) return { ok: false, why: '이미 쉬는 중' };
    if (p.dead) return { ok: false, why: '' };
    // 근처에 적이 있으면 못 쉰다. 「싸우다 말고 회복」이 되면 안 된다.
    const near = G.enemies.find((e) => !e.dead
      && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < REST.breakRange);
    if (near) return { ok: false, why: '적이 너무 가깝다' };

    this.active = true;
    this.t = 0;
    this.group.position.set(p.pos.x + Math.sin(p.facing) * 1.2, 0, p.pos.z + Math.cos(p.facing) * 1.2);
    this.group.visible = true;
    p.stop();
    p.target = null;
    return { ok: true };
  }

  stop(G, why = '') {
    if (!this.active) return;
    this.active = false;
    this.group.visible = false;
    this.light.intensity = 0;
    if (G.player) G.player.resting = 0;
    if (why) G.ui?.toast(why, '#e0a072');
  }

  update(dt, G) {
    if (!this.active) return;
    const p = G.player;

    // 일어나는 조건 — 움직이거나, 죽거나, 적이 다가오거나
    if (p.dead) return this.stop(G);
    if (p.path.length || p.target) return this.stop(G, '일어섰다');
    const near = G.enemies.find((e) => !e.dead
      && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < REST.breakRange);
    if (near) {
      this.stop(G, '무언가 다가온다');
      return;
    }

    this.t += dt;
    // 앉는 자세는 player._animate 가 이 값을 보고 만든다 (0→1)
    p.resting = Math.min(1, this.t / REST.sitTime);

    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * REST.hpPerSec * dt);
    p.mp = Math.min(p.maxMp, p.mp + p.maxMp * REST.mpPerSec * dt);

    // 불을 피워 두는 값 — 연료가 3배로 탄다.
    // player.update 가 이미 1배를 태우므로 여기서 나머지 2배를 더 태운다.
    if (p.lantern && p.lantern.fuel > 0) {
      p.lantern.fuel = Math.max(0, p.lantern.fuel - dt * (REST.fuelMul - 1));
    }

    // 불꽃이 흔들린다. 광원도 같이 흔들려야 벽에 그림자가 논다.
    const f = 0.86 + Math.sin(G.time * 9.3) * 0.09 + Math.sin(G.time * 21.7) * 0.05;
    this.flames[0].scale.set(f, 0.9 + f * 0.2, f);
    this.flames[1].scale.set(f * 0.9, 0.95 + f * 0.15, f * 0.9);
    this.light.intensity = 46 * f * Math.min(1, this.t / 0.4);
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }
}
