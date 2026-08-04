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

// ★ 가르침이 먼저 온다 — 켜자마자 첫 줄이 떠 있어야 한다.
//   그리고 **빗장** 때문에 이걸 안 떼면 고장·위험 지대가 안 온다. 아래
//   검사들이 「왜 아무 일도 안 나지」가 되지 않게 여기서 확인하고 건너뛴다.
console.log('\n[0-0] 가르침 — **하면 사라진다** (TUTORIAL.md §3-A)');
{
  const t0 = await S(() => SPACE.tutor);
  ok(t0.now === 'walk', `켜자마자 첫 줄이 떠 있다 — ${t0.now} 「${t0.text}」`);
  // **화면에 실제로 있나.** 「창이 화면 밖에 그려지고 있었다」는 코드로 못 찾는다
  const box = await S(() => {
    const el = document.getElementById('lesson');
    if (!el || el.hidden) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, text: el.textContent, H: innerHeight };
  });
  ok(!!box && box.w > 40 && box.y > box.H / 2 && box.y + box.h < box.H,
    `화면 아래쪽에 보인다 (${box ? `y=${box.y.toFixed(0)}/${box.H} 「${box.text}」` : '안 보인다'})`);
  // 배너와 **다른 자리**여야 한다. 겹치면 둘 다 안 읽는다
  const hudBox = await S(() => {
    const el = document.getElementById('hud');
    el.hidden = false; el.textContent = '검사';
    const r = el.getBoundingClientRect();
    el.hidden = true;
    return { y: r.y, h: r.height };
  });
  ok(box.y > hudBox.y + hudBox.h, `배너와 자리가 안 겹친다 (배너 y=${hudBox.y.toFixed(0)} · 가르침 y=${box.y.toFixed(0)})`);

  // ★ **최소 표시 시간을 미리 넘겨 둔다.** v22 부터 가르침은 뜬 지
  //   minShow(4초)가 지나야 사라진다. 그런데 헤드리스는 게임 시간이
  //   실시간의 20분의 1이라 4초가 **실제로 80초**다 — 아래 걷기 고리로는
  //   절대 못 넘는다. 위에서 첫 단계 문구·자리를 다 확인한 **뒤에**
  //   나이를 밀어 넣는다. 「사라지나」만 보면 되고, 「4초는 떠 있나」는
  //   tools/space-first5.js 가 브라우저 없이 잰다
  await S(() => SPACE.teach('walk', 20));

  // 걷고 둘러본다 — **읽어서가 아니라 해야** 사라진다.
  // ★ 시간으로 안 기다린다. 헤드리스는 1fps 남짓이고 dt 를 0.05 로 자르므로
  //   걷는 거리가 실시간의 20분의 1로 쌓인다 — 「열 번 밀고 본다」로 짜면
  //   기계에 따라 붙었다 안 붙었다 한다
  await p.keyboard.down('KeyW');
  let walked = false;
  for (let i = 0; i < 140 && !walked; i++) {
    await S(() => window.dispatchEvent(new MouseEvent('mousemove', { movementX: 40 })));
    await p.waitForTimeout(400);
    walked = await S(() => SPACE.tutor.now !== 'walk');
  }
  await p.keyboard.up('KeyW');
  const t1 = await S(() => SPACE.tutor);
  ok(walked, `걷고 둘러보니 사라진다 — 걸은 거리 ${t1.walked}m · 둘러본 각 ${t1.turned}`
    + ` · 뗀 것 ${JSON.stringify(t1.done)}`);
  ok(t1.holds.hazard, '아직 안 배운 것이 있으면 위험 지대가 안 온다 — 빗장');
  if (SP) await p.screenshot({ path: `${SP}/ch-0-가르침.png` });

}

