// 옛 크기 읽기 (v207) — 사장: "플레이어 적들 크기를 전의 비율로 크기를 만들어줘"
//
// 추측하지 않는다. v199(크기 개편 **이전**)를 실제로 띄워서 화면 높이를 잰다.
// 그 값이 곧 「전의 비율」이다.
//   node tools/old-size.js [URL]
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.argv[2] || 'http://127.0.0.1:8155/';
const KEYS = ['skeleton', 'shieldSkeleton', 'sniper', 'ghoul', 'golem', 'brute', 'warden', 'glutton',
  'slime', 'bat', 'wisp', 'spider', 'archer', 'necro', 'boss', 'bossGolem', 'bossKing'];

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.goto(URL);
  await p.waitForFunction(() => typeof Game !== 'undefined' && typeof Sprites !== 'undefined' && Game.state);
  const R = await p.evaluate((keys0) => {
    const keys = Object.keys(Sprites).filter((k) => Sprites[k] && Sprites[k].width && Sprites[k].width < 96);
    const bodyH = (img) => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let top = -1, bot = -1;
      for (let y = 0; y < c.height; y++) {
        let on = false;
        for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { on = true; break; }
        if (on) { if (top < 0) top = y; bot = y; }
      }
      return top < 0 ? img.height : bot - top + 1;
    };
    const SC = 2;   // v199 의 기본 배율
    const out = [];
    for (const k of keys) {
      const img = Sprites[k];
      if (!img || !img.width) continue;
      out.push({ k, src: img.width + '×' + img.height, bh: bodyH(img), screenH: Math.round(bodyH(img) * SC) });
    }
    for (const pk of ['player', 'playerArcher', 'playerMage', 'playerAlch']) {
      const pi = Sprites.playerFrames && Sprites.playerFrames[pk] ? Sprites.playerFrames[pk][0] : Sprites[pk];
      if (pi && pi.width) out.push({ k: pk, src: pi.width + '×' + pi.height, bh: bodyH(pi), screenH: Math.round(bodyH(pi) * SC) });
    }
    return out;
  }, KEYS);
  await b.close();
  console.log('\n════ v199 (크기 개편 이전) 실제 화면 높이 ════');
  console.log('키                  원본      몸높이  화면높이');
  for (const x of R) console.log('  ' + x.k.padEnd(18) + x.src.padEnd(10) + String(x.bh).padStart(5) + String(x.screenH).padStart(9));
  const mobs = R.filter((x) => !/^boss|플레이어/.test(x.k));
  const hs = mobs.map((x) => x.screenH).sort((a, c) => a - c);
  // 붙여넣을 수 있는 표로 굽는다 — 추측 없이 v199 그대로 복원한다
  const tbl = {};
  for (const x of R) tbl[x.k] = x.screenH;
  console.log('\n──── 복원용 표 (sprites.js 에 붙여넣는다) ────');
  console.log('const V199_H = ' + JSON.stringify(tbl) + ';');
  console.log('\n잡몹 화면높이 범위: ' + hs[0] + ' ~ ' + hs[hs.length - 1] + 'px · 중앙값 ' + hs[Math.floor(hs.length / 2)] + 'px');
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
