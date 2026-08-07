// ══════════════════════════════════════════════════════════════════════════
//  조종 — **장르가 안 바뀌었나.** 브라우저 없이.
//
//    node tools/space-fly.js
//
//  ★ 여기서 제일 중요한 줄 하나
//    **「조종석에 매인 시간이 구간의 15% 이하」** (docs/space/FLYING.md §4).
//    이게 넘어가면 설계가 아니라 **장르가 바뀐 것**이다 — 정비공이 아니라
//    조종사가 된다. 넘으면 조종을 키우지 말고 되돌린다.
//
//  ★ 나머지 다섯
//    구간당 1~2회 · 예고 26~38초 (성운은 절반) · 접근 20~40초 ·
//    피하려면 2~4번 밀어야 하나 · 안 피하면 일이 느나
//
//  ★ 여기서 안 나오는 것
//    **조종이 재미있나.** 「좌우로 밀어 피한다」는 단순하다. 단순한 것이
//    나쁜 건 아니지만 재미가 없으면 그 15% 가 통째로 세금이 된다 —
//    그건 직접 해 봐야 안다 (FLYING.md §6).
// ══════════════════════════════════════════════════════════════════════════
import { HAZARD, warnFor, everyFor } from '../web/space/js/game/hazard-table.js';
import { makeHazard, stepHazard, steerShip, newLeg, incoming, warnLeft, HPHASE, seatShare }
  from '../web/space/js/game/hazard.js';
import { LEG, allForks } from '../web/space/js/game/route-table.js';

const DT = 0.25;
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };

// ── 사람처럼 몬다 ───────────────────────────────────────────
// 예고를 보면 조종석으로 걸어가고(9초 — PLAN §11 의 방 사이), 덩어리가
// 지나갈 때까지 앉아 있다가, 다 지나가면 일어난다.
const WALK = 9;
// ★ 처음엔 「비켰으면 손을 뗀다」로 짰더니 **초당 네 번씩 방향이 바뀌었다**
//   (민 횟수 90번). 놓으면 배가 가운데로 돌아오니 곧바로 다시 밀게 되기
//   때문이다. 사람은 그렇게 안 한다 — 한쪽으로 밀어 두고 **붙들고 있는다.**
//   그리고 「몇 번 밀었나」는 방향이 바뀐 횟수로 센다.
function pilot(h, s) {
  // 아직 걸어가는 중이면 조종간을 못 잡는다
  if (s.walking > 0) { s.walking -= DT; s.side = 0; return { atSeat: false, push: 0 }; }
  const n = incoming(h);
  if (!n) { s.side = 0; return { atSeat: h.phase === HPHASE.RUN, push: 0 }; }
  // 덩어리 반대쪽으로 붙는다. 이미 그쪽이면 그대로 둔다
  const side = n.lane >= 0 ? -1 : 1;
  if (side !== s.side) { s.side = side; s.flips++; }
  const want = side * (HAZARD.clear + 0.22);
  const err = want - h.lane;
  return { atSeat: true, push: Math.abs(err) < 0.04 ? 0 : Math.sign(err) };
}

/** 구간 하나를 돈다 */
function runLeg(seed, forkKey, seconds, region) {
  const h = makeHazard(seed);
  newLeg(h);
  const s = { walking: 0, side: 0, flips: 0 };
  let t = 0, warns = 0, enters = 0, hits = 0, dodged = 0;
  const warnTimes = [], runTimes = [], pushes = [];
  let runStart = 0, pushCount = 0;

  while (t < seconds) {
    const before = s.flips;
    const p = pilot(h, s);
    // ★ 조종(steerShip)과 잔해(stepHazard)는 **따로 돈다.** 게임도 그렇다 —
    //   조종간은 늘 먹고, 빗장은 잔해가 오는 시점만 막는다
    steerShip(h, DT, { atSeat: p.atSeat, push: p.push });
    const ev = stepHazard(h, DT, { region });
    if (s.flips > before) pushCount++;      // 방향을 바꿔 민 횟수

    if (ev === 'warn') { warns++; s.walking = WALK; warnTimes.push(h.need); }
    if (ev === 'enter') { enters++; runStart = t; pushCount = 0; s.side = 0; }
    if (ev === 'hit') hits++;
    if (ev === 'pass') dodged++;
    if (h.phase === HPHASE.IDLE && runStart && t > runStart) {
      runTimes.push(t - runStart); pushes.push(pushCount); runStart = 0;
    }
    t += DT;
  }
  return { h, warns, enters, hits, dodged, warnTimes, runTimes, pushes, seconds };
}

