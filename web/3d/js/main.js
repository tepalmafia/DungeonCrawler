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

import { generate, gridToWorld, worldToGrid, CELL } from './world/dungeon.js';
import { Level } from './world/level.js';
import { Lighting } from './world/lighting.js';
import { resolveCollision, nearestWalkable } from './world/nav.js';

import { Player } from './game/player.js';
import { spawnFloor } from './game/enemies.js';
import { spawnBoss } from './game/boss.js';
import { playerRoll, hitEnemy } from './game/combat.js';
import { SKILLS, SKILL_BY_HOT, trySkill, updateFields, updateDashHits } from './game/skills.js';
import { rollItem, Drop, RARITIES, power } from './game/items.js';

import { UI } from './ui/hud.js';
import { Inventory } from './ui/inventory.js';

export const VERSION = 1;
const MAX_FLOOR = 3;
// 카메라 거리는 줌으로 바뀐다. 피치는 고정 — 각도까지 흔들면 쿼터뷰 실루엣이 무너진다.
const CAM_DIST_MIN = 10, CAM_DIST_MAX = 34, CAM_DIST_DEFAULT = 19;
const CAM_PITCH = 52 * Math.PI / 180;

const qs = new URLSearchParams(location.search);
const params = {
  seed: qs.get('seed') || randomSeed(),
  floor: Math.max(1, Math.min(MAX_FLOOR, parseInt(qs.get('floor') || '1', 10) || 1)),
  ff: Math.max(1, Math.min(8, parseFloat(qs.get('ff') || '1') || 1)),
  bot: qs.get('bot') === '1',
  jumpBoss: qs.get('jump') === 'boss',
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
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
let camDist = CAM_DIST_DEFAULT;      // 목표 거리 (휠로 조절)
let camDistNow = CAM_DIST_DEFAULT;   // 실제 거리 — 목표로 부드럽게 따라간다

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
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
  fx: null, ui: null, inv: null, input: null, bot: null,
  nav: { resolveCollision, nearestWalkable },
  stats: { kills: 0, floorsCleared: 0, bossKills: 0, deaths: 0, itemsFound: 0 },
  perf: { logicMs: 0, frameMs: 0 },
  exitTouchT: 0,
  onEnemyKilled, onPlayerDeath,
};
window.G3 = G;

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
  G.level = null;
  G.lighting = null;
}

function loadFloor(floorNo) {
  clearFloor();
  G.floorNo = floorNo;

  const dg = generate(floorNo, `${G.seed}-t${G.tier}`);
  G.dungeon = dg;
  scene.fog = new THREE.FogExp2(dg.theme.fog, 0.038);
  scene.background = new THREE.Color(dg.theme.fog);

  G.level = new Level(scene, dg);
  G.lighting = new Lighting(scene, dg.theme);
  G.lighting.setTorches(G.level.torches);

  const rnd = makeRng(`${G.seed}-spawn-${floorNo}-${G.tier}`);
  if (!G.player) {
    G.player = new Player(scene);
    // 시작 장비 — 빈손으로 시작하면 첫 전투가 너무 답답하다
    G.player.equip(rollItem(rnd, 1, 0, { slot: 'weapon', minRarity: 0 }));
    G.player.recompute();
    G.player.hp = G.player.maxHp;
    G.player.mp = G.player.maxMp;
  }

  let start = dg.spawn;
  if (params.jumpBoss && dg.bossRoom) {
    const n = nearestWalkable(dg, dg.bossRoom.cx - 5, dg.bossRoom.cy);
    if (n) start = { gx: n[0], gz: n[1] };
  }
  const [sx, sz] = gridToWorld(start.gx, start.gz, dg.w, dg.h);
  G.player.setPosition(sx, sz);
  G.player.target = null;

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

  // 카메라를 즉시 플레이어 위로 (줌 배율은 층을 넘어가도 유지한다)
  camDistNow = camDist;
  updateCamera(1);
}

