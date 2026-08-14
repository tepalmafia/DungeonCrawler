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
// ★★★ v124 — **그림이 아직 안 온 것은 오류가 아니다.**
//   이 검사가 「콘솔 오류 66개」로 빨갰는데 **66개가 다 그림 404** 였다.
//   이 저장소의 규약은 「그림은 사장님이 주신다 · 아직 없으면 기다린다」이고,
//   기다리는 상태를 빨강으로 두면 **진짜 오류가 그 66줄에 묻힌다.**
//   ★ 그렇다고 404 를 통째로 버리지는 않는다 — **코드 파일이 없는 404**는
//     진짜 사고이므로 따로 센다 (`.js` · `.json` 은 그림이 아니다)
const isArt = (t) => /404/.test(t) && !/\.(js|json|mjs|css|html)\b/.test(t);
const art = [];
p.on('console', (m) => {
  if (m.type() !== 'error') return;
  (isArt(m.text()) ? art : errs).push(m.text());
});
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
  await p.waitForTimeout(120);
}
const locked = () => p.evaluate(() => !!document.pointerLockElement);
/**
 * ★★★ v124 — **화면 복판을 눈 감고 누르지 않는다** (사장님 「낡은 절들 정리해줘」).
 *
 *   ★ 여기가 `mouse.click(640, 400)` 네 군데였다. 그런데 그 자리에 지금은
 *     **시작 화면 단추**가 서 있어서, 눌리는 것이 「시작」이 아니라
 *     「처음부터 다시」거나 「점검 모드」다 — 포인터가 안 잠기고
 *     [2] 부터 줄줄이 빨개졌다.
 *   ★★ 이 파일은 **v117 에 똑같은 병을 한 번 앓았다** (점검 모드 패널이
 *     열린 채로 복판을 눌러 「처음부터 다시」가 새로고침이 된 일).
 *     그때는 패널이었고 지금은 시작 화면이다 — **복판을 눈 감고 누르는
 *     줄이 남아 있는 한 화면이 바뀔 때마다 또 걸린다.**
 *   ★ 그래서 **누를 것을 이름으로 부르고**, 그 다음에 빈 자리를 눌러 잠근다
 */
// ★★★ 처음에 이 몸통이 **자기를 부르고** 있었다. 눈 감은 클릭 네 군데를
//   문자열로 한꺼번에 갈아 끼웠는데, 갈아 끼우려던 두 줄이 **이 함수
//   안에도 똑같이** 있었고 파일에서 그쪽이 먼저 나온다 — 첫 일치가
//   호출부가 아니라 **정의부**였다. 그래서 [2] 가 빨개지지도 않고
//   **10분을 매달렸다.** ★ 매다는 검사는 빨간 검사보다 나쁘다:
//   빨간 것은 무엇이 틀렸는지라도 말한다
async function playAndLock() {
  if (await shown('#hint')) { await hit('#btn-play'); await p.waitForTimeout(400); }
  // ★★ **한 번 누르고 포기하지 않는다.** [3] 이 여기서 빨갰는데,
  //   브라우저는 **잠금을 푼 직후 다시 잠그는 것을 잠깐 막는다** —
  //   점검 모드를 닫자마자 누르면 그 창에 걸린다. 사람은 그럴 때
  //   **한 번 더 누른다.** 게임을 고칠 일이 아니라 사람처럼 굴 일이다
  for (let i = 0; i < 3; i++) {
    //  ★ v155 — 좌표가 아니라 **캔버스를 이름으로** 누른다. 이 파일이 위에
    //    「여기가 `mouse.click(640, 400)` 네 군데였다」고 적어 놓고 한 군데를
    //    남겼다. `space-audio` 가 같은 함정으로 **매번 터지고 있었다**
    await p.click('#view', { position: { x: 640, y: 400 }, force: true }).catch(() => {});
    if (await p.waitForFunction(() => window.SPACE.locked, null, { timeout: 4000 })
      .then(() => true).catch(() => false)) return true;
    await p.waitForTimeout(900);
  }
  return false;
}
/**
 * ★★★ v117 — **상태를 보고 여닫는다.** 여태 ` 를 눈 감고 눌러 「토글」
 *   했는데, 그러면 앞 절이 열어 둔 채로 끝나는 순간 **열고 닫는 것이
 *   뒤집힌다.** 그 상태로 화면 복판을 누르면 **패널 안의 단추**가
 *   눌리고, v117 에 「처음부터 다시」가 첫 무리로 올라오면서 그게
 *   **새로고침**이 됐다 — 검사가 그 자리에서 죽었다.
 *   ★ 「토글」은 지금 상태를 알 때만 쓸 수 있는 말이다
 */
