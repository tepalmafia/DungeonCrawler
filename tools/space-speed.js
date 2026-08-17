// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **가속도가 느껴지나** — 빨라지는 것과 빠른 것 (v116 · 뼈대만)
//
//    node tools/space-speed.js
//
//  ★ 사장님 (2026-08-11) 「**가속도가 안 느껴지고**, f로 붙으면 실제로
//    붙어야지. **멀리서 그냥 가져오는게 아니고**」
//
//  ══ ★★★ 이 두 마디는 **같은 뿌리**다 ═══════════════════════════════
//
//  창밖이 「지금 얼마나 가고 있나」를 안 말하고 있었다. 그래서
//    · 스로틀을 밀어도 **빨라진 것 같지 않고**
//    · 포획이 거리를 줄여도 **꾸러미가 날아오는** 것으로 보인다
//  둘 다 「배가 움직인다」가 화면에 없어서 나는 일이다.
//
//  ══ 이 검사가 묻는 것 ═══════════════════════════════════════════════
//
//   ① ★★★ **멈추면 정말 멈추나** — 스로틀 0 에서 창밖이 흐르면 거짓말이다
//   ② **전속이 멈춤과 확실히 다른가** — 몇 배인가
//   ③ ★★★ **별줄 눈금이 실제 범위에 맞나** — 663 짜리 자에 26 을 재고 있었다
//   ④ **역추진도 흐르나** — 뒤로 가는 것도 가는 것이다
//   ⑤ ★★★ **가속도가 따로 있나** — 「빠르다」와 「빨라진다」는 다른 신호다
//   ⑥ **가속 신호가 삭나** — 등속인데 계속 떠 있으면 그건 속도계다
//   ⑦ ★★★ **붙으러 갈 때도 흐르나** — 여기가 「멀리서 그냥 가져오는」의 답이다
//
//  ★ 게임을 안 부른다. 표(`speed-table.js`)만 읽는다
// ══════════════════════════════════════════════════════════════════════════
import {
  SPEED, mpsAt, streakAt, accOf, fadeAcc, feelOf, speedWord,
} from '../web/space/js/game/speed-table.js';
//  ★ v160 — 포획 속도를 **표에서 뽑는다** (14 를 박으면 축척을 안 따라온다)
import { CATCH } from '../web/space/js/game/catch-table.js';
import { streakLen, STREAK } from '../web/space/js/game/sky-table.js';
import { CRUISE } from '../web/space/js/game/systems-table.js';
import { LEG } from '../web/space/js/game/route-table.js';
import { BOOST } from '../web/space/js/game/boost-table.js';
import { WAYS } from '../web/space/js/game/cargo-table.js';
import { DOCK } from '../web/space/js/game/dock-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

console.log('가속도가 느껴지나 — 빨라지는 것과 빠른 것 (뼈대만)');

console.log('\n[0] 표가 말하는 것');
{
  console.log('   스로틀   창밖 속도(mps)   별줄(새)   별줄(옛 눈금)   한 마디');
  for (const leg of [0, 0.25, 0.5, 0.75, 1]) {
    const m = mpsAt({ leg });
    console.log(`   ${leg.toFixed(2).padStart(5)} ${m.toFixed(1).padStart(13)}`
      + ` ${streakAt(m).toFixed(2).padStart(10)} ${streakLen(m).toFixed(2).padStart(13)}`
      + `   ${speedWord(m)}`);
  }
  const rush = mpsAt({ leg: 1, boost: BOOST.mult });
  console.log(`   급가속 ${rush.toFixed(1)} mps · 별줄 ${streakAt(rush).toFixed(2)}`
    + ` · 역추진 ${mpsAt({ back: true }).toFixed(1)} mps`);
}

console.log('\n[1] ★★★ **멈추면 정말 멈추나**');
{
  const idle = mpsAt({ leg: 0 });
  const wasIdle = CRUISE.speed * LEG.coast;      // v115 까지 쓰던 값
  console.log(`   스로틀 0 — 새 ${idle.toFixed(1)} mps · 옛 ${wasIdle.toFixed(1)} mps`);
  ok(idle < wasIdle * 0.4,
    `★★★ **멈추면 ${idle.toFixed(1)} mps** (옛 ${wasIdle.toFixed(1)}) — 옛 값은`
    + ' `LEG.coast`(0.45)를 창밖에도 썼는데, 그건 「추진을 꺼도 항로는 관성으로'
    + ' 나아간다」는 **항로의 값**이지 **눈의 값**이 아니다. 둘을 같이 쓰면'
    + ' 스로틀 0 과 전속의 차이가 반밖에 안 나고, 그러면 **밀어도 안 빨라진'
    + ' 것처럼** 보인다');
  ok(idle > 0,
    `★★ 그래도 **0 은 아니다** (${idle.toFixed(1)}) — 우주에서 관성은 진짜로 있고,`
    + ' 0 으로 두면 이번엔 **멎어 선 화면**이 된다 (v57 고증)');
}

