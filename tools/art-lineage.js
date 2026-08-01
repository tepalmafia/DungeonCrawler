// ══════════════════════════════════════════════════════════════════════════
//  리니지 초창기 화풍 시제품을 찍는다.
//
//    python3 tools/serve.py 8137 &   node tools/art-lineage.js
//
//  결과: docs/audit3d/lineage-cast.png    (배우 6명 — 리니지풍 / 현재)
//        docs/audit3d/lineage-scene.png   (같은 방 — 현재 / 리니지풍)
//
//  말로 설명하지 말고 그려서 보여준다 — tools/art-proto3d.js 와 같은 취지.
// ══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137/3d';
const OUT = path.join(__dirname, '..', 'docs', 'audit3d');

const SHOTS = [
  { view: 'cast', file: 'lineage-cast.png', w: 1700, h: 1020 },
  { view: 'scene', file: 'lineage-scene.png', w: 1700, h: 620 },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const errs = [];

  for (const s of SHOTS) {
    const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
    page.on('pageerror', (e) => errs.push(`${s.view}: ${String(e.message).slice(0, 200)}`));
    // 브라우저가 자동으로 찾는 favicon.ico 는 이 저장소에 없다 —
    // 이걸 걸러내지 않으면 진짜 오류가 이 소음에 묻힌다
    page.on('requestfailed', (r) => {
      if (!/favicon\.ico$/.test(r.url())) errs.push(`${s.view}: 요청 실패 ${r.url()}`);
    });
    page.on('response', (r) => {
      if (r.status() >= 400 && !/favicon\.ico$/.test(r.url()))
        errs.push(`${s.view}: HTTP ${r.status()} ${r.url()}`);
    });
    page.on('console', (m) => {
      const t = m.text();
      if (m.type() === 'error' && !/favicon|Failed to load resource/.test(t))
        errs.push(`${s.view}: console ${t.slice(0, 200)}`);
    });
    await page.goto(`${BASE}/lineage.html?view=${s.view}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.PROTO_READY === true, { timeout: 30000 });
    await page.waitForTimeout(2500);      // 소프트웨어 렌더링이라 첫 프레임이 느리다
    await page.screenshot({ path: path.join(OUT, s.file) });
    await page.close();
    console.log(`  docs/audit3d/${s.file}`);
  }

  await browser.close();
  if (errs.length) {
    console.log('페이지 오류:');
    for (const e of [...new Set(errs)].slice(0, 6)) console.log('  ' + e);
    process.exit(1);
  }
})().catch((e) => { console.error(e); process.exit(1); });
