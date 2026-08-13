// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **거리감** — 100m 의 배가 몇 도로 보이나 — 뼈대만 (v138)
//
//    node tools/space-scale.js
//
//  ★ 사장님 (2026-08-13) 「지금 m 미터 단위로 나오는데 **거리감이
//    현실적인가? 100m면 상당히 가까운 거리인데 비행기가 너무 작게 보이는데?**
//    미터 단위를 재대로 측정하고 있는지 확인」
//
//  ★★★ **이 도구가 없어서 v79 부터 아무도 못 봤다.** 자리는 미터로 놓는데
//    크기는 딴 자로 그렸고, 「몇 도로 보이나」를 재는 자가 하나도 없었다.
//    v79 는 그 어긋남을 못 보고 **각지름에 바닥을 깔아 덮었다**(`SEEN`).
//
//  ★★★ 묻는 것 여섯
//      ① **자가 하나인가** — 그리는 길이가 표의 길이와 같나
//      ② ★★★ **100m 가 가깝게 보이나** — 사장님이 물으신 그것
//      ③ **멀면 작아지나** — 거리로 크기를 읽을 수 있나
//      ④ ★★ **화각이 한 번 더 줄이지 않나**
//      ⑤ **부풀림이 이제 거의 안 걸리나** — 참 크기가 크면 반창고가 필요 없다
//      ⑥ ★★ **가까울 때 화면을 다 덮지 않나** — 커진 만큼의 값을 치른다
// ══════════════════════════════════════════════════════════════════════════
import { KINDS, lenOf, SEEN } from '../web/space/js/game/target-table.js';
import { SLOTS } from '../web/space/js/core/model-table.js';
import { pointOf } from '../web/space/js/game/frame.js';
import { FLY_VIEW } from '../web/space/js/game/helm-table.js';
import { WEAPONS } from '../web/space/js/game/combat-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const DEG = Math.PI / 180;
/** 길이 L 짜리가 거리 d 에서 몇 도로 보이나 */
const degAt = (L, d) => 2 * Math.atan(L / 2 / Math.max(1, d)) / DEG;
/** 세로 화각 F 인 화면에서 몇 %를 차지하나 */
const share = (deg, F) => deg / F;

//  ★★★ v139 — **표에서 읽는다.** 여기 94 를 박아 뒀었는데, 그러면 화각을
//    고쳐도 **검사가 옛 값을 지키며 초록**이 된다 — 이 저장소의 단골이다
const FOV = FLY_VIEW.fov;

console.log('거리감 — 100m 의 배가 몇 도로 보이나 (게임을 안 부른다)');

console.log('\n[1] ★★★ **자가 하나인가**');
{
  console.log('   종류      표의 길이   그리는 길이');
  let same = true;
  for (const k of Object.keys(SLOTS)) {
    const tab = SLOTS[k].long, drawn = lenOf(k);
    console.log(`   ${k.padEnd(9)} ${String(tab).padEnd(11)} ${drawn}`);
    if (Math.abs(tab - drawn) > 1e-6) same = false;
  }
  ok(same,
    '★★★ **그리는 길이가 표의 길이와 같다** — v137 까지 `KINDS[].size * 1.6`'
    + ' 이라는 **딴 자**를 써서 raider 가 8.5m 가 아니라 1.84 로 그려졌다'
    + ' (4.6배 작다). 3D 그림이 오는 날 크기가 **5배 튀었을** 것이다');
  ok(Object.keys(KINDS).every((k) => lenOf(k) > 0),
    '★ 표에 없는 종류도 길이를 갖는다 — 0 이면 안 보인다');
}

console.log('\n[2] ★★★ **100m 가 가깝게 보이나** (사장님이 물으신 그것)');
{
  const r = degAt(lenOf('raider'), 100);
  console.log(`   raider(${lenOf('raider')}m) 가 100m 에서 **${r.toFixed(2)}°**`
    + `  · 화면의 ${(share(r, FOV) * 100).toFixed(1)}%`);
  ok(r > 3.5,
    `★★★ **100m 에서 ${r.toFixed(2)}° 다** — v137 까지 1.05° 였고, 그건 손을 뻗어`
    + ' 잡은 연필 굵기다. 100m 는 **코앞**이라 그렇게 보이면 안 된다');
  //  ★ 견줄 것 — 엄지손톱을 팔 끝에서 보면 약 1.5~2도다
  ok(r > 2,
    '★★ **팔 끝의 엄지손톱보다 크다** (약 1.5~2°) — 「저기 뭐가 있다」가 아니라'
    + ' 「저 배가 저기 있다」로 읽히는 문턱이다');
}

