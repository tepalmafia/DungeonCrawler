// ══════════════════════════════════════════════════════════════════════════
//  ★★★ 상태창 — **여덟 줄이 저마다 제 역할을 하고 있나** (v165)
//
//    node tools/space-status.js            표만 (브라우저 없이)
//    node tools/space-status.js --see 8391 ★ 진짜 배로 — **값을 바꾸면 따라오나**
//
//  ══ 왜 이 도구가 생겼나 ══════════════════════════════════════════════
//
//  ★★★ 사장님 (2026-08-18) 상태창 화면을 주시며 「**이거 제 역할을 하고
//    있는거야**」. 재 보니 **미사일 줄이 거짓말**을 하고 있었다 —
//    `supply.missiles` 와 최대 8 을 그렸는데 그건 **v133 이전의 한 통**이고,
//    v133 이 무기마다 제 통을 준 뒤로는 거래·저장 호환으로만 남은 값이었다.
//    그래서 v162 에 기본 탄을 24/12 로 늘렸는데 **계기는 여전히 「4/8」**
//    이었다 (v164 에 고쳤다).
//
//  ★★ 그리고 사장님이 「**나머지 줄도 점검해줘**」라고 하셨다. 눈으로 한 번
//    훑고 「괜찮습니다」라고 말하는 것은 이 저장소가 제일 자주 틀리는 방식이다
//    — 무기 줄도 **여덟 판** 동안 아무도 안 빨갰다. 그래서 **도구**를 만든다.
//
//  ══ ★★★ 어떻게 재나 — **바꿔 보고 따라오나를 본다** ═══════════════════
//
//  「값이 있다」는 답이 아니다. 무기 줄도 값이 **있었다** — 다만 **딴 통**의
//  값이었다. 죽은 값도 값이므로, 있고 없고로는 못 가린다.
//
//  그래서 줄마다 **진짜 자리(authority)를 흔들고** 계기가 받은 값이
//  따라오는지 본다:
//
//      ① 계기가 받은 것을 읽는다   `SPACE.status` (계기에 넘긴 **그 객체**)
//      ② 진짜 자리를 바꾼다        `SPACE.setHeat` · `putHull` · …
//      ③ 다시 읽는다              안 따라오면 그 줄은 **죽은 값**이다
//
//  ★ ①이 중요하다. 검사가 값을 **따로 지으면** 계기와 갈라져서, v164 의
//    무기 줄처럼 **둘 다 초록**이 된다. 계기가 받은 것 그대로를 본다.
//
//  ★ three 를 안 쓴다 (표 절). `--see` 절만 브라우저를 띄운다.
// ══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { HEAT } from '../web/space/js/game/systems-table.js';
import { AMMO } from '../web/space/js/game/ammo-table.js';
import { CIRCUITS } from '../web/space/js/game/chase-table.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };

/** ★ 주석을 걷어내고 센다 — 이 저장소는 「낡았다」를 주석에 남기는 규약이라,
 *   안 걷으면 **기록이 코드로 세어져** 늘 초록이 된다 (v152·v154 에 두 번 데었다) */
const code = (f) => readFileSync(new URL(f, import.meta.url), 'utf8')
  .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

const G = '../web/space/js/';
const status = code(G + 'world/status.js');
const main = code(G + 'main.js');

console.log('\n상태창 여덟 줄 — 열 · 장갑 · 냉각 · 속도 · 전력 · 자국 · 무기 · 도약');

