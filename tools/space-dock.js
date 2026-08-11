// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **도킹 회수** — 뼈대만 시뮬한다 (v101)
//
//    node tools/space-dock.js
//
//  ★ 사장님 「격추후에 상대 행성이나 물체에 **도킹해서 회수** … 락온하고
//    다가가서 도킹 … **아이템을 먹을 방법이 없거나 어렵잔아.**
//    블록아웃으로 먼저 설계하고 만들어」
//
//  ★★★ 묻는 것 다섯
//      ① **지금이 정말 어려운가** — 있는 방법 셋을 숫자로 견준다
//      ② 마디 넷이 도나 (다가감 → 물림 → 들어옴)
//      ③ ★ **왜 안 되는지 말하나** — 멀다 · 빠르다 · 옆이다 · 찼다
//      ④ ★★ **역추진이 값을 하나** — 그냥 들이받으면 상한다
//      ⑤ ★★ **그물보다 나은가, 대신 값을 치르나**
// ══════════════════════════════════════════════════════════════════════════
import { DSTEP, DOCK, WHY, whyNotDock, dockWord } from '../web/space/js/game/dock-table.js';
import { makeDock, tryDock, undock, stepDock, docked, summary } from '../web/space/js/game/dock.js';
import { WAYS, timeOf } from '../web/space/js/game/cargo-table.js';
import { PACK, NET } from '../web/space/js/game/salvage-table.js';
import { TARGET, HULL } from '../web/space/js/game/target-table.js';
import { THROTTLE } from '../web/space/js/game/throttle-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const head = (t) => console.log(`\n${t}`);
const DT = 1 / 30;

console.log('도킹 회수 — 뼈대만 (게임을 안 부른다)');
console.log(`   ${DOCK.reach}m 안 · ${DOCK.softAt}m/초 아래 · 원뿔 ${DOCK.cone}도`
  + ` · 물리는 데 ${DOCK.latch}초 · 초당 ${DOCK.rate}개`);

head('[1] ★★★ **지금이 정말 어려운가** — 있는 방법 셋을 견준다');
{
  console.log('   방법        닿는 거리   한 개에 걸리는 시간   묶이나');
  for (const w of Object.values(WAYS)) {
    console.log(`   ${w.name.padEnd(9)} ${String(w.reach).padStart(5)}m`
      + `   ${String(w.fixed ?? (w.reach / w.speed).toFixed(1)).padStart(6)}초`
      + `        ${w.holds ? '★ 묶인다' : '안 묶인다'}`);
  }
  console.log(`   꾸러미는 ${PACK.live}초만 떠 있고 ${PACK.drift}m/초로 밀려난다`
    + ` · 다음 물결이 ${TARGET.wave.gap[0]}~${TARGET.wave.gap[1]}초 뒤`);
  // 그물로 여러 개를 줍는 데 걸리는 시간
  const one = timeOf('net', 60) + WAYS.net.what ? timeOf('net', 60) : 0;
  const five = 5 * (timeOf('net', 60) + NET.cool);
  ok(five > PACK.live * 0.5,
    `★★ 그물로 다섯 개를 주우면 **${five.toFixed(0)}초** — 꾸러미 수명(${PACK.live}초)의 절반을 넘는다.`
    + ' 그리고 그 내내 **추진이 묶인다** — 사장님 말씀대로 어렵다');
  ok(WAYS.arm.reach < HULL.radius + 12,
    `★ 도킹 팔은 ${WAYS.arm.reach}m 라 **선체(${HULL.radius}m) 코앞**이다 — 붙는 조작이 따로 없으면 못 쓴다`);
}

head('[2] ★★ 마디 넷이 도나 — 다가감 → 물림 → 들어옴');
{
  const d = makeDock();
  const r = tryDock(d, { has: true, dist: 20, close: 4, off: 5, id: 7 });
  ok(r.ok && d.step === DSTEP.LATCH, `★ 붙는다 (${dockWord(d)})`);
  ok(!r.hard, '★ 천천히 닿았으므로 안 상한다');
  let ev = null, t = 0;
  while (t < 3 && ev !== 'pull') { ev = stepDock(d, DT, { dist: 20 }); t += DT; }
  ok(ev === 'pull', `★★ ${DOCK.latch}초면 **물린다** (${t.toFixed(2)}초) · ${dockWord(d)}`);
  let got = 0, u = 0;
  while (u < 5) { if (stepDock(d, DT, { dist: 20 }) === 'one') got++; u += DT; }
  ok(got >= 5,
    `★★★ 붙어 있는 **5초에 ${got}개**가 들어온다 — 그물은 하나에 4초가 넘는다.`
    + ' 「먹을 방법이 어렵다」의 답이 이 한 줄이다');
  ok(stepDock(d, DT, { dist: DOCK.reach * 2 }) === 'off', '★ 멀어지면 **떨어진다** — 끌려다니지 않는다');
}

