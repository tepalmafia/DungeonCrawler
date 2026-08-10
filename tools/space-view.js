// ══════════════════════════════════════════════════════════════════════════
//  ★★★ 조종석 시야 — **얼마나 보이나 · 무엇이 막나** (v66 · docs/space/VIEW.md)
//
//    node tools/space-view.js
//
//  ★ 사장님: 「아직도 화면이 작고, **중앙에 철이 막고 있잔아.**
//             다시 전투기 조정석 데이터 구해서 연구해서 적용해」
//
//  ★★★ **v65 판이 왜 초록인 채로 기둥을 놓쳤나**
//     [3] 이 「캐노피 점 중 x=0 근처가 없나」만 물었다. 그런데 실제로
//     눈앞을 막던 것은 `world/ship.js` 의 **링 프레임 기둥**이었다 —
//     다른 파일에 있었으므로 이 검사는 볼 수가 없었다.
//     **한 파일만 보는 검사는 그 파일 밖의 실수를 영원히 통과시킨다.**
//
//     그래서 v66 은 묻는 방식을 바꿨다: 좌표를 세는 대신
//     **「비어 있어야 하는 원뿔」(`CLEAR`) 안에 뭐가 있나**를 묻고,
//     막을 수 있는 것을 **표 한 곳(`STRUCTS` · `CANOPY` · 계기 · HUD)에
//     모아** 그 목록을 통째로 훑는다. 새 구조재를 만들면 표에 적어야
//     하고, 안 적으면 `space-endtoend` 가 아니라 여기서 걸린다.
//
//  ★★ **왜 브라우저를 안 쓰나.** 시야각은 좌표에서 나오는 값이라
//     `atan(크기 / 거리)` 로 끝난다. **잴 수 있는 것은 표에서 잰다.**
//
//  ★ 여기서 안 나오는 것: **「넓어 보이나」.** 그건 화면을 찍어야 알고,
//    마지막 판정은 사장님이 하신다.
//
//  ── 견주는 값 (찾아본 것 · 2026-08-07) ──────────────────────────────
//    F-16   기수 너머 아래 **15도** · 옆 아래 **40도** · 수평 360
//           **조종사 앞에 캐노피 활대가 없다** · HUD **25 × 25도**
//    F-35   세로 188.5도 · 기수 너머 **16도**
//    F-22   캐노피 3.56 × 1.14 × 0.69m
//    FAA    AC 25.773-1 — 기수 너머 아래 **17도**
// ══════════════════════════════════════════════════════════════════════════
import { HELM_SEAT, FLY_VIEW, YOKE_AT } from '../web/space/js/game/helm-table.js';
import {
  DEP, CEIL, CLEAR, CANOPY, CONSOLE_PTS, GLASS_Y, BROW_Y, browSeg,
  PANEL_DIST, PANEL_GAP, SIDE, HUD, hudFov, ROOF, STRUCTS,
} from '../web/space/js/game/view-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DEG = 180 / Math.PI;
const deg = (r) => r * DEG;

/** 정면 유리·계기판의 z (가운데 조각) */
const GLASS_Z = CANOPY[2][1];
const CON_Z = CONSOLE_PTS[2][1];

/** 잡았을 때의 눈 — 여기가 「전체 화면」의 기준이다 */
const FLY_EYE = { x: 0, y: HELM_SEAT.eye + FLY_VIEW.rise, z: HELM_SEAT.seatAt.z - FLY_VIEW.lean };
const SIT_EYE = { x: 0, y: HELM_SEAT.eye, z: HELM_SEAT.seatAt.z };

/** 눈에서 본 세로 창 */
function look(eye) {
  const dg = Math.abs(GLASS_Z - eye.z);
  const dc = Math.abs(CON_Z - eye.z);
  const downBrow = deg(Math.atan2(eye.y - BROW_Y, dc));
  const downGlass = deg(Math.atan2(eye.y - GLASS_Y.sill, dg));
  const down = Math.min(downBrow, downGlass);
  const up = deg(Math.atan2(GLASS_Y.head - eye.y, dg));
  return { dg, down, downBrow, downGlass, up, tall: down + up };
}

/**
 * ★★★ 상자 하나가 **비어야 할 원뿔** 안에 들어와 있나.
 *   상자의 여덟 귀퉁이를 눈에서 보고, **한 귀퉁이라도** 원뿔 안이면 막는다.
 */
