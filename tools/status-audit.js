// 상태이상 감사 (v200) — 「걸린다」와 「보인다」를 따로 잰다
//
// v185~192에서 세 번 겪은 실패: 기능은 작동하는데 화면에 안 나와서 없는 것과 같았다.
// 그래서 이 도구는 두 가지를 따로 센다:
//   ① 보스전 N초 동안 플레이어에게 **실제로 걸린** 상태이상 종수
//   ② 그때 **화면에 그려진** 상태 표시(HUD 칩·몸 오버레이·바닥 장판)
//   node tools/status-audit.js [층...]
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const FLOORS = (process.argv.slice(2).length ? process.argv.slice(2) : ['1', '2', '3', '4', '5']).map(Number);
const SECONDS = 20;

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  console.log('\n════ 상태이상 감사 (보스전 ' + SECONDS + '초) ════');
  console.log('층  보스속성        걸린 상태            바닥 잔여물  HUD칩  최대동시');
  for (const fl of FLOORS) {
    const p = await b.newPage({ viewport: { width: 960, height: 540 } });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
    await p.goto(`${BASE}/?test=1&bot=1&botloop=1`);
    await p.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'play');
    await p.evaluate((f) => {
      Dungeon.floor = f; Dungeon.roomIndex = Dungeon.totalRooms; Dungeon.build('boss');
      Game.statusSeen = {};
      Game.player.god = false;
      Game._zoneKinds = new Set();
      Game._maxConcurrent = 0;
    }, fl);
    // 매 프레임 계측 훅
    await p.evaluate(() => {
      const tick = () => {
        const pl = Game.player;
        if (pl) {
          const n = ['burnT', 'freezeT', 'poisonT', 'shockT', 'curseT'].filter((k) => (pl[k] || 0) > 0).length;
          Game._maxConcurrent = Math.max(Game._maxConcurrent || 0, n);
        }
        for (const z of Game.zones || []) if (z.byBoss) Game._zoneKinds.add(z.elem);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await p.waitForTimeout(SECONDS * 1000);
    const R = await p.evaluate(() => {
      const bs = Game.enemies.find((e) => e.isBoss);
      return {
        elems: bs ? bs.elems : [],
        seen: Object.keys(Game.statusSeen || {}),
        zones: [...(Game._zoneKinds || [])],
        maxC: Game._maxConcurrent || 0,
        alive: !!bs && !bs.dead,
      };
    });
    await p.close();
    const K = { burn: '화상', freeze: '빙결', poison: '중독', shock: '감전', curse: '저주' };
    const nm = (a) => a.map((x) => K[x] || x).join(',') || '없음';
    console.log(String(fl).padStart(2) + '  ' + nm(R.elems).padEnd(14)
      + nm(R.seen).padEnd(20) + String(R.zones.length).padStart(6)
      + String(R.seen.length).padStart(7) + String(R.maxC).padStart(9)
      + (errs.length ? '  ⚠ ' + errs[0] : ''));
  }
  await b.close();
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
