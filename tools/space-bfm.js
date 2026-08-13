// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **우주판 공중전** — 고증이 게임에 들어왔나 (v73 · docs/space/BFM.md)
//
//    node tools/space-bfm.js
//
//  ★ 사장님: 「먼저 **전투기들이 어떻게 전투하는지 고증**하고 그대로
//             우주 배경에 맞게 도입해」
//            「적을 **근접하게 따라가면 락온**되면서 발사할 수 있도록」
//            「**회전도 모두 가능하도록, 급가속, 급하강, 급상승, 급 회전**」
//
//  ★★ 묻는 것 다섯:
//      ① **사방 어디든 기수를 돌리나** — 발밑의 적도 겨눌 수 있나
//      ② ★★★ **잘 쫓으면 빨리 물리나** — 락온이 기다리기가 아니라 해내기인가
//      ③ **급기동에 값이 있나** — 추진제를 태우나 · 반동휠을 못 쓰나
//      ④ **급한 것이 몸에 느껴지나** — 짐벌이 더 기우나
//      ⑤ **도는 것이 공짜가 아닌가** — 천천히는 공짜, 급하면 값
//
//  ★★★ 여기서 안 나오는 것: **「싸우는 맛」.** 그건 직접 몰아 봐야 안다.
//
//  ★ 브라우저를 안 쓴다.
// ══════════════════════════════════════════════════════════════════════════
import { AXES, GIMBAL, RCS } from '../web/space/js/game/flight-table.js';
import {
  makeFlight, stepFlight, offCourse, wheelAt, wheelFull, summary,
} from '../web/space/js/game/flight.js';
import { RADAR } from '../web/space/js/game/combat-table.js';
import { makeCombat, stepRadar, isLocked } from '../web/space/js/game/combat.js';
import { FUEL } from '../web/space/js/game/fuel-table.js';
import { BOOST, RUSH } from '../web/space/js/game/boost-table.js';
import { makeBoost, stepBoost, boostMult } from '../web/space/js/game/boost.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DT = 1 / 30;

/** 손을 이렇게 두고 몇 초 */
function hold(f, sec, push, burst = false) {
  let burned = 0;
  for (let t = 0; t < sec; t += DT) {
    stepFlight(f, DT, { atSeat: true, push, manual: true, burst });
    burned += f.burned;
  }
  return burned;
}

console.log('\n우주판 공중전 — 고증이 게임에 들어왔나');
console.log(`   급기동 ×${RCS.burst.mult} · 반동휠 ${RCS.wheelCap} rad · 근접 락온 ${RADAR.chase.closeIn}m`);

console.log('\n[1] ★★ **사방 어디든 기수를 돌리나** — 발밑의 적도 겨눈다');
{
  ok(AXES.pitch.max === Infinity && AXES.yaw.max === Infinity && AXES.roll.max === Infinity,
    '세 축이 다 끝이 없다 — 35도에서 멎으면 **발밑의 적은 영영 못 겨눈다**');
  const f = makeFlight();
  hold(f, 8, { pitch: -1 });
  const deg = (-f.pitch * 180) / Math.PI;
  console.log(`   아래로 8초 — ${deg.toFixed(0)}도`);
  ok(deg > 180, `★★ 아래로 **${deg.toFixed(0)}도** 내려간다 — 바로 밑(180도)을 넘긴다`);
  // ★ 우주에는 실속이 없으므로 각도 제한이 없는 것이 맞다. 값은 추진제로 낸다
  ok(RCS.burn > 0, '★ 대신 **추진제로 값을 낸다** — 우주에는 실속이 없어 각도로는 못 막는다');
}

console.log('\n[2] ★★★ **잘 쫓으면 빨리 물리나** — 락온이 해내기인가');
{
  /** 표적을 이렇게 두고 묶어 본다 */
  const lockSec = (dist0, closing) => {
    const c = makeCombat(); c.radar.on = true;
    const t = { id: 1, kind: 'raider', az: 0, el: 0, dist: dist0, vaz: 0, vel: 0, hp: 6 };
    let u = 0;
    while (u < 20) {
      stepRadar(c, DT, { t, off: 1, relAz: 1, relEl: 0 });
      if (isLocked(c, t)) return u;
      t.dist = Math.max(20, t.dist - closing * DT);
      u += DT;
    }
    return Infinity;
  };
  const far = lockSec(200, 0);                       // 멀리서 가만히
  const near = lockSec(80, 0);                       // 가까이서 가만히
  const chase = lockSec(80, RADAR.chase.closing + 4); // ★ 붙어서 따라간다
  console.log(`   멀리서 가만히 ${far.toFixed(1)}초 · 가까이서 가만히 ${near.toFixed(1)}초`
    + ` · **붙어서 따라가며 ${chase.toFixed(1)}초**`);
  ok(chase < near * 0.75,
    `★★★ **붙어서 따라가면 ${chase.toFixed(1)}초** — 가만히(${near.toFixed(1)}초)보다 훨씬 빠르다.`
    + ' 락온이 「올려 두고 기다리기」에서 **「쫓아서 해내기」**가 된다');
  ok(Math.abs(far - near) < 0.3,
    '★ 멀리서는 가까이서와 같다 — **가깝기만 해서는** 안 빨라진다. 따라잡고 있어야 한다');
  ok(RADAR.chase.fast < 1 && RADAR.chase.closing > 0,
    `표에 값이 있다 (${RADAR.chase.fast}배 · ${RADAR.chase.closing}m/s 이상) — 실제 **선도 추격**의 표시다`);
}

