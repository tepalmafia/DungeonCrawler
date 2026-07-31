// 플레이 가능 점검 (v203) — 사장: "플레이 안되는데?"
//
// 「검증 통과」와 「사장 브라우저에서 실제로 켜진다」는 다르다.
// 이 도구는 **사장이 하는 그대로** 연다: 캐시 없는 새 브라우저, 테스트 파라미터 없음,
// 저장 데이터 없음. 그리고 실제로 조작해서 움직이는지 본다.
//   node tools/playcheck.js [URL]
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.argv[2] || 'http://127.0.0.1:8137/';

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const ctx = await b.newContext({ viewport: { width: 960, height: 540 } });
  const p = await ctx.newPage();
  const errs = [], warns = [], failed = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 300)));
  p.on('console', (m) => { if (m.type() === 'error') warns.push(m.text().slice(0, 200)); });
  p.on('requestfailed', (r) => failed.push(r.url().split('/').pop() + ' — ' + (r.failure() || {}).errorText));

  console.log('\n════ 플레이 가능 점검 ════');
  console.log('대상: ' + URL + '  (테스트 파라미터 없음 · 저장 없음 — 사장이 여는 그대로)');
  let ok = true;
  try {
    const resp = await p.goto(URL, { waitUntil: 'load', timeout: 45000 });
    console.log('  HTTP ' + (resp ? resp.status() : '?'));
  } catch (e) { console.log('  ✗ 페이지 로드 실패: ' + e.message.slice(0, 120)); ok = false; }

  // ① 스크립트가 전부 살아 있는가
  const boot = await p.evaluate(() => ({
    game: typeof Game !== 'undefined',
    sprites: typeof Sprites !== 'undefined' && !!Sprites.knight,
    dungeon: typeof Dungeon !== 'undefined',
    state: typeof Game !== 'undefined' ? Game.state : null,
    ver: typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : null,
  })).catch(() => null);
  console.log('  부팅: ' + JSON.stringify(boot));
  if (!boot || !boot.game || !boot.state) { console.log('  ✗ 게임 객체가 없다 — 스크립트가 안 떴다'); ok = false; }

  // ② 캔버스가 실제로 뭔가를 그리는가 (검은 화면 판별)
  const painted = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return { canvas: false };
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 0; i < d.length; i += 40) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
    return { canvas: true, w: c.width, h: c.height, litPct: +(lit / (d.length / 40) * 100).toFixed(1) };
  }).catch(() => ({ canvas: false }));
  console.log('  캔버스: ' + JSON.stringify(painted));
  if (!painted.canvas || painted.litPct < 1) { console.log('  ✗ 화면이 사실상 검다'); ok = false; }

  // ③ 실제 조작 — 시작하고 걸어 본다
  // 프롤로그·메뉴를 실제 사람처럼 뚫는다 — 클릭과 키를 번갈아 최대 30회
  const trail = [];
  for (let i = 0; i < 30; i++) {
    const st = await p.evaluate(() => Game.state).catch(() => null);
    trail.push(st);
    if (st === 'play') break;
    await p.mouse.click(480, 300);
    await p.keyboard.press(i % 2 ? 'Enter' : 'Space');
    await p.waitForTimeout(400);
  }
  const seq = [];
  for (const s2 of trail) if (seq[seq.length - 1] !== s2) seq.push(s2);
  console.log('  상태 흐름: ' + seq.join(' → '));
  const reached = await p.evaluate(() => Game.state).catch(() => null);
  if (reached !== 'play') { console.log('  ✗ 30번 눌러도 플레이 상태에 못 들어간다 (현재: ' + reached + ')'); ok = false; }
  await p.waitForTimeout(600);
  const before = await p.evaluate(() => (Game.player ? { x: Game.player.x, y: Game.player.y, s: Game.state } : null));
  await p.keyboard.down('KeyD'); await p.waitForTimeout(700); await p.keyboard.up('KeyD');
  const after = await p.evaluate(() => (Game.player ? { x: Game.player.x, y: Game.player.y, s: Game.state } : null));
  const moved = before && after && Math.abs(after.x - before.x) > 4;
  console.log('  조작: 상태 ' + (before && before.s) + ' → ' + (after && after.s)
    + ' · 이동 ' + (before && after ? Math.round(Math.abs(after.x - before.x)) : '?') + 'px  ' + (moved ? '✓' : '(메뉴일 수 있음)'));

  await p.screenshot({ path: 'docs/audit/playcheck.png' });

  if (failed.length) { console.log('\n  ✗ 로드 실패한 파일 ' + failed.length + '개:'); failed.slice(0, 8).forEach((f) => console.log('     ' + f)); ok = false; }
  if (errs.length) { console.log('\n  ✗ 자바스크립트 오류 ' + errs.length + '건:'); errs.slice(0, 5).forEach((e) => console.log('     ' + e)); ok = false; }
  if (warns.length) { console.log('\n  ⚠ 콘솔 오류 ' + warns.length + '건:'); warns.slice(0, 5).forEach((e) => console.log('     ' + e)); }
  console.log('\n  판정: ' + (ok ? '플레이 가능' : '★ 플레이 불가'));
  await b.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.log('CRASH ' + e.message); process.exit(2); });
