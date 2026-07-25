// 메타 프로그레션 — 죽어도 남는 것 (기획안 §6.2).
// 영혼 파편으로 영구 업그레이드·직업 해금. localStorage에 저장된다.

// 직업 3종 (기획안 §5) — 조작 감각 자체가 다르다
// 왕에게 죽은 네 사람 — 같은 밤, 같은 묘지에서 눈을 떴다 (기획 SCENARIO.md §3)
// ── 증거 수집록 (기획 §4): 막당 4개 — 탐사 3 + 보스 자백 1. 모으면 진실이 형태를 갖춘다 ──
// how: 'explore'(단서 방 오브젝트) / 'boss'(막보스 자백 — 처치 시 자동)
// floors: 탐사 단서가 등장할 수 있는 층 범위 [min, max]. guaranteed: 해당 층 첫 방 확정
const CLUES = [
  // 1막 — 변경
  { id: 'c1', act: 1, name: '덧칠로 고쳐진 비석', how: 'explore', floors: [1, 1], guaranteed: true,
    text: '내 무덤의 비석. 죄목이 덧칠로 고쳐져 있다 — 원래 적혀 있던 글자는 "무죄".' },
  { id: 'c2', act: 1, name: '서명 없는 밀고장', how: 'explore', floors: [2, 4],
    text: '죽은 이웃의 품에서 나온 밀고장 초안. 내 이름이 적혀 있다. 서명란은… 비어 있다. 그는 끝내 서명하지 않았던 것이다.' },
  { id: 'c3', act: 1, name: '불탄 농가의 장부', how: 'explore', floors: [5, 8],
    text: '세금 장부. 마지막 줄 — "금납 불가 시 인납(人納)으로 대신한다." 사람을 세금으로 바쳤다.' },
  { id: 'c4', act: 1, name: "처형인의 자백", how: 'boss', boss: 10,
    text: '"명단은… 재판소가 아니라… 성에서 내려왔다…" — 왕실 처형인 \'무거운 손\'의 마지막 말.' },
  // 2막 — 다리와 관문
  { id: 'c5', act: 2, name: '다리 밑 밀서', how: 'explore', floors: [11, 14],
    text: '같은 필체의 처형 명단 여러 장. 날짜가 전부 왕실 축일 사흘 전이다.' },
  { id: 'c6', act: 2, name: '관문 통행 기록', how: 'explore', floors: [15, 18],
    text: '"검은 마차 — 검문 면제, 왕실 인장." 한 달에 한 번, 축일마다.' },
  { id: 'c7', act: 2, name: '익사한 배달부의 가방', how: 'explore', floors: [12, 19],
    text: '방수포에 싸인 항아리 파편. 안쪽에 눌어붙은 검붉은 얼룩 — 피다. 아주 많은.' },
  { id: 'c8', act: 2, name: '관문 사령관의 자백', how: 'boss', boss: 20,
    text: '"마차 호위는 명예였다… 안을 보기 전까지는…"' },
  // 3막 — 영지와 재판소 (3막 콘텐츠와 함께 열린다)
  { id: 'c9', act: 3, name: '내 재판 기록', how: 'explore', floors: null, text: null },
  { id: 'c10', act: 3, name: '재판관의 왕실 친서', how: 'explore', floors: null, text: null },
  { id: 'c11', act: 3, name: '지하 감옥의 손톱 글씨', how: 'explore', floors: null, text: null },
  { id: 'c12', act: 3, name: '대재판관의 자백', how: 'boss', boss: 30, text: null },
  // 4막 — 역병의 마을과 대성당
  { id: 'c13', act: 4, name: '소각장의 명단', how: 'explore', floors: null, text: null },
  { id: 'c14', act: 4, name: '고해실 기록', how: 'explore', floors: null, text: null },
  { id: 'c15', act: 4, name: '납골당의 빈 관', how: 'explore', floors: null, text: null },
  { id: 'c16', act: 4, name: '대주교의 자백', how: 'boss', boss: 40, text: null },
  // 5막 — 왕도와 왕좌
  { id: 'c17', act: 5, name: '왕의 서신', how: 'explore', floors: null, text: null },
  { id: 'c18', act: 5, name: '성배 의식 일지', how: 'explore', floors: null, text: null },
  { id: 'c19', act: 5, name: '왕비의 유서', how: 'explore', floors: null, text: null },
  { id: 'c20', act: 5, name: '근위대장의 자백', how: 'boss', boss: 45, text: null },
  { id: 'c21', act: 5, name: '피의 성배', how: 'boss', boss: 50, text: null },
];

