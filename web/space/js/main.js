// ══════════════════════════════════════════════════════════════════════════
//  스페이스워 — 진입점
//
//  ★ 지금 여기 있는 것은 **2단계**다 (docs/space/PLAN.md §13).
//    「접촉 → 자국이 오른다 → 전력을 옮긴다 → 뿌리친다」 하나가 끝까지 돈다.
//    계통은 전력·열·자국 셋뿐이고 채굴도 거점도 식량도 없다.
//
//    **이 단계가 판가름이다.** 여기서 재미없으면 PLAN §7(도망)을 통째로
//    다시 짠다 — 방을 다 꾸민 뒤에 알면 늦다.
//
//  ★ VERSION 과 index.html 의 ?v= 는 항상 같이 올린다
//      node tools/bump-version.js space 2
//    어긋나면 브라우저가 파일마다 제각각 갱신돼, 화면에는 새 버전이라
//    찍히면서 그 버전의 변경은 적용되지 않는다. 앞 게임에서 세 번 났다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { preload } from './core/assets.js';
import { Input } from './core/input.js';
import { buildShip, inside, roomAt, BLOCKERS, ROOMS } from './world/ship.js';
import { BODY, HEAT, VALVE, CRUISE } from './game/systems-table.js';
import { REGIONS, REGION_BY_KEY, REGION_SECONDS } from './game/regions-table.js';
import { CIRCUITS, POWER_MAX, SIGN, CHASE as CH } from './game/chase-table.js';
import { makeChase, stepChase, resetChase, heatRate, canTurnOn, powerCount, PHASE } from './game/chase.js';

export const VERSION = 13;

const canvas = document.getElementById('view');
const cross = document.getElementById('cross');
const hint = document.getElementById('hint');
const hud = document.getElementById('hud');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(0x03040a);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
// ★ 그림자. **이게 없어서 모든 물건이 붕 떠 보였다.**
//   코드만으로 되는 것 중 화면에 값이 제일 크다 — 그림 한 장 없이도
//   물건이 바닥에 「놓인」 것으로 보이기 시작한다.
//   PCFSoft 는 가장자리를 부드럽게 한다. 딱딱한 그림자는 종이 오린 것 같다.
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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
scene.environmentIntensity = 0.75;

const ship = buildShip(scene);
const input = new Input(canvas);

// ── 상태 ────────────────────────────────────────────────────
const me = {
  // ★ 처음엔 -6.5 였다. 좌석 바로 뒤라 켜자마자 W 를 누르면 좌석에 막힌다 —
  //   시작하자마자 「안 움직인다」로 읽힌다. 한 걸음 뒤로 물렸다.
  x: 0, z: -5.4,          // 조종석에서 시작한다
  vx: 0, vz: 0,
  yaw: 0, pitch: 0,       // yaw 0 = -z 방향 = 창 쪽
};
let heat = HEAT.start;
let turn = 0;             // 밸브를 얼마나 돌렸나 (0~1)
let coolFor = 0;          // 밸브가 걸려서 냉각이 열려 있는 남은 초
let clock = 0;            // 켠 뒤 흐른 초 — 화면이 살아 있어 보이게 하는 데 쓴다
// 검사용 구역 고정. **게임은 안 쓴다** — 자동 순환이 매 프레임 덮어쓰기
// 때문에, 밖에서 구역을 정해 놓고 화면을 찍으려면 이게 필요하다.
let regionPin = null;

// ── 2단계 · 추격 ────────────────────────────────────────────
// 전력은 하나인데 쓸 곳이 셋이고 **둘만** 켤 수 있다 (PLAN §7-0 축①).
// 처음엔 추진·냉각을 켜 둔다 — 센서가 꺼져 있어서 「상대가 안 보인다」를
// 처음부터 몸으로 알게 된다.
const power = { thrust: true, cool: true, sensor: false };
const chase = makeChase();
let flash = 0;            // 경보 깜빡임
let banner = '';          // 화면 한복판에 잠깐 뜨는 글자
let bannerT = 0;

const ray = new THREE.Raycaster();
const CENTER = new THREE.Vector2(0, 0);

