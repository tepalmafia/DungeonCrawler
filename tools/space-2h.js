// ══════════════════════════════════════════════════════════════════════════
//  2시간 한 번의 여정이 **모양을 갖췄나** — 브라우저 없이.
//
//    node tools/space-2h.js
//
//  ★ 여기서 묻는 것은 「긴장감 있나」가 아니다. 그건 여기서 안 나온다.
//    묻는 것은 **「긴장이 모양을 갖췄나」**다 (PLAN2H §12):
//
//      구간마다 **이름이 있는 장면 하나**가 오고,
//      겹치는 것은 2시간에 **딱 두 번**이다.
//
//    「몇 분마다 이벤트」는 음량이지 설계가 아니다 — 앞 판에서 그걸로
//    한 번 틀렸다 (PLAN2H §0). 그래서 이 도구는 **간격이 아니라 배치**를 본다.
//
//  ★ 그리고 **아직 안 만든 것을 소리 내어 센다.**
//    배치표에는 여덟이 다 적혀 있는데 게임에는 둘뿐이다. 조용히 걸러 내면
//    「12구간이 다 찼다」로 읽히고, 그건 도구가 게임보다 앞서 있는 것이다 —
//    이 저장소가 제일 자주 밟은 함정이라 **줄인 만큼 찍는다.**
// ══════════════════════════════════════════════════════════════════════════
import { SCENES, PLACEMENT, GOALS, BEAT, EMBER, audit } from '../web/space/js/game/scene-table.js';
import { makeScenes, newLeg, stepScene, running, opens, resolve, allowChore, playable, BPHASE }
  from '../web/space/js/game/scene.js';
import { LEG } from '../web/space/js/game/route-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DT = 1 / 4;                       // 0.25초. 두 시간을 세는 데 이 정도면 된다

console.log(`\n2시간 — 구간 ${LEG.count}개 · 장면 ${Object.keys(SCENES).length}종`);

console.log('\n[1] 배치가 **규칙을 지키나** — 여기가 이 판의 전부다');
{
  const a = audit();
  ok(PLACEMENT.length === LEG.count,
    `배치표가 구간 수와 같다 (배치 ${PLACEMENT.length} · 구간 ${LEG.count})`);
  ok(a.scenes === GOALS.scenes, `장면이 ${a.scenes}구간에 있다 (목표 ${GOALS.scenes} — 구간 1 은 배우는 자리)`);
  ok(a.backToBack === GOALS.backToBack,
    `같은 장면이 **이어 붙지 않는다** (${a.backToBack}회) — 붙으면 「또 이거」`);
  ok(a.overlaps === GOALS.overlaps,
    `겹침이 정확히 ${a.overlaps}번 — 흔하면 안 무섭다`);
  const olLegs = PLACEMENT.filter((r) => r.scenes.length > 1).map((r) => r.leg);
  ok(olLegs.join(',') === '9,11', `겹치는 자리는 구간 ${olLegs.join('·')} — 두 막의 절정`);
  console.log('   몇 번씩: ' + Object.entries(a.counts).map(([k, n]) => `${k}×${n}`).join(' '));
  // ★ A 가 **네 번**인 이유는 배치표에 적어 뒀다 (기획서 §5 와 §6 이 갈라져
  //   있었고 §6 을 따랐다). 여기 숫자를 3 으로 두면 검사가 옛 글을 지킨다
  ok(a.counts.A === 4 && a.counts.C === 2, 'A 는 네 번 · C 는 두 번 — 나머지는 한 번씩');
}

