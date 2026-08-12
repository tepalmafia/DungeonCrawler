// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **화면을 누가 얼마나 먹나** (v103)
//
//    python3 tools/serve.py 8391 &
//    node tools/space-screen.js
//
//  ★ 사장님 「**광학창이랑 배 상태창이랑 레이더 등이 화면을 너무 가리는데?
//    전투화면이 더 광할하고 방해되지 않는 선에서 재배치**해줘」
//
//  ══ 왜 진짜 브라우저인가 ══════════════════════════════════════════════
//
//  「가린다」는 **화면의 말**이다. 뼈대만 재는 도구는 「판이 어디 있나」는
//  알아도 「그 판이 하늘의 어디를 덮나」는 모른다 — 그건 **진짜 카메라와
//  진짜 메시**를 투영해야 나온다 (`space-align.js` 와 같은 규약).
//
//  ★★ 그리고 **판이 아니라 그룹인 것이 있다** (광학창). 처음에
//    `geometry.parameters` 로 재다가 광학창이 **화면의 95%**라는 값을 얻고
//    하마터면 그 숫자로 자리를 옮길 뻔했다 — 그룹은 크기가 거기 없다.
//    `Box3` 로 고쳤다. **재는 것이 화면과 다르면 그 숫자로 고치면 안 된다**
// ══════════════════════════════════════════════════════════════════════════
import {
  CONE, BUDGET, PANELS, VIEWS, hitsCone, isCut, overlaps, inCorner,
} from '../web/space/js/game/screen-table.js';

const PORT = process.env.PORT ?? '8391';
let chromium = null;
for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
  try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ }
}
if (!chromium) { console.log('playwright 가 없습니다'); process.exit(0); }

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

console.log('화면을 누가 얼마나 먹나 — 진짜 카메라 · 진짜 메시');

