// ══════════════════════════════════════════════════════════════════════════
//  마주치는 것들 — **퀘스트가 아니다.**
//
//  이 게임에는 의뢰인이 없다. 사람이 없으니 「가서 이것을 해 오시오」라고
//  말해 줄 사람도 없다. 그냥 앞에 나타나고, 갈지 말지는 내가 정한다.
//  (조사와 각색의 근거는 `docs/space/MISSIONS.md`)
//
//  ★ 각색은 **거르는 일**이었다
//    같은 계열에서 호평받은 미션을 찾아보니 절반이 안 맞았다 —
//    Barotrauma 미션 22종 중 암살·해적·적 잠수함·PvP 는 **무기가 없어서**,
//    호위·구출·탈옥은 **사람이 없어서** 통째로 탈락했다.
//    목록을 베끼는 게 아니라 **좋았던 이유**를 가져와 다시 만들었다.
//
//  ★ 갈래는 2~4개, 어느 것도 판을 끝내지 않는다 (FTL 계보)
//    고를 때는 어느 쪽인지 모르지만 **여러 번 하면 배운다.** 완전한 무작위가
//    아니다. 그리고 제일 나쁜 갈래도 **그 구간을 잃는 정도**여야 한다 —
//    회차가 날아가면 다시 켤 마음이 안 생긴다 (PLAN §4-4).
//
//  ★ three.js 를 쓰지 않는다 — 시뮬이 브라우저 없이 읽어야 한다.
// ══════════════════════════════════════════════════════════════════════════

/** 언제 만들 수 있나. A 는 지금 있는 계통만으로 성립한다 */
export const TIER = {
  NOW: 'now',        // 열·전력·자국·방 일곱만 있으면 된다
  SUPPLY: 'supply',  // 5단계(보급) — 채굴·선외 작업이 필요하다
  STORY: 'story',    // 이야기가 붙어야 성립한다
};

/**
 * @property where   어느 방을 쓰나. **한 방에서 끝나는 것은 안 넣는다** —
 *                   방 일곱을 쓰려고 만든 배다
 * @property costs   무엇을 쓰나 (시간 · 자국 · 부품 · 식량)
 * @property branches 갈래. weight 는 상대 확률이고, 구간이 깊어지면
 *                   `worse` 붙은 갈래의 무게가 커진다 — **새 항목을 안
 *                   만들고도 어려워지는 방법** (Hardspace 방식)
 * @property steps   ★ 실제로 손이 가는 자리. `at` 은 방, `hold` 는 그 자리에서
 *                   잡고 있어야 하는 초. **여기 있는 것만 게임에 물린다** —
 *                   steps 가 없는 항목은 아직 설계일 뿐이다 (5단계·이야기 대기).
 *                   갈래가 자리를 정하는 경우(원인 모를 열)는 갈래에 `at` 을 둔다
 * @property effect  고쳐지기 전까지 배에 무슨 일이 나나 (game/fault.js 가 읽는다)
 * @property sys     어느 계통이 닳아서 나는 고장인가 (systems-table.js WEAR).
 *                   정비실 진단대가 이걸로 **다음에 무엇이 터질지** 예고한다.
 *                   **자리는 안 알려준다** — 계통과 방은 다른 것이다
 */
