// ══════════════════════════════════════════════════════════════════════════
//  ★ C — 자동 조종 사망. **세 갈래가 서로 비긴가** — 브라우저 없이.
//
//    node tools/space-drift.js
//    node tools/space-drift.js --see 8391    + 실제 배에서 왕복 시간을 잰다
//
//  ★ 여기서 묻는 것은 「부딪힘이 몇 번인가」가 아니다.
//    **「세 갈래 중 하나가 확실히 낫지는 않은가」**다. 하나가 확실히 나으면
//    그건 선택이 아니라 **정답이 있는 퀴즈**이고, 퀴즈는 두 번째부터
//    안 재미있다 (PLAN2H §4-3 「셋 다 손해다」).
//
//  ★ 그래서 **대가를 한 숫자로 합친다.** 부딪힘·열·시간은 단위가 다르므로
//    같은 저울에 올려야 견줄 수 있다. 그 환산이 이 도구에서 제일 위험한
//    자리라 **환산표를 눈에 보이게 찍는다** — 숨기면 아무 값이나 나온다.
//
//  ★ 그리고 왕복 시간을 **기획서가 아니라 배에서** 가져온다.
//    PLAN2H 는 「걸어서 40초」라고 적었는데 그건 **가정이었다.**
//    `--see` 가 실제로 걸어 보고 잰다 — 다르면 표를 고친다.
// ══════════════════════════════════════════════════════════════════════════
import { DRIFT, TRIP, WAYS, AIM } from '../web/space/js/game/drift-table.js';
import { makeDrift, kill, fixed, stepDrift, holdHeat, danger }
  from '../web/space/js/game/drift.js';
import { RUN } from '../web/space/js/game/move-table.js';
import { BODY } from '../web/space/js/game/systems-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DT = 1 / 30;

/**
 * 대가를 **한 저울에** 올린다.
 * ★ 환산을 눈에 보이게 둔다. 이게 숨어 있으면 「세 갈래가 비긴다」는
 *   말이 아무 뜻도 없어진다
 */
const WEIGH = {
  hit: 10,        // 부딪힘 한 번 = 10점 (선체 마모 + 열 + 여운의 고장)
  heat: 0.5,      // 열 1 = 0.5점 (자국이 되어 압박이 된다)
  seat: 0.06,     // 조종석에 매인 1초 = 0.06점 (다른 일을 못 한 값)
};
const price = (r) => r.hits * WEIGH.hit + r.heat * WEIGH.heat + r.seat * WEIGH.seat;

/**
 * 지대를 한 번 지난다.
 * @param plan (t, d) => boolean — 그 순간 조종간을 잡고 있나
 */
/**
 * @param bound 조종석에 **묶여 있는** 시간을 어떻게 세나
 *   `'grip'` 잡고 있는 동안만 · `'all'` 지대 내내
 *
 * ★ 「반쯤」이 `'all'` 인 이유. 잡고 있는 시간만 세면 「반쯤」이 나머지보다
 *   56% 싸게 나와서 나머지 둘이 연습용이 됐다. 그런데 **위험할 때만 잡으려면
 *   그 위험을 보고 있어야 한다** — 조종간에서 한 발짝도 못 떠난다.
 *   놓고 있는 동안에도 조종석에 묶여 있는 것이고, 그게 이 갈래의 진짜
 *   대가다. 안 세면 「공짜로 잘하는 법」이 된다
 */
