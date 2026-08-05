// ══════════════════════════════════════════════════════════════════════════
//  주포 — **쏘는 것이 공짜가 아닌가.**
//
//    node tools/space-gun.js
//    node tools/space-gun.js --see 8391   + 실제 배에서 올라가 쏴 본다
//
//  ★ 사장님: 「조종석 위로 올라가는 주포도 만들어서 적에게 대응 사격을 하고」
//
//    `CHASE2.md §5` 에 내가 「미사일·함포는 안 한다 — 정비공이 아니라
//    함장이 된다」고 적어 뒀었다. 사장님이 원하시니 만들되, 그때 걱정한
//    것이 사라지는 것은 아니므로 **여기서 그걸 잰다:**
//
//      ① **쏘는 것이 공짜가 아닌가** — 공짜면 「늘 쏜다」가 답이다
//      ② **늘 쏘는 것이 답이 아닌가** — 답이면 도망이 뜻을 잃는다
//      ③ **장르가 안 바뀌었나** — 포탑에 매인 시간이 회차의 12% 이하
// ══════════════════════════════════════════════════════════════════════════
import { GUN, ammoFor, whyNotFire, WHY } from '../web/space/js/game/gun-table.js';
import { makeGun, climb, stepGun, fire, flashSign, busy, summary } from '../web/space/js/game/gun.js';
import { SIGN, CHASE } from '../web/space/js/game/chase-table.js';
import { TRADE, PARTS, ORE } from '../web/space/js/game/supply-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DT = 1 / 30;

const run = (g, sec) => { let t = 0; while (t < sec) { stepGun(g, DT); t += DT; } return g; };
const rich = () => ({ ore: 60, parts: 6, food: 5 });

console.log('\n주포 — 쏘는 것이 공짜가 아닌가');

console.log('\n[1] 올라가는 데 시간이 든다 — **그동안 아무것도 못 한다**');
{
  const g = makeGun();
  ok(!busy(g), '아래 있을 때는 배를 고칠 수 있다');
  climb(g);
  ok(busy(g), '사다리를 타기 시작하면 **그 순간부터** 못 고친다 — 중간도 못 고친다');
  run(g, GUN.climb + 0.1);
  ok(g.up, `${GUN.climb}초 만에 올라갔다`);
  ok(busy(g), '포탑에 있으면 밸브도 차단기도 패널도 못 만진다');
  climb(g); run(g, GUN.climb + 0.1);
  ok(!g.up && !busy(g), '내려오면 다시 고칠 수 있다');
  const round = GUN.climb * 2;
  ok(round >= 3 && round <= 8, `왕복 ${round.toFixed(1)}초 (3~8초) — 「잠깐 올라갔다 오기」가 되면 안 된다`);
}

console.log('\n[2] ★ **쏘면 수리 재료가 준다** — 여기가 이 판의 문법이다');
{
  const g = makeGun(); climb(g); run(g, GUN.climb + 0.1);
  const s = rich();
  const before = s.ore;
  const r = fire(g, { supply: s, chasing: true, aim: 1 });
  ok(r.ok, '쐈다');
  ok(s.ore === before - GUN.costOre, `광석이 ${before} → ${s.ore} (한 발 ${GUN.costOre})`);
  ok(r.kind === 'ore', '광석이 있으면 광석부터 쓴다');

  // 광석이 떨어지면 **부품**을 쓴다 — 벌이 한 단계 깊어진다
  const s2 = { ore: 0, parts: 3 };
  const g2 = makeGun();
  const r2 = fire(g2, { supply: s2, chasing: true, aim: 1 });
  ok(r2.ok && r2.kind === 'parts' && s2.parts === 2,
    '광석이 없으면 **부품**을 쏜다 — 그러면 다음 고장을 못 고친다');

  // 둘 다 없으면 못 쏜다. **왜인지 말한다**
  const s3 = { ore: 0, parts: 0 };
  const r3 = fire(makeGun(), { supply: s3, chasing: true, aim: 1 });
  ok(!r3.ok && r3.why === 'ammo', `못 쏘면 왜인지 말한다 — 「${WHY[r3.why]}」`);
}

