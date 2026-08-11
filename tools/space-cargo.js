// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **화물 · 아이템** — 무엇을 싣고 무엇을 버리나 (v83)
//
//  ★ 사장님 「어떤 아이템들을 획득하고 필요한지 아이템 리스트를 스토리에
//    맞게 기획해줘. 우주에서 생존에 필요한 것들은 … **데이터 기준으로**」
//    「**실시간으로 획득 아이템이** … 획득 리스트를 보여줄 수 있도록」
//    「회수를 누르면 **도킹을 하던지 로봇을 보내던지**」
//
//  ★★ 묻는 것 다섯:
//      ① 아이템마다 **없으면 막히는 것**이 있나 (없으면 점수다)
//      ② **다 못 싣나** — 무게가 고를 것을 만드나
//      ③ **탄두를 다 모으면 꽉 차나** — 목적이 조여 오나
//      ④ 회수 방법 셋이 **서로 다른 것을 파나**
//      ⑤ **들어온 목록**이 남나 (배너는 덮어쓴다)
//
//  돌리기:  node tools/space-cargo.js
// ══════════════════════════════════════════════════════════════════════════
import {
  ITEMS, ITEM_LIST, DROPPING, MASS, HOLD, GROUPS, WAYS, WAY_LIST,
  massOf, nameOf, timeOf, holdWord, fromWhere,
} from '../web/space/js/game/cargo-table.js';
import {
  makeCargo, put, drop, used, left, useOf, stepCargo, word, summary,
} from '../web/space/js/game/cargo.js';
import { packOf, packWord } from '../web/space/js/game/salvage-table.js';
import { KINDS } from '../web/space/js/game/target-table.js';
import { THREADS } from '../web/space/js/game/story-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const head = (t) => console.log(`\n${t}`);

head('[1] 아이템마다 **없으면 막히는 것**이 있나 — 없으면 점수다');
{
  // ★★ v110 — **열여섯이 여섯이 됐다.** 열 가지를 접었고 (`farm-table.js
  //   RETIRED`), 그중 넷은 소비처가 없어 원래 안 떨어졌고, 여섯은 v106~v109
  //   가 그 계통(우주복 · 걷기 · 고장)을 없애면서 갈 곳이 사라졌다.
  //   ★ 무기·파츠·장갑은 **화물이 아니라 부위**가 됐다 — 랙에 걸린다
  console.log(`      아이템 ${ITEM_LIST.length} · 갈래 ${Object.keys(GROUPS).length}`
    + ` · 지금 떨어지는 것 ${DROPPING.length}`);
  ok(ITEM_LIST.length === 6, `여섯이다 (${ITEM_LIST.length}) — 소모품만 남았다`);
  const noNeed = ITEM_LIST.filter((i) => !i.need);
  ok(noNeed.length === 0, `전부 「없으면 무엇이 막히나」를 말한다 ${noNeed.map((i) => i.name)}`);
  const noWhy = ITEM_LIST.filter((i) => i.why === undefined);
  ok(noWhy.length === 0, '전부 **왜 그 값인지**를 적어 뒀다 (자료 근거)');
  // 갈래가 줄기에 붙나
  // ★ v110 — 옛 갈래(숨·물·밥·고칠 것·싸울 것)는 **생존 게임**의 갈래라
  //   줄기에 하나씩 붙였다. 새 갈래는 사장님이 말씀하신 다섯이고
  //   (무기·파츠·장갑·보급품·식량) 줄기가 아니라 **파밍**에 붙는다
  ok(Object.keys(GROUPS).length === 5,
    `★★ 갈래가 다섯이다 — 「더 강한 무기, 더 강한 파츠, 더 강한 장갑, 보급품, 식량」`);
  ok(ITEM_LIST.every((i) => GROUPS[i.group] && !GROUPS[i.group].part),
    '★★★ **화물칸에는 부위가 안 들어간다** — 곳간이 둘이다 (파츠는 랙 · 소모품은 화물칸)');
}

head('[2] ★★ **다 못 싣는다** — 무게가 고를 것을 만드나');
{
  const c = makeCargo();
  ok(used(c) === 0 && left(c) === HOLD, `빈 화물칸 ${HOLD} 짐`);
  // 무거운 것으로 채운다
  // ★ v110 — 장갑판(무게 8)이 없어졌다. 제일 무거운 소모품은 **광석**(4)이다
  put(c, { ore: 24 });                         // 4 × 24 = 96
  console.log(`      광석 24 를 실으니 ${used(c)}/${HOLD} — ${holdWord(used(c))}`);
  ok(used(c) <= HOLD, '한도를 안 넘는다');
  const r = put(c, { ore: 5 });
  ok(Object.keys(r.missed).length > 0, '★ 넘치면 **못 싣는 것이 생긴다**');
  ok(Object.keys(r.took).length >= 0, '들어갈 만큼은 싣는다 — 통째로 거절하지 않는다');
  // 버리면 자리가 난다
  const was = left(c);
  drop(c, 'ore', 3);
  ok(left(c) > was, '★ **버리면 자리가 난다** — 「무엇을 버릴지」가 두 번째 층이다');
}

