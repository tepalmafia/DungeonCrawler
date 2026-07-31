// 층 보스 5종 — 공격 프리미티브(휘두르기/투사체 부채꼴/장판/소환/돌진/충격파 링)를
// 조합해 보스별 패턴을 만든다. HP 50% 이하에서 페이즈 2 (패턴 추가 + 가속).
//
// 프리미티브:
//  sweep      근접 연속 베기 (부채꼴 텔레그래프 → 짧은 돌진 + 호 판정)
//  fan:KIND   투사체 부채꼴 (soul/spore/fire/rock)
//  curse      바닥 장판 (예고 원 → 폭발). opt.fire면 불길이 남는다
//  summon     잡몹 소환
//  charge     긴 돌진 (벽에 부딪히면 그로기). opt.trail이면 불길 흔적
//  ring       확장 충격파 링 (대시로 통과)

// ══ 1막 「나를 죽인 손들」 (v118 시나리오 정합) — 죄 없는 자 하나를 죽음까지 운반한
// 변두리의 손들: 묻은 손(1)·나른 손(2)·가둔 손(3)·태운 손(4)·매단 자들의 원한(5),
// 그리고 저주에 되삼켜진 그들(6~9) → 마지막에 벤 손, 처형인(10)이 기다린다.
// ── 보스 속성 (v200) ─────────────────────────────────────────────────────
// 사장: "상대를 얼리거나 화상을 입히거나 속성도 없고 뭐하는거야?"
// 계측: boss.js 가 거는 상태이상은 slowT 한 곳(1.6초)뿐이었고 zones.push 는 **0회**였다.
//       속성 하나 = (탄 색) + (바닥 잔여물) + (플레이어 상태) 3종 세트여야 화면에서 속성으로 읽힌다.
// 배정 원칙: **죄목이 속성을 정한다.** 서사와 무관한 배정은 하지 않는다.
//   주속성은 1페이즈부터, 부속성은 2페이즈부터 나온다.
const BOSS_ELEM = {
  1:  ['curse'],            // 무덤지기 — 무덤 흙이 발을 잡는다
  2:  ['poison'],           // 시체 짐꾼 — 늪에 버린 시체가 썩는다
  3:  ['freeze', 'curse'],  // 간수장 — 돌바닥 감방의 냉기, 얼어 죽은 죄수
  4:  ['burn'],             // 방화대장 — 불을 놓고 다닌다
  5:  ['curse', 'freeze'],  // 교수대의 그림자 — 목맨 원한
  6:  ['curse', 'freeze'],  // 되살아난 오스문드 — 죽어서 더 차가워졌다
  7:  ['poison', 'shock'],  // 물에 불은 몰레 — 물은 전기를 통한다
  8:  ['freeze', 'shock'],  // 사슬에 얽힌 바르곤 — 쇠사슬은 전도체
  9:  ['burn', 'curse'],    // 재가 된 브란트 — 백열한 잿불
  10: ['curse', 'burn'],    // 왕실 처형인
  20: ['poison', 'freeze'], // 관문 사령관 — 성문을 닫아 굶겼다
  30: ['curse', 'poison'],  // 대재판관 — 오심과 고문
  40: ['burn', 'curse'],    // 대주교 — 화형
  45: ['freeze'],           // 근위대장 '흰 늑대' — 설한
  50: ['curse', 'burn', 'freeze', 'poison', 'shock'],  // 왕 — 최종보스는 전부 쓴다
  60: ['freeze', 'poison'], // 수문장 — 물
  61: ['curse', 'freeze'],  // 뱃사공 — 강을 건넌 원혼
  62: ['curse', 'shock'],   // 위증 서기장
  63: ['shock', 'freeze'],  // 철퇴 가로크 — 금속
  64: ['poison', 'burn'],   // 역병 의사
  65: ['burn', 'curse'],    // 소각로장
  66: ['shock', 'curse'],   // 별지기 오벨
  67: ['freeze', 'shock'],  // 검은 창기병
};
const ELEM_INFO = {
  burn:   { zone: 'fire',   sec: 2.2, color: '#ff7043', life: 3.0 },
  freeze: { zone: 'ice',    sec: 2.0, color: '#b6e8ff', life: 4.0 },
  poison: { zone: 'poison', sec: 3.5, color: '#6ab04c', life: 4.0 },
  shock:  { zone: 'shock',  sec: 2.0, color: '#ffd866', life: 2.0 },
  curse:  { zone: 'curse',  sec: 5.0, color: '#b13ae0', life: 5.0 },
};

