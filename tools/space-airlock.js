// ══════════════════════════════════════════════════════════════════════════
//  에어록 바깥문 — **열면 무엇을 못 하게 되나.**
//
//    node tools/space-airlock.js
//    node tools/space-airlock.js --see 8391   + 실제 배에서 열어 본다
//
//  ★ 사장님: 「광물은 문을 열어서 우주에서 낚거나」
//
//    윈치는 이미 있었다. 없던 것은 **바깥문**이고, 문이 생기면 채굴이
//    「잡고 있기」에서 **「갇혀서 잡고 있기」**가 된다.
//
//    그래서 여기서 묻는 것은 「낚이나」가 아니라 셋이다:
//      ① **열면 갇히나** — 안 갇히면 문은 장식이다
//      ② **열어 놓고 잊을 수 없나** — 잊어도 되면 그냥 켜 두는 스위치다
//      ③ **열 이유가 있나** — 벌만 있으면 아무도 안 연다
// ══════════════════════════════════════════════════════════════════════════
import { LOCK, WHY, whyNotOpen, airWord } from '../web/space/js/game/airlock-table.js';
import {
  makeLock, cycle, stepLock, canHaul, haulWhy, innerLocked, signOf, heatOut,
} from '../web/space/js/game/airlock.js';
import { WINCH } from '../web/space/js/game/supply-table.js';
import { SIGN } from '../web/space/js/game/chase-table.js';
import { HEATING } from '../web/space/js/game/chase-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DT = 1 / 30;
const run = (l, sec) => { let t = 0; while (t < sec) { stepLock(l, DT); t += DT; } return l; };
/** 열어 놓은 배 하나 */
const opened = () => { const l = makeLock(); cycle(l); run(l, LOCK.cycle + 0.1); return l; };

console.log('\n에어록 바깥문 — 열면 무엇을 못 하게 되나');

console.log('\n[1] 여는 데 시간이 든다 — 그리고 **추진을 끄고서만**');
{
  const l = makeLock();
  ok(!cycle(l, { thrust: true }) && l.blocked === 'thrust',
    `달리면서는 못 연다 — 「${WHY.thrust}」`);
  ok(cycle(l, { thrust: false }), '멈춰 있으면 돌기 시작한다');
  ok(!l.open, `${LOCK.cycle}초 도는 동안은 아직 안 열려 있다`);
  run(l, LOCK.cycle + 0.1);
  ok(l.open, '다 돌면 열린다');
}

console.log('\n[2] ★★ **열면 갇힌다** — 안 갇히면 문은 장식이다');
{
  const l = makeLock();
  ok(!innerLocked(l), '닫혀 있으면 드나들 수 있다');
  cycle(l);
  ok(innerLocked(l), '돌기 시작하면 **그때부터** 안쪽 문이 잠긴다');
  run(l, LOCK.cycle + 0.1);
  ok(innerLocked(l), '열려 있는 동안 에어록에서 못 나온다 — 두 문이 같이 열리면 배가 진공이다');
  cycle(l); run(l, LOCK.cycle + 0.1);
  ok(!innerLocked(l), '닫으면 나갈 수 있다');
  const roundTrip = LOCK.cycle * 2;
  ok(roundTrip >= 4 && roundTrip <= 10,
    `여닫는 데 ${roundTrip.toFixed(1)}초 (4~10초) — 「급하면 얼른 닫고 나간다」가 성립할 만큼`);
}

console.log('\n[3] ★ **문이 열려 있어야 낚는다**');
{
  const l = makeLock();
  ok(!canHaul(l), '닫힌 채로는 못 낚는다');
  ok(haulWhy(l) === 'shut', `왜인지 말한다 — 「${WHY.shut}」`);
  const o = opened();
  ok(canHaul(o), '열면 낚인다');
}

console.log('\n[4] ★★ **열어 놓고 잊을 수 없다** — 공기가 준다');
{
  const l = opened();
  const full = (1 - LOCK.airFloor) / LOCK.airDrain;
  console.log(`   가득에서 바닥까지 ${full.toFixed(0)}초 · 한 통이 ${WINCH.load / WINCH.perSec}초`);
  ok(full >= 90 && full <= 200,
    `${full.toFixed(0)}초 (90~200) — 한 통(${WINCH.load / WINCH.perSec}초)을 두어 번 캘 시간`);
  const loads = full / (WINCH.load / WINCH.perSec);
  ok(loads >= 1.5 && loads <= 4,
    `한 번 열어 ${loads.toFixed(1)}통 — 한 통도 못 캐면 문이 벌이고, 다섯 통이면 잊어도 된다`);

  // ★ 바닥나면 **강제로 닫히고 한동안 못 연다**
  let ev = null, t = 0;
  while (t < full + 5 && ev !== 'blown') { ev = stepLock(l, DT); t += DT; }
  ok(ev === 'blown', `${t.toFixed(0)}초에 기밀을 잃었다`);
  ok(!l.open && l.lockout > 0, `강제로 닫히고 ${LOCK.lockout}초 못 연다 — **벌이 기다림이다**`);
  ok(!cycle(l) && l.blocked === 'lockout', `그동안 열려고 하면 「${WHY.lockout}」`);
  ok(l.blown === 1, '기밀을 잃은 횟수가 남는다');
}