// ── 후처리 ──────────────────────────────────────────────────
// ★ 블룸 — **스스로 빛나는 것들이 실제로 빛나 보이게** 한다.
//   띠조명·화면·반응로는 지금 그냥 밝은 색 판때기다. 어두운 배 안에서
//   빛나는 물건이 번지지 않으면 「빛」이 아니라 「스티커」로 읽힌다.
//
//   threshold 를 0.72 로 둔다. 낮추면 벽까지 번져서 안개 낀 것처럼 되고,
//   높이면 화면 글자가 안 빛난다.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// ★ 세기를 0.62 → 0.48 로 낮췄다. 반응로처럼 밝은 금속 덩어리 앞에 서면
//   화면이 통째로 하얗게 탔다 — 「빛난다」가 아니라 「안 보인다」가 된다.
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.48, 0.45, 0.76);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = innerWidth, h = innerHeight;
  const dpr = Math.min(devicePixelRatio, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(dpr);
  composer.setSize(w, h);
  bloom.setSize(w, h);
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

// ── 손이 닿는 것들 ──────────────────────────────────────────
// **잡고 돌리는 것**(밸브)과 **누르는 것**(차단기)이 다르다.
// 밸브는 끝까지 돌리는 데 시간이 들고, 차단기는 딸깍 하고 넘어간다.
// 둘을 같은 방식으로 만들면 손맛이 하나로 뭉개진다 (PLAN §8).
let aimName = null;
function interactStep(dt) {
  ray.setFromCamera(CENTER, camera);

  // 조준선에 뭐가 걸리나. 가까운 것 하나만 본다
  const targets = [ship.valve, ...ship.breakers.map((b) => b.hit)];
  const hit = ray.intersectObjects(targets, true)[0];
  const near = hit && hit.distance <= BODY.reach;

  // 어느 것에 걸렸는지 — 부모를 타고 올라가며 찾는다
  let onValve = false;
  let breaker = null;
  if (near) {
    for (let o = hit.object; o; o = o.parent) {
      if (o === ship.valve) { onValve = true; break; }
      const b = ship.breakers.find((x) => x.hit === o);
      if (b) { breaker = b; break; }
    }
  }

  // 밸브 — 잡고 돌린다. 놓으면 되돌아온다. **끝까지 돌리면 걸린다**
  if (onValve && input.hold) turn = Math.min(1, turn + dt / VALVE.turnTime);
  else turn = Math.max(0, turn - VALVE.slip * dt);
  if (turn >= VALVE.openAt) { coolFor = VALVE.holds; turn = 0; }
  coolFor = Math.max(0, coolFor - dt);
  ship.wheel.parent.rotation.z -= (turn > 0 ? dt * 2.6 : 0) + (coolFor > 0 ? dt * 0.5 : 0);

  // 차단기 — 누르는 순간에만 넘어간다
  const pressed = input.takePress();
  if (breaker && pressed) {
    if (power[breaker.key]) power[breaker.key] = false;
    else if (canTurnOn(power)) power[breaker.key] = true;
    else {
      // ★ 꽉 찼을 때 **조용히 아무 일도 안 일어나면** 고장인 줄 안다.
      //   무엇이 막았는지 글자로 말해 준다 — 규칙을 알아맞히게 하지 않는다
      banner = `전력이 모자랍니다 — 셋 중 ${POWER_MAX}개만`;
      bannerT = 1.6;
    }
  }

  // 레버 각도와 불
  for (const b of ship.breakers) {
    const on = power[b.key];
    b.lever.rotation.x += ((on ? -0.5 : 0.5) - b.lever.rotation.x) * Math.min(1, dt * 14);
    b.lampMat.color.set(on ? b.tint : 0x2a2f36);
  }

  aimName = onValve ? 'valve' : (breaker ? breaker.key : null);
  cross.classList.toggle('on', !!(onValve || breaker));
  return coolFor > 0;
}

// ── 열 · 자국 · 추격 ────────────────────────────────────────
function systemsStep(dt, valveOpen, regionMult) {
  // 열은 이제 **켠 회로**가 정한다. 추진을 켜면 오르고, 냉각을 켜면 내려간다.
  // 다만 냉각 회로만으로는 절반뿐이라 **기관실 밸브까지 열어야** 제대로 잡힌다
  heat += heatRate(power, valveOpen) * dt;
  heat = Math.max(0, Math.min(HEAT.max, heat));

  const was = chase.phase;
  const ev = stepChase(chase, dt, power, heat, regionMult);
  if (ev === 'contact') { banner = '접촉 — 무언가 따라붙었습니다'; bannerT = 2.6; }
  if (ev === 'escaped') { banner = '뿌리쳤습니다'; bannerT = 3.2; }
  if (ev === 'caught') { banner = '잡혔습니다'; bannerT = 3.2; }
  void was;

  // 경보 — 추격 중에만. 거리가 가까울수록 빨라진다 (PLAN §3-1 글로 안 알려준다)
  if (chase.phase === PHASE.CHASE) {
    const urgency = 1 - chase.dist / CH.escapeAt;
    flash += dt * (2.2 + urgency * 6);
    ship.alarm.intensity = (0.5 + 0.5 * Math.sin(flash * Math.PI * 2)) * (14 + urgency * 34);
  } else {
    ship.alarm.intensity += (0 - ship.alarm.intensity) * Math.min(1, dt * 3);
  }

  // 기관실이 열에 따라 달아오른다
  const hot = Math.max(0, (heat - HEAT.warn) / (HEAT.max - HEAT.warn));
  ship.lampEngine.color.setHSL(0.09 - 0.09 * hot, 0.55 + 0.4 * hot, 0.5);
  ship.lampEngine.intensity = 74 + 90 * hot;
  ship.matEngine.emissive?.setHSL(0.03, 0.9, 0.14 * hot);
  ship.coreGlow.material.color.setHSL(0.09 - 0.09 * hot, 0.85, 0.45 + 0.35 * hot);
  ship.lampCore.color.copy(ship.coreGlow.material.color);
  ship.lampCore.intensity = 8 + 22 * hot;

  // 조종석 화면들 — 계기는 UI 가 아니라 **콘솔에 박힌 물건**이다
  ship.cock.update({
    heat, cooling: valveOpen && power.cool, room: roomAt(me.x, me.z), t: clock,
    region: ship.outside.region, power, chase,
  });
}

// 화면 확인용 손잡이. **게임 로직은 이걸 안 쓴다** — 스크린샷을 찍고
// 「지금 열이 몇인가」를 밖에서 물어보려고 낸 구멍이다.
// 손으로 20분 돌려 보는 것을 대신하지는 못한다 (docs/POSTMORTEM.md §1-③).
window.SPACE = {
  get version() { return VERSION; },
  get heat() { return heat; },
  get turn() { return turn; },
  get coolFor() { return +coolFor.toFixed(1); },
  room(x, z) { return roomAt(x ?? me.x, z ?? me.z); },
  get rooms() { return ROOMS.map((r) => ({ key: r.key, name: r.name })); },
  put(x, z, yaw = 0, pitch = 0) { me.x = x; me.z = z; me.yaw = yaw; me.pitch = pitch; me.vx = me.vz = 0; },
  setHeat(v) { heat = v; },
  get pos() { return { x: +me.x.toFixed(3), z: +me.z.toFixed(3) }; },
  get locked() { return input.locked; },
  get blockers() { return BLOCKERS.length; },
  get region() { return ship.outside.region; },
  get power() { return { ...power }; },
  setPower(k, v) { if (v && !canTurnOn(power) && !power[k]) return false; power[k] = v; return true; },
  get chase() { return { phase: chase.phase, risk: +chase.risk.toFixed(1), dist: +chase.dist.toFixed(1), sign: +chase.sign.toFixed(1), runs: chase.runs }; },
  // ★ 100 으로는 안 붙는다. stepChase 가 **더한 뒤에** 견주므로 그 프레임에
  //   riskFall 이 빠져서 99.9 가 된다. 넉넉히 넘겨 놓는다.
  forceContact() { chase.risk = 200; },
  /** 지금 조준선에 뭐가 걸리나 — 검사용 */
  get aim() { return aimName; },
  resetChase() { resetChase(chase); },
  /** 거리를 밀어 놓고 「뿌리침·잡힘」이 실제로 나는지 보려고 낸 구멍 */
  setDist(v) { chase.dist = v; },
  setRegion(k, instant = true) { regionPin = k; ship.outside.setRegion(k, instant); },
  unpinRegion() { regionPin = null; },
  /** 그 자리에 설 수 있나 — 충돌 검사용. tools 가 점을 찍어 본다 */
  canStand(x, z) { return inside(x, z, BODY.radius); },
  /**
   * 무게 재기 — 무엇이 몇 개인가.
   * **fps 는 여기서 못 믿는다** (헤드리스는 소프트웨어 렌더라 1fps 다).
   * 대신 그리기 횟수·삼각형·조명 개수는 기계와 무관하게 같으므로,
   * 줄이기 전후를 **비교**하는 데는 쓸 수 있다.
   */
  get cost() {
    let lights = 0, meshes = 0;
    scene.traverse((o) => { if (o.isLight) lights++; if (o.isMesh) meshes++; });
    const i = renderer.info;
    return { 그리기: i.render.calls, 삼각형: i.render.triangles, 조명: lights, 물체: meshes, 프로그램: i.programs?.length ?? 0 };
  },
};

// ── 루프 ────────────────────────────────────────────────────
let last = performance.now();
function frame(now) {
  // ★ **아래끝을 0 으로 자른다.** 안 자르면 첫 프레임에서 음수가 나온다 —
  //   `last` 는 모듈이 끝날 때 performance.now() 로 잡는데,
  //   requestAnimationFrame 이 주는 `now` 는 **그 프레임이 시작된 시각**이라
  //   더 이를 수 있다. 실제로 -0.0017 이 나왔고, 그 때문에 clock 이 음수가
  //   되어 `Math.floor(clock/95) % 4` 가 **-1** 이 됐다. 배열의 -1 은
  //   undefined 라 첫 프레임에서 게임이 통째로 죽었다.
  //   화면은 까맣고 콘솔에만 한 줄 뜬다 — 원인을 짐작하기 제일 어려운 모양.
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  clock += dt;

  const look = input.takeLook();
  me.yaw -= look.dx * 0.0022;
  me.pitch = Math.max(-1.35, Math.min(1.35, me.pitch - look.dy * 0.0022));

  walk(dt);

  // ── 구역이 바뀐다 ──────────────────────────────────────
  // ★ 지금은 **시간으로만** 넘어간다. 항로를 고르는 것(관측실 해도대)이
  //   생기면 그쪽이 정한다. 임시라는 것을 여기 적어 둔다.
  // 나머지 연산은 음수를 만나면 음수를 돌려준다. dt 를 잘라 놨지만
  // 여기도 막아 둔다 — 배열 첨자는 한 번 음수가 되면 조용히 undefined 다
  const n = REGIONS.length;
  const want = regionPin
    ? REGION_BY_KEY[regionPin]
    : REGIONS[((Math.floor(clock / REGION_SECONDS) % n) + n) % n];
  if (want.key !== ship.outside.region) ship.outside.setRegion(want.key);

  // ── 배가 간다 ──────────────────────────────────────────
  // 창밖을 흘려보내고, 배가 미세하게 떤다. 둘 다 없으면 **정지 화면**이다.
  ship.outside.update(dt, CRUISE.speed);

  // 진동은 **아주 작게.** 1인칭에서 화면 흔들림은 조금만 넘겨도 멀미가 난다.
  // 「느껴지는데 뭔지 모르겠는」 정도가 맞다.
  const sh = CRUISE.shake * Math.sin(clock * CRUISE.shakeHz * Math.PI * 2);
  const sw = CRUISE.sway * Math.sin(clock * CRUISE.swayHz * Math.PI * 2);
  camera.position.set(me.x + sw * 0.4, BODY.eye + sh + sw * 0.25, me.z);
  camera.rotation.set(0, 0, 0, 'YXZ');
  camera.rotation.y = me.yaw;
  camera.rotation.x = me.pitch;
  camera.rotation.z = sw * 0.06;   // 아주 살짝 기운다

  const valveOpen = interactStep(dt);
  systemsStep(dt, valveOpen, want.signMult ?? 1);

  // 화면 한복판 글자 — 잠깐 떴다 사라진다
  if (bannerT > 0) {
    bannerT -= dt;
    hud.textContent = banner;
    hud.hidden = false;
  } else hud.hidden = true;

  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 잠금 안내는 처음 한 번만. 잠기면 사라진다
setInterval(() => { hint.hidden = input.locked; }, 200);

console.log(`스페이스워 v${VERSION} — ${roomAt(me.x, me.z)} 에서 시작`);
