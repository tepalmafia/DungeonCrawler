// ══════════════════════════════════════════════════════════════════════════
//  점검 모드와 새 게임 — **손이 정말 닿나.**
//
//    python3 tools/serve.py 8391 &
//    node tools/space-check.js
//
//  ★ 왜 이 검사가 생겼나 (2026-08-06)
//    사장님: 「f2 눌러도 아무 변화가 없는데?」 → 「f2 눌러서 안에 항목을
//    눌러도 **아무것도 변한게 없다고!!**」 → 「계속 이어하기로 나오는데?
//    **새 게임은 어떻게 하는거야?**」
//
//    셋 다 코드로는 멀쩡했다. 상자는 떴고, 단추의 함수는 돌았고, 저장은
//    지워졌다. 안 된 것은 **손**이었다:
//      ① F2 는 노트북에서 Fn 을 같이 눌러야 하는 하드웨어 키다
//      ② 단추를 한 번 누르면 `input.js` 가 포인터 잠금을 다시 걸어
//         **커서가 사라졌다** — 두 번째부터는 어디를 눌러도 안 먹는다
//      ③ 처음부터 시작하는 길이 **아무 데도 없었다**
//
//    그래서 이 검사는 **진짜 마우스로 누른다** (`page.click`). 코드로
//    `.click()` 을 부르면 ②가 안 잡힌다 — 그게 지금까지 안 잡힌 이유다.
// ══════════════════════════════════════════════════════════════════════════
let chromium = null;
for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
  try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ }
}
if (!chromium) { console.error('playwright 가 없습니다. serve.py 를 먼저 띄웁니다.'); process.exit(2); }

const PORT = process.argv.includes('--port')
  ? process.argv[process.argv.indexOf('--port') + 1] : '8391';
const URL = `http://127.0.0.1:${PORT}/space/`;

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };

const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
// confirm() 을 자동으로 받는다 — 「처음부터 다시」가 물어보기 때문
p.on('dialog', (d) => d.accept());

const boot = async () => {
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForFunction(() => window.SPACE, null, { timeout: 60000 });
};
/**
 * 사람처럼 누른다 — **진짜 마우스.** 이게 이 검사의 전부다.
 *
 * ★ `page.click()` 을 안 쓴다. 그건 누르기 전에 「이 요소가 흔들리지 않나」를
 *   rAF 두 프레임으로 재는데, 소프트웨어 렌더링에서는 게임의 rAF 가 워낙
 *   느려 그 검사가 영영 안 끝난다 — **화면이 멈춘 것이 아니라 재는 쪽이
 *   못 재는 것**이다. 자리를 직접 구해 그 자리를 누른다.
 *
 * ★ 그리고 `elem.click()` 으로도 안 부른다. 그러면 창 전체의 mousedown 이
 *   안 돌아서 **이 검사가 잡으려는 바로 그 버그가 안 재현된다.**
 */
async function hit(sel) {
  const at = await p.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, sel);
  if (!at) throw new Error(`${sel} 이 없습니다`);
  await p.mouse.click(at.x, at.y);
  await p.waitForTimeout(250);
}
/** 글자로 단추를 찾는다 — 점검 모드 안의 것들 */
async function hitText(label) {
  const at = await p.evaluate((t) => {
    const el = [...document.querySelectorAll('#check button')].find((b) => b.textContent === t);
    if (!el) return null;
    // ★★★ **v69 — 먼저 굴려서 눈에 넣는다.** 이게 없어서 ②③ 이 빨갰다.
    //   점검 모드 항목이 스물 몇 개라 뒤쪽 것은 **패널 밖으로 밀려 있고**,
    //   좌표만 재서 누르면 **엉뚱한 자리**를 누른다. 검사에는 「단추를
    //   눌렀는데 아무 일이 없다」로 나오는데, 사람은 그 상황에서 굴린다.
    //   `space-endtoend.js` 가 끝 화면 단추에서 이미 겪고 고친 것과 같은 병
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: window.innerHeight };
  }, label);
  if (!at) throw new Error(`「${label}」 단추가 없습니다`);
  if (at.y < 0 || at.y > at.h) console.log(`   … 「${label}」 이 화면 밖이다 (y ${at.y.toFixed(0)} / ${at.h})`);
  await p.mouse.click(at.x, at.y);
  await p.waitForTimeout(250);
}
const locked = () => p.evaluate(() => !!document.pointerLockElement);
const shown = (sel) => p.evaluate((s) => {
  const el = document.querySelector(s);
  return !!el && !el.hidden && getComputedStyle(el).display !== 'none';
}, sel);

