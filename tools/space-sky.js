// ══════════════════════════════════════════════════════════════════════════
//  창밖 — **고증대로인가** (v57 · 2026-08-07)
//
//    node tools/space-sky.js
//    node tools/space-sky.js --see 8391    + 실제 배에서 창밖을 본다
//
//  ★ 사장님: 「우주 배경을 실사화해줘. 인터넷에서 고증해서. 행성도 그렇고
//             지금은 하얀색이 너무 많이 날아오는데?」
//
//  ★★ 이 검사가 **묻지 않는 것**부터 적는다: 「예쁜가」는 여기서 안 나온다.
//     그건 화면이고 사장님 몫이다. 여기서 나오는 것은 **고증으로 틀렸나**뿐이고,
//     그 목록은 다섯이다:
//
//       ① **별이 흐르나** — 흐르면 틀렸다. 제일 가까운 별도 4광년이다
//       ② **밝기가 치우쳐 있나** — 다 같은 밝기면 그건 별하늘이 아니다
//       ③ **색이 있나 · 어두우면 색을 잃나** — 6등성이 빨갛게 보이면 틀렸다
//       ④ **지우는 차례가 맞나** — 성운은 **어두운 별부터** 지운다
//       ⑤ **행성에 낮과 밤이 있나 · 대기가 얇나**
//
//  ★ 이 판에서 두 번 헛짚었고 둘 다 **화면을 찍고서야** 잡혔다 —
//    은하수를 사진 밝기로 넣어 창이 회색 안개가 됐고(사진은 몇 초를 모은
//    것인데 눈은 아니다), 대기 테두리를 두 번 잘못 잡았다(후광 → 안 보임).
//    그래서 아래 [7] 은 **화면 없이는 못 여는 자리**다.
// ══════════════════════════════════════════════════════════════════════════
import { MAGS, STAR_COUNT, SPECTRA, MILKYWAY, DUST, PLANET, DOME_R, SUN }
  from '../web/space/js/game/sky-table.js';
import { REGIONS, REGION_BY_KEY } from '../web/space/js/game/regions-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };

console.log('\n창밖 — 고증대로인가');

console.log('\n[1] ★★ **밝기가 치우쳐 있나** — 밝은 것 몇 개와 희미한 것 수천');
{
  let mono = true, prevN = 0, prevSize = 1e9, prevLum = 1e9;
  for (const b of MAGS) {
    const share = ((b.n / STAR_COUNT) * 100).toFixed(1);
    console.log(`   ${b.to}등급까지  ${String(b.n).padStart(5)}개 (${share.padStart(5)}%)`
      + `  크기 ${b.size}  밝기 ${b.lum}  색 ${b.warm}`);
    if (b.n <= prevN || b.size >= prevSize || b.lum >= prevLum) mono = false;
    prevN = b.n; prevSize = b.size; prevLum = b.lum;
  }
  ok(mono, '어두운 띠일수록 **개수가 늘고 크기·밝기가 준다** — 셋이 한 방향이라야 깊이가 난다');
  // 한 등급마다 몇 배 늘어나나. 실제 성표는 3배 안팎이다
  const rates = [];
  for (let i = 1; i < MAGS.length; i++) rates.push(MAGS[i].n / MAGS[i - 1].n);
  const lo = Math.min(...rates), hi = Math.max(...rates);
  console.log(`   등급마다 ${lo.toFixed(1)}~${hi.toFixed(1)}배씩 늘어난다`);
  ok(lo >= 2.2 && hi <= 4.5, '실제 성표의 **3배 안팎**과 겹친다 (2.2~4.5)');
  const bright = MAGS[0].n / STAR_COUNT;
  ok(bright < 0.01,
    `1등성보다 밝은 별이 ${(bright * 100).toFixed(2)}% — **1% 미만.** 이게 곧 「몇 개만 두드러진다」다`);
  ok(STAR_COUNT > 6000 && STAR_COUNT < 12000,
    `다 해서 ${STAR_COUNT}개 — 맨눈으로 6등급까지 보이는 수(약 8,800)와 같은 자리`);
}

