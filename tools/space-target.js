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
import { AXES } from '../web/space/js/game/flight-table.js';
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
  // ★ v69 — **적 우주선은 `want` 에 안 센다.** 세면 적이 뜰 때마다 주울
  //   것이 줄어든다. 여기서도 떠도는 것만 세야 「하늘이 안 빈다」를 잰다
  const drift = s.list.filter((t) => !KINDS[t.kind]?.rams).length;
  console.log(`   4분에 ${spawned}개가 새로 났다 · 지금 떠도는 것 ${drift}개 · 적 ${s.list.length - drift}척`);
  ok(drift === wantCount(s), `늘 ${wantCount(s)}개가 떠 있다 (잔해밭)`);
  ok(spawned > 5, '지나간 만큼 새로 난다 — 한 번 쏘고 나면 텅 비지 않는다');
}

console.log('\n[2b] ★★★ **적 우주선이 저절로, 계속 오나** (v69)');
{
  // 사장님 「테스트 차원에서 적우주선 우주 쓰레기 위성등이 나타나도록 해줘. **계속**」
  // ★★ **부수면서 재야 한다.** 처음엔 안 부수고 10분을 돌렸더니 2척이
  //   나왔다 — 둘이 뜬 채로 안 죽으니 자리가 안 나서 그 뒤로 영영 안 온
  //   것이다. 그건 규칙이 틀린 게 아니라 **검사가 안 싸운 것**이다.
  //   사람은 부순다. 부수는 사람의 하늘을 재야 「계속 오나」가 나온다
  const s = fresh();
  let t = 0, most = 0;
  while (t < 600) {
    stepSky(s, DT, { moving: true });
    most = Math.max(most, summary(s).raiders);
    // 사거리에 들어온 적을 부순다 (사람이 하는 일)
    s.list = s.list.filter((x) => !(KINDS[x.kind]?.rams && x.dist < 130));
    t += DT;
  }
  const per = s.cameRaiders / 10;
  console.log(`   10분에 ${s.cameRaiders}척이 저절로 왔다 (분당 ${per.toFixed(1)}) · 한때 제일 많았을 때 ${most}척`);
  ok(s.cameRaiders >= 5,
    `★★ **불러야만 오는 것이 아니다** — 10분에 ${s.cameRaiders}척. v68 까지는 장면이 부를 때만 왔다`);
  ok(per >= 0.4 && per <= 1.6,
    `분당 ${per.toFixed(1)}척 (0.4~1.6) — 더 잦으면 쉴 틈이 없고, 뜸하면 격추 게임이 아니다`);
  ok(most <= TARGET.raiderMax,
    `★ 한 번에 ${TARGET.raiderMax}척을 안 넘는다 (제일 많았을 때 ${most}) — 넘으면 부술 수가 없어 사고가 된다`);
  // ★ 거점에서는 안 온다 — 사는 일이 벌이 되면 안 된다
  const q = fresh();
  let u = 0;
  while (u < 600) { stepSky(q, DT, { moving: true, quiet: true }); u += DT; }
  ok(q.cameRaiders === 0, '거점에 대고 있으면 **안 온다** — 사는 일이 벌이 되면 안 된다');
}

