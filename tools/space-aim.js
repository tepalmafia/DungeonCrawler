// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **넓게 맞고, 가운데일수록 아프다** — 조준 띠 (v114 · 뼈대만)
//
//    node tools/space-aim.js
//
//  ★ 사장님 「**중앙 타겟 영역도 키우고 정확히 안쪽을 맞출 수록 데이미지가
//    들어가도록**」
//
//  ══ 이 검사가 묻는 것 ═══════════════════════════════════════════════
//
//   ① **문이 정말 넓어졌나** — 옛 각에서 빗나가던 것이 이제 스침인가
//   ② **안쪽이 정말 아픈가** — 손이 좋아질수록 피해가 **단조롭게** 오르나
//   ③ ★★★ **옛 저울을 안 깨뜨렸나** — 보통 손의 기대 피해가 그대로인가
//   ④ **유도탄이 조준을 안 먹었나** — 대충 쏜 유도탄이 정조준 레이저보다
//      아프면 겨누는 일이 없어진다
//   ⑤ **한 방에 안 죽나** — 물결이 성립하려면 여러 발이 들어가야 한다
//
//  ★ 게임을 안 부른다. 표(`aim-table.js`)와 표(`target-table.js`)만 읽는다
// ══════════════════════════════════════════════════════════════════════════
import { BANDS, TOL, SEEK, bandAt, multAt } from '../web/space/js/game/aim-table.js';
import { KINDS, TARGET, PARTS } from '../web/space/js/game/target-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

/** ★ 옛 규칙 — v113 까지의 값. **여기가 견주는 자리다** */
const WAS = { tol: 4.2, mult: 1.0 };

/**
 * ★★ **손 떨림 다섯 등급.** 조준 오차를 도 단위 표준편차로 준다.
 *   0.8 은 「가만히 붙어서 겨눈다」, 6.0 은 「기동하며 대충 갈긴다」
 */
const HANDS = [
  { name: '정조준', sd: 0.8 },
  { name: '잘 겨눔', sd: 1.8 },
  { name: '보통', sd: 3.2 },
  { name: '대충', sd: 5.0 },
  { name: '난사', sd: 8.0 },
];

/** 되풀이되는 난수 — 판마다 값이 흔들리면 「고쳤나」를 못 묻는다 */
let seed = 20260811;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
/** 정규분포 두 개를 합쳐 **평면 위의 벗어난 각** — 조준은 2차원이다 */
function offset(sd) {
  const u = Math.max(1e-9, rnd()), v = rnd();
  const g = Math.sqrt(-2 * Math.log(u));
  return Math.hypot(g * Math.cos(2 * Math.PI * v) * sd, g * Math.sin(2 * Math.PI * v) * sd);
}

const N = 40000;
/** 이 손·이 규칙으로 한 발의 기대 피해 */
function expect(sd, { tol, banded, seek = false }) {
  let sum = 0, hits = 0;
  for (let i = 0; i < N; i++) {
    const off = offset(sd);
    if (banded) {
      const m = multAt(off, tol, seek);
      if (m > 0) { sum += m; hits++; }
    } else if (off <= tol) { sum += WAS.mult; hits++; }
  }
  return { dmg: sum / N, hit: hits / N };
}

console.log('조준 띠 — 넓게 맞고, 가운데일수록 아프다 (뼈대만 · 게임을 안 부른다)');

console.log(`\n[0] 표가 말하는 것 — 허용 각 ${WAS.tol} → **${TOL}도** (표적 크기를 곱한다)`);
for (const b of BANDS) {
  console.log(`   ${b.name.padEnd(5)} 안쪽 ${(b.upTo * 100).toFixed(0).padStart(3)}%`
    + ` (~${(b.upTo * TOL).toFixed(1)}도) · 피해 ×${b.mult.toFixed(2)}`);
}

console.log('\n[1] ★★★ **문이 넓어졌나** — 옛 각 밖이 이제 무엇인가');
{
  const justOut = WAS.tol * 1.35;                   // 옛 규칙이면 빗나감
  const b = bandAt(justOut, TOL);
  ok(!!b, `옛 허용 각의 1.35배(${justOut.toFixed(1)}도)가 이제 **${b?.name ?? '빗나감'}** 이다`
    + ' — 빗나감은 아무것도 안 가르치지만 스침은 「조금 더 안쪽」을 가르친다');
  ok(!bandAt(TOL * 1.02, TOL),
    '★ 그래도 **문지방 밖은 진짜 빗나감**이다 — 끝이 없으면 조준이 아니다');
}

