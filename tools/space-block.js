// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **전투 블록아웃** — 뼈대만으로 셋을 시뮬한다 (v96)
//
//    node tools/space-block.js
//
//  ★ 사장님 「전투 관련 코딩 다 삭제하고. 기획부터 다시 해. **거리측정,
//    타겟 락온, 레이더과 실제 우주에 보이는 물체와 일관성**」
//    「**블록아웃을 먼저 설정해서 시뮬레이션해서 적용해**」
//
//  ══ 왜 블록아웃인가 ═══════════════════════════════════════════════════
//
//  전투의 어긋남을 세 판 연달아 고쳤는데 매번 **다른 파일**이었다.
//  자리를 아는 곳이 **넷**(표·3D·HUD·레이더)이었기 때문이고, 하나를
//  고치면 나머지 셋과 갈라졌다. 그래서 모양을 만들기 전에 **뼈대**를
//  세운다 — `game/frame.js` 하나가 자리를 알고, 나머지는 **묻기만** 한다.
//
//  ★★ 이 도구는 **게임을 안 부른다.** 뼈대만 돌린다. 여기서 셋이 다
//    맞아야 게임에 붙일 자격이 생긴다 (「재기 전에 쓰지 않는다」).
//
//  ★★★ 묻는 것 셋 — 사장님이 말씀하신 그대로
//      ① **거리 측정** — 눈에서 잰 거리가 어디서 물어도 같은가
//      ② **타겟 락온** — 묶기·유지·놓기가 다른가 · 따라가는가
//      ③ **일관성** — 레이더가 말하는 자리 == 화면에 찍히는 자리
// ══════════════════════════════════════════════════════════════════════════
import {
  makeEye, seen, mark, wrap, firstOnPath, nearestToAim,
  LOCK, makeLock, stepLock, lagOf, relOf, pointOf,
} from '../web/space/js/game/frame.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const head = (t) => console.log(`\n${t}`);
const DT = 1 / 60;
const FOVH = 110, FOVV = 78;

/** 눈에서 방위·고도·거리로 자리를 만든다 (표적을 놓는 유일한 길) */
const at = (az, el, d) => ({
  x: Math.sin(az * Math.PI / 180) * Math.cos(el * Math.PI / 180) * d,
  y: Math.sin(el * Math.PI / 180) * d,
  z: -Math.cos(az * Math.PI / 180) * Math.cos(el * Math.PI / 180) * d,
});

console.log('\n전투 블록아웃 — 뼈대만으로 셋을 시뮬한다');
console.log(`   자리를 아는 곳: game/frame.js **하나** · 화면 ${FOVH}×${FOVV}도`);

// ══ ① 거리 측정 ══════════════════════════════════════════════════════
head('[1] ★★★ **거리 측정** — 어디서 물어도 같은가');
{
  const eye = makeEye();
  console.log('   놓은 자리          되받은 자리                 어긋남');
  let worst = 0;
  for (const [az, el, d] of [[0, 0, 10], [9, 5, 90], [40, -20, 30], [-160, 12, 200], [175, -40, 5]]) {
    const s = seen(at(az, el, d), eye);
    const e = Math.max(Math.abs(wrap(s.az - az)), Math.abs(s.el - el), Math.abs(s.dist - d));
    worst = Math.max(worst, e);
    console.log(`   ${String(az).padStart(5)}° ${String(el).padStart(4)}° ${String(d).padStart(4)}m`
      + `   →  ${s.az.toFixed(2).padStart(7)}° ${s.el.toFixed(2).padStart(6)}° ${s.dist.toFixed(1).padStart(6)}m`
      + `   ${e.toExponential(1)}`);
  }
  ok(worst < 1e-9, `★★ 놓은 값이 **그대로 되돌아온다** (제일 큰 어긋남 ${worst.toExponential(1)})`);

  // ★★★ **가까울수록 커지던 어긋남이 없어졌나** — v93 의 8.5m 시차
  const near = seen(at(20, 10, 12), makeEye());
  ok(Math.abs(near.dist - 12) < 1e-9,
    '★★★ **12m 코앞에서도 정확하다** — v93 까지 표는 배 중심, 화면은 눈이라'
    + ' 30m 에서 16도가 어긋났다. 원점이 하나면 이 병이 **날 수가 없다**');
}

