// ══════════════════════════════════════════════════════════════════════════
//  벤치 — 여러 시드로 봇을 돌려 실제 플레이에서 나온 수치를 모은다.
//
//    python3 tools/serve.py 8137 &   node tools/bench3d.js
//    node tools/bench3d.js --seeds 8 --sec 180 --ff 4
//    node tools/bench3d.js --save            (이번 결과를 기준선으로 저장)
//
//  결과: 표로 출력 + docs/audit3d/bench.json
//        이전 기준선이 있으면 **차이를 같이 찍는다** — 밸런스를 바꾼 뒤
//        무엇이 얼마나 움직였는지 눈이 아니라 수치로 본다.
//
//  왜 검증(verify3d.js)과 따로인가:
//    verify 는 「깨졌는가」를 본다. 합격/불합격이다.
//    bench 는 「얼마인가」를 본다. 정답이 없는 값을 재는 도구다.
//    둘을 섞으면 밸런스를 조금 만질 때마다 검사가 빨개져서 아무도 안 믿게 된다.
// ══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137/3d';
const OUT = path.join(__dirname, '..', 'docs', 'audit3d');
const FILE = path.join(OUT, 'bench.json');

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf('--' + k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const SEEDS = parseInt(arg('seeds', '6'), 10);
const SEC = parseInt(arg('sec', '150'), 10);       // 시드당 게임 내 목표 시간(초)
// ff 는 더 쓰지 않는다 — 아래 주석 참조. 스텝은 항상 1/60 이다.
const SAVE = argv.includes('--save');

// 시드는 고정한다. 매번 다른 시드로 재면 「바꾼 것 때문인지 던전이 달라서인지」
// 구분할 수 없다. 비교 가능성이 이 도구의 존재 이유다.
const SEED_LIST = ['BENCH01', 'BENCH02', 'BENCH03', 'BENCH04', 'BENCH05',
  'BENCH06', 'BENCH07', 'BENCH08'];

function merge(reports) {
  // 시드별 표본을 합쳐 다시 통계를 낸다. 시드마다 평균을 낸 뒤 평균 내면
  // 표본 수가 다른 시드가 같은 무게를 갖게 되어 왜곡된다.
  const acc = {
    elapsed: 0, kills: 0, deaths: 0, walkDist: 0, stuck: 0,
    combatRatio: [], knock: [], dealt: [], taken: [], logic: [],
    fuel: [], hpPct: [], pickups: [0, 0, 0, 0], floors: [],
    kind: {},
  };
  for (const r of reports) {
    if (!r) continue;
    acc.elapsed += r.elapsed;
    acc.kills += r.flow.kills;
    acc.deaths += r.flow.deaths;
    acc.walkDist += r.flow.walkDist;
    acc.stuck += r.flow.stuck;
    acc.combatRatio.push(r.flow.combatRatio);
    acc.floors.push(...r.flow.floors);
    for (const [k, v] of [['knock', r.combat.knockDist], ['dealt', r.combat.dmgDealt],
      ['taken', r.combat.dmgTaken], ['logic', r.perf.logicMs],
      ['fuel', r.resource.fuel], ['hpPct', r.resource.hpPct]])
      if (v) acc[k].push(v);
    for (let i = 0; i < 4; i++) acc.pickups[i] += r.resource.pickups[i];
    for (const [k, v] of Object.entries(r.perKind)) {
      const t = (acc.kind[k] ||= { ttk: [], hits: [], n: 0, aggro: 0 });
      if (v.ttk) { t.ttk.push(v.ttk); t.n += v.ttk.n; }
      if (v.hits) t.hits.push(v.hits);
      t.aggro += v.aggro;
    }
  }
  // 시드별 통계 묶음 → 표본 수로 가중한 중앙값 근사(중앙값의 평균) + p95 최댓값
  const roll = (list) => {
    if (!list.length) return null;
    let n = 0, med = 0, p95 = 0, mean = 0, max = 0;
    for (const s of list) {
      n += s.n;
      med += s.med * s.n;
      mean += s.mean * s.n;
      p95 = Math.max(p95, s.p95);
      max = Math.max(max, s.max);
    }
    return { n, med: +(med / n).toFixed(3), mean: +(mean / n).toFixed(3), p95, max };
  };
  const avg = (a) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3) : null);

  const kinds = {};
  for (const [k, v] of Object.entries(acc.kind))
    kinds[k] = { n: v.n, aggro: v.aggro, ttk: roll(v.ttk), hits: roll(v.hits) };

  const floorAvg = {};
  for (const f of acc.floors) {
    const t = (floorAvg[f.floor] ||= { sec: [], kills: [] });
    t.sec.push(f.sec); t.kills.push(f.kills);
  }
  for (const k of Object.keys(floorAvg))
    floorAvg[k] = { sec: avg(floorAvg[k].sec), kills: avg(floorAvg[k].kills) };

  return {
    seeds: reports.filter(Boolean).length,
    elapsed: +acc.elapsed.toFixed(1),
    kills: acc.kills,
    deaths: acc.deaths,
    killsPerMin: +((acc.kills / acc.elapsed) * 60).toFixed(2),
    combatRatio: avg(acc.combatRatio),
    walkPerKill: acc.kills ? +(acc.walkDist / acc.kills).toFixed(1) : null,
    stuck: acc.stuck,
    knockDist: roll(acc.knock),
    dmgDealt: roll(acc.dealt),
    dmgTaken: roll(acc.taken),
    logicMs: roll(acc.logic),
    fuel: roll(acc.fuel),
    hpPct: roll(acc.hpPct),
    pickups: acc.pickups,
    floors: floorAvg,
    perKind: kinds,
  };
}

