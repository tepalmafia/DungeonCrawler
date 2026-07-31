// 조명 — 「디아블로 느낌」의 8할이 여기서 나온다.
//
// 제약과 해법:
//  · PointLight 그림자는 큐브맵 6패스라 여러 개 켜면 프레임이 무너진다
//      → 그림자 캐스터는 DirectionalLight 딱 1개(어두운 달빛). 나머지는 그림자 없음.
//  · three.js 는 씬의 광원 "개수"가 바뀌면 셰이더를 재컴파일해 끊김이 생긴다
//      → 횃불 광원 8개를 고정 풀로 유지하고 위치·강도만 바꾼다.
//  · r185 는 물리 조명 단위다 (useLegacyLights 제거)
//      → PointLight intensity 는 20~60, decay = 2 가 기준. 예전 감각인 1.0 이면 새까맣다.

import * as THREE from 'three';

const POOL = 8;              // 동시에 켜지는 횃불 수 (고정)
const TORCH_RANGE = 30;      // 이 거리 밖 횃불은 강도 0 (개수는 그대로)

export class Lighting {
  constructor(scene, theme) {
    this.scene = scene;
    this.theme = theme;

    // 앰비언트는 「완전 검정 방지」 수준이어야 한다.
    // 이게 높으면 랜턴이 없어도 방이 다 보여서 빛이 자원이 되지 못한다
    // (docs/DUNGEON-INTERACTIONS.md §1-1). B안의 요철은 횃불·랜턴이 만드는
    // 밝은 웅덩이 안에서 드러나면 된다 — 오히려 그쪽이 더 극적이다.
    this.hemi = new THREE.HemisphereLight(0x272038, 0x08060d, 0.26);
    scene.add(this.hemi);

    // 유일한 그림자 캐스터. 차가운 달빛이라 따뜻한 횃불과 대비된다.
    this.moon = new THREE.DirectionalLight(0x8296c8, 0.34);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(1024, 1024);
    const c = this.moon.shadow.camera;
    c.left = -14; c.right = 14; c.top = 14; c.bottom = -14;
    c.near = 1; c.far = 46;
    this.moon.shadow.bias = -0.0016;
    this.moon.shadow.normalBias = 0.035;
    scene.add(this.moon);
    scene.add(this.moon.target);

    // 플레이어 등불 — 세기·반경·색을 랜턴이 정한다 (game/lantern.js).
    // 기본값은 어그로 반경보다 좁다: 어둠이 위협이어야 랜턴이 보상이 된다.
    this.lamp = { radius: 9, intensity: 34, color: null };
    this.playerLamp = new THREE.PointLight(theme.torch, this.lamp.intensity, this.lamp.radius, 2);
    scene.add(this.playerLamp);

    // 횃불 풀 — 개수 불변
    this.pool = [];
    for (let i = 0; i < POOL; i++) {
      const l = new THREE.PointLight(theme.torch, 0, 18, 2);
      l.position.set(0, 2.2, 0);
      scene.add(l);
      this.pool.push({ light: l, torch: null, level: 0 });
    }

    // 스킬·폭발용 임시 광원 2개 (역시 개수 고정)
    this.fxLights = [];
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 14, 2);
      scene.add(l);
      this.fxLights.push({ light: l, life: 0, max: 1, peak: 0 });
    }
  }

  setTorches(torches) { this.torches = torches || []; }

  /** 랜턴이 바뀌면 호출. 반경·세기·색을 갈아끼운다. */
  setLamp({ radius, intensity, color }) {
    this.lamp.radius = radius;
    this.lamp.intensity = intensity;
    this.lamp.color = color;
    this.playerLamp.distance = radius;
    this.playerLamp.color.set(color ?? this.theme.torch);
  }

  /** 한 번 번쩍이는 광원 (폭발·시전) */
  flash(pos, color, intensity = 90, dur = 0.35) {
    const slot = this.fxLights.reduce((a, b) => (a.life < b.life ? a : b));
    slot.light.position.copy(pos);
    slot.light.color.set(color);
    slot.peak = intensity;
    slot.max = dur;
    slot.life = dur;
  }

  update(t, dt, playerPos) {
    // 달빛은 플레이어를 따라다닌다 — 그림자 카메라를 좁게 유지해 해상도를 아낀다
    this.moon.position.set(playerPos.x + 9, 22, playerPos.z + 7);
    this.moon.target.position.copy(playerPos);
    this.moon.target.updateMatrixWorld();

    // 플레이어 광원: 살짝 흔들려야 횃불처럼 보인다
    const flick = 1 + Math.sin(t * 11.3) * 0.05 + Math.sin(t * 27.7) * 0.03;
    this.playerLamp.position.set(playerPos.x, 1.9, playerPos.z);
    this.playerLamp.intensity = this.lamp.intensity * flick;

    // ── 가까운 횃불 8개를 풀에 배정 ────────────────────────
    if (this.torches && this.torches.length) {
      const near = [];
      for (const tr of this.torches) {
        const d = tr.pos.distanceTo(playerPos);
        if (d < TORCH_RANGE) near.push({ tr, d });
      }
      near.sort((a, b) => a.d - b.d);
      const chosen = near.slice(0, POOL);

      // 이미 배정된 횃불은 슬롯을 유지 → 광원이 튀지 않는다
      const keep = new Set(chosen.map((c) => c.tr));
      for (const s of this.pool) if (s.torch && !keep.has(s.torch)) s.torch = null;
      for (const c of chosen) {
        if (this.pool.some((s) => s.torch === c.tr)) continue;
        const free = this.pool.find((s) => !s.torch);
        if (free) { free.torch = c.tr; free.light.position.copy(c.tr.pos); }
      }

      for (const s of this.pool) {
        // 거리에 따라 강도를 페이드 — 팝핑 방지
        let target = 0;
        if (s.torch) {
          const d = s.torch.pos.distanceTo(playerPos);
          const fade = 1 - Math.min(1, Math.max(0, (d - TORCH_RANGE * 0.7) / (TORCH_RANGE * 0.3)));
          const fl = 1 + Math.sin(t * 9 + s.torch.phase) * 0.13 + Math.sin(t * 19 + s.torch.phase * 2) * 0.07;
          // 연료를 뽑아 쓴 횃불은 사그라든다 — 지나온 길이 어두워진다
          target = 78 * fade * fl * (s.torch.spent ? 0.3 : 1);
          s.light.position.copy(s.torch.pos);
        }
        s.level += (target - s.level) * Math.min(1, dt * 7);
        s.light.intensity = s.level;
      }
    }

    // 임시 광원 감쇠
    for (const s of this.fxLights) {
      if (s.life <= 0) { s.light.intensity = 0; continue; }
      s.life -= dt;
      const k = Math.max(0, s.life / s.max);
      s.light.intensity = s.peak * k * k;
    }
  }

  dispose() {
    for (const s of this.pool) this.scene.remove(s.light);
    for (const s of this.fxLights) this.scene.remove(s.light);
    this.scene.remove(this.hemi, this.moon, this.moon.target, this.playerLamp);
  }
}
