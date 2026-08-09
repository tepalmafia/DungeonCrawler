// ══════════════════════════════════════════════════════════════════════════
//  수리 네 동작이 **손맛이 되나** — 브라우저 없이.
//
//    node tools/space-repair.js            숫자만 (1초)
//    node tools/space-repair.js --see 8391  + 손이 정말 그 모양인가
//
//  ★ 여기서 제일 중요한 것은 [1] **총 시간이 안 바뀌었나**다.
//    손맛을 넣자고 밸런스를 흔들면 층·회차 길이가 통째로 밀리고,
//    `space-sim`·`space-fault`·`space-route` 가 전부 어긋난다.
//    네 동작은 원래 있던 `hold` 초를 **나눠 가지는 것**이지 더하는 것이
//    아니다.
//
//  ★ 그리고 [3] **넷이 정말 다른가.** 같은 주먹을 네 번 쥐면 그건
//    손맛이 아니라 그냥 네 번 기다리는 것이다.
// ══════════════════════════════════════════════════════════════════════════
import { ACTS, ACT_KEYS, actAt, poseAt } from '../web/space/js/game/repair-table.js';
import { MISSIONS } from '../web/space/js/game/mission-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };

console.log('\n[1] ★ **총 시간이 안 바뀐다** — 네 동작은 나눠 가지는 것이다');
{
  const sum = ACTS.reduce((a, x) => a + x.share, 0);
  ok(Math.abs(sum - 1) < 1e-9, `몫을 다 더하면 1 이다 — ${sum.toFixed(4)}`);
  ok(ACTS.every((a) => a.share > 0.1),
    `어느 동작도 눈에 안 띌 만큼 짧지 않다 — ${ACTS.map((a) => a.share).join(' · ')}`);

  // 실제 고장 걸음들에 대 봐서 **제일 짧은 동작이 몇 초**인가.
  // 0.5초 밑이면 화면에서 못 알아본다
  const holds = MISSIONS.flatMap((m) => (m.steps ?? []).map((s) => s.hold)).filter(Boolean);
  const shortest = Math.min(...holds) * Math.min(...ACTS.map((a) => a.share));
  ok(shortest >= 0.5,
    `제일 짧은 걸음(${Math.min(...holds)}초)의 제일 짧은 동작이 ${shortest.toFixed(2)}초`);
}

console.log('\n[2] 순서대로 지나간다 — 조이기 전에 꽂는다');
{
  const HOLD = 8;
  const seen = [];
  for (let t = 0; t < HOLD; t += 0.05) {
    const k = actAt(t, HOLD).act.key;
    if (seen[seen.length - 1] !== k) seen.push(k);
  }
  ok(seen.join() === ACT_KEYS.join(), `${seen.join(' → ')}`);
  ok(actAt(0, HOLD).act.key === 'unbolt', '첫 동작은 볼트 풀기다');
  ok(actAt(HOLD - 0.01, HOLD).act.key === 'tighten', '마지막 동작은 조이기다');
  // 되돌아가면(놓으면) 동작도 되돌아가야 한다 — 손이 앞서 가면 거짓말이다
  ok(actAt(HOLD * 0.9, HOLD).i > actAt(HOLD * 0.2, HOLD).i, '놓아서 줄면 앞 동작으로 돌아간다');
}

