// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **광학 창 · 전투력** — 보고 정하나 (v79)
//
//  ★ 사장님 (2026-08-09):
//    「멀리있는 적을 레이더 말고 **확대**하거나 그럴 방법은 없어?」
//    「**격추시 적 기체가 부서지는 화면**도 보여주고 … **3D 모습**으로」
//    「적을 **거리에 맞게 자동 확대** … 스크린에는 **거리가 표시**」
//    「**무한정 확대는 아니고 미사일이나 탄두에 따라** 그 확대가 결정됨」
//    「**상대 우주선의 전투력**도 표시되고 **우리 비행기의 전투력 차이**」
//    「**우주쓰레기면 필요한 재료나 음식이 있는지**」
//    「격추할때마다 **적의 무기나 장갑을 회수**하면서 나도 전투력이 올라가게」
//
//  ★★ **표와 규칙만 잰다** (브라우저 없이). 화면에 정말 뜨는지는
//    `space-endtoend.js` 의 절과 스크린샷이 본다 — 이 저장소는 「검사는
//    다 ✔ 인데 사람은 거기까지 못 간다」를 네 번 겪었다.
//
//  돌리기:  node tools/space-optic.js
// ══════════════════════════════════════════════════════════════════════════
import {
  OPTIC, fovOf, capOf, autoZoom, pixelsOf, blurOf, readable, readOut, sizeOf,
} from '../web/space/js/game/optic-table.js';
import {
  mightOf, packMight, myMight, oddsOf, MINE, threatOf,
} from '../web/space/js/game/might-table.js';
import { KINDS, WRECK, SEEN } from '../web/space/js/game/target-table.js';
import { WEAPONS } from '../web/space/js/game/combat-table.js';
// ★★★ v110 — 전투력이 **부위 장착**으로 바뀌었다 (v107 「가」)
import { makeFit, mightOf as fitMight, gainPart, equip } from '../web/space/js/game/parts.js';
import { BASE_MIGHT } from '../web/space/js/game/parts-table.js';
import { partOf } from '../web/space/js/game/farm-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const head = (t) => console.log(`\n${t}`);

// ══ ① 맨눈으로 안 보이던 것이 판에서는 보이나 ═════════════════════════
head('[1] 맨눈으로 못 읽던 것이 판에서는 읽히나  (존슨: 식별 13px · 모양 40px)');
{
  // 맨눈 — 조종 중 화각 94도 세로, 1080 화면
  const eyePx = (kind, d) =>
    2 * Math.atan(sizeOf(kind) / 2 / d) * 180 / Math.PI * (1080 / 94);
  for (const [kind, d] of [['fighter', 140], ['fighter', 220], ['drone', 140]]) {
    const eye = eyePx(kind, d);
    const zArh = autoZoom(kind, d, 'arh');
    const px = pixelsOf(kind, d, zArh);
    console.log(`      ${KINDS[kind].name} ${d}m — 맨눈 ${eye.toFixed(0)}px → 광학 ${zArh}배 ${px}px`);
    ok(eye < 13 && px >= 13, `${KINDS[kind].name} ${d}m — 맨눈으로 식별 불가, 광학으로는 가능`);
  }
}

// ══ ② 무한정이 아닌가 · 무기가 정하나 ════════════════════════════════
head('[2] 무한정 확대가 아닌가 — **무기가 한도를 정한다**');
{
  const caps = ['laser', 'ir', 'arh'].map((k) => [k, capOf(k)]);
  console.log('      ' + caps.map(([k, c]) => `${WEAPONS[k].name} ${WEAPONS[k].rMax}m → ${c}배`).join(' · '));
  ok(caps.every(([, c]) => c <= OPTIC.capMax), `천장이 있다 (최대 ${OPTIC.capMax}배)`);
  const [l, i, a] = caps.map(([, c]) => c);
  ok(l < i && i < a, '사거리가 긴 무기일수록 더 당긴다 — 한도가 사거리에서 나온다');
  ok(autoZoom('fighter', 300, 'laser') <= l, '레이저로는 멀어도 한도를 못 넘는다');
  ok(autoZoom('fighter', 300, 'arh') > l, '같은 표적이라도 유도탄이면 더 당긴다');
}

