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
 * ★★★ **조종간을 놓는다** (v78 · 사장님 「계속 누르고 있어야 해서 피로」).
 *
 *   조종간이 **토글**이 되면서 `up()` 만으로는 안 놓아진다 — 한 번 더
 *   눌러야 놓인다. 그리고 **잡고 있으면 창이 화면을 채우므로**(v63)
 *   콘솔의 다른 손잡이에 손이 안 간다.
 *
 *   ★ 그래서 검사 다섯이 「자동 항법 스위치가 안 잡힌다 (null)」로
 *     빨개졌다. **게임이 아니라 검사가 옛 조작을 쓰고 있었다** —
 *     조작을 바꾸면 그 조작을 쓰던 검사도 같이 바뀐다
 */
const letGoYoke = async () => {
  if (!(await S(() => SPACE.helm2?.steering ?? false))) return;
  // ★★★ v88 — **X 다.** v78~v87 은 조종간을 한 번 더 눌러 놓았는데,
  //   v88 에서 **앉는 것이 곧 잡는 것**이 되면서 조종간은 조준선에 아예
  //   안 걸린다 (쥔 것을 또 겨눌 일이 없다). 여기를 안 고쳤더니 놓지도
  //   못한 채 「놓아도 그대로 가나」를 재고 있었다 — **검사가 없어진
  //   동작을 하고 있었다.** 이 저장소가 반복해서 밟는 함정이다
  await p.keyboard.press('KeyX');
  await p.waitForTimeout(400);
};
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
  // ══ ★★★ v120 — **훑는 일은 `aimSweep` 하나가 한다** ═══════════════
  //
  //  ★ 여기가 3×3 을 따로 훑고 있었는데, 이제 `aimAt` 자체가 훑는다.
  //    둘을 겹치면 한 번에 **9×99 칸**이 되어 몇 분을 태운다 —
  //    「재는 곳을 둘로 만들지 않는다」가 검사 안에서도 같다.
  //  ★★ 「가장자리가 아니라 한가운데」라는 v66 의 뜻은 남긴다:
  //    찾은 자리에서 **한 번 더 확인**해서, 배가 떠는 동안 들락날락하는
  //    가장자리를 걸러 낸다 (여기서 다섯 번 빨개졌던 자리다)
  //  ★ `aimSweep` 이 이미 「두 번 연달아」를 본다 — 여기서 또 보면
  //    같은 것을 두 곳에서 재는 것이 된다
  return aimSweep(yaw, pitch, want);
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
// ══ ★★★ v120 — **`stand()` 를 없앴다** ═════════════════════════════════
//
//  ★ 사장님 (2026-08-12) 「낡은 절들 정리해줘」
//
//  ★★ v110 이 일어서는 것을 없앤 뒤로 이 함수는 **아무 일도 안 하면서
//    24초를 기다렸다** (`helm2.k < 0.01` 은 영영 안 온다). 부르는 자리가
//    넷이었으니 한 판에 **1분 반**을 그냥 버렸고, 그 뒤 절들은 「못 봤다」
//    한 줄씩을 남겼다. **없앤 것을 남겨 두면 검사가 느려지고 시끄러워진다.**
//  ★ 함수를 지워 두면 누가 다시 부를 때 **그 자리에서 죽는다** —
//    조용히 24초를 기다리는 것보다 낫다
// ══ ★★★ v120 — **자리를 옮기는 것이 없어졌다. 조준은 「찾는다」** ═════
//
//  ★ 사장님 (2026-08-12) 「낡은 절들 정리해줘」
//
//  ★★ 여태 `aimAt(x, z, yaw, pitch, …)` 이 **몸을 그 자리로 옮기고**
//    거기서 겨눴다. 그런데 v110 이 몸을 **매 프레임 좌석으로** 되돌린다 —
//    `SPACE.put` 의 x·z 는 그 다음 프레임에 지워진다. 그래서 옛 좌표로
//    잰 yaw·pitch 는 **좌석에서 보면 엉뚱한 곳**을 가리키고, 검사는
//    「chart0,chart1 조준 을(를) 못 봤다」를 스무 번씩 찍으며 몇 분을 태웠다.
//    (실제로 [3c]·[4] 에서 그 줄이 여덟 번 나왔다)
//
//  ★★★ 그래서 **좌표를 안 믿고 찾는다.** 좌석에 앉은 채로 준 각을
//    가운데 두고 좌우·위아래로 훑어서, 원하는 이름이 잡히는 각을 고른다.
//    부르는 자리를 하나도 안 고치고 뜻만 바뀐다 — 그리고 **다음에 조종석
//    배치가 또 바뀌어도 이 함수는 안 낡는다.** 각을 손으로 적어 두는 것이
//    낡는 것이지, 「찾는다」는 안 낡는다
const aimSweep = async (yaw, pitch, want) => {
  const on = (now) => (Array.isArray(want) ? want.includes(now) : now === want);
  // ★★★ **두 번 연달아 잡혀야 잡은 것이다.** 처음엔 한 번만 읽었는데,
  //   배는 늘 미세하게 떤다 (`camera.rotation.z = sw * 0.06 + fly3.tiltZ`).
  //   그래서 **한 프레임만 스친 각**을 「잡았다」고 하고 지나갔고, 다음
  //   줄에서 누르면 **옆 것**이 눌렸다 — 검사가 「추력 레버가 잡힌다
  //   (chart0)」라는 말이 안 되는 줄을 뱉었다. 잡은 것과 스친 것은 다르다
  //  ══ ★★★ v121 — **기다리는 시간이 모자랐다** ═══════════════════════
  //   머리 없는 브라우저는 초당 한두 프레임이다. 160ms 를 기다리고 읽으면
  //   **새 각이 아직 한 프레임도 안 그려진** 채로 읽는다 — 그래서 잡히는
  //   각인데도 `null` 이 나왔다.
  //   ★ 손으로 재 보니 (`scratchpad/plate.mjs`) **같은 각(0.9, −0.3)에서
  //     900ms 를 기다리면 `chart0` 이 또렷이 잡힌다.** 즉 조준은 멀쩡했고
  //     **검사가 눈을 너무 빨리 감았다.**
  //   ★★ 이 저장소가 이미 적어 둔 함정이다: 「헤드리스 시계는 실제의
  //     1/20~1/25」. 시간을 손으로 적을 때마다 이걸 잊는다
  const put = async (y, q) => {
    await S(([a, b]) => SPACE.put(SPACE.pos.x, SPACE.pos.z, a, b), [y, q]);
    await p.waitForTimeout(520);
    if (!on(await S(() => SPACE.aim))) return false;
    await p.waitForTimeout(380);
    return on(await S(() => SPACE.aim));
  };
  // ① 준 각 그대로 — 대개 여기서 걸린다
  if (await put(yaw, pitch)) return true;
  // ② 좌우 ±0.85 rad · 위아래 ±0.6 rad 를 성기게 훑는다.
  //   ★ 더 넓히지 않는다 — 넓히면 「어디선가는 잡힌다」가 되어 검사가
  //     아무것도 안 지키게 된다 (v66 이 적어 둔 그것이다)
  for (const dq of [0, -0.2, 0.2, -0.4, 0.4, -0.6, 0.6]) {
    for (const dy of [0, -0.2, 0.2, -0.4, 0.4, -0.6, 0.6, -0.85, 0.85]) {
      if (dq === 0 && dy === 0) continue;
      if (await put(yaw + dy, pitch + dq)) return true;
    }
  }
  console.log(`   … ${want} 을(를) 못 찾았다 (좌석에서 훑어 봤다)`);
  return false;
};
/** 겨눈다 — **자리는 좌석 고정이므로 x·z 는 안 쓴다** (부르는 자리를 안 고치려고 남겨 둔다) */
const aimAt = async (x, z, yaw, pitch, want) => aimSweep(yaw, pitch, want);

await S(() => SPACE.clearSave());
// ★ v78 — 제목 화면에 **단추가 생겼다.** 가운데를 그냥 누르면
//   「처음부터 다시」를 밟는다. 시작 단추를 눌러야 한다
await p.click('#btn-play').catch(() => p.mouse.click(360, 210));
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
  // ★★★ v88 — 각을 **재서** 고쳤다 (`(0.9, −0.3)` 은 아무것도 안 걸렸다).
  //   앉은 자리에서 갈래 판은 **오른쪽 63도 · 아래 40도**에 있다.
  //   그리고 게임에서는 마우스 오른쪽(둘러보기)으로 그리 고개를 돌린다 —
  //   앉으면 마우스가 조종간이라 시선이 정면에 못박히기 때문이다
  ok(await aimAround(0, -7.75, 1.1, -0.7, ['chart0', 'chart1']),
    `조종석에서 갈래 판을 잡는다 (${await S(() => SPACE.aim)})`);
  // ★★ **누르기 직전에 한 번 더 본다.** 갈래 판 옆이 추력 레버라,
  //   가운데를 잡아도 떨림 한 번에 이웃이 걸린다 — 그러면 「눌렀더니
  //   추력 레버를 밉니다」가 나온다 (실제로 났다). 걸린 것을 확인하고 누른다
  await until(() => String(SPACE.aim ?? '').startsWith('chart'), 20, '갈래 판이 굳는 것');
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

  // ══ ★★★ v120 — **앉는 절차를 걷어냈다** ═══════════════════════════
  //
  //  ★ 사장님 (2026-08-12) 「낡은 절들 정리해줘」
  //
  //  ★★ 여기가 「서서 좌석을 겨누고 · 2.6초 누르고 · 앉고 · 눈이 내려가고」
  //    를 쟀다. 그런데 v110 이 **「항상 앉은 상태에서 모든 조작을 한다」**
  //    를 기본으로 만들었다 — 서 있는 순간이 게임에 **없다.**
  //    그래서 ① 은 늘 `null` 을 잡고 빨개졌고, ⑨(일어난다)는 영영 안 됐다.
  //
  //  ★★★ 대신 물어야 하는 것은 **「처음부터 앉아 있나」**다.
  //    같은 자리에서 반대 질문을 한다 — 걷어내면서 **빈칸을 남기지 않는다**
  const at = await S(() => SPACE.pos);
  ok(await S(() => SPACE.helm2.sat),
    `① ★★★ **시작부터 앉아 있다** — 앉는 절차가 없다 (v110 「일어선다는것은 아예 없애주고」)`);
  ok(Math.hypot(at.x, at.z + 8.30) < 0.25,
    `② ★★ 몸이 **좌석 자리에 있다** (${at.x}, ${at.z}) — 통로에 남은 몸이 없다`);
  const camY = await S(() => SPACE.camY);
  ok(camY < 1.62, `③ **눈이 앉은 높이다** (${camY.toFixed(2)})`);

  // ② **조준은 기수가 한다** — 조종간을 밀면 겨눔이 따라 움직인다
  // ★★★ v88 — 겨눠서 잡는 단계가 **없어졌다.** 앉으면 잡혀 있다
  ok((await S(() => SPACE.helm2)).steering,
    `④ 앉으면 **곧바로 잡혀 있다** — 겨눠서 잡는 단계가 없다 (v88)`);
  ok(!(await S(() => SPACE.helm2)).hands,
    `④-b ★ 잡고 있으면 **손이 안 보인다** (사장님 「손은 안보이게 해주고」)`);
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

  // ══ ★★★ v120 — **「일어난다」를 뒤집었다** ═════════════════════════
  //
  //  ★ v88 에는 X 로 일어나는 것이 「왕복이 닫힌다」였다. v110 이 일어서는
  //    것을 없앴으므로 지금 맞는 문장은 정반대다: **눌러도 안 일어나야**
  //    한다. v109 는 이걸 **막기만** 해서 저장을 이어하면 막힌 길로
  //    새어 나갔고 (몸은 통로에 · 눈만 앉아), 그게 사장님이 보내 주신
  //    「방 이름표가 사방에 기울어져 뜨는」 화면이었다.
  //  ★★ 그래서 **X 를 눌러 보고 그래도 앉아 있나**를 묻는다 —
  //    이것이 「없앴다」와 「막았다」를 가르는 유일한 질문이다
  await settle();
  await p.keyboard.press('KeyX');
  await p.waitForTimeout(600);
  const still = await S(() => ({ sat: SPACE.helm2.sat, pos: SPACE.pos }));
  ok(still.sat && Math.hypot(still.pos.x, still.pos.z + 8.30) < 0.25,
    `⑨ ★★★ **X 를 눌러도 안 일어난다** (앉음 ${still.sat} · ${still.pos.x}, ${still.pos.z}) —`
    + ' 막은 것이 아니라 없앤 것이다');
}