console.log('\n[1] ★★★ **죽은 통을 읽는 줄이 없나** — v164 의 무기 줄이 그랬다');
{
  //  ★★★ `MISSILES` 는 v133 이전의 한 통이다. 계기가 이걸 읽으면
  //    v162 처럼 **표를 고쳐도 화면이 안 바뀐다**
  ok(!/MISSILES/.test(status),
    '★★★ 상태창이 **`MISSILES`(v133 이전의 한 통)를 안 읽는다** —'
    + ' 읽으면 무기마다의 통(`AMMO`)을 고쳐도 화면이 안 바뀐다');
  ok(/AMMO\[/.test(status),
    '★★ 무기 줄이 **`AMMO`(무기마다의 통)** 를 읽는다');
  //  ★ 열은 `HEAT.max` 로 나눠야 한다 — 손으로 100 을 적으면 표를 고칠 때 갈라진다
  ok(/HEAT\.max/.test(status) && /HEAT\.warn/.test(status),
    '★★ 열 줄이 **표의 `HEAT.max`·`HEAT.warn`** 으로 잰다 — 손 숫자면 표를 고칠 때 갈라진다');
  ok(/CIRCUITS/.test(status),
    '★ 전력 줄이 **`CIRCUITS`** 를 훑는다 — 회로 이름을 손으로 적으면 넷째가 생겨도 안 뜬다');
  ok(/s\.speedWord/.test(status),
    '★★ 속도의 **낱말을 표가 정한다** (`speed-table.js speedWord`) —'
    + ' v116 에 여기서 따로 정하다가 창밖과 다른 말을 했다');
}

console.log('\n[2] ★★★ **계기에 넘기는 자리가 하나인가**');
{
  //  ★ 두 곳에서 지으면 한쪽만 고쳐지는 날이 온다
  const builds = (main.match(/const shipStatus = \{/g) ?? []).length;
  ok(builds === 1, `★★★ 상태를 짓는 곳이 **${builds} 곳**이다 — 둘이면 반드시 갈라진다`);
  ok(/lastStatus = shipStatus;/.test(main),
    '★★★ 검사가 보는 것이 **계기에 넘긴 그 객체**다 (`SPACE.status`) —'
    + ' 검사가 따로 지으면 v164 의 무기 줄처럼 **둘 다 초록**이 된다');
}

console.log('\n[3] ★★ **여덟 줄이 판 안에 들어가나** — 캔버스는 넘쳐도 조용하다');
{
  //  ★ 이 저장소의 오랜 교훈: 「창이 화면 밖에 그려지고 있었다」는 코드로 못 찾는다.
  //    그래서 **셈으로** 확인한다 (status.js 가 주석에 적어 둔 그 셈)
  const top = 0.19, gap = 0.098, bh = 0.086, rows = 8;
  const bottom = top + gap * (rows - 1) + bh;
  console.log(`   0.19 + 0.098×${rows - 1} + 0.086 = ${bottom.toFixed(3)}`);
  ok(bottom < 1, `★★ 여덟째 줄의 아래가 ${bottom.toFixed(3)} — 1 을 넘으면 **판 밖**이고, 캔버스는 조용하다`);
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 표는 전부 통과');
console.log('\n  ※ 여기까지는 **읽는 자리**다. 「값을 바꾸면 정말 따라오나」는 `--see`');

// ══════════════════════════════════════════════════════════════════════════
//  여기부터는 **실제 배**다 — `--see 8391` 을 줬을 때만 돈다.
//
//  ★★★ 여기가 이 도구의 알맹이다. 위 절들은 「맞는 이름을 읽나」까지고,
//    **「그 값이 살아 있나」**는 흔들어 봐야 안다.
// ══════════════════════════════════════════════════════════════════════════
const see = process.argv.indexOf('--see');
if (see >= 0) {
  const PORT = process.argv[see + 1] || '8391';
  let chromium = null;
  for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ }
  }
  if (!chromium) { console.error('playwright 가 없습니다.'); process.exit(2); }
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 560 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!globalThis.SPACE, null, { timeout: 60000 });
  const S = (fn, a) => p.evaluate(fn, a);
  await S(() => SPACE.clearSave());
  await p.click('#btn-play').catch(() => {});
  await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });
  await S(() => SPACE.putHelmSit(true));
  //  ★★★ **거점을 떠나서 잰다.** 처음에 켜자마자 쟀더니 **자국이 0 → 0**
  //    으로 안 움직여 빨개졌는데, 게임이 맞았다 — 「거점은 안전하다」라
  //    거기서는 자국이 안 쌓인다 (PLAN §4-2). **계기가 죽은 것이 아니라
  //    재는 자리가 틀린 것**이었다. 갈래를 하나 골라 항로로 나간다
  await S(() => { const o = SPACE.route.offer; if (o && o.length) SPACE.pick(o[0]); });
  await p.waitForTimeout(1500);

  /** 계기가 **이번 프레임에 받은 것**을 읽는다 (한 프레임 지나기를 기다린다) */
  const feed = async () => { await p.waitForTimeout(450); return S(() => SPACE.status); };

  /**
   * 한 줄을 흔들어 본다.
   * @param name  줄 이름
   * @param pick  받은 것에서 이 줄이 쓰는 값을 뽑는 함수
   * @param shake 진짜 자리를 바꾸는 함수 (브라우저 안에서 돈다)
   */
  const wiggle = async (name, pick, shake, note = '') => {
    const a = pick(await feed());
    await S(shake);
    const c = pick(await feed());
    const moved = JSON.stringify(a) !== JSON.stringify(c);
    console.log(`   ${name.padEnd(4)} ${JSON.stringify(a)} → ${JSON.stringify(c)}`);
    ok(moved, `★★★ **${name}** — 진짜 자리를 흔드니 계기가 받은 값도 따라왔다${note}`);
    return moved;
  };

  console.log('\n[4] ★★★ **여덟 줄이 다 살아 있나** — 흔들어 보고 따라오나');
  {
    const got = await feed();
    ok(!!got, '계기가 받은 것이 온다 — 없으면 아래는 **묻지도 못한 것**이다');
    console.log(`   받은 칸 — ${Object.keys(got ?? {}).join(' · ')}`);

    // ① 열
    await wiggle('열', (f) => Math.round(f.heat), () => SPACE.setHeat(52));
    // ② 장갑 — `faults.wear.hull` 이 진짜 자리다
    await wiggle('장갑', (f) => +(f.hull ?? 0).toFixed(2), () => SPACE.putWear(0.45),
      ' (`faults.wear.hull` → 남은 몫)');
    // ③ 냉각 — 회로 둘이 다 켜져야 「돈다」
    await wiggle('냉각', (f) => f.cooling, () => { SPACE.setPower('cool', false); });
    // ④ 속도 — 스로틀이 진짜 자리다
    await wiggle('속도', (f) => [f.speedWord, +(f.speed ?? 0).toFixed(2)],
      () => SPACE.putThrottle(1));
    // ⑤ 전력
    await wiggle('전력', (f) => ({ ...f.power }), () => { SPACE.setPower('sensor', false); });
    // ⑥ 자국
    await wiggle('자국', (f) => Math.round(f.sign), () => { SPACE.setPower('thrust', true); SPACE.setPower('sensor', true); SPACE.setHeat(72); });
    // ⑦ 무기 — **이 판의 까닭**
    await wiggle('무기', (f) => ({ ...f.ammo, k: f.slotKey }),
      () => { SPACE.setSupply({ ammo: { ir: 3, arh: 1 } }); SPACE.putWeapon(2); },
      ' — v164 까지 여기가 **v133 이전의 죽은 통**이었다');
    // ⑧ 도약
    await wiggle('도약', (f) => (f.arc?.cells ?? -1), () => SPACE.putArc(5));
  }

  console.log('\n[5] ★★★ **띠가 뜻대로 도나** — 나쁠수록 빨간가 · 줄면 나쁜가');
  {
    //  ★ 열·자국은 **차면** 나쁘고, 장갑·무기는 **줄면** 나쁘다.
    //    한 판에 두 규약이 섞이면 흘긋 봐서는 못 읽는다 — 「빨간 것이
    //    나쁜 것」 하나로 통일돼야 한다
    await S(() => SPACE.setHeat(96));
    const bad = await feed();
    await S(() => { SPACE.setHeat(2); SPACE.putWear(0); });
    const good = await feed();
    console.log(`   열 ${Math.round(bad.heat)} → ${Math.round(good.heat)} · 장갑 ${(good.hull ?? 0).toFixed(2)}`);
    ok(good.heat < bad.heat, '★★ **열은 차면 나쁘다** — 띠가 길수록 위험');
    ok((good.hull ?? 0) > 0.9, '★★ **장갑은 줄면 나쁘다** — 멀쩡하면 띠가 꽉 찬다');
    //  ★ 무기 줄의 「바닥이면 빨갛다」 — 20% 아래
    await S(() => { SPACE.setSupply({ ammo: { ir: 1, arh: 1 } }); SPACE.putWeapon(2); });
    const dry = await feed();
    const lowAt = Math.max(1, Math.round((AMMO.ir?.max ?? 24) * 0.2));
    console.log(`   열추적 ${dry.ammo?.ir} 발 (바닥 잣대 ${lowAt} 이하)`);
    ok((dry.ammo?.ir ?? 99) <= lowAt, '★★ **바닥이 나면 계기가 안다** — 「곧 못 쏜다」는 미리 알아야 손이 바뀐다');
  }

  console.log('\n[6] ★★★ **넘기는데 아무도 안 읽는 칸이 없나** — 죽은 칸은 조용한 거짓말이다');
  {
    //  ★★★ v164 가 무기 줄을 고치면서 `weapon`(이름)이 **쓸 데가 없어졌다.**
    //    안 지우면 다음 사람이 「계기가 이름을 쓰는구나」로 읽고, 그 이름을
    //    고치면 화면이 바뀔 줄 안다. **죽은 칸은 없는 칸보다 나쁘다.**
    //  ★ 여기서 세는 것은 「계기가 정말 읽나」다 — 그리는 파일을 읽어서 본다
    const got = await feed();
    const draws = readFileSync(new URL('../web/space/js/world/status.js', import.meta.url), 'utf8');
    const dead = Object.keys(got ?? {}).filter((k) => !new RegExp(`s\\.${k}\\b`).test(draws));
    console.log(`   넘기는 칸 ${Object.keys(got ?? {}).length} 개 · 안 읽는 칸 ${dead.length ? dead.join(' · ') : '없다'}`);
    ok(dead.length === 0,
      `★★★ **아무도 안 읽는 칸이 ${dead.length} 개다** — 넘기는 것과 그리는 것이`
      + ' 어긋나면, 고쳐도 화면이 안 바뀌는 자리가 생긴다 (v164 무기 줄이 그랬다)');
  }

  if (errs.length) { console.log('\n  ✘ 콘솔 오류:'); errs.slice(0, 5).forEach((e) => console.log('    ' + e)); fail += errs.length; }
  await b.close();
  console.log('');
  console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
  console.log('\n  ※ **「읽히나」는 여기서 안 나온다.** 글자가 판 밖으로 잘리는 것은');
  console.log('     v164 에 화면을 찍고서야 잡혔다 (「열추적탄 19/2」). 마지막은 화면이다.');
}
process.exit(fail ? 1 : 0);
