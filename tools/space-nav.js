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
// ══════════════════════════════════════════════════════════════════════════
import { NAV, courseMult, navWord, navState, wrapDeg } from '../web/space/js/game/nav-table.js';
import { makeNav, setFork, setMission, clearNav, hasNav, stepNav, summary } from '../web/space/js/game/nav.js';
import { forkOf, allForks, LEG } from '../web/space/js/game/route-table.js';
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

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
