// 성장 곡선 대조 (v212b) — 사장: "층을 올라갈수록 쉬워지고 재미가 없다"
//
// 사장 F9 (v212): **5층 · Lv14 · 특성 20장 · 유물 12개 · 공7.3 · 10.4분 · 포기**
// 보스 처치 시간: 1층 16초 → 3층 11초. **층을 올랐는데 더 빨리 죽는다.**
//
// 그리고 내 계측이 이걸 못 봤다. 나는 「사장 화력」을 기준의 ×0.45 로 잡았는데
// 5층 기준이 공8.25 이니 내 모델은 공3.7 — **사장 실측 공7.3 의 절반**이었다.
// 사장보다 2배 약한 플레이어를 세워놓고 밸런스를 맞추면 「쉬워진다」가 보일 리 없다.
//
// 이 도구는 가정을 버리고 **진짜 런에서** 두 곡선을 함께 잰다:
//   ① 화력 곡선 — 층마다 currentAtk / 특성 / 유물 / 레벨
//   ② 콘텐츠 곡선 — 그 층 방 하나의 적 총 HP
//   ③ 둘의 비 = **방 하나를 치우는 데 걸리는 시간**. 이게 층이 오를수록 줄면 게임이 쉬워진다
//   node tools/curve.js [분]
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const MIN = parseFloat(process.argv[2] || '12');

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.goto(`${BASE}/?test=1&bot=1&botloop=1`);
  await p.waitForFunction(() => typeof Game !== 'undefined' && typeof Meta !== 'undefined');
  await p.evaluate(() => {
    localStorage.clear(); Meta.load(); Meta.data.introSeen = true;
    Meta.data.classes = { knight: true, archer: true, mage: true, alch: true }; Meta.save();
  });
  await p.reload();
  await p.waitForFunction(() => typeof Game !== 'undefined' && Game.state);
  await p.evaluate(() => {
    window.__cv = [];
    // ★ 방의 적은 **시간을 두고** 들어온다 (markers·pendingSpawns).
    //   1차엔 생성 1.2초 뒤 한 번만 재서 늦게 오는 적을 통째로 빠뜨렸다 —
    //   floorHpScale 은 1→5층 ×2.38 인데 내 표엔 ×1.6 으로 찍혔다. 배율이 아니라 계기가 틀렸다.
    //   이제 방이 **사는 동안 내내** 누적한다: 그 방에 존재한 적 전부의 maxHp 합
    let cur = null;
    const _b = Dungeon.build.bind(Dungeon);
    Dungeon.build = function (t) {
      if (cur && cur.n) window.__cv.push(cur);
      const r = _b(t);
      const pl = Game.player;
      cur = { f: Dungeon.floor, kind: t, lv: Game.level,
        atk: pl ? +pl.currentAtk().toFixed(2) : 1, tr: pl ? pl.traits.length : 0,
        rel: pl ? pl.relics.length : 0, mhp: pl ? pl.maxHp : 0, ehp: 0, n: 0, _seen: [] };
      return r;
    };
    const acc = () => {
      if (cur && Game.state === 'play') {
        for (const e of Game.enemies) {
          if (e.neutral || cur._seen.includes(e)) continue;
          cur._seen.push(e);
          cur.ehp += e.maxHp; cur.n++;
        }
      }
      requestAnimationFrame(acc);
    };
    requestAnimationFrame(acc);
  });
  const end = Date.now() + MIN * 60000;
  while (Date.now() < end) await p.waitForTimeout(20000);
  const R = await p.evaluate(() => window.__cv.map((x) => ({ ...x, _seen: undefined })));
  await b.close();

  const byF = {};
  for (const x of R) { if (x.kind !== 'combat' && x.kind !== 'elite' && x.kind !== 'boss') continue; (byF[x.f] || (byF[x.f] = [])).push(x); }
  console.log(`\n════ 성장 곡선 대조 (진짜 봇 ${MIN}분 · 표본 ${R.length}방) ════`);
  console.log('\n층  Lv  공격력  특성  유물  HP │ 방당 적HP  적수 │ 치우는 시간(초)  전층 대비');
  let prev = null;
  const rows = [];
  for (const f of Object.keys(byF).sort((a, c) => a - c)) {
    const g = byF[f];
    const avg = (k) => g.reduce((a, c) => a + c[k], 0) / g.length;
    const atk = avg('atk'), ehp = avg('ehp');
    const sec = ehp / Math.max(0.5, atk) * 0.42;      // 쉬지 않고 때리는 최선의 경우
    const trend = prev == null ? '' : (sec > prev * 1.08 ? '  ↑ 어려워짐'
      : sec < prev * 0.92 ? '  ↓ 쉬워짐  ← 곡선이 뒤집혔다' : '  = 그대로');
    rows.push({ f: +f, atk, ehp, sec });
    console.log(String(f).padStart(2) + String(Math.round(avg('lv'))).padStart(4)
      + atk.toFixed(2).padStart(8) + String(Math.round(avg('tr'))).padStart(6)
      + String(Math.round(avg('rel'))).padStart(6) + String(Math.round(avg('mhp'))).padStart(5)
      + ' │' + String(Math.round(ehp)).padStart(9) + String(Math.round(avg('n'))).padStart(6)
      + ' │' + sec.toFixed(1).padStart(13) + trend);
    prev = sec;
  }
  if (rows.length >= 3) {
    const a = rows[0], z = rows[rows.length - 1];
    const gAtk = z.atk / Math.max(0.01, a.atk), gEhp = z.ehp / Math.max(1, a.ehp);
    console.log(`\n■ ${a.f}층 → ${z.f}층`);
    console.log(`   화력   ×${gAtk.toFixed(1)}   (공${a.atk.toFixed(1)} → 공${z.atk.toFixed(1)})`);
    console.log(`   콘텐츠 ×${gEhp.toFixed(1)}   (적HP ${Math.round(a.ehp)} → ${Math.round(z.ehp)})`);
    console.log(`   → ${gAtk > gEhp * 1.15 ? '**화력이 더 빨리 자란다 — 층이 오를수록 쉬워진다**'
      : gEhp > gAtk * 1.15 ? '콘텐츠가 더 빨리 자란다 (어려워진다)' : '두 곡선이 나란하다'}`);
    console.log(`   방 치우는 시간 ${a.sec.toFixed(1)}초 → ${z.sec.toFixed(1)}초`);
  }
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
