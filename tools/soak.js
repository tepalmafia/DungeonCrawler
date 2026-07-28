// 봇 소크 — 장시간 자동 플레이로 런타임 에러·크래시를 잡는다.
//   node tools/soak.js [분]
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const MIN = parseFloat(process.argv[2] || '5');
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  page.on('crash', () => errs.push('PAGE CRASH'));
  await page.goto(`${BASE}/?test=1&bot=1&botloop=1&ff=8`);
  await page.waitForFunction(() => typeof Game !== 'undefined' && typeof Sprites !== 'undefined');
  await page.evaluate(() => {
    localStorage.clear(); Meta.load(); Meta.data.introSeen = true;
    Meta.data.classes = { knight: true, archer: true, mage: true, alch: true };
    Meta.data.wins = 1; Meta.setHeat(1); Meta.save();
  });
  await page.reload();
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.state);
  const end = Date.now() + MIN * 60000;
  let last = null;
  while (Date.now() < end && !errs.length) {
    await page.waitForTimeout(15000);
    try {
      last = await page.evaluate(() => ({
        state: Game.state, floor: Dungeon.floor,
        attacks: (Bot.stats && Bot.stats.attacks) || 0, deaths: Bot.deaths || {},
        hp: Game.player ? Game.player.hp : null,
      }));
      process.stdout.write(`  ${new Date().toISOString().slice(11, 19)} ${JSON.stringify(last)}\n`);
    } catch (e) { errs.push('EVAL ' + e.message.slice(0, 80)); break; }
  }
  await browser.close();
  console.log('errors:', errs.length, errs.slice(0, 5));
  console.log('final:', JSON.stringify(last));
  process.exit(errs.length ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
