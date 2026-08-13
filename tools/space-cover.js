// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **가림 — 앞에 뭐가 있으면** — 뼈대만 (v142). 기획은 `docs/space/COVER.md`.
//
//    node tools/space-cover.js
//
//  ★ 사장님 (2026-08-13) 「**락온 했는데 앞에 장애물이 있으면 어떻게 되지?**」
//
//  ★★★ 묻는 것 일곱
//      ① **가리나** — 뒤에 있는 표적이 정말 가려지나
//      ② ★★★ **앞에 있는 것만 가리나** — 표적보다 먼 것은 안 가려야 한다
//      ③ **작은 것은 덜 가리나** — 파편 3m 와 표류선 16m 가 같으면 크기가 뜻이 없다
//      ④ ★★★ **무기 셋이 다르게 막히나** — 다 막히면 「숨으면 무적」이다
//      ⑤ **락온이 버티다 풀리나** — 즉시 풀리면 운이고, 안 풀리면 가림이 뜻이 없다
//      ⑥ ★★ **반쯤 가림이 있나** — 있고 없고 둘뿐이면 가장자리로 쏠 이유가 없다
//      ⑦ ★★★ **적도 쓰나** — 나만 쓰면 그건 규칙이 아니라 편의다
//
//  ★ 게임을 안 부른다 — `three` 없이 1초에 돈다
// ══════════════════════════════════════════════════════════════════════════
import {
  COVER, BLOCKERS, coverOf, throughCover, holdLock,
  isHidden, isGrazed, coverWord, hideBehind, HIDE,
} from '../web/space/js/game/cover-table.js';
import { lenOf } from '../web/space/js/game/target-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

/** 표적 하나 · 가림막 하나를 세운다 (각은 도) */
const foe = (dist = 120, az = 0, el = 0) => ({ id: 'foe', kind: 'raider', az, el, dist });
const blk = (kind, dist, az = 0, el = 0) => ({ id: `b_${kind}`, kind, az, el, dist });

/** 각지름 절반 (도) — 도구가 제 손으로 재는 유일한 곳. 표와 같은 식이다 */
const halfDeg = (kind, dist) => Math.atan((lenOf(kind) / 2) / dist) * 180 / Math.PI;

console.log('가림 — 앞에 뭐가 있으면 (게임을 안 부른다)');

console.log('\n[1] ★★★ **가리나**');
{
  const t = foe(120);
  const c = coverOf(t, [t, blk('hulk', 60)]);
  console.log(`   표류선 60m 뒤의 침입선 120m — 가림 ${c.k} · ${coverWord(c, { hulk: '표류선' })}`);
  ok(isHidden(c),
    '★★★ **표적 앞의 표류선이 표적을 가린다** — v141 까지 「사이에 뭐가 있나」를'
    + ' 묻는 줄이 **한 곳도 없었다.** 파편 뒤에 숨은 적도 그냥 맞았고, 레이저가'
    + ' 바위를 통과했다. 즉 **「숨는다」가 이 게임에 없었다**');
  const none = coverOf(t, [t, blk('hulk', 60, 40)]);
  console.log(`   같은 표류선을 40도 옆에 두면 — 가림 ${none.k}`);
  ok(none.k === 0,
    '★ **옆에 있는 것은 안 가린다** — 「하늘에 뭐가 있나」가 아니라'
    + ' **「표적과 나 사이에 있나」**를 묻는다');
  ok(BLOCKERS.length >= 4 && !BLOCKERS.some((k) => ['raider', 'drone', 'convoy', 'gunship'].includes(k)),
    `★★★ **가리는 것은 안 움직이는 것뿐이다** (${BLOCKERS.join(' · ')}) — 적끼리 가리기`
    + ' 시작하면 「누가 누구를 가렸나」가 **매 프레임 바뀌어서** 사람이 못 읽는다');
}

console.log('\n[2] ★★★ **앞에 있는 것만 가리나**');
{
  const t = foe(120);
  const front = coverOf(t, [t, blk('hulk', 60)]);
  const behind = coverOf(t, [t, blk('hulk', 200)]);
  console.log(`   표류선이 앞(60m) — ${front.k} · 뒤(200m) — ${behind.k}`);
  ok(front.k > 0 && behind.k === 0,
    '★★★ **표적보다 먼 것은 안 가린다** — 각만 보고 거리를 안 보면'
    + ' **표적 뒤의 바위가 표적을 가리는** 우스운 일이 난다. 각으로 재는'
    + ' 방식(3D 광선을 안 쏘는 것)이 꼭 같이 챙겨야 하는 한 줄이다');
  const just = coverOf(t, [t, blk('hulk', 119)]);
  ok(just.k > 0,
    '★ 표적 **바로 앞**(119m)은 가린다 — 문턱이 「훨씬 가까울 것」이 아니라'
    + ' 「가까울 것」이다');
}