function blocks(eye, b) {
  let worst = null;
  for (const sx of [-0.5, 0.5]) for (const sy of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) {
    const x = b.x + b.w * sx - eye.x;
    const y = b.y + b.h * sy - eye.y;
    const z = b.z + b.d * sz - eye.z;
    if (z >= 0) continue;                       // 눈 뒤는 안 막는다
    const yaw = Math.abs(deg(Math.atan2(x, -z)));
    const el = deg(Math.atan2(y, Math.hypot(x, z)));
    if (yaw <= CLEAR.yaw && el >= CLEAR.el) {
      if (!worst || yaw < worst.yaw) worst = { yaw: +yaw.toFixed(1), el: +el.toFixed(1) };
    }
  }
  return worst;
}

/** 정면에 설 수 있는 것을 **전부** 모은다 — 여기가 이 도구의 알맹이다 */
function everything() {
  const list = [];
  // ① 캐노피 멀리언 — 점마다 하나
  for (const [x, z] of CANOPY) {
    list.push({ what: `캐노피 멀리언 x${x}`, x, y: CEIL / 2, z, w: 0.16, h: CEIL, d: 0.16 });
  }
  // ② 표에 모아 둔 구조재 (지붕 갈빗대 · 뒤테 …)
  for (const s of STRUCTS) list.push(s);
  // ③ 계기판 — 가운데 칸을 뺀 조각들. **위끝이 자리마다 다르다** (`browAt`)
  for (let i = 0; i < CONSOLE_PTS.length - 1; i++) {
    if (i === PANEL_GAP) continue;
    const a = CONSOLE_PTS[i], b = CONSOLE_PTS[i + 1];
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    list.push({
      what: `계기판 ${i}`,
      x: mx, y: browSeg(a, b) - 0.01, z: mz,
      w: Math.abs(b[0] - a[0]), h: 0.02, d: Math.abs(b[1] - a[1]) + 0.2,
    });
  }
  // ④ 항로 갈래 판은 **계기 화면 위에 얹히므로** 따로 안 센다 (v66) —
  //   자리를 하나도 더 안 먹는 것이 그 설계의 요점이다
  // ⑤ 옆 콘솔의 손잡이 둘 — 방위각 밖에 있어야 한다
  list.push({ what: '추력 레버', ...SIDE.throttle, w: 0.20, h: 0.34, d: 0.40 });
  list.push({ what: '자동 항법 스위치', ...SIDE.auto, w: 0.20, h: 0.24, d: 0.30 });
  // ⑤ 조종간 — T 자 가로대. 이것도 정면에 있으면 막는 것이다
  list.push({ what: '조종간', x: YOKE_AT.x, y: YOKE_AT.y, z: YOKE_AT.z, w: 0.52, h: 0.20, d: 0.10 });
  // ⑥ HUD — 유일하게 **정면에 있어도 되는 것.** 다만 25도를 넘으면 안 된다
  return list;
}

console.log('\n조종석 시야 — 얼마나 보이나 · 무엇이 막나');
console.log(`   앉은 눈 (${DEP.x}, ${DEP.y}, ${DEP.z}) · 정면 유리 z ${GLASS_Z} · 계기판 z ${CON_Z}`);
console.log(`   유리 ${GLASS_Y.sill} ~ ${GLASS_Y.head} · 눈썹 차양 ${BROW_Y} (계기판 ${PANEL_DIST}m 앞)`);

console.log('\n[1] ★ **앉기만 했을 때** — 잡기 전에도 밖이 보여야 한다');
{
  const v = look(SIT_EYE);
  console.log(`   유리까지 ${v.dg.toFixed(2)}m · 아래 ${v.down.toFixed(1)}도 · 위 ${v.up.toFixed(1)}도`);
  console.log(`   ⇒ 세로 창 ${v.tall.toFixed(1)}도 · 화각 72 의 ${((v.tall / 72) * 100).toFixed(0)}%`);
  ok(v.tall >= 60, `앉기만 해도 세로 ${v.tall.toFixed(1)}도 (60도 이상) — 잡기 전에 창이 어디 있는지 알아야 잡는다`);
  ok(v.down >= 15, `앉아서도 기수 너머 ${v.down.toFixed(1)}도 (15도 이상)`);
}