console.log('\n[3] ★ **넷이 정말 다르다** — 같은 주먹 네 번이면 손맛이 아니다');
{
  const HOLD = 8;
  // 각 동작의 한복판에서 손 모양을 뜬다
  let acc = 0;
  const shots = ACTS.map((a) => {
    const at = (acc + a.share / 2) * HOLD;
    acc += a.share;
    return { key: a.key, pose: poseAt(at, HOLD) };
  });
  for (const s of shots) {
    console.log(`     ${s.key.padEnd(8)} 손가락 ${s.pose.fingers.map((v) => v.toFixed(2)).join(' ')}`
      + ` · 엄지 ${s.pose.thumb.toFixed(2)} · 돌림 ${s.pose.roll.toFixed(2)} · 밀기 ${s.pose.push.toFixed(2)}`);
  }
  // 손가락 평균이 서로 충분히 벌어져야 한다
  const avg = shots.map((s) => s.pose.fingers.reduce((a, v) => a + v, 0) / 4);
  let close = 0;
  for (let i = 0; i < avg.length; i++) for (let j = i + 1; j < avg.length; j++) {
    if (Math.abs(avg[i] - avg[j]) < 0.1 && Math.abs(shots[i].pose.roll - shots[j].pose.roll) < 0.5
      && Math.abs(shots[i].pose.push - shots[j].pose.push) < 0.05) close++;
  }
  ok(close === 0, `모양이 겹치는 짝 ${close} 쌍 — 손가락·손목·밀기 셋 중 하나는 달라야 한다`);

  // **펴는 동작이 하나는 있어야** 한다. 다 쥐면 손이 하나로 뭉갠다
  ok(avg.some((v) => v < 0.3), `손을 펴는 동작이 있다 — 제일 편 것 ${Math.min(...avg).toFixed(2)}`);
  // **돌리는 동작 둘이 반대**여야 한다 — 풀기와 조이기
  const un = ACTS.find((a) => a.key === 'unbolt').pose.roll;
  const ti = ACTS.find((a) => a.key === 'tighten').pose.roll;
  ok(un * ti < 0, `푸는 방향과 조이는 방향이 반대다 — ${un} / ${ti}`);
}

console.log('\n[4] 동작 이름이 **말로 나온다** — 손만 바뀌면 뭘 하는지 모른다');
{
  ok(ACTS.every((a) => a.what && /다$/.test(a.what)),
    `넷 다 동사로 끝난다 — ${ACTS.map((a) => a.what).join(' · ')}`);
  ok(new Set(ACTS.map((a) => a.what)).size === ACTS.length, '네 말이 서로 다르다');
}

