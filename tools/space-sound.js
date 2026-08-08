// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **진공 — 밖은 조용한가 · 선체를 때린 것은 들리나** (v74)
//
//    python3 tools/serve.py 8391 &
//    node tools/space-sound.js [포트]
//
//  ★ 왜 이 검사를 냈나 (2026-08-08 · 사장님 「우주인 점을 감안한 전개인가?」)
//
//    재 보니 소리만 **아무도 정한 적이 없었습니다.** 밖에서 나는 소리가
//    표에 없어서 결과적으로는 조용했는데, 그건 「진공이라 안 난다」고
//    정해서가 아니라 **아직 안 만들었을 뿐**이었습니다. 안 정해 두면
//    다음 판에 누군가 폭발음을 넣고, 그러면 아무도 모르게 고증이 깨집니다.
//
//    ★★ 그리고 재면서 **진짜 구멍 하나**가 나왔습니다 —
//      v73 까지 「내가 쐈다」와 「내가 맞았다」가 **같은 소리**(`caught`)였습니다.
//      소리로 상황을 알라고 만든 계통에서 제일 나쁜 종류의 겹침입니다.
//
//  ★ 게임과 **똑같은 코드**를 잽니다
//    `SPACE.auditOne(이름)` 이 게임이 실제로 쓰는 `core/audio.js` 를
//    `OfflineAudioContext` 에 태워 파형을 뽑습니다. 검사용으로 따로 짜서
//    재면 「검사는 통과하는데 게임은 안 나는」 상태가 생깁니다.
//
//  ★ 「좋은 소리인가」는 여기서 안 나옵니다
//    잴 수 있는 것은 **났나 · 얼마나 크나 · 얼마나 오래 우나 · 서로
//    구별되나**뿐입니다. 듣기 좋은지는 직접 들어 봐야 압니다.
// ══════════════════════════════════════════════════════════════════════════
const PW = ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs'];
let chromium = null;
for (const m of PW) { try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ } }
if (!chromium) {
  console.error('playwright 가 없습니다.  npm i -g playwright  뒤에 다시 돌리세요.');
  process.exit(2);
}

const PORT = process.argv[2] || '8391';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);

let fail = 0;
const ok = (c, msg) => { console.log((c ? '  ✔ ' : '  ✘ ') + msg); if (!c) fail++; };
const S = (fn, a) => p.evaluate(fn, a);
const one = (name) => S((n) => SPACE.auditOne(n), name);