console.log('\n[2c] ★★★ **사방에 있나** — 「바로 뒤로 선회」의 근거 (v69)');
{
  const s = fresh();
  let t = 0;
  const seen = { front: 0, side: 0, back: 0 };
  while (t < 900) {
    stepSky(s, DT, { moving: true });
    for (const x of s.list) {
      const a = Math.abs(x.az);
      if (a < 60) seen.front++; else if (a < 120) seen.side++; else seen.back++;
    }
    t += DT;
  }
  const tot = seen.front + seen.side + seen.back;
  console.log(`   앞 ${(seen.front / tot * 100).toFixed(0)}% · 옆 ${(seen.side / tot * 100).toFixed(0)}% · 뒤 ${(seen.back / tot * 100).toFixed(0)}%`);
  ok(seen.back / tot > 0.15,
    `★★ **뒤에도 있다** (${(seen.back / tot * 100).toFixed(0)}%) — 뒤가 비어 있으면 360도 선회를 열어 준 뜻이 없다`);
  ok(seen.front / tot > 0.2, '앞에도 넉넉히 있다 — 늘 돌아야 하면 그건 조종이 아니라 숙제다');
  // ★★ **감기는가.** 처음엔 「180 근처에 아무것도 없다」로 물었는데
  //   그건 틀린 물음이었다 — 179.7도에 있는 것은 **정상**이다. 물어야 할
  //   것은 ① 값이 범위를 안 넘나 ② 이음매를 **넘어 다니나** 둘이다.
  //   되돌리기(반사)를 쓰면 ②가 0 이 되어 등 뒤에 안 보이는 벽이 생긴다
  const inRangeAz = s.list.every((x) => x.az >= -180 && x.az <= 180);
  ok(inRangeAz, '방위가 ±180 을 안 넘는다');
  const w = fresh();
  const one = w.list[0];
  one.az = 179.4; one.vaz = 3.5;
  for (let i = 0; i < 30; i++) stepSky(w, DT, { moving: false });
  ok(one.az < 0,
    `★★ 이음매를 **넘어간다** (179.4도 → ${one.az.toFixed(1)}도) — 되돌리면 거기 안 보이는 벽이 선다`);
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

  // ★★★ **v69 — 이 검사가 재던 것이 없어졌다.**
  //
  //   v68 까지 「끝에서 끝까지 WASD 로 몇 초」를 쟀다 (`GUN.aimRate` 26도/초).
  //   그런데 v64 에 **겨눔이 기수로 옮겨 갔고**(`noseAim()` — 조종간을 밀어
  //   기수를 돌리는 것이 곧 조준이다), WASD 조준은 그때 죽었다.
  //   검사만 옛 숫자를 계속 재고 있었다 — 그리고 v69 에 방위가 ±180 이
  //   되면서 **13.8초**가 나와 그제서야 빨개졌다. 3년치 중 제일 흔한 병이다:
  //   **검사가 없어진 것을 재고 있으면 조용하다가 엉뚱할 때 운다.**
  //
  //   재야 하는 것은 이제 **기수를 얼마나 빨리 돌리나**다
  const half = Math.PI / AXES.yaw.rate;               // 정면 → 바로 뒤 (라디안/rate)
  console.log(`   정면에서 **바로 뒤**까지 ${half.toFixed(1)}초 (조종간 ${AXES.yaw.rate} rad/s)`);
  ok(half >= 2 && half <= 6,
    `${half.toFixed(1)}초 (2~6) — 더 빠르면 큰 배가 아니고, 느리면 뒤를 잡는 동안 들이받힌다`);
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
  // ══ ★★★ **규칙이 바뀌었다** (v81) ═══════════════════════════════════
  //
  //  v69 의 규약은 「거리를 숫자로 안 띄운다」였다 — 눈은 **무엇인지**를,
  //  계기는 **얼마나 먼지**를 맡는다는 분업이었고 그건 지금도 맞다.
  //
  //  ★ 그런데 사장님이 화면을 보시고 「**124m가 멀다고 나오는데?? 앞으로
  //    다가가는 키는 뭐야?**」라고 물으셨다. 「멀다」는 **상태**이지
  //    **할 일**이 아니다. 그리고 지금 든 무기와 상관없이 말하고 있었다 —
  //    124m 는 레이저(90m)로는 못 쏘고 유도탄(240m)으로는 쏘는데 둘 다
  //    「멀다」였다.
  //
  //  ★★ 그래서 규칙을 **좁힌다**: 무기를 안 주면 옛날처럼 말로만 하고,
  //    **주면 「얼마나 더 가야 하는지」를 숫자로** 말한다. 숫자를 띄우는
  //    것이 아니라 **할 일을 말하는** 것이다
  ok(!/\d/.test([240, 120, 60, 20].map((d) => rangeWord(d)).join('')),
    '무기를 안 주면 여전히 숫자를 안 띄운다 (v69 규약)');
  // ★ 위 줄이 `.map(rangeWord)` 였다 — **map 은 둘째 인자로 첨자를 넘긴다.**
  //   그래서 120·60·20 이 무기 사거리 1·2·3 으로 불렸고, 규칙을 고치자
  //   엉뚱하게 빨개졌다. 검사가 저 혼자 틀린 값을 만들고 있었던 것이다
  ok(rangeWord(124, 90).includes('34m'), '★ 사거리 밖이면 **얼마나 더**를 말한다 (124m · 레이저 90m)');
  ok(rangeWord(124, 90).includes('W'), '★ 그리고 **무슨 키**인지도 말한다 — 상태가 아니라 할 일이다');
  ok(!/\d/.test(rangeWord(70, 90)), '사거리 안이면 숫자를 안 띄운다 — 「쏠 수 있습니다」');
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
