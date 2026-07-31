// ══════════════════════════════════════════════════════════════════════════
//  아트 방향 시제품 — 현재 / A / B 를 같은 장면·같은 카메라로 나란히 찍는다.
//
//    node tools/art-proto3d.js        (서버가 떠 있어야 한다)
//    ./tools/run-verify3d.sh 와 같은 방식으로 playwright-core 를 찾는다
//
//  결과: docs/audit3d/proto-compare.png  (비교본 한 장)
//        docs/audit3d/proto-{current,A,B}.png  (개별 확대본)
//
//  기존 2D 의 tools/art-proto.js 와 같은 취지 — 말로 설명하지 말고 그려서 보여준다.
// ══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137/3d';
const OUT = path.join(__dirname, '..', 'docs', 'audit3d');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });

  const errs = [];
  // ── 비교본: 세 패널을 한 화면에 ──────────────────────────────
  const wide = await browser.newPage({ viewport: { width: 1680, height: 620 } });
  wide.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));
  await wide.goto(`${BASE}/proto.html`, { waitUntil: 'load' });
  await wide.waitForFunction(() => window.PROTO_READY === true, { timeout: 30000 });
  await wide.waitForTimeout(2500);          // 소프트웨어 렌더링이라 첫 프레임이 느리다
  await wide.screenshot({ path: path.join(OUT, 'proto-compare.png') });
  const panels = await wide.evaluate(() => window.PROTO.STYLES.map((s) => s.key));
  await wide.close();

  // ── 개별 확대본: 한 패널만 전체 화면으로 ─────────────────────
  for (const key of panels) {
    const p = await browser.newPage({ viewport: { width: 900, height: 620 } });
    p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));
    await p.goto(`${BASE}/proto.html`, { waitUntil: 'load' });
    await p.waitForFunction(() => window.PROTO_READY === true, { timeout: 30000 });
    // 해당 패널만 남긴다
    await p.evaluate((k) => {
      const keep = window.PROTO.panels.findIndex((x) => x.key === k);
      window.PROTO.panels.splice(0, window.PROTO.panels.length,
        window.PROTO.panels[keep] || window.PROTO.panels[0]);
      document.getElementById('labels').style.display = 'none';
      dispatchEvent(new Event('resize'));
    }, key);
    await p.waitForTimeout(2000);
    await p.screenshot({ path: path.join(OUT, `proto-${key}.png`) });
    await p.close();
  }

  await browser.close();

  if (errs.length) {
    console.log('페이지 오류:');
    for (const e of [...new Set(errs)].slice(0, 5)) console.log('  ' + e);
    process.exit(1);
  }
  console.log('생성됨:');
  console.log('  docs/audit3d/proto-compare.png   (비교본)');
  for (const k of panels) console.log(`  docs/audit3d/proto-${k}.png`);
})().catch((e) => { console.error(e); process.exit(1); });
