// 심연의 왕관 — 부팅 · 게임 루프 · 상태 머신.
//
// 테스트 훅 (기존 2D 게임과 같은 규약):
//   ?seed=ABC123  같은 던전 재현      ?floor=N   N층부터 시작
//   ?ff=N         N배속               ?bot=1     자동 플레이
//   ?jump=boss    보스룸 옆에서 시작   window.G3  게임 상태 노출

import * as THREE from 'three';

import { makeRng, randomSeed } from './core/rng.js';
import { Input } from './core/input.js';
import { FX } from './core/fx.js';
import * as Audio from './core/audio.js';
import { Bot } from './core/bot.js';
import { Metrics } from './core/metrics.js';
import { Post } from './core/post.js';

import { generate, gridToWorld, worldToGrid, CELL } from './world/dungeon.js';
import { Level } from './world/level.js';
import { Lighting } from './world/lighting.js';
import { Remains } from './world/remains.js';
import { resolveCollision, nearestWalkable, sweep } from './world/nav.js';

import { Player } from './game/player.js';
import { spawnFloor } from './game/enemies.js';
import { Doors } from './world/doors.js';
import { Traps } from './world/traps.js';
import { Shop } from './game/shop.js';
import { Dialogue } from './game/dialogue.js';
import { spawnBoss } from './game/boss.js';
import { playerRoll, hitEnemy, hitPlayer, Projectile } from './game/combat.js';
import { SKILLS, SKILL_BY_HOT, trySkill, updateFields, updateDashHits } from './game/skills.js';
import { rollItem, Drop, RARITIES, SLOTS, power, priceOf } from './game/items.js';
import { makeLantern, rollLantern, lanternDropChance, lightOf, acquire, fuelCap, BASE_LIGHT } from './game/lantern.js';
import { MOVE_SCALE, ATTACK_SCALE, ATTACK_TIME } from './game/pace.js';
import { AI } from './game/ai.js';

import { UI } from './ui/hud.js';
import { Inventory } from './ui/inventory.js';

export const VERSION = 1;
const MAX_FLOOR = 3;
// 카메라 거리는 줌으로 바뀐다. 피치는 고정 — 각도까지 흔들면 쿼터뷰 실루엣이 무너진다.
const CAM_DIST_MIN = 10, CAM_DIST_MAX = 34, CAM_DIST_DEFAULT = 19;
const CAM_PITCH = 52 * Math.PI / 180;
// 맨몸 평타 사거리. 격자 한 칸이 2.0 이라, 적 반지름을 더해도 한 칸 안에 들어온다.
const MELEE_REACH = 1.35;

const qs = new URLSearchParams(location.search);
const params = {
  seed: qs.get('seed') || randomSeed(),
  floor: Math.max(1, Math.min(MAX_FLOOR, parseInt(qs.get('floor') || '1', 10) || 1)),
  ff: Math.max(1, Math.min(8, parseFloat(qs.get('ff') || '1') || 1)),
  bot: qs.get('bot') === '1',
  jumpBoss: qs.get('jump') === 'boss',
  // 후처리 — 기본 켜짐. ?post=0 으로 끄고, ?post=low 로 블룸만 뺀다
  post: qs.get('post') === '0' ? 'off' : (qs.get('post') === 'low' ? 'low' : 'high'),
  autostart: qs.get('autostart') === '1' || qs.get('bot') === '1',
};

// ───────────────────────── 렌더러 ─────────────────────────
const canvas = document.getElementById('view');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  document.getElementById('stage').hidden = true;
  document.getElementById('nowebgl').hidden = false;
  throw err;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;   // r185에서 PCFSoft 는 폐기 예정
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);
let post = null;                     // 후처리 (core/post.js) — resize 보다 먼저 선언되어야 한다
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const lastPos = { x: 0, z: 0 };       // 이동 거리 적산용 (실측)
let camDist = CAM_DIST_DEFAULT;      // 목표 거리 (휠로 조절)
let camDistNow = CAM_DIST_DEFAULT;   // 실제 거리 — 목표로 부드럽게 따라간다

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (post) post.setSize(w, h);
}
addEventListener('resize', resize);
resize();

// ───────────────────────── 게임 상태 ─────────────────────────
const G = {
  scene, camera, renderer,
  time: 0, dt: 0,
  state: 'title',            // title | play | dead | cleared
  seed: params.seed,
  floorNo: params.floor,
  tier: 0,
  dungeon: null, level: null, lighting: null,
  player: null, enemies: [], drops: [], projectiles: [],
  fields: [], timers: [], cooldowns: {},
  boss: null, hover: null, pickupTarget: null,
  fx: null, ui: null, inv: null, input: null, bot: null, remains: null, post: null,
  nav: { resolveCollision, nearestWalkable, sweep },
  pace: { MOVE_SCALE, ATTACK_SCALE, ATTACK_TIME },   // 검증·튜닝에서 읽는다
  stats: { kills: 0, floorsCleared: 0, bossKills: 0, deaths: 0, itemsFound: 0 },
  perf: { logicMs: 0, frameMs: 0 },
  hitStop: 0,                                        // core/main frame() 에서 소모된다
  metrics: new Metrics(),                            // 실측 — window.G3.metrics.report()
  exitTouchT: 0,
  onEnemyKilled, onPlayerDeath, onLanternOut,
  doors: null, traps: null, shop: null, dialogue: null, interact: null,
  acquireLantern: null,      // 아래에서 채운다 (game/shop.js 가 쓴다)
  // 정예 스킬이 쓰는 통로 (game/elites.js). 판정 규칙을 한 곳에 모아 둔다.
  hitPlayerFrom: null, spawnEnemyShot: null, makeNoise: null,
  dropItem: null,            // 아래에서 채운다 (ui/inventory.js 가 쓴다)
};
window.G3 = G;

post = new Post(renderer, scene, camera, params.post);
G.post = post;
// CSS 비네트가 셰이더 비네트와 겹치지 않도록 알린다 (css/style.css 참조)
document.body.dataset.post = params.post;

const input = new Input(canvas);
G.input = input;
const fx = new FX(scene, camera);
G.fx = fx;
const ui = new UI(G);
G.ui = ui;
const inv = new Inventory(G);
G.inv = inv;