console.log('\n[2] 여덟이 **다 다른 방에 묶나** — 세기를 올려선 못 하는 일이다');
{
  const rooms = Object.values(SCENES).map((s) => s.room);
  const uniq = new Set(rooms);
  console.log('   ' + Object.values(SCENES).map((s) => `${s.key}:${s.room}`).join(' '));
  ok(uniq.size >= GOALS.distinctRooms,
    `서로 다른 방 ${uniq.size}곳 (목표 ${GOALS.distinctRooms} 이상)`);
  // C 와 D 는 둘 다 조종석이다 — **일부러**다. 다만 하는 일이 달라야 한다
  ok(SCENES.C.hands !== SCENES.D.hands,
    '조종석을 같이 쓰는 C·D 는 손이 하는 일이 다르다');
  ok(Object.values(SCENES).every((s) => s.lead && s.hands),
    '여덟이 다 「무엇이 오는지」와 「손이 뭘 하는지」를 갖는다');
}

console.log('\n[3] 네 박자가 **정말 그 길이로 도나**');
{
  const legSec = LEG.seconds / 0.85;    // 대략적인 한 구간
  const s = makeScenes('B1');
  newLeg(s, 2);                          // A 가 있는 구간
  const seen = {}; let last = null, t = 0;
  while (t < legSec * 1.6) {
    const ev = stepScene(s, DT, legSec);
    // ★ **계통 노릇을 대신 해 준다.** 5판부터 대응은 저 혼자 안 끝난다 —
    //   「끝내라」는 말을 듣고 계통이 끝내야 해소로 간다. 게임에서는
    //   추격이 뿌리쳐지는 자리이고, 여기서는 그걸 흉내 낸다.
    //   이걸 안 하면 대응이 영영 안 끝나서 「대응 -174초」 같은 값이 나온다
    if (ev === 'act-end') { for (const k of s.keys) resolve(s, k); }
    else if (ev) { if (last) seen[last] = t - (seen[`${last}@`] ?? 0); seen[`${ev}@`] = t; last = ev; }
    if (ev === 'act-end') { seen['clear@'] = t; last = 'clear'; }
    t += DT;
    if (s.phase === BPHASE.DONE && last === 'done') break;
  }
  const dur = (a, b) => +((seen[`${b}@`] ?? 0) - (seen[`${a}@`] ?? 0)).toFixed(0);
  const warn = dur('warn', 'act'), act = dur('act', 'clear');
  const clear = dur('clear', 'after'), after = dur('after', 'done');
  console.log(`   예고 ${warn}초 → 대응 ${act}초 → 해소 ${clear}초 → 여운 ${after}초`);
  const band = (v, [a, b], n) => ok(v >= a - 1 && v <= b + 1, `${n} ${v}초 (목표 ${a}~${b})`);
  band(warn, BEAT.warn, '예고');
  band(act, BEAT.act, '대응');
  band(clear, BEAT.clear, '해소');
  band(after, BEAT.after, '★ 여운');
  ok(s.done.includes('A'), '지나온 장면이 남는다 — 끝 화면이 읽는다');
}

console.log('\n[4] ★ **대응 중에는 잔일이 안 뜬다** — 방해가 아니라 긴장이어야');
{
  const legSec = LEG.seconds / 0.85;
  const s = makeScenes('B2');
  newLeg(s, 2);
  let inAct = 0, choreInAct = 0, t = 0;
  while (t < legSec * 1.6 && s.phase !== BPHASE.DONE) {
    stepScene(s, DT, legSec);
    if (s.phase === BPHASE.ACT) { inAct += DT; if (allowChore(s)) choreInAct += DT; }
    t += DT;
  }
  ok(inAct > 60, `대응 박자가 ${inAct.toFixed(0)}초 돌았다`);
  ok(choreInAct === 0, `그동안 잔일이 열린 시간 ${choreInAct}초 — 0 이어야 한다`);
  // 예고와 여운에는 **낸다** — 예고 때 고장이 있어야 「마치고 갈까」가 생긴다
  const s2 = makeScenes('B3');
  newLeg(s2, 2);
  let openInWarn = 0, tt = 0;
  while (tt < legSec * 1.6 && s2.phase !== BPHASE.DONE) {
    stepScene(s2, DT, legSec);
    if (s2.phase === BPHASE.WARN && allowChore(s2)) openInWarn += DT;
    tt += DT;
  }
  ok(openInWarn > 10, `예고 중에는 잔일이 열려 있다 (${openInWarn.toFixed(0)}초)`);
}

