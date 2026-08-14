// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **사람이 크나** — RPG 의 기둥 (v115 · 뼈대만)
//
//    node tools/space-growth.js
//
//  ★ 사장님 (2026-08-11) 「**우주 비행전투 rpg야 우리 장르야**」
//
//  ══ 이 검사가 묻는 것 ═══════════════════════════════════════════════
//
//   ① ★★★ **회차 하나에 딱 다 크나** — 2시간 안에서 끝나야 한다
//   ② **너무 일찍 다 크지 않나** — 절반에서 끝나면 뒤가 심심하다
//   ③ ★★★ **잘하면 더 크나** — 정중앙으로 마무리한 사람이 앞서나
//   ④ **다 못 고르나** — 다 가지면 성장이 아니라 해금이다
//   ⑤ ★★★ **특성이 서로 안 겹치나** — 겹치면 하나는 있으나 마나다
//   ⑥ **배 갈래를 안 잡아먹나** — 특성이 화력·맷집을 올리면 파밍이 죽는다
//
//  ★ 게임을 안 부른다. 표와 순수 모듈만 읽는다
// ══════════════════════════════════════════════════════════════════════════
import {
  XP, MAX_LV, PICKS, CURVE, TRAITS, TRAIT_BY, needFor, totalFor, levelAt,
  xpForKill, effectOf, makePilot, gain, pick,
} from '../web/space/js/game/growth-table.js';
import { KINDS, TARGET } from '../web/space/js/game/target-table.js';
import { LEG } from '../web/space/js/game/route-table.js';
import { PARTS5 } from '../web/space/js/game/warhead-table.js';
// ★★★ v150 — 「잴 것이 없으면 멈춘다」는 **한 곳에** 있다 (`folded.js` 옆)
import { measuring } from './unmeasured.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ v150 — **잴 것이 없으면 통과가 아니라 「측정 불가」다**
//
//  ★ 사장님이 `space-screen.js` 에서 잡으셨다 — 계기 넷을 없앤 척하고
//    돌리니 **「✔ 전투 화면이 비어 있다」** 가 나왔다. 여기도 같은 병이
//    **세 군데** 있었다:
//
//      [5] `ok(!dup.length, '아홉이 다 다른 계통을 건드린다')`
//      [5] `ok(!dupF.length, '바꾸는 값도 안 겹친다')`
//      [6] `ok(!hit.length,  '특성이 화력·맷집을 하나도 안 올린다')`
//
//    셋 다 **「없어야 한다」 꼴**이라 `TRAITS` 가 비면 겹칠 것도 없고
//    금지어에 걸릴 것도 없어 **셋이 다 저절로 참**이 된다. 특성이 하나도
//    없는 게임에 대고 「아홉이 다 다른 계통을 건드린다」고 도장을 찍는다.
//
//  ★★ 그리고 **`val` 이 다 빈 객체**여도 `fields` 가 비어 [5]·[6] 이
//    똑같이 초록이 된다 — 특성 이름만 남고 **바꾸는 것이 하나도 없는**
//    상태다. 목록의 길이만 보면 이건 못 잡으므로 `fields` 도 따로 센다.
//
//  ★★★ 회차 시뮬(`run`)은 더 조용하다. `KINDS` 가 비면 부술 것이 없어
//    경험이 안 오르고, 그건 「성장이 느리다」가 아니라 **「안 쟀다」**이다.
//    다만 그때는 [1] 이 빨개지므로 거짓 초록은 아니고, **거짓 빨강**이다 —
//    낡은 빨강이 새 빨강을 덮는 것(v124)과 같은 값으로 나쁘다.
// ══════════════════════════════════════════════════════════════════════════
const must = measuring({
  tool: 'space-growth',
  what: '표',
  weak: '이 검사의 [5]·[6] 은 **「없어야 한다」** 꼴입니다\n'
    + '(계통이 안 겹친다 · 바꾸는 값이 안 겹친다 · 금지어가 없다).\n'
    + '그래서 **특성이 비면 셋이 다 저절로 참**이 되어,\n'
    + '특성이 하나도 없는 게임에 대고 「아홉이 다 다른 계통을\n'
    + '건드린다」고 찍습니다. 회차 시뮬도 마찬가지로, 적 목록이\n'
    + '비면 「성장이 느리다」가 아니라 **「안 쟀다」**입니다.',
  look: '`game/growth-table.js` 의 `TRAITS` · `game/target-table.js` 의 `KINDS`',
});

/** 되풀이되는 난수 — 판마다 흔들리면 「고쳤나」를 못 묻는다 */
let seed = 20260812;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

