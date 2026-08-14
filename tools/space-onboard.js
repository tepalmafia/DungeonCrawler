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
//
//  ★★★ v150 — **잴 툴팁이 없으면 0 도 1 도 아닌 2(못 쟀다)로 끝난다.**
//    까닭은 아래 `measuring(...)` 위의 머리말에 적어 두었다
// ══════════════════════════════════════════════════════════════════════════
import { ONBOARD, CARDS, keyOf, moreWord, summary } from '../web/space/js/game/onboard-table.js';
import { KEYS } from '../web/space/js/game/keys-table.js';
import { PICK } from '../web/space/js/game/route-table.js';
import { LAYOUT } from '../web/space/js/game/layout-table.js';
// ★★★ v150 — 「잴 것이 없으면 멈춘다」는 **한 곳에** 있다 (`folded.js` 옆)
import { measuring } from './unmeasured.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ v150 — **잴 툴팁이 없으면 통과가 아니라 「측정 불가」다**
//
//  ★ 이 검사는 **툴팁이 넉 장 있다는 전제**로만 뜻이 있다. 그런데 판정의
//    모양이 「많지 않다 · 길지 않다 · 없는 키가 없다」라 **전부 「없어야
//    한다」 꼴**이고, `CARDS` 를 통째로 비우면 이렇게 된다:
//
//      · [1] `0 <= 4` 참 · `Math.max(...[])` 는 −Infinity 라 참 ·
//            `[].every(…)` 는 언제나 참  → **✔ 셋**
//      · [2] 돌 것이 없어 **판정이 아예 안 찍힌다** (0 군데 = 합격)
//      · [3] `0 >= -1` 참
//
//    ★ 실제로 비워서 재 봤다 (2026-08-14): **판정 열 중 아홉이 초록**이고
//      「제일 긴 줄이 **−Infinity 자** (34 이하)」라는 줄까지 ✔ 로 찍혔다.
//      [2] 는 **한 줄도 안 찍히고** 조용히 지나갔다.
//      살아남은 빨강은 [3] 의 흔들기 하나뿐인데, 그건 **우연**이다 —
//      「표를 바꾸니 따라왔나」가 빈 목록에서는 못 따라오기 때문이지
//      「툴팁이 없다」를 물어서가 아니다. **우연히 남은 빨강에 기대면
//      카드 한 장만 남겨 놔도 그 빨강이 사라진다.**
//
//  ★★ 그리고 [5] 에 **더 고약한 자리**가 하나 있었다:
//    `moreWord().includes(LAYOUT.keyName)` 는 `keyName` 이 사라지면
//    `includes(undefined)` → 문자열 'undefined' 로 굳어져 **참**이 된다.
//    「창 옮기기 키를 안 적었다」를 잡으려던 줄이 **키가 없어진 날** 초록이다.
// ══════════════════════════════════════════════════════════════════════════
const must = measuring({
  tool: 'space-onboard',
  what: '툴팁',
  weak: '이 검사의 판정은 **「넘지 않는다 · 없는 키가 없다」** 꼴입니다.\n'
    + '그래서 **툴팁이 한 장도 없으면 전부 저절로 참**이 됩니다 —\n'
    + '`0 <= 4` 도 참이고, `[].every(…)` 도 참이고,\n'
    + '`Math.max(...[])` 는 −Infinity 라 「제일 긴 줄」마저 통과합니다.\n'
    + '[2] 는 아예 한 줄도 안 찍혀 「0 군데」로 합격이 됩니다.',
  look: '`web/space/js/game/onboard-table.js` 의 `CARDS` · `keys-table.js` 의 `KEYS`',
});

console.log('처음 켠 사람의 첫 3초 — 뼈대만 (게임을 안 부른다)');

try {

console.log('\n[1] ★★ **넉 장 이하 · 한 줄이 짧은가**');
{
  //  ★★★ **세기 전에 셀 것이 있나부터.** 아래 셋이 다 「넘지 않는다」라
  //    빈 목록이면 셋 다 저절로 참이다
  must.some(CARDS, '툴팁 장수를 세려는데');
  //  ★ 자(尺)가 없어져도 마찬가지다 — `maxLen` 이 사라지면 `길이 <= undefined`
  //    가 거짓이 되어 **빨간불**이 뜨는데, 그건 「툴팁이 길다」가 아니라
  //    「못 쟀다」이다. 틀린 빨강도 틀린 초록만큼 사람을 헤매게 한다
  must.as('값').value(ONBOARD.maxCards, 'maxCards', '장수의 상한을 읽으려는데');
  must.as('값').value(ONBOARD.maxLen, 'maxLen', '한 줄의 상한을 읽으려는데');
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
  //  ★★★ **대조할 명부가 비면 이 절이 뜻을 잃는다.** 「진짜 있는 키인가」는
  //    `KEYS` 를 명부로 삼아 묻는 말인데, 명부가 비면 남는 것은 손으로 적어
  //    둔 넷(PICK·LAYOUT·마우스·F1)뿐이라 **아무것도 대조하지 않는 셈**이다.
  //    (그때 빨간불이 뜨긴 하지만 「툴팁이 거짓말한다」가 아니라 「명부가
  //     없다」이므로, 고칠 곳이 정반대다 — 그래서 여기서 멈춘다)
  must.as('키').some(Object.keys(KEYS), '진짜 있는 키의 명부를 만들려는데');
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
  //  ★★★ **`includes(undefined)` 는 참이 된다.** 아래 마지막 줄이
  //    `moreWord().includes(LAYOUT.keyName)` 인데, `keyName` 이 없어지면
  //    문자열 'undefined' 로 굳어져 **늘 참**이다 (`moreWord()` 자신도
  //    「창 옮기기 undefined」라고 적으므로 양쪽이 사이좋게 맞는다).
  //    잡으려던 것이 사라지는 날 초록이 되는 판정이라 여기서 먼저 막는다
  must.as('값').value(LAYOUT.keyName, '창 옮기기 키', '맨 아래 줄을 읽으려는데');
  console.log(`   맨 아래 — 「${moreWord()}」`);
  ok(moreWord().includes('F1'),
    '★★ **더 있다고 알려 준다** — 툴팁이 전부인 척하면 나머지를 영영 안 찾는다.'
    + ' 사장님이 F1 이 있다는 것도 모르실 수 있다');
  ok(moreWord().includes(LAYOUT.keyName),
    `★ 창 옮기기(${LAYOUT.keyName})도 적는다 — v127~v131 에 만든 것이 아무 데도 안 적혀 있었다`);
  console.log(`   요약 — ${JSON.stringify(summary())}`);
}

//  ★★★ 「못 쟀다」는 예외로 날아온다. **딴 오류는 다시 던진다** —
//    여기서 삼키면 진짜 고장이 「측정 불가」로 위장된다
} catch (e) { if (!must.caught(e)) throw e; }

//  ★ 담긴 것이 있으면 여기서 **2**(못 쟀다)로 끝난다.
//    합격/불합격 줄을 **찍기 전에** 불러야 한다 — 0 이나 1 로 끝나면
//    자동으로 돌릴 때 「합격」·「불합격」으로 읽혀 버린다
must.bail();

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
