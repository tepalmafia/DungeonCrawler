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
import { makeAudio } from './core/audio.js';
import { ESCAPE, SHAKE, envelope } from './game/audio-table.js';
import { buildShip, inside, roomAt, BLOCKERS, ROOMS } from './world/ship.js';
import { BODY, HEAT, VALVE, CRUISE } from './game/systems-table.js';
import { REGION_BY_KEY } from './game/regions-table.js';
import { CIRCUITS, POWER_MAX, SIGN, CHASE as CH, CAUGHT } from './game/chase-table.js';
import { makeChase, stepChase, resetChase, heatRate, canTurnOn, PHASE } from './game/chase.js';
import { LEG } from './game/route-table.js';
/** 자국은 열에 비례한다. 윈치의 자국 보탬을 열 단위로 환산하려고 쓴다 */
const SIGN_PER_HEAT = SIGN.perHeat;
import {
  makeRoute, stepRoute, chooseFork, contactAt, trackMult, signMult, isBlind,
  regionOf, progress, relieveEscape, legsLeft, RPHASE,
} from './game/route.js';
import { FAULT, BY_KEY } from './game/mission-table.js';
import { FOOD, WINCH, TRADE } from './game/supply-table.js';
import { HAZARD } from './game/hazard-table.js';
import {
  makeHazard, stepHazard, newLeg, incoming, warnLeft, clearOf, HPHASE,
} from './game/hazard.js';
import {
  makeSupply, stepSupply, winchStep, canTrade, trade, canRepair, spendParts,
  shaky, slipMult, legsLeftOnFood,
} from './game/supply.js';
import {
  makeFaults, stepFaults, hereIn, nearness, effectsOf, repairStep, clear, slip, openList, siteOf,
  wearStep, wearFlip,
} from './game/fault.js';
import { makeTutor, stepTutor, lineOf, nowKey, allDone, canFire } from './game/tutor.js';
import { TUTOR, KEYS as TUTOR_KEYS } from './game/tutor-table.js';
import { DOOR, nearDoor, canPass } from './game/door-table.js';
import { WRIST, jobFor } from './game/wrist-table.js';
import { buildWrist } from './world/wrist.js';
import { buildGuide } from './world/guide.js';
import { AIMS, pathTo } from './game/guide-table.js';
import { makeDoors, stepDoors, jammedOne, summary as doorSummary } from './game/door.js';

export const VERSION = 26;

const canvas = document.getElementById('view');
const cross = document.getElementById('cross');
const hint = document.getElementById('hint');
const hud = document.getElementById('hud');
const lesson = document.getElementById('lesson');

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
// ★ 손목 장치가 카메라에 매달린다 — 그러려면 카메라가 장면에 있어야 한다.
//   three 는 카메라를 장면에 안 넣어도 그리지만, **자식은 안 그린다**
scene.add(camera);

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

// ── 소리 ────────────────────────────────────────────────────
// ★ 브라우저는 **사람이 뭔가 누르기 전엔 소리를 안 낸다.** 그래서 그래프는
//   지금 만들어 두고(멈춘 상태로), 첫 클릭에서 깨운다. 켜자마자 만들려
//   들면 콘솔에 경고만 남고 조용히 안 난다 — 원인을 짐작하기 어려운 모양이다.
// ★ 소리가 안 나는 기계에서도 게임은 돌아야 한다. 통째로 감싼다.
let audio = null;
try { audio = makeAudio(); } catch (e) { console.warn('[audio] 소리를 못 켭니다 —', e.message); }
addEventListener('mousedown', () => audio?.resume(), { passive: true });
// ★ 손목을 들어 올린다 — **누르는 동안**. 다른 손잡이가 전부 「잡고 있는 것」
//   이라 여기도 같은 규약이다. 놓으면 곁눈 자리로 돌아간다
addEventListener('keydown', (e) => { if (e.code === 'KeyQ') raised = true; });
addEventListener('keyup', (e) => { if (e.code === 'KeyQ') raised = false; });
addEventListener('blur', () => { raised = false; });

addEventListener('keydown', (e) => {
  // M — 음소거. 소리가 있는 게임에 끄는 방법이 없으면 그건 결함이다
  if (e.code !== 'KeyM' || e.metaKey || e.ctrlKey || e.altKey || !audio) return;
  audio.setMuted(!audio.muted);
  banner = audio.muted ? '소리 꺼짐 (M)' : '소리 켜짐 (M)';
  bannerT = 1.4;
});

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
// ★ **정박 중에는 추진이 꺼져 있다.** 전에는 켜 놓고 시작했는데, 그러면
//   열이 초당 3.7 씩 올라 **켜는 순간부터 지고 있었다** — 추격 균형점이
//   열 32.2 인데 시작 열이 34 다. 부두에 대 놓고 엔진을 밀고 있는 꼴이라
//   물리적으로도 이상했다. 지금은 열이 내려가고(-0.9/초),
//   **「추진을 켠다」가 항로를 고른 뒤의 첫 행동**이 된다.
//   센서는 그대로 꺼 둔다 — 「상대가 안 보인다」를 처음부터 몸으로 알게.
const power = { thrust: false, cool: true, sensor: false };
const chase = makeChase();
// ── 항로 ────────────────────────────────────────────────────
// ★ **거점에서 시작한다.** 첫 화면이 「항로를 고르십시오」다 —
//   이 게임이 어디로 가는 게임인지를 첫 문장으로 말한다 (game/route.js).
//   시드는 주소로 바꿀 수 있다 (?seed=ABC123) — 같은 시드면 같은 항로다.
const seed = new URLSearchParams(location.search).get('seed') || 'SPACE1';
const route = makeRoute(seed);
// ── 고장 ────────────────────────────────────────────────────
// **어디가 고장났는지 안 알려준다.** 「무언가 잘못됐다」까지만 말하고,
// 자리는 소리로 찾는다 (game/fault.js · PLAN §3-1).
const faults = makeFaults(seed);
// ── 보급 ────────────────────────────────────────────────────
// 거점은 안전하고 **아무것도 안 난다.** 먹을 것도 고칠 것도 밖에만 있다
// (PLAN §4-2) — 그게 「다시 나갈 이유」의 전부다.
const supply = makeSupply();
// ── 조종 ────────────────────────────────────────────────────
// **조종은 「또 하나의 방」이지 게임의 중심이 아니다** (FLYING.md §1-1).
// 조종석에 앉아 있는 동안은 정비도 채굴도 항로 선택도 못 한다.
const hazard = makeHazard(seed);
// ── 가르침 ──────────────────────────────────────────────────
// **동사는 가르치고, 답은 안 가르친다** (docs/space/TUTORIAL.md §1-1).
// 「잡고 돌린다」를 모르면 신비가 아니라 고장 난 게임이고,
// 「지금 무엇이 덜그럭거리나」는 끝까지 안 말한다.
// ── 문 ──────────────────────────────────────────────────────
// **배가 살아 있다고 느끼게 하는 것.** 가까이 가면 열리고 지나가면 닫힌다.
// 가끔 끼는데, **끼어도 언제나 손으로 열린다** — 이 배는 우회로가 없어서
// 「못 여는 문」은 벌이 아니라 게임 오버가 된다 (game/door-table.js)
const doors = makeDoors(ship.doors.map((d) => ({ key: d.key, name: d.name, x: d.x, z: d.z, ry: d.ry })), seed);
const doorView = Object.fromEntries(ship.doors.map((d) => [d.key, d]));
let cranking = null;      // 지금 크랭크를 잡고 있는 문
// 조종간이 헐거울 때 **어느 쪽으로** 흐르나 — 한 판 내내 같은 쪽이라야
// 「이 배는 왼쪽으로 흐른다」를 몸이 배운다
const driftWay = seed.charCodeAt(0) % 2 ? 1 : -1;
// ── 손목 장치 ────────────────────────────────────────────────
// **늘 보이는 유일한 계기.** 「지금 할 일」과 「내가 고친 것」만 든다 —
// 거리·자국·항로·마모는 여전히 방이 갖는다 (world/wrist.js 머리말 참고)
const guide = buildGuide(scene);
/**
 * 안내선이 지금 어디를 가리키나 — **없으면 선이 안 그려진다.**
 *
 * ★ 셋 다 아니면 `null` 이다:
 *   · 가르침 일곱을 다 뗐다 → 본편이다. 여기서부터는 아무도 길을 안 알려준다
 *   · `walk` 이다 → 갈 데가 없는 가르침이다 (guide-table.js AIMS 참고)
 *   · `fault` 인데 아직 안 헤맸다 → 「덜그럭거리는 쪽으로 간다」를 배울
 *     시간을 준다. 12초(TUTOR.showWhere)를 넘기면 그때 고장 난 방으로 잇는다
 */