function run(plan, sec = 195, fixAt = null, bound = 'grip') {
  const d = makeDrift();
  kill(d);
  let t = 0, heat = 0, seat = 0;
  while (t < sec) {
    // ★ **고치면 정말 고쳐진다.** 처음엔 `fixed()` 를 안 부르고 「자리를
    //   비웠다 돌아와 계속 잡는다」로만 모형을 짰다. 그랬더니 고치러 간
    //   갈래가 **부딪히기도 하고 열도 오르는** 최악이 되어, 도구가
    //   「성격이 다르다」에서 빨개졌다. 갈래를 잘못 그려 놓고 갈래가
    //   나쁘다고 읽을 뻔했다
    if (fixAt !== null && t >= fixAt && d.dead) fixed(d);
    const grip = d.dead && plan(t, d);
    if (bound === 'all' ? d.dead : grip) seat += DT;
    heat += holdHeat(d, grip) * DT;
    const ev = stepDrift(d, DT, grip);
    if (ev === 'hit') heat += DRIFT.hit.heat;
    t += DT;
  }
  return { hits: d.hits, heat: +heat.toFixed(1), seat: +seat.toFixed(1), d };
}

/**
 * 「반쯤」의 손 — **되물림이 있어야 한다.**
 * ★ 「위험하면 잡는다」 하나만 두면 위험선 바로 아래에서 **한 프레임마다
 *   잡았다 놨다**를 반복한다. 사람 손은 그렇게 안 움직인다 — 잡으면
 *   안심될 때까지 잡고 있다가 놓는다
 */
function halfHand() {
  let on = false;
  return (t, d) => {
    const g = danger(d);
    if (!on && g > 0.62) on = true;
    if (on && g < 0.25) on = false;
    return on;
  };
}

console.log(`\n★ C — 자동 조종 사망 · 지대 ${DRIFT.field[0]}~${DRIFT.field[1]}초`);

console.log('\n[1] 놓으면 **점점 빨라지나** — 잠깐 놓는 것과 오래 놓는 것이 달라야');
{
  const d = makeDrift(); kill(d);
  let t = 0; const at = {};
  while (t < 60) { stepDrift(d, DT, false); t += DT; if (!at[Math.floor(t)]) at[Math.floor(t)] = d.spin; }
  ok(d.spin > DRIFT.spin0, `60초 놔두면 ${DRIFT.spin0} → ${d.spin.toFixed(2)}도/초`);
  ok(d.spin <= DRIFT.spinMax, `그래도 ${DRIFT.spinMax} 를 안 넘는다`);
  const d2 = makeDrift(); kill(d2);
  let t2 = 0; while (t2 < 20) { stepDrift(d2, DT, false); t2 += DT; }
  ok(d2.hits >= 1 && d2.hits <= 4, `20초 놔두면 ${d2.hits}번 부딪힌다`);
}

console.log('\n[2] ★ **잡아도 즉시 안 멎는다** — 여기가 무너지면 「반쯤」이 공짜다');
{
  const d = makeDrift(); kill(d);
  let t = 0; while (t < 12) { stepDrift(d, DT, false); t += DT; }   // 먼저 돌게 둔다
  const was = d.spin;
  let held = 0;
  while (d.spin > 0.01 && held < 30) { stepDrift(d, DT, true); held += DT; }
  ok(held > 0.8, `${was.toFixed(2)}도/초를 멎히는 데 ${held.toFixed(1)}초 걸린다`);
  ok(held < 6, `그래도 ${held.toFixed(1)}초면 잡힌다 — 너무 길면 잡는 게 무의미해진다`);
}

console.log('\n[3] 갈래 하나 — **계속 잡는다**');
const A = run(() => true);
{
  console.log(`   부딪힘 ${A.hits} · 열 +${A.heat} · 조종석 ${A.seat}초`);
  ok(A.hits === AIM.hitsWhenHolding, `안 부딪힌다 (${A.hits}) — 그게 이 갈래가 파는 것이다`);
  ok(A.heat > 40, `대신 열이 ${A.heat} 올랐다 — **가만히 있는 것에 값이 붙는다**`);
}