// ───────────────────────── 층 로딩 ─────────────────────────
function clearFloor() {
  for (const e of G.enemies) e.dispose();
  for (const d of G.drops) d.dispose();
  for (const p of G.projectiles) p.kill();
  G.enemies.length = 0;
  G.drops.length = 0;
  G.projectiles.length = 0;
  G.fields.length = 0;
  G.timers.length = 0;
  G.boss = null;
  G.pickupTarget = null;
  fx.clearTransients();
  if (G.level) G.level.dispose();
  if (G.lighting) G.lighting.dispose();
  if (G.remains) G.remains.dispose();
  if (G.doors) G.doors.dispose();
  if (G.traps) G.traps.dispose();
  if (G.shop) G.shop.dispose();
  G.level = null;
  G.lighting = null;
  G.remains = null;
  G.doors = null;
  G.traps = null;
  G.shop = null;
  ui.setShop(null);
}

function loadFloor(floorNo) {
  clearFloor();
  G.floorNo = floorNo;

  const dg = generate(floorNo, `${G.seed}-t${G.tier}`);
  G.dungeon = dg;
  scene.fog = new THREE.FogExp2(dg.theme.fog, 0.03);
  scene.background = new THREE.Color(dg.theme.fog);

  G.level = new Level(scene, dg);
  G.lighting = new Lighting(scene, dg.theme);
  G.remains = new Remains(scene);
  G.lighting.setTorches(G.level.torches);
  G.doors = new Doors(scene, dg);
  G.traps = new Traps(scene, dg, makeRng(`${G.seed}-trap-${floorNo}-${G.tier}`));
  if (!G.dialogue) G.dialogue = new Dialogue(scene);

  const rnd = makeRng(`${G.seed}-spawn-${floorNo}-${G.tier}`);
  if (!G.player) {
    G.player = new Player(scene);
    G.player._onUpgrade = () => G.metrics.upgrade();
    // 시작 장비 — 빈손으로 시작하면 첫 전투가 너무 답답하다
    G.player.equip(rollItem(rnd, 1, 0, { slot: 'weapon', minRarity: 0 }));
    G.player.recompute();
    G.player.hp = G.player.maxHp;
    G.player.mp = G.player.maxMp;
    // 시작 지급품 — 240초는 1층을 도는 데 충분하고 2층부터는 모자란다.
    // 보충하러 다녀야 하는 압력이 여기서 생긴다.
    G.player.lantern = makeLantern(0);
  }

  let start = dg.spawn;
  if (params.jumpBoss && dg.bossRoom) {
    const n = nearestWalkable(dg, dg.bossRoom.cx - 5, dg.bossRoom.cy);
    if (n) start = { gx: n[0], gz: n[1] };
  }
  const [sx, sz] = gridToWorld(start.gx, start.gz, dg.w, dg.h);
  G.player.setPosition(sx, sz);
  G.player.target = null;

  // 상점은 플레이어가 만들어진 뒤에 굴린다 — 재고가 착용 부위를 참고한다
  G.shop = new Shop(scene, dg, makeRng(`${G.seed}-shop-${floorNo}-${G.tier}`), G.player, floorNo, G.tier);

  G.enemies = spawnFloor(G, dg, rnd, floorNo, G.tier);
  if (dg.isBossFloor) {
    G.boss = spawnBoss(G, dg, floorNo, G.tier);
    G.enemies.push(G.boss);
    ui.setBoss(null);
  } else {
    ui.setBoss(null);
  }

  Audio.stopAmbient();
  Audio.startAmbient(dg.theme.key);

  ui.center(`${floorNo}층 — ${dg.theme.name}`, dg.isBossFloor ? '심연의 군주가 기다린다' : '출구를 찾아라');
  ui.toast(`시드 ${G.seed} · ${floorNo}층 진입`, '#9fd0ff');
  // 문·스위치 안내. 미니맵에 안개가 깔린 뒤로는 **있다는 사실조차** 알 방법이
  // 없었다 (실측: 금고 방이 시작점에서 중앙값 39칸). 존재만 알리고 위치는 안 준다 —
  // 찾는 것이 일이어야 한다.
  if (dg.doors?.length) {
    G.timers.push({ t: 3.2, fn: () => ui.toast('어딘가에 봉인된 문이 있다 — 스위치를 찾아라', '#c8a24a') });
  }

  applyLantern();
  if (post) post.setTheme(dg.theme);
  G.metrics.floorStart(floorNo);

  // 카메라를 즉시 플레이어 위로 (줌 배율은 층을 넘어가도 유지한다)
  camDistNow = camDist;
  updateCamera(1);
}