// ══ ③ 저절로 맞나 (거리에 따라) ══════════════════════════════════════
head('[3] 거리에 맞게 **저절로** 당기나');
{
  const near = autoZoom('fighter', 35, 'arh');
  const far = autoZoom('fighter', 200, 'arh');
  console.log(`      요격기 35m → ${near}배 · 200m → ${far}배`);
  ok(near < far, '가까우면 덜 당기고 멀면 더 당긴다');
  ok(near >= 1, '1배 아래로는 안 내려간다 (창밖보다 작아지면 뜻이 없다)');
  // 보이는 크기가 거리와 상관없이 비슷해야 「자동」이다
  const a = pixelsOf('fighter', 35, near), b = pixelsOf('fighter', 200, far);
  ok(Math.abs(a - b) / Math.max(a, b) < 0.55, `보이는 크기가 거리에 덜 휘둘린다 (${a}px vs ${b}px)`);
}

// ══ ④ 공짜가 아닌가 — 떨림 ═══════════════════════════════════════════
head('[4] 늘 최대로 당겨 놓는 것이 답이 아닌가 — **떨림**');
{
  ok(readable(1, 0.9), '1배로는 밀면서도 읽힌다');
  ok(!readable(11, 0.4), '11배로는 조금만 밀어도 못 읽는다');
  ok(blurOf(11, 0.2) > blurOf(4, 0.2), '같은 조작이면 높은 배율이 더 흐리다');
  ok(readable(11, 0), '멈춰 서면 높은 배율도 읽힌다 — 「붙기 전에 보고 정한다」');
}

// ══ ⑤ 전투력 — 견줌이 성립하나 ══════════════════════════════════════
head('[5] 전투력 — 「강하면 피하고 약하면 부순다」가 성립하나');
{
  const start = myMight({ weapons: ['laser'], hull: 1 });
  const full = myMight({ weapons: ['laser', 'ir', 'arh'], hull: 1 });
  const hurt = myMight({ weapons: ['laser', 'ir', 'arh'], hull: 0.4 });
  console.log(`      내 전투력 — 처음 ${start} · 무기 셋 ${full} · 선체 40%면 ${hurt}`);
  ok(full > start, '무기를 갖추면 오른다');
  ok(hurt < full, '**선체가 깎이면 내려간다** — 피해가 다음 판단을 바꾼다');

  const words = ['drone', 'raider', 'gunship', 'fighter'].map((k) => [k, oddsOf(start, mightOf(k)).word]);
  console.log('      처음 상태에서 — ' + words.map(([k, w]) => `${KINDS[k].name} ${w}`).join(' · '));
  ok(words.some(([, w]) => w === '절망' || w === '열세'), '처음에는 **못 이기는 상대가 있다** — 피할 이유가 생긴다');
  ok(words.some(([, w]) => w === '우세' || w === '호각'), '처음에도 **붙어 볼 상대가 있다** — 늘 도망만 치지 않는다');

  // 떼와 하나가 다르게 나오나
  ok(packMight('fighter') > mightOf('fighter'), '요격기 **떼**가 한 대보다 세다');
  ok(threatOf([{ kind: 'fighter' }, { kind: 'fighter' }, { kind: 'fighter' }]) > mightOf('fighter'),
    '셋이 떠 있으면 위협이 한 대보다 크다');
  ok(threatOf([{ kind: 'fighter' }, { kind: 'fighter' }, { kind: 'fighter' }]) < mightOf('fighter') * 3,
    '그러나 **세 배는 아니다** — 하나씩 떼어 잡을 수 있다');
}

// ══ ⑥ 파밍 — 격추가 나를 키우나 (v110 에 다시 씀) ═══════════════════
head('[6] 격추할 때마다 **회수해서 전투력이 오르나**');
{
  // ══ ★★★ v110 — **이 절이 죽은 식을 재고 있었다** ═══════════════════
  //
  //  전에는 `lootOf` 로 노획 개수를 쌓고 `myMight` 이 그 거듭제곱을 더하는
  //  것을 쟀다. v107 이 전투력을 **부위 장착**으로 갈아엎었고 v110 이 옛
  //  식을 걷어냈으므로, 그 검사는 **이제 없는 것을 재는 검사**다.
  //  ★ 오르는지는 그대로 묻되, **지금 오르는 방식**으로 묻는다
  const f = makeFit();
  const was = fitMight(f);
  const seq = [];
  let last = was;
  for (let i = 1; i <= 25; i++) {
    const kind = i % 3 === 0 ? 'gunship' : 'raider';
    const p = partOf(kind, 0.0, ((i * 37) % 100) / 100, ((i * 53) % 100) / 100);
    if (p) { gainPart(f, p.slot, p.tier); equip(f, p.slot, 0); }
    const now = fitMight(f);
    seq.push(now - last);
    last = now;
  }
  console.log(`      25대 잡는 동안 — ${was} → ${last} (${(last / was).toFixed(2)}배)`);
  ok(last > was, '★★★ **격추가 쌓이면 전투력이 오른다** — 개수가 아니라 **달린 등급**으로');
  ok(last <= BASE_MIGHT * 2.05 + 0.01,
    `★ 천장이 있다 — 다 「격추왕의 것」이라도 ${(BASE_MIGHT * 2.05).toFixed(1)} 이다`);
  // ★ 부위마다 무게가 달라 **같은 등급이라도 어디에 붙었나로 값이 다르다**
  ok(seq.some((d) => d > 0) && seq.some((d) => d === 0),
    '★★ 오르기만 하는 게 아니라 **안 오르는 격추도 있다** — 파츠가 안 나오거나'
    + ' 이미 더 좋은 것이 달려 있으면 그렇다. 늘 오르면 그건 경험치지 파밍이 아니다');
}

