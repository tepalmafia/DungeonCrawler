// ══════════════════════════════════════════════════════════════════════════
//  추격 한 판이 손으로 도나 — **실제 브라우저에서** 확인한다.
//
//    python3 tools/serve.py 8391 &
//    node tools/space-chase.js
//
//  `tools/space-sim.js` 는 **숫자가 맞나**를 본다 (추격이 90~180초인가).
//  이건 **손이 닿나**를 본다 — 차단기가 눌리나, 밸브가 걸리나, 접촉·뿌리침·
//  잡힘이 실제로 나나. 둘 다 있어야 한다: 숫자가 맞아도 못 누르면 소용없고,
//  누를 수 있어도 숫자가 틀리면 재미가 없다.
//
//  ★ 시간으로 기다리지 않는다
//    헤드리스는 소프트웨어 렌더라 몇 fps 인지 그때그때 다르고, dt 를 0.05 로
//    자르므로 **프레임이 느리면 게임 시간이 안 흐른다.** 「3초 기다린다」로
//    짜면 기계에 따라 붙었다 안 붙었다 한다. **조건이 될 때까지** 기다린다.
//
//  ★ Playwright 의 마우스를 안 쓴다
//    포인터 잠금 상태에서 p.mouse.down() 은 좌표를 같이 보내는데, 그게
//    movementX 로 들어와 **시야가 홱 돌아간다.** 조준하던 것을 놓쳐서
//    「밸브가 안 돌아간다」로 보였다 — 게임이 아니라 도구 문제였다.
//    (다만 그 김에 한 번에 오는 이동량을 자르는 안전장치를 넣었다)
// ══════════════════════════════════════════════════════════════════════════
const PW = ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs'];
let chromium = null;
for (const m of PW) { try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ } }
if (!chromium) {
  console.error('playwright 가 없습니다.  npm i -g playwright  뒤에 다시 돌리세요.');
  process.exit(2);
}
const PORT = process.argv[2] || '8391';
const SP = process.env.SHOTS || null;
const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
// ★ 창을 작게 잡는다. 헤드리스는 소프트웨어 렌더라 화소가 곧 시간이고,
//   dt 를 0.05 로 자르므로 **프레임이 느리면 게임 시간이 안 흐른다.**
const p = await b.newPage({ viewport: { width: 640, height: 380 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const S = (fn, a) => p.evaluate(fn, a);
// ★ 시간으로 기다리지 않고 **조건이 될 때까지** 기다린다.
//   헤드리스 프레임이 몇 fps 인지에 검사가 매달리면 안 된다.
const until = async (fn, sec = 90, note = '') => {
  const t0 = Date.now();
  while (Date.now() - t0 < sec * 1000) {
    if (await p.evaluate(fn)) return true;
    await p.waitForTimeout(700);
  }
  console.log(`     (${note} 기다리다 지침)`);
  return false;
};
await p.mouse.move(320, 190);
await p.mouse.click(320, 190);
await S(() => document.getElementById('hint')?.remove());

// ★ 항로가 생기면서 **거점에서 시작한다.** 갈래를 안 고르면 배가 안 가고,
//   안 가면 아래 검사들이 「왜 아무 일도 안 나지」가 된다.
//   그래서 해도대부터 본다 — 실제 플레이의 순서이기도 하다.
console.log('\n[0] 해도대 — 관측실까지 걸어가 항로를 고른다');
ok((await S(() => SPACE.route)).phase === 'port', '거점에서 시작한다');
await S(() => SPACE.put(-2.4, 0.42, Math.PI / 2, -0.30));   // 관측실, 해도대를 내려다본다
await p.waitForTimeout(2500);
const aimed = await until(() => String(SPACE.aim || '').startsWith('chart'), 20, '해도대 조준');
ok(aimed, `조준선이 갈래 판을 잡는다 (${await S(() => SPACE.aim)})`);
const before = await S(() => SPACE.route);
await S(() => { window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })); window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })); });
await p.waitForTimeout(1500);
const after = await S(() => SPACE.route);
ok(after.phase === 'leg' && after.fork, `누르니 배가 출발한다 — ${after.fork}`);
ok(before.offer.includes(after.fork), `고른 것이 판에 있던 갈래다 (${before.offer.join(' / ')})`);
if (SP) await p.screenshot({ path: `${SP}/ch-0-해도대.png` });

