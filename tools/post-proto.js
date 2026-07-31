// 조명·색보정 패스 시제품 (v200) — 사장: "이게 최선이야?"
//
// 답: 아니다. "24종을 다시 그린다"는 가장 비싸고 느린 길이었다.
// Dead Cells · Hyper Light Drifter · Enter the Gungeon 이 좋아 보이는 진짜 이유는
// 스프라이트 픽셀 수가 아니라 **조명 · 색 통일 · 후처리**다.
// 그건 스프라이트를 한 장도 안 그리고 **화면 전체를 한 번에** 올린다.
//
// 이 도구는 지금 게임의 실제 프레임에 후처리 패스만 얹어 A/B를 만든다.
//   node tools/post-proto.js → docs/audit/proto-post.png
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const OUT = path.join(__dirname, '..', 'docs', 'audit');

// 후처리 파이프라인 — 전부 2D 캔버스. 셰이더도 WebGL도 필요 없다
const POST = `(src, lights) => {
  const W = src.width, H = src.height;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H;
    c.getContext('2d').imageSmoothingEnabled = false; return c; };

  // ── ① 색보정 (color grade) ────────────────────────────────
  // 지금 화면은 채도가 낮고 중간톤이 뭉개져 평평하다.
  // 그림자를 차가운 청보라로, 하이라이트를 따뜻한 살구색으로 민다(split-tone).
  // 이것만으로 '같은 게임의 한 화면'이라는 통일감이 생긴다.
  const graded = mk(); const gg = graded.getContext('2d');
  gg.drawImage(src, 0, 0);
  const im = gg.getImageData(0, 0, W, H); const d = im.data;
  const SHADOW = [58, 44, 92], HILITE = [255, 214, 150];
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] / 255, g = d[i+1] / 255, b = d[i+2] / 255;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    // 대비 S커브 — 중간톤을 벌린다 (평평함의 주범)
    const cur = (v) => v < 0.5 ? 0.5 * Math.pow(v * 2, 1.28) : 1 - 0.5 * Math.pow((1 - v) * 2, 1.28);
    r = cur(r); g = cur(g); b = cur(b);
    // 채도 +18%
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    r = lum + (r - lum) * 1.18; g = lum + (g - lum) * 1.18; b = lum + (b - lum) * 1.18;
    // split-tone: 어두운 곳은 청보라, 밝은 곳은 살구
    const ws = Math.pow(1 - l, 2.2) * 0.20, wh = Math.pow(l, 2.2) * 0.16;
    r = r * (1 - ws - wh) + (SHADOW[0]/255) * ws + (HILITE[0]/255) * wh;
    g = g * (1 - ws - wh) + (SHADOW[1]/255) * ws + (HILITE[1]/255) * wh;
    b = b * (1 - ws - wh) + (SHADOW[2]/255) * ws + (HILITE[2]/255) * wh;
    // 검정 바닥을 살짝 들어올린다 — 지형이 안 보이던 문제(맵 계측 ④)
    d[i]   = Math.max(0, Math.min(255, r * 255 + 9));
    d[i+1] = Math.max(0, Math.min(255, g * 255 + 8));
    d[i+2] = Math.max(0, Math.min(255, b * 255 + 14));
  }
  gg.putImageData(im, 0, 0);

  // ── ② 광원 (dynamic lights) ───────────────────────────────
  // 횃불·투사체·보스 오라가 실제로 주변을 밝힌다. 곱하기+더하기 2패스.
  const lm = mk(); const lg = lm.getContext('2d');
  lg.fillStyle = '#2a2438'; lg.fillRect(0, 0, W, H);       // 주변광 (완전 검정이 아니다)
  lg.globalCompositeOperation = 'lighter';
  for (const L of lights) {
    const rg = lg.createRadialGradient(L.x, L.y, 2, L.x, L.y, L.r);
    rg.addColorStop(0, L.c); rg.addColorStop(0.4, L.c.replace(/[\\d.]+\\)$/, '0.45)'));
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    lg.fillStyle = rg; lg.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
  }
  const lit = mk(); const tg = lit.getContext('2d');
  tg.drawImage(graded, 0, 0);
  tg.globalCompositeOperation = 'multiply'; tg.drawImage(lm, 0, 0);
  tg.globalCompositeOperation = 'lighter'; tg.globalAlpha = 0.34; tg.drawImage(lm, 0, 0);
  tg.globalAlpha = 1; tg.globalCompositeOperation = 'source-over';

  // ── ③ 블룸 (bloom) ───────────────────────────────────────
  // 밝은 픽셀만 뽑아 흐린 뒤 더한다. 불꽃·안광·투사체가 '빛나기' 시작한다.
  const br = mk(); const bg2 = br.getContext('2d');
  bg2.drawImage(lit, 0, 0);
  const bi = bg2.getImageData(0, 0, W, H); const bd = bi.data;
  for (let i = 0; i < bd.length; i += 4) {
    const l = 0.299 * bd[i] + 0.587 * bd[i+1] + 0.114 * bd[i+2];
    const k = l > 168 ? (l - 168) / 87 : 0;
    bd[i] *= k; bd[i+1] *= k; bd[i+2] *= k;
  }
  bg2.putImageData(bi, 0, 0);
  const out = mk(); const og = out.getContext('2d');
  og.drawImage(lit, 0, 0);
  og.globalCompositeOperation = 'lighter';
  og.filter = 'blur(7px)';  og.globalAlpha = 0.62; og.drawImage(br, 0, 0);
  og.filter = 'blur(17px)'; og.globalAlpha = 0.40; og.drawImage(br, 0, 0);
  og.filter = 'none'; og.globalAlpha = 1; og.globalCompositeOperation = 'source-over';

  // ── ④ 비네트 ─────────────────────────────────────────────
  // 시선을 화면 중앙(플레이어)으로 모은다
  const vg = og.createRadialGradient(W/2, H/2, H*0.34, W/2, H/2, H*0.92);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,6,16,0.55)');
  og.fillStyle = vg; og.fillRect(0, 0, W, H);
  return out;
}`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.goto(`${BASE}/?test=1&bot=1&botloop=1`);
  await page.waitForFunction(() => typeof Game !== 'undefined' && typeof Sprites !== 'undefined');
  await page.evaluate(() => {
    localStorage.clear(); Meta.load(); Meta.data.introSeen = true;
    Meta.data.classes = { knight: true, archer: true, mage: true, alch: true }; Meta.save();
  });
  await page.reload();
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'play');
  await page.evaluate(() => { Dungeon.floor = 1; Dungeon.roomIndex = Dungeon.totalRooms; Dungeon.build('boss'); });
  await page.waitForTimeout(4200);

  const png = await page.evaluate((post) => {
    const P = eval(post);
    const src = Renderer.canvas || document.querySelector('canvas');
    // 광원 목록 — 실제 게임 객체에서 뽑는다 (횃불·보스·투사체·플레이어)
    const lights = [];
    for (const t of (World.torches || [])) lights.push({ x: t.x, y: t.y, r: 210, c: 'rgba(255,168,84,0.95)' });
    if (Game.player) lights.push({ x: Game.player.x, y: Game.player.y, r: 150, c: 'rgba(190,206,255,0.55)' });
    for (const e of Game.enemies) if (e.isBoss) lights.push({ x: e.x, y: e.y, r: 190, c: 'rgba(190,90,230,0.8)' });
    for (const a of Game.arrows) lights.push({ x: a.x, y: a.y, r: 74, c: 'rgba(255,150,90,0.9)' });
    for (const b of Game.pbolts) lights.push({ x: b.x, y: b.y, r: 66, c: 'rgba(150,220,255,0.9)' });
    for (const f of Game.firePatches) lights.push({ x: f.x, y: f.y, r: 110, c: 'rgba(255,130,60,0.9)' });

    const outImg = P(src, lights);
    const cv = document.createElement('canvas'); cv.width = 980; cv.height = 1170;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#100e16'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#ffd866'; g.font = 'bold 16px sans-serif'; g.textAlign = 'left';
    g.fillText('같은 프레임 · 스프라이트는 한 장도 안 바꿨다', 12, 26);
    g.fillStyle = '#e8e0cf'; g.font = '14px sans-serif';
    g.fillText('A · 현재', 12, 52);
    g.drawImage(src, 10, 62);
    g.fillStyle = '#ffd866';
    g.fillText('B · 조명 + 색보정 + 블룸 + 비네트 패스만 추가 (그린 그림은 동일)', 12, 640);
    g.drawImage(outImg, 10, 650);
    g.fillStyle = '#8a8296'; g.font = '12px sans-serif';
    g.fillText('① 색보정: 대비 S커브 · 채도 +18% · 그림자→청보라 / 하이라이트→살구 (split-tone) · 검정 바닥 들어올림', 12, 1210 - 10);
    return cv.toDataURL('image/png');
  }, POST);

  fs.writeFileSync(path.join(OUT, 'proto-post.png'), Buffer.from(png.split(',')[1], 'base64'));
  console.log('시제품: ' + path.join(OUT, 'proto-post.png'));
  await browser.close();
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