console.log('\n[2] ★ **색이 있나 · 어두우면 색을 잃나**');
{
  const sum = SPECTRA.reduce((a, s) => a + s.w, 0);
  ok(Math.abs(sum - 1) < 1e-6, `분광형 무게 합이 1 (${sum.toFixed(4)})`);
  const hot = SPECTRA.filter((s) => 'OBA'.includes(s.cls)).reduce((a, s) => a + s.w, 0);
  console.log('   ' + SPECTRA.map((s) => `${s.cls} ${(s.w * 100).toFixed(1)}%`).join(' · '));
  // ★ 여기서 한 번 틀릴 뻔했다 — 「M 형이 76%」는 **우주에 있는 별**의 분포지
  //   **눈에 보이는 별**의 분포가 아니다. 적색왜성은 어두워 하나도 안 보인다
  ok(hot > 0.35,
    `뜨거운 쪽(O·B·A)이 ${(hot * 100).toFixed(0)}% — 맨눈에 보이는 별은 **뜨거운 쪽으로 치우친다.**`
    + ' 「M 형이 76%」는 우주 전체의 분포지 보이는 별의 분포가 아니다');
  const m = SPECTRA.find((s) => s.cls === 'M'), b = SPECTRA.find((s) => s.cls === 'B');
  ok(m.rgb[0] > m.rgb[2] && b.rgb[2] > b.rgb[0], 'M 형은 붉고 B 형은 푸르다 — 온도 순서와 맞다');
  let losing = true;
  for (let i = 1; i < MAGS.length; i++) if (MAGS[i].warm >= MAGS[i - 1].warm) losing = false;
  ok(losing,
    '★ 어두울수록 색을 잃는다 — 사람 눈의 원추세포가 약한 빛에서 안 켜져서'
    + ' **6등성은 무슨 색이든 회백색**으로 보인다');
  ok(MAGS[MAGS.length - 1].warm < 0.2, `제일 어두운 띠는 색이 ${MAGS[5].warm} — 거의 흰색`);
}

console.log('\n[3] ★★ **흐르는 것이 별이 아닌가** — 이 판의 핵심');
{
  console.log(`   별 ${STAR_COUNT}개 — 천구(반지름 ${DOME_R})에 **박아 둔다**`);
  console.log(`   먼지 ${DUST.n}알 — z ${-DUST.far}~${-DUST.near} 를 **흐른다**`);
  ok(DUST.n < STAR_COUNT / 20,
    `흐르는 것이 별의 ${(DUST.n / STAR_COUNT * 100).toFixed(1)}% 밖에 안 된다 —`
    + ' 예전엔 900 개가 흘렀고 그게 「하얀 게 너무 많이 날아온다」였다');
  const dim = MAGS[MAGS.length - 1];
  ok(DUST.size < dim.size,
    `먼지(${DUST.size})가 제일 어두운 별(${dim.size})보다 **작다** — 커지는 순간 다시 눈보라가 된다`);
  ok(DUST.lum < MAGS[0].lum / 2,
    `먼지 밝기 ${DUST.lum} — 별빛만 받는 티끌이라 어둡다`);
  ok(DUST.rgb[0] > DUST.rgb[2],
    `먼지 색 [${DUST.rgb}] — **흰색이 아니다.** 규산염 티끌은 회갈색이다`);
  ok(DUST.fadeIn > 0 && DUST.fadeOut > 0,
    '나타나고 사라지는 데 시간이 있다 — 툭 생기고 툭 꺼지면 그게 제일 어색하다');
  ok(DOME_R < 400,
    `천구가 카메라 far(400) 안쪽 (${DOME_R}) — 넘으면 별이 통째로 잘린다`);
}