// ══ ② 자세를 틀어도 ══════════════════════════════════════════════════
head('[2] ★★ **기수를 틀어도 셈이 맞나** — 한 바퀴를 도는 배다');
{
  const p = at(30, 15, 80);
  let worst = 0;
  console.log('   기수(요/피치)   되받은 상대각        벗어난 각');
  for (const [y, q] of [[0, 0], [30, 15], [90, 0], [-120, -30], [179, 40]]) {
    const eye = { yaw: y, pitch: q, roll: 0 };
    const s = seen(p, eye);
    // 기수를 표적에 맞추면 상대각이 0 이라야 한다
    const aligned = seen(p, { yaw: 30, pitch: 15, roll: 0 });
    worst = Math.max(worst, Math.abs(aligned.off));
    console.log(`   ${String(y).padStart(5)}° ${String(q).padStart(4)}°`
      + `    ${s.az.toFixed(1).padStart(7)}° ${s.el.toFixed(1).padStart(6)}°`
      + `    ${s.off.toFixed(1).padStart(6)}°`);
  }
  ok(worst < 1e-9, '★★ 기수를 표적에 맞추면 **벗어난 각이 0** 이다 (어디를 보고 있었든)');
  const back = seen(at(170, 0, 60), makeEye());
  ok(back.behind && back.off > 90, `★ 뒤에 있는 것은 **뒤라고 말한다** (${back.off.toFixed(0)}도)`);
}

// ══ ③ 일관성 ═════════════════════════════════════════════════════════
head('[3] ★★★ **일관성** — 레이더가 말하는 자리 == 화면에 찍히는 자리');
{
  // 레이더가 말하는 것 = `seen()`. 화면 = `mark()`. 둘이 **같은 하나**에서 나온다
  const p = at(9, 5, 90);
  console.log('   롤     레이더(방위/고도)     화면(u,v)        되짚은 방위/고도   어긋남');
  let worst = 0;
  for (const roll of [0, 15, 30, 45, 90, -60]) {
    const eye = { yaw: 0, pitch: 0, roll };
    const s = seen(p, eye);
    const m = mark(s, FOVH, FOVV, eye);
    // 화면 자리를 **되짚어** 방위·고도로 돌린다 (롤을 벗기고 tan 을 푼다)
    const cr = Math.cos(-roll * Math.PI / 180), sr = Math.sin(-roll * Math.PI / 180);
    const u = m.u * cr - m.v * sr, v = m.u * sr + m.v * cr;
    const az2 = Math.atan(u * Math.tan(FOVH / 2 * Math.PI / 180)) * 180 / Math.PI;
    const el2 = Math.atan(v * Math.tan(FOVV / 2 * Math.PI / 180)) * 180 / Math.PI;
    const e = Math.max(Math.abs(wrap(az2 - s.az)), Math.abs(el2 - s.el));
    worst = Math.max(worst, e);
    console.log(`   ${String(roll).padStart(4)}°  ${s.az.toFixed(2).padStart(7)}° ${s.el.toFixed(2).padStart(6)}°`
      + `   ${m.u.toFixed(3).padStart(7)},${m.v.toFixed(3).padStart(7)}`
      + `   ${az2.toFixed(2).padStart(7)}° ${el2.toFixed(2).padStart(6)}°   ${e.toExponential(1)}`);
  }
  ok(worst < 1e-9,
    `★★★ **롤이 얼마든 둘이 같다** (제일 큰 어긋남 ${worst.toExponential(1)}) —`
    + ' 판을 굴리지 않고 **표식만** 굴리므로 글씨는 안 기운다 (v95)');
  // 뒤에 있는 것은 화면에 안 찍힌다
  ok(mark(seen(at(170, 0, 60), makeEye()), FOVH, FOVV, makeEye()) === null,
    '★ 뒤에 있는 것은 **화면에 안 찍는다** — 찍으면 반대쪽에 유령이 선다');
}

