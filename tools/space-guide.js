// ══════════════════════════════════════════════════════════════════════════
//  바닥 안내선 — **길이 배 안으로만 나 있나. 그리고 튜토리얼에서만 켜지나.**
//
//    node tools/space-guide.js
//
//  ★ 여기서 제일 중요한 줄은 「튜토리얼에서만」이다
//    이 게임은 「어디인지는 안 말한다」로 서 있다 (PLAN §3-1). 바닥에 목표를
//    가리키는 선은 그 줄을 정면으로 거스르는 물건이라, **가르침 일곱이
//    도는 동안**으로 못박아 두지 않으면 본편이 심부름 게임이 된다.
//    그리고 그건 **편하려고 늘리고 싶어지는 자리**라 도구가 지킨다.
//
//  ★ 여기서 안 나오는 것
//    **보이나.** 화살표가 바닥에 파묻혔는지, 방향이 거꾸로인지는 여기서
//    안 보인다 — tools/space-chase.js 가 브라우저에서 켜지는지 보고,
//    실제로 「따라가고 싶어지나」는 직접 해 봐야 안다.
// ══════════════════════════════════════════════════════════════════════════
import { AIMS, pathTo } from '../web/space/js/game/guide-table.js';
import { LESSONS, KEYS } from '../web/space/js/game/tutor-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };

// ★ 방 사각형을 **여기 옮겨 적지 않는다.** world/ship.js 는 three 를 쓰므로
//   브라우저 없이 못 읽는다 — 그래서 좌표만 추려 온다. 어긋나면 아래
//   「배 밖으로 안 나간다」가 바로 ✘ 로 찍힌다 (지금 그게 이 검사의 일이다)
const ROOMS = [
  { key: 'cockpit', x0: -3.4, x1: 3.4, z0: -9.0, z1: -3.0, name: '조종석' },
  { key: 'spine', x0: -1.3, x1: 1.3, z0: -3.0, z1: 10.0, name: '통로' },
  { key: 'observ', x0: -5.4, x1: -1.3, z0: -1.2, z1: 2.4, name: '관측실' },
  { key: 'workshop', x0: 1.3, x1: 5.4, z0: -1.2, z1: 2.4, name: '정비실' },
  { key: 'garden', x0: -5.4, x1: -1.3, z0: 4.2, z1: 7.8, name: '온실' },
  { key: 'airlock', x0: 1.3, x1: 4.3, z0: 4.2, z1: 7.2, name: '에어록' },
  { key: 'engine', x0: -4.6, x1: 4.6, z0: 10.0, z1: 16.0, name: '기관실' },
];
const DOORS = [
  { key: 'cockpit', x: 0, z: -3.0 }, { key: 'engine', x: 0, z: 10.0 },
  { key: 'observ', x: -1.3, z: 0.6 }, { key: 'workshop', x: 1.3, z: 0.6 },
  { key: 'garden', x: -1.3, z: 6.0 }, { key: 'airlock', x: 1.3, z: 5.7 },
];
const inShip = (p) => ROOMS.some((r) => p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1);
/** 두 점 사이를 잘게 찍어 본다 — 꺾은점만 배 안이면 벽을 뚫고 갈 수 있다 */
function walk(a, b, step = 0.12) {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / step)), out = [];
  for (let i = 0; i <= n; i++) out.push({ x: a.x + ((b.x - a.x) * i) / n, z: a.z + ((b.z - a.z) * i) / n });
  return out;
}

console.log('\n══ 바닥 안내선 ══');

console.log('\n[1] ★★ **튜토리얼에서만 켜진다** — 여기가 이 도구의 이유다');
{
  const aimed = Object.keys(AIMS);
  const unknown = aimed.filter((k) => !KEYS.includes(k));
  ok(unknown.length === 0, `가리키는 가르침이 전부 실재한다 — 없는 것 ${unknown.join() || '없다'}`);
  ok(!aimed.includes('walk'),
    '`walk` 은 안 가리킨다 — 첫 30초부터 시키는 데로 가는 게임이면 안 된다');
  ok(!aimed.includes('fault'),
    '`fault` 는 안 가리킨다 — 그 가르침의 내용이 「소리로 찾는다」다 (헤매면 그때 main.js 가 잇는다)');
  console.log(`  가리키는 것 ${aimed.length}개 / 가르침 ${KEYS.length}개 — ${aimed.join(', ')}`);
  // 나머지 둘(walk·fault)은 위에서 이유를 적었다. 그 밖에 빠진 게 있으면 안 된다
  const missing = KEYS.filter((k) => !aimed.includes(k) && k !== 'walk' && k !== 'fault');
  ok(missing.length === 0, `갈 데가 있는 가르침은 전부 가리킨다 — 빠진 것 ${missing.join() || '없다'}`);
}

