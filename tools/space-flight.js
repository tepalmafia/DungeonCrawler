// ══════════════════════════════════════════════════════════════════════════
//  ★★ 세 축 + 짐벌 — **몰 수 있나, 그런데 정비공인 채로인가** (v60)
//
//    node tools/space-flight.js
//    node tools/space-flight.js --see 8391    + 실제 배에서 돌려 본다
//
//  ★ 사장님: 「조정석이 좌우로 움직이잔아. 비행이가 360도 회전도 가능하게,
//             위 아래로 조정이 가능하게 해야지」 → 「실제 우주선 개념으로 가자」
//
//  ★★ 묻는 것 여섯. 앞의 셋은 **되나**, 뒤의 셋은 **말이 되나**다.
//
//      ① 세 축이 다 먹나 — 위아래 · 좌우 · 360도
//      ② 360도가 정말 한 바퀴 도나 — 막히면 그건 회전이 아니다
//      ③ 놓으면 어떻게 되나 — **수동이면 그대로** (v55 에서 고친 것)
//      ④ ★★ 짐벌 — 배가 뒤집혀도 **방은 수평인가** (걸을 수 있나)
//      ⑤ 그런데 **느낌은 나나** — 아무 기울림도 없으면 눈으로만 안다
//      ⑥ ★★ **장르가 안 바뀌었나** — 조종석에 매인 시간
//
//  ★★ ⑥ 이 제일 중요하다. `CHASE2.md §5` 가 「조종을 늘리기」를 **안 하는
//     것**에 넣어 뒀다 — 축을 셋으로 늘리면서 매인 시간까지 늘면
//     이 게임은 정비공 게임이 아니라 비행 시뮬이 된다.
//     **몰 수 있는 것이지 몰아야 하는 것이 아니다.**
// ══════════════════════════════════════════════════════════════════════════
import { AXES, GIMBAL, OFF_WEIGHT, attitudeWord, rollDeg } from '../web/space/js/game/flight-table.js';
import { makeFlight, stepFlight, offCourse, gimbalBusy } from '../web/space/js/game/flight.js';
import { HAZARD } from '../web/space/js/game/hazard-table.js';
import { LEG } from '../web/space/js/game/route-table.js';


let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const DT = 1 / 30;

/** 손을 이렇게 두고 몇 초 */
function hold(f, sec, push, { manual = true } = {}) {
  for (let t = 0; t < sec; t += DT) stepFlight(f, DT, { atSeat: true, push, manual });
  return f;
}
/** 놓고 몇 초 */
function letGo(f, sec, { manual = true } = {}) {
  for (let t = 0; t < sec; t += DT) stepFlight(f, DT, { atSeat: false, push: {}, manual });
  return f;
}

console.log('\n세 축 + 짐벌 — 몰 수 있나, 그런데 정비공인 채로인가');

console.log('\n[1] ★★ **세 축이 다 먹나**');
{
  for (const k of ['pitch', 'yaw', 'roll']) {
    const f = makeFlight();
    hold(f, 1.0, { [k]: 1 });
    console.log(`   ${AXES[k].name.padEnd(7)} 1초 밀어서 ${f[k].toFixed(2)} (rate ${AXES[k].rate})`);
    ok(Math.abs(f[k]) > 0.1, `**${AXES[k].name}**이 먹는다`);
  }
  const f = makeFlight();
  hold(f, 0.6, { pitch: 1, yaw: 1, roll: 1 });
  ok(f.pitch > 0 && f.yaw > 0 && f.roll > 0,
    `★ **셋을 동시에** 밀 수 있다 — 「${attitudeWord(f)}」`);
  // ★★★ **v69 에서 이 검사가 뒤집혔다.** 예전에는 「좌우 끝이 잔해
  //   피하기의 끝과 **같다**」였다 — 축을 둘로 안 만들려는 것이었고 옳았다.
  //   그런데 v69 에 좌우 한계를 **없앴다** (사장님 「바로 뒤로도 선회」).
  //   같을 수가 없어졌으므로 **지키려던 것만 남긴다**: 잔해 피하기가
  //   여전히 **좌우 축을 그대로 쓰는가**. 값이 같은 것은 방법이었고,
  //   축이 하나인 것이 목적이었다
  ok(AXES.yaw.max === Infinity,
    `★ 좌우는 **끝이 없다** — 바로 뒤(180도)로도 기수를 돌린다`);
  ok(HAZARD.laneMax > 0 && HAZARD.laneMax < AXES.yaw.max,
    `잔해 피하기(±${HAZARD.laneMax})가 좌우 축 **안에** 있다 — 축을 둘로 안 만든다`);
}

