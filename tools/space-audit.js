// 공간 계측 (v206) — 사장: "캐릭터 적들이 커져서 맵을 충분히 활용못하고 지나가기도 힘드네"
//
// v200에서 화면 크기를 r×3.5 로 통일했다. 그게 **덩치를 키웠다** —
// 방 크기는 그대로인데 적이 커지면 지나갈 틈이 사라진다.
// 이 도구는 「얼마나 큰가」가 아니라 **「지나갈 수 있는가」**를 잰다.
//   node tools/space-audit.js
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.goto(`${BASE}/?test=1&bot=1`);
  await p.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'play');
  const R = await p.evaluate(() => {
    const out = { rows: [], room: {}, occupancy: [], gaps: [] };
    const TSZ = 48;
    out.room = { cols: World.cols, rows: World.rows, w: World.cols * TSZ, h: World.rows * TSZ };
    // ① 개체별 화면 크기 — 몸 반경 r 과 실제 그려지는 높이
    const types = ['skeleton', 'shieldSkeleton', 'sniper', 'ghoul', 'golem', 'brute', 'warden', 'glutton'];
    for (const t of types) {
      // ★ 원본 스프라이트가 아니라 **실제 그리는 경로**(skin)를 잰다.
      //   1차에 Sprites[e.sprite] 를 그냥 읽어서 우두머리가 일반 몹과 같은 크기로 찍혔다 —
      //   크기를 반영하는 곳은 skin() 이다. 소비자를 재야 한다
      const meas = (ent, label) => {
        const img = ent.skin ? ent.skin(Sprites[ent.sprite]) : Sprites[ent.sprite];
        const ds = img.__ds || 2;
        out.rows.push({ t: label, r: Math.round(ent.r),
          screenH: Math.round(Sprites.bodyH(img) * ds), screenW: Math.round(img.width * ds) });
      };
      meas(createEnemy(t, 300, 200, false, 1), t);
      meas(createEnemy(t, 300, 200, true, 1), t + '(정예)');
      meas(createMiniboss(t, 300, 200, 1), t + '(우두머리)');
    }
    // ② 실제 방에서 **점유율**과 **최소 통로 폭** — 지나갈 수 있는가
    for (let trial = 0; trial < 8; trial++) {
      Dungeon.floor = 1 + (trial % 3);
      Dungeon.roomIndex = 1 + (trial % 4);
      Game.enemies.length = 0; Game.pendingSpawns.length = 0; Game.markers.length = 0;
      World.buildRoom('combat'); Game.onRoomBuilt('combat');
      for (let i = 0; i < 240; i++) Game.tick(1 / 60);
      const live = Game.enemies.filter((e) => !e.dead);
      // 걸어 다닐 수 있는 바닥 칸
      let floorTiles = 0;
      for (let y = 0; y < World.rows; y++) for (let x = 0; x < World.cols; x++) if (World.map[y][x] === 0) floorTiles++;
      // 적 몸이 덮는 칸 (반경 기준)
      const covered = new Set();
      for (const e of live) {
        const r = e.r + Game.player.r;                 // 플레이어가 통과하려면 이만큼 필요하다
        for (let y = 0; y < World.rows; y++) for (let x = 0; x < World.cols; x++) {
          if (World.map[y][x] !== 0) continue;
          const cx = x * 48 + 24, cy = y * 48 + 24 + World.offsetY;
          if (Math.hypot(cx - e.x, cy - e.y) < r) covered.add(x + ',' + y);
        }
      }
      out.occupancy.push({ f: Dungeon.floor, n: live.length,
        pct: Math.round(covered.size / Math.max(1, floorTiles) * 100) });
      // ③ 적 두 기 사이를 지나갈 수 있는가 — 가장 좁은 틈
      let minGap = 9999;
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        const d = Math.hypot(live[i].x - live[j].x, live[i].y - live[j].y);
        const gap = d - live[i].r - live[j].r;
        if (gap < minGap) minGap = gap;
      }
      if (live.length >= 2) out.gaps.push(Math.round(minGap));
    }
    out.playerR = Game.player.r;
    out.playerNeed = Game.player.r * 2;   // 플레이어가 지나가려면 이만큼의 틈이 필요하다
    return out;
  });
  await b.close();

  console.log('\n════ 공간 계측 — 「얼마나 큰가」가 아니라 「지나갈 수 있는가」 ════');
  console.log('방: ' + R.room.cols + '×' + R.room.rows + '칸 (' + R.room.w + '×' + R.room.h + 'px)'
    + ' · 플레이어 r' + R.playerR + ' (통과에 필요한 틈 ' + R.playerNeed + 'px)');
  console.log('\n■ 개체 크기');
  console.log('   종류                    r    화면높이  화면폭');
  for (const x of R.rows) console.log('   ' + x.t.padEnd(22) + String(x.r).padStart(3)
    + String(x.screenH).padStart(9) + String(x.screenW).padStart(8));
  console.log('\n■ 방 점유율 — 적 몸이 바닥의 몇 %를 막는가');
  for (const o of R.occupancy) console.log('   ' + o.f + '층 · 적 ' + String(o.n).padStart(2) + '기 → '
    + String(o.pct).padStart(3) + '%' + (o.pct > 30 ? '  ← 지나갈 곳이 없다' : ''));
  const g = R.gaps.sort((a, c) => a - c);
  console.log('\n■ 적 사이 최소 틈: ' + g.join(' · ') + 'px  (필요 ' + R.playerNeed + 'px)');
  const blocked = g.filter((v) => v < R.playerNeed).length;
  console.log('   → 통과 불가한 방 ' + blocked + '/' + g.length);
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
