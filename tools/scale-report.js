// 크기 비율 점검 — 선언된 몸 크기(r)와 실제 화면 높이가 맞는가?
//   node tools/scale-report.js
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const TYPES = process.argv.slice(2).length ? process.argv.slice(2)
  : ['cinder', 'skeleton', 'sniper', 'shieldSkeleton', 'ghoul', 'jailer', 'acolyte', 'shade', 'golem'];
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.goto(`${BASE}/?test=1&bot=1`);
  await p.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'play');
  const R = await p.evaluate((types) => types.map((t) => {
    const e = createEnemy(t, 100, 100, false, 1);
    const img = Sprites[e.sprite];
    const bh = Sprites.bodyH(img);
    const ds = img.__ds || 2;
    return { t, r: e.r, src: img.height, bh, ds: +ds.toFixed(2), screen: Math.round(bh * ds) };
  }), TYPES);
  await b.close();
  console.log('\n타입            r    소스   몸높이  배율   화면높이   화면/r');
  for (const x of R) {
    console.log(String(x.t).padEnd(15) + String(x.r).padStart(3) + String(x.src).padStart(7)
      + String(x.bh).padStart(8) + String(x.ds).padStart(7) + String(x.screen).padStart(9)
      + (x.screen / x.r).toFixed(2).padStart(9));
  }
  const rr = R.map((x) => x.screen / x.r);
  console.log('\n화면/r 편차: min ' + Math.min(...rr).toFixed(2) + ' max ' + Math.max(...rr).toFixed(2)
    + '  (전부 같아야 비율이 맞는 것)');
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
