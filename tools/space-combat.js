// ══════════════════════════════════════════════════════════════════════════
//  ★★★ 조종석 전투 — **레이더 · 락온 · 미사일** (v64)
//
//    node tools/space-combat.js
//
//  ★ 사장님: 「주포도 없애고 공격은 조정석에서 다 이루어질 수 있도록 …
//             기존 전투기들 전투 데이터를 참고해서 … 레이더, 미사일, 락온」
//
//  ★★ 묻는 것 여덟. 앞의 넷은 **되나**, 뒤의 넷은 **말이 되나**다.
//
//      ① 레이더가 원뿔인가 — 어디를 보느냐가 무엇을 보느냐다
//      ② 묶는 데 시간이 드나 · 벗어나면 깨지나
//      ③ 무기 셋이 서로를 못 대신하나 — 하나가 다 되면 셋일 이유가 없다
//      ④ 발사 봉투가 있나 — 너무 멀어도 너무 가까워도 못 쏜다
//      ⑤ ★★ **제일 센 무기가 제일 밝은가** — 이 판의 축
//      ⑥ ★★ **밖의 것이 배 안으로 안 들어오나** (사장님이 짚으신 것)
//      ⑦ ★ 적 우주선을 **부술 수 있나** · 안 부수면 죽나
//      ⑧ ★★ **장르가 안 바뀌었나** — 조종석에 매인 시간
//
//  ★★ ⑧ 이 제일 중요하다. `CHASE2.md §5` 가 「미사일·함포」를 **안 하는
//     것**에 넣어 뒀다 — 사장님이 두 번 뒤집으셨으므로 만들되,
//     **안전핀은 숫자로 붙들어 둔다.**
// ══════════════════════════════════════════════════════════════════════════
import {
  RADAR, WEAPONS, WEAPON_LIST, GENRE, WHY,
  whyNotFire, inEnvelope, hitChance, inCone, coneCoversSky, lockWord,
} from '../web/space/js/game/combat-table.js';
import {
  makeCombat, weaponOf, isLocked, stepRadar, stepShots, stepCool, pickSlot, fire, forgetLock,
} from '../web/space/js/game/combat.js';
import { KINDS, TARGET, HULL } from '../web/space/js/game/target-table.js';
import { makeSky, setRegion, stepSky, spawnRaider, summary as skySummary } from '../web/space/js/game/target.js';
import { SIGN } from '../web/space/js/game/chase-table.js';
import { LEG } from '../web/space/js/game/route-table.js';
import { makeRng } from '../web/space/js/core/rng.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DT = 1 / 30;
/** 조준선이 표적을 잡은 모양 */
const aim = (t, off = 0) => ({ t, off });
const fakeTarget = (o = {}) => ({ id: 1, kind: 'junk', az: 0, el: 0, dist: 80, vaz: 0, vel: 0, hp: 1, ...o });

console.log('\n조종석 전투 — 레이더 · 락온 · 미사일');

console.log('\n[1] ★ **레이더가 원뿔인가** — 어디를 보느냐가 무엇을 보느냐다');
{
  ok(inCone(0, 0), '정면은 본다');
  ok(!inCone(RADAR.az + 5, 0), `방위 ${RADAR.az}도 밖은 **안 보인다**`);
  ok(!inCone(0, RADAR.el + 5), `고도 ${RADAR.el}도 밖은 안 보인다`);
  // ★ 화면에 뜨는 범위보다 넓어야 한다 — 좁으면 「보이는데 레이더에 없다」
  ok(coneCoversSky(),
    `★★ 레이더 원뿔(${RADAR.az}·${RADAR.el})이 표적이 뜨는 범위(${TARGET.azLimit}·${TARGET.elLimit})를 **덮는다** —`
    + ' 안 덮으면 「보이는데 레이더에 없는」 것이 생기고 그건 계기가 거짓말하는 것이다');
  ok(RADAR.range > TARGET.spawn[1],
    `탐지 거리(${RADAR.range})가 표적이 나는 제일 먼 곳(${TARGET.spawn[1]})보다 멀다 — **먼저 본다**`);
}

