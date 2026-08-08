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
import { BODY, HEAT, VALVE, CRUISE, FOCUS } from './game/systems-table.js';
import { REGION_BY_KEY } from './game/regions-table.js';
import { CIRCUITS, POWER_MAX, SIGN, CHASE as CH, CAUGHT, HEATING } from './game/chase-table.js';
import { makeChase, stepChase, resetChase, heatRate, canTurnOn, PHASE } from './game/chase.js';
// ★★ v58 — 열이 두 칸이 됐다 (선체 온도 / 열 저장고). docs/space/REAL.md §4-A
import { SINK, SINK_WORD, coolEfficiency } from './game/heat-table.js';
import { stepHeat, sinkFull, sinkAt, hideLeft } from './game/heat.js';
import { LEG, forkOf } from './game/route-table.js';
/** 자국은 열에 비례한다. 윈치의 자국 보탬을 열 단위로 환산하려고 쓴다 */
const SIGN_PER_HEAT = SIGN.perHeat;
import {
  makeRoute, stepRoute, chooseFork, contactAt, trackMult, signMult, isBlind,
  regionOf, progress, relieveEscape, legsLeft, missPort, RPHASE,
} from './game/route.js';
import { FAULT, BY_KEY } from './game/mission-table.js';
import { FOOD, WINCH, TRADE, ORE, PARTS } from './game/supply-table.js';
import { HAZARD } from './game/hazard-table.js';
import {
  makeHazard, stepHazard, steerShip, newLeg, incoming, warnLeft, clearOf, HPHASE,
} from './game/hazard.js';
import {
  makeSupply, stepSupply, winchStep, canTrade, trade, canRepair, spendParts,
  shaky, slipMult, legsLeftOnFood,
} from './game/supply.js';
import {
  makeFaults, stepFaults, hereIn, nearness, effectsOf, repairStep, clear, slip, openList, siteOf,
  wearStep, wearFlip, open as openFault,
} from './game/fault.js';
import { makeTutor, stepTutor, lineOf, nowKey, allDone, canFire, gripLine, markGrip } from './game/tutor.js';
import { TUTOR, KEYS as TUTOR_KEYS } from './game/tutor-table.js';
import { DOOR, nearDoor, canPass } from './game/door-table.js';
import { WRIST, jobFor, actShows } from './game/wrist-table.js';
import { poseAt, actAt } from './game/repair-table.js';
import { RUN, WHY as RUN_WHY } from './game/move-table.js';
import { makeMove, moveStep, bump as moveBump, handMult as breathMult,
  summary as moveSummary } from './game/move.js';
import { buildHolo } from './world/holo.js';
import { buildHands } from './world/hands.js';
import { bothHands } from './game/hand-table.js';
import { buildGuide } from './world/guide.js';
import { AIMS, pathTo } from './game/guide-table.js';
import { makeDoors, stepDoors, jammedOne, summary as doorSummary } from './game/door.js';
import { SCENES, EMBER } from './game/scene-table.js';
import { DRIFT } from './game/drift-table.js';
import { HELM, HELM_SEAT, FLY_VIEW, SIT_LOOK, offWord, hitWord } from './game/helm-table.js';
import { GUN, SEAT as GUN_SEAT, WHY as GUN_WHY } from './game/gun-table.js';
// ★★★ v64 — 조종석 전투 (레이더 · 락온 · 미사일)
import { RADAR, WEAPONS, WEAPON_LIST, WHY as CBT_WHY, lockWord } from './game/combat-table.js';
import {
  makeCombat, weaponOf, isLocked, stepRadar, stepShots, stepCool,
  pickSlot, fire as fireWeapon, forgetLock, summary as cbtSummary,
} from './game/combat.js';
import { HULL } from './game/target-table.js';
import { spawnRaider } from './game/target.js';
// ★★ v60 — 세 축 + 짐벌 (사장님 「360도 회전 · 위아래 · 실제 우주선 개념」)
import { AXES, attitudeWord, rollDeg } from './game/flight-table.js';
import { makeFlight, stepFlight, offCourse, gimbalBusy, summary as flySummary }
  from './game/flight.js';
import { VOID, isVoid } from './game/void-table.js';
import { RESCUE, RSTEP, RESCUE_WORD } from './game/rescue-table.js';
import { DARK, DSTEP } from './game/blackout-table.js';
import {
  makeDark, killPower, stepDark, isDark, canReset as canResetDark,
  settled as darkDone, summary as darkSummary,
} from './game/blackout.js';
import {
  makeRescue, hearSignal, stepRescue, passSignal, canAnswer,
  broadcasting as radioOn, holding as rescueHold, alongside as rescueNear,
  settled as rescueDone, word as rescueWord, summary as rescueSummary,
} from './game/rescue.js';
import { END } from './game/ending-table.js';
import { endList, endWord } from './game/ending.js';
import {
  makeGun, climb as climbGun, stepGun, fire as fireShot,
  flashSign, busy as gunBusy, summary as gunSummary,
} from './game/gun.js';
import { TURRET_RISE } from './world/turret.js';
// ★ 떠도는 것들 — 우주 쓰레기와 죽은 위성 (사장님 요청 · game/target-table.js)
import { KINDS as TKINDS, TARGET } from './game/target-table.js';
import {
  makeSky, setRegion as setSkyRegion, stepSky, shootSky, aimedAt, tolOf, inRange,
  summary as skySummary,
} from './game/target.js';
import { LOCK, WHY as LOCK_WHY, airWord } from './game/airlock-table.js';
import {
  makeLock, cycle as cycleLock, stepLock, canHaul, haulWhy,
  innerLocked, signOf as lockSign, heatOut as lockHeatOut, summary as lockSummary,
  isVacuum as lockVacuum, bareLeft,
} from './game/airlock.js';
// ★★ 우주복 — **진공에 사람이 그냥 서 있었다** (v62 · REAL.md §2-C)
import { SUIT, suitWord } from './game/suit-table.js';
import {
  makeSuit, stepWear, stepSuit, canEva,
  handMult as suitHand, moveMult as suitMove, summary as suitSummary,
} from './game/suit.js';
// ★★ 추진제 — **10분 시계를 맞는 물건으로 옮겼다** (v62 · REAL.md §2-D)
import { FUEL, fuelWord, isDry, legsLeftOnFuel } from './game/fuel-table.js';
import { STEP as LSTEP, LAND, WHY as LAND_WHY, STEP_WORD, tiltWord, bandFor }
  from './game/land-table.js';
import {
  makeLand, offerPlanet, passPlanet, beginLand, liftOff, stepLand, loadStep,
  canLoad as canLoadLand, loadWhy, onGround as landDown, burning as landBurn,
  moving as landMoving, busy as landBusy, signOf as landSign, heatOf as landHeat,
  noCool as landNoCool, summary as landSummary,
} from './game/land.js';
import {
  makeHelm, stepHelm, tryDock, legOf as helmLeg, signOf as helmSign,
  radians as helmRad, summary as helmSummary, takeHelm, engageAuto,
} from './game/helm.js';
import {
  makeDrift, kill as killDrift, fixed as driftFixed, stepDrift,
  holdHeat as driftHeat, radians as driftRad, danger as driftDanger,
  summary as driftSummary,
} from './game/drift.js';
import {
  makeScenes, newLeg as sceneLeg, stepScene, running as sceneOn, warning as sceneWarn,
  opens as sceneOpen, resolve as sceneDone, emberAt, emberWorth,
  allowChore, leadOf, summary as sceneSummary,
} from './game/scene.js';
import { makeRng } from './core/rng.js';
// ★ 점검 모드 (F2) — 사장님 「테스트를 할 수가 없잔아」. 게임을 안 고치고
//   이미 있는 SPACE.* 구멍을 **버튼으로** 낸다 (core/check.js)
import { buildCheck } from './core/check.js';
// ★ 영구 손상 — **배가 망가져 간다** (PLAN2H §8 · 6판). 못 고치고 우회한다
import { SCARS, scarWord } from './game/scar-table.js';
import {
  makeScars, noteFix, noteScene, has as hasScar, valveMult as scarValve,
  signOf as scarSign, list as scarList, summary as scarSummary,
} from './game/scar.js';
import { pack, apply, where } from './game/save.js';
import { SAVE } from './game/save-table.js';
import { saveRaw, loadRaw, clearRaw, canSave, hasSave } from './core/store.js';
import { buildCarry } from './world/carry.js';
import { KINDS as CARRY_KINDS, CARRY, canGrab, carryPlan } from './game/carry-table.js';
import { makeCarry, carryStep, atSpot, give as giveCarry, take as takeCarry,
  summary as carrySummary } from './game/carry.js';

export const VERSION = 66;

const canvas = document.getElementById('view');
const cross = document.getElementById('cross');
const hint = document.getElementById('hint');
const hud = document.getElementById('hud');
const lesson = document.getElementById('lesson');
const pauseBox = document.getElementById('pause');
// ★ 게임 오버 — 이 게임의 유일한 끝 (행성 충돌 · 수동 조작 중에만)
const overBox = document.getElementById('over');
const endBox = document.getElementById('end');
const check = buildCheck();

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
/** 평소 화각 — 손잡이를 잡으면 `FOCUS.fov` 로 당겨진다 (v59) */
const FOV_WIDE = 72;
/** 지금 얼마나 당겨져 있나 0~1 */
let focusK = 0;
/** ★★ 조종석 좌석에 앉아 있나 (v61) · 그리고 얼마나 앉았나 0~1 */
let helmSat = false;
let helmSitK = 0;
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
// ── 옮길 수 있는 물건 ────────────────────────────────────────
// ★ 벨크로 자리는 **베이 번호**로 찾는다 (game/carry-table.js SPOTS).
//   좌표를 여기 또 적으면 랙을 옮길 때마다 자리가 허공에 남는다
const carryView = buildCarry(ship.group, camera, ship.byBay);
const carry = makeCarry();
// 달리기와 숨 (game/move.js · PLAN2H §7-2)
const move = makeMove();
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
// ★★ **열 저장고** (v58). 배는 열을 버릴 수는 있어도 없앨 수는 없다 —
//   냉각 회로는 선체에서 여기로 **옮기고**, 라디에이터를 열어야 **나간다**.
//   가득 차면 냉각이 안 먹고 선체가 오른다. 이게 「얼마나 숨을 수 있나」다
let sink = SINK.start;
let turn = 0;             // 밸브를 얼마나 돌렸나 (0~1)
/** ★ 냉각 밸브가 **열려 있나.** 잠글 때까지 열린 채다 (VALVE.latching) */
let coolOpen = false;
/** 조준이 잠깐 벗어나도 봐주는 남은 시간 */
let valveGrace = 0;
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

/**
 * 열이 어떻게 움직였나 — **그래프 한 줄.**
 * ★ 밸브를 잡고 있는 동안에만 홀로그램에 뜬다. 아무 데서나 보이면 그건
 *   조종석 계기를 손목에 옮긴 것이고, 그러면 방을 도는 이유가 사라진다
 */
const trend = [];
let trendAt = 0;

/** 지금 잡고 있는 것의 진행 — 손잡이마다 세는 것이 다르다 */
function actNow() {
  const show = actShows(aimName, input.hold);
  if (!show) return null;
  const head = String(aimName).split(':')[0];
  const t = head === 'valve' ? turn
    : head === 'crank' ? (cranking ? cranking.held / DOOR.crank : 0)
      : head === 'panel' ? (repairing?.held ?? 0) / (repairing?.steps[repairing.step]?.hold ?? 1)
        : head === 'hatch' ? trading / TRADE.hold
          : head === 'winch' ? supply.hauled / WINCH.load   // 다음 한 통까지
            : 1;
  const label = head === 'valve' ? '밸브를 돌립니다'
    : head === 'crank' ? '크랭크를 돌립니다'
      : head === 'panel' ? '고치는 중입니다'
        : head === 'hatch' ? '바꾸는 중입니다'
          : head === 'winch' ? '끌어옵니다'
            : '잡고 있습니다';
  return { label, t: Math.max(0, Math.min(1, t)), heat: show.heat };
}

let raised = false;
const wrist = buildHolo(camera);
const hands = buildHands(camera);
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

// ══ 장면 — **구간이 사건을 부른다** (PLAN2H §1·§5) ══════════════
// ★ 지금까지 사건은 저마다 제 타이머로 왔다. 그래서 **아무 때나 겹쳤고,
//   아무 때도 안 겹쳤다.** 겹치는 것이 우연이면 절정이 없다.
const scenes = makeScenes(seed);
sceneLeg(scenes, 1);

// ══ ★ C — 자세 제어가 죽는다 (PLAN2H §4) ══════════════════════
// ★ **조종석에 사람이 있어야 하는데, 고칠 것은 조종석 밖에 있다.**
//   정비공 게임의 축(「동시에 두 곳에 못 있는다」)이 처음으로 켜지는 자리다
const drift = makeDrift();

// ══ 조종 — **조종간이 늘 먹는다** (사장님 「조종석을 움직일 수 없잖아」) ══
// ★ 잰 값: 조종간이 뭔가를 하는 때가 **잔해 지대 안뿐**이었고 그건 회차의
//   10% 다. 나머지 90% 동안 잡아도 아무 일이 없었다 — 배에 조종석이
//   있는데 배를 못 몰았다.
//   그렇다고 조종을 늘리면 장르가 바뀌므로(CHASE2 §5), **매인 시간은
//   그대로 두고** 조종간이 늘 먹게 한다: 잡으면 **항로를 벗어난다.**
const helm = makeHelm();

// ══ 주포 — **조종석 위로 올라간다** (사장님 요청) ══════════════
// ★ `CHASE2.md §5` 에 「미사일·함포는 안 한다」고 적어 뒀던 것이다.
//   사장님이 원하시니 만들되 **이 배의 문법으로** — 탄약이 곧 수리
//   재료라 「쏘면 못 고친다」가 되고, 쏘면 밝아져서 「쏘고 도망」이
//   늘 옳지 않게 된다 (game/gun-table.js).
const gun = makeGun();
/**
 * ★★★ 조종석 전투 (v64) — 사장님 「공격은 조정석에서 다 이루어질 수 있도록」.
 *
 *  ★ 좌석이 하나가 됐다. 실제 전투기가 그렇다 — **기총은 기수에 고정**이고
 *    조종간이 곧 조준이다. 「어디를 보느냐」와 「어디로 가느냐」가 같은 손짓.
 *  ★ 레이더는 **새로 안 만든다** — `power.sensor`(능동 탐지 차단기)가
 *    이미 그것이다. 켜면 보이고, 켜면 보인다 (자국 20).
 */
const combat = makeCombat();
/** ★ G 구조 신호 — 2시간에 한 번뿐인 남의 목소리 (7판) */
const rescue = makeRescue();
/** ★ E 정전 — 어두우면 소리밖에 없다 (7판) */
const dark = makeDark();
// ★★ **포탑이 겨누는 쪽** — 방위·고도(도). WASD 가 여기를 움직인다.
//   사람이 보는 쪽과 **따로** 논다 — 그게 「실내에서 원격으로 돌린다」다
let aimAz = 0, aimEl = 0;
/** 떠도는 것들 — 창밖에 실제로 있고, 조준경이 그린다 */
const sky = makeSky(makeRng(`${seed}-SKY`));

// ══ 에어록 바깥문 — **열고 우주에서 낚는다** (사장님 요청) ══════
// ★ 윈치는 이미 있었다. 없던 것은 **밖으로 난 구멍**이고, 그게 생기면
//   채굴이 「잡고 있기」에서 **「갇혀서 잡고 있기」**가 된다 —
//   바깥문이 열려 있으면 안쪽 문이 잠긴다 (game/airlock-table.js).
const lock = makeLock();

// ══ ★★ 우주복 — **에어록 문의 조건** (v62) ═══════════════════
// ★ 넷째 시계가 **아니다.** REAL.md §7 이 「시계는 열·추진제·식량 셋으로
//   끝」이라고 못박아 뒀다. 우주복은 「나갈 수 있나」라는 조건 하나이고,
//   값은 **둔한 손**으로 치른다 — 그래서 늘 입고 다니지 않는다
const suit = makeSuit();

// ══ 행성 착륙 — **내려서 가지고 온다** (사장님 요청 · 장면 B) ═══
// ★ 「착륙을 하는 일련의 과정도 있어야지 — 발견 · 조작 · 화면이 바뀌는 것」
//   그래서 셋을 다 건다: 해도대에 뜨고(관측실), 조종간으로 진입각을 잡고
//   (조종석), 바깥문을 열고 싣는다(에어록). **여덟 장면 중 이것만
//   방 셋을 거친다** (game/land-table.js).
const land = makeLand();
// ★ **항로의 난수를 빌려 쓰지 않는다.** 같이 쓰면 착륙을 한 번 할 때마다
//   항로가 뽑는 갈래가 밀려서, 같은 시드인데 매번 다른 항로가 된다 —
//   `rng.js` 가 「시드가 같으면 항로도 같아야」라고 적어 둔 그 자리다
const landRnd = makeRng(`${seed}-LAND`);

// ══ 영구 손상 — **2시간을 하나로 묶는 것** ════════════════════
// ★ 장면은 끝나면 사라지고 고장은 고치면 없어진다. 그래서 지금까지
//   구간 11 의 배와 구간 2 의 배가 똑같았다. 흉터는 **안 없어진다** —
//   못 고치고 **우회**한다 (game/scar-table.js).
const scars = makeScars();
/** 흉터가 하나 생겼다 — **무엇이 달라지는지까지** 말한다 (고장과 다르다) */
function sayScar(key) {
  if (!key) return;
  banner = SCARS[key].lead;
  bannerT = 5.0;
  audio?.event('caught');
  hitFlash = 0.6;
}

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ 조종석에서 쏜다 (v64) — 사장님 「공격은 조정석에서 다 이루어질 수
//     있도록 … 기존 전투기들 전투 데이터를 참고해서 … 레이더, 미사일, 락온」
//
//  ★ **좌석이 하나가 됐다.** 조준석(주포)을 걷어내고 조종석으로 합쳤다.
//    실제 전투기가 그렇다 — 기총은 기수 고정이고 **조종간이 곧 조준**이다.
//
//  ★ 겨눔은 **배의 자세**에서 나온다 (`fly3.yaw` · `fly3.pitch`).
//    조종간을 밀어 기수를 돌리면 그게 조준이다. 겨눔을 따로 두면
//    「배는 저쪽을 보는데 총은 이쪽」이 되고, 그건 계기가 둘인 것이다.
// ══════════════════════════════════════════════════════════════════════════
const DEG = 180 / Math.PI;
const clampA = (v, lim) => Math.max(-lim, Math.min(lim, v));
/** 지금 기수가 가리키는 곳 (도) — 조준경과 레이더가 같은 값을 쓴다 */
function noseAim() {
  return {
    az: clampA(fly3.yaw * DEG, TARGET.azLimit),
    el: clampA(fly3.pitch * DEG, TARGET.elLimit),
  };
}

/** 한 발 쏜다 — **왜 못 쏘는지도 말한다.** 조용히 안 나가면 「고장」으로 읽힌다 */
function fireGun() {
  const a = noseAim();
  const aimed = aimedAt(sky, a.az, a.el);
  const r = fireWeapon(combat, { aimed, supply, rnd: Math.random });
  if (!r.ok) { banner = CBT_WHY[r.why] ?? '지금은 못 쏩니다'; bannerT = 2.4; return; }
  const w = r.weapon;
  audio?.event(w.key === 'cannon' ? 'caught' : 'latch');
  heat = Math.min(HEAT.max, heat + GUN.heatPerShot * (w.key === 'cannon' ? 1 : 2));
  // ★ **쏘면 밝아진다** — 총구 섬광과 사출은 숨길 수 없다 (v44 규약)
  gun.flash = Math.max(gun.flash ?? 0, w.signFor);
  banner = `${w.name} 발사`;
  bannerT = 1.4;
}

/** ★★ 날아간 것이 닿았다 — 부수거나 빗나간다 */
function landShots(dt) {
  const done = stepShots(combat, dt, {
    find: (id) => sky.list.find((t) => t.id === id) ?? null,
    lockedId: combat.radar.on ? combat.radar.id : null,
  });
  for (const d of done) {
    const t = d.target;
    if (!d.hit || !t) {
      banner = d.shot.lost ? '유도가 끊겼습니다' : '빗나갔습니다';
      bannerT = 1.8;
      continue;
    }
    t.hp -= d.shot.dmg;
    t.flash = 0.5;
    if (t.hp > 0) { banner = `${TKINDS[t.kind].name}에 맞혔습니다 — 맷집 ${t.hp}`; bannerT = 1.8; continue; }
    // 부쉈다
    sky.list = sky.list.filter((x) => x !== t);
    sky.killed++; combat.kills++;
    forgetLock(combat, t.id);
    const g = TKINDS[t.kind].gives;
    supply.ore = Math.min(ORE.max, supply.ore + g.ore);
    supply.parts = Math.min(PARTS.max, supply.parts + g.parts);
    supply.food = Math.min(FOOD.max, supply.food + g.food);
    const bits = [`광석 ${g.ore}`];
    if (g.parts) bits.push(`부품 ${g.parts}`);
    if (g.food) bits.push(`식량 ${g.food}`);
    banner = `${TKINDS[t.kind].name}을 부쉈습니다 — ${bits.join(' · ')}`;
    bannerT = 3.2;
    audio?.event('fixed');
  }
}

/**
 * ★★★ 밖의 것이 배에 닿았다 (v64) — 사장님 「충돌시 우주선이 흔들리지만
 *   적이나 우주선이 **내부로 들어오는 부자연스러운건 수정**해주고」.
 *
 *   안 들어오게 막는 것은 규칙(`target.js` 의 선체 바닥)이 하고,
 *   여기서는 **닿았을 때 배가 흔들리는 것**만 한다.
 */
function takeBumps(list) {
  for (const b of list) {
    const k = b.ram ? HULL.ram : HULL.graze;
    hitFlash = Math.max(hitFlash, k.shake);
    faults.wear.hull = Math.min(1, faults.wear.hull + k.hull);
    heat = Math.min(HEAT.max, heat + k.heat);
    audio?.event(b.ram ? 'caught' : 'latch');
    banner = b.ram ? '들이받혔습니다 — 선체가 깎였습니다' : `${TKINDS[b.kind]?.name ?? '파편'}이 스쳤습니다`;
    bannerT = b.ram ? 3.0 : 1.6;
  }
}

