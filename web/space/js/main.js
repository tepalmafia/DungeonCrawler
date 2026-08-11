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
// ★★★ v85 — **사장님이 주신 3D 그림.** 없으면 코드 도형 그대로 (`core/models.js`)
import { loadModels, modelLog } from './core/models.js';
import { Input } from './core/input.js';
import { makeAudio } from './core/audio.js';
import { ESCAPE, SHAKE, envelope, SILENT } from './game/audio-table.js';
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
import { FOOD, WINCH, TRADE, ORE, PARTS, MISSILES } from './game/supply-table.js';
import { HAZARD } from './game/hazard-table.js';
import {
  makeHazard, stepHazard, steerShip, newLeg, incoming, warnLeft, clearOf, HPHASE,
} from './game/hazard.js';
import {
  makeSupply, stepSupply, winchStep, canTrade, trade, canRepair, spendParts,
  canBuyMissiles, buyMissiles, salvageMissiles,
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
import { HELM, HELM_SEAT, FLY_VIEW, STICK, deflect, YOKE, SIT_LOOK, offWord, hitWord } from './game/helm-table.js';
import { GUN, SEAT as GUN_SEAT, WHY as GUN_WHY } from './game/gun-table.js';
// ★★★ v64 — 조종석 전투 (레이더 · 락온 · 미사일)
import { RADAR, WEAPONS, WEAPON_LIST, WHY as CBT_WHY, lockWord, PICK } from './game/combat-table.js';
// ★★★ 탄두 (v71) — 기관실 후미 크레이들. `docs/space/WAR.md §3`
import { PARTS5, BY_KEY as HEAD_BY, CRADLE, BAKE, partAtLeg, endingOf } from './game/warhead-table.js';
import {
  makeWarhead, pickUp as headPick, holdCradle, stepWarhead, holdArm, drop as headDrop,
  full as headFull, summary as headSummary,
} from './game/warhead.js';
import { speedOf as statusSpeed } from './world/status.js';
// ★★★ 급가속 (v73) — **따로 하는 조작.** Shift 는 기수를 돌리고, R 은 튀어나간다
import { BOOST, RUSH, KICK } from './game/boost-table.js';
// ★ v91 — HUD 판의 크기·거리와 **그림이 쓰는 각**. 둘이 갈라지면 표식이 어긋난다
import { HUD as HUDV, hudFov } from './game/view-table.js';
import {
  makeBoost, stepBoost, boostMult, boostSign, boosting, summary as boostSummary,
} from './game/boost.js';
// ★★ v69 — 맞은 자리를 **각도·거리에서 3D 좌표로** 옮긴다. `world/shots.js`
//   와 **같은 식**을 쓴다 — 두 벌로 옮기면 터짐이 표적에서 어긋난다.
//   ★ 이 줄이 한 번 사라져 있었고, `node --check` 는 통과했다.
//     브라우저를 띄우자 첫 발에 `shotAt is not defined` 로 나왔다 —
//     즉 **맞아도 아무것도 안 터지는 상태**였다 (CLAUDE.md 「화면에 보이는
//     것은 화면으로 확인한다」가 정확히 이걸 말한다)
import { atOf as shotAt } from './world/shots.js';
import {
  makeCombat, weaponOf, isLocked, stepRadar, stepShots, stepCool,
  pickTarget, picked, dropPick,
  pickSlot, fire as fireWeapon, forgetLock, radarBlips, summary as cbtSummary,
} from './game/combat.js';
import { HULL, HITS } from './game/target-table.js';
// ══ ★★★ **전투력 · 광학 창** (v79) ═════════════════════════════════════
//  사장님 「나보다 강한 상대나 많은 적들은 **피하거나 도망**가고 …
//          흩어진 적이나 **전투력이 낮은 적은 파괴**하면서 진행」
//          「**상대 우주선의 전투력**도 표시되고 **우리 비행기의 전투력 차이**」
//          「격추할때마다 **적의 무기나 장갑을 회수**하면서 나도 전투력이 올라가게」
import { mightOf, lootOf, myMight, oddsOf } from './game/might-table.js';
import { autoZoom, OPTIC } from './game/optic-table.js';
// ══ ★★★ **회수** (v81) — 사장님 「파괴하고 **적의 지원이 오기전에** …
//   회수하고」 · 「조종석에서 **그물**이나 기타 회수 장비를 쏘아 회수」
import { NET, PACK, CALL, packWord, callIn, WAYS, timeOf } from './game/salvage-table.js';
// ══ ★★★ **화물 · 아이템 열여섯** (v83 · docs/space/ITEMS.md) ═══════════
import { HOLD, holdWord, nameOf as itemName } from './game/cargo-table.js';
// ══ ★★★ v99 — **아크 도약** (`docs/space/ARC.md` · `tools/space-arc.js`) ══
//  ★ 사장님 「미구현 구현해」. 표에만 있고 게임에 없던 마지막 하나다 —
//    그런데 견줌은 「절망」일 때 「아크를 채우고 빠진다」고 **말하고**
//    있었다. 없는 것을 하라고 말하는 계기를 없앤다
import { PHASE as APHASE, ARC, WHY as ARC_WHY, SAY as ARC_SAY, whyNotJump } from './game/arc-table.js';
import {
  makeArc, beginCharge, stopCharge, stepArc as stepArcS, heatOf as arcHeat,
  burstHeat as arcBurst, chargeK, charging, jumping, summary as arcSummary,
} from './game/arc.js';
import {
  makeCargo, put as cargoPut, useOf, stepCargo, word as cargoWord, take as cargoTake,
  summary as cargoSummary, used as cargoUsed, left as cargoLeft,
} from './game/cargo.js';
import {
  makeSalvage, dropPack, stepSalvage, fireNet, thrustHeld, callWarn,
  summary as salvSummary, WHY as SALV_WHY,
} from './game/salvage.js';
import { spawnRaider, threatNow, aimingSoon, azDiff, hitPart, behindOf } from './game/target.js';
// ★★★ v84 — **등대.** 말하는 구멍을 하나로 모은다
import { LINES as AI_LINES, sideWord, VOICE } from './game/ai-table.js';
import { makeAI, say, hush, stepAI, nowSaying, summary as aiSummary } from './game/ai.js';
// ★★★ v84 — **느려지는 시간** (발사 사출 · 회피). 배율은 한 곳에서만 정한다
import { SLOW, slowsOnLaunch } from './game/slow-table.js';
import {
  makeSlow, askSlow, dropSlow, stepSlow, slowNow, summary as slowSummary,
} from './game/slow.js';
// ★★ v60 — 세 축 + 짐벌 (사장님 「360도 회전 · 위아래 · 실제 우주선 개념」)
import { AXES, attitudeWord, rollDeg, RCS } from './game/flight-table.js';
import { makeFlight, stepFlight, offCourse, gimbalBusy, summary as flySummary }
  from './game/flight.js';
import { VOID, isVoid } from './game/void-table.js';
// ★★★ v93 — **떨군다.** 목적 한 줄의 세 번째가 여기 있다 (`WAR.md §6`)
import { PHASE as DPHASE, DROP, SAY as DSAY } from './game/drop-table.js';
import {
  makeDrop, stepDrop, pull as dropPull, canDrop, windowLeft, blastIn,
  summary as dropSummary,
} from './game/drop.js';
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
import { KINDS as TKINDS, TARGET, ENEMY_FIRE, DODGE, evadeWord } from './game/target-table.js';
import {
  makeSky, setRegion as setSkyRegion, setNose, stepSky, shootSky, aimedAt, tolOf, inRange, spawnFoe,
  summary as skySummary,
} from './game/target.js';
// ★★★ v98 — **자리를 아는 곳 하나** (블록아웃). `SPACE.align()` 이 이것과
//   진짜 카메라를 나란히 놓아 「창밖 == 계기」를 숫자로 만든다
import { relOf } from './game/frame.js';
// ══ ★★★ v100 — **발사관** (`docs` 없음 · `tools/space-mount.js` 가 뼈대) ══
//  ★ 사장님 「적을 계속 타겟팅 하면서 회피 기동이 가능하도록 …
//    동체는 회전해도 타겟팅이 불안정해지지만 **방향은 유지**하는걸로?」
import { MOUNT, isGimbaled, mountWord, spreadOf } from './game/mount-table.js';
import {
  makeMount, stepMount, errOf as mountErr, offOf as mountOff,
  summary as mountSummary,
} from './game/mount.js';
import { LOCK, WHY as LOCK_WHY, airWord } from './game/airlock-table.js';
import {
  makeLock, cycle as cycleLock, stepLock, canHaul, haulWhy,
  innerLocked, signOf as lockSign, heatOut as lockHeatOut, summary as lockSummary,
  isVacuum as lockVacuum, bareLeft,
} from './game/airlock.js';
// ★★ 우주복 — **진공에 사람이 그냥 서 있었다** (v62 · REAL.md §2-C)
import { SUIT, suitWord } from './game/suit-table.js';
import {
  makeSuit, stepWear, stepSuit, canEva, refill as refillSuit,
  handMult as suitHand, moveMult as suitMove, summary as suitSummary,
} from './game/suit.js';
// ★★ 추진제 — **10분 시계를 맞는 물건으로 옮겼다** (v62 · REAL.md §2-D)
import { FUEL, fuelWord, isDry, legsLeftOnFuel } from './game/fuel-table.js';
import { STEP as LSTEP, LAND, WHY as LAND_WHY, STEP_WORD, tiltWord, bandFor }
  from './game/land-table.js';
// ★★ 승부수 — **쫓길 때의 결심 넷** (v68 · docs/space/GAMBIT.md).
//   `mission-table.js` 에 적혀만 있던 넷이다 — 고장이 아니라 **결심**이라
//   `steps` 를 적을 수 없었고, 그래서 몇 판을 조용히 걸러져 왔다
import { makeGambit, stepGambit, holdGambit, chaseOver, holdAt, summary as gbSummary } from './game/gambit.js';
import { GAMBIT, GAMBITS, gambitWord } from './game/gambit-table.js';
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

export const VERSION = 100;

const canvas = document.getElementById('view');
const cross = document.getElementById('cross');
const hint = document.getElementById('hint');
const hud = document.getElementById('hud');
/** ★★★ v84 — 슬로우일 때 가장자리가 물든다. **가운데는 비운다** */
const slowFx = document.getElementById('slow');
/** ★★★ v84 — 회피 지시 — **빼야 할 쪽에** 뜬다 */
const evBox = document.getElementById('evade');
const evTip = evBox?.querySelector('.tip');
const evSay = evBox?.querySelector('.say');
const evBar = evBox?.querySelector('.bar u');
/** ★★★ v85 — 지정한 표적이 어디 있나 */
const pkBox = document.getElementById('pick');
const pkTip = pkBox?.querySelector('.box');
const pkTag = pkBox?.querySelector('.tag');
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
// ★★★ v85 — **3D 그림을 먼저 불러온다.** 배를 세우기 전에 와야 표적이
//   그림으로 선다. 하나도 없으면 아무 일도 안 일어난다 (그게 기본 상태다)
await loadModels();

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

const ship = buildShip(scene, camera, renderer);
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
/**
 * ★★ v74 — **게임이 정말 그 소리를 부르나**를 엿듣는다 (`SPACE.audioSpy`).
 *
 *   소리를 만들어 놓고 **아무도 안 부르는** 것이 이 저장소가 제일 자주 밟는
 *   함정이다 — 안 나도 화면에 아무 표시가 없어서 조용히 지나간다.
 *   그래서 「소리가 나나」(파형)와 「게임이 부르나」(여기)를 **따로** 묻는다.
 */
let audioSeen = null;
if (audio) {
  const raw = audio.event;
  audio.event = (name, at) => { if (audioSeen) audioSeen.push(name); return raw(name, at); };
}
addEventListener('mousedown', () => audio?.resume(), { passive: true });
// ★ 손목을 들어 올린다 — **누르는 동안**. 다른 손잡이가 전부 「잡고 있는 것」
//   이라 여기도 같은 규약이다. 놓으면 곁눈 자리로 돌아간다
// ══ ★★★ **Z — 광학 창을 화면 가득** (v79 · 조준 포드) ═════════════════
//  사장님이 주신 참고 화면이 **조준 포드 영상이 화면을 채운 그림**이었다.
//  ★ 앉아 있을 때만 먹는다. 걸어다니면서 켜지면 앞이 안 보인 채 걷는다
//  ★★ 그리고 이건 **공짜가 아니다** — 켜 놓는 동안 창밖을 안 본다.
//    「늘 켜는 게 답이면 선택이 아니다」의 답이 여기서는 이것이다
// ══ ★★★ **F1 도움말** (v82) ══════════════════════════════════════════
//  ★ 사장님 「**도움말을 f1에 만들어줘**」 · 「**전투 도움말을 따로**」
//  ★★ 두 쪽으로 가른다 — 조작과 전투를 한 장에 쌓으면 스무 줄이 되고,
//    스무 줄은 안 읽힌다. **지금 막힌 쪽만** 펴 보면 된다.
//  ★★★ 열면 **게임이 멈춘다.** 읽는 동안 얻어맞으면 그건 도움말이 아니다
const helpBox = document.getElementById('help');
let helpOpen = false;
function showHelp(on, page = null) {
  helpOpen = !!on;
  if (helpBox) helpBox.hidden = !helpOpen;
  if (page) helpPage(page);
  // ★★ **시계를 멈춘다.** 읽는 동안 얻어맞으면 그건 도움말이 아니라 함정이다.
  //   멈춤 화면(`showPause`)은 **안 띄운다** — 화면 둘이 겹치면 둘 다 안 읽힌다
  paused = helpOpen;
  if (helpOpen) document.exitPointerLock?.();
}
function helpPage(which) {
  const on = which === 'fight';
  document.getElementById('help-basic')?.toggleAttribute('hidden', on);
  document.getElementById('help-fight')?.toggleAttribute('hidden', !on);
  document.getElementById('tab-basic')?.classList.toggle('on', !on);
  document.getElementById('tab-fight')?.classList.toggle('on', on);
}
document.getElementById('tab-basic')?.addEventListener('click', () => helpPage('basic'));
document.getElementById('tab-fight')?.addEventListener('click', () => helpPage('fight'));
helpBox?.addEventListener('click', (e) => { if (e.target === helpBox) showHelp(false); });
addEventListener('keydown', (e) => {
  // ★ F1 은 브라우저 도움말이라 **막아야** 한다 — 안 막으면 우리 것이
  //   뜨는 동시에 브라우저 창이 열린다
  // ══ ★★★ v85 — **표적 지정** (사장님 「목표물을 타겟할 수가 없잔아!」) ══
  //  ★ 이 장르의 정석 그대로다: **T 제일 가까운 적 · Tab 다음 것.**
  //    (Elite · Star Citizen · Freelancer 가 다 T 다)
  //  ★★ 지정은 **락온이 아니다** — 찾아 줄 뿐이고, 묶는 것은 여전히
  //    조준선에 2.6초 올려 두는 손의 일이다 (`combat.js pickTarget` 주석)
  if (!helpOpen && !paused && (e.code === 'KeyT' || e.code === 'Tab')) {
    e.preventDefault();
    const a = noseAim();
    const t = pickTarget(combat, sky.list, a.az, a.el, e.code === 'Tab');
    say(ai, t ? `표적 — ${TKINDS[t.kind]?.name ?? ''} ${Math.round(t.dist)}m` : '겨눌 적이 없습니다', 'tell');
    audio?.event(t ? 'click' : 'deny');
    return;
  }
  // ══ ★★★ v85 — **X 로 나온다** (사장님 「쏘기가 … 조정간에서 나오는거랑
  //  키가 중복이야. **다른 키를 눌러서** 조정석에서 나오도록」) ══════════
  //  ★ 한 키로 **두 단계**를 나온다: 잡고 있으면 놓고, 놓았으면 일어난다.
  //    키를 둘로 두면 「어느 걸 눌러야 나가지」가 또 생긴다
  // ══ ★★★ v93 — **B 로 떨군다** ═══════════════════════════════════════
  //  ★ 창이 열려 있고 **무장했을 때만** 먹는다. 아무 때나 먹으면
  //    「기관실까지 언제 갔다 오나」가 결심이 아니게 된다.
  //  ★★ 안 먹을 때 **왜 안 되는지 말한다** — 조용히 안 되는 것이
  //    이 저장소가 네 번 밟은 함정이다 (「고장」으로 읽힌다)
  //  ★ **B 가 아니라 V 다.** 표(`drop-table.js SAY`)에 「B」라고 적어 놓고
  //    붙이려다 잡았다 — B 는 이미 **로봇 회수**(`cargo-table.js WAYS.bot`)다.
  //    두 벌 다 돌아서 「떨구려다 로봇을 쏘는」 상태가 될 뻔했다.
  //    ★★ 이 저장소가 v79→v85 에 좌클릭으로 똑같이 겪었다: **두 판이
  //      각자 맞았고 겹치는 것을 아무도 안 봤다.** 키를 새로 붙일 때는
  //      `grep -oE "'Key[A-Z]'"` 로 **쓰이는 것을 먼저 센다**
  // ══ ★★★ v99 — **J · 아크 도약** ═════════════════════════════════════
  //
  //  ★ 키를 붙이기 전에 **먼저 셌다** (v93 에 B 로 부딪히고 적어 둔 규약).
  //    쓰이는 것이 A C D E M Q R S T V W X Z · B F G · Shift Space Tab 이라
  //    J 가 비어 있었다. 마침 **이 장르의 도약 키**다 (Elite 의 프레임 시프트).
  //
  //  ★★ **누르면 재기 시작 · 다시 누르면 내린다.** 누르고 있는 것이
  //    아니다 — 26초를 누르고 있으라고 하면 그 동안 조종을 못 한다.
  //    「재면서 버틴다」가 이 계통의 전부인데 그걸 없애는 셈이 된다
  if (!helpOpen && !paused && e.code === 'KeyJ') {
    e.preventDefault();
    if (charging(arcS)) { stopCharge(arcS); say(ai, ARC_SAY.stop, 'tell'); return; }
    const have = cargo.items.arc ?? 0;
    const r = beginCharge(arcS, {
      cells: have, sinkAt: sinkAt({ sink }), power: !!power.thrust,
      landed: land.step !== LSTEP.NONE,
    });
    if (!r.ok) { say(ai, ARC_WHY[r.why], 'warn'); return; }
    // ★★ **전지는 지금 태운다.** 다 재고 나서 태우면 중간에 그만뒀을 때
    //   공짜가 되고, 그러면 「일단 걸어 두기」가 늘 정답이 된다
    cargoTake(cargo, 'arc', ARC.cells);
    say(ai, ARC_SAY.charge, 'alarm');
    audio?.event('tube');
    return;
  }
  if (!helpOpen && !paused && e.code === 'KeyV') {
    e.preventDefault();
    if (dropS.phase === DPHASE.WINDOW && !warhead.armed) say(ai, DSAY.armFirst, 'warn');
    else if (dropS.phase !== DPHASE.WINDOW) say(ai, '지금은 투하 창이 아닙니다', 'tell');
    else if (dropPull(dropS, { armed: warhead.armed, filled: warhead.in.length })) {
      headDrop(warhead);
      // ★★★ **창밖으로 떨어지는 것이 보인다** (WAR.md §6-3).
      //   새 계통을 안 만든다 — 이미 있는 발사체 계통으로 쏜다.
      //   「보이는 것을 안 만들어서」 v64 가 통째로 숫자 게임이 됐던
      //   자리라, 여기만은 반드시 화면에 나와야 한다
      ship.outside.shots.fire('arh', null);
      say(ai, DSAY.dropped, 'alarm');
      audio?.event('tube');
    }
    return;
  }
  if (!helpOpen && !paused && e.code === 'KeyX') {
    e.preventDefault();
    // ★★ v88 — **한 번에 나온다.** v85 는 「놓기 → 일어나기」 두 단계였는데,
    //   v88 에서 앉는 것과 잡는 것이 한 상태가 됐으므로 나오는 것도 하나다.
    //   두 단계로 두면 「놓았는데 안 나가진다」가 생긴다 — 없앤 상태를
    //   나가는 길에서만 되살리는 꼴이다
    if (helmSat) { yokeHeld = false; helmSat = false; say(ai, '조종석에서 일어납니다', 'tell'); }
    return;
  }
  if (e.code === 'F1') { e.preventDefault(); showHelp(!helpOpen); return; }
  if (e.code === 'Escape' && helpOpen) { e.preventDefault(); showHelp(false); }
});

let opticBig = false;
// ══ ★★★ **G — 그물** (v81 · 사장님 「조종석에서 그물이나 기타 회수
//   장비를 쏘아 회수」) ══════════════════════════════════════════════
//  ★ 왜 못 쏘는지도 말한다 — 조용히 안 나가면 「고장」으로 읽힌다 (v64 규약)
// ══ ★★★ **회수 셋 — F 도킹 팔 · G 그물 · T 로봇** (v83) ═══════════════
//  사장님 「회수를 누르면 **도킹을 하던지 로봇을 보내던지**」.
//  ★ 그물 하나만 있으면 「주우려면 도망 못 친다」가 늘 같은 무게라
//    결심이 하나뿐이다. 셋이면 **거리 · 빠르기 · 묶임**을 저울질하게 된다:
//      팔  25m · 1.2초 · 묶인다   — 바짝 붙어야 한다 (들이받힐 자리)
//      그물 80m · 거리비례 · 묶인다
//      로봇 160m · 12초 · **안 묶인다** — 대신 느리다
//  ★ 왜 못 쓰는지도 말한다 (v64 규약)
for (const w of Object.values(WAYS)) {
  addEventListener('keydown', (e) => {
    if (e.code !== w.kb || e.metaKey || e.ctrlKey || e.altKey) return;
    const a = noseAim();
    const r = fireNet(salvage, { az: a.az, el: a.el, seated: helmSat, way: w.key });
    if (!r.ok) {
      say(ai, r.why === 'far'
        ? `${w.name} — ${w.reach}m 안이어야 합니다 (다가가십시오)`
        : (SALV_WHY[r.why] ?? '지금은 못 씁니다'), 'tell');
      return;
    }
    chase.sign = Math.min(100, chase.sign + w.sign);   // 사출은 숨길 수 없다 (v44)
    const sec = timeOf(w.key, r.pack.dist);
    say(ai, `${w.name} — ${TKINDS[r.pack.kind]?.name ?? ''} 잔해 · ${sec}초`
      + (w.holds ? ' (감는 동안 못 나아갑니다)' : ' (묶이지 않습니다)'), 'tell');
    audio?.event('tube');
  });
}
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyZ' || e.metaKey || e.ctrlKey || e.altKey) return;
  if (!helmSat) { say(ai, '조종석에 앉아야 광학 창을 엽니다', 'tell'); return; }
  opticBig = !opticBig;
  say(ai, opticBig ? '광학 창 — 화면 가득 (Z 로 닫습니다)' : '광학 창을 닫습니다', 'tell');
});
addEventListener('keydown', (e) => { if (e.code === 'KeyQ') raised = true; });
addEventListener('keyup', (e) => { if (e.code === 'KeyQ') raised = false; });
addEventListener('blur', () => { raised = false; });

