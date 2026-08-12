// ══════════════════════════════════════════════════════════════════════════
//  고장 — **진단이 성립하나.** 브라우저 없이.
//
//    node tools/space-fault.js
//
//  ★ 여기서 묻는 것
//    ① 한 방에서 끝나는 고장이 없나 (방 일곱을 쓰려고 만든 배다)
//    ② 문제 하나가 40초~2분인가 (PLAN §11)
//    ③ 동시에 열린 것이 1~2개인가 — 다섯이면 사람은 포기한다
//    ④ **무시하면 벌이 오나** — 안 고쳐도 아무 일 없으면 그건 장식이다
//    ⑤ 구간이 깊어지면 나쁜 갈래가 느나 (Hardspace 계보)
//
//  ★ 걷는 시간은 **가정이다.** 여기서 못 잰다
//    시뮬은 걸을 수 없다. PLAN §11 의 「방 사이 6~12초」 중간값을 쓰고,
//    가정이라는 것을 화면에 같이 찍는다. 가정을 숨기면 그 숫자는 언젠가
//    「잰 값」으로 둔갑한다.
//
//  ★ 「재미있나」는 여기서 안 나온다
//    소리로 자리를 찾는 것이 실제로 되는지는 **귀로** 확인해야 한다.
// ══════════════════════════════════════════════════════════════════════════
import { MISSIONS, FAULT, TIER, wired, branchWeights } from '../web/space/js/game/mission-table.js';
import { makeFaults, stepFaults, repairStep, clear, siteOf, effectsOf, wearStep, wearFlip }
  from '../web/space/js/game/fault.js';
import { WEAR } from '../web/space/js/game/systems-table.js';
import { HEAT, VALVE } from '../web/space/js/game/systems-table.js';
import { heatRate, signatureOf } from '../web/space/js/game/chase.js';
import { SIGN } from '../web/space/js/game/chase-table.js';

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ v117 — **고장 계통이 꺼져 있으면 여기서 멈춘다**
//
//  ★ 사장님 「우리 장르에 맞지 않는 설정들이 없는지 점검해봐」 →
//    `tools/space-fit.js` 가 잡았다.
//
//  ★★ **v106 이 수리를 단추 하나로 바꾸며 고장을 껐다**
//    (`pilot-table.js PILOT.faults = false` · 사장님 「수리는 버튼하나로
//    해결하고」). 그런데 이 검사는 계속 고장이 나기를 기다렸다 —
//    하나는 **끝나지도 않았다**(시간 초과).
//
//  ★★★ **없는 것을 재는 검사는 빨간 것보다 나쁘다.** 초록이면 「있다」고
//    거짓말하고, 빨가면 멀쩡한 것을 틀렸다고 한다. 그래서 **껐다고 말하고
//    멈춘다** — 다시 켜면 저절로 되살아난다
// ══════════════════════════════════════════════════════════════════════════
import { PILOT as FIT_PILOT } from '../web/space/js/game/pilot-table.js';
if (!FIT_PILOT.faults) {
  console.log('\n※ **고장 계통이 꺼져 있습니다** (`PILOT.faults = false` · v106).');
  console.log('   사장님 「수리는 버튼하나로 해결하고」 — 맞으면 닳고 **P 로 고친다**.');
  console.log('   그래서 이 검사는 잴 것이 없습니다. 고장을 다시 켜면 저절로 돌아옵니다.');
  console.log('   지금 그 자리를 재는 것: `space-fit.js` (닿나) · `space-war.js` (맞으면 일이 되나)');
  process.exit(0);
}


const HOP = 9;        // 방 하나 옮기는 데 걸리는 초 — **가정** (PLAN §11: 6~12)
const LISTEN = 5;     // 그 방에서 「여긴가」를 듣고 판단하는 시간 — 가정
const DT = 0.25;

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };

// ── 1) 물린 것과 아직인 것 ──────────────────────────────────
const on = wired();
const off = MISSIONS.filter((m) => !on.includes(m));
console.log(`\n마주치는 것 ${MISSIONS.length}가지 중 **게임에 물린 것 ${on.length}가지**`);
console.log('  ' + '─'.repeat(70));
for (const m of on) console.log(`  ● ${m.name.padEnd(9)} ${m.lead}`);
console.log('  아직: ' + off.map((m) => `${m.name}(${m.tier})`).join(' · '));