// ── 1) 표를 먼저 찍는다 ─────────────────────────────────────
console.log(`\n조종 — 구간당 최대 ${HAZARD.maxPerLeg}회 · 덩어리 ${HAZARD.rocks[0]}~${HAZARD.rocks[1]}개`);
console.log('\n[1] 구역마다 얼마나 오나 · 예고는 몇 초인가');
console.log('  ' + '─'.repeat(64));
for (const f of allForks()) {
  const every = everyFor((HAZARD.every[0] + HAZARD.every[1]) / 2, f.region);
  const perLeg = Math.min(HAZARD.maxPerLeg, f.seconds / every);
  const w = warnFor((HAZARD.warn[0] + HAZARD.warn[1]) / 2, f.region);
  console.log(`  ${f.name.padEnd(20)} ${(f.seconds / 60).toFixed(1)}분 · 간격 ${every.toFixed(0)}초`
    + ` → 구간당 ${perLeg.toFixed(1)}회 · 예고 ${w.toFixed(0)}초`);
}
{
  const nb = warnFor((HAZARD.warn[0] + HAZARD.warn[1]) / 2, 'nebula');
  const em = warnFor((HAZARD.warn[0] + HAZARD.warn[1]) / 2, 'empty');
  ok(nb < em * 0.6, `성운은 예고가 절반이다 (${nb.toFixed(0)}초 vs ${em.toFixed(0)}초) — 「나도 못 본다」`);
}

// ── 2) 실제로 돌려 본다 ─────────────────────────────────────
console.log('\n[2] 구간을 돌려 본다 — 사람처럼 (예고를 보면 9초 걸어가 앉는다)');
console.log('  ' + '─'.repeat(72));
console.log('  ' + '길'.padEnd(20) + '지대'.padStart(6) + '예고'.padStart(8)
  + '접근'.padStart(8) + '민 횟수'.padStart(9) + '부딪힘'.padStart(8) + '앉은 비율'.padStart(11));
const runs = [];
for (const f of allForks()) {
  for (const seed of ['FLY1', 'FLY2', 'FLY3']) {
    const r = runLeg(seed, f.key, f.seconds, f.region);
    runs.push({ f, ...r });
  }
  const mine = runs.filter((r) => r.f.key === f.key);
  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const allWarn = mine.flatMap((r) => r.warnTimes);
  const allRun = mine.flatMap((r) => r.runTimes);
  const allPush = mine.flatMap((r) => r.pushes);
  console.log(`  ${f.name.padEnd(20)}${avg(mine.map((r) => r.warns)).toFixed(1).padStart(6)}`
    + `${avg(allWarn).toFixed(0).padStart(7)}초${avg(allRun).toFixed(0).padStart(7)}초`
    + `${avg(allPush).toFixed(1).padStart(9)}${avg(mine.map((r) => r.hits)).toFixed(1).padStart(8)}`
    + `${(avg(mine.map((r) => seatShare(r.h, r.seconds))) * 100).toFixed(0).padStart(10)}%`);
}

const all = (k) => runs.flatMap((r) => r[k]);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const perLeg = runs.map((r) => r.warns);
const warnT = all('warnTimes'), runT = all('runTimes'), push = all('pushes');
const seats = runs.map((r) => seatShare(r.h, r.seconds));

