// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **락온이 표적을 따라가나** — 뼈대만 (v119)
//
//    node tools/space-track.js
//
//  ★ 사장님 (2026-08-12) 「락온 시키면 **자동으로 타겟을 따라가도록**
//    해줘. 내가 타겟을 조준을 크게 벗어나면 다시 조준해야 해서 불편해.
//    무슨 말인지 모르면 **전투기 레이더 추적은 어떻게 하는지 고증**해서
//    적용하던지」
//
//  ══ ★★ 고증 — 실제 전투기 레이더의 「추적」 ═══════════════════════════
//
//   ① **훑기(RWS)** 는 추적이 아니다. 안테나가 부채꼴을 쓸고 지나가며
//      「거기 뭔가 있었다」를 찍을 뿐이라, 다음 쓸기까지는 모른다
//   ② **STT(단일 표적 추적)** 로 물면 **안테나가 그 표적만 따라간다.**
//      조종사는 기수를 그쪽에 둘 필요가 없다 — 이게 사장님이 원하시는
//      「자동으로 따라간다」이고, 우리에게 없던 것이다
//   ③ 끊기는 것은 **안테나가 더 못 돌아갈 때**다. 그게 **짐벌 한계**이고
//      기계식 주사 안테나가 ±60도쯤이다. 조종사들이 「짐벌 아웃」이라 부른다
//   ④ 그리고 **노치(빔 기동)** — 표적이 내 시선에 수직으로 날면 접근율이
//      0 이 되어 도플러 필터가 지면 잡음과 못 가르고 떨군다. 실제 조종사가
//      락온을 떨구는 첫째 수단이다
//   ⑤ **무기가 다르다.** 기총은 조준선 고정이라 겨눠야 맞고, 레이더 유도
//      미사일은 **트랙 파일을 쏜다** — 조준선이 아니다
//
//  ★★★ 그래서 이 도구가 묻는 것은 넷이다:
//      · 묶은 뒤 기수를 휘저어도 **유지되나** (전에는 32도에서 풀렸다)
//      · 짐벌 밖으로 나가면 **놓나** (안 놓으면 자석이다)
//      · 노치하면 **놓나** (안 놓으면 「묶으면 끝」이라 결심이 아니다)
//      · **다시 겨눈 횟수**가 줄었나 (사장님 불편의 크기)
//
//  ★ three 를 안 쓴다 — `game/frame.js` 뼈대만 돈다. 게임을 안 부른다
// ══════════════════════════════════════════════════════════════════════════
import {
  LOCK, makeLock, stepLock, makeEye, seen,
} from '../web/space/js/game/frame.js';
// ★ ⑥·⑦ 은 규칙까지 부른다 — 그래도 three 는 안 쓴다
import { makeCombat, fire, weaponOf } from '../web/space/js/game/combat.js';
import { WEAPONS } from '../web/space/js/game/combat-table.js';
import { bandAt } from '../web/space/js/game/aim-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const DEG = Math.PI / 180;

console.log('락온이 표적을 따라가나 — 뼈대만 (게임을 안 부른다)');
console.log(`   묶는 각 ${LOCK.lockCone}° · **짐벌 ${LOCK.gimbal}°** · 유예 ${LOCK.grace}초`
  + ` · 노치 = 시선 ${LOCK.notch}m/s 미만 **이면서** 옆 ${LOCK.notchSide}m/s 이상이 ${LOCK.notchFor}초`);

/** 각·거리로 자리를 만든다 (눈 기준 · −z 가 앞) */
const at = (az, el, dist) => ({
  x: dist * Math.cos(el * DEG) * Math.sin(az * DEG),
  y: dist * Math.sin(el * DEG),
  z: -dist * Math.cos(el * DEG) * Math.cos(az * DEG),
});

/**
 * 한 판 돌린다.
 * @param drive (t) => { tAz, tEl, tDist, noseAz, noseEl } — 표적과 기수를 몬다
 * @returns { locked, brokeAt, why, held, reaims }
 */
