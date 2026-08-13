// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **무기마다 따로 · 비율로 시작 · 파밍으로 채운다** — 뼈대만 (v133)
//
//    node tools/space-ammo.js
//
//  ★ 사장님 (2026-08-13) 「**레이저는 무한으로 다른 무기들도 일정 비율로
//    가지고 시작하고, 파밍을 통해서 적절히 구할 수 있도록 해줘**」
//    (같은 날) 「**공격이 안되는 이유는?**」 — 138m 였고 레이저는 90m 였다
//
//  ★★★ 묻는 것 여섯
//      ① **레이저만 무한인가** — 나머지가 다 유한한가
//      ② **비율로 시작하나** — 다 주지도, 안 주지도 않나
//      ③ ★★★ **파밍에서 다 나오나** — 안 나오는 무기는 결국 죽은 무기다
//      ④ **드문 것과 흔한 것이 갈리나** — 다 흔하면 고를 것이 없다
//      ⑤ **한 회차 수지가 맞나** — 굶지도 넘치지도 않나
//      ⑥ ★★★ **어느 거리에서 무엇이 닿나** — 「너무 멉니다」만으로는 모른다
// ══════════════════════════════════════════════════════════════════════════
import {
  AMMO, FINITE, startOf, makeAmmo, canFire, spend, gain, farmRoll, ammoWord, summary,
} from '../web/space/js/game/ammo-table.js';
import { WEAPON_LIST, whyNotFire, WHY } from '../web/space/js/game/combat-table.js';
import { LEG } from '../web/space/js/game/route-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

console.log('무기 재고 — 뼈대만 (게임을 안 부른다)');

console.log('\n[1] ★★★ **레이저만 무한인가**');
{
  for (const w of WEAPON_LIST) {
    const a = AMMO[w.key];
    console.log(`   ${w.name.padEnd(6)} ${a?.infinite ? '∞  무한' : `${startOf(w.key)}/${a.max} 로 시작`}`
      + `  — ${a?.why ?? ''}`);
  }
  ok(AMMO.laser?.infinite === true,
    '★★★ **레이저는 무한이다** — 사장님 말씀 그대로. 아끼는 것은 발수가 아니라 **열**이다');
  ok(WEAPON_LIST.every((w) => AMMO[w.key]),
    '★★ **무기마다 칸이 있다** — 빠진 무기가 있으면 그 무기는 조용히 무한이 된다');
  ok(FINITE.length >= 2,
    `★★★ **유한한 무기가 ${FINITE.length} 종이다** — v132 까지 열추적탄과 유도탄이`
    + ' **한 통**을 나눠 썼다. 그러면 무기가 셋이 아니라 둘이고, 사장님이 말씀하신'
    + ' 「다른 무기**들도**」의 「들」이 성립하지 않는다');
}

console.log('\n[2] ★★ **비율로 시작하나**');
{
  const a = makeAmmo();
  console.log(`   시작 재고 — ${ammoWord(a)}`);
  ok(FINITE.every((k) => AMMO[k].startAt > 0 && AMMO[k].startAt < 1),
    '★★★ **다 주지도, 안 주지도 않는다** — 가득 주면 파밍할 이유가 없고,'
    + ' 안 주면 첫 싸움을 레이저로만 해야 한다');
  ok(FINITE.every((k) => a[k] === Math.round(AMMO[k].max * AMMO[k].startAt)),
    '★★★ **개수가 아니라 비율로 적혀 있다** — 최대치는 파츠로 늘 수 있고,'
    + ' 그때 시작 개수를 손으로 안 고쳐도 따라온다 (「두 곳에 적으면 갈라진다」)');
}

console.log('\n[3] ★★★ **파밍에서 다 나오나** — 안 나오는 무기는 죽은 무기다');
{
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(farmRoll(i / 200).key);
  console.log(`   파밍에서 나오는 것 — ${[...seen].join(' · ')}`);
  ok(FINITE.every((k) => seen.has(k)),
    '★★★ **유한한 무기가 다 나온다** — 하나라도 안 나오면 그 무기는 쓰고 나면 끝이고,'
    + ' 쓰고 나면 끝인 무기는 결국 **안 쓰는 무기**가 된다');
}

