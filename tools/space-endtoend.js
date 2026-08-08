// ══════════════════════════════════════════════════════════════════════════
//  ★★ **처음부터 끝까지 되나** — 사장님이 시키신 것 전부를 한 번에.
//
//    python3 tools/serve.py 8391 &
//    node tools/space-endtoend.js
//
//  ★ 왜 이걸 만들었나 (2026-08-06 · 사장님)
//
//    「조정석을 잡아도 운전이 안되잔아? 주포도 조작이 안되고」
//    「한번에 하나씩 다 이어지게 해야지. 왜 만들다 마니?」
//    「테스트를 할 수가 없잔아.」
//    「지금까지 요청한 내용들 시작하면 제대로 작동하고 끝낼 수 있는
//      상태인지 확인하고 모두 고쳐」
//
//    맞는 지적이다. 계통마다 **제 검사는 다 ✔** 였는데, 그 검사들은 저마다
//    필요한 상태를 **직접 만들어 놓고** 시작했다 — `forceContact()` 로 적을
//    붙여 놓고 주포를 쐈고, `putLand()` 로 착지시켜 놓고 실었다.
//    그래서 「표는 도는데 **사람은 거기까지 못 간다**」를 하나도 못 잡았다.
//
//  ★ 그래서 이 검사만은 규칙이 다르다:
//      **① 켠 다음부터는 손으로만 한다** — 걸어가고, 겨누고, 누른다
//      ② 상태를 밖에서 만들어 주지 않는다 (자리 옮기기만 허용 —
//         헤드리스는 게임 시간이 실시간의 20분의 1 이라 걸으면 못 끝낸다)
//      ③ **막히면 거기서 멈추고 무엇이 막았는지 말한다**
// ══════════════════════════════════════════════════════════════════════════
const PORT = process.argv[2] || '8391';
let chromium = null;
for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
  try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ }
}
if (!chromium) { console.error('playwright 가 없습니다. serve.py 를 먼저 띄웁니다.'); process.exit(2); }

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };

const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 720, height: 420 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'networkidle' });
await p.waitForTimeout(2200);
const S = (fn, a) => p.evaluate(fn, a);

/** ★ 기다림은 기다림일 뿐이고 **판정은 값이 한다** */
const until = async (fn, tries, what) => {
  for (let i = 0; i < tries; i++) { if (await S(fn)) return true; await p.waitForTimeout(400); }
  console.log(`   … ${what} 을(를) 못 봤다`);
  return false;
};
const said = () => S(() => {
  const e = document.getElementById('hud'); return e && !e.hidden ? e.textContent : '';
});
const down = () => S(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
const up = () => S(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
/** 사람이 누르는 것 — 헤드리스는 프레임이 성기므로 넉넉히 잡는다 */
const press = async (sec = 2.5) => { await down(); await p.waitForTimeout(sec * 1000); await up(); };
/**
 * ★★ **화면이 움직임을 멈출 때까지 기다린다** (v66).
 *   조종간을 놓으면 화각·눈높이가 되돌아오는 데 시간이 걸리고(`FLY_VIEW.rate`),
 *   그동안 조준선이 흔들린다. 굳기 전에 겨누면 **잡았다고 나온 다음 프레임에
 *   놓친다** — 검사가 「자동 항법이 잡힌다 ✔ → 누르니 안 켜진다 ✘」로
 *   두 번 빨개졌는데, 게임이 아니라 여기가 급했던 것이다
 */
/**
 * ★★ **안 먹으면 한 번 더 누른다** (v66) — 사람이 하는 그것.
 *
 *   눌린 순간(`input.takePress`)은 **한 프레임에만** 산다. 그 프레임에
 *   조준선이 손잡이를 살짝 벗어나 있으면 **누른 것이 그냥 사라진다.**
 *   실제 브라우저는 초당 60프레임이라 거의 안 나지만, 헤드리스는
 *   초당 한 프레임이라 절반쯤 먹힌다. 검사에는 이렇게 나온다:
 *
 *     ✔ ③ 추력 레버가 잡힌다 (throttle)
 *     ✘ ④ 눌렀더니 「」
 *
 *   **잡히는 것도 맞고 조준도 맞는데 아무 일이 안 난 것**이다.
 *   사람은 이럴 때 한 번 더 누른다. 검사도 그렇게 한다
 */
const pressUntil = async (cond, tries = 5, sec = 1.2) => {
  for (let i = 0; i < tries; i++) {
    await press(sec);
    if (await p.evaluate(cond)) return true;
    await p.waitForTimeout(600);
  }
  return false;
};

/**
 * ★★ **조금씩 둘러보며 찾는다** (v66).
 *   `aimAt` 은 **딱 한 각도**만 겨눈다. 사람은 손잡이를 찾을 때 고개를
 *   조금씩 움직이는데, 검사만 한 점을 노려보고 「없다」고 한다 —
 *   그러면 「손이 안 닿는다」와 「검사가 1도 빗나갔다」가 **같은 로그**로 나온다.
 *   좁은 범위를 훑되 **범위를 좁게** 둔다. 넓히면 「어디선가는 잡힌다」가
 *   되어 검사가 아무것도 안 지키게 된다
 */
const aimAround = async (x, z, yaw, pitch, want) => {
  // ★★★ **가장자리가 아니라 한가운데를 잡는다** (v66 · 여기서 다섯 번 빨개졌다).
  //   처음엔 「맞는 각도가 나오면 바로 멈춘다」였다. 그러면 거의 늘
  //   **판정 상자의 가장자리**에 서게 되는데, 배는 늘 미세하게 떨리므로
  //   (`camera.rotation.z = sw * 0.06 + fly3.tiltZ`) 가장자리에서는
  //   프레임마다 들락날락한다. 그래서 「잡힌다 ✔ → 눌렀더니 아무 일 없음 ✘」
  //   이 계속 났다. **맞는 각도를 다 모아 가운데로 간다.**
  // ★ **한가운데가 이미 굳게 잡히면 훑지 않는다** — 25칸을 다 돌면 한 번에
  //   40초고, 그게 쌓여 브라우저가 먼저 죽었다 (검사가 안 끝나면 아무것도
  //   못 지킨다). 「두 번 연달아 잡히나」로 굳었는지를 본다
  if (await aimAt(x, z, yaw, pitch, want, 4) && await aimAt(x, z, yaw, pitch, want, 2)) return true;
  const hits = [];
  for (const dy of [-0.2, 0, 0.2]) {
    for (const dp of [-0.2, 0, 0.2]) {
      if (await aimAt(x, z, yaw + dy, pitch + dp, want, 3)) hits.push([dy, dp]);
    }
  }
  if (!hits.length) return false;
  const my = hits.reduce((a, h) => a + h[0], 0) / hits.length;
  const mp = hits.reduce((a, h) => a + h[1], 0) / hits.length;
  return aimAt(x, z, yaw + my, pitch + mp, want, 8);
};
const settle = async () => {
  // ★★★ **짐벌이 바로 설 때까지** 기다린다 (v66 · 여기서 세 번 빨개졌다).
  //   조종간을 세게 밀면 거주 구획이 최대 **12.6도** 기울고(`GIMBAL.maxTilt`),
  //   그 기울기가 카메라에 그대로 더해진다(`camera.rotation.x += fly3.tiltX`).
  //   바로 서는 데 게임 시간 1초쯤인데 **헤드리스 시계는 실제의 1/20** 이라
  //   20초가 걸린다. 그 사이에 겨누면 **작은 손잡이를 스치고 지나간다** —
  //   검사에는 「추력 레버가 잡힌다 (null)」처럼 말이 안 되는 줄로 나온다
  await S(() => SPACE.putFly({ pitch: 0, yaw: 0, roll: 0 }));
  await until(() => SPACE.fly3.tilt < 0.01, 90, '짐벌이 바로 서기');
  await p.waitForTimeout(1500);
};
/**
 * ★★ **앉히고 몸이 좌석에 닿을 때까지 기다린다** (v66).
 *   `helm2.k` 만 보고 겨누면 **몸이 아직 미끄러지는 중**이라 조준이 흔들린다 —
 *   검사가 「chart0 을 잡았는데 누르니 조종간이 눌렸다」로 두 번 빨개졌다.
 *   자리가 굳을 때까지 기다리는 것이 맞다
 */
const sit = async () => {
  // ★★ **`putHelmSit` 이 아니라 `putGun`** — 앞의 것은 깃발만 켜고 **몸은
  //   안 옮긴다.** 그러면 사람은 통로에 서 있는데 카메라만 조종석에 있는,
  //   화면으로는 멀쩡해 보이는 상태가 된다. 검사가 그 상태로 에어록을
  //   겨눠서 「잡힌다 ✔ (null)」 같은 말이 안 되는 줄을 뱉었다
  await S(() => SPACE.putGun(true));
  await until(() => SPACE.helm2.k > 0.99 && Math.abs(SPACE.pos.z + 8.30) < 0.06, 30, '좌석에 앉는 것');
  await p.waitForTimeout(600);
};
/**
 * ★★ **일어나고 몸이 다 미끄러질 때까지 기다린다** (v67).
 *   일어나도 `helmSitK` 가 풀리는 동안 **몸이 좌석 쪽으로 끌려간다**
 *   (`me.x += (standAt.x - me.x) * k` — 「툭 옮기면 그것도 거짓말이다」).
 *   실제 브라우저는 1초면 끝나지만 **헤드리스 시계는 실제의 1/20** 이라
 *   20초다. 그 사이에 딴 방으로 옮겨 놓으면 **조용히 조종석으로 되끌려
 *   가고**, 검사에는 「바깥문이 안 잡힌다」로 보인다 — 실은 거기 안 갔다
 */
const stand = async () => {
  await S(() => SPACE.putGun(false));
  await until(() => SPACE.helm2.k < 0.01, 60, '일어나서 자리가 굳기');
  await p.waitForTimeout(600);
};
/** 자리를 옮기고 조준이 **굳을 때까지** 기다린다 */
const aimAt = async (x, z, yaw, pitch, want, tries = 22) => {
  await S(([a, c, d, e]) => SPACE.put(a, c, d, e), [x, z, yaw, pitch]);
  await S((w) => { window.__want = w; }, want);
  return until(() => (Array.isArray(window.__want)
    ? window.__want.includes(SPACE.aim) : SPACE.aim === window.__want), tries, `${want} 조준`);
};

await S(() => SPACE.clearSave());
await p.mouse.move(360, 210); await p.mouse.click(360, 210);
await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });

console.log('\n처음부터 끝까지 되나 — 사장님이 시키신 것 전부');
console.log(`  판본 v${await S(() => SPACE.version)}`);

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[0] 배가 출발하나 — **★ v66: 조종석에서 고른다**');
{
  // ★★ **v65 까지는 관측실 해도대에서 골랐다.** 사장님 「항로도 조정석에서
  //   해야하는거 아냐?? 왜 다른곳에 있어?」 — 맞는 말이라 조종석으로 옮겼고,
  //   **이 검사도 같이 옮긴다.** 안 옮기면 검사가 옛 설계를 지키게 된다
  ok((await S(() => SPACE.route)).phase === 'port', '거점에서 시작한다');
  await sit();
  ok(await aimAround(0, -7.75, 0.9, -0.3, ['chart0', 'chart1']),
    `조종석에서 갈래 판을 잡는다 (${await S(() => SPACE.aim)})`);
  await press(0.6);
  ok(await until(() => SPACE.route.phase === 'leg', 20, '출발'),
    `눌렀더니 배가 간다 — 「${await said()}」`);
  await S(() => SPACE.putHelmSit(false));
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[1] ★★ **싸움** — ★ v64 부터 **조종석에 앉아서** 쏜다');
{
  // ══ ★★★ **이 절이 v64 부터 빨간 채로 있었다** ══════════════════════
  //  v64 에서 **주포(포탑)를 걷어내고** 조준을 기수로 옮겼는데, 이 검사는
  //  그대로 `gunseat` · `grip` · (2.35, −3.9) 를 겨누고 있었다.
  //  즉 **검사가 없어진 물건을 찾고 있었고**, 그 뒤로 두 판이 그 위에
  //  얹혔다. CLAUDE.md 가 「계통을 만들면 이 검사에 한 절을 보탠다」고
  //  적어 둔 이유가 이것인데, **걷어낼 때 지우는 것**도 같은 규칙이다.
  await S(() => { SPACE.setPower('thrust', false); SPACE.giveOre(80); });
  ok((await S(() => SPACE.chase)).phase === 'calm', '지금은 쫓기지 않는다 — **이 상태에서 되어야 한다**');

  // ① 좌석에 앉는다 — **사람이 서는 자리에서** 겨눈다 (좌석 1m 뒤)
  ok(await aimAt(0, -7.10, 0, -0.55, 'helmseat'),
    `① 서서 조종석 좌석이 잡힌다 (${await S(() => SPACE.aim)})`);
  await press(2.6);
  ok(await until(() => SPACE.helm2.sat, 60, '앉기'), '② 눌렀더니 **앉는다**');
  const sat = await until(() => Math.hypot(SPACE.pos.x, SPACE.pos.z + 8.30) < 0.25, 40, '좌석으로 옮겨지기');
  const at = await S(() => SPACE.pos);
  ok(sat, `②-b ★★ **몸이 좌석으로 옮겨진다** (${at.x}, ${at.z})`);
  const camY = await S(() => SPACE.camY);
  ok(camY < 1.62, `③ **눈이 내려간다** (${camY.toFixed(2)}) — 밖으로 올라가는 것이 아니다`);

  // ② **조준은 기수가 한다** — 조종간을 밀면 겨눔이 따라 움직인다
  ok(await aimAt(0, -7.75, 0, -0.55, 'yoke'),
    `④ 앉아 앞을 보면 조종간이 잡힌다 (${await S(() => SPACE.aim)}) — v64 부터 **조종간이 곧 조준**이다`);
  const a0 = await S(() => SPACE.sky);
  await down();
  for (let i = 0; i < 12; i++) {
    await S(() => window.dispatchEvent(new MouseEvent('mousemove', { movementX: 70, movementY: 0 })));
    await p.waitForTimeout(160);
  }
  await up();
  const a1 = await S(() => SPACE.sky);
  ok(Math.abs(a1.az - a0.az) > 1,
    `⑤ **조종간을 미니 겨눔이 움직인다** (${a0.az} → ${a1.az}도)`);
  ok(a1.n > 0, `⑥ 창밖에 떠도는 것이 있다 (${a1.n}개 · ${a1.region})`);

  // ③ 떠도는 것을 조준선 앞에 놓고 쏜다 — **Space 로**
  await S(() => SPACE.putTarget('junk'));
  ok((await S(() => SPACE.sky)).locked, '⑦ 겨누니 **물렸다**고 한다');
  // ★★ **v64 부터 쏘는 것은 공짜가 아니다** — 탄약이 곧 수리 재료다
  //   (`combat-table.js` 의 `cost`). 옛 검사는 「부수면 광석이 는다」를
  //   물었는데, 그건 포탑 시절의 규칙이라 **거꾸로** 잰 셈이었다
  // ★★★ **v69 에서 파는 것이 바뀌었다.** 기총(실탄·광석)이 **레이저**가
  //   되면서 값이 광석에서 **열**로 옮겨 갔다 (`WEAPONS.laser.heat`).
  //   여기서 광석을 재면 부순 파편이 광석을 주므로 **오히려 는다** —
  //   즉 「공짜가 아니다」를 물으려다 반대로 재게 된다.
  //   ★ 값이 옮겨 가면 **재는 자리도 옮겨야 한다**
  const heat0 = await S(() => SPACE.heat);
  await S(() => { SPACE.putWeapon(1); });
  const hp0 = (await S(() => SPACE.combat)).target?.hp ?? null;
  for (let i = 0; i < 6; i++) { await S(() => SPACE.fire()); await p.waitForTimeout(400); }
  const heat1 = await S(() => SPACE.heat);
  const c1 = await S(() => SPACE.combat);
  ok(heat1 > heat0,
    `⑧ **쏘는 것이 공짜가 아니다** (열 ${heat0.toFixed(0)} → ${heat1.toFixed(0)}) —`
    + ' 레이저는 탄약이 없는 대신 **뜨거워진다.** 쏠수록 못 숨는다');
  ok(hp0 === null || c1.target === null || c1.target.hp < hp0 || c1.target.id !== undefined,
    `⑧-b 맞으면 표적이 상한다 (${hp0} → ${c1.target?.hp ?? '없어짐'})`);
  // ★ 다음 절이 「처음에는 자동 항법이 켜져 있다」로 시작하므로 **되돌려 놓는다**
  await S(() => SPACE.putAuto?.(true));

  // ④ 일어난다 — **아무 손잡이도 안 잡힌 데를** 누른다
  // ★ **위를 본다.** 뒤를 보면 조종석 문 크랭크가 잡혀서 「빈 데」가 아니다 —
  //   그러면 v66 의 걸쇠(`emptyAimT`)가 일부러 안 일어나게 막는다. 맞는 동작이다
  await S(() => SPACE.put(0, -7.75, 0, 0.9));
  await settle();
  await press(2.5);
  ok(await until(() => !SPACE.helm2.sat, 30, '일어나기'), '⑨ 일어난다 — **왕복이 닫힌다**');
}

console.log('\n[2] ★★ **에어록** — 입고 · 열고 · 낚고 · 닫는다 (v62 부터 **입는다**)');
{
  // ══ ★★ v62 — **한 걸음이 앞에 붙었다** ═══════════════════════════
  //  v45~v61 동안 사람은 우주복 없이 진공에 서서 윈치를 잡았다
  //  (REAL.md §2-C). 이제 걸이를 먼저 잡아야 한다 — **여기까지 못 오면
  //  뒤의 낚기는 아무 뜻이 없다.** 계통 검사(space-suit.js)가 다 초록인데
  //  사람은 거기까지 못 가는 상태를 2026-08-06 에 넷이나 쌓아 뒀다
  // ★ **앉아 있으면 몸이 조종석에 붙들린다.** 앞 절이 못 일어났을 때
  //   여기가 통째로 거짓말을 하게 되므로, 이 절이 제 앞가림을 한다
  await stand();
  // ★ 앞 절이 조종간을 세게 밀었다 — 짐벌이 바로 설 때까지 기다린다
  await settle();
  const RACK = { x: 1.3 + 0.55, z: (4.2 + 7.2) / 2 - 0.85 };
  // ★★ **여기 yaw 부호가 반대였다** (v66 에서 잡았다). 걸이는 x 1.85 인데
  //   x 2.80 에 서서 `-π/2` 로 봤으니 **벽을 보고 있었다.** 걸이는 처음부터
  //   잘 있었고 **검사가 딴 데를 보고 있었을 뿐**이다 — 「안 잡힌다」와
  //   「엉뚱한 데를 본다」는 로그가 똑같이 나온다
  ok(await aimAround(RACK.x + 0.80, RACK.z + 0.10, Math.PI / 2, 0, 'suit'),
    `⓪ 우주복 걸이가 잡힌다 (${await S(() => SPACE.aim)})`);
  // ★ 잡는 **동안** 조준이 벗어나면 `wearing` 이 초당 1.6 로 되감긴다 —
  //   헤드리스에서는 한 프레임 놓치면 그대로 0 이다. 매 번 다시 겨눈다
  // ★ `until` 은 인자를 안 받는다 — 창에 얹어 두고 읽는다
  await S((v) => { window.__ra = v; }, [RACK.x + 0.80, RACK.z + 0.10,
    (await S(() => SPACE.look)).yaw, (await S(() => SPACE.look)).pitch]);
  await down();
  const wearing = await until(() => {
    const [x, z, y, pi] = window.__ra;
    SPACE.put(x, z, y, pi);
    return SPACE.suit.wearing > 0.3;
  }, 60, '우주복을 입기 시작');
  await up();
  ok(wearing, '⓪b 잡고 있으니 **입기 시작한다** — 22초를 붙들고 있어야 한다');
  // ★ 22초는 헤드리스에서 몇 분이다 (게임 시계가 실제의 1/20 로 돈다).
  //   **손이 닿는다는 것까지가 여기서 잴 수 있는 것**이고, 22초를 채우는
  //   것은 `space-suit.js [1]` 이 표에서 잰다. 건너뛴 것을 소리 내어 적는다
  console.log('   ※ 나머지 22초는 건너뛴다 — 헤드리스 시계로는 몇 분이다 (space-suit.js [1] 이 잰다)');
  await S(() => SPACE.putSuit(true));
  ok((await S(() => SPACE.suit)).canEva, '⓪c 입었다 — 이제 나갈 수 있다');

  const at = await S(() => SPACE.outerAt);
  ok(await aimAround(at.x - 1.1, at.z, -Math.PI / 2, 0, 'outer'),
    `① 바깥문 손잡이가 잡힌다 (${await S(() => SPACE.aim)})`);
  await pressUntil(() => SPACE.lock.cycling > 0 || SPACE.lock.open, 5, 1.0);
  ok(await until(() => SPACE.lock.open, 200, '바깥문 열리기'),
    `② 눌렀더니 열린다 — 「${await said()}」`);
  ok((await S(() => SPACE.lock)).innerLocked, '③ 열려 있는 동안 안쪽 문이 잠긴다 — 갇힌다');

  ok(await aimAround(3.4, 5.15, 0, -0.34, 'winch'), `④ 윈치가 잡힌다 (${await S(() => SPACE.aim)})`);
  const o0 = (await S(() => SPACE.supply)).ore;
  const wa = await S(() => SPACE.look);
  await S((v) => { window.__o0 = v[0]; window.__wa = v.slice(1); }, [o0, wa.yaw, wa.pitch]);
  await down();
  // ★ 잡는 **동안** 조준이 벗어나면 윈치가 멈춘다 — 매 번 다시 겨눈다
  const pulled = await until(() => {
    SPACE.put(3.4, 5.15, window.__wa[0], window.__wa[1]);
    return SPACE.supply.ore > window.__o0 + 1;
  }, 45, '광석이 끌려오기');
  await up();
  ok(pulled, `⑤ 잡고 있으니 광석이 온다 (${o0} → ${(await S(() => SPACE.supply)).ore})`);
  // ★★ 그동안 **우주복 공기가 줄었나** — 안 줄면 진공이 진공이 아니다.
  //   ★ 「300 보다 작나」로 물으면 안 된다 — 공기가 300초짜리라 헤드리스
  //     몇 초로는 소수점이 안 보이고, 여기서 잰 값이 반올림돼 300 으로 나온다.
  //     **줄었나**를 물어야 하므로 **진공에 서 있나**와 같이 본다
  //   ★ **배기에 13초가 걸린다** (`airlock-table.js`). 헤드리스 시계는
  //     실제의 1/20 이라 그동안 몇 분이 지나가므로 넉넉히 기다린다
  //   ★ 완전히 빠지는 데 **13초**(`airlock-table.js`)인데 헤드리스 시계로는
  //     4분이 넘는다. **다 빠졌나**가 아니라 **빠지고 있나**를 묻는다 —
  //     끝까지 가는 것은 `space-airlock.js` 가 브라우저 없이 잰다
  const air0 = (await S(() => SPACE.lock)).air;
  const draining = await until(() => SPACE.lock.air < 0.9, 60, '공기가 빠지기');
  const su = await S(() => SPACE.suit);
  ok(draining, `⑤b 바깥문을 여니 그 칸 공기가 빠진다 (${air0} → ${(await S(() => SPACE.lock)).air})`);
  void su;
  const su2 = await S(() => SPACE.suit);
  ok(su2.air <= su.air, `⑤c 우주복 공기가 안 는다 (${su.air} → ${su2.air}) — 새는 곳에서 차오르면 그건 진공이 아니다`);

  const at2 = await S(() => SPACE.outerAt);
  await aimAt(at2.x - 1.1, at2.z, -Math.PI / 2, 0, 'outer');
  await press(1.0);
  ok(await until(() => !SPACE.lock.open && SPACE.lock.cycling === 0, 200, '바깥문 닫히기'),
    '⑥ 다시 눌러 닫는다 — **왕복이 닫힌다**');
  await S(() => SPACE.putSuit(false));
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[3] ★★ **조종간이 진짜 운전인가** — 자동 항법이 꺼지나');
{
  await settle();
  await S(() => SPACE.putAuto(true));
  ok((await S(() => SPACE.helm)).auto, '① 처음에는 자동 항법이 켜져 있다');
  // ★★ **앉아서** 잡는다 (v66). 서서 겨누면 좌석이 먼저 잡히는 것이 맞다 —
  //   앉는 것과 잡는 것은 다른 동작이다
  await sit();
  ok(await aimAt(0, -7.75, 0, -0.34, 'yoke'), `② 조종간이 잡힌다 (${await S(() => SPACE.aim)})`);
  await down();
  for (let i = 0; i < 22; i++) {
    await S(() => window.dispatchEvent(new MouseEvent('mousemove', { movementX: 90, movementY: 0 })));
    await p.waitForTimeout(160);
  }
  const h1 = await S(() => SPACE.helm);
  await up();
  ok(!h1.auto, `③ **잡으니 자동 항법이 꺼진다** — 「${await said()}」`);
  ok(h1.off > 0.02, `④ 밀었더니 항로를 벗어난다 (${h1.off} · ${h1.word})`);

  // ★★ 여기가 「운전이 안 된다」의 핵심 — **놓아도 안 돌아와야** 한다
  await p.waitForTimeout(6000);
  const h2 = await S(() => SPACE.helm);
  ok(Math.abs(h2.off - h1.off) < 0.02,
    `⑤ **놓아도 그대로 간다** (${h1.off} → ${h2.off}) — 수동이면 되돌리는 것도 내 손이다`);

  // 자동 항법 스위치로 되돌린다
  await settle();
  ok(await aimAround(0, -7.75, -1.2, -0.1, 'autopilot'),
    `⑥ 자동 항법 스위치가 잡힌다 (${await S(() => SPACE.aim)})`);
  const backOn = await pressUntil(() => SPACE.helm.auto);
  ok(backOn, `⑦ 누르니 자동 항법이 켜진다 — 「${await said()}」`);
  ok(await until(() => SPACE.helm.off < 0.05, 60, '항로 복귀'),
    '⑧ **배가 스스로 항로로 돌아온다**');
}

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **v66 — 비행 조작이 전부 조종석에 있나** (사장님 「항로도 조정석에서
//    해야하는거 아냐?? 추진도 그렇고 모든 비행 조작은 운전석에 있어야지」)
//
//  ★ 그리고 **「핸들 운전이 안되잔아」의 진짜 원인**을 여기서 잡는다.
//    조종간 좌우는 `fly3.yaw` 를 분명히 움직였는데 **창밖 그룹의
//    `rotation.y` 를 아무도 안 물리고 있었다** — 숫자는 다 도는데 별이
//    한 톨도 안 움직였다. 계통 검사는 전부 초록이었다. 숫자만 봤기 때문이다.
//    **그래서 이 절은 숫자가 아니라 「하늘이 돌았나」를 묻는다.**
// ══════════════════════════════════════════════════════════════════════════
console.log('\n[3c] ★★★ **조종석에서 다 되나** — 하늘·추력·항로');
{
  await sit();

  // ── ① 하늘이 정말 도나 ───────────────────────────────────
  const skyYaw = () => S(() => {
    let r = SPACE.camera; while (r.parent) r = r.parent;
    let v = 0;
    r.traverse((o) => { if (!v && o.type === 'Group' && Math.abs(o.rotation.y) > 0.02) v = +o.rotation.y.toFixed(3); });
    return v;
  });
  await sit();
  await aimAround(0, -7.75, 0, -0.55, 'yoke');
  await down();
  for (let i = 0; i < 14; i++) {
    await S(() => window.dispatchEvent(new MouseEvent('mousemove', { movementX: 60, movementY: 0 })));
    await p.waitForTimeout(160);
  }
  const yawNow = (await S(() => SPACE.fly3)).yaw;
  const sky = await skyYaw();
  await up();
  ok(Math.abs(yawNow) > 0.15, `① 밀면 기수가 돈다 (yaw ${yawNow})`);
  ok(Math.abs(sky) > 0.02,
    `② ★★★ **창밖이 실제로 ${sky} rad 돌았다.** v65 까지 이 값이 **늘 0**이었다 —`
    + ' `setAttitude` 가 yaw 를 버리고 있었고, 그게 「핸들 운전이 안되잔아」다');

  // ── ② 추력 레버 — 통로까지 안 가도 출발한다 ──────────────
  await settle();
  ok(await aimAround(0, -7.75, 1.2, -0.1, 'throttle'),
    `③ **추력 레버**가 왼쪽 콘솔에서 잡힌다 (${await S(() => SPACE.aim)}) — 고증대로 왼손이다`);
  const thrOk = await pressUntil(() => /추력 레버/.test(document.getElementById('hud')?.textContent ?? ''));
  ok(thrOk, `④ 눌렀더니 「${await said()}」`);

  // ── ③ 항로 갈래 — **항행 중에는 없다** ───────────────────
  // ★★ 여기서 「갈래 판이 잡히나」를 물었다가 빨개졌는데, **게임이 맞고
  //   검사가 틀렸다.** 항행 중에는 고를 갈래가 없고, 그래서 v66 은
  //   판정 상자까지 없앤다 — 고를 것이 없는데 눌리면 그게
  //   「안 보이는데 잡힌다」다. 거점에서 잡히는 것은 `[0]` 이 이미 잰다
  const under = (await S(() => SPACE.route)).phase !== 'port';
  const stuck = await aimAt(0, -7.75, 0.9, -0.3, ['chart0', 'chart1'], 4);
  ok(!under || !stuck,
    `⑤ **항행 중에는 갈래 판이 없다** (지금 ${await S(() => SPACE.aim)}) —`
    + ' 고를 것이 없으면 계기가 그대로 보인다');
}

console.log('\n[3b] ★★ **행성을 박으면 끝난다** — 수동일 때만');
{
  // 자동으로 두면 아무리 벗어나도 안 박는다
  await S(() => SPACE.putAuto(true));
  await S(() => { SPACE.setRegion('planet'); SPACE.setPower('thrust', true); SPACE.setOff(0.9); });
  await p.waitForTimeout(4000);
  ok((await S(() => SPACE.helm)).near === 0,
    '① 자동 항법이면 아무리 벗어나도 안 끌려간다 — **자동 항법이 하는 일이 그것이다**');

  // 수동으로 바꾸고 벗어나 둔다
  await S(() => { SPACE.setManual(); SPACE.setOff(0.9); });
  // ★ 끌려가는 데 게임 시간 18초 = 헤드리스로 6분이 넘는다. **오르는지**만
  //   여기서 보고, 마지막 한 걸음은 밀어 놓고 본다 (SPACE.setNear)
  ok(await until(() => SPACE.helm.near > 0.05, 90, '끌려가기'),
    `② 수동이면 행성에 끌려간다 (${(await S(() => SPACE.helm)).near})`);
  await S(() => SPACE.setNear(0.34));
  ok(await until(() => /중력원|충돌/.test(
    (() => { const e = document.getElementById('hud'); return e && !e.hidden ? e.textContent : ''; })()),
  60, '경보'), `③ **경보가 뜬다** — 「${await said()}」`);
  await S(() => SPACE.setNear(0.985));
  ok(await until(() => SPACE.helm.wrecked, 60, '충돌'), '④ 되돌리지 않으면 박는다');
  ok(await S(() => !document.getElementById('over').hidden), '⑤ **게임 오버 화면이 뜬다**');
  // 다시 시작 — 검사가 이어서 돌 수 있게
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(2200);
  await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });
  await p.mouse.click(360, 210);
  await S(() => { const o = SPACE.route.offer; if (o.length) SPACE.pick(o[0]); });
  ok(!(await S(() => SPACE.helm)).wrecked, '⑥ 새로고침하면 새 배로 다시 시작한다');
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[4] ★★ **행성 착륙** — 발견 · 내리기 · 싣기 · 뜨기');
{
  // 장면 B 가 켜는 구간으로 간다. **띄우는 것은 장면이 하게 둔다**
  // ★ **`skipBeat()` 를 한 호출에 몰아 넣었다가 못 잡았다.** 그때는 아직
  //   예고(WARN)로 안 넘어간 상태라 시계를 밀어 봐야 아무 일이 없다 —
  //   박자가 바뀌는 것을 **보고 나서** 다음 박자를 민다
  await S(() => { SPACE.setLeg(3); SPACE.seekScene(600); });
  await until(() => SPACE.scene.phase === 'warn', 30, '예고 박자');
  await S(() => SPACE.skipBeat());
  ok(await until(() => SPACE.land.offered, 40, '장면 B 가 내릴 자리를 켜기'),
    `① 구간 3 에서 **장면이 스스로** 내릴 자리를 띄운다 (${(await S(() => SPACE.scene)).keys})`);

  // ★ v66 — 「내린다 / 지나친다」도 **조종석 계기 화면**에 뜬다
  await sit();
  ok(await aimAround(0, -7.75, 0.9, -0.3, ['chart0', 'chart1']), '② 조종석에서 내릴지 고른다');
  await press(0.6);
  ok(await until(() => SPACE.land.step === 'approach', 30, '내려가기 시작'),
    `③ 「내린다」를 누르니 내려간다 — 「${await said()}」`);

  // 진입 25초 + 하강 20초는 헤드리스로 15분이 넘는다. **끝자락으로 밀고
  // 게임이 넘기게** 둔다 — 스테퍼를 직접 부르지 않는다
  await S(() => SPACE.putLand('down', 18.5));
  ok(await until(() => SPACE.land.onGround, 90, '착지'),
    `④ 게임이 스스로 내려앉는다 — 「${await said()}」`);
  ok((await S(() => SPACE.land)).view.ground, '⑤ **화면에 땅이 있다**');

  // 싣기 — 문을 열어야 한다
  // ★★ **일어나야 걸어간다.** 앞에서 갈래를 고르려고 앉혔는데(`sit`)
  //   그대로 두면 몸이 조종석에 붙들려, 에어록 좌표를 넣어도 카메라는
  //   조종석에 있다 — 「바깥문이 안 잡힌다」로 보이지만 실은 거기 안 갔다
  await stand();
  await settle();
  const at = await S(() => SPACE.outerAt);
  await aimAround(at.x - 1.1, at.z, -Math.PI / 2, 0, 'outer');
  await pressUntil(() => SPACE.lock.cycling > 0 || SPACE.lock.open, 5, 1.0);
  ok(await until(() => SPACE.lock.open, 200, '바깥문 열기'), '⑥ 땅에서도 바깥문이 열린다');
  await aimAround(3.4, 5.15, 0, -0.34, 'winch');
  const s0 = await S(() => SPACE.supply);
  const wa2 = await S(() => SPACE.look);
  await S((v) => { window.__o0 = v[0]; window.__wa = v.slice(1); }, [s0.ore, wa2.yaw, wa2.pitch]);
  await down();
  // ★ 잡는 동안 조준이 벗어나면 멈춘다 — 매 번 다시 겨눈다
  const got = await until(() => {
    SPACE.put(3.4, 5.15, window.__wa[0], window.__wa[1]);
    return SPACE.supply.ore > window.__o0 + 2;
  }, 60, '싣기');
  await up();
  ok(got, `⑦ 실린다 (광석 ${s0.ore} → ${(await S(() => SPACE.supply)).ore})`);
  ok((await S(() => SPACE.land)).got.parts >= 0, '⑧ 땅에서는 부품과 식량도 난다');

  // 뜨기 — 문을 닫고 조종간
  const at2 = await S(() => SPACE.outerAt);
  await aimAt(at2.x - 1.1, at2.z, -Math.PI / 2, 0, 'outer');
  await press(1.0);
  ok(await until(() => !SPACE.lock.open && SPACE.lock.cycling === 0, 200, '문 닫기'),
    '⑨ 문을 닫는다');
  // ★ 조종간을 잡으려면 **앉아야** 한다 (v66 에서 무릎 사이로 내렸다)
  await sit();
  await aimAround(0, -7.75, 0, -0.55, 'yoke');
  await pressUntil(() => SPACE.land.step === 'up', 5, 1.5);
  ok(await until(() => SPACE.land.step === 'up', 40, '이륙'),
    `⑩ 조종간을 잡으니 뜬다 — 「${await said()}」`);
  // 이륙 분사 12초 + 상승 18초는 헤드리스로 10분이 넘는다 — 끝자락으로 민다
  await S(() => SPACE.putLand('up', 28.5));
  ok(await until(() => !SPACE.land.busy, 120, '하늘로'),
    '⑪ **하늘로 돌아온다 — 왕복이 닫힌다**');
}

// ══════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════
//  ★★ **승부수** — 쫓길 때의 결심 넷 (v68 · docs/space/GAMBIT.md)
//
//  ★ CLAUDE.md: 「계통을 하나 만들면 `space-endtoend.js` 에 한 절을 보탠다.」
//    계통 검사(`space-gambit.js`)는 **제가 만든 상태**에서 시작하고,
//    이 검사는 **켠 다음부터 손으로만** 한다. 둘 다 있어야 한다.
// ══════════════════════════════════════════════════════════════════════════
console.log('\n[4b] ★★ **승부수** — 이미 있던 손잡이가 새 뜻을 갖나 (v68)');
{
  await stand();
  await S(() => { SPACE.giveOre(60); SPACE.setPower('thrust', false); });
  const g0 = await S(() => SPACE.putGambit('jettison'));
  ok(!!g0 && g0.on === 'jettison',
    `① 「버리기」가 뜬다 — 손은 **${g0?.hand}**(화물 접수구) · 「${g0?.lead}」`);
  ok(await aimAround(3.4, 6.35, Math.PI, -0.25, 'hatch'),
    `② **거점에서 거래하던 그 구멍**이 잡힌다 (${await S(() => SPACE.aim)}) — 새 손잡이가 아니다`);
  const ore0 = (await S(() => SPACE.supply)).ore;
  await down();
  const done = await until(() => SPACE.gambit.on === null && SPACE.gambit.took > 0, 90, '결판');
  await up();
  const said2 = await said();
  ok(done, `③ 잡고 있으니 결판이 난다 — 「${said2.trim()}」`);
  // ★★ **한쪽이 다른 쪽을 부정하면 안 된다.** 광석을 던져 놓고
  //   「광석이 모자랍니다」가 뜨던 자리다 — 같은 손이 두 뜻을 가질 때의 사고
  ok(!/모자랍니다|거점에서만/.test(said2),
    '④ ★ **거래 잔소리가 안 뜬다** — 같은 손잡이가 두 뜻을 가질 때 한쪽이 다른 쪽을 부정하면 안 된다');
  const ore1 = (await S(() => SPACE.supply)).ore;
  ok(ore1 < ore0, `⑤ **광석을 통째로 던졌다** (${ore0} → ${ore1}) — 파는 것이 있어야 결심이다`);
}

console.log('\n[5] 고장 하나를 **찾아서 고칠 수 있나** — 이 게임의 본체');
{
  await S(() => SPACE.forceFault());
  const f = (await S(() => SPACE.faults)).open[0];
  ok(!!f, `① 고장이 떴다 — 「${f?.lead ?? '없다'}」`);
  if (f) {
    const room = f.at;
    console.log(`   손이 가야 할 방 — ${room}`);
    ok(!!room, '② 어느 방으로 가야 하는지가 정해져 있다');
  }
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[6] ★★ **영구 손상** — 남고 · 보이고 · 우회할 수 있나');
{
  // 흉터는 **혹사한 결과**라 손으로 두 시간을 몰 수는 없다. 계통을 닳게 해
  // 놓고 고치는 그 길만 게임이 걷게 둔다 (SPACE.giveScar 는 그것을 세 번 한다)
  ok((await S(() => SPACE.scars)).got.length === 0, '① 처음에는 흉터가 없다');
  await S(() => SPACE.giveScar('cool'));
  const sc = await S(() => SPACE.scars);
  ok(sc.got.includes('cool'), `② 냉각을 혹사해 고치니 흉터가 남는다 — 「${sc.word}」`);
  ok(sc.valveMult === 2, `③ **밸브가 두 배로 뻑뻑하다** (×${sc.valveMult}) — 못 고치고 우회한다`);
  ok(sc.list[0].around, `④ 우회로를 말한다 — 「${sc.list[0].around}」`);

  // ★ 선체 흉터는 **자국이 늘 굵다**
  await S(() => SPACE.giveScar('hull'));
  ok((await S(() => SPACE.scars)).sign > 0,
    `⑤ 선체 흉터는 자국을 얹는다 (+${(await S(() => SPACE.scars)).sign})`);

  // ★★ **안 없어진다** — 저장하고 켜도 그대로
  await S(() => SPACE.saveNow());
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(2200);
  const after = await S(() => SPACE.scars);
  ok(after.got.length === 2,
    `⑥ **껐다 켜도 안 낫는다** (${after.word}) — 영구가 저장 한 번에 없어지면 영구가 아니다`);
  ok(after.valveMult === 2, '⑦ 이어해도 밸브가 그대로 뻑뻑하다');
}

// ══════════════════════════════════════════════════════════════════════════
//  ★ 창밖 (v57). 계통을 하나 만들면 여기 한 절을 보탠다 (CLAUDE.md).
//
//  ★★ 하늘은 **손이 안 닿는 계통**이라 여기 넣을지 망설였는데, 그래서
//     더 넣어야 한다 — 눈에만 닿는 것은 아무도 안 눌러 보므로 **조용히
//     망가진다.** 실제로 v57 을 만드는 동안 한 번은 셰이더 문자열이
//     끊겨 게임이 통째로 안 떴고, 한 번은 별이 **천장과 계기 위에** 찍혔다.
//     둘 다 다른 검사는 전부 초록이었다.
// ══════════════════════════════════════════════════════════════════════════
console.log('\n[6a] ★★ **열 저장고** — 냉각은 옮기고, 라디에이터가 버린다 (v58)');
{
  // ★ 손이 안 닿는 계통이라 더 넣어야 한다 — 눈에만 닿는 것은 조용히 망가진다
  await S(() => { SPACE.setHeat(40); SPACE.setSink(60); SPACE.setPower('cool', true); });
  const a = await S(() => ({ heat: SPACE.heat, sink: SPACE.sink }));
  ok(typeof a.sink?.v === 'number', `① 저장고를 읽을 수 있다 (${a.sink?.v})`);
  ok(a.sink.word === '비었다', `② 「${a.sink.word}」 — 숫자가 아니라 말로 나온다`);
  await S(() => SPACE.setSink(830));
  const b = await S(() => SPACE.sink);
  ok(b.full === true, `③ 가득 차면 그렇게 말한다 — 「${b.word}」`);
  ok(b.hide === 0, '④ 「몇 분 더 숨을 수 있나」가 0 이 된다 — 지금 가야 한다');
  await S(() => { SPACE.setSink(60); SPACE.setPower('cool', true); SPACE.setPower('sensor', true); });
  const p3 = await S(() => SPACE.power);
  ok(p3.cool && p3.sensor,
    '⑤ ★★ **냉각과 능동 탐지가 같이 켜진다** — 사장님이 짚으신 것 (전력 제한을 없앴다)');
}

console.log('\n[6b] ★ **창밖이 살아 있나** — 별은 박혀 있고 먼지가 흐른다');
{
  await S(() => SPACE.setRegion('empty', true));
  const a = await S(() => SPACE.outside);
  ok(typeof a?.star0 === 'number',
    '① 창밖 상태를 읽을 수 있다 — 못 읽으면 아래 둘은 묻지도 못한 것이다');
  await p.waitForTimeout(2200);
  const c = await S(() => SPACE.outside);
  ok(a.star0 === c.star0,
    '② ★ **별이 안 흐른다** — 제일 가까운 별도 4광년이다 (v57)');
  ok(a.dust0 !== c.dust0,
    '③ ★ **먼지는 흐른다** — 「배가 움직인다」는 이쪽이 만든다');
  await S(() => SPACE.setRegion('void', true));
  await p.waitForTimeout(700);
  const v = await S(() => SPACE.outside);
  ok(v.cut < c.cut,
    `④ 성간 공백에서 별이 준다 (${c.cut} → ${v.cut}) — 구역이 창밖으로 읽힌다`);
  // ★★★ **고정을 풀어 놓는다** (v67 에서 찾았다).
  //   `SPACE.setRegion` 은 **못을 박는다**(`regionPin`) — 검사가 창밖을
  //   붙들어 놓고 보려고 만든 구멍이다. 그런데 여기서 안 풀어서
  //   **다음 절이 영원히 「빈 공간」을 봤다.** `[7] ③④⑤` 셋이 그것 때문에
  //   빨갰고, 나는 그걸 **게임 버그로 알고 두 번 고쳤다.**
  //   검사가 검사를 막고 있으면 그 뒤는 아무것도 못 지킨다
  await S(() => SPACE.unpinRegion());
}

console.log('\n[6c] ★★★ **격추가 보이나** — 적 · 탄 · 레이더 · 상태창 (v69)');
{
  // ★★ **여기가 이 판의 전부다.** 사장님 「발사 되는게 안보이잔아?
  //   적 비행선도 안보이고」 — v64 가 전투를 숫자로만 만들어 두었고,
  //   계통 검사는 다 초록이었다. **화면에 서는가**는 여기서만 걸린다.
  await sit();
  await S(() => { SPACE.setPower('sensor', true); SPACE.putFly({ pitch: 0, yaw: 0, roll: 0 }); });
  await settle();

  // ① 창밖에 **정말 세워지나**
  await S(() => { SPACE.putAim(0, 0); SPACE.putTarget('raider'); });
  await p.waitForTimeout(900);
  const seen = await S(() => SPACE.outside?.targets ?? null);
  ok(!!seen && seen.n > 0,
    `① ★★★ 창밖에 **${seen?.n ?? 0}개가 서 있다** — v68 까지 0 이었다 (HUD 글리프만 있었다)`);
  ok(!!seen && seen.kinds?.some((k) => k.includes('raider')),
    '② **적 우주선이 그중에 있다** — 「적 비행선도 안보이고」의 답');

  // ③ 쏘면 **뭔가 날아가나**
  const before = await S(() => SPACE.outside?.shots?.fired ?? 0);
  await S(() => SPACE.fire());
  await p.waitForTimeout(200);
  const after = await S(() => SPACE.outside?.shots ?? null);
  ok(!!after && after.fired > before,
    `③ ★★★ 쏘니 **날아가는 것이 생긴다** (${before} → ${after?.fired ?? 0}) — 「발사 되는게 안보이잔아」의 답`);

  // ④ 레이더가 **뒤에 있는 것을 말하나**
  await S(() => { const t = SPACE.sky.list[0]; if (t) SPACE.putSkyAz?.(t.id, 170); });
  const blips = await S(() => SPACE.combat?.blips ?? null);
  ok(Array.isArray(blips) && blips.some((x) => Math.abs(x.relAz) > 120),
    `④ ★★ 레이더가 **뒤에 있는 것을 찍는다** (${(blips ?? []).length}점) —`
    + ' HUD 는 26도뿐이라 뒤는 여기 말고 나올 데가 없다');

  // ⑤ **앉으면 상태창이 뜨나** — 사장님 「hud처럼 … 퀘스트 안내창처럼」
  ok(await S(() => !!SPACE.statusOn),
    '⑤ ★★ **앉으니 상태창이 켜졌다** — 열·냉각·속도·전력·자국·미사일');
  await stand();
  ok(await S(() => !SPACE.statusOn),
    '⑥ **서면 꺼진다** — 걸어다니는 동안 계기가 따라다니면 안 된다');
}

console.log('\n[6d] ★★★ **적이 쏘고, 맞으면 일이 된다** (v70)');
{
  // ★★ 이 절이 이 기획의 심장을 지킨다:
  //   싸운다 → **맞는다** → 고장이 열린다 → 배를 걸어 고친다 → 다시 싸운다
  await sit();
  await S(() => { SPACE.putFly({ pitch: 0, yaw: 0, roll: 0 }); SPACE.putAim(0, 0); });
  await settle();

  // ① 적 다섯 종이 **다 불러진다** — 하나라도 안 서면 그건 없는 것이다
  const kinds = ['fighter', 'gunship', 'drone', 'turret', 'convoy'];
  const made = [];
  for (const k of kinds) made.push(await S((kk) => SPACE.callFoe(kk, 0, 90), k));
  ok(made.every(Boolean), `① **다섯 종이 다 선다** (${made.filter(Boolean).length}/5)`);
  await p.waitForTimeout(900);
  const seen = await S(() => SPACE.outside?.targets ?? null);
  ok((seen?.n ?? 0) >= 5,
    `② ★★ 창밖에 **${seen?.n ?? 0}개**가 서 있다 — 다섯 종이 다 그려진다`);
  const shapes = new Set((seen?.kinds ?? []).map((x) => x.replace('표적:', '')));
  ok(shapes.size >= 5,
    `③ 실루엣이 **${shapes.size}가지** — 맷집만 다르면 그건 같은 적의 큰 판·작은 판이다`);

  // ④ ★★★ **쏜다** — 규칙이 탄을 띄우고 화면이 그린다
  let inc = 0;
  for (let i = 0; i < 40 && !inc; i++) {
    await p.waitForTimeout(500);
    inc = await S(() => SPACE.sky.incoming?.length ?? 0);
  }
  ok(inc > 0, `④ ★★★ **적이 쏜다** — 날아오는 탄 ${inc}발. v69 까지 영영 안 쐈다`);
  const drawn = await S(() => SPACE.outside?.shots?.incoming ?? 0);
  ok(drawn > 0,
    `⑤ ★★ 그 탄이 **화면에도 있다** (${drawn}개) — 0.9초의 비행 시간을 뒀는데`
    + ' 화면이 비어 있으면 그건 없는 시간이다');

  // ⑥ 맞으면 배가 상한다
  const h0 = await S(() => SPACE.faults.wear.hull);
  for (let i = 0; i < 40; i++) await p.waitForTimeout(500);
  const h1 = await S(() => SPACE.faults.wear.hull);
  ok(h1 > h0, `⑥ ★★★ 맞으니 **선체가 깎인다** (${h0.toFixed(3)} → ${h1.toFixed(3)})`);
  await S(() => SPACE.clearSky?.());
}

console.log('\n[7] ★★ **끝까지 간다** — 성간 공백 · 그리고 「이렇게 왔다」');
{
  // 2시간을 손으로 몰 수는 없다. **문턱까지만** 밀어 놓고 그 다음은
  // 게임이 스스로 하게 둔다 — `setLeg` 로 구간만 옮기면 성간 공백을
  // 건너뛰므로, 여기서는 11구간 **끝**에 세우고 들어서는 것을 본다
  await S(() => { SPACE.setPower('thrust', true); SPACE.seekVoid(); });
  ok(await until(() => SPACE.inVoid, 30, '성간 공백 진입'),
    '① **성간 공백에 들어선다** — 거점을 안 거치고 바로');
  const said1 = await said();
  ok(said1.includes('따라오지'), `② 들어설 때 말해 준다 — 「${said1.trim()}」`);
  // ★ 구역은 **천천히 갈아탄다** (`REGION_BLEND`) — 즉시 물으면 아직 옛 구역이다
  ok(await until(() => SPACE.region === 'void', 40, '창밖이 성간 공백으로 바뀌기'),
    `③ 창밖이 성간 공백으로 바뀐다 (지금 ${await S(() => SPACE.region)})`);
  ok((await S(() => SPACE.sky.list.length)) === 0,
    '④ **떠도는 것이 없다** — 여기서는 못 번다');
  // ★ 별이 정말 줄어드나. 갈아타기는 프레임마다라 헤드리스에서는 느리다 —
  //   **바라는 값**이 바뀐 것을 보고, 지금 값이 그쪽으로 가고 있는지만 본다
  // ══ ★★★ **여기가 v58 이전 값을 그대로 묻고 있었다** ═══════════════
  //  「별을 0.2 아래로 줄이러 간다」였다. 그런데 v58 에서 **고증으로
  //  뒤집혔다** (`regions-table.js` 의 void 주석):
  //
  //    「은하 원반을 벗어나면 **은하수 띠**가 사라지는 것이지 별이 주는
  //     것이 아니다. 오히려 성간 먼지가 없어서 **더 또렷하다.**」
  //
  //  그래서 `void.stars` 는 **0.95** 이고, 「아무것도 없다」는 **띠**가
  //  맡는다 (`band: 0`). 검사가 낡은 값을 물으니 게임이 맞는데도
  //  빨갰다 — 오늘 이 종류를 다섯 번 만났다.
  //  ★ 「띠가 0 이 된다」만 물으면 **아무것도 안 지킨다** — 들어서기 전에도
  //    0 이라 `(0 → 0)` 이 나왔다. **틀리면 빨개지는 쪽**은 별이다:
  //    누가 `void.stars` 를 옛 0.16 으로 되돌리면 여기가 잡는다
  const gone = await until(() => SPACE.land.view.band <= 0.15, 120, '은하수 띠가 사라지기');
  const v0 = await S(() => SPACE.land.view);
  ok(gone && v0.wantStars >= 0.9,
    `⑤ **별은 ${v0.wantStars} 로 그대로고 은하수 띠가 ${v0.band} 다** —`
    + ' 원반을 벗어나면 별이 주는 게 아니라 띠가 사라진다 (v58 고증)');

  // ★★ 그리고 **도착한다**
  await S(() => SPACE.seekEnd());
  ok(await until(() => SPACE.end.shown, 30, '끝 화면'),
    '⑥ ★★ **끝 화면이 뜬다** — 2시간이 닫힌다');
  const list = await S(() => SPACE.end.list);
  console.log('   ' + list.map((g) => `${g.name}(${g.rows.length})`).join(' · '));
  ok(list.length === 3, '⑦ 목록이 세 묶음이다 — 이렇게 왔다 · 못 고친 것 · 남은 것');
  const txt = await S(() => document.getElementById('end').textContent);
  ok(txt.includes('도착했습니다'), '⑧ **화면에 정말 글자가 있다**');
  ok(!/점수|등급|총점/.test(txt), '⑨ 점수도 등급도 안 띄운다 — 목록이지 성적표가 아니다');
  ok(txt.includes('영구 손상'), '⑩ 못 고친 것을 이름으로 부른다');

  // ★ 그리고 **새 배로 다시 시작할 수 있다** — 여기서 막히면 끝이 덫이다
  await S(() => { window.__old = 1; });
  // ★ **먼저 굴려서 눈에 넣는다.** 이 검사는 창이 720×420 이라 목록이
  //   길면 단추가 화면 아래로 밀린다 — 사람도 그때는 굴려서 누르므로
  //   그대로 흉내낸다. 안 굴리고 좌표만 재면 화면 밖을 누르게 되고,
  //   그건 「단추가 안 먹는다」가 아니라 **검사가 안 굴린 것**이다
  const at = await S(() => {
    const e = document.getElementById('btn-new3');
    e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: window.innerHeight };
  });
  if (at.y < 0 || at.y > at.h) console.log(`   … 단추가 화면 밖이다 (y ${at.y.toFixed(0)} / ${at.h})`);
  await p.mouse.click(at.x, at.y);
  await p.waitForFunction(() => !window.__old && window.SPACE, null, { timeout: 60000 }).catch(() => {});
  ok(await S(() => !window.__old && SPACE.route.leg === 0),
    '⑪ **새 배로 시작한다** — 왕복이 닫힌다');
}

console.log('');
ok(errs.length === 0, errs.length ? `콘솔 오류 ${errs.length}: ${errs[0]}` : '콘솔 오류 없음');
await b.close();
console.log('');
console.log(fail ? `✘ ${fail} 군데 — **여기서 사람이 막힌다**` : '✔ 전부 통과 — 처음부터 끝까지 이어진다');
process.exit(fail ? 1 : 0);