console.log('\n[0-2] 구간이 끝나면 거점이 온다');
await S(() => SPACE.skipLeg());
await until(() => SPACE.route.phase === 'port', 20, '거점 도착');
const at = await S(() => SPACE.route);
ok(at.phase === 'port' && at.leg === 1, `구간 하나를 지났다 — 남은 거점 ${at.left}`);
ok(at.press < 100 && at.press >= 0, `압박이 남아 있다 (${at.press})`);
ok(at.offer.length === 2 && at.offer[0] !== at.offer[1], `새 갈래 둘이 떴다 (${at.offer.join(' / ')})`);
// 다시 골라 둔다 — 아래 검사들은 배가 가는 중이어야 뜻이 있다
await S(() => SPACE.pick(SPACE.route.offer[1]));

console.log('\n[1] 차단기 — 통로에서 손으로 누른다');
await S(() => SPACE.put(0, 3.3, Math.PI / 2, 0.02));
await p.waitForTimeout(2500);
ok(await S(() => SPACE.aim) !== null, '조준선이 차단기를 잡는다');
const b1 = await S(() => SPACE.power);
await S(() => { window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })); window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })); });
await p.waitForTimeout(2000);
const b2 = await S(() => SPACE.power);
ok(JSON.stringify(b1) !== JSON.stringify(b2), `누르니 회로가 바뀐다  ${JSON.stringify(b1)} → ${JSON.stringify(b2)}`);
if (SP) await p.screenshot({ path: `${SP}/ch-1-차단기.png` });

console.log('\n[2] 셋 중 둘만');
ok(await S(() => { SPACE.setPower('thrust', true); SPACE.setPower('cool', true); return SPACE.setPower('sensor', true); }) === false,
  '둘이 켜져 있으면 셋째는 안 켜진다');

console.log('\n[3] 밸브 — 끝까지 돌리면 걸린다');
await S(() => SPACE.put(0, 14.5, Math.PI, -0.2));
await p.waitForTimeout(1000);
await until(() => SPACE.aim === 'valve', 20, '밸브 조준');
// ★ p.mouse.down() 을 안 쓴다. 포인터 잠금 상태에서 Playwright 가 좌표를
//   같이 보내는 바람에 **시야가 홱 돌아가** 조준을 놓쳤다. 사람 손은 그렇게
//   안 움직인다 — 순수한 mousedown 만 보낸다.
await S(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
await until(() => SPACE.coolFor > 0, 150, '밸브 다 돌기');
await S(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
const v = await S(() => ({ turn: SPACE.turn, coolFor: SPACE.coolFor }));
ok(v.coolFor > 0, `끝까지 돌리니 냉각이 ${v.coolFor}초 걸린다`);
if (SP) await p.screenshot({ path: `${SP}/ch-2-밸브.png` });

console.log('\n[4] 추격 — 붙는다');
await S(() => { SPACE.put(0, -5.4, 0, -0.06); SPACE.forceContact(); });
await p.waitForTimeout(1500);
const c1 = await S(() => SPACE.chase);
ok(c1.phase === 'chase', `접촉하면 추격으로 넘어간다  ${JSON.stringify(c1)}`);
if (SP) await p.screenshot({ path: `${SP}/ch-3-추격.png` });

console.log('\n[5] 뿌리침 · 잡힘 — 끝이 둘 다 난다');
await S(() => SPACE.setDist(99.9));
await until(() => SPACE.chase.phase !== 'chase', 30, '뿌리침');
const c2 = await S(() => SPACE.chase);
ok(c2.phase === 'shaken' && c2.runs === 1, `거리가 100 이면 뿌리친다  ${JSON.stringify(c2)}`);
if (SP) await p.screenshot({ path: `${SP}/ch-4-뿌리침.png` });

await S(() => { SPACE.resetChase(); SPACE.forceContact(); });
// ★ 접촉 직후엔 **유예**가 있어서 안 좁혀진다 (chase-table graceAfterContact).
//   그게 지나기를 기다린 뒤에 밀어야 「잡힘」이 난다 — 유예도 검사한 셈이다
await until(() => SPACE.chase.phase === 'chase', 30, '재접촉');
await until(() => SPACE.chase.dist < 44, 60, '유예 끝나기');   // 유예도 이걸로 검사된다
await S(() => SPACE.setDist(0.05));
await until(() => SPACE.chase.phase === 'caught', 60, '잡힘');
const c3 = await S(() => SPACE.chase);
ok(c3.phase === 'caught', `거리가 0 이면 잡힌다  ${JSON.stringify(c3)}`);

console.log(errs.length ? `\n오류: ${errs.join(' / ')}` : '\n오류 없음');
console.log(fail ? `\n✘ ${fail}개 실패` : '\n✔ 전부 통과');
await b.close();
process.exit(fail ? 1 : 0);