console.log('\n[5] 회차 하나 — **장면 사이 간격**과 손이 노는 자리');
{
  const legSec = LEG.seconds / 0.85;
  const s = makeScenes('B4');
  const marks = [];                     // 장면이 시작된 시각(분)
  let clock = 0;
  for (let leg = 1; leg <= LEG.count; leg++) {
    newLeg(s, leg);
    let t = 0;
    while (t < legSec) {
      const ev = stepScene(s, DT, legSec);
      if (ev === 'warn') marks.push((clock + t) / 60);
      t += DT;
    }
    clock += legSec;
  }
  const gaps = marks.slice(1).map((m, i) => +(m - marks[i]).toFixed(1));
  console.log(`   회차 ${(clock / 60).toFixed(0)}분 · 장면 ${marks.length}개`);
  console.log('   사이 간격(분): ' + gaps.join(' · '));
  const [g0, g1] = GOALS.gap;
  const bad = gaps.filter((g) => g < g0 || g > g1);
  // ★ 아직 만든 장면이 둘뿐이라 **비는 구간이 있다.** 그것까지 통과라고
  //   찍으면 도구가 거짓말을 한다 — 만든 것들 사이만 재고, 몇을 걸렀는지 말한다
  const notYet = playable().flatMap((r) => r.notYet);
  ok(marks.length === playable().filter((r) => r.scenes.length).length,
    `배치된 것 중 **만든 것**만 떴다 (${marks.length}개)`);
  console.log(`   ※ 아직 못 만든 장면 ${notYet.length}구간분: ${[...new Set(notYet)].join('·')} — 그 구간은 빈다`);
  if (notYet.length) {
    console.log(`   ※ 간격 검사는 **다 만든 뒤에** 뜻이 있다 (지금 ${bad.length}군데가 ${g0}~${g1}분 밖)`);
  } else {
    ok(bad.length === 0, `장면 사이가 ${g0}~${g1}분 (${bad.length}군데 벗어남)`);
  }
}

console.log('\n[6] 구간이 부르지 않으면 **그 사건은 안 온다**');
{
  const legSec = LEG.seconds / 0.85;
  const s = makeScenes('B5');
  newLeg(s, 1);                          // 구간 1 — 배우는 자리, 장면 없음
  let any = 0, t = 0;
  while (t < legSec) { stepScene(s, DT, legSec); if (running(s, 'A') || running(s, 'D')) any++; t += DT; }
  ok(any === 0, '구간 1 에서는 아무 장면도 안 돈다 — 배를 익히는 자리다');

  newLeg(s, 5);                          // D 가 있는 구간
  let dOn = 0, aOn = 0; t = 0;
  while (t < legSec) { stepScene(s, DT, legSec); if (running(s, 'D')) dOn++; if (running(s, 'A')) aOn++; t += DT; }
  ok(dOn > 0, `구간 5 에서는 D(잔해밭)가 돈다 (${(dOn * DT).toFixed(0)}초)`);
  ok(aOn === 0, '같은 구간에 A(적)는 안 온다 — 겹침은 9·11 뿐이다');
}

