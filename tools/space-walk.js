// ══════════════════════════════════════════════════════════════════════════
//  걸어 다녀 보기 — 충돌과 이동만 재는 검사.
//
//    python3 tools/serve.py 8391 &
//    node tools/space-walk.js [포트]
//
//  ★ 왜 이 검사가 생겼나 (2026-08-03 실사고)
//    조종석·통로·기관실을 스크린샷으로 하나씩 확인하고 「다 됐다」고
//    보고했다. 그런데 사장님이 켜 보시니 **조종석에서 나갈 수가 없었다.**
//
//    원인: 설 수 있는 자리를 「어느 한 방의 사각형 안, 반지름만큼 여유」로
//    봤다. 방 하나만 보면 맞는데, 방과 방이 만나는 문턱에서 **아무 방에도
//    안 속하는 띠**가 생긴다. 문이 뚫려 있는데 못 지나간다.
//
//    나는 순간이동(SPACE.put)으로 방마다 찍어 보기만 하고 **한 번도 걸어서
//    가 보지 않았다.** 화면으로는 절대 안 보이는 종류다
//    (docs/POSTMORTEM.md §1-③).
//
//    그래서 이 검사는 **걸어서 닿는지**를 본다 — 시작 자리에서 넓혀 가며
//    배 전체를 훑고, 기관실에 닿는 칸을 센다.
//
//  ★ 여기서 「몇 미터 갔나」를 재지 않는다
//    헤드리스는 소프트웨어 렌더라 1fps 쯤 나온다. dt 를 0.05 로 자르므로
//    **느린 프레임 = 느린 게임 시간**이고, 거리는 실제 브라우저와 아무
//    상관이 없다. 입력이 이동으로 이어지는지와 방향만 본다.
// ══════════════════════════════════════════════════════════════════════════
const PW = ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs'];
let chromium = null;
for (const m of PW) { try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ } }
if (!chromium) {
  console.error('playwright 가 없습니다.  npm i -g playwright  뒤에 다시 돌리세요.');
  process.exit(2);
}
const PORT = process.argv[2] || '8391';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);

let fail = 0;
const ok = (c, msg) => { console.log((c ? '  ✔ ' : '  ✘ ') + msg); if (!c) fail++; };

console.log('\n[1] 「이동이 안 된다」 — 화면 한가운데(안내 창 위)를 눌러 시작되나');
await p.mouse.click(640, 360);                       // 안내 창이 덮고 있는 자리
await p.waitForTimeout(300);
ok(await p.evaluate(() => SPACE.locked), '가운데를 눌렀더니 포인터 잠금이 걸린다');

// 헤드리스는 소프트웨어 렌더라 프레임이 느리다. dt 를 0.05 로 자르므로
// **느린 프레임 = 느린 게임 시간**이다 — 실제 브라우저 속도가 아니다.
const fps = await p.evaluate(() => new Promise(res => {
  let n = 0; const t0 = performance.now();
  const tick = () => { if (++n < 30) requestAnimationFrame(tick); else res(Math.round(n * 1000 / (performance.now() - t0))); };
  requestAnimationFrame(tick);
}));
console.log(`  (헤드리스 프레임 ${fps}fps — 실제 브라우저보다 훨씬 느리다)`);

const before = await p.evaluate(() => SPACE.pos);
await p.keyboard.down('KeyS');   // 시작할 때 앞은 콘솔이다. 뒤(통로 쪽)로 걷는다
await p.waitForTimeout(4000);
await p.keyboard.up('KeyS');
await p.waitForTimeout(100);
const after = await p.evaluate(() => SPACE.pos);
const moved = Math.hypot(after.x - before.x, after.z - before.z);
// ★ 여기서 거리를 재지 않는다. 1fps 면 4초에 게임 시간은 0.2초뿐이라
//   「몇 미터 갔나」가 실제 브라우저와 아무 상관이 없다. 입력이 이동으로
//   이어지는지, 방향이 맞는지만 본다. **걸어서 갈 수 있나는 [3] 이 답한다.**
ok(moved > 0.2, `S 가 이동으로 이어진다 (${moved.toFixed(2)}m — 1fps 라 거리는 의미 없음)`);
ok(after.z > before.z, `방향이 맞다 — 뒤로 누르면 통로 쪽(+z)으로 간다`);

