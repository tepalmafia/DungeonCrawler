// ══════════════════════════════════════════════════════════════════════════
//  스페이스워 — 진입점
//
//  ★ 지금 여기 있는 것은 **1단계**다 (docs/space/PLAN.md §13).
//    「조종석에 선다 → 계기가 오른다 → 통로를 걸어간다 → 기관실 밸브를
//    돌린다 → 계기가 내려간다.」 이것 하나만 끝까지 돈다.
//    추격도 채굴도 거점도 없다. **세로로 한 줄을 먼저 끝낸다.**
//
//  ★ VERSION 과 index.html 의 ?v= 는 항상 같이 올린다
//      node tools/bump-version.js space 2
//    어긋나면 브라우저가 파일마다 제각각 갱신돼, 화면에는 새 버전이라
//    찍히면서 그 버전의 변경은 적용되지 않는다. 앞 게임에서 세 번 났다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { preload } from './core/assets.js';
import { Input } from './core/input.js';
import { buildShip, inside, roomAt } from './world/ship.js';
import { BODY, HEAT, VALVE } from './game/systems-table.js';

export const VERSION = 3;

const canvas = document.getElementById('view');
const cross = document.getElementById('cross');
const hint = document.getElementById('hint');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(0x03040a);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 400);

// 그림 통로를 **게임 로직보다 먼저** 연다 (docs/POSTMORTEM.md §2 0단계).
// 한 장도 없어도 정상으로 끝나고, 배는 민무늬로 선다.
await preload();

// ★ 환경맵 — **금속이 검게 나오지 않게 하는 것.**
//   반응로를 세웠더니 새까만 덩어리로 나왔다. 조명이 모자란 게 아니라,
//   three 에서 metalness 가 높은 재질은 **반사할 환경이 없으면 검다.**
//   세기를 올려도 안 바뀐다 — 포스트모템 §1-④ 의 「계수를 만지지 말고
//   값을 찍는다」가 정확히 이런 경우다.
//   실내라 하늘이 없으므로, 위아래 밝기만 있는 아주 싼 환경을 만들어 준다.
function makeEnvironment(renderer) {
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, '#4a5666');      // 천장 쪽 — 밝다
  g.addColorStop(0.5, '#232a33');
  g.addColorStop(1, '#0e1114');      // 바닥 쪽 — 어둡다
  c.fillStyle = g; c.fillRect(0, 0, 16, 64);
  const tex = new THREE.CanvasTexture(cv);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return env;
}
scene.environment = makeEnvironment(renderer);
scene.environmentIntensity = 0.55;

const ship = buildShip(scene);
const input = new Input(canvas);

// ── 상태 ────────────────────────────────────────────────────
const me = {
  x: 0, z: -6.5,          // 조종석에서 시작한다
  vx: 0, vz: 0,
  yaw: 0, pitch: 0,       // yaw 0 = -z 방향 = 창 쪽
};
let heat = HEAT.start;
let turn = 0;             // 밸브를 얼마나 돌렸나 (0~1)
let clock = 0;            // 켠 뒤 흐른 초 — 화면이 살아 있어 보이게 하는 데 쓴다

const ray = new THREE.Raycaster();
const CENTER = new THREE.Vector2(0, 0);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ── 걷기 ────────────────────────────────────────────────────
// x 와 z 를 **따로** 밀어 본다. 같이 밀면 벽에 비스듬히 닿았을 때
// 통째로 막혀서 「벽에 붙으면 못 움직인다」가 된다.
function walk(dt) {
  const { f, r } = input.move();
  const sin = Math.sin(me.yaw), cos = Math.cos(me.yaw);
  // yaw 0 일 때 앞은 -z
  const wantX = (-sin * f + cos * r) * BODY.speed;
  const wantZ = (-cos * f - sin * r) * BODY.speed;

  const k = Math.min(1, BODY.accel * dt);
  me.vx += (wantX - me.vx) * k;
  me.vz += (wantZ - me.vz) * k;

  const nx = me.x + me.vx * dt;
  if (inside(nx, me.z, BODY.radius)) me.x = nx; else me.vx = 0;
  const nz = me.z + me.vz * dt;
  if (inside(me.x, nz, BODY.radius)) me.z = nz; else me.vz = 0;
}

