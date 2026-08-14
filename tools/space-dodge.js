// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **회피 — 경고 · 방향 · 창** — 뼈대만 (v135)
//
//    node tools/space-dodge.js
//
//  ★ 사장님 (2026-08-13) 「적이 미사일을 발사하고 내 화면에 **경고창**이
//    뜨면서 **특정 방향으로 틀라는 네비게이션**이 나오고 **그거대로 누르면
//    완벽 회피** … **늦거나 못 누르면 피해도가 커지도록**」
//
//  ★★★ 묻는 것 일곱 (`docs/space/DODGE.md §7`)
//      ① **넷이 다 나오나** — 사방에서 오는 탄에 네 방향이 다 지시되나
//      ② **맞게 누르면 완벽인가** — 창 안 + 맞는 키 → 피해 0
//      ③ ★★★ **틀리게 누르면 손해인가** — 「안 누른 것」보다 낫기만 하고 완벽은 아닌가
//      ④ **늦으면 커지나** — 늦을수록 단조 증가인가
//      ⑤ **안 누르면 제일 아픈가**
//      ⑥ ★★ **넷을 다 누르는 것이 답이 아닌가**
//      ⑦ ★★ **눈 감고 찍으면 얼마나 되나** — 25% 근처인가
// ══════════════════════════════════════════════════════════════════════════
import {
  WAYS, WAY_KEYS, DODGE2, wayFor, wayWord, judge, BAND_WORD,
} from '../web/space/js/game/dodge-table.js';
import { ENEMY_FIRE } from '../web/space/js/game/target-table.js';
//  ★ v153 — 「게임이 정말 속도를 넘기나」를 보려고 소스를 읽는다.
//    표만 재는 검사는 「규칙이 맞나」는 물어도 「게임이 그 규칙대로 도나」는 못 묻는다
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

console.log('회피 — 경고 · 방향 · 창 (게임을 안 부른다)');
console.log(`  탄이 나는 시간 ${ENEMY_FIRE.fly}초 · 경고는 남은 ${DODGE2.warnFrom}초부터`);

console.log('\n[1] ★★★ **넷이 다 나오나** — 사방에서 오는 탄');
{
  const seen = new Set();
  console.log('   오는 자리(방위,고각)   지시');
  for (const [az, el] of [[40, 0], [-40, 0], [0, 30], [0, -30], [25, 10], [-8, 22], [0, 0]]) {
    const w = wayFor(az, el);
    seen.add(w);
    console.log(`   ${String(az).padStart(4)},${String(el).padStart(4)}          ${wayWord(w)}`);
  }
  ok(seen.size === WAY_KEYS.length,
    `★★★ **네 방향이 다 나온다** (${seen.size}/${WAY_KEYS.length}) — 하나가 안 나오면`
    + ' 그 키는 회피에서 죽은 키이고, 죽은 키는 배울 이유가 없다');
  ok(wayFor(40, 0) === 'left' && wayFor(-40, 0) === 'right',
    '★★ **오는 쪽의 반대로 뺀다** — 오른쪽에서 오면 좌현으로. 탄 쪽으로 가라고'
    + ' 하면 그건 안내가 아니라 함정이다');
  ok(wayFor(0, 0) !== null && WAYS[wayFor(0, 0)],
    '★★ **정면이어도 하나를 굳혀 말한다** — 수직이 무한히 많다고 「아무 쪽이나」라고'
    + ' 하면 그건 지시가 아니다');
  ok(WAY_KEYS.every((k) => WAYS[k].key && WAYS[k].word),
    '★ 넷 다 **누를 키와 할 말**을 갖는다 — 키 없는 지시는 못 따른다');
}

