// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **전진은 기본, 가속은 스태미나** — 뼈대만 (v133)
//
//    node tools/space-drive.js
//
//  ★ 사장님 (2026-08-13) 「**앞으로 이동은 기본 베이스로 하고 가속화는
//    스테미나 방식으로 … 엔진 과열이 되서 속도가 느려진다는 컨셉으로**」
//
//  ★★★ 묻는 것 여섯
//      ① **아무것도 안 하면 가나** — 기본이 순항인가
//      ② **뒤로도 갈 수 있나** — v101 의 역추진이 안 죽었나
//      ③ ★★★ **태우면 주나 · 바닥나면 못 태우나**
//      ④ ★★★ **과열되면 느려지나** — 「못 쓴다」가 아니라 「느려진다」인가
//      ⑤ **멈추지는 않나** — 벌이 정지가 되면 그건 벌이 아니다
//      ⑥ **한 번 태우는 것이 값이 있나** — 몇 초나 태울 수 있나
// ══════════════════════════════════════════════════════════════════════════
import { DRIVE, makeDrive, stepDrive, capOf, driveWord } from '../web/space/js/game/drive-table.js';
import { THROTTLE } from '../web/space/js/game/throttle-table.js';
import { BOOST } from '../web/space/js/game/boost-table.js';
import { makeBoost, stepBoost } from '../web/space/js/game/boost.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const DT = 1 / 60;

console.log('전진은 기본, 가속은 스태미나 — 뼈대만 (게임을 안 부른다)');

console.log('\n[1] ★★★ **아무것도 안 하면 가나**');
{
  const d = makeDrive();
  const s = stepDrive(d, DT, {});                 // 아무것도 안 넘긴다
  console.log(`   손을 안 대면 스로틀 ${s.throttle} · 「${driveWord(s)}」`);
  ok(s.throttle > 0.2,
    `★★★ **켜면 이미 가고 있다** (${s.throttle}) — 이 게임은 「뚫는다·채운다·떨군다」이고`
    + ' 뚫는 것은 가고 있는 것이 전제다. 0 이면 매 회차가 여정이 아니라 **시동**으로 시작한다');
  ok(DRIVE.base < 0.7,
    `★★ 그래도 **전력은 아니다** (${DRIVE.base}) — 1 로 두면 스로틀이 할 일이 없어진다`);
}

console.log('\n[2] ★★ **뒤로도 갈 수 있나** — v101 의 역추진이 안 죽었나');
{
  const d = makeDrive();
  const s = stepDrive(d, DT, { want: THROTTLE.min });
  ok(s.throttle < 0,
    `★★★ **역추진이 그대로 산다** (${s.throttle}) — 사장님이 v101 에 「역추진을 만들어」라고`
    + ' 하셨다. 바뀌는 것은 **「아무것도 안 하면 어떻게 되나」** 하나뿐이다');
}

console.log('\n[3] ★★★ **태우면 주나 · 바닥나면 못 태우나**');
{
  const d = makeDrive();
  let t = 0, ran = 0;
  while (d.stam > 0 && t < 30) { const s = stepDrive(d, DT, { boost: true }); if (s.boosting) ran += DT; t += DT; }
  console.log(`   가득 찬 여력으로 **${ran.toFixed(1)}초** 태운다`);
  ok(ran > 1.5 && ran < 5,
    `★★★ **한 번에 ${ran.toFixed(1)}초** — 1초면 눌러 볼 새가 없고 8초면 「늘 켠다」가 된다`);
  const s2 = stepDrive(d, DT, { boost: true });
  ok(!s2.boosting, '★★★ **바닥나면 안 켜진다** — 그래야 「아껴 뒀다 한 번에」가 성립한다');
  // 차는 데 얼마나
  let back = 0;
  while (d.stam < 0.999 && back < 60) { stepDrive(d, DT, {}); back += DT; }
  console.log(`   바닥에서 다 차는 데 ${back.toFixed(1)}초`);
  ok(back > ran * 1.5,
    `★★ **차는 것이 쓰는 것보다 느리다** (${back.toFixed(1)}초 vs ${ran.toFixed(1)}초) —`
    + ' 같으면 계속 켜 놓는 것이 답이 되고, 그러면 고를 것이 없다');
  ok(back < 20, `★ 그래도 ${back.toFixed(1)}초면 다시 쓴다 — 너무 길면 한 번 쓰고 잊는다`);
}

