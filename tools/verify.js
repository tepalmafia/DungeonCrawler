// ══════════════════════════════════════════════════════════════════════════
//  회귀 검증 — v159~v166에서 고친 결함이 되살아나지 않는지 확인한다.
//
//  사용법:  python3 tools/serve.py 8137 &   node tools/verify.js [기대버전]
//
//  ★ 이 파일은 저장소에 있어야 한다. 스크래치패드에 두었다가 컨테이너 스냅샷 복원으로
//    14번째 유실을 겪었다 — 검증 자산은 코드와 같은 수명을 가져야 한다.
// ══════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const WANT_VER = parseInt(process.argv[2] || '0', 10);

const R = [];
const ok = (k, v, note = '') => { R.push({ k, v: !!v, note }); console.log(`${v ? 'PASS' : 'FAIL'} ${k}${note ? ' — ' + note : ''}`); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

async function boot(page, { cls = 'knight', heat = 0, test = true, ff = 1 } = {}) {
  await page.goto(`${BASE}/?${test ? 'test=1&' : ''}ff=${ff}`);
  await page.waitForFunction(() => typeof Game !== 'undefined' && typeof Sprites !== 'undefined', { timeout: 20000 });
  await page.evaluate(([c, h]) => {
    localStorage.clear(); Meta.load(); Meta.data.introSeen = true;
    Meta.data.classes = { knight: true, archer: true, mage: true, alch: true };
    Meta.data.cls = c; Meta.data.wins = 1; Meta.data.runs = 3;
    Meta.setHeat(h); Meta.save();
  }, [cls, heat]);
  await page.reload();
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.state, { timeout: 20000 });
  for (let i = 0; i < 8; i++) {
    const st = await page.evaluate(() => Game.state);
    if (st === 'play') break;
    if (st === 'route') { await page.evaluate(() => Game.pickRoute(0)); await page.waitForTimeout(200); continue; }
    await page.keyboard.press('Digit1'); await page.waitForTimeout(200);
  }
  await page.waitForFunction(() => Game.state === 'play', { timeout: 20000 });
  await page.evaluate(() => { Game.player.god = true; });
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));

  await boot(page, { cls: 'knight', heat: 1 });
  const ver = await page.evaluate(() => GAME_VERSION);
  if (WANT_VER) ok('version', ver === WANT_VER, `GAME_VERSION=${ver} (기대 ${WANT_VER})`);
  else console.log(`  (빌드 v${ver})`);

  // ── 입력 (v160) — 틱을 직접 굴려 결정화한다.
  // rAF에 기대면 CPU가 밀릴 때 한 프레임에 여러 틱이 몰려 0.15초 버퍼가 한 번에 탄다
  const buf = await page.evaluate(() => {
    let n = 0; const orig = Game.player.attack;
    Game.player.attack = function (...a) { n++; return orig.apply(this, a); };
    Game.player.attackCd = 5; Game.player.dashAtkT = 0; Game.player.dashTimer = 0;
    Input.buf = {};
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyJ' }));
    const buf0 = Input.buf.KeyJ;
    Input.justPressed = {}; Input.mouse.justDown = false; Input.mouse.down = false;
    Game.tick(1 / 60);
    const midN = n, midBuf = Input.buf.KeyJ;
    Game.player.attackCd = 0; Game.tick(1 / 60);
    const fired = n;
    Game.player.attack = orig;   // delete 는 메서드를 영구 삭제한다 — 반드시 복구
    return { buf0, midN, midBuf, fired };
  });
  ok('input.buffer', buf.buf0 > 0 && buf.midN === 0 && buf.midBuf > 0 && buf.fired >= 1,
    `누른 직후 ${buf.buf0.toFixed(2)} · 쿨 중 발동 ${buf.midN} · 쿨 해제 후 ${buf.fired}회`);

  const hs = await page.evaluate(() => {
    let n = 0; const orig = Game.player.attack;
    Game.player.attack = function (...a) { n++; return orig.apply(this, a); };
    Input.buf = {}; Game.player.attackCd = 5; Game.hitstop = 0.35;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyJ' }));
    Input.justPressed = {};
    for (let i = 0; i < 12; i++) { Game.tick(1 / 60); Input.decay(Game.hitstop > 0 ? 0 : 1 / 60); }
    const held = Input.buf.KeyJ;
    Game.hitstop = 0; Game.player.attackCd = 0; Game.tick(1 / 60);
    const fired = n; Game.player.attack = orig;
    return { held, fired };
  });
  ok('input.hitstopFreeze', hs.held >= 0.149 && hs.fired >= 1,
    `히트스톱 12틱 뒤 buf=${(hs.held || 0).toFixed(3)} (멈추지 않았다면 0) · 해제 후 발동 ${hs.fired}`);

  const hold = await page.evaluate(() => {
    let n = 0; const orig = Game.player.attack;
    Game.player.attack = function (...a) { n++; return orig.apply(this, a); };
    Input.buf = {}; Input.justPressed = {}; Game.player.attackCd = 0; Game.hitstop = 0;
    Input.mouse.down = true;
    for (let i = 0; i < 60; i++) { Game.tick(1 / 60); Input.decay(1 / 60); }
    const held = n;
    Input.mouse.down = false; Input.buf = {}; n = 0; Game.player.attackCd = 0;
    for (let i = 0; i < 40; i++) { Game.tick(1 / 60); Input.decay(1 / 60); }
    Game.player.attack = orig;
    return { held, released: n };
  });
  ok('input.holdFire', hold.held >= 3 && hold.released === 0,
    `홀드 60틱 ${hold.held}회 · 뗀 뒤 40틱 ${hold.released}회`);

  // ── 보스 상한 (v160/v161) ──
  await page.evaluate(() => { Dungeon.floor = 25; Dungeon.roomIndex = Dungeon.totalRooms; Dungeon.build('boss'); });
  const cap = await page.evaluate(() => {
    const b = Game.enemies.find((e) => e.isBoss); const p = Game.player; p.god = true;
    const hit = (setup) => {
      b.hp = b.maxHp; b.status = b.status || {};
      p.rflags = p.rflags || {}; p.flags = p.flags || {};
      ['crownshard', 'wolftooth', 'brand', 'gallows'].forEach((k) => { p.rflags[k] = false; });
      p.flags.regicide = false; b.ironhide = false; b.armorCap = 0;
      setup(b, p);
      const before = b.hp; Game.hitEnemy(b, 99999, { x: 1, y: 0 }, { feel: false });
      return before - b.hp;
    };
    return {
      base: hit(() => {}), iron: hit((bb) => { bb.ironhide = true; }),
      crown: hit((bb, pp) => { pp.rflags.crownshard = true; }),
      stack: hit((bb, pp) => { pp.rflags.crownshard = true; pp.rflags.wolftooth = true; pp.flags.regicide = true; }),
    };
  });
  ok('cap.ironhideSoftens', cap.iron < cap.base && cap.iron >= Math.round(cap.base * 0.8),
    `끈질긴 ${cap.iron} vs 기본 ${cap.base} (v159는 armorCap 오염으로 1까지 잘렸다)`);
  ok('cap.relicMultipliesCap', cap.crown > cap.base && cap.stack > cap.crown,
    `기본 ${cap.base} → 왕관 ${cap.crown} → 3종 ${cap.stack} (v159는 전부 동일 = 유물 실효 0%)`);

  const armorCt = await page.evaluate(() => {
    const rows = [];
    for (const fl of [1, 3, 5, 8, 10, 20, 25, 30, 40, 45, 50]) {
      Dungeon.floor = fl; Dungeon.roomIndex = Dungeon.totalRooms; Dungeon.build('boss');
      Game.player.god = true;
      const b = Game.enemies.find((e) => e.isBoss); if (!b) continue;
      const mech = b.def && b.def.mechanic ? b.def.mechanic.type : null;
      rows.push({ fl, want: mech === 'armor' ? b.def.mechanic.cap : 0, got: b.armorCap });
    }
    return rows;
  });
  ok('cap.armorNotPollutedByAffix', armorCt.every((r) => r.got === r.want),
    `보스 ${armorCt.length}층 전수 armorCap == 킷 설계치`);

  const armorGrow = await page.evaluate(() => {
    const rows = [];
    for (const [fl, atk] of [[3, 4], [8, 9], [30, 30]]) {
      Dungeon.floor = fl; Dungeon.roomIndex = Dungeon.totalRooms; Dungeon.build('boss');
      Game.player.god = true;
      const b = Game.enemies.find((e) => e.isBoss); if (!b || !b.armorCap) continue;
      const hit = (raw) => { b.hp = b.maxHp; Game.hitEnemy(b, raw, { x: 1, y: 0 }, { feel: true }); return b.maxHp - b.hp; };
      const d1 = hit(atk), d3 = hit(atk * 3);
      // 버스트 상한이 이미 걸린 구간은 성장이 멈추는 게 **정상**이다 (상한의 존재 이유).
      // 여기서 잡아야 하는 건 '철갑 클램프' 탓에 멈추는 경우뿐
      const pct = fl >= 31 ? 0.008 : fl >= 16 ? 0.010 : 0.012;
      const baseHp = (b.def && b.def.hp) || b.maxHp;
      const burst = Math.max(fl <= 3 ? Math.max(2, Math.round(baseHp / 30)) : 2, Math.round(b.maxHp * pct));
      rows.push({ fl, d1, d3, burst, grow: +(d3 / Math.max(1, d1)).toFixed(2) });
    }
    return rows;
  });
  ok('armor.growthAlive', armorGrow.length >= 2 && armorGrow.every((r) => r.grow > 1.01 || r.d1 >= r.burst),
    armorGrow.map((r) => `${r.fl}층 ${r.d1}→${r.d3}(×${r.grow})${r.d1 >= r.burst ? '[버스트상한]' : ''}`).join(' · ') + ' (v160은 전부 ×1.00 = 성장 무효)');

  // ── 현상금이 상한에 상쇄되지 않는가 (v165) ──
  const hitsBy = {};
  for (const h of [0, 8]) {
    await boot(page, { cls: 'knight', heat: h });
    hitsBy[h] = await page.evaluate(() => {
      const out = {}; Game.player.god = true;
      for (const fl of [1, 2, 3]) {
        Dungeon.floor = fl; Dungeon.roomIndex = Dungeon.totalRooms; Dungeon.build('boss');
        const b = Game.enemies.find((e) => e.isBoss); if (!b) continue;
        b.hp = b.maxHp; Game.hitEnemy(b, 9, { x: 1, y: 0 }, { feel: true });
        out[fl] = Math.ceil(b.maxHp / Math.max(1, b.maxHp - b.hp));
      }
      return out;
    });
  }
  ok('heat.notCancelledByCap', [1, 2, 3].every((f) => hitsBy[8][f] > hitsBy[0][f]),
    `공9 타수 — 현상금0 ${[1, 2, 3].map((f) => hitsBy[0][f]).join('/')} → 현상금8 ${[1, 2, 3].map((f) => hitsBy[8][f]).join('/')} (v164는 3층 32→29타로 감소)`);

  // ── 계측 도구 (v165) ──
  await boot(page, { cls: 'knight', heat: 0 });
  const cheat = await page.evaluate(() => {
    Dungeon.floor = 3; Game._cheatScaleToFloor();
    const p = Game.player; const ref = Game._normalRef(3, 'knight');
    const hps = [];
    for (let i = 0; i < 5; i++) { Dungeon.floor = 1 + (i % 3); Game._cheatScaleToFloor(); hps.push(p.maxHp); }
    // 도구는 빌드를 **낮추지 않는다**(설계). 기준선이 직업 기본 HP보다 낮아도 기본치가 하한이다
    const baseHp = createPlayer(0, 0, 'knight').maxHp;
    return { hp: p.maxHp, atk: +p.currentAtk().toFixed(1), tr: p.traits.length, rel: p.relics.length, ref, hps, baseHp };
  });
  const wantHp = Math.max(cheat.ref.hp, cheat.baseHp);
  ok('cheat.followsBaseline',
    near(cheat.hp, wantHp, 2) && near(cheat.tr, cheat.ref.tr, 3) && near(cheat.rel, cheat.ref.rel, 2),
    `기사3층 HP${cheat.hp}/공${cheat.atk}/특${cheat.tr}/유${cheat.rel} ← 기준 HP${cheat.ref.hp}/공${cheat.ref.atk}/특${cheat.ref.tr}/유${cheat.ref.rel}`);
  ok('cheat.noHpRatchet', Math.max(...cheat.hps) - Math.min(...cheat.hps) <= 3,
    `B 5연타 HP ${cheat.hps.join('→')} (v164는 누를수록 영구 상승)`);

  const selfcal = await page.evaluate(() => {
    Game.testMode = false; Bot.enabled = false; delete Meta.data.normRef;
    Dungeon.floor = 4; Dungeon.roomIndex = 1; Game.onRoomBuilt('combat');
    const bag = Meta.data.normRef && Meta.data.normRef[Game.player.classId];
    const ref = Game._normalRef(4, Game.player.classId);
    Game.testMode = true;
    return { got: !!(bag && bag[4]), live: ref.live };
  });
  ok('cheat.selfCalibrates', selfcal.got && selfcal.live, '진짜 런이 층에 들어서면 기준선이 실측으로 갱신된다');

  // ── 보상 상한 (v166) ──
  const rew = await page.evaluate(() => {
    const p = Game.player; Dungeon.tookRelicChest = false;
    const open = () => {
      const first = !Dungeon.tookRelicChest;
      const rolled = first ? rollRelics(p, 1, false) : [];
      if (rolled.length) { Dungeon.tookRelicChest = true; Game.acquireRelic(rolled[0]); }
      return p.relics.length;
    };
    const before = p.relics.length;
    const a = open(), b = open(), c = open();
    return { before, a, b, c, hasEliteFlag: 'tookEliteCard' in Dungeon };
  });
  ok('reward.oneRelicChestPerFloor', rew.a === rew.before + 1 && rew.b === rew.a && rew.c === rew.a,
    `상자 3회 → 유물 ${rew.before}→${rew.a}/${rew.b}/${rew.c} (v165는 매번 지급 = 유물의 70%)`);
  ok('reward.eliteCardFlagExists', rew.hasEliteFlag, 'Dungeon.tookEliteCard (정예 카드 층당 1장)');

  // ── 잡몹 필요 타수 밴드 (v166) ──
  const REF_ATK = { 1: 1, 2: 3, 3: 3, 4: 4, 5: 5, 6: 7, 7: 8, 8: 10, 9: 13, 10: 13 };
  const ttk = await page.evaluate((atks) => {
    const out = [];
    for (let f = 1; f <= 10; f++) {
      Dungeon.floor = f;
      const scale = Game.enemyHpMul();
      const per = [];
      for (const t of floorData(f).enemies) {
        const e = createEnemy(t, 0, 0, false, scale);
        if (e) per.push(Math.ceil(e.maxHp / Math.max(1, atks[f])));
      }
      out.push({ f, avg: +(per.reduce((a, b) => a + b, 0) / per.length).toFixed(2), one: per.filter((h) => h <= 1).length, n: per.length });
    }
    return out;
  }, REF_ATK);
  const deep = ttk.filter((r) => r.f >= 3);
  ok('ttk.noOneShotFromFloor3', deep.every((r) => r.one === 0),
    deep.map((r) => `${r.f}층 ${r.avg}타`).join(' ') + ' · 1타사살 ' + deep.reduce((s, r) => s + r.one, 0) + '건');
  ok('ttk.band', deep.every((r) => r.avg >= 2.2 && r.avg <= 5),
    `3층+ 평균 ${Math.min(...deep.map((r) => r.avg))}~${Math.max(...deep.map((r) => r.avg))}타 (목표 2.2~5)`);

  // ── 이어하기가 방을 다시 굴리지 않는가 (v163) ──
  const FP = `(() => {
    const w = (World.map || []).map((r) => Array.isArray(r) ? r.join('') : String(r)).join('/');
    const es = Game.enemies.map((e) => e.type + '@' + Math.round(e.x) + ',' + Math.round(e.y)).sort().join('|');
    return { w: w.length + ':' + w.slice(0, 400), es, seed: Dungeon.roomSeed };
  })()`;
  const resume = await page.evaluate((fp) => {
    const snap = () => eval(fp);
    Game.testMode = true; Game._forceSave = true;
    Dungeon.floor = 4; Dungeon.roomIndex = 3; Dungeon.build('combat');
    Game.saveRun(); Game._forceSave = false;
    const before = snap(); const runs = [];
    for (let i = 0; i < 4; i++) { Game.state = 'hub'; Game.resumeRun(); runs.push(snap()); }
    const seeds = []; const fps = [];
    for (let i = 0; i < 5; i++) { Dungeon.floor = 4; Dungeon.roomIndex = 3; Dungeon._forceSeed = null; Dungeon.build('combat'); seeds.push(Dungeon.roomSeed); fps.push(snap().w); }
    return { before, runs, uniqSeeds: new Set(seeds).size, uniqFps: new Set(fps).size };
  }, FP);
  const same = (a, b) => a.w === b.w && a.es === b.es;
  ok('resume.noReroll', resume.runs.every((r) => same(r, resume.before)),
    '이어하기 4회 모두 저장 시점과 동일한 방 (v162는 매번 새로 굴렸다 = 무한 리롤)');
  ok('resume.stillRandomWhenNew', resume.uniqSeeds === 5 && resume.uniqFps >= 2,
    `새로 지으면 씨앗 5/5 고유 · 지형 ${resume.uniqFps}종 (봉쇄가 '생성 고정'이 아님)`);

  // ── 「유산」 각인이 진군로를 삼키지 않는가 (v164) ──
  const legacy = await page.evaluate(() => {
    Meta.data.up = Meta.data.up || {}; Meta.data.up.legacy = 0; Meta.save();
    Game.restart();
    const noLeg = { state: Game.state, cards: (Game.routeCards || []).length };
    Meta.data.up.legacy = 1; Meta.save();
    Game.restart();
    const first = { state: Game.state, relics: (Game.relicCards || []).length };
    Game.choiceLockT = 0; Game.pickRelic(0);
    const after = { state: Game.state, cards: (Game.routeCards || []).length, held: Game.player.relics.length };
    return { noLeg, first, after };
  });
  ok('legacy.firesAndKeepsRoute',
    legacy.noLeg.state === 'route' && legacy.first.state === 'relic' && legacy.first.relics === 3 &&
    legacy.after.state === 'route' && legacy.after.held >= 1,
    `각인0 → ${legacy.noLeg.state} · 각인1 → 유물 ${legacy.first.relics}장 → ${legacy.after.state} (v163까지 각인은 발동조차 안 했다)`);

  // ── 정산 화면 (v160/v162) ──
  const over = await page.evaluate(() => {
    Game.testMode = false; Meta.data.unlocksSeen = {}; Meta.data.totalKills = 99999;
    Game.endRun(false);
    const fresh = Game._freshUnlocks;
    Game.state = 'over'; Game.overLockT = 0; Game.banner = null;
    Game.showInventory = false; Game.showSettings = false;
    let unlockDrawn = 0;
    const c = Renderer.ctx; const o = c.fillText.bind(c);
    c.fillText = (t, ...a) => { if (typeof t === 'string' && t.startsWith('🔓 해금!')) unlockDrawn++; return o(t, ...a); };
    Game.render();
    c.fillText = o;
    const press = (code) => { Input.justPressed = { [code]: true }; Game.tick(1 / 60); Input.justPressed = {}; };
    press('Tab'); const inv = Game.showInventory; press('Tab');
    press('KeyO'); const set = Game.showSettings; press('Escape');
    Game.showSettings = true; Game._setRow = 0;
    const labels = [];
    const o2 = c.fillText.bind(c);
    c.fillText = (t, ...a) => { if (typeof t === 'string' && t.startsWith('▶ ')) labels.push(t.slice(2)); return o2(t, ...a); };
    HUD.drawSettings(c, Game);
    c.fillText = o2;
    Meta.data.opts = Meta.data.opts || {}; Meta.data.opts.grace = 0;
    Input.justPressed = { ArrowRight: true }; Game._tickSettings(); Input.justPressed = {};
    const grace = Meta.data.opts.grace;
    Game.showSettings = false;
    return { freshN: (fresh || []).length, unlockDrawn, inv, set, top: labels[0] || null, grace, state: Game.state };
  });
  ok('over.unlockDrawn', over.freshN > 0 && over.unlockDrawn >= 1,
    `해금 ${over.freshN}종이 정산 화면에 그려진다 (v159까지 배너뿐 = 한 번도 안 보였다)`);
  ok('over.tabAndSettings', over.inv && over.set && over.state === 'over',
    '정산 화면에서 Tab(획득 목록)·O(설정)가 열린다');
  ok('over.graceTopAndSynced', /망자의 가호/.test(over.top || '') && over.grace > 0,
    `설정 최상단 = ${over.top} · 0번 줄 → 조작 시 가호 ${over.grace}`);

  // ── 타격음 재질 (v162) ──
  const mat = await page.evaluate(() => {
    const spot = {};
    for (const s of ['skeleton', 'golem', 'slime', 'wisp', 'ghoul', 'bossGolem', 'bossWraith', 'bossSpore', 'bossKing']) spot[s] = AudioSys.mat(s);
    const seen = [];
    const o = AudioSys.hit.bind(AudioSys);
    AudioSys.hit = (m) => { seen.push(m || 'flesh'); };
    for (const sp of ['skeleton', 'golem', 'slime', 'wisp', 'ghoul']) {
      const e = { x: 100, y: 100, r: 12, hp: 99, maxHp: 99, sprite: sp, status: {}, flash: 0, kbx: 0, kby: 0 };
      Game.enemies.push(e); Game.damageEnemy(e, 1, { x: 1, y: 0 }, { feel: true }); Game.enemies.pop();
      AudioSys._gates = {};
    }
    AudioSys.hit = o;
    return { spot, seen };
  });
  ok('audio.materialDispatch',
    JSON.stringify(mat.seen) === JSON.stringify(['bone', 'stone', 'ooze', 'spirit', 'flesh']) &&
    mat.spot.bossGolem === 'stone' && mat.spot.bossWraith === 'spirit' && mat.spot.bossSpore === 'ooze',
    mat.seen.join('/') + ' · 보스도 자동 분류');

  // ── 조준이 플레이어의 것인가 (v167) ──
  await boot(page, { cls: 'archer', heat: 0 });
  const aim = await page.evaluate(() => {
    const p = Game.player;
    Game.enemies.length = 0; Game.pendingSpawns.length = 0;
    // 가까운 적은 오른쪽, 먼 적은 위쪽 — 위를 겨누면 위가 맞아야 한다
    const near = createEnemy('skeleton', p.x + 70, p.y, false, 1);
    const far = createEnemy('archer', p.x, p.y - 200, false, 1);
    near.spawnT = 0; far.spawnT = 0;
    Game.enemies.push(near, far);
    const angleTo = (e) => Math.atan2(e.y - p.y, e.x - p.x);
    const setMouse = (dx, dy) => {
      Input.mouse.x = Renderer.offsetX + p.x + dx;
      Input.mouse.y = Renderer.offsetY + p.y + dy;
      Input.mouse.moveT = performance.now() / 1000;
    };
    const dirOf = () => { const d = p.aimDir(Game); return Math.atan2(d.y, d.x); };
    setMouse(0, -180);                    // 위(먼 적) 겨눔
    const up = { a: dirOf(), t: p._aimTarget === far };
    setMouse(180, 0);                     // 오른쪽(가까운 적) 겨눔
    const right = { a: dirOf(), t: p._aimTarget === near };
    setMouse(-180, 0);                    // 아무도 없는 왼쪽 — 스냅되면 안 된다
    const left = { a: dirOf(), t: p._aimTarget };
    // 봇 모드에서는 종전 자동 조준이 살아 있어야 한다 (계측 인프라)
    Bot.enabled = true;
    setMouse(-180, 0);
    dirOf();                              // 조준을 실제로 다시 계산해야 _aimTarget이 갱신된다
    const bot = { t: p._aimTarget === near };
    Bot.enabled = false;
    const nearA = angleTo(near), farA = angleTo(far);
    return { up, right, left, bot, nearA, farA };
  });
  const closeAng = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.05;
  ok('aim.playerChoosesTarget',
    aim.up.t && closeAng(aim.up.a, aim.farA) && aim.right.t && closeAng(aim.right.a, aim.nearA),
    '위를 겨누면 먼 적, 오른쪽을 겨누면 가까운 적 (v166은 항상 가장 가까운 적)');
  ok('aim.noSnapWhenNothingAimed', !aim.left.t && closeAng(aim.left.a, Math.PI),
    '아무도 없는 쪽을 겨누면 그쪽으로 나간다');
  ok('aim.botKeepsAutoTarget', aim.bot.t, '봇 모드는 종전 자동 조준 유지 (계측 인프라 보존)');

  // ── 접촉 피해 예고 + 분리력 (v168) ──
  await boot(page, { cls: 'knight', heat: 0 });
  const touch = await page.evaluate(() => {
    const p = Game.player; p.god = false; p.invuln = 0; p.hp = p.maxHp;
    Game.enemies.length = 0; Game.pendingSpawns.length = 0;
    const e = createEnemy('skeleton', p.x + 10, p.y, false, 1);
    e.spawnT = 0; e.hitCd = 0; e.maxHp = 999; e.hp = 999;
    Game.enemies.push(e);
    // ① 닿는 즉시 피해가 아니라 '겨눔'이 먼저 선다
    const hp0 = p.hp;
    e.touchPlayer(Game, 1);
    const wound = { wind: e._windT, hpSame: p.hp === hp0 };
    // ② 예고 동안 물러나면 헛손질
    e.x = p.x + 400;                       // 플레이어가 벗어난 것과 같은 상황
    for (let i = 0; i < 25; i++) e.tickTimers(1 / 60);
    const whiff = { hp: p.hp, whiffT: e._whiffT, cd: +e.hitCd.toFixed(2) };
    // ③ 버티면 맞는다
    e.x = p.x + 10; e.hitCd = 0; e._whiffT = 0; e._windT = 0;
    e.touchPlayer(Game, 1);
    for (let i = 0; i < 25; i++) e.tickTimers(1 / 60);
    const hit = { hp: p.hp };
    return { wound, whiff, hit, hp0 };
  });
  ok('touch.telegraphFirst', touch.wound.wind > 0 && touch.wound.hpSame,
    `닿아도 즉시 피해 없음 — 예고 ${(touch.wound.wind || 0).toFixed(2)}초 (v167까지는 닿는 순간 피해)`);
  ok('touch.whiffWhenDodged', touch.whiff.hp === touch.hp0 && touch.whiff.whiffT > 0 && touch.whiff.cd > 0.8,
    `물러나면 헛손질 + 경직 ${touch.whiff.cd}초 (반격의 창)`);
  ok('touch.hitsWhenStayed', touch.hit.hp < touch.hp0, `버티면 맞는다 (HP ${touch.hp0}→${touch.hit.hp})`);

  const sep = await page.evaluate(() => {
    const p = Game.player;
    Game.enemies.length = 0;
    const es = [];
    for (let i = 0; i < 4; i++) {                  // 한 점에 포개 놓는다
      const e = createEnemy('skeleton', p.x + 200, p.y, false, 1);
      e.spawnT = 0; e.hitCd = 99; es.push(e); Game.enemies.push(e);
    }
    const minDistOf = () => {
      let m = Infinity;
      for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++)
        m = Math.min(m, Math.hypot(es[i].x - es[j].x, es[i].y - es[j].y));
      return m;
    };
    const before = minDistOf();
    for (let t = 0; t < 60; t++) for (const e of es) Game._steer(e, 1 / 60, p);
    return { before: +before.toFixed(1), after: +minDistOf().toFixed(1), want: +(es[0].r * 2 * 0.95).toFixed(1) };
  });
  ok('separation.pushesApart', sep.after > sep.before && sep.after >= sep.want * 0.7,
    `겹친 4마리 최소 간격 ${sep.before} → ${sep.after}px (목표 ${sep.want}) — 종전엔 완전히 포개졌다`);

  // ── 카드가 규칙을 바꾸는가 (v169) ──
  await boot(page, { cls: 'knight', heat: 0 });
  const cards = await page.evaluate(() => {
    const stat = TRAITS.filter((t) => t.tag === '스탯');
    const cap = (t) => (t.stack ? (t.max || 1) : 1);
    const statCap = stat.reduce((a, t) => a + cap(t), 0);
    const allCap = TRAITS.reduce((a, t) => a + cap(t), 0);
    // 등장 분포 — 스탯이 카드 풀을 지배하지 않는가
    const p = Game.player;
    let statSeen = 0, total = 0;
    for (let i = 0; i < 400; i++) for (const c of rollTraitCards(p, 3)) { total++; if (c.tag === '스탯') statSeen++; }
    return { statCap, allCap, statPct: Math.round(statSeen / total * 100), peaks: TRAITS.filter((t) => t.peak).length };
  });
  ok('cards.statStackTrimmed', cards.statCap <= 30 && cards.allCap <= 100,
    `스탯 중복 상한 ${cards.statCap}장 (v168은 52) · 전체 ${cards.allCap}장 (121)`);
  ok('cards.statNotDominant', cards.statPct <= 32,
    `카드 3장 400회 중 스탯 비중 ${cards.statPct}%`);

  const peak = await page.evaluate(() => {
    const p = Game.player;
    const out = {};
    const take = (id, n) => { const t = TRAITS.find((x) => x.id === id); for (let i = 0; i < n; i++) applyTrait(p, t); };
    take('atk', 3); out.atkPeak = !!p.flags.atkPeak;
    take('hp', 3); out.hpPeak = !!p.flags.hpPeak;
    take('crit', 3); out.critPeak = !!p.flags.critPeak;
    take('dashcd', 2); out.dashPeak = !!p.flags.dashPeak;
    // 불굴: 치명상을 한 번 버틴다
    p.god = false; p.invuln = 0; p.hp = 1; p._hpPeakUsed = false;
    Game.hurtPlayer(99, { x: 1, y: 0 });
    out.enduredHp = p.hp; out.used = !!p._hpPeakUsed;
    p.invuln = 0; p.hp = 1;
    Game.hurtPlayer(99, { x: 1, y: 0 });
    out.secondHp = p.hp;   // 두 번째는 못 버틴다 (런당 1회)
    return out;
  });
  ok('cards.peaksUnlock', peak.atkPeak && peak.hpPeak && peak.critPeak && peak.dashPeak,
    '힘 단련·강골·급소 간파·바람걸음 정점 4종 발동');
  ok('cards.enduranceOncePerRun', peak.enduredHp === 1 && peak.used && peak.secondHp <= 0,
    `불굴 — 첫 치명상 HP ${peak.enduredHp}로 버팀, 두 번째는 ${peak.secondHp}`);

  ok('noPageErrors', errs.length === 0, errs.slice(0, 3).join(' | '));

  await browser.close();
  const fails = R.filter((r) => !r.v);
  console.log(`\n=== ${fails.length ? '실패 ' + fails.length + '건: ' + fails.map((f) => f.k).join(', ') : `전부 통과 (${R.length}항목)`} ===`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
