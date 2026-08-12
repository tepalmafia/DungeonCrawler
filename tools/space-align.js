// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **창밖의 저것 == 계기의 저것 인가** (v98)
//
//    python3 tools/serve.py 8391 &
//    node tools/space-align.js
//
//  ★ 사장님 「**화면에 보이는 물체와 레이더 표적이 나오는걸 왜 동일하게
//    못 맞추는거지?**」 — 이 도구가 그 물음이다.
//
//  ══ 왜 이 도구가 있어야 하나 ═══════════════════════════════════════════
//
//  전투의 어긋남을 **네 판** 연달아 고쳤다 (v91 · v93 · v95 · v98).
//  네 번 다 **사장님이 화면을 보시고** 잡으셨다 — 도구는 하나도 못 잡았다.
//  이유가 뚜렷하다: 도구는 규칙(`aimedAt`·`radarBlips`)만 읽을 수 있었고
//  **3D 쪽은 못 읽었다.** 둘 중 하나만 읽으면 「둘이 같나」를 물을 수가 없다.
//
//  ★★ 그래서 이건 **진짜 브라우저**에서 **진짜 카메라와 진짜 메시**를 쓴다.
//    규칙이 말하는 각과 창밖에 실제로 보이는 각을 나란히 놓는다.
//
//  ★★★ 그리고 **정면만 보면 안 잡힌다.** v98 에 그걸 배웠다 — 잘못된 셈도
//    기수가 정면일 때는 맞는다. 기수를 틀고 · 들고 · 뒤집어 놓고 재야
//    갈라지는 것이 보인다. 여기서 자세 다섯을 쓰는 이유다
// ══════════════════════════════════════════════════════════════════════════
const PORT = process.env.PORT ?? '8391';
let chromium = null;
for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
  try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ }
}
if (!chromium) { console.log('playwright 가 없습니다'); process.exit(0); }

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

/** ★ 재는 자세 — **정면 하나로는 못 잡는다** (v98 의 교훈) */
const POSES = [
  { yaw: 0, pitch: 0, what: '정면 (여기서는 틀린 셈도 맞는다)' },
  { yaw: 25, pitch: 0, what: '옆을 본다' },
  { yaw: 0, pitch: 18, what: '기수를 든다' },
  { yaw: -40, pitch: -22, what: '틀고 내린다' },
  { yaw: 120, pitch: 12, what: '뒤쪽을 본다' },
];

/** 여기까지는 봐준다 — 화소 하나가 0.1도쯤이다 */
const TOL = { off: 0.5, gap: 0.5, roll: 1.5 };

console.log('창밖의 저것 == 계기의 저것 인가 — 진짜 브라우저 · 진짜 카메라');

