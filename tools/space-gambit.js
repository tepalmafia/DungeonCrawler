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
//
//  ══ ★★★ v150 — **잴 것이 없으면 통과가 아니라 「측정 불가」다** ═════════
//
//  ★ 이 검사도 `space-screen.js` 와 같은 병을 앓고 있었다. 판정 셋이
//    **「없어야 한다」 꼴**이고 ([1] 두 곳 · [3] 한 곳), 나머지는
//    **`GAMBITS` 를 훑어서** 잰다 ([2] 의 `Set` 크기 · [5] 의 「넷이 다
//    나오나」 · [8] 의 반복문).
//
//    그래서 **`GAMBITS` 를 통째로 비우면** 이렇게 된다:
//
//      [1] `miss.length === 0`            → 훑을 것이 없으니 **참**
//      [2] `new Set([]).size === 0`       → 0 === 0 이라 **참**
//      [3] `made.length === 0`            → **참**
//      [5] `Object.keys(seen).length === GAMBITS.length` → 0 === 0 **참**
//          `Math.max(...[])` 는 `-Infinity` 라 `top <= 0.45` 도 **참**
//      [8] 반복문이 한 번도 안 돌아 **판정 자체가 사라진다**
//
//    승부수가 하나도 없는데 「넷이 고루 뜬다」·「넷이 다른 것을 판다」가
//    초록으로 찍힌다. **불량품 상자가 비었다고 불량이 없는 것이 아니다.**
//
//  ★★ 그리고 비었을 때 [9] 는 `GAMBITS.find(...)` 가 `undefined` 를 주어
//    `canOffer` 안에서 **TypeError** 로 터졌다. 터지는 것은 안 터지는 것보다
//    낫지만, 그건 「못 쟀다」가 아니라 「도구가 고장 났다」로 읽힌다 —
//    답이 셋(합격·불합격·못 쟀다)인데 넷째가 생기는 셈이라 `must` 로 옮겼다.
//
//  ★ 「어떻게 멈추나」는 `tools/unmeasured.js` 한 곳에 있다. 여기서 하는
//    일은 **제 목록을 넘기는 것**뿐이다 (도구마다 적으면 어느 날 하나가
//    `exit(0)` 으로 조용히 죽는다).
// ══════════════════════════════════════════════════════════════════════════
import { GAMBITS, GAMBIT, BY_KEY, badChance, canOffer } from '../web/space/js/game/gambit-table.js';
import { makeGambit, stepGambit, holdGambit, chaseOver, summary } from '../web/space/js/game/gambit.js';
import { MISSIONS } from '../web/space/js/game/mission-table.js';
import { LEG } from '../web/space/js/game/route-table.js';
import { measuring } from './unmeasured.js';

/** ★ `MISSIONS` 는 **배열**이다 — 열쇠로 찾으려면 표를 하나 만든다 */
const MBY = Object.fromEntries(Object.values(MISSIONS).map((m) => [m.key, m]));

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };

//  ★★ 재는 것이 **한 가지가 아니다.** 주로 세는 것은 승부수지만,
//    [1] 은 `mission-table.js` 라는 **딴 표**를 견주고 [4]·[6]·[7] 은
//    `GAMBIT` 의 **값 하나하나**(gapMin · live)를 밟는다. 이름이 하나뿐이면
//    「**승부수** 「gapMin」 를 못 읽었습니다」 같은 틀린 말이 나가므로
//    `must.as()` 로 나눠 부른다
const must = measuring({
  tool: 'space-gambit',
  what: '승부수',
  weak: '이 검사는 **`GAMBITS` 를 훑어서** 잽니다 —\n'
    + '「없어야 한다」 꼴이 셋([1] 둘 · [3] 하나)이고,\n'
    + '나머지는 반복문·`Set` 크기·`Math.max` 로 셉니다.\n'
    + '그래서 **표가 비면 [1][2][3][5] 가 저절로 참**이 되고\n'
    + '[8] 은 반복문이 안 돌아 **판정 자체가 사라집니다.**\n'
    + '승부수가 0 개인데 「넷이 고루 뜬다」가 초록으로 찍힙니다.',
  look: '`web/space/js/game/gambit-table.js` 의 `GAMBITS` · `GAMBIT`',
});

/** 씨 고정 난수 — 검사가 두 번 돌면 같은 값이 나와야 한다 */
function rng(seed = 7) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

console.log('\n승부수 — 쫓길 때의 결심 넷');
console.log(`   ${GAMBITS.map((g) => `${g.name}(${g.hand})`).join(' · ')}`);

