// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **발사관** — 뼈대만 시뮬한다 (v100)
//
//    node tools/space-mount.js
//
//  ★ 사장님 「적을 계속 타겟팅 하면서 **회피 기동이 가능**하도록 …
//    동체는 회전해도 **타겟팅이 불안정해지지만 방향은 유지**하는걸로?
//    **블록 아웃을 먼저 만들고 테스트하고 적용**해줘」
//    「회피 기동하면 적을 타겟하는 것도 따라움직이니 **회피 자체가 의미가
//    없어** 현재는」
//
//  ══ 이 도구는 **게임을 안 부른다** ═══════════════════════════════════
//
//  `mount.js` · `mount-table.js` 만 돌린다. 표(비행·전투)에서 숫자를
//  읽어 오되 게임은 안 켠다. 여기서 다 ✔ 가 된 뒤에 붙인다.
//
//  ★★★ 묻는 것 다섯
//      ① **지금이 정말 그런가** — 회피하면 조준을 잃나 (v99 의 실측)
//      ② 발사관이 **따라가나** · 한 번에 안 붙나
//      ③ ★ 동체를 굴리면 **흔들리나** — 방향은 유지하되 정확도가 준다
//      ④ ★ 짐벌 **한계**가 있나 — 끝에 붙고, 오래 붙으면 놓친다
//      ⑤ ★★ **회피가 뜻을 갖나** — 피하면서 쏠 수 있고, 대신 값을 치르나
// ══════════════════════════════════════════════════════════════════════════
import { MOUNT, isGimbaled, mountWord, spreadOf } from '../web/space/js/game/mount-table.js';
import { makeMount, stepMount, errOf, offOf, summary } from '../web/space/js/game/mount.js';
import { AXES, RCS } from '../web/space/js/game/flight-table.js';
import { WEAPONS, RADAR } from '../web/space/js/game/combat-table.js';
import { DODGE } from '../web/space/js/game/target-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const head = (t) => console.log(`\n${t}`);
const DT = 1 / 30;
const R2D = 180 / Math.PI;

/** 조종간을 가득 밀 때 기수가 도는 속도 (도/초) */
const yawRate = (burst) => AXES.yaw.rate * (burst ? RCS.burst.mult : 1) * R2D;
/** 회피 한 번을 채우는 데 걸리는 초 — `evadeGain` 이 가득이면 1/초다 */
const dodgeSec = (burst) => DODGE.need / (burst ? RCS.burst.mult : 1);

console.log('발사관 — 뼈대만 (게임을 안 부른다)');
console.log(`   짐벌 ±${MOUNT.cone}도 · 도는 속도 ${MOUNT.slew}도/초`
  + ` · 흔들림 ${MOUNT.wobble}도 per (도/초) · 잦아듦 ${MOUNT.settle}도/초`);

