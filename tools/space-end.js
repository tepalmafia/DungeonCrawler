// ══════════════════════════════════════════════════════════════════════════
//  H 성간 공백과 끝 화면 — **여정이 닫히나** (PLAN2H §9 · 8판)
//
//    node tools/space-end.js
//
//  ★ 여기서 묻는 것은 「끝이 감동적인가」가 아니다. 그건 못 잰다.
//    여기서 나오는 것은 넷뿐이다:
//      ① **성간 공백이 정말 비어 있나** — 추격도 과녁도 거점도 없나
//      ② **그런데 손은 노나** — 고장까지 끄면 8분이 죽는다
//      ③ **목록이 점수가 아닌가** — 등급·총점·「아쉽습니다」가 없나
//      ④ **못 고친 것을 이름으로 부르나** — 「손상 3」은 기억에 안 남는다
//
//  ★ 여기는 **브라우저를 안 띄운다.** 표와 순수 함수로 갈라 놨으므로
//    ①~④ 는 1초면 나온다. **화면에 정말 뜨나**는 `space-endtoend.js [7]` 이
//    손으로 본다 — 계통 검사는 제가 만든 상태에서 시작하므로 「사람은
//    거기까지 못 간다」를 못 잡는다 (CLAUDE.md).
// ══════════════════════════════════════════════════════════════════════════
import { VOID, isVoid } from '../web/space/js/game/void-table.js';
import { END, GROUPS, LINES } from '../web/space/js/game/ending-table.js';
import { endList, endWord } from '../web/space/js/game/ending.js';
import { LEG, forkOf } from '../web/space/js/game/route-table.js';
import { REGION_BY_KEY } from '../web/space/js/game/regions-table.js';
import { TARGET } from '../web/space/js/game/target-table.js';
import { SCENES } from '../web/space/js/game/scene-table.js';
import { makeRoute, stepRoute, chooseFork, RPHASE } from '../web/space/js/game/route.js';
import { FOOD } from '../web/space/js/game/supply-table.js';
import { FUEL, burnMult } from '../web/space/js/game/fuel-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };

console.log('\nH 성간 공백과 끝 화면 — 여정이 닫히나');

console.log('\n[1] ★★★ **마지막 구간이 적 행성 상공인가** (v93 · WAR.md §14-2)');
{
  const r = REGION_BY_KEY[VOID.region];
  ok(!!r, `구역이 있다 — ${r?.name}`);
  // ══ ★★★ **이 절이 v93 까지 옛 게임을 재고 있었다** ═══════════════════
  //
  //  마지막 구간은 원래 「성간 공백」이었다 — *따라오지 못하는 곳까지
  //  도망친다*. 그런데 목적이 **뚫는다 · 채운다 · 떨군다**로 뒤집혔고
  //  (`WAR.md §0`), §14-2 가 이 구간을 걷어내라고 적어 뒀다.
  //  그래서 이 절이 묻던 것 — 「자국이 안 쌓이나 · 아무도 못 따라오나 ·
  //  떠도는 것이 0 인가」 — 은 **전부 반대**가 됐다. 여기는 **적 본진**이다.
  //
  //  ★ 이 저장소가 같은 함정을 일곱 번째 밟은 자리다: **뜻을 바꾸면
  //    검사도 같이 센다.** 안 고치면 검사가 없어진 설계를 지킨다.
  ok(r.planet === true, '★★ **행성이 뜬다** — 떨굴 곳이 눈에 보여야 한다');
  ok(r.signMult > 1, `★★ 자국이 **제일 빨리 쌓인다** (signMult ${r.signMult}) — 적 본진이다`);
  ok(r.trackMult > 1, `★★ 붙는 속도가 **제일 빠르다** (${r.trackMult}) — 「방공이 제일 두껍다」`);
  ok((TARGET.byRegion[VOID.region] ?? 0) > 0,
    `떠도는 것이 ${TARGET.byRegion[VOID.region] ?? 0} 개 — 비어 있으면 뚫을 것이 없다`);
  console.log(`   ${r.name} — ${r.what}`);
}