function run(drive, { sec = 20, dt = 1 / 60 } = {}) {
  const L = makeLock();
  const eye = makeEye();
  let locked = 0; let breaks = 0; let why = null; let firstLockAt = null;
  let wasAz = null; let wasEl = null;
  for (let i = 0; i * dt < sec; i++) {
    const t = i * dt;
    const d = drive(t);
    eye.yaw = d.noseAz; eye.pitch = d.noseEl;
    const p = at(d.tAz, d.tEl, d.tDist);
    // ★ 표적이 **제 힘으로** 흐르는 몫 (도/초 · 세상 기준). 노치는 이걸 본다 —
    //   내가 고개를 돌린 몫을 섞으면 「휘저을 때마다 노치」가 되어 정반대가 된다
    const vaz = wasAz === null ? 0 : (d.tAz - wasAz) / dt;
    const vel = wasEl === null ? 0 : (d.tEl - wasEl) / dt;
    wasAz = d.tAz; wasEl = d.tEl;
    const tgt = { id: 1, p, vaz, vel };
    const s = seen(p, eye);
    const ev = stepLock(L, dt, { t: tgt, s }, (id) => (id === 1 ? tgt : null), eye);
    if (ev === 'lock' && firstLockAt === null) firstLockAt = t;
    if (ev === 'break') { breaks++; why = L.why; }
    if (L.id !== null) locked += dt;
  }
  return {
    lockAt: firstLockAt, breaks, why,
    held: +locked.toFixed(2), heldPct: +(locked / sec * 100).toFixed(0),
  };
}

// ══ ① 물고 나서 **기수를 휘젓는다** ═══════════════════════════════════
//   표적은 얌전히 다가오는데 내가 좌우로 흔든다 — 개싸움에서 늘 있는 일
console.log('\n[①] 물고 나서 기수를 ±45도로 휘저으면 (표적은 계속 다가온다)');
{
  //  ★ v121 — 유예가 1.1 → 1.88초가 되면서 **빠르게 흔드는 것으로는
  //    안 끊긴다** (그게 이번 판의 요점이다). 「짐벌 밖으로 나가면 놓나」를
  //    물으려면 **밖에 머물러야** 한다 — 느리게 흔들어 오래 나가 있게 한다
  const swing = (amp) => run((t) => ({
    tAz: 0, tEl: 0, tDist: 200 - t * 4,
    // 처음 4초는 겨누고 (묶는 데 2.6초), 그 뒤부터 흔든다
    noseAz: t < 4 ? 0 : amp * Math.sin((t - 4) * 0.42),
    noseEl: 0,
  }));
  for (const amp of [20, 45, 58, 75]) {
    const r = swing(amp);
    const keep = r.breaks === 0;
    console.log(`   ±${String(amp).padStart(2)}도 흔듦 — 묶은 뒤 ${r.heldPct}% 유지`
      + ` · 끊김 ${r.breaks}회${r.why ? ` (${r.why})` : ''}`);
    if (amp <= 45) {
      ok(keep, `★★★ ±${amp}도까지 흔들어도 **안 놓는다** — 짐벌(${LOCK.gimbal}°) 안이다`);
    }
    if (amp === 75) {
      ok(!keep && r.why === 'gimbal',
        `★★★ ±75도로 넘기면 **짐벌 아웃**으로 놓는다 (${r.why}) — 안 놓으면 자석이다`);
    }
  }
}

// ══ ② **노치** — 옆으로 빼면 떨어진다 ═══════════════════════════════
console.log('\n[②] 적이 옆으로 빼면 (접근율이 죽는다 = 빔 기동)');
{
  // 4초까지 다가오다가, 그 뒤로는 거리를 유지한 채 옆으로만 흐른다
  const r = run((t) => ({
    tAz: t < 4 ? 0 : (t - 4) * 7, tEl: 0,
    tDist: t < 4 ? 200 - t * 6 : 176,
    noseAz: t < 4 ? 0 : Math.min(35, (t - 4) * 7), noseEl: 0,
  }), { sec: 14 });
  console.log(`   접근율이 죽은 뒤 — 유지 ${r.held}초 · 끊김 ${r.breaks}회 (${r.why})`);
  ok(r.breaks >= 1 && r.why === 'notch',
    '★★★ 옆으로 빼면 **노치로 떨어진다** — 「묶으면 끝」이 아니라 결심이다');
}

