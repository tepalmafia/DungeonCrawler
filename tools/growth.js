// ══════════════════════════════════════════════════════════════════════════
//  성장 곡선 대조 — 「층이 깊어질수록 재미가 유지되는가」를 수치로 본다.
//
//    python3 tools/serve.py 8137 &   node tools/growth.js
//
//  ── 무엇을 재는가 ────────────────────────────────────────────────────
//  이 게임에는 힘의 출처가 셋, 어려움의 출처가 하나다.
//
//    ① 레벨      dmgMax += lv×2.4 · maxHp += lv×18 · armor += lv×1.2   (선형)
//    ② 장비      scale = 1 + (층−1)×0.42, 여기에 등급 배수가 곱해진다   (선형×등급)
//    ③ 스킬      고정 배수 — 층과 무관하므로 여기선 뺀다
//    ④ 몬스터    powerMult = 1 + (층−1)×0.45                          (선형)
//
//  넷이 **서로 다른 모양**이면 층이 깊어질수록 한쪽이 이긴다. 이기는 쪽이
//  플레이어면 게임이 싱거워지고, 몬스터면 벽이 된다. 둘 다 재미가 아니다.
//  (2D 판에서 사장이 겪은 「층을 올라갈수록 쉬워지고 재미가 없다」가 이거였다
//   — tools/curve.js 머리말.)
//
//  그래서 두 값만 본다. 둘 다 **층 사이에서 평평해야** 한다:
//
//    TTK  한 마리 죽이는 데 걸리는 초       ← 오르면 소모전, 내리면 싱겁다
//    TTD  몹 평타 몇 대에 내가 죽나         ← 내리면 즉사, 오르면 위험이 없다
//
//  ── 왜 봇이 아니라 계산인가 ──────────────────────────────────────────
//  봇으로 9층까지 가려면 시드당 한 시간이 넘는다. 대신 **게임의 진짜 코드**를
//  그대로 부른다 — rollItem 으로 장비를 굴리고, player.recompute() 로 스탯을
//  뽑고, combat.mitigate() 로 감산한다. 손으로 옮겨 적은 식은 하나도 없다.
//  (옮겨 적으면 그 순간부터 게임과 따로 논다.)
//
//  못 담는 것도 적어 둔다: 스킬 화력·물약·회피·조작 실력. 그래서 이 숫자는
//  **절대값이 아니라 층 사이의 기울기**로만 읽어야 한다. 기울기가 이 도구가
//  답할 수 있는 전부다.
// ══════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright-core');

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137/3d';
const FLOORS = 9;
const SETS = 40;          // 층마다 장비 세트를 몇 번 굴려 중앙값을 낼 것인가

// ── 시나리오 ─────────────────────────────────────────────────────────
// 문자열로 넘긴다 — page.evaluate 는 함수를 못 넘긴다.
//
// xp:    층당 경험치 수입에 곱하는 배수 (지금은 없음 = 1)
// power: 몬스터 powerMult 법칙 (지금은 1 + (층−1)×0.45)
const XP_PLANS = [
  ['현재 (배수 없음)', 'f => 1'],
  ['등차 1+(층−1)×0.5', 'f => 1 + (f - 1) * 0.5'],
  ['등비 1.42^(2(층−1))', 'f => Math.pow(1.42, 2 * (f - 1))'],
];
const POWER_LAWS = [
  // ★ 「의도한 법칙」과 「지금 코드가 실제로 하는 것」을 나란히 잰다.
  //    표가 셋뿐이던 시절엔 floorDef() 가 4층 이상을 3층으로 클램프해서
  //    이 두 줄이 ×1.21 대 ×2.58 로 갈렸다 — 곡선이 아니라 **표가 비어서**
  //    생긴 차이였다. 아홉 칸을 채운 뒤로는 두 줄이 같아야 한다.
  //    다시 갈라지면 표에 빠진 층이 생긴 것이다.
  ['설계 등차 1+(층−1)×0.45', 'f => 1 + (f - 1) * 0.45'],
  ['★ 지금 코드 (층 표 그대로)', 'f => fl.floorDef(f).powerMult'],
  ['등비 1.35^(층−1)', 'f => Math.pow(1.35, f - 1)'],
  ['등비 1.45^(층−1)', 'f => Math.pow(1.45, f - 1)'],
  ['등비 1.55^(층−1)', 'f => Math.pow(1.55, f - 1)'],
  ['등비 1.65^(층−1)', 'f => Math.pow(1.65, f - 1)'],
];

