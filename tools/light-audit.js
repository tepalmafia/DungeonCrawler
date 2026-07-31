// 광원 감사 (v200) — 스프라이트마다 빛이 어디서 오는가?
//
// 맵에 세운 규칙 ②「빛은 항상 좌상단」이 스프라이트에도 지켜지는지 잰다.
// 방법: 각 스프라이트의 **밝은 상위 25% 픽셀의 무게중심**이 전체 무게중심 대비
//       어느 쪽에 쏠려 있는지 본다. 좌상단 광원이면 (-,-) 방향으로 쏠려야 한다.
// 이건 취향 문제가 아니라 계측 가능한 규칙이다 — 제각각이면 아무리 다시 그려도 따로 논다.
//   node tools/light-audit.js
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.goto(`${BASE}/?test=1&bot=1`);
  await p.waitForFunction(() => typeof Sprites !== 'undefined' && typeof Game !== 'undefined' && Game.state);
  const R = await p.evaluate(() => {
    const out = [], palettes = new Set(), colors = new Map();
    for (const key of Object.keys(Sprites)) {
      const img = Sprites[key];
      if (!img || !img.width || img.width > 96) continue;         // 함수·거대 이미지 제외
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const px = [];
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (d[i + 3] < 128) continue;
        const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (l < 24) continue;                                       // 아웃라인 제외
        px.push([x, y, l]);
        const hex = ((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).padStart(6, '0');
        colors.set(hex, (colors.get(hex) || 0) + 1);
      }
      if (px.length < 24) continue;
      const cx = px.reduce((a, q) => a + q[0], 0) / px.length;
      const cy = px.reduce((a, q) => a + q[1], 0) / px.length;
      const sorted = px.slice().sort((a, q) => q[2] - a[2]);
      const top = sorted.slice(0, Math.max(4, Math.round(px.length * 0.25)));
      const lx = top.reduce((a, q) => a + q[0], 0) / top.length;
      const ly = top.reduce((a, q) => a + q[1], 0) / top.length;
      // 스프라이트 크기로 정규화 — 큰 그림과 작은 그림을 같은 자로 잰다
      out.push({ key, dx: +((lx - cx) / c.width).toFixed(3), dy: +((ly - cy) / c.height).toFixed(3), n: px.length });
      palettes.add(key);
    }
    return { out, colorN: colors.size, top: [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12) };
  });
  await b.close();

  const S = R.out;
  const ul = S.filter((s) => s.dx <= -0.02 && s.dy <= -0.02).length;   // 좌상단
  const ur = S.filter((s) => s.dx > 0.02 && s.dy <= -0.02).length;
  const ll = S.filter((s) => s.dx <= -0.02 && s.dy > 0.02).length;
  const lr = S.filter((s) => s.dx > 0.02 && s.dy > 0.02).length;
  const mid = S.length - ul - ur - ll - lr;
  console.log('\n════ 광원 감사 — 스프라이트 ' + S.length + '종 ════');
  console.log('  빛이 오는 방향 분포');
  console.log('    ◤ 좌상단 (규칙)   ' + ul + '  (' + ((ul / S.length) * 100).toFixed(0) + '%)');
  console.log('    ◥ 우상단          ' + ur);
  console.log('    ◣ 좌하단          ' + ll);
  console.log('    ◢ 우하단          ' + lr);
  console.log('    ·  방향 없음/평평  ' + mid);
  console.log('\n  규칙을 크게 어기는 상위 12종 (우하단으로 쏠릴수록 규칙 위반)');
  S.slice().sort((a, b) => (b.dx + b.dy) - (a.dx + a.dy)).slice(0, 12)
    .forEach((s) => console.log('    ' + s.key.padEnd(18) + ' dx' + String(s.dx).padStart(7) + '  dy' + String(s.dy).padStart(7)));
  console.log('\n  전체 스프라이트가 쓰는 고유 색 수: ' + R.colorN + '   (32색 팔레트 규칙 대비)');
  console.log('  가장 많이 쓰인 색: ' + R.top.map(([h, n]) => '#' + h + '×' + n).join(' '));
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
