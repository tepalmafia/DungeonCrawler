// 한 층 전체 계측 (v208) — 사장: "지금 1층만 하고 있는거지? 1층 전체로 해줘"
//
// 종전 boss-ttk 는 **보스방 하나**만 봤다. 그런데 사장이 죽는 곳은 보스방만이 아니다 —
// 1층은 방 6개다. 잡몹방·정예방·우두머리방·보스방이 한 줄로 이어지고,
// 앞 방에서 깎인 하트로 다음 방에 들어간다. 층은 **연속된 하나의 경험**이다.
//
// 이 도구가 층 전체에서 재는 것:
//   ① 방마다 피격 원인 분포 + **출처** (어느 공격이 예고 없이 들어오는가)
//   ② 방마다 처치 시간 — 어디가 늘어지는가
//   ③ 층을 지나며 화력이 어떻게 자라는가 (보스 HP의 분모)
//   ④ 층 전체 소요 시간과 하트 잔량
//
//   node tools/floor-audit.js [층] [방당초]
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const FLOOR = parseInt(process.argv[2] || '1', 10);
const SECS = parseFloat(process.argv[3] || '45');

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await p.goto(`${BASE}/?test=1&bot=1`);
  await p.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'play');
  const R = await p.evaluate(([FLOOR, SECS]) => {
    const out = { rooms: [], total: { why: {}, src: {} }, floor: FLOOR, seeds: [] };
    const add = (dst, k) => { dst[k] = (dst[k] || 0) + 1; };
    const nRooms = Dungeon.roomsFor ? Dungeon.roomsFor(FLOOR) : 6;
    // 씨앗을 여러 개 굴려 방 구성 편차를 흡수한다 (한 씨앗은 한 표본일 뿐이다)
    for (const seed of [2024, 777, 31337, 5150]) {
      Game.restart(seed); Game.state = 'play';
      Dungeon.floor = FLOOR;
      // ★ v210b — **그 층에 맞는 몸**으로 잰다.
      //   1차엔 restart 직후 레벨 1·특성 0인 채로 8층을 쟀다. 8층 방 하나에 적 40기·
      //   우두머리 285HP인데 공격력 1이면 당연히 「못 끝냄」이 나온다 — 그건 방이 긴 게 아니라
      //   **8층에 1층 몸을 세워 놓은 것**이다. 저장소엔 이미 층별 기준 빌드(_cheatScaleToFloor)가
      //   있고 진짜 런으로 자가 보정된다. 안 쓰고 있었을 뿐이다
      if (Game._cheatScaleToFloor) Game._cheatScaleToFloor();
      // ★ 우두머리 등장은 게임이 정한다. 1차엔 내가 miniSeen 을 손으로 세워서
      //   정예방에서 우두머리를 **지워 버렸다** — 방이 빈약한 게 아니라 계기가 지운 것이다
      Dungeon.miniSeen = false;
      out.seeds.push(seed);
      for (let ri = 1; ri <= nRooms; ri++) {
        Dungeon.roomIndex = ri;
        // 방 종류는 문 선택으로 정해지므로 「그 층의 척추」를 그대로 쓴다 (v203 주석: 전투·정예).
        // 우두머리는 층당 1회 등장하므로 중간에 한 번 끼운다
        const kind = ri >= nRooms ? 'boss' : (ri % 3 === 0 ? 'elite' : 'combat');
        Game.enemies.length = 0; Game.pendingSpawns.length = 0; Game.markers.length = 0;
        Game.arrows.length = 0; Game.rings.length = 0; Game.firePatches.length = 0;
        Dungeon.build(kind);
        const pl = Game.player;
        pl.god = false; pl.maxHp = 9999; pl.hp = 9999;   // 죽지 않게 두고 **맞는 원인**만 모은다
        Game._hurtWhy = {}; Game._hurtSrc = {}; Game._tells = []; Game._tell = null;
        Game._dashAt = -9; Game._moveAt = -9;
        const atk0 = pl.currentAtk();
        for (const e of Game.enemies) e.spawnT = 0;
        let n0 = Game.enemies.filter((e) => !e.dead).length;
        // 명단을 남긴다 — 「정예방인데 3초에 끝난다」가 방이 쉬운 건지
        // **정예가 안 나온 건지**를 구분하려면 무엇이 나왔는지 봐야 한다
        const seen = new Set(), roster = [];
        const note = () => {
          for (const e of Game.enemies) {
            if (e.dead || e.neutral || seen.has(e)) continue;
            seen.add(e);
            roster.push((e.isBoss ? '보스:' : e.isMini ? '우두머리:' : e.elite ? '정예:' : '') + e.type
              + '(' + Math.round(e.maxHp) + ')');
          }
        };
        note();
        let t = 0, hits = 0, cleared = -1;
        const step = 1 / 60;
        while (t < SECS) {
          t += step;
          Game.tick(step);
          pl.hp = pl.maxHp;                       // 하트는 무제한, 원인만 센다
          note();
          const live = Game.enemies.filter((e) => !e.dead);
          n0 = Math.max(n0, live.length);
          // ★ 적은 pendingSpawns 로 **시간을 두고** 들어온다. 1차에 이걸 안 기다려서
          //   전투방이 「적 0기 · 0.0초」로 찍혔다 — 방이 쉬운 게 아니라 계기가 일찍 나간 것이다
          //   (v185·192·205·206·208에 이어 같은 실수: 소비자가 아니라 다른 시점을 쟀다)
          if (!live.length) {
            // 적이 들어오는 길은 **둘**이다: pendingSpawns 와 markers(등장 예고 자리).
            // 1차엔 markers 를 안 기다려서 정예방이 「정예 1 + 잡몹 1」로만 찍혔다 —
            // 실제 편성은 정예 1 + 잡몹 3 + 우두머리 1 이다. 방이 빈약한 게 아니라 계기가 일찍 나갔다
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
        const why = { ...Game._hurtWhy };
        for (const k of Object.keys(why)) for (let i = 0; i < why[k]; i++) add(out.total.why, k);
        for (const k of Object.keys(Game._hurtSrc || {})) out.total.src[k] = (out.total.src[k] || 0) + Game._hurtSrc[k];
        out.rooms.push({ seed, ri, kind, n: n0, atk: +atk0.toFixed(2), lv: Game.level,
          sec: +(cleared > 0 ? cleared : SECS).toFixed(1), cleared: cleared > 0, hits, why,
          roster: roster.join(' ') || '(없음)' });
      }
    }
    return out;
  }, [FLOOR, SECS]);
  await b.close();

  console.log(`\n════ ${R.floor}층 **전체** 계측 (씨앗 ${R.seeds.join('·')} · 방당 최대 ${SECS}초) ════`);
  console.log('\n■ 방별 — 어디가 늘어지고 어디서 맞는가');
  console.log('씨앗    방  종류        적  공격력  타수   소요(초)  피격 원인');
  const byKind = {};
  for (const r of R.rooms) {
    const w = Object.keys(r.why).sort((a, c) => r.why[c] - r.why[a]).map((k) => `${k}${r.why[k]}`).join(' ');
    const warn = !r.cleared ? '  ★ 못 끝냄' : '';
    console.log(String(r.seed).padStart(6) + String(r.ri).padStart(5) + '  ' + r.kind.padEnd(10)
      + String(r.n).padStart(3) + String(r.atk).padStart(8) + String(r.hits).padStart(6)
      + String(r.sec).padStart(10) + '  ' + w + warn);
    console.log('                     ' + r.roster);
    (byKind[r.kind] || (byKind[r.kind] = [])).push(r);
  }
  console.log('\n■ 종류별 평균 — 층의 리듬');
  for (const k of Object.keys(byKind)) {
    const g = byKind[k];
    const sec = g.reduce((a, c) => a + c.sec, 0) / g.length;
    const done = g.filter((x) => x.cleared).length;
    console.log('   ' + k.padEnd(10) + g.length + '방 · 평균 ' + sec.toFixed(1) + '초 · 정리 ' + done + '/' + g.length
      + (sec > 30 ? '   ← 늘어진다' : sec < 5 ? '   ← 너무 빨리 끝난다' : ''));
  }
  const secTotal = R.rooms.reduce((a, c) => a + c.sec, 0) / R.seeds.length;
  console.log('\n■ 층 전체 소요(최선) ' + secTotal.toFixed(0) + '초 = ' + (secTotal / 60).toFixed(1) + '분  (실플레이는 이동·회피로 1.5~2배)');

  console.log('\n■ 층 전체 피격 원인 — 난이도의 **질**');
  const wn = Object.values(R.total.why).reduce((a, c) => a + c, 0) || 1;
  const NOTE = { '무예고': '← 억울하다. 많으면 설계 결함', '반응없음': '← 못 봤거나 못 읽었다',
    '늦음': '← 배우는 중. 이게 많은 게 건강하다', '장판': '← 내 탓이 명확하다' };
  for (const k of Object.keys(R.total.why).sort((a, c) => R.total.why[c] - R.total.why[a]))
    console.log('   ' + k.padEnd(7) + String(R.total.why[k]).padStart(4) + '회 '
      + String(Math.round(R.total.why[k] / wn * 100)).padStart(3) + '%  ' + (NOTE[k] || ''));
  console.log('\n■ 원인별 출처 — **고칠 자리**');
  const sk = Object.keys(R.total.src).sort((a, c) => R.total.src[c] - R.total.src[a]);
  for (const k of sk.slice(0, 20)) console.log('   ' + String(R.total.src[k]).padStart(4) + '회  ' + k);
  const un = sk.filter((k) => /무예고/.test(k));
  if (un.length) console.log('\n   ⚠ 예고 없는 경로 ' + un.length + '종: ' + un.map((k) => k.split(' / ')[1]).join(' · '));
  else console.log('\n   ✓ 예고 없이 들어오는 경로 없음');
  if (errs.length) console.log('\n⚠ 에러 ' + errs.length + ': ' + errs[0]);
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