// ══════════════════════════════════════════════════════════════════════════
//  여기부터는 **손**이다 — `--see` 를 줬을 때만 돈다.
//
//  ★ 위의 넷은 **표**가 넷이라는 것만 말한다. 표가 아무리 예뻐도
//    `world/hands.js` 가 그걸 안 읽으면 화면에서는 아무 일도 안 난다 —
//    그리고 그런 「되는데 안 보이는」 것을 이 저장소에서 여러 번 만났다.
// ══════════════════════════════════════════════════════════════════════════
const see = process.argv.indexOf('--see');
if (see >= 0) {
  const PORT = process.argv[see + 1] || '8391';
  const SP = process.env.SHOTS || null;
  let chromium = null;
  for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ }
  }
  if (!chromium) { console.error('playwright 가 없습니다.'); process.exit(2); }
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 380 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  const S = (fn, a) => p.evaluate(fn, a);
  const until = async (fn, sec, note, arg) => {
    const t0 = Date.now();
    while (Date.now() - t0 < sec * 1000) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(400); }
    console.log(`     (${note} 기다리다 지침)`);
    return false;
  };
  await p.click('#btn-play').catch(() => p.mouse.click(320, 190));
  await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });

  console.log('\n[5] ★ 손이 **정말 그 모양이 되나** — 표만 넷이면 화면에는 없다');
  {
    // 고장을 하나 띄우고 그 방 패널 앞에 선다
    ok(!!(await S(() => SPACE.forceFault())), '고장을 하나 띄운다');
    const open = await S(() => SPACE.faults.open);
    const room = open?.[0]?.at ?? 'workshop';
    const at = await S((r) => SPACE.panelAt(r), room);
    ok(!!at, `${room} 패널 (${at?.x}, ${at?.z})`);

    // 패널 앞 0.8m 에 서서 정확히 겨눈다
    const sx = at.x - Math.sin(at.ry) * 0.85, sz = at.z - Math.cos(at.ry) * 0.85;
    const yaw = Math.atan2(-(at.x - sx), -(at.z - sz));
    const pitch = Math.atan2(1.18 - 1.62, Math.hypot(at.x - sx, at.z - sz));
    await S(([a, c, y, q]) => SPACE.put(a, c, y, q), [sx, sz, yaw, pitch]);
    await until(([a, c]) => {
      const w = SPACE.camera.getWorldPosition(new SPACE.THREE.Vector3());
      return Math.abs(w.x - a) < 0.06 && Math.abs(w.z - c) < 0.06;
    }, 20, '카메라가 따라오는 것', [sx, sz]);
    const aimed = await until(() => /^panel:/.test(SPACE.aim ?? ''), 20, '패널 조준');
    ok(aimed, `패널이 잡힌다 — aim=${await S(() => SPACE.aim) ?? '없음'}`);

    if (aimed) {
      // 잡고 있는 동안 **손 모양을 훑는다.**
      //
      // ★ 시간으로는 못 훑는다. 헤드리스는 게임 시간이 실시간의 20분의 1
      //   이라 5초짜리 걸음이 100초, 네 동작을 다 보려면 그 이상이다.
      //   처음엔 70초를 기다렸는데 **첫 동작 하나밖에 못 봤고**, 그건
      //   게임이 아니라 검사의 한계였다. 그래서 **잡은 시간을 밀어 넣으며**
      //   훑는다 — 재는 것은 「시간이 맞나」(그건 [1] 이 봤다)가 아니라
      //   **「손이 따라오나」**다
      await S(() => dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
      await p.waitForTimeout(1200);
      const need = (await S(() => SPACE.repair)).need ?? 5;
      const seen = new Map();
      for (const frac of [0.15, 0.45, 0.7, 0.93]) {
        await S((v) => SPACE.seekRepair(v), need * frac);
        await p.waitForTimeout(1400);        // 손이 따라오도록 몇 프레임
        const r = await S(() => SPACE.repair);
        if (r.act && r.pose) seen.set(r.act, r);
      }
      await S(() => dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
      ok(seen.size === 4, `네 동작을 다 봤다 (${seen.size}) — ${[...seen.keys()].join(' · ')}`);
      for (const [k, r] of seen) {
        console.log(`     ${k.padEnd(8)} 「${r.what}」 손가락 ${r.pose.fingers.join(' ')}`
          + ` · 쥠 ${r.hand.grip} · 돌림 ${r.hand.roll} · 밀기 ${r.hand.push}`);
      }
      // ★ **손이 실제로 따라왔나.** 표는 바뀌는데 `hands.at` 이 그대로면
      //   그게 「되는데 안 보이는」 것이다
      const rolls = [...seen.values()].map((r) => r.hand.roll);
      const pushes = [...seen.values()].map((r) => r.hand.push);
      ok(new Set(rolls).size > 1, `손목이 동작마다 달리 돌았다 — ${rolls.join(' / ')}`);
      ok(new Set(pushes).size > 1, `앞뒤로 미는 것도 달랐다 — ${pushes.join(' / ')}`);
      // 손가락도 실제로 달라야 한다. 표만 다르고 손이 같으면 소용없다
      const grips = [...seen.values()].map((r) => r.pose.fingers.reduce((a, v) => a + v, 0) / 4);
      ok(Math.max(...grips) - Math.min(...grips) > 0.2,
        `손가락도 폈다 쥐었다 한다 — ${grips.map((v) => v.toFixed(2)).join(' / ')}`);
      if (SP) await p.screenshot({ path: `${SP}/수리동작.png`, timeout: 90000 });
    }
  }

  if (errs.length) { console.log('콘솔 오류:'); for (const e of errs.slice(0, 5)) console.log('  ' + e); fail += errs.length; }
  await b.close();
  if (SP) console.log(`\n  (${SP}/수리동작.png 저장)`);
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
process.exit(fail ? 1 : 0);
