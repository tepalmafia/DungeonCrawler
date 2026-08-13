// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **배가 떠는 모양** — 뼈대만 (v131)
//
//    node tools/space-shake.js
//
//  ★ 사장님 (2026-08-13) 「**조준경이 빠르게 떨리는데 자연스럽게 바꿔줘.
//    눈 아프다. 현실감있게 하기 위해서 넣은건가?**」
//
//  ★★★ 묻는 것 다섯
//      ① **눈 아픈 구간을 피했나** — 8~20Hz 작은 흔들림이 제일 아프다
//      ② ★★★ **조준경이 화면에서 몇 화소 튀나** — 재는 자가 유닛이 아니다
//      ③ **아주 죽지는 않았나** — 0 이면 배가 죽은 것이다
//      ④ **무늬가 안 생기나** — 겹이 정수배면 「규칙적으로 흔들린다」가 된다
//      ⑤ **제일 나쁠 때도 견딜 만한가** — 쫓기고 굶고 급가속일 때
// ══════════════════════════════════════════════════════════════════════════
import { LOOK, topHz, shakeAt, seenPx, shakeWord } from '../web/space/js/game/shake-table.js';
import { SHAKE } from '../web/space/js/game/audio-table.js';
import { FOOD } from '../web/space/js/game/supply-table.js';
import { HUD } from '../web/space/js/game/view-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

console.log('배가 떠는 모양 — 뼈대만 (게임을 안 부른다)');
console.log(`  ${shakeWord()}`);

console.log('\n[1] ★★★ **눈 아픈 구간을 피했나**');
{
  //  ★ 작은 진폭의 화면 흔들림이 제일 아픈 구간이 대략 8~20Hz 다 —
  //    눈이 따라갈 수도, 무시할 수도 없는 자리. v130 까지가 **11.3Hz** 로
  //    그 한복판이었다
  for (const p of LOOK.parts) console.log(`   ${String(p.hz).padStart(5)}Hz  ×${p.amp}  ${p.what}`);
  console.log(`   ${String(LOOK.swayHz).padStart(5)}Hz  좌우 기우뚱`);
  ok(topHz() <= LOOK.maxHz,
    `★★★ **제일 빠른 성분이 ${topHz()}Hz** (상한 ${LOOK.maxHz}) — v130 은 11.3Hz 였고`
    + ' 그건 진동이 아니라 **깜빡임**이다');
  ok(topHz() < 8,
    '★★★ **8Hz 아래다** — 배는 큰 물건이고 큰 물건은 천천히 움직인다.'
    + ' 「살아 있다」는 빠르기가 아니라 **느림**에서 온다');
}

console.log('\n[2] ★★★ **조준경이 화면에서 몇 화소 튀나** — 재는 자가 유닛이 아니다');
{
  //  ★★ 아픈 것은 미터가 아니라 **눈에 보이는 움직임**이다. 그리고 이 배의
  //    조준경은 **배에 붙어 있어서** 눈이 밀린 만큼 화면에서 그대로 밀린다
  const px = seenPx(1, HUD.dist);
  console.log(`   평온할 때 ${px} 화소 (760 세로 · v130 은 10.0 화소였다)`);
  ok(px <= LOOK.seePx,
    `★★★ **${px} 화소 ≤ ${LOOK.seePx}** — 「느껴지는데 뭔지 모르겠는」 정도가 맞다.`
    + ' 넘으면 눈이 그것을 좇기 시작하고, 그때부터 피로다');
  ok(px > 0.3, `★★ 그래도 0 은 아니다 (${px}) — 0 이면 배가 죽은 것이다`);
}

console.log('\n[3] ★★ **아주 죽지는 않았나** — 움직이기는 하나');
{
  const ys = [];
  for (let t = 0; t < 12; t += 0.1) ys.push(shakeAt(t).y);
  const span = Math.max(...ys) - Math.min(...ys);
  console.log(`   12초 동안 위아래로 ${(span * 1000).toFixed(2)}mm 를 오간다`);
  ok(span > 1e-4, '★★ **가만히 있지 않는다** — 배가 살아 있다');
  ok(Math.abs(shakeAt(0).y) < 1e-9, '★ 0초에서 0 이다 — 켜자마자 툭 튀지 않는다');
  const s = shakeAt(3.3, 1);
  ok(Math.abs(s.roll) > 0 && Math.abs(s.roll) < Math.abs(s.x),
    '★ 기울기는 좌우 흔들림에 **딸려 온다** — 따로 흔들면 두 곳이 된다');
}

console.log('\n[4] ★★★ **무늬가 안 생기나** — 겹이 정수배면 규칙이 보인다');
{
  const hz = LOOK.parts.map((p) => p.hz);
  let clean = true;
  for (let i = 0; i < hz.length; i++) {
    for (let j = i + 1; j < hz.length; j++) {
      const r = hz[j] / hz[i];
      const near = Math.abs(r - Math.round(r));
      if (near < 0.05) clean = false;
      console.log(`   ${hz[i]} : ${hz[j]} = ${r.toFixed(3)} ${near < 0.05 ? '★정수배' : ''}`);
    }
  }
  ok(clean,
    '★★★ **서로 정수배가 아니다** — 정수배면 몇 초마다 같은 모양이 돌아와'
    + ' 「규칙적으로 흔들린다」로 읽힌다. 어긋나야 「가만히 못 있는다」가 된다');
  ok(LOOK.parts.every((p, i) => i === 0 || p.amp < LOOK.parts[i - 1].amp),
    '★★ **빠를수록 작다** — 큰 물건은 크게 천천히, 잘게 빨리 움직인다');
}

console.log('\n[5] ★★★ **제일 나쁠 때도 견딜 만한가**');
{
  //  쫓기고(×2.6) 굶고(×1.9) — 이 배가 낼 수 있는 제일 큰 흔들림이다
  const worst = SHAKE.chase[1] * FOOD.shakeMult;
  const px = seenPx(worst, HUD.dist);
  console.log(`   쫓김 ×${SHAKE.chase[1]} · 굶주림 ×${FOOD.shakeMult} = ×${worst.toFixed(2)} → ${px} 화소`);
  ok(px <= LOOK.seePx * 5,
    `★★★ **제일 나쁠 때 ${px} 화소** — v130 은 같은 조건에서 49 화소였다.`
    + ' 벌은 화면이 흔들리는 것이지 **눈이 아픈 것**이 아니다');
  ok(seenPx(SHAKE.chase[1]) > seenPx(1),
    '★★ 그래도 **쫓기면 더 떤다** — 안 그러면 흔들림이 아무 말도 안 하게 된다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
