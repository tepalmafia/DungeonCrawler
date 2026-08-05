// ══════════════════════════════════════════════════════════════════════════
//  튜토리얼 — **일곱을 다 만나나. 하나씩 만나나.** 브라우저 없이.
//
//    node tools/space-tutor.js            숫자만
//    node tools/space-tutor.js --see 8391  + 일곱 줄이 화면에 정말 뜨나
//
//  ★ 여기서 제일 중요한 줄 둘
//    **① 한 번에 하나만 뜬다.** 둘이 뜨면 둘 다 안 읽는다
//    **② 다 뗀 뒤에는 안 뜬다.** 다시 뜨면 그건 잔소리다
//
//  ★ 여기서 안 나오는 것
//    **읽히나.** 화면 아래 한 줄이 실제로 눈에 들어오는지는 여기서 못 잰다 —
//    tools/space-chase.js 가 실제 브라우저에서 「뜨고, 하면 사라지나」를 보고,
//    「읽고 싶어지나」는 직접 해 봐야 안다 (TUTORIAL.md §6).
// ══════════════════════════════════════════════════════════════════════════
import { TUTOR, LESSONS, KEYS, GRIPS, GRIP_SHOW, ARMS_FULL } from '../web/space/js/game/tutor-table.js';
import { makeTutor, stepTutor, lineOf, nowKey, allDone, canFire, gripLine, markGrip } from '../web/space/js/game/tutor.js';
import { FAULT } from '../web/space/js/game/mission-table.js';
import { HAZARD } from '../web/space/js/game/hazard-table.js';
import { LEG } from '../web/space/js/game/route-table.js';

const DT = 0.25;
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };

// ── 사람처럼 논다 ───────────────────────────────────────────
// 가르침이 뜨면 **읽고, 그 방까지 걸어가서(9초 — PLAN §11 의 방 사이), 한다.**
// 곧바로 하지 않는 것이 중요하다 — 즉시 떼면 간격이 0 이 되어 「몰아치나」를
// 못 잰다. 그리고 사람은 원래 곧바로 안 한다.
const REACT = 9;

/** 게임을 아주 굵게 흉내 낸다 — 가르침이 언제 뜨는지만 보면 된다 */
function makeWorld() {
  return {
    t: 0,
    walked: 0, turned: 0,
    atPort: true, forkPicked: 0,
    heat: 12, thrust: false, flips: 0, cooled: 0, steered: 0,
    faultsOpen: 0, faultsFixed: 0, faultNext: FAULT.firstAfter,
    hazardSeen: 0, dodged: 0, hazardNext: HAZARD.firstAfter,
    food: 100, foodLow: false,
    loads: 0, traded: 0,
    hazardBeforeFault: 0,     // ★ 빗장이 새면 여기가 오른다
  };
}

/** 게임 쪽 — 사건은 표대로 오되 **빗장이 걸린 것은 안 온다** */
function world(w, tu, dt) {
  w.t += dt;
  // ★ **추진을 켜야** 열이 오른다. 전에는 「항로를 골랐으면」이었는데,
  //   지금은 정박 중에 추진이 꺼져 있으므로 게임과 어긋난다
  if (w.thrust) {
    w.heat = Math.min(100, w.heat + (w.coolFor > 0 ? -3.4 : 1.1) * dt);
    w.coolFor = Math.max(0, w.coolFor - dt);
  }
  if (w.forkPicked > 0) {
    w.food = Math.max(0, w.food - (100 / (LEG.seconds * 1.25)) * dt);
    w.foodLow = w.food <= 24;
  }
  // 고장 — 빗장이 걸려 있으면 안 온다
  if (canFire(tu, 'fault') && w.faultsOpen === 0 && w.faultsFixed < 3) {
    w.faultNext -= dt;
    if (w.faultNext <= 0) { w.faultsOpen = 1; w.faultNext = 95; }
  }
  // 위험 지대 — 마찬가지
  if (canFire(tu, 'hazard')) {
    w.hazardNext -= dt;
    if (w.hazardNext <= 0) {
      w.hazardSeen++;
      w.hazardNext = HAZARD.every[0];
      // ★ 이게 새면 첫 판에 고장과 위험 지대가 겹친다
      if (w.faultsFixed === 0) w.hazardBeforeFault++;
    }
  }
}

