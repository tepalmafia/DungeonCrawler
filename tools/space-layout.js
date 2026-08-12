// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **창을 손으로 옮긴다** — 뼈대만 (v127)
//
//    node tools/space-layout.js
//
//  ★ 사장님 (2026-08-12) 「**상태창 광학창 레이더 등 모든 창들을 마우스로
//    위치를 자유자재로 옮길 수 있게** 해줘」
//
//  ★★★ 묻는 것 여섯
//      ① 옮길 수 있는 것과 **못 옮기는 것의 까닭**이 적혀 있나
//      ② 끌면 **거기로 가나** · 격자에 붙나
//      ③ **화면 밖으로 안 나가나** — 판의 반쪽 크기를 세나
//      ④ **되돌려지나** — 하나씩 · 통째로
//      ⑤ **저장에 남나** · 옛 저장이 새 규칙을 못 뚫나
//      ⑥ 배치 모드가 아니면 **안 집히나**
// ══════════════════════════════════════════════════════════════════════════
import {
  LAYOUT, MOVABLE, FIXED, canMove, defaultAt, clampAt, snap, hitsCone, layoutWord,
} from '../web/space/js/game/layout-table.js';
import {
  makeLayout, setLayout, grab, drop, moveTo, atOf, resetLayout, saveLayout, loadLayout, summary,
} from '../web/space/js/game/layout.js';
import { ANCHOR, PANELS } from '../web/space/js/game/screen-table.js';
import { KEYS } from '../web/space/js/game/keys-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

console.log('창을 손으로 옮긴다 — 뼈대만 (게임을 안 부른다)');

console.log('\n[1] ★★★ **무엇을 옮길 수 있나 · 못 옮기는 것은 왜인가**');
{
  console.log(`   옮길 수 있는 것 — ${MOVABLE.join(' · ')}`);
  for (const [k, why] of Object.entries(FIXED)) console.log(`   못 옮기는 것 — ${k}: ${why}`);
  ok(MOVABLE.length >= 3, `★ 사장님이 말씀하신 셋이 다 있다 (${MOVABLE.length})`);
  ok(MOVABLE.every((n) => PANELS[n]), '★★ 옮길 수 있는 것이 다 **실재하는 판**이다 — 이름이 틀리면 조용히 아무 일도 안 난다');
  ok(!canMove('조준경') && FIXED.조준경,
    '★★★ **조준경은 못 옮긴다 — 그리고 까닭이 적혀 있다.** 표적 상자와 락온 고리를'
    + ' 하늘의 진짜 자리 위에 그리므로(`space-align.js` 가 0.01도로 지킨다), 판을 옮기면'
    + ' 그 그림이 통째로 어긋난다. 취향이 아니라 규칙이다');
  const taken = new Set(Object.values(KEYS).map((k) => k.code));
  ok(!taken.has(LAYOUT.key),
    `★★ 배치 키 ${LAYOUT.keyName} 가 **맡은 키와 안 겹친다** — 겹치면 배치하다 배가 움직인다`);
}

console.log('\n[2] ★★ **끌면 거기로 가나**');
{
  // ★ `moveTo` 는 **규칙만** 본다 (옮길 수 있는 창인가 · 화면 안인가).
  //   「지금 배치 모드인가」는 집는 쪽(`grab`)이 본다 — [6] 에서 묻는다
  const L = makeLayout();
  const r = moveTo(L, '상태창', 0.2, 0.3);
  console.log(`   상태창 → (${r.x}, ${r.y})`);
  ok(Math.abs(r.x - 0.2) < LAYOUT.grid && Math.abs(r.y - 0.3) < LAYOUT.grid,
    '★★ 끈 자리로 간다 (격자만큼만 다르다)');
  ok(Math.abs(snap(0.2037) - 0.205) < 1e-9,
    `★ **격자에 붙는다** (${LAYOUT.grid}) — 손 떨림은 먹고 「거기 두고 싶다」는 살린다`);
  ok(atOf(L, '레이더') === null,
    '★★★ **안 옮긴 창은 아무것도 안 들고 있는다** — 옮기는 순간 복사해 두면'
    + ' 기본값을 고쳐도 화면이 그대로다 (「고쳤는데 안 바뀐다」의 씨앗)');
  ok(!moveTo(L, '조준경', 0, 0), '★★ 못 옮기는 창은 **끌어도 안 간다**');
}

