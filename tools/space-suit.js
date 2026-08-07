// ══════════════════════════════════════════════════════════════════════════
//  ★★ 우주복 — **진공에 사람이 그냥 서 있었다** (v62 · REAL.md §2-C)
//
//    node tools/space-suit.js
//    node tools/space-suit.js --see 8391    + 실제 배에서 입어 본다
//
//  ★ 사장님: 「사실적으로 만들어줄래? … 이렇게 말이안되는 부분들을 모두
//             찾아서 기획 다시 쓰고 다시 설계해」
//
//  ★★ 여기서 묻는 것 여섯. 앞의 셋은 **되나**, 뒤의 셋은 **말이 되나**다.
//
//      ① 입는 데 시간이 드나 — 0초면 우주복이 아니라 스위치다
//      ② 놓으면 되돌아가나 — 수리와 같은 규약
//      ③ 진공에서만 공기가 주나 — 배 안에서도 주면 그건 넷째 시계다
//      ④ ★★ **안 입고 열면 무슨 일이 나나** — 여기가 이 판의 핵심
//      ⑤ ★★ **왜 늘 입고 다니지 않나** — 값이 없으면 늘 입는 것이 답이다
//      ⑥ ★ 시계가 셋을 안 넘나 — REAL.md §7 이 「열·추진제·식량」으로 못박았다
//
//  ★★ ⑤ 가 제일 중요하다. 벌이 **숫자가 아니라 못 하게 되는 일**로 와야
//     한다 — 이 저장소가 물건 들기와 굶주림에서 두 번 세운 규약이다.
//     입고 있으면 수리가 두 배로 더디다. 그래서 「지금 입어야 하나」가
//     결심이 되고, 그 결심이 없으면 우주복은 문 앞의 절차 하나일 뿐이다.
// ══════════════════════════════════════════════════════════════════════════
import { SUIT, suitWord } from '../web/space/js/game/suit-table.js';
import {
  makeSuit, stepWear, stepSuit, canEva, handMult, moveMult,
} from '../web/space/js/game/suit.js';
import { LOCK } from '../web/space/js/game/airlock-table.js';
import { makeLock, cycle, stepLock, isVacuum } from '../web/space/js/game/airlock.js';
import { WINCH, FOOD } from '../web/space/js/game/supply-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DT = 1 / 30;
/** 걸이를 이만큼 잡고 있는다 */
const hold = (s, sec) => { for (let t = 0; t < sec; t += DT) stepWear(s, DT, { hold: true }); return s; };
/** 놓고 이만큼 */
const letGo = (s, sec) => { for (let t = 0; t < sec; t += DT) stepWear(s, DT, { hold: false }); return s; };
/** 입은 채 진공에 이만큼 */
const eva = (s, sec) => { for (let t = 0; t < sec; t += DT) stepSuit(s, DT, { vacuum: true }); return s; };

console.log('\n우주복 — 진공에 사람이 그냥 서 있었다');

console.log('\n[1] **입는 데 시간이 든다** — 0초면 우주복이 아니라 스위치다');
{
  const s = makeSuit();
  ok(!canEva(s), '처음엔 걸이에 걸려 있다 — 나갈 수 없다');
  hold(s, SUIT.wearFor - 1);
  ok(!s.on, `${(SUIT.wearFor - 1).toFixed(0)}초로는 아직 못 입는다`);
  hold(s, 1.5);
  ok(s.on && canEva(s), `★ ${SUIT.wearFor}초를 잡고 있으면 입는다 — 「멈춰서 캔다」의 진짜 값이 여기 붙는다`);
  ok(SUIT.takeOff < SUIT.wearFor, `벗는 것(${SUIT.takeOff}초)이 입는 것(${SUIT.wearFor}초)보다 빠르다 — 실제로도 그렇다`);
  const t = makeSuit(); t.on = true;
  hold(t, SUIT.takeOff + 0.5);
  ok(!t.on, '입은 채로 잡으면 벗는다 — 손잡이 하나가 둘을 한다');
}