/** 사람 쪽 — 가르침이 뜨면 9초 뒤에 그것을 한다 */
function play(w, key) {
  if (key === 'walk') { w.walked = TUTOR.walked + 1; w.turned = TUTOR.turned + 0.5; }
  if (key === 'route') { w.forkPicked++; w.atPort = false; }
  if (key === 'power') { w.flips++; w.thrust = true; }
  // ★ `coolFor` 가 아니라 **셈**이다. 상태값을 done 으로 쓰면 26초 뒤에
  //   「안 한 것」이 되어 먼저 돌려 본 사람을 못 알아본다
  if (key === 'valve') { w.coolFor = 26; w.cooled++; }
  if (key === 'fault') { w.faultsFixed++; w.faultsOpen = 0; }
  // ★ `dodged` 가 아니라 **조종간을 잡고 민 시간**이다 — 가만히 있어도
  //   비켜지는 것이 대부분이라 「비켰다」의 증거가 못 된다
  if (key === 'fly') { w.dodged++; w.steered = TUTOR.steered + 0.5; }
  if (key === 'supply') w.loads++;
}

function snap(w) {
  return {
    walked: w.walked, turned: w.turned, atPort: w.atPort, forkPicked: w.forkPicked,
    heat: w.heat, thrust: w.thrust, flips: w.flips, cooled: w.cooled,
    faultsOpen: w.faultsOpen, faultsFixed: w.faultsFixed,
    hazardSeen: w.hazardSeen, dodged: w.dodged, steered: w.steered,
    foodLow: w.foodLow, loads: w.loads, traded: w.traded,
  };
}

/** 한 판 돌린다. @param lazy 아무것도 안 하는 사람인가 */
function run(seconds, { lazy = false } = {}) {
  const tu = makeTutor();
  const w = makeWorld();
  const seen = [];        // [{ key, at }] — 언제 떴나
  const cleared = [];     // [{ key, at }]
  let react = 0, pending = null;
  let maxOpen = 0, afterAll = 0;

  for (let t = 0; t < seconds; t += DT) {
    world(w, tu, DT);
    const ev = stepTutor(tu, DT, snap(w));
    if (ev === 'show') {
      seen.push({ key: nowKey(tu), at: t });
      if (allDone(tu)) afterAll++;      // ★ 다 뗀 뒤에 또 떴다 = 잔소리
      pending = nowKey(tu);
      react = REACT;
    }
    if (ev === 'clear') cleared.push({ key: cleared.length ? KEYS[cleared.length] : KEYS[0], at: t });
    // 떠 있는 것은 언제나 0 또는 1 이다 — 그게 구조로 보장되나 본다
    maxOpen = Math.max(maxOpen, tu.open ? 1 : 0);
    if (!lazy && pending) {
      react -= DT;
      if (react <= 0) { play(w, pending); pending = null; }
    }
  }
  return { tu, w, seen, cleared, maxOpen, afterAll };
}

// ── 1) 표를 먼저 찍는다 ─────────────────────────────────────
console.log(`\n가르침 — ${LESSONS.length}개 · 한 줄 ${TUTOR.maxLen}자 이하 ·`
  + ` 사이 ${TUTOR.gap}초 · ${TUTOR.showWhere}초 헤매면 방을 알려 준다`);
console.log('\n[1] 일곱 줄 — 무엇을 → (헤매면) 어느 방 → (닿으면) 손 쓰는 법');
console.log('  ' + '─'.repeat(74));
for (const L of LESSONS) {
  console.log(`  ${L.key.padEnd(8)}${String(L.line.length).padStart(3)}자  ${L.line}`);
  console.log(`  ${''.padEnd(8)}${String(L.where.length).padStart(3)}자  → ${L.where}`);
  if (L.hands) console.log(`  ${''.padEnd(8)}${String(L.hands.length).padStart(3)}자  → [${L.at}] ${L.hands}`);
}
{
  const lines = LESSONS.flatMap((L) => [L.line, L.where, L.hands].filter(Boolean));
  const worst = lines.reduce((a, b) => (b.length > a.length ? b : a));
  ok(worst.length <= TUTOR.maxLen, `한 줄이 ${TUTOR.maxLen}자 이하 — 제일 긴 것 ${worst.length}자 「${worst}」`);
  ok(LESSONS.length === 7, `가르칠 것이 일곱이다 — ${LESSONS.length}개 (여덟째를 넣으려면 하나를 빼야 한다)`);
}

