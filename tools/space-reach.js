// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **손 닿는 것이 정말 손에 닿나** — 자리 감사 (v76)
//
//    python3 tools/serve.py 8391 &
//    node tools/space-reach.js [포트]
//
//  ★ 사장님 「**미사일 뒤에 냉각벨브가 있어서 작동을 못해.** 전체적으로
//    다시 설계해」 — 재 보니 정말 그랬습니다. v71 에 탄두 크레이들을
//    기관실 후미 벽 한가운데 세웠는데 **거기 이미 밸브가 있었습니다**
//    (밸브 z 15.70 · 크레이들 z 15.60 · 둘 다 x 0 · 중심 거리 **0.10m**).
//    밸브는 냉각 계통의 유일한 손잡이인데 **v71 이래로 못 잡았습니다.**
//
//  ★★ **그런데 아무 검사도 안 울었습니다.** `space-endtoend [6e]①` 은
//    오히려 「크레이들이 손에 닿는다」로 **가린 쪽을 확인**하고 있었습니다.
//    가려진 쪽을 묻는 검사가 없었으니 조용했던 것이고, 자리를 코드에
//    흩어 놓으면 이런 일이 또 납니다.
//
//  ══ 그래서 이 검사가 묻는 것 ═══════════════════════════════════════════
//
//    ① **하나하나 정말 잡히나** — 방 안 여러 자리에서 겨눠 본다.
//       한 자리에서만 물으면 「그 자리에서만 되는 것」을 통과시킨다
//    ② **못 잡는 것이 있으면 누가 가리나** — 범인을 이름으로 부른다
//    ③ **서로 너무 가까운 짝이 있나** — 지금은 되더라도 다음 판에 터진다
//
//  ★ 「손맛이 좋은가」는 여기서 안 나온다. 나오는 것은 **닿나 안 닿나**뿐이다.
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
const p = await b.newPage({ viewport: { width: 640, height: 380 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1600);
const S = (fn, a) => p.evaluate(fn, a);

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };

await S(() => SPACE.clearSave());
await p.mouse.move(320, 190); await p.mouse.click(320, 190);
await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });
await p.waitForTimeout(900);

/**
 * ★ `handSpots` 의 이름과 **조준선이 부르는 이름**이 다른 것들이 있다
 *   (문 크랭크는 `crank:<문>`, 큰 차단기는 `mainbreaker`). 여기서 잇는다 —
 *   이름 둘을 코드 두 군데에 적으면 반드시 갈라지므로 **한 곳에** 적는다.
 */
const AIM_OF = (name) => {
  if (name.startsWith('crank')) return (a) => a?.startsWith('crank:');
  if (name.startsWith('breaker')) return (a) => a === 'thrust' || a === 'cool' || a === 'sensor';
  if (name === 'mainBreaker') return (a) => a === 'mainbreaker';
  if (name === 'outerDoor') return (a) => a === 'outer';
  if (name === 'suitRack') return (a) => a === 'suit';
  if (name === 'tradeHatch') return (a) => a === 'hatch';
  return (a) => a === name;
};

/**
 * 그 물건 앞에 설 만한 자리들 — 사방 여덟 방향.
 *
 * ★★ **부호를 한 번 틀렸다.** 이 배의 시선은 `yaw` 를 −Z 에서 재므로
 *   방향은 `(−sin yaw, −cos yaw)` 다. 처음에 `atan2(dx, −dz)` 라고 썼더니
 *   **좌우가 뒤집혀** 벽 반대쪽을 보고 「아무것도 안 잡힌다」가 나왔다 —
 *   게임이 아니라 **검사가 엉뚱한 데를 보고 있었다.**
 *   부호는 머리로 맞히는 것이 아니라 **한 번 찍어서 재는 것**이다 (v73).
 */
function around(s) {
  const out = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const d = 1.1;
    const x = s.x + Math.cos(a) * d;
    const z = s.z + Math.sin(a) * d;
    const dx = s.x - x; const dz = s.z - z;
    const yaw = Math.atan2(-dx, -dz);
    // 눈높이 1.62 기준으로 위아래 각. **아래를 보면 음수**다
    const pitch = Math.atan2(s.y - 1.62, d);
    out.push([x, z, yaw, pitch]);
  }
  return out;
}

console.log('\n손 닿는 것이 정말 손에 닿나 — 자리 감사');