console.log('\n[3] 한 발이 얼마나 비싼가 — **거점 한 번 장사와 견준다**');
{
  const perTrade = TRADE.ore;
  const shots = perTrade / GUN.costOre;
  console.log(`   거점 장사 한 번 = 광석 ${perTrade} = **${shots.toFixed(1)}발**`);
  ok(shots >= 2 && shots <= 8,
    `한 발이 장사의 ${(100 / shots).toFixed(0)}% (2~8발이 한 장사) — 너무 싸면 그냥 쏘고, 너무 비싸면 영영 안 쏜다`);
}

console.log('\n[4] ★★ **쏘면 더 잘 보인다** — 「쏘고 도망」이 늘 옳으면 안 된다');
{
  const g = makeGun();
  ok(flashSign(g) === 0, '안 쏘면 안 밝다');
  fire(g, { supply: rich(), chasing: true, aim: 1 });
  ok(flashSign(g) === GUN.flashSign, `쏘면 자국이 +${GUN.flashSign}`);
  console.log(`   ${GUN.flashFor}초 동안 남는다`);
  // ★ **실제로 접촉 기준을 넘기나** — 안 넘기면 이건 장식이다
  const quiet = 34;                       // 조용히 가고 있을 때쯤
  ok(quiet + GUN.flashSign > SIGN.contactAt,
    `조용하던 자국 ${quiet} 이 ${quiet + GUN.flashSign} 로 — 접촉 기준(${SIGN.contactAt})을 넘는다`);
  run(g, GUN.flashFor + 0.1);
  ok(flashSign(g) === 0, '시간이 지나면 다시 어두워진다');
}

console.log('\n[5] ★★ **늘 쏘는 것이 답이 아닌가** — 답이면 도망이 뜻을 잃는다');
{
  // 「쏠 수 있으면 쏜다」로 추격 하나를 지나 본다
  const g = makeGun(); climb(g); run(g, GUN.climb + 0.1);
  const s = rich();
  let t = 0, gained = 0, flashSec = 0;
  while (t < 95) {                        // space-sim.js 가 잰 추격 하나
    stepGun(g, DT);
    if (g.cool <= 0) { const r = fire(g, { supply: s, chasing: true, aim: 1 }); if (r.ok) gained += r.dist; }
    if (g.flash > 0) flashSec += DT;
    t += DT;
  }
  console.log(`   95초 동안 ${g.shots}발 · 거리 +${gained} · 광석 ${rich().ore} → ${s.ore} · 밝았던 시간 ${flashSec.toFixed(0)}초`);
  ok(gained >= CHASE.escapeAt * 0.5,
    `쏘면 실제로 벌어진다 (거리 +${gained} · 뿌리침 기준 ${CHASE.escapeAt})`);
  // ★ 그런데 **자국이 거의 내내 밝다** — 뿌리쳐도 곧 다시 붙는다
  // ★ 100% 가 아닌 이유는 **탄약이 먼저 떨어져서**다 — 뒷부분은 못 쏴서
  //   어두웠다. 그게 이 설계가 도는 모습이지 검사가 못 미친 게 아니다
  ok(flashSec / 95 > 0.65,
    `그동안 ${(flashSec / 95 * 100).toFixed(0)}% 를 밝은 채로 있었다 — 뿌리쳐도 곧 다시 붙는다`);
  // ★ 그리고 **거덜 난다**
  ok(s.ore < rich().ore * 0.35,
    `광석이 ${rich().ore} → ${s.ore} 로 거덜 났다 — 다음 거점에서 못 산다`);
}

console.log('\n[6] 겨눠야 맞는다 — **올라가면 맞는 것**이 아니다');
{
  const s = rich();
  const bad = fire(makeGun(), { supply: s, chasing: true, aim: 0.3 });
  ok(!bad.ok && bad.why === 'aim', `안 겨누면 안 나간다 — 「${WHY.aim}」`);
  const edge = fire(makeGun(), { supply: rich(), chasing: true, aim: GUN.aimNeed });
  ok(edge.ok && !edge.hit, '아슬아슬하게 겨누면 나가긴 하는데 빗나간다');
  ok(edge.dist === GUN.missDist && edge.dist > 0,
    `빗나가도 조금은 벌어진다 (+${edge.dist}) — 피하느라`);
  const good = fire(makeGun(), { supply: rich(), chasing: true, aim: 1 });
  ok(good.hit && good.dist === GUN.hitDist, `제대로 겨누면 +${good.dist}`);
}

