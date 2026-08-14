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
  // ★★★ v147 — DOM 딱지 (스킬 줄 · 범례)
  CHIPS, chipHits,
} from '../web/space/js/game/screen-table.js';

const PORT = process.env.PORT ?? '8391';
let chromium = null;
for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
  try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ }
}
if (!chromium) { console.log('playwright 가 없습니다'); process.exit(0); }

let bad = 0;
/** ★ v149 — 못 쟀으면 여기에 까닭이 담긴다 (담기면 합격/불합격을 안 찍는다) */
let 못잰까닭 = null;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ v149 — **잴 것이 없으면 통과가 아니라 「측정 불가」다**
//
//  ★ 사장님 (2026-08-14) 검사 도구를 훑다가 잡혔다: `SPACE.panels()` 가
//    **빈 값을 주면 이 도구가 통째로 초록**이었다. 실제로 확인했다 —
//    계기 넷을 다 없앤 척하고 돌리니 **「✔ 전투 화면이 비어 있다」**가 나왔다.
//
//  ══ 왜 그랬나 — 이 도구의 판정이 **전부 「없어야 한다」 꼴**이기 때문 ═══
//
//      ok(!intruders.length, '전투 원뿔이 비었다')
//      ok(!cut.length,       '잘린 판이 없다')
//      ok(!laps.length,      '판끼리 안 겹친다')
//      ok(sum <= BUDGET,     '계기 셋이 화면의 N%')
//
//    판이 하나도 없으면 **넷이 다 참**이 된다. 불량품 상자가 비었는데
//    「불량이 없다」고 도장을 찍는 것과 같다 — 생산 라인이 멈춰서 빈 것인데도.
//    그리고 구석 검사(`inCorner`)는 `if (!P[name]) continue` 로 **아예 건너뛴다.**
//
//  ══ ★★ 접힘(folded)과는 **다른 상황**이라 다르게 끝낸다 ═══════════════
//
//    `tools/folded.js` 는 「**설계가 바뀌어 잴 것이 없어졌다**」를 다룬다 —
//    걷기가 없어졌으니 걷기 검사는 재는 게 맞지 않다. 그건 정상이므로 **0** 으로 끝난다.
//
//    여기는 반대다. 계기는 **있어야 하는 것**이다. 없으면 그건 설계가 바뀐 게
//    아니라 **게임이나 구멍(`SPACE.panels()`)이 고장 난 것**이고, 그때
//    필요한 답은 「합격」도 「불합격」도 아닌 **「못 쟀다」**이다.
//    그래서 **종료 코드 2** 를 쓴다 — 이 저장소가 「playwright 가 없다」에
//    이미 쓰는 그 코드다 (설비가 없어 못 쟀다는 뜻).
//
//  ★ 지금은 이 도구 하나만 고친다 (사장님 「파일 하나만 고쳐」). 같은 병이
//    다른 도구에도 있으므로, **두 번째 도구에 붙일 때** 이 함수를
//    `tools/folded.js` 옆으로 옮기는 것이 맞다 — 한 곳에 두는 규약대로
// ══════════════════════════════════════════════════════════════════════════

/** 못 쟀다 — 브라우저를 닫고 나서 알리려고 예외로 던진다 */
class 못잼 extends Error {}

/**
 * ★★★ **판이 다 있나** — 하나라도 없으면 여기서 멈춘다.
 *
 *   ★ 「하나라도」로 잡는 것이 맞다. 판 하나가 빠질 때마다 위 판정 넷이
 *     **그만큼씩 조용히 약해진다** — 「셋 중 둘만 재고 통과」는 통과가 아니다.
 *
 * @param P     `SPACE.panels()` 가 준 것
 * @param where 어느 대목에서 재려다 못 쟀나 (사람이 읽는 말)
 */
function 재야한다(P, where) {
  const want = Object.keys(PANELS);
  const got = want.filter((n) => P && P[n]);
  if (got.length === want.length) return P;
  const miss = want.filter((n) => !(P && P[n]));
  throw new 못잼(
    `${where} — 계기 ${want.length} 개 중 **${got.length} 개만** 보입니다`
    + `\n     안 보이는 것: ${miss.join(' · ')}`,
  );
}

