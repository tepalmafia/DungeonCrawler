// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **부위 · 내구 · 도망** — 크기에 따라 다른가 (v86)
//
//    node tools/space-parts.js
//
//  ★ 사장님 「적 우주선도 **각 부위별로 타격 시 더 버티던지 도망가던지**
//    해야지. **한발만에 터지는건 지양**해줘. **엔진을 정확히 타격하거나
//    핵심 시설을 타격해야 그나마 빨리 승리**하는것으로. 작은 전투기는
//    한방에도 이길 수 있지만. **크기에 따라 전투력에 따라 다르게**」
//
//  ★★ 묻는 것 여섯:
//      ① **한 발에 안 터지나** (큰 것)
//      ② **작은 것은 한 방인가** — 「작은 전투기는 한방에도」
//      ③ **부위를 맞히면 빨리 끝나나** — 안 그러면 맷집만 올린 것이다
//      ④ **겨눠야 부위가 나오나** — 대충 쏴도 핵심이 나오면 겨눌 이유가 없다
//      ⑤ **깨진 부위가 저쪽을 막나** (엔진 → 못 움직임 · 무기 → 안 쏨)
//      ⑥ **도망가나** · 엔진을 깨면 **못 도망가나**
//
//  ★ 브라우저를 안 쓴다.
// ══════════════════════════════════════════════════════════════════════════
import {
  KINDS, PARTS, partOf, FLEE, CORE_AT, ENGAGE,
} from '../web/space/js/game/target-table.js';
import {
  makeSky, setRegion, setNose, stepSky, spawnFoe, hitPart, behindOf, summary,
} from '../web/space/js/game/target.js';
import { WEAPONS } from '../web/space/js/game/combat-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const head = (t) => console.log(`\n${t}`);
const DT = 1 / 30;
function rngOf(seed = 5) {
  let h = seed >>> 0;
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507)) >>> 0) / 4294967296;
}
/** 이 무기로 이 부위만 노려서 몇 발이면 부수나 */
const shotsFor = (kind, wKey, partKey) => {
  const w = WEAPONS[wKey];
  const hp0 = KINDS[kind].hits;
  const per = w.dmg * PARTS[partKey].mult;
  return Math.ceil(hp0 / per);
};

console.log('\n부위 · 내구 · 도망 — 크기에 따라 다른가');
console.log(`   부위 ${Object.keys(PARTS).length} · 핵심은 조준 오차 ${(CORE_AT * 100).toFixed(0)}% 안 · 도망 ${(FLEE.at * 100).toFixed(0)}%`);

// ══ ① 한 발에 안 터지나 ═══════════════════════════════════════════════
head('[1] ★★★ **한 발에 안 터진다** (큰 것) — 사장님 「한발만에 터지는건 지양」');
{
  console.log('   종류      맷집  유도(선체)  유도(핵심)  레이저(선체)  레이저(핵심)');
  for (const k of ['fighter', 'drone', 'raider', 'turret', 'gunship', 'convoy']) {
    console.log(`   ${KINDS[k].name.padEnd(9)} ${String(KINDS[k].hits).padStart(3)}`
      + `  ${String(shotsFor(k, 'arh', 'hull')).padStart(8)}발`
      + `  ${String(shotsFor(k, 'arh', 'core')).padStart(8)}발`
      + `  ${String(shotsFor(k, 'laser', 'hull')).padStart(10)}발`
      + `  ${String(shotsFor(k, 'laser', 'core')).padStart(10)}발`);
  }
  for (const k of ['raider', 'turret', 'gunship', 'convoy']) {
    ok(shotsFor(k, 'arh', 'hull') >= 2,
      `${KINDS[k].name} — 유도탄으로 선체를 때리면 ${shotsFor(k, 'arh', 'hull')}발 (한 발이 아니다)`);
  }
}

