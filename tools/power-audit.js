// 화력 계측 (v203) — v166 순서 원칙: **보상을 줄이면 화력이 떨어진다. 적 HP는 그 다음에 정한다.**
//
// 보상 출처를 제한했으니(정예방·습격·기연 카드 제거, 보스 처치 카드 신설) 층별 화력이 변한다.
// 추측으로 HP를 만지면 안 된다 — 먼저 **실제로 몇 대 만에 죽는지**를 잰다.
//   node tools/power-audit.js [분]
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const MIN = parseFloat(process.argv[2] || '6');

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
    window.__pw = { floors: {}, boss: [], cards: 0 };
    const _t = Game.openTraitChoice.bind(Game);
    Game.openTraitChoice = function (r) { window.__pw.cards++; return _t(r); };
    // 층 진입마다 그 시점의 화력을 기록한다 — 「몇 대에 잡몹이 죽는가」가 화력의 실체다
    const _b = Dungeon.build.bind(Dungeon);
    Dungeon.build = function (t) {
      const r = _b(t);
      const f = Dungeon.floor;
      if (!window.__pw.floors[f] && Game.player) {
        const pl = Game.player;
        window.__pw.floors[f] = {
          atk: pl.atk, lvl: pl.level, cards: window.__pw.cards,
          traits: (pl.traits || []).length, relics: (pl.relics || []).length, hp: pl.maxHp,
        };
      }
      return r;
    };
    const _bd = Game.onBossDead.bind(Game);
    Game.onBossDead = function () {
      const be = Game.enemies.find((e) => e.isBoss);
      window.__pw.boss.push({ f: Dungeon.floor, t: Math.round((be && be.fightT) || 0) });
      return _bd();
    };
  });
  const end = Date.now() + MIN * 60000;
  while (Date.now() < end) await p.waitForTimeout(15000);
  const R = await p.evaluate(() => window.__pw);
  await b.close();

  console.log('\n════ 화력 계측 (' + MIN + '분 봇 플레이) ════');
  console.log('층   공격력  레벨  누적카드  특성  유물  최대HP   잡몹1기 필요타수');
  for (const f of Object.keys(R.floors).sort((a, c) => a - c)) {
    const v = R.floors[f];
    // 층 기준 잡몹 HP (enemies.js 스케일과 같은 식) — 대표값 hp 6
    const mobHp = Math.ceil(6 * (1 + (f - 1) * 0.22));
    const hits = v.atk > 0 ? (mobHp / v.atk).toFixed(1) : '—';
    console.log(String(f).padStart(2) + String(v.atk).padStart(8) + String(v.lvl).padStart(6)
      + String(v.cards).padStart(10) + String(v.traits).padStart(6) + String(v.relics).padStart(6)
      + String(v.hp).padStart(8) + hits.padStart(14) + '타');
  }
  console.log('\n보스 처치 시간(초): ' + (R.boss.map((x) => x.f + '층 ' + x.t + 's').join(' · ') || '없음'));
  if (errs.length) console.log('⚠ 에러 ' + errs.length + ': ' + errs[0]);
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