// ── 밸브 ────────────────────────────────────────────────────
// **잡고 돌린다.** 놓으면 되돌아온다 — 뻑뻑함이 이 게임의 손맛이다
// (docs/space/PLAN.md §8).
function valveStep(dt) {
  ray.setFromCamera(CENTER, camera);
  const hit = ray.intersectObject(ship.valve, true)[0];
  const near = hit && hit.distance <= BODY.reach;

  if (near && input.hold) turn = Math.min(1, turn + dt / VALVE.turnTime);
  else turn = Math.max(0, turn - VALVE.slip * dt);

  ship.wheel.parent.rotation.z = -turn * Math.PI * 2.2;
  cross.classList.toggle('on', !!near);
  return turn >= VALVE.openAt;
}

// ── 열 ──────────────────────────────────────────────────────
function heatStep(dt, cooling) {
  heat += (cooling ? -HEAT.fall : HEAT.rise) * dt;
  heat = Math.max(0, Math.min(HEAT.max, heat));

  // 조종석 화면들 — 계기는 UI 가 아니라 **콘솔에 박힌 물건**이다.
  // 여섯 장을 매 프레임 다시 그린다 (캔버스라 싸다)
  ship.cock.update({ heat, cooling, room: roomAt(me.x, me.z), t: clock });

  // 기관실 등이 붉어진다 — **계기를 안 봐도 뜨거운 걸 안다**
  const hot = Math.max(0, (heat - HEAT.warn) / (HEAT.max - HEAT.warn));
  ship.lampEngine.color.setHSL(0.09 - 0.09 * hot, 0.55 + 0.4 * hot, 0.5);
  ship.lampEngine.intensity = 60 + 70 * hot;
  ship.lampEngine2.color.copy(ship.lampEngine.color);
  ship.lampEngine2.intensity = 34 + 40 * hot;
  ship.matEngine.emissive?.setHSL(0.03, 0.9, 0.14 * hot);
  // 반응로가 스스로 달아오른다 — 기관실에 들어서는 순간 눈에 들어와야 한다
  ship.coreGlow.material.color.setHSL(0.09 - 0.09 * hot, 0.85, 0.45 + 0.35 * hot);
  ship.lampCore.color.copy(ship.coreGlow.material.color);
  ship.lampCore.intensity = 8 + 22 * hot;
}

// 화면 확인용 손잡이. **게임 로직은 이걸 안 쓴다** — 스크린샷을 찍고
// 「지금 열이 몇인가」를 밖에서 물어보려고 낸 구멍이다.
// 손으로 20분 돌려 보는 것을 대신하지는 못한다 (docs/POSTMORTEM.md §1-③).
window.SPACE = {
  get version() { return VERSION; },
  get heat() { return heat; },
  get turn() { return turn; },
  get room() { return roomAt(me.x, me.z); },
  put(x, z, yaw = 0, pitch = 0) { me.x = x; me.z = z; me.yaw = yaw; me.pitch = pitch; me.vx = me.vz = 0; },
  setHeat(v) { heat = v; },
};

// ── 루프 ────────────────────────────────────────────────────
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;

  const look = input.takeLook();
  me.yaw -= look.dx * 0.0022;
  me.pitch = Math.max(-1.35, Math.min(1.35, me.pitch - look.dy * 0.0022));

  walk(dt);

  camera.position.set(me.x, BODY.eye, me.z);
  camera.rotation.set(0, 0, 0, 'YXZ');
  camera.rotation.y = me.yaw;
  camera.rotation.x = me.pitch;

  const cooling = valveStep(dt);
  heatStep(dt, cooling);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 잠금 안내는 처음 한 번만. 잠기면 사라진다
setInterval(() => { hint.hidden = input.locked; }, 200);

console.log(`스페이스워 v${VERSION} — ${roomAt(me.x, me.z)} 에서 시작`);