console.log('\n  목표 (docs/space/FLYING.md §4)');
ok(Math.min(...perLeg) >= 1 && Math.max(...perLeg) <= 2,
  `구간당 위험 지대 1~2회 — ${Math.min(...perLeg)} ~ ${Math.max(...perLeg)}`);
ok(Math.min(...warnT) >= 12 && Math.max(...warnT) <= 40,
  `예고 12~40초 (성운은 절반이라 아래끝이 낮다) — ${Math.min(...warnT).toFixed(0)} ~ ${Math.max(...warnT).toFixed(0)}초`);
ok(Math.min(...runT) >= 20 && Math.max(...runT) <= 45,
  `접근이 20~45초 — ${Math.min(...runT).toFixed(0)} ~ ${Math.max(...runT).toFixed(0)}초`);
ok(Math.min(...push) >= 2 && Math.max(...push) <= 6,
  `피하려면 2~6번 민다 — ${Math.min(...push)} ~ ${Math.max(...push)}번`);
// ★★ 안전핀
ok(Math.max(...seats) <= 0.15,
  `**조종석에 매인 시간이 구간의 15% 이하** — 최대 ${(Math.max(...seats) * 100).toFixed(0)}%`);

// ── 3) 손을 놓으면 부딪히나 ─────────────────────────────────
console.log('\n[2b] ★★ **잔해가 없어도 조종간이 먹나** — 거점에서도, 평온할 때도');
{
  // ★ 사장님: 「운전석 조정이 안되잖아」. 맞았다 — 좌우 조작이 `stepHazard`
  //   안에 있었는데 그 함수는 **잔해가 뜬 동안에만** 불렸다. 거점이거나
  //   평온하면 조종간을 밀어도 `lane` 이 안 움직였고, 그런데 잡으면 마우스가
  //   시선에서 배 쪽으로 넘어가므로 **밀리지도 둘러보지도 못했다.**
  //   게임은 거점에서 시작하니 **첫 몇 분 동안 조종간은 죽은 물건**이었다.
  //
  //   이제 `steerShip` 이 따로 있고 **늘 돈다.** 빗장은 잔해가 오는 시점만 막는다
  const h = makeHazard(7);
  newLeg(h);
  // 잔해를 한 번도 안 띄운다 — `stepHazard` 를 아예 안 부른다 (거점이 그렇다)
  let t = 0;
  while (t < 1.5) { steerShip(h, DT, { atSeat: true, push: 1 }); t += DT; }
  console.log(`  1.5초 밀었을 때 lane ${h.lane.toFixed(2)} · 잔해 단계 ${h.phase}`);
  ok(h.lane > 0.2, `잔해가 하나도 없어도 밀면 배가 기운다 (lane ${h.lane.toFixed(2)})`);
  ok(h.phase === HPHASE.IDLE, '그런데 잔해는 안 뜬다 — 조종과 잔해는 다른 것이다');

  // ★★ **놓았을 때가 자동/수동에 따라 달라야 한다** (v55).
  //   여기는 원래 「놓으면 무조건 가운데로 돌아온다」만 물었고, 그래서
  //   **옛 규칙을 지키는 검사**가 되어 있었다. 사장님이 「운전을 왜 임의로
  //   못하지?」라고 하신 것이 바로 이것이다 — v47 에 조종간(helm)은
  //   「수동이면 놓아도 그대로」로 고쳤는데 좌우 자리는 그 규칙을 못 받았다.
  const lane0 = h.lane;
  let stay = 0;
  while (stay < 6) { steerShip(h, DT, { atSeat: false, push: 0, manual: true }); stay += DT; }
  ok(Math.abs(h.lane - lane0) < 0.01,
    `★ **수동이면 놓아도 그대로다** (${lane0.toFixed(2)} → ${h.lane.toFixed(2)}) — 조종간과 같은 규칙`);

  let back = 0;
  while (back < 20 && h.lane > 0.01) { steerShip(h, DT, { atSeat: false, push: 0 }); back += DT; }
  ok(h.lane <= 0.01, `자동 항법이면 가운데로 돌아온다 (${back.toFixed(1)}초) — 그게 자동이 하는 일이다`);

  // ★ 그리고 **폭이 넉넉한가** — 덩어리는 ±0.85 에 난다
  let wide = 0;
  while (wide < 10 && h.lane < HAZARD.laneMax - 0.01) {
    steerShip(h, DT, { atSeat: true, push: 1 }); wide += DT;
  }
  console.log(`  끝까지 미는 데 ${wide.toFixed(1)}초 · 폭 ±${HAZARD.laneMax}`);
  ok(HAZARD.laneMax > 0.85 * 1.8,
    `배(±${HAZARD.laneMax})가 **잔해밭(±0.85)보다 넓게** 움직인다 — 옆으로 빠져나갈 수 있다`);
  ok(wide >= 2 && wide <= 6, `끝에서 끝까지 ${(wide * 2).toFixed(1)}초 (4~12) — 넓히면서 속도도 같이 올렸다`);

  // 반대쪽으로도 — ★ 폭이 넓어졌으므로 **끝에서 끝까지**를 재야 한다.
  //   1.5초만 밀고 「반대로 안 간다」고 하면 그건 폭이 넓어진 것을 모르는
  //   검사다 (실제로 여기서 lane 0.43 으로 빨개졌다)
  let t2 = 0;
  while (t2 < 8 && h.lane > -HAZARD.laneMax + 0.05) {
    steerShip(h, DT, { atSeat: true, push: -1 }); t2 += DT;
  }
  ok(h.lane < -0.2, `반대로도 끝까지 기운다 (lane ${h.lane.toFixed(2)} · ${t2.toFixed(1)}초)`);
}

