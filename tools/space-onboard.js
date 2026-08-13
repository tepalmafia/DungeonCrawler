// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **처음 켠 사람의 첫 3초** — 뼈대만 (v132)
//
//    node tools/space-onboard.js
//
//  ★ 사장님 (2026-08-13) 「**처음 시작시 툴팁 같은걸로 사용자가 이해할 수
//    있도록 도움말이 자동으로 나오도록 해야겠어.**」
//
//  ★★★ 묻는 것 다섯
//      ① 넉 장 이하인가 · 한 줄이 짧은가
//      ② ★★★ **적힌 키가 진짜 있는 키인가** — 이 저장소가 세 번 덴 자리
//      ③ **손으로 박아 두지 않았나** — 표를 고치면 툴팁이 따라오나
//      ④ **새 게임에서만 뜨나** — 켤 때마다 뜨면 잔소리다
//      ⑤ **나오는 길이 있나** · 「더 있다」를 알려 주나
// ══════════════════════════════════════════════════════════════════════════
import { ONBOARD, CARDS, keyOf, moreWord, summary } from '../web/space/js/game/onboard-table.js';
import { KEYS } from '../web/space/js/game/keys-table.js';
import { PICK } from '../web/space/js/game/route-table.js';
import { LAYOUT } from '../web/space/js/game/layout-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

console.log('처음 켠 사람의 첫 3초 — 뼈대만 (게임을 안 부른다)');

console.log('\n[1] ★★ **넉 장 이하 · 한 줄이 짧은가**');
{
  for (const c of CARDS) {
    console.log(`   [${String(keyOf(c)).padEnd(9)}] ${c.line}`);
    console.log(`                 ${c.tip}`);
  }
  ok(CARDS.length <= ONBOARD.maxCards,
    `★★ ${CARDS.length} 장 (${ONBOARD.maxCards} 이하) — 다섯이면 안 읽는다.`
    + ' 가르침을 일곱으로 못박은 것과 같은 까닭이다');
  const longest = Math.max(...CARDS.map((c) => c.line.length));
  ok(longest <= ONBOARD.maxLen,
    `★ 제일 긴 줄이 ${longest}자 (${ONBOARD.maxLen} 이하) — 넘으면 툴팁이 아니라 설명서다`);
  ok(CARDS.every((c) => c.tip && c.tip.length <= ONBOARD.maxLen + 12),
    '★ 장마다 **한 마디 덧말**이 있다 — 키만 있으면 「그래서 뭘」이 남는다');
}

console.log('\n[2] ★★★ **적힌 키가 진짜 있는 키인가** — 세 번 덴 자리');
{
  //  · v110 — 걷기를 없앴는데 첫 가르침이 「WASD 로 걷습니다」였다
  //  · v82  — 항로를 조종석으로 옮겼는데 안내는 「관측실 해도대」였다
  //  · v131 — 되돌리기를 Backspace 로 옮겼는데 안내는 R 이라고 했다
  //  ★★★ 셋 다 「고쳐 놓고 안내를 안 고쳤다」이고, 셋 다 **키를 글에
  //    박아 두었기 때문**이다
  const real = new Set([
    ...Object.values(KEYS).map((k) => String(k.code).replace('Key', '')),
    PICK.name, LAYOUT.keyName, '마우스', 'F1',
  ]);
  for (const c of CARDS) {
    const parts = String(keyOf(c)).split(/\s*[·/]\s*/);
    const badOnes = parts.filter((x) => !real.has(x.trim()));
    ok(badOnes.length === 0,
      `★★★ 「${keyOf(c)}」 가 **진짜 있는 키다**${badOnes.length ? ` — 없는 것: ${badOnes.join(',')}` : ''}`);
  }
}

console.log('\n[3] ★★★ **손으로 박아 두지 않았나** — 표를 고치면 따라오나');
{
  const fn = CARDS.filter((c) => typeof c.key === 'function');
  console.log(`   표에서 읽어 오는 장 ${fn.length} / ${CARDS.length}`);
  ok(fn.length >= CARDS.length - 1,
    '★★★ **키를 글에 안 박았다** — 「마우스」 말고는 다 표에서 읽어 온다.'
    + ' 박아 두면 표를 고치는 날 **조용히 거짓말**이 된다 (v110·v82·v131 이 그랬다)');
  // ★ 정말 따라오나 — 표를 흔들어 본다
  const was = PICK.name;
  PICK.name = '★시험';
  const now = CARDS.map(keyOf).join(' ');
  PICK.name = was;
  ok(now.includes('★시험'),
    '★★★ **표를 바꾸니 툴팁이 따라왔다** — 「따라올 것이다」가 아니라 **따라온다**를 잰다');
}

console.log('\n[4] ★★ **새 게임에서만 뜨나**');
{
  ok(ONBOARD.newGameOnly,
    '★★★ **이어하는 사람에게는 안 뜬다** — 켤 때마다 뜨면 도움말이 아니라 잔소리다');
  ok(ONBOARD.hold >= 4 && ONBOARD.hold <= 10,
    `★ 한 장이 ${ONBOARD.hold}초 떠 있다 — 2초면 읽기 전에 사라지고 15초면 갇힌 것 같다`);
}

console.log('\n[5] ★★ **나오는 길 · 「더 있다」**');
{
  ok(ONBOARD.anyKeyCloses,
    '★★★ **아무 키나 누르면 닫힌다** — 「들어가는 길만 있고 나오는 길이 없으면 갇힌다」');
  console.log(`   맨 아래 — 「${moreWord()}」`);
  ok(moreWord().includes('F1'),
    '★★ **더 있다고 알려 준다** — 툴팁이 전부인 척하면 나머지를 영영 안 찾는다.'
    + ' 사장님이 F1 이 있다는 것도 모르실 수 있다');
  ok(moreWord().includes(LAYOUT.keyName),
    `★ 창 옮기기(${LAYOUT.keyName})도 적는다 — v127~v131 에 만든 것이 아무 데도 안 적혀 있었다`);
  console.log(`   요약 — ${JSON.stringify(summary())}`);
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