console.log('\n[3] ★★ **멀면 작아지나** — 거리를 크기로 읽을 수 있나');
{
  console.log('   거리     raider    gunship   convoy');
  const row = (d) => [lenOf('raider'), lenOf('gunship'), lenOf('convoy')]
    .map((L) => `${degAt(L, d).toFixed(2)}°`.padStart(8)).join('  ');
  for (const d of [40, 60, 100, 160, 240]) console.log(`   ${String(d).padStart(4)}m ${row(d)}`);
  const near = degAt(lenOf('raider'), 40), far = degAt(lenOf('raider'), 240);
  ok(near / far > 4,
    `★★★ **가까운 것이 먼 것보다 ${(near / far).toFixed(1)}배 크다** — 이 비가 작으면`
    + ' 크기로 거리를 못 읽고, 그러면 숫자만 보게 된다');
  ok(degAt(lenOf('convoy'), 240) > 1.5,
    '★★ **제일 큰 것은 제일 먼 데서도 형태가 남는다** — 레이더가 240m 를 보는데'
    + ' 눈이 못 보면 「레이더는 잡았다는데 창밖은 비어 있다」가 된다 (v79 의 그것)');
}

console.log('\n[4] ★★ **화각이 한 번 더 줄이지 않나**');
{
  const r = degAt(lenOf('raider'), 100);
  console.log(`   세로 화각 ${FOV}° 에서 ${r.toFixed(2)}° 는 화면의 ${(share(r, FOV) * 100).toFixed(1)}%`
    + `  · 70° 라면 ${(share(r, 70) * 100).toFixed(1)}%`);
  ok(FOV <= 100,
    `★ 화각이 ${FOV}° 다 — 넓은 화각은 「시야가 넓다」가 아니라 **「멀어 보인다」**다.`
    + ' 같은 배가 70° 화면에서 1.34배 커 보인다');
  //  ★★ 화각은 이 판에서 **안 만진다.** 시야(`space-view.js`)와 계기 자리
  //    (`space-screen.js`)가 다 이 값으로 맞춰져 있어서, 건드리면 그 둘을
  //    같이 다시 재야 한다. **한 판에 하나씩** 흔든다
  ok(true, '※ 화각은 이 판에서 **안 만진다** — 시야와 계기 자리가 이 값으로 맞춰져 있다');
}

console.log('\n[5] ★★ **부풀림이 이제 거의 안 걸리나**');
{
  //  ★ `SEEN` 은 v79 의 반창고다. 참 크기가 커졌으니 **웬만한 거리에서는
  //    안 걸려야** 한다 — 걸리면 그건 아직도 작다는 뜻이다
  const upAt = (kind, d) => {
    const deg = degAt(lenOf(kind), d);
    return Math.min(SEEN.maxUp, Math.max(1, SEEN.minDeg / Math.max(1e-3, deg)));
  };
  console.log(`   부풀림 — 100m raider ×${upAt('raider', 100).toFixed(2)}`
    + ` · 240m ×${upAt('raider', 240).toFixed(2)} · 240m convoy ×${upAt('convoy', 240).toFixed(2)}`);
  ok(upAt('raider', 100) < 1.05,
    '★★★ **100m 에서는 부풀리지 않는다** — 부풀려야 보인다면 그건 아직 작은 것이다.'
    + ' v79 의 반창고는 **먼 거리에만** 남는다');
}

