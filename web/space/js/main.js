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

export const VERSION = 1;

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

  const t = heat / HEAT.max;

  // 계기 — 왼쪽 끝을 고정하고 길이만 준다. 가운데를 잡고 늘리면
  // 양쪽으로 자라서 「눈금」으로 안 읽힌다
  const full = ship.needle.userData.full;
  ship.needle.scale.x = Math.max(0.001, t);
  ship.needle.position.x = -full / 2 + (full * t) / 2;
  // 색은 **경고 구간부터** 돈다. 처음에 0 부터 선형으로 깎았더니
  // 시작 열(34)에서 이미 노랬다 — 늘 노란 계기는 경고가 아니다.
  const alarm = Math.max(0, (heat - HEAT.warn * 0.7) / (HEAT.max - HEAT.warn * 0.7));
  ship.needleMat.color.setHSL(0.36 * (1 - alarm), 0.7, 0.55);

  // 기관실 등이 붉어진다 — **계기를 안 봐도 뜨거운 걸 안다**
  const hot = Math.max(0, (heat - HEAT.warn) / (HEAT.max - HEAT.warn));
  ship.lampEngine.color.setHSL(0.09 - 0.09 * hot, 0.55 + 0.4 * hot, 0.5);
  ship.lampEngine.intensity = 60 + 70 * hot;
  ship.lampEngine2.color.copy(ship.lampEngine.color);
  ship.lampEngine2.intensity = 34 + 40 * hot;
  ship.matEngine.emissive?.setHSL(0.03, 0.9, 0.14 * hot);
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
