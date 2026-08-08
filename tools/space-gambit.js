// ══════════════════════════════════════════════════════════════════════════
//  ★★ 승부수 — **쫓길 때의 결심 넷이 성립하나** (v68 · docs/space/GAMBIT.md)
//
//    node tools/space-gambit.js
//
//  ★ 브라우저를 안 쓴다. 순수 규칙이라 2시간을 1초에 돌린다 —
//    「잴 수 있는 것은 표에서 잰다」.
//
//  ★★ 여기서 안 나오는 것: **「고를 만한가」.** 그건 2시간 돌려 봐야 안다.
//    여기서 나오는 것은 「뜨나 · 고루 뜨나 · 다른 것을 파나 · 안 골라도
//    되나 · 깊어질수록 나빠지나」뿐이다.
// ══════════════════════════════════════════════════════════════════════════
import { GAMBITS, GAMBIT, badChance, canOffer } from '../web/space/js/game/gambit-table.js';
import { makeGambit, stepGambit, holdGambit, chaseOver, summary } from '../web/space/js/game/gambit.js';
import { MISSIONS } from '../web/space/js/game/mission-table.js';
import { LEG } from '../web/space/js/game/route-table.js';

/** ★ `MISSIONS` 는 **배열**이다 — 열쇠로 찾으려면 표를 하나 만든다 */
const MBY = Object.fromEntries(Object.values(MISSIONS).map((m) => [m.key, m]));

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };

/** 씨 고정 난수 — 검사가 두 번 돌면 같은 값이 나와야 한다 */
function rng(seed = 7) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

console.log('\n승부수 — 쫓길 때의 결심 넷');
console.log(`   ${GAMBITS.map((g) => `${g.name}(${g.hand})`).join(' · ')}`);

console.log('\n[1] ★★ **표 둘이 안 갈라졌나** — 설계에 있는 것과 같은 열쇠인가');
{
  const miss = GAMBITS.filter((g) => !MBY[g.key]);
  ok(miss.length === 0,
    miss.length ? `설계에 없는 열쇠: ${miss.map((g) => g.key).join('·')}`
      : '넷 다 `mission-table.js` 에 적혀 있던 것이다 — 새로 지어낸 것이 아니다');
  const named = GAMBITS.filter((g) => MBY[g.key].name !== g.name);
  ok(named.length === 0, '이름도 같다 — 표 둘이 갈라지면 「설계에는 있는데 게임에는 없다」가 또 난다');
}

console.log('\n[2] ★★★ **넷이 다른 것을 파나** — 같은 것을 팔면 하나짜리 선택이다');
{
  const sells = GAMBITS.map((g) => g.sells);
  ok(new Set(sells).size === GAMBITS.length,
    `파는 것: ${sells.join(' · ')} — 넷이 다 다르다`);
  const hands = GAMBITS.map((g) => g.hand);
  ok(new Set(hands).size === GAMBITS.length,
    `손잡이: ${hands.join(' · ')} — 넷이 다 다르다 (한 손이 둘을 하면 어느 쪽인지 모른다)`);
}

console.log('\n[3] ★★ **새 손잡이를 안 만들었나** — 이미 있던 손인가');
{
  // `main.js` 의 조준 이름들. 여기 없는 이름을 쓰면 **새로 만든 것**이다
  const HAVE = new Set(['hatch', 'yoke', 'breakers', 'winch', 'valve', 'radio', 'suit', 'outer']);
  const made = GAMBITS.filter((g) => !HAVE.has(g.hand));
  ok(made.length === 0,
    made.length ? `새로 만든 손: ${made.map((g) => g.hand).join('·')}`
      : '넷 다 **이미 있던 손잡이**다 — 배울 것이 없다');
}

console.log('\n[4] ★★★ **추격 한 번에 몇 번 뜨나** — 늘 뜨면 추격이 메뉴가 된다');
{
  const rnd = rng(11);
  let chases = 0, offers = 0;
  for (let c = 0; c < 400; c++) {
    const g = makeGambit();
    g.since = GAMBIT.gapMin;                    // 추격 시작 때는 걸 수 있다
    const len = 90 + rnd() * 90;                // 추격 하나 90~180초
    for (let t = 0; t < len; t += 0.5) {
      const ev = stepGambit(g, 0.5, { chasing: true, ore: 40, hazard: rnd() < 0.25, rnd });
      if (ev === 'offer') { offers++; g.on = null; g.live = 0; g.since = 0; }
    }
    chaseOver(g);
    chases++;
  }
  const per = offers / chases;
  console.log(`   추격 ${chases}번에 ${offers}번 — 한 번에 ${per.toFixed(2)}회`);
  ok(per >= 0.7 && per <= 1.6,
    `추격 한 번에 **${per.toFixed(2)}회** (0.7~1.6) — 늘 뜨면 「고르는 화면」이 되고, 안 뜨면 없는 것과 같다`);
}

