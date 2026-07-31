// 실화력 계측 (v208) — 「보스 HP를 얼마로 할까」의 **분모**를 잰다
//
// 보스 HP를 손으로 정하려면 플레이어가 그 층에서 **실제로 몇의 화력을 들고 오는지**를
// 알아야 한다. 지금까지는 그걸 가정했다 — 가정은 계측이 아니다.
// (v185·192·205·206에서 반복한 실수: 소비자가 아니라 다른 경로를 쟀다)
//
// 보스방에 **들어서는 순간**의 currentAtk() 를 모은다. 그게 분모다.
//   node tools/firepower.js [분]
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const MIN = parseFloat(process.argv[2] || '12');
// ★ v208 — 이 도구는 **화력만** 잰다. 종전엔 여기서 hp/atk×0.42 로 TTK 와 권장 HP까지
//   찍었는데, 그 나눗셈은 「가만히 서 있는 보스」를 가정한다 — 시전 인터럽트 ×1.5·
//   그로기 ×1.35 가 한 번도 안 걸린 숫자다. 실제로 돌려보면 절반 이하다.
//   처치 시간은 게임을 실제로 돌리는 tools/floor-audit.js 로 재라.

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.goto(`${BASE}/?test=1&bot=1&botloop=1`);
  await p.waitForFunction(() => typeof Game !== 'undefined' && typeof Meta !== 'undefined');
  await p.evaluate(() => {
    localStorage.clear(); Meta.load(); Meta.data.introSeen = true;
    Meta.data.classes = { knight: true, archer: true, mage: true, alch: true }; Meta.save();
  });
  await p.reload();
  await p.waitForFunction(() => typeof Game !== 'undefined' && Game.state);
  await p.evaluate(() => {
    window.__fp = [];
    const _b = Dungeon.build.bind(Dungeon);
    Dungeon.build = function (t) {
      const r = _b(t);
      if (t === 'boss' && Game.player) {
        const bs = Game.enemies.find((e) => e.isBoss);
        window.__fp.push({ f: Dungeon.floor, lv: Game.level, atk: +Game.player.currentAtk().toFixed(2),
          hp: Game.player.maxHp, bossHp: bs ? bs.maxHp : 0, cls: Game.player.cls || '?' });
      }
      return r;
    };
  });
  const end = Date.now() + MIN * 60000;
  while (Date.now() < end) await p.waitForTimeout(15000);
  const FP = await p.evaluate(() => window.__fp);
  await b.close();

  const byF = {};
  for (const x of FP) (byF[x.f] || (byF[x.f] = [])).push(x);
  console.log('\n════ 실화력 — 보스방 입장 순간 (봇 ' + MIN + '분 · 표본 ' + FP.length + ') ════');
  console.log('층  표본  평균Lv   공격력(중앙/최소~최대)   보스HP');
  for (const f of Object.keys(byF).sort((a, c) => a - c)) {
    const g = byF[f];
    const at = g.map((x) => x.atk).sort((a, c) => a - c);
    const med = at[Math.floor(at.length / 2)];
    const lv = g.reduce((a, c) => a + c.lv, 0) / g.length;
    const bh = g[0].bossHp;
    console.log(String(f).padStart(2) + String(g.length).padStart(6) + lv.toFixed(1).padStart(8)
      + ('  ' + med.toFixed(2) + ' (' + at[0].toFixed(1) + '~' + at[at.length - 1].toFixed(1) + ')').padEnd(26)
      + String(bh).padStart(7));
  }
  console.log('\n처치 시간은 여기서 재지 않는다 — node tools/floor-audit.js <층> (게임을 실제로 돌린다)');
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
