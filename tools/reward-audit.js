// 보상 출처 감사 (v203) — 사장: "특성이나 스킬, 스탯은 레벨업과 보스를 잡거나 보물을 먹을때만"
//
// 자르기 전에 **어디서 몇 번 나오는지** 센다. 추측으로 자르면 반드시 엉뚱한 걸 자른다.
// 호출 지점(코드)이 아니라 **실제 런에서 발생한 횟수**(소비자)를 센다 —
// v185·186·192에서 세 번 겪었다: 생성기를 세고 소비자를 안 셌다.
//   node tools/reward-audit.js [층수]
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const FLOORS = parseInt(process.argv[2] || '5', 10);
const MIN = parseFloat(process.argv[3] || '4');

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
  // 계측 훅 — 보상 선택창이 열리는 지점을 전부 태그한다
  await p.evaluate(() => {
    window.__rw = { trait: {}, relic: 0, rooms: {}, floorSeen: {} };
    const _t = Game.openTraitChoice.bind(Game);
    Game.openTraitChoice = function (reason) {
      const key = (reason || 'unknown') + '@f' + (Dungeon.floor || 0);
      window.__rw.trait[key] = (window.__rw.trait[key] || 0) + 1;
      return _t(reason);
    };
    const _r = Game.openRelicChoice.bind(Game);
    Game.openRelicChoice = function () { window.__rw.relic++; return _r(); };
    const _b = Dungeon.build.bind(Dungeon);
    Dungeon.build = function (type) {
      const f = Dungeon.floor || 0;
      window.__rw.rooms[f] = window.__rw.rooms[f] || {};
      window.__rw.rooms[f][type] = (window.__rw.rooms[f][type] || 0) + 1;
      window.__rw.floorSeen[f] = Dungeon.totalRooms;
      return _b(type);
    };
  });
  const end = Date.now() + MIN * 60000;
  while (Date.now() < end) {
    await p.waitForTimeout(10000);
    const st = await p.evaluate(() => ({ f: Dungeon.floor, s: Game.state }));
    if (st.f > FLOORS + 2) break;
  }
  const R = await p.evaluate(() => ({ ...window.__rw, lvl: Game.player ? Game.player.lvl : 0 }));
  await b.close();

  console.log('\n════ 보상 출처 감사 (' + MIN + '분 봇 플레이) ════');
  const byReason = {};
  let total = 0;
  for (const [k, v] of Object.entries(R.trait)) {
    const reason = k.split('@')[0];
    byReason[reason] = (byReason[reason] || 0) + v;
    total += v;
  }
  console.log('\n■ 특성 선택창이 열린 횟수 (총 ' + total + '회)');
  for (const [r, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1]))
    console.log('   ' + r.padEnd(12) + String(n).padStart(4) + '회   ' + (n / total * 100).toFixed(0) + '%');
  console.log('   유물 선택창          ' + R.relic + '회');
  console.log('\n■ 층별 방 구성 (totalRooms · 실제 build 호출)');
  for (const f of Object.keys(R.rooms).sort((a, b) => a - b)) {
    const kinds = R.rooms[f];
    const n = Object.values(kinds).reduce((a, b) => a + b, 0);
    console.log('   ' + String(f).padStart(3) + '층  선언 ' + String(R.floorSeen[f]).padStart(2)
      + '칸 · 실제 ' + String(n).padStart(2) + '칸  ' + Object.entries(kinds).map(([k, v]) => k + '×' + v).join(' '));
  }
  if (errs.length) console.log('\n⚠ 에러 ' + errs.length + ': ' + errs[0]);
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