console.log('\n[2] ★★ **묶는 데 시간이 들고, 벗어나면 깨지나**');
{
  const c = makeCombat(); c.radar.on = true;
  const t = fakeTarget();
  let ev = null, s = 0;
  while (s < RADAR.lockFor - 0.2) { ev = stepRadar(c, DT, aim(t, 2)); s += DT; }
  ok(!isLocked(c, t), `${(RADAR.lockFor - 0.2).toFixed(1)}초로는 아직 못 묶는다 (${lockWord({ ...c.radar, locked: false })})`);
  while (s < RADAR.lockFor + 0.3 && ev !== 'lock') { ev = stepRadar(c, DT, aim(t, 2)); s += DT; }
  ok(ev === 'lock' && isLocked(c, t), `★ ${RADAR.lockFor}초를 겨누고 있으면 **묶인다**`);

  // 잠깐 벗어나도 안 깨진다
  let e2 = null, g = 0;
  while (g < RADAR.holdGrace - 0.2) { e2 = stepRadar(c, DT, aim(t, RADAR.lockCone + 20)); g += DT; }
  ok(e2 !== 'break' && isLocked(c, t),
    `★ 잠깐(${(RADAR.holdGrace - 0.2).toFixed(1)}초) 벗어나도 **안 깨진다** — 0 이면 손이 떨릴 때마다 깨져서 묶는 것이 벌이 된다`);
  while (g < RADAR.holdGrace + 0.4 && e2 !== 'break') { e2 = stepRadar(c, DT, aim(t, RADAR.lockCone + 20)); g += DT; }
  ok(e2 === 'break' && !isLocked(c, t), '오래 벗어나면 **깨진다**');

  // 레이더를 끄면 놓는다
  const c2 = makeCombat(); c2.radar.on = true;
  for (let i = 0; i < 200; i++) stepRadar(c2, DT, aim(t, 1));
  ok(isLocked(c2, t), '다시 묶었다');
  c2.radar.on = false; stepRadar(c2, DT, aim(t, 1));
  ok(!isLocked(c2, t), '★ 레이더를 끄면 **놓는다** — 묶은 채로 숨을 수는 없다');
}

console.log('\n[3] ★★ **무기 셋이 서로를 못 대신하나**');
{
  for (const w of WEAPON_LIST) {
    console.log(`   ${w.slot}. ${w.name.padEnd(5)} 사거리 ${String(w.rMin).padStart(3)}~${String(w.rMax).padStart(3)}m`
      + ` · 맷집 ${w.dmg} · 값 ${w.cost.ore ? '광석 ' + w.cost.ore : ''}${w.cost.parts ? '부품 ' + w.cost.parts : ''}`
      + ` · 자국 ${w.sign} · ${w.needLock ? '**락온 필요**' : '락온 없이'}`);
  }
  const r = WEAPON_LIST.map((w) => [w.rMin, w.rMax]);
  ok(new Set(WEAPON_LIST.map((w) => w.rMax)).size === WEAPON_LIST.length,
    '사거리가 셋 다 다르다 — 같으면 하나만 쓴다');
  ok(WEAPONS.cannon.rMax < WEAPONS.ir.rMax && WEAPONS.ir.rMax < WEAPONS.arh.rMax,
    `기총(${WEAPONS.cannon.rMax}) < 열추적(${WEAPONS.ir.rMax}) < 유도(${WEAPONS.arh.rMax}) — 붙을수록 싼 것`);
  ok(WEAPONS.cannon.dmg < WEAPONS.ir.dmg && WEAPONS.ir.dmg < WEAPONS.arh.dmg,
    '멀리 가는 것이 더 세다 — 대신 값과 자국이 크다');
  ok(WEAPONS.ir.rMin > 0,
    `★ 열추적의 **최소 사거리**가 ${WEAPONS.ir.rMin}m — 너무 가까우면 신관이 안 선다.`
    + ' 「붙었으면 기총」이라는 갈림이 여기서 생긴다');
  ok(WEAPONS.cannon.lead && !WEAPONS.ir.lead,
    '★ 기총만 **선도(lead)** 를 준다 — 탄이 날아가는 동안 표적이 흐른다');
  void r;
}

console.log('\n[4] ★ **발사 봉투** — 너무 멀어도 너무 가까워도 못 쏜다');
{
  const w = WEAPONS.ir;
  ok(!inEnvelope(w, w.rMin - 5), `${w.rMin - 5}m 는 **너무 가깝다**`);
  ok(inEnvelope(w, (w.rMin + w.rMax) / 2), '가운데는 봉투 안');
  ok(!inEnvelope(w, w.rMax + 5), `${w.rMax + 5}m 는 **너무 멀다**`);
  const mid = hitChance(w, (w.rMin + w.rMax) / 2);
  const edge = hitChance(w, w.rMax - 1);
  console.log(`   맞을 확률 — 가운데 ${(mid * 100).toFixed(0)}% · 끝 ${(edge * 100).toFixed(0)}%`);
  ok(mid > edge,
    '★ 봉투 **끝으로 갈수록 잘 못 맞힌다** — 실제로도 R_max 근처에서 미사일은 에너지가 없다');
  // 왜 못 쏘는지 말한다
  const say = new Set();
  for (const s of [
    { weapon: w, supply: { ore: 0, parts: 0 }, target: fakeTarget() },
    { weapon: w, supply: { parts: 9 }, cool: 2, target: fakeTarget() },
    { weapon: w, supply: { parts: 9 }, target: null },
    { weapon: WEAPONS.arh, supply: { parts: 9 }, target: fakeTarget(), radar: true, locked: false },
    { weapon: WEAPONS.arh, supply: { parts: 9 }, target: fakeTarget(), radar: false },
    { weapon: w, supply: { parts: 9 }, target: fakeTarget({ dist: 400 }) },
    { weapon: w, supply: { parts: 9 }, target: fakeTarget({ dist: 5 }) },
  ]) say.add(whyNotFire(s));
  for (const k of say) console.log(`   「${WHY[k] ?? k}」`);
  ok(say.size >= 6, `왜 못 쏘는지를 ${say.size}가지로 말한다 — 조용히 안 나가면 「고장났다」로 읽힌다`);
}