const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!globalThis.SPACE, null, { timeout: 60000 });
  const S = (f, a) => p.evaluate(f, a);

  await S(() => SPACE.clearSave());
  await p.click('#btn-play').catch(() => {});
  await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });
  await p.waitForTimeout(1200);
  // 조종석에 앉는다 — 앉아야 창밖이 서고 조준경이 켜진다
  // ══ ★★★ v121 — **머리를 안 숙인 채로 앉힌다** ═══════════════════════
  //
  //  ★ 여기가 `-0.55` (라디안 · **31.5도 아래**) 였다. v98 에 이 검사를
  //    쓸 때는 「걸어와서 고개를 숙여 조종간을 잡는다」였고, 잡으면 고개가
  //    다시 들렸다. **v109·v110 이 그걸 없앴다** — 늘 앉아 있고 일어서지
  //    않으므로, 검사가 밀어 넣은 고개 각이 **그대로 남는다.**
  //
  //  ★★ 그러면 이 검사는 **머리 기준**으로 재고 규칙은 **기수 기준**으로
  //    재게 되어, 둘이 31.5도 어긋난 채 비교된다. 재 보니 정확히 그
  //    값이었다 (위성의 고도 −20.6° vs +10.4° = **31.0도**).
  //    ★ 0 으로 두니 어긋남이 **16.77도 → 0.01도**가 됐다.
  //
  //  ★★★ **게임이 틀린 것이 아니라 검사의 자세가 낡았다.** 그런데 이건
  //    「검사가 틀렸으니 고치면 그만」이 아니다 — 이 빨강이 켜져 있는
  //    동안은 **진짜 어긋남이 생겨도 안 보인다.** 낡은 빨강은 새 빨강을
  //    덮는다 (v120 에 조종간 검사에서 똑같이 겪었다)
  await S(() => SPACE.put(0, -7.10, 0, 0));
  await p.waitForTimeout(400);
  await S(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
  await p.waitForTimeout(250);
  await S(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
  for (let i = 0; i < 40; i++) { if (await S(() => SPACE.helm2.k) > 0.99) break; await p.waitForTimeout(200); }
  ok(await S(() => SPACE.helm2.k) > 0.99, '조종석에 앉았다');

  console.log('\n   자세                      눈-원점   HUD롤 vs 필요한롤    ★어긋남');
  let worstOff = 0, worstGap = 0, worstRoll = 0;
  for (const q of POSES) {
    await S(([a, e]) => SPACE.putFly({ yaw: a, pitch: e }), [q.yaw, q.pitch]);
    // ★ 기수가 **멎을 때까지** 기다린다 — 도는 중에 재면 그건 지연이지
    //   어긋남이 아니다. 둘을 섞으면 멀쩡한 것을 고치려 든다
    let last = null;
    for (let i = 0; i < 40; i++) {
      await p.waitForTimeout(250);
      const now = await S(() => { const s = SPACE.sky; return [s.az, s.el]; });
      if (last && Math.abs(now[0] - last[0]) < 0.05 && Math.abs(now[1] - last[1]) < 0.05) break;
      last = now;
    }
    const r = await S(() => SPACE.align());
    if (!r || !r.n) { console.log(`   ${q.what} — 창밖에 아무것도 없다`); continue; }
    const dRoll = Math.abs(((r.needRoll - r.roll + 540) % 360) - 180);
    worstOff = Math.max(worstOff, r.worstOff);
    worstGap = Math.max(worstGap, r.gap);
    worstRoll = Math.max(worstRoll, dRoll);
    console.log(`   ${q.what.padEnd(24)} ${String(r.gap).padStart(5)}m`
      + `  ${String(r.roll).padStart(6)}° vs ${String(r.needRoll).padStart(6)}°`
      + `   ${String(r.worstOff).padStart(5)}°`);
  }

  console.log('');
  // ══ ① 시차 — v93 이 반쪽만 고쳤던 것 ═══════════════════════════════
  ok(worstGap <= TOL.gap,
    `★★★ **눈과 원점이 붙어 있다** (제일 벌어진 것 ${worstGap}m)`
    + ' — v93 은 한 번 놓고 말았고, 그러면 배가 돌 때 8.5m 짜리 팔이 휘둘린다');
  // ══ ② 각 — 규칙과 창밖이 같은 곳을 말하나 ═══════════════════════════
  ok(worstOff <= TOL.off,
    `★★★ **규칙이 말하는 각 == 창밖에 보이는 각** (제일 벌어진 것 ${worstOff}도)`);
  // ══ ③ 롤 — 표식이 실물에 얹히나 ═══════════════════════════════════
  ok(worstRoll <= TOL.roll,
    `★★ **표식을 돌리는 각이 맞다** (제일 벌어진 것 ${worstRoll.toFixed(1)}도)`
    + ' — 머리 위를 넘기면 반 바퀴를 보태야 한다 (v98)');
  ok(!errs.length, `콘솔에 오류가 없다 ${errs.length ? errs.slice(0, 2).join(' · ') : ''}`);
} finally { await b.close(); }

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 통과 — 창밖과 계기가 같은 곳을 가리킨다');
console.log(`
  ※ **이 도구가 없었으면 네 판을 더 태웠다.** v91·v93·v95·v98 이 전부
     「보이는 데는 저기인데 잡히는 것은 여기」였고, 넷 다 사장님이 화면을
     보시고 잡으셨다. 규칙만 읽는 검사는 넷 다 초록이었다 —
     **한쪽만 읽으면 「둘이 같나」를 물을 수가 없다.**`);
process.exit(bad ? 1 : 0);