console.log('\n[4] 갈래 둘 — **놓고 뛰어가 고친다**');
// ★ **자리를 비운다.** 처음엔 `() => true` 로 뒀는데 그건 「앉은 채로
//   고쳐진다」는 뜻이라 이 갈래의 대가가 통째로 사라졌다 (0회 부딪힘 ·
//   열 11). 갈래를 잘못 그려 놓고 「하나가 확실히 낫다」고 읽을 뻔했다
const B = run((t) => t >= TRIP.runSec, 195, TRIP.runSec);
{
  console.log(`   부딪힘 ${B.hits} · 열 +${B.heat} · 조종석 ${B.seat}초 (자리 비운 ${TRIP.runSec}초)`);
  const [h0, h1] = AIM.hitsWhenFixing;
  ok(B.hits >= h0 && B.hits <= h1,
    `왕복 ${TRIP.runSec}초 동안 ${B.hits}번 부딪힌다 (목표 ${h0}~${h1})`);
  // 걸어가면 더 맞아야 한다 — 달리기가 뜻이 있으려면
  const Bw = run((t) => t >= TRIP.walkSec, 195, TRIP.walkSec);
  ok(Bw.hits >= B.hits, `걸어가면 ${Bw.hits}번 — 뛰는 것이 값을 한다 (${B.hits} vs ${Bw.hits})`);
}

console.log('\n[5] 갈래 셋 — **반쯤** (위험한 데만 잡는다)');
const C = run(halfHand(), 195, null, 'all');
{
  console.log(`   부딪힘 ${C.hits} · 열 +${C.heat} · 조종석 ${C.seat}초`);
  const [h0, h1] = AIM.hitsWhenHalf;
  ok(C.hits >= h0 && C.hits <= h1, `부딪힘 ${C.hits} (목표 ${h0}~${h1})`);
  console.log(`   (조종석에 **묶인** 시간이다 — 위험을 보고 있어야 하니 못 떠난다)`);
  ok(C.heat < A.heat, `열은 「계속 잡는다」보다 덜 오른다 (${C.heat} < ${A.heat}) — 그게 이 갈래가 버는 것`);
}

console.log('\n[6] ★★ **셋 다 손해인가** — 여기가 이 장면의 전부다');
{
  console.log(`   저울: 부딪힘 1회=${WEIGH.hit}점 · 열 1=${WEIGH.heat}점 · 조종석 1초=${WEIGH.seat}점`);
  const rows = [[WAYS.hold, A], [WAYS.fix, B], [WAYS.half, C]];
  for (const [w, r] of rows) {
    console.log(`   ${w.name.padEnd(12)} ${price(r).toFixed(1).padStart(6)}점  (부딪힘 ${r.hits} · 열 ${r.heat} · 조종석 ${r.seat}초)`);
    console.log(`   ${''.padEnd(12)}         번다: ${w.gives} / 치른다: ${w.costs}`);
  }
  // ★ **쉬운 답 둘을 견준다.** 셋을 한꺼번에 견주려다 기획서와 어긋났다 —
  //   §4-3 은 「반쯤」을 **제일 잘하는 사람의 답**이라고 적었고, 잘한 답에
  //   보상이 없으면 잘할 이유가 없다. 그건 아래에서 따로 잰다
  const pa = price(A), pb = price(B), pc = price(C);
  const spread = Math.abs(pa - pb) / Math.max(pa, pb);
  const [s0, s1] = AIM.spread;
  ok(spread <= s1,
    `쉬운 답 둘의 차이 ${(spread * 100).toFixed(0)}% (상한 ${s1 * 100}%)`);
  if (spread > s1) console.log('   ※ 하나가 확실히 낫다 — 그건 선택이 아니라 정답이 있는 퀴즈다');
  void s0;

  // 「반쯤」은 **더 싸야 하되, 나머지를 연습용으로 만들 만큼은 아니어야** 한다
  const easy = Math.min(pa, pb);
  const edge = (easy - pc) / easy;
  const [e0, e1] = AIM.halfEdge;
  ok(edge >= e0 && edge <= e1,
    `잘한 답(반쯤)이 ${(edge * 100).toFixed(0)}% 싸다 (목표 ${e0 * 100}~${e1 * 100}%)`);
  if (edge < e0) console.log('   ※ 잘해도 남는 게 없다 — 잘할 이유가 사라진다');
  if (edge > e1) console.log('   ※ 너무 싸다 — 나머지 둘이 연습용이 된다');

  // ★ **성격이 달라야** 한다. 값이 비슷해도 셋이 같은 것을 치르면
  //   그건 갈래가 하나인 것이다
  ok(A.hits < B.hits && A.heat > B.heat,
    `「잡는다」는 열로, 「고친다」는 부딪힘으로 치른다 — 성격이 다르다`);
}

