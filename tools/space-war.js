// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **긴박한가** — 격추 게임의 숫자 (v70 · docs/space/WAR.md §7)
//
//    node tools/space-war.js
//
//  ★ 사장님: 「**긴박감있고 긴장감 있고 흥미진진한** 우주 비행 전투 게임」
//
//  ★★ 「긴박하다」는 감상이라 검증할 수 없다. 그래서 **잴 수 있는 형태로
//    못박아** 둔다. 여기서 나오는 것은 다섯뿐이다:
//
//      ① 적이 **정말 쏘나** · 쏘는 것이 보일 시간이 있나
//      ② 맞는 것이 회차에 몇 번인가 — 0 이면 긴박이 없고, 100 이면 벌이다
//      ③ **맞으면 일이 되나** — 이 판의 심장: 싸움이 정비 일감을 만든다
//      ④ **피할 수 있나** — 옆으로 빠지면 사격 각이 죽나
//      ⑤ 싸움 하나가 몇 초인가
//
//  ★★★ **여기서 안 나오는 것: 「긴박한가」.** 그건 2시간 돌려 봐야 안다.
//    여기서 나오는 것은 「긴박이 성립할 수치 조건」뿐이다.
//
//  ★ 브라우저를 안 쓴다 — 순수 규칙이라 2시간을 1초에 돌린다.
// ══════════════════════════════════════════════════════════════════════════
import {
  KINDS, TARGET, ENEMY_FIRE, HITS, FAULT_CHANCE, pickHit, enemyHitChance,
} from '../web/space/js/game/target-table.js';
import {
  makeSky, setRegion, setNose, stepSky, spawnRaider, summary,
} from '../web/space/js/game/target.js';
import { MISSIONS } from '../web/space/js/game/mission-table.js';
import { LEG } from '../web/space/js/game/route-table.js';
import { WEAPONS } from '../web/space/js/game/combat-table.js';
// ★★★ v151 — 「잴 것이 없으면 멈춘다」는 **한 곳에** 있다 (`folded.js` 옆)
import { measuring } from './unmeasured.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DT = 1 / 30;
/** ★ 적인가 — 쏘거나 들이받는 것. 떠도는 쓰레기와 가른다 */
const isFoe = (t) => !!(KINDS[t.kind]?.shoots || KINDS[t.kind]?.rams);

/** 씨 고정 난수 — 두 번 돌리면 같은 값이 나와야 한다 */
function rngOf(seed = 11) {
  let h = seed >>> 0;
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507)) >>> 0) / 4294967296;
}
const fresh = (seed = 11, region = 'empty') => {
  const s = makeSky(rngOf(seed));
  setRegion(s, region);
  stepSky(s, DT, {});
  return s;
};
/** 회차 하나 (초). `route-table.js` 에서 뽑는다 — 손으로 안 적는다 */
const RUN = LEG.count * LEG.seconds;
/**
 * ★ 적 하나를 부수는 데 걸리는 초 — **표에서 뽑는다.**
 *   맷집(`KINDS.raider.hits`) ÷ 레이저 피해(1) × 재는 시간(0.55) 에
 *   빗맞는 몫을 더한 값. 손으로 「8초」라 적으면 무기를 고칠 때 갈라진다
 */