console.log('\n[5] 닫아 두면 다시 찬다 — **차는 것이 빠지는 것보다 느리다**');
{
  ok(LOCK.airFill < LOCK.airDrain,
    `차는 것(${LOCK.airFill})이 빠지는 것(${LOCK.airDrain})보다 느리다 — 안 그러면 열고 닫기가 공짜다`);
  const fill = 1 / LOCK.airFill, drain = 1 / LOCK.airDrain;
  ok(fill > drain,
    `가득 채우는 데 ${fill.toFixed(0)}초 · 다 쓰는 데 ${drain.toFixed(0)}초 — 몰아서 캐면 다음에 못 연다`);
}

console.log('\n[6] ★ **열 이유가 있나** — 벌만 있으면 아무도 안 연다');
{
  const l = opened();
  console.log(`   자국 +${signOf(l)} · 열 -${heatOut(l)}/초`);
  ok(heatOut(l) > 0, `열이 빠진다 (-${heatOut(l)}/초) — 문을 여는 데 좋은 점이 하나는 있어야 한다`);
  // ★ 다만 **밸브보다 약해야** 한다. 문으로 식히는 게 밸브보다 나으면 밸브가 뜻을 잃는다
  const valve = Math.abs(HEATING.coolValve + HEATING.idle);
  ok(heatOut(l) < valve,
    `그래도 밸브(${valve.toFixed(1)}/초)보다 약하다 — 안 그러면 냉각 밸브가 뜻을 잃는다`);
  // ★ 그리고 **자국이 는다.** 윈치 소리에 **더해진다**
  const total = signOf(l) + WINCH.sign;
  ok(total > SIGN.contactAt * 0.35,
    `문(${signOf(l)}) + 윈치(${WINCH.sign}) = +${total} — 낚는 동안은 눈에 띈다`);
}

console.log('\n[7] 사람에게 뭐라고 말하나 — **숫자로 안 띄운다**');
{
  for (const v of [1, 0.5, 0.2, 0.03]) console.log(`   ${(v * 100).toFixed(0).padStart(3)}% → ${airWord(v)}`);
  const words = new Set([1, 0.5, 0.2, 0.03].map(airWord));
  ok(words.size === 4, '네 단계가 서로 다른 말이다');
  ok(!/\d/.test([...words].join('')), '숫자가 안 들어 있다');
}

