// ══════════════════════════════════════════════════════════════════════════
//  행성 착륙 — **내리는 것이 일련의 과정인가.**
//
//    node tools/space-land.js
//    node tools/space-land.js --see 8391   + 실제 배에서 내려 본다
//
//  ★ 사장님: 「착륙을 하는 일련의 과정도 있어야지. 행성 발견이나 조작해서
//             내리는 것. 화면이 바뀌는 것」
//
//    그래서 여기서 묻는 것은 「내려지나」가 아니라 넷이다:
//      ① **과정이 있나** — 여섯 마디를 다 거치나, 왕복이 구간의 몇 %인가
//      ② **조작이 조작인가** — 놓아도 되고 계속 잡고만 있어도 되면 조작이 아니다
//      ③ **내릴 이유가 있나** — 우주에서 낚는 것보다 나은가
//      ④ **늘 내리는 게 답은 아닌가** — 그러면 항로가 뜻을 잃는다
//
//    ★ **화면이 바뀌나는 여기서 안 나온다.** 그건 `--see` 와 스크린샷이다.
// ══════════════════════════════════════════════════════════════════════════
import { STEP, LAND, WHY, whyNotLand, tiltWord, bandFor, pushFor, roundTrip, STEP_WORD }
  from '../web/space/js/game/land-table.js';
import {
  makeLand, offerPlanet, beginLand, liftOff, stepLand, loadStep, canLoad, loadWhy,
  onGround, burning, signOf, heatOf, summary,
} from '../web/space/js/game/land.js';
import { LEG } from '../web/space/js/game/route-table.js';
import { REGION_BY_KEY } from '../web/space/js/game/regions-table.js';
import { WINCH, TRADE, FOOD } from '../web/space/js/game/supply-table.js';
import { SIGN, HEATING } from '../web/space/js/game/chase-table.js';
import { HEAT } from '../web/space/js/game/systems-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DT = 1 / 30;
const LEG_SEC = LEG.seconds / REGION_BY_KEY.planet.speed;

/** 같은 착륙을 두 번 돌리려고 **난수도 표처럼** 굴린다 */
function rngOf(seed = 7) {
  let h = seed >>> 0;
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507)) >>> 0) / 4294967296;
}

/**
 * 착륙 한 번을 통째로 돌린다.
 * @param make 조종사 한 명을 새로 만든다 — () => (tilt, band, dt) => -1~1
 */
function fly(make, { hard = false, loadFor = 90, seed = 7 } = {}) {
  const l = makeLand();
  const pilot = make();
  const rnd = rngOf(seed);
  offerPlanet(l, hard);
  beginLand(l, {});
  const marks = [];
  let t = 0, loaded = 0, burnHeat = 0, burnSignT = 0;
  const got = { ore: 0, parts: 0, food: 0 };
  while (l.step !== STEP.NONE && t < 900) {
    const band = bandFor(l.hard);
    const hand = l.step === STEP.ENTRY ? pilot(l.tilt, band, DT) : 0;
    const ev = stepLand(l, DT, { hand, rnd });
    if (ev) marks.push({ ev, at: +t.toFixed(1) });
    if (burning(l)) { burnHeat += heatOf(l) * DT; burnSignT += DT; }
    if (onGround(l)) {
      if (loaded < loadFor) {
        const g = loadStep(l, DT);
        got.ore += g.ore; got.parts += g.parts; got.food += g.food;
        loaded += DT;
      } else liftOff(l, {});
    }
    t += DT;
  }
  return { l, marks, total: t, got, burnHeat, burnSignT, burned: l.burned };
}

/**
 * 조종사 셋.
 *
 * ★ **처음엔 매 프레임 반응하는 조종사로 쟀다.** 그랬더니 보통 대기든
 *   거친 대기든 **둘 다 0초**가 나와서 「거친 쪽이 더 어렵나」에 답이 안
 *   나왔다. 30분의 1초마다 완벽하게 되미는 사람은 없다 —
 *   **재는 것이 사람이 아니라 기계였다.** 사람의 반응 시간(REACT)을 넣는다
 */