console.log('\n[3] ★★★ **화면 밖으로 안 나가나** — 판의 반쪽을 세나');
{
  const far = clampAt(5, -5, 0.2, 0.15);
  console.log(`   (5, −5) 를 반쪽 0.2×0.15 판으로 끌면 → (${far.x}, ${far.y})`);
  ok(Math.abs(far.x) <= LAYOUT.edge - 0.2 + 1e-6 && Math.abs(far.y) <= LAYOUT.edge - 0.15 + 1e-6,
    '★★★ **반쪽 크기를 세고 막는다** — 복판만 보고 막으면 가장자리에서 절반이 잘린다');
  const naive = clampAt(5, -5, 0, 0);
  ok(Math.abs(naive.x) > Math.abs(far.x),
    `★★ 큰 판일수록 **더 일찍** 멎는다 (${naive.x} vs ${far.x})`);
  console.log(`   전투 원뿔을 먹나 — 복판(0,0) ${hitsCone(0, 0, 0.1, 0.1) ? '★건드림' : '비었음'}`
    + ` · 구석(0.9,−0.9) ${hitsCone(0.9, -0.9, 0.1, 0.1) ? '★건드림' : '비었음'}`);
  ok(hitsCone(0, 0, 0.1, 0.1) && !hitsCone(0.9, -0.9, 0.1, 0.1),
    '★★ 원뿔을 먹는지 **말은 해 준다** — 다만 막지는 않는다. 굳이 복판에 두시겠다면'
    + ' 그건 사장님 선택이다 (금지가 아니라 경고)');
}

console.log('\n[4] ★★ **되돌려지나**');
{
  const L = makeLayout();
  moveTo(L, '상태창', 0.2, 0.3);
  moveTo(L, '레이더', -0.4, 0.1);
  ok(summary(L).moved === 2, `★ 둘을 옮겼다 (${summary(L).moved})`);
  resetLayout(L, '상태창');
  ok(atOf(L, '상태창') === null && atOf(L, '레이더') !== null, '★★ **하나만** 되돌려진다');
  ok(resetLayout(L) === 1 && summary(L).moved === 0, '★★ **통째로** 되돌려진다');
  ok(defaultAt('상태창', 0, 0).nx === ANCHOR.상태창.x,
    '★★★ 되돌리면 **표의 기본값**으로 간다 (`screen-table.js ANCHOR`) — 되돌릴 곳을'
    + ' 여기 적어 두지 않는다. 두 곳에 적으면 기본값을 고칠 때 갈라진다');
}

console.log('\n[5] ★★ **저장에 남나 · 옛 저장이 새 규칙을 못 뚫나**');
{
  const L = makeLayout();
  ok(saveLayout(L) === null, '★★ 하나도 안 옮겼으면 **저장에 아무것도 안 남는다** — 빈 값을 적으면 저장이 커진다');
  moveTo(L, '레이더', 0.3, -0.2);
  const raw = saveLayout(L);
  console.log(`   저장에 나가는 것 — ${JSON.stringify(raw)}`);
  const L2 = makeLayout();
  ok(loadLayout(L2, raw) === 1 && atOf(L2, '레이더').x === atOf(L, '레이더').x,
    '★★★ **꺼내면 그 자리다**');
  const L3 = makeLayout();
  ok(loadLayout(L3, { at: { 조준경: { x: 0, y: 0 }, 레이더: { x: 9, y: 9 } } }) === 1,
    '★★★ **옛 저장이 새 규칙을 못 뚫는다** — 못 옮기는 창은 버리고');
  ok(Math.abs(atOf(L3, '레이더').x) <= LAYOUT.edge,
    '★★ 저장에 든 엉뚱한 값도 **화면 안으로** 민다 — 저장은 사람이 고칠 수 있는 파일이다');
}

console.log('\n[6] ★★★ **배치 모드가 아니면 안 집힌다**');
{
  const L = makeLayout();
  ok(!grab(L, '상태창'), '★★★ **닫혀 있으면 안 집힌다** — 모는 중에 창이 딸려 오면 그건 사고다');
  setLayout(L, true);
  ok(grab(L, '상태창') && summary(L).drag === '상태창', '★★ 열면 집힌다');
  ok(!grab(L, '조준경') || summary(L).drag === '상태창', '★ 못 옮기는 창은 열려 있어도 안 집힌다');
  ok(drop(L) === '상태창' && summary(L).drag === null, '★ 놓으면 놓아진다');
  setLayout(L, false);
  ok(!summary(L).open && summary(L).drag === null,
    '★★ **닫으면 잡고 있던 것도 놓는다** — 잡은 채로 닫히면 다음에 열 때 딸려 온다');
  console.log(`   안내 — 「${layoutWord(null, 2)}」`);
  console.log(`   끄는 중 — 「${layoutWord('레이더')}」`);
  ok(layoutWord(null, 0).includes(LAYOUT.keyName),
    '★ 안내에 **닫는 키**가 적혀 있다 — 들어가는 길만 있고 나오는 길이 없으면 갇힌다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