// ★ v99 — `0.55` 를 손으로 적어 뒀었다. 주석은 「표에서 뽑는다」고 하는데
//   정작 재는 시간만 손 숫자였다 — 무기를 고치면 여기가 조용히 갈라진다
const killSec = (kind) => (KINDS[kind]?.hits ?? 6) * (WEAPONS.laser.dmg ?? 1)
  * WEAPONS.laser.reload * 1.6;

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ v151 — **잴 것이 없으면 통과가 아니라 「측정 불가」다**
//
//  ★ 사장님이 `space-screen.js` 에서 잡으신 병이 여기에도 있었다. 이 검사의
//    알맹이가 **「없어야 한다」 꼴**이기 때문이다:
//
//      ok(bad.length === 0, '설계에 없는 고장이 없다')     ← [4]
//      ok(side === 0,       '옆으로 빼면 한 발도 안 온다')  ← [3]
//      ok(landed === 0,     '죽은 놈의 탄은 안 온다')       ← [6]
//
//  ★★ **`HITS` 가 비면 [4] 가 통째로 저절로 참이 된다** — `[].filter(…)` 는
//    빈 목록이고, `new Set([]).size === [].length` 는 `0 === 0` 이다.
//    「맞으면 일이 되나 — 이 판의 심장」이라고 적어 놓고 **심장이 없을 때
//    제일 크게 초록**이 되는 셈이다. 실제로 `HITS` 를 비우고 돌려 보니
//    [4] 에 닿기도 전에 게임 쪽이 터졌는데(`target.js` 가 `where.fault` 를
//    읽는다), **터지는 것도 「못 쟀다」가 아니라 그냥 1** 이었다 —
//    자동으로 돌리는 쪽에서는 「검사가 하나 실패했다」로만 보인다.
//
//  ★★★ 값 하나가 없어져도 같은 일이 난다. `ENEMY_FIRE.aimCone` 을 없애고
//    돌려 봤더니 이렇게 나왔다:
//
//      ✘ 정면이면 맞는다
//      ✔ **옆으로 빼면 한 발도 안 온다** (원뿔 **undefined**도)
//
//    ★ 처음에 여기 「**둘 다 초록**이 된다」고 적었다가 **재 보고 고쳤다** —
//      앞줄은 빨갛다. 그래도 병은 그대로다: **한 발도 안 쏘는 판에서
//      「안 온다」가 초록**이고, 게다가 「원뿔 undefined도」라고 **말하면서**
//      초록이다. 빨강 하나가 옆에 있다고 이 초록이 참이 되지는 않는다.
//    ★★ 그리고 이런 자리는 **1(불합격)이 아니라 2(못 쟀다)**라야 한다.
//      값이 없어진 것은 「게임이 나쁘다」가 아니라 **잴 수가 없다**이고,
//      1 로 나가면 다음 사람이 「[3] 이 깨졌구나」 하고 엉뚱한 데를 판다.
//
//  ★ 여기는 **순수 도구**라 닫을 브라우저가 없다. 그래도 모양은 같다:
//    던지고 · 담고 · **합격/불합격을 찍기 전에** 끝낸다.
//
//  ★★ 재는 것이 한 가지가 아니라서 **이름을 나눠 부른다** (`must.as`).
//    「자리」와 「값」과 「적 종류」를 한 이름으로 찍으면 틀린 말이 나간다 —
//    v150 에 스킬 줄을 「계기」라고 부른 것이 그 예다.
// ══════════════════════════════════════════════════════════════════════════
const must = measuring({
  tool: 'space-war',
  what: '맞는 자리',
  weak: '이 검사의 알맹이는 **「없어야 한다」 꼴**입니다\n'
    + '(설계에 없는 고장이 없다 · 옆으로 빼면 한 발도 안 온다 ·\n'
    + ' 죽은 놈의 탄은 안 온다).\n'
    + '그래서 **표가 비면 그 판정들이 저절로 참**이 됩니다 —\n'
    + '특히 `HITS` 가 비면 「맞으면 일이 되나」가 통째로 초록입니다.',
  look: '`game/target-table.js` 의 `HITS`·`KINDS`·`ENEMY_FIRE` ·'
    + ' `game/mission-table.js` 의 `MISSIONS`',
});

console.log('\n긴박한가 — 격추 게임의 숫자');
console.log(`   회차 ${(RUN / 60).toFixed(0)}분 · 적 사거리 ${ENEMY_FIRE.range}m ·`
  + ` ${ENEMY_FIRE.every}초마다 한 발 · 비행 ${ENEMY_FIRE.fly}초`);

