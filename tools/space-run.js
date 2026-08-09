// ══════════════════════════════════════════════════════════════════════════
//  달리기가 **계산이 되나** — 브라우저 없이.
//
//    node tools/space-run.js            숫자만 (1초)
//    node tools/space-run.js --see 8391  + 실제로 빨라지나
//
//  ★ 여기서 묻는 것은 「빨라지나」가 아니다. 그건 배수 하나면 끝난다.
//    **「늘 뛰는 것이 답이 되지 않나」**를 묻는다 — 치르는 것이 없으면
//    이건 장치가 아니라 그냥 배를 작게 만든 것이다 (PLAN2H §7-2).
//
//  ★ 그리고 **못 뛸 때 왜인지 말하나.** 조용히 안 뛰어지면 사람은
//    「어렵다」가 아니라 「고장났다」로 읽는다 — 이 저장소가 윈치·해도대·
//    조종간에서 이미 세 번 겪은 것이다.
// ══════════════════════════════════════════════════════════════════════════
import { RUN, WHY, whyNotRun, isWinded } from '../web/space/js/game/move-table.js';
import { makeMove, moveStep, bump, handMult, summary } from '../web/space/js/game/move.js';
import { BODY } from '../web/space/js/game/systems-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DT = 1 / 60;

/** 몇 초 동안 뛴다(또는 걷는다). 실제로 움직이는 중이라고 본다 */
function go(m, sec, want, s = {}) {
  let t = 0, dist = 0;
  while (t < sec) { dist += BODY.speed * moveStep(m, DT, want, true, s) * DT; t += DT; }
  return dist;
}
/** 몇 초 동안 선다 */
function stand(m, sec) {
  let t = 0;
  while (t < sec) { moveStep(m, DT, false, false); t += DT; }
}

console.log('\n[1] 빨라지나 — 그리고 **얼마나**');
{
  const a = makeMove(), b = makeMove();
  const walk = go(a, 4, false);
  const run = go(b, 4, true);
  ok(run > walk * 1.4, `4초에 걸어서 ${walk.toFixed(1)}m · 뛰어서 ${run.toFixed(1)}m (${(run / walk).toFixed(2)}배)`);
  // 통로 13m 를 몇 초에
  const wSec = 13 / BODY.speed, rSec = 13 / (BODY.speed * RUN.mult);
  ok(rSec < wSec * 0.7, `통로 13m — 걸어서 ${wSec.toFixed(1)}초 · 뛰어서 ${rSec.toFixed(1)}초`);
  // ★ 배가 절반이 되면 안 된다. 방 사이가 **여전히 한 번의 결심**이어야 한다
  ok(rSec >= 2.0, `뛰어도 ${rSec.toFixed(1)}초는 걸린다 — 2초 밑이면 배가 없는 것이다`);
}

console.log('\n[2] ★ **늘 뛰는 것이 답이 아니다** — 여기가 이 계통의 전부다');
{
  const m = makeMove();
  const spent = go(m, RUN.breath + 1, true);
  ok(m.breath === 0, `${RUN.breath}초를 뛰면 숨이 바닥난다 (${m.breath})`);
  // 바닥나면 **걷기만** 된다
  const after = go(m, 2, true);
  ok(Math.abs(after - BODY.speed * 2) < 0.1,
    `숨이 없으면 뛰려 해도 걷는다 — 2초에 ${after.toFixed(1)}m (걷기 ${(BODY.speed * 2).toFixed(1)}m)`);
  ok(m.blocked === 'breath', `왜 못 뛰는지 말한다 — 「${WHY[m.blocked]}」`);

  // 차는 데가 뛰는 데보다 **길다**
  const m2 = makeMove();
  go(m2, RUN.breath + 1, true);
  let t = 0;
  while (m2.breath < 1 && t < 60) { stand(m2, 0.1); t += 0.1; }
  ok(t > RUN.breath, `다 차는 데 ${t.toFixed(1)}초 — 뛴 시간(${RUN.breath}초)보다 길어야 아껴 쓴다`);

  // **멈추자마자 안 찬다** — 「뛰고 서고」가 답이 되면 안 된다
  const m3 = makeMove();
  go(m3, 4, true);
  const at = m3.breath;
  stand(m3, RUN.restBefore * 0.7);
  ok(m3.breath === at, `멈춰도 ${RUN.restBefore}초는 안 찬다 — 뛰고 서고를 반복하는 요령을 막는다`);
}

