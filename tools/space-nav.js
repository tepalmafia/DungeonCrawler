// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **항법** — 뼈대만 (v104)
//
//    node tools/space-nav.js
//
//  ★ 사장님 「**항로, 미션을 선택하면 네비게이션이 나오도록 해줘.
//    그래야 수동으로도 이동할 수 있게.**」
//
//  ★★★ 묻는 것 다섯
//      ① **정말 방향이 없었나** — 사장님 말씀을 표로 검산한다
//      ② 고르면 **갈 곳이 생기나** · 저장했다 켜도 **같은 자리인가**
//      ③ ★★ **수동에 길이 생기나** — 향하면 가고 딴 데 보면 느려지나
//      ④ ★★★ **장르를 안 바꾸나** — 자동이면 지금과 똑같은가
//      ⑤ ★ 싸우다 잠깐 도는 것으로 항로가 멎지는 않나
//      ⑦ ★★★ **길이 보이나** (v130) — 굵은 한 줄이 뻗고 · 복판을 비우고 · 흐르나
//      ⑨ ★★★ **거점에서도 나오나** (v128) — 고르기 전에도 길이 보이나
// ══════════════════════════════════════════════════════════════════════════
import {
  NAV, courseMult, navWord, navState, wrapDeg,
  // ★★★ v121 — **항로 문** (사장님 「항로가 목적지까지 희미하게 표시」)
  ROAD, roadOf,
  // ★★★ v126 — **어느 쪽으로 틀어야 하나** (사장님 「우주라서 방향을 못 찾잖아」)
  NAVHUD, navArrow, steerWord,
} from '../web/space/js/game/nav-table.js';
import { relOf } from '../web/space/js/game/frame.js';
import { callOut } from '../web/space/js/game/radar-table.js';
import {
  makeNav, setFork, forkAt, setMission, clearNav, hasNav, stepNav, summary,
} from '../web/space/js/game/nav.js';
import { forkOf, allForks, offerFor, LEG } from '../web/space/js/game/route-table.js';
import { RADAR, WEAPONS } from '../web/space/js/game/combat-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

console.log('항법 — 뼈대만 (게임을 안 부른다)');

console.log('\n[1] ★★★ **정말 방향이 없었나** — 사장님 말씀을 표로 검산한다');
{
  const f = forkOf('nebula');
  const keys = Object.keys(f);
  console.log(`   갈래가 들고 있는 것: ${keys.join(' · ')}`);
  const dir = keys.filter((k) => /az|el|bearing|heading|dir|목적/i.test(k));
  ok(dir.length === 0,
    '★★★ **갈래에 방향이 하나도 없다** — 「간다」가 곧 `rt.t += dt` 였다.'
    + ' 즉 항로는 길이 아니라 **시계**였고, 기수를 어느 쪽으로 돌려도 똑같이 흘렀다');
  ok(typeof f.seconds === 'number',
    `★ 있는 것은 **시간**뿐이다 (${Math.round(f.seconds)}초 · 구간 ${LEG.count}개)`);
  ok(allForks().every((x) => x.az === undefined),
    '★★ 갈래 넷이 다 그렇다 — 그래서 「수동으로 이동」할 곳이 없었다');
}

