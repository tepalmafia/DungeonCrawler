// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **회수** — 부순 것과 얻는 것 사이에 일이 하나 있나 (v81)
//
//  ★ 사장님 (2026-08-09 · 한 회차의 흐름):
//    「파괴하고 **적의 지원이 오기전에** 파괴된 적기의 무기나 텔레포트
//     아크에너지, 핵탄두 재료 등을 **회수**하고」
//    「우주쓰레기 중 필요한 것들을 **조종석에서 그물이나 기타 회수 장비를
//     쏘아 회수**해서 보충하는 것」
//
//  ★★ 여기서 묻는 것은 「주울 수 있나」가 아니라 **넷**이다:
//      ① **공짜가 아닌가** — 부수면 저절로 들어오면 고를 것이 없다
//      ② **시계가 도나** — 「지원이 오기 전에」가 규칙으로 있나
//      ③ **줍는 것이 값이 있나** — 감는 동안 못 도망치나
//      ④ **다 못 줍나** — 다 주울 수 있으면 그건 청소이지 선택이 아니다
//
//  돌리기:  node tools/space-salvage.js
// ══════════════════════════════════════════════════════════════════════════
import {
  NET, PACK, CALL, callIn, packOf, packWord, inReach, reelTime,
} from '../web/space/js/game/salvage-table.js';
import {
  makeSalvage, dropPack, stepSalvage, fireNet, aimedPack,
  reeling, thrustHeld, callWarn, summary,
} from '../web/space/js/game/salvage.js';
import { KINDS, TARGET } from '../web/space/js/game/target-table.js';
import { mightOf } from '../web/space/js/game/might-table.js';
import { LEG } from '../web/space/js/game/route-table.js';
import { WINCH } from '../web/space/js/game/supply-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const head = (t) => console.log(`\n${t}`);
const DT = 1 / 30;
const run = (s, sec, opt = {}) => {
  const out = { faded: [], landed: null, called: false };
  for (let t = 0; t < sec; t += DT) {
    const e = stepSalvage(s, DT, opt);
    out.faded.push(...e.faded);
    if (e.landed) out.landed = e.landed;
    if (e.called) out.called = true;
  }
  return out;
};

// ══ ① 공짜가 아닌가 ═══════════════════════════════════════════════════
head('[1] 부수면 **저절로 들어오지 않는다** — 꾸러미가 남는다');
{
  const s = makeSalvage();
  const p = dropPack(s, { kind: 'raider', az: 0, el: 0, dist: 60 }, null);
  ok(!!p, '부수면 그 자리에 꾸러미가 남는다');
  ok(s.packs.length === 1, '떠 있다 — 아직 내 것이 아니다');
  const has = packOf('raider');
  // ★★ v110 — 여기서 「노획 무기·장갑이 꾸러미에 들었나」를 물었다.
  //   그 둘은 v107 에 전투력에서 빠지고 v110 에 물건까지 걷어냈다.
  //   이제 **부위 파츠**가 그 자리다 (`p.fitPart` · `farm-table.js`)
  ok('fitPart' in p, '★★★ 꾸러미에 **부위 파츠 자리**가 있다 — 격추가 아니라 **회수**해야 들어온다');
  // ★ v83 — 꾸러미가 **덩어리에서 아이템으로** 바뀌었다. 광석 30 이
  //   「광석 ×3」이 된다 (한 덩이 10). 덩어리는 고를 것을 안 만든다
  ok((has.ore ?? 0) > 0, '보급도 같은 꾸러미에 들어 있다 — 셋으로 흩어져 있던 것을 묶었다');
  ok((has.spare ?? 0) > 0,
    '★ **정비 부품**이 들어 있다 (v110 에 교체 유닛·밀봉재·배선 셋을 하나로 합쳤다)');
  console.log(`      적 우주선 꾸러미 — ${packWord(has, null)}`);
  ok(s.got === 0, '아직 하나도 안 얻었다');
}