console.log('\n[3] ★ **뛰고 나면 손이 떨린다** — 빠름과 정확함을 맞바꾼다');
{
  const m = makeMove();
  ok(handMult(m) === 1, '멀쩡하면 수리 속도 그대로 (1)');
  go(m, RUN.breath * 0.85, true);
  ok(isWinded(m.breath), `${(RUN.breath * 0.85).toFixed(1)}초 뛰면 숨차다 (${m.breath.toFixed(2)} ≤ ${RUN.windedAt})`);
  ok(handMult(m) === RUN.handMult, `숨찬 동안 수리가 ${RUN.handMult} 배로 느리다`);
  // ★ **바닥(0)이 아니라 조금 남았을 때부터** 벌이 와야 재게 된다.
  //   0 에서만 주면 사람은 8.9초까지 뛰고 만다 — 그건 계산이 아니라 눈금 읽기다
  ok(RUN.windedAt > 0, `바닥나기 전에(${RUN.windedAt}) 이미 떨린다 — 눈금 읽기를 막는다`);

  // 굶었을 때와 **같은 규약**인가
  ok(RUN.handMult < 1 && RUN.handMult > 0.5,
    `굶음·숨참이 둘 다 「손이 안 듣는다」로 같은 꼴 (${RUN.handMult})`);
}

console.log('\n[4] 못 뛰는 때 — **이미 있는 것과 엮인다**');
{
  ok(whyNotRun({ breath: 1, bothHands: true }) === 'hands',
    '두 손으로 안으면 못 뛴다 — carry-table 과 같은 규칙');
  ok(whyNotRun({ breath: 1, dark: true }) === 'dark', '정전 중에는 못 뛴다');
  ok(whyNotRun({ breath: 1 }) === null, '빈손에 불이 켜져 있으면 뛴다');
  // 한 손짜리는 들고 뛴다 (bothHands 가 거짓이므로)
  ok(whyNotRun({ breath: 1, bothHands: false }) === null,
    '공구 가방(한 손)은 들고 뛴다 — 한 손과 두 손의 차이가 또 값을 한다');
  // 말이 다 있나. **조용히 막지 않는다**
  for (const k of ['hands', 'dark', 'breath']) {
    ok(!!WHY[k] && WHY[k].length <= 30, `「${WHY[k]}」 (${WHY[k].length}자)`);
  }
}

console.log('\n[5] 스치면 비틀거린다 — 벌이 숫자가 아니라 **일**이다');
{
  const m = makeMove();
  go(m, 1, true);
  ok(m.running, '뛰는 중');
  ok(bump(m) === true, '스치면 손에 든 것을 놓친다 — 다시 주워야 한다');
  ok(m.stumble > 0 && !m.running, `${RUN.stumble}초 비틀거리고 달리기가 끊긴다`);
  // 비틀거리는 동안은 느리다
  const slow = go(m, RUN.stumble * 0.5, true);
  ok(slow < BODY.speed * RUN.stumble * 0.5 * 0.5, `비틀거리는 동안 느리다 (${slow.toFixed(2)}m)`);
  // 걷는 중에 스치면 아무 일 없다 — 뛴 사람만 벌한다
  const w = makeMove();
  go(w, 1, false);
  ok(bump(w) === false, '걷다가 스치면 아무 일도 없다');
}