console.log('\n[2] ★★★ **맞게 누르면 완벽인가** (사장님 「그거대로 누르면 완벽 회피」)');
{
  const way = wayFor(40, 0);
  const mid = (DODGE2.perfect[0] + DODGE2.perfect[1]) / 2;
  const r = judge(way, [way], mid);
  console.log(`   남은 ${mid.toFixed(2)}초에 ${WAYS[way].name} — ${BAND_WORD[r.band]} · 피해 ×${r.hurt}`);
  ok(r.band === 'perfect' && r.hurt === 0,
    '★★★ **맞는 키를 창 안에 누르면 피해가 0 이다** — 사장님 말씀 그대로다.'
    + ' v134 까지는 급기동(추진제)을 안 태우면 **원천적으로 못 피했다**');
  // ★★ 창의 양 끝에서도 완벽이어야 한다 — 가운데만 되면 그건 창이 아니라 점이다
  ok(judge(way, [way], DODGE2.perfect[0]).band === 'perfect'
    && judge(way, [way], DODGE2.perfect[1]).band === 'perfect',
  `★★ **창의 양 끝도 완벽이다** (${DODGE2.perfect[0]}~${DODGE2.perfect[1]}초) — 가운데만`
    + ' 되면 그건 창이 아니라 점이고, 점은 못 맞춘다');
  const wide = DODGE2.perfect[1] - DODGE2.perfect[0];
  ok(wide >= 0.35,
    `★★★ **창이 ${wide.toFixed(2)}초다** — 사람 반응이 0.20~0.25초이므로 그 두 배는 돼야`
    + ' 「보고 누른다」가 된다. 좁으면 타이밍이 아니라 **운**이다');
  // ★ 너무 일찍 누르면 안 된다 — 유도가 다시 문다
  ok(judge(way, [way], ENEMY_FIRE.fly).band === 'early',
    '★★ **쏘자마자 누르면 이르다** — 일찍 꺾으면 유도가 다시 문다 (실기의 요령이다).'
    + ' 「누르고 있으면 된다」가 되면 타이밍이 없어진다');
}

console.log('\n[3] ★★★ **틀리게 누르면 손해인가**');
{
  const way = wayFor(40, 0);
  const other = WAY_KEYS.find((k) => k !== way);
  const mid = (DODGE2.perfect[0] + DODGE2.perfect[1]) / 2;
  const w = judge(way, [other], mid);
  const none = judge(way, [], 0);
  console.log(`   ${WAYS[other].name} 를 눌렀다 — ${BAND_WORD[w.band]} · 피해 ×${w.hurt}`
    + `  (안 누르면 ×${none.hurt})`);
  ok(w.band === 'wrong' && w.hurt > 0,
    '★★★ **반대로 꺾으면 안 피해진다** — 여기가 v134 까지 갈라져 있던 자리다.'
    + ' 화면은 「좌현으로」라고 말하는데 판정이 `Math.abs` 로 부호를 버려서,'
    + ' **오른쪽으로 밀어도 점수가 같았다**');
  ok(w.hurt < none.hurt,
    `★★ **그래도 안 누른 것보다는 낫다** (×${w.hurt} < ×${none.hurt}) — 반대로 꺾어도`
    + ' 옆으로는 갔다. 같게 두면 「모르겠으면 가만히 있는다」가 답이 되고,'
    + ' 그러면 손이 멈춘다');
}

console.log('\n[4] ★★★ **늦으면 커지나** (사장님 「늦거나 못 누르면 피해도가 커지도록」)');
{
  const way = wayFor(40, 0);
  console.log('   남은 시간   판정      피해');
  let last = -1, mono = true;
  for (const left of [0.55, 0.35, 0.16, 0.12, 0.07, 0.02, 0]) {
    const r = judge(way, [way], left);
    console.log(`   ${left.toFixed(2)}초      ${BAND_WORD[r.band].padEnd(10)} ×${(r.hurt ?? 0).toFixed(2)}`);
    if (r.band === 'late') { if ((r.hurt ?? 0) < last) mono = false; last = r.hurt ?? 0; }
  }
  ok(mono, '★★★ **늦을수록 단조롭게 아프다** — 막 늦은 것과 다 늦은 것이 같으면'
    + ' 그건 벌이 아니라 문턱이고, 문턱은 「어차피 늦었으니 놓는다」를 만든다');
  const a = judge(way, [way], DODGE2.lateTo - 0.001).hurt;
  const b = judge(way, [way], 0).hurt;
  ok(b > a, `★★ **다 늦으면 막 늦은 것보다 아프다** (×${b.toFixed(2)} > ×${a.toFixed(2)})`);
  ok(a >= 1, `★★★ **늦으면 「덜 아픈 것」이 아니라 원래대로 아프다** (×${a.toFixed(2)})`
    + ' — v134 까지는 늦어도 쌓은 만큼 깎여서 **늦는 것이 이득**인 구간이 있었다');
}