console.log('\n[2] **길이 배 밖으로 안 나간다** — 꺾은점만 보면 벽을 뚫는다');
{
  // 방마다 한 자리씩 서 보고, 갈 만한 목표 전부로 길을 그어 본다
  const SPOTS = ROOMS.map((r) => ({ name: r.name, x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 }));
  const GOALS = [
    { name: '해도대', x: -3.7, z: 0.6 }, { name: '차단기', x: -0.8, z: 3.3 },
    { name: '밸브', x: 0, z: 15.1 }, { name: '조종간', x: 0, z: -7.0 },
    { name: '윈치', x: 3.0, z: 4.9 },
    // 고장 난 방의 점검 패널 — 일곱 방 전부가 목표가 될 수 있다
    { name: '정비실 패널', x: 2.8, z: 2.0 }, { name: '온실 패널', x: -2.6, z: 7.2 },
  ];
  let out = 0, worst = '';
  for (const s of SPOTS) for (const g of GOALS) {
    const path = pathTo(s, g, ROOMS, DOORS);
    for (let i = 1; i < path.length; i++) {
      for (const p of walk(path[i - 1], path[i])) {
        if (!inShip(p)) { out++; if (!worst) worst = `${s.name} → ${g.name} (${p.x.toFixed(1)},${p.z.toFixed(1)})`; }
      }
    }
  }
  console.log(`  ${SPOTS.length}자리 × ${GOALS.length}목표 = ${SPOTS.length * GOALS.length}가지`);
  ok(out === 0, `길이 늘 배 안이다 — 밖으로 나간 점 ${out}개 ${worst && `(${worst})`}`);
}

console.log('\n[3] **되돌아가지 않는다** — 문 앞에서 좌우로 갈랐다 돌아오면 그건 안내가 아니다');
{
  // ★ 실제로 났던 것: 문은 두 방이 맞닿은 자리라 문 위의 점이 **양쪽 다**
  //   참이었다. 그래서 조종석·기관실 문에서 (0,10)→(0.6,10)→(-0.6,10) 처럼
  //   문틀을 따라 갈랐다 되돌아왔다. 꺾임 각이 90도를 넘으면 그거다
  let sharp = 0, worst = '';
  for (const r of ROOMS) for (const g of [{ x: 0, z: 15.1 }, { x: 0, z: -7.0 }, { x: -3.7, z: 0.6 }, { x: 3.0, z: 4.9 }]) {
    const path = pathTo({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 }, g, ROOMS, DOORS);
    for (let i = 1; i < path.length - 1; i++) {
      const ax = path[i].x - path[i - 1].x, az = path[i].z - path[i - 1].z;
      const bx = path[i + 1].x - path[i].x, bz = path[i + 1].z - path[i].z;
      const dot = (ax * bx + az * bz) / (Math.hypot(ax, az) * Math.hypot(bx, bz) || 1);
      if (dot < -0.2) { sharp++; if (!worst) worst = `${r.name} → (${g.x},${g.z})`; }
    }
  }
  ok(sharp === 0, `되짚는 꺾임이 없다 — ${sharp}군데 ${worst && `(${worst})`}`);
}

console.log('\n[4] 같은 방 안이면 **그냥 곧게** — 통로에 나갔다 오지 않는다');
{
  const p = pathTo({ x: 0, z: 5 }, { x: -0.8, z: 3.3 }, ROOMS, DOORS);
  console.log(`  통로 안에서 차단기까지 — 꺾은점 ${p.length}개`);
  ok(p.length === 2, '같은 방이면 두 점뿐이다');
  const q = pathTo({ x: -4.5, z: 0 }, { x: -3.7, z: 0.6 }, ROOMS, DOORS);
  ok(q.length === 2, '관측실 안에서 해도대까지도 두 점뿐이다');
}

console.log('\n[5] 가르침 글과 **같은 방**을 가리킨다 — 글은 관측실인데 선은 기관실이면 안 된다');
{
  const roomOf = (p) => ROOMS.find((r) => p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1)?.name;
  const MARKS = {
    chart: { x: -3.7, z: 0.6 }, breaker: { x: -0.8, z: 3.3 },
    valve: { x: 0, z: 15.1 }, yoke: { x: 0, z: -8.35 }, winch: { x: 3.0, z: 4.9 },
  };
  for (const [key, mark] of Object.entries(AIMS)) {
    const L = LESSONS.find((l) => l.key === key);
    const room = roomOf(MARKS[mark]);
    console.log(`  ${key.padEnd(7)} 「${L.where}」 → ${room}`);
    ok(!!room && L.where.includes(room),
      `${key} — 글이 말하는 방과 선이 가는 방이 같다 (${room})`);
  }
}

console.log('\n  ※ **보이나는 여기서 안 나온다.** 화살표가 바닥에 파묻혔는지도,');
console.log('     방향이 거꾸로인지도 여기서는 안 보인다 — space-chase.js 가');
console.log('     브라우저에서 보고, 「따라가고 싶어지나」는 직접 해 봐야 안다.\n');
process.exit(fail ? 1 : 0);