console.log('\n점검 모드와 새 게임 — 손이 정말 닿나');
await boot();

console.log('\n[1] ★ **여는 길이 둘 이상인가** — 하나가 막히면 없는 것과 같다');
{
  await p.keyboard.press('F2');
  ok(await shown('#check'), 'F2 로 열린다');
  await p.keyboard.press('F2');
  ok(!(await shown('#check')), 'F2 로 닫힌다');
  // ★ 노트북에서 F2 가 안 오는 사람을 위한 두 번째 길
  await p.keyboard.press('`');
  ok(await shown('#check'), '**` 로도 열린다** — F2 가 Fn 에 물린 자판을 위해');
  await p.keyboard.press('`');
  ok(!(await shown('#check')), '` 로 닫힌다');
  // ★ 그리고 **키를 아예 안 쓰는 길** — 시작 화면의 단추
  ok(await shown('#hint'), '시작 화면이 떠 있다');
  await hit('#btn-check');
  ok(await shown('#check'), '**단추로도 열린다** — 키를 하나도 안 쓰고');
}

console.log('\n[2] ★★ **안의 항목이 정말 먹나** — 진짜 마우스로 누른다');
{
  // 사장님이 겪은 그대로: 게임을 켜 놓고(잠금) → 열고 → 눌러 본다
  await p.keyboard.press('`');                       // 일단 닫고
  await p.mouse.click(640, 400);                     // 화면을 눌러 시작
  await p.waitForFunction(() => window.SPACE.locked, null, { timeout: 8000 }).catch(() => {});
  ok(await locked(), '게임을 켰다 — 포인터가 잠겼다');
  await p.keyboard.press('`');
  ok(await shown('#check'), '노는 중에 열린다');
  ok(!(await locked()), '열면 **잠금이 풀린다** — 마우스를 써야 하니까');

  const ore0 = await p.evaluate(() => window.SPACE.supply.ore);
  // ★★ **v69 — 여기가 제 변경 전부터 빨간색이었다.** 점검 모드의 항목
  //   이름이 「광석 60 싣기」에서 「광석 60 · 부품 8」로 바뀐 지 오래인데
  //   검사만 옛 이름을 부르고 있었고, 그래서 **없는 단추를 찾다 죽었다.**
  //   검사가 죽으면 그 뒤 줄은 하나도 안 돈다 — 즉 「단추가 먹나」를
  //   여러 판 동안 아무도 안 지키고 있었다
  await hitText('광석 60 · 부품 8 · 미사일 8');
  const ore1 = await p.evaluate(() => window.SPACE.supply.ore);
  ok(ore1 > ore0, `① 눌렀더니 정말 바뀐다 (광석 ${ore0.toFixed(0)} → ${ore1.toFixed(0)})`);

  // ★★ **여기가 사장님이 걸린 자리다.** 한 번 누른 뒤에도 커서가 살아
  //   있어야 두 번째가 먹는다. 예전에는 여기서 잠금이 다시 걸렸다
  ok(!(await locked()), '★ 한 번 누른 뒤에도 **잠금이 안 걸린다** — 커서가 안 사라진다');

  const heat0 = await p.evaluate(() => window.SPACE.heat);
  await hitText('열 90');
  const heat1 = await p.evaluate(() => window.SPACE.heat);
  ok(heat1 > heat0 && heat1 >= 85, `② **두 번째도 먹는다** (열 ${heat0.toFixed(0)} → ${heat1.toFixed(0)})`);

  const p0 = await p.evaluate(() => { const q = window.SPACE.pos; return [q.x, q.z]; });
  await hitText('바깥문 앞으로');
  const p1 = await p.evaluate(() => { const q = window.SPACE.pos; return [q.x, q.z]; });
  ok(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 2,
    `③ **세 번째도 먹는다** — 몸이 옮겨졌다 (${p0.map((v) => v.toFixed(1))} → ${p1.map((v) => v.toFixed(1))})`);

  // ★ 그리고 그 클릭이 **게임의 손짓으로 새지 않는다**
  ok(await p.evaluate(() => !window.SPACE.holdNow),
    '④ 단추를 누른 것이 게임의 「집었다」로 안 샌다');
}

