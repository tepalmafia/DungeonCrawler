// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **마우스를 쓰는 모드** — 뼈대만 (v129)
//
//    node tools/space-mode.js
//
//  ★ 사장님 (2026-08-13) 「**블록아웃으로 테스트하고 구현하고 있지?**」
//
//  ★★ v128 은 「u로 ui 이동 시키면 방향 전환이 안 돼」를 **화면에서 재서**
//    고쳤다. 답은 맞았지만 **순서를 어겼다** — 뼈대 없이 계통을 고쳤다.
//    그래서 같은 함정이 **베이(I)에 하나 더 남아 있는 것**을 못 봤다
//    (열면 I 로도 Esc 로도 안 닫힌다 · 진짜 브라우저로 확인).
//
//  ★★★ 이 검사가 그 자리다. 여기서 묻는 것은 **규칙**이고, 「화면이 정말
//    그 규칙대로 도나」는 `space-endtoend.js [6u]` 가 진짜 키·진짜 마우스로
//    따로 묻는다. 한쪽만 읽으면 「둘이 같나」를 못 묻는다
//
//  ★★★ 묻는 것 여섯
//      ① 마우스를 쓰는 모드가 다 적혀 있고 **까닭**이 있나
//      ② **하나라도 열려 있으면 안 잠근다** · 다 닫히면 잠근다
//      ③ ★★★ **열려 있는 동안 자동 멈춤이 안 걸리나** — 이번 병의 알맹이
//      ④ ★★★ **겹쳐 열어도 하나만 닫았을 때 잠금이 안 되살아나나**
//      ⑤ ★★★ **멈춰 있어도 닫히나** — 나오는 길은 원인과 상관없이 열려 있나
//      ⑥ 마우스를 쓰는 것과 **멈추는 것이 다른 일**로 적혀 있나
// ══════════════════════════════════════════════════════════════════════════
import {
  MODES, MODE_NAMES, takesMouse, openList, wantLock, autoPauseOK, wantStop,
  closableWhileStopped, modeWord,
} from '../web/space/js/game/mode-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

console.log('마우스를 쓰는 모드 — 뼈대만 (게임을 안 부른다)');

console.log('\n[1] ★★ **무엇이 마우스를 쓰나 · 왜인가**');
{
  for (const n of MODE_NAMES) {
    console.log(`   ${n.padEnd(4)} ${MODES[n].key.padEnd(9)} ${MODES[n].stops ? '멈춤' : '돈다'} — ${MODES[n].why}`);
  }
  ok(MODE_NAMES.length >= 5, `★ 다섯이 다 있다 (${MODE_NAMES.length})`);
  ok(MODE_NAMES.every((n) => MODES[n].why && MODES[n].key),
    '★★ **까닭 없이 잠금을 푸는 모드가 없다** — 푸는 순간 조종간이 죽으므로'
    + ' 「왜 풀어야 하나」에 답을 못 하면 안 푸는 것이 맞다');
}

console.log('\n[2] ★★★ **하나라도 열려 있으면 안 잠근다**');
{
  ok(wantLock({}), '★ 아무것도 안 열렸으면 잠근다 — 그때가 노는 중이다');
  for (const n of MODE_NAMES) {
    ok(!wantLock({ [n]: true }) && takesMouse({ [n]: true }), `★ ${n} 를 열면 안 잠근다`);
  }
  ok(wantLock({ 배치: false, 베이: false }), '★★ 다 닫히면 다시 잠근다 — **여는 것과 닫는 것은 대칭이다**');
}

console.log('\n[3] ★★★ **열려 있는 동안 자동 멈춤이 안 걸린다** — 이번 병의 알맹이');
{
  //  ★ 잠금이 풀린 것을 「사람이 창 밖으로 나갔다」로 읽어 멈추면,
  //    닫는 키가 `!paused` 에 막혀 **못 나온다.** 그러면 잠금도 안 돌아오고,
  //    잠금이 없으면 이 배는 **조종간이 안 움직인다** (사장님이 겪으신 것)
  ok(autoPauseOK({}), '★ 아무것도 안 열렸는데 잠금이 풀렸으면 **정말 나간 것**이다 — 멈춰도 된다');
  for (const n of MODE_NAMES) {
    ok(!autoPauseOK({ [n]: true }),
      `★★★ ${n} 가 열려 있는 동안은 **자동으로 안 멈춘다** — 그 풀림은 게임이 스스로 푼 것이다`);
  }
}

console.log('\n[4] ★★★ **겹쳐 열어도 하나만 닫았을 때 잠금이 안 되살아난다**');
{
  const both = { 베이: true, 배치: true };
  ok(!wantLock(both) && openList(both).length === 2, `★ 둘이 겹쳐 열렸다 (${openList(both).join(' · ')})`);
  const one = { 베이: true, 배치: false };
  ok(!wantLock(one),
    '★★★ 하나만 닫아도 **아직 안 잠근다** — 모드마다 제 조건을 들면 여기서 갈라진다.'
    + ' 배치를 닫는 순간 잠겨서 베이 단추를 못 누르게 된다');
  ok(wantLock({ 베이: false, 배치: false }), '★★ 마지막 하나가 닫혀야 잠근다');
}

console.log('\n[5] ★★★ **멈춰 있어도 닫힌다** — 나오는 길');
{
  ok(closableWhileStopped(),
    '★★★ **왜 멈췄는지와 상관없이 닫는 키는 살아 있다.** 원인을 없애는 것과'
    + ' 나오는 길을 두는 것은 **따로 해야 한다** — 원인은 또 생기기 때문이다.'
    + ' v128 에 배치가, 지금 베이가 정확히 그 자리에서 갇혔다');
}

console.log('\n[6] ★★ **마우스를 쓰는 것과 멈추는 것은 다른 일이다**');
{
  const runs = MODE_NAMES.filter((n) => !MODES[n].stops);
  const stops = MODE_NAMES.filter((n) => MODES[n].stops);
  console.log(`   도는 것 — ${runs.join(' · ')}`);
  console.log(`   멈추는 것 — ${stops.join(' · ')}`);
  ok(runs.length > 0 && stops.length > 0,
    '★★★ **둘 다 있다.** 여태 이 둘이 한 덩어리라 「마우스 쓰려고 풀었는데 멈춰 버리는」'
    + ' 일이 났다. 점검·배치·베이는 배가 계속 나는 채로 만지는 것이고, 도움말·멈춤은 멈추는 것이다');
  ok(!wantStop({ 배치: true }) && wantStop({ 도움말: true }),
    '★★ 열린 것에 따라 멈출지가 갈린다 — 게임이 제 방식으로 다시 세면 그때부터 갈라진다');
  console.log(`   안내 — 「${modeWord({ 베이: true, 배치: true })}」`);
  ok(modeWord({ 베이: true }).includes(MODES.베이.key),
    '★ 안내에 **닫는 키**가 적혀 있다 — 갇혔을 때 화면이 길을 말해 줘야 한다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
