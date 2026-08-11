// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **스로틀 — 전진과 역추진** — 뼈대만 시뮬한다 (v101)
//
//    node tools/space-throttle.js
//
//  ★ 사장님 「w, s 키는 상하좌우가 아닌 **전진 후진**으로」
//    「**추력은 다른 키로 만들고 역추진을 만들어**」
//
//  ★★★ 묻는 것 다섯
//      ① 축인가 — 켜기/끄기가 아니라 **얼마나**가 있나
//      ② 놓아도 **안 돌아오나** (v55 규약 · 이 배는 수동이다)
//      ③ ★ 역추진이 **공짜가 아닌가** — 추진제 · 열 · 안 나아감
//      ④ ★ **떼어 놓을 수 있나** — 다만 빠른 적은 못 뗀다
//      ⑤ ★★ 뒤로가 **전진보다 못한가** — 도망이 뒤로가 되면 선회를 만든 뜻이 없다
// ══════════════════════════════════════════════════════════════════════════
import { THROTTLE, isFwd, isBack, legMult, throttleWord } from '../web/space/js/game/throttle-table.js';
import {
  makeThrottle, stepThrottle, legOf, fuelMult, backHeat, awayOf, summary,
} from '../web/space/js/game/throttle.js';
import { LEG } from '../web/space/js/game/route-table.js';
import { FUEL } from '../web/space/js/game/fuel-table.js';
import { TARGET, KINDS } from '../web/space/js/game/target-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const head = (t) => console.log(`\n${t}`);
const DT = 1 / 30;
/** 스로틀을 끝까지 미는 데 걸리는 초 */
const hold = (t, s, o) => { for (let x = 0; x < s; x += DT) stepThrottle(t, DT, o); };

console.log('스로틀 — 뼈대만 (게임을 안 부른다)');
console.log(`   범위 ${THROTTLE.min} ~ ${THROTTLE.max} · ${THROTTLE.rate}/초`
  + ` · 역추진 추진제 ×${THROTTLE.backFuel} · 벌어짐 ${THROTTLE.backAway}m/초`);

head('[1] ★★ **축인가** — 켜기/끄기가 아니라 「얼마나」가 있나');
{
  const t = makeThrottle();
  hold(t, 0.4, { up: true });
  const half = t.v;
  ok(half > 0.2 && half < 0.6, `★ 0.4초 밀면 ${half.toFixed(2)} — **중간값이 있다** (두 자리뿐이면 고를 것이 없다)`);
  hold(t, 2, { up: true });
  ok(Math.abs(t.v - THROTTLE.max) < 1e-6, `★ 계속 밀면 전속 (${t.v.toFixed(2)}) · 「${throttleWord(t.v)}」`);
  hold(t, 3, { down: true });
  ok(Math.abs(t.v - THROTTLE.min) < 1e-6, `★★ 끝까지 당기면 **역추진** (${t.v.toFixed(2)}) · 「${throttleWord(t.v)}」`);
}

head('[2] ★ 놓아도 **안 돌아오나** — 이 배는 수동이다 (v55)');
{
  const t = makeThrottle();
  hold(t, 1, { up: true });
  const was = t.v;
  hold(t, 3, {});
  ok(Math.abs(t.v - was) < 1e-6,
    `★★ 놓아도 ${t.v.toFixed(2)} 그대로 — **되돌리는 것도 손이 한다** (v55 에 사장님이 고치라고 하신 자리)`);
  ok(THROTTLE.selfCenter === false, '★ 표에도 그렇게 적혀 있다');
}

