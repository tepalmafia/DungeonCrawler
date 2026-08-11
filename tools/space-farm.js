// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **파밍** — 뼈대만 (v110)
//
//    node tools/space-farm.js
//
//  ★ 사장님 「파밍은 **더 강한 무기, 더 강한 파츠, 더 강한 장갑, 보급품,
//    식량** 등을 얻을 거야」 · 「기존에 뒤로 가서 냉각을 켠다거나 이런
//    부분은 **모두 없애줘. 오직 전투와 파밍으로** 갈거야」
//
//  ★★★ 묻는 것 여섯
//      ① **파츠가 정말 떨어지나** — v107 은 만들어 놓고 떨구는 자리를 안 만들었다
//      ② **죽은 칸이 없나** — 아이템마다 산 소비처가 있나
//      ③ ★★ **센 것에서 좋은 것이 나오나** — 없으면 「강하면 피한다」가
//         그냥 도망 안내판이다
//      ④ 회차 하나에 **부위 일곱을 채우나** · 너무 많이 나오지는 않나
//      ⑤ ★ **전투력이 오르나** — 얼마나
//      ⑥ ★ 갈래가 **다섯**인가 (사장님 말씀 그대로)
// ══════════════════════════════════════════════════════════════════════════
import {
  GROUPS, GROUP_LIST, GROUP_OF_SLOT, SLOT_FROM, PART_DROP, partChance,
  tierRoll, slotRoll, partOf, SPARE_MAX, overflow, RETIRED,
} from '../web/space/js/game/farm-table.js';
import { ITEMS, ITEM_LIST, HOLD, massOf } from '../web/space/js/game/cargo-table.js';
import { SLOTS, TIERS, TIER_BY, tierIdx, BASE_MIGHT, UPGRADE, oreFor } from '../web/space/js/game/parts-table.js';
import { makeFit, gainPart, equip, upgrade, mightOf as fitMight, sparesFor } from '../web/space/js/game/parts.js';
import { mightOf } from '../web/space/js/game/might-table.js';
import { KINDS } from '../web/space/js/game/target-table.js';
import { packOf } from '../web/space/js/game/salvage-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

// ★ 난수를 표가 안 만든다 — 여기서 만들어 넣는다. 씨를 박아 두어야
//   「고쳤더니 숫자가 달라졌다」와 「돌릴 때마다 달라진다」가 안 섞인다
let seed = 20260811;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

console.log('파밍 — 뼈대만 (게임을 안 부른다)');

// ── 회차 하나를 돌린다 (12구간 · 구간당 적 4.4번 · 물건 3개) ──────────
const FOES = ['raider', 'fighter', 'gunship', 'drone', 'turret'];
const THINGS = ['junk', 'sat', 'tank'];
function oneRun() {
  const fit = makeFit();
  const bag = {};
  const got = { part: 0, byGroup: {}, byTier: {}, dropped: 0 };
  const add = (o) => { for (const [k, n] of Object.entries(o ?? {})) bag[k] = (bag[k] ?? 0) + n; };
  const kill = (kind) => {
    add(packOf(kind));
    const p = partOf(kind, rnd(), rnd(), rnd());
    if (!p) return;
    got.part++;
    const g = GROUP_OF_SLOT[p.slot];
    got.byGroup[g] = (got.byGroup[g] ?? 0) + 1;
    got.byTier[p.tier] = (got.byTier[p.tier] ?? 0) + 1;
    gainPart(fit, p.slot, p.tier);
    // 랙이 넘치면 낮은 등급부터 떨어진다
    for (const dead of overflow(fit.spare)) {
      fit.spare.splice(fit.spare.indexOf(dead), 1); got.dropped++;
    }
    // ★ 들어오는 대로 **더 좋으면 단다** (사람이 I 창에서 하는 일을 흉내낸다)
    const cur = fit.on[p.slot];
    if (tierIdx(p.tier) > tierIdx(cur.tier)) equip(fit, p.slot, 0);
  };
  for (let leg = 0; leg < 12; leg++) {
    // ★ 처음에 `(leg*5+i)%5` 로 돌렸다가 태웠다 — `leg*5%5` 는 늘 0 이라
    //   **매 구간 같은 넷**(적 우주선·요격기·포함·자폭정)만 나오고
    //   방공 포대가 거의 안 나왔다. 섞이는 줄 알았는데 안 섞이고 있었다
    for (let i = 0; i < 4; i++) kill(FOES[(leg + i) % FOES.length]);
    if (leg % 5 < 2) kill(FOES[(leg + 2) % FOES.length]);   // 4.4 번 꼴
    for (const t of THINGS) kill(t);
  }
  return { fit, bag, got };
}

