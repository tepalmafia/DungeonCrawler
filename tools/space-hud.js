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
import { FLY_VIEW } from '../web/space/js/game/helm-table.js';
import { hudFov } from '../web/space/js/game/view-table.js';
import {
  ROWS, COLS, SIGNBOX, SAFE, WOBMAX, MARKS, spanOf, rowsOverlap,
  ADI, rungs, pitchWord, READ, plateShare, minSize, toPx,
  PLATE, radiusOf, LOCKRING, lockArcs, PIPPER, pipperAt, ringMax,
} from '../web/space/js/game/hud-table.js';
import { RADAR } from '../web/space/js/game/combat-table.js';
import { RINGS, SHOW_AT } from '../web/space/js/game/aim-table.js';
import { TARGET, KINDS } from '../web/space/js/game/target-table.js';

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
  ok(SIGNBOX === null,
    '★★★ **자국 막대가 조준경에 없다** (v121) — 상태창이 이미 같은 줄을 들고'
    + ' 있었다. 같은 값을 두 곳에 그리는 것이 사장님 「조잡해서」의 한 몫이고,'
    + ' 하필 그 자리가 **락온 고리가 지나는 자리**였다');
  void topRow;
}

console.log('\n[2] ★★★ **판 밖으로 나가나** — 잘린 계기는 없는 계기다');
{
  for (const [n, r] of Object.entries(ROWS)) {
    const s = spanOf(r);
    ok(s.y0 >= SAFE.y0 && s.y1 <= SAFE.y1, `   ${n} 이 판 안에 있다 (${s.y1.toFixed(3)} ≤ ${SAFE.y1})`);
  }
  ok(COLS.left >= SAFE.x0 && COLS.right <= SAFE.x1, '   글이 좌우로 안 넘친다');
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
  //  ══ ★★★ v139 — **묻는 것을 고쳤다** ═══════════════════════════════
  //   여기가 `camFov >= 90` 이었다. 94 를 전제로 적어 둔 것인데, v139 가
  //   화각을 **74 로 좁히자** 이 절이 빨개졌다 — 게임이 아니라 **검사가
  //   옛 값을 지키고 있었던 것**이다 (이 저장소의 단골).
  //  ★★ 묻어야 하는 것은 「90 을 넘나」가 아니라 **「표에서 읽나」**다.
  //    `READ.camFov` 는 이미 `FLY_VIEW.fov` 를 그대로 돌려준다 —
  //    그래서 화각을 고치면 조준경 셈이 **저절로 따라온다**
  ok(READ.camFov === FLY_VIEW.fov && READ.camFov >= 60 && READ.camFov <= 100,
    `★★★ **재는 화각이 조종 중 화각이다** (${READ.camFov}도 · 표에서 읽는다) —`
    + ' v120 까지 72 라고 **손으로 적어** 두었다가, 화각을 40도로 넓힌 뒤에도'
    + ' 옛 값으로 재고 있었다. 숫자를 베끼면 반드시 낡는다');

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
  ok(Math.abs(raw(ADI.span)) > 1,
    `★★★ **참 크기로는 못 쓴다** — 기수 ${ADI.span}도면 벌써 판 밖(${raw(ADI.span).toFixed(2)})이다.`
    + ` 360도를 도는 배에 ±${Math.round(180 / Math.PI * Math.atan(TANV))}도짜리 계기를 다는 셈이 된다`
    + ' (v121 에 판을 40도로 넓히고도 이건 그대로다 — 판을 넓혀도 그리는 각은 안 늘어난다)');
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

console.log('\n[7] ★★★ **고리가 작고 조잡한가** (v121 · 사장님 「원이 작고 조잡해서 직관적이지 않는데?」)');
{
  const V = hudFov().v, H = hudFov().h;
  const share = plateShare(V);
  /** 판 높이 대비 → 화면 화소 */
  const px = (rH) => rH * share * READ.screenH;

  // ── ① 락온 게이트가 계기를 관통하나 ──────────────────────────────
  const rLock = radiusOf(RADAR.lockCone, H);
  console.log(`   락온 게이트 반지름 = 판 높이의 **${rLock.toFixed(3)}**`
    + ` (${RADAR.lockCone}도 · 화면에서 지름 ${(2 * px(rLock)).toFixed(0)}화소)`);
  console.log(`     고리 위 y=${(0.5 - rLock).toFixed(3)} · 아래 y=${(0.5 + rLock).toFixed(3)}`);
  console.log('     (자국 막대는 v121 에 조준경에서 빠졌다 — 상태창이 든다)');
  const fo = spanOf(ROWS.foot);
  console.log(`     아랫줄 글 y=${fo.y0.toFixed(3)}~${fo.y1.toFixed(3)} (좌우 양끝에 글이 있다)`);

  const AR = PLATE.w / PLATE.h;
  /** 고리 위의 한 점 — 판 정규 좌표 (x 는 가로 0~1, y 는 세로 0~1) */
  const at = (deg) => ({
    x: 0.5 + (rLock * Math.cos((deg * Math.PI) / 180)) / AR,
    y: 0.5 + rLock * Math.sin((deg * Math.PI) / 180),
  });
  const inSign = () => false;   // 자국 막대가 없어졌다 (v121)
  // ★ 아랫줄은 **좌우 양끝에 글이 있다** (왼쪽 「무엇을 보나」 · 오른쪽
  //   「재는 중」). 그래서 가로는 통째로 막힌 것으로 본다 — 덜 까다롭게
  //   재면 「도구는 초록인데 화면은 겹치는」 상태가 그대로 돌아온다
  const inFoot = (p) => p.y >= fo.y0 && p.y <= fo.y1 && p.x >= COLS.left && p.x <= COLS.right;
  /** 이 각을 그리나 */
  const drawn = (deg) => {
    const d = ((deg % 360) + 360) % 360;
    return lockArcs().some((a) => {
      const a0 = ((a.a0 % 360) + 360) % 360, a1 = a0 + (a.a1 - a.a0);
      return (d >= a0 && d <= a1) || (d + 360 >= a0 && d + 360 <= a1);
    });
  };
  const hitS = [], hitF = [];
  for (let d = 0; d < 360; d += 0.5) {
    if (!drawn(d)) continue;
    const p = at(d);
    if (inSign(p)) hitS.push(d);
    if (inFoot(p)) hitF.push(d);
  }
  const gaps = [];
  for (let d = 0; d < 360; d += 0.5) {
    const p = at(d);
    if (inSign(p) || inFoot(p)) gaps.push(d);
  }
  console.log(`     고리가 계기 위를 지나는 각 = ${gaps.length ? `${gaps[0]}~${gaps[gaps.length - 1]}도 사이 ${gaps.length}곳` : '없다'}`);
  console.log(`     그리는 토막 = ${lockArcs().map((a) => `${a.a0}~${a.a1}`).join(' · ')}도`);
  ok(!hitS.length,
    `★★★ **락온 게이트가 자국 막대를 안 지난다** ${hitS.length ? `— ${hitS[0]}도에서 겹친다` : ''}`
    + ' (v120 까지 연속 원이라 통째로 관통했다 · 사장님 사진의 「자국 100」)');
  ok(!hitF.length,
    `★★★ **락온 게이트가 아랫줄 글을 안 지난다** ${hitF.length ? `— ${hitF[0]}도에서 겹친다` : ''}`
    + ' (사장님 사진의 「파편 — 좌 120° · 위 30°」)');
  ok(Math.abs(rLock - radiusOf(RADAR.lockCone, H)) < 1e-9,
    `★★★ **크기는 안 줄였다** — ${RADAR.lockCone}도는 ${RADAR.lockCone}도다.`
    + ' 줄여 그리면 「이 안에 두면 물린다」가 거짓말이 된다 (v103 의 병)');
  ok(LOCKRING.span * 4 < 360 * 0.62,
    `★★ 토막 넷이 둘레의 ${((LOCKRING.span * 4) / 360 * 100).toFixed(0)}% 만 덮는다`
    + ' — 연속 원은 「경계」로, 토막은 「여기 안으로 몰아라」로 읽힌다');

  // ── ② 조준 띠가 몇 겹인가 ────────────────────────────────────
  console.log('');
  const drawnRings = RINGS.filter((r) => r.mark !== 'none');
  console.log(`   조준 띠 ${RINGS.length} 중 **${drawnRings.length} 만 그린다** —`
    + ` ${drawnRings.map((r) => `${r.key}:${r.mark}`).join(' · ')}`);
  console.log('   표적       화면 지름 (760화소 화면)');
  for (const k of ['drone', 'fighter', 'junk', 'raider', 'hulk', 'convoy']) {
    const tol = TARGET.aimTol * (KINDS[k].size ?? 1);
    const line = drawnRings.map((r) => {
      const rH = radiusOf(tol * r.r, H);
      return rH > ringMax() ? `${r.key} ✘안그림` : `${r.key} ${(2 * px(rH)).toFixed(0)}px`;
    });
    console.log(`   ${k.padEnd(9)} ${line.join(' · ')}`);
  }
  ok(drawnRings.length <= 3,
    `★★★ **그리는 고리가 ${drawnRings.length} 겹이다** — 넷을 다 얇은 원으로 그리니`
    + ' 파편 기준 34/71/111/143화소가 100화소 안에 포개졌다. 그게 「조잡」이다');
  ok(new Set(drawnRings.map((r) => r.mark)).size === drawnRings.length,
    '★★★ **셋이 다 다른 모양이다** (채운 면 · 고리 · 문) — 같은 모양을 겹쳐 그리면'
    + ' 겹 수만 늘고 뜻은 안 는다');
  ok(drawnRings.some((r) => r.mark === 'disc'),
    '★★★ **제일 안쪽은 채운 면이다** — 화면에서의 크기는 못 키우므로(각을 그리는'
    + ' 판이라 판을 넓히면 정확히 상쇄된다) **채워서** 크게 읽히게 한다');
  ok(SHOW_AT > 1 && SHOW_AT < 3,
    `★★ **겨눌 때만 그린다** (허용 각의 ${SHOW_AT}배 안) — 늘 떠 있는 고리는`
    + ' 계기가 아니라 배경이다 (`ADI.showFrom` 과 같은 규약)');

  // ── ③ 십자선이 제일 작은 띠를 덮나 ──────────────────────────────
  console.log('');
  const bulls = Object.keys(KINDS).map((k) => radiusOf(TARGET.aimTol * (KINDS[k].size ?? 1) * RINGS[0].r, H));
  const lapped = Object.keys(KINDS).filter((k, i) => {
    const p = pipperAt(bulls[i]);
    return p.inner < bulls[i];      // 팔이 띠 안에서 시작하면 덮는다
  });
  console.log(`   정중앙 띠 ${Math.min(...bulls).toFixed(3)} ~ ${Math.max(...bulls).toFixed(3)}`
    + ` · 십자선은 그 밖 ${pipperAt(Math.min(...bulls)).inner.toFixed(3)}`
    + ` ~ ${pipperAt(Math.max(...bulls)).outer.toFixed(3)} 에 그린다 (판 높이 대비)`);
  console.log(`   표적이 없을 때 십자선 = ${PIPPER.gap} ~ ${(PIPPER.gap + PIPPER.len).toFixed(3)}`
    + ` (화면에서 ${(2 * px(PIPPER.gap + PIPPER.len)).toFixed(0)}화소)`);
  ok(!lapped.length,
    `★★★ **십자선이 어느 표적의 정중앙 띠도 안 덮는다** ${lapped.length ? `— ${lapped.join(',')}` : ''}`
    + ' — v120 까지 팔이 0.110 에 못박혀 작은 표적의 띠를 통째로 덮었다.'
    + ' 못박는 대신 **띠에 맞춰 벌어지게** 했다 (`pipperAt`)');
  ok(2 * px(PIPPER.gap + PIPPER.len) >= 20,
    `★★ **십자선이 화면에서 보인다** (${(2 * px(PIPPER.gap + PIPPER.len)).toFixed(0)}화소) —`
    + ' 「띠보다 작게」로 못박았으면 13화소가 되어 안 보였을 것이다');

  // ── ④ 판을 넘는 고리 ──────────────────────────────────────────
  const topRow = Math.min(...Object.values(ROWS).map((r) => spanOf(r).y0));
  ok(Math.abs(ringMax() - (topRow - 0.5)) < 1e-9 || ringMax() === 0.5 - SAFE.y0,
    `★★★ **고리의 끝을 숫자로 안 적었다** (${ringMax().toFixed(3)} = 제일 위 글줄 ${topRow.toFixed(3)}`
    + ' 까지) — 글줄을 옮기면 끝도 따라 옮겨진다. 손으로 적어 두면 한쪽만 고치게 된다');
  ok(ringMax() > 0.2,
    `★★ 그래도 웬만한 표적의 문은 그린다 (끝 ${ringMax().toFixed(3)}) — 큰 것(난파선·수송대)만`
    + ' 빠진다. 줄여 그리면 「보이는 고리와 맞는 각」이 갈라진다 (v98)');
  ok(MARKS.some(([n]) => n.includes('대각 네 토막')) && MARKS.some(([, w]) => w.includes('정중앙 띠')),
    '★★★ **새 표식이 목록에 들어갔다** — 모양을 바꾸고 뜻을 안 고치면 F1 도움말이 거짓말을 한다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