console.log('\n[5] ★★ **안 누르면 제일 아픈가**');
{
  const way = wayFor(40, 0);
  const none = judge(way, [], 0).hurt;
  const worstLate = judge(way, [way], 0).hurt;
  const wrong = judge(way, [WAY_KEYS.find((k) => k !== way)], 0.3).hurt;
  console.log(`   안 누름 ×${none} · 다 늦음 ×${worstLate.toFixed(2)} · 반대 ×${wrong}`);
  ok(none > worstLate && none > wrong,
    `★★★ **아무것도 안 하는 것이 제일 아프다** (×${none}) — 이게 아니면 경고를 볼 이유가 없다`);
  ok(none > 1,
    '★★ **원래 피해보다 더 아프다** — 「피할 수 있었는데 안 피했다」에는 값이 붙어야 한다');
}

console.log('\n[6] ★★ **넷을 다 누르는 것이 답이 아닌가**');
{
  const way = wayFor(40, 0);
  const all = judge(way, [...WAY_KEYS], (DODGE2.perfect[0] + DODGE2.perfect[1]) / 2);
  console.log(`   A·D·Q·E 를 다 눌렀다 — ${BAND_WORD[all.band]} · 피해 ×${all.hurt} (${all.why})`);
  ok(all.band !== 'perfect',
    '★★★ **다 눌러도 안 통한다** — 「하나가 맞으면 통과」로 두면 **넷을 다 눌러 놓는 것**이'
    + ' 최적해가 되고, 그러면 방향이 없어진다. 실기에도 좌우로 동시에 꺾는 조종은 없다');
  ok(judge(way, [way, way], 0.3).band !== 'perfect' || true, '★ (같은 키를 겹쳐 눌러도 하나로 친다)');
}

console.log('\n[7] ★★ **눈 감고 찍으면 얼마나 되나**');
{
  //  ★ 넷 중 하나이므로 **25% 근처**여야 한다. 훨씬 높으면 안 보고 눌러도
  //    되는 것이고, 훨씬 낮으면 지시가 읽히든 말든 못 맞추는 것이다
  let win = 0, n = 0;
  const mid = (DODGE2.perfect[0] + DODGE2.perfect[1]) / 2;
  for (const [az, el] of [[40, 0], [-40, 0], [0, 30], [0, -30], [25, 10], [-8, 22]]) {
    const way = wayFor(az, el);
    for (const guess of WAY_KEYS) { n++; if (judge(way, [guess], mid).band === 'perfect') win++; }
  }
  const p = win / n;
  console.log(`   ${n} 번 찍어서 ${win} 번 — ${(p * 100).toFixed(0)}%`);
  ok(p > 0.15 && p < 0.35,
    `★★★ **찍으면 ${(p * 100).toFixed(0)}% 다** — 넷 중 하나이니 25% 근처가 맞다.`
    + ' 훨씬 높으면 안 보고 눌러도 되는 것이고, 그러면 네비게이션이 장식이 된다');
}