console.log('\n[5] ★★★ **제일 센 무기가 제일 밝은가** — 이 판의 축');
{
  const c = WEAPONS.cannon, ir = WEAPONS.ir, ar = WEAPONS.arh;
  ok(c.sign < ir.sign && ir.sign < ar.sign,
    `자국 — 기총 ${c.sign} < 열추적 ${ir.sign} < 유도 ${ar.sign}. **셀수록 밝다**`);
  ok(ar.needLock && !ir.needLock,
    '★★ 유도탄만 **락온이 필요하다** — 그리고 락온은 레이더를 켠 채로 있는 것이다');
  ok(!ar.fireForget && ir.fireForget,
    '★★ 열추적은 **쏘고 잊고**, 유도탄은 **끝까지 묶고 있어야** 한다.'
    + ' 즉 유도탄을 쓰는 동안 내내 훤히 보인다');
  ok(RADAR.range > 0 && SIGN.sensor >= 20,
    `★ 레이더 자국은 **여기 다시 안 적는다** — `
    + `\`chase-table.js SIGN.sensor\`(${SIGN.sensor})가 이미 들고 있다. 두 곳에 적으면 갈라진다`);

  // ★★ 유도탄을 쏘고 레이더를 끄면 **길을 잃는다**
  const cc = makeCombat(); cc.radar.on = true; cc.slot = 3;
  const t = fakeTarget({ dist: 150 });
  for (let i = 0; i < 200; i++) stepRadar(cc, DT, aim(t, 1));
  const sup = { ore: 60, parts: 9 };
  const f = fire(cc, { aimed: aim(t, 1), supply: sup, rnd: () => 0.1 });
  ok(f.ok, `유도탄이 나갔다 (부품 ${9 - sup.parts} 씀)`);
  cc.radar.on = false; stepRadar(cc, DT, aim(t, 1));      // 레이더를 껐다
  let out = [];
  for (let i = 0; i < 200 && !out.length; i++) {
    out = stepShots(cc, DT, { find: (id) => (id === t.id ? t : null), lockedId: cc.radar.id });
  }
  ok(out.length === 1 && !out[0].hit,
    '★★★ 쏘고 **레이더를 끄면 유도탄이 길을 잃는다** — 「쏘고 숨기」가 안 된다');
}

console.log('\n[6] ★★★ **밖의 것이 배 안으로 안 들어오나** (사장님이 짚으신 것)');
{
  console.log(`   선체 바닥 ${HULL.radius}m · 「지나갔다」 선 ${TARGET.gone}m`);
  ok(HULL.radius > TARGET.gone,
    `★★ 선체 바닥(${HULL.radius})이 「지나갔다」 선(${TARGET.gone})보다 **바깥**이다 —`
    + ' 처음에 14 로 뒀다가 18 에서 목록에서 빠져 **닿는 것이 하나도 없었다.**'
    + ' 바닥을 깔았는데 그 위에 뚜껑이 있었던 셈이다');
  const sky = makeSky(makeRng('HULL')); setRegion(sky, 'debris');
  stepSky(sky, 0.1, {}); spawnRaider(sky);
  let t = 0, near = 1e9, bumps = 0;
  while (t < 150) {
    const b = stepSky(sky, DT, { moving: true });
    bumps += b.length;
    for (const x of sky.list) near = Math.min(near, x.dist);
    t += DT;
  }
  const s = skySummary(sky);
  console.log(`   2분반 — 제일 가까이 온 것 ${near.toFixed(1)}m · 스침 ${s.grazes} · 들이받음 ${s.rams}`);
  ok(near >= HULL.radius - 0.01,
    `★★★ **어떤 것도 ${HULL.radius}m 안으로 못 들어온다** — 「내부로 들어오는 부자연스러운 것」이 여기서 막힌다`);
  ok(bumps > 0, `부딪히기는 한다 (${bumps}번) — 안 부딪히는 것과 뚫고 지나가는 것은 다르다`);
  ok(s.grazes < s.rams,
    `★ 옆으로 비켜 가는 것은 **안 부딪힌다** (스침 ${s.grazes} vs 들이받음 ${s.rams}) —`
    + ` 정면 ±${HULL.hitAz}도 안에 있는 것만 맞는다. 다 맞으면 우주가 아니라 자갈길이다`);
}