// ══ ② 작은 것은 한 방 ════════════════════════════════════════════════
head('[2] ★★ **작은 것은 한 방** — 「작은 전투기는 한방에도 이길 수 있지만」');
{
  ok(shotsFor('fighter', 'arh', 'hull') === 1, '요격기는 유도탄 한 발');
  ok(shotsFor('drone', 'laser', 'hull') === 1, '자폭정은 레이저 한 발 — 먼저 보기만 하면 된다');
  ok(shotsFor('gunship', 'laser', 'hull') > shotsFor('fighter', 'laser', 'hull') * 5,
    '★★ 포함과 요격기가 **한 자리 수 이상 다르다** — 「크기에 따라」가 성립한다');
}

// ══ ③ 부위를 맞히면 빨리 ═════════════════════════════════════════════
head('[3] ★★★ **부위를 맞히면 빨리 끝난다** — 안 그러면 맷집만 올린 것이다');
{
  for (const k of ['raider', 'gunship']) {
    const hull = shotsFor(k, 'laser', 'hull');
    const core = shotsFor(k, 'laser', 'core');
    console.log(`   ${KINDS[k].name} — 레이저 선체 ${hull}발 vs 핵심 ${core}발 (${(hull / core).toFixed(1)}배)`);
    ok(core * 2 <= hull, `★ 핵심을 맞히면 **절반 이하**로 끝난다`);
  }
  ok(PARTS.core.mult > PARTS.engine.mult && PARTS.engine.mult > PARTS.hull.mult,
    '핵심 > 엔진·무기 > 선체 — 겨눌수록 이득이다');
}

// ══ ④ 겨눠야 나오나 ══════════════════════════════════════════════════
head('[4] ★★★ **대충 쏘면 핵심이 안 나온다** — 나오면 겨눌 이유가 없다');
{
  const tol = WEAPONS.laser.tol;
  const rnd = rngOf(3);
  const tally = (off, behind) => {
    const c = { core: 0, engine: 0, gun: 0, hull: 0 };
    for (let i = 0; i < 4000; i++) c[partOf(off, tol, behind, rnd).key]++;
    return c;
  };
  const dead = tally(0, 0.4);
  const wide = tally(tol * 0.9, 0.4);
  console.log(`   한가운데(오차 0)  — 핵심 ${(dead.core / 40).toFixed(0)}%`);
  console.log(`   가장자리(오차 ${(tol * 0.9).toFixed(1)}°) — 핵심 ${(wide.core / 40).toFixed(0)}%`);
  ok(dead.core > wide.core * 4, '★★ 한가운데라야 핵심이 나온다');
  ok(wide.core === 0, `오차가 ${(CORE_AT * 100).toFixed(0)}% 를 넘으면 **핵심이 아예 안 나온다**`);

  const back = tally(tol * 0.6, 1);
  const front = tally(tol * 0.6, 0);
  console.log(`   뒤를 잡았을 때 — 엔진 ${(back.engine / 40).toFixed(0)}% · 무기 ${(back.gun / 40).toFixed(0)}%`);
  console.log(`   정면일 때      — 엔진 ${(front.engine / 40).toFixed(0)}% · 무기 ${(front.gun / 40).toFixed(0)}%`);
  ok(back.engine > front.engine * 3, '★★★ **뒤를 잡으면 엔진**이 나온다 — 꽁무니가 보이니까');
  ok(front.gun > back.gun * 3, '★ 정면으로 맞붙으면 **무기**가 나온다 — 포구가 이쪽을 본다');
}