head('[3] ★★★ 역추진이 **공짜가 아닌가**');
{
  const t = makeThrottle();
  hold(t, 3, { down: true });
  // ① 항로가 안 나아간다
  ok(legOf(t, LEG.coast) === 0,
    `① **항로가 안 나아간다** (배수 0 · 앞으로 갈 때는 ${legMult(1, LEG.coast).toFixed(2)})`);
  ok(legMult(0, LEG.coast) === LEG.coast,
    `★ 다만 **되돌리지는 않는다** — 뒤로 간 만큼 구간을 물리면 12구간이 24구간이 된다`);
  // ② 추진제
  // ══ ★★ **「더 먹는다」는 세기당이다** ═══════════════════════════
  //  ★ 처음엔 절대량으로 물었다가 빨개졌다: 최대 역추진(0.45)×1.8 = 0.81
  //    이라 **가득 전진(1.0)보다 적게 먹는다.** 당연하다 — 덜 세게 미니까.
  //    설계가 말하는 것은 **같은 세기를 낼 때 1.8배**이고, 그게 물어야 할
  //    것이다. 「더 먹는다」를 아무 데나 갖다 대면 검사가 거짓말을 한다
  const fwd = (() => { const a = makeThrottle(); hold(a, 3, { up: true }); return fuelMult(a); })();
  const perUnitBack = fuelMult(t) / Math.abs(t.v);
  const perUnitFwd = fwd / 1;
  ok(perUnitBack > perUnitFwd,
    `② **같은 세기면 ${(perUnitBack / perUnitFwd).toFixed(1)}배 먹는다** (뒤 ${perUnitBack.toFixed(2)} > 앞 ${perUnitFwd.toFixed(2)}) —`
    + ' 주 엔진이 뒤에 달렸으므로 보조 추력기로 민다');
  ok(fuelMult(t) < fwd,
    `★ 다만 **절대량은 전속 전진보다 적다** (${fuelMult(t).toFixed(2)} < ${fwd.toFixed(2)}) —`
    + ` 뒤는 ${Math.abs(THROTTLE.min)} 까지만 밀리니까. 이건 벌이 아니라 셈이 맞는 것이다`);
  const sec = FUEL.max / (FUEL.perSec * fuelMult(t));
  ok(sec < 3600,
    `★ 가득(${FUEL.max})으로 **${(sec / 60).toFixed(0)}분**밖에 못 뺀다 — 회차가 98분이므로 계속은 못 한다`);
  // ③ 열
  ok(backHeat(t, 1) > 0, `③ **열이 오른다** (초당 ${backHeat(t, 1).toFixed(1)}) — 보조 추력기도 엔진이다`);
  ok(backHeat(makeThrottle(), 1) === 0, '★ 앞으로 갈 때는 이 몫이 없다');
}

head('[4] ★★ **떼어 놓을 수 있나** — 다만 빠른 적은 못 뗀다');
{
  const t = makeThrottle();
  hold(t, 3, { down: true });
  const away = awayOf(t);
  console.log(`   뒤로 빼면 ${away.toFixed(1)}m/초로 벌어진다 (표적이 다가오는 것 ${TARGET.closing})`);
  const rows = Object.values(KINDS).filter((k) => k.closes).map((k) => ({
    name: k.name, closes: k.closes, net: away - k.closes,
  }));
  for (const r of rows) {
    console.log(`     ${r.name.padEnd(8)} 다가옴 ${String(r.closes).padStart(5)}m/초`
      + `  →  ${r.net >= 0 ? '벌어진다' : '**못 뗀다**'} (${r.net.toFixed(1)})`);
  }
  ok(rows.some((r) => r.net > 0), '★★ 느린 것은 **떼어 놓는다** — 뒤로 빼는 값이 생긴다');
  ok(rows.some((r) => r.net < 0),
    '★★★ 그런데 빠른 것은 **못 뗀다** — 그러면 돌아서 싸우거나 붙어야 한다.'
    + ' 「뒤로 빼면 늘 안전」이 되면 그건 조작이 아니라 무적이다');
}

head('[5] ★★ 뒤로가 **전진보다 못한가** — 도망이 뒤로가 되면 선회를 만든 뜻이 없다');
{
  ok(Math.abs(THROTTLE.min) < THROTTLE.max,
    `★★ 뒤(${Math.abs(THROTTLE.min)})가 앞(${THROTTLE.max})의 ${(Math.abs(THROTTLE.min) / THROTTLE.max * 100).toFixed(0)}% 다 —`
    + ' 뒤로 전속력이면 v73 의 360도 선회가 쓸모없어진다');
  const t = makeThrottle();
  hold(t, 3, { down: true, dry: true });
  ok(t.v >= 0, '★ 추진제가 바닥나면 **스로틀이 안 먹는다** — 없는 것으로는 못 민다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