console.log('\n[3] ★ **다시 놀 수 있나** — 점검하고 나서 돌아가야 한다');
{
  await p.keyboard.press('`');
  ok(!(await shown('#check')), '닫힌다');
  await p.mouse.click(640, 400);
  await p.waitForFunction(() => window.SPACE.locked, null, { timeout: 8000 }).catch(() => {});
  ok(await locked(), '화면을 누르니 **다시 잠긴다** — 놀던 데로 돌아간다');
}

console.log('\n[4] ★★ **새 게임** — 처음부터 시작하는 길이 있나');
{
  // 저장이 남게 만든다
  await p.evaluate(() => { window.SPACE.setLeg(4); window.SPACE.setHeat(70); window.SPACE.saveNow(); });
  await boot();
  const legBack = await p.evaluate(() => window.SPACE.route.leg);
  ok(legBack === 3, `① 켜면 **이어진다** (구간 ${legBack + 1}) — 이건 원래 그래야 한다`);

  // 멈춤 화면으로 — 사람은 **Esc 하나**면 된다.
  // ★ 다만 헤드리스 크로뮴은 만들어 낸 Esc 로 **포인터 잠금을 안 푼다**
  //   (진짜 브라우저는 푼다 — 그건 브라우저가 하는 일이지 게임이 아니다).
  //   안 풀린 채로는 마우스 자리가 뜻을 잃어서 단추를 못 누른다. 그래서
  //   여기서만 잠금을 손으로 풀어 준다 — **멈춤 화면을 띄우는 것 자체는
  //   Esc 로 한다.** 이 두 줄을 없애려고 게임을 고치면 안 된다
  await p.mouse.click(640, 400);
  await p.waitForFunction(() => window.SPACE.locked, null, { timeout: 8000 }).catch(() => {});
  await p.keyboard.press('Escape');
  await p.evaluate(() => document.exitPointerLock?.());
  await p.waitForTimeout(400);
  ok(await shown('#pause'), '② Esc 로 멈춤 화면이 뜬다');
  ok(await shown('#btn-new2'), '③ 거기에 **「처음부터 다시」가 보인다**');

  // ★ **새로고침을 기다린다.** 그냥 `window.SPACE` 를 기다리면 *옛 쪽*이
  //   아직 살아 있어서 그 자리에서 통과해 버린다 — 그러면 「안 지워졌다」로
  //   빨개지는데 실은 아직 안 지운 것뿐이다. 표를 하나 심어 두고 그것이
  //   사라지는 것을 본다
  await p.evaluate(() => { window.__old = 1; });
  await hit('#btn-new2');
  await p.waitForFunction(() => !window.__old && window.SPACE, null, { timeout: 60000 });
  const legNew = await p.evaluate(() => window.SPACE.route.leg);
  const heatNew = await p.evaluate(() => window.SPACE.heat);
  ok(legNew === 0, `④ **새 배로 시작한다** (구간 ${legNew + 1})`);
  ok(heatNew < 40, `⑤ 열도 처음 값이다 (${heatNew.toFixed(0)}) — 반만 지워지면 그게 제일 나쁘다`);
  const txt = await p.$eval('#hint p', (e) => e.textContent);
  ok(!txt.includes('이어'), '⑥ 안내가 「이어갑니다」라고 안 한다 — 거짓말을 안 한다');
}