// ══ ② 시계가 도나 ════════════════════════════════════════════════════
head('[2] ★★ **지원이 오기 전에** — 시계가 정말 도나');
{
  const s = makeSalvage();
  dropPack(s, { kind: 'raider', az: 0, el: 0, dist: 60 }, null);
  ok(s.call > 0, `부수면 지원이 호출된다 (${s.call.toFixed(0)}초)`);
  const before = s.call;
  run(s, 5);
  ok(s.call < before, '시간이 가면 다가온다');
  const e = run(s, 60);
  ok(e.called, '내버려 두면 **온다**');

  // 센 것을 부술수록 빨리 온다
  const rows = ['drone', 'fighter', 'raider', 'turret', 'gunship']
    .map((k) => [KINDS[k].name, mightOf(k), callIn(k)]);
  console.log('      ' + rows.map(([n, m, c]) => `${n} ${c.toFixed(0)}초`).join(' · '));
  ok(callIn('gunship') < callIn('fighter'),
    '★ **센 것을 부술수록 빨리 온다** — 큰 것이 죽으면 크게 티가 난다');
  ok(callIn('gunship') >= CALL.min, `아무리 세도 ${CALL.min}초보다 빨리는 안 온다`);
  ok(callWarn({ call: CALL.warn - 1 }), '곧 오면 경보가 뜬다');
}

// ══ ③ 그물 — 값이 있나 ═══════════════════════════════════════════════
head('[3] ★★ 그물 — **줍는 것이 값이 있나**');
{
  const s = makeSalvage();
  dropPack(s, { kind: 'raider', az: 0, el: 0, dist: 60 }, null);
  ok(!fireNet(s, { az: 0, el: 0, seated: false }).ok, '서 있으면 못 쏜다 — 조종석 물건이다');
  const far = makeSalvage();
  dropPack(far, { kind: 'raider', az: 0, el: 0, dist: NET.reach + 30 }, null);
  ok(fireNet(far, { az: 0, el: 0 }).why === 'far', `${NET.reach}m 밖이면 「너무 멉니다」 — 다가가야 한다`);
  ok(fireNet(s, { az: 40, el: 0 }).why === 'none', '엉뚱한 데를 보면 안 걸린다');

  const r = fireNet(s, { az: 0, el: 0 });
  ok(r.ok, '겨누고 쏘면 걸린다');
  ok(!fireNet(s, { az: 0, el: 0 }).ok, '한 번에 하나만 — 두 개를 못 감는다');

  // ★★ 감는 동안 못 나아간다
  run(s, 0.6);
  ok(reeling(s), '곧 감기 시작한다');
  ok(thrustHeld(s), '★★ **감는 동안 추진이 묶인다** — 주우려면 도망칠 수 없다');

  const e = run(s, 12);
  ok(!!e.landed, '끝까지 감으면 들어온다');
  ok(s.got === 1 && s.packs.length === 0, '꾸러미가 하나 줄고 회수가 하나 는다');
  ok(!thrustHeld(s), '다 감으면 다시 나아갈 수 있다');
  console.log(`      60m 를 감는 데 ${reelTime(60)}초 · ${NET.reach}m 면 ${reelTime(NET.reach)}초`);
}

// ══ ④ 다 못 줍나 ═════════════════════════════════════════════════════
head('[4] ★★★ **다 주울 수는 없다** — 그래야 고르는 것이 된다');
{
  // 포함을 부수고 시작한다 (지원이 제일 빨리 온다)
  const s = makeSalvage();
  for (let i = 0; i < 4; i++) {
    dropPack(s, { kind: 'gunship', az: i * 12 - 18, el: 0, dist: 55 + i * 8 }, null);
  }
  const budget = s.call;
  console.log(`      포함 넷을 부쉈다 — 지원까지 ${budget.toFixed(0)}초`);
  let got = 0;
  for (let t = 0; t < budget; ) {
    const p = s.packs[0];
    if (!p) break;
    const f = fireNet(s, { az: p.az, el: p.el });
    if (!f.ok) { run(s, 0.5); t += 0.5; continue; }
    const need = p.dist / NET.outSpeed + reelTime(p.dist) + NET.cool + 0.2;
    run(s, need); t += need;
    got = s.got;
  }
  console.log(`      지원이 오기 전에 ${got}/4 를 건졌다`);
  ok(got >= 1, '적어도 하나는 건진다 — 아예 못 주우면 그건 벌이지 규칙이 아니다');
  ok(got < 4, '★★ **넷을 다 줍지는 못한다** — 그래서 「무엇을 줍고 무엇을 버릴지」가 생긴다');
}