//  ★★★ 순수 도구라 `finally` 가 없다. 그래도 모양은 브라우저 도구와 같다 —
//    **던지고 · 담고 · 마지막 줄 앞에서 끝낸다.** 합격/불합격 줄을 찍기
//    **전에** `bail()` 을 불러야 「✔ 전부 통과」가 먼저 나가는 일이 없다
try {
  //  ★★★ 여기가 이 파일의 문지기다. 아래 여덟 절이 전부 이 목록을 훑으므로,
  //    비어 있으면 **어느 절도 잰 것이 없다**
  must.some(GAMBITS, '승부수 표를 읽었는데');
  //  ★ `mission-table.js` 쪽도 같이 본다 — [1] 의 둘째 판정이 `MBY[g.key].name`
  //    을 읽는데, 저쪽 표가 비면 첫 판정이 먼저 빨개진 뒤 **둘째에서 터진다.**
  //    「빨간 뒤에 터진다」는 사람이 원인을 두 번 찾게 만든다
  must.as('표').some(Object.keys(MBY), '`mission-table.js` 를 읽었는데');

  console.log('\n[1] ★★ **표 둘이 안 갈라졌나** — 설계에 있는 것과 같은 열쇠인가');
  {
    const miss = GAMBITS.filter((g) => !MBY[g.key]);
    ok(miss.length === 0,
      miss.length ? `설계에 없는 열쇠: ${miss.map((g) => g.key).join('·')}`
        : '넷 다 `mission-table.js` 에 적혀 있던 것이다 — 새로 지어낸 것이 아니다');
    const named = GAMBITS.filter((g) => MBY[g.key] && MBY[g.key].name !== g.name);
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
    //  ★ `gapMin` 이 없어지면 `g.since = undefined` 가 되어 **아무것도 안 뜨고**,
    //    그러면 「0.95회」가 「0회」로 바뀌어 **게임이 고장 난 것처럼** 보인다.
    //    구멍이 없어진 것과 게임이 나빠진 것은 다른 답이라야 한다
    must.as('값').value(GAMBIT.gapMin, 'gapMin', '[4] 추격 횟수를 재려는데');
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
    must.as('값').value(GAMBIT.calmEvery, 'calmEvery', '[5] 고루 뜨나를 재려는데');
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
    must.as('값').value(GAMBIT.live, 'live', '[6] 사라지나를 재려는데');
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
    //  ★★ 여기서 아무것도 안 떴는데 `g.on.hold` 를 읽으면 **TypeError** 다.
    //    「잡고 있어야 결판이 나나」는 **뜬 것이 있어야** 물을 수 있는 질문이라,
    //    안 뜬 것은 불합격이 아니라 **못 쟀다**로 끝내는 것이 맞다
    must.value(g.on, '뜬 것', '[7] 잡는 시간을 재려는데');
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
    //  ★ 이 절은 **반복문이 판정 전부**다. `GAMBITS` 가 비면 `ok` 가 한 번도
    //    안 불려 「아무 말도 안 하고 통과」한다 — 위의 `must.some` 이 그 자리다
    must.as('값').value(LEG.count, 'LEG.count', '[8] 구간 깊이를 재려는데');
    for (const g of GAMBITS) {
      const a = badChance(g, 0), b = badChance(g, LEG.count - 1);
      console.log(`   ${g.name.padEnd(7)} ${(a * 100).toFixed(0)}% → ${(b * 100).toFixed(0)}%`);
      ok(b > a + 0.05, `${g.name} — 마지막 구간에서 더 나쁘다`);
    }
  }

  console.log('\n[9] ★ **판이 안 갖춰지면 안 뜬다** — 빈손으로 「버리기」가 뜨면 놀리는 것이다');
  {
    //  ★★ 예전에는 `GAMBITS.find(...)` 로 집어 왔고, 못 찾으면 `undefined` 가
    //    `canOffer` 안에서 `g.needs` 를 읽다 **터졌다.** 셋을 먼저 확인한다 —
    //    「못 쟀다」와 「도구가 터졌다」는 사람이 할 일이 다르다
    must.all(BY_KEY, ['jettison', 'intoDebris', 'othersBait'], '[9] 판 갖춤을 재려는데');
    const jet = BY_KEY.jettison;
    ok(!canOffer(jet, { chasing: true, ore: 0 }), '광석이 없으면 「버리기」가 안 뜬다');
    ok(canOffer(jet, { chasing: true, ore: 40 }), '광석이 있으면 뜬다');
    const deb = BY_KEY.intoDebris;
    ok(!canOffer(deb, { chasing: true, hazard: false }), '잔해밭이 없으면 「끌고 들어가기」가 안 뜬다');
    const bait = BY_KEY.othersBait;
    ok(!canOffer(bait, { chasing: true }), '쫓기는 중에는 「남의 미끼」가 안 뜬다 — 평온할 때의 것이다');
    ok(canOffer(bait, { chasing: false }), '평온하면 뜬다');
  }
} catch (e) {
  //  ★ 우리 것이 아니면 **다시 던진다.** 여기서 삼키면 진짜 고장이
  //    「측정 불가」로 위장된다
  if (!must.caught(e)) throw e;
}

//  ★ 담긴 것이 있으면 여기서 **2**(못 쟀다)로 끝난다 — 합격 줄을 찍기 전이다
must.bail();

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「고를 만한가」는 여기서 안 나온다.** 그건 2시간 돌려 봐야 안다.');
process.exit(fail ? 1 : 0);