console.log('\n[2] ★★★ **손이 좋아질수록 아픈가** (단조로운가)');
{
  console.log('   손        맞는 비율(옛→새)      한 발 기대 피해(옛→새)   배수');
  const rows = HANDS.map((h) => {
    const was = expect(h.sd, { tol: WAS.tol, banded: false });
    const now = expect(h.sd, { tol: TOL, banded: true });
    console.log(`   ${h.name.padEnd(6)} ${(was.hit * 100).toFixed(0).padStart(3)}% → ${(now.hit * 100).toFixed(0).padStart(3)}%`
      + `        ${was.dmg.toFixed(3)} → ${now.dmg.toFixed(3)}`
      + `      ×${(now.dmg / Math.max(1e-9, was.dmg)).toFixed(2)}`);
    return { h, was, now };
  });
  let mono = true;
  for (let i = 1; i < rows.length; i++) if (rows[i].now.dmg >= rows[i - 1].now.dmg) mono = false;
  ok(mono, '★★★ **잘 겨눌수록 한 발이 아프다** — 다섯 등급이 내리 줄어든다'
    + ' (사장님 「정확히 안쪽을 맞출 수록 데이미지가」)');
  const tight = rows[0], loose = rows[3];
  ok(tight.now.dmg / loose.now.dmg >= 1.8,
    `★★ 정조준이 대충보다 **${(tight.now.dmg / loose.now.dmg).toFixed(1)}배** 아프다 (1.8배 이상)`
    + ` — 옛 규칙은 ${(tight.was.dmg / loose.was.dmg).toFixed(1)}배였다. 겨눌 값어치가 이만큼 늘었다`);
  // ★ 처음에 「모든 손에서 **올랐다**」로 적었다가 빨개졌다 — 정조준은
  //   옛 규칙에서도 이미 100% 라 **오를 자리가 없다.** 「안 내려갔고,
  //   내려가지 않은 만큼 어딘가는 올랐다」가 맞는 주장이다
  ok(rows.every((r) => r.now.hit >= r.was.hit) && rows.some((r) => r.now.hit > r.was.hit + 0.05),
    '★★ **맞는 비율이 아무 손에서도 안 내려갔고, 서툰 손일수록 크게 올랐다**'
    + ` (보통 ${(rows[2].was.hit * 100).toFixed(0)}% → ${(rows[2].now.hit * 100).toFixed(0)}%)`);

  // ══ ★★★ ③ 옛 저울 ═══════════════════════════════════════════════
  //  ★ 이 한 줄이 이 검사의 이유다. 「더 아프게」를 얹으면서 전투 길이를
  //    조용히 반으로 줄이면 v84 의 물결도 v110 의 파밍도 같이 어긋난다
  const mid = rows[2];
  const r = mid.now.dmg / mid.was.dmg;
  ok(r >= 0.85 && r <= 1.30,
    `★★★ **보통 손의 기대 피해가 ×${r.toFixed(2)}** (0.85~1.30) — 넓히고 깊게 팠는데도`
    + ' 전투 길이가 안 뒤집혔다. 이 저장소는 새 계통을 얹으며 옛 저울을'
    + ' 조용히 죽인 적이 여러 번 있다 (v107 · v111)');
}

console.log('\n[3] ★★ **유도탄이 조준을 안 먹었나**');
{
  const seekLoose = expect(5.0, { tol: TOL, banded: true, seek: true });
  const laserTight = expect(0.8, { tol: TOL, banded: true });
  console.log(`   대충 쏜 유도탄 ${seekLoose.dmg.toFixed(3)} · 정조준 레이저 ${laserTight.dmg.toFixed(3)}`);
  ok(seekLoose.dmg < laserTight.dmg,
    `★★★ 대충 쏜 유도탄이 정조준 레이저보다 **덜 아프다** (누름 ${SEEK})`
    + ' — 안 그러면 「겨눈다」가 「무기를 고른다」에 먹혀 없어진다');
  const seekTight = expect(0.8, { tol: TOL, banded: true, seek: true });
  ok(seekTight.dmg > seekLoose.dmg,
    '★ 그래도 **잘 겨눠 쏜 유도탄이 더 아프다** — 유도라고 조준이 죽으면 안 된다');
}

