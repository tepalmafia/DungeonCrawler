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
    const KEYS = ['ctx', 'master', 'limiter', 'sfxBus', 'musicBus', 'duck',
      'revBus', 'conv', 'revWet', 'revHP', '_noiseBuf', 'space', '_gates'];
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
    const hz = [];
    for (let i = 0; i < 12; i++) hz.push(zcr(await render(() => AudioSys.hit('flesh', 480))));
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
  ok('audio.hitVaries', audio.varPct >= 10,
    `같은 타격 12회 음색 중심 변주 SD ${audio.varPct}% (v173은 계측 중앙값 1.9% — 반음의 1/3)`);
  ok('audio.stereoPan', audio.left <= -0.4 && audio.right >= 0.4 && Math.abs(audio.mid) < 0.15,
    `좌 ${audio.left} / 중앙 ${audio.mid} / 우 ${audio.right} (v173은 모노 — 패닝 노드 0개)`);
  ok('audio.hasReverbTail', audio.tailHit >= 0.4,
    `타격 잔향 꼬리 ${audio.tailHit}초 (v173은 T60 중앙값 0.19초 = 무향실)`);
  ok('audio.ambienceExists', audio.shots >= 12 && audio.acts >= 6 && audio.spaces >= 5,
    `환경음 원샷 ${audio.shots}종 · 막 프리셋 ${audio.acts} · 공간 ${audio.spaces} (v173은 환경음 0개)`);
  ok('audio.newLayers', audio.hasNew,
    '예고음·헛손질·막힘·처형·덕킹·공간전환 신설 (예고는 게임플레이 — 화면을 안 봐도 읽혀야 한다)');

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

  ok('noPageErrors', errs.length === 0, errs.slice(0, 3).join(' | '));

  await browser.close();
  const fails = R.filter((r) => !r.v);
  console.log(`\n=== ${fails.length ? '실패 ' + fails.length + '건: ' + fails.map((f) => f.k).join(', ') : `전부 통과 (${R.length}항목)`} ===`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
