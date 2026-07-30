// 몹 시트 — 재조립한 스프라이트를 확대해서 직접 본다 (100%로는 판정이 안 된다)
//   node tools/mob-sheet.js [키...]
const fs = require('fs');
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const OUT = 'docs/audit/mob-sheet.png';
const KEYS = process.argv.slice(2).length ? process.argv.slice(2)
  : ['skeleton', 'shieldSkeleton', 'sniper', 'ghoul', 'golem', 'jailer', 'acolyte', 'shade', 'cinder'];
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 1200, height: 460 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  await p.goto(`${BASE}/?test=1&bot=1`);
  await p.waitForFunction(() => typeof Sprites !== 'undefined' && typeof Game !== 'undefined' && Game.state);
  const png = await p.evaluate((keys) => {
    const Z = 4, CW = 170, CH = 190;
    const cols = Math.min(keys.length, 7);
    const rows = Math.ceil(keys.length / cols);
    const cv = document.createElement('canvas');
    cv.width = cols * CW + 20; cv.height = rows * CH + 40;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#15121c'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#ffd866'; g.font = '14px sans-serif';
    g.fillText('부품 공방으로 재조립 — 4배 확대 · 광원 좌상단 · 공통 팔레트', 12, 22);
    keys.forEach((k, i) => {
      const img = Sprites[k];
      const cx = 10 + (i % cols) * CW, cy = 34 + Math.floor(i / cols) * CH;
      g.fillStyle = 'rgba(255,255,255,0.035)'; g.fillRect(cx, cy, CW - 8, CH - 14);
      if (img && img.width) {
        const w = img.width * Z, h = img.height * Z;
        g.drawImage(img, cx + (CW - 8 - w) / 2, cy + (CH - 34 - h) / 2, w, h);
      }
      g.fillStyle = '#c8c2d4'; g.font = '11px sans-serif';
      g.fillText(k + (img && img.width ? ` ${img.width}×${img.height}` : ' 없음'), cx + 6, cy + CH - 20);
    });
    return cv.toDataURL('image/png');
  }, KEYS);
  fs.writeFileSync(OUT, Buffer.from(png.split(',')[1], 'base64'));
  console.log('ok ' + OUT + (errs.length ? '  ⚠ ' + errs[0] : ''));
  await b.close();
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