console.log('\n[4] ★★★ **과열되면 느려지나** — 사장님 「과열이 되서 속도가 느려진다」');
{
  console.log('   열   최대 스로틀   계기가 하는 말');
  for (const h of [0, 0.5, 0.72, 0.85, 1]) {
    const c = capOf(h);
    console.log(`   ${String(h).padStart(4)}  ${c.cap.toFixed(2).padStart(10)}`
      + `   ${driveWord({ ...c, stam: 1, boosting: false })}`);
  }
  ok(capOf(0).cap === 1 && capOf(0.5).cap === 1,
    `★★ **선(${DRIVE.over.from}) 아래에서는 안 깎인다** — 늘 깎이면 그건 과열이 아니라 성능이다`);
  ok(capOf(1).cap < capOf(DRIVE.over.from).cap,
    '★★★ **뜨거울수록 느려진다** — 벌이 「못 쓴다」가 아니라 **「느려진다」**다.'
    + ' 막기만 하면 회색 단추이고, 느려지면 몰던 방식이 다음 구간에 남는다');
  const d = makeDrive();
  const s = stepDrive(d, DT, { want: 1, heat01: 1 });
  ok(s.throttle < 0.6,
    `★★★ **1 로 밀어도 ${s.throttle} 밖에 안 나간다** — 과열이 정말 속도를 깎는다`);
}

console.log('\n[5] ★★ **멈추지는 않나** — 벌이 정지가 되면 그건 벌이 아니다');
{
  ok(DRIVE.over.cap > 0.2,
    `★★★ **완전히 과열돼도 ${DRIVE.over.cap} 은 간다** — 0 이면 멈춰서 식기를 기다리는`
    + ' 게임이 되고, 그건 벌이 아니라 정지다. 느리게라도 가고는 있어야 한다');
  const d = makeDrive();
  const s = stepDrive(d, DT, { want: THROTTLE.min, heat01: 1 });
  ok(s.throttle === THROTTLE.min,
    '★★★ **과열이어도 뒤로는 온전히 간다** — 과열은 밀어붙이는 것을 막는 것이지'
    + ' 물러나는 것을 막는 것이 아니다. 막으면 갇힌다');
}

console.log('\n[6] ★★ **한 번 태우는 것이 값이 있나**');
{
  const d = makeDrive();
  let ran = 0, heat = 0, t = 0;
  while (d.stam > 0 && t < 30) {
    const s = stepDrive(d, DT, { boost: true, heat01: heat });
    if (s.boosting) { ran += DT; heat += s.heatAdd; }
    t += DT;
  }
  console.log(`   한 번 다 태우면 열이 ${(heat * 100).toFixed(0)}% 오른다 (과열 선 ${DRIVE.over.from * 100}%)`);
  ok(heat > 0.1 && heat < DRIVE.over.from,
    `★★★ **한 번으로는 과열까지 안 간다** (${(heat * 100).toFixed(0)}%) — 한 번에 벌까지 가면`
    + ' 아무도 안 쓰고, 안 오르면 과열이 영영 안 온다. **두세 번이면 뜨거워진다**');
  ok(BOOST.mult > 1.5,
    `★ 태우면 정말 빨라진다 (×${BOOST.mult}) — 값이 있어야 태울 이유가 생긴다`);
}

console.log('\n[7] ★★★ **추진제가 가속을 막지 않나** (v136)');
{
  //  ★ 사장님 (2026-08-13) 「**추진제가 없다고 가속이 안되잔아.
  //    스테미나 형식으로 변경하라고 했지?**」
  //  ★★★ v133 이 여력을 만들면서 **옛 문지기를 안 걷어냈다.** 그래서
  //    문이 둘이 됐고, 여력이 가득해도 추진제가 6 아래면 못 밀었다.
  //    「새 계통을 얹으면서 옛 계통을 안 걷어내는 것」이 이 저장소가
  //    제일 자주 밟는 함정이라, **문이 하나인지**를 여기서 지킨다
  const b = makeBoost();
  let ev = null;
  for (let i = 0; i < 30; i++) ev = stepBoost(b, DT, { on: true, fuel: 0 }) ?? ev;
  console.log(`   추진제 0 으로 30판 밀었다 — 세기 ${b.k.toFixed(2)} · 마지막 소식 ${ev ?? '없음'}`);
  ok(b.k > 0.2,
    `★★★ **추진제가 0 이어도 밀린다** (${b.k.toFixed(2)}) — 막는 것은 **여력 하나**여야 한다.`
    + ' 문이 둘이면 어느 쪽이 막았는지 사람이 알 수가 없고, 실제로 사장님이'
    + ' 「추진제가 없다고 가속이 안되잔아」로 겪으셨다');
  ok(ev !== 'dry',
    '★★ **「추진제가 모자라다」는 소식이 안 온다** — 안 막는데 그 말을 하면 거짓말이다');
  //  ★ 그래도 **값은 치른다** — v62 의 10분 시계를 안 죽인다
  const b2 = makeBoost();
  for (let i = 0; i < 30; i++) stepBoost(b2, DT, { on: true, fuel: 100 });
  ok(b2.fuel > 0,
    `★★ 그래도 **추진제를 쓰기는 한다** (${b2.fuel.toFixed(3)}/판) — 「없으면 못 한다」와`
    + ' 「없으면 안 준다」는 다르다. 앞은 문이고 뒤는 값이다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
