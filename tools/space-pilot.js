// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **조종석 하나짜리 배** — 뼈대만 (v106)
//
//    node tools/space-pilot.js
//
//  ★ 사장님 「오직 전투와 파밍으로 갈거야. **수리는 버튼하나로 해결**하고」
//    「**공간도 없애주고**, 핵탄두와 미사일 격납고, 기타 비행에 필요한 공간만」
//    「걸어다니는 것을 남길까요」→ **「b」** (없앤다)
//
//  ★★★ 묻는 것 다섯
//      ① **무엇이 죽고 무엇이 사나** — 낡은 것을 적어 두었나
//      ② 남는 것으로 **회차가 채워지나** — 빈 시간이 생기지 않나
//      ③ ★★ 수리 단추가 **공짜가 아닌가**
//      ④ ★★★ 「맞으면 일이 된다」(v70)가 **살아 있나**
//      ⑤ ★ 못 고치는 자리마다 까닭을 말하나
// ══════════════════════════════════════════════════════════════════════════
import {
  PILOT, FIX, FIX_WHY, KEEP_ROOMS, DROP_ROOMS, needsFix, fixWord,
} from '../web/space/js/game/pilot-table.js';
import { ROOMS } from '../web/space/js/game/rooms-table.js';
import { FAULT } from '../web/space/js/game/mission-table.js';
import { LEG } from '../web/space/js/game/route-table.js';
import { TARGET } from '../web/space/js/game/target-table.js';
import { HEAT } from '../web/space/js/game/systems-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

console.log('조종석 하나짜리 배 — 뼈대만 (게임을 안 부른다)');

console.log('\n[1] ★★★ **무엇이 죽고 무엇이 사나** — 낡은 것을 적어 두었나');
{
  console.log(`   지금 방이 ${ROOMS.length} 개다: ${ROOMS.map((r) => r.name).join(' · ')}`);
  console.log('');
  for (const [k, why] of DROP_ROOMS) {
    const r = ROOMS.find((x) => x.key === k);
    console.log(`   ✕ ${(r?.name ?? k).padEnd(6)} ${why}`);
  }
  console.log(`\n   남는 것: ${KEEP_ROOMS.join(' · ')}`);
  ok(PILOT.seatOnly === true,
    '★★★ **조종석에서 안 나온다** — 이 한 줄이 이 판의 전부다');
  ok(DROP_ROOMS.length + 1 >= ROOMS.length - 1,
    `★★ 없애는 방마다 **까닭이 적혀 있다** (${DROP_ROOMS.length} 개)`
    + ' — 낡은 것을 조용히 남기면 다음 사람이 살아 있는 설계로 읽는다');
  ok(DROP_ROOMS.every(([, w]) => w && w.length > 8), '★ 까닭이 빈 것이 없다');
  ok(PILOT.faults === false, '★★★ **고장이 안 난다** — 걸어갈 곳이 없으므로');
  ok(PILOT.bayIsScreen === true,
    '★★ 격납고는 **화면으로만** 본다 (사장님 「b」) — 탄두 재료 다섯은 그대로 산다');
}

console.log('\n[2] ★★ 남는 것으로 **회차가 채워지나** — 빈 시간이 생기지 않나');
{
  //  ★ 고장이 95~165초마다 하나씩 났다. 그게 없어지면 그 시간이 빈다 —
  //    무엇이 채우나? 적이 오는 시계다
  const legSec = LEG.seconds;
  const faultsPerLeg = legSec / ((FAULT.every[0] + FAULT.every[1]) / 2);
  const every = (TARGET.raiderEvery[0] + TARGET.raiderEvery[1]) / 2;
  const foesPerLeg = legSec / every;
  console.log(`   구간 하나 ${Math.round(legSec)}초`);
  console.log(`   전에는 고장이 **${faultsPerLeg.toFixed(1)}개** 났다 (95~165초마다)`);
  console.log(`   지금 적은 **${foesPerLeg.toFixed(1)}번** 온다 (${every.toFixed(0)}초마다)`);
  ok(foesPerLeg >= faultsPerLeg * 0.5,
    `★★ 적이 오는 것이 고장이 나던 것의 **${(foesPerLeg / faultsPerLeg).toFixed(1)}배**다`
    + ' — 빈 시간이 통째로 생기지는 않는다');
  if (foesPerLeg < faultsPerLeg) {
    console.log(`   ※ 그래도 **${(faultsPerLeg - foesPerLeg).toFixed(1)}개 몫이 빈다** —`
      + ' 다음 판(파밍)이 채워야 할 예산이 이만큼이다');
  }
}

