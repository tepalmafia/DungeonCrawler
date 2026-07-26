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

const BOSS_DEFS = {
  1: {
    name: '무덤지기 오스문드', sprite: 'boss', scale: 1.35, r: 26, hp: 95, speed: 42,
    banner: '무덤지기 오스문드',
    punish: 'volley', punishProj: 'soul',
    p1: ['sweep>sweep', 'fan:soul', 'fan:soul:snipe'],
    p2: ['sweep>fan:soul', 'curse>sweep>fan:soul', 'fan:soul:cross'],
    rageText: '오스문드가 낫을 고쳐쥔다!',
    intro: '죄인은 무덤 밖으로 못 나간다. 그게 내 밥줄이야.', outro: '네 관은… 비어 있었지… 이상하다 했어…',
    deathPalette: ['#b13ae0', '#241832', '#e8e0cf'],
  },
  2: {
    name: '늪지기 몰귀', sprite: 'bossSpore', scale: 1.45, r: 32, hp: 190, speed: 34, // 계측: 2층 사망이 전체의 절반 — 전투 길이 단축
    mechanic: { type: 'regen', label: '포자 갑피 — 부하가 살아있는 동안 재생한다' },
    banner: '늪지기 몰귀',
    // 분산 귀속 (열기5): 보스방 사망의 60%가 소환수(독슬라임 독구름 r52 + 버섯 근접 포자) —
    // 재생 정지를 위해 부하를 근접 처치해야 하는 검사가 독구름 루프에 갇혔다.
    // 소환수를 경량 포자 방울(독구름 r32/1.5s)로 교체 — 기믹(부하 처치=재생 정지)은 유지
    punish: 'volley', punishProj: 'spore',
    p1: ['fan:spore', 'ring>summon:sporePuff', 'fan:spore:snipe'],
    p2: ['fan:spore:cross', 'fan:spore:snipe>ring', 'curse>fan:spore'],
    rageText: '포자가 미친 듯이 흩날린다!',
    intro: '늪은 왕의 것도, 네 것도 아니다. 전부 가라앉을 뿐.', outro: '너도 언젠가… 가라앉는다…',
    deathPalette: ['#38b764', '#d8f070', '#8a5ac2'],
  },
  3: {
    name: '간수장 바르곤', sprite: 'bossGolem', scale: 1.5, r: 33, hp: 190, speed: 30,
    mechanic: { type: 'armor', cap: 2, label: '중장갑 — 강한 일격을 경감한다' },
    banner: '간수장 바르곤',
    punish: 'charge',
    p1: ['charge>ring', 'fan:rock', 'fan:rock:snipe'],
    // 매트릭스 계측: 이중 돌진 금지 유지 (열기0 3층 스파이크 귀속) — 연계는 돌진 1회까지만
    p2: ['charge>ring>fan:rock', 'ring>fan:rock', 'fan:rock:gap'],
    rageText: '바르곤의 사슬이 풀렸다!',
    intro: '네 얼굴, 명부에서 봤다. 처형 완료라 적혀 있었는데.', outro: '명부가… 처음부터… 거짓이었나…',
    deathPalette: ['#6b7a94', '#454f63', '#e43b44'],
  },
  4: {
    name: '방화대장 이그니스', sprite: 'bossIgnis', scale: 1.55, r: 30, hp: 430, speed: 44,
    mechanic: { type: 'rage', label: '백열 — 시간이 지날수록 빨라진다' },
    banner: '방화대장 이그니스',
    punish: 'charge', punishTrail: true,
    p1: ['fan:fire>charge:trail', 'curse:fire', 'fan:fire:snipe'],
    p2: ['charge:trail>fan:fire', 'fan:fire:snipe>charge:trail', 'fan:fire:cross'],
    rageText: '이그니스가 백열한다!',
    intro: '역병 마을은 태우라는 게 왕명이다. 산 자도 함께.', outro: '불은… 명령이었다… 나는 그저…',
    deathPalette: ['#ff7043', '#ffd866', '#7a1010'],
  },
  5: {
    name: '교수대의 그림자', sprite: 'bossAbyss', scale: 1.75, r: 28, hp: 700, speed: 50,
    mechanic: { type: 'veil', label: '어둠 장막 — 영혼 구슬을 파괴하라' },
    banner: '교수대의 그림자',
    punish: 'volley', punishProj: 'soul',
    p1: ['sweep>fan:soul', 'ring:gap', 'fan:soul:snipe'],
    p2: ['ring:gap>sweep>fan:soul', 'fan:soul:cross>ring', 'summon:wraith:elite'],
    rageText: '목매단 자들의 원한이 깨어난다!',
    intro: '이 언덕에 매달린 자, 셀 수 없다. 너도 그중 하나였을 뿐.', outro: '우리는… 전부… 죄가 없었다…',
    deathPalette: ['#e43b44', '#16101f', '#c9b8e8'],
  },
  // ── 6~10층 각성 보스: 같은 존재의 심층 강화판 (기믹 강화 + 패턴 확장) ──
  6: {
    awakened: true, name: '되살아난 오스문드', sprite: 'bossWraith', scale: 1.6, r: 26, hp: 550, speed: 48,
    banner: '되살아난 오스문드',
    punish: 'volley', punishProj: 'soul',
    p1: ['sweep>spiral:soul', 'curse', 'fan:soul:snipe'],
    p2: ['curse>spiral:soul>sweep', 'sweep>sweep', 'summon:boneHeap>spiral:soul'],
    rageText: '오스문드의 원혼이 울부짖는다!',
    intro: '네가 날 죽였지. 그런데… 왜 나도 깨어난 거지?', outro: '저주는… 너만의 것이… 아니었어…',
    deathPalette: ['#e43b44', '#241832', '#e8e0cf'],
  },
  7: {
    awakened: true, name: '역병 걸린 몰귀', sprite: 'bossPlague', scale: 1.6, r: 32, hp: 680, speed: 38,
    mechanic: { type: 'regen', label: '포자 갑피 — 부하가 살아있는 동안 재생한다' },
    banner: '역병 걸린 몰귀',
    punish: 'volley', punishProj: 'spore',
    p1: ['fan:spore:cross', 'ring>summon:sporePuff', 'geyser:poison'],
    p2: ['geyser:poison>fan:spore', 'fan:spore:snipe>geyser:poison', 'fan:spore:gap'],
    rageText: '역병이 들끓는다!',
    intro: '늪까지 스며들었다… 성에서 흘러온 그 잿가루가!', outro: '근원을… 끊어라… 성으로…',
    deathPalette: ['#6ab04c', '#8a3a8c', '#d8f070'],
  },
  8: {
    awakened: true, name: '절망의 바르곤', sprite: 'bossDespair', scale: 1.65, r: 33, hp: 650, speed: 34,
    mechanic: { type: 'armor', cap: 2, label: '중장갑 — 강한 일격을 경감한다' },
    banner: '절망의 바르곤',
    punish: 'charge',
    p1: ['charge>snare', 'fan:rock>ring', 'fan:rock:snipe'],
    p2: ['snare>charge', 'charge>snare>fan:rock:snipe', 'snare>fan:rock'],
    rageText: '절망이 짓누른다!',
    intro: '심문실에서 나간 진실은 없다. 들어온 진실만 있을 뿐.', outro: '기록은… 지하 서고에… 아직…',
    deathPalette: ['#383850', '#a9c1d8', '#e43b44'],
  },
  9: {
    awakened: true, name: '화형 집행관 이그니스', sprite: 'bossInferno', scale: 1.7, r: 30, hp: 850, speed: 48,
    mechanic: { type: 'rage', label: '백열 — 시간이 지날수록 빨라진다' },
    banner: '화형 집행관 이그니스',
    punish: 'charge', punishTrail: true,
    p1: ['fan:fire>geyser:fire', 'charge:trail>ring'],
    p2: ['geyser:fire>charge:trail', 'fan:fire:snipe>geyser:fire', 'charge:trail>geyser:fire'],
    rageText: '겁화가 폭주한다!',
    intro: '증거는 전부 태웠다. 너도 태우면 끝이다!', outro: '태워도… 태워도… 되살아나는군…',
    deathPalette: ['#ffd866', '#ff7043', '#7a1010'],
  },
  10: {
    awakened: true, name: "왕실 처형인 '무거운 손'", sprite: 'bossVoid', scale: 1.95, r: 30, hp: 1300, speed: 54,
    mechanic: { type: 'veil', label: '어둠 장막 — 영혼 구슬을 파괴하라', veils: [0.75, 0.5, 0.25] },
    banner: "왕실 처형인 '무거운 손'",
    punish: 'volley', punishProj: 'soul',
    sig: 'halfSweep', // 인장기 「참수 집행」 — 나를 처형한 그 도끼
    p1: ['sweep>spiral:soul', 'ring:gap>curse', 'fan:soul:snipe'],
    p2: ['ring:gap>spiral:soul>fan:soul:snipe', 'sweep>curse>fan:soul', 'summon:voidSpawn>spiral:soul'],
    rageText: '처형인의 도끼가 검게 물든다!',
    intro: '네 목을 친 건 나다. 원한은 알겠으나 — 두 번 치는 것도 일이지.', outro: '명단은… 재판소가 아니라… 성에서 내려왔다…',
    deathPalette: ['#e43b44', '#0a0612', '#c9b8e8'],
  },
  // ── 2막 막보스 (20층): 균사 정원의 주인 ──
  20: {
    awakened: true, name: "관문 사령관 '철벽 로트가르'", sprite: 'bossQueen', scale: 1.9, r: 32, hp: 1800, speed: 40,
    mechanic: { type: 'regen', label: '군의관 지원 — 부하가 살아있는 동안 재생한다' },
    banner: "관문 사령관 '철벽 로트가르'",
    punish: 'volley', punishProj: 'spore',
    sig: 'shieldCharge', // 인장기 「방패 파쇄 돌격」
    p1: ['fan:spore:gap>ring', 'summon:sporeling>spiral:spore', 'geyser:poison>fan:spore'],
    p2: ['ring:gap>spiral:spore', 'summon:glowShrieker>fan:spore:cross', 'fan:spore:snipe>geyser:poison>ring'],
    rageText: '관문 수비대 전원, 응전하라!',
    intro: '여기서부터는 왕도다. 죽은 것은 다리를 건널 수 없다.', outro: '마차 호위는… 명예였다… 안을 보기 전까지는…',
    deathPalette: ['#c9d94a', '#8adf76', '#6a3aa2'],
  },
  // ── 3막 막보스 (30층): 나를 판결한 자 ──
  30: {
    awakened: true, name: "대재판관 '발디아 공작'", sprite: 'bossValdia', scale: 1.9, r: 33, hp: 2400, speed: 36,
    mechanic: { type: 'armor', cap: 2, label: '판결의 법복 — 강한 일격을 경감한다' },
    banner: "대재판관 '발디아 공작'",
    punish: 'volley', punishProj: 'rock',
    sig: 'brandZone', // 인장기 「사형 선고」 — 판결은 도망쳐도 따라온다
    p1: ['fan:rock:snipe>ring', 'snare>fan:rock', 'charge>ring>fan:rock'],
    p2: ['snare>charge>fan:rock:snipe', 'ring:gap>fan:rock:cross', 'geyser:poison>snare>ring'],
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
    p1: ['fan:soul:snipe>ring', 'curse>spiral:soul', 'summon:acolyte>fan:soul:cross'],
    p2: ['ring:gap>spiral:soul>fan:soul:snipe', 'curse>summon:acolyte>ring', 'sweep>curse>spiral:soul'],
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
    p1: ['charge>ring', 'sweep>sweep>fan:rock:snipe', 'snare>charge'],
    p2: ['charge>snare>fan:rock:snipe', 'sweep>sweep>ring', 'fan:rock:cross>charge'],
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
    p1: ['sweep>sweep', 'charge>ring', 'fan:rock:snipe>sweep'],
    // 2페이즈: 성배 폭주 — 지나온 보스들의 패턴을 역으로 사용 ("네놈들의 원한이 이런 모습이더냐")
    p2: ['spiral:soul>ring:gap', 'geyser:poison>fan:fire:cross', 'summon:voidSpawn>spiral:soul', 'curse>sweep>fan:soul:snipe'],
    // 3페이즈 (HP 25%↓ 맹공과 함께): 성배 분리 발악 — 모든 것을 쏟아낸다
    p3: ['ring:gap>spiral:soul>fan:soul:snipe', 'geyser:poison>summon:voidSpawn>ring', 'curse>charge>fan:fire:cross'],
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
    p1: ['snare>charge', 'fan:rock:snipe>snare', 'charge>ring'],
    p2: ['snare>charge>fan:rock', 'ring>snare>charge', 'charge>snare>charge'],
    rageText: '갈고리에 걸리면 끝이다!',
    intro: '강에 버린 것들이 기어 올라오는군. 다시 가라앉혀주마.',
    outro: '건진 게… 아니라… 버린 거였나… 나는…',
    deathPalette: ['#5c9ded', '#8a653f', '#c8ccd8'],
  },
  61: {
    awakened: true, name: "뱃사공 '침묵의 요른'", sprite: 'bossJorn', scale: 1.8, r: 30, hp: 700, speed: 34,
    banner: "뱃사공 '침묵의 요른'",
    punish: 'volley', punishProj: 'soul', sig: 'halfSweep',
    p1: ['sweep>spiral:soul', 'spiral:soul>ring', 'fan:soul:snipe>sweep'],
    p2: ['spiral:soul>sweep>ring', 'ring:gap>spiral:soul', 'sweep>fan:soul:cross'],
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
    p1: ['summon:acolyte>fan:soul', 'curse>fan:soul:snipe', 'fan:soul:cross>curse'],
    p2: ['summon:shade>curse>fan:soul', 'fan:soul:snipe>summon:acolyte', 'curse>fan:soul:cross'],
    rageText: '기록은 조작하면 그만이다!',
    intro: '네 죄목? 내가 썼다. 잉크 값은 영지로 받았지.',
    outro: '고쳐 쓸 수… 없는 기록도… 있었군…',
    deathPalette: ['#b8ae96', '#7a1c28', '#3a2c1a'],
  },
  63: {
    awakened: true, name: "사병대장 '철퇴 가로크'", sprite: 'bossGarok', scale: 1.9, r: 32, hp: 760, speed: 38,
    mechanic: { type: 'armor', cap: 2, label: '영주의 중갑 — 강한 일격을 경감한다' },
    banner: "사병대장 '철퇴 가로크'",
    punish: 'charge', sig: 'miniSig',
    p1: ['charge>ring', 'ring>fan:rock', 'sweep>sweep>ring'],
    p2: ['charge>ring>fan:rock', 'ring>ring', 'sweep>charge>ring'],
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
    p1: ['geyser:poison>fan:spore', 'summon:sporePuff>ring', 'fan:spore:snipe>geyser:poison'],
    p2: ['curse>geyser:poison>fan:spore', 'fan:spore:cross>summon:sporePuff', 'geyser:poison>ring:gap'],
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
    p1: ['charge:trail>geyser:fire', 'fan:fire>charge:trail', 'geyser:fire>ring'],
    p2: ['geyser:fire>charge:trail>fan:fire', 'fan:fire:cross>geyser:fire', 'charge:trail>ring>fan:fire'],
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
    p1: ['spiral:soul>curse', 'fan:soul:cross>ring:gap', 'ring:gap>fan:soul:snipe'],
    p2: ['curse>spiral:soul>fan:soul', 'summon:voidSpawn>ring:gap', 'spiral:soul>fan:soul:cross'],
    rageText: '별은 거짓을 말하지 않는다 — 내가 대신 말했을 뿐!',
    intro: '오르빈은 별을 읽고 죽었다. 나는 읽고도 입을 다물었지.',
    outro: '별점은… 옳았다… 전부… 오르빈… 미안…',
    deathPalette: ['#8a5ac2', '#a9e3ff', '#2e4a74'],
  },
  67: {
    awakened: true, name: "검은 창기병 '무언의 기수'", sprite: 'bossLancer', scale: 1.8, r: 30, hp: 740, speed: 50,
    banner: "검은 창기병 '무언의 기수'",
    punish: 'charge', sig: 'triCharge',
    p1: ['charge>charge', 'sweep>charge', 'fan:rock:snipe>charge'],
    p2: ['charge>charge>charge', 'sweep>charge>ring', 'charge>fan:rock:snipe>charge'],
    rageText: '(창끝이 낮아진다)',
    intro: '(아무 말 없이 창을 겨눈다)',
    outro: '(투구 속에서, 아주 오래된 한숨이 새어 나온다)',
    deathPalette: ['#23202c', '#7a1c28', '#c8ccd8'],
  },
};