console.log('\n[7] 조종석에 매인 시간 — **장르가 안 바뀌었나**');
{
  // ★ **장면 안에서 재면 안 된다.** C 는 배치표가 `room: cockpit` 이라고
  //   적어 둔 장면이라 「조종석에 묶인다」가 그 장면의 정의다. 100% 가
  //   나오는 게 당연하고, 그걸 실패라고 찍으면 도구가 장면을 부정한다.
  //   물어야 할 것은 **회차 전체에서 이게 얼마나 되나**이다 (PLAN2H §10).
  const rows = [[WAYS.hold, A], [WAYS.fix, B], [WAYS.half, C]];
  const best = rows.reduce((a, b) => (price(a[1]) <= price(b[1]) ? a : b));
  const lapSec = 112 * 60;                       // space-route.js 가 잰 회차
  const twice = best[1].seat * 2;                // C 는 회차에 두 번 온다
  const share = twice / lapSec;
  console.log(`   제일 싼 답(${best[0].name}) — 장면 안에서는 ${(best[1].seat / 195 * 100).toFixed(0)}% (그게 이 장면의 정의다)`);
  ok(share <= AIM.seatShareMax,
    `C 두 번이 회차의 ${(share * 100).toFixed(1)}% 를 조종석에 묶는다 (상한 ${AIM.seatShareMax * 100}%)`);
  console.log('   ※ 회차 전체의 조종석 점유는 space-fly.js 가 본다 — D 와 합쳐야 답이 나온다');
}

console.log('\n[8] 3막(구간 11)에서는 **못 고친다** — 같은 장면도 두 번째는 다르다');
{
  const d = makeDrift();
  kill(d, { permanent: true });
  ok(fixed(d) === false, '고치려 해도 안 고쳐진다');
  ok(d.dead, '계속 죽어 있다 — 갈래가 둘로 준다 (잡거나 부딪히거나)');
  const d2 = makeDrift(); kill(d2);
  ok(fixed(d2) === true && !d2.dead, '2막에서는 고쳐진다');
  ok(DRIFT.permanentAtLeg === 11, `못 고치는 판은 구간 ${DRIFT.permanentAtLeg} (PLAN2H §5)`);
}

console.log('\n[9] 왕복 — **기획서가 아니라 배에서 온 값인가**');
{
  const hold = DRIFT.fix.reduce((a, f) => a + f.hold, 0);
  const walkAll = (TRIP.toShop + TRIP.shopToEngine + TRIP.back) / BODY.speed;
  // 자이로를 안고 가는 구간은 **못 뛴다** — 두 손이 차 있다 (carry-table.js)
  const runAll = TRIP.toShop / (BODY.speed * RUN.mult)
    + TRIP.shopToEngine / BODY.speed
    + TRIP.back / (BODY.speed * RUN.mult);
  console.log(`   조종간→정비실 ${TRIP.toShop}m · 정비실→기관실 ${TRIP.shopToEngine}m(안고) · 기관실→조종간 ${TRIP.back}m`);
  console.log(`   걸어서 ${walkAll.toFixed(1)}초 · 뛸 수 있는 데서 뛰어 ${runAll.toFixed(1)}초 (+수리 ${hold}초)`);
  ok(Math.abs(TRIP.walkSec - (walkAll + hold)) < 4,
    `표의 걷기 ${TRIP.walkSec}초가 계산(${(walkAll + hold).toFixed(1)})과 맞는다`);
  ok(Math.abs(TRIP.runSec - (runAll + hold)) < 4,
    `표의 뛰기 ${TRIP.runSec}초가 계산(${(runAll + hold).toFixed(1)})과 맞는다`);
  ok(walkAll - runAll >= 4,
    `뛰면 ${(walkAll - runAll).toFixed(1)}초 벌린다 — 달리기가 이 장면에서 값을 한다`);
  console.log('   ※ PLAN2H §7-2-1 의 「걸어서 40초 · 뛰어서 25초」와 거의 맞는다 —');
  console.log('      **기획서가 맞고 내 첫 구현(정비실 한 곳)이 틀렸다.** 재기 전엔 몰랐다');
}