const BOSS_DEFS = {
  1: {
    // ★ v192 — 사장: "잡몹만 잡는거 너무 지루하니깐 … 보스는 부하를 소환하거나 유성우를 소환하거나"
    //            "한층 한층이 전부 컨트롤과 긴장감을 주는 거지."
    // 실측이 문제를 지목했다: 1층 보스 HP 59, 사장 기록 8~16초 처치.
    // 보스는 **이미 2페이즈인데 페이즈 2를 5초만 본다** — 패턴이 있어도 읽을 시간이 없었다.
    // 그리고 p1이 낫질 2종 + 돌 부채꼴 2종뿐이라 1페이즈 내내 같은 그림이었다.
    // 소환(summon:)과 유성우(mortar)는 **이미 구현돼 있었고 1층 보스만 안 썼다** — 깊은 층 전용이었다.
    //
    // 무덤지기는 묘지의 관리인이다. 그가 부르는 부하는 **그가 묻은 것들**이어야 한다 —
    // summon:skeleton 은 서사와 정확히 맞물린다(1층 로스터에 이미 있다).
    // mortar 는 무덤 흙과 뼈를 퍼올려 쏟아붓는 것으로 읽힌다.
    name: '무덤지기 오스문드', sprite: 'boss', scale: 1.35, r: 26, hp: 190, speed: 42,
    banner: '무덤지기 오스문드',
    punish: 'volley', punishProj: 'rock', // 인간의 손 — 뼛조각과 무덤 흙을 던진다 (원혼 부채꼴은 되살아난 후의 것)
    p1: ['sweep>sweep', 'fan:rock', 'summon:skeleton', 'mortar', 'fan:rock:snipe'],
    p2: ['sweep>fan:rock', 'mortar>summon:skeleton', 'fan:rock:cross', 'curse>sweep>fan:rock',
      'summon:skeleton>fan:rock:cross', 'uniq'],
    rageText: '오스문드가 낫을 고쳐쥔다!',
    intro: '죄인은 무덤 밖으로 못 나간다. 그게 내 밥줄이야.', outro: '네 관은… 비어 있었지… 이상하다 했어…',
    deathPalette: ['#c9a24a', '#3a3226', '#e8e0cf'],
  },
  2: {
    // 나른 손 — 처형된 시신을 밤마다 수레로 늪에 버린 삯꾼 (관통 v3 hp 170 유지: 2층 벽 계측 근거)
    name: "시체 짐꾼 '삯꾼 몰레'", sprite: 'bossSpore', scale: 1.45, r: 32, hp: 170, speed: 34,
    mechanic: { type: 'regen', label: '거들 손 — 부하가 살아있는 동안 상처를 감춘다' },
    banner: "시체 짐꾼 '삯꾼 몰레'",
    // 분산 귀속 (열기5): 소환수는 경량 늪 거품 유지 — 기믹(부하 처치=재생 정지) 계측 근거 보존
    punish: 'volley', punishProj: 'spore',
    // v198: 1층 규격 확대 — 소환·유성우를 1페이즈로 내린다 (2페이즈를 못 보고 끝나기 때문)
    p1: ['fan:spore', 'ring>summon:sporePuff', 'mortar:poison', 'summon:frog', 'fan:spore:snipe'],
    p2: ['fan:spore:cross', 'fan:spore:snipe>ring', 'mortar:poison', 'curse>fan:spore', 'uniq'],
    rageText: '몰레가 수레를 뒤엎는다!',
    intro: '밤마다 수레 하나 값이었지. 비켜라 — 오늘은 짐이 밀렸다.', outro: '버린 게 아니야… 나른 것뿐… 시킨 놈은… 위에…',
    deathPalette: ['#6a7a4a', '#8a653f', '#3a4a3a'],
  },
  3: {
    // 가둔 손 — 처형 전야, 나를 가둔 지하 감옥의 간수장
    name: '간수장 바르곤', sprite: 'bossGolem', scale: 1.5, r: 33, hp: 190, speed: 30,
    mechanic: { type: 'armor', cap: 2, label: '간수의 철갑 — 강한 일격을 경감한다' },
    banner: '간수장 바르곤',
    punish: 'charge',
    // v198: 간수장이 제 옥지기들을 부른다 — 죄목과 맞물리는 소환
    p1: ['charge>ring', 'fan:rock', 'summon:shieldSkeleton', 'mortar', 'fan:rock:snipe', 'uniq'],
    // 매트릭스 계측: 이중 돌진 금지 유지 (열기0 3층 스파이크 귀속) — 연계는 돌진 1회까지만
    p2: ['charge>ring>fan:rock', 'pulse', 'ring>fan:rock', 'fan:rock:gap', 'uniq'],
    rageText: '바르곤의 사슬이 풀렸다!',
    intro: '네 얼굴, 명부에서 봤다. 처형 완료라 적혀 있었는데.', outro: '명부가… 처음부터… 거짓이었나…',
    deathPalette: ['#6b7a94', '#454f63', '#e43b44'],
  },
  4: {
    // 태운 손 — 단서 ③의 농가를 태워 장부를 지운 방화대장
    name: "방화대장 '그을음 브란트'", sprite: 'bossIgnis', scale: 1.55, r: 30, hp: 430, speed: 44,
    mechanic: { type: 'rage', label: '불장난 — 시간이 지날수록 달아오른다' },
    banner: "방화대장 '그을음 브란트'",
    punish: 'charge', punishTrail: true,
    p1: ['fan:fire>charge:trail', 'curse:fire', 'fan:fire:snipe', 'uniq', 'summon:cinder', 'mortar'],
    p2: ['charge:trail>fan:fire', 'mortar:fire', 'fan:fire:snipe>charge:trail', 'fan:fire:cross', 'uniq'],
    rageText: '브란트가 기름통을 비운다!',
    intro: '장부가 있던 농가? 내가 태웠다. 종이는 잘 타지 — 너는 어떨까.', outro: '불은… 명령이었다… 나는 그저…',
    deathPalette: ['#ff7043', '#ffd866', '#7a1010'],
  },
  5: {
    // 매단 자들의 원한 — 교수대 언덕에서 죄 없이 매달린 혼들이 뭉친 것. 눈먼 원한은 같은 처지의 망자도 가리지 않는다
    name: '교수대의 그림자', sprite: 'bossAbyss', scale: 1.75, r: 28, hp: 700, speed: 50,
    mechanic: { type: 'veil', label: '목매단 원한 — 영혼 구슬을 파괴하라' },
    banner: '교수대의 그림자',
    punish: 'volley', punishProj: 'soul',
    p1: ['sweep>fan:soul', 'ring:gap', 'fan:soul:snipe', 'uniq', 'summon:shade', 'mortar'],
    p2: ['ring:gap>sweep>fan:soul', 'pulse', 'fan:soul:cross>ring', 'summon:wraith:elite', 'uniq'],
    rageText: '목매단 자들의 원한이 깨어난다!',
    intro: '이 언덕에 매달린 자, 셀 수 없다. 너도 그중 하나였을 뿐.', outro: '우리는… 전부… 죄가 없었다…',
    deathPalette: ['#e43b44', '#16101f', '#c9b8e8'],
  },
  // ── 6~10층: 저주에 되삼켜진 손들 — 네가 벤 자들이 같은 저주로 깨어나 다시 막아선다 ──
  6: {
    awakened: true, name: '되살아난 오스문드', sprite: 'bossWraith', scale: 1.6, r: 26, hp: 550, speed: 48,
    banner: '되살아난 오스문드',
    punish: 'volley', punishProj: 'soul', // 이제는 원혼 — 죽어서야 죽은 자들의 무기를 손에 넣었다
    p1: ['sweep>spiral:soul', 'curse', 'fan:soul:snipe', 'uniq'],
    p2: ['curse>spiral:soul>sweep', 'echo', 'sweep>sweep', 'summon:boneHeap>spiral:soul', 'uniq'],
    rageText: '오스문드의 원혼이 울부짖는다!',
    intro: '네가 날 죽였지. 그런데… 왜 나도 깨어난 거지?', outro: '저주는… 너만의 것이… 아니었어…',
    deathPalette: ['#e43b44', '#241832', '#e8e0cf'],
  },
  7: {
    awakened: true, name: "물에 불은 몰레", sprite: 'bossPlague', scale: 1.6, r: 32, hp: 680, speed: 38,
    mechanic: { type: 'regen', label: '가라앉은 무리 — 부하가 살아있는 동안 늪이 그를 되메운다' },
    banner: "물에 불은 몰레",
    punish: 'volley', punishProj: 'spore',
    p1: ['fan:spore:cross', 'ring>summon:sporePuff', 'geyser:poison', 'uniq'],
    p2: ['geyser:poison>fan:spore', 'mortar:poison', 'fan:spore:snipe>geyser:poison', 'fan:spore:gap', 'uniq'],
    rageText: '늪이 들끓는다!',
    intro: '늪이… 뱉어냈다. 내가 버린 것들이 전부 깨어났어 — 너 때문에!', outro: '이제야 알겠어… 짐이 아니라… 사람이었어…',
    deathPalette: ['#6ab04c', '#4a6a5a', '#d8f070'],
  },
  8: {
    awakened: true, name: '사슬에 얽힌 바르곤', sprite: 'bossDespair', scale: 1.65, r: 33, hp: 650, speed: 34,
    mechanic: { type: 'armor', cap: 2, label: '얽힌 사슬 — 강한 일격을 경감한다' },
    banner: '사슬에 얽힌 바르곤',
    punish: 'charge',
    p1: ['charge>snare', 'fan:rock>ring', 'fan:rock:snipe', 'uniq'],
    p2: ['snare>charge', 'pulse>snare', 'charge>snare>fan:rock:snipe', 'snare>fan:rock', 'uniq'],
    rageText: '사슬이 제멋대로 날뛴다!',
    intro: '열쇠는… 내가 갖고 있었는데… 사슬이 날 놓아주질 않아…', outro: '기록은… 지하 서고에… 아직…',
    deathPalette: ['#383850', '#a9c1d8', '#e43b44'],
  },
  9: {
    awakened: true, name: '재가 된 브란트', sprite: 'bossInferno', scale: 1.7, r: 30, hp: 850, speed: 48,
    mechanic: { type: 'rage', label: '잿불 — 시간이 지날수록 백열한다' },
    banner: '재가 된 브란트',
    punish: 'charge', punishTrail: true,
    p1: ['fan:fire>geyser:fire', 'charge:trail>ring', 'uniq'],
    p2: ['geyser:fire>charge:trail', 'beam', 'mortar:fire', 'charge:trail>geyser:fire', 'uniq'],
    rageText: '잿불이 폭주한다!',
    intro: '타고 남은 게… 이런 거였나. 이리 와 — 같이 타자.', outro: '꺼지질 않아… 이 불은… 내가 지른 불인데…',
    deathPalette: ['#ffd866', '#ff7043', '#7a1010'],
  },
  10: {
    awakened: true, name: "왕실 처형인 '무거운 손'", sprite: 'bossVoid', scale: 1.95, r: 30, hp: 1300, speed: 54,
    mechanic: { type: 'veil', label: '어둠 장막 — 영혼 구슬을 파괴하라', veils: [0.75, 0.5, 0.25] },
    banner: "왕실 처형인 '무거운 손'",
    punish: 'volley', punishProj: 'soul',
    sig: 'halfSweep', // 인장기 「참수 집행」 — 나를 처형한 그 도끼
    p1: ['sweep>spiral:soul', 'ring:gap>curse', 'fan:soul:snipe', 'uniq'],
    p2: ['ring:gap>spiral:soul>fan:soul:snipe', 'beam', 'pulse', 'sweep>curse>fan:soul', 'summon:voidSpawn>spiral:soul', 'uniq'],
    rageText: '처형인의 도끼가 검게 물든다!',
    intro: '네 목을 친 건 나다. 원한은 알겠으나 — 두 번 치는 것도 일이지.', outro: '명단은… 재판소가 아니라… 성에서 내려왔다…',
    deathPalette: ['#e43b44', '#0a0612', '#c9b8e8'],
  },
  // ── 2막 막보스 (20층): 균사 정원의 주인 ──
  20: {
    // 관통 v3: 재생 예산 후에도 조우당 11회 — 전 보스 최다 (왕 0·발디아 5). TTK 단축으로 노출 감소
    awakened: true, name: "관문 사령관 '철벽 로트가르'", sprite: 'bossQueen', scale: 1.9, r: 32, hp: 1600, speed: 40,
    mechanic: { type: 'regen', label: '군의관 지원 — 부하가 살아있는 동안 재생한다' },
    banner: "관문 사령관 '철벽 로트가르'",
    punish: 'volley', punishProj: 'spore',
    sig: 'shieldCharge', // 인장기 「방패 파쇄 돌격」
    p1: ['fan:spore:gap>ring', 'summon:sporeling>spiral:spore', 'geyser:poison>fan:spore', 'uniq'],
    p2: ['ring:gap>spiral:spore', 'mortar:poison', 'summon:glowShrieker>fan:spore:cross', 'fan:spore:snipe>geyser:poison>ring', 'uniq'],
    rageText: '관문 수비대 전원, 응전하라!',
    intro: '여기서부터는 왕도다. 죽은 것은 다리를 건널 수 없다.', outro: '마차 호위는… 명예였다… 안을 보기 전까지는…',
    deathPalette: ['#c9d94a', '#8adf76', '#6a3aa2'],
  },
  // ── 3막 막보스 (30층): 나를 판결한 자 ──
  30: {
    // 관통 v3: 발디아 15회 — 흰 늑대(11)·왕(5)을 웃도는 서열 역전. hp 2400→2100로 TTK 단축
    // (armor cap은 유지 — 막보스의 '판결의 법복' 정체성. 2100 < 이노첸시오 3200 서열 보존)
    awakened: true, name: "대재판관 '발디아 공작'", sprite: 'bossValdia', scale: 1.9, r: 33, hp: 2100, speed: 36,
    mechanic: { type: 'armor', cap: 2, label: '판결의 법복 — 강한 일격을 경감한다' },
    banner: "대재판관 '발디아 공작'",
    punish: 'volley', punishProj: 'rock',
    sig: 'brandZone', // 인장기 「사형 선고」 — 판결은 도망쳐도 따라온다
    p1: ['fan:rock:snipe>ring', 'snare>fan:rock', 'charge>ring>fan:rock', 'uniq'],
    p2: ['snare>charge>fan:rock:snipe', 'beam', 'ring:gap>fan:rock:cross', 'geyser:poison>snare>ring', 'uniq'],
    rageText: '법정 모독이다! 전원 처형하라!',
    intro: '피고, 다시 입정했는가. 판결은 이미 내려졌다 — 두 번 죽어라.',
    outro: '성배가 마르면… 왕국이 마른다고 했다… 나는… 서명만 했을 뿐…',
    deathPalette: ['#d9c08a', '#4c3c4c', '#c22030'],
  },
  // ── 4막 막보스 (40층): 성배를 왕에게 바친 교회의 수장 ──
  40: {
    awakened: true, name: "대주교 '이노첸시오'", sprite: 'bossBishop', scale: 1.9, r: 30, hp: 3200, speed: 44,
    mechanic: { type: 'veil', label: '성역 결계 — 성물을 파괴하라', veils: [0.7, 0.4] },
    banner: "대주교 '이노첸시오'",
    punish: 'volley', punishProj: 'soul',
    sig: 'sanctPulse', // 인장기 「파문(破門)」 — 교회 밖에는 구원이 없다
    p1: ['fan:soul:snipe>ring', 'beam', 'curse>spiral:soul', 'summon:acolyte>fan:soul:cross', 'uniq'],
    p2: ['ring:gap>spiral:soul>fan:soul:snipe', 'beam>fan:soul', 'curse>summon:acolyte>ring', 'sweep>curse>spiral:soul', 'uniq'],
    rageText: '신성 모독이다! 성화여, 불태워라!',
    intro: '죽은 자가 성소에 들다니. 성화의 이름으로 — 재가 되어라.',
    outro: '성배는… 교회가 왕에게 바쳤다… 신의 이름으로… 우리가… 시작했다…',
    deathPalette: ['#ffd866', '#e8e0cf', '#b13ae0'],
  },
  // ── 5막 (45층): 근위대장 — 가레스의 옛 친우, 알고도 침묵한 자 ──
  45: {
    awakened: true, name: "근위대장 '흰 늑대'", sprite: 'bossWolf', scale: 1.75, r: 30, hp: 3600, speed: 52,
    mechanic: { type: 'armor', cap: 2, label: '근위 판금 — 강한 일격을 경감한다' },
    banner: "근위대장 '흰 늑대'",
    punish: 'charge',
    sig: 'triCharge', // 인장기 「일기토」 — 셋째 창격만이 관통한다
    p1: ['charge>ring', 'sweep>sweep>fan:rock:snipe', 'snare>charge', 'uniq'],
    p2: ['charge>snare>fan:rock:snipe', 'echo', 'sweep>sweep>ring', 'fan:rock:cross>charge', 'uniq'],
    rageText: '늑대가 이빨을 드러낸다!',
    intro: '가레스… 아니, 그게 누구였든. 나는 맹세를 지킬 뿐이다. 알면서도.',
    outro: '알고 있었다… 전부… 미안하다는 말은… 하지 않겠다… 벌을 다오…',
    deathPalette: ['#e8ecf4', '#5a7a94', '#c22030'],
  },
  // ── 최종 보스 (50층): 왕 바르텐 3세 — 3페이즈 (검술 → 성배 폭주 → 분리 발악) ──
  50: {
    awakened: true, name: '왕 바르텐 3세', sprite: 'bossKing', scale: 2.0, r: 32, hp: 5000, speed: 50,
    mechanic: { type: 'rage', label: '성배의 고동 — 시간이 지날수록 왕이 젊어진다' },
    banner: '왕 바르텐 3세',
    punish: 'volley', punishProj: 'soul',
    // 1페이즈: 국왕 검술 — 인간의 격식
    sig: 'kingCross', sigP3: true, // 인장기 「왕의 선고」 — p3 전용, 왕국 전체가 칼이 된다
    p1: ['sweep>sweep', 'charge>ring', 'fan:rock:snipe>sweep', 'uniq'],
    // 2페이즈: 성배 폭주 — 지나온 보스들의 패턴을 역으로 사용 ("네놈들의 원한이 이런 모습이더냐")
    p2: ['spiral:soul>ring:gap', 'pulse', 'geyser:poison>fan:fire:cross', 'summon:voidSpawn>spiral:soul', 'curse>sweep>fan:soul:snipe', 'uniq'],
    // 3페이즈 (HP 25%↓ 맹공과 함께): 성배 분리 발악 — 모든 것을 쏟아낸다
    p3: ['ring:gap>spiral:soul>fan:soul:snipe', 'beam>echo', 'pulse>fan:soul:cross', 'geyser:poison>summon:voidSpawn>ring', 'curse>charge>fan:fire:cross'],
    rageText: '성배여! 짐에게 시간을 다오!',
    rageText2: '이 몸이 곧 왕국이다 — 전부 데려가겠다!',
    intro: '…그 종이쪼가리들을 여기까지 들고 왔느냐. 짐은 왕국을 지켰을 뿐이다.',
    outro: '성배가… 식는다… 짐의 시간이… 돌아온다… 전부… 한꺼번에…',
    deathPalette: ['#ffd866', '#c22030', '#0a0612'],
  },
  // ══ 왕의 공범들 — 막별 순환 보스 8종 (재림 4인방 해체): 기믹·콤보·인장기 전부 개별 ══
  // 2막 「다리와 관문」
  60: {
    awakened: true, name: "수문장 '갈고리 브람'", sprite: 'bossBram', scale: 1.8, r: 30, hp: 620, speed: 46,
    banner: "수문장 '갈고리 브람'",
    punish: 'charge', sig: 'shieldCharge',
    p1: ['snare>charge', 'fan:rock:snipe>snare', 'charge>ring', 'uniq'],
    p2: ['snare>charge>fan:rock', 'pulse', 'ring>snare>charge', 'charge>snare>charge', 'uniq'],
    rageText: '갈고리에 걸리면 끝이다!',
    intro: '강에 버린 것들이 기어 올라오는군. 다시 가라앉혀주마.',
    outro: '건진 게… 아니라… 버린 거였나… 나는…',
    deathPalette: ['#5c9ded', '#8a653f', '#c8ccd8'],
  },
  61: {
    awakened: true, name: "뱃사공 '침묵의 요른'", sprite: 'bossJorn', scale: 1.8, r: 30, hp: 700, speed: 34,
    banner: "뱃사공 '침묵의 요른'",
    punish: 'volley', punishProj: 'soul', sig: 'halfSweep',
    p1: ['sweep>spiral:soul', 'spiral:soul>ring', 'fan:soul:snipe>sweep', 'uniq'],
    p2: ['spiral:soul>sweep>ring', 'pulse', 'ring:gap>spiral:soul', 'sweep>fan:soul:cross', 'uniq'],
    rageText: '…….',
    intro: '……. (노를 든다)',
    outro: '…축일마다… 실어 날랐다… 산 사람을…',
    deathPalette: ['#3a5a8a', '#8f8577', '#c8d4e4'],
  },
  // 3막 「영지와 재판소」
  62: {
    awakened: true, name: "위증 서기장 '퀼른'", sprite: 'bossQuill', scale: 1.7, r: 28, hp: 560, speed: 52,
    mechanic: { type: 'regen', label: '위증의 가호 — 부하가 살아있는 동안 기록이 그를 지킨다' },
    banner: "위증 서기장 '퀼른'",
    punish: 'volley', punishProj: 'soul', sig: 'brandZone',
    p1: ['summon:acolyte>fan:soul', 'curse>fan:soul:snipe', 'fan:soul:cross>curse', 'uniq'],
    p2: ['summon:shade>curse>fan:soul', 'mortar', 'fan:soul:snipe>summon:acolyte', 'curse>fan:soul:cross', 'uniq'],
    rageText: '기록은 조작하면 그만이다!',
    intro: '네 죄목? 내가 썼다. 잉크 값은 영지로 받았지.',
    outro: '고쳐 쓸 수… 없는 기록도… 있었군…',
    deathPalette: ['#b8ae96', '#7a1c28', '#3a2c1a'],
  },
  63: {
    // 관통 v3: 3막 홀수층 5조우 × 사망 ~10 = 구간 최다 군집 (짝수층 퀼른은 0) — 중갑 cap 2로
    // TTK가 극단적으로 길어 링 연쇄 노출이 누적됐다. cap 2→3: 강타 경감은 유지하되 TTK 단축
    awakened: true, name: "사병대장 '철퇴 가로크'", sprite: 'bossGarok', scale: 1.9, r: 32, hp: 760, speed: 38,
    mechanic: { type: 'armor', cap: 3, label: '영주의 중갑 — 강한 일격을 경감한다' },
    banner: "사병대장 '철퇴 가로크'",
    punish: 'charge', sig: 'miniSig',
    p1: ['charge>ring', 'ring>fan:rock', 'sweep>sweep>ring', 'uniq'],
    p2: ['charge>ring>fan:rock', 'mortar', 'ring>ring', 'sweep>charge>ring', 'uniq'],
    rageText: '뼈째로 갈아주마!',
    intro: '공작님 포도밭에 거름이 필요하던 참이다.',
    outro: '월급은… 좋았는데… 말이지…',
    deathPalette: ['#6e7383', '#8a653f', '#c22030'],
  },
  // 4막 「역병의 마을」
  64: {
    awakened: true, name: "역병 의사 '부리가면 코르부스'", sprite: 'bossCorvus', scale: 1.8, r: 29, hp: 640, speed: 44,
    mechanic: { type: 'regen', label: '검은 처방 — 부하가 살아있는 동안 스스로를 치료한다' },
    banner: "역병 의사 '부리가면 코르부스'",
    punish: 'volley', punishProj: 'spore', sig: 'sanctPulse',
    p1: ['geyser:poison>fan:spore', 'summon:sporePuff>ring', 'fan:spore:snipe>geyser:poison', 'uniq'],
    p2: ['curse>geyser:poison>fan:spore', 'mortar:poison', 'fan:spore:cross>summon:sporePuff', 'geyser:poison>ring:gap', 'uniq'],
    rageText: '진단: 전원 소각 대상!',
    intro: "'역병'의 정체를 아는 자는 둘 뿐이다. 왕과, 나.",
    outro: '역병 같은 건… 처음부터… 없었어…',
    deathPalette: ['#6ab04c', '#23202c', '#d8d3c5'],
  },
  65: {
    awakened: true, name: "소각로장 '재의 우르쉬'", sprite: 'bossUrsh', scale: 1.9, r: 31, hp: 720, speed: 40,
    mechanic: { type: 'rage', label: '소각로의 열기 — 시간이 지날수록 백열한다' },
    banner: "소각로장 '재의 우르쉬'",
    punish: 'charge', punishTrail: true, sig: 'halfSweep',
    p1: ['charge:trail>geyser:fire', 'fan:fire>charge:trail', 'geyser:fire>ring', 'uniq'],
    p2: ['geyser:fire>charge:trail>fan:fire', 'beam', 'fan:fire:cross>geyser:fire', 'charge:trail>ring>fan:fire', 'uniq'],
    rageText: '소각로는 식지 않는다!',
    intro: '명단도 태우고, 시신도 태우고… 너도 태우면 완벽하군.',
    outro: '재는… 말이 없을 줄… 알았는데…',
    deathPalette: ['#e25822', '#5e564b', '#23202c'],
  },
  // 5막 「왕도와 왕좌」
  66: {
    awakened: true, name: "왕실 마법장 '별지기 오벨'", sprite: 'bossObel', scale: 1.8, r: 29, hp: 660, speed: 42,
    mechanic: { type: 'veil', veils: [0.5], label: '성좌 장막 — 별이 도는 동안 구슬만이 약점이다' },
    banner: "왕실 마법장 '별지기 오벨'",
    punish: 'volley', punishProj: 'soul', sig: 'brandZone',
    p1: ['spiral:soul>curse', 'beam', 'fan:soul:cross>ring:gap', 'ring:gap>fan:soul:snipe', 'uniq'],
    p2: ['curse>spiral:soul>fan:soul', 'echo', 'summon:voidSpawn>ring:gap', 'spiral:soul>fan:soul:cross', 'uniq'],
    rageText: '별은 거짓을 말하지 않는다 — 내가 대신 말했을 뿐!',
    intro: '오르빈은 별을 읽고 죽었다. 나는 읽고도 입을 다물었지.',
    outro: '별점은… 옳았다… 전부… 오르빈… 미안…',
    deathPalette: ['#8a5ac2', '#a9e3ff', '#2e4a74'],
  },
  67: {
    awakened: true, name: "검은 창기병 '무언의 기수'", sprite: 'bossLancer', scale: 1.8, r: 30, hp: 740, speed: 50,
    banner: "검은 창기병 '무언의 기수'",
    punish: 'charge', sig: 'triCharge',
    p1: ['charge>charge', 'sweep>charge', 'fan:rock:snipe>charge', 'uniq'],
    p2: ['charge>charge>charge', 'echo>charge', 'sweep>charge>ring', 'charge>fan:rock:snipe>charge', 'uniq'],
    rageText: '(창끝이 낮아진다)',
    intro: '(아무 말 없이 창을 겨눈다)',
    outro: '(투구 속에서, 아주 오래된 한숨이 새어 나온다)',
    deathPalette: ['#23202c', '#7a1c28', '#c8ccd8'],
  },
};

// 보스 타격 피해 (v142): 1~3층은 1(온보딩 — 압박은 템포가 담당), 4층+는 2 — 실수 3번이 죽음
function bossDmg() { return Dungeon.floor >= 4 ? 2 : 1; }

// 중간 층 (11~19·21~29·31~39): 각성 보스(6~9)가 원혼으로 재림, 층당 +15% HP.
// 20 로트가르 / 30 발디아 / 40 이노첸시오 = 막보스 (고정 HP). 41층+ (무한 가도): 각성 5보스 순환.
// 모듈 스코프 공유 (v142 핫픽스: bossDefFor 안으로 옮겼다가 createBoss의 hpScale 참조가 깨져
// 11층+ 보스 스폰이 전부 죽었다 — 단락 평가 탓에 1~10층만 무사해 검증을 통과한 잠복 버그)
const BOSS_FIXED = { 20: 20, 30: 30, 40: 40, 45: 45, 50: 50 };
const BOSS_CYCLE_POOL = { 2: [60, 61], 3: [62, 63], 4: [64, 65], 5: [66, 67] };