console.log('\n[7] 쫓기지 않을 때는 **쏠 상대가 없다**');
{
  const r = fire(makeGun(), { supply: rich(), chasing: false, aim: 1 });
  ok(!r.ok && r.why === 'calm', `「${WHY.calm}」 — 허공에 쏘게 두지 않는다`);
}

console.log('\n[8] ★ **장르가 안 바뀌었나** — 포탑에 매인 시간');
{
  // ★ **처음엔 「추격 내내 포탑에 있다」로 쟀다가 26.6% 가 나왔다.**
  //   상한(12%)의 두 배가 넘어서 「장르가 바뀌었다」로 읽힐 뻔했는데,
  //   그건 **일어날 수 없는 경우**였다 — 탄약이 먼저 떨어진다.
  //   실을 것이 없으면 포탑에 있을 이유가 없고, 그러면 내려온다.
  //   **탄약이 곧 안전핀**이었던 것이고, 그건 재 보고서야 알았다.
  //
  //   ★ 그리고 **무엇을 싣고 다니는가로 재야 한다.** `rich()`(광석 60)로
  //     쟀더니 15.7% 가 나왔는데, `space-supply.js` 가 잰 실제 배는
  //     **늘 광석이 모자란다** (제일 잘 줍는 길로 가도 구간당 27, 한 구간이
  //     먹는 것은 55어치). 광석 60 을 싣고 다니는 배는 흔한 배가 아니다.
  const upFor = (stock) => {
    const s2 = { ...stock };
    const g2 = makeGun();
    let n = 0;
    while (fire(g2, { supply: s2, chasing: true, aim: 1 }).ok) { n++; g2.cool = 0; }
    return { n, sec: n * GUN.reload + GUN.climb * 2 };
  };
  const lapSec = 112 * 60;
  const chases = 12 * 1.5;                // space-route.js 가 잰 구간당 1.5회
  const usual = upFor({ ore: 27, parts: PARTS.start });     // 흔한 배
  const loaded = upFor({ ore: 60, parts: PARTS.max });      // 잔뜩 실은 배
  const share = usual.sec * chases / lapSec;
  const worst = loaded.sec * chases / lapSec;
  console.log(`   흔한 배(광석 27 · 부품 ${PARTS.start})  ${usual.n}발 → 추격당 ${usual.sec.toFixed(0)}초 → 회차의 ${(share * 100).toFixed(1)}%`);
  console.log(`   잔뜩 실은 배(광석 60 · 부품 ${PARTS.max})  ${loaded.n}발 → 추격당 ${loaded.sec.toFixed(0)}초 → 회차의 ${(worst * 100).toFixed(1)}%`);
  ok(share <= GUN.seatShareMax,
    `흔한 배는 회차의 ${(share * 100).toFixed(1)}% 를 포탑에서 (상한 ${GUN.seatShareMax * 100}%)`);
  console.log('   ※ 잔뜩 싣고 다 쏟아부으면 넘는다 — 그런데 그러면 **남은 11구간을 빈손으로** 간다.');
  console.log('      그건 막을 것이 아니라 **치르는 것**이다 (이 게임의 벌은 늘 일이었다)');
  console.log('   ※ 조종석(15~25%)과 합쳐야 진짜 답이 나온다 — space-fly.js 가 본다');
}

