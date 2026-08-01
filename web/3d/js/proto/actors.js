// 캐릭터 시제품 — 개선 전/후를 **같은 조명·같은 카메라·같은 타이밍**으로 나란히 돌린다.
//
// 말로 「좋아졌다」고 하면 확인할 방법이 없다. 옆에 붙여 놓고 같은 동작을
// 같은 순간에 시키면 차이가 눈으로 남는다. 그래서 이 페이지의 규칙은 하나다:
// **두 열이 공유하지 않는 변수는 리그와 포저뿐이다.**

import * as THREE from 'three';
import { BUILDERS } from '../core/models.js';
import { Pose } from '../core/rig.js';
import { poseHumanoid, STANCE } from '../core/anim.js';
import { oldKnight, oldSkeleton, oldGhoul, oldArcher, oldGolem, oldKnightBody, oldEnemyBody } from './oldrigs.js';

const OLD = {
  knight: oldKnight, skeleton: oldSkeleton, ghoul: oldGhoul, archer: oldArcher, golem: oldGolem,
};

export const CAST = [
  { key: 'knight', label: '기사', sub: '플레이어', h: 1.75, dist: 3.5, scale: 1.0 },
  { key: 'skeleton', label: '해골 병사', sub: '근접 · 느림', h: 1.65, dist: 3.4, scale: 1.0 },
  { key: 'ghoul', label: '구울', sub: '근접 · 빠름', h: 1.15, dist: 2.9, scale: 1.05 },
  { key: 'archer', label: '망령 궁수', sub: '원거리', h: 1.55, dist: 3.3, scale: 1.0 },
  { key: 'golem', label: '석상 골렘', sub: '근접 · 육중', h: 2.1, dist: 4.4, scale: 1.0 },
];

// 한 바퀴 도는 순서와 길이. 실제 게임 속도와 같게 잡는다 —
// 시제품에서만 느리게 돌리면 「좋아 보이는데 게임에선 안 보이는」 개선이 된다.
export const TIMELINE = [
  { clip: 'idle', dur: 3.0, name: '대기', note: '호흡 + 무게중심 이동' },
  { clip: 'walk', dur: 3.2, name: '이동', note: '무릎 · 골반 반대비틀림' },
  { clip: 'attack', dur: 3.6, name: '공격', note: '예비 → 정지 → 타격 → 여운' },
  { clip: 'hit', dur: 3.0, name: '피격', note: '방향 · 지연 · 튕김' },
  { clip: 'die', dur: 2.4, name: '죽음', note: '무릎 → 골반 → 상체' },
];
export const CYCLE = TIMELINE.reduce((a, s) => a + s.dur, 0);

/** 지금이 어느 동작의 몇 초째인가 */
export function phaseAt(t) {
  let u = t % CYCLE;
  for (const s of TIMELINE) {
    if (u < s.dur) return { ...s, t: u };
    u -= s.dur;
  }
  return { ...TIMELINE[0], t: 0 };
}

// ── 동작을 ctx 로 바꾼다 ────────────────────────────────────
// 옛 포저와 새 포저는 규약이 다르다(swing 은 1→0, armX 는 각도). 여기서 한 번에
// 만들어 **두 열에 똑같이** 넘긴다 — 타이밍이 다르면 비교가 성립하지 않는다.
export const ATK_PERIOD = 1.2;
export const ATK_SWING = 0.95;      // 1.2 초 중 0.95 초 휘두르고 0.25 초 쉰다
export const HIT_PERIOD = 1.0;
export const HIT_DUR = 0.42;
export const DIE_DUR = 1.3;

/**
 * 「이 동작의 u 지점」을 전체 시계의 시각으로 바꾼다.
 *
 * 캡처 도구가 쓴다. 처음에는 구간 길이(3.6초)에 그냥 비율을 곱했는데,
 * 공격은 그 안에서 1.2초마다 반복하므로 0.3 을 주면 **두 번째 휘두르기의
 * 쉬는 구간**에 떨어졌다. 그래서 「공격 컷」에 가만히 선 캐릭터가 찍혔다.
 * 동작마다 실제 반복 주기가 다르다는 걸 여기서 한 번에 다룬다.
 */
export function timeFor(clip, u) {
  const idx = TIMELINE.findIndex((s) => s.clip === clip);
  if (idx < 0) return 0;
  const before = TIMELINE.slice(0, idx).reduce((a, s) => a + s.dur, 0);
  const inner = clip === 'attack' ? u * ATK_SWING
    : clip === 'hit' ? u * HIT_DUR
      : clip === 'die' ? u * DIE_DUR
        : u * TIMELINE[idx].dur;
  return before + inner;
}

export function ctxFor(ph, dt, walkT) {
  const c = {
    dt, moving: 0, moved: 0, walkT, facing: 0, bobPhase: 0,
    swing: 0, armX: 0, atk: 0, hitT: 0, hitDirX: 0, hitDirZ: 1, hitPow: 1, hitDur: HIT_DUR,
    dieK: 0, time: 0,
  };
  if (ph.clip === 'walk') { c.moving = 1; c.moved = 1; }
  if (ph.clip === 'attack') {
    const u = (ph.t % ATK_PERIOD) / ATK_SWING;
    if (u < 1) {
      c.atk = u;
      c.swing = 1 - u;                             // 옛 기사 규약
      // 옛 적 규약 — windup 0.45 / attack 0.1 / recover 0.85 를 흉내낸다
      c.armX = u < 0.32 ? -1.5 * (u / 0.32) : u < 0.4 ? 1.15 : 1.15 * (1 - (u - 0.4) / 0.6);
    }
  }
  if (ph.clip === 'hit') {
    const n = Math.floor(ph.t / HIT_PERIOD);
    const u = ph.t % HIT_PERIOD;
    if (u < HIT_DUR) {
      c.hitT = HIT_DUR - u;
      // 정면 → 오른쪽 → 뒤. 방향이 안 보이면 방향성이 있다고 말할 수 없다
      const d = [[0, 1], [1, 0.2], [0, -1]][n % 3];
      c.hitDirX = d[0]; c.hitDirZ = d[1];
    }
  }
  if (ph.clip === 'die') c.dieK = Math.min(1, ph.t / 1.3);
  return c;
}