console.log('\n[2] ★ **그런데 손은 노나** — 고장까지 끄면 8분이 죽는다');
{
  ok(VOID.faultMult > 0,
    `고장은 그대로 온다 (×${VOID.faultMult}) — 빼는 것은 **보급**이지 **일**이 아니다`);
  const f = forkOf(VOID.region);
  const min = f.seconds / 60;
  console.log(`   구간 길이 ${min.toFixed(1)}분 (추진 켜고)`);
  ok(min >= 8 && min <= 12, `${min.toFixed(1)}분 — 다른 구간과 같은 8~12분 (§10)`);
  const eat = f.seconds * FOOD.perSec;
  console.log(`   먹는 식량 ${eat.toFixed(0)} · 가득이 ${FOOD.max}`);
  ok(eat < FOOD.max,
    `가득 채워 들어가면 굶지 않는다 (${eat.toFixed(0)} < ${FOOD.max}) — **챙긴 사람은 편안하다**`);
  // ══ ★★ **이 물음이 v62 에서 옮겨 갔다** (열다섯 번째) ═══════════
  //  예전에는 「**반만 채워** 들어가면 떠나」를 물었다. 그때는 식량이
  //  13분에 바닥나서 마지막 구간(8분) 하나가 통째로 식량 싸움이었다.
  //
  //  v62 에 식량 시계를 회차 기준으로 옮기면서 (REAL.md §2-D) 마지막
  //  구간의 식량 값은 13 이 됐다 — 반만 채워도 넉넉하다. **줄기가
  //  약해진 게 아니라 통화가 바뀐 것**이다: 「다음 거점까지 갈 것이 있나」는
  //  이제 **추진제**가 묻는다 (fuel-table.js).
  //
  //  그리고 마지막 구간에는 **거점이 없다.** 그래서 여기서 물어야 할 것은
  //  「들고 들어간 추진제가 모자라면 무슨 일이 나나」다.
  const need = FUEL.perSec * burnMult(VOID.region) * f.seconds;
  const coastMin = f.seconds / LEG.coast / 60;
  const coastEat = (f.seconds / LEG.coast) * FOOD.perSec;
  console.log(`   드는 추진제 ${need.toFixed(0)} · 바닥이면 ${coastMin.toFixed(1)}분 (${min.toFixed(1)}분 → 관성)`);
  ok(need > 0 && need < FUEL.max,
    `가득 채워 들어가면 건넌다 (${need.toFixed(0)} < ${FUEL.max}) — **챙긴 사람은 편안하다**`);
  ok(coastMin > min * 1.5 && coastEat > eat * 1.5,
    `★★ 추진제가 바닥이면 **${coastMin.toFixed(1)}분**으로 늘어지고 식량도 ${coastEat.toFixed(0)} 든다`
    + ` (${min.toFixed(1)}분 · ${eat.toFixed(0)}) — **안 챙긴 사람은 값을 치른다.**`
    + ' 거점이 없으므로 여기서는 살 수도 없다');
}

console.log('\n[3] ★ **마지막 구간에는 거점이 없나** — 항로를 실제로 돌려 본다');
{
  const rt = makeRoute('END1');
  let ports = 0, voids = 0, ends = 0, guard = 0;
  while (rt.phase !== RPHASE.END && guard++ < 400000) {
    if (rt.phase === RPHASE.PORT) { ports++; chooseFork(rt, rt.offer[0].key); continue; }
    const ev = stepRoute(rt, 1, { thrust: true });
    if (ev === 'void') voids++;
    if (ev === 'end') ends++;
  }
  console.log(`   거점 ${ports}번 · 성간 공백 진입 ${voids}번 · 도착 ${ends}번`);
  ok(voids === 1, '성간 공백에 **꼭 한 번** 들어선다');
  ok(ends === 1, '끝까지 간다');
  // ★ 시작이 거점이므로 구간 N 앞에는 거점 N 개다. 12구간이면 12번이어야
  //   하는데 **11번**이다 — 빠진 하나가 성간 공백 앞이다
  ok(ports === LEG.count - 1,
    `거점이 ${ports}번 — 12구간이면 12번이어야 하는데 하나가 없다. **마지막 구간 앞에는 거점이 없다**`);
  ok(isVoid(LEG.count - 1) && !isVoid(LEG.count - 2),
    '성간 공백은 **마지막 하나뿐**이다 — 두 구간이면 공허가 아니라 지루함이다');
}

