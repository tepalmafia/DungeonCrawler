// 스프라이트 감사 (v200) — 보스가 뭘 들고 있는지 **내가 확대해서 직접 본다.**
// 사장 지적: "보스가 뭘 들고 있는지도 구분이 안되잔아"
//   node tools/sprite-sheet.js  →  docs/audit/sprites-boss.png (8배 확대 시트)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const OUT = path.join(__dirname, '..', 'docs', 'audit');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(`${BASE}/?test=1`);
  await page.waitForFunction(() => typeof Sprites !== 'undefined' && Sprites.boss);

  const data = await page.evaluate(() => {
    // 보스 정의에서 실제 쓰이는 스프라이트 + 화면 배율을 뽑는다
    const defs = Object.entries(BOSS_DEFS).map(([k, d]) => ({
      key: k, name: d.name, sprite: d.sprite, scale: d.scale,
    }));
    const seen = new Set(); const list = [];
    for (const d of defs) { if (seen.has(d.sprite)) continue; seen.add(d.sprite); list.push(d); }

    const Z = 8;                       // 8배 확대
    const COLS = 6;
    const CW = 30 * Z + 24, CH = 30 * Z + 56;
    const cv = document.createElement('canvas');
    cv.width = COLS * CW; cv.height = Math.ceil(list.length / COLS) * CH;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#15121c'; g.fillRect(0, 0, cv.width, cv.height);

    const stats = [];
    list.forEach((d, i) => {
      const img = Sprites[d.sprite];
      if (!img) return;
      const cx = (i % COLS) * CW, cy = Math.floor(i / COLS) * CH;
      g.drawImage(img, cx + 12, cy + 12, img.width * Z, img.height * Z);
      g.fillStyle = '#e8e0cf'; g.font = '13px sans-serif'; g.textAlign = 'left';
      g.fillText(`${d.name}`, cx + 12, cy + CH - 26);
      // 화면 실제 크기 = 스프라이트px × def.scale × Renderer.SCALE
      const onScreen = Math.round(img.width * d.scale * 2);
      g.fillStyle = '#9a92a8'; g.font = '11px sans-serif';
      g.fillText(`${img.width}×${img.height}px → 화면 ${onScreen}px`, cx + 12, cy + CH - 10);

      // 색 다양성 — 스프라이트가 몇 색으로 이뤄졌나 (실루엣 가독성의 대리 지표)
      const t = document.createElement('canvas'); t.width = img.width; t.height = img.height;
      const tg = t.getContext('2d'); tg.drawImage(img, 0, 0);
      const px = tg.getImageData(0, 0, t.width, t.height).data;
      const cols = new Set(); let filled = 0;
      for (let p = 0; p < px.length; p += 4) {
        if (px[p + 3] < 40) continue;
        filled++;
        cols.add(`${px[p] >> 4},${px[p + 1] >> 4},${px[p + 2] >> 4}`);
      }
      stats.push({ name: d.name, sprite: d.sprite, w: img.width, h: img.height,
        onScreen, colors: cols.size, fillPct: Math.round(filled / (t.width * t.height) * 100) });
    });
    return { png: cv.toDataURL('image/png'), stats, n: list.length };
  });

  fs.writeFileSync(path.join(OUT, 'sprites-boss.png'),
    Buffer.from(data.png.split(',')[1], 'base64'));
  console.log(`\n════ 보스 스프라이트 감사 (고유 ${data.n}종) ════`);
  console.log('  이름'.padEnd(26) + '원본'.padEnd(10) + '화면'.padEnd(9) + '색수'.padEnd(6) + '채움');
  for (const s of data.stats) {
    console.log('  ' + s.name.padEnd(24) + `${s.w}×${s.h}`.padEnd(10) +
      `${s.onScreen}px`.padEnd(9) + String(s.colors).padEnd(6) + s.fillPct + '%');
  }
  console.log(`\n시트: ${path.join(OUT, 'sprites-boss.png')}`);
  await browser.close();
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
