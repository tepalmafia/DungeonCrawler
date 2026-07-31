// 스프라이트 시제품 A/B (v200) — 사장: "보스가 뭘 들고 있는지도 구분이 안되잔아"
//
// 진단: 보스 원본은 30~34px인데 화면엔 86~120px로 뿌린다. 배율 2.7~4.0배.
//   한 픽셀이 화면에서 3px짜리 블록이 되므로 무기처럼 작은 것은 뭉갠다.
//   오스문드의 '낫'은 원본에서 날 4×5px — 화면에서 11px. 게다가 굽어 있지 않고
//   막대 끝에 붙은 사각형이라 낫으로 안 읽힌다. 손도 없어서 몸에서 떠 있다.
//
// 시제품: 원본 48×48 · 화면 배율 1.8배(같은 화면 크기, 디테일 2.25배).
//   낫 날을 실제 초승달 호(弧)로 그리고, 자루를 쥔 손을 넣는다.
//   node tools/sprite-proto.js → docs/audit/proto-osmund.png
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const OUT = path.join(__dirname, '..', 'docs', 'audit');

const BUILD = `(() => {
  const W = 48, H = 48;
  const grid = Array.from({length: H}, () => Array(W).fill('.'));
  const put = (x, y, ch) => { x = Math.round(x); y = Math.round(y);
    if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = ch; };
  const span = (y, x0, x1, ch) => { for (let x = x0; x <= x1; x++) put(x, y, ch); };
  const ell = (cx, cy, rx, ry, ch) => {
    for (let y = Math.ceil(cy - ry); y <= cy + ry; y++)
      for (let x = Math.ceil(cx - rx); x <= cx + rx; x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) put(x, y, ch);
  };

  // ── 자루 ── 세로. 아래로 길게 내려 실루엣의 세로축을 만든다
  for (let y = 15; y <= 45; y++) { put(37, y, 'S'); put(38, y, 's'); put(39, y, 'S'); }
  // ── 낫 날 ── 초승달 호. **회전 중심을 자루 왼쪽에 두어 호의 오른쪽 끝이 자루 상단에 닿게 한다**
  //   (첫 시제품은 중심을 자루에 두는 바람에 날이 자루에서 떨어져 공중에 떴다 — 직접 보고 잡음)
  const CX = 24, CY = 16;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x - CX, dy = y - CY, d = Math.hypot(dx, dy);
    if (dx < -1 || dy > 1) continue;               // 우·상 사분면만
    if (d >= 10.5 && d <= 15) put(x, y, d >= 13.5 ? 'k' : d <= 11.8 ? 'K' : 'M');
  }
  // 날 끝 — 위로 뾰족하게. 호를 그대로 두면 뭉툭해 낫으로 안 읽힌다
  span(4, 24, 27, 'K'); span(3, 25, 27, 'K'); span(2, 26, 28, 'M'); span(1, 27, 28, 'k');
  span(15, 34, 40, 'M'); span(16, 35, 40, 'k');   // 날밑 — 자루와 확실히 맞물린다

  // ── 챙 넓은 모자 ── 실루엣의 정체성. 가로로 넓어 다른 보스와 구분된다
  const BX = 14;                                    // 몸 중심 (날에 자리를 내주려 왼쪽으로)
  ell(BX, 15, 14, 3.2, 'h');
  span(15, 1, 27, 'h'); span(16, 3, 25, 'H');
  ell(BX, 10, 7.5, 6, 'h');                         // 크라운
  ell(BX, 9, 6, 4.5, 'H');
  span(13, 7, 21, 'h');
  // ── 얼굴 ── 챙 그늘 아래에 **밝은 띠**를 두어 눈이 읽히게 한다
  ell(BX, 21, 6.5, 5, 'f');
  span(17, 8, 20, 'g'); span(18, 8, 20, 'g'); span(19, 9, 19, 'g'); // 챙 그늘 (눈 위 3줄)
  for (let y = 20; y <= 22; y++) { span(y, 9, 11, 'e'); span(y, 16, 18, 'e'); } // 눈 3×3
  put(10, 20, 'W'); put(17, 20, 'W');               // 눈 반사광 — 살아있는 눈
  span(23, 12, 16, 'F'); span(24, 11, 17, 'F');     // 코·턱 그늘

  // ── 코트 ── 어깨가 넓고 아래로 퍼진다. **무릎 위에서 끝내 다리를 드러낸다**
  for (let y = 26; y <= 40; y++) {
    const w = y < 30 ? 12 : y < 37 ? 11 + (y - 30) * 0.6 : 15;
    span(y, Math.round(BX - w), Math.round(BX + w), 'c');
  }
  ell(BX, 29, 12, 3.5, 'C');                        // 어깨 하이라이트
  for (let y = 32; y <= 40; y++) { put(BX - 1, y, 'C'); put(BX, y, 'C'); }  // 앞섶
  span(34, 3, 25, 'b'); span(35, 3, 25, 'b');       // 허리띠
  span(34, 12, 16, 'o'); span(35, 12, 16, 'O');     // 버클
  // ── 오른팔 ── 자루를 향해 뻗어 **손이 자루를 쥔다** (현재 스프라이트엔 손이 아예 없다)
  for (let y = 29; y <= 32; y++) span(y, 24, 34, 'c');
  span(30, 33, 40, 'f'); span(31, 33, 40, 'f'); span(32, 34, 40, 'F');
  put(38, 30, 'S'); put(38, 31, 'S');               // 손가락 사이로 자루가 비친다
  // ── 왼팔 + 등불 ──
  for (let y = 29; y <= 34; y++) span(y, 1, 5, 'c');
  span(34, 1, 4, 'f'); span(35, 1, 4, 'F');
  put(3, 36, 'O'); put(3, 37, 'O');
  ell(3, 41, 3.5, 4, 'O'); ell(3, 41, 2, 2.6, 'o'); ell(3, 40.5, 1, 1.2, 'W');
  // ── 다리·부츠 ──
  for (let y = 41; y <= 44; y++) { span(y, 6, 12, 'd'); span(y, 16, 22, 'd'); }
  for (let y = 45; y <= 47; y++) { span(y, 4, 12, 'd'); span(y, 16, 24, 'd'); }

  return grid.map((r) => r.join(''));
})()`;

