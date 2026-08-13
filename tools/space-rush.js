// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **속도감** — 얼마나 빠른지가 화면에 나오나 (v144 · 뼈대만)
//
//    node tools/space-rush.js
//
//  ★ 사장님 (2026-08-13) 「**추력이 켜진 상태인데 그냥 정지한 상태 같아.**
//    속도감을 느낄 수 있는 방법을 찾아줘」
//
//  ★★★ 묻는 것 일곱
//      ① **정지는 정말 멈춰 보이나** — 안 흐르나
//      ② ★★★ **순항과 전속이 다른가** — 사장님이 겪으신 그 자리다
//      ③ ★★★ **네 단이 다 다르고 · 오르기만 하나** — 하나라도 같으면 그 구간은 죽었다
//      ④ ★★ **눈에 보일 만큼 다른가** — 「값이 다르다」와 「보인다」는 다른 말이다
//      ⑤ ★★★ **급가속이 곡선의 끝인가** — 별개 스위치면 그 사이가 또 죽는다
//      ⑥ ★★ **가리지 않나** — v87 에 「주먹만 한 흰 공」이 쫓던 적을 덮었다
//      ⑦ ★ **화각을 조금만 흔드나** — 계기 배치가 화각에 물려 있다 (v139)
// ══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { STEPS, RUSHF, MAX, GRAINS, feelAt, speedOf, rushWord } from '../web/space/js/game/rush-table.js';
import { DUST } from '../web/space/js/game/sky-table.js';
import { FLY_VIEW } from '../web/space/js/game/helm-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

console.log('속도감 — 얼마나 빠른지가 화면에 나오나 (게임을 안 부른다)');

const F = Object.fromEntries(STEPS.map((s) => [s.key, feelAt(s.v)]));

console.log('\n[1] ★★ **정지는 정말 멈춰 보이나**');
{
  console.log('   단      빠르기   흐름   줄 길이   밝기   화각+');
  for (const s of STEPS) {
    const f = F[s.key];
    console.log(`   ${s.name.padEnd(4)}  ${String(s.v).padStart(5)}   ×${f.flow.toFixed(2)}   ${String(f.len).padStart(6)}m  ×${f.glow.toFixed(2)}  +${f.fov}°`);
  }
  ok(F.stop.len === 0,
    '★★★ **정지에서는 줄이 0 이다** — 안 그러면 멈춰도 흐르고, 그러면'
    + ' 속도계가 거짓말을 한다. 「멈췄다」를 화면이 못 말하면 「간다」도 못 말한다');
  ok(F.stop.flow === 1,
    '★★ 정지의 흐름 배수는 **1(그대로)** 이다 — 흐르는 거리는 속도가 정하므로'
    + ' 여기서 0 으로 만들 필요가 없다. 0 으로 두면 **두 곳에서 같은 것을 끄는** 꼴이다');
  ok(F.stop.fov === 0, '★ 정지에서 화각이 안 움직인다 — 기준이 흔들리면 나머지를 못 읽는다');
}

console.log('\n[2] ★★★ **순항과 전속이 다른가** — 사장님이 겪으신 그 자리다');
{
  const a = F.cruise; const b = F.full;
  const grow = (x, y) => (x > 0 ? y / x : Infinity);
  console.log(`   순항 → 전속 — 줄 ${a.len}m → ${b.len}m (×${grow(a.len, b.len).toFixed(2)})`
    + ` · 흐름 ×${a.flow} → ×${b.flow} · 화각 +${a.fov}° → +${b.fov}°`);
  ok(b.len >= a.len * 1.6,
    `★★★ **줄이 ${grow(a.len, b.len).toFixed(1)}배로 자란다** — v143 에 재 보니 8.09 → 8.92 로`
    + ' **1.1배**였다. 스로틀을 끝까지 올려도 화면이 그대로였고, 그것이'
    + ' 「추력이 켜졌는데 정지한 것 같다」의 정체다');
  ok(b.flow >= a.flow * 1.4,
    `★★ **흐름도 빨라진다** (×${a.flow} → ×${b.flow}) — 줄만 길어지면 같은 알갱이가`
    + ' 늘어난 것으로 보여서 「빨라졌다」가 아니라 「흐려졌다」로 읽힌다');
  ok(b.fov > a.fov,
    `★★★ **화각이 열린다** (+${a.fov}° → +${b.fov}°) — 눈이 제일 잘 읽는 속도 신호다.`
    + ' 레이싱 게임이 다 쓰는 것이고, 가장자리가 빨리 흘러가는 것이 곧 속도다');
}

