// 전 층 쓸기 (v208b) — 사장: "계속 나에게 테스트를 맡겨야해?"
//
// 아니다. floor-audit 을 한 층씩 손으로 돌리다 1층만 보고 올렸고, 2층을 돌리자마자
// **무예고 34%** 가 나왔다. 층마다 위험의 종류가 다르니 층마다 새 구멍이 있다 —
// 한 층을 보고 「됐다」고 하는 것 자체가 틀린 절차였다.
//
// 이 도구는 1~10층을 **한 번에** 쓸어서 층별 무예고 출처와 방 리듬을 낸다.
// 사장께 F9 를 부탁하기 **전에** 내가 통과시켜야 하는 관문이다.
//   node tools/sweep.js [끝층] [방당초]
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const LAST = parseInt(process.argv[2] || '10', 10);
const SECS = parseFloat(process.argv[3] || '75');
const SEEDS = [2024, 777, 31337];

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await p.goto(`${BASE}/?test=1&bot=1`);
  await p.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'play');
  const R = await p.evaluate(([LAST, SECS, SEEDS]) => {
    const out = [];
    for (let FLOOR = 1; FLOOR <= LAST; FLOOR++) {
      const row = { f: FLOOR, why: {}, src: {}, kind: {} };
      const nRooms = Dungeon.roomsFor ? Dungeon.roomsFor(FLOOR) : 6;
      for (const seed of SEEDS) {
        Game.restart(seed); Game.state = 'play';
        Dungeon.floor = FLOOR;
        Dungeon.miniSeen = false;
        for (let ri = 1; ri <= nRooms; ri++) {
          Dungeon.roomIndex = ri;
          const kind = ri >= nRooms ? 'boss' : (ri % 3 === 0 ? 'elite' : 'combat');
          Game.enemies.length = 0; Game.pendingSpawns.length = 0; Game.markers.length = 0;
          Game.arrows.length = 0; Game.rings.length = 0; Game.firePatches.length = 0;
          Dungeon.build(kind);
          const pl = Game.player;
          pl.god = false; pl.maxHp = 9999; pl.hp = 9999;
          Game._hurtWhy = {}; Game._hurtSrc = {}; Game._tells = []; Game._tell = null;
          Game._dashAt = -9; Game._moveAt = -9;
          for (const e of Game.enemies) e.spawnT = 0;
          let t = 0, hits = 0, cleared = -1;
          const step = 1 / 60;
          while (t < SECS) {
            t += step;
            Game.tick(step);
            pl.hp = pl.maxHp;
            const live = Game.enemies.filter((e) => !e.dead);
            if (!live.length) {
              if (Game.pendingSpawns.length || Game.markers.length || t < 1.2) continue;
              if (cleared < 0) cleared = t;
              break;
            }
            let near = live[0], nd = 1e9;
            for (const e of live) { const d = Math.hypot(e.x - pl.x, e.y - pl.y); if (d < nd) { nd = d; near = e; } }
            const ang = Math.atan2(near.y - pl.y, near.x - pl.x);
            pl.x = near.x - Math.cos(ang) * (near.r + 26);
            pl.y = near.y - Math.sin(ang) * (near.r + 26);
            if (t - hits * 0.42 >= 0.42) {
              hits++;
              Game.damageEnemy(near, pl.currentAtk(), { x: Math.cos(ang), y: Math.sin(ang) }, { feel: false, kb: 0 });
            }
          }
          for (const k of Object.keys(Game._hurtWhy)) row.why[k] = (row.why[k] || 0) + Game._hurtWhy[k];
          for (const k of Object.keys(Game._hurtSrc || {})) row.src[k] = (row.src[k] || 0) + Game._hurtSrc[k];
          const kk = row.kind[kind] || (row.kind[kind] = { n: 0, sec: 0, stuck: 0 });
          kk.n++; kk.sec += cleared > 0 ? cleared : SECS; if (cleared < 0) kk.stuck++;
        }
      }
      out.push(row);
    }
    return out;
  }, [LAST, SECS, SEEDS]);
  await b.close();

  console.log(`\n════ 전 층 쓸기 1~${LAST}층 (씨앗 ${SEEDS.length}개 · 방 전수 · 방당 최대 ${SECS}초) ════`);
  console.log('\n층   전투    정예    보스   │ 무예고  반응없음   늦음   장판');
  let bad = 0;
  for (const r of R) {
    const S = (k) => { const g = r.kind[k]; return g ? (g.sec / g.n).toFixed(1) + (g.stuck ? '★' : '') : '-'; };
    const n = Object.values(r.why).reduce((a, c) => a + c, 0) || 1;
    const P = (k) => String(Math.round((r.why[k] || 0) / n * 100)).padStart(4) + '%';
    const unfairPct = Math.round((r.why['무예고'] || 0) / n * 100);
    if (unfairPct > 5) bad++;
    console.log(String(r.f).padStart(2) + S('combat').padStart(7) + S('elite').padStart(8) + S('boss').padStart(8)
      + '   │' + P('무예고') + P('반응없음') + P('늦음') + P('장판')
      + (unfairPct > 5 ? '   ← 억울한 피격' : ''));
  }
  console.log('\n■ 예고 없이 들어오는 경로 — **고칠 자리** (층: 출처 ×횟수)');
  let any = false;
  for (const r of R) {
    const un = Object.keys(r.src).filter((k) => k.startsWith('무예고'));
    if (!un.length) continue;
    any = true;
    console.log('  ' + String(r.f).padStart(2) + '층  ' + un.sort((a, c) => r.src[c] - r.src[a])
      .map((k) => k.split(' / ')[1] + '×' + r.src[k]).join(' · '));
  }
  if (!any) console.log('  ✓ 1~' + LAST + '층 전부 없음');
  console.log('\n판정: ' + (bad ? `무예고 5% 초과 ${bad}개 층 — **아직 올리면 안 된다**` : '전 층 통과'));
  if (errs.length) console.log('\n⚠ 에러 ' + errs.length + ': ' + errs[0]);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