console.log('\n[2] ★ **놓으면 되돌아간다** — 수리와 같은 규약');
{
  const s = makeSuit();
  hold(s, 12);
  const was = s.wearing;
  letGo(s, 3);
  ok(s.wearing < was, `놓으면 되돌아간다 (${was.toFixed(1)} → ${s.wearing.toFixed(1)}초)`);
  ok(!s.on, '중간에 놓으면 안 입힌다');
  letGo(s, 12);
  ok(s.wearing === 0, '★ 오래 놓으면 **처음으로 돌아간다** — 22초가 「기다리기」가 아니라 「붙들고 있기」다');
}

console.log('\n[3] ★★ **진공에서만 공기가 준다** — 아니면 넷째 시계가 된다');
{
  const s = makeSuit(); s.on = true;
  for (let t = 0; t < 120; t += DT) stepSuit(s, DT, { vacuum: false });
  ok(s.air === SUIT.air,
    '★ 입은 채 **배 안을 2분 돌아다녀도 공기가 안 준다** — 배에서 채우면서 다닌다.'
    + ' 벌은 공기가 아니라 **둔한 손**이다');
  const v = makeSuit(); v.on = true;
  eva(v, 60);
  ok(Math.abs(v.air - (SUIT.air - 60)) < 1, `진공에서는 1초에 1초씩 준다 (${v.air.toFixed(0)}초 남음)`);
  // 벗어 두면 걸이에서 채워진다 — **채우는 데도 시간이 든다**
  const r = makeSuit(); r.air = 10;
  for (let t = 0; t < 10; t += DT) stepSuit(r, DT, {});
  ok(r.air > 10 && r.air < SUIT.air,
    `걸어 두면 채워진다 (10 → ${r.air.toFixed(0)}초) — 다만 **한 번에 안 찬다**`);
  const refillSec = (SUIT.air - 10) / SUIT.refill;
  for (let t = 0; t < refillSec; t += DT) stepSuit(r, DT, {});
  ok(r.air === SUIT.air && refillSec > 15,
    `바닥에서 가득까지 ${refillSec.toFixed(0)}초 — ★ 몰아서 나가면 **다음에 못 나간다**`);
}

console.log('\n[4] ★★ **안 입고 열면 무슨 일이 나나** — 이 판의 핵심');
{
  const vent = (1 - LOCK.airFloor) / LOCK.airDrain;
  console.log(`   칸이 비는 데 ${vent.toFixed(0)}초 · 유예 ${SUIT.grace}초`);
  ok(vent <= 20,
    `★ 에어록 **한 칸**이 ${vent.toFixed(0)}초에 빈다 — 예전에는 이것이 **배 전체 공기**였고`
    + ' 125초에 걸쳐 줄었다. 격리가 안 되면 그건 에어록이 아니라 구멍이다');

  const l = makeLock(); cycle(l);
  let ev = null, t = 0;
  while (t < 60 && ev !== 'blown') { ev = stepLock(l, DT, { suited: false }); t += DT; }
  ok(ev === 'blown' && t < 25,
    `★★ 안 입고 열면 **${t.toFixed(0)}초에 배가 억지로 닫는다** (배기 + 유예).`
    + ' 진공에서 사람은 15초면 의식을 잃는다 — 그 자릿수 안에 들어왔다');
  ok(l.lockout > 0,
    `그리고 ${LOCK.lockout}초 못 연다 — ★ **죽이지 않는다.** 이 게임의 벌은 늘 **기다림**이다`);

  const l2 = makeLock(); cycle(l2);
  let ev2 = null, t2 = 0;
  while (t2 < 120 && ev2 !== 'blown') { ev2 = stepLock(l2, DT, { suited: true }); t2 += DT; }
  ok(ev2 !== 'blown' && l2.open,
    '★★ 입었으면 **2분을 열어 놔도 안 닫힌다** — 진공은 사고가 아니라 절차다');
  ok(isVacuum(l2), '그 칸은 진공이다 — 그게 맞는 말이다');
}