console.log('\n[7] ★ **적 우주선을 부술 수 있나 · 안 부수면 죽나**');
{
  const R = KINDS.raider;
  console.log(`   적 우주선 — 맷집 ${R.hits} · 초당 ${R.closes}m 다가온다 · 자국 ${R.sign}`);
  ok(R.weight === 0,
    '★ **저절로는 안 뜬다** (weight 0) — 장면과 추격이 부른다.'
    + ' 무작위로 튀어나오면 「가는 동안 고친다」가 「가는 동안 싸운다」가 된다');
  ok(R.hits > WEAPONS.cannon.dmg * 3,
    `★★ 맷집 ${R.hits} 이라 **기총만으로는 벅차다** (한 발에 ${WEAPONS.cannon.dmg}) —`
    + ' 미사일이 있어야 할 이유가 여기서 처음 생긴다');
  const kills = Math.ceil(R.hits / WEAPONS.arh.dmg);
  ok(kills <= 2, `유도탄 ${kills}발이면 부순다 — 셋 이상이면 부품이 못 견딘다`);

  // 안 부수면 얼마 만에 죽나
  const sky = makeSky(makeRng('RAID')); setRegion(sky, 'empty');
  stepSky(sky, 0.1, {}); spawnRaider(sky);
  let t = 0, hull = 0;
  while (t < 400 && hull < 1) {
    for (const b of stepSky(sky, DT, { moving: true })) hull += b.ram ? HULL.ram.hull : HULL.graze.hull;
    t += DT;
  }
  console.log(`   안 쏘고 두면 ${(t / 60).toFixed(1)}분에 선체가 바닥난다`);
  ok(t > 90 && t < 300,
    `★★ 안 부수면 **${(t / 60).toFixed(1)}분**에 죽는다 (1.5~5분) — 5초면 사고고, 10분이면 무시해도 된다`);
}

console.log('\n[8] ★★ **장르가 안 바뀌었나** — 조종석에 매인 시간');
{
  const RUN = LEG.seconds * LEG.count;
  // 「필요할 때만 앉는다」를 흉내낸다: 회차에 싸움 N 번, 한 번에 M 초
  const fights = 10, each = 22;
  const seat = fights * each;
  const pct = (seat / RUN) * 100;
  console.log(`   회차 ${(RUN / 60).toFixed(0)}분에 싸움 ${fights}번 × ${each}초 = ${seat}초`);
  ok(pct <= GENRE.seatShareMax * 100,
    `★★★ 조종석에 매인 시간이 **${pct.toFixed(1)}%** — ${(GENRE.seatShareMax * 100).toFixed(0)}% 이하.`
    + ' 넘으면 정비공이 아니라 전투기 조종사다 (CHASE2 §5)');
  ok(fights <= GENRE.fightsMax, `싸움이 회차에 ${fights}번 — ${GENRE.fightsMax}번 이하`);
  ok(GENRE.seatShareMax < 0.27,
    `★ 안전핀을 **합치면서 줄였다** (조종 15% + 포탑 12% = 27% → ${(GENRE.seatShareMax * 100).toFixed(0)}%) —`
    + ' 27% 면 회차의 4분의 1 이 넘고, 그건 「가는 동안 고친다」가 아니다');
}

console.log('\n[9] 무기를 고르는 것과 재는 것');
{
  const c = makeCombat();
  ok(weaponOf(c).slot === 1, '처음엔 기총');
  ok(pickSlot(c, 3)?.key === 'arh' && weaponOf(c).key === 'arh', '3 을 누르면 유도탄');
  ok(!pickSlot(c, 9), '없는 슬롯은 안 바뀐다');
  c.cool = WEAPONS.arh.reload;
  stepCool(c, 1, { atSeat: true });
  ok(c.cool > 0 && c.seat === 1, '재는 시간이 흐르고, 앉은 시간이 쌓인다');
  // 묶은 것이 부서지면 락온도 놓는다
  const c2 = makeCombat(); c2.radar.on = true; c2.radar.id = 7;
  forgetLock(c2, 7);
  ok(c2.radar.id === null, '★ 묶은 것이 부서지면 **락온도 같이 놓는다** — 없는 것을 묶고 있으면 계기가 거짓말한다');
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「싸우는 맛이 나나」는 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「원뿔인가 · 묶이나 · 셋이 다른가 · 안 들어오나 · 정비공인 채인가」뿐이다.');
process.exit(fail ? 1 : 0);