// ── 2) 한 방에서 끝나는 것이 없나 ───────────────────────────
console.log('\n[1] 한 방에서 끝나는 고장이 없나');
for (const m of on) {
  // 자리가 갈래로 갈리면 **찾아 다녀야** 하므로 방을 여럿 쓴다
  const spots = new Set();
  for (const b of m.branches) for (const a of [].concat(b.at ?? [])) spots.add(a);
  for (const s of m.steps ?? []) spots.add(s.at);
  ok(spots.size >= 2, `${m.name.padEnd(9)} 방 ${spots.size}곳 — ${[...spots].join(' · ')}`);
}

// ── 3) 문제 하나가 얼마나 걸리나 ────────────────────────────
console.log('\n[2] 문제 하나가 40초~2분인가');
console.log(`  (방 하나 옮기기 ${HOP}초 · 그 방에서 듣고 판단 ${LISTEN}초 — **가정**이다)`);
const times = [];
for (const m of on) {
  for (const b of branchWeights(m, 0)) {
    const at = [].concat(b.at ?? []);
    let hops, holds;
    if (at.length) {
      // 자리를 모른다 — 후보 중 평균 절반쯤 헤맨다
      const cand = new Set();
      for (const x of m.branches) for (const a of [].concat(x.at ?? [])) cand.add(a);
      // ★ +1 — 고장이 뜬 순간 후보 방에 서 있을 리가 없다. 처음엔 그걸
      //   빼먹어서 35초가 나왔는데, 실제로는 조종석이든 어디든에서 출발한다
      hops = (cand.size + 1) / 2 + 1 + (at.length - 1);
      holds = (m.hold ?? 7) * at.length;
    } else {
      hops = (m.steps ?? []).length + 1;
      holds = (m.steps ?? []).reduce((s, x) => s + x.hold, 0) * (b.again ? 1.4 : 1);
    }
    const sec = hops * (HOP + LISTEN) + holds;
    times.push({ name: `${m.name}·${b.key}`, sec });
  }
}
for (const t of times) console.log(`  ${t.name.padEnd(22)} ${t.sec.toFixed(0).padStart(4)}초`);
const lo = Math.min(...times.map((t) => t.sec)), hi = Math.max(...times.map((t) => t.sec));
ok(lo >= 40 && hi <= 120, `전부 40~120초 안에 든다 — ${lo.toFixed(0)} ~ ${hi.toFixed(0)}초`);

// ── 4) 동시에 몇 개나 열리나 ────────────────────────────────
console.log('\n[3] 동시에 열린 것 · 얼마나 자주 오나');
{
  const f = makeFaults('FAULTSIM');
  let t = 0, maxOpen = 0, spawns = 0;
  const gaps = [];
  let last = 0;
  // 20분을 **아무것도 안 고치고** 놔둔다 — 최악을 본다
  while (t < 1200) {
    if (stepFaults(f, DT, { calm: true, leg: Math.floor(t / 500) }) === 'spawn') {
      spawns++; gaps.push(t - last); last = t;
    }
    maxOpen = Math.max(maxOpen, f.open.length);
    t += DT;
  }
  ok(maxOpen <= FAULT.maxOpen, `동시에 최대 ${maxOpen}개 (목표 ${FAULT.maxOpen} 이하)`);
  // 고치면서 가는 쪽 — 뜨면 바로 고친다고 보고 간격을 잰다
  const g = makeFaults('FAULTSIM');
  let t2 = 0; const gaps2 = []; let last2 = 0;
  while (t2 < 2400) {
    if (stepFaults(g, DT, { calm: true, leg: Math.floor(t2 / 500) }) === 'spawn') {
      gaps2.push(t2 - last2); last2 = t2;
      clear(g, g.open[g.open.length - 1]);      // 바로 고쳤다고 본다
    }
    t2 += DT;
  }
  const avg = gaps2.slice(1).reduce((s, x) => s + x, 0) / (gaps2.length - 1);
  console.log(`  고치면서 가면 평균 ${avg.toFixed(0)}초마다 하나 (첫 것은 ${FAULT.firstAfter}초 뒤)`);
  // 평온 구간이 2~4분인데 그 안에 1~2개면, 간격은 대략 60~180초여야 한다
  ok(avg >= 60 && avg <= 180, `간격이 60~180초 (평온 2~4분에 1~2개)`);
  console.log(`  20분 방치하면 ${spawns}개까지 뜬다 (열린 채로는 ${FAULT.maxOpen}개에서 멎는다)`);
}