// ══════════════════════════════════════════════════════════════════════════
head('[1] ★★★ **지금이 정말 그런가** — 회피하면 조준을 잃나');
{
  for (const burst of [false, true]) {
    const rate = yawRate(burst);
    const sec = dodgeSec(burst);
    const swept = rate * sec;
    console.log(`   ${burst ? '급기동' : '보통  '} — 기수 ${rate.toFixed(0)}도/초 × ${sec.toFixed(2)}초`
      + ` = **${swept.toFixed(0)}도** 쓸린다`);
  }
  const swept = yawRate(false) * dodgeSec(false);
  ok(Math.abs(swept - yawRate(true) * dodgeSec(true)) < 1,
    '★★ 세게 밀어도 **쓸리는 각은 같다** — 급기동은 빠른 대신 짧다');
  ok(swept > WEAPONS.laser.tol,
    `★★★ 쓸리는 각 ${swept.toFixed(0)}도 > 레이저 허용각 ${WEAPONS.laser.tol}도 —`
    + ' 즉 **회피하면 못 쏜다**. 사장님 말씀이 여기 있다');
  // ══ ★★★ v119 — **이 줄이 뒤집혔다** ══════════════════════════════
  //
  //  ★ v100 에는 「쓸리는 각이 락온 유지각(32도)보다 커서 **락온까지
  //    놓친다**」가 이 계통을 만든 이유였다. 그 유지각이 v119 에
  //    **짐벌 60도**가 됐다 (사장님 「락온 시키면 자동으로 타겟을
  //    따라가도록 … 다시 조준해야 해서 불편해」 · 실제 STT 의 짐벌 한계).
  //
  //  ★★ 그래서 지금 맞는 문장은 정반대다: **회피 한 번으로는 락온을
  //    안 놓는다.** 대신 값은 그대로 치른다 — 발사관이 흔들려 **정확도**를
  //    내준다 (아래 [5] 가 그걸 잰다). 회피가 「표적을 버리는 일」에서
  //    **「정확도를 내주는 일」**로 옮겨 간 것이고, 그게 사장님이 v100 에
  //    「타겟팅 하면서 회피 기동이 가능하도록」이라 하신 그것이다.
  //
  //  ★★★ **낡은 문장을 남겨 두면 검사가 죽은 설계를 지킨다.** 뒤집힌
  //    것은 지우지 말고 **뒤집힌 채로** 적는다 (`CLAUDE.md` 규약)
  //  ★ 재 보니 **60.16 대 60** 이었다 — 회피 한 번이 락온을 **딱 벼랑
  //    끝까지** 민다. 그 한 뼘을 유예(`holdGrace`)가 덮으므로 안 깨지고,
  //    기수를 안 되돌리면 유예가 다해 깨진다. 노린 것은 아니었지만
  //    **이보다 좋은 자리가 없어서** 그대로 뒀다: 「피할 수는 있다.
  //    다만 피한 채로 있을 수는 없다」가 숫자 하나로 선다
  ok(swept - RADAR.gimbal < 5,
    `★★★ 쓸리는 각 ${swept.toFixed(1)}도 ≈ **짐벌 ${RADAR.gimbal}도** —`
    + ` 회피 한 번이 락온을 **벼랑 끝까지** 민다. 유예 ${RADAR.holdGrace}초가`
    + ' 그 한 뼘을 덮으므로 **한 번으로는 안 놓는다** (v100 에는 반대였다)');
}

// ══════════════════════════════════════════════════════════════════════════
head('[2] ★★ 발사관이 **따라가나** — 한 번에 안 붙는다');
{
  const m = makeMount();
  const aim = { az: 30, el: 8 };
  stepMount(m, DT, { aim, id: 1, spin: 0 });
  const first = errOf(m, aim);
  ok(first > 10, `★ 한 프레임에 **다 못 붙는다** (아직 ${first.toFixed(1)}도) — 붙으면 자석이다`);
  let t = 0;
  while (t < 3 && errOf(m, aim) > 0.5) { stepMount(m, DT, { aim, id: 1, spin: 0 }); t += DT; }
  ok(errOf(m, aim) <= 0.5,
    `★★ ${t.toFixed(2)}초면 **붙는다** (${MOUNT.slew}도/초) — 가만히 있으면 정확하다`);
  ok(!m.pinned, '★ 한계 안이라 안 걸린다');
}

