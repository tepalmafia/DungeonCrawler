// ══════════════════════════════════════════════════════════════════════════
//  튜토리얼 — **일곱을 다 만나나. 하나씩 만나나.** 브라우저 없이.
//
//    node tools/space-tutor.js
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
import { TUTOR, LESSONS, KEYS } from '../web/space/js/game/tutor-table.js';
import { makeTutor, stepTutor, lineOf, nowKey, allDone, canFire } from '../web/space/js/game/tutor.js';
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
    heat: 12, flips: 0, coolFor: 0,
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
  // 추진을 켜고 가면 열이 오른다 (아주 굵게)
  if (w.forkPicked > 0) {
    w.heat = Math.min(100, w.heat + (w.coolFor > 0 ? -3.4 : 1.1) * dt);
    w.coolFor = Math.max(0, w.coolFor - dt);
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
  if (key === 'power') w.flips++;
  if (key === 'valve') w.coolFor = 26;
  if (key === 'fault') { w.faultsFixed++; w.faultsOpen = 0; }
  if (key === 'fly') w.dodged++;
  if (key === 'supply') w.loads++;
}

function snap(w) {
  return {
    walked: w.walked, turned: w.turned, atPort: w.atPort, forkPicked: w.forkPicked,
    heat: w.heat, flips: w.flips, coolFor: w.coolFor,
    faultsOpen: w.faultsOpen, faultsFixed: w.faultsFixed,
    hazardSeen: w.hazardSeen, dodged: w.dodged,
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

console.log('\n  ※ **읽히나는 여기서 안 나온다.** 화면 아래 한 줄이 눈에 들어오는지는');
console.log('     tools/space-chase.js 가 실제 브라우저에서 보고, 「읽고 싶어지나」는');
console.log('     직접 해 봐야 안다 (TUTORIAL.md §6).\n');
process.exit(fail ? 1 : 0);