function createBoss(floor, x, y) {
  // 중간 층 (11~19·21~29·31~39): 각성 보스(6~9)가 원혼으로 재림, 층당 +15% HP.
  // 20 로트가르 / 30 발디아 / 40 이노첸시오 = 막보스 (고정 HP). 41층+ (무한 가도): 각성 5보스 순환
  const FIXED = { 20: 20, 30: 30, 40: 40, 45: 45, 50: 50 };
  // 왕의 공범들: 막별 전용 순환 보스 (재림 4인방 해체) — 51층+ 무한은 8인 전원 순환
  const CYCLE_POOL = { 2: [60, 61], 3: [62, 63], 4: [64, 65], 5: [66, 67] };
  const defKey = floor <= 10 ? floor
    : FIXED[floor] ? FIXED[floor]
    : floor <= 50 ? CYCLE_POOL[Math.min(5, Math.ceil(floor / 10))][floor % 2]
    : [60, 61, 62, 63, 64, 65, 66, 67][(floor - 51) % 8];
  const def = BOSS_DEFS[defKey] || BOSS_DEFS[1];
  // 계측 조정 (관통 v2): 배율 무제한이라 49층 절망의 바르곤 hp 4450 > 흰 늑대 3600 —
  // 필러 보스가 랜드마크 보스를 넘어섰고, 3런 사망의 절반이 이 한 킷에 몰렸다 (49층 17회 군집).
  // 상한 ×4.5: 49층 hp ≈2900 — 5막 서열(늑대 3600 < 왕 5000)을 회복한다. 51층+ 무한은 상한 없음 (의도된 지옥)
  const rawScale = 1 + 0.15 * (floor - 10);
  const hpScale = floor <= 10 || FIXED[floor] ? 1 : floor <= 50 ? Math.min(4.5, rawScale) : rawScale;
  const hp = Math.round(def.hp * hpScale);
  return {
    type: 'boss', isBoss: true,
    name: def.name,
    defId: defKey, // 도감 귀속 — 층 산식 대신 실제 킷으로
    def,
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
    // 기믹 상태
    armorCap: def.mechanic?.type === 'armor' ? def.mechanic.cap : 0,
    rageT: 0,
    rageStacks: 0,
    veilsDone: 0,
    phased: false,    // 어둠 장막 중 무적
    _regenTick: 0,
    _regenPause: 0,
    fightT: 0,        // 전투 경과 시간 — 소프트 인레이지
    enrage: 0,        // 45초마다 +1 (최대 3): 패턴 가속
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
        if (d > 300 && Math.random() < 0.75) {
          const sub = list.filter((c) => /snipe|geyser|spiral|summon|curse/.test(c));
          if (sub.length) pool = sub;
        } else if (d < 150 && Math.random() < 0.6) {
          const sub = list.filter((c) => /ring|sweep|charge/.test(c));
          if (sub.length) pool = sub;
        }
      }
      let idx = Math.floor(Math.random() * pool.length);
      if (pool.length > 1 && list.indexOf(pool[idx]) === this._lastPatIdx) idx = (idx + 1) % pool.length;
      this._lastPatIdx = list.indexOf(pool[idx]);
      const steps = pool[idx].split('>');
      this._comboQueue = steps.slice(1);
      return this._parseStep(steps[0]);
    },

    // 초식의 다음 연계로 — 남은 연계가 없으면 idle
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
              game.spawnProjectile(v.projKind, this.x, this.y, { x: Math.cos(a), y: Math.sin(a) }, { speed: v.speed, dmg: 1 });
            }
            AudioSys.shoot();
            this._delayed.splice(i, 1);
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

      // ── 소프트 인레이지: 오래 끌수록 보스가 빨라진다 (45초마다, 최대 3중첩) ──
      // 긴장감의 시간 축 — "언젠가는 잡겠지"가 아니라 "빨리 잡아야 한다"
      if (this.state !== 'enter') {
        this.fightT += dt;
        const want = Math.min(3, Math.floor(this.fightT / 45));
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
          if (this._regenBudget == null) this._regenBudget = this.maxHp;
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
      if (this.def.mechanic?.type === 'rage' && this.state !== 'enter') {
        this.rageT += dt;
        if (this.rageT >= 16 && this.rageStacks < 4) {
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
        Renderer.shake(6, 0.35);
        Particles.ring(this.x, this.y, { r0: 12, r1: 140, life: 0.6, color: '#e43b44', width: 5 });
      }

      // 페이즈 전환
      if (this.phase === 1 && this.hp <= this.maxHp / 2 && this.state !== 'veil') {
        this.phase = 2;
        this.state = 'idle';
        this.stateT = -0.8;
        this.attack = null;
        game.banner = { text: this.def.rageText, life: 1.6, maxLife: 1.6 };
        Renderer.shake(7, 0.4);
        AudioSys.roar();
        Particles.burst(this.x, this.y, {
          count: 26, colors: this.def.deathPalette, speed: 200, life: 0.7, size: 4,
        });
      }

      switch (this.state) {
        case 'enter':
          if (this.stateT > 1.2) {
            this.state = 'idle'; this.stateT = 0;
            // 마이크로 서사 (S3): 보스의 첫 마디 — 이름표가 아니라 존재가 되도록
            if (this.def.intro && !this._spoke) {
              this._spoke = true;
              game.banner = { text: `"${this.def.intro}"`, life: 2.4, maxLife: 2.4, color: '#c9b8e8' };
            }
          }
          break;

        case 'idle': {
          this._sigElapsed = (this._sigElapsed || 0) + dt;
          const spd = this.effSpeed();
          World.moveEntity(this, (dx / d) * spd * dt, (dy / d) * spd * dt);
          // 원거리 농성 시 공격 템포 상승 — 거리는 안전이 아니라 다른 종류의 압박이 된다
          const wait = (this.phase === 2 ? 0.75 : 1.1) * Math.pow(0.87, this.rageStacks) * Math.pow(0.85, this.enrage) * (this._onslaught ? 0.6 : 1) * (d > 300 ? 0.65 : 1);
          if (this.stateT >= wait) {
            // 인장기 (왕의 인장기): HP 75% 이하 첫 발동, 이후 막별 주기 (3막 12s / 4막 10s / 5막 8s)
            if (this.def.sig && !(this.def.sigP3 && !this._onslaught) &&
                this.hp <= this.maxHp * 0.75 && !(this._sigT > 0) && !game.sigActive()) {
              const act = Math.min(5, Math.ceil((Dungeon.floor <= 50 ? Dungeon.floor : 46) / 10));
              const interval = { 1: 999, 2: 999, 3: 12, 4: 10, 5: 8 }[act] || 10;
              if (!this._sigDone || this._sigElapsed >= interval) {
                this._sigDone = true;
                this._sigElapsed = 0;
                game.startSignature(this, this.def.sig);
                this.state = 'idle';
                this.stateT = -1.6; // 인장기 시전 동안 일반 초식 정지
                break;
              }
            }
            if (this._farT > 3.2 && this.def.punish) { // 상시 누적으로 전환하며 임계 4.5→3.2
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
              this.attack = this._nextPattern(d);
            }
            this.state = 'windup';
            this.stateT = 0;
            this.aimDir = { x: dx / d, y: dy / d };
          }
          break;
        }

        case 'windup': {
          const k = this.attack.kind;
          // 조준 갱신 (마지막 순간 고정)
          if (this.stateT < 0.35) this.aimDir = { x: dx / d, y: dy / d };
          const windups = { sweep: 0.55, fan: 0.65, curse: 0.5, summon: 0.6, charge: 0.75, ring: 0.6, spiral: 0.7, snare: 0.55, geyser: 0.6 };
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
          if (this.stateT > 0.32) {
            this.stateT = 0;
            this.swingCount++;
            this.aimDir = { x: dx / d, y: dy / d };
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
                game.hurtPlayer(1, { x: pdx / (pd || 1), y: pdy / (pd || 1) });
              }
            }
            const maxSwings = this.phase === 2 ? 4 : 3;
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
            game.hurtPlayer(1, this.aimDir, 420);
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
            game.banner = { text: '눅스가 영혼을 흡수했다...', life: 1.8, maxLife: 1.8, color: '#e43b44' };
            AudioSys.roar();
            const baseAngle = Math.atan2(p.y - this.y, p.x - this.x);
            for (let i = 0; i < 9; i++) {
              const a = baseAngle + (i - 4) * 0.22;
              game.spawnProjectile('soul', this.x, this.y, { x: Math.cos(a), y: Math.sin(a) }, { speed: 210, dmg: 1 });
            }
            this.state = 'idle';
            this.stateT = 0;
          }
          break;
        }
      }

      // 저주 장판 폭발 처리
      for (let i = this.curses.length - 1; i >= 0; i--) {
        const c = this.curses[i];
        c.t -= dt;
        if (c.t <= 0) {
          Particles.burst(c.x, c.y, {
            count: 16, colors: this.def.deathPalette, speed: 160, life: 0.45, size: 4,
          });
          AudioSys.thud();
          if (Math.hypot(p.x - c.x, p.y - c.y) < 48 + p.r) {
            const ddx = p.x - c.x, ddy = p.y - c.y;
            const dd = Math.hypot(ddx, ddy) || 1;
            game.hurtPlayer(1, { x: ddx / dd, y: ddy / dd });
          }
          if (c.fire) {
            game.firePatches.push({ x: c.x, y: c.y, r: 44, life: 2.4, kind: 'fire', by: this.name });
          }
          if (c.poison) {
            // 계측 (관통 v3): 20층 사망 18회 중 13회가 독 웅덩이 — 재생 기믹 장기전에서 융단이 됐다.
            // 지속 3.0→2.2s: 화염(2.4s) 밴드에 정렬, 웅덩이가 '피할 것'에서 '기다릴 것'으로 격하되지 않는 선
            game.firePatches.push({ x: c.x, y: c.y, r: 44, life: 2.2, kind: 'poison', by: this.name });
          }
          if (c.snare && Math.hypot(p.x - c.x, p.y - c.y) < 55 + p.r) {
            p.slowT = Math.max(p.slowT, 1.6);
            Particles.text(p.x, p.y - 30, '속박!', { color: '#c05060', size: 13 });
          }
          this.curses.splice(i, 1);
        }
      }

      // 접촉 데미지 (장막 중 제외) — 2페이즈부터는 몸 자체가 흉기다
      if (this.state !== 'veil' && this.hitCd <= 0 && Math.hypot(p.x - this.x, p.y - this.y) < p.r + this.r) {
        this.hitCd = 0.8;
        game.hurtPlayer(this.phase === 2 && Dungeon.floor >= 3 ? 2 : 1, { x: dx / d, y: dy / d }); // 접촉 2는 3층부터
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
              speed: baseSpeed * spdMul, dmg: 1,
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
        const mType = opt[0] || 'slime';
        const isElite = opt.includes('elite');
        const minions = game.enemies.filter((e) => !e.isBoss && !e.dead).length;
        for (let i = 0; i < Math.min(2, 5 - minions); i++) {
          const pos = World.randomSpawnPos(p, 140);
          game.markers.push({ x: pos.x, y: pos.y, type: mType, elite: isElite, t: 0.7 });
        }
        AudioSys.roar();
        this._endMove();
      } else if (kind === 'spiral') {
        // 나선 탄막 (심층 시그니처): 시전마다 회전하는 2겹 8방 탄 — 겹 사이 속도차가 나선을 그린다
        const projKind = opt[0] || 'soul';
        const rot = this.patternIdx * 0.45;
        for (let i = 0; i < 8; i++) {
          const a = rot + (i / 8) * Math.PI * 2;
          game.spawnProjectile(projKind, this.x, this.y, { x: Math.cos(a), y: Math.sin(a) }, { speed: 200, dmg: 1 });
          const a2 = a + Math.PI / 8;
          game.spawnProjectile(projKind, this.x, this.y, { x: Math.cos(a2), y: Math.sin(a2) }, { speed: 130, dmg: 1 });
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
      this.stateT = 0;
    },

    draw(ctx) {
      // 텔레그래프
      if (this.state === 'windup') {
        const k = this.attack?.kind;
        if (k === 'sweep') {
          const a = Math.atan2(this.aimDir.y, this.aimDir.x);
          ctx.save();
          ctx.translate(this.x, this.y);
          ctx.rotate(a);
          ctx.globalAlpha = 0.25 + Math.sin(this.animT * 18) * 0.1;
          ctx.fillStyle = '#e43b44';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, 95, -1.1, 1.1);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          ctx.globalAlpha = 1;
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
        }
      }
      // 저주 장판 텔레그래프
      for (const c of this.curses) {
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(c.t * 25) * 0.12;
        ctx.strokeStyle = c.fire ? '#ff7043' : '#b13ae0';
        ctx.fillStyle = c.fire ? 'rgba(255,112,67,0.15)' : 'rgba(177,58,224,0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      const bob = Math.sin(this.animT * 2.2) * 4;
      const img = this.flash > 0 ? Sprites.white(Sprites[this.def.sprite]) : Sprites[this.def.sprite];

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