// ══════════════════════════════════════════════════════════════════════════
//  여기부터는 **실제 배**다 — `--see 8391` 을 줬을 때만 돈다.
//
//  ★ 위 아홉은 숫자만 본다. 이 장면의 절반은 **화면**이다 —
//    「창밖이 흐른다」가 어느 방에서든 보이지 않으면 이건 배너 한 줄짜리
//    고장으로 되돌아간다 (PLAN2H §4-4 가 만들려던 것이 정확히 그 반대다).
// ══════════════════════════════════════════════════════════════════════════
const see = process.argv.indexOf('--see');
if (see >= 0) {
  const PORT = process.argv[see + 1] || '8391';
  let chromium = null;
  for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ }
  }
  if (!chromium) { console.error('playwright 가 없습니다.'); process.exit(2); }
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 380 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);
  const S = (fn, a) => p.evaluate(fn, a);
  await S(() => SPACE.clearSave());
  await p.mouse.move(320, 190); await p.mouse.click(320, 190);
  await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });
  await S(() => { const o = SPACE.route.offer; if (o.length) SPACE.pick(o[0]); });

  console.log('\n[10] ★ **배가 정말 도나** — 그리고 어느 방에서든 보이나');
  {
    const d0 = await S(() => SPACE.killDrift(false));
    ok(d0.dead, '자세 제어가 나갔다');
    // 조종석에서 창밖이 기울어 가나
    let a = await S(() => SPACE.drift.roll);
    await p.waitForTimeout(2500);
    let b2 = await S(() => SPACE.drift.roll);
    ok(Math.abs(b2) > Math.abs(a), `창밖이 기운다 (${a} → ${b2} rad)`);

    // ★ **기관실에서도 보이나.** 밖을 통째로 굴린 것이라 곁방 창에서도 보여야 한다
    await S(() => SPACE.put(0, 12.0, 0, 0));
    await p.waitForTimeout(600);
    const rot = await S(() => {
      // 밖(별·잔해)이 실제로 돌아가 있나 — 씬 그래프를 직접 본다
      let found = null;
      SPACE.shipGroup.parent.traverse((o) => {
        if (found === null && o.type === 'Group' && Math.abs(o.rotation.z) > 0.01) found = o.rotation.z;
      });
      return found;
    });
    ok(rot !== null, `방을 옮겨도 밖이 돌아가 있다 (${rot?.toFixed(3) ?? '못 찾음'} rad)`);
  }

  console.log('\n[10b] ★★ **화면이 정말 달라지나** — 눈으로는 못 판정한다');
  {
    // ★ 왜 이걸 따로 재나.
    //   `roll` 값이 0.166 rad 로 오르는 것은 확인했다. 그런데 **화면을 찍어
    //   보니 별밭이 그대로였다** — 고른 점이 흩뿌려진 하늘은 9도 돌아도
    //   눈으로 구별이 안 간다. 「값은 바뀌는데 화면은 그대로」가 정확히
    //   POSTMORTEM §1 이 적어 둔 함정이고, 이 저장소가 하루를 태운 그것이다.
    //   그래서 **눈 대신 픽셀을 센다.**
    const shot = async () => (await p.screenshot({ clip: { x: 60, y: 40, width: 520, height: 210 } })).toString('base64');
    // 멀쩡한 배 — 기준
    await S(() => { SPACE.setLeg(1); });
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(2200);
    await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); SPACE.clearSave(); });
    await S(() => { const o = SPACE.route.offer; if (o.length) SPACE.pick(o[0]); });
    await S(() => SPACE.put(0, -6.2, 0, -0.1));
    await p.waitForTimeout(1200);
    const flat = await shot();

    await S(() => SPACE.killDrift(false));
    let ang = 0;
    for (let i = 0; i < 60; i++) {
      await p.waitForTimeout(400);
      ang = Math.abs((await S(() => SPACE.drift)).angle);
      if (ang > 18) break;
    }
    const tilted = await shot();
    ok(ang > 8, `${ang.toFixed(1)}도까지 기울였다`);
    // 같은 자리에서 찍은 두 장이 **다른 그림**인가
    ok(flat !== tilted,
      `기울기 전과 후의 창이 **다른 그림이다** (${flat.length} vs ${tilted.length} 바이트)`);
    if (flat === tilted) {
      console.log('   ※ 값은 도는데 화면은 그대로다 — 코드가 안 도는 것이거나');
      console.log('      **밖에 방향을 가진 것이 없어서** 돌아도 티가 안 나는 것이다');
    }
  }

  console.log('\n[11] ★ **고칠 것이 조종석 밖에 있나** — 이 장면의 전부다');
  {
    const f = await S(() => SPACE.faults.open.find((o) => o.key === 'attitude') ?? null);
    ok(!!f, `자세 제어 고장이 같이 열렸다 (${f?.name ?? '안 열림'})`);
    ok(f?.at && f.at !== 'cockpit',
      `첫 손이 갈 자리가 조종석이 **아니다** — ${f?.at} (조종석이면 이 장면이 성립 안 한다)`);
  }

  console.log('\n[12] ★ **잡으면 멎나** — 조종간 하나가 상황에 따라 다른 일을 한다');
  {
    // 조종간 앞에 서서 잡는다
    const y = await S(() => SPACE.yokeAt ?? null);
    await S(() => SPACE.put(0, -7.75, 0, -0.2));
    await p.waitForTimeout(900);
    const before = await S(() => SPACE.drift.spin);
    await S(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
    let after = before;
    for (let i = 0; i < 30; i++) {
      await p.waitForTimeout(300);
      after = await S(() => SPACE.drift.spin);
      if (after < before - 0.2) break;
    }
    await S(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
    const aim = await S(() => SPACE.aim);
    ok(after < before, `잡으니 회전이 죽는다 (${before} → ${after} 도/초 · 조준 ${aim})`);
    void y;
  }

  console.log('\n[13] 이어하면 **기운 채로 이어지나**');
  {
    const before = await S(() => { SPACE.saveNow(); return SPACE.drift; });
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(2200);
    const after = await S(() => SPACE.drift);
    ok(after.dead === before.dead, `죽어 있던 것이 그대로다 (${before.dead})`);
    ok(Math.abs(after.angle - before.angle) < 3,
      `기운 각도가 그대로다 (${before.angle}° → ${after.angle}°) — 똑바로 서 있으면 봐준 것이다`);
  }

  ok(errs.length === 0, errs.length ? `콘솔 오류 ${errs.length}: ${errs[0]}` : '콘솔 오류 없음');
  await b.close();
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「고르는 것이 괴로운가」는 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「고를 만한 셋이 있나」뿐이다 — 나머지는 직접 해 봐야 안다.');
process.exit(fail ? 1 : 0);
