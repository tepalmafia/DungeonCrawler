// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **손 배치** — 뼈대만 (v110)
//
//    node tools/space-keys.js
//
//  ★ 사장님 「공격도 스페이스로 바꾸고. 추력을 올리는 것도 r을 누르면
//    추력이 켜지고 꾹 누르면 가속되는 걸로 해줘. **이렇게해도 전투나
//    이동에 문제가 없을지 검증**하고」
//
//  ★★★ 「문제가 없나」를 넷으로 갈라 묻는다
//      ① **톡과 꾹이 안 섞이나** — 톡이 급가속으로 새거나 그 반대
//      ② **한 손에 몰리지 않나** — 같이 눌러야 하는 것이 몇인가
//      ③ **한 키가 두 군데 안 나오나** — 겹치면 하나가 조용히 죽는다
//      ④ ★★ **꾹 눌렀다 떼면 추력이 남나** — 안 남으면 급가속이 헛일이다
// ══════════════════════════════════════════════════════════════════════════
import { KEYS, COMBOS, HAND_MAX, TAP, makeTap, tapStep, KEY_WORD } from '../web/space/js/game/keys-table.js';
import { BOOST } from '../web/space/js/game/boost-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

console.log('손 배치 — 뼈대만 (게임을 안 부른다)');

// ── 배 하나를 흉내낸다: 추력은 켜지고 꺼지고, 급가속은 밀린다 ──────────
function run(seq) {
  const st = makeTap();
  let thrust = false, rushT = 0, taps = 0, rushed = 0;
  const dt = 1 / 60;
  for (const [down, secs] of seq) {
    for (let t = 0; t < secs; t += dt) {
      const r = tapStep(st, down, dt);
      if (r.tap) { thrust = !thrust; taps++; }
      if (r.rush) {
        // ★ 꾹이면 **추력도 같이 켜진다** (사장님 「r을 누르면 추력이 켜지고」)
        if (!thrust) thrust = true;
        rushT += dt; rushed++;
      }
    }
  }
  return { thrust, rushT: +rushT.toFixed(2), taps, rushed };
}

console.log('\n[1] ★★★ **톡과 꾹이 안 섞이나**');
{
  // 사람이 「눌렀다 뗀다」를 하는 시간이 0.08~0.15초다
  for (const s of [0.06, 0.10, 0.15, 0.20]) {
    const r = run([[true, s], [false, 0.4]]);
    console.log(`   ${(s * 1000).toFixed(0).padStart(4)}ms 누르고 뗐다 → 톡 ${r.taps} · 밀린 시간 ${r.rushT}초`);
  }
  const quick = run([[true, 0.10], [false, 0.4]]);
  ok(quick.taps === 1 && quick.rushT === 0,
    `★★★ **0.10초는 톡이다** — 추력만 켜지고 안 밀린다. 사람이 「눌렀다 뗀다」를`
    + ' 하는 시간이 0.08~0.15초라 여기가 새면 켜려다 튀어나간다');
  const held = run([[true, 1.2], [false, 0.4]]);
  ok(held.taps === 0,
    '★★★ **꾹은 톡이 아니다** — 밀고 나서 손을 떼도 추력이 안 꺼진다.'
    + ' 꺼지면 급가속이 「밀었다가 도로 느려지는」 헛일이 된다');
  ok(held.rushT > 0.9,
    `★★ 1.2초 누르니 ${held.rushT}초 밀렸다 — 넘긴 뒤로는 누르는 내내 민다`);
  console.log(`   가르는 자리 ${TAP.hold * 1000}ms · 급가속 잔향 ${BOOST.fade}초`
    + ` — 가르는 시간이 잔향의 ${((TAP.hold / BOOST.fade) * 100).toFixed(0)}% 다`);
  ok(TAP.hold / BOOST.fade < 0.15,
    '★ 가르는 시간이 급가속 잔향에 견줘 **눈에 안 띌 만큼 짧다** — 늦다고 안 느낀다');
}