function guideAim() {
  if (allDone(tutor)) return null;
  const k = nowKey(tutor);
  if (!k) return null;
  if (k === 'fault') {
    if (tutor.t < TUTOR.showWhere) return null;
    const site = faults.open.map(siteOf)[0];
    const p = site && ship.panels[site];
    return p ? { x: p.group.position.x, z: p.group.position.z } : null;
  }
  return ship.marks[AIMS[k]] ?? null;
}

let raised = false;
const wrist = buildWrist(camera);
/** 손목에 지금 뜬 줄 — 검사가 읽는다. 게임은 안 쓴다 */
let wristJob = null;
/**
 * 이번 프레임의 고장 효과. **한 프레임에 한 번만 뽑아 여기 둔다.**
 * ★ 처음엔 systemsStep 안의 지역 변수였는데, 해도대(frame 안)와 문(위쪽)이
 *   같이 읽어야 해서 **「선언 전에 썼다」로 게임이 통째로 안 떴다.**
 *   여러 곳이 읽는 값은 읽는 곳들보다 위에 있어야 한다.
 */
let bad = effectsOf(makeFaults('boot'));
const tutor = makeTutor();
let taught = { walked: 0, turned: 0, flips: 0, fixed: 0, cooled: 0, hazardSeen: 0 };
let steering = false;     // 조종간을 잡고 있나 (한 프레임 늦게 반영된다 — 아래 참고)
let steerPush = 0;
let hitFlash = 0;         // 부딪힌 순간의 화면 충격
let winching = false;     // 지금 윈치를 잡고 있나
let trading = 0;          // 접수구를 얼마나 잡고 있었나
let partsWarned = false;  // 부품이 없다고 한 번만 말한다
let repairing = null;     // 지금 잡고 있는 고장
let hearNear = 0;         // 소리가 얼마나 가까운가 0~1
let flakyT = 12;          // 배전 노후 — 다음에 제멋대로 내려갈 때까지
let flash = 0;            // 경보 깜빡임
let banner = '';          // 화면 한복판에 잠깐 뜨는 글자
let bannerT = 0;
// 뿌리친 시각. **떨림과 소리가 같은 시계를 본다** — 따로 세면 어긋난다
let escapedAt = -99;
let shakeMul = SHAKE.calm;

/**
 * 가르침이 보는 것 — **게임이 지금 어떤가** 한 장.
 * ★ 가르침 쪽(game/tutor.js)은 three 를 안 쓰므로 게임을 직접 못 본다.
 *   여기서 한 번만 접어서 넘긴다 — 그래야 tools/space-tutor.js 가 같은
 *   모양을 브라우저 없이 흉내 낼 수 있다
 */
function tutorState() {
  return {
    walked: taught.walked, turned: taught.turned,
    atPort: route.phase === RPHASE.PORT, forkPicked: route.leg + (route.fork ? 1 : 0),
    heat, thrust: power.thrust, flips: taught.flips, cooled: taught.cooled,
    faultsOpen: faults.open.length, faultsFixed: taught.fixed,
    hazardSeen: taught.hazardSeen, dodged: hazard.dodged,
    // ★ **조종간을 실제로 잡고 민 시간.** 「비켰나」를 dodged 로 보면
    //   가만히 가운데 서 있어도 대부분 비킨 것이 된다 (hazard.js 참고)
    steered: hazard.seat,
    foodLow: shaky(supply), loads: supply.loads, traded: supply.traded,
  };
}

/**
 * 그 방 점검 패널까지 몇 미터인가 — 소리가 이 값으로 커진다.
 * 패널 위치는 배가 들고 있으므로 **여기서 다시 안 적는다.**
 */
function distToPanel(room) {
  const p = ship.panels[room];
  if (!p) return 99;
  return Math.hypot(me.x - p.group.position.x, me.z - p.group.position.z);
}

/** 방 열쇠 → 사람이 읽는 이름. 배너에 「workshop」이라 뜨면 안 된다 */
const ROOM_NAME = Object.fromEntries(ROOMS.map((r) => [r.key, r.name]));

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

  // 얼마나 걸었나 — 첫 가르침이 이걸 보고 사라진다 (game/tutor-table.js)
  taught.walked += Math.hypot(me.vx, me.vz) * dt;
}

