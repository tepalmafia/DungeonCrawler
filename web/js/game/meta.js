// 메타 프로그레션 — 죽어도 남는 것 (기획안 §6.2).
// 영혼 파편으로 영구 업그레이드·직업 해금. Store(웹 localStorage / 데스크톱 세이브 파일)에 저장된다.

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
  { id: 'c9', act: 3, name: '내 재판 기록', how: 'explore', floors: [21, 24],
    text: '기록고에서 찾은 내 재판. 배심 전원이 판결 사흘 뒤 같은 날, 영지를 하사받았다.' },
  { id: 'c10', act: 3, name: '재판관의 왕실 친서', how: 'explore', floors: [25, 28],
    text: "발디아의 서재, 금고 안 친서. \"명단대로 판결하라. 성배는 기다리지 않는다.\" — 왕의 인장." },
  { id: 'c11', act: 3, name: '지하 감옥의 손톱 글씨', how: 'explore', floors: [27, 30],
    text: '감방 벽마다 손톱으로 긁은 글씨. "우리는 죄가 없다" — 수십 명의 다른 필체. 전부 같은 말.' },
  { id: 'c12', act: 3, name: '대재판관의 자백', how: 'boss', boss: 30,
    text: '"성배가 마르면… 왕국이 마른다고 했다… 나는… 서명만 했을 뿐…"' },
  // 4막 — 역병의 마을과 대성당
  { id: 'c13', act: 4, name: '소각장의 명단', how: 'explore', floors: [31, 34],
    text: "소각 대상 명단 — '역병 사망자'라 적혀 있다. 대조해보니, 전부 처형자 명단과 일치한다." },
  { id: 'c14', act: 4, name: '고해실 기록', how: 'explore', floors: [35, 38],
    text: '어느 사제의 고해 — "죽은 자들이 깨어나는 건 역병이 아닙니다. 성하께서는 아십니다. 알고 계십니다."' },
  { id: 'c15', act: 4, name: '납골당의 빈 관', how: 'explore', floors: [37, 40],
    text: '관이 전부 비어 있다. 뚜껑마다 왕실 봉인 — 시신은 성으로 갔다. 피만 뽑히고 버려진 게 아니라면.' },
  { id: 'c16', act: 4, name: '대주교의 자백', how: 'boss', boss: 40,
    text: '"성배는… 교회가 왕에게 바쳤다… 신의 이름으로… 우리가… 시작했다…"' },
  // 5막 — 왕도와 왕좌
  { id: 'c17', act: 5, name: '왕의 서신', how: 'explore', floors: [41, 44],
    text: '"명단이 늦어지고 있다. 축일이 다가온다. — B." 필체가 처형 명단과 같다. 왕의 친필이다.' },
  { id: 'c18', act: 5, name: '성배 의식 일지', how: 'explore', floors: [45, 48],
    text: '축일마다 반복된 기록 — "죄 없는 피 열둘. 폐하의 안색이 돌아오셨다." 백 년 치가 넘는다.' },
  { id: 'c19', act: 5, name: '왕비의 유서', how: 'explore', floors: [47, 50],
    text: '"당신이 무슨 짓을 했는지 안다. 나는 당신보다 먼저 늙어 죽는 쪽을 택한다." — 왕비는 의식을 거부하고 죽었다.' },
  { id: 'c20', act: 5, name: '근위대장의 자백', how: 'boss', boss: 45,
    text: '"알고 있었다… 전부… 미안하다는 말은… 하지 않겠다… 벌을 다오…"' },
  { id: 'c21', act: 5, name: '피의 성배', how: 'boss', boss: 50,
    text: '왕의 가슴에서 뜯어낸 성배. 안에 담긴 것은 포도주가 아니다. 이제 깨뜨린다 — 전부 끝낸다.' },
];