// ══ ★★★ **재기 전에 잴 것이 있나부터** ═══════════════════════════════════
//
//  ★ 여기서 묻는 것은 전부 **표에서 온 상수**다. 그래서 한자리에 모아
//    둘 수 있고, 어느 절을 지키는지 옆에 적어 둔다. 시늉이 시작된 뒤에
//    나오는 값(`head` · `s.incoming`)은 **여기로 안 옮긴다** — 그건
//    「못 쟀다」가 아니라 **게임이 틀린 것**이라 빨간불이 맞다
try {
  // [4] — 이 판의 심장. 둘 중 하나라도 비면 [4] 가 통째로 저절로 참이 된다
  must.some(HITS, '맞는 자리별 고장을 훑으려는데');
  must.as('고장 열쇠').some(MISSIONS, '설계에 있는 고장을 세려는데');
  must.as('값').value(FAULT_CHANCE, 'FAULT_CHANCE', '몇 번에 한 번 일이 되나를 재려는데');

  // [1]·[3]·[6] — 적 하나를 띄워 쏘게 한다
  must.as('적 종류').some(
    Object.values(KINDS).filter((k) => k.shoots || k.rams),
    '쏘거나 들이받는 것을 세려는데',
  );
  //  ★ `spawnRaider` 가 이것 하나를 집어 온다. 없으면 [1]·[3]·[6] 이
  //    **아무것도 안 띄운 채로** 「안 온다」를 재게 된다
  must.as('적 종류').has(KINDS, 'raider', '적 표에서');
  //  ★ `killSec` 안의 `?? 6` 이 이 자리를 조용히 메운다 — 기본값은
  //    **못 잰 것을 잰 것처럼** 보이게 하므로 여기서 먼저 못박는다
  must.as('값').value(KINDS.raider?.hits, 'raider.hits', '부수는 데 걸리는 초를 셈하려는데');
  must.as('값').all(ENEMY_FIRE, ['every', 'range', 'aimCone', 'fly', 'hit'], '적 사격 표에서');

  // [2] — 사거리 견줌
  must.as('값').value(TARGET.range, 'TARGET.range', '우리 사거리와 견주려는데');

  // [5] — 회차 하나를 통째로 시늉한다
  must.as('값').all(LEG, ['count', 'seconds'], '회차 길이를 뽑으려는데');
  must.as('값').value(TARGET.wave?.gap?.[1], 'wave.gap 위쪽', '싸움 한 판이 끝났나를 가르려는데');
  const laser = must.as('무기').has(WEAPONS, 'laser', '무기 표에서');
  must.as('값').all(laser, ['dmg', 'reload', 'rMax'], '레이저로 부수는 시간을 셈하려는데');
} catch (e) {
  //  ★ 딴 오류는 **다시 던진다** — 여기서 삼키면 진짜 고장이
  //    「측정 불가」로 위장된다
  if (!must.caught(e)) throw e;
}
//  ★ 담긴 것이 있으면 여기서 **2**(못 쟀다)로 끝난다. 아래 절들은 아예
//    안 돈다 — 잴 것이 없는 채로 도는 것이 바로 거짓 초록의 시작이다
must.bail();

console.log('\n[1] ★★★ **적이 정말 쏘나** — v69 까지 들이받기만 했다');
{
  const s = fresh();
  setNose(s, 0);
  const t = spawnRaider(s);
  t.az = 0; t.el = 0; t.dist = 60;
  let sawShot = false, first = 0, u = 0;
  while (u < 30 && !sawShot) {
    stepSky(s, DT, { moving: false });
    if (s.incoming.length) { sawShot = true; first = u; }
    u += DT;
    // 적이 다가와 부딪히지 않게 붙들어 둔다 — 여기서 묻는 건 사격뿐이다
    t.dist = 60;
  }
  ok(sawShot, `★★★ **쏜다** — ${first.toFixed(1)}초 만에 첫 발. v69 까지는 영영 안 쐈다`);
  ok(first <= ENEMY_FIRE.every + 0.5,
    `첫 발이 ${first.toFixed(1)}초 (${ENEMY_FIRE.every}초 안팎) — 붙자마자 안 쏘면 「왜 안 쏘지」가 된다`);
  ok(ENEMY_FIRE.fly >= 0.5,
    `★★ 탄이 **${ENEMY_FIRE.fly}초 날아온다** — 0 이면 피할 수가 없고, 피할 수 없는 것은 벌이지 싸움이 아니다`);
}