const CLASSES = {
  knight: {
    id: 'knight', name: '가레스', title: '목 잘린 근위기사', sprite: 'player', color: '#5a7a94',
    hp: 6, speed: 195, unlock: 0,
    desc: '3연격 처형검 · 철벽 보호막 · 전투 본능 회복',
    grudge: '왕의 침전에서 봐선 안 될 의식을 보았다 — 죄목: 반역.',
  },
  archer: {
    id: 'archer', name: '레나', title: '교수형당한 밀렵꾼', sprite: 'playerArcher', color: '#4a8a5e',
    hp: 4, speed: 200, cond: { stat: 'bestFloor', n: 3, label: '3층 도달' },
    desc: '빠른 뼈활 연사 — 3발째는 관통 강화 화살',
    grudge: '왕의 사냥터에서 피를 담는 마차를 보았다 — 죄목: 밀렵.',
  },
  mage: {
    id: 'mage', name: '오르빈', title: '화형당한 점성술사', sprite: 'playerMage', color: '#8a5ac2',
    hp: 3, speed: 190, cond: { stat: 'bestFloor', n: 5, label: '5층 도달' },
    desc: '유도 원혼탄 — 3발째는 폭발 대원혼탄',
    grudge: '왕의 별점에서 이미 끝난 수명을 읽었다 — 죄목: 요술.',
  },
  alch: {
    id: 'alch', name: '이졸데', title: '독살당한 약제사', sprite: 'playerAlch', color: '#7a9a5e',
    hp: 5, speed: 190, cond: { stat: 'wins', n: 1, label: '첫 복수' },
    desc: '맹독 플라스크 투척 — 독+화상 반응 제조기',
    grudge: "'성배의 약' 조제를 거부했다 — 재료가 사람의 피였으니까.",
  },
};

