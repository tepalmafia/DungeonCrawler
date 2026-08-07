// ══════════════════════════════════════════════════════════════════════════
//  조종간이 **늘 먹나** — 그리고 「늘 틀어 놓기」가 답이 아닌가.
//
//    node tools/space-helm.js
//    node tools/space-helm.js --see 8391   + 실제 배에서 잡아 본다
//
//  ★ 사장님: 「조종석을 움직일 수 없잖아? 다시 만들어」
//
//    재 보니 맞았다. 조종석은 **걸어다닐 수 있었다** (닿는 칸 403).
//    문제는 조종간이 **잔해 지대 안에서만** 뭔가를 한다는 것이었고,
//    그건 회차의 10% 다. 나머지 90% 동안 조종간은 잡아도 아무 일이 없다.
//
//  ★ 그런데 조종을 늘리면 장르가 바뀐다 (`CHASE2.md §5`).
//    그래서 여기서 묻는 것은 「조종이 재미있나」가 아니라 두 가지다:
//
//      ① **조종간이 늘 먹나** — 지대 밖에서도 뭔가 일어나나
//      ② **늘 틀어 놓는 것이 답이 아닌가** — 답이면 그건 스위치다
// ══════════════════════════════════════════════════════════════════════════
import { HELM, legMult, signMult, canDock, offWord } from '../web/space/js/game/helm-table.js';
import { makeHelm, stepHelm, tryDock, legOf, signOf, summary } from '../web/space/js/game/helm.js';
import { SIGN } from '../web/space/js/game/chase-table.js';
import { LEG } from '../web/space/js/game/route-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DT = 1 / 30;

/** 몇 초 동안 민다 */
function push(h, sec, amount = 1, inField = false) {
  let t = 0;
  while (t < sec) { stepHelm(h, DT, amount, inField); t += DT; }
  return h;
}
/** 몇 초 동안 놓는다 */
function let_go(h, sec) { return push(h, sec, 0); }

console.log('\n조종 — 조종간이 늘 먹나');

console.log('\n[1] ★ **지대 밖에서도 먹나** — 여기가 이 판의 전부다');
{
  const h = makeHelm();
  push(h, 3);
  ok(h.off > 0.5, `3초 밀면 ${(h.off * 100).toFixed(0)}% 벗어난다 — 지대 밖인데도 뭔가 일어난다`);
  ok(h.way !== 0, '어느 쪽으로 틀었는지도 남는다 — 창밖이 그쪽으로 기운다');
  const full = 1 / HELM.turnRate;
  ok(full > 1.5 && full < 6,
    `끝까지 트는 데 ${full.toFixed(1)}초 (1.5~6초) — 톡 건드린 것과 작정한 것이 달라야 한다`);
}

console.log('\n[2] 틀면 **느려지고 대신 안 보인다** — 그게 거래다');
{
  const h = makeHelm();
  push(h, 10);                            // 끝까지
  ok(h.off >= 0.99, '끝까지 틀었다');
  console.log(`   구간 진행 ×${legOf(h).toFixed(2)} · 자국 ×${signOf(h).toFixed(2)}`);
  ok(legOf(h) < 0.8, `느려진다 (×${legOf(h).toFixed(2)})`);
  ok(signOf(h) < 0.8, `안 보인다 (×${signOf(h).toFixed(2)})`);
  // ★ **실제로 접촉 기준 아래로 내려가나** — 안 내려가면 이 장치는 장식이다
  const hot = 62;                         // 추진 켜고 열이 좀 있는 흔한 상태
  ok(hot * signOf(h) < SIGN.contactAt,
    `자국 ${hot} 이 ${(hot * signOf(h)).toFixed(0)} 으로 — 접촉 기준(${SIGN.contactAt}) 아래로 내려간다`);
}

console.log('\n[3] ★ **놓고 가도 된다** — 조종석에 매이면 장르가 바뀐다 (CHASE2 §5)');
{
  const h = makeHelm();
  push(h, 10);
  let_go(h, 4);
  // ★ 「놓아도 얼마나 남나」를 **몇 % 로** 물으면 아무 숫자나 고르게 된다.
  //   물어야 할 것은 **「그 사이에 뭘 할 수 있나」**다 — 통로까지 걸어가
  //   차단기를 내리는 데 4초쯤 걸린다. 그동안 아직 숨어 있어야 한다
  ok(signOf(h) < 0.8,
    `놓고 4초(차단기까지 걸어가는 시간) 지나도 아직 숨어 있다 — 자국 ×${signOf(h).toFixed(2)}`);
  // 돌아오는 것이 트는 것보다 **느려야** 한다
  ok(HELM.backRate < HELM.turnRate,
    `돌아오는 것(${HELM.backRate})이 트는 것(${HELM.turnRate})보다 느리다`);
  const backSec = 1 / HELM.backRate;
  ok(backSec > 5, `저절로 다 돌아오는 데 ${backSec.toFixed(0)}초 — 잡고 있을 필요가 없다`);
}

console.log('\n[4] ★★ **늘 틀어 놓는 것이 답이 아닌가** — 답이면 이건 스위치다');
{
  const h = makeHelm();
  push(h, 10);
  ok(!canDock(h.off), '많이 벗어난 채로는 **거점에 못 닿는다**');
  const before = h.missed;
  ok(tryDock(h) === false && h.missed === before + 1, '지나친다 — 되돌아와야 한다');
  // 되돌아오면 닿는다
  let_go(h, 30);
  ok(canDock(h.off), `돌아오면 닿는다 (${(h.off * 100).toFixed(0)}% · 기준 ${HELM.portWithin * 100}%)`);

  // ★ 늘 틀어 놓으면 회차가 얼마나 길어지나 — 벌이 시간으로 와야 한다
  const slow = LEG.seconds / HELM.slowTo - LEG.seconds;
  ok(slow > 100, `늘 틀어 놓으면 구간마다 ${slow.toFixed(0)}초 더 걸린다 — 12구간이면 ${(slow * 12 / 60).toFixed(0)}분`);
}