console.log('\n[6b] ★ 네 박자가 **A·D 에 실제로 입혀졌나** (5판)');
{
  const legSec = LEG.seconds / 0.85;
  const s = makeScenes('B6');

  // ① 예고에는 **아직 안 온다.** 「온다」와 「왔다」는 다른 박자다
  newLeg(s, 2);                          // A
  let inWarn = 0, openInWarn = 0, t = 0;
  while (t < legSec && s.phase !== BPHASE.DONE) {
    stepScene(s, DT, legSec);
    if (s.phase === BPHASE.WARN) { inWarn += DT; if (opens(s, 'A')) openInWarn += DT; }
    t += DT;
  }
  ok(inWarn > 10, `예고 박자가 ${inWarn.toFixed(0)}초 돌았다`);
  ok(openInWarn === 0,
    `A 는 예고 중에 **안 붙는다** (${openInWarn.toFixed(0)}초) — 준비할 시간이 있어야 선택이 된다`);

  // ② D 는 **예고부터** 연다 — 잔해는 제 예고(30초)가 곧 장면의 예고다
  const s2 = makeScenes('B7');
  newLeg(s2, 5);
  let dWarn = 0, tt = 0;
  while (tt < legSec && s2.phase !== BPHASE.DONE) {
    stepScene(s2, DT, legSec);
    if (s2.phase === BPHASE.WARN && opens(s2, 'D')) dWarn += DT;
    tt += DT;
  }
  ok(dWarn > 5, `D 는 예고부터 연다 (${dWarn.toFixed(0)}초) — 장면마다 여는 박자가 다르다`);
}

console.log('\n[6c] ★★ **해소는 시계가 아니라 사건이 정한다**');
{
  const legSec = LEG.seconds / 0.85;
  const s = makeScenes('B8');
  newLeg(s, 2);
  while (s.phase !== BPHASE.ACT) stepScene(s, DT, legSec);
  // 대응 한복판에서 뿌리쳤다 — 장면도 같이 끝나야 한다
  let ran = 0;
  while (ran < 30) { stepScene(s, DT, legSec); ran += DT; }
  ok(s.phase === BPHASE.ACT, '아직 대응 중이다');
  const ev = resolve(s, 'A');
  ok(ev === 'clear' && s.phase === BPHASE.CLEAR,
    `뿌리치면 **그 자리에서** 해소로 간다 (${s.phase})`);

  // 반대로 시계가 먼저 끝나면 **계통에게 끝내라고 말한다** — 조용히 넘어가지 않는다
  const s2 = makeScenes('B9');
  newLeg(s2, 2);
  while (s2.phase !== BPHASE.ACT) stepScene(s2, DT, legSec);
  let said = null, t2 = 0;
  while (t2 < BEAT.act[1] + 10 && s2.phase === BPHASE.ACT) {
    const ev = stepScene(s2, DT, legSec);
    if (ev && !said) said = ev;
    t2 += DT;
  }
  ok(said === 'act-end',
    `시계가 다 되면 **끝내라고 말한다** (${said}) — 조용히 넘어가면 장면은 끝났는데 적은 붙어 있다`);
  ok(s2.overdue && s2.phase === BPHASE.ACT,
    '끝날 때까지 **대응에 머문다** — 깃발로 남아서 매 프레임 읽힌다');
  // 계통이 끝내면 그때 해소로
  ok(resolve(s2, 'A') === 'clear' && !s2.overdue, '계통이 끝내면 그제서야 해소다');
}

console.log('\n[6d] ★ **여운이 비어 있지 않나** — 여기가 「시간 가는 줄 모른다」의 자리다');
{
  ok(EMBER.chore, '여운에 일이 하나 온다 — 안 그러면 40~90초 동안 손이 논다');
  ok(EMBER.fromWear, '온 것은 **쌓인 마모**에서 나온다 — 벌은 미뤄지지 없어지지 않는다');
  ok(EMBER.within <= 20,
    `여운이 시작되고 ${EMBER.within}초 안에 온다 — 「손이 쉬는 시간 12초 이하」(§10)`);
}