console.log('\n[3] ★★★ **급기동에 값이 있나** — 공짜면 늘 급기동이 답이다');
{
  const a = makeFlight();
  const slow = hold(a, 3, { yaw: 0.35 }, false);
  const b = makeFlight();
  const fast = hold(b, 3, { yaw: 1 }, true);
  console.log(`   3초 — 천천히 ${(a.yaw * 180 / Math.PI).toFixed(0)}도 · 추진제 ${slow.toFixed(2)}`);
  console.log(`   3초 — **급하게** ${(b.yaw * 180 / Math.PI).toFixed(0)}도 · 추진제 ${fast.toFixed(2)}`);
  ok(Math.abs(b.yaw) > Math.abs(a.yaw) * 1.8,
    `★ 급기동이 **훨씬 빨리 돈다** (${(b.yaw / a.yaw).toFixed(1)}배)`);
  ok(fast > slow * 3,
    `★★★ 그런데 **추진제를 ${(fast / Math.max(slow, 0.001)).toFixed(0)}배** 태운다 —`
    + ' 공짜면 늘 급기동이 답이 되고, 답이 하나면 그건 선택이 아니다');
  ok(slow < 0.05,
    `★★ **천천히 돌리면 거의 공짜다** (${slow.toFixed(3)}) — 반동휠이 한다.`
    + ' 실제 위성이 잔 조정을 바퀴로 하는 것과 같다');
  ok(wheelAt(a) > 0.02, `천천히 돌리면 **바퀴가 찬다** (${(wheelAt(a) * 100).toFixed(0)}%)`);
  ok(wheelAt(b) < 0.02,
    '★ 급기동이면 **바퀴를 아예 안 쓴다** — 바퀴는 굼떠서 그만한 각가속을 못 낸다');
}

console.log('\n[4] ★★ **바퀴가 차면 공짜가 끝나나** — 무한히 공짜면 값이 없다');
{
  const f = makeFlight();
  let burned = 0, spun = 0;
  // 한 방향으로 오래 — 바퀴가 찰 때까지
  for (let t = 0; t < 30; t += DT) {
    const was = f.yaw;
    stepFlight(f, DT, { atSeat: true, push: { yaw: 0.3 }, manual: true });
    burned += f.burned;
    spun += Math.abs(f.yaw - was);
  }
  console.log(`   30초를 천천히 — ${(spun * 180 / Math.PI).toFixed(0)}도 · 바퀴 ${(wheelAt(f) * 100).toFixed(0)}%`
    + ` · 추진제 ${burned.toFixed(2)}`);
  ok(wheelFull(f), '★★ 오래 돌리면 **바퀴가 찬다** — 공짜가 끝난다');
  ok(burned > 0.05,
    `★ 찬 뒤로는 **추진제를 쓴다** (${burned.toFixed(2)}) — 무한히 공짜면 「값이 있다」가 거짓말이다`);
  // 놓으면 조금씩 풀린다
  const was = f.wheel;
  for (let t = 0; t < 4; t += DT) stepFlight(f, DT, { atSeat: false, push: {}, manual: true });
  ok(f.wheel < was,
    `★ 손을 놓으면 바퀴가 **풀린다** (${(was).toFixed(2)} → ${f.wheel.toFixed(2)}) —`
    + ' 안 풀리면 회차 중반부터 영영 추진제만 쓴다');
}

console.log('\n[5] ★★ **급한 것이 몸에 느껴지나** — 눈으로만 알면 그건 화면이다');
{
  const a = makeFlight();
  hold(a, 0.6, { roll: 1 }, false);
  const b = makeFlight();
  hold(b, 0.6, { roll: 1 }, true);
  const da = (Math.abs(a.tiltZ) * 180) / Math.PI;
  const db = (Math.abs(b.tiltZ) * 180) / Math.PI;
  console.log(`   방이 기운 각 — 보통 ${da.toFixed(1)}도 · **급기동 ${db.toFixed(1)}도**`);
  ok(db > da, '★★ 급기동이면 **방이 더 기운다** — 급한 것은 몸으로 느껴야 한다');
  ok(db <= (GIMBAL.maxTilt * 180) / Math.PI + 0.01,
    `그래도 ${(GIMBAL.maxTilt * 180 / Math.PI).toFixed(0)}도를 안 넘는다 — 넘기면 **걷다가 넘어지는 게임**이 된다`);
}

