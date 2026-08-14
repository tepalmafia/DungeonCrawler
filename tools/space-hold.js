// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **화물칸 · 인벤토리 · 제조** — 곳간에 문이 둘인가 (v114 · 뼈대만)
//
//    node tools/space-hold.js
//
//  ★ 사장님 (2026-08-11)
//    「**화물칸이 벌써 다 찼다는데? 필요한 아이템 드랍률을 낮춰**」
//    「**인벤토리도 만들어야지. 제조하는 것도 만들고**」
//
//  ══ 이 검사가 묻는 것 ═══════════════════════════════════════════════
//
//   ① ★★★ **정말 드랍률 문제였나** — 재 보고 정한다. 아니면 딴 데를 고친다
//   ② **새는 구멍이 막혔나** — 통에 부은 것이 화물칸에서 빠지나
//   ③ **막고 나서도 화물칸이 뜻을 갖나** — 언젠가는 차야 결심이 생긴다
//   ④ **제조가 공짜가 아닌가** — 값을 치르나 · 시간이 드나
//   ⑤ **제조로 탄두 재료를 만들 수 없나** — 만들 수 있으면 목적이 죽는다
//
//  ★ 게임을 안 부른다. 표와 순수 모듈만 읽는다
// ══════════════════════════════════════════════════════════════════════════
import { KINDS } from '../web/space/js/game/target-table.js';
import { packOf } from '../web/space/js/game/salvage-table.js';
import { HOLD, ITEMS, massOf, nameOf } from '../web/space/js/game/cargo-table.js';
import { makeCargo, put, settle, used, left } from '../web/space/js/game/cargo.js';
import {
  RECIPES, RECIPE_LIST, massOf as recipeMass, canMake, costWord, missilesReal,
} from '../web/space/js/game/craft-table.js';
import { FOOD, PARTS, ORE } from '../web/space/js/game/supply-table.js';
import { BY_KEY as MATS } from '../web/space/js/game/warhead-table.js';
// ★★★ v150 — 「잴 것이 없으면 멈춘다」는 **한 곳에** 있다 (`folded.js` 옆)
import { measuring } from './unmeasured.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ v150 — **잴 것이 없으면 통과가 아니라 「측정 불가」다**
//
//  ★ 이 검사에도 「없어야 한다」 꼴이 넷 있다:
//
//      ok(!madeMats.length,                     '탄두 재료를 못 만든다')
//      ok(RECIPE_LIST.every((r) => …cost…),     '다 값을 받는다')
//      ok(RECIPE_LIST.every((r) => r.sec >= 8), '다 시간이 든다')
//      ok(RECIPE_LIST.every((r) => …ITEMS…),    '다 표에 있는 아이템이다')
//
//  ★★ **조리법 표를 통째로 비우면 넷이 다 참**이 된다. 그러고도 [6] 은
//    「**탄두 재료 5 가지 중 만들 수 있는 것이 없다**」라고 **자랑스럽게**
//    찍는다 — 만들 수 있는 것이 없는 게 아니라 **만드는 계통 자체가
//    없어진 것**인데. `space-screen.js` 가 계기 넷을 없애고 「✔ 전투 화면이
//    비어 있다」를 찍은 것과 **똑같은 병**이다.
//
//  ★★★ 그리고 [6] 은 **양쪽이 다 비면 두 배로 조용하다**: 탄두 재료 표
//    (`warhead-table.js BY_KEY`)가 비어도 `madeMats` 는 빈 목록이라
//    초록이 된다. 「A 중에 B 가 없다」 꼴은 **A 가 없을 때도 참**이므로,
//    A 와 B 를 **둘 다** 세어야 한다.
//
//  ★ [2]·[3] 은 「**화물칸에 안 남는다**」 꼴이라 더 조용하다 — 아이템 표가
//    비면 `put()` 이 아무것도 안 싣고, 그러면 「안 남았다」가 저절로 참이다.
//    그래서 **싣기 전에 아이템 이름 여섯이 표에 있나**를 먼저 묻는다.
//
//  ※ 여기는 순수 도구라 브라우저가 없다. 그래도 모양은 같게 둔다 —
//    던지고 · 담고 · **합격 줄을 찍기 전에** `bail()` 로 2 를 낸다.
//    `process.exit()` 를 던지는 자리에서 바로 부르면, 나중에 여기 정리할
//    것이 생겼을 때 그 줄이 조용히 안 돌게 된다
// ══════════════════════════════════════════════════════════════════════════
const must = measuring({
  tool: 'space-hold',
  what: '조리법',
  weak: '이 검사에는 **「없어야 한다」·`every()`** 꼴이 넷 있습니다\n'
    + '(다 값을 받나 · 다 시간이 드나 · 다 표에 있나 · 탄두 재료를 못 만드나).\n'
    + '**조리법 표가 비면 넷이 다 저절로 참**이 되고, 그때 [6] 은\n'
    + '「탄두 재료 5 가지 중 만들 수 있는 것이 없다」라고 찍습니다 —\n'
    + '만들 수 있는 것이 없는 게 아니라 **제조가 통째로 없어진 것**인데.\n'
    + '[2]·[3] 의 「화물칸에 안 남는다」도 아이템 표가 비면 참이 됩니다.',
  look: '`game/craft-table.js` 의 `RECIPES` · `game/cargo-table.js` 의 `ITEMS`'
    + ' · `game/warhead-table.js` 의 `BY_KEY`',
});