const spots = await S(() => SPACE.handSpots);
console.log(`\n  손 닿는 것 ${spots.length}개를 하나씩 겨눠 본다`);

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[1] ★★★ **하나하나 정말 잡히나** — 못 잡으면 그건 없는 물건이다');
const blocked = [];
{
  // ★ 크랭크는 여섯이 다 같은 이름(`crank:*`)이라 하나만 봐도 된다.
  //   같은 것을 여섯 번 재면 시간만 여섯 배다
  const seen = new Set();
  const list = spots.filter((s) => {
    const k = s.name.replace(/\d+$/, '');
    if (k === 'crank' || k === 'breaker') { if (seen.has(k)) return false; seen.add(k); }
    return true;
  });
  for (const s of list) {
    const want = AIM_OF(s.name);
    // ══ ★★★ **상황을 먼저 만든다** (v76 · 이 검사가 처음에 틀린 자리) ══
    //
    //  무전기와 큰 차단기는 **늘 잡히는 물건이 아니다**:
    //      onRadio = canAnswer(rescue)    — 구조 신호가 올 때만
    //      onMain  = canResetDark(dark)   — 정전일 때만
    //  그게 **맞는 설계다.** 아무 때나 잡히면 「지금 할 일」이 흐려진다.
    //
    //  ★★ 그런데 검사가 그 상황을 안 만들고 물어서 「어디서도 안 잡힌다」로
    //    빨개졌다. **가려진 것이 아니라 없는 상황을 물은 것**이다 —
    //    v74 에 `setBake` 로 이미 한 번 밟은 함정이고 (검사가 만들 수 없는
    //    상황을 기다렸다), 이번 판만 두 번째다.
    //
    //  ★ 그래서 여기서 켠다. **켜고도 안 잡히면 그때가 진짜 가려진 것**이다
    if (s.name === 'radio') await S(() => SPACE.callRescue());
    if (s.name === 'mainBreaker') await S(() => SPACE.goDark());
    let got = null; let firstHit = null;
    for (const [x, z, yaw, pitch] of around(s)) {
      await S(([a, c, d, e]) => SPACE.put(a, c, d, e), [x, z, yaw, pitch]);
      await p.waitForTimeout(70);
      const aim = await S(() => SPACE.aim);
      if (aim && !firstHit) firstHit = aim;
      if (want(aim)) { got = aim; break; }
    }
    if (got) {
      console.log(`  ✔ ${s.name.padEnd(14)} 잡힌다 (${got})`);
    } else {
      fail++;
      blocked.push({ ...s, firstHit });
      console.log(`  ✘ ${s.name.padEnd(14)} **어디서도 안 잡힌다** — 대신 잡히는 것: ${firstHit ?? '아무것도'}`);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[2] ★★ **못 잡는 것이 있으면 누가 가리나** — 범인을 이름으로 부른다');
{
  if (!blocked.length) {
    ok(true, '가려진 것이 없다');
  } else {
    for (const bl of blocked) {
      // 제일 가까운 다른 물건이 대개 범인이다
      const near = spots
        .filter((s) => s.name !== bl.name)
        .map((s) => ({ s, d: Math.hypot(s.x - bl.x, s.y - bl.y, s.z - bl.z) }))
        .sort((a, c) => a.d - c.d)[0];
      console.log(`  ✘ **${bl.name}** 을(를) 가리는 것: ${near.s.name} (${near.d.toFixed(2)}m)`);
    }
    ok(false, `${blocked.length}개가 **손에 안 닿는다** — 손잡이가 안 닿으면 그 계통은 없는 것이다`);
  }
}

// ══════════════════════════════════════════════════════════════════════════
console.log('\n[3] ★ **서로 너무 가까운 짝** — 지금 되더라도 다음 판에 터진다');
{
  // ★ 겹친다고 다 못 잡는 것은 아니다 — 조종석은 좌석이 커서 겹쳐도
  //   각도로 갈린다. 그래서 이 절은 **빨갛게 안 만들고 적어만 둔다.**
  //   빨갛게 하면 멀쩡한 것을 옮기게 되고, 그건 감사가 아니라 참견이다
  let n = 0;
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      const a = spots[i]; const c = spots[j];
      const d = Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z);
      if (d < 0.35) { console.log(`   ⚠ ${a.name} ↔ ${c.name} — ${d.toFixed(2)}m 밖에 안 떨어졌다`); n++; }
    }
  }
  ok(n === 0, n ? `${n} 짝이 **35cm 안**에 붙어 있다 — 언젠가 하나가 하나를 가린다` : '35cm 안에 붙은 짝이 없다');
}

console.log('');
if (errs.length) { console.log('  ✘ 화면 오류:', errs[0]); fail++; }
console.log(fail ? `✘ ${fail} 군데 — **손이 못 가는 데가 있다**` : '✔ 전부 통과 — 손 닿는 것이 다 손에 닿는다');
console.log('');
console.log('  ※ **「손맛이 좋은가」는 여기서 안 나온다.** 나오는 것은');
console.log('     「닿나 안 닿나 · 누가 가리나」뿐이다.');
await b.close();
process.exit(fail ? 1 : 0);