console.log('\n[5] 지대 안에서는 **바위를 피하는 데 쓴다** — 두 가지를 동시에 안 한다');
{
  const h = makeHelm();
  push(h, 5, 1, true);                    // 지대 안에서 밀어 본다
  ok(h.off < 0.02,
    `지대 안에서는 항로가 안 벗어난다 (${h.off.toFixed(3)}) — 같은 손잡이가 딴 일을 한다`);
  ok(HELM.notInField, '표에 그렇게 적혀 있다');
}

console.log('\n[6] 사람에게 뭐라고 말하나 — **숫자로 안 띄운다**');
{
  for (const v of [0, 0.2, 0.5, 0.9]) console.log(`   ${(v * 100).toFixed(0).padStart(3)}% → ${offWord(v)}`);
  const words = new Set([0, 0.2, 0.5, 0.9].map(offWord));
  ok(words.size === 4, '네 단계가 서로 다른 말이다');
  ok(!/\d/.test([...words].join('')), '숫자가 안 들어 있다 — 얼마나 벗어났나는 창밖이 말한다');
}

// ══════════════════════════════════════════════════════════════════════════
//  여기부터는 **실제 배**다 — `--see 8391` 을 줬을 때만 돈다.
//
//  ★ 위 여섯은 규칙만 본다. 그런데 이 판이 고치는 병이 정확히
//    **「규칙은 있는데 조종간이 그걸 안 부른다」**였다 — 표만 보면
//    안 보이는 종류다.
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

  console.log('\n[7] ★★ **지대 밖에서 조종간을 잡으면 뭔가 일어나나**');
  {
    // 조종간 앞에 선다
    await S(() => SPACE.put(0, -7.75, 0, -0.2));
    await p.waitForTimeout(900);
    const aim = await S(() => SPACE.aim);
    ok(aim === 'yoke', `조종간을 겨눴다 (${aim})`);
    const was = await S(() => SPACE.helm.off);
    // 잡고 옆으로 민다 — 조준 잠금 아래에서는 movementX 로 민다
    await S(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
    for (let i = 0; i < 30; i++) {
      await S(() => window.dispatchEvent(new MouseEvent('mousemove', { movementX: 60, movementY: 0 })));
      await p.waitForTimeout(200);
      if ((await S(() => SPACE.helm.off)) > 0.15) break;
    }
    await S(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
    const h = await S(() => SPACE.helm);
    ok(h.off > was + 0.05,
      `잡고 밀었더니 항로를 ${(h.off * 100).toFixed(0)}% 벗어났다 (${h.word}) — 지대 밖인데 뭔가 일어난다`);
    ok(h.sign < 1, `자국이 ×${h.sign.toFixed(2)} 로 줄었다`);
    ok(h.leg < 1, `구간 진행이 ×${h.leg.toFixed(2)} 로 줄었다`);
  }

  console.log('\n[8] ★ **창밖이 그쪽으로 기우나** — 값만 바뀌고 화면이 조용하면 잰 게 없다');
  {
    const shot = async () => (await p.screenshot({ clip: { x: 60, y: 40, width: 520, height: 200 } })).toString('base64');
    await S(() => SPACE.setOff(0));
    await p.waitForTimeout(900);
    const flat = await shot();
    await S(() => SPACE.setOff(1));
    await p.waitForTimeout(900);
    const turned = await shot();
    ok(flat !== turned, '틀기 전과 후의 창이 다른 그림이다');
  }

  console.log('\n[9] ★ **벗어난 채로는 거점에 못 닿나**');
  {
    await S(() => { SPACE.setOff(1); SPACE.skipLeg(); });
    let said = null;
    for (let i = 0; i < 30; i++) {
      await p.waitForTimeout(300);
      const el = await S(() => { const e = document.getElementById('hud'); return e && !e.hidden ? e.textContent : null; });
      if (el && /지나쳤습니다/.test(el)) { said = el; break; }
    }
    ok(!!said, `지나쳤다고 말한다 — 「${said ?? '아무 말 없음'}」`);
    ok((await S(() => SPACE.helm)).missed > 0, '지나친 것이 세어진다');
    // 항로로 돌아오면 닿는다
    await S(() => { SPACE.setOff(0); SPACE.skipLeg(); });
    let leg = 0;
    for (let i = 0; i < 30; i++) { await p.waitForTimeout(300); leg = (await S(() => SPACE.route)).leg; if (leg > 0) break; }
    ok(leg > 0, `돌아오면 닿는다 (구간 ${leg})`);
  }

  console.log('\n[10] 이어하면 **벗어난 채로 이어지나**');
  {
    await S(() => { SPACE.setOff(0.7); SPACE.saveNow(); });
    const before = await S(() => SPACE.helm.off);
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(2200);
    const after = await S(() => SPACE.helm.off);
    ok(Math.abs(after - before) < 0.12,
      `벗어난 만큼이 그대로다 (${before.toFixed(2)} → ${after.toFixed(2)})`);
  }

  ok(errs.length === 0, errs.length ? `콘솔 오류 ${errs.length}: ${errs[0]}` : '콘솔 오류 없음');
  await b.close();
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「모는 맛이 나나」는 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「조종간이 늘 먹나 · 늘 틀어 놓는 게 답이 아닌가」뿐이다.');
process.exit(fail ? 1 : 0);