console.log('\n[3] ★★★ 수리 단추가 **공짜가 아닌가** — 여기가 이 계통의 전부다');
{
  console.log(`   한 번에 — 부품 **${FIX.parts}** · 누르고 **${FIX.hold}초**`
    + ` · 다시 누르기까지 **${FIX.cool}초**`);
  console.log(`   돌아오는 것 — 선체 **${(FIX.hull * 100).toFixed(0)}%** · 열 **−${FIX.heat}**`);
  ok(FIX.parts > 0,
    '★★★ **부품을 쓴다** — 파밍으로 얻는 것이다. 공짜면 「맞아도 그만」이 되고,'
    + ' 그러면 v70 이 만든 「맞으면 일이 된다」가 통째로 사라진다');
  ok(FIX.needCalm === true,
    `★★★ **쫓기는 중에는 못 고친다** — 그래야 「지금 뺄까 더 붙을까」가 생긴다.`
    + ' 이 게임이 재미있는 자리는 늘 그 갈림이었다');
  ok(FIX.cool > FIX.hold * 3,
    `★★ 다시 누르기까지 ${FIX.cool}초 — 누르고 또 누르는 것으로는 안 된다`);
  ok(FIX.hull < 0.5,
    `★ 한 번에 다 안 낫는다 (${(FIX.hull * 100).toFixed(0)}%) — 다 나으면 그건 목숨이지 수리가 아니다`);
  ok(FIX.heat > 0,
    `★★ **열도 내려간다 (−${FIX.heat})** — 냉각 밸브가 하던 일을 여기가 이어받는다.`
    + ' 없애면서 그 값까지 같이 없애면 열 계통이 죽는다');
}

console.log('\n[4] ★★★ 「맞으면 일이 된다」가 **살아 있나** (v70)');
{
  //  고장을 없앴으므로 「맞으면 고장이 난다」는 죽었다. 대신 무엇이 남나?
  //  **선체 마모와 열** — 그리고 그것을 되돌리려면 **부품**이 든다.
  //  즉 「맞으면 파밍한 것을 태운다」로 옮겨 간다
  ok(needsFix(0.3, 0, HEAT.max), '★ 선체가 닳으면 고칠 것이 있다고 한다');
  ok(needsFix(0, HEAT.max * 0.8, HEAT.max),
    '★★ **뜨거워도** 고칠 것이 있다고 한다 — 열이 이 단추의 두 번째 일이다');
  ok(!needsFix(0, 0, HEAT.max), '★ 멀쩡하면 조용하다');
  console.log(`\n   ★★★ 「맞으면 일이 된다」가 이렇게 바뀐다:`);
  console.log(`      전 — 맞으면 **고장**이 나고, 걸어가서 손으로 고친다`);
  console.log(`      후 — 맞으면 **부품**이 든다. 부품은 **파밍**으로 얻는다`);
  console.log(`      즉 벌이 「일」에서 **「파밍한 것을 태우는 것」**으로 옮겨 간다 —`);
  console.log(`      전투와 파밍이 서로를 먹여 살리는 고리가 된다`);
}

console.log('\n[5] ★ 못 고치는 자리마다 **까닭을 말하나**');
{
  for (const [k, w] of Object.entries(FIX_WHY)) {
    ok(!!w && w.length > 4, `★ ${k.padEnd(6)} — 「${w}」`);
  }
  ok(fixWord({ busy: true, left: 1.2 }).includes('수리 중'), `★ 「${fixWord({ busy: true, left: 1.2 })}」`);
  ok(fixWord({ cool: 7 }).includes('7'), `★ 「${fixWord({ cool: 7 })}」`);
  ok(fixWord({}).includes('부품'), `★ 「${fixWord({})}」`);
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
