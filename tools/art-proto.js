// 아트 시제품 A/B (v200) — 사장: "플레이어, 몬스터, 맵 등을 어떻게 고퀄러티로 개편할지 샘플과 함께"
//   node tools/art-proto.js → docs/audit/proto-{map,enemy,player}.png
//
// 원칙: 외부 에셋 없음. 전부 코드로 그린다 (지금 게임과 동일한 방식).
//   A = 현재 게임에서 그대로 가져온 것,  B = 시제품.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const OUT = path.join(__dirname, '..', 'docs', 'audit');

// ─────────────────────────────────────────────────────────────
// 맵 시제품 — 24×24 소스 타일을 코드로 그린다 (게임은 화면 48px = 소스 24px × SCALE 2)
// 현재 문제: 바닥이 밝기만 다른 단색 사각형 → 타일 경계가 '격자'로 읽힌다.
//           벽이 없다(검은 여백) · 높이차 없음 · 너무 어두워 화면 60%가 안 보인다
// ─────────────────────────────────────────────────────────────
const MAP_PROTO = `(() => {
  const S = 24;                                   // 소스 타일 해상도
  const rnd = (seed) => { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); };

  // 돌바닥 — 어긋난 석판 + 줄눈 + 균열 + 이끼. 타일마다 시드가 달라 격자가 안 읽힌다
  const floorTile = (seed, theme) => {
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const g = c.getContext('2d'); const R = rnd(seed);
    const P = theme;
    g.fillStyle = P.grout; g.fillRect(0, 0, S, S);
    // 석판 3줄 · 줄마다 가로 오프셋을 줘 벽돌처럼 어긋나게
    const rows = [[0, 12], [12, 12]];   // 바닥은 큰 석판. 벽의 작은 벽돌과 크기로 대비된다
    for (const [y0, hh] of rows) {
      let x = -Math.floor(R() * 14);
      while (x < S) {
        const w = 13 + Math.floor(R() * 8);
        const lit = R();
        g.fillStyle = lit > 0.72 ? P.hi : lit > 0.34 ? P.mid : P.lo;
        g.fillRect(x + 1, y0 + 1, w - 1, hh - 1);
        // 석판 윗면 하이라이트 1px — 두께감
        g.fillStyle = P.edge; g.fillRect(x + 1, y0 + 1, w - 1, 1);
        x += w;
      }
    }
    // 균열 — 3타일에 1번쯤
    if (R() > 0.45) {
      g.fillStyle = P.crack; let cx = Math.floor(R() * S), cy = 2;
      for (let i = 0; i < 12 + R() * 8; i++) { g.fillRect(cx, cy, 1, 1); cy++; cx += R() > 0.5 ? 1 : R() > 0.3 ? 0 : -1; }
    }
    // 이끼/잔해 — 층 테마색 얼룩
    if (R() > 0.4) {
      g.fillStyle = P.moss;
      const mx = Math.floor(R() * (S - 6)), my = Math.floor(R() * (S - 6));
      for (let i = 0; i < 7; i++) g.fillRect(mx + Math.floor(R() * 6), my + Math.floor(R() * 6), 1 + Math.floor(R() * 2), 1);
    }
    return c;
  };

  // 벽 — 앞면(벽돌) + 윗면(밝음) + 발밑 그림자. **높이가 생긴다**
  const wallTile = (seed, theme) => {
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const g = c.getContext('2d'); const R = rnd(seed); const P = theme;
    g.fillStyle = P.wallDark; g.fillRect(0, 0, S, S);
    // 윗면 — 위 6px. 빛을 받는다
    g.fillStyle = P.wallTop; g.fillRect(0, 0, S, 8);
    g.fillStyle = P.wallTopHi; g.fillRect(0, 0, S, 3);
    for (let x = 0; x < S; x += 6) { g.fillStyle = P.wallTopLo; g.fillRect(x, 0, 1, 8); }
    // 앞면 벽돌 — 어긋난 2줄
    for (const [y0, hh] of [[9, 5], [14, 5], [19, 5]]) {
      let x = y0 === 14 ? -4 : 0;
      while (x < S) {
        const w = 7 + Math.floor(R() * 3);
        g.fillStyle = R() > 0.6 ? P.wallHi : P.wallMid;
        g.fillRect(x + 1, y0 + 1, w - 2, hh - 2);
        x += w;
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(0, 8, S, 2);  // 윗면과 앞면 경계 — 두껍게
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, S - 2, S, 2); // 발밑 그림자
    return c;
  };

  const THEME = {
    grout: '#100d16', lo: '#221d2c', mid: '#2a2436', hi: '#332c40', edge: '#3e3650',
    crack: '#0b0910', moss: '#3d4a2e',
    wallDark: '#0c0a12', wallMid: '#1e1a28', wallHi: '#282234',
    wallTop: '#4e4458', wallTopHi: '#685c78', wallTopLo: '#38304a',
  };

  // 8×6 타일 방 조각을 그린다 (위 2줄은 벽)
  const COLS = 8, ROWS = 6, Z = 2;                 // Z=2 → 화면 48px 타일
  const cv = document.createElement('canvas');
  cv.width = COLS * S * Z; cv.height = ROWS * S * Z;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
    const seed = tx * 31 + ty * 17 + 7;
    const img = ty < 2 ? wallTile(seed, THEME) : floorTile(seed, THEME);
    g.drawImage(img, tx * S * Z, ty * S * Z, S * Z, S * Z);
  }
  // 벽이 바닥에 드리우는 그림자 — 방이 '안'으로 읽히게 한다
  const grd = g.createLinearGradient(0, 2 * S * Z, 0, 2 * S * Z + 46);
  grd.addColorStop(0, 'rgba(0,0,0,0.8)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 2 * S * Z, cv.width, 64);
  // 횃불 조명 — 따뜻한 원뿔. 현재는 화면 60%가 검정이라 지형이 안 보인다
  for (const [lx, ly] of [[2.5, 1.75], [6.2, 1.75]]) {
    const px = lx * S * Z, py = ly * S * Z;
    const rg = g.createRadialGradient(px, py, 6, px, py, 190);
    rg.addColorStop(0, 'rgba(255,196,110,0.30)');
    rg.addColorStop(0.45, 'rgba(255,150,70,0.12)');
    rg.addColorStop(1, 'rgba(255,140,60,0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = rg;
    g.fillRect(px - 200, py - 200, 400, 400);
    g.globalCompositeOperation = 'source-over';
    // 횃불 자체
    g.fillStyle = '#2a2030'; g.fillRect(px - 4, py - 6, 8, 16);
    g.fillStyle = '#ff9a3c'; g.fillRect(px - 5, py - 14, 10, 9);
    g.fillStyle = '#ffd866'; g.fillRect(px - 3, py - 12, 6, 6);
    g.fillStyle = '#fff4c8'; g.fillRect(px - 1, py - 10, 2, 3);
  }
  return cv.toDataURL('image/png');
})()`;