// ── 5) 무시하면 벌이 오나 ───────────────────────────────────
console.log('\n[4] 안 고치면 어떻게 되나 — **벌이 없으면 장식이다**');
{
  const f = makeFaults('IGNORE');
  // 「원인 모를 열」 하나만 열어 둔다
  while (!f.open.length) stepFaults(f, DT, { calm: true, leg: 0 });
  const bad = effectsOf(f);
  const power = { thrust: true, cool: true, sensor: false };

  const climb = (valve) => {
    let h = HEAT.start, sec = 0;
    while (sec < 600) {
      h = Math.max(0, Math.min(HEAT.max, h + (heatRate(power, valve) + bad.heat) * DT));
      sec += DT;
      if (h >= HEAT.max - 1) return { sec, h };
    }
    return { sec: Infinity, h };
  };
  const noValve = climb(false);
  const withValve = climb(true);
  // ★★ **v58 — 벌이 옮겨갔다.** 예전에는 밸브를 안 열면 **선체**가 20초
  //   만에 꽉 찼는데, 그건 「추진만 켜면 13초에 과열」과 같은 자릿수 오류의
  //   뒷면이었다. 지금은 냉각 회로가 선체를 잡아 주므로 선체는 안 찬다 —
  //   대신 **열 저장고**가 차고, 차면 냉각이 죽어 그때 선체가 오른다.
  //   즉 벌이 **즉사에서 시한폭탄으로** 바뀌었다 (tools/space-heat.js 가 잰다)
  ok(noValve.sec >= 60,
    `밸브 없이도 선체는 ${Number.isFinite(noValve.sec) ? noValve.sec.toFixed(0) + '초' : '안'} 찬다 —`
    + ' **즉사가 아니다.** 대신 열 저장고가 차고, 차면 그때부터 선체가 오른다 (space-heat.js [3])');
  // ★ 밸브를 열어 둬도 **결국 오른다.** 다만 시간이 있다 —
  //   고치는 데 50초쯤 걸리므로(위 [2]), 그보다는 넉넉해야 고장이 사형이 안 된다
  ok(withValve.sec >= 60 && withValve.sec <= 180,
    `밸브를 열어 둬도 ${withValve.sec.toFixed(0)}초 뒤엔 꽉 찬다 — 버틸 수는 있지만 매여 있다`);

  // 그리고 열이 자국을 밀어 접촉 기준을 넘기나
  const signHot = signatureOf(power, HEAT.max, 1);
  const signCool = signatureOf(power, HEAT.start, 1);
  ok(signHot > SIGN.contactAt && signCool < SIGN.contactAt,
    `열이 자국을 접촉 기준 위로 민다 — 식었을 때 ${signCool.toFixed(0)} · 뜨거울 때 ${signHot.toFixed(0)} (기준 ${SIGN.contactAt})`);
  console.log('  → 안 고치면 **밸브에 매여 있거나, 놓으면 붙는다.** 그게 벌이다');
}

// ── 6) 구간이 깊어지면 나빠지나 ─────────────────────────────
console.log('\n[5] 구간이 깊어지면 나쁜 갈래가 느나');
{
  const m = MISSIONS.find((x) => x.key === 'phantomHeat');
  const share = (leg) => {
    const w = branchWeights(m, leg);
    const tot = w.reduce((s, b) => s + b.weight, 0);
    return w.filter((b) => b.worse).reduce((s, b) => s + b.weight, 0) / tot;
  };
  const a = share(0), b = share(7);
  console.log(`  원인 모를 열 — 나쁜 갈래 비율 0구간 ${(a * 100).toFixed(0)}% → 7구간 ${(b * 100).toFixed(0)}%`);
  ok(b > a * 1.5, '깊어질수록 확실히 는다');
}

