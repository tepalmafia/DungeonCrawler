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

    // 배치 간격 — 뭉쳐 있으면 한 마리만 끌어낼 수가 없다
    let minGap = Infinity;
    for (let i = 0; i < G.enemies.length; i++)
      for (let j = i + 1; j < G.enemies.length; j++)
        minGap = Math.min(minGap, G.enemies[i].pos.distanceTo(G.enemies[j].pos));

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

    return { minGap, pulledCount: pulled.length, spreadCount: spread.length, returning, released };
  });
  ok('pull.spacing', pull.minGap > 4.5, `적 간 최소 간격 ${pull.minGap.toFixed(1)} 유닛`);
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

  // ── 엄폐물 우회 (docs/ENEMY-AI.md §6-3) ─────────────────
  // 벽을 사이에 두고 마주 세운 뒤, 사선을 여는 데 걸리는 시간을 잰다.
  // 근접은 원래도 A* 로 돌아갔다 — 이 검사가 지키는 것은 **원거리**다.
  // 궁수는 예전에 사선이 막히면 물러나기만 하며 영영 못 쐈다.
  const flank = await page.evaluate(async () => {
    const G = window.G3, P = G.player, dg = G.dungeon;
    const nav = await import('./js/world/nav.js');
    const dun = await import('./js/world/dungeon.js');
    P.invuln = 1e9;

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
    return out;
  });
  ok('ai.flanksAroundCover',
    flank.skipped || (!flank.archer || (flank.archer.opened && flank.archer.sec < 8)),
    flank.skipped ? '엄폐 상황을 못 만듦'
      : `궁수 ${flank.archer ? flank.archer.sec + '초' : '없음'}`
        + ` · 해골 ${flank.skeleton ? flank.skeleton.sec + '초' : '없음'}`
        + ' — 막히면 돌아가야 한다');

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
    // 게이지는 「내가 넣은 값」이 아니라 **읽는 시점의 실제 스탯**과 맞아야 한다.
    // 마나는 매 프레임 자연 회복하므로 고정값과 비교하면 안 된다.
    const hpFill = parseFloat(document.querySelector('#orbHp .fill').style.height);
    const mpFill = parseFloat(document.querySelector('#orbMp .fill').style.height);
    const hpWant = (P.hp / P.maxHp) * 100, mpWant = (P.mp / P.maxMp) * 100;
    return {
      hpLeft: hp.x + hp.w <= bar.x + 2,
      mpRight: mp.x >= bar.x + bar.w - 2,
      sameRow: Math.abs((hp.y + hp.h / 2) - (bar.y + bar.h / 2)) < 40,
      rows: rows.length,
      perRow: rows.map((r) => r.children.length),
      hpFill, mpFill, hpWant, mpWant,
      hpOk: Math.abs(hpFill - hpWant) < 1.5,
      mpOk: Math.abs(mpFill - mpWant) < 1.5,
    };
  });
  ok('hud.orbsFlankHotkeys', hud.hpLeft && hud.mpRight && hud.sameRow,
    '체력·마나 구슬이 단축키 양옆 같은 높이에');
  ok('hud.twoRows', hud.rows === 2 && hud.perRow.every((n) => n === 4),
    `단축키 ${hud.rows}줄 × ${hud.perRow.join('/')}칸`);
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
    const xp0 = G.player.xp, kills0 = G.stats.kills;
    const hp0 = e.hp;
    mod.hitEnemy(G, e, 20);
    const tookDamage = e.hp < hp0;
    // 확실히 죽인다
    for (let i = 0; i < 40 && !e.dead; i++) mod.hitEnemy(G, e, 999);
    window.G3.headlessRun(0.7);
    return {
      tookDamage, died: e.dead,
      xpGained: G.player.xp !== xp0 || G.player.level > 1,
      kills: G.stats.kills - kills0,
    };
  });
  ok('combat.damage', combat.skipped || combat.tookDamage);
  ok('combat.kill', combat.skipped || (combat.died && combat.kills >= 1), `처치 집계 +${combat.kills}`);
  ok('combat.xp', combat.skipped || combat.xpGained);

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
  await page.goto(`${BASE}/?seed=VERIFY&autostart=1&floor=3&jump=boss`, { waitUntil: 'load' });
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
      gear: added.filter((k) => k !== 'lantern').length,
      lanterns: added.filter((k) => k === 'lantern').length,
    };
  });
  ok('boss.kill.dropsRare', kill.gear === 3 && kill.lanterns === 1,
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
  // 로직 예산: 60fps 프레임(16.7ms) 중 시뮬레이션이 6ms를 넘지 않아야 한다
  ok('perf.logicBudget', frames.logicMed < 6,
    `시뮬레이션 중앙값 ${frames.logicMed.toFixed(2)}ms · p95 ${frames.logicP95.toFixed(2)}ms`);
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