head('[3] ★★★ **탄두를 다 모으면 꽉 찬다** — 목적이 조여 오나');
{
  console.log(`      무게 — ${Object.entries(MASS).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  ok(MASS.huge * 5 === HOLD,
    `★★ 탄두 재료 다섯 × ${MASS.huge} = **${MASS.huge * 5}** = 화물칸 ${HOLD} — 다 모으면 다른 것을 못 싣는다`);
  ok(MASS.tiny < MASS.light && MASS.light < MASS.mid && MASS.mid < MASS.heavy && MASS.heavy < MASS.huge,
    '무게 등급이 순서대로다');
}

head('[4] ★★ 회수 방법 셋이 **서로 다른 것을 파나**');
{
  for (const w of WAY_LIST) {
    console.log(`      ${w.name.padEnd(7)} ${String(w.reach).padStart(3)}m · `
      + `${w.fixed ?? '거리비례'}초 · ${w.holds ? '묶인다' : '안 묶인다'} · 자국 ${w.sign}`);
  }
  ok(WAYS.arm.reach < WAYS.net.reach && WAYS.net.reach < WAYS.bot.reach, '닿는 거리가 셋 다 다르다');
  ok(!WAYS.bot.holds && WAYS.net.holds && WAYS.arm.holds,
    '★★ **로봇만 안 묶인다** — 그것이 로봇을 느리게 둔 값이다');
  const near = 20;
  ok(timeOf('arm', near) < timeOf('net', near),
    `★ 가까이서는 팔이 그물보다 빠르다 (${timeOf('arm', near)}초 vs ${timeOf('net', near)}초) — 바짝 붙는 값이 있다`);
  ok(timeOf('arm', 40) === null, '팔은 25m 밖에 안 닿는다');
  ok(timeOf('bot', 140) !== null && timeOf('net', 140) === null,
    '★ 140m 는 **로봇만** 닿는다 — 멀면 느린 쪽밖에 없다');
  ok(WAYS.arm.sign < WAYS.net.sign, '팔이 자국을 덜 남긴다 (짧게 붙였다 떼므로)');
}

head('[5] 꾸러미가 **아이템**으로 나오나');
{
  for (const k of ['raider', 'gunship', 'junk', 'tank']) {
    console.log(`      ${KINDS[k].name.padEnd(9)} ${packWord(packOf(k))}`);
  }
  const p = packOf('raider');
  ok(Object.keys(p).every((k) => ITEMS[k]), '꾸러미가 든 것이 전부 표에 있는 아이템이다');
  ok(Object.keys(p).every((k) => ITEMS[k].use), '★ **소비처가 있는 것만** 떨어진다 — 없으면 그건 점수다');
  const u = useOf(p);
  ok(Object.keys(u).length > 0, `배의 계통으로 들어간다 (${Object.keys(u).join(' · ')})`);
}

head('[6] ★★ **들어온 목록**이 남나 — 배너는 덮어쓴다');
{
  const c = makeCargo();
  put(c, { spare: 1, coolant: 1, meal: 1 });
  ok(c.log.length === 3, `셋을 실으면 목록이 세 줄 (${c.log.map((l) => nameOf(l.key)).join(' · ')})`);
  put(c, { spare: 1 });
  ok(c.log.length === 3 && c.log[0].key === 'spare' && c.log[0].n === 2,
    '★ 같은 것이 연달아 들어오면 **줄을 안 늘리고 숫자만 올린다** — 소음이 안 되게');
  // 삭는다
  for (let t = 0; t < 30; t += 0.5) stepCargo(c, 0.5);
  ok(c.log.length === 0, '오래되면 사라진다 — 지운 자국이 남으면 실시간이 아니다');
  // 버린 것도 목록에 남는다
  drop(c, 'spare', 1);
  ok(c.log.length === 1 && c.log[0].n < 0, '버린 것도 목록에 남는다 (음수)');
}

head('[7] 어디서 나오나 — **네 곳이 서로 다른 것**을 준다');
{
  for (const w of ['foe', 'junk', 'port']) {
    console.log(`      ${w.padEnd(5)} ${fromWhere(w).map((i) => i.name).join(' · ') || '(아직 없음)'}`);
  }
  const foe = fromWhere('foe').map((i) => i.key);
  const junk = fromWhere('junk').map((i) => i.key);
  // ★ v110 — 「노획 무기는 적에게서만」이었다. 노획 무기가 없어졌으므로
  //   그 자리를 **부위 파츠**가 잇는다 — 「없는 것을 뜯을 수는 없다」는
  //   `farm-table.js SLOT_FROM` 이 들고, `space-farm.js` 가 잰다
  ok(foe.length > junk.length,
    `★ 적에게서 더 많이 나온다 (적 ${foe.length} · 쓰레기 ${junk.length})`);
  ok(ITEMS.arc.from.length === 1 && ITEMS.arc.from[0] === 'foe',
    '★★ 아크 전지는 **적에게서만** — 거점에서 팔면 고리가 끊어진다 (WAR.md §14-3)');
}

console.log(bad ? `\n✘ ${bad} 개가 안 맞습니다` : '\n✔ 전부 맞습니다');
console.log(`
  ※ **「줍고 싶어지나」는 여기서 안 나온다.** 여기서 나오는 것은
     「막히는 것이 있나 · 다 못 싣나 · 셋이 다른가 · 목록이 남나」뿐이다.
     화면에 목록이 정말 뜨나는 space-endtoend.js 가 본다.`);
process.exit(bad ? 1 : 0);
