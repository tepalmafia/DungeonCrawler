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

console.log('\n[0-3] 고장 — **소리로 찾고 손으로 고친다**');
await S(() => SPACE.forceFault());
const fl = (await S(() => SPACE.faults)).open[0];
ok(!!fl, `고장이 떴다 — ${fl?.name} (${fl?.lead})`);
ok(fl?.key === 'phantomHeat', '첫 고장은 「원인 모를 열」이다 (first: true)');

// 다른 방에서는 희미하게만 들린다 — 「이 근처다」까지만 준다
const other = fl.at === 'spine' ? 'observ' : 'spine';
await S((r) => SPACE.put(...({ spine: [0, 7], observ: [-2.4, 0.6] }[r])), other);
await p.waitForTimeout(1200);
const far = (await S(() => SPACE.faults)).hear;

// 그 방으로 가면 커진다
const site = await S((r) => SPACE.panelAt(r), fl.at);
// 패널 앞에 설 수 있는 자리를 찾는다 — 랙·작업대에 겹치면 못 선다.
// 패널이 바라보는 쪽은 ry 하나로 나온다: 바깥 방향 = (sin ry, cos ry)
const spot = await S((s) => {
  const ux = Math.sin(s.ry), uz = Math.cos(s.ry);
  for (const d of [0.5, 0.7, 0.9, 1.1, 1.4]) {
    for (const off of [0, 0.4, -0.4, 0.8, -0.8]) {
      const x = s.x + ux * d - uz * off, z = s.z + uz * d + ux * off;
      if (SPACE.canStand(x, z)) return { x, z, d };
    }
  }
  return null;
}, site);
ok(!!spot, `패널 앞에 설 자리가 있다 (${fl.at})`);
if (!spot) { console.log('\n✘ 패널 앞이 막혀 있다 — 자리를 옮겨야 한다\n'); await b.close(); process.exit(1); }
// 패널 쪽을 본다. 사람의 앞은 (-sin yaw, -cos yaw) 이므로 yaw 는 그냥 ry 다
await S((a) => SPACE.put(a.spot.x, a.spot.z, a.site.ry, -0.42), { spot, site });
await p.waitForTimeout(2200);
const near = (await S(() => SPACE.faults)).hear;
console.log(`   덜그럭거림  다른 방 ${far} → 그 방 ${near}`);
ok(near > far * 2.5, '고장 난 방에 들어가면 소리가 확 커진다 — 이게 진단이다');