// ───────────────────────── 콜백 ─────────────────────────
function onEnemyKilled(e) {
  G.stats.kills++;
  const ups = G.player.gainXp(e.def.xp * (e.xpMul || 1) * (1 + G.tier * 0.25));
  if (ups) {
    Audio.Sfx.levelUp();
    ui.center(`레벨 ${G.player.level}`, '체력과 마나가 가득 찼다');
    ui.toast(`레벨 업 — Lv ${G.player.level}`, '#ffd84d');
    fx.burst(G.player.center(), { count: 44, color: 0xffd84d, speed: 6, size: 0.6, life: 0.9, grav: -2 });
    fx.shockwave(G.player.pos, { r0: 0.5, r1: 4, color: 0xffd84d, life: 0.6 });
  }

  const rnd = makeRng(`${G.seed}-drop-${G.stats.kills}-${e.pos.x.toFixed(2)}`);

  // 드랍 롤에 넘길 공통 조건 — 「내가 쓰는 부위」쪽으로 치우치게 하고(§2-2),
  // find 접사를 등급 밀기에 반영한다.
  const roll = (extra = {}) => rollItem(rnd, G.floorNo, G.tier, {
    prefer: SLOTS.filter((s) => G.player.equipped[s]),
    find: G.player.find || 0,
    ...extra,
  });

  if (e.isBoss) {
    G.stats.bossKills++;
    // 3 → 2. 보스가 한 번에 세 개를 뱉으면 그 뒤 층의 드랍이 전부 무의미해진다.
    for (let i = 0; i < 2; i++) dropItem(roll({ minRarity: 2 }), e.pos, i);
    G.level.openExit();
    ui.setBoss(null);
    ui.center('심연의 군주 처치', '포탈이 열렸다');
    Audio.Sfx.victory();
    fx.addShake(0.3, 3);
  } else if (e.elite) {
    dropItem(roll({ minRarity: 1 }), e.pos, 0);       // 확정 1 · 추가 없음
  } else if (rnd.chance(0.09 + G.tier * 0.015) && !e.summoned) {
    dropItem(roll(), e.pos, 0);
  }

  // 영혼 조각 — **바닥에 떨어진다.** 자동으로 들어오지 않는다.
  //
  // 처음엔 확정 자동 획득이었다. 그게 「빈손으로 나가는 판이 없다」는 목적에는
  // 맞았지만, 잡을 때마다 숫자가 알아서 오르니 **줍는 행위에 감정이 없었다.**
  // 화면 구석의 카운터가 조용히 올라갈 뿐이다.
  //
  // 이제 확률로 떨어지고, 걸어가서 밟아야 들어온다. 잡몹은 절반이 조금 안 되고
  // 정예·보스는 확정이다. 떨어지는 빈도를 낮춘 만큼 한 번의 양을 키워서
  // 층당 수입은 유지한다 — 줄이려는 게 아니라 **손이 가게** 하려는 것이다.
  if (!e.summoned) {
    const chance = e.isBoss || e.elite ? 1 : 0.45;
    if (rnd.chance(chance)) {
      const base = 3 + G.floorNo * 2 + G.tier * 3;
      // 잡몹은 확률이 0.45 라 1/0.45 ≈ 2.2 배를 실어야 기댓값이 같다
      const mult = e.isBoss ? 25 : e.elite ? 6 : 2.2;
      const coin = Math.max(1, Math.round(base * mult * rnd.range(0.7, 1.3)));
      dropCoin(coin, e.pos, e.isBoss || e.elite);
    }
  }

  // 랜턴 — 빛이 곧 정보다. 잡몹도 낮은 확률로 떨군다.
  if (rnd.chance(lanternDropChance(e.def.key, e.isBoss, e.elite))) {
    const lan = e.isBoss ? makeLantern(2) : rollLantern(rnd, G.floorNo, G.tier);
    dropItem(lan, e.pos, 2);
  }

  // 물약은 가끔 회복 대신 바로 보충
  if (rnd.chance(0.09)) {
    const k = rnd.chance(0.5) ? 'hp' : 'mp';
    G.player.potions[k]++;
    ui.toast(`${k === 'hp' ? '체력' : '마나'} 물약 +1`, '#b8b8b8');
  }
}

/**
 * 영혼 조각을 바닥에 떨어뜨린다.
 *
 * 장비 드랍과 같은 Drop 을 쓰지 않는다 — 조각은 가방에 안 들어가고, 툴팁도
 * 비교도 없으며, 줍는 즉시 사라진다. 규칙이 다른 것은 따로 두는 편이 낫다.
 */
function dropCoin(amount, pos, big = false) {
  const dg = G.dungeon;
  const a = Math.random() * Math.PI * 2;
  const res = resolveCollision(dg, pos.x + Math.cos(a) * 0.5, pos.z + Math.sin(a) * 0.5, 0.3);
  const item = {
    kind: 'coin', slot: 'coin', amount,
    name: `영혼 조각 ${amount}`, icon: '◈',
    // 큰 무더기는 등급 체계의 「희귀」 색을 빌려 온다 — 멀리서 크기로 읽힌다
    rarity: big ? 2 : 0,
  };
  const d = new Drop(scene, item, new THREE.Vector3(res.x, 0, res.z));
  G.drops.push(d);
  Audio.Sfx.itemDrop(0);
  fx.burst(d.pos.clone().setY(0.2), {
    count: big ? 14 : 7, color: 0xd8b45e, speed: 2.4, size: 0.24, life: 0.45, grav: 9, spread: 0.4,
  });
}

function dropItem(item, pos, i = 0) {
  const dg = G.dungeon;
  const a = Math.random() * Math.PI * 2;
  const r = 0.4 + i * 0.7;
  const res = resolveCollision(dg, pos.x + Math.cos(a) * r, pos.z + Math.sin(a) * r, 0.35);
  const d = new Drop(scene, item, new THREE.Vector3(res.x, 0, res.z));
  G.drops.push(d);
  G.stats.itemsFound++;
  // 떨어질 때 「털썩」 — 등급이 높으면 뒤에 맑은 배음이 붙는다
  Audio.Sfx.itemDrop(item.rarity);
  // 착지 먼지 — 소리와 그림이 같이 나야 무게가 실린다
  fx.burst(d.pos.clone().setY(0.12), {
    count: 8 + item.rarity * 3, color: 0x8a7b66, speed: 2.2, size: 0.3, life: 0.4, grav: 8, spread: 0.35,
  });
  fx.ground(d.pos, { r0: 0.5, r1: 1.1, color: RARITIES[item.rarity].hex, life: 0.4, opacity: 0.5 });
  if (item.rarity >= 2) {
    fx.burst(d.pos.clone().setY(0.7), { count: 20, color: RARITIES[item.rarity].hex, speed: 4, size: 0.4, life: 0.7, grav: 2 });
  }
}

/**
 * 사망 페널티 — 착용 중인 칸 하나를 골라, 등급에 따라 잃는다.
 * (docs/ITEM-ECONOMY.md §6)
 *
 * 두 가지를 의도적으로 이렇게 뒀다:
 *
 * · **빈 칸이 뽑히면 아무 일도 없다.** 5칸 중 하나를 고르므로 장비가 하나뿐인
 *   초반에는 80% 확률로 무사하다. 「초반 보호」를 따로 만들지 않아도 저절로 된다.
 * · **등급이 높을수록 덜 잃는다** (일반 60% → 전설 15%). 반대로 두면 좋은 물건을
 *   아껴 두고 낡은 걸 입게 된다. 그건 설계 실패다.
 *
 * 잃은 물건은 사라지지 않고 **죽은 자리에 떨어진다.** 어두운 길을 연료를 써 가며
 * 되돌아가는 것이 벌이지, 소멸이 벌이 아니다.
 */
const LOSE_CHANCE = [0.60, 0.45, 0.30, 0.15];

