// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **아크 도약** — 뼈대만 시뮬한다 (v99)
//
//    node tools/space-arc.js
//
//  ★ 사장님 「미구현 구현해」 · 「3d 게임이기에 모든 검증과 설계는
//    **블록아웃으로 진행하고 테스트하고 구현해**」
//
//  ══ 이 도구는 **게임을 안 부른다** ═══════════════════════════════════
//
//  `arc.js` · `arc-table.js` 만 돌린다. three 도 브라우저도 안 쓴다.
//  여기서 다 ✔ 가 된 뒤에 게임에 붙인다 — 그게 이 저장소의 순서다.
//
//  ★★★ 묻는 것 다섯
//      ① 마디 셋이 도나 (재기 → 뛰기 → 도착)
//      ② **못 뛰는 이유를 말하나** — 조용히 안 되면 「고장」으로 읽힌다
//      ③ **공짜가 아닌가** — 전지 · 무방비 · 열 · **건너뛴 재료**
//      ④ **회차에 몇 번 뛸 수 있나** — 기본이 되어도 안 되고 없으나 마나여도 안 된다
//      ⑤ **뛰는 것이 늘 정답이 아닌가** — 늘 이득이면 그건 갈래가 아니다
// ══════════════════════════════════════════════════════════════════════════
import {
  PHASE, ARC, WHY, whyNotJump,
} from '../web/space/js/game/arc-table.js';
import {
  makeArc, beginCharge, stopCharge, stepArc, heatOf, burstHeat, chargeK, summary,
} from '../web/space/js/game/arc.js';
import { SINK } from '../web/space/js/game/heat-table.js';
import { LEG } from '../web/space/js/game/route-table.js';
import { KINDS } from '../web/space/js/game/target-table.js';
// ★ `target.js` 는 순수하다 (three 를 안 쓴다) — 뼈대를 하나 더 돌리는 것이다
import { makeSky, setRegion, stepSky } from '../web/space/js/game/target.js';
import { ITEMS, MASS, HOLD } from '../web/space/js/game/cargo-table.js';
import { packOf } from '../web/space/js/game/salvage-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const head = (t) => console.log(`\n${t}`);
const DT = 1 / 20;

console.log('아크 도약 — 뼈대만 (게임을 안 부른다)');
console.log(`   전지 ${ARC.cells}개 · 재기 ${ARC.charge}초 · 뛰기 ${ARC.fly}초`
  + ` · 건너뛰기 ${(ARC.skip * 100).toFixed(0)}% · 대기 ${ARC.cool}초`);

// ══════════════════════════════════════════════════════════════════════════
head('[1] 마디 셋이 도나 — 재기 → 뛰기 → 도착');
{
  const a = makeArc();
  const r = beginCharge(a, { cells: ARC.cells, sinkAt: 0.1 });
  ok(r.ok && a.phase === PHASE.CHARGE, `★ 걸린다 (전지 ${r.cells}개를 태운다)`);

  let ev = null, t = 0, heat = 0;
  while (t < ARC.charge + 1 && ev !== 'jump') {
    heat += heatOf(a, DT);
    ev = stepArc(a, DT, { sinkAt: 0.1 });
    t += DT;
  }
  ok(ev === 'jump' && a.phase === PHASE.JUMP, `★ ${ARC.charge}초를 재면 **뛴다** (${t.toFixed(1)}초)`);
  ok(heat > 200, `★★ 재는 동안 열이 **${heat.toFixed(0)}** 쌓였다 (저장고 ${SINK.max} 의 ${(heat / SINK.max * 100).toFixed(0)}%)`);

  let ev2 = null, t2 = 0;
  while (t2 < ARC.fly + 1 && ev2 !== 'land') { ev2 = stepArc(a, DT, {}); t2 += DT; }
  ok(ev2 === 'land' && a.phase === PHASE.NONE, `★ ${ARC.fly}초 뒤 **도착한다** (${t2.toFixed(1)}초)`);
  ok(a.jumps === 1 && a.skipped > 0,
    `★★★ 구간의 ${(ARC.skip * 100).toFixed(0)}% 를 건너뛰었다 — **${(a.skipped / 60).toFixed(1)}분**`);
  ok(a.cool === ARC.cool, `★ 대기가 걸린다 (${ARC.cool}초) — 연달아 뛰어 구간을 통째로 넘기지 못하게`);
}

// ══════════════════════════════════════════════════════════════════════════
head('[2] ★★ **못 뛰는 이유를 말하나** — 조용히 안 되면 「고장」이다');
{
  const cases = [
    [{ cells: 0 }, 'cells'],
    [{ cells: ARC.cells, sinkAt: 0.9 }, 'sink'],
    [{ cells: ARC.cells, power: false }, 'power'],
    [{ cells: ARC.cells, landed: true }, 'land'],
    [{ cells: ARC.cells, cool: 30 }, 'cool'],
    [{ cells: ARC.cells, phase: PHASE.CHARGE }, 'busy'],
  ];
  for (const [o, want] of cases) {
    const got = whyNotJump({ power: true, ...o });
    ok(got === want, `${String(want).padEnd(6)} → 「${WHY[want]}」`);
  }
  ok(whyNotJump({ cells: ARC.cells, sinkAt: 0.1, power: true }) === null,
    '★ 다 되면 아무 말도 안 한다');
  // ★ 이유가 **다 쓰이나** — 안 쓰이는 말은 낡는다
  const used = new Set(cases.map(([, w]) => w));
  ok(Object.keys(WHY).every((k) => used.has(k)),
    `★★ 여섯 가지 이유가 **다 난다** (안 나는 말은 낡는다)`);
}