console.log('\n[4] ★ **지우는 차례** — 성운은 어두운 별부터 먹는다');
{
  // 게임은 밝기순으로 채우고 **뒤에서부터** 자른다. 그러면 어두운 것부터 사라진다
  for (const r of REGIONS) {
    const shown = Math.round(STAR_COUNT * r.stars);
    // **통째로** 남는 제일 어두운 띠. 「6등급까지」라고만 적으면 5,950 개 중
    // 862 개만 남은 것도 「6등급까지」가 되어 무슨 말인지 알 수가 없다
    let left = shown, whole = 0;
    for (const b of MAGS) { if (left < b.n) break; whole = b.to; left -= b.n; }
    console.log(`   ${r.name.padEnd(6)} ${String(shown).padStart(5)}개 · ${whole}등급까지는 다 남는다`);
  }
  const bright = MAGS[0].n + MAGS[1].n;
  const worst = Math.min(...REGIONS.map((r) => Math.round(STAR_COUNT * r.stars)));
  ok(worst > bright,
    `제일 비는 구역에도 ${worst}개 — 2등성까지(${bright}개)는 **어디서나 남는다.**`
    + ' 밝은 별은 성운 속에서도 보인다');
  const neb = REGION_BY_KEY.nebula, vd = REGION_BY_KEY.void;
  // ★★ v58 — 「비어 있다」의 근거를 별에서 **띠**로 옮겼다 (REAL.md §2-H).
  //   성운은 먼지가 별을 먹어서 어두워지고, 성간 공백은 **먼지가 없어
  //   더 밝다.** 둘은 반대인데 같은 숫자로 재고 있었다
  ok(vd.stars > neb.stars,
    `성간 공백(${vd.stars})이 성운(${neb.stars})보다 **별이 많다** — 먼지가 없어 또렷하다`);
  ok((vd.band ?? vd.stars) === 0,
    '★ 대신 **은하수 띠가 없다** — 원반을 벗어난 것이고, 그게 「거긴 아무것도 없다」다');
}

console.log('\n[5] ★★ **행성에 낮과 밤이 있나 · 대기가 얇나**');
{
  ok(PLANET.soft > 0.05,
    `터미네이터가 ${PLANET.soft} 만큼 **번진다** — 0 이면 칼로 자른 선이고,`
    + ' 실제로는 대기가 빛을 흩어서 황혼이 진다');
  ok(PLANET.twiWidth < PLANET.soft,
    `황혼 띠(${PLANET.twiWidth})가 경계 번짐(${PLANET.soft})보다 **좁다** —`
    + ' 같은 값을 썼다가 원반의 3분의 1 이 주황으로 물들어 분홍 반죽이 됐다');
  ok(PLANET.night > 0 && PLANET.night < 0.15,
    `밤면이 ${PLANET.night} — **0 이 아니다.** 새까맣게 두면 행성이 반달로 잘려 보인다`);
  const thick = (PLANET.air - 1) * 100;
  console.log(`   대기 껍질이 지표보다 ${thick.toFixed(1)}% 크다`);
  ok(PLANET.air > 1.005 && PLANET.air < 1.06,
    `얇다 (0.5~6%) — 우주비행사 Ed Lu 「지평선에서 1도 남짓, 팔 뻗은 손가락 굵기」`);
  ok(PLANET.limbPow > 2 && PLANET.limbPow < 8,
    `테두리 지수 ${PLANET.limbPow} — 낮으면 후광, 높으면 한두 픽셀이라 없는 것과 같다.`
    + ' **둘 다 겪고 나서** 잡은 값이다');
  // 태양이 행성 옆에서 비추나 — 정면이면 보름달이라 경계가 안 보인다
  const s = PLANET.sun;
  const len = Math.hypot(...s);
  const side = Math.hypot(s[0], s[1]) / len;
  ok(side > 0.4,
    `태양이 **옆에서** 비춘다 (가로 성분 ${side.toFixed(2)}) — 정면이면 보름달이라 터미네이터가 아예 안 보인다`);
  ok(SUN.size > MAGS[0].size * 2,
    `하늘에 태양이 별 하나로 떠 있다 (크기 ${SUN.size}) — 비추는 것이 안 보이면 「왜 저쪽만 밝지」가 된다`);
}