// ══════════════════════════════════════════════════════════════════════════
head('[3] ★★★ 동체를 굴리면 **흔들리나** — 방향은 유지하되 정확도가 준다');
{
  const rows = [];
  for (const [name, spin] of [['가만히', 0], ['보통 선회', yawRate(false)], ['급기동', yawRate(true)]]) {
    const m = makeMount();
    const aim = { az: 0, el: 0 };
    for (let t = 0; t < 1.5; t += DT) stepMount(m, DT, { aim, id: 1, spin });
    rows.push({ name, spin, wob: m.wob, err: errOf(m, aim), word: mountWord({ ...m }) });
  }
  console.log('   동체            도는 속도    흔들림     조준 오차   계기');
  for (const r of rows) {
    console.log(`   ${r.name.padEnd(10)} ${r.spin.toFixed(0).padStart(6)}도/초`
      + `  ${r.wob.toFixed(2).padStart(6)}도  ${r.err.toFixed(2).padStart(7)}도   ${r.word}`);
  }
  ok(rows[0].err < 0.05, '★ 가만히 있으면 **정확하다** (오차 ~0)');
  ok(rows[1].err > 0 && rows[1].err < WEAPONS.laser.tol,
    `★★ 보통 선회면 ${rows[1].err.toFixed(1)}도 — 허용각(${WEAPONS.laser.tol})보다 작아서 **아직 맞는다**`);
  ok(rows[2].err > WEAPONS.laser.tol,
    `★★★ 급기동이면 ${rows[2].err.toFixed(1)}도 — 허용각을 넘는다. **세게 빼면 빗나가기 시작한다**`);
  ok(rows[2].word === '불안정',
    `★ 계기가 「${rows[2].word}」이라고 적는다 — 왜 안 맞는지 화면이 말해야 한다`);
  // 놓으면 잦아드나
  {
    const m = makeMount();
    const aim = { az: 0, el: 0 };
    for (let t = 0; t < 1.5; t += DT) stepMount(m, DT, { aim, id: 1, spin: yawRate(true) });
    const hot = m.wob;
    let t = 0;
    while (t < 3 && m.wob > WEAPONS.laser.tol) { stepMount(m, DT, { aim, id: 1, spin: 0 }); t += DT; }
    ok(m.wob <= WEAPONS.laser.tol,
      `★★ 손을 놓으면 **${t.toFixed(2)}초에 잦아든다** (${hot.toFixed(1)} → ${m.wob.toFixed(1)}도) —`
      + ' 안 가라앉으면 한 번 급기동한 회차가 통째로 못 맞히는 회차가 된다');
  }
}

// ══════════════════════════════════════════════════════════════════════════
head('[4] ★★ 짐벌 **한계** — 끝에 붙고, 오래 붙으면 놓친다');
{
  const m = makeMount();
  // 표적을 짐벌 밖으로 보낸다
  const aim = { az: MOUNT.cone + 25, el: 0 };
  for (let t = 0; t < 4; t += DT) stepMount(m, DT, { aim, id: 1, spin: 0 });
  ok(m.pinned, `★★ 한계 밖이면 **끝에 걸린다** (${offOf(m).toFixed(0)}도 = 짐벌 ${MOUNT.cone}도)`);
  ok(Math.abs(offOf(m) - MOUNT.cone) < 0.5,
    '★★★ 그래도 **그쪽을 보고 있다** — 사장님 「방향은 유지」가 이 한 줄이다');
  // 오래 붙어 있으면 놓친다
  const m2 = makeMount();
  let ev = null, t = 0;
  while (t < 5 && ev !== 'lost') { ev = stepMount(m2, DT, { aim, id: 1, spin: 0 }); t += DT; }
  ok(ev === 'lost',
    `★ 끝에 붙은 채 ${t.toFixed(1)}초가 지나면 **놓친다** — 「영영 안 놓친다」면 그것도 공짜다`);
  ok(t > 1.2, `★ 다만 곧바로는 안 놓는다 (${t.toFixed(1)}초) — 기수를 되돌릴 틈은 준다`);
}