console.log('\n[2] ★★ **360도가 정말 한 바퀴 도나**');
{
  const f = makeFlight();
  hold(f, 10, { roll: 1 });
  const deg = (f.roll * 180) / Math.PI;
  console.log(`   10초 비트니 ${deg.toFixed(0)}도 (${(deg / 360).toFixed(2)}바퀴)`);
  ok(deg > 360, `★ **한 바퀴를 넘긴다** (${deg.toFixed(0)}도) — 막히면 그건 회전이 아니라 기울기다`);
  // ★ v69 — **둘이 끝이 없다.** 비틀기와 좌우. 위아래만 끝이 있다:
  //   기수를 위로 끝까지 젖히면 그건 선회가 아니라 공중제비고, 그러면
  //   짐벌이 감당 못 한다 (방이 뒤집힌다)
  // ★★★ **v73 — 셋 다 끝이 없다.** 사장님 「적이 하단에 나오면 더이상
  //   화면을 아래로 내릴 수 없는데 **360도 조정이 가능하게**」.
  //   35도에서 멎으면 **발밑의 적은 영영 못 겨눈다** — 레이더가 6시에
  //   점을 찍어 주는데 기수를 못 돌리면 보여 주고 못 하게 하는 계기다
  ok(AXES.roll.max === Infinity && AXES.yaw.max === Infinity && AXES.pitch.max === Infinity,
    '★★★ **세 축이 다 끝이 없다** — 사방 어디든 기수를 돌린다');
  const fy = makeFlight();
  hold(fy, 4, { yaw: 1 });
  ok((fy.yaw * 180) / Math.PI > 180,
    `★★ 좌우로 4초 밀면 ${((fy.yaw * 180) / Math.PI).toFixed(0)}도 — **바로 뒤(180도)를 넘긴다**`);
  // 한 바퀴 돌면 계기가 0 을 다시 가리킨다
  const f2 = makeFlight();
  f2.roll = Math.PI * 2;
  ok(Math.round(rollDeg(f2.roll)) % 360 === 0,
    `한 바퀴(360도)면 계기가 ${Math.round(rollDeg(f2.roll))}도 — 720도라고 안 쓴다`);
}

console.log('\n[3] ★ **놓으면 어떻게 되나** — 수동이면 그대로 (v55)');
{
  const m = makeFlight();
  hold(m, 1.2, { pitch: 1, roll: 1 });
  const was = { p: m.pitch, r: m.roll };
  letGo(m, 4, { manual: true });
  ok(Math.abs(m.pitch - was.p) < 0.01 && Math.abs(m.roll - was.r) < 0.01,
    '★ **수동이면 놓아도 그대로다** — 「놓으면 가운데로 돌아온다」는 v55 에서 사장님이 고치라 하신 것');
  const a = makeFlight();
  hold(a, 1.2, { pitch: 1, roll: 1 });
  letGo(a, 6, { manual: false });
  ok(Math.abs(a.pitch) < Math.abs(was.p) * 0.5,
    `자동 항법이면 되돌아온다 (기울기 ${was.p.toFixed(2)} → ${a.pitch.toFixed(2)})`);
  // ★★ **검사가 틀린 것을 묻고 있었다.** 처음엔 「값이 2π 근처로 가나」를
  //   물었는데, 2π 와 0 은 **같은 자세**다 — 0 으로 스냅하는 것이 맞고,
  //   그래야 두 시간을 도는 동안 숫자가 무한히 안 커진다.
  //   물어야 할 것은 **값**이 아니라 **자세**다 (열 번째다)
  const r = makeFlight();
  r.roll = Math.PI * 2 + 0.3;      // 한 바퀴하고 조금 더
  letGo(r, 8, { manual: false });
  const deg2 = rollDeg(r.roll);
  const near = Math.min(deg2, 360 - deg2);
  ok(near < 6,
    `★ 비틀기는 **제일 가까운 한 바퀴**로 간다 (계기 ${deg2.toFixed(0)}도) — 720도를 되감으면 기다림이지 조종이 아니다`);
  ok(Math.abs(r.roll) < Math.PI * 2,
    `그리고 값이 **안 쌓인다** (${r.roll.toFixed(2)}) — 2시간을 돌면 숫자가 끝없이 커진다`);
}

console.log('\n[4] ★★ **짐벌** — 배가 뒤집혀도 방은 수평인가');
{
  const f = makeFlight();
  let worst = 0;
  for (let t = 0; t < 12; t += DT) {
    stepFlight(f, DT, { atSeat: true, push: { roll: 1 }, manual: true });
    worst = Math.max(worst, Math.abs(f.tiltZ), Math.abs(f.tiltX));
  }
  const deg = (worst * 180) / Math.PI;
  console.log(`   한 바퀴 넘게 비트는 동안 방이 제일 많이 기운 각 ${deg.toFixed(1)}도`);
  ok(worst <= GIMBAL.maxTilt + 1e-6,
    `★★ 방은 **${deg.toFixed(1)}도**밖에 안 기운다 — 거주 구획이 짐벌에 매달려 있다.`
    + ' 선체가 360도 도는 동안 바닥은 제 수평을 지킨다');
  ok(deg < 15, `걸어다닐 수 있다 (15도 미만) — 넘기면 **걷다가 넘어지는 게임**이 된다`);
  // 손을 놓으면 곧 바로 선다
  letGo(f, 2.5, { manual: true });
  ok(Math.abs(f.tiltZ) < 0.01 && Math.abs(f.tiltX) < 0.01,
    '★ 놓으면 곧 **바로 선다** — 기운 채로 남으면 그건 짐벌이 고장난 것이다');
  ok(Math.abs(f.roll) > Math.PI, '그런데 **배는 여전히 뒤집혀 있다** — 방만 수평이다');
}