/**
 * ★ [2]·[3] 이 싣고 부어 보는 아이템 여섯. **손으로 적는다** —
 *   `Object.keys(ITEMS)` 로 적으면 표가 비었을 때 「빈 것과 빈 것이 같다」가
 *   되어 검사가 스스로를 통과시킨다 (v110 이 열여섯을 여섯으로 줄인 뒤의 목록)
 */
const NEED_ITEMS = ['spare', 'ore', 'arc', 'coolant', 'meal', 'ration'];

console.log('화물칸 · 인벤토리 · 제조 — 곳간에 문이 둘인가 (뼈대만)');

try {
  console.log('\n[1] ★★★ **정말 드랍률 문제였나** — 한 마리가 몇 짐을 주나');
  {
    const rows = Object.keys(KINDS).map((k) => {
      const p = packOf(k) ?? {};
      const m = Object.entries(p).reduce((a, [key, c]) => a + massOf(key) * c, 0);
      return { k, name: KINDS[k].name, p, m };
    }).filter((r) => Object.keys(r.p).length);
    // ★ 떠도는 것이 하나도 안 나오면 아래 평균이 NaN 이 되고, 「몇 마리면
    //   차나」라는 질문 자체가 성립하지 않는다. 빨강이 아니라 **못 쟀다**이다
    must.as('표적').some(rows, '한 마리가 몇 짐을 주나를 재려는데');
    must.as('값').value(HOLD, '화물칸 크기', '몇 마리면 차나를 재려는데');
    for (const r of rows) {
      console.log(`   ${r.name.padEnd(10)} ${Object.entries(r.p)
        .map(([a, b]) => `${nameOf(a)}×${b}`).join(' · ').padEnd(40)} ${String(r.m).padStart(3)} 짐`);
    }
    const avg = rows.reduce((a, r) => a + r.m, 0) / rows.length;
    console.log(`   평균 ${avg.toFixed(1)} 짐 · 화물칸 ${HOLD} → **안 빼면 ${(HOLD / avg).toFixed(1)} 마리**면 찬다`);
    ok(HOLD / avg < 8,
      `★★★ **안 빼면 ${(HOLD / avg).toFixed(1)} 마리에 꽉 찬다** — 두 시간짜리 회차에서 이건`
      + ' 「금방」이 아니라 **처음 몇 분**이다. 사장님 말씀이 맞았고, 그런데'
      + ' **원인은 드랍률이 아니었다** (다음 절)');
  }

  console.log('\n[2] ★★★ **새는 구멍이 막혔나** — 통에 부은 것이 화물칸에서 빠지나');
  {
    // ★★ 아래 두 판정이 「**화물칸에 안 남는다**」 꼴이다. 아이템 표가 비면
    //   실을 것이 없어 **안 남는 것이 당연**해지므로, 싣기 전에 이름부터 묻는다
    must.as('아이템').all(ITEMS, NEED_ITEMS, '화물칸에 실어 보려는데');
    const c = makeCargo();
    const gain = { spare: 3, ore: 4, meal: 1, arc: 2 };
    const r = put(c, gain);
    const before = used(c);
    // ★ 실었는데 화물칸이 비어 있으면 `put()` 이 안 도는 것이다 —
    //   그 상태로 아래를 재면 「삼킨 만큼 비었다」가 0 → 0 으로 통과한다
    must.as('짐').some(Object.keys(c.items), '실어 놓고 삼키는 것을 재려는데');
    // 배는 텅 비어 있다 — 다 삼킬 수 있는 자리다
    const { ate, kept } = settle(c, r.took, {
      food: FOOD.max, parts: PARTS.max, ore: ORE.max, sink: 60,
    });
    console.log(`   실었다 ${before} 짐 → 배가 삼킨 뒤 **${used(c)} 짐**`);
    console.log(`   배로 들어간 것 ${JSON.stringify(ate)} · 화물칸에 남은 것 ${JSON.stringify(kept)}`);
    ok(used(c) < before,
      `★★★ **삼킨 만큼 화물칸이 비었다** (${before} → ${used(c)})`
      + ' — v113 까지는 이 줄이 없어서, 수리통에 부은 부품이 화물칸에도 그대로'
      + ' 남아 있었다. 화물칸에 쌓이던 것은 짐이 아니라 **써 버린 것의 그림자**였다');
    ok(!c.items.spare && !c.items.ore,
      '★★ 통에 자리가 있으면 부품·광석은 **화물칸에 안 남는다**');
    ok((c.items.arc ?? 0) === 2,
      `★★★ **아크 전지는 남는다** (${c.items.arc}) — 이건 「써 버린 것」이 아니라`
      + ' **실어 두는 것**이다. 도약이 `cargo.items.arc` 를 그대로 읽으므로'
      + ' 삼키면 그 자리에서 물건이 없어진다');
  }

  console.log('\n[3] ★★ **통이 차면 화물칸에 남나** — 여기가 「무엇을 버릴지」다');
  {
    const c = makeCargo();
    const r = put(c, { spare: 6, coolant: 2 });
    // ★ 수리통이 꽉 찼고 열도 없다 — 배가 하나도 못 받는 상태
    const { ate, kept } = settle(c, r.took, {
      food: FOOD.max, parts: 0, ore: ORE.max, sink: 0,
    });
    console.log(`   삼킨 것 ${JSON.stringify(ate)} · 남은 것 ${JSON.stringify(kept)} · ${used(c)} 짐`);
    ok((c.items.spare ?? 0) === 6,
      '★★★ **수리통이 꽉 차면 부품이 화물칸에 남는다** — 그게 진짜 짐이고,'
      + ' 「자리가 모자란다」가 여기서 처음으로 뜻을 갖는다');
    ok((c.items.coolant ?? 0) === 2,
      '★★ **열이 없으면 냉각제를 안 붓는다** — 시원할 때 부으면 그냥 버리는'
      + ' 것이고, 그러면 「식히려고 아껴 둔다」가 없어진다');
  }

  console.log('\n[4] ★★★ **막고 나서도 언젠가는 차나** — 안 차면 화물칸이 장식이다');
  {
    // 배를 **꽉 찬 상태**로 두고 (수리통 12 · 광석통 240 · 배부름) 계속 줍는다
    const c = makeCargo();
    let kills = 0;
    const order = ['raider', 'fighter', 'gunship', 'convoy', 'turret', 'sat', 'tank', 'junk', 'drone'];
    while (used(c) < HOLD && kills < 400) {
      const kind = order[kills % order.length];
      const r = put(c, packOf(kind) ?? {});
      settle(c, r.took, { food: 0, parts: 0, ore: 0, sink: 0 });
      kills++;
    }
    console.log(`   통이 다 찬 배로 **${kills} 마리**를 부수니 ${used(c)} 짐 (남은 자리 ${left(c)})`);
    ok(kills >= 6 && kills <= 60,
      `★★★ **${kills} 마리 만에 찬다** (6~60) — 통이 꽉 찬 배가 계속 줍는 것은`
      + ' 회차 후반의 모습이고, 그때 「무엇을 버릴까」가 생기는 것이 맞다.'
      + ' 너무 빠르면 v113 로 돌아가고 너무 느리면 화물칸이 장식이다');
  }

  console.log('\n[5] ★★★ **제조가 공짜가 아닌가**');
  {
    // ★★★ 여기 아래가 전부 `every()` 다 — **빈 목록이면 셋이 다 참**이고,
    //   그러면 「제조가 공짜가 아니다」가 **제조가 없어서** 초록이 된다
    must.some(RECIPE_LIST, '제조가 공짜가 아닌가를 재려는데');
    console.log('   조리법        드는 것                      나오는 것      시간   무게');
    for (const r of RECIPE_LIST) {
      const m = recipeMass(r);
      const outW = r.to.item ? `${nameOf(r.to.item)} ${r.to.n}` : `${r.to.field} +${r.to.n}`;
      console.log(`   ${r.name.padEnd(12)} ${costWord(r).padEnd(28)} ${outW.padEnd(13)}`
        + ` ${String(r.sec).padStart(3)}초  ${m.in}→${m.out}`);
    }
    ok(RECIPE_LIST.every((r) => Object.keys(r.cost).length > 0),
      '★★ 조리법이 **다 값을 받는다** — 공짜로 나오는 것이 하나도 없다');
    ok(RECIPE_LIST.every((r) => r.sec >= 8),
      '★★★ **다 시간이 든다** (8초 이상) — 즉발이면 「모자란다」가 단추 하나로'
      + ' 풀려서, 보급이라는 계통이 통째로 죽는다');
    const usesOre = RECIPE_LIST.filter((r) => r.cost.ore).length;
    ok(usesOre >= 3,
      `★★★ **${usesOre} 개가 광석을 먹는다** — 광석은 파츠를 올리는 돈이기도 하다`
      + ' (`parts-table.js UPGRADE`). 즉 **만들면 개조를 못 한다** —'
      + ' 「쏘면 못 고친다」(v44 주포)와 같은 저울이다');
    // ★ 유도탄 조리법이 없어지면 `recipeMass(undefined)` 가 터진다.
    //   터지는 것도 답이 아니다 — **왜 못 쟀는지** 말하고 물러난다
    must.has(RECIPES, 'missile', '유도탄 한 발의 무게를 재려는데');
    const mi = recipeMass(RECIPES.missile);
    ok(mi.in >= 10,
      `★★ 유도탄 한 발이 **${mi.in} 짐**이다 — 미사일이 진짜로 떨어지는 날`
      + `(지금은 ${missilesReal() ? '**센다**' : '무한이라 안 센다'}) 이것이 유일한 보충 길이다`);
  }

  console.log('\n[6] ★★★ **탄두 재료는 못 만드나** — 만들 수 있으면 목적이 죽는다');
  {
    const matKeys = Object.keys(MATS ?? {});
    // ★★★ 「A 중에 B 가 없다」 꼴은 **A 가 없을 때도 참**이다. 탄두 재료 표가
    //   비면 「만들 수 있는 것이 없다」가 초록으로 찍히는데, 그건 못 만드는
    //   것이 아니라 **탄두라는 목적이 표에서 사라진 것**이다
    must.as('탄두 재료').some(matKeys, '만들 수 있는 것이 있나를 재려는데');
    must.some(RECIPE_LIST, '탄두 재료를 만드는 조리법이 있나를 재려는데');
    const madeMats = RECIPE_LIST.filter((r) => matKeys.includes(r.to.item));
    ok(!madeMats.length,
      `★★★ **탄두 재료 ${matKeys.length} 가지 중 만들 수 있는 것이 없다**`
      + ' — 그건 핵물질이고 광석을 빻아 나오는 물건이 아니다 (고증).'
      + ' 무엇보다 만들 수 있으면 「적진을 뚫고 들어가 모은다」가 통째로 없어진다');
    ok(RECIPE_LIST.every((r) => !r.to.item || ITEMS[r.to.item]),
      '★ 나오는 것이 **다 표에 있는 아이템**이다 — 새 아이템을 안 만들었다'
      + ' (열여섯을 여섯으로 줄인 v110 을 무르지 않는다)');
  }

  console.log('\n[7] ★ **못 만들 때 왜인지 말하나**');
  {
    // ★ 여기는 「없어야 한다」가 아니라 **값을 견주는** 꼴이라 빈 표에 강하다.
    //   다만 조리법이 없으면 `why` 가 전부 'none' 이 되어 **뒤 셋이 빨개진다** —
    //   그건 「모자람을 안 말한다」가 아니라 「조리법이 없다」이므로,
    //   [5] 의 `some()` 이 먼저 멈춰 주는 것이 맞다
    ok(!canMake('missile', { items: {} }).ok, '재료가 없으면 못 만든다');
    ok(canMake('missile', { items: {} }).why === 'short', '  이유가 「모자람」이다');
    ok(canMake('missile', { items: { ore: 9, spare: 9 }, calm: false }).why === 'calm',
      '★★ **쫓기는 중에는 못 만든다** — 손이 조종간에 있다');
    ok(canMake('missile', { items: { ore: 9, spare: 9 } }).ok, '재료가 있고 조용하면 만든다');
  }
} catch (e) {
  //  ★★★ 「못 쟀다」는 여기서 담아 **합격 줄을 찍기 전에** 알린다.
  //    딴 오류는 **다시 던진다** — 여기서 삼키면 진짜 고장이
  //    「측정 불가」로 위장된다
  if (!must.caught(e)) throw e;
}

//  ★ 담긴 것이 있으면 여기서 **2**(못 쟀다)로 끝난다.
//    0 으로 끝내면 나중에 자동으로 돌릴 때 **「합격」으로 읽힌다**
must.bail();

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 구멍이 막혔고, 곳간에 문이 둘입니다');
process.exit(bad ? 1 : 0);
