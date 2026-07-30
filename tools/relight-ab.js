// 광원 통일 패스 전/후 비교 시트 — 숫자보다 그림으로 판정한다
//   node tools/relight-ab.js
const fs = require('fs');
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const OUT = 'docs/audit/relight-ab.png';
const PICKS = ['knight', 'archer', 'mage', 'skeleton', 'ghoul', 'golem', 'wisp', 'slime',
  'boss', 'bossGolem', 'bossSpore', 'bossIgnis', 'bossAbyss', 'bossKing', 'warden', 'executioner'];

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const grab = async (strength) => {
    const p = await b.newPage({ viewport: { width: 1000, height: 320 } });
    await p.goto(`${BASE}/?test=1&bot=1&relight=${strength}`);
    await p.waitForFunction(() => typeof Sprites !== 'undefined' && typeof Game !== 'undefined' && Game.state);
    const url = await p.evaluate((keys) => {
      const Z = 5;
      const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 260;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
      g.fillStyle = '#15121c'; g.fillRect(0, 0, cv.width, cv.height);
      let x = 14;
      for (const k of keys) {
        const img = Sprites[k];
        if (!img || !img.width) { x += 62; continue; }
        const w = img.width * Z, h = img.height * Z;
        g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(x - 3, 2, 58, 250);
        g.drawImage(img, x + (58 - w) / 2 - 3, 10 + (170 - h) / 2, w, h);
        g.fillStyle = '#8a8296'; g.font = '10px sans-serif';
        g.fillText(k.slice(0, 9), x - 1, 248);
        x += 62;
      }
      return cv.toDataURL('image/png');
    }, PICKS);
    await p.close();
    return url;
  };
  const A = await grab(0), B = await grab(0.5);
  const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
  await p.goto(`${BASE}/?test=1&bot=1`);
  await p.waitForFunction(() => typeof Sprites !== 'undefined');
  const png = await p.evaluate(async ([a, bb]) => {
    const ld = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; });
    const IA = await ld(a), IB = await ld(bb);
    const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 600;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#15121c'; g.fillRect(0, 0, cv.width, cv.height);
    g.font = '13px sans-serif'; g.textAlign = 'left';
    g.fillStyle = '#e8e0cf';
    g.fillText('A · 종전 — 광원 방향 제각각 (93종 중 규칙 준수 14종 = 15%)', 12, 20);
    g.drawImage(IA, 0, 28);
    g.fillStyle = '#ffd866';
    g.fillText('B · v200 광원 통일 패스 — 좌상단 빛 / 우하단 그늘. 색상(hue)은 안 건드린다 강도 0.5', 12, 320);
    g.drawImage(IB, 0, 328);
    return cv.toDataURL('image/png');
  }, [A, B]);
  fs.writeFileSync(OUT, Buffer.from(png.split(',')[1], 'base64'));
  console.log('ok ' + OUT);
  await b.close();
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
