// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **조준경이 읽히나** — 뼈대만 (v103)
//
//    node tools/space-hud.js
//
//  ★ 사장님 「**타겟팅 화면에서 선이나 글이 의미하는 것은? 직관적이지
//    않아서 모르겠어**」 · 「**타겟 라인이 짤리는 문제도 수정해**」
//
//  ★★★ 묻는 것 넷
//      ① **글끼리 겹치나** (사장님 사진의 「좌 3?■■· 위 34°」)
//      ② **판 밖으로 나가나** (잘린 주황 원 · 잘린 「추적 중」)
//      ③ 표식마다 **이름과 뜻이 있나** — 이름 없는 선을 안 그린다
//      ④ 자국 막대가 글줄과 **안 겹치나**
// ══════════════════════════════════════════════════════════════════════════
import {
  ROWS, COLS, SIGNBOX, SAFE, WOBMAX, MARKS, spanOf, rowsOverlap,
} from '../web/space/js/game/hud-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

console.log('조준경이 읽히나 — 뼈대만 (게임을 안 부른다)');

console.log('\n[1] ★★★ **글끼리 겹치나** — 겹치면 둘 다 못 읽는다');
{
  const names = Object.keys(ROWS);
  console.log('   줄        차지하는 칸 (판 세로의 0~1)');
  for (const n of names) {
    const s = spanOf(ROWS[n]);
    console.log(`   ${n.padEnd(9)} ${s.y0.toFixed(3)} ~ ${s.y1.toFixed(3)}   ${ROWS[n].what}`);
  }
  const laps = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      if (rowsOverlap(ROWS[names[i]], ROWS[names[j]])) laps.push(`${names[i]}×${names[j]}`);
    }
  }
  ok(!laps.length,
    `★★★ **줄이 서로 안 겹친다** ${laps.length ? `— ${laps.join(' · ')}` : ''}`);
  ok(SIGNBOX.y + SIGNBOX.h < spanOf(ROWS.dock).y0,
    '★★★ **자국 막대가 글줄 위에 있다** — 여태 아랫줄 글과 같은 자리였고,'
    + ' 그래서 사장님 사진에서 글자가 막대를 뚫고 지나갔다');
}

console.log('\n[2] ★★★ **판 밖으로 나가나** — 잘린 계기는 없는 계기다');
{
  for (const [n, r] of Object.entries(ROWS)) {
    const s = spanOf(r);
    ok(s.y0 >= SAFE.y0 && s.y1 <= SAFE.y1, `   ${n} 이 판 안에 있다 (${s.y1.toFixed(3)} ≤ ${SAFE.y1})`);
  }
  ok(COLS.left >= SAFE.x0 && COLS.right <= SAFE.x1, '   글이 좌우로 안 넘친다');
  ok(SIGNBOX.x + SIGNBOX.w <= SAFE.x1, '   자국 막대가 오른쪽으로 안 넘친다');
  ok(WOBMAX <= 0.5,
    `★★★ **흔들림 고리에 끝이 있다** (반지름 ${WOBMAX}) — 없어서 400화소까지`
    + ' 커졌고, 판이 768 이라 위아래가 통째로 잘렸다 (사장님 사진의 주황 원)');
}

console.log('\n[3] ★★★ 표식마다 **이름과 뜻이 있나** — 사장님 물음이 이것이다');
{
  console.log('');
  for (const [name, what] of MARKS) console.log(`   ${name.padEnd(14)} ${what}`);
  console.log('');
  ok(MARKS.length >= 10, `★★ 표식 ${MARKS.length} 가지에 다 뜻이 적혀 있다`);
  ok(MARKS.every(([n, w]) => n && w && w.length > 8), '★ 이름만 있고 뜻이 빈 것이 없다');
  // ★ 처음에 **이름**에서 「수평」을 찾다가 빨개졌다 — 이름은 「비스듬한 선」이고
  //   뜻이 「수평의」다. 사람이 화면에서 보는 것은 **모양**이므로 이름은
  //   모양이어야 맞고, 찾을 곳은 **뜻**이다. 검사가 틀렸지 표가 틀리지 않았다
  ok(MARKS.some(([, w]) => w.includes('수평의')),
    '★★★ **수평의가 목록에 있다** — 「내가 지금 똑바로 유지하고 있는지」 (v103)');
  ok(new Set(MARKS.map(([n]) => n)).size === MARKS.length, '★ 이름이 안 겹친다');
}

console.log('\n[4] ★ 표가 **한 곳인가**');
{
  ok(Object.values(ROWS).every((r) => r.y > 0 && r.y < 1 && r.size > 0),
    '★ 줄이 다 판 안의 값이다 (0~1)');
  ok(Object.values(ROWS).every((r) => typeof r.what === 'string' && r.what.length > 4),
    '★★ 줄마다 **무엇을 적는 줄인지**가 있다 — 이름 없는 자리를 안 만든다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