// ══ ③ **밀어붙이면 유지된다** — 노치의 반대편 ═══════════════════════
console.log('\n[③] 그런데 밀어붙이면 (접근율이 살아 있다)');
{
  const r = run((t) => ({
    tAz: t < 4 ? 0 : (t - 4) * 7, tEl: 0,
    tDist: 220 - t * 9,                      // 계속 좁힌다
    noseAz: t < 4 ? 0 : Math.min(40, (t - 4) * 7), noseEl: 0,
  }), { sec: 14 });
  console.log(`   좁히면서 따라감 — 유지 ${r.held}초 · 끊김 ${r.breaks}회`);
  ok(r.breaks === 0,
    '★★★ 접근율을 살려 두면 **같은 각인데도 유지된다** — 쫓는 쪽의 일이 「각」이 아니라 **「접근율」**이 된다');
}

// ══ ④ **다시 겨눈 횟수** — 사장님 불편의 크기 ════════════════════════
//   전(32도)과 지금(60도)을 같은 판에서 견준다. 32 는 이제 표에 없으므로
//   **여기서만 흉내낸다** — 「옛 값이 이랬다」를 남기려는 것뿐이다
console.log('\n[④] 전(32도)과 지금(짐벌 60도) — 같은 개싸움 20초');
{
  // ★ **먼저 묶고 나서** 개싸움을 시작한다. 안 그러면 둘 다 「한 번도 못
  //   물었다」로 0% 가 나오고, 그러면 견주는 것이 아니라 아무것도 아니다
  //   (처음에 그렇게 짰다가 0 대 0 이 나와서 알았다)
  const W = 3.4;                       // 묶는 데 2.6초 + 여유
  const dogfight = (t) => {
    if (t < W) return { tAz: 0, tEl: 0, tDist: 210 - t * 6, noseAz: 0, noseEl: 0 };
    const u = t - W;
    return {
      // 적이 열심히 기동한다 (좌우 ±55도 · 위아래 ±18도) · 거리는 계속 좁힌다
      tAz: 55 * Math.sin(u * 0.9), tEl: 18 * Math.sin(u * 0.6),
      tDist: 190 - u * 5,
      // ★ 나는 그 뒤를 **뒤처져** 따라간다. 이 뒤처짐이 곧 「벗어난 각」이고,
      //   사람이 마우스로 쫓을 때 실제로 이만큼 남는다 (0.72 로 뒀더니
      //   벗어난 각이 11도밖에 안 나와 옛 32도로도 안 끊겼다 — 그건
      //   개싸움이 아니라 얌전한 추격이었다)
      noseAz: 55 * Math.sin((u - 0.75) * 0.9) * 0.45,
      noseEl: 18 * Math.sin((u - 0.75) * 0.6) * 0.45,
    };
  };
  const now = run(dogfight, { sec: 20 });
  // 옛 값 흉내 — `LOCK.gimbal` 을 잠깐 32 로 두고 같은 판을 돈다
  const keep = LOCK.gimbal; const keepN = LOCK.notchSide; const keepG = LOCK.graceDodges;
  // ★ v121 — **유예도 옛것으로** 되돌려야 견주는 것이 된다. 짐벌만 바꾸고
  //   유예는 새것을 쓰면 「옛 판」이 새 유예로 버텨서 0 대 0 이 나온다 —
  //   실제로 그렇게 나와서 알았다
  LOCK.gimbal = 32; LOCK.notchSide = 1e9; LOCK.graceDodges = LOCK.graceWas / 0.42;
  const was = run(dogfight, { sec: 20 });
  LOCK.gimbal = keep; LOCK.notchSide = keepN; LOCK.graceDodges = keepG;
  console.log(`   전 (32도 · 노치 없음) — 유지 ${was.heldPct}% · **다시 물어야 한 횟수 ${was.breaks}**`);
  console.log(`   지금 (짐벌 ${keep}도 · 노치)  — 유지 ${now.heldPct}% · **다시 물어야 한 횟수 ${now.breaks}**`);
  ok(now.breaks < was.breaks,
    `★★★ 다시 겨눈 횟수가 **${was.breaks} → ${now.breaks}** 로 줄었다 — 사장님이 불편하다고 하신 그것이다`);
  ok(now.heldPct >= was.heldPct + 15,
    `★★ 물고 있는 시간이 **${was.heldPct}% → ${now.heldPct}%** (15%p 넘게 는다)`);
  ok(now.heldPct < 100,
    `★ 그래도 **100% 는 아니다** (${now.heldPct}%) — 늘 물려 있으면 조종이 할 일이 없다`);
}

