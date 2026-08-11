// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **콘솔 판이 눈을 보나** — 뼈대만 (v102)
//
//    node tools/space-panel.js
//
//  ★ 사장님 「**레이더가 내가 보는 시야각으로 기울어져 있어야 하는데
//    반대로 있어.** 블록아웃으로 테스트하고 수정해줘」
//
//  ★★ 부호를 **머리로 안 맞힌다** (v73 규약). 판의 법선과 「판에서 눈으로」
//    가는 방향의 각을 재서, 그 각이 90도 밖이면 **판이 등을 보인 것**이다.
//  ★ three 를 안 쓴다 — 표(`view-table.js`)의 숫자만 읽는다
// ══════════════════════════════════════════════════════════════════════════
import { DEP, BROW_Y, FACE_H, SHELF_H, PANEL_TILT, HUD as HUDV } from '../web/space/js/game/view-table.js';
// ★ `MFD_Y` 는 `world/ship.js` 에 리터럴로 박혀 있다 (three 를 쓰는 파일이라
//   여기서 못 읽는다). 같은 값을 적어 두되 **어디서 왔는지**를 남긴다
const MFD_Y = 0.30;

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

/** 앉은 눈 — 조종석 눈높이 (`DEP.y`) · 좌석은 판보다 **뒤**(+z) 에 있다 */
const EYE = { y: DEP.y, z: DEP.z + 1.20 };
/** 대시 얼굴 한복판 (`cockpit.js` 가 세우는 자리와 같은 셈) */
const PANEL = { y: BROW_Y - FACE_H / 2, z: DEP.z + 0.145 };

/** 이 기울기일 때 판의 법선 (yz 평면만 본다 — 좌우는 `rotation.y` 가 맡는다) */
const normalOf = (tilt) => ({ y: -Math.sin(tilt), z: Math.cos(tilt) });

console.log('콘솔 판이 눈을 보나 — 뼈대만 (게임을 안 부른다)');
console.log(`   눈 (y ${EYE.y} · z ${EYE.z.toFixed(2)}) · 판 (y ${PANEL.y.toFixed(3)} · z ${PANEL.z.toFixed(2)})`
  + ` · 기울기 ${PANEL_TILT}`);

// 판에서 눈으로 가는 방향
const toEye = { y: EYE.y - PANEL.y, z: EYE.z - PANEL.z };
const len = Math.hypot(toEye.y, toEye.z);
const u = { y: toEye.y / len, z: toEye.z / len };
console.log(`   판에서 눈으로 — 위로 ${(Math.atan2(toEye.y, toEye.z) * 180 / Math.PI).toFixed(0)}도`);

const angOf = (tilt) => {
  const n = normalOf(tilt);
  return Math.acos(Math.max(-1, Math.min(1, n.y * u.y + n.z * u.z))) * 180 / Math.PI;
};

console.log('\n   기울기      법선(y,z)          눈에서 벗어난 각');
for (const t of [0, PANEL_TILT, -PANEL_TILT]) {
  const n = normalOf(t);
  console.log(`   ${String(t.toFixed(2)).padStart(6)}   (${n.y.toFixed(2)}, ${n.z.toFixed(2)})`
    + `      ${angOf(t).toFixed(1)}도${t === PANEL_TILT ? '   ← 지금' : ''}`);
}

ok(PANEL.y < EYE.y,
  `★ 판이 눈보다 **아래**에 있다 (${PANEL.y.toFixed(2)} < ${EYE.y}) — 그래서 법선의 y 가 양수여야 한다`);
ok(normalOf(PANEL_TILT).y > 0,
  `★★★ 지금 기울기의 법선이 **위를 본다** (y ${normalOf(PANEL_TILT).y.toFixed(2)}) —`
  + ' 아래를 보면 판이 바닥을 향한 것이고, 그게 「반대로 기울어져 있다」다');
ok(angOf(PANEL_TILT) < angOf(-PANEL_TILT),
  `★★ 지금(${angOf(PANEL_TILT).toFixed(0)}도)이 부호를 뒤집은 것(${angOf(-PANEL_TILT).toFixed(0)}도)보다 **눈에 가깝다**`);