console.log('\n[6] ★ C 장면의 계산이 성립하나 (PLAN2H §4)');
{
  // 조종석 ↔ 정비실 왕복을 대략 13m + 12m 로 본다
  const D = 25;
  const walkSec = D / BODY.speed;
  const runSec = D / (BODY.speed * RUN.mult);
  ok(walkSec > 7 && runSec < walkSec * 0.7,
    `왕복 ${D}m — 걸어서 ${walkSec.toFixed(0)}초 · 뛰어서 ${runSec.toFixed(0)}초`);
  // 그런데 그 거리를 다 뛸 숨이 있나
  ok(runSec <= RUN.breath,
    `한 번에 뛸 수 있다 (${runSec.toFixed(1)}초 ≤ 숨 ${RUN.breath}초) — 못 뛰면 계산이 성립 안 한다`);
  // 도착하면 숨이 찬 상태인가 — **그게 이 장면의 맞바꿈이다**
  const m = makeMove();
  go(m, runSec, true);
  ok(isWinded(m.breath),
    `도착하면 숨차 있다 (${m.breath.toFixed(2)}) — 빨리 왔지만 손이 떨린다`);
  console.log(`     → 「빨리 가서 느리게 고친다」 vs 「천천히 가서 제대로 고친다」`);
}

// ══════════════════════════════════════════════════════════════════════════
//  여기부터는 **실제 배**다 — `--see` 를 줬을 때만 돈다.
//
//  ★ 위의 여섯은 표와 규칙만 본다. 표가 아무리 맞아도 `main.js` 가
//    Shift 를 안 읽으면 화면에서는 아무 일도 안 난다 — 이 저장소가
//    반복해서 밟은 함정이다 (창이 창이 아니었던 일).
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
  await p.click('#btn-play').catch(() => p.mouse.click(320, 190));
  await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });

  // 통로 한쪽 끝에 세우고 앞으로 달리게 한다.
  // ★ 시간이 아니라 **거리**로 잰다 — 헤드리스는 프레임이 들쭉날쭉해서
  //   「3초 뛰면 몇 m」가 기계마다 다르다. 같은 시간에 걷기와 뛰기를
  //   견주면 그 흔들림이 상쇄된다
  const trip = async (run) => {
    await S(() => SPACE.put(0, -2.0, Math.PI, 0));
    for (let i = 0; i < 25; i++) {
      await p.waitForTimeout(300);
      const at = await S(() => SPACE.pos);
      if (Math.abs(at.z + 2.0) < 0.1) break;
    }
    const from = await S(() => SPACE.pos);
    if (run) await p.keyboard.down('ShiftLeft');
    await p.keyboard.down('KeyW');
    await p.waitForTimeout(3000);
    await p.keyboard.up('KeyW');
    if (run) await p.keyboard.up('ShiftLeft');
    const to = await S(() => SPACE.pos);
    return Math.hypot(to.x - from.x, to.z - from.z);
  };

  console.log('\n[7] ★ 실제 배에서 **정말 빨라지나**');
  {
    const walked = await trip(false);
    // 숨을 채워 놓고 다시
    await p.waitForTimeout(3000);
    const ran = await trip(true);
    ok(ran > walked * 1.25,
      `같은 시간에 걸어서 ${walked.toFixed(1)}m · 뛰어서 ${ran.toFixed(1)}m (${(ran / walked).toFixed(2)}배)`);
    const m = await S(() => SPACE.move);
    ok(m.breath < 1, `뛰고 나면 숨이 줄어 있다 (${m.breath})`);
  }

  console.log('\n[8] 두 손이 차면 **못 뛰고, 왜인지 말한다**');
  {
    ok(await S(() => SPACE.giveItem('coolant')), '냉매통을 안는다');
    const before = await S(() => SPACE.pos);
    await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyW');
    await p.waitForTimeout(2500);
    await p.keyboard.up('KeyW'); await p.keyboard.up('ShiftLeft');
    const after = await S(() => SPACE.pos);
    const d = Math.hypot(after.x - before.x, after.z - before.z);
    const m = await S(() => SPACE.move);
    ok(!m.running, `안고 있는 동안 안 뛴다 (running=${m.running} · ${d.toFixed(1)}m)`);
    // 배너로 이유를 말했나 — 조용히 막으면 「고장」으로 읽힌다
    const said = await S(() => {
      const el = document.getElementById('hud');
      return el && !el.hidden ? el.textContent : null;
    });
    ok(/두 손|걸어/.test(said ?? ''), `왜인지 말한다 — 「${said ?? '아무 말 없음'}」`);
  }

  if (errs.length) { console.log('콘솔 오류:'); for (const e of errs.slice(0, 5)) console.log('  ' + e); fail += errs.length; }
  await b.close();
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
process.exit(fail ? 1 : 0);