console.log('\n[2] ★★★ **잡았을 때** — 여기가 「전체 화면」이다');
{
  const v = look(FLY_EYE);
  const pct = (v.tall / FLY_VIEW.fov) * 100;
  console.log(`   유리까지 ${v.dg.toFixed(2)}m · 아래 ${v.down.toFixed(1)}도 (차양 ${v.downBrow.toFixed(1)} · 유리 ${v.downGlass.toFixed(1)}) · 위 ${v.up.toFixed(1)}도`);
  console.log(`   ⇒ 세로 창 ${v.tall.toFixed(1)}도 · 화각 ${FLY_VIEW.fov} 의 ${pct.toFixed(0)}%`);
  ok(v.down >= 15,
    `★★ 기수 너머 아래로 **${v.down.toFixed(1)}도** — F-16 이 15 · F-35 가 16 · FAA 가 17 이다`);
  ok(v.tall >= 80, `★★ 세로 창이 **${v.tall.toFixed(1)}도** (80도 이상) — v64 는 34.6 · v65 는 70.0`);
  ok(pct >= 88, `★★★ 창이 화면의 **${pct.toFixed(0)}%** (88% 이상) — v64 는 37% · v65 는 75%`);
  ok(v.dg < 1.1, `유리가 눈에서 ${v.dg.toFixed(2)}m — 버블은 유리가 큰 게 아니라 **머리 바로 옆**이다`);
}

console.log('\n[3] ★★★ **비어 있어야 하는 원뿔** — 정면에 아무것도 없나');
console.log(`   방위각 ±${CLEAR.yaw}도 · 앙각 ${CLEAR.el}도 위 (F-16 은 조종사 앞에 활대가 없다)`);
{
  const hits = [];
  for (const b of everything()) {
    const w = blocks(FLY_EYE, b);
    if (w) hits.push(`${b.what} (방위 ${w.yaw}도 · 앙각 ${w.el}도)`);
  }
  for (const h of hits) console.log(`      ✘ ${h}`);
  ok(hits.length === 0,
    `★★★ 정면 원뿔 안의 구조재 **${hits.length}개**. v65 는 링 프레임 기둥이 12시에 서 있었는데`
    + ' **캐노피 점만 세는 검사라 초록이었다**');
  // 앉았을 때도 물어야 한다 — 눈이 20cm 낮으면 차양이 걸릴 수 있다
  const sit = everything().map((b) => [b.what, blocks(SIT_EYE, b)]).filter(([, w]) => w);
  for (const [n, w] of sit) console.log(`      ✘ (앉아서) ${n} — 방위 ${w.yaw}도 · 앙각 ${w.el}도`);
  ok(sit.length === 0, `앉았을 때도 원뿔이 비어 있다 (막는 것 ${sit.length}개)`);
}

console.log('\n[4] ★★ **위가 안 끊기나** — 유리 위끝과 머리 위 창이 이어지나');
{
  ok(GLASS_Y.head >= CEIL - 1e-6,
    `유리 위끝(${GLASS_Y.head})이 천장(${CEIL})까지 — v65 는 2.62 라 그 위에 **선체띠가 한 줄** 있었다`);
  ok(ROOF.z0 <= GLASS_Z + 0.4,
    `머리 위 창이 z ${ROOF.z0} 까지 앞으로 나온다 — 유리 위끝(z ${GLASS_Z})에서 이어받는다`);
  ok(Math.abs(ROOF.x0) >= Math.abs(CANOPY[2][0]) - 0.01,
    `머리 위 창 폭 ±${Math.abs(ROOF.x0)} ≥ 앞유리 멀리언 ±${Math.abs(CANOPY[2][0])} — 좁으면 그 차이가 천장이다`);
}

console.log('\n[5] ★★ **HUD 가 작나** — 크게 만들면 그건 가림막이다');
{
  const f = hudFov();
  console.log(`   결합기 ${HUD.w} × ${HUD.h} · 눈에서 ${HUD.dist}m ⇒ **${f.h}도 × ${f.v}도**`);
  ok(f.h >= 22 && f.h <= 30, `가로 ${f.h}도 — F-16 Block 60 이 25도다 (v65 는 **94도**였다)`);
  ok(f.v >= 16 && f.v <= 30, `세로 ${f.v}도 (v65 는 74도)`);
  // ★ HUD 는 **눈높이**에 있어야 한다. 눈이 뜨면 조준선에서 벗어난다
  ok(Math.abs(FLY_VIEW.rise) <= 0.14,
    `잡았을 때 눈이 ${FLY_VIEW.rise}m 만 뜬다 (0.14 이하) — 많이 뜨면 **HUD 가 조준선에서 벗어난다.**`
    + ' 실제 HUD 가 DEP 에 맞춰져 있는 이유가 이것이다');
}