console.log('\n[2] 충돌 — 물건을 뚫고 지나가나');
console.log(`  (막는 것 ${await p.evaluate(() => SPACE.blockers)}개 등록됨)`);
const CASES = [
  [0, 12.60, false, '기관실 반응로'],
  [1.80, 12.60, true, '반응로 옆 — 지나갈 수 있어야 한다'],
  [4.30, 13.00, false, '기관실 오른쪽 랙'],
  [0, 14.20, true, '기관실 가운데'],
  [0, 15.70, false, '기관실 뒷벽 밸브'],
  [3.00, -8.60, false, '캐노피 밖 (우주로 걸어 나가는 자리)'],
  [0, -8.60, false, '조종석 콘솔'],
  [1.05, -6.95, false, '조종석 좌석'],
  [0, -5.40, true, '조종석 가운데'],
  [0, 8.00, true, '통로 가운데'],
  [1.15, 8.00, false, '통로 벽 (곁방이 없는 자리)'],
  [-2.30, 0.60, true, '관측실'],
  [-3.70, 0.60, false, '관측실 해도대'],
  [3.00, 0.60, true, '정비실'],
  [4.50, 0.60, false, '정비실 작업대'],
  [-2.40, 5.20, true, '온실'],
  [-4.10, 5.15, false, '온실 재배대'],
  [2.80, 5.70, true, '에어록'],
];
// ★ **문을 열어 놓고 잰다.** v23 부터 문은 가까이 가야 열리는데, 격자로
//   훑는 이 검사는 「가까이 간다」를 못 흉내낸다 — 그대로 두면 곁방이 전부
//   「못 간다」로 나온다. 사람은 걸어가면 열리므로 그건 거짓 실패다.
//   문이 실제로 열리고 막는지는 tools/space-door.js 와 space-chase.js 가 잰다
await p.evaluate(() => SPACE.openDoors());
await p.waitForTimeout(600);

for (const [x, z, want, name] of CASES) {
  const got = await p.evaluate(([x, z]) => SPACE.canStand(x, z), [x, z]);
  ok(got === want, `${name}  (${x}, ${z}) → ${got ? '설 수 있다' : '막힌다'}`);
}

console.log('\n[3] 방마다 걸어서 닿나 — 시작 자리에서 넓혀 가며 훑는다');
// ★ 손으로 찍은 점보다 이게 낫다. 방을 옮기거나 물건을 늘려도 검사가
//   그대로 유효하고, **못 들어가는 방**을 놓치지 않는다.
const reach = await p.evaluate(() => {
  const S = 0.25, seen = new Set(), q = [[0, -5.4]];
  const key = (x, z) => `${Math.round(x / S)},${Math.round(z / S)}`;
  seen.add(key(0, -5.4));
  const per = {};
  while (q.length) {
    const [x, z] = q.pop();
    const r = SPACE.room(x, z);
    if (r) per[r] = (per[r] || 0) + 1;
    for (const [dx, dz] of [[S, 0], [-S, 0], [0, S], [0, -S]]) {
      const nx = x + dx, nz = z + dz, k = key(nx, nz);
      if (seen.has(k) || !SPACE.canStand(nx, nz)) continue;
      seen.add(k); q.push([nx, nz]);
    }
  }
  return { per, rooms: SPACE.rooms };
});
for (const r of reach.rooms) {
  const n = reach.per[r.key] || 0;
  ok(n > 20, `${r.name.padEnd(4)} 닿는 칸 ${String(n).padStart(4)}`);
}

console.log(errs.length ? `\n오류: ${errs.join(' / ')}` : '\n오류 없음');
console.log(fail ? `\n✘ ${fail}개 실패` : '\n✔ 전부 통과');
await b.close();
process.exit(fail ? 1 : 0);