console.log('\n[2] ★★★ **꾹 눌렀다 떼면 추력이 남나** (사장님 「r을 누르면 추력이 켜지고」)');
{
  const a = run([[true, 1.0], [false, 0.5]]);
  ok(a.thrust === true,
    '★★★ 꺼져 있던 추력이 **꾹 한 번으로 켜지고 남는다** — 「켜고 밀기」가 한 동작이다');
  // 켜져 있을 때 톡 → 꺼진다
  const b = run([[true, 0.10], [false, 0.3], [true, 0.10], [false, 0.3]]);
  ok(b.taps === 2 && b.thrust === false, '★★ 톡 두 번이면 켰다 껐다 — 켜고 끄는 물건 그대로다');
  // 켜 놓고 꾹 → 여전히 켜져 있다
  const c = run([[true, 0.10], [false, 0.2], [true, 1.0], [false, 0.3]]);
  ok(c.thrust === true && c.rushT > 0.7,
    '★★★ **켜 놓고 밀어도 안 꺼진다** — 싸우는 중에 제일 흔한 손놀림이다');
}

console.log('\n[3] ★★ **한 손에 몰리지 않나** — 같이 눌러야 하는 수');
{
  for (const c of COMBOS) {
    const hands = { L: 0, R: 0 };
    for (const k of c.keys) hands[KEYS[k].hand]++;
    const fingers = c.keys.map((k) => `${KEYS[k].code}(${KEYS[k].finger})`).join(' + ');
    const over = hands.L > HAND_MAX || hands.R > HAND_MAX;
    console.log(`   ${over ? '✘' : '·'} ${c.often.padEnd(4)} ${c.what.padEnd(24)} 왼 ${hands.L} · 오 ${hands.R}   ${fingers}`);
    if (c.often !== '드물게') {
      ok(hands.L <= HAND_MAX && hands.R <= HAND_MAX,
        `★ 「${c.what}」 — 한 손에 ${Math.max(hands.L, hands.R)} 개 (한도 ${HAND_MAX})`);
    }
  }
  // ★★ 제일 빡빡한 것 — 그래도 손가락이 다른가
  const worst = COMBOS[COMBOS.length - 2];
  const fs = worst.keys.filter((k) => KEYS[k].hand === 'L').map((k) => KEYS[k].finger);
  ok(new Set(fs).size === fs.length,
    `★★★ 제일 빡빡한 「${worst.what}」에서도 **손가락이 다 다르다** (${fs.join(' · ')}) —`
    + ' 같은 손가락 둘이면 아예 못 누른다');
}

console.log('\n[4] ★ **한 키가 두 군데 안 나오나**');
{
  const seen = {};
  for (const [k, v] of Object.entries(KEYS)) (seen[v.code] ??= []).push(k);
  const dup = Object.entries(seen).filter(([, ks]) => ks.length > 1);
  for (const [code, ks] of dup) console.log(`   ${code} — ${ks.join(' · ')}`);
  // ★ `KeyR` 은 일부러 둘이다 (톡·꾹). 그것 말고는 없어야 한다
  ok(dup.length === 1 && dup[0][0] === 'KeyR',
    '★★ 겹치는 것은 **R 하나뿐**이고 그건 일부러다 (톡·꾹). 나머지가 겹치면'
    + ' 하나가 조용히 죽고, 조용히 죽은 것은 「고장」으로 읽힌다');
  ok(KEYS.fire.code === 'Space' && KEYS.thrust.code === 'KeyR',
    '★★★ 사장님 말씀 그대로 — **쏘기 Space · 추력 R**');
  ok(KEYS.press.code === 'Mouse1',
    '★★ 마우스 왼쪽은 **계기 누르기**만 남는다 — 쏘기가 Space 로 갔으므로'
    + ' v88 이 겪은 「앉으면 좌클릭이 늘 발사라 갈래 판을 못 누른다」가 아예 없어진다');
}

console.log('\n[5] ★ 사람이 읽는 줄');
{
  for (const [k, w] of Object.entries(KEY_WORD)) console.log(`   ${k.padEnd(7)} ${w}`);
  ok(Object.keys(KEY_WORD).length === 3, '바뀐 셋을 다 말한다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
console.log(`
  ※ **「손에 익나」는 여기서 안 나온다.** 여기서 나오는 것은
     「톡과 꾹이 안 섞이나 · 한 손에 안 몰리나 · 겹치지 않나」뿐이다.
     실제로 Space 가 브라우저 단추를 누르지 않나는 space-endtoend.js 가 본다.`);
process.exit(bad ? 1 : 0);