function applyDeathPenalty() {
  const p = G.player;
  const rnd = makeRng(`${G.seed}-death-${G.stats.deaths}`);
  const slot = rnd.pick(SLOTS);
  const item = p.equipped[slot];
  const lost = [];

  if (item && rnd.chance(LOSE_CHANCE[item.rarity] ?? 0.4)) {
    p.equipped[slot] = null;
    p.recompute();
    dropItem(item, p.pos, 0);
    lost.push(item);
  }

  // 영혼 조각은 30%. 장비를 안 잃어도 죽음에는 값이 있어야 한다.
  const coinLost = Math.floor(p.coin * 0.3);
  if (coinLost > 0) p.coin -= coinLost;

  return { lost, coinLost, slot };
}

function onPlayerDeath() {
  G.metrics.death();
  if (G.state !== 'play') return;
  G.player.dead = true;
  G.state = 'dead';
  G.stats.deaths++;
  const pen = applyDeathPenalty();
  Audio.Sfx.death();
  Audio.stopAmbient();
  fx.addShake(0.3, 2);
  ui.setBoss(null);
  const lossLine = pen.lost.length
    ? `<li style="color:#e07272">쓰러지며 <b>${pen.lost[0].name}</b> 을(를) 놓쳤다 — 그 자리에 떨어져 있다</li>`
    : '<li>장비는 지켰다</li>';
  const coinLine = pen.coinLost > 0
    ? `<li>영혼 조각 <b>${pen.coinLost}</b> 을(를) 잃었다</li>` : '';
  showOverlay(`
    <h1 style="color:#c8484a">패 배</h1>
    <p class="sub">${G.floorNo}층에서 쓰러졌다</p>
    <ul class="keys">
      <li>처치 <b>${G.stats.kills}</b> · 획득 아이템 <b>${G.stats.itemsFound}</b> · 레벨 <b>${G.player.level}</b></li>
      ${lossLine}
      ${coinLine}
      <li>다시 1층부터. 떨어뜨린 것은 이 층과 함께 사라진다.</li>
    </ul>
    <button id="startBtn">다시 도전</button>`, () => restartRun(false));
}

function restartRun(advanceTier) {
  if (advanceTier) G.tier++;
  G.seed = randomSeed();
  G.player.dead = false;
  G.player.hp = G.player.maxHp;
  G.player.mp = G.player.maxMp;
  G.player.potions.hp = Math.max(G.player.potions.hp, 4);
  G.player.potions.mp = Math.max(G.player.potions.mp, 4);
  G.cooldowns = {};
  G.state = 'play';
  loadFloor(1);
  if (advanceTier) ui.center(`파밍 ${G.tier + 1}회차`, '적이 더 강해지고 전리품이 좋아진다');
}

function nextFloor() {
  Audio.Sfx.portal();
  if (G.floorNo >= MAX_FLOOR) {
    G.stats.floorsCleared++;
    restartRun(true);
    return;
  }
  G.stats.floorsCleared++;
  G.player.hp = Math.min(G.player.maxHp, G.player.hp + G.player.maxHp * 0.35);
  loadFloor(G.floorNo + 1);
}

// ───────────────────────── 오버레이 ─────────────────────────
function showOverlay(html, onStart) {
  const ov = ui.el.overlay;
  ov.hidden = false;
  ov.querySelector('.card').innerHTML = html;
  const btn = ov.querySelector('#startBtn');
  if (btn) btn.onclick = () => { ov.hidden = true; onStart(); };
  G.overlayAction = () => { ov.hidden = true; onStart(); };
}

function startGame() {
  Audio.resume();
  ui.el.overlay.hidden = true;
  ui.show();
  G.overlayAction = null;
  G.state = 'play';
  loadFloor(params.floor);
  if (params.bot) { G.bot = new Bot(G); ui.toast('봇 모드 ON', '#7fdd7f'); }
}

document.getElementById('startBtn').onclick = startGame;

// ───────────────────────── 입력 처리 ─────────────────────────
const groundV = new THREE.Vector3();

function handleInput(dt) {
  const p = G.player;

  // 줌 — 휠. 사망·타이틀 화면에서도 동작한다(구경할 수 있어야 한다)
  if (input.wheel) {
    camDist = THREE.MathUtils.clamp(camDist * (1 + input.wheel * 0.12), CAM_DIST_MIN, CAM_DIST_MAX);
  }
  // 키보드 줌 — 휠 없는 환경(노트북 트랙패드·검증 스크립트)용
  if (input.wasPressed('Equal') || input.wasPressed('NumpadAdd'))
    camDist = THREE.MathUtils.clamp(camDist * 0.85, CAM_DIST_MIN, CAM_DIST_MAX);
  if (input.wasPressed('Minus') || input.wasPressed('NumpadSubtract'))
    camDist = THREE.MathUtils.clamp(camDist * 1.18, CAM_DIST_MIN, CAM_DIST_MAX);
  if (input.wasPressed('Digit0') || input.wasPressed('Numpad0'))
    camDist = CAM_DIST_DEFAULT;

  if (input.wasPressed('KeyI')) inv.toggle();
  if (input.wasPressed('KeyE')) {
    // 열려 있으면 닫는다 — 같은 키로 열고 닫아야 손이 헤매지 않는다
    if (ui.shop) ui.setShop(null); else doInteract();
  }
  if (input.wasPressed('Escape')) { if (ui.shop) ui.setShop(null); else if (inv.open) inv.toggle(false); }

  if (G.state !== 'play' || p.dead) {
    if (input.wasPressed('Space') && G.overlayAction) G.overlayAction();
    return;
  }
  if (inv.open) return;

  // 물약
  if (input.wasPressed('Digit1')) usePotion('hp');
  if (input.wasPressed('Digit2')) usePotion('mp');

  // 커서가 가리키는 지면
  const gp = input.groundPoint(camera);
  if (gp) groundV.copy(gp);

  // 커서 아래 적 — 지면 좌표 근접 판정(레이캐스트보다 싸고 탑다운에서 정확하다)
  G.hover = null;
  if (gp) {
    let best = null, bestD = Infinity;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.pos.x - gp.x, e.pos.z - gp.z);
      if (d < e.radius + 0.75 && d < bestD) { bestD = d; best = e; }
    }
    G.hover = best;
  }
  canvas.style.cursor = G.hover ? 'pointer' : 'crosshair';

  // 스킬
  for (const s of SKILLS) if (input.wasPressed(s.hot)) trySkill(G, s, gp || p.pos);

  // 좌클릭
  if (gp && (input.justDown || input.down)) {
    if (input.justDown && G.hover) {
      p.target = G.hover;
      G.pickupTarget = null;
    } else if (input.justDown && nearestDrop(gp, 1.3)) {
      G.pickupTarget = nearestDrop(gp, 1.3);
      p.target = null;
      p.moveTo(G.dungeon, G.pickupTarget.pos.x, G.pickupTarget.pos.z);
    } else if (!p.target || input.justDown) {
      if (input.justDown) {
        // 새 클릭은 **무조건 즉시** 반영한다.
        // 예전엔 재계산 쿨다운에 걸리면 명령이 통째로 버려져서,
        // 적을 쫓다가 딴 곳을 클릭하면 그 자리에 멈춰 서 있었다.
        p.target = null;
        G.pickupTarget = null;
        p.holdRepathCd = 0.09;
        p.moveTo(G.dungeon, gp.x, gp.z);
      } else if (p.holdRepathCd <= 0) {
        // 홀드 이동: 커서를 계속 따라가되 경로 재계산은 조금씩만
        p.holdRepathCd = 0.09;
        p.moveTo(G.dungeon, gp.x, gp.z);
      }
    }
  }
}