console.log('\n[5] ★★ **이어했는데 못 움직이지 않나** — 앉은 채 저장해 본다');
{
  // 사장님: 「왜 자꾸 주포에서 시작하고 **움직여지지가 않아**?」
  // 앉은 채 저장하면 `gunBusy` 가 걸음을 막아 **켤 때마다 그 자리**였다
  await boot();
  await p.evaluate(() => { window.SPACE.putGun(true); window.SPACE.saveNow(); });
  // ★★ **v69 — `gun.up` 은 v64 에 죽은 칸이다.** 그때 포탑을 걷어내고
  //   조종석 좌석으로 옮겼는데(`putGun` 이 `helmSat` 을 켠다), 검사만
  //   옛 칸을 읽어서 **늘 false** 였다. 이름이 `putGun` 그대로라 눈으로도
  //   안 보였다 — 이 판에서 **네 번째로 나온 「검사가 없어진 것을 읽는다」**
  ok(await p.evaluate(() => window.SPACE.helm2.sat), '① 조종석에 앉은 채로 저장했다');

  await boot();
  ok(!(await p.evaluate(() => window.SPACE.gun.up)),
    '② ★ 이어하면 **일어나 있다** — 자세는 안 잇는다');

  // 그리고 정말 걸어지나 — 이게 사장님이 겪은 것이다
  await p.mouse.click(640, 400);
  await p.waitForFunction(() => window.SPACE.locked, null, { timeout: 8000 }).catch(() => {});
  const w0 = await p.evaluate(() => { const q = window.SPACE.pos; return [q.x, q.z]; });
  await p.keyboard.down('KeyW');
  await p.waitForFunction((s) => {
    const q = window.SPACE.pos;
    return Math.hypot(q.x - s[0], q.z - s[1]) > 0.3;
  }, w0, { timeout: 15000 }).catch(() => {});
  await p.keyboard.up('KeyW');
  const w1 = await p.evaluate(() => { const q = window.SPACE.pos; return [q.x, q.z]; });
  ok(Math.hypot(w1[0] - w0[0], w1[1] - w0[1]) > 0.3,
    `③ ★★ **W 를 누르니 걸어진다** (${w0.map((v) => v.toFixed(1))} → ${w1.map((v) => v.toFixed(1))})`);

  // ★★ **어떤 이유로 앉아 있든 갇히지 않나.** 저장을 고쳤는데도 사장님이
  //   「계속 그 자리에서 움직이질 못해」라고 하셨다. 앉으면 걸음이 막히는
  //   것은 맞다 — 틀린 것은 **막힌 채로 아무 말도 안 한 것**이다
  await p.evaluate(() => window.SPACE.putGun(true));
  ok(await p.evaluate(() => window.SPACE.helm2.sat), '⑤ 일부러 다시 앉혔다');
  const s0 = await p.evaluate(() => { const q = window.SPACE.pos; return [q.x, q.z]; });
  await p.keyboard.down('KeyW');
  await p.waitForFunction((s) => {
    const q = window.SPACE.pos;
    return !window.SPACE.gun.up && Math.hypot(q.x - s[0], q.z - s[1]) > 0.3;
  }, s0, { timeout: 90000 }).catch(() => {});
  await p.keyboard.up('KeyW');
  const s1 = await p.evaluate(() => { const q = window.SPACE.pos; return [q.x, q.z]; });
  ok(!(await p.evaluate(() => window.SPACE.gun.up)),
    '⑥ ★★ **W 를 누르고 있으니 저절로 일어난다** — 일어나는 법을 몰라도 안 갇힌다');
  ok(Math.hypot(s1[0] - s0[0], s1[1] - s0[1]) > 0.3,
    `⑦ 그러고 **걸어진다** (${s0.map((v) => v.toFixed(1))} → ${s1.map((v) => v.toFixed(1))})`);

  // ★ 판본이 화면에 뜨나 — 「무엇이 떠 있는지」를 추측하지 않으려고
  const ver = await p.$eval('#ver', (e) => e.textContent);
  ok(/^v\d+$/.test(ver), `⑧ 시작 화면에 판본이 뜬다 (${ver}) — 옛 파일인지 화면만 보고 안다`);

  // ★ 배 밖에 몸이 저장돼 있어도 갇히지 않나 — 옛 판본은 주포가 배 위였다
  await p.evaluate(() => { window.SPACE.put(2.35, -1.0); window.SPACE.saveNow(); });
  await boot();
  const back = await p.evaluate(() => window.SPACE.canStand(window.SPACE.pos.x, window.SPACE.pos.z));
  ok(back, '⑨ 설 수 없는 자리에 저장돼 있으면 **되돌려 준다** — 갇히지 않는다');
}

console.log('');
ok(errs.length === 0, errs.length ? `콘솔 오류 ${errs.length}개: ${errs[0]}` : '콘솔 오류 없음');
console.log(fail ? `\n✘ ${fail} 군데` : '\n✔ 전부 통과 — 손이 닿는다');
console.log('\n  ※ **코드로 `.click()` 을 부르면 이 검사는 의미가 없다.**');
console.log('     포인터 잠금이 다시 걸리는 것은 진짜 마우스로만 재현된다 —');
console.log('     그게 v49 까지 이 버그가 안 잡힌 이유다.');
await b.close();
process.exit(fail ? 1 : 0);