console.log('\n[3] ★★ **작은 것은 덜 가리나**');
{
  console.log('   가림막      길이    60m 에서 각반지름   3도 옆의 표적을');
  const wide = [];
  for (const k of BLOCKERS) {
    const h = halfDeg(k, 60);
    const c = coverOf(foe(120, 3), [blk(k, 60)]);
    wide.push({ k, h, cov: c.k });
    console.log(`   ${k.padEnd(6)}  ${String(lenOf(k)).padStart(5)}m  ${h.toFixed(2).padStart(7)}°`
      + `           ${c.k > 0 ? `가린다 ${c.k}` : '못 가린다'}`);
  }
  const hulk = wide.find((w) => w.k === 'hulk');
  const junk = wide.find((w) => w.k === 'junk');
  ok(hulk.cov > 0 && junk.cov === 0,
    '★★★ **표류선(16m)은 3도 옆까지 가리고 파편(3m)은 못 가린다** — 같으면'
    + ' 크기가 뜻이 없고, 그러면 「어디 뒤에 숨나」가 **아무 데나**가 된다');
  ok(halfDeg('hulk', 60) > halfDeg('junk', 60) * 3,
    `★★ 표류선의 그늘이 파편의 ${(halfDeg('hulk', 60) / halfDeg('junk', 60)).toFixed(1)}배다 —`
    + ' 그래서 **제일 좋은 엄폐물**이라는 말이 성립한다');
  const near = coverOf(foe(120, 3), [blk('junk', 20)]);
  console.log(`   같은 파편이라도 20m 까지 붙으면 3도 옆의 표적을 — ${near.k > 0 ? `가린다 ${near.k}` : '못 가린다'}`);
  ok(near.k > 0,
    '★★ **가까울수록 크게 가린다** — 각으로 재니 저절로 나온다.'
    + ' 미터로 「반경 몇 m 안」이라고 적었으면 이게 안 나온다');
}

console.log('\n[4] ★★★ **무기 셋이 다르게 막히나**');
{
  const t = foe(120);
  const c = coverOf(t, [t, blk('hulk', 60)]);
  console.log('   무기      막히나   명중배수  느려짐');
  const got = {};
  for (const w of ['laser', 'ir', 'arh']) {
    const r = throughCover(w, c);
    got[w] = r;
    console.log(`   ${w.padEnd(6)}  ${r.blocked ? '막힌다' : '나간다'}    ${r.hitMult.toFixed(2)}     ${r.slow ? `+${(r.slow * 100).toFixed(0)}%` : '—'}`);
  }
  ok(got.laser.blocked && got.ir.blocked,
    '★★ **레이저와 열추적탄은 막힌다** — 하나는 직진하는 빛이고 하나는 눈이 없다.'
    + ' 둘 다 「보이는 것」이 없으면 못 간다');
  ok(!got.arh.blocked && got.arh.slow > 0,
    `★★★ **유도탄은 돌아간다 — 대신 +${(got.arh.slow * 100).toFixed(0)}% 느리다.**`
    + ' 셋이 다 막히면 **「숨으면 무적」**이 되고, 그건 전투가 아니라 숨바꼭질이다.'
    + ' 돌아가는 길이 있어야 **숨은 적을 꺼내는 값**이 생기고, 그 값이'
    + ' 「어느 무기를 쏘나」에 이유를 하나 더 얹는다');
  const open = throughCover('laser', { by: null, k: 0 });
  ok(!open.blocked && open.hitMult === 1,
    '★ **안 가려진 표적은 아무것도 안 달라진다** — 가림이 없을 때 값이 새면'
    + ' 지금까지의 저울(v137 어스펙트 · v114 조준 띠)이 통째로 흔들린다');
}

console.log('\n[5] ★★ **락온이 버티다 풀리나**');
{
  console.log('   가려진 채   남은 시간   락온');
  for (const s of [0, 1.0, 2.4, 2.6, 4.0]) {
    const h = holdLock(s);
    console.log(`   ${s.toFixed(1)}초       ${h.left.toFixed(1)}초       ${h.lost ? '★ 놓쳤다' : '붙어 있다'}`);
  }
  ok(!holdLock(0.4).lost,
    '★★★ **잠깐 걸린 것으로는 안 풀린다** — 파편 하나가 스쳐 지나갈 때마다'
    + ' 락온이 끊기면 그건 전투가 아니라 **운**이다');
  ok(holdLock(COVER.hold + 0.1).lost,
    `★★★ **${COVER.hold}초를 넘으면 풀린다** — 안 풀리면 숨어도 소용이 없고,`
    + ' 그러면 가림을 만든 것이 **화면 장식**으로 끝난다');
  ok(COVER.hold >= 1.5 && COVER.hold <= 4,
    `★★ ${COVER.hold}초는 「일부러 숨은 것」과 「지나가는 것에 걸린 것」을 가르는 값이다`);
  ok(holdLock(1).left > 0 && holdLock(1).left < COVER.hold,
    '★ **남은 초를 세어 준다** — 계기가 「가려졌습니다 — 2초」라고 말할 수 있어야'
    + ' 사람이 **돌아 들어갈지 기다릴지**를 정한다');
}

