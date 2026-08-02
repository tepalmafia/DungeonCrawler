// ══════════════════════════════════════════════════════════════════════════
//  3D 샘플(web/3d) 검증 — 헤드리스 크로미움으로 실제로 굴려 본다.
//
//  사용법:  python3 tools/serve.py 8137 &   node tools/verify3d.js
//           ./tools/run-verify3d.sh          (서버 기동까지 알아서)
//
//  스크린샷은 docs/audit3d/ 에 남는다 — 룩은 눈으로 확인해야 한다.
// ══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137/3d';
const SHOTS = path.join(__dirname, '..', 'docs', 'audit3d');

const R = [];
const ok = (k, v, note = '') => {
  R.push({ k, v: !!v });
  console.log(`${v ? 'PASS' : 'FAIL'} ${k}${note ? ' — ' + note : ''}`);
};

async function shot(page, name) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name) });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    // 헤드리스에서 실제 GL 을 쓰려면 SwiftShader 를 강제해야 한다
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });

  // ── 시작 화면이 실제로 눌리는가 ──────────────────────────
  //
  // 이 검사는 사고를 겪고 추가했다. 상점 창(#shop)에 display:flex 를 주면서
  // [hidden] 규칙을 빠뜨렸더니, hidden 속성이 붙어 있는데도 창이 계속 떠서
  // 전체 화면을 덮는 배경이 클릭을 삼켰다 — **게임을 시작할 수 없었다.**
  //
  // 그래서 hidden 속성 값을 보지 않는다. 그건 이미 true 였다.
  // **시작 버튼 좌표의 최상위 요소가 무엇인가**를 본다. 무엇이 가리든 걸린다.
  await page.goto(`${BASE}/?seed=VERIFY`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('startBtn'), { timeout: 30000 });
  const gate = await page.evaluate(() => {
    const b = document.getElementById('startBtn').getBoundingClientRect();
    const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    const shown = [...document.querySelectorAll('#stage > div[hidden]')]
      .filter((e) => getComputedStyle(e).display !== 'none')
      .map((e) => e.id || e.className);
    return { topId: top ? (top.id || top.tagName) : null, shown };
  });
  ok('boot.startClickable', gate.topId === 'startBtn' && gate.shown.length === 0,
    `시작 버튼 위 최상위 = ${gate.topId}`
    + (gate.shown.length ? ` · hidden 인데 안 숨은 것: ${gate.shown.join(', ')}` : ''));

  // ── 부팅 ────────────────────────────────────────────────
  await page.goto(`${BASE}/?seed=VERIFY&autostart=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.G3 && window.G3.state === 'play' && window.G3.dungeon, { timeout: 30000 });
  await page.waitForTimeout(1200);
  // 이후 검사는 전투 결과가 아니라 시스템 동작을 보는 것이므로 죽지 않게 한다.
  // (2D 쪽 tools/verify.js 가 Game.player.god 을 켜는 것과 같은 취지)
  await page.evaluate(() => { window.G3.player.invuln = 1e9; });

  // 시작 지급품 — 다른 검사가 시간을 굴리면 연료가 타 버리므로 **여기서** 본다
  const startLantern = await page.evaluate(() => {
    const l = window.G3.player.lantern;
    return l ? { tier: l.tier, fuel: l.fuel, name: l.name } : null;
  });
  ok('light.startsWithLantern',
    !!startLantern && startLantern.tier === 0 && Math.round(startLantern.fuel) >= 235,
    startLantern ? `${startLantern.name} · 연료 ${Math.round(startLantern.fuel)}초` : '없음');

  ok('boot.noPageError', errs.length === 0, errs[0] || '오류 0건');
  ok('boot.version', await page.evaluate(() => window.G3.VERSION === 1));

  const info = await page.evaluate(() => ({
    walls: window.G3.level.wallMesh.count,
    torches: window.G3.level.torches.length,
    enemies: window.G3.enemies.length,
    rooms: window.G3.dungeon.rooms.length,
    lights: window.G3.lighting.pool.length,
  }));
  ok('level.built', info.walls > 100 && info.rooms >= 3, `벽 ${info.walls} · 방 ${info.rooms} · 횃불 ${info.torches}`);
  ok('enemies.spawned', info.enemies > 8, `${info.enemies}마리`);
  ok('lighting.poolFixed', info.lights === 8, `광원 풀 ${info.lights}개 (셰이더 재컴파일 방지)`);

  // 플레이어가 걸을 수 있는 칸 위에 있는가
  ok('player.onFloor', await page.evaluate(() => {
    const G = window.G3, dg = G.dungeon;
    const gx = Math.floor(G.player.pos.x / 2 + dg.w / 2);
    const gz = Math.floor(G.player.pos.z / 2 + dg.h / 2);
    return dg.isFloor(gx, gz);
  }));

  await shot(page, '01-spawn.png');

  // ── 풀링: 어그로가 개체별로만 붙는가 · 리쉬가 도는가 ─────────
  const pull = await page.evaluate(async () => {
    const G = window.G3;

    // 배치 간격.
    //
    // 예전엔 「최소 간격 > 4.5」였다. 조 편성(docs/ENEMY-AI.md §4)을 넣으면서
    // 그 기준이 무의미해졌다 — 조원은 **일부러** 2.6~5 안에 모여 있다.
    // 「세 마리가 모여 있다」는 그림을 만드는 것이 조 편성의 목적이다.
    //
    // 그래서 보는 것을 바꾼다: 최소값이 아니라 **중앙값**이 넓은가.
    // 몇 쌍이 붙어 있는 건 의도이고, 전체가 붙어 있으면 사고다.
    // 「한 마리만 끌어낼 수 있는가」의 진짜 보증은 아래 pull.noPackAggro 다 —
    // 뭉쳐 있어도 어그로가 안 번지면 설계는 살아 있다.
    // **배치 자리(home)로 잰다. 현재 위치(pos)가 아니다.**
    //
    // 배치는 `enemies.js` 가 조원끼리 2.6, 그 밖은 MIN_GAP 이상을 보장한다.
    // 그런데 여기서 pos 로 재면 스폰 뒤 배회·분리 밀림으로 움직인 결과를
    // 재게 되어, 같은 코드로 돌려도 2.8 이었다 2.2 였다 한다(실측). 그러면
    // 「배치가 깨졌다」와 「걸어다니다 가까워졌다」를 구분할 수 없다.
    // home 은 스폰 자리라 배치 규칙을 그대로 반영한다.
    const gaps = [];
    for (let i = 0; i < G.enemies.length; i++)
      for (let j = i + 1; j < G.enemies.length; j++)
        gaps.push(G.enemies[i].home.distanceTo(G.enemies[j].home));
    gaps.sort((a, b) => a - b);
    const minGap = gaps[0] ?? Infinity;
    const medGap = gaps[gaps.length >> 1] ?? Infinity;

    // 이웃이 있는 적을 하나 골라 그 옆에 선다
    const target = G.enemies.find((e) => !e.dead && !e.isBoss
      && G.enemies.some((o) => o !== e && !o.dead && o.pos.distanceTo(e.pos) < 12));
    if (!target) return { skipped: true, minGap };

    const before = G.enemies.map((e) => ({ e, d: 0, was: e.aggro }));
    G.player.pos.set(target.pos.x + 1.6, 0, target.pos.z);
    G.player.obj.position.copy(G.player.pos);
    for (const b of before) b.d = b.e.pos.distanceTo(G.player.pos);

    window.G3.headlessRun(0.5);

    // 새로 어그로가 붙은 적은 전부 「자기 어그로 반경 안」에 있던 놈이어야 한다.
    // 하나라도 반경 밖에서 붙었다면 무리 전파가 살아 있다는 뜻이다.
    const spread = before.filter((b) => !b.was && b.e.aggro && b.d > b.e.def.aggro + 1.5);
    const pulled = before.filter((b) => !b.was && b.e.aggro);

    // 리쉬: 집에서 멀어지면 귀환 상태로, 집에 닿으면 어그로가 풀린다.
    // 플레이어를 먼저 멀리 치워야 한다 — 옆에 서 있으면 해제되자마자 다시 붙는다.
    //
    // **던전 밖 좌표로 밀면 안 된다.** 게임이 불법 위치를 직전의 합법 위치로
    // 되돌리므로(nav.unstick 의 fallback), 결국 적 옆으로 다시 튕겨 온다.
    // 실제로 걸을 수 있는 가장 먼 방으로 옮긴다.
    {
      const dg2 = G.dungeon;
      let best = null, bd = -1;
      for (const room of dg2.rooms) {
        const d = (room.cx - target.pos.x / 2 - dg2.w / 2) ** 2 + (room.cy - target.pos.z / 2 - dg2.h / 2) ** 2;
        if (d > bd) { bd = d; best = room; }
      }
      const fx2 = (best.cx - dg2.w / 2 + 0.5) * 2, fz2 = (best.cy - dg2.h / 2 + 0.5) * 2;
      G.player.setPosition(fx2, fz2);
      G.player.lastGood = { x: fx2, z: fz2 };
    }
    const t = pulled[0] ? pulled[0].e : target;
    t.aggro = true;
    t.pos.set(t.home.x + t.def.leash + 6, 0, t.home.z);
    // 프레임 수가 아니라 **시뮬레이션 시간**으로 센다. rAF 로 세면 렌더 속도에
    // 따라 결과가 달라진다 — 고정 스텝을 넣자 실제로 이 검사가 깨졌다.
    window.G3.headlessRun(0.1);
    const returning = t.state === 'returning';
    t.pos.copy(t.home);
    window.G3.headlessRun(0.25);
    const released = !t.aggro;

    return { minGap, medGap, pulledCount: pulled.length, spreadCount: spread.length, returning, released };
  });
  ok('pull.spacing', pull.medGap > 20 && pull.minGap > 2.4,
    `최소 ${pull.minGap.toFixed(1)} (조원끼리) · 중앙값 ${pull.medGap.toFixed(1)} 유닛`);
  ok('pull.noPackAggro', pull.skipped || pull.spreadCount === 0,
    `끌린 ${pull.pulledCount}마리 전부 자기 어그로 반경 안 (무리 전파 ${pull.spreadCount}건)`);
  ok('pull.leashReturns', pull.skipped || pull.returning, '집에서 멀어지면 귀환');
  ok('pull.leashReleases', pull.skipped || pull.released, '귀환 완료 시 어그로 해제');

  // ── 전투 템포 (game/pace.js) ────────────────────────────
  // 배수가 플레이어·잡몹·보스에 「전부」 먹었는지, 그리고 선딜이 느려진 만큼
  // 지면 예고도 같이 늘어났는지 본다. 후자가 어긋나면 예고 없이 맞는다.
  const pace = await page.evaluate(async () => {
    const G = window.G3, P = G.player, pc = G.pace;
    const e = G.enemies.find((x) => !x.dead && !x.isBoss);

    // 이동: 정의값 × 배수인가
    const enemyMove = Math.abs(e.speed - e.def.speed * pc.MOVE_SCALE) < 1e-6;
    const playerBase = P.speed / (1 + P.bonus.speed / 100);
    const playerMove = Math.abs(playerBase - 6.2 * pc.MOVE_SCALE) < 1e-6;

    // 공격: 무기·장비·레벨 보정을 걷어내면 배수만 남아야 한다
    const lv = P.level - 1;
    const atkScale = P.attackSpeed / (P.bonus.weaponSpeed * (1 + P.bonus.aspd / 100) * (1 + lv * 0.012));
    const playerAtk = Math.abs(atkScale - pc.ATTACK_SCALE) < 1e-6;

    // 선딜을 실제로 재 본다 — windup 진입부터 타격까지 몇 초 걸리는가
    const inv0 = P.invuln;
    P.invuln = 1e9;
    P.setPosition(e.pos.x + e.def.range * 0.5, e.pos.z);
    e.aggro = true; e.state = 'windup'; e.stateT = 0; e.attackCd = 0;
    let secs = 0;
    for (let f = 0; f < 600 && e.state === 'windup'; f++) { e.update(1 / 60, G); secs += 1 / 60; }
    P.invuln = inv0;
    const wantWindup = e.def.windup * pc.ATTACK_TIME;
    return {
      enemyMove, playerMove, playerAtk,
      scale: pc.MOVE_SCALE, atkScale,
      secs, wantWindup, windupOk: Math.abs(secs - wantWindup) < 0.04,
      enemyKey: e.def.key,
    };
  });
  ok('pace.moveScaled', pace.enemyMove && pace.playerMove,
    `이동 ×${pace.scale} — 플레이어·${pace.enemyKey} 모두 적용`);
  ok('pace.attackScaled', pace.playerAtk, `공격 ×${pace.atkScale.toFixed(3)}`);
  ok('pace.windupMatchesTelegraph', pace.windupOk,
    `선딜 실측 ${pace.secs.toFixed(2)}초 (예고 링 ${pace.wantWindup.toFixed(2)}초) — 어긋나면 예고 없이 맞는다`);

  // 이후 이동 검사가 영향을 받지 않도록 어그로를 정리한다
  await page.evaluate(() => {
    const G = window.G3, dg = G.dungeon;
    for (const e of G.enemies) { e.aggro = false; e.state = 'idle'; }
    const [sx, sz] = [(dg.spawn.gx - dg.w / 2 + 0.5) * 2, (dg.spawn.gz - dg.h / 2 + 0.5) * 2];
    G.player.setPosition(sx, sz);
  });

  // ── 클릭 이동 + 벽 통과 금지 ──────────────────────────────
  const move = await page.evaluate(async () => {
    const G = window.G3, dg = G.dungeon;
    const before = { x: G.player.pos.x, z: G.player.pos.z };
    // 도달 가능한 먼 지점을 하나 고른다
    const room = dg.rooms.find((r) => r !== dg.startRoom) || dg.rooms[0];
    const tx = (room.cx - dg.w / 2 + 0.5) * 2, tz = (room.cy - dg.h / 2 + 0.5) * 2;
    G.player.moveTo(dg, tx, tz);
    const hadPath = G.player.path.length > 0;
    let insideWall = 0;
    for (let i = 0; i < 260; i++) {
      window.G3.headlessRun(1 / 60);
      const gx = Math.floor(G.player.pos.x / 2 + dg.w / 2);
      const gz = Math.floor(G.player.pos.z / 2 + dg.h / 2);
      if (!dg.isFloor(gx, gz)) insideWall++;
    }
    const after = { x: G.player.pos.x, z: G.player.pos.z };
    return { hadPath, insideWall, moved: Math.hypot(after.x - before.x, after.z - before.z) };
  });
  // ── 회귀: 클릭이 씹히지 않는가 · 벽에 박혀도 빠져나오는가 ──────
  // 예전엔 repathCd 하나를 홀드이동·추격·벽끼임이 공유해서, 추격 중에 누른
  // 클릭이 통째로 버려졌다(= 클릭했는데 제자리에 서 있는 증상).
  const clickFix = await page.evaluate(async () => {
    const G = window.G3, P = G.player, dg = G.dungeon;
    const CELL = 2;
    const g2w = (gx, gz) => [(gx - dg.w / 2 + 0.5) * CELL, (gz - dg.h / 2 + 0.5) * CELL];
    const w2g = (x, z) => [Math.floor(x / CELL + dg.w / 2), Math.floor(z / CELL + dg.h / 2)];

    // 1) 타이머가 용도별로 분리돼 있는가
    const split = ['repathCd', 'holdRepathCd', 'chaseRepathCd'].every((k) => typeof P[k] === 'number');

    // 2) 추격 타이머가 돌고 있어도 새 목적지 명령이 즉시 반영되는가
    const floors = [];
    for (let gz = 1; gz < dg.h - 1; gz++)
      for (let gx = 1; gx < dg.w - 1; gx++) if (dg.at(gx, gz) === 1) floors.push([gx, gz]);
    const [sx, sz] = g2w(dg.spawn.gx, dg.spawn.gz);
    P.setPosition(sx, sz);
    P.chaseRepathCd = 0.16;
    P.repathCd = 0.25;
    let far = floors[0], best = -1;
    for (const f of floors) {
      const [fx, fz] = g2w(f[0], f[1]);
      const d = Math.hypot(fx - sx, fz - sz);
      if (d > best && d < 30) { best = d; far = f; }
    }
    const [tx, tz] = g2w(far[0], far[1]);
    P.moveTo(dg, tx, tz);
    const pathedWhileBusy = P.path.length > 0;

    // 3) 벽 한가운데에 박혀도 바닥으로 빠져나오는가
    const wallCells = [];
    for (let gz = 2; gz < dg.h - 2; gz++)
      for (let gx = 2; gx < dg.w - 2; gx++) if (dg.at(gx, gz) === 2) wallCells.push([gx, gz]);
    let trapped = 0, tried = 0;
    for (let i = 0; i < 20 && i < wallCells.length; i++) {
      const c = wallCells[(i * 7919) % wallCells.length];
      const [wx, wz] = g2w(c[0], c[1]);
      P.setPosition(wx, wz);
      tried++;
      let escaped = false;
      for (let f = 0; f < 30; f++) {
        P.update(1 / 60, G);
        const [gx, gz] = w2g(P.pos.x, P.pos.z);
        if (dg.at(gx, gz) === 1) { escaped = true; break; }
      }
      if (!escaped) trapped++;
    }
    P.setPosition(sx, sz);
    return { split, pathedWhileBusy, trapped, tried };
  });
  ok('move.timersSplit', clickFix.split, '홀드이동·추격·벽끼임 타이머 분리');
  ok('move.clickNotDropped', clickFix.pathedWhileBusy, '추격 쿨다운 중에도 새 클릭이 즉시 반영');
  ok('move.unstickFromWall', clickFix.trapped === 0, `벽 안 ${clickFix.tried}곳 중 갇힘 ${clickFix.trapped}`);

  // ── 회귀: 아무 데나 연속으로 클릭해도 절대 멈춰 있지 않는가 ──────
  // 「경로를 든 채 1초 이상 진척 0」이 한 번이라도 있으면 실패.
  // 벽 클릭·모서리 걸림을 일부러 섞는다.
  const stress = await page.evaluate(async () => {
    const G = window.G3, dg = G.dungeon, P = G.player, CELL = 2;
    const g2w = (gx, gz) => [(gx - dg.w / 2 + 0.5) * CELL, (gz - dg.h / 2 + 0.5) * CELL];
    let sd = 987654321;
    const rnd = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
    const cells = [];
    for (let gz = 1; gz < dg.h - 1; gz++)
      for (let gx = 1; gx < dg.w - 1; gx++) if (dg.at(gx, gz) !== 0) cells.push([gx, gz]);

    const [sx, sz] = g2w(dg.spawn.gx, dg.spawn.gz);
    P.setPosition(sx, sz);
    P.stuckEvents = { skipWaypoint: 0, unsmooth: 0, giveUp: 0 };
    let stalls = 0, cmds = 0;
    for (let i = 0; i < 150; i++) {
      const c = cells[Math.floor(rnd() * cells.length)];
      let [tx, tz] = g2w(c[0], c[1]);
      tx += (rnd() - 0.5) * 1.8; tz += (rnd() - 0.5) * 1.8;
      P.moveTo(dg, tx, tz);
      cmds++;
      let noProgress = 0, last = { x: P.pos.x, z: P.pos.z };
      // 프레임 예산은 「거리」 기준이어야 한다 — 이동 속도를 낮추면(pace.js)
      // 240프레임으로는 경로를 다 못 걸어서, 끼임을 만들어 보기도 전에 시험이
      // 끝나 버린다. 속도 배수로 나눠 같은 거리를 보장한다.
      const FRAMES = Math.ceil(240 / (window.G3.pace?.MOVE_SCALE ?? 1));
      for (let f = 0; f < FRAMES; f++) {
        P.update(1 / 60, G);
        const moved = Math.hypot(P.pos.x - last.x, P.pos.z - last.z);
        last = { x: P.pos.x, z: P.pos.z };
        if (P.path.length > 0 && moved < 0.003) noProgress++; else noProgress = 0;
        if (noProgress >= 60) { stalls++; break; }
        if (!P.path.length) break;
      }
    }
    P.setPosition(sx, sz);
    return { stalls, cmds, ev: P.stuckEvents, armed: !!P.stuckEvents };
  });
  ok('move.noStall', stress.stalls === 0, `클릭 ${stress.cmds}회 중 멈춤 ${stress.stalls}회`);
  ok('move.stuckBreakerWorks',
    stress.ev.skipWaypoint + stress.ev.unsmooth + stress.ev.giveUp > 0,
    `탈출 발동 ${JSON.stringify(stress.ev)} — 0이면 시험이 그 상황을 못 만든 것이다`);

  // ── 소리가 시뮬레이션을 멈추지 않는가 ────────────────────
  //
  // 실제로 겪었다: 타격음에 겹을 하나 더하면서 거리 감쇠 vol 을 gain 에
  // **곱해 넣었다.** tone/noise 는 `vol <= 0.02` 면 아예 안 울리는데 그 관문을
  // 지나쳐 gain 0 으로 exponentialRampToValueAtTime(0) 에 도달했고, Web Audio 가
  // 예외를 던져 **게임 루프가 통째로 죽었다.** 먼 적을 함정이 때리는 순간이었다.
  //
  // 소리는 연출이라 안 나도 그만이지만, **예외를 던지면 그건 연출이 아니다.**
  // 그래서 모든 효과음을 vol 0 과 1 로 한 번씩 울려 보고 아무것도 안 터지는지 본다.
  const audio = await page.evaluate(async () => {
    const A = await import('./js/core/audio.js');
    const kinds = ['skeleton', 'ghoul', 'archer', 'golem', 'lord', 'nosuchkind'];
    const bad = [];
    const call = (label, fn) => { try { fn(); } catch (e) { bad.push(`${label}: ${e.message.slice(0, 80)}`); } };
    for (const v of [0, 0.001, 1]) {
      for (const k of kinds) {
        call(`enemyHit(${k},${v})`, () => A.Sfx.enemyHit(k, false, v));
        call(`enemyHit!(${k},${v})`, () => A.Sfx.enemyHit(k, true, v));
        call(`enemyAttack(${k},${v})`, () => A.Sfx.enemyAttack(k, v));
        call(`enemyAggro(${k},${v})`, () => A.Sfx.enemyAggro(k, v));
        call(`enemyDie(${k},${v})`, () => A.Sfx.enemyDie(k, v));
      }
      call(`step(${v})`, () => A.Sfx.step({ vol: v, heavy: 1, right: true, wet: true }));
      call(`grunt(${v})`, () => A.Sfx.playerGrunt(v));
    }
    for (const f of ['swing', 'hit', 'dash', 'nova', 'meteor', 'potion', 'levelUp',
      'portal', 'bossRoar', 'death', 'victory', 'cast', 'playerHurt'])
      call(f, () => A.Sfx[f]());
    return bad;
  });
  ok('audio.neverThrows', audio.length === 0,
    audio.length ? audio.slice(0, 3).join(' | ') : '전 효과음 × vol 0/0.001/1 — 예외 0건');

  // ── 길목 함정이 실제로 놓이고, 실제로 막는가 ──────────────
  //
  // 층 표는 길목 함정을 층당 3~8개로 적어 뒀는데 **한 개도 안 놓이고 있었다.**
  // 조건이 「양옆이 바로 벽인 칸」이었고 복도 폭이 2칸이라 그런 칸이 층 전체에
  // 없었다 — 오류도 로그도 없이 설계 절반이 죽어 있었다. 표에 숫자를 적는 것과
  // 그 숫자가 화면에 나오는 것은 다른 일이라, 그 사이를 검사가 이어야 한다.
  //
  // 그리고 **놓였다고 막히는 것도 아니다.** 폭 2칸 복도에서 한 칸만 놓으면
  // 옆 차선으로 지나간다(차선 간격 2.0 유닛 · 가시 반경 1.5 · 화살 1.2).
  // 그래서 개수와 「단면이 다 막혔는가」를 같이 본다.
  const choke = await page.evaluate(async () => {
    const dun = await import('./js/world/dungeon.js');
    const fl = await import('./js/world/floors.js');
    const tr = await import('./js/world/traps.js');
    const RAD = {};
    for (const [k, v] of Object.entries(tr.TRAP_KINDS || {})) RAD[k] = v.radius;
    const rows = [];
    for (const f of [1, 5, 9]) {
      const dg = dun.generate(f, `VERIFY-CHOKE-${f}`);
      const ct = dg.traps.filter((t) => t.choke);
      // 반경이 옆 차선(2.0)에 못 닿는데 짝도 없으면 그 길목은 그냥 지나갈 수 있다
      const bypass = ct.filter((t) => (RAD[t.kind] ?? 1.5) < 2.0
        && !dg.traps.some((o) => o !== t && Math.abs(o.gx - t.gx) + Math.abs(o.gz - t.gz) === 1)).length;
      rows.push({ f, want: fl.floorDef(f).chokeTraps, placed: ct.length, bypass });
    }
    return rows;
  });
  ok('trap.chokesPlaced', choke.every((r) => r.placed > 0),
    choke.map((r) => `${r.f}층 표${r.want}길목→${r.placed}개`).join(' · ') + ' (0이면 조건이 죽은 것이다)');
  ok('trap.chokesBlockFullWidth', choke.every((r) => r.bypass === 0),
    '그냥 지나갈 수 있는 길목 ' + choke.map((r) => `${r.f}층 ${r.bypass}`).join(' · '));

  // ── 엄폐물 우회 (docs/ENEMY-AI.md §6-3) ─────────────────
  // 벽을 사이에 두고 마주 세운 뒤, 사선을 여는 데 걸리는 시간을 잰다.
  // 근접은 원래도 A* 로 돌아갔다 — 이 검사가 지키는 것은 **원거리**다.
  // 궁수는 예전에 사선이 막히면 물러나기만 하며 영영 못 쐈다.
  const flank = await page.evaluate(async () => {
    const G = window.G3, P = G.player, dg = G.dungeon;
    const nav = await import('./js/world/nav.js');
    const dun = await import('./js/world/dungeon.js');
    P.invuln = 1e9;

    // 자리 고르기 — 「양쪽이 바닥인 한 칸 벽」을 찾는다.
    //
    // ★ **돌아갈 길이 있는지까지 봐야 한다.** 예전엔 「벽이고 양쪽이 바닥이고
    //   사선이 막힌다」만 봤다. 층이 셋일 때는 우연히 늘 통했는데, 1층에
    //   보스방과 봉인된 금고가 생기자 **첫 후보가 길이 없는 칸**이 됐다 —
    //   적이 40초 동안 0유닛 움직였고(실측) 검사는 「우회 실패」로 빨개졌다.
    //   게임이 퇴행한 게 아니라 검사가 엉뚱한 자리를 잡은 것이다.
    //
    //   그래서 후보마다 c→a 경로를 실제로 뽑아 보고, 길이 없거나 너무 길면
    //   다음 후보로 넘어간다. 이러면 검사가 재는 것이 「우회 능력」으로 좁혀진다.
    // 「한 칸 벽을 사이에 둔 정확한 두 칸」을 찾던 방식은 못 쓴다.
    // 복도 폭이 2칸이라 그런 자리가 층 전체에 **한 개**밖에 없고, 1층에
    // 보스방·금고가 생기자 그 하나마저 길이 없는 칸이 됐다. 그대로 두면
    // 검사가 「상황을 못 만듦」으로 **조용히 통과**한다 — 그건 검사가 아니다.
    //
    // 재려는 것은 원래부터 「사선이 막혔을 때 돌아가는가」이지 벽 두께가
    // 아니다. 그래서 조건을 그것으로 바꾼다:
    //   · 서로 사선이 막힌 두 바닥 칸
    //   · 걸어서 갈 수 있고(경로 존재), 8초 안에 닿을 만한 거리(≤ MAX_DETOUR)
    //   · 너무 가깝지도 멀지도 않게 (직선 4~14칸)
    // 후보가 여럿이면 **가장 짧은 우회**를 고른다 — 검사가 매번 같은 난이도를
    // 재도록. 그리고 후보 수를 같이 뱉어 「몇 개 중에 골랐나」가 보이게 한다.
    const MAX_DETOUR = 26;          // 격자 칸. 초당 약 1.5칸 × 8초 = 12칸이 실사용선
    let setup = null, cand = 0;
    for (let az = 2; az < dg.h - 2; az++) {
      for (let ax = 2; ax < dg.w - 2; ax++) {
        if (dg.at(ax, az) !== 1) continue;
        for (const [dx, dz] of [[6, 0], [0, 6], [8, 0], [0, 8], [5, 5], [5, -5]]) {
          const c = [ax + dx, az + dz];
          if (c[0] < 2 || c[1] < 2 || c[0] >= dg.w - 2 || c[1] >= dg.h - 2) continue;
          if (dg.at(c[0], c[1]) !== 1) continue;
          if (nav.lineOfSight(dg, ax, az, c[0], c[1])) continue;   // 막혀 있어야 한다
          cand++;
          const path = nav.findPath(dg, c[0], c[1], ax, az);
          if (!path || path.length > MAX_DETOUR) continue;
          if (setup && path.length >= setup.detour) continue;
          setup = { a: [ax, az], c, detour: path.length };
        }
      }
    }
    // **못 찾으면 실패다.** skipped 로 통과시키면 검사가 무력해진다.
    if (!setup) return { noSpot: true, cand };

    const [px, pz] = dun.gridToWorld(setup.a[0], setup.a[1], dg.w, dg.h);
    const [ex, ez] = dun.gridToWorld(setup.c[0], setup.c[1], dg.w, dg.h);
    P.setPosition(px, pz);

    const out = {};
    for (const kind of ['skeleton', 'archer']) {
      const e = G.enemies.find((x) => !x.dead && !x.isBoss && x.def.key === kind);
      if (!e) { out[kind] = null; continue; }
      // **원상복구할 것을 먼저 적어 둔다.** 검사가 게임 상태를 바꾼 채로
      // 끝나면 뒤의 검사가 엉뚱하게 깨진다 — 실제로 그렇게 당했다.
      const save = {
        hp: e.hp, maxHp: e.maxHp, aggro: e.aggro, state: e.state,
        px: e.pos.x, pz: e.pos.z, hx: e.home.x, hz: e.home.z,
      };
      e.pos.set(ex, 0, ez);
      e.home.set(ex, 0, ez);
      e.hp = e.maxHp = 1e9;
      e.aggro = true; e.state = 'chase'; e.path.length = 0;
      e.flankTarget = null; e.flankCd = 0;
      let opened = false, t = 0;
      for (let i = 0; i < 60 * 8 && !opened; i++) {
        e.update(1 / 60, G); t += 1 / 60;
        const [agx, agz] = dun.worldToGrid(e.pos.x, e.pos.z, dg.w, dg.h);
        const [bgx, bgz] = dun.worldToGrid(P.pos.x, P.pos.z, dg.w, dg.h);
        if (nav.lineOfSight(dg, agx, agz, bgx, bgz)) opened = true;
      }
      out[kind] = { opened, sec: +t.toFixed(2) };
      e.hp = save.hp; e.maxHp = save.maxHp;
      e.aggro = save.aggro; e.state = save.state;
      e.pos.set(save.px, 0, save.pz);
      e.home.set(save.hx, 0, save.hz);
      e.path.length = 0;
      e.flankTarget = null;
    }
    out.detour = setup.detour;      // 몇 칸 돌아가야 했는지 — 검사가 뭘 쟀는지 보이게
    out.cand = cand;
    return out;
  });
  ok('ai.flanksAroundCover',
    !flank.noSpot && !!flank.archer && flank.archer.opened && flank.archer.sec < 8,
    flank.noSpot ? `★ 엄폐 상황을 못 만듦 — 후보 ${flank.cand}개. 검사가 아무것도 안 쟀다`
      : `우회 ${flank.detour}칸(후보 ${flank.cand}개) · 궁수 ${flank.archer ? flank.archer.sec + '초' : '없음'}`
        + ` · 해골 ${flank.skeleton ? flank.skeleton.sec + '초' : '없음'}`
        + ' — 막히면 돌아가야 한다');

  // ── 벽 너머로 때리지 않는가 ──────────────────────────────
  // 지금까지 피해 판정이 거리와 각도만 봤다. 몸은 벽을 안 지나가는데
  // **피해만 지나갔다.** 이동 관통과 다른 축이라 따로 잡는다.
  const wallDmg = await page.evaluate(async () => {
    const G = window.G3, P = G.player, dg = G.dungeon;
    const cm = await import('./js/game/combat.js');
    const nav = await import('./js/world/nav.js');
    const dun = await import('./js/world/dungeon.js');

    // 벽을 사이에 둔 바닥-벽-바닥 삼중항
    let setup = null;
    for (let gz = 2; gz < dg.h - 2 && !setup; gz++) {
      for (let gx = 2; gx < dg.w - 2; gx++) {
        if (dg.at(gx, gz) !== 2) continue;
        for (const [dx, dz] of [[1, 0], [0, 1]]) {
          const a = [gx - dx, gz - dz], c = [gx + dx, gz + dz];
          if (dg.at(a[0], a[1]) !== 1 || dg.at(c[0], c[1]) !== 1) continue;
          if (nav.lineOfSight(dg, a[0], a[1], c[0], c[1])) continue;
          setup = { a, c };
          break;
        }
        if (setup) break;
      }
    }
    if (!setup) return { skipped: true };

    const e = G.enemies.find((x) => !x.dead && !x.isBoss);
    if (!e) return { skipped: true };
    const save = { hp: e.hp, maxHp: e.maxHp, px: e.pos.x, pz: e.pos.z, aggro: e.aggro, st: e.state };
    e.hp = e.maxHp = 1e9;

    const [ax, az] = dun.gridToWorld(setup.a[0], setup.a[1], dg.w, dg.h);
    const [cx, cz] = dun.gridToWorld(setup.c[0], setup.c[1], dg.w, dg.h);

    // 벽을 사이에 두고 — 안 맞아야 한다
    P.setPosition(ax, az);
    e.pos.set(cx, 0, cz);
    const blocked = cm.hitEnemy(G, e, 50);

    // 같은 칸 옆에 나란히 — 맞아야 한다 (검사가 늘 0을 뱉는 게 아님을 보인다)
    e.pos.set(ax + 1.0, 0, az);
    const open = cm.hitEnemy(G, e, 50);

    e.hp = save.hp; e.maxHp = save.maxHp;
    e.pos.set(save.px, 0, save.pz);
    e.aggro = save.aggro; e.state = save.st;
    return { blocked, open };
  });
  ok('combat.noDamageThroughWalls',
    wallDmg.skipped || (wallDmg.blocked === 0 && wallDmg.open > 0),
    wallDmg.skipped ? '엄폐 상황을 못 만듦'
      : `벽 너머 ${wallDmg.blocked} · 트인 곳 ${wallDmg.open}`);

  // ── 앰비언스: 사건이 전부 예외 없이 도는가 ────────────────
  // 물방울 4~13초, 비명 38~95초 간격이라 그냥 두면 버그가 한참 뒤에 드러난다.
  // 소리는 헤드리스에서 못 듣지만 「터지지 않는가」는 여기서 잡을 수 있다.
  const amb = await page.evaluate(async () => {
    const A = await import('./js/core/audio.js');
    A.resume();
    const fired = [], failed = [];
    for (const [key, spec] of Object.entries(A.AMBIENT_EVENTS)) {
      try { spec[2](true); spec[2](false); fired.push(key); }
      catch (e) { failed.push(key + ': ' + e.message); }
    }
    // 테마별 기동·정지도 새는 곳 없이 도는가
    const themes = [];
    for (const t of ['crypt', 'flood', 'throne']) {
      try { A.stopAmbient(); A.startAmbient(t); A.stopAmbient(); themes.push(t); }
      catch (e) { failed.push(t + ': ' + e.message); }
    }
    return { fired, failed, themes };
  });
  ok('audio.ambientEventsRun', amb.failed.length === 0 && amb.fired.length >= 5,
    `사건 ${amb.fired.join('·')} · 테마 ${amb.themes.length}종` + (amb.failed[0] ? ` · 실패 ${amb.failed[0]}` : ''));

  // ── HUD 배치: 구슬이 단축키 양옆인가 · 단축키가 두 줄인가 ─────
  const hud = await page.evaluate(async () => {
    const P = window.G3.player;
    P.hp = P.maxHp * 0.4; P.mp = P.maxMp * 0.25;
    await new Promise((r) => requestAnimationFrame(r));
    const box = (sel) => { const b = document.querySelector(sel).getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    const hp = box('#orbHp'), mp = box('#orbMp'), bar = box('#skillbar');
    const rows = [...document.querySelectorAll('.skillrow')];
    const belt = [...document.querySelectorAll('#beltSlots .skill')];
    // 게이지는 「내가 넣은 값」이 아니라 **읽는 시점의 실제 스탯**과 맞아야 한다.
    // 마나는 매 프레임 자연 회복하므로 고정값과 비교하면 안 된다.
    const hpFill = parseFloat(document.querySelector('#orbHp .fill').style.height);
    const mpFill = parseFloat(document.querySelector('#orbMp .fill').style.height);
    const hpWant = (P.hp / P.maxHp) * 100, mpWant = (P.mp / P.maxMp) * 100;
    return {
      // 「양옆에 있는가」는 **중심**으로 본다. 디아블로2 배치에서는 돌판이
      // 구슬 뒤로 파고들어 몇 픽셀 겹치는데, 그건 의도한 것이지 어긋난 게 아니다.
      // 가장자리로 재면 그 겹침이 실패로 잡힌다 (실측 407 vs 404).
      hpLeft: hp.x + hp.w / 2 < bar.x,
      mpRight: mp.x + mp.w / 2 > bar.x + bar.w,
      // 구슬은 디아블로2 처럼 돌판에 **걸쳐 내려온다.** 정확히 같은 높이가 아니라
      // 「같은 띠 안에 있는가」를 본다 — 세로 중심이 60px 안이면 한 덩어리로 읽힌다.
      sameRow: Math.abs((hp.y + hp.h / 2) - (bar.y + bar.h / 2)) < 60,
      rows: rows.length,
      perRow: rows.map((r) => r.children.length),
      beltCount: belt.length,
      hpFill, mpFill, hpWant, mpWant,
      hpOk: Math.abs(hpFill - hpWant) < 1.5,
      mpOk: Math.abs(mpFill - mpWant) < 1.5,
    };
  });
  ok('hud.orbsFlankHotkeys', hud.hpLeft && hud.mpRight && hud.sameRow,
    '체력·마나 구슬이 단축바 양옆 같은 띠에');
  // 예전엔 「두 줄 × 4칸」이었다. 디아블로2 배치로 바꾸면서 스킬은 한 줄,
  // 물약은 **벨트**로 따로 뺐다 — 스킬과 소모품은 성격이 다르다
  // (스킬은 마나·쿨다운, 물약은 개수). 그래서 보는 것도 바꾼다.
  ok('hud.skillsAndBelt', hud.rows === 1 && hud.perRow[0] === 4 && hud.beltCount === 4,
    `스킬 ${hud.perRow.join('/')}칸 · 벨트 ${hud.beltCount}칸`);
  ok('hud.orbsReflectStats', hud.hpOk && hud.mpOk,
    `체력 게이지 ${hud.hpFill.toFixed(1)}% (실제 ${hud.hpWant.toFixed(1)}%) · `
    + `마나 ${hud.mpFill.toFixed(1)}% (실제 ${hud.mpWant.toFixed(1)}%)`);

  // ── 아이템 드랍 사운드 ────────────────────────────────────
  const dropSfx = await page.evaluate(async () => {
    const mod = await import('./js/core/audio.js');
    const exists = typeof mod.Sfx.itemDrop === 'function';
    let calls = 0;
    const orig = mod.Sfx.itemDrop;
    mod.Sfx.itemDrop = (...a) => { calls++; return orig.apply(mod.Sfx, a); };
    const im = await import('./js/game/items.js');
    const rm = await import('./js/core/rng.js');
    const G = window.G3;
    const before = G.drops.length;
    // main.js 의 dropItem 을 태우려면 적을 죽여야 한다 — 대신 같은 경로를 직접 부른다
    const it = im.rollItem(rm.makeRng('SFX'), 1, 0, { slot: 'ring' });
    const d = new im.Drop(G.scene, it, G.player.pos.clone());
    G.drops.push(d);
    mod.Sfx.itemDrop(it.rarity);
    mod.Sfx.itemDrop = orig;
    return { exists, calls, added: G.drops.length - before };
  });
  ok('audio.itemDropExists', dropSfx.exists && dropSfx.calls === 1, '떨어질 때 「털썩」 재생 경로 존재');
  ok('audio.itemDropWiredIn',
    await page.evaluate(async () => {
      const src = await (await fetch('./js/main.js')).text();
      // 드랍 시점에 호출되고, 줍는 소리와 혼동되지 않아야 한다
      return /Audio\.Sfx\.itemDrop\(/.test(src);
    }), 'dropItem() 이 itemDrop 을 부른다');

  // ── 조명 자원화: 랜턴·연료 (docs/DUNGEON-INTERACTIONS.md §1) ─────
  const light = await page.evaluate(async () => {
    const G = window.G3, P = G.player, L = G.lighting;
    const mod = await import('./js/game/lantern.js');
    const em = await import('./js/game/enemies.js');

    // 앞선 검사들이 시간을 굴려 연료를 태웠을 수 있다 — 검사용으로 새로 준다
    P.lantern = mod.makeLantern(0);
    G.applyLantern();
    const lampWith = L.playerLamp.distance;

    // 광원 「개수」는 절대 변하면 안 된다 — 바뀌면 셰이더가 재컴파일돼 화면이 멈춘다
    const countLights = () => { let n = 0; G.scene.traverse((o) => { if (o.isLight) n++; }); return n; };
    const lights0 = countLights();

    // 연료가 실제로 준다
    const f0 = P.lantern.fuel;
    for (let i = 0; i < 12; i++) await new Promise((r) => requestAnimationFrame(r));
    const drained = f0 - P.lantern.fuel;

    // 다 타면 기본 등불로 복귀
    P.lantern.fuel = 0.02;
    for (let i = 0; i < 6; i++) await new Promise((r) => requestAnimationFrame(r));
    const burnedOut = P.lantern === null;
    const lampBase = L.playerLamp.distance;

    // 다시 주우면 켜진다 — 더 좋은 것이면 교체, 같거나 못하면 기름
    mod.acquire(P, mod.makeLantern(0));
    G.applyLantern();
    const reEquip = P.lantern?.tier === 0 && L.playerLamp.distance > lampBase;
    P.lantern.fuel = 50;                             // 가득이면 더 채울 수가 없다
    const before = P.lantern.fuel;
    const r2 = mod.acquire(P, mod.makeLantern(0));   // 같은 등급 → 기름
    const asFuel = r2.action === 'fuel' && P.lantern.fuel > before;
    const r3 = mod.acquire(P, mod.makeLantern(2));   // 상위 → 교체
    const swapped = r3.action === 'swap' && P.lantern.tier === 2;
    G.applyLantern();

    const lights1 = countLights();

    return {
      lampWith, lampBase, drained, burnedOut, reEquip, asFuel, swapped,
      lights0, lights1,
      base: mod.BASE_LIGHT.radius,
      archerAggro: em.ARCHETYPES.archer.aggro,
      skelAggro: em.ARCHETYPES.skeleton.aggro,
    };
  });
  ok('light.baseNarrowerThanArcher', light.base < light.archerAggro,
    `기본 시야 ${light.base} < 망령 궁수 어그로 ${light.archerAggro} — 궁수가 나를 먼저 본다`);
  ok('light.lanternExtends', light.lampWith > light.base,
    `랜턴 ${light.lampWith} vs 기본 ${light.base}`);
  ok('light.fuelDrains', light.drained > 0, `${light.drained.toFixed(2)}초 소모됨`);
  ok('light.burnsOut', light.burnedOut && light.lampBase === light.base,
    `소진 시 기본 등불(${light.lampBase})로 복귀`);
  ok('light.reEquipAndFuel', light.reEquip && light.asFuel && light.swapped,
    '재장착 · 같은 등급은 기름 · 상위는 교체');
  ok('light.poolStillFixed', light.lights0 === light.lights1,
    `광원 개수 ${light.lights0} → ${light.lights1} (바뀌면 셰이더 재컴파일로 화면이 멈춘다)`);

  const refuel = await page.evaluate(async () => {
    const G = window.G3, P = G.player;
    const mod = await import('./js/game/lantern.js');
    P.lantern = mod.makeLantern(0);
    P.lantern.fuel = 30;
    G.applyLantern();
    const t = G.level.torches.find((x) => !x.spent);
    if (!t) return { skipped: true };
    // 횃불 pos 는 이미 벽면에서 바닥 쪽으로 나와 있다. 여기서 더 밀면
    // 벽 안으로 들어가 unstick 이 멀리 빼내 버린다.
    P.setPosition(t.pos.x, t.pos.z);
    P.stop();
    const before = P.lantern.fuel;
    for (let i = 0; i < 45; i++) {          // dt 상한 0.1초 → 3초를 넘기려면 넉넉히
      await new Promise((r) => requestAnimationFrame(r));
      if (t.spent) break;
    }
    return { gained: P.lantern.fuel - before, spent: t.spent };
  });
  ok('light.torchRefuel', refuel.skipped || (refuel.spent && refuel.gained > 50),
    `벽 횃불에서 연료 +${Math.round(refuel.gained || 0)}초 · 그 횃불은 사그라듦`);

  // ── 벽 투명화: 카메라와 캐릭터 사이를 막는 벽이 흐려지는가 ─────
  const occ = await page.evaluate(async () => {
    const G = window.G3, dg = G.dungeon, P = G.player, CELL = 2;
    const g2w = (gx, gz) => [(gx - dg.w / 2 + 0.5) * CELL, (gz - dg.h / 2 + 0.5) * CELL];

    // 같은 재질을 쓰는 메시에 aFade 가 없으면 셰이더가 0 을 읽어 전부 사라진다.
    // 이 검사가 그 발등찍기를 막는다.
    // 검사 대상은 「페이드 재질을 쓰는」 메시뿐이다. 다른 재질을 쓰는 메시
    // (횃불 받침 등)는 속성이 없어도 정상이다.
    let missing = 0, meshes = 0;
    G.level.group.traverse((o) => {
      if (!o.isInstancedMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m?.userData?.fadeable) return;
      meshes++;
      if (!o.geometry.attributes.aFade) missing++;
    });

    // 카메라 쪽(+Z)에 벽이 두 칸 있는 바닥 칸 = 반드시 가려지는 자리
    let spot = null;
    for (let gz = 2; gz < dg.h - 3 && !spot; gz++)
      for (let gx = 2; gx < dg.w - 2; gx++)
        if (dg.at(gx, gz) === 1 && dg.at(gx, gz + 1) === 2 && dg.at(gx, gz + 2) === 2) { spot = [gx, gz]; break; }
    if (!spot) return { skipped: true, missing, meshes };

    const [bx, bz] = g2w(spot[0], spot[1]);
    P.setPosition(bx, bz);
    // 오클루전은 frame() 의 렌더 경로에서만 갱신된다(카메라가 필요하다).
    // headlessRun 은 시뮬레이션만 밟으므로 여기서는 실제 프레임을 돌려야 한다.
    for (let i = 0; i < 12; i++) await new Promise((r) => requestAnimationFrame(r));
    let faded = 0;
    for (const g of G.level.fadeGroups) for (const v of g.mesh.userData.fade) if (v < 0.9) faded++;

    // 탁 트인 곳으로 옮기면 전부 되돌아와야 한다
    const [sx, sz] = g2w(dg.spawn.gx, dg.spawn.gz);
    P.setPosition(sx, sz);
    for (let i = 0; i < 14; i++) await new Promise((r) => requestAnimationFrame(r));
    let stillFaded = 0;
    for (const g of G.level.fadeGroups) for (const v of g.mesh.userData.fade) if (v < 0.99) stillFaded++;

    return { missing, meshes, faded, stillFaded };
  });
  ok('occlusion.attrOnFadeableMesh', occ.missing === 0 && occ.meshes > 0,
    `페이드 재질 메시 ${occ.meshes}개 중 aFade 누락 ${occ.missing} (누락되면 그 메시가 통째로 사라진다)`);
  ok('occlusion.fadesBlockingWall', occ.skipped || occ.faded > 0,
    `가리는 벽 ${occ.faded}개가 흐려짐`);
  ok('occlusion.restoresWhenClear', occ.skipped || occ.stillFaded === 0,
    `트인 곳에서 남은 흐림 ${occ.stillFaded}개`);

  // ── 줌 인/아웃 ───────────────────────────────────────────
  const zoom = await page.evaluate(async () => {
    const cv = document.getElementById('view');
    const base = window.G3.setZoom(19);
    const wheel = (dy) => cv.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, bubbles: true, cancelable: true }));

    wheel(-300);                                        // 위로 = 확대
    await new Promise((r) => requestAnimationFrame(r));
    const inZ = window.G3.getZoom().target;

    window.G3.setZoom(19);
    wheel(300);                                         // 아래로 = 축소
    await new Promise((r) => requestAnimationFrame(r));
    const outZ = window.G3.getZoom().target;

    // 한계 밖으로 밀어도 범위를 벗어나지 않는가
    for (let i = 0; i < 40; i++) wheel(-300);
    await new Promise((r) => requestAnimationFrame(r));
    const minZ = window.G3.getZoom().target;
    for (let i = 0; i < 80; i++) wheel(300);
    await new Promise((r) => requestAnimationFrame(r));
    const maxZ = window.G3.getZoom().target;

    const lim = window.G3.getZoom();
    window.G3.setZoom(19);
    // 실제 카메라가 따라오는가
    for (let i = 0; i < 30; i++) await new Promise((r) => requestAnimationFrame(r));
    const camY0 = window.G3.camera.position.y;
    window.G3.setZoom(lim.min);
    for (let i = 0; i < 40; i++) await new Promise((r) => requestAnimationFrame(r));
    const camY1 = window.G3.camera.position.y;
    window.G3.setZoom(19);
    return { base, inZ, outZ, minZ, maxZ, lim, camY0, camY1 };
  });
  ok('camera.zoomIn', zoom.inZ < zoom.base, `휠 위로 → 거리 ${zoom.base} → ${zoom.inZ.toFixed(1)}`);
  ok('camera.zoomOut', zoom.outZ > zoom.base, `휠 아래로 → 거리 ${zoom.base} → ${zoom.outZ.toFixed(1)}`);
  ok('camera.zoomClamped',
    zoom.minZ >= zoom.lim.min - 1e-6 && zoom.maxZ <= zoom.lim.max + 1e-6,
    `범위 ${zoom.lim.min}~${zoom.lim.max} 안에서만 (${zoom.minZ.toFixed(1)} / ${zoom.maxZ.toFixed(1)})`);
  ok('camera.zoomAppliesToCamera', zoom.camY1 < zoom.camY0 - 1,
    `카메라 높이 ${zoom.camY0.toFixed(1)} → ${zoom.camY1.toFixed(1)}`);

  ok('move.pathFound', move.hadPath);
  ok('move.actuallyMoved', move.moved > 3, `${move.moved.toFixed(1)} 유닛 이동`);
  ok('move.noWallClip', move.insideWall === 0, `벽 안에 있던 프레임 ${move.insideWall}`);

  // ── 스킬 4종 ──────────────────────────────────────────────
  const skills = await page.evaluate(async () => {
    const G = window.G3;
    G.player.mp = G.player.maxMp = 999;
    G.cooldowns = {};
    const mod = await import('./js/game/skills.js');
    const out = [];
    for (const s of mod.SKILLS) {
      const mpBefore = G.player.mp;
      const fired = mod.trySkill(G, s, { x: G.player.pos.x + 3, z: G.player.pos.z + 3 });
      out.push({ key: s.key, fired, spent: mpBefore - G.player.mp, cd: G.cooldowns[s.key] || 0 });
      await new Promise((r) => setTimeout(r, 120));
    }
    return out;
  });
  for (const s of skills)
    ok(`skill.${s.key}`, s.fired && s.spent === (s.spent | 0) && s.spent > 0 && s.cd > 0,
      `마나 -${s.spent} · 쿨 ${s.cd.toFixed(1)}s`);

  await page.waitForTimeout(900);
  await shot(page, '02-skills.png');

  // ── 전투: 적을 죽이고 드랍/경험치 확인 ───────────────────
  const combat = await page.evaluate(async () => {
    const G = window.G3;
    const mod = await import('./js/game/combat.js');
    // 앞선 스킬 검사가 남긴 장판·지연 폭발이 다른 적을 같이 죽이면 집계가 흔들린다
    G.fields.length = 0;
    G.timers.length = 0;
    const e = G.enemies.find((x) => !x.dead && !x.isBoss);
    if (!e) return { skipped: true };
    // 피해에 시야 검사가 걸리므로 **적 옆에 서야 한다.**
    // 예전엔 아무 데서나 때려도 맞았다 — 그게 벽 너머 타격 버그였다.
    G.player.setPosition(e.pos.x + 1.1, e.pos.z);
    const xp0 = G.player.xp, kills0 = G.stats.kills;
    const hp0 = e.hp;
    const dealt = mod.hitEnemy(G, e, 20);
    const tookDamage = e.hp < hp0;
    // 실패했을 때 **왜**를 알 수 있게 상태를 같이 돌려준다.
    // 단독으로는 통과하는데 스위트 안에서만 깨지는 종류의 사고가 있었고,
    // 그때 메시지가 「combat.damage」 한 줄이라 원인을 좁힐 수가 없었다.
    const why = {
      kind: e.def.key, elite: !!e.traits, dealt,
      dist: +Math.hypot(G.player.pos.x - e.pos.x, G.player.pos.z - e.pos.z).toFixed(2),
      los: mod.hasLine(G, G.player.pos.x, G.player.pos.z, e.pos.x, e.pos.z),
      armor: +e.armor.toFixed(1), stunT: +(e.stunT || 0).toFixed(2),
      invuln: +(G.player.invuln || 0).toFixed(1),
      pDead: G.player.dead, eDead: e.dead, alive: G.enemies.filter((x) => !x.dead).length,
    };
    // 확실히 죽인다
    for (let i = 0; i < 40 && !e.dead; i++) mod.hitEnemy(G, e, 999);
    window.G3.headlessRun(0.7);
    return {
      tookDamage, died: e.dead, why,
      xpGained: G.player.xp !== xp0 || G.player.level > 1,
      kills: G.stats.kills - kills0,
    };
  });
  ok('combat.damage', combat.skipped || combat.tookDamage,
    combat.why ? JSON.stringify(combat.why) : '');
  ok('combat.kill', combat.skipped || (combat.died && combat.kills >= 1), `처치 집계 +${combat.kills}`);
  ok('combat.xp', combat.skipped || combat.xpGained);

  // ── 피격 동작 ────────────────────────────────────────────
  //
  // 이 검사는 **CLIPS 에 'hit' 이 적혀 있는데 어디서도 재생하지 않고 있던**
  // 사고를 겪고 넣었다. 맞으면 몸통이 통째로 밀리고 납작해질 뿐이었고,
  // 그건 「밀렸다」지 「맞았다」가 아니다. 「타격감이 없다」의 절반이 여기였다.
  //
  // 그래서 「hitT 가 설정됐다」로는 부족하다. 그건 예전에도 통과했을 값이다.
  // **관절이 실제로 움직였는가**를 본다 — 가슴 각도가 맞기 전후로 달라야 한다.
  // 그리고 **방향이 다르면 결과도 달라야** 한다. 안 그러면 방향성이 없는 것이다.
  const hitPose = await page.evaluate(async () => {
    const G = window.G3, P = G.player;
    const cb = await import('./js/game/combat.js');
    const e = G.enemies.find((x) => !x.dead && !x.isBoss);
    if (!e) return { skipped: true };
    const frame = () => new Promise((r) => requestAnimationFrame(r));

    // 재는 조건을 **고정**한다. 처음엔 아무 적이나 잡아서 그 자리에서 쟀는데,
    // 두 가지가 결과를 흔들었다:
    //   · 자세 LOD 는 거리로 갈린다 — 멀면 2~4 프레임에 한 번만 갱신되므로
    //     「때린 뒤 2 프레임」이 아직 안 그려진 순간일 수 있다
    //   · 적이 두 측정 사이에 몸을 돌리면 「몸 기준 방향」이 달라진다
    // 그래서 옆에 붙이고(LOD=매 프레임), 기절시켜(방향 고정) 잰다.
    // 리쉬가 되돌려 놓지 않게 home 도 같이 옮긴다 — 안 그러면 제자리로 돌아간다.
    e.pos.set(P.pos.x + 1.2, 0, P.pos.z);
    e.home.copy(e.pos);
    e.stunT = 999;
    e.facing = 0;
    for (let i = 0; i < 10; i++) await frame();

    // 맞은 방향에 따른 **변화량**을 본다. 절대각을 보면 대기 자세의 무게중심
    // 흔들림이 기준선에 섞여서, 방향 항보다 그게 더 클 때 거짓 실패한다.
    const probe = async (fromX, fromZ) => {
      e.hitT = 0; e.facing = 0;
      for (let i = 0; i < 25; i++) await frame();
      const bz = e.rig.chest.rotation.z, bx = e.rig.chest.rotation.x, bh = e.rig.head.rotation.x;
      cb.hitEnemy(G, e, 1, { silent: true, los: false, from: { x: e.pos.x + fromX, z: e.pos.z + fromZ } });
      await frame(); await frame();
      return {
        z: e.rig.chest.rotation.z - bz,
        x: e.rig.chest.rotation.x - bx,
        head: e.rig.head.rotation.x - bh,
      };
    };

    const front = await probe(0, -2);      // 정면에서 맞음 → 뒤로 젖혀진다
    const left = await probe(-2, 0);
    const right = await probe(2, 0);

    const joints = ['foreR', 'foreL', 'neck', 'head', 'root', 'hips', 'spine', 'chest']
      .filter((k) => e.rig[k]).length;
    const hasKnee = !!(e.rig.shinL || e.def.float);

    return {
      frontX: front.x, headLag: front.head, leftZ: left.z, rightZ: right.z, joints, hasKnee,
      bent: Math.abs(front.x) > 0.03,
      headLags: Math.abs(front.head) > 0.02,
      // 왼쪽에서 맞았을 때와 오른쪽에서 맞았을 때가 **반대로** 꺾여야 한다
      directional: left.z * right.z < 0 && Math.abs(left.z - right.z) > 0.05,
    };
  });
  ok('actor.rigJoints', hitPose.skipped || (hitPose.joints === 8 && hitPose.hasKnee),
    `관절 ${hitPose.joints}/8 · 무릎 ${hitPose.hasKnee ? '있음' : '없음'}`);
  ok('actor.hitBends', hitPose.skipped || hitPose.bent,
    `정면에서 맞으면 가슴이 ${hitPose.frontX?.toFixed(3)} 젖혀진다`);
  ok('actor.hitHeadLag', hitPose.skipped || hitPose.headLags,
    `머리 ${hitPose.headLag?.toFixed(3)} (가슴보다 0.06초 늦게 젖혀진다)`);
  // 무기를 **바로 쥐고 있는가.**
  //
  // 칼날이 손에서 팔뚝 쪽(몸 쪽)으로 뻗어 있었다 — 얼음송곳 쥐듯 거꾸로다.
  // 서 있을 때는 검이 위로 서 있어 그럴듯해 보이지만, 들어올리면 손잡이가
  // 위로 가고 칼끝이 아래-뒤를 향한다. 팔이 아무리 큰 호를 그려도 칼끝은
  // 몸 앞에서 오르내리기만 한다 — 「몸 앞에서 내려가잖아」가 이것이었다.
  //
  // 판정: **칼끝이 손보다 어깨에서 멀어야 한다.** 거꾸로 쥐면 가까워진다.
  const grip = await page.evaluate(async () => {
    const THREE = await import('three');
    const em = await import('./js/game/enemies.js');
    const G = window.G3;
    const out = {};
    const check = (rig) => {
      rig.group.updateMatrixWorld(true);
      const sh = new THREE.Vector3(), hand = new THREE.Vector3(), tip = new THREE.Vector3();
      rig.armR.getWorldPosition(sh);
      rig.handR.getWorldPosition(hand);
      rig.blade.getWorldPosition(tip);
      return +(tip.distanceTo(sh) - hand.distanceTo(sh)).toFixed(3);
    };
    out.knight = check(G.player.rig);
    out.skeleton = check(em.ARCHETYPES.skeleton.build());
    return out;
  });
  ok('actor.weaponHeldForward', grip.knight > 0.15 && grip.skeleton > 0.1,
    `칼끝이 손보다 어깨에서 먼 정도 — 기사 ${grip.knight} · 해골 ${grip.skeleton} (음수면 거꾸로 쥔 것)`);

  // 시간이 지나도 **제자리에 있는가.**
  //
  // 사고를 겪고 넣었다. poseHit 이 root.x / root.z 를 `+=` 로 더하는데 되돌리는
  // 곳이 없어서, 맞을 때마다 몸이 조금씩 밀려났다. 시제품을 몇 분 켜 두면
  // 캐릭터가 화면 밖으로 나갔고, 게임에서는 **조준이 안 됐다** — 조준은
  // 커서 지면 좌표와 e.pos 의 거리로 잡는데(main.js), 보이는 몸이 e.pos 에서
  // 벗어나 있으면 몸을 눌러도 아무것도 안 잡힌다.
  //
  // 자세 코드가 「어떤 축을 아무도 0 으로 안 돌려놓는가」는 눈으로 못 찾는다.
  // 오래 굴려 보고 재는 수밖에 없다.
  const drift = await page.evaluate(async () => {
    const G = window.G3, P = G.player;
    const cb = await import('./js/game/combat.js');
    const e = G.enemies.find((x) => !x.dead && !x.isBoss);
    if (!e) return { skipped: true };
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    e.pos.set(P.pos.x + 1.2, 0, P.pos.z);
    e.home.copy(e.pos);
    for (let n = 0; n < 12; n++) {
      const a = (n / 12) * Math.PI * 2;
      cb.hitEnemy(G, e, 1, {
        silent: true, los: false,
        from: { x: e.pos.x + Math.sin(a) * 2, z: e.pos.z + Math.cos(a) * 2 },
      });
      for (let i = 0; i < 6; i++) await frame();
    }
    for (let i = 0; i < 30; i++) await frame();
    return {
      enemy: Math.max(Math.abs(e.rig.root.position.x), Math.abs(e.rig.root.position.z)),
      player: Math.max(Math.abs(P.rig.root.position.x), Math.abs(P.rig.root.position.z)),
    };
  });
  ok('actor.staysInPlace', drift.skipped || (drift.enemy < 0.05 && drift.player < 0.05),
    `12대 맞은 뒤 이탈 — 적 ${drift.enemy?.toFixed(4)} · 플레이어 ${drift.player?.toFixed(4)}`);

  // 플레이어가 **실제로 걷는가.**
  //
  // 플레이어는 `moved`, 적은 `moving` 을 넘기는데 새 포저가 `moving` 만 읽어서
  // **플레이어가 한 번도 걷지 않았다.** 대기 자세로 미끄러져 다녔다.
  // 「걷기 클립을 골랐다」로는 못 잡는다 — 클립은 맞게 골랐고 그 안에서 안 걸었다.
  const walk = await page.evaluate(async () => {
    const G = window.G3, P = G.player;
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    const dg = G.dungeon;
    let far = null, bd = -1;
    for (const room of dg.rooms) {
      const d = (room.cx - P.pos.x / 2 - dg.w / 2) ** 2 + (room.cy - P.pos.z / 2 - dg.h / 2) ** 2;
      if (d > bd) { bd = d; far = room; }
    }
    P.moveTo(dg, (far.cx - dg.w / 2 + 0.5) * 2, (far.cy - dg.h / 2 + 0.5) * 2);
    let minThigh = 9, maxThigh = -9, minShin = 9, maxShin = -9;
    let minArm = 9, maxArm = -9, worstKnee = 0;
    for (let i = 0; i < 60; i++) {
      await frame();
      const t = P.rig.thighL.rotation.x, sh = P.rig.shinL.rotation.x, a = P.rig.armR.rotation.x;
      if (t < minThigh) minThigh = t; if (t > maxThigh) maxThigh = t;
      if (sh < minShin) minShin = sh; if (sh > maxShin) maxShin = sh;
      if (a < minArm) minArm = a; if (a > maxArm) maxArm = a;
      // 무릎이 **앞으로** 꺾인 정도. 사람 무릎은 한 방향으로만 굽는다.
      if (sh < worstKnee) worstKnee = sh;
      const sh2 = P.rig.shinR.rotation.x;
      if (sh2 < worstKnee) worstKnee = sh2;
    }
    return { thigh: maxThigh - minThigh, shin: maxShin - minShin, arm: maxArm - minArm, worstKnee };
  });
  ok('actor.playerActuallyWalks', walk.thigh > 0.5 && walk.shin > 0.2,
    `허벅지 진폭 ${walk.thigh.toFixed(2)} · 무릎 진폭 ${walk.shin.toFixed(2)}`);
  // 팔이 안 흔들리면 다리를 아무리 잘 만들어도 「미끄러진다」로 보인다.
  // 실제로 restArms 가 팔을 고정값으로 잡고 있어서 걷는 내내 얼어 있었다.
  ok('actor.armsSwingWhileWalking', walk.arm > 0.25,
    `팔 진폭 ${walk.arm.toFixed(2)} (다리와 반대로 흔들려야)`);
  // 무릎 방향. 부호 하나 뒤집혔더니 무릎이 앞으로 꺾여 새 다리처럼 보였다 —
  // 코드를 읽어서는 안 보이고, 옆에서 찍어 봐야 나온다. 그래서 숫자로 못박는다.
  ok('actor.kneesBendBackward', walk.worstKnee > -0.12,
    `가장 앞으로 꺾인 무릎 ${walk.worstKnee.toFixed(3)} (0 이상이어야 = 뒤로만 굽는다)`);

  // 뜨는 것이 실제로 떠 있는가.
  //
  // 이것도 사고를 겪고 넣었다. 뜨는 높이를 root 관절에 얹었더니, 공격 자세가
  // 같은 관절·같은 축을 더 센 감쇠로 잡아당겨서 **궁수가 공격할 때마다 바닥에
  // 앉았다.** 눈으로는 「좀 낮나?」 정도로만 보이는 종류의 고장이다.
  const floaty = await page.evaluate(async () => {
    const G = window.G3;
    const em = await import('./js/game/enemies.js');
    const P = G.player;
    const a = new em.Enemy(G, 'archer', P.pos.x + 2, P.pos.z);
    const s = new em.Enemy(G, 'skeleton', P.pos.x - 2, P.pos.z);
    a.state = 'windup'; a.stateT = 0.2;      // 공격 중에도 떠 있어야 한다
    G.enemies.push(a, s);
    for (let i = 0; i < 40; i++) await new Promise((r) => requestAnimationFrame(r));
    const y = (e) => +(e.rig.root.position.y + e.rig.hips.position.y - e.rig.dim.hipY).toFixed(3);
    const out = { archer: y(a), skeleton: y(s) };
    a.dispose(); s.dispose();
    G.enemies.splice(G.enemies.indexOf(a), 1);
    G.enemies.splice(G.enemies.indexOf(s), 1);
    return out;
  });
  ok('actor.floatsWhileAttacking', floaty.archer > 0.15 && Math.abs(floaty.skeleton) < 0.08,
    `망령 궁수 ${floaty.archer} (떠 있어야) · 해골 ${floaty.skeleton} (땅에 붙어야)`);

  ok('actor.hitDirectional', hitPose.skipped || hitPose.directional,
    `왼쪽에서 맞음 z ${hitPose.leftZ?.toFixed(4)} · 오른쪽에서 맞음 z ${hitPose.rightZ?.toFixed(4)} (부호가 반대여야)`);

  // ── 넉백은 **밀어내는 기술만** ────────────────────────────
  //
  // 평타에 기본 넉백 0.5(치명타 0.9)가 붙어 있었다. 한 대는 4분의 1칸이라
  // 코드를 읽어서는 작아 보이는데, 평타는 초당 한 대 이상 들어간다 —
  // 때리는 내내 몹이 뒤로 물러나서 쫓아가 다시 붙기를 반복했다.
  //
  // 「기본값이 0 이 아니다」는 눈으로 안 보인다. 부르는 쪽에는 `knock` 이
  // 아예 안 적혀 있고, 값은 hitEnemy 안의 ?? 뒤에 숨어 있기 때문이다.
  // 그래서 **임펄스를 직접 잰다.** 한 프레임도 안 흘려보내고 hitEnemy 직후에
  // e.knock 을 읽으므로 AI 이동이 섞이지 않는다.
  const kb = await page.evaluate(async () => {
    const G = window.G3, P = G.player;
    const cb = await import('./js/game/combat.js');
    const sk = await import('./js/game/skills.js');
    const e = G.enemies.find((x) => !x.dead && !x.isBoss && !x.heavy);
    if (!e) return { skipped: true };

    const save = { hp: e.hp, maxHp: e.maxHp, mp: P.mp, fields: G.fields.length };
    e.maxHp = 1e9; e.hp = 1e9;                 // 재는 동안 안 죽게
    const place = () => { e.pos.set(P.pos.x + 1.4, 0, P.pos.z); e.knock.set(0, 0, 0); };
    const imp = (fn) => { place(); fn(); return +e.knock.length().toFixed(3); };
    const skill = (key) => sk.SKILLS.find((s) => s.key === key);
    const cast = (key) => {
      P.mp = 999; G.cooldowns[key] = 0;
      return imp(() => sk.trySkill(G, skill(key), { x: e.pos.x, z: e.pos.z }));
    };

    const out = {};
    out.basic = imp(() => cb.hitEnemy(G, e, 1, { silent: true, los: false }));
    out.crit = imp(() => cb.hitEnemy(G, e, 1, { silent: true, los: false, crit: true }));
    out.cleave = cast('cleave');
    out.nova = cast('nova');

    // 그림자 돌진은 cast 가 아니라 매 프레임 훑기에서 때린다
    place();
    e.pos.set(P.pos.x + 0.5, 0, P.pos.z);
    G.pendingDashHits = { hitSet: new Set(), until: 0.28 };
    sk.updateDashHits(G, 1 / 60);
    out.dash = +e.knock.length().toFixed(3);
    G.pendingDashHits = null;

    // 운석은 0.85초 뒤 타이머에서 터진다 — 손으로 민다.
    // 조준점을 **적에게서 살짝 비껴** 놓는다: 정확히 발밑에 떨어지면
    // 밀어낼 방향 벡터가 0 이라 넉백이 0 으로 나온다(게임에서도 그렇다).
    place();
    P.mp = 999; G.cooldowns.meteor = 0;
    const nTimer = G.timers.length;
    sk.trySkill(G, skill('meteor'), { x: e.pos.x - 1.2, z: e.pos.z });
    for (const t of G.timers.slice(nTimer)) t.fn();
    G.timers.length = nTimer;
    out.meteor = +e.knock.length().toFixed(3);

    e.hp = save.hp; e.maxHp = save.maxHp; e.knock.set(0, 0, 0);
    P.mp = save.mp;
    G.fields.length = save.fields;             // 장판이 남아 뒤 검사를 오염시키지 않게
    return out;
  });
  ok('combat.noKnockOnWeaponHits',
    kb.skipped || (kb.basic === 0 && kb.crit === 0 && kb.cleave === 0 && kb.dash === 0),
    `평타 ${kb.basic} · 치명타 ${kb.crit} · 회전 베기 ${kb.cleave} · 그림자 돌진 ${kb.dash} (전부 0 이어야)`);
  ok('combat.knockOnBlasts',
    kb.skipped || (kb.nova > 1 && kb.meteor > 1),
    `화염 신성 ${kb.nova} · 운석 낙하 ${kb.meteor} (충격파는 밀어내야)`);

  // ── 아이템: 롤 → 장착 → 스탯 상승 ────────────────────────
  const items = await page.evaluate(async () => {
    const G = window.G3;
    const im = await import('./js/game/items.js');
    const rm = await import('./js/core/rng.js');
    const rnd = rm.makeRng('VERIFY-ITEM');
    const before = { dmg: G.player.dmgMax, hp: G.player.maxHp };
    const it = im.rollItem(rnd, 3, 2, { slot: 'weapon', minRarity: 3 });
    G.player.pickUp(it);
    G.player.equip(it);
    return {
      rarity: it.rarity,
      affixes: it.affixes.length,
      named: !!it.name && it.name.length > 1,
      dmgUp: G.player.dmgMax > before.dmg,
      equipped: G.player.equipped.weapon === it,
      tooltip: im.tooltipHtml(it, null).includes(it.name),
    };
  });
  ok('item.roll', items.rarity === 3 && items.affixes === 4, `전설 · 접사 ${items.affixes}개`);
  ok('item.equip', items.equipped && items.dmgUp);
  ok('item.tooltip', items.tooltip && items.named);

  // ── 보스층 직행 ──────────────────────────────────────────
  //
  // **9층으로 간다.** 예전엔 3층이 유일한 보스층이자 3페이즈 군주였다.
  // 이제 보스는 매 층이고 층마다 페이즈 수가 다르다(1~2페이즈로 시작해
  // 막마다 다시 오른다 — docs/FLOORS.md §5-3-3). 3페이즈 전이를 재려면
  // 3페이즈를 가진 보스, 즉 9층의 심연의 군주를 세워야 한다.
  await page.goto(`${BASE}/?seed=VERIFY&autostart=1&floor=9&jump=boss`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.G3 && window.G3.state === 'play' && window.G3.boss, { timeout: 30000 });
  await page.evaluate(() => { window.G3.player.invuln = 1e9; });
  await page.waitForTimeout(800);

  const boss = await page.evaluate(async () => {
    const G = window.G3;
    G.player.pos.set(G.boss.pos.x - 6, 0, G.boss.pos.z);
    G.player.obj.position.copy(G.player.pos);
    const phases = [];
    // HP를 단계별로 깎아 페이즈 전환을 강제한다
    for (const k of [0.6, 0.3, 0.05]) {
      G.boss.hp = G.boss.maxHp * k;
      for (let i = 0; i < 30; i++) await new Promise((r) => requestAnimationFrame(r));
      phases.push(G.boss.phase);
    }
    return { phases, barShown: !document.getElementById('bossbar').hidden, exitClosed: !G.level.exitOpen };
  });
  ok('boss.spawned', true);
  ok('boss.bar', boss.barShown);
  ok('boss.exitLockedBeforeKill', boss.exitClosed);
  ok('boss.phases', boss.phases[0] === 1 && boss.phases[2] === 2, `페이즈 전이 ${boss.phases.join('→')}`);

  await shot(page, '03-boss.png');

  const kill = await page.evaluate(async () => {
    const G = window.G3;
    const cm = await import('./js/game/combat.js');
    const drops0 = G.drops.length;
    cm.killEnemy(G, G.boss);
    // 드랍은 killEnemy 안에서 **동기적으로** 생성된다. 기다릴 이유가 없다.
    // 예전에는 60프레임을 기다린 뒤 셌는데, 그 사이 옆에 서 있던 플레이어가
    // 주워 버려서 프레임 속도에 따라 결과가 달라졌다 — 검사가 아니라 도박이었다.
    const added = G.drops.slice(drops0).map((d) => d.item.kind);
    // 출구 열림은 몇 프레임 뒤에 반영될 수 있으니 그것만 기다린다
    for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
    return {
      exitOpen: G.level.exitOpen, bossKills: G.stats.bossKills,
      // 영혼 조각은 장비가 아니다 — 안 거르면 보스 드랍 수가 잘못 세진다
      gear: added.filter((k) => k !== 'lantern' && k !== 'coin').length,
      lanterns: added.filter((k) => k === 'lantern').length,
    };
  });
  // 3 → 2. 보스가 한 번에 세 개를 뱉으면 그 뒤 층의 드랍이 전부 무의미해진다
  // (docs/ITEM-ECONOMY.md §5).
  ok('boss.kill.dropsRare', kill.gear === 2 && kill.lanterns === 1,
    `장비 ${kill.gear}개 + 영혼 등불 ${kill.lanterns}개`);
  ok('boss.kill.opensExit', kill.exitOpen && kill.bossKills === 1);

  await shot(page, '04-boss-loot.png');

  // ── 봇 모드 소크 ─────────────────────────────────────────
  await page.goto(`${BASE}/?seed=VERIFY&bot=1&ff=4`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.G3 && window.G3.state === 'play', { timeout: 30000 });
  const frames = await page.evaluate(async () => {
    const logic = [], frame = [];
    let last = performance.now();
    for (let i = 0; i < 240; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      const n = performance.now();
      frame.push(n - last);
      logic.push(window.G3.perf.logicMs);
      last = n;
    }
    const med = (a) => { a.sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
    const p95 = (a) => a[Math.floor(a.length * 0.95)];
    return { logicMed: med(logic), logicP95: p95(logic), frameMed: med(frame), frameP95: p95(frame) };
  });

  // ── 로직 비용: **장면을 고정해 놓고** 잰다 ────────────────
  //
  // 원래는 위의 봇 소크 도중에 쟀다. 그런데 그때는 봇이 싸우는 중이라
  // **살아 있는 적 수가 판마다 다르다.** 실측이 그대로 흔들렸다:
  //   6.20 → 5.50 → 6.30 → 5.90 → 5.80 → 6.90 ms
  // 마지막 판은 **무기를 매단 각도만** 바꾼 것이라 로직 비용에 영향을 줄 수
  // 없는 변경이었다. 즉 ±1.4ms 는 코드가 아니라 장면 구성의 차이였고,
  // 기준선(6ms)이 그 잡음 폭 한가운데 있었다.
  //
  // 무작위로 실패하는 검사는 쓸모없는 정도가 아니라 **해롭다** — 무시하는
  // 습관이 든다. 그래서 잰 값을 못 믿게 만든 원인을 없앤다:
  // 적 수를 못박고, 전부 깨우고, 렌더링 없이 고정 시간을 밟는다.
  const budget = await page.evaluate(async () => {
    const G = window.G3;
    const em = await import('./js/game/enemies.js');
    for (const e of G.enemies) e.dispose();
    G.enemies.length = 0;
    G.boss = null;
    // 24 마리 — 실제 한 층의 상한(방마다 1~4 × 방 8개)에 가깝다.
    // 플레이어 주위 4~26 유닛에 고르게 뿌려 자세 LOD 의 경계를 모두 지나게 한다.
    const P = G.player;
    const kinds = ['skeleton', 'ghoul', 'archer', 'golem'];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = 4 + (i % 6) * 4.4;
      const e = new em.Enemy(G, kinds[i % 4], P.pos.x + Math.cos(a) * r, P.pos.z + Math.sin(a) * r);
      e.aggro = true; e.state = 'chase';
      G.enemies.push(e);
    }
    const samples = [];
    for (let i = 0; i < 90; i++) {
      G.headlessRun(1 / 60);
      samples.push(G.perf.logicMs);
    }
    samples.sort((x, y) => x - y);
    return {
      n: G.enemies.length,
      med: samples[Math.floor(samples.length / 2)],
      p95: samples[Math.floor(samples.length * 0.95)],
    };
  });
  // 벽시계 9초를 기다리는 대신 시뮬레이션 12초를 밟는다.
  // 렌더링이 느린 환경에서 벽시계로 기다리면 게임 내 시간이 거의 안 흐른다 —
  // 「9초 기다렸는데 봇이 한 마리도 못 잡았다」가 되면 검사가 무의미하다.
  await page.evaluate(() => {
    for (let i = 0; i < 12; i++) window.G3.headlessRun(1);
  });
  const botState = await page.evaluate(() => ({
    kills: window.G3.stats.kills,
    floor: window.G3.floorNo,
    items: window.G3.stats.itemsFound,
    level: window.G3.player.level,
    alive: !window.G3.player.dead,
  }));
  ok('bot.fights', botState.kills > 0, `처치 ${botState.kills} · 획득 ${botState.items} · Lv ${botState.level}`);
  // 시뮬레이션 예산 — **적 24마리 고정, 60fps 한 스텝의 simulate() 비용.**
  //
  // 이름과 기준을 바꾼 이유를 적어 둔다. 원래 검사(perf.logicBudget, 기준 6ms)는
  // 봇 전투 중 렌더 프레임마다 재는 값이었고, 거기에는 simulate() 말고도
  // 레벨·조명·이펙트·카메라·UI 갱신이 다 들어 있었다. 게다가 소프트웨어
  // 렌더링이라 한 프레임이 1초짜리였다.
  //
  // 장면을 고정해 잡음을 없애면서 headlessRun 을 썼는데, 그건 **simulate() 만**
  // 재고 한 스텝이 1/60 초다. 즉 훨씬 작은 부분집합이라 6ms 기준이 저절로
  // 통과한다(0.40ms) — 기준을 안 건드렸을 뿐 **검사를 무력화한 것**이다.
  //
  // 그래서 이름을 바꾸고 기준을 실제 재는 것에 맞춘다. 1.5ms 는 60fps 프레임
  // 예산(16.7ms)의 9% 다. 이 작업으로 자세 계산이 마리당 3배가 됐으니,
  // 여기서 3배 더 나빠지면 걸린다.
  ok('perf.simBudget', budget.med < 1.5,
    `적 ${budget.n}마리 · simulate() 한 스텝 중앙값 ${budget.med.toFixed(2)}ms · p95 ${budget.p95.toFixed(2)}ms`);
  console.log(`  (참고) 봇 전투 중 렌더 프레임 로직 ${frames.logicMed.toFixed(2)}ms — 재는 대상이 달라 위 숫자와 비교 못 한다`);
  console.log(`  (참고) 전체 프레임 중앙값 ${frames.frameMed.toFixed(1)}ms — SwiftShader 소프트웨어 렌더링이라 GPU 성능을 대변하지 않는다`);

  await shot(page, '05-bot.png');

  ok('runtime.noPageError', errs.length === 0, errs.slice(0, 3).join(' | ') || '오류 0건');

  await browser.close();

  const fail = R.filter((r) => !r.v);
  console.log(`\n${R.length - fail.length}/${R.length} 통과`);
  if (fail.length) {
    console.log('실패: ' + fail.map((f) => f.k).join(', '));
    process.exit(1);
  }
  console.log(`스크린샷: docs/audit3d/`);
})().catch((e) => { console.error(e); process.exit(1); });