const REACT = 0.35;
const PILOTS = {
  /** 손을 놓는다 */
  none: () => () => 0,
  /** 한쪽으로 계속 민다 — 「잡고 있으면 되겠지」 */
  lean: () => () => -1,
  /** 지켜보다 되민다 — 다만 **곧바로는 못 본다** */
  watch: () => {
    let hold = 0, cmd = 0;
    return (tilt, band, dt) => {
      hold -= dt;
      if (hold <= 0) {
        hold = REACT;
        cmd = Math.abs(tilt) < band * 0.35 ? 0 : (tilt > 0 ? -1 : 1);
      }
      return cmd;
    };
  },
};

console.log('\n행성 착륙 — 내리는 것이 일련의 과정인가');
console.log(`  (행성 곁 구간 ${LEG_SEC.toFixed(0)}초 = ${(LEG_SEC / 60).toFixed(1)}분)`);

console.log('\n[1] ★ **일련의 과정** — 여섯 마디를 다 거치나');
{
  const { marks, total } = fly(PILOTS.watch, { loadFor: 60 });
  console.log('   ' + marks.map((m) => `${m.ev}(${m.at}초)`).join(' → '));
  const evs = marks.map((m) => m.ev);
  ok(evs.join(',') === 'entry,down,touch,coast,sky',
    `다가감 → 진입 → 하강 → 착지 → 분사 끝 → 하늘 (${evs.length}마디)`);
  ok(total > 140 && total < 200, `싣기 60초까지 넣어 ${total.toFixed(0)}초`);
}

console.log('\n[2] 왕복이 **구간을 다 먹지 않나**');
{
  const rt = roundTrip();
  const share = rt / LEG_SEC;
  console.log(`   고정 왕복 ${rt}초 · 구간의 ${(share * 100).toFixed(0)}%`);
  ok(share >= 0.12 && share <= 0.30,
    `${(share * 100).toFixed(0)}% (12~30%) — 더 짧으면 「일」이 아니고, 더 길면 구간이 착륙에 다 간다`);
  ok(rt >= 60, `${rt}초 — 「눌렀더니 내려와 있다」가 아니다`);
}

console.log('\n[3] ★★ **조작이 조작인가** — 놓아도 되면 조작이 아니다');
{
  const rows = Object.entries(PILOTS).map(([k, p]) => {
    const r = fly(p, { loadFor: 0 });
    return { k, burned: r.burned, wear: r.burned * LAND.burnWear };
  });
  for (const r of rows) {
    console.log(`   ${r.k.padEnd(6)} 탄 시간 ${r.burned.toFixed(1)}초 · 선체 ${r.wear.toFixed(3)}`);
  }
  const [none, lean, watch] = rows;
  ok(none.burned > LAND.entry * 0.45,
    `손을 놓으면 진입 ${LAND.entry}초 중 ${none.burned.toFixed(1)}초를 탄다 — 벌이 있다`);
  // ★ **「계속 한쪽으로 밀기」가 통하면 안 된다.** 미는 방향이 뒤집히므로
  //   한쪽으로만 밀면 반대로 넘어간다 — 그게 이 조작의 전부다
  ok(lean.burned > LAND.entry * 0.25,
    `한쪽으로만 밀어도 ${lean.burned.toFixed(1)}초를 탄다 — 잡고만 있는 것이 답이 아니다`);
  ok(watch.burned < none.burned * 0.35 && watch.burned < lean.burned * 0.5,
    `지켜보고 되밀면 ${watch.burned.toFixed(1)}초 — **보고 있으면 안 탄다**`);
  ok(watch.burned <= 4,
    `잘하면 거의 안 탄다 (${watch.burned.toFixed(1)}초) — 안 그러면 벌이 아니라 세금이다`);
}

