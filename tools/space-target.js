// ══════════════════════════════════════════════════════════════════════════
//  떠도는 것들 — **겨누는 것이 겨누는 것이 되나.**
//
//    node tools/space-target.js
//
//  ★ 사장님: 「실제 우주 쓰레기나 위성 등이 우주에 떠돌아 다녀서
//            맞출 수 있도록 해주고」
//
//  ★ 여기서 묻는 것은 「맞나」가 아니라 넷이다:
//      ① **가만히 있는 과녁이 아닌가** — 흐르고, 다가오고, 지나간다
//      ② **겨누는 것이 일인가** — 대충 쏴서 맞으면 겨눈 것이 아니다
//      ③ **무엇을 쏠까가 생기나** — 나오는 것이 달라야 고를 이유가 있다
//      ④ **쏘는 것이 남는 장사인가** — 탄약이 곧 수리 재료다
// ══════════════════════════════════════════════════════════════════════════
import { KINDS, TARGET, pickKind, rangeWord } from '../web/space/js/game/target-table.js';
import {
  makeSky, setRegion, stepSky, shootSky, aimedAt, tolOf, inRange, wantCount, summary,
} from '../web/space/js/game/target.js';
import { GUN } from '../web/space/js/game/gun-table.js';
import { REGIONS } from '../web/space/js/game/regions-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DT = 1 / 30;

/** 같은 하늘을 두 번 돌리려고 난수도 표처럼 굴린다 */
function rngOf(seed = 11) {
  let h = seed >>> 0;
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507)) >>> 0) / 4294967296;
}
const fresh = (region = 'debris', seed = 11) => {
  const s = makeSky(rngOf(seed));
  setRegion(s, region);
  stepSky(s, DT, {});
  return s;
};

console.log('\n떠도는 것들 — 겨누는 것이 겨누는 것이 되나');

console.log('\n[1] **가만히 있는 과녁이 아닌가**');
{
  const s = fresh();
  const a0 = s.list.map((t) => ({ az: t.az, el: t.el, d: t.dist }));
  let t = 0;
  while (t < 12) { stepSky(s, DT, { moving: true }); t += DT; }
  const moved = s.list.filter((x, i) => a0[i] && Math.abs(x.az - a0[i].az) > 0.5).length;
  console.log(`   12초 뒤 — 자리를 옮긴 것 ${moved}/${a0.length}`);
  ok(moved >= Math.floor(a0.length * 0.6), '대부분이 흘러간다 — 세워 둔 과녁이 아니다');
  const closer = s.list.filter((x, i) => a0[i] && x.dist < a0[i].d).length;
  ok(closer >= Math.floor(a0.length * 0.6), '다가온다 — 배가 가고 있으니까');

  // 서 있으면 안 다가온다
  const s2 = fresh();
  const d0 = s2.list[0].dist;
  let u = 0;
  while (u < 12) { stepSky(s2, DT, { moving: false }); u += DT; }
  ok(Math.abs(s2.list[0].dist - d0) < 0.5, '배가 서 있으면 안 다가온다 — 창밖과 같은 규약');
}

console.log('\n[2] 지나간 것은 **새로 난다** — 하늘이 안 빈다');
{
  const s = fresh();
  let t = 0, spawned = 0, last = s.list.map((x) => x.id);
  while (t < 240) {
    stepSky(s, DT, { moving: true });
    const now = s.list.map((x) => x.id);
    spawned += now.filter((i) => !last.includes(i)).length;
    last = now;
    t += DT;
  }
  console.log(`   4분에 ${spawned}개가 새로 났다 · 지금 ${s.list.length}개`);
  ok(s.list.length === wantCount(s), `늘 ${wantCount(s)}개가 떠 있다 (잔해밭)`);
  ok(spawned > 5, '지나간 만큼 새로 난다 — 한 번 쏘고 나면 텅 비지 않는다');
}

console.log('\n[3] 구역마다 다르다 — **어디를 고르는가가 여기에도 닿는다**');
{
  for (const r of REGIONS) {
    const s = fresh(r.key);
    console.log(`   ${r.name.padEnd(5)} ${s.list.length}개`);
  }
  const neb = fresh('nebula').list.length;
  const deb = fresh('debris').list.length;
  ok(deb > neb, `잔해밭(${deb})이 성운(${neb})보다 많다 — 성운은 안 보인다`);
  ok(neb >= 1, '성운에도 하나는 있다 — 0 이면 그 구역에서 주포가 죽는다');
}

console.log('\n[4] ★★ **겨누는 것이 일인가** — 대충 쏴서 맞으면 안 된다');
{
  const s = fresh();
  const t = s.list[0];
  // 정확히 겨누면 맞는다
  const hit = shootSky(fresh(), s.list[0].az, s.list[0].el);
  ok(hit.hit, '정확히 겨누면 맞는다');
  // 조금 벗어나면 안 맞는다
  const tol = tolOf(t);
  const miss = shootSky(fresh(), s.list[0].az + tol * 2.2, s.list[0].el);
  ok(!miss.hit, `${(tol * 2.2).toFixed(1)}도 벗어나면 빗나간다 (허용 ${tol.toFixed(1)}도)`);
  console.log(`   허용 각 — 파편 ${tolOf({ kind: 'junk' }).toFixed(1)}도 · 위성 ${tolOf({ kind: 'sat' }).toFixed(1)}도 · 연료통 ${tolOf({ kind: 'tank' }).toFixed(1)}도`);
  ok(tolOf({ kind: 'sat' }) > tolOf({ kind: 'tank' }), '큰 것이 맞히기 쉽다');

  // ★ **얼마나 돌려야 하나** — 끝에서 끝까지 WASD 로
  const sweep = (TARGET.azLimit * 2) / GUN.aimRate;
  console.log(`   왼끝에서 오른끝까지 ${sweep.toFixed(1)}초 (WASD ${GUN.aimRate}도/초)`);
  ok(sweep >= 3 && sweep <= 12,
    `${sweep.toFixed(1)}초 (3~12) — 더 빠르면 휘두르는 것이고, 느리면 지나가는 것을 못 따라간다`);
  ok(GUN.aimRate > Math.max(...TARGET.driftAz.map(Math.abs)) * 3,
    `조준(${GUN.aimRate}도/초)이 흐름(${Math.max(...TARGET.driftAz.map(Math.abs))}도/초)보다 훨씬 빠르다 — 따라잡을 수 있다`);
}

