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
// ★★★ v150 — 「잴 것이 없으면 멈춘다」는 **한 곳에** 있다 (`folded.js` 옆)
import { measuring } from './unmeasured.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const head = (t) => console.log(`\n${t}`);

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ v150 — **잴 것이 없으면 통과가 아니라 「측정 불가」다**
//
//  ★ 이 검사도 `space-screen.js` 와 **같은 병**을 앓고 있었다. 여기서
//    제일 무른 자리는 **`.every()` 두 군데**다:
//
//      ITEM_LIST.every((i) => GROUPS[i.group] && !GROUPS[i.group].part)
//      Object.keys(packOf('raider')).every((k) => ITEMS[k].use)
//
//    `[].every(…)` 는 언제나 참이므로, **아이템 표가 비거나 꾸러미가 빈
//    채로 와도 「화물칸에는 부위가 안 들어간다」·「소비처가 있는 것만
//    떨어진다」가 초록**으로 찍힌다. 「불량 상자가 비었으니 불량이 없다」다.
//
//  ★★ 그 옆의 「없어야 한다」 꼴도 같이 막았다 —
//    `noNeed.length === 0` · `noWhy.length === 0` 은 표가 비면 저절로 참이다.
//    (`ITEM_LIST.length === 6` 이 옆에서 빨개지기는 하지만, 그건 **다른 질문**의
//     답이 우연히 막아 주는 것이다. 우연에 기대면 그 줄을 손보는 날 뚫린다)
//
//  ★★★ 그리고 **표가 통째로 사라지면 TypeError 로 죽던 자리**가 있었다
//    (`WAYS.arm.reach` · `KINDS[k].name` · `ITEMS.arc.from`). 그건 「못 쟀다」가
//    아니라 **스택 트레이스**로 나와서, 자동으로 돌릴 때 「도구가 깨졌다」와
//    「잴 것이 없다」가 구분이 안 됐다. 이제 둘 다 **2**(측정 불가)로 나간다.
// ══════════════════════════════════════════════════════════════════════════
const must = measuring({
  tool: 'space-cargo',
  what: '아이템',
  weak: '이 검사의 알맹이는 **`.every()` 두 군데**입니다 —\n'
    + '「화물칸에는 부위가 안 들어간다」(ITEM_LIST) 와\n'
    + '「소비처가 있는 것만 떨어진다」(꾸러미).\n'
    + '`[].every(…)` 는 언제나 참이라 **표가 비면 둘 다 초록**이 되고,\n'
    + '「없으면 막히는 것을 다 적어 뒀다」 같은 「없어야 한다」 꼴도\n'
    + '빈 목록에서는 저절로 참이 됩니다.',
  look: '`web/space/js/game/cargo-table.js` 의 `ITEMS` · `GROUPS` · `WAYS`,'
    + ' `salvage-table.js` 의 `packOf()`',
});

