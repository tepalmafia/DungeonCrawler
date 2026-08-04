// ══════════════════════════════════════════════════════════════════════════
//  문 — **생동감인가, 방해인가.** 브라우저 없이.
//
//    node tools/space-door.js
//
//  ★ 여기서 제일 중요한 줄 하나
//    **「갇힘은 벽이 아니라 시간 손해다」** (door-table.js).
//    이 배는 척추형이라 우회로가 없다. 끼인 문을 못 열면 그건 벌이 아니라
//    **게임 오버**이고, v21 에서 바로 그것 때문에 게임을 못 했다.
//    그래서 **끼인 문은 언제나 손으로 열린다**를 매번 확인한다.
//
//  ★ 나머지
//    문이 걸음을 막지 않나 (열리는 시간 < 걸어오는 시간) ·
//    회차 하나에 몇 번 끼나 · 많이 다니는 문이 먼저 끼나 ·
//    지금 서 있는 문이 안 닫히나
//
//  ★ 여기서 안 나오는 것
//    **생동감이 느껴지나.** 문이 스르륵 열리는 것이 배를 살아 있게 하는지는
//    직접 봐야 안다 — 그게 사장님이 이걸 넣자고 하신 이유다.
// ══════════════════════════════════════════════════════════════════════════
import { DOOR, canPass, nearDoor } from '../web/space/js/game/door-table.js';
import { makeDoors, stepDoors, byKey, jammedOne, summary } from '../web/space/js/game/door.js';
import { BODY } from '../web/space/js/game/systems-table.js';
import { LEG } from '../web/space/js/game/route-table.js';

const DT = 1 / 30;
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };

// 배의 문 여섯 (world/ship.js HATCHES 와 같아야 한다)
const SPEC = [
  { key: 'cockpit', name: '조종석', x: 0, z: -3.0, ry: 0 },
  { key: 'engine', name: '기관실', x: 0, z: 10.0, ry: Math.PI },
  { key: 'observ', name: '관측실', x: -1.3, z: 0.6, ry: -Math.PI / 2 },
  { key: 'workshop', name: '정비실', x: 1.3, z: 0.6, ry: Math.PI / 2 },
  { key: 'garden', name: '온실', x: -1.3, z: 6.0, ry: -Math.PI / 2 },
  { key: 'airlock', name: '에어록', x: 1.3, z: 5.7, ry: Math.PI / 2 },
];

// ── 1) 표를 먼저 ────────────────────────────────────────────
console.log(`\n문 여섯 — ${DOOR.near}m 안에 들면 ${DOOR.openTime}초에 열린다`);
console.log('  ' + '─'.repeat(64));
{
  // ★ 제일 중요한 계산: **걸어오는 동안 다 열리나.**
  //   안 그러면 문 앞에서 멈춰 서게 되고, 그건 생동감이 아니라 방해다
  const walkIn = DOOR.near / BODY.speed;
  console.log(`  ${DOOR.near}m 를 걸어오는 데 ${walkIn.toFixed(2)}초 · 열리는 데 ${DOOR.openTime}초`);
  ok(DOOR.openTime < walkIn,
    `걸어오는 동안 다 열린다 — 문 앞에서 안 멈춘다 (${DOOR.openTime} < ${walkIn.toFixed(2)})`);
  ok(DOOR.closeTime > DOOR.openTime,
    `닫히는 것이 여는 것보다 느리다 (${DOOR.closeTime} > ${DOOR.openTime}) — 급히 닫히면 갇히는 기분이 든다`);
  console.log(`  크랭크 ${DOOR.crank}초 · 한 번에 최대 ${DOOR.maxJammed}개가 낀다`);
}