// ── 계승 「원한의 형상화」 (v127) — 첫 정복 후 해금: 원한이 형태를 고른다 (직업당 2형상) ──
const FORMS = {
  knight: [
    { id: 'venge', name: '복수귀', desc: '처치마다 원한 중첩 (+0.4 공격, 최대 8) — 피격 시 절반을 잃는다' },
    { id: 'guard', name: '수호망령', desc: '철벽 충전 40% 단축 · 보호막이 깨질 때 주위를 밀쳐낸다' },
  ],
  archer: [
    { id: 'hunt', name: '사냥의 원혼', desc: '크리티컬이 사냥 표식을 남긴다 — 표식된 적 받는 피해 +25% (2.5초)' },
    { id: 'noose', name: '밧줄의 망령', desc: '화살 12% 확률로 올가미 — 적을 감속시킨다 (1.2초)' },
  ],
  mage: [
    { id: 'ash', name: '재의 현자', desc: '원혼탄 명중마다 불이 붙는다 (화상 1.5초) — 화염 시너지의 기점' },
    { id: 'star', name: '별의 인도자', desc: '대원혼탄 폭발 반경 +40% — 별은 더 넓게 태운다' },
  ],
  alch: [
    { id: 'plague', name: '역병 의사', desc: '중독된 적이 죽으면 독구름이 번진다' },
    { id: 'chalice', name: '성배를 삼킨 자', desc: '하트 회복 +1 · 하트마다 4초간 공격 +1 — 대신 최대 HP -1' },
  ],
};

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
  { id: 'slime',      name: '기어오는 부패',       sprite: 'slime',      desc: '녹아내린 시신이 형체를 잃고 긴다. 도약할 때만 사람이었던 것이 보인다.',
    side: 'dead', lore: '역병으로 죽은 마을 사람들이 한 구덩이에 함께 묻혔다. 누가 누구였는지 아무도 세지 않았다.' },
  { id: 'toxicSlime', name: '곪은 부패',    sprite: 'toxicSlime', desc: '죽으면 곪았던 독기가 터진다. 시체 위를 밟지 마라.',
    side: 'dead', lore: '독을 먹여 죽인 뒤 같은 구덩이에 던졌다. 죽어서도 그 독이 안에서 곪는다.' },
  { id: 'archer',     name: '백골 궁수',    sprite: 'archer',     desc: '조준선이 붉게 고정되면 발사된다. 대시로 피하라.',
    side: 'crown', lore: '활을 놓지 못한 채 묻힌 변경 수비병. 명령서에 적힌 표적은 아직도 산 사람이다.' },
  { id: 'boar',       name: '미친 군마',  sprite: 'boar',       desc: '주인을 잃고 미쳐버린 군마 — 벽으로 유인하면 스스로 부딪혀 그로기에 빠진다.',
    side: 'beast', lore: '주인이 처형된 날 함께 도살되었다. 마구간으로 돌아가는 길만 기억한다.' },
  { id: 'lavaHound',  name: '불탄 사냥개',      sprite: 'lavaHound',  desc: '더 빠른 돌진, 그리고 지나간 자리에 불길을 남긴다.',
    side: 'beast', lore: '도망친 죄인을 쫓다 농가와 함께 탔다. 코가 녹아붙어도 냄새는 쫓는다.' },
  { id: 'mushroom',   name: '시체꽃',         sprite: 'mushroom',   desc: '처형자 무덤 위에만 피는 꽃. 다가가면 부풀어 포자를 터뜨린다.',
    side: 'beast', lore: '처형자를 묻은 자리에서만 핀다. 뿌리가 무엇을 먹고 자랐는지는 모두가 안다.' },
  { id: 'bat',        name: '유골 까마귀',         sprite: 'bat',        desc: '묘지의 까마귀가 유골을 물고 난다. 예측하지 말고 반응하라.',
    side: 'beast', lore: '교수대 밑을 청소하던 새들. 사람 고기 맛을 먼저 배웠다.' },
  { id: 'spider',     name: '수의 짜는 것',       sprite: 'spider',     desc: '수의(壽衣)를 짓던 원혼 — 실에 맞으면 발이 느려진다.',
    side: 'dead', lore: '죄인의 수의를 짓다 함께 끌려간 침모. 손이 멈추지 않는 저주에 걸렸다.' },
  { id: 'golem',      name: '옥지기 골렘',    sprite: 'golem',      desc: '정면 공격은 막아낸다. 등 뒤가 약점.',
    side: 'crown', lore: '감옥 문에 죄인의 뼈를 섞어 빚었다. 열지 말라는 명령만 남았다.' },
  { id: 'wraith',     name: '갇힌 원혼',         sprite: 'wraith',     desc: '비물질 상태로 벽을 통과한다. 실체화됐을 때만 벨 수 있다.',
    side: 'dead', lore: '무덤 밖으로 나가지 못한다. 관 뚜껑에 못 대신 왕의 인장이 박혔으니.' },
  { id: 'fireSpirit', name: '불귀신',    sprite: 'fireSpirit', desc: '화염구의 착탄 지점에 불길이 남는다.',
    side: 'dead', lore: '산 채로 태워진 자의 마지막 비명. 불은 아직 꺼지지 않았다.' },
  { id: 'necro',      name: '시체 소환술사',     sprite: 'necro',      desc: '도망다니며 부하를 소환한다. 최우선으로 처치하라.',
    side: 'dead', lore: '가족의 시신을 돌려받지 못해 스스로 불러내는 법을 배웠다. 아무나 일어섰다.' },
  { id: 'bomber',      name: '화약 도굴꾼',     sprite: 'bomber',      desc: '붙으면 심지에 불을 붙이고 자폭한다. 자폭당하면 보상도 없다 — 터지기 전에 잡아라.',
    side: 'dead', lore: '무덤을 파 금니를 캐던 자. 화약을 품은 채 굳었다.' },
  { id: 'thornPlant',  name: '가시덩굴',     sprite: 'thornPlant',  desc: '움직이지 않는 대신 가시 산탄을 3연발로 퍼붓는다. 산탄 사이 틈으로 파고들어라.',
    side: 'beast', lore: '교수대 기둥을 타고 오른 덩굴. 매달린 것을 놓지 않으려 가시를 길렀다.' },
  { id: 'executioner', name: '수석 심문관',       sprite: 'executioner', desc: '바닥에 붉은 처형 구역을 그린 뒤 도끼를 내려찍는다. 구역 밖이면 안전하다.',
    side: 'crown', lore: '자백을 받아내는 솜씨로 승진했다. 바닥의 붉은 사각은 그가 그리던 처형대 자리다.' },
  { id: 'magmaSlime',  name: '불타는 부패', sprite: 'magmaSlime', desc: '소각로에서 다 타지 못한 것. 죽으면 불길을 남기고 둘로 갈라진다.',
    side: 'dead', lore: '증거와 함께 소각로에 던져진 시신. 다 타지 못해 반쯤 굳었다.' },
  { id: 'voidEye',     name: '처형장의 눈',    sprite: 'voidEye',     desc: '다가가면 순간이동으로 도망치며 추적탄을 쏜다. 추적탄은 직각 대시로 뿌리쳐라.',
    side: 'crown', lore: '처형을 하나도 놓치지 말라고 걸어둔 감시 기물. 눈꺼풀이 없다.' },
  { id: 'skeleton',    name: '깨어난 백골',    sprite: 'skeleton',    desc: '자세를 잡은 뒤 검을 앞세워 찌르며 돌진한다. 옆으로 흘려라.',
    side: 'dead', lore: '재판도 없이 목이 잘린 병졸. 마지막 자세 그대로 검을 든다.' },
  { id: 'shieldSkeleton', name: '백골 방패병', sprite: 'shieldSkeleton', desc: '정면은 방패가 막는다. 골렘보다 빨리 도니 등을 잡으려면 대시가 필요하다.',
    side: 'dead', lore: '방패를 앞세워 동료를 지키다 죽었다. 지킬 것이 없어져도 자세는 남았다.' },
  { id: 'sniper',      name: '토벌대 노궁수',    sprite: 'sniper',      desc: '아주 먼 곳에서 긴 점선 조준 후 강한 한 발. 조준선이 붉어지기 전에 끊어라.',
    side: 'crown', lore: '무덤에서 기어나온 것을 다시 눕히라고 보낸 사수. 얼굴은 보지 않고 쏜다.' },
  { id: 'swarm',       name: '시체 파리떼',      sprite: 'swarm',       desc: '하나하나는 약하지만 넷씩 몰려온다. 광역기의 밥.',
    side: 'beast', lore: '거두지 않은 시신 위에서 태어났다. 이 나라에서 가장 배부른 것들.' },
  { id: 'frog',        name: '부풀은 익사체',     sprite: 'frog',        desc: '강에 버려진 것이 물을 먹고 부풀었다. 도약 착지 자리에 썩은 물이 고인다.',
    side: 'dead', lore: '자루에 묶여 강에 던져졌다. 물을 먹고 부풀어 결국 떠올랐다.' },
  { id: 'leech',       name: '굶주린 핏줄',  sprite: 'leech',       desc: '시체에서 기어나온 혈관 — 한 번 붙으면 계속 문다. 넉백으로 떼어내라.',
    side: 'beast', lore: '피를 뽑히다 죽은 자에게서 기어나왔다. 아직 마지막 한 모금을 찾는다.' },
  { id: 'iceSlime',    name: '얼어붙은 부패',  sprite: 'iceSlime',    desc: '겨울 강에 버려졌던 것 — 죽으면 얼어붙은 바닥을 남긴다.',
    side: 'dead', lore: '겨울 강에 버려져 얼어붙은 채 봄을 기다렸다. 봄은 오지 않았다.' },
  { id: 'frostArcher', name: '서리 궁수',    sprite: 'frostArcher', desc: '감속 얼음 화살을 부채꼴 2연발로 쏜다. 맞으면 도망이 늦어진다.',
    side: 'crown', lore: '강 건너 초소에서 얼어 죽은 저격병. 도망자를 늦추라는 명령대로 쏜다.' },
  { id: 'berserker',   name: '약탈 용병',       sprite: 'berserker',   desc: '체력이 절반 아래로 떨어지면 격노 — 두 배로 빨라지고 아파진다. 한 번에 끝내라.',
    side: 'crown', lore: '삯을 받고 마을을 태운 자. 피 냄새를 맡으면 계약을 잊는다.' },
  { id: 'wisp',        name: '떠도는 혼불',     sprite: 'wisp',        desc: '나선을 그리며 벽을 통과해 다가온다. 궤도를 읽어라.',
    side: 'dead', lore: '이름이 지워진 자의 혼. 묻힐 자리를 찾아 아직 떠돈다.' },
  { id: 'shaman',      name: '종군 사제',       sprite: 'shaman',      desc: '다친 아군을 계속 치유한다. 최우선 처치 대상.',
    side: 'crown', lore: '토벌대에 축복을 내린 사제. 죄인에게 줄 기도는 배우지 않았다.' },
  { id: 'crystal',     name: '저주 수정',    sprite: 'crystal',     desc: '죽는 순간 파편을 사방으로 쏜다. 죽인 뒤에도 방심 금지.',
    side: 'beast', lore: '원한이 굳어 돌이 되었다. 부수면 그 원한이 사방으로 튄다.' },
  { id: 'ghoul',       name: '굶주린 식시귀',         sprite: 'ghoul',       desc: '전장의 시체를 먹고 강해진다. 시체가 쌓이기 전에 잡아라.',
    side: 'dead', lore: '옥에서 굶겨 죽인 죄수. 죽은 뒤에야 마음껏 먹는다.' },
  { id: 'charger',     name: '눈먼 공성마',       sprite: 'charger',     desc: '눈가리개를 한 채 버려진 것 — 짧은 돌진을 세 번, 매번 다시 조준한다.',
    side: 'beast', lore: '성문을 들이받으라고 눈을 가린 채 길렀다. 가리개는 죽어서도 벗겨지지 않았다.' },
  { id: 'turret',      name: '버려진 쇠뇌 진지',    sprite: 'turret',      desc: '8방향 탄막을 회전시키며 쏜다. 같은 자리는 두 번 안전하지 않다.',
    side: 'crown', lore: '토벌이 끝난 뒤 그대로 두고 간 진지. 방아쇠를 당길 손만 저주로 남았다.' },
  { id: 'mimic',       name: '의태 상자',         sprite: 'mimic',       desc: '보물상자로 위장한다. 진짜 상자는 방 한가운데, 가짜는... 글쎄.',
    side: 'beast', lore: '부장품을 노린 도굴꾼이 너무 많이 죽은 자리. 상자가 그 버릇을 배웠다.' },
  { id: 'stalker',     name: '왕실 밀정', sprite: 'stalker',    desc: '사라졌다가 등 뒤에서 나타난다. 그림자가 비치면 몸을 굴려라.',
    side: 'crown', lore: '밀고장을 나르던 그림자. 얼굴을 본 자는 대개 다음 날 사라졌다.' },
  { id: 'brute',       name: '도굴 용병',         sprite: 'brute',       desc: '넓은 부채꼴로 몽둥이를 휘두른다. 품 안쪽이나 등 뒤가 안전하다.',
    side: 'crown', lore: '무덤을 파헤쳐 시체를 팔던 삯꾼. 무덤지기와 반씩 나눠 먹었다.' },
  { id: 'imp',         name: '화형장 도깨비',         sprite: 'imp',         desc: '깜빡이며 순간이동하고 화염구를 던진다. 성가심의 화신.',
    side: 'beast', lore: '화형장 잿더미에서 태어났다. 불티를 장난감으로 안다.' },
  { id: 'glutton',     name: '시체 포식자',       sprite: 'glutton',     desc: '숨을 들이쉬며 끌어당긴 뒤 깨문다. 흡입 중엔 반대로 달리거나 대시로 끊어라.',
    side: 'dead', lore: '역병 구덩이를 관리하던 인부. 끝내 자기가 관리하던 것이 되었다.' },
  // ── 2026-07 확장 24종 — 층 전용 로스터 ──
  { id: 'sporePuff',    name: '시체꽃 봉오리',     sprite: 'sporePuff',    desc: '떠다니는 봉오리 지뢰. 터지기 전에 멀리서 꺾어라.',
    side: 'beast', lore: '시체꽃이 맺은 씨. 밟히기를 기다린다.' },
  { id: 'acidSnail',    name: '녹물 갑주',   sprite: 'acidSnail',    desc: '버려진 갑옷이 저주로 긴다. 지나간 자리가 녹물로 삭는다.',
    side: 'dead', lore: '갑옷째 산 채로 묻힌 기사. 갑옷만 저주를 먹고 기어 나왔다.' },
  { id: 'jailer',       name: '늙은 간수',          sprite: 'jailer',       desc: '사슬 갈고리로 끌어당긴다. 조준선이 빛나면 궤도에서 비켜라.',
    side: 'crown', lore: '평생 열쇠를 쥐고 살았다. 사슬을 놓는 법은 배운 적이 없다.' },
  { id: 'frostMage',    name: '왕실 빙결술사',     sprite: 'frostMage',    desc: '3갈래 감속탄을 뿌리고, 다가가면 도약한다 — 두 번뿐이지만.',
    side: 'crown', lore: '도망자의 발을 얼리라고 고용된 궁정 술사. 얼음 아래에 무엇이 있는지는 묻지 않았다.' },
  { id: 'cinder',       name: '떠도는 불씨',          sprite: 'cinder',       desc: '작고 빠르다. 죽는 자리에 불길이 남으니 발밑을 조심하라.',
    side: 'dead', lore: '화형이 끝난 뒤 남은 불티. 아직 다 타지 못했다고 우긴다.' },
  { id: 'ashWalker',    name: '재의 보행자',   sprite: 'ashWalker',    desc: '걸음마다 불길을 남긴다. 오래 두면 방 전체가 타오른다.',
    side: 'dead', lore: '불타는 농가에서 걸어 나오다 굳었다. 지금도 집으로 가는 중이다.' },
  { id: 'emberMoth',    name: '화형장의 불티',        sprite: 'emberMoth',    desc: '다 꺼지지 못한 원혼의 불티 — 맴돌다 예고 후 급강하한다.',
    side: 'dead', lore: '기둥에 묶였던 자의 마지막 숨. 불빛을 보면 다시 뛰어든다.' },
  { id: 'acolyte',      name: '광신 복사',     sprite: 'acolyte',      desc: '보라 조준선이 굵어지는 순간 어둠탄이 날아온다.',
    side: 'crown', lore: '성배를 본 적도 없이 성배를 위해 사람을 태웠다. 의심이 죄라고 배웠다.' },
  { id: 'shade',        name: '목매단 그림자',        sprite: 'shade',        desc: '흐릿할 땐 벨 수 없다. 실체화 주기를 읽고 반격하라.',
    side: 'dead', lore: '교수대 밧줄이 남긴 그림자. 매달린 그 순간에 갇혀 있다.' },
  { id: 'gazer',        name: '왕의 감시구',        sprite: 'gazer',        desc: '성배의 저주가 맺힌 감시 기물 — 6방향 탄막을 두른다. 틈이 살 길이다.',
    side: 'crown', lore: '왕이 보고 싶은 것만 비추는 눈. 나머지는 기록에서 지운다.' },
  { id: 'bloodBat',     name: '피에 젖은 까마귀',     sprite: 'bloodBat',     desc: '물어뜯을 때마다 제 몸을 적신다. 방치가 곧 회복이다.',
    side: 'beast', lore: '처형대 밑에서만 자란 까마귀. 피를 마셔야 날 수 있게 되었다.' },
  { id: 'boneHeap',     name: '뼈무더기',      sprite: 'boneHeap',     desc: '쓰러뜨려도 뼈 더미가 남는다. 더미까지 부숴야 끝난다.',
    side: 'dead', lore: '누구의 것인지 셀 수 없는 뼈들. 한 무더기로 묻혔으니 한 몸으로 일어선다.' },
  { id: 'venomLasher',  name: '독초 넝쿨',        sprite: 'venomLasher',  desc: '전방 부채꼴로 채찍을 휘두른다. 맞으면 발이 굳는다.',
    side: 'beast', lore: '독을 만들려 기른 밭이 주인을 잃고 야생이 되었다.' },
  { id: 'sporeMother',  name: '시체꽃 모주',     sprite: 'sporeMother',  desc: '봉오리를 계속 피워낸다. 뿌리부터 끊는 게 순리다.',
    side: 'beast', lore: '가장 깊은 구덩이 위에 핀 꽃. 아래에 몇이 누웠는지는 꽃만 안다.' },
  { id: 'acidSlug',     name: '녹물 덩어리', sprite: 'acidSlug',     desc: '포물선 녹물 산탄. 착탄 예고 원이 보이면 그 자리를 떠나라.',
    side: 'beast', lore: '증거를 녹이던 약이 강으로 흘러 살아났다.' },
  { id: 'warden',       name: '간수장 방패병',        sprite: 'warden',       desc: '정면은 방패가 막는다. 등을 잡거나, 돌진을 흘려보내라.',
    side: 'crown', lore: '탈옥을 한 번도 허락하지 않은 것이 자랑이었다. 죽어서도 문 앞에 선다.' },
  { id: 'chainWraith',  name: '사슬 원혼',     sprite: 'chainWraith',  desc: '발밑에 사슬 올가미를 던진다. 원 밖이면 안전하다.',
    side: 'dead', lore: '사슬에 묶인 채 죽어 사슬과 함께 일어섰다. 이제는 남을 묶는다.' },
  { id: 'frostGolem',   name: '서리 골렘',     sprite: 'frostGolem',   desc: '내려찍기 충격파와 빙판. 링은 대시로 통과할 수 있다.',
    side: 'crown', lore: '얼어붙은 관문을 지키라고 세운 것. 명령을 내린 자는 이미 없다.' },
  { id: 'obsidianBeast', name: '무너진 왕의 석상',     sprite: 'obsidianBeast', desc: '왕의 석상이 저주로 움직인다 — 중장갑 돌진, 죽는 순간 파편이 튄다.',
    side: 'crown', lore: '광장마다 세운 왕의 석상. 무너진 뒤에야 사람을 덮쳤다.' },
  { id: 'flameJuggler', name: '화형 조수',   sprite: 'flameJuggler', desc: '화염탄을 저글링하듯 던진다. 착탄 원을 읽어라.',
    side: 'crown', lore: '불붙이는 일을 맡은 조수. 손이 익숙해진 뒤로는 아무렇지 않았다.' },
  { id: 'lavaBurster',  name: '화약 박격수',   sprite: 'lavaBurster',  desc: '발밑에서 간헐천이 솟는다. 예고 원에서 비켜서라.',
    side: 'crown', lore: '증거가 묻힌 땅을 통째로 날려버린 포수.' },
  { id: 'voidSpawn',    name: '원혼 조각',     sprite: 'voidSpawn',    desc: '죽는 순간 공허탄을 뱉는다. 마지막까지 방심 금물.',
    side: 'dead', lore: '너무 오래 방치된 원혼이 부서진 조각. 이름조차 남지 않았다.' },
  { id: 'riftCaster',   name: '균열 심문관',     sprite: 'riftCaster',   desc: '주위에 균열을 열고 유도탄을 쏜다. 균열부터 피하라.',
    side: 'crown', lore: '자백을 얻으려 세상에 구멍을 냈다. 구멍은 닫히지 않았다.' },
  { id: 'mirrorKnight', name: '왕실 거울기사',     sprite: 'mirrorKnight', desc: '은빛으로 빛나는 반격 자세가 끝나면 찌르기가 온다. 물러나라.',
    side: 'crown', lore: '왕의 얼굴을 대신 비추는 기사. 갑옷 안이 비어 있다는 소문이 있다.' },
  // ── 2막: 균사 정원 (11~20층) ──
  { id: 'sporeling',     name: '물에 불은 시체',     sprite: 'sporeling',     desc: '강에 버려진 처형자들이다. 죽으면 썩은 독기를 터뜨린다 — 시체 위를 걷지 마라.',
    side: 'dead', lore: '강에 버린 처형자들이 다리 밑에 걸렸다. 아무도 건지지 않았다.' },
  { id: 'fungalTick',    name: '강거머리',   sprite: 'fungalTick',    desc: '다리 밑에서 배를 채워온 것. 몸을 말았다가 튕겨 날아든다.',
    side: 'beast', lore: '다리 아래에서 배를 채워온 것. 검은 마차가 지날 때마다 살이 올랐다.' },
  { id: 'myceliumBrute', name: '관문 골렘',     sprite: 'myceliumBrute', desc: '관문을 지키던 골렘에 오물이 눌어붙었다. 내려찍은 자리가 썩는다.',
    side: 'crown', lore: '관문을 지키던 골렘에 하수가 눌어붙었다. 통행증 없는 것은 전부 막는다.' },
  { id: 'rotWalker',     name: '오물 보행자',   sprite: 'rotWalker',     desc: '하수구를 걸어온 자 — 걸음마다 땅이 썩고, 멀리서 농성하면 오물을 뱉는다.',
    side: 'dead', lore: '하수구로 시신을 나르던 인부. 끝내 그 길에서 나오지 못했다.' },
  { id: 'glowShrieker',  name: '관문 나팔수',   sprite: 'glowShrieker',  desc: '나팔로 토벌대를 가속시킨다. 나팔이 울리기 전에 목을 끊어라.',
    side: 'crown', lore: '토벌대의 진군 나팔. 이 소리를 들은 마을은 대개 남지 않았다.' },
  { id: 'boss1', boss: true, name: '무덤지기 오스문드', sprite: 'boss',      desc: '묻은 손 — 죄인 묘지의 관리인, 왕명으로 시체를 팔아왔다. 낫 연격과 뼛조각 투척, 고유기 「생매장」.',
    side: 'crown', lore: '죄인 묘지의 관리인. 왕명이라는 말 한마디에 시체를 팔았고, 내 무덤도 그가 팠다.',
    last: "…나는 파기만 했다. 넣으라 한 건 위였어." },
  { id: 'boss2', boss: true, name: "시체 짐꾼 '삯꾼 몰레'", sprite: 'bossSpore', desc: '나른 손 — 처형된 시신을 밤마다 늪에 버린 삯꾼. 부하가 살아있는 동안 상처를 감춘다. 고유기 「짐 부리기」.',
    side: 'crown', lore: '밤마다 수레를 끌었다. 무엇을 나르는지 묻지 않는 값으로 삯을 받았다.',
    last: "삯이었다… 그저 삯이었단 말이다…" },
  { id: 'boss3', boss: true, name: '간수장 바르곤',     sprite: 'bossGolem', desc: '가둔 손 — 처형 전야의 지하 감옥 간수장. 철갑이 강한 일격을 경감한다. 고유기 「철창 호송」 — 열린 틈으로 나가라.',
    side: 'crown', lore: '처형 전야의 지하 감옥을 지켰다. 물을 달라던 목소리를 기억하지 못한다.',
    last: "문은 내가 잠갔지만… 열쇠는 내 것이 아니었다." },
  { id: 'boss4', boss: true, name: "방화대장 '그을음 브란트'", sprite: 'bossIgnis', desc: '태운 손 — 장부가 있던 농가를 태워 증거를 지웠다. 시간이 지날수록 달아오른다. 고유기 「기름 붓기」.',
    side: 'crown', lore: '장부가 있던 농가를 태웠다. 사람이 안에 있다는 건 나중에 들었다고 했다.',
    last: "불은 명령이었다. 안에 사람이 있는 줄은… 알았다." },
  { id: 'boss5', boss: true, name: '교수대의 그림자',   sprite: 'bossAbyss', desc: '매단 자들의 원한 — 죄 없이 매달린 혼들이 뭉친 것. 장막 중에는 영혼 구슬만이 약점. 고유기 「올가미」.',
    side: 'dead', lore: '죄 없이 매달린 자들이 한 덩어리로 뭉쳤다. 이름을 부르면 전부 대답한다.',
    last: "우리를… 세어라. 아무도 세지 않았다." },
  { id: 'boss6', boss: true, name: '되살아난 오스문드', sprite: 'bossWraith',  desc: '네가 벤 무덤지기가 같은 저주로 깨어났다 — 죽어서야 원혼의 무기를 손에 넣었다. 고유기 「합장」.',
    side: 'crown', lore: '내가 벤 무덤지기가 같은 저주로 일어섰다. 파던 손이 이제 무기를 쥔다.',
    last: "두 번 죽였구나. 이번엔… 네 이름을 안다." },
  { id: 'boss7', boss: true, name: '물에 불은 몰레',    sprite: 'bossPlague',  desc: '늪이 짐꾼을 뱉어냈다 — 그가 버린 시체들과 함께. 맹독 간헐천과 고유기 「수레 뒤집기」.',
    side: 'crown', lore: '늪이 짐꾼을 뱉어냈다. 그가 버린 시체들을 전부 데리고.',
    last: "강은 아무것도 안 삼켰다… 전부 돌려주더군." },
  { id: 'boss8', boss: true, name: '사슬에 얽힌 바르곤', sprite: 'bossDespair', desc: '제 감옥에서 죽어 사슬과 한 몸이 됐다. 올가미가 발을 묶는다 — 고유기 「사슬 추적」, 멈추지 마라.',
    side: 'crown', lore: '제가 지키던 감옥에서 죽었다. 열쇠는 끝내 찾지 못했다.',
    last: "열쇠는… 처음부터 없었다. 나가라는 명령이 없었으니까." },
  { id: 'boss9', boss: true, name: '재가 된 브란트', sprite: 'bossInferno', desc: '제가 지른 불에 삼켜진 방화대장. 백열 간헐천 연쇄와 고유기 「불씨 비」 — 멈추는 순간 타오른다.',
    side: 'crown', lore: '제가 지른 불에 삼켜졌다. 그러고도 불이 억울하다고 말한다.',
    last: "불이… 나만은 알아볼 줄 알았는데." },
  { id: 'boss10', boss: true, name: "왕실 처형인 '무거운 손'", sprite: 'bossVoid',  desc: '탑의 진정한 정점. 세 겹의 어둠 장막과 공허 유충 — 모든 것을 건 최후의 시험.',
    side: 'crown', lore: '왕실 처형인. 목을 치는 손이 무거워 그렇게 불렸다 — 한 번도 실패하지 않았다.',
    last: "손이 무거웠다. 한 번도… 가벼운 적이 없었다." },
  { id: 'boss20', boss: true, name: "관문 사령관 '철벽 로트가르'", sprite: 'bossQueen', desc: '2막의 주인. 검은 마차를 호위해온 자 — 군의관이 살아있는 한 상처가 아문다.',
    side: 'crown', lore: '검은 마차를 관문 너머로 호위했다. 마차 안을 본 적 없다고 맹세했다.',
    last: "마차 안은… 끝내 보지 않았다. 그게 내 죄다." },
  { id: 'boss30', boss: true, name: "대재판관 '발디아 공작'", sprite: 'bossValdia', desc: '3막의 주인. 내 판결문에 서명한 자 — 판결의 법복이 강한 일격을 경감한다.',
    side: 'crown', lore: '내 판결문에 서명한 대재판관. 서명 전에 이름조차 읽지 않았다.',
    last: "판결은 내 손이 아니라 내 이름이 했다. 그게 더 나쁘지." },
  { id: 'boss40', boss: true, name: "대주교 '이노첸시오'", sprite: 'bossBishop', desc: '4막의 주인. 성배를 왕에게 바친 자 — 성역 결계 중에는 성물만이 약점이다.',
    side: 'crown', lore: '성배를 왕에게 바친 대주교. 백 년의 수명값을 사람 수로 계산했다.',
    last: "성배는 사람을 살린다… 몇을 죽였는지는 세지 않았다." },
  { id: 'boss45', boss: true, name: "근위대장 '흰 늑대'", sprite: 'bossWolf', desc: '왕좌 앞 마지막 검. 알고도 침묵한 자 — 근위 판금이 강한 일격을 경감한다.',
    side: 'crown', lore: '왕좌 앞 마지막 검. 전부 알고도 한 번도 입을 열지 않았다.',
    last: "나는 왕이 아니라 왕좌를 지켰다. 변명이 안 되는군." },
  { id: 'boss50', boss: true, name: '왕 바르텐 3세', sprite: 'bossKing', desc: '모든 것의 답. 성배로 백 년을 산 자 — 3번 모습을 바꾼다. 증거를 전부 모아 왕좌에 못박아라.',
    side: 'crown', lore: '성배로 백 년을 산 자. 그 백 년의 값을 낸 것은 전부 다른 사람이었다.',
    last: "백 년이다. 백 년을 살았는데… 왜 아무도 내 이름을 부르지 않지." },
  // 왕의 공범들 — 막별 순환 보스 (51층+ 무한 가도에서는 8인 전원이 순환한다)
  { id: 'boss60', boss: true, name: "수문장 '갈고리 브람'", sprite: 'bossBram', desc: '2막의 공범. 강을 건너려는 시체를 갈고리로 건져올린 자 — 돌진을 응징하고 방패를 파쇄한다.',
    side: 'crown', lore: '강을 건너려는 시체를 갈고리로 건져 올렸다. 도망은 죽어서도 허락되지 않았다.',
    last: "건져 올린 것들이… 전부 나를 기억하는군." },
  { id: 'boss61', boss: true, name: "뱃사공 '침묵의 요른'", sprite: 'bossJorn', desc: '2막의 공범. 검은 마차의 짐을 강 건너로 날랐다 — 나선탄과 반면 참격, 입은 끝까지 열지 않는다.',
    side: 'crown', lore: '검은 마차의 짐을 강 건너로 날랐다. 뱃삯 대신 침묵을 받았다.',
    last: "…" },
  { id: 'boss62', boss: true, name: "위증 서기장 '퀼른'", sprite: 'bossQuill', desc: '3막의 공범. 내 죄목을 받아 적은 깃펜 — 기록이 그를 지키는 동안(부하 생존) 상처가 아문다.',
    side: 'crown', lore: '내 죄목을 받아 적었다. 없는 죄를 적는 손은 떨리지 않았다.',
    last: "받아 적었을 뿐이다. 문장은 내가 만들지 않았어." },
  { id: 'boss63', boss: true, name: "사병대장 '철퇴 가로크'", sprite: 'bossGarok', desc: '3막의 공범. 재판 전에 이미 판결을 알고 있던 자 — 중갑이 강한 일격을 경감한다.',
    side: 'crown', lore: '재판이 열리기 전에 이미 판결을 알고 있었다. 형 집행 준비가 늘 빨랐다.',
    last: "판결을 먼저 안 게 죄라면… 이 나라 전부가 죄인이다." },
  { id: 'boss64', boss: true, name: "역병 의사 '코르부스'", sprite: 'bossCorvus', desc: '4막의 공범. 역병 보고서를 고쳐 쓴 새부리 — 검은 처방(부하 생존)이 그를 치료한다.',
    side: 'crown', lore: '역병 보고서를 고쳐 썼다. 죽은 수를 줄이면 죽지 않은 것이 된다고 믿었다.',
    last: "숫자를 줄였다. 사람은 줄지 않았지만." },
  { id: 'boss65', boss: true, name: "소각로장 '재의 우르쉬'", sprite: 'bossUrsh', desc: '4막의 공범. 증거와 시체를 함께 태운 자 — 소각로의 열기로 시간이 지날수록 백열한다.',
    side: 'crown', lore: '증거와 시체를 같은 아궁이에 넣었다. 재는 아무것도 증언하지 못한다.',
    last: "재는 증언하지 않는다… 그런데 왜 네가 여기 있지." },
  { id: 'boss66', boss: true, name: "왕실 마법장 '별지기 오벨'", sprite: 'bossObel', desc: '5막의 공범. 별을 읽고도 입을 다문 자 — 성좌 장막이 도는 동안 구슬만이 약점이다.',
    side: 'crown', lore: '별에서 왕의 최후를 읽고도 입을 다물었다. 그 대가로 탑 하나를 받았다.',
    last: "별에 다 적혀 있었다. 네가 온다는 것도." },
  { id: 'boss67', boss: true, name: '무언의 기수', sprite: 'bossLancer', desc: '5막의 공범. 이름도 얼굴도 기록에 없는 왕의 창 — 세 번째 창격이 심장을 노린다.',
    side: 'crown', lore: '이름도 얼굴도 기록에 없다. 왕의 창은 기록될 필요가 없었다.',
    last: "…이름을, 물어봐 주는군." },
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
  { id: 'greed',  name: '수확', desc: '한(恨) 조각 획득 +15%',     max: 3, costs: [60, 130, 260] },
  { id: 'reroll', name: '환생', desc: '레벨업 카드 다시 뽑기 +1회/런 (E)', max: 3, costs: [150, 300, 500] },
  { id: 'legacy', name: '유산', desc: '런 시작 시 커먼 유물 3택1',  max: 1, costs: [400] },
];