// ══ ④ 경로 ═══════════════════════════════════════════════════════════
head('[4] ★★★ **길에 있는 것이 맞는다** — 각도만 보면 코앞의 바위를 지난다');
{
  const eye = makeEye();
  const list = [
    { id: 'rock', p: at(0.6, 0.2, 18), size: 1 },   // 코앞. 살짝 비켜 있다
    { id: 'foe', p: at(0.1, 0.0, 120), size: 1 },   // 멀리. 한가운데
  ];
  const nearest = nearestToAim(list, eye);
  const first = firstOnPath(list, eye, 4);
  console.log(`   조준선에 제일 가까운 것: ${nearest.t.id} (${nearest.s.off.toFixed(2)}도)`);
  console.log(`   길에서 처음 만나는 것  : ${first.t.id} (${first.s.dist.toFixed(0)}m)`);
  ok(nearest.t.id === 'foe', '각도로만 고르면 **멀리 있는 적**이 뽑힌다 (여태 이랬다)');
  ok(first.t.id === 'rock', '★★★ 길로 고르면 **코앞의 바위**가 맞는다 — 탄은 직선으로 간다');
  ok(firstOnPath([{ id: 'far', p: at(30, 0, 50), size: 1 }], eye, 4) === null,
    '★ 조준선 굵기 밖은 길이 아니다');
  ok(firstOnPath([{ id: 'back', p: at(178, 0, 20), size: 1 }], eye, 4) === null,
    '★ 뒤에 있는 것도 길이 아니다');
}

// ══ ⑤ 락온 ═══════════════════════════════════════════════════════════
head('[5] ★★★ **락온** — 묶기 · 유지 · 놓기가 다른가 · 따라가는가');
{
  console.log(`   묶기 ${LOCK.lockCone}도 · 유지 ${LOCK.gimbal}도 · 외삽 ${LOCK.grace}초`
    + ` · 따라가는 속도 ${LOCK.slew}도/초`);
  const eye = makeEye();
  const foe = { id: 1, p: at(3, 1, 90), size: 1 };
  const find = (id) => (id === foe.id ? foe : null);
  const L = makeLock();
  let t = 0, ev = null;
  while (t < LOCK.lockFor + 0.5 && ev !== 'lock') {
    ev = stepLock(L, DT, nearestToAim([foe], eye), find, eye);
    t += DT;
  }
  ok(ev === 'lock', `★ ${LOCK.lockFor}초 겨누면 **묶인다** (${t.toFixed(1)}초)`);

  // 적이 기동해서 조준선 밖으로 — 유지 각 안이면 안 놓는다
  foe.p = at(24, 8, 90);
  let held = 0, e2 = null;
  while (held < 6 && e2 !== 'break') { e2 = stepLock(L, DT, nearestToAim([foe], eye), find, eye); held += DT; }
  const s = seen(foe.p, eye);
  ok(e2 !== 'break' && L.id === 1,
    `★★★ 조준선(${LOCK.lockCone}도) 밖 **${s.off.toFixed(0)}도에서 6초를 버텨도 안 놓는다**`);
  ok(lagOf(L, s) < 1,
    `★★ 표식이 **따라붙었다** (벗어남 ${lagOf(L, s).toFixed(2)}도) —`
    + ' 사장님 「약간 느리게 따라갈 수는 있지만 위치가 완전 다르잔아」');

  // 갑자기 크게 튀면 — **바로는 못 따라간다** (그게 「약간 느리게」다)
  const L2 = makeLock();
  L2.id = 1; L2.grace = LOCK.grace; L2.atAz = 0; L2.atEl = 0;
  foe.p = at(30, 0, 90);
  stepLock(L2, DT, null, find, eye);
  const lag1 = lagOf(L2, seen(foe.p, eye));
  ok(lag1 > 1 && lag1 < 30,
    `★ 한 프레임에 **다 못 붙는다** (아직 ${lag1.toFixed(1)}도) — 즉각 붙으면 계기가 아니라 자석이다`);

  // 유지 각 밖으로 나가면 잠깐 버티다 놓는다
  foe.p = at(70, 0, 90);
  let g = 0, e3 = null;
  while (g < LOCK.grace - 0.1 && e3 !== 'break') { e3 = stepLock(L, DT, null, find, eye); g += DT; }
  ok(e3 !== 'break', `★ ${LOCK.gimbal}도 밖에서도 **${LOCK.grace}초는 외삽한다**`);
  while (g < LOCK.grace + 0.4 && e3 !== 'break') { e3 = stepLock(L, DT, null, find, eye); g += DT; }
  ok(e3 === 'break' && L.id === null, '★ 오래 벗어나면 **놓는다**');
}

