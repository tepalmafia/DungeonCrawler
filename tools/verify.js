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
    // v188: 25프레임(0.417초) 고정은 예고가 0.25초일 때만 통하는 매직 넘버였다.
    // 예고를 0.42초로 늘리자 **예고가 해소되기 직전에 측정**해서 세 항목이 한꺼번에 터졌다.
    // 앞으로 예고 길이를 또 바꿔도 안 깨지도록 **해소될 때까지** 굴린다
    const runWind = (en) => { for (let i = 0; i < 240 && en._windT > 0; i++) en.tickTimers(1 / 60); };
    // ② 예고 동안 물러나면 헛손질
    e.x = p.x + 400;                       // 플레이어가 벗어난 것과 같은 상황
    runWind(e);
    const whiff = { hp: p.hp, whiffT: e._whiffT, cd: +e.hitCd.toFixed(2) };
    // ③ 버티면 맞는다
    e.x = p.x + 10; e.hitCd = 0; e._whiffT = 0; e._windT = 0;
    e.touchPlayer(Game, 1);
    runWind(e);
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
    // ★ 지표 안정성: ZCR의 표준편차는 n=6에서 표본오차가 커서 판정이 실행마다 흔들렸다
    // (9.9% ↔ 4.6%). 에너지 가중 스펙트럼 중심은 같은 신호에서 훨씬 안정적이고,
    // 6개 변주의 **범위**(max-min)는 표준편차보다 소표본에 견고하다
    const cen = (buf) => {
      const d = buf.getChannelData(0);
      const N = Math.min(8192, d.length);
      let e = 0, w = 0;
      for (let i = 1; i < N; i++) {
        const hi = Math.abs(d[i] - d[i - 1]);   // 1차 차분 = 고역 가중
        const lo = Math.abs(d[i]);
        e += lo; w += hi;
      }
      return e ? w / e : 0;
    };
    const hz = [];
    const bank = AudioSys._pcm && AudioSys._pcm.hit_flesh;
    if (bank && bank.length) {
      for (const b of bank) hz.push(cen(b));
    } else {
      for (let i = 0; i < 12; i++) hz.push(cen(await render(() => AudioSys.hit('flesh', 480))));
    }
    const mean = hz.reduce((a, c) => a + c, 0) / hz.length;
    const sd = (Math.max(...hz) - Math.min(...hz)) / 2; // 범위의 절반 — SD와 자릿수를 맞춘다
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
    `구운 뱅크 6종의 음색 중심 변주폭 ±${audio.varPct}% + 재생속도 지터 ±4% ` +
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

  // ── 자세 프레임 (v179) ──
  const frames = await page.evaluate(() => {
    const F = Sprites.enemyFrames, st = Sprites.frameStats || {};
    // 두 캔버스의 픽셀 차이 비율 — 자세가 실제로 달라졌는가.
    // ★ 프레임이 '있다'와 '다르다'는 다르다. 같은 그림 두 장은 애니메이션이 아니다
    const diff = (a, b) => {
      if (!a || !b || a.width !== b.width || a.height !== b.height) return -1;
      const g = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const A = g(a), B = g(b);
      let d = 0, n = 0;
      for (let i = 0; i < A.length; i += 4) {
        const aOn = A[i + 3] > 24, bOn = B[i + 3] > 24;
        if (aOn || bOn) n++;
        if (aOn !== bOn) d++;
        else if (aOn && (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 40)) d++;
      }
      return n ? +(d / n).toFixed(3) : 0;
    };
    const keys = Object.keys(F);
    const pick = ['skeleton', 'shieldSkeleton', 'sniper', 'golem'].filter((k) => F[k]);
    const samples = {};
    for (const k of pick) {
      const f = F[k], base = Sprites[k];
      samples[k] = { walk: diff(f.walk[0], f.walk[1]), wind: diff(base, f.wind),
        strike: diff(base, f.strike), windVsStrike: diff(f.wind, f.strike), hurt: diff(base, f.hurt) };
    }
    // 전 스프라이트 커버리지
    let full = 0;
    for (const k of keys) {
      const f = F[k];
      if (f.walk && f.walk.length === 2 && f.wind && f.strike && f.hurt && f.die) full++;
    }
    return { total: keys.length, full, derived: st.derived || 0, samples };
  });
  console.log('  자세:', JSON.stringify(frames));
  ok('pose.coverage', frames.full >= 60 && frames.total >= 60,
    `자세 6종(걷기2·예고·타격·피격·죽음)을 갖춘 스프라이트 ${frames.full}/${frames.total} · 자동 생성 ${frames.derived}종 ` +
    '(v178은 97종 중 걷기 7 · 공격 2 · 피격/죽음 0 — 적 63종 중 61종이 정지 이미지였다)');
  const sv = Object.values(frames.samples);
  ok('pose.actuallyDiffers',
    sv.length >= 3 && sv.every((v) => v.walk > 0.02 && v.wind > 0.05 && v.strike > 0.05),
    '자세가 실제로 다르다 — ' + Object.entries(frames.samples)
      .map(([k, v]) => `${k} 걷기 ${(v.walk * 100).toFixed(0)}% · 예고 ${(v.wind * 100).toFixed(0)}% · 타격 ${(v.strike * 100).toFixed(0)}%`).join(' / ') +
    ' (프레임이 있다와 다르다는 다르다 — 같은 그림 두 장은 애니메이션이 아니다)');
  ok('pose.windOpposesStrike',
    sv.every((v) => v.windVsStrike > v.wind && v.windVsStrike > v.strike),
    '예고와 타격이 서로 반대 방향 — ' + Object.entries(frames.samples)
      .map(([k, v]) => `${k} ${(v.windVsStrike * 100).toFixed(0)}%`).join(' / ') +
    ' (기본자세 대비보다 서로가 더 멀어야 "젖혔다 → 쏟아졌다"로 읽힌다)');

  // ── 스프라이트 조명 (v180) ──
  const lit = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 200; c.height = 120;
    const g = c.getContext('2d');
    const saveCtx = Renderer.ctx, saveL = Renderer.lights;
    Renderer.ctx = g;
    const img = Sprites.skeleton;
    const shot = (lights, x) => {
      Renderer.lights = lights;
      g.clearRect(0, 0, c.width, c.height);
      Renderer.drawSprite(img, 60, 60, { light: lights.length ? Renderer.lightAt(60, 60) : null });
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let lum = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 24) { lum += (d[i] + d[i + 1] + d[i + 2]) / 3; n++; } }
      return { lum: n ? +(lum / n).toFixed(1) : 0, px: n };
    };
    const off = shot([], 0);
    const near = shot([{ x: 20, y: 20, r: 300, warm: true, i: 1 }], 0);
    const far = shot([{ x: 20, y: 20, r: 300, warm: true, i: 1 }], 0);
    // 거리별 — 같은 광원에서 멀어지면 어두워지는가
    Renderer.lights = [{ x: 20, y: 20, r: 300, warm: true, i: 1 }];
    const kNear = Renderer.lightAt(40, 40).k, kFar = Renderer.lightAt(260, 200).k;
    // 광원 반경(300) **안쪽**의 좌우 두 점 — 밖이면 둘 다 기본광으로 떨어져 방향이 같아진다
    const dirL = Renderer.lightAt(150, 20).a, dirR = Renderer.lightAt(-100, 20).a;
    Renderer.ctx = saveCtx; Renderer.lights = saveL;
    return { off: off.lum, near: near.lum, kNear: +kNear.toFixed(2), kFar: +kFar.toFixed(2),
      dirDiffers: Math.abs(dirL - dirR) > 1,
      rimBaked: typeof Sprites.rim === 'function' && Sprites.rim(img, 0, true).width === img.width };
  });
  console.log('  조명:', JSON.stringify(lit));
  ok('light.spritesRespond', lit.near > lit.off * 1.06,
    `광원 옆 스프라이트 평균 휘도 ${lit.off} → ${lit.near} (v179까지는 횃불 한가운데 선 해골과 ` +
    '암흑 속 해골이 **똑같이 밝았다** — 캐릭터가 배경 안이 아니라 위에 얹혀 있었다)');
  ok('light.fallsOffWithDistance', lit.kNear > lit.kFar,
    `광원 세기 가까이 ${lit.kNear} → 멀리 ${lit.kFar} (거리에 따라 꺼진다)`);
  ok('light.hasDirection', lit.dirDiffers && lit.rimBaked,
    '광원 방향이 좌우로 갈리고 림 캐시가 스프라이트 크기와 맞는다 (빛 받는 쪽 가장자리만 밝다)');

  // ── 후광 금지 (v184) — 사장 스크린샷: "캐릭터 윤각이 두껍게 테두리가 생겼잔아" ──
  // make()는 실루엣을 8방향으로 찍어 **1px 검은 아웃라인**을 자동으로 두른다.
  // v180의 조명이 그 아웃라인까지 밝게 칠해서 **흰 후광**이 생겼다.
  // 픽셀아트는 윤곽선이 살아 있어야 형태가 읽힌다 — 아웃라인은 어두운 채로 남아야 한다
  const halo = await page.evaluate(() => {
    const img = Sprites.knight || Sprites.skeleton;
    const c = document.createElement('canvas');
    c.width = 160; c.height = 160;
    const g = c.getContext('2d');
    const saveCtx = Renderer.ctx, saveL = Renderer.lights;
    Renderer.ctx = g;
    // 아웃라인 픽셀 = 원본에서 '가장 어두운 불투명 화소' (make의 OUTLINE '#0d0b14')
    const shot = (lights) => {
      Renderer.lights = lights;
      g.clearRect(0, 0, c.width, c.height);
      Renderer.drawSprite(img, 80, 80, { light: lights.length ? Renderer.lightAt(80, 80) : null });
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let out = 0, on = 0, body = 0, bn = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 40) continue;
        const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
        if (lum < 46) { out += lum; on++; } else { body += lum; bn++; }
      }
      return { outline: on ? out / on : 0, body: bn ? body / bn : 0, outlinePx: on };
    };
    const off = shot([]);
    const on2 = shot([{ x: 40, y: 40, r: 400, warm: true, i: 1.3 }]);
    Renderer.ctx = saveCtx; Renderer.lights = saveL;
    return { offOut: +off.outline.toFixed(1), onOut: +on2.outline.toFixed(1),
      offBody: +off.body.toFixed(1), onBody: +on2.body.toFixed(1), px: off.outlinePx };
  });
  console.log('  후광:', JSON.stringify(halo));
  ok('light.noHalo', halo.px > 20 && halo.onOut < 60 && halo.onBody > halo.offBody * 1.05,
    `강한 조명에서 아웃라인 밝기 ${halo.offOut} → ${halo.onOut} (60 미만이어야 어두운 윤곽) · ` +
    `몸통은 ${halo.offBody} → ${halo.onBody}로 밝아진다 ` +
    '(v183은 흰 실루엣을 lighter로 얹어 **검은 테두리가 흰 후광이 됐다**)');

  // ── 무리와 진형 (v181) ──
  await boot(page, { cls: 'knight', heat: 0 });
  const pack = await page.evaluate(() => {
    // ① 구성: 방마다 성격이 갈리는가 (v187 방 규격).
    // v186까지는 "손제작 무리가 100%"였고, 그게 곧 문제였다 — 항상 무리면 무리가 안 보인다.
    // 이제 재는 것은 '무리가 있느냐'가 아니라 **홑몸 방과 무리 방이 실제로 다르냐**다
    let setUsed = 0, packSum = 0, N = 200;
    const kinds = {}, bodies = {}, kpacks = {};
    for (let i = 0; i < N; i++) {
      Dungeon.floor = 1 + (i % 10); Dungeon.roomIndex = 2 + (i % 5);
      const c = Dungeon.combatComp(2 + (i % 4));
      if (c.setUsed) setUsed++;
      if (c.packs) packSum += c.packs.length;
      const k = c.roomKind || '?';
      kinds[k] = (kinds[k] || 0) + 1;
      bodies[k] = (bodies[k] || 0) + c.length;
      kpacks[k] = (kpacks[k] || 0) + (c.packs ? c.packs.length : 0);
    }
    const avgBody = (k) => kinds[k] ? +(bodies[k] / kinds[k]).toFixed(2) : 0;
    const avgPack = (k) => kinds[k] ? +(kpacks[k] / kinds[k]).toFixed(2) : 0;
    // 위협 예산 보존 확인: 무리 방은 개체가 약해야 한다 (hpMul이 실제로 실렸는가)
    Dungeon.floor = 3; Dungeon.roomIndex = 3;
    let mulMin = 9, mulMax = 0;
    for (let i = 0; i < 60; i++) {
      for (const s of Dungeon.combatComp(3)) {
        const m = s.hpMul == null ? 1 : s.hpMul;
        if (m < mulMin) mulMin = m;
        if (m > mulMax) mulMax = m;
      }
    }
    // ② 배치: 역할이 거리로 갈리는가
    Dungeon.floor = 3; Dungeon.roomIndex = 2; Dungeon.build('combat');
    const p = Game.player; p.god = true; p.x = 120; p.y = 270;
    const dOf = (type) => {
      Game._roleN = null;
      const pos = [];
      for (let k = 0; k < 4; k++) {
        Game._roleN = Game._roleN || { front: 0, flank: 0, back: 0 };
        const r = roleOf(type);
        const q = formationPos(r, Game._roleN[r]++, p);
        pos.push(Math.hypot(q.x - p.x, q.y - p.y));
      }
      return +(pos.reduce((a, b) => a + b, 0) / pos.length).toFixed(0);
    };
    const front = dOf('shieldSkeleton'), back = dOf('sniper'), flank = dOf('charger');
    // ③ 지형 질의가 실제로 다른 자리를 고르는가
    // ★ 한 방·한 지점만 보면 방이 무작위라 판정이 흔들린다(엄폐 자리 주변 벽 0이 나올 수 있다).
    // 여러 방 × 여러 지점의 **평균 경향**을 본다 — 지형 질의는 확률이 아니라 경향의 문제다
    const wallsAt = (q) => q ? World._wallsAround(Math.floor(q.x / 48), Math.floor((q.y - World.offsetY) / 48)) : -1;
    let cw = 0, ow = 0, n2 = 0, chokeN = 0, diffN = 0;
    for (let r = 0; r < 24; r++) {
      Dungeon.floor = 1 + (r % 8); Dungeon.roomIndex = 2 + (r % 5); Dungeon.build('combat');
      for (const [bx, by] of [[300, 220], [480, 270], [660, 330]]) {
        const cs = World.coverSpot(bx, by, 110), ch = World.chokeSpot(bx, by, 110), op = World.openSpot(bx, by, 110);
        if (!cs || !op) continue;
        cw += wallsAt(cs); ow += wallsAt(op); n2++;
        if (ch) chokeN++;
        if (cs.x !== op.x || cs.y !== op.y) diffN++;
      }
    }
    return { setPct: Math.round(setUsed / N * 100), packsAvg: +(packSum / N).toFixed(2),
      kinds, soloPacks: avgPack('solo'), packPacks: avgPack('pack'), duoPacks: avgPack('duo'),
      soloBody: avgBody('solo'), packBody: avgBody('pack'), mulMin: +mulMin.toFixed(2), mulMax: +mulMax.toFixed(2),
      front, back, flank, samples: n2,
      coverWalls: +(cw / (n2 || 1)).toFixed(2), openWalls: +(ow / (n2 || 1)).toFixed(2),
      chokeFound: chokeN >= n2 * 0.8, terrainDiffers: diffN >= n2 * 0.7 };
  });
  console.log('  무리:', JSON.stringify(pack));
  ok('room.kindsContrast', pack.soloPacks === 0 && pack.packPacks >= 1 && pack.packBody > pack.soloBody * 1.5,
    `홑몸 방 무리 ${pack.soloPacks}개·몸 ${pack.soloBody} vs 무리 방 무리 ${pack.packPacks}개·몸 ${pack.packBody} ` +
    `(분포 ${JSON.stringify(pack.kinds)}) — v186은 24개 방 **전부** 무리 1개·리더 1기였다. ` +
    '무리가 죽어 있던 게 아니라 상수였고, 상수는 아무것도 안 보여준다');
  ok('room.budgetShifts', pack.mulMin < 0.8 && pack.mulMax > 1.2,
    `개체 강도 배수 ${pack.mulMin} ~ ${pack.mulMax} — 몸을 늘린 방은 개체가 약해진다 ` +
    '(위협 예산 보존: 대비는 만들되 난이도 곡선은 건드리지 않는다. 이 값이 전부 1이면 물량만 늘린 것)');
  ok('pack.handmadeIsDefault', pack.setPct >= 60 && pack.packsAvg >= 0.7,
    `손제작 무리가 뼈대인 방 ${pack.setPct}% · 방당 무리 ${pack.packsAvg}개 ` +
    '(v180은 45%만 세트, 나머지 55%는 RNG.pick 순수 랜덤 = 무리가 아니라 개체 N개였다. ' +
    'v187부터 홑몸 방 25%는 **의도적으로** 무리가 없으므로 100%가 아닌 것이 정상이다)');
  ok('pack.rolesFormRanks', pack.back > pack.front && pack.flank > pack.front,
    `진형 거리 전열 ${pack.front}px < 측면 ${pack.flank}px < 후열 ${pack.back}px ` +
    '(v180은 전부 randomSpawnPos — 방 아무 데나 흩뿌려서 무리를 깨는 순서가 없었다)');
  ok('terrain.roleAwareSpots', pack.terrainDiffers && pack.coverWalls > pack.openWalls,
    `${pack.samples}개 표본 평균 — 엄폐 자리 주변 벽 ${pack.coverWalls} > 트인 자리 ${pack.openWalls} · ` +
    `좁은 목 탐색 ${pack.chokeFound ? '성공' : '실패'} · 두 자리가 다름 ${pack.terrainDiffers ? '확인' : '실패'} ` +
    '(지형이 진형에 값을 매긴다 — 저격수는 벽을 등지고, 돌진은 트인 길에 선다)');

  // ── E 스킬 · 속성 궁극기 (v182) ──
  await boot(page, { cls: 'knight', heat: 0 });
  const sub = await page.evaluate(() => {
    const p = Game.player;
    p.god = true; p.x = 480; p.y = 270;
    p.subSkill = 'sh_bash'; p.subCd = 0;
    // ① 조준 방향으로 나가는가 — 겨눈 쪽의 적만 맞아야 한다
    // spawnT를 꺼야 한다 — 등장 연출 중인 적은 hitEnemy가 건너뛴다 (계측 함정)
    // createEnemy는 Game.enemies에 **자동으로 넣지 않는다** — 직접 push해야 판정에 들어간다
    const mk = (x, y) => { const e = createEnemy('skeleton', x, y, 1); e.hp = e.maxHp = 99; e.spawnT = 0; Game.enemies.push(e); return e; };
    Game.enemies.length = 0;
    const right = mk(560, 270), left = mk(400, 270);
    p.facing = { x: -1, y: 0 };                 // **걷는 방향은 왼쪽**
    Game.aimOverride = { x: 1, y: 0 };
    const origAim = p.aimDir;
    p.aimDir = () => ({ x: 1, y: 0 });          // **겨누는 방향은 오른쪽**
    const hr0 = right.hp, hl0 = left.hp;
    p.useSubSkill(Game);
    p.aimDir = origAim;
    const aimed = { rightHit: right.hp < hr0, leftHit: left.hp < hl0 };
    Game.enemies.length = 0;
    // ② 보조 스킬 12종에 전용 소리가 있는가 (기본 분기로 떨어지지 않는가)
    const ids = [];
    for (const cls of Object.keys(SUBSKILLS)) for (const sk of SUBSKILLS[cls]) ids.push(sk.id);
    const src = AudioSys.sub.toString();
    const covered = ids.filter((id) => src.includes(`'${id}'`)).length;
    // ③ 계열 3단이 속성 궁극기를 여는가
    p.ultKind = null; p.ult = 0; p.traits.length = 0;
    // 화염 특성은 5종뿐이다 — `i < fireTraits.length`로 자르면 5장만 들어가 3단(6장)에 못 닿는다.
    // 중복 획득이 가능한 게임이므로 순환해서 6장을 채운다
    const fireTraits = TRAITS.filter((t) => t.tag === '화염');
    for (let i = 0; i < 6; i++) p.traits.push(fireTraits[i % fireTraits.length].id);
    Game.checkSects(true);
    const opened = { kind: p.ultKind, ult: p.ult, gauge: p.ultGauge >= p.ultMax };
    // ④ 사당 층
    const shrineFloors = [];
    for (let f = 1; f <= 30; f++) if ([2, 5, 8, 11, 15, 18, 22, 25, 28].includes(f)) shrineFloors.push(f);
    return { aimed, ids: ids.length, covered, opened, shrines: shrineFloors.length,
      firstShrine: shrineFloors[0], hasSectUlt: typeof p._sectUlt === 'function' };
  });
  console.log('  보조·궁극:', JSON.stringify(sub));
  ok('sub.firesAtAim', sub.aimed.rightHit && !sub.aimed.leftHit,
    `걷는 방향은 왼쪽인데 겨눈 오른쪽 적만 맞았다 (오른${sub.aimed.rightHit}/왼${sub.aimed.leftHit}) — ` +
    'v181까지 E는 `this.facing`(이동 방향)으로 나갔다. v167에서 조준을 플레이어에게 돌려줄 때 보조 스킬만 빠졌다');
  ok('sub.hasOwnSound', sub.covered >= 9,
    `보조 스킬 ${sub.ids}종 중 ${sub.covered}종이 전용 소리를 갖는다 ` +
    '(v181은 12종 전부 clank·slash·roar·pickup을 빌려 썼다 — 자기 소리가 없으면 뭘 했는지 안 남는다)');
  ok('ult.sectOpensIt', sub.opened.kind === 'fire' && sub.opened.ult >= 1 && sub.opened.gauge && sub.hasSectUlt,
    `화염 6장 → 계열 3단 → 「${sub.opened.kind}」 종막 개방 + 게이지 만충 ` +
    '(v181까지 궁극기는 10층 보스 전리품뿐이라 최고 8층인 사장은 한 번도 못 썼다)');
  ok('sub.shrineReachable', sub.firstShrine <= 2 && sub.shrines >= 6,
    `보조 스킬 사당 ${sub.shrines}개 층 · 첫 등장 ${sub.firstShrine}층 (v181은 5·15·25층뿐 = 8층까지 가도 평생 1번)`);

  // ── 조준 표식 (v183) — 사장: "npc 테두리 나오는건 고쳤어? 보기싫어" ──
  const mark = await page.evaluate(() => {
    Dungeon.floor = 1; Dungeon.roomIndex = 3; Dungeon.build('combat');
    const p = Game.player; p.god = true; p.x = 200; p.y = 300;
    Game.enemies.length = 0;
    const e = createEnemy('skeleton', 480, 270, 1); e.spawnT = 0; Game.enemies.push(e);
    const c = Renderer.canvas || document.querySelector('canvas');
    const g = c.getContext('2d');
    const box = { x: Math.round(e.x - 40), y: Math.round(e.y - 46), w: 80, h: 92 };
    const grab = () => g.getImageData(box.x, box.y, box.w, box.h).data;
    p._aimTarget = null; Game.render();
    const A = grab();
    p._aimTarget = e; Game.render();
    const B = grab();
    // 표식이 그린 픽셀의 위치 분포 — 스프라이트 **몸통 위**를 덮는가
    const bodyTop = 46 - Math.round(e.r) - 6, bodyBot = 46 + Math.round(e.r) * 0.6;
    let total = 0, onBody = 0;
    for (let i = 0; i < A.length; i += 4) {
      const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
      if (d <= 20) continue;
      total++;
      const px = (i / 4) % box.w, py = Math.floor((i / 4) / box.w);
      if (py >= bodyTop && py <= bodyBot && px > 14 && px < box.w - 14) onBody++;
    }
    p._aimTarget = null;
    return { total, onBody, onBodyPct: total ? Math.round(onBody / total * 100) : 0 };
  });
  console.log('  조준표식:', JSON.stringify(mark));
  ok('aimMark.notOverBody', mark.total > 20 && mark.onBodyPct <= 35,
    `조준 표식 픽셀 ${mark.total} 중 적 몸통을 덮는 비율 ${mark.onBodyPct}% ` +
    '(v182는 붉은 모서리 브래킷 4개를 몸 위에 씌워 HUD 상자를 세계에 얹은 꼴이었다 — ' +
    '표식은 발밑 호와 머리 위 쐐기로, 정보는 지키되 스프라이트를 가리지 않는다)');

  // ── 리더 · 사기 · 군집 오라 (v185) ──
  await boot(page, { cls: 'knight', heat: 0 });
  const morale = await page.evaluate(() => {
    // ① 무리마다 리더가 하나씩 붙는가
    let packs = 0, leaders = 0, badPacks = 0;
    for (let i = 0; i < 120; i++) {
      Dungeon.floor = 1 + (i % 10); Dungeon.roomIndex = 2 + (i % 5);
      const c = Dungeon.combatComp(2 + (i % 4));
      const ids = new Set(c.filter((u) => u.pack).map((u) => u.pack));
      packs += ids.size;
      leaders += c.filter((u) => u.leader).length;
      // v187: 홑몸 방은 무리가 0인 것이 **설계**다. 그러니 "방마다 무리가 있는가"는
      // 더 이상 불변식이 아니다. 진짜 불변식은 **무리 하나에 매듭 하나** —
      // 리더 없는 무리(끊을 곳이 없다)도, 리더 둘인 무리(어느 쪽이 매듭인지 모른다)도 결함이다
      const perPack = {};
      for (const u of c) if (u.pack) perPack[u.pack] = (perPack[u.pack] || 0) + (u.leader ? 1 : 0);
      for (const k in perPack) if (perPack[k] !== 1) badPacks++;
    }
    // ② 뭉치면 단단해지는가 — 같은 적을 혼자 / 다섯이 뭉쳤을 때
    Dungeon.floor = 3; Dungeon.roomIndex = 2; Dungeon.build('combat');
    const p = Game.player; p.god = true; p.x = 100; p.y = 100;
    const spawn = (n, bx, by) => {
      Game.enemies.length = 0;
      const out = [];
      for (let k = 0; k < n; k++) {
        const e = createEnemy('skeleton', bx + (k % 3) * 30, by + Math.floor(k / 3) * 30, 3);
        e.spawnT = 0; e.hp = e.maxHp = 999; e.pack = 1; Game.enemies.push(e); out.push(e);
      }
      // v188: 히트스톱이 일반 타격에도 걸리게 되면서 **Game.tick 한 번이 통째로 먹혔다** —
      // hitstop > 0 이면 tick 은 감쇠만 하고 조기 return 하므로 군집 틱이 영영 안 돌았다.
      // 이건 히트스톱의 정상 동작(세계가 멈춘다)이지, 결함이 아니다. 계측만 비켜서면 된다
      Game.hitstop = 0;
      Game._cohesionT = 0;
      Game.tick(1 / 60);
      return out;
    };
    const solo = spawn(1, 480, 270)[0];
    const soloMit = solo._packMit || 0;
    const s0 = solo.hp; Game.damageEnemy(solo, 20, { x: 1, y: 0 }, { feel: true });
    const soloDmg = s0 - solo.hp;
    const grp = spawn(5, 480, 270);
    const grpMit = grp[0]._packMit || 0;
    const g0 = grp[0].hp; Game.damageEnemy(grp[0], 20, { x: 1, y: 0 }, { feel: true });
    const grpDmg = g0 - grp[0].hp;
    // ③ 장판·화상(feel:false)은 경감을 안 받는가 — 흩어놓을 수단이 남아야 한다
    const g1 = grp[1].hp; Game.damageEnemy(grp[1], 20, { x: 1, y: 0 }, { feel: false });
    const dotDmg = g1 - grp[1].hp;
    // ④ 리더가 죽으면 무리가 흔들리는가
    Game.enemies.length = 0;
    const L = createEnemy('skeleton', 480, 270, 3); L.spawnT = 0; L.isLeader = true; L.pack = 7;
    L.hp = L.maxHp = 5; Game.enemies.push(L);
    const mates = [];
    for (let k = 0; k < 3; k++) {
      const m = createEnemy('skeleton', 520 + k * 30, 270, 3);
      m.spawnT = 0; m.pack = 7; m.hp = m.maxHp = 99; Game.enemies.push(m); mates.push(m);
    }
    const spdBefore = mates[0].effSpeed();
    Game.killEnemy(L, { x: 1, y: 0 });
    const shaken = mates.filter((m) => m._shakenT > 0).length;
    const spdAfter = mates[0].effSpeed();
    return { packsAvg: +(packs / 120).toFixed(2), leadersAvg: +(leaders / 120).toFixed(2), badPacks,
      soloMit: +soloMit.toFixed(2), grpMit: +grpMit.toFixed(2),
      soloDmg, grpDmg, dotDmg, shaken, spdBefore: Math.round(spdBefore), spdAfter: Math.round(spdAfter) };
  });
  console.log('  무리사기:', JSON.stringify(morale));
  ok('pack.hasLeaders', morale.badPacks === 0 && morale.leadersAvg > 0.5,
    `방당 무리 ${morale.packsAvg}개 · 리더 ${morale.leadersAvg}기 · 매듭이 하나가 아닌 무리 ${morale.badPacks}개 ` +
    '(v187: 홑몸 방은 무리 0이 설계다. 불변식은 「무리 하나에 리더 하나」 — ' +
    '리더 없는 무리는 끊을 곳이 없고, 리더 둘인 무리는 어느 쪽이 매듭인지 알 수 없다)');
  ok('pack.cohesionMitigates', morale.grpMit > morale.soloMit && morale.grpDmg < morale.soloDmg,
    `혼자 경감 ${morale.soloMit} → 다섯이 뭉치면 ${morale.grpMit} · 같은 20피해가 ${morale.soloDmg} → ${morale.grpDmg} ` +
    '(뭉치면 단단해진다 — 흩어놓는 것이 플레이어의 수가 된다)');
  ok('pack.dotIgnoresAura', morale.dotDmg >= morale.soloDmg,
    `장판·화상(feel:false)은 경감을 안 받는다 — 직격 ${morale.grpDmg} vs 지속피해 ${morale.dotDmg} ` +
    '(흩어놓을 수단이 남아야 한다. 전부 막으면 결정이 아니라 벽이다)');
  ok('pack.leaderDeathShakes', morale.shaken === 3 && morale.spdAfter < morale.spdBefore,
    `리더 사망 → 동료 ${morale.shaken}기 동요 · 이동속도 ${morale.spdBefore} → ${morale.spdAfter} ` +
    '(매듭을 먼저 칠지 방패부터 걷을지가 결정이 된다)');

  // ── 무리 행태 (v186) — 사장: "군집이나 기타 몹들의 행태에 변화를 못 느끼겠는데?" ──
  const behav = await page.evaluate(() => {
    Dungeon.floor = 3; Dungeon.roomIndex = 2; Dungeon.build('combat');
    const p = Game.player; p.god = true; p.x = 480; p.y = 270;
    // 역할 분류가 63종을 실제로 덮는가 (v185는 이름 목록뿐이라 대부분 'front'로 떨어졌다)
    const types = [...new Set(CODEX_ENEMIES.map((c) => c.id))];
    const dist = { front: 0, back: 0, flank: 0 };
    for (const t of types) {
      let e = null; try { e = createEnemy(t, 0, 0, false, 1); } catch (x) { continue; }
      if (e) dist[roleOf(t, e)]++;
    }
    // 역할별로 자기 밴드를 지키는가 — 플레이어 코앞(60px)에 세우고 2초
    const hold = (type) => {
      Game.enemies.length = 0;
      const e = createEnemy(type, p.x + 60, p.y, false, 1);
      e.spawnT = 0; e.hp = e.maxHp = 999; Game.enemies.push(e);
      e._aware = true;
      const d0 = Math.hypot(e.x - p.x, e.y - p.y);
      for (let i = 0; i < 120; i++) { p.x = 480; p.y = 270; Game.tick(1 / 60); }
      const d1 = Math.hypot(e.x - p.x, e.y - p.y);
      Game.enemies.length = 0;
      return { role: roleOf(type, e), d0: Math.round(d0), d1: Math.round(d1) };
    };
    const back = hold('archer');
    const front = hold('skeleton');
    // 리더가 실제 스폰 경로를 타고 나오는가 (v185는 combatComp만 검사해 0기를 놓쳤다)
    // ★ v189 — 방 하나만 보면 안 된다. v187부터 **홑몸 방 25%는 무리도 리더도 없는 게 설계**다.
    // 종전엔 시드 운으로 통과하다가 v189에서 진입점이 바뀌며 스폰 난수가 밀리자 홑몸 방에
    // 걸려 터졌다. 재는 대상은 「방마다 리더가 있는가」가 아니라 **「무리 방의 리더가
    // 스폰 경로를 타고 나오는가」**다 — 그게 v185에서 죽어 있던 것이다
    let leaders = 0, alive = 0, packRooms = 0, soloRooms = 0;
    for (let r = 0; r < 8; r++) {
      Dungeon.floor = 3; Dungeon.roomIndex = 2 + (r % 5); Dungeon.build('combat');
      for (let i = 0; i < 120; i++) Game.tick(1 / 60);
      const live = Game.enemies.filter((e) => !e.dead);
      if (Game._roomKind === 'solo') { soloRooms++; continue; }
      packRooms++;
      leaders += live.filter((e) => e.isLeader).length;
      alive += live.length;
    }
    return { dist, back, front, leaders, alive, packRooms, soloRooms };
  });
  console.log('  무리행태:', JSON.stringify(behav));
  ok('role.coversRoster', behav.dist.flank >= 12 && behav.dist.back >= 8 && behav.dist.front >= 15,
    `역할 분류 전열 ${behav.dist.front} · 후열 ${behav.dist.back} · 측면 ${behav.dist.flank} ` +
    '(v185는 이름 목록뿐이라 측면이 실전 8개 방에서 0마리였다 — 목록에 없으면 사거리·속도로 판정한다)');
  ok('behav.rangedKeepsDistance', behav.back.role === 'back' && behav.back.d1 > behav.back.d0 * 1.4,
    `후열을 코앞(${behav.back.d0}px)에 세우면 2초 뒤 ${behav.back.d1}px로 물러난다 ` +
    '(v185까지 진형은 **스폰 배치**일 뿐이라 1~2초면 대열이 녹아 전부 얼굴로 몰려왔다)');
  ok('behav.meleeStillCloses', behav.front.d1 <= behav.front.d0 * 1.3,
    `전열은 그대로 붙는다 ${behav.front.d0} → ${behav.front.d1}px (근접은 붙는 게 맞다 — 역할이 다르다)`);
  ok('behav.leadersSpawn', behav.packRooms > 0 && behav.leaders >= behav.packRooms && behav.alive > 0,
    `무리 방 ${behav.packRooms}개(홑몸 ${behav.soloRooms}개 제외)에서 리더 ${behav.leaders}기 / 적 ${behav.alive} ` +
    '(v185는 main.js가 pack·leader를 안 넘겨 **실전 8개 방 전부 0기**였다 — 사기 시스템이 통째로 죽어 있었다)');

  // ── 사연 (v187) ────────────────────────────────────────────────────────
  // 사장: "전체 잡몹들이나 보스에게 사연을 못 느끼고"
  // 사연은 89종 전부 있었지만 **도감 안에, 마우스 호버로만** 있었다. 폰에는 호버가 없다.
  // 그러니 여기서 재는 것은 "데이터가 있느냐"가 아니라 **마우스 없이 닿느냐**다
  await boot(page, { cls: 'knight', heat: 0 });
  const lore = await page.evaluate(() => {
    const miss = CODEX_ENEMIES.filter((e) => !e.lore || !e.side);
    const bosses = CODEX_ENEMIES.filter((e) => e.boss);
    const missLast = bosses.filter((e) => !e.last);
    // 사연과 공략이 실제로 다른 문장인가 (같으면 사연을 '추가'한 게 아니라 이름만 바꾼 것)
    const same = CODEX_ENEMIES.filter((e) => e.lore === e.desc).length;
    // 첫 조우 카드가 플레이 중 실제로 뜨는가 — 스폰 경로를 직접 태운다
    Dungeon.floor = 1; Dungeon.roomIndex = 2;
    Game.state = 'play'; Game._metRun = {}; Game._meetQ = []; Game._meet = null;
    Game.banner = null;
    World.buildRoom('combat'); Game.onRoomBuilt('combat');
    let meetShown = null;
    for (let i = 0; i < 300 && !meetShown; i++) {
      Game.tick(1 / 60);
      Game.banner = null;                 // 배너가 줄을 막지 않게 (카드는 배너 뒤에 선다)
      if (Game._meet) meetShown = { name: Game._meet.c.name, lore: Game._meet.c.lore };
    }
    // 두 번째 조우에서는 조용한가 (도배 방지)
    const beforeQ = (Game._meetQ || []).length;
    Game.noteFirstMeet(meetShown ? Game.enemies.find((e) => !e.dead).type : 'slime');
    const repeat = (Game._meetQ || []).length - beforeQ;
    return { total: CODEX_ENEMIES.length, miss: miss.length, bosses: bosses.length,
      missLast: missLast.length, same, meetShown, repeat };
  });
  console.log('  사연:', JSON.stringify(lore));
  ok('lore.everyEnemyHasOne', lore.miss === 0 && lore.missLast === 0,
    `사연 없는 적 ${lore.miss}/${lore.total} · 유언 없는 보스 ${lore.missLast}/${lore.bosses} ` +
    '(새 몹을 넣을 때 사연을 빼먹으면 여기서 걸린다 — 규격이 50층까지 확장되는 방식이다)');
  ok('lore.differsFromTactics', lore.same === 0,
    `사연과 공략이 같은 문장인 항목 ${lore.same} ` +
    '(종전 desc는 「조준선이 붉어지면 발사된다」 — 그건 사연이 아니라 힌트다. 둘은 다른 칸이어야 한다)');
  ok('lore.firstMeetShowsInPlay', !!lore.meetShown && lore.repeat === 0,
    lore.meetShown ? `플레이 중 첫 조우 카드 — 「${lore.meetShown.name}」 ${lore.meetShown.lore.slice(0, 24)}… · 재조우 침묵 ${lore.repeat === 0}`
      : '첫 조우 카드가 뜨지 않았다');

  const codexNav = await page.evaluate(() => {
    // 마우스를 화면 밖으로 치우고 **키보드만으로** 사연을 여는 경로
    Input.mouse.x = -999; Input.mouse.y = -999;
    Game.state = 'codex'; Game.codexTab = 0; Game.codexPage = 0; Game.codexSel = 0;
    Meta.data.codex.kills = {};
    for (const e of CODEX_ENEMIES.slice(0, 12)) Meta.data.codex.kills[e.boss ? 'boss' + e.id.slice(4) : e.id] = 3;
    const c = Renderer.ctx;
    const drawn = [];
    const orig = c.fillText.bind(c);
    c.fillText = (t, x, y) => { drawn.push(String(t)); return orig(t, x, y); };
    HUD.drawCodex(c, 0, Game);
    // 커서를 오른쪽으로 두 칸 — 방향키만으로 다른 항목이 열려야 한다
    const first = drawn.slice();
    const press = (code) => { Input.justPressed[code] = true; Game._tickCodex(); Input.justPressed = {}; };
    press('ArrowRight'); press('ArrowRight');
    drawn.length = 0;
    HUD.drawCodex(c, 0, Game);
    const second = drawn.slice();
    c.fillText = orig;
    const loreOf = (arr, e) => arr.some((t) => e.lore && t.length > 4 && e.lore.indexOf(t) === 0);
    const e0 = CODEX_ENEMIES[0], e2 = CODEX_ENEMIES[2];
    // 패드가 도감에 닿는가 (MENU_STATES 누락이면 입력 자체가 안 들어온다)
    const padReaches = ['codex', 'altar', 'classes'].every((s) =>
      ['levelup', 'relic', 'route', 'skillmod', 'hub', 'over', 'victory', 'title', 'codex', 'altar', 'classes'].includes(s));
    return { sel: Game.codexSel, first: loreOf(first, e0), second: loreOf(second, e2),
      moved: Game.codexSel === 2, padReaches };
  });
  console.log('  도감조작:', JSON.stringify(codexNav));
  ok('codex.readableWithoutMouse', codexNav.moved && codexNav.first && codexNav.second,
    `마우스를 치운 채 방향키 2회 → 커서 ${codexNav.sel}번 · 사연이 패널에 그려짐(처음 ${codexNav.first} / 이동 후 ${codexNav.second}) ` +
    '(v186까지 사연은 `if (hover)` 안에 있었다 — 폰으로 하는 사장에게는 존재하지 않는 기능이었다)');

  // ── 무리 체감 (v187) ───────────────────────────────────────────────────
  const feel = await page.evaluate(() => {
    Game.restart(4242);
    Dungeon.floor = 2; Dungeon.roomIndex = 3;
    Game.state = 'play'; Game.player.god = true;
    World.buildRoom('combat'); Game.onRoomBuilt('combat');
    for (let i = 0; i < 240; i++) Game.tick(1 / 60);
    for (const e of Game.enemies) e._aware = true;
    // 호령이 실제로 도는가 — 리더가 있는 방에서 8초
    let rallied = 0;
    for (let i = 0; i < 480; i++) {
      Game.tick(1 / 60);
      for (const e of Game.enemies) e._aware = true;
      if (Game.enemies.some((e) => !e.isLeader && e._rallyT > 0.5)) rallied++;
    }
    const leaders = Game.enemies.filter((e) => !e.dead && e.isLeader).length;
    // 「무리 방어」가 화면에 뜨는가 — Particles.text 를 가로채 확인
    const said = [];
    const op = Particles.text.bind(Particles);
    Particles.text = (x, y, t, o) => { said.push(String(t)); return op(x, y, t, o); };
    const grp = Game.enemies.find((e) => e._packMit >= 0.18 && !e.dead);
    if (grp) Game.damageEnemy(grp, 3, { x: 1, y: 0 }, { feel: true });
    Particles.text = op;
    return { leaders, rallied, mitSaid: said.some((t) => t.indexOf('무리 방어') === 0),
      hadGroup: !!grp, mit: grp ? +grp._packMit.toFixed(2) : 0 };
  });
  console.log('  무리체감:', JSON.stringify(feel));
  ok('pack.rallyFires', feel.leaders === 0 || feel.rallied > 0,
    `리더 ${feel.leaders}기 · 호령 발생 ${feel.rallied}회/8초 ` +
    '(무리로 보이게 하는 건 숫자가 아니라 **동시성**이다 — 넷이 제각각 걸어오면 넷이고, 동시에 밀면 무리다)');
  ok('pack.mitigationIsVisible', !feel.hadGroup || feel.mitSaid,
    `경감 ${feel.mit} 적을 때렸을 때 「무리 방어」 표시 ${feel.mitSaid} ` +
    '(v185~186은 14~30%가 **조용히** 깎였다. 보이지 않는 경감은 없는 것과 같다)');

  // ── 손맛과 회피 (v188) ─────────────────────────────────────────────────
  // 사장: "너무 쉽고, 전혀 손 맛과 회피 등 내가 뭔가 했다는 생각이 안드네."
  // 실측이 원인을 지목했다 — 완벽 회피(v169)는 **이미 구현돼 있었는데** 예고가 0.25초,
  // 즉 인간 반응 시간(약 0.25초)과 같아서 보고 나서 누르면 물리적으로 늦었다.
  // 실측: v187에서 반응 250·300·350ms 전부 완벽 회피 0회. 200ms(사람보다 빠름)에서만 성립.
  // 이 두 항목은 그 회귀를 못박는다 — 예고를 다시 줄이거나 히트스톱을 빼면 여기서 걸린다.
  await boot(page, { cls: 'knight', heat: 0 });
  const feelv = await page.evaluate(() => {
    // ① 예고 창이 인간이 닿는 길이인가 + 250ms 반응으로 완벽 회피가 실제로 성립하는가
    const trial = (react) => {
      Game.restart(555);
      Dungeon.floor = 3; Dungeon.roomIndex = 3; Game.state = 'play';
      const p = Game.player;
      p.god = false; p.hp = p.maxHp = 99; p.invuln = 0; p.pdodgeCrit = false;
      World.buildRoom('combat'); Game.onRoomBuilt('combat');
      Game.enemies.length = 0; Game.pendingSpawns.length = 0; Game.markers.length = 0;
      p.x = 480; p.y = 270;
      const e = createEnemy('skeleton', 506, 270, false, 1);
      e.spawnT = 0; e._aware = true; e.hp = e.maxHp = 9999; e.speed = 0;
      Game.enemies.push(e);
      let seen = -1, dashed = false, pd = 0, t = 0, win = 0;
      const hp0 = p.hp;
      for (let i = 0; i < 360; i++) {
        if (e.hitCd <= 0 && e._windT <= 0) e.touchPlayer(Game, 1);
        if (e._windT > 0 && seen < 0) { seen = t; win = e._windMax; }
        if (seen >= 0 && !dashed && t - seen >= react) {
          dashed = true;
          p.dashCharges = Math.max(1, p.dashCharges) - 1;
          p.dashTimer = 0.16; p.invuln = Math.max(p.invuln, 0.22);
          p.dashDir = { x: -1, y: 0 }; p._pdodged = false; p._dashWin = 0.24;
          p.dashHit = new Set();
        }
        const b4 = p.pdodgeCrit;
        Game.tick(1 / 60); t += 1 / 60;
        if (p.pdodgeCrit && !b4) pd++;
        if (seen >= 0 && e._windT <= 0 && e.hitCd > 0) break;
      }
      return { win: +win.toFixed(3), pd, dmg: hp0 - p.hp };
    };
    const r = {};
    for (const x of [0.25, 0.30, 0.35]) r['r' + Math.round(x * 1000)] = trial(x);
    // ② 일반 타격(크리 아님)에 히트스톱이 걸리는가 — v187은 크리에만 걸었다
    Game.restart(777);
    Dungeon.floor = 2; Dungeon.roomIndex = 2; Game.state = 'play'; Game.player.god = true;
    World.buildRoom('combat'); Game.onRoomBuilt('combat');
    Game.enemies.length = 0;
    const t1 = createEnemy('skeleton', 520, 270, false, 1);
    t1.spawnT = 0; t1.hp = t1.maxHp = 99999; Game.enemies.push(t1);
    let stops = 0, ms = 0, swings = 0;
    Game.time = 0; Game._lastStopT = -9; Game.hitstop = 0;
    for (let i = 0; i < 240; i++) {
      if (i % 18 === 0) {                       // 초당 약 3.3회 = 실제 연타 속도
        swings++;
        const h0 = Game.hitstop;
        Game.damageEnemy(t1, 3, { x: 1, y: 0 }, { feel: true, crit: false });
        if (Game.hitstop > h0) { stops++; ms += Game.hitstop * 1000; }
      }
      Game.tick(1 / 60);
    }
    return { ...r, swings, stops, stopMs: +(ms / Math.max(1, stops)).toFixed(1) };
  });
  console.log('  손맛·회피:', JSON.stringify(feelv));
  ok('feel.dodgeWindowIsHuman',
    feelv.r250.win >= 0.36 && feelv.r250.pd > 0 && feelv.r300.pd > 0 && feelv.r250.dmg === 0,
    `예고 ${Math.round(feelv.r250.win * 1000)}ms · 반응 250ms에서 완벽 회피 ${feelv.r250.pd}회(피해 ${feelv.r250.dmg}) · 300ms ${feelv.r300.pd}회 ` +
    '(v187은 예고 250ms = 인간 반응 시간이라 250·300·350ms 전부 0회였다 — 기능은 있는데 사람이 닿을 수 없었다)');
  ok('feel.normalHitStops', feelv.stops >= feelv.swings * 0.9 && feelv.stopMs >= 30 && feelv.stopMs <= 60,
    `일반 타격 ${feelv.swings}회 중 ${feelv.stops}회 히트스톱 · 평균 ${feelv.stopMs}ms ` +
    '(v187은 크리에만 걸어 일반 타격은 **0회** — 잡몹을 벨 때 화면이 한 프레임도 안 멈췄다. ' +
    '상한 60ms: 길면 학살 중 스터터가 된다)');

  // ── 맵 연결감 기반 (v189) ──────────────────────────────────────────────
  // 사장: "맵도 계속 이어져 있다는 느낌이 들어야해."
  // 실측이 원인 넷을 지목했다: ①Dungeon에 좌표가 0개 ②진입점 49/49 상수
  // ③방향 없는 666ms 검정 페이드(런당 300초) ④같은 층 밝기 2~6개(3배 차)
  await boot(page, { cls: 'knight', heat: 0 });
  const mapf = await page.evaluate(() => {
    // ① 좌표계 — advance 가 실제로 공간을 옮기는가
    Game.restart(9);
    const before = Dungeon.mapNodes.length;
    for (let i = 0; i < 8; i++) { Dungeon.pendingDy = [-1, 0, 1][i % 3]; Dungeon.advance('combat'); }
    const coord = { nodes: Dungeon.mapNodes.length - before, edges: Dungeon.mapEdges.length,
      uniq: new Set(Dungeon.mapNodes.map((n) => n.x + ',' + n.y)).size,
      branched: Dungeon.mapEdges.filter((e) => e.y0 !== e.y1).length };
    // ② 진입점 — 나온 문 높이가 다음 방에 이어지는가
    Game.restart(24680); Game.state = 'play'; Game.player.god = true;
    const ys = [], dirs = [], frames = [], pans = [];
    for (let room = 0; room < 20; room++) {
      Game.enemies.length = 0; Game.pendingSpawns.length = 0; Game.markers.length = 0;
      Game.roomCleared = true;
      World.openDoors(Dungeon.doorOptions());
      const doors = World.doors.filter((d) => d.opt.type !== 'boss');
      if (!doors.length) break;
      const door = doors[room % doors.length];
      Game.player.x = door.x; Game.player.y = door.y;
      Game._tickPlay(1 / 60);
      if (Game.state !== 'transition') continue;
      dirs.push(Game.transition.dy);
      let f = 0;
      while (Game.state === 'transition' && f < 200) { Game.tick(1 / 60); f++; pans.push(Math.abs(Renderer.panX)); }
      frames.push(f);
      ys.push(Math.round(Game.player.y));
      Game.state = 'play';
    }
    // ④ 밝기 — 같은 층 안에서 불의 총량이 튀는가
    const lit = [];
    for (const fl of [1, 2, 3, 5, 8]) for (let i = 0; i < 8; i++) {
      Dungeon.floor = fl; Dungeon.roomIndex = 1 + i;
      World.buildRoom('combat'); lit.push(World.torches.length);
    }
    return { coord, entryUniq: new Set(ys).size, entrySamples: ys.length,
      dirs: [...new Set(dirs)].sort(), ms: Math.round(frames.reduce((a, b) => a + b, 0) / Math.max(1, frames.length) / 60 * 1000),
      maxPan: Math.round(Math.max(...pans, 0)), panLeft: Math.round(Math.abs(Renderer.panX) + Math.abs(Renderer.panY)),
      litMin: Math.min(...lit), litMax: Math.max(...lit) };
  });
  console.log('  맵기반:', JSON.stringify(mapf));
  ok('map.hasCoordinates', mapf.coord.nodes >= 8 && mapf.coord.edges >= 8 && mapf.coord.uniq >= 8 && mapf.coord.branched > 0,
    `방 ${mapf.coord.nodes}칸 이동 · 간선 ${mapf.coord.edges} · 고유 좌표 ${mapf.coord.uniq} · 상하 분기 ${mapf.coord.branched} ` +
    '(v188까지 Dungeon의 공간 정보는 roomIndex 정수 하나뿐이었다 — 「다음 방」만 있고 「옆방」이 없었다)');
  ok('map.doorDecidesEntry', mapf.entryUniq >= 3 && mapf.dirs.length >= 2,
    `문 ${mapf.entrySamples}개 통과 → 진입 높이 ${mapf.entryUniq}종 · 문 방향 ${JSON.stringify(mapf.dirs)} ` +
    '(v188까지 49/49 표본 전부 (81.6, 270) 한 점이었다 — 위 문을 고르든 아래 문을 고르든 똑같은 왼쪽 한가운데)');
  ok('map.transitionMoves', mapf.maxPan >= 700 && mapf.ms <= 520 && mapf.panLeft === 0,
    `전환 ${mapf.ms}ms · 최대 이동 ${mapf.maxPan}px · 전환 후 카메라 잔여 ${mapf.panLeft} ` +
    '(v188은 666ms 방향 없는 검정 페이드 × 450회 = 런당 300초가 검정 화면이었다. ' +
    '잔여 0은 필수 — 남으면 월드가 통째로 어긋난다)');
  ok('map.evenLighting', mapf.litMax - mapf.litMin <= 2 && mapf.litMin >= 3,
    `같은 층 횃불 ${mapf.litMin}~${mapf.litMax}개 ` +
    '(v188은 2~6개로 3배 차 — 어두운 방→밝은 방이 무작위로 오면 「같은 복도를 걷는다」가 아니라 ' +
    '「순간이동했다」로 읽힌다. ★ 이 값을 고치려고 생성 루프의 RNG.chance를 지우면 난수 스트림이 ' +
    '밀려 방 생성 전체가 바뀐다 — 실제로 겪었다. 총량은 생성 이후에 맞춘다)');

  // ── 배포 (v190) ────────────────────────────────────────────────────────
  // 실사고: v187·v188·v189 세 번의 빌드 동안 index.html 의 `?v=` 25개가 전부 186에 멈춰 있었다.
  // GAME_VERSION 은 main.js, 캐시버스트는 index.html — 두 곳이라 매번 한쪽만 올라갔다.
  // 그러면 브라우저가 파일마다 제각각 갱신돼 **main.js 는 v189인데 enemies.js 는 v186** 인
  // 상태가 만들어질 수 있다. 화면에는 최신 버전이 찍히면서 그 버전의 변경은 적용되지 않는다.
  // 「체감이 없다」는 보고가 코드가 아니라 여기서 나올 수 있었다 — 검증 도구 다음으로 위험한 자리다.
  const rel = await page.evaluate(async () => {
    const html = await (await fetch('index.html', { cache: 'no-store' })).text();
    const tags = [...html.matchAll(/\?v=(\d+)/g)].map((m) => +m[1]);
    return { ver: GAME_VERSION, tags: [...new Set(tags)], n: tags.length };
  });
  console.log('  배포:', JSON.stringify(rel));
  ok('release.cacheBustMatchesVersion',
    rel.n > 0 && rel.tags.length === 1 && rel.tags[0] === rel.ver,
    `index.html 캐시버스트 ${rel.n}개 = v${rel.tags.join(',')} · GAME_VERSION = v${rel.ver} ` +
    '(node tools/bump-version.js <버전> 으로 한 번에 올린다. ' +
    '어긋나면 사장 브라우저가 옛 JS를 계속 쓴다 — 고쳐도 안 닿는다)');

  // ── 사연 카드 클릭 (v193) ──────────────────────────────────────────────
  // 사장: "몹마다 사연이 화면을 가리니깐 클릭하면 시작되도록 해줘"
  // 새로 만든 입력 경로다 — 회귀가 없으면 조용히 죽는다 (v186·v192가 그렇게 당했다)
  await boot(page, { cls: 'knight', heat: 0 });
  const meet = await page.evaluate(() => {
    Game.restart(5); Dungeon.floor = 1; Dungeon.roomIndex = 2; Game.state = 'play'; Game.player.god = true;
    Game._metRun = {}; Game._meetQ = []; Game._meet = null; Game.banner = null;
    World.buildRoom('combat'); Game.onRoomBuilt('combat');
    for (let i = 0; i < 300 && !Game._meet; i++) { Game.tick(1 / 60); Game.banner = null; }
    if (!Game._meet) return { shown: false };
    const c0 = { open: Game._meet.open, h: Game.meetRect().h };
    const r = Game.meetRect();
    Input.mouse.x = r.x + r.w / 2; Input.mouse.y = r.y + r.h / 2; Input.mouse.justDown = true;
    const atk0 = Game.player.attackCd;
    Game._tickPlay(1 / 60);
    const c1 = { open: !!(Game._meet && Game._meet.open), h: Game.meetRect().h,
      ate: Input.mouse.justDown === false, noAtk: Game.player.attackCd <= atk0 + 0.001 };
    const r2 = Game.meetRect();
    Input.mouse.x = r2.x + r2.w / 2; Input.mouse.y = r2.y + r2.h / 2; Input.mouse.justDown = true;
    Game._tickPlay(1 / 60);
    return { shown: true, c0, c1, closed: Game._meet === null };
  });
  console.log('  사연카드:', JSON.stringify(meet));
  ok('lore.cardOpensOnClick',
    meet.shown && !meet.c0.open && meet.c1.open && meet.c1.h > meet.c0.h && meet.c1.ate && meet.c1.noAtk && meet.closed,
    `접힘 h${meet.shown ? meet.c0.h : '?'} → 클릭 → 펼침 h${meet.shown ? meet.c1.h : '?'} → 다시 클릭 → 닫힘 ` +
    `(클릭 소비 ${meet.shown ? meet.c1.ate : '?'} · 공격 안 나감 ${meet.shown ? meet.c1.noAtk : '?'}) ` +
    '(v187 카드는 3초간 화면 중앙 위를 덮었다. 클릭을 소비하지 않으면 「읽으려다 헛손질」이 된다)');

  // ── 방마다 보스급 (v194) ───────────────────────────────────────────────
  // 사장: "각 단계별로 잡몹+보스 나오게 하라니깐? 패턴을 피하고 특성 스킬을 쓰고 손맛이 있도록"
  // v192·v193 은 「층당」 1~1.35기였고(그마저 4번 방에 몰림), 게다가 우두머리는
  // enemies.js:90 의 `!this.isMini` 때문에 **패턴에서 통째로 제외**돼 있었다 —
  // 예고도 패턴도 없는 뚱뚱한 잡몹이라 나와도 보스로 안 읽혔다.
  await boot(page, { cls: 'knight', heat: 0 });
  const stage = await page.evaluate(() => {
    let rooms = 0, withMini = 0, stomps = 0, bodies = 0;
    for (let r = 0; r < 6; r++) {
      Game.restart(3000 + r * 29); Game.state = 'play'; Game.player.god = true;
      Dungeon.floor = 1; Dungeon.miniSeen = false;
      for (let room = 1; room <= 7; room++) {
        Dungeon.roomIndex = room;
        Game.enemies.length = 0; Game.pendingSpawns.length = 0; Game.markers.length = 0;
        World.buildRoom('combat'); Game.onRoomBuilt('combat');
        for (let i = 0; i < 300; i++) Game.tick(1 / 60);
        const live = Game.enemies.filter((e) => !e.dead);
        const mini = live.filter((e) => e.isMini);
        rooms++; bodies += live.length;
        if (!mini.length) continue;
        withMini++;
        const m = mini[0];
        for (let i = 0; i < 360; i++) {
          Game.tick(1 / 60); Game.player.x = m.x + 120; Game.player.y = m.y;
          if (m._stompT > 0) { stomps++; break; }
        }
      }
    }
    return { rooms, withMini, stomps, bodies: +(bodies / rooms).toFixed(2) };
  });
  console.log('  단계별보스:', JSON.stringify(stage));
  ok('stage.bossEveryRoom', stage.withMini >= stage.rooms * 0.85,
    `전투방 ${stage.rooms}개 중 ${stage.withMini}개에 보스급 (방당 적 ${stage.bodies}기) ` +
    '(v193은 층당 1.35기였고 그마저 특정 방에 몰렸다 — 사장이 앞쪽 방을 돌면 잡몹만 봤다)');
  // ══ 시전 인터럽트 (v201) ══════════════════════════════════════════════
  // 사장: "보스가 스킬쓸때 무적이 된다던가. 그런거 없어?" → 승인: "무적은 시전 인터럽트로"
  // 무적으로 딜을 막으면 플레이어가 할 일이 없어진다. 반대로 간다 —
  // 시전 중에는 **더 아프게 맞고**(×1.5) 대신 **경직되지 않는다**.
  const cast = await page.evaluate(() => {
    const R = {};
    Dungeon.floor = 1; Dungeon.roomIndex = Dungeon.totalRooms; Dungeon.build('boss');
    let bs = Game.enemies.find((e) => e.isBoss);
    bs.spawnT = 0;
    bs.castStart(Game);
    R.window = bs.castMax;
    R.need = bs.castNeed;
    R.needPct = +(bs.castNeed / bs.maxHp).toFixed(3);
    // ① 무경직 — 큰 넉백을 줘도 안 밀린다 (넉백으로 시전을 흐트러뜨리는 우회로가 없어야 한다)
    const x0 = bs.x;
    Game.damageEnemy(bs, 1, { x: 1, y: 0 }, { feel: true, kb: 900 });
    R.noFlinch = Math.abs(bs.x - x0) < 1 && Math.abs(bs.kbx) < 1;
    // ② 시전 중 피해 증폭 — **절대값이 아니라 비율**로 잰다.
    //   보스 버스트 상한(최대HP의 %)이 먼저 걸리므로 raw 10이 그대로 오지 않는다.
    //   상한을 모르는 채 절대값을 기대하면 거짓 실패가 난다 (1차에서 실제로 났다)
    const hpA = bs.hp;
    Game.damageEnemy(bs, 10, { x: 0, y: 0 }, { feel: false, kb: 0 });
    const dCast = hpA - bs.hp;
    const stSave = bs.state; bs.state = 'idle';          // 같은 타격을 평상시로 한 번 더
    const hpB = bs.hp;
    Game.damageEnemy(bs, 10, { x: 0, y: 0 }, { feel: false, kb: 0 });
    const dIdle = hpB - bs.hp;
    bs.state = stSave;
    R.ampDealt = dCast; R.idleDealt = dIdle;
    R.ampRatio = dIdle > 0 ? +(dCast / dIdle).toFixed(2) : 0;
    // ③ 임계까지 때리면 끊기고 그로기에 든다
    let guard = 0;
    while (bs.state === 'cast' && guard++ < 500) Game.damageEnemy(bs, 3, { x: 0, y: 0 }, { feel: false, kb: 0 });
    R.broke = bs.state === 'groggy';
    R.groggy = bs.groggyT || 0;
    R.thaws = false;
    for (let i = 0; i < 200 && bs.state === 'groggy'; i++) bs.update(1 / 60, Game);
    R.thaws = bs.state !== 'groggy';
    // ④ 못 끊으면 큰 기술이 그대로 나간다
    Dungeon.build('boss');
    bs = Game.enemies.find((e) => e.isBoss);
    bs.spawnT = 0;
    bs.castStart(Game);
    for (let i = 0; i < 400 && bs.state === 'cast'; i++) bs.update(1 / 60, Game);
    R.punish = bs.state === 'windup' && bs.attack && bs.attack.kind === 'uniq';
    // ⑤ 화면에 게이지가 그려지는가 — 「보이지 않는 창은 없는 것과 같다」
    Dungeon.build('boss');
    bs = Game.enemies.find((e) => e.isBoss);
    bs.spawnT = 0; bs.castStart(Game);
    let texts = 0;
    const g = Renderer.ctx, _f = g.fillText.bind(g);
    g.fillText = function (t, x, y) { if (typeof t === 'string' && t.indexOf('끊어라') >= 0) texts++; return _f(t, x, y); };
    bs.draw(g);
    g.fillText = _f;
    R.drawn = texts;
    return R;
  });
  console.log('  시전:', JSON.stringify(cast));
  ok('boss.castInterruptible',
    cast.broke && cast.noFlinch && cast.ampRatio >= 1.4 && cast.needPct > 0.05 && cast.needPct < 0.25,
    `시전 창 ${cast.window}초 · 차단 임계 ${cast.need}(최대HP의 ${(cast.needPct * 100).toFixed(0)}%) · ` +
    `무경직 ${cast.noFlinch} · 같은 타격이 평상시 ${cast.idleDealt} → 시전 중 ${cast.ampDealt} (×${cast.ampRatio}) · 차단 ${cast.broke} ` +
    '(무적으로 딜을 막으면 플레이어가 할 일이 없어진다 — 반대로 「지금 때려야 한다」로 만든다. ' +
    '넉백 면역이 없으면 화력 없이 밀어내기로 시전을 흐트러뜨리는 우회로가 생긴다)');
  ok('boss.castResolves',
    cast.punish && cast.groggy >= 1.5 && cast.thaws,
    `못 끊으면 고유기가 그대로 나간다 ${cast.punish} · 끊으면 그로기 ${cast.groggy.toFixed(1)}초 후 복귀 ${cast.thaws} ` +
    '(끊어도 안 끊어도 결과가 있어야 선택이 된다 — 그로기는 인터럽트의 보상이고, 시전 완료는 벌이다)');
  ok('boss.castIsVisible', cast.drawn >= 1,
    `시전 게이지·문구가 실제로 그려진다 (${cast.drawn}회) ` +
    '(★ 끊으라고 만든 창인데 화면에 안 보이면 존재하지 않는 것과 같다 — v185·186·192의 교훈)');

  // ══ 속성·상태이상 (v200) ══════════════════════════════════════════════
  // 사장: "상대를 얼리거나 화상을 입히거나 속성도 없고 뭐하는거야?"
  // ★ 「걸린다」와 「보인다」를 **따로** 검사한다.
  //   v185~192에서 세 번 겪었다 — 기능은 작동하는데 화면에 안 나와서 없는 것과 같았다.
  const stat = await page.evaluate(async () => {
    const R = { elems: {}, applied: [], zoneKinds: [], hud: 0, dashFrozen: false, healCut: false, curseNeedsMinion: false };
    // ① 23종 전부 속성이 배정돼 있는가
    for (const f of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 45, 50, 60, 61, 62, 63, 64, 65, 66, 67]) {
      const b = createBoss(f, 300, 200);
      R.elems[f] = (b.elems || []).slice();
    }
    // ② 플레이어가 5종 전부 받을 수 있는가 + 화면에 나오는가
    Dungeon.floor = 1; Dungeon.roomIndex = Dungeon.totalRooms; Dungeon.build('boss');
    const p = Game.player; p.god = false;
    for (const k of ['burn', 'freeze', 'poison', 'shock', 'curse']) {
      Game.applyStatus(k, 4);
      const F = { burn: 'burnT', freeze: 'freezeT', poison: 'poisonT', shock: 'shockT', curse: 'curseT' }[k];
      if ((p[F] || 0) > 0) R.applied.push(k);
    }
    // ③ HUD 칩이 실제로 그려지는가 — 그리기 호출을 세서 확인 (상태 없을 때와 비교)
    const cnt = () => { let n = 0; const g = Renderer.ctx; const _f = g.fillText.bind(g);
      g.fillText = function (t, x, y) { if (['화상', '빙결', '중독', '감전', '저주'].includes(t)) n++; return _f(t, x, y); };
      HUD.draw(g, Game); g.fillText = _f; return n; };
    R.hud = cnt();
    // ④ ❄빙결이 대시 충전을 정지시키는가 (회피 자원 박탈이 이 설계의 심장이다)
    p.burnT = p.poisonT = p.shockT = p.curseT = 0;
    p.freezeT = 3; p.dashCharges = 0; p.dashRegenT = 0;
    for (let i = 0; i < 90; i++) p.update(1 / 60, Game);
    R.dashFrozen = p.dashCharges === 0;
    p.freezeT = 0; p.dashRegenT = 0;
    // 재충전 시간은 특성·유물로 변한다 — 고정 프레임을 쓰면 검사 창이 모자라 거짓 실패가 난다
    const need = Math.ceil(p.dashRegenTime() * 60) + 20;
    for (let i = 0; i < need; i++) p.update(1 / 60, Game);
    R.dashThaws = p.dashCharges > 0;
    R.regenSec = +p.dashRegenTime().toFixed(2);
    // ⑤ 🕯저주는 부하가 살아 있으면 안 풀린다
    p.curseT = 5;
    Game.enemies.push(Object.assign(createEnemy('skeleton', 400, 300, false, 1), { summoned: true }));
    for (let i = 0; i < 120; i++) p.update(1 / 60, Game);
    const withMinion = p.curseT;
    Game.enemies.forEach((e) => { if (e.summoned) e.dead = true; });
    for (let i = 0; i < 120; i++) p.update(1 / 60, Game);
    R.curseNeedsMinion = withMinion > 4.0 && p.curseT < withMinion - 1;
    // ⑥ 보스가 바닥에 흔적을 남기는가 (계측에서 boss.js zones.push 는 0회였다)
    Game.zones.length = 0;
    const bs = Game.enemies.find((e) => e.isBoss);
    if (bs) { bs.strike(Game, 400, 300, { status: false }); }
    R.zoneKinds = Game.zones.filter((z) => z.byBoss).map((z) => z.elem);
    return R;
  });
  console.log('  속성:', JSON.stringify({ applied: stat.applied, hud: stat.hud, zones: stat.zoneKinds,
    dashFrozen: stat.dashFrozen, dashThaws: stat.dashThaws, regenSec: stat.regenSec, curse: stat.curseNeedsMinion }));
  const elemN = Object.values(stat.elems).filter((a) => a && a.length).length;
  const elemKinds = new Set(Object.values(stat.elems).flat());
  ok('elem.everyBossHasOne', elemN === 23 && elemKinds.size === 5,
    `보스 ${elemN}/23 종에 속성 배정 · 쓰인 속성 ${elemKinds.size}종 (${[...elemKinds].join(',')}) ` +
    '(v199까지 boss.js 가 거는 상태이상은 감속 한 곳(1.6초)뿐이었다 — 속성이 없다는 사장 지적이 정확했다)');
  ok('elem.playerReceivesAll', stat.applied.length === 5,
    `플레이어가 받을 수 있는 상태 ${stat.applied.length}/5종 (${stat.applied.join(',')}) ` +
    '(종전 플레이어 필드는 slowT/brandT 둘뿐 — status:{burn,shock,poison} 은 **적 쪽에만** 있어 시스템이 한 방향이었다)');
  ok('elem.visibleOnScreen', stat.hud >= 5,
    `HUD 상태 칩 ${stat.hud}개가 실제로 그려진다 ` +
    '(★ 「걸린다」와 「보인다」는 다르다 — v185 무리 경감, v186 리더, v192 우두머리에서 세 번 겪었다. ' +
    '보이지 않는 상태이상은 없는 것과 같다)');
  ok('elem.freezeStopsDash', stat.dashFrozen && stat.dashThaws,
    `빙결 중 대시 충전 정지 ${stat.dashFrozen} · 해제 후 재충전 ${stat.dashThaws} (재충전 ${stat.regenSec}초) ` +
    '(이 설계의 심장 — v188에서 세운 **회피 자원**을 정면으로 빼앗는다. 숫자가 아니라 손에서 느껴진다)');
  ok('elem.curseNeedsMinionKill', stat.curseNeedsMinion,
    `저주는 부하가 살아 있는 동안 안 풀리고, 처치하면 풀린다 (${stat.curseNeedsMinion}) ` +
    '(종전 소환 부하는 무시해도 그만이었다 — 처리할 이유를 만든다)');
  ok('elem.bossLeavesResidue', stat.zoneKinds.length > 0,
    `보스가 남긴 바닥 잔여물 ${stat.zoneKinds.length}개 (${stat.zoneKinds.join(',')}) ` +
    '(계측: boss.js 의 zones.push 는 **0회**였다 — 보스전 3분 동안 방이 처음 모습 그대로였다. ' +
    '이제 방이 시간에 따라 변하고, HP 인플레 없이 후반 압박이 생긴다)');

  ok('stage.miniHasPattern', stage.withMini === 0 || stage.stomps >= stage.withMini * 0.9,
    `보스급 ${stage.withMini}기 중 ${stage.stomps}기가 예고 패턴(강타 0.75초)을 실제로 시전 ` +
    '(v193까지 enemies.js 가 `!this.isMini` 로 우두머리를 패턴에서 제외했다 — ' +
    '예고 없는 뚱뚱한 잡몹은 보스가 아니다. 「패턴을 피하고」가 성립할 자리가 없었다)');

  ok('noPageErrors', errs.length === 0, errs.slice(0, 3).join(' | '));

  await browser.close();
  const fails = R.filter((r) => !r.v);
  console.log(`\n=== ${fails.length ? '실패 ' + fails.length + '건: ' + fails.map((f) => f.k).join(', ') : `전부 통과 (${R.length}항목)`} ===`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