// ── 한 칸 ────────────────────────────────────────────────────
function makeScene(cast, mode) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(mode === 'new' ? 0x0d0b13 : 0x0a0910);

  // 조명 — 게임과 같은 구성(횃불 + 차가운 달빛 + 약한 앰비언트)이되,
  // **횃불색을 게임만큼 진하게 쓰지 않는다.** 첫 판에서 그렇게 찍었더니 다섯이
  // 전부 같은 갈색으로 나왔다. 강철도 뼈도 이끼도 구분이 안 됐다.
  // 시제품의 일은 「던전에서 어떻게 보이나」가 아니라 「무엇을 만들었나」를
  // 보이는 것이라, 재질색이 살아남는 선까지 등불을 물린다.
  // 주광은 **카메라 쪽**에 둔다. 반대편에 뒀더니 다섯 모두 앞면이 그늘에 들어가
  // 검은 덩어리로 찍혔다 — 관절을 늘려 놓고 관절이 안 보이면 아무 의미가 없다.
  scene.add(new THREE.HemisphereLight(0x3f3858, 0x100d18, 0.85));
  const key = new THREE.PointLight(0xffe2c4, 30, 18, 2);
  key.position.set(-2.2, 3.1, 2.8);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xa8c0f0, 1.9);   // 역광 — 실루엣을 세운다
  rim.position.set(2.8, 2.4, -3.2);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xc8d0e0, 0.6);
  fill.position.set(2.2, 1.2, 2.4);
  scene.add(fill);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 32),
    new THREE.MeshStandardMaterial({ color: 0x2a2530, roughness: 0.9, metalness: 0.05 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // 카메라는 **캐릭터의 오른쪽 앞**에 둔다. 무기 손이 −X 이므로 +X 에서 보면
  // 방패와 등만 보인다 — 첫 판에서 기사의 검이 한 컷에도 안 나왔다.
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  camera.position.set(-cast.dist * 0.66, cast.h * 0.72 + 0.45, cast.dist * 0.95);
  camera.lookAt(0, cast.h * 0.48, 0);

  const rig = (mode === 'new' ? BUILDERS : OLD)[cast.key]();
  rig.group.scale.setScalar(cast.scale);
  scene.add(rig.group);

  const holder = { scene, camera, rig, key, cast, mode, walkT: 0, tris: 0, meshes: 0 };
  if (mode === 'new') holder.pose = new Pose(rig);
  // 개선 전 리그는 죽음·피격을 **포저가 아니라 update() 가** 만들었다.
  // 그 코드를 여기서 재현한다 — 그래야 「예전에는 이랬다」가 정직하다.
  holder.baseScale = cast.scale;

  rig.group.traverse((o) => {
    if (!o.isMesh) return;
    holder.meshes++;
    const idx = o.geometry.index;
    holder.tris += idx ? idx.count / 3 : o.geometry.attributes.position.count / 3;
  });
  return holder;
}

export function makePanels() {
  const out = [];
  for (const cast of CAST) {
    for (const mode of ['old', 'new']) out.push(makeScene(cast, mode));
  }
  return out;
}

// ── 한 프레임 ────────────────────────────────────────────────
export function stepPanel(p, ph, c, dt, t) {
  const rig = p.rig;
  if (p.mode === 'new') {
    // 죽음은 자세를 만들고 나면 몸이 그대로 남는다 — 시체가 그 자리에 눕는다
    poseHumanoid(rig, p.pose, STANCE[rig.stance] || STANCE.knight, { ...c, time: t });
    return;
  }

  // ── 개선 전 ──
  if (ph.clip === 'die') {
    // 게임의 옛 죽음 연출: 기사는 z 로 90도, 적은 줄어들며 가라앉는다
    if (p.cast.key === 'knight') {
      rig.group.rotation.z = Math.PI * 0.42 * Math.min(1, c.dieK * 1.4);
    } else {
      const k = Math.max(0.02, 1 - c.dieK);
      rig.group.scale.setScalar(p.baseScale * k);
      rig.group.rotation.z += dt * 6;
      rig.group.position.y = (1 - k) * -0.6;
    }
    return;
  }
  rig.group.rotation.z = 0;
  rig.group.scale.setScalar(p.baseScale);
  rig.group.position.set(0, 0, 0);

  if (p.cast.key === 'knight') oldKnightBody(rig, c);
  else oldEnemyBody(rig, t, 0, c);

  // 옛 피격 = **관절 반응 없음.** 몸통 전체가 밀리고 납작해질 뿐이었다
  // (enemies.js 의 recoil 분기). 그것도 그대로 재현한다.
  if (c.hitT > 0) {
    const k = c.hitT / HIT_DUR;
    rig.group.position.x = -c.hitDirX * 0.13 * k;
    rig.group.position.z = -c.hitDirZ * 0.13 * k;
    const s = p.baseScale;
    rig.group.scale.set(s * (1 + 0.1 * k), s * (1 - 0.14 * k), s * (1 + 0.1 * k));
  }
}
