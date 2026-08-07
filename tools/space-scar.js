// ══════════════════════════════════════════════════════════════════════════
//  영구 손상 — **배가 망가져 가나, 아니면 그냥 못 쓰게 되나.**
//
//    node tools/space-scar.js
//
//  ★ 여기서 묻는 것은 「흉터가 생기나」가 아니라 넷이다:
//      ① **어떻게 몰았는지가 정하나** — 혹사하면 남고 조심하면 안 남나
//      ② **몇 개나** — 0 이면 안 보이고, 넷이면 못 쓰는 배다
//      ③ **언제** — 20분에 다 나면 그건 흉터가 아니라 난이도다
//      ④ **우회할 수 있나** — 못 고치는 것에 길이 없으면 그건 벽이다
//
//  ★★ 그리고 이 도구가 **기획서를 한 번 뒤집었다.**
//    `PLAN2H §8` 의 「같은 계통 세 번 고장」을 그대로 세니 20분이면
//    세 계통이 다 흉터였다 — 재기 전에 쓴 숫자였다 (`PLANNING.md`).
// ══════════════════════════════════════════════════════════════════════════
import { SCAR, SCARS, EARNED, scarWord } from '../web/space/js/game/scar-table.js';
import { makeScars, noteFix, noteScene, has, valveMult, signOf, list }
  from '../web/space/js/game/scar.js';
import { makeFaults, stepFaults, clear, wearStep } from '../web/space/js/game/fault.js';
import { WEAR, VALVE, HEAT } from '../web/space/js/game/systems-table.js';
import { SIGN, HEATING } from '../web/space/js/game/chase-table.js';
import { SINK } from '../web/space/js/game/heat-table.js';
import { LOCK } from '../web/space/js/game/airlock-table.js';
import { HELM, signMult as helmSign } from '../web/space/js/game/helm-table.js';
import { REGION_BY_KEY } from '../web/space/js/game/regions-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DT = 1 / 3;
const RUN = 7200;   // 2시간

/**
 * 회차 하나를 굴린다. **고장이 뜨면 `fixSec` 초 뒤에 고친 것으로 친다** —
 * 실제로는 걷고 잡는 시간이 그만큼 든다 (`PLAN §11` 「문제 하나 40초~2분」).
 */
function run(seed, prof, fixSec = 60) {
  const f = makeFaults(seed);
  const sc = makeScars();
  let t = 0, leg = 1, busy = 0, cur = null, fixed = 0;
  const byLeg = [];
  while (t < RUN) {
    wearStep(f, DT, prof);
    if (stepFaults(f, DT, { calm: true, leg }) === 'spawn' && !cur) {
      cur = f.open[f.open.length - 1]; busy = fixSec;
    }
    if (cur) {
      busy -= DT;
      if (busy <= 0) {
        // ★ **마모를 덜기 전에** 센다 — clear() 가 relief 를 빼므로
        //   뒤에 세면 방금 혹사한 것이 멀쩡한 것으로 읽힌다
        const made = noteFix(sc, cur.sys, f.wear, t / 60);
        if (made) byLeg.push({ key: made, min: Math.round(t / 60) });
        clear(f, cur); cur = null; fixed++;
      }
    }
    t += DT; leg = Math.min(12, 1 + Math.floor(t / 600));
  }
  return { sc, fixed, byLeg };
}

/** 세 사람 — 어떻게 몰았나 */
const WAYS = {
  혹사: { power: { thrust: true, cool: true, sensor: true }, valveOpen: true, region: 'debris' },
  보통: { power: { thrust: true, cool: true }, valveOpen: true, region: 'empty' },
  조심: { power: { thrust: true, cool: false }, valveOpen: false, region: 'empty' },
};
const SEEDS = ['A', 'B', 'C', 'D'];

console.log('\n영구 손상 — 배가 망가져 가나, 아니면 그냥 못 쓰게 되나');
console.log(`  (기준 마모 ${SCAR.scarAt} 위에서 ${SCAR.need}번 고치면 흉터 · 2시간)`);