// ── 2) 한 판 돌려 본다 ──────────────────────────────────────
const SEC = LEG.seconds * 2.4;
console.log(`\n[2] ${(SEC / 60).toFixed(0)}분을 돌려 본다 — 가르침이 뜨면 ${REACT}초 뒤에 한다`);
console.log('  ' + '─'.repeat(60));
const r = run(SEC);
let prev = 0;
for (const s of r.seen) {
  console.log(`  ${(s.at).toFixed(0).padStart(5)}초  ${s.key.padEnd(8)}`
    + (prev ? `(앞의 것과 ${(s.at - prev).toFixed(0)}초 사이)` : ''));
  prev = s.at;
}

console.log('\n  목표 (docs/space/TUTORIAL.md §4)');
ok(r.seen.length === LESSONS.length,
  `일곱을 다 만난다 — ${r.seen.length}/${LESSONS.length}개`);
ok(r.maxOpen <= 1, `한 번에 하나만 뜬다 — 최대 ${r.maxOpen}개`);
{
  const gaps = r.seen.slice(1).map((s, i) => s.at - r.seen[i].at);
  ok(Math.min(...gaps) >= TUTOR.gap,
    `가르침 사이가 ${TUTOR.gap}초 이상 — 제일 짧은 것 ${Math.min(...gaps).toFixed(0)}초`);
}
ok(allDone(r.tu), `다 뗐다 — ${r.tu.done.join(' → ')}`);
{
  const last = r.seen[r.seen.length - 1].at;
  const legs = last / LEG.seconds;
  ok(legs <= 3, `첫 회차 안에 끝난다 — 마지막 가르침이 ${last.toFixed(0)}초 (구간 ${legs.toFixed(1)}개째)`);
}
ok(r.afterAll === 0, `다 뗀 뒤에는 안 뜬다 — ${r.afterAll}회`);
ok(r.tu.shown === LESSONS.length, `보여 준 횟수가 일곱뿐이다 — ${r.tu.shown}회`);

// ── 3) 빗장 — 이게 「첫 회차가 튜토리얼」의 실체다 ──────────
console.log('\n[3] 빗장 — **아직 안 배웠으면 다음 것이 안 온다** (§2-2)');
console.log(`  고장 ${FAULT.firstAfter}초 · 위험 지대 ${HAZARD.firstAfter}초 —`
  + ` ${HAZARD.firstAfter - FAULT.firstAfter}초밖에 안 떨어져 있다. 그냥 두면 첫 판에 겹친다`);
ok(r.w.hazardBeforeFault === 0,
  `고장을 고치기 전에는 위험 지대가 안 온다 — ${r.w.hazardBeforeFault}회`);
{
  // 다 뗀 뒤에는 빗장이 풀려야 한다 — 안 풀리면 게임이 통째로 안 돈다
  const t2 = makeTutor();
  t2.i = LESSONS.length;
  ok(canFire(t2, 'fault') && canFire(t2, 'hazard'), '다 떼면 빗장이 풀린다 — 그때부터 표대로 온다');
}

// ── 4) 안 하고 버티면 ───────────────────────────────────────
console.log('\n[4] 아무것도 안 하면 — **막지 않는다. 다만 안 나아갈 뿐이다**');
{
  const lz = run(SEC, { lazy: true });
  console.log(`  ${(SEC / 60).toFixed(0)}분 동안 아무것도 안 했다 — 뜬 가르침 ${lz.seen.length}개 · 뗀 것 ${lz.tu.done.length}개`);
  ok(lz.seen.length === 1 && lz.seen[0].key === KEYS[0],
    `첫 줄에서 기다린다 — ${lz.seen.map((s) => s.key).join(', ')}`);
  ok(lz.maxOpen <= 1, '기다리는 동안에도 하나뿐이다 — 쌓이지 않는다');
  // ★ 갇히면 안 된다. 뒤늦게 해도 그때부터 돈다
  const line = lineOf(lz.tu);
  ok(!!line, `가르침이 아직 떠 있다 — 「${line?.text}」 (사라져 버리면 갇힌다)`);
  ok(line?.dim === true, '오래 떠 있으면 흐려진다 — 안 없어지되 잔소리는 안 한다');
}