console.log('\n[4] ★★ **내릴 이유가 있나** — 우주에서 낚는 것과 견준다');
{
  const SEC = 90;
  const { got } = fly(PILOTS.watch, { loadFor: SEC });
  // 같은 시간을 우주에서 낚으면
  const space = { ore: WINCH.perSec * SEC, parts: 0, food: 0, risk: WINCH.riskRise * SEC };
  // 거점 환율로 광석 환산.
  // ★ **처음엔 부품과 식량을 따로 값 매겼다가 두 배로 세었다.**
  //   거점은 광석 30 을 받고 **식량 34 와 부품 1 을 묶어서** 준다 —
  //   따로 파는 게 아니다. 그래서 부품 하나를 30 으로 치고 식량도 또
  //   30/34 씩 치면 같은 거래를 두 번 센 것이 된다. 그렇게 재니 땅이
  //   3.3배로 나와 빨개졌는데, **게임이 아니라 계산이 틀렸던 것**이다.
  //   묶음이 몇 번어치인가로 센다
  const bundles = (g) => Math.max(g.parts, g.food / TRADE.food);
  const worth = (g) => g.ore + bundles(g) * TRADE.ore;
  const wLand = worth(got), wSpace = worth(space);
  console.log(`   땅 ${SEC}초 — 광석 ${got.ore.toFixed(0)} · 부품 ${got.parts} · 식량 ${got.food.toFixed(0)}  (광석 환산 ${wLand.toFixed(0)})`);
  console.log(`   우주 ${SEC}초 — 광석 ${space.ore.toFixed(0)} · 위험 +${space.risk.toFixed(0)}   (광석 환산 ${wSpace.toFixed(0)})`);
  const times = wLand / wSpace;
  ok(times >= 1.6 && times <= 3.2,
    `땅이 ${times.toFixed(1)}배 (1.6~3.2) — 곱절은 돼야 95초를 쓸 값이고, 세 배가 넘으면 안 내리는 쪽이 바보가 된다`);
  ok(got.parts >= 3, `부품이 ${got.parts}개 난다 — **우주 낚시는 광석만이다.** 이게 「내릴 이유」다`);
  ok(got.food * (1 / FOOD.perSec) > SEC,
    `식량 ${got.food.toFixed(0)} = ${(got.food / FOOD.perSec / 60).toFixed(1)}분치 — 내려간 시간보다 많이 캔다`);
}

console.log('\n[5] ★★ **늘 내리는 게 답은 아닌가** — 값이 셋이다');
{
  const { burnHeat, burnSignT } = fly(PILOTS.watch, { loadFor: 90 });
  console.log(`   이륙 분사 ${burnSignT.toFixed(0)}초 · 열 +${burnHeat.toFixed(0)} · 자국 +${LAND.burnSign}`);
  ok(burnHeat > HEAT.warn * 0.5,
    `분사가 열을 ${burnHeat.toFixed(0)} 올린다 — 경고선(${HEAT.warn})의 절반이 넘는다`);
  // ★ 그리고 그 열이 **자국으로 남는다.** 열이 식을 때까지 계속 보인다.
  //   ★ 처음엔 오른 몫(+41)만으로 자국을 셌다가 「44 < 52」로 빨개졌다.
  //     자국은 **지금 열**이 정하지 오른 몫이 정하지 않는다. 제일 식은
  //     배(HEAT.start)로 내려갔다 올라와도 넘는지를 묻는 것이 맞다
  const hot = HEAT.start + burnHeat;
  const signHot = SIGN.base + hot * SIGN.perHeat + SIGN.valveOpen;
  ok(signHot > SIGN.contactAt,
    `제일 식은 배로 내려가도 올라오면 열 ${hot.toFixed(0)} · 밸브를 열면 자국 ${signHot.toFixed(0)} — 접촉 기준(${SIGN.contactAt})을 넘는다. **뜨겁고 시끄럽게 올라온다**`);
  // ★ 제일 큰 값 — **못 도망간다**
  console.log(`   ※ 땅에 붙어 있는 시간 ${(roundTrip() + 90).toFixed(0)}초 — 그동안 추진이 없다`);
  ok(LAND.riskHolds,
    '땅에서는 위험이 안 오른다 — 대신 **붙으면 도망갈 길이 없다.** 그게 진짜 값이다');
  ok(LAND.airHolds,
    '땅에서는 공기가 안 준다 (대기가 있다) — 바깥문을 열어 놔도 된다');
}

console.log('\n[6] 거친 대기(구간 10) — **같은 장면인데 조건이 다른가**');
{
  const soft = fly(PILOTS.watch, { loadFor: 0 });
  const hard = fly(PILOTS.watch, { loadFor: 0, hard: true });
  console.log(`   보통 띠 ${bandFor(false)} · 미는 힘 ${pushFor(false)} → 탄 시간 ${soft.burned.toFixed(1)}초`);
  console.log(`   거침 띠 ${bandFor(true)} · 미는 힘 ${pushFor(true)} → 탄 시간 ${hard.burned.toFixed(1)}초`);
  ok(hard.burned > soft.burned + 1.5,
    `거친 쪽이 ${(hard.burned - soft.burned).toFixed(1)}초 더 탄다 — 두 번째가 「또 이거」가 아니다`);
  ok(hard.burned < LAND.entry * 0.6,
    `그래도 ${hard.burned.toFixed(1)}초 — 잘하면 넘길 수 있다 (못 넘기면 그건 벌이 아니라 벽이다)`);
}