console.log('\n[2] ★★ 고르면 **갈 곳이 생기나** · 이어해도 같은 자리인가');
{
  const n = makeNav();
  ok(!hasNav(n), '★ 처음엔 갈 곳이 없다');
  const to = setFork(n, forkOf('debris'), [0.8, 0.3]);
  ok(hasNav(n) && to, `★★ 갈래를 고르니 항로점이 섰다 — 「${navWord(to)}」`);
  ok(Math.abs(to.az) <= NAV.azSpread && Math.abs(to.el) <= NAV.elSpread,
    `★ 자리가 범위 안이다 (좌우 ±${NAV.azSpread}° · 위아래 ±${NAV.elSpread}°)`
    + ` — 지금 ${to.az.toFixed(0)}° · ${to.el.toFixed(0)}°`);
  // ★★★ 같은 씨앗이면 같은 자리 — 저장하고 이어했을 때 안 옮겨 간다
  const n2 = makeNav();
  const to2 = setFork(n2, forkOf('debris'), [0.8, 0.3]);
  ok(to.az === to2.az && to.el === to2.el,
    '★★★ **씨앗이 같으면 자리가 같다** — 저장하고 이어해도 목적지가 안 옮겨 간다'
    + ' (v56 에 저장으로 한 번 겪었다)');
  const m = setMission(n, { key: 'wreck', name: '표류선' }, [0.9, 0.2]);
  ok(Math.abs(m.az) > NAV.azSpread,
    `★★ **미션은 더 옆에 선다** (${m.az.toFixed(0)}°) — 항로에서 벗어나야 닿는다.`
    + ' 그 벗어남이 곧 「들를까 말까」의 값이다');
  ok(m.dist === NAV.missionDist && to.dist === null,
    '★ 미션은 거리를 말하고 갈래는 안 말한다 — 남은 것은 `route.t` 가 안다.'
    + ' 두 곳이 「얼마나 남았나」를 말하게 두지 않는다');
  ok(clearNav(n) && !hasNav(n), '★ 아무 때나 푼다 — 갇히면 그건 벌이 아니라 고장이다');
}

console.log('\n[3] ★★★ **수동에 길이 생기나** — 향하면 가고 딴 데 보면 느려지나');
{
  console.log('   벗어난 각   나아가는 배수   계기가 하는 말');
  for (const off of [0, 10, 14, 30, 50, 77, 78, 120]) {
    console.log(`   ${String(off).padStart(6)}도   ${courseMult(off).toFixed(2).padStart(9)}`
      + `   ${navWord({ name: '성운' }, off)}`);
  }
  ok(courseMult(0) === 1 && courseMult(NAV.cone) === 1,
    `★★★ **${NAV.cone}도 안이면 온전히 나아간다** — 딱 맞출 필요는 없다`);
  ok(courseMult(NAV.dead) === 0,
    `★★★ **${NAV.dead}도를 넘으면 아예 안 나아간다** — 옆으로 돌아섰는데`
    + ' 조금이라도 가면 그건 「향한다」가 아니다');
  ok(courseMult(40) > courseMult(60) && courseMult(60) > courseMult(75),
    '★★ 그 사이는 **부드럽게 떨어진다** — 벼랑이면 조종이 시험이 된다');
  ok(courseMult(50) >= NAV.minMult,
    `★ 딴 데를 봐도 ${NAV.minMult} 는 간다 — 0 이면 갈래를 고른 뒤`
    + ' **한 번도 못 돌아보게** 되고, 그러면 정비를 못 한다');
  ok(NAV.cone > WEAPONS.laser.tol && NAV.cone < RADAR.gimbal,
    `★★ ${NAV.cone}도는 **겨누기(${WEAPONS.laser.tol}°)보다 쉽고 락온 유지`
    + `(${RADAR.gimbal}°)보다 어렵다` + ' — 항로는 조준이 아니라 방향이다');
}

console.log('\n[4] ★★★ **장르를 안 바꾸나** — 자동이면 지금과 똑같은가');
{
  //  ★ 이 사람은 **정비공**이라 회차의 대부분을 조종석 밖에서 보낸다
  //    (`space-fly.js` 가 「조종석에 매인 시간 15% 이하」를 지킨다).
  //    좌석을 비우는 순간 항로가 멎으면 그건 다른 게임이다
  const n = makeNav();
  setFork(n, forkOf('empty'), [0.2, 0.6]);
  ok(stepNav(n, 1 / 60, { off: 170, auto: true }) === 1,
    '★★★ **자동이면 완전히 등을 돌려도 1 이다** — 배가 스스로 향하므로.'
    + ' 이 한 줄이 이 계통이 장르를 안 바꾸는 이유 전부다');
  ok(stepNav(n, 1 / 60, { off: 170, auto: false }) === 0,
    '★★ 수동이면 0 이다 — **새로 생기는 것은 수동 쪽뿐**이고, 자동에서는'
    + ' 아무것도 안 빼앗는다 (사장님 「그래야 **수동으로도** 이동할 수 있게」)');
  const s = summary(n, false);
  ok(s.state === 'off' && s.word.includes('벗어났'),
    `★ 계기가 셋으로만 말한다 (on · drift · off) — 지금 「${s.word}」`);
  ok(navState(0) === 'on' && navState(40) === 'drift' && navState(120) === 'off',
    '★ 색 갈래도 셋뿐이다 — 늘어나면 계기를 배우는 게임이 된다');
}

