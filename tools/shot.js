// 한 장 찍기 — 맵/전투 화면을 그대로 캡처한다 (아트 반복 작업용)
//   node tools/shot.js [출력경로] [층] [방종류]
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const OUT = process.argv[2] || 'docs/audit/live-map-now.png';
const FLOOR = parseInt(process.argv[3] || '1', 10);
const KIND = process.argv[4] || 'combat';
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  await p.goto(`${BASE}/?test=1&bot=1`);
  await p.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'play');
  await p.evaluate(([f, k]) => {
    Dungeon.floor = f;
    Dungeon.roomIndex = k === 'boss' ? Dungeon.totalRooms : 1;
    Dungeon.build(k);
    if (k === 'empty') { Game.enemies.length = 0; Dungeon.build('combat'); Game.enemies.length = 0; }
  }, [FLOOR, KIND === 'empty' ? 'combat' : KIND]);
  await p.waitForTimeout(KIND === 'boss' ? 3000 : 700);
  await p.screenshot({ path: OUT });
  await b.close();
  console.log('ok ' + OUT + (errs.length ? '  ⚠ ' + errs[0] : ''));
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
