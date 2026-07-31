// 크기 대조 — 새로 그린 스프라이트가 게임 안에서 거인이 되지 않았는가?
// 원본 해상도를 올리면 화면에서도 커진다. ds(고유 배율)가 제대로 먹는지 눈으로 본다.
//   node tools/size-check.js [적종류...]
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const OUT = 'docs/audit/size-check.png';
const TYPES = process.argv.slice(2).length ? process.argv.slice(2) : ['skeleton', 'shieldSkeleton', 'ghoul', 'boneHeap'];
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  await p.goto(`${BASE}/?test=1&bot=1`);
  await p.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'play');
  await p.evaluate((types) => {
    Dungeon.floor = 1; Dungeon.roomIndex = 1; Dungeon.build('combat');
    Game.enemies.length = 0;
    Bot.on = false;                                    // 봇이 죽여버리면 비교가 안 된다
    const c = World.center();
    Game.player.x = c.x - 190; Game.player.y = c.y;
    types.forEach((t, i) => {
      const e = createEnemy(t, c.x - 60 + i * 110, c.y, false, 1);
      e.spawnT = 0; e.hp = e.maxHp = 9999;             // 죽지 않게 — 크기만 본다
      Game.enemies.push(e);
    });
  }, TYPES);
  await p.waitForTimeout(600);
  await p.screenshot({ path: OUT });
  await b.close();
  console.log('ok ' + OUT + (errs.length ? '  ⚠ ' + errs[0] : ''));
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
