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
// ★ v210b — 화력을 **하나의 값으로 가정하지 않는다.**
// 기준 빌드(_cheatScaleToFloor)는 2층에 공5.25 를 준다. 그런데 사장 실측 F9 는
// 같은 2층·같은 Lv6·특성 6장에 **공2.3** 이었다 — 치트가 공격 특성만 골라 뽑기 때문이다.
// 레벨1로 재면 너무 약하고 기준 빌드로 재면 너무 강하다. 진실은 사이에 있다.
// 그래서 **양 끝을 다 잰다**: 사장 화력(×0.45)과 봇 화력(×1.0). 둘 다 괜찮아야 통과다.
const ATK_MUL = parseFloat(process.env.ATK_MUL || '1');

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await p.goto(`${BASE}/?test=1&bot=1`);
  await p.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'play');
  const R = await p.evaluate(([LAST, SECS, SEEDS, ATK_MUL]) => {
    const out = [];
    for (let FLOOR = 1; FLOOR <= LAST; FLOOR++) {
      const row = { f: FLOOR, why: {}, src: {}, kind: {} };
      const nRooms = Dungeon.roomsFor ? Dungeon.roomsFor(FLOOR) : 6;
      for (const seed of SEEDS) {
        Game.restart(seed); Game.state = 'play';
        Dungeon.floor = FLOOR;
        // ★ v210b — **그 층에 맞는 몸**으로 잰다.
        //   1차엔 restart 직후 레벨 1·특성 0인 채로 8층을 쟀다. 8층 방 하나에 적 40기·
        //   우두머리 285HP인데 공격력 1이면 당연히 「못 끝냄」이 나온다 — 그건 방이 긴 게 아니라
        //   **8층에 1층 몸을 세워 놓은 것**이다. 저장소엔 이미 층별 기준 빌드(_cheatScaleToFloor)가
        //   있고 진짜 런으로 자가 보정된다. 안 쓰고 있었을 뿐이다
        if (Game._cheatScaleToFloor) Game._cheatScaleToFloor();
        if (ATK_MUL !== 1) {
          // buildAtk = 1 + (lv-1)*0.25 + bonusAtk … 목표 화력에 맞춰 bonusAtk 만 눌린다
          const pl0 = Game.player;
          const fixed = 1 + (Game.level - 1) * 0.25;
          pl0.bonusAtk = Math.max(0, (pl0.buildAtk() * ATK_MUL) - fixed);
        }
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
  // 가장 가까운 적에게 붙어서 쉬지 않고 때린다 (최선의 경우 = 하한 시간).
            // ★ v209b — 사장: "봇으로 테스트할때 바닥 함정을 잘피하도록해"
            //   종전엔 적 옆 **한 자리**로 순간이동시켰다. 그 자리가 용암·불길·저주 원 한복판이면
            //   플레이어를 불 속에 세워 놓고 「장판 79%」를 찍었다 — 봇이 못 피한 게 아니라
            //   내가 못 피하게 세워 놨다. 이제 적 주위를 한 바퀴 훑어 **안전한 사거리**를 고른다
            let near = live[0], nd = 1e9;
            for (const e of live) { const d = Math.hypot(e.x - pl.x, e.y - pl.y); if (d < nd) { nd = d; near = e; } }
            const reach = near.r + 26;
            let ang = Math.atan2(near.y - pl.y, near.x - pl.x);
            let bestH = 99, bestA = ang;
            for (let k = 0; k < 12; k++) {
              const a2 = ang + (k / 12) * Math.PI * 2;
              const sx = near.x - Math.cos(a2) * reach, sy = near.y - Math.sin(a2) * reach;
              if (World.isSolidAt(sx, sy)) continue;
              const h = Game.hazardAt ? Game.hazardAt(sx, sy, { margin: 6 }) : 0;
              if (h < bestH) { bestH = h; bestA = a2; }
              if (!h) break;
            }
            ang = bestA;
            pl.x = near.x - Math.cos(ang) * reach;
            pl.y = near.y - Math.sin(ang) * reach;
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
  }, [LAST, SECS, SEEDS, ATK_MUL]);
  await b.close();

  console.log(`\n════ 전 층 쓸기 1~${LAST}층 (씨앗 ${SEEDS.length}개 · 방 전수 · 방당 최대 ${SECS}초`
    + ` · 화력 ${ATK_MUL === 1 ? '기준(봇 실측)' : '×' + ATK_MUL + ' (사장 실측 F9 수준)'}) ════`);
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
