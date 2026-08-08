// ══════════════════════════════════════════════════════════════════════════
//  조종간이 **보이고 · 잡히고 · 먹나** — 실제 브라우저에서 확인한다.
//
//    python3 tools/serve.py 8391 &
//    node tools/space-yoke.js
//
//  ★ 왜 이 검사를 따로 냈나 (2026-08-05 · 사장님 「조정간이 안잡히잔아」)
//    v29 까지 조종간은 좌석 **앞**에 둘 있었다. 그런데
//      · 좌석 등받이(1.24)가 가려서 **서 있는 눈높이에서 한 번도 안 보였고**
//      · 조준 판정 상자는 폭 2.8m 짜리 **통짜**라, 아무것도 없는 콘솔
//        표면을 겨눠도 `yoke` 라고 나왔다
//    즉 **보이는 것과 잡히는 것이 달랐다.** `space-fly.js` 는 「조종간을
//    잡으면 배가 기우나」만 봤으므로 (SPACE.hold 로 눌러 놓고 쟀다)
//    이 사고를 **끝까지 초록으로 통과시켰다.**
//
//    그래서 이 검사는 셋을 **따로** 묻는다:
//      [1] 눈에 보이나   — 카메라에서 쏜 광선의 **첫 물건**이 조종간인가
//      [2] 겨눈 데만 잡히나 — 옆·아래를 겨누면 `yoke` 가 **아니어야** 한다
//      [3] 밀면 먹나     — 잡고 돌리면 배가 기우는가
//    [1] 과 [2] 가 갈라져 있어야 같은 사고가 다시 안 지나간다.
// ══════════════════════════════════════════════════════════════════════════
const PW = ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs'];
let chromium = null;
for (const m of PW) { try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ } }
if (!chromium) {
  console.error('playwright 가 없습니다.  npm i -g playwright  뒤에 다시 돌리세요.');
  process.exit(2);
}
const PORT = process.argv[2] || '8391';
const SP = process.env.SHOTS || null;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 640, height: 380 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const S = (fn, a) => p.evaluate(fn, a);
const until = async (fn, sec = 40, note = '', arg, each = null) => {
  const t0 = Date.now();
  while (Date.now() - t0 < sec * 1000) {
    if (await p.evaluate(fn, arg)) return true;
    if (each) await each();
    await p.waitForTimeout(500);
  }
  console.log(`     (${note} 기다리다 지침)`);
  return false;
};
await p.mouse.move(320, 190);
await p.mouse.click(320, 190);
await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });

// ★ **자리를 옮기고 기다리면 안 된다 — 카메라가 따라올 때까지 기다린다.**
//   `SPACE.put` 은 사람 좌표만 바꾸고, 카메라는 **다음 프레임에** 따라온다.
//   헤드리스는 소프트웨어 렌더라 1초에 한 프레임 남짓이므로 「0.4초 기다림」
//   으로는 한 프레임도 안 지나간다 — **이전 자리의 조준 결과를 그대로
//   읽고** 검사가 초록이 되거나 빨강이 된다. 실제로 이 검사가 처음에
//   「콘솔 왼쪽을 겨눠도 조종간이 잡힌다」로 나왔는데, 게임이 아니라
//   여기가 틀린 것이었다.
const stand = async (x, z, yaw, pitch) => {
  await S(([a, b, c, d]) => SPACE.put(a, b, c, d), [x, z, yaw, pitch]);
  await until(([a, b]) => {
    const q = SPACE.camera.getWorldPosition(new SPACE.THREE.Vector3());
    return Math.abs(q.x - a) < 0.02 && Math.abs(q.z - b) < 0.02;
  }, 20, '카메라가 따라오는 것', [x, z]);
};

// ── 눈에서 쏜다 ────────────────────────────────────────────────────────
// **카메라가 실제로 보는 방향**으로 쏘고, 부딪힌 것을 가까운 것부터 준다.
// 안 보이는 판정 상자는 걸러낸다 — 눈은 그걸 못 본다
const SEE = `(() => {
  const T = SPACE.THREE, cam = SPACE.camera;
  const dir = new T.Vector3(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(new T.Quaternion()));
  const ray = new T.Raycaster(cam.getWorldPosition(new T.Vector3()), dir, 0.05, 6);
  const out = [];
  for (const h of ray.intersectObject(SPACE.shipGroup, true)) {
    if (h.object.material?.visible === false) continue;
    let n = h.object, name = '';
    while (n && !name) { name = n.name; n = n.parent; }
    out.push({ name: name || '?', d: +h.distance.toFixed(2) });
  }
  return out;
})()`;
const isYoke = (n) => /조종간/.test(n);

