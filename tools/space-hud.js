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
import { hudFov } from '../web/space/js/game/view-table.js';
import {
  ROWS, COLS, SIGNBOX, SAFE, WOBMAX, MARKS, spanOf, rowsOverlap,
  ADI, rungs, pitchWord, READ, plateShare, minSize, toPx,
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
  const topRow = Object.values(ROWS).reduce((a, r) => Math.min(a, spanOf(r).y0), 9);
  ok(SIGNBOX.y + SIGNBOX.h < topRow,
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

console.log('\n[5] ★★★ **화면에서 읽히나** — 판이 작다 (v105 · 사장님 「글씨가 작게 여러개」)');
{
  const V = hudFov().v;
  const share = plateShare(V), need = minSize(V);
  console.log(`   조준경이 화면 세로의 **${(share * 100).toFixed(1)}%** 를 덮는다`
    + ` — ${READ.screenH}화소 화면이면 **${(share * READ.screenH).toFixed(0)}화소**`);
  console.log(`   그래서 읽히려면 판 높이의 **${need.toFixed(3)}** 이상이어야 한다\n`);
  console.log('   줄        판 대비    화면 화소');
  for (const [k, r] of Object.entries(ROWS)) {
    console.log(`   ${k.padEnd(9)} ${r.size.toFixed(3)}      ${toPx(r.size, V).toFixed(1)}px`);
  }
  for (const [k, r] of Object.entries(ROWS)) {
    ok(r.size >= need,
      `★★★ ${k} 이 화면에서 **${toPx(r.size, V).toFixed(1)}px** (${READ.minPx}px 이상)`);
  }
  ok(toPx(SIGNBOX.label, V) >= READ.minPx * 0.85,
    `★★ 자국 이름표도 읽힌다 (${toPx(SIGNBOX.label, V).toFixed(1)}px)`);
  ok(Object.keys(ROWS).length <= 3,
    `★★★ **글줄이 ${Object.keys(ROWS).length} 개다** — 키우면 자리가 없어지므로 수를 줄였다.`
    + ' 다섯을 15화소로 키우면 판의 절반을 먹는다 (사장님 「조잡하잔아」의 답)');
  ok(ADI.showFrom > 0 && ADI.span <= 20,
    `★★★ **사다리는 ${ADI.showFrom}도 넘게 기울 때만 · ±${ADI.span}도까지** —`
    + ' 수평일 때 사다리는 아무것도 안 말하는데 늘 그려서 판을 덮고 있었다');
}

console.log('\n[6] ★★★ **자세계** — 「비행기 현재 회전 상태」가 다 보이나 (사장님 물음)');
{
  //  ★ 첫 판은 **절반**이었다: 수평선을 늘 화면 복판에 그려서 롤만 보였다.
  //    실기의 자세계는 「고정된 기수 표시 + 움직이는 수평선」이 한 벌이고,
  //    그 **벌어짐**이 곧 피치다. 선을 복판에 못박으면 그 정보가 사라진다.
  const FOV = hudFov();
  const TANV = Math.tan((FOV.v / 2) * Math.PI / 180);
  /** 참 크기로는 판 세로의 어디에 오나 */
  const raw = (el) => Math.tan(el * Math.PI / 180) / TANV;
  /** 실제로 그리는 자리 — **접는다** (`ADI.squeeze`) */
  const at = (el) => raw(el) * ADI.squeeze;
  console.log(`   조준경이 세로로 ${FOV.v}도를 덮는다 — 그래서 사다리를 ${ADI.squeeze} 배로 접는다`);
  console.log('   기수 각   참 크기면   접으면      말');
  for (const el of [0, 5, 10, 20, 40, 45, -12]) {
    const r0 = raw(el), y = at(el);
    console.log(`   ${String(el).padStart(4)}도   ${r0.toFixed(2).padStart(6)}`
      + `${Math.abs(r0) > 1 ? ' ★밖' : '    '}`
      + `   ${y.toFixed(2).padStart(6)}${Math.abs(y) > 1 ? ' ★밖' : '    '}`
      + `   ${pitchWord(el)}`);
  }
  ok(Math.abs(at(0)) < 1e-9, '★★★ **수평이면 수평선이 복판**에 온다 — 십자선과 겹친다');
  ok(Math.abs(raw(ADI.step)) > 0.9,
    `★★★ **참 크기로는 못 쓴다** — 기수 ${ADI.step}도에 벌써 판 끝(${raw(ADI.step).toFixed(2)})이다.`
    + ' 360도를 도는 배에 ±10도짜리 계기를 다는 셈이 된다');
  ok(Math.abs(at(ADI.span)) < 1,
    `★★★ **접으면 ±${ADI.span}도가 다 들어온다** (${at(ADI.span).toFixed(2)}) —`
    + ' 실기 HUD 가 사다리를 압축하는 것과 같은 이유의 같은 해법이다');
  ok(at(10) > 0.1 && Math.abs(at(10)) < 1,
    `★★★ **기수를 10도 들면 수평선이 ${at(10).toFixed(2)} 만큼 내려간다** —`
    + ' 이 벌어짐이 곧 기수 각이고, 첫 판에는 이것이 통째로 없었다');
  ok(at(-12) < 0, '★ 내리면 반대쪽으로 간다 (부호를 머리로 안 맞히고 잰다)');
  ok(Math.abs(at(ADI.steep)) > Math.abs(at(ADI.span)),
    `★★ ${ADI.steep}도는 ${ADI.span}도보다 더 밖이다 — 넘어가면 가장자리에 붙여 남긴다`
    + ` (\`pin\` ${ADI.pin})`);
  ok(ADI.pin < SAFE.y1 && ADI.pin > 0, '★ 붙는 자리가 판 안이다');
  // 사다리
  const r = rungs();
  ok(r.length === (ADI.span / ADI.step) * 2,
    `★★ 사다리가 ±${ADI.span}도까지 ${ADI.step}도마다 ${r.length} 칸`);
  ok(!r.includes(0), '★ 0 은 안 넣는다 — 그건 수평선 자신이다');
  ok(Math.abs(at(ADI.step)) > 0.12,
    `★★★ 눈금 사이가 판의 ${Math.abs(at(ADI.step)).toFixed(2)} 이다 — 이보다 촘촘하면 못 읽는다`);
  ok(MARKS.some(([, w]) => w.includes('피치 사다리'))
    && MARKS.some(([, w]) => w.includes('수평선이 내려간다')),
    '★★★ **표식 목록에 피치가 들어 있다** — 사장님 「선이나 글이 의미하는 것은?」의 답이 늘 따라와야 한다');
  ok(pitchWord(0) === '수평' && pitchWord(14).includes('올림') && pitchWord(-14).includes('내림'),
    `★ 말로도 말한다 — 「${pitchWord(14)}」 · 「${pitchWord(-14)}」`);
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
