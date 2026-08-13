// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **적의 기동 셋** — 뼈대만 (v137)
//
//    node tools/space-foe.js
//
//  ★ 사장님 (2026-08-13) 「실감나는 전투를 위해 무기와 **적의 기동 임펙트** …」
//
//  ★★★ 묻는 것 일곱 (`docs/space/FIGHT.md §6`)
//      ① **셋이 다 나오나** — 안 나오는 기동은 없는 기동이다
//      ② ★★★ **뒤를 물면 브레이크를 거나** — 가만있으면 그건 과녁이다
//      ③ ★★★ **꺾으면 느려지나** — 안 느려지면 **무한히 꺾는 적**이 되어 못 잡는다
//      ④ ★★ **놓으면 안 꺾나** — 늘 꺾으면 그건 기동이 아니라 습관이다
//      ⑤ ★★★ **못 떼면 되꺾어 마주보나** — 브레이크만이면 뒤만 쫓는 게임이다
//      ⑥ **체력이 낮으면 이탈하나** — 이미 있는 `FLEE` 와 뜻이 같아야 한다
//      ⑦ ★★ **쉬는 틈이 있나** — 없으면 쉼 없이 꺾어 사람이 못 읽는다
// ══════════════════════════════════════════════════════════════════════════
import {
  MOVES, MOVE_KEYS, FOE, makeFoe, stepFoe, foeWord, summary,
} from '../web/space/js/game/foe-table.js';
import { aspectOf, aspectWord } from '../web/space/js/game/aspect-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const DT = 1 / 60;
/** 몇 초 동안 돌린다 — 그 사이에 나온 기동을 다 모은다 */
const run = (f, secs, opt) => {
  const seen = [], tells = [];
  let slow = 1, miss = 1;
  for (let t = 0; t < secs; t += DT) {
    const r = stepFoe(f, DT, typeof opt === 'function' ? opt(t) : opt);
    if (r.move && !seen.includes(r.move)) seen.push(r.move);
    if (r.tell) tells.push(r.tell);
    slow = Math.min(slow, r.slow);
    miss = Math.min(miss, r.miss);
  }
  return { seen, tells, slow, miss };
};

console.log('적의 기동 셋 — 뼈대만 (게임을 안 부른다)');

console.log('\n[1] ★★ **셋이 다 나오나**');
{
  console.log('   기동      길이    선회    속도    언제');
  for (const k of MOVE_KEYS) {
    const m = MOVES[k];
    console.log(`   ${m.name.padEnd(6)}  ${m.secs}초   ${String(m.turn).padStart(3)}°/s  ×${m.slow}   ${m.when}`);
  }
  ok(MOVE_KEYS.length === 3,
    `★★★ **셋이다** (${MOVE_KEYS.length}) — 넷이 되면 사람이 「저 놈이 뭘 하려는지」를`
    + ' 못 읽고, 못 읽는 것은 아무리 정교해도 **대응할 수가 없다**');
  ok(MOVE_KEYS.every((k) => MOVES[k].tell && MOVES[k].what),
    '★★ 셋 다 **알리는 말과 까닭**을 갖는다 — 말없이 꺾으면 그건 무작위로 보인다');
}

console.log('\n[2] ★★★ **뒤를 물면 브레이크를 거나**');
{
  const f = makeFoe();
  const r = run(f, 3, { locked: true, hp01: 1 });
  console.log(`   3초 물고 있었다 — 나온 기동 ${r.seen.map((k) => MOVES[k].name).join(' · ') || '없음'}`);
  console.log(`   알린 말 — ${r.tells[0] ?? '없음'}`);
  ok(r.seen.includes('break'),
    `★★★ **브레이크가 들어온다** (${FOE.holdToBreak}초 물면) — v136 까지 적이 하는 일은`
    + ' `t.az += t.vaz*dt` 두 줄, 즉 **표류뿐**이었다. 내가 뒤를 잡든 마주보든'
    + ' 적이 하는 일이 똑같았고, 그건 전투가 아니라 **과녁 쏘기**다');
}

console.log('\n[3] ★★★ **꺾으면 느려지나** — 안 느려지면 무한히 꺾는 적이 된다');
{
  const f = makeFoe();
  const r = run(f, 3, { locked: true });
  console.log(`   브레이크 중 — 속도 ×${r.slow} · 명중률 ×${r.miss}`);
  ok(r.slow < 0.8,
    `★★★ **꺾는 동안 느려진다** (×${r.slow}) — EVE 의 각속도를 값 하나로 접은 것이다.`
    + ' 안 느려지면 「계속 꺾는 것이 답」이 되어 **영영 못 잡는다**');
  ok(r.miss > 0.3 && r.miss < 1,
    `★★★ **꺾는 동안 잘 안 맞는다 — 그래도 맞기는 한다** (×${r.miss}) — 0 으로 두면`
    + ' 브레이크가 **무적기**가 되고, 무적기가 있으면 나머지 설계가 다 죽는다');
}

