// ══════════════════════════════════════════════════════════════════════════
//  회차 곡선 — **몇 회차에서 벽에 부딪히나.**
//
//    node tools/tiers.js [최대회차]
//
//  `tools/sim.js` 는 **1회차만** 본다. 그런데 이 게임의 목적은
//  「시간 가는 줄 모르고 계속 도는 것」이고, 그러면 진짜 물어야 할 것은
//  1회차의 템포가 아니라 **열 회차째에도 돌 만한가**다.
//  그 물음에 답하는 도구가 없어서, 「3~4회차부터 벽에 부딪힌다」가
//  growth-table.js 주석에만 적혀 있고 **숫자로는 아무도 안 재 봤다.**
//
//  계산의 뼈대는 sim.js 와 **같은 모양**이다 (attack / body).
//  숫자는 여기 적지 않는다 — 표를 그대로 읽는다.
// ══════════════════════════════════════════════════════════════════════════
import { GROWTH, perHit, mitigate, levelAtXp, xpToLevel, enemyDmgMult, HP_SCALE, itemScale, tierPower, tierRef }
  from '../web/3d/js/game/growth-table.js';
import { FLOORS, FLOORS_PER_RUN } from '../web/3d/js/world/floors.js';
import { ARCHETYPES, DENSITY } from '../web/3d/js/game/enemy-table.js';
import { BASES, RARITIES } from '../web/3d/js/game/item-table.js';
import { ATTACK_SCALE } from '../web/3d/js/game/pace.js';
import { NODES } from '../web/3d/js/game/skilltree.js';
import { plusMult, plusCap } from '../web/3d/js/game/craft-table.js';
import { LEVEL_SOFT_CAP, paraPointsAt, paraMult } from '../web/3d/js/game/paragon-table.js';

const MAX_TIER = parseInt(process.argv[2] || '9', 10);
const RUN = FLOORS.slice(0, FLOORS_PER_RUN);
const LAST = RUN[RUN.length - 1];

const roomsOf = (F) => (Array.isArray(F.rooms) ? (F.rooms[0] + F.rooms[1]) / 2 : F.rooms);
const perFloor = (F) => Math.round((roomsOf(F) - 2) *
  ((DENSITY.min + DENSITY.max) / 2 + (F.no >= DENSITY.bonusFrom ? DENSITY.bonusChance * DENSITY.bonus : 0)));

// 회차가 깊을수록 좋은 등급이 뜬다고 본다 (economy-table 의 하한이 그렇게 움직인다).
// 3등급(전설)이 상한이므로 회차가 늘어도 **여기서 멈춘다** — 그게 이 표의 요점이다.
const rarityAt = (tier) => Math.min(3, 2 + tier);
const gearScale = (f, t) => itemScale(f, t) * RARITIES[rarityAt(t)].mult;
// **손으로 메우는 두 축.** 이게 없으면 회차는 지수인데 나는 덧셈이다.
//   강화 — 그 회차 상한까지 두드렸다고 본다 (실제로는 잔해가 모자라 조금 못 미친다)
//   무한 성장 — 레벨이 멈춘 뒤 경험치가 전부 여기로 온다. 네 갈래에 고르게 찍는다고 본다
const enh = (t) => plusMult(plusCap(t));
const paraOf = (paraXp) => {
  const n = paraPointsAt(paraXp), q = n / 4;
  return { n, str: paraMult('str', q), agi: paraMult('agi', q), vit: paraMult('vit', q) };
};

/** 그 회차 한 바퀴에서 버는 경험치 (main.js 와 같이 층 배수 1 + tier×0.25) */
function xpPerRun(tier) {
  let xp = 0;
  for (const F of RUN) {
    const avg = F.roster.reduce((s, k) => s + (ARCHETYPES[k]?.xp ?? 0), 0) / F.roster.length;
    xp += perFloor(F) * avg * (1 + tier * 0.25) + 90;
  }
  return xp;
}

/** 마지막 층에서의 내 공격 — sim.js 의 attack() 과 같은 식 */
function attack(lv, t) {
  const pool = BASES.weapon.filter((b) => b.fam === '검');
  const w = pool[pool.length - 1];
  const sc = gearScale(LAST.no, t), ph = perHit(w.spd);
  const dmin = w.dmg[0] * sc + (lv - 1) * GROWTH.dmgMin.per * ph;
  const dmax = w.dmg[1] * sc + (lv - 1) * GROWTH.dmgMax.per * ph;
  const crit = GROWTH.crit.base + (w.base?.crit || 0);
  const avg = ((dmin + dmax) / 2) * (1 + (crit / 100) * (GROWTH.critMult.base - 1));
  const aps = w.spd * ATTACK_SCALE * (1 + (lv - 1) * GROWTH.aspd.per);
  return { avg, aps };
}

/** 마지막 층에서의 내 몸 — sim.js 의 body() 와 같은 식 */
function body(lv, t) {
  const sc = gearScale(LAST.no, t);
  const midArmor = (slot) => {
    const p = BASES[slot].filter((b) => (b.lvl ?? 1) <= LAST.no);
    const b = p[Math.floor(p.length / 2)] || BASES[slot][0];
    return ((b.armor[0] + b.armor[1]) / 2) * sc;
  };
  const slots = ['helm', 'armor', 'gloves', 'belt', 'boots', 'ring', 'amulet'];
  const armor = GROWTH.armor.base + (lv - 1) * GROWTH.armor.per
    + slots.reduce((s, k) => s + midArmor(k), 0);
  const hp = GROWTH.hp.base + (lv - 1) * GROWTH.hp.per + 7 * 0.5 * 15.5 * sc;
  return { hp, armor };
}

