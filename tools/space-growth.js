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
  XP, MAX_LV, PICKS, CURVE, TRAITS, needFor, totalFor, levelAt,
  xpForKill, effectOf, makePilot, gain, pick,
} from '../web/space/js/game/growth-table.js';
import { KINDS, TARGET } from '../web/space/js/game/target-table.js';
import { LEG } from '../web/space/js/game/route-table.js';
import { PARTS5 } from '../web/space/js/game/warhead-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

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

console.log(`\n[0] 표가 말하는 것 — 레벨 ${MAX_LV} · 고르는 것 ${PICKS} · 특성 ${TRAITS.length}`);
{
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
  const ats = TRAITS.map((t) => t.at);
  const dup = ats.filter((a, i) => ats.indexOf(a) !== i);
  console.log(`   건드리는 계통 — ${[...new Set(ats)].join(' · ')}`);
  ok(!dup.length,
    `★★★ **아홉이 다 다른 계통을 건드린다**${dup.length ? ` — 겹침 ${[...new Set(dup)].join(' · ')}` : ''}`);
  const fields = TRAITS.flatMap((t) => Object.keys(t.val));
  const dupF = fields.filter((a, i) => fields.indexOf(a) !== i);
  ok(!dupF.length, `★★ 바꾸는 값도 안 겹친다${dupF.length ? ` — ${[...new Set(dupF)].join(' · ')}` : ''}`);
}

console.log('\n[6] ★★★ **배 갈래를 안 잡아먹나** — 특성이 화력·맷집을 올리면 파밍이 죽는다');
{
  const fields = TRAITS.flatMap((t) => Object.keys(t.val));
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

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 사람이 크고, 잘하면 더 크고, 다 못 고릅니다');
process.exit(bad ? 1 : 0);