console.log('\n[7] 못 내리는 때 · 못 뜨는 때를 **말하나**');
{
  const l = makeLand();
  ok(whyNotLand({ step: STEP.NONE, offered: false }) === 'noPlanet',
    `내릴 자리가 없으면 — 「${WHY.noPlanet}」`);
  offerPlanet(l);
  ok(!beginLand(l, { chase: true }) && l.blocked === 'chase',
    `쫓기는 중에는 못 내린다 — 「${WHY.chase}」`);
  ok(beginLand(l, {}), '평온하면 내려간다');
  ok(!beginLand(l, {}) && l.blocked === 'busy', `내려가는 중에 또 누르면 — 「${WHY.busy}」`);
  // 땅까지 굴린다
  const rnd = rngOf(3);
  while (!onGround(l)) stepLand(l, DT, { hand: 0, rnd });
  ok(!canLoad(l, { doorOpen: false }) && loadWhy(l, { doorOpen: false }) === 'shut',
    `문이 닫혀 있으면 못 싣는다 — 「${WHY.shut}」`);
  ok(canLoad(l, { doorOpen: true }), '문을 열면 실린다');
  // ★ 문을 열어 둔 채로는 못 뜬다
  ok(!liftOff(l, { doorOpen: true }) && l.blocked === 'door',
    `문을 열어 둔 채로는 못 뜬다 — 「${WHY.door}」`);
  ok(liftOff(l, { doorOpen: false }), '닫으면 뜬다');
}

console.log('\n[8] 사람에게 뭐라고 말하나 — **숫자로 안 띄운다**');
{
  for (const v of [0.05, 0.22, 0.5]) console.log(`   각 ${v} → ${tiltWord(v)}`);
  const words = new Set([0.05, 0.22, 0.5].map((v) => tiltWord(v)));
  ok(words.size === 3, '세 단계가 서로 다른 말이다');
  const all = [...Object.values(STEP_WORD), ...words, ...Object.values(WHY)].join('');
  ok(!/\d/.test(all), '마디 이름에도 이유에도 숫자가 안 들어 있다');
  ok(Object.keys(STEP_WORD).length === 6, '여섯 마디가 다 제 말을 갖는다');
}