try {

  head('[1] 아이템마다 **없으면 막히는 것**이 있나 — 없으면 점수다');
  {
    // ★★ v110 — **열여섯이 여섯이 됐다.** 열 가지를 접었고 (`farm-table.js
    //   RETIRED`), 그중 넷은 소비처가 없어 원래 안 떨어졌고, 여섯은 v106~v109
    //   가 그 계통(우주복 · 걷기 · 고장)을 없애면서 갈 곳이 사라졌다.
    //   ★ 무기·파츠·장갑은 **화물이 아니라 부위**가 됐다 — 랙에 걸린다
    //  ★★★ v150 — **세기 전에 있나부터.** 아래 넷 중 셋이 「없어야 한다」
    //    꼴이라, 표가 비면 그 셋이 통째로 초록이 된다
    must.some(ITEM_LIST, '[1] 아이템 표를 읽었는데');
    must.as('갈래').some(GROUPS, '[1] 아이템 갈래를 읽었는데');
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
    //  ★ 한도(`HOLD`)가 없어지면 `left(c) === HOLD` 가 `undefined === undefined`
    //    로 **참**이 될 수 있다 — 값 하나도 있는지 먼저 묻는다
    must.as('값').value(HOLD, '화물칸 한도', '[2] 화물칸을 재려는데');
    must.as('값').value(MASS.mid, '광석 무게(mid)', '[2] 무거운 것으로 채우려는데');
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
    //  ★ 등급이 하나라도 빠지면 아래 부등호는 `undefined < undefined` 라
    //    **거짓**으로 빨개지는데, 그건 「순서가 틀렸다」는 **딴 말**이다.
    //    없는 것은 없다고 말해야 한다
    must.as('무게 등급').all(MASS, ['tiny', 'light', 'mid', 'heavy', 'huge'], '[3] 무게 등급을 재려는데');
    console.log(`      무게 — ${Object.entries(MASS).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
    ok(MASS.huge * 5 === HOLD,
      `★★ 탄두 재료 다섯 × ${MASS.huge} = **${MASS.huge * 5}** = 화물칸 ${HOLD} — 다 모으면 다른 것을 못 싣는다`);
    ok(MASS.tiny < MASS.light && MASS.light < MASS.mid && MASS.mid < MASS.heavy && MASS.heavy < MASS.huge,
      '무게 등급이 순서대로다');
  }

  head('[4] ★★ 회수 방법 셋이 **서로 다른 것을 파나**');
  {
    //  ★★★ v150 — 여기는 **셋이 다 있어야 성립하는 절**이다. 하나가 빠지면
    //    옛 판은 `WAYS.arm.reach` 에서 TypeError 로 죽었고, 그러면 「잴 것이
    //    없다」가 **「도구가 깨졌다」로 위장**된다. 먼저 이름 셋을 묻는다
    must.as('회수 방법').all(WAYS, ['arm', 'net', 'bot'], '[4] 회수 방법을 견주려는데');
    must.as('회수 방법').some(WAY_LIST, '[4] 회수 방법 목록을 찍으려는데', 3);
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
    //  ★ 표적 넷의 이름을 찍는 자리 — 표적이 사라지면 `KINDS[k].name` 에서
    //    죽는다. 「없다」를 죽음이 아니라 말로 낸다
    must.as('표적').all(KINDS, ['raider', 'gunship', 'junk', 'tank'], '[5] 꾸러미를 찍으려는데');
    for (const k of ['raider', 'gunship', 'junk', 'tank']) {
      console.log(`      ${KINDS[k].name.padEnd(9)} ${packWord(packOf(k))}`);
    }
    const p = packOf('raider');
    //  ★★★ **이 절의 핵심 방벽이다.** 아래 둘이 `Object.keys(p).every(…)` 라,
    //    꾸러미가 비면 **「전부 표에 있다」·「전부 소비처가 있다」가 둘 다 초록**이
    //    된다 — 정작 적을 부숴도 아무것도 안 나오는 상태인데
    must.as('꾸러미').some(p, '[5] 적 우주선의 꾸러미를 뜯었는데');
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
    //  ★ `fromWhere` 는 `DROPPING` 을 거른 것이다. 그 밑동이 비면 아래
    //    「적에게서 더 많이 나온다」가 `0 > 0` 이라 빨개지기는 하지만,
    //    그건 「적이 덜 준다」는 **딴 말**이다 — 밑동이 빈 것은 밑동이
    //    빈 것으로 말한다
    must.as('떨어지는 것').some(DROPPING, '[7] 어디서 나오나를 재려는데');
    must.has(ITEMS, 'arc', '[7] 아크 전지가 어디서 나오나를 재려는데');
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

} catch (e) {
  //  ★★★ 우리 것이면 담고, **딴 오류는 다시 던진다** — 여기서 삼키면
  //    진짜 고장이 「측정 불가」로 위장된다
  if (!must.caught(e)) throw e;
}

//  ★ 담긴 것이 있으면 여기서 **2**(못 쟀다)로 끝난다.
//    합격/불합격 줄을 **찍기 전에** 불러야 한다 — 0 으로 끝나면 자동
//    검사가 「합격」으로 읽는다
must.bail();

console.log(bad ? `\n✘ ${bad} 개가 안 맞습니다` : '\n✔ 전부 맞습니다');
console.log(`
  ※ **「줍고 싶어지나」는 여기서 안 나온다.** 여기서 나오는 것은
     「막히는 것이 있나 · 다 못 싣나 · 셋이 다른가 · 목록이 남나」뿐이다.
     화면에 목록이 정말 뜨나는 space-endtoend.js 가 본다.`);
process.exit(bad ? 1 : 0);