console.log('\n[6] ★ **추진제가 정말 동나나** — 안 동나면 값이 아니다');
{
  const f = makeFlight();
  let burned = 0;
  for (let t = 0; t < 60; t += DT) {
    stepFlight(f, DT, { atSeat: true, push: { yaw: 1 }, manual: true, burst: true });
    burned += f.burned;
  }
  const share = burned / FUEL.max;
  console.log(`   급기동으로 1분을 돌면 추진제의 ${(share * 100).toFixed(0)}% 를 태운다 (탱크 ${FUEL.max})`);
  ok(share > 0.15 && share < 1.2,
    `★★ 1분 급기동이 탱크의 **${(share * 100).toFixed(0)}%** (15~120%) —`
    + ' 너무 적으면 값이 아니고, 너무 많으면 한 번 쓰고 끝이다');
}

console.log('\n[7] ★★★ **급가속** — 따로 하는 조작이고, 속도감이 있나 (v73)');
{
  // 사장님 「**급가속 조작은 따로** 하도록」 · 「**빛무리가 쏟아져오거나
  //         속도감이 느껴지도록**」
  const b = makeBoost();
  let u = 0, fuel = 100;
  while (u < 4) { stepBoost(b, DT, { on: true, fuel }); fuel -= b.fuel; u += DT; }
  console.log(`   4초 밀어서 ${(b.k * 100).toFixed(0)}% · 속도 ${boostMult(b).toFixed(1)}배`
    + ` · 추진제 ${(100 - fuel).toFixed(1)} 씀`);
  ok(b.k > 0.95, `★ ${BOOST.spin}초쯤이면 다 차오른다 — 딸깍이면 무게가 없다`);
  ok(boostMult(b) > 2.5, `★★ **${boostMult(b).toFixed(1)}배**로 간다 — 쫓아 붙을 수 있다`);
  ok(100 - fuel > 3, `★★★ 추진제를 **${(100 - fuel).toFixed(1)}** 태운다 — 공짜면 늘 밟는 것이 답이다`);
  ok(BOOST.heat > 0 && BOOST.sign > 0,
    `★ 그리고 **열이 오르고 자국이 커진다** (${BOOST.heat}/s · +${BOOST.sign}) —`
    + ' 세 값 다 **이미 있는 축**이다. 새 자원을 안 만들었다');

  // 놓으면 서서히 준다 — 우주에 브레이크는 없다
  let v = 0;
  while (v < 1.0) { stepBoost(b, DT, { on: false, fuel }); v += DT; }
  ok(b.k > 0.1 && b.k < 0.95,
    `★★ 놓고 1초 뒤에도 ${(b.k * 100).toFixed(0)}% 남아 있다 — **딱 끊기면 브레이크를 밟은 것**이고,`
    + ' 우주에 브레이크는 없다');

  // ══ ★★★ v137 — **묻는 것을 뒤집었다** ═══════════════════════════════
  //   여기가 「추진제가 6 아래면 **안 걸린다**」를 지키고 있었다. 그런데
  //   v136 에 사장님이 「**추진제가 없다고 가속이 안되잔아. 스테미나
  //   형식으로 변경하라고 했지?**」라고 하셨고, 그 문지기를 걷어냈다.
  //   ★★ 안 고쳤으면 이 검사가 **없앤 설계를 지키며** 빨간 채로 남았을
  //     것이다 — 「낡은 검사가 죽은 설계를 지킨다」는 이 저장소의 단골이고,
  //     **낡은 빨강은 새 빨강을 덮는다** (v120·v121 이 그랬다)
  const d = makeBoost();
  let ev = null;
  for (let i = 0; i < 30; i++) ev = stepBoost(d, DT, { on: true, fuel: 0 }) ?? ev;
  ok(d.k > 0.2 && ev !== 'dry',
    `★★★ **추진제가 0 이어도 급기동이 걸린다** (${d.k.toFixed(2)}) — 막는 것은`
    + ' **여력 하나**다 (`drive-table.js`). v135 까지 문이 둘이라, 여력이'
    + ' 가득해도 추진제가 6 아래면 못 밀었다');

  // ★★ 속도감 — 별은 안 흘리고 먼지를 흘린다 (v57 고증)
  ok(RUSH.dust > 3 && RUSH.fov > 5 && RUSH.shake > 1,
    `★★★ 속도감이 셋이다 — 먼지 ${RUSH.dust}배 · 화각 +${RUSH.fov}도 · 떨림 ${RUSH.shake}배.`
    + ' **별은 안 흘린다** (v57 고증: 제일 가까운 별도 4광년이다)');
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「싸우는 맛」은 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「사방을 도나 · 쫓으면 빨리 물리나 · 급기동에 값이 있나」뿐이다.');
process.exit(fail ? 1 : 0);