// ══════════════════════════════════════════════════════════════════════════
//  여기부터는 **실제 배**다 — `--see 8391` 을 줬을 때만 돈다.
//
//  ★ 위 여덟은 표가 스스로를 검사한 것이다. 사장님이 말씀하신 **「화면이
//    바뀌는 것」은 표가 절대 못 본다** — v45 의 바깥문에서 「검사는 다 ✔ 인데
//    열린 문과 닫힌 문이 똑같았다」를 밟았다. 그래서 여기서는 **고도·하늘색·
//    지면**을 배에서 직접 읽는다.
//
//  ★ 마디를 **통째로 날아 보지 않는다.** 헤드리스는 게임 시간이 실시간의
//    20분의 1 이라 왕복 95초가 30분이 넘는다. 마디를 밀어 놓고
//    **게임이 굴리게** 둔다 (`putLand`) — 스테퍼를 직접 부르지 않는다
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
  const until = async (fn, tries, what) => {
    for (let i = 0; i < tries; i++) { if (await S(fn)) return true; await p.waitForTimeout(400); }
    console.log(`   … ${what} 을(를) 못 봤다`);
    return false;
  };
  const said = () => S(() => {
    const e = document.getElementById('hud'); return e && !e.hidden ? e.textContent : '';
  });
  const press = async (sec) => {
    await S(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
    await p.waitForTimeout(sec * 1000);
    await S(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
  };

  await S(() => SPACE.clearSave());
  await p.mouse.move(320, 190); await p.mouse.click(320, 190);
  await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });
  await S(() => { const o = SPACE.route.offer; if (o.length) SPACE.pick(o[0]); });
  await S(() => SPACE.setPower('thrust', false));

  console.log('\n[9] ★ **발견 — 해도대에 내릴 자리가 뜨나**');
  {
    // ★★ **배치가 정말 켜나부터 묻는다.** 아래에서 `offerLand` 로 직접
    //   띄우고 검사하면 「표는 도는데 게임에서는 한 번도 안 뜨는」 상태를
    //   못 잡는다 — 장면 B 는 v46 전까지 `built: false` 였다
    await S(() => { SPACE.setLeg(3); SPACE.seekScene(600); });
    await S(() => SPACE.skipBeat());
    const byScene = await until(() => SPACE.land.offered, 30, '장면 B 가 내릴 자리를 켜기');
    ok(byScene, `구간 3 의 장면 B 가 스스로 켠다 (${(await S(() => SPACE.scene)).keys})`);
    await S(() => SPACE.offerLand(false));
    ok((await S(() => SPACE.land)).offered, '내릴 자리가 떴다');
    // 해도대 앞 — 관측실. 판 둘이 「내린다 / 지나친다」를 묻는다
    await S(() => SPACE.put(-2.4, 0.42, Math.PI / 2, -0.30));
    ok(await until(() => /^chart/.test(SPACE.aim ?? ''), 25, '해도대 조준'),
      `조준선이 갈래 판을 잡는다 (${await S(() => SPACE.aim)}) — **항행 중인데도** 잡힌다`);
  }

  console.log('\n[10] ★★ **누르면 내려간다** — 그리고 마디가 차례로 지난다');
  {
    await press(3.2);
    ok(await until(() => SPACE.land.step !== 'found', 30, '내려가기 시작'),
      `눌렀더니 내려간다 (${(await S(() => SPACE.land)).step}) — 「${await said()}」`);
    // ★ 마디를 통째로 날면 30분이다. 끝자락에 놓고 **게임이 넘기게** 둔다
    await S(() => SPACE.putLand('down', 18.5));
    ok(await until(() => SPACE.land.onGround, 60, '착지'),
      `게임이 스스로 넘겨서 내려앉았다 — 「${await said()}」`);
    ok((await S(() => SPACE.land)).trips === 1, '내린 횟수가 하나 는다');
  }

  console.log('\n[11] ★★★ **화면이 정말 바뀌나** — 사장님이 물으신 그것');
  {
    // ★ **하늘색은 천천히 갈아탄다** (REGION_BLEND 6초). 앞 절에서 땅에
    //   내려앉아 있었으므로 우주색으로 돌아오는 데 시간이 걸린다 —
    //   1.2초 재고 「안 바뀌었다」로 빨개졌던 것은 게임이 아니라 **성급함**이다
    await S(() => SPACE.putLand('none', 0));
    await p.waitForTimeout(9000);
    const spaceSky = (await S(() => SPACE.land)).view.sky;
    console.log(`   (우주에 있을 때 하늘 ${spaceSky})`);
    const seen = {};
    for (const [step, t] of [['approach', 12], ['entry', 12], ['down', 15], ['landed', 3]]) {
      await S(([s, tt]) => SPACE.putLand(s, tt), [step, t]);
      await p.waitForTimeout(1200);
      seen[step] = (await S(() => SPACE.land)).view;
      console.log(`   ${step.padEnd(9)} 고도 ${seen[step].alt} · 하늘 ${seen[step].sky} · 발광 ${seen[step].glow} · 땅 ${seen[step].ground}`);
    }
    ok(seen.approach.alt > seen.entry.alt && seen.entry.alt > seen.down.alt && seen.down.alt > seen.landed.alt,
      '고도가 마디마다 내려간다 — 한 숫자가 화면 넷을 몬다');
    ok(seen.approach.planetScale > 1.2, `다가가면 행성이 커진다 (×${seen.approach.planetScale})`);
    ok(seen.entry.glow > 0.4, `대기 진입에 창이 타오른다 (발광 ${seen.entry.glow})`);
    ok(!seen.approach.ground && seen.landed.ground, '땅은 내려가서야 보인다');
    ok(spaceSky !== seen.landed.sky,
      `하늘색이 우주(${spaceSky}) → 지표(${seen.landed.sky})로 갈아탄다`);
  }

  console.log('\n[12] ★ **땅에서 싣는다** — 문을 열어야 · 부품이 난다');
  {
    await S(() => { SPACE.putLand('landed', 3); SPACE.putLock(false); SPACE.put(3.4, 5.15, 0, -0.34); });
    ok(await until(() => SPACE.aim === 'winch', 25, '윈치 조준'), '에어록 윈치를 잡는다');
    await press(2.6);
    ok(/바깥문/.test(await said()), `문이 닫혀 있으면 왜인지 말한다 — 「${await said()}」`);
    await S(() => SPACE.putLock(true));
    // ★ 식량이 가득(100)이면 「식량도 난다」를 못 잰다 — 한도에 걸려
    //   100 → 100 이 되고, 그건 안 나는 것과 구별이 안 된다
    await S(() => SPACE.setSupply({ food: 40, parts: 0 }));
    const p0 = await S(() => SPACE.supply);
    await S(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
    const got = await until(() => SPACE.supply.ore > 2, 45, '실리기');
    const p1 = await S(() => SPACE.supply);
    await S(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
    ok(got, `문을 여니 실린다 (광석 ${p0.ore} → ${p1.ore})`);
    // ★ 창고 숫자로 견주면 **먹는 속도에 묻힌다** — 실은 것은 0.5 인데
    //   같은 시간에 0.15 를 먹으므로 반올림하면 40 → 40 이다.
    //   「실었나」는 실은 쪽(`land.got`)에 대고 묻는다
    const loaded = (await S(() => SPACE.land)).got;
    ok(loaded.food > 0, `**식량도 같이 난다** (이번에 실은 식량 ${loaded.food}) — 우주 낚시는 광석만이다`);
    ok(p1.ore > p0.ore, `창고에도 들어간다 (광석 ${p0.ore} → ${p1.ore})`);
    // ★ 그리고 **땅에서는 공기가 안 준다** (대기가 있다)
    const air0 = (await S(() => SPACE.lock)).air;
    await p.waitForTimeout(3000);
    const air1 = (await S(() => SPACE.lock)).air;
    ok(air1 >= air0 - 0.001, `문을 열어 놔도 공기가 안 준다 (${air0} → ${air1}) — 밖에 대기가 있다`);
  }

  console.log('\n[13] ★★ **문을 열어 둔 채로는 못 뜬다** — 조종간을 잡으면 뜬다');
  {
    // 조종간 앞으로. 문은 아직 열려 있다
    await S(() => { SPACE.put(0, -7.75, 0, -0.2); });
    ok(await until(() => SPACE.aim === 'yoke', 25, '조종간 조준'),
      `조종석 조종간을 잡는다 (${await S(() => SPACE.aim)})`);
    await press(2.4);
    ok((await S(() => SPACE.land)).step === 'landed',
      `문이 열려 있으면 안 뜬다 — 「${await said()}」`);
    await S(() => SPACE.putLock(false));
    await p.waitForTimeout(800);
    await press(2.4);
    ok(await until(() => SPACE.land.step === 'up', 30, '이륙'),
      `닫고 오니 뜬다 — 「${await said()}」`);
    // ★ `until` 의 화살표는 **페이지 안에서** 돈다 — 여기 변수를 그대로
    //   쓰면 「h0 is not defined」다. 창에 얹어 놓고 읽는다
    const h0 = await S(() => SPACE.heat);
    await S((v) => { window.__h0 = v; }, h0);
    await until(() => SPACE.heat > window.__h0 + 1, 40, '열이 오르기');
    const h1 = await S(() => SPACE.heat);
    ok(h1 > h0, `분사가 열을 올린다 (${h0.toFixed(0)} → ${h1.toFixed(0)}) — **냉각이 안 먹는다**`);
  }

  console.log('\n[14] 이어하면 **땅에 내려앉은 채로 이어지나**');
  {
    await S(() => { SPACE.putLand('landed', 5); SPACE.saveNow(); });
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(2200);
    const l = await S(() => SPACE.land);
    ok(l.onGround, '땅에 있는 채로 이어진다');
    ok(l.view.ground, '화면에도 땅이 그대로 있다 — 상태만 이어지고 화면이 우주면 그건 이어한 게 아니다');
  }

  ok(errs.length === 0, errs.length ? `콘솔 오류 ${errs.length}: ${errs[0]}` : '콘솔 오류 없음');
  await b.close();
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「내리는 맛이 나나」는 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「과정이 있나 · 조작이 조작인가 · 내릴 이유가 있나 · 늘 답은 아닌가」뿐이다.');
console.log('     화면이 바뀌는 것은 --see 와 스크린샷이 본다.');
process.exit(fail ? 1 : 0);