/** ★ 딱지(DOM)도 같다 — 안 떠 있으면 「안 덮는다」가 저절로 참이 된다 */
function 딱지도재야한다(C, name, where) {
  if (C && C[name]) return C[name];
  throw new 못잼(`${where} — 딱지 「${name}」 가 화면에 없습니다`);
}

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
    //  ★★★ v149 — **재기 전에 잴 것이 있나부터** (아래 판정이 전부
    //    「없어야 한다」 꼴이라, 판이 없으면 통째로 초록이 된다)
    const P = 재야한다(await S(() => SPACE.panels()), `${v.w}×${v.h} 에서`);
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
      const P = 재야한다(await S(() => SPACE.panels()), `${v.w}×${v.h} 의 모서리를 재려는데`);
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

  // ══ ★★★ v118 — **둘러봐도 판이 정면인가** ══════════════════════════
  //
  //  ★ 사장님 (2026-08-12) 「화면에 나오는 정보창들 기울어져있어서 읽기
  //    불편해 수정해줘. **정면으로 나오도록**」
  //
  //  ★★ 위의 검사들은 **정면 한 자세**에서만 쟀다. 그런데 판이 기울어
  //    보이는 것은 **둘러볼 때**다 — 판이 배의 자식이면 카메라만 돌고
  //    판은 안 돌아 마름모로 찌그러진다. v114 가 회전을 0 으로 뒀는데
  //    그건 **배 기준의 0** 이라 이걸 못 막았다.
  //  ★★★ 재는 것은 **법선과 시선의 각** 하나다. −1 이면 딱 마주 본 것이고,
  //    그때만 원근 투영이 판을 **직사각형**으로 그린다 (이미지 평면과
  //    나란한 평면은 언제나 직사각형으로 투영된다 — 이건 정리다)
  console.log('\n[★] **둘러봐도 판이 정면을 보나**');
  {
    await p.setViewportSize({ width: 1600, height: 900 });
    await p.waitForTimeout(250);
    const POSES = [[0, 0], [0.45, -0.18], [-0.70, 0.25], [1.10, 0.30]];
    for (const [yaw, pitch] of POSES) {
      await S((a) => SPACE.put(SPACE.pos.x, SPACE.pos.z, a[0], a[1]), [yaw, pitch]);
      await p.waitForTimeout(220);
      const D = await S(() => SPACE.panelDebug());
      const off = Object.entries(D).filter(([, q]) => q)
        .map(([n, q]) => [n, Math.abs(q.face + 1), q.onCam]);
      const worst = Math.max(0, ...off.map((r) => r[1]));
      console.log(`   yaw ${yaw.toFixed(2)} · pitch ${pitch.toFixed(2)}  `
        + off.map(([n, d, c]) => `${n} ${d.toFixed(4)}${c ? '' : '(배에 붙음)'}`).join(' · '));
      ok(worst < 0.001 && off.every((r) => r[2]),
        `★★★ 이 자세에서 판 셋이 다 **정면**이다 (어긋남 ${worst.toFixed(4)})`);
    }
    await S(() => SPACE.put(SPACE.pos.x, SPACE.pos.z, 0, 0));
  }

  // ══ ★★★ v147 — **화면에 얹은 딱지가 계기를 덮나** ═══════════════════
  //
  //  ★ 사장님이 스킬 효과 화면을 찍어 보시고 잡으신 것: **스킬 줄이
  //    「배의 상태」 위에 얹혀 있었다** (「4 EMP 방출 19초」가 전력·자국 줄 위).
  //
  //  ★★★ 이 검사가 **여태 그것을 못 물었다.** 위의 절들은 전부
  //    `SPACE.panels()` 만 읽는데, 그건 **3D 판**만 안다. 스킬 줄은
  //    `position: fixed` 인 DOM 이라 다른 좌표계에 있었고, **한쪽만 읽는
  //    검사는 「둘이 같나」를 못 묻는다** (v98 규약 그대로다).
  //    `SPACE.chips()` 가 DOM 사각형을 같은 자(−1~1)로 옮겨 준다.
  console.log('\n[★] **딱지가 계기를 덮나** (DOM × 3D — 좌표계를 하나로 놓고)');
  {
    for (const v of VIEWS) {
      await p.setViewportSize({ width: v.w, height: v.h });
      await p.waitForTimeout(300);
      //  ★ 스킬 줄은 **열린 스킬이 있어야** 뜬다 — 안 띄우고 재면
      //    「없으니 안 겹친다」로 **초록이 된다.** 그게 죽은 초록이다.
      //  ★★ 그리고 **슬롯을 채워야 제일 넓다.** 빈 줄로 재면 딱지가 1/3
      //    폭이라 「안 겹친다」가 나오고, 사람이 쓰는 상태에서는 겹칠 수
      //    있다 — **제일 나쁜 경우로 재지 않으면 재나 마나다**
      await S(() => { SPACE.putHelmSit(); SPACE.giveXp(60000); });
      await p.waitForTimeout(700);
      await p.keyboard.press('KeyI');
      await p.waitForTimeout(500);
      await p.click('#tab-grow', { timeout: 4000 }).catch(() => {});
      //  ★ **이미 넣은 것은 다시 안 누른다.** 처음에 「안 막힌 단추는 다
      //    누른다」로 적었더니 창 크기를 바꿀 때마다 **넣었다 뺐다**를
      //    되풀이해서, 두 번째 창부터 줄이 도로 좁아졌다 (±0.191 → ±0.075).
      //    그러면 「제일 나쁜 경우로 잰다」가 깨진다
      await S(() => {
        for (const b of document.querySelectorAll('#skill-rows button[data-skill]')) {
          if (!b.disabled && !b.textContent.includes('뺀다')) b.click();
        }
      });
      await p.waitForTimeout(300);
      await p.keyboard.press('KeyI');
      await p.waitForTimeout(700);
      const C = await S(() => SPACE.chips());
      const P = 재야한다(await S(() => SPACE.panels()), `${v.w}×${v.h} 에서 딱지를 견주려는데`);
      //  ★ 딱지가 안 떠 있으면 「아무것도 안 덮는다」가 **저절로** 참이 된다.
      //    `must` 인 딱지는 떠 있어야 재는 뜻이 있다
      for (const [nm, sp] of Object.entries(CHIPS)) {
        if (sp.must) 딱지도재야한다(C, nm, `${v.w}×${v.h} 에서`);
      }
      for (const [name, spec] of Object.entries(CHIPS)) {
        const c = C[name];
        if (!c) { console.log(`   ${v.w}×${v.h}  ${name} — 안 떠 있다`); continue; }
        const hits = chipHits(c, P);
        const line = `${v.w}×${v.h}  ${name} x ${c.x0.toFixed(3)}~${c.x1.toFixed(3)}`
          + ` · y ${c.y0.toFixed(3)}~${c.y1.toFixed(3)}`;
        if (spec.must) {
          ok(!hits.length, `★★★ ${line} — ${hits.length ? `**${hits.join('·')} 를 덮는다**` : '아무것도 안 덮는다'}`);
        } else {
          console.log(`   ${line} — ${hits.length ? `※ ${hits.join('·')} 와 겹침 (옮길 수 있는 창이라 안 막는다)` : '안 겹침'}`);
        }
      }
    }
    //  ★★ 스킬 줄이 **떠 있기는 하나** — 위 검사는 「안 뜨면 안 겹친다」로
    //    지나가므로 여기서 한 번 못을 박는다
    ok(!!(await S(() => SPACE.chips()))['스킬줄'],
      '★ 스킬 줄이 **실제로 떠 있다** — 안 떠 있으면 위 절이 죽은 초록이 된다');
  }

  ok(!errs.length, `콘솔에 오류가 없다 ${errs.length ? errs.slice(0, 2).join(' · ') : ''}`);
} catch (e) {
  //  ★★★ v149 — 「못 쟀다」는 여기서 잡아 **브라우저를 닫고 나서** 알린다.
  //    `process.exit()` 를 바로 부르면 `finally` 가 안 돌아 브라우저가 남는다
  if (e instanceof 못잼) 못잰까닭 = e.message;
  else throw e;
} finally { await b.close(); }