console.log('\n[7] 아직 못 만든 것을 **소리 내어 센다**');
{
  const a = audit();
  const built = Object.values(SCENES).filter((s) => s.built).map((s) => s.key);
  console.log(`   만든 것 ${built.join('·')} (${built.length}/${Object.keys(SCENES).length})`);
  console.log(`   못 만든 것 ${a.missing.join('·')}`);
  // ★★ **이 두 줄이 낡아 있었다** (v53 에서 발견). 「아직 여섯이 비었다」와
  //   「C 가 다음 판이다」는 2판 때 쓴 말인데, C 는 4판에 지었고 지금
  //   비어 있는 것은 셋(G·E·F)이다. **숫자를 손으로 적으면 반드시 이렇게
  //   된다** — 세는 것은 `audit()` 이 하게 두고, 여기서는 「아직 남았나」만
  //   묻는다. 0 이 되면 그때는 이 절이 「다 지었다」로 바뀌어야 한다
  // ★★ **0 이 됐다 — v62 에 F(감압)를 지으면서 여덟이 다 섰다.**
  //   위 주석이 「0 이 되면 그때는 이 절이 「다 지었다」로 바뀌어야 한다」고
  //   적어 두었고, 그날이 왔다. 여기가 이 저장소가 **미리 적어 둔 대로
  //   고쳐진 첫 자리**다 — 대개는 낡은 줄 모르고 몇 판을 간다.
  console.log(`   빈 자리가 들어가는 구간 — ${a.missing.length}종`);
  ok(a.missing.length === 0,
    a.missing.length
      ? `아직 ${a.missing.length}개가 비었다 (${a.missing.join('·')}) — 빈 자리는 12구간에 구멍을 낸다`
      : '★★ **여덟 장면이 다 섰다** — 12구간에 빈 자리가 없다 (F 는 v62 · 우주복이 생기면서 지어졌다)');
  ok(SCENES.H.built === true,
    '★ H(성간 공백)가 지어졌다 — 8판 · PLAN2H §9. 끝이 있어야 2시간을 한 번 통과해 본다');
}