console.log('\n[6] ★★ **가까울 때 화면을 다 덮지 않나** — 커진 값을 치른다');
{
  //  ★ **제일 가까워질 수 있는 거리**는 무기 사거리가 아니라 **선체**다.
  //    처음에 `laser.rMin`(0)을 썼다가 「화면의 180%」로 빨개졌는데,
  //    0m 는 **부딪힌 것**이지 붙은 것이 아니다 — 그 거리는 안 온다.
  //    선체 바닥이 21m 이므로 거기까지가 진짜 최소다
  const rMin = 21;
  const big = degAt(lenOf('convoy'), rMin);
  console.log(`   제일 큰 것(convoy)이 제일 가까운 사거리(${rMin}m)에서 ${big.toFixed(1)}°`
    + ` — 화면의 ${(share(big, FOV) * 100).toFixed(0)}%`);
  ok(share(big, FOV) < 0.75,
    `★★★ **화면을 다 덮지는 않는다** (${(share(big, FOV) * 100).toFixed(0)}%) — 100% 를`
    + ' 넘으면 붙는 순간 창밖이 그 배 하나가 되고, 그러면 조종이 안 된다');
  const r = degAt(lenOf('raider'), 60);
  ok(share(r, FOV) < 0.35,
    `★★ 흔한 적(raider)은 60m 에서도 화면의 ${(share(r, FOV) * 100).toFixed(0)}% 다 —`
    + ' 「크다」와 「덮는다」는 다르다');
}

console.log('\n[7] ★★★ **미터가 거짓말을 하나** (사장님 「보는것보다 m가 작게 표시된잔아」)');
{
  //  ══ ★★★ 사장님 말씀을 그대로 옮기면 두 가지다 ═══════════════════════
  //   ① 「계기가 말하는 m 가 3D 의 자리와 다르다」  → **자릿수가 틀렸다**
  //   ② 「그 m 에 있는 것치고 너무 작아 보인다」    → **렌즈가 틀렸다**
  //   둘은 고치는 데가 완전히 다르므로 **따로 묻는다.**
  //   ★ ① 은 `pointOf` 로 되짚으면 그 자리에서 나온다 (아래 첫 절)

  // ── ① 계기의 m 와 3D 의 자리가 같나 ───────────────────
  let same = true;
  console.log('   계기가 말하는 m   3D 에 놓인 자리');
  for (const d of [50, 100, 240]) {
    const p = pointOf({ az: 0, el: 0, dist: d });
    const r = Math.hypot(p.x, p.y, p.z);
    console.log(`   ${String(d).padStart(9)}m   ${r.toFixed(1)} 단위`);
    if (Math.abs(r - d) > 0.05) same = false;
  }
  ok(same,
    '★★★ **계기의 m 가 3D 의 자리와 같다** — 숫자는 거짓말을 안 한다.'
    + ' 100m 라고 적히면 정말 100 단위에 있고, 배는 표의 길이 그대로다');

  // ── ② ★★★ 그런데 **렌즈**가 멀어 보이게 한다 ──────────
  //   ★ 사람이 「저건 100m 쯤」이라고 느끼는 기준은 **눈에 익은 화각**이다.
  //     사람의 편안한 세로 시야는 대략 50~60도이고, 게임 화면은 그것보다
  //     넓게 잡으면 **같은 물건이 더 작게** 맺힌다.
  //   ★★ 그래서 **「몇 m 처럼 보이나」**를 낼 수 있다:
  //       보이는 거리 = 진짜 거리 × (지금 화각 ÷ 익숙한 화각)
  const NATURAL = 60;
  const looksAt = (d) => d * (FOV / NATURAL);
  console.log(`\n   화각 ${FOV}° · 사람이 익숙한 ${NATURAL}° 로 견주면`);
  console.log('   계기      그런데 눈에는');
  for (const d of [50, 100, 240]) {
    console.log(`   ${String(d).padStart(4)}m 인데   ${looksAt(d).toFixed(0)}m 처럼 보인다`);
  }
  const gap = FOV / NATURAL;
  ok(gap < 1.25,
    `★★★ **눈에는 ${gap.toFixed(2)}배 멀어 보인다** — 100m 가 ${looksAt(100).toFixed(0)}m 처럼`
    + ' 보인다는 뜻이다. 사장님이 「**보는것보다 m가 작게 표시된잔아**」라고'
    + ' 하신 것이 정확히 이 값이고, **숫자가 아니라 렌즈가 틀린 것**이다.'
    + ' 고칠 곳은 `helm-table.js FLY_VIEW.fov` 하나다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