console.log('\n[4] ★★ **한 방에 안 죽나** — 물결이 성립하려면 여러 발이 든다');
{
  // ══ ★★★ 처음에 「아무것도 한 방에 안 죽는다」로 물었다가 틀렸다 ═══
  //  파편(맷집 1)·자폭정(1)은 **원래 한 방짜리**다 — 떠다니는 쓰레기와
  //  들이받는 소모품이라 그게 맞다. 물어야 하는 것은 「한 방짜리가
  //  **늘었나**」다. 안 변한 것을 재는 검사는 초록이어도 아무 말도 안 한다
  const partMax = Math.max(...Object.values(PARTS).map((p) => p.mult));
  const worst = Math.max(...BANDS.map((b) => b.mult)) * partMax;
  const wasWorst = WAS.mult * partMax;
  console.log(`   제일 아픈 한 발 — 옛 ${wasWorst.toFixed(2)} → 새 **${worst.toFixed(2)}**`
    + ` (띠 ${Math.max(...BANDS.map((b) => b.mult))} × 부위 ${partMax})`);
  const oneShot = (lim) => Object.values(KINDS).filter((v) => v.hits && v.hits <= lim).map((v) => v.name);
  const wasOne = oneShot(wasWorst), nowOne = oneShot(worst);
  console.log(`   한 방짜리 — 옛 [${wasOne.join(' · ')}] → 새 [${nowOne.join(' · ')}]`);
  ok(nowOne.length === wasOne.length,
    `★★★ **한 방에 죽는 것이 안 늘었다** (${wasOne.length} → ${nowOne.length})`
    + ' — 늘면 물결(`TARGET.wave`)이 성립을 안 한다. 파편과 자폭정이 한 방인 것은'
    + ' 옛날부터 그랬고, 떠다니는 쓰레기와 들이받는 소모품이라 그게 맞다');
  // ★ 처음에 「세 발 이상」이라고 적었다가 빨개졌다 — 보급 호송선(맷집 10)이
  //   최선의 연속이면 두 발이다. **최선을 잰 값에 세 발을 요구한 것이 틀렸다.**
  //   이 줄이 지켜야 하는 것은 「한 발로 안 끝난다」이지 발수 그 자체가 아니다
  const foes = Object.values(KINDS).filter((v) => v.hits >= 6);
  ok(foes.every((v) => Math.ceil(v.hits / worst) >= 2),
    `★★ **싸울 만한 것들은 정중앙+핵심을 연달아 맞혀도 두 발 이상** 든다`
    + ` (${foes.map((v) => `${v.name} ${Math.ceil(v.hits / worst)}발`).join(' · ')})`);
}

console.log('\n[5] ★ **큰 것이 여전히 맞히기 쉽나** — 띠는 비율이라 모양이 안 변한다');
{
  const big = TOL * (KINDS.sat?.size ?? 1);
  const small2 = TOL * (KINDS.tank?.size ?? 1);
  ok(big > small2, `위성 ${big.toFixed(1)}도 > 연료통 ${small2.toFixed(1)}도`);
  ok(bandAt(big * 0.2, big).key === bandAt(small2 * 0.2, small2).key,
    '★★ 같은 **비율**이면 큰 것도 작은 것도 같은 띠다 — 각으로 적었으면'
    + ' 큰 표적은 정중앙이 없고 작은 표적은 전부 정중앙이 됐다');
}

console.log(`\n   ※ 표적이 도는 속도(${TARGET.driftAz[1]}도/초)를 생각하면 정조준(0.8도)은`
  + '\n     붙어서 따라갈 때만 나온다 — 그게 「쫓아서 해낸다」와 물린다');
console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 넓어졌고, 안쪽이 아프고, 저울이 그대로입니다');
process.exit(bad ? 1 : 0);