// ── 손이 닿는 것들 ──────────────────────────────────────────
// **잡고 돌리는 것**(밸브)과 **누르는 것**(차단기)이 다르다.
// 밸브는 끝까지 돌리는 데 시간이 들고, 차단기는 딸깍 하고 넘어간다.
// 둘을 같은 방식으로 만들면 손맛이 하나로 뭉개진다 (PLAN §8).
let aimName = null;
function interactStep(dt) {
  ray.setFromCamera(CENTER, camera);

  // 조준선에 뭐가 걸리나. 가까운 것 하나만 본다
  const plates = ship.chart.plates;
  const pans = Object.values(ship.panels);
  const targets = [ship.valve, ...ship.breakers.map((b) => b.hit), ...plates.map((p) => p.hit),
    ...pans.map((p) => p.hit), ship.winch.hit, ship.tradeHatch.hit, ship.cock.yokeHit,
    ...ship.doors.map((d) => d.view.hit)];
  const hit = ray.intersectObjects(targets, true)[0];
  const near = hit && hit.distance <= BODY.reach;

  // 어느 것에 걸렸는지 — 부모를 타고 올라가며 찾는다
  let onValve = false;
  let breaker = null;
  let plate = -1;
  let panel = null;
  let onWinch = false, onHatch = false, onYoke = false;
  let onCrank = null;
  if (near) {
    for (let o = hit.object; o; o = o.parent) {
      if (o === ship.valve) { onValve = true; break; }
      const b = ship.breakers.find((x) => x.hit === o);
      if (b) { breaker = b; break; }
      const pi = plates.findIndex((x) => x.hit === o);
      if (pi >= 0) { plate = pi; break; }
      const pn = pans.find((x) => x.hit === o);
      if (pn) { panel = pn; break; }
      if (o === ship.winch.hit) { onWinch = true; break; }
      if (o === ship.tradeHatch.hit) { onHatch = true; break; }
      if (o === ship.cock.yokeHit) { onYoke = true; break; }
      const dv = ship.doors.find((x) => x.view.hit === o);
      if (dv) { onCrank = dv; break; }
    }
  }
  // 거점에 서 있을 때만 눌린다 — 항행 중에는 판이 「항행 중」만 띄운다
  const canPick = route.phase === RPHASE.PORT;
  ship.chart.setAim(canPick ? plate : -1);

  // ── 비상 크랭크 — **끼인 문을 손으로 연다** ──────────
  // ★ 안 낀 문의 크랭크는 **안 잡힌다.** 멀쩡한 문에서 손잡이가 돌아가면
  //   「이걸 왜 돌리지」가 되고, 진짜로 필요할 때의 무게가 사라진다
  const crankDoor = onCrank && doors.list.find((d) => d.key === onCrank.key);
  cranking = crankDoor && crankDoor.jammed && input.hold ? crankDoor : null;

  // ── 조종간 — **잡고 좌우로 민다** (FLYING.md §3-B) ─────
  steering = onYoke && input.hold;

  // ── 윈치 — **멈춰서 끌어온다.** 「한 통만 더」 (PLAN §5-3) ──
  // 추진이 켜져 있으면 안 걸린다. 캐는 동안 구간이 안 나아가고 위험이 쌓인다 —
  // 시간과 위험을 **동시에** 치르는 것이 이 손잡이의 전부다
  // ★ **에어록이 안 닫히면 윈치를 못 쓴다** (airlockSeal). 「한 통만 더」가
  //   막히는 것이라, 굶는 중에 이게 겹치면 진짜로 급해진다
  winching = onWinch && input.hold && !power.thrust && !bad.noWinch;
  if (winching) {
    if (winchStep(supply, dt) === 'load') {
      banner = `광석 한 통 — ${supply.loads}통째`;
      bannerT = 2.2;
      audio?.event('latch');
    }
    ship.winch.drum.rotation.y -= dt * 2.4;
  }

  // ── 접수구 — 거점에서만. 상인은 얼굴이 없다 (PLAN §1) ──
  if (onHatch && input.hold && route.phase === RPHASE.PORT && canTrade(supply)) {
    trading += dt;
    if (trading >= TRADE.hold) {
      trading = 0;
      trade(supply);
      banner = `광석 ${TRADE.ore} → 식량 ${TRADE.food} · 부품 ${TRADE.parts}`;
      bannerT = 2.6;
      audio?.event('fixed');
    }
  } else trading = Math.max(0, trading - dt * 1.5);

  // ── 점검 패널 — **잡고 있어야 고쳐진다** ────────────────
  // 딸깍이면 「눌렀더니 고쳐졌다」가 되어 진단이 사라진다. 시간이 드는
  // 동작이라야 「지금 여기 매여 있다」가 생긴다 (밸브와 같은 규약).
  const fixHere = panel ? hereIn(faults, panel.room) : null;
  // ★ 고치려면 **부품이 든다.** 이게 없으면 고장이 「시간만 쓰면 되는 것」이라
  //   캘 이유가 안 생긴다. 마지막 걸음에서만 받는다 — 챙기러 가는 것도 걸음이다
  const needParts = fixHere ? (BY_KEY[fixHere.key]?.costs?.parts ?? 0) : 0;
  const lastStep = fixHere && fixHere.step >= fixHere.steps.length - 1;
  const shortParts = !!fixHere && lastStep && !canRepair(supply, needParts);
  if (shortParts && input.hold && !partsWarned) {
    partsWarned = true;
    banner = `부품이 없습니다 — 거점 접수구에서 바꿉니다`;
    bannerT = 2.6;
    audio?.event('deny');
  }
  if (!input.hold) partsWarned = false;

  if (fixHere && input.hold && !shortParts) {
    repairing = fixHere;
    // 굶으면 **잡고 있어도 더디다** — 손이 떨려 정밀 작업이 어긋난다
    const ev = repairStep(fixHere, dt * (shaky(supply) ? FOOD.handMult : 1));
    if (ev === 'step') {
      const nx = fixHere.steps[fixHere.step];
      banner = nx?.what ? `${nx.what} — ${ROOM_NAME[nx.at] ?? nx.at}` : '한 군데 더 있습니다';
      bannerT = 2.6;
      audio?.event('latch');
    }
    if (ev === 'fixed') {
      spendParts(supply, needParts);
      // ★ **여기서야 원인을 말해 준다.** 고치기 전에 말하면 진단이 사라진다
      banner = fixHere.reveal;
      bannerT = 3.4;
      audio?.event('fixed');
      clear(faults, fixHere);
      repairing = null;
      taught.fixed++;
    }
  } else {
    // 놓으면 조금 되돌아간다. 딱 멈추면 손을 뗄 이유가 없다.
    //
    // ★ 처음엔 놓는 **그 프레임에** repairing 을 비웠다. 그러면 한 프레임만
    //   되돌아가고 그 뒤로는 그대로 멎는다 — 검사가 「0.06 → 0.07」로 잡아 줬다.
    //   0 이 될 때까지 붙들고 있어야 되돌아가는 것이 보인다.
    // 굶으면 **잡고 있어도** 더 미끄러진다 — 손이 떨린다 (PLAN §5-2)
    slip(repairing, dt * slipMult(supply));
    if (repairing && repairing.held <= 0) repairing = null;
  }

  // 패널 불 — **그 자리가 문제일 때만** 켜진다. 다 켜 두면 안내판이 된다.
  //   그리고 켜지는 것은 **그 방에 들어왔을 때**다 — 복도에서 보이면
  //   소리로 찾을 이유가 없어진다
  const hereRoom = roomAt(me.x, me.z);
  for (const pn of pans) {
    const lit = pn.room === hereRoom && !!hereIn(faults, pn.room);
    pn.lampMat.color.set(lit ? 0xffb060 : 0x2a2f36);
    if (fixHere && pn === panel) pn.knob.rotation.z -= dt * 3.2;
  }

  // 밸브 — 잡고 돌린다. 놓으면 되돌아온다. **끝까지 돌리면 걸린다**
  if (onValve && input.hold) turn = Math.min(1, turn + dt / VALVE.turnTime);
  else turn = Math.max(0, turn - VALVE.slip * dt);
  // 걸린 **횟수**를 센다 — 가르침이 `coolFor > 0` 을 보면 26초 뒤에 다시
  // 「안 한 것」이 되어, 먼저 돌려 본 사람을 못 알아본다
  if (turn >= VALVE.openAt) { coolFor = VALVE.holds; turn = 0; taught.cooled++; audio?.event('latch'); }
  coolFor = Math.max(0, coolFor - dt);
  ship.wheel.parent.rotation.z -= (turn > 0 ? dt * 2.6 : 0) + (coolFor > 0 ? dt * 0.5 : 0);

  // 차단기 · 해도대 — 누르는 순간에만 넘어간다
  const pressed = input.takePress();
  if (plate >= 0 && pressed) {
    if (canPick && chooseFork(route, ship.chart.keyAt(plate))) {
      ship.outside.setRegion(regionOf(route));
      banner = `${route.fork.name} — ${(route.fork.seconds / 60).toFixed(0)}분`;
      bannerT = 2.4;
      audio?.event('latch');
    } else audio?.event('deny');
  } else if (breaker && pressed) {
    if (power[breaker.key]) { power[breaker.key] = false; wearFlip(faults); taught.flips++; audio?.event('click'); }
    else if (canTurnOn(power)) { power[breaker.key] = true; wearFlip(faults); taught.flips++; audio?.event('click'); }
    else {
      // ★ 꽉 찼을 때 **조용히 아무 일도 안 일어나면** 고장인 줄 안다.
      //   무엇이 막았는지 글자로 말해 준다 — 규칙을 알아맞히게 하지 않는다.
      //   소리도 **딸깍이 아닌 다른 소리**를 낸다. 같은 소리를 내면
      //   「눌렸는데 안 먹었다」가 되어 고장으로 읽힌다
      banner = `전력이 모자랍니다 — 셋 중 ${POWER_MAX}개만`;
      bannerT = 1.6;
      audio?.event('deny');
    }
  }

  // ★ 배전 노후 — 회로 하나가 **제멋대로 내려간다.**
  //   셋 중 둘이 잠깐 둘 중 하나가 된다. 규칙 자체를 흔드는 것이라
  //   자주 나오면 안 된다 (mission-table.js 참고)
  if (effectsOf(faults).flaky) {
    flakyT -= dt;
    if (flakyT <= 0) {
      flakyT = 18 + Math.random() * 10;
      const on = CIRCUITS.filter((c) => power[c.key]);
      if (on.length) {
        const c = on[Math.floor(Math.random() * on.length)];
        power[c.key] = false;
        banner = `${c.name} 차단기가 내려갔습니다`;
        bannerT = 2.0;
        audio?.event('deny');
      }
    }
  } else flakyT = 12;

  // 레버 각도와 불
  for (const b of ship.breakers) {
    const on = power[b.key];
    b.lever.rotation.x += ((on ? -0.5 : 0.5) - b.lever.rotation.x) * Math.min(1, dt * 14);
    b.lampMat.color.set(on ? b.tint : 0x2a2f36);
  }

  aimName = onCrank ? `crank:${onCrank.key}`
    : onValve ? 'valve' : (breaker ? breaker.key
    : (plate >= 0 ? `chart${plate}`
      : (panel ? `panel:${panel.room}`
        : (onWinch ? 'winch' : (onHatch ? 'hatch' : (onYoke ? 'yoke' : null))))));
  cross.classList.toggle('on', !!(onValve || breaker || (canPick && plate >= 0) || fixHere
    || (onWinch && !power.thrust) || (onHatch && route.phase === RPHASE.PORT && canTrade(supply))
    || onYoke || (crankDoor && crankDoor.jammed)));
  return coolFor > 0;
}

