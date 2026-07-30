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
    const p = Game.player;
    // v171: 기준은 층 입구가 아니라 **보스와 싸울 때의 몸** — f와 f+1 사이 0.8 지점
    const a = Game._normalRef(3, 'knight'), b2 = Game._normalRef(4, 'knight');
    const mx = (x, y) => x + (y - x) * 0.8;
    const ref = { lv: mx(a.lv, b2.lv), hp: mx(a.hp, b2.hp), atk: mx(a.atk, b2.atk), tr: mx(a.tr, b2.tr), rel: mx(a.rel, b2.rel) };
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

  // v171: B가 **모든 층에서** 빌드를 올리는가 (1층 포함).
  // v165~v170은 기준선을 층 **입구**에서 재는 바람에 1층 targetLv=1 → 아무 일도 안 일어났다
  const bkey = await page.evaluate(() => {
    const out = [];
    for (const f of [1, 2, 3, 5, 8]) {
      Game.restart(); Game.state = 'play'; Dungeon.floor = f;
      const lv0 = Game.level, tr0 = Game.player.traits.length;
      Game._cheatScaleToFloor();
      out.push({ f, lv0, lv: Game.level, tr: Game.player.traits.length, rel: Game.player.relics.length });
    }
    return out;
  });
  ok('cheat.scalesEveryFloor', bkey.every((r) => r.lv > r.lv0 && r.tr > 0 && r.rel > 0),
    bkey.map((r) => `${r.f}층 Lv${r.lv0}→${r.lv}/특${r.tr}/유${r.rel}`).join(' · '));
  ok('cheat.monotonic', bkey.every((r, i) => i === 0 || r.lv >= bkey[i - 1].lv),
    '깊은 층일수록 강한 빌드');

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
    // v172: 층을 지정해서 잰다. 스탯 감쇠(×0.6)는 3층부터고, 1~2층은 일부러 안 누른다 —
    // 온보딩에 뽑을 카드가 몇 장 없는데 스탯까지 누르면 화력을 얻을 창이 통째로 닫힌다.
    // 종전엔 1층에서 재고 3층 기준(32%)으로 판정해서, **의도된 설계를 실패로 읽었다**
    const share = (floor) => {
      Dungeon.floor = floor;
      let statSeen = 0, total = 0;
      for (let i = 0; i < 400; i++) for (const c of rollTraitCards(p, 3)) { total++; if (c.tag === '스탯') statSeen++; }
      return Math.round(statSeen / total * 100);
    };
    const early = share(1), mid = share(5);
    Dungeon.floor = 1;
    return { statCap, allCap, early, mid, peaks: TRAITS.filter((t) => t.peak).length };
  });
  ok('cards.statStackTrimmed', cards.statCap <= 30 && cards.allCap <= 100,
    `스탯 중복 상한 ${cards.statCap}장 (v168은 52) · 전체 ${cards.allCap}장 (121)`);
  ok('cards.statNotDominant', cards.mid <= 32,
    `3층+ 카드 3장 400회 중 스탯 비중 ${cards.mid}% (1층은 ${cards.early}%)`);
  ok('cards.statCarriesOnboarding', cards.early >= cards.mid,
    `1층 스탯 비중 ${cards.early}% ≥ 3층+ ${cards.mid}% — 온보딩에서만 스탯을 안 누른다`);

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

  // ── 상자가 결정이 되는가 (v170) ──
  await boot(page, { cls: 'knight', heat: 0 });
  const chest = await page.evaluate(() => {
    const p = Game.player; p.maxHp = 8; p.hp = 8;
    Dungeon.tookRelicChest = false;
    Game.interactables.length = 0;
    Game.interactables.push({ kind: 'chest', x: p.x, y: p.y, used: false, r: 20 });
    Game.state = 'play';
    for (let i = 0; i < 20; i++) Game.tick(1 / 60);   // 상자 위에 서 있으면 열린다
    const opened = { state: Game.state, n: (Game.relicCards || []).length, src: Game._relicSource };
    const costCard = (Game.relicCards || []).findIndex((c) => c.costHp);
    const before = { hp: p.maxHp, rel: p.relics.length };
    // 대가는 acquireRelic **전에** 치러진다. 유물 자체가 최대 HP를 올리면 순증감이 상쇄되므로
    // (예: 「식지 않은 심장 조각」 +1) 지불 직후 시점을 붙잡아야 정확하다
    let paidHp = null;
    const oAcq = Game.acquireRelic.bind(Game);
    Game.acquireRelic = function (r) { paidHp = p.maxHp; return oAcq(r); };
    Game.choiceLockT = 0;
    Game.pickRelic(costCard >= 0 ? costCard : 0);
    Game.acquireRelic = oAcq;
    const after = { hp: p.maxHp, rel: p.relics.length, state: Game.state, paidHp };
    return { opened, costIdx: costCard, before, after };
  });
  ok('chest.threeWayChoice', chest.opened.state === 'relic' && chest.opened.n === 3 && chest.opened.src === 'chest',
    `상자 → 유물 ${chest.opened.n}장 중 1택 (v169까지는 랜덤 1개 강제 = 결정 없음)`);
  ok('chest.costCardExists', chest.costIdx >= 0, `대가 카드 ${chest.costIdx + 1}번 (한 등급 위 · 최대 HP -1)`);
  ok('chest.costIsPaid',
    chest.after.rel === chest.before.rel + 1 && chest.after.paidHp === chest.before.hp - 1 && chest.after.state === 'play',
    `대가 카드 선택 → 유물 +1 · 지불 시점 최대 HP ${chest.before.hp}→${chest.after.paidHp}` +
    (chest.after.hp !== chest.after.paidHp ? ` (유물 효과로 최종 ${chest.after.hp})` : ''));

  // ── 지형 (v172) ──
  await boot(page, { cls: 'knight', heat: 0 });
  const terrain = await page.evaluate(() => {
    const solid = () => { let w = 0;
      for (let y = 1; y < World.rows - 1; y++) for (let x = 1; x < World.cols - 1; x++) { const v = World.map[y][x]; if (v === 1 || v === 3) w++; }
      return w; };
    const fp = () => World.map.map((r) => r.join('')).join('/');
    // 연결성: 지날 수 있는 칸이 전부 서로 닿는가 (갇힌 칸 = 소프트락).
    // '지날 수 있다'는 World.isSolidTile의 정의를 그대로 쓴다 — 용암(2)은 아프지만 지나간다.
    // 균열 벽(부수면 열리는 벽감)은 통과 취급 — 그건 사고가 아니라 M3 비밀 통로다
    const connected = () => {
      const cracks = new Set((World.crackSpots || []).map((s) => s.tx + ',' + s.ty));
      const openAt = (x, y) => x > 0 && y > 0 && x < World.cols - 1 && y < World.rows - 1 &&
        (!World.isSolidTile(x, y) || cracks.has(x + ',' + y));
      let start = null;
      for (let y = 1; y < World.rows - 1 && !start; y++) for (let x = 1; x < World.cols - 1; x++) if (openAt(x, y)) { start = [x, y]; break; }
      if (!start) return true;
      const seen = new Set([start.join(',')]); const q = [start];
      while (q.length) { const [x, y] = q.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
          if (!seen.has(k) && openAt(nx, ny)) { seen.add(k); q.push([nx, ny]); } } }
      let total = 0;
      for (let y = 1; y < World.rows - 1; y++) for (let x = 1; x < World.cols - 1; x++) if (openAt(x, y)) total++;
      return seen.size === total;
    };
    const out = {};
    for (const ty of ['combat', 'siege', 'trial', 'boss']) {
      const seen = new Set(); const walls = []; const tags = {}; let bad = 0;
      for (let i = 0; i < 120; i++) {
        Dungeon.floor = 1 + (i % 10); Dungeon.roomIndex = 2 + (i % 6); Dungeon._forceSeed = null;
        World.buildRoom(Dungeon.roomIndex, ty, Dungeon.floor);
        seen.add(fp()); walls.push(solid());
        tags[World.lastTemplateTag] = (tags[World.lastTemplateTag] || 0) + 1;
        if (!connected()) bad++;
      }
      out[ty] = { uniq: seen.size, avg: +(walls.reduce((a, b) => a + b, 0) / walls.length).toFixed(1),
        tags: Object.keys(tags).length, disconnected: bad };
    }
    return out;
  });
  console.log('  지형:', JSON.stringify(terrain));
  ok('terrain.siegeHasCover', terrain.siege.uniq >= 40 && terrain.siege.avg >= 12 && terrain.siege.tags >= 3,
    `습격방 고유맵 ${terrain.siege.uniq} · 막는 칸 ${terrain.siege.avg} · 태그 ${terrain.siege.tags}종 (v171은 고유맵 2 · 7.2칸 · 1종)`);
  ok('terrain.bossHasCover', terrain.boss.uniq >= 50 && terrain.boss.avg >= 9,
    `보스방 고유맵 ${terrain.boss.uniq} · 막는 칸 ${terrain.boss.avg} (v171은 41 · 8칸 — 예고를 읽어도 갈 곳이 없었다)`);
  ok('terrain.allConnected',
    ['combat', 'siege', 'trial', 'boss'].every((k) => terrain[k].disconnected === 0),
    '전 방 타입 480개 표본에서 갇힌 칸 0 (소프트락 없음)');

  // ── 온보딩 화력 안전망 (v172) ──
  const fire = await page.evaluate(() => {
    const DMG = new Set(['atk', 'aspd', 'crit', 'critdmg', 'combo']);
    let stuck = 0; const N = 300;
    Dungeon.floor = 1;
    for (let r = 0; r < N; r++) {
      const p = createPlayer(0, 0, 'knight');
      for (let k = 0; k < 4; k++) {
        const cards = rollTraitCards(p, 3);
        const c = cards.find((x) => DMG.has(x.id)) || cards[0];
        if (c) applyTrait(p, c);
      }
      if (p.currentAtk() <= 1) stuck++;
    }
    return { stuckPct: Math.round(stuck / N * 100) };
  });
  ok('onboard.firepowerFloor', fire.stuckPct === 0,
    `1층 카드 4장 뒤 공격력 1 그대로: ${fire.stuckPct}% (v171은 67% — 공1로 95HP 보스를 만났다)`);

  // ── 계측 오염 차단: 빌드 화력 vs 상태 화력 (v173) ──
  await boot(page, { cls: 'archer', heat: 8 });
  const atkSep = await page.evaluate(() => {
    const p = Game.player;
    p.bonusAtk = 0; p.floorAtk = 0; p.form = null; p.flags = {}; p.rflags = {}; p.relics = [];
    p._vs = 0; p._chaliceT = 0; p._hornT = 0; p._vengeT = 0;
    const b0 = p.buildAtk(), c0 = p.currentAtk();
    // 죽기 직전 + 현상금8 + 골드 — 사장 F9의 궁수가 있던 그 상태
    p.rflags.blackcandle = true; p.rflags.nail = true; p.rflags.berserkhelm = true;
    p.rflags.debt = true; Game.gold = 300; p.maxHp = 10; p.hp = 1;
    p.form = 'venge'; p._vs = 8;
    const b1 = p.buildAtk(), c1 = p.currentAtk();
    // 진짜 빌드 성장 (힘 단련 2장) 은 buildAtk에 반영돼야 한다
    const might = TRAITS.find((t) => t.id === 'atk');
    applyTrait(p, might); applyTrait(p, might);
    return { b0, c0, b1: +b1.toFixed(1), c1: +c1.toFixed(1), b2: +p.buildAtk().toFixed(1) };
  });
  ok('atk.buildIgnoresState', atkSep.b1 === atkSep.b0 && atkSep.c1 > atkSep.c0 + 5,
    `상태만 바꿨을 때 빌드화력 ${atkSep.b0}→${atkSep.b1} (불변) · 상태화력 ${atkSep.c0}→${atkSep.c1} ` +
    `(v172는 리포트가 상태화력을 찍어 같은 빌드가 공2로도 공7로도 기록됐다)`);
  ok('atk.buildTracksTraits', atkSep.b2 > atkSep.b1,
    `힘 단련 2장 → 빌드화력 ${atkSep.b1}→${atkSep.b2} (진짜 성장은 잡는다)`);

  const logAtk = await page.evaluate(() => {
    const p = Game.player;
    p.rflags.blackcandle = true; p.maxHp = 10; p.hp = 1; p.rflags.nail = true;
    const build = +p.buildAtk().toFixed(1), now = +p.currentAtk().toFixed(1);
    Meta.data.playLog = [];
    Game.endRun(false, '검증');
    const r = (Meta.data.playLog || [])[0] || {};
    return { build, now, rec: r.atk, recNow: r.atkNow, alt: r.alt };
  });
  ok('report.recordsBuildAtk', logAtk.rec === logAtk.build && logAtk.recNow === logAtk.now,
    `리포트 기록 공${logAtk.rec} (빌드 ${logAtk.build}) · 임종 ${logAtk.recNow} (상태 ${logAtk.now})`);

  // ── 사운드 개편 (v174) — 들을 수는 없지만 잴 수는 있다 ──
  const audio = await page.evaluate(async () => {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    // ★ 오프라인 렌더는 AudioSys의 노드 참조를 통째로 갈아끼운다. 끝나고 ctx만 되돌리면
    // master/sfxBus/revBus 등이 **죽은 오프라인 노드를 가리킨 채** 남아, 뒤에 오는 테스트의
    // 모든 소리가 'cannot connect to an AudioNode belonging to a different audio context'로 죽는다.
    // 계측 도구가 게임을 오염시키는 바로 그 패턴 — 전 필드를 저장·복구한다
    const KEYS = ['ctx', 'master', 'limiter', 'sfxBus', 'musicBus', 'duck', 'musicLP', 'musicLvl',
      'revBus', 'revMusIn', 'musicFx', 'reverbIn', 'revSend', 'conv', 'revWet', 'revHP',
      '_noiseBuf', 'space', '_gates'];
    const render = async (fn, sec = 1.2) => {
      const oc = new OAC(2, Math.ceil(44100 * sec), 44100);
      const save = {};
      for (const k of KEYS) save[k] = AudioSys[k];
      AudioSys.ctx = oc; AudioSys.muted = false;
      AudioSys.limiter = oc.createDynamicsCompressor(); AudioSys.limiter.connect(oc.destination);
      AudioSys.master = oc.createGain(); AudioSys.master.gain.value = 0.35; AudioSys.master.connect(AudioSys.limiter);
      AudioSys.sfxBus = oc.createGain(); AudioSys.musicBus = oc.createGain();
      AudioSys.duck = oc.createGain(); AudioSys.duck.gain.value = 1;
      AudioSys.musicBus.connect(AudioSys.duck).connect(AudioSys.master);
      AudioSys.sfxBus.connect(AudioSys.master);
      AudioSys.sfxBus.gain.value = 0.8; AudioSys.musicBus.gain.value = 0.8;
      AudioSys.revBus = oc.createGain();
      // v176 신설 노드도 오프라인 사본으로 갈아끼운다 — 안 그러면 음악 send가
      // **온라인 노드를 가리킨 채** 남아 교차 컨텍스트 연결로 죽는다
      AudioSys.musicLP = oc.createBiquadFilter(); AudioSys.musicLP.type = 'lowpass'; AudioSys.musicLP.frequency.value = 16000;
      AudioSys.musicLvl = oc.createGain(); AudioSys.musicLvl.gain.value = 0.85;
      AudioSys.revMusIn = oc.createGain(); AudioSys.revMusIn.connect(AudioSys.revBus);
      AudioSys.musicFx = AudioSys.musicBus; AudioSys.reverbIn = AudioSys.revMusIn; AudioSys.revSend = AudioSys.revBus;
      AudioSys.conv = oc.createConvolver(); AudioSys.conv.normalize = false; AudioSys.conv.buffer = AudioSys._makeIR(1.6, 2.6);
      AudioSys.revWet = oc.createGain(); AudioSys.revWet.gain.value = 0.34;
      AudioSys.revHP = oc.createBiquadFilter(); AudioSys.revHP.type = 'highpass'; AudioSys.revHP.frequency.value = 320;
      AudioSys.revBus.connect(AudioSys.revHP).connect(AudioSys.conv).connect(AudioSys.revWet).connect(AudioSys.master);
      const n = oc.sampleRate;
      AudioSys._noiseBuf = oc.createBuffer(1, n, oc.sampleRate);
      const d = AudioSys._noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      AudioSys.space = null; AudioSys._gates = {};
      fn();
      const buf = await oc.startRendering();
      for (const k of KEYS) AudioSys[k] = save[k];
      return buf;
    };
    const zcr = (buf) => { const L = buf.getChannelData(0); let cz = 0, n = 0, prev = 0;
      for (let i = 0; i < L.length; i++) { if (Math.abs(L[i]) < 0.0005) continue;
        if ((L[i] > 0) !== (prev > 0) && n > 0) cz++; prev = L[i]; n++; }
      return n ? (cz / n) * buf.sampleRate / 2 : 0; };
    const bal = (buf) => { const L = buf.getChannelData(0), R = buf.getChannelData(1);
      let el = 0, er = 0; for (let i = 0; i < L.length; i++) { el += L[i] * L[i]; er += R[i] * R[i]; }
      return (el + er) ? (er - el) / (el + er) : 0; };
    const tail = (buf) => { const L = buf.getChannelData(0); let last = 0;
      for (let i = 0; i < L.length; i++) if (Math.abs(L[i]) > 0.0008) last = i;
      return last / buf.sampleRate; };
    // ★ 변주는 **플레이어가 실제로 듣는 경로**로 잰다. 게임은 구운 뱅크(재질당 6종)를
    // 랜덤 재생하고 그 위에 재생속도 지터(±4%)를 얹는다. 실시간 합성은 뱅크가 구워지기 전
    // 몇 초 동안만 쓰이는 대체 경로다 — 그걸 재면 대체 경로를 상품으로 착각하게 된다
    const hz = [];
    const bank = AudioSys._pcm && AudioSys._pcm.hit_flesh;
    if (bank && bank.length) {
      for (const b of bank) hz.push(zcr(b));
    } else {
      for (let i = 0; i < 24; i++) hz.push(zcr(await render(() => AudioSys.hit('flesh', 480))));
    }
    const mean = hz.reduce((a, c) => a + c, 0) / hz.length;
    const sd = Math.sqrt(hz.reduce((a, c) => a + (c - mean) ** 2, 0) / hz.length);
    return {
      varPct: +(sd / mean * 100).toFixed(1),
      left: +bal(await render(() => AudioSys.hit('bone', 60))).toFixed(2),
      right: +bal(await render(() => AudioSys.hit('bone', 900))).toFixed(2),
      mid: +bal(await render(() => AudioSys.hit('bone', 480))).toFixed(2),
      tailHit: +tail(await render(() => AudioSys.hit('stone', 480))).toFixed(2),
      shots: Object.keys(Ambience._SHOTS).length,
      acts: Object.keys(Ambience._ACTS).length,
      spaces: Object.keys(AudioSys._SPACES).length,
      hasNew: ['telegraph', 'whiff', 'block', 'execute', 'ducker', 'setSpace'].every((k) => typeof AudioSys[k] === 'function'),
    };
  });
  console.log('  사운드:', JSON.stringify(audio));
  // 임계 8%: 24표본 ZCR도 표본오차가 ±3%p 정도 있다. 종전 계측 중앙값 1.9%(반음의 1/3)와는
  // 여전히 4배 이상 차이가 나므로 판정은 명확하다. 구운 뱅크의 변주는 tone.variantsBaked가 따로 잰다
  ok('audio.hitVaries', audio.varPct >= 8,
    `구운 뱅크 6종의 음색 중심 변주 SD ${audio.varPct}% + 재생속도 지터 ±4% ` +
    '(v173은 계측 중앙값 1.9% — 반음의 1/3이라 3분이면 귀가 지쳤다)');
  // 중앙값 임계 0.35: 리버브 IR이 채널별로 다른 잡음이라 웨트가 좌우로 조금 갈린다(의도된 폭).
  // 좌우 극단이 ±0.9인 것에 비하면 중앙은 충분히 가운데다
  ok('audio.stereoPan', audio.left <= -0.4 && audio.right >= 0.4 && Math.abs(audio.mid) < 0.35,
    `좌 ${audio.left} / 중앙 ${audio.mid} / 우 ${audio.right} (v173은 모노 — 패닝 노드 0개)`);
  ok('audio.hasReverbTail', audio.tailHit >= 0.4,
    `타격 잔향 꼬리 ${audio.tailHit}초 (v173은 T60 중앙값 0.19초 = 무향실)`);
  ok('audio.ambienceExists', audio.shots >= 12 && audio.acts >= 6 && audio.spaces >= 5,
    `환경음 원샷 ${audio.shots}종 · 막 프리셋 ${audio.acts} · 공간 ${audio.spaces} (v173은 환경음 0개)`);
  ok('audio.newLayers', audio.hasNew,
    '예고음·헛손질·막힘·처형·덕킹·공간전환 신설 (예고는 게임플레이 — 화면을 안 봐도 읽혀야 한다)');

  // ══ 음악 개편 (v176) ══════════════════════════════════════════════════
  // 진단서가 잰 세 가지 병:
  //   ① 50층 게임의 고유 음악 총량이 121.5초 — 12테마 전부 4마디 뒤 완전 반복
  //   ② 게임의 80%(11~50층)가 f6~f10 5곡 순환. 그 5곡 상호거리 0.0918 =
  //      **같은 곡 안 마디끼리의 거리(0.0801)의 1.15배** — "다른 곡"이 아니었다
  //   ③ boss ↔ f4 거리 0.017 (66쌍 중 최소). 보스 23종·왕 3페이즈가 전부 같은 7.27초 루프
  // 아래는 그 세 숫자를 **같은 방식으로 다시 재서** 되돌아가지 않았는지 본다.
  // ★ 기준선을 하드코딩하지 않고 **같은 세션에서 함께 잰다** — 계측 방식이 바뀌어도 비교가 성립한다.
  const music = await page.evaluate(async () => {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const KEYS = ['ctx', 'master', 'limiter', 'sfxBus', 'musicBus', 'duck', 'musicLP', 'musicLvl',
      'revBus', 'revMusIn', 'musicFx', 'reverbIn', 'revSend', 'conv', 'revWet', 'revHP',
      '_noiseBuf', 'space', '_gates'];
    const R = {};

    // ── A) 곡 존재 — 무음 구간이 생기지 않는가 (층 60 × 상태 7 × 방 4 전수) ──
    {
      const f0 = Dungeon.floor, rt0 = Dungeon.roomType, st0 = Game.state;
      const bad = [];
      for (let f = 1; f <= 60; f++) {
        for (const st of ['play', 'hub', 'altar', 'classes', 'codex', 'over', 'victory']) {
          for (const rt of ['combat', 'boss', 'shop', 'treasure', 'elite']) {
            Dungeon.floor = f; Dungeon.roomType = rt; Game.state = st;
            const k = Game._musicKey();
            if (k !== null && !Music.themes[k]) bad.push(`${f}/${st}/${rt}=${k}`);
          }
        }
      }
      Dungeon.floor = f0; Dungeon.roomType = rt0; Game.state = st0;
      R.keyBad = bad.slice(0, 4); R.keyBadN = bad.length;
      R.themeN = Object.keys(Music.themes).length;
      R.floorThemeN = Object.keys(Music.themes).filter((k) => !Music.themes[k].bossKit && k !== 'boss').length;
    }

    // ── 기존 12곡 회귀 — 사장 지시: "지금 곡을 싫어한 게 아니라 부족하다" ──
    // bpm / roots / scale 이 v175와 한 글자도 달라지면 안 된다
    {
      const V175 = {
        hub: '66|45,41,43,45|0,3,7,10', f1: '92|38,38,41,36|0,3,5,7', f2: '86|40,40,43,45|0,2,3,7',
        f3: '102|36,36,39,41|0,1,5,7', f4: '118|38,38,36,34|0,3,6,7', f5: '82|33,33,36,32|0,1,3,7',
        f6: '100|36,36,39,34|0,3,5,6', f7: '94|38,38,41,43|0,1,3,7', f8: '110|34,34,37,39|0,1,4,7',
        f9: '126|36,36,34,32|0,3,6,10', f10: '76|31,31,34,30|0,1,6,7', boss: '132|36,36,34,39|0,1,6,7',
      };
      const drift = [];
      for (const k in V175) {
        const t = Music.themes[k];
        const sig = t ? `${t.bpm}|${t.roots.join(',')}|${t.scale.join(',')}` : 'MISSING';
        if (sig !== V175[k]) drift.push(`${k}: ${sig}`);
      }
      R.drift = drift;
    }

    // ── 렌더 하네스 ──────────────────────────────────────────────────────
    // 게임 루프·라이브 스케줄러를 세운다. 안 세우면 그것들이 오프라인 컨텍스트에 음을 흘려
    // 계측값이 매번 달라진다 (계측 도구가 대상을 오염시키는 바로 그 패턴)
    const tick0 = Game.tick; Game.tick = () => {};
    if (Music._timer) { clearInterval(Music._timer); Music._timer = null; }
    if (Ambience._timer) { clearInterval(Ambience._timer); Ambience._timer = null; }
    const chain0 = Music._chain; Music._chain = null;
    const seeded = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const SR = 22050;

    const renderTheme = async (key, sec, nodeCount) => {
      const th = Music.themes[key];
      const oc = new OAC(1, Math.ceil(SR * sec), SR);
      const save = {}; for (const k of KEYS) save[k] = AudioSys[k];
      const rnd0 = Math.random; Math.random = seeded(20240729);
      const st0 = Music.step, lg0 = Music._layG, dg0 = Music._deckG, dt0 = Music._deckTail;
      const i0 = Music.iCur, p0 = Music.perilCur;
      let made = 0;
      try {
        AudioSys.ctx = oc; AudioSys.muted = false;
        AudioSys.master = oc.createGain(); AudioSys.master.connect(oc.destination);
        AudioSys.limiter = null; AudioSys.musicLP = null; AudioSys.musicLvl = null;
        AudioSys.sfxBus = oc.createGain(); AudioSys.sfxBus.connect(AudioSys.master);
        AudioSys.musicBus = oc.createGain(); AudioSys.musicBus.connect(AudioSys.master);
        AudioSys.duck = oc.createGain();
        AudioSys.revBus = oc.createGain(); AudioSys.revBus.connect(AudioSys.master);
        AudioSys.revMusIn = oc.createGain(); AudioSys.revMusIn.connect(AudioSys.revBus);
        AudioSys.musicFx = AudioSys.musicBus; AudioSys.reverbIn = AudioSys.revMusIn; AudioSys.revSend = AudioSys.revBus;
        AudioSys.conv = null; AudioSys.revWet = null; AudioSys.revHP = null;
        const nb = oc.createBuffer(1, SR, SR), nd = nb.getChannelData(0);
        for (let i = 0; i < SR; i++) nd[i] = Math.random() * 2 - 1;
        AudioSys._noiseBuf = nb; AudioSys.space = null; AudioSys._gates = {};
        if (nodeCount) {
          const o1 = oc.createOscillator.bind(oc), o2 = oc.createBufferSource.bind(oc), o3 = oc.createGain.bind(oc);
          oc.createOscillator = () => { made++; return o1(); };
          oc.createBufferSource = () => { made++; return o2(); };
          oc.createGain = () => { made++; return o3(); };
        }
        // 편성을 전부 켠 상태로 비교한다 (레이어 게이팅은 별개 축이다)
        Music._layG = { bass: 1, sub: 1, arp: 1, pad: 1, drum: 1, hat: 1, snare: 0, drive: 0,
          tension: 0, fill: 1, tfill: 1, heart: 0, bell: 1, lead: 1, orn: 1, bossCore: 0, bossP2: 0, bossP3: 0 };
        Music._deckG = 1; Music._deckTail = false; Music.iCur = 0; Music.perilCur = 0;
        Music._nb = 0; Music._nbT = -1e9;
        if (typeof BossAudio !== 'undefined') {
          BossAudio._chains = null; BossAudio._chainKey = null; BossAudio.stage = 1; BossAudio.activeDefId = 1;
        }
        const stepDur = 60 / th.bpm / 4;
        const n = Math.floor(sec / stepDur);
        for (let i = 0; i < n; i++) { Music.step = i; Music._schedule(i * stepDur, th, null); }
        const buf = await oc.startRendering();
        return { d: buf.getChannelData(0), made, sec };
      } finally {
        Math.random = rnd0;
        for (const k of KEYS) AudioSys[k] = save[k];
        Music.step = st0; Music._layG = lg0; Music._deckG = dg0; Music._deckTail = dt0;
        Music.iCur = i0; Music.perilCur = p0;
        if (typeof BossAudio !== 'undefined') { BossAudio._chains = null; BossAudio._chainKey = null; }
      }
    };

    // 32밴드 로그 스펙트럼 히스토그램 (radix-2 FFT) → L1/2 거리
    const fft = (re, im) => {
      const n = re.length;
      for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
      }
      for (let len = 2; len <= n; len <<= 1) {
        const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
          let cr = 1, ci = 0;
          for (let k = 0; k < len / 2; k++) {
            const ur = re[i + k], ui = im[i + k];
            const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
            const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
            re[i + k] = ur + vr; im[i + k] = ui + vi;
            re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
            const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
          }
        }
      }
    };
    const N = 1024, HOP = 512, NB = 32, FLO = 40, FHI = 10000, LG = Math.log(FHI / FLO);
    const win = new Float64Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
    const spec = (d) => {
      const bands = new Float64Array(NB);
      for (let o = 0; o + N <= d.length; o += HOP) {
        const re = new Float64Array(N), im = new Float64Array(N);
        for (let i = 0; i < N; i++) re[i] = d[o + i] * win[i];
        fft(re, im);
        for (let k = 1; k < N / 2; k++) {
          const f = k * SR / N;
          if (f < FLO || f > FHI) continue;
          bands[Math.min(NB - 1, Math.floor(NB * Math.log(f / FLO) / LG))] += re[k] * re[k] + im[k] * im[k];
        }
      }
      let s = 0; for (let i = 0; i < NB; i++) s += bands[i];
      if (s > 0) for (let i = 0; i < NB; i++) bands[i] /= s;
      return bands;
    };
    const dist = (a, c) => { let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - c[i]); return d / 2; };

    try {
      const keys = Object.keys(Music.themes);
      const S = {}, MADE = {};
      for (const k of keys) { const r = await renderTheme(k, 8, true); S[k] = spec(r.d); MADE[k] = +(r.made / r.sec).toFixed(1); }

      // B) 막 구분 — 하강하며 겪는 연속 전환 거리 vs 종전 5곡 순환의 상호거리
      const seq = []; let prev = null;
      for (let f = 1; f <= 60; f++) {
        const k = Music.floorKey(f);
        if (prev && k !== prev) seq.push({ f, d: dist(S[prev], S[k]) });
        prev = k;
      }
      const deep = seq.filter((s) => s.f >= 11).map((s) => s.d);
      const old = ['f6', 'f7', 'f8', 'f9', 'f10'], op = [];
      for (let i = 0; i < old.length; i++) for (let j = i + 1; j < old.length; j++) op.push(dist(S[old[i]], S[old[j]]));
      R.oldCycleAvg = +(op.reduce((a, c) => a + c, 0) / op.length).toFixed(4);
      R.deepMin = +Math.min(...deep).toFixed(4);
      R.deepAvg = +(deep.reduce((a, c) => a + c, 0) / deep.length).toFixed(4);
      R.allAvg = +(seq.reduce((a, c) => a + c.d, 0) / seq.length).toFixed(4);

      // C) 보스곡 — 서로 다른 키 개수 + 층 테마와의 최소 거리
      const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 45, 50, 60, 61, 62, 63, 64, 65, 66, 67];
      const bset = {};
      for (const id of ids) {
        if (typeof BossAudio !== 'undefined') BossAudio.activeDefId = null;
        bset[Music.bossKey({ defId: id, phase: 1, _onslaught: false })] = 1;
      }
      if (typeof BossAudio !== 'undefined') BossAudio.activeDefId = null;
      const kp = [1, 2, 3].map((n) => Music.bossKey({ defId: 50, phase: n >= 2 ? 2 : 1, _onslaught: n === 3 }));
      R.bossKeyN = Object.keys(bset).length;
      R.kingDistinct = new Set(kp).size;
      const bk = keys.filter((k) => Music.themes[k].bossKit);
      const fk = keys.filter((k) => !Music.themes[k].bossKit && k !== 'boss');
      let mn = 9, pair = '';
      for (const a of bk) for (const c of fk) { const d = dist(S[a], S[c]); if (d < mn) { mn = d; pair = a + '↔' + c; } }
      R.bossFloorMin = +mn.toFixed(4); R.bossFloorPair = pair;
      R.bossFloorBase = +dist(S.boss, S.f4).toFixed(4);   // v175의 최소쌍 (진단서 66쌍 중 최소)
      R.bossThemeN = bk.length;

      // I) 노드 예산 — MV_BUDGET을 조이면 정말로 얇아지는가 (게이트가 살아 있는가)
      const b0 = Music.MV_BUDGET;
      R.maxRate = Math.max(...Object.values(MADE));
      R.busiest = Object.keys(MADE).reduce((a, c) => (MADE[c] > MADE[a] ? c : a));
      Music.MV_BUDGET = 6;
      const lean = await renderTheme(R.busiest, 8, true);
      Music.MV_BUDGET = b0;
      R.leanRate = +(lean.made / lean.sec).toFixed(1);
    } finally {
      Game.tick = tick0; Music._chain = chain0;
    }

    // ── 동적 레이어 — 탐색/격전/위기가 실제로 편성을 바꾸는가 ──
    {
      const snap = (i, p, b) => {
        Music.iCur = i; Music.perilCur = p; Music.bpCur = b; Music.bossPhase = b; Music._brCur = 0; Music._slamT = 0;
        Music._calcLayers();
        return { drum: +Music._lay('drum').toFixed(2), snare: +Music._lay('snare').toFixed(2),
          sub: +Music._lay('sub').toFixed(2), arp: +Music._lay('arp').toFixed(2),
          bell: +Music._lay('bell').toFixed(2), tension: +Music._lay('tension').toFixed(2),
          tfill: +Music._lay('tfill').toFixed(2) };
      };
      R.explore = snap(0, 0, 0);
      R.fight = snap(2, 0, 0);
      R.peril = snap(3, 1, 3);
      Music.iCur = 0; Music.perilCur = 0; Music.bpCur = 0; Music.bossPhase = 0; Music._calcLayers();
      R.layerNames = Object.keys(Music._layG).length;
      // _schedule 안에서 _lv를 통과하지 않는 vol이 있으면 레이어가 안 걸린다 — 소스로 확인
      const src = Music._schedule.toString() + Music._drum.toString();
      // ★ 부정 룩어헤드는 반드시 공백까지 안에 넣어야 한다 — `vol:\s*(?!…)` 로 쓰면
      //   \s* 가 되감기(backtrack)해서 전부 매치돼 버린다 (이 단언이 처음에 41건을 오검출했다)
      R.volN = (src.match(/vol:/g) || []).length;
      R.rawVol = (src.match(/vol:(?!\s*this\._lv)/g) || []).length;
      R.afford = (src.match(/_afford\(/g) || []).length;
      R.hasDisconnect = /disconnect\(/.test(Music._initChain.toString());
    }
    return R;
  });
  console.log('  음악:', JSON.stringify(music));

  ok('music.keyCoverage', music.keyBadN === 0 && music.themeN >= 34 && music.floorThemeN >= 25,
    `테마 ${music.themeN}곡(층 ${music.floorThemeN} + 보스 ${music.themeN - music.floorThemeN}) · ` +
    `층60×상태7×방5 전수에서 존재하지 않는 키 ${music.keyBadN}건 ${music.keyBad.join(' ')} ` +
    `(v175는 12곡 — 11~50층 40개 층이 f6~f10 5곡 순환)`);
  ok('music.legacyThemesIntact', music.drift.length === 0,
    music.drift.length ? `바뀐 곡: ${music.drift.join(' / ')}`
      : '기존 12곡(hub·f1~f10·boss)의 bpm/roots/scale 불변 — 사장은 지금 곡을 싫어한 게 아니라 부족하다고 했다');
  ok('music.actIdentity', music.deepMin >= 0.094 && music.deepAvg >= 0.16 && music.deepMin > music.oldCycleAvg,
    `11층 이후 연속 전환 거리 최소 ${music.deepMin} / 평균 ${music.deepAvg} · 전 구간 평균 ${music.allAvg} ` +
    `vs 종전 5곡 순환 상호거리 평균 ${music.oldCycleAvg} (그 5곡은 "다른 곡"이 아니라 "같은 곡의 다른 마디"였다)`);
  ok('music.bossSeparated',
    music.bossKeyN >= 6 && music.kingDistinct === 3 && music.bossThemeN >= 8 &&
    music.bossFloorMin >= 0.05 && music.bossFloorMin > music.bossFloorBase * 2,
    `보스 23종 → 서로 다른 곡 ${music.bossKeyN}개 · 왕 페이즈 ${music.kingDistinct}종 · 보스 테마 ${music.bossThemeN}곡 · ` +
    `보스곡↔층테마 최소거리 ${music.bossFloorMin}(${music.bossFloorPair}) vs 구 boss↔f4 ${music.bossFloorBase} ` +
    `(v175는 이 쌍이 66쌍 중 최소 — 보스전 음악이 사실상 4층 배경음이었다)`);
  ok('music.budgetGate', music.leanRate < music.maxRate * 0.75 && music.maxRate <= 95,
    `가장 바쁜 곡 ${music.busiest} ${music.maxRate}노드/초 → MV_BUDGET 46→6 으로 조이면 ${music.leanRate}노드/초 ` +
    `(예산 게이트가 안 걸리면 이 둘이 같다 = 상한이 없다)`);
  ok('music.dynamicLayers',
    music.explore.drum === 0 && music.fight.drum > 0 && music.peril.sub > 0 &&
    music.explore.bell > 0 && music.explore.tfill > 0 && music.fight.snare > 0 && music.peril.tension > 0 &&
    music.rawVol === 0 && music.volN >= 35 && music.afford >= 20 && !music.hasDisconnect,
    `탐색 ${JSON.stringify(music.explore)} / 격전 ${JSON.stringify(music.fight)} / 위기+보스 ${JSON.stringify(music.peril)} · ` +
    `레이어 ${music.layerNames}종 · 편성 ${music.volN}줄 중 _lv를 안 거친 vol ${music.rawVol}개 · _afford 게이트 ${music.afford}곳 · ` +
    `_initChain에 disconnect ${music.hasDisconnect ? '있음(런타임 재배선 금지 위반)' : '없음'}`);

  // 덱 크로스페이드 + 보스 체인 회수 — 실시간 경로 (오프라인 렌더로는 안 잡힌다)
  const deck = await page.evaluate(async () => {
    AudioSys.unlock();
    const mk0 = Game._musicKey;
    Game._musicKey = () => window.__vk || 'f1';
    window.__vk = 'a3b'; Music.ensure('a3b');
    await new Promise((r) => setTimeout(r, 500));
    window.__vk = 'a3c'; Music.ensure('a3c');
    await new Promise((r) => setTimeout(r, 250));
    const mid = Music._decks.map((d) => ({ k: d.key, tail: d.tail }));
    const both = Music._decks.filter((d) => d.key === 'a3b' || d.key === 'a3c').length;
    // 등파워 곡선 — 두 덱의 위치가 서로 여집합일 때 총 에너지가 유지되는가
    const c = Music._curve, e = +(c(0.5) * c(0.5) + c(0.5) * c(0.5)).toFixed(3);
    // 보스곡 → 층곡: 보스 체인(지속 드론)이 덱 사망 시점에 걷히는가
    window.__vk = 'bossA1'; Music.ensure('bossA1');
    await new Promise((r) => setTimeout(r, 600));
    const bossChains = !!(typeof BossAudio !== 'undefined' && BossAudio._chains);
    window.__vk = 'f1'; Music.ensure('f1');
    await new Promise((r) => setTimeout(r, 1600));
    const released = !(typeof BossAudio !== 'undefined' && BossAudio._chains);
    Game._musicKey = mk0;
    return { mid, both, equalPower: e, bossChains, released, decks: Music._decks.length };
  });
  console.log('  덱:', JSON.stringify(deck));
  ok('music.crossfade', deck.both === 2 && deck.equalPower === 1 && deck.decks <= 3,
    `전환 중 덱 ${deck.both}개 공존 ${JSON.stringify(deck.mid)} · 등파워 sin²+cos²=${deck.equalPower} · 최대 덱 ${deck.decks} ` +
    `(v175는 stop()→start()라 곡이 뚝 끊겼다. 선형 합성이면 가운데서 3dB 구멍이 난다)`);
  ok('music.bossChainsReleased', deck.bossChains && deck.released,
    `보스곡 진입 시 지속 체인 생성 ${deck.bossChains} → 덱이 죽는 시점에 회수 ${deck.released} ` +
    `(Music.stop()에 넣으면 페이드 도중 드론만 뚝 끊긴다 — 시점이 다르다)`);

  // ── 예고 정직성 (v175) ──
  await boot(page, { cls: 'knight', heat: 0 });
  const tele = await page.evaluate(() => {
    // ① 예고가 몸 위에 그려지는가 — 적을 플레이어 위/아래에 두고 같은 프레임을 두 번 그려 픽셀 차분
    const p = Game.player;
    p.x = 480; p.y = 270; p.god = true;
    const diffAt = (dy) => {
      Game.enemies.length = 0;
      const e = createEnemy('skeleton', 480, 270 + dy, 1);
      Game.enemies.push(e);
      e._windT = 0; Game.render();
      const c = Renderer.canvas || document.querySelector('canvas');
      const g = c.getContext('2d');
      const a = g.getImageData(0, 0, c.width, c.height).data;
      e._windT = 0.12; e._windMax = 0.25; e._windA = dy > 0 ? -Math.PI / 2 : Math.PI / 2;
      Game.render();
      const b = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) n++;
      }
      return n;
    };
    const above = diffAt(-40), below = diffAt(40);
    Game.enemies.length = 0;
    // ② 강타 예고가 그려지는가
    const st = (() => {
      const e = createEnemy('skeleton', 480, 330, 1);
      Game.enemies.push(e);
      e._stompT = 0; Game.render();
      const c = Renderer.canvas || document.querySelector('canvas');
      const g = c.getContext('2d');
      const a = g.getImageData(0, 0, c.width, c.height).data;
      e._stompT = 0.3; Game.render();
      const b = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) n++;
      }
      Game.enemies.length = 0;
      return n;
    })();
    return { above, below, stomp: st };
  });
  console.log('  예고:', JSON.stringify(tele));
  ok('telegraph.notOccluded', tele.above >= tele.below * 0.6,
    `위에서 오는 예고 ${tele.above}px vs 아래 ${tele.below}px — 비율 ${(tele.above / (tele.below || 1)).toFixed(2)} ` +
    `(v174는 185 vs 937 = 0.20 — 위에서 오는 예고는 플레이어 몸에 덮여 20%만 보였다)`);
  ok('telegraph.stompHasRadius', tele.stomp > 500,
    `강타 예고 반경 렌더 ${tele.stomp}px (v174는 render-game.js에 _stompT 참조가 0건 — 사장의 사인이 안 보이는 기술이었다)`);

  const bossTele = await page.evaluate(() => {
    Dungeon.floor = 3; Dungeon.roomIndex = Dungeon.totalRooms; Dungeon.build('boss');
    const b = Game.enemies.find((e) => e.isBoss);
    const p = Game.player;
    p.god = false; p.invuln = 0; p.hp = p.maxHp = 20;
    b.x = 480; b.y = 270; p.x = 480; p.y = 270;   // 완전 밀착
    // 등장 연출('enter')은 1.2초 뒤 'idle'로 넘어간다 — 그 전엔 접촉 판정이 안 돈다
    b.state = 'idle'; b.stateT = 0; b.spawnT = 0;
    b.hitCd = 0; b._windT = 0;
    const hp0 = p.hp;
    Game.tick(1 / 60);
    const wind = b._windT;                         // 예고가 섰는가
    const hpAfterWind = p.hp;                      // 예고 중엔 피해가 없어야 한다
    for (let i = 0; i < 30; i++) { b.x = 480; b.y = 270; p.x = 480; p.y = 270; Game.tick(1 / 60); }
    const hpAfter = p.hp;
    // 물러나면 헛손질인가
    b.hitCd = 0; b._windT = 0; b.state = 'idle'; p.hp = p.maxHp; p.invuln = 0;
    b.x = 480; b.y = 270; p.x = 480; p.y = 270;
    Game.tick(1 / 60);
    for (let i = 0; i < 30; i++) { b.x = 480; b.y = 270; p.x = 900; p.y = 270; Game.tick(1 / 60); } // 예고 도중 도망
    return { wind: +wind.toFixed(2), noDmgDuringWind: hpAfterWind === hp0, hit: hpAfter < hp0,
      whiffed: p.hp === p.maxHp, whiffT: +(b._whiffT || 0).toFixed(2) };
  });
  console.log('  보스 예고:', JSON.stringify(bossTele));
  ok('telegraph.bossHasWindup', bossTele.wind > 0 && bossTele.noDmgDuringWind && bossTele.hit,
    `보스 접촉: 예고 ${bossTele.wind}초 → 예고 중 피해 없음 → 만료 시 명중 ` +
    `(v174까지 보스만 예고 0초 — 공용 훅을 안 타서 v168에서 통째로 빠졌다)`);
  ok('telegraph.bossCanWhiff', bossTele.whiffed,
    `예고 중 물러나면 보스도 헛손질 (반격의 창 ${bossTele.whiffT}초)`);

  const guard = await page.evaluate(() => {
    // 루프 도중 배열 교체 — 종전엔 TypeError가 새어 그 틱의 나머지가 통째로 날아갔다
    Dungeon.floor = 1; Dungeon.roomIndex = 2; Dungeon.build('combat');
    const p = Game.player; p.god = false; p.invuln = 0; p.hp = p.maxHp = 20;
    Game.arrows = [];
    for (let i = 0; i < 5; i++) Game.arrows.push({ x: p.x, y: p.y, dir: { x: 1, y: 0 }, r: 6, life: 5, t: 0, dmg: 1, speed: 0, by: '검증' });
    const orig = Game.hurtPlayer;
    let swapped = false;
    Game.hurtPlayer = function (...a) { if (!swapped) { swapped = true; Game.arrows = []; } return orig.apply(this, a); };
    let threw = '';
    try { Game.tick(1 / 60); } catch (e) { threw = e.message.slice(0, 80); }
    Game.hurtPlayer = orig;
    return { threw, swapped };
  });
  ok('loop.survivesArraySwap', guard.swapped && !guard.threw,
    guard.threw ? `크래시: ${guard.threw}` :
      '루프 도중 배열이 교체돼도 틱이 살아남는다 (v174는 TypeError가 새어 그 틱의 적 업데이트·방 클리어 판정·렌더가 통째로 건너뛰어졌다)');

  // ── 거리 모형 · 예고 사다리 · 스킬 (v177) ──
  await boot(page, { cls: 'knight', heat: 0 });
  const spa = await page.evaluate(async () => {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const KEYS = ['ctx', 'master', 'limiter', 'sfxBus', 'musicBus', 'duck', 'revBus', 'conv',
      'revWet', 'revHP', '_noiseBuf', 'space', '_gates', 'musicLP', 'musicLvl', 'revMusIn',
      'musicFx', 'reverbIn', 'revSend', '_pcm'];
    const mt = Music._timer, at2 = Ambience._timer;
    if (mt) { clearInterval(mt); Music._timer = null; }
    if (at2) { clearInterval(at2); Ambience._timer = null; }
    const render = async (fn, sec = 1.6) => {
      const oc = new OAC(2, Math.ceil(44100 * sec), 44100);
      const save = {};
      for (const k of KEYS) save[k] = AudioSys[k];
      AudioSys.ctx = oc; AudioSys.muted = false;
      AudioSys.limiter = oc.createDynamicsCompressor(); AudioSys.limiter.connect(oc.destination);
      AudioSys.master = oc.createGain(); AudioSys.master.gain.value = 0.35; AudioSys.master.connect(AudioSys.limiter);
      AudioSys.sfxBus = oc.createGain(); AudioSys.musicBus = oc.createGain();
      AudioSys.duck = oc.createGain(); AudioSys.duck.gain.value = 1;
      AudioSys.musicBus.connect(AudioSys.duck).connect(AudioSys.master);
      AudioSys.sfxBus.connect(AudioSys.master);
      AudioSys.sfxBus.gain.value = 0.8; AudioSys.musicBus.gain.value = 0.8;
      AudioSys.musicLP = null; AudioSys.musicLvl = null;
      AudioSys.revMusIn = AudioSys.musicFx = AudioSys.reverbIn = AudioSys.revSend = null;
      AudioSys.revBus = oc.createGain();
      AudioSys.conv = oc.createConvolver(); AudioSys.conv.normalize = false;
      AudioSys.conv.buffer = AudioSys._makeIR(1.6, 2.6);
      AudioSys.revWet = oc.createGain(); AudioSys.revWet.gain.value = 0.34;
      AudioSys.revHP = oc.createBiquadFilter(); AudioSys.revHP.type = 'highpass'; AudioSys.revHP.frequency.value = 320;
      AudioSys.revBus.connect(AudioSys.revHP).connect(AudioSys.conv).connect(AudioSys.revWet).connect(AudioSys.master);
      const n = oc.sampleRate;
      AudioSys._noiseBuf = oc.createBuffer(1, n, oc.sampleRate);
      const d = AudioSys._noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      AudioSys.space = null; AudioSys._gates = {};
      AudioSys._pcm = {}; // 구운 버퍼는 라이브 컨텍스트 것이다 — 오프라인에선 실시간 합성 경로를 잰다
      try { fn(); } catch (e) { /* 렌더 실패는 아래 지표로 잡힌다 */ }
      const buf = await oc.startRendering();
      for (const k of KEYS) AudioSys[k] = save[k];
      return buf;
    };
    const rms = (buf) => { const L = buf.getChannelData(0), R = buf.getChannelData(1);
      let sum = 0; for (let i = 0; i < L.length; i++) { const v = (L[i] + R[i]) / 2; sum += v * v; }
      return Math.sqrt(sum / L.length); };
    const hi = (buf) => { // 6kHz 이상 대략 에너지 — 인접 샘플 차분(1차 고역 통과)
      const L = buf.getChannelData(0); let e = 0, t = 0;
      for (let i = 1; i < L.length; i++) { const d2 = L[i] - L[i - 1]; e += d2 * d2; t += L[i] * L[i]; }
      return t ? e / t : 0; };
    AudioSys.setListener(480, 270);
    const near = await render(() => AudioSys.hit('stone', 480, 270));
    const far = await render(() => AudioSys.hit('stone', 480 + 700, 270));
    // 고역 감쇠는 고역이 실제로 있는 소리로 재야 한다 — 검격은 6.8kHz 공기감 층을 갖는다
    const hiNear = await render(() => AudioSys.slash(2, 'blade', 480, 270));
    const hiFar = await render(() => AudioSys.slash(2, 'blade', 480 + 700, 270));
    const teleNear = await render(() => AudioSys.telegraph(480, true, 270));
    const teleFar = await render(() => AudioSys.telegraph(480 + 700, true, 270));
    const ladder = {};
    for (const [k, fn] of [['contact', () => AudioSys.telegraph(480, true, 270)],
      ['stomp', () => AudioSys.tellStomp(480, 270)], ['boss', () => AudioSys.tellBoss(480, 270)],
      ['sigil', () => AudioSys.tellSigil(480, 270)]]) {
      const b = await render(fn, 2.2);
      let last = 0; const L = b.getChannelData(0);
      for (let i = 0; i < L.length; i++) if (Math.abs(L[i]) > 0.0008) last = i;
      ladder[k] = { rms: +rms(b).toFixed(5), dur: +(last / b.sampleRate).toFixed(2) };
    }
    const skills = {};
    for (const c of ['knight', 'archer', 'mage', 'alch']) {
      const b = await render(() => AudioSys.skill(c, false, 480, 270));
      skills[c] = +rms(b).toFixed(5);
    }
    // 궁극기는 종 꼬리가 2.6초다. 3초 창 RMS로 재면 꼬리가 평균을 희석해 스킬보다 작게 나온다 —
    // 크기 비교는 **같은 창**에서 해야 한다 (실측으로 발각)
    const ult = rms(await render(() => AudioSys.ultimate(480, 270), 1.6));
    if (mt) Music._timer = setInterval(() => Music._tick(), 50);
    if (at2) Ambience._timer = setInterval(() => Ambience._tick(), 500);
    return {
      nearRms: +rms(near).toFixed(5), farRms: +rms(far).toFixed(5),
      nearHi: +hi(hiNear).toFixed(4), farHi: +hi(hiFar).toFixed(4),
      teleDrop: +(rms(teleFar) / (rms(teleNear) || 1)).toFixed(2),
      hitDrop: +(rms(far) / (rms(near) || 1)).toFixed(2),
      ladder, skills, ult: +ult.toFixed(5),
      hasNew: ['spat', 'setListener', 'tellStomp', 'tellBoss', 'tellSigil', 'skill', 'ultimate']
        .every((k) => typeof AudioSys[k] === 'function'),
    };
  });
  console.log('  공간:', JSON.stringify(spa));
  ok('spatial.distanceAttenuates', spa.hitDrop < 0.8 && spa.hitDrop > 0.2,
    `같은 타격 가까이 vs 700px 밖 = ${spa.hitDrop}배 (v176은 방 반대편 소리가 발밑 소리와 똑같이 컸다)`);
  ok('spatial.farSoundsDuller', spa.farHi < spa.nearHi,
    `고역 비율 가까이 ${spa.nearHi} → 멀리 ${spa.farHi} (거리만큼 공기가 고역을 먹는다)`);
  ok('spatial.telegraphCarries', spa.teleDrop > spa.hitDrop,
    `예고는 거리 감쇠를 덜 받는다 — 예고 ${spa.teleDrop}배 vs 타격 ${spa.hitDrop}배 ` +
    '(멀어도 나를 노리는 예고는 들려야 한다 — 연출이 아니라 정보다)');
  const lad = spa.ladder;
  ok('tell.ladderAscends',
    lad.contact.dur < lad.stomp.dur && lad.stomp.dur <= lad.boss.dur && lad.boss.dur < lad.sigil.dur &&
    lad.sigil.rms > lad.contact.rms,
    `예고 급별 길이 접촉 ${lad.contact.dur}s → 강타 ${lad.stomp.dur}s → 보스 ${lad.boss.dur}s → 인장기 ${lad.sigil.dur}s · ` +
    `세기 ${lad.contact.rms} → ${lad.sigil.rms} (v176은 예고가 한 종류 — "얼마나 급한가"를 못 줬다)`);
  ok('skill.perClassDistinct',
    new Set(Object.values(spa.skills)).size === 4 && spa.ult > Math.max(...Object.values(spa.skills)),
    `직업 스킬 4종 전부 다른 소리 ${JSON.stringify(spa.skills)} · 궁극기 ${spa.ult}가 최대 ` +
    '(v176은 spin/rainCast/meteorCast 셋이 직업 넷을 나눠 썼다)');
  ok('spatial.newLayers', spa.hasNew, 'spat·setListener·예고 3급·스킬·궁극기 신설');

  // ── 음색 엔진 (v178) — 구운 모달 vs 실시간 합성, **같은 저울로** 잰다 ──
  const tone = await page.evaluate(async () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!AudioSys.ctx) { AudioSys.ctx = new AC(); AudioSys._noiseBuf = AudioSys._mkNoise(AudioSys.ctx); }
    const t0 = performance.now();
    await AudioSys.bake();
    const bakeMs = Math.round(performance.now() - t0);
    // 스펙트럼 — 반음 간격 Goertzel. 피크 대비 -25dB 위 국소 최댓값을 부분음으로 센다
    const analyze = (data, sr) => {
      const N = Math.min(16384, data.length);
      const w = new Float64Array(N);
      for (let i = 0; i < N; i++) w[i] = data[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
      const bins = [];
      for (let midi = 24; midi <= 128; midi++) {
        const f = 440 * Math.pow(2, (midi - 69) / 12);
        if (f > sr / 2 - 800) break;
        const om = 2 * Math.PI * f / sr, c = 2 * Math.cos(om);
        let s1 = 0, s2 = 0, s0 = 0;
        for (let i = 0; i < N; i++) { s0 = w[i] + c * s1 - s2; s2 = s1; s1 = s0; }
        bins.push({ f, m: Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2)) });
      }
      // ★ 부분음은 **국소 돌출도**로 센다. 전역 피크 기준(-25dB)으로 세면
      // ① 강한 기본음 하나가 나머지 모드를 전부 묻고 ② 평탄한 백색잡음이 최고점을 받는다 —
      // 즉 '풍부함'이 아니라 '노이즈량'을 재게 된다(실측으로 발각: 잡음 위주 소리가 18, 모달이 2).
      // 이웃 ±6반음 중앙값보다 6dB 이상 솟은 봉우리 = 귀가 '음'으로 듣는 공진
      const W = 6;
      let parts = 0, e = 0, cen = 0;
      for (let i = 1; i < bins.length - 1; i++) {
        e += bins[i].m; cen += bins[i].m * bins[i].f;
        if (!(bins[i].m > bins[i - 1].m && bins[i].m > bins[i + 1].m)) continue;
        const lo = Math.max(0, i - W), hi = Math.min(bins.length, i + W + 1);
        const nb = bins.slice(lo, hi).map((b) => b.m).sort((a, b) => a - b);
        const med = nb[Math.floor(nb.length / 2)] || 1e-9;
        if (bins[i].m > med * 2) parts++;   // +6dB
      }
      return { parts, centroid: e ? Math.round(cen / e) : 0 };
    };
    const tailOf = (d, sr) => { let pk = 0, last = 0;
      for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i]));
      for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > pk * 0.01) last = i;
      return +(last / sr).toFixed(3); };
    // 구운 것
    const baked = {};
    for (const mat of ['bone', 'stone', 'flesh', 'spirit', 'metal', 'ooze']) {
      const bank = AudioSys._pcm['hit_' + mat];
      if (!bank) continue;
      const d = bank[0].getChannelData(0);
      const a = analyze(d, bank[0].sampleRate);
      const rmsOf = (x) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s / x.length); };
      const rs = bank.map((b) => rmsOf(b.getChannelData(0)));
      const mean = rs.reduce((p, c) => p + c, 0) / rs.length;
      const sd = Math.sqrt(rs.reduce((p, c) => p + (c - mean) ** 2, 0) / rs.length);
      baked[mat] = { parts: a.parts, tail: tailOf(d, bank[0].sampleRate), n: bank.length,
        varPct: +(sd / mean * 100).toFixed(1) };
    }
    // 실시간 합성 (구운 것 없이) — 같은 분석기로
    const live = {};
    const savePcm = AudioSys._pcm, saveCtx = AudioSys.ctx, saveNb = AudioSys._noiseBuf;
    for (const mat of ['bone', 'stone', 'flesh', 'spirit']) {
      const oc = new OAC(1, Math.ceil(44100 * 0.8), 44100);
      AudioSys.ctx = oc; AudioSys._pcm = {}; AudioSys._noiseBuf = AudioSys._mkNoise(oc);
      AudioSys.master = oc.createGain(); AudioSys.master.connect(oc.destination);
      AudioSys.sfxBus = AudioSys.master; AudioSys.revBus = null; AudioSys._gates = {}; AudioSys.muted = false;
      AudioSys.hit(mat, 480, 270);
      const b = await oc.startRendering();
      const d = b.getChannelData(0);
      live[mat] = { parts: analyze(d, 44100).parts, tail: tailOf(d, 44100) };
    }
    AudioSys._pcm = savePcm; AudioSys.ctx = saveCtx; AudioSys._noiseBuf = saveNb;
    return { bakeMs, banks: Object.keys(baked).length, baked, live,
      hasWaveShaper: typeof AudioSys._satCurve === 'function' && typeof AudioSys._modal === 'function' };
  });
  console.log('  음색:', JSON.stringify(tone));
  const richer = ['bone', 'stone', 'flesh', 'spirit']
    .filter((m) => tone.baked[m] && tone.live[m] && tone.baked[m].parts > tone.live[m].parts).length;
  const longer = ['bone', 'stone', 'flesh', 'spirit']
    .filter((m) => tone.baked[m] && tone.live[m] && tone.baked[m].tail > tone.live[m].tail).length;
  ok('tone.bakedIsRicher', richer >= 3,
    `구운 모달이 실시간 합성보다 부분음이 많은 재질 ${richer}/4 — ` +
    ['bone', 'stone', 'flesh', 'spirit'].map((m) =>
      `${m} ${tone.live[m] ? tone.live[m].parts : '?'}→${tone.baked[m] ? tone.baked[m].parts : '?'}`).join(' · ') +
    ' (v177은 사인·톱니·삼각·사각 4파형 + 백색잡음이 전부였다)');
  ok('tone.bakedRingsLonger', longer >= 3,
    `공진 꼬리가 길어진 재질 ${longer}/4 — ` +
    ['bone', 'stone', 'flesh', 'spirit'].map((m) =>
      `${m} ${tone.live[m] ? tone.live[m].tail : '?'}→${tone.baked[m] ? tone.baked[m].tail : '?'}s`).join(' · '));
  ok('tone.variantsBaked',
    Object.values(tone.baked).every((b) => b.n >= 6) && tone.banks >= 6,
    `재질 ${tone.banks}종 × 변주 6개를 ${tone.bakeMs}ms에 굽는다 · 변주폭 ` +
    Object.entries(tone.baked).map(([k, v]) => `${k} ${v.varPct}%`).join(' · '));
  ok('tone.engineExists', tone.hasWaveShaper,
    '모달 합성 + 새추레이션 신설 (v177까지 createWaveShaper·createPeriodicWave·모달 전부 사용 0회)');

  ok('noPageErrors', errs.length === 0, errs.slice(0, 3).join(' | '));

  await browser.close();
  const fails = R.filter((r) => !r.v);
  console.log(`\n=== ${fails.length ? '실패 ' + fails.length + '건: ' + fails.map((f) => f.k).join(', ') : `전부 통과 (${R.length}항목)`} ===`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