// 층 → 보스 정의 해석 (v142: 예고 연출과 공유 — "이 층의 끝에서 누가 기다리는가")
function bossDefFor(floor) {
  const FIXED = BOSS_FIXED, CYCLE_POOL = BOSS_CYCLE_POOL;
  const defKey = floor <= 10 ? floor
    : FIXED[floor] ? FIXED[floor]
    : floor <= 50 ? CYCLE_POOL[Math.min(5, Math.ceil(floor / 10))][floor % 2]
    : [60, 61, 62, 63, 64, 65, 66, 67][(floor - 51) % 8];
  const def = BOSS_DEFS[defKey] || BOSS_DEFS[1];
  def._key = defKey; // 도감 귀속용 실제 킷 id
  return def;
}

function createBoss(floor, x, y) {
  const def = bossDefFor(floor);
  // 계측 조정 (관통 v2): 배율 무제한이라 49층 절망의 바르곤 hp 4450 > 흰 늑대 3600 —
  // 필러 보스가 랜드마크 보스를 넘어섰고, 3런 사망의 절반이 이 한 킷에 몰렸다 (49층 17회 군집).
  // 상한 ×4.5: 49층 hp ≈2900 — 5막 서열(늑대 3600 < 왕 5000)을 회복한다. 51층+ 무한은 상한 없음 (의도된 지옥)
  // v148 (사장 F9 실측: 11~20층 보스 TTK 10~13초 — 긴장이 생길 시간이 없다): 선형 +0.15/층은
  // 곱연산으로 자라는 플레이어 화력에 반드시 추월당한다 (v141 잡몹과 동일 결론) → 지수 1.17^(f-10).
  // 서열 보존은 배율 상한 대신 절대 HP 상한 3200으로: 필러가 흰 늑대(3600)·왕(5000)을 넘지 않는다.
  // 51층+ 무한은 기존 선형 유지 (지수로 두면 1.17^41=×620 — 의도된 지옥이 아니라 버그다)
  const rawScale = floor > 50 ? 1 + 0.15 * (floor - 10) : Math.pow(1.17, floor - 10);
  const hpScale = floor <= 10 || BOSS_FIXED[floor] ? 1 : rawScale;
  // v166: 보상 1/3 축소로 **플레이어 화력이 절반**이 됐다 (실측 기사 3층 공6→3, 5층 9→5).
  // 잡몹은 그 덕에 딱 좋아졌지만(1.3~1.9타 → 2.1~4.2타) 보스는 그대로 두면 두 배로 길어진다 —
  // 봇 실측 2층 보스 **255초**, 3층 135초. 화력 감소분만큼 보스 HP도 함께 내린다
  const powerAdj = 0.62;
  let hp = floor > 10 && floor <= 50 && !BOSS_FIXED[floor]
    ? Math.min(3200, Math.round(def.hp * hpScale * powerAdj))
    : Math.round(def.hp * hpScale * powerAdj);
  // 막 결산 고정 보스(21~50층)가 필러 상한(3200) 아래로 꺼지는 서열 역전 방지 —
  // 저작 HP가 구 선형 곡선 기준이라 20층 1600·30층 2100이 필러보다 약했다 (v148 곡선 검증에서 발각).
  // 최종 서열: 필러 3200 < 막 결산 3520 < 흰 늑대 3600 < 왕 5000
  if (BOSS_FIXED[floor] && floor > 10 && floor <= 50) hp = Math.max(hp, 3520);
  // ── 어픽스 변주 (v150 "패턴이 단조롭다"): 필러 보스(11층+)는 조우마다 다른 얼굴로 온다 ──
  // 이름 접두가 곧 예고: 등장 카드에서 읽고 대비하는 것까지가 플레이. 21층+는 2중 변주
  const AFFIXES = [
    { id: 'swift', pre: '성마른', label: '성마른 — 모든 초식이 빨라진다' },
    { id: 'guarded', pre: '무장한', label: '무장한 — 호위병과 함께 싸운다' },
    { id: 'burning', pre: '타오르는', label: '타오르는 — 지나간 자리가 불탄다' },
    { id: 'ironhide', pre: '끈질긴', label: '끈질긴 — 강한 일격을 경감한다' },
    { id: 'echoing', pre: '메아리치는', label: '메아리치는 — 고유기가 한 번 더 울린다' },
  ];
  let affixes = [];
  if (floor > 10 && !BOSS_FIXED[floor]) { // 51층+ 무한 가도에도 — 순환 킷의 반복 조우일수록 변주가 필요하다
    const n = floor >= 21 ? 2 : 1;
    const pool = [...AFFIXES];
    for (let i = 0; i < n; i++) affixes.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  const affixName = affixes.length ? affixes.map((a) => a.pre).join(' ') + ' ' + def.name : def.name;
  return {
    type: 'boss', isBoss: true,
    name: affixName,
    defId: def._key, // 도감 귀속 — 층 산식 대신 실제 킷으로
    // 속성 (v200) — 죄목이 정한다. 주속성은 1페이즈부터, 부속성은 2페이즈부터
    elems: BOSS_ELEM[def._key] || ['curse'],
    elem() {
      const list = this.elems;
      if (this.phase >= 2 && list.length > 1) return list[Math.floor(Math.random() * list.length)];
      return list[0];
    },
    // 공격에 속성을 실어 보낸다 — 상태 부여 + 바닥 잔여물을 한 곳에서 낸다.
    // 「한 곳에서만」이 중요하다: 여기저기서 걸면 걸렸는지 셀 수가 없다
    strike(game, x, y, { status = true, zone = true, kind = null } = {}) {
      const k = kind || this.elem();
      const info = ELEM_INFO[k];
      if (!info) return k;
      if (status && game.applyStatus) {
        const p = game.player;
        if (Math.hypot(p.x - x, p.y - y) < 46 + p.r) game.applyStatus(k, info.sec);
      }
      if (zone) {
        // ★ 계측에서 boss.js 의 zones.push 는 **0회**였다 — 보스가 싸운 자리에 흔적이 없었다.
        //   이제 방이 시간에 따라 변한다: 안전지대가 줄며 HP 인플레 없이 압박이 생긴다
        game.zones.push({ x, y, r: 52, life: info.life, kind: info.zone, tickT: 0, hit: null, byBoss: true, elem: k });
        if (game.zones.length > 26) game.zones.splice(0, game.zones.length - 26);
      }
      return k;
    },
    def,
    affixes: affixes.map((a) => a.id),
    affixLabel: affixes.map((a) => a.label.split(' — ')[0]).join(' · ') || '',
    x, y,
    hp, maxHp: hp,
    r: def.r || 24,
    speed: def.speed, xpVal: 0,
    dead: false, elite: false,
    spawnT: 0.6, // 등장 연출
    flash: 0,
    kbx: 0, kby: 0,
    animT: 0,
    flip: false,
    hitCd: 0,
    status: { burn: 0, burnTick: 0, shock: 0, poison: 0, poisonTick: 0 },
    phase: 1,
    state: 'enter',
    stateT: 0,
    patternIdx: 0,
    attack: null,     // 현재 공격 {kind, opt}
    _patN: 0,          // v150 패턴 문법: 초식 카운터 — 4수마다 고유기가 온다
    _echoes: [],       // v150 echo 잔상 분신
    _windT: 0, _windMax: 0.34, _windA: 0, _windDmg: 1, _whiffT: 0, // v175 접촉 예고 (잡몹과 같은 필드명 — 렌더가 공용 패스로 그린다)
    // 기믹 상태 (끈질긴 어픽스: 철갑 +1, 무기믹 보스는 cap 1 부여)
    // v160: 어픽스 「끈질긴」이 armorCap에 +1을 하던 것을 폐기 — 효과가 **정반대로** 걸려 있었다.
    //  · 철갑 보스: cap 2 → 3 = 경감이 약해진다 (어픽스인데 보스가 약해짐)
    //  · 기믹 없는 보스: cap 0 → **1** = 모든 직접 타격이 1로 잘려 3200HP 보스가 사실상 불사
    //    (감사 실측: 25층 직격 TTK 약 16분). 11~50층 조우의 상당수가 여기 걸렸다
    // → armorCap은 킷 설계 그대로 두고, 어픽스는 별도 축(직접 타격 -15%)으로 분리한다
    armorCap: def.mechanic?.type === 'armor' ? def.mechanic.cap : 0,
    ironhide: affixes.some((a) => a.id === 'ironhide'),
    rageT: 0,
    rageStacks: 0,
    veilsDone: 0,
    phased: false,    // 어둠 장막 중 무적
    _regenTick: 0,
    _regenPause: 0,
    fightT: 0,        // 전투 경과 시간 — 소프트 인레이지
    enrage: 0,        // 30초마다 +1 (최대 3): 패턴 가속
    swingCount: 0,
    aimDir: { x: -1, y: 0 },
    curses: [],
    _comboQueue: [],   // 초식 연계 큐 (P1)
    _delayed: [],      // 지연 탄막 (P2 변주)
    _farT: 0,          // 카이팅 응징 게이지
    _comboWind: false,
    _lastPatIdx: -1,

    effSpeed() { return this.speed * (this.status.shock > 0 ? 0.7 : 1) * (this.phase === 2 ? 1.15 : 1); },

    tickTimers(dt) {
      this.animT += dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.hitCd > 0) this.hitCd -= dt;
      if (this._whiffT > 0) this._whiffT -= dt;
      if (this._windT > 0) {
        this._windT -= dt;
        if (this._windT <= 0) this._resolveWind(Game); // v175: 접촉 예고 만료
      }
      // v150 echo 잔상 감쇠
      for (let i = this._echoes.length - 1; i >= 0; i--) {
        this._echoes[i].t -= dt;
        if (this._echoes[i].t <= 0) this._echoes.splice(i, 1);
      }
    },

    _parseStep(step) {
      const [kind, ...opts] = step.split(':');
      return { kind, opt: opts };
    },

    // 초식 시스템 (P1): 'a>b' 콤보 문자열 + 랜덤 선택(직전 반복 회피) — 순서 암기가 안 통한다.
    // 거리 편향 (원거리 보스전 피드백 2차): 보스가 플레이어의 포지셔닝을 읽는다 —
    // 멀리 서면 저격·간헐천·나선·소환 초식을, 붙으면 링·휩쓸기·돌진 초식을 우대한다
    _nextPattern(d) {
      const list = (this._onslaught && this.def.p3) ? this.def.p3 : this.phase === 2 ? this.def.p2 : this.def.p1;
      let pool = list;
      if (d != null) {
        // ★ v199 결함① (기획안 §1-2) — 거리 필터가 패턴 풀을 **1개로 붕괴**시켰다.
        // 근접(d<150)에서 60% 확률로 ring|sweep|charge|pulse|echo 만 남기는데,
        // 1층 오스문드 p1 5개 중 통과가 sweep>sweep 하나뿐이다.
        // 게다가 풀이 1개가 되면 아래 「직전 반복 회피」 가드(pool.length > 1)가 통째로 꺼져
        // **같은 초식이 무한 반복**된다. 실측: 1페이즈 3회 중 2회가 휘두르기 4연속,
        // 사장 페이스(13초)에서 목격 패턴 4.0개 — 저작된 6.87개의 58%만 화면에 닿았다.
        // p1 풀이 1개로 붕괴하는 보스 11/23. 사장이 기사(근접)로 붙어 싸우니 정확히 여기 걸린다.
        //
        // 고침: 필터는 **선호**지 배제가 아니다. 최소 3개는 남긴다 — 남는 게 그보다 적으면
        // 원래 목록에서 채워 넣는다. 거리에 맞는 초식이 자주 나오되, 다른 그림도 계속 온다
        const prefer = (re) => {
          const sub = list.filter((c) => re.test(c));
          if (!sub.length) return null;
          if (sub.length >= 3) return sub;
          const rest = list.filter((c) => !sub.includes(c));
          return sub.concat(rest.slice(0, 3 - sub.length));   // 선호 + 보충 = 최소 3
        };
        if (d > 300 && Math.random() < 0.75) {
          pool = prefer(/snipe|geyser|spiral|summon|curse|beam|mortar/) || pool;
        } else if (d < 150 && Math.random() < 0.6) {
          pool = prefer(/ring|sweep|charge|pulse|echo/) || pool;
        }
      }
      let idx = Math.floor(Math.random() * pool.length);
      if (pool.length > 1 && list.indexOf(pool[idx]) === this._lastPatIdx) idx = (idx + 1) % pool.length;
      this._lastPatIdx = list.indexOf(pool[idx]);
      // ★ v199 결함② — patternIdx 가 0으로 초기화된 뒤 **어디서도 증가하지 않았다.**
      // spiral 의 회전각이 patternIdx*0.45 라 영원히 0 → 나선 탄막이 매번 **완전히 같은 눈송이**.
      // 「나선」이라는 이름이 거짓말이었다. 초식을 고를 때마다 올린다 (7종 보스가 쓴다)
      this.patternIdx = (this.patternIdx || 0) + 1;
      const steps = pool[idx].split('>');
      this._comboQueue = steps.slice(1);
      return this._parseStep(steps[0]);
    },

    // 초식의 다음 연계로 — 남은 연계가 없으면 idle
    // 시전 시작 — 게이지·임계·연출
    castStart(game) {
      const f = Dungeon.floor;
      this.castMax = f <= 5 ? 2.2 : 1.6;
      this.castT = 0;
      // 임계 = 최대 HP의 12%. 층이 올라도 「몇 대」의 감각이 유지되도록 비율로 잡는다.
      // 화력이 약한 빌드는 못 끊는다 — 그게 성장의 보상이 된다
      this.castNeed = Math.max(3, Math.round(this.maxHp * 0.12));
      this.castDmg = 0;
      this.state = 'cast';
      this.stateT = 0;
      this.noFlinch = true;                 // 무경직 — 때려도 안 밀린다
      Particles.text(this.x, this.y - this.r - 34, '시전 — 끊어라!', { color: '#ffd866', size: 15 });
      Particles.ring(this.x, this.y, { r0: 10, r1: 70, life: 0.4, color: '#ffd866', width: 4 });
      AudioSys.tellBoss(this.x, this.y);
    },
    // 시전 중 피해 누적 — combat.js 가 부른다
    castHit(dmg, game) {
      if (this.state !== 'cast') return false;
      this.castDmg += dmg;
      if (this.castDmg < this.castNeed) return false;
      // ── 끊었다 ──
      this.state = 'groggy';
      this.stateT = 0;
      this.groggyT = 2.0;
      this.noFlinch = false;
      this.castT = 0;
      this._comboQueue = [];
      Particles.text(this.x, this.y - this.r - 34, '시전 차단!', { color: '#5ce0e6', size: 19 });
      Particles.ring(this.x, this.y, { r0: 8, r1: 110, life: 0.5, color: '#5ce0e6', width: 6 });
      Particles.burst(this.x, this.y, { count: 20, colors: ['#5ce0e6', '#a9fff7', '#ffffff'], speed: 190, life: 0.6, size: 3 });
      if (game) { game.slowmoT = 0.35; Renderer.shake(5, 0.2); }
      AudioSys.pdodge();
      return true;
    },

    _endMove() {
      if (this._comboQueue && this._comboQueue.length > 0) {
        this.attack = this._parseStep(this._comboQueue.shift());
        this._comboWind = true; // 연계는 짧은 예고 (그래도 예고는 있다)
        this.state = 'windup';
        this.stateT = 0;
      } else {
        this.state = 'idle';
      }
    },

    update(dt, game) {
      this.tickTimers(dt);
      this.stateT += dt;
      const p = game.player;
      const dx = p.x - this.x, dy = p.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      if (this.state !== 'charge') this.flip = dx < 0;

      // 지연 탄막 (P2 변주: 교차 부채꼴·속사 2연) — 첫 발사 후 잠깐 뒤 두 번째 사격
      if (this._delayed.length > 0) {
        for (let i = this._delayed.length - 1; i >= 0; i--) {
          const v = this._delayed[i];
          v.t -= dt;
          if (v.t <= 0) {
            const ang = v.aim ? Math.atan2(p.y - this.y, p.x - this.x) : v.baseAngle + (v.offset || 0);
            for (let j = 0; j < v.n; j++) {
              const a = ang + (j - (v.n - 1) / 2) * v.spread;
              game.spawnProjectile(v.projKind, this.x, this.y, { x: Math.cos(a), y: Math.sin(a) }, { speed: v.speed, dmg: bossDmg() });
            }
            AudioSys.shoot();
            this._delayed.splice(i, 1);
          }
        }
      }
      // 고유기 예약 큐 (v117) — 순차 연출용 범용 스케줄러
      if (this._uq && this._uq.length > 0) {
        for (let i = this._uq.length - 1; i >= 0; i--) {
          const q = this._uq[i];
          q.t -= dt;
          if (q.t <= 0) {
            this._uq.splice(i, 1);
            try { q.fn(this, game); } catch (e) { /* 고유기 오류가 보스전을 멈추지 않게 */ }
          }
        }
      }
      // 왕의 진노 2차 패턴 (v130): 현상금 8단 — 체력 30%에서 '최후의 명령' 각성 (1회).
      // 즉시 고유기 1회 + 이동 +15% 영구 + 이후 6초마다 고유기 추가 사이클 — 수치가 아니라 패턴 밀도가 바뀐다
      if (game.pacts && game.pacts.wrath && !this.dead && this.spawnT <= 0) {
        if (!this._wrathAwake && this.hp <= this.maxHp * 0.3) {
          this._wrathAwake = true;
          this.speed *= 1.15;
          game.banner = { text: `왕의 진노 — ${this.name}이(가) 최후의 명령을 받든다!`, life: 2.0, maxLife: 2.0, color: '#e43b44' };
          Renderer.shake(6, 0.4);
          AudioSys.levelup();
          Particles.ring(this.x, this.y, { r0: 10, r1: 90, life: 0.5, color: '#e43b44', width: 5 });
          this._uniqMove(game, dx, dy, d);
        }
        if (this._wrathAwake) {
          this._wrathT = (this._wrathT || 0) + dt;
          if (this._wrathT >= 6) {
            this._wrathT = 0;
            this._uniqMove(game, dx, dy, d);
            Particles.text(this.x, this.y - 46, '진노!', { color: '#e43b44', size: 13 });
          }
        }
      }
      // 카이팅 응징 (원거리 보스전 피드백 2차): 시전 중에도 게이지가 찬다 —
      // idle 한정으로는 실전에서 사실상 발동하지 않았다 (사인 귀속: idle은 사이클당 ~1초뿐)
      if (d > 300 && this.state !== 'enter' && this.state !== 'charge' && this.state !== 'sweep') this._farT += dt;
      else if (d < 240) { this._farT = 0; this._punishN = 0; }

      // 넉백 저항
      if (Math.abs(this.kbx) > 1 || Math.abs(this.kby) > 1) {
        World.moveEntity(this, this.kbx * 0.3 * dt, this.kby * 0.3 * dt);
        this.kbx *= Math.pow(0.0001, dt);
        this.kby *= Math.pow(0.0001, dt);
      }

      // ── 소프트 인레이지: 오래 끌수록 보스가 빨라진다 (30초마다, 최대 3중첩) ──
      // 긴장감의 시간 축 — "언젠가는 잡겠지"가 아니라 "빨리 잡아야 한다"
      if (this.state !== 'enter') {
        this.fightT += dt;
        const want = Math.min(3, Math.floor(this.fightT / 30));
        if (want > this.enrage) {
          this.enrage = want;
          game.banner = { text: `${this.name}의 살기가 짙어진다! (×${this.enrage})`, life: 1.6, maxLife: 1.6, color: '#e43b44' };
          AudioSys.roar();
          Particles.ring(this.x, this.y, { r0: 10, r1: 110, life: 0.5, color: '#e43b44', width: 4 });
        }
      }

      // ── 기믹: 포자 갑피 (부하 생존 시 재생) ──
      // 컨트롤 해법: 부하를 처치하면 재생이 5초 멈춘다 — 광역 트리가 없어도
      // 부하를 빠르게 끊으면서 보스를 때리면 뚫을 수 있다.
      if (this.def.mechanic?.type === 'regen' && this.state !== 'enter') {
        const minionCount = game.enemies.filter((o) => !o.isBoss && !o.dead).length;
        if (this._lastMinions !== undefined && minionCount < this._lastMinions) {
          this._regenPause = 5;
          Particles.text(this.x, this.y - 40, '재생 정지!', { color: '#ffd866', size: 13 });
        }
        this._lastMinions = minionCount;
        if (this._regenPause > 0) this._regenPause -= dt;
        if (minionCount > 0 && this._regenPause <= 0 && this.hp < this.maxHp) {
          // 계측 (검사·열기5): 2층 피해 110+ = 전층 최대 — 근접 단일딜은 부하 정리가 느려
          // 재생을 뚫는 데 오래 걸린다. 6→4/s (재생 정지 컨트롤 해법은 그대로 유효)
          // 재생 총량 예산 (관통 v3): 딜이 재생을 못 이기는 약체 빌드에게 재생전은 '어려움'이 아니라
          // 수학적으로 끝나지 않는 소모전이었다 (몰귀 7연사·로트가르 33연사). 한 전투에서 최대체력의
          // 100%까지만 재생 — 예산이 마르면 갑피가 말라붙고, 오래 버티면 반드시 끝나는 싸움이 된다.
          // 정상 빌드는 예산 근처에도 못 가므로 중앙값 난이도는 불변.
          // v166: 예산 100% → 50%. 재생 예산은 사실상 '실효 HP 2배'라, 화력이 절반이 되자
          // 재생 보스가 수학적으로 끝나지 않는 소모전으로 되돌아갔다 (봇 2층 255초)
          if (this._regenBudget == null) this._regenBudget = this.maxHp * 0.5;
          if (this._regenBudget > 0) {
            const add = Math.min(3 * dt, this._regenBudget, this.maxHp - this.hp);
            this.hp += add;
            this._regenBudget -= add;
            if (this._regenBudget <= 0) {
              game.banner = { text: '재생의 힘이 다했다 — 갑피가 말라붙는다!', life: 2.0, maxLife: 2.0, color: '#ffd866' };
              AudioSys.roar();
            }
            this._regenTick += dt;
            if (this._regenTick >= 1.0) {
              this._regenTick = 0;
              Particles.text(this.x, this.y - 40, '재생 +3', { color: '#38b764', size: 12 });
            }
          }
        }
      }

      // ── 기믹: 백열 (16초마다 가속, 최대 4중첩) ──
      // 규칙 서사 (v122): 증거 20+로 왕좌에 서면 성배의 고동이 흔들린다 — 진실이 곧 무기.
      // 보너스 방향으로만 작동한다 (미수집 유저는 기존 밴드 그대로 — 수집을 게이트로 만들지 않는다)
      if (this.def.mechanic?.type === 'rage' && this.state !== 'enter') {
        const rageCap = (this.defId === 50 && Meta.clueCount() >= 20) ? 2 : 4;
        this.rageT += dt;
        if (this.rageT >= 16 && this.rageStacks >= rageCap && rageCap === 2 && !this._truthShown) {
          this._truthShown = true;
          game.banner = { text: '성배가 진실 앞에 떨고 있다 — 왕의 고동이 더는 빨라지지 못한다', life: 2.6, maxLife: 2.6, color: '#f7b32b' };
        }
        if (this.rageT >= 16 && this.rageStacks < rageCap) {
          this.rageT = 0;
          this.rageStacks++;
          game.banner = { text: `${this.name}의 기세가 오른다! (×${this.rageStacks})`, life: 1.3, maxLife: 1.3, color: '#ff7043' };
          AudioSys.roar();
          Particles.burst(this.x, this.y, { count: 18, colors: ['#ff7043', '#ffd866'], speed: 180, life: 0.5, size: 4 });
        }
      }

      // ── 기믹: 어둠 장막 (HP 70%·35%에서 무적 + 영혼 구슬) ──
      if (this.def.mechanic?.type === 'veil' && this.state !== 'veil' && this.state !== 'enter') {
        const thresholds = this.def.mechanic.veils || [0.7, 0.35];
        if (this.veilsDone < thresholds.length && this.hp <= this.maxHp * thresholds[this.veilsDone]) {
          this.state = 'veil';
          this.stateT = 0;
          this.phased = true;
          this.attack = null;
          game.banner = { text: '영혼 구슬을 파괴하라!', life: 2.0, maxLife: 2.0, color: '#b13ae0' };
          AudioSys.roar();
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2 + Math.random();
            const pos = {
              x: Math.min(Math.max(this.x + Math.cos(a) * 200, TS * 1.5), TS * (World.cols - 1.5)),
              y: Math.min(Math.max(this.y + Math.sin(a) * 150, World.offsetY + TS * 1.5), World.offsetY + TS * (World.rows - 1.5)),
            };
            game.enemies.push(createEnemy('soulOrb', pos.x, pos.y, false, 1 + (Dungeon.floor - 1) * 0.3));
          }
        }
      }

      // ── 3페이즈 '맹공' (각성 보스 전용, HP 25%↓): 수치가 아니라 판정 밀도로 조인다 —
      // 패턴 간격 단축 + 시전마다 추적 장판 1개 중첩. 전부 피할 수 있지만 안전한 틈이 좁아진다
      if (!this._onslaught && this.def.awakened && this.phase === 2 && this.hp <= this.maxHp * 0.25 && this.state !== 'veil') {
        this._onslaught = true;
        game.banner = { text: this.def.rageText2 || `${this.name} — 최후의 맹공!`, life: 1.8, maxLife: 1.8, color: '#e43b44' };
        AudioSys.roar();
        // v176: 리저 → 임팩트 → 반음 올라간 이름. 왕만 곡이 바뀌고 나머지 22종은 stage로 반응한다
        if (typeof BossAudio !== 'undefined') BossAudio.phase(this, 3);
        Renderer.shake(6, 0.35);
        Particles.ring(this.x, this.y, { r0: 12, r1: 140, life: 0.6, color: '#e43b44', width: 5 });
      }

      // 페이즈 전환 — v150: 격노의 첫 수는 고유기. "여기서부터 다르다"를 수치가 아니라 기술로 선언
      if (this.phase === 1 && this.hp <= this.maxHp / 2 && this.state !== 'veil') {
        this.phase = 2;
        this.state = 'idle';
        this.stateT = -0.8;
        this.attack = null;
        game.banner = { text: this.def.rageText, life: 1.6, maxLife: 1.6 };
        Renderer.shake(7, 0.4);
        AudioSys.roar();
        if (typeof BossAudio !== 'undefined') BossAudio.phase(this, 2);   // v176
        Particles.burst(this.x, this.y, {
          count: 26, colors: this.def.deathPalette, speed: 200, life: 0.7, size: 4,
        });
        // v155: 2페이즈 목록이 고유기를 쓰는 킷에서만 — 킷 설계를 문법이 덮어쓰지 않는다
        if (Array.isArray(this.def.p2) && this.def.p2.some((c) => /\buniq\b/.test(c))) {
          (this._uq = this._uq || []).push({ t: 0.9, fn: (b, g) => {
            if (b.dead || b.state === 'veil') return;
            const pp = g.player;
            const ddx = pp.x - b.x, ddy = pp.y - b.y;
            b._uniqMove(g, ddx, ddy, Math.hypot(ddx, ddy) || 1);
          } });
        }
      }

      // 어픽스 '무장한' (v150): 전투 개시 호위 2 + 20초마다 재소집 1 (재생 기믹과 자연 결합)
      if (this.affixes && this.affixes.includes('guarded') && this.state !== 'enter' && this.spawnT <= 0) {
        this._guardT = (this._guardT ?? 999) + dt;
        if (this._guardT >= 20) {
          this._guardT = 0;
          const n = this._guardInit ? 1 : 2;
          this._guardInit = true;
          const minions = game.enemies.filter((e) => !e.isBoss && !e.dead).length;
          for (let i = 0; i < Math.min(n, 4 - minions); i++) {
            const pos = World.randomSpawnPos(p, 160);
            game.markers.push({ x: pos.x, y: pos.y, type: this.def.punishProj === 'spore' ? 'sporePuff' : 'acolyte', elite: true, t: 0.7 });
          }
        }
      }

      switch (this.state) {
        case 'enter':
          if (this.stateT > 1.2) {
            this.state = 'idle'; this.stateT = 0;
            // 마이크로 서사 (S3): 보스의 첫 마디 — 이름표가 아니라 존재가 되도록
            if (this.def.intro && !this._spoke) {
              this._spoke = true;
              let line = this.def.intro;
              // 다섯 번째 손 — 별지기 오벨만은 관찰자를 '본다': 시선을 자각한 자에게 존재를 일러준다
              if (this.defId === 66 && Meta.data.fifthHand && Meta.data.fifthHand.stage >= 1) {
                line = '오르빈은 별을 읽고 죽었다. 나는 읽고도 입을 다물었지. …그런데 네 뒤의 그것은 뭐냐. 너희를 따라 걷는 — 다섯 번째 손 말이다.';
                if (Meta.data.fifthHand.stage < 2) { Meta.data.fifthHand.stage = 2; Meta.save(); }
                game.showWhisper('…들켰군.');
              }
              game.banner = { text: `"${line}"`, life: 2.4, maxLife: 2.4, color: '#c9b8e8' };
            }
          }
          break;

        case 'idle': {
          this._sigElapsed = (this._sigElapsed || 0) + dt;
          const spd = this.effSpeed();
          World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
          // 원거리 농성 시 공격 템포 상승 — 거리는 안전이 아니라 다른 종류의 압박이 된다
          // v147: 0.9/0.6→0.55/0.35 — 실플레이 재제보 "보스전이 만피로 끝난다". 초식 사이 휴지가
          // 길어 위협이 단발로 끊긴다. 예고(windup)는 그대로 두고 휴지만 줄여 공정한 밀도를 만든다
          // v149: 1~3층 유예 0.8/0.5 — F9 실측: 기사(근접)가 1~2층 보스에 3전 3사 (피격 7/7/8, 20초 내).
          // 다른 난이도 축(보스 1뎀·전역 스케일 0)은 모두 1~3층 계단이 있는데 템포만 일괄이었다.
          // 근접 직업은 템포 상향을 정면으로 받는다 — 온보딩 저점(첫 보스)은 배울 시간을 준다
          // v155: 온보딩 템포를 3단 계단으로. 실측 근거 —
          //  ① 1층 초당 피격 0.39 = HP6 생존 15초 < TTK 20초 (수학적 필패 구조였다)
          //  ② 구 경계(3→4층)에서 0.221→0.402(+82%)의 절벽 + 4층부터 보스 피해 1→2 배가가 겹쳐
          //     실효 생존이 급락 — 문제를 1층에서 4층으로 옮기는 꼴이라 계단을 하나 더 놓는다
          const f = Dungeon.floor;
          // ★ v199 — 승인된 지표는 「13초 안에 목격하는 서로 다른 그림 수」다 (4.0 → 6.0).
          // 결함 3개를 고친 뒤 재보니 1층이 여전히 2.7개였는데, 원인이 다양성이 아니라 **빈도**였다:
          // 휴지 1.0 × 근접 보정 1.15 = 1.15초, 예고까지 사이클 2.9초 → 13초에 **시전 4.5회**.
          // 풀을 아무리 넓혀도 목격 상한이 4.5개다.
          // v155에서 1~3층을 늦춘 건 근접 기사가 3전 3사했기 때문인데, 그 뒤 v188에서
          // 접촉 예고를 0.25→0.42초로 늘려 **인간 반응으로 회피가 성립**하게 됐다.
          // 이제 조여도 된다 — 밀도는 올리되 예고는 그대로다 (읽을 시간은 안 뺏는다)
          const base = f <= 2 ? (this.phase === 2 ? 0.48 : 0.72)
            : f <= 5 ? (this.phase === 2 ? 0.40 : 0.62)
            : (this.phase === 2 ? 0.35 : 0.55);
          // v153 거리 비대칭 보정 (실플레이: "근접은 첫 보스도 벽, 원거리는 순항"):
          // 칼끝 거리(<130)는 휴지 +15% — 근접의 자리값. 원거리 농성(>300)은 가속 유지 + 응징 임계 단축
          const distMul = d < 130 ? 1.15 : d > 300 ? 0.65 : 1;
          const wait = base * Math.pow(0.87, this.rageStacks) * Math.pow(0.85, this.enrage) * (this._onslaught ? 0.6 : 1) * distMul *
            (this.affixes && this.affixes.includes('swift') ? 0.85 : 1); // 어픽스 '성마른'
          if (this.stateT >= wait) {
            // 인장기 (왕의 인장기): HP 75% 이하 첫 발동, 이후 막별 주기 (3막 12s / 4막 10s / 5막 8s)
            if (this.def.sig && !(this.def.sigP3 && !this._onslaught) &&
                this.hp <= this.maxHp * 0.75 && !(this._sigT > 0) && !game.sigActive()) {
              const act = Math.min(5, Math.ceil((Dungeon.floor <= 50 ? Dungeon.floor : 46) / 10));
              const interval = { 1: 999, 2: 999, 3: 12, 4: 10, 5: 8 }[act] || 10;
              // 규칙 서사 (v122): 흰 늑대는 가레스에게 첫 인장기를 겨누다 — 멈칫한다.
              // 배신과 죄책감을 대사가 아니라 프레임으로: 일기토 1회가 불발된다 (가레스 회차 한정, 전투당 1회)
              if (this.defId === 45 && !this._hesitated && game.player && game.player.classId === 'knight') {
                this._hesitated = true;
                game.banner = { text: '늑대의 창끝이 흔들린다 — "…가레스? 그 목소리, 설마."', life: 2.4, maxLife: 2.4, color: '#c9b8e8' };
                this.state = 'idle';
                this.stateT = -1.4;
                break;
              }
              if (!this._sigDone || this._sigElapsed >= interval) {
                this._sigDone = true;
                this._sigElapsed = 0;
                game.startSignature(this, this.def.sig);
                this.state = 'idle';
                this.stateT = -1.6; // 인장기 시전 동안 일반 초식 정지
                break;
              }
            }
            if (this._farT > 2.4 && this.def.punish) { // 임계 3.2→2.4 (v153): 원거리 순항 제보 — 카이팅의 값이 더 빨리 청구된다
              // 응징: 카이팅 거리를 부수는 초식 — 돌진형은 추격, 시전형은 속사 저격.
              // 재범(게이지 리셋 없이 또 참)은 연계가 붙는다 — 눌러앉기의 비용이 커진다
              this._farT = 0;
              this._punishN = (this._punishN || 0) + 1;
              this._comboQueue = [];
              if (this.def.punish === 'charge') {
                this.attack = { kind: 'charge', opt: this.def.punishTrail ? ['trail'] : [] };
                if (this._punishN >= 2) this._comboQueue = ['ring'];
              } else {
                this.attack = { kind: 'fan', opt: [this.def.punishProj || 'soul', 'snipe'] };
                if (this._punishN >= 2) this._comboQueue = ['fan:' + (this.def.punishProj || 'soul') + ':snipe'];
              }
            } else {
              // 패턴 문법 (v150 "랜덤이 곧 밋밋함"): 개막 1수 = 고유기 — 킷의 정체성을 첫 수에 소개.
              // 이후 N수마다 고유기가 돌아온다 — 랜덤 사이에 리듬이 생기고, 이름이 곧 기술임을 잊지 않게
              //
              // v155 (사장 F9 실측, 열기1 기사 1층 보스 4연사): v150 문법이 **해당 페이즈의 패턴 목록을
              // 무시하고** 고유기를 강제해, "입문 보스는 고유기를 2페이즈부터"라는 오스문드의 명시적
              // 온보딩 설계를 짓밟았다 (1페이즈에 「생매장」 3회 실측 — p1 목록엔 uniq가 없는데도).
              // → 현재 페이즈 목록에 uniq가 실제로 있을 때만 강제한다. 설계가 문법보다 우선이다.
              // 주기도 1~3층은 6수로 완화 — 배우는 층에서는 리듬이 느려야 읽힌다.
              const curList = (this._onslaught && this.def.p3) ? this.def.p3 : this.phase === 2 ? this.def.p2 : this.def.p1;
              const uniqAllowed = Array.isArray(curList) && curList.some((c) => /\buniq\b/.test(c));
              const cadence = Dungeon.floor <= 3 ? 6 : 4;
              this._patN++;
              if (uniqAllowed && (this._patN === 1 || this._patN % cadence === 0) && this.spawnT <= 0) {
                this.attack = { kind: 'uniq', opt: [] };
                this._comboQueue = [];
                this._wantCast = true;   // ★ v201 고유기는 '시전'으로 들어간다 (아래 castStart)
              } else {
                this.attack = this._nextPattern(d);
              }
            }
            // ══ 시전 인터럽트 (v201) ══════════════════════════════════════
            // 사장 승인: "무적은 시전 인터럽트로"
            // 무적으로 딜을 막으면 플레이어가 할 일이 없어진다. 반대로 간다 —
            // **시전 중에는 더 아프게 맞고, 대신 경직되지 않는다.**
            //   · 시전 게이지 2.2초(1~5층) / 1.6초(6층+)
            //   · 시전 중 보스는 **무경직**(경직·넉백 면역) + **받는 피해 ×1.5**
            //   · 누적 피해가 임계를 넘으면 시전 취소 + 2.0초 **그로기**
            //   · 못 끊으면 큰 기술이 그대로 나간다
            // → 「무적이라 못 때린다」가 아니라 「지금 때려야 한다」가 된다.
            if (this._wantCast) {
              this._wantCast = false;
              this.castStart(game);
              break;
            }
            this.state = 'windup';
            this.stateT = 0;
            this.aimDir = { x: dx / d, y: dy / d };
            // v177: 보스 초식 예고 — 예고 사다리의 4급. 접촉(0.34초)보다 낮고 길다.
            // 화면의 붉은 경고와 짝을 이룬다 (v159에서 예고를 판정과 일치시킨 그 초식이다)
            AudioSys.tellBoss(this.x, this.y);
          }
          break;
        }

        // ══ 시전 (v201) ══ 게이지가 차는 동안 보스는 무경직·피해 증폭 상태로 서 있다
        case 'cast': {
          this.castT += dt;
          // 시전 중에도 아주 천천히 플레이어 쪽으로 몸을 돌린다 (안 돌면 인형처럼 보인다)
          this.aimDir = { x: dx / d, y: dy / d };
          this.flip = dx < 0;
          if (Math.random() < 0.5) {
            const a = Math.random() * Math.PI * 2, rr = this.r * (2.2 + Math.random() * 0.6);
            Particles.burst(this.x + Math.cos(a) * rr, this.y + Math.sin(a) * rr, {
              count: 1, colors: ['#ffd866', '#fff4c8'], speed: -90, life: 0.45, size: 3,
            });
          }
          if (this.castT >= this.castMax) {
            // ── 못 끊었다 — 큰 기술이 그대로 나간다 ──
            this.noFlinch = false;
            Particles.text(this.x, this.y - this.r - 34, '시전 완료!', { color: '#e43b44', size: 17 });
            Renderer.shake(4, 0.18);
            this.attack = { kind: 'uniq', opt: [] };
            this.state = 'windup';
            this.stateT = 0;
            this._castPunish = true;   // 계측용 — 못 끊고 맞은 횟수
          }
          break;
        }
        // ══ 그로기 ══ 끊긴 보스는 2초간 무방비다. 이게 인터럽트의 보상이다
        case 'groggy': {
          this.groggyT -= dt;
          if (Math.random() < 0.25) {
            Particles.burst(this.x + (Math.random() - 0.5) * this.r, this.y - this.r, {
              count: 1, colors: ['#5ce0e6', '#c8ccd8'], speed: 40, life: 0.5, size: 2, gravity: -60,
            });
          }
          if (this.groggyT <= 0) { this._endMove(); this.stateT = 0; }
          break;
        }
        case 'windup': {
          const k = this.attack.kind;
          // 조준 갱신 (마지막 순간 고정)
          if (this.stateT < 0.35) this.aimDir = { x: dx / d, y: dy / d };
          const windups = { sweep: 0.55, fan: 0.65, curse: 0.5, summon: 0.6, charge: 0.75, ring: 0.6, spiral: 0.7, snare: 0.55, geyser: 0.6, beam: 0.9, mortar: 0.6, pulse: 0.65, echo: 0.5 };
          if ((k === 'fan' || k === 'curse') && Math.random() < 0.4) {
            Particles.burst(this.x + (Math.random() - 0.5) * 40, this.y + (Math.random() - 0.5) * 40, {
              count: 1, colors: this.def.deathPalette, speed: -60, life: 0.3, size: 3,
            });
          }
          if (this.stateT >= (windups[k] || 0.6) * (this._comboWind ? 0.65 : 1)) { // 연계 예고 0.55→0.65
            this._comboWind = false;
            this.stateT = 0;
            this._execute(game, dx, dy, d);
          }
          break;
        }

        case 'sweep': {
          // v159: 스윙마다 방향을 **미리 확정**한다. 종전엔 타격 순간에 재조준해서
          // 2·3타는 예고가 없을 뿐 아니라 내가 벌린 거리를 방향까지 따라와 지웠다 —
          // 위치로는 원리적으로 회피 불가능한 구조였다. 이제 확정된 방향을 0.32초간 예고한다
          if (!this._swingAim) this._swingAim = { x: dx / d, y: dy / d };
          if (this.stateT > 0.32) {
            this.stateT = 0;
            this.swingCount++;
            this.aimDir = this._swingAim;
            this._swingAim = null; // 다음 스윙 방향은 다음 프레임에 다시 확정 → 다시 예고된다
            World.moveEntity(this, this.aimDir.x * 85, this.aimDir.y * 85);
            AudioSys.slash();
            Renderer.shake(3, 0.12);
            game.bossSlashes.push({
              x: this.x, y: this.y,
              angle: Math.atan2(this.aimDir.y, this.aimDir.x),
              range: 95, arc: 2.2, life: 0.15, maxLife: 0.15,
            });
            const pdx = p.x - this.x, pdy = p.y - this.y;
            const pd = Math.hypot(pdx, pdy);
            if (pd < 95 + p.r) { // 무적 게이트 제거 — 대시 관통 시 완벽 회피 판정 (hurtPlayer가 무적 처리)
              let diff = Math.atan2(pdy, pdx) - Math.atan2(this.aimDir.y, this.aimDir.x);
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              if (Math.abs(diff) < 1.35) {
                game.hurtPlayer(bossDmg(), { x: pdx / (pd || 1), y: pdy / (pd || 1) });
              }
            }
            // v155: 1~3층은 1페이즈 2연타 — 온보딩 층의 최대 피해원(휘두르기 58%)을 배울 수 있는 크기로
            const maxSwings = this.phase === 2 ? 4 : (Dungeon.floor <= 3 ? 2 : 3);
            if (this.swingCount >= maxSwings) { this._endMove(); this.stateT = 0; }
          }
          break;
        }

        case 'charge': {
          const trail = this.attack.opt.includes('trail');
          const step = 480 * dt;
          const hit = World.moveEntity(this, this.aimDir.x * step, this.aimDir.y * step);
          if (trail && Math.random() < 0.6) {
            game.firePatches.push({ x: this.x, y: this.y, r: 26, life: 1.6, kind: 'fire' });
          }
          if (Math.hypot(p.x - this.x, p.y - this.y) < p.r + this.r) {
            game.hurtPlayer(bossDmg(), this.aimDir, 420);
            this.strike(game, game.player.x, game.player.y, { zone: false });   // 근접타는 상태만 (장판까지 깔면 붙을 자리가 없다)
          }
          if (hit.x || hit.y || this.stateT > 1.4) {
            Renderer.shake(6, 0.3);
            AudioSys.thud();
            Particles.burst(this.x + this.aimDir.x * 20, this.y, {
              count: 16, colors: ['#5e5e74', ...this.def.deathPalette], speed: 170, life: 0.5, size: 4,
            });
            game.rings.push({ x: this.x, y: this.y, r: 16, maxR: 110, speed: 240, width: 13, dmg: 1, by: this.name });
            this.state = 'stunned';
            this.stateT = 0;
          }
          break;
        }

        case 'stunned':
          if (this.stateT > (this.phase === 2 ? 0.6 : 1.0)) { this._endMove(); this.stateT = 0; } // 그로기(딜 타임)는 온전히 — 연계는 그 후에
          break;

        case 'beam': {
          // 회전 광선 (v150): 1.5초간 2.2rad 쓸기 — 시전 중 본체는 정지 (딜 기회이자 회피 과제)
          const dur = 1.5, sweepArc = 2.2;
          const prog = Math.min(1, this.stateT / dur);
          this._beamAng = this._beamA + this._beamSign * sweepArc * prog;
          const bx = Math.cos(this._beamAng), by = Math.sin(this._beamAng);
          const px = p.x - this.x, py = p.y - this.y;
          const tp = Math.max(0, Math.min(460, px * bx + py * by));
          const perp = Math.hypot(px - bx * tp, py - by * tp);
          if (perp < 20 + p.r && p.invuln <= 0) {
            game.hurtPlayer(bossDmg(), { x: bx, y: by }, 260, this.name);
            this.strike(game, p.x, p.y, { zone: false });
          }
          if (Math.random() < 0.6) {
            const dd = 60 + Math.random() * 380;
            Particles.burst(this.x + bx * dd, this.y + by * dd, { count: 1, colors: this.def.deathPalette, speed: 60, life: 0.25, size: 3 });
          }
          if (this.stateT >= dur) { this._beamAng = null; this._endMove(); this.stateT = 0; }
          break;
        }

        case 'veil': {
          const orbs = game.enemies.filter((o) => o.type === 'soulOrb' && !o.dead);
          if (orbs.length === 0) {
            // 성공: 장막 붕괴 → 긴 그로기 (집중 딜 타임)
            this.phased = false;
            this.veilsDone++;
            this.state = 'stunned';
            this.stateT = -1.4; // 그로기 단축 — 고딜 빌드의 공짜 딜타임 방지
            game.banner = { text: '장막이 깨졌다!', life: 1.6, maxLife: 1.6, color: '#f7b32b' };
            Renderer.shake(6, 0.4);
            AudioSys.thud();
          } else if (this.stateT > 8) {
            // 실패: 구슬 회수 → 15% 회복 + 반격
            for (const o of orbs) {
              o.dead = true;
              Particles.burst(o.x, o.y, { count: 10, colors: ['#b13ae0', '#5c1e5e'], speed: 120, life: 0.4, size: 3 });
            }
            this.phased = false;
            this.veilsDone++;
            this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25); // 실패는 아프게 — 25% 회복
            game.banner = { text: '장막이 영혼을 삼켰다 — 원한이 되살아난다!', life: 1.8, maxLife: 1.8, color: '#e43b44' };
            AudioSys.roar();
            const baseAngle = Math.atan2(p.y - this.y, p.x - this.x);
            for (let i = 0; i < 9; i++) {
              const a = baseAngle + (i - 4) * 0.22;
              game.spawnProjectile('soul', this.x, this.y, { x: Math.cos(a), y: Math.sin(a) }, { speed: 210, dmg: bossDmg() });
            }
            this.state = 'idle';
            this.stateT = 0;
          }
          break;
        }
      }

      // 저주 장판 폭발 처리 (v117: c.r 가변 반경 / c.noHit 무해 마커)
      for (let i = this.curses.length - 1; i >= 0; i--) {
        const c = this.curses[i];
        c.t -= dt;
        if (c.t <= 0) {
          if (c.noHit) { // 고유기 예고 마커 — 소리 없이 스러진다
            Particles.burst(c.x, c.y, { count: 4, colors: ['#ffd866'], speed: 60, life: 0.3, size: 2 });
            this.curses.splice(i, 1);
            continue;
          }
          Particles.burst(c.x, c.y, {
            count: 16, colors: this.def.deathPalette, speed: 160, life: 0.45, size: 4,
          });
          AudioSys.thud();
          // ★ v200 — 잔여물은 **맞았는지와 무관하게** 남는다.
          //   1차 계측에서 1·2·4층이 전부 0이었다: 「맞았을 때만」 남기게 배선한 게 잘못이었다.
          //   빗나가도 바닥은 그을린다 — 그게 방이 시간에 따라 변한다는 뜻이고,
          //   HP 인플레 없이 후반 압박을 만드는 장치다.
          this.strike(game, c.x, c.y, { status: false });
          if (Math.hypot(p.x - c.x, p.y - c.y) < (c.r || 48) + p.r) {
            const ddx = p.x - c.x, ddy = p.y - c.y;
            const dd = Math.hypot(ddx, ddy) || 1;
            game.hurtPlayer(bossDmg(), { x: ddx / dd, y: ddy / dd });
            this.strike(game, c.x, c.y, { zone: false });
          }
          if (c.fire) {
            game.firePatches.push({ x: c.x, y: c.y, r: 44, life: 2.4, kind: 'fire', by: this.name });
            this.strike(game, c.x, c.y, { status: false, kind: 'burn' });
          }
          if (c.poison) {
            // 계측 (관통 v3): 20층 사망 18회 중 13회가 독 웅덩이 — 재생 기믹 장기전에서 융단이 됐다.
            // 지속 3.0→2.2s: 화염(2.4s) 밴드에 정렬, 웅덩이가 '피할 것'에서 '기다릴 것'으로 격하되지 않는 선
            game.firePatches.push({ x: c.x, y: c.y, r: 44, life: 2.2, kind: 'poison', by: this.name });
            this.strike(game, c.x, c.y, { status: false, kind: 'poison' });
          }
          if (c.snare && Math.hypot(p.x - c.x, p.y - c.y) < 55 + p.r) {
            p.slowT = Math.max(p.slowT, 1.6);
            this.strike(game, p.x, p.y);   // 종전엔 여기 감속 한 줄이 전부였다 (계측: boss.js 상태 부여 1곳)
            Particles.text(p.x, p.y - 30, '속박!', { color: '#c05060', size: 13 });
          }
          this.curses.splice(i, 1);
        }
      }

      // 접촉 데미지 (장막 중 제외) — 2페이즈부터는 몸 자체가 흉기다
      // v155: 접촉 쿨다운도 3단 계단 — 근접은 몸통에 붙어 있어야 하는 직업이라 접촉이 상시 과금된다
      // (1층 실측 피해의 32%). 1~3층 1.3 / 4~5층 1.0 / 6층+ 0.8 (본 난이도 불변)
      // ★ v175: 예고를 세운다. v168이 잡몹 접촉에 0.25초 윈드업을 심을 때 **보스는 빠졌다** —
      // 보스는 공용 훅(enemies.js touchPlayer)을 안 타고 여기서 직접 피해를 줬기 때문이다.
      // 그래서 근접 직업이 딜을 넣으려면 서 있어야 하는 바로 그 자리에서, 1층 1뎀부터
      // 31층+ 6뎀까지 **윈드업도 부채꼴도 헛손질도 없이** 맞았다.
      // 기획서 §14 "텔레그래프 없는 죽음 0건"을 정면으로 위반하던 마지막 구멍이다.
      // 보스는 예고를 조금 길게 준다(0.34초) — 피해가 크므로 읽을 시간도 그만큼 있어야 한다
      if (this.state !== 'veil' && this.hitCd <= 0 && this._windT <= 0 &&
          Math.hypot(p.x - this.x, p.y - this.y) < p.r + this.r) {
        this._windT = 0.34;
        this._windMax = 0.34;
        this._windA = Math.atan2(p.y - this.y, p.x - this.x);
        this._windDmg = this.phase === 2 && Dungeon.floor >= 4 ? bossDmg() + 1 : bossDmg();
        AudioSys.telegraph(this.x, true, this.y);
      }
    },

    // 예고 만료 — tickTimers에서 돈다 (잡몹과 같은 이유: 여기서 처리해야 플레이어가
    // 물러난 순간에도 판정이 끊기지 않는다)
    _resolveWind(game) {
      const p = game.player;
      this._windT = 0;
      const dx = p.x - this.x, dy = p.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < p.r + this.r + 10) {
        this.hitCd = Dungeon.floor <= 3 ? 1.3 : Dungeon.floor <= 5 ? 1.0 : 0.8;
        game.hurtPlayer(this._windDmg || 1, { x: dx / d, y: dy / d }, 260, this.name);
      } else {
        // 물러섰다 — 헛손질. 잡몹과 같은 문법으로 반격의 창을 연다
        this.hitCd = (Dungeon.floor <= 3 ? 1.3 : Dungeon.floor <= 5 ? 1.0 : 0.8) + 0.35;
        this._whiffT = 0.5;
        Particles.text(this.x, this.y - this.r - 10, '헛손질', { color: '#9aa0b4', size: 12 });
        AudioSys.whiff(this.x, this.y);
      }
    },

    // ── 보스 고유기 (v117) — 이름이 곧 기술이 되게: 킷마다 전용 동사 1개 ──
    _uniqMove(game, dx, dy, d) {
      const p = game.player;
      const U = (t, fn) => { (this._uq = this._uq || []).push({ t, fn }); };
      const say = (txt) => { game.banner = { text: txt, life: 1.4, maxLife: 1.4, color: '#e8a13b' }; };
      const clampY = (y) => Math.min(Math.max(y, World.offsetY + TS * 1.5), World.offsetY + TS * (World.rows - 1.5));
      const id = this.defId;
      // v176: 이름이 기술과 함께 운다 — 이 보스의 시그니처 모티프를 얇게(lite) 한 번.
      // 스로틀이 걸려 있어 연타해도 겹치지 않는다
      if (typeof BossAudio !== 'undefined') {
        BossAudio.motif(id, { vol: 0.55, lite: true, phase: this._onslaught ? 3 : this.phase });
      }
      if (id === 1) {
        // 「생매장」 (무덤지기) — 발밑에 무덤이 파이고, 흙무더기가 날아든다
        say('생매장 — 파헤친 무덤을 벗어나라');
        this.curses.push({ x: p.x, y: p.y, t: 1.0, r: 64 });
        U(1.1, (b, g) => {
          const pp = g.player;
          const a = Math.atan2(pp.y - b.y, pp.x - b.x);
          for (const off of [-0.22, 0.22]) {
            g.spawnProjectile('rock', b.x, b.y, { x: Math.cos(a + off), y: Math.sin(a + off) }, { speed: 250, dmg: bossDmg() });
          }
          AudioSys.shoot();
        });
      } else if (id === 2) {
        // 「짐 부리기」 (시체 짐꾼) — 등짐이 사방으로 던져지고, 떨어진 자리가 썩는다
        say('짐 부리기 — 떨어지는 자리를 보라');
        for (let k = 0; k < 4; k++) {
          U(k * 0.16, (b, g) => {
            const pp = g.player;
            b.curses.push({
              x: pp.x + (Math.random() - 0.5) * 190,
              y: clampY(pp.y + (Math.random() - 0.5) * 150),
              t: 0.85, r: 46, poison: true,
            });
          });
        }
      } else if (id === 3) {
        // 「철창 호송」 (간수장) — 주위로 철창이 내리꽂힌다. 열린 틈 하나가 유일한 출구
        say('철창 호송 — 열린 틈으로 나가라');
        const cx = p.x, cy = p.y;
        const gapI = Math.floor(Math.random() * 6);
        for (let i = 0; i < 6; i++) {
          if (i === gapI) continue;
          const a = (i / 6) * Math.PI * 2;
          this.curses.push({ x: cx + Math.cos(a) * 95, y: clampY(cy + Math.sin(a) * 95), t: 0.9, r: 44 });
        }
        this.curses.push({ x: cx, y: clampY(cy), t: 1.15, r: 52 }); // 감방 한가운데도 안전하지 않다
      } else if (id === 4) {
        // 「기름 붓기」 (방화대장) — 기름 자국이 그어지고, 한 박자 뒤 일제히 발화한다
        say('기름 붓기 — 불길이 번지기 전에 비켜라');
        const ux = dx / (d || 1), uy = dy / (d || 1);
        const sx = this.x, sy = this.y;
        for (let i = 1; i <= 5; i++) this.curses.push({ x: sx + ux * 70 * i, y: clampY(sy + uy * 70 * i), t: 1.0, noHit: true });
        U(1.0, (b, g) => {
          AudioSys.meteorImpact();
          for (let i = 1; i <= 5; i++) {
            g.firePatches.push({ x: sx + ux * 70 * i, y: clampY(sy + uy * 70 * i), r: 36, life: 2.6, kind: 'fire', by: b.name });
          }
        });
      } else if (id === 5) {
        // 「올가미」 (교수대의 그림자) — 밧줄이 세 곳에 떨어지고, 묶인 자에게 원혼이 날아든다
        say('올가미 — 발밑을 보라');
        const ax = p.x, ay = p.y;
        this.curses.push({ x: ax, y: clampY(ay), t: 0.95, snare: true });
        this.curses.push({ x: ax - 90, y: clampY(ay), t: 1.05, snare: true });
        this.curses.push({ x: ax + 90, y: clampY(ay), t: 1.05, snare: true });
        U(1.15, (b, g) => {
          const pp = g.player;
          const base = Math.atan2(pp.y - b.y, pp.x - b.x);
          for (let i = 0; i < 5; i++) {
            const a = base + (i - 2) * 0.18;
            g.spawnProjectile('soul', b.x, b.y, { x: Math.cos(a), y: Math.sin(a) }, { speed: 200, dmg: bossDmg() });
          }
          AudioSys.shoot();
        });
      } else if (id === 6) {
        // 「합장」 (되살아난 오스문드) — 그와 나 사이의 땅이 차례로 갈라진다. 같이 묻히자
        say('합장 — 무덤이 이어진다');
        const sx = this.x, sy = this.y, ex = p.x, ey = p.y;
        for (let i = 1; i <= 4; i++) {
          const f = i / 4;
          this.curses.push({ x: sx + (ex - sx) * f, y: clampY(sy + (ey - sy) * f), t: 0.55 + i * 0.15, r: 48 });
        }
      } else if (id === 7) {
        // 「수레 뒤집기」 (물에 불은 몰레) — 썩은 오물이 물결로 밀려온다
        say('수레 뒤집기 — 밀려오는 오물을 넘어라');
        const ux = dx / (d || 1), uy = dy / (d || 1);
        const sx = this.x, sy = this.y;
        for (let w = 1; w <= 3; w++) {
          U(0.3 * w, (b, g) => {
            for (let j = -1; j <= 1; j++) {
              const px = sx + ux * 95 * w + (-uy) * j * 70;
              const py = sy + uy * 95 * w + ux * j * 70;
              g.firePatches.push({ x: px, y: clampY(py), r: 40, life: 1.6, kind: 'poison', by: b.name });
            }
            Particles.burst(sx + ux * 95 * w, clampY(sy + uy * 95 * w), { count: 8, colors: ['#6ab04c', '#3a4a3a'], speed: 110, life: 0.4, size: 3 });
            AudioSys.thud();
          });
        }
      } else if (id === 8) {
        // 「사슬 추적」 (사슬에 얽힌 바르곤) — 사슬이 발자국을 따라 내리꽂힌다. 멈추면 얽힌다
        say('사슬 추적 — 멈추지 마라');
        for (let k = 0; k < 4; k++) {
          U(0.25 * k, (b, g) => { b.curses.push({ x: g.player.x, y: clampY(g.player.y), t: 0.8, snare: true }); });
        }
      } else if (id === 9) {
        // 「불씨 비」 (재가 된 브란트) — 몸에서 튄 불씨가 비처럼 쏟아진다
        say('불씨 비 — 하늘을 보라');
        for (let k = 0; k < 8; k++) {
          U(0.15 * k, (b, g) => {
            const pp = g.player;
            b.curses.push({
              x: pp.x + (Math.random() - 0.5) * 260,
              y: clampY(pp.y + (Math.random() - 0.5) * 200),
              t: 0.8, r: 40, fire: true,
            });
          });
        }
      } else if (id === 10) {
        // 「단두 낙하」 — 거대 도끼가 떨어지고 충격파가 퍼진다
        say('단두 낙하 — 도끼 그림자를 벗어나라');
        const ax = p.x, ay = p.y;
        this.curses.push({ x: ax, y: ay, t: 1.05, r: 82, axe: true });
        U(1.05, (b, g) => {
          g.rings.push({ x: ax, y: ay, r: 16, maxR: 190, speed: 330, width: 12, dmg: 1, by: b.name });
          Renderer.shake(6, 0.3); AudioSys.meteorImpact();
        });
      } else if (id === 20) {
        // 「사령관의 호각」 — 부하 전원 돌격 명령 (재생 기믹과 맞물리는 지휘관의 동사)
        say('사령관의 호각 — 전원 돌격하라!');
        AudioSys.roar();
        let minions = 0;
        for (const e of game.enemies) {
          if (e.isBoss || e.dead || e.neutral) continue;
          minions++;
          e.hasteT = 2.4; e.flash = 0.35;
          const dd = Math.hypot(p.x - e.x, p.y - e.y) || 1;
          e.kbx = ((p.x - e.x) / dd) * 260; e.kby = ((p.y - e.y) / dd) * 260;
        }
        if (minions < 2) {
          for (let i = 0; i < 2; i++) {
            const pos = World.randomSpawnPos(p, 150);
            game.markers.push({ x: pos.x, y: pos.y, type: 'sporeling', elite: false, t: 0.7 });
          }
        }
      } else if (id === 30) {
        // 「연쇄 판결」 — 판결문이 발밑을 세 번 따라 찍힌다
        say('연쇄 판결 — 멈추면 선고된다');
        for (let k = 0; k < 3; k++) {
          U(k * 0.5, (b, g) => { b.curses.push({ x: g.player.x, y: g.player.y, t: 0.75, r: 56 }); });
        }
      } else if (id === 40) {
        // 「성수 살포」 — 죄를 씻는다며 태우는 물, 웅덩이가 남는다
        say('성수 살포 — 젖은 땅을 밟지 마라');
        const base = Math.atan2(p.y - this.y, p.x - this.x);
        for (let i = 0; i < 5; i++) {
          const a = base + (i - 2) * 0.38;
          const dist = 120 + (i % 2) * 70;
          this.curses.push({
            x: this.x + Math.cos(a) * dist, y: clampY(this.y + Math.sin(a) * dist),
            t: 0.9 + i * 0.08, r: 46, poison: true,
          });
        }
      } else if (id === 45) {
        // 「늑대 사냥」 — 세 번 잔상을 남기며 측면을 문다
        say('늑대 사냥 — 측면을 놓치지 마라');
        for (let k = 0; k < 3; k++) {
          U(0.15 + k * 0.45, (b, g) => {
            const pp = g.player;
            Particles.burst(b.x, b.y, { count: 10, colors: ['#d8dce4', '#9aa0b4'], speed: 160, life: 0.35, size: 3 });
            const a = Math.atan2(pp.y - b.y, pp.x - b.x) + (k % 2 ? 1.5 : -1.5);
            const s = World.safeSpot(pp.x + Math.cos(a) * 78, pp.y + Math.sin(a) * 78);
            b.x = s.x; b.y = s.y;
            AudioSys.slash(2);
            const dd = Math.hypot(pp.x - b.x, pp.y - b.y) || 1;
            Particles.burst(b.x + (pp.x - b.x) * 0.5, b.y + (pp.y - b.y) * 0.5, { count: 8, colors: ['#ffffff', '#d8dce4'], speed: 200, life: 0.3, size: 3, dir: Math.atan2(pp.y - b.y, pp.x - b.x), spread: 0.8 });
            if (dd < 108 && pp.invuln <= 0) g.hurtPlayer(bossDmg(), { x: (pp.x - b.x) / dd, y: (pp.y - b.y) / dd }, 300, b.name);
          });
        }
      } else if (id === 50) {
        // 「옥좌의 명령」 — 네 방위에서 왕의 창이 날아든다
        say('옥좌의 명령 — 사방을 보라');
        const origins = [
          { x: p.x, y: World.offsetY + 14 }, { x: p.x, y: World.offsetY + World.rows * TS - 14 },
          { x: 14, y: p.y }, { x: World.cols * TS - 14, y: p.y },
        ];
        for (const o of origins) this.curses.push({ x: o.x, y: o.y, t: 0.95, noHit: true });
        U(0.95, (b, g) => {
          AudioSys.shoot();
          for (const o of origins) {
            const pp = g.player;
            const dd = Math.hypot(pp.x - o.x, pp.y - o.y) || 1;
            g.spawnProjectile('rock', o.x, o.y, { x: (pp.x - o.x) / dd, y: (pp.y - o.y) / dd }, { speed: 500, dmg: bossDmg() });
          }
        });
      } else if (id === 60) {
        // 「갈고리 당김」 — 걸리면 수문장 앞으로 끌려간다
        say('갈고리 당김 — 사선에서 비켜라');
        const ux = dx / (d || 1), uy = dy / (d || 1);
        for (let i = 1; i <= 3; i++) this.curses.push({ x: this.x + ux * 130 * i, y: clampY(this.y + uy * 130 * i), t: 0.6, noHit: true });
        U(0.6, (b, g) => {
          const pp = g.player;
          const px = pp.x - b.x, py = pp.y - b.y;
          const tp = Math.max(0, Math.min(430, px * ux + py * uy));
          const perp = Math.hypot(px - ux * tp, py - uy * tp);
          Particles.burst(b.x + ux * 215, b.y + uy * 215, { count: 12, colors: ['#c8ccd8', '#8a653f'], speed: 200, life: 0.35, size: 3 });
          AudioSys.thud();
          if (perp < 34 + pp.r && pp.invuln <= 0) {
            g.hurtPlayer(bossDmg(), { x: -ux, y: -uy }, 80, b.name);
            World.moveEntity(pp, (b.x + ux * 50 - pp.x) * 0.75, (b.y + uy * 50 - pp.y) * 0.75); // 끌려온다
            Particles.text(pp.x, pp.y - 30, '갈고리에 걸렸다!', { color: '#e43b44', size: 13 });
          }
        });
      } else if (id === 61) {
        // 「노질 파도」 — 세로 일렬 물결이 두 번 쓸고 간다
        say('노질 파도 — 물결 틈으로');
        const dirX = p.x >= this.x ? 1 : -1;
        const row = (off, gap) => {
          for (let i = 0; i < 6; i++) {
            if (i === gap) continue; // 물결에도 틈은 있다
            game.spawnProjectile('soul', this.x + dirX * off, clampY(this.y - 150 + i * 60), { x: dirX, y: 0 }, { speed: 235, dmg: bossDmg() });
          }
        };
        row(18, 1 + Math.floor(Math.random() * 4));
        U(0.4, (b, g) => { row(18, 1 + Math.floor(Math.random() * 4)); AudioSys.shoot(); });
        AudioSys.shoot();
      } else if (id === 62) {
        // 「위증 기록」 — 세 곳에 죄목이 기록되고, 동시에 판결된다
        say('위증 기록 — 서명이 마르기 전에 움직여라');
        for (let k = 0; k < 3; k++) {
          U(k * 0.45, (b, g) => { b.curses.push({ x: g.player.x, y: g.player.y, t: 1.5 - k * 0.45, r: 48 }); });
        }
      } else if (id === 63) {
        // 「철퇴 지진」 — 직선 균열이 순차 분출한다
        say('철퇴 지진 — 균열 위를 벗어나라');
        const ux = dx / (d || 1), uy = dy / (d || 1);
        for (let i = 1; i <= 5; i++) {
          this.curses.push({ x: this.x + ux * 58 * i, y: clampY(this.y + uy * 58 * i), t: 0.55 + i * 0.13, r: 42 });
        }
        Renderer.shake(3, 0.2); AudioSys.thud();
      } else if (id === 64) {
        // 「독무 살포」 — 세 번 도약하며 지나간 자리에 독무가 남는다
        say('독무 살포 — 부리를 쫓지 마라');
        for (let k = 0; k < 3; k++) {
          U(k * 0.4, (b, g) => {
            g.firePatches.push({ x: b.x, y: b.y, r: 42, life: 3.5, kind: 'poison', by: b.name });
            const s = World.safeSpot(b.x + (Math.random() - 0.5) * 240, b.y + (Math.random() - 0.5) * 180);
            Particles.burst(b.x, b.y, { count: 8, colors: ['#6ab04c', '#2e3430'], speed: 120, life: 0.4, size: 3 });
            b.x = s.x; b.y = s.y;
          });
        }
      } else if (id === 65) {
        // 「재 소용돌이」 — 나선 화염구가 퍼지며 불길 고리를 남긴다
        say('재 소용돌이 — 원 밖으로');
        for (let i = 0; i < 8; i++) {
          U(i * 0.11, (b, g) => {
            const a = i * 0.85 + b.patternIdx;
            g.spawnProjectile('fire', b.x, b.y, { x: Math.cos(a), y: Math.sin(a) }, { speed: 150, dmg: bossDmg() });
          });
        }
        AudioSys.shoot();
      } else if (id === 66) {
        // 「성좌 잇기」 — 별 넷이 이어지며 빛의 선이 벤다
        say('성좌 잇기 — 선분 사이로');
        const cx = p.x, cy = clampY(p.y);
        const rot = Math.random() * Math.PI;
        const stars = [];
        for (let i = 0; i < 4; i++) {
          const a = rot + (i / 4) * Math.PI * 2;
          stars.push({ x: cx + Math.cos(a) * 125, y: clampY(cy + Math.sin(a) * 105) });
        }
        for (const s of stars) this.curses.push({ x: s.x, y: s.y, t: 1.35, star: true, noHit: true });
        U(1.35, (b, g) => {
          const pp = g.player;
          AudioSys.meteorImpact(); Renderer.shake(4, 0.25);
          let hitOnce = false;
          for (let i = 0; i < 4; i++) {
            const a1 = stars[i], a2 = stars[(i + 1) % 4];
            const seg = { x: a2.x - a1.x, y: a2.y - a1.y };
            const len = Math.hypot(seg.x, seg.y) || 1;
            for (let s2 = 0; s2 <= 10; s2++) { // 선분 빛줄기
              Particles.burst(a1.x + seg.x * (s2 / 10), a1.y + seg.y * (s2 / 10), { count: 1, colors: ['#ffd866', '#fff7c0'], speed: 20, life: 0.4, size: 2 });
            }
            const t2 = Math.max(0, Math.min(1, ((pp.x - a1.x) * seg.x + (pp.y - a1.y) * seg.y) / (len * len)));
            const distSeg = Math.hypot(pp.x - (a1.x + seg.x * t2), pp.y - (a1.y + seg.y * t2));
            if (!hitOnce && distSeg < 20 + pp.r && pp.invuln <= 0) {
              hitOnce = true;
              g.hurtPlayer(bossDmg(), { x: 0, y: -0.5 }, 220, b.name);
            b.strike(g, g.player.x, g.player.y);
            }
          }
        });
      } else if (id === 67) {
        // 「왕복 관통」 — 꿰뚫고 지나간 창이 되돌아온다
        say('왕복 관통 — 두 번 온다');
        const ux = dx / (d || 1), uy = dy / (d || 1);
        for (let i = 1; i <= 4; i++) this.curses.push({ x: this.x + ux * 110 * i, y: clampY(this.y + uy * 110 * i), t: 0.55, noHit: true });
        const dash = (b, g, sx, sy, ex, ey) => {
          const vx = ex - sx, vy = ey - sy;
          const len = Math.hypot(vx, vy) || 1;
          const nx = vx / len, ny = vy / len;
          const pp = g.player;
          const px = pp.x - sx, py = pp.y - sy;
          const tp = Math.max(0, Math.min(len, px * nx + py * ny));
          const perp = Math.hypot(px - nx * tp, py - ny * tp);
          if (perp < 40 + pp.r && pp.invuln <= 0) {
            g.hurtPlayer(bossDmg(), { x: nx, y: ny }, 320, b.name);
            b.strike(g, pp.x, pp.y, { zone: false });
          }
          for (let s2 = 0; s2 < 6; s2++) Particles.burst(sx + vx * (s2 / 6), sy + vy * (s2 / 6), { count: 2, colors: ['#c8ccd8', '#16141e'], speed: 90, life: 0.3, size: 3 });
          const spot = World.safeSpot(ex, ey);
          b.x = spot.x; b.y = spot.y;
          AudioSys.thud(); Renderer.shake(4, 0.2);
        };
        const sx0 = this.x, sy0 = this.y;
        const ex0 = this.x + ux * 460, ey0 = clampY(this.y + uy * 460);
        U(0.55, (b, g) => dash(b, g, b.x, b.y, ex0, ey0));
        U(1.3, (b, g) => dash(b, g, b.x, b.y, sx0, sy0));
      }
    },

    _execute(game, dx, dy, d) {
      const { kind, opt } = this.attack;
      const p = game.player;
      // 맹공: 어떤 패턴을 쓰든 플레이어 발밑에 예고 장판 1개가 따라붙는다 (중첩 압박)
      if (this._onslaught) {
        this.curses.push({ x: p.x, y: p.y, t: 1.0 });
      }

      if (kind === 'sweep') {
        this.state = 'sweep';
        this.swingCount = 0;
      } else if (kind === 'fan') {
        const projKind = opt[0] || 'soul';
        const variant = opt[1] || null; // P2 변주: cross(교차 2연) / gap(간극 탄막) / snipe(속사 저격 — 응징)
        const baseAngle = Math.atan2(dy, dx);
        const speeds = { soul: 195, spore: 135, fire: 210, rock: 250 };
        const baseSpeed = speeds[projKind] || 200;
        const volley = (n, spread, ang, spdMul = 1, gapIdx = -1) => {
          for (let i = 0; i < n; i++) {
            if (gapIdx >= 0 && (i === gapIdx || i === gapIdx + 1)) continue; // 의도된 안전 틈
            const a = ang + (i - (n - 1) / 2) * spread;
            game.spawnProjectile(projKind, this.x, this.y, { x: Math.cos(a), y: Math.sin(a) }, {
              // ★ v199 결함③ — 본탄이 dmg:1 하드코딩이라 **50층에서도 1뎀**이었다.
              // fan 은 23/23 보스가 가장 많이 쓰는 패턴(전체 스텝의 25%)인데 층 스케일을 안 탔다.
              // 후속탄(_delayed)은 bossDmg() 를 쓰고 있었다 — 본탄만 빠져 있었던 것이다
              speed: baseSpeed * spdMul, dmg: bossDmg(),
            });
          }
        };
        if (variant === 'snipe') {
          // 응징 속사: 좁고 빠른 3발 ×2연 — 서 있으면 맞고, 옆 대시면 피한다
          volley(3, 0.09, baseAngle, 1.65); // 1.9→1.65: 휴먼 반응(150ms)으로 옆 대시가 가능한 속도
          this._delayed.push({ t: 0.36, projKind, n: 3, spread: 0.09, aim: true, speed: baseSpeed * 1.65 });
        } else if (variant === 'cross') {
          // 교차 2연: 두 번째 부채꼴이 반각 어긋나 틈이 이동한다
          const n = this.phase === 2 ? (projKind === 'spore' ? 7 : 9) : (projKind === 'spore' ? 6 : 7);
          const spread = projKind === 'spore' ? 0.27 : 0.22;
          volley(n, spread, baseAngle);
          this._delayed.push({ t: 0.4, projKind, n, spread, baseAngle, offset: spread / 2, speed: baseSpeed });
        } else if (variant === 'gap') {
          // 간극 탄막: 넓지만 안전 틈 1곳 — 틈을 찾는 것이 플레이
          const n = 13;
          volley(n, 0.17, baseAngle, 0.95, 1 + Math.floor(Math.random() * (n - 4)));
        } else {
          // 기본 조준 부채꼴 (포자 완화 수치 유지 — 클린 계측 근거)
          const n = this.phase === 2 ? (projKind === 'spore' ? 7 : 9) : (projKind === 'spore' ? 6 : 7);
          const spread = projKind === 'spore' ? 0.27 : 0.22;
          volley(n, spread, baseAngle);
        }
        AudioSys.shoot();
        this._endMove();
      } else if (kind === 'curse') {
        const fire = opt.includes('fire');
        this.curses.push({ x: p.x, y: p.y, t: 0.9, fire });
        for (let i = 0; i < 3; i++) {
          this.curses.push({
            x: p.x + (Math.random() - 0.5) * 260,
            y: Math.min(Math.max(p.y + (Math.random() - 0.5) * 200, World.offsetY + TS * 1.5), World.offsetY + TS * (World.rows - 1.5)),
            t: 0.9 + i * 0.12,
            fire,
          });
        }
        this._endMove();
      } else if (kind === 'summon') {
        // ★ v192 — 사장: "잡몹 + 보스는, 군집하고 전략적으로 플레이어를 공격할 수 있도록 해야해."
        // 결함이 v186과 **똑같은 모양**이었다: 여기서 markers 에 pack·leader 를 안 넘겨서
        // 소환수가 무리 기계(v185 응집·사기 / v186 밴드 유지 / v187 호령)를 하나도 안 탔다.
        // 보스가 부른 부하가 제각각 걸어오면 그건 소환이 아니라 그냥 증원이다.
        //
        // 이제 **보스 자신이 그 무리의 리더**가 된다. 그러면 공짜로 셋이 따라온다:
        //   · 부하끼리 붙어 있으면 경감(뭉치면 단단하다) — 흩어놓는 것이 플레이어의 수가 된다
        //   · 역할 밴드 유지 — 전열은 붙고 후열은 물러나 보스를 가린다
        //   · 보스의 호령에 부하가 **같은 순간** 밀고 들어온다 (전략적 협공의 실체)
        // 그리고 보스를 베면 남은 부하가 흔들린다 — 이미 있는 사기 붕괴가 그대로 걸린다
        const mType = opt[0] || 'slime';
        const isElite = opt.includes('elite');
        const minions = game.enemies.filter((e) => !e.isBoss && !e.dead).length;
        if (!this.pack) { this.pack = 900 + (this.defId || 0); this.isLeader = true; }
        // v192: 보스 **주위**에서 일으킨다. 종전엔 randomSpawnPos(플레이어 기준)이라
        // 부하가 방 아무 데나 떨어져 리더 권역(190px) 밖으로 나갔고, 그러면 무리가 안 된다.
        // 무덤지기는 제 발밑 무덤에서 부른다 — 서사도 이쪽이 맞다
        const cnt = Math.min(2, 5 - minions);
        for (let i = 0; i < cnt; i++) {
          const a = (i / Math.max(1, cnt)) * Math.PI * 2 + this.patternIdx * 0.7;
          const pos = World.safeSpot(this.x + Math.cos(a) * 96, this.y + Math.sin(a) * 78);
          game.markers.push({ x: pos.x, y: pos.y, type: mType, elite: isElite, t: 0.7, pack: this.pack, summoned: true });
        }
        // ★ 소환은 크게 예고되는 순간이다 — 여기서 속성을 건다.
        //   서사와도 맞물린다: 무덤지기가 부른 것들과 함께 저주가 온다.
        //   그리고 🕯저주는 **부하를 처치해야** 풀리므로, 소환과 저주가 한 쌍이 된다
        if (cnt > 0) this.strike(game, game.player.x, game.player.y, { zone: false });
        Particles.text(this.x, this.y - this.r - 26, '일어나라!', { color: '#c9a24a', size: 13 });
        AudioSys.roar();
        this._endMove();
      } else if (kind === 'spiral') {
        // 나선 탄막 (심층 시그니처): 시전마다 회전하는 2겹 8방 탄 — 겹 사이 속도차가 나선을 그린다
        const projKind = opt[0] || 'soul';
        const rot = this.patternIdx * 0.45;
        for (let i = 0; i < 8; i++) {
          const a = rot + (i / 8) * Math.PI * 2;
          game.spawnProjectile(projKind, this.x, this.y, { x: Math.cos(a), y: Math.sin(a) }, { speed: 200, dmg: bossDmg() });
          const a2 = a + Math.PI / 8;
          game.spawnProjectile(projKind, this.x, this.y, { x: Math.cos(a2), y: Math.sin(a2) }, { speed: 130, dmg: bossDmg() });
        }
        AudioSys.shoot();
        this._endMove();
      } else if (kind === 'snare') {
        // 사슬 속박 (감옥 계열 시그니처): 예고 원 → 안에 있으면 피해 + 속박
        this.curses.push({ x: p.x, y: p.y, t: 0.85, snare: true });
        for (let i = 0; i < 2; i++) {
          this.curses.push({
            x: p.x + (Math.random() - 0.5) * 220,
            y: Math.min(Math.max(p.y + (Math.random() - 0.5) * 170, World.offsetY + TS * 1.5), World.offsetY + TS * (World.rows - 1.5)),
            t: 0.95 + i * 0.1, snare: true,
          });
        }
        AudioSys.shoot();
        this._endMove();
      } else if (kind === 'geyser') {
        // 간헐천 (화염/맹독 시그니처): 플레이어를 쫓는 4연속 분출 — 계속 움직여야 산다
        const flag = opt[0] === 'poison' ? { poison: true } : { fire: true };
        for (let i = 0; i < 4; i++) {
          this.curses.push({
            x: p.x + (Math.random() - 0.5) * 120 * i,
            y: Math.min(Math.max(p.y + (Math.random() - 0.5) * 100 * i, World.offsetY + TS * 1.5), World.offsetY + TS * (World.rows - 1.5)),
            t: 0.8 + i * 0.22, ...flag,
          });
        }
        AudioSys.shoot();
        this._endMove();
      } else if (kind === 'uniq') {
        this._uniqMove(game, dx, dy, d);
        // 어픽스 '메아리치는': 반 박자 뒤 고유기가 한 번 더 — 첫 회피가 답의 전부가 아니게 된다
        if (this.affixes && this.affixes.includes('echoing') && !this._echoLock) {
          this._echoLock = true; // 재귀 방지 — 메아리가 메아리를 부르지 않게
          (this._uq = this._uq || []).push({ t: 1.7, fn: (b, g) => {
            const pp = g.player;
            const ddx = pp.x - b.x, ddy = pp.y - b.y;
            Particles.text(b.x, b.y - 46, '메아리!', { color: '#c9b8e8', size: 13 });
            b._uniqMove(g, ddx, ddy, Math.hypot(ddx, ddy) || 1);
            b._echoLock = false;
          } });
        }
        this._endMove();
      } else if (kind === 'beam') {
        // 회전 광선 (v150): 조준각에서 한쪽으로 크게 쓸어간다 — 회전 반대쪽으로 도는 것이 답
        this._beamSign = Math.random() < 0.5 ? 1 : -1;
        this._beamA = Math.atan2(dy, dx) - this._beamSign * 1.1;
        this.state = 'beam';
        AudioSys.roar();
      } else if (kind === 'mortar') {
        // 이동 예측 폭격 (v150): 지금 위치가 아니라 '가려는 곳'에 떨어진다 — 급정거·역주행이 해법.
        // 예측은 bb(평활 속도 추정기) 기반 — 봇·패드 입력에도 동일하게 작동한다
        const flag = opt.includes('poison') ? { poison: true } : opt.includes('fire') ? { fire: true } : {};
        const pv = game.bb || { pvx: 0, pvy: 0 };
        const clampYm = (y) => Math.min(Math.max(y, World.offsetY + TS * 1.5), World.offsetY + TS * (World.rows - 1.5));
        for (let i = 0; i < 5; i++) {
          const lead = 0.27 * i; // i번째 탄일수록 더 먼 미래를 겨눈다
          this.curses.push({
            x: p.x + pv.pvx * lead + (Math.random() - 0.5) * 36,
            y: clampYm(p.y + pv.pvy * lead + (Math.random() - 0.5) * 30),
            t: 0.72 + i * 0.16, r: 46, ...flag,
          });
        }
        AudioSys.shoot();
        this._endMove();
      } else if (kind === 'pulse') {
        // 수축 원환 (v150): 장외에서 조여든다 — 틈을 찾거나, 대시 무적으로 꿰뚫거나
        Renderer.shake(3, 0.15);
        AudioSys.thud();
        const gapA = Math.random() * Math.PI * 2;
        game.rings.push({ x: this.x, y: this.y, r: 330, minR: 12, maxR: 340, speed: -185, width: 15, dmg: 1, by: this.name, gapA, gapW: 0.95 });
        if (this.phase === 2) { // 두 겹째는 틈이 반대편 — 틈에서 틈으로 달리는 것이 플레이
          game.rings.push({ x: this.x, y: this.y, r: 415, minR: 12, maxR: 420, speed: -185, width: 15, dmg: 1, by: this.name, gapA: gapA + Math.PI, gapW: 0.95 });
        }
        this._endMove();
      } else if (kind === 'echo') {
        // 잔상 분신 (v150): 이 자리에 원혼이 남고, 본체는 도약 — 반 박자 뒤 두 곳에서 협공
        const gx = this.x, gy = this.y;
        this._echoes.push({ x: gx, y: gy, t: 1.4, flip: this.flip });
        const projKind = this.def.punishProj || 'soul';
        (this._uq = this._uq || []).push({ t: 0.8, fn: (b, g) => {
          const pp = g.player;
          const a = Math.atan2(pp.y - gy, pp.x - gx);
          for (let i = 0; i < 5; i++) {
            const aa = a + (i - 2) * 0.16;
            g.spawnProjectile(projKind, gx, gy, { x: Math.cos(aa), y: Math.sin(aa) }, { speed: 215, dmg: bossDmg() });
          }
          AudioSys.shoot();
        } });
        const s = World.safeSpot(this.x + (Math.random() - 0.5) * 280, this.y + (Math.random() - 0.5) * 200);
        Particles.burst(gx, gy, { count: 12, colors: this.def.deathPalette, speed: 140, life: 0.4, size: 3 });
        this.x = s.x; this.y = s.y;
        AudioSys.slash(2);
        this._endMove();
      } else if (kind === 'charge') {
        this.state = 'charge';
      } else if (kind === 'ring') {
        Renderer.shake(4, 0.2);
        AudioSys.thud();
        // 간극 링 (P2): 안전 부채꼴 1곳 — 대시 없이도 읽으면 피할 길이 있다
        const gap = opt.includes('gap') ? { gapA: Math.random() * Math.PI * 2, gapW: 1.0 } : {};
        game.rings.push({ x: this.x, y: this.y, r: 24, maxR: 340, speed: 300, width: 15, dmg: 1, by: this.name, ...gap });
        if (this.phase === 2 && Dungeon.floor >= 3) { // 이중 링은 3층부터 — 입문 보스에서 대시 2관리 요구는 과했다
          game.rings.push({ x: this.x, y: this.y, r: 24, maxR: 340, speed: 210, width: 15, dmg: 1, by: this.name, ...gap });
        }
        this._endMove();
      } else {
        this._endMove();
      }
      // 어픽스 '타오르는': 초식을 쓸 때마다 제 발밑이 불탄다 — 보스의 동선이 지형이 된다
      if (this.affixes && this.affixes.includes('burning')) {
        game.firePatches.push({ x: this.x, y: this.y, r: 30, life: 2.2, kind: 'fire', by: this.name });
      }
      this.stateT = 0;
    },

    draw(ctx) {
      // 텔레그래프
      // ★ 휘두르기 예고 (v159) — 이 게임에서 가장 중요한 한 조각.
      // 종전 예고는 **실제 위험 구역의 절반만 그렸다**: 그리기는 보스 현재 위치에서 반경 95·각 ±1.1,
      // 실제 판정은 보스가 **85px 전진한 뒤** 반경 95+플레이어반경(=108)·각 ±1.35.
      // 즉 화면이 "여기는 안전하다"고 그려놓고 때렸다. 실측상 1층 보스전 피해의 58%가 이 기술인데,
      // 그 죽음이 학습으로 이어질 수 없었다 (몰입 정의 ②: 패배가 납득돼야 재도전을 부른다).
      // → 판정과 **같은 수치**로, 전진 전·후 두 부채꼴의 합집합을 그린다. 과하게 그릴지언정
      //   안전하다고 거짓말하지 않는다. sweep 진행 중(2·3타)에도 다음 스윙을 예고한다
      {
        const k = this.attack?.kind;
        const teleAim = this.state === 'sweep' ? this._swingAim
          : (this.state === 'windup' && k === 'sweep') ? this.aimDir : null;
        if (teleAim) {
          const a = Math.atan2(teleAim.y, teleAim.x);
          const R = 95 + 13;    // 판정 반경 (95 + 플레이어 반경)
          const ARC = 1.35;     // 판정 각 (±1.35 rad)
          ctx.save();
          ctx.globalAlpha = 0.22 + Math.sin(this.animT * 18) * 0.08;
          ctx.fillStyle = '#e43b44';
          for (const off of [0, 85]) { // 0 = 제자리 판정, 85 = 전진 후 판정
            ctx.save();
            ctx.translate(this.x + Math.cos(a) * off, this.y + Math.sin(a) * off);
            ctx.rotate(a);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, R, -ARC, ARC);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
          ctx.restore();
          ctx.globalAlpha = 1;
        }
      }
      if (this.state === 'windup') {
        const k = this.attack?.kind;
        if (k === 'sweep') {
          // (예고는 위 공용 블록이 담당 — 판정과 같은 수치로 그린다)
        } else if (k === 'charge') {
          ctx.save();
          ctx.globalAlpha = 0.3 + Math.sin(this.animT * 16) * 0.12;
          ctx.strokeStyle = '#e43b44';
          ctx.lineWidth = this.r * 1.6;
          ctx.beginPath();
          ctx.moveTo(this.x, this.y);
          ctx.lineTo(this.x + this.aimDir.x * 520, this.y + this.aimDir.y * 520);
          ctx.stroke();
          ctx.restore();
        } else if (k === 'beam') {
          // 광선 예고 (v150): 쓸어갈 부채꼴 전체를 옅게 + 시작 사선을 진하게 — 어디서 시작해 어디로 도는지 읽힌다
          const ca = Math.atan2(this.aimDir.y, this.aimDir.x);
          ctx.save();
          ctx.translate(this.x, this.y);
          ctx.globalAlpha = 0.12 + Math.sin(this.animT * 14) * 0.05;
          ctx.fillStyle = '#ffd866';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, 460, ca - 1.15, ca + 1.15);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
      // 광선 본체 (v150): 회전하며 쓸어가는 빛기둥
      if (this.state === 'beam' && this._beamAng != null) {
        ctx.save();
        const bx = Math.cos(this._beamAng), by = Math.sin(this._beamAng);
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = '#fff7c0';
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x + bx * 460, this.y + by * 460); ctx.stroke();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = (this.def.deathPalette && this.def.deathPalette[0]) || '#ffd866';
        ctx.lineWidth = 16;
        ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x + bx * 460, this.y + by * 460); ctx.stroke();
        ctx.restore();
      }
      // 잔상 분신 (v150 echo): 남겨진 원혼 — 반투명 잔상이 사격 직전까지 떨린다
      for (const e of this._echoes) {
        const img2 = Sprites[this.def.sprite];
        if (img2) {
          Renderer.drawSprite(img2, e.x + (Math.random() - 0.5) * 2, e.y, {
            flip: e.flip, alpha: 0.28 + Math.sin(this.animT * 20) * 0.08,
            squashX: this.def.scale, squashY: this.def.scale,
          });
        }
      }
      // 저주 장판 텔레그래프 (v117: 가변 반경 + 별/무해 마커 변주)
      for (const c of this.curses) {
        ctx.save();
        if (c.star) { // 성좌 잇기 — 반짝이는 별 마커
          ctx.globalAlpha = 0.7 + Math.sin(c.t * 18) * 0.3;
          ctx.fillStyle = '#ffd866';
          ctx.translate(c.x, c.y);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-4, -4, 8, 8);
          ctx.rotate(-Math.PI / 4);
          ctx.fillRect(-2, -9, 4, 18);
          ctx.fillRect(-9, -2, 18, 4);
          ctx.restore();
          continue;
        }
        const rr = c.r || 48;
        ctx.globalAlpha = 0.35 + Math.sin(c.t * 25) * 0.12;
        const col = c.axe ? '#e43b44' : c.poison ? '#6ab04c' : c.fire ? '#ff7043' : '#b13ae0';
        ctx.strokeStyle = col;
        ctx.fillStyle = c.axe ? 'rgba(228,59,68,0.16)' : c.poison ? 'rgba(106,176,76,0.14)' : c.fire ? 'rgba(255,112,67,0.15)' : 'rgba(177,58,224,0.15)';
        ctx.lineWidth = c.noHit ? 1.5 : 2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.noHit ? 12 : rr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      const bob = Math.sin(this.animT * 2.2) * 4;
      // ── 크기 비율 (v200) ────────────────────────────────────────────
      // 보스도 몸 크기 r 을 선언한다(26~33). 원본을 48~64px로 다시 그렸으니
      // 화면 크기는 잡몹과 **같은 자**(화면높이 = r×3.5)로 맞춘다.
      // 보스는 def.scale 을 squash 로 곱해 쓰므로 그 곱까지 상쇄해서 물린다
      {
        const bi = Sprites[this.def.sprite];
        if (bi && bi.width && !bi.__dsSet && Sprites.bossScaleFor) {
          bi.__ds = Sprites.bossScaleFor(bi, this.r, this.def.scale); bi.__dsSet = 1;
        }
      }
      const img = this.flash > 0 ? Sprites.white(Sprites[this.def.sprite]) : Sprites[this.def.sprite];

      // ── 시전 게이지 (v201) ──────────────────────────────────────────────
      // 「보이지 않는 것은 없는 것과 같다」 — 끊으라고 만든 창인데 안 보이면 존재하지 않는다.
      // 보스 머리 위에 게이지를 띄우고, 누적 피해가 임계에 얼마나 닿았는지도 함께 보인다
      if (this.state === 'cast') {
        const W = 92, H = 9, gx = this.x - W / 2, gy = this.y - this.r - 46;
        ctx.save();
        ctx.fillStyle = 'rgba(10,8,16,0.88)';
        ctx.fillRect(gx - 2, gy - 2, W + 4, H + 4);
        // 시전 진행 — 빨갛게 차오른다 (다 차면 큰 게 나온다)
        const t = Math.min(1, this.castT / this.castMax);
        ctx.fillStyle = '#e43b44';
        ctx.fillRect(gx, gy, W * t, H);
        // 끊기까지 남은 양 — 노란 막대가 오른쪽에서 줄어든다
        const need = Math.max(0, 1 - this.castDmg / this.castNeed);
        ctx.fillStyle = '#ffd866';
        ctx.fillRect(gx, gy + H - 3, W * (1 - need), 3);
        ctx.strokeStyle = '#ffd866'; ctx.lineWidth = 1;
        ctx.strokeRect(gx - 0.5, gy - 0.5, W + 1, H + 1);
        ctx.fillStyle = '#ffd866';
        ctx.font = 'bold 11px Galmuri11, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('시전 — 끊어라!', this.x, gy - 6);
        ctx.restore();
      } else if (this.state === 'groggy') {
        ctx.save();
        ctx.globalAlpha = 0.6 + Math.sin(this.animT * 12) * 0.25;
        ctx.fillStyle = '#5ce0e6';
        ctx.font = 'bold 13px Galmuri11, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('그로기!', this.x, this.y - this.r - 42);
        // 머리 위를 도는 별 — 무방비 상태를 한눈에
        for (let i = 0; i < 3; i++) {
          const a = this.animT * 3.4 + i * 2.1;
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = '#ffd866';
          ctx.fillRect(this.x + Math.cos(a) * 16 - 2, this.y - this.r - 26 + Math.sin(a) * 5 - 2, 4, 4);
        }
        ctx.restore();
      }

      // ── 위압감 연출: 고동치는 오라 (2페이즈·맹공에서 격화) ──
      {
        const rage = (this.phase >= 2 ? 1 : 0) + (this._onslaught ? 1 : 0);
        const auraC = (this.def.deathPalette && this.def.deathPalette[0]) || '#e43b44';
        const pulse = 0.5 + Math.sin(this.animT * (2.5 + rage * 2)) * 0.5;
        ctx.save();
        // 바깥 어둠 — 보스 주변이 한 톤 가라앉는다
        ctx.globalAlpha = 0.16 + rage * 0.05;
        const rg = ctx.createRadialGradient(this.x, this.y, this.r * 0.6, this.x, this.y, this.r * (2.6 + pulse * 0.4));
        rg.addColorStop(0, 'rgba(0,0,0,0)');
        rg.addColorStop(0.55, 'rgba(0,0,0,0.5)');
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 3.1, 0, Math.PI * 2); ctx.fill();
        // 안쪽 위협색 링
        ctx.globalAlpha = (0.14 + pulse * 0.1) * (1 + rage * 0.6);
        ctx.strokeStyle = auraC;
        ctx.lineWidth = 2 + pulse * 2 + rage;
        ctx.beginPath(); ctx.arc(this.x, this.y + 4, this.r * (1.5 + pulse * 0.18), 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        // 피어오르는 기운 입자 (파티클 상한 배려해 낮은 빈도)
        if (Math.random() < 0.10 + rage * 0.10) {
          Particles.burst(this.x + (Math.random() - 0.5) * this.r * 2, this.y + this.r * 0.5, {
            count: 1, colors: this.def.deathPalette || [auraC], speed: 30, life: 0.7, size: 3, gravity: -110,
          });
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + this.r + 8, this.r * 1.3, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      const shakeX = this.state === 'windup' && this.attack?.kind === 'charge' ? (Math.random() - 0.5) * 5 : 0;
      // 호흡 애니메이션 — 거대한 것이 숨쉬는 리듬 (2페이즈는 가쁘게)
      const breath = Math.sin(this.animT * (this.phase >= 2 ? 3.6 : 1.8)) * 0.035;
      Renderer.drawSprite(img, this.x + shakeX, this.y - bob, {
        flip: this.flip,
        alpha: this.phased ? 0.35 : 1,
        squashX: this.def.scale * (1 - breath),
        squashY: this.def.scale * (1 + breath),
      });
    },
  };
}