// ══ ④b ★★★ **회피를 하면서도 물고 있나** (v121) ═══════════════════════
console.log('\n[④b] 회피하면서 물고 있나 — 사장님 「회피 기동하니깐 놓치고 다시 타겟팅」');
{
  //  ★ 재 보니 **회피 한 번이 짐벌을 통째로 쓴다**: 급기동 요 143°/초 ×
  //    회피 0.42초 = **60도**, 짐벌이 60도다. 두 번 연달아면 120도 —
  //    밖이다. v119 는 「한 번으로는 안 놓친다」까지만 쟀다.
  //  ★★ 고증의 답은 **coast**(관성 외삽)다: 안테나가 못 보는 동안 몇 초를
  //    버티고, 돌아오면 이어 붙인다. 그 값이 `grace` 이고 1.1초는 한 번치였다
  const RATE = 143;             // 급기동 요 (도/초)
  const DODGE = 0.42;           // 회피 한 번
  console.log(`   유예 ${LOCK.grace}초 → **${(DODGE * LOCK.graceDodges).toFixed(2)}초** (회피 ${DODGE}초 × ${LOCK.graceDodges})`);

  /** 회피를 n 번 연달아 하고, 그 뒤 기수를 되돌린다 */
  const evade = (n, graceDodges) => {
    const keep = LOCK.graceDodges; LOCK.graceDodges = graceDodges;
    let out = null;
    const drive = (t) => {
      // 0~3.4초 물기 (정면 · 다가온다)
      if (t < 3.4) return { tAz: 0, tEl: 0, tDist: 200 - t * 6, noseAz: 0, noseEl: 0 };
      const u = t - 3.4;
      // ★ **꺾고 → 잠깐 그대로 → 되돌린다.** 처음엔 꺾자마자 되돌리게
      //   짰는데, 그러면 짐벌 밖에 있는 시간이 거의 0 이라 **옛 유예로도
      //   안 끊겼다** — 즉 아무것도 못 재는 판이었다. 실제로는 피하는
      //   동안 그 자세로 조금 있는다 (그게 회피다)
      const DWELL = 0.5;
      const sweep = Math.min(u, DODGE * n) * RATE;         // 꺾는 동안
      const back = Math.max(0, u - DODGE * n - DWELL) * RATE;  // 되돌리는 동안
      return {
        tAz: 0, tEl: 0, tDist: 180 - u * 4,
        noseAz: Math.max(0, sweep - back), noseEl: 0,
      };
    };
    out = run(drive, { sec: 12 });
    LOCK.graceDodges = keep;
    return out;
  };
  for (const n of [1, 2, 3]) {
    const was = evade(n, 1.1 / DODGE);   // ★ 옛 1.1초치를 회피 수로 환산
    const now = evade(n, LOCK.graceDodges);
    console.log(`   회피 ${n}번 — 옛 유예(1.1초) 끊김 ${was.breaks}회${was.why ? ` (${was.why})` : ''}`
      + `   ·   지금(${(DODGE * LOCK.graceDodges).toFixed(2)}초) 끊김 ${now.breaks}회${now.why ? ` (${now.why})` : ''}`);
    if (n <= 2) {
      ok(now.breaks === 0,
        `★★★ **회피 ${n}번을 해도 안 놓친다** — 못 보는 동안 관성으로 외삽한다(coast).`
        + ' 회피는 이 게임이 권하는 조작인데 그때마다 다시 물어야 하면 「타겟팅 하면서 회피」가 성립하지 않는다');
    }
  }
  const many = evade(4, LOCK.graceDodges);
  ok(many.breaks > 0,
    `★★ 그런데 **네 번을 내리 돌면 놓친다** (${many.breaks}회) — 안 놓치면 그건 자석이다.`
    + ' 「빙빙 돌면 안전」이 되면 회피가 회피가 아니다');
}