// ── 7) 고치는 절차가 실제로 도나 ────────────────────────────
console.log('\n[6] 잡고 있으면 정말 고쳐지나');
{
  const f = makeFaults('REPAIR');
  while (!f.open.length) stepFaults(f, DT, { calm: true, leg: 0 });
  const o = f.open[0];
  const rooms = [];
  let guard = 0, done = false;
  while (guard++ < 4000 && !done) {
    rooms.push(siteOf(o));
    let ev = null, held = 0;
    while (!ev && held < 60) { ev = repairStep(o, DT); held += DT; }
    if (ev === 'fixed') { clear(f, o); done = true; }
  }
  ok(done, `${o.name} — 자리 ${[...new Set(rooms)].join(' → ')} 를 거쳐 고쳐진다`);
  ok(f.open.length === 0 && f.fixed === 1, '고치면 목록에서 빠진다');
}

// ── 8) 마모가 다음 고장을 정하나 ────────────────────────────
console.log('\n[7] 마모 — **어떻게 몰았는지가 다음을 정하나** (정비실 진단대의 근거)');
{
  // 밟기만 하는 사람 vs 밸브만 붙들고 있는 사람 — 닳는 데가 달라야 한다
  const runner = makeFaults('W1'), cooler = makeFaults('W2');
  const MIN20 = 1200;
  for (let i = 0; i < MIN20; i++) {
    wearStep(runner, 1, { power: { thrust: true, cool: false, sensor: true }, valveOpen: false, region: 'empty' });
    wearStep(cooler, 1, { power: { thrust: false, cool: true, sensor: false }, valveOpen: true, region: 'empty' });
  }
  const r = runner.wear, c = cooler.wear;
  console.log(`  20분 밟기만  전력 ${(r.power * 100).toFixed(0)}% · 냉각 ${(r.cool * 100).toFixed(0)}% · 선체 ${(r.hull * 100).toFixed(0)}%`);
  console.log(`  20분 식히기만 전력 ${(c.power * 100).toFixed(0)}% · 냉각 ${(c.cool * 100).toFixed(0)}% · 선체 ${(c.hull * 100).toFixed(0)}%`);
  ok(r.hull > c.hull * 2 && c.cool > r.cool * 2, '쓰는 데가 닳는다 — 두 사람의 닳은 곳이 다르다');
  ok(r.hull >= WEAR.warn && r.hull < 1,
    `20분이면 경고선(${(WEAR.warn * 100).toFixed(0)}%)에 닿는다 — 늘 빨간 계기는 안 보는 계기다`);

  // 닳은 계통이 정말 더 잘 터지나 — 시드를 여럿 돌려 본다
  const count = (biasKey) => {
    let hit = 0, n = 0;
    for (let i = 0; i < 60; i++) {
      const f = makeFaults(`BIAS${i}`);
      f.fixed = 1;                      // 첫 고장 규칙(원인 모를 열)을 비켜 간다
      f.wear[biasKey] = 1;
      while (!f.open.length) stepFaults(f, 0.5, { calm: true, leg: 0 });
      n++;
      if (f.open[0].sys === biasKey) hit++;
    }
    return hit / n;
  };
  const pw = count('power'), cl = count('cool');
  console.log(`  전력만 닳았을 때 전력 고장 ${(pw * 100).toFixed(0)}% · 냉각만 닳았을 때 냉각 고장 ${(cl * 100).toFixed(0)}%`);
  ok(pw > 0.4 && cl > 0.4, '닳은 계통이 더 잘 터진다 (셋 중 하나면 33% 가 기준)');

  // 고치면 그 계통이 덜어진다 — 안 그러면 한 계통만 계속 터진다
  const f3 = makeFaults('RELIEF');
  f3.fixed = 1;
  for (const k of WEAR.keys) f3.wear[k] = 0.8;    // 전부 닳려 놓고 무엇이 터지든 본다
  while (!f3.open.length) stepFaults(f3, 0.5, { calm: true, leg: 0 });
  const o3 = f3.open[0], w0 = f3.wear[o3.sys];
  clear(f3, o3);
  ok(f3.wear[o3.sys] < w0, `고치면 그 계통이 덜어진다 (${o3.sys} ${(w0 * 100).toFixed(0)}% → ${(f3.wear[o3.sys] * 100).toFixed(0)}%)`);
  ok(f3.log.length === 1, '고친 것이 기록에 남는다 — 배너는 사라지지만 진단대는 안 사라진다');
}

console.log('\n  ※ 방 사이 걷는 시간은 **가정**이다 (PLAN §11 의 6~12초 중간값).');
console.log('  ※ 소리로 자리를 찾는 것이 실제로 되는지는 **귀로** 확인해야 한다.\n');
process.exit(fail ? 1 : 0);