console.log(`\n회차 곡선 — 한 바퀴 ${FLOORS_PER_RUN}층 · ${LAST.no}층(회차의 끝) 기준`);
console.log(`적 ×${tierPower(1, 1).toFixed(2)}/회차 · 장비 굴림 ×${(itemScale(1, 1) / itemScale(1, 0)).toFixed(2)}/회차.`);
console.log('둘의 차이(약 ×1.09/회차)가 **강화와 무한 성장으로 손수 메울 몫**이다 —');
console.log('자동으로 다 따라잡히면 장비 여덟 칸이 차는 순간 돌 이유가 없어진다.\n');
console.log('회차  레벨  무한성장  적 배수   장비×강화   잡는데   버티는데   여유');
console.log('─'.repeat(74));

let xp = 0;
const rows = [];
for (let t = 0; t <= MAX_TIER; t++) {
  // **그 회차를 다 돌았을 때의 레벨**을 쓴다. 도는 도중이 아니라 회차의 끝
  // (마지막 층)을 보는 표이므로, 그 회차 몫을 먼저 더해야 한다.
  // 처음엔 더하기 전 값을 썼다가 1회차가 레벨 1 로 나와서 「13초 걸린다」는
  // 엉뚱한 답이 됐다 — sim.js 는 같은 자리를 2.5초로 찍는다.
  xp += xpPerRun(t);
  const rawLv = levelAtXp(xp);
  const lv = Math.min(rawLv, LEVEL_SOFT_CAP);
  // 상한을 넘긴 몫이 무한 성장으로 간다 (player.gainXp 와 같은 규칙)
  const paraXp = Math.max(0, xp - xpToLevel(LEVEL_SOFT_CAP));
  const P = paraOf(paraXp);
  const mult = tierPower(LAST.powerMult, t);
  const me = body(lv, t), atk = attack(lv, t);

  // 로스터 평균으로 본다 (sim 은 종류별로 찍지만 여기선 회차 축이 주인공이다).
  // **정예는 뺀다** — sim.js 의 요약과 같은 규칙이다. 안 빼면 골렘·조각상이
  // 평균을 끌어올려 1회차부터 「5초 걸린다」로 나오고, 그건 sim 이 같은 자리를
  // 2.5초로 찍는 것과 어긋난다. 지표 둘이 갈라지면 둘 다 못 믿게 된다.
  const R = [...new Set(LAST.roster)].map((k) => ARCHETYPES[k]).filter((d) => d && !d.elite);
  const avg = (f) => R.reduce((s, d) => s + f(d), 0) / R.length;

  const hp = avg((d) => d.hp) * mult * HP_SCALE;
  const armor = avg((d) => d.armor) * mult;
  const ref = tierRef(t);
  const E = enh(t);
  const ttk = hp / (mitigate(atk.avg * E * P.str, armor, lv, ref) * atk.aps * P.agi);

  const eDps = avg((d) => mitigate(d.dmg * enemyDmgMult(mult), me.armor * E, lv, ref) / (d.windup + d.recover));
  const ttd = (me.hp * E * P.vit) / (eDps * DENSITY.engaged);

  const bad = ttk > 3 || ttd / ttk < 2;
  rows.push({ t, lv, ttk, ttd, ratio: ttd / ttk, bad });
  console.log(
    `${String(t + 1).padStart(3)}   ${String(lv).padStart(4)}  ${String(P.n).padStart(7)}   `
    + `${mult.toFixed(1).padStart(7)}   `
    + `${(gearScale(LAST.no, t) * E).toFixed(1).padStart(9)}   ${ttk.toFixed(1).padStart(5)}초   `
    + `${ttd.toFixed(0).padStart(6)}초   ${(ttd / ttk).toFixed(2).padStart(5)}`
    + (ttk > 3 ? '  ← 늘어진다' : '') + (ttd / ttk < 2 ? '  ← 못 버틴다' : ''),
  );
}

const wall = rows.find((r) => r.bad);
console.log('');
console.log(wall
  ? `벽: **${wall.t + 1}회차.** 한 마리 ${wall.ttk.toFixed(1)}초(목표 1.5~3) · 여유 ${wall.ratio.toFixed(2)}(2 아래면 못 버틴다)`
  : `${MAX_TIER + 1}회차까지 벽 없음`);

// ── 성장의 끝 ──────────────────────────────────────────────
const nodes = Object.keys(NODES).length;
const bossPts = RUN.filter((F) => F.isBossFloor !== false).length;
console.log(`\n스킬 칸 ${nodes}개 — 1~2회차면 다 찬다 (레벨업 1 + 보스 1~2).`);
console.log(`그 뒤 레벨 ${LEVEL_SOFT_CAP} 부터는 경험치가 **무한 성장**으로 간다 — 위 표의 셋째 칸.`);
console.log('여유가 2 아래로 내려가는 자리가 「밀어붙이다 죽는」 자리다. 하드 벽이 아니라');
console.log('**개인 기록**이어야 한다 — 강화를 더 두드리고 점수를 더 모으면 한 회차 더 간다.');
console.log('');