// ── 2) 걸어다녀 본다 ────────────────────────────────────────
// 사람이 통로를 왕복한다. 문이 걸음을 막나?
console.log('\n[2] 통로를 왕복한다 — **문이 걸음을 막나**');
{
  const ds = makeDoors(SPEC, 'W1');
  // 조종석 ↔ 기관실 (배에서 제일 긴 길, 21m)
  let z = -6, dir = 1, t = 0, blocked = 0, passes = 0, opened = 0;
  while (t < 300) {
    const near = nearDoor(ds.list, 0, z);
    const evs = stepDoors(ds, DT, { near });
    opened += evs.filter((e) => e.what === 'open').length;
    // 앞에 문이 있고 아직 못 지나가면 멈춘다.
    // ★ **통로를 막는 것은 z축 문(조종석·기관실)뿐이다.** 처음엔 x 좌표만
    //   보고 골랐더니 통로 옆에 붙은 곁방 문(x=±1.3)까지 「앞을 막는 문」으로
    //   세어서 **5분 내내 멈춰 선 것으로 나왔다** — 게임이 아니라 도구가
    //   틀린 것이다. 문이 어느 축을 막는지는 ry 가 말해 준다
    const front = ds.list.find((d) => Math.abs(Math.sin(d.ry)) < 0.5 && Math.abs(d.z - z) < 0.5);
    if (front && !canPass(front)) blocked += DT;
    else {
      const nz = z + dir * BODY.speed * DT;
      if ((dir > 0 && z < 12 && nz >= 12) || (dir < 0 && z > -6 && nz <= -6)) { dir = -dir; passes++; }
      else z = nz;
    }
    t += DT;
  }
  console.log(`  5분 왕복 — 지난 문 ${opened}회 · 되돌아선 횟수 ${passes} · **문 앞에 멈춰 선 시간 ${blocked.toFixed(1)}초**`);
  ok(blocked < 1.0, `문 앞에서 안 멈춘다 (${blocked.toFixed(1)}초) — 멈추면 생동감이 아니라 방해다`);
  ok(opened > 10, `문이 실제로 여닫힌다 (${opened}회)`);
}

// ── 3) 지금 서 있는 문은 안 닫힌다 ──────────────────────────
console.log('\n[3] **문 안에 서 있는데 닫히지 않나** — 닫히면 그건 문이 아니라 덫이다');
{
  const ds = makeDoors(SPEC, 'W2');
  const d = byKey(ds, 'engine');
  let t = 0, minK = 1;
  // 문 안에 30초 서 있는다
  while (t < 30) {
    stepDoors(ds, DT, { near: d });
    if (t > 2) minK = Math.min(minK, d.k);
    t += DT;
  }
  ok(minK >= 1 - 1e-6, `30초를 서 있어도 활짝 열려 있다 (제일 좁았을 때 ${(minK * 100).toFixed(0)}%)`);
}

// ── 4) 낀다 · 그리고 **반드시 열린다** ──────────────────────
console.log('\n[4] ★ **끼인 문은 언제나 손으로 열린다** — 이게 안 되면 갇힘이 게임 오버가 된다');
{
  const ds = makeDoors(SPEC, 'W3');
  const d = byKey(ds, 'engine');
  d.wear = DOOR.jamAt + 0.5;
  ds.next = 0;
  const evs = stepDoors(ds, DT, { near: null });
  ok(evs.some((e) => e.what === 'jam'), `닳은 문이 낀다 — ${d.name}`);
  ok(d.jammed && !canPass(d), '낀 문은 안 열리고 못 지나간다');

  // 가까이 가도 안 열린다
  let t = 0;
  while (t < 5) { stepDoors(ds, DT, { near: d }); t += DT; }
  ok(!canPass(d), '가까이 가도 저절로는 안 열린다 — 그래서 손이 필요하다');

  // 크랭크를 잡는다
  t = 0;
  let freed = false;
  while (t < DOOR.crank * 2 && !freed) {
    freed = stepDoors(ds, DT, { near: d, cranking: d }).some((e) => e.what === 'freed');
    t += DT;
  }
  ok(freed, `크랭크를 ${t.toFixed(1)}초 돌리니 풀린다 (표는 ${DOOR.crank}초)`);
  ok(Math.abs(t - DOOR.crank) < 0.5, `표대로 걸린다 — ${t.toFixed(1)}초`);
  // 풀린 뒤 지나갈 수 있어야 한다
  t = 0;
  while (t < 2) { stepDoors(ds, DT, { near: d }); t += DT; }
  ok(canPass(d), '풀리면 지나갈 수 있다');
  ok(d.force > 0, `풀린 문은 잠깐 열린 채로 있는다 (${d.force.toFixed(0)}초) — 다시 안 끼게`);
}