// 도감 — 몬스터 목록 (일반 61종 + 보스 10종). 처치하면 발견된다.
const CODEX_ENEMIES = [
  { id: 'slime',      name: '무덤 점액',       sprite: 'slime',      desc: '던전에서 가장 흔한 주민. 통통 튀며 다가온다.' },
  { id: 'toxicSlime', name: '썩은 점액',    sprite: 'toxicSlime', desc: '죽으면 독구름을 남긴다. 시체 위를 밟지 마라.' },
  { id: 'archer',     name: '백골 궁수',    sprite: 'archer',     desc: '조준선이 붉게 고정되면 발사된다. 대시로 피하라.' },
  { id: 'boar',       name: '들멧돼지',  sprite: 'boar',       desc: '벽으로 유인하면 스스로 부딪혀 그로기에 빠진다.' },
  { id: 'lavaHound',  name: '불탄 사냥개',      sprite: 'lavaHound',  desc: '더 빠른 돌진, 그리고 지나간 자리에 불길을 남긴다.' },
  { id: 'mushroom',   name: '늪 독버섯',         sprite: 'mushroom',   desc: '가까이 다가가면 부풀어 올라 포자를 사방에 터뜨린다.' },
  { id: 'bat',        name: '묘지 박쥐',         sprite: 'bat',        desc: '어지러운 궤도로 날아든다. 예측하지 말고 반응하라.' },
  { id: 'spider',     name: '습지 거미',       sprite: 'spider',     desc: '거미줄에 맞으면 발이 느려진다.' },
  { id: 'golem',      name: '옥지기 골렘',    sprite: 'golem',      desc: '정면 공격은 막아낸다. 등 뒤가 약점.' },
  { id: 'wraith',     name: '갇힌 원혼',         sprite: 'wraith',     desc: '비물질 상태로 벽을 통과한다. 실체화됐을 때만 벨 수 있다.' },
  { id: 'fireSpirit', name: '불귀신',    sprite: 'fireSpirit', desc: '화염구의 착탄 지점에 불길이 남는다.' },
  { id: 'necro',      name: '시체 소환술사',     sprite: 'necro',      desc: '도망다니며 부하를 소환한다. 최우선으로 처치하라.' },
  { id: 'bomber',      name: '화약 도굴꾼',     sprite: 'bomber',      desc: '붙으면 심지에 불을 붙이고 자폭한다. 자폭당하면 보상도 없다 — 터지기 전에 잡아라.' },
  { id: 'thornPlant',  name: '가시덩굴',     sprite: 'thornPlant',  desc: '움직이지 않는 대신 가시 산탄을 3연발로 퍼붓는다. 산탄 사이 틈으로 파고들어라.' },
  { id: 'executioner', name: '수석 심문관',       sprite: 'executioner', desc: '바닥에 붉은 처형 구역을 그린 뒤 도끼를 내려찍는다. 구역 밖이면 안전하다.' },
  { id: 'magmaSlime',  name: '용암 점액', sprite: 'magmaSlime', desc: '죽으면 불길을 남기고 작은 마그마 둘로 갈라진다. 광역기로 한꺼번에 정리하라.' },
  { id: 'voidEye',     name: '처형장의 눈',    sprite: 'voidEye',     desc: '다가가면 순간이동으로 도망치며 추적탄을 쏜다. 추적탄은 직각 대시로 뿌리쳐라.' },
  { id: 'skeleton',    name: '깨어난 백골',    sprite: 'skeleton',    desc: '자세를 잡은 뒤 검을 앞세워 찌르며 돌진한다. 옆으로 흘려라.' },
  { id: 'shieldSkeleton', name: '백골 방패병', sprite: 'shieldSkeleton', desc: '정면은 방패가 막는다. 골렘보다 빨리 도니 등을 잡으려면 대시가 필요하다.' },
  { id: 'sniper',      name: '토벌대 노궁수',    sprite: 'sniper',      desc: '아주 먼 곳에서 긴 점선 조준 후 강한 한 발. 조준선이 붉어지기 전에 끊어라.' },
  { id: 'swarm',       name: '시체 파리떼',      sprite: 'swarm',       desc: '하나하나는 약하지만 넷씩 몰려온다. 광역기의 밥.' },
  { id: 'frog',        name: '늪 두꺼비',     sprite: 'frog',        desc: '포물선 도약으로 넘어오고, 착지 자리에 독 웅덩이를 남긴다.' },
  { id: 'leech',       name: '습지 거머리',  sprite: 'leech',       desc: '한 번 붙으면 짧은 간격으로 계속 문다. 넉백으로 떼어내라.' },
  { id: 'iceSlime',    name: '서리 점액',  sprite: 'iceSlime',    desc: '죽으면 빙판을 남긴다. 빙판 위에선 발이 미끄러진다.' },
  { id: 'frostArcher', name: '서리 궁수',    sprite: 'frostArcher', desc: '감속 얼음 화살을 부채꼴 2연발로 쏜다. 맞으면 도망이 늦어진다.' },
  { id: 'berserker',   name: '약탈 용병',       sprite: 'berserker',   desc: '체력이 절반 아래로 떨어지면 격노 — 두 배로 빨라지고 아파진다. 한 번에 끝내라.' },
  { id: 'wisp',        name: '도깨비불',     sprite: 'wisp',        desc: '나선을 그리며 벽을 통과해 접근한다. 궤도를 읽어라.' },
  { id: 'shaman',      name: '종군 사제',       sprite: 'shaman',      desc: '다친 아군을 계속 치유한다. 최우선 처치 대상.' },
  { id: 'crystal',     name: '저주 수정',    sprite: 'crystal',     desc: '죽는 순간 파편을 사방으로 쏜다. 죽인 뒤에도 방심 금지.' },
  { id: 'ghoul',       name: '굶주린 식시귀',         sprite: 'ghoul',       desc: '전장의 시체를 먹고 강해진다. 시체가 쌓이기 전에 잡아라.' },
  { id: 'charger',     name: '들이받는 짐승',       sprite: 'charger',     desc: '짧은 돌진을 세 번 연속, 매번 다시 조준한다. 세 번째까지 방심하지 마라.' },
  { id: 'turret',      name: '버려진 쇠뇌 진지',    sprite: 'turret',      desc: '8방향 탄막을 회전시키며 쏜다. 같은 자리는 두 번 안전하지 않다.' },
  { id: 'mimic',       name: '의태 상자',         sprite: 'mimic',       desc: '보물상자로 위장한다. 진짜 상자는 방 한가운데, 가짜는... 글쎄.' },
  { id: 'stalker',     name: '왕실 밀정', sprite: 'stalker',    desc: '사라졌다가 등 뒤에서 나타난다. 그림자가 비치면 몸을 굴려라.' },
  { id: 'brute',       name: '도굴 용병',         sprite: 'brute',       desc: '넓은 부채꼴로 몽둥이를 휘두른다. 품 안쪽이나 등 뒤가 안전하다.' },
  { id: 'imp',         name: '화형장 도깨비',         sprite: 'imp',         desc: '깜빡이며 순간이동하고 화염구를 던진다. 성가심의 화신.' },
  { id: 'glutton',     name: '시체 포식자',       sprite: 'glutton',     desc: '숨을 들이쉬며 끌어당긴 뒤 깨문다. 흡입 중엔 반대로 달리거나 대시로 끊어라.' },
  // ── 2026-07 확장 24종 — 층 전용 로스터 ──
  { id: 'sporePuff',    name: '홀씨주머니',     sprite: 'sporePuff',    desc: '떠다니는 지뢰. 터지기 전에 멀리서 처리하라.' },
  { id: 'acidSnail',    name: '산성 달팽이',   sprite: 'acidSnail',    desc: '느리지만 단단하고, 지나간 자리가 산성 늪이 된다.' },
  { id: 'jailer',       name: '늙은 간수',          sprite: 'jailer',       desc: '사슬 갈고리로 끌어당긴다. 조준선이 빛나면 궤도에서 비켜라.' },
  { id: 'frostMage',    name: '왕실 빙결술사',     sprite: 'frostMage',    desc: '3갈래 감속탄을 뿌리고, 다가가면 도약한다 — 두 번뿐이지만.' },
  { id: 'cinder',       name: '떠도는 불씨',          sprite: 'cinder',       desc: '작고 빠르다. 죽는 자리에 불길이 남으니 발밑을 조심하라.' },
  { id: 'ashWalker',    name: '재의 보행자',   sprite: 'ashWalker',    desc: '걸음마다 불길을 남긴다. 오래 두면 방 전체가 타오른다.' },
  { id: 'emberMoth',    name: '불나방',        sprite: 'emberMoth',    desc: '맴돌다 예고 후 급강하한다. 느낌표가 뜨면 옆으로.' },
  { id: 'acolyte',      name: '광신 복사',     sprite: 'acolyte',      desc: '보라 조준선이 굵어지는 순간 어둠탄이 날아온다.' },
  { id: 'shade',        name: '목매단 그림자',        sprite: 'shade',        desc: '흐릿할 땐 벨 수 없다. 실체화 주기를 읽고 반격하라.' },
  { id: 'gazer',        name: '감시의 눈',        sprite: 'gazer',        desc: '6방향 탄막을 두른다. 탄과 탄 사이 틈이 살 길이다.' },
  { id: 'bloodBat',     name: '흡혈박쥐',     sprite: 'bloodBat',     desc: '물어뜯을 때마다 제 피를 채운다. 방치가 곧 회복이다.' },
  { id: 'boneHeap',     name: '뼈무더기',      sprite: 'boneHeap',     desc: '쓰러뜨려도 뼈 더미가 남는다. 더미까지 부숴야 끝난다.' },
  { id: 'venomLasher',  name: '독초 넝쿨',        sprite: 'venomLasher',  desc: '전방 부채꼴로 채찍을 휘두른다. 맞으면 발이 굳는다.' },
  { id: 'sporeMother',  name: '포자 어미',     sprite: 'sporeMother',  desc: '포자 방울을 계속 낳는다. 어미부터 끊는 게 순리다.' },
  { id: 'acidSlug',     name: '산성 민달팽이', sprite: 'acidSlug',     desc: '포물선 산탄. 착탄 예고 원이 보이면 그 자리를 떠나라.' },
  { id: 'warden',       name: '간수장 방패병',        sprite: 'warden',       desc: '정면은 방패가 막는다. 등을 잡거나, 돌진을 흘려보내라.' },
  { id: 'chainWraith',  name: '사슬 원혼',     sprite: 'chainWraith',  desc: '발밑에 사슬 올가미를 던진다. 원 밖이면 안전하다.' },
  { id: 'frostGolem',   name: '서리 골렘',     sprite: 'frostGolem',   desc: '내려찍기 충격파와 빙판. 링은 대시로 통과할 수 있다.' },
  { id: 'obsidianBeast', name: '흑요암 짐승',     sprite: 'obsidianBeast', desc: '중장갑 돌진수. 죽는 순간 사방으로 파편이 튄다.' },
  { id: 'flameJuggler', name: '화형 조수',   sprite: 'flameJuggler', desc: '화염탄을 저글링하듯 던진다. 착탄 원을 읽어라.' },
  { id: 'lavaBurster',  name: '화약 박격수',   sprite: 'lavaBurster',  desc: '발밑에서 간헐천이 솟는다. 예고 원에서 비켜서라.' },
  { id: 'voidSpawn',    name: '원혼 조각',     sprite: 'voidSpawn',    desc: '죽는 순간 공허탄을 뱉는다. 마지막까지 방심 금물.' },
  { id: 'riftCaster',   name: '균열 심문관',     sprite: 'riftCaster',   desc: '주위에 균열을 열고 유도탄을 쏜다. 균열부터 피하라.' },
  { id: 'mirrorKnight', name: '왕실 거울기사',     sprite: 'mirrorKnight', desc: '은빛으로 빛나는 반격 자세가 끝나면 찌르기가 온다. 물러나라.' },
  // ── 2막: 균사 정원 (11~20층) ──
  { id: 'sporeling',     name: '물에 불은 시체',     sprite: 'sporeling',     desc: '강에 버려진 처형자들이다. 죽으면 썩은 독기를 터뜨린다 — 시체 위를 걷지 마라.' },
  { id: 'fungalTick',    name: '강거머리',   sprite: 'fungalTick',    desc: '다리 밑에서 배를 채워온 것. 몸을 말았다가 튕겨 날아든다.' },
  { id: 'myceliumBrute', name: '관문 골렘',     sprite: 'myceliumBrute', desc: '관문을 지키던 골렘에 오물이 눌어붙었다. 내려찍은 자리가 썩는다.' },
  { id: 'rotWalker',     name: '오물 보행자',   sprite: 'rotWalker',     desc: '하수구를 걸어온 자 — 걸음마다 땅이 썩고, 멀리서 농성하면 오물을 뱉는다.' },
  { id: 'glowShrieker',  name: '관문 나팔수',   sprite: 'glowShrieker',  desc: '나팔로 토벌대를 가속시킨다. 나팔이 울리기 전에 목을 끊어라.' },
  { id: 'boss1', boss: true, name: '무덤지기 오스문드', sprite: 'boss',      desc: '죄인 묘지의 관리인 — 왕명으로 시체를 팔아왔다. 낫 연격과 원혼 부채꼴.' },
  { id: 'boss2', boss: true, name: '늪지기 몰귀',       sprite: 'bossSpore', desc: '2층의 주인. 부하가 살아있는 동안 재생한다 — 부하를 한꺼번에 쓸어담을 수단을 연구하라.' },
  { id: 'boss3', boss: true, name: '간수장 바르곤',     sprite: 'bossGolem', desc: '3층의 주인. 중장갑이 강한 일격을 경감한다 — 갑옷을 무시하고 스며드는 피해가 열쇠.' },
  { id: 'boss4', boss: true, name: '방화대장 이그니스', sprite: 'bossIgnis', desc: '4층의 주인. 시간이 지날수록 백열해 빨라진다 — 속전속결하거나, 오래 버틸 몸을 만들라.' },
  { id: 'boss5', boss: true, name: '교수대의 그림자',   sprite: 'bossAbyss', desc: '탑의 정점. 어둠 장막 중에는 영혼 구슬만이 유일한 약점 — 흩어진 구슬을 잡을 기동력을 갖춰라.' },
  { id: 'boss6', boss: true, name: '되살아난 오스문드', sprite: 'bossWraith',  desc: '6층의 주인. 죽음에서 돌아온 뱃사공 — 회전 나선탄과 뼈무더기 소환.' },
  { id: 'boss7', boss: true, name: '역병 걸린 몰귀',    sprite: 'bossPlague',  desc: '7층의 주인. 맹독 간헐천이 바닥을 잠식한다 — 포자 방울부터 끊어라.' },
  { id: 'boss8', boss: true, name: '절망의 바르곤',     sprite: 'bossDespair', desc: '8층의 주인. 사슬 올가미가 발을 묶는다 — 예고 원 밖으로.' },
  { id: 'boss9', boss: true, name: '화형 집행관 이그니스', sprite: 'bossInferno', desc: '9층의 주인. 백열하는 간헐천 연쇄 — 멈추는 순간 타오른다.' },
  { id: 'boss10', boss: true, name: "왕실 처형인 '무거운 손'", sprite: 'bossVoid',  desc: '탑의 진정한 정점. 세 겹의 어둠 장막과 공허 유충 — 모든 것을 건 최후의 시험.' },
  { id: 'boss20', boss: true, name: "관문 사령관 '철벽 로트가르'", sprite: 'bossQueen', desc: '2막의 주인. 검은 마차를 호위해온 자 — 군의관이 살아있는 한 상처가 아문다.' },
];

