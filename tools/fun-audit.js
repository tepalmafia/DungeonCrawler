// 재미 계측 (v205) — 사장: "평균 타수가 올바른 재밌는 게임을 위한 방법인가?"
//
// 답: 아니다. 타수는 **휘두른 횟수**지 판단의 수가 아니고, 평균은 분산을 숨긴다.
// 그리고 사장이 이 세션에서 하신 지적 어디에도 「몇 대에 죽는지」는 없었다 —
// 사연·손맛·회피·패턴·속성·캐릭터·폰이었다. 재던 축이 느끼는 축과 달랐다.
//
// 이 도구가 재는 것:
//   ① 피격 원인 분포   무예고 / 반응없음 / 늦음 / 장판  ← 난이도의 **질**
//   ② 타수 분산        평균이 아니라 편차 (전부 3타면 단조롭다)
//   ③ 판단 밀도        방당 대시·스킬 사용 횟수
//   ④ 위험 노출 비율   적 사거리 안에서 보낸 시간
//   node tools/fun-audit.js [분]
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137';
const MIN = parseFloat(process.argv[2] || '4');

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await p.goto(`${BASE}/?test=1&bot=1&botloop=1`);
  await p.waitForFunction(() => typeof Game !== 'undefined' && typeof Meta !== 'undefined');
  await p.evaluate(() => {
    localStorage.clear(); Meta.load(); Meta.data.introSeen = true;
    Meta.data.classes = { knight: true, archer: true, mage: true, alch: true }; Meta.save();
  });
  await p.reload();
  await p.waitForFunction(() => typeof Game !== 'undefined' && Game.state);
  await p.evaluate(() => {
    window.__fun = { kills: [], dashes: 0, skills: 0, rooms: 0, nearT: 0, totalT: 0 };
    // 잡몹 1기당 실제 타수 — 평균이 아니라 **분포**를 모은다
    const _dmg = Game.damageEnemy.bind(Game);
    Game.damageEnemy = function (e, d, dir, o) {
      if (e && !e.isBoss) { e.__hits = (e.__hits || 0) + 1; }
      const r = _dmg(e, d, dir, o);
      if (e && e.dead && !e.isBoss && e.__hits && !e.__counted) { e.__counted = 1; window.__fun.kills.push(e.__hits); }
      return r;
    };
    const _b = Dungeon.build.bind(Dungeon);
    Dungeon.build = function (t) { window.__fun.rooms++; return _b(t); };
    // 판단 밀도 + 위험 노출 — 매 프레임 표본
    const tick = () => {
      const pl = Game.player;
      if (pl && Game.state === 'play') {
        window.__fun.totalT++;
        const near = Game.enemies.some((e) => !e.dead && Math.hypot(e.x - pl.x, e.y - pl.y) < 110);
        if (near) window.__fun.nearT++;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const _dash = Game.player ? null : null;
    Game._funHook = true;
  });
  // ★ 실제 **함수**를 후킹한다. 1차에 Input.take('KeyK') 를 셌더니 스킬 0회가 나왔는데,
  //   봇은 입력 계층을 거치지 않고 p.useSkill() 을 직접 부른다 — 계기가 엉뚱한 길을 보고 있었다.
  //   (v185·186·192·205에 이어 같은 실수를 또 했다: 소비자가 아니라 다른 경로를 쟀다)
  await p.evaluate(() => {
    const pl = Game.player;
    const proto = Object.getPrototypeOf(pl) === Object.prototype ? pl : Object.getPrototypeOf(pl);
    const wrap = (obj, name, key) => {
      if (!obj || typeof obj[name] !== 'function') return false;
      const _o = obj[name];
      obj[name] = function (...a) { window.__fun[key]++; return _o.apply(this, a); };
      return true;
    };
    window.__fun.hooked = {
      skill: wrap(pl, 'useSkill', 'skills'),
      // ★ 대시는 함수가 아니라 update() 안에 인라인으로 있다. 이름을 추측해 후킹하면
      //   조용히 실패한다(1차에 dash:false 로 0회가 나왔다). 대시가 **실제로 나가는 순간**
      //   호출되는 noteReact('dash') 를 잡는다 — 봇도 사람도 이 길을 지난다
      dash: (() => {
        const _n = Game.noteReact.bind(Game);
        Game.noteReact = function (kind) { if (kind === 'dash') window.__fun.dashes++; return _n(kind); };
        return true;
      })(),
      ult: wrap(pl, 'useUltimate', 'ults'),
    };
    window.__fun.ults = 0;
    // 스킬이 **왜** 안 나가는지도 본다 — 쿨다운 때문인가, 쓸 상황이 없는가
    window.__fun.cdSamples = [];
    const t2 = () => {
      if (Game.state === 'play' && Game.player) window.__fun.cdSamples.push(+Game.player.skillCd.toFixed(2));
      requestAnimationFrame(t2);
    };
    requestAnimationFrame(t2);
  });
  const end = Date.now() + MIN * 60000;
  while (Date.now() < end) await p.waitForTimeout(15000);
  const R = await p.evaluate(() => ({ ...window.__fun, why: Game._hurtWhy || {}, src: Game._hurtSrc || {}, hurts: Game._runHurts || 0 }));
  await b.close();

  const k = R.kills;
  const avg = k.length ? k.reduce((a, c) => a + c, 0) / k.length : 0;
  const sd = k.length ? Math.sqrt(k.reduce((a, c) => a + (c - avg) ** 2, 0) / k.length) : 0;
  const hist = {};
  for (const v of k) hist[Math.min(v, 8)] = (hist[Math.min(v, 8)] || 0) + 1;

  console.log('\n════ 재미 계측 (' + MIN + '분 봇 플레이) ════');
  console.log('\n■ ① 피격 원인 분포 — 난이도의 **질** (총 ' + R.hurts + '회)');
  const wk = Object.keys(R.why);
  if (!wk.length) console.log('   (기록 없음)');
  const wn = wk.reduce((a, c) => a + R.why[c], 0) || 1;
  for (const key of wk.sort((a, c) => R.why[c] - R.why[a])) {
    const pct = Math.round(R.why[key] / wn * 100);
    const note = { '무예고': '← 억울하다. 많으면 설계 결함', '반응없음': '← 못 봤거나 못 읽었다',
      '늦음': '← 배우는 중. 이게 많은 게 건강하다', '장판': '← 내 탓이 명확하다' }[key] || '';
    console.log('   ' + key.padEnd(7) + String(R.why[key]).padStart(4) + '회 ' + String(pct).padStart(3) + '%  ' + note);
  }
  const sk = Object.keys(R.src || {}).sort((a, c) => R.src[c] - R.src[a]);
  if (sk.length) {
    console.log('\n■ ①-B 원인별 출처 — **고칠 자리**를 짚는다');
    for (const key of sk.slice(0, 14)) console.log('   ' + String(R.src[key]).padStart(4) + '회  ' + key);
  }
  console.log('\n■ ② 잡몹 처치 타수 — 평균이 아니라 **분포** (' + k.length + '기)');
  console.log('   평균 ' + avg.toFixed(1) + '타 · 표준편차 ' + sd.toFixed(1)
    + (sd < 0.8 ? '  ← 전부 같은 타수. 단조롭다' : sd > 1.6 ? '  ← 리듬이 있다' : ''));
  console.log('   ' + Object.keys(hist).sort((a, c) => a - c)
    .map((h) => (h >= 8 ? '8+' : h) + '타 ' + '█'.repeat(Math.ceil(hist[h] / Math.max(1, k.length) * 30))).join('\n   '));
  const cd = R.cdSamples || [];
  const readyPct = cd.length ? Math.round(cd.filter((v) => v <= 0).length / cd.length * 100) : 0;
  console.log('\n■ ③ 판단 밀도 — 방당 대시 ' + (R.dashes / Math.max(1, R.rooms)).toFixed(1)
    + '회 · 스킬 ' + (R.skills / Math.max(1, R.rooms)).toFixed(1)
    + '회 · 궁 ' + ((R.ults || 0) / Math.max(1, R.rooms)).toFixed(1) + '회');
  console.log('   스킬 준비 완료 시간 비율 ' + readyPct + '%'
    + (readyPct > 60 && R.skills / Math.max(1, R.rooms) < 1 ? '  ← 쓸 수 있는데 안 쓴다. 쿨다운이 아니라 **쓸 이유**가 없다' : '')
    + '   (후킹: ' + JSON.stringify(R.hooked) + ')');
  console.log('■ ④ 위험 노출 — 적 사거리 안에서 보낸 시간 '
    + Math.round(R.nearT / Math.max(1, R.totalT) * 100) + '%');
  if (errs.length) console.log('\n⚠ 에러 ' + errs.length + ': ' + errs[0]);
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