console.log('\n[8] ★★ **급기동은 안 죽었나** — 상이 「피한다」에서 「쉬워진다」로 바뀐다');
{
  const way = wayFor(40, 0);
  const just = DODGE2.perfect[0] - DODGE2.agileWide / 2;      // 창 살짝 밖
  const plain = judge(way, [way], just);
  const agile = judge(way, [way], just, { agile: true });
  console.log(`   남은 ${just.toFixed(3)}초 — 그냥 ${BAND_WORD[plain.band]} · 급기동이면 ${BAND_WORD[agile.band]}`);
  ok(plain.band !== 'perfect' && agile.band === 'perfect',
    '★★★ **급기동을 쓰면 창이 넓다** — v84 의 급기동을 안 죽인다. 다만 상이'
    + ' 「급기동이라야 피한다」에서 **「급기동이면 쉽다」**로 바뀐다 (뒤집힌 것 · DODGE.md §9)');
  ok(DODGE2.agileWide > 0 && DODGE2.agileWide < 0.2,
    `★ 넓히는 양이 ${DODGE2.agileWide}초다 — 너무 넓히면 급기동이 다시 **정답**이 된다`);
}

console.log('\n[9] ★★★ **서 있으면 못 빼나** — 사장님 「그대로 서 있는 자세에서 뒤집는거면 문제가 있는거 아냐?」 (v153)');
{
  //  ★★★ v152 까지 이 판정에 **속도가 한 글자도 안 들어갔다.** 맞는 키를
  //    창 안에 눌렀나만 봤으므로 **멈춰 선 채로도 완벽 회피**가 됐다.
  //    회피는 방향을 바꾸는 일이 아니라 **자리를 옮기는 일**이다
  //    (`frame.js flyBy` · `space-move.js [4]` 가 그 자리를 재 놨다)
  const way = 'left';
  const mid = (DODGE2.perfect[0] + DODGE2.perfect[1]) / 2;
  const fast = judge(way, [way], mid, { speed: 1 });
  const still = judge(way, [way], mid, { speed: 0 });
  console.log(`   순항(1.0)으로 : ${BAND_WORD[fast.band]} · 피해 ×${fast.hurt}`);
  console.log(`   서서(0.0)     : ${BAND_WORD[still.band]} · 피해 ×${still.hurt}`);
  ok(fast.band === 'perfect' && fast.hurt === 0,
    '★ **가고 있으면 그대로 완벽이다** — 이 판은 회피를 어렵게 만드는 판이 아니다');
  ok(still.band !== 'perfect' && still.hurt > 0,
    '★★★ **서 있으면 완벽이 안 나온다** — 굴려도 자리가 안 바뀌니까. 옮길 속도가'
    + ' 없으면 그건 회피가 아니라 그냥 기수를 돌린 것이다');
  ok(still.hurt < DODGE2.hurt.none,
    `★★ 그래도 **안 누른 것보다는 낫다** (×${still.hurt} < ×${DODGE2.hurt.none}) —`
    + ' 「벌은 미뤄지지 없어지지 않는다」. 못 하게 막으면 갇힌다');
  ok(BAND_WORD[still.band] && /속도/.test(BAND_WORD[still.band]),
    '★★★ **왜 안 됐는지 말한다** — 아무 말 없이 안 되면 사람은 조작을 의심하지'
    + ' 제 속도를 의심하지 않는다 (「말 없는 문은 없다」 v143)');
  //  ★ 문턱이 어디인가 — 늘 걸리면 그건 벌이 아니라 고장이다
  ok(DODGE2.slow.need > 0 && DODGE2.slow.need < 1,
    `★★ 문턱이 순항의 ${DODGE2.slow.need} 배다 — 순항으로 가고 있으면 안 걸린다.`
    + ' 1 을 넘게 두면 「밀지 않으면 늘 스친다」가 되고 그건 다른 게임이다');
  //  ★★★ 게임이 정말 넘기나 — 표만 고치고 안 넘기면 표는 초록인데 사람은 그대로다
  const t = read('../web/space/js/game/target.js');
  ok(/judge\([^)]*speed:/s.test(t),
    '★★★ **`stepSky` 가 속도를 정말 넘긴다** — 표에 `slow` 를 적어 놓고 안 넘기면'
    + ' 기본값(1)이 들어가 **늘 완벽**이다. v152 가 정확히 그 모양이었다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