head('[3] ★ **왜 안 되는지 말하나**');
{
  const cases = [
    [{ has: false }, 'none'],
    [{ has: true, dist: 200 }, 'far'],
    [{ has: true, dist: 20, off: 80 }, 'side'],
    [{ has: true, dist: 20, close: 40 }, 'fast'],
    [{ has: true, dist: 20, full: true }, 'full'],
    [{ has: true, dist: 20, step: DSTEP.PULL }, 'busy'],
  ];
  for (const [o, want] of cases) {
    ok(whyNotDock(o) === want, `${want.padEnd(5)} → 「${WHY[want]}」`);
  }
  ok(whyNotDock({ has: true, dist: 20, close: 4, off: 5 }) === null, '★ 다 되면 아무 말도 안 한다');
  const used = new Set(cases.map(([, w]) => w));
  ok(Object.keys(WHY).every((k) => used.has(k)), '★★ 여섯 가지 이유가 **다 난다**');
}

head('[4] ★★ **역추진이 값을 하나** — 그냥 들이받으면 상한다');
{
  const soft = makeDock();
  tryDock(soft, { has: true, dist: 20, close: 3, off: 0 });
  const hard = makeDock();
  tryDock(hard, { has: true, dist: 20, close: DOCK.softAt * 0.95, off: 0 });
  ok(!soft.hard && hard.hard,
    `★★★ 천천히(3m/초) 닿으면 멀쩡하고 **빠르게(${(DOCK.softAt * 0.95).toFixed(0)}m/초) 닿으면 상한다** —`
    + ' 「붙는다」가 조작이 되는 자리다');
  ok(whyNotDock({ has: true, dist: 20, close: DOCK.softAt + 5 }) === 'fast',
    `★★ 더 빠르면 아예 **안 물린다** (${DOCK.softAt}m/초 위) — 역추진으로 줄여야 한다`);
  // 역추진이 실제로 줄일 수 있는 양인가
  ok(THROTTLE.backAway >= DOCK.softAt * 0.5,
    `★ 역추진이 ${THROTTLE.backAway}m/초를 내므로 ${DOCK.softAt}m/초 아래로 **줄일 수 있다** —`
    + ' 못 줄이는 값을 요구하면 그건 조작이 아니라 벽이다');
}

head('[5] ★★ **그물보다 나은가, 대신 값을 치르나**');
{
  const netFive = 5 * (timeOf('net', 60) + NET.cool);
  const dockFive = DOCK.latch + 5 / DOCK.rate;
  console.log(`   다섯 개 — 그물 ${netFive.toFixed(1)}초 · 도킹 ${dockFive.toFixed(1)}초`
    + ` (다가가는 시간은 빼고)`);
  ok(dockFive < netFive, `★★ 도킹이 **${(netFive / dockFive).toFixed(1)}배 빠르다** — 여러 개일수록 크게 벌어진다`);
  ok(DOCK.holdsThrust,
    '★★★ 대신 **붙어 있는 동안 못 움직인다** — 그물과 같은 값이다.'
    + ' 「주우려면 도망칠 수 없다」가 이 배의 오랜 규약이고, 도킹은 그것을 더 오래 문다');
  ok(DOCK.sign > 0, `★ 그리고 자국이 초당 ${DOCK.sign} 오른다 — 가만히 붙어 있으면 훤하다`);
  ok(DOCK.reach > HULL.radius,
    `★ 걸리는 거리 ${DOCK.reach}m 가 선체(${HULL.radius}m)보다 **밖**이다 —`
    + ' 안으로 잡으면 「부딪혔는데 도킹됐다」가 난다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