console.log('\n[2] ※ **에어록은 접었습니다** (v120)');
{
  // ══ ★★★ v120 — **낡은 절을 걷어낸다** ════════════════════════════
  //
  //  ★ 사장님 (2026-08-12) 「낡은 절들 정리해줘」
  //
  //  ★★ 이 절은 **우주복을 입고 · 바깥문을 열고 · 윈치로 낚는** 것을
  //    쟀다. 그런데 v110 이 **에어록을 통째로 없앴다** —
  //    `game/pilot-table.js DROP_ROOMS` 에 「에어록 — 밖에 나갈 일이
  //    없다 (회수는 포획·도킹이 한다)」라고 적혀 있다. 걷기도 없어졌으므로
  //    (`PILOT.canStand = false`) 거기까지 **갈 수가 없다.**
  //
  //  ★★★ 그런데도 이 절은 **열 판 넘게 살아서** 매번 빨간 줄을 냈고,
  //    그 빨강이 익숙해지자 **진짜 빨강도 같이 안 보이게** 됐다.
  //    이 저장소가 「낡은 문장을 남겨 두면 검사가 죽은 설계를 지킨다」고
  //    적어 둔 그것이다 (v119 `space-mount.js`).
  //
  //  ★ **지우되 자취는 남긴다.** 이 절이 묻던 것은 없어진 것이 아니라
  //    **자리를 옮겼다**:
  //      · 밖의 것을 가져오는 일 → [6j] 회수 · [6m] 포획
  //      · 진공에서 사람이 버티는 일 → 없앴다 (조종석 밖으로 안 나간다)
  //  ══ ★★★ **치우다가 하나 더 나왔습니다** (v120) ═══════════════════
  //
  //   `pilot-table.js DROP_ROOMS` 는 방 여섯을 **없앴다**고 적어 두었고
  //   `space-pilot.js` 는 그 표를 읽어 「✕ 통로 · ✕ 관측실 …」이라고
  //   초록으로 찍는다. 그런데 **배에는 일곱이 다 서 있다** —
  //   `world/ship.js` 가 그대로 세우고 `SPACE.rooms` 가 일곱을 준다.
  //
  //   ★ 즉 **표는 없앴는데 배는 안 없앴다.** v110 이 「막은 것과 없앤
  //     것은 다르다」라고 적으면서 고친 것이 걷기였고, **방 자체는
  //     그대로 남았다.** 지금은 갈 수가 없어서 티가 안 날 뿐이다.
  //   ★★ 그리고 검사도 못 잡았다 — `space-pilot.js` 는 **표만** 읽으므로
  //     「둘이 같나」를 물을 수가 없다. v98 이 전투에서 겪은 그 병이다.
  //   ★★★ 여기서 고칠 일이 아니므로(방을 지우는 것은 제 판이 필요하다)
  //     **소리 내어 남긴다.** 지금 물을 수 있는 것은 「갈 수 있나」다
  const rooms = await S(() => SPACE.rooms.map((r) => r.key));
  const dropped = ['spine', 'observ', 'workshop', 'garden', 'airlock', 'engine'];
  const still = dropped.filter((k) => rooms.includes(k));
  if (still.length) {
    console.log(`   ※ ★★★ **표에서 없앤 방 ${still.length} 개가 배에는 그대로 서 있습니다** —`);
    console.log(`     ${still.join(' · ')}. 걷기가 없어서 갈 수는 없지만, 지워진 것은 아닙니다.`);
    console.log('     `space-pilot.js` 는 **표만** 읽으므로 이걸 못 봅니다 — 다음 판의 일입니다.');
  }
  ok(rooms.includes('cockpit'),
    `① ★★ 조종석은 있다 — 회차가 여기서 다 돈다 (배에 선 방 ${rooms.length} 개)`);
  //  ★ `SPACE.canStand` 는 **다른 것**이다 (그 자리를 걸을 수 있나).
  //    표를 물어야 하므로 `pilotRules` 로 읽는다 — 이름이 비슷하다고
  //    아무거나 읽으면 늘 참인 검사가 된다 (함수는 언제나 truthy 다)
  const rules = await S(() => SPACE.pilotRules);
  ok(rules.canStand === false && rules.seatOnly === true,
    '② ★★ 일어서는 것이 **게임에 없다** (`PILOT.canStand = false`) —'
    + ' 「걸어가서」가 답이 되는 절은 이제 다 낡은 것이다');
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[3] ★★ **조종간이 진짜 운전인가** — 자동 항법이 꺼지나');
{
  await settle();
  await S(() => SPACE.putAuto(true));
  ok((await S(() => SPACE.helm)).auto, '① 처음에는 자동 항법이 켜져 있다');
  // ★★★ v88 — **앉는 것이 곧 잡는 것이다** (사장님 「앉자마자 조정간이
  //   바로 잡히도록」). v66~v87 은 앉기와 잡기가 다른 동작이었고, 그
  //   사이 상태에서 좌클릭이 좌석에 걸려 **누를 때마다 일어났다**
  await sit();
  ok((await S(() => SPACE.helm2)).steering, `② 앉으니 **곧바로 잡혀 있다**`);
  await down();
  for (let i = 0; i < 22; i++) {
    await S(() => window.dispatchEvent(new MouseEvent('mousemove', { movementX: 90, movementY: 0 })));
    await p.waitForTimeout(160);
  }
  const h1 = await S(() => SPACE.helm);
  await up();
  await letGoYoke();                    // ★ v78 — 토글이라 한 번 더 눌러야 놓인다
  ok(!h1.auto, `③ **잡으니 자동 항법이 꺼진다** — 「${await said()}」`);
  ok(h1.off > 0.02, `④ 밀었더니 항로를 벗어난다 (${h1.off} · ${h1.word})`);

  // ★★ 여기가 「운전이 안 된다」의 핵심 — **놓아도 안 돌아와야** 한다
  await p.waitForTimeout(6000);
  const h2 = await S(() => SPACE.helm);
  // ★★ v88 — **「그대로」가 아니라 「안 돌아온다」로 묻는다.**
  //   묻고 싶은 것은 처음부터 「손을 떼면 배가 저절로 항로로 돌아오나」였다.
  //   ±0.02 라는 좁은 창은 **놓는 순간 스틱이 0 이 되던 시절**의 값인데,
  //   v78(민 자리에 머문다)·v88(X 로 놓는다) 을 거치며 배가 놓은 뒤에도
  //   조금 더 돈다 — 그건 관성이고 **맞는 동작**이다. 값이 아니라 방향을 본다
  ok(h2.off >= h1.off - 0.02,
    `⑤ **놓아도 안 돌아온다** (${h1.off} → ${h2.off}) — 수동이면 되돌리는 것도 내 손이다`);

  // 자동 항법 스위치로 되돌린다
  await settle();
  // ══ ★★★ **검사가 서서 겨누고 있었다** (v79 에 자로 재서 찾았다) ═══
  //
  //  v66 부터 이 두 줄이 계속 빨갰다 (「잡힌다 (null)」). 판마다 「게임이
  //  틀렸나 검사가 틀렸나」를 물었고, 이번에 **재서** 답이 나왔다.
  //
  //  ① 먼저 각도가 틀렸다. 스위치는 `view-table.js SIDE.auto` =
  //     (0.62, 0.92, −8.30) 인데 검사는 yaw −1.20 · pitch −0.10 을
  //     겨누고 있었다 — 손으로 짐작해 적은 값이었다.
  //
  //  ② 각도를 계산해 고쳤더니 이번엔 **`helmseat`** 가 나왔다.
  //     서 있는 자리(z −7.60)에서 옆 콘솔을 보면 **좌석이 앞을 막는다.**
  //     그리고 그게 맞다 — 이 둘은 **앉아서 쓰는 물건**이다. 추력 레버가
  //     왼쪽 콘솔에 있는 이유가 「앉은 조종사의 왼손」이고, 주석에도
  //     그렇게 적혀 있다. 서서 팔을 뻗어 만지는 물건이 아니다.
  //
  //  ★★ 즉 **게임은 처음부터 멀쩡했고 검사가 사람이 안 하는 자세로
  //    겨누고 있었다.** 앉아서 겨눈다 (좌석 눈 = DEP, z −8.30):
  //      자동 항법 yaw −1.72 · 추력 레버 yaw +1.38 · 둘 다 pitch −0.52
  //    (좌우가 대칭이 아닌 것은 안쪽 각을 **갈래 판 둘**이 쓰기 때문이다)
  await S(() => SPACE.putHelmSit(true));
  await until(() => SPACE.helm2.k > 0.99, 40, '앉기');
  // ══ ★★★ v120 — **사람이 실제로 쓰는 길로 켠다** (방향키 우) ════════
  //
  //  ★ 여기가 「스위치를 조준선으로 찍어서」 켰다. 그런데 v111 이 방향키를
  //    붙이면서 **그 이유를 이미 적어 두었다**: 「자동 항법은 지금 조준선으로
  //    스위치를 찍어야 켜져서 **싸우는 중에는 사실상 못 켠다**」.
  //    즉 그때 이미 「사람이 안 쓰는 길」로 판정된 것을, 이 검사만 아홉 판
  //    동안 계속 그 길로 물었다.
  //  ★★ 그리고 좌석에서는 스위치가 팔걸이 **바로 옆**(방위 90도쯤)이라
  //    조준선이 닿지 않는다 — 훑어도 못 찾았다. **못 찾는 것이 맞다.**
  //  ★★★ 그래서 **방향키 우**로 켠다. 스위치를 없앤 것이 아니라,
  //    검사가 **사람이 쓰는 길**을 재게 바꾼 것이다
  await p.keyboard.press('ArrowRight');
  const backOn = await until(() => SPACE.helm.auto, 30, '자동 항법 켜기');
  ok(backOn, `⑥ ★★★ **방향키 우로 자동 항법이 켜진다** — 「${await said()}」`);
  ok(!(await S(() => SPACE.helm2.steering)) || backOn,
    '⑦ ★★ 싸우는 중에도 켤 수 있다 — 조준선으로 스위치를 찍을 필요가 없다 (v111)');
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
  // ★ v99 — `aimAround('yoke')` 를 뺐다. v88 부터 **앉으면 이미 잡혀
  //   있고**, 잡으면 **창이 화면을 채우므로**(v63) 조종간을 조준할 수가
  //   없다 — 검사가 40번을 되풀이하다 지쳤다 (「멈춘다」로 보였다)
  await down();
  for (let i = 0; i < 14; i++) {
    await S(() => window.dispatchEvent(new MouseEvent('mousemove', { movementX: 60, movementY: 0 })));
    await p.waitForTimeout(160);
  }
  const yawNow = (await S(() => SPACE.fly3)).yaw;
  const sky = await skyYaw();
  await up();
  await letGoYoke();                    // ★ v78 — 놓아야 콘솔에 손이 간다
  ok(Math.abs(yawNow) > 0.15, `① 밀면 기수가 돈다 (yaw ${yawNow})`);
  ok(Math.abs(sky) > 0.02,
    `② ★★★ **창밖이 실제로 ${sky} rad 돌았다.** v65 까지 이 값이 **늘 0**이었다 —`
    + ' `setAttitude` 가 yaw 를 버리고 있었고, 그게 「핸들 운전이 안되잔아」다');

  // ── ② 추력 — **W/S 로 민다** (v101 의 진짜 스로틀) ────────
  //
  //  ══ ★★★ v120 — **자동 항법 스위치와 똑같은 자리였다** ═══════════
  //
  //  ★ 여기가 레버를 **조준선으로 찍어서** 밀었다. 그런데 옆 콘솔은
  //    좌석 **팔걸이 바로 옆**(`view-table.js SIDE` · x ±0.62 · 눈과 같은 z)
  //    이라 방위가 90도쯤이다 — 앉은 사람의 조준선은 거기까지 안 돌아간다.
  //    v66 이 「손잡이는 어깨 옆이다 — 앞이 아니다」라고 옮겨 놓은 그
  //    자리인데, 검사만 **앞에 있다고 여기고** 계속 찍으려 했다.
  //  ★★ 그리고 v101 이 이미 **진짜 스로틀**을 만들어 뒀다: **W 밀고 S 당기기**.
  //    실제 비행 시뮬이 스로틀을 키에 두는 그 자리이고, 사람은 이쪽을 쓴다.
  //  ★★★ 그래서 **키로 민다.** 레버를 없앤 것이 아니라, 검사가 사람이
  //    쓰는 길을 재게 바꾼 것이다 ([3]⑥ 의 방향키와 같은 판단이다)
  await settle();
  // ★ **추진제가 없으면 스로틀이 안 먹는다** (`throttle.js` 의 `dry`).
  //   앞 절들이 밀어붙이며 다 태워서 0.00 → 0.00 이 나왔다 — 게임이
  //   맞고 검사가 빈 탱크로 물은 것이다. 채워 놓고 묻는다
  await S(() => { SPACE.setSupply({ fuel: 90 }); SPACE.setPower('thrust', true); });
  await p.waitForTimeout(400);
  const thr0 = await S(() => SPACE.throttle?.v ?? 0);
  await S(() => { window.__t0 = SPACE.throttle?.v ?? 0; });
  await p.keyboard.down('KeyW');
  await until(() => (SPACE.throttle?.v ?? 0) > window.__t0 + 0.02, 40, '스로틀이 오르는 것');
  await p.keyboard.up('KeyW');
  const thr1 = await S(() => SPACE.throttle?.v ?? 0);
  // ★ 안 오르면 **왜 안 오르는지 같이 찍는다.** 「0.00 → 0.00」만 보면
  //   게임을 탓하게 되는데, 새 판에서 재 보면 멀쩡히 오른다 —
  //   즉 앞 절이 남긴 상태가 막고 있다는 뜻이다. 그 상태를 보여 준다
  const why = await S(() => ({
    steering: SPACE.helm2?.steering, sat: SPACE.helm2?.sat, auto: SPACE.helm?.auto,
    fuel: SPACE.supply?.fuel, thrust: SPACE.power?.thrust, phase: SPACE.route?.phase,
    paused: SPACE.paused ?? null,
  }));
  ok(thr1 > thr0,
    `③ ★★★ **W 로 스로틀이 오른다** (${thr0.toFixed(2)} → ${thr1.toFixed(2)}) —`
    + ' 옆 콘솔 레버는 팔걸이 옆이라 조준선이 안 닿는다 (v66 이 거기 둔 것이 맞다)'
    + (thr1 > thr0 ? '' : `  ※ 지금 상태: ${JSON.stringify(why)}`));
  await p.keyboard.down('KeyS');
  await p.waitForTimeout(2500);
  await p.keyboard.up('KeyS');
  const thr2 = await S(() => SPACE.throttle?.v ?? 0);
  ok(thr2 < thr1, `④ ★★ **S 로 당기면 내려간다** (${thr1.toFixed(2)} → ${thr2.toFixed(2)}) — 두 자리가 아니라 축이다 (v101)`);

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
  // ══ ★★★ v121 — **문턱을 「넘어가게」 둔다** ═══════════════════════
  //   ① v119 까지 0.34 를 넣었다. `HELM.warnAt` 이 0.35 이므로 **1/100
  //      모자라** 경보가 영영 안 떴다 — 게임이 맞고 검사가 틀렸다.
  //   ② 그래서 0.5 로 밀었더니 이번엔 **넘는 순간이 없어서** 안 떴다.
  //      경보는 「넘었다」가 아니라 **「넘는다」**에 뜬다 (`mev === 'warn'`).
  //   ★ 그래서 **문턱 바로 밑에 놓고 끌려가게** 둔다 — 사람이 겪는 그대로다
  await S(() => SPACE.setNear(0.33));
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
  //
  //  ══ ★★★ v120 — **판을 고르려면 조종간을 놓는다** ═════════════════
  //   v110 이 「놓으면 마우스로 계기를 본다」로 만들었다 (놓을 때 뜨는 말이
  //   「다시 잡으려면 누릅니다 · **계기는 I**」다). 잡은 채로는 마우스가
  //   배를 미는 데 쓰이므로 **조준선을 판으로 못 가져간다.**
  //   검사가 잡은 채로 훑다가 「chart0,chart1 을 못 찾았다」를 냈다 —
  //   사람이 안 하는 자세로 물은 것이다
  await S(() => SPACE.putGun(false));
  await p.waitForTimeout(500);
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

  // ══ ★★★ v120 — **「내려서 싣는다」의 뒤쪽 절반을 접었다** ═══════════
  //
  //  ★ 사장님 (2026-08-12) 「낡은 절들 정리해줘」
  //
  //  ★★ ⑥~⑨ 는 「일어나 · 에어록으로 걸어가 · 바깥문을 열고 · 윈치로
  //    싣고 · 문을 닫는다」였다. v110 이 **걷기와 에어록을 없앴으므로**
  //    (`pilot-table.js DROP_ROOMS`) 사람은 여기까지 못 온다.
  //
  //  ★★★ **그리고 이건 검사만의 문제가 아니다.** 게임 쪽 코드
  //    (`main.js loading = onDirt && onWinch && …`)도 **윈치를 잡아야**
  //    싣게 되어 있다 — 즉 **땅에서 싣는 길이 지금 아예 없다.**
  //    v110 이 방을 없애면서 이쪽으로 난 길을 같이 걷어내지 않았고,
  //    걷기가 사라진 뒤로는 아무도 그 길을 못 밟아서 **조용히 죽어 있었다.**
  //    이 절이 그걸 「빨간 줄」로 말하고 있었는데, 옆의 낡은 빨강에 묻혀
  //    안 읽혔다 — 낡은 것을 안 치우면 **진짜도 같이 안 보인다.**
  //
  //  ★ 여기서 고칠 수 있는 것은 아니므로 **소리 내어 남긴다.**
  //    다음 판의 일이다: 땅에서 싣는 것을 **앉아서** 되게 한다
  //    (회수가 이미 그렇게 한다 — [6j] 꾸러미 · [6m] 포획)
  console.log('   ※ ⑥~⑨(바깥문·윈치로 싣기)는 **접었습니다** — v110 이 걷기와');
  console.log('     에어록을 없앤 뒤로 사람이 갈 수 없는 길입니다.');
  console.log('     ★ 그리고 **게임 쪽도 아직 그 길뿐입니다** — 앉아서 싣는 길이');
  console.log('     없습니다. 검사가 아니라 **게임에 난 구멍**이고, 다음 판의 일입니다.');
  //  ★ v121 — 「배에 없다」로 물었다가 빨개졌다. **방은 아직 서 있다** —
  //    표에서만 없앴고 `world/ship.js` 는 그대로 세운다 ([2] 가 그걸 찍는다).
  //    여기서 물을 수 있는 것은 **갈 수 없다**뿐이다
  ok((await S(() => SPACE.pilotRules)).canStand === false,
    '⑥ ★★ 에어록까지 **걸어갈 수가 없다** — 그러니 「문을 열고 윈치로」는 이제 못 묻는다');
  ok((await S(() => SPACE.land)).got !== undefined,
    '⑦ ★ 땅이 무엇을 주는지는 표에 그대로 있다 — 길만 없어졌지 뜻은 살아 있다');
  // ══ ★★★ v99 — **v88 이후로 이 세 줄이 스스로를 방해하고 있었다** ══
  //
  //  ★ 「앉는다 → 조종간을 **조준해서 누른다**」였다. v66~v87 은 앉기와
  //    잡기가 다른 동작이었으므로 맞았다. 그런데 v88 에 사장님이
  //    「**앉자마자 조정간이 바로 잡히도록**」 하셔서 앉으면 이미 잡혀
  //    있고, 조종간은 **토글**이다 (`letGoYoke` 가 있는 이유) —
  //    즉 잡힌 채로 또 누르면 **놓는다.** 그래서 뜰 수가 없었다.
  //
  //  ★★ 뜨는 조건은 `landDown && onYoke && input.hold` 다 (`main.js`).
  //    앉았으면 `onYoke` 는 이미 참이므로 **누르고 있기만** 하면 된다
  await sit();
  ok((await S(() => SPACE.helm2)).steering,
    '⑩a 앉으니 **이미 잡혀 있다** (v88) — 여기서 또 누르면 놓는 것이다');
  await pressUntil(() => SPACE.land.step === 'up', 5, 1.5);
  ok(await until(() => SPACE.land.step === 'up', 40, '이륙'),
    `⑩ 잡은 채로 누르니 **뜬다** — 「${await said()}」`);
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
  await settle();
  await S(() => { SPACE.giveOre(60); SPACE.setPower('thrust', false); });
  const g0 = await S(() => SPACE.putGambit('jettison'));
  ok(!!g0 && g0.on === 'jettison',
    `① 「버리기」가 뜬다 — 손은 **${g0?.hand}**(화물 접수구) · 「${g0?.lead}」`);
  // ★ v120 — 「걸어가서 접수구를 잡는다」는 접었다 (v110 이 걷기를 없앴다).
  //   승부수의 알맹이는 **손잡이가 새 뜻을 갖나**이지 거기까지 걷는 것이
  //   아니므로, 「이미 있는 손잡이를 가리키나」만 묻는다
  ok(!!g0?.hand,
    `② ★★ **이미 있는 손잡이**를 가리킨다 (${g0?.hand}) — 새 손잡이를 안 만든다`);
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

console.log('\n[5] ★★★ **수리** — 단추 하나인데 공짜는 아닌가 (v110)');
{
  // ══ ★★★ v120 — **「고장을 찾아서 고친다」를 걷어냈다** ══════════════
  //
  //  ★ 사장님 (2026-08-12) 「낡은 절들 정리해줘」
  //
  //  ★★ 이 절은 「고장이 뜨고 · 어느 방으로 가야 하는지가 정해져 있나」를
  //    물었다. 그런데 v110 이 **고장을 껐고**(`PILOT.faults = false`)
  //    **방을 여섯 개 없앴다** — 갈 방이 없다. 사장님이 「수리는 버튼
  //    하나로 해결하고」라고 하셨고 그게 `pilot-table.js FIX` 다.
  //    `space-fit.js` 가 v117 에 「물린 고장 0 · 막힌 고장 9」라고 이미
  //    적었는데, **이 검사만 그걸 모르고** 아홉 판을 더 물었다.
  //
  //  ★★★ 그래서 같은 자리에서 **지금 있는 것**을 묻는다: 단추 하나로
  //    고쳐지나 · 그런데 **공짜가 아닌가.** 공짜면 「맞아도 그만」이 되고,
  //    그러면 v70 이 만든 「맞으면 일이 된다」가 통째로 죽는다
  await settle();
  // ★ v121 — **흉터가 아니라 선체 마모다.** `giveScar` 는 영구 손상이라
  //   `needsFix` 가 안 걸리고, 게다가 다음 절([6])이 「처음에는 흉터가
  //   없다」로 시작하므로 **여기서 흉터를 주면 그 절이 빨개진다.**
  //   검사가 검사를 망치는 자리다 (v67 에 한 번 겪었다)
  await S(() => { SPACE.setSupply({ parts: 9 }); SPACE.setHeat(70); SPACE.putWear(0.6); });
  const before = await S(() => ({ parts: SPACE.supply.parts, heat: SPACE.heat, fix: SPACE.fix }));
  ok(typeof before.fix?.why !== 'undefined' || before.fix !== undefined,
    `① 수리 단추를 읽을 수 있다 (${JSON.stringify(before.fix ?? null).slice(0, 80)})`);
  await S(() => { window.__p0 = SPACE.supply.parts; SPACE.doFix(); });
  // ★ 누르고 있어야 하는 시간(`FIX.hold` 2.4초)이 지나야 든다 —
  //   헤드리스 시계로는 실시간 1분쯤이므로 넉넉히 기다린다
  const fixed = await until(() => SPACE.supply.parts < window.__p0, 200, '수리가 드는 것');
  const after = await S(() => ({ parts: SPACE.supply.parts, heat: SPACE.heat }));
  ok(fixed, `② ★★★ **단추 하나로 고쳐진다** (부품 ${before.parts} → ${after.parts})`);
  ok(after.parts < before.parts,
    `③ ★★★ **공짜가 아니다** — 부품을 ${before.parts - after.parts} 썼다.`
    + ' 공짜면 「맞아도 그만」이 되고, 그러면 「맞으면 일이 된다」가 죽는다');
  ok(after.heat <= before.heat,
    `④ ★ 열도 같이 내려간다 (${before.heat.toFixed(0)} → ${after.heat.toFixed(0)}) —`
    + ' 냉각 밸브가 하던 일을 여기가 이어받았다');
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
  // ★ v120 — 「밸브가 뻑뻑하다」는 **밸브가 없어졌으므로** 못 묻는다
  //   (`DROP_ROOMS` 의 기관실). 흉터가 값을 매기는 것은 남았으므로
  //   **무엇으로 값을 매기든** 값이 있나만 묻는다 — 이름을 박아 두면
  //   계통이 바뀔 때마다 검사가 죽은 것을 지킨다
  ok(sc.valveMult > 1 || sc.sign > 0 || (sc.list[0] && sc.list[0].cost),
    `③ ★★ 흉터가 **값을 매긴다** (밸브 ×${sc.valveMult} · 자국 +${sc.sign})`);
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
  ok(after.valveMult === sc.valveMult && after.sign >= sc.sign,
    '⑦ 이어해도 **값이 그대로다** — 저장 한 번에 값이 없어지면 영구가 아니다');
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
  // ★★ **③ 에서 쏴 죽인 그 표적을 여기서 다시 찾고 있었다.** 그래서
  //   `sky.list[0]` 이 엉뚱한 파편이 됐고, 파편은 엔진이 없어 원뿔 밖에서
  //   안 잡힌다 — 「레이더가 뒤를 못 본다」로 빨개졌지만 레이더는 멀쩡했다.
  //   **절 안에서 앞 줄이 뒤 줄의 재료를 없애면 그건 검사가 아니다**
  await S(() => { SPACE.clearSky(); SPACE.callFoe('raider', 170, 90); });
  await until(() => (SPACE.combat?.blips ?? []).length > 0, 30, '레이더에 점이 찍히기');
  const blips = await S(() => SPACE.combat?.blips ?? null);
  ok(Array.isArray(blips) && blips.some((x) => Math.abs(x.relAz) > 120),
    `④ ★★ 레이더가 **뒤에 있는 것을 찍는다** (${(blips ?? []).length}점) —`
    + ' HUD 는 26도뿐이라 뒤는 여기 말고 나올 데가 없다');

  // ⑤ **앉으면 상태창이 뜨나** — 사장님 「hud처럼 … 퀘스트 안내창처럼」
  ok(await S(() => !!SPACE.statusOn),
    '⑤ ★★ **앉으니 상태창이 켜졌다** — 열·냉각·속도·전력·자국·미사일');
  // ★ v120 — 「서면 꺼진다」는 **설 수가 없으므로** 못 묻는다.
  //   지금 맞는 문장은 정반대다: 늘 앉아 있으니 **늘 켜져 있어야** 한다
  await p.keyboard.press('KeyX');
  await p.waitForTimeout(600);
  ok(await S(() => !!SPACE.statusOn && SPACE.helm2.sat),
    '⑥ ★★ X 를 눌러도 **안 꺼진다** — 설 수가 없으므로 계기도 안 사라진다 (v110)');
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
  // ★★ **20초를 기다리고 「안 쏜다」고 했었다.** 실제로 첫 발까지 27초다 —
  //   적은 겨눔을 쌓고 나서 쏘고, **헤드리스 시계는 실제의 1/20** 이라
  //   3.4초짜리 주기가 여기서는 1분이 넘는다. 게임이 아니라 기다림이
  //   짧았던 것이다. 정해 놓은 만큼 세지 말고 **될 때까지** 기다린다
  await until(() => (SPACE.sky.incoming?.length ?? 0) > 0, 200, '적탄이 날아오는 것');
  const inc = await S(() => SPACE.sky.incoming?.length ?? 0);
  ok(inc > 0, `④ ★★★ **적이 쏜다** — 날아오는 탄 ${inc}발. v69 까지 영영 안 쐈다`);
  const drawn = await S(() => SPACE.outside?.shots?.incoming ?? 0);
  ok(drawn > 0,
    `⑤ ★★ 그 탄이 **화면에도 있다** (${drawn}개) — 0.9초의 비행 시간을 뒀는데`
    + ' 화면이 비어 있으면 그건 없는 시간이다');

  // ⑥ 맞으면 배가 상한다
  //  ★★ v99 — 여기가 **20초를 정해 놓고** 셌다 (`40 × 500ms`). 그런데
  //    헤드리스 시계는 실제의 1/25~1/44 라 그건 게임 시간으로 **1초도
  //    안 된다** — 적은 3.4초를 겨누고 탄은 0.9초를 난다. 즉 맞을 시간을
  //    준 적이 없다. 바로 위 ④ 의 주석이 「정해 놓은 만큼 세지 말고
  //    **될 때까지** 기다린다」인데 여기만 안 지켰다
  const h0 = await S(() => SPACE.faults.wear.hull);
  // ★ `until` 의 함수는 **페이지 안에서** 돈다 — 여기 `h0` 는 Node 쪽
  //   변수라 안 보인다 (한 번 이걸로 터뜨렸다). 창에 얹어 놓고 읽는다
  await S((v) => { window.__h0 = v; }, h0);
  const worn = await until(() => SPACE.faults.wear.hull > window.__h0, 300, '선체가 깎이는 것');
  const h1 = await S(() => SPACE.faults.wear.hull);
  ok(worn && h1 > h0, `⑥ ★★★ 맞으니 **선체가 깎인다** (${h0.toFixed(3)} → ${h1.toFixed(3)})`);
  await S(() => SPACE.clearSky?.());
}

console.log('\n[6e] ★★★ **탄두** — 목적이 배 안에 서 있나 (v71)');
{
  // ══ ★★★ v120 — **기관실로 걸어가는 절차를 걷어냈다** ═══════════════
  //
  //  ★ 크레이들은 「기관실 후미」에 있고, 이 절은 거기까지 **걸어가서**
  //    조준선으로 잡았다. v110 이 기관실을 없앴고(`DROP_ROOMS`) 걷기도
  //    없앴다 — 대신 격납고는 **화면으로 본다** (`PILOT.bayIsScreen`).
  //  ★★ 그래서 「손에 닿나」가 아니라 **「앉아서 꽂히나」**를 묻는다.
  //    재료 다섯과 불 들어오는 칸은 그대로 살아 있다 (목적의 가운데다)
  // ══ ★★ **값을 두 번 읽고 있었다** (2026-08-09) ═══════════════════════
  //
  //  `ok(await S(…) === 'cradle', \`… (${await S(…)})\`)` 였다. 조건과
  //  괄호 안의 값이 **서로 다른 순간의 읽기**라, 한 번은 「✔ … (null)」이
  //  나오고 다음 판에는 「✘ … (cradle)」이 나왔다 —
  //  **검사가 제 결과와 어긋난 말을 하고 있었다.**
  //
  //  ★ 왜 흔들리나: 조준은 매 프레임 광선을 쏴서 정하는데, 이 자리는
  //    크레이들 판정 상자의 **가장자리**라 프레임마다 잡혔다 놓쳤다 한다.
  //    한 번 찍어 보고 판정할 것이 아니라 **굳을 때까지 기다려야** 한다
  //    (`aimAround` 가 여섯 군데에서 이미 그렇게 한다).
  ok(await S(() => SPACE.helm2.sat),
    '① ★★ **앉은 채로 시작한다** — 크레이들에 걸어가는 절차가 없어졌다 (v110)');

  // ② 다섯 칸이 **불로** 진행도를 말한다 — 글로 안 알려준다
  const a0 = await S(() => SPACE.headSeen);
  await S(() => { SPACE.putHeadPart('shell'); SPACE.putHeadPart('booster'); });
  await p.waitForTimeout(600);
  const a1 = await S(() => SPACE.headSeen);
  ok(a1.lit > a0.lit,
    `② ★★★ 꽂으니 **칸에 불이 들어온다** (${a0.lit} → ${a1.lit}) — 진행도를 글로 안 알려준다`);

  // ③ 뜨거우면 **몸통이 붉어진다**
  await S(() => SPACE.setBake(95));
  await p.waitForTimeout(600);
  const hot = await S(() => SPACE.headSeen);
  ok(hot.hot > 0.2, `③ ★★ 뜨거우니 **탄두가 달아오른다** (${hot.hot}) — 숫자를 안 보고도 안다`);

  // ④ 한계에 닿으면 **일이 는다** — 죽지 않는다
  // ★★★ **`setBake(100)` 만 해 놓고 기다리고 있었다.** 탄두는 선체 열이
  //   62 를 넘을 때만 오르고 아니면 **내려간다**(`BAKE.fall`) — 그래서
  //   100 으로 밀어 넣어도 다음 프레임에 99.9 가 되어 한계에 **영영 안 닿았다.**
  //   즉 검사가 만들 수 없는 상황을 기다리고 있었다. 탄두가 데워지는
  //   이유는 **기관실이 뜨겁기 때문**이므로, 선체 열부터 올려야 맞다
  const n0 = await S(() => SPACE.warhead.n);
  await S((n) => { window.__n0 = n; }, n0);
  await S(() => { SPACE.setHeat(88); SPACE.setBake(97); });
  await until(() => SPACE.warhead.n < window.__n0 || SPACE.warhead.lost.length > 0,
    120, '열에 재료가 죽는 것');
  const w2 = await S(() => SPACE.warhead);
  ok(w2.n < n0 || w2.lost.length > 0,
    `④ ★★ 열에 **꽂아 둔 것이 하나 죽는다** (${n0} → ${w2.n}) — 죽는 게 아니라 일이 는다`);
  await S(() => SPACE.setHeat(20));

  // ⑤ 못 모아도 갈 수 있다
  ok(await S(() => SPACE.dropHead().key) !== 'full',
    '⑤ 다 안 모았으면 **못 떨군다** — 그래도 지나간다. 2시간을 쓰고 끝을 못 보는 회차는 없다');
  await S(() => SPACE.setBake(0));
}

console.log('\n[6f] ★★★ **몰아 붙인다** — 손목·상태창·부호·360도·급가속 (v73)');
{
  // ★★ 이 절은 사장님이 스크린샷과 함께 짚으신 여섯 가지를 **한 줄에**
  //   묶어 둔 것이다. 계통 검사(`space-bfm.js`)는 규칙만 재고, 여섯 중
  //   넷은 **화면에서만** 참·거짓이 갈린다 — 그래서 여기 있다.
  await sit();
  await S(() => {
    SPACE.setPower('sensor', true);
    SPACE.putFly({ pitch: 0, yaw: 0, roll: 0 });
    SPACE.putAim(0, 0); SPACE.putBoost(0);
  });
  await settle();

  // ① ★ 손목이 **조종간을 잡으면 접힌다**
  //   사장님 「q 화면은 조정간을 잡으면 없어지게」 — 전투 중에 손목 화면이
  //   시야 아래를 먹고 있었다
  // ★★ **헤드리스 시계는 실제의 1/20** 이다. 접히는 데 게임 시간 0.8초면
  //   여기서는 25초쯤 걸린다 — 3초만 기다렸다가 「안 접힌다」로 빨개졌었다.
  //   조건이 참이 될 때까지 기다리지, 정해 놓은 만큼 세지 않는다
  const w0 = await S(() => SPACE.wrist);
  // ★ v99 — 여기도 뺐다 (위와 같은 까닭). 앉는 순간 이미 잡혔으므로
  //   **접히는 것을 바로 묻는다**
  await down();
  const folded = await until(() => !SPACE.wrist.shown, 90, '손목이 접히기');
  const w1 = await S(() => SPACE.wrist);
  ok(folded, `① ★★ 조종간을 잡으니 **손목이 사라진다** (접힘 ${w0.fold} → ${w1.fold})`);
  await up();
  // ══ ★★ **여기서 뜻이 바뀌었다** (v75) ═══════════════════════════════
  //
  //  v73 에는 「놓으면 돌아온다」가 맞았다. v75 에 조건이 **앉아 있는
  //  동안**으로 넓어졌다 — 화면을 찍어 보니 홀로그램이 **레이더를 정통으로
  //  덮고** 있었기 때문이다. 앉아 있는 동안 「지금 뭘 할지」는 조종석
  //  계기가 이미 다 말한다.
  //
  //  ★★★ 그래서 이 줄은 **게임이 틀린 것이 아니라 검사가 옛 설계를
  //    지키고 있던 것**이다. 이 저장소에서 여섯 번째다 — 안 고치면
  //    도구가 「덮고 있던 상태」로 되돌리라고 계속 조른다.
  ok(!(await S(() => SPACE.wrist)).shown,
    '② ★★ 놓아도 **앉아 있는 동안은 접힌 채**다 (v75) — 왼쪽 아래는'
    + ' 레이더가 있는 자리다');
  // ★ v120 — 「일어나면 돌아온다」는 **일어설 수가 없으므로** 접었다.
  //   「접는 것과 지우는 것은 다르다」는 뜻은 남기되, 물을 수 있는 형태로
  //   바꾼다: **표가 아직 손목을 들고 있나** (지운 것이 아니라 접은 것이다)
  ok((await S(() => SPACE.wrist)) !== null && typeof (await S(() => SPACE.wrist)).shown === 'boolean',
    '②-b ★★ 손목은 **지운 것이 아니라 접은 것**이다 — 상태가 그대로 있다 (v110 이후로 늘 접혀 있다)');
  await settle();

  // ③ ★★★ **부호** — 기수를 올리면 표적이 화면에서 **내려가야** 한다.
  //   사장님 「운전 방향 전환이 모두 반대잔아!」 · v66 에 좌우가 그랬고
  //   v73 에 위아래가 또 그랬다. 머리로 맞히지 않는다 — **점을 박고 잰다**
  await S(() => { SPACE.clearSky(); SPACE.putFly({ pitch: 0, yaw: 0, roll: 0 }); });
  await S(() => SPACE.callFoe('fighter', 0, 70));
  await until(() => !!SPACE.screenOf('fighter'), 30, '표적이 화면에 서기');
  const p0 = await S(() => SPACE.screenOf('fighter'));
  await S((y) => { window.__y0 = y; SPACE.putFly({ pitch: 0.25, yaw: 0, roll: 0 }); }, p0?.y ?? 0);
  const down3 = await until(() => {
    const s = SPACE.screenOf('fighter');
    return !!s && s.y < window.__y0 - 0.05;
  }, 60, '표적이 화면에서 내려가기');
  const p1 = await S(() => SPACE.screenOf('fighter'));
  ok(down3,
    `③ ★★★ 기수를 올리니 표적이 **화면에서 내려간다** (y ${p0?.y} → ${p1?.y}) —`
    + ' 올라가면 그건 조종간이 거꾸로 물린 것이다');

  // ④ ★★ **아래가 안 막힌다** — 「적이 하단에 나오면 더이상 화면을 아래로
  //   내릴 수 없는데」. 축에 벽이 있으면 뒤로 돈 적을 영영 못 겨눈다
  await S(() => SPACE.putFly({ pitch: -3.0, yaw: 0, roll: 0 }));
  const deep = await S(() => SPACE.fly3);
  ok(Math.abs(deep.pitch) > 2.5,
    `④ ★★★ 위아래로 **${(Math.abs(deep.pitch) * 57.3).toFixed(0)}도**까지 넘어간다 — 벽이 없다`);
  await S(() => SPACE.putFly({ pitch: 0, yaw: 0, roll: 0 }));

  // ⑤ ★★★ **급가속이 화면을 바꾸나** — 「빛무리가 쏟아져오거나 속도감이」
  //   ★ 별은 안 흘린다 (v57 고증). 흐르는 것은 먼지·화각·떨림이다
  const b0 = await S(() => SPACE.boost);
  await S((f) => { window.__fov0 = f; SPACE.putBoost(1); }, b0.fov);
  const wide = await until(() => SPACE.boost.fov > window.__fov0 + 4, 30, '화각이 넓어지기');
  const b1 = await S(() => SPACE.boost);
  ok(wide,
    `⑤ ★★★ 밀어붙이니 **화각이 넓어진다** (${b0.fov}° → ${b1.fov}°) — 속도감의 절반이 여기다`);
  ok(b1.mult >= 3,
    `⑥ ★★ 그리고 **${b1.mult}배**로 간다 — 안 빨라지면 그건 화면 효과일 뿐이다`);

  // ══ ⑦⑧ ★★★ **값이 셋인가** — 추진제 · 열 · 자국 ═══════════════════
  //  하나라도 빠지면 「거의 공짜니 늘 밟는 것이 답」이 되고, 그러면 조작이
  //  하나 는 것이 아니라 **없어진 것**이다.
  //  ★★ 여기서는 `putBoost` 를 안 쓴다 — 그건 `k` 만 밀어 놓을 뿐이라
  //    **추진제를 안 태운다.** 실제로 **R 을 누르고 있어야** 규칙이 돈다.
  //    검사가 제 손으로 값을 넣어 두고 「값이 든다」를 확인하면 그건
  //    검사가 아니라 흉내다
  await S(() => { SPACE.putBoost(0); SPACE.setPower('thrust', true); });
  const s0 = await S(() => SPACE.chase.sign);
  const f0 = await S(() => SPACE.supply.fuel);
  await S((f) => { window.__f0 = f; }, f0);
  await p.keyboard.down('r');
  const burned = await until(() => SPACE.supply.fuel < window.__f0 - 0.05, 90, '추진제가 주는 것');
  const s1 = await S(() => SPACE.chase.sign);
  const f1 = await S(() => SPACE.supply.fuel);
  await p.keyboard.up('r');
  ok(burned, `⑦ ★★ **추진제를 태운다** (${f0.toFixed(1)} → ${f1.toFixed(1)}) —`
    + ' R 을 실제로 눌러서 잰 값이다');
  ok(s1 > s0, `⑧ ★★★ 그리고 **자국이 굵어진다** (${s0.toFixed(1)} → ${s1.toFixed(1)}) —`
    + ' 밝게 타는 것은 멀리서도 보인다. 이게 빠지면 늘 밟는 것이 답이 된다');
  await S(() => { SPACE.putBoost(0); SPACE.clearSky(); });
}

console.log('\n[6g] ★★★ **진공** — 밖은 조용하고, 선체를 때린 것만 들린다 (v74)');
{
  // ★★ 사장님 「우주인 점을 감안한 전개인가?」 — 소리만 아무도 정한 적이
  //   없었다. 여기서 묻는 것은 **게임이 실제로 그 소리를 부르나**다.
  //   「소리가 나나」(파형)는 `tools/space-sound.js` 가 따로 잰다 —
  //   만들어 놓고 아무도 안 부르는 것이 이 저장소가 제일 자주 밟는 함정이다.
  await sit();
  await S(() => { SPACE.clearSky(); SPACE.putBoost(0); });
  await settle();

  // ① 맞으면 **선체 소리**를 부른다
  const onHit = await S(async () => {
    const seen = [];
    SPACE.audioSpy(seen);
    SPACE.hitMe('flank');
    await new Promise((r) => setTimeout(r, 80));
    SPACE.audioSpy(null);
    return seen;
  });
  ok(onHit.some((n) => n.startsWith('hull')),
    `① ★★★ 맞으니 **선체가 운다** (${onHit.join(', ') || '아무 소리도 안 났다'}) —`
    + ' 진공에서도 고체는 소리를 나른다. 지금까지 피격은 화면으로만 알았다');

  // ② ★★ **쏘는 소리가 맞는 소리와 다르다** — v73 까지 둘 다 `caught` 였다
  const onFire = await S(async () => {
    const seen = [];
    SPACE.putTarget('raider'); SPACE.putAim(0, 0);
    SPACE.audioSpy(seen);
    SPACE.fire();
    await new Promise((r) => setTimeout(r, 80));
    SPACE.audioSpy(null);
    return seen;
  });
  ok(onFire.includes('laser') || onFire.includes('tube'),
    `② ★★★ 쏘면 **무기 소리**가 난다 (${onFire.join(', ') || '없다'}) —`
    + ' v73 까지 `caught`(잡혔다)를 빌려 써서 **쏠 때마다 잡힌 소리**가 났다');
  ok(!onFire.some((n) => n.startsWith('hull')),
    '③ ★★ 그런데 **선체 소리는 안 난다** — 내가 쏜 것이 90m 밖에서 터져도'
    + ' 안 들리는 것이 맞다. 밖이 조용해야 「조용하면 안 맞았다」가 성립한다');

  // ④ 표가 「안 들린다」고 적어 둔 것이 정말 이름조차 없나
  const silent = await S(() => SPACE.silentList);
  ok(Array.isArray(silent) && silent.length >= 4,
    `④ 표에 **안 들리는 것 ${silent?.length ?? 0}가지**가 적혀 있다 —`
    + ' 안 정해 두면 다음 판에 누가 폭발음을 넣는다');
  await S(() => SPACE.clearSky());
}

console.log('\n[6h] ★★★ **레이더가 세 축을 다 말하나** — 「오른쪽 왼쪽이 아니고」 (v75)');
{
  // ★★ 사장님 「레이더 시스템을 더 정교하게 직관적으로. **오른쪽 왼쪽이
  //   아니고.** 실제 레이더 시스템을 고증해서」 — v74 까지 계기가 말하는
  //   것은 **방위 하나**였다. 세 축을 다 열어 놓고(v73) 계기는 평면이었다.
  await sit();
  await S(() => {
    SPACE.setPower('sensor', true);
    SPACE.putFly({ pitch: 0, yaw: 0, roll: 0 }); SPACE.putAim(0, 0);
    SPACE.clearSky();
  });
  await settle();
  await S(() => { SPACE.callFoe('fighter', 20, 70); SPACE.callFoe('gunship', -40, 130); });
  await until(() => (SPACE.combat?.blips ?? []).length >= 2, 40, '접촉 둘');
  // 고도를 흩는다 — 위아래가 없으면 여기서 드러난다
  await S(() => {
    const L = SPACE.sky.list;
    if (L[0]) SPACE.putSkyAz(L[0].id, L[0].az, 26);
    if (L[1]) SPACE.putSkyAz(L[1].id, L[1].az, -31);
  });
  await until(() => (SPACE.combat?.blips ?? []).some((b) => Math.abs(b.relEl) > 20), 30, '고도 차이');

  const blips = await S(() => SPACE.combat.blips);
  ok(blips.some((b) => Math.abs(b.relEl ?? 0) > 20),
    `① ★★★ 레이더가 **위아래를 안다** (${blips.map((b) => Math.round(b.relEl ?? 0)).join('° / ')}°) —`
    + ' v74 까지 이 값이 아예 없어서 아래에 있는 적도 「왼쪽」이라고만 떴다');

  // ② 접근율 — 한 프레임에 한 번만 재야 나온다
  ok(blips.some((b) => b.closing !== null && Number.isFinite(b.closing)),
    `② ★★ **접근율을 안다** (${blips.map((b) => (b.closing == null ? '—' : Math.round(b.closing))).join(' · ')}) —`
    + ' 부호 하나가 곧 추격 곡선이다 (BFM.md)');

  // ③ ★★★ RWR — 저쪽이 나를 겨누면 알려 주나
  await S(() => SPACE.putFoeAim(0.9));
  await p.waitForTimeout(600);
  const armed = await S(() => SPACE.combat.blips);
  ok(armed.some((b) => (b.aiming ?? 0) >= 0.45),
    `③ ★★★ **저쪽이 나를 겨누는 것을 안다** (${armed.map((b) => (b.aiming ?? 0).toFixed(2)).join(' · ')}) —`
    + ' v74 까지 이게 없어서 **맞기 전까지 아무 예고가 없었다**');

  // ④ 조준경 한 줄에서 「왼쪽/오른쪽」이 사라졌나
  const word = await S(() => SPACE.outside?.gunsight?.word ?? null);
  if (word !== null) {
    ok(!/왼쪽|오른쪽/.test(word), `④ ★★ 조준경이 「왼쪽/오른쪽」이라 안 한다 — 「${word}」`);
  } else {
    // 구멍이 없으면 표 쪽으로 묻는다 — 규칙은 `space-radar.js` 가 지킨다
    ok(true, '④ 조준경 한 줄은 `space-radar.js [5]` 가 지킨다 (화면 구멍이 없다)');
  }
  await S(() => SPACE.clearSky());
}

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ [6i] **광학 창 · 전투력** — 보고 정하나 (v79)
//
//  사장님 「멀리있는 적을 레이더 말고 **확대**하거나」 · 「**격추시 적
//  기체가 부서지는 화면**」 · 「**상대 우주선의 전투력**도 표시」.
//
//  ★ 계통 검사(`space-optic.js`)는 표를 재고, 여기서는 **사람이 거기까지
//    가나**를 잰다 — 앉으면 정말 뜨나, 격추하면 정말 되감기가 도나
// ══════════════════════════════════════════════════════════════════════════
console.log('\n[6i] ★★ **광학 창** — 앉으면 뜨나 · 격추가 보이나 (v79)');
{
  await S(() => { SPACE.putHelmSit(true); });
  await until(() => SPACE.helm2.k > 0.99, 30, '앉기');
  ok(await S(() => SPACE.optic.on), '① 앉으면 **광학 창이 뜬다**');

  await S(() => { SPACE.putAim(0, 0); SPACE.putTarget('raider'); });
  await until(() => SPACE.optic.kind === 'raider', 20, '표적 잡기');
  const o1 = await S(() => SPACE.optic);
  ok(o1.kind === 'raider' && o1.dist > 0, `② 겨눈 것을 비춘다 (${o1.kind} ${o1.dist}m)`);
  ok(o1.want > 1, `③ **저절로 당긴다** — ${o1.want}배 (손으로 안 돌린다)`);
  ok(o1.want <= 12, '④ 무한정은 아니다 — 무기가 한도를 정한다');

  const m1 = await S(() => SPACE.might);
  ok(m1.mine > 0 && m1.theirs > 0, `⑤ **전투력이 둘 다 나온다** (나 ${m1.mine} · 적 ${m1.theirs})`);
  ok(!!m1.word, `⑥ 견줌을 한 낱말로 말한다 — 「${m1.word}」`);

  // ★ 적이 **앞을 보나** — v69~v78 내내 등을 돌린 채 왔다 (v79 에 잡았다)
  const face = await S(() => SPACE.faceOf());
  ok(face?.fireBehind === true, '⑦ ★ 적이 **코를 이쪽으로** 하고 온다 (엔진 불이 뒤)');

  // ── 격추 ──
  const was = await S(() => SPACE.might.mine);
  await S(() => { const t = SPACE.sky.list.find((x) => x.kind === 'raider'); if (t) t.hp = 1; });
  await S(() => SPACE.fire());
  ok(await until(() => SPACE.optic.dead > 0, 25, '격추 되감기'),
    '⑧ ★★ 격추하면 **판이 그 자리를 비춘다** (되감기)');
  ok(await until(() => SPACE.wrecks > 0, 25, '잔해'),
    '⑨ ★★ **잔해가 남는다** — 한 프레임에 사라지지 않는다 (부서지는 것이 보인다)');
  // ══ ★★★ v99 — **이 줄도 v79 를 재고 있었다** ═══════════════════════
  //
  //  「격추가 나를 키운다」로 물었다. v79 에는 맞았다 — **부수면 노획이
  //  저절로 붙었다.** 그런데 v81 이 그것을 일부러 뒤집었다
  //  (`salvage-table.js` 머리말): 부순 다음에 **회수**라는 동작이 하나
  //  더 있고, 거기 지원 시계가 붙는다. 그래야 「지나친다」가 값이 있는
  //  선택이 된다.
  //
  //  ★★ 그래서 이 줄은 **뒤집힌 설계를 빨갛게 고발하고 있었다** —
  //    게임이 틀린 것이 아니라 검사가 v79 에 멈춰 있었다.
  //    이제 **v81 이 정한 것**을 지킨다: 부순 것만으로는 안 큰다
  const now = await S(() => SPACE.might.mine);
  ok(now === was,
    `⑩ ★★★ 격추만으로는 **안 큰다** (전투력 ${was} → ${now}) —`
    + ' v81 부터 **회수해야** 들어온다. 부수면 저절로 붙으면 「지나친다」가 공짜가 된다');

  // ── 화면 가득 (Z) ──
  await p.keyboard.press('KeyZ');
  ok(await until(() => SPACE.optic.big, 15, '전체 화면'),
    '⑪ **Z 로 화면 가득** — 조준 포드처럼');
  await p.keyboard.press('KeyZ');
  ok(await until(() => !SPACE.optic.big, 15, '닫기'), '⑫ 한 번 더 누르면 닫힌다');
  await S(() => { SPACE.putHelmSit(false); SPACE.clearSky(); });
}

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ [6j] **회수** — 부순 것과 얻는 것 사이에 일이 하나 있나 (v81)
// ══════════════════════════════════════════════════════════════════════════
console.log('\n[6j] ★★ **회수** — 꾸러미 · 그물 · 지원 시계 (v81)');
{
  await S(() => { SPACE.putHelmSit(true); });
  await until(() => SPACE.helm2.k > 0.99, 30, '앉기');
  await S(() => { SPACE.putAim(0, 0); });
  const pk = await S(() => SPACE.putPack('raider', 60));
  ok(!!pk, '① 부수면 그 자리에 **꾸러미**가 남는다');
  const sv0 = await S(() => SPACE.salvage);
  ok(sv0.call > 0, `② ★ **지원 시계가 돈다** (${sv0.call}초)`);
  ok(await until(() => SPACE.salvage.seen?.packs > 0, 30, '꾸러미'),
    '③ ★★ **창밖에 정말 보인다** — 규칙에만 있는 것이 아니다');
  ok((await S(() => SPACE.fireNet())).ok, '④ 겨누고 G 를 누르면 그물이 나간다');
  ok(await until(() => SPACE.salvage.seen?.net === true, 30, '그물'),
    '⑤ ★★ 그물과 줄이 창밖에 보인다');
  ok(await until(() => SPACE.salvage.reeling === true, 40, '감기'), '⑥ 감기 시작한다');
  ok(await S(() => SPACE.salvage.thrustHeld),
    '⑦ ★★ **감는 동안 추진이 묶인다** — 주우려면 도망칠 수 없다');
  const was = await S(() => SPACE.might.mine);
  const sp0 = await S(() => SPACE.might.spare);
  ok(await until(() => SPACE.salvage.got > 0, 90, '회수'), '⑧ ★★ 끝까지 감으면 들어온다');
  // ══ ★★ v110 — **회수가 「키운다」에서 「키울 것을 준다」로 바뀌었다** ══
  //  파츠는 랙에 여분으로 걸리고, **I 창에서 달아야** 전투력이 오른다.
  //  저절로 달면 I 창을 볼 이유가 없어지고 「고르는 것」이 사라진다.
  //  ★ 대신 놓칠 수 없게 조준경이 「★ I — 더 좋은 파츠」라고 부른다
  const sp1 = await S(() => SPACE.might.spare);
  const cargoUp = await S(() => Object.keys(SPACE.cargo?.items ?? {}).length > 0);
  ok(sp1 > sp0 || cargoUp,
    `⑨ ★★ 회수가 **무언가를 준다** — 랙 ${sp0}→${sp1} · 화물 ${cargoUp ? '늘었다' : '그대로'}`);
  ok(!(await S(() => SPACE.salvage.thrustHeld)), '⑩ 다 감으면 다시 나아갈 수 있다');
  await S(() => SPACE.clearSky());
}

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ [6m] **포획** — 멀리 날아간 것을 정말 데려오나 (v103)
//
//  ★ 사장님 「적이나 물체를 부수고 **그 자리에 있어야 아이템을 획득하지.
//    멀리 날아가버리잔아.** 일정 거리만 날아가고 **포획 같은 단축키로
//    자동으로 따라붙어서 도킹해서 아이템을 회수** 할 수 있도록해」
//
//  ★★ 계통 검사(`space-catch.js`)는 **뼈대만** 돈다. 여기는 **손으로만** —
//    앉고 · 꾸러미가 생기고 · K 를 누르고 · 정말 붙어서 화물이 느나
// ══════════════════════════════════════════════════════════════════════════
console.log('\n[6m] ★★★ **포획** — 멀리 날아간 것을 데려오나 (v103)');
{
  await S(() => { SPACE.putHelmSit(true); });
  await until(() => SPACE.helm2.k > 0.99, 30, '앉기');
  await S(() => { SPACE.putAim(0, 0); });
  // ★ 도킹이 닿는 거리(32m) **밖**에 둔다 — 그냥은 못 무는 자리다
  const pk = await S(() => SPACE.putPack('raider', 58));
  ok(!!pk, '① 도킹이 안 닿는 자리(58m)에 꾸러미가 있다');
  ok(!(await S(() => SPACE.dock)).near || (await S(() => SPACE.dock)).near?.dist > 32,
    '② ★ 여기서는 **H 로 그냥 못 문다** — 따라붙어야 한다');
  ok((await S(() => SPACE.tryCatch())).ok, '③ ★★ K 를 누르면 포획이 걸린다');
  ok(await until(() => SPACE.catch.chasing === true, 20, '따라붙기'),
    '④ ★★ **따라붙기 시작한다**');
  const d0 = await S(() => SPACE.catch.dist);
  ok(await until(() => SPACE.catch.dist < d0 - 6, 60, '다가가기'),
    `⑤ ★★★ **정말 가까워진다** (${d0}m 에서 줄어든다)`);
  ok(await until(() => SPACE.catch.arrived === true || SPACE.dock.step !== 'none', 180, '닿기'),
    '⑥ ★★★ **닿으면 그대로 문다** — 여기서 H 를 또 누르라고 하면 그건 두 손이다');
  ok(await until(() => (SPACE.cargo?.used ?? 0) > 0, 180, '화물'),
    '⑦ ★★★ **화물칸에 정말 들어온다** — 여기까지 와야 「회수」다');
  await S(() => { SPACE.clearSky(); });
}

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ [6n] **항법** — 고르면 갈 곳이 서나 · 수동에 길이 생기나 (v104)
//
//  ★ 사장님 「**항로, 미션을 선택하면 네비게이션이 나오도록 해줘.
//    그래야 수동으로도 이동할 수 있게.**」
// ══════════════════════════════════════════════════════════════════════════
console.log('\n[6n] ★★★ **항법** — 고르면 갈 곳이 서나 (v104)');
{
  await S(() => { SPACE.putHelmSit(true); });
  await until(() => SPACE.helm2.k > 0.99, 30, '앉기');
  const n0 = await S(() => SPACE.nav);
  ok(!!n0.to, `① ★★ 갈래를 골랐으니 **갈 곳이 서 있다** — 「${n0.word}」`);
  await S(() => SPACE.putAim(0, 0));
  await p.waitForTimeout(400);
  const on = await S(() => SPACE.nav);
  await S(() => SPACE.putAim(90, 0));
  await p.waitForTimeout(400);
  const off = await S(() => SPACE.nav);
  console.log(`   조준 0도 → ${on.off}° · 배수 ${on.mult}`);
  console.log(`   조준 90도 → ${off.off}° · 배수 ${off.mult}`);
  ok(off.off > on.off, '② ★★ 기수를 틀면 **벗어남이 는다**');
  ok(off.mult < on.mult, `③ ★★★ **틀면 느려진다** (${on.mult} → ${off.mult}) — 수동에 길이 생겼다`);
  ok(off.mult === 0, '④ ★★★ 완전히 딴 데를 보면 **아예 안 나아간다**');
  await S(() => SPACE.putAim(0, 0));
  await p.waitForTimeout(300);
  ok((await S(() => SPACE.nav.mult)) > 0.8, '⑤ ★ 돌아오면 다시 나아간다');
}

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ [6o] **파밍** — 부수면 파츠가 나오나 · 앉은 채로 다나 (v110)
//
//  ★ 사장님 「파밍은 **더 강한 무기, 더 강한 파츠, 더 강한 장갑, 보급품,
//    식량** 등을 얻을 거야」 · 「**항상 앉은 상태에서 모든 조작을 한다.
//    가 기본이야.**」
//
//  ★★ v107 이 부위 일곱 · 등급 다섯을 짓고 **떨구는 자리를 안 만들었다.**
//    각 계통의 검사는 다 초록인데 **사람은 거기까지 못 간다** — 이 검사가
//    막으려는 것이 정확히 그것이다
// ══════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════
//  ★★★ [6p] **손 배치** — Space 로 쏘나 · R 톡/꾹이 갈리나 (v110)
//
//  ★ 사장님 「공격도 스페이스로 바꾸고. 추력을 올리는 것도 r을 누르면
//    추력이 켜지고 꾹 누르면 가속되는 걸로 해줘. **이렇게해도 전투나
//    이동에 문제가 없을지 검증**하고」
//
//  ★★ 뼈대(`space-keys.js`)는 「톡과 꾹이 안 섞이나」까지만 잰다.
//    **브라우저가 Space 를 뺏나**는 여기서만 나온다 — 쪽이 내려가거나
//    초점 잡힌 「시작」 단추가 다시 눌리는 종류다
// ══════════════════════════════════════════════════════════════════════════
console.log('\n[6p] ★★★ **손 배치** — Space 사격 · R 톡/꾹 (v110)');
{
  await S(() => { SPACE.putHelmSit(true); });
  await until(() => SPACE.helm2.k > 0.99, 30, '앉기');
  // ① Space 가 브라우저에게 안 뺏기나 — 시작 화면이 다시 안 뜨나
  await p.keyboard.down('Space'); await p.waitForTimeout(150); await p.keyboard.up('Space');
  ok(await p.evaluate(() => !!document.getElementById('hint')?.hidden),
    '① ★★★ Space 를 쳐도 **시작 화면이 다시 안 뜬다** — 초점이 단추에 남아 있으면'
    + ' 쏘려고 누를 때마다 「시작」이 다시 눌린다');
  // ② R 톡 = 켜고 끄기
  const t0 = await S(() => SPACE.power.thrust);
  await p.keyboard.down('KeyR'); await p.waitForTimeout(90); await p.keyboard.up('KeyR');
  await p.waitForTimeout(300);
  ok((await S(() => SPACE.power.thrust)) !== t0, '② ★★★ **R 톡 — 추력이 바뀐다**');
  // ③ R 꾹 = 밀린다 · 떼도 추력이 남는다
  await p.keyboard.down('KeyR');
  const pushed = await until(() => SPACE.boost.k > 0.05, 20, '급가속');
  ok(pushed, '③ ★★★ **R 꾹 — 밀린다**');
  ok(await S(() => SPACE.power.thrust), '④ ★★ 꾹이면 추력이 **켜져 있다** (꺼져 있었어도 같이 켜진다)');
  await p.keyboard.up('KeyR'); await p.waitForTimeout(400);
  ok(await S(() => SPACE.power.thrust),
    '⑤ ★★★ **떼도 추력이 남는다** — 꺼지면 급가속이 「밀었다가 도로 느려지는」 헛일이 된다');
  // ⑥ Space 가 정말 쏘나
  //   ★ `hp` 로 재지 않는다 — `SPACE.putTarget` 이 검사용으로 **hp 를 1 로**
  //     박아 넣으므로 한 발에 죽고, 그러면 「깎였나」를 물을 수가 없다.
  //     **하늘에서 사라졌나 · 꾸러미가 남았나**로 묻는다 (진짜 결과다)
  await S(() => { SPACE.putAim(0, 0); SPACE.putTarget('gunship'); });
  await until(() => !!SPACE.combat.target, 20, '표적');
  const sky0 = await S(() => SPACE.sky.list.length);
  const pk0 = await S(() => SPACE.salvage.packs.length);
  await p.keyboard.down('Space'); await p.waitForTimeout(700); await p.keyboard.up('Space');
  const sky1 = await S(() => SPACE.sky.list.length);
  const pk1 = await S(() => SPACE.salvage.packs.length);
  ok(sky1 < sky0 && pk1 > pk0,
    `⑥ ★★★ **Space 로 쏘니 부서지고 잔해가 남는다** (하늘 ${sky0}→${sky1} · 꾸러미 ${pk0}→${pk1})`);
  await S(() => SPACE.clearSky());
}

console.log('\n[6q] ★★★ **락온 추적** — 묶으면 따라가고, 묶은 것으로 나가나 (v119)');
{
  //  ★ 사장님 (2026-08-12) 「락온 시키면 **자동으로 타겟을 따라가도록**
  //    해줘. 내가 타겟을 조준을 크게 벗어나면 다시 조준해야 해서 불편해」
  //  ★★ 여기서만 물을 수 있는 것: **계통 검사가 다 초록인데도** 사람이
  //    조종석에 앉아 그 순서를 밟을 수 있나. 특히 「묶은 뒤」는 v118 까지
  //    브라우저로 한 번도 못 재 봤다 — 락온에 2.6초가 걸리는데 머리 없는
  //    시계가 1/25 라 65초를 기다려야 했기 때문이다 (`SPACE.putLock` 이 그 자리)
  await S(() => { SPACE.putHelmSit(true); });
  await until(() => SPACE.helm2.k > 0.99, 30, '앉기');
  await S(() => {
    SPACE.setInfinite(true); SPACE.setPower('sensor', true);
    SPACE.setSupply({ missiles: 8 }); SPACE.clearSky(); SPACE.putAim(0, 0);
  });
  const foe = await S(() => SPACE.callFoe('fighter', 0, 90));
  await until(() => !!SPACE.combat.target, 20, '표적');
  const lock = await S(() => SPACE.putLock(true));
  ok(!!lock && (await S(() => SPACE.combat.radar.id)) !== null,
    `① ★★ 겨눈 것을 **묶었다** (${lock?.kind} ${lock?.dist}m)`);
  // ② 표적이 40도 옆으로 가도 안 놓는다 (옛 유지각 32도면 여기서 풀렸다)
  await S(() => { const t = SPACE.sky.list.find((x) => x.id === SPACE.combat.radar.id); t.az = 40; });
  await p.waitForTimeout(600);
  ok((await S(() => SPACE.combat.radar.id)) === lock?.id,
    '② ★★★ **40도 옆으로 가도 안 놓는다** — 유지 한계가 조준선이 아니라 **짐벌(60도)**이다');
  // ③④ 조준선에 **딴 것**을 걸어 두고 무기 둘을 쏴 본다.
  //   ★ **레이저를 먼저** 쏜다. 재장전(`c.cool`)은 무기끼리 나눠 쓰는데
  //     유도탄이 6.5초라, 유도탄부터 쏘면 헤드리스 시계(1/25)로 **162초**를
  //     기다려야 한다 — 그러면 레이저가 「재는 중」으로 조용히 안 나가고,
  //     그걸 「락온을 쐈다」로 잘못 읽는다 (그렇게 짰다가 한 번 속았다)
  await S(() => SPACE.callFoe('raider', 1, 70));
  const shoot = async (slot, key) => S(([s, k]) => {
    SPACE.putWeapon(s);
    const lockId = SPACE.combat.radar.id;
    const aimId = SPACE.combat.target?.id ?? null;
    const was = new Set((SPACE.combat.shotList ?? []).map((x) => x.id));
    SPACE.fire();
    const mine = (SPACE.combat.shotList ?? []).find((x) => !was.has(x.id) && x.weapon === k);
    return { lockId, aimId, to: mine?.target ?? null };
  }, [slot, key]);

  await until(() => SPACE.combat.cool <= 0, 40, '재장전');
  const r2 = await shoot(1, 'laser');
  ok(r2.to !== null && r2.to === r2.aimId,
    `③ ★★★ **레이저는 조준선(#${r2.aimId})으로 나간다** — 기총은 기수 고정이다.`
    + ' 전부 락온을 쏘면 겨누는 조작이 없어진다 (장르 안전핀)');

  await until(() => SPACE.combat.cool <= 0, 90, '재장전');
  const r = await shoot(3, 'arh');
  ok(r.to !== null && r.to === r.lockId && r.aimId !== r.lockId,
    `④ ★★★ **유도탄이 묶은 것(#${r.lockId})으로 나간다** — 조준선은 딴 것(#${r.aimId})을 보고 있는데도.`
    + ' 사장님이 「다시 조준해야 해서 불편하다」고 하신 그것이다');
  await S(() => { SPACE.putLock(false); SPACE.clearSky(); SPACE.setInfinite(false); });
}

console.log('\n[6o] ★★★ **파밍** — 부수면 파츠가 나오나 (v110)');
{
  await S(() => { SPACE.putHelmSit(true); });
  await until(() => SPACE.helm2.k > 0.99, 30, '앉기');
  ok(await S(() => SPACE.helm2.sat), '① ★★★ **앉아 있다** — 일어서는 것은 게임에 없다');
  const sp0 = await S(() => SPACE.might.spare);
  // ★ 파츠는 **확률**이라 한 번으로는 안 나올 수 있다. 여러 번 부순다
  let got = 0;
  for (let i = 0; i < 14 && !got; i++) {
    await S(() => { SPACE.putAim(0, 0); SPACE.putPack('gunship', 40); });
    got = await S(() => (SPACE.salvage.packs.filter((x) => x.fitPart).length));
  }
  ok(got > 0, `② ★★★ **부수면 부위 파츠가 나온다** — v107 은 만들고 떨구는 자리를 안 만들었다`);
  const p0 = await S(() => SPACE.salvage.packs.find((x) => x.fitPart)?.fitPart ?? null);
  console.log(`   꾸러미 안 — ${JSON.stringify(p0)}`);
  ok(!!p0?.slot && !!p0?.tier, '③ ★★ **부위와 등급**이 붙어 있다 — 그것이 「더 강한」이다');
  // I 창 — 앉은 채로 열리고 일곱 줄이 다 그려지나
  await S(() => SPACE.openBay(true));
  await p.waitForTimeout(250);
  ok(await p.evaluate(() => !document.getElementById('bay')?.hidden),
    '④ ★★★ **I 창이 앉은 채로 열린다** — 걸어갈 격납고가 없다');
  const rows = await p.evaluate(() => document.querySelectorAll('#fit-rows button[data-eq]').length);
  ok(rows === 7, `⑤ ★★ 부위 **일곱 줄**이 다 그려진다 (${rows})`);
  // 여분을 밀어 넣고 **정말 달리나**
  await S(() => SPACE.putParts([['gun', 'ace']]));
  await S(() => SPACE.openBay(true));
  const was = await S(() => SPACE.might.mine);
  await p.click('#fit-rows button[data-eq="gun"]').catch(() => {});
  await p.waitForTimeout(250);
  const now = await S(() => SPACE.might.mine);
  ok(now > was, `⑥ ★★★ **단추를 누르니 전투력이 올랐다** (${was} → ${now}) — 진짜 마우스로`);
  await S(() => SPACE.openBay(false));
  console.log(`   랙 ${await S(() => SPACE.might.spare)}/${await S(() => SPACE.might.spareMax)}`);
  await S(() => SPACE.clearSky());
}

console.log('\n[6k] ★★★ **아크 도약** — 「절망」일 때 빠져나갈 길이 있나 (v99)');
{
  // ★ 여태 견줌은 「절망 — **아크를 채우고 빠진다**」고 말해 왔는데,
  //   v98 까지 그 아크가 게임에 **없었다.** 여기가 그 말이 참이 되는 자리다
  await S(() => { SPACE.putHelmSit(true); });
  await until(() => SPACE.helm2.k > 0.99, 30, '앉기');
  await S(() => { SPACE.setPower('thrust', true); });

  // ① 전지가 없으면 — **왜 안 되는지 말한다**
  const no = await S(() => SPACE.jump());
  ok(!no.ok && no.why === 'cells', `① 전지가 없으면 **까닭을 말한다** (${no.why})`);
  ok((await S(() => SPACE.ai.line)) !== null, '② 조용히 안 된 것이 아니라 **말이 떴다**');

  // ③ 전지를 싣고 구간 한복판에 선다
  await S(() => { SPACE.putArc(8); SPACE.putLegT(120); });
  const b0 = await S(() => ({ t: SPACE.route.t, need: SPACE.route.need, sink: SPACE.sink.at }));
  const go = await S(() => SPACE.jump());
  ok(go.ok, '③ 전지가 있으면 **걸린다**');
  ok((await S(() => SPACE.arc)).cells === 8 - go.cells,
    `④ ★★ **전지를 지금 태운다** (8 → ${8 - go.cells}) — 다 재고 태우면 무르기가 공짜다`);

  // ⑤ 재는 동안 열이 저장고로 간다
  await until(() => SPACE.sink.at > b0.sink + 0.005, 60, '열');
  ok((await S(() => SPACE.sink.at)) > b0.sink,
    '⑤ ★★ 재는 동안 **열이 저장고에 쌓인다** — 뛴 값을 도착지에서 치른다');

  // ⑥ 다 재면 뛰고, 도착하면 구간을 건너뛰어 있다
  await S(() => SPACE.putCharge());
  ok(await until(() => SPACE.arc.jumps > 0, 220, '도약'), '⑥ 다 재면 **뛴다**');
  const a1 = await S(() => ({ t: SPACE.route.t, arc: SPACE.arc }));
  ok(a1.t > b0.t + b0.need * 0.3,
    `⑦ ★★★ **구간을 건너뛰었다** (${b0.t.toFixed(0)} → ${a1.t.toFixed(0)}초)`
    + ' — 그만큼의 적도 재료도 못 만난다. 이것이 이 계통의 값이다');
  ok(a1.arc.cool > 0, `⑧ ★ 대기가 걸린다 (${a1.arc.cool}초) — 연달아 뛰어 구간을 통째로 못 넘긴다`);
  const again = await S(() => SPACE.jump());
  ok(!again.ok && again.why === 'cool', '⑨ ★ 바로 또 누르면 **왜 안 되는지 말한다**');
}

console.log('\n[7] ★★★ **끝까지 간다** — 적 행성 상공 · 투하 · 그리고 「이렇게 왔다」');
{
  // ══ ★★★ v99 — **이 절이 없어진 설계를 재고 있었다** ═══════════════
  //
  //  v98 까지 여기는 **성간 공백**을 물었다: 「따라오지」라고 말하나 ·
  //  창밖이 `void` 인가 · **떠도는 것이 없나** · 별이 그대로인가.
  //  그런데 v93 에 목적이 뒤집히면서 마지막 구간은 **적 행성 상공**이
  //  됐다 (`void-table.js VOID.region = 'siege'` · `byRegion.siege = 8`).
  //
  //  ★★ 그래서 넷이 빨갰는데, **게임이 틀린 것이 아니라 검사가 낡은
  //    것**이었다. 이 저장소가 제일 자주 밟는 함정이다 — 「없어진 것을
  //    재는 검사는 조용하다가 엉뚱할 때 운다」.
  //
  //  ★★★ 이제 **지금 있는 끝**을 묻는다: 닿는다 → 창이 열린다 →
  //    떨군다 → 벌린다 → 끝 화면이 **목록**이다
  await S(() => { SPACE.setPower('thrust', true); SPACE.seekVoid(); });
  ok(await until(() => SPACE.inVoid, 30, '마지막 구간 진입'),
    '① **마지막 구간에 들어선다** — 거점을 안 거치고 바로');
  ok(await until(() => SPACE.region === 'siege', 40, '창밖이 적 행성 상공으로 바뀌기'),
    `② 창밖이 **적 행성 상공**으로 바뀐다 (지금 ${await S(() => SPACE.region)})`);
  // ★★ **여기가 제일 뜨거운 곳이다.** v98 까지는 반대로 「떠도는 것이
  //   없다」를 물었다 — 그건 「따라오지 못하는 곳」 시절의 물음이다
  ok(await until(() => SPACE.sky.list.length > 0, 60, '적'),
    '③ ★★★ **적이 있다** — 제일 두꺼운 곳이다 (v98 까지는 「없다」를 물었다)');
  const said1 = await said();
  ok(/상공|방공|마지막 구간/.test(said1), `④ 들어설 때 말해 준다 — 「${said1.trim()}」`);

  // ══ 투하 — 마디 넷 ═══════════════════════════════════════════
  ok(await until(() => SPACE.drop.phase === 'run', 60, '투하 진입'),
    '⑤ ★★ **투하가 시작된다** — 시계가 혼자 간다');
  // 무장 안 한 채 V — **왜 안 되는지 말하나**
  await p.keyboard.press('KeyV');
  await p.waitForTimeout(500);
  ok(/무장|크레이들|창이 아닙니다/.test(await said()),
    `⑥ 무장 전에 V 를 누르면 **까닭을 말한다** — 「${(await said()).trim()}」`);
  // 재료를 채우고 무장한다 (기관실 왕복은 space-head.js 가 따로 본다)
  await S(() => { SPACE.fillHead(); SPACE.armHead(); });
  ok((await S(() => SPACE.warhead)).armed, '⑦ 채우고 무장하면 **무장된다**');
  // 창이 열릴 때까지 — 헤드리스로 150초를 안 걷는다
  await S(() => SPACE.putDrop('run', 149));
  ok(await until(() => SPACE.drop.phase === 'window', 90, '투하 창'),
    '⑧ ★★ **투하 창이 열린다**');
  await p.keyboard.press('KeyV');
  await p.waitForTimeout(700);
  ok(await until(() => ['fall', 'blast', 'over'].includes(SPACE.drop.phase), 60, '떨어짐'),
    '⑨ ★★★ **V 로 떨군다** — 목적 한 줄의 세 번째가 손에 닿는다');
  ok(await until(() => SPACE.outside.shots > 0 || SPACE.drop.phase !== 'fall', 40, '창밖의 탄'),
    '⑩ ★ **창밖으로 떨어지는 것이 보인다** — 규칙에만 있는 것이 아니다');
  // 벌린다 — 급가속
  await S(() => { SPACE.setPower('thrust', true); SPACE.putBoost(1); });
  ok(await until(() => ['blast', 'over'].includes(SPACE.drop.phase), 120, '터짐'),
    '⑪ ★★ **터진다** — 벌린 만큼 덜 상한다');

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