// ─────────────────────────────────────────────────────────────
// 몬스터 시제품 — 해골 22×21 → 32×34. 갈비뼈·눈확·실제 검
// ─────────────────────────────────────────────────────────────
const ENEMY_PROTO = `(() => {
  const W = 32, H = 34;
  const grid = Array.from({length: H}, () => Array(W).fill('.'));
  const put = (x, y, ch) => { x = Math.round(x); y = Math.round(y);
    if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = ch; };
  const span = (y, a, b, ch) => { for (let x = a; x <= b; x++) put(x, y, ch); };
  const ell = (cx, cy, rx, ry, ch) => { for (let y = Math.ceil(cy-ry); y <= cy+ry; y++)
    for (let x = Math.ceil(cx-rx); x <= cx+rx; x++)
      if (((x-cx)/rx)**2 + ((y-cy)/ry)**2 <= 1) put(x, y, ch); };
  const BX = 12;
  // 두개골 — 관자놀이가 좁고 턱이 각진 형태 (동그란 머리와 구분된다)
  ell(BX, 7, 6, 5.5, 'b'); span(2, BX-4, BX+4, 'B');       // 정수리 하이라이트
  span(3, BX-5, BX+5, 'B');
  for (let y = 6; y <= 8; y++) { span(y, BX-4, BX-2, 'e'); span(y, BX+2, BX+4, 'e'); }  // 눈확
  put(BX-3, 7, 'r'); put(BX+3, 7, 'r');                     // 붉은 안광
  span(10, BX-3, BX+3, 'b'); span(11, BX-3, BX+3, 'd');     // 턱
  for (let x = BX-3; x <= BX+3; x += 2) put(x, 11, 'B');    // 이빨
  put(BX, 12, 'b'); put(BX, 13, 'b');                       // 목뼈
  // 갈비뼈 — 해골의 정체성. 지금 스프라이트엔 없다
  ell(BX, 18, 6, 5.5, 'd');
  for (const y of [15, 17, 19, 21]) { span(y, BX-5, BX+5, 'b'); }
  for (let y = 14; y <= 22; y++) { put(BX, y, 'B'); }        // 흉골
  span(23, BX-4, BX+4, 'b');                                 // 골반
  span(24, BX-4, BX+4, 'd');
  // 팔 — 오른팔은 검을 들고 위로, 왼팔은 늘어뜨림
  for (let y = 15; y <= 19; y++) { put(BX-7, y, 'b'); put(BX-8, y+1, 'b'); }
  span(21, BX-9, BX-7, 'b');
  for (let y = 14; y <= 17; y++) { put(BX+7, y, 'b'); put(BX+8, y-1, 'b'); }
  span(12, BX+8, BX+10, 'b');
  // 검 — 날 + 코등이 + 손잡이. 지금은 2px 갈색 막대뿐이다
  for (let y = 1; y <= 11; y++) { put(BX+10, y, 'S'); put(BX+11, y, 'K'); put(BX+12, y, 's'); }
  put(BX+11, 0, 'K'); put(BX+10, 1, 'K');
  span(12, BX+8, BX+14, 'g'); span(13, BX+9, BX+13, 'G');    // 코등이
  for (let y = 14; y <= 17; y++) span(y, BX+10, BX+12, 'h'); // 손잡이
  span(18, BX+9, BX+13, 'g');                                 // 자루끝
  // 다리
  for (let y = 25; y <= 31; y++) { put(BX-3, y, 'b'); put(BX-4, y, 'd'); put(BX+3, y, 'b'); put(BX+4, y, 'd'); }
  span(32, BX-5, BX-2, 'b'); span(32, BX+2, BX+5, 'b');
  span(33, BX-5, BX-2, 'd'); span(33, BX+2, BX+5, 'd');
  return grid.map((r) => r.join(''));
})()`;
const ENEMY_PAL = { b: '#d8d0b8', B: '#f4eeda', d: '#9a917c', e: '#1a1622', r: '#e43b44',
  S: '#9aa2b8', K: '#e6ecff', s: '#6a7086', g: '#8a6b3c', G: '#c0994e', h: '#4a3620' };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(`${BASE}/?test=1&bot=1`);
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'play');

  // ── 맵 A/B ──
  const mapPng = await page.evaluate((proto) => {
    Dungeon.floor = 1; Dungeon.roomIndex = 1; Dungeon.build('combat');
    Game.enemies.length = 0; Game.render && Game.render();
    const src = Renderer.canvas || document.querySelector('canvas');
    const bImg = new Image(); const bURL = eval(proto);
    const cv = document.createElement('canvas'); cv.width = 800; cv.height = 1360;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#15121c'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#ffd866'; g.font = 'bold 15px sans-serif'; g.textAlign = 'left';
    g.fillText('맵 — 8×6 타일 조각 (게임 안 실제 배율 · 원본 비율)', 14, 24);
    g.fillStyle = '#e8e0cf'; g.font = '14px sans-serif';
    g.fillText('A · 현재 — 밝기만 다른 단색 사각형. 타일 경계가 격자로 읽힌다. 벽 없음. 화면 대부분이 검정', 14, 52);
    g.drawImage(src, 96, 96, 384, 288, 14, 66, 768, 576);
    return { base: cv.toDataURL('image/png'), b: bURL };
  }, MAP_PROTO);

  // A/B 합성은 별도 페이지 컨텍스트에서 (이미지 로딩 필요)
  const mapFinal = await page.evaluate(async ({ base, b }) => {
    const load = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; });
    const [A, B] = await Promise.all([load(base), load(b)]);
    const cv = document.createElement('canvas'); cv.width = 800; cv.height = 1360;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#15121c'; g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(A, 0, 0);
    g.fillStyle = '#ffd866'; g.font = '14px sans-serif'; g.textAlign = 'left';
    g.fillText('B · 시제품 — 큰 석판 바닥 + 잔 벽돌 벽 (패턴 크기로 구분) · 벽 윗면/앞면/그림자 · 횃불 조명', 14, 686);
    g.drawImage(B, 14, 700, 768, 576);
    g.fillStyle = '#8a8296'; g.font = '12px sans-serif';
    g.fillText('타일 소스 24×24px · 타일마다 시드가 달라 같은 그림이 반복되지 않는다 · 외부 에셋 0', 14, 1300);
    return cv.toDataURL('image/png');
  }, mapPng);
  fs.writeFileSync(path.join(OUT, 'proto-map.png'), Buffer.from(mapFinal.split(',')[1], 'base64'));

  // ── 몬스터 A/B ──
  const enemyPng = await page.evaluate(({ build, pal }) => {
    const rows = eval(build);
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
      sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#0d0b14'; sg.fillRect(0, 0, w, h);
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]) og.drawImage(sil, 1+dx, 1+dy);
      og.drawImage(base, 1, 1); return out;
    };
    const neu = mk(rows, pal), old = Sprites.skeleton;
    const cv = document.createElement('canvas'); cv.width = 880; cv.height = 470;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#15121c'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#ffd866'; g.font = 'bold 15px sans-serif'; g.textAlign = 'left';
    g.fillText('몬스터 — 「깨어난 백골」 (1층 주력)', 14, 24);
    const T = 66;   // 게임 안 화면 높이
    g.drawImage(old, 120, 46, old.width * (T/old.height), T);
    g.drawImage(neu, 320, 46, neu.width * (T/neu.height), T);
    g.textAlign = 'center'; g.fillStyle = '#e8e0cf'; g.font = '13px sans-serif';
    g.fillText('A · 현재 (22×21)', 135, 132); g.fillStyle = '#ffd866';
    g.fillText('B · 시제품 (32×34)', 340, 132);
    g.textAlign = 'left'; g.fillStyle = '#8a8296'; g.font = '12px sans-serif';
    g.fillText('↑ 게임 안 실제 크기', 480, 90);
    const Z = 8;
    g.drawImage(old, 60, 150, old.width * Z, old.height * Z);
    g.drawImage(neu, 400, 150, neu.width * Z, neu.height * Z);
    g.fillStyle = '#8a8296'; g.font = '12px sans-serif';
    g.fillText('A: 갈비뼈 없음 · 눈확 없음 · 무기 = 2px 갈색 막대 · 7색', 60, 452);
    g.fillText('B: 갈비뼈 4단 + 흉골 · 눈확 + 붉은 안광 · 날/코등이/손잡이 있는 검 · 11색', 400, 452);
    return cv.toDataURL('image/png');
  }, { build: ENEMY_PROTO, pal: ENEMY_PAL });
  fs.writeFileSync(path.join(OUT, 'proto-enemy.png'), Buffer.from(enemyPng.split(',')[1], 'base64'));

  console.log('시제품: proto-map.png · proto-enemy.png');
  await browser.close();
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