function usePotion(kind) {
  const p = G.player;
  if (p.potions[kind] <= 0 || p.potionCd[kind] > 0) return;
  p.potions[kind]--;
  p.potionCd[kind] = 8;
  if (kind === 'hp') {
    const heal = p.maxHp * 0.42;
    p.hp = Math.min(p.maxHp, p.hp + heal);
    fx.burst(p.center(), { count: 20, color: 0xff5a5a, speed: 3, size: 0.4, life: 0.6, grav: -3 });
  } else {
    p.mp = Math.min(p.maxMp, p.mp + p.maxMp * 0.5);
    fx.burst(p.center(), { count: 20, color: 0x5fb8ff, speed: 3, size: 0.4, life: 0.6, grav: -3 });
  }
  Audio.Sfx.potion();
}

function nearestDrop(pt, maxD) {
  let best = null, bd = maxD;
  for (const d of G.drops) {
    const dist = Math.hypot(d.pos.x - pt.x, d.pos.z - pt.z);
    if (dist < bd) { bd = dist; best = d; }
  }
  return best;
}

// ───────────────────────── 평타 ─────────────────────────
function updateAutoAttack(dt) {
  const p = G.player;
  if (p.dead || p.dashT > 0) return;
  const t = p.target;
  if (!t || t.dead) { if (t && t.dead) p.target = null; return; }

  const dist = Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
  // 평타 사거리.
  //
  // 예전엔 기본이 2.0 이었다. 격자 한 칸이 2.0 이므로 그것만으로 한 칸이고,
  // 여기에 적 반지름과 **타격 시점의 유예 +1.0** 이 얹혀 실제로는 거의 두 칸까지
  // 닿았다. 짧은 검으로 두 칸 밖을 때리면 「근접」이 아니다.
  //
  // 이제 기본은 1.35 다. 적 반지름(0.38~0.6)을 더해도 1.7~2.0 — **한 칸 안**이다.
  // 두 칸은 대검 계열만 닿는다 (items.js 의 base.range 가 1.4~2.0).
  const range = MELEE_REACH + t.radius + (p.reach || 0);

  if (dist > range) {
    // 추격 재계산은 전용 타이머를 쓴다 — 클릭 처리와 타이머를 공유하면
    // 추격 중에 누른 클릭이 씹힌다
    if (p.chaseRepathCd <= 0) {
      p.chaseRepathCd = 0.16;
      p.moveTo(G.dungeon, t.pos.x, t.pos.z);
      p.target = t;             // moveTo 가 target 을 지우므로 복구
    }
    return;
  }

  p.stop();
  p.facing = Math.atan2(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
  if (p.attackCd > 0) return;

  // 하한도 전체 템포를 따라간다 — 안 그러면 안전망만 30% 좁아진다
  p.attackCd = 1 / Math.max(0.35 * ATTACK_SCALE, p.attackSpeed);
  p.swing = 1;
  Audio.Sfx.swing();
  // 기합은 가끔이어야 기합이다. 매번 지르면 30초 만에 소리를 끄게 된다.
  if (Math.random() < 0.28) Audio.Sfx.playerShout(false);
  fx.arc(p.pos, p.facing, { radius: range + 0.6, spread: Math.PI * 0.45, color: 0xdfe6f2, life: 0.15 });

  // 타격 판정은 스윙 중간에 — 예비 동작이 보이고 나서 맞아야 손맛이 산다.
  // 스윙이 느려진 만큼 이 시점도 같이 늦춘다(ATTACK_TIME). 안 그러면
  // 칼이 아직 뒤에 있는데 적이 먼저 맞는다.
  G.timers.push({
    t: 0.11 * ATTACK_TIME,
    fn: () => {
      if (p.dead || t.dead) return;
      const d2 = Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
      // 유예는 0.35 다. 예고 동작 중에 적이 조금 움직이는 것까지는 봐주되,
      // 1.0(=반 칸)을 봐주면 사거리 설계가 통째로 무의미해진다.
      if (d2 > range + 0.35) return;
      const r = playerRoll(p);
      hitEnemy(G, t, r.dmg, { crit: r.crit });
    },
  });
}

// ───────────────────────── 줍기 / 포탈 ─────────────────────────
function updatePickups(dt) {
  const p = G.player;
  const showLabels = input.alt || input.isDown('AltLeft') || input.isDown('AltRight');
  for (let i = G.drops.length - 1; i >= 0; i--) {
    const d = G.drops[i];
    d.update(G.time, dt, showLabels || d === G.pickupTarget);
    if (p.dead) continue;
    if (Math.hypot(d.pos.x - p.pos.x, d.pos.z - p.pos.z) < 1.15) {
      if (d.item.kind === 'coin') {
        p.coin += d.item.amount;
        G.metrics?.coin(d.item.amount);
        Audio.Sfx.pickup(0);
        fx.number(p.center().setY(1.6), `◈ +${d.item.amount}`, { color: '#d8b45e' });
        if (d === G.pickupTarget) G.pickupTarget = null;
        d.dispose();
        G.drops.splice(i, 1);
        continue;
      }
      if (d.item.kind === 'lantern') {
        // 랜턴은 가방에 쌓지 않는다. 더 좋으면 바꿔 들고, 아니면 기름으로 쓴다.
        const r = acquire(p, d.item);
        applyLantern();
        ui.toast(r.action === 'fuel'
          ? `${d.item.name} → 연료 +${r.gained}초`
          : `${d.item.name} (연료 ${Math.round(r.gained)}초)`, RARITIES[d.item.rarity].css);
        Audio.Sfx.pickup(d.item.rarity);
        G.metrics.pickup(d.item.rarity);
        fx.burst(d.pos.clone().setY(0.6), { count: 16, color: d.item.def.color, speed: 3, size: 0.4, life: 0.6, grav: -2 });
        d.dispose();
        G.drops.splice(i, 1);
        continue;
      }
      if (!p.pickUp(d.item)) { ui.toast('가방이 가득 찼다', '#e07272'); continue; }
      Audio.Sfx.pickup(d.item.rarity);
      G.metrics.pickup(d.item.rarity);
      G.metrics.itemGot();
      const gain = power(d.item) - power(p.equipped[d.item.slot]);
      ui.toast(`${d.item.name}${gain > 0 ? '  ▲ +' + gain : ''}`, RARITIES[d.item.rarity].css);
      fx.burst(d.pos.clone().setY(0.6), { count: 14, color: RARITIES[d.item.rarity].hex, speed: 3, size: 0.35, life: 0.5, grav: -2 });
      if (d === G.pickupTarget) G.pickupTarget = null;
      d.dispose();
      G.drops.splice(i, 1);
    }
  }
}

function updateExit(dt) {
  const p = G.player;
  if (p.dead || !G.level.exitOpen) { G.exitTouchT = 0; return; }
  const d = Math.hypot(G.level.exitPos.x - p.pos.x, G.level.exitPos.z - p.pos.z);
  if (d < 1.5) {
    G.exitTouchT += dt;
    if (G.exitTouchT > 0.55) {
      G.exitTouchT = 0;
      fx.burst(p.center(), { count: 34, color: 0x8fd6ff, speed: 5, size: 0.5, life: 0.7, grav: -2 });
      nextFloor();
    }
  } else G.exitTouchT = 0;
}

/** 보스층이 아닌 층은 적을 다 잡으면 포탈이 열린다 */
function updateFloorClear() {
  if (G.dungeon.isBossFloor || G.level.exitOpen) return;
  const alive = G.enemies.filter((e) => !e.dead).length;
  if (alive <= Math.floor(G.enemies.length * 0.15)) {
    G.level.openExit();
    ui.center('포탈이 열렸다', '미니맵의 푸른 표식으로');
    Audio.Sfx.portal();
  }
}

/** 보스가 시야에 들어오면 상단 바를 켠다 */
function updateBossBar() {
  if (!G.boss || G.boss.dead) return;
  if (!ui.boss && G.boss.pos.distanceTo(G.player.pos) < 18) {
    ui.setBoss(G.boss);
    ui.center('심연의 군주', '왕관은 무덤 위에 있다');
    Audio.Sfx.bossRoar();
    fx.addShake(0.22, 3);
  }
}

/** 지금 들고 있는 랜턴을 광원에 반영한다 */
function applyLantern() {
  if (G.lighting) G.lighting.setLamp(lightOf(G.player.lantern));
}

function onLanternOut(lan) {
  applyLantern();
  ui.toast(`${lan.name}이 꺼졌다`, '#e07272');
  ui.center('불이 꺼졌다', '벽 횃불에서 연료를 채울 수 있다');
  fx.burst(G.player.center(), { count: 14, color: 0x6a5a4a, speed: 2, size: 0.4, life: 0.7, grav: -1 });
}

/**
 * 벽 횃불에서 연료 보충 — 2유닛 안에서 3초 정지.
 * 쓴 횃불은 사그라든다(lighting.js). 지나온 길이 어두워지는 게 대가다.
 */
function updateTorchRefuel(dt) {
  const p = G.player;
  if (p.dead || !G.level) { p.torchRefuelT = 0; return; }
  if (!p.lantern || p.lantern.fuel >= fuelCap(p.lantern, p)) { p.torchRefuelT = 0; return; }

  let near = null;
  for (const t of G.level.torches) {
    if (t.spent) continue;
    if (Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z) < 2) { near = t; break; }
  }
  // 움직이면 처음부터 — 「머무는」 행동이어야 한다
  if (!near || p.path.length) { p.torchRefuelT = 0; G.ui.setRefuel(0); return; }

  p.torchRefuelT += dt;
  G.ui.setRefuel(Math.min(1, p.torchRefuelT / 3));
  if (p.torchRefuelT >= 3) {
    p.torchRefuelT = 0;
    near.spent = true;
    p.lantern.fuel = Math.min(fuelCap(p.lantern, p), p.lantern.fuel + 100);
    G.ui.setRefuel(0);
    ui.toast('연료 +100초', '#ffcf9a');
    Audio.Sfx.potion();
    fx.burst(near.pos.clone(), { count: 18, color: 0xffb257, speed: 2.5, size: 0.4, life: 0.7, grav: -1 });
    near.flame.scale.multiplyScalar(0.55);
  }
}