/**
 * ★★★ **회차 하나를 통째로 돈다.**
 *
 *   ★ 새 숫자를 안 만든다 — 구간 수·길이는 `route-table.js`, 적이 오는
 *     시계는 `target-table.js`, 재료 수는 `warhead-table.js` 가 이미 안다.
 *     여기서 「한 회차에 몇 마리」를 손으로 적으면 그 순간 갈라진다
 *
 * @param bullRate 정중앙으로 마무리하는 비율 (손 솜씨)
 * @param killRate 만나는 것 중 실제로 부수는 비율 (다 안 부순다 — 뚫는다는 고른다는 뜻)
 */
function run({ bullRate = 0.25, killRate = 0.75 } = {}) {
  const p = makePilot();
  const legSec = LEG.seconds;                          // 구간 하나의 기준 길이
  const every = (TARGET.raiderEvery[0] + TARGET.raiderEvery[1]) / 2;
  const packAvg = (TARGET.wave.size[0] + TARGET.wave.size[1]) / 2;
  const foes = Object.keys(KINDS).filter((k) => KINDS[k].hits >= 6);
  const drift = Object.keys(KINDS).filter((k) => (KINDS[k].weight ?? 0) > 0);
  // ── ★★★ 여기서 훑을 것이 정말 있나 ────────────────────────────
  //
  //  ★ 아래 세 겹 반복은 **목록을 훑어서** 경험을 쌓는다. 목록이 비면
  //    반복이 0 번 돌고, 그러면 「끝에 Lv1」이 나온다. 그건 성장 곡선의
  //    답이 아니라 **잴 것이 없었다**는 뜻이다 — 곡선을 고칠 일이 아니다
  must.as('표적').some(foes, '회차를 돌려 경험을 쌓으려는데');
  must.as('떠도는 것').some(drift, '회차를 돌려 경험을 쌓으려는데');
  must.as('구간').some(Array.from({ length: LEG.count ?? 0 }), '회차 하나를 돌려는데');
  must.as('탄두 재료').some(PARTS5, '회차에 걸쳐 재료를 실으려는데');
  // ★ 적이 오는 시계가 없으면 물결 수가 NaN 이 되고, `for (w < NaN)` 은
  //   **한 번도 안 돌면서 조용하다.** 값이 없는 것과 0 인 것은 다르므로
  //   `value` 로 「읽히나」만 묻고, 0 이하는 아래 `waves` 가 걸러낸다
  must.as('값').value(every, '적이 오는 간격', '물결 수를 세려는데');
  must.as('값').value(packAvg, '한 물결의 수', '물결 수를 세려는데');
  const marks = [];
  let kills = 0;
  for (let leg = 1; leg <= LEG.count; leg++) {
    // ── 이 구간에 오는 물결 ─────────────────────────────
    const waves = Math.floor(legSec / every);
    for (let w = 0; w < waves; w++) {
      for (let i = 0; i < Math.round(packAvg); i++) {
        if (rnd() > killRate) continue;
        const kind = foes[Math.floor(rnd() * foes.length)];
        gain(p, xpForKill(kind, rnd() < bullRate));
        kills++;
      }
    }
    // ── 떠도는 것 몇 개 (파편·위성 …) ────────────────────
    for (let i = 0; i < 3; i++) {
      if (rnd() > killRate) continue;
      gain(p, xpForKill(drift[Math.floor(rnd() * drift.length)], rnd() < bullRate));
      kills++;
    }
    gain(p, XP.leg);
    // ── 탄두 재료는 회차에 걸쳐 다섯 ─────────────────────
    if (leg % Math.floor(LEG.count / PARTS5.length) === 0 && marks.length < PARTS5.length) {
      gain(p, XP.mat); marks.push(leg);
    }
    marks[leg] = p.lv;
  }
  return { p, kills };
}

console.log('사람이 크나 — RPG 의 기둥 (뼈대만 · 게임을 안 부른다)');