console.log('\n[1] ★★★ **파츠가 정말 떨어지나** (v107 은 떨구는 자리가 없었다)');
{
  console.log('   종류        전투력   파츠 확률   뜯을 수 있는 부위');
  for (const k of Object.keys(KINDS)) {
    console.log(`   ${(KINDS[k].name ?? k).padEnd(10)} ${String(mightOf(k)).padStart(5)}`
      + `   ${(partChance(k) * 100).toFixed(0).padStart(4)}%`
      + `     ${(SLOT_FROM[k] ?? []).join(' · ') || '— 뜯을 것이 없다'}`);
  }
  ok(Object.keys(KINDS).some((k) => partChance(k) > 0), '파츠가 나오는 종류가 있다');
  ok(partChance('drone') === 0,
    '★ **자폭정에서는 파츠가 안 나온다** — 몸이 탄이라 남는 것이 광석뿐이다');
  ok(partChance('gunship') > partChance('fighter'),
    '★★ 센 것이 더 자주 준다 — 「붙을까 피할까」의 한쪽 무게다');
  const packHas = Object.keys(KINDS).every((k) => {
    const p = packOf(k); return p && Object.keys(p).length > 0;
  });
  ok(packHas, '★★ **부수면 무엇이든 하나는 나온다** — 빈손이면 「부술 값」이 없다');
}

console.log('\n[2] ★★★ **죽은 칸이 없나** — 아이템마다 산 소비처가 있나');
{
  // 지금 게임이 실제로 받는 칸들 (main.js `takeUse`)
  const LIVE = new Set(['food', 'parts', 'ore', 'arc', 'sink']);
  const dead = ITEM_LIST.filter((i) => !i.use || !Object.keys(i.use).every((f) => LIVE.has(f)));
  ok(!dead.length,
    `★★★ **아이템 ${ITEM_LIST.length} 가지가 다 살아 있다**`
    + `${dead.length ? ` — 죽은 것: ${dead.map((d) => d.name).join(' · ')}` : ''}`);
  for (const it of ITEM_LIST) {
    console.log(`   ${GROUPS[it.group].name.padEnd(4)} ${it.name.padEnd(10)}`
      + ` 무게 ${String(massOf(it.key)).padStart(2)}  →  ${JSON.stringify(it.use)}`);
  }
  ok(ITEM_LIST.every((i) => massOf(i.key) > 0), '★ 무게가 0 인 것이 없다 — 무게가 없으면 버릴 까닭도 없다');
  console.log(`   ★ 접은 것 ${RETIRED.length} 가지:`);
  for (const [, name, why] of RETIRED) console.log(`      ${name.padEnd(12)} ${why}`);
  ok(RETIRED.length >= 8,
    `★★ **왜 없앴는지가 ${RETIRED.length} 줄 남아 있다** — 지우기만 하면 다음에 또 넣는다`);
}

