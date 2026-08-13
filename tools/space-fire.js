// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **왜 안 나가나** — 뼈대만 (v141)
//
//    node tools/space-fire.js
//
//  ★ 사장님 (2026-08-13) 「블록아웃으로 **왜 무기가 발사되지 않는지** 확인해.
//    **락온해도 안되는 경우가 있어**」
//
//  ★★★ 재 보고 알게 된 것: **락온은 3번 유도탄에만 필요하다.** 그래서
//    「락온했는데 안 나간다」의 진짜 까닭은 락온이 아니라 **거리**거나
//    **탄약**이거나 **쿨다운**이다 — 그런데 화면이 그걸 다 같은 무게로
//    말하니 사람은 「락온했는데 왜?」로 읽는다.
// ══════════════════════════════════════════════════════════════════════════
import { WEAPON_LIST, whyNotFire, WHY } from '../web/space/js/game/combat-table.js';
import { makeAmmo, reachWord } from '../web/space/js/game/ammo-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
//  ★★★ v141 — **재고에 `ammo` 를 꼭 넣는다.** 안 넣으면 `whyNotFire` 가
//    'ammo' 를 먼저 돌려줘서 「락온이 필요한 무기가 0개」처럼 보인다 —
//    v133 에 똑같이 뎄고(사거리를 묻는데 탄약이 대답했다), 이번엔 반대로
//    **고친 뒤에** 같은 자리에서 다시 걸렸다. 묻는 것 말고는 다 채운다
const full = { missiles: 99, ore: 99, parts: 99, ammo: makeAmmo() };

console.log('왜 안 나가나 — 뼈대만 (게임을 안 부른다)');

console.log('\n[1] ★★★ **락온이 정말 필요한 무기는 몇 개인가**');
{
  const need = WEAPON_LIST.filter((w) => whyNotFire({
    weapon: w, target: { dist: 60 }, locked: false, radar: true, cool: 0, supply: full,
  }) === 'lock');
  console.log(`   락온이 필요한 무기 — ${need.map((w) => `${w.slot}번 ${w.name}`).join(' · ') || '없다'}`);
  ok(need.length >= 1 && need.length < WEAPON_LIST.length,
    `★★★ **락온이 필요한 것은 ${need.length}개뿐이다** — 나머지는 락온 없이 나간다.`
    + ' 그러니 「락온했는데 안 나간다」의 까닭은 **거의 늘 락온이 아니다**');
}

console.log('\n[2] ★★★ **락온·레이더·재고를 다 갖췄는데 못 쏘는 자리**');
{
  console.log('   무기        사거리        못 쏘는 거리');
  for (const w of WEAPON_LIST) {
    const miss = [];
    for (const d of [20, 30, 40, 60, 90, 120, 160, 200, 240]) {
      const why = whyNotFire({
        weapon: w, target: { dist: d }, locked: true, radar: true, cool: 0, supply: full,
      });
      if (why) miss.push(`${d}m`);
    }
    console.log(`   ${w.slot}번 ${w.name.padEnd(6)} [${w.rMin}~${w.rMax}m]   ${miss.join(' ') || '없다'}`);
  }
  //  ★★★ 무기 셋을 합치면 **빈 거리가 없어야** 한다 — 있으면 그 거리에서
  //    사람은 「락온했는데 아무것도 안 나간다」를 겪는다
  const holes = [];
  for (let d = 20; d <= 240; d += 5) {
    const any = WEAPON_LIST.some((w) => !whyNotFire({
      weapon: w, target: { dist: d }, locked: true, radar: true, cool: 0, supply: full,
    }));
    if (!any) holes.push(d);
  }
  console.log(`   ★ 셋 다 안 되는 거리 — ${holes.length ? holes.join(' · ') + 'm' : '없다'}`);
  ok(!holes.length,
    '★★★ **어느 거리에도 나가는 무기가 하나는 있다** — 없으면 그 거리가 「락온했는데'
    + ' 안 나간다」의 정체가 된다');
}

console.log('\n[3] ★★★ **까닭이 몇 가지인가** — 다 다른 말을 하나');
{
  const kinds = new Set();
  for (const w of WEAPON_LIST) {
    for (const c of [
      { locked: false, radar: true, cool: 0, supply: full, d: 60 },
      { locked: true, radar: false, cool: 0, supply: full, d: 60 },
      { locked: true, radar: true, cool: 1, supply: full, d: 60 },
      { locked: true, radar: true, cool: 0, supply: { ammo: { ir: 0, arh: 0 } }, d: 60 },
      { locked: true, radar: true, cool: 0, supply: full, d: 300 },
      { locked: true, radar: true, cool: 0, supply: full, d: 10 },
    ]) {
      const why = whyNotFire({ weapon: w, target: { dist: c.d }, ...c });
      if (why) kinds.add(why);
    }
  }
  console.log(`   나올 수 있는 까닭 — ${[...kinds].map((k) => `${k}(${WHY[k] ?? '?'})`).join(' · ')}`);
  ok([...kinds].every((k) => WHY[k]),
    '★★★ **까닭마다 사람이 읽는 말이 있다** — 말이 없는 까닭은 「그냥 안 나간다」가 되고,'
    + ' 그게 사장님이 겪으신 「락온해도 안 되는 경우」다');
  ok(kinds.size >= 4,
    `★★ 까닭이 ${kinds.size} 가지다 — 하나로 뭉뚱그리면 무엇을 고쳐야 할지 모른다`);
}

console.log('\n[4] ★★★ **재고가 먼저 걸린다** — 거리를 묻는데 탄약이 대답한다');
{
  //  ★ v133 에 이걸로 한 번 뎄다: 사거리를 물었는데 `'ammo'` 가 나와서
  //    「닿는다」로 잘못 읽었다. 순서가 **재고 → 거리**라는 것을 적어 둔다
  const w = WEAPON_LIST.find((x) => x.slot === 3);
  const dry = whyNotFire({ weapon: w, target: { dist: 60 }, locked: true, radar: true, cool: 0, supply: { missiles: 99, ore: 99, parts: 99, ammo: { ir: 0, arh: 0 } } });
  const far = whyNotFire({ weapon: w, target: { dist: 300 }, locked: true, radar: true, cool: 0, supply: full });
  console.log(`   3번 · 재고 없음 60m → ${dry} · 재고 있음 300m → ${far}`);
  ok(dry === 'ammo' && far === 'far',
    '★★ **재고가 거리보다 먼저 걸린다** — 검사가 사거리를 물을 때는 재고를 채워야 한다');
}

console.log('\n[5] ★★★ **못 쏠 때 다음 손을 말하나** (v133)');
{
  const a = makeAmmo();
  for (const d of [20, 60, 100, 138, 200, 300]) {
    console.log(`   ${String(d).padStart(4)}m — ${reachWord(d, a)}`);
  }
  ok(/닿습니다|붙어야|떨어져야/.test(reachWord(138, a)),
    '★★★ **어느 무기가 닿는지 말한다** — 「안 된다」까지만 말하는 안내는 안내가 아니다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다');
process.exit(bad ? 1 : 0);