// ★★ 재는 몸통을 통째로 감싼다 — 「못 쟀다」는 **합격/불합격 줄을 찍기 전에**
//   알려야 한다. 브라우저가 없으므로 `finally` 는 없고, 마지막에 `bail()` 이
//   담긴 것을 보고 **2** 로 끝낸다 (0 으로 끝내면 자동 검사가 합격으로 읽는다)
try {

console.log(`\n[0] 표가 말하는 것 — 레벨 ${MAX_LV} · 고르는 것 ${PICKS} · 특성 ${TRAITS.length}`);
{
  // ★ 곡선 두 값이 없으면 `needFor` 가 NaN 을 뱉고, 아래 판정들이
  //   「NaN >= 4」= 거짓으로 **빨개진다.** 곡선을 고칠 일이 아니라 표가
  //   비어 있는 것이므로 여기서 가른다
  must.as('값').value(CURVE?.base, 'base', '경험 곡선을 그리려는데');
  must.as('값').value(CURVE?.curve, 'curve', '경험 곡선을 그리려는데');
  must.as('값').value(MAX_LV, '최고 레벨', '레벨 표를 찍으려는데');
  console.log(`   곡선 base ${CURVE.base} · curve ${CURVE.curve}`);
  for (let lv = 1; lv <= MAX_LV; lv++) {
    console.log(`   Lv${lv}  다음까지 ${lv < MAX_LV ? String(needFor(lv)).padStart(5) : '  ——'}`
      + ` · 여기까지 총 ${String(totalFor(lv)).padStart(5)}`);
  }
  console.log(`   격추 경험 — 파편 ${xpForKill('junk')} · 요격기 ${xpForKill('fighter')}`
    + ` · 적 우주선 ${xpForKill('raider')} · 포함 ${xpForKill('gunship')}`
    + `  (정중앙이면 ×${(1 + XP.bull).toFixed(2)})`);
}

console.log('\n[1] ★★★ **회차 하나에 딱 다 크나** — 손 솜씨 셋으로');
{
  const rows = [
    { name: '서툰 손', bullRate: 0.08, killRate: 0.60 },
    { name: '보통', bullRate: 0.25, killRate: 0.75 },
    { name: '잘하는 손', bullRate: 0.55, killRate: 0.88 },
  ].map((h) => ({ h, r: run(h) }));
  console.log('   손          부순 것   총 경험   끝 레벨   고른 것');
  for (const { h, r } of rows) {
    console.log(`   ${h.name.padEnd(8)} ${String(r.kills).padStart(6)}`
      + ` ${String(Math.round(r.p.xp)).padStart(9)} ${String(r.p.lv).padStart(8)}`
      + ` ${String(r.p.picked.length + r.p.owed).padStart(9)}`);
  }
  // ★ 「부순 것이 0 인데 레벨만 재는」 판정은 성장이 아니라 구간 보너스를
  //   재는 것이다. 회차가 정말 돌았나를 먼저 묻는다
  must.as('격추').some(Array.from({ length: rows[1].r.kills }), '보통 손의 회차에서');
  const mid = rows[1].r.p;
  ok(mid.lv >= MAX_LV - 1 && mid.lv <= MAX_LV,
    `★★★ **보통 손이 회차 끝에 Lv${mid.lv}** (${MAX_LV - 1}~${MAX_LV}) —`
    + ' 2시간 안에서 다 크고 거기서 멈춘다. 「회차 배수」·「무한 반복」은'
    + ' 낡은 것이다 (`PLAN2H.md §8`)');
  ok(rows[0].r.p.lv >= 4,
    `★★ **서툰 손도 Lv${rows[0].r.p.lv} 까지는 온다** (4 이상) — 못 크면 벌이 되고,`
    + ' 벌이 되면 서툰 사람은 더 못하게 된다');
  ok(rows[2].r.p.lv >= rows[0].r.p.lv,
    '★ 잘할수록 높다 — 뒤집히면 그건 성장이 아니다');
}

console.log('\n[2] ★★ **너무 일찍 다 크지 않나** — 절반에서 끝나면 뒤가 심심하다');
{
  const half = run({ bullRate: 0.25, killRate: 0.75 });
  // 구간 절반까지만 돌려 본다 — 같은 씨앗으로 다시
  seed = 20260812;
  const p = makePilot();
  const every = (TARGET.raiderEvery[0] + TARGET.raiderEvery[1]) / 2;
  const waves = Math.floor(LEG.seconds / every);
  // ★ 여기는 `run` 을 안 거치는 **두 번째 셈터**라 위의 보호가 안 닿는다.
  //   물결이 0 이면 아래 반복이 통째로 안 돌아 「절반에서 Lv1」이 나오고,
  //   그건 **「앞이 너무 느리다」가 아니라 「안 쟀다」**이다
  must.as('물결').some(Array.from({ length: waves > 0 ? waves : 0 }), '절반까지만 돌려 보려는데');
  for (let leg = 1; leg <= Math.floor(LEG.count / 2); leg++) {
    for (let w = 0; w < waves; w++) {
      for (let i = 0; i < 3; i++) {
        if (rnd() > 0.75) continue;
        gain(p, xpForKill('raider', rnd() < 0.25));
      }
    }
    gain(p, XP.leg);
  }
  console.log(`   절반(${Math.floor(LEG.count / 2)}구간)에서 Lv${p.lv} · 끝에서 Lv${half.p.lv}`);
  ok(p.lv < MAX_LV,
    `★★★ **절반에서는 아직 Lv${p.lv}** — 여기서 이미 다 컸으면 나머지 여섯`
    + ' 구간에는 오를 것이 없고, 그러면 뒤쪽 절반이 통째로 심심해진다');
  ok(p.lv >= 3,
    `★★ 그래도 절반에서 Lv${p.lv} 은 됐다 (3 이상) — 앞이 너무 느리면`
    + ' 「크고 있다」가 안 느껴진다');
}

console.log('\n[3] ★★★ **잘하면 더 크나** — 정중앙으로 마무리한 사람이 앞서나');
{
  seed = 20260812; const dull = run({ bullRate: 0.0, killRate: 0.75 });
  seed = 20260812; const sharp = run({ bullRate: 1.0, killRate: 0.75 });
  const gapPct = ((sharp.p.xp / dull.p.xp) - 1) * 100;
  console.log(`   한 발도 정중앙이 아닌 사람 ${Math.round(dull.p.xp)}`
    + ` · 다 정중앙인 사람 ${Math.round(sharp.p.xp)}  (+${gapPct.toFixed(0)}%)`);
  ok(sharp.p.xp > dull.p.xp,
    '★★★ **같은 적을 잡아도 잘 맞힌 사람이 더 큰다** — 이 한 줄이'
    + ' 「RPG 인데 실력 게임」을 만든다 (v114 의 조준 띠와 물린다)');
  ok(gapPct >= 8 && gapPct <= 45,
    `★★ 차이가 **${gapPct.toFixed(0)}%** (8~45%) — 작으면 있으나 마나이고,`
    + ' 크면 정중앙만 노리다 놓치는 것이 이득이 되어 **안 쏘고 기다리는**'
    + ' 게임이 된다');
}

console.log('\n[4] ★★ **다 못 고르나** — 다 가지면 성장이 아니라 해금이다');
{
  must.as('특성').some(TRAITS, '고를 것이 몇인지 세려는데');
  console.log(`   특성 ${TRAITS.length} 가지 중 **${PICKS} 개**를 고른다`
    + ` (못 고르는 것 ${TRAITS.length - PICKS})`);
  ok(PICKS < TRAITS.length,
    `★★★ **${TRAITS.length - PICKS} 가지는 못 고른다** — 그래야 이번 회차의 내가`
    + ' 지난 회차와 다르다. 다 가지면 회차마다 같은 사람이 된다');
  ok(PICKS === MAX_LV - 1,
    `★ 고르는 횟수(${PICKS})가 레벨업 횟수와 같다 — 레벨이 곧 고를 기회다`);
}

console.log('\n[5] ★★★ **특성이 서로 안 겹치나** — 겹치면 하나는 있으나 마나다');
{
  // ══ ★★★ 여기가 v150 에 막은 자리다 ═══════════════════════════════
  //
  //  ★ 아래 둘은 **「겹친 것이 없어야 한다」** 꼴이다. `TRAITS` 가 비면
  //    `ats` 도 `fields` 도 비고, 빈 목록에는 겹칠 것이 없으므로
  //    **둘 다 저절로 참**이 된다 — 특성이 0 개인 게임에 대고
  //    「아홉이 다 다른 계통을 건드린다」고 찍는다
  must.as('특성').some(TRAITS, '겹치나를 재려는데');
  const ats = TRAITS.map((t) => t.at);
  //  ★★ 길이만 봐서는 못 잡는 것이 하나 더 있다: **`at` 이 빠진 특성**.
  //    `undefined` 가 둘이면 겹침으로 잡히지만 **하나면 조용히 지나간다** —
  //    그때 이 절은 「안 겹친다」로 초록인데 정작 그 특성은 **어느 계통도
  //    안 건드린다.** 그래서 특성 수만큼 계통 이름이 있나를 따로 센다
  must.as('계통').some(ats.filter(Boolean), '계통이 겹치나를 재려는데', TRAITS.length);
  const dup = ats.filter((a, i) => ats.indexOf(a) !== i);
  console.log(`   건드리는 계통 — ${[...new Set(ats)].join(' · ')}`);
  ok(!dup.length,
    `★★★ **아홉이 다 다른 계통을 건드린다**${dup.length ? ` — 겹침 ${[...new Set(dup)].join(' · ')}` : ''}`);
  const fields = TRAITS.flatMap((t) => Object.keys(t.val ?? {}));
  //  ★★★ **`val` 이 다 비어도 여기가 초록이 된다.** 이름만 아홉이고
  //    바꾸는 것이 하나도 없는 상태 — 목록의 길이(9)로는 절대 못 잡는다.
  //    특성 하나가 적어도 한 칸은 바꾸므로 **특성 수 이상**을 요구한다
  must.as('바꾸는 값').some(fields, '값이 겹치나를 재려는데', TRAITS.length);
  const dupF = fields.filter((a, i) => fields.indexOf(a) !== i);
  ok(!dupF.length, `★★ 바꾸는 값도 안 겹친다${dupF.length ? ` — ${[...new Set(dupF)].join(' · ')}` : ''}`);
}

console.log('\n[6] ★★★ **배 갈래를 안 잡아먹나** — 특성이 화력·맷집을 올리면 파밍이 죽는다');
{
  // ★ 이것도 **「걸린 것이 없어야 한다」** 꼴이다. 바꾸는 값이 하나도
  //   없으면 금지어에 걸릴 것도 없어 **저절로 참**이 된다
  must.as('특성').some(TRAITS, '화력·맷집을 올리나를 재려는데');
  const fields = TRAITS.flatMap((t) => Object.keys(t.val ?? {}));
  must.as('바꾸는 값').some(fields, '화력·맷집을 올리나를 재려는데', TRAITS.length);
  const banned = ['dmg', 'hp', 'hull', 'punch', 'might', 'power'];
  const hit = fields.filter((f) => banned.some((b) => f.toLowerCase().includes(b)));
  ok(!hit.length,
    `★★★ **특성이 화력·맷집을 하나도 안 올린다**${hit.length ? ` — ${hit.join(' · ')}` : ''}`
    + ' — 그건 파츠의 몫이다 (`parts-table.js`). 두 갈래가 같은 것을 올리면'
    + ' 주울 이유가 없어져 **파밍이 장식**이 된다');
  // ★ 그런데 **서로 돕기는** 해야 한다 — 완전히 남남이면 한 화면에 둘 이유가 없다
  const helps = TRAITS.find((t) => t.at === 'upgrade');
  ok(!!helps,
    `★★ 그래도 **배를 돕는 특성이 하나 있다** (${helps?.name}) — 완전히 남남이면`
    + ' 한 회차에 둘을 같이 키울 까닭이 없다');
}

console.log('\n[7] ★ **합치면 값이 제대로 나오나**');
{
  // ★ 여기는 이름 셋(`gunner`·`cool`)을 손으로 적어 놓고 값을 견준다.
  //   이름이 바뀌면 `effectOf` 가 0 을 주고 아래가 **빨개지는데**, 그 빨강은
  //   「더하기가 틀렸다」로 읽힌다 — 실제로는 **그 특성이 없어진** 것이다
  must.as('특성').has(TRAIT_BY, 'gunner', '합산을 재려는데');
  must.as('특성').has(TRAIT_BY, 'cool', '합산을 재려는데');
  const e = effectOf(['gunner', 'cool', 'cool']);
  console.log(`   사수+냉정+냉정 → 띠 +${e.bull.toFixed(2)} · 열 ×${e.heatMult.toFixed(3)}`);
  ok(Math.abs(e.bull - 0.07) < 1e-9, '더하는 값은 더한다');
  ok(Math.abs(e.heatMult - 0.78 * 0.78) < 1e-9, '배수는 곱한다 — 더하면 두 개에 음수가 된다');
  const p = makePilot();
  ok(!pick(p, 'gunner').ok, '★★ **빚이 없으면 못 고른다** — 레벨이 올라야 고른다');
  gain(p, totalFor(2));
  ok(pick(p, 'gunner').ok, '레벨이 오르면 고른다');
  ok(!pick(p, 'gunner').ok, '★ 같은 것을 두 번은 못 고른다');
  ok(levelAt(1e9).lv === MAX_LV, `★★ 아무리 벌어도 Lv${MAX_LV} 에서 멈춘다`);
}

} catch (e) {
  // ★★★ 우리 것이 아니면 **다시 던진다.** 딴 오류까지 삼키면 진짜 고장이
  //   「측정 불가」로 위장된다
  if (!must.caught(e)) throw e;
}

// ★★★ 담긴 것이 있으면 여기서 **2** 로 끝난다 — 합격/불합격 줄보다 **먼저**
must.bail();

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 사람이 크고, 잘하면 더 크고, 다 못 고릅니다');
process.exit(bad ? 1 : 0);