// ───────────────────────── 카메라 ─────────────────────────
function updateCamera(k) {
  const p = G.player;
  if (!p) return;
  // 커서 방향으로 살짝 밀어 시야를 넓힌다
  let ox = 0, oz = 0;
  if (G.state === 'play') {
    ox = THREE.MathUtils.clamp((groundV.x - p.pos.x) * 0.18, -1.6, 1.6);
    oz = THREE.MathUtils.clamp((groundV.z - p.pos.z) * 0.18, -1.6, 1.6);
  }
  camLook.lerp(new THREE.Vector3(p.pos.x + ox, 0.9, p.pos.z + oz), k);
  // 줌은 한 박자 늦게 따라와야 휠을 굴릴 때 화면이 튀지 않는다
  camDistNow += (camDist - camDistNow) * Math.min(1, k * 1.6);
  camPos.set(
    camLook.x,
    camLook.y + Math.sin(CAM_PITCH) * camDistNow,
    camLook.z + Math.cos(CAM_PITCH) * camDistNow,
  );
  const s = fx.shakeOffset(G.dt);
  camera.position.set(camPos.x + s.x, camPos.y + s.y, camPos.z);
  camera.lookAt(camLook);
}

// ───────────────────────── 루프 ─────────────────────────
let last = performance.now();
let simAcc = 0;
const MAX_DT = 1 / 20;   // 시뮬레이션 한 스텝의 상한 (50ms)

