// 스킬 **표** — 마나·쿨·피해 배율·범위. **여기엔 연출이 없다.**
//
// ── 왜 갈라 놨는가 ──────────────────────────────────────────
// 이 숫자들은 skills.js 의 `cast()` 안에 박혀 있었다. skills.js 는 파티클과
// 소리를 끌고 오므로 브라우저 밖에서 못 읽고, 그러면 「연격과 가르기 중
// 무엇이 센가」를 코드를 눈으로 읽어 손으로 곱하는 수밖에 없었다.
// 실제로 그렇게 재다가 **연격 +60% 대 가르기 +6%** 를 오래 못 봤다.
//
// 게임도 이 표를 읽고 tools/sim.js 도 이 표를 읽는다 —
// 배율을 하나 바꾸면 「빌드 대 빌드」의 답이 같이 바뀐다.
// (item-table.js · growth-table.js · economy-table.js 와 같은 이유다.)
//
// ── 읽는 법 ─────────────────────────────────────────────────
//   dmg      평타 한 대(playerRoll)의 몇 배인가
//   radius   닿는 반경 (회전 베기는 부채꼴이라 spread 와 같이 본다)
//   field    남는 장판 — dps 는 (dmgMin+dmgMax) 의 몇 배인가
//
// 실제 쿨다운은 `cd × SKILL_CD_SCALE` 이다 (game/pace.js). 여기 적힌 것은
// **설계값**이고, 템포 조정은 pace.js 한 곳에서 한다.

export const SKILL_NUM = {
  cleave: {
    cost: 16, cd: 0.9,
    dmg: 1.35,
    radius: 3.5,
    spread: Math.PI * 0.78,      // 부채꼴 각. 「넓은 호」가 이 값을 곱한다
  },
  dash: {
    cost: 20, cd: 5,
    dmg: 1.1,                    // 돌진 중 스친 적
    window: 0.28,                // 스치는 판정이 열려 있는 시간
    decoyRadius: 1.1,
  },
  nova: {
    cost: 35, cd: 9,
    dmg: 2.2,
    radius: 6.4,
    field: { r: 0.72, life: 3.4, dps: 0.28 },   // r 은 radius 에 대한 비율
  },
  meteor: {
    cost: 60, cd: 22,
    dmg: 5.0,
    radius: 4.6,
    delay: 0.85,                 // 낙하 예고. 「조준」이 이 값을 줄인다
    falloff: 0.55,               // 가장자리에서 최대 이만큼 깎인다
    shard: { dmg: 1.2, at: 0.8, r: 0.55 },      // 「파편」이 켜는 작은 운석
    field: { r: 0.8, life: 2.6, dps: 0.3 },
  },
};

/** 「잔상」이 남긴 그림자를 밟은 적이 받는 피해 (skills.js updateDecoy) */
export const DECOY_DMG = 1.1;