console.log('\n[2] ★★ **전속이 멈춤과 확실히 다른가**');
{
  const idle = mpsAt({ leg: 0 }), full = mpsAt({ leg: 1 });
  const was = { idle: CRUISE.speed * LEG.coast, full: CRUISE.speed };
  console.log(`   속도 ${(full / idle).toFixed(1)}배 (옛 ${(was.full / was.idle).toFixed(1)}배)`
    + ` · 별줄 ${(streakAt(full) / Math.max(0.01, streakAt(idle))).toFixed(1)}배`
    + ` (옛 ${(streakLen(was.full) / Math.max(0.01, streakLen(was.idle))).toFixed(1)}배)`);
  ok(full / idle >= 6,
    `★★★ **전속이 멈춤의 ${(full / idle).toFixed(1)}배** (6배 이상) — 옛 값은`
    + ` ${(was.full / was.idle).toFixed(1)}배였다`);
  ok(streakAt(full) / Math.max(0.01, streakAt(idle)) >= 2.5,
    `★★★ **눈으로도 ${(streakAt(full) / Math.max(0.01, streakAt(idle))).toFixed(1)}배** (2.5배 이상)`
    + ` — 옛 눈금으로는 ${(streakLen(was.full) / Math.max(0.01, streakLen(was.idle))).toFixed(1)}배라`
    + ' **멈춘 것과 전속이 눈에 거의 같았다**');
}

console.log('\n[3] ★★★ **별줄 눈금이 실제 범위에 맞나** — 여기가 제일 크게 틀려 있었다');
{
  const rush = mpsAt({ leg: 1, boost: BOOST.mult });
  console.log(`   실제로 나오는 속도 ${mpsAt({ leg: 0 }).toFixed(1)} ~ ${rush.toFixed(1)} mps`);
  console.log(`   옛 눈금 STREAK.fast = ${STREAK.fast} → 급가속이 곡선의`
    + ` **${((rush / STREAK.fast) * 100).toFixed(0)}%** 자리`);
  console.log(`   새 눈금 SPEED.streakFast = ${SPEED.streakFast} →`
    + ` **${((rush / SPEED.streakFast) * 100).toFixed(0)}%** 자리`);
  ok(rush / SPEED.streakFast > 0.55,
    `★★★ **제일 빠른 것이 새 눈금의 ${((rush / SPEED.streakFast) * 100).toFixed(0)}%** 를 쓴다`
    + ` (55% 이상) — 옛 눈금은 ${((rush / STREAK.fast) * 100).toFixed(0)}% 였다.`
    + ' 자의 끝을 아무도 안 쓰면 그건 눈금이 통째로 안 맞는 것이다');
  ok(streakAt(mpsAt({ leg: 0 })) < 2,
    `★★ 멈추면 줄이 **거의 안 보인다** (${streakAt(mpsAt({ leg: 0 })).toFixed(2)})`
    + ` — 옛 눈금은 ${streakLen(CRUISE.speed * LEG.coast).toFixed(2)} 였다 (bend 0.32 가`
    + ' 초반을 확 올려서, 멈춘 것도 한참 흐르는 것으로 보였다)');
}

console.log('\n[4] ★★ **역추진도 흐르나** — 뒤로 가는 것도 가는 것이다');
{
  const back = mpsAt({ back: true });
  ok(back > mpsAt({ leg: 0 }),
    `★★★ 역추진이 **${back.toFixed(1)} mps** 로 흐른다 — 옛 legMult 는 역추진에`
    + ' 0 을 줘서 **별이 멎었다.** 뒤로 밀고 있는데 창밖이 멎으면 그건 고장으로 읽힌다');
  ok(back < mpsAt({ leg: 1 }), '★ 그래도 전속보다는 느리다 — 역추진은 주엔진이 아니다');
}

console.log('\n[5] ★★★ **가속도가 따로 있나** — 「빠르다」와 「빨라진다」는 다르다');
{
  console.log('   초당 변화(mps/s)   느낌 0~1   화각 열림   좌석 밀림   먼지');
  //  ★ v160 — 축척을 따라오게 `SPEED.accFull` 에서 뽑는다
  const A = SPEED.accFull;
  for (const d of [0, A * 0.24, A * 0.56, A, A * 1.76].map((v) => +v.toFixed(1))) {
    const k = accOf(d); const f = feelOf(k);
    console.log(`   ${String(d).padStart(12)} ${k.toFixed(2).padStart(11)}`
      + ` ${f.fov.toFixed(1).padStart(11)}° ${f.seat.toFixed(3).padStart(11)}`
      + ` ${f.dust.toFixed(2).padStart(7)}배`);
  }
  ok(accOf(0) === 0, '★★ 등속이면 가속 신호가 **0** 이다 — 그래야 「지금 빨라지는 중」이 읽힌다');
  ok(accOf(SPEED.accFull * 1.76) === 1 && accOf(SPEED.accFull * 0.56) > 0.4,
    `★★ 스로틀을 끝까지 미는 정도(초당 ${(SPEED.accFull * 0.56).toFixed(0)})면`
    + ` ${accOf(SPEED.accFull * 0.56).toFixed(2)} 는 나온다`);
  const f1 = feelOf(1);
  ok(f1.fov > 8 && f1.fov < 20,
    `★★★ 최대 화각 열림이 **${f1.fov}도** (8~20) — 가장자리가 빨리 흘러 속도로 읽힌다.`
    + ' 더 열면 어안 렌즈가 되고, 덜 열면 아무 일도 안 난다');
  ok(f1.dust > 1.4, `★ 먼지도 ${f1.dust.toFixed(2)}배 쏟아진다 — 몸이 아니라 눈으로 느끼는 몫`);
}