console.log('\n[5] ★ 싸우다 잠깐 도는 것으로 **항로가 멎지는 않나**');
{
  //  전투는 회차의 일부다. 싸우는 동안 항로가 통째로 서면 「싸우면 손해」가
  //  되고, 그러면 v70 이 만든 것(적이 쏜다 · 뚫고 간다)이 무너진다
  const half = courseMult(NAV.dead / 2);
  ok(half > 0.5,
    `★★ 절반쯤 틀어도 ${half.toFixed(2)} 는 간다 — 회피 한 번(기수 60도)으로`
    + ' 항로가 멎지 않는다');
  ok(courseMult(60) > 0,
    `★★★ **적을 쫓는 60도에서도 ${courseMult(60).toFixed(2)}** — 「뚫는다」가`
    + ' 「멈춰서 싸운다」가 되지 않는다 (WAR.md 의 한 줄)');
  ok(wrapDeg(190) === -170 && wrapDeg(-190) === 170,
    '★ 좌우 어느 쪽으로 돌아도 같게 잰다 (감아서 잰다)');
}

console.log('\n[6] ★★★ **미션을 고르면 갈아 끼워지고, 끝나면 돌아오나** (v104 ②)');
{
  //  ★★ 이걸 「거는 곳」과 「푸는 곳」으로 나눠 짜면 **푸는 자리를 하나만
  //    빠뜨려도 끝난 미션을 계속 가리킨다** — 이 저장소가 문·에어록·
  //    크레이들에서 세 번 밟은 함정이다 (건 곳은 다섯인데 푸는 곳은 넷).
  //  ★★★ 그래서 게임은 **매 프레임 「지금 갈 곳이 어디여야 하나」를 다시
  //    정한다.** 여기서는 그 규칙이 성립하는지만 본다
  const n = makeNav();
  /** 게임이 하는 것과 **같은 규칙** — 상태를 보고 답이 나온다 */
  const want = (o) => (o.rescue ? 'rescue' : (o.land ? 'land' : 'fork'));
  const put = (o, fork) => {
    const w = want(o);
    if (w === 'rescue') setMission(n, { key: 'rescue', name: '구조 신호' }, [0.9, 0.4]);
    else if (w === 'land') setMission(n, { key: 'land', name: '행성' }, [0.2, 0.7]);
    else setFork(n, fork, [0.55, 0.45]);
    return w;
  };
  const f1 = forkOf('nebula'), f2 = forkOf('planet');
  put({}, f1);
  ok(n.to.kind === 'fork' && n.to.key === 'nebula', `★ 아무 일도 없으면 **갈래**다 — 「${n.to.name}」`);
  put({ rescue: true }, f1);
  ok(n.to.kind === 'mission' && n.to.key === 'rescue',
    `★★★ 구조 신호에 응답하면 **그쪽으로 갈아 끼워진다** — 「${n.to.name}」`);
  ok(Math.abs(n.to.az) > NAV.azSpread,
    `★★ 그리고 **항로에서 벗어난 자리**다 (${n.to.az.toFixed(0)}°) — 들르는 값이 붙는다`);
  put({ land: true }, f1);
  ok(n.to.key === 'land', '★ 착륙을 고르면 행성으로 (구조가 끝났으므로)');
  put({}, f1);
  ok(n.to.kind === 'fork' && n.to.key === 'nebula',
    '★★★ **미션이 끝나면 갈래로 저절로 돌아온다** — 푸는 코드가 한 줄도 없다');
  put({}, f2);
  ok(n.to.key === 'planet',
    '★★ **구간이 바뀌면 갈래도 바뀐다** — 「fork → fork」라고 같다고 여기면'
    + ' 지난 구간의 목적지를 계속 가리킨다 (첫 판에 그렇게 짰다가 잡았다)');
  ok(want({ rescue: true, land: true }) === 'rescue',
    '★ 둘이 겹치면 **지금 하고 있는 일**이 이긴다 (구조 > 착륙)');
}

