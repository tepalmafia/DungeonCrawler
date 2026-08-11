// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **쏜 것의 생김새** — 미사일은 미사일답게, 레이저는 레이저답게 (v113)
//
//    node tools/space-shot.js            (serve.py 8391 을 먼저 띄운다)
//
//  ★ 사장님 「**미사일이 모양이 이상하게 나간다** 체크해봐.
//    **미사일은 미사일답게 레이저는 레이저답게** 나가도록 해줘」
//
//  ══ ★★★ 왜 이 검사가 없었나 ═════════════════════════════════════════
//
//  「모양」은 **아무도 안 재던 것**이다. 자리는 `space-align.js` 가, 규칙은
//  `space-combat.js` 가 재는데 **코가 어느 쪽을 보나**는 눈밖에 없었다.
//  그래서 v84 부터 v112 까지 **불이 미사일 앞에 붙은 채로** 갔고, 사장님이
//  화면을 보시고 잡으셨다 — 네 번째다 (v91·v93·v95·v98 과 같은 종류).
//
//  ★★ 그런데 이건 **눈 없이 잴 수 있다.** `lookAt` 이 어느 축을 앞으로
//    돌려세우는지는 벡터 하나로 나온다. 그리고 **짐작하면 틀린다** —
//    이 판을 만들며 「몸통이 거꾸로겠지」 하고 짐작했다가 재 보니 몸통은
//    멀쩡했다. 짐작대로 뒤집었으면 **멀쩡한 것을 망칠 뻔했다.**
//
//  ★ 진짜 배의 **진짜 메시**를 읽는다 (`SPACE.shotShape`) — 베껴 만들면
//    그때부터 검사와 화면이 갈라진다 (v98 의 교훈).
// ══════════════════════════════════════════════════════════════════════════
// ★ 이 저장소의 브라우저 검사 규약 그대로 — 둘 중 되는 것을 쓴다
let chromium = null;
for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
  try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ }
}
if (!chromium) { console.log('playwright 가 없습니다'); process.exit(0); }

const PORT = process.env.PORT ?? '8391';
const URL = `http://127.0.0.1:${PORT}/space/`;
let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

const b = await chromium.launch({ args: ['--use-gl=swiftshader'] });
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
try {
  await p.goto(URL, { waitUntil: 'load', timeout: 20000 });
} catch {
  console.log('✘ 서버가 안 떠 있습니다 — `python3 tools/serve.py 8391` 을 먼저 띄우십시오');
  await b.close(); process.exit(1);
}
await p.waitForFunction(() => window.SPACE?.shotShape, null, { timeout: 30000 });
await p.click('#btn-play');
await p.waitForTimeout(600);
const shape = (k, sec) => p.evaluate(([kk, ss]) => SPACE.shotShape(kk, ss), [k, sec]);

console.log('쏜 것의 생김새 — **진짜 배의 진짜 메시**를 읽는다');

console.log('\n[1] ★★★ **미사일이 앞을 보나** — 몸통 · 꼬리날개');
{
  const s = await shape('ir', 0.5);
  console.log(`   가야 하는 쪽 ${s.go.join(', ')} · 조각 ${s.parts.length}`
    + ` · 몸통이 기수에서 ${s.flown}m 갔다 (**여기가 기준**)`);
  for (const x of s.parts) {
    console.log(`   ${x.geo.padEnd(15)} 축·앞 ${String(x.axis).padStart(6)}`
      + ` · 자리 ${x.ahead > 0 ? '앞' : '뒤'} ${Math.abs(x.ahead).toFixed(2)}m`
      + ` · ${x.on ? '보임' : '숨음'}`);
  }
  const body = s.parts.find((x) => x.geo === 'CapsuleGeometry');
  ok(!!body && body.axis > 0.95,
    `★★★ **코가 표적을 본다** (${body?.axis}) — \`lookAt\` 은 −Z 를 앞으로`
    + ' 돌려세우므로 캡슐 축(+Y)을 `rotation.x = +π/2` 로 로컬 +Z 에 놓아야 맞는다');
  const fins = s.parts.filter((x) => x.geo === 'BoxGeometry');
  ok(fins.length === 4,
    `★★ **꼬리날개가 ${fins.length} 장** — 미사일로 읽히는 것은 사실 이것이다.`
    + ' 매끈한 원통 하나는 어느 쪽이 앞인지 알 수가 없다');
  ok(fins.length > 0 && fins.every((f) => f.ahead < 0),
    '★★ 날개가 **뒤에** 붙었다 — 앞에 붙으면 그건 카나드지 꼬리날개가 아니다');
}

console.log('\n[2] ★★★ **불이 뒤에 붙었나** — 여기가 「이상한 모양」의 정체였다');
{
  const s = await shape('ir', 0.5);
  const cones = s.parts.filter((x) => x.geo === 'ConeGeometry');
  ok(cones.length === 2, `불과 배기 둘이 있다 (${cones.length})`);
  for (const c of cones) {
    const isTrail = c.h > 3;
    ok(c.ahead < 0,
      `★★★ **${isTrail ? '배기' : '화염'}가 뒤에 있다** (${c.ahead}m) — v84~v112 내내`
      + ' **앞에** 붙어 있었다 (`position.z = +1.1`). `lookAt` 뒤에는 +z 가'
      + ' 뒤가 아니라 **앞**이라, 화염이 미사일을 앞질러 갔다');
    ok(c.axis < 0,
      `★★ ${isTrail ? '배기' : '화염'}의 **뾰족한 끝이 뒤로** 뻗는다 (${c.axis}) —`
      + ' 노즐에서 굵게 나와 뒤로 가늘어지는 것이 로켓 화염의 모양이다');
  }
  ok(cones.every((c) => c.on), '★ 0.5초 뒤에는 **불이 켜져 있다**');
}