const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!globalThis.SPACE, null, { timeout: 60000 });
  const S = (f, a) => p.evaluate(f, a);

  await S(() => SPACE.clearSave());
  await p.click('#btn-play').catch(() => {});
  await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });
  await p.waitForTimeout(1200);
  // ══ ★★★ v114 — **앉히는 절차를 걷어냈다** ═══════════════════════
  //
  //  ★ 여기 「좌석으로 걸어가 → 마우스로 조종간을 잡는다」가 열 줄쯤
  //    있었다. **v110 부터 그건 없는 절차다** — 사장님이 「항상 앉은
  //    상태에서 모든 조작을 한다. 가 기본이야」라고 하셨고 `PILOT.canStand`
  //    가 false 다. 그런데 검사는 그 절차를 계속 밟고 있었고, `SPACE.put`
  //    이 눈을 **좌석 뒤로 옮겨 놓아** 판이 죄다 위로 뜬 값이 나왔다.
  //    「계기가 하늘 한복판에 있다」는 거짓 경보가 거기서 났다.
  //  ★★ **없어진 절차를 밟는 검사는 없는 것을 잰다.** 이 저장소가 v110 에
  //    죽은 계통을 재던 도구를 스물두 개 찾아낸 것과 같은 병이다.
  ok(await S(() => SPACE.helm2.k) > 0.9,
    '★★ **켜자마자 앉아 있다** — 계기가 다 켜진 채로 시작한다 (v110)');

  // ══ ★★★ v114 — **창 크기를 다섯으로 쓸어 본다** ═══════════════════
  //
  //  ★ 사장님 「**화면 uhd 정렬좀해 시야를 안가리게**」
  //
  //  ★★ v103 은 1280×760 **한 창에서만** 재고 고쳤다. 그런데 화면 가로
  //    좌표에만 aspect 가 들어가므로, 넓은 창에서는 판이 하늘 복판으로
  //    걸어 들어오고 좁은 창에서는 밖으로 걸어 나간다 — **한 창만 재는
  //    검사는 절반**이다 (v98 의 「정면만 보면 안 잡힌다」와 같은 종류).
  for (const v of VIEWS) {
    await p.setViewportSize({ width: v.w, height: v.h });
    await p.waitForTimeout(350);
    const P = await S(() => SPACE.panels());
    console.log(`\n══ ${v.w}×${v.h} (${(v.w / v.h).toFixed(2)}:1) — ${v.what}`);
    console.log('   판        복판 (x, y)      넓이     덮는 각      원뿔  잘림');
    let sum = 0;
    for (const name of Object.keys(PANELS)) {
      const q = P[name];
      if (!q) { console.log(`   ${name}  — 안 보인다`); continue; }
      if (name !== '조준경') sum += q.area;
      console.log(`   ${name}  (${String(q.cx).padStart(6)},${String(q.cy).padStart(6)})`
        + `  ${(q.area * 100).toFixed(1).padStart(5)}%`
        + `  ${String(q.degH).padStart(5)}×${String(q.degV).padEnd(5)}°`
        + `  ${hitsCone(q) ? '★건드림' : '  비었음'}`
        + `  ${isCut(q) ? '★잘림' : '   —'}`);
    }
    const intruders = Object.entries(PANELS)
      .filter(([n, sp]) => !sp.inCone && P[n] && hitsCone(P[n])).map(([n]) => n);
    ok(!intruders.length,
      `★★★ 전투 원뿔(${CONE})이 비었다${intruders.length ? ` — ${intruders.join(' · ')} 가 들어와 있다` : ''}`);
    const cut = Object.keys(PANELS).filter((n) => P[n] && isCut(P[n]));
    ok(!cut.length, `★★★ 잘린 판이 없다${cut.length ? ` — ${cut.join(' · ')}` : ''}`);
    ok(sum <= BUDGET, `★★ 계기 셋이 화면의 ${(sum * 100).toFixed(1)}% (${(BUDGET * 100).toFixed(0)}% 이하)`);
    for (const name of Object.keys(PANELS)) {
      if (!P[name] || name === '조준경') continue;
      ok(inCorner(name, P[name]), `   ${name} 이 제 구석에 있다`);
    }
    const names = Object.keys(PANELS).filter((n) => P[n]);
    const laps = [];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        if (overlaps(P[names[i]], P[names[j]])) laps.push(`${names[i]}×${names[j]}`);
      }
    }
    ok(!laps.length, `★ 판끼리 안 겹친다${laps.length ? ` — ${laps.join(' · ')}` : ''}`);
  }

  // ══ ★★★ **창이 바뀌어도 같은 자리인가** — 이 판의 알맹이 ═════════════
  //  ★ 위의 검사는 창마다 「괜찮나」를 묻는다. 이 검사는 **「같은가」**를
  //    묻는다 — 정렬이란 결국 그것이고, 창마다 따로 괜찮은 것과는 다르다
  console.log('\n[★] **창이 바뀌어도 판이 같은 구석에 있나**');
  {
    const seen = {};
    for (const v of VIEWS) {
      await p.setViewportSize({ width: v.w, height: v.h });
      await p.waitForTimeout(300);
      const P = await S(() => SPACE.panels());
      for (const n of Object.keys(PANELS)) {
        if (n === '조준경' || !P[n]) continue;
        // ══ ★★★ **못박은 것은 복판이 아니라 바깥 모서리다** ═════════════
        //
        //  ★ 처음에 복판(`cx`)을 쟀다가, 판을 1.6배로 키우니 흔들림이
        //    0.05 → 0.09 로 늘어 빨개졌다. **정렬이 나빠진 것이 아니다** —
        //    `centerFor` 가 「바깥 모서리를 구석에 대고 그만큼 안으로
        //    민다」이므로, 복판은 **판의 반쪽 크기만큼** 화면비를 탄다.
        //    판이 클수록 그 몫이 커진다.
        //  ★★ 즉 **표가 약속한 것(`ANCHOR`)과 검사가 재던 것이 달랐다.**
        //    약속은 「바깥 모서리가 늘 같은 자리」이고, 잘림도 가림도
        //    모서리가 정한다. 재는 것을 약속에 맞춘다
        const [sx, sy] = PANELS[n].corner;
        (seen[n] = seen[n] ?? []).push({
          v,
          cx: sx < 0 ? P[n].x0 : P[n].x1,
          cy: sy < 0 ? P[n].y0 : P[n].y1,
          mx: P[n].cx, my: P[n].cy,
        });
      }
    }
    for (const [n, rows] of Object.entries(seen)) {
      const dx = Math.max(...rows.map((r) => r.cx)) - Math.min(...rows.map((r) => r.cx));
      const dy = Math.max(...rows.map((r) => r.cy)) - Math.min(...rows.map((r) => r.cy));
      const mdx = Math.max(...rows.map((r) => r.mx)) - Math.min(...rows.map((r) => r.mx));
      console.log(`   ${n}  바깥 모서리 ${rows.map((r) => r.cx.toFixed(2)).join(' ')}`
        + `  · 흔들림 x ${dx.toFixed(3)} · y ${dy.toFixed(3)}`
        + `  (복판은 ${mdx.toFixed(3)} — 판 크기만큼 화면비를 탄다)`);
      ok(dx < 0.03 && dy < 0.03,
        `★★★ **${n} 의 바깥 모서리가 창 크기와 상관없이 같은 자리**다`
        + ` (흔들림 ${Math.max(dx, dy).toFixed(3)} < 0.03)`
        + ' — v113 까지는 자리를 미터로 적어 둬서 넓은 화면일수록 복판으로 걸어 들어왔다');
    }
  }

  ok(!errs.length, `콘솔에 오류가 없다 ${errs.length ? errs.slice(0, 2).join(' · ') : ''}`);
} finally { await b.close(); }

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전투 화면이 비어 있다');
process.exit(bad ? 1 : 0);