console.log('\n[7] ★★★ **길이 보이나** — 굵은 한 줄 (v130 · 사장님 「희미한 굵은 한 줄로 표시해」)');
{
  // ══ ★ 먼저 **왜 그냥 선이면 안 되는지**를 검산한다 ═══════════════════
  //   배에서 목적지로 잇는 선은 눈과 한 줄로 서 있다. 그 위의 자리는
  //   거리가 달라도 **각이 같다** — 즉 화면에서 한 점이다. v121 이
  //   고리를 고른 까닭이고, 그 셈은 지금도 맞다. **답은 눕히는 것이다**
  const to = { kind: 'fork', key: 'x', name: '성운', az: 20, el: -6, dist: null };
  const eye = { yaw: 20, pitch: -6 };          // 항로 위 — 기수가 목적지를 본다
  const naive = [40, 120, 260, 500].map((d) => relOf({ az: to.az, el: to.el, dist: d }, eye));
  const spread = Math.max(...naive.map((r) => r.off)) - Math.min(...naive.map((r) => r.off));
  console.log(`   축 위에 그냥 그은 선 — 네 자리(40·120·260·500m)가 화면에서 벌어진 각 = **${spread.toFixed(3)}도**`);
  ok(spread < 0.01,
    '★★★ **축 위의 곧은 선은 화면에서 점이 된다** — 「목적지까지 선을 긋는다」를'
    + ' 곧이곧대로 하면 아무것도 안 보인다. 그리기 전에 셈으로 알 수 있는 것이다');

  // ══ ① 눕혔더니 정말 뻗나 ══════════════════════════════════════════
  const r0 = roadOf(to, 0, 0);
  console.log(`\n   마디 ${r0.length} 개 —`);
  console.log('     거리(m)   축 아래(도)   굵기(도)   진하기');
  for (const g of r0) {
    console.log(`     ${String(Math.round(g.dist)).padStart(6)}   ${String(g.below).padStart(9)}`
      + `   ${String(g.deg).padStart(7)}   ${String(g.alpha).padStart(6)}`);
  }
  const seen = r0.map((g) => relOf(g, eye).off);
  const run = Math.max(...seen) - Math.min(...seen);
  console.log(`\n   눕힌 선이 화면에서 뻗은 각 = **${run.toFixed(2)}도** (축 위 선은 ${spread.toFixed(3)}도였다)`);
  ok(run > 10,
    `★★★ **눕히니 한 줄로 뻗는다** (${run.toFixed(1)}도) — 가까운 끝은 발밑에, 먼 끝은`
    + ' 목적지에 붙는다. 길이 눈높이가 아니라 발밑에 있는 것과 같은 까닭이다');
  ok(r0[0].below > r0[r0.length - 1].below * 5,
    `★★ **가까울수록 많이 내려간다** (${r0[0].below}도 vs ${r0[r0.length - 1].below}도) —`
    + ' 이 벌어짐이 곧 원근이고, 없으면 그냥 비스듬한 막대가 된다');
  // ★★★ v130 — **「고깔이 아니라 줄」.** 첫 판은 굵기를 세상 크기(m)로 두어
  //   가까운 끝 5.3도 · 먼 끝 0.43도가 됐고, 화면에서 **고깔**로 보였다
  //   (찍어서 알았다). 각을 못박으니 화면 굵기가 고르다
  ok(r0[0].deg / r0[r0.length - 1].deg < 2,
    `★★★ **굵기가 고르다** (${r0[0].deg}도 → ${r0[r0.length - 1].deg}도) — 「굵은 **한 줄**」이다.`
    + ' 세상 크기(m)로 못박으면 열두 배로 벌어져 줄이 아니라 고깔이 된다');
  ok(r0[r0.length - 1].deg < r0[0].deg,
    '★★ 그래도 먼 쪽이 조금 가늘다 — 아주 고르면 깊이가 안 읽힌다');

  // ══ ② ★★★ **복판을 비웠나** — 이번 판의 알맹이 ══════════════════════
  //   사장님 「너무 시야를 가리잖아」. v121 의 문은 제일 가까운 것이
  //   화면 반쪽의 0.39 였다 — 전투 원뿔(0.45)을 거의 다 채웠다
  const nearest = Math.min(...seen);
  console.log(`   항로 위일 때 길이 십자선에 제일 가까이 온 각 = ${nearest.toFixed(1)}도`);
  ok(nearest > 1.5,
    `★★★ **항로 위여도 복판을 안 지난다** (${nearest.toFixed(1)}도) — 겨누는 눈이 있는 자리는`
    + ' 비운 채로 「어디로 가는지」만 말한다. v121 이 못 지킨 것이 이것이다');
  ok(r0.every((g) => g.el < to.el),
    '★★ **모든 마디가 항로점보다 아래다** — 위로 올라오면 그것이 곧 가리는 것이다');

  // ══ ③ 방향이 항로점과 **같은가** ═══════════════════════════════════
  ok(r0.every((g) => g.az === to.az),
    '★★★ **길의 방위가 항로점 그대로다** — 여기서 딴 방향을 만들면'
    + ' 「마름모는 저기인데 길은 이리로」가 된다 (v91~v98 을 태운 그 병)');
  const off30 = { yaw: to.az + 30, pitch: to.el };
  const drift = r0.map((g) => relOf(g, off30).off);
  console.log(`   30도 틀었을 때 = ${Math.min(...drift).toFixed(1)} ~ ${Math.max(...drift).toFixed(1)}도`);
  ok(Math.min(...drift) > 20,
    '★★★ **벗어나면 길이 통째로 옆으로 간다** — 어디로 틀어야 하는지가 길로 보인다');

  // ══ ④ 흐르나 — 「나아가고 있다」가 눈에 보이나 ══════════════════════
  const r1 = roadOf(to, 20, 0);
  ok(r1.length === r0.length,
    `★★ **흘러도 마디 수가 안 변한다** (${r1.length}) — 변하면 「길이 짧아졌다」로 읽히는데,`
    + ' 남은 거리는 구간이 따로 말한다');
  ok(r1.every((g, i) => Math.abs(g.dist - r0[i].dist) < 1e-9),
    '★★★ **길은 제자리에 있고 흐르는 것은 물결이다** — 마디를 통째로 옮기면'
    + ' 「길이 다가온다」가 아니라 「목적지가 도망간다」로 보인다');
  const moved = r0.some((g, i) => Math.abs(g.alpha - r1[i].alpha) > 1e-4);
  ok(moved,
    '★★★ **나아가면 물결이 흐른다** — 도형을 하나도 안 더하고 「나아가고 있다」를 지킨다.'
    + ' 항로가 시계였던 v103 까지의 문제를 화면에서 갚는 자리다');
  const still = roadOf(to, 0, 0);
  ok(still.every((g, i) => Math.abs(g.alpha - r0[i].alpha) < 1e-9),
    '★★ **멎으면 멎은 것이 보인다** — 시계로 흘리면 멎었는데도 흘러서 거짓말이 된다');

  // ══ ⑤ 희미한가 — 사장님 말씀 그대로 ═══════════════════════════════
  console.log('');
  const top = Math.max(...r0.map((g) => g.alpha));
  // ★★★ **적는 값과 보이는 밝기가 다르다.** 선형에서 섞이고 화면에 나갈 때
  //   `^(1/2.2)` 가 씌워지므로, 0.05 는 눈에 0.26 이다. 그래서 **둘 다** 잰다 —
  //   「0.3 이하」만 재면 눈에 0.58 인 것을 통과시킨다 (첫 판이 그랬다)
  const seenTop = +(top ** (1 / 2.2)).toFixed(3);
  ok(top <= 0.09 && seenTop <= 0.36,
    `★★★ **적는 값 ${top} · 눈에 보이는 밝기 ${seenTop}** — 사장님 「**희미한**」.`
    + ' 이 둘을 같은 것으로 여기면 「희미하게 적었는데 화면은 진하다」가 난다 (찍어서 알았다)');
  const rOff = roadOf(to, 0, NAV.dead + 5);
  ok(rOff.length === r0.length && rOff[0].alpha > 0,
    '★★★ **벗어나도 길이 안 없어진다** — 벗어났을 때야말로 돌아갈 길이 필요하다.'
    + ` 흐려지기만 한다 (×${ROAD.offDim})`);
  ok(rOff[0].alpha < r0[0].alpha,
    `★ 대신 흐려진다 (${rOff[0].alpha} < ${r0[0].alpha}) — 「지금 이 길 위가 아니다」를 색이 말한다`);
  ok(roadOf(null, 0, 0).length === 0,
    '★★ **갈 곳이 없으면 안 그린다** — 늘 떠 있는 길은 길이 아니라 무늬다');
  ok(r0.every((g) => g.state === navState(0)) && rOff.every((g) => g.state === navState(NAV.dead + 5)),
    '★★ 색 갈래를 **항로점과 같은 말**로 쓴다 (`navState`) — 둘이 다른 색이면 같은 것으로 안 읽힌다');
}