const band = (a) => Math.max(...a) / Math.min(...a);
const pad = (s, n) => String(s).padEnd(n);

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));

  await page.goto(`${BASE}/index.html?seed=GROWTH&autostart=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.G3 && window.G3.state === 'play', { timeout: 45000 });

  const R = await page.evaluate(async ([FLOORS, SETS, XP_PLANS, POWER_LAWS]) => {
    const G = window.G3, P = G.player;
    const im = await import('./js/game/items.js');
    const em = await import('./js/game/enemies.js');
    const fl = await import('./js/world/floors.js');   // eval 로 넘긴 법칙이 쓴다
    const cb = await import('./js/game/combat.js');
    void fl;
    const rm = await import('./js/core/rng.js');

    const save = { level: P.level, equipped: { ...P.equipped } };
    const MAXLV = 40;

    // ── ① 층별 「그 층 장비를 갖춘 레벨 L 의 플레이어」 ──────────────
    // 장비 난수는 **시나리오와 무관하게 고정**한다. 안 그러면 시나리오
    // 차이인지 장비 운인지 구분이 안 된다.
    const player = {};
    for (let f = 1; f <= FLOORS; f++) {
      const sets = [];
      for (let n = 0; n < SETS; n++) {
        const rnd = rm.makeRng(`GROWTH-${f}-${n}`);
        const eq = {};
        for (const s of im.SLOTS) eq[s] = im.rollItem(rnd, f, 0, { slot: s });
        sets.push(eq);
      }
      player[f] = {};
      for (let lv = 1; lv <= MAXLV; lv++) {
        const rows = sets.map((eq) => {
          P.level = lv; P.equipped = eq; P.recompute();
          return {
            avg: (P.dmgMin + P.dmgMax) / 2,
            aspd: P.attackSpeed,
            critF: 1 + (P.critChance / 100) * (P.critMult - 1),
            hp: P.maxHp,
            armor: P.armor,
          };
        });
        const m = (k) => { const s = rows.map((r) => r[k]).sort((a, b) => a - b); return s[s.length >> 1]; };
        player[f][lv] = { avg: m('avg'), aspd: m('aspd'), critF: m('critF'), hp: m('hp'), armor: m('armor') };
      }
    }
    P.level = save.level; P.equipped = save.equipped; P.recompute();

    const D = em.ARCHETYPES.skeleton;            // 잡몹 기준선
    const HP_SCALE = em.HP_SCALE;

    // ── ② 레벨 곡선 — player.gainXp 의 식 그대로 ──────────────────
    const PER_FLOOR_XP = 18 * 17;                // 층당 적 ~18마리 × 평균 17xp
    const levelsByFloor = (xpMul) => {
      const out = []; let lv = 1, xp = 0, need = 24;
      for (let f = 1; f <= FLOORS; f++) {
        xp += PER_FLOOR_XP * xpMul(f);
        while (xp >= need) { xp -= need; lv++; need = Math.round(need * 1.42 + 8); }
        out.push(Math.min(MAXLV, lv));
      }
      return out;
    };

    // ── ③ 한 시나리오의 층별 TTK / TTD ────────────────────────────
    const run = (xpSrc, powSrc) => {
      const xpMul = eval(xpSrc), pw = eval(powSrc);
      const lvs = levelsByFloor(xpMul);
      const rows = [];
      for (let f = 1; f <= FLOORS; f++) {
        const lv = lvs[f - 1];
        const p = player[f][lv];
        const mult = pw(f);
        const eHp = D.hp * mult * HP_SCALE, eDmg = D.dmg * mult, eArm = D.armor * mult;
        const perHit = cb.mitigate(p.avg, eArm, lv);          // 내가 주는 한 대
        const taken = cb.mitigate(eDmg, p.armor, lv);         // 내가 받는 한 대
        rows.push({ f, lv, ttk: eHp / (perHit * p.aspd * p.critF), ttd: p.hp / taken });
      }
      return rows;
    };

    // ── ④ TTK·TTD 를 1층 값에 붙들려면 몬스터가 얼마여야 하나 ───────
    // 「지금 몬스터가 약하다」가 아니라 **「얼마나 세져야 평평해지나」**를
    // 역산한다. 이게 있어야 다음 층 값을 손이 아니라 계산으로 정한다.
    const solve = (xpSrc) => {
      const xpMul = eval(xpSrc);
      const lvs = levelsByFloor(xpMul);
      const out = [];
      let ttk0 = 0, ttd0 = 0;
      for (let f = 1; f <= FLOORS; f++) {
        const lv = lvs[f - 1];
        const p = player[f][lv];
        if (f === 1) {
          const eHp = D.hp * HP_SCALE, eDmg = D.dmg, eArm = D.armor;
          ttk0 = eHp / (cb.mitigate(p.avg, eArm, lv) * p.aspd * p.critF);
          ttd0 = p.hp / cb.mitigate(eDmg, p.armor, lv);
          out.push({ f, lv, hpMul: 1, dmgMul: 1 });
          continue;
        }
        // HP: TTK 를 ttk0 로 맞추는 HP. 적 방어도는 HP 배수와 같이 움직이므로
        // 몇 번 반복해 수렴시킨다 (방어도가 내 피해를 깎아 TTK 를 늘린다).
        let hpMul = 1;
        for (let it = 0; it < 40; it++) {
          const perHit = cb.mitigate(p.avg, D.armor * hpMul, lv);
          hpMul = (ttk0 * perHit * p.aspd * p.critF) / (D.hp * HP_SCALE);
        }
        // 공격: 받는 한 대가 hp/ttd0 이 되게
        const want = p.hp / ttd0;
        // mitigate 는 raw 에 선형이다 (하한 1 은 여기 규모에선 안 걸린다)
        const factor = cb.mitigate(1000, p.armor, lv) / 1000;
        const dmgMul = want / factor / D.dmg;
        out.push({ f, lv, hpMul, dmgMul });
      }
      return { rows: out, ttk0, ttd0 };
    };

    const res = { scenarios: [], sweep: [], solve: {} };
    for (const [lab, src] of XP_PLANS)
      res.scenarios.push({ label: lab, rows: run(src, POWER_LAWS[0][1]) });
    for (const [lab, src] of POWER_LAWS)
      res.sweep.push({ label: lab, rows: run(XP_PLANS[0][1], src) });
    res.solve = solve(XP_PLANS[0][1]);
    res.solveXp = solve(XP_PLANS[2][1]);
    return res;
  }, [FLOORS, SETS, XP_PLANS, POWER_LAWS]);

  console.log(`\n몹 기준: 해골 · 장비: 층별 ${SETS}세트 중앙값 · 티어 0`);
  console.log('TTK = 한 마리 죽는 초 · TTD = 몹 평타 몇 대에 내가 죽나');

  console.log('\n══ ① 경험치만 바꿔 본다 (몬스터는 현재 법칙 그대로)');
  for (const s of R.scenarios) {
    const line = s.rows.map((r) => `${r.f}층Lv${r.lv} ${r.ttk.toFixed(1)}s/${r.ttd.toFixed(0)}대`).join('  ');
    console.log(`\n  ${s.label}`);
    console.log(`    ${line}`);
    console.log(`    밴드 → TTK ×${band(s.rows.map((r) => r.ttk)).toFixed(2)}  TTD ×${band(s.rows.map((r) => r.ttd)).toFixed(2)}`);
  }

  console.log('\n══ ② 몬스터 성장 법칙을 바꿔 본다 (경험치는 현재 그대로)');
  console.log(`  ${pad('법칙', 28)}${pad('TTK 밴드', 11)}${pad('TTD 밴드', 11)}9층 TTK / TTD`);
  for (const s of R.sweep) {
    const ttk = s.rows.map((r) => r.ttk), ttd = s.rows.map((r) => r.ttd);
    const last = s.rows[s.rows.length - 1];
    console.log(`  ${pad(s.label, 28)}${pad('×' + band(ttk).toFixed(2), 11)}${pad('×' + band(ttd).toFixed(2), 11)}`
      + `${last.ttk.toFixed(1)}s / ${last.ttd.toFixed(0)}대`);
  }

  for (const [tag, sv] of [['경험치 현재', R.solve], ['경험치 등비', R.solveXp]]) {
    console.log(`\n══ ③ 1층 체감(TTK ${sv.ttk0.toFixed(1)}s · TTD ${sv.ttd0.toFixed(0)}대)을 유지하려면 — ${tag}`);
    console.log(`  ${pad('층', 5)}${pad('Lv', 5)}${pad('필요 HP배수', 13)}${pad('필요 공격배수', 15)}현재 배수`);
    for (const r of sv.rows) {
      const cur = 1 + (r.f - 1) * 0.45;
      console.log(`  ${pad(r.f, 5)}${pad(r.lv, 5)}${pad('×' + r.hpMul.toFixed(2), 13)}${pad('×' + r.dmgMul.toFixed(2), 15)}×${cur.toFixed(2)}`);
    }
    const n = sv.rows.length - 1;
    console.log(`  → 층당 등비로 보면  HP ×${Math.pow(sv.rows[n].hpMul, 1 / n).toFixed(3)}`
      + `  공격 ×${Math.pow(sv.rows[n].dmgMul, 1 / n).toFixed(3)}  (현재는 등차라 층당 비가 계속 줄어든다)`);
  }

  if (errs.length) console.log('\nERR ' + [...new Set(errs)].slice(0, 3).join(' | '));
  await browser.close();
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