addEventListener('keydown', (e) => {
  // M — 음소거. 소리가 있는 게임에 끄는 방법이 없으면 그건 결함이다
  if (e.code !== 'KeyM' || e.metaKey || e.ctrlKey || e.altKey || !audio) return;
  audio.setMuted(!audio.muted);
  say(ai, audio.muted ? '소리 꺼짐 (M)' : '소리 켜짐 (M)', 'tell');
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
// 거리·자국·항로·마모는 여전히 방이 갖는다 (world/holo.js 머리말 참고)
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
/** ★ v75 — 이번 프레임에 레이더가 본 것. 계기와 점검 구멍이 **같은 값**을 읽는다 */
let radarSeen = [];
/**
 * ★★★ **탄두** (v71) — 이 게임의 목적이 여기 있다.
 *   기관실 후미 격벽의 크레이들. 재료 다섯을 손으로 들고 가 꽂는다
 */
const warhead = makeWarhead();
/** ★★★ v93 — 투하 장면 (마지막 구간) */
const dropS = makeDrop();
/** ★★★ v99 — 아크 도약. 전지는 화물칸에서 태우고, 열은 저장고로 간다 */
const arcS = makeArc();
/**
 * ★★★ v100 — **발사관.** 동체와 따로 돌아 표적을 따라간다.
 *   레이저는 기수 고정이고 유도탄·열추적만 여기에 실린다 (`GIMBALED`)
 */
const mount = makeMount();
/** 지난 프레임의 기수 — 동체가 초당 몇 도 도는지를 여기서 잰다 */
let noseWas = { az: 0, el: 0 };
/** 동체가 지금 도는 속도 (도/초) — 흔들림이 이것에 비례한다 */
let hullSpin = 0;
/** ★★★ 급가속 (v73) — R 을 누르고 있으면 튀어나간다 */
const boost = makeBoost();
/**
 * ★★ 탐색기 소리의 세기 — 0 없음 · 0.5 잡았다 · 1 물었다 (v69).
 *   전투 셈은 프레임 뒷쪽에서 돌고 소리는 앞쪽에서 갱신되므로 여기 둔다.
 *   한 프레임 늦는데, 60분의 1초라 귀로는 못 듣는다
 */
let radarSeek = 0;
/** ★ G 구조 신호 — 2시간에 한 번뿐인 남의 목소리 (7판) */
const rescue = makeRescue();
/** ★ E 정전 — 어두우면 소리밖에 없다 (7판) */
const dark = makeDark();
// ★★ **포탑이 겨누는 쪽** — 방위·고도(도). WASD 가 여기를 움직인다.
//   사람이 보는 쪽과 **따로** 논다 — 그게 「실내에서 원격으로 돌린다」다
let aimAz = 0, aimEl = 0;
/** ★ v100 — W/S 가 눌린 채인가 (한 번 누를 때 한 번만 먹게) */
let fwdHeld = false;
/**
 * ★★★ v98 — **기수가 머리 위를 넘어갔나** (`aimOf`). 넘어가면 배가
 *   뒤집힌 것이라 **표식도 반 바퀴 돌아야** 실물에 얹힌다
 */
let noseOver = false;
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
  say(ai, SCARS[key].lead, 'tell');
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
  // ★★ v69 — 방위는 **감는다.** 좌우 한계를 없앴으므로 `fly3.yaw` 가
  //   끝없이 커진다. 예전처럼 ±62 로 자르면 두 바퀴째부터 기수가 62도에
  //   붙어 버려서 **돌수록 조준이 안 따라온다** — 자르는 것과 감는 것은
  //   한계가 있을 때만 같은 말이다
  // ══ ★★★ v85 — **위아래도 감는다** (사장님 「왜 상하로 조정이 안되냐고!!」
  //  「목표물을 타겟할 수가 없잔아!」) ═══════════════════════════════════
  //
  //  ★ 여기 `clampA(fly3.pitch * DEG, TARGET.elLimit)` 이 있었다 —
  //    **조준 고도를 ±34도에서 잘랐다.** 그런데 v73 에 기수의 위아래
  //    한계(`AXES.pitch.max`)는 **없앴다.** 즉:
  //
  //      기수는 계속 돈다 → 창밖도 계속 돈다 → **조준만 34도에서 멎는다**
  //
  //    그래서 34도를 넘기면 **조준선과 실제 겨눈 곳이 갈라지고**, 표적을
  //    한복판에 올려도 안 잡힌다. 「상하 조정이 안 된다」와 「타겟할 수가
  //    없다」가 **한 줄에서 나온 같은 병**이다.
  //
  //  ★★ v69 에 좌우에서 **똑같은 일**을 했었다 (「자르는 것과 감는 것은
  //    한계가 있을 때만 같은 말이다」). 위아래만 못 고쳤다 — 한계를
  //    없애면서 딸린 값을 안 고치는, 이 저장소가 제일 자주 밟는 함정이다.
  //
  //  ★★★ 그냥 자르기를 빼면 안 된다. 고도가 90도를 넘으면 **뒤로 넘어간
  //    것**이라 방위가 180도 돌아간다 — 구면 좌표의 규칙이고, 안 지키면
  //    머리 위를 넘기는 순간 좌우가 뒤집힌다
  return aimOf(fly3.pitch * DEG, fly3.yaw * DEG);
}

/**
 * ★★★ **기수의 각도를 조준의 방위·고도로** (v85).
 *
 *   피치가 ±90 도를 넘으면 **뒤로 넘어간 것**이다: 고도는 되꺾이고
 *   방위는 반 바퀴 돈다. 그래야 머리 위를 넘겨도 좌우가 안 뒤집힌다
 */
function aimOf(pitchDeg, yawDeg) {
  const wrap = (d) => ((d + 180) % 360 + 360) % 360 - 180;
  let el = wrap(pitchDeg);
  let az = yawDeg;
  let over = false;
  if (el > 90) { el = 180 - el; az += 180; over = true; }
  else if (el < -90) { el = -180 - el; az += 180; over = true; }
  // ══ ★★★ v98 — **넘어간 것을 화면에도 말해야 한다** ═══════════════════
  //
  //  ★ 여기서 방위를 180도 돌리고 고도를 되꺾는 것은 **배가 뒤집혔다**는
  //    뜻이다. 그런데 v97 까지 그 사실이 **여기서 끝났다** — HUD 는 롤을
  //    `skyRoll`(자세 제어가 낸 기울기)에서만 받으므로, 머리 위를 넘긴
  //    순간 **표식이 통째로 180도 헛돌았다.**
  //
  //  ★★ `SPACE.align()` 으로 잡았다: 다섯 자세 중 넷은 「HUD 롤 == 필요한
  //    롤」이 소수점까지 같은데, 넘어간 한 자세만 **−6.9도 vs 173.1도**
  //    였다 (정확히 180 차이). 「가끔 위치가 완전 다르다」의 마지막 조각이다.
  //
  //  ★ 벗어난 각(`off`)은 롤과 상관이 없어서 **조준·락온은 멀쩡했다.**
  //    그래서 여태 「맞기는 맞는데 상자가 엉뚱한 데 있다」로만 보였다
  return { az: wrap(az), el, over };
}

/**
 * ★ 지금 도약이 왜 안 되나 — 계기와 검사가 **같은 것**을 읽는다.
 *   화면에서 따로 판정하면 「단추는 빨간데 눌러 보면 되는」 상태가 난다
 */
function whyNotJumpNow() {
  return whyNotJump({
    cells: cargo.items.arc ?? 0,
    sinkAt: sinkAt({ sink }),
    power: !!power.thrust,
    cool: arcS.cool,
    phase: arcS.phase,
    landed: land.step !== LSTEP.NONE,
  });
}

/** 한 발 쏜다 — **왜 못 쏘는지도 말한다.** 조용히 안 나가면 「고장」으로 읽힌다 */
function fireGun() {
  const a = noseAim();
  const aimed = aimedAt(sky, a.az, a.el);
  // ★ v100 — **발사관이 잰 오차**를 같이 넘긴다 (짐벌 무기만 쓴다)
  const r = fireWeapon(combat, {
    aimed, supply, rnd: Math.random,
    mount: mountSummary(mount, aimed ? { az: aimed.relAz, el: aimed.relEl } : null),
  });
  if (!r.ok) { say(ai, CBT_WHY[r.why] ?? '지금은 못 쏩니다', 'tell'); return; }
  const w = r.weapon;
  // ══ ★★★ **쏘는 소리** (v74 · 진공 규칙) ═══════════════════════════
  //  v73 까지 레이저가 `caught`(잡혔다)를, 미사일이 `latch`(걸렸다)를
  //  빌려 쓰고 있었다. 즉 **「내가 쐈다」와 「내가 맞았다」가 같은 소리**였고,
  //  소리로 상황을 알라고 만든 계통에서 그건 제일 나쁜 겹침이다.
  //  ★ 밖은 조용해도 **내 무기는 들린다** — 선체에 붙어 있으니까
  audio?.event(w.key === 'laser' ? 'laser' : 'tube');
  // ★★★ v69 — **레이저는 열을 판다** (`combat-table.js WEAPONS.laser.heat`).
  //   탄약이 없는 대신 이쪽이 값이다: 쏠수록 뜨거워지고, 뜨거우면 못 숨고,
  //   식히려고 라디에이터를 열면 더 훤히 보인다 (v58 열 저장고와 물린다).
  //   미사일은 열을 덜 낸다 — 대신 재고가 준다
  heat = Math.min(HEAT.max, heat + (w.heat ?? GUN.heatPerShot * 2));
  // ★ **쏘면 밝아진다** — 총구 섬광과 사출은 숨길 수 없다 (v44 규약)
  gun.flash = Math.max(gun.flash ?? 0, w.signFor);
  say(ai, `${w.name} 발사`, 'tell');
  // ★★★ **v69 — 쏘는 것이 보인다.** v68 까지 여기서 숫자만 줬다 (열이
  //   오르고 광석이 줄고 hp 가 빠졌다). 화면에서는 아무 일도 안 났고,
  //   격추 게임에서 그건 **쏘는 맛이 아예 없는 것**이다
  ship.outside.shots.fire(w.key, aimed ? aimed.t : null);
  // ══ ★★★ v84 — **사출되는 동안 시간이 느려진다** ═══════════════════
  //  ★ 사장님 「순간적으로 슬로우 모션으로 발사되어 **점점 가속화**」.
  //  ★★ 슬로우 길이가 **사출 구간과 같다** (`SLOW.launch.sec` =
  //    `LAUNCH.ejectSec`). 그래서 **시간이 돌아오는 순간 불이 붙는다** —
  //    둘이 한 동작으로 읽히는 것이 이 계통의 요점이다.
  //  ★ 레이저는 안 건다 — 즉발인 것을 느리게 날리면 v57 의 고증이
  //    거짓말이 된다. 레이저의 몫은 총구 섬광이다 (`world/shots.js`)
  if (slowsOnLaunch(w.key)) askSlow(slowmo, 'launch');
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
      say(ai, d.shot.lost ? '유도가 끊겼습니다' : '빗나갔습니다', 'tell');
      continue;
    }
    // ══ ★★★ v86 — **어디를 맞혔나** (`target-table.js PARTS`) ═════════
    //  ★ 사장님 「**각 부위별로** 타격 시 더 버티던지 도망가던지 …
    //    **엔진을 정확히 타격하거나 핵심 시설을 타격해야 그나마 빨리 승리**」
    //  ★★ 한가운데를 정확히 겨눌수록 **핵심**, 도망가는 놈을 쫓아 쏘면
    //    **엔진**, 정면으로 맞붙으면 **무기**가 나온다. 그냥 때리면 선체다
    const wpn = WEAPONS[d.shot.weapon] ?? WEAPONS.laser;
    const hp = hitPart(t, { off: d.shot.off, tol: wpn.tol, dmg: d.shot.dmg });
    t.flash = 0.5;
    // ★ 맞은 자리에서 터진다 — 「맞았나」를 숫자로만 알려주지 않는다
    ship.outside.shots.pop(shotAt(t.az, t.el, t.dist));
    if (t.hp > 0) {
      // ★ **어디를 맞혔는지 말한다.** 안 말하면 「부위」가 있는 줄을 모르고,
      //   모르면 겨누지 않는다 — 규칙이 있는데 화면에 없으면 없는 것과 같다
      const dead = hp.part.kills === 'move' ? ' · 엔진 정지'
        : hp.part.kills === 'shoot' ? ' · 무기 파괴' : '';
      say(ai, `${TKINDS[t.kind].name} ${hp.part.name} 명중${dead} — 맷집 ${Math.max(0, Math.round(t.hp))}`,
        hp.part.key === 'core' || dead ? 'warn' : 'tell');
      continue;
    }
    // 부쉈다
    sky.list = sky.list.filter((x) => x !== t);
    sky.killed++; combat.kills++;
    forgetLock(combat, t.id);
    // ══ ★★★ **부순 것과 얻는 것 사이에 일이 하나 있다** (v81) ═══════
    //
    //  ★ 사장님 「파괴하고 **적의 지원이 오기전에** 파괴된 적기의 무기나
    //    텔레포트 아크에너지, 핵탄두 재료 등을 **회수**하고」
    //
    //  ★★ v79~v80 은 격추하면 **저절로** 다 들어왔다 — 노획도, 보급도,
    //    탄두 재료도. 편했지만 기획과 다르고, 그 하나가 빠지면 이것들이
    //    같이 없어진다:
    //      · 부수는 것이 **늘 이득**이 된다 → 고를 것이 없다
    //      · 「지나친다」가 성립하지 않는다 → 「뚫는다」가 「청소」가 된다
    //
    //  ★★★ 이제 **꾸러미가 떨어지고**, 그물로 끌어와야 들어온다.
    //    그리고 부순 순간 **지원이 호출된다** (`salvage-table.js CALL`)
    const part = (t.kind === 'convoy' && !warhead.in.includes('core')) ? 'core'
      : (t.kind === 'sat' && !warhead.in.includes('shell')) ? 'shell' : null;
    const pk = dropPack(salvage, t, part);
    const inS = callIn(t.kind);
    // ══ **격추 화면** — 광학 창이 부서지는 것을 비춘다 (v79) ═══════════
    //  ★ **아직 잔해가 없다.** 잔해는 `targets.update` 가 「목록에서 사라진
    //    것」을 보고 **다음 프레임에** 만든다 — 여기서 `lastWreck()` 을
    //    부르면 **지난번 격추**를 잡는다. 지금 프레임에는 아직 살아 있는
    //    몸통이 있으므로 그 자리를 쓴다
    if (ship.optic) {
      const at = ship.outside.targets.posOf(t.id) ?? shotAt(t.az, t.el, t.dist);
      ship.optic.killed(at, {
        name: TKINDS[t.kind]?.name ?? '?',
        loot: null, myWas: myPower(), myNow: null,
        drop: pk ? packWord(pk.has, pk.part) : null,
      });
    }
    say(ai, `${TKINDS[t.kind]?.name ?? ''} 격추 — 잔해가 남았습니다 · 지원 ${Math.round(inS)}초`, 'warn');
    audio?.event('latch');
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
    // ★★ v74 — **선체에 닿은 것만 들린다** (진공 규칙 · `audio-table.js STRUCT`).
    //   여기가 그 규칙의 제일 곧은 자리다: 밖에서 떠다니던 것이 **선체에
    //   닿는 순간** 소리가 생긴다. 닿기 전까지는 아무 소리도 없다.
    //   ★ `caught`(잡혔다)·`latch`(걸렸다)를 빌려 쓰고 있었다 — 스친 것과
    //     잡힌 것이 같은 소리면 귀가 아무것도 못 나눈다
    audio?.event(b.ram ? 'hullRam' : 'hullGraze');
    say(ai, b.ram ? '들이받혔습니다 — 선체가 깎였습니다' : `${TKINDS[b.kind]?.name ?? '파편'}이 스쳤습니다`, 'alarm');
  }
}

/**
 * ★★★ **적탄을 맞았다** (v70 · docs/space/WAR.md §5-①)
 *
 *   이 함수가 이 기획의 심장이다:
 *
 *     싸운다 → **맞는다** → 고장이 열린다 → 배를 걸어 고친다 → 다시 싸운다
 *
 *   ★ 이 배가 3년치로 제일 잘하는 것이 **고치는 일**이다. v69 까지 그
 *     일감은 「배가 낡아서」 났고, 즉 **전투와 아무 상관이 없었다.**
 *     여기서 두 계통을 잇는다 — 새로 만드는 것이 아니라 **잇는 것**이다.
 *
 *   ★★ **어디를 맞았나만 말하고 무엇이 죽었는지는 안 말한다.** 자리는
 *     몸이 알고(충격·소리), 계통은 **진단으로 찾는다** (덜그럭거림).
 *     여기서 「냉각 밸브 파손」이라 띄우면 그 순간 진단이 심부름이 된다
 */
function takeHits(list) {
  for (const h of list) {
    if (h.miss) {
      // ★ 빗나간 것도 **알려 준다.** 조용하면 「안 쏘는 줄」 안다 —
      //   피한 것이 피한 것으로 읽혀야 회피가 조작이 된다
      hitFlash = Math.max(hitFlash, 0.18);
      // ══ ★★★ v84 — **「빗나갔다」와 「피했다」를 가른다** ═══════════
      //  ★ v83 까지 둘이 같은 칸이었다. 주사위가 빗나간 것을 「피했다」로
      //    세면, 사람은 **손을 안 써도 피한 것**이 되고 그러면 회피가
      //    영영 조작이 안 된다. 해낸 것은 해냈다고 말해 줘야 한다
      if (h.evaded) {
        say(ai, AI_LINES.evaded, 'alarm');
        audio?.event('click');
        // 다 뺐으면 슬로우를 곧 놓는다 — 끝난 일에 시간이 붙어 있으면
        // 그건 늘어짐이지 긴장이 아니다
        dropSlow(slowmo, 'evade');
      }
      continue;
    }
    const w = h.where;
    // ★ 종류마다 한 발의 무게가 다르다 (`KINDS.gunship.punch` 1.8 ·
    //   `drone.punch` 3.2). 「두껍고 세다」·「몸이 탄이다」의 뒷절반이 여기다
    const punch = h.punch ?? 1;
    hitFlash = Math.max(hitFlash, Math.min(1, 0.8 * punch));
    faults.wear.hull = Math.min(1, faults.wear.hull + w.hull * punch);
    heat = Math.min(HEAT.max, heat + w.heat * punch);
    // ══ ★★★ **맞은 소리** (v74 · 진공 규칙) ═══════════════════════════
    //  밖에서 터지는 것은 안 들린다. **선체에 닿은 것만** 들린다 —
    //  공기가 아니라 금속을 타고 들어온 소리다 (구조전달음).
    //  ★ 그래서 「밖이 조용하면 나는 안 맞았다」가 성립하고, 조종석에서
    //    앞만 보고 있어도 **옆구리를 맞은 것을 귀로 안다.** 지금까지는
    //    붉은 번쩍임 하나뿐이라 어디를 맞았는지 화면으로도 몰랐다
    //  ★★ 세기로 나눈다 — 세게 맞으면 배가 더 낮게, 더 오래 운다
    audio?.event(punch >= 2 ? 'hullRam' : 'hullHit');
    say(ai, w.what, 'tell');
    // ★★ 세 번에 한 번만 일이 된다 (`FAULT_CHANCE`). 매번이면 회차가
    //   고장 목록이 되고, 그러면 사람은 싸우는 대신 **안 맞으려고만** 한다
    if (h.fault && openFault(faults, h.fault)) {
      say(ai, `${w.what} — 무언가 잘못됐습니다`, 'tell');
      audio?.event('fault');
    }
  }
}