console.log('\n[2] ★★ **사거리가 우리보다 짧나** — 멀리서 먼저 때릴 수 있어야 한다');
{
  ok(ENEMY_FIRE.range < TARGET.range,
    `적 ${ENEMY_FIRE.range}m < 우리 ${TARGET.range}m — **먼저 때릴 수 있다.**`
    + ' 같으면 붙는 것 말고 할 게 없고, 길면 다가가는 것 자체가 벌이다');
  const near = enemyHitChance(10), far = enemyHitChance(ENEMY_FIRE.range);
  console.log(`   맞을 확률 — 코앞 ${(near * 100).toFixed(0)}% · 사거리 끝 ${(far * 100).toFixed(0)}%`);
  ok(near > far, '★ 가까울수록 잘 맞는다 — 「붙어서 빨리 부수기 vs 멀리서 오래 끌기」의 저울');
}

console.log('\n[3] ★★★ **옆으로 빠지면 사격 각이 죽나** — 도는 것이 곧 회피다');
{
  const shots = (noseAz) => {
    const s = fresh(23);
    setNose(s, noseAz);
    const t = spawnRaider(s);
    t.az = 0; t.el = 0; t.dist = 60;
    let n = 0, u = 0;
    while (u < 60) {
      const ev = stepSky(s, DT, { moving: false });
      n += (ev.hits ?? []).length;
      t.dist = 60;
      u += DT;
    }
    return n;
  };
  const head = shots(0);
  const side = shots(ENEMY_FIRE.aimCone + 25);
  console.log(`   60초에 — 정면으로 마주 볼 때 ${head}발 · 옆으로 뺐을 때 ${side}발`);
  ok(head > 0, '정면이면 맞는다');
  ok(side === 0,
    `★★★ **옆으로 빼면 한 발도 안 온다** (원뿔 ${ENEMY_FIRE.aimCone}도) —`
    + ' v69 에 연 360도 선회가 여기서 값을 한다: **도는 것이 조준이면서 방어**다');
}

console.log('\n[4] ★★★ **맞으면 일이 되나** — 이 판의 심장');
{
  //  ★★★ 아래 둘은 **`HITS` 가 비면 저절로 참**이다 (`[].filter(…)` 는 빈
  //    목록이고 `0 === 0` 이다). 위의 「재기 전에」 절이 그래서 있다
  const KEYS = new Set(MISSIONS.map((m) => m.key));
  const bad = HITS.filter((h) => h.fault && !KEYS.has(h.fault));
  ok(bad.length === 0,
    bad.length ? `설계에 없는 고장 열쇠: ${bad.map((h) => h.fault).join('·')}`
      : '★★ 맞아서 나는 고장이 **전부 `mission-table.js` 에 있던 것**이다 — 새 고장을 안 만들었다');
  const spots = HITS.map((h) => h.fault);
  ok(new Set(spots).size === HITS.length,
    `자리 셋이 **다른 고장**을 연다 (${HITS.map((h) => `${h.name}→${h.fault}`).join(' · ')}) —`
    + ' 같으면 자리를 나눈 뜻이 없다');

  // 몇 번에 한 번이나 일이 되나
  const rnd = rngOf(5);
  let faults = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) { pickHit(rnd); if (rnd() < FAULT_CHANCE) faults++; }
  const per = faults / N;
  console.log(`   ${(per * 100).toFixed(0)}% — 맞은 ${(1 / per).toFixed(1)}번에 한 번 고장이 열린다`);
  ok(per > 0.15 && per < 0.5,
    `★★ ${(per * 100).toFixed(0)}% (15~50%) — 매번이면 회차가 고장 목록이 되어 사람이`
    + ' **안 맞으려고만** 하고, 0 이면 피격이 숫자로 끝난다');
}