console.log('\n[0-0b] 바닥 안내선 — **가르침 도는 동안만 · 목표 쪽으로**');
{
  // ★ 숫자(길이 배 안인가 · 되짚지 않나)는 tools/space-guide.js 가 잰다.
  //   여기서 볼 것은 **정말 켜지고 꺼지나**다 — 가르침을 다 뗀 뒤에도
  //   남아 있으면 본편이 심부름 게임이 된다 (PLAN §3-1)
  const off0 = await S(() => SPACE.guide);
  ok(!off0.on, `첫 가르침(걸어서 둘러봅니다)에는 선이 없다 — 화살표 ${off0.marks}개`);

  await S(() => SPACE.teach('route', 0));
  await p.waitForTimeout(1200);
  const on = await S(() => SPACE.guide);
  ok(on.on && on.marks > 0, `항로 가르침에 선이 켜진다 — 화살표 ${on.marks}개 → (${on.aim?.x},${on.aim?.z})`);
  ok(await S(() => SPACE.room(SPACE.guide.aim.x, SPACE.guide.aim.z)) === 'observ',
    '관측실을 가리킨다 — 글이 말하는 방과 같다');

  await S(() => SPACE.teach('valve', 0));
  await p.waitForTimeout(1200);
  ok(await S(() => SPACE.room(SPACE.guide.aim.x, SPACE.guide.aim.z)) === 'engine',
    '밸브 가르침으로 넘어가면 기관실을 가리킨다');

  await S(() => SPACE.skipTutor());
  await p.waitForTimeout(1200);
  const off = await S(() => SPACE.guide);
  ok(!off.on && off.marks === 0,
    '★ **일곱을 다 떼면 꺼진다** — 본편에서는 아무도 길을 안 알려준다');
}

{
  // 나머지 검사는 가르침 순서에 안 매이게 통째로 건너뛴다
  await S(() => SPACE.skipTutor());
  const t2 = await S(() => SPACE.tutor);
  ok(t2.allDone && !t2.text, '다 떼면 아무것도 안 뜬다 — 잔소리 안 한다');
  ok(!t2.holds.fault && !t2.holds.hazard, '다 떼면 빗장이 풀린다 — 그때부터 표대로 온다');
}

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
  // ★ **한 번 읽고 판정하지 않는다.** 헤드리스는 1fps 남짓이라 자리를 옮기고
  //   두 프레임 안에 조준이 안 굳을 수 있다 — 실제로 「(winch) 인데 ✘」라는
  //   앞뒤가 안 맞는 실패가 났다. 게임이 아니라 도구가 성급했던 것이다
  ok(await until(() => SPACE.aim === 'winch', 25, '윈치 조준'),
    `조준선이 윈치를 잡는다 (${await S(() => SPACE.aim)})`);
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
  ok(await until(() => SPACE.aim === 'hatch', 25, '접수구 조준'),
    `조준선이 접수구를 잡는다 (${await S(() => SPACE.aim)})`);
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

console.log('\n[0-3b] 점검 패널 — **방 일곱 전부 손이 닿나**');
{
  // ★ **서는 칸을 세는 것만으로는 못 잡는다.** 에어록 패널이 방호복 걸이
  //   바로 앞이라 설 자리는 19칸인데 **어디서도 조준선이 안 잡혔다.**
  //   정비실에서 두 번 옮긴 것과 같은 함정이고, 그때는 화면을 찍어 알았다.
  //   이제는 **조준까지** 재므로 다음에 방을 옮겨도 도구가 먼저 잡는다
  await S(() => SPACE.openDoors());
  const ROOMS = ['spine', 'workshop', 'engine', 'observ', 'garden', 'airlock', 'cockpit'];
  const miss = [];
  for (const room of ROOMS) {
    const spots = await S((room) => {
      const st = SPACE.panelAt(room);
      if (!st) return [];
      const ux = Math.sin(st.ry), uz = Math.cos(st.ry), out = [];
      // **똑바로 앞을 먼저** 본다 — 비껴 선 자리는 조준이 안 잡힌다
      for (const off of [0, 0.3, -0.3, 0.6, -0.6]) for (const d of [0.6, 0.8, 1.0, 1.3, 1.6]) {
        const x = st.x + ux * d - uz * off, z = st.z + uz * d + ux * off;
        if (SPACE.canStand(x, z)) out.push([+x.toFixed(2), +z.toFixed(2), st.ry]);
      }
      return out;
    }, room);
    let hit = null;
    for (const [x, z, ry] of spots.slice(0, 8)) {
      await S((a) => SPACE.put(a[0], a[1], a[2], -0.42), [x, z, ry]);
      await p.waitForTimeout(900);
      if (await S(() => SPACE.aim) === `panel:${room}`) { hit = [x, z]; break; }
    }
    if (!hit) miss.push(room);
  }
  ok(miss.length === 0, `방 일곱 전부 점검 패널에 손이 닿는다 — 못 닿는 방 ${miss.join(', ') || '없다'}`);
  // ★ **되돌린다.** 안 그러면 아래 문 검사가 문을 못 닫는다 (실제로 그랬다)
  await S(() => SPACE.openDoors(false));
}