// ── 시뮬레이션 한 스텝 ──────────────────────────────────────
// frame() 에서 떼어냈다. 이유는 계측이다:
// 렌더러가 느린 환경(소프트웨어 렌더링)에서 프레임에 묶여 측정하면
// 배속을 올릴 수밖에 없고, 그러면 한 스텝이 0.8초가 되어 충돌·경로가
// 실제 게임과 달라진다. **그렇게 잰 수치는 이 게임의 수치가 아니다.**
// 그래서 벤치는 렌더링 없이 이 함수를 고정 dt 로 반복 호출한다.
function simulate(dt) {
  if (G.state === 'play' && G.dungeon) {
    if (G.bot) G.bot.update(dt);

    for (const k of Object.keys(G.cooldowns))
      if (G.cooldowns[k] > 0) G.cooldowns[k] = Math.max(0, G.cooldowns[k] - dt);

    for (let i = G.timers.length - 1; i >= 0; i--) {
      G.timers[i].t -= dt;
      if (G.timers[i].t <= 0) { const f = G.timers[i].fn; G.timers.splice(i, 1); f(); }
    }

    G.player.update(dt, G);
    updateAutoAttack(dt);
    updateDashHits(G, dt);
    updateFields(G, dt);

    for (const e of G.enemies) e.update(dt, G);
    for (let i = G.enemies.length - 1; i >= 0; i--) {
      const e = G.enemies[i];
      if (e.dead && e.dieT <= 0) { e.dispose(); G.enemies.splice(i, 1); }
    }
    for (let i = G.projectiles.length - 1; i >= 0; i--) {
      G.projectiles[i].update(dt);
      if (G.projectiles[i].dead) G.projectiles.splice(i, 1);
    }

    updatePickups(dt);
    updateTorchRefuel(dt);
    updateFloorClear();
    updateBossBar();
    updateExit(dt);
    G.doors?.update(dt);
    G.traps?.update(dt, G);
    updateDisarm(dt);
    G.shop?.update(dt, G.time);
    G.dialogue?.update(dt, G);
    updateInteract();
  }
}

/**
 * 손 닿는 곳에 무엇이 있는지 — 스위치 / 행상.
 * 거리 판정을 한 곳에 모아 두면 안내 문구와 실제 동작이 어긋나지 않는다.
 */
function updateInteract() {
  const p = G.player;
  if (p.dead) { G.interact = null; return; }
  const trap = G.traps?.nearestDisarmable(p.pos.x, p.pos.z);
  if (G.doors?.leverInRange(p.pos.x, p.pos.z)) {
    G.interact = { kind: 'lever', label: 'E — 스위치를 당긴다' };
  } else if (G.shop?.inRange(p.pos.x, p.pos.z)) {
    G.interact = { kind: 'shop', label: 'E — 재의 행상과 거래' };
  } else if (trap) {
    // 해제는 도박이 아니라 **시간 대 안전의 교환**이다 — 실패 확률이 없다.
    G.interact = { kind: 'trap', trap, label: `E — ${trap.def.name} 해제 (2초)` };
  } else {
    G.interact = null;
  }
  ui.setInteract(G.interact);
}

/**
 * 함정 해제 — 2초 동안 **가만히** 있어야 한다.
 * 벽 횃불 보충과 같은 규칙이다: 움직이면 처음부터. 「머무는」 행동이어야
 * 함정 해제가 대가를 치르는 선택이 된다.
 */
let disarmT = 0, disarmTarget = null;
function updateDisarm(dt) {
  const p = G.player;
  if (!disarmTarget) return;
  const still = !p.path.length && !p.dead
    && G.traps?.list.includes(disarmTarget) && disarmTarget.state === 'armed';
  if (!still) { disarmT = 0; disarmTarget = null; ui.setRefuel(0); return; }
  disarmT += dt;
  ui.setRefuel(Math.min(1, disarmT / 2));
  if (disarmT >= 2) {
    G.traps.disarm(G, disarmTarget);
    ui.toast(`${disarmTarget.def.name} 해제`, '#8fd08a');
    disarmT = 0;
    disarmTarget = null;
    ui.setRefuel(0);
  }
}

/** E 키 — 손 닿는 것을 쓴다 */
function doInteract() {
  const it = G.interact;
  if (!it) return;
  if (it.kind === 'lever') {
    if (G.doors.pull(G)) {
      Audio.Sfx.portal?.() ?? Audio.Sfx.pickup(2);
      ui.center('무언가가 열렸다', '멀리서 돌이 갈리는 소리');
      ui.toast('봉인된 문이 열렸다', '#ffd84d');
      fx.burst(new THREE.Vector3(G.doors.lever.x, 1.4, G.doors.lever.z), {
        count: 22, color: 0xc8a24a, speed: 3.4, size: 0.4, life: 0.8, grav: -1,
      });
      fx.addShake(0.12, 1.2);
    }
  } else if (it.kind === 'shop') {
    ui.setShop(G.shop);
  } else if (it.kind === 'trap') {
    disarmTarget = it.trap;
    disarmT = 0;
    G.player.stop();
  }
}

/** 실측 기록 — 게임 상태를 읽기만 한다. 측정이 게임을 바꾸면 안 된다. */
function record(dt, rawDt) {
  if (G.state !== 'play' || !G.player) return;
  const p = G.player;
  const walked = Math.hypot(p.pos.x - lastPos.x, p.pos.z - lastPos.z);
  lastPos.x = p.pos.x; lastPos.z = p.pos.z;
  let aggroCount = 0;
  for (const e of G.enemies) if (!e.dead && e.aggro) aggroCount++;
  G.metrics.frame(dt, rawDt, {
    logicMs: G.perf.logicMs,
    frameMs: G.perf.frameMs,
    anyAggro: aggroCount > 0,
    aggroCount,
    hpPct: p.maxHp ? p.hp / p.maxHp : 0,
    fuel: p.lantern ? p.lantern.fuel : 0,
    walked,
    stuck: p.stuckEvents
      ? p.stuckEvents.skipWaypoint + p.stuckEvents.unsmooth + p.stuckEvents.giveUp
      : 0,
  });
}

