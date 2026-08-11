// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **부위와 등급** — 뼈대만 (v107)
//
//    node tools/space-parts.js
//
//  ★ 사장님 「파밍은 **더 강한 무기, 더 강한 파츠, 더 강한 장갑**…」
//    「**i창을 통해 비행기 모양이 모이고 각 부분 별 파츠를 볼 수 있게** 하자.
//      파츠도 파밍, 혹은 **재료로 개조, 제작**이 가능하게」 · 갈아엎기는 「가」
//
//  ★★★ 묻는 것 여섯
//      ① **정말 「더 강한」이 없었나** — 사장님 말씀을 표로 검산한다
//      ② 부위가 **게임에 있는 값**을 가리키나 (없는 것을 가리키면 빨개진다)
//      ③ ★★ 주우면 **저절로 좋아지지 않나** — 고르는 것이 남나
//      ④ ★★★ 개조가 **공짜가 아닌가** · 끝이 있나
//      ⑤ ★★ 회차 하나에 얼마나 크나 — 20분에 다 크지 않나
//      ⑥ ★ 못 하는 자리마다 까닭을 말하나
// ══════════════════════════════════════════════════════════════════════════
import {
  SLOTS, TIERS, TIER_BY, tierIdx, UPGRADE, CRAFT, oreFor,
  partsMight, BASE_MIGHT, partName, PWHY, WEIGHT,
} from '../web/space/js/game/parts-table.js';
import {
  makeFit, mightOf, gainPart, equip, upgrade, craft, sparesFor, summary,
} from '../web/space/js/game/parts.js';
import { MINE } from '../web/space/js/game/might-table.js';
import { ITEMS } from '../web/space/js/game/cargo-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

console.log('부위와 등급 — 뼈대만 (게임을 안 부른다)');

console.log('\n[1] ★★★ **정말 「더 강한」이 없었나** — 사장님 말씀을 검산한다');
{
  const all = Object.keys(ITEMS);
  const war = all.filter((k) => ITEMS[k].group === 'war');
  console.log(`   파밍으로 나오는 것 ${all.length} 가지 · 그중 싸움용 **${war.length}** 가지`
    + ` (${war.join(' · ')})`);
  // ★★ 처음에 「싸움용이 셋 이하」로 쟀다가 넷이 나와 빨개졌다 —
  //   `ore`·`arc` 는 **재료**지 무기가 아닌데 같은 무리에 들어 있었다.
  //   그리고 그건 내 주장이 아니었다. **진짜 주장은 「등급이 없다」**이고,
  //   그건 이렇게 잰다: 파밍으로 나오는 열여섯 중 **등급을 가진 것이 몇인가**
  const tiered = all.filter((k) => ITEMS[k].tier || ITEMS[k].tiers || ITEMS[k].grade);
  ok(tiered.length === 0,
    `★★★ **등급을 가진 물건이 하나도 없었다** (16 중 0) — 「더 강한 무기」가`
    + ' 아니라 「무기 몇 개」였던 진짜 까닭이 이것이다');
  // ══ ★★★ v110 — **이 줄이 옛 상태를 「있다」로 재고 있었다** ═════════
  //  v107 에 「그 둘이 `MINE.loot` 로 개수만 센다」를 **증거로** 적었는데,
  //  v110 이 그 `MINE.loot` 를 통째로 걷어내자 검사가 빨개졌다.
  //  ★ 검사가 틀린 것이지 표가 틀린 것이 아니다 — **없앤 것을 「있나」로
  //    물으면 안 된다.** 이제 「정말 없어졌나」를 묻는다
  ok(MINE.loot === undefined && MINE.lootPow === undefined,
    '★★★ **노획 개수 식이 없어졌다** (`MINE.loot` · `MINE.lootPow`) —'
    + ' v107 은 새 식을 만들고 옛 식을 남겨 두었고, 그동안 회차마다'
    + ' 「노획 무기 108 · 장갑판 288」이 아무 데도 안 붙는 칸으로 들어갔다');
  ok(SLOTS.length === 7,
    `★★ 이제 **부위 ${SLOTS.length} 개**다 — 방 일곱 · 가르침 일곱과 같은 규약이다`);
  ok(TIERS.length === 5 && TIERS[0].mult === 1,
    `★★ 등급 ${TIERS.length} 개 · 시작이 **1 배**다 — 「낡은 것」에서 시작하면`
    + ' 손해 보는 기분이고, **오르기만 하는 것**이 파밍의 맛이다');
}

console.log('\n[2] ★★ 부위가 **게임에 있는 값**을 가리키나');
{
  console.log('   부위       무게   무엇에 붙나');
  for (const s of SLOTS) {
    console.log(`   ${s.name.padEnd(7)} ${String(WEIGHT[s.key]).padStart(4)}   ${s.feeds}  — ${s.what}`);
  }
  ok(SLOTS.every((s) => s.feeds && s.what),
    '★★★ 부위마다 **무엇에 붙는지**가 적혀 있다 — 안 적으면 「전투력이 올랐다」는'
    + ' 숫자만 남고 무엇이 좋아졌는지 모른다');
  ok(new Set(SLOTS.map((s) => s.key)).size === SLOTS.length, '★ 이름이 안 겹친다');
  ok(WEIGHT.gun > WEIGHT.hold && WEIGHT.armor > WEIGHT.hold,
    '★★ 주포·장갑이 화물칸보다 무겁다 — 다만 화물칸도 **0 이 아니다**'
    + ' (싸움엔 안 쓰여도 파밍에는 쓰인다)');
}