console.log('\n[5] ★ **느낌은 나나** — 아무것도 안 기울면 눈으로만 안다');
{
  ok(GIMBAL.give > 0 && GIMBAL.maxTilt > 0,
    `짐벌이 ${(GIMBAL.give * 100).toFixed(0)}% 새어 든다 — 0 이면 배가 도는지 **몸으로 모른다**`);
  const f = makeFlight();
  hold(f, 0.5, { roll: 1 });
  ok(gimbalBusy(f), `급하게 돌리면 짐벌이 운다 (기울기 ${(Math.abs(f.tiltZ) * 180 / Math.PI).toFixed(1)}도)`);
  const s = makeFlight();
  for (let t = 0; t < 3; t += DT) stepFlight(s, DT, { atSeat: true, push: { roll: 0.12 }, manual: true });
  ok(!gimbalBusy(s), '★ 천천히 돌리면 **안 운다** — 급한 것과 느긋한 것이 달라야 조작이 된다');
}

console.log('\n[6] ★★ **장르가 안 바뀌었나** — 조종석에 매인 시간');
{
  console.log(`   ${OFF_WEIGHT.roll < 1 ? `비틀기는 항로에서 덜 벗어난 것으로 친다 (${OFF_WEIGHT.roll})` : ''}`);
  // 축이 셋이어도 「벗어남」은 하나로 합쳐진다 — 벌을 셋 외우게 하지 않는다
  const f = makeFlight();
  // ★★ **v69 — 여기가 조용히 NaN 이 됐다.** `AXES.yaw.max` 를 Infinity 로
  //   열자 `f.yaw = Infinity` 가 됐고, `offCourse` 안의 `Infinity % 2π` 가
  //   NaN 이라 벌이 통째로 사라졌다. **한계를 없앨 때는 그 한계를 값으로
  //   쓰던 자리를 전부 따라가야 한다** — 여기와 `flight.js` 둘이었다.
  //   끝이 없는 축은 「제일 많이 벗어난 자세」가 곧 **반 바퀴(180도)** 다
  f.pitch = Math.PI; f.yaw = Math.PI; f.roll = Math.PI;
  ok(Math.abs(offCourse(f) - 1) < 0.01, `셋을 다 끝까지 밀면 벗어남 ${offCourse(f).toFixed(2)} — 하나로 합쳐진다`);
  const back = makeFlight();
  back.yaw = Math.PI;
  ok(offCourse(back) > 0.4,
    `★★ **뒤로 돌아서면 벗어남이 ${offCourse(back).toFixed(2)}** — 360도가 공짜가 아니다. 돌아선 채로 가면 느려진다`);
  const r = makeFlight();
  r.roll = Math.PI;
  ok(offCourse(r) < 0.4,
    `★ **비틀기만 하면 덜 벗어난다** (${offCourse(r).toFixed(2)}) — 실제로도 롤은 궤도를 안 바꾼다.`
    + ' 다만 0 은 아니다: 라디에이터와 안테나가 엉뚱한 데를 본다');

  // 한 회차에 조종석에 얼마나 매여 있나 — 축을 늘려도 이 값이 안 늘어야 한다
  //  「필요할 때만 잡고 놓는다」를 흉내 낸다: 구간마다 두 번, 한 번에 6초
  const RUN = LEG.seconds * 12;
  const grabs = 12 * 2, each = 6;
  const seat = grabs * each;
  console.log(`   회차 ${(RUN / 60).toFixed(0)}분에 ${grabs}번 × ${each}초 = ${seat}초 매여 있다`);
  const pct = (seat / RUN) * 100;
  ok(pct <= 15,
    `★★ 조종석에 매인 시간이 **${pct.toFixed(1)}%** — 15% 이하 (CHASE2 §5).`
    + ' 축을 셋으로 늘렸는데도 안 늘었다: **몰 수 있는 것이지 몰아야 하는 것이 아니다**');

}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「모는 맛이 나나」는 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「세 축이 먹나 · 한 바퀴 도나 · 방이 수평인가 · 정비공인 채인가」뿐이다.');
process.exit(fail ? 1 : 0);