console.log('\n[5] ★★ **왜 늘 입고 다니지 않나** — 값이 없으면 늘 입는 것이 답이다');
{
  const on = makeSuit(); on.on = true;
  ok(handMult(on) < 1,
    `★★ 입으면 수리가 **${handMult(on)}배**로 더디다 — 같은 7초짜리가 ${(7 / handMult(on)).toFixed(0)}초가 된다.`
    + ' 벌이 숫자가 아니라 **못 하게 되는 일**로 온다 (물건 들기 · 굶주림과 같은 규약)');
  ok(moveMult(on) < 1 && moveMult(on) > 0.75,
    `걸음도 ${moveMult(on)}배로 둔하다 — 크게 안 깎는다. 방 사이가 늘면 템포가 무너진다 (REAL.md §7)`);
  // 굶주림과 **곱해진다** — 둘 다면 정말 못 한다
  const both = 7 / (handMult(on) * FOOD.handMult);
  ok(both > 20,
    `★ 굶은 채로 입고 있으면 7초짜리가 **${both.toFixed(0)}초**다 — 배수는 곱한다.`
    + ' 「몸 상태는 손으로 나온다」(PLAN §5-2)가 여기서도 그대로다');
  const s = makeSuit();
  ok(SUIT.wearFor >= 15,
    `그리고 다시 입는 데 ${SUIT.wearFor}초가 든다 — 「벗었다 입었다」로 값을 피할 수 없다`);
  void s;
}

console.log('\n[6] ★ **시계가 셋을 안 넘나** — 열 · 추진제 · 식량');
{
  // 우주복 공기는 **넷째 시계가 아니라 문의 조건**이다.
  // 그것을 재는 방법: **위험이 공기보다 먼저 와야 한다**
  const loadSec = WINCH.load / WINCH.perSec;
  const loads = SUIT.air / loadSec;
  const riskLoads = 100 / (WINCH.riskRise * loadSec);
  console.log(`   공기로 ${loads.toFixed(1)}통 · 위험으로 ${riskLoads.toFixed(1)}통`);
  ok(riskLoads < loads,
    `★★ **위험(${riskLoads.toFixed(1)}통)이 공기(${loads.toFixed(1)}통)보다 먼저 온다** —`
    + ' 그래서 공기는 시계가 아니라 **잊었을 때의 벌**이다.'
    + ' 400초로 잡았다가 재 보고 300 으로 내린 이유가 이것이다');
  ok(SUIT.low > 0 && SUIT.low < SUIT.air * 0.4,
    `${SUIT.low}초 남았을 때 알린다 — 돌아올 시간은 준다 (${(SUIT.low / 60).toFixed(1)}분)`);
}