// ══════════════════════════════════════════════════════════════════════════
head('[5] ★★★ **회피가 뜻을 갖나** — 피하면서 쏠 수 있고, 대신 값을 치르나');
{
  //  회피 한 번을 실제로 굴려 본다: 기수를 60도 쓸면서 발사관이 어떻게 되나
  const burst = true;
  const rate = yawRate(burst);
  const sec = dodgeSec(burst);
  const m = makeMount();
  let noseAz = 0;
  let worst = 0, everPinned = false, lost = false;
  for (let t = 0; t < sec; t += DT) {
    noseAz += rate * DT;                     // 기수가 돈다
    const aim = { az: -noseAz, el: 0 };      // 표적은 그대로 → 기수 기준으로 밀려난다
    const ev = stepMount(m, DT, { aim, id: 1, spin: rate });
    if (ev === 'lost') lost = true;
    if (m.pinned) everPinned = true;
    worst = Math.max(worst, errOf(m, aim));
  }
  const aimEnd = { az: -noseAz, el: 0 };
  console.log(`   회피 한 번(급기동 ${sec.toFixed(2)}초) — 기수 ${noseAz.toFixed(0)}도 쓸림`
    + ` · 발사관 ${offOf(m).toFixed(0)}도 · 조준 오차 ${errOf(m, aimEnd).toFixed(1)}도`
    + ` · ${mountWord(m)}`);
  ok(!lost, '★★★ **회피 한 번으로는 안 놓친다** — 이것이 「타겟팅 하면서 회피」다');
  ok(errOf(m, aimEnd) > WEAPONS.laser.tol,
    `★★ 대신 **정확도를 내준다** (${errOf(m, aimEnd).toFixed(1)}도 > 허용각 ${WEAPONS.laser.tol}도) —`
    + ' 회피는 공짜가 아니라 **바꾸는 것**이다');
  // ══ ★★★ **등을 보이면 놓친다** ═══════════════════════════════════
  //
  //  ★ 처음엔 「한 방향으로 계속 돌면 놓친다」로 물었다가 **빨개졌다.**
  //    재 보니 게임이 아니라 물음이 틀렸다: 한 바퀴를 다 돌면 표적이
  //    **짐벌 안으로 되돌아온다.** 당연하다 — 360도는 제자리다.
  //  ★★ 진짜로 놓치는 것은 **돌아서 그대로 있을 때**다 (등을 보인다).
  //    그게 「빙빙 돌면 안전」을 막는 자리이고, 아래가 그것이다
  const m2 = makeMount();
  let nose2 = 0, lost2 = false, pinnedFor = 0;
  for (let t = 0; t < 6 && !lost2; t += DT) {
    // 100도까지 틀고 **거기서 멈춘다** — 표적은 짐벌(55도) 밖에 남는다
    const turning = nose2 < 100;
    if (turning) nose2 += rate * DT;
    const ev = stepMount(m2, DT, { aim: { az: -nose2, el: 0 }, id: 1, spin: turning ? rate : 0 });
    if (m2.pinned) pinnedFor += DT;
    if (ev === 'lost') lost2 = true;
  }
  ok(lost2,
    `★★★ **등을 보이면 놓친다** — 기수를 ${nose2.toFixed(0)}도 틀어 놓고 두니`
    + ` 짐벌 끝에 ${pinnedFor.toFixed(1)}초 걸려 있다가 놓쳤다.`
    + ' 「빙빙 돌면 안전」이 되면 그건 회피가 아니라 무적이다');
  // ══ ★★★ v119 — **이 줄이 버그를 지키고 있었다** ═══════════════════
  //
  //  ★ 여기가 `isGimbaled('seeker')` 를 물었고, 표에도 `seeker: true` 가
  //    있었다. 그런데 **무기 열쇠에 `seeker` 는 없다** — `laser`·`ir`·`arh`
  //    다. 즉 검사와 표가 **같은 오타를 나눠 갖고** 초록으로 지나갔고,
  //    실제로는 `isGimbaled('ir')` 가 undefined → **열추적탄이 기수
  //    고정으로** 굴러가고 있었다 (발사관에서 나가는 물건인데).
  //
  //  ★★ 그래서 이제 **이름을 손으로 안 적는다.** 무기 표를 훑어서
  //    「짐벌인 무기가 실제로 있나」를 묻는다 — 열쇠 이름이 바뀌면
  //    검사가 같이 따라간다
  const keys = Object.values(WEAPONS).map((w) => w.key);
  const gim = keys.filter((k) => isGimbaled(k));
  console.log(`   무기 ${keys.join(' · ')} → 짐벌인 것 ${gim.join(' · ') || '없음'}`);
  ok(!isGimbaled('laser') && gim.length === keys.length - 1,
    `★★ **레이저는 기수 고정 · 나머지(${gim.join('·')})는 발사관**이다 —`
    + ' 「붙어서 훑을까 빼면서 물까」가 생긴다'
    + ' (v118 까지 표와 검사가 **같은 오타**(`seeker`)를 나눠 갖고 있어 열추적탄이 새고 있었다)');
  ok(spreadOf({ wob: 3.3 }) === 3.3,
    '★ 흔들림은 **기존 명중 판정의 `off` 에 얹는다** — 새 판정을 안 만들었다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
console.log(`
  ※ **「회피가 재미있나」는 여기서 안 나온다.** 여기서 나오는 것은
     「따라가나 · 흔들리나 · 한계가 있나 · 회피가 바꾸는 것이 되나」뿐이다.
     손에 붙는지는 브라우저로 봐야 한다.`);
process.exit(bad ? 1 : 0);