console.log('\n[1] **눈에 보이나** — ★ v61 부터는 **앉아서** 본다');
{
  // ══ ★★ **묻는 것이 바뀌었다** (v61) ══════════════════════════════
  //  여태 「**서서** 조종간이 제일 먼저 걸리나」를 물었다. 그때는 좌석이
  //  둘이라 가운데가 비어 있었으므로 그 질문이 맞았다.
  //
  //  사장님이 「좌석은 센터에 있어야지. 조정석 뒤에」라고 하셨고, 좌석을
  //  한가운데 놓으니 **등받이가 조종간을 가린다** — 서서는 못 잡는다.
  //  지난번엔 좌석을 옆으로 밀어 피했는데 그건 푼 게 아니다.
  //
  //  ★ 실제 조종석은 **앉은 눈이 올 자리(DEP)** 부터 잡는다. 그러면 답이
  //    하나다 — **앉고 나서 잡는다.** 그래서 이 검사도 **앉혀 놓고** 묻는다.
  //    안 고쳤으면 도구가 「서서 잡히는 조종석」이라는 **틀린 설계를
  //    지켰을 것이다** (이 저장소에서 열두 번째다).
  await S(() => SPACE.putHelmSit(true));
  await new Promise((r) => setTimeout(r, 900));
  // ★ 고개 각도를 손으로 못박지 않는다. 못박으면 조종간을 옮길 때마다
  //   검사가 같이 틀리고, 그러면 「고개를 몇 도 숙여야 보이나」라는
  //   **엉뚱한 것**을 재게 된다. 여기서 묻는 것은 하나다 —
  //   **조종간을 똑바로 보면 조종간이 제일 먼저 걸리나.**
  // 앉은 자리에서, 조종간을 향해 고개를 조금 숙인 자세
  await stand(0, -7.75, 0, -0.50);
  const seen = await S(`(() => {
    const T = SPACE.THREE, cam = SPACE.camera;
    const from = cam.getWorldPosition(new T.Vector3());
    const to = new T.Vector3(0, 0.84, -8.80);   // ★ v66 — DEP 에서 계산된 자리
    const ray = new T.Raycaster(from, to.clone().sub(from).normalize(), 0.05, 6);
    const out = [];
    for (const h of ray.intersectObject(SPACE.shipGroup, true)) {
      if (h.object.material?.visible === false) continue;
      let n = h.object, name = '';
      while (n && !name) { name = n.name; n = n.parent; }
      out.push({ name: name || '?', d: +h.distance.toFixed(2) });
    }
    return out;
  })()`);
  ok(!!seen[0] && isYoke(seen[0].name),
    `★ **앉아서** 보면 조종간이 제일 먼저 걸린다 — ${seen.slice(0, 3).map((h) => `${h.name}(${h.d})`).join(' · ') || '아무것도 안 걸림'}`);

  // ★ **고개를 자연스럽게 숙인 범위**에서 화면 한가운데에 들어오나.
  //   위 검사는 「똑바로 보면」이고 이건 「눈이 가는 자리에 있나」다.
  //   둘 다 있어야 「있긴 한데 찾아야 보인다」를 잡는다
  const band = [];
  // ★ v61 — **앉은 자리에서** 쓸어 본다. 서 있는 자리(z −5.6)에서 재면
  //   좌석 등받이가 가려서 영영 안 걸린다 — 그건 조종간이 나쁜 게 아니라
  //   **서서 잡으려 한 것**이 잘못이다
  for (const pitch of [-0.10, -0.20, -0.30, -0.40, -0.50, -0.60]) {
    await stand(0, -7.75, 0, pitch);
    const hit = await S(SEE);
    if (hit[0] && isYoke(hit[0].name)) band.push(pitch);
  }
  ok(band.length >= 2,
    `고개를 조금 숙이면 한가운데 온다 — ${band.length ? band.map((v) => v.toFixed(2)).join(' · ') : '어느 각도에서도 안 걸림'}`);
}