// ── 4-2) 영영 안 오는 조건 ─────────────────────────────────
console.log('\n[4-2] **추진을 안 켠 사람** — 열이 안 오르면 전력·밸브를 영영 안 배우나');
{
  // ★ 이 구멍은 다 만들고 나서 찾았다. 전력은 「열 40」에 뜨는데 추진을
  //   안 켜면 열이 안 오르고, 그 둘에 **고장 빗장**이 걸려 있어서
  //   못 배우면 게임의 절반이 안 온다. 조건을 기다리되 90초면 그냥 뜬다
  const tu = makeTutor();
  const w = makeWorld();
  const seen = [];
  let react = 0, pending = null;
  for (let t = 0; t < LEG.seconds * 2.4; t += DT) {
    w.heat = 12;                            // **열이 절대 안 오른다**
    world(w, tu, DT);
    w.heat = 12;
    if (stepTutor(tu, DT, snap(w)) === 'show') { seen.push(nowKey(tu)); pending = nowKey(tu); react = REACT; }
    if (pending) { react -= DT; if (react <= 0) { play(w, pending); pending = null; } }
  }
  console.log(`  뜬 것 — ${seen.join(' → ')}`);
  ok(seen.includes('power') && seen.includes('valve'),
    '열이 안 올라도 전력·밸브는 결국 뜬다 — 안 그러면 고장 빗장이 안 풀린다');
  ok(!tu.done.includes('fault') || seen.includes('fault'), '빗장이 풀려 고장까지 간다');
  ok(seen.length === LESSONS.length, `그래도 일곱을 다 만난다 — ${seen.length}/${LESSONS.length}개`);
}

// ── 4-3) 거짓말은 안 한다 ──────────────────────────────────
console.log('\n[4-3] **고장이 없는데 「덜그럭거리는 쪽으로」가 뜨지는 않나**');
{
  // 일곱을 다 보여 주는 것보다 **안 뜨는 게 낫다.** 한 번 거짓말한 계기는
  // 그 뒤로 안 믿는다 — 이 게임은 계기가 전부라 특히 그렇다
  const liars = LESSONS.filter((L) => L.wait && ['fault', 'fly', 'supply'].includes(L.key));
  ok(liars.length === 0,
    `고장·조종·보급에는 시간만으로 뜨는 길이 없다 — ${liars.map((l) => l.key).join(', ') || '없다'}`);
  const tu = makeTutor();
  const w = makeWorld();
  tu.i = KEYS.indexOf('fault');             // 앞의 넷은 뗐다 치고
  let shown = 0;
  for (let t = 0; t < 600; t += DT) if (stepTutor(tu, DT, snap(w)) === 'show') shown++;
  ok(shown === 0, `고장이 하나도 없으면 10분을 기다려도 안 뜬다 — ${shown}회`);
}

// ── 5) 세 단계 ──────────────────────────────────────────────
console.log('\n[5] 세 단계로 세진다 — 헤매면 도와주되 **먼저 안 준다** (§3-B)');
{
  const t3 = makeTutor();
  const w3 = makeWorld();
  w3.walked = TUTOR.walked + 1; w3.turned = TUTOR.turned + 1;   // 걷기는 뗐다
  stepTutor(t3, DT, snap(w3));            // walk 가 뜨고
  stepTutor(t3, DT, snap(w3));            // 곧바로 떼진다
  t3.rest = 0;
  stepTutor(t3, DT, snap(w3));            // route 가 뜬다
  const a = lineOf(t3);
  t3.t = TUTOR.showWhere;
  const b = lineOf(t3);
  const c = lineOf(t3, 'chart0');
  console.log(`  처음        「${a?.text}」`);
  console.log(`  ${TUTOR.showWhere}초 뒤     「${b?.text}」`);
  console.log(`  해도대 조준 「${c?.text}」`);
  ok(a?.text !== b?.text, '처음에는 어느 방인지 안 알려 준다 — 심부름이 되면 안 된다');
  ok(b?.text.includes('관측실'), `헤매면 방을 알려 준다 — 갇히면 안 된다`);
  ok(c?.text !== b?.text, '물건에 조준선이 닿으면 **손 쓰는 법**이 나온다 — 읽을 이유가 여기 생긴다');
}

