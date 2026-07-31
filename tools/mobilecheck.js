// 모바일 점검 (v204) — 사장: "플레이 안되는데?"
//
// 사장은 갤럭시로 하신다(F9 리포트를 올린 스크린샷이 삼성 폰이었다).
// PC 브라우저에서 「플레이 가능」이 나와도 폰에서 안 되면 사장에게는 안 되는 게임이다.
// 이 도구는 **폰 그대로** 연다: 모바일 뷰포트 · 터치 이벤트 · 키보드 없음.
//   node tools/mobilecheck.js [URL]
const { chromium, devices } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.argv[2] || 'http://127.0.0.1:8137/';

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const ctx = await b.newContext({
    viewport: process.argv[3] === 'landscape' ? { width: 915, height: 412 } : { width: 412, height: 915 },
    deviceScaleFactor: 2.6,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36',
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));

  console.log('\n════ 모바일 점검 (' + (process.argv[3] === 'landscape' ? '915×412 가로' : '412×915 세로') + ' · 터치 · 키보드 없음) ════');
  await p.goto(URL, { waitUntil: 'load', timeout: 45000 });
  await p.waitForFunction(() => typeof Game !== 'undefined' && Game.state, { timeout: 20000 }).catch(() => {});

  // ① 터치 리스너가 등록돼 있는가 — 없으면 폰에서 조작 자체가 불가능하다
  const listeners = await p.evaluate(() => {
    const src = [...document.querySelectorAll('script')].map((s) => s.src).join(' ');
    return {
      touchAPI: 'ontouchstart' in window,
      // 실제로 게임이 터치를 듣는지 — 합성 터치를 쏴서 입력 상태가 변하는지로 판별한다
      hasInput: typeof Input !== 'undefined',
      keys: typeof Input !== 'undefined' ? Object.keys(Input).slice(0, 12) : [],
      src: src.length > 0,
    };
  }).catch(() => null);
  console.log('  입력 모듈: ' + JSON.stringify(listeners));

  // ★ 캔버스 실제 위치를 먼저 잡는다. 1차에 화면 좌표로 탭했더니 캔버스 **밖**을 눌렀다 —
  //   세로 폰에서 960×540 가로 캔버스는 화면의 일부만 차지한다 (레터박스)
  const box = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, cw: c.width, ch: c.height };
  });
  console.log('  캔버스 배치: ' + JSON.stringify({ ...box, x: Math.round(box.x), y: Math.round(box.y),
    w: Math.round(box.w), h: Math.round(box.h) }));
  // 게임 내부 좌표(960×540) → 화면 좌표
  const toScreen = (gx, gy) => [box.x + (gx / box.cw) * box.w, box.y + (gy / box.ch) * box.h];

  // ② 프롤로그를 탭으로 뚫는다
  const trail = [];
  for (let i = 0; i < 30; i++) {
    const st = await p.evaluate(() => Game.state).catch(() => null);
    trail.push(st);
    if (st === 'play') break;
    // ★ 화면 한가운데를 눌러도 버튼이 아니면 아무 일도 안 난다.
    //   게임이 스스로 아는 버튼 위치를 물어서 그 자리를 누른다 (사람은 버튼을 본다)
    const target = await p.evaluate(() => {
      if (typeof HUD === 'undefined') return null;
      const st = Game.state;
      let r = null;
      if (st === 'hub' && HUD.hubButtonRects) r = HUD.hubButtonRects()[0];
      if (!r && HUD.cardRects) r = HUD.cardRects(3)[0];
      return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : null;
    }).catch(() => null);
    const [tx, ty] = target ? toScreen(target.x, target.y) : toScreen(480, 300);
    await p.touchscreen.tap(tx, ty);
    await p.waitForTimeout(400);
  }
  const seq = []; for (const s of trail) if (seq[seq.length - 1] !== s) seq.push(s);
  console.log('  상태 흐름(탭만): ' + seq.join(' → '));

  // ③ 폰에서 **움직일 수 있는가** — 이게 핵심이다
  const st0 = await p.evaluate(() => (Game.player ? { x: Math.round(Game.player.x), y: Math.round(Game.player.y), s: Game.state } : null));
  // 화면 왼쪽 아래를 길게 끌어 본다 (가상 스틱이 있다면 여기 있을 자리)
  // 가상 스틱은 **끌어야** 한다 — 탭만으로는 방향이 안 생긴다 (실제 손가락과 같다)
  const [ox, oy] = toScreen(150, 400);
  const [dx2, dy2] = toScreen(260, 400);
  await p.touchscreen.tap(ox, oy);
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: ox, y: oy }] });
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove',
      touchPoints: [{ x: ox + (dx2 - ox) * (i / 6), y: oy + (dy2 - oy) * (i / 6) }] });
    await p.waitForTimeout(90);
  }
  await p.waitForTimeout(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {});
  const st1 = await p.evaluate(() => (Game.player ? { x: Math.round(Game.player.x), y: Math.round(Game.player.y), s: Game.state } : null));
  const moved = st0 && st1 && (Math.abs(st1.x - st0.x) + Math.abs(st1.y - st0.y)) > 6;
  console.log('  이동 시도: ' + JSON.stringify(st0) + ' → ' + JSON.stringify(st1) + '  ' + (moved ? '✓ 움직임' : '✗ 못 움직임'));

  await p.screenshot({ path: 'docs/audit/mobilecheck.png' });
  if (errs.length) { console.log('  ✗ 오류 ' + errs.length + ': ' + errs[0]); }
  console.log('\n  판정: ' + (moved ? '폰에서 조작 가능' : '★ 폰에서 움직일 수 없다'));
  await b.close();
})().catch((e) => { console.log('CRASH ' + e.message); process.exit(2); });