// 기억의 제단 — 영구 업그레이드 (밸런스 원칙: 초반 체감 +30% 이내)
// 열기 서약 (G3): 고정 누적 대신 골라 담는다 — 난이도 올리기가 그 자체로 선택이 되도록.
// 파편 보너스는 서약 '수'에 비례하므로 어떤 조합이든 보상은 같다.
const HEAT_PACTS = [
  { id: 'hp',    name: '왕실 무구 지급', desc: '토벌대 HP 강화 (층 비례)' },
  { id: 'count', name: '토벌대 증원', desc: '적 수 +2 (3층부터)' },
  { id: 'speed', name: '사냥개 방목', desc: '적 속도 +15%' },
  { id: 'heal',  name: '우물 봉쇄령', desc: '생혈 드랍 절반 · 모닥불 회복 감소' },
  { id: 'boss',  name: '친위 강화령', desc: '보스 HP +50% · 시작 HP -1' },
  // 확장 서약 (열기 5→7단): 골라담기라 어떤 조합이든 성립한다
  { id: 'elite', name: '정예 소집령', desc: '정예 확률 +10%p' },
  { id: 'skill', name: '성수 살포', desc: '망자의 스킬 쿨다운 +25%' },
];

const META_UPGRADES = [
  { id: 'vit',    name: '육체', desc: '시작 최대 HP +1',        max: 3, costs: [40, 90, 180] },
  { id: 'pow',    name: '완력', desc: '시작 공격력 +1',          max: 2, costs: [120, 320] },
  { id: 'dash',   name: '바람', desc: '대시 충전 속도 +10%',     max: 3, costs: [50, 110, 220] },
  { id: 'choice', name: '기회', desc: '레벨업 선택지 3장 → 4장', max: 1, costs: [250] },
  { id: 'greed',  name: '수확', desc: '영혼 파편 획득 +15%',     max: 3, costs: [60, 130, 260] },
  { id: 'reroll', name: '환생', desc: '레벨업 카드 다시 뽑기 +1회/런 (E)', max: 3, costs: [150, 300, 500] },
  { id: 'legacy', name: '유산', desc: '런 시작 시 커먼 유물 3택1',  max: 1, costs: [400] },
];