// ───────────────────────── 콜백 ─────────────────────────
function onEnemyKilled(e) {
  G.stats.kills++;
  const ups = G.player.gainXp(e.def.xp * (1 + G.tier * 0.25));
  if (ups) {
    Audio.Sfx.levelUp();
    ui.center(`레벨 ${G.player.level}`, '체력과 마나가 가득 찼다');
    ui.toast(`레벨 업 — Lv ${G.player.level}`, '#ffd84d');
    fx.burst(G.player.center(), { count: 44, color: 0xffd84d, speed: 6, size: 0.6, life: 0.9, grav: -2 });
    fx.shockwave(G.player.pos, { r0: 0.5, r1: 4, color: 0xffd84d, life: 0.6 });
  }

  const rnd = makeRng(`${G.seed}-drop-${G.stats.kills}-${e.pos.x.toFixed(2)}`);
  if (e.isBoss) {
    G.stats.bossKills++;
    for (let i = 0; i < 3; i++) dropItem(rollItem(rnd, G.floorNo, G.tier, { minRarity: 2 }), e.pos, i);
    G.level.openExit();
    ui.setBoss(null);
    ui.center('심연의 군주 처치', '포탈이 열렸다');
    Audio.Sfx.victory();
    fx.addShake(0.3, 3);
  } else if (e.elite) {
    dropItem(rollItem(rnd, G.floorNo, G.tier, { minRarity: 1 }), e.pos, 0);
    if (rnd.chance(0.5)) dropItem(rollItem(rnd, G.floorNo, G.tier), e.pos, 1);
  } else if (rnd.chance(0.17 + G.tier * 0.02) && !e.summoned) {
    dropItem(rollItem(rnd, G.floorNo, G.tier), e.pos, 0);
  }

  // 물약은 가끔 회복 대신 바로 보충
  if (rnd.chance(0.09)) {
    const k = rnd.chance(0.5) ? 'hp' : 'mp';
    G.player.potions[k]++;
    ui.toast(`${k === 'hp' ? '체력' : '마나'} 물약 +1`, '#b8b8b8');
  }
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

function onPlayerDeath() {
  if (G.state !== 'play') return;
  G.player.dead = true;
  G.state = 'dead';
  G.stats.deaths++;
  Audio.Sfx.death();
  Audio.stopAmbient();
  fx.addShake(0.3, 2);
  ui.setBoss(null);
  showOverlay(`
    <h1 style="color:#c8484a">패 배</h1>
    <p class="sub">${G.floorNo}층에서 쓰러졌다</p>
    <ul class="keys">
      <li>처치 <b>${G.stats.kills}</b> · 획득 아이템 <b>${G.stats.itemsFound}</b> · 레벨 <b>${G.player.level}</b></li>
      <li>장비는 그대로 유지된다. 다시 1층부터.</li>
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
  if (input.wasPressed('Escape') && inv.open) inv.toggle(false);

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
  const range = 2.0 + t.radius;

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

  p.attackCd = 1 / Math.max(0.35, p.attackSpeed);
  p.swing = 1;
  Audio.Sfx.swing();
  fx.arc(p.pos, p.facing, { radius: range + 0.6, spread: Math.PI * 0.45, color: 0xdfe6f2, life: 0.15 });

  // 타격 판정은 스윙 중간에 — 예비 동작이 보이고 나서 맞아야 손맛이 산다
  G.timers.push({
    t: 0.11,
    fn: () => {
      if (p.dead || t.dead) return;
      const d2 = Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
      if (d2 > range + 1.0) return;
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
      if (!p.pickUp(d.item)) { ui.toast('가방이 가득 찼다', '#e07272'); continue; }
      Audio.Sfx.pickup(d.item.rarity);
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
let acc = 0;
const MAX_DT = 1 / 20;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (!Number.isFinite(dt)) dt = 0;
  dt = Math.min(dt, 0.1) * params.ff;
  G.dt = dt;
  G.time += dt;

  handleInput(dt);
  const tLogic = performance.now();

  if (G.state === 'play' && G.dungeon) {
    if (G.bot) G.bot.update(dt);

    // 쿨다운
    for (const k of Object.keys(G.cooldowns))
      if (G.cooldowns[k] > 0) G.cooldowns[k] = Math.max(0, G.cooldowns[k] - dt);

    // 타이머 (지연 발동)
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
    updateFloorClear();
    updateBossBar();
    updateExit(dt);
    G.level.update(G.time, dt);
    G.lighting.update(G.time, dt, G.player.pos);
  } else if (G.dungeon) {
    G.level.update(G.time, dt);
    G.lighting.update(G.time, dt, G.player ? G.player.pos : new THREE.Vector3());
  }

  fx.update(dt);
  updateCamera(Math.min(1, dt * 8));
  if (G.state !== 'title') ui.update(dt);

  // 시뮬레이션 비용만 따로 잰다 — GPU가 느린 환경(소프트웨어 렌더링)에서도
  // 게임 로직이 예산 안에 있는지 판단할 수 있어야 한다.
  G.perf.logicMs = performance.now() - tLogic;
  G.perf.frameMs = dt * 1000 / params.ff;

  input.endFrame();
  renderer.render(scene, camera);
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
window.G3.getZoom = () => ({ target: camDist, now: camDistNow, min: CAM_DIST_MIN, max: CAM_DIST_MAX });
window.G3.setZoom = (d) => { camDist = THREE.MathUtils.clamp(d, CAM_DIST_MIN, CAM_DIST_MAX); return camDist; };