const PAL = {
  h: '#332c22', H: '#4a4030', g: '#6b5a44', f: '#c8a078', F: '#94684a', e: '#14121c',
  c: '#282334', C: '#3e3850', b: '#5a3f28', d: '#1c1828',
  S: '#8a6b48', s: '#6b4a34', o: '#ffd866', O: '#a8742e', W: '#fff6d8',
  K: '#eef2ff', M: '#b8c0d4', k: '#6e768c',
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  await page.goto(`${BASE}/?test=1`);
  await page.waitForFunction(() => typeof Sprites !== 'undefined' && Sprites.boss);

  const png = await page.evaluate(({ build, pal }) => {
    const rows = eval(build);
    const bad = rows.filter((r) => r.length !== rows[0].length);
    if (bad.length) throw new Error('행 길이 불일치 ' + bad.length);
    // sprites.js 의 make() 와 같은 규칙: 픽셀 + 8방향 1px 아웃라인
    const mk = (rs, p) => {
      const h = rs.length, w = rs[0].length;
      const base = document.createElement('canvas'); base.width = w; base.height = h;
      const bg = base.getContext('2d');
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const ch = rs[y][x]; if (ch === '.') continue;
        bg.fillStyle = p[ch] || '#f0f'; bg.fillRect(x, y, 1, 1);
      }
      const out = document.createElement('canvas'); out.width = w + 2; out.height = h + 2;
      const og = out.getContext('2d'); og.imageSmoothingEnabled = false;
      const sil = document.createElement('canvas'); sil.width = w; sil.height = h;
      const sg = sil.getContext('2d'); sg.drawImage(base, 0, 0);
      sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#0d0b14';
      sg.fillRect(0, 0, w, h);
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]])
        og.drawImage(sil, 1 + dx, 1 + dy);
      og.drawImage(base, 1, 1);
      return out;
    };
    const neu = mk(rows, pal);
    const old = Sprites.boss;

    const cv = document.createElement('canvas');
    cv.width = 1060; cv.height = 620;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#15121c'; g.fillRect(0, 0, cv.width, cv.height);

    const label = (t, x, y, c, s) => { g.fillStyle = c; g.font = s + 'px sans-serif';
      g.textAlign = 'center'; g.fillText(t, x, y); };

    // ① 게임 안 실제 크기 비교 (둘 다 화면 86px 높이로 맞춘다)
    const TARGET = 86;
    g.drawImage(old, 200 - (old.width * (TARGET / old.height)) / 2, 60,
      old.width * (TARGET / old.height), TARGET);
    g.drawImage(neu, 560 - (neu.width * (TARGET / neu.height)) / 2, 60,
      neu.width * (TARGET / neu.height), TARGET);
    label('A · 현재 (원본 32×29 → 화면 86px)', 200, 175, '#e8e0cf', 15);
    label('B · 시제품 (원본 48×48 → 화면 86px)', 560, 175, '#ffd866', 15);
    label('게임 안에서 보이는 실제 크기 — 여기서 구분돼야 한다', 380, 40, '#9a92a8', 14);

    // ② 6배 확대 비교
    const Z = 6;
    g.drawImage(old, 120, 220, old.width * Z, old.height * Z);
    g.drawImage(neu, 520, 220, neu.width * Z, neu.height * Z);
    label('A 확대', 120 + old.width * Z / 2, 220 + old.height * Z + 26, '#e8e0cf', 15);
    label('B 확대', 520 + neu.width * Z / 2, 220 + neu.height * Z + 26, '#ffd866', 15);

    // 무기 픽셀 수 계산
    const count = (c, chars) => {
      const t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
      const tg = t.getContext('2d'); tg.drawImage(c, 0, 0);
      const d = tg.getImageData(0, 0, t.width, t.height).data;
      let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) n++;
      return n;
    };
    const bladeNew = rows.join('').split('').filter((c) => 'KMk'.includes(c)).length;
    g.textAlign = 'left'; g.fillStyle = '#9a92a8'; g.font = '13px sans-serif';
    g.fillText('낫 날 픽셀 수   A: 20px 남짓(4×5 사각형, 굽지 않음)   B: ' + bladeNew + 'px (초승달 호)',
      60, cv.height - 40);
    g.fillText('손: A 없음(무기가 몸에서 떠 있다)   B 자루를 쥔 손 있음', 60, cv.height - 20);
    return cv.toDataURL('image/png');
  }, { build: BUILD, pal: PAL });

  fs.writeFileSync(path.join(OUT, 'proto-osmund.png'),
    Buffer.from(png.split(',')[1], 'base64'));
  console.log('시제품: ' + path.join(OUT, 'proto-osmund.png'));
  await browser.close();
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