console.log('\n[1] 2시간에 고장을 몇 개나 고치나 — **기획서의 「세 번」을 여기에 견준다**');
{
  const rows = SEEDS.map((s) => run(s, WAYS.보통));
  const avg = rows.reduce((a, r) => a + r.fixed, 0) / rows.length;
  console.log(`   고친 것 ${rows.map((r) => r.fixed).join(' / ')} — 평균 ${avg.toFixed(0)}개`);
  console.log(`   계통이 셋이니 계통당 ${(avg / 3).toFixed(0)}회쯤`);
  ok(avg / 3 > SCAR.need * 2,
    `계통당 ${(avg / 3).toFixed(0)}회 — **「고친 횟수 세 번」으로 세면 회차 초반에 다 흉터**가 된다`);
  console.log('   ※ 그래서 세는 것을 「고친 횟수」가 아니라 **「닳은 채로 고친 횟수」**로 바꿨다');
}

console.log('\n[2] ★★ **어떻게 몰았는지가 정하나**');
{
  const out = {};
  for (const [name, prof] of Object.entries(WAYS)) {
    const rows = SEEDS.map((s) => run(s, prof));
    const n = rows.map((r) => r.sc.got.length);
    out[name] = n;
    console.log(`   ${name}  흉터 ${n.join('/')}  ${scarWord(rows[0].sc.got)}`);
  }
  ok(Math.max(...out.혹사) >= 2, `혹사하면 둘 이상 남는다 (${out.혹사.join('/')})`);
  ok(Math.max(...out.조심) === 0, `조심하면 하나도 안 남는다 (${out.조심.join('/')})`);
  ok(Math.max(...out.보통) >= 1 && Math.max(...out.보통) < Math.max(...out.혹사),
    `보통은 그 사이다 (${out.보통.join('/')}) — **갈래가 셋으로 갈린다**`);
  ok(Math.max(...out.혹사) <= SCAR.maxPerRun,
    `제일 험하게 몰아도 ${Math.max(...out.혹사)}개 (상한 ${SCAR.maxPerRun}) — 넷이면 못 쓰는 배다`);
}

console.log('\n[3] **언제** 생기나 — 20분에 다 나면 그건 난이도지 흉터가 아니다');
{
  const rows = SEEDS.map((s) => run(s, WAYS.혹사));
  const all = rows.flatMap((r) => r.byLeg);
  const first = rows.map((r) => r.byLeg[0]?.min).filter((x) => x != null);
  console.log(`   첫 흉터 ${first.join('분 / ')}분`);
  console.log(`   생긴 것들 — ${all.slice(0, 6).map((x) => `${SCARS[x.key].name}(${x.min}분)`).join(' · ')}`);
  ok(Math.min(...first) >= 15, `제일 이른 것이 ${Math.min(...first)}분 — 배를 익히기도 전에는 안 생긴다`);
  ok(Math.max(...first) <= 75, `제일 늦은 것도 ${Math.max(...first)}분 — 회차 안에 겪는다`);
}