console.log('\n[2] **겨눈 데만 잡히나** — 통짜 판정 상자가 아니어야 한다');
{
  await stand(0, -5.9, 0, -0.22);
  const got = await until(() => SPACE.aim === 'yoke', 20, '조종간 조준');
  ok(got, `가운데를 겨누면 잡힌다 — aim=${await S(() => SPACE.aim)}`);

  // 콘솔 왼쪽 끝 — 전에는 여기도 `yoke` 였다 (폭 2.8m 통짜)
  await stand(-1.9, -7.75, 0, -0.45);
  const left = await S(() => SPACE.aim);
  ok(left !== 'yoke', `콘솔 왼쪽을 겨누면 안 잡힌다 — aim=${left ?? '없음'}`);

  await stand(1.9, -7.75, 0, -0.45);
  const right = await S(() => SPACE.aim);
  ok(right !== 'yoke', `콘솔 오른쪽을 겨누면 안 잡힌다 — aim=${right ?? '없음'}`);

  // 위(창밖)를 보면 안 잡힌다 — 조준선이 배 밖으로 나간다
  await stand(0, -5.9, 0, 0.35);
  const up = await S(() => SPACE.aim);
  ok(up !== 'yoke', `창밖을 보면 안 잡힌다 — aim=${up ?? '없음'}`);
}