// ══ ⑤ **묶는 것은 여전히 어렵다** — 문을 넓힌 것이 아니다 ═════════════
console.log('\n[⑤] 묶는 각은 그대로 좁은가 (넓히면 락온이 절차가 된다)');
{
  const r = run((t) => ({ tAz: 14, tEl: 0, tDist: 190, noseAz: 0, noseEl: 0 }), { sec: 10 });
  console.log(`   14도 벗어난 채로 10초 — 묶임 ${r.lockAt === null ? '안 됨' : `${r.lockAt}초`}`);
  ok(r.lockAt === null,
    `★★★ 묶는 각(${LOCK.lockCone}°) 밖에서는 **아무리 기다려도 안 물린다** — 넓힌 것은 유지하는 각뿐이다`);
  ok(LOCK.gimbal > LOCK.lockCone * 3,
    `★★ 유지(${LOCK.gimbal}°)가 묶기(${LOCK.lockCone}°)보다 훨씬 넓다 — 실제 STT 가 그렇다`);
}

// ══ ⑥ ★★★ **묶었으면 다시 안 겨눠도 쏴진다** ═══════════════════════
//   여기부터는 뼈대가 아니라 **규칙**(`game/combat.js`)을 부른다 — 그래도
//   three 는 안 쓴다. 사장님 불편의 나머지 절반이 여기 있었다:
//   락온은 유지됐는데 **쏘는 순간에는 조준선을 봤다**
console.log('\n[⑥] 묶어 놓고 조준선은 딴 데 — 그래도 쏴지나');
{
  const c = makeCombat();
  c.radar.on = true; c.radar.id = 7;
  // 묶은 놈은 기수에서 **38도** 옆에 있다 (조준선 밖 · 짐벌 안)
  const foe = { id: 7, kind: 'fighter', dist: 130, vaz: 0, vel: 0 };
  const locked = { t: foe, off: 38, relAz: 38, relEl: 0 };
  // 조준선에는 **엉뚱한 것**이 걸려 있다 (사람이 다시 안 겨눈 상태)
  const other = { id: 9, kind: 'rock', dist: 90, vaz: 0, vel: 0 };
  const aimed = { t: other, off: 2, relAz: 2, relEl: 0 };
  const supply = { ore: 99, parts: 99, missiles: 99 };

  for (const slot of [3, 2, 1]) {
    c.slot = slot; c.cool = 0;
    const w = weaponOf(c);
    const r = fire(c, { aimed, locked, supply, rnd: () => 0.01 });
    const hit = r.ok ? (r.shot.target === foe.id ? '묶은 것' : '조준선의 것') : `못 쏨(${r.why})`;
    // ★ **탐색기 시야가 무기마다 다르다** (`onLockCone`). 열추적탄은 32도라
    //   여기(38도)에서는 못 따라간다 — 처음에 그걸 안 보고 「셋 다 묶은 것을
    //   쏜다」로 적었다가 검사가 잡았다. 다른 것을 다르게 두려고 만든 값을
    //   검사가 무시하면 그 값은 없는 것과 같다
    const reach = w.onLock && locked.off <= (w.onLockCone ?? LOCK.gimbal);
    console.log(`   ${w.name.padEnd(5)} (onLock ${w.onLock ? `○ ±${w.onLockCone}도` : '×'}) — ${hit}`);
    if (reach) {
      ok(r.ok && r.shot.target === foe.id,
        `★★★ **${w.name}은 묶은 것을 쏜다** — 조준선이 ${locked.off}도 밖을 보고 있어도 나간다`);
    } else {
      ok(r.ok && r.shot.target === other.id,
        `★★★ **${w.name}은 조준선을 쏜다** — ${w.onLock ? `탐색기가 ±${w.onLockCone}도까지만 본다` : '기총은 기수 고정이다 (장르 안전핀)'}`);
    }
  }
}