// ══════════════════════════════════════════════════════════════════════════
head('[3] ★★★ **공짜가 아닌가** — 값이 넷이다');
{
  const a = makeArc();
  beginCharge(a, { cells: ARC.cells, sinkAt: 0.1 });
  // ① 전지
  ok(ARC.cells >= 2, `① **전지 ${ARC.cells}개** — 적에게서만 나온다 (${ITEMS.arc.from.join('·')})`);
  ok(ITEMS.arc.from.length === 1 && ITEMS.arc.from[0] === 'foe',
    '★★★ 거점에서 **안 판다** — 팔면 「싸워야 얻는다」 고리가 끊어진다 (WAR.md §14-3)');
  // ② 무방비 — 그만두면 전지를 안 돌려준다
  const before = a.phase;
  stopCharge(a);
  ok(before === PHASE.CHARGE && a.phase === PHASE.NONE,
    '② 중간에 그만둘 수 있다 — 다만 **전지는 안 돌려준다**');
  ok(ARC.charge >= 20,
    `★ 재는 ${ARC.charge}초가 **짧지 않다** — 즉발이면 그건 무적 단추다`);
  // ③ 열
  const heat = ARC.heatRate * ARC.charge + ARC.heatBurst;
  const dump = heat / SINK.dumpRate;
  ok(dump > 30,
    `③ 열 ${heat.toFixed(0)} → 도착해서 **${dump.toFixed(0)}초를 버려야** 한다`
    + ' (라디에이터를 열면 눈에 띈다 — 뛴 값을 도착지에서 치른다)');
  // ④ ★ 건너뛴 재료 — 이 계통의 심장
  const legSec = LEG.seconds;
  const lost = legSec * ARC.skip;
  ok(lost > 120,
    `④ ★★★ **${(lost / 60).toFixed(1)}분을 건너뛴다** — 그 사이의 적도 재료도 못 만난다.`
    + ' 목적이 「뚫는다 · **채운다** · 떨군다」이므로 이것은 목적에서 **직접** 멀어지는 값이다');
}

// ══════════════════════════════════════════════════════════════════════════
head('[4] ★★ **회차에 몇 번 뛸 수 있나** — 기본도 아니고 없으나 마나도 아니게');
{
  // ══ ★★★ 손으로 셈하지 않는다 — **항로를 시늉해서 센다** ═══════════
  //
  //  ★ 처음엔 「물결이 112초마다 · 2~4대」로 손 계산을 했다가 **157대**가
  //    나왔다. 실제로는 동시 상한(`raiderMax`)이 있어서 **잡아야 다음이
  //    온다** — 즉 등장 수는 **잡는 속도**가 정한다. 손 계산은 그 고리를
  //    통째로 빠뜨렸다.
  //  ★★ `target.js` 는 순수하다 (three 를 안 쓴다). 그러니 이건 「게임을
  //    부르는 것」이 아니라 **뼈대를 하나 더 돌리는 것**이다
  const runSec = LEG.seconds * LEG.count;
  const rows = [];
  for (const killIn of [18, 30, 45]) {
    let seed = 7;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const sky = makeSky(rnd);
    setRegion(sky, 'belt');
    const born = new Map();
    let cells = 0;
    const DT2 = 0.25;
    for (let t = 0; t < runSec; t += DT2) {
      stepSky(sky, DT2, {});
      for (const x of sky.list) if (!born.has(x.id)) born.set(x.id, t);
      for (const x of [...sky.list]) {
        const k = KINDS[x.kind];
        if (!(k.shoots || k.rams)) continue;
        if (t - (born.get(x.id) ?? t) > killIn) {
          sky.list = sky.list.filter((y) => y !== x);
          cells += k.gives?.arc ?? 0;
        }
      }
    }
    rows.push({ killIn, cells });
  }
  console.log(`   회차 ${(runSec / 60).toFixed(0)}분 — 한 대 잡는 데 걸리는 시간별로`);
  let lo = 99, hi = 0;
  for (const r of rows) {
    // ★ 다 줍지는 못한다 — 꾸러미는 55초 뒤 흩어진다 (`salvage-table.js PACK.live`)
    const got = [0.35, 0.65].map((f) => Math.floor((r.cells * f) / ARC.cells));
    lo = Math.min(lo, got[0]); hi = Math.max(hi, got[1]);
    console.log(`     ${String(r.killIn).padStart(2)}초 → 전지 ${String(r.cells).padStart(3)}개`
      + `  · 35~65% 회수면 **${got[0]}~${got[1]}번**`);
  }
  ok(lo >= 2, `★ 제일 적게 잡아도 ${lo}번 — **없으나 마나가 아니다**`);
  ok(hi <= LEG.count, `★★ 제일 많이 잡아도 ${hi}번 — 12구간보다 적어서 **매 구간 뛸 수는 없다**`);
  // ★★★ 무게가 값이다 — 실으면 채울 자리가 준다
  const load = ARC.cells * MASS.mid;
  ok(load >= HOLD * 0.15,
    `★★★ 한 번 치가 **${load}짐** (화물칸 ${HOLD} 의 ${(load / HOLD * 100).toFixed(0)}%) —`
    + ' 탄두 재료 다섯이 정확히 100 이므로 **뛸 채비를 실으면 채울 자리가 준다**');
  // 대기가 구간을 통째로 넘기는 것을 막나
  const backToBack = (ARC.charge + ARC.fly + ARC.cool);
  const twoSkip = LEG.seconds * ARC.skip * 2;
  ok(backToBack > 60,
    `★ 연달아 뛰려면 ${backToBack.toFixed(0)}초가 든다 — 두 번이면 ${(twoSkip / 60).toFixed(1)}분을 건너뛰지만`
    + ` 그 사이 ${(backToBack / 60).toFixed(1)}분을 **버텨야** 한다`);
}