console.log('\n[7] 사람에게 뭐라고 말하나 — **숫자로 안 띄운다**');
{
  const say = [];
  const a = makeSuit(); say.push(suitWord(a));
  const b = makeSuit(); b.wearing = 3; say.push(suitWord(b));
  const c = makeSuit(); c.on = true; say.push(suitWord(c));
  const d = makeSuit(); d.on = true; d.air = SUIT.low - 1; say.push(suitWord(d));
  for (const w of say) console.log(`   ${w}`);
  ok(new Set(say).size === say.length, '네 단계가 서로 다른 말이다');
  ok(!say.some((w) => /\d/.test(w)), '숫자가 안 들어 있다 — 계기가 아니라 말이다');
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「입는 22초가 지루한가」는 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「입히나 · 진공에서만 주나 · 안 입으면 벌이 오나 · 왜 늘 안 입나」뿐이다.');

// ══════════════════════════════════════════════════════════════════════════
//  여기부터는 **실제 배**다 — `--see 8391` 을 줬을 때만 돈다.
//
//  ★ 표가 다 맞아도 **걸이가 안 잡히면** 아무것도 아니다. v45~v61 동안
//    이 걸이는 화면에 서 있었지만 **장식**이었다 — 「보이는데 못 잡는」
//    상태가 이 저장소에서 몇 번이나 났다 (크랭크 · 조종간 · 주포 좌석).
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
  await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!globalThis.SPACE, null, { timeout: 60000 });
  const S = (fn, a) => p.evaluate(fn, a);
  await S(() => SPACE.clearSave());
  await p.mouse.move(320, 190); await p.mouse.click(320, 190);
  await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });

  // ══ ★★ **헤드리스 시계는 실제의 1/20 이다** ═══════════════════════
  //  처음에 [10]·[11] 을 300ms 씩 스무 번 기다리게 짰다가 둘 다 빨개졌다 —
  //  실제 18초는 **게임으로 0.9초**라 아무 일도 안 일어난 것이 당연했다.
  //  게임은 멀쩡한데 검사가 빨간 것이고, 이건 이 저장소가 `space-sky.js`
  //  에서 이미 겪은 것이다: **시간으로 기다리면 안 되고 조건으로 기다린다.**
  //  그리고 조건이 오래 걸리는 것은 **상태를 미리 밀어 놓고** 짧게 본다
  // ══ ★★ **기다리는 자리를 페이지 안으로 옮겼다** ═══════════════════
  //  이 검사는 세 번 빨갛거나 안 끝났고, 세 번 다 **기다리는 방법**이 문제였다:
  //
  //   ① `SPACE.aimName` 을 읽었다 — 그런 구멍은 없다. 이름은 `SPACE.aim` 이고,
  //      없는 구멍은 서른두 각도에서 `undefined` 를 준다. **「안 잡힌다」와
  //      화면에서 구별이 안 된다** (`space-sky.js` 가 `SPACE.sky` 로 같은 것을
  //      겪고 「숫자가 왔는지부터 묻는다」를 남겼는데, 그걸 안 지켰다)
  //   ② 실제 초로 기다렸다 — 게임 시계가 헤드리스에서 **1/20** 로 돈다
  //      (안 보이는 창의 rAF 를 브라우저가 줄인다). 4초가 실제로 80초다
  //   ③ 밖에서 250ms 마다 물었다 — **여기서는 왕복 한 번이 몇 초**다.
  //      백여 번 물으면 검사가 안 끝난다
  //
  //  그래서 **페이지 안에서 rAF 로 기다리고 왕복은 한 번만** 한다.
  /** 조건이 참이 될 때까지 **페이지 안에서** 기다린다 (왕복 한 번) */
  const inPage = (body, ms = 60000) => S(([src, cap]) => new Promise((res) => {
    const test = new Function(`return (${src})`)();
    const t0 = performance.now();
    const tick = () => {
      let v = null;
      try { v = test(); } catch { v = null; }
      if (v) return res({ ok: true, v });
      if (performance.now() - t0 > cap) return res({ ok: false, v: null });
      requestAnimationFrame(tick);
    };
    tick();
  }), [body, ms]);

  console.log('\n[8] ★★ **걸이가 정말 잡히나** (실제 배)');
  {
    // 자리는 `world/ship.js` 가 정한 그대로다 — 걸이는 에어록의
    // x0+0.55 · 가운데-0.85 에 서 있다. 그 앞에 서서 **고개를 다 돌려 본다**
    const RACK = { x: 1.3 + 0.55, z: (4.2 + 7.2) / 2 - 0.85 };
    const r = await S(([x, z]) => new Promise((res) => {
      const angles = [];
      for (let a = -Math.PI; a < Math.PI; a += 0.2) angles.push(+a.toFixed(2));
      const seen = new Set();
      let i = 0;
      const step = () => {
        if (i >= angles.length) return res({ aim: null, seen: [...seen] });
        SPACE.put(x, z, angles[i], 0);
        requestAnimationFrame(() => {
          const n = SPACE.aim;
          if (n) seen.add(n);
          if (n === 'suit') return res({ aim: angles[i], seen: [...seen] });
          i++; step();
        });
      };
      step();
    }), [RACK.x + 0.95, RACK.z]);
    console.log(`   ${r.aim !== null ? `고개 ${r.aim} 에서 「suit」` : '어느 각도에서도 안 잡힌다'} · 이 자리에서 본 것: ${r.seen.join('·') || '없다'}`);
    // ★ **구멍이 살아 있는지부터 묻는다.** 이름을 틀리면 `undefined` 가
    //   오고, 그건 「안 잡힌다」와 구별이 안 된다
    ok(r.seen.length > 0, '조준 구멍이 살아 있다 — 이 자리에서 뭔가는 잡혔다');
    ok(r.aim !== null, '★★ 우주복 걸이가 **조준선에 잡힌다** — 안 잡히면 그건 장식이다');
  }

  console.log('\n[9] ★★ **입으면 손이 둔해진다**');
  {
    const before = await S(() => SPACE.suit);
    const after = await S(() => { SPACE.putSuit(true); return SPACE.suit; });
    console.log(`   ${before.word} → ${after.word}`);
    ok(!before.on && after.on, '입혀진다');
    ok(after.canEva, '입으면 나갈 수 있다');
    ok(after.hand < 1, `손이 ${after.hand}배로 둔해진다 — 화면 밖에서도 값이 온다`);
  }

  console.log('\n[10] ★★ **안 입고 열면 시계가 돌기 시작하나** (실제 배)');
  {
    // ★ 4초가 4초인지는 표가 이미 잰다 (`[4]`). 실제 배에 물을 것은 하나 —
    //   **그 규칙이 정말 돌고 있나.** 진공으로 알아보고, 시계가 가기 시작하면
    //   배선이 살아 있는 것이다
    await S(() => {
      SPACE.putSuit(false);
      SPACE.setPower('thrust', false);
      SPACE.putLock(true);
      SPACE.setAir(0.02);        // 이미 배기가 끝난 칸
    });
    const r = await inPage('() => (SPACE.lock.vacuum && SPACE.lock.bare > 0) ? SPACE.lock : null');
    const su = await S(() => SPACE.suit);
    ok((await S(() => SPACE.lock)).vacuum, '★ 게임이 그 칸을 **진공으로 안다** — 말이 「배기 완료」다');
    ok(r.ok, `★★ 우주복 없이 서 있으니 **시계가 간다** (${r.v ? r.v.bare : '-'}초 셌다)`);
    ok(su.bareLeft !== null && su.bareLeft <= 4,
      `★ 남은 시간을 게임이 들고 있다 (${su.bareLeft}초) — 배너가 이걸 말한다`);
  }

  console.log('\n[11] ★ **입고 있으면 시계가 안 가고, 대신 우주복 공기가 준다**');
  {
    await S(() => { SPACE.putSuit(true, 300); SPACE.putLock(true); SPACE.setAir(0.02); });
    const r = await inPage('() => SPACE.suit.air < 299.5 ? SPACE.suit : null');
    const l2 = await S(() => SPACE.lock);
    const s2 = await S(() => SPACE.suit);
    ok(l2.open && l2.bare === 0,
      '★★ 입고 있으면 **시계가 안 간다** — 진공은 사고가 아니라 절차다');
    ok(s2.bareLeft === null, '그리고 배가 닫을 이유가 없다');
    ok(r.ok, `대신 **우주복 공기가 준다** (${s2.air}초) — 이쪽이 선외 작업 시계다`);
    ok(s2.inVacuum, '손목이 「진공입니다」를 말할 재료도 온다');
  }

  ok(errs.length === 0, `콘솔 오류 ${errs.length}건${errs.length ? ' — ' + errs[0] : ''}`);
  await b.close();
  console.log('');
  console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과 (표 + 실제 배)');
}

process.exit(fail ? 1 : 0);