console.log('\n[4] ★★ **드문 것과 흔한 것이 갈리나**');
{
  const n = {};
  for (let i = 0; i < 1000; i++) { const r = farmRoll(i / 1000); n[r.key] = (n[r.key] ?? 0) + 1; }
  console.log(`   천 번 뽑으면 — ${Object.entries(n).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  const ws = FINITE.map((k) => AMMO[k].farm.w);
  ok(Math.max(...ws) >= Math.min(...ws) * 2,
    '★★★ **드문 것이 있다** — 다 흔하면 고를 것이 없다. 유도탄이 드물어야'
    + ' 「언제 쓸지」가 결심이 되고, 열추적탄이 흔해야 붙어 싸우는 길이 늘 열린다');
}

console.log('\n[5] ★★ **한 회차 수지가 맞나**');
{
  //  ★ 12구간짜리 한 회차에서 **쓰는 것과 얻는 것**이 비슷해야 한다.
  //    얻는 것이 많으면 아낄 이유가 없고, 적으면 뒤 절반이 레이저만 남는다
  const a = makeAmmo();
  let fired = 0, got = 0;
  // 구간마다 미사일 셋을 쏘고 파밍을 둘 줍는다고 본다
  for (let leg = 0; leg < LEG.count; leg++) {
    for (let i = 0; i < 3; i++) {
      const k = FINITE[i % FINITE.length];
      if (spend(a, k)) fired++;
    }
    for (let i = 0; i < 2; i++) {
      const r = farmRoll(((leg * 7 + i * 3) % 10) / 10);
      got += gain(a, r.key, r.n);
    }
  }
  console.log(`   ${LEG.count}구간 — 쏜 것 ${fired} · 주운 것 ${got} · 남은 것 ${ammoWord(a)}`);
  ok(got > fired * 0.5,
    `★★★ **주운 것이 쓴 것의 절반은 넘는다** (${got} vs ${fired}) — 아니면 회차 뒤 절반이`
    + ' 레이저만 남는다');
  ok(!summary(a).full,
    '★★ **가득 차지는 않는다** — 늘 가득이면 아낄 이유가 없고, 그러면 파밍이 값을 잃는다');
}

console.log('\n[6] ★★★ **어느 거리에서 무엇이 닿나** (사장님 「공격이 안되는 이유는?」)');
{
  //  ★★★ 138m 에서 「너무 멉니다」가 떴다. 맞는 말이지만 **어느 무기가
  //    닿는지는 안 알려 줬다.** 그건 「뭘 어떻게 고르라는거야」와 같은 병이다
  console.log('   거리     닿는 무기');
  //  ★★ **재고를 채워 놓고 잰다.** 처음에 `supply: {}` 로 뒀다가 열추적탄이
  //    138m·300m 에서도 「닿는다」로 나왔다 — `whyNotFire` 는 **재고를 먼저**
  //    보므로 `'ammo'` 가 떨어졌고, 내 거르개가 그것을 「사거리 문제 아님」
  //    으로 읽었다. **묻는 것이 사거리면 나머지는 다 채워 놓고 물어야 한다**
  const reach = (d) => WEAPON_LIST.filter((w) => !['far', 'near'].includes(
    whyNotFire({
      weapon: w, target: { dist: d }, locked: true, radar: true, cool: 0,
      supply: { missiles: 99, ore: 99, parts: 99 },
    }) ?? '',
  ));
  for (const d of [30, 80, 110, 138, 200, 260]) {
    console.log(`   ${String(d).padStart(4)}m   ${reach(d).map((w) => `${w.slot}번 ${w.name}`).join(' · ') || '없다'}`);
  }
  ok([30, 80, 110, 138, 200].every((d) => reach(d).length > 0),
    '★★★ **어느 거리에도 닿는 무기가 하나는 있다** — 없는 거리가 있으면 그 거리에서는'
    + ' 아무것도 못 하고, 그건 전투가 아니라 대기다');
  ok(reach(138).length === 1 && reach(138)[0].slot === 3,
    `★★★ **138m 에서는 3번 하나만 닿는다** — 사장님이 겪으신 그 자리다.`
    + ' 화면이 「너무 멉니다」라고만 하면 3번이 있다는 것을 알 길이 없다');
  ok(reach(260).length === 0,
    '★★ **240m 를 넘으면 아무것도 안 닿는다** — 그건 고장이 아니라 **붙어야 한다**는 뜻이고,'
    + ' 레이더가 그 거리를 보는 까닭이다');
  console.log(`   ★ 그래서 계기가 이렇게 말해야 한다 — 「${WHY.far} — 3번 유도탄이 닿습니다」`);
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