/**
 * 렌더링 없이 고정 dt 로 N 스텝 돌린다 — tools/bench3d.js 전용.
 * 60Hz 와 같은 간격(1/60)으로 밟으므로 화면에서 도는 것과 같은 시뮬레이션이다.
 */
function headlessRun(seconds, step = 1 / 60) {
  const n = Math.max(1, Math.round(seconds / step));
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    if (G.state !== 'play') break;
    G.hitStop = Math.max(0, G.hitStop - step);
    const d = G.hitStop > 0 ? step * 0.12 : step;
    G.dt = d;
    G.time += d;
    const t = performance.now();
    simulate(d);
    G.perf.logicMs = performance.now() - t;
    record(d, step);
  }
  return { steps: n, ms: +(performance.now() - t0).toFixed(0) };
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (!Number.isFinite(dt)) dt = 0;
  dt = Math.min(dt, 0.1) * params.ff;

  // ── 고정 스텝 ──────────────────────────────────────────────
  // 예전엔 흐른 시간을 **한 번에** 시뮬레이션에 밀어 넣었다. ?ff=8 이나
  // 프레임이 끊긴 순간에는 한 스텝이 0.8초가 되고, 그러면 한 걸음에 격자
  // 30칸을 건너뛰어 벽을 통과한다(감사 실측 최악 60유닛).
  //
  // 스윕이 지오메트리는 구해 주지만, 큰 스텝이 망가뜨리는 것은 그것만이
  // 아니다 — 공격 예고 타이밍, 경로 재계산 주기, 히트스톱 소비, 투사체
  // 수명이 전부 어긋난다. 그래서 **스텝 크기를 늘리는 대신 횟수를 늘린다.**
  //
  // 상한 0.8초: 탭을 오래 비활성화했다가 돌아왔을 때 밀린 시간을 전부
  // 따라잡으려 들면 한 프레임에 수백 스텝을 밟고 화면이 멈춘다. 버린다.
  simAcc = Math.min(simAcc + dt, MAX_DT * 16);
  const tLogic = performance.now();
  let steps = 0;
  while (simAcc > 1e-5 && steps++ < 16) {
    const s = Math.min(simAcc, MAX_DT);
    simAcc -= s;
    // 히트스톱 — 타격 순간 시뮬레이션을 거의 멈춘다. 렌더는 계속 돌아가므로
    // 화면이 멈추는 게 아니라 「걸리는」 느낌이 된다.
    let sd = s;
    if (G.hitStop > 0) { G.hitStop = Math.max(0, G.hitStop - s); sd = s * 0.12; }
    G.dt = sd;
    G.time += sd;
    simulate(sd);
    record(sd, s);
  }
  const dtRender = dt;

  handleInput(dtRender);

  if (G.state === 'play' && G.dungeon) {
    G.level.update(G.time, dtRender);
    // 벽에 가려 캐릭터가 안 보이면 조작이 불가능해진다 — 사이에 낀 벽을 흐린다
    G.level.updateOcclusion(camera, G.player.pos, dtRender);
    G.lighting.update(G.time, dtRender, G.player.pos);
    G.remains.update(dtRender);
  } else if (G.dungeon) {
    G.level.update(G.time, dtRender);
    G.lighting.update(G.time, dtRender, G.player ? G.player.pos : new THREE.Vector3());
  }

  fx.update(dtRender);
  updateCamera(Math.min(1, dtRender * 8));
  if (G.state !== 'title') ui.update(dtRender);

  // 시뮬레이션 비용만 따로 잰다 — GPU가 느린 환경(소프트웨어 렌더링)에서도
  // 게임 로직이 예산 안에 있는지 판단할 수 있어야 한다.
  G.perf.logicMs = performance.now() - tLogic;

  G.perf.frameMs = dt * 1000 / params.ff;

  input.endFrame();
  if (post) post.render(); else renderer.render(scene, camera);
}

// ───────────────────────── 시작 ─────────────────────────
addEventListener('pointerdown', () => Audio.resume(), { once: true });
addEventListener('keydown', () => Audio.resume(), { once: true });

G.overlayAction = startGame;
requestAnimationFrame(frame);

if (params.autostart) startGame();

// 콘솔 편의 (검증 스크립트가 쓴다)
window.G3.startGame = startGame;
window.G3.loadFloor = loadFloor;
window.G3.nextFloor = nextFloor;
window.G3.VERSION = VERSION;
window.G3.params = params;
window.G3.applyLantern = applyLantern;
G.acquireLantern = (lan) => {
  const r = acquire(G.player, lan);
  applyLantern();
  ui.toast(r.action === 'fuel' ? `연료 +${r.gained}초` : `${lan.name} (연료 ${Math.round(r.gained)}초)`,
    RARITIES[lan.rarity].css);
  return r;
};
/**
 * 소리를 낸다 — 반경 안의 적이 「수색」 상태가 된다. 어그로가 아니다.
 * 이미 어그로가 붙었거나 이미 수색 중인 적은 반응하지 않는다(hear 가 거른다).
 */
G.makeNoise = (pos, radius) => {
  if (!AI.noise) return 0;
  let n = 0;
  for (const e of G.enemies) {
    if (e.dead || e.aggro) continue;
    if (Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) > radius) continue;
    if (e.hear(G, pos.x, pos.z)) n++;
  }
  return n;
};
G.hitPlayerFrom = (e, dmg) => hitPlayer(G, dmg, { from: e.pos, attacker: e });
G.spawnEnemyShot = (e, dir, dmg) => {
  G.projectiles.push(new Projectile(G, {
    from: e.center(), dir, speed: 15, dmg, color: e.auraColor ?? 0x9a6bff, radius: 0.3,
  }));
};
window.G3.dropItem = dropItem;         // 인벤토리에서 버릴 때 쓴다
window.G3.headlessRun = headlessRun;   // tools/bench3d.js
window.G3.BASE_LIGHT = BASE_LIGHT;
window.G3.getZoom = () => ({ target: camDist, now: camDistNow, min: CAM_DIST_MIN, max: CAM_DIST_MAX });
window.G3.setZoom = (d) => { camDist = THREE.MathUtils.clamp(d, CAM_DIST_MIN, CAM_DIST_MAX); return camDist; };