console.log('\n[6] ★ **새 동사도 가르치나** — 가르침은 일곱인데 동사는 늘었다');
{
  // v31~v32 에 「떼었다 붙인다」와 「수리 네 동작」이 들어왔다.
  // 여덟째 가르침을 만들면 또 설명서가 되므로 **손 쓰는 법만 따로** 뺐다
  const need = ['spot', 'panel'];
  const miss = need.filter((k) => !GRIPS[k]);
  ok(miss.length === 0,
    `새 동사에 손 쓰는 법이 있다 — ${miss.length ? `빠짐: ${miss.join(' · ')}` : Object.keys(GRIPS).join(' · ')}`);
  ok(Object.values(GRIPS).every((v) => v.length <= TUTOR.maxLen),
    `${TUTOR.maxLen}자를 안 넘는다 — ${Object.values(GRIPS).map((v) => `${v}(${v.length})`).join(' · ')}`);

  // ★ **일곱을 다 뗀 뒤에도** 나와야 한다. 여기가 이번 판의 핵심이다 —
  //   전에는 `lineOf` 가 일곱이 끝나면 영영 null 이라 새 동사를 가르칠
  //   자리가 아예 없었다
  const t = makeTutor();
  while (!allDone(t)) { t.done.push('(건너뜀)'); t.i++; }
  ok(!lineOf(t, 'spot:shop-a'), '일곱이 끝나면 가르침은 안 뜬다 — 그건 그대로다');
  ok(!!gripLine(t, 'spot:shop-a'), '★ 그런데 **손 쓰는 법은 나온다** — 「떼었다 붙인다」');
  ok(!!gripLine(t, 'panel:workshop'), '★ 수리 네 동작도 나온다');
  ok(!gripLine(t, 'yoke'), '일곱이 이미 가르친 것은 두 번 안 말한다 — 조종간');

  // **그치나.** 늘 뜨면 그게 안내판이다
  for (let i = 0; i < GRIP_SHOW; i++) markGrip(t, 'spot:shop-a');
  ok(!gripLine(t, 'spot:shop-a'), `${GRIP_SHOW}번 잡고 나면 그친다 — 늘 뜨면 안내판이다`);
  ok(!!gripLine(t, 'panel:workshop'), '그친 것은 그것 하나뿐 — 손잡이마다 따로 센다');
}

console.log('\n[7] ★ **두 손이 찼을 때 왜 안 잡히는지 말하나**');
{
  // 조용히 안 잡히면 사람은 「어렵다」가 아니라 **「고장났다」**로 읽고,
  // 한 번 그렇게 읽으면 그 뒤로 안 잡아 본다
  const t = makeTutor();
  while (!allDone(t)) { t.done.push('(건너뜀)'); t.i++; }
  const ln = gripLine(t, 'valve', { armsFull: true });
  ok(ln?.text === ARMS_FULL, `밸브를 겨누면 이유를 말한다 — 「${ln?.text ?? '아무 말 없음'}」`);
  ok(ARMS_FULL.length <= TUTOR.maxLen, `${TUTOR.maxLen}자를 안 넘는다 — ${ARMS_FULL.length}자`);
  // **붙이는 자리는 예외다** — 아니면 「붙여 놓으세요」라고 해 놓고
  // 정작 붙이는 자리에서도 같은 말을 한다
  const at = gripLine(t, 'spot:shop-a', { armsFull: true });
  ok(at?.text !== ARMS_FULL, `붙이는 자리에서는 딴말 안 한다 — 「${at?.text ?? '없음'}」`);
  // 셈을 다 채웠어도 이 줄만은 뜬다 — 제일 급한 것이라서
  for (let i = 0; i < GRIP_SHOW + 2; i++) markGrip(t, 'valve');
  ok(gripLine(t, 'valve', { armsFull: true })?.text === ARMS_FULL,
    '여러 번 겪어도 이 줄만은 계속 말한다 — 조용하면 고장으로 읽힌다');
}