console.log('\n[3] ★★★ **네 단이 다 다르고 · 오르기만 하나**');
{
  let mono = true; let same = 0;
  for (let i = 1; i < STEPS.length; i++) {
    const a = F[STEPS[i - 1].key]; const b = F[STEPS[i].key];
    for (const k of ['flow', 'len', 'glow', 'fov']) {
      if (b[k] < a[k]) mono = false;
      if (b[k] === a[k]) same++;
    }
  }
  console.log(`   이웃한 단끼리 값이 같은 칸 ${same}/12 · 오르기만 하나 ${mono ? '예' : '아니오'}`);
  ok(mono,
    '★★★ **한 번도 안 내려간다** — 빠른데 신호가 줄면 그건 계기가 아니라 잡음이다');
  ok(same === 0,
    `★★★ **같은 칸이 ${same} 개다** — 하나라도 같으면 그 구간은 **죽은 구간**이고,`
    + ' 사람은 거기서 「올려도 아무 일 없네」를 배운다. 한 번 배우면 안 올린다');
}

console.log('\n[4] ★★ **눈에 보일 만큼 다른가**');
{
  //  ★ 「값이 다르다」와 「보인다」는 다른 말이다. 사람 눈은 **1.3배쯤**부터
  //    「달라졌다」로 읽는다 — 그 아래는 재야만 아는 차이다
  console.log('   단 사이     줄 배수   보이나');
  let all = true;
  for (let i = 1; i < STEPS.length; i++) {
    const a = F[STEPS[i - 1].key]; const b = F[STEPS[i].key];
    const r = a.len > 0 ? b.len / a.len : Infinity;
    const seen = r >= 1.3;
    if (!seen) all = false;
    console.log(`   ${STEPS[i - 1].name}→${STEPS[i].name}    ${r === Infinity ? '  ∞' : `×${r.toFixed(2)}`}     ${seen ? '보인다' : '★ 안 보인다'}`);
  }
  ok(all,
    '★★★ **이웃한 단이 다 1.3배 이상 벌어진다** — 사람 눈이 「달라졌다」로'
    + ' 읽는 문턱이다. 그 아래는 **재야만 아는 차이**이고, 재야만 아는 차이는'
    + ' 없는 것과 같다');
}

console.log('\n[5] ★★★ **급가속이 곡선의 끝인가**');
{
  //  ★ 0.9 · 1.0 · 1.1 을 재서 **1 을 넘는 자리에서 끊기지 않나**를 본다.
  //    끊기면 그건 곡선이 아니라 **스위치**이고, 스위치면 그 앞 구간이 또 죽는다
  const a = feelAt(0.9); const b = feelAt(1.0); const c = feelAt(1.1);
  const d1 = b.len - a.len; const d2 = c.len - b.len;
  console.log(`   0.9 → 1.0 → 1.1 · 줄 ${a.len} → ${b.len} → ${c.len} (기울기 ${d1.toFixed(2)} → ${d2.toFixed(2)})`);
  ok(d2 > 0 && d2 < d1 * 6,
    '★★★ **1 을 넘어도 이어진다** — 급가속이 딴 줄이면 그 순간 화면이 **툭**'
    + ' 튀고, 순항 구간은 여전히 죽은 채로 남는다. v143 까지가 정확히 그랬다:'
    + ' `RUSH` 는 급가속 전용 곱하기였고 순항에는 곡선이 없었다');
  ok(speedOf(1, 1) > speedOf(1, 0) && speedOf(0.5, 0) < speedOf(1, 0),
    '★★ **스로틀과 급가속이 빠르기 하나로 모인다** — 축을 둘로 두면 화면이'
    + ' 둘을 따로 읽어야 하고, 그러면 또 갈라진다 (이 배의 오랜 규약)');
  ok(rushWord(0) === '정지' && rushWord(0.38) === '순항' && rushWord(1) === '전속' && rushWord(1.7) === '급가속',
    '★ **글로도 말한다** — 화면 신호는 느낌이고, 느낌만으로는 「지금 전속인가」를'
    + ' 못 묻는다. 넷에 이름이 있어야 계기가 대답할 수 있다');
}