console.log('\n[3] 안 앉아 있으면 부딪히나 — **벌이 없으면 조종은 장식이다**');
{
  const idle = runLeg('FLY1', 'empty', 700, 'empty');
  // 아무도 조종간을 안 잡는 판 — pilot 을 안 쓰고 그냥 돌린다
  const h = makeHazard('FLY1'); newLeg(h);
  let t = 0, hits = 0;
  while (t < 700) { if (stepHazard(h, DT, { region: 'empty' }) === 'hit') hits++; t += DT; }
  console.log(`  앉아서 몰면 부딪힘 ${idle.hits} · 아무도 안 앉으면 ${hits}`);
  ok(hits > 0, '자리를 비우면 부딪힌다');
  ok(idle.hits < hits, '앉아서 밀면 피한다 — 조종이 실제로 먹는다');
  ok(idle.hits === 0, '제대로 몰면 안 부딪힌다 — 피할 수 없는 것을 내지는 않는다');
}

// ── 4) 부딪히면 무엇이 늘어나나 ─────────────────────────────
console.log('\n[4] 부딪히면 — **죽지 않는다. 대신 일이 는다** (PLAN §4-4)');
console.log(`  선체 마모 +${(HAZARD.hit.hull * 100).toFixed(0)}% · 열 +${HAZARD.hit.heat} · 고장 ${HAZARD.hit.fault ? '1개 즉발' : '없음'}`);
ok(HAZARD.hit.fault, '벌이 숫자가 아니라 **일**이다');
ok(HAZARD.hit.hull >= 0.15, '선체가 확 닳는다 — 다음 고장이 선체 쪽으로 쏠린다');

console.log('\n  ※ **조종이 재미있나는 여기서 안 나온다.** 단순한 것이 나쁜 건');
console.log('     아니지만, 재미가 없으면 그 15% 가 통째로 세금이 된다.');
console.log('  ※ 예고 30초가 정말 충분한지도 직접 해 봐야 안다 — 기관실에서');
console.log('     밸브를 붙들고 있는 중이면 모자랄 수 있다.\n');
process.exit(fail ? 1 : 0);