// ── 5) 놓으면 되돌아간다 ────────────────────────────────────
console.log('\n[5] 크랭크를 놓으면 되돌아간다 — **딱 멈추면 손을 뗄 이유가 없다**');
{
  const ds = makeDoors(SPEC, 'W4');
  const d = byKey(ds, 'observ');
  d.jammed = true; d.k = 0;
  let t = 0;
  while (t < 4) { stepDoors(ds, DT, { cranking: d }); t += DT; }
  const a = d.held;
  t = 0;
  while (t < 2) { stepDoors(ds, DT, {}); t += DT; }
  ok(d.held < a, `놓으니 되돌아간다 (${a.toFixed(2)} → ${d.held.toFixed(2)})`);
}

// ── 6) 회차 하나에 몇 번 끼나 ───────────────────────────────
console.log('\n[6] 한 회차(구간 여덟)에 몇 번 끼나 — **몰아치면 문 게임이 된다**');
{
  // ★ **사람처럼 다닌다.** 처음엔 65분 내내 쉬지 않고 통로를 왕복시켰는데,
  //   그건 아무도 안 하는 짓이라 문을 3480번 여닫았고 34번 끼었다.
  //   실제 플레이는 「방으로 걸어가 20~40초 일하고 다음 방으로」다
  //   (PLAN §11 방 사이 6~12초). **없는 사람에게 맞추면 숫자가 거짓말한다.**
  const ds = makeDoors(SPEC, 'W5');
  const SPOTS = [-6, 0.6, 5.7, 12];        // 조종석 · 가운데 곁방 · 뒤 곁방 · 기관실
  let z = -6, goal = 0, workT = 0, t = 0, jams = 0;
  const lap = LEG.seconds * 8;
  const order = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  while (t < lap) {
    const near = nearDoor(ds.list, 0, z);
    for (const e of stepDoors(ds, DT, { near, cranking: jammedOne(ds) })) {
      if (e.what === 'jam') { jams++; order.push(`${(t / 60).toFixed(0)}분 ${e.door.name}`); }
    }
    if (workT > 0) workT -= DT;                       // 그 방에서 일하는 중
    else if (Math.abs(z - SPOTS[goal]) < 0.2) { workT = 20 + rnd() * 20; goal = Math.floor(rnd() * SPOTS.length); }
    else z += Math.sign(SPOTS[goal] - z) * BODY.speed * DT;
    t += DT;
  }
  console.log(`  ${(lap / 60).toFixed(0)}분에 ${jams}번 끼었다 — ${order.slice(0, 6).join(' · ')}${order.length > 6 ? ' …' : ''}`);
  ok(jams >= 2 && jams <= 12, `회차 하나에 2~12번 (${jams}번) — 0이면 없는 기능이고 많으면 문 게임이 된다`);
  const worn = summary(ds).sort((a, b) => b.cycles - a.cycles);
  console.log(`  제일 많이 쓴 문 — ${worn.slice(0, 3).map((w) => `${w.key} ${w.cycles}회`).join(' · ')}`);
  ok(order.length === 0 || order.some((o) => o.includes('조종석') || o.includes('기관실')),
    '많이 다니는 문이 먼저 낀다 — 왕복이 잦은 길에 벌이 온다');
}

// ── 7) 첫 5분에는 안 낀다 ──────────────────────────────────
console.log('\n[7] **첫 5분에는 안 낀다** — 배우는 중에 갇히면 그건 튜토리얼이 아니다');
{
  const ds = makeDoors(SPEC, 'W6');
  let z = -6, dir = 1, t = 0, jams = 0;
  while (t < 300) {
    const near = nearDoor(ds.list, 0, z);
    jams += stepDoors(ds, DT, { near }).filter((e) => e.what === 'jam').length;
    const nz = z + dir * BODY.speed * DT;
    if (nz > 12 || nz < -6) dir = -dir; else z = nz;
    t += DT;
  }
  // 5분 내내 쉬지 않고 왕복해도 — 즉 **제일 심하게 써도** 안 껴야 한다
  console.log(`  5분 내내 왕복해도 낀 횟수 ${jams} (문 ${DOOR.firstAfter}초 유예 + 닳아야 낀다)`);
  ok(jams === 0, `첫 5분에는 안 낀다 (${jams}회)`);
}

console.log('\n  ※ **생동감이 느껴지나는 여기서 안 나온다.** 문이 스르륵 열리는 것이');
console.log('     배를 살아 있게 하는지는 직접 봐야 안다 — 그게 이걸 넣은 이유다.\n');
process.exit(fail ? 1 : 0);
