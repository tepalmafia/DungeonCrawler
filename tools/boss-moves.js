// ══════════════════════════════════════════════════════════════════════════
//  보스 기술 지문 — 「보스 코드를 고쳤는데 싸움이 안 바뀌었는지」를 확인한다.
//
//    node tools/boss-moves.js > before.txt
//    ...고친다...
//    node tools/boss-moves.js > after.txt
//    diff before.txt after.txt                 ← 비어야 한다
//
//  ★ 왜 층 지문(tools/floor-parity.js)으로는 안 되는가
//    보스 기술은 seeded rng 가 아니라 Math.random() 을 쓴다. 같은 시드로
//    돌려도 매번 다른 기술이 나오므로 지문이 안 잡힌다.
//
//    그래서 **기술을 하나씩 강제로 걸고** 그 결과를 잰다:
//      · 예비 동작 길이(windupDur)
//      · 기술이 끝날 때까지의 시계(moveT)
//      · 플레이어가 받은 피해 총량과 횟수
//      · 소환된 적 수 · 보스가 움직인 거리
//
//    이건 난수와 무관하므로 **정확히 일치해야** 한다. 한 값이라도 다르면
//    그 기술의 판정이나 타이밍이 바뀐 것이다.
//
//  주의: 무작위가 섞인 기술(firering 의 점화 위치, combo 의 박자)은 위치까지
//  같을 수 없다. 그래서 **위치가 아니라 개수와 총량**을 잰다.
// ══════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright-core');

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137/3d';

const MOVES = ['cleave', 'combo', 'charge', 'summon', 'firering', 'sweep'];
// 페이즈마다 enrage 가 달라 예비 동작 길이가 바뀐다 — 셋 다 잰다
const PHASES = [0, 1, 2];

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));

  await page.goto(`${BASE}/index.html?seed=BOSSFP&autostart=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.G3 && window.G3.state === 'play', { timeout: 45000 });

  const lines = await page.evaluate(async ([MOVES, PHASES]) => {
    const G = window.G3;
    const bo = await import('./js/game/boss.js');
    const out = [];

    // 보스 기술은 Math.random() 을 쓴다 — firering 의 점화 위치가 매번 달라서
    // 같은 코드로 두 번 찍어도 피해량이 0 / 42 / 168 로 흔들렸다.
    // 재는 동안만 씨앗 난수로 바꿔 **모든 항목을 결정적으로** 만든다.
    // (안 그러면 diff 를 읽을 때마다 「이건 잡음인가 진짜인가」를 판단해야 하고,
    //  그러면 검사가 무뎌진다.)
    const realRandom = Math.random;
    let seed = 12345;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (const phase of PHASES) {
      for (const move of MOVES) {
        seed = 12345;          // 기술마다 같은 자리에서 시작한다
        // 매번 새 보스를 세운다 — 앞 기술의 상태가 안 남게
        for (const e of G.enemies) e.dispose();
        G.enemies.length = 0;
        const boss = bo.spawnBoss(G, G.dungeon, 3, 0);
        G.enemies.push(boss);
        G.boss = boss;

        // 페이즈를 강제한다. _checkPhase 가 되돌리지 못하게 hp 도 맞춘다
        boss.hp = boss.maxHp * [0.9, 0.5, 0.2][phase];
        boss.phase = phase;
        boss.enrage = 1 + phase * 0.22;

        // 플레이어를 사거리 안에 세우고, 안 죽고 안 밀리게 한다
        const P = G.player;
        P.setPosition(boss.pos.x, boss.pos.z + 3.2);
        P.maxHp = 1e7; P.hp = 1e7; P.invuln = 0; P.dead = false;
        P.armor = 0;                        // 감산을 빼야 원 피해가 보인다

        const hp0 = P.hp;
        const bx0 = boss.pos.x, bz0 = boss.pos.z;
        const n0 = G.enemies.length;

        boss._start(G, move, P);
        const windup = +boss.windupDur.toFixed(4);

        // 기술이 끝날 때까지 고정 스텝으로 민다 (최대 8초)
        let t = 0, hits = 0, lastHp = P.hp;
        const STEP = 1 / 60;
        while (boss.move && t < 8) {
          const d = Math.hypot(P.pos.x - boss.pos.x, P.pos.z - boss.pos.z);
          boss._runMove(STEP, G, P, d);
          // 예약된 폭발(firering)도 밟아 준다
          for (let i = G.timers.length - 1; i >= 0; i--) {
            G.timers[i].t -= STEP;
            if (G.timers[i].t <= 0) { G.timers[i].fn(); G.timers.splice(i, 1); }
          }
          if (P.hp < lastHp) { hits++; lastHp = P.hp; }
          P.invuln = 0;                     // 무적 시간이 판정을 가리지 않게
          t += STEP;
        }
        // firering 은 기술이 끝난 뒤에 터진다 — 남은 예약을 마저 밟는다
        for (let k = 0; k < 120 && G.timers.length; k++) {
          for (let i = G.timers.length - 1; i >= 0; i--) {
            G.timers[i].t -= STEP;
            if (G.timers[i].t <= 0) { G.timers[i].fn(); G.timers.splice(i, 1); }
          }
          if (P.hp < lastHp) { hits++; lastHp = P.hp; }
          P.invuln = 0;
        }

        out.push(`p${phase} ${move.padEnd(9)}`
          + ` windup=${windup}`
          + ` dur=${t.toFixed(3)}`
          + ` dmg=${Math.round(hp0 - P.hp)}`
          + ` hits=${hits}`
          + ` summon=${G.enemies.length - n0}`
          + ` moved=${Math.hypot(boss.pos.x - bx0, boss.pos.z - bz0).toFixed(2)}`);
      }
    }
    Math.random = realRandom;
    return out;
  }, [MOVES, PHASES]);

  for (const l of lines) console.log(l);
  if (errs.length) console.log('ERR ' + [...new Set(errs)].slice(0, 3).join(' | '));
  await browser.close();
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
