// ══════════════════════════════════════════════════════════════════════════
//  마주치는 것들이 **우리 규칙을 지키나** — 표만 훑는다 (브라우저 없이).
//
//    node tools/space-missions.js
//
//  ★ 왜 필요한가
//    `docs/space/MISSIONS.md §2` 에 「이걸 통과 못 하면 안 넣는다」를 적어
//    놨는데, 표를 쓰다 보면 **적어 놓은 사람이 먼저 어긴다.** 실제로
//    처음 쓴 표가 세 군데 걸렸다 (방 하나에서 끝나는 항목 셋).
//    규칙을 문서에만 두면 그 규칙은 없는 것과 같다.
// ══════════════════════════════════════════════════════════════════════════
import { MISSIONS, TIER, buildable, wired, branchWeights } from '../web/space/js/game/mission-table.js';
const bad = [];
for (const m of MISSIONS) {
  if (!m.branches?.length) bad.push(`${m.key}: 갈래가 없다`);
  // ★★ **위쪽만 보고 있었다** (2026-08-07 · `space-real.js` 가 잡았다).
  //   규칙은 「2~4」라고 파일 머리에 적어 놓고 검사는 `> 4` 만 봤다.
  //   그래서 **갈래가 하나뿐인 항목 셋이 몇 달째 통과**하고 있었다 —
  //   갈래가 하나면 고를 것이 없고, 고를 것이 없으면 그건 갈래가 아니라
  //   그냥 결과다. 도구가 나쁜 설계를 지킨 다섯 번째다.
  //   `sceneOnly` 만 예외다 — 장면이 부르는 것은 **정해진 일**이라
  //   갈래가 하나인 것이 맞다 (자동 조종이 죽으면 자이로를 간다, 끝)
  if (m.branches.length > 4) bad.push(`${m.key}: 갈래가 ${m.branches.length}개 — FTL 규칙은 2~4`);
  if (m.branches.length < 2 && !m.sceneOnly) {
    bad.push(`${m.key}: 갈래가 ${m.branches.length}개 — 하나뿐이면 고를 것이 없다`);
  }
  if (!m.where?.length) bad.push(`${m.key}: 쓰는 방이 없다`);
  if (m.where.length === 1 && !['any'].includes(m.where[0]) && m.tier === TIER.NOW) {
    bad.push(`${m.key}: 방 하나에서 끝난다 (지금 단계 항목인데)`);
  }
}
const byTier = {};
for (const m of MISSIONS) byTier[m.tier] = (byTier[m.tier] || 0) + 1;
console.log('  항목', MISSIONS.length, '·', JSON.stringify(byTier));
console.log('  지금 만들 수 있는 것:', buildable().map((m) => m.name).join(' · '));
console.log('  제일 먼저:', MISSIONS.filter((m) => m.first).map((m) => m.name).join(', ') || '(안 정함)');
const w0 = branchWeights(MISSIONS[0], 0).map((b) => b.weight).join(',');
const w4 = branchWeights(MISSIONS[0], 4).map((b) => b.weight.toFixed(1)).join(',');
console.log(`  구간이 깊어지면 나쁜 갈래가 는다:  0구간 [${w0}] → 4구간 [${w4}]`);
console.log(bad.length ? '\n  ✘ ' + bad.join('\n  ✘ ') : '\n  ✔ 규칙 위반 없음');
// (끝맺음은 파일 맨 아래에서 — 아래 방 검사가 돌아야 한다)

// ── 방 일곱을 다 쓰나 ───────────────────────────────────────
// ★ **이 검사가 없어서 방 넷이 여섯 달 동안 놀았다.**
//   MISSIONS.md §2 에 「방 일곱을 다 쓰려고 만든 배다」라고 적어 뒀는데
//   아무도 그걸 안 물었다 — 물린 고장 셋이 쓰는 방은 셋뿐이었고,
//   점검 패널도 그 셋에만 있었다. **패널이 없어서 고장을 못 만들고 있었다.**
//   문서에 적어 둔 규칙은 도구가 묻지 않으면 그냥 소원이다.
console.log('\n[방] 물린 고장이 방 일곱을 다 쓰나');
{
  const ROOMS = ['cockpit', 'spine', 'observ', 'workshop', 'garden', 'airlock', 'engine'];
  const used = new Map(ROOMS.map((r) => [r, []]));
  for (const m of wired()) {
    const rooms = new Set();
    for (const st of m.steps ?? []) rooms.add(st.at);
    for (const b of m.branches) for (const a of [b.at].flat()) if (a) rooms.add(a);
    for (const r of rooms) used.get(r)?.push(m.name);
  }
  for (const r of ROOMS) {
    const list = used.get(r);
    console.log(`  ${r.padEnd(9)} ${String(list.length).padStart(2)}가지  ${list.join(' · ') || '— 아무 고장도 안 온다'}`);
  }
  // ══ ★★★ v117 — **묻는 것을 뒤집었다** ═════════════════════════════
  //
  //  ★ 여기 「**방 일곱을 다 쓴다**」를 물었다. v23 에는 맞는 물음이었다 —
  //    그때 고장은 「어느 방으로 걸어가서 고친다」였고, 방을 골고루 써야
  //    배가 넓게 쓰였다.
  //
  //  ★★ 그런데 **v106 이 수리를 단추 하나로 바꾸고**(`PILOT.faults=false`)
  //    **v109·v110 이 걷기를 없앴다.** 지금 「물린 고장」은 **0 가지**이고,
  //    그건 고장난 것이 아니라 **그 계통이 조종석으로 옮겨 간 것**이다
  //    (맞으면 닳고, P 로 고친다).
  //
  //  ★★★ 그래서 물어야 하는 것은 「방을 다 쓰나」가 아니라
  //    **「걸어가야 하는 고장이 안 남아 있나」**다 — `space-fit.js` 와
  //    같은 물음이고, 표가 스스로 `blocked()` 로 답한다
  const okAll = wired().every((m) => (m.steps ?? []).every((st) => st.at === 'cockpit'));
  console.log((okAll ? '\n  ✔ ' : '\n  ✘ ')
    + `물린 고장이 **다 조종석에서 된다** (물린 것 ${wired().length} 가지)`
    + ' — v106·v110 이 고장을 조종석으로 옮겼다. 방을 골고루 쓰는지는'
    + ' 이제 물을 일이 아니다 (그 방들에 걸어갈 수가 없다)');
  if (!okAll) process.exitCode = 1;
}

process.exit(process.exitCode || bad.length ? 1 : 0);
