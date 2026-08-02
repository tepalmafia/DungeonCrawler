// ══════════════════════════════════════════════════════════════════════════
//  층 지문 — 「고쳤는데 동작이 안 바뀌었는지」를 확인한다.
//
//    node tools/floor-parity.js > before.txt     (고치기 전)
//    ...고친다...
//    node tools/floor-parity.js > after.txt
//    diff before.txt after.txt                    ← 비어야 한다
//
//  ★ 왜 필요한가 (단계 A 실사고)
//    층별 표를 world/floors.js 로 옮기면서 보스층 방 개수를 `rnd.int(7,7)` 로
//    적었다. 기존 코드는 보스층에서 **난수를 안 뽑았다.** 한 번 더 뽑은 것만으로
//    그 뒤 모든 난수가 밀려 방 배치·적 스폰이 통째로 달라졌다.
//    「옮기기만 했다」고 믿고 넘어갔으면 3층이 조용히 다른 층이 됐을 것이다.
//
//    지문에 방 개수만 넣으면 이걸 못 잡는다(둘 다 7이므로). 바닥 칸 수·문·
//    함정·출구 좌표·적 구성·상점 가격까지 넣어야 난수가 밀린 것이 드러난다.
// ══════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137/3d';
(async () => {
  const b = await chromium.launch({ executablePath: CHROME,
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-sandbox'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));
  await p.goto(`${BASE}/index.html?seed=PARITY&autostart=1`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.G3 && window.G3.state === 'play', { timeout: 45000 });
  const out = await p.evaluate(async () => {
    const G = window.G3;
    const dgm = await import('./js/world/dungeon.js');
    const emm = await import('./js/game/enemies.js');
    const shm = await import('./js/game/shop.js');
    const rngm = await import('./js/core/rng.js');
    const lines = [];
    for (let f = 1; f <= 9; f++) {   // 9층까지 — 표를 아홉 칸으로 늘렸다
      // 던전 — 같은 시드로 생성해 방·문·함정 지문
      const dg = dgm.generate(f, 'PARITY-t0');
      let floorCells = 0, doors = 0;
      for (let i = 0; i < dg.cells.length; i++) {
        if (dg.cells[i] === 1) floorCells++;
        if (dg.cells[i] === 3) doors++;
      }
      lines.push(`f${f} theme=${dg.theme.key} rooms=${dg.rooms.length} floorCells=${floorCells}`
        + ` doors=${doors} traps=${dg.traps.length} boss=${!!dg.isBossFloor}`
        + ` exit=${dg.exit.gx},${dg.exit.gz}`);
      // 적 — 같은 시드로 스폰해 종족·속성·정예 지문
      const rnd = rngm.makeRng(`PARITY-spawn-${f}-0`);
      const G2 = { ...G, scene: G.scene, dungeon: dg };
      const list = emm.spawnFloor(G2, dg, rnd, f, 0);
      const kinds = {}, els = {};
      let elites = 0, hpSum = 0;
      for (const e of list) {
        kinds[e.def.key] = (kinds[e.def.key] || 0) + 1;
        els[e.element] = (els[e.element] || 0) + 1;
        if (e.elite) elites++;
        hpSum += e.maxHp;
        e.dispose();
      }
      lines.push(`f${f} enemies=${list.length} elites=${elites} hpSum=${hpSum}`
        + ` kinds=${JSON.stringify(kinds)} els=${JSON.stringify(els)}`);
      // 상점 — 같은 시드로 재고
      const stock = shm.rollStock(rngm.makeRng(`PARITY-shop-${f}-0`), f, 0, G.player);
      lines.push(`f${f} shop=${stock.map((s) => `${s.kind}:${s.price}:${s.item?.element ?? '-'}`).join(' ')}`);
    }
    return lines;
  });
  for (const l of out) console.log(l);
  if (errs.length) console.log('ERR ' + errs[0]);
  await b.close();
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