const Meta = {
  data: null,

  _default() {
    return {
      shards: 0,
      up: {},                      // 업그레이드 레벨 {vit:1, ...}
      classes: { knight: true },   // 해금된 직업
      cls: 'knight',               // 선택된 직업
      runs: 0,
      wins: 0,
      bestFloor: 0,
      totalKills: 0,
      heat: 0,       // 열기 (고난이도 0~5, 첫 클리어 후 해금) — 서약 수의 캐시
      heatPacts: null, // 열기 서약 골라담기 {hp,count,speed,heal,boss} — null이면 heat 수치에서 이관
      muted: false,
      codex: { kills: {}, relics: {}, traits: {} }, // 도감 기록
      welcomed: false, // 환영 파편 지급 여부
    };
  },

  load() {
    try {
      const raw = localStorage.getItem('dungeoncrawler_meta');
      this.data = raw ? { ...this._default(), ...JSON.parse(raw) } : this._default();
    } catch (e) {
      this.data = this._default();
    }
    // 환영 선물: 처음부터 다른 직업을 해금해 볼 수 있도록 파편 지급 (1회)
    if (!this.data.welcomed) {
      this.data.welcomed = true;
      this.data.shards += 800;
      this.save();
    }
  },

  save() {
    try {
      localStorage.setItem('dungeoncrawler_meta', JSON.stringify(this.data));
    } catch (e) { /* 시크릿 모드 등 저장 불가 환경 무시 */ }
  },

  lvl(id) {
    return this.data.up[id] || 0;
  },

  upgradeDef(id) {
    return META_UPGRADES.find((u) => u.id === id);
  },

  cost(id) {
    const def = this.upgradeDef(id);
    const lv = this.lvl(id);
    return lv >= def.max ? null : def.costs[lv];
  },

  buy(id) {
    const c = this.cost(id);
    if (c === null || this.data.shards < c) return false;
    this.data.shards -= c;
    this.data.up[id] = this.lvl(id) + 1;
    this.save();
    return true;
  },

  classUnlocked(id) {
    if (id === 'knight') return true; // 검사는 기본
    if (typeof Game !== 'undefined' && Game.testMode) return true; // 테스트 모드: 전 직업 개방
    if (this.data.classes[id]) return true; // 구버전(파편 구매) 이관 보호
    const c = CLASSES[id] && CLASSES[id].cond;
    return !!c && (this.data[c.stat] || 0) >= c.n; // 조건 해금: 궁수 3층 / 마도사 5층 / 연금술사 첫 복수
  },

  // 조건 해금 전환 (2026-07): 파편 구매 폐지 — 치트(Y)·강제 지급 전용
  unlockClass(id) {
    if (!CLASSES[id] || this.classUnlocked(id)) return false;
    this.data.classes[id] = true;
    this.data.cls = id;
    this.save();
    return true;
  },

  selectClass(id) {
    if (!this.classUnlocked(id)) return false;
    this.data.cls = id;
    this.save();
    return true;
  },

  // ── 도감 기록 (kills는 방 클리어/정산 시점에 저장) ──
  codexKill(key) {
    const isNew = !this.data.codex.kills[key];
    this.data.codex.kills[key] = (this.data.codex.kills[key] || 0) + 1;
    if (isNew) this._checkCodexMilestone();
  },

  // 도감 발견 구간 보상 — 수집이 파편으로 돌아온다 (구간당 1회)
  _checkCodexMilestone() {
    const found = CODEX_ENEMIES.filter((e) => {
      const key = e.boss ? 'boss' + e.id.slice(4) : e.id;
      return this.data.codex.kills[key] > 0;
    }).length;
    const milestones = [[10, 100], [25, 150], [40, 250], [55, 350], [71, 600]]; // 확장 71종 기준
    if (!this.data.codexRewarded) this.data.codexRewarded = {};
    for (const [need, reward] of milestones) {
      if (found >= need && !this.data.codexRewarded[need]) {
        this.data.codexRewarded[need] = true;
        this.data.shards += reward;
        this.save();
        if (typeof Game !== 'undefined' && Game.banner !== undefined) {
          Game.banner = { text: `도감 ${need}종 달성! ◆ +${reward}`, life: 2.2, maxLife: 2.2, color: '#2ec4b6' };
          AudioSys.buy();
        }
      }
    }
  },

  codexRelic(id) {
    if (!this.data.codex.relics[id]) {
      this.data.codex.relics[id] = true;
      this.save();
    }
  },

  codexTrait(id) {
    this.data.codex.traits[id] = (this.data.codex.traits[id] || 0) + 1;
  },

  // 열기(고난이도)는 탑을 한 번 정복해야 해금된다
  // ── 해금 파이프라인 (P3): 일부 특성·유물은 전적으로 연다 — "다음 런엔 새 게 나온다" ──
  isUnlocked(def) {
    if (!def || !def.unlock) return true;
    return (this.data[def.unlock.stat] || 0) >= def.unlock.n;
  },

  checkUnlocks() {
    if (!this.data.unlocksSeen) this.data.unlocksSeen = {};
    const fresh = [];
    for (const def of [...TRAITS, ...RELICS]) {
      if (!def.unlock || this.data.unlocksSeen[def.id]) continue;
      if (this.isUnlocked(def)) {
        this.data.unlocksSeen[def.id] = true;
        fresh.push(def.name);
      }
    }
    if (fresh.length) {
      this.save();
      if (typeof Game !== 'undefined') {
        Game.banner = { text: `해금! ${fresh.join(' · ')} — 다음 런부터 등장`, life: 3.0, maxLife: 3.0, color: '#f7b32b' };
        AudioSys.buy();
      }
    }
    return fresh;
  },

  heatUnlocked() {
    return this.data.wins > 0 || this.data.bestFloor >= 5;
  },

  // 서약 저장소 — 기존 heat 수치(0~5)에서 1회 이관 (canonical 순서 앞에서부터)
  _pacts() {
    if (!this.data.heatPacts) {
      const h = Math.min(5, Math.max(0, this.data.heat || 0));
      this.data.heatPacts = {};
      HEAT_PACTS.forEach((p, i) => { this.data.heatPacts[p.id] = i < h; });
    }
    return this.data.heatPacts;
  },

  heat() {
    if (!this.heatUnlocked()) return 0;
    return HEAT_PACTS.reduce((n, p) => n + (this._pacts()[p.id] ? 1 : 0), 0);
  },

  togglePact(id) {
    const ps = this._pacts();
    ps[id] = !ps[id];
    this.data.heat = HEAT_PACTS.reduce((n, p) => n + (ps[p.id] ? 1 : 0), 0);
    this.save();
  },

  // ←→ 키 호환: 열기 N = canonical 순서 앞에서부터 N개 켠 것과 동치
  setHeat(h) {
    const n = Math.min(HEAT_PACTS.length, Math.max(0, h));
    this.data.heatPacts = {};
    HEAT_PACTS.forEach((p, i) => { this.data.heatPacts[p.id] = i < n; });
    this.data.heat = n;
    this.save();
  },

  // 런 시작 시 서약 플래그 스냅샷. 계측 리그가 Meta.heat를 함수로 덮어쓰는 경우
  // (저장된 서약 수와 불일치) canonical 순서 앞 N개로 해석해 하위 호환한다.
  pactFlags(count) {
    const ps = this._pacts();
    const stored = HEAT_PACTS.reduce((n, p) => n + (ps[p.id] ? 1 : 0), 0);
    const out = {};
    if (stored === count) {
      HEAT_PACTS.forEach((p) => { out[p.id] = !!ps[p.id]; });
    } else {
      HEAT_PACTS.forEach((p, i) => { out[p.id] = i < count; });
    }
    return out;
  },

  // 런 정산: 도달 층수·처치 수 비례 + 열기 보너스 (기획안 §2-5)
  runReward(floor, roomIndex, kills, victory, heat = 0) {
    const base = kills + (floor - 1) * 25 + (roomIndex - 1) * 2 + (victory ? 100 : 0);
    return Math.max(1, Math.round(base * (1 + 0.15 * this.lvl('greed')) * (1 + 0.2 * heat)));
  },

  endRun(floor, roomIndex, kills, victory, heat = 0, mul = 1) {
    const earned = Math.round(this.runReward(floor, roomIndex, kills, victory, heat) * mul);
    this.data.shards += earned;
    this.data.runs++;
    this.data.totalKills += kills;
    if (victory) this.data.wins++;
    setTimeout(() => this.checkUnlocks(), 0); // 정산 직후 새 해금 배너 (스탯 반영 뒤)
    this.data.bestFloor = Math.max(this.data.bestFloor, victory ? 10 : floor);
    this.save();
    return earned;
  },

  // ── 증거 수집록 (기획 §4) ──
  clueOwned(id) { return !!(this.data.clues && this.data.clues[id]); },
  gainClue(id) {
    const c = CLUES.find((x) => x.id === id);
    if (!c || this.clueOwned(id)) return null;
    if (!this.data.clues) this.data.clues = {};
    this.data.clues[id] = true;
    // 막 완성 체크: 같은 막 4개(5막은 5개)를 모으면 '사무친 원한' 영구 보너스
    const actClues = CLUES.filter((x) => x.act === c.act);
    if (actClues.every((x) => this.data.clues[x.id])) {
      if (!this.data.grudges) this.data.grudges = {};
      if (!this.data.grudges[c.act]) {
        this.data.grudges[c.act] = true;
        if (typeof Game !== 'undefined') {
          Game.banner = { text: `${c.act}막의 진실이 완성됐다 — 사무친 원한: 최대 HP +1 (영구)`, life: 3.4, maxLife: 3.4, color: '#e43b44' };
        }
      }
    }
    this.save();
    return c;
  },
  clueCount() { return this.data.clues ? Object.keys(this.data.clues).length : 0; },
  grudgeHp() { return this.data.grudges ? Object.keys(this.data.grudges).length : 0; },

  // 무한 모드 정산: 전체 보상에서 10층 정산 때 이미 받은 몫(paid)을 뺀 차액만 지급.
  // runs/wins는 10층 정산에서 이미 집계됐으므로 다시 세지 않는다.
  endlessRun(floor, roomIndex, kills, heat, paid, killsDelta) {
    const total = this.runReward(floor, roomIndex, kills, true, heat);
    const earned = Math.max(0, total - paid);
    this.data.shards += earned;
    this.data.totalKills += Math.max(0, killsDelta);
    this.data.bestFloor = Math.max(this.data.bestFloor, floor);
    this.save();
    return earned;
  },
};
