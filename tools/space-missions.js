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
  if (m.branches.length > 4) bad.push(`${m.key}: 갈래가 ${m.branches.length}개 — FTL 규칙은 2~4`);
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
  const empty = ROOMS.filter((r) => used.get(r).length === 0);
  const okAll = empty.length === 0;
  console.log((okAll ? '\n  ✔ ' : '\n  ✘ ') + `방 일곱을 다 쓴다 — 안 쓰는 방 ${empty.join(', ') || '없다'}`);
  if (!okAll) process.exitCode = 1;
}

process.exit(process.exitCode || bad.length ? 1 : 0);