console.log('\n[0-6b] 문 — **가까이 가면 열리고, 끼면 손으로 연다**');
{
  // ★ 여기서 볼 것은 **손이 닿나 · 길이 막히나**다. 숫자(열리는 속도 ·
  //   회차당 몇 번 끼나)는 tools/space-door.js 가 브라우저 없이 잰다
  const shut = await S(() => { SPACE.put(0, 5.0, Math.PI, -0.02); return true; });
  // ★ 닫히는 데 dwell 1.4 + closeTime 0.9 = 게임 시간 2.3초인데, 헤드리스는
  //   실시간의 20분의 1이라 **실제로는 46초**다. 40초로 뒀다가 아슬아슬하게
  //   못 넘겨 「문이 길을 안 막는다」로 실패했다 — 게임이 아니라 도구가 성급했다
  await until(() => SPACE.doors.find((d) => d.key === 'engine').k === 0, 100, '문 닫히기');
  ok(!(await S(() => SPACE.canStand(0, 10.0))), '멀리 있으면 문이 닫혀 길을 막는다');

  await S(() => SPACE.put(0, 8.6, Math.PI, -0.02));
  const opened = await until(() => SPACE.canStand(0, 10.0), 60, '문 열리기');
  ok(opened, '다가가면 열리고 지나갈 수 있다 — **문 앞에서 안 멈춘다**');

  // 끼우면 다시 막힌다
  await S(() => SPACE.jamDoor('engine'));
  await p.waitForTimeout(1500);
  ok(!(await S(() => SPACE.canStand(0, 10.0))), '끼면 다시 막힌다');

  // ★ **크랭크가 설 수 있는 자리에서 손에 닿나.** 「되는데 안 보이는」 것을
  //   한 번 겪었다 — 크랭크를 통로 벽 바깥에 두는 바람에 조준은 되는데
  //   화면에는 없었다. 서 있을 수 있는 자리에서 잡히는지까지 본다
  let hit = null;
  for (const [x, z] of [[0.6, 8.6], [0, 8.4], [0.9, 8.9]]) {
    if (!(await S((a) => SPACE.canStand(a[0], a[1]), [x, z]))) continue;
    for (let yaw = -3.14; yaw <= -1.6 && !hit; yaw += 0.12) {
      await S((a) => SPACE.put(a[0], a[1], a[2], -0.35), [x, z, yaw]);
      await p.waitForTimeout(90);
      if (String(await S(() => SPACE.aim) || '').startsWith('crank')) hit = { x, z, yaw };
    }
    if (hit) break;
  }
  ok(!!hit, `설 수 있는 자리에서 크랭크가 잡힌다 (${hit ? `${hit.x},${hit.z}` : '안 잡힌다'})`);
  if (hit) {
    await S(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
    const turning = await until(() => SPACE.doors.find((d) => d.key === 'engine').held > 0.05, 40, '크랭크 돌기');
    const h = (await S(() => SPACE.doors)).find((d) => d.key === 'engine');
    ok(turning, `잡으니 크랭크가 돌아간다 (${h.held})`);
    await S(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
    if (SP) await p.screenshot({ path: `${SP}/ch-0-크랭크.png` });
  }
  // 끼인 문은 **소리로 찾힌다** — 고장과 같은 규약이라야 한다
  await S(() => SPACE.put(0, -5.0, 0, 0));
  await p.waitForTimeout(2000);
  const far = await S(() => SPACE.faults.hear);
  await S(() => SPACE.put(0, 8.6, Math.PI, 0));
  await p.waitForTimeout(2000);
  const near = await S(() => SPACE.faults.hear);
  ok(near > far * 2.5, `끼인 문이 소리로 찾힌다 — 조종석 ${far} → 문 앞 ${near}`);
  // 치우고 간다
  await S(() => { SPACE.jamDoor('engine'); });
  await S(() => { const d = SPACE.doors; });
}

console.log('\n[0-6d] 문간 — **가로지르는 것이 없나**');
{
  // ★ 사장님이 「문들이 쇠파이프로 막혀있는데?」라고 하셨다. 통로 난간을
  //   끝에서 끝까지 한 줄로 그어 놓아서 **곁방 문 넷을 그대로 관통**했다 —
  //   난간 높이 1.32 는 문 구멍(2.05)의 한복판이다.
  //   **숫자로는 아무 데도 안 걸린다.** 난간은 충돌이 아니라 걸어는 다니고,
  //   문은 잘 열리고, space-door.js 는 전부 ✔ 였다. **눈에만 보이는 종류**다.
  //   그래서 문틀 사이를 벽 따라 가로질러 광선을 쏜다 — 걸리면 범인이다.
  await S(() => SPACE.openDoors());
  const bad = [];
  for (const d of await S(() => SPACE.doors.map((x) => x.key))) {
    const hits = await S((k) => SPACE.clearDoorway(k), d);
    if (hits.length) bad.push(`${d} ← ${hits.join('·')}`);
  }
  ok(bad.length === 0, `문 여섯 전부 문간이 비어 있다 — 막힌 문 ${bad.join(' / ') || '없다'}`);
  await S(() => SPACE.openDoors(false));
}

console.log('\n[0-6c] 손목 — **화면에 있나 · Q 로 올라오나 · 상태를 따라가나**');
{
  // ★ 숫자(줄 순서 · 안 새나)는 tools/space-wrist.js 가 브라우저 없이 잰다.
  //   여기서 볼 것은 **정말 화면에 매달려 있나**다 — 카메라를 scene 에
  //   안 넣으면 three 가 카메라의 자식을 그리지 않아서, 코드는 다 도는데
  //   화면에는 아무것도 없다. 그건 순수 검사로는 절대 안 잡힌다
  ok(await S(() => SPACE.wrist.onScreen), '손목 장치가 실제로 그려지는 나무에 달려 있다');

  const down = await S(() => SPACE.wrist.lift);
  await p.keyboard.down('KeyQ');
  const up = await until(() => SPACE.wrist.lift > 0.9, 40, '손목 올라오기');
  ok(down < 0.1 && up, `Q 를 잡으면 눈앞으로 온다 — ${down} → ${await S(() => SPACE.wrist.lift)}`);
  await p.keyboard.up('KeyQ');
  ok(await until(() => SPACE.wrist.lift < 0.1, 40, '손목 내려가기'), '놓으면 곁눈 자리로 돌아간다');

  // 상태를 따라가나 — 문을 끼우면 **그 줄로 바뀌어야** 한다
  await S(() => SPACE.jamDoor('engine'));
  await p.waitForTimeout(1200);
  const jam = await S(() => SPACE.wrist);
  ok(jam.key === 'jam' && jam.urgent, `문이 끼면 손목이 바뀐다 — 「${jam.text}」`);
  await S(() => { SPACE.openDoors(); SPACE.openDoors(false); });
  await p.waitForTimeout(1200);
  ok(await S(() => SPACE.wrist.key) !== 'jam', '풀면 그 줄이 사라진다 — **안 하면 안 사라지는 잔소리가 아니다**');
}

console.log('\n[0-7] 거점은 안전한가 · 잡히면 나올 수 있나');
{
  // ★ 둘 다 v21 에서 **게임을 못 하게 만든 것들**이다. 숫자는
  //   tools/space-first5.js 가 재고, 여기서는 **실제 게임에서 그렇나**를 본다
  await S(() => { SPACE.skipLeg(); });
  await until(() => SPACE.route.phase === 'port', 25, '거점 도착');
  await S(() => { SPACE.setPower('thrust', true); SPACE.setHeat(100); });
  const r0 = await S(() => SPACE.chase.risk);
  await S((v) => { window.__r0 = v; }, r0);
  await p.waitForTimeout(6000);
  const r1 = await S(() => SPACE.chase.risk);
  ok(r1 <= r0, `거점에서는 열이 100 이어도 위험이 안 오른다 (${r0} → ${r1})`);

  // 잡아 놓고 나오는지 본다
  await S(() => SPACE.pick(SPACE.route.offer[0]));
  await S(() => { SPACE.forceContact(); });
  await until(() => SPACE.chase.phase === 'chase', 30, '접촉');
  // ★ **추진을 끄고** 밀어야 잡힌다. v22 부터 정박 상태로 시작해서 열이
  //   낮으므로, 추진이 켜져 있으면 벌어지는 속도(2.95)가 붙는 속도를 이겨
  //   거리를 0.05 로 밀어 놔도 **도로 벌어진다.** 「거리를 0 으로 만들면
  //   잡힌다」가 아니라 「지고 있어야 잡힌다」가 맞고, 그게 게임의 규칙이다
  await S(() => SPACE.setPower('thrust', false));
  // ★ 한 번 밀어 놓고 기다리면 **유예(graceAfterContact 2.5초)** 동안
  //   안 좁혀지는데, 헤드리스에서 그 2.5초는 실제로 50초다. 그 사이에
  //   관성(drift)으로 도로 벌어져서 「안 잡힌다」로 보인다 — 게임이 아니라
  //   도구가 성급한 것이다. **잡힐 때까지 계속 민다**
  let caught = false;
  for (let i = 0; i < 90 && !caught; i++) {
    await S(() => SPACE.setDist(0.05));
    await p.waitForTimeout(700);
    caught = await S(() => SPACE.chase.phase === 'caught');
  }
  ok(caught, `잡힌다 (${await S(() => SPACE.chase.phase)})`);
  const out = await until(() => SPACE.chase.phase !== 'caught', 180, '놓여나기');
  ok(out, `**잡혀도 놓아준다** — ${await S(() => SPACE.chase.phase)} (v21 은 여기서 영영 멈췄다)`);
  await S(() => { SPACE.resetChase(); SPACE.setHeat(30); });
}

console.log('\n[1] 차단기 — 통로에서 손으로 누른다');
await S(() => SPACE.put(0, 3.3, Math.PI / 2, 0.02));
await p.waitForTimeout(2500);
ok(await until(() => SPACE.aim !== null, 25, '차단기 조준'), '조준선이 차단기를 잡는다');
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
  // ★ **추진을 끄고** 밀어야 잡힌다. v22 부터 정박 상태로 시작해서 열이
  //   낮으므로, 추진이 켜져 있으면 벌어지는 속도(2.95)가 붙는 속도를 이겨
  //   거리를 0.05 로 밀어 놔도 **도로 벌어진다.** 「거리를 0 으로 만들면
  //   잡힌다」가 아니라 「지고 있어야 잡힌다」가 맞고, 그게 게임의 규칙이다
  await S(() => SPACE.setPower('thrust', false));
await S(() => SPACE.setDist(0.05));
await until(() => SPACE.chase.phase === 'caught', 60, '잡힘');
const c3 = await S(() => SPACE.chase);
ok(c3.phase === 'caught', `거리가 0 이면 잡힌다  ${JSON.stringify(c3)}`);

console.log(errs.length ? `\n오류: ${errs.join(' / ')}` : '\n오류 없음');
console.log(fail ? `\n✘ ${fail}개 실패` : '\n✔ 전부 통과');
await b.close();
process.exit(fail ? 1 : 0);