// ── 깨어진 비석 — 왕좌를 정복한 자에게만 열리는 상위 열 (파편 싱크의 꼬리 연장) ──
const BROKEN_STONES = [
  { id: 'b_gold',  name: '노획의 눈',   desc: '시작 골드 +80',                          max: 2, costs: [400, 800] },
  { id: 'b_heir',  name: '유품의 부름', desc: '유물 카드에 유품 등장 가중 (단계당 2배)', max: 2, costs: [500, 1000] },
  { id: 'b_feast', name: '전승의 포식', desc: '우두머리 처치 시 하트 1 회복',            max: 1, costs: [800] },
  { id: 'b_mod',   name: '세공의 기억', desc: '런 시작 시 스킬 개조 1개를 지니고 부활',  max: 1, costs: [900] },
  { id: 'b_brand', name: '낙인 무딤',   desc: '왕의 낙인 지속 5초 → 3초',                max: 1, costs: [1200] },
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
      opts: null, // 설정 {bgm,sfx,shake,dmgNum,flash} — null이면 load()에서 기본값 채움
      fifthHand: null, // 「다섯 번째 손」 자각 단계 {stage: 0 미자각/1 시선/2 존재/3 진실} — load()에서 채움
      epilogueSeen: false, // 정복 에필로그는 한 번만 — 반복 정복 시 생략
      codex: { kills: {}, relics: {}, traits: {} }, // 도감 기록
      welcomed: false, // 환영 파편 지급 여부
    };
  },

  // 설정 기본값 — 저장본에 없는 키만 채운다 (구버전 세이브 호환)
  _defaultOpts() {
    return { bgm: 0.8, sfx: 0.8, shake: 1, dmgNum: 1, flash: 1, gore: 1, grace: 0 }; // gore: 3단 / grace(망자의 가호): 0 끔 / 0.5 가호 / 1 비호
  },

  load() {
    try {
      const raw = Store.get('dungeoncrawler_meta');
      this.data = raw ? { ...this._default(), ...JSON.parse(raw) } : this._default();
    } catch (e) {
      this.data = this._default();
    }
    this.data.opts = { ...this._defaultOpts(), ...(this.data.opts || {}) };
    this.data.forms = this.data.forms || {}; // 계승 선택 {classId: 0(기본)|1|2}
    this.data.fifthHand = { stage: 0, ...(this.data.fifthHand || {}) };
    // 환영 선물: 처음부터 다른 직업을 해금해 볼 수 있도록 파편 지급 (1회)
    if (!this.data.welcomed) {
      this.data.welcomed = true;
      this.data.shards += 800;
      this.save();
    }
  },

  save() {
    try {
      Store.set('dungeoncrawler_meta', JSON.stringify(this.data));
    } catch (e) { /* 시크릿 모드 등 저장 불가 환경 무시 */ }
  },

  lvl(id) {
    return this.data.up[id] || 0;
  },

  upgradeDef(id) {
    return META_UPGRADES.find((u) => u.id === id) || BROKEN_STONES.find((u) => u.id === id);
  },

  // 깨어진 비석 해금 — 왕좌 정복의 증표
  brokenUnlocked() {
    return this.data.epilogueSeen || this.data.bestFloor >= 50;
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

  // ── 사연 조회 (v187) ──
  // 적 종류(또는 보스 defId)로 도감 항목을 찾는다. 플레이 중 첫 조우 표출과 보스 카드가 쓴다.
  // 캐시하지 않으면 방마다 89종을 선형 탐색하게 된다 — 스폰은 초당 여러 번 일어난다
  codexOf(type) {
    if (!this._codexMap) {
      this._codexMap = {};
      for (const e of CODEX_ENEMIES) this._codexMap[e.id] = e;
    }
    return this._codexMap[type] || null;
  },

  // 진영 표기 — 사연의 뼈대다. 이 나라에서 죽은 자와, 죽인 자와, 그 사이에 낀 것들
  sideLabel(side) {
    return side === 'crown' ? '왕의 손' : side === 'beast' ? '짐승과 기물' : '억울한 죽음';
  },
  sideColor(side) {
    return side === 'crown' ? '#e43b44' : side === 'beast' ? '#8a8074' : '#5ce0e6';
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
      // v162: 배너는 걷어낸다. v160부터 정산 화면이 해금을 직접 그리는데, 배너는 그 아래
      // 전투 HUD 층에 **정산 그림을 가로지르며** 남았다 (해금이 여러 개면 화면 폭을 넘겨
      // 「전사했다」 위를 덮었다). 소리만 남긴다 — 알림은 정산 화면 몫이다
      if (typeof AudioSys !== 'undefined') AudioSys.buy();
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
    if (this.data.heat >= HEAT_PACTS.length + 1) return HEAT_PACTS.length + 1; // 왕의 진노
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
    // 8단계 = 왕의 진노: 전 서약 + 전역 강화 (풀업·최상급 기준 통과선 — 계측 기반)
    const n = Math.min(HEAT_PACTS.length + 1, Math.max(0, h));
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
    if (count >= HEAT_PACTS.length + 1) {
      HEAT_PACTS.forEach((p) => { out[p.id] = true; });
      out.wrath = true; // 왕의 진노: 전역 강화
    } else if (stored === count) {
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
    this.data.bestFloor = Math.max(this.data.bestFloor, victory ? 10 : floor);
    // v160: 해금 알림을 정산 화면이 직접 그린다.
    // 종전에는 setTimeout으로 Game.banner만 세웠는데, 배너는 전투 화면에서만 그려지고
    // 감쇠한다. 즉 런이 끝나 정산 화면에 있는 그 순간, 해금 소식은 화면에 오르지도 못하고
    // 사라졌다. 「해금했다」는 다음 런을 시작할 이유 그 자체인데 아무도 못 봤다.
    const fresh = this.checkUnlocks();
    if (typeof Game !== 'undefined') Game._freshUnlocks = fresh.length ? fresh : null;
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

  // 일일 수배령 연속 도전 일수 (v132) — 오늘 미도전이면 어제까지의 연속을 '이어지는 중'으로 인정
  _dayKey(d) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); },
  dailyStreak() {
    const log = this.data.dailyLog || [];
    if (!log.length) return 0;
    const keys = new Set(log.map((l) => l.key));
    const d = new Date();
    if (!keys.has(this._dayKey(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (keys.has(this._dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  },

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