// ══════════════════════════════════════════════════════════════════════════
//  여기부터는 **화면**이다 — `--see` 를 줬을 때만 돈다.
//
//  ★ 위의 검사들은 「가르침이 제 차례에 뜬다」까지만 본다. 그런데 이
//    저장소가 반복해서 밟은 함정은 **「코드에는 있는데 화면에는 없다」**
//    이고(창이 창이 아니었던 일 · 크랭크가 벽에 파묻힌 일), 안내 문구는
//    특히 그렇다 — 화면 밖에 그려지거나 배너에 겹쳐도 순수 검사는 초록이다.
//
//    그래서 일곱 줄을 **두 단계씩 열넷** 다 띄워 보고 자리를 잰다.
// ══════════════════════════════════════════════════════════════════════════
const see = process.argv.indexOf('--see');
if (see >= 0) {
  const PORT = process.argv[see + 1] || '8391';
  const SP = process.env.SHOTS || null;
  let chromium = null;
  for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ }
  }
  if (!chromium) { console.error('playwright 가 없습니다.'); process.exit(2); }
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 560 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  await p.mouse.move(480, 280); await p.mouse.click(480, 280);
  await p.evaluate(() => document.getElementById('hint')?.remove());

  console.log('\n[8] ★ 일곱 줄이 **화면에 정말 뜨나** — 두 단계씩 열넷');
  {
    const rows = [];
    for (const k of KEYS) {
      for (const [age, tag] of [[0, '처음'], [13, '12초뒤']]) {
        await p.evaluate(([kk, aa]) => SPACE.teach(kk, aa), [k, age]);
        await p.waitForTimeout(1200);
        rows.push({ k, tag, ...await p.evaluate(() => {
          const el = document.getElementById('lesson');
          if (!el || el.hidden) return { miss: true };
          const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
          return { text: el.textContent, x: Math.round(r.x), y: Math.round(r.y),
            w: Math.round(r.width), h: Math.round(r.height),
            W: innerWidth, H: innerHeight, op: +(+cs.opacity).toFixed(2) };
        }) });
      }
    }
    const miss = rows.filter((r) => r.miss);
    ok(miss.length === 0, `열넷이 다 뜬다 — ${miss.length ? `안 뜬 것: ${miss.map((r) => `${r.k}/${r.tag}`).join(' · ')}` : '빠짐 없음'}`);

    const live = rows.filter((r) => !r.miss);
    // **화면 안에 있나.** 「창이 화면 밖에 그려지고 있었다」는 코드로 못 찾는다
    const out = live.filter((r) => r.x < 0 || r.y < 0 || r.x + r.w > r.W || r.y + r.h > r.H);
    ok(out.length === 0, `다 화면 안에 있다 — ${out.length ? out.map((r) => `${r.k}(${r.x},${r.y})`).join(' · ') : '넘치는 것 없음'}`);

    // **아래쪽**에 있나. 배너(위·주황)와 자리가 갈려야 둘 다 읽힌다
    const high = live.filter((r) => r.y < r.H * 0.6);
    ok(high.length === 0, `다 화면 아래쪽이다 — ${high.length ? high.map((r) => `${r.k}(y=${r.y})`).join(' · ') : `y ${Math.min(...live.map((r) => r.y))}~${Math.max(...live.map((r) => r.y))} / ${live[0].H}`}`);

    // **안 흐리다.** 갓 뜬 줄이 흐리면 그건 안내가 아니라 잔상이다
    const dim = live.filter((r) => r.tag === '처음' && r.op < 0.9);
    ok(dim.length === 0, `갓 뜬 줄은 또렷하다 — ${dim.length ? dim.map((r) => `${r.k}(${r.op})`).join(' · ') : '전부 1.0'}`);

    // **가로로 안 넘친다.** nowrap 이라 긴 줄은 잘리는 게 아니라 밀려난다
    const wide = live.filter((r) => r.w > r.W * 0.7);
    ok(wide.length === 0, `제일 긴 줄이 화면 폭의 ${Math.round(Math.max(...live.map((r) => r.w)) / live[0].W * 100)}% — 70% 이하`);

    for (const r of live) console.log(`     ${r.k.padEnd(7)} ${r.tag.padEnd(6)} 「${r.text}」`);
  }

  console.log('\n[9] 배너와 **겹치지 않나** — 겹치면 둘 다 안 읽는다');
  {
    await p.evaluate(() => SPACE.teach('walk', 0));
    await p.waitForTimeout(1000);
    const two = await p.evaluate(() => {
      const el = document.getElementById('lesson');
      const hud = document.getElementById('hud');
      hud.hidden = false; hud.textContent = '검사용 배너';
      const a = el.getBoundingClientRect(), c = hud.getBoundingClientRect();
      hud.hidden = true;
      return { les: { y: Math.round(a.y), h: Math.round(a.height) },
        hud: { y: Math.round(c.y), h: Math.round(c.height) } };
    });
    const gap = two.les.y - (two.hud.y + two.hud.h);
    ok(gap > 60, `배너와 ${gap}px 떨어져 있다 (배너 y=${two.hud.y} · 가르침 y=${two.les.y})`);
    if (SP) await p.screenshot({ path: `${SP}/가르침.png`, timeout: 90000 });
  }

  if (errs.length) { console.log('콘솔 오류:'); for (const e of errs.slice(0, 5)) console.log('  ' + e); fail += errs.length; }
  await b.close();
  if (SP) console.log(`\n  (${SP}/가르침.png 저장)`);
}

console.log('\n  ※ **자리는 재도 「읽고 싶어지나」는 여기서 안 나온다.**');
console.log('     --see 로 열넷이 화면 어디에 뜨는지까지는 봤다. 그런데 그 줄을');
console.log('     정말 읽게 되는지는 직접 5분 돌려 봐야 안다 (TUTORIAL.md §6).\n');
process.exit(fail ? 1 : 0);