console.log('\n[5] ★★ **넷이 고루 뜨나** — 하나가 절반을 넘으면 나머지는 장식이다');
{
  const rnd = rng(23);
  const seen = {};
  for (let c = 0; c < 900; c++) {
    const g = makeGambit();
    g.since = GAMBIT.gapMin;
    g.calmT = GAMBIT.calmEvery;
    const chasing = c % 4 !== 0;               // 넷 중 셋은 쫓기는 중
    for (let t = 0; t < 160; t += 0.5) {
      const ev = stepGambit(g, 0.5, { chasing, ore: 40, hazard: rnd() < 0.35, rnd });
      if (ev === 'offer') { seen[g.on.key] = (seen[g.on.key] ?? 0) + 1; g.on = null; g.live = 0; g.since = 0; }
    }
  }
  const total = Object.values(seen).reduce((a, v) => a + v, 0);
  for (const g of GAMBITS) {
    const n = seen[g.key] ?? 0;
    console.log(`   ${g.name.padEnd(7)} ${String(n).padStart(4)}  ${((n / total) * 100).toFixed(0)}%`);
  }
  ok(Object.keys(seen).length === GAMBITS.length, '넷이 다 나온다 — 한 번도 안 나오는 것은 없는 것이다');
  const top = Math.max(...GAMBITS.map((g) => (seen[g.key] ?? 0) / total));
  ok(top <= 0.45, `제일 많이 나오는 것이 ${(top * 100).toFixed(0)}% (45% 이하)`);
}

console.log('\n[6] ★ **안 골라도 되나** — 강제하면 그건 선택이 아니라 시험이다');
{
  const g = makeGambit();
  g.since = GAMBIT.gapMin;
  const rnd = () => 0;                         // 무조건 뜬다
  stepGambit(g, 0.5, { chasing: true, ore: 40, rnd });
  ok(!!g.on, `뜬다 — ${g.on?.name}`);
  let gone = null;
  for (let t = 0; t < GAMBIT.live + 4 && !gone; t += 0.5) {
    gone = stepGambit(g, 0.5, { chasing: true, ore: 40, rnd }) === 'gone' ? true : null;
  }
  ok(gone === true, `${GAMBIT.live}초 안에 안 잡으면 **사라진다** — 안 골라도 된다`);
}

console.log('\n[7] ★★ **잡고 있어야 결판이 난다** — 딸깍이면 결심이 아니다');
{
  const g = makeGambit();
  g.since = GAMBIT.gapMin;
  stepGambit(g, 0.5, { chasing: true, ore: 40, rnd: () => 0 });
  const need = g.on.hold;
  let out = null;
  for (let t = 0; t < need - 0.6; t += 0.2) out = holdGambit(g, 0.2, { holding: true, rnd: () => 0.99 });
  ok(out === null, `${need}초를 다 안 잡으면 아무 일도 안 난다`);
  out = holdGambit(g, 0.8, { holding: true, rnd: () => 0.99 });
  ok(!!out && out.good, `다 잡으니 결판이 난다 — 「${out?.what}」`);
  // 놓으면 되감긴다
  const g2 = makeGambit();
  g2.since = GAMBIT.gapMin;
  stepGambit(g2, 0.5, { chasing: true, ore: 40, rnd: () => 0 });
  holdGambit(g2, 1.0, { holding: true });
  const a = g2.held;
  holdGambit(g2, 1.0, { holding: false });
  ok(g2.held < a, `놓으면 되감긴다 (${a.toFixed(1)} → ${g2.held.toFixed(1)}) — 붙들고 있어야 한다`);
}

console.log('\n[8] ★★ **깊어질수록 나빠지나** — 뒤로 갈수록 값이 올라야 한다');
{
  for (const g of GAMBITS) {
    const a = badChance(g, 0), b = badChance(g, LEG.count - 1);
    console.log(`   ${g.name.padEnd(7)} ${(a * 100).toFixed(0)}% → ${(b * 100).toFixed(0)}%`);
    ok(b > a + 0.05, `${g.name} — 마지막 구간에서 더 나쁘다`);
  }
}

console.log('\n[9] ★ **판이 안 갖춰지면 안 뜬다** — 빈손으로 「버리기」가 뜨면 놀리는 것이다');
{
  const jet = GAMBITS.find((x) => x.key === 'jettison');
  ok(!canOffer(jet, { chasing: true, ore: 0 }), '광석이 없으면 「버리기」가 안 뜬다');
  ok(canOffer(jet, { chasing: true, ore: 40 }), '광석이 있으면 뜬다');
  const deb = GAMBITS.find((x) => x.key === 'intoDebris');
  ok(!canOffer(deb, { chasing: true, hazard: false }), '잔해밭이 없으면 「끌고 들어가기」가 안 뜬다');
  const bait = GAMBITS.find((x) => x.key === 'othersBait');
  ok(!canOffer(bait, { chasing: true }), '쫓기는 중에는 「남의 미끼」가 안 뜬다 — 평온할 때의 것이다');
  ok(canOffer(bait, { chasing: false }), '평온하면 뜬다');
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「고를 만한가」는 여기서 안 나온다.** 그건 2시간 돌려 봐야 안다.');
process.exit(fail ? 1 : 0);