// ── 열 · 자국 · 추격 ────────────────────────────────────────
function systemsStep(dt, valveOpen, regionMult) {
  // ★ **맨 처음에 한 번만 뽑는다.** 아래 여기저기서 effectsOf 를 다시 부르면
  //   같은 프레임 안에서 값이 갈린다
  bad = effectsOf(faults);

  // ── 고장 ──────────────────────────────────────────────
  // **추격 중에는 새로 안 뜬다.** 겹치면 다섯이 되고, 다섯이면 포기한다
  // ★ **빗장** — 아직 항로도 못 골랐는데 고장부터 나면 뭐가 뭔지 모른다
  //   (TUTORIAL.md §2-2). 시계를 **멈춘다** — 안 그러면 앞의 것을 떼는
  //   순간 밀린 것이 한꺼번에 터진다
  const calm = chase.phase !== PHASE.CHASE && route.phase === RPHASE.LEG;
  if (canFire(tutor, 'fault') && stepFaults(faults, dt, { calm, leg: route.leg }) === 'spawn') {
    const o = faults.open[faults.open.length - 1];
    // ★ **증상만 말한다.** 어디인지·무엇인지는 안 말한다 (PLAN §3-1)
    banner = o.lead;
    bannerT = 3.6;
    audio?.event('fault');
  }
  // ── 문 — **가까이 가면 열리고 지나가면 닫힌다** ───────
  // ★ 끼는 것은 **평온할 때만.** 추격 중에 갇히면 그건 긴장이 아니라
  //   사고다 — 뿌리칠 유일한 길(기관실 밸브)이 막히기 때문이다.
  // ★ 그리고 **가르침을 다 떼기 전에도 안 낀다** — 고장·위험 지대에 걸어 둔
  //   빗장과 같은 규약이다 (TUTORIAL.md §2-2). 배우는 중에 갇히면 그건
  //   튜토리얼이 아니라 검문이다
  // ★ **문 구동부가 나가면 제멋대로 여닫힌다** (doorServo). 가까이 안 가도
  //   열리고, 그 소리가 자국이 된다 (effect.sign) — 숨죽이고 가는 중에 제일 나쁘다
  const nearD = bad.doorWild
    ? doors.list[Math.floor(clock * 0.7) % doors.list.length]
    : nearDoor(doors.list, me.x, me.z);
  for (const e of stepDoors(doors, dt, {
    near: nearD, cranking, calm: chase.phase !== PHASE.CHASE && allDone(tutor),
  })) {
    if (e.what === 'open') audio?.event('doorOpen');
    if (e.what === 'shut') audio?.event('doorShut');
    if (e.what === 'jam') {
      // ★ **어느 문인지 안 말한다.** 「무언가 잘못됐다」까지다 (PLAN §3-1) —
      //   고장과 같은 규약이고, 배가 좁으니 걸어 보면 곧 안다
      banner = '어딘가 문이 안 열립니다';
      bannerT = 3.4;
      audio?.event('fault');
    }
    if (e.what === 'freed') {
      banner = `${e.door.name} 문이 열렸습니다`;
      bannerT = 2.4;
      audio?.event('fixed');
    }
  }
  // 문짝을 그리고, **닫힌 문은 길을 막는다**
  for (const d of doors.list) {
    const v = doorView[d.key];
    v.view.update(d.k, d.jammed, d.held);
    v.bar.off = canPass(d);
  }

  // ── 보급 — 먹고, 지나가며 줍는다 ─────────────────────
  const rg = REGION_BY_KEY[ship.outside.region];
  // ★ **온실이 얼면 식량이 빨리 준다.** dt 를 늘려 흉내낸다 — 표(FOOD.perSec)를
  //   안 건드리는 쪽이다. 표를 고치면 시뮬이 읽는 값과 게임이 갈라진다
  if (stepSupply(supply, dt * (1 + bad.food), { debris: rg?.debris ?? 0 }) === 'hungry') {
    banner = '손이 떨립니다 — 식량이 모자랍니다';
    bannerT = 3.2;
    audio?.event('fault');
  }

  // ── 위험 지대 — 부딪히는 것과 피하는 것 (FLYING.md) ────
  // ★ **빗장** — 고장을 아직 못 고쳤으면 안 온다. 첫 판에 둘이 겹치면
  //   (55초와 85초 — 30초 차이다) 배우기는커녕 뭐가 뭔지 모른다.
  //   **떠 있는 것을 끄지는 않는다** — 오는 것만 막는다
  //   ★ **거점에서도 오고 있었다.** 추격만 막고 이건 빠뜨렸다 —
  //     newLeg() 가 도착할 때 시계를 되돌리므로 거점에 85초 머물면
  //     정박 중에 「전방에 잔해」가 떴다. 고장은 이미 막혀 있었는데
  //     (calm 에 route.phase === LEG 가 들어 있다) 이것만 새고 있었다
  // ★ **조종간이 헐거우면 배가 저절로 흐른다** (looseYoke). 잡고 있지 않으면
  //   한쪽으로 밀리므로, 위험 지대에서 가만히 있는 것이 정답이 아니게 된다
  if (bad.drift && !steering) {
    hazard.lane = Math.max(-HAZARD.laneMax, Math.min(HAZARD.laneMax,
      hazard.lane + bad.drift * dt * (driftWay || 1)));
  }
  const hev = hazard.phase !== HPHASE.IDLE
    || (route.phase === RPHASE.LEG && canFire(tutor, 'hazard'))
    ? stepHazard(hazard, dt, {
      region: ship.outside.region, atSeat: steering, push: steerPush,
    })
    : null;
  if (hev === 'warn') {
    taught.hazardSeen++;
    // ★ **어느 방에 있든** 알아야 한다. 기관실에서 모르고 있다가 맞으면
    //   「정비하러 가는 것 자체가 벌」이 된다 (FLYING.md §1-2)
    banner = `전방에 잔해 — ${warnLeft(hazard).toFixed(0)}초`;
    bannerT = 4.0;
    audio?.event('fault');
  }
  if (hev === 'enter') { banner = '들어갑니다 — 조종석'; bannerT = 2.6; }
  if (hev === 'hit') {
    // 죽지 않는다. **대신 일이 는다** (PLAN §4-4)
    faults.wear.hull = Math.min(1, faults.wear.hull + HAZARD.hit.hull);
    heat = Math.min(HEAT.max, heat + HAZARD.hit.heat);
    if (HAZARD.hit.fault) { faults.next = 0; stepFaults(faults, 0.001, { calm: true, leg: route.leg }); }
    banner = '부딪혔습니다';
    bannerT = 2.8;
    hitFlash = 1;
    audio?.event('caught');
  }
  if (hev === 'pass') audio?.event('fixed');

  // 쓰는 대로 닳는다 — **어떻게 몰았는지가 다음 고장을 정한다** (systems-table WEAR)
  wearStep(faults, dt, { power, valveOpen, region: ship.outside.region });

  // 열은 **켠 회로**가 정한다. 추진을 켜면 오르고, 냉각을 켜면 내려간다.
  // 다만 냉각 회로만으로는 절반뿐이라 **기관실 밸브까지 열어야** 제대로 잡힌다.
  // 고장이 있으면 여기에 얹힌다 — 「원인 모를 열」이 그것이다
  heat += (heatRate(power, valveOpen) + bad.heat
    + (valveOpen && power.cool ? bad.coolValve : 0)) * dt;
  heat = Math.max(0, Math.min(HEAT.max, heat));

  // ★★ **거점은 안전하다** (PLAN §4-2). 여기 위 158행에 그렇게 적어 놓고
  //   **정작 추격은 안 막고 있었다.** 그래서 켜자마자 거점에 서 있기만 해도
  //   34초에 붙고 69초에 잡혔다 — 항로 안내가 뜨기도 전에.
  //   거점에서는 위험이 **빠진다**: 붙을 일이 없으니 쌓일 이유도 없다.
  const atPort = route.phase === RPHASE.PORT;
  const riskWas = chase.risk;
  // ★ **고장이 자국을 민다.** 새는 공기(미소운석)·제멋대로 여닫히는 문
  //   (문 구동부)이 눈에 띈다. 자국은 열에서 나오므로 열 단위로 환산해 얹는다 —
  //   따로 더하면 조종석 계기가 말하는 자국과 실제가 갈라진다
  const badSign = bad.sign / SIGN_PER_HEAT;
  const ev = atPort
    ? (chase.phase === PHASE.CALM
      ? (chase.risk = Math.max(0, chase.risk - SIGN.riskFall * dt), null)
      : stepChase(chase, dt, power, heat + badSign, regionMult, { contactAt: 999, trackMult: 0 }))
    : stepChase(chase, dt, power,
      heat + badSign + (winching ? WINCH.sign / SIGN_PER_HEAT : 0), regionMult,
      { contactAt: contactAt(route), trackMult: trackMult(route) });
  // ★ 캐는 동안에는 **위험이 안 빠진다.** 배가 멈춰 있고 윈치가 시끄러우니
  //   상대가 나를 놓칠 리가 없다.
  //   처음엔 그냥 위험을 더하기만 했는데, 자국이 낮으면 stepChase 가 초당
  //   2.2 씩 빼 가서 **캐는데 위험이 오히려 줄었다.** 브라우저 검사가
  //   「4.7 → 4.5」로 잡아 줬다 — 시뮬은 빼는 쪽을 안 세고 있어서 못 봤다
  if (winching && chase.phase === PHASE.CALM) {
    chase.risk = Math.min(100, riskWas + WINCH.riskRise * dt);
  }
  if (ev === 'contact') { banner = '접촉 — 무언가 따라붙었습니다'; bannerT = 2.6; }
  if (ev === 'escaped') {
    banner = '뿌리쳤습니다'; bannerT = 3.2; escapedAt = clock;
    // ★ 항로에도 남긴다. 이게 없으면 「뿌리쳐도 아무것도 안 쌓인다」가
    //   그대로 남는다 (docs/space/GAP.md §1-1)
    relieveEscape(route);
  }
  // ★ 잡혀도 **끝나지 않는다. 뺏기고 일이 는다** (chase-table.js CAUGHT).
  //   v21 까지는 배너 한 줄이 전부였고, 그 뒤로 게임이 위협 없는 빈 상자가
  //   됐다 — 사장님이 「아무것도 못하고 그냥 끝나는데」라고 하신 게 이것이다
  if (ev === 'caught') {
    banner = '잡혔습니다 — 배를 뒤집니다';
    bannerT = CAUGHT.hold;
    hitFlash = 1;
    supply.ore = Math.max(0, supply.ore * (1 - CAUGHT.ore));
    faults.wear.hull = Math.min(1, faults.wear.hull + CAUGHT.hull);
    // 벌은 **일**이다. 고장 둘을 두고 간다 — 자리는 여전히 안 알려준다
    for (let i = 0; i < CAUGHT.faults; i++) {
      faults.next = 0;
      stepFaults(faults, 0.001, { calm: true, leg: route.leg });
    }
  }
  if (ev === 'released') {
    banner = '놓아줬습니다 — 실려 있던 것이 없습니다';
    bannerT = 3.6;
    escapedAt = clock;      // 조용해지는 3초는 여기서도 온다. 안도는 안도다
  }
  if (ev) audio?.event(ev === 'released' ? 'escaped' : ev);

  // 소리는 **상태만** 받는다. 규칙은 여기, 소리는 저기 — 섞으면 둘 다 못 고친다
  const urgency = chase.phase === PHASE.CHASE ? 1 - chase.dist / CH.escapeAt : 0;
  // ★ **덜그럭거림이 진단의 전부다.** 고장 난 자리에 가까울수록 커진다 —
  //   화면을 하나도 안 늘리고 「어디가 잘못됐나」를 알게 하는 유일한 길이었다
  const room = roomAt(me.x, me.z);
  const site = faults.open.map(siteOf).find((a) => a === room);
  const dist = site ? distToPanel(site) : 0;
  hearNear = nearness(faults, room, dist);
  // ★ **끼인 문도 덜그럭거린다.** 배너는 「어딘가 문이 안 열립니다」까지만
  //   말하므로(PLAN §3-1), 찾는 길은 고장과 **같은 규약**이라야 한다 —
  //   여기서 소리를 따로 만들면 「문은 눈으로 찾고 고장은 귀로 찾는」
  //   두 문법이 되고, 그러면 둘 다 안 배워진다
  {
    const jd = jammedOne(doors);
    if (jd) {
      const far = Math.hypot(me.x - jd.x, me.z - jd.z);
      hearNear = Math.max(hearNear, Math.max(0.12, 1 - Math.min(1, far / FAULT.hearing)));
    }
  }
  audio?.update({
    phase: chase.phase, urgency,
    heat01: Math.max(0, (heat - HEAT.warn) / (HEAT.max - HEAT.warn)),
    turning: turn,
    rattle: hearNear,
  });

  // 경보 — 추격 중에만. 거리가 가까울수록 빨라진다 (PLAN §3-1 글로 안 알려준다)
  if (chase.phase === PHASE.CHASE) {
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

  // 정비실 진단대 — **다음에 무엇이 터지나.** 조종석·관측실과 겹치지 않는다
  ship.bench.update({ wear: faults.wear, open: openList(faults), fixed: faults.fixed, log: faults.log });
  // 온실 · 에어록 — 계기는 방마다 하나씩, 전부 다른 것을 말한다
  ship.foodGauge.update({
    food: supply.food, ore: supply.ore, parts: supply.parts,
    legsOnFood: legsLeftOnFood(supply, route.fork?.seconds ?? LEG.seconds),
  });
  ship.winch.update({ hauled: supply.hauled, ore: supply.ore, loads: supply.loads, moving: power.thrust });
  ship.tradeHatch.update({ atPort: route.phase === RPHASE.PORT, ore: supply.ore });

  // 조종석 화면들 — 계기는 UI 가 아니라 **콘솔에 박힌 물건**이다
  ship.cock.update({
    heat, cooling: valveOpen && power.cool, room: roomAt(me.x, me.z), t: clock,
    region: ship.outside.region, power, chase,
    // ★ 성운에서는 센서를 켜도 거리가 안 읽힌다 — 「자국이 묻히지만 나도
    //   못 본다」의 실체다. 조종석 화면이 그걸 그대로 보여줘야 한다
    blind: isBlind(route),
    press: route.press, legsLeft: legsLeft(route),
    progress: progress(route), atPort: route.phase === RPHASE.PORT,
    contactAt: contactAt(route),
    // 조종 — 남은 시간과 다가오는 것 (world/cockpit.js drawCourse 가 읽는다)
    lane: hazard.lane, hazPhase: hazard.phase,
    hazWarn: warnLeft(hazard), incoming: incoming(hazard), clearBy: clearOf(hazard),
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
  /** 어디를 보고 있나 — 조종간을 밀 때 **시야가 안 돌아야** 한다 (FLYING.md §3-B) */
  get look() { return { yaw: +me.yaw.toFixed(4), pitch: +me.pitch.toFixed(4) }; },
  get locked() { return input.locked; },
  get blockers() { return BLOCKERS.length; },
  get region() { return ship.outside.region; },
  get power() { return { ...power }; },
  setPower(k, v) { if (v && !canTurnOn(power) && !power[k]) return false; power[k] = v; return true; },
  get chase() { return { phase: chase.phase, risk: +chase.risk.toFixed(1), dist: +chase.dist.toFixed(1), sign: +chase.sign.toFixed(1), runs: chase.runs }; },
  // ★ 100 으로는 안 붙는다. stepChase 가 **더한 뒤에** 견주므로 그 프레임에
  //   riskFall 이 빠져서 99.9 가 된다. 넉넉히 넘겨 놓는다.
  forceContact() {
    // ★ v22 부터 **거점에서는 추격이 안 돈다.** 그런데 게임은 거점에서
    //   시작하므로, 이 구멍을 그대로 두면 도구가 「접촉이 안 난다」로
    //   멈춘다 (space-audio 가 실제로 그랬다). 「붙여 놓고 재겠다」는 뜻이니
    //   **항행 중으로 만들어 준다** — 거점에서 붙는 것이 아니라
    chase.risk = 200;
    if (route.phase === RPHASE.PORT) { chooseFork(route, route.offer[0].key); ship.outside.setRegion(regionOf(route)); }
  },
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
   * 무늬가 실제로 물렸나 — 면마다 어떤 장이 붙었고 색 공간이 뭔지.
   * 화면만 봐서는 「색만 붙음」과 「굴곡까지 붙음」이 구분이 안 되고,
   * 색 공간이 어긋난 것은 아예 안 보인다. 그래서 숫자로 내어 본다
   * (docs/POSTMORTEM.md §1-④ 「값을 찍는다」).
   */
  get skin() {
    const out = {};
    for (const [k, m] of Object.entries(ship.skins)) {
      out[k] = {
        maps: ['map', 'normalMap', 'roughnessMap'].filter((s) => m[s]),
        space: m.map ? m.map.colorSpace : null,
        linear: ['normalMap', 'roughnessMap']
          .every((s) => !m[s] || m[s].colorSpace === THREE.NoColorSpace),
        repeat: m.map ? [m.map.repeat.x, m.map.repeat.y] : null,
      };
    }
    return out;
  },
  /** 고장 — 지금 몇 개 열려 있고 어디를 만져야 하나 */
  get faults() {
    const w = {};
    for (const [k, v] of Object.entries(faults.wear)) w[k] = +v.toFixed(3);
    return {
      open: openList(faults), fixed: faults.fixed, next: +faults.next.toFixed(1),
      hear: +hearNear.toFixed(2), wear: w, log: faults.log.map((l) => l.reveal),
    };
  },
  /** 그 방 점검 패널이 어디 있나 — 검사가 앞에 가서 서려고 묻는다 */
  panelAt(room) {
    const p = ship.panels[room];
    return p ? { x: +p.group.position.x.toFixed(2), z: +p.group.position.z.toFixed(2), ry: p.group.rotation.y } : null;
  },
  /** 진단대 화면이 어디 있나 — 읽을 자리가 있는지 검사가 묻는다 */
  get benchAt() {
    const b = ship.bench?.at;
    return b ? { x: +b.x.toFixed(2), z: +b.z.toFixed(2), ry: b.ry } : null;
  },
  /** 마모를 밖에서 밀어 놓는다 — 진단대 화면을 찍으려고 낸 구멍 */
  wearTo(w) { Object.assign(faults.wear, w); },
  /** 검사가 기다리지 않고 고장을 띄운다 */
  forceFault() { faults.next = 0; return stepFaults(faults, 0.001, { calm: true, leg: route.leg }); },
  /** 조종 — 위험 지대와 배의 좌우 자리 */
  get fly() {
    const n = incoming(hazard);
    return {
      phase: hazard.phase, lane: +hazard.lane.toFixed(3), steering,
      push: +steerPush.toFixed(2), warn: +warnLeft(hazard).toFixed(1),
      incoming: n ? { in: +n.in.toFixed(1), lane: +n.lane.toFixed(2), left: n.left } : null,
      hits: hazard.hits, dodged: hazard.dodged, seat: +hazard.seat.toFixed(1),
    };
  },
  /** 검사가 기다리지 않고 위험 지대를 부른다 */
  /** 가르침이 지금 무엇을 말하고 있나 — 검사용 */
  get tutor() {
    const ln = lineOf(tutor, aimName);
    return {
      now: nowKey(tutor), text: ln?.text ?? null, dim: !!ln?.dim,
      done: [...tutor.done], shown: tutor.shown, allDone: allDone(tutor),
      age: +tutor.age.toFixed(1), armed: tutor.armed,
      // ★ 「안 걸린다」와 「느리다」를 갈라 놓으려고 낸 구멍. 헤드리스는
      //   1fps 남짓이라 걷는 거리가 실시간의 20분의 1로 쌓인다
      walked: +taught.walked.toFixed(2), turned: +taught.turned.toFixed(2),
      holds: { fault: !canFire(tutor, 'fault'), hazard: !canFire(tutor, 'hazard') },
    };
  },
  /** 가르침을 통째로 뗀 것으로 친다 — 아래 검사들이 빗장에 막히지 않게 */
  skipTutor() { while (!allDone(tutor)) { tutor.done.push('(건너뜀)'); tutor.i++; } tutor.open = false; },
  /**
   * 그 가르침을 지금 띄운다 — **검사용.** 게임은 안 쓴다.
   * ★ 헤드리스는 게임 시간이 실시간의 20분의 1이라 가르침 사이 간격
   *   ({TUTOR.gap}초)만 기다려도 실제로 몇 분이 간다. 일곱 줄이 화면에
   *   제대로 나오는지 보려면 건너뛸 구멍이 필요하다.
   * @param age 몇 초째 떠 있는 것으로 칠까 (방 이름이 붙는 단계를 보려면)
   */
  teach(key, age = 0) {
    const i = TUTOR_KEYS.indexOf(key);
    if (i < 0) return false;
    tutor.i = i; tutor.open = true; tutor.t = age; tutor.rest = 0;
    return true;
  },
  /** 문 여섯이 지금 어떤가 — 검사용 */
  get doors() { return doorSummary(doors); },
  /**
   * 손목에 지금 뭐가 떠 있나 — 검사용.
   * ★ `lift` 가 있어야 **Q 로 정말 올라오나**를 잰다. 화면만 보면
   *   「올라온 것 같다」로 끝나고 그건 검사가 아니다
   */
  get wrist() {
    // ★ `onScreen` 이 이 구멍의 핵심이다. 손목은 **카메라의 자식**이라,
    //   카메라를 scene 에 안 넣으면 three 가 아예 안 그린다 — 코드는 전부
    //   도는데 화면에는 없다. 순수 검사로는 절대 안 잡히는 종류다
    let root = wrist.group;
    while (root.parent) root = root.parent;
    return {
      ...(wristJob ?? {}), lift: wrist.lift, onScreen: root === scene,
      log: faults.log.map((l) => l.reveal), fixed: faults.fixed,
    };
  },
  /**
   * 문을 전부 열어 둔다 — **검사용.** 게임은 안 쓴다.
   * ★ `space-walk.js` 는 배 안을 격자로 훑어 「걸어서 갈 수 있나」를 본다.
   *   그런데 문은 **가까이 가야** 열리므로, 격자로 훑으면 닫힌 문에 막혀
   *   곁방이 전부 「못 간다」로 나온다 — 사람은 걸어가면 열리는데.
   *   훑기 전에 이걸 부른다.
   */
  openDoors(on = true) {
    // ★ `on: false` 로 되돌릴 수 있어야 한다. 처음엔 켜기만 되게 뒀더니
    //   **뒤에 오는 문 검사가 문을 못 닫아서** 「멀리 있으면 막힌다」가
    //   실패했다 — 검사용 구멍도 되돌리는 길이 있어야 한다
    for (const d of doors.list) {
      d.force = on ? 9999 : 0;
      if (on) { d.jammed = false; d.k = 1; }
    }
  },
  /**
   * 문간을 가로지르는 것이 있나 — **검사용.**
   *
   * ★ 이게 왜 필요했나 (2026-08-04 · 사장님 「문들이 쇠파이프로 막혀있는데?」)
   *   통로 난간을 끝에서 끝까지 한 줄로 그어 놓아서 **곁방 문 넷을 그대로
   *   관통**했다. 난간 높이 1.32 는 문 구멍(2.05)의 한복판이다.
   *   **v22 까지는 문짝이 없어서(구멍뿐) 덜 띄었고**, 문을 단 v23 부터
   *   「막대가 문을 막았다」로 읽혔다.
   *
   *   숫자로는 아무 데도 안 걸린다 — 걸어는 다녀지고(난간은 충돌이 아니다)
   *   문은 잘 열린다. **눈에만 보이는 종류**라 이렇게 쏴 봐야 안다.
   *   문틀 사이를 **벽을 따라** 가로질러 광선을 쏜다. 걸리는 게 있으면
   *   그건 문간을 지나가는 물건이다.
   */
  clearDoorway(key, ys = [0.7, 1.0, 1.32, 1.7]) {
    const d = doors.list.find((x) => x.key === key);
    if (!d) return null;
    // 문의 폭 방향 = 문틀의 로컬 +x 를 ry 만큼 돌린 것 (kit.js hatch 와 같다)
    const ux = Math.cos(d.ry), uz = -Math.sin(d.ry);
    // 문이 바라보는 방향 — 벽에서 앞뒤로 떨어뜨려 가며 쏘려고 쓴다
    const nx = Math.sin(d.ry), nz = Math.cos(d.ry);
    // 문짝은 열리면 문틀 옆으로 붙으므로 **양끝을 넉넉히 물린다**
    const reach = DOOR.half - 0.3;
    // ★ **벽 면 하나만 쏘면 못 잡는다.** 처음엔 벽 위(offset 0)에서만 쐈는데,
    //   난간·배관은 벽에서 0.1~0.2 **떨어져** 벽과 나란히 지나간다 — 광선과
    //   평행이라 스쳐 지나가고 하나도 안 걸렸다. 문을 막는 물건은 대개
    //   그렇게 생겼으므로 **앞뒤로 훑는다.**
    const OFFS = [0, 0.12, -0.12, 0.24, -0.24];
    const hits = [];
    for (const y of ys) for (const o of OFFS) {
      ray.set(
        new THREE.Vector3(d.x - ux * reach + nx * o, y, d.z - uz * reach + nz * o),
        new THREE.Vector3(ux, 0, uz),
      );
      ray.far = reach * 2;
      for (const h of ray.intersectObject(ship.group, true)) {
        // 조준용 히트 박스는 **안 보이는 물건**이라 문을 막지 않는다
        if (h.object.material?.visible === false) continue;
        const n = h.object.name || h.object.parent?.name || '?';
        if (!hits.includes(n)) hits.push(n);
      }
    }
    return hits;
  },
  get THREE() { return THREE; },
  get shipGroup() { return ship.group; },
  get doorsRaw() { return doors.list.map((d) => ({ key: d.key, x: d.x, z: d.z, ry: d.ry })); },
  /** 안내선이 지금 어디를 가리키나 · 화살표가 몇 개 켜졌나 — 검사용 */
  get guide() {
    const t = guideAim();
    return { aim: t ? { x: +t.x.toFixed(2), z: +t.z.toFixed(2) } : null,
      on: guide.on, marks: guide.group.children.filter((m) => m.visible).length };
  },
  /** 그 문을 지금 끼게 한다 — 검사용. 게임은 안 쓴다 */
  jamDoor(key) {
    const d = doors.list.find((x) => x.key === key);
    if (!d) return false;
    d.jammed = true; d.k = 0; d.dwell = 0; d.force = 0;
    return true;
  },
  forceHazard() { hazard.next = 0; hazard.inLeg = 0; return stepHazard(hazard, 0.001, { region: ship.outside.region }); },
  /** 예고를 건너뛴다 */
  skipWarn() { if (hazard.phase === 'warn') hazard.t = hazard.need; },
  /** 보급 — 식량·부품·광석 */
  get supply() {
    return {
      food: +supply.food.toFixed(1), parts: supply.parts, ore: +supply.ore.toFixed(1),
      loads: supply.loads, traded: supply.traded, shaky: shaky(supply),
      trading: +trading.toFixed(2), hold: TRADE.hold,
      legsOnFood: +legsLeftOnFood(supply, route.fork?.seconds ?? LEG.seconds).toFixed(2),
      winching,
    };
  },
  setSupply(v) { Object.assign(supply, v); },
  /** 항로 — 어디까지 왔고 압박이 얼마인가 */
  get route() {
    return {
      phase: route.phase, leg: route.leg, press: +route.press.toFixed(1),
      progress: +progress(route).toFixed(3), fork: route.fork?.key ?? null,
      offer: route.offer.map((o) => o.key), left: legsLeft(route),
      contactAt: +contactAt(route).toFixed(1), blind: isBlind(route),
    };
  },
  /** 갈래를 고른다 — 검사가 관측실까지 안 걸어가고 부를 수 있게 */
  pick(key) { const ok = chooseFork(route, key); if (ok) ship.outside.setRegion(regionOf(route)); return ok; },
  /** 구간을 끝까지 밀어 놓는다 — 거점 도착을 실제로 내 보려고 */
  skipLeg() { route.t = route.need; },
  setPress(v) { route.press = v; },
  /** 소리가 켜졌나 · 지금 얼마나 떠나 — 검사와 손보기용 */
  get audio() {
    return {
      on: !!audio, state: audio?.state ?? null, muted: audio?.muted ?? null,
      shake: +shakeMul.toFixed(3),
      since: +(clock - escapedAt).toFixed(2),
    };
  },
  mute(v) { audio?.setMuted(v); return audio?.muted ?? null; },
  /**
   * ★ 「뿌리친 3초」를 **소리로 실제로 재 본다.**
   *
   *   화면 검사와 달리 소리는 눈으로 못 본다. 그래서 게임과 **똑같은 코드**를
   *   OfflineAudioContext 에 태워 파형을 뽑고, 0.1초마다 크기(RMS)를 센다.
   *   검사용으로 따로 짠 코드를 재면 검사는 통과하는데 게임은 안 나는
   *   상태가 생긴다 — 이 저장소가 제일 자주 밟은 함정이다.
   *
   *   돌려주는 것: 추격 동안의 크기 → 뿌리친 뒤 푹 꺼짐 → 되돌아옴.
   */
  async auditEscape({ chaseFor = 3, tail = 2, step = 0.1 } = {}) {
    const sr = 12000;                       // 크기만 재므로 낮춰도 된다 (빠르다)
    const len = chaseFor + ESCAPE.total + tail;
    const off = new OfflineAudioContext(1, Math.ceil(sr * len), sr);
    const a = makeAudio(off);
    const tick = 0.05;
    for (let t = 0; t < chaseFor; t += tick) a.update({ phase: 'chase', urgency: 0.6, heat01: 0.3, turning: 0 }, t);
    a.event('escaped', chaseFor);
    for (let t = chaseFor; t < len; t += tick) a.update({ phase: 'shaken', urgency: 0, heat01: 0.3, turning: 0 }, t);
    const buf = await off.startRendering();
    const d = buf.getChannelData(0);
    const n = Math.floor(sr * step);
    const rms = [];
    for (let i = 0; i + n <= d.length; i += n) {
      let s = 0;
      for (let j = 0; j < n; j++) s += d[i + j] * d[i + j];
      rms.push(+Math.sqrt(s / n).toFixed(5));
    }
    return { step, escapeAt: chaseFor, total: ESCAPE.total, rms };
  },
  /** 떨림도 같은 모양을 읽나 — 소리와 위상이 맞는지 밖에서 견줘 본다 */
  shakeAt(t) {
    const e = envelope(t);
    return +(ESCAPE.shake + (SHAKE.calm - ESCAPE.shake) * e).toFixed(3);
  },
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
  // ★ 조종간을 잡고 있으면 마우스가 **시선이 아니라 배**를 움직인다.
  //   `steering` 은 지난 프레임의 판정이라 한 프레임 늦는다 — 조준은
  //   interactStep 에서 나오고 그건 이 아래에서 돈다. 16ms 라 안 느껴진다.
  if (steering) {
    steerPush = Math.max(-1, Math.min(1, look.dx * 0.03));
    me.pitch = Math.max(-1.35, Math.min(1.35, me.pitch - look.dy * 0.0022));
  } else {
    steerPush = 0;
    me.yaw -= look.dx * 0.0022;
    me.pitch = Math.max(-1.35, Math.min(1.35, me.pitch - look.dy * 0.0022));
    // 얼마나 둘러봤나 — 조종간을 잡고 있을 때는 안 센다. 그건 배를 민 것이다
    taught.turned += Math.abs(look.dx) * 0.0022;
  }

  walk(dt);

  // ── 항로가 나아간다 ────────────────────────────────────
  // ★ 전에는 구역이 95초마다 **돌았다.** 지금은 관측실에서 고른 갈래가
  //   정하고, **추진을 켜야 나아간다** (game/route.js).
  const rev = stepRoute(route, dt, power);
  if (rev === 'arrive' || rev === 'end') newLeg(hazard);
  if (rev === 'arrive') {
    banner = `거점 — 남은 ${legsLeft(route)}`;
    bannerT = 3.0;
    audio?.event('escaped');       // 거점은 뿌리친 것과 같은 안도다
    escapedAt = clock;
    // ★ **소리가 거짓말을 하고 있었다.** 도착할 때 「뿌리쳤다」 소리를
    //   내면서 정작 추격은 안 끝냈다. 거점이 안전하다면 쫓아온 것도
    //   여기서 떨어져 나가야 한다 — 소리에 맞춰 실제로 끝낸다
    if (chase.phase === PHASE.CHASE || chase.phase === PHASE.CAUGHT) {
      chase.phase = PHASE.SHAKEN; chase.timer = 0; chase.risk = 0; chase.dist = 0;
    }
  }
  if (rev === 'overrun') {
    // 그물이 닫혔다 — 자국이 얼마든 붙는다 (route-table.js PRESS 참고)
    banner = '따라잡혔습니다 — 그물이 닫혔습니다';
    bannerT = 3.0;
    if (chase.phase === PHASE.CALM) chase.risk = 200;
  }
  if (rev === 'end') {
    banner = '더는 따라오지 못합니다';
    bannerT = 6.0;
    audio?.event('escaped');
    escapedAt = clock;
  }
  // 검사용 고정이 걸려 있으면 그것을 따른다 (게임은 안 쓴다)
  const wantRegion = regionPin || regionOf(route);
  if (wantRegion !== ship.outside.region) ship.outside.setRegion(wantRegion);

  // ── 배가 간다 ──────────────────────────────────────────
  // 창밖을 흘려보내고, 배가 미세하게 떤다. 둘 다 없으면 **정지 화면**이다.
  // ★ 거점에 서 있거나 추진이 꺼져 있으면 **느리게 흐른다** — 창밖이
  //   항로와 어긋나면 「가는 척하는 화면」이 된다
  const cruise = route.phase === RPHASE.PORT ? 0.25 : (power.thrust ? 1 : LEG.coast);
  ship.outside.update(dt, CRUISE.speed * cruise, hazard.lane, incoming(hazard));

  // 해도대 — 관측실에 있든 없든 계속 그린다. 걸어 들어갔을 때 이미 맞아 있어야 한다
  // ★ **해도대가 어긋나면 눈금이 밀린다** (chartDrift). 다만 **거짓말인 줄은
  //   알게** 한다 — 값이 떨리므로 「지금 이 숫자를 못 믿는다」가 보인다.
  //   모르고 속으면 그건 고장이 아니라 사기다
  const lie = bad.chartLie ? Math.sin(clock * 2.3) * 14 : 0;
  ship.chart.update({
    leg: route.leg, press: Math.max(0, Math.min(100, route.press + lie)),
    atPort: route.phase === RPHASE.PORT, offer: route.offer,
  });

  // ── 떨림 — 뿌리쳤을 때의 **낙차**를 만드는 쪽 ──────────
  // 추격 중엔 배가 더 떤다. 그래야 뿌리친 3초가 「조용해졌다」로 읽힌다.
  // 평소가 계속 잔잔하면 뺄 것이 없어서 보상이 안 생긴다 (USER-VIEW §3-6).
  //
  // ★ 소리의 덕킹과 **같은 모양 함수**를 읽는다 (audio-table.js envelope).
  //   비슷하게 따로 짜 두면 언젠가 한쪽만 고쳐지고, 그 어긋남은 화면으로
  //   원인을 못 찾는다.
  const since = clock - escapedAt;
  let wantShake;
  if (chase.phase === PHASE.CHASE) {
    const u = 1 - chase.dist / CH.escapeAt;
    wantShake = SHAKE.chase[0] + (SHAKE.chase[1] - SHAKE.chase[0]) * Math.max(0, Math.min(1, u));
  } else if (since < ESCAPE.total) {
    const e = envelope(since);
    wantShake = ESCAPE.shake + (SHAKE.calm - ESCAPE.shake) * e;
  } else wantShake = SHAKE.calm;
  // 굶으면 손이 떨린다 — 눈에도 보여야 한다 (PLAN §5-2)
  if (shaky(supply)) wantShake *= FOOD.shakeMult;
  // 부딪힌 순간은 크게 한 번 — 「맞았다」가 몸에 남아야 다음엔 앉는다
  hitFlash = Math.max(0, hitFlash - dt * 0.7);
  wantShake += hitFlash * 7;
  // 보상 구간에서는 표가 정한 모양을 **그대로** 쓴다 (따라가면 뭉개진다).
  // 그 밖에서는 부드럽게 따라간다 — 추격이 붙는 순간 화면이 튀지 않게.
  shakeMul = since < ESCAPE.total ? wantShake
    : shakeMul + (wantShake - shakeMul) * Math.min(1, dt * 2.2);

  // 진동은 **아주 작게.** 1인칭에서 화면 흔들림은 조금만 넘겨도 멀미가 난다.
  // 「느껴지는데 뭔지 모르겠는」 정도가 맞다.
  const sh = CRUISE.shake * shakeMul * Math.sin(clock * CRUISE.shakeHz * Math.PI * 2);
  const sw = CRUISE.sway * shakeMul * Math.sin(clock * CRUISE.swayHz * Math.PI * 2);
  camera.position.set(me.x + sw * 0.4, BODY.eye + sh + sw * 0.25, me.z);
  camera.rotation.set(0, 0, 0, 'YXZ');
  camera.rotation.y = me.yaw;
  camera.rotation.x = me.pitch;
  camera.rotation.z = sw * 0.06;   // 아주 살짝 기운다

  const valveOpen = interactStep(dt);
  systemsStep(dt, valveOpen, signMult(route));

  // 화면 한복판 글자 — 잠깐 떴다 사라진다
  if (bannerT > 0) {
    bannerT -= dt;
    hud.textContent = banner;
    hud.hidden = false;
  } else hud.hidden = true;

  // ── 가르침 — **하면 사라진다** (docs/space/TUTORIAL.md) ──
  // ★ 배너와 **다른 자리·다른 색**이다. 배너(위·주황)는 *일어난 일*이고
  //   가르침(아래·청록)은 *아직 안 한 일*이다. 같이 두면 뭉개진다
  if (!allDone(tutor)) {
    if (stepTutor(tutor, dt, tutorState()) === 'show') audio?.event('click');
    const ln = lineOf(tutor, aimName);
    if (ln) {
      lesson.textContent = ln.text;
      lesson.classList.toggle('dim', ln.dim);
      lesson.hidden = false;
    } else lesson.hidden = true;
  } else lesson.hidden = true;

  // ── 바닥 안내선 — **가르침이 도는 동안만** ─────────────────
  // ★ 사장님: 「진행 방향으로 바닥에 선으로 목표 방향을 알려줘」.
  //   가르침은 동사를 말하고 방은 12초 뒤에야 말한다 (TUTOR.showWhere).
  //   그 사이에 처음 하는 사람은 13m 통로에서 헤맨다.
  //
  //   **일곱을 다 떼면 이 줄이 통째로 꺼지고 다시는 안 켜진다.** 그래야
  //   「어디인지는 안 말한다」(PLAN §3-1)가 본편에서 그대로 산다
  const aim = guideAim();
  guide.setPath(aim ? pathTo({ x: me.x, z: me.z }, aim, ROOMS, doors.list) : null);
  guide.update(dt);

  // ── 손목 장치 — **가르침이 끝난 뒤에도 뭘 할지 말해 준다** ──
  // ★ 가르침은 일곱 개로 끝난다 (첫 회차가 튜토리얼이므로). 그 뒤로
  //   **아무도 뭘 하라고 안 해서** 「아직도 뭘 해야할지 모르겠다」가 났다.
  //   손목이 그 자리를 이어받는다 — 다만 **어디인지는 여전히 안 말한다**
  const jd = jammedOne(doors);
  wrist.update({
    job: wristJob = jobFor({
      doorJammed: !!jd,
      chasing: chase.phase === PHASE.CHASE,
      heatHigh: heat >= HEAT.warn,
      hazardSoon: hazard.phase !== HPHASE.IDLE,
      faultsOpen: faults.open.length,
      foodLow: shaky(supply),
      atPort: route.phase === RPHASE.PORT,
      // ★ 추격 때 **할 일을 고르는 재료**다 (wrist-table.js JOBS.chase).
      //   숫자로 나가는 게 아니라 「추진을 켭니다」 같은 **동사 한 줄**이
      //   되어 나온다 — 열 수치 자체는 여전히 조종석이 갖는다
      thrust: power.thrust,
      cool: power.cool,
      heat,
      ore: supply.ore,
    }),
    // 고친 것 — **정비실까지 안 가도 보인다.** 이게 사장님이 말씀하신 것이다.
    // ★ 갯수는 `log.length` 가 아니라 `fixed` 다 — 기록은 여섯에서 잘리므로
    //   log 로 세면 일곱 번째부터 「고친 것 6」에 멈춰 선다
    log: faults.log.map((l) => l.reveal),
    fixed: faults.fixed,
    clock, raised,
  }, dt);

  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 잠금 안내는 처음 한 번만. 잠기면 사라진다
setInterval(() => { hint.hidden = input.locked; }, 200);

console.log(`스페이스워 v${VERSION} — ${roomAt(me.x, me.z)} 에서 시작`);