// ══════════════════════════════════════════════════════════════════════════
head('[5] ★★★ **뛰는 것이 늘 정답은 아닌가** — 늘 이득이면 갈래가 아니다');
{
  // 「싸운다」와 「뛴다」를 나란히 놓는다. 재료로 견준다 — 목적이 「채운다」다
  const foe = KINDS.raider;
  const legSec = LEG.seconds;
  const skipSec = legSec * ARC.skip;
  const waveEvery = (85 + 140) / 2;
  const perWave = (2 + 4) / 2;
  // 건너뛴 동안 만났을 적 수
  const missed = (skipSec / waveEvery) * perWave;
  const missedOre = missed * foe.gives.ore;

  const rows = [
    ['싸운다', `${skipSec.toFixed(0)}초`, `적 ${missed.toFixed(1)}대 · 광석 ${missedOre.toFixed(0)}`, '맞을 수 있다 · 고장이 는다'],
    ['뛴다', `${(ARC.charge + ARC.fly).toFixed(0)}초`, '아무것도 없음', `전지 ${ARC.cells} · 열 ${(ARC.heatRate * ARC.charge + ARC.heatBurst).toFixed(0)}`],
  ];
  console.log('   무엇을        시간      얻는 것                        치르는 것');
  for (const r of rows) {
    console.log(`   ${r[0].padEnd(8)} ${r[1].padStart(6)}   ${r[2].padEnd(28)} ${r[3]}`);
  }
  ok(missedOre > 0,
    `★★★ 뛰면 **광석 ${missedOre.toFixed(0)} 과 적 ${missed.toFixed(1)}대**를 못 만난다 —`
    + ' 즉 뛰는 것은 **탄두가 늦어지는 것**이다');
  ok(ARC.charge > ARC.fly * 4,
    `★★ 시간도 크게 안 아낀다 (재기 ${ARC.charge}초 + 뛰기 ${ARC.fly}초 = ${(ARC.charge + ARC.fly).toFixed(0)}초로`
    + ` ${skipSec.toFixed(0)}초를 산다) — **목숨을 사는 것이지 시간을 사는 것이 아니다**`);
  ok(ARC.sinkMax < 0.7,
    `★ 저장고가 ${(ARC.sinkMax * 100).toFixed(0)}% 만 차도 **못 건다** — 스텔스로 달리던 중에는 못 뛴다.`
    + ' 즉 「숨을까 뛸까」가 같은 저울에 있다');
}

// ══════════════════════════════════════════════════════════════════════════
head('[6] ★ 재다가 저장고가 차면 — **끊긴다**');
{
  const a = makeArc();
  beginCharge(a, { cells: ARC.cells, sinkAt: 0.5 });
  let ev = null, t = 0;
  while (t < ARC.charge && ev !== 'abort') { ev = stepArc(a, DT, { sinkAt: 0.99 }); t += DT; }
  ok(ev === 'abort' && a.phase === PHASE.NONE,
    '★★ 저장고가 넘치면 축전기가 **내려간다** — 「해 보고 죽는」 것은 벌이지 갈래가 아니다');
  ok(a.jumps === 0, '★ 안 뛰었으니 안 센다 (전지는 이미 태웠다 — 실패에도 값이 있다)');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
console.log(`
  ※ **「뛰고 싶어지나」는 여기서 안 나온다.** 여기서 나오는 것은
     「마디가 도나 · 이유를 말하나 · 공짜가 아닌가 · 몇 번 뛰나 ·
     늘 정답은 아닌가」뿐이다. 손에 붙는지는 브라우저로 봐야 한다.`);
process.exit(bad ? 1 : 0);