console.log('\n[6] ★ **차양이 눈 아래인가 · 무릎이 들어가나**');
{
  ok(BROW_Y < HELM_SEAT.eye,
    `눈썹 차양(${BROW_Y})이 앉은 눈(${HELM_SEAT.eye})보다 아래 — 실제 조종석은 차양 위로 밖을 본다`);
  const knee = Math.abs(CON_Z - HELM_SEAT.seatAt.z);
  // ★ v65 는 1.0m 를 요구했다. 그건 **내가 지어낸 값**이고, 실제 전투기의
  //   DEP → 계기판은 0.7m 언저리다. 고증으로 고친다
  ok(knee >= 0.62, `좌석에서 계기판까지 ${knee.toFixed(2)}m (0.62m 이상 · 실제 전투기 ≈ 0.7)`);
  ok(knee > HELM_SEAT.reach, `조종간(${HELM_SEAT.reach}m)이 무릎 공간 안 — 손이 닿는다`);
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「넓어 보이나」는 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「몇 도가 보이나 · 화면의 몇 % 인가 · 정면이 비었나」뿐이다.');
// ★ v90 — **여기서 끝내면 아래 [7] 이 영영 안 돈다.** `--see` 면 이어 간다
if (!process.argv.includes('--see')) process.exit(fail ? 1 : 0);

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ v90 — **여기까지는 「유리 구멍」이다. 「화면」은 아래에서 묻는다**
//
//    node tools/space-view.js --see 8391
//
//  ★ 사장님 「왜 **핸들하고 계기판이 아래에 나오지? 전투에 방해되잔아**」.
//    그때 위의 [1]~[6] 은 **전부 ✔ 였고 「창이 화면의 92%」**라고 찍고
//    있었다. 이 도구가 재는 것은 **유리가 뚫린 각도**이지 **그 앞에 선
//    물건**이 아니다 — 「창이 크다」와 「밖이 보인다」는 다른 말인데
//    같은 값으로 읽고 있었다.
//
//  ★★ 그래서 **눈에서 광선을 격자로 쏴서** 배에 맞는 칸을 센다
//    (`SPACE.blocked()`). 화면을 찍어 보는 것과 같은 것을 숫자로 만든 것이다.
//
//  ★★★ 만들면서 한 번 크게 틀렸다: **안 보이는 조준 판정 상자**
//    (조종간의 0.86 × 0.56 · `visible: false` 인 재질)를 막힘으로 세어
//    「아래 29%가 막혔다」가 나왔다. 그 숫자로 값을 만질 뻔했다 —
//    **재는 것이 화면과 다르면 그 숫자로 고치면 안 된다.**
// ══════════════════════════════════════════════════════════════════════════
const seeV = process.argv.indexOf('--see');
if (seeV >= 0) {
  const PORT = process.argv[seeV + 1] || '8391';
  let chrome = null;
  for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { ({ chromium: chrome } = await import(m)); break; } catch { /* 다음 것 */ }
  }
  if (!chrome) { console.error('playwright 가 없습니다.'); process.exit(2); }
  const br = await chrome.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const pg = await br.newPage({ viewport: { width: 900, height: 560 } });
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => !!globalThis.SPACE, null, { timeout: 60000 });
    const S = (f, a) => pg.evaluate(f, a);
    await S(() => SPACE.clearSave());
    await pg.click('#btn-play').catch(() => {});
    await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });

    console.log('\n[7] ★★★ **화면의 몇 %를 배가 막나** — 유리가 아니라 그려진 것');
    {
      // ★★ **사람이 앉는 대로 앉힌다.** `putGun` 으로 앉히면 시선이 0 이라
      //   늘 창을 보게 되는데, 실제로는 **좌석을 내려다보며 눌러야** 앉는다.
      //   사장님 화면이 아래가 콘솔이었던 것이 정확히 그 차이였다
      await S(() => SPACE.put(0, -7.10, 0, -0.55));
      await pg.waitForTimeout(400);
      await S(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
      await pg.waitForTimeout(250);
      await S(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
      for (let i = 0; i < 40; i++) { if (await S(() => SPACE.helm2.k) > 0.99) break; await pg.waitForTimeout(200); }
      await pg.waitForTimeout(700);
      const v = await S(() => SPACE.blocked());
      console.log(`   막힌 칸 ${(v.all * 100).toFixed(1)}% · 아래로 연달아 ${(v.bottom * 100).toFixed(1)}%`);
      console.log(`   무엇이  ${v.who.map(([n, c]) => `${n} ${c}`).join(' · ')}`);
      ok(typeof v.all === 'number', '막힌 비율이 숫자로 온다 — 없으면 아래는 묻지도 못한 것이다');
      ok(await S(() => Math.abs(SPACE.look.pitch) < 0.12),
        '★★★ **앉으면 고개가 창으로 온다** — 좌석은 발치에 있어 숙이고 앉는데,'
        + ' 그 숙임이 남으면 **앉는 내내 아래를 본다** (사장님 화면이 그랬다)');
      ok(v.bottom <= 0.22,
        `★★ 아래로 연달아 막힌 것이 ${(v.bottom * 100).toFixed(0)}% (22% 이하) —`
        + ' 실제 전투기도 차양이 아래를 먹지만 그건 5분의 1쯤이다');
      ok(v.all <= 0.32,
        `★ 화면의 ${(v.all * 100).toFixed(0)}% 가 배다 (32% 이하)`);
      ok(!v.who.some(([n]) => n === '조종간'),
        '★★★ **조종간이 화면을 안 먹는다** — 실제 중앙 조종간은 무릎 사이라 눈에 거의 안 들어온다');
      // ★★★ v92 — **하늘 위에 겹치는 것은 HUD 하나다.**
      //   실제 전투기가 그렇고(나머지는 눈썹 차양 아래 MFD), 무엇보다
      //   v91 까지 **광학창이 눈보다 위**에 떠서 화면 칸 35개를 먹고 있었다
      const skyBand = v.byRow.slice(0, Math.floor(v.byRow.length * 0.6));
      const worstBand = Math.max(...skyBand);
      console.log(`   하늘 띠(위 60%) 제일 막힌 줄 ${(worstBand * 100).toFixed(0)}%`);
      ok(worstBand <= 0.2,
        `★★★ **하늘 띠에 HUD 말고 아무것도 없다** (제일 막힌 줄 ${(worstBand * 100).toFixed(0)}% · 20% 이하) —`
        + ' v91 까지 광학창이 눈보다 위에 떠 있었다');
    }
    console.log('\n[8] ★★★ **HUD 표식이 진짜 적 위에 얹히나** (v91)');
    {
      //  사장님 「**왜 락온은 왼쪽인데 적은 우측 상단에 있지?**」 ·
      //          「레이더에 적의 위치가 나타나는데 **타겟팅해도 적이 안잡히잔아**」
      //  ★ 두 말씀이 **같은 버그**였다. 표식에 맞추면 적은 딴 데 있으므로
      //    락온 원뿔(9도) 가장자리에서 붙었다 떨어졌다 한다.
      //  ★★ **롤을 걸고 잰다** — 안 걸면 0도만 재게 되고, 실제로 v91 이전에는
      //    0도에서만 맞고 **기울일수록 원을 그리며 벗어났다**
      await S(() => { SPACE.setRegion('empty', true); SPACE.setPower('sensor', true); SPACE.putAuto(false); });
      const t = await S(() => SPACE.callRaider());
      await S((id) => SPACE.putSkyAz(id, 9, 5), t.id);
      await S((id) => SPACE.putSkyDist(id, 90), t.id);
      await pg.waitForTimeout(600);
      let worst = 0;
      for (const roll of [0, 15, 30, 45]) {
        await S((r) => SPACE.putFly({ roll: r * Math.PI / 180 }), roll);
        await pg.waitForTimeout(450);
        const d = await S(() => SPACE.hudGap('raider'));
        const g = Math.hypot(d.gap?.x ?? 99, d.gap?.y ?? 99);
        worst = Math.max(worst, g);
        console.log(`   롤 ${String(roll).padStart(3)}도 — 적 ${d.foe?.x},${d.foe?.y} · 표식 ${d.mark?.x},${d.mark?.y} → ${g.toFixed(1)}화소`);
      }
      ok(worst < 900 * 0.02,
        `★★★ 제일 벌어졌을 때 **${worst.toFixed(1)}화소** (화면 폭의 2% 미만) —`
        + ' v90 은 롤 45도에서 36화소였다 (하늘만 돌고 HUD 는 안 돌아서)');
      await S(() => SPACE.putFly({ roll: 0 }));
    }

    if (errs.length) { console.log('\n  ✘ 콘솔 오류:'); errs.slice(0, 3).forEach((e) => console.log('    ' + e)); fail += errs.length; }
  } finally { await br.close(); }
  console.log('');
  console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
  process.exit(fail ? 1 : 0);
}
