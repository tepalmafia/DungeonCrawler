// ══════════════════════════════════════════════════════════════════════════
//  겹침 점검 — 「몸이 서로 뚫고 들어가는가」
//
//    python3 tools/serve.py 8137 &   node tools/overlap-audit.js [초]
//
//  ★ 왜 필요한가
//    분리(_separate)는 있었지만 두 구멍이 있었다:
//      ① **플레이어가 목록에 없었다** — 몬스터가 플레이어 몸 안으로 걸어 들어왔다
//      ② 밀어내기가 스프링(dt×7)이라 **추격 속도가 더 빠르면 영영 안 풀렸다**
//    둘 다 코드를 읽어서는 안 보인다. 겹친 깊이를 매 프레임 재야 보인다.
//
//  재는 것 (봇을 실제로 굴리면서):
//    · 적↔적 최대/평균 겹침 깊이 (유닛). 0 이어야 한다
//    · 적↔플레이어 최대/평균 겹침 깊이. 0 이어야 한다
//    · 겹친 프레임 비율
//
//  허용 오차: 한 프레임에 밀어낼 수 있는 양보다 빠르게 다가오면 순간적으로
//  겹칠 수 있다. 그래서 **0 이 아니라 얕고 드물면** 통과로 본다.
// ══════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright-core');

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137/3d';
const SEC = parseFloat(process.argv[2] || '40');

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));

  await page.goto(`${BASE}/index.html?seed=OVERLAP&autostart=1&bot=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.G3 && window.G3.state === 'play', { timeout: 45000 });

  const out = await page.evaluate(async (SEC) => {
    const G = window.G3, P = G.player;
    P.maxHp = 1e9; P.hp = 1e9;          // 죽어서 판이 끊기지 않게

    const STEP = 1 / 60;
    let ee = 0, eeN = 0, eeMax = 0, ep = 0, epN = 0, epMax = 0, frames = 0, badFrames = 0;

    for (let i = 0; i < SEC * 60; i++) {
      G.headlessRun(STEP);
      frames++;
      let bad = false;
      const es = G.enemies.filter((e) => !e.dead);
      for (let a = 0; a < es.length; a++) {
        // 적 ↔ 적
        for (let b = a + 1; b < es.length; b++) {
          const rr = es[a].radius + es[b].radius;
          const d = Math.hypot(es[a].pos.x - es[b].pos.x, es[a].pos.z - es[b].pos.z);
          if (d >= rr) continue;
          const ov = rr - d;
          ee += ov; eeN++; if (ov > eeMax) eeMax = ov; bad = true;
        }
        // 적 ↔ 플레이어
        const rr = es[a].radius + P.radius;
        const d = Math.hypot(es[a].pos.x - P.pos.x, es[a].pos.z - P.pos.z);
        if (d < rr) {
          const ov = rr - d;
          ep += ov; epN++; if (ov > epMax) epMax = ov; bad = true;
        }
      }
      if (bad) badFrames++;
    }
    return {
      frames, badFrames,
      enemies: G.enemies.filter((e) => !e.dead).length,
      eeMax: +eeMax.toFixed(3), eeAvg: +(eeN ? ee / eeN : 0).toFixed(3), eeN,
      epMax: +epMax.toFixed(3), epAvg: +(epN ? ep / epN : 0).toFixed(3), epN,
    };
  }, SEC);

  const pct = (n) => ((n / out.frames) * 100).toFixed(1) + '%';
  console.log(`\n게임내 ${SEC}초 · ${out.frames} 프레임 · 살아 있는 적 ${out.enemies}마리\n`);
  console.log(`적 ↔ 적        최대 겹침 ${out.eeMax} 유닛 · 평균 ${out.eeAvg} · 발생 ${out.eeN}회`);
  console.log(`적 ↔ 플레이어  최대 겹침 ${out.epMax} 유닛 · 평균 ${out.epAvg} · 발생 ${out.epN}회`);
  console.log(`겹친 프레임    ${out.badFrames} / ${out.frames}  (${pct(out.badFrames)})`);
  console.log('\n몸 반지름이 0.38~0.75 이므로 겹침 0.3 이면 「반쯤 파고들었다」로 보인다.');
  console.log('0.1 아래면 눈에 안 띈다.');

  if (errs.length) console.log('\nERR ' + [...new Set(errs)].slice(0, 3).join(' | '));
  await browser.close();
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
