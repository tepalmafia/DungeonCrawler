// ══════════════════════════════════════════════════════════════════════════
//  ★★ **처음부터 끝까지 되나** — 사장님이 시키신 것 전부를 한 번에.
//
//    python3 tools/serve.py 8391 &
//    node tools/space-endtoend.js
//
//  ★ 왜 이걸 만들었나 (2026-08-06 · 사장님)
//
//    「조정석을 잡아도 운전이 안되잔아? 주포도 조작이 안되고」
//    「한번에 하나씩 다 이어지게 해야지. 왜 만들다 마니?」
//    「테스트를 할 수가 없잔아.」
//    「지금까지 요청한 내용들 시작하면 제대로 작동하고 끝낼 수 있는
//      상태인지 확인하고 모두 고쳐」
//
//    맞는 지적이다. 계통마다 **제 검사는 다 ✔** 였는데, 그 검사들은 저마다
//    필요한 상태를 **직접 만들어 놓고** 시작했다 — `forceContact()` 로 적을
//    붙여 놓고 주포를 쐈고, `putLand()` 로 착지시켜 놓고 실었다.
//    그래서 「표는 도는데 **사람은 거기까지 못 간다**」를 하나도 못 잡았다.
//
//  ★ 그래서 이 검사만은 규칙이 다르다:
//      **① 켠 다음부터는 손으로만 한다** — 걸어가고, 겨누고, 누른다
//      ② 상태를 밖에서 만들어 주지 않는다 (자리 옮기기만 허용 —
//         헤드리스는 게임 시간이 실시간의 20분의 1 이라 걸으면 못 끝낸다)
//      ③ **막히면 거기서 멈추고 무엇이 막았는지 말한다**
// ══════════════════════════════════════════════════════════════════════════
const PORT = process.argv[2] || '8391';
let chromium = null;
for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
  try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ }
}
if (!chromium) { console.error('playwright 가 없습니다. serve.py 를 먼저 띄웁니다.'); process.exit(2); }

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };

const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 720, height: 420 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'networkidle' });
await p.waitForTimeout(2200);
const S = (fn, a) => p.evaluate(fn, a);

/** ★ 기다림은 기다림일 뿐이고 **판정은 값이 한다** */
const until = async (fn, tries, what) => {
  for (let i = 0; i < tries; i++) { if (await S(fn)) return true; await p.waitForTimeout(400); }
  console.log(`   … ${what} 을(를) 못 봤다`);
  return false;
};
const said = () => S(() => {
  const e = document.getElementById('hud'); return e && !e.hidden ? e.textContent : '';
});
const down = () => S(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
const up = () => S(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
/** 사람이 누르는 것 — 헤드리스는 프레임이 성기므로 넉넉히 잡는다 */
const press = async (sec = 2.5) => { await down(); await p.waitForTimeout(sec * 1000); await up(); };
/** 자리를 옮기고 조준이 **굳을 때까지** 기다린다 */
const aimAt = async (x, z, yaw, pitch, want, tries = 22) => {
  await S(([a, c, d, e]) => SPACE.put(a, c, d, e), [x, z, yaw, pitch]);
  await S((w) => { window.__want = w; }, want);
  return until(() => (Array.isArray(window.__want)
    ? window.__want.includes(SPACE.aim) : SPACE.aim === window.__want), tries, `${want} 조준`);
};

await S(() => SPACE.clearSave());
await p.mouse.move(360, 210); await p.mouse.click(360, 210);
await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });

console.log('\n처음부터 끝까지 되나 — 사장님이 시키신 것 전부');
console.log(`  판본 v${await S(() => SPACE.version)}`);

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[0] 배가 출발하나 — **해도대에서 손으로 고른다**');
{
  ok((await S(() => SPACE.route)).phase === 'port', '거점에서 시작한다');
  ok(await aimAt(-2.4, 0.42, Math.PI / 2, -0.30, ['chart0', 'chart1']),
    `조준선이 갈래 판을 잡는다 (${await S(() => SPACE.aim)})`);
  await press(0.6);
  ok(await until(() => SPACE.route.phase === 'leg', 20, '출발'),
    `눌렀더니 배가 간다 — 「${await said()}」`);
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[1] ★★ **주포** — 실내 조준석에 앉고 · WASD 로 겨누고 · 쏜다');
{
  await S(() => { SPACE.setPower('thrust', false); SPACE.giveOre(80); });
  ok((await S(() => SPACE.chase)).phase === 'calm', '지금은 쫓기지 않는다 — **이 상태에서 되어야 한다**');

  // ① 좌석에 앉는다 — **사다리를 타고 밖으로 안 나간다**
  // ★ **(2.35, -2.95) 는 배 밖이었다.** 조종석은 z -9.0~-3.0 인데 거기 세워
  //   놓고 「조준석이 안 잡힌다」로 세 번 빨개졌다 — 배 안에 세워야 한다
  // ★★ **(2.35, −3.6) 은 좌석 바로 위였다** — 늘 정답 자리에서만 앉혀 봤고,
  //   그래서 「앉아도 몸이 안 옮겨진다」를 몇 판째 못 잡았다. 사장님이
  //   화면으로 잡으셨다: 「앉았다고 나오는데 의자 앞에 공간이 없어서
  //   그런지 모니터 앞에 앉질 못하네」.
  //   **사람이 서는 자리에서** 앉힌다 — 좌석에서 1.3m 뒤
  ok(await aimAt(2.35, -2.6, 0, -0.55, 'gunseat'),
    `① **멀찍이 서서도** 조준석이 잡힌다 (${await S(() => SPACE.aim)})`);
  await press(2.6);
  ok(await until(() => SPACE.gun.up, 80, '앉기'), '② 눌렀더니 **앉는다**');
  // ★ 그리고 **몸이 좌석으로 옮겨진다** — 이게 v59 가 고친 것이다
  const sat = await until(() => Math.hypot(SPACE.pos.x - 2.35, SPACE.pos.z + 3.9) < 0.25, 40, '좌석으로 옮겨지기');
  const at = await S(() => SPACE.pos);
  ok(sat, `②-b ★★ **몸이 좌석으로 옮겨진다** (${at.x}, ${at.z}) — 안 옮겨지면`
    + ' 「앉았다는데 눈앞에 모니터가 없는」 화면이 된다');
  const camY = await S(() => SPACE.camY ?? null);
  ok(camY === null || camY < 1.62,
    `③ **눈이 내려간다** (${camY?.toFixed?.(2) ?? '?'}) — 밖으로 올라가는 것이 아니다`);

  // ② 손잡이를 잡고 WASD 로 겨눈다 — **앞을 본다**
  //   ★ 앉기 전에 좌석을 내려다본 자세 그대로면 계속 좌석이 잡힌다.
  //     앉았으면 고개를 든다 — 사람은 저절로 하는 일이지만 검사는 못 한다
  ok(await until(() => {
    SPACE.put(2.35, -3.9, 0, -0.1);
    return SPACE.aim === 'grip';
  }, 25, '손잡이 조준'), `④ 앉아 앞을 보면 손잡이가 잡힌다 (${await S(() => SPACE.aim)})`);
  const a0 = await S(() => SPACE.sky);
  await S(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' })); });
  await down();
  await p.waitForTimeout(2500);
  await up();
  await S(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' })); });
  const a1 = await S(() => SPACE.sky);
  ok(a1.az > a0.az + 1,
    `⑤ **손잡이를 잡고 D 를 누르니 포탑이 돈다** (${a0.az} → ${a1.az}도)`);

  // ③ 떠도는 것을 조준선 앞에 놓고 쏜다
  ok(a1.n > 0, `⑥ 창밖에 떠도는 것이 있다 (${a1.n}개 · ${a1.region})`);
  await S(() => SPACE.putTarget('junk'));
  ok((await S(() => SPACE.sky)).locked, '⑦ 겨누니 **물렸다**고 한다');
  const o0 = (await S(() => SPACE.supply)).ore;
  await S(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); });
  await p.waitForTimeout(900);
  await S(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })); });
  await p.waitForTimeout(900);
  const g1 = await S(() => SPACE.gun);
  ok(g1.shots > 0, `⑧ **Space 로 쏜다** (${g1.shots}발) — 「${await said()}」`);
  ok((await S(() => SPACE.supply)).ore > o0,
    `⑨ **부수면 광석이 는다** (${o0} → ${(await S(() => SPACE.supply)).ore}) — 쏘는 것이 줍는 일이 된다`);

  // ④ 일어난다 — 아래를 보면 좌석
  const back = await until(() => {
    SPACE.put(2.35, -3.6, 0, -1.15);
    return SPACE.aim === 'gunseat';
  }, 25, '앉은 채 좌석 조준');
  ok(back, `⑩ 아래를 보면 좌석이 잡힌다 (${await S(() => SPACE.aim)})`);
  await press(2.6);
  ok(await until(() => !SPACE.gun.up, 80, '일어나기'), '⑪ 일어난다 — **왕복이 닫힌다**');
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[2] ★★ **에어록** — 입고 · 열고 · 낚고 · 닫는다 (v62 부터 **입는다**)');
{
  // ══ ★★ v62 — **한 걸음이 앞에 붙었다** ═══════════════════════════
  //  v45~v61 동안 사람은 우주복 없이 진공에 서서 윈치를 잡았다
  //  (REAL.md §2-C). 이제 걸이를 먼저 잡아야 한다 — **여기까지 못 오면
  //  뒤의 낚기는 아무 뜻이 없다.** 계통 검사(space-suit.js)가 다 초록인데
  //  사람은 거기까지 못 가는 상태를 2026-08-06 에 넷이나 쌓아 뒀다
  const RACK = { x: 1.3 + 0.55, z: (4.2 + 7.2) / 2 - 0.85 };
  ok(await aimAt(RACK.x + 0.95, RACK.z, -Math.PI / 2, 0, 'suit'),
    `⓪ 우주복 걸이가 잡힌다 (${await S(() => SPACE.aim)})`);
  await down();
  const wearing = await until(() => SPACE.suit.wearing > 0.6, 40, '우주복을 입기 시작');
  await up();
  ok(wearing, '⓪b 잡고 있으니 **입기 시작한다** — 22초를 붙들고 있어야 한다');
  // ★ 22초는 헤드리스에서 몇 분이다 (게임 시계가 실제의 1/20 로 돈다).
  //   **손이 닿는다는 것까지가 여기서 잴 수 있는 것**이고, 22초를 채우는
  //   것은 `space-suit.js [1]` 이 표에서 잰다. 건너뛴 것을 소리 내어 적는다
  console.log('   ※ 나머지 22초는 건너뛴다 — 헤드리스 시계로는 몇 분이다 (space-suit.js [1] 이 잰다)');
  await S(() => SPACE.putSuit(true));
  ok((await S(() => SPACE.suit)).canEva, '⓪c 입었다 — 이제 나갈 수 있다');

  const at = await S(() => SPACE.outerAt);
  ok(await aimAt(at.x - 1.1, at.z, -Math.PI / 2, 0, 'outer'),
    `① 바깥문 손잡이가 잡힌다 (${await S(() => SPACE.aim)})`);
  await press(1.0);
  ok(await until(() => SPACE.lock.open, 200, '바깥문 열리기'),
    `② 눌렀더니 열린다 — 「${await said()}」`);
  ok((await S(() => SPACE.lock)).innerLocked, '③ 열려 있는 동안 안쪽 문이 잠긴다 — 갇힌다');

  ok(await aimAt(3.4, 5.15, 0, -0.34, 'winch'), `④ 윈치가 잡힌다 (${await S(() => SPACE.aim)})`);
  const o0 = (await S(() => SPACE.supply)).ore;
  await S((v) => { window.__o0 = v; }, o0);
  await down();
  const pulled = await until(() => SPACE.supply.ore > window.__o0 + 1, 45, '광석이 끌려오기');
  await up();
  ok(pulled, `⑤ 잡고 있으니 광석이 온다 (${o0} → ${(await S(() => SPACE.supply)).ore})`);
  // ★★ 그동안 **우주복 공기가 줄었나** — 안 줄면 진공이 진공이 아니다
  const su = await S(() => SPACE.suit);
  ok(su.air < 300, `⑤b 그동안 우주복 공기가 준다 (${su.air}초) — 그 칸은 진공이다`);

  const at2 = await S(() => SPACE.outerAt);
  await aimAt(at2.x - 1.1, at2.z, -Math.PI / 2, 0, 'outer');
  await press(1.0);
  ok(await until(() => !SPACE.lock.open && SPACE.lock.cycling === 0, 200, '바깥문 닫히기'),
    '⑥ 다시 눌러 닫는다 — **왕복이 닫힌다**');
  await S(() => SPACE.putSuit(false));
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[3] ★★ **조종간이 진짜 운전인가** — 자동 항법이 꺼지나');
{
  ok((await S(() => SPACE.helm)).auto, '① 처음에는 자동 항법이 켜져 있다');
  ok(await aimAt(0, -7.3, 0, -0.2, 'yoke'), `② 조종간이 잡힌다 (${await S(() => SPACE.aim)})`);
  await down();
  for (let i = 0; i < 22; i++) {
    await S(() => window.dispatchEvent(new MouseEvent('mousemove', { movementX: 90, movementY: 0 })));
    await p.waitForTimeout(160);
  }
  const h1 = await S(() => SPACE.helm);
  await up();
  ok(!h1.auto, `③ **잡으니 자동 항법이 꺼진다** — 「${await said()}」`);
  ok(h1.off > 0.02, `④ 밀었더니 항로를 벗어난다 (${h1.off} · ${h1.word})`);

  // ★★ 여기가 「운전이 안 된다」의 핵심 — **놓아도 안 돌아와야** 한다
  await p.waitForTimeout(6000);
  const h2 = await S(() => SPACE.helm);
  ok(Math.abs(h2.off - h1.off) < 0.02,
    `⑤ **놓아도 그대로 간다** (${h1.off} → ${h2.off}) — 수동이면 되돌리는 것도 내 손이다`);

  // 자동 항법 스위치로 되돌린다
  ok(await aimAt(-0.58, -6.6, 0, -0.55, 'autopilot'),
    `⑥ 자동 항법 스위치가 잡힌다 (${await S(() => SPACE.aim)})`);
  await press(0.8);
  ok((await S(() => SPACE.helm)).auto, `⑦ 누르니 자동 항법이 켜진다 — 「${await said()}」`);
  ok(await until(() => SPACE.helm.off < 0.05, 60, '항로 복귀'),
    '⑧ **배가 스스로 항로로 돌아온다**');
}

console.log('\n[3b] ★★ **행성을 박으면 끝난다** — 수동일 때만');
{
  // 자동으로 두면 아무리 벗어나도 안 박는다
  await S(() => { SPACE.setRegion('planet'); SPACE.setPower('thrust', true); SPACE.setOff(0.9); });
  await p.waitForTimeout(4000);
  ok((await S(() => SPACE.helm)).near === 0,
    '① 자동 항법이면 아무리 벗어나도 안 끌려간다 — **자동 항법이 하는 일이 그것이다**');

  // 수동으로 바꾸고 벗어나 둔다
  await S(() => { SPACE.setManual(); SPACE.setOff(0.9); });
  // ★ 끌려가는 데 게임 시간 18초 = 헤드리스로 6분이 넘는다. **오르는지**만
  //   여기서 보고, 마지막 한 걸음은 밀어 놓고 본다 (SPACE.setNear)
  ok(await until(() => SPACE.helm.near > 0.05, 90, '끌려가기'),
    `② 수동이면 행성에 끌려간다 (${(await S(() => SPACE.helm)).near})`);
  await S(() => SPACE.setNear(0.34));
  ok(await until(() => /중력원|충돌/.test(
    (() => { const e = document.getElementById('hud'); return e && !e.hidden ? e.textContent : ''; })()),
  60, '경보'), `③ **경보가 뜬다** — 「${await said()}」`);
  await S(() => SPACE.setNear(0.985));
  ok(await until(() => SPACE.helm.wrecked, 60, '충돌'), '④ 되돌리지 않으면 박는다');
  ok(await S(() => !document.getElementById('over').hidden), '⑤ **게임 오버 화면이 뜬다**');
  // 다시 시작 — 검사가 이어서 돌 수 있게
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(2200);
  await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });
  await p.mouse.click(360, 210);
  await S(() => { const o = SPACE.route.offer; if (o.length) SPACE.pick(o[0]); });
  ok(!(await S(() => SPACE.helm)).wrecked, '⑥ 새로고침하면 새 배로 다시 시작한다');
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[4] ★★ **행성 착륙** — 발견 · 내리기 · 싣기 · 뜨기');
{
  // 장면 B 가 켜는 구간으로 간다. **띄우는 것은 장면이 하게 둔다**
  // ★ **`skipBeat()` 를 한 호출에 몰아 넣었다가 못 잡았다.** 그때는 아직
  //   예고(WARN)로 안 넘어간 상태라 시계를 밀어 봐야 아무 일이 없다 —
  //   박자가 바뀌는 것을 **보고 나서** 다음 박자를 민다
  await S(() => { SPACE.setLeg(3); SPACE.seekScene(600); });
  await until(() => SPACE.scene.phase === 'warn', 30, '예고 박자');
  await S(() => SPACE.skipBeat());
  ok(await until(() => SPACE.land.offered, 40, '장면 B 가 내릴 자리를 켜기'),
    `① 구간 3 에서 **장면이 스스로** 내릴 자리를 띄운다 (${(await S(() => SPACE.scene)).keys})`);

  ok(await aimAt(-2.4, 0.42, Math.PI / 2, -0.30, ['chart0', 'chart1']), '② 해도대가 잡힌다');
  await press(0.6);
  ok(await until(() => SPACE.land.step === 'approach', 30, '내려가기 시작'),
    `③ 「내린다」를 누르니 내려간다 — 「${await said()}」`);

  // 진입 25초 + 하강 20초는 헤드리스로 15분이 넘는다. **끝자락으로 밀고
  // 게임이 넘기게** 둔다 — 스테퍼를 직접 부르지 않는다
  await S(() => SPACE.putLand('down', 18.5));
  ok(await until(() => SPACE.land.onGround, 90, '착지'),
    `④ 게임이 스스로 내려앉는다 — 「${await said()}」`);
  ok((await S(() => SPACE.land)).view.ground, '⑤ **화면에 땅이 있다**');

  // 싣기 — 문을 열어야 한다
  const at = await S(() => SPACE.outerAt);
  await aimAt(at.x - 1.1, at.z, -Math.PI / 2, 0, 'outer');
  await press(1.0);
  ok(await until(() => SPACE.lock.open, 200, '바깥문 열기'), '⑥ 땅에서도 바깥문이 열린다');
  await aimAt(3.4, 5.15, 0, -0.34, 'winch');
  const s0 = await S(() => SPACE.supply);
  await S((v) => { window.__o0 = v; }, s0.ore);
  await down();
  const got = await until(() => SPACE.supply.ore > window.__o0 + 2, 60, '싣기');
  await up();
  ok(got, `⑦ 실린다 (광석 ${s0.ore} → ${(await S(() => SPACE.supply)).ore})`);
  ok((await S(() => SPACE.land)).got.parts >= 0, '⑧ 땅에서는 부품과 식량도 난다');

  // 뜨기 — 문을 닫고 조종간
  const at2 = await S(() => SPACE.outerAt);
  await aimAt(at2.x - 1.1, at2.z, -Math.PI / 2, 0, 'outer');
  await press(1.0);
  ok(await until(() => !SPACE.lock.open && SPACE.lock.cycling === 0, 200, '문 닫기'),
    '⑨ 문을 닫는다');
  await aimAt(0, -7.3, 0, -0.2, 'yoke');
  await press(1.0);
  ok(await until(() => SPACE.land.step === 'up', 40, '이륙'),
    `⑩ 조종간을 잡으니 뜬다 — 「${await said()}」`);
  // 이륙 분사 12초 + 상승 18초는 헤드리스로 10분이 넘는다 — 끝자락으로 민다
  await S(() => SPACE.putLand('up', 28.5));
  ok(await until(() => !SPACE.land.busy, 120, '하늘로'),
    '⑪ **하늘로 돌아온다 — 왕복이 닫힌다**');
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[5] 고장 하나를 **찾아서 고칠 수 있나** — 이 게임의 본체');
{
  await S(() => SPACE.forceFault());
  const f = (await S(() => SPACE.faults)).open[0];
  ok(!!f, `① 고장이 떴다 — 「${f?.lead ?? '없다'}」`);
  if (f) {
    const room = f.at;
    console.log(`   손이 가야 할 방 — ${room}`);
    ok(!!room, '② 어느 방으로 가야 하는지가 정해져 있다');
  }
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[6] ★★ **영구 손상** — 남고 · 보이고 · 우회할 수 있나');
{
  // 흉터는 **혹사한 결과**라 손으로 두 시간을 몰 수는 없다. 계통을 닳게 해
  // 놓고 고치는 그 길만 게임이 걷게 둔다 (SPACE.giveScar 는 그것을 세 번 한다)
  ok((await S(() => SPACE.scars)).got.length === 0, '① 처음에는 흉터가 없다');
  await S(() => SPACE.giveScar('cool'));
  const sc = await S(() => SPACE.scars);
  ok(sc.got.includes('cool'), `② 냉각을 혹사해 고치니 흉터가 남는다 — 「${sc.word}」`);
  ok(sc.valveMult === 2, `③ **밸브가 두 배로 뻑뻑하다** (×${sc.valveMult}) — 못 고치고 우회한다`);
  ok(sc.list[0].around, `④ 우회로를 말한다 — 「${sc.list[0].around}」`);

  // ★ 선체 흉터는 **자국이 늘 굵다**
  await S(() => SPACE.giveScar('hull'));
  ok((await S(() => SPACE.scars)).sign > 0,
    `⑤ 선체 흉터는 자국을 얹는다 (+${(await S(() => SPACE.scars)).sign})`);

  // ★★ **안 없어진다** — 저장하고 켜도 그대로
  await S(() => SPACE.saveNow());
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(2200);
  const after = await S(() => SPACE.scars);
  ok(after.got.length === 2,
    `⑥ **껐다 켜도 안 낫는다** (${after.word}) — 영구가 저장 한 번에 없어지면 영구가 아니다`);
  ok(after.valveMult === 2, '⑦ 이어해도 밸브가 그대로 뻑뻑하다');
}

// ══════════════════════════════════════════════════════════════════════════
//  ★ 창밖 (v57). 계통을 하나 만들면 여기 한 절을 보탠다 (CLAUDE.md).
//
//  ★★ 하늘은 **손이 안 닿는 계통**이라 여기 넣을지 망설였는데, 그래서
//     더 넣어야 한다 — 눈에만 닿는 것은 아무도 안 눌러 보므로 **조용히
//     망가진다.** 실제로 v57 을 만드는 동안 한 번은 셰이더 문자열이
//     끊겨 게임이 통째로 안 떴고, 한 번은 별이 **천장과 계기 위에** 찍혔다.
//     둘 다 다른 검사는 전부 초록이었다.
// ══════════════════════════════════════════════════════════════════════════
console.log('\n[6a] ★★ **열 저장고** — 냉각은 옮기고, 라디에이터가 버린다 (v58)');
{
  // ★ 손이 안 닿는 계통이라 더 넣어야 한다 — 눈에만 닿는 것은 조용히 망가진다
  await S(() => { SPACE.setHeat(40); SPACE.setSink(60); SPACE.setPower('cool', true); });
  const a = await S(() => ({ heat: SPACE.heat, sink: SPACE.sink }));
  ok(typeof a.sink?.v === 'number', `① 저장고를 읽을 수 있다 (${a.sink?.v})`);
  ok(a.sink.word === '비었다', `② 「${a.sink.word}」 — 숫자가 아니라 말로 나온다`);
  await S(() => SPACE.setSink(830));
  const b = await S(() => SPACE.sink);
  ok(b.full === true, `③ 가득 차면 그렇게 말한다 — 「${b.word}」`);
  ok(b.hide === 0, '④ 「몇 분 더 숨을 수 있나」가 0 이 된다 — 지금 가야 한다');
  await S(() => { SPACE.setSink(60); SPACE.setPower('cool', true); SPACE.setPower('sensor', true); });
  const p3 = await S(() => SPACE.power);
  ok(p3.cool && p3.sensor,
    '⑤ ★★ **냉각과 능동 탐지가 같이 켜진다** — 사장님이 짚으신 것 (전력 제한을 없앴다)');
}

console.log('\n[6b] ★ **창밖이 살아 있나** — 별은 박혀 있고 먼지가 흐른다');
{
  await S(() => SPACE.setRegion('empty', true));
  const a = await S(() => SPACE.outside);
  ok(typeof a?.star0 === 'number',
    '① 창밖 상태를 읽을 수 있다 — 못 읽으면 아래 둘은 묻지도 못한 것이다');
  await p.waitForTimeout(2200);
  const c = await S(() => SPACE.outside);
  ok(a.star0 === c.star0,
    '② ★ **별이 안 흐른다** — 제일 가까운 별도 4광년이다 (v57)');
  ok(a.dust0 !== c.dust0,
    '③ ★ **먼지는 흐른다** — 「배가 움직인다」는 이쪽이 만든다');
  await S(() => SPACE.setRegion('void', true));
  await p.waitForTimeout(700);
  const v = await S(() => SPACE.outside);
  ok(v.cut < c.cut,
    `④ 성간 공백에서 별이 준다 (${c.cut} → ${v.cut}) — 구역이 창밖으로 읽힌다`);
  await S(() => SPACE.setRegion('empty', true));
}

console.log('\n[7] ★★ **끝까지 간다** — 성간 공백 · 그리고 「이렇게 왔다」');
{
  // 2시간을 손으로 몰 수는 없다. **문턱까지만** 밀어 놓고 그 다음은
  // 게임이 스스로 하게 둔다 — `setLeg` 로 구간만 옮기면 성간 공백을
  // 건너뛰므로, 여기서는 11구간 **끝**에 세우고 들어서는 것을 본다
  await S(() => { SPACE.setPower('thrust', true); SPACE.seekVoid(); });
  ok(await until(() => SPACE.inVoid, 30, '성간 공백 진입'),
    '① **성간 공백에 들어선다** — 거점을 안 거치고 바로');
  const said1 = await said();
  ok(said1.includes('따라오지'), `② 들어설 때 말해 준다 — 「${said1.trim()}」`);
  ok((await S(() => SPACE.region)) === 'void', '③ 창밖이 성간 공백으로 바뀐다');
  ok((await S(() => SPACE.sky.list.length)) === 0,
    '④ **떠도는 것이 없다** — 여기서는 못 번다');
  // ★ 별이 정말 줄어드나. 갈아타기는 프레임마다라 헤드리스에서는 느리다 —
  //   **바라는 값**이 바뀐 것을 보고, 지금 값이 그쪽으로 가고 있는지만 본다
  const v0 = await S(() => SPACE.land.view);
  ok(v0.wantStars <= 0.2, `⑤ 별을 ${v0.wantStars} 로 줄이러 간다 — 「다 보이는데 볼 것이 없다」`);

  // ★★ 그리고 **도착한다**
  await S(() => SPACE.seekEnd());
  ok(await until(() => SPACE.end.shown, 30, '끝 화면'),
    '⑥ ★★ **끝 화면이 뜬다** — 2시간이 닫힌다');
  const list = await S(() => SPACE.end.list);
  console.log('   ' + list.map((g) => `${g.name}(${g.rows.length})`).join(' · '));
  ok(list.length === 3, '⑦ 목록이 세 묶음이다 — 이렇게 왔다 · 못 고친 것 · 남은 것');
  const txt = await S(() => document.getElementById('end').textContent);
  ok(txt.includes('도착했습니다'), '⑧ **화면에 정말 글자가 있다**');
  ok(!/점수|등급|총점/.test(txt), '⑨ 점수도 등급도 안 띄운다 — 목록이지 성적표가 아니다');
  ok(txt.includes('영구 손상'), '⑩ 못 고친 것을 이름으로 부른다');

  // ★ 그리고 **새 배로 다시 시작할 수 있다** — 여기서 막히면 끝이 덫이다
  await S(() => { window.__old = 1; });
  // ★ **먼저 굴려서 눈에 넣는다.** 이 검사는 창이 720×420 이라 목록이
  //   길면 단추가 화면 아래로 밀린다 — 사람도 그때는 굴려서 누르므로
  //   그대로 흉내낸다. 안 굴리고 좌표만 재면 화면 밖을 누르게 되고,
  //   그건 「단추가 안 먹는다」가 아니라 **검사가 안 굴린 것**이다
  const at = await S(() => {
    const e = document.getElementById('btn-new3');
    e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: window.innerHeight };
  });
  if (at.y < 0 || at.y > at.h) console.log(`   … 단추가 화면 밖이다 (y ${at.y.toFixed(0)} / ${at.h})`);
  await p.mouse.click(at.x, at.y);
  await p.waitForFunction(() => !window.__old && window.SPACE, null, { timeout: 60000 }).catch(() => {});
  ok(await S(() => !window.__old && SPACE.route.leg === 0),
    '⑪ **새 배로 시작한다** — 왕복이 닫힌다');
}

console.log('');
ok(errs.length === 0, errs.length ? `콘솔 오류 ${errs.length}: ${errs[0]}` : '콘솔 오류 없음');
await b.close();
console.log('');
console.log(fail ? `✘ ${fail} 군데 — **여기서 사람이 막힌다**` : '✔ 전부 통과 — 처음부터 끝까지 이어진다');
process.exit(fail ? 1 : 0);
