// 성장 **표** — 레벨이 오르면 무엇이 얼마나 오르는가, 방어도는 얼마나 막는가.
//
// ── 왜 갈라 놨는가 ──────────────────────────────────────────
// 이 식들은 player.js 와 combat.js 안에 흩어져 있었고, 두 파일 다 three 를
// 끌고 오므로 브라우저 밖에서 읽을 수 없었다. 그래서 밸런스를 볼 때마다
// 숫자를 손으로 옮겨 적었고, **옮겨 적은 표는 원본과 갈라진다.**
// (오늘 `?v=3` 과 `VERSION` 이 두 곳에 있어 스무 번 배포되는 동안 어긋나
//  있던 것과 같은 실패다.)
//
// 여기 있는 것은 전부 **순수 함수**다. 게임도 이걸 부르고 tools/sim.js 도
// 이걸 부른다 — 그래서 시뮬레이션 결과가 게임과 어긋날 수가 없다.

/** 레벨 1 기준값과 레벨당 증가분. 한 곳에서만 고친다. */
export const GROWTH = {
  hp: { base: 135, per: 18 },
  mp: { base: 60, per: 7 },
  armor: { base: 2, per: 1.2 },
  dmgMin: { per: 1.6 },        // **타격당이 아니라 초당이다** — perHit() 참조
  dmgMax: { per: 2.4 },
  crit: { base: 5 },
  critMult: { base: 1.8 },
  aspd: { per: 0.012 },
  mpRegen: { base: 3.2, per: 0.35 },
  xp: { first: 24, mul: 1.34, add: 8 },
};

/**
 * 평평한 피해(레벨 보너스·「+피해」 접사)를 **한 대당 얼마로 바꿀지.**
 *
 * 그냥 더하면 빠른 무기가 그 보너스를 더 자주 적용해서 계열 균형이
 * 레벨과 함께 무너진다. 9층에서 단검 92.5 대 대검 77.3 으로 21% 벌어져
 * 있었고, 원인은 무기 표가 아니라 이 한 줄이었다.
 *
 * **무기 속도로만 나눈다.** 최종 공격 속도로 나누면 「+공격 속도」 접사가
 * 스스로를 상쇄해서 아무 효과 없는 접사가 된다.
 */
export const perHit = (weaponSpeed) => 1 / (weaponSpeed || 1);

/**
 * 방어도 감쇠 — D3 계열의 쌍곡선. **절대 100% 가 안 된다.**
 *
 * 분모에 레벨이 들어가서, 같은 방어도라도 레벨이 오르면 덜 막는다.
 * 그래야 방어도가 층마다 계속 필요해진다.
 */
export function mitigate(raw, armor, level = 1) {
  const k = armor / (armor + 42 + level * 9);
  return Math.max(1, raw * (1 - k));
}

/** 그 레벨에 도달하는 데 드는 누적 경험치 */
export function xpToLevel(level) {
  let need = GROWTH.xp.first, total = 0;
  for (let l = 1; l < level; l++) {
    total += need;
    need = Math.round(need * GROWTH.xp.mul + GROWTH.xp.add);
  }
  return total;
}

/** 누적 경험치로 레벨을 되돌려 준다 — 시뮬이 층마다 레벨을 알아야 한다 */
export function levelAtXp(xp) {
  let lv = 1, need = GROWTH.xp.first, acc = 0;
  while (acc + need <= xp) { acc += need; lv++; need = Math.round(need * GROWTH.xp.mul + GROWTH.xp.add); }
  return lv;
}

/**
 * 적의 층 배수. **피해는 체력보다 빨리 오른다.**
 *
 * 셋 다 powerMult 를 그냥 곱했더니 층이 깊어져도 긴장이 안 올랐다 —
 * 「내가 죽는 시간 ÷ 적을 죽이는 시간」이 1층 8.8 · 9층 7.6 이었다.
 * 플레이어도 레벨과 장비로 같은 비율로 세지기 때문이다.
 *
 * 지수 1.24 면 1층은 그대로(1^1.24 = 1)이고 9층만 4.60 → 6.9 다 —
 * **초반은 안 건드리고 후반만 조인다.**
 */
export const DMG_EXP = 1.24;
export const enemyDmgMult = (powerMult) => Math.pow(powerMult, DMG_EXP);

/**
 * 전 종족 체력 배수.
 *
 * 1.3 이었다 — 「한 마리씩 끌어와 오래 싸운다」는 예전 설계의 값이고,
 * 그때는 그게 맞았다. 지금 목적은 반대다: 잡몹 하나가 **1.5~3초**에 죽고
 * 그 사이가 촘촘해야 한다 (docs/GRIND.md §2). 실측 TTK 가 5~9초였으므로
 * 0.5 로 내려 2~3.5초로 맞춘다.
 *
 * **개체 체력을 내린 만큼 마릿수를 올린다** (enemies.js 스폰). 층 전체의
 * 체력 총량은 오히려 늘어나므로 「쉬워진다」가 아니라 「촘촘해진다」다.
 */
export const HP_SCALE = 0.5;

/** 아이템 롤 배율 — 층과 티어가 깊을수록 값이 커진다.
 *  회차 몫을 0.3 → 0.55 로 올린다. 회차가 곱셈이 된 만큼 장비도 따라와야 한다. */
export const itemScale = (floorNo, tier = 0) => 1 + (floorNo - 1) * 0.42 + tier * 0.55;

// ── 회차(tier) — **끝을 없애는 축** ─────────────────────────
//
// 예전에는 `powerMult + tier × 0.35` 였다. 덧셈이라, 9층(4.60)을 깨고
// 2회차 1층으로 넘어가면 배수가 **1.35 로 뚝 떨어졌다.** 아홉 층을 올라온
// 캐릭터가 갑자기 세 배 약한 적을 만나는 셈이라, 「더 깊이」가 아니라
// 「처음부터 다시, 그런데 시시하게」가 됐다.
//
// 곱셈으로 바꾼다. 1.55 를 고른 이유: 한 회차가 층 아홉 개(1.00 → 4.60,
// 4.6배)를 통째로 덮으면 2회차 1층이 1회차 9층과 똑같아져서 **회차를 넘는
// 맛이 없다.** 1.55 면 2회차 1층이 1회차 3층쯤이고 2회차 5층에서 1회차
// 9층을 넘어선다 — 잠깐 숨을 고르고 곧 더 깊어진다.
//
// **주의: 이 곱셈은 무한이지만 플레이어의 성장은 아직 유한하다.**
// 지금 플레이어가 세지는 길은 레벨과 장비뿐이고 둘 다 회차에 선형이다.
// 그래서 3~4회차부터는 벽에 부딪힌다. 그 벽을 뚫는 것이 강화·재련(E)과
// 무한 성장(F)이고, 그때까지는 **부딪히는 게 정상이다** (docs/GRIND.md §8).
export const TIER_POWER = 1.55;
export const tierPower = (floorMult, tier = 0) => floorMult * Math.pow(TIER_POWER, tier);
