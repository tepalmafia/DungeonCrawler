// 보스 처치 시간 + 무예고 출처 (v207)
// 사장 F9 (v206): 1층 Lv5 · 사망(무덤지기 오스문드) · 공격력 1 · 피격 15(무예고 5)
//
// v166 순서 원칙: **보상을 줄이면 화력이 떨어진다. 적 HP는 그 다음에 정한다.**
// v203에서 보상 출처를 줄여놓고 보스 HP를 안 건드렸다 — 그 청구서가 지금 왔다.
// 이 도구는 ① 실제 화력으로 보스 TTK ② 보스전에서 **무예고로 들어오는 경로**를 잰다.
//   node tools/boss-ttk.js
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.goto(`${BASE}/?test=1&bot=1`);
  await p.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'play');
  const R = await p.evaluate(() => {
    const out = { ttk: [], why: {}, src: {} };
    // ── ① TTK: 사장 실측 화력을 그대로 쓴다 (F9: 1층 Lv5 공1 · 2층 Lv5 공2) ──
    for (const [f, atk] of [[1, 1], [1, 2], [2, 2], [3, 3], [5, 4]]) {
      Game.restart(2024); Game.state = 'play';
      Dungeon.floor = f; Dungeon.roomIndex = Dungeon.totalRooms; Dungeon.build('boss');
      const bs = Game.enemies.find((e) => e.isBoss);
      if (!bs) continue;
      bs.spawnT = 0;
      const hp0 = bs.maxHp;
      let t = 0, hits = 0;
      const step = 1 / 60;
      while (!bs.dead && t < 300) {
        t += step;
        if (t - hits * 0.42 >= 0.42) { hits++; Game.damageEnemy(bs, atk, { x: 1, y: 0 }, { feel: false, kb: 0 }); }
      }
      out.ttk.push({ f, atk, hp: hp0, hits, sec: +t.toFixed(1), killed: bs.dead });
    }
    // ── ② 보스전 무예고 출처 — 어느 공격이 예고 없이 들어오는가 ──
    Game.restart(555); Game.state = 'play';
    Dungeon.floor = 1; Dungeon.roomIndex = Dungeon.totalRooms; Dungeon.build('boss');
    Game.player.god = false; Game.player.hp = Game.player.maxHp = 9999;
    Game._hurtWhy = {}; Game._hurtSrc = {}; Game._tell = null;
    const bs2 = Game.enemies.find((e) => e.isBoss);
    if (bs2) bs2.spawnT = 0;
    // 플레이어를 보스 근처에 묶어두고 60초 — 맞는 것을 전부 모은다
    for (let i = 0; i < 60 * 60; i++) {
      Game.tick(1 / 60);
      const pl = Game.player;
      if (bs2 && !bs2.dead) { pl.x = bs2.x + 70; pl.y = bs2.y; }
      pl.hp = pl.maxHp;
      if (bs2 && bs2.dead) break;
    }
    out.why = { ...Game._hurtWhy };
    out.src = { ...Game._hurtSrc };
    return out;
  });
  await b.close();

  console.log('\n════ 보스 처치 시간 (쉬지 않고 때리는 최선의 경우) ════');
  console.log('층  공격력  보스HP   타수   소요(초)');
  for (const x of R.ttk) {
    const warn = !x.killed ? '  ★ 못 잡음(300초)' : x.sec > 45 ? '  ← 너무 길다' : x.sec < 12 ? '  ← 너무 짧다' : '';
    console.log(String(x.f).padStart(2) + String(x.atk).padStart(7) + String(x.hp).padStart(8)
      + String(x.hits).padStart(7) + String(x.sec).padStart(10) + warn);
  }
  console.log('\n════ 보스전 피격 원인 (60초 붙어 있기) ════');
  const wk = Object.keys(R.why);
  const wn = wk.reduce((a, c) => a + R.why[c], 0) || 1;
  for (const k of wk.sort((a, c) => R.why[c] - R.why[a]))
    console.log('   ' + k.padEnd(7) + String(R.why[k]).padStart(4) + '회 ' + Math.round(R.why[k] / wn * 100) + '%');
  console.log('\n   원인별 출처 — **고칠 자리**');
  for (const k of Object.keys(R.src).sort((a, c) => R.src[c] - R.src[a]).slice(0, 12))
    console.log('   ' + String(R.src[k]).padStart(4) + '회  ' + k);
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
