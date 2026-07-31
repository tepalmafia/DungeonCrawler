// 봇 회피 계측 (v209b) — 사장: "봇으로 테스트할때 바닥 함정을 잘피하도록해"
//
// **진짜 봇**을 굴려서 잰다. 계측 하네스(floor-audit/sweep)는 플레이어를 적 옆으로
// 순간이동시키므로 봇의 회피가 아예 돌지 않는다 — 그 도구로는 이 질문에 답할 수 없다.
//
// 재는 것:
//   ① 위험 지대 체류 비율 — 매 프레임 Game.hazardAt 으로 「지금 불 속인가」
//   ② 장판 피격 (분당) — 실제로 맞은 횟수
//   ③ 위험 종류별 체류 — 어느 위험을 못 피하는가
//   node tools/bot-hazard.js [분]
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const MIN = parseFloat(process.argv[2] || '5');

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await p.goto(`${BASE}/?test=1&bot=1&botloop=1`);
  await p.waitForFunction(() => typeof Game !== 'undefined' && typeof Meta !== 'undefined');
  await p.evaluate(() => {
    localStorage.clear(); Meta.load(); Meta.data.introSeen = true;
    Meta.data.classes = { knight: true, archer: true, mage: true, alch: true }; Meta.save();
  });
  await p.reload();
  await p.waitForFunction(() => typeof Game !== 'undefined' && Game.state);
  await p.evaluate(() => {
    window.__hz = { frames: 0, inHaz: 0, urgent: 0, byKind: {}, floors: {} };
    const tick = () => {
      const g = Game, pl = g.player;
      if (pl && g.state === 'play' && g.hazardAt) {
        window.__hz.frames++;
        const h = g.hazardAt(pl.x, pl.y);
        if (h) {
          window.__hz.inHaz++;
          if (h >= 3) window.__hz.urgent++;
          // 어느 위험인가 — 하나씩 따로 물어 종류를 가른다
          const K = window.__hz.byKind;
          const bump = (k) => { K[k] = (K[k] || 0) + 1; };
          if (World.isLavaAt(pl.x, pl.y + 10)) bump('용암');
          if (!g.roomCleared && World.inFog(pl.x, pl.y)) bump('독 안개');
          for (const fp of g.firePatches) if (fp.kind !== 'ice' && Math.hypot(pl.x - fp.x, pl.y - fp.y) < fp.r) bump('불길/독 웅덩이');
          for (const z of (g.zones || [])) if (z.byBoss && z.kind !== 'ice' && Math.hypot(pl.x - z.x, pl.y - z.y) < (z.r || 40)) bump('보스 원소 장판');
          for (const tr of (g.traps || [])) if (tr.state !== 'idle' && Math.hypot(pl.x - tr.x, pl.y - tr.y) < 34 + pl.r) bump('가시 함정');
          for (const e of g.enemies) {
            if (e.dead) continue;
            if (e.curses) for (const c of e.curses) if (!c.noHit && Math.hypot(pl.x - c.x, pl.y - c.y) < (c.r || 48) + pl.r) bump('보스 저주 원');
            if (e.type === 'boomFuse' && Math.hypot(pl.x - e.x, pl.y - e.y) < 83) bump('심지/자폭');
            for (const arr of [e.globs, e.geysers, e.snares, e.rifts]) if (arr) for (const gg of arr)
              if (Math.hypot(pl.x - gg.x, pl.y - gg.y) < 55) bump('착탄 예고');
          }
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const end = Date.now() + MIN * 60000;
  while (Date.now() < end) await p.waitForTimeout(15000);
  const R = await p.evaluate(() => ({ ...window.__hz, why: Game._hurtWhy || {}, src: Game._hurtSrc || {} }));
  await b.close();

  const pct = (v) => (R.frames ? (v / R.frames * 100) : 0);
  console.log(`\n════ 봇 회피 계측 (진짜 봇 ${MIN}분 · 표본 ${R.frames}프레임) ════`);
  console.log('\n■ 위험 지대 체류 ' + pct(R.inHaz).toFixed(1) + '%'
    + (pct(R.inHaz) > 6 ? '   ← 너무 오래 서 있다' : '   ✓')
    + '   (그중 급한 위험 ' + pct(R.urgent).toFixed(1) + '%)');
  console.log('\n■ 위험 종류별 체류 — 무엇을 못 피하는가');
  const ks = Object.keys(R.byKind).sort((a, c) => R.byKind[c] - R.byKind[a]);
  if (!ks.length) console.log('   (없음)');
  for (const k of ks) console.log('   ' + k.padEnd(14) + pct(R.byKind[k]).toFixed(2) + '%');
  const wn = Object.values(R.why).reduce((a, c) => a + c, 0) || 1;
  console.log('\n■ 피격 원인 (봇 실주행)');
  for (const k of Object.keys(R.why).sort((a, c) => R.why[c] - R.why[a]))
    console.log('   ' + k.padEnd(7) + String(R.why[k]).padStart(4) + '회 ' + Math.round(R.why[k] / wn * 100) + '%');
  const gs = Object.keys(R.src).filter((k) => k.startsWith('장판'));
  if (gs.length) {
    console.log('\n■ 장판 피격 출처 — 어느 바닥을 밟았는가');
    for (const k of gs.sort((a, c) => R.src[c] - R.src[a]))
      console.log('   ' + String(R.src[k]).padStart(4) + '회  ' + k.split(' / ')[1]);
  }
  if (errs.length) console.log('\n⚠ 에러 ' + errs.length + ': ' + errs[0]);
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
