// 시전 인터럽트 감사 (v201) — 「끊을 수 있는가」와 「보이는가」를 따로 잰다
//   node tools/cast-audit.js [층...]
const fs = require('fs');
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const FLOORS = (process.argv.slice(2).length ? process.argv.slice(2) : ['1', '3', '5']).map(Number);
const SHOT = 'docs/audit/cast-check.png';

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  console.log('\n════ 시전 인터럽트 감사 ════');
  console.log('층  시전창(초)  임계  보스HP   끊기 성공  못끊음  그로기(초)');
  let shot = false;
  for (const fl of FLOORS) {
    const p = await b.newPage({ viewport: { width: 960, height: 540 } });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
    await p.goto(`${BASE}/?test=1&bot=1`);
    await p.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'play');
    const R = await p.evaluate((f) => {
      Dungeon.floor = f; Dungeon.roomIndex = Dungeon.totalRooms; Dungeon.build('boss');
      const bs = Game.enemies.find((e) => e.isBoss);
      if (!bs) return null;
      bs.spawnT = 0;
      const out = { max: 0, need: 0, hp: bs.maxHp, broke: false, punished: false, groggy: 0, kbImmune: false };
      // ① 시전을 강제로 시작시킨다
      bs.castStart(Game);
      out.max = bs.castMax; out.need = bs.castNeed;
      // ② 무경직 확인 — 넉백을 크게 줘도 안 밀린다
      const x0 = bs.x;
      Game.damageEnemy(bs, 1, { x: 1, y: 0 }, { feel: true, kb: 900 });
      out.kbImmune = Math.abs(bs.x - x0) < 1 && Math.abs(bs.kbx) < 1;
      // ③ 임계까지 때리면 끊긴다
      let guard = 0;
      while (bs.state === 'cast' && guard++ < 400) Game.damageEnemy(bs, 3, { x: 0, y: 0 }, { feel: false, kb: 0 });
      out.broke = bs.state === 'groggy';
      out.groggy = bs.groggyT || 0;
      return out;
    }, fl);
    // ④ 못 끊으면 큰 게 나가는가 — 별도 조우에서 확인
    const R2 = await p.evaluate(() => {
      Dungeon.build('boss');
      const bs = Game.enemies.find((e) => e.isBoss);
      if (!bs) return false;
      bs.spawnT = 0;
      bs.castStart(Game);
      for (let i = 0; i < 300 && bs.state === 'cast'; i++) bs.update(1 / 60, Game);
      return bs.state === 'windup' && bs.attack && bs.attack.kind === 'uniq';
    });
    if (!shot) {
      // 시전 중 화면을 찍는다 — 게이지가 실제로 그려지는지 눈으로 본다
      await p.evaluate(() => { Dungeon.build('boss'); });
      await p.waitForTimeout(4200);   // 등장 카드가 지나갈 때까지 — 안 기다리면 게이지가 가려진다
      await p.evaluate(() => {
        const bs = Game.enemies.find((e) => e.isBoss);
        if (bs) { bs.spawnT = 0; bs.castStart(Game); bs.castDmg = bs.castNeed * 0.45; bs.castT = bs.castMax * 0.55; }
      });
      await p.waitForTimeout(140);
      await p.screenshot({ path: SHOT });
      shot = true;
    }
    await p.close();
    if (!R) { console.log(String(fl).padStart(2) + '  보스 없음'); continue; }
    console.log(String(fl).padStart(2) + String(R.max).padStart(11) + String(R.need).padStart(7)
      + String(R.hp).padStart(8) + String(R.broke).padStart(11) + String(R2).padStart(8)
      + String(R.groggy.toFixed(1)).padStart(11)
      + (R.kbImmune ? '  무경직 ✓' : '  ⚠ 넉백에 밀림')
      + (errs.length ? '  ⚠ ' + errs[0] : ''));
  }
  console.log('\n스크린샷: ' + SHOT);
  await b.close();
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