console.log('\n[3] **밀면 먹나** — 잡고 돌리면 배가 기운다');
{
  await stand(0, -5.9, 0, -0.22);
  await until(() => SPACE.aim === 'yoke', 20, '다시 조준');
  const yaw0 = (await S(() => SPACE.look)).yaw;
  const before = await S(() => SPACE.fly.lane);
  // ★ **Playwright 의 마우스를 안 쓴다.** 두 번 데였다:
  //   ① `keyboard.down('KeyD')` — 조종은 키가 아니라 `look.dx` 를 읽는다.
  //      아무 일도 안 났고, 게임이 아니라 검사가 틀린 것이었다.
  //   ② `mouse.down()` — 포인터 잠금 상태에서 좌표를 같이 보내는데 그게
  //      movementX 로 들어와 **시야가 홱 돌아간다.** 누르는 그 순간
  //      조종간을 놓쳐서 `aim` 이 null 이 되고, 「조종간이 안 먹는다」로
  //      보였다. 뒤이은 `mouse.move` 는 아예 movementX 를 안 만들었다.
  //   그래서 **게임이 실제로 듣는 이벤트**를 그대로 만들어 보낸다.
  //   우회가 아니다 — input.js 의 listener 를 지나가므로 경로는 같다
  await S(() => dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
  const push = () => S(() => {
    for (let i = 0; i < 6; i++) dispatchEvent(new MouseEvent('mousemove', { movementX: 30, movementY: 0 }));
  });
  await push();
  const moved = await until(() => Math.abs(SPACE.fly.lane) > 0.05, 25, '배가 기우는 것', null, push);
  const after = await S(() => SPACE.fly.lane);
  const yaw1 = (await S(() => SPACE.look)).yaw;
  await S(() => dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
  ok(moved, `잡고 밀면 배가 옆으로 간다 — lane ${before} → ${after}`);
  // 시야가 안 돌아야 한다 (FLYING.md §3-B). 조종간을 미는 동안 마우스는
  // **배를 움직이지 고개를 안 돌린다**. 여기가 흔들리면 조준이 풀려서
  // 미는 도중에 손이 떨어진다 — 실제로 그것 때문에 위가 안 됐었다
  ok(Math.abs(yaw1 - yaw0) < 0.05, `미는 동안 고개가 안 돌아갔다 — yaw ${yaw0} → ${yaw1}`);
}

console.log('\n[4] 앞을 가로지르는 것이 없나 — 조종간은 **가려지면 없는 것**이다');
{
  // 서 있는 눈에서 조종간까지, 좌우로 조금씩 흔들며 쏜다.
  // 하나라도 조종간이 아닌 것이 먼저 걸리면 그건 가로막은 물건이다
  const blocked = await S(() => {
    const T = SPACE.THREE, out = [];
    for (const dx of [-0.2, -0.1, 0, 0.1, 0.2]) {
      // ★ v61 — **앉은 눈**에서 쏜다 (helm-table.js HELM_SEAT.eye 1.20).
      //   서 있는 눈(1.62 · z −5.6)에서 재면 좌석 등받이가 늘 먼저 걸린다
      const from = new T.Vector3(dx, 1.20, -8.30);
      const to = new T.Vector3(0, 0.84, -8.80);   // ★ v66 — DEP 에서 계산된 자리
      const dir = to.clone().sub(from).normalize();
      const ray = new T.Raycaster(from, dir, 0.05, from.distanceTo(to) - 0.12);
      for (const h of ray.intersectObject(SPACE.shipGroup, true)) {
        if (h.object.material?.visible === false) continue;
        let n = h.object, name = '';
        while (n && !name) { name = n.name; n = n.parent; }
        if (!out.includes(name)) out.push(name || '?');
      }
    }
    return out;
  });
  ok(blocked.length === 0, `막는 것이 없다 — ${blocked.join(' · ') || '없음'}`);
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[5] ★★★ **잡으면 창이 화면을 채우나** (v63 · 사장님 요청)');
{
  //  「조정간을 잡으면 **전체 화면으로 나오게** 해야지. 앉기만 하니깐
  //   우주가 안보여서 운전을 못하고」
  //
  //  ★★ 재고 나서 원인이 나왔다: v59 의 「잡으면 들여다본다」(FOCUS)가
  //     **조종간에도 걸려 있었다.** 화각을 72 → 45 로 **좁힌다** —
  //     계기를 읽으려고 만든 것이 모는 것에도 걸려 밖을 더 못 보게 했다.
  //     손잡이를 **읽는 것 / 모는 것**으로 가르는 것이 v63 이 한 일이다.
  await S(() => { SPACE.putHelmSit(true); });
  await stand(0, -7.75, 0, -0.45);
  const before = await S(() => ({
    fov: +SPACE.camera.fov.toFixed(1),
    y: +SPACE.camera.getWorldPosition(new SPACE.THREE.Vector3()).y.toFixed(3),
    pitch: +SPACE.camera.rotation.x.toFixed(3),
    aim: SPACE.aim,
  }));
  ok(before.aim === 'yoke', `앉아서 조종간이 잡힌다 (「${before.aim}」)`);
  // ★★ **`p.mouse.down()` 을 안 쓴다.** 바로 위 [3] 에 그 이유가 적혀 있는데
  //   내가 이 절을 새로 쓰면서 안 지켰고, 검사가 **거기서 멈췄다.**
  //   적어 둔 규약을 안 읽으면 적어 둔 값이 없다
  await S(() => dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
  // ★ 페이지 안에서 rAF 로 기다린다 — 밖에서 초로 기다리면 헤드리스 시계가
  //   실제의 1/20 이라 안 끝난다 (v62 에서 세 번 겪었다)
  await S(() => new Promise((res) => {
    let i = 0;
    const tick = () => { if (++i >= 50) return res(1); requestAnimationFrame(tick); };
    tick();
  }));
  const held = await S(() => ({
    fov: +SPACE.camera.fov.toFixed(1),
    y: +SPACE.camera.getWorldPosition(new SPACE.THREE.Vector3()).y.toFixed(3),
    pitch: +SPACE.camera.rotation.x.toFixed(3),
    steering: SPACE.hazard?.steering ?? null,
  }));
  await S(() => dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
  console.log(`   화각 ${before.fov} → ${held.fov} · 눈높이 ${before.y} → ${held.y} · 고개 ${before.pitch} → ${held.pitch}`);
  ok(held.steering === true, '★ 잡으면 조종 중이 된다');
  ok(held.fov > before.fov + 8,
    `★★★ 잡으면 화각이 **넓어진다** (${before.fov} → ${held.fov}) — v62 까지는 45 로 **좁아졌다.**`
    + ' 계기를 읽는 손잡이와 모는 손잡이는 정반대여야 한다');
  ok(held.y > before.y + 0.1,
    `★★ 눈이 **뜬다** (${before.y} → ${held.y}) — 눈썹 차양(1.12) 위로 올라간다`);
  ok(held.pitch > before.pitch + 0.15,
    `★★ 고개가 **들린다** (${before.pitch} → ${held.pitch}) — 조종간을 보려고 숙인 만큼 게임이 들어 준다`);
  await S(() => SPACE.putHelmSit(false));
}

if (SP) {
  await stand(0, -7.05, 0, -0.45);
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${SP}/조종간.png` });
  console.log(`\n  (${SP}/조종간.png 저장)`);
}

console.log('');
if (errs.length) { console.log('콘솔 오류:'); for (const e of errs.slice(0, 5)) console.log('  ' + e); fail += errs.length; }
else console.log('오류 없음');
console.log(fail ? `\n✘ ${fail} 군데` : '\n✔ 전부 통과');
await b.close();
process.exit(fail ? 1 : 0);
