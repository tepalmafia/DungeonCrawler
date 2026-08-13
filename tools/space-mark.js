// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **표적 표시가 표적을 가리나** — 뼈대만 (v138)
//
//    node tools/space-mark.js
//
//  ★ 사장님 (2026-08-13) 「목표물을 **타겟팅할때 타겟 표시가 목표물을
//    가려서 뭐가 뭔지 모르는데** 어떻게 개선할지」
//
//  ★★★ 묻는 것 다섯
//      ① ★★★ **덮지 않나** — 상자가 표적보다 작으면 실루엣을 갉아먹는다
//      ② ★★★ **가까우면 지우나** — 눈이 이미 보는데 상자를 두면 그게 가림막이다
//      ③ **멀어도 찾을 수 있나** — 작아진다고 사라지면 못 찾는다
//      ④ **글이 표적에서 떨어져 있나**
//      ⑤ ★★ **진한 것이 하나인가** (v130 「굵은 한 줄」과 같은 규약)
// ══════════════════════════════════════════════════════════════════════════
import { MARK, markAt, covers, markWord, degAt } from '../web/space/js/game/mark-table.js';
import { lenOf } from '../web/space/js/game/target-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

console.log('표적 표시 — 가리나 (게임을 안 부른다)');

console.log('\n[1] ★★★ **덮지 않나**');
{
  console.log('   거리    표적      상자      무엇을 그리나');
  let badOne = false;
  for (const d of [30, 60, 100, 160, 240]) {
    const m = markAt(lenOf('raider'), d, true);
    console.log(`   ${String(d).padStart(4)}m  ${String(m.deg).padStart(6)}°  ${String(m.boxDeg).padStart(6)}°   ${markWord(m)}`);
    if (covers(m)) badOne = true;
  }
  ok(!badOne,
    '★★★ **상자가 표적을 덮는 거리가 없다** — v137 까지 상자가 **고정 크기**라,'
    + ' 1도짜리 표적을 삼켰다. 「표시가 배보다 큰」 것이 사장님이 보신 그것이다');
  ok(MARK.box > 1.2 && MARK.box < 1.8,
    `★★ 상자가 표적의 ×${MARK.box} 다 — 1.0 이면 실루엣에 딱 붙고, 2.0 이면 옆 표적까지 삼킨다`);
}

console.log('\n[2] ★★★ **가까우면 지우나**');
{
  const near = markAt(lenOf('raider'), 40, true);
  const far = markAt(lenOf('raider'), 200, true);
  console.log(`   40m — ${markWord(near)}\n   200m — ${markWord(far)}`);
  ok(!near.box && far.box,
    `★★★ **가까우면 상자를 지운다** (${MARK.dropAt}° 를 넘으면) — 그 거리에서는 눈이`
    + ' 이미 배를 본다. 상자는 **찾는 도구**이지 보는 도구가 아니다 (Ace Combat 의 규약)');
  ok(near.hooks && far.hooks,
    '★★ **갈고리는 늘 남는다** — 「지정돼 있다」를 알리는 최소한이다.'
    + ' 다 지우면 어느 놈을 물고 있는지 모른다');
}

console.log('\n[3] ★★ **멀어도 찾을 수 있나**');
{
  const m = markAt(lenOf('drone'), 240, true);
  console.log(`   제일 작은 것(drone ${lenOf('drone')}m)이 240m 에서 — ${markWord(m)}`);
  ok(m.boxDeg >= MARK.minDeg,
    `★★★ **작아져도 ${MARK.minDeg}° 아래로는 안 줄어든다** — 표시가 표적만큼 작아지면`
    + ' 그건 표시가 아니다. **표적은 작아도 되고 표시는 안 된다**');
  ok(m.boxDeg > m.deg,
    '★ 먼 표적에서는 상자가 표적보다 크다 — 그게 **찾는 도구**의 일이다');
}

console.log('\n[4] ★★ **글이 표적에서 떨어져 있나**');
{
  const m = markAt(lenOf('raider'), 100, true);
  console.log(`   100m — 상자 ${m.boxDeg}° · 글은 ${m.tagDeg}° 밖`);
  ok(m.tagDeg > m.boxDeg / 2,
    '★★★ **글이 상자 밖에 앉는다** — 표적 위에 글을 얹으면 **글도 안 읽히고 배도**'
    + ' **안 보인다.** 지금이 정확히 그 상태다');
  ok(MARK.leader,
    '★★ **가는 선으로 잇는다** — 안 이으면 여럿일 때 어느 표적의 글인지 모른다');
  ok(MARK.tagAt.x !== 0 && MARK.tagAt.y !== 0,
    '★ 글이 **비스듬히** 앉는다 — 정가로/정세로면 조준선이나 지시선과 겹친다');
}

console.log('\n[5] ★★ **진한 것이 하나인가**');
{
  const hot = markAt(lenOf('raider'), 100, true).alpha;
  const dim = markAt(lenOf('raider'), 100, false).alpha;
  console.log(`   지정한 것 ${hot} · 나머지 ${dim}`);
  ok(hot > dim * 2.5,
    `★★★ **지정한 것만 진하다** (${hot} vs ${dim}) — v130 에 항로를 「굵은 한 줄」로`
    + ' 바꾼 것과 같은 규약이다. **화면에 진한 것은 하나**여야 눈이 갈 데를 안다');
  ok(dim > 0.15,
    `★★ 그래도 나머지가 **보이기는 한다** (${dim}) — 아예 지우면 「저기 또 있다」를 놓친다`);
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