if (못잰까닭) {
  console.log(`\n■ **측정 불가** — 통과도 실패도 아닙니다\n`);
  console.log(`   ${못잰까닭}`);
  console.log('');
  console.log('   ★ 이 검사의 판정은 전부 **「없어야 한다」** 꼴입니다');
  console.log('     (원뿔이 비었나 · 잘린 것이 없나 · 겹치는 것이 없나).');
  console.log('     그래서 **잴 판이 없으면 넷이 다 저절로 참**이 됩니다 —');
  console.log('     v148 까지 그 상태였고, 계기 넷을 없앤 척하고 돌리니');
  console.log('     **「✔ 전투 화면이 비어 있다」** 가 나왔습니다.');
  console.log('');
  console.log('   ※ 접힌 검사(`tools/folded.js`)와는 다릅니다. 그건');
  console.log('     「설계가 바뀌어 잴 것이 없어졌다」라 **0** 으로 끝나고,');
  console.log('     이건 「있어야 할 것이 없다」라 **2**(못 쟀다)로 끝납니다.');
  console.log('');
  console.log('   먼저 볼 곳: `main.js` 의 `SPACE.panels()` · `world/cockpit.js` 의 계기 셋');
  process.exit(2);
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전투 화면이 비어 있다');
process.exit(bad ? 1 : 0);