// ══ ⑤ 흩어진다 ═══════════════════════════════════════════════════════
head('[5] 안 주우면 **흩어진다** — 그런데 지원보다는 오래 남는다');
{
  const s = makeSalvage();
  dropPack(s, { kind: 'fighter', az: 0, el: 0, dist: 60 }, null);
  const e = run(s, PACK.live + 2, { moving: false });
  ok(e.faded.length === 1 && s.packs.length === 0, `${PACK.live}초가 지나면 흩어진다`);
  ok(s.lost === 1, '흩어진 것을 센다 — 끝 화면이 읽는다');
  ok(PACK.live > callIn('fighter'),
    '★★ 지원보다 **오래** 남는다 — 그래야 「싸우면서 주울까」를 또 고른다');
  // 배가 가면 멀어진다
  const m = makeSalvage();
  dropPack(m, { kind: 'junk', az: 0, el: 0, dist: 40 }, null);
  const d0 = m.packs[0].dist;
  run(m, 10, { moving: true });
  ok(m.packs[0].dist > d0, '배가 나아가면 **멀어진다** — 가만히 안 있는다');
}

// ══ ⑥ 윈치와 안 겹치나 ═══════════════════════════════════════════════
head('[6] 그물과 윈치가 **다른 물건인가**');
{
  const winchSec = WINCH.load / WINCH.perSec;
  console.log(`      그물 ${reelTime(NET.reach)}초 (앉은 자리) · 윈치 ${winchSec}초 (우주복·바깥문)`);
  ok(reelTime(NET.reach) * 4 < winchSec,
    '★ 그물이 훨씬 빠르다 — 싸우는 중에 쓰는 물건이라 몇 초짜리여야 한다');
  ok(NET.sign > 0, '그물도 자국을 남긴다 — 사출은 숨길 수 없다 (v44 규약)');
}

// ══ ⑦ 한 구간에 몇 번 도나 ═══════════════════════════════════════════
head('[7] 한 구간(490초)에 이 고리가 몇 번 도나');
{
  const per = (TARGET.raiderEvery[0] + TARGET.raiderEvery[1]) / 2;
  const rounds = LEG.seconds / per;
  const oneRound = 3 + reelTime(60) + NET.cool;
  console.log(`      적이 평균 ${per}초마다 · 구간당 ${rounds.toFixed(1)}번 · 한 번에 부수고 줍는 데 약 ${oneRound.toFixed(0)}초`);
  ok(rounds >= 3 && rounds <= 7, `구간당 ${rounds.toFixed(1)}번 (3~7) — 뜸하면 심심하고 잦으면 쉴 틈이 없다`);
  ok(oneRound < per * 0.5, '한 고리가 다음 적이 오기 전에 끝난다 — 안 그러면 늘 밀린다');
}

console.log(bad ? `\n✘ ${bad} 개가 안 맞습니다` : '\n✔ 전부 맞습니다');
console.log(`
  ※ **「줍는 맛이 나나」는 여기서 안 나온다.** 여기서 나오는 것은
     「공짜가 아닌가 · 시계가 도나 · 값이 있나 · 다 못 줍나」뿐이다.
     화면에 꾸러미가 정말 뜨나는 space-endtoend.js 가 본다.`);
process.exit(bad ? 1 : 0);