// ══ 저장 · 일시정지 ═══════════════════════════════════════════
// ★ **2시간짜리에는 협상 불가다** (PLAN2H §11-1). 저장이 없으면
//   2시간짜리를 **한 번도 끝까지 못 해 본 채로** 만들게 된다.
/** 저장할 것들을 한 곳으로 접는다 — `save-table.js FIELDS` 가 칸을 고른다 */
const world = () => ({
  route, chase, supply, faults, hazard, move, carry, tutor, scenes, drift, helm, gun, rescue, lock, land, scars, suit, combat, warhead, loot, salvage, cargo,
  // ★ v99 — 아크 도약. `save-table.js FIELDS.arc` 가 칸을 고른다
  arc: arcS,
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
    // ★★★ v93 — **결말.** 이게 없으면 2시간이 「도착했다」로 끝난다
    ending: endingOf(warhead.in.length),
    filled: warhead.in.length,
    dropAway: Math.round(dropS.away),
    dropHurt: dropS.hurt,
    missed: dropS.missed,
    // ★★★ v99 — **몇 번 뛰었고 얼마를 건너뛰었나.** 끝 화면은 점수가
    //   아니라 **목록**이다 (PLAN2H §9) — 「살아서 왔지만 이만큼을
    //   지나쳤다」가 한 줄로 남아야 도약이 공짜가 아니었음이 읽힌다
    jumps: arcS.jumps,
    skipped: Math.round(arcS.skipped),
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
/**
 * ★★ **승부수가 방금 쓴 손** — 놓을 때까지 그 손의 잔소리를 막는다 (v68).
 *   결판이 나면 `gambit.on` 이 비므로 **바로 다음 프레임에** 원래 잔소리가
 *   깨어나 배너를 덮는다 — 광석을 던져 놓고 「광석이 모자랍니다」가 뜬다.
 *   브라우저로 잡았고, 코드만 봐서는 안 보이는 종류다
 */
let gbUsedHand = null;
/** ★ 세 축 (v60). `steerPush` 는 좌우 하나뿐이었다 — 우주는 삼차원이다 */
const fly3 = makeFlight();
/** ★ 승부수 — 쫓길 때의 결심 넷 (v68) */
const gambit = makeGambit();
const flyPush = { pitch: 0, yaw: 0, roll: 0 };

/**
 * ★★★ **가상 조종간의 자리** (v80 · −1~1).
 *
 *   마우스가 미는 것은 「그 프레임의 각도」가 아니라 **이 자리**다.
 *   손을 멈추면 천천히 가운데로 돌아온다 (`helm-table.js STICK`).
 *   비행 시뮬의 relative mouse 가 하는 일이고, v79 의 「너무 느려」의 답이다
 */
const stick = { x: 0, y: 0 };
/** ★ 급가속이 왜 안 되는지 말한 뒤 잠깐 쉰다 — 매 프레임 외치면 배너가 굳는다 */
let rushSaid = 0;

/**
 * ★ W/S 로 추력을 켜고 끈다 (v80 · 정석). 차단기와 **같은 길**을 쓴다 —
 *   두 벌로 만들면 「키로 켠 것과 차단기로 켠 것이 다르다」가 난다
 */
function setThrustKey(on) {
  if (on && !canTurnOn(power) && !power.thrust) {
    say(ai, '전력이 모자랍니다 — 다른 것을 끄십시오', 'warn');
    return;
  }
  power.thrust = on;
  say(ai, on ? '추력 — 켬' : '추력 — 끔', 'tell');
  // ★★ v88 — **밀림은 여기서 안 준다.** 처음엔 여기 한 줄이었는데,
  //   추력을 켜는 길은 이 함수만이 아니다 (점검 모드 · 차단기 · 이어하기).
  //   검사가 `SPACE.setPower('thrust', true)` 로 켜니 밀림이 0 이었고,
  //   게임에서는 나는데 검사에서는 안 나는 상태였다. 「들어가는 길을
  //   하나만 만들지 않는다」와 같은 병이라 **한 곳에서 지켜보게** 옮겼다
  //   (아래 `thrustWas`)
}

// ══ ★★★ **노획 — 격추가 나를 키운다** (v79) ═══════════════════════════
//  사장님 「상대우주선을 **격추할때마다 적의 무기나 장갑을 회수**하면서
//          **나도 전투력이 올라가게** 설계하시오」
//
//  ★ 개수만 센다. 전투력으로 옮기는 식은 `might-table.js` 한 곳에만 있다 —
//    여기서도 더하면 표가 둘이 되고, 둘이면 갈라진다
const loot = { weapon: 0, armor: 0 };

/** ★★★ v81 — **회수.** 부순 자리에 남는 꾸러미 · 그물 · 지원 도착 시계 */
const salvage = makeSalvage();

/**
 * ★★★ v84 — **느려지는 시간.** 발사(사출)와 회피가 부른다.
 *   ★ 둘이 각자 `dt` 를 곱하면 0.45×0.45 = 0.20 이라 화면이 멈춘다.
 *     `slow.js` 가 **제일 느린 하나만** 쓰고 바닥으로 막는다
 */
const slowmo = makeSlow();

/**
 * ★★★ v83 — **화물칸.** 아이템에는 **무게**가 있으므로 「이걸 실을까
 *   저걸 실을까」가 생긴다. 탄두 재료 다섯이 화물칸을 꽉 채우도록
 *   숫자를 맞춰 뒀다 (`cargo-table.js HOLD`)
 */
const cargo = makeCargo();

/**
 * ★★★ **회수했다** (v81) — 격추 순간에 흩어져 있던 것들이 **여기 한 곳**으로
 *   모인다: 노획(전투력) · 보급(광석·부품·식량) · 탄두 재료.
 *
 *   ★ v79~v80 은 이 셋이 `landShots` 안에 따로 흩어져 있었고 전부
 *     **격추 즉시**였다. 한 꾸러미로 묶으니 「무엇을 줍고 무엇을 버릴지」가
 *     한 물건에 대한 **한 번의 결정**이 된다
 */
function takeSalvage(p) {
  const was = myPower();
  // ══ ★★★ v83 — **아이템으로 싣는다** ═══════════════════════════════
  //  꾸러미가 든 것은 이제 덩어리가 아니라 **아이템**이다. 화물칸에는
  //  **무게 한도**가 있으므로 다 못 실을 수 있다 — 그게 「무엇을 줍고
  //  무엇을 버릴지」의 두 번째 층이다 (`docs/space/ITEMS.md §4`)
  const r = cargoPut(cargo, p.has);
  // 실은 것만 배의 계통으로 들어간다 (`cargo-table.js ITEMS[k].use`)
  const u = useOf(r.took);
  if (u.food) supply.food = Math.min(FOOD.max, supply.food + u.food);
  if (u.parts) supply.parts = Math.min(PARTS.max, supply.parts + u.parts);
  if (u.ore) supply.ore = Math.min(ORE.max, supply.ore + u.ore);
  if (u.lootWeapon) loot.weapon += u.lootWeapon;
  if (u.lootArmor) loot.armor += u.lootArmor;
  if (u.suitAir) refillSuit(suit, u.suitAir);
  if (u.sink) sink = Math.max(0, sink + u.sink);
  const now = myPower();
  let extra = '';
  // ★ 탄두 재료는 **손에 들려 준다** — 꽂힌 것이 아니다 (v71)
  if (p.part && headPick(warhead, p.part)) {
    extra = p.part === 'core' ? ' · ★ 분열 노심 — 기관실 크레이들로'
      : ' · ★ 재돌입체 외피 — 기관실 크레이들로';
  }
  const missed = Object.keys(r.missed).length
    ? ` · ★ 자리가 없어 못 실음 (${cargoWord(r.missed)})` : '';
  say(ai, `회수 — ${cargoWord(r.took)}${now > was ? ` · 전투력 ${was} → ${now}` : ''}${extra}${missed}`, 'tell');
  audio?.event('fixed');
}

/** ★ 지금 내 전투력 — **선체가 깎이면 같이 깎인다** */
function myPower() {
  return myMight({
    weapons: WEAPON_LIST.map((w) => w.key),
    hull: 1 - (faults.wear.hull ?? 0),
    loot,
  });
}

/** ★ 광학 창이 지금 무엇을 비추나 — **락온한 것 · 없으면 겨눈 것 · 없으면 제일 가까운 적** */
function opticTarget() {
  if (combat.radar.on && combat.radar.id != null) {
    const t = sky.list.find((x) => x.id === combat.radar.id);
    if (t) return t;
  }
  const a = noseAim();
  const aimed = aimedAt(sky, a.az, a.el);
  if (aimed?.t) return aimed.t;
  // ★ 아무것도 안 겨눴으면 **제일 가까운 적**을 본다. 「겨눌 것이 없습니다」로
  //   비워 두면 이 창은 싸울 때만 사는데, 이 창의 일은 **붙기 전에 정하는 것**이다
  let best = null;
  for (const t of sky.list) {
    if (t.dist > OPTIC.reach) continue;
    if (!best || t.dist < best.dist) best = t;
  }
  return best;
}
/** 걸으려 하는데 못 걸은 시간 — `GUN.freeAfter` 를 넘으면 저절로 일어난다 */
let stuckT = 0;
/** 마지막 프레임의 실제 부하 — `renderer.info` 는 매 패스 되돌아간다 */
let lastCost = { calls: 0, tris: 0 };
let hitFlash = 0;         // 부딪힌 순간의 화면 충격
/** ★★★ v84 — 지금 급기동(Shift) 중인가. **회피가 이걸 읽는다** */
let burstNow = false;
/** ★ v86 — Space 는 **누른 순간** 한 번만 먹는다 (추력은 켜고 끄는 물건이다) */
let thrustHeldKey = false;
/**
 * ★★★ v87 — **밟는 순간 눈이 뒤로 밀린다** (`boost-table.js KICK`).
 *   ★ 우주에서 등속은 아무 느낌이 없다 (고증). 느껴지는 것은 **가속**뿐이고
 *     그건 몸이 눌리는 것이다 — 그래서 「빠른가」가 아니라 **「밟고 있나」**를
 *     그린다. 여태 추력을 켜도 아무 느낌이 없어 계기로만 알 수 있었다
 */
let kickT = 0;
/** ★ v88 — 지난 프레임에 추력이 켜져 있었나. 꺼짐→켜짐만 밀림을 준다 */
let thrustWas = false;
/** ★★★ v84 — 지금 나를 맞힐 탄 하나 (화살표·경고가 읽는다) */
let threat = null;
let winching = false;     // 지금 윈치를 잡고 있나
let loading = false;      // 땅에서 싣고 있나 — 같은 손잡이, 다른 일
let liftHeldWas = false;  // 이륙은 제 셈을 갖는다 (눌린 순간을 두 곳에서 본다)
let autoHeldWas = false;  // 자동 항법 스위치도 제 셈을 갖는다
let gripping = false;     // ★ 조준 손잡이를 잡고 있나 — WASD 가 포탑을 돌린다
let fireHeldWas = false;  // 쏘는 것도 제 셈을 갖는다 (마우스 왼쪽)
/** ★ v94 — **오른쪽 단추(보조 무기)**를 지난 프레임에 누르고 있었나 */
let altFireWas = false;
let wrecked = false;      // ★ 행성을 박았다 — 이 게임의 유일한 끝
/** ★ 도착했다 — 끝 화면을 한 번만 띄우려고 (8판 · PLAN2H §9) */
let ended = false;
let endWhat = null;
/** 굶어서 손이 떨린 시간 (초). 끝 화면 목록의 한 줄이 된다 */
let shakyT = 0;
let trading = 0;          // 접수구를 얼마나 잡고 있었나
/** ★ 이번에 잡고 있는 동안 식량을 이미 받았나 — 계속 잡으면 미사일까지 간다 */
let boughtFood = false;
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
/**
 * ══ ★★★ v84 — **등대.** 이 배가 말하는 **유일한 구멍** ═══════════════
 *
 *  ★ 사장님 「**우주선 내에 ai를 도입**해서 … 튜토리얼, 도움말, 조언,
 *    경고 … **하지만 최종 결정은 플레이어가**」
 *
 *  ★★ 새로 얹지 않고 **모았다.** v83 까지 이 파일에 `banner = …;
 *    bannerT = …;` 가 **112곳** 흩어져 있었다 — 아무나 아무 때나
 *    덮어썼고, 셋이 한꺼번에 오면 **마지막 하나**만 남았다 (그게 제일
 *    안 급한 것일 수도 있었다). 이제 전부 `say(ai, …)` 하나로 들어오고,
 *    **급한 것이 덜 급한 것을 밀어낸다.**
 *
 *  ★★★ **등대는 길을 비출 뿐 배를 몰지 않는다.** 조종·발사·회수를
 *    이 계통이 부르지 않는다 — `tools/space-ai.js` 가 그걸 센다
 */
const ai = makeAI();
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
  say(ai, text, 'tell');
  audio?.event('deny');
}
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
    // ══ ★★★ v86 — **앉아서 W 를 누르면 일어나 버렸다** ═══════════════
    //
    //  ★ 사장님이 세 판에 걸쳐 「상하 조정이 안 된다」고 하셨고, 재 보니
    //    **상태가 셋인데 W/S 의 뜻이 셋 다 달랐다**:
    //
    //      걷는 중            W/S = 걷기
    //      앉음(조종간 안 잡음) W/S = **일어난다**   ← 여기
    //      조종간 잡음         W/S = 추력 (v80)
    //
    //    즉 **위아래는 어느 상태에서도 W/S 가 아니었다.** 마우스 세로
    //    하나뿐이었는데 그건 손이 제일 짧게 움직이는 축이다.
    //
    //  ★★ 이제 **앉아 있으면 W/S 는 기수 위아래**다. 일어나는 것은
    //    **X** 하나로 모았다 (v85) — 나가는 길이 하나라야 안 헷갈린다.
    //  ★ A/D 는 그대로 「일어난다」로 둔다: 옆으로 비키려는 몸짓이고,
    //    v52 에 좌석에 갇혔던 함정을 다시 파지 않는다
    // ★ v88 — A/D 로 **일어나던 것을 걷어냈다.** 앉으면 늘 조종간을 잡고
    //   있으므로 `flyPush` 는 위쪽 블록이 통째로 만든다 (W/S 위아래 ·
    //   A/D 좌우). 여기 남겨 두면 **같은 키가 상태마다 뜻이 다른 것**이
    //   그대로 남는다 — 이번 판이 없애려는 바로 그 병이다
    if (f !== 0) { flyPush.pitch = f; }
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
  say(ai, '부딪혔습니다', 'alarm');
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
    ...pans.map((p) => p.hit), ship.winch.hit, ship.tradeHatch.hit, ship.cradle.hit, ship.cock.yokeHit,
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
  /** ★★ v71 — 탄두 크레이들 (기관실 후미) */
  let onCradle = false;
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
      if (o === ship.cradle.hit) { onCradle = true; break; }
      if (o === ship.tradeHatch.hit) { onHatch = true; break; }
      if (o === ship.cock.yokeHit) { onYoke = true; break; }
      // ★ 좌석 — **앉아 있을 때는 안 잡힌다.**
      //   ★★ v88 에 「내리는 손잡이로 쓰자」며 `true` 로 바꿔 봤다가
      //     되돌렸다. **앉으면 좌석이 몸 아래에 있어 앞으로 쏜 광선이
      //     닿지를 않는다** — 각도를 25칸 훑어도 한 번도 안 걸렸다.
      //     못 닿는 곳에 길을 내 놓고 「길이 둘」이라 적는 것이 제일 나쁘다
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
    && (onValve || breaker || plate >= 0 || panel || onWinch || onHatch || onYoke || onCrank || onThr || onCradle)) {
    nag(`${CARRY_KINDS[carry.held].name}을 안고 있습니다 — 어딘가 붙여 놓으세요`);
    onValve = false; breaker = null; plate = -1; panel = null;
    onWinch = false; onHatch = false; onYoke = false; onCrank = null; onThr = false; onCradle = false;
  }

  // ★★ **지금 조종석 손잡이가 잡혀 있나** (v66). 이름을 하나씩 적는 대신
  //   묶어 둔다 — 손잡이를 늘릴 때마다 이 줄을 고쳐야 하는 것이 맞다
  const cockGrip = onYoke || onAuto || onThr || plate >= 0;

  // ══ ★★★ **승부수를 잡는다** (v68) — 새 손잡이를 하나도 안 만든다 ══
  //  이미 있는 넷이 **상황에 따라 다른 일**을 한다. 이 배의 규약이다
  //  (조종간이 잔해도 피하고 자세도 잡는다 · 윈치가 낚기도 하고 싣기도 한다).
  //
  //    버리기       화물 접수구 — 거점에서 거래하던 그 구멍
  //    끌고 들어가기 조종간     — 잔해 지대 쪽으로 끝까지 튼다
  //    숨죽이기     통로 차단기 — **셋을 다 내려야** 걸린다
  //    남의 미끼    윈치       — 우주에서 낚던 그것
  //
  //  ★ 손목 장치에 줄을 안 늘렸다. **잡을 수 있는 손잡이가 켜지는 것**으로
  //    족하다 — 배울 것이 없어야 한다
  if (!input.hold) gbUsedHand = null;
  const gbHand = gambit.on?.hand ?? null;
  const gbHolding = !!input.hold && (
    (gbHand === 'hatch' && onHatch)
    || (gbHand === 'yoke' && onYoke)
    || (gbHand === 'winch' && onWinch)
    // ★ 차단기는 **셋을 다 내린 채** 아무 차단기나 잡고 있어야 한다 —
    //   「전부 끄고 지나가기를 기다린다」가 그 모양이다
    || (gbHand === 'breakers' && !!breaker && !power.thrust && !power.cool && !power.sensor)
  );

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
    say(ai, `${CARRY_KINDS[carry.held].name}을 떼어 냈습니다`, 'tell');
    audio?.event('fixed');
  } else if (carried === 'stuck') {
    say(ai, '붙였습니다', 'tell');
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
  // ══ ★★★ **v78 — 누르고 있지 않는다. 눌러서 잡고 눌러서 놓는다** ══
  //
  //  사장님 「운전석 잡을때 **좌측 마우스를 계속 누르고 있어야 해서
  //          피로하니깐** 다른 방법으로 바꿔」
  //
  //  ★ 맞는 말이다. 조종간은 이 게임에서 **제일 오래 잡고 있는 물건**이다
  //    — 전투 한 판이 40~90초인데 그동안 버튼을 계속 누르고 있어야 했다.
  //    다른 손잡이(밸브·크랭크·윈치)는 몇 초짜리라 누르고 있는 것이 맞지만,
  //    조종간만은 **자세**에 가깝다.
  //
  //  ★★ 그래서 **토글**로 바꾼다: 겨누고 한 번 누르면 잡히고, 다시 누르면
  //    놓는다. 실제 비행기도 조종간을 「쥐는 것」이지 「누르고 있는 것」이
  //    아니다. 그리고 v63 의 걸쇠(딴 데를 봐도 안 놓아진다)는 그대로 산다 —
  //    오히려 토글이라야 그 규약이 자연스럽다.
  //
  //  ★ 놓는 길을 **둘** 둔다. 다시 누르거나, 좌석에서 일어나거나.
  //    하나뿐이면 「어떻게 놓지」에서 막히는 사람이 반드시 생긴다
  // ══ ★★★ v85 — **좌클릭이 쏘기와 겹쳤다** ═══════════════════════════
  //
  //  ★ 사장님 「쏘기가 마우스 왼쪽으로 **조정간에서 나오는거랑 키가
  //    중복**이야. **다른 키를 눌러서** 조정석에서 나오도록 해줘야지」
  //
  //  ★★ 맞다. v78 에 조종간을 **토글**로 바꾸면서(「계속 누르고 있어야
  //    해서 피로하다」) 좌클릭이 「잡는다/놓는다」가 됐는데, v79 에
  //    **좌클릭이 발사**가 됐다. 두 판이 각자 맞았고 **겹치는 것을
  //    아무도 안 봤다** — 그래서 쏠 때마다 조종간이 놓아진다.
  //
  //  ★★★ 그래서 **잡는 것만 좌클릭**이고, **놓는 것은 X** 다:
  //      · 안 잡았을 때 좌클릭 → 잡는다 (겨눠야 한다. 쏠 일이 없다)
  //      · 잡았을 때 좌클릭   → **쏜다** (놓지 않는다)
  //      · X                  → 놓는다 · 한 번 더 누르면 **일어난다**
  //    실제 조종간도 「쥔 채로 방아쇠를 당기는」 물건이지, 방아쇠를
  //    당기면 손이 떨어지는 물건이 아니다
  if (input.press && !readGrip && !yokeHeld && onYoke) {
    yokeHeld = true; input.takePress();
    say(ai, '조종간을 잡습니다 — 놓을 때는 X', 'teach');
  }
  // 좌석에서 일어나면 손도 놓는다 — 「자세는 안 잇는다」와 같은 규약
  if (!helmSat) yokeHeld = false;
  steering = yokeHeld;
  // ★★ **잡는 순간 자동 항법이 꺼진다** (사장님 「수동으로 운전할때는
  //   자동항법 꺼지는 걸로」). 이게 있어야 「내가 몬다」가 성립한다 —
  //   전에는 놓으면 배가 저절로 항로로 돌아와서 **한 일이 아무 자국도
  //   안 남았다.** 그게 「조정석을 잡아도 운전이 안 되잔아」의 실체다
  if (steering && takeHelm(helm)) {
    say(ai, '수동 조종 — 자동 항법이 꺼졌습니다', 'tell');
    audio?.event('latch');
  }
  // ★ 다시 켜는 것은 **조종간이 아니라 옆의 스위치**다. 같은 손잡이가
  //   껐다 켰다 하면 지금 어느 쪽인지를 모른다
  if (onAuto && input.hold && !autoHeldWas) {
    if (engageAuto(helm)) {
      say(ai, '자동 항법 — 항로로 돌아갑니다', 'tell');
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
  if (rev2 === 'answered') { say(ai, RESCUE.near, 'tell'); audio?.event('fault'); }
  if (rev2 === 'took') {
    supply.parts = Math.min(PARTS.max, supply.parts + rescue.got.parts);
    supply.food = Math.min(FOOD.max, supply.food + rescue.got.food);
    // ★★ v69 — **미사일도 나온다** (사장님 「미사일은 보급을 받거나 구매」).
    //   사는 것(2발)보다 많다 — 위험한 데를 뒤진 값이 커야 「가는 것이
    //   진짜 선택」이 된다 (`space-rescue.js` 가 지키는 것과 같은 줄)
    const gotM = salvageMissiles(supply);
    // ★★★ v71 — **중성자 개시기가 여기서 나온다** (「뒤진다」).
    //   표류선을 뒤지는 일이 이미 있으므로 **새 미션을 안 만든다** —
    //   있던 자리에 뜻을 하나 얹는다 (이 배의 오랜 규약)
    let gotHead = '';
    if (!warhead.in.includes('initiator') && headPick(warhead, 'initiator')) {
      gotHead = ' · **중성자 개시기**';
    }
    say(ai, `${RESCUE.took} — 부품 ${rescue.got.parts} · 식량 ${rescue.got.food}`
      + (gotM ? ` · 미사일 ${gotM}발` : '') + gotHead, 'tell');
    audio?.event('escaped');
    sceneDone(scenes, 'G');
  }
  if (rev2 === 'left') { say(ai, RESCUE.left, 'tell'); sceneDone(scenes, 'G'); }

  // ── ★★ 주 차단기 — **어둠 속에서 올린다** (E 정전 · 7판) ──────
  const dev = stepDark(dark, dt, onMain && input.hold);
  if (dev === 'back') {
    say(ai, DARK.back, 'tell');
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
    say(ai, '우주복을 입었습니다 — 손이 둔합니다', 'alarm'); audio?.event('latch');
  }
  if (wev === 'doffed') { say(ai, '우주복을 벗었습니다', 'alarm'); audio?.event('click'); }
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
    say(ai, `우주복 공기가 얼마 없습니다 — ${(suit.air / 60).toFixed(1)}분`, 'alarm'); audio?.event('fault');
  }
  if (sev === 'out') {
    // ★ **죽이지 않는다.** 배가 억지로 끌어들이고 문을 닫는다 —
    //   벌은 늘 기다림이다 (기밀 상실 · 정전 · 끼인 문과 같은 규약)
    lock.open = false; lock.opening = false; lock.cycling = 0;
    lock.lockout = LOCK.lockout;
    say(ai, '공기가 바닥났습니다 — 배가 문을 닫았습니다', 'alarm'); hitFlash = 1; audio?.event('caught');
  }

  const onDirt = landDown(land);
  loading = onDirt && onWinch && input.hold && canLoadLand(land, { doorOpen: lock.open });
  winching = !onDirt
    && onWinch && input.hold && !power.thrust && !bad.noWinch && canHaul(lock);
  // ★ 잡았는데 안 걸리면 **왜인지 말한다.** 조용하면 윈치가 고장난 줄 안다
  // ★★ **승부수가 그 손을 쓰는 동안은 잔소리를 안 한다** (v68).
  //   같은 손잡이가 두 뜻을 가지면 한쪽이 **다른 쪽을 부정하는 말**을 한다 —
  //   광석을 던지는 중인데 「광석이 모자랍니다」가 뜨는 식이다.
  //   브라우저로 잡았다: 「잡고 있으니 결판이 났다 — 광석이 모자랍니다」
  if (onWinch && input.hold && !winching && !loading && !gbHolding && gbUsedHand !== 'winch') {
    const w = onDirt ? loadWhy(land, { doorOpen: lock.open }) : haulWhy(lock);
    nag(bad.noWinch ? '에어록이 안 닫혀 못 씁니다'
      : (!onDirt && power.thrust) ? '추진을 끄고 잡습니다'
        : (w ? (onDirt ? LAND_WHY[w] : LOCK_WHY[w]) : '지금은 안 걸립니다'));
  }
  if (winching) {
    if (winchStep(supply, dt) === 'load') {
      say(ai, `광석 한 통 — ${supply.loads}통째`, 'tell');
      audio?.event('latch');
      // ★★★ v71 — **부스터 가스는 캐서 나온다** (「사거나 채굴」의 「캐는」 쪽).
      //   내려서 **세 통**을 캐야 나온다 — 오래 서 있어야 하고, 서 있으면
      //   들킨다. 그 값이 이 재료의 위험이다
      if (onDirt && supply.loads >= 3 && !warhead.in.includes('booster')
        && warhead.carrying !== 'booster' && headPick(warhead, 'booster')) {
        say(ai, '얼음에서 **부스터 가스**를 뽑았습니다 — 기관실 크레이들로', 'tell');
        audio?.event('fixed');
      }
    }
    ship.winch.drum.rotation.y -= dt * 2.4;
  }
  if (loading) {
    const g = loadStep(land, dt);
    supply.ore = Math.min(ORE.max, supply.ore + g.ore);
    supply.food = Math.min(FOOD.max, supply.food + g.food);
    if (g.parts) {
      supply.parts = Math.min(PARTS.max, supply.parts + g.parts);
      say(ai, `부품 ${g.parts}개를 실었습니다`, 'tell');
      audio?.event('latch');
    }
    ship.winch.drum.rotation.y -= dt * 3.4;
  }

  // ══ ★★★ **탄두 크레이들** — 기관실 후미 (v71) ═══════════════════
  //
  //  ★ 손에 든 재료가 있으면 **꽂는 자리**고, 다섯이 다 찼으면
  //    **무장하는 자리**다. 같은 손잡이가 상황에 따라 다른 일을 한다 —
  //    이 배의 규약이고, 손이 배울 것을 안 늘린다
  if (onCradle && input.hold) {
    if (warhead.carrying) {
      if (holdCradle(warhead, dt, { holding: true }) === 'in') {
        const p = HEAD_BY[warhead.in[warhead.in.length - 1]];
        say(ai, `${p?.name ?? '재료'}를 꽂았습니다 — ${warhead.in.length}/${PARTS5.length}`, 'tell');
        audio?.event('fixed');
      }
    } else if (headFull(warhead) && !warhead.armed) {
      if (holdArm(warhead, dt, { holding: true }) === 'armed') {
        say(ai, '탄두가 무장했습니다', 'tell');
        audio?.event('latch');
      }
    } else if (!warhead.armed) {
      nag(`재료가 ${warhead.in.length}/${PARTS5.length} 입니다 — 다 채워야 무장합니다`);
    }
  } else {
    holdCradle(warhead, dt, { holding: false });
    holdArm(warhead, dt, { holding: false });
  }
  // ★★★ **탄두가 데워진다** — 기관실에 둔 값 (`warhead-table.js BAKE`).
  //   추진을 켜면 이 방이 뜨거워지고, 뜨거우면 탄두가 오른다.
  //   한계에 닿으면 **꽂아 둔 것이 하나 죽는다** — 죽는 것이 아니라 일이 는다
  {
    const hev = stepWarhead(warhead, dt, { heat });
    if (hev === 'warn') { say(ai, '탄두가 뜨겁습니다', 'tell'); audio?.event('fault'); }
    if (hev === 'lost') {
      const g = HEAD_BY[warhead.lost[warhead.lost.length - 1]];
      say(ai, `열에 ${g?.name ?? '재료'}가 망가졌습니다 — 다시 구해야 합니다`, 'tell');
      audio?.event('caught');
    }
  }

  // ── 접수구 — 거점에서만. 상인은 얼굴이 없다 (PLAN §1) ──
  // ★ 여기도 조용했다 — 거점이 아니거나 광석이 모자라면 잡고 있어도
  //   아무 일이 없었고, 왜인지도 안 말했다
  if (onHatch && input.hold && !gbHolding && gbUsedHand !== 'hatch'
    && !(route.phase === RPHASE.PORT && canTrade(supply))) {
    nag(route.phase === RPHASE.PORT ? '광석이 모자랍니다' : '거점에서만 바꿉니다');
  }
  if (onHatch && input.hold && route.phase === RPHASE.PORT
    && (canTrade(supply) || canBuyMissiles(supply))) {
    trading += dt;
    // ══ ★★★ **같은 손잡이, 두 번째 뜻** (v69) ═══════════════════════
    //  사장님 「미사일은 **보급을 받거나 구매**할 수 있도록」.
    //
    //  ★ 접수구를 하나 더 안 만든다. 이 배의 규약이 「같은 손잡이가 상황에
    //    따라 다른 일을 한다」이고, 손이 배울 것이 하나 늘면 그만큼 게임이
    //    멀어진다. **더 오래 잡고 있으면** 식량 대신 미사일이 온다 —
    //    같은 자리, 같은 동작, 다른 결과. 그리고 「더 오래」가 곧 「더
    //    비싸다」의 손맛이 된다
    // ★★★ v71 — **폭축 렌즈를 산다** (「사거나 채굴」의 「사는」 쪽).
    //   제일 오래 잡는다: 제일 비싸고 제일 드문 것이므로 손도 제일 오래 매인다
    if (trading >= TRADE.missileHold + 5 && route.fork?.region !== 'void'
      && !warhead.in.includes('lens') && warhead.carrying !== 'lens'
      && supply.ore >= HEAD_BY.lens.cost) {
      trading = 0;
      supply.ore -= HEAD_BY.lens.cost;
      headPick(warhead, 'lens');
      say(ai, `광석 ${HEAD_BY.lens.cost} → 폭축 렌즈 — 기관실 크레이들로`, 'tell');
      audio?.event('fixed');
    } else if (trading >= TRADE.missileHold && canBuyMissiles(supply)) {
      trading = 0;
      buyMissiles(supply);
      say(ai, `광석 ${TRADE.missileOre} → 미사일 ${MISSILES.perBuy}발 (${supply.missiles}/${MISSILES.max})`, 'tell');
      audio?.event('latch');
    } else if (trading >= TRADE.hold && canTrade(supply)) {
      // ★ 미사일을 살 수 있으면 **여기서 안 끊는다** — 계속 잡고 있으면
      //   미사일까지 간다. 끊어 버리면 「더 잡는다」를 배울 길이 없다
      if (!canBuyMissiles(supply)) {
        trading = 0;
        trade(supply);
        say(ai, `광석 ${TRADE.ore} → 식량 ${TRADE.food} · 부품 ${TRADE.parts}`, 'tell');
        audio?.event('fixed');
      } else if (!boughtFood) {
        boughtFood = true;
        trade(supply);
        say(ai, `광석 ${TRADE.ore} → 식량 ${TRADE.food} · 부품 ${TRADE.parts} — 더 잡으면 미사일`, 'tell');
        audio?.event('fixed');
      }
    }
  } else { trading = Math.max(0, trading - dt * 1.5); boughtFood = false; }

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
    say(ai, `부품이 없습니다 — 거점 접수구에서 바꿉니다`, 'warn');
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
      say(ai, repairPose.what, 'tell');
      audio?.event('latch');
    }
    if (ev === 'step') {
      // 「챙긴다」를 마쳤으면 **손에 들려 준다.** 이미 뭘 들고 있으면
      // 못 받는다 — 손은 하나라는 규칙이 여기서도 같다
      if (plan && fixHere.step === plan.takeAt && !giveCarry(carry, plan.kind)) {
        nag('손이 비어야 챙깁니다 — 들고 있는 것을 붙여 놓으세요');
      }
      const nx = fixHere.steps[fixHere.step];
      say(ai, nx?.what ? `${nx.what} — ${ROOM_NAME[nx.at] ?? nx.at}` : '한 군데 더 있습니다', 'tell');
      audio?.event('latch');
    }
    if (ev === 'fixed') {
      repairPose = null; repairAct = null;
      // 쓴 물건은 손에서 없어지고 정비실 제자리로 돌아간다
      if (plan) takeCarry(carry, plan.kind);
      spendParts(supply, needParts);
      // ★ **여기서야 원인을 말해 준다.** 고치기 전에 말하면 진단이 사라진다
      say(ai, fixHere.reveal, 'tell');
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
    say(ai, coolOpen ? '냉각 밸브 — 열림' : '냉각 밸브 — 잠금', 'tell');
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
        say(ai, STEP_WORD[LSTEP.APPROACH], 'tell');
        audio?.event('latch');
      } else nag(LAND_WHY[land.blocked] ?? '지금은 못 내립니다');
    } else {
      passPlanet(land);
      sceneDone(scenes, 'B');
      say(ai, '지나칩니다', 'tell');
      audio?.event('click');
    }
  } else if (plate >= 0 && pressed) {
    if (canPick && chooseFork(route, ship.cock.keyAt(plate))) {
      ship.outside.setRegion(regionOf(route));
      say(ai, `${route.fork.name} — ${(route.fork.seconds / 60).toFixed(0)}분`, 'tell');
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
      say(ai, fuelWord(supply.fuel), 'tell'); audio?.event('deny');
    } else if (power.thrust) {
      power.thrust = false; wearFlip(faults); taught.flips++;
      say(ai, '추력 레버를 당깁니다 — 관성으로 갑니다', 'tell');
      audio?.event('click');
    } else if (canTurnOn(power)) {
      power.thrust = true; wearFlip(faults); taught.flips++;
      say(ai, '추력 레버를 밉니다', 'tell');
      audio?.event('click');
    } else {
      say(ai, '전력이 모자랍니다', 'warn'); audio?.event('deny');
    }
  } else if (breaker && pressed) {
    // ★★ **추진제가 바닥나면 추진이 안 걸린다** (v62 · fuel-table.js).
    //   죽지는 않는다 — 구간은 coast(0.45) 로 계속 나아가고, 그동안
    //   압박이 진짜 시간으로 쌓인다. 벌은 「끝」이 아니라 **기다림**이다
    if (breaker.key === 'thrust' && !power.thrust && isDry(supply.fuel)) {
      say(ai, fuelWord(supply.fuel), 'tell');
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
      say(ai, '전력이 모자랍니다', 'warn');
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
        say(ai, `${c.name} 차단기가 내려갔습니다`, 'tell');
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
    // ══ ★★★ v88 — **앉는 것이 곧 잡는 것이다** ═══════════════════════
    //
    //  사장님 「**앉자마자 조정간이 바로 잡히도록** 해줘. … 지금은 앉아서
    //          조정간 잡을려니 **계속 일어나게 된다**」
    //
    //  ★ 맞는 말이고, 왜 그랬는지도 분명하다. v63 은 앉으면 시선을 34도
    //    **내려** 조종간을 보여 줬는데(`SIT_LOOK`), v87 이 앉으면 고개를
    //    **들어** 창을 보여 주게 바꿨다. 두 규칙이 정면으로 부딪혀 조종간이
    //    시선 밖으로 나갔고, 그 자리에 있던 것이 하필 **좌석**이라
    //    누를 때마다 일어났다. 「한 손잡이가 두 일을 하면 부딪힌다」의
    //    또 다른 얼굴이다.
    //
    //  ★★ 그래서 **상태를 하나 없앤다.** 여태 조종석에 상태가 둘이었다 —
    //    「앉았는데 안 잡음」과 「앉아서 잡음」. 앞의 것은 **아무 일도 안
    //    하는 상태**였고, 조작표에서 키 여덟 개의 뜻이 갈리는 원인이었다.
    //    이제 조종석은 **한 상태**다: 앉으면 잡고 있다.
    //  ★ 그래서 `SIT_LOOK`(앉으면 34도 숙인다)을 안 쓴다. 처음부터 창을
    //    보고 있어야 하고, 계기를 볼 때만 고개를 숙이면 된다
    yokeHeld = true;
    // ══ ★★★ v90 — **앉으면 고개를 창으로 돌려 준다** ═══════════════════
    //
    //  사장님 「왜 **핸들하고 계기판이 아래에 나오지? 전투에 방해되잔아**」
    //  (화면을 보내 주셨는데 아래 절반이 콘솔이었다).
    //
    //  ★ 재 보고서야 알았다. 좌석은 **발치에 있으므로 앉으려면 30도쯤
    //    숙여야** 하는데, v89 가 `SIT_LOOK`(앉으면 34도 숙인다)과
    //    `aimAt`(잡으면 들어 준다)을 **둘 다 걷어냈다.** 그래서 앉은 뒤에도
    //    **숙인 채로 굳었고**, 앉아 있는 동안 마우스는 조종간이라
    //    (v78 스틱) **고개를 다시 들 방법이 없었다.**
    //  ★★ 즉 v89 는 「내리는 규칙」과 「올리는 규칙」을 같이 지웠는데,
    //    **좌석이 발치에 있는 한 내려다보는 것은 규칙이 아니라 사실**이다.
    //    그래서 올리는 쪽만 되살린다 — 단, `aimAt` 처럼 **바닥을 까는 것이
    //    아니라 앉는 순간 한 번**이다. 그래야 나중에 계기를 내려다볼 수 있다.
    //  ★ 어디를 보게 하나: 창의 한복판 = 수평. 기수 방향이 곧 조준이므로
    //    수평이 아니면 앉자마자 배가 틀어져 보인다
    me.pitch = 0;
    say(ai, '조종간을 잡았습니다 — 계기는 오른쪽 단추, 나갈 때는 X', 'tell');
    audio?.event('click');
    // ══ ★★ v88 — **내리는 길은 X 하나다** (그리고 그렇게 적는다) ══════
    //  이 가지는 원래 「아무것도 안 잡힌 데를 누르면 일어난다」였다.
    //  v88 에서 앉기=잡기가 되면서 **그 자리가 「쏜다」**가 됐으므로 없앤다 —
    //  누를 때마다 일어나던 것이 사장님이 고치라고 하신 바로 그 증상이다.
    //  ★ 「들어가는 길을 하나만 만들지 않는다」와 어긋나 보이지만, 여기서는
    //    **닿지 않는 두 번째 길을 적어 두는 것**이 더 나쁘다 (좌석은 몸
    //    아래라 조준선이 안 닿고, 빈 곳 클릭은 이제 발사다). 대신 **앉는
    //    순간 등대가 「나갈 때는 X」라고 말하고**, F1 에도 그렇게 적었다
  } else if (false) {
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
    yokeHeld = false;
    helmSat = false;
    say(ai, '일어납니다', 'tell');
    audio?.event('click');
  }

  // ★ **잡고 있는 동안** WASD 가 포탑을 돌린다 (walk() 가 읽는다)
  // ★★★ v64 — **손잡이가 없어졌다.** 조준은 기수가 한다 (조종간이 곧 조준).
  //   `gripping` 은 이제 「조종석에 앉아 조종간을 잡고 있나」다 —
  //   그게 곧 전투 자세이므로 `steering` 과 같은 값이 된다
  gripping = steering;
  // ══ ★★★ v86 — **쏘는 것은 마우스 왼쪽이다** ═══════════════════════
  //
  //  ★ 여기가 `input.keys.has('Space')` 였다 — **쏘기가 Space** 였다.
  //    그런데 F1 도움말에는 「쏘기 · 마우스 왼쪽」이라고 적혀 있었다.
  //    **화면이 거짓말을 하고 있었다.** 사장님이 「쏘기가 좌클릭이라
  //    조종간에서 나오는 거랑 겹친다」고 하신 것도 도움말을 보고 하신
  //    말씀이었고, 실제로는 좌클릭이 **아무것도 안 쐈다.**
  //  ★★ 이 저장소의 규약 그대로다: 「고쳐 놓고 안내를 안 고치면 안 고친
  //    것과 같다」 — 이번엔 **반대로** 안내가 맞고 코드가 틀렸다.
  //    사람이 읽는 쪽에 맞춘다.
  //  ★ 겹침은 이미 풀렸다 (v85): 잡기는 조종간을 **겨눴을 때만**,
  //    놓기는 **X**. 그래서 잡은 뒤의 좌클릭은 오직 쏘기다
  // ══ ★★★ v88 — **조준선에 뭐가 걸려 있으면 안 쏜다** ═══════════════
  //  v88 에서 앉는 것이 곧 잡는 것이 되자, 좌클릭이 **늘 발사**가 됐다 —
  //  그러면 앉은 채로 **항로 갈래 판·추력 레버·자동 항법을 못 누른다.**
  //  v66 이 그것들을 조종석으로 옮겨 놓았으므로 이건 배가 안 떠나는 것과
  //  같은 말이다. **「잡힌 것이 있나」로 가른다** — 위 일어나기가 이미
  //  쓰는 규칙이고, 실제 조종간도 계기를 누르는 손과 방아쇠가 다르다
  const firePressed = steering && input.hold && !aimName;
  // ══ ★★★ v94 — **오른쪽 단추 = 보조 무기 · 휠 클릭 = 표적** ═══════════
  //
  //  사장님 「**다른 비행시뮬레이션 게임을 찾아서 벤치마크해서 그대로 적용**」
  //
  //  ★ 셋을 찾아 견줬다 (2026-08-10):
  //      Elite Dangerous  마우스 피치+요 · Q/E 롤 · 좌클릭 주 · **우클릭 보조**
  //      Star Citizen     마우스 피치+요 · Q/E 롤 · **T 조준선 · Tab 순환**
  //      Everspace 2      좌클릭 주 · **우클릭 보조** · **휠 클릭 락온** · Shift 부스터
  //    → **우클릭 보조 무기**가 3/3, **휠 클릭 표적**이 Everspace 2 정석이다.
  //  ★★ 우리는 우클릭이 **둘러보기**였다 (v90 에 내가 붙인 것). 옮긴다 —
  //    벤치마크가 셋 다 같은 자리를 쓰면 그건 관습이고, 관습을 어기면
  //    **처음 잡는 사람이 반드시 헤맨다.** 둘러보기는 **C** 로 간다.
  //
  //  ══ ★ 벤치마크와 **일부러 다르게 둔 둘** — 적어 둔다 ═══════════════
  //    ① **W/S 가 추력이 아니라 기수 위아래**다. 정석은 W/S 추력인데,
  //       사장님이 v86 에 「**키보드 WS로 상하 조정되게 하라고**」 세 판에
  //       걸쳐 말씀하셨다. **사장님 손이 정석보다 먼저다.** 추력은 Space.
  //    ② **급기동(Shift)과 급가속(R)이 따로**다. 정석은 Shift 하나인데,
  //       사장님이 v73 에 「**급가속 조작은 따로** 하도록」이라고 하셨다.
  //       기수를 돌리는 것과 앞으로 튀어나가는 것은 다른 결심이기도 하다.
  //    → 벤치마크는 **모르고 다른 것**과 **알고 다른 것**을 갈라 놓으려고
  //      한다. 위 둘은 알고 다른 것이다.
  //  ★ 무기 고르기(1·2·3)는 그대로 둔다 — 우클릭은 **지금 고른 유도탄**을
  //    쏜다. 그래야 손이 숫자열까지 안 간다
  const altPressed = steering && input.alt && !aimName;
  if (helmSat && altPressed && !altFireWas) {
    // ★ 레이저(1번)를 들고 있으면 **유도탄으로 바꿔서** 쏜다 —
    //   「보조 무기」의 뜻이 그것이다
    if (weaponOf(combat).key === 'laser') pickSlot(combat, 3);
    fireGun();
  }
  altFireWas = altPressed;
  // ★ 휠 클릭 — **조준선 안의 것을 묶는다** (T 와 같은 일 · 손이 안 옮겨간다)
  if (helmSat && input.midPress) pickTarget(combat, sky.list, aimAz, aimEl, false);
  // ══ ★★★ **무기 고르기 1 · 2 · 3** (v64) ═════════════════════
  //  ★ 조종석에 앉아 있을 때만 먹는다 — 걷다가 눌러도 아무 일이 없어야
  //    「이 키가 뭐지」가 안 생긴다. 그리고 **바뀌면 말한다**
  for (const w of WEAPON_LIST) {
    if (!helmSat || !input.keys.has(`Digit${w.slot}`)) continue;
    if (combat.slot === w.slot) continue;
    pickSlot(combat, w.slot);
    say(ai, `${w.name} — ${w.what}`, 'tell');
    audio?.event('click');
  }
  // ★★★ v64 — **조종석에 앉아 있으면 쏜다.** 포탑에 올라갈 필요가 없다
  if (helmSat && firePressed && !fireHeldWas) fireGun();
  fireHeldWas = firePressed;

  // ── ★ 바깥문 — 누르는 순간 돌기 시작한다 ──────────────
  if (onOuter && gunPressed) {
    if (cycleLock(lock, { thrust: power.thrust })) {
      say(ai, lock.opening ? '바깥문을 엽니다' : '바깥문을 닫습니다', 'tell');
      audio?.event('latch');
    } else {
      // ★ **조용히 안 열리면 「고장」으로 읽힌다** — 이 저장소가 네 번 겪었다
      say(ai, LOCK_WHY[lock.blocked] ?? '지금은 안 열립니다', 'tell');
    }
  }
  const gbOut = holdGambit(gambit, dt, { holding: gbHolding, leg: route.leg });
  if (gbOut) {
    gbUsedHand = gbHand;
    say(ai, gbOut.what, 'tell');
    audio?.event(gbOut.good ? 'escaped' : 'deny');
    const w = gbOut.gain;
    if (w.dist) chase.dist = Math.min(100, chase.dist + w.dist);
    if (w.sign !== undefined) chase.sign = w.sign;
    if (w.hull) faults.wear.hull = Math.min(1, faults.wear.hull + w.hull);
    if (w.parts) supply.parts = Math.min(PARTS.max, supply.parts + w.parts);
    if (w.food) supply.food = Math.max(0, Math.min(FOOD.max, supply.food + (gbOut.good ? w.food : -w.food)));
    if (w.air) suit.air = Math.max(0, suit.air - w.air);
    // ★ 「버리기」는 **광석을 통째로** 던진다 — 좋은 갈래든 나쁜 갈래든
    if (gbOut.key === 'jettison') supply.ore = 0;
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
        // ★★ v71 — **탄두 크레이들.** 이름이 없으면 조준점이 안 켜지고,
        //   안 켜지면 「눌러도 되는지」를 알 길이 없다 (v64 에 이미 밟은 함정)
        : (onCradle ? 'cradle'
        // ★★★ v88 — **이미 쥔 것은 조준선에 안 잡힌다.** 앉는 것이 곧
        //   잡는 것이 되면서 조종간이 늘 조준선에 걸렸는데, 그러면
        //   ① 손이 다시 뜨고 ② 「계기를 겨누면 안 쏜다」에 걸려
        //   **한 발도 안 나간다.** 쥐고 있는 물건을 또 겨눌 일은 없다
        : (onWinch ? 'winch' : (onHatch ? 'hatch' : ((onYoke && !steering) ? 'yoke' : (onAuto ? 'autopilot' : (onThr ? 'throttle' : null)))))))));
  // ★ 조준점이 **주포와 사다리에서는 안 켜졌다.** 「손이 닿는다」를 알려
  //   주는 유일한 표시인데 빠져 있으면 「눌러도 되는지」를 알 길이 없다
  cross.classList.toggle('on', !!(gbHand && gbHolding) || !!(onOuter || onAuto || onThr || onSuit
    || onValve || breaker || (canPick && plate >= 0) || fixHere
    || (onWinch && !power.thrust) || (onHatch && route.phase === RPHASE.PORT && canTrade(supply))
    || onYoke || onCradle || (crankDoor && crankDoor.jammed)
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

  // ══ ★★ **승부수** — 쫓길 때의 결심 넷 (v68) ═══════════════════════
  //  ★ 고장과 **안 겹치게** 둔다. 추격 중에는 새 고장이 안 뜬다는 규칙이
  //    이미 있으므로(`calm`), 승부수는 **그 빈자리**에 들어간다 —
  //    즉 「할 일이 없는 추격」이 없어진다
  const chasingNow = chase.phase === PHASE.CHASE || chase.phase === PHASE.CAUGHT;
  const gev = stepGambit(gambit, dt, {
    chasing: chasingNow,
    ore: supply.ore,
    // 잔해 지대가 **오고 있을 때만** 「끌고 들어가기」가 뜬다
    hazard: hazard.phase === HPHASE.WARN || hazard.phase === HPHASE.RUN,
  });
  if (gev === 'offer') {
    // ★ **무엇을 하라고 안 적는다.** 실마리만 주고 손잡이가 켜지는 것으로
    //   말한다 (「글로 안 알려준다」 · PLAN §3-1)
    say(ai, gambitWord(gambit.on), 'tell');
    audio?.event('fault');
  }
  if (!chasingNow) chaseOver(gambit);
  if (canFire(tutor, 'fault') && stepFaults(faults, dt, { calm, leg: route.leg }) === 'spawn') {
    const o = faults.open[faults.open.length - 1];
    // ★ **증상만 말한다.** 어디인지·무엇인지는 안 말한다 (PLAN §3-1)
    say(ai, o.lead, 'tell');
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
      say(ai, '어딘가 문이 안 열립니다', 'tell');
      audio?.event('fault');
    }
    if (e.what === 'freed') {
      say(ai, `${e.door.name} 문이 열렸습니다`, 'tell');
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
    say(ai, '손이 떨립니다 — 식량이 모자랍니다', 'warn');
    audio?.event('fault');
  }
  if (sup === 'lowFuel') { say(ai, fuelWord(supply.fuel), 'tell'); audio?.event('fault'); }
  if (sup === 'dry') {
    // ★ 바닥나면 **차단기가 저절로 내려간다.** 「켜 놨는데 안 간다」는
    //   계기가 거짓말하는 것이고, 이 배에서 제일 하면 안 되는 일이다
    power.thrust = false;
    say(ai, '추진제가 바닥났습니다 — 엔진이 꺼집니다', 'alarm');
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
  // ★★★ v73 — **급기동은 Shift.** 어느 축이든 세게 문다 (docs/space/BFM.md §3-②)
  // ══ ★★★ **급가속** (v73 · R) — 급기동(Shift)과 **따로** ═══════════
  //  사장님 「급가속 조작은 **따로** 하도록」. 기수를 돌리는 것과
  //  앞으로 튀어나가는 것은 다른 결심이다 — 하나로 묶으면 고를 것이 없다
  {
    // ══ ★★ **왜 안 되는지 말한다** (v81) ═══════════════════════════
    //  ★ 사장님 「**급 가속은 작동하는 중이야?**」 — 물으셨다는 것 자체가
    //    답이다. R 은 조건 셋을 다 만족해야 먹는데(추력 · 구간 중 · 추진제)
    //    안 먹을 때 **아무 말도 안 했다.** 이 저장소의 규약이 있다:
    //    「조용히 안 나가면 그건 고장으로 읽힌다」 (v64 · `combat-table.js WHY`)
    const wantRush = input.keys.has('KeyR');
    // ★★ v82 — **항로 조건을 뺐다.** 「항로는 자동항법에만」 (사장님).
    //   급가속은 **엔진 일**이지 항법 일이 아니다 — 거점에 대고 있어도
    //   밟으면 나가야 한다
    const rushOk = power.thrust;
    if (wantRush && !rushOk && rushSaid <= 0) {
      say(ai, '급가속 — 추력을 먼저 켜십시오 (W)', 'tell');
      rushSaid = 2.5;
    }
    if (rushSaid > 0) rushSaid -= dt;
    const bev = stepBoost(boost, dt, {
      on: wantRush && rushOk,
      fuel: supply.fuel,
    });
    supply.fuel = Math.max(0, supply.fuel - boost.fuel);
    heat = Math.min(HEAT.max, heat + boost.heat);
    // ★★★ v87 — 급가속을 **밟는 순간** 눈이 뒤로 밀린다. 추력 켬(0.35배)
    //   보다 세게 — 주엔진을 배로 태우는 것이므로 몸이 더 눌린다
    if (bev === 'on') { say(ai, '밀어붙입니다', 'tell'); kickT = KICK.kickFor; }
    if (bev === 'dry') { say(ai, '추진제가 모자라 못 밀어붙입니다', 'warn'); }
  }
  const burst = steering && (input.keys.has('ShiftLeft') || input.keys.has('ShiftRight'));
  // ★★★ v84 — **회피가 이 값을 읽는다.** 급기동을 안 쓰면 0.9초에
  //   `DODGE.need` 를 못 채운다 (조종간만으로는 0.9 < 1.0) — 즉
  //   **급기동을 써야 피해진다.** 값은 이미 있다: 추진제를 크게 태운다
  burstNow = burst;
  fly3.burst = burst;
  // ══ ★★★ v86 — **앉으면 몬다** ═══════════════════════════════════════
  //  ★ `atSeat: steering` 이었다 — **조종간을 잡아야만** 기수가 돌았다.
  //    그런데 앉는 목적이 모는 것이다. 이 한 글자 때문에 「앉았는데
  //    아무것도 안 움직인다」가 났고, 그 위에 「W 를 누르면 일어난다」가
  //    겹쳐서 **위아래가 어느 쪽으로도 안 됐다.**
  //  ★★ 조종간을 잡는 것은 이제 **창이 열리고 화면이 커지는 것**의 뜻이지
  //    「조종을 켜는 스위치」가 아니다
  stepFlight(fly3, dt, { atSeat: steering || helmSat, push: flyPush, manual: !helm.auto, burst });
  // ★★★ v73 — **도는 데 추진제가 든다** (`flight-table.js RCS` · 고증).
  //   천천히 돌리면 반동휠이 공짜로 하고, 급하게 돌리면 추력기가 태운다.
  //   360도를 열어 준 값이 여기 있다 — 값이 없으면 조종이 버튼이 된다
  if (fly3.burned > 0) supply.fuel = Math.max(0, supply.fuel - fly3.burned);
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
    say(ai, `전방에 잔해 — ${warnLeft(hazard).toFixed(0)}초`, 'tell');
    audio?.event('fault');
  }
  if (hev === 'enter') { say(ai, '들어갑니다 — 조종석', 'tell'); }
  if (hev === 'hit') {
    // 죽지 않는다. **대신 일이 는다** (PLAN §4-4)
    faults.wear.hull = Math.min(1, faults.wear.hull + HAZARD.hit.hull);
    heat = Math.min(HEAT.max, heat + HAZARD.hit.heat);
    if (HAZARD.hit.fault) { faults.next = 0; stepFaults(faults, 0.001, { calm: true, leg: route.leg }); }
    say(ai, '부딪혔습니다', 'alarm');
    hitFlash = 1;
    // ★ v74 — **들이받은 것도 선체를 타고 온다.** 제일 낮고 제일 오래 운다.
    //   여기도 `caught`(잡혔다)를 빌려 쓰고 있었다
    audio?.event('hullRam');
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
  // ★★★ v73 — **급가속도 자국이다.** 주엔진을 세게 물면 밝게 타고,
  //   밝게 타는 것은 멀리서도 보인다 (boost-table.js 값 셋 중 ③).
  //   추진제·열만 물리고 이걸 빠뜨리면 「공짜에 가까우니 늘 밟는다」가
  //   되고, 그러면 고를 것이 없어진다 — 값이 셋이라 결심이 된다
  const badSign = (bad.sign + flashSign(gun) + lockSign(lock) + landSign(land)
    + scarSign(scars) + boostSign(boost)) / SIGN_PER_HEAT;
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
    say(ai, '접촉 — 무언가 따라붙었습니다', 'tell');
    // ══ ★★★ **쫓아오는 것이 창밖에 보인다** (v64) ═══════════════
    //  v47~v63 동안 추격자는 **계기의 숫자로만** 있었다 — 그래서
    //  「겨눈다」가 성립하지 않았고 주포는 「쫓길 때 누르는 버튼」이었다.
    //  이제 접촉하면 **적 우주선이 실제로 뜬다.** 부수거나, 안 부수면
    //  들이받힌다. 「쫓긴다」가 처음으로 눈에 보이는 것이 된다
    if (!sky.list.some((t) => TKINDS[t.kind]?.rams)) spawnRaider(sky);
  }
  if (ev === 'escaped') {
    say(ai, '뿌리쳤습니다', 'tell'); escapedAt = clock;
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
    say(ai, '잡혔습니다 — 배를 뒤집니다', 'alarm');
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
    say(ai, '놓아줬습니다 — 실려 있던 것이 없습니다', 'warn');
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
    // ★★ v69 — 레이더 (사장님 「레이더 감지과 레이더 사운드도」).
    //   `seek` 은 0 없음 · 0.5 잡음 · 1 물었다. **HUD 가 26도뿐이라
    //   눈이 늘 조준선에 가 있을 수 없다 — 귀가 대신 본다**
    radarOn: !!power.sensor,
    seek: radarSeek,
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
  // ★★★ v69 — **배의 상태 여섯 줄**(v99 부터 일곱)을 한 번 만들어 두 곳에 준다.
  //   조종석 HUD(앉으면 뜬다)와 정비실 작업대(걸어가서 본다)가 **같은 것**을
  //   본다 (사장님 「운전석에 탔을때 외에도 다른 모니터에서 확인」).
  //   여기서 한 번만 짓는다 — 두 곳에서 따로 지으면 반드시 갈라진다
  const shipStatus = {
    heat,
    cooling: valveOpen && power.cool,
    speed: statusSpeed(CRUISE.speed * (route.phase === RPHASE.PORT ? 0.25
      : (power.thrust ? 1 : LEG.coast))),
    power,
    sign: chase.sign,
    missiles: supply.missiles,
    weapon: weaponOf(combat).name,
    // ★★★ v83 — **들어온 목록**을 상태창이 읽는다 (사장님 「실시간으로
    //   획득 아이템이 … 조정석 화면에서 획득 리스트를」)
    cargo: cargoSummary(cargo),
    // ══ ★★★ v99 — **아크 도약** (일곱째 줄) ═══════════════════════════
    //  ★ 여기에 안 넣고 있었다. `SPACE.arc` 는 8 을 말하는데 계기는
    //    「전지 0/6」을 그리고 있었고, **화면을 찍어서 잡았다** —
    //    규칙 쪽 검사는 전부 초록이었다 (계기 글씨를 못 읽으므로).
    //    「화면에 보이는 것은 화면으로 확인한다」가 또 한 번 맞았다
    arc: {
      ...arcSummary(arcS),
      cells: cargo.items.arc ?? 0, need: ARC.cells, blocked: whyNotJumpNow(),
    },
  };
  // ★★ v71 — 크레이들이 **다섯 칸의 불**과 탄두 온도를 그린다
  ship.cradle.update(headSummary(warhead));
  ship.bench.update({
    wear: faults.wear, open: openList(faults), fixed: faults.fixed, log: faults.log,
    scars: scarList(scars),
    status: shipStatus,
  });
  // ★ 조종석 상태창 — **앉아 있을 때만 켜진다**
  ship.statusHud.redraw({ ...shipStatus, on: helmSat });
  // ★★★ v78 — **레이더도 앉으면 눈앞에 뜬다** (사장님 「hud처럼 나와야지」).
  //   콘솔 판과 **같은 상태**를 준다 — 두 벌로 만들면 언젠가 갈라진다
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
  // ★★ v78 — **콘솔 판과 레이더 HUD 가 같은 상태를 읽는다.**
  //   처음에 HUD 에 `shipStatus` 를 넘겼는데 거기엔 `radar` 가 없어서
  //   HUD 만 「능동 탐지 꺼짐」이 떴다 — 콘솔 판은 멀쩡한데.
  //   **계기 하나에 상태 둘**이면 그게 곧 「표가 둘이면 갈라진다」다
  const cockState = {
    heat, cooling: valveOpen && power.cool, room: roomAt(me.x, me.z), t: clock, dt,
    // ★ 열 저장고 (v58) — 「지금 뜨거운가」 옆에 「쌓인 총열」을 나란히 놓는다.
    //   따로 두면 둘의 관계가 안 읽히고, 관계가 안 읽히면 이 계통은
    //   말이 되는 대신 **어려운** 것이 된다
    sink: sinkAt({ sink }), sinkWord: SINK_WORD(sink), sinkFull: sinkFull({ sink }),
    hide: hideLeft({ sink }, { thrust: power.thrust, cool: power.cool }),
    region: ship.outside.region, power, chase,
    // ★★★ v69 — 레이더. **화면 밖을 보는 유일한 계기**다 (HUD 는 26도뿐).
    //   목록은 `combat.js radarBlips` 한 곳에서만 나온다 — 계기가 직접
    //   하늘을 훑게 두면 「화면에는 있는데 규칙은 모르는」 표적이 생긴다
    // ★★ v75 — **한 프레임에 한 번만 잰다.** `radarBlips` 가 접근율을
    //   내려면 지난 거리를 기억해야 하는데(`radar.seen`), 두 번 부르면
    //   두 번째는 dt 가 지난 뒤라 **접근율이 늘 0** 이 된다.
    //   그래서 여기서 한 번 재고 점검 구멍은 **그 값을 읽는다**
    radar: { on: !!power.sensor, blips: radarSeen = radarBlips(combat, sky.list, aimAz, aimEl, dt), clock },
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
    // ★★★ v79 — **조종간이 내 손을 그대로 따라간다** (사장님 「조정간
    //   움직임은 보이고 손을 떼면 **자동으로 센터로**」). v78 까지는
    //   `lane`(항로 이탈)만 보고 누웠다 — 즉 **미는 것과 눕는 것이 다른
    //   값**이었고, 그래서 밀어도 굼뜨고 놓아도 눕은 채였다
    yoke: { held: steering, pitch: flyPush.pitch, yaw: flyPush.yaw, roll: flyPush.roll },
  };
  ship.cock.update(cockState);
  // ★★★ v78 — **레이더도 앉으면 눈앞에 뜬다** (사장님 「hud처럼 나와야지.
  //   앉아있을때는 알 수가 없잔아」). 콘솔 판과 **같은 상태**를 읽는다
  ship.radarHud.redraw({ ...cockState, on: helmSat });

  // ══ ★★★ **광학 창** (v79) ═══════════════════════════════════════════
  //  사장님 「적을 **거리에 맞게 자동 확대**되고 스크린에는 **거리가 표시**」
  //         「**상대 우주선의 전투력**도 표시되고 **우리 비행기의 전투력 차이**」
  //         「**우주쓰레기면 필요한 재료나 음식이 있는지**」
  //
  //  ★ 배율은 **손으로 안 돌린다.** 거리는 기계가 아는 값이고, 사람 손은
  //    이미 조종간·무기·차단기로 차 있다 (`optic-table.js autoZoom`)
  if (ship.optic) {
    const ot = opticTarget();
    const w = weaponOf(combat);
    // ★ 조종 입력의 세기 — 이것이 곧 **떨림**이다. 많이 밀수록 높은 배율이 안 읽힌다
    const push = Math.abs(flyPush.pitch) + Math.abs(flyPush.yaw) + Math.abs(flyPush.roll);
    ship.optic.redraw({
      on: helmSat,
      target: ot ? { kind: ot.kind, dist: ot.dist, az: ot.az, el: ot.el } : null,
      zoom: ot ? autoZoom(ot.kind, ot.dist, w.key) : 1,
      push,
      my: myPower(),
      weapon: w.key,
      noLock: sky.list.length ? '너무 멉니다' : '떠도는 것이 없습니다',
      // ★ 되감기 중에는 **잔해를 따라간다** — 부서진 것이 밀려 나가므로
      //   한 점에 고정하면 곧 빈 우주를 비춘다
      deadAt: ship.outside.targets.lastWreck(),
    }, dt);
    // ★ 앉아 있지 않으면 전체 화면도 닫는다 — 일어나면서 켜 둔 채 걸으면
    //   앞이 안 보인 채 걷게 된다
    if (!helmSat) opticBig = false;
    ship.optic.setBig(opticBig && helmSat, camera.fov);
    // ══ ★★ **판을 켜면 다른 계기를 끈다** (v79) ═══════════════════════
    //  ★ 처음엔 큰 판을 **덮어서** 가리려 했다 (`depthTest:false` +
    //    `renderOrder 900`). 화면을 찍어 보니 상태창과 레이더가 **여전히
    //    비쳐 보였다** — 합성기의 블룸이 그 글자들을 최종 그림 위에
    //    다시 얹기 때문이다. 덮는 것으로는 못 이긴다.
    //  ★★ 그래서 **끈다.** 그게 말도 된다: 조준 포드 화면을 크게 띄우면
    //    그 자리에 있던 계기는 안 보이는 것이 맞다. 그리고 이것이
    //    「공짜가 아니다」를 하나 더 만든다 — **켜면 레이더를 못 본다**
    const other = opticBig && helmSat;
    if (ship.statusHud?.mesh) ship.statusHud.mesh.visible = !other && helmSat;
    if (ship.radarHud?.mesh) ship.radarHud.mesh.visible = !other && helmSat;
    if (ship.sight?.mesh) ship.sight.mesh.visible = !other;
  }
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
  /**
   * ★ v78 — `steering` 이 늘었다. 조종간이 **토글**이 되면서
   *   「지금 잡고 있나」를 밖에서 물을 길이 필요해졌다 — `up()` 만으로는
   *   안 놓아지므로 검사가 상태를 보고 한 번 더 눌러야 한다
   */
  // ★ v88 — `hands` 를 같이 준다. 「손이 안 보이나」는 화면에만 있던 것이라
  //   검사가 물을 자리가 없었다 (사장님이 두 판에 걸쳐 말씀하신 것이다)
  /** ★★★ v93 — **투하** (`space-drop.js` · endtoend 가 읽는다) */
  get drop() { return { ...dropSummary(dropS), armed: warhead.armed, filled: warhead.in.length }; },
  /** 검사가 마디를 밀어 놓는다 — 마지막 구간까지 2시간을 안 걷게 */
  putDrop(phase, t = 0) { dropS.phase = phase; dropS.t = t; return dropSummary(dropS); },
  /** 검사가 떨군다 — **게임과 같은 길로** */
  pullDrop() {
    const okk = dropPull(dropS, { armed: warhead.armed, filled: warhead.in.length });
    if (okk) { headDrop(warhead); ship.outside.shots.fire('arh', null); }
    return { ok: okk, ...dropSummary(dropS) };
  },
  get helm2() { return { sat: helmSat, k: +helmSitK.toFixed(2), steering, hands: !!hands.group.visible }; },
  /**
   * ★★ v80 — **가상 조종간의 자리** (`space-helm.js` · endtoend 가 읽는다).
   *   기수 각도로 미루어 재면 헤드리스 시계(실제의 1/20) 때문에 값이
   *   거의 안 움직여서 「스틱이 자리를 지키나」를 못 묻는다 — 스틱 자체를 낸다
   */
  get stick() {
    return { x: +stick.x.toFixed(3), y: +stick.y.toFixed(3), push: { ...flyPush } };
  },
  /** 검사가 마우스를 민다 — 헤드리스에서 진짜 마우스 이벤트는 프레임을 탄다 */
  pushStick(x, y) { stick.x = x; stick.y = y; return { x: stick.x, y: stick.y }; },
  putHelmSit(v) { helmSat = !!v; return helmSat; },
  // ══ ★★★ v79 — **광학 창 · 전투력** (space-optic.js 가 읽는다) ══════
  get optic() {
    const ot = opticTarget();
    const w = weaponOf(combat);
    return {
      ...(ship.optic?.seen ?? { on: false }),
      want: ot ? autoZoom(ot.kind, ot.dist, w.key) : 1,
      weapon: w.key,
      kind: ot?.kind ?? null, dist: ot ? Math.round(ot.dist) : null,
      push: +(Math.abs(flyPush.pitch) + Math.abs(flyPush.yaw) + Math.abs(flyPush.roll)).toFixed(2),
    };
  },
  /** ★ 전투력 — 내 것 · 노획 · 지금 보는 적과 견줌 */
  get might() {
    const ot = opticTarget();
    const mine = myPower();
    const theirs = ot ? mightOf(ot.kind) : 0;
    return {
      mine, loot: { ...loot },
      theirs, kind: ot?.kind ?? null,
      odds: ot ? oddsOf(mine, theirs).key : null,
      word: ot ? oddsOf(mine, theirs).word : null,
    };
  },
  /** 검사가 노획을 밀어 놓는다 — 스무 대를 헤드리스로 잡지 않으려고 */
  putLoot(w = 0, a = 0) { loot.weapon = w; loot.armor = a; return { ...loot }; },
  /**
   * ★★ **적이 앞을 보나** — 코가 이쪽인가 엔진 불이 이쪽인가 (v79).
   *   v69~v78 내내 `lookAt` 이 +Z 를 돌려세워서 **등을 보인 채** 왔다.
   *   눈으로만 잡히는 종류라 구멍을 낸다: 엔진 불의 **월드 z** 가
   *   몸통보다 **멀어야**(더 음수가 아니어야) 코가 이쪽이다
   */
  faceOf(id = null) {
    const g = ship.outside.targets?.group;
    if (!g) return null;
    for (const o of g.children) {
      if (!o.name?.startsWith('표적:')) continue;
      const fire = o.getObjectByName('엔진불');
      if (!fire) continue;
      const fw = fire.getWorldPosition(new THREE.Vector3());
      const ow = o.getWorldPosition(new THREE.Vector3());
      // ★ **z 로 견주면 안 된다.** 처음에 `fw.z > ow.z` 로 적었는데,
      //   표적은 앞(z 음수)에 있으므로 「뒤」가 **더 음수**다 — 부호가
      //   거꾸로라 제대로 고친 것을 「아직 틀렸다」로 읽었다.
      //   **원점에서의 거리**로 재면 방향과 상관없이 맞는다:
      //   불이 몸통보다 **멀면** 코가 이쪽이다
      return {
        kind: o.name.replace('표적:', ''),
        fireBehind: fw.length() > ow.length(),
        body: +ow.length().toFixed(1), fire: +fw.length().toFixed(1),
      };
    }
    return null;
  },
  // ══ ★★★ v81 — **회수** (space-salvage.js · endtoend 가 읽는다) ══════
  get salvage() { return { ...salvSummary(salvage), seen: ship.outside.salvage?.seen ?? null }; },
  // ══ ★★★ v83 — **화물칸 · 들어온 목록** (space-cargo.js · endtoend) ══
  /**
   * ★★★ v100 — **발사관.** 검사(`space-mount.js`)와 계기가 읽는다.
   *   「동체는 돌아도 방향은 유지 · 타겟팅은 불안정」이 숫자로 여기 있다
   */
  get mount() {
    const a = aimedAt(sky, aimAz, aimEl);
    const rel = a ? { az: a.relAz, el: a.relEl } : null;
    return {
      ...mountSummary(mount, rel),
      /** 동체가 지금 초당 몇 도 도나 — 흔들림이 이것에 비례한다 */
      spin: +hullSpin.toFixed(1),
      word: mountWord(mount),
      cone: MOUNT.cone,
    };
  },
  /** ★★★ v99 — 아크 도약. 검사(`space-arc.js`)와 점검 모드가 읽는다 */
  get arc() {
    return {
      ...arcSummary(arcS),
      /** 지금 실려 있는 전지 · 한 번에 드는 수 */
      cells: cargo.items.arc ?? 0, need: ARC.cells,
      /** 왜 지금 못 뛰나 (없으면 null) — 화면이 이 한 줄을 쓴다 */
      blocked: whyNotJumpNow(),
    };
  },
  /** 검사가 전지를 실어 놓는다 — 회차를 다 돌지 않으려고 */
  putArc(n = ARC.cells) { cargoPut(cargo, { arc: n }); return cargo.items.arc ?? 0; },
  /** 검사가 J 를 누른 것과 같게 — 헤드리스에서 키가 안 먹는 자리가 있다 */
  jump() {
    const have = cargo.items.arc ?? 0;
    const r = beginCharge(arcS, {
      cells: have, sinkAt: sinkAt({ sink }), power: !!power.thrust,
      landed: land.step !== LSTEP.NONE,
    });
    if (r.ok) cargoTake(cargo, 'arc', ARC.cells);
    return r;
  },
  /** 검사가 축전기를 다 채워 놓는다 — 26초를 헤드리스로 안 센다 */
  // ★ 기본값이 `charge − 0.2` 였는데, 헤드리스 시계가 실제의 **1/20** 이라
  //   0.2 게임초를 채우는 데 실제 4초가 든다 — 검사가 기다리다 지쳤다.
  //   거의 끝까지 밀어 놓는다 (한 프레임이면 넘어간다)
  putCharge(t = ARC.charge - 0.01) { if (charging(arcS)) arcS.t = t; return arcSummary(arcS); },
  get cargo() { return { ...cargoSummary(cargo), word: holdWord(cargoUsed(cargo)) }; },
  /** 검사가 회수 방법을 골라 쓴다 */
  grab(way = 'net') {
    const a = noseAim();
    return fireNet(salvage, { az: a.az, el: a.el, seated: helmSat, way });
  },
  /** 검사가 그물을 쏜다 — G 를 헤드리스로 누르면 프레임을 탄다 */
  fireNet() {
    const a = noseAim();
    return fireNet(salvage, { az: a.az, el: a.el, seated: helmSat });
  },
  /** 검사가 꾸러미를 하나 떨군다 */
  putPack(kind = 'raider', dist = 60) {
    const t = { kind, az: aimAz, el: aimEl, dist };
    return dropPack(salvage, t, null);
  },
  /** ★ 잔해 — 「격추가 **보이나**」 */
  get wrecks() { return ship.outside.targets?.seen?.wrecks ?? 0; },
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
  get outside() {
    // ★★ v69 — **창밖에 정말 서 있나**를 같이 준다 (`space-endtoend.js [6c]`).
    //   v64 가 전투를 숫자로만 만들고 계통 검사는 다 초록이었던 것이
    //   여기 구멍이 없어서였다: 「보이나」를 물을 자리가 아예 없었다
    return {
      ...ship.outside.view,
      targets: ship.outside.targets?.seen ?? null,
      shots: ship.outside.shots?.seen ?? null,
    };
  },
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
  /** ★★ 승부수 (v68) — 무엇이 떠 있나 · 어느 손인가 · 얼마나 잡았나 */
  get gambit() { return gbSummary(gambit); },
  /** 검사가 승부수를 하나 띄워 놓는다 — `putLand`·`putGun` 과 같은 구멍 */
  putGambit(key) {
    const g = GAMBITS.find((x) => x.key === key);
    if (!g) return null;
    gambit.on = g; gambit.live = GAMBIT.live; gambit.held = 0;
    return gbSummary(gambit);
  },

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
      // ★★★ v88 — **밟는 순간의 밀림**(`KICK`). 「눈이 정말 뒤로 갔나」를
      //   화면 없이 묻는 자리다. 눈 자리도 같이 준다 — 값이 없으면
      //   `0 === 0` 으로 **초록을 찍는다** (v57 에 그러다 놓쳤다)
      kick: +kickT.toFixed(3),
      eye: { y: +camera.position.y.toFixed(3), z: +camera.position.z.toFixed(3) },
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
      // ★★ v73 — 사장님 「q 화면은 **조정간을 잡으면 없어지게**」.
      //   `fold` 만 내면 「접히는 중」과 「접혔다」가 안 갈린다 — 눈에
      //   보이나 아니냐를 묻는 것이므로 `shown`(three 의 visible)을 같이 낸다
      fold: wrist.fold, shown: !!wrist.group?.visible,
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
      ...pans.map((x) => x.hit), ship.winch.hit, ship.tradeHatch.hit, ship.cradle.hit, ship.cock.yokeHit,
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
      // ★ v99 — 구간 시계. 아크 도약이 **이것을 앞으로 민다**(건너뛴다).
      //   `progress` 만으로는 「얼마나 건너뛰었나」를 초로 못 잰다
      t: +route.t.toFixed(1), need: +(route.need ?? 0).toFixed(1),
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
  /**
   * ══ ★★★ v98 — **창밖의 저것과 계기의 저것이 같은 자리인가** ═══════════
   *
   *  ★ 사장님 「**화면에 보이는 물체와 레이더 표적이 나오는걸 왜 동일하게
   *    못 맞추는거지?**」 — 이 한 줄이 그 물음을 **숫자로** 만든 것이다.
   *
   *  ★★ 여태 이걸 못 물었다. 규칙 쪽(`aimedAt`·`radarBlips`)은 도구가
   *    읽을 수 있었지만 **3D 쪽은 못 읽었다** — 그래서 「둘이 같나」를
   *    물을 수가 없었고, 어긋난 것은 늘 사장님이 화면을 보시고 잡으셨다
   *    (v91 · v93 · v95 가 전부 그랬다).
   *
   *  ★★★ 여기는 **진짜 카메라와 진짜 메시**를 쓴다. 규칙이 준 각과
   *    카메라에서 실제로 보이는 각을 나란히 놓는다 — 어긋나면 그 수가
   *    곧 「상자와 실물 사이의 도(度)」다.
   *
   *  ★ 롤은 빼고 잰다: 판은 수평이고 **표식만** 돈다 (v95). 롤까지 넣어
   *    비교하면 안 어긋난 것도 어긋난 것처럼 나온다
   */
  align() {
    const T = ship.outside?.targets;
    if (!T?.posOf) return null;
    camera.updateMatrixWorld(true);
    T.group.updateMatrixWorld(true);
    // ★ HUD 가 쓰는 것과 **같은 롤**을 쓴다 — 다른 것을 쓰면 검사가
    //   화면과 다른 것을 재게 되고, 그건 v90 에 이미 한 번 밟은 함정이다
    const roll = (ship.outside.skyRoll ?? 0) + (noseOver ? Math.PI : 0);
    const cr = Math.cos(-roll), sr = Math.sin(-roll);
    const v = new THREE.Vector3();
    const rows = [];
    for (const t of sky.list) {
      const p = T.posOf(t.id);
      if (!p) continue;                       // 아직 안 세워졌다
      v.copy(p);
      T.group.localToWorld(v);
      camera.worldToLocal(v);
      // 판이 기운 만큼 되돌린다 — 표식만 도는 것이 규약이다
      const x = v.x * cr - v.y * sr, y = v.x * sr + v.y * cr, z = v.z;
      const dist = Math.hypot(x, y, z);
      const saw = {
        az: Math.atan2(x, -z) * 180 / Math.PI,
        el: Math.atan2(y, Math.hypot(x, z)) * 180 / Math.PI,
        dist,
      };
      const rule = relOf(t, { yaw: aimAz, pitch: aimEl });
      const dAz = ((saw.az - rule.az + 180) % 360 + 360) % 360 - 180;
      // ★★ **기수에서 벗어난 각은 롤과 상관이 없다.** 이 둘이 같은데
      //   az/el 만 다르면 그건 어긋난 것이 아니라 **판이 기운 것**이다 —
      //   둘을 안 가르면 멀쩡한 것을 고치려 들게 된다 (v95 에 그랬다)
      const sawOff = Math.atan2(Math.hypot(x, y), -z) * 180 / Math.PI;
      // ★★★ **표식을 몇 도 돌려야 실물에 얹히나** — HUD 가 쓰는 롤이
      //   정말 이 값인지 견줄 수 있어야 한다. `dOff` 가 0 인데 az/el 이
      //   다르면 남은 것은 이것 하나뿐이다
      const D = Math.PI / 180;
      const ruleAng = Math.atan2(Math.sin(rule.el * D),
        Math.sin(rule.az * D) * Math.cos(rule.el * D));
      const sawAng = Math.atan2(v.y, v.x);
      const need = ((sawAng - ruleAng) * 180 / Math.PI + 540) % 360 - 180;
      rows.push({
        needRoll: +need.toFixed(1),
        id: t.id, kind: t.kind,
        rule: { az: +rule.az.toFixed(2), el: +rule.el.toFixed(2), dist: +rule.dist.toFixed(1), off: +rule.off.toFixed(2) },
        saw: { az: +saw.az.toFixed(2), el: +saw.el.toFixed(2), dist: +saw.dist.toFixed(1), off: +sawOff.toFixed(2) },
        /** ★ 이 숫자가 곧 「상자와 실물 사이의 도」다 */
        off: +Math.hypot(dAz, saw.el - rule.el).toFixed(2),
        /** ★★ 롤을 뺀 어긋남 — 이것이 0 이 아니면 **정말로** 갈라진 것이다 */
        dOff: +(sawOff - rule.off).toFixed(2),
        dDist: +(saw.dist - rule.dist).toFixed(1),
      });
    }
    return {
      n: rows.length,
      worst: +Math.max(0, ...rows.map((r) => r.off)).toFixed(2),
      /** ★★★ 검사는 **이것**을 본다 — 롤은 표식이 도는 것으로 이미 맞춘다 */
      worstOff: +Math.max(0, ...rows.map((r) => Math.abs(r.dOff))).toFixed(2),
      /** ★★★ HUD 가 표식을 돌려야 하는 각 — `roll` 과 달라지면 상자가 헛돈다 */
      needRoll: rows.length ? rows[0].needRoll : 0,
      roll: +(roll * 180 / Math.PI).toFixed(1),
      camRoll: +(camera.rotation.z * 180 / Math.PI).toFixed(1),
      /**
       * ★★★ **눈과 원점 사이가 몇 m 인가** — v93 의 시차가 **남아 있나**.
       *   0 이 아니면 그 거리만큼 가까운 것이 어긋난다. 130m 짜리에
       *   3m 면 1.3도, 그게 곧 「상자 옆에 실물」이다
       */
      gap: (() => {
        const g = new THREE.Vector3(); T.group.getWorldPosition(g);
        return +g.distanceTo(camera.getWorldPosition(new THREE.Vector3())).toFixed(2);
      })(),
      rows,
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
  /**
   * ★★ v69 — **검사가 표적을 뒤로 보낸다.** 「뒤에 있는 것이 레이더에
   *   찍히나」를 물으려면 뒤에 하나 세워야 하는데, 흘러서 뒤로 갈 때까지
   *   기다리면 헤드리스로 몇 분이다 (시계가 실제의 1/20)
   */
  /**
   * ★★★ **거리를 밀어 놓는다** (v82).
   *   `SPACE.sky` 는 `skySummary` 가 만든 **복사본**이라 거기 대고
   *   `t.dist = 200` 을 해도 아무 일도 안 난다. v81 의 급가속 검사가
   *   그걸 모르고 복사본을 고치고 있었고, 그래서 「200 에서 시작」이라고
   *   적어 놓고 실제로는 **그 자리 그대로**를 재고 있었다.
   *   ★ 살아 있는 것을 만지는 구멍은 **따로 낸다** — 읽는 구멍과 쓰는
   *     구멍을 같은 이름으로 두면 이런 착각이 또 난다
   */
  putSkyDist(id, d) {
    const t = sky.list.find((x) => x.id === id);
    if (!t) return null;
    t.dist = d;
    return { id: t.id, dist: t.dist };
  },
  putSkyAz(id, az, el = 0) {
    const t = sky.list.find((x) => x.id === id);
    if (!t) return null;
    t.az = az; t.el = el;
    return { id: t.id, az: t.az, el: t.el, dist: t.dist };
  },
  /** ★ v69 — 상태창이 지금 켜져 있나 (앉으면 켜진다) */
  get statusOn() { return !!ship.statusHud?.mesh?.visible; },
  /** ★★★ v85 — **3D 그림이 들어왔나** — 「넣었는데 아무 일도 안 난다」를 막는다 */
  get models() { return modelLog(); },
  /** ★★★ v84 — **느려지는 시간.** 검사가 배율과 예산을 읽는다 */
  get slow() { return slowSummary(slowmo); },
  /** ★★★ v84 — **등대.** 말하는 몫 · 침묵 · 「어디가 잘못됐나」를 말했나 */
  get ai() { return aiSummary(ai); },
  aiSay(text, rank = 'tell') { return say(ai, text, rank); },
  /** ★★★ v84 — 지금 나를 맞힐 탄과 **빼야 할 쪽** */
  get threat() { return threat; },
  askSlow(who, sec = null) { return askSlow(slowmo, who, sec); },
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
      // ★★ v69 — **레이더가 아는 것.** 계기가 그리는 것과 **같은 목록**이다
      //   (`combat.js radarBlips`). 여기서 따로 만들면 「화면에는 있는데
      //   검사는 모르는」 점이 생기고, 그건 계기 둘이 갈라진 것이다
      // ★ v75 — **다시 재지 않는다.** 여기서 또 부르면 접근율이 0 이 되고,
      //   그러면 검사가 「접근율이 안 나온다」로 빨개진다 — 게임은 멀쩡한데
      blips: radarSeen,
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
  /**
   * ★★★ 탄두 (v71) — 검사와 점검 모드가 **같은 구멍**으로 본다.
   *   재료 다섯이 어디서 나오는지도 같이 준다 (`warhead-table.js PARTS5`)
   */
  get warhead() { return { ...headSummary(warhead), parts: PARTS5 }; },
  /** ★★★ 급가속 (v73) — 검사와 점검 모드가 같은 구멍으로 본다 */
  get boost() { return { ...boostSummary(boost), fov: +camera.fov.toFixed(1) }; },
  /** 검사가 급가속을 밀어 놓는다 — R 을 헤드리스로 오래 누르지 않으려고 */
  putBoost(k) { boost.k = Math.max(0, Math.min(1, k)); return boostSummary(boost); },
  /**
   * ★★★ v90 — **화면의 몇 %를 배가 막고 있나.**
   *
   *   사장님 「**왜 핸들하고 계기판이 아래에 나오지? 전투에 방해되잔아**」.
   *
   *   ★★ `space-view.js` 는 이때 **전부 ✔ 였고 「창이 화면의 92%」**라고
   *     찍고 있었다. 그런데 화면은 아래 절반이 콘솔이었다 — 그 도구가
   *     재는 것은 **유리 구멍의 각도**이지 **그 앞에 선 물건**이 아니다.
   *     「창이 크다」와 「밖이 보인다」는 다른 말인데 같은 값으로 읽고 있었다.
   *
   *   ★ 그래서 **눈에서 광선을 격자로 쏴서** 가까운 것(배 안)에 맞는 칸을
   *     센다. 이건 화면을 찍어 보는 것과 같은 것을 숫자로 만드는 일이다
   *
   * @returns 막힌 비율 · **아래에서 몇 %가 막혔나** · 화면 복판 가로줄의 막힘
   */
  /**
   * ★★★ v91 — **HUD 표식과 진짜 표적이 화면에서 몇 화소 어긋나나.**
   *
   *   사장님 「**왜 락온은 왼쪽인데 적은 우측 상단에 있지?**」
   *
   *   ★ 「부호는 머리로 맞히는 것이 아니라 화면에 점을 박고 재는 것」
   *     (v66·v73). 여기서는 **점 둘**을 박는다 — 3D 로 그린 적과,
   *     HUD 가 그린 표식. 둘이 같은 자리라야 조준경이다
   */
  hudGap(kind = null) {
    const g = ship.outside.targets?.group;
    const m = ship.sight?.mesh;
    if (!g || !m) return null;
    // ★ 이름이 아니라 **창밖 목록의 차례**로 찾는다 — 이름은 종류라
    //   같은 종류가 둘이면 엉뚱한 것을 잰다 (v73 에 그랬다)
    const t = kind ? sky.list.find((x) => x.kind === kind) : sky.list[0];
    if (!t) return { why: '그런 표적이 없다' };
    const o = g.children[sky.list.indexOf(t)];
    if (!o || !o.visible) return { why: '그 표적이 화면에 안 서 있다' };
    const W = globalThis.innerWidth, H = globalThis.innerHeight;
    const toPx = (v3) => {
      const q = v3.clone().project(camera);
      return { x: +((q.x * 0.5 + 0.5) * W).toFixed(1), y: +((0.5 - q.y * 0.5) * H).toFixed(1) };
    };
    const wp = new THREE.Vector3(); o.getWorldPosition(wp);
    const foe = toPx(wp);
    // HUD 판의 네 귀퉁이 → 화면 사각형. **판이 화면에서 얼마나 큰가**가
    // 곧 「도 → 화소」의 진짜 값이다 (그림이 쓰는 값과 견준다)
    m.updateMatrixWorld();
    const hw = HUDV.w / 2, hh = HUDV.h / 2;
    const c0 = toPx(m.localToWorld(new THREE.Vector3(-hw, -hh, 0)));
    const c1 = toPx(m.localToWorld(new THREE.Vector3(hw, hh, 0)));
    const mid = { x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2 };
    // 그림이 쓰는 각 (`hudFov`) 로 표식이 놓이는 자리
    const a = noseAim();
    const raz = ((t.az - a.az) % 360 + 540) % 360 - 180;
    const rel = t.el - a.el;
    // ★★ **판의 제 좌표로 놓는다.** 처음엔 화면 x·y 로 놓았는데, v91 에서
    //   판이 하늘을 따라 굴게 되자 **판의 가로축이 화면 가로축이 아니게**
    //   됐다 — 그 상태로 재면 고쳐 놓고도 어긋난 것으로 나온다.
    //   그림(`gunsight.js`)이 하는 것과 **같은 식**이라야 잰 것이 된다
    const F = hudFov();
    // ★ 그림과 **같은 식**(tan)이라야 잰 것이 된다 — v91
    // ★ v95 — 그림과 **같은 식**이라야 잰 것이 된다: 판은 수평이고
    //   표식만 롤만큼 돈다 (`gunsight.js` 와 짝)
    const R = Math.PI / 180;
    const ux = (HUDV.w / 2) * Math.tan(raz * R) / Math.tan((F.h / 2) * R);
    const uy = (HUDV.h / 2) * Math.tan(rel * R) / Math.tan((F.v / 2) * R);
    const rr = ship.outside.skyRoll ?? 0;
    const mark = toPx(m.localToWorld(new THREE.Vector3(
      ux * Math.cos(rr) - uy * Math.sin(rr),
      ux * Math.sin(rr) + uy * Math.cos(rr),
      0,
    )));
    return {
      foe, mark, mid,
      gap: { x: +(mark.x - foe.x).toFixed(1), y: +(mark.y - foe.y).toFixed(1) },
      rel: { az: +raz.toFixed(2), el: +rel.toFixed(2) },
      plate: { w: +(c1.x - c0.x).toFixed(1), h: +(c0.y - c1.y).toFixed(1) },
      // ★★★ v94 — **그려진 물체가 몇 도에 있나** vs **표가 아는 각**.
      //   둘이 다르면 「보이는 것」과 「레이더가 아는 것」이 갈라진 것이다
      drawnAt: (() => {
        const v = wp.clone();
        // 눈 기준 · 기수 기준으로 각을 되뽑는다
        const inv = camera.matrixWorldInverse.clone();
        const local = v.applyMatrix4(inv);
        return {
          az: +(Math.atan2(local.x, -local.z) * 180 / Math.PI).toFixed(2),
          el: +(Math.atan2(local.y, Math.hypot(local.x, local.z)) * 180 / Math.PI).toFixed(2),
          dist: +local.length().toFixed(1),
        };
      })(),
      tableAt: { az: +t.az.toFixed(2), el: +t.el.toFixed(2), dist: +t.dist.toFixed(1) },
      fovDrawn: F,
      eyeToPlate: +(camera.position.z - m.position.z).toFixed(3),
      plateDist: HUDV.dist,
    };
  },
  /** ★ 화면 아래쪽 다섯 점이 **무엇에** 막히나 — 이름·부모·높이까지 */
  blockedAt(ys = [-0.35, -0.5, -0.65, -0.8, -0.95], xs = [-0.5, 0, 0.5]) {
    const ray = new THREE.Raycaster();
    const v = new THREE.Vector2();
    const out = [];
    const seeThru = (o) => {
      const m = o.material; const one = Array.isArray(m) ? m[0] : m;
      if (!one || one.visible === false) return true;
      return !!(one.transparent && (one.opacity ?? 1) < 0.6);
    };
    for (const y of ys) for (const x of xs) {
      v.set(x, y);
      ray.setFromCamera(v, camera);
      const h = ray.intersectObject(ship.group, true)
        .find((q) => q.distance > 0.02 && q.object.visible && !seeThru(q.object));
      if (!h) { out.push({ x, y, hit: null }); continue; }
      const chain = [];
      for (let o = h.object; o; o = o.parent) chain.push(o.name || o.type);
      const wp = new THREE.Vector3(); h.object.getWorldPosition(wp);
      const g = h.object.geometry;
      out.push({ x, y, d: +h.distance.toFixed(2),
        at: [+h.point.x.toFixed(2), +h.point.y.toFixed(2), +h.point.z.toFixed(2)],
        obj: [+wp.x.toFixed(2), +wp.y.toFixed(2), +wp.z.toFixed(2)],
        geo: g?.type, par: g?.parameters ? Object.entries(g.parameters).slice(0, 4) : null,
        mat: (Array.isArray(h.object.material) ? h.object.material[0] : h.object.material)?.color?.getHexString?.(),
        chain: chain.slice(0, 5) });
    }
    return out;
  },
  blocked(cols = 33, rows = 21, near = 4) {
    const ray = new THREE.Raycaster();
    const v = new THREE.Vector2();
    let hit = 0, n = 0;
    /** 세로 칸마다 몇 개나 막혔나 — 위에서 아래로 */
    const byRow = [];
    // ★★ **무엇이 막는지도 센다.** 「아래가 막혔다」까지는 숫자로 나오는데
    //   **무엇을 내려야 하는지**는 안 나온다 — 그러면 또 짐작으로 값을 만진다
    const who = {};
    for (let r = 0; r < rows; r++) {
      let rowHit = 0;
      for (let c = 0; c < cols; c++) {
        v.set((c / (cols - 1)) * 2 - 1, 1 - (r / (rows - 1)) * 2);
        ray.setFromCamera(v, camera);
        const hits = ray.intersectObject(ship.group, true);
        // ★★ **유리는 막은 것이 아니다.** 처음에 안 걸렀더니 스물한 줄이
        //   전부 1.00 으로 나왔다 — 캐노피가 눈에서 0.88m 라 어느 쪽을
        //   봐도 먼저 맞는다. 「보이나」를 재는데 창을 막힘으로 세면
        //   답이 늘 「다 막혔다」다
        // ★★★ **안 보이는 것은 막은 것이 아니다.** 처음에 이걸 안 걸러서
        //   「화면 아래 29%가 막혔다」가 나왔는데, 범인이 조종간의 **조준
        //   판정 상자**(0.86 × 0.56 · `visible: false` 인 재질)였다.
        //   눈에 안 보이는 상자를 「가림막」이라 부르고 값을 만질 뻔했다 —
        //   **재는 것이 화면과 다르면 그 숫자로 고치면 안 된다**
        const seeThru = (o) => {
          const m = o.material;
          const one = Array.isArray(m) ? m[0] : m;
          if (!one || one.visible === false) return true;
          return !!(one.transparent && (one.opacity ?? 1) < 0.6);
        };
        const first = hits.find((h) => h.distance > 0.02 && h.object.visible && !seeThru(h.object));
        if (first && first.distance < near) {
          hit++; rowHit++;
          let nm = first.object.name;
          for (let o = first.object; o && !nm; o = o.parent) nm = o.name;
          who[nm || '(이름 없음)'] = (who[nm || '(이름 없음)'] ?? 0) + 1;
        }
        n++;
      }
      byRow.push(+(rowHit / cols).toFixed(2));
    }
    // 아래에서부터 **연달아 막힌** 줄이 몇 개인가 — 이게 「아래가 먹혔다」다
    let solid = 0;
    for (let r = rows - 1; r >= 0; r--) { if (byRow[r] > 0.6) solid++; else break; }
    return {
      all: +(hit / n).toFixed(3),
      bottom: +(solid / rows).toFixed(3),
      mid: byRow[(rows - 1) >> 1],
      byRow,
      who: Object.entries(who).sort((a, c) => c[1] - a[1]).slice(0, 8),
    };
  },
  /**
   * ★★★ **표적이 화면 어디에 찍히나** (v73) — 부호를 재는 유일한 길.
   *
   *   「세 축의 부호는 머리로 맞히는 것이 아니라 **화면에 점을 박고 재는
   *   것**이다」 (v66 에 좌우가 반대였을 때 배운 것). 그때는 그때만 쓰고
   *   지웠는데, v73 에 **위아래가 또 반대**로 나왔다 — 그러면 이건
   *   한 번 쓰고 버릴 것이 아니라 **계기**다. 남겨 둔다.
   *
   * @returns { x, y } 화면 복판이 (0,0) · 오른쪽 +x · **위쪽 +y**
   */
  screenOf(kind = null) {
    const g = ship.outside.targets?.group;
    if (!g) return null;
    // ★★ 처음엔 「첫 번째 표적」을 잡았는데, 하늘에는 **파편이 늘 셋** 떠
    //   있어서 엉뚱한 것을 재고 있었다 — 값이 안 움직여서 알았다.
    //   종류를 말할 수 있어야 재는 것이 재려던 것이 된다
    const want = kind ? `표적:${kind}` : null;
    const o = want ? g.children.find((c) => c.name === want)
      : g.children.find((c) => c.name?.startsWith('표적:'));
    if (!o) return null;
    const v = new THREE.Vector3();
    o.getWorldPosition(v);
    v.project(camera);
    return { x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(2) };
  },
  /** ★ 크레이들이 **화면에** 무엇을 그리고 있나 — 「불이 켜졌나」는 여기서만 나온다 */
  get headSeen() { return ship.cradle?.seen ?? null; },
  /** 검사가 재료를 손에 쥐어 준다 — 구간 다섯을 다 돌 수는 없다 */
  giveHeadPart(key) { return headPick(warhead, key); },
  /** ★ v93 — 검사가 다섯을 다 꽂아 놓는다. 2시간을 걷지 않으려고 */
  fillHead(n = PARTS5.length) {
    warhead.in = PARTS5.slice(0, n).map((p) => p.key);
    warhead.carrying = null;
    return headSummary(warhead);
  },
  /** ★ 검사가 무장한다 — **게임과 같은 길로** (`holdArm` 을 9초 잡는다) */
  armHead() {
    for (let i = 0; i < 400 && !warhead.armed; i++) holdArm(warhead, 0.05, { holding: true });
    return headSummary(warhead);
  },
  /** 검사가 곧장 꽂는다 */
  putHeadPart(key) {
    if (headPick(warhead, key) || warhead.carrying === key) {
      warhead.carrying = key;
      warhead.in.push(key);
      warhead.carrying = null;
    }
    return headSummary(warhead);
  },
  /** 검사가 탄두를 데워 본다 */
  setBake(v) { warhead.bake = v; return headSummary(warhead); },
  /** 떨군다 — 결말이 나온다 */
  dropHead() { return headDrop(warhead); },
  /**
   * ★★ v75 — **적이 나를 겨누게 해 본다** (RWR 검사용).
   *
   *   적은 겨눔을 쌓고 나서 쏘는데(`ENEMY_FIRE.every` 3.4초), 헤드리스
   *   시계가 실제의 1/20 이라 **한 발을 보려면 27초**다. 그동안 화면이
   *   맞는지 못 본다 — v74 에 「검사가 만들 수 없는 상황을 기다리고
   *   있었다」로 한 번 데었으므로 구멍을 낸다.
   *
   * @param k 0~1 — 얼마나 겨눴나 (1 이면 곧 쏜다)
   */
  putFoeAim(k = 1, id = null) {
    const list = id === null ? sky.list : sky.list.filter((t) => t.id === id);
    for (const t of list) if (TKINDS[t.kind]?.shoots) t.aim = ENEMY_FIRE.every * k;
    return list.length;
  },
  /**
   * ★★★ **손 닿는 것 전부와 그 자리** (v76 · `tools/space-reach.js`).
   *
   *   사장님 「**미사일 뒤에 냉각벨브가 있어서 작동을 못해.** 전체적으로
   *   다시 설계해」 — 재 보니 **밸브를 어디서도 못 잡았다.** v71 에 탄두
   *   크레이들을 기관실 후미 벽 한가운데 세웠는데, **거기 이미 밸브가
   *   있었다** (밸브 z 15.70 · 크레이들 z 15.40 · 둘 다 x 0).
   *
   *   ★★ 그리고 **아무 검사도 안 울었다.** `space-endtoend [6e]①` 은
   *     오히려 「크레이들이 손에 닿는다」로 **가린 쪽을 확인**하고 있었다.
   *     자리를 코드에 흩어 놓으면 이런 일이 조용히 난다 — 그래서 자리를
   *     **밖으로 낸다.** 도구가 「누가 누구를 가리나」를 잰다.
   *
   * @returns [{ name, x, y, z, r }] — r 은 판정 상자의 대략 반지름
   */
  get handSpots() {
    const out = [];
    const v = new THREE.Vector3();
    const box = new THREE.Box3();
    const add = (name, o) => {
      if (!o) return;
      o.getWorldPosition(v);
      box.setFromObject(o);
      const s = box.getSize(new THREE.Vector3());
      out.push({
        name,
        x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(2),
        r: +(Math.max(s.x, s.z) / 2).toFixed(2),
      });
    };
    add('valve', ship.valve);
    add('cradle', ship.cradle.hit);
    add('winch', ship.winch.hit);
    add('tradeHatch', ship.tradeHatch.hit);
    add('outerDoor', ship.outerDoor.hit);
    add('radio', ship.radio.hit);
    add('mainBreaker', ship.mainBreaker.hit);
    add('suitRack', ship.suitRack?.hit);
    add('yoke', ship.cock.yokeHit);
    add('helmseat', ship.cock.helmSeatHit);
    add('autopilot', ship.cock.autoHit);
    add('throttle', ship.cock.thrHit);
    ship.breakers.forEach((b, i) => add(`breaker${i}`, b.hit));
    ship.cock.plates.forEach((p, i) => add(`chart${i}`, p.hit));
    Object.entries(ship.panels).forEach(([k, p]) => add(`panel:${k}`, p.hit));
    ship.doors.forEach((d, i) => add(`crank${i}`, d.view.hit));
    return out;
  },
  /** ★ 검사가 절과 절 사이를 깨끗이 한다 — 적을 다 치운다 */
  clearSky() { sky.list = []; sky.incoming = []; return skySummary(sky); },
  /**
   * ★★ v70 — **적 종류를 골라 부른다.** 검사와 점검 모드가 다섯을 나란히
   *   세워 놓고 「실루엣이 서로 다른가」를 눈으로 본다. 저절로 오기를
   *   기다리면 한 종류를 보는 데만 몇 분이다
   */
  callFoe(kind = 'raider', az = null, dist = null) {
    const t = spawnFoe(sky, kind);
    if (!t) return null;
    if (az !== null) t.az = az;
    if (dist !== null) t.dist = dist;
    return { id: t.id, kind: t.kind, az: +t.az.toFixed(1), dist: +t.dist.toFixed(0), hp: t.hp };
  },
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
    // ★★ v88 — **앉는 것이 곧 잡는 것이다.** 여기서 `yokeHeld` 를 같이
    //   안 켜면 검사만 「앉았는데 안 잡은」 상태를 만들 수 있고, 그건
    //   게임에 이제 없는 상태다 — 검사가 없는 것을 재게 된다
    yokeHeld = !!up;
    const at = up ? HELM_SEAT.seatAt : HELM_SEAT.standAt;
    me.x = at.x; me.z = at.z;
    // ★ 앉으면 시선을 **안 내린다** (v88) — 앉는 것이 곧 잡는 것이므로
    //   처음부터 창을 본다
    me.pitch = 0;
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
  /**
   * ★★★ v76 — **정전을 만들어 본다.**
   *
   *   `tools/space-reach.js` 가 「큰 차단기가 손에 닿나」를 물었을 때
   *   **어디서도 안 잡힌다**고 나왔다. 가려진 줄 알고 자리를 옮길 뻔했는데,
   *   재 보니 `onMain = canResetDark(dark)` — **정전일 때만 잡히는 것이
   *   맞다.** 광선은 닿고 있었고 상황이 아니었을 뿐이다.
   *
   *   ★★ 즉 **감사가 상황을 안 만들고 물었다.** 이 저장소에서 같은 병이
   *     이번 판만 두 번째다 (v74 `setBake` 도 만들 수 없는 상황을
   *     기다리고 있었다). 그래서 **만들 수 있게** 구멍을 낸다
   */
  goDark() { killPower(dark); return darkSummary(dark); },
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
  /**
   * ★ v99 — 구간 **한복판**에 세워 놓는다.
   *   `seekLegEnd` 는 끝에 세우므로 **건너뛰기를 잴 수가 없다** (앞으로
   *   밀어도 need 에서 잘린다). 아크 도약을 재려면 가운데가 필요하다
   */
  putLegT(t = 0) { route.t = Math.max(0, Math.min(route.need, t)); return { t: route.t, need: route.need }; },
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
  /** ★ v74 — 표가 「안 들린다」고 적어 둔 것들. 검사가 이 목록을 읽는다 */
  get silentList() { return SILENT; },
  /**
   * ★★ v74 — **게임이 정말 그 소리를 부르나**를 엿듣는다.
   *
   *   소리를 만들어 놓고 **아무도 안 부르는** 것이 이 저장소가 제일 자주
   *   밟는 함정이다 — 안 나도 화면에 아무 표시가 없어서 조용히 지나간다.
   *   그래서 표(났나)와 게임(부르나)을 **따로** 묻는다.
   *
   * @param sink 배열을 주면 그때부터 이름을 담는다. null 이면 그만둔다
   */
  audioSpy(sink) { audioSeen = Array.isArray(sink) ? sink : null; return !!audioSeen; },
  /** 검사가 한 방 맞아 본다 — 적을 불러 27초를 기다리지 않으려고 */
  hitMe(where = 'flank') {
    const w = HITS.find((h) => h.key === where) ?? HITS[0];
    takeHits([{ where: w, punch: 1, fault: null }]);
    return { where: w.key, hull: +faults.wear.hull.toFixed(3) };
  },
  /**
   * ★★★ **소리 하나를 떼어 내 파형으로 잰다** (v74).
   *
   *   `auditEscape` 와 **같은 방법**이다 — 게임이 실제로 쓰는
   *   `core/audio.js` 를 `OfflineAudioContext` 에 태워 크기를 센다.
   *   검사용으로 따로 짜서 재면 「검사는 통과하는데 게임은 안 나는」
   *   상태가 생긴다 (`space-audio.js` 머리말).
   *
   *   ★ 진공 규칙이 이 구멍으로 검사된다: **밖에서 나는 것은 이름조차
   *     없어야 하고, 선체를 때린 것은 파형이 서야 한다.**
   *
   * @returns { peak, rms, tail } — tail 은 **배가 우는 길이**(초).
   *   그게 「선체를 타고 왔다」의 정체라 따로 잰다
   */
  async auditOne(name, { len = 3, step = 0.05 } = {}) {
    const sr = 12000;
    // ══ ★★★ **배경을 빼고 잰다** ═══════════════════════════════════════
    //
    //  ★ 처음엔 그냥 한 번 태워서 쟀는데 **소리 다섯이 전부 「2.95초」**로
    //    나왔다. `makeAudio()` 는 켜지는 순간 배의 웅웅거림을 시작하므로
    //    3초를 통째로 재면 **재는 것이 늘 배경**이었다 — 「소리가 났다」도
    //    「셋이 다르다」도 전부 웅웅거림을 두고 한 말이었던 셈이다.
    //
    //  ★★ 그래서 **두 번 태워서 뺀다**: 아무 일도 안 일어난 판과 소리를
    //    한 번 낸 판. 차이가 곧 그 소리다. 배경을 끄는 방법도 있지만,
    //    그러면 **게임이 실제로 쓰는 것과 다른 상태**를 재게 된다
    //    (`space-audio.js` 머리말: 검사용으로 따로 짜서 재면 검사는
    //    통과하는데 게임은 안 나는 상태가 생긴다).
    const render = async (ev) => {
      const off = new OfflineAudioContext(1, Math.ceil(sr * len), sr);
      const a = makeAudio(off);
      if (ev) a.event(ev, 0.05);
      const buf = await off.startRendering();
      const d = buf.getChannelData(0);
      const n = Math.floor(sr * step);
      const out = [];
      for (let i = 0; i + n <= d.length; i += n) {
        let s = 0;
        for (let j = 0; j < n; j++) s += d[i + j] * d[i + j];
        out.push(Math.sqrt(s / n));
      }
      return out;
    };
    const [base, got] = await Promise.all([render(null), render(name)]);
    const rms = got.map((v, i) => +Math.max(0, v - (base[i] ?? 0)).toFixed(5));
    const peak = Math.max(...rms);
    // ══ ★★ **바닥 잡음을 빼고 나서 우는 길이를 잰다** ═══════════════════
    //
    //  ★ 빼기만 해서는 안 됐다. 배경에는 **잡음**(공기 순환)이 섞여 있고
    //    잡음은 태울 때마다 달라서, 두 판을 빼도 **깨끗한 0 이 안 된다.**
    //    그 찌꺼기를 「아직 울고 있다」로 세는 바람에 **소리 다섯이 전부
    //    2.9초**로 나왔다 — 크기는 제대로 갈리는데 길이만 다 같았다.
    //
    //  ★★ 그래서 **뒤쪽 20%의 중앙값**을 바닥으로 잡는다. 거기는 어떤
    //    소리든 이미 끝난 자리라 남은 것은 찌꺼기뿐이고, 그 몇 배를 넘는
    //    동안만 「울고 있다」로 센다
    const tailPart = rms.slice(Math.floor(rms.length * 0.8)).slice().sort((a, z) => a - z);
    const floor = tailPart[Math.floor(tailPart.length / 2)] ?? 0;
    const gate = Math.max(peak * 0.05, floor * 4, 1e-4);
    let last = 0;
    rms.forEach((v, i) => { if (v > gate) last = i; });
    return {
      step, peak: +peak.toFixed(5), rms,
      floor: +floor.toFixed(5),
      tail: +(last * step).toFixed(2),
    };
  },
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
    say(ai, `이어합니다 — ${back.text}`, 'tell');
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
  //
  // ══ ★★★ v84 — **슬로우도 같은 자리에서 건다** ═══════════════════════
  //  멈춤을 `dt = 0` 한 줄로 둔 것과 **똑같은 이유**다: 계통마다 「지금
  //  느린가」를 묻게 하면 반드시 하나를 빠뜨리고, 빠뜨린 그 하나만
  //  제 속도로 돌아 화면이 어긋난다. 여기 한 줄을 통과시키면 아래가
  //  전부 같이 느려진다.
  //  ★ `slowK` 는 **화면·소리**가 읽는다 (가장자리 물듦 · 낮아지는 소리)
  const slowed = stepSlow(slowmo, paused ? 0 : dt0);
  const slowK = slowed.k;
  const dt = paused ? 0 : slowed.dt;
  clock += dt;

  // ★ 멈췄으면 **쌓인 마우스도 버린다.** `takeLook()` 은 지난 움직임을
  //   모아 뒀다 돌려주므로, 그냥 두면 계속하는 순간 그동안 움직인 만큼
  //   시선이 홱 돌아간다. dt 를 0 으로 만드는 것만으로는 안 막힌다
  const look = paused ? (input.takeLook(), { dx: 0, dy: 0 }) : input.takeLook();
  // ★ 조종간을 잡고 있으면 마우스가 **시선이 아니라 배**를 움직인다.
  //   `steering` 은 지난 프레임의 판정이라 한 프레임 늦는다 — 조준은
  //   interactStep 에서 나오고 그건 이 아래에서 돈다. 16ms 라 안 느껴진다.
  // ══ ★★★ v88 — **마우스 오른쪽을 누르고 있으면 고개만 돌린다** ═══════
  //
  //  ★ 앉으면 마우스가 조종간이 되므로 시선이 정면에 못박힌다. 재 보니
  //    조종석에서 **아무것도 조준선에 안 걸렸다** — 갈래 판(항로) · 추력
  //    레버 · 자동 항법 전부. 즉 **앉으면 배를 출발시킬 수가 없었다.**
  //    `space-endtoend [0]` 이 「갈래 판을 잡는다 (null)」로 우는 것이 이것이고,
  //    v88 에서 앉기=잡기가 되면서 「일어나서 누르면 된다」도 없어졌다.
  //  ★★ 그래서 **누르고 있는 동안만** 스틱을 놓고 고개를 돌린다.
  //    새 상태를 안 만든다 — 손을 떼면 곧바로 조종간이다. 실제 조종사도
  //    계기를 볼 때 고개를 돌리지 조종간을 놓지 않는다
  // ★★★ v94 — **둘러보기는 C** (벤치마크: 오른쪽 단추는 셋 다 보조 무기다).
  //   v90 에 오른쪽 단추로 냈던 것을 옮긴다 — 실제 시뮬의 free-look 도
  //   보통 따로 난 키이지 발사 단추가 아니다
  const freeLook = steering && input.keys.has('KeyC');
  if (steering && !freeLook) {
    // ══ ★★★ **가상 조종간** — 마우스+키보드 비행 시뮬의 정석 (v80) ══
    //
    //  ★ 사장님 「마우스와 키보드로 비행 전투 시뮬레이션에서는 **어떤
    //    조작이 정석인지 확인하고 적용**해줘」.
    //    Elite Dangerous · Star Citizen 계열이 공통으로 쓰는 얼개다:
    //    **마우스 = 피치+요 · Q/E = 롤 · W/S = 추력**, 그리고
    //    **relative mouse** — 마우스가 스틱을 밀고 손을 멈추면 천천히 중앙으로.
    //
    //  ★★★ **그리고 이것이 v79 「너무 느려」의 진짜 원인이었다.**
    //    여태 `look.dx * 0.03` 이었는데 그건 **그 프레임에 움직인 화소**다 —
    //    즉 마우스를 멈추는 순간 조종간이 저절로 가운데로 튄다.
    //    느린 것이 아니라 **붙잡고 있을 수가 없었다.** 감도를 올렸어도
    //    똑같았을 것이다 (포스트모템 §1-④).
    stick.x = Math.max(-1, Math.min(1, stick.x + look.dx * STICK.gain));
    stick.y = Math.max(-1, Math.min(1, stick.y + look.dy * STICK.gain));
    // 손을 멈추면 **천천히** 가운데로 — 미는 것보다 훨씬 느리므로
    // 밀고 있는 동안에는 안 밀린다
    const back = STICK.center * dt;
    stick.x -= Math.sign(stick.x) * Math.min(Math.abs(stick.x), back);
    stick.y -= Math.sign(stick.y) * Math.min(Math.abs(stick.y), back);

    steerPush = deflect(stick.x);
    flyPush.yaw = steerPush;
    // ★ 화면 위가 「기수를 든다」다 — 마우스를 위로 밀면 올라간다
    //   (비행 시뮬의 「스틱을 당긴다」와 반대 부호다. 마우스는 조준기라
    //    화면을 따라가는 편이 훨씬 익다 — Elite 도 기본이 이쪽이다)
    flyPush.pitch = -deflect(stick.y);
    flyPush.roll = (input.keys.has('KeyE') ? 1 : 0) - (input.keys.has('KeyQ') ? 1 : 0);

    // ══ ★★ **W/S = 추력** — 정석으로 되돌린다 (v80) ═══════════════
    //  v79 에 W/S 를 피치에 붙였던 것은 **느린 원인을 잘못 짚어서**였다.
    //  스틱이 자리를 들고 있게 되었으므로 키가 필요 없어졌고,
    //  W/S 는 이 장르에서 **추력**의 자리다.
    //  ★ 누르는 동안이 아니라 **누른 순간** 한 번 — 이 배의 추력은
    //    차단기·레버라 켜고 끄는 물건이다 (`space-helm.js` 규약)
    // ══ ★★★ v86 — **W/S 가 상하다** (사장님 「**키보드 WS로 상하 조정**
    //  되게 하라고」 · 「왜 조정석으로 상하 방향 조정이 안되냐고」) ═══════
    //
    //  ★ v80 에 W/S 를 **추력**으로 옮겼다 — 마우스+키보드 비행 시뮬의
    //    정석이 그렇기 때문이었다. 그런데 이 배는 **마우스가 조준이자
    //    조종**이라 위아래를 마우스로만 하면 손목이 짧게 움직여야 하고,
    //    사장님이 세 판에 걸쳐 「상하가 안 된다」고 하셨다.
    //    **정석보다 사장님 손이 먼저다.**
    //  ★★ 추력은 **Space** 로 간다 — 비어 있고, 비행 게임에서 흔한 자리다.
    //    ★ 마우스 위아래는 **그대로 산다** — 둘 다 먹는다
    // ══ ★★★ v100 — **W/S 는 전진·후진이다** (사장님 「w, s 키는 상하좌우가
    //  아닌 **전진 후진**으로 바꿔줘. **마우스는 방향 이동은 그대로 유지**하고」)
    //
    //  ★ v86 에 W/S 를 **상하**로 뒀다 (「키보드 WS로 상하 조정」). 그때는
    //    맞았다 — 마우스가 조준이자 조종이라 위아래를 마우스로만 하면
    //    손목이 짧게 움직여야 했다. 그런데 v100 에 **발사관이 표적을
    //    따라가게** 되면서 마우스가 조준을 겸할 필요가 없어졌다:
    //    마우스는 **동체 방향**만 맡고, 조준은 발사관이 한다.
    //    그래서 W/S 가 상하에서 풀려나 **추력**으로 돌아갈 수 있게 됐다.
    //
    //  ★★ **위아래는 마우스에 그대로 산다** — 사장님이 「마우스는 방향
    //    이동은 그대로 유지」라고 하셨고, 그것이 v86 에서 지키려던 것이다.
    //    없앤 것이 아니라 **키에서만 뗐다**
    //
    //  ★ 이 배에 **역추진은 없다.** S 는 추력을 끄는 것이고, 그러면
    //    타성으로 느려진다 (`LEG.coast`). 없는 것을 있는 척하지 않는다
    if (input.keys.has('KeyW')) { if (!fwdHeld) { setThrustKey(true); fwdHeld = true; } }
    else if (input.keys.has('KeyS')) { if (!fwdHeld) { setThrustKey(false); fwdHeld = true; } }
    else fwdHeld = false;
    // ★★★ v88 — **A/D 는 좌우다.** 여태 「일어난다」였다 (v52 에 좌석에
    //   갇힌 적이 있어 비상구로 둔 것). 그런데 v88 에서 앉는 것이 곧 잡는
    //   것이 되고 나가는 길이 **X 와 좌석 다시 누르기 둘**로 분명해졌으므로,
    //   비상구를 여기 겹쳐 둘 이유가 없어졌다. 그리고 W/S 만 키가 있고
    //   A/D 가 없으면 **왼손이 반쪽**이라 「적을 쫓을 수가 없다」가 된다
    const kSide = (input.keys.has('KeyD') ? 1 : 0) - (input.keys.has('KeyA') ? 1 : 0);
    if (kSide !== 0) { flyPush.yaw = kSide; steerPush = kSide; }
    if (input.keys.has('Space')) { if (!thrustHeldKey) { setThrustKey(!power.thrust); thrustHeldKey = true; } }
    else thrustHeldKey = false;
  } else {
    steerPush = 0;
    // ★★ v88 — **둘러보는 동안에는 스틱을 안 지운다.** 지우면 손을 떼는
    //   순간 배가 홱 펴져서, 계기를 한 번 볼 때마다 항로가 틀어진다.
    //   ★ 키(W/S/A/D)는 그대로 먹는다 — 고개와 손은 다른 것이다
    if (!freeLook) {
      // ★ 놓으면 **스틱도 가운데로 돌아간다** — 안 그러면 다시 잡는 순간
      //   지난번에 밀어 둔 만큼이 그대로 먹는다
      stick.x = 0; stick.y = 0;
      flyPush.pitch = 0; flyPush.yaw = 0; flyPush.roll = 0;
    }
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
    say(ai, RESCUE.heard, 'tell');
    audio?.event('fault');
  }
  // ★ 대응 시계가 다 됐는데 아직 응답 안 했으면 **지나친 것이다.**
  //   조용히 영원히 기다리면 장면이 안 끝나고, 안 끝나는 장면은 멈춘 게임이다
  if (scenes.overdue && scenes.keys.includes('G') && !rescueDone(rescue)) {
    if (passSignal(rescue)) { say(ai, RESCUE.passed, 'tell'); }
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
    say(ai, DARK.hit, 'tell');
    audio?.event('fault');
  }
  // ★ 대응 시계가 다 됐는데 아직 안 올렸으면 **저절로 돌아온다.**
  //   장면이 안 끝나면 배가 영영 어둡고, 그건 긴장이 아니라 멈춘 게임이다
  if (scenes.overdue && scenes.keys.includes('E') && !darkDone(dark)) {
    dark.step = DSTEP.BACK;
    say(ai, DARK.back, 'tell');
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
    say(ai, forever ? '자세 제어가 나갔습니다 — 예비가 없습니다' : '자세 제어가 나갔습니다', 'warn');
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
      say(ai, '기밀 경보 — 어딘가 벽이 뚫렸습니다', 'warn');
      // ★★ v74 — **미소운석은 스치는 소리다** (`HULL.graze`). 높고 짧다.
      //   벽을 뚫은 것은 티끌이지 포탄이 아니므로 배가 크게 안 운다 —
      //   그런데 **결과는 제일 크다**. 그 어긋남이 이 장면의 무서움이다
      audio?.event('hullGraze');
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
      say(ai, '더는 안 보입니다', 'tell');
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
        say(ai, o.lead, 'tell');
        audio?.event('fault');
      }
    }
  }

  if (sev === 'warn') {
    // ★ **무엇이 오는지만 말한다. 어디가 잘못됐나는 안 가르친다** (PLAN §3-1)
    const lead = leadOf(scenes);
    if (lead) { say(ai, lead, 'tell'); audio?.event('fault'); }
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
    say(ai, '거점을 지나쳤습니다 — 항로로 돌아옵니다', 'tell');
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
    say(ai, `거점 — 남은 ${legsLeft(route)}`, 'tell');
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
    say(ai, '따라잡혔습니다 — 그물이 닫혔습니다', 'tell');
    if (chase.phase === PHASE.CALM) chase.risk = 200;
  }
  // ══ ★★★ **마지막 구간에 들어섰다** — 적 행성 상공 ═══════════════════
  //
  //  ★ v98 까지 여기가 **8판의 성간 공백** 그대로였다: 쫓아오던 것을
  //    풀어 주고(`SHAKEN`), 위험을 0 으로 만들고, **「뿌리쳤다」 소리까지**
  //    냈다. 목적이 「따라오지 못하는 곳까지 간다」였을 때는 맞는 동작이다.
  //
  //  ★★ 그런데 목적이 v93 에 **「적 행성에 떨군다」로 뒤집혔다.** 그래서
  //    같은 순간에 두 가지가 동시에 일어나고 있었다:
  //
  //      투하가 말한다 — 「적 행성 상공입니다 — **방공이 두껍습니다**」
  //      여기가 말한다 — 「성간 공백 — **더는 아무도 따라오지 않습니다**」
  //
  //    그리고 실제로 추격을 **풀어 줬다.** 제일 두꺼운 곳(`byRegion.siege`
  //    가 8 로 전 구역 중 제일 많다)에 닿는 순간 압박이 사라졌다.
  //
  //  ★★★ `tools/space-route.js` 는 이미 **「적 본진 4·3·4·4 추격」**이라고
  //    재고 있었다 — **검사와 게임이 정반대**였는데 둘 다 초록이었다.
  //    검사는 표를 읽고 게임은 여기를 도니까. 이제 안 푼다
  if (rev === 'void') {
    say(ai, VOID.enter, 'tell');
    // ★ 창밖은 `regionOf(route)` 가 정한다 — **매 프레임** 되돌리므로
    //   여기서 한 번 부르면 다음 프레임에 지워진다
    saveNow();          // 여기까지는 저장해 둔다 — 마지막 구간도 8분이다
  }
  // ══ ★★★ v93 — **떨군다** (`drop.js` · WAR.md §6) ═══════════════════
  //  목적 한 줄의 세 번째다. 마지막 구간에 들어서면 시계가 혼자 가고,
  //  사람이 정하는 것은 **떨구느냐**와 **벌리느냐** 둘뿐이다
  {
    const at = isVoid(route.leg) && route.phase === RPHASE.LEG;
    const ev = stepDrop(dropS, dt, {
      at,
      armed: warhead.armed,
      // ★ 이탈 거리는 **진짜 배 속도**로 채운다 — 화면만 빨라지고 실제로
      //   안 빠르면 그건 「가는 척하는 화면」이다 (v88 규약)
      speed: CRUISE.speed * (route.phase === RPHASE.PORT ? 0.25
        : ((power.thrust && !thrustHeld(salvage)) ? 1 : LEG.coast)) * boostMult(boost),
    });
    if (ev === 'run') { say(ai, DSAY.run, 'alarm'); audio?.event('alarm'); }
    if (ev === 'window') {
      say(ai, warhead.armed ? DSAY.window : DSAY.armFirst, 'alarm');
      audio?.event('latch');
    }
    if (ev === 'late') { say(ai, DSAY.late, 'alarm'); }
    if (ev === 'blast') {
      // ★★ 못 벌렸으면 **상한다. 안 죽인다** — 벌은 죽음이 아니라 일이 는다
      if (dropS.hurt > 0) {
        hitFlash = Math.max(hitFlash, 1);
        say(ai, DSAY.close, 'alarm');
      }
      say(ai, dropS.filled >= 5 ? DSAY.blast : DSAY.dud, 'alarm');
      audio?.event('hit');
    }
    if (ev === 'over') { clearRaw(); showEnd(); }
  }

  // ══ ★★★ v99 — **아크 도약** (재기 → 뛰기 → 도착) ═══════════════════
  //
  //  ★ 견줌이 「절망」일 때 「아크를 채우고 빠진다」고 말해 왔다
  //    (`might-table.js ODDS`). v98 까지 그 말이 **거짓말**이었다.
  //
  //  ★★ 값은 넷이고 **셋을 여기서 치른다** — 열(저장고) · 시간(무방비) ·
  //    건너뛴 자리. 전지는 누를 때 이미 태웠다
  {
    // ★ 재는 동안 열이 **저장고로** 간다 — 선체가 아니다. 라디에이터를
    //   열어야 우주로 나가므로, 도착하면 잠깐 눈에 띈다 (v58 규약)
    sink = Math.min(SINK.max, sink + arcHeat(arcS, dt));
    const aev = stepArcS(arcS, dt, { sinkAt: sinkAt({ sink }), legSec: route.need || LEG.seconds });
    if (aev === 'jump') {
      sink = Math.min(SINK.max, sink + arcBurst());
      say(ai, ARC_SAY.jump, 'alarm');
      audio?.event('boost');
    }
    if (aev === 'abort') { say(ai, ARC_WHY.sink, 'warn'); }
    if (aev === 'land') {
      // ══ ★★★ **건너뛴다** — 구간 시계를 앞으로 민다 ═══════════════
      //  ★ 구간을 **건너뛰지 않는다.** 시계만 민다 — 구간을 통째로
      //    넘기면 12구간이 6구간이 되고, 장면 배치(`scene-table.js`)가
      //    통째로 어긋난다. 여기가 제일 부수기 쉬운 자리였다
      route.t = Math.min(route.need, route.t + (route.need || LEG.seconds) * ARC.skip);
      // ★★ 건너뛴 자리에 있던 것들은 **없던 일이 된다.** 그래야
      //   「살았지만 못 채웠다」가 성립한다 — 이 계통의 심장이다
      sky.list = sky.list.filter((t) => !TKINDS[t.kind]?.shoots && !TKINDS[t.kind]?.rams);
      sky.incoming.length = 0;
      say(ai, ARC_SAY.land, 'alarm');
      // ★ 손해를 **말해 준다.** 안 말하면 손해인 줄 모르고 습관이 된다
      setTimeout(() => say(ai, ARC_SAY.cost, 'tell'), 2200);
      audio?.event('escaped');
    }
  }

  if (rev === 'end') {
    say(ai, '더는 따라오지 못합니다', 'tell');
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
  // ★★★ v81 — **감는 동안은 못 나아간다.** 줄에 매여 있으므로 말이 되고,
  //   그게 그물의 값이다: **주우려면 도망칠 수 없다.** 「지원이 오기
  //   전에」가 무서운 이유가 이 한 줄이다 (`salvage-table.js NET.holdsThrust`)
  const tied = thrustHeld(salvage);
  const cruise = route.phase === RPHASE.PORT ? 0.25
    : ((power.thrust && !tied) ? 1 : LEG.coast);
  // ★★ **착륙이 화면을 몬다** — 고도 하나가 별 흐름·하늘색·발광·지면을 다 정한다.
  //   `update` 보다 **먼저** 넣는다. 나중에 넣으면 이번 프레임은 옛 고도로
  //   그려지고, 그 한 프레임이 마디가 바뀌는 순간마다 툭 끊겨 보인다
  ship.outside.setLand({ step: land.step, t: land.t });
  // ★ 카메라를 준다 (v57). 별 천구가 **눈을 따라다녀야** 한다 —
  //   안 그러면 조종석에서 기관실까지 25m 를 걸을 때 별자리가 밀린다
  // ★ v60 — 선체 자세를 창밖에 넘긴다. **배를 굴리지 않고 밖을 굴린다** —
  //   그게 곧 짐벌이고, 걸어다니는 사람의 충돌이 안 어긋난다
  ship.outside.setAttitude(fly3);
  // ★★★ v73 — **급가속이 창밖을 몬다.** 먼지가 쏟아지고 길어진다.
  //   속도(`cruise`)에도 곱한다 — 화면만 빨라지고 실제로 안 빠르면
  //   그건 속임수고, 이 저장소는 그런 것을 「가는 척하는 화면」이라 부른다
  ship.outside.update(
    dt, CRUISE.speed * cruise * boostMult(boost),
    hazard.lane, incoming(hazard), camera, boost.k,
  );

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
  // ★★★ v73 — **급가속이면 배가 운다.** 주엔진을 세게 물면 그렇다.
  //   속도감의 나머지 절반: 눈(화각·먼지)만으로는 「빠르다」가 몸에 안 온다
  if (boost.k > 0.01) wantShake *= 1 + (RUSH.shake - 1) * boost.k;
  // 부딪힌 순간은 크게 한 번 — 「맞았다」가 몸에 남아야 다음엔 앉는다
  hitFlash = Math.max(0, hitFlash - dt * 0.7);
  // ══ ★★ v88 — **추력이 꺼짐→켜짐으로 넘어가는 순간을 여기서 잡는다** ══
  //  어느 길로 켰든(단축키 · 점검 모드 · 이어하기) 한 곳을 지나므로
  //  「게임에서는 나는데 검사에서는 안 난다」가 안 생긴다
  if (power.thrust && !thrustWas) kickT = KICK.kickFor * KICK.thrust;
  thrustWas = power.thrust;
  // ★ v87 — 밟은 밀림이 되돌아온다 (`KICK`)
  if (kickT > 0) kickT = Math.max(0, kickT - dt);
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
  // ══ ★★★ v87 — **앉으면 창이 열린다** ═══════════════════════════════
  //  ★ `steering || gripping` 이었다 — **조종간을 잡아야만** 눈이 올라갔다.
  //    그런데 v86 에 「앉으면 몬다」로 바꿨으므로 짝이 안 맞았다:
  //    앉아서 기수는 도는데 **눈은 계기 아래**라, 200m 앞의 적이
  //    **좌석 등받이에 가려** 안 보였다 (화면으로 잡았다).
  //  ★★ 「모는 자세」와 「보는 눈」은 **같은 스위치**라야 한다 —
  //    둘로 두면 반드시 한쪽만 켜진 상태가 생긴다
  const wantFly = (steering || gripping || helmSat) ? 1 : 0;
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
  // ★★★ v73 — **급가속이면 화각이 열린다.** 가장자리가 빨리 흘러
  //   속도로 읽힌다 — 레이싱 게임이 다 쓰는 것이고, 눈이 실제로 그렇게
  //   느낀다. 「빛무리가 쏟아져오거나 속도감이 느껴지도록」의 절반이 이것
  const fov = FOV_WIDE + (FOCUS.fov - FOV_WIDE) * focusK
    + (FLY_VIEW.fov - FOV_WIDE) * flyK + RUSH.fov * boost.k;
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
    // ══ ★★★ v88 — **고개를 들어 주던 것을 통째로 걷어냈다** ═══════════
    //
    //  v63 이 `aimAt` 을 넣은 이유는 하나였다: **앉으면 시선을 34도
    //  내렸으므로**(`SIT_LOOK`) 조종간을 잡는 순간 그걸 되들어 줘야 창이
    //  보였다. 그런데 v88 에서 **앉을 때 안 내린다** — 앉는 것이 곧 잡는
    //  것이라 처음부터 창을 본다. 되들 숙임이 없다.
    //
    //  ★★ 그런데 이 줄은 **되드는 것이 아니라 바닥을 까는 것**이었다
    //  (`Math.max(me.pitch, aimAt)`). 그래서 앉아 있는 동안 시선이
    //  **수평 위 6도 밑으로 못 내려갔고**, 재 보니 조종석에서
    //  **아무것도 조준선에 안 걸렸다** — 갈래 판·추력 레버·자동 항법·좌석
    //  전부. 즉 **배가 출발을 못 했다** (`space-endtoend [0]`).
    //  v87 이 이 줄을 `helmSat` 에 물리면서 조용히 생긴 일이고,
    //  v88 에서 스위치만 갈랐다가 앉기=잡기가 되자 **그대로 돌아왔다.**
    //  → 「낡은 처방을 스위치만 바꿔 살려 두면 같은 병이 난다.」 지운다
    // ══ ★★★ v87 — **밟는 순간 눈이 뒤로 밀린다** ═══════════════════
    //  ★ 관성이다. 배가 앞으로 튀어 나가면 사람은 좌석에 눌린다 —
    //    화면에서는 **눈이 뒤로** 가는 것으로 보인다. 짧고 되돌아온다
    if (kickT > 0) {
      const k = kickT / KICK.kickFor;
      camera.position.x += yawS * KICK.kick * k;
      camera.position.z += yawC * KICK.kick * k;
    }
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
  if (mev === 'home') { say(ai, '항로로 돌아왔습니다', 'tell'); }
  if (mev === 'warn') {
    say(ai, hitWord(helm.near) ?? '중력원에 끌려갑니다', 'tell');
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
  if (lev === 'open') { say(ai, '바깥문이 열렸습니다', 'tell'); }
  if (lev === 'shut') { say(ai, '바깥문이 닫혔습니다', 'tell'); }
  if (lev === 'blown') {
    // ★ **벌이 숫자가 아니라 기다림이다.** 45초 동안 못 연다.
    // ★ v62 부터 이건 「우주복 없이 진공에 서 있었다」일 때만 온다 —
    //   그래서 말도 바뀐다. 「기밀 상실」은 사고를 뜻하는데, 사고인 것은
    //   문이 아니라 **사람**이다
    say(ai, `우주복 없이 진공에 있었습니다 — 배가 문을 닫았습니다`, 'alarm');
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
    // ★ 승부수를 잡고 있으면 **띠가 찬다** — 「잡히는데 안 보인다」를
    //   안 만들려고 이미 있는 진행 띠를 그대로 쓴다 (새 UI 0)
    gambit: holdAt(gambit),
    rnd: landRnd,
  });
  if (lastStep !== land.step && STEP_WORD[land.step]) {
    say(ai, STEP_WORD[land.step], 'tell');
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
    say(ai, `실어 온 것 — 광석 ${Math.round(land.got.ore)} · 부품 ${land.got.parts}`, 'tell');
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
  // ★ v100 — **동체가 초당 몇 도 도나.** 발사관의 흔들림이 이 값에 비례한다.
  //   조종간 편향이 아니라 **실제로 돈 각**으로 잰다 — 자세 제어 고장이나
  //   짐벌이 흔드는 것도 똑같이 흔들려야 말이 된다
  {
    const dAz = ((nose.az - noseWas.az + 540) % 360) - 180;
    const dEl = nose.el - noseWas.el;
    hullSpin = Math.hypot(dAz, dEl) / Math.max(dt, 1e-6);
    noseWas = { az: nose.az, el: nose.el };
  }
  aimAz = nose.az; aimEl = nose.el; noseOver = !!nose.over;

  // ── ★★ 떠도는 것들 · 적 우주선 ─────────────────────────
  setSkyRegion(sky, ship.outside.region);
  // ★★★ **부딪힌 것을 받아 온다** — 선체 안으로는 못 들어오고, 대신 흔들린다
  // ★★ v70 — 적은 **우리를 겨눠야** 쏜다. 기수 방위를 넘긴다
  setNose(sky, aimAz, aimEl);
  // ══ ★★★ v84 — **옆으로 뺀 만큼** (회피) ═══════════════════════════
  //  ★ `flyPush` 는 조종간 편향이고, 급기동(Shift)이 배수를 곱한다.
  //    조종간만으로는 0.9초에 `DODGE.need` 를 못 채운다 — 그래서
  //    **급기동을 써야 피해지고**, 급기동은 추진제를 태운다.
  //    새 자원을 안 만들고 이미 있는 저울에 얹은 자리다
  //  ★ 축을 az·el 로 맞춘다: 요는 그대로, 피치는 부호가 반대다
  //    (화면 위로 밀면 기수가 든다 = el 이 는다)
  const evMult = burstNow ? RCS.burst.mult : 1;
  const evade = steering
    ? { x: flyPush.yaw * evMult, y: flyPush.pitch * evMult }
    : null;
  // ══ ★★★ **회피 기동을 하면 슬로우로 전환된다** (사장님 말씀 그대로) ══
  //  ★ **손이 먼저 움직여야 걸린다.** 저절로 느려지면 그건 상이지 조작이
  //    아니고, 「자동으로 느려지는 게임」이 된다. 급기동을 누른 그 순간
  //    시간이 늘어나고, 그 안에서 조종간을 미는 것은 여전히 손이 한다
  //  ★ **맞을 탄이 있을 때만.** 빗나갈 탄에까지 걸면 그건 거짓말이고,
  //    그러면 회차 예산도 순식간에 마른다
  {
    const th = threatNow(sky, flyPush.yaw, flyPush.pitch);
    if (th && burstNow) askSlow(slowmo, 'evade', th.t / SLOW.evade.scale + 0.25);
    // ══ ★★★ **등대가 말한다 — 그리고 말만 한다** ═════════════════════
    //  ★ 조종간은 손이 잡는다. 등대는 **어느 쪽인지**까지다.
    //    「최종 결정은 플레이어가」가 이 두 줄에 걸려 있다
    if (th) say(ai, AI_LINES.evade(evadeWord(th.dir)), 'alarm');
    else {
      // 아직 안 쐈다 — **겨누는 동안** 알린다 (쏘고 알리면 늦다)
      const soon = steering ? aimingSoon(sky) : null;
      if (soon) say(ai, AI_LINES.aiming(sideWord(soon.relAz)), 'warn');
    }
    threat = th;
  }
  const skyEv = stepSky(sky, dt, {
    evade,
    // ══ ★★★ **항로는 자동항법에만 영향을 준다** (v82) ═══════════════
    //
    //  ★ 사장님 「**항로 설정이 안되면 운전할 수 없잔아.** 이것도 고쳐.
    //    항로는 **자동항법에만** 영향을 주도록」
    //
    //  ★★ 맞는 말이고, 이것이 v81 에서 「거점에서는 아무것도 안 움직인다」로
    //    드러났던 것의 뿌리다. 여태 조건이 `route.phase === LEG` 였다 —
    //    즉 **항로를 안 고르면 우주가 통째로 멈췄다.** 추력을 켜도, 급가속을
    //    해도, 기수를 돌려도 아무것도 안 다가왔다.
    //
    //  ★★★ 항로는 **어디로 가는가**이지 **가고 있는가**가 아니다.
    //    가고 있는가는 **추력**이 정한다. 구간이 나아가는 것(자동항법의
    //    일)만 `phase` 가 정하면 된다 — 그게 사장님 말씀 그대로다
    moving: power.thrust && !landBusy(land),
    // ★ 거점에 대고 있는 동안은 적이 안 온다 — 사는 일이 벌이 되면 안 된다
    quiet: route.phase === RPHASE.PORT,
    // ★★★ v81 — **급가속이 정말 다가가게** 한다. v80 까지 R 은 화면만
    //   바꿨다 (먼지·화각·흔들림) — 다가오는 속도는 손도 안 댔으므로
    //   「눌러도 안 빨라진다」가 맞았다
    close: 1 + (RUSH.close - 1) * (boost.k ?? 0),
  }) ?? {};
  takeBumps(skyEv.bumps ?? []);
  // ══ ★★★ **회수 한 걸음** (v81) — 꾸러미가 흩어지고 그물이 감기고
  //   지원이 다가온다. `stepSky` 바로 뒤여야 꾸러미가 **같은 프레임의**
  //   거리로 흐른다 (한 프레임 어긋나면 그물이 늘 조금 빗나간다)
  {
    const sv = stepSalvage(salvage, dt, {
      // ★ v82 — 창밖과 **같은 자**를 쓴다 (항로가 아니라 추력)
      moving: power.thrust && !landBusy(land),
    });
    stepCargo(cargo, dt);
    if (sv.landed) takeSalvage(sv.landed);
    for (const f of sv.faded) {
      say(ai, `${TKINDS[f.kind]?.name ?? ''} 잔해가 흩어졌습니다`, 'warn');
    }
    // ★★ **지원이 왔다** — 새 시계를 안 만들고 적이 오는 시계를 당긴다
    if (sv.called) {
      sky.nextRaider = 0;
      say(ai, '적의 지원이 도착했습니다', 'warn');
      audio?.event('caught');
    }
  }
  // ★★★ **맞았다** — 이 판의 심장 (v70)
  takeHits(skyEv.hits ?? []);
  // ★★★ **v69 — 규칙이 든 자리를 창밖에 세운다** (사장님 「적 비행선도
  //   안보이고」). v68 까지 이 목록은 **HUD 캔버스의 초록 글리프**로만
  //   갔다 — 창밖에는 별과 바위뿐이었고, 격추 게임인데 격추가 안 보였다.
  // ★ `stepSky` **바로 뒤**에 둔다. 앞에 두면 한 프레임 늦은 자리를
  //   그리고, 그 한 프레임이 빠르게 스치는 것에서는 어긋남으로 보인다
  ship.outside.targets.update(sky.list, dt);
  // ★★★ v79 — **탄이 표적을 따라간다.** 안 넘기면 쏜 순간의 자리로 곧게
  //   날아가고, 규칙은 닿는 순간의 표적으로 판정하므로 **궤적의 끝과
  //   격추 지점이 어긋난다** (사장님이 보신 것이 이것이다)
  ship.outside.shots.update(dt, (id) => ship.outside.targets.posOf(id));
  // ★★★ v81 — 꾸러미·그물·줄을 창밖에 세운다. 규칙이 든 목록 그대로 그린다
  ship.outside.salvage.update(salvSummary(salvage), dt);
  // ★★★ v70 — **날아오는 적탄.** 규칙에 0.9초의 비행 시간을 뒀는데,
  //   그 동안 화면이 비어 있으면 그건 없는 시간이다 — 「피할 수 있었다」와
  //   「그냥 맞았다」가 구별이 안 된다
  ship.outside.shots.setIncoming(skySummary(sky).incoming);

  // ── ★★ 레이더 · 락온 ────────────────────────────────
  //  ★ 레이더를 **새로 안 만든다** — 능동 탐지 차단기가 이미 그것이다.
  //    켜면 보이고, 켜면 보인다 (자국 20 · chase-table SIGN.sensor)
  combat.radar.on = power.sensor;
  const aimedNow = aimedAt(sky, aimAz, aimEl);
  // ★ 이름을 `rev` 로 썼다가 **같은 함수 안의 항로 `rev` 와 부딪혀 게임이
  //   통째로 안 떴다.** `node --check` 는 통과한다 — 한 함수가 워낙 길어
  //   눈으로도 안 보였다. 브라우저를 한 번 띄우자 첫 줄에 나왔다
  // ★★★ v94 — **묶여 있으면 그 표적의 각을 준다.** 여태 「제일 가운데
  //   있는 것」만 넘겼으므로, 적이 조금만 비켜도 **다른 것이 aimed 가 되어**
  //   `t.id === r.id` 가 깨지고 락온이 풀렸다. 실제 레이더는 물면
  //   **그것을 따라간다** — 조준선이 아니라 표적을 본다
  let radarAimed = aimedNow;
  if (combat.radar.id !== null) {
    const lt = sky.list.find((x) => x.id === combat.radar.id);
    if (lt) {
      const rel = azDiff(lt.az, aimAz);
      radarAimed = { t: lt, off: Math.hypot(rel, lt.el - aimEl), relAz: rel, relEl: lt.el - aimEl };
    }
  }
  const radEv = stepRadar(combat, dt, radarAimed);

  // ══ ★★★ v100 — **발사관이 표적을 따라간다** ═══════════════════════════
  //
  //  ★ 사장님 「적을 계속 타겟팅 하면서 **회피 기동이 가능**하도록 …
  //    동체는 회전해도 **타겟팅이 불안정해지지만 방향은 유지**하는걸로?」
  //
  //  ★★ 여기가 그 자리다. 발사관은 **묶은 표적**(없으면 지금 겨눈 것)을
  //    쫓고, 동체가 도는 만큼 **흔들린다.** 그러면 회피가 「표적을 버리는
  //    일」에서 **「정확도를 내주는 일」**이 된다.
  //  ★ 자리는 여기서 안 잰다 — `frame.js relOf` 가 준 것을 그대로 쓴다
  {
    const mt = radarAimed?.t ?? null;
    stepMount(mount, dt, {
      aim: mt ? { az: radarAimed.relAz, el: radarAimed.relEl } : null,
      id: mt ? mt.id : null,
      spin: hullSpin,
    });
  }
  // ★★★ v69 — **탐색기 으르렁**. 잡으면 으르렁, **물면 음이 높아진다**
  //   (AIM-9 사이드와인더 고증). 눈이 늘 조준선에 가 있을 수 없으므로
  //   **귀가 대신 본다** — 이게 「직관적으로 방향을 맞춘다」의 절반이다
  radarSeek = !combat.radar.on ? 0
    : combat.radar.id !== null ? 1
      : (aimedNow && aimedNow.off <= RADAR.lockCone && aimedNow.t.dist <= RADAR.range)
        ? 0.35 + 0.3 * (combat.radar.t / RADAR.lockFor) : 0;
  if (radEv === 'lock') { say(ai, '묶었습니다', 'tell'); audio?.event('latch'); }
  if (radEv === 'break') { say(ai, '놓쳤습니다', 'tell'); }
  stepCool(combat, dt, { atSeat: helmSat });
  landShots(dt);

  // 조준경 — **앉아 있을 때만 켜진다.** 늘 켜 두면 「지금 겨누는 중인가」가 안 읽힌다
  // ══ ★★★ v95 — **판은 안 굴린다. 판 안의 표식만 굴린다** ═══════════
  //
  //  사장님 「**왜 락온하는 원이 대각선으로 글씨가 써있는데?**」
  //
  //  ★ v91 에 「하늘만 돌고 HUD 는 안 돈다」를 고치면서 **판 전체**를
  //    굴렸다 (`mesh.rotation.z = skyRoll`). 표식은 맞아 들어갔는데
  //    **글씨와 눈금까지 같이 돌았다** — 조종석은 짐벌로 수평을 지키므로
  //    사람 눈은 안 도는데 글씨만 도는, 읽을 수 없는 상태가 됐다.
  //  ★★ 고칠 자리는 **그리는 쪽**이다: 판은 수평으로 두고, 표적의
  //    (좌우·위아래)를 롤만큼 **2차원으로 돌려서** 찍는다. 그러면
  //    표식은 하늘을 따라가고 글씨는 똑바로 선다 — 실제 HUD 의
  //    수평의(horizon line)만 도는 것과 같은 규약이다
  if (ship.sight?.mesh) ship.sight.mesh.rotation.z = 0;
  ship.sight.redraw({
    // ★ v95 — 그리는 쪽에 롤을 넘긴다 (판이 아니라 **표식**이 돈다)
    // ★★★ v98 — **머리 위를 넘기면 반 바퀴를 보탠다** (`aimOf` 주석).
    //   넘어간 것은 배가 뒤집힌 것이고, 뒤집히면 표식도 뒤집혀야 한다.
    //   이 한 항이 없어서 넘긴 자세에서만 상자가 정확히 180도 헛돌았다
    roll: ship.outside.skyRoll + (noseOver ? Math.PI : 0),
    // ★★★ v97 — **묶은 표식이 가리키는 자리.** 화면 복판이 아니라
    //   표적 위에 얹힌다 (사장님 「락온 위치가 완전 다르잔아」)
    lockAt: combat.radar.id !== null
      ? { az: combat.radar.atAz, el: combat.radar.atEl } : null,
    on: helmSat, az: aimAz, el: aimEl, cool: combat.cool,
    list: skySummary(sky).list,
    // ★ v66 — 자국이 계기판에서 HUD 로 올라왔다. 계기판이 좁아지며
    //   화면 한 장이 밀려났고, 자국은 **모는 동안 보는 것**이라 여기가 맞다
    power, sign: chase.sign, contactAt: contactAt(route),
    // ★★★ v69 — **선도 점**을 찍으려면 지금 고른 무기의 탄속이 필요하다.
    //   선도가 필요 없는 무기(유도탄·열추적탄)는 `null` 이라 점이 안 뜬다 —
    //   안 필요한데 뜨면 「이건 뭐지」가 되고, 그건 계기를 배우는 게임이다
    lead: weaponOf(combat).lead ? { speed: weaponOf(combat).speed } : null,
    // ★★★ v81 — **지금 든 무기의 사거리.** 없으면 조준경이 「멀다」라고만
    //   하고, 그건 상태이지 **할 일**이 아니다 (`target-table.js rangeWord`)
    wMax: weaponOf(combat).rMax,
    // ★ v82 — **락온이 얼마나 찼나** (0~1). 조준경이 호로 그린다 —
    //   「원 안에 얼마나 더 붙들고 있어야 하나」가 눈에 보여야 한다
    lockK: Math.max(0, Math.min(1, combat.radar.t / RADAR.lockFor)),
  });

  const dev = stepDrift(drift, dt, steering);
  // 잡고 있는 것에 값이 붙는다 — 냉각 밸브가 기관실이라 손이 못 간다
  heat = Math.min(HEAT.max, heat + driftHeat(drift, steering) * dt);
  if (dev === 'hit') {
    // 죽지 않는다. **대신 일이 는다** — 잔해에 부딪힌 것과 같은 규약
    faults.wear.hull = Math.min(1, faults.wear.hull + DRIFT.hit.hull);
    heat = Math.min(HEAT.max, heat + DRIFT.hit.heat);
    say(ai, '무언가에 스쳤습니다', 'tell');
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
      say(ai, '자세가 잡혔습니다', 'tell'); audio?.event('fixed');
      sceneDone(scenes, 'C');
    }
  }

  // 화면 한복판 글자 — 잠깐 떴다 사라진다
  // ★ 멈춤 화면이 떠 있으면 안 띄운다 — 안 그러면 매 프레임 다시 켜져서
  //   showPause() 가 접어 놓은 것이 되살아난다. 「접는 곳」과 「켜는 곳」이
  //   다르면 켜는 쪽이 이긴다
  // ★★ **느려진 것이 눈에 보여야 한다.** 배율만 바꾸면 사람은
  //   「버벅인다」로 읽는다 — 느린 것과 끊긴 것은 화면이 갈라 준다.
  //   ★ `dt` 가 아니라 **실시간**으로 물든다 (느릴 때 천천히 물들면
  //     물드는 것 자체가 안 보인다)
  if (slowFx) {
    slowFx.style.opacity = slowK < 0.995
      ? String(Math.min(0.92, (1 - slowK) * 1.55)) : '0';
  }

  // ══ ★★★ v84 — **어느 쪽으로 빼야 하는가** ═══════════════════════════
  //  ★ 화살표를 **가운데가 아니라 그쪽에** 놓는다. 가운데에 두고 방향만
  //    돌리면 눈이 「돌아간 삼각형」을 읽어야 하는데, 급할 때 사람은
  //    모양을 안 읽고 **자리**를 본다
  //  ★ 막대가 없으면 회피가 먹고 있는지 알 수가 없고, 그러면 v83 까지처럼
  //    또 「주사위」로 읽힌다 — 되먹임이 있어야 조작이다
  // ══ ★★★ v85 — **지정한 표적이 어디 있나** ═══════════════════════════
  //  ★ 화면 안이면 **상자**, 밖이면 **화살표**. 지정해 놓고 못 찾으면
  //    지정이 아무 일도 안 한 것이다 — 「규칙이 있는데 화면에 안 보이면
  //    없는 것과 같다」
  if (pkBox) {
    const t = steering && !paused ? picked(combat, sky.list) : null;
    pkBox.hidden = !t;
    if (t) {
      const a = noseAim();
      const dAz = azDiff(t.az, a.az);
      const dEl = t.el - a.el;
      const off = Math.hypot(dAz, dEl);
      const out = off > PICK.offScreen;
      pkBox.classList.toggle('off', out);
      // 화면 안이면 각도를 그대로 화소로 (HUD 가 26도를 덮는다), 밖이면 가장자리에
      const k = out ? 210 / Math.max(1e-3, off) : (innerHeight * 0.5) / 26;
      const x = dAz * k, y = -dEl * k;
      const deg = out ? Math.atan2(y, x) * 180 / Math.PI : 0;
      pkTip.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) rotate(${deg.toFixed(0)}deg)`;
      pkTag.style.transform = `translate(calc(-50% + ${x.toFixed(0)}px), ${(y + 34).toFixed(0)}px)`;
      pkTag.textContent = out
        ? `${TKINDS[t.kind]?.name ?? ''} ${Math.round(t.dist)}m — ${Math.round(off)}° 돌리십시오`
        : `${TKINDS[t.kind]?.name ?? ''} ${Math.round(t.dist)}m`;
    }
  }

  if (evBox) {
    const show = !!threat && steering && !paused;
    evBox.hidden = !show;
    if (show) {
      const d = threat.dir;
      const R = 132;
      const deg = Math.atan2(-d.y, d.x) * 180 / Math.PI;
      evTip.style.transform = `translate(${(d.x * R).toFixed(0)}px, ${(-d.y * R).toFixed(0)}px) rotate(${deg.toFixed(0)}deg)`;
      evSay.textContent = `${evadeWord(d)} — 급기동(Shift)`;
      evSay.style.transform = `translate(calc(-50% + ${(d.x * R).toFixed(0)}px), ${(-d.y * R + 74).toFixed(0)}px)`;
      evBar.style.width = `${Math.round(threat.k * 100)}%`;
    }
  }

  // ── ★★★ 등대가 하는 말 — **한 번에 하나** ──────────────────
  //  ★ 실시간이 아니라 게임 시간으로 삭는다 — 슬로우 중에는 글자도
  //    천천히 머문다. 안 그러면 「느려졌는데 글자만 휙 지나간다」
  if (!paused) stepAI(ai, dt);
  const saying = nowSaying(ai);
  if (saying && !paused) {
    hud.textContent = saying.line;
    hud.dataset.rank = saying.rank;
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
    // ★★★ v73 — **조종간을 잡으면 접힌다** (사장님 요청).
    //   잡은 동안 할 일은 이미 정해져 있다 — 겨누고 쏘는 것이다.
    //   그 위에 잔소리가 떠 있으면 도움이 아니라 가림막이고,
    //   왼쪽 아래는 **레이더가 있는 자리**다
    // ★★★ v75 — **앉으면 접힌다** (조종간을 안 잡았어도).
    //   화면을 찍어 보니 홀로그램이 **레이더를 정통으로 덮고** 있었다 —
    //   v73 에 「왼쪽 아래는 레이더가 있는 자리다」라고 적어 놓고 정작
    //   접히는 조건을 **잡았을 때**로만 뒀다. 앉아 있는 동안 「지금 뭘
    //   할지」는 조종석 계기가 이미 다 말한다
    flying: steering || helmSat,
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
  // ══ ★★★ v85 — **앉으면 손이 안 보인다** (사장님 「조정석 탑승시 손이
  //  안보이도록 해줘」) ═══════════════════════════════════════════════
  //  ★ 맞는 말이다. 조종석에 앉으면 눈이 계기 위로 올라가고 창이 열리는데
  //    (v63), 그 화면에 **떠 있는 손**이 같이 뜨면 창을 가린다. 그리고
  //    실제로도 앉은 사람의 손은 **조종간 위**에 있지 눈앞에 없다.
  //  ★★ **잡을 때는 다시 보인다** — 조종석에도 손으로 하는 것들이 있다
  //    (갈래 판 · 자동 항법 · 추력 레버). 안 보이면 그것들이 「눌리는지」를
  //    알 수가 없다: 「손이 곧 상태창」(PLAN §5-2)이 조종석에서만 죽으면
  //    그건 규약을 깨는 것이다
  //  ★★★ v88 — **조종간을 잡고 있으면 안 보인다** (사장님 「손은 안보이게
  //    해주고, 조정간 잡을때」). 앞의 규약(잡으면 보인다)과 안 부딪힌다 —
  //    **조종간을 쥔 손은 이미 조종간 위**에 있고 눈앞에 뜰 이유가 없다.
  //    갈래 판·레버를 겨눌 때는 `aimName` 이 있으므로 그대로 보인다
  //  ★ 조종간 자신은 이미 `aimName` 에서 빠진다 (잡고 있으면 안 잡힌다) —
  //    그래서 여기서 따로 거를 것이 없다
  hands.group.visible = !helmSat || !!aimName || (!steering && input.hold);
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
  // ★★★ v79 — **광학 창을 먼저 그린다.** 렌더 타깃에 장면을 한 번 더
  //   그리는 일이라 주 렌더(합성기) **앞**이어야 한다 — 뒤에 두면 판에
  //   붙는 그림이 늘 **한 프레임 늦고**, 빠르게 도는 중에는 그게 보인다
  ship.optic?.render(helmSat);
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

// ══ ★★★ **시작 화면은 딱 한 번** (v78) ═══════════════════════════════
//
//  사장님 「게임 시작 시 **팝업창이 불편**한데 새로운 방식으로 고쳐줘.
//          **자꾸 팝업창이 실수로 뜨잔아**」 · 「**일반적인 게임 시작
//          화면으로** 바꿔」
//
//  ★ 원인은 이 한 줄이었다:
//        hint.hidden = input.locked || paused;
//    **포인터 잠금이 풀릴 때마다 시작 화면이 되살아났다** — Esc 도,
//    알트탭도, 창 밖 클릭도 전부. 2시간짜리를 하는 동안 「스페이스워 —
//    적진을 뚫고 들어간다」가 수십 번 튀어나온 셈이다.
//
//  ★★ 보통 게임은 이렇게 안 한다. **제목 화면은 시작 전에 한 번**이고,
//    노는 중에 잠금이 풀리면 뜨는 것은 **멈춤 화면**이다. 그 둘은 다른
//    물건인데 여기서는 하나가 둘을 겸하고 있었다.
let started = false;
/** ★ 한 번 시작하면 제목 화면은 **영영 안 돌아온다** */
function beginOnce() {
  if (started) return;
  started = true;
  hint.hidden = true;
}
addEventListener('mousedown', () => { if (input.locked || paused) beginOnce(); });
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) beginOnce(); });
setInterval(() => {
  if (started) { hint.hidden = true; return; }
  hint.hidden = input.locked || paused;
}, 200);
// ★★ 그리고 노는 중에 잠금이 풀리면 **멈춤 화면**을 띄운다. 여태 아무것도
//   안 띄우고 제목만 되살렸으므로, 「어디까지 왔나」도 「저장됐나」도
//   못 보고 제목만 봤다 — 멈춤 화면이 원래 그 말을 하는 자리다
// ★★★ v80 — **커서를 조종 중에만 숨긴다** (사장님 「마우스포인트 찾기가
//   힘들어」). CSS 의 `cursor:none` 이 늘 걸려 있어서, 잠금이 풀린
//   동안(시작·멈춤·점검) **커서가 아예 없었다**
document.addEventListener('pointerlockchange', () => {
  document.body.classList.toggle('flying', !!document.pointerLockElement);
});
document.addEventListener('pointerlockchange', () => {
  if (wrecked || ended || check.open) return;
  if (!document.pointerLockElement && started && !paused) showPause(true);
});

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
  // ★ v78 — **시작 단추.** 여태 「화면을 눌러 시작합니다」 한 줄뿐이라
  //   처음 온 사람은 무엇을 눌러야 하는지도 몰랐다. 누르면 제목 화면이
  //   닫히고 포인터 잠금을 건다 — 보통 게임이 하는 그대로
  wire('btn-play', () => { beginOnce(); renderer.domElement.requestPointerLock?.(); });
  for (const id of ['btn-new', 'btn-new2']) wire(id, () => { if (ask()) SPACE.newGame(); });
  wire('btn-new3', () => SPACE.newGame());
  // 멈춤 화면에서 열면 **멈춘 채로** 연다 — 점검하다 배가 저 혼자 가면 곤란하다
  for (const id of ['btn-check', 'btn-check2']) wire(id, () => check.toggle(true));
}

console.log(`스페이스워 v${VERSION} — ${roomAt(me.x, me.z)} 에서 시작`);