export const MISSIONS = [
  // ── A. 배 자신의 문제 — 지금 만들 수 있다 ──────────────────
  {
    key: 'phantomHeat', sys: 'hull', name: '원인 모를 열', tier: TIER.NOW,
    where: ['spine', 'engine', 'workshop'],
    lead: '열이 오르는데 냉각 계통은 멀쩡하다',
    // ★ 제일 먼저 만들 것. 이 게임의 정체성 그 자체다 —
    //   「글로 안 알려준다」(PLAN §3-1)가 미션이 된 형태.
    //   그리고 방 셋을 돌게 만들어서 **왕복이 지겨운지 바로 드러난다.**
    first: true,
    costs: { time: [40, 110], sign: 'heat' },
    // ★ **자리를 안 알려준다.** 갈래가 방을 정하고, 사람은 소리로 찾는다 —
    //   가까울수록 덜그럭거림이 커진다 (core/audio.js rattle).
    //   이것이 「글로 안 알려준다」(PLAN §3-1)의 실체다
    // ★ 3.2 → 1.1 로 낮췄다. 3.2 면 **밸브를 붙들고 있어도 22초 만에** 열이
    //   꽉 찼다 — 고치는 데 50초쯤 걸리므로 그건 고장이 아니라 사형이다.
    //   1.1 이면 밸브를 열어 둔 채로 80초쯤 버틴다. 「버틸 수는 있는데
    //   그동안 기관실에 매여 있다」가 이 고장의 벌이다.
    effect: { heat: 1.1 },
    branches: [
      { key: 'duct', what: '통로 배관 이음쇠가 헐거웠다', weight: 3, at: 'spine' },
      { key: 'core', what: '반응로 고정 밴드가 늘어났다', weight: 3, at: 'engine' },
      { key: 'bench', what: '정비실 공구가 배선 위에 놓여 있었다', weight: 2, at: 'workshop' },
      // 두 곳이면 **한 번 고쳐도 안 잡힌다.** 「고쳤는데 왜」가 나는 자리다
      { key: 'twin', what: '두 곳이다. 하나만 고치면 다시 오른다', weight: 1, worse: true, at: ['spine', 'engine'] },
    ],
    hold: 7,
  },
  {
    key: 'foulCoolant', sys: 'cool', name: '오염된 냉매', tier: TIER.NOW,
    where: ['engine', 'workshop'],
    lead: '밸브를 열면 오히려 열이 오른다',
    // 「늘 하던 것이 안 통한다」 — 익숙함을 무기로 쓴다.
    // 1단계부터 몸에 밴 동작이 배신하는 순간이 있어야 한다
    costs: { time: [60, 120], parts: 1 },
    // ★ **밸브가 배신한다.** 1단계부터 몸에 밴 동작이 반대로 먹는다
    effect: { coolValve: 2.0 },
    // 정비실에서 챙겨 기관실에서 갈아 넣는다 — 방 둘을 반드시 거친다
    steps: [
      { at: 'workshop', hold: 5, what: '냉매 한 통을 챙긴다' },
      { at: 'engine', hold: 8, what: '갈아 넣는다' },
    ],
    branches: [
      { key: 'swap', what: '정비실에서 갈면 끝난다', weight: 3 },
      { key: 'twice', what: '한 통으로는 모자란다', weight: 2, worse: true, again: true },
    ],
  },
  {
    key: 'micrometeor', sys: 'hull', name: '미소운석', tier: TIER.NOW,
    // ★ **이 항목만 방을 안 정한다.** 갈래가 방을 뽑고, 사람은 소리로 찾는다.
    //   설계 의도가 「방을 다 훑게 만든다」였는데, v23 까지 방 셋에만 점검
    //   패널이 있어서 성립할 자리가 없었다 — 그래서 `steps` 를 못 적었고
    //   `wired()` 가 걸러 **한 번도 안 나왔다.** 방 일곱에 패널이 깔린
    //   지금에야 원래 모양대로 선다
    where: ['any'],
    lead: '어딘가에서 공기가 샌다',
    // 소리로 찾는 첫 항목. 쉭 소리가 단서다
    costs: { time: [30, 90], air: true },
    // ★ **새는 공기가 눈에 띈다.** 공기는 아직 계통이 아니므로(5단계),
    //   벌을 「숨을 못 쉰다」가 아니라 **자국**으로 낸다 — 얼어붙은 김이
    //   배 뒤로 길게 끌리는 것이라 오히려 이 게임답다
    effect: { sign: 7 },
    // ★ 처음엔 방마다 갈래를 하나씩 여섯 개 뒀다가 **내 규칙에 걸렸다** —
    //   이 파일 머리에 「갈래는 2~4개」라고 적어 뒀고 space-missions.js 가
    //   그걸 잰다. 규칙이 있는 이유는 **여러 번 하면 배워지게** 하려는 것이라,
    //   여섯이면 아무것도 안 배워진다. 넷으로 줄이되 마지막 갈래가 두 방을
    //   맡게 해서 **덜 쓰이던 방 넷(관측실·온실·에어록·조종석)은 그대로 덮는다**
    branches: [
      { key: 'observ', what: '관측실 벽이었다', weight: 3, at: 'observ' },
      { key: 'garden', what: '온실 벽이었다', weight: 3, at: 'garden' },
      { key: 'airlock', what: '에어록 벽이었다', weight: 3, at: 'airlock' },
      // 흩뿌려 맞으면 **두 방**이다. 「막았는데 왜 아직 새지」가 나는 자리
      { key: 'spray', what: '흩뿌려 맞았다. 두 군데다', weight: 1, worse: true, at: ['cockpit', 'spine'] },
    ],
    hold: 6,
  },
  {
    key: 'chartDrift', sys: 'power', name: '해도대 어긋남', tier: TIER.NOW,
    where: ['observ', 'workshop'],
    lead: '해도대 눈금이 조금씩 밀린다',
    // ★ **계기가 거짓말을 한다.** 이 게임은 계기가 전부라 이게 제일 불쾌한
    //   고장이어야 맞다 — 「압박이 얼마인지 모르는 채로 간다」가 벌이다.
    //   다만 **거짓말인 줄은 알게** 해 준다 (눈금이 떤다). 모르고 속으면
    //   그건 고장이 아니라 사기다
    costs: { time: [50, 110], parts: 1 },
    effect: { chartLie: 1 },
    steps: [
      { at: 'workshop', hold: 5, what: '기준기를 챙긴다' },
      { at: 'observ', hold: 7, what: '눈금을 다시 맞춘다' },
    ],
    branches: [
      { key: 'recal', what: '다시 맞추면 된다', weight: 3 },
      { key: 'drifts', what: '금방 또 밀린다', weight: 2, worse: true, again: true },
    ],
  },
  {
    key: 'coldGarden', sys: 'cool', name: '온실 냉해', tier: TIER.NOW,
    where: ['garden', 'engine'],
    lead: '온실이 차다',
    // 식량이 빨리 준다 — **굶으면 손이 떨려 다른 것도 못 고친다** (PLAN §5-2).
    // 계통이 서로 물리는 것을 보여 주는 항목이다
    costs: { time: [60, 120] },
    effect: { food: 1.9 },
    steps: [
      { at: 'engine', hold: 6, what: '온수 회로를 튼다' },
      { at: 'garden', hold: 7, what: '언 배관을 녹인다' },
    ],
    branches: [
      { key: 'thaw', what: '녹이면 산다', weight: 3 },
      { key: 'lost', what: '한 판은 못 쓴다', weight: 2, worse: true },
    ],
  },
  {
    key: 'airlockSeal', sys: 'hull', name: '에어록 밀폐 불량', tier: TIER.NOW,
    where: ['airlock', 'workshop'],
    lead: '에어록 표시등이 안 꺼진다',
    // **윈치를 못 쓴다** = 밖에서 아무것도 못 얻는다. 「한 통만 더」가 막히는
    // 것이라, 굶는 중에 이게 겹치면 진짜로 급해진다
    costs: { time: [50, 100], parts: 1 },
    effect: { noWinch: true },
    steps: [
      { at: 'workshop', hold: 5, what: '밀폐재를 챙긴다' },
      { at: 'airlock', hold: 8, what: '문틀을 다시 메운다' },
    ],
    branches: [
      { key: 'reseal', what: '메우면 된다', weight: 3 },
      { key: 'warped', what: '틀이 휘었다. 오래 걸린다', weight: 2, worse: true, again: true },
    ],
  },
  {
    key: 'looseYoke', sys: 'hull', name: '조종간 헐거움', tier: TIER.NOW,
    where: ['cockpit', 'workshop'],
    lead: '배가 저절로 한쪽으로 흐른다',
    // ★ **조종(v20)을 배신한다.** 잡고 있지 않아도 배가 흐르므로, 위험 지대가
    //   오면 가만히 있는 것이 정답이 아니게 된다 — 조종석에 매이는 시간이
    //   늘지만 그건 이 고장의 벌이지 설계가 바뀐 것이 아니다
    costs: { time: [40, 90], parts: 1 },
    effect: { drift: 0.12 },
    steps: [
      { at: 'workshop', hold: 5, what: '고정핀을 챙긴다' },
      { at: 'cockpit', hold: 7, what: '조종간 밑을 조인다' },
    ],
    branches: [
      { key: 'tighten', what: '조이면 잡힌다', weight: 3 },
      { key: 'worn', what: '축이 닳았다. 계속 흐른다', weight: 2, worse: true },
    ],
  },
  {
    key: 'doorServo', sys: 'power', name: '문 구동부 이상', tier: TIER.NOW,
    where: ['workshop', 'spine'],
    lead: '문이 제멋대로 여닫힌다',
    // ★ v23 의 문을 배신한다. 문이 혼자 여닫히면 **그 소리가 자국이 된다** —
    //   숨죽이고 가는 중에 제일 나쁘다
    costs: { time: [50, 110], parts: 1 },
    effect: { doorWild: true, sign: 4 },
    steps: [
      { at: 'workshop', hold: 5, what: '구동부 계전기를 챙긴다' },
      { at: 'spine', hold: 7, what: '배전반에서 갈아 끼운다' },
    ],
    branches: [
      { key: 'relay', what: '계전기를 갈면 된다', weight: 3 },
      { key: 'again', what: '한 번으로는 안 잡힌다', weight: 2, worse: true, again: true },
    ],
  },
  {
    key: 'oldBreaker', sys: 'power', name: '배전 노후', tier: TIER.NOW,
    // ★ 처음엔 통로만 적었다가 **내 규칙(한 방에서 안 끝난다)에 걸렸다.**
    //   고치려면 정비실에서 접점을 가져와야 한다고 두니 오히려 맞다 —
    //   차단기만 만지작거리는 것보다 「부품이 있나」가 먼저 오는 게 낫다
    where: ['spine', 'workshop'],
    lead: '차단기 하나가 제멋대로 내려간다',
    // **셋 중 둘**이 갑자기 **둘 중 하나**가 된다. 규칙 자체를 흔드는 것이라
    // 자주 나오면 안 된다 — 한 회차에 한두 번이면 충분하다
    costs: { time: [50, 100], parts: 1 },
    // 회로 하나가 제멋대로 내려간다 — **셋 중 둘**이 잠깐 **둘 중 하나**가 된다
    effect: { flaky: true },
    steps: [
      { at: 'workshop', hold: 5, what: '접점을 챙긴다' },
      { at: 'spine', hold: 6, what: '다시 꽂는다' },
    ],
    branches: [
      { key: 'reseat', what: '다시 꽂으면 버틴다', weight: 3 },
      { key: 'dead', what: '그 회로는 이 구간 내내 못 쓴다', weight: 2, worse: true },
    ],
  },

  // ── B. 밖에서 얻는 것 — 5단계(보급) ────────────────────────
  {
    key: 'iceRock', name: '얼음 덩어리', tier: TIER.SUPPLY,
    where: ['airlock'],
    lead: '얼음이 떠 있다',
    // **지루하지만 확실한 바닥.** 죽음의 나선을 막는 것이 이 항목의 일이다
    costs: { time: [40, 90], sign: 'stopped' },
    branches: [{ key: 'plain', what: '물과 공기', weight: 5 }],
  },
  {
    key: 'deadSat', name: '죽은 위성', tier: TIER.SUPPLY,
    where: ['airlock', 'workshop'],
    lead: '낡은 위성이 돈다',
    costs: { time: [30, 60], sign: 'stopped' },
    branches: [
      { key: 'silent', what: '조용하다. 전자 부품', weight: 3 },
      { key: 'beacon', what: '아직 신호를 쏜다. 뜯는 동안 자국이 확 는다', weight: 2, worse: true },
    ],
  },
  {
    key: 'derelict', name: '표류선', tier: TIER.SUPPLY,
    where: ['airlock', 'cargo'],
    lead: '배가 하나 떠 있다. 불이 꺼져 있다',
    // ★ Hardspace 방식 — **속을 매번 다시 뽑는다.** 같은 종류인데 안이 다르면
    //   항목 하나로 오래 간다. 그리고 Duskers 방식으로 **아무 설명도 안 붙인다**
    //   — 파편만 놓아 둔다 (USER-VIEW §3-2)
    reroll: true,
    costs: { time: [90, 240], sign: 'stopped', air: true },
    branches: [
      { key: 'quiet', what: '조용하다. 부품과 식량', weight: 3 },
      { key: 'powered', what: '전력이 아직 산다. 좋은 것이 많고 문이 잠긴다', weight: 2 },
      { key: 'picked', what: '이미 누가 다녀갔다', weight: 2, worse: true },
      { key: 'why', what: '왜 죽었는지 알겠다', weight: 1, worse: true },
    ],
  },

  // ── C. 마음이 무거운 것 — FTL 계보 ─────────────────────────
  {
    key: 'distress', name: '구조 신호', tier: TIER.STORY,
    where: ['cockpit', 'observ'],
    lead: '누가 살려 달라고 한다',
    // ★ **안 가도 벌이 없다.** 그게 요점이다 — 벌이 있으면 선택이 아니라
    //   숙제가 된다. 다만 나중에 그 잔해를 지나간다
    costs: { time: [60, 180], sign: 'detour' },
    branches: [
      { key: 'real', what: '진짜였다', weight: 3 },
      { key: 'late', what: '늦었다', weight: 2, worse: true },
      { key: 'bait', what: '미끼였다', weight: 1, worse: true },
      { key: 'ignore', what: '안 갔다. 아무 일도 안 난다', weight: 0 },
    ],
  },
  {
    key: 'othersBait', name: '남의 미끼', tier: TIER.STORY,
    where: ['cargo'],
    lead: '화물이 떠 있다. 누가 살려고 던진 것이다',
    // §5-3 의 「내가 던진 것을 언젠가 누가 줍는다」의 반대편.
    // 주우면 **그를 쫓던 것이 나를 본다**
    costs: { time: [20, 40] },
    branches: [
      { key: 'clean', what: '그는 무사히 갔나 보다', weight: 2 },
      { key: 'seen', what: '쫓던 것이 이쪽을 봤다', weight: 3, worse: true },
    ],
  },
  {
    key: 'quietPort', name: '조용한 거점', tier: TIER.STORY,
    where: ['cockpit'],
    lead: '거점 신호가 잡히는데 응답이 없다',
    costs: { time: [90, 200] },
    branches: [
      { key: 'empty', what: '아무도 없다. 물자는 남아 있다', weight: 3 },
      { key: 'recent', what: '얼마 안 됐다', weight: 2, worse: true },
    ],
  },

  // ── D. 추격과 얽힌 것 — 지금 만들 수 있다 ──────────────────
  {
    key: 'intoDebris', name: '끌고 들어가기', tier: TIER.NOW,
    // 조종석에서 틀지만, **뭐가 있는지는 관측실에서 본다.** 안 보고 들어가면
    // 그게 곧 도박이다 — 관측실을 켜 두고 갈지가 선택이 된다
    where: ['cockpit', 'observ'],
    lead: '잔해밭이 앞에 있다. 쫓기는 채로 들어갈까',
    // 자국이 묻히지만 부딪힌다 (regions-table 의 debris)
    costs: { time: [40, 90], hull: true },
    branches: [
      { key: 'lost', what: '뿌리쳤다', weight: 3 },
      { key: 'hit', what: '뿌리쳤지만 선체가 상했다', weight: 3, worse: true },
    ],
  },
  {
    key: 'jettison', name: '버리기', tier: TIER.SUPPLY,
    where: ['airlock', 'cargo'],
    lead: '실은 것을 던지면 산다',
    costs: { cargo: 'all' },
    branches: [{ key: 'works', what: '거의 확실히 뿌리친다', weight: 5 }],
  },
  {
    key: 'silentRun', name: '숨죽이기', tier: TIER.NOW,
    // 차단기를 다 내리는 것만으로는 부족하다. **냉각 밸브도 잠가야** 한다 —
    // 열을 버리는 것 자체가 눈에 띄기 때문이다. 방 둘이 되는 게 맞다
    where: ['spine', 'engine'],
    lead: '전부 끄고 지나가기를 기다린다',
    // 2단계에는 아직 **못 쓴다** — 추진을 끄면 거리가 안 벌어져서 그냥 진다.
    // 공기가 계통이 되고(5단계) 나서야 성립한다. 여기 적어 두는 이유는,
    // 안 적어 두면 「왜 숨죽이기가 없지」를 여섯 달 뒤에 다시 묻게 되기 때문
    costs: { time: [60, 150], air: true, food: true },
    branches: [
      { key: 'passes', what: '지나갔다', weight: 3 },
      { key: 'waits', what: '기다린다. 이쪽이 먼저 못 버틴다', weight: 2, worse: true },
    ],
  },
];

