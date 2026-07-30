// 아트 전수 감사 (v200) — 사장: "플레이어, 몬스터, 맵 등을 어떻게 고퀄러티로 개편할지"
//   node tools/art-audit.js
//   → docs/audit/art-player.png · art-enemy.png · art-map.png + 표준출력 집계
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
  await page.waitForFunction(() => typeof Sprites !== 'undefined' && Sprites.playerFrames);

  const res = await page.evaluate(() => {
    const stat = (img) => {
      const t = document.createElement('canvas'); t.width = img.width; t.height = img.height;
      const g = t.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, t.width, t.height).data;
      const cols = new Set(); let filled = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 40) continue; filled++;
        cols.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`);
      }
      return { w: img.width, h: img.height, colors: cols.size,
        fill: Math.round(filled / (t.width * t.height) * 100) };
    };
    const sheet = (items, Z, cols, cw, ch, title) => {
      const cv = document.createElement('canvas');
      cv.width = cols * cw; cv.height = Math.ceil(items.length / cols) * ch + 34;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
      g.fillStyle = '#15121c'; g.fillRect(0, 0, cv.width, cv.height);
      g.fillStyle = '#ffd866'; g.font = 'bold 15px sans-serif'; g.textAlign = 'left';
      g.fillText(title, 12, 22);
      items.forEach((it, i) => {
        const x = (i % cols) * cw, y = Math.floor(i / cols) * ch + 34;
        if (it.img) g.drawImage(it.img, x + 10, y + 8, it.img.width * Z, it.img.height * Z);
        g.fillStyle = '#e8e0cf'; g.font = '12px sans-serif';
        g.fillText(it.label, x + 10, y + ch - 18);
        g.fillStyle = '#8a8296'; g.font = '10px sans-serif';
        g.fillText(it.sub || '', x + 10, y + ch - 5);
      });
      return cv.toDataURL('image/png');
    };

    // ① 플레이어 — 직업 4종 × 프레임 5종
    const FR = ['정지', '걷기1', '걷기2', '공격', '피격'];
    const pItems = [], pStats = [];
    for (const [k, arr] of Object.entries(Sprites.playerFrames)) {
      arr.forEach((img, i) => {
        pItems.push({ img, label: `${k} · ${FR[i]}`, sub: `${img.width}×${img.height}px` });
        if (i === 0) pStats.push({ name: k, ...stat(img), frames: arr.length });
      });
    }
    // ② 몬스터 — 1~5층 로스터 대표
    const E = ['skeleton', 'shieldSkeleton', 'archer', 'ghoul', 'boneHeap', 'slime', 'frog',
      'sporePuff', 'sporeling', 'mushroom', 'jailer', 'golem', 'shade', 'wisp', 'wraith',
      'cinder', 'imp', 'fireSpirit', 'spider', 'bat', 'necro', 'shaman', 'brute', 'stalker'];
    const eItems = [], eStats = [];
    for (const n of E) {
      const img = Sprites[n]; if (!img) continue;
      const s = stat(img);
      eItems.push({ img, label: n, sub: `${s.w}×${s.h}px · ${s.colors}색 · 채움 ${s.fill}%` });
      eStats.push({ name: n, ...s });
    }
    return {
      player: sheet(pItems, 5, 5, 200, 190, '플레이어 — 직업 4종 × 프레임 5종 (5배 확대)'),
      enemy: sheet(eItems, 6, 6, 200, 190, '몬스터 — 1~5층 대표 24종 (6배 확대)'),
      pStats, eStats,
      frameN: Object.values(Sprites.playerFrames)[0].length,
    };
  });

  fs.writeFileSync(path.join(OUT, 'art-player.png'), Buffer.from(res.player.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, 'art-enemy.png'), Buffer.from(res.enemy.split(',')[1], 'base64'));

  // ③ 맵 — 전투방을 HUD 없이 찍고 좌상단 6×4타일을 4배 확대
  await page.goto(`${BASE}/?test=1&bot=1`);
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'play');
  await page.evaluate(() => {
    localStorage.clear(); Meta.load(); Meta.data.introSeen = true; Meta.save();
  });
  await page.reload();
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'play');
  const mapPng = await page.evaluate(() => {
    Dungeon.floor = 1; Dungeon.roomIndex = 1; Dungeon.build('combat');
    Game.enemies.length = 0;                       // 지형만 본다
    Game.render && Game.render();
    const src = Renderer.canvas || document.querySelector('canvas');
    const cv = document.createElement('canvas'); cv.width = 1340; cv.height = 700;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#15121c'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#ffd866'; g.font = 'bold 15px sans-serif';
    g.fillText('맵 — 1층 전투방 원본(위) / 좌상단 6×4타일 4배 확대(아래)', 12, 22);
    g.drawImage(src, 0, 0, 960, 540, 190, 34, 960, 540);
    g.drawImage(src, 96, 96, 288, 192, 190, 600, 288 * 4 / 2.4, 192 * 4 / 2.4);
    return cv.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(OUT, 'art-map.png'), Buffer.from(mapPng.split(',')[1], 'base64'));

  console.log('\n════ 아트 감사 ════');
  console.log(`\n[플레이어] 직업 ${res.pStats.length}종 · 프레임 ${res.frameN}장/직업`);
  for (const s of res.pStats) console.log(`  ${s.name.padEnd(12)} ${s.w}×${s.h}px · ${s.colors}색 · 채움 ${s.fill}%`);
  console.log(`\n[몬스터] ${res.eStats.length}종`);
  const sz = {}, cl = [];
  for (const s of res.eStats) { sz[`${s.w}×${s.h}`] = (sz[`${s.w}×${s.h}`] || 0) + 1; cl.push(s.colors); }
  console.log('  크기 분포: ' + Object.entries(sz).map(([k, v]) => `${k}×${v}종`).join(' · '));
  console.log(`  색수 최소 ${Math.min(...cl)} / 평균 ${(cl.reduce((a, b) => a + b, 0) / cl.length).toFixed(1)} / 최대 ${Math.max(...cl)}`);
  for (const s of res.eStats) console.log(`  ${s.name.padEnd(16)} ${s.w}×${s.h}px · ${s.colors}색 · 채움 ${s.fill}%`);
  console.log(`\n시트: ${OUT}/art-{player,enemy,map}.png`);
  await browser.close();
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
