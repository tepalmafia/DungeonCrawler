// ══════════════════════════════════════════════════════════════════════════
//  변종 점검 — 「같은 몸, 다른 규칙」이 실제로 다른가.
//
//    python3 tools/serve.py 8137 &   node tools/variant-audit.js
//
//  ★ 왜 필요한가
//    변종은 **원본과 같은 `key`** 를 쓴다. 그래야 소리·시체·대사·정예 기술 등
//    종족 키로 찾는 표 여덟 개가 그대로 동작하기 때문이다 (정찰에서 확인).
//    그런데 그 때문에 **겉으로는 원본과 구분이 안 간다** — 이름만 다르고
//    규칙 필드를 아무도 안 읽으면 그냥 이름이 다른 해골이다. 오류는 안 난다.
//
//    그래서 규칙마다 **실제로 재서** 확인한다:
//      · 방패병  정면과 등 뒤 피해가 다른가
//      · 조각상  정말 안 움직이는가
//      · 순례자  죽은 자리에 느린 구역이 생기는가
//      · 사슬궁수 화살이 관통하고 묶는가
//      · 창병    사거리가 더 긴가
//
//    그리고 **표 여덟 개가 여전히 원본 것을 쓰는지**도 같이 본다 —
//    변종을 넣으면서 key 를 실수로 바꾸면 그 순간 소리가 사라진다.
// ══════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright-core');

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137/3d';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));

  await page.goto(`${BASE}/index.html?seed=VARIANT&autostart=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.G3 && window.G3.state === 'play', { timeout: 45000 });

  const out = await page.evaluate(async () => {
    const G = window.G3, P = G.player;
    const em = await import('./js/game/enemies.js');
    const cm = await import('./js/game/combat.js');
    const au = await import('./js/core/audio.js');
    P.maxHp = 1e9; P.hp = 1e9; P.invuln = 1e9;

    const VARIANTS = ['spearman', 'shieldman', 'gatekeeper', 'drowned', 'chainer', 'statue'];
    const table = [];

    // ── 1. key 를 원본으로 유지했는가 (표 여덟 개가 여기 걸려 있다) ──
    for (const v of VARIANTS) {
      const d = em.ARCHETYPES[v];
      table.push({
        v, name: d?.name, key: d?.key, variant: d?.variant,
        keyOk: !!d && ['skeleton', 'ghoul', 'archer', 'golem'].includes(d.key),
      });
    }

    // ── 2. 규칙이 실제로 도는가 ──
    const rules = {};
    const spawn = (kind, x, z) => {
      const e = new em.Enemy(G, kind, x, z, 1);
      G.enemies.push(e);
      e.hp = e.maxHp = 1e7;
      return e;
    };
    const clean = (e) => {
      const i = G.enemies.indexOf(e);
      if (i >= 0) G.enemies.splice(i, 1);
      e.dispose();
    };

    // 방패병 — 정면 vs 등 뒤
    {
      const e = spawn('shieldman', P.pos.x + 3, P.pos.z);
      e.facing = Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z);   // 플레이어를 본다
      const before = e.hp;
      cm.hitEnemy(G, e, 1000, { from: P.pos, los: false });
      const front = before - e.hp;
      e.hp = before;
      e.facing += Math.PI;                                          // 등을 돌린다
      cm.hitEnemy(G, e, 1000, { from: P.pos, los: false });
      const back = before - e.hp;
      rules.shield = { front: Math.round(front), back: Math.round(back) };
      clean(e);
    }

    // 조각상 — 정말 안 움직이는가
    {
      const e = spawn('statue', P.pos.x + 5, P.pos.z);
      e.home.set(e.pos.x, 0, e.pos.z);
      e.aggro = true; e.state = 'chase';
      const x0 = e.pos.x;
      for (let i = 0; i < 120; i++) e.update(1 / 60, G);
      rules.statue = { moved: +Math.abs(e.pos.x - x0).toFixed(3) };
      clean(e);
    }

    // 순례자 — 죽은 자리에 느린 구역
    {
      G.slowZones.length = 0;
      const e = spawn('drowned', P.pos.x + 3, P.pos.z);
      e.hp = 1;
      cm.hitEnemy(G, e, 1e6, { from: P.pos, los: false });
      rules.drowned = { zones: G.slowZones.length };
      G.slowZones.length = 0;
      clean(e);
    }

    // 사슬 궁수 — 관통·속박이 화살에 실렸는가
    {
      const e = spawn('chainer', P.pos.x + 8, P.pos.z);
      const n0 = G.projectiles.length;
      e._strike(G, P, 8);
      const pr = G.projectiles[G.projectiles.length - 1];
      rules.chainer = {
        fired: G.projectiles.length > n0,
        pierce: pr ? pr.pierce : -1,
        root: pr ? pr.root : -1,
      };
      G.projectiles.length = n0;
      clean(e);
    }

    // 창병 — 사거리가 더 긴가
    rules.spearman = {
      range: em.ARCHETYPES.spearman.range,
      base: em.ARCHETYPES.skeleton.range,
    };

    // ── 3. 소리가 원본 것을 쓰는가 (key 유지의 실제 목적) ──
    const sound = {};
    for (const v of VARIANTS) {
      const d = em.ARCHETYPES[v];
      let threw = false;
      try { au.Sfx.enemyHit(d.key, false, 0.5); } catch { threw = true; }
      sound[v] = { key: d.key, ok: !threw };
    }
    return { table, rules, sound };
  });

  console.log('\n변종        이름            key        원본키 유지');
  for (const r of out.table)
    console.log(String(r.v).padEnd(12) + String(r.name).padEnd(16)
      + String(r.key).padEnd(11) + (r.keyOk ? '✔' : '✘  ← 표 여덟 개가 죽는다'));

  const R = out.rules;
  console.log('\n규칙이 실제로 도는가');
  console.log(`  방패병   정면 ${R.shield.front} · 등 뒤 ${R.shield.back}`
    + (R.shield.front < R.shield.back ? '   ✔ 정면이 단단하다' : '   ✘ 차이 없음'));
  console.log(`  조각상   120프레임 동안 이동 ${R.statue.moved}`
    + (R.statue.moved < 0.05 ? '   ✔ 안 움직인다' : '   ✘ 움직였다'));
  console.log(`  순례자   죽은 뒤 느린 구역 ${R.drowned.zones}개`
    + (R.drowned.zones > 0 ? '   ✔' : '   ✘ 안 생김'));
  console.log(`  사슬궁수 관통 ${R.chainer.pierce} · 속박 ${R.chainer.root}초`
    + (R.chainer.pierce > 0 && R.chainer.root > 0 ? '   ✔' : '   ✘ 화살에 안 실림'));
  console.log(`  창병     사거리 ${R.spearman.range} (해골 ${R.spearman.base})`
    + (R.spearman.range > R.spearman.base ? '   ✔' : '   ✘'));

  console.log('\n소리 — 변종이 원본 음색을 쓰는가');
  for (const [v, s] of Object.entries(out.sound))
    console.log(`  ${v.padEnd(11)} → ${s.key.padEnd(9)} ${s.ok ? '✔' : '✘ 예외'}`);

  if (errs.length) console.log('\nERR ' + [...new Set(errs)].slice(0, 3).join(' | '));
  await browser.close();
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