console.log('\n[4] ★★ **우회할 수 있나** — 못 고치는 것에 길이 없으면 벽이다');
{
  const sc = makeScars();
  // 냉각 흉터 — 밸브가 두 배
  for (let i = 0; i < SCAR.need; i++) noteFix(sc, 'cool', { cool: 1 }, 30);
  ok(has(sc, 'cool'), `냉각 흉터가 생겼다 — 「${SCARS.cool.what}」`);
  const turn = VALVE.turnTime * valveMult(sc);
  console.log(`   밸브 ${VALVE.turnTime}초 → ${turn}초 · 우회 — ${SCARS.cool.around}`);
  ok(turn > VALVE.turnTime && turn <= 6,
    `${turn}초 (6초 이하) — 손이 더 묶이되 **쳇바퀴는 아니다**`);
  // ★ 밸브가 느려도 **다른 길로 열이 빠지나**
  const valveCool = SINK.dumpRate;   // ★ v58 — 식히는 것은 라디에이터다 (heat-table.js)
  ok(LOCK.heatOut > 0 && LOCK.heatOut < valveCool,
    `바깥문으로도 식는다 (-${LOCK.heatOut}/초) — 밸브(-${valveCool.toFixed(1)})보다 약하지만 **길이 있다**`);

  // 선체 흉터 — 자국이 늘 굵다
  const sc2 = makeScars();
  for (let i = 0; i < SCAR.need; i++) noteFix(sc2, 'hull', { hull: 1 }, 40);
  ok(has(sc2, 'hull'), `선체 흉터가 생겼다 — 「${SCARS.hull.what}」`);
  const base = SIGN.base + HEAT.start * SIGN.perHeat + signOf(sc2);
  console.log(`   가만히 있어도 자국 ${base.toFixed(0)} (접촉 기준 ${SIGN.contactAt})`);
  ok(base < SIGN.contactAt,
    `${base.toFixed(0)} < ${SIGN.contactAt} — **혼자서는 못 넘긴다.** 흉터가 곧 추격이면 그건 사형이다`);
  // ★ 우회 — 조종간으로 벗어나거나 성운을 고르면 도로 내려간다
  const hidden = base * helmSign(0.8) * REGION_BY_KEY.nebula.signMult;
  ok(hidden < base * 0.5,
    `항로를 벗어나고 성운을 고르면 ${hidden.toFixed(0)} — **조종간과 항로가 답이 된다**`);
}

console.log('\n[5] **안 없어진다** — 지우는 길이 없어야 영구다');
{
  const sc = makeScars();
  for (let i = 0; i < SCAR.need; i++) noteFix(sc, 'cool', { cool: 1 }, 30);
  const before = [...sc.got];
  // 멀쩡해질 만큼 고쳐도
  for (let i = 0; i < 20; i++) noteFix(sc, 'cool', { cool: 0 }, 60);
  ok(JSON.stringify(sc.got) === JSON.stringify(before), '아무리 고쳐도 안 없어진다');
  ok(!Object.keys(await import('../web/space/js/game/scar.js')).some((k) => /heal|clear|remove/i.test(k)),
    '지우는 함수가 **아예 없다** — 있으면 언젠가 어쩌다 지워지는 길이 생긴다');
}

console.log('\n[6] 장면이 주는 것 — 자세 제어(구간 11)도 **같은 목록**에 든다');
{
  const sc = makeScars();
  ok(noteScene(sc, 'drift', 110) === 'drift', '구간 11 의 영구 손상이 흉터 목록에 든다');
  ok(!noteScene(sc, 'drift', 120), '두 번 안 들어간다');
  ok(SCARS.drift.fromScene, '다만 **닳아서 생기는 것이 아니다** — 배치가 정한다');
  ok(list(sc).length === 1 && list(sc)[0].around, '끝 화면이 읽을 한 줄과 우회로가 있다');
}

console.log('\n[7] 사람에게 뭐라고 말하나');
{
  console.log(`   ${scarWord([])}`);
  console.log(`   ${scarWord(['cool', 'hull'])}`);
  for (const s of Object.values(SCARS)) console.log(`   ${s.name} — ${s.what} / 우회: ${s.around}`);
  ok(Object.values(SCARS).every((s) => s.lead && s.what && s.around),
    '셋 다 「무엇이 달라지나」와 「그럼 어떻게 하나」를 갖는다');
  ok(!/\d/.test(Object.values(SCARS).map((s) => s.lead + s.what + s.around).join('')),
    '숫자로 안 띄운다');
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **전력 흉터(「차단기 셋 중 하나」)는 안 만들었다.** 전력 마모는');
console.log('     `WEAR.rate` 가 base 뿐이라 아무리 혹사해도 안 찬다 — 없는 조건에');
console.log('     걸어 두면 「표에는 있는데 한 번도 안 뜨는」 것이 된다. 걸 자리가');
console.log('     생기면 그때 만든다 (PLAN2H §8 에 적어 뒀다).');
process.exit(fail ? 1 : 0);
