// 보스전 시간 분해 (v211b) — 「왜 긴가」를 HP 탓하기 전에 쪼갠다
//
// 전 층 쓸기: 보스 3층 5.3초 · 5층 33.0초 · 10층 36.6초 (사장 화력 기준).
// 여기서 곧바로 HP를 조절하면 틀린다 — 보스는 **무적 장막·재생·페이즈**가 있어
// 시간이 HP에 비례하지 않는다. 무적 구간이 길어서 긴 것을 HP 탓으로 돌리면
// HP만 깎이고 지루함은 그대로 남는다.
//
// 그래서 시간을 쪼갠다:
//   ① 때릴 수 있었던 시간   ② 무적/장막으로 못 때린 시간
//   ③ 재생으로 되돌아간 HP   ④ 실제로 넣은 피해
//   node tools/boss-time.js [끝층]
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const LAST = parseInt(process.argv[2] || '10', 10);
const ATK_MUL = parseFloat(process.env.ATK_MUL || '0.45');   // 기본은 사장 실측 화력

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.goto(`${BASE}/?test=1&bot=1`);
  await p.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'play');
  const R = await p.evaluate(([LAST, ATK_MUL]) => {
    const out = [];
    // ★ 씨앗 하나로 정하지 않는다. _cheatScaleToFloor 는 특성을 **무작위로** 뽑으므로
    //   같은 층도 뽑기에 따라 공4.75~7.6 으로 흔들린다 — n=1 로 HP를 정하면 그 뽑기에 맞춘 게 된다
    for (let f = 1; f <= LAST; f++) {
     const runs = [];
     for (const seed of [2024, 777, 31337, 5150, 909]) {
      Game.restart(seed); Game.state = 'play';
      Dungeon.floor = f;
      if (Game._cheatScaleToFloor) Game._cheatScaleToFloor();
      const pl = Game.player;
      if (ATK_MUL !== 1) {
        const fixed = 1 + (Game.level - 1) * 0.25;
        pl.bonusAtk = Math.max(0, (pl.buildAtk() * ATK_MUL) - fixed);
      }
      const atk = pl.currentAtk();
      Dungeon.roomIndex = Dungeon.totalRooms; Dungeon.build('boss');
      const bs = Game.enemies.find((e) => e.isBoss);
      if (!bs) continue;
      bs.spawnT = 0;
      pl.god = true;
      const hp0 = bs.maxHp;
      let t = 0, hits = 0, blocked = 0, dealt = 0, healed = 0, adds = 0;
      let prevHp = bs.hp;
      const step = 1 / 60;
      const states = {};
      while (!bs.dead && t < 240) {
        t += step;
        Game.tick(step);
        if (bs.phased || bs.invuln > 0 || bs.state === 'veil') {
          const ad = Game.enemies.find((e) => !e.dead && !e.isBoss && !e.neutral);
          if (ad) { pl.x = ad.x + 30; pl.y = ad.y; } else { pl.x = bs.x + 44; pl.y = bs.y; }
        } else { pl.x = bs.x + 44; pl.y = bs.y; }
        states[bs.state] = (states[bs.state] || 0) + step;
        // 되돌아간 HP (재생·장막 회복) — 넣은 피해가 아니라 **버린 시간**이다
        if (bs.hp > prevHp) healed += bs.hp - prevHp;
        prevHp = bs.hp;
        const untouchable = !!(bs.phased || bs.invuln > 0 || bs.state === 'veil');
        if (untouchable) blocked += step;
        if (t - hits * 0.42 >= 0.42) {
          hits++;
          // ★ **기믹을 플레이한다.** 1차엔 보스만 때렸다 — 어둠 장막은 「부하를 죽이면 멈춘다」가
          //   설계인데, 부하를 무시하면 장막이 끝날 때까지 서 있게 된다. 그래서 10층에서
          //   무적 24초·회복 588(최대치의 73%)이 나왔다. 그건 보스가 긴 게 아니라
          //   **내가 기믹을 안 푼 것**이다. 무적이면 가장 가까운 부하부터 친다
          const target = untouchable
            ? Game.enemies.filter((e) => !e.dead && !e.isBoss && !e.neutral)
              .sort((a, c) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(c.x - pl.x, c.y - pl.y))[0]
            : bs;
          if (!target) continue;
          const before = target.hp;
          Game.damageEnemy(target, atk, { x: 1, y: 0 }, { feel: false, kb: 0 });
          if (target === bs) { dealt += Math.max(0, before - bs.hp); prevHp = bs.hp; }
        }
      }
      adds = Game.enemies.filter((e) => !e.dead && !e.isBoss).length;
      const top = Object.keys(states).sort((a, c) => states[c] - states[a]).slice(0, 3)
        .map((k) => k + ' ' + states[k].toFixed(1) + 's').join(' · ');
      runs.push({ hp: hp0, atk, sec: t, killed: bs.dead, blocked, healed, adds, top });
     }
     const n = runs.length || 1;
     const avg = (k) => runs.reduce((a, c) => a + c[k], 0) / n;
     const secs = runs.map((r) => r.sec).sort((a, c) => a - c);
     out.push({ f, hp: runs[0].hp, atk: +avg('atk').toFixed(2), sec: +avg('sec').toFixed(1),
       lo: +secs[0].toFixed(1), hi: +secs[secs.length - 1].toFixed(1),
       killed: runs.every((r) => r.killed), blocked: +avg('blocked').toFixed(1),
       healed: Math.round(avg('healed')), dealt: Math.round(avg('dealt')), adds: Math.round(avg('adds')),
       top: runs[0].top });
    }
    return out;
  }, [LAST, ATK_MUL]);
  await b.close();

  console.log(`\n════ 보스전 시간 분해 (화력 ${ATK_MUL === 1 ? '기준(봇)' : '×' + ATK_MUL + ' 사장 실측'}) ════`);
  console.log('층  보스HP  공격력   소요(평균/최소~최대)  못때린시간  되돌아간HP  남은부하');
  for (const x of R) {
    const warn = !x.killed ? '  ★ 못 잡음(240초)' : x.sec > 28 ? '  ← 너무 길다' : x.sec < 10 ? '  ← 너무 짧다' : '';
    console.log(String(x.f).padStart(2) + String(x.hp).padStart(8) + String(x.atk).padStart(8)
      + ('  ' + x.sec + '초 (' + x.lo + '~' + x.hi + ')').padEnd(22)
      + (x.blocked + '초').padStart(10) + String(x.healed).padStart(12) + String(x.adds).padStart(10) + warn);
  }
  console.log('\n■ 시간을 먹는 상태 (상위 3)');
  for (const x of R) console.log('  ' + String(x.f).padStart(2) + '층  ' + x.top);
  console.log('\n※ 「못때린시간」이 크면 HP가 아니라 **무적 구간**이 범인이다.');
  console.log('   「되돌아간HP」가 크면 재생이 딜을 상쇄하는 것 — 어려운 게 아니라 지루한 것이다.');
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