// ══════════════════════════════════════════════════════════════════════════
//  여기부터는 **실제 배**다 — `--see 8391` 을 줬을 때만 돈다.
//
//  ★ 위 일곱은 표와 규칙만 본다. 표가 아무리 맞아도 `main.js` 가 문을
//    안 열면 화면에서는 아무 일도 안 난다 — 그리고 **이 판이 하는 일이
//    정확히 「문을 여닫는 것」**이라 여기를 안 보면 잰 게 없는 것과 같다.
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
  // ★ **갈래를 고른다.** 거점(PORT)에서는 잔해도 고장도 안 뜬다 — 이걸
  //   빼먹었더니 [9] 가 「구간 5 에서도 안 온다」로 빨개졌고, 원인은
  //   장면 빗장이 아니라 **배가 아직 안 떠났다**는 것이었다.
  //   빗장을 의심하기 전에 배가 가고 있는지부터 본다
  await S(() => { const o = SPACE.route.offer; if (o.length) SPACE.pick(o[0]); });
  const banner = () => S(() => {
    const el = document.getElementById('hud');
    return el && !el.hidden ? el.textContent : null;
  });
  /** 장면이 이 박자에 올 때까지 — 헤드리스는 프레임이 느리므로 **조건으로** 기다린다 */
  const untilPhase = async (want, tries = 40) => {
    for (let i = 0; i < tries; i++) {
      const sc = await S(() => SPACE.scene);
      if (sc.phase === want) return sc;
      await S(() => SPACE.skipBeat());
      await p.waitForTimeout(250);
    }
    return await S(() => SPACE.scene);
  };

  console.log('\n[8] ★ **구간이 장면을 부른다** — 게임 안에서도 그런가');
  {
    let sc = await S(() => SPACE.setLeg(1));
    ok(sc.leg === 1 && sc.keys.length === 0, `구간 1 은 비어 있다 — 배를 익히는 자리 (${JSON.stringify(sc.keys)})`);
    sc = await S(() => SPACE.setLeg(5));
    ok(sc.keys.join() === 'D', `구간 5 는 D(잔해밭) (${sc.keys.join()})`);
    sc = await S(() => SPACE.setLeg(9));
    ok(sc.keys.join() === 'A', `구간 9 는 A+F 인데 F 가 아직 없어 A 만 (${sc.keys.join()})`);
    sc = await S(() => SPACE.setLeg(3));
    ok(sc.keys.length === 0, 'B(행성)는 아직 안 만들었으므로 구간 3 이 빈다 — 조용히 안 채운다');
  }

  console.log('\n[9] ★ **배치가 없는 구간에는 잔해가 안 온다**');
  {
    // 장전만 한다 — 문이 열리나는 frame 이 답한다 (forceHazard 는 빗장을 건너뛴다)
    await S(() => { SPACE.setLeg(3); SPACE.armHazard(); });
    await p.waitForTimeout(1200);
    const off = await S(() => SPACE.fly.phase);
    ok(off === 'idle', `구간 3(장면 없음)에서는 장전해도 안 온다 (${off})`);

    // 구간 5 로 옮기고 장면을 열면 **온다**
    await S(() => { SPACE.setLeg(5); SPACE.seekScene(900); SPACE.armHazard(); });
    let on = 'idle';
    for (let i = 0; i < 25; i++) {
      await p.waitForTimeout(300);
      on = await S(() => SPACE.fly.phase);
      if (on !== 'idle') break;
    }
    ok(on !== 'idle', `구간 5(D 가 있는 구간)에서는 온다 (${on})`);
  }

  console.log('\n[10] ★ **예고가 화면에 뜨나** — 표만 맞고 화면이 조용하면 잰 게 없다');
  {
    await S(() => { SPACE.setLeg(2); SPACE.seekScene(900); });
    const sc = await untilPhase('warn', 12);
    ok(sc.phase === 'warn' || sc.phase === 'act', `예고 박자에 들어갔다 (${sc.phase})`);
    const said = await banner();
    ok(/자국이 굵어집니다/.test(said ?? ''),
      `A 의 예고가 배너로 뜬다 — 「${said ?? '아무 말 없음'}」`);
  }

  console.log('\n[11] ★ **대응 중에는 새 고장이 안 뜬다** — 방해가 아니라 긴장이어야');
  {
    const sc = await untilPhase('act', 12);
    ok(sc.phase === 'act', `대응 박자다 (${sc.phase})`);
    ok(sc.choreOpen === false, '잔일 문이 닫혀 있다 — allowChore(scenes) 가 false');
    // ★ **시계가 실제로 멈추나**를 본다. `forceFault` 는 stepFaults 를 직접
    //   불러서 빗장을 건너뛰므로, 그걸로 재면 검사가 저 혼자 통과한다.
    //   고장은 `faults.next` 가 0 이 되면 뜨는데, 대응 중에는 그게 **안 준다**
    const a = await S(() => SPACE.faults.next);
    await p.waitForTimeout(1500);
    const b2 = await S(() => SPACE.faults.next);
    ok(b2 >= a - 0.05, `대응 중에는 고장 시계가 안 간다 (${a} → ${b2})`);
  }

  console.log('\n[11b] ★ **예고 중에는 아직 안 온다** — 실제 배에서');
  {
    await S(() => { SPACE.setLeg(2); SPACE.resetChase(); SPACE.setHeat(90); SPACE.seekScene(900); });
    // 예고 박자로 들어갈 때까지
    let sc = await S(() => SPACE.scene);
    for (let i = 0; i < 20 && sc.phase !== 'warn'; i++) {
      await p.waitForTimeout(300); sc = await S(() => SPACE.scene);
    }
    ok(sc.phase === 'warn', `예고 박자다 (${sc.phase})`);
    // 열을 90 까지 올려 놨는데도 **예고 중에는 안 붙는다**
    await p.waitForTimeout(2500);
    const c = await S(() => SPACE.chase);
    ok(c.phase === 'calm',
      `열이 90 인데도 예고 중에는 안 붙는다 (${c.phase} · 위험 ${c.risk})`);
  }

  console.log('\n[11c] ★★ **해소가 사건과 같은 순간인가**');
  {
    await S(() => SPACE.skipBeat());     // 대응으로
    let sc = await S(() => SPACE.scene);
    for (let i = 0; i < 20 && sc.phase !== 'act'; i++) {
      await p.waitForTimeout(300); sc = await S(() => SPACE.scene);
    }
    ok(sc.phase === 'act', `대응 박자다 (${sc.phase})`);
    await S(() => SPACE.forceContact());
    await p.waitForTimeout(900);
    ok((await S(() => SPACE.chase)).phase === 'chase', '붙었다');
    // 뿌리친다 — **그 순간** 장면도 해소로 가야 한다
    await S(() => SPACE.setDist(99.9));
    let after = null;
    for (let i = 0; i < 30; i++) {
      await p.waitForTimeout(300);
      after = await S(() => ({ ...SPACE.scene, chase: SPACE.chase.phase }));
      if (after.chase !== 'chase') break;
    }
    ok(after.chase === 'shaken', `뿌리쳤다 (${after.chase})`);
    ok(after.phase === 'clear' || after.phase === 'after',
      `뿌리친 그 순간 장면도 넘어갔다 (${after.phase}) — 시계가 아니라 사건이 정한다`);
  }

  console.log('\n[11d] ★ **여운에 일이 하나 오나** — 손이 노는 유일한 자리');
  {
    // 닳아 있어야 일이 된다 — 장면 동안 부딪힌 셈 치고.
    // ★ 그리고 **손을 비워 둔다** — 열린 고장이 상한(2)에 닿아 있으면
    //   여운은 일부러 안 낸다 (여운이 빈 게 아니라 이미 할 일이 있는 것)
    await S(() => { while (SPACE.fixOne()) { /* 열린 것을 다 치운다 */ } });
    await S(() => SPACE.wearTo({ hull: 0.4, power: 0.3 }));
    let sc = await S(() => SPACE.scene);
    for (let i = 0; i < 30 && sc.phase !== 'after'; i++) {
      await S(() => SPACE.skipBeat());
      await p.waitForTimeout(300); sc = await S(() => SPACE.scene);
    }
    ok(sc.phase === 'after', `여운 박자다 (${sc.phase})`);
    ok(sc.ember > 0, `일이 ${sc.ember}초 뒤에 오기로 예약됐다 (0 이면 여운이 빈다)`);
    ok(sc.ember >= 3, '해소 직후 0초에는 안 낸다 — 「뿌리친 3초」 위에 일을 얹지 않는다');
    const before = await S(() => SPACE.faults.open.length);
    await S(() => SPACE.seekEmber());
    for (let i = 0; i < 25; i++) {
      await p.waitForTimeout(400);
      if ((await S(() => SPACE.scene)).ember === 0) break;
    }
    await p.waitForTimeout(1200);
    const after = await S(() => SPACE.faults.open.length);
    ok(after > before, `여운에 일이 하나 왔다 (${before} → ${after})`);
  }

  console.log('\n[12] 이어하면 **박자 한복판에서 이어지나**');
  {
    const before = await S(() => { SPACE.saveNow(); return SPACE.scene; });
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(2200);
    const after = await S(() => SPACE.scene);
    ok(after.leg === before.leg && after.keys.join() === before.keys.join(),
      `구간과 장면이 그대로다 (${before.leg} · ${before.keys.join()})`);
    ok(after.phase === before.phase,
      `박자도 그대로다 (${before.phase} → ${after.phase}) — 여운 중이었는데 예고부터면 이어한 게 아니다`);
  }

  ok(errs.length === 0, errs.length ? `콘솔 오류 ${errs.length}: ${errs[0]}` : '콘솔 오류 없음');
  await b.close();
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「긴장감 있나」는 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「긴장이 모양을 갖췄나」뿐이다 — 나머지는 직접 2시간 돌려 봐야 한다.');
process.exit(fail ? 1 : 0);