console.log('\n[8] ★★★ **어느 쪽으로 틀어야 하나** (v126 · 사장님 「비행선이 가야할 방향. 우주라서 방향을 못 찾잖아」)');
{
  const to = { name: '행성' };
  console.log('   벗어남   지금 뭐라고 하나');
  for (const [off, az, el] of [[5, 4, 2], [30, -30, -6], [90, -88, -20], [150, 146, 22]]) {
    console.log(`   ${String(off).padStart(4)}도   ${navWord(to, off, { az, el })}`);
  }
  ok(navWord(to, 30, { az: -30, el: -6 }).includes('좌'),
    '★★★ **어느 쪽인지 말한다** — v125 까지 「30° 틀어졌습니다」였다. 얼마나만 있고'
    + ' 어느 쪽이 없으면 우주에서는 아무 쓸모가 없다 (땅과 달리 산도 길도 없다)');
  ok(navWord(to, 150, { az: 146, el: 22 }).includes('146'),
    '★★★ **많이 벗어날수록 말이 늘어난다** — v125 까지는 반대였다. 78도를 넘으면'
    + ' 각도마저 사라져 「벗어났습니다」만 남았고, 정작 그때가 제일 헤매는 때다');
  ok(steerWord('행성', 146, 22) === callOut('행성', 146, 22),
    '★★ **레이더와 같은 말**을 쓴다 (`callOut`) — 배 안에 방향 부르는 법이 둘이면'
    + ' 「레이더의 저것」과 「항로의 저것」이 한 머리에 안 들어온다');

  console.log('\n   화살표가 화면 어디에 서나 (−1~1)');
  for (const [az, el, what] of [[30, 0, '오른쪽'], [-30, 0, '왼쪽'], [0, 40, '위'], [0, -40, '아래']]) {
    const a = navArrow(az, el);
    console.log(`   ${what.padEnd(4)}  nx ${a.nx.toFixed(2)}  ny ${a.ny.toFixed(2)}`);
  }
  const R = navArrow(30, 0), L = navArrow(-30, 0), U = navArrow(0, 40), D = navArrow(0, -40);
  ok(R.nx > 0.7 && L.nx < -0.7, '★★★ **오른쪽이면 오른쪽 가장자리**에 선다');
  ok(U.ny > 0.7 && D.ny < -0.7, '★★★ 위면 위 · 아래면 아래');
  ok(NAVHUD.rx <= 0.9 && NAVHUD.ry <= 0.9,
    `★★ 화면 안에 있다 (${NAVHUD.rx} · ${NAVHUD.ry}) — 가장자리에 딱 붙이면 잘린다`);
  ok(NAVHUD.showFrom > 0 && NAVHUD.showFrom <= NAV.cone,
    `★★ **항로 위일 때는 조용하다** (${NAVHUD.showFrom}도 넘게 벗어나야 나온다) —`
    + ' 그때는 항로 문이 이미 말한다. 늘 떠 있는 화살표는 계기가 아니라 무늬다');
  ok(Math.abs(navArrow(146, 22).rot) < Math.PI,
    '★ 화살표가 도는 각도 준다 — 그리는 쪽이 다시 재면 「글자와 화살표가 딴 쪽」이 난다');
}

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ [9] **거점에서도 항법이 나오나** (v128)
//
//  ★ 사장님 (2026-08-12) 「**왜 항로 네비게이션이 안 나와?**」
//
//  ══ 고장이 아니라 **가리킬 것이 없었다** ══════════════════════════════
//
//  회차는 **거점에서 시작한다.** 거점에서는 `route.fork` 가 null 이라
//  게임이 `clearNav` 를 불렀고, 그래서 v104~v126 이 지은 셋(마름모 ·
//  항로 문 · 가장자리 화살표)이 **켜자마자 셋 다 조용했다.**
//
//  ★★ 그런데 거점은 「갈 곳이 없는 곳」이 아니라 **갈림길**이다. 이제
//    고르기 전에도 후보를 가리킨다 — 고르는 일이 차림표 고르기에서
//    **방향 고르기**가 된다
// ══════════════════════════════════════════════════════════════════════════
console.log('\n[9] ★★★ **거점에서도 나오나** (v128 · 사장님 「왜 항로 네비게이션이 안 나와?」)');
{
  const f = forkOf('nebula');
  const cand = forkAt(f, [0.2, 0.7], 'port');
  console.log(`   후보 — ${cand.name} · 방위 ${cand.az.toFixed(1)}° · 고도 ${cand.el.toFixed(1)}°`);
  ok(!!cand && cand.kind === 'port',
    '① ★★★ **고르기 전에도 자리를 물을 수 있다** — 거는 것과 묻는 것을 가르지 않으면'
    + ' 「후보를 보여 주기」가 곧 「골라 버리기」가 된다');
  const n = makeNav();
  setFork(n, f, [0.2, 0.7]);
  ok(Math.abs(n.to.az - cand.az) < 1e-9 && Math.abs(n.to.el - cand.el) < 1e-9,
    '② ★★★ **고르면 후보로 보여 준 바로 그 자리다** — 자리를 두 곳에서 내면'
    + ' 고르는 순간 목적지가 홱 옮겨 가고, 그건 「아까 저기였는데」가 된다');
  const g = roadOf(cand, 0, 0);
  ok(g.length > 1,
    `③ ★★ 거점에서도 **길이 선다** (마디 ${g.length}) — 켜자마자 아무것도 없던 것이 이 판의 병이었다`);
  const w = navWord(cand, 40, { az: 40, el: 5 });
  console.log(`   말 — 「${w}」`);
  ok(w.includes('고르면') && !w.includes('항로 위'),
    '④ ★★★ **아직 목적지가 아니라 후보라고 말한다** — 「항로 위」라고 하면 거짓말이다.'
    + ' 아직 아무 데도 안 가고 있다');
  // ★ 후보 둘이 **서로 다른 쪽**인가 — 같으면 「고를 것이 둘」이 화면에서 하나가 된다
  const two = offerFor({ pick: (a) => a[0], next: () => 0.5 });
  const spots = two.map((o, i) => forkAt(o, [i ? 0.85 : 0.15, 0.5], 'port'));
  const gap = Math.abs(wrapDeg(spots[0].az - spots[1].az));
  console.log(`   두 후보 사이 ${gap.toFixed(1)}°`);
  ok(gap > NAV.cone,
    `⑤ ★★ 두 후보가 **딴 쪽에 선다** (${gap.toFixed(1)}° > ${NAV.cone}°) — 겹쳐 서면`
    + ' 「배를 돌려 고른다」가 성립하지 않는다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