console.log('\n[5] ★★ **회차에 몇 번이나 맞나** — 0 이면 긴박이 없고 100 이면 벌이다');
/**
 * ★★★ v99 — 한 회차를 통째로 시늉한다. **씨앗을 받는다** —
 *   예전에는 31 하나만 돌리고 「전투 47%」라고 적었는데, 한 판은
 *   **판단할 수 없는 수**다. 항로 씨앗이 바뀌면 다른 값이 나온다
 */
function runOnce(seed) {
  const s = fresh(seed);
  setNose(s, 0);
  let u = 0, hits = 0, misses = 0, fights = 0, inFight = 0, fightSec = 0, quiet = 0;
  const lens = [];
  while (u < RUN) {
    const ev = stepSky(s, DT, { moving: true });
    for (const h of ev.hits ?? []) { if (h.miss) misses++; else hits++; }
    // ★★ **한 판을 물결 단위로 센다** (v70). 적을 부순 순간과 다음 것이
    //   오는 사이에 7~13초의 빈 틈이 있는데, 거기서 판을 끊으면 「싸움
    //   84번 × 15초」처럼 **한 판이 토막 나서** 세어진다. 사람은 그 사이를
    //   「끝났다」로 안 느낀다 — 다음 것이 오는 것을 보고 있으니까.
    //   물결 간격보다 오래 비어야 판이 끝난 것이다
    const foes = s.list.filter(isFoe).length;
    if (foes > 0) { if (!inFight) { inFight = 1; fights++; fightSec = 0; } quiet = 0; fightSec += DT; }
    else if (inFight) {
      quiet += DT; fightSec += DT;
      if (quiet > TARGET.wave.gap[1] + 2) { inFight = 0; lens.push(fightSec - quiet); }
    }
    // ★★★ **사람 흉내를 제대로 낸다.** 처음엔 「120m 에 들어오면 즉사」로
    //   뒀더니 **맞은 것이 0대**로 나왔다 — 적 사거리(105m)에 들어오기도
    //   전에 죽으니 한 발도 못 쏜 것이다. 즉 게임이 아니라 **검사가 신처럼
    //   쏘고 있었다.** 적은 맷집이 6 이고 레이저는 한 발에 1 · 0.55초마다
    //   나가므로, 붙어서 계속 쏴도 **3초 넘게** 걸린다. 그 사이에 맞는다
    for (const t of s.list) {
      if (!isFoe(t)) continue;
      // ★★ **레이저 사거리 안에서만 깎는다** (`WEAPONS.laser.rMax`).
      //   처음엔 120m 로 손으로 적었는데, 레이저는 90m 부터다 —
      //   30m 를 공짜로 준 셈이라 적이 **한 발 쏘고 탄이 닿기 0.02초 전에**
      //   죽었고, 그래서 「맞은 것 0대」가 나왔다. 표에서 뽑으면 안 어긋난다
      if (t.dist > WEAPONS.laser.rMax) continue;
      t.shotAt = (t.shotAt ?? 0) + DT;
    }
    // ★ v70 — **맷집이 종류마다 다르다.** 요격기(2)는 금세 죽고 포함(10)은
    //   오래 버틴다. 하나로 뭉뚱그리면 「싸움 하나가 몇 초인가」가 거짓이 된다
    s.list = s.list.filter((t) => !(isFoe(t) && (t.shotAt ?? 0) >= killSec(t.kind)));
    u += DT;
  }
  const avg = lens.length ? lens.reduce((a, v) => a + v, 0) / lens.length : 0;
  return { hits, misses, fights, avg, share: lens.reduce((a, v) => a + v, 0) / RUN };
}
{
  // ★ 씨앗 여덟. 하나로는 못 정한다 — **제일 낮은 판**까지 봐야 한다
  const SEEDS = [31, 7, 11, 53, 101, 777, 2024, 4242];
  const runs = SEEDS.map(runOnce);
  const mid = (f) => runs.map(f).reduce((a, b) => a + b, 0) / runs.length;
  // ══ ★★★ v154 — **씨앗 여덟을 돌려 놓고 판정은 하나로 하고 있었다** ══════
  //
  //  ★★★ 바로 위에 「씨앗 여덟. **하나로는 못 정한다**」라고 적혀 있고,
  //    `runOnce` 머리에는 「한 판은 **판단할 수 없는 수**다」라고까지 적혀
  //    있는데, 정작 판정 셋이 `runs[0]` — **씨앗 31 하나**를 봤다.
  //    평균 낼 `mid` 를 만들어 두고도 **전투 비중에만** 썼다.
  //
  //  ★★ v154 에 전투 밀도를 다시 잡다가 잡혔다. `TARGET.far` 를 **4m** 만
  //    움직였는데 「맞은 것」이 88 ↔ 135 로 널뛰었다 — 그 값이 게임을
  //    말하는 게 아니라 **씨앗 하나의 운**을 말하고 있었던 것이다.
  //    그 상태로 손잡이를 맞추면 「우연히 통과하는 숫자」를 고르게 되고,
  //    그건 이 저장소가 제일 하면 안 되는 종류의 조율이다.
  //
  //  ★ 그래서 **여덟의 평균으로 판정하고, 널뛰는 폭을 같이 찍는다.**
  //    폭이 보이면 다음 사람이 「이 값은 원래 흔들린다」를 안다
  const hits = mid((r) => r.hits);
  const misses = mid((r) => r.misses);
  const fights = mid((r) => r.fights);
  const avg = mid((r) => r.avg);
  const hitLo = Math.min(...runs.map((r) => r.hits));
  const hitHi = Math.max(...runs.map((r) => r.hits));
  console.log(`   회차 ${(RUN / 60).toFixed(0)}분 · 씨앗 ${SEEDS.length}판 평균 —`
    + ` 싸움 ${fights.toFixed(0)}번 · 하나 ${avg.toFixed(0)}초`
    + ` · 맞은 것 ${hits.toFixed(0)}대 (${hitLo}~${hitHi}) · 빗나간 것 ${misses.toFixed(0)}대`);
  ok(hits >= 20 && hits <= 90,
    `★★★ 회차에 **${hits.toFixed(0)}대** 맞는다 (20~90 · 판마다 ${hitLo}~${hitHi}) —`
    + ' 0 이면 긴박이 없고, 너무 많으면 벌이다');
  ok(fights >= 8,
    `싸움이 회차에 ${fights.toFixed(0)}번 — 뜸하면 격추 게임이 아니다`);
  ok(avg >= 15 && avg <= 120,
    `싸움 하나가 ${avg.toFixed(0)}초 (15~120) — 5초면 사고고, 3분이면 지겹다`);
  // ══ ★★★ **전투 비중** — 기획(`WAR.md §7`)이 40~55% 를 목표로 잡았다 ══
  //
  //  ★ v68 은 3.7% 였다. v99 에 재 보니 **씨앗 여덟에서 40~50%** —
  //    목표 안이다. 그런데 이 검사는 그때까지 `share > 0.15` 만 보면서
  //    「목표까지는 아직이다: v71 에서 마저 민다」고 **적어 두고 있었다.**
  //    v71 은 스물여덟 판 전이다.
  //
  //  ★★ **초록인 채로 낡은 말을 하는 검사**가 제일 나쁘다. 빨간 검사는
  //    고치게 되지만 이건 아무도 안 본다 — 그리고 「아직 멀었다」는
  //    잘못된 그림을 계속 준다. 이제 **목표 그대로** 묻는다
  const lo = Math.min(...runs.map((r) => r.share));
  const hi = Math.max(...runs.map((r) => r.share));
  const avgShare = mid((r) => r.share);
  console.log(`   ★ 전투에 든 시간 — 씨앗 ${SEEDS.length}판에서 `
    + `${(lo * 100).toFixed(1)}~${(hi * 100).toFixed(1)}% (가운데 ${(avgShare * 100).toFixed(1)}%)`
    + `  · v68 은 3.7% · 기획 목표 40~55%`);
  // ★ **가운데 판**이 목표 안인가 — 이것이 「보통 회차가 어떤가」다
  ok(avgShare >= 0.40 && avgShare <= 0.55,
    `★★★ 보통 회차가 **${(avgShare * 100).toFixed(0)}%** — 기획 목표(40~55%)에 들었다.`
    + ' v68 의 3.7% 에서 여기까지 왔다');
  // ★★ 그리고 **제일 조용한 판**도 무너지지 않는가. 가운데만 보면
  //   「어떤 회차는 전투가 거의 없었다」를 놓친다
  ok(lo >= 0.35,
    `★★ 제일 조용한 판도 **${(lo * 100).toFixed(0)}%** (35% 아래로 안 떨어진다) —`
    + ' 항로 씨앗 하나가 회차를 통째로 심심하게 만들면 안 된다');
  // ★ 위로도 안 넘치나 — 「전투 특화이나 **생존 시뮬레이션**」 (WAR.md §14-4)
  ok(hi <= 0.60,
    `★ 제일 뜨거운 판도 **${(hi * 100).toFixed(0)}%** (60% 이하) —`
    + ' 넘으면 정비·보급이 밀려난 것이고, 그러면 그냥 슈팅이 된다');
  console.log(`   맞아서 열리는 고장 ≈ ${(hits * FAULT_CHANCE).toFixed(0)}건/회차`);
  ok(hits * FAULT_CHANCE >= 5,
    `★★ 회차에 **${(hits * FAULT_CHANCE).toFixed(0)}건**이 일이 된다 —`
    + ' 「싸움 → 고장 → 고치기」 고리가 실제로 돈다');
}