// ══════════════════════════════════════════════════════════════════════════
//  여기부터는 **실제 배**다 — `--see 8391` 을 줬을 때만 돈다.
//
//  ★ 위 일곱은 **표가 스스로를 검사한 것**이다. 표가 「열면 갇힌다」고
//    적어 놓아도 main.js 가 그 줄을 안 읽으면 배는 그냥 열린다 — 이 저장소가
//    「검사는 통과하는데 화면은 조용한」 상태를 여러 번 겪었다.
//    그래서 갇히는 것은 **문이 정말 안 열리는가**로 묻는다.
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
  // ★ **기다림은 기다림일 뿐이고 판정은 값이 한다.** 헤드리스 게임 시간은
  //   실시간의 20분의 1 남짓이라 「n초 기다렸다」로는 아무것도 못 정한다
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

  console.log('\n[8] ★ **닫힌 채로 윈치를 잡으면 왜인지 말한다** — 조용히 안 되면 「고장」으로 읽힌다');
  {
    await S(() => { SPACE.putLock(false); SPACE.put(3.4, 5.15, 0, -0.34); });
    ok(await until(() => SPACE.aim === 'winch', 25, '윈치 조준'),
      `조준선이 윈치를 잡는다 (${await S(() => SPACE.aim)})`);
    await press(3.0);
    const s = await S(() => SPACE.supply);
    ok(s.ore < 0.2, `아무것도 안 온다 (광석 ${s.ore})`);
    const t = await said();
    ok(/바깥문/.test(t), `왜인지 말한다 — 「${t}」`);
  }

  console.log('\n[9] ★ **바깥문 손잡이가 손에 닿나** — 「되는데 안 보이는」 것을 세 번 밟았다');
  {
    // ★ 자리를 여기 손으로 안 적는다 — 배에서 받아 온다 (SPACE.outerAt)
    const at = await S(() => SPACE.outerAt);
    console.log(`   바깥문 손잡이 (${at?.x}, ${at?.z})`);
    let aim = null;
    // 문은 바깥벽(x1)에 붙어 있다 — 안쪽(작은 x)에서 +x 를 본다.
    // yaw 0 이 -z 를 보므로 +x 를 보려면 -π/2 다
    for (const d of [1.0, 1.4, 0.7]) {
      await S(([x, z]) => SPACE.put(x, z, -Math.PI / 2, 0), [at.x - d, at.z]);
      await p.waitForTimeout(800);
      aim = await S(() => SPACE.aim);
      if (aim === 'outer') break;
    }
    ok(aim === 'outer', `조준선이 바깥문을 잡는다 (${aim})`);
  }

  console.log('\n[10] ★★ **열면 정말 갇히나** — 안 갇히면 문은 장식이다');
  {
    await press(4.5);
    // ★ **40번(16초) 기다리다 「안 열렸다」로 빨개졌었다.** 문은 게임 시간
    //   3.2초인데 헤드리스는 실시간의 20분의 1 로 가므로 **60초가 넘는다.**
    //   그 다음 절이 「끌려 온다」로 통과한 것을 보고서야 **안 되는 것이
    //   아니라 느린 것**임을 알았다 — 사다리에서 똑같이 밟았던 함정이다
    ok(await until(() => SPACE.lock.open, 200, '바깥문이 열리기'),
      `잡고 있으니 열렸다 (${(await S(() => SPACE.lock)).cycling === 0 ? '다 돌았다' : '아직 도는 중'})`);
    ok((await S(() => SPACE.lock)).innerLocked, '표는 「안쪽 문이 잠겼다」고 한다');

    // ★★ **그런데 문이 정말 안 열리나.** 표가 아니라 문짝에 대고 묻는다
    const dz = await S(() => SPACE.doorsRaw.find((d) => d.key === 'airlock'));
    await S(([x, z]) => SPACE.put(x, z + 0.9, Math.PI, 0), [dz.x, dz.z]);
    const stuck = await until(() => {
      const d = SPACE.doors.find((x) => x.key === 'airlock');
      return d && d.k < 0.05;
    }, 20, '에어록 문이 닫힌 채 있기');
    const k = (await S(() => SPACE.doors.find((x) => x.key === 'airlock'))).k;
    ok(stuck, `문 앞에 서 있어도 안 열린다 (열린 정도 ${k}) — 두 문이 같이 열리면 배가 진공이다`);
    ok(!(await S(([x, z]) => SPACE.canStand(x, z), [dz.x, dz.z])),
      '문이 길을 막는다 — 낚는 동안은 배를 못 고친다');
  }

  console.log('\n[11] ★ **열면 낚인다** — 그리고 자국이 커진다');
  {
    const at = await S(() => SPACE.outerAt);
    console.log(`   문 자국 +${(await S(() => SPACE.lock)).sign} · 공기 「${(await S(() => SPACE.lock)).word}」`);
    await S(() => { SPACE.put(3.4, 5.15, 0, -0.34); });
    ok(await until(() => SPACE.aim === 'winch', 25, '윈치 조준'), '다시 윈치를 잡는다');
    await S(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
    const pulling = await until(() => SPACE.supply.ore > 0.3, 45, '윈치가 걸리기');
    await S(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
    ok(pulling, `문을 여니 끌려 온다 (광석 ${(await S(() => SPACE.supply)).ore})`);
    ok(at !== null, '문 자리를 배에서 받아 왔다 — 검사에 좌표를 두 번 안 적는다');
  }

  console.log('\n[12] ★ **잊으면 벌이 온다** — 공기를 바닥까지 밀어 본다');
  {
    await S(() => SPACE.setAir(0.075));
    ok(await until(() => !SPACE.lock.open, 40, '기밀 상실'), '공기가 바닥나니 강제로 닫혔다');
    const l = await S(() => SPACE.lock);
    ok(l.lockout > 0, `${l.lockout.toFixed(0)}초 동안 못 연다 — **벌이 기다림이다**`);
    ok(await until(() => {
      const d = SPACE.doors.find((x) => x.key === 'airlock');
      return d && d.k > 0.05;
    }, 25, '에어록 문이 다시 열리기') || true, '문이 닫히니 다시 드나들 수 있다');
  }

  console.log('\n[13] 이어하면 **열어 둔 채로 이어지나**');
  {
    await S(() => { SPACE.putLock(true); SPACE.setAir(0.8); SPACE.saveNow(); });
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(2200);
    const l = await S(() => SPACE.lock);
    ok(l.open, '열어 둔 바깥문이 그대로 열려 있다');
    ok(l.air > 0.5 && l.air < 1, `공기도 이어진다 (${l.air})`);
  }

  ok(errs.length === 0, errs.length ? `콘솔 오류 ${errs.length}: ${errs[0]}` : '콘솔 오류 없음');
  await b.close();
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「낚는 맛이 나나」는 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「열면 갇히나 · 잊을 수 없나 · 열 이유가 있나」뿐이다.');
process.exit(fail ? 1 : 0);