// ══ ⑦ 판이 무엇을 말하나 — 적/쓰레기가 다른 것을 말하나 ═══════════════
head('[7] 판이 **나에게 무엇인가**를 말하나 (적 · 쓰레기 · 행성)');
{
  const foe = readOut('gunship');
  const junk = readOut('tank');
  ok(foe.foe && foe.might > 0, '적이면 **전투력**을 말한다');
  ok(foe.slots && foe.slots.length > 0,
    `★★ 적이면 **뜯을 부위**를 말한다 (${(readOut('gunship').slots ?? []).join(' · ')}) —`
    + ' v110 전에는 「무기 +3 · 장갑 +10」이었고, 그 숫자는 아무 데도 안 붙었다');
  ok(!junk.foe && junk.has.length > 0, '쓰레기면 **든 것**을 말한다 (식량·광석·부품)');
  console.log(`      ${junk.name} — ${junk.has.join(' · ')}`);
  ok(junk.has.some((t) => t.includes('식량')), '연료통에 식량이 있다고 말한다 — 사장님 「필요한 재료나 음식이 있는지」');
  ok(readOut('없는것') === null, '모르는 것에는 아무 말도 안 만든다');
}

// ══ ⑧ 잔해 — 격추가 **보이나** ═══════════════════════════════════════
head('[8] 격추가 한 프레임이 아닌가 — **부서지는 동안이 있나**');
{
  ok(WRECK.small > 1.5 && WRECK.big > WRECK.small, `잔해가 남는다 (작은 것 ${WRECK.small}초 · 큰 것 ${WRECK.big}초)`);
  ok(WRECK.small >= OPTIC.replay, '★ 잔해가 **되감기보다 오래 남는다** — 안 그러면 판이 빈 우주를 비추며 「격추」라고 적는다');
  ok(WRECK.again > 0 && WRECK.again < WRECK.small, '두 번째 폭발이 조금 늦게 온다 — 「터졌다」가 순간이 아니게');
  ok(WRECK.spin > 0 && WRECK.push > 0, '제어를 잃고 돌면서 밀려난다');
  ok(OPTIC.killZoom < capOf('arh'), '되감기 배율이 낮다 — 폭발 한가운데를 당기면 하얀 덩어리만 남는다');
}

// ══ ⑨ 표가 어긋나지 않았나 ═══════════════════════════════════════════
head('[9] 표끼리 안 갈라졌나');
{
  ok(Math.abs(fovOf(1) - OPTIC.h * 94 / 1080) < 0.01, '1배의 화각이 정의대로다 (맨눈과 같은 크기)');
  ok(fovOf(4) < fovOf(1) && fovOf(11) < fovOf(4), '배율이 오르면 화각이 준다');
  for (const k of Object.keys(KINDS)) {
    if (readOut(k) === null) { ok(false, `${k} 를 판이 못 읽는다`); }
  }
  ok(true, `표적 ${Object.keys(KINDS).length}종을 판이 다 읽는다`);
  ok(SEEN.minDeg > 0, '각지름 바닥이 있다 (v79 ① — 멀어도 점이 안 된다)');
  ok(OPTIC.reach > 0, `광학이 닿는 거리 ${OPTIC.reach}m`);
}

console.log(bad ? `\n✘ ${bad} 개가 안 맞습니다` : '\n✔ 전부 맞습니다');
process.exit(bad ? 1 : 0);