console.log('\n[6] ★ **죽은 놈의 탄은 안 온다** — 부순 다음 순간에 맞으면 말이 안 된다');
{
  const s = fresh(41);
  setNose(s, 0);
  const t = spawnRaider(s);
  t.az = 0; t.el = 0; t.dist = 60;
  let u = 0;
  while (u < 10 && !s.incoming.length) { stepSky(s, DT, { moving: false }); t.dist = 60; u += DT; }
  //  ★ `landed === 0` 도 「없어야 한다」 꼴이라 **날아오는 탄이 없으면
  //    저절로 참**이다. 그런데 그 자리는 「못 쟀다」로 안 돌린다 —
  //    적이 한 발도 안 쏘는 것은 표가 빈 것이 아니라 **게임이 틀린 것**이고,
  //    그건 아래 한 줄이 **빨갛게** 잡아야 할 몫이다
  ok(s.incoming.length > 0, '한 발이 날아오는 중이다');
  // 그 사이에 부순다
  s.list = s.list.filter((x) => x !== t);
  let landed = 0, v = 0;
  while (v < 4) { landed += (stepSky(s, DT, { moving: false }).hits ?? []).length; v += DT; }
  ok(landed === 0, '★ 쏜 놈을 부수니 **그 탄도 없던 일이 된다**');
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「긴박한가」는 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「적이 쏘나 · 피할 수 있나 · 맞으면 일이 되나 · 몇 번 맞나」뿐이다.');
console.log('     나머지는 2시간 직접 돌려 봐야 안다.');
process.exit(fail ? 1 : 0);