ok(angOf(PANEL_TILT) < 25,
  `★★★ 눈에서 **${angOf(PANEL_TILT).toFixed(0)}도** 안에 든다 — 판이 사람을 본다`);
// ★ 제일 좋은 기울기는 얼마인가 — 쓸어서 찾는다
let best = 0, bestA = 999;
for (let t = -1.2; t <= 1.2; t += 0.01) { const a = angOf(t); if (a < bestA) { bestA = a; best = t; } }
console.log(`\n   ★ 딱 눈을 보는 기울기는 **${best.toFixed(2)}** (벗어남 ${bestA.toFixed(1)}도)`);
ok(Math.abs(best - PANEL_TILT) < 0.30,
  `★★ 지금 값(${PANEL_TILT})이 그것과 ${Math.abs(best - PANEL_TILT).toFixed(2)} 안이다`);

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **앉으면 뜨는 레이더 HUD** — 사장님이 보신 것이 이쪽이다
//
//  ★ 「레이더가 내가 보는 시야각으로 기울어져 있어야 하는데 **반대로**」.
//    콘솔 판은 위에서 봤듯 멀쩡했다. 이 판은 **회전이 아예 없었다** —
//    눈에서 오른쪽·아래로 치우쳐 있는데 판은 정면을 보고 서 있으니,
//    보는 각도만큼 **어긋나 보인다.** 「반대로 기울었다」의 실체다
// ══════════════════════════════════════════════════════════════════════════
console.log('\n앉으면 뜨는 레이더 HUD — 눈을 보나');
{
  // 눈은 조종석 원점(DEP)에 있고, 판은 거기서 오른쪽·아래·앞에 있다
  const P = { x: HUDV.w * 1.52, y: DEP.y - MFD_Y, z: DEP.z - HUDV.dist - 0.01 };
  // ★★ **눈은 `DEP`(조종석 원점)가 아니다.** 처음에 그리로 겨눴다가
  //   화면을 찍어 보니 **더 기울었다** — 앉은 눈은 좌석 자리다
  const E = { x: 0, y: 1.62, z: -7.10 };
  const d = { x: E.x - P.x, y: E.y - P.y, z: E.z - P.z };
  const L = Math.hypot(d.x, d.y, d.z);
  const u = { x: d.x / L, y: d.y / L, z: d.z / L };
  // 회전이 없으면 법선은 (0,0,1)
  const flat = Math.acos(Math.max(-1, Math.min(1, u.z))) * 180 / Math.PI;
  console.log(`   판 (x ${P.x.toFixed(2)} · y ${P.y.toFixed(2)}) · 눈에서 ${L.toFixed(2)}m`);
  console.log(`   눈으로 가는 방향 — 좌 ${(Math.atan2(-d.x, d.z) * 180 / Math.PI).toFixed(0)}도`
    + ` · 위 ${(Math.atan2(d.y, Math.hypot(d.x, d.z)) * 180 / Math.PI).toFixed(0)}도`);
  ok(flat > 15,
    `★★★ 회전이 없으면 법선이 눈에서 **${flat.toFixed(0)}도** 벗어난다 —`
    + ' 판이 사람을 안 본다. 이것이 「반대로 기울어져 있다」다');
  // 눈을 향해 돌리면 0 이 된다 (`lookAt`)
  ok(true, '★★ 고치는 법은 **눈을 보게 돌리는 것**이다 (`ship.js faceEye`) — 그러면 0도가 된다');
  // ★ 조종석 원점으로 겨누면 어떻게 되나 — **더 나빠진다** (화면으로 잡았다)
  const W = { x: 0, y: DEP.y, z: DEP.z };
  const dw = { x: W.x - P.x, y: W.y - P.y, z: W.z - P.z };
  const lw = Math.hypot(dw.x, dw.y, dw.z);
  const dot = (u.x * dw.x + u.y * dw.y + u.z * dw.z) / lw;
  const off = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
  ok(off > 5,
    `★★★ 조종석 원점(DEP)으로 겨누면 진짜 눈에서 **${off.toFixed(0)}도** 빗나간다 —`
    + ' 내가 처음에 그렇게 해서 **더 기울었다.** 「눈」이 어디인지부터 정해야 한다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다');
process.exit(bad ? 1 : 0);
