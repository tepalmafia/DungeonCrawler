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
import { MISSIONS, TIER, buildable, branchWeights } from '../web/space/js/game/mission-table.js';
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
process.exit(bad.length ? 1 : 0);