console.log('\n[3] ★★★ 주우면 **저절로 좋아지지 않나** — 고르는 것이 남나');
{
  const f = makeFit();
  const was = mightOf(f);
  gainPart(f, 'gun', 'loot');
  ok(mightOf(f) === was,
    `★★★ **주워도 전투력이 안 오른다** (${was}) — 여분으로 쌓일 뿐이다.`
    + ' 저절로 갈아 끼워지면 I 창을 볼 이유가 없어지고, 그러면 고르는 것이 사라진다');
  const r = equip(f, 'gun');
  ok(r.ok && mightOf(f) > was,
    `★★ **달아야 오른다** (${was} → ${mightOf(f)}) — 「${partName(r.put)}」`);
  ok(f.spare.length === 1 && f.spare[0].tier === 'stock',
    '★ 있던 것은 **버리지 않고 여분으로** 내려간다 — 개조 재료가 된다');
  ok(equip(f, 'sensor').why === 'slot', `★ 없으면 못 단다 — 「${PWHY.slot}」`);
}

console.log('\n[4] ★★★ 개조가 **공짜가 아닌가** · 끝이 있나');
{
  console.log('   등급          배수    다음으로 올리는 데 드는 광석');
  for (const t of TIERS) {
    const last = tierIdx(t.key) >= tierIdx(UPGRADE.maxTier);
    console.log(`   ${t.name.padEnd(11)} ${t.mult.toFixed(2)}    ${last ? '— (주워야 나온다)' : oreFor(t.key)}`);
  }
  const f = makeFit();
  ok(upgrade(f, 'gun', { ore: 9999 }).why === 'spare',
    `★★★ **여분이 있어야 한다** — 「${PWHY.spare}」. 광석만으로는 안 된다`);
  gainPart(f, 'gun', 'stock'); gainPart(f, 'gun', 'stock');
  ok(upgrade(f, 'gun', { ore: 0 }).why === 'ore',
    `★★★ **광석도 든다** — 「${PWHY.ore}」. 여분만으로도 안 된다`);
  const before = mightOf(f);
  const up = upgrade(f, 'gun', { ore: 9999 });
  ok(up.ok && mightOf(f) > before,
    `★★ 둘을 다 내면 오른다 (${before} → ${mightOf(f)} · 광석 ${up.ore})`);
  ok(f.spare.length === 0, '★ 태운 여분이 **정말 없어진다**');
  // 끝까지 올려 본다
  const g = makeFit();
  let n = 0;
  for (let i = 0; i < 20; i++) {
    gainPart(g, 'gun', 'stock'); gainPart(g, 'gun', 'stock');
    if (!upgrade(g, 'gun', { ore: 99999 }).ok) break;
    n++;
  }
  ok(g.on.gun.tier === UPGRADE.maxTier,
    `★★★ **개조로는 「${TIER_BY[UPGRADE.maxTier].name}」까지**다 (${n}번) —`
    + ` 그 위(「${TIERS[TIERS.length - 1].name}」)는 **주워야만** 나온다.`
    + ' 다 올릴 수 있으면 파밍할 이유가 없어진다');
}

console.log('\n[5] ★★ 회차 하나에 **얼마나 크나** — 20분에 다 크지 않나');
{
  //  ★ v79 에 노획이 「여섯 대 잡으면 천장」이라 20분 만에 다 컸던 적이
  //    있다 (`might-table.js` 주석). 같은 함정을 다시 밟는지 본다
  const f = makeFit();
  const start = mightOf(f);
  const top = partsMight(Object.fromEntries(
    SLOTS.map((s) => [s.key, { slot: s.key, tier: 'ace' }]),
  ));
  console.log(`   다 표준 **${start}** → 다 격추왕 **${top.toFixed(2)}**`
    + ` (${(top / start).toFixed(2)}배)`);
  ok(Math.abs(start - BASE_MIGHT) < 1e-6, '★ 바닥값이 표와 같다');
  ok(top / start > 1.8 && top / start < 2.6,
    `★★ 끝까지 키워도 **${(top / start).toFixed(2)}배**다 — 열 배가 되면`
    + ' 초반이 의미 없어지고, 1.2배면 파밍할 이유가 없다');
  // 부위 하나만 몰아 키우면?
  const one = makeFit();
  one.on.gun = { slot: 'gun', tier: 'ace' };
  ok(mightOf(one) / start < 1.35,
    `★★★ **한 부위만 몰아도 ${(mightOf(one) / start).toFixed(2)}배**다 —`
    + ' 일곱을 고루 키워야 하므로 「무엇부터 올릴까」가 회차 내내 남는다');
}

console.log('\n[6] ★ 못 하는 자리마다 **까닭을 말하나**');
{
  for (const [k, w] of Object.entries(PWHY)) ok(!!w && w.length > 5, `★ ${k.padEnd(6)} — 「${w}」`);
  const f = makeFit();
  ok(craft(f, 'gun', { ore: 0, parts: 99 }).why === 'ore', '★ 제작도 광석이 든다');
  ok(craft(f, 'gun', { ore: 999, parts: 0 }).why === 'parts', '★ 부품도 든다');
  const c = craft(f, 'sensor', { ore: 999, parts: 99 });
  ok(c.ok && c.made.tier === CRAFT.tier,
    `★★ 만들면 **표준**이 나온다 — 만들어서 시제품이 나오면 주울 이유가 없어진다`);
  const s = summary(f);
  ok(s.slots.length === SLOTS.length && s.slots.every((x) => x.label),
    '★★ I 창이 그릴 것이 다 나온다 (부위 · 등급 · 여분 · 개조 가능 여부)');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