console.log('\n[4] ★★ **목록이 점수가 아닌가**');
{
  const words = [END.title, END.where, END.again,
    ...LINES.map((l) => l.label), ...GROUPS.map((g) => g.name)].join(' ');
  const bad = ['점수', '등급', '총점', '아쉽', '훌륭', '완벽', '실패', '성공', '더 잘', '다시 도전'];
  const hit = bad.filter((w) => words.includes(w));
  ok(hit.length === 0, hit.length ? `점수의 말이 섞였다: ${hit.join(' · ')}` : '등급도 총점도 평가도 없다');
  ok(!/\d+\s*점/.test(words), '「N점」이 없다');
  ok(END.again.includes('여기까지'), `맨 아래가 다시 하기를 안 권한다 — 「${END.again}」`);
}

console.log('\n[5] ★ **못 고친 것을 이름으로 부르나** · 빈 줄을 빼나');
{
  const rich = endList({
    minutes: 118, legs: 12, runs: 7, fixed: 23, trips: 2, hits: 14, shakyMin: 4.2,
    scars: ['냉각 계통 손상', '선체 균열'], open: ['오염된 냉매'],
    food: 12, parts: 0, ore: 88,
  });
  const flat = rich.flatMap((g) => g.rows);
  console.log('   ' + rich.map((g) => `${g.name}(${g.rows.length})`).join(' · '));
  const scarRow = flat.find((r) => r.label === '영구 손상');
  ok(scarRow?.value.includes('냉각 계통 손상') && scarRow.value.includes('선체 균열'),
    `이름으로 부른다 — 「${scarRow?.value}」`);
  ok(!/^\d+개?$/.test(scarRow?.value ?? ''), '「2개」로 안 뭉갠다');

  // ★ 아무것도 안 한 회차 — **0 인 줄이 빠지나**
  const bare = endList({ minutes: 100, legs: 12, runs: 0, fixed: 0, trips: 0, hits: 0, shakyMin: 0,
    scars: [], open: [], food: 40, parts: 3, ore: 10 });
  const bflat = bare.flatMap((g) => g.rows);
  console.log('   ' + bare.map((g) => `${g.name}(${g.rows.length})`).join(' · '));
  ok(!bflat.some((r) => r.label === '고친 것'), '고친 것이 0 이면 그 줄이 안 뜬다');
  ok(!bflat.some((r) => r.label === '행성에 내린 횟수'), '안 내렸으면 그 줄이 안 뜬다');
  ok(bflat.some((r) => r.label === '뿌리친 횟수'),
    '★ 뿌리친 횟수는 **0 이어도 뜬다** — 한 번도 안 붙잡혔다는 뜻이라 사실이 크다');
  const bs = bflat.find((r) => r.label === '영구 손상');
  ok(bs && bs.value.includes('없음'),
    `★ 흉터 0 도 **띄운다** — 「${bs?.value}」. 끝까지 안 망가뜨린 것은 제일 어려운 일이다`);
}

console.log('\n[6] 한 줄 요약도 점수가 아니다');
{
  console.log('   ' + endWord({ minutes: 118, scars: ['냉각 계통 손상'] }));
  console.log('   ' + endWord({ minutes: 104, scars: [] }));
  ok(!/\d+점|등급/.test(endWord({ minutes: 118, scars: [] })), '한 줄에도 점수가 없다');
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「끝이 뭉클한가」는 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「비어 있나 · 손은 노나 · 점수가 아닌가 · 이름으로 부르나」뿐이다.');
console.log('     화면에 정말 뜨나는 space-endtoend.js [7] 이 손으로 본다.');
process.exit(fail ? 1 : 0);