const aimOk = await until(() => String(SPACE.aim || '').startsWith('panel:'), 25, '패널 조준');
ok(aimOk, `조준선이 점검 패널을 잡는다 (${await S(() => SPACE.aim)})`);
// 잡고 있으면 고쳐진다. **누르는 게 아니라 잡는 것**이다
await S(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
// ★ 잡고 있는 것이 **먹고 있는지** 먼저 본다. 헤드리스는 몇 fps 인지 그때그때
//   다르고 dt 를 0.05 로 자르므로, 게임 시간 7초가 실제로는 1분이 넘는다 —
//   「안 고쳐진다」와 「느리다」를 갈라 놓지 않으면 엉뚱한 데를 고치게 된다
// ★ 여기서 「끝까지 고쳐지나」는 안 본다
//   헤드리스는 dt 를 0.05 로 자른 채 1fps 남짓이라, 게임 시간 7초가 실제로는
//   5분이 넘는다. **끝까지 도는지는 tools/space-fault.js 가 브라우저 없이
//   이미 잰다.** 여기서 볼 것은 「손이 닿고, 잡으면 먹고, 놓으면 되돌아가나」다.
const moving = await until(() => SPACE.faults.open[0]?.progress > 0.05, 40, '수리 진행');
const p1 = (await S(() => SPACE.faults)).open[0]?.progress;
ok(moving, `잡으니 수리가 진행된다 (${p1})`);
await S(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
await S((v) => { window.__p1 = v; }, p1);
await until(() => SPACE.faults.open[0]?.progress < window.__p1, 25, '되돌아가기');
const p2 = (await S(() => SPACE.faults)).open[0]?.progress;
ok(p2 < p1, `놓으면 되돌아간다 (${p1} → ${p2}) — 딱 멈추면 손을 뗄 이유가 없다`);
ok((await S(() => SPACE.faults)).open.length === 1, '안 고쳤으니 목록에 남아 있다');
if (SP) await p.screenshot({ path: `${SP}/ch-0-고장.png` });

// 진단대 — **읽을 자리가 있나.** 계기는 못 읽으면 없는 것과 같다
{
  const bs = await S(() => SPACE.benchAt);
  const read = await S((b) => {
    const ux = Math.sin(b.ry), uz = Math.cos(b.ry);
    for (const d of [1.2, 1.4, 1.6, 1.8]) {
      const x = b.x + ux * d, z = b.z + uz * d;
      if (SPACE.canStand(x, z)) return { x, z, d };
    }
    return null;
  }, bs);
  ok(!!read, `진단대를 읽을 자리가 있다 (${read ? read.d + 'm 앞' : '없다'})`);
  // 그리고 조종석·관측실과 **다른 것**을 들고 있어야 한다 (GAP.md §3-C)
  const w = (await S(() => SPACE.faults)).wear;
  ok(w && Object.keys(w).length === 3, `진단대만 아는 것 — 계통별 마모 ${JSON.stringify(w)}`);
}

console.log('\n[0-4] 보급 — **멈춰서 캔다.** 「한 통만 더」 (PLAN §5-3)');
{
  // 에어록 윈치 앞에 선다. 추진이 켜져 있으면 안 걸려야 한다
  await S(() => { SPACE.setPower('thrust', true); SPACE.put(3.4, 5.15, 0, -0.34); });
  await p.waitForTimeout(2200);
  ok(await S(() => SPACE.aim) === 'winch', `조준선이 윈치를 잡는다 (${await S(() => SPACE.aim)})`);
  await S(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
  await p.waitForTimeout(2500);
  const moving = await S(() => SPACE.supply);
  await S(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
  ok(!moving.winching && moving.ore < 1, '추진이 켜져 있으면 안 걸린다 — 멈춰야 캔다');

  // 추진을 끄고 다시
  await S(() => SPACE.setPower('thrust', false));
  await S(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
  // 광석은 초당 1 씩 오르는데 헤드리스 게임 시간은 실시간의 20분의 1 쯤이다.
  // 문턱을 낮추고 넉넉히 기다린다 — 「되나 안 되나」만 보면 된다
  const pulling = await until(() => SPACE.supply.ore > 0.3, 45, '윈치가 걸리기');
  // ★ 위험은 초당 0.52 씩만 오른다. 헤드리스는 1fps 남짓이라 2~3초 기다려서는
  //   소수점 첫째 자리도 안 움직인다 — **조건이 될 때까지** 기다린다
  const before = await S(() => SPACE.chase.risk);
  await S((v) => { window.__r0 = v; }, before);
  const rising = await until(() => SPACE.chase.risk > window.__r0, 45, '위험이 오르기');
  const after = await S(() => ({ ore: SPACE.supply.ore, risk: SPACE.chase.risk }));
  await S(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
  ok(pulling, `멈추면 끌어온다 (광석 ${after.ore})`);
  ok(rising, `캐는 동안 위험이 쌓인다 (${before} → ${after.risk}) — 자국이 낮아도 안 빠진다`);
}

console.log('\n[0-5] 접수구 — 거점에서만 바꾼다');
{
  await S(() => { SPACE.setSupply({ ore: 90, food: 30, parts: 0 }); SPACE.put(3.4, 6.35, Math.PI, -0.25); });
  await p.waitForTimeout(2200);
  ok(await S(() => SPACE.aim) === 'hatch', `조준선이 접수구를 잡는다 (${await S(() => SPACE.aim)})`);
  // 항행 중에는 안 된다
  await S(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
  await p.waitForTimeout(2500);
  await S(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
  ok((await S(() => SPACE.supply)).traded === 0, '항행 중에는 안 열린다 — 거점에서만이다');
  // 거점에 세우고 다시
  await S(() => SPACE.skipLeg());
  await until(() => SPACE.route.phase === 'port', 25, '거점 도착');
  // ★ 여기서도 **끝까지 도는 것은 안 본다.** 헤드리스는 1fps 라 게임 시간
  //   4초가 실제로 1분이 넘는다. 바뀌는 것 자체는 tools/space-supply.js 가
  //   브라우저 없이 잰다. 여기서 볼 것은 「거점에서만 손이 먹나」다
  await S(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
  const turning = await until(() => SPACE.supply.trading > 0.2, 40, '컨베이어가 돌기');
  const sup = await S(() => SPACE.supply);
  await S(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
  ok(turning, `거점에서는 손이 먹는다 (${sup.trading}/${sup.hold}초)`);
  // 다시 항로를 고르고 아래 검사로 넘긴다
  await S(() => SPACE.pick(SPACE.route.offer[1]));
}

console.log('\n[0-6] 조종간 — **잡고 좌우로 민다** (FLYING.md §3-B)');
{
  // ★ 여기서 볼 것은 「손이 닿나」다. **피할 수 있나·15% 안에 드나는**
  //   tools/space-fly.js 가 브라우저 없이 이미 잰다. 헤드리스는 게임 시간이
  //   실시간의 20분의 1이라 예고 30초짜리를 여기서 끝까지 볼 수 없다.
  await S(() => SPACE.put(0, -6.2, 0, -0.22));   // 좌석 앞, 조종간을 내려다본다
  await p.waitForTimeout(2200);
  const gotYoke = await until(() => SPACE.aim === 'yoke', 20, '조종간 조준');
  ok(gotYoke, `조준선이 조종간을 잡는다 (${await S(() => SPACE.aim)})`);

  // 잡는다 — 밸브·윈치와 같은 규약이다
  await S(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
  await until(() => SPACE.fly.steering, 20, '조종간 잡기');
  ok(await S(() => SPACE.fly.steering), '잡으면 조종간이 손에 걸린다');

  // ★ 잡은 채로 마우스를 옆으로 — **시야가 아니라 배가 움직인다.**
  //   그래서 yaw 가 그대로인지도 같이 본다. 여기가 갈리면 조준을 놓친다
  const yaw0 = await S(() => SPACE.look.yaw);
  for (let i = 0; i < 14; i++) {
    await S(() => window.dispatchEvent(new MouseEvent('mousemove', { movementX: 40 })));
    await p.waitForTimeout(160);
  }
  const f1 = await S(() => SPACE.fly);
  const yaw1 = await S(() => SPACE.look.yaw);
  ok(f1.lane > 0.1, `밀면 배가 기운다 (lane ${f1.lane})`);
  ok(Math.abs(yaw1 - yaw0) < 0.01, `미는 동안 시야는 안 돈다 (yaw ${yaw0.toFixed(3)} → ${yaw1.toFixed(3)})`);

  // 놓으면 가운데로 돌아온다 — **잡고 있어야 한다**는 뜻이다
  await S(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
  await S((v) => { window.__lane0 = v; }, f1.lane);
  const back = await until(() => SPACE.fly.lane < window.__lane0 - 0.01, 30, '가운데로 돌아오기');
  const f2 = await S(() => SPACE.fly);
  ok(!f2.steering, '놓으면 손이 떨어진다');
  ok(back, `놓으면 가운데로 돌아온다 (${f1.lane} → ${f2.lane})`);
  if (SP) await p.screenshot({ path: `${SP}/ch-5-조종간.png` });

  // 예고는 **어느 방에 있든** 온다 — 기관실에서 모르고 있다가 맞으면
  // 「정비하러 가는 것 자체가 벌」이 된다 (FLYING.md §1-2)
  await S(() => { SPACE.put(0, 14.5, Math.PI, -0.2); SPACE.forceHazard(); });
  await p.waitForTimeout(1200);
  const w = await S(() => SPACE.fly);
  ok(w.phase === 'warn' && w.warn > 5, `기관실에 있어도 예고가 뜬다 (${w.warn.toFixed(0)}초 남음)`);
}

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