export const BY_KEY = Object.fromEntries(MISSIONS.map((m) => [m.key, m]));

/**
 * 고장이 얼마나 자주 · 몇 개나 오나.
 *
 * ★ PLAN §11 의 「문제 하나 40초~2분 · 평온 때 동시 1~2개」를 지키는 값이다.
 *   여기 있는 시간은 **잡고 있는 시간이 아니라 전체**다 — 걸어가는 시간이
 *   대부분이고, 손이 실제로 가 있는 것은 5~8초다. 잡고 있는 걸 40초로 두면
 *   그건 진단이 아니라 진행 바를 보는 일이 된다.
 */
export const FAULT = {
  /** 평온할 때 이 간격으로 하나씩 (초). 구간이 깊어지면 촘촘해진다 */
  every: [95, 165],
  everyPerLeg: -0.045,      // 구간마다 이만큼 짧아진다 (배수)
  /** 동시에 열려 있을 수 있는 최대 */
  maxOpen: 2,
  /** 첫 고장은 조금 늦게 온다 — 켜자마자 터지면 배울 틈이 없다 */
  firstAfter: 55,
  /** 소리로 찾는 반경. 이보다 가까우면 덜그럭거림이 들리기 시작한다 */
  hearing: 9,
  /** 손이 닿아야 하는 거리 (BODY.reach 와 별개로 방 안에서 판정) */
  atSite: 1.9,
};

/** 지금 실제로 **게임에 물릴 수 있는** 것 — steps 나 갈래의 at 이 있는 것만 */
export const wired = () => MISSIONS.filter(
  (m) => m.tier === TIER.NOW && (m.steps || m.branches.some((b) => b.at)),
);

/** 지금 단계에서 만들 수 있는 것들 */
export const buildable = () => MISSIONS.filter((m) => m.tier === TIER.NOW);

/**
 * 구간이 깊어질수록 나쁜 갈래가 자주 나온다.
 * **새 항목을 안 만들고도 어려워지는 방법**이다 (Hardspace 계보).
 * @param leg 몇 번째 구간인가 (0부터)
 */
export function branchWeights(mission, leg = 0) {
  return mission.branches.map((b) => ({
    ...b,
    weight: b.weight * (b.worse ? 1 + leg * 0.35 : 1),
  }));
}