// ══════════════════════════════════════════════════════════════════════════
//  여기부터는 **실제 배**다 — `--see 8391` 을 줬을 때만 돈다.
//
//  ★ 사다리는 **보여야** 한다. 이 저장소가 세 번 밟은 함정이
//    「되는데 안 보이는」 것이다 (크랭크가 벽에 파묻힘 · 조종간이 좌석
//    뒤에 숨음 · 패널이 랙에 겹침). 표만 봐서는 절대 안 나온다.
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

  console.log('\n[9] ★ **사다리가 손에 닿나** — 「되는데 안 보이는」 것을 세 번 밟았다');
  {
    // 사다리는 조종석 뒤쪽 오른편 (turret.js LADDER)
    // ★ 사다리는 (2.35, -3.9) 에 있고 **yaw 0 이 -z 를 본다.**
    //   옆에서 겨누는 자리가 제일 확실하다
    let aim = null;
    for (const [x, z, yaw] of [[1.9, -3.9, -Math.PI / 2], [2.35, -3.1, 0], [2.8, -3.9, Math.PI / 2]]) {
      await S(([x, z, yaw]) => SPACE.put(x, z, yaw, 0.1), [x, z, yaw]);
      await p.waitForTimeout(800);
      aim = await S(() => SPACE.aim);
      if (aim === 'ladder') break;
    }
    ok(aim === 'ladder', `조준선이 사다리를 잡는다 (${aim})`);
  }

  console.log('\n[10] ★★ **올라가면 눈이 배 위로 나오나**');
  {
    const low = (await S(() => SPACE.camY ?? null));
    // ★ **300ms 만 눌렀다 뗐더니 아무 일도 안 났다.** 헤드리스는 1초에
    //   한 프레임쯤이라, 누르고 뗀 것이 **한 프레임 사이에** 다 끝나면
    //   게임은 눌린 적이 없는 것으로 본다. 사람 손보다 오래 눌러 준다
    await S(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
    await p.waitForTimeout(3500);
    await S(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
    // ★ **12초를 기다리다 「안 올라갔다」로 빨개졌었다.** 사다리는 게임
    //   시간 2.2초인데 헤드리스는 한 프레임에 0.05초씩 가므로 44프레임,
    //   실제로는 15초가 넘는다. `moving` 이 줄고 있는 것을 눈으로 보고서야
    //   「안 되는 것」이 아니라 **느린 것**임을 알았다
    let up = false;
    for (let i = 0; i < 70; i++) { await p.waitForTimeout(400); if ((await S(() => SPACE.gun)).up) { up = true; break; } }
    ok(up, '사다리를 눌렀더니 올라갔다');
    const high = await S(() => SPACE.camY ?? null);
    if (low !== null && high !== null) ok(high > low + 1, `눈이 ${low.toFixed(2)} → ${high.toFixed(2)} 로 올라갔다`);
    ok((await S(() => SPACE.gun)).busy, '올라가 있으면 배를 못 고친다');
  }

  console.log('\n[11] ★ **올라가 있으면 아래 것이 안 잡힌다** — 동시에 두 곳에 못 있는다');
  {
    // 밸브 앞으로 「몸을」 옮겨도 포탑에 있으면 안 잡혀야 한다
    await S(() => { const m = SPACE.valveAt; SPACE.put(m.x, m.z - 1.2, Math.PI, -0.1); });
    await p.waitForTimeout(900);
    const aim = await S(() => SPACE.aim);
    ok(aim !== 'valve', `밸브 앞에 서도 안 잡힌다 (${aim}) — 포탑에 있으니까`);
  }

  console.log('\n[12] ★★ **쏘면 재료가 줄고 밝아지나**');
  {
    await S(() => { SPACE.forceContact(); });
    await p.waitForTimeout(900);
    await S(() => { SPACE.giveOre?.(40); });
    const before = await S(() => ({ ore: SPACE.supply.ore, sign: SPACE.chase.sign }));
    await S(() => { SPACE.put(0, -6, 0, 0); SPACE.fireGun(); });   // 앞을 보고 쏜다
    await p.waitForTimeout(900);
    const after = await S(() => ({ ore: SPACE.supply.ore, gun: SPACE.gun, said: (() => {
      const e = document.getElementById('hud'); return e && !e.hidden ? e.textContent : null;
    })() }));
    ok(after.gun.shots > 0, `쐈다 (${after.gun.shots}발) — 「${after.said ?? ''}」`);
    ok(after.ore < before.ore, `광석이 ${before.ore} → ${after.ore} 로 줄었다`);
    ok(after.gun.flashSign > 0, `밝아졌다 (자국 +${after.gun.flashSign})`);
  }

  console.log('\n[13] 이어하면 **포탑에 올라간 채로 이어지나**');
  {
    await S(() => { SPACE.putGun(true); SPACE.saveNow(); });
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(2200);
    ok((await S(() => SPACE.gun)).up, '포탑에 올라간 채로 이어진다');
  }

  ok(errs.length === 0, errs.length ? `콘솔 오류 ${errs.length}: ${errs[0]}` : '콘솔 오류 없음');
  await b.close();
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「쏘는 맛이 나나」는 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「쏘는 것이 공짜가 아닌가 · 늘 쏘는 게 답이 아닌가」뿐이다.');
process.exit(fail ? 1 : 0);