console.log('\n[6] ★★ **가리지 않나** — v87 의 「주먹만 한 흰 공」');
{
  //  ★★★ **몫은 짐작이 아니라 실측이다** — v143 에 진짜 카메라로 재 보니
  //    상자 안 130 알 중 화면에 드는 것이 급가속에서 60 알(0.46)이었다.
  //    ★ 처음에 이 자리에 「130 × 흐름배수 × 0.25」라고 적었다가 244 알이
  //      나와 빨개졌다 — **흐름 배수를 알갱이 수로 잘못 읽은 것**이다.
  //      검사가 그걸 잡았고, 그래서 표의 이름도 `dust` → `flow` 로 고쳤다
  const grains = Math.round(GRAINS.n * GRAINS.onScreen);
  console.log(`   상자 ${GRAINS.n} 알 → 화면 ≈ ${grains} 알 (상한 ${MAX.grains}) · 지금 표는 ${DUST.n} 알`);
  ok(grains <= MAX.grains,
    `★★★ **알갱이가 ${MAX.grains} 알을 안 넘는다** — v87 에 속도감을 주려고 키웠다가`
    + ' **쫓던 적이 알갱이 뒤로 사라졌다.** 속도감은 창밖을 보라고 만드는 것이지'
    + ' 가리라고 만드는 것이 아니다');
  ok(F.boost.len <= 30,
    `★★ **줄이 ${F.boost.len}m 를 안 넘는다** — 더 길면 화면을 가로질러 창이 아니라`
    + ' 커튼이 된다 (v87 에 이미 30 으로 정해 둔 값이다 — 그대로 쓴다)');
  ok(DUST.n === GRAINS.n,
    `★★★ **하늘 표도 ${GRAINS.n} 알을 쓴다** (지금 ${DUST.n}) — 여기서만 늘리면`
    + ' 화면은 그대로다. v143 에 화면 알갱이가 **34 알**이라 아무리 빨리 흘러도'
    + ' 성긴 점 몇 개였고, 그것이 「정지한 것 같다」의 나머지 절반이다');
  ok(F.boost.glow <= 1.8,
    `★★ 밝기도 ×${F.boost.glow} 까지다 — 밝기는 **한 곳에서만** 올린다.`
    + ' v87 에 두 군데서 올려 알갱이가 흰 공이 됐다');
}

console.log('\n[7] ★ **화각을 조금만 흔드나** — 계기 배치가 여기 물려 있다');
{
  const base = FLY_VIEW.fov;
  const cruise = base + F.cruise.fov; const full = base + F.full.fov; const boost = base + F.boost.fov;
  console.log(`   기본 ${base}° · 순항 ${cruise}° · 전속 ${full}° · 급가속 ${boost}°`);
  ok(F.full.fov <= 8,
    `★★★ **순항~전속은 +${F.full.fov}° 안에서 논다** — 화각이 크게 흔들리면`
    + ' `ui-table.js screenSide` 를 타고 **계기 크기가 같이 흔들린다.**'
    + ' v139 에 화각을 94 → 74 로 옮겼다가 「계기 셋이 전투 원뿔에 들어왔다」로'
    + ' 그 자리에서 잡혔다 — 늘 켜져 있는 구간은 조심해서 흔든다');
  ok(boost - base <= 20,
    `★ 급가속도 +${(boost - base).toFixed(0)}° 까지다 — 더 열면 어안이 되어`
    + ' **가운데가 오히려 느려 보인다** (넓힐수록 복판의 각속도가 준다)');
}

console.log('\n[8] ★★★ **게임이 이 표를 정말 쓰나**');
{
  const cock = read('../web/space/js/world/cockpit.js');
  ok(/rush-table\.js/.test(cock),
    '★★★ **조종석이 이 표에서 읽는다** — 안 읽으면 표는 표대로 초록이고'
    + ' 화면은 화면대로 그대로다. v73 이 `RUSH` 를 급가속에만 물려 놓고'
    + ' 순항을 잊은 것이 딱 이 모양이었다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