// ══ 저장 · 일시정지 ═══════════════════════════════════════════
// ★ **2시간짜리에는 협상 불가다** (PLAN2H §11-1). 저장이 없으면
//   2시간짜리를 **한 번도 끝까지 못 해 본 채로** 만들게 된다.
/** 저장할 것들을 한 곳으로 접는다 — `save-table.js FIELDS` 가 칸을 고른다 */
const world = () => ({
  route, chase, supply, faults, hazard, move, carry, tutor, scenes, drift, helm, gun, rescue, lock, land, scars, suit, combat,
  ship: { heat, sink, power, clock, seed, coolOpen },
  me,
});
/** 구간이 끝날 때 저장한다. **초마다 저장하면 되돌리기가 된다** */
function saveNow() {
  const box = world();
  const raw = pack(box);
  // heat·clock 은 `let` 이라 world() 가 뜬 값을 담는다 — pack 뒤에 손대지 않는다
  return saveRaw(raw);
}
/** 켤 때 한 번. 이어했으면 true */
function loadOnce() {
  const raw = loadRaw();
  if (!raw) return null;
  // ★ **다른 항로의 저장은 안 잇는다.** 시드가 항로·고장·문·잔해를 전부
  //   정하므로, `?seed=ABC` 로 열어 놓고 옛 저장을 덮으면 「구간 7」이
  //   전혀 다른 항로의 7이 된다 — 배는 멀쩡해 보이는데 다니는 길이 다르다.
  //   **지우지는 않는다.** 시드를 붙여 잠깐 들여다본 것 때문에 원래 회차가
  //   사라지면 그건 저장이 아니라 함정이다
  if (raw.ship?.seed && raw.ship.seed !== seed) {
    console.warn(`[저장] 다른 항로(${raw.ship.seed})의 저장이라 안 잇습니다 — 그대로 둡니다`);
    return null;
  }
  const box = world();
  if (!apply(box, raw)) { clearRaw(); return null; }
  // ★ `let` 로 들고 있는 것들은 손으로 되돌린다 — 객체가 아니라 값이라
  //   `apply` 가 못 건드린다. 여기를 빠뜨리면 「열만 0 으로 시작」이 된다
  heat = box.ship.heat ?? heat;
  sink = box.ship.sink ?? SINK.start;
  clock = box.ship.clock ?? clock;
  Object.assign(power, box.ship.power ?? {});
  coolOpen = box.ship.coolOpen ?? false;
  // ★★ **손을 놓은 채 시작한다** (2026-08-06 · 사장님 「왜 자꾸 주포에서
  //   시작하고 움직여지지가 않아?」). 앉아 있으면 `gunBusy` 가 걸음을 막으므로
  //   앉은 채 이어하면 **못 걷는 자리에서 시작한다.** 표에서 `up` 을 뺐지만
  //   여기서도 못박아 둔다 — 옛 저장이 남아 있거나 표를 다시 늘렸을 때
  //   조용히 되살아나면 그게 제일 찾기 어렵다
  gun.up = false; gun.moving = 0;   // ★ v64 — 주포는 없어졌다. 옛 저장을 위해 남긴다
  // ★ 그리고 **설 수 없는 자리면 되돌린다.** 옛 판본은 주포가 배 **위**였고
  //   그 자리가 저장돼 있으면 사방이 벽이라 영영 못 움직인다. 이런 몸은
  //   「이어한 것」이 아니라 **갇힌 것**이다
  if (!inside(me.x, me.z, BODY.radius)) {
    console.warn(`[저장] 설 수 없는 자리(${me.x.toFixed(1)}, ${me.z.toFixed(1)})라 조종석으로 되돌립니다`);
    me.x = 0; me.z = -5.4; me.vx = me.vz = 0;
  }
  return where(raw);
}
/** 일시정지 — 2시간을 한 번에 앉아 있을 수 없다 */
let paused = false;
/**
 * 멈춤 화면을 켜고 끈다 — **어디까지 왔는지를 여기서 말한다.**
 *
 * ★ 「남은 구간」을 노는 동안에는 화면에 안 띄운다. 그건 여전히 방이
 *   갖는다 (관측실 해도대). 하지만 **멈춘 화면에서까지 숨기면** 2시간짜리를
 *   며칠에 나눠 하는 사람은 자기가 어디쯤인지 영영 모른다 —
 *   그건 규칙을 지킨 게 아니라 규칙을 잘못 적용한 것이다.
 */
function showPause(on) {
  paused = on;
  pauseBox.hidden = !on;
  // ★ 멈춤 화면이 떠 있는 동안에는 **배너와 가르침을 접는다.**
  //   셋이 같이 뜨면 「거점 — 남은 7」과 「남은 거점 7」이 위아래로 겹쳐
  //   같은 말을 두 번 한다. 멈춘 화면에서 읽을 것은 하나여야 한다
  if (on) { hud.hidden = true; lesson.hidden = true; }
  if (!on) return;
  const left = legsLeft(route);
  const min = Math.round(clock / 60);
  pauseBox.querySelector('.where').textContent =
    `구간 ${Math.min(route.leg + 1, LEG.count)}/${LEG.count} · ${min}분째 · 남은 거점 ${left}`;
  // ★ 저장이 **됐는지**를 말한다. 사생활 보호 모드에서는 안 되는데,
  //   조용히 안 되면 사람은 「저장됐겠지」 하고 닫는다
  pauseBox.querySelector('.note').textContent = canSave()
    ? '여기까지 저장했습니다 — 창을 닫아도 이어집니다'
    : '이 브라우저에서는 저장이 안 됩니다 — 창을 닫으면 사라집니다';
}
/**
 * ★★ **행성을 박았다 — 이 게임의 유일한 끝** (2026-08-06 · 사장님
 * 「행성을 박으면 게임 오버로 수동조작시」)
 *
 * ★ 지금까지 이 게임에는 **끝이 없었다.** 잡혀도 놓아주고(`CAUGHT`),
 *   굶어도 손만 떨렸다. 그건 「벌은 숫자가 아니라 일」이라는 규약 때문이고
 *   대체로 옳았는데, **그래서 조종간에 무게가 하나도 없었다.**
 *   틀어 놓고 잊어도 거점을 한 번 지나칠 뿐이었다.
 *
 * ★ 그리고 이 끝은 **자동 항법을 끈 사람에게만** 온다. 켜 두면 절대 안
 *   박는다 — 자동 항법이 하는 일이 그것이다. 즉 죽음은 **고른 사람에게만**
 *   오고, 그래서 억울하지 않다.
 *
 * ★ 저장을 지운다. 안 지우면 다음에 켤 때 「부서진 배」로 이어져서
 *   끝난 자리에 다시 서 있게 된다 (도착했을 때와 같은 처리)
 */
function wreck() {
  if (wrecked) return;
  wrecked = true;
  clearRaw();
  audio?.event('caught');
  hitFlash = 1;
  const min = Math.round(clock / 60);
  overBox.querySelector('.where').textContent =
    `구간 ${Math.min(route.leg + 1, LEG.count)}/${LEG.count} · ${min}분째`;
  overBox.querySelector('.note').textContent =
    `수동으로 몬 시간 ${Math.round(helm.manualT)}초 · 고친 것 ${faults.fixed}개`
    + (land.trips ? ` · 행성에 ${land.trips}번 내렸다` : '');
  overBox.hidden = false;
  showPause(true);
}
/**
 * ★★ **도착했다 — 「이렇게 왔다」** (PLAN2H §9 · 8판)
 *
 * 게임 오버(`wreck`)와 **일부러 다르게 생겼다.** 저건 사고이고 이건
 * 도착이다. 그래서 붉지 않고, 「다시 해 보세요」를 안 쓴다.
 *
 * ★ **여기서 점수를 만들지 않는다.** 모아서 넘기기만 하고, 무엇을 띄우고
 *   무엇을 뺄지는 `game/ending-table.js` 가 정한다 — 표와 화면을 갈라 둬야
 *   `tools/space-end.js` 가 브라우저 없이 목록을 물을 수 있다.
 */
function showEnd() {
  if (ended) return;
  ended = true;
  const w = {
    minutes: clock / 60,
    legs: LEG.count,
    runs: chase.runs,
    fixed: faults.fixed,
    trips: land.trips,
    hits: gun.hits,
    shakyMin: shakyT / 60,
    rescue: RESCUE_WORD[rescue.step] ?? null,
    // ★ 이름으로 부른다 — 「손상 3」이 아니라 「냉각 계통 손상 · 선체 균열」
    scars: scarList(scars).map((s) => s.name),
    open: openList(faults).map((f) => f.name),
    food: supply.food, parts: supply.parts, ore: supply.ore,
  };
  endWhat = w;
  endBox.querySelector('b').textContent = END.title;
  endBox.querySelector('.where').textContent = END.where;
  endBox.querySelector('.again').textContent = END.again;
  const box = endBox.querySelector('.list');
  box.textContent = '';
  for (const g of endList(w)) {
    const h = document.createElement('p');
    h.className = 'grp';
    h.textContent = g.name;
    box.appendChild(h);
    for (const r of g.rows) {
      const row = document.createElement('div');
      row.className = 'row';
      const k = document.createElement('span'); k.className = 'k'; k.textContent = r.label;
      const v = document.createElement('span'); v.className = 'v'; v.textContent = r.value;
      row.append(k, v);
      box.appendChild(row);
    }
  }
  endBox.hidden = false;
  hud.hidden = true; lesson.hidden = true;
  paused = true;                      // 시계를 멈춘다. 다만 멈춤 화면은 안 띄운다
  if (document.pointerLockElement) document.exitPointerLock();
  console.log(`[끝] ${endWord(w)}`);
}
let taught = { walked: 0, turned: 0, flips: 0, fixed: 0, cooled: 0, hazardSeen: 0 };
let steering = false;     // 조종간을 잡고 있나 (한 프레임 늦게 반영된다 — 아래 참고)
let steerPush = 0;
/** ★ 세 축 (v60). `steerPush` 는 좌우 하나뿐이었다 — 우주는 삼차원이다 */
const fly3 = makeFlight();
const flyPush = { pitch: 0, yaw: 0, roll: 0 };
/** 걸으려 하는데 못 걸은 시간 — `GUN.freeAfter` 를 넘으면 저절로 일어난다 */
let stuckT = 0;
/** 마지막 프레임의 실제 부하 — `renderer.info` 는 매 패스 되돌아간다 */
let lastCost = { calls: 0, tris: 0 };
let hitFlash = 0;         // 부딪힌 순간의 화면 충격
let winching = false;     // 지금 윈치를 잡고 있나
let loading = false;      // 땅에서 싣고 있나 — 같은 손잡이, 다른 일
let liftHeldWas = false;  // 이륙은 제 셈을 갖는다 (눌린 순간을 두 곳에서 본다)
let autoHeldWas = false;  // 자동 항법 스위치도 제 셈을 갖는다
let gripping = false;     // ★ 조준 손잡이를 잡고 있나 — WASD 가 포탑을 돌린다
let fireHeldWas = false;  // 쏘는 것도 제 셈을 갖는다 (Space)
let wrecked = false;      // ★ 행성을 박았다 — 이 게임의 유일한 끝
/** ★ 도착했다 — 끝 화면을 한 번만 띄우려고 (8판 · PLAN2H §9) */
let ended = false;
let endWhat = null;
/** 굶어서 손이 떨린 시간 (초). 끝 화면 목록의 한 줄이 된다 */
let shakyT = 0;
let trading = 0;          // 접수구를 얼마나 잡고 있었나
let partsWarned = false;
// 손에 물건이 없어 못 고친다고 **한 번만** 말한다. 매 프레임 외치면 소음이다
let handWarned = false;
/** 지금 수리 손 모양 — 수리 중이 아니면 null (world/hands.js 가 읽는다) */
/** 지금 두 손이 찼나 — **가르침 줄이 읽는다.** 조용히 안 잡히면 「고장났다」로 읽힌다 */
let armsFullNow = false;
/** 지난 프레임에 잡고 있었나 — 「눌린 순간」을 잡으려고 */
let heldWas = false;
/** 주포 쪽의 「눌린 순간」 — 가르침 쪽 `heldWas` 와 **따로** 센다 */
let gunHeldWas = false;
let repairPose = null;
/** 지금 몇 번째 동작인가 — 넘어갈 때 소리와 말을 내려고 들고 있는다 */
let repairAct = null;
let repairing = null;     // 지금 잡고 있는 고장
let hearNear = 0;         // 소리가 얼마나 가까운가 0~1
/** ★ 지금 진공에 서 있나 (v62) — 손목이 이걸 제일 먼저 말한다 */
let vacNow = false;
/** ★★ 모는 눈이 얼마나 열렸나 0~1 (v63 · FLY_VIEW) */
let flyK = 0;
/** ★★ 조종간을 **쥐고 있나** — 조준선이 떠나도 놓을 때까지 쥔 것이다 (v63) */
let yokeHeld = false;

/**
 * ★★ **계기를 읽는 손잡이를 잡고 있나** (v63).
 *
 *   v59 의 「잡으면 들여다본다」는 **계기를 읽으려고** 만든 것인데,
 *   실제로 걸려 있던 것은 조종간과 주포뿐이었다 (`steering || gripping`) —
 *   즉 **읽을 것이 없는 손잡이에만 걸려 있었고, 읽을 손잡이에는 안 걸려
 *   있었다.** 사장님 말씀(「스크린 화면을 확대해서」)의 그 스크린은
 *   대시에 박힌 계기지 조종간이 아니다. 자리를 바로잡는다
 */
let readGrip = false;
/** ★ F(감압)가 연 미소운석이 아직 열려 있나 — 「저절로 낫는」 것을 막는다 */
let leakOpen = false;
let flakyT = 12;          // 배전 노후 — 다음에 제멋대로 내려갈 때까지
let flash = 0;            // 경보 깜빡임
let banner = '';          // 화면 한복판에 잠깐 뜨는 글자
/**
 * **잡았는데 안 먹을 때 왜인지 말한다** — 되풀이하지 않고.
 *
 * ★ 이 게임이 반복해서 걸린 병이다 (2026-08-04 · 사장님 「운전석 조정이
 *   안되잖아」). 손잡이를 잡았는데 아무 일도 안 일어나고 **왜인지도 안
 *   알려주면**, 그건 어려운 게 아니라 **고장난 것으로 읽힌다.**
 *   차단기 하나만 「전력이 모자랍니다」를 말하고 있었고, 윈치·접수구·해도대는
 *   조용했다.
 *
 *   매 프레임 띄우면 글자가 안 사라져서 배너가 벽지가 된다. 같은 말은
 *   한 번 하고 4초 쉰다.
 */
let nagAt = -99, nagWas = '';
function nag(text) {
  if (text === nagWas && clock - nagAt < 4) return;
  nagWas = text; nagAt = clock;
  banner = text; bannerT = 2.2;
  audio?.event('deny');
}
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
    // ★ v58 — 밸브 가르침이 이제 **저장고**를 보고 뜬다 (tutor-table.js valve)
    sink: sinkAt({ sink }),
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

  // ══ ★★ **손잡이를 잡고 있으면 WASD 가 걷기가 아니다** ══════
  //  사장님: 「손으로 손잡이를 잡고 wasd로 조준하는 것으로. 조종석, 주포 둘 다」
  //
  //  ★ 이게 v47 까지 「조종이 안 된다」의 마지막 조각이었다. 조종간은
  //    **마우스 좌우**로 밀게 되어 있었는데, 마우스는 동시에 시야도 돌린다 —
  //    그래서 밀고 있는지 둘러보는지가 손에서 구별이 안 됐다.
  //    **WASD 면 확실하다.** 그리고 잡는 동안은 걷지 않으므로 자리도 안 뜬다.
  if (steering) {
    // 조종간 — A/D 가 배를 튼다. W/S 는 안 쓴다 (배는 좌우로만 튼다)
    // ★ **마우스도 계속 먹게 둔다.** WASD 를 안 누르고 있을 때 0 으로
    //   덮어쓰면 마우스로 밀던 사람이 갑자기 조종을 잃는다 —
    //   조작을 하나 더 만드는 것이지 있던 것을 뺏는 것이 아니다
    if (r !== 0) {
      steerPush = Math.max(-1, Math.min(1, r));
      // ★★★ **v66 — 이 한 줄이 없었다.** `flyPush.yaw` 는 이 함수보다
      //   **윗줄에서 이미 마우스 값으로** 정해진 뒤라, A/D 로는 항로만
      //   조금 벗어나고 **기수가 안 돌았다.** 즉 A/D 로 미는 사람에게는
      //   조종간이 아무 일도 안 하는 물건이었다
      flyPush.yaw = steerPush;
    }
    return;
  }
  // ★ v64 — 여기 있던 「WASD 가 포탑을 돌린다」를 걷어냈다.
  //   **조준은 이제 기수가 한다** (조종간이 곧 조준 · `noseAim()`)
  // ★ 앉아 있으면 안 걷는다. 다만 **걸으려 하면 일어난다** — v52 에서
  //   주포 좌석에 갇혔던 것과 같은 함정을 안 판다
  if (helmSat) {
    if (f !== 0 || r !== 0) { helmSat = false; banner = '조종석에서 일어납니다'; bannerT = 1.8; }
    return;
  }
  // ★ v64 — 여기 있던 **주포 좌석 미끄러짐과 자동 일어나기**를 걷어냈다.
  //   좌석이 하나가 됐으므로 조종석 것(`helmSitK`)만 남는다.
  //
  //   ★★★ **도려내면서 그 아래 세 줄까지 같이 지웠다** — `sin`·`cos` 와
  //     **달리기 한 덩어리**(`mult`). 걸음이 통째로 죽었고, `node --check` 는
  //     둘 다 통과하며 **브라우저 첫 프레임에 터진다.** 두 번 연달아 겪었다.
  //     도려낼 때는 **도려낸 자리 아래가 무엇을 쓰는지**부터 본다.
  stuckT = 0;
  const sin = Math.sin(me.yaw), cos = Math.cos(me.yaw);

  // ── 달리기 (game/move.js · PLAN2H §7-2) ─────────────────
  // ★ **제자리에서 Shift 만 눌러도 숨이 빠지면** 그건 벌이 아니라
  //   함정이다. 실제로 움직이는 중일 때만 뛴 것으로 친다
  const moving = f !== 0 || r !== 0;
  const armsFull = !!(carry.held && CARRY_KINDS[carry.held]?.both);
  const mult = moveStep(move, dt, input.run, moving, {
    bothHands: armsFull,
    // ★ 어두우면 못 뛴다 (7판 · E 정전)
    dark: isDark(dark),
  });
  // ★ **조용히 안 막는다.** 못 뛰면 왜인지 말한다
  if (move.blocked) nag(RUN_WHY[move.blocked]);

  // yaw 0 일 때 앞은 -z
  // ★ 우주복을 입으면 걸음도 둔하다 (0.86). **크게 안 깎는다** —
  //   방 사이가 늘면 템포가 통째로 무너진다 (REAL.md §7 「안 하는 것」)
  const wantX = (-sin * f + cos * r) * BODY.speed * mult * suitMove(suit);
  const wantZ = (-cos * f - sin * r) * BODY.speed * mult * suitMove(suit);

  const k = Math.min(1, BODY.accel * dt);
  me.vx += (wantX - me.vx) * k;
  me.vz += (wantZ - me.vz) * k;

  const fast = Math.hypot(me.vx, me.vz) > BODY.speed * 1.15;
  const nx = me.x + me.vx * dt;
  if (inside(nx, me.z, BODY.radius)) me.x = nx; else { me.vx = 0; if (fast) stumble(); }
  const nz = me.z + me.vz * dt;
  if (inside(me.x, nz, BODY.radius)) me.z = nz; else { me.vz = 0; if (fast) stumble(); }

  // 얼마나 걸었나 — 첫 가르침이 이걸 보고 사라진다 (game/tutor-table.js)
  taught.walked += Math.hypot(me.vx, me.vz) * dt;
}

/**
 * 뛰다 벽·랙에 스쳤다 — **비틀거리고 손에 든 것을 놓친다.**
 * ★ 벌이 숫자가 아니라 **일**이다. 놓친 것은 다시 주우러 가야 한다.
 *   그리고 「좁은 배」가 여기서 처음으로 몸에 닿는다 (통로 폭 1.36m)
 */
function stumble() {
  if (!moveBump(move)) return;
  banner = '부딪혔습니다'; bannerT = 1.4;
  audio?.event('deny');
  // 두 손으로 안고 있던 것을 놓친다 — 제자리(정비실)로 돌아간다
  if (carry.held) {
    const it = carry.items.find((x) => x.kind === carry.held);
    if (it) it.spot = 'shop-a';
    carry.held = null;
  }
}