console.log('\n[3] ★★★ **센 것에서 좋은 것이 나오나**');
{
  const N = 4000;
  const rows = [];
  for (const k of ['fighter', 'raider', 'turret', 'gunship']) {
    const m = mightOf(k);
    const cnt = {};
    for (let i = 0; i < N; i++) { const t = tierRoll(m, (i + 0.5) / N); cnt[t] = (cnt[t] ?? 0) + 1; }
    const good = ((cnt.loot ?? 0) + (cnt.proto ?? 0) + (cnt.ace ?? 0)) / N;
    const avg = TIERS.reduce((s, t) => s + (cnt[t.key] ?? 0) / N * t.mult, 0);
    rows.push({ k, m, good, avg });
    console.log(`   ${(KINDS[k].name ?? k).padEnd(10)} 전투력 ${String(m).padStart(5)}`
      + `  노획품 이상 ${(good * 100).toFixed(0).padStart(3)}%  평균 배수 ${avg.toFixed(3)}`);
  }
  ok(rows[rows.length - 1].good > rows[0].good * 1.5,
    `★★★ **포함이 요격기보다 좋은 것을 ${(rows[3].good / rows[0].good).toFixed(1)}배 자주 준다** —`
    + ' 이것이 없으면 전투력 표시는 그냥 도망 안내판이다');
  ok(rows.every((r, i) => i === 0 || r.avg >= rows[i - 1].avg),
    '★★ 전투력 순서대로 평균 배수가 오른다 — 뒤집히는 자리가 없다');
  // ★ 그런데 **약한 적에서도 최상급이 아주 가끔** 나와야 한다.
  //   0 이면 「약한 것은 부술 이유가 없다」가 되고 그러면 잡몹이 장식이 된다
  let aceFromWeak = 0;
  for (let i = 0; i < N; i++) if (tierRoll(mightOf('fighter'), (i + 0.5) / N) === 'ace') aceFromWeak++;
  ok(aceFromWeak > 0,
    `★★ **요격기에서도 격추왕의 것이 ${(aceFromWeak / N * 100).toFixed(1)}% 나온다** —`
    + ' 0 이면 약한 적은 장식이 된다');
}

console.log('\n[4] ★★ 회차 하나 — **부위 일곱을 채우나 · 넘치지는 않나**');
{
  const r = oneRun();
  const kills = 12 * (4 + 2 / 5) + 12 * 3;
  console.log(`   부순 것 ${Math.round(kills)} · 파츠 **${r.got.part}개**`
    + ` (랙에서 밀려난 것 ${r.got.dropped})`);
  for (const g of GROUP_LIST.filter((x) => x.part)) {
    console.log(`   ${g.name.padEnd(4)} ${String(r.got.byGroup[g.key] ?? 0).padStart(3)}개`);
  }
  console.log('   등급  ' + TIERS.map((t) => `${t.name} ${r.got.byTier[t.key] ?? 0}`).join(' · '));
  ok(r.got.part >= SLOTS.length,
    `★★★ **회차 하나에 ${r.got.part}개** — 부위 일곱(${SLOTS.length})을 채우고도 남는다`);
  ok(r.got.part <= SLOTS.length * 6,
    `★★ 너무 많지도 않다 (일곱의 ${(r.got.part / SLOTS.length).toFixed(1)}배)`
    + ' — 쏟아지면 I 창이 창고 정리가 된다');
  ok((r.got.byGroup.gun ?? 0) > 0 && (r.got.byGroup.armor ?? 0) > 0 && (r.got.byGroup.fit ?? 0) > 0,
    '★★★ **무기 · 장갑 · 파츠가 다 나온다** — 사장님이 셋을 따로 말씀하셨다');
  ok(r.got.dropped > 0,
    `★★ 랙 ${SPARE_MAX}자리가 **${r.got.dropped}번 넘쳤다** — 파츠 쪽에도 「무엇을 버릴까」가 있다`);
  console.log('   화물칸에 들어온 것:');
  for (const [k, n] of Object.entries(r.bag)) {
    console.log(`      ${(ITEMS[k]?.name ?? k).padEnd(10)} ${String(Math.round(n)).padStart(4)}개`
      + `  무게 ${massOf(k) * Math.round(n)}`);
  }
  const w = Object.entries(r.bag).reduce((s, [k, n]) => s + massOf(k) * n, 0);
  ok(w > HOLD,
    `★★★ 다 실으면 **${Math.round(w)}짐** 인데 화물칸은 ${HOLD} 이다`
    + ` (${(w / HOLD).toFixed(1)}배) — **다 못 싣는다.** 그래야 고른다`);
}