async function setCheck(want) {
  for (let i = 0; i < 3; i++) {
    if ((await shown('#check')) === want) return true;
    await p.keyboard.press('`');
    await p.waitForTimeout(120);
  }
  return (await shown('#check')) === want;
}
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
  await setCheck(false);                             // ★ 확실히 닫는다
  await playAndLock();                               // 시작 화면을 치우고 잠근다
  ok(await locked(), '게임을 켰다 — 포인터가 잠겼다');
  await setCheck(true);
  ok(await shown('#check'), '노는 중에 열린다');
  ok(!(await locked()), '열면 **잠금이 풀린다** — 마우스를 써야 하니까');

  const ore0 = await p.evaluate(() => window.SPACE.supply.ore);
  // ★★ **v69 — 여기가 제 변경 전부터 빨간색이었다.** 점검 모드의 항목
  //   이름이 바뀐 지 오래인데 검사만 옛 이름을 부르고 있었고, 그래서
  //   **없는 단추를 찾다 죽었다.** 검사가 죽으면 그 뒤 줄은 하나도 안 돈다
  await hitText('보급 가득');
  const ore1 = await p.evaluate(() => window.SPACE.supply.ore);
  ok(ore1 > ore0, `① 눌렀더니 정말 바뀐다 (광석 ${ore0.toFixed(0)} → ${ore1.toFixed(0)})`);

  // ★★ **여기가 사장님이 걸린 자리다.** 한 번 누른 뒤에도 커서가 살아
  //   있어야 두 번째가 먹는다. 예전에는 여기서 잠금이 다시 걸렸다
  ok(!(await locked()), '★ 한 번 누른 뒤에도 **잠금이 안 걸린다** — 커서가 안 사라진다');

  const heat0 = await p.evaluate(() => window.SPACE.heat);
  await hitText('열 90');
  const heat1 = await p.evaluate(() => window.SPACE.heat);
  ok(heat1 > heat0 && heat1 >= 85, `② **두 번째도 먹는다** (열 ${heat0.toFixed(0)} → ${heat1.toFixed(0)})`);

  // ★ 그리고 그 클릭이 **게임의 손짓으로 새지 않는다**
  ok(await p.evaluate(() => !window.SPACE.holdNow),
    '③ 단추를 누른 것이 게임의 「집었다」로 안 샌다');
}

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ v117 — **단추를 하나도 빠짐없이 눌러 본다**
//
//  ★ 사장님 「기존 f2에 테스트 항목도 개선시켜주고 **테스트가 재대로
//    가능하게**」
//
//  ══ 왜 이 절이 필요했나 ═══════════════════════════════════════════
//
//  여태 이 검사는 **단추 셋**만 눌러 봤다. 그런데 v109·v110 이 걷기와
//  방들을 없앤 뒤로 점검 모드의 절반이 **조용히 아무 일도 안 하고**
//  있었다 — 훅은 다 살아 있어서 **예외도 안 던졌다.**
//
//  ★★ 「게임이 고장난 건지 버튼이 고장난 건지 알 수가 없다」는 이
//    파일이 스스로 적어 둔 말이고, 그 상태가 여러 판 갔다. 이제
//    **전부 눌러 보고**, 눌러서 아무 말도 안 하거나 오류가 나면 잡는다.
// ══════════════════════════════════════════════════════════════════════════
console.log('\n[2-b] ★★★ **모든 항목을 하나씩 눌러 본다** (v117)');
{
  await setCheck(true);
  const labels = await p.evaluate(() =>
    [...document.querySelectorAll('#check button')].map((b) => b.textContent));
  console.log(`   항목 ${labels.length} 개`);
  const SKIP = ['처음부터 다시', '바로 끝 화면', '떨궈 보기'];
  const dead = []; const broke = []; const skipped = [];
  for (const label of labels) {
    // ══ ★★★ **끝내는 단추는 여기서 안 누른다** ═══════════════════════
    //  ★ 「처음부터 다시」는 새로고침이고, 「끝 화면」·「떨궈 보기」는
    //    회차를 끝낸다 — 누르면 그 뒤 단추들이 **없는 화면**에서 눌린다.
    //    셋 다 제 검사가 따로 있다 ([4] · `space-end.js` · `space-drop.js`).
    //  ★★ 이걸 몰라서 처음 돌렸을 때 검사가 **900초를 넘겨 안 끝났다** —
    //    끝 화면이 뜨자 ` 가 안 먹어 점검 모드를 다시 못 열었기 때문이다
    if (SKIP.some((k) => label.includes(k))) { skipped.push(label); continue; }
    try {
      await p.evaluate(() => { document.querySelector('#check .say').textContent = '—'; });
      await hitText(label);
      const said = await p.$eval('#check .say', (e) => e.textContent);
      if (said === '—') dead.push(label);                 // 아무 말도 안 했다
      else if (said.includes('안 됩니다')) broke.push(`${label} → ${said}`);
    } catch (e) { broke.push(`${label} → ${e.message}`); }
    // ★ 창이 열렸으면 닫는다 — I 창이 점검 모드를 덮으면 다음 단추를 못 누른다
    await p.evaluate(() => { if (window.SPACE?.openBay) window.SPACE.openBay(false); });
    await setCheck(true);
  }
  // ★ **안 누른 것을 말한다.** 조용히 건너뛰면 「다 눌러 봤다」가 거짓이 된다
  console.log(`   안 누른 것 ${skipped.length} — ${skipped.join(' · ')} (제 검사가 따로 있다)`);
  if (broke.length) for (const x of broke) console.log(`   ✘ ${x}`);
  if (dead.length) for (const x of dead) console.log(`   ✘ 조용함 — ${x}`);
  ok(!broke.length, `★★★ **오류를 내는 항목이 없다** (${broke.length})`);
  ok(!dead.length,
    `★★★ **조용히 아무 말도 안 하는 항목이 없다** (${dead.length})`
    + ' — 조용한 무동작이 빨간 오류보다 나쁘다. 사장님은 그걸 「눌러도'
    + ' 아무것도 변한게 없다」로 겪으신다');
}