// ── 손이 닿는 것들 ──────────────────────────────────────────
// **잡고 돌리는 것**(밸브)과 **누르는 것**(차단기)이 다르다.
// 밸브는 끝까지 돌리는 데 시간이 들고, 차단기는 딸깍 하고 넘어간다.
// 둘을 같은 방식으로 만들면 손맛이 하나로 뭉개진다 (PLAN §8).
let aimName = null;
function interactStep(dt) {
  ray.setFromCamera(CENTER, camera);

  // 조준선에 뭐가 걸리나. 가까운 것 하나만 본다
  const plates = ship.cock.plates;
  const pans = Object.values(ship.panels);
  const targets = [ship.valve, ...ship.breakers.map((b) => b.hit), ...plates.map((p) => p.hit),
    ...pans.map((p) => p.hit), ship.winch.hit, ship.tradeHatch.hit, ship.cock.yokeHit,
    ...ship.doors.map((d) => d.view.hit), ...carryView.aimTargets,
    // ★ v64 — 주포 손잡이 셋(좌석·발판·손잡이)이 여기 있었다. 걷어냈다
    ship.cock.helmSeatHit,
    ship.outerDoor.hit, ship.cock.autoHit, ship.cock.thrHit, ship.radio.hit, ship.mainBreaker.hit,
    ...(ship.suitRack ? [ship.suitRack.hit] : [])];
  const hit = ray.intersectObjects(targets, true)[0];
  const near = hit && hit.distance <= BODY.reach;

  // 어느 것에 걸렸는지 — 부모를 타고 올라가며 찾는다
  let onValve = false;
  let breaker = null;
  let plate = -1;
  let panel = null;
  let onWinch = false, onHatch = false, onYoke = false, onRadio = false, onMain = false;
  let onSuit = false;
  let onHelmSeat = false;
  let onOuter = false, onAuto = false, onThr = false;
  let onCrank = null;
  let onSpot = null;
  if (near) {
    for (let o = hit.object; o; o = o.parent) {
      if (o === ship.valve) { onValve = true; break; }
      const b = ship.breakers.find((x) => x.hit === o);
      if (b) { breaker = b; break; }
      const pi = plates.findIndex((x) => x.hit === o);
      if (pi >= 0) {
        // ★★★ **`visible = false` 로는 안 막힌다** (v66). three.js 의
        //   레이캐스트는 **보이는지를 안 본다** — 화면에서만 사라지고
        //   손에는 그대로 잡힌다. 「안 보이는데 잡힌다」를 내가 만들어
        //   놓은 셈이고, 검사가 「항행 중인데 갈래 판이 잡힌다」로 잡았다.
        //   **고를 것이 있을 때만** 잡히게 여기서 가른다
        plate = (ship.cock.keyAt(pi) || ship.cock.landAt(pi)) ? pi : -1;
        break;
      }
      const pn = pans.find((x) => x.hit === o);
      if (pn) { panel = pn; break; }
      if (o === ship.winch.hit) { onWinch = true; break; }
      if (o === ship.tradeHatch.hit) { onHatch = true; break; }
      if (o === ship.cock.yokeHit) { onYoke = true; break; }
      // ★ 좌석 — **앉아 있을 때는 안 잡힌다.** 앉은 채로 좌석이 잡히면
      //   조종간을 잡으려다 일어나게 된다 (주포 좌석에서 이미 밟은 함정)
      if (o === ship.cock.helmSeatHit) { onHelmSeat = !helmSat; break; }
      if (o === ship.cock.autoHit) { onAuto = true; break; }
      if (o === ship.cock.thrHit) { onThr = true; break; }


      if (o === ship.outerDoor.hit) { onOuter = true; break; }
      // ★ 무전기는 **신호가 와 있을 때만** 잡힌다. 평소에 잡히면
      //   2시간에 한 번뿐인 것이 늘 있는 것처럼 읽힌다
      if (o === ship.radio.hit) { onRadio = canAnswer(rescue); break; }
      // ★ 주 차단기는 **어두울 때만** 잡힌다. 평소에 잡히면 「올려 두면
      //   되는 것」이 하나 늘 뿐이고, 이 장면의 무게가 사라진다
      if (o === ship.mainBreaker.hit) { onMain = canResetDark(dark); break; }
      // ★ 우주복 걸이 — **늘 잡힌다.** 「지금 입어야 하나」가 이 게임의
      //   결심이므로, 나갈 일이 있을 때만 잡히게 하면 그 결심이 사라진다
      if (ship.suitRack && o === ship.suitRack.hit) { onSuit = true; break; }
      const dv = ship.doors.find((x) => x.view.hit === o);
      if (dv) { onCrank = dv; break; }
      const sp = carryView.spotOf(o);
      if (sp) { onSpot = sp; break; }
    }
  }

  // ── 두 손으로 안고 있으면 **아무 손잡이도 못 잡는다** ──────
  // ★ 이게 「옮길 수 있는 물건」이 게임이 되는 지점 전부다
  //   (game/carry-table.js). 냉매통을 안고 가는 길에 문이 끼면 통을
  //   어딘가 붙여 놓고 크랭크를 돌려야 한다.
  // ★ **조용히 막지 않는다.** 조용한 손잡이는 「어렵다」가 아니라
  //   「고장났다」로 읽힌다 — 윈치·접수구·해도대에서 이미 겪었다
  armsFullNow = !!(carry.held && CARRY_KINDS[carry.held]?.both);
  const armsFull = armsFullNow;
  if (armsFull && !onSpot
    && (onValve || breaker || plate >= 0 || panel || onWinch || onHatch || onYoke || onCrank || onThr)) {
    nag(`${CARRY_KINDS[carry.held].name}을 안고 있습니다 — 어딘가 붙여 놓으세요`);
    onValve = false; breaker = null; plate = -1; panel = null;
    onWinch = false; onHatch = false; onYoke = false; onCrank = null; onThr = false;
  }

  // ★★ **지금 조종석 손잡이가 잡혀 있나** (v66). 이름을 하나씩 적는 대신
  //   묶어 둔다 — 손잡이를 늘릴 때마다 이 줄을 고쳐야 하는 것이 맞다
  const cockGrip = onYoke || onAuto || onThr || plate >= 0;
  // ★★★ **일어나는 것은 「자리가 굳은 뒤 · 빈 데를 누를 때」다** (v66).
  //
  //   앉는 순간 몸이 좌석으로 **미끄러지는 동안**(`slide`) 조준선이 흔들려
  //   한 프레임쯤 아무것도 안 잡히는 때가 생긴다. 그 프레임에 누르면
  //   손잡이를 누른 것인데 일어나 버린다 — 검사가 「자동 항법 스위치가
  //   잡힌다 ✔ → 누르니 『일어납니다』 ✘」로 정확히 잡아 줬다.
  //
  //   ★ **처음엔 「빈 데를 0.35초 넘게 보고 있어야」로 막았다가 물렀다.**
  //     `dt` 가 0.05 로 잘려 있어 헤드리스에서는 그 0.35초가 **일곱 프레임**
  //     이고, 그러면 「눌러도 안 일어난다」가 된다. 그리고 실제로도 그건
  //     **엉뚱한 것을 재는 조건**이다 — 막아야 하는 것은 「짧게 봤나」가
  //     아니라 **「자리가 아직 흔들리나」**다. 그걸 직접 묻는다.

  // ★ **잡은 순간에만** 손 쓰는 법을 한 번 봤다고 센다. 뜬 프레임마다
  //   세면 1초에 예순 번이라 즉시 그친다.
  // ★ `input.press` 를 안 쓴다 — 그건 `takePress()` 로 **소비해야** 꺼지는
  //   깃발이라, 여기서 그냥 읽으면 아무도 안 가져간 프레임 내내 참이다.
  //   눌린 **순간**은 잡음이 거짓→참으로 바뀐 그때다
  if (input.hold && !heldWas && aimName) markGrip(tutor, aimName);
  heldWas = input.hold;

  // ── 떼기 · 붙이기 ───────────────────────────────────────
  const carried = carryStep(carry, onSpot, input.hold, dt);
  if (carried === 'pulled') {
    banner = `${CARRY_KINDS[carry.held].name}을 떼어 냈습니다`; bannerT = 2.0;
    audio?.event('fixed');
  } else if (carried === 'stuck') {
    banner = '붙였습니다'; bannerT = 1.6;
    audio?.event('fixed');
  }
  // 거점에 서 있을 때만 눌린다 — 항행 중에는 판이 「항행 중」만 띄운다.
  // ★ 다만 **내릴 자리가 떠 있으면 항행 중에도 눌린다** (장면 B).
  //   판을 새로 안 만든다 — 「고르는 자리는 해도대」라는 규약을 그대로 쓴다
  const canPick = route.phase === RPHASE.PORT || land.offered;
  ship.cock.setAim(canPick ? plate : -1);

  // ── 비상 크랭크 — **끼인 문을 손으로 연다** ──────────
  // ★ 안 낀 문의 크랭크는 **안 잡힌다.** 멀쩡한 문에서 손잡이가 돌아가면
  //   「이걸 왜 돌리지」가 되고, 진짜로 필요할 때의 무게가 사라진다
  const crankDoor = onCrank && doors.list.find((d) => d.key === onCrank.key);
  cranking = crankDoor && crankDoor.jammed && input.hold ? crankDoor : null;

  // ── 조종간 — **잡고 좌우로 민다** (FLYING.md §3-B) ─────
  // ══ ★★★ **잡으면 놓을 때까지 잡은 것이다** (v63) ═══════════════════
  //  여태 `steering = onYoke && input.hold` 였다 — **조준선이 조종간에서
  //  벗어나는 순간 손이 떨어졌다.** 그런데 v63 은 잡으면 고개를 들어
  //  창을 보여 준다. 두 규칙이 정면으로 부딪힌다: 창을 보면 조준선이
  //  조종간을 떠나므로 **보는 순간 놓아진다.**
  //
  //  실제로도 조종간은 **딴 데를 본다고 놓아지지 않는다.** 손이 떨어지는
  //  것은 **놓았을 때**뿐이다. 걸쇠를 하나 둔다
  if (!input.hold) yokeHeld = false;
  // ★ **이미 딴 것을 읽고 있으면 조종간을 안 잡는다** (v66). 계기를 읽는
  //   동안 화면이 당겨지므로(`FOCUS`) 조준선이 살짝 움직이는데, 그때 조종간
  //   판정 상자에 스치면 **읽던 손이 조종간으로 옮겨 간다.** 놓기 전에는
  //   손이 안 바뀌어야 한다 — v63 에서 조종간에 걸쇠를 단 것과 같은 이유다
  else if (onYoke && !readGrip) yokeHeld = true;
  steering = yokeHeld;
  // ★★ **잡는 순간 자동 항법이 꺼진다** (사장님 「수동으로 운전할때는
  //   자동항법 꺼지는 걸로」). 이게 있어야 「내가 몬다」가 성립한다 —
  //   전에는 놓으면 배가 저절로 항로로 돌아와서 **한 일이 아무 자국도
  //   안 남았다.** 그게 「조정석을 잡아도 운전이 안 되잔아」의 실체다
  if (steering && takeHelm(helm)) {
    banner = '수동 조종 — 자동 항법이 꺼졌습니다';
    bannerT = 3.0;
    audio?.event('latch');
  }
  // ★ 다시 켜는 것은 **조종간이 아니라 옆의 스위치**다. 같은 손잡이가
  //   껐다 켰다 하면 지금 어느 쪽인지를 모른다
  if (onAuto && input.hold && !autoHeldWas) {
    if (engageAuto(helm)) {
      banner = '자동 항법 — 항로로 돌아갑니다';
      bannerT = 3.0;
      audio?.event('fixed');
    } else nag('이미 자동 항법입니다');
  }
  autoHeldWas = input.hold;

  // ★★ **땅에서는 조종간이 「뜬다」다.** 새 손잡이를 안 만든다 —
  //   내릴 때 잡았던 그 조종간을 다시 잡으면 올라간다. 그리고 뜨려면
  //   **에어록으로 돌아가 바깥문을 닫고** 와야 한다 (「동시에 두 곳에
  //   못 있는다」가 마지막으로 한 번 더 돈다)
  // ★ `input.takePress()` 를 여기서 쓰면 안 된다 — 그건 **소비하는** 깃발이라
  //   아래 해도대·차단기가 같은 프레임에 못 읽는다. 눌린 순간을 두 곳에서
  //   보려면 **셈도 두 개**다 (주포 사다리에서 이미 겪었다)
  if (landDown(land) && onYoke && input.hold && !liftHeldWas) {
    if (!liftOff(land, { doorOpen: lock.open || lock.cycling > 0 })) {
      nag(LAND_WHY[land.blocked] ?? '지금은 못 뜹니다');
    } else audio?.event('latch');
  }
  liftHeldWas = input.hold;

  // ── 윈치 — **멈춰서 끌어온다.** 「한 통만 더」 (PLAN §5-3) ──
  // 추진이 켜져 있으면 안 걸린다. 캐는 동안 구간이 안 나아가고 위험이 쌓인다 —
  // 시간과 위험을 **동시에** 치르는 것이 이 손잡이의 전부다
  // ★ **에어록이 안 닫히면 윈치를 못 쓴다** (airlockSeal). 「한 통만 더」가
  //   막히는 것이라, 굶는 중에 이게 겹치면 진짜로 급해진다
  // ★ **바깥문이 열려 있어야 낚는다** (사장님 「문을 열어서 우주에서 낚거나」).
  //   윈치는 원래 있었고, 없던 것은 **밖으로 난 구멍**이었다
  // ★★ **땅에서는 같은 윈치가 적재기가 된다** (사장님 「행성에 착륙해서
  //   가지고 올 수 있도록」). 우주 낚시는 광석만 나는데 땅은 **부품과
  //   식량이 같이 난다** — 그게 「왜 내리나」의 답이다. 손잡이는 하나다
  // ── ★★ 무전기 — **응답한다** (G 구조 신호 · 7판) ──────────
  //   잡고 있는 동안 자국이 오르고 구간이 안 나아간다. 놓아도 방송은
  //   나가고 **진행만 멈춘다** — 껐다 켜며 벌을 피하는 길을 막는다
  const answering = onRadio && input.hold;
  const rev2 = stepRescue(rescue, dt, answering, { outerOpen: lock.open });
  if (rev2 === 'answered') { banner = RESCUE.near; bannerT = 4.5; audio?.event('fault'); }
  if (rev2 === 'took') {
    supply.parts = Math.min(PARTS.max, supply.parts + rescue.got.parts);
    supply.food = Math.min(FOOD.max, supply.food + rescue.got.food);
    banner = `${RESCUE.took} — 부품 ${rescue.got.parts} · 식량 ${rescue.got.food}`;
    bannerT = 4.0;
    audio?.event('escaped');
    sceneDone(scenes, 'G');
  }
  if (rev2 === 'left') { banner = RESCUE.left; bannerT = 3.5; sceneDone(scenes, 'G'); }

  // ── ★★ 주 차단기 — **어둠 속에서 올린다** (E 정전 · 7판) ──────
  const dev = stepDark(dark, dt, onMain && input.hold);
  if (dev === 'back') {
    banner = DARK.back; bannerT = 4.5;
    audio?.event('escaped');
    sceneDone(scenes, 'E');
  }

  // ══ ★★ 우주복 — **걸이를 잡고 있으면 입는다** (v62) ══════════
  // ★ 22초는 짧지 않다. 일부러다 — 지금까지 채굴은 준비가 0초였고,
  //   그래서 「멈춰서 캔다」의 값이 위험 하나뿐이었다. 놓으면 되돌아간다
  //   (수리와 같은 규약) — 그래야 기다리기가 아니라 붙들고 있기가 된다
  const wearing = onSuit && input.hold;
  const wev = stepWear(suit, dt, { hold: wearing });
  if (wev === 'wore') {
    banner = '우주복을 입었습니다 — 손이 둔합니다';
    bannerT = 3.2; audio?.event('latch');
  }
  if (wev === 'doffed') { banner = '우주복을 벗었습니다'; bannerT = 2.2; audio?.event('click'); }
  ship.suitRack?.setWorn(suit.on);

  // ★★ **지금 진공에 있나** — 두 자리다.
  //   ① 바깥문을 연 에어록 (배기가 끝난 뒤)
  //   ② 미소운석이 뚫어 놓고 아직 안 막은 방 (v62 · mission-table effect.air)
  const nowRoom = roomAt(me.x, me.z);
  const inVac = (lockVacuum(lock) && nowRoom === 'airlock')
    || (bad.vacuum ?? []).includes(nowRoom);
  vacNow = inVac;
  const sev = stepSuit(suit, dt, { vacuum: inVac });
  if (sev === 'low') {
    banner = `우주복 공기가 얼마 없습니다 — ${(suit.air / 60).toFixed(1)}분`;
    bannerT = 3.6; audio?.event('fault');
  }
  if (sev === 'out') {
    // ★ **죽이지 않는다.** 배가 억지로 끌어들이고 문을 닫는다 —
    //   벌은 늘 기다림이다 (기밀 상실 · 정전 · 끼인 문과 같은 규약)
    lock.open = false; lock.opening = false; lock.cycling = 0;
    lock.lockout = LOCK.lockout;
    banner = '공기가 바닥났습니다 — 배가 문을 닫았습니다';
    bannerT = 4.2; hitFlash = 1; audio?.event('caught');
  }

  const onDirt = landDown(land);
  loading = onDirt && onWinch && input.hold && canLoadLand(land, { doorOpen: lock.open });
  winching = !onDirt
    && onWinch && input.hold && !power.thrust && !bad.noWinch && canHaul(lock);
  // ★ 잡았는데 안 걸리면 **왜인지 말한다.** 조용하면 윈치가 고장난 줄 안다
  if (onWinch && input.hold && !winching && !loading) {
    const w = onDirt ? loadWhy(land, { doorOpen: lock.open }) : haulWhy(lock);
    nag(bad.noWinch ? '에어록이 안 닫혀 못 씁니다'
      : (!onDirt && power.thrust) ? '추진을 끄고 잡습니다'
        : (w ? (onDirt ? LAND_WHY[w] : LOCK_WHY[w]) : '지금은 안 걸립니다'));
  }
  if (winching) {
    if (winchStep(supply, dt) === 'load') {
      banner = `광석 한 통 — ${supply.loads}통째`;
      bannerT = 2.2;
      audio?.event('latch');
    }
    ship.winch.drum.rotation.y -= dt * 2.4;
  }
  if (loading) {
    const g = loadStep(land, dt);
    supply.ore = Math.min(ORE.max, supply.ore + g.ore);
    supply.food = Math.min(FOOD.max, supply.food + g.food);
    if (g.parts) {
      supply.parts = Math.min(PARTS.max, supply.parts + g.parts);
      banner = `부품 ${g.parts}개를 실었습니다`; bannerT = 2.0;
      audio?.event('latch');
    }
    ship.winch.drum.rotation.y -= dt * 3.4;
  }

  // ── 접수구 — 거점에서만. 상인은 얼굴이 없다 (PLAN §1) ──
  // ★ 여기도 조용했다 — 거점이 아니거나 광석이 모자라면 잡고 있어도
  //   아무 일이 없었고, 왜인지도 안 말했다
  if (onHatch && input.hold && !(route.phase === RPHASE.PORT && canTrade(supply))) {
    nag(route.phase === RPHASE.PORT ? '광석이 모자랍니다' : '거점에서만 바꿉니다');
  }
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

  // ── 「챙긴다 → 쓴다」가 **말뿐이 아니게** ────────────────
  // ★ 두 걸음짜리 고장은 벌써 「정비실에서 냉매 한 통을 챙긴다 →
  //   기관실에서 갈아 넣는다」라고 말하고 있었는데, **실제로 들리는
  //   것이 없었다.** 패널을 5초 잡고 8초 잡으면 끝이었다.
  //   말과 손이 어긋나 있었고, 그건 계기가 거짓말하는 것과 같다.
  const plan = fixHere ? carryPlan(fixHere.steps) : null;
  // 쓰는 걸음인데 손에 그게 없으면 **시작도 안 된다**
  const wantHand = plan && fixHere.step === plan.takeAt && carry.held !== plan.kind;
  if (wantHand && input.hold && !handWarned) {
    handWarned = true;
    nag(`${CARRY_KINDS[plan.kind].name}이 손에 없습니다 — 정비실에서 챙겨 옵니다`);
  }
  if (!input.hold) handWarned = false;

  if (fixHere && input.hold && !shortParts && !wantHand) {
    repairing = fixHere;
    // 굶으면 **잡고 있어도 더디다** — 손이 떨려 정밀 작업이 어긋난다
    // ★ **굶음과 숨참이 같은 규약이다** — 둘 다 「손이 안 듣는다」.
    //   곱해서 쓴다: 굶은 채로 뛰어 왔으면 둘 다 치른다 (PLAN2H §7-2)
    // ★★ **우주복이 세 번째 배수다** (v62). 셋 다 곱해서 쓴다 —
    //   굶은 채로 우주복을 입고 뛰어 왔으면 셋을 다 치른다.
    //   이게 「왜 늘 입고 다니지 않나」의 답 전부다: 벌이 숫자가 아니라
    //   **못 하게 되는 일**로 온다 (물건 들기 · 굶주림과 같은 규약)
    const ev = repairStep(fixHere,
      dt * (shaky(supply) ? FOOD.handMult : 1) * breathMult(move) * suitHand(suit));
    // ── 네 동작 ─────────────────────────────────────────
    // ★ 총 시간은 **안 바뀐다.** 원래 있던 `hold` 초를 넷이 나눠 가진다 —
    //   늘리면 층·회차 길이가 통째로 밀린다 (repair-table.js)
    const need = fixHere.steps[fixHere.step]?.hold ?? 0;
    repairPose = poseAt(fixHere.held, need);
    const now = actAt(fixHere.held, need).act.key;
    if (now !== repairAct) {
      repairAct = now;
      // **말로도 나온다.** 손만 바뀌면 뭘 하는 중인지 모른다
      banner = repairPose.what; bannerT = 1.4;
      audio?.event('latch');
    }
    if (ev === 'step') {
      // 「챙긴다」를 마쳤으면 **손에 들려 준다.** 이미 뭘 들고 있으면
      // 못 받는다 — 손은 하나라는 규칙이 여기서도 같다
      if (plan && fixHere.step === plan.takeAt && !giveCarry(carry, plan.kind)) {
        nag('손이 비어야 챙깁니다 — 들고 있는 것을 붙여 놓으세요');
      }
      const nx = fixHere.steps[fixHere.step];
      banner = nx?.what ? `${nx.what} — ${ROOM_NAME[nx.at] ?? nx.at}` : '한 군데 더 있습니다';
      bannerT = 2.6;
      audio?.event('latch');
    }
    if (ev === 'fixed') {
      repairPose = null; repairAct = null;
      // 쓴 물건은 손에서 없어지고 정비실 제자리로 돌아간다
      if (plan) takeCarry(carry, plan.kind);
      spendParts(supply, needParts);
      // ★ **여기서야 원인을 말해 준다.** 고치기 전에 말하면 진단이 사라진다
      banner = fixHere.reveal;
      bannerT = 3.4;
      audio?.event('fixed');
      // ★★ **마모를 덜기 전에** 센다 — clear() 가 WEAR.relief 를 빼므로
      //   뒤에 세면 방금 혹사한 것이 멀쩡한 것으로 읽힌다
      sayScar(noteFix(scars, fixHere.sys, faults.wear, clock / 60));
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
    // 놓으면 **손 모양도 되돌아간다.** 손이 앞서 가면 계기가 거짓말하는 것과 같다
    repairPose = repairing
      ? poseAt(repairing.held, repairing.steps[repairing.step]?.hold ?? 0) : null;
    repairAct = repairPose?.key ?? null;
    if (repairing && repairing.held <= 0) { repairing = null; repairPose = null; repairAct = null; }
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

  // ── 밸브 — 잡고 돌린다. **열면 잠글 때까지 열려 있다** ──
  // ★ 26초마다 다시 다녀오는 것이 이 게임에서 제일 지겨운 짓이었다
  //   (사장님 「열 내리다가 게임 접겠다」). 이제 한 번 열면 열린 채고,
  //   대신 **열어 두면 자국이 커진다** (SIGN.valveOpen).
  if (onValve && input.hold) {
    // ★ 냉각 흉터가 있으면 **두 번 돌린다** (SCARS.cool.valveMult).
    //   「걸리지 않게」로 만들지 않는다 — 그건 v43 에서 고친 병의 부활이다
    turn = Math.min(1, turn + dt / (VALVE.turnTime * scarValve(scars)));
    valveGrace = VALVE.grace;
  } else if (valveGrace > 0) {
    // ★ **조준이 잠깐 벗어난 것은 봐준다.** 손이 미끄러진 것과 손을 뗀 것은
    //   다르다 — 추격 중엔 화면이 흔들리고 굶으면 손도 떨리는데, 흔들리게
    //   만들어 놓고 흔들리면 벌을 주는 것은 앞뒤가 안 맞는다
    valveGrace -= dt;
  } else {
    turn = Math.max(0, turn - VALVE.slip * dt);
  }
  if (turn >= VALVE.openAt) {
    turn = 0;
    valveGrace = 0;
    // 열려 있으면 잠그고, 잠겨 있으면 연다 — **같은 손짓**이다
    coolOpen = !coolOpen;
    if (coolOpen) taught.cooled++;
    audio?.event('latch');
    banner = coolOpen ? '냉각 밸브 — 열림' : '냉각 밸브 — 잠금';
    bannerT = 2.0;
  }

  // ★ 열을 **0.6초마다 한 점씩** 40초치 담아 둔다. 매 프레임 담으면 그래프가
  //   3초짜리라 「내려가는지」가 안 보이고, 너무 성기면 밸브를 돌리는 26초
  //   안에 점이 몇 개 안 찍힌다
  if (clock - trendAt > 0.6) {
    trendAt = clock;
    trend.push(+heat.toFixed(1));
    if (trend.length > 66) trend.shift();
  }
  ship.wheel.parent.rotation.z -= (turn > 0 ? dt * 2.6 : 0) + (coolOpen ? dt * 0.5 : 0);

  // 차단기 · 해도대 — 누르는 순간에만 넘어간다
  const pressed = input.takePress();
  if (plate >= 0 && pressed && land.offered) {
    // ★★ **발견 → 결심.** 판 0 이 「내린다」, 판 1 이 「지나친다」다
    if (plate === 0) {
      if (beginLand(land, { chase: chase.phase === PHASE.CHASE || chase.phase === PHASE.CAUGHT })) {
        banner = STEP_WORD[LSTEP.APPROACH]; bannerT = 3.0;
        audio?.event('latch');
      } else nag(LAND_WHY[land.blocked] ?? '지금은 못 내립니다');
    } else {
      passPlanet(land);
      sceneDone(scenes, 'B');
      banner = '지나칩니다'; bannerT = 2.0;
      audio?.event('click');
    }
  } else if (plate >= 0 && pressed) {
    if (canPick && chooseFork(route, ship.cock.keyAt(plate))) {
      ship.outside.setRegion(regionOf(route));
      banner = `${route.fork.name} — ${(route.fork.seconds / 60).toFixed(0)}분`;
      bannerT = 2.4;
      audio?.event('latch');
    } else {
      // ★ 거절음만 났다. 소리는 「안 된다」까지고 **왜**를 못 말한다
      nag(canPick ? '지금은 못 고릅니다' : '거점에서 항로를 고릅니다');
    }
  } else if (onThr && pressed) {
    // ══ ★★★ **추력 레버** (v66 · 사장님 「추진도 그렇고 모든 비행 조작은
    //    운전석에 있어야지」) ═══════════════════════════════════════════
    //  ★ 여태 추진은 **통로의 차단기**였다. 조종석에 앉아서는 출발조차
    //    못 하는 배였던 셈이다. 고증대로 **왼쪽 콘솔**로 가져왔다.
    //  ★ 규칙은 차단기 때와 **똑같이** 둔다 — 추진제가 마르면 안 걸리고,
    //    전력이 모자라면 못 켠다. 자리만 옮긴 것이지 규칙을 바꾼 게 아니다
    if (!power.thrust && isDry(supply.fuel)) {
      banner = fuelWord(supply.fuel); bannerT = 2.6; audio?.event('deny');
    } else if (power.thrust) {
      power.thrust = false; wearFlip(faults); taught.flips++;
      banner = '추력 레버를 당깁니다 — 관성으로 갑니다'; bannerT = 1.8;
      audio?.event('click');
    } else if (canTurnOn(power)) {
      power.thrust = true; wearFlip(faults); taught.flips++;
      banner = '추력 레버를 밉니다'; bannerT = 1.6;
      audio?.event('click');
    } else {
      banner = '전력이 모자랍니다'; bannerT = 1.6; audio?.event('deny');
    }
  } else if (breaker && pressed) {
    // ★★ **추진제가 바닥나면 추진이 안 걸린다** (v62 · fuel-table.js).
    //   죽지는 않는다 — 구간은 coast(0.45) 로 계속 나아가고, 그동안
    //   압박이 진짜 시간으로 쌓인다. 벌은 「끝」이 아니라 **기다림**이다
    if (breaker.key === 'thrust' && !power.thrust && isDry(supply.fuel)) {
      banner = fuelWord(supply.fuel);
      bannerT = 2.6;
      audio?.event('deny');
    } else if (power[breaker.key]) { power[breaker.key] = false; wearFlip(faults); taught.flips++; audio?.event('click'); }
    else if (canTurnOn(power)) { power[breaker.key] = true; wearFlip(faults); taught.flips++; audio?.event('click'); }
    else {
      // ★ 꽉 찼을 때 **조용히 아무 일도 안 일어나면** 고장인 줄 안다.
      //   무엇이 막았는지 글자로 말해 준다 — 규칙을 알아맞히게 하지 않는다.
      //   소리도 **딸깍이 아닌 다른 소리**를 낸다. 같은 소리를 내면
      //   「눌렸는데 안 먹었다」가 되어 고장으로 읽힌다
      // ★ v58 이후로는 여기 안 온다 (POWER_MAX 가 3 이라 늘 켜진다).
      //   지우지 않는 이유: 정전(E)처럼 회로가 죽는 상황이 앞으로 또 생긴다
      banner = '전력이 모자랍니다';
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

  // ── ★ 주포 — 사다리를 잡으면 오르내리고, 위에서는 쏜다 ──
  // ★ **올라가 있으면 아래 것들은 안 잡힌다.** 포탑에 있는데 밸브가
  //   잡히면 「동시에 두 곳에 못 있는다」가 무너진다 (gun-table.js ③)

  // 사다리는 **누르는 순간** 탄다 (잡고 있는 것이 아니다 — 오르는 데 시간이 든다)
  // ★ `heldWas` 는 위(가르침)에서 **이미 갱신됐다.** 여기서 그걸 쓰면
  //   「눌린 순간」이 영영 안 잡힌다 — 잡음이 늘 같은 값이라서다.
  //   눌린 순간을 두 곳에서 보려면 **셈도 두 개** 있어야 한다
  // ★★ **여기가 「주포가 조작이 안 된다」의 진짜 원인이었다.**
  //   조건이 `(onLadder || (gun.up && onGun))` 이라, 포탑에 올라가 주포를
  //   겨누고 누르면 **같은 프레임에 내려가고 또 쏘았다.** 눌러도 총은 안
  //   나가고 몸만 내려오니 「안 된다」로 보인다.
  //   올라가고 내려가는 것은 **사다리**가, 쏘는 것은 **주포**가 한다 —
  //   한 손잡이가 두 일을 하면 반드시 이렇게 부딪힌다
  const gunPressed = input.hold && !gunHeldWas;
  // ══ ★★ **조준석** — 앉고 · 손잡이를 잡고 · 쏜다 (v49) ══════
  //  사장님: 「실내에 조준석에서 조준해야지. 손으로 손잡이를 잡고 wasd로」
  //
  //  ★ 손잡이 하나가 두 일을 하면 반드시 부딪힌다 (v47 에서 겪었다).
  //    **앉고 일어나는 것은 좌석**, **겨누는 것은 손잡이**로 가른다.
  //    앉은 채로 앞을 보면 손잡이, 아래를 보면 좌석이 잡힌다
  if (onHelmSeat && gunPressed) {
    helmSat = true;
    // ★★ **앉으면 시선이 조종간 쪽으로 내려간다** (v63).
    //   `HELM_SEAT.pitch` 가 표에 있었는데 **아무도 안 읽고 있었다** —
    //   그래서 앉아도 시선이 그대로라 조종간을 손으로 더듬어 찾아야 했다.
    //   재 보니 조종간은 34도 아래에 있다 (`SIT_LOOK`)
    me.pitch = SIT_LOOK;
    banner = '조종석에 앉습니다 — 조종간을 잡으면 창이 열립니다';
    bannerT = 1.8;
    audio?.event('click');
  } else if (helmSat && gunPressed && !steering && !cockGrip && !aimName && helmSitK > 0.995) {
    // ★ 일어나는 것은 **아무것도 안 잡힌 데를 누를 때**다. 손잡이를 누르면
    //   그건 잡는 것이지 일어나는 것이 아니다 — 한 손잡이가 두 일을 하면 부딪힌다
    //
    // ══ ★★★ **v66 — 여기가 「눌렀는데 배가 안 간다」의 진짜 원인이었다** ══
    //  여태 조건이 `!onYoke` 였다. v65 까지는 앉아서 누를 것이 **조종간
    //  하나뿐**이라 그걸로 충분했다. 그런데 v66 에서 **항로 갈래 판 ·
    //  추력 레버 · 자동 항법**이 조종석으로 오자, 그것들을 누를 때마다
    //  `onYoke` 가 거짓이라 **일어나 버렸다.**
    //
    //  일어나면 몸이 좌석 뒤로 물러나므로 **조준선이 그 프레임에 딴 것을
    //  잡고**, 그 딴 것이 하필 조종간이라 수동 조종이 켜졌다. 화면에는
    //  「눌렀더니 자동 항법이 꺼졌습니다」만 뜬다 — 원인과 아무 상관도
    //  없어 보이는 말이다. 손잡이를 하나 늘릴 때마다 여기 이름을 하나씩
    //  더 적는 방식이었으면 다음 판에 또 밟는다. **잡힌 것이 있나**로 묻는다
    helmSat = false;
    banner = '일어납니다';
    bannerT = 1.6;
    audio?.event('click');
  }

  // ★ **잡고 있는 동안** WASD 가 포탑을 돌린다 (walk() 가 읽는다)
  // ★★★ v64 — **손잡이가 없어졌다.** 조준은 기수가 한다 (조종간이 곧 조준).
  //   `gripping` 은 이제 「조종석에 앉아 조종간을 잡고 있나」다 —
  //   그게 곧 전투 자세이므로 `steering` 과 같은 값이 된다
  gripping = steering;
  // 쏘는 것은 **Space** — 잡는 손과 쏘는 손이 같으면 겨누다 말고 쏘게 된다
  const firePressed = input.keys.has('Space');
  // ══ ★★★ **무기 고르기 1 · 2 · 3** (v64) ═════════════════════
  //  ★ 조종석에 앉아 있을 때만 먹는다 — 걷다가 눌러도 아무 일이 없어야
  //    「이 키가 뭐지」가 안 생긴다. 그리고 **바뀌면 말한다**
  for (const w of WEAPON_LIST) {
    if (!helmSat || !input.keys.has(`Digit${w.slot}`)) continue;
    if (combat.slot === w.slot) continue;
    pickSlot(combat, w.slot);
    banner = `${w.name} — ${w.what}`;
    bannerT = 2.6;
    audio?.event('click');
  }
  // ★★★ v64 — **조종석에 앉아 있으면 쏜다.** 포탑에 올라갈 필요가 없다
  if (helmSat && firePressed && !fireHeldWas) fireGun();
  fireHeldWas = firePressed;

  // ── ★ 바깥문 — 누르는 순간 돌기 시작한다 ──────────────
  if (onOuter && gunPressed) {
    if (cycleLock(lock, { thrust: power.thrust })) {
      banner = lock.opening ? '바깥문을 엽니다' : '바깥문을 닫습니다';
      bannerT = 2.0;
      audio?.event('latch');
    } else {
      // ★ **조용히 안 열리면 「고장」으로 읽힌다** — 이 저장소가 네 번 겪었다
      banner = LOCK_WHY[lock.blocked] ?? '지금은 안 열립니다';
      bannerT = 2.6;
    }
  }
  gunHeldWas = input.hold;
  // ★★ **계기를 읽는 손잡이인가** (v63). 여기서만 화면을 당긴다 —
  //   조종간·주포는 반대로 **넓히고 든다** (helm-table.js FLY_VIEW)
  readGrip = !!(input.hold && (onValve || breaker || plate >= 0 || panel));

  // ★ v64 — 주포 손잡이 둘(grip · gunseat)이 여기 있었다. 좌석이 하나가
  //   되면서 없어졌다 — 이제 **조종간 하나가 조준까지 한다**
  if (onHelmSeat) aimName = 'helmseat';
  else aimName = onRadio ? 'radio'
    : onSuit ? 'suit'
    : onMain ? 'mainbreaker'
    : onOuter ? 'outer'
    : onSpot ? `spot:${onSpot}`
    : onCrank ? `crank:${onCrank.key}`
    : onValve ? 'valve' : (breaker ? breaker.key
    : (plate >= 0 ? `chart${plate}`
      : (panel ? `panel:${panel.room}`
        : (onWinch ? 'winch' : (onHatch ? 'hatch' : (onYoke ? 'yoke' : (onAuto ? 'autopilot' : (onThr ? 'throttle' : null))))))));
  // ★ 조준점이 **주포와 사다리에서는 안 켜졌다.** 「손이 닿는다」를 알려
  //   주는 유일한 표시인데 빠져 있으면 「눌러도 되는지」를 알 길이 없다
  cross.classList.toggle('on', !!(onOuter || onAuto || onThr || onSuit
    || onValve || breaker || (canPick && plate >= 0) || fixHere
    || (onWinch && !power.thrust) || (onHatch && route.phase === RPHASE.PORT && canTrade(supply))
    || onYoke || (crankDoor && crankDoor.jammed)
    || (onSpot && (carry.held ? !atSpot(carry, onSpot) : !!atSpot(carry, onSpot)))));
  return coolOpen;
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
  // ★ **장면의 「대응」 박자에는 새 고장이 안 뜬다** (PLAN2H §7).
  //   그때 뜨면 그건 긴장이 아니라 **방해**다 — 앞 판에서 내가 틀린 게
  //   정확히 이것이라 규칙(`allowChore`)으로 못박았다.
  //   예고와 여운에는 낸다. 예고 때 고장이 하나 있어야 「마치고 갈까」가 생긴다
  const calm = chase.phase !== PHASE.CHASE && route.phase === RPHASE.LEG
    && allowChore(scenes);
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
  let nearD = bad.doorWild
    ? doors.list[Math.floor(clock * 0.7) % doors.list.length]
    : nearDoor(doors.list, me.x, me.z);
  // ★★ **바깥문이 열려 있으면 안쪽 문이 안 열린다** — 에어록에 갇힌다.
  //   두 문이 동시에 열리면 배가 통째로 진공이다. 실제 에어록의 연동을
  //   그대로 쓰는데, 게임에서는 그게 **「낚는 동안 배를 못 고친다」**가
  //   된다 — 「동시에 두 곳에 못 있는다」(PLAN §1)가 여기서 또 돈다
  if (innerLocked(lock) && nearD?.key === 'airlock') nearD = null;
  // ══ ★★ **뚫린 방은 배가 잠근다** (v62 · 미소운석) ═══════════════
  //  v23~v61 동안 사람은 벽이 뚫린 방에 그냥 걸어 들어가 6초 동안
  //  **맨손으로** 구멍을 막았다 (REAL.md §2 「미소운석」). 이제 그 방은
  //  진공이고, 문은 **우주복을 입어야 열린다.**
  //
  //  ★ **나가는 길은 안 막는다.** 그 방 안에 있을 때는 늘 열린다 —
  //    고장이 발밑에서 터졌을 때 갇히면 그건 긴장이 아니라 사고다.
  //    (에어록의 「갇힌다」는 **내가 연 문**이라 성립하고, 이건 아니다)
  if (nearD && (bad.vacuum ?? []).includes(nearD.key)
    && roomAt(me.x, me.z) !== nearD.key && !canEva(suit)) {
    nag(`${nearD.name}이 진공입니다 — 우주복을 입고 들어갑니다`);
    nearD = null;
  }
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
  // 옮길 수 있는 물건을 제자리에 놓는다 — 손에 든 것은 카메라에 붙는다
  carryView.place(carry.held, Object.fromEntries(carry.items.map((it) => [it.kind, it.spot])));

  // 문짝을 그리고, **닫힌 문은 길을 막는다**
  for (const d of doors.list) {
    const v = doorView[d.key];
    v.view.update(d.k, d.jammed, d.held, dt);
    v.bar.off = canPass(d);
  }

  // ── 보급 — 먹고, 지나가며 줍는다 ─────────────────────
  const rg = REGION_BY_KEY[ship.outside.region];
  // ★ **온실이 얼면 식량이 빨리 준다.** dt 를 늘려 흉내낸다 — 표(FOOD.perSec)를
  //   안 건드리는 쪽이다. 표를 고치면 시뮬이 읽는 값과 게임이 갈라진다
  // ★★ **추진제도 여기서 준다** — 밟는 동안만, 구역마다 다르게 (v62).
  //   빠른 길은 짧게 끝나되 초당 더 태우고, 성운은 오래 걸리되 덜 태운다.
  //   그래서 「어느 길로 가나」가 추진제로도 한 번 더 갈린다
  const sup = stepSupply(supply, dt * (1 + bad.food), {
    debris: rg?.debris ?? 0,
    thrust: power.thrust,
    region: ship.outside.region,
  });
  if (sup === 'hungry') {
    banner = '손이 떨립니다 — 식량이 모자랍니다';
    bannerT = 3.2;
    audio?.event('fault');
  }
  if (sup === 'lowFuel') { banner = fuelWord(supply.fuel); bannerT = 3.2; audio?.event('fault'); }
  if (sup === 'dry') {
    // ★ 바닥나면 **차단기가 저절로 내려간다.** 「켜 놨는데 안 간다」는
    //   계기가 거짓말하는 것이고, 이 배에서 제일 하면 안 되는 일이다
    power.thrust = false;
    banner = '추진제가 바닥났습니다 — 엔진이 꺼집니다';
    bannerT = 4.2;
    audio?.event('deny');
  }
  // ★ **굶은 시간을 센다.** 끝 화면 목록의 한 줄이 된다 (PLAN2H §9).
  //   재 보니 마지막 구간에 식량 45 를 들고 들어가면 5.4분을 떨고,
  //   100 을 들고 들어가면 0분이다 — 그 차이가 목록에 남아야 앞의
  //   11구간에서 챙긴 것이 뜻을 갖는다
  if (shaky(supply)) shakyT += dt;

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
    // ★ v60 — `hazard.lane` 이 아니라 **축**을 민다. lane 은 이제 거울이라
    //   거기 적어 봐야 다음 줄에서 덮어써진다
    fly3.yaw = Math.max(-AXES.yaw.max, Math.min(AXES.yaw.max,
      fly3.yaw + bad.drift * dt * (driftWay || 1)));
  }
  // ★ **조종간은 늘 먹는다.** 잔해가 오는 시점만 빗장이 막고, 조종은 안 막는다 —
  //   전에는 좌우 조작이 `stepHazard` 안에 있어서 **거점에서는 조종간이
  //   죽은 물건**이었다. 잡으면 마우스까지 뺏기니 얼어붙은 것처럼 보였다
  // ★ 수동 항법이면 놓아도 그대로 간다 — 조종간(helm)과 같은 규칙
  // ★★ **세 축을 한 자리에서 굴린다** (v60 · game/flight.js).
  //   `hazard.lane` 은 이제 **거울**이다 — 잔해 피하기·창밖 시차가
  //   그 값을 읽고 있어서, 축을 늘리면서 그 둘을 안 건드리려면
  //   좌우 축을 그대로 흘려보내는 편이 안전하다
  stepFlight(fly3, dt, { atSeat: steering, push: flyPush, manual: !helm.auto });
  hazard.lane = Math.max(-HAZARD.laneMax, Math.min(HAZARD.laneMax, fly3.yaw));
  steerShip(hazard, dt, { atSeat: false, push: 0, manual: true });
  // ★ **잔해밭은 이제 아무 구간에나 안 온다.** 배치표가 D 를 놓은 구간
  //   (지금은 5) 에서만 열린다 — 「구간마다 이름이 있는 장면 하나」의 실체다.
  //   ★ 이미 지대 안에 들어와 있으면 계속 돈다. 장면이 끝났다고 바위를
  //     공중에서 지우면 그건 장면이 아니라 **끊긴 화면**이다
  // ★ **가르침이 도는 동안은 예외다.** 여섯째 가르침(「조종석에서 비킵니다」)이
  //   잔해를 봐야 열리는데, 배치표는 D 를 구간 5 에 뒀다. 그대로 두면
  //   **구간 1 에서 가르침이 영영 안 끝난다** — 일곱 중 여섯째에서 멈추고
  //   일곱째(보급)는 아예 안 열린다. 화면에는 안 사라지는 한 줄만 남는다.
  //   구간 1 은 배치표가 「배를 익히는 자리」라고 적어 둔 곳이니(PLAN2H §5)
  //   여기서 오는 잔해는 **장면이 아니라 배우는 것**이다
  const learning = !allDone(tutor);
  const hev = hazard.phase !== HPHASE.IDLE
    || (route.phase === RPHASE.LEG && canFire(tutor, 'hazard')
        && (sceneOpen(scenes, 'D') || sceneOpen(scenes, 'C') || learning))
    ? stepHazard(hazard, dt, { region: ship.outside.region })
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
  // ★ 지대를 다 지났다 — 「창밖이 갑자기 트인다」(§4-2 해소)
  if (hev === 'clear') sceneDone(scenes, 'D');

  // 쓰는 대로 닳는다 — **어떻게 몰았는지가 다음 고장을 정한다** (systems-table WEAR)
  wearStep(faults, dt, { power, valveOpen, region: ship.outside.region });

  // 열은 **켠 회로**가 정한다. 추진을 켜면 오르고, 냉각을 켜면 내려간다.
  // 다만 냉각 회로만으로는 절반뿐이라 **기관실 밸브까지 열어야** 제대로 잡힌다.
  // 고장이 있으면 여기에 얹힌다 — 「원인 모를 열」이 그것이다
  // ★★ **이륙 분사 중에는 냉각이 안 먹는다** — 분사를 하려면 방열판을
  //   접어야 한다. 이게 없으면 밸브가 잠금식(v43)이라 오른 열이 저절로
  //   빠지고, 그러면 이륙에 값이 하나도 안 붙는다
  const cooled = landNoCool(land) ? { ...power, cool: false } : power;
  // ★★ **v58 — 한 줄이던 것이 두 칸이 됐다** (game/heat.js · REAL.md §4-A).
  //   예전에는 `heatRate` 한 번으로 끝났고, 그 함수가 「냉각을 켜면 열이
  //   없어진다」를 말하고 있었다. 진공에서는 그럴 수 없다 —
  //   냉각 회로는 **옮기고**, 라디에이터(밸브)에서만 **나간다.**
  const st = { hull: heat, sink };
  stepHeat(st, dt, {
    thrust: cooled.thrust,
    cool: cooled.cool,
    valveOpen,
    // 고장이 얹는 열. 「원인 모를 열」과 「오염된 냉매」가 여기로 온다
    // ★ 정전이면 **잔열**이 얹힌다 — 냉각 펌프가 멎어서 반응로의 남은
    //   열이 갈 데가 없다 (chase-table.js HEATING.blackout).
    //   이게 없으면 정전이 아프지 않은 것이 된다
    extra: bad.heat + (valveOpen && cooled.cool ? bad.coolValve : 0)
      + (isDark(dark) ? HEATING.blackout : 0),
    noCool: landNoCool(land),
  });
  heat = st.hull;
  sink = st.sink;

  // ★★ **거점은 안전하다** (PLAN §4-2). 여기 위 158행에 그렇게 적어 놓고
  //   **정작 추격은 안 막고 있었다.** 그래서 켜자마자 거점에 서 있기만 해도
  //   34초에 붙고 69초에 잡혔다 — 항로 안내가 뜨기도 전에.
  //   거점에서는 위험이 **빠진다**: 붙을 일이 없으니 쌓일 이유도 없다.
  const atPort = route.phase === RPHASE.PORT;
  const riskWas = chase.risk;
  // ★ **고장이 자국을 민다.** 새는 공기(미소운석)·제멋대로 여닫히는 문
  //   (문 구동부)이 눈에 띈다. 자국은 열에서 나오므로 열 단위로 환산해 얹는다 —
  //   따로 더하면 조종석 계기가 말하는 자국과 실제가 갈라진다
  // ★ **쏘면 밝아진다** — 총구 섬광은 숨을 수 없다 (gun-table.js ②).
  //   열 단위로 환산해 얹는다. 따로 더하면 조종석 계기가 말하는 자국과
  //   실제가 갈라진다 — 고장이 자국을 미는 것과 같은 규약
  // ★ 열린 바깥문도 자국이다 — 구멍 뚫린 배는 눈에 띈다
  // ★ 이륙 분사도 자국이다 — 행성에서 솟는 불기둥은 숨을 수가 없다
  // ★ 선체 흉터는 **늘 조금 더 굵다** — 안 닫히는 구멍이다
  const badSign = (bad.sign + flashSign(gun) + lockSign(lock) + landSign(land)
    + scarSign(scars)) / SIGN_PER_HEAT;
  const ev = atPort
    ? (chase.phase === PHASE.CALM
      ? (chase.risk = Math.max(0, chase.risk - SIGN.riskFall * dt), null)
      : stepChase(chase, dt, power, heat + badSign, regionMult,
        { contactAt: 999, trackMult: 0, valveOpen }))
    : stepChase(chase, dt, power,
      // ★ **무전은 방송이다** — 켜 둔 동안 윈치보다 굵은 자국이 난다.
      //   도와주려고 켠 것이 나를 가리킨다: 줄기 「혼자다」와 「쫓긴다」가
      //   여기서 만난다 (story-table.js)
      heat + badSign + (winching ? WINCH.sign / SIGN_PER_HEAT : 0)
        + (radioOn(rescue) ? RESCUE.sign / SIGN_PER_HEAT : 0), regionMult,
      {
        // ★ **자국은 늘 쌓인다. 붙는 것만 장면이 정한다.**
        //   자국을 같이 껐더니 A 가 없는 구간에서는 열을 올려도 아무 일이
        //   없어서 **기관실에 갈 이유가 사라졌다.** 그건 장면을 만든 게
        //   아니라 게임의 절반을 끈 것이다. 위험은 계속 오르되,
        //   실제로 따라붙는 것은 배치가 정한다 (PLAN2H §5)
        // ★ `running` 이 아니라 `opens` 다. 전에는 **예고 중에 이미 붙었고**,
        //   그러면 「자국이 굵어집니다」와 「접촉」이 같은 순간에 뜬다 —
        //   그건 예고가 아니라 사고다 (PLAN2H §2)
        contactAt: sceneOpen(scenes, 'A') ? contactAt(route) : 999,
        trackMult: trackMult(route),
        // ★ 열어 둔 밸브는 자국이 된다 — 「열어 놓고 잊기」가 공짜가 아니게
        valveOpen,
      });
  // ★ 캐는 동안에는 **위험이 안 빠진다.** 배가 멈춰 있고 윈치가 시끄러우니
  //   상대가 나를 놓칠 리가 없다.
  //   처음엔 그냥 위험을 더하기만 했는데, 자국이 낮으면 stepChase 가 초당
  //   2.2 씩 빼 가서 **캐는데 위험이 오히려 줄었다.** 브라우저 검사가
  //   「4.7 → 4.5」로 잡아 줬다 — 시뮬은 빼는 쪽을 안 세고 있어서 못 봤다
  if (winching && chase.phase === PHASE.CALM) {
    chase.risk = Math.min(100, riskWas + WINCH.riskRise * dt);
  }
  if (ev === 'contact') {
    banner = '접촉 — 무언가 따라붙었습니다';
    bannerT = 2.6;
    // ══ ★★★ **쫓아오는 것이 창밖에 보인다** (v64) ═══════════════
    //  v47~v63 동안 추격자는 **계기의 숫자로만** 있었다 — 그래서
    //  「겨눈다」가 성립하지 않았고 주포는 「쫓길 때 누르는 버튼」이었다.
    //  이제 접촉하면 **적 우주선이 실제로 뜬다.** 부수거나, 안 부수면
    //  들이받힌다. 「쫓긴다」가 처음으로 눈에 보이는 것이 된다
    if (!sky.list.some((t) => TKINDS[t.kind]?.rams)) spawnRaider(sky);
  }
  if (ev === 'escaped') {
    banner = '뿌리쳤습니다'; bannerT = 3.2; escapedAt = clock;
    // ★ 항로에도 남긴다. 이게 없으면 「뿌리쳐도 아무것도 안 쌓인다」가
    //   그대로 남는다 (docs/space/GAP.md §1-1)
    relieveEscape(route);
    // ★ **해소는 여기가 정한다.** 장면의 시계가 아니라 **실제로 뿌리친
    //   이 순간**이 「됐다」다. 시계로만 넘기면 「뿌리친 3초」가 엉뚱한
    //   자리에서 난다 — 이 게임 최고의 자산을 헛 데 쓰는 셈이다
    sceneDone(scenes, 'A');
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
    sceneDone(scenes, 'A');  // 놓아준 것도 끝난 것이다
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
  // ★ 흉터도 여기 뜬다 — **일이 아니라 배의 상태**라 손목이 아니라 진단대다
  ship.bench.update({
    wear: faults.wear, open: openList(faults), fixed: faults.fixed, log: faults.log,
    scars: scarList(scars),
  });
  // 온실 · 에어록 — 계기는 방마다 하나씩, 전부 다른 것을 말한다
  ship.foodGauge.update({
    food: supply.food, ore: supply.ore, parts: supply.parts,
    legsOnFood: legsLeftOnFood(supply, route.fork?.seconds ?? LEG.seconds),
  });
  ship.winch.update({ hauled: supply.hauled, ore: supply.ore, loads: supply.loads, moving: power.thrust });
  ship.radio.update(rescueSummary(rescue));
  {
    // ★ 정전이면 등을 죽인다. **0 이 아니다** — 완전한 암흑은 무서운 게
    //   아니라 아무것도 못 하는 것이고, 그러면 「게임이 꺼졌나」로 읽힌다
    const d = isDark(dark);
    ship.setDark(d ? DARK.lamp : 1, d ? DARK.ambient : 1);
    ship.mainBreaker.update(darkSummary(dark));
  }
  ship.tradeHatch.update({ atPort: route.phase === RPHASE.PORT, ore: supply.ore });

  // 조종석 화면들 — 계기는 UI 가 아니라 **콘솔에 박힌 물건**이다
  ship.cock.update({
    heat, cooling: valveOpen && power.cool, room: roomAt(me.x, me.z), t: clock,
    // ★ 열 저장고 (v58) — 「지금 뜨거운가」 옆에 「쌓인 총열」을 나란히 놓는다.
    //   따로 두면 둘의 관계가 안 읽히고, 관계가 안 읽히면 이 계통은
    //   말이 되는 대신 **어려운** 것이 된다
    sink: sinkAt({ sink }), sinkWord: SINK_WORD(sink), sinkFull: sinkFull({ sink }),
    hide: hideLeft({ sink }, { thrust: power.thrust, cool: power.cool }),
    region: ship.outside.region, power, chase,
    // ★ 자동 항법 등 — 초록이면 자동, 주황이면 수동. 조종석에 들어서는
    //   순간 지금 어느 쪽인지가 보여야 한다
    auto: helm.auto,
    // ★ 성운에서는 센서를 켜도 거리가 안 읽힌다 — 「자국이 묻히지만 나도
    //   못 본다」의 실체다. 조종석 화면이 그걸 그대로 보여줘야 한다
    blind: isBlind(route),
    press: route.press, legsLeft: legsLeft(route),
    progress: progress(route), atPort: route.phase === RPHASE.PORT,
    contactAt: contactAt(route),
    // 조종 — 남은 시간과 다가오는 것 (world/cockpit.js drawCourse 가 읽는다)
    lane: hazard.lane, hazPhase: hazard.phase,
    hazWarn: warnLeft(hazard), incoming: incoming(hazard), clearBy: clearOf(hazard),
    // ★★ v66 — **항로와 추진이 조종석으로 왔다.** 갈래 판 둘이 선반에
    //   있고, 추력 레버가 왼쪽 콘솔에 있다 (사장님 「모든 비행 조작은
    //   운전석에 있어야지」). 해도대에 넘기던 것과 **같은 값**을 넘긴다 —
    //   두 벌을 만들면 반드시 갈라진다
    offer: route.offer, thrust: power.thrust,
    land: { offered: land.offered, hard: land.hard },
  });
}

// 화면 확인용 손잡이. **게임 로직은 이걸 안 쓴다** — 스크린샷을 찍고
// 「지금 열이 몇인가」를 밖에서 물어보려고 낸 구멍이다.
// 손으로 20분 돌려 보는 것을 대신하지는 못한다 (docs/POSTMORTEM.md §1-③).
window.SPACE = {
  get version() { return VERSION; },
  /** ★ 세 축 + 짐벌 (v60) — `space-flight.js` 가 읽는다 */
  get fly3() { return { ...flySummary(fly3), word: attitudeWord(fly3), deg: Math.round(rollDeg(fly3.roll)) }; },
  /** 검사가 축을 밀어 놓는다 */
  putFly(a) { Object.assign(fly3, a); return flySummary(fly3); },
  /** ★ 조종석에 앉아 있나 (v61) */
  get helm2() { return { sat: helmSat, k: +helmSitK.toFixed(2) }; },
  putHelmSit(v) { helmSat = !!v; return helmSat; },
  get heat() { return heat; },
  /** ★ 열 저장고 (v58) — `space-heat.js` 가 읽는다 */
  get sink() {
    return { v: +sink.toFixed(1), at: +sinkAt({ sink }).toFixed(3),
      full: sinkFull({ sink }), word: SINK_WORD(sink),
      hide: +hideLeft({ sink }, { thrust: power.thrust, cool: power.cool }).toFixed(0) };
  },
  setSink(v) { sink = Math.max(0, Math.min(SINK.max, v)); return sink; },
  get turn() { return turn; },
  get coolFor() { return coolOpen ? 999 : 0; },
  /** 냉각 밸브가 열려 있나 — 검사와 가르침이 읽는다 */
  get coolOpen() { return coolOpen; },
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
  /**
   * ★ 창밖 (v57). `SPACE.land.view` 안에 묻혀 있었는데, 하늘은 착륙과
   *   아무 상관이 없다 — `space-sky.js` 가 「별이 흐르나」를 물으려고
   *   착륙 상태를 들춰 봐야 하는 것은 길이 잘못 난 것이다.
   *
   * ★★ **`sky` 라고 지었다가 조용히 먹혔다.** `SPACE.sky` 는 이미
   *   **떠도는 것들**(v49 · space-target.js)이 쓰고 있었고, 객체 리터럴은
   *   뒤에 적은 것이 이긴다 — 그래서 이쪽이 통째로 사라졌는데
   *   **오류는 한 줄도 안 났다.** 검사는 `undefined === undefined` 로
   *   초록을 찍고 있었다. 이름을 겹치면 이렇게 조용히 진다
   */
  get outside() { return ship.outside.view; },
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
  /** 냉각 밸브가 어디 있나 — 검사가 앞에 가서 서려고 묻는다 */
  /** 눈높이 — 포탑에 올라갔는지 검사가 본다 */
  get camY() { return +camera.position.y.toFixed(3); },
  /** 지금 잡고 있나 — 검사가 「눌린 것이 게임에 닿았나」를 가릴 때 쓴다 */
  get holdNow() { return input.hold; },
  /** 검사가 광석을 실어 준다 */
  giveOre(n) { supply.ore = Math.min(240, supply.ore + n); return supply.ore; },
  get valveAt() {
    const v = ship.valve;
    if (!v) return null;
    const w = new THREE.Vector3(); v.getWorldPosition(w);
    return { x: +w.x.toFixed(2), z: +w.z.toFixed(2) };
  },
  /**
   * 에어록 바깥문이 어디 있나 — **손잡이의 실제 자리**를 그대로 준다.
   * ★ 좌표를 검사에 손으로 옮겨 적으면, 문을 옮겼을 때 검사만 옛 자리를
   *   두드리며 「안 잡힌다」고 빨개진다. 세운 자리에서 받아 간다
   */
  get outerAt() {
    const h = ship.outerDoor?.hit;
    if (!h) return null;
    const w = new THREE.Vector3(); h.getWorldPosition(w);
    return { x: +w.x.toFixed(2), z: +w.z.toFixed(2) };
  },
  /** 진단대 화면이 어디 있나 — 읽을 자리가 있는지 검사가 묻는다 */
  get benchAt() {
    const b = ship.bench?.at;
    return b ? { x: +b.x.toFixed(2), z: +b.z.toFixed(2), ry: b.ry } : null;
  },
  /** 마모를 밖에서 밀어 놓는다 — 진단대 화면을 찍으려고 낸 구멍 */
  wearTo(w) { Object.assign(faults.wear, w); },
  /**
   * 열린 고장 하나를 고친 것으로 친다 — **검사용.**
   * 가짜로 적어 넣지 않고 **실제 `clear` 를 부른다** — 기록이 실제 경로로
   * 쌓여야 「손목에 뭐가 어떻게 보이나」를 볼 수 있다
   */
  fixOne() { const f = faults.open[0]; if (!f) return false; noteFix(scars, f.sys, faults.wear, clock / 60); clear(faults, f); return true; },
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
  /** 옮길 수 있는 물건이 지금 어떤가 — 검사용 */
  /** 달리기와 숨이 지금 어떤가 — 검사용 */
  get move() { return { ...moveSummary(move), speed: BODY.speed }; },
  get carry() {
    const g = carryView.items[carry.held];
    let root = g ?? null;
    while (root?.parent) root = root.parent;
    return {
      ...carrySummary(carry),
      // ★ **화면에 정말 있나.** 손에 든 것은 카메라의 자식이라, 카메라가
      //   장면에 없으면 코드는 다 도는데 그림만 없다 — 손목에서 겪었다
      onScreen: !!g && root === scene,
      spots: Object.keys(carryView.spots),
    };
  },
  /** 손에 든 것의 그림 — 검사가 화면에서 몇 자리를 먹나 재려고 묻는다 */
  get heldMesh() { return carry.held ? carryView.items[carry.held] : null; },
  /** 물건을 손에 쥐여 준다 — 검사용. 걸어가서 1초 잡는 것을 건너뛴다 */
  giveItem(kind) { return giveCarry(carry, kind); },
  /**
   * 문 하나를 끼운 것으로 친다 — **검사용.** 게임은 마모로 낀다.
   * 65분에 네 번 끼는 것을 기다릴 수는 없으니 구멍을 낸다.
   */
  jam(key) {
    const d = doors.list.find((x) => x.key === key);
    if (!d) return false;
    d.jammed = true; d.k = 0; d.held = 0;
    return true;
  },
  /**
   * 비상 크랭크 덮개가 얼마나 젖혀졌나 — 검사용.
   * ★ **각도를 내어 준다.** 「덮개를 만들었다」는 코드로 세면 되지만
   *   이 덮개가 하는 일은 **끼었다는 것을 멀리서 말하는 것**이라,
   *   정말 젖혀지는지를 봐야 한다. 안 젖혀지면 그냥 유리판이다
   */
  /** 비상 크랭크가 **세상 어디에** 있나 — 검사가 그 앞에 가서 서려고 묻는다 */
  crankAt(key) {
    const v = doorView[key];
    if (!v) return null;
    const w = v.view.crank.getWorldPosition(new THREE.Vector3());
    return { x: +w.x.toFixed(2), y: +w.y.toFixed(2), z: +w.z.toFixed(2) };
  },
  get covers() {
    const out = {};
    for (const d of doors.list) {
      const v = doorView[d.key];
      out[d.key] = { jammed: d.jammed, open: +(-v.view.cover.rotation.x).toFixed(2) };
    }
    return out;
  },
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
   * 수리가 지금 어느 동작인가 — 검사용.
   * ★ **손이 실제로 그 모양인지**까지 낸다 (`hand`). 표만 보면
   *   「네 동작이 있다」로 끝나고, 그건 화면에 아무것도 안 나와도 통과한다
   */
  get repair() {
    return {
      act: repairAct, what: repairPose?.what ?? null,
      pose: repairPose ? {
        fingers: repairPose.fingers.map((v) => +v.toFixed(2)),
        thumb: +repairPose.thumb.toFixed(2),
        roll: +repairPose.roll.toFixed(2), push: +repairPose.push.toFixed(3),
      } : null,
      hand: hands.at,
      need: repairing?.steps?.[repairing.step]?.hold ?? null,
      held: repairing ? +repairing.held.toFixed(2) : null,
    };
  },
  /**
   * 수리를 그만큼 잡고 있던 것으로 친다 — **검사용.**
   * ★ 헤드리스는 게임 시간이 실시간의 20분의 1이라, 8초짜리 걸음을 실제로
   *   잡으면 3분이 걸린다. 네 동작을 다 보려면 12분이다. 그래서 구멍을
   *   낸다 — 재는 것은 「시간이 맞나」가 아니라 **「손이 따라오나」**다
   */
  seekRepair(sec) {
    const f = faults.open[0];
    if (!f) return false;
    f.held = sec;
    return true;
  },
  /** 손이 지금 어떤가 — 검사용 */
  get hands() {
    let root = hands.group;
    while (root.parent) root = root.parent;
    return { ...hands.at, onScreen: root === scene };
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
  get hold() { return input.hold; },
  /** 열 이력을 억지로 채운다 — 헤드리스는 게임 시간이 1/20 이라 그래프가 안 쌓인다 */
  fakeTrend(list) { trend.length = 0; for (const v of list) trend.push(v); },
  get act() { return actNow(); },
  get trendLen() { return trend.length; },
  get camera() { return camera; },
  get reach() { return BODY.reach; },
  get aimTargets() {
    const pans = Object.values(ship.panels);
    return [ship.valve, ...ship.breakers.map((x) => x.hit), ...ship.cock.plates.map((x) => x.hit),
      ...pans.map((x) => x.hit), ship.winch.hit, ship.tradeHatch.hit, ship.cock.yokeHit,
      ...ship.doors.map((d) => d.view.hit)];
  },
  get doorsRaw() { return doors.list.map((d) => ({ key: d.key, x: d.x, z: d.z, ry: d.ry })); },
  /** 안내선이 지금 어디를 가리키나 · 화살표가 몇 개 켜졌나 — 검사용 */
  get guide() {
    const t = guideAim();
    return { aim: t ? { x: +t.x.toFixed(2), z: +t.z.toFixed(2) } : null,
      on: guide.on, marks: guide.group.children.filter((m) => m.visible).length };
  },
  /**
   * **읽어야 할 면 앞을 가로지르는 것이 있나** — 검사용.
   *
   * ★ 같은 병을 세 번 만났다 (2026-08-04):
   *   ① 링 프레임 기둥이 문 다섯을 관통 ② 통로 난간이 문 넷을 관통
   *   ③ **기관실 난간이 랙 면 0.5m 앞을 가로지름** ← 사장님이 또 잡으셨다
   *
   *   전부 「가로로 긴 것을 벽 따라 죽 긋고 **그 벽에 뭐가 붙어 있는지
   *   안 본」 것이다. `clearDoorway` 는 문만 봤다. 벽에 붙은 것은 문 말고도
   *   랙·패널·차단기·해도대가 있고, 그 앞이 막히면 **읽을 수가 없다.**
   *
   * @param at {x,z,ry} 면의 자리와 바라보는 방향
   */
  clearFace(at, span = 1.6, ys = [1.0, 1.3, 1.6]) {
    // 면을 따라(가로) 쏜다. 앞뒤로 훑는 것은 문과 같은 이유다
    const ux = Math.cos(at.ry), uz = -Math.sin(at.ry);
    const nx = Math.sin(at.ry), nz = Math.cos(at.ry);
    const hits = [];
    for (const y of ys) for (const o of [0.14, 0.28, 0.45]) {
      ray.set(
        new THREE.Vector3(at.x - ux * span + nx * o, y, at.z - uz * span + nz * o),
        new THREE.Vector3(ux, 0, uz),
      );
      ray.far = span * 2;
      for (const h of ray.intersectObject(ship.group, true)) {
        if (h.object.material?.visible === false) continue;
        const n = h.object.name || h.object.parent?.name || '';
        // **긴 것만** 본다 — 랙 자체나 벽은 잡히는 게 당연하다
        if ((n === '난간' || n === '배관') && !hits.includes(n)) hits.push(n);
      }
    }
    return hits;
  },
  /** 그 문을 지금 끼게 한다 — 검사용. 게임은 안 쓴다 */
  jamDoor(key) {
    const d = doors.list.find((x) => x.key === key);
    if (!d) return false;
    d.jammed = true; d.k = 0; d.dwell = 0; d.force = 0;
    return true;
  },
  forceHazard() { hazard.next = 0; hazard.inLeg = 0; return stepHazard(hazard, 0.001, { region: ship.outside.region }); },
  /**
   * 잔해를 **장전만** 한다 — 밟는 것은 게임이 밟는다.
   * ★ `forceHazard` 는 stepHazard 를 직접 불러서 **장면 빗장을 건너뛴다.**
   *   그걸로 「배치가 없으면 안 온다」를 재면 검사가 저 혼자 통과한다 —
   *   장전만 하고 문이 열리나는 frame 이 답하게 둔다
   */
  armHazard() { hazard.next = 0; hazard.inLeg = 0; hazard.phase = HPHASE.IDLE; return true; },
  /** 예고를 건너뛴다 */
  skipWarn() { if (hazard.phase === 'warn') hazard.t = hazard.need; },
  /** 보급 — 식량·부품·광석 */
  get supply() {
    return {
      food: +supply.food.toFixed(1), parts: supply.parts, ore: +supply.ore.toFixed(1),
      loads: supply.loads, traded: supply.traded, shaky: shaky(supply),
      trading: +trading.toFixed(2), hold: TRADE.hold,
      legsOnFood: +legsLeftOnFood(supply, route.fork?.seconds ?? LEG.seconds).toFixed(2),
      // ★ v62 — 추진제. 「몇 구간을 **밟고** 갈 수 있나」가 이 값의 뜻이다
      fuel: +supply.fuel.toFixed(1),
      dry: isDry(supply.fuel),
      fuelWord: fuelWord(supply.fuel),
      legsOnFuel: +legsLeftOnFuel(supply.fuel, ship.outside.region).toFixed(2),
      winching,
    };
  },
  setSupply(v) { Object.assign(supply, v); },
  /**
   * ★★ 우주복 (v62) — 검사와 점검 모드가 같은 구멍으로 본다.
   *   `word` 는 **화면에 뜨는 그 문장**이다 — 따로 만들면 갈라진다
   */
  get suit() {
    return {
      ...suitSummary(suit),
      word: suitWord(suit),
      inVacuum: vacNow,
      /** 우주복 없이 진공에 서서 배가 닫기까지 남은 초 (아니면 null) */
      bareLeft: bareLeft(lock, canEva(suit)),
      hand: suitHand(suit), move: suitMove(suit),
    };
  },
  /** 검사가 우주복을 입혀 놓는다 — 22초를 헤드리스로 붙들고 있지 않으려고 */
  putSuit(on = true, air = null) {
    suit.on = !!on; suit.wearing = 0; suit.doffing = 0;
    if (air !== null) suit.air = air;
    ship.suitRack?.setWorn(suit.on);
    return suitSummary(suit);
  },
  /** 항로 — 어디까지 왔고 압박이 얼마인가 */
  get route() {
    return {
      phase: route.phase, leg: route.leg, press: +route.press.toFixed(1),
      progress: +progress(route).toFixed(3), fork: route.fork?.key ?? null,
      offer: route.offer.map((o) => o.key), left: legsLeft(route),
      contactAt: +contactAt(route).toFixed(1), blind: isBlind(route),
    };
  },
  /**
   * 저장 · 멈춤 — **검사가 실제 게임의 것을 만진다.**
   * ★ 검사용으로 따로 짜면 검사는 통과하는데 게임은 안 되는 상태가 생긴다.
   *   이 저장소가 제일 자주 밟은 함정이라 손잡이만 내 준다.
   */
  get save() {
    return {
      can: canSave(), paused, boxShown: !pauseBox.hidden,
      clock: +clock.toFixed(2),
      stored: hasSave(),
      where: pauseBox.querySelector('.where').textContent,
      note: pauseBox.querySelector('.note').textContent,
    };
  },
  /** 장면 — 배치가 **게임 안에서도** 그대로인가를 검사가 본다 */
  get scene() { return { ...sceneSummary(scenes), choreOpen: allowChore(scenes) }; },
  /** ★ 에어록 바깥문 — 열면 갇히나 · 공기가 주나 */
  get lock() { return { ...lockSummary(lock), word: airWord(lock.air) }; },
  /** ★ 영구 손상 — 무엇이 남았나 · 무엇이 달라졌나 */
  get scars() { return { ...scarSummary(scars), list: scarList(scars), word: scarWord(scars.got) }; },
  /** ★ 떠도는 것들 — 지금 뭐가 떠 있고 어디를 겨누고 있나 */
  get sky() {
    const a = aimedAt(sky, aimAz, aimEl);
    return {
      ...skySummary(sky), az: +aimAz.toFixed(1), el: +aimEl.toFixed(1),
      locked: !!(a && inRange(a.t) && a.off <= tolOf(a.t)),
      nearest: a ? { kind: a.t.kind, off: +a.off.toFixed(1), dist: +a.t.dist.toFixed(0) } : null,
    };
  },
  /** 검사가 겨눔을 밀어 놓는다 — WASD 를 헤드리스로 오래 누르지 않으려고 */
  putAim(az, el) { aimAz = az; aimEl = el; return { az: aimAz, el: aimEl }; },
  /** 검사가 떠도는 것 하나를 조준선 앞에 놓는다 */
  putTarget(kind = 'junk') {
    const t = sky.list[0];
    if (!t) return null;
    t.kind = kind; t.az = aimAz; t.el = aimEl; t.dist = 60; t.hp = 1;
    return { kind: t.kind, az: t.az, el: t.el, dist: t.dist };
  },
  /** 검사가 흉터를 하나 얹어 본다 */
  giveScar(sys) {
    for (let i = 0; i < 3; i++) noteFix(scars, sys, { [sys]: 1 }, clock / 60);
    return scarSummary(scars);
  },
  /** 착륙이 어디까지 왔나 — **화면과 같은 값**을 준다 */
  get land() {
    return {
      ...landSummary(land),
      word: STEP_WORD[land.step] ?? null,
      tiltWord: tiltWord(land.tilt, bandFor(land.hard)),
      band: bandFor(land.hard),
      loading,
      /** ★ 화면이 정말 바뀌었나 — 고도 · 발광 · 땅 · 하늘색 */
      view: ship.outside.view,
    };
  },
  /** 검사가 내릴 자리를 띄운다 */
  offerLand(hard = false) { offerPlanet(land, hard); return landSummary(land); },
  /**
   * 검사가 마디를 밀어 놓는다 — **화면을 찍으려고 낸 구멍.**
   * ★ `stepLand` 를 직접 부르지 않는다. 여기서 상태만 바꾸고 **게임이
   *   굴리게** 둔다 — 안 그러면 「검사는 통과하는데 화면은 조용한」 상태가 된다
   */
  putLand(step, t = 0) { land.step = step; land.t = t; land.offered = step !== 'none'; return landSummary(land); },
  /** 검사가 문을 바로 열고 닫는다 */
  putLock(open) { lock.open = !!open; lock.cycling = 0; return lockSummary(lock); },
  setAir(v) { lock.air = Math.max(0, Math.min(1, v)); return lockSummary(lock); },
  /** ★ 주포 — 올라갔나 · 쏘면 뭐가 주나 */
  get gun() { return { ...gunSummary(gun), flashSign: flashSign(gun) }; },
  /**
   * ★★★ 조종석 전투 (v64) — 검사와 점검 모드가 **같은 구멍**으로 본다.
   *   `word` 는 화면에 뜨는 그 문장이다 — 따로 만들면 갈라진다
   */
  get combat() {
    const a = aimedAt(sky, aimAz, aimEl);
    return {
      ...cbtSummary(combat),
      word: lockWord({ on: combat.radar.on, locked: combat.radar.id !== null, t: combat.radar.t }),
      aim: { az: +aimAz.toFixed(1), el: +aimEl.toFixed(1) },
      locked: isLocked(combat, a?.t ?? null),
      target: a ? { id: a.t.id, kind: a.t.kind, dist: +a.t.dist.toFixed(0), hp: a.t.hp, off: +a.off.toFixed(1) } : null,
      why: a ? null : '겨눈 것이 없습니다',
    };
  },
  /** ★ 검사가 자동 항법을 되돌려 놓는다 — 절과 절 사이를 깨끗하게 */
  putAuto(on) { if (on) engageAuto(helm); else takeHelm(helm); return helm.auto; },
  /** 검사가 무기를 고른다 */
  putWeapon(n) { pickSlot(combat, n); return cbtSummary(combat); },
  /** 검사가 쏜다 */
  fire() { fireGun(); return cbtSummary(combat); },
  /** ★ 검사·점검 모드가 **적 우주선**을 하나 부른다 */
  callRaider() { const t = spawnRaider(sky); return { id: t.id, dist: +t.dist.toFixed(0), hp: t.hp }; },
  /** 검사가 사다리를 안 타고 올라간다 */
  /**
   * ★ 검사가 주포에 앉혀 놓는다.
   *   ★★ v63 — **몸도 좌석으로 옮긴다.** 예전엔 `gun.up` 만 켰고, 그러면
   *   「올라갔다」고 나오는데 **화면은 그대로**였다 (자리를 옮기는 것은
   *   `walk()` 안의 `gunBusy` 가지인데 `moving = 0` 이라 안 돈다).
   *   그 상태로 스크린샷을 찍으면 「주포가 안 된다」로 보인다 —
   *   실제로 사장님이 그렇게 보셨다
   */
  /**
   * ★★ v64 — **주포가 없어졌다.** 「앉는다」는 이제 조종석 하나뿐이므로
   *   이 구멍은 조종석 좌석으로 보낸다. 이름을 지우지 않는 이유:
   *   검사와 점검 모드가 아직 부르고, 조용히 사라지면 「안 된다」로 읽힌다
   */
  putGun(up) {
    helmSat = !!up;
    const at = up ? HELM_SEAT.seatAt : HELM_SEAT.standAt;
    me.x = at.x; me.z = at.z;
    me.pitch = up ? SIT_LOOK : 0;
    return { ...gunSummary(gun), movedTo: 'helm' };
  },
  /** 검사가 쏜다 — **게임과 같은 길로** (fireGun 이 배너·열·거리를 다 한다) */
  fireGun() { fireGun(); return gunSummary(gun); },
  /** ★ 조종 — 조종간이 늘 먹나 · 벗어나면 느려지고 안 보이나 */
  get helm() { return { ...helmSummary(helm), word: offWord(helm.off) }; },
  /** 검사가 조종간을 안 잡고 항로를 벗어나 본다 */
  setOff(v) { helm.off = Math.max(0, Math.min(1, v)); if (helm.way === 0) helm.way = 1; return helmSummary(helm); },
  /** ★ 검사가 조종간을 안 잡고 **수동으로 바꿔** 본다 */
  setManual() { takeHelm(helm); return helmSummary(helm); },
  /**
   * ★ 검사가 **행성에 얼마나 다가갔는지**를 밀어 놓는다.
   *   끌려가는 속도(0.055/초 · 18초)는 위에서 재고, 여기서는 **마지막
   *   한 걸음이 정말 끝으로 이어지나**만 본다 — 헤드리스는 게임 시간이
   *   실시간의 20분의 1 이라 18초를 다 기다리면 6분이 넘는다
   */
  setNear(v) { helm.near = Math.max(0, Math.min(0.995, v)); return helmSummary(helm); },
  /** ★ 자세 제어 — 배가 도나 · 잡으면 멎나 · 고치면 살아나나 */
  get drift() { return { ...driftSummary(drift), roll: +driftRad(drift).toFixed(3) }; },
  /** 검사가 장면을 기다리지 않고 배를 돌려 본다 */
  killDrift(forever = false) {
    killDrift(drift, { permanent: forever, way: driftWay });
    // ★ 영구로 죽으면 **흉터 목록에 든다** — 끝 화면이 셋을 한 줄로 읽는다
    if (forever) noteScene(scars, 'drift', clock / 60);
    drift.needsFix = forever ? false : !!openFault(faults, 'attitude');
    return driftSummary(drift);
  },
  /** 구간을 갈아 끼운다 — 검사가 12구간을 다 걸어가지 않아도 되게 */
  setLeg(n) { route.leg = n - 1; sceneLeg(scenes, n); return sceneSummary(scenes); },
  /**
   * 장면 시계를 앞으로 민다 — **밟는 것은 게임이 밟는다.**
   * ★ 여기서 stepScene 을 직접 돌리면 배너도 소리도 안 난다 (그건 frame 에
   *   있다). 그러면 「검사는 통과하는데 화면은 아무 일도 없는」 상태가 된다 —
   *   이 저장소가 제일 자주 밟은 함정이라 **시계만 밀고 밟기는 안 한다**
   */
  seekScene(sec = 600) { scenes.inLeg += sec; return sceneSummary(scenes); },
  /** 지금 박자를 끝낸 것으로 친다 — 다음 프레임에 게임이 다음 박자로 넘긴다 */
  skipBeat() { scenes.t = scenes.need; return sceneSummary(scenes); },
  /**
   * 여운의 일을 **지금 오게** 한다 — 시계만 민다.
   * ★ 헤드리스는 게임 시간이 실제의 1/20 이라 3.8초를 기다리면 76초다.
   *   그렇다고 검사가 `stepFaults` 를 직접 부르면 배너도 소리도 안 나서
   *   「검사는 통과하는데 화면은 조용한」 상태가 된다 — 시계만 민다
   */
  seekEmber() { if (scenes.ember > 0) scenes.ember = 0.0001; return sceneSummary(scenes); },
  saveNow() { return saveNow(); },
  clearSave() { clearRaw(); },
  /**
   * ★★ **처음부터 다시** (2026-08-06 · 사장님 「계속 이어하기로 나오는데?
   * 새 게임은 어떻게 하는거야?」)
   *
   * 저장 칸이 하나뿐이라 켤 때마다 **말없이 이어졌고**, 처음부터 시작하는
   * 길이 아무 데도 없었다. 「저장 지우기」는 있었지만 그건 지우기지
   * 시작하기가 아니다 — 지운 다음 새로고침을 해야 한다는 것을 알아야만
   * 쓸 수 있었고, 그건 아는 사람만 쓰는 길이다.
   *
   * ★ **되살리지 않고 새로고침한다.** 회차 하나가 배·항로·고장·문·흉터·
   *   장면까지 수십 군데에 퍼져 있어서, 하나씩 되돌리면 반드시 하나를
   *   빠뜨린다 (열만 0 이 되고 흉터는 남는 식으로). 새로고침은 빠뜨릴
   *   것이 없다.
   */
  newGame() { clearRaw(); location.reload(); },
  /** ★ G 구조 신호 — 검사와 점검 모드가 읽는다 (7판) */
  get rescue() { return rescueSummary(rescue); },
  /** 신호를 켠다 — 구간 7 을 안 기다리려고 */
  callRescue() { hearSignal(rescue); return rescueSummary(rescue); },
  /** ★ E 정전 — 검사와 점검 모드가 읽는다 (7판) */
  get dark() { return darkSummary(dark); },
  /** 전력을 내린다 — 구간 8 을 안 기다리려고 */
  killLights() {
    killPower(dark);
    for (const k of Object.keys(power)) power[k] = false;
    return darkSummary(dark);
  },
  /**
   * ★ 어느 단계로든 바로 세워 놓는다 — `putLand`·`putGun` 과 같은 구멍.
   *   응답이 42초라 헤드리스(게임 시간 1/20)로는 14분이 걸린다. 도구가
   *   기다리는 것과 게임이 되는 것은 다른 문제다
   */
  putRescue(step) {
    rescue.step = step;
    if (step === RSTEP.NEAR) { rescue.t = RESCUE.answer; rescue.wait = 0; rescue.took = 0; }
    return rescueSummary(rescue);
  },
  /** ★ 끝 — 화면이 떴나 · 목록에 무엇이 있나 (8판 · tools/space-end.js) */
  get end() {
    return { shown: !endBox.hidden, what: endWhat, list: endWhat ? endList(endWhat) : [] };
  },
  /** 지금 성간 공백인가 (`void-table.js`) */
  get inVoid() { return isVoid(route.leg) && route.phase === RPHASE.LEG; },
  /**
   * ★ **어느 구간의 끝에 세워 놓는다** — 검사와 점검 모드가 2시간을 안
   *   기다리려고. `setLeg` 로 구간만 옮기면 게임이 성간 공백을 **안 거친다** —
   *   여기서는 문턱에 세워 놓고 **게임이 스스로 들어가게** 둔다.
   *   그래야 검사가 보는 길과 사람이 가는 길이 같다.
   *
   *   `seekVoid()` → 11구간 끝 → 다음 틱에 성간 공백으로 들어선다
   *   `seekEnd()`  → 12구간 끝 → 다음 틱에 도착(끝 화면)
   */
  seekLegEnd(leg) {
    route.leg = Math.max(0, Math.min(LEG.count - 1, leg));
    route.phase = RPHASE.LEG;
    route.fork = route.fork || forkOf('empty');
    route.need = route.fork.seconds;
    route.t = route.need - 0.5;
    return { leg: route.leg, phase: route.phase };
  },
  seekVoid() { return this.seekLegEnd(LEG.count - 2); },
  seekEnd() { return this.seekLegEnd(LEG.count - 1); },
  pause(v) { showPause(v ?? !paused); return paused; },
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
    return {
      그리기: lastCost.calls, 삼각형: lastCost.tris,
      조명: lights, 물체: meshes, 프로그램: renderer.info.programs?.length ?? 0,
    };
  },
};

// ── 이어하기 ────────────────────────────────────────────────
// ★ **켜자마자 한 번.** 물어보지 않고 그냥 잇는다 — 칸이 하나뿐이라
//   (`SAVE.slots === 1`) 고를 것이 없고, 「새로 시작할까요」를 물으면
//   사람은 매번 그 물음을 지나야 한다. 대신 **이었다고 말해 준다.**
{
  const back = loadOnce();
  if (back) {
    banner = `이어합니다 — ${back.text}`;
    bannerT = 4.0;
    console.log(`[저장] 이어합니다 — ${back.text}`);
    // ★ 시작 안내가 「눌러 **시작**합니다」라고 말하고 있으면 거짓말이다.
    //   이미 62분을 온 사람에게 시작이라고 하면 「저장이 안 됐나」로 읽힌다
    const first = hint.querySelector('p');
    if (first) first.innerHTML =
      `화면을 눌러 <b>이어갑니다</b> — ${back.text}. 소리가 납니다 — <b>M</b> 으로 끕니다.`;
  }
}

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
  const dt0 = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  // ★ **멈추면 시간도 멈춘다.** dt 를 0 으로 두면 아래 전부가 그대로
  //   얼어붙는다 — 계통마다 「멈췄나」를 묻게 하면 반드시 하나를 빠뜨린다
  const dt = paused ? 0 : dt0;
  clock += dt;

  // ★ 멈췄으면 **쌓인 마우스도 버린다.** `takeLook()` 은 지난 움직임을
  //   모아 뒀다 돌려주므로, 그냥 두면 계속하는 순간 그동안 움직인 만큼
  //   시선이 홱 돌아간다. dt 를 0 으로 만드는 것만으로는 안 막힌다
  const look = paused ? (input.takeLook(), { dx: 0, dy: 0 }) : input.takeLook();
  // ★ 조종간을 잡고 있으면 마우스가 **시선이 아니라 배**를 움직인다.
  //   `steering` 은 지난 프레임의 판정이라 한 프레임 늦는다 — 조준은
  //   interactStep 에서 나오고 그건 이 아래에서 돈다. 16ms 라 안 느껴진다.
  if (steering) {
    steerPush = Math.max(-1, Math.min(1, look.dx * 0.03));
    // ══ ★★ **세 축** (v60) ══════════════════════════════════════
    //  여태 마우스 Y 는 **고개**만 움직였다. 조종간을 잡고 있는데
    //  위아래가 시선이면 그건 조종간이 아니라 손잡이다.
    //    좌우 → 옆미끄러짐 · 위아래 → **기수** · Q/E → **비틀기(360도)**
    //  ★ 잡는 동안 고개가 안 돌아가는 것이 맞다 — 두 손으로 미는 중이다.
    //    놓으면 그대로 돌아온다
    flyPush.yaw = steerPush;
    flyPush.pitch = Math.max(-1, Math.min(1, -look.dy * 0.03));
    flyPush.roll = (input.keys.has('KeyE') ? 1 : 0) - (input.keys.has('KeyQ') ? 1 : 0);
  } else {
    steerPush = 0;
    flyPush.pitch = 0; flyPush.yaw = 0; flyPush.roll = 0;
    me.yaw -= look.dx * 0.0022;
    me.pitch = Math.max(-1.35, Math.min(1.35, me.pitch - look.dy * 0.0022));
    // 얼마나 둘러봤나 — 조종간을 잡고 있을 때는 안 센다. 그건 배를 민 것이다
    taught.turned += Math.abs(look.dx) * 0.0022;
  }

  walk(dt);

  // ── 항로가 나아간다 ────────────────────────────────────
  // ★ 전에는 구역이 95초마다 **돌았다.** 지금은 관측실에서 고른 갈래가
  //   정하고, **추진을 켜야 나아간다** (game/route.js).
  // ── 장면 — **네 박자** (PLAN2H §2) ────────────────────
  // ★ 항로보다 **먼저** 돈다. 구간이 끝나는 프레임에 stepRoute 가 leg 를
  //   올리는데, 그 뒤에 장면을 밟으면 **새 구간의 장면을 옛 구간 길이로**
  //   재게 된다. 한 프레임짜리지만 「예고가 0초」 같은 모양으로 나온다
  const sev = stepScene(scenes, dt, route.need || 600);
  // ── ★★ B — **행성을 발견한다** ────────────────────────
  // 「대응」 박자가 시작될 때 해도대에 내릴 자리가 뜬다. 예고 때는 아직
  // 「전방에 중력원」뿐이다 — 예고가 예고이려면 준비할 시간이 있어야 한다
  if (sev === 'act' && sceneOpen(scenes, 'B') && !land.offered && !landBusy(land)) {
    offerPlanet(land, !!scenes.hard);
    audio?.event('fault');
  }
  // ★ **대응 시계가 다 됐는데 아직 안 내렸으면 지나친 것이다.** 안 그러면
  //   해도대를 한 번도 안 본 사람에게 장면 B 가 영영 안 끝난다 —
  //   그건 긴장이 아니라 멈춘 게임이다
  if (scenes.overdue && scenes.keys.includes('B') && !landBusy(land)) {
    passPlanet(land);
    sceneDone(scenes, 'B');
  }
  // ── ★★ G — **조난 신호를 받는다** (7판 · 줄기 「혼자다」) ──
  //   대응 박자에 무전기가 살아난다. 예고 때는 「조난 신호를 받았습니다」만
  //   뜬다 — 예고가 예고이려면 준비할 시간이 있어야 한다 (B·C 와 같은 규약)
  if (sev === 'act' && sceneOpen(scenes, 'G') && hearSignal(rescue)) {
    banner = RESCUE.heard; bannerT = 5.0;
    audio?.event('fault');
  }
  // ★ 대응 시계가 다 됐는데 아직 응답 안 했으면 **지나친 것이다.**
  //   조용히 영원히 기다리면 장면이 안 끝나고, 안 끝나는 장면은 멈춘 게임이다
  if (scenes.overdue && scenes.keys.includes('G') && !rescueDone(rescue)) {
    if (passSignal(rescue)) { banner = RESCUE.passed; bannerT = 3.0; }
    sceneDone(scenes, 'G');
  }

  // ── ★★ E — **전력이 나간다** (7판 · 줄기 「배가 낡아 간다」) ──
  //   대응 박자에 셋이 한꺼번에 내려간다. 예고 때는 「전력 계통 이상」만
  //   뜬다 — 예고가 예고이려면 준비할 시간이 있어야 한다
  if (sev === 'act' && sceneOpen(scenes, 'E') && killPower(dark)) {
    // ★ **회로 셋이 다 꺼진다.** 그래서 열은 0.5/초로 천천히 오르고
    //   (재 봤다 — 132초에 100), 추진이 꺼져 구간도 안 나아간다.
    //   시계는 새로 안 만들었다 — 이미 있었다 (blackout-table.js)
    for (const k of Object.keys(power)) power[k] = false;
    banner = DARK.hit; bannerT = 5.5;
    audio?.event('fault');
  }
  // ★ 대응 시계가 다 됐는데 아직 안 올렸으면 **저절로 돌아온다.**
  //   장면이 안 끝나면 배가 영영 어둡고, 그건 긴장이 아니라 멈춘 게임이다
  if (scenes.overdue && scenes.keys.includes('E') && !darkDone(dark)) {
    dark.step = DSTEP.BACK;
    banner = DARK.back; bannerT = 3.0;
    sceneDone(scenes, 'E');
  }

  // ── ★ C — 자세 제어가 죽는다 ──────────────────────────
  // 「대응」 박자가 시작될 때 죽는다. **예고 때는 아직 멀쩡하다** —
  // 예고가 예고이려면 준비할 시간이 있어야 한다 (PLAN2H §2)
  if (sev === 'act' && sceneOpen(scenes, 'C') && !drift.dead) {
    const forever = route.leg + 1 >= DRIFT.permanentAtLeg;
    killDrift(drift, { permanent: forever, way: driftWay });
    // ★ **고칠 것을 같이 연다.** 배만 돌고 고칠 데가 없으면 그건 장면이
    //   아니라 화면 효과다. 3막에서는 안 연다 — 못 고치는 판이니까
    // ★ **연 것을 기억해 둔다.** 안 그러면 아래의 「다 고쳤나」가
    //   「애초에 안 열렸다」와 구별이 안 돼서, 못 연 판에서 **혼자
    //   저절로 낫는다.** 조용히 낫는 고장은 고장이 아니다
    drift.needsFix = !!openFault(faults, 'attitude');
    banner = forever ? '자세 제어가 나갔습니다 — 예비가 없습니다' : '자세 제어가 나갔습니다';
    bannerT = 4.0;
    audio?.event('caught');
  }
  // ── ★★ F — 감압. **방이 진공이 된다** (v62 · 마지막 장면) ────
  // ★ 여덟 장면 중 이것만 못 짓고 있었다. 「공기」가 계통이 아니었기
  //   때문인데, v62 에 우주복이 생기면서 규칙이 됐다 (REAL.md §2-C).
  // ★ **「흩뿌려 맞았다」(두 방)로 연다.** 한 방이면 가서 막으면 끝인데,
  //   두 방이면 「막았는데 왜 아직 새지」가 나고 그게 이 장면이다
  if (sev === 'act' && sceneOpen(scenes, 'F') && !leakOpen) {
    if (openFault(faults, 'micrometeor', { branch: 'spray' })) {
      // ★ **연 것을 기억해 둔다.** C(자세 제어)에서 배운 것이다 —
      //   안 그러면 「다 고쳤나」와 「애초에 안 열렸나」가 구별이 안 돼서
      //   못 연 판에서 **혼자 저절로 낫는다**
      leakOpen = true;
      banner = '기밀 경보 — 어딘가 벽이 뚫렸습니다';
      bannerT = 4.4;
      audio?.event('caught');
    }
  }
  // ★ 두 방을 다 막았으면 장면이 닫힌다. **저절로 안 낫는다**
  if (leakOpen && !faults.open.some((o) => o.key === 'micrometeor')) {
    leakOpen = false;
    sceneDone(scenes, 'F');
  }

  // ── 대응 시계가 다 됐다 — **계통에게 끝내라고 말한다** ──
  // ★ 조용히 해소로 넘기면 「장면은 끝났는데 적은 아직 붙어 있는」 상태가
  //   된다. 대응이 2~4분을 넘었다면 그건 지대를 다 지났다는 뜻이니
  //   **실제로 끝내 준다** — 그리고 그 끝냄이 `sceneDone` 으로 돌아온다
  if (sev === 'act-end') {
    if (scenes.keys.includes('A') && (chase.phase === PHASE.CHASE || chase.phase === PHASE.CAUGHT)) {
      chase.phase = PHASE.SHAKEN; chase.timer = 0; chase.risk = 0; chase.dist = 0;
      banner = '더는 안 보입니다'; bannerT = 3.0;
      audio?.event('escaped'); escapedAt = clock;
      relieveEscape(route);
    }
    // ★ 자세 제어는 **안 고쳐 준다.** 안 고치고 지대를 나온 것이라
    //   기울어진 채로 여운에 들어간다 — 「안 고치면 안 고친 대로 남는다」
    for (const k of scenes.keys) sceneDone(scenes, k);
  }

  // ── 여운 — ★ **여기가 「시간 가는 줄 모른다」의 자리다** ──
  if (sev === 'after') {
    // 해소 직후 0초에 안 낸다. 「뿌리친 3초」 위에 일을 얹으면 보상이 사라진다
    // ★ **이미 손이 차 있으면 안 낸다.** 열린 고장이 상한(2)에 닿아 있으면
    //   `stepFaults` 가 조용히 아무것도 안 만든다 — 그러면 「여운에 일이
    //   온다」는 약속이 **약속만 하고 안 지켜진 채로** 넘어간다.
    //   여운이 빈 게 아니라 **이미 할 일이 있는 것**이니 안 내는 게 맞고,
    //   다만 **예약도 안 한다** — 안 그러면 「예약됐는데 안 왔다」가 된다
    const room = faults.open.length < FAULT.maxOpen;
    scenes.ember = (room && emberWorth(faults.wear)) ? emberAt(scenes) : 0;
  }
  if (scenes.ember > 0) {
    scenes.ember -= dt;
    if (scenes.ember <= 0) {
      scenes.ember = 0;
      // ★ **쌓인 마모가 일로 돌아온다.** 장면 동안 부딪히고 무리한 만큼이다.
      //   `drift-table.js` 가 적어 둔 「벌은 미뤄지지 없어지지 않는다」가
      //   실제로 지켜지는 자리가 여기다 — 안 그러면 그 문장은 주석일 뿐이다
      faults.next = 0;
      if (stepFaults(faults, 0.001, { calm: true, leg: route.leg }) === 'spawn') {
        const o = faults.open[faults.open.length - 1];
        banner = o.lead; bannerT = 3.6;
        audio?.event('fault');
      }
    }
  }

  if (sev === 'warn') {
    // ★ **무엇이 오는지만 말한다. 어디가 잘못됐나는 안 가르친다** (PLAN §3-1)
    const lead = leadOf(scenes);
    if (lead) { banner = lead; bannerT = 4.0; audio?.event('fault'); }
  }

  // ★ 벗어난 만큼 **느리게** 나아간다 (helm-table.js legMult)
  // ★★ **내려가 있는 동안은 구간이 안 나아간다.** 땅에 붙은 배는 항로를
  //   가지 않는다 — 그런데 **압박은 계속 쌓인다** (stepRoute 가 시간으로
  //   센다). 「숨는 것」과 「안 쫓기는 것」은 다르다는 규약 그대로다
  // ★ **응답하는 동안도 구간이 안 나아간다** — 다가가느라 시간을 버리는
  //   것이고 그동안 압박은 계속 쌓인다 (착륙과 같은 규약 · RESCUE.hold)
  const rev = stepRoute(route, dt * helmLeg(helm), power,
    { hold: landBusy(land) || rescueHold(rescue) });
  // ★ **벗어난 채로는 거점에 못 닿는다.** 「틀어 놓고 잊기」를 막는 유일한
  //   자리다 — 자국만 주고 잊는 벌이 없으면 늘 틀어 놓는 것이 답이 된다
  const missed = rev === 'arrive' && !tryDock(helm);
  if (missed) {
    // ★ 규칙은 route.js 가 갖는다 — 밖에서 `t` 만 만지면 leg 가 하나
    //   앞선 채로 남아서 「구간 7/12 인데 실제로는 6번째」가 된다
    missPort(route);
    banner = '거점을 지나쳤습니다 — 항로로 돌아옵니다';
    bannerT = 3.4;
    audio?.event('caught');
  } else if (rev === 'arrive' || rev === 'end') {
    newLeg(hazard);
    // ★ 구간이 바뀌면 **다음 장면을 예약한다.** route.leg 는 0 부터 세고
    //   배치표는 1 부터 센다 — 여기서 한 번만 맞춘다
    sceneLeg(scenes, route.leg + 1);
  }
  if (rev === 'arrive' && !missed) {
    // ★ **여기서 저장한다.** 거점은 원래 숨 쉬는 자리이고, 12구간이면
    //   12번이다. 초마다 저장하면 「죽기 직전으로 되돌리기」가 된다
    if (SAVE.onLeg) saveNow();
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
  // ★★ **성간 공백에 들어섰다** (8판 · `void-table.js`). 거점을 안 거치고
  //   바로 마지막 구간으로 들어온다 — 고를 것도 살 것도 없다
  if (rev === 'void') {
    banner = VOID.enter;
    bannerT = VOID.enterFor;
    // 쫓아오던 것이 있으면 **여기서 떨어진다.** 「따라오지 못하는 곳」이
    // 이름값을 하려면 붙어 있던 것도 놓쳐야 한다
    if (chase.phase === PHASE.CHASE || chase.phase === PHASE.CAUGHT) {
      chase.phase = PHASE.SHAKEN; chase.timer = 0; chase.dist = 0;
    }
    chase.risk = 0;
    // ★★★ **창밖을 성간 공백으로 바꾼다** (v66 에서 빠져 있던 것을 찾았다).
    //   여기서 배너만 띄우고 **하늘은 안 바꾸고 있었다.** 「따라오지
    //   못하는 곳까지 간다」가 이 게임의 목적 한 줄인데, 정작 도착하면
    //   **창밖이 그대로**였다 — 말로만 도착한 셈이다.
    //   `space-endtoend [7] ③` 이 잡았고, 그 검사는 v64 부터 [1] 에서
    //   죽어 있었으므로 **여기까지 와 본 적이 없었다.**
    //   검사가 끝까지 도는 것이 왜 중요한지가 이 한 줄이다
    ship.outside.setRegion('void');
    audio?.event('escaped');
    escapedAt = clock;
    saveNow();          // 여기까지는 저장해 둔다 — 마지막 구간도 8분이다
  }
  if (rev === 'end') {
    banner = '더는 따라오지 못합니다';
    bannerT = 6.0;
    audio?.event('escaped');
    escapedAt = clock;
    // ★ **끝났으면 저장을 지운다.** 안 지우면 다음에 켤 때 「끝난 배」로
    //   이어져서, 이미 도착한 자리에 다시 서 있게 된다
    clearRaw();
    showEnd();
  }
  // 검사용 고정이 걸려 있으면 그것을 따른다 (게임은 안 쓴다)
  const wantRegion = regionPin || regionOf(route);
  if (wantRegion !== ship.outside.region) ship.outside.setRegion(wantRegion);

  // ── 배가 간다 ──────────────────────────────────────────
  // 창밖을 흘려보내고, 배가 미세하게 떤다. 둘 다 없으면 **정지 화면**이다.
  // ★ 거점에 서 있거나 추진이 꺼져 있으면 **느리게 흐른다** — 창밖이
  //   항로와 어긋나면 「가는 척하는 화면」이 된다
  const cruise = route.phase === RPHASE.PORT ? 0.25 : (power.thrust ? 1 : LEG.coast);
  // ★★ **착륙이 화면을 몬다** — 고도 하나가 별 흐름·하늘색·발광·지면을 다 정한다.
  //   `update` 보다 **먼저** 넣는다. 나중에 넣으면 이번 프레임은 옛 고도로
  //   그려지고, 그 한 프레임이 마디가 바뀌는 순간마다 툭 끊겨 보인다
  ship.outside.setLand({ step: land.step, t: land.t });
  // ★ 카메라를 준다 (v57). 별 천구가 **눈을 따라다녀야** 한다 —
  //   안 그러면 조종석에서 기관실까지 25m 를 걸을 때 별자리가 밀린다
  // ★ v60 — 선체 자세를 창밖에 넘긴다. **배를 굴리지 않고 밖을 굴린다** —
  //   그게 곧 짐벌이고, 걸어다니는 사람의 충돌이 안 어긋난다
  ship.outside.setAttitude(fly3);
  ship.outside.update(dt, CRUISE.speed * cruise, hazard.lane, incoming(hazard), camera);

  // 해도대 — 관측실에 있든 없든 계속 그린다. 걸어 들어갔을 때 이미 맞아 있어야 한다
  // ★ **해도대가 어긋나면 눈금이 밀린다** (chartDrift). 다만 **거짓말인 줄은
  //   알게** 한다 — 값이 떨리므로 「지금 이 숫자를 못 믿는다」가 보인다.
  //   모르고 속으면 그건 고장이 아니라 사기다
  const lie = bad.chartLie ? Math.sin(clock * 2.3) * 14 : 0;
  ship.chart.update({
    leg: route.leg, press: Math.max(0, Math.min(100, route.press + lie)),
    atPort: route.phase === RPHASE.PORT, offer: route.offer,
    // ★ 내릴 자리가 떠 있으면 같은 판 둘이 「내린다 / 지나친다」를 묻는다
    land: { offered: land.offered, hard: land.hard },
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
  // ★ 포탑에 올라가 있으면 **눈이 배 위로 나온다.** 사다리를 타는 중에는
  //   그 사이를 부드럽게 — 툭 순간이동하면 「올라갔다」가 안 읽힌다
  // ★ v64 — 포탑이 없어졌으므로 **눈이 배 위로 안 나간다** (`TURRET_RISE` 삭제)
  camera.position.set(me.x + sw * 0.4, BODY.eye + sh + sw * 0.25, me.z);
  camera.rotation.set(0, 0, 0, 'YXZ');
  camera.rotation.y = me.yaw;
  camera.rotation.x = me.pitch;
  // ★★ **짐벌이 새는 만큼만** 방이 기운다 (v60 · flight-table.js GIMBAL).
  //   0 이면 배가 도는지 몸으로 모르고, 크면 걷다가 넘어지는 게임이 된다
  camera.rotation.z = sw * 0.06 + fly3.tiltZ;
  camera.rotation.x += fly3.tiltX;

  // ══ ★★ **잡으면 들여다본다** (v59 · systems-table.js FOCUS) ══════
  //  사장님: 「조정석을 잡을 때는 스크린 화면을 확대해서 몰입하게」
  //
  //  ★ 계기가 **작아서 안 읽혔다.** 실제 크기로 콘솔에 박혀 있으므로
  //    서서 보면 글씨가 뭉갠다 — 그래서 여태 계기를 「보는」 것이 아니라
  //    「있는 줄 아는」 것이었다. 잡으면 몸이 기울고 눈이 좁아진다.
  //  ★ 확대창을 띄우는 것이 아니라 **카메라가 움직인다** —
  //    「손이 곧 상태창」을 안 깬다 (UI 를 하나도 안 늘렸다)
  //  ★★★ **v63 — 손잡이를 둘로 갈랐다.** 사장님: 「조정간을 잡으면
  //     전체 화면으로 나오게 해야지. 앉기만 하니깐 우주가 안보여서
  //     운전을 못하고」
  //
  //   여기가 그 자리다. `wantFocus` 에 `steering || gripping` 이 들어 있었다 —
  //   **모는 손잡이에 「들여다보기」를 걸어 놨던 것**이고, 그러면 화각이
  //   72 → 45 로 **좁아진다.** 계기를 읽으려고 만든 것이 모는 것에도 걸려
  //   밖을 더 못 보게 하고 있었다. 정확히 반대로 해야 하는 자리다.
  //
  //     읽는 손잡이 (밸브·차단기·해도대·패널) → 좁히고 당긴다 (FOCUS)
  //     모는 손잡이 (조종간·주포)            → **넓히고 든다** (FLY_VIEW)
  const wantFocus = (!steering && !gripping && readGrip) ? 1 : 0;
  focusK += (wantFocus - focusK) * Math.min(1, dt * FOCUS.rate);
  // ★★ 모는 눈 — 잡고 있는 동안 창이 화면을 채운다
  const wantFly = (steering || gripping) ? 1 : 0;
  flyK += (wantFly - flyK) * Math.min(1, dt * FLY_VIEW.rate);

  // ══ ★★ **조종간을 잡으면 앉는다** (v61) ═══════════════════════════
  //  사장님: 「좌석은 센터에 있어야지. 조정석 뒤에. 어떻게 앉아서 조정을
  //           할 수 있을지 먼저 생각해봐」
  //
  //  ★ 여태 **서서** 조종간을 잡았다. 그래서 조종간을 서 있는 눈(1.62)에
  //    맞춰 자꾸 올렸고(v16 에서 1.06 → 1.18), 올릴수록 **앉은 사람에게는
  //    더 못 쓰는 물건**이 됐다. 그리고 좌석이 한가운데 있으면 등받이가
  //    조종간을 가리길래 **좌석을 옆으로 밀었다** — 문제를 푼 게 아니라
  //    피한 것이다.
  //
  //  ★ 실제 조종석은 **앉은 눈이 올 자리(DEP)를 먼저 못박고** 나머지를
  //    거기서 잰다 (helm-table.js HELM_SEAT). 그러면 답이 하나다 —
  //    **조종간을 잡으면 앉는다.** 눈이 1.20 으로 내려가고 몸이 좌석으로
  //    미끄러지면, 조종간(0.98)은 눈보다 22cm 아래 — 손이 가는 자리다.
  //  ★ 새 동작을 안 만들었다. **잡는 것 하나로 앉기까지 된다** —
  //    「한 손잡이가 두 일을 하면 부딪힌다」와 안 부딪히는 이유는,
  //    앉는 것이 잡는 것의 **결과**이지 다른 일이 아니기 때문이다
  helmSitK += ((helmSat ? 1 : 0) - helmSitK) * Math.min(1, dt * HELM_SEAT.slide * 0.6);
  if (helmSitK > 0.002) {
    // 앉는 동안 몸이 **미끄러진다.** 툭 옮기면 그것도 거짓말이다 (주포 좌석과 같다)
    const s = helmSat ? HELM_SEAT.seatAt : HELM_SEAT.standAt;
    const k = Math.min(1, dt * HELM_SEAT.slide);
    me.x += (s.x - me.x) * k;
    me.z += (s.z - me.z) * k;
    camera.position.y -= (BODY.eye - HELM_SEAT.eye) * helmSitK;
  }
  // ★ 화각 — 읽을 때는 좁히고(45) 몰 때는 넓힌다(94). 둘이 동시에 1 이
  //   될 수 없으므로(`wantFocus` 가 `steering` 을 뺀다) 그냥 더한다
  const fov = FOV_WIDE + (FOCUS.fov - FOV_WIDE) * focusK + (FLY_VIEW.fov - FOV_WIDE) * flyK;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  if (focusK > 0.001) {
    // 보는 쪽으로 몸을 기울인다 — 자리는 그대로고 **눈만** 나아간다
    const lean = FOCUS.lean * focusK;
    camera.position.x -= Math.sin(me.yaw) * Math.cos(me.pitch) * lean;
    camera.position.z -= Math.cos(me.yaw) * Math.cos(me.pitch) * lean;
    camera.position.y += Math.sin(me.pitch) * lean;
  }
  if (flyK > 0.001) {
    // ══ ★★★ **잡으면 창이 화면을 채운다** (v63) ═══════════════════
    //  ① 눈이 **뜬다** — 눈썹 차양 위로. 앉은 눈(1.20)에서 계기 위로
    //     올라가는 30cm 가 「우주가 안 보인다」를 「보인다」로 바꾼다
    //  ② 눈이 **앞으로** 나간다 — 유리 바로 뒤. 창틀이 시야에서 물러난다
    //  ③ 고개가 **들린다** — 조종간을 보려고 숙인 34도를 게임이 들어 준다.
    //     ★ `me.pitch` 자체를 안 건드린다. 건드리면 놓는 순간 시선이
    //       하늘로 튀고, 그건 조종이 아니라 사고다 — **카메라만** 든다
    const yawS = Math.sin(me.yaw), yawC = Math.cos(me.yaw);
    const lean = FLY_VIEW.lean * flyK;
    camera.position.y += FLY_VIEW.rise * flyK;
    camera.position.x -= yawS * lean;
    camera.position.z -= yawC * lean;
    // 숙인 고개를 **`aimAt` 까지** 끌어올린다 (수평보다 조금 위 = 창의 한복판)
    const want = Math.max(me.pitch, FLY_VIEW.aimAt);
    camera.rotation.x += (want - me.pitch) * flyK;
  }

  const valveOpen = interactStep(dt);
  // ★ 벗어나 있으면 **자국이 준다** — 쫓는 쪽이 내 항로를 예측하고
  //   따라오는데, 예측을 벗어나면 다시 찾는 데 시간이 걸린다
  //   (CHASE2 §2-2 「실제로는 총질이 아니라 궤도다」)
  systemsStep(dt, valveOpen, signMult(route) * helmSign(helm));

  // ── ★ 배가 돈다 ──────────────────────────────────────
  // ★ **조종간을 잡고 있으면 멎는다.** 놓으면 점점 빨라진다.
  //   `steering` 은 이미 잔해 피하기가 쓰는 것과 같은 값이다 — 조종간을
  //   둘로 만들지 않는다. 같은 손잡이가 상황에 따라 다른 일을 한다
  // ── 조종 — **잡으면 항로를 벗어난다** ────────────────
  // ★ 잔해 지대 안에서는 같은 조종간이 **바위를 피하는 데** 쓰인다.
  //   두 가지를 동시에 하면 어느 쪽도 안 된다 (helm-table.js notInField)
  // ★★ 수동일 때만 **행성에 끌려간다.** 자동 항법이 켜져 있으면 절대
  //   안 박는다 — 자동 항법이 하는 일이 바로 그것이다
  const mev = stepHelm(helm, dt, steering ? steerPush : 0, hazard.phase === HPHASE.RUN, {
    region: ship.outside.region, thrust: power.thrust,
  });
  if (mev === 'home') { banner = '항로로 돌아왔습니다'; bannerT = 2.4; }
  if (mev === 'warn') {
    banner = hitWord(helm.near) ?? '중력원에 끌려갑니다';
    bannerT = 4.0;
    audio?.event('fault');
  }
  if (mev === 'wreck') wreck();
  // ★ 끌려가는 동안은 **화면이 붉게 떤다.** 배너 한 줄로만 알리면
  //   조종석 밖에 있는 사람은 못 본다 — 죽는 것은 예고 없이 오면 안 된다
  if (helm.near > HELM.warnAt) hitFlash = Math.max(hitFlash, helm.near * 0.7);

  // ── 에어록 바깥문 ────────────────────────────────────
  // ★ 땅에 내려앉아 있으면 **문을 열어 놔도 공기가 안 준다** (대기가 있다).
  //   v45 에서 「열어 놓고 잊을 수 없다」를 만들어 놨는데, 그 벌이 여기서만
  //   풀린다 — 그게 「내려오면 숨통이 트인다」다
  // ★★ **우주복을 입었으면 칸이 비어도 아무 일이 없다** (v62).
  //   진공은 벌이 아니라 절차다 — 벌은 「안 입고 열었다」 쪽에만 붙는다
  const lev = stepLock(lock, dt, {
    outsideAir: LAND.airHolds && landDown(land),
    suited: canEva(suit),
  });
  if (lev === 'open') { banner = '바깥문이 열렸습니다'; bannerT = 2.4; }
  if (lev === 'shut') { banner = '바깥문이 닫혔습니다'; bannerT = 2.0; }
  if (lev === 'blown') {
    // ★ **벌이 숫자가 아니라 기다림이다.** 45초 동안 못 연다.
    // ★ v62 부터 이건 「우주복 없이 진공에 서 있었다」일 때만 온다 —
    //   그래서 말도 바뀐다. 「기밀 상실」은 사고를 뜻하는데, 사고인 것은
    //   문이 아니라 **사람**이다
    banner = `우주복 없이 진공에 있었습니다 — 배가 문을 닫았습니다`;
    bannerT = 3.6;
    hitFlash = 1;
    audio?.event('caught');
  }
  ship.outerDoor.setOpen(lock.open ? 1 : (lock.cycling > 0 && lock.opening ? 1 - lock.cycling / LOCK.cycle : 0));
  // 열려 있으면 열이 빠진다 — 문을 여는 데 좋은 점이 하나는 있어야 한다
  heat = Math.max(0, heat - lockHeatOut(lock) * dt);

  // ── ★★ 행성 착륙 — **여섯 마디와 진입각 하나** ──────────
  // ★ 진입각은 **같은 조종간**이 잡는다 (`steerPush`). 항로 이탈 · 바위
  //   피하기 · 자세 붙들기에 이어 네 번째 일이다 — 손잡이를 넷으로 만들면
  //   사람은 넷을 배워야 하고, 그건 이 배의 규약이 아니다
  const lastStep = land.step;
  const lev2 = stepLand(land, dt, {
    hand: steering ? steerPush : 0,
    rnd: landRnd,
  });
  if (lastStep !== land.step && STEP_WORD[land.step]) {
    banner = STEP_WORD[land.step];
    bannerT = land.step === LSTEP.ENTRY ? 4.0 : 3.0;
    audio?.event(land.step === LSTEP.LANDED ? 'fixed' : 'latch');
  }
  if (lev2 === 'touch') {
    // 내려앉는 것도 공짜가 아니다 — 착지 충격이 선체에 남는다
    faults.wear.hull = Math.min(1, faults.wear.hull + LAND.touchWear);
    hitFlash = 0.5;
    // ══ ★★★ **내려앉으면 추진이 꺼진다** (v67 · REAL.md 류의 「말이 되나」) ══
    //  땅에 앉은 배가 **엔진을 켠 채**로 있었다. 그리고 에어록은
    //  「추진을 끄고 나서 엽니다」로 막으므로 (`whyNotOpen`), **바깥문이
    //  영영 안 열렸다** — 내리는 이유가 「싣는 것」인데 실을 수가 없었다.
    //  뜨는 것도 막힌다 (문을 닫아야 뜨는데 열지도 못했으니).
    //
    //  ★ 규칙을 무르게 한 것이 아니다. **켜 놓을 수 없는 상태**를 못박은
    //    것이다 — 착륙한 배의 주 추진은 꺼져 있다. 검사가
    //    「땅에서도 바깥문이 열린다 ✘ → 『추진을 끄고 나서 엽니다』」로
    //    잡았고, 그 뒤 넷이 통째로 이것 때문에 빨갰다
    power.thrust = false;
  }
  if (lev2 === 'sky') {
    // ★ **뜬 그 순간이 해소다.** 시계가 아니라 사건이 정한다 (scene.js)
    sceneDone(scenes, 'B');
    banner = `실어 온 것 — 광석 ${Math.round(land.got.ore)} · 부품 ${land.got.parts}`;
    bannerT = 4.0;
  }
  // 진입 중에 띠를 벗어나 있으면 **선체가 탄다** — 벌이 숫자가 아니라 일이다
  if (land.step === LSTEP.ENTRY && Math.abs(land.tilt) > bandFor(land.hard)) {
    faults.wear.hull = Math.min(1, faults.wear.hull + LAND.burnWear * dt);
    hitFlash = Math.max(hitFlash, 0.35);
  }
  // 이륙 분사 — 열이 오르고 **냉각이 안 먹는다** (방열판을 접었다)
  if (landBurn(land)) heat = Math.min(HEAT.max, heat + landHeat(land) * dt);

  // ══ ★★★ 조종석 전투 (v64) ═══════════════════════════════════
  //  ★ **겨눔은 기수가 한다.** 조종간을 밀어 기수를 돌리면 그게 조준이다 —
  //    실제 전투기의 기총이 기수 고정인 것과 같다. 겨눔을 따로 두면
  //    「배는 저쪽을 보는데 총은 이쪽」이 되고, 그건 계기가 둘인 것이다
  const nose = noseAim();
  aimAz = nose.az; aimEl = nose.el;

  // ── ★★ 떠도는 것들 · 적 우주선 ─────────────────────────
  setSkyRegion(sky, ship.outside.region);
  // ★★★ **부딪힌 것을 받아 온다** — 선체 안으로는 못 들어오고, 대신 흔들린다
  takeBumps(stepSky(sky, dt, { moving: route.phase === RPHASE.LEG && !landBusy(land) }) ?? []);

  // ── ★★ 레이더 · 락온 ────────────────────────────────
  //  ★ 레이더를 **새로 안 만든다** — 능동 탐지 차단기가 이미 그것이다.
  //    켜면 보이고, 켜면 보인다 (자국 20 · chase-table SIGN.sensor)
  combat.radar.on = power.sensor;
  const aimedNow = aimedAt(sky, aimAz, aimEl);
  // ★ 이름을 `rev` 로 썼다가 **같은 함수 안의 항로 `rev` 와 부딪혀 게임이
  //   통째로 안 떴다.** `node --check` 는 통과한다 — 한 함수가 워낙 길어
  //   눈으로도 안 보였다. 브라우저를 한 번 띄우자 첫 줄에 나왔다
  const radEv = stepRadar(combat, dt, aimedNow);
  if (radEv === 'lock') { banner = '묶었습니다'; bannerT = 1.6; audio?.event('latch'); }
  if (radEv === 'break') { banner = '놓쳤습니다'; bannerT = 1.6; }
  stepCool(combat, dt, { atSeat: helmSat });
  landShots(dt);

  // 조준경 — **앉아 있을 때만 켜진다.** 늘 켜 두면 「지금 겨누는 중인가」가 안 읽힌다
  ship.sight.redraw({
    on: helmSat, az: aimAz, el: aimEl, cool: combat.cool,
    list: skySummary(sky).list,
    // ★ v66 — 자국이 계기판에서 HUD 로 올라왔다. 계기판이 좁아지며
    //   화면 한 장이 밀려났고, 자국은 **모는 동안 보는 것**이라 여기가 맞다
    power, sign: chase.sign, contactAt: contactAt(route),
  });

  const dev = stepDrift(drift, dt, steering);
  // 잡고 있는 것에 값이 붙는다 — 냉각 밸브가 기관실이라 손이 못 간다
  heat = Math.min(HEAT.max, heat + driftHeat(drift, steering) * dt);
  if (dev === 'hit') {
    // 죽지 않는다. **대신 일이 는다** — 잔해에 부딪힌 것과 같은 규약
    faults.wear.hull = Math.min(1, faults.wear.hull + DRIFT.hit.hull);
    heat = Math.min(HEAT.max, heat + DRIFT.hit.heat);
    banner = '무언가에 스쳤습니다';
    bannerT = 2.4;
    hitFlash = 1;
    audio?.event('caught');
  }
  // ★ **밖을 굴린다.** 어느 방에 있든 보인다 — 고장 하나를 배 전체로 말한다
  // ★ 자세 제어(고장)와 조종(내가 튼 것)이 **같은 자리에 더해진다.**
  //   둘을 따로 굴리면 창밖이 두 겹으로 돌아서 어느 쪽이 내 탓인지 모른다
  ship.outside.roll(driftRad(drift) + helmRad(helm));
  // 자세 제어를 다 고쳤으면 살아난다
  if (drift.dead && drift.needsFix && !faults.open.some((o) => o.key === 'attitude')) {
    drift.needsFix = false;
    if (driftFixed(drift)) {
      banner = '자세가 잡혔습니다'; bannerT = 2.6; audio?.event('fixed');
      sceneDone(scenes, 'C');
    }
  }

  // 화면 한복판 글자 — 잠깐 떴다 사라진다
  // ★ 멈춤 화면이 떠 있으면 안 띄운다 — 안 그러면 매 프레임 다시 켜져서
  //   showPause() 가 접어 놓은 것이 되살아난다. 「접는 곳」과 「켜는 곳」이
  //   다르면 켜는 쪽이 이긴다
  if (bannerT > 0 && !paused) {
    bannerT -= dt;
    hud.textContent = banner;
    hud.hidden = false;
  } else hud.hidden = true;

  // ── 가르침 — **하면 사라진다** (docs/space/TUTORIAL.md) ──
  // ★ 배너와 **다른 자리·다른 색**이다. 배너(위·주황)는 *일어난 일*이고
  //   가르침(아래·청록)은 *아직 안 한 일*이다. 같이 두면 뭉개진다
  if (!allDone(tutor)) {
    if (stepTutor(tutor, dt, tutorState()) === 'show') audio?.event('click');
  }
  // ★ **손 쓰는 법은 일곱이 끝나도 산다** (game/tutor.js gripLine).
  //   동사는 계속 느는데 가르침은 일곱으로 못박혀 있다. 여덟째를 만들면
  //   또 설명서가 되므로, 겨누고 있는 그 순간에만 뜨는 한 줄로 뺐다.
  //   가르침이 있으면 그쪽이 먼저다 — 두 줄이 겹치면 둘 다 안 읽는다
  const ln = (allDone(tutor) ? null : lineOf(tutor, aimName))
    ?? gripLine(tutor, aimName, { armsFull: armsFullNow });
  if (ln && !paused) {
    lesson.textContent = ln.text;
    lesson.classList.toggle('dim', ln.dim);
    lesson.hidden = false;
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
      // ★ 밸브가 **이미 열려 있나.** 열어 놨는데도 「열을 내립니다」가
      //   계속 떠 있으면 사람은 「더 돌리라는 건가」로 읽고 계속 누른다
      coolOpen,
      heat,
      ore: supply.ore,
      // ★★ v62 — 추진제와 우주복. 둘 다 **못 하게 되는 일**이라
      //   손목이 알아야 한다 (없으면 「추진을 켭니다」가 거짓말이 된다)
      dry: isDry(supply.fuel),
      inVacuum: vacNow,
      suited: canEva(suit),
    }),
    // 고친 것 — **정비실까지 안 가도 보인다.** 이게 사장님이 말씀하신 것이다.
    // ★ 갯수는 `log.length` 가 아니라 `fixed` 다 — 기록은 여섯에서 잘리므로
    //   log 로 세면 일곱 번째부터 「고친 것 6」에 멈춰 선다
    log: faults.log.map((l) => l.reveal),
    fixed: faults.fixed,
    act: actNow(), trend,
    clock, raised,
  }, dt);

  // ── 손 — **조준선이 손잡이를 잡으면 뻗고, 누르면 쥔다** ──
  // ★ 이게 「직관적으로 조정하거나 수리」의 알맹이다 (사장님). 전에는
  //   밸브가 저 혼자 돌아갔다 — 무엇이 그걸 돌리는지 화면에 없었다.
  //   그리고 **굶으면 떨린다** — 체력바를 안 만드는 대신 손이 말한다
  //   (PLAN §5-2). 그 설계가 처음으로 화면에 나온 자리다
  hands.update({
    reach: aimName ? 1 : 0,
    grip: aimName && input.hold ? 1 : 0,
    both: bothHands(aimName),
    shaky: shaky(supply) || moveSummary(move).winded,
    // ★ 수리 중이면 **손이 네 동작을 따라간다** — 풀고·뽑고·꽂고·조인다
    //   (game/repair-table.js). 전에는 5초든 8초든 같은 주먹이었고,
    //   그래서 정비가 「기다리기」로 읽혔다
    pose: repairPose,
  }, dt);

  // ★★ **부하를 재는 자리** — `renderer.info` 는 그릴 때마다 스스로 0 으로
  //   되돌아가므로, 합성이 다 끝난 뒤에 읽으면 **마지막 전체화면 사각형
  //   하나**만 세어진다 (실제로 「그리기 1 · 삼각형 1」로 찍혔다).
  //   자동 되돌림을 끄고 **직접 되돌린 뒤** 한 프레임을 통째로 센다
  renderer.info.autoReset = false;
  renderer.info.reset();
  composer.render();
  lastCost = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ── 일시정지 (Esc) ─────────────────────────────────────────
// ★ 2시간짜리인데 멈출 수가 없으면 사람은 **브라우저를 닫는다.**
//   그리고 포인터 잠금이 풀리는 것과 게임이 멈추는 것은 **다른 일**이다 —
//   전에는 Esc 로 잠금만 풀리고 배는 계속 돌았다
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape') return;
  // ★ **끝난 배는 안 풀린다.** 게임 오버에서 Esc 로 빠져나가지면 그건 끝이 아니다
  if (wrecked) return;
  if (!paused) saveNow();         // 멈출 때 저장해 둔다. 닫고 가도 남는다
  showPause(!paused);
});
// 창을 벗어나면 **저절로 멈춘다.** 다른 창을 보다 돌아왔더니 잡혀 있으면
// 그건 게임이 아니라 사고다
addEventListener('blur', () => {
  if (paused || wrecked) return;
  saveNow();
  showPause(true);
});
// ★ **누르면 돌아온다.** Esc 를 누르면 브라우저가 포인터 잠금을 저절로
//   푸는데, 다시 잠그려면 어차피 화면을 눌러야 한다. 그러니 「잠겼다」를
//   그대로 「계속한다」로 읽는다 — 계속하는 법을 두 개 만들지 않는다.
//   (멈춤 화면에 `pointer-events: none` 이 붙어 있어야 이 클릭이 통과한다.
//    #hint 에서 그걸 빠뜨려 **게임을 아예 못 켰던** 적이 있다)
document.addEventListener('pointerlockchange', () => {
  if (wrecked) return;
  if (document.pointerLockElement && paused) showPause(false);
});
// ★ 그리고 **누른 것만으로도** 푼다. 잠금이 이미 걸린 채로 멈춘 경우
//   (창을 안 벗어나고 검사가 멈춘 경우 등) 위의 것은 안 불린다 —
//   그러면 눌러도 아무 일이 안 나고, 그게 「멈추면 못 돌아온다」다.
//   계속하는 길은 **막히지 않게** 두 갈래로 둔다
// ★ `data-ui` 를 뺀 이유는 input.js 와 같다 — 멈춤 화면의 「처음부터 다시」를
//   누른 것이 「계속한다」로도 읽히면, 물음이 뜨기 전에 게임이 먼저 돌아간다
addEventListener('mousedown', (e) => {
  if (e.target?.closest?.('[data-ui]')) return;
  if (paused && !wrecked && !check.open) showPause(false);
});

// ★ **지금 무엇이 떠 있나.** 「고쳤다는데 그대로다」가 났을 때, 브라우저가
//   옛 파일을 들고 있는 것인지 코드가 틀린 것인지 **화면만 보고 가릅니다.**
//   한 글자면 끝나는 일을 추측으로 파느라 세 번을 태웠습니다
document.getElementById('ver').textContent = `v${VERSION}`;

// 잠금 안내는 처음 한 번만. 잠기면 사라진다.
// ★ 멈춰 있을 때는 안 띄운다 — 안내창과 멈춤 화면이 **같은 자리**라 겹친다
setInterval(() => { hint.hidden = input.locked || paused; }, 200);

// ── 단추 넷 ─────────────────────────────────────────────────
// ★ 시작 화면과 멈춤 화면에 **같은 두 개**를 놓는다 (2026-08-06).
//   지금까지 둘 다 **키만** 있었고, 그래서 둘 다 못 쓰는 사람이 생겼다:
//     · F2 는 노트북에서 Fn 을 같이 눌러야 하는 하드웨어 키인 경우가 많다
//     · 「처음부터」는 아예 길이 없어서 켤 때마다 말없이 이어졌다
//   Esc 는 어느 자판에서나 먹으므로, **멈춤 화면 쪽이 막히지 않는 길**이다.
{
  const ask = () =>
    !canSave() || !hasSave()
      // 이어할 것이 없으면 물을 것도 없다 — 물음이 습관이 되면 안 읽는다
      ? true
      : confirm('지금까지 온 것이 지워집니다. 처음부터 다시 시작할까요?');
  const wire = (id, run) => document.getElementById(id)?.addEventListener('click', (e) => {
    e.stopPropagation();
    run();
  });
  // ★ 끝 화면의 것은 **안 물어본다.** 저장은 이미 지워졌고, 물어볼 것이
  //   남아 있지 않다 — 「처음부터 다시는 없다」(§9)
  for (const id of ['btn-new', 'btn-new2']) wire(id, () => { if (ask()) SPACE.newGame(); });
  wire('btn-new3', () => SPACE.newGame());
  // 멈춤 화면에서 열면 **멈춘 채로** 연다 — 점검하다 배가 저 혼자 가면 곤란하다
  for (const id of ['btn-check', 'btn-check2']) wire(id, () => check.toggle(true));
}

console.log(`스페이스워 v${VERSION} — ${roomAt(me.x, me.z)} 에서 시작`);