console.log('\n[5] ★ **전투력이 오르나** — 얼마나');
{
  const r = oneRun();
  const now = fitMight(r.fit);
  console.log(`   다 표준 ${BASE_MIGHT}  →  회차 하나 뒤 **${now}** (${(now / BASE_MIGHT).toFixed(2)}배)`);
  for (const s of SLOTS) {
    const p = r.fit.on[s.key];
    console.log(`      ${s.name.padEnd(6)} ${TIER_BY[p.tier].name.padEnd(8)}`
      + ` ×${TIER_BY[p.tier].mult.toFixed(2)}  여분 ${sparesFor(r.fit, s.key).length}`);
  }
  ok(now > BASE_MIGHT, '★★★ **오른다** — 파밍이 「더 강한」이 됐다');
  ok(now < BASE_MIGHT * 1.9,
    `★★ 회차 하나로 천장(2.05배)까지는 안 간다 (${(now / BASE_MIGHT).toFixed(2)}배) —`
    + ' 한 회차에 다 크면 다음 회차에 파밍할 까닭이 없다');
  // ★★ **무엇이 개조를 막나** — 광석인가 여분인가. 둘 중 빡빡한 쪽이
  //   「무엇을 주울까」를 정한다. 여기를 안 재면 한쪽이 장식이 된다
  const ore = (r.bag.ore ?? 0) * ITEMS.ore.use.ore;
  const byOre = Math.floor(ore / oreFor('stock'));
  const bySpare = Math.floor((r.got.part - SLOTS.length) / UPGRADE.spare);
  console.log(`   광석 ${Math.round(ore)} → 개조 ${byOre}번어치`
    + `  ·  여분 → 개조 ${bySpare}번어치 (한 번에 ${UPGRADE.spare}개)`);
  ok(byOre > bySpare,
    `★★★ **개조를 막는 것은 광석이 아니라 여분이다** (광석 ${byOre}번 · 여분 ${bySpare}번).`
    + ' 광석이 빡빡하면 「무엇을 부술까」가 없어진다 — 아무거나 부수면 광석은 나오니까');
  ok(bySpare >= 2,
    `★★ 그래도 회차 하나에 **${bySpare}번**은 올린다 — 0 이면 개조가 장식이다`);
}

console.log('\n[6] ★ 갈래가 **다섯**인가 · 사장님 말씀 그대로인가');
{
  ok(GROUP_LIST.length === 5,
    `★★★ **${GROUP_LIST.length} 갈래다** — 「더 강한 무기, 더 강한 파츠, 더 강한 장갑,`
    + ' 보급품, 식량」 그대로');
  for (const g of GROUP_LIST) console.log(`   ${g.name.padEnd(4)} ${g.what}`);
  ok(GROUP_LIST.filter((g) => g.part).length === 3,
    '★★ 그중 셋(무기·파츠·장갑)이 **부위**다 — 등급이 붙어 나오는 것들');
  ok(Object.keys(GROUP_OF_SLOT).length === SLOTS.length,
    `★ 부위 ${SLOTS.length} 가지가 다 어느 갈래에 든다`);
  ok(ITEM_LIST.every((i) => GROUPS[i.group] && !GROUPS[i.group].part),
    '★★ **화물칸에는 부위가 안 들어간다** — 곳간이 둘이고 재는 곳도 둘이다'
    + ' (파츠는 랙, 소모품은 화물칸)');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