// ══ ⑤ 깨진 부위가 막나 ═══════════════════════════════════════════════
head('[5] ★★★ **깨진 부위가 저쪽을 막나**');
{
  // 엔진을 깨면 못 움직인다
  const s = makeSky(rngOf(11));
  setRegion(s, 'empty');
  stepSky(s, DT, { quiet: true });
  const t = spawnFoe(s, 'gunship');
  setNose(s, t.az, t.el);
  const d0 = t.dist;
  for (let i = 0; i < 60; i++) stepSky(s, DT, { quiet: true, moving: false });
  const moved = Math.abs(t.dist - d0) > 0.5;
  ok(moved, '멀쩡하면 움직인다');
  // 엔진 파괴
  hitPart(t, { off: 0, tol: 4, dmg: 1, rnd: () => 0.9 });
  t.dead = { move: true };
  const d1 = t.dist;
  for (let i = 0; i < 90; i++) stepSky(s, DT, { quiet: true, moving: false });
  ok(Math.abs(t.dist - d1) < 0.01, '★★★ 엔진을 깨면 **꼼짝 못 한다**');

  // 무기를 깨면 안 쏜다
  const s2 = makeSky(rngOf(12));
  setRegion(s2, 'empty');
  stepSky(s2, DT, { quiet: true });
  const g = spawnFoe(s2, 'gunship');
  g.dist = 80; setNose(s2, g.az, g.el);
  let fired = 0;
  for (let i = 0; i < 400; i++) { const e = stepSky(s2, DT, { quiet: true }); fired += s2.incoming.length; }
  ok(fired > 0, '멀쩡하면 쏜다');
  g.dead = { shoot: true };
  s2.incoming.length = 0;
  for (let i = 0; i < 400; i++) stepSky(s2, DT, { quiet: true });
  ok(s2.incoming.length === 0, '★★★ 무기를 깨면 **한 발도 안 쏜다**');
}

// ══ ⑥ 도망 ═══════════════════════════════════════════════════════════
head('[6] ★★★ **맞으면 도망간다** — 그리고 엔진을 깨면 못 도망간다');
{
  const s = makeSky(rngOf(21));
  setRegion(s, 'empty');
  stepSky(s, DT, { quiet: true });
  const t = spawnFoe(s, 'gunship');
  t.dist = 90; setNose(s, t.az, t.el);
  t.hp = KINDS.gunship.hits * (FLEE.at - 0.02);
  const d0 = t.dist;
  for (let i = 0; i < 90; i++) stepSky(s, DT, { quiet: true, moving: false });
  console.log(`   맷집 ${(FLEE.at * 100).toFixed(0)}% 밑 — ${d0}m 에서 ${t.dist.toFixed(0)}m 로`);
  ok(t.fleeing && t.dist > d0 + 5, '★★ **뺀다**');

  // 엔진을 깨 두면
  const s2 = makeSky(rngOf(22));
  setRegion(s2, 'empty');
  stepSky(s2, DT, { quiet: true });
  const g = spawnFoe(s2, 'gunship');
  g.dist = 90; g.hp = KINDS.gunship.hits * (FLEE.at - 0.02);
  g.dead = { move: true };
  const gd = g.dist;
  for (let i = 0; i < 90; i++) stepSky(s2, DT, { quiet: true, moving: false });
  ok(Math.abs(g.dist - gd) < 0.01,
    '★★★ 엔진을 먼저 깨 놓으면 **못 도망간다** — 그래서 「엔진부터 깰까」가 결심이 된다');

  // 작은 것은 안 뺀다
  const s3 = makeSky(rngOf(23));
  setRegion(s3, 'empty');
  stepSky(s3, DT, { quiet: true });
  const f = spawnFoe(s3, 'drone');
  f.hp = 0.2;
  const fd = f.dist;
  for (let i = 0; i < 60; i++) stepSky(s3, DT, { quiet: true, moving: false });
  ok(!f.fleeing && f.dist < fd, '★ 자폭정은 **안 뺀다** — 몸이 탄이다');
}

console.log(bad ? `\n✘ ${bad} 개가 안 맞습니다` : '\n✔ 전부 맞습니다');
console.log(`
  ※ **「싸우는 맛이 나나」는 여기서 안 나온다.** 여기서 나오는 것은
     「한 발에 안 터지나 · 크기가 다른가 · 겨누면 이득인가 · 깨진 부위가
     막나 · 도망가나」뿐이다.`);
process.exit(bad ? 1 : 0);