console.log('\n[6] ★★ **가속 신호가 삭나** — 등속인데 계속 떠 있으면 그건 속도계다');
{
  let k = 1; const dt = 1 / 60; let t = 0;
  while (k > 0.05 && t < 5) { k = fadeAcc(k, 0, dt); t += dt; }
  console.log(`   최대에서 0.05 까지 **${t.toFixed(2)}초**`);
  ok(t > 0.2 && t < 1.2,
    `★★★ **${t.toFixed(2)}초에 삭는다** (0.2~1.2) — 즉시 꺼지면 툭 끊겨 보이고,`
    + ' 오래 남으면 등속인데도 계속 빨라지는 것처럼 보인다');
  ok(fadeAcc(0.2, 0.9, dt) === 0.9,
    '★★ **오를 때는 바로 오른다** — 밟은 순간이 늦으면 그게 제일 크게 틀린 것이다');
}

console.log('\n[6-b] ★★★ **거점에서도 스로틀이 먹나** — 회차가 거기서 시작한다');
{
  const portIdle = mpsAt({ leg: 0, port: true });
  const portFull = mpsAt({ leg: 1, port: true });
  const wasPort = CRUISE.speed * 0.25;          // v115 까지 못박혀 있던 값
  console.log(`   거점 스로틀 0 ${portIdle.toFixed(1)} → 전속 ${portFull.toFixed(1)} mps`
    + ` (옛날엔 밀든 말든 ${wasPort.toFixed(1)} 로 못박혀 있었다)`);
  ok(portFull > portIdle * 3,
    `★★★ **거점에서도 밀면 ${(portFull / portIdle).toFixed(1)}배 빨라진다** — v115 까지는`
    + ' `phase === PORT ? 0.25` 로 못박혀 **스로틀이 아무것도 안 했다.**'
    + ' 그런데 **회차는 거점에서 시작한다** — 켜자마자 밀어 본 사람에게'
    + ' 「가속도가 안 느껴진다」의 첫인상이 거기서 난다');
  ok(portFull < mpsAt({ leg: 1 }),
    `★★ 그래도 **전속으로 떠나지는 못한다** (${portFull.toFixed(1)} < ${mpsAt({ leg: 1 }).toFixed(1)})`
    + ' — 「정박 중」과 「멈춰 있음」은 다르다. 천장만 씌운다 (`SPEED.portCap`)');
}

console.log('\n[7] ★★★ **붙으러 갈 때도 흐르나** — 「멀리서 그냥 가져오는」의 답');
{
  // 도킹 팔은 25m 안이라야 닿는다. 포획이 그 거리까지 **끌고 간다**
  const towed = mpsAt({ leg: 0, tow: CATCH.speed });
  const still = mpsAt({ leg: 0 });
  console.log(`   붙으러 가는 중 ${towed.toFixed(1)} mps · 가만히 ${still.toFixed(1)} mps`
    + ` · 별줄 ${streakAt(towed).toFixed(2)} vs ${streakAt(still).toFixed(2)}`);
  ok(towed > still * 3,
    `★★★ **붙으러 가면 창밖이 ${(towed / still).toFixed(1)}배 흐른다** — 포획이 거리를`
    + ' 줄이는 동안 창밖이 그대로면 **꾸러미가 날아오는** 것으로 보인다.'
    + ' 실제로는 배가 가는 것이므로 그 속도를 창밖에 얹는다');
  ok(streakAt(towed) > streakAt(still) + 1,
    '★★ 눈으로도 다르다 — 숫자만 다르고 화면이 같으면 안 고친 것과 같다');
  console.log(`   ※ 도킹 팔 ${WAYS.arm.reach}m · 걸쇠가 무는 거리 ${DOCK.reach}m —`
    + ' 그 사이를 **배가 실제로 좁힌다** (`catch.js stepCatch`)');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 멈추면 멈추고, 빨라지면 느껴지고, 붙으러 가면 흐릅니다');
process.exit(bad ? 1 : 0);