// ── 출력 ───────────────────────────────────────────────
const C = { dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m', off: '\x1b[0m' };
function delta(now, was, { lowerBetter = false, pct = 6 } = {}) {
  if (was == null || now == null || was === 0) return '';
  const d = ((now - was) / Math.abs(was)) * 100;
  if (Math.abs(d) < pct) return `${C.dim}(${d >= 0 ? '+' : ''}${d.toFixed(0)}%)${C.off}`;
  const good = lowerBetter ? d < 0 : d > 0;
  return `${good ? C.grn : C.yel}(${d >= 0 ? '+' : ''}${d.toFixed(0)}%)${C.off}`;
}

function row(label, val, prev, opt) {
  const v = val == null ? '—' : String(val);
  console.log(`  ${label.padEnd(26)}${v.padStart(9)}  ${delta(val, prev, opt)}`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const prev = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : null;

  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });

  const reports = [];
  const seeds = SEED_LIST.slice(0, SEEDS);
  for (const seed of seeds) {
    const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
    await page.goto(`${BASE}/?seed=${seed}&bot=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.G3 && window.G3.state === 'play', { timeout: 30000 });

    // 렌더링을 기다리지 않는다. 고정 1/60 로 시뮬레이션만 돌린다 —
    // 배속을 올려 한 스텝을 크게 밟으면 충돌·경로가 실제와 달라지고,
    // 그렇게 잰 수치는 이 게임의 수치가 아니게 된다.
    // 한 번에 다 돌리면 브라우저가 응답을 멈추므로 조각내서 밟는다.
    const CHUNK = 10;
    for (let done = 0; done < SEC; done += CHUNK) {
      await page.evaluate((sec) => window.G3.headlessRun(sec), Math.min(CHUNK, SEC - done));
      const alive = await page.evaluate(() => window.G3.state === 'play');
      if (!alive) break;
    }

    const r = await page.evaluate(() => {
      window.G3.metrics.floorEnd();
      return window.G3.metrics.report();
    });
    r.errors = errs.length;
    reports.push(r);
    console.log(`  ${seed}  처치 ${String(r.flow.kills).padStart(3)} · `
      + `사망 ${r.flow.deaths} · 전투비 ${(r.flow.combatRatio * 100).toFixed(0)}%`
      + (errs.length ? `  ${C.red}오류 ${errs.length}${C.off}` : ''));
    await page.close();
  }
  await browser.close();

  const m = merge(reports);
  m.stamp = { seeds: seeds.length, sec: SEC, step: '1/60' };

  const p = prev || {};
  console.log(`\n══ 흐름 ${C.dim}(시드 ${m.seeds}개 · 시드당 게임내 ${SEC}초)${C.off}`);
  row('분당 처치', m.killsPerMin, p.killsPerMin);
  row('전투 시간 비율', m.combatRatio, p.combatRatio);
  row('처치당 이동 거리', m.walkPerKill, p.walkPerKill, { lowerBetter: true });
  row('총 사망', m.deaths, p.deaths, { lowerBetter: true });
  row('끼임 탈출 발동', m.stuck, p.stuck, { lowerBetter: true });

  console.log('\n══ 전투');
  row('넉백 거리 중앙값', m.knockDist?.med, p.knockDist?.med);
  row('넉백 거리 p95', m.knockDist?.p95, p.knockDist?.p95);
  row('1타 피해 중앙값', m.dmgDealt?.med, p.dmgDealt?.med);
  row('받은 피해 중앙값', m.dmgTaken?.med, p.dmgTaken?.med, { lowerBetter: true });

  console.log('\n══ 종족별 처치 시간(초) / 타수');
  for (const [k, v] of Object.entries(m.perKind)) {
    const pv = p.perKind?.[k];
    const t = v.ttk ? `${v.ttk.med.toFixed(1)}s` : '—';
    const h = v.hits ? `${v.hits.med.toFixed(1)}타` : '—';
    console.log(`  ${k.padEnd(12)}${String(v.n).padStart(4)}마리  ${t.padStart(7)} ${delta(v.ttk?.med, pv?.ttk?.med)}  ${h.padStart(7)}`);
  }

  console.log('\n══ 자원 / 성능');
  row('랜턴 연료 중앙값', m.fuel?.med, p.fuel?.med);
  row('체력 비율 중앙값', m.hpPct?.med, p.hpPct?.med);
  row('시뮬레이션 ms 중앙값', m.logicMs?.med, p.logicMs?.med, { lowerBetter: true });
  row('시뮬레이션 ms p95', m.logicMs?.p95, p.logicMs?.p95, { lowerBetter: true });
  console.log(`  ${'획득 (일반/고급/희귀/전설)'.padEnd(26)}${m.pickups.join(' / ').padStart(9)}`);

  console.log('\n══ 층별 평균');
  for (const [f, v] of Object.entries(m.floors))
    console.log(`  ${f}층  ${String(v.sec).padStart(6)}초  처치 ${v.kills}`);

  const totalErrs = reports.reduce((a, r) => a + (r.errors || 0), 0);
  if (totalErrs) console.log(`\n${C.red}페이지 오류 ${totalErrs}건${C.off}`);

  if (SAVE) {
    fs.writeFileSync(FILE, JSON.stringify(m, null, 1));
    console.log(`\n기준선 저장 → docs/audit3d/bench.json`);
  } else {
    fs.writeFileSync(FILE.replace('.json', '-last.json'), JSON.stringify(m, null, 1));
    console.log(`\n${C.dim}기준선으로 삼으려면 --save. 이번 결과는 bench-last.json 에 있다.${C.off}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