console.log('\n[2-c] ★★ **미사일 무한이 스위치가 됐나** (v117)');
{
  await setCheck(true);
  const was = await p.evaluate(() => window.SPACE.setInfinite(false));
  ok(was === false, '★★ **기본은 꺼짐**이다 — 이제 미사일이 진짜로 떨어진다');
  await hitText('★ 미사일 무한 켜기/끄기');
  ok(await p.evaluate(() => window.SPACE.setInfinite(undefined) === false),
    '★★★ **단추로 켜고 끈다** — 표에 박아 두지 않고 시험할 때만 켠다'
    + ' (사장님 「f2테스트에 넣어서 테스트할 때 사용할 수 있도록」)');
}

console.log('\n[3] ★ **다시 놀 수 있나** — 점검하고 나서 돌아가야 한다');
{
  await setCheck(false);
  ok(!(await shown('#check')), '닫힌다');
  await playAndLock();
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
  await playAndLock();
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
  // ══ ★★★ v124 — **묻는 것을 지금 배로 옮겼다** ══════════════════════
  //
  //  ★ 사장님 (2026-08-12) 「낡은 절들 정리해줘」
  //
  //  ★★ 원래 물음은 사장님이 겪으신 이것이었다: 「왜 자꾸 주포에서
  //    시작하고 **움직여지지가 않아**?」 — 앉은 채 저장하면 걸음이 막혀
  //    켤 때마다 그 자리였다. 그래서 「저절로 일어나나 · 걸어지나」를 쟀다.
  //
  //  ★★★ 그런데 **v110 이 일어서기와 걷기를 통째로 없앴다**
  //    (`PILOT.canStand = false` · 「항상 앉은 상태에서 모든 조작을 한다」).
  //    즉 「저절로 일어난다」는 이제 **틀린 답**이고, 그걸 재던 ②⑥⑦ 은
  //    빨개지지도 않고 **`gun.up` 이라는 죽은 칸을 읽어 늘 통과**하고
  //    있었다 (그 주석이 이 파일 안에 이미 적혀 있었다 — v64 에 죽은 칸).
  //
  //  ★ **물음 자체는 안 버린다.** 「이어했는데 못 움직이지 않나」는 지금도
  //    유효하고, 다만 「움직인다」가 **걷기에서 조종으로** 바뀌었을 뿐이다.
  //    그래서 같은 자리에서 **조종간과 스로틀이 먹나**를 묻는다
  await boot();
  await p.evaluate(() => { window.SPACE.putGun(true); window.SPACE.saveNow(); });
  ok(await p.evaluate(() => window.SPACE.helm2.sat), '① 조종석에 앉은 채로 저장했다');

  await boot();
  ok(await p.evaluate(() => window.SPACE.helm2.sat),
    '② ★★★ **이어해도 앉아 있다** — v120 까지 여기는 「일어나 있다」를 물었다.'
    + ' v110 이 일어서기를 없앴으므로 그건 이제 틀린 답이고, 그때도 죽은 칸'
    + '(`gun.up`)을 읽어 **늘 통과**하고 있었다');
  ok(!(await p.evaluate(() => window.SPACE.pilotRules.canStand)),
    '③ ★★ 애초에 **설 수가 없다** — 「걸어가서」가 답이 될 수 있는 설계는 이제 틀린 설계다');

  // ★★ 그리고 **정말 움직여지나** — 사장님 물음의 알맹이는 여기다
  await playAndLock();
  const t0 = await p.evaluate(() => window.SPACE.throttle.v);
  await p.keyboard.down('KeyW');
  await p.waitForFunction((v) => window.SPACE.throttle.v > v + 0.05, t0, { timeout: 60000 })
    .catch(() => {});
  await p.keyboard.up('KeyW');
  const t1 = await p.evaluate(() => window.SPACE.throttle.v);
  ok(t1 > t0 + 0.05,
    `④ ★★★ **W 를 누르니 스로틀이 오른다** (${t0.toFixed(2)} → ${t1.toFixed(2)}) —`
    + ' 이어한 자리에서 갇히지 않는다. 「움직인다」가 걷기에서 조종으로 바뀌었을 뿐이다');

  // ★ 판본이 화면에 뜨나 — 「무엇이 떠 있는지」를 추측하지 않으려고
  await boot();
  const ver = await p.$eval('#ver', (e) => e.textContent);
  ok(/^v\d+$/.test(ver), `⑤ 시작 화면에 판본이 뜬다 (${ver}) — 옛 파일인지 화면만 보고 안다`);
}

console.log('');
if (art.length) console.log(`  (그림 ${art.length} 장이 아직 안 왔다 — 404. 오류로 안 센다)`);
ok(errs.length === 0, errs.length ? `콘솔 오류 ${errs.length}개: ${errs[0]}` : '콘솔 오류 없음');
console.log(fail ? `\n✘ ${fail} 군데` : '\n✔ 전부 통과 — 손이 닿는다');
console.log('\n  ※ **코드로 `.click()` 을 부르면 이 검사는 의미가 없다.**');
console.log('     포인터 잠금이 다시 걸리는 것은 진짜 마우스로만 재현된다 —');
console.log('     그게 v49 까지 이 버그가 안 잡힌 이유다.');
await b.close();
process.exit(fail ? 1 : 0);