console.log('\n[5] **사거리** — 보이는데 안 맞는 것이 있어야 「기다렸다 쏜다」가 생긴다');
{
  const far = { kind: 'junk', dist: TARGET.range + 30 };
  ok(!inRange(far), `${far.dist}m 는 사거리 밖 (${TARGET.range}m)`);
  ok(inRange({ kind: 'junk', dist: TARGET.range - 10 }), '가까워지면 들어온다');
  const s = fresh();
  const outside = s.list.filter((t) => !inRange(t)).length;
  console.log(`   지금 떠 있는 것 중 사거리 밖 ${outside}/${s.list.length}`);
  console.log(`   ${[240, 120, 60, 20].map((d) => `${d}m → ${rangeWord(d)}`).join(' · ')}`);
  ok(!/\d/.test([240, 120, 60, 20].map(rangeWord).join('')), '거리를 숫자로 안 띄운다');
}

console.log('\n[6] ★★ **무엇을 쏠까가 생기나** — 나오는 것이 달라야 한다');
{
  for (const k of Object.values(KINDS)) {
    const g = k.gives;
    console.log(`   ${k.name.padEnd(7)} ${k.hits}발 · 광석 ${g.ore} · 부품 ${g.parts} · 식량 ${g.food}  — ${k.what}`);
  }
  ok(KINDS.sat.gives.parts > 0 && KINDS.junk.gives.parts === 0,
    '**위성에서만 부품이 나온다** — 그래서 위성을 고른다');
  ok(KINDS.tank.gives.food > 0 && KINDS.sat.gives.food === 0,
    '**연료통에서만 식량이 나온다**');
  ok(KINDS.sat.hits > KINDS.junk.hits, '좋은 것은 두 발 든다 — 공짜가 아니다');
  // 흔한 정도
  const rnd = rngOf(5);
  const cnt = {};
  for (let i = 0; i < 3000; i++) { const k = pickKind(rnd); cnt[k.key] = (cnt[k.key] ?? 0) + 1; }
  console.log(`   3000번 뽑기 — ${Object.entries(cnt).map(([k, v]) => `${KINDS[k].name} ${(v / 30).toFixed(0)}%`).join(' · ')}`);
  ok(cnt.junk > cnt.sat && cnt.sat > cnt.tank, '파편 > 위성 > 연료통 — 좋은 것이 드물다');
}

console.log('\n[7] ★★ **쏘는 것이 남는 장사인가** — 탄약이 곧 수리 재료다');
{
  for (const k of Object.values(KINDS)) {
    const cost = GUN.costOre * k.hits;
    const net = k.gives.ore - cost;
    console.log(`   ${k.name.padEnd(7)} 광석 ${cost} 써서 광석 ${k.gives.ore}${k.gives.parts ? ` + 부품 ${k.gives.parts}` : ''}${k.gives.food ? ` + 식량 ${k.gives.food}` : ''}  (광석만 보면 ${net >= 0 ? '+' : ''}${net})`);
  }
  ok(KINDS.junk.gives.ore > GUN.costOre * KINDS.junk.hits,
    '파편은 광석만으로도 남는다 — 안 그러면 아무도 안 쏜다');
  // ★ 다만 **크게 남으면 안 된다.** 그러면 「쏘고 줍기」가 이 게임이 된다
  const gain = KINDS.junk.gives.ore / (GUN.costOre * KINDS.junk.hits);
  ok(gain <= 3,
    `파편이 ${gain.toFixed(1)}배 (3배 이하) — 더 남으면 항로도 정비도 다 제치고 **쏘고 줍는 게임**이 된다`);
  ok(KINDS.sat.gives.ore < GUN.costOre * KINDS.sat.hits + 12,
    '위성은 광석만 보면 거의 본전 — **부품 하나 때문에** 쏘는 것이다');
}

console.log('\n[8] 조준선이 **뭘 물었는지** 말하나');
{
  const s = fresh();
  const t = s.list[0];
  const a = aimedAt(s, t.az, t.el);
  ok(a && a.t === t && a.off < 0.01, '겨눈 자리의 것을 집어 준다');
  const far = aimedAt(s, 200, 200);
  ok(far && far.off > 100, '아무것도 없는 쪽을 보면 제일 가까운 것과 거리를 준다');
  ok(aimedAt({ list: [] }, 0, 0) === null, '하늘이 비면 null — 조준경이 「없습니다」를 띄운다');
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「쏘는 맛이 나나」는 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「겨누는 것이 일인가 · 무엇을 쏠까가 생기나 · 남는 장사인가」뿐이다.');
console.log('     조준경이 화면에 정말 뜨나는 space-endtoend.js 가 본다.');
process.exit(fail ? 1 : 0);