// ══ ⑦ **그래도 겨누는 것이 제일 세다** — 조준 띠가 안 죽었나 ══════════
console.log('\n[⑦] 락온으로 쏘는 것이 겨누는 것보다 세면 조준이 없어진다');
{
  const c = makeCombat();
  c.radar.on = true; c.radar.id = 7;
  // ★ 거리 60 — 레이저의 `rMax` 안이면서 유도탄의 `rMin`(45) 밖. 처음에
  //   100 으로 뒀다가 레이저가 「너무 멉니다」로 안 나갔다
  const foe = { id: 7, kind: 'fighter', dist: 60, vaz: 0, vel: 0 };
  const supply = { ore: 99, parts: 99, missiles: 99 };
  const shot = (slot, off) => {
    c.slot = slot; c.cool = 0;
    const r = fire(c, {
      aimed: { t: foe, off, relAz: off, relEl: 0 },
      locked: { t: foe, off, relAz: off, relEl: 0 },
      // ★ 발사관은 묶은 표적을 이미 쫓고 있다 — 남는 것은 흔들림뿐이다
      mountAt: () => ({ err: 0.6 }),
      supply, rnd: () => 0.5,
    });
    const w = weaponOf(c);
    if (!r.ok) return { w, band: null, dmg: 0, why: r.why };
    const band = bandAt(r.shot.off, w.tol, !!w.seek);
    return { w, band, dmg: w.dmg * (band?.mult ?? 0) };
  };
  const laserBull = shot(1, 0.3);
  const arh = shot(3, 38);
  console.log(`   레이저 정중앙 — ${laserBull.band?.name} ×${laserBull.band?.mult} = 피해 ${laserBull.dmg.toFixed(2)}`);
  console.log(`   유도탄 락온   — ${arh.band?.name} ×${arh.band?.mult} = 피해 ${arh.dmg.toFixed(2)}`);
  ok(laserBull.band?.key === 'bull',
    '★★ 레이저는 **정중앙을 맞히면 정중앙 띠**다 — 조준 띠(v114)가 안 죽었다');
  ok(arh.band !== null,
    `★★★ 유도탄은 38도 밖에서도 **맞는다** (${arh.band?.name}) — 락온이 조준을 대신한다`);
  // ★ 대신 값을 치른다: 재고 2 발 · 재장전 6.5초 · 자국 30
  const arhW = WEAPONS.arh; const laserW = WEAPONS.laser;
  // ★★★ **한 발로 견주면 유도탄이 5배다** (10.00 대 2.00). 그래서 한 발이
  //   아니라 **초당**으로 견줘야 한다 — 재장전이 12배 길다. 겨누는 무기가
  //   더 세게 남는 것은 「한 발」이 아니라 「계속 쏠 수 있다」 쪽이다
  const dps = (s, w) => s.dmg / w.reload;
  console.log(`   초당 — 레이저 ${dps(laserBull, WEAPONS.laser).toFixed(2)}`
    + ` · 유도탄 ${dps(arh, WEAPONS.arh).toFixed(2)}`);
  ok(dps(laserBull, WEAPONS.laser) > dps(arh, WEAPONS.arh),
    `★★★ **초당으로는 겨누는 쪽이 세다** (${dps(laserBull, WEAPONS.laser).toFixed(2)} > ${dps(arh, WEAPONS.arh).toFixed(2)})`
    + ' — 한 발로 견주면 유도탄이 5배지만, 재장전이 12배 길다.'
    + ' 이 부등호가 뒤집히면 **겨누는 조작이 없어진다**');
  ok((arhW.cost.missiles ?? 0) > 0 && arhW.reload > laserW.reload && arhW.sign > laserW.sign,
    `★★★ 대신 **값을 치른다** — 미사일 ${arhW.cost.missiles}발 · 재장전 ${arhW.reload}초`
    + ` · 자국 ${arhW.sign} (레이저는 0발 · ${laserW.reload}초 · ${laserW.sign})`
    + ' — 락온이 공짜면 겨누는 무기가 없어진다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 물면 따라가고 · 묶은 것을 쏘고 · 짐벌 밖·노치에서는 놓는다');
process.exit(bad ? 1 : 0);