console.log('\n[6] ★ **은하수** — 띠가 띠로 보이나');
{
  console.log(`   기울기 ${MILKYWAY.tilt} · 두께 ${MILKYWAY.width} · 세기 ${MILKYWAY.glow}`);
  ok(MILKYWAY.tilt > 0.1,
    '은하면이 배와 **안 나란하다** — 나란하면 우연이 아니라 실수로 보인다');
  ok(MILKYWAY.glow < 0.15,
    `세기 ${MILKYWAY.glow} — 0.30 으로 찍었더니 창 전체가 **회색 안개**였다.`
    + ' 은하수의 실제 표면 밝기는 아주 낮다. **사진은 몇 초를 모은 것**이고 눈은 아니다');
  ok(MILKYWAY.dust > 0.2,
    `먼지 줄기 ${MILKYWAY.dust} — 은하수를 **가르는 검은 띠**가 없으면 그냥 밝은 구름이다`);
  ok(MILKYWAY.crowd > 0 && MILKYWAY.crowd < 1,
    `별의 ${(MILKYWAY.crowd * 100).toFixed(0)}% 를 띠 쪽으로 몬다 — 1 이면 띠 바깥이 텅 빈다`);
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 표는 전부 통과');
console.log('\n  ※ 여기까지는 **표**다. 「별이 정말 안 흐르나」는 게임이 답한다 — `--see`');

// ══════════════════════════════════════════════════════════════════════════
//  여기부터는 **실제 배**다 — `--see 8391` 을 줬을 때만 돈다.
//
//  ★ 표가 아무리 맞아도 `cockpit.js` 가 별을 흘려보내면 화면은 그대로다.
//    그리고 **이 판이 고친 것이 정확히 그것**이라 여기를 안 보면 잰 게 없다.
// ══════════════════════════════════════════════════════════════════════════
const see = process.argv.indexOf('--see');
if (see >= 0) {
  const PORT = process.argv[see + 1] || '8391';
  let chromium = null;
  for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ }
  }
  if (!chromium) { console.error('playwright 가 없습니다.'); process.exit(2); }
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 380 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!globalThis.SPACE, null, { timeout: 60000 });
  const S = (fn, a) => p.evaluate(fn, a);
  await S(() => SPACE.clearSave());
  await p.mouse.move(320, 190); await p.mouse.click(320, 190);
  await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });
  await S(() => { const o = SPACE.route.offer; if (o.length) SPACE.pick(o[0]); });
  await p.waitForTimeout(800);

  console.log('\n[7] ★★ **별이 안 흐르나 · 먼지는 흐르나** (실제 배)');
  {
    const a = await S(() => SPACE.outside);
    await p.waitForTimeout(2500);
    const c = await S(() => SPACE.outside);
    console.log(`   별 첫 알 z  ${a.star0} → ${c.star0}`);
    console.log(`   먼지 첫 알 z ${a.dust0} → ${c.dust0}`);
    // ★★ **숫자가 왔는지부터 묻는다.** 처음에 이름을 `SPACE.sky` 로 지었다가
    //   이미 있던 것(떠도는 것들)에 조용히 먹혔는데, 그때 이 줄이
    //   `undefined === undefined` 로 **초록을 찍었다.** 값이 없는 것과
    //   값이 안 변한 것은 정반대인데 같은 초록으로 보였다
    ok(typeof a.star0 === 'number' && typeof a.dust0 === 'number',
      '창밖 상태가 숫자로 온다 — 없으면 아래 둘은 **묻지도 못한 것**이다');
    ok(a.star0 === c.star0,
      '★ 별이 **한 톨도 안 움직였다** — 제일 가까운 별도 4광년이라 어떤 배로도 안 움직인다');
    ok(a.dust0 !== c.dust0,
      '★ 먼지는 흘렀다 — 「배가 움직인다」는 이쪽이 만든다');
  }

  console.log('\n[8] ★★ **걸어가도 별자리가 안 밀리나** — 천구가 눈을 따라오나');
  {
    // ★★ **시간으로 기다리면 안 된다.** 천구는 카메라를 **한 프레임 뒤에서**
    //   따라가는데(눈보다 먼저 그려진다), 헤드리스는 0.7초에 한 프레임쯤
    //   도는 일이 있어서 **늘 직전 값**이 읽혔다 — 검사가 「안 따라온다」로
    //   빨개졌지만 게임은 멀쩡했다. 조건으로 기다린다
    const settle = async (want) => {
      for (let i = 0; i < 30; i++) {
        const v = await S(() => SPACE.outside);
        if (Math.abs(v.domeZ - want) < 1.5) return v;
        await p.waitForTimeout(200);
      }
      return await S(() => SPACE.outside);
    };
    await S(() => SPACE.put(0, -6.0, 0, 0));
    const near = await settle(-6.0);
    await S(() => SPACE.put(0, 13.0, 0, 0));      // 기관실까지 19m
    const far = await settle(13.0);
    const moved = Math.abs(far.domeZ - near.domeZ);
    console.log(`   조종석 ${near.domeZ} → 기관실 ${far.domeZ} (${moved.toFixed(1)} 따라왔다)`);
    ok(moved > 12,
      '★ 천구가 **눈을 따라왔다** — 안 따라오면 통로를 걸을 때 별자리가 밀리고,'
      + ' 반지름이 330 이라 카메라 far(400)에 잘리기도 한다');
    await S(() => SPACE.put(0, -6.0, 0, 0));
  }

  console.log('\n[9] ★ **구역이 별을 지우나** — 성운·성간 공백');
  {
    const rows = [];
    for (const k of ['empty', 'nebula', 'void']) {
      await S((kk) => SPACE.setRegion(kk, true), k);
      await p.waitForTimeout(500);
      rows.push([k, await S(() => SPACE.outside)]);
    }
    for (const [k, v] of rows) {
      console.log(`   ${k.padEnd(7)} 별 ${String(v.cut).padStart(5)}개 · 은하수 ${v.band}`);
    }
    const [, e] = rows[0], [, n] = rows[1], [, v] = rows[2];
    ok(e.cut > n.cut && n.cut > v.cut, '빈 공간 > 성운 > 성간 공백 순으로 별이 준다');
    ok(v.band < n.band && n.band < e.band,
      '★ 은하수도 같이 흐려진다 — 성간 공백에 띠가 남아 있으면 「아무것도 없는 곳」이 안 된다');
    await S(() => SPACE.setRegion('empty', true));
  }

  console.log('\n[10] ★ **땅에 내리면 별이 지워지나** — 대기가 있는 곳이다');
  {
    await S(() => { SPACE.setRegion('planet', true); SPACE.putLand('landed', 1); });
    await p.waitForTimeout(900);
    const g = await S(() => SPACE.outside);
    console.log(`   고도 ${g.alt} · 별 투명도 ${g.starFade} · 땅 ${g.ground}`);
    ok(g.starFade < 0.05, '★ 내려앉으면 별이 사라진다 — 갈색 하늘에 별이 총총하면 그건 착륙이 아니다');
    ok(g.ground === true, '땅이 보인다');
    await S(() => SPACE.putLand('none', 0));
  }

  if (errs.length) { console.log('\n  ✘ 콘솔 오류:'); errs.slice(0, 5).forEach((e) => console.log('    ' + e)); fail += errs.length; }
  await b.close();
  console.log('');
  console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
  console.log('\n  ※ **「보기 좋은가」는 여기서 안 나온다.** 이 판에서 두 번 헛짚었고');
  console.log('     둘 다 화면을 찍고서야 잡혔다 — 은하수가 회색 안개였던 것과');
  console.log('     대기 테두리가 후광이었던 것. 마지막은 늘 사장님이 보시는 화면이다.');
}
process.exit(fail ? 1 : 0);