console.log('\n[3] ★★ **사출 중에는 불이 없나** — 관 안에서 켜면 제 배를 태운다');
{
  const s = await shape('arh', 0.02);
  const cones = s.parts.filter((x) => x.geo === 'ConeGeometry');
  ok(cones.length > 0 && cones.every((c) => !c.on),
    '★★ 쏜 지 0.02초에는 **불이 꺼져 있다** — 가스로 밀려 나가는 동안이다');
}

console.log('\n[4] ★★★ **레이저가 레이저인가** — 파이프가 아니라 빔인가');
{
  const s = await shape('laser', 0.02);
  const cyl = s.parts.filter((x) => x.geo === 'CylinderGeometry');
  ok(cyl.length === 2,
    `★★★ **속심과 겉무리 둘로** 그린다 (${cyl.length}) — 기둥 하나로는 「밝은 빛」이`
    + ' 안 난다. 불투명도를 올리면 파이프가 되고 내리면 안 보인다');
  const [core, halo] = cyl.sort((a, x) => a.r - x.r);
  console.log(`   속심 ${(core.rTop * 2).toFixed(2)}~${(core.r * 2).toFixed(2)}m`
    + ` · 겉무리 ${(halo.rTop * 2).toFixed(2)}~${(halo.r * 2).toFixed(2)}m`
    + ` · 길이 ${core.h.toFixed(0)}m · 각 ${core.seg}`);
  ok(halo.r > core.r * 2, '★★ 겉무리가 속심보다 **훨씬 넓다** — 그래야 번진다');
  ok(core.seg >= 12, `★★ 각이 ${core.seg} 이다 — 6각은 옆에서 보면 **각이 보인다**`);
  ok(core.r * 2 < 0.20,
    `★★★ 속심이 **${(core.r * 2).toFixed(2)}m** 다 — 전에는 0.70m 짜리 6각 기둥이`
    + ' 100m 를 가로질러 놓여 **각진 파이프**로 보였다');
  // ══ ★★★ v113 ② — **여기서 주장을 한 번 뒤집었다** ═══════════════════
  //  처음에 「총구가 굵고 끝이 가늘어야 한다」고 적고 그렇게 고쳤다.
  //  **뼈대 검사는 초록이었는데 화면은 아니었다** — 1인칭이라 총구 단면을
  //  정면으로 들여다보게 되어, 0.84m 짜리 단면이 2.5m 앞에 있으니
  //  **19도를 덮는 큰 다각형**이 됐다. 「뼈대만 재는 검사는 절반」이다.
  //  ★ 그래서 「굵기가 고른가」와 「눈에서 떨어져 시작하나」를 묻는다
  ok(Math.abs(core.rTop - core.r) < 0.01 && Math.abs(halo.rTop - halo.r) < 0.01,
    '★★★ **굵기가 고르다** — 빔은 원래 평행하다. 총구를 굵게 했더니'
    + ' 1인칭에서 **단면이 화면을 덮었다** (화면을 찍어 보고 잡았다)');
}

console.log('\n[5] ★ 셋이 **서로 다르게** 보이나 — 같으면 무기를 고른 뜻이 없다');
{
  const sig = {};
  // ★ 레이저는 0.12초에 사라진다 (`live`). 0.5초로 물으면 **이미 지워져서**
  //   그 전에 쏜 미사일이 잡힌다 — 처음에 그렇게 재서 「셋이 똑같다」가 나왔다
  for (const k of ['laser', 'ir', 'arh']) {
    const s = await shape(k, k === 'laser' ? 0.02 : 0.5);
    sig[k] = s.parts.map((x) => x.geo).join('+');
    console.log(`   ${k.padEnd(6)} ${sig[k]}`);
  }
  ok(sig.laser !== sig.ir,
    '★★★ **레이저와 미사일이 아예 다르게 생겼다** — 하나는 두 기둥,'
    + ' 하나는 몸통 + 날개넷 + 불 + 배기');
  ok(sig.ir === sig.arh,
    '★ 열추적탄과 유도탄은 **같은 몸**이다 — 다른 것은 색과 「휘나」이고,'
    + ' 그건 `space-combat.js` 가 잰다');
}

ok(errs.length === 0, `콘솔 오류 ${errs.length}${errs.length ? ` — ${errs[0]}` : ''}`);
await b.close();
console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다');
console.log(`
  ※ **「멋있나」는 여기서 안 나온다.** 여기서 나오는 것은
     「코가 앞을 보나 · 불이 뒤에 있나 · 빔이 파이프가 아닌가」뿐이다.
     정말 그렇게 보이나는 **화면을 찍어 봐야** 안다.`);
process.exit(bad ? 1 : 0);