console.log('\n[6] ★★ **반쯤 가림이 있나**');
{
  const h = halfDeg('hulk', 60);
  console.log(`   표류선 60m — 각반지름 ${h.toFixed(2)}° · 완전 가림은 안쪽 ${(h * COVER.full).toFixed(2)}° 까지`);
  console.log('   비낀 각   가림    무엇이라 부르나        레이저는');
  let sawGraze = false;
  for (const off of [0, 2, 4, 6, 7, 8]) {
    const t = foe(120, off);
    const c = coverOf(t, [t, blk('hulk', 60)]);
    const r = throughCover('laser', c);
    if (isGrazed(c)) sawGraze = true;
    const word = isHidden(c) ? '다 가림' : isGrazed(c) ? '반쯤 가림' : '안 가림';
    console.log(`   ${String(off).padStart(4)}°   ${c.k.toFixed(2)}   ${word.padEnd(12)}   `
      + `${r.blocked ? '막힌다' : `나간다 (명중 ×${r.hitMult.toFixed(2)})`}`);
  }
  ok(sawGraze,
    '★★★ **가장자리에는 반쯤 가림이 있다** — 있고 없고 둘뿐이면'
    + ' **가장자리로 쏠 이유가 없고**, 그러면 사람은 가림막을 「벽」으로만 읽는다');
  const gz = coverOf(foe(120, 6), [blk('hulk', 60)]);
  const gr = throughCover('laser', gz);
  ok(!gr.blocked && gr.hitMult === COVER.grazeHit,
    `★★★ **반쯤 가려지면 막히지는 않되 잘 안 맞는다** (×${COVER.grazeHit}) —`
    + ' 「가장자리로 쏜다」가 **되기는 하되 손해**여야 결심이 된다');
  ok(coverWord(gz, { hulk: '표류선' }).includes('반쯤'),
    '★★ **화면도 「반쯤」이라고 말한다** — 판정이 셋(안 가림·반쯤·다 가림)인데'
    + ' 말이 둘이면 **말과 판정이 갈라진다** (v141 에 그걸로 한 번 뎄다)');
}

console.log('\n[7] ★★★ **적도 쓰나** — 가림이 나만 쓰는 것이면 규칙이 아니라 편의다');
{
  const t = foe(140, 20);
  const sky = [t, blk('hulk', 90, 8), blk('junk', 70, 22), blk('ice', 120, 95)];
  const pick = hideBehind(t, sky);
  console.log(`   숨을 곳 후보 셋 — 고른 것: ${pick?.kind ?? '없음'}`);
  ok(pick?.kind === 'hulk',
    '★★★ **큰 것을 고른다** — 코앞의 파편(2도 옆)보다 조금 떨어진 표류선(12도 옆)이'
    + ' 낫다. 각지름에서 「가는 품」을 빼서 고르므로 저절로 나온다');
  ok(hideBehind(t, [t, blk('ice', 120, 95)]) === null,
    `★★ **너무 멀리 있는 것은 안 고른다** (${HIDE.look}도 밖) — 하늘 반대편까지 가는 것은`
    + ' 숨는 것이 아니라 **도망**이고, 그건 이미 v138 이 하는 일이다');
  ok(hideBehind(t, [t, blk('hulk', 200, 8)]) === null,
    '★ **제 뒤에 있는 것 뒤로는 못 숨는다** — 가림과 **같은 자**로 재니 저절로 맞는다');
  //  ★ 숨은 뒤 저쪽도 못 쏜다 — 규칙은 `target.js` 가 이 표에게 묻는다.
  //    여기서는 「물을 것이 있나」까지만 본다 (게임은 종단 검사가 잰다)
  const hid = coverOf(foe(140, 8), [blk('hulk', 90, 8)]);
  ok(isHidden(hid),
    '★★★ **숨으면 저쪽도 나를 못 쏜다** — 같은 판정 하나를 양쪽이 쓴다.'
    + ' 내가 못 쏘는 동안 저쪽만 쏠 수 있으면 숨은 적은 **공짜로 이긴다**');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
