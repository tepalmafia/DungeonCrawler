// 우두머리 처치 시간 (v206) — 사장: "재생 우두머리를 잡는데 시간이 너무 걸리고"
//
// 어픽스별로 **실제 화력으로 몇 초 걸리는지** 잰다.
// 「어렵다」와 「지루하다」는 다르다 — 재생이 딜을 상쇄해 순 딜이 0에 가까우면
// 그건 난이도가 아니라 **시간 낭비**다.
//   node tools/mini-ttk.js
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const AFFIXES = ['regen', 'steel', 'swift', 'ghostly', 'summoner'];

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.goto(`${BASE}/?test=1&bot=1`);
  await p.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'play');
  const R = await p.evaluate((AF) => {
    const out = [];
    for (const f of [1, 2, 3]) {
      for (const af of AF) {
        Game.restart(4242); Game.state = 'play';
        Dungeon.floor = f; Dungeon.roomIndex = 1; Dungeon.build('combat');
        Game.enemies.length = 0; Game.pendingSpawns.length = 0; Game.markers.length = 0;
        const p2 = Game.player;
        p2.god = true;
        const e = createMiniboss('skeleton', p2.x + 60, p2.y, Game.enemyHpMul());
        e.affixes = [af];
        e.spawnT = 0;
        Game.enemies.push(e);
        // ★ 실제 화력을 쓴다. 공격력 1 고정으로 재면 상위 층이 과대평가된다 —
        //   사장 F9 실측: 2층 Lv5 에 공격력 2. 층이 오르면 화력도 오른다
        p2.atkBonus = (p2.atkBonus || 0) + (f - 1);
        const atk = Math.max(1, p2.currentAtk() + (f - 1));
        const hp0 = e.maxHp;
        // 실제 화력으로 계속 때린다 (플레이어가 붙어서 끊지 않고 치는 최선의 경우)
        let t = 0, hits = 0;
        const step = 1 / 60;
        while (!e.dead && t < 180) {
          t += step;
          Game.tick(step);
          p2.x = e.x - 30; p2.y = e.y;      // 붙어 있는다
          if (!e.dead && (hits === 0 || t - hits * 0.42 >= 0.42)) {
            hits++;
            Game.damageEnemy(e, atk, { x: 1, y: 0 }, { feel: false, kb: 0 });
          }
        }
        out.push({ f, af, hp: hp0, atk, sec: +t.toFixed(1), hits, killed: e.dead });
      }
    }
    return out;
  }, AFFIXES);
  await b.close();

  console.log('\n════ 우두머리 처치 시간 (붙어서 계속 때리는 최선의 경우) ════');
  console.log('층  어픽스     최대HP  공격력  타수   소요(초)');
  for (const x of R) {
    const warn = !x.killed ? '  ★ 못 잡음' : x.sec > 25 ? '  ← 너무 길다' : x.sec < 4 ? '  ← 너무 짧다' : '';
    console.log(String(x.f).padStart(2) + '  ' + x.af.padEnd(10)
      + String(x.hp).padStart(6) + String(x.atk).padStart(7)
      + String(x.hits).padStart(6) + String(x.sec).padStart(10) + warn);
  }
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