// ══════════════════════════════════════════════════════════════════════════
//  [6] ★★★ **두 입구가 갈라지지 않나** (v98 — 게임에 갈아 끼우면서)
//
//  ★ 이 저장소의 표(`target.js`)는 자리를 **각+거리**로 적는다. 그래서
//    `frame.js` 에 입구가 둘이 됐다 — 자리로 묻는 `seen()` 과 각으로 묻는
//    `relOf()`. **입구가 둘이면 반드시 갈라진다**가 이 파일의 전제이므로,
//    여기서 그 둘이 **같은 것인지**를 못박아 둔다.
//
//  ★★ v98 에 실제로 갈라뜨릴 뻔했다: `relOf` 를 처음엔 「빼기」로 썼는데
//    (`az−yaw`, `el−pitch`), 카메라가 요→피치 순서로 돌기 때문에 **기수를
//    들면 방위까지 밀린다.** 정면에서만 맞고 옆으로 갈수록 벌어지는,
//    **제일 안 잡히는 종류**의 어긋남이었다. 이 절이 그때 울었다
// ══════════════════════════════════════════════════════════════════════════
{
  head('[6] 각으로 묻든 자리로 묻든 — **같은 답인가**');
  // 정면만 보면 안 잡힌다 (빼기도 정면에서는 맞는다). **기수를 들고 옆을 본다**
  const EYES = [
    { yaw: 0, pitch: 0, roll: 0 },
    { yaw: 35, pitch: 0, roll: 0 },
    { yaw: 0, pitch: 22, roll: 0 },
    { yaw: -140, pitch: -18, roll: 12 },
    { yaw: 170, pitch: 30, roll: 0 },
  ];
  const TS = [
    { az: 0, el: 0, dist: 100 }, { az: 40, el: 25, dist: 80 },
    { az: -120, el: -30, dist: 210 }, { az: 179, el: 12, dist: 60 },
    { az: 62, el: -40, dist: 150 },
  ];
  let worst = 0, worstD = 0;
  for (const eye of EYES) {
    for (const t of TS) {
      const a = relOf(t, eye);                 // 각으로 물었다
      const b = seen(pointOf(t), eye);         // 자리로 물었다
      worst = Math.max(worst, Math.abs(wrap(a.az - b.az)), Math.abs(a.el - b.el), Math.abs(a.off - b.off));
      worstD = Math.max(worstD, Math.abs(a.dist - b.dist));
    }
  }
  ok(worst < 1e-9, `★★★ 각으로 묻든 자리로 묻든 **같은 답** (제일 벌어진 것 ${worst.toExponential(1)}도)`);
  ok(worstD < 1e-9, `★ 거리도 같다 (${worstD.toExponential(1)}m)`);

  // ★★ **빼기로는 안 맞는다**를 같이 못박는다 — 이 절이 왜 있는지가 여기다.
  //   이게 ✔ 여야 「그냥 빼도 되잖아」로 다음에 또 안 돌아간다
  const eye = { yaw: 0, pitch: 25, roll: 0 };
  const t = { az: 60, el: 20, dist: 100 };
  const naive = Math.hypot(wrap(t.az - eye.yaw), t.el - eye.pitch);
  const real = seen(pointOf(t), eye).off;
  ok(Math.abs(naive - real) > 3,
    `★★ 그냥 빼면 ${naive.toFixed(1)}도, 제대로 재면 ${real.toFixed(1)}도 —`
    + ' **기수를 들면 갈라진다.** 정면에서만 맞는 셈은 제일 안 잡힌다');

  // 표적을 놓는 자리(3D)와 재는 자리가 같은 함수인가 — v98 에 `targets.js`
  // 가 갖고 있던 식을 `pointOf` 로 옮겼다. 반대로 풀어서 돌아오나 본다
  const p = pointOf({ az: 47, el: -19, dist: 133 });
  const back = seen(p, makeEye());
  ok(Math.abs(wrap(back.az - 47)) < 1e-9 && Math.abs(back.el + 19) < 1e-9
    && Math.abs(back.dist - 133) < 1e-9,
  '★★ 3D 에 놓은 자리를 다시 재면 **표에 적힌 그 각**이 나온다 (창밖 == 계기)');
}

console.log(bad ? `\n✘ ${bad} 개가 안 맞습니다` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
console.log(`
  ※ **「싸우는 맛」은 여기서 안 나온다.** 여기서 나오는 것은
     「거리가 맞나 · 화면과 레이더가 같은가 · 락온이 따라가나」뿐이다.
     그 셋이 어긋나 있던 것이 사장님이 하루 종일 말씀하신 것이고,
     **뼈대를 하나로 만들면 그 셋은 어긋날 수가 없다.**`);
process.exit(bad ? 1 : 0);