console.log('\n[4] ★★ **놓으면 안 꺾나**');
{
  const f = makeFoe();
  const r = run(f, 4, { locked: false, hp01: 1 });
  console.log(`   4초 안 물었다 — 나온 기동 ${r.seen.length ? r.seen.join(' · ') : '없음'}`);
  ok(r.seen.length === 0,
    '★★★ **안 물면 안 꺾는다** — 늘 꺾으면 그건 기동이 아니라 습관이고, 습관은'
    + ' 사람이 대응할 것이 없다. **내가 한 일에 적이 답하는 것**이라야 기동이다');
  // ★ 물었다 놓으면 **셈이 0 으로 돌아가나**
  const g = makeFoe();
  run(g, 0.6, { locked: true });          // 문턱(0.8초)보다 짧게
  run(g, 0.6, { locked: false });         // 놓았다
  const r2 = run(g, 0.5, { locked: true });
  ok(!r2.seen.includes('break'),
    '★★ **놓으면 센 시간이 0 으로 돌아간다** — 안 그러면 「잠깐씩 여러 번」이'
    + ' 「오래 물기」와 같아져서, 붙어 있는 것이 값을 잃는다');
}

console.log('\n[5] ★★★ **못 떼면 되꺾어 마주보나**');
{
  const f = makeFoe();
  const r = run(f, 14, { locked: true, hp01: 1 });
  console.log(`   14초 내내 물고 있었다 — ${r.seen.map((k) => MOVES[k].name).join(' → ')}`);
  console.log(`   지금 어스펙트 ${summary(f).aspect}° (${summary(f).zone})`);
  ok(r.seen.includes('reverse'),
    `★★★ **되꺾기가 들어온다** (브레이크 ${FOE.breaksToReverse}번 실패하면) — 브레이크만`
    + ' 있으면 「뒤만 쫓는 게임」이 되고, 그러면 어스펙트 셋 중 **정면이 죽는다**');
  ok(aspectOf(summary(f).aspect) !== 'rear',
    `★★★ **되꺾으면 뒤가 아니게 된다** (지금 ${aspectWord(summary(f).aspect)}) —`
    + ' 기동이 어스펙트를 정말 바꿔야 「뒤를 잡는 30초」에 값이 생긴다');
}

console.log('\n[6] ★★ **체력이 낮으면 이탈하나**');
{
  const f = makeFoe();
  const r = run(f, 3, { locked: true, hp01: 0.2 });
  console.log(`   체력 20% — ${r.seen.map((k) => MOVES[k].name).join(' · ')} · ${r.tells[0] ?? ''}`);
  ok(r.seen[0] === 'extend',
    '★★★ **이탈이 제일 먼저다** — 죽을 판이면 꺾는 것보다 **사는 것**이 먼저다.'
    + ' 순서가 곧 뜻이라, 여기서 뒤집히면 적이 죽어 가며 춤을 춘다');
  const g = makeFoe();
  const r2 = run(g, 3, { locked: true, hp01: 1, dead: true });
  ok(r2.seen[0] === 'extend',
    '★★ **부위가 깨져도 이탈한다** — 이미 있는 `FLEE`(v86)와 뜻이 같아야 한다.'
    + ' 두 계통이 다른 때에 도망가면 그건 도망이 둘인 것이다');
  console.log(`   이탈 뒤 어스펙트 ${summary(g).aspect}° (${summary(g).zone}) — 등을 보인다`);
  ok(aspectOf(summary(g).aspect) === 'rear',
    '★★★ **이탈하면 등을 보인다** — 그래서 쫓으면 ×1.45 다. 「쫓을지 놓을지」가'
    + ' 결심이 되는 까닭이고, 놓아 주면 회차 시계가 그만큼 돈다');
}

console.log('\n[7] ★★ **쉬는 틈이 있나**');
{
  const f = makeFoe();
  let moving = 0, total = 0;
  for (let t = 0; t < 20; t += DT) {
    const r = stepFoe(f, DT, { locked: true, hp01: 1 });
    if (r.move) moving += DT;
    total += DT;
  }
  const k = moving / total;
  console.log(`   20초 중 ${(k * 100).toFixed(0)}% 를 기동했다`);
  ok(k < 0.85,
    `★★★ **쉬는 틈이 있다** (${(k * 100).toFixed(0)}%) — 쉼 없이 꺾으면 사람이 못 읽고,`
    + ' 못 읽는 기동은 무작위와 구별되지 않는다. `FOE.rest` 가 그 틈이다');
  ok(k > 0.4,
    `★★ 그래도 **대체로 움직인다** (${(k * 100).toFixed(0)}%) — 너무 쉬면 다시 과녁이다`);
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