console.log('\n진공 — 밖은 조용하고, 선체를 때린 것만 들린다');

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[1] ★★★ **밖에서 나는 것은 이름조차 없나**');
{
  // ★ 표가 「이건 소리를 안 낸다」고 적어 둔 목록. 여기 있는 것에 소리를
  //   붙이면 이 절이 빨개진다 — 문서는 낡아도 조용하지만 검사는 운다
  const silent = await S(() => SPACE.silentList ?? null);
  ok(Array.isArray(silent) && silent.length >= 4,
    `표에 **안 들리는 것 ${silent?.length ?? 0}가지**가 적혀 있다 — ${(silent ?? []).join(' · ')}`);

  // ★★ 그리고 **정말로 그런 이름의 소리가 없어야** 한다. 표에만 적어 두고
  //   코드에 몰래 있으면 표가 거짓말을 하는 것이다
  const sneaky = ['boom', 'explode', 'explosion', 'enemyFire', 'enemyEngine', 'blast'];
  const found = [];
  for (const n of sneaky) {
    const warned = await S(async (nn) => {
      let saw = false;
      const w = console.warn; console.warn = (m) => { if (String(m).includes('모르는 소리')) saw = true; };
      try { await SPACE.auditOne(nn); } finally { console.warn = w; }
      return saw;
    }, n);
    if (!warned) found.push(n);
  }
  ok(found.length === 0,
    `밖에서 터지는 소리가 **하나도 없다** ${found.length ? `— 있다: ${found.join(', ')}` : ''}`);
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[2] ★★★ **선체를 때린 것은 들리나** — 진공에서도 고체는 소리를 나른다');
{
  const hit = await one('hullHit');
  ok(hit.peak > 0.01, `맞으면 **소리가 난다** (크기 ${hit.peak})`);
  // ★ 우는 부분이 이 소리의 정체다. 없으면 그냥 딸깍이고, 딸깍은 배 안에서
  //   뭘 눌렀을 때 나는 소리라 헷갈린다
  ok(hit.tail >= 0.8,
    `★★ 그리고 **배가 ${hit.tail}초 운다** — 금속을 타고 퍼지는 소리(구조전달음)다.`
    + ' 이게 없으면 그냥 딸깍이고, 딸깍은 배 안에서 뭘 눌렀을 때 나는 소리다');
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[3] ★★ **셋이 구별되나** — 스쳤다 · 맞았다 · 들이받혔다');
{
  const g = await one('hullGraze');
  const h = await one('hullHit');
  const r = await one('hullRam');
  ok(g.tail < h.tail && h.tail < r.tail,
    `큰 것일수록 **더 오래 운다** (스침 ${g.tail} < 맞음 ${h.tail} < 들이받힘 ${r.tail}초)`);
  ok(g.peak < r.peak,
    `그리고 **더 크다** (스침 ${g.peak} < 들이받힘 ${r.peak}) — 눈을 안 보고도 갈린다`);
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[4] ★★★ **「쐈다」와 「맞았다」가 다른 소리인가** (v73 까지 같았다)');
{
  const laser = await one('laser');
  const hit = await one('hullHit');
  ok(laser.peak > 0.005, `쏘면 소리가 난다 (크기 ${laser.peak}) — 무기는 **선체에 붙어 있다**`);
  // ★★ 여기가 이 절의 핵심이다. 같은 소리면 쏠 때마다 「맞았다」로 들리고,
  //   그러면 귀를 아예 안 쓰게 된다
  ok(laser.tail < hit.tail * 0.75,
    `★★★ 쏘는 소리가 **짧고 맞는 소리가 길다** (${laser.tail} vs ${hit.tail}초) —`
    + ' v73 까지 둘 다 `caught`(잡혔다)여서 **쏠 때마다 잡힌 소리**가 났다');
  const tube = await one('tube');
  ok(tube.peak > 0.005 && Math.abs(tube.tail - laser.tail) > 0.02,
    `레이저와 미사일도 다르다 (레이저 ${laser.tail} · 발사관 ${tube.tail}초)`);
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[5] ★ **게임이 실제로 그 소리를 부르나** — 표에만 있으면 없는 것이다');
{
  // ★ 이 저장소가 제일 자주 밟는 함정이다: 소리를 만들어 놓고 **아무도
  //   안 부른다.** 소리는 안 나도 화면에 아무 표시가 없어서 조용히 지나간다
  const called = await S(() => {
    const seen = [];
    const real = SPACE.audioSpy?.(true);
    return { hooked: !!real };
  });
  const names = await S(async () => {
    const seen = [];
    SPACE.audioSpy(seen);
    SPACE.hitMe();                    // 맞아 본다
    await new Promise((r) => setTimeout(r, 60));
    SPACE.audioSpy(null);
    return seen;
  });
  ok(names.includes('hullHit') || names.includes('hullRam'),
    `맞으면 게임이 **선체 소리를 부른다** (${names.join(', ') || '아무것도 안 불렀다'})`);
}

console.log('');
if (errs.length) { console.log('  ✘ 화면 오류:', errs[0]); fail++; }
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과 — 밖은 조용하고, 선체를 때린 것만 들린다');
console.log('');
console.log('  ※ **「좋은 소리인가」는 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「밖이 조용한가 · 맞으면 들리나 · 셋이 갈리나 · 쏘는 것과');
console.log('     맞는 것이 다른가」뿐이다. 나머지는 직접 들어 봐야 한다.');
await b.close();
process.exit(fail ? 1 : 0);
