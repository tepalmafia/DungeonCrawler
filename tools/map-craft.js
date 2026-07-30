// 맵 타일 — 기준선 세우기 (v200) — 사장: "이게 최선이야? 비용말고 퀄러티말이야."
//
// 앞선 시제품의 한계를 스스로 진단한 결과:
//   ① 도형(ellipse/rect)으로 찍어서 완벽한 수평선만 나왔다 → 벽지처럼 보인다
//   ② 광원 방향이 없다 → 어디서 빛이 오는지 모르니 입체가 안 선다
//   ③ 반복을 2번 했다 → 퀄러티는 반복 횟수다
//
// 이 도구는 **한 장을 끝까지 민다.** 규칙:
//   · 빛은 항상 좌상단에서 온다. 모든 면의 명암이 이 규칙 하나를 따른다
//   · 32색 고정 팔레트만 쓴다 (색이 통일돼야 한 게임으로 보인다)
//   · 값 노이즈로 불규칙성을 만든다 (완벽한 직선 금지)
//   node tools/map-craft.js [패스번호] → docs/audit/craft-map.png
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const OUT = path.join(__dirname, '..', 'docs', 'audit');

const CRAFT = `(() => {
  const S = 24, Z = 2;                    // 소스 24px → 화면 48px 타일

  // ── 32색 고정 팔레트 ── 묘지 테마. 명도 단계가 고르게 벌어져 있다
  const P = {
    // 돌 (한랭 회보라) 5단
    s0:'#0e0c14', s1:'#1a1622', s2:'#262034', s3:'#332c46', s4:'#443a5c', s5:'#584c72',
    // 흙 (온난 갈색) 4단
    e1:'#1c1520', e2:'#2c2128', e3:'#3d2f33', e4:'#52403f',
    // 이끼·초목 3단
    m1:'#243020', m2:'#36462a', m3:'#4c6038',
    // 뼈·표석 3단
    b1:'#4a4450', b2:'#6b6472', b3:'#8f8896',
    // 불빛 4단
    f1:'#8a3a14', f2:'#d4691e', f3:'#ffa63c', f4:'#ffe6a8',
  };

  // 값 노이즈 — 완벽한 직선을 없애는 유일한 수단
  const hash = (x, y, s) => { let h = x * 374761393 + y * 668265263 + s * 2147483647;
    h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; };

  // ── 바닥 ── 묘지의 다진 흙 + 박힌 돌판. 빛은 좌상단
  const floorTile = (seed) => {
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const g = c.getContext('2d');
    const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
    // 흙 바탕 — 픽셀 단위 노이즈로 깔아 균일한 면을 없앤다
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = hash(x, y, seed);
      px(x, y, n > 0.86 ? P.e4 : n > 0.58 ? P.e3 : n > 0.22 ? P.e2 : P.e1);
    }
    // 박힌 돌판 1~2장 — 위치·크기가 타일마다 다르고 모서리가 깨져 있다
    const nSlab = hash(0, 0, seed) > 0.62 ? 2 : hash(0, 0, seed) > 0.22 ? 1 : 0;
    for (let k = 0; k < nSlab; k++) {
      const sx = Math.floor(hash(k, 1, seed) * (S - 12)), sy = Math.floor(hash(k, 2, seed) * (S - 10));
      const sw = 8 + Math.floor(hash(k, 3, seed) * 8), sh = 6 + Math.floor(hash(k, 4, seed) * 6);
      for (let y = sy; y < sy + sh && y < S; y++) for (let x = sx; x < sx + sw && x < S; x++) {
        // 모서리를 확률적으로 깎는다 — 직사각형이 안 보이게
        const ex = Math.min(x - sx, sx + sw - 1 - x), ey = Math.min(y - sy, sy + sh - 1 - y);
        if (ex + ey === 0 && hash(x, y, seed + 9) > 0.35) continue;
        if (ex + ey <= 1 && hash(x, y, seed + 11) > 0.78) continue;
        const n = hash(x, y, seed + 5);
        // 좌상단이 밝다 — 광원 규칙
        const litEdge = (x === sx || y === sy);
        const darkEdge = (x === sx + sw - 1 || y === sy + sh - 1);
        px(x, y, litEdge ? P.s4 : darkEdge ? P.s1 : n > 0.72 ? P.s3 : n > 0.3 ? P.s2 : P.s1);
      }
    }
    // 흩어진 자갈 — 가로 줄무늬를 깨는 역할. 크기·밝기가 제각각
    for (let k = 0; k < 5; k++) {
      if (hash(k, 30, seed) < 0.45) continue;
      const gx = Math.floor(hash(k, 31, seed) * S), gy = Math.floor(hash(k, 32, seed) * S);
      const gs = hash(k, 33, seed) > 0.7 ? 2 : 1;
      for (let y = 0; y < gs; y++) for (let x = 0; x < gs; x++) px(gx + x, gy + y, hash(k,34,seed) > 0.5 ? P.s3 : P.e4);
      px(gx + gs, gy + gs, P.s0);                          // 자갈이 던지는 1px 그림자
    }
    // 균열 — 돌판을 가로지르는 실금. 갈라진 방향이 매번 다르다
    if (hash(3, 3, seed) > 0.5) {
      let cx = Math.floor(hash(4, 4, seed) * S), cy = Math.floor(hash(5, 5, seed) * 6);
      const dir = hash(6, 6, seed) > 0.5 ? 1 : -1;
      for (let i = 0; i < 10 + hash(7, 7, seed) * 12; i++) {
        px(cx, cy, P.s0); px(cx + 1, cy, P.s2);       // 금 + 갈라진 면의 반사광
        cy++; const t = hash(cx, cy, seed + 3);
        cx += t > 0.72 ? dir : t > 0.5 ? -dir : 0;
      }
    }
    // 이끼 — 돌 틈에서만 자란다 (아무 데나 찍으면 얼룩으로 보인다)
    if (hash(8, 8, seed) > 0.42) {
      const mx = Math.floor(hash(9, 9, seed) * (S - 8)), my = Math.floor(hash(10, 10, seed) * (S - 8));
      for (let y = 0; y < 7; y++) for (let x = 0; x < 8; x++) {
        const n = hash(mx + x, my + y, seed + 17);
        const fall = 1 - (x / 8) * 0.6 - (y / 7) * 0.5;
        if (n < fall * 0.55) px(mx + x, my + y, n < fall * 0.2 ? P.m3 : n < fall * 0.4 ? P.m2 : P.m1);
      }
    }
    // 잔뼈 — 묘지라는 서사. 3타일에 1번쯤 작은 뼈 조각
    if (hash(12, 12, seed) > 0.76) {
      const bx = 3 + Math.floor(hash(13, 13, seed) * (S - 9)), by = 3 + Math.floor(hash(14, 14, seed) * (S - 7));
      for (let i = 0; i < 5; i++) px(bx + i, by + (i === 0 || i === 4 ? 0 : 0), P.b2);
      px(bx, by - 1, P.b3); px(bx + 4, by - 1, P.b3);
      px(bx, by + 1, P.b1); px(bx + 4, by + 1, P.b1);
    }
    return c;
  };

  // ── 벽 ── 윗면(빛) / 앞면(그늘) / 발밑(어둠). 높이 3단
  const wallTile = (seed, isTop) => {
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const g = c.getContext('2d');
    const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
    if (isTop) {
      // 벽 윗면 — 빛을 정면으로 받는 면. 가장 밝다
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const n = hash(x, y, seed);
        px(x, y, y < 3 ? (n > 0.5 ? P.s5 : P.s4) : n > 0.78 ? P.s5 : n > 0.4 ? P.s4 : P.s3);
      }
      // 윗면 돌 이음매 — 세로 금 몇 개
      for (let k = 0; k < 3; k++) {
        const jx = Math.floor(hash(k, 20, seed) * S);
        for (let y = 0; y < S; y++) if (hash(jx, y, seed) > 0.25) px(jx, y, P.s2);
      }
      // 아래 끝 2px — 앞면으로 넘어가는 모서리 (어둡게 꺾인다)
      for (let x = 0; x < S; x++) { px(x, S - 2, P.s2); px(x, S - 1, P.s1); }
      return c;
    }
    // 벽 앞면 — 그늘. 벽돌이 어긋나게 쌓여 있다
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = hash(x, y, seed + 1);
      px(x, y, n > 0.8 ? P.s2 : n > 0.4 ? P.s1 : P.s0);
    }
    for (const [y0, hh, off] of [[0, 8, 0], [8, 8, 5], [16, 8, 2]]) {
      let x = -off;
      while (x < S) {
        const w = 8 + Math.floor(hash(x, y0, seed) * 5);
        for (let yy = y0 + 1; yy < y0 + hh - 1 && yy < S; yy++)
          for (let xx = x + 1; xx < x + w - 1 && xx < S; xx++) {
            if (xx < 0) continue;
            const n = hash(xx, yy, seed + 2);
            const lit = (yy === y0 + 1 || xx === x + 1);   // 좌상단 모서리가 밝다
            px(xx, yy, lit ? P.s3 : n > 0.7 ? P.s2 : P.s1);
          }
        x += w;
      }
    }
    return c;
  };

  // ── 묘비 ── 묘지의 상징물. 지금은 8px이라 뭔지 안 보인다 → 20×26
  //   kind 0 둥근 비석 · 1 십자가 · 2 깨진 판석 · 3 낮은 표석 — 묘지는 같은 무덤이 없다
  const tombstone = (seed, kind) => {
    const c = document.createElement('canvas'); c.width = 20; c.height = 26;
    const g = c.getContext('2d');
    const px = (x, y, col) => { if (x<0||x>19||y<0||y>25) return; g.fillStyle = col; g.fillRect(x, y, 1, 1); };
    const stone = (x, y, edgeL) => {                       // 광원 좌상단 규칙을 한 곳에서 강제
      const n = hash(x, y, seed);
      px(x, y, edgeL ? P.b3 : x > 13 ? P.b1 : n > 0.68 ? P.b2 : n > 0.28 ? P.b1 : P.s1);
    };
    const top = kind === 3 ? 12 : kind === 2 ? 6 : 2;      // 낮은 표석은 짧다
    const chip = Math.floor(hash(1, 1, seed) * 5);          // 파손 정도
    if (kind === 1) {                                       // 십자가
      for (let y = top; y < 24; y++) for (let x = 8; x < 13; x++) stone(x, y, x === 8);
      for (let y = top + 4; y < top + 9; y++) for (let x = 3; x < 18; x++) stone(x, y, y === top + 4);
    } else {
      const w0 = kind === 3 ? 4 : 3, w1 = kind === 3 ? 16 : 17;
      for (let y = top; y < 24; y++) for (let x = w0; x < w1; x++) {
        if (kind === 0 && y < top + 6 && Math.hypot((x - 10) / 7, (y - (top + 6)) / 6) > 1) continue;
        if (kind === 2 && y < top + 4 + chip && x > 11 + hash(y, 2, seed) * 4) continue;   // 윗부분이 깨져 나감
        stone(x, y, x === w0 || y === top);
      }
    }
    for (let x = 2; x < 18; x++) { px(x, 24, P.b1); px(x, 25, P.s0); }   // 흙에 박힌 밑동
    if (kind !== 1) for (let y = top + 8; y < 21; y += 3) for (let x = 6; x < 14; x++)
      if (hash(x, y, seed + 88) > 0.42) px(x, y, P.s1);                   // 새겨진 글씨 흔적
    for (let y = top + 2; y < 23; y++)                                     // 타고 오른 이끼
      if (hash(3, y, seed + 99) > 0.62) px(4 + Math.floor(hash(y, 1, seed) * 3), y, hash(y,5,seed) > 0.5 ? P.m2 : P.m1);
    return c;
  };

  // ── 횃불 ── 벽에 박힌 관솔. 광원의 근거
  const torch = () => {
    const c = document.createElement('canvas'); c.width = 12; c.height = 22;
    const g = c.getContext('2d');
    const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
    for (let y = 10; y < 22; y++) for (let x = 4; x < 8; x++) px(x, y, x === 4 ? P.e4 : P.e2);
    for (let y = 8; y < 12; y++) for (let x = 3; x < 9; x++) px(x, y, P.b1);   // 받침
    const flame = [[5,0,'f4'],[6,0,'f4'],[4,1,'f3'],[5,1,'f4'],[6,1,'f4'],[7,1,'f3'],
      [3,2,'f2'],[4,2,'f3'],[5,2,'f4'],[6,2,'f4'],[7,2,'f3'],[8,2,'f2'],
      [3,3,'f2'],[4,3,'f3'],[5,3,'f3'],[6,3,'f3'],[7,3,'f2'],[8,3,'f1'],
      [3,4,'f1'],[4,4,'f2'],[5,4,'f3'],[6,4,'f2'],[7,4,'f1'],
      [4,5,'f1'],[5,5,'f2'],[6,5,'f2'],[7,5,'f1'],[5,6,'f1'],[6,6,'f1']];
    for (const [x, y, k] of flame) px(x, y + 1, P[k]);
    return c;
  };

  // ── 방 조각 조립 ── 10×7 타일
  const COLS = 10, ROWS = 7;
  const cv = document.createElement('canvas');
  cv.width = COLS * S * Z; cv.height = ROWS * S * Z;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
    const seed = tx * 131 + ty * 71 + 13;
    const img = ty === 0 ? wallTile(seed, true) : ty === 1 ? wallTile(seed, false) : floorTile(seed);
    g.drawImage(img, tx * S * Z, ty * S * Z, S * Z, S * Z);
  }
  // 벽이 바닥에 드리우는 그림자 — 방이 '안'으로 읽힌다
  const sh = g.createLinearGradient(0, 2 * S * Z, 0, 2 * S * Z + 40);
  sh.addColorStop(0, 'rgba(6,4,12,0.78)'); sh.addColorStop(1, 'rgba(6,4,12,0)');
  g.fillStyle = sh; g.fillRect(0, 2 * S * Z, cv.width, 40);

  // 묘비 배치 — 흩어져 서 있고, 각자 그림자를 우하단으로 던진다
  //   [x, y, 종류, 크기, 좌우반전] — 다섯 무덤이 전부 다르게 서 있다
  for (const [tx, ty, kind, sc, flip] of [
    [1.2, 3.0, 0, 1.00, 0], [4.5, 2.5, 2, 0.88, 1], [7.9, 4.1, 1, 1.06, 0],
    [3.1, 5.3, 3, 0.82, 1], [8.7, 2.4, 0, 0.92, 0], [5.9, 6.0, 2, 0.76, 0]]) {
    const x = tx * S * Z, y = ty * S * Z, w = 40 * sc, h = 52 * sc;
    const img = tombstone(kind * 37 + tx * 11 + ty * 7, kind);
    g.save();
    // 그림자는 광원 반대쪽(우하단)으로 던진다 — 광원 규칙이 그림자에도 적용돼야 입체가 선다
    g.globalAlpha = 0.55; g.fillStyle = '#06040c';
    g.beginPath(); g.ellipse(x + w * 0.62, y + h - 2, w * 0.62, 6 * sc, 0, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    if (flip) { g.translate(x + w, y); g.scale(-1, 1); g.drawImage(img, 0, 0, w, h); }
    else g.drawImage(img, x, y, w, h);
    g.restore();
  }
  // 횃불 + 빛웅덩이 — 빛의 근거가 화면에 보여야 조명이 거짓말이 아니다
  const TR = torch();
  for (const [tx, ty] of [[2.0, 1.35], [7.0, 1.35]]) {
    const x = tx * S * Z, y = ty * S * Z;
    const rg = g.createRadialGradient(x + 12, y + 8, 4, x + 12, y + 8, 230);
    rg.addColorStop(0, 'rgba(255,186,104,0.34)');
    rg.addColorStop(0.35, 'rgba(255,150,64,0.15)');
    rg.addColorStop(0.75, 'rgba(210,110,50,0.05)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = rg;
    g.fillRect(x - 240, y - 240, 490, 490);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(TR, x, y - 16, 24, 44);
  }
  // 구석 어둠 — 광원에서 먼 곳은 실제로 어둡다 (평평함 방지)
  const vg = g.createRadialGradient(cv.width * 0.45, cv.height * 0.35, cv.height * 0.25,
    cv.width * 0.45, cv.height * 0.35, cv.height * 1.05);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(4,3,10,0.62)');
  g.fillStyle = vg; g.fillRect(0, 0, cv.width, cv.height);
  return cv.toDataURL('image/png');
})()`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  await page.goto(`${BASE}/?test=1&bot=1`);
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'play');
  const png = await page.evaluate(async (craft) => {
    Dungeon.floor = 1; Dungeon.roomIndex = 1; Dungeon.build('combat');
    Game.enemies.length = 0; Game.render && Game.render();
    const src = Renderer.canvas || document.querySelector('canvas');
    const url = eval(craft);
    const B = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = url; });
    const cv = document.createElement('canvas'); cv.width = 980; cv.height = 830;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#100e16'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#e8e0cf'; g.font = '14px sans-serif'; g.textAlign = 'left';
    g.fillText('A · 현재 — 단색 사각형. 타일 경계가 격자로 읽힌다', 12, 24);
    g.drawImage(src, 96, 96, 480, 336, 10, 34, 960, 336 * 2);
    g.fillStyle = '#ffd866';
    g.fillText('B · 기준선 — 32색 고정 팔레트 · 광원 좌상단 통일 · 픽셀 단위 노이즈 · 벽 3단 높이 · 묘비 20×26 · 빛의 근거(횃불)', 12, 430);
    g.drawImage(B, 10, 442, 960, 336);
    g.fillStyle = '#8a8296'; g.font = '12px sans-serif';
    g.fillText('완벽한 직선 0 · 같은 타일 그림 반복 0 · 소스 24×24px · 외부 에셋 0', 12, 800);
    return cv.toDataURL('image/png');
  }, CRAFT);
  fs.writeFileSync(path.join(OUT, 'craft-map.png'), Buffer.from(png.split(',')[1], 'base64'));
  console.log('기준선: ' + path.join(OUT, 'craft-map.png'));
  await browser.close();
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
