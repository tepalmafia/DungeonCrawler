// 게임 루프 + 던전 진행 + 전투 판정 허브.
// 상태: hub | altar | classes | play | levelup | relic | transition | over | victory
// 빌드 버전 (v156~): 리포트·거점에 찍어 "지금 무슨 버전을 돌리고 있나"를 눈으로 확인 가능하게.
// 캐시된 구버전에서 뛴 판을 밸런스 근거로 삼는 오판을 막는다. 릴리즈마다 index.html ?v=N과 함께 올린다
const GAME_VERSION = 200;

// v192 — 사장: "기존처럼 동그라미를 날리는 공격만 가지지말고,
//                동그라미는 불꽃이나 기타 보스가 쓰는 무기 공격으로 디자인해주고"
// 실측이 지적을 그대로 확인했다: render-game.js 의 적 투사체 렌더는 화살(sprite:true)을 빼면
// **ctx.arc() 원 하나 + 뒤에 작은 원 하나**가 전부였다. 색만 다른 동그라미 11종.
// shape 를 주면 그 kind 는 전용 렌더를 탄다 — 무엇에 맞았는지가 화면에 남는다.
//   bone  뼛조각: 회전하는 뼈 마디 (무덤지기가 던지는 것)
//   flame 불꽃: 흔들리는 불길 혓바닥 + 잔불
const PROJ_STYLES = {
  arrow: { color: '#a99e8c', sprite: true },
  soul:  { color: '#b13ae0', r: 7, wavy: true, shape: 'wisp' },
  spore: { color: '#7ab04c', r: 6, shape: 'blob' },
  fire:  { color: '#ff7043', r: 6, patchOnEnd: true, shape: 'flame' },
  rock:  { color: '#cfc6ad', r: 6, shape: 'bone' },
  web:   { color: '#e8e0cf', r: 5 },
  thorn: { color: '#8fbf5a', r: 5, shape: 'shard' },
  voidorb: { color: '#b13ae0', r: 8, wavy: false },
  ice:   { color: '#a9e3ff', r: 5, shape: 'shard' },
  shard: { color: '#c9b8e8', r: 4 },
  mana:  { color: '#b89ae8', r: 5 },
};

const Game = {
  state: 'hub',
  player: null,
  enemies: [],
  arrows: [],
  pbolts: [],       // 플레이어 투사체 (궁수 화살 / 마도사 마탄)
  rains: [],        // 궁수 스킬: 화살비
  meteors: [],      // 마도사 스킬: 메테오
  pickups: [],
  orbs: [],
  zones: [],        // 적에게 피해 주는 장판 (감전/독구름)
  firePatches: [],  // 플레이어에게 피해 주는 장판 (불길/독)
  rings: [],        // 확장 충격파 링
  markers: [],
  pendingSpawns: [],
  interactables: [],
  bossSlashes: [],
  corpses: [],      // 사망 연출 (무너져 내리는 잔상)
  gibs: [],         // 죽음의 흔적 (v126): 절단 조각 — 멈추면 바닥에 구워진다
  kills: 0,
  time: 0,
  hitstop: 0,
  banner: null,
  vignette: 0,
  critFlash: 0,  // 크리티컬 순간 화면 백색 섬광
  hurtFlash: 0,  // 피격 순간 화면 적색 섬광
  overLockT: 0,  // 사망/승리 화면 진입 직후 입력 잠금 (오클릭 방지)
  blinkT: 0,

  xp: 0,
  level: 1,
  xpNext: 36,
  pendingChoices: 0,
  traitCards: [],
  relicCards: [],
  choiceReason: 'levelup',
  bossRewardT: 0,

  roomCleared: false,
  transition: null,
  codexTab: 0, // 도감 탭 (0 몬스터 / 1 유물 / 2 특성 / 3 증거)
  codexPage: 0,
  codexSel: 0, // 도감 커서 (v187) — 호버 없는 기기에서 사연을 여는 유일한 수단
  testMode: false, // 테스트 모드 (거점에서 T, 또는 ?test=1)
  showInventory: false, // 획득 목록 (Tab)
  choiceLockT: 0,   // 카드 UI 오클릭 방지 잠금 시간
  gaveUp: false,    // 런 포기 여부 (정산 화면 문구)

  // 런 정산
  runEnded: false,
  shardsEarned: 0,
  shardAnimT: 0,
  runSeed: 0,
  heat: 0,
  paused: false,

  // ── 플레이 리포트 (v144): 실플레이가 곧 계측 — 거점 F9로 복사해 붙여넣으면 밸런스 조정에 쓴다 ──
  copyPlayReport() {
    // v147: 봇 런만 제외 — 테스트모드 수동 런(B 보스 직행 등)은 '치트' 라벨로 포함한다.
    // 사장의 주력 테스트 동선이 테스트모드라, 전부 거르면 리포트가 텅 빈다 (실플레이 제보)
    const raw = Meta.data.playLog || [];
    const log = raw.filter((r) => !r.bot);
    const botDropped = raw.length - log.length;
    // v155 (사장 제보 "1단계로 테스트했는데 왜 기록이 없지?"): 기록이 비는 경로가 둘 있는데 둘 다
    // 침묵했다 — ① 일시정지 「저장하고 거점」은 런이 끝난 게 아니라 기록되지 않는다 ② 봇 모드(V)로
    // 돌린 런은 계측 오염 방지로 리포트에서 제외된다. 이유를 화면이 직접 말하게 한다
    if (!log.length) {
      const msg = botDropped > 0
        ? `봇 런 ${botDropped}건뿐 — 리포트에서 제외된다 (테스트모드 V로 봇을 끄고 직접 한 판)`
        : this.loadRunSave()
          ? '진행 중인 런은 아직 기록 전 — 승리·사망·포기로 끝나야 남는다 (「저장하고 거점」은 기록 아님)'
          : '기록이 아직 없다 — 한 판 다녀오면 쌓인다';
      this.banner = { text: msg, life: 3.4, maxLife: 3.4, color: '#9aa0b4' };
      console.log('[플레이 리포트] ' + msg);
      return;
    }
    const wins = log.filter((r) => r.win).length;
    const best = Math.max(...log.map((r) => r.floor));
    const deathFloors = {}, causes = {}, bossLines = {};
    let hurts = 0;
    for (const r of log) {
      hurts += r.hurts || 0;
      if (!r.win && !r.quit && !r.cheat) { // 사망 통계는 정상 런만 — 포기·치트는 오염원
        deathFloors[r.floor] = (deathFloors[r.floor] || 0) + 1;
        if (r.deathBy) causes[r.deathBy] = (causes[r.deathBy] || 0) + 1;
      }
      for (const b of r.bosses || []) (bossLines[b.f] = bossLines[b.f] || []).push(b.t + 's' + (r.cheat ? 'c' : ''));
    }
    // v148: 이중 정산(무한 진입 런) 잔재 중복 제거 — 같은 층·같은 초는 한 번만
    for (const f in bossLines) bossLines[f] = [...new Set(bossLines[f])];
    const top = (o, suf) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([k, v]) => `${k}${suf}×${v}`).join('  ') || '없음';
    const text = [
      `[무덤에서 왕좌까지 — 플레이 리포트] 런 ${log.length} · 승리 ${wins} · 최고 ${best}층` +
        (botDropped > 0 ? ` (봇 런 ${botDropped}건 제외)` : ''),
      `사망 층 분포: ${top(deathFloors, '층')}`,
      `사망 원인 TOP: ${top(causes, '')}`,
      `보스 처치 (층: 소요, c=치트런): ${Object.entries(bossLines).sort((a, b) => a[0] - b[0])
        .map(([f, ts]) => `${f}층 ${ts.join('/')}`).join(' · ') || '없음'}`,
      `런당 피격 평균: ${(hurts / log.length).toFixed(1)}`,
      `── 최근 런 (최신이 맨 아래 · 현재 빌드 v${typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '?'}) ──`,
      // v156: 시각·버전 표기 — 같은 문구의 런이 줄줄이라 '방금 것'을 못 찾던 문제 해소.
      // 버전이 현재와 다르면 그 판은 캐시된 구버전에서 뛴 것 → 밸런스 근거에서 빼야 한다
      ...log.slice(-6).map((r, i, arr) => {
        const ago = r.ts ? (() => {
          const m = Math.floor((Date.now() - r.ts) / 60000);
          return m < 1 ? '방금' : m < 60 ? `${m}분 전` : `${Math.floor(m / 60)}시간 전`;
        })() : '시각?';
        const verTag = r.ver ? `v${r.ver}` : 'v?';
        const newest = i === arr.length - 1 ? '  ◀ 방금 이 판' : '';
        // v160: 빌드 스냅샷 표기 — 같은 층·같은 사망이어도 HP6/공1 몸과 HP9/공3 몸은 다른 게임이다.
        // 이게 없으면 리포트로 난이도를 판정할 수 없다 (계측 오염의 마지막 구멍)
        // v173: 공은 **빌드 화력**(조건 다 끈 값). 임종 시점 실효 화력이 더 높았으면 괄호로 함께 보인다 —
        // 그 차이가 곧 "상태 보너스로 버틴 판"이라는 뜻이다 (열기·잔여HP·골드·처치중첩)
        const nowTag = r.atkNow != null && r.atkNow > r.atk ? `(임종 ${r.atkNow})` : '';
        const build = r.mhp ? ` · HP${r.mhp}/공${r.atk}${nowTag}/특${r.tr}/유${r.rel}` : '';
        return `[${ago} · ${verTag}] ${r.cls} · ${r.floor}층 Lv${r.lv} · ${r.quit ? '포기' : r.win ? '승리' : '사망(' + (r.deathBy || '?') + ')'} · ${r.min}분 · 피격 ${r.hurts}${build}` +
          (r.alt && /[1-9]/.test(r.alt) ? ` · 제단${r.alt}` : '') +
          (r.heat ? ` · 현상금${r.heat}` : '') + (r.cheat ? ' · 치트' : '') + newest;
      }),
    ].join('\n');
    console.log(text);
    this.banner = { text: '📋 플레이 리포트 복사됨 — 그대로 붙여넣어 주세요', life: 2.6, maxLife: 2.6, color: '#2ec4b6' };
    const fail = () => { this.banner = { text: '클립보드 복사 실패 — F12 콘솔에 리포트가 있다', life: 3.2, maxLife: 3.2, color: '#f7b32b' }; };
    try {
      navigator.clipboard.writeText(text).catch(fail); // 비 https·권한 거부 환경 — 콘솔 안내로 전환
    } catch (e) { fail(); }
    AudioSys.pickup();
  },

  // 반응 학습 (완성도 점검 ②): 각 교차 반응의 첫 발동 순간에 1회 설명 —
  // 계측 결과 반응이 30분에 7회뿐(과부하 0회) = 시스템이 묻혀 있었다. 발견을 가르쳐야 쓴다
  teachReaction(id, text) {
    if (!Meta.data.rxSeen) Meta.data.rxSeen = {};
    if (Meta.data.rxSeen[id]) return;
    Meta.data.rxSeen[id] = true;
    Meta.save();
    this.banner = { text: '✦ 반응 발견! ' + text, life: 3.2, maxLife: 3.2, color: '#ffd866' };
  },

  // ── 런 중단 저장 (완성도 점검 ①): 방 입장마다 스냅샷 — 브라우저를 닫아도 이어서 ──
  // 특성/유물은 id 목록을 재적용해 복원하고, 스칼라(HP·골드·XP)는 그대로 덮어쓴다.
  saveRun() {
    if (this.testMode && !this._forceSave) return; // 봇 계측 오염 방지
    if (this.runEnded || Dungeon.floor > 50 || this.endless || this.bossRush) return; // 무한 모드·보스 러시는 저장 없음
    const p = this.player;
    try {
      Store.set('dungeoncrawler_run', JSON.stringify({
        v: 1, cls: p.classId, heat: this.heat, pacts: this.pacts,
        act: this.act || 1, sp: this.shardsPaid || 0, kp: this.killsPaid || 0, route: this.route || null,
        floor: Dungeon.floor, roomIndex: Dungeon.roomIndex, roomType: Dungeon.roomType,
        seed: this.runSeed, rseed: Dungeon.roomSeed || 0, // v163: 이어하기 방 리롤 봉쇄
        nr: this.state === 'route' ? 1 : 0, // v163: 막 경계 — 이어하기에서 진군로를 다시 펼친다
        took: {
          t: Dungeon.tookTreasure, c: Dungeon.tookCamp, e: Dungeon.tookEvent,
          s: Dungeon.tookSiege, m: Dungeon.tookMerchant, tr: Dungeon.trialSeen,
        },
        level: this.level, xp: this.xp, xpNext: this.xpNext, kills: this.kills,
        time: this.time, gold: this.gold,
        traits: [...p.traits], relics: [...p.relics],
        hp: p.hp, maxHp: p.maxHp, bonusAtk: p.bonusAtk, rerolls: p.rerolls || 0,
        sub: p.subSkill || null, ultKind: p.ultKind || null, shrineSeen: this._shrineSeen || 0, skillMod: p.skillMod || null, modSeen: this._modSeen || 0,
        ult: p.ult || 0, ultG: p.ultGauge || 0,
        floorAtk: p.floorAtk || 0, reviveUsed: !!p.reviveUsed,
      }));
      this._saveFlashT = 1.4; // 자동 저장 표시 (v141) — '저장이 없다'는 오해 해소
    } catch (e) { /* 저장 실패는 게임을 막지 않는다 */ }
  },

  loadRunSave() {
    try {
      const raw = Store.get('dungeoncrawler_run');
      const s = raw ? JSON.parse(raw) : null;
      return s && s.v === 1 ? s : null;
    } catch (e) { return null; }
  },

  clearRunSave() {
    try { Store.remove('dungeoncrawler_run'); } catch (e) {}
  },

  resumeRun() {
    const s = this.loadRunSave();
    if (!s) return false;
    Meta.data.cls = s.cls;
    this.restart(s.seed != null ? s.seed : undefined); // v163: 런 시드까지 복원 (시드 런도 이어진다)
    // 버그 수정: 유산 각인(시작 유물 3택1)이 이어하기마다 다시 열리던 문제 —
    // 시작 보상은 원래 런에서 이미 받았다. restart가 연 선택창을 닫는다
    this.relicCards = [];
    this._relicSource = null;
    this.state = 'play';
    // 열기 서약·진행도 복원
    this.heat = s.heat;
    this.pacts = s.pacts || Meta.pactFlags(s.heat);
    this.route = s.route || null; // 진군로 복원 — 이어하기에서 다시 묻지 않는다
    this.player.skillMod = s.skillMod || null;
    this._modSeen = s.modSeen || 0;
    this.level = s.level; this.xp = s.xp; this.xpNext = s.xpNext;
    this.kills = s.kills; this.time = s.time; this.gold = s.gold;
    // 2막 진행 복원 — 정산 이중 지급 방지 장부까지
    this.act = s.act || (s.act2 ? 2 : 1); this.shardsPaid = s.sp || 0; this.killsPaid = s.kp || 0;
    const p = this.player;
    p.traits = []; p.relics = [];
    for (const id of s.traits) { const t = TRAITS.find((x) => x.id === id); if (t) applyTrait(p, t); }
    for (const id of s.relics) { const r = RELICS.find((x) => x.id === id); if (r) applyRelic(p, r); }
    // 스칼라는 저장값이 진실 (기연·제단·상점의 흔적 포함)
    p.maxHp = s.maxHp; p.hp = s.hp; p.bonusAtk = s.bonusAtk;
    p.rerolls = s.rerolls; p.floorAtk = s.floorAtk; p.reviveUsed = s.reviveUsed;
    p.subSkill = s.sub || null; p.ultKind = s.ultKind || null; this._shrineSeen = s.shrineSeen || 0;
    p.ult = s.ult || 0; p.ultGauge = s.ultG || 0;
    this.sects = {}; this.checkSects(true); // 계열 (v137): 복원분 무연출 동기화
    Dungeon.floor = s.floor; Dungeon.roomIndex = s.roomIndex;
    Dungeon.tookTreasure = s.took.t; Dungeon.tookCamp = s.took.c; Dungeon.tookEvent = s.took.e;
    Dungeon.tookSiege = s.took.s; Dungeon.tookMerchant = s.took.m; Dungeon.trialSeen = s.took.tr;
    // v163: 나올 때의 방 씨앗 그대로 다시 짓는다 — 이어하기가 리롤 버튼이 되지 않게
    if (s.rseed) Dungeon._forceSeed = s.rseed;
    Dungeon.build(s.roomType);
    this.banner = { text: '이어서 도전한다 — ' + s.floor + '층', life: 2.0, maxLife: 2.0, color: '#2ec4b6' };
    // v163: 막 경계에서 저장했다면 진군로를 고르는 그 화면부터 다시 시작한다.
    // 이게 없으면 지난 막의 진군로를 그대로 달고 새 막을 걷게 된다
    if (s.nr) this.openRouteChoice();
    return true;
  },

  restart(seed) {
    // 시드 런: 같은 시드 + 같은 선택 = 같은 던전 (기획안 §8.1)
    if (seed == null && this._urlSeed != null) {
      seed = this._urlSeed;
      this._urlSeed = null; // URL 시드는 첫 런에만 적용
    }
    this.runSeed = seed != null ? seed : Math.floor(Math.random() * 36 ** 6);
    RNG.seed(this.runSeed);
    this.heat = Meta.heat();
    this.pacts = Meta.pactFlags(this.heat); // 열기 서약 스냅샷 (골라담기)
    // v153 (열기 스텔스 버그 후속): 현상금이 걸린 출정은 첫 화면에서 단계를 명시 —
    // "고른 적 없는 난이도"가 몰래 적용되는 일이 다시는 없게
    if (this.heat > 0) {
      this._heatNotice = { text: `☠ 현상금 ${this.heat}단계 — 왕국이 너를 노린다 (거점 우측 상단 [−][+]로 조절)`, color: '#e43b44' };
    }
    this._freshUnlocks = null; // 지난 런의 해금 소식은 정산 화면과 함께 접는다 (v160)
    this._metRun = {}; this._meetQ = []; this._meet = null; // 첫 조우 사연 (v187) — 런마다 다시 만난다
    this.gold = 0; // 런 화폐 — 무덤까지 못 가져간다 (상인에게만 쓴다)
    this.player = createPlayer(0, 0, Meta.data.cls);
    this.player.rerolls = Meta.lvl('reroll'); // 환생 각인: 런당 카드 리롤 횟수
    // ── 깨어진 비석 (정복 후 상위 열) ──
    this.gold += Meta.lvl('b_gold') * 80; // 노획의 눈
    if (Meta.lvl('b_mod') > 0) { // 세공의 기억: 스킬 개조 1개를 지니고 부활
      const mods = SKILL_MODS[this.player.classId] || [];
      if (mods.length) this.player.skillMod = mods[Math.floor(Math.random() * mods.length)].id;
    }
    if (this.pacts.boss) {
      this.player.maxHp = Math.max(1, this.player.maxHp - 1);
      this.player.hp = this.player.maxHp;
    }
    this.paused = false;
    this.showInventory = false;
    this.gaveUp = false;
    this.runEnded = false;
    this.dailyRun = false; // 오늘의 탑은 startDaily()로만 (R 재도전은 일반 런)
    this.bossRush = false; // 보스 러시는 startBossRush()로만
    this.deathInfo = null;
    this._camp = null; // 모닥불 대화 — 다음 거점 방문 때 새 대화
    this._runHurts = 0; this._runBossLog = []; // 플레이 리포트 (v144) 런 집계 리셋
    this._graceRevived = false; // 망자의 가호 (v145) — 런당 1회
    // 온보딩 (v139): 생애 첫 런만 — 걷기→베기→대시 순서로 몸을 깨운다
    this._obHints = Meta.data.runs === 0 && Meta.data.wins === 0;
    this._obMoved = false; this._obAtk = false; this._obDash = false;
    this._lastHurtBy = null;
    this.slowmoT = 0; // 완벽 회피 슬로모
    this._roomMod = null;
    this.endless = false;
    this.act = 1;
    this.route = null;
    this.routeCards = [];
    this._shrineSeen = 0;
    this._subChoice = false;
    this.shardsPaid = 0;
    this.killsPaid = 0;
    this.shardsEarned = 0;
    this.shardAnimT = 0;
    this.kills = 0;
    this.time = 0;
    this.hitstop = 0;
    this.banner = null;
    this.vignette = 0;
    this.critFlash = 0;
    this.hurtFlash = 0;
    this.xp = 0;
    this.level = 1;
    this.xpNext = 46; // 40→46 (v147): 보상 인플레 절제 — 1막 종료 기대 Lv.18→16, 특성 2장 감소
    this.pendingChoices = 0;
    this.traitCards = [];
    this.relicCards = [];
    this.bossRewardT = 0;
    Particles.clear();
    this.state = 'play';
    Dungeon.newRun();

    // 오프닝 (v120 스토리 1차): 첫 런은 인터랙티브 프롤로그(무덤에서 깨어남 → 내 비석 대면),
    // 이후엔 한 줄만. 황금률: 1회차 풀 연출, 재회차 축약 — 반복 회차의 페이스를 지킨다
    {
      const cls = CLASSES[Meta.data.cls] || CLASSES.knight;
      if (!Meta.data.introSeen && !this.bossRush && !this.dailyRun) {
        this._pro = { step: 0, t: 0 };
        this.state = 'prologue';
        return; // 진군 지도는 프롤로그가 끝난 뒤 열린다
      } else if (!this.bossRush && !this.dailyRun) {
        this._storyQ = [{ text: `${cls.name} — 흙을 털고 다시 일어선다. 왕좌는 아직 멀다.`, color: '#9a9488' }];
      }
    }

    // 진군로: 1막 진군 지도 — 오프닝 자막과 함께 열린다
    this._openRunStart();
  },

  // ── 런 시작 관문 (v164) ── 「유산」 각인의 시작 유물 → 그 다음 진군로.
  // 결함 둘을 한꺼번에 고친다:
  //  ① **각인이 사실상 한 번도 발동하지 않았다** — 발동부가 `_endPrologue()`에만 있었는데
  //     프롤로그는 생애 첫 런에서만 돈다. 「유산」은 400 파편짜리 후반 구매물이라
  //     플레이어가 그것을 사는 시점엔 프롤로그가 끝난 지 한참이다. 즉 사고 나서
  //     **아무 일도 일어나지 않는 각인**이었다
  //  ② 그 유일한 발동 경로에서도 유물 선택 화면이 `openRouteChoice()`가 세운 'route'를
  //     덮어썼고, 유물을 고르면 pickRelic이 'play'로 보내버려 **진군로가 통째로 사라졌다**
  // → 두 경로(프롤로그 종료·일반 출정)가 모두 지나는 한 자리로 모으고, 순서를 유물 → 진군로로 고정
  _openRunStart() {
    if (Meta.lvl('legacy') > 0) {
      const pool = RELICS.filter((r) => r.rarity === 'common');
      const picks = [];
      while (picks.length < 3 && pool.length > 0) {
        picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      }
      if (picks.length > 0) {
        this.relicCards = picks;
        this._relicSource = 'legacy'; // 보스 보상 흐름(다음 층 문)을 타지 않는다
        this.state = 'relic';
        this.choiceLockT = 0.4;
        return; // 진군로는 pickRelic이 이어서 연다
      }
    }
    this.openRouteChoice();
  },

  // 프롤로그 종료 — 어느 지점에서 끝나든(완주/Esc) 같은 자리로 착지한다
  _endPrologue() {
    Meta.data.introSeen = true;
    Meta.save();
    this._pro = null;
    const cls = CLASSES[Meta.data.cls] || CLASSES.knight;
    this._storyQ = [
      { text: `"${cls.grudge}"`, color: '#c8c0a8' },
      { text: '기억은 온전하다. 이유만 모른다 — 단서를 모아, 왕좌로.', color: '#8a1c2c' },
    ];
    this.state = 'play';
    this._openRunStart();
  },

  onRoomBuilt(type) {
    // 층 첫 방: 담금질(층 한정 공격력) 만료
    if (Dungeon.roomIndex === 1 && this.player) this.player.floorAtk = 0;
    // ── 정상 진행 기준선 자가 계측 (v165) ──────────────────────────────
    // 치트 스케일링 곡선을 다섯 번 손으로 재교정했고 다섯 번 다 틀렸다
    // (v151·v153·v155·v158, 그리고 이번 v165). 손으로 박은 상수는 게임이 바뀌면 즉시 낡는다.
    // → 이제 게임이 **자기 자신을 계측한다**: 치트·봇이 아닌 진짜 런이 층에 들어설 때마다
    //   그 시점 빌드를 지수평균으로 눌러 담고, 치트 도구는 그 값을 기준으로 삼는다
    if (Dungeon.roomIndex === 1 && this.player && !this.testMode &&
        !(typeof Bot !== 'undefined' && Bot.enabled) && Dungeon.floor <= 50) {
      const p = this.player;
      // 직업별로 나눠 담는다 — 실측 3층 공격력이 기사 6 vs 궁수 2로 3배 차이라
      // 직업을 뭉뚱그리면 도구가 다시 어긋난다
      Meta.data.normRef = Meta.data.normRef || {};
      const bag = (Meta.data.normRef[p.classId] = Meta.data.normRef[p.classId] || {});
      // v173: 기준선도 **빌드 화력**으로 잰다. 층 입구라 임종 보너스는 없지만 지속 항목
      // (검은 초=열기×0.5 · 차용증=골드/60 · 관의 못=잃은 HP)은 그대로 섞였다 —
      // 실측: 깨끗할 때 1이 지속 항목만 붙으면 **12.2**. v165에서 "게임이 자기를 계측하게" 만든
      // 그 기준선 자체가 오염돼 있었고, 치트 곡선이 그 위에 서 있었다
      const cur = { lv: this.level, hp: p.maxHp, atk: +p.buildAtk().toFixed(1), tr: p.traits.length, rel: p.relics.length };
      const prev = bag[Dungeon.floor];
      if (!prev) bag[Dungeon.floor] = { ...cur, n: 1 };
      else {
        const w = Math.min(0.5, 1 / (prev.n + 1)); // 표본이 쌓일수록 천천히 움직인다
        const mix = (a, b) => +(a + (b - a) * w).toFixed(1);
        bag[Dungeon.floor] = {
          lv: mix(prev.lv == null ? cur.lv : prev.lv, cur.lv),
          hp: mix(prev.hp, cur.hp), atk: mix(prev.atk, cur.atk),
          tr: mix(prev.tr, cur.tr), rel: mix(prev.rel, cur.rel),
          n: prev.n + 1,
        };
      }
      Meta.save();
    }
    if (this.player && this.player.flags.firststrike) this.player._fsReady = true; // 선제일격 (v151): 방마다 재장전
    // 왕의 유산 (v151 전설): 새 층 진입마다 무작위 스탯 특성 자동 획득
    if (Dungeon.roomIndex === 1 && this.player && this.player.flags.kingsoath) {
      const p = this.player;
      const countOf = (id) => p.traits.filter((x) => x === id).length;
      const pool = TRAITS.filter((t) => t.tag === '스탯' && t.apply && Meta.isUnlocked(t) &&
        (!t.flag || !p.flags[t.flag]) && (!t.max || countOf(t.id) < t.max || p.flags.unbound));
      if (pool.length) {
        const t = pool[Math.floor(Math.random() * pool.length)];
        applyTrait(p, t);
        Particles.text(p.x, p.y - 44, `왕의 유산 — ${t.name}`, { color: '#ffd866', size: 13 });
        AudioSys.pickup();
      }
    }
    this._roomHearts = 0; // 방당 하트 소프트캡 카운터 리셋
    this.enemies = [];
    this.arrows = [];
    this.pbolts = [];
    this.rains = [];
    this.meteors = [];
    this.orbs = [];
    this.zones = [];
    this.firePatches = [];
    this.rings = [];
    this.markers = [];
    this.pendingSpawns = [];
    this.interactables = [];
    this.bossSlashes = [];
    this.corpses = [];
    this.gibs = [];
    this.sects = {}; this.checkSects(true); // 계열 (v137): 새 런 리셋 (형상 포함 재집계)
    this.roomCleared = false;
    Particles.clear();

    const start = World.playerStart();
    this.player.x = start.x;
    this.player.y = start.y;
    this.player.kbx = this.player.kby = 0;

    const depth = Dungeon.roomIndex;
    const floorScale = this.floorHpScale();

    // 방 템플릿 오브젝트 (M2·M3): 항아리·균열 벽 — 방 클리어 판정에서 제외되는 중립 개체
    // 일반 항아리의 18%는 폭발 항아리 — 잘 터뜨리면 무기, 잘못 터뜨리면 부상 (환경 무기)
    for (const s of (World.potSpots || [])) this.enemies.push(createPot(s.x, s.y, s.rare, !s.rare && RNG.chance(0.18)));
    for (const s of (World.crackSpots || [])) this.enemies.push(createCrack(s.tx, s.ty, s.x, s.y));
    if (World.goldCrackSpot) {
      const g = World.goldCrackSpot;
      this.enemies.push(createCrack(g.tx, g.ty, g.x, g.y, true)); // 금빛 균열 — 비밀 금고의 단서
    }
    // 가시 함정 (맵 M2): 감옥 테마 전투방 — 주기적으로 솟아 편을 가리지 않고 찌른다
    this.traps = [];
    this._siege = null;
    this._trial = null;
    if (World.hazard === 'prison' && (type === 'combat' || type === 'elite' || type === 'siege')) {
      for (let i = 0; i < 2; i++) {
        const pos = World.safeSpot(RNG.range(TS * 4, TS * 16), RNG.range(TS * 2.5, TS * 8.5) + World.offsetY);
        this.traps.push({ x: pos.x, y: pos.y, t: RNG.range(0, 2.0), state: 'idle', hit: null });
      }
    }

    // 문 수식어 (P4): 위험-보상 트레이드오프 적용
    this._roomMod = (type === 'combat' || type === 'elite') ? (Dungeon.pendingMod || null) : null;
    Dungeon.pendingMod = null;
    if (this._roomMod) {
      const data = floorData(Dungeon.floor);
      if (this._roomMod.id === 'horde') {
        for (let i = 0; i < 4; i++) {
          this.pendingSpawns.push({ delay: 1.0 + i * 0.3, type: RNG.pick(data.enemies), elite: false });
        }
      } else if (this._roomMod.id === 'guarded') {
        for (let i = 0; i < 2; i++) {
          this.pendingSpawns.push({ delay: 0.8 + i * 0.4, type: RNG.pick(data.enemies), elite: true });
        }
        // safeSpot: 템플릿 방은 중앙에 기둥이 있을 수 있다 — 벽 안에 박힌 상자는 열 수 없다
        const gc = World.center();
        const gs = World.safeSpot(gc.x, gc.y - 60);
        this.interactables.push({ kind: 'chest', x: gs.x, y: gs.y, r: 24, used: false, t: 0 });
      }
      this.banner = { text: `⚠ ${this._roomMod.label}`, life: 1.8, maxLife: 1.8, color: '#e43b44' };
    }


    // 왕좌 입장 (기획 §5 복선 회수): 모은 증거 수만큼 왕이 다르게 맞이한다
    if (Dungeon.floor === 50 && type === 'boss') {
      const n = Meta.clueCount();
      this._storyQ = this._storyQ || [];
      if (n >= 20) {
        this._storyQ.push({ text: `품 안의 증거 ${n}건 — 전부 왕좌에 못박는다. 하나도 빠짐없이.`, color: '#f7b32b' });
      } else if (n >= 10) {
        this._storyQ.push({ text: `품 안의 증거 ${n}건 — 진실의 절반이면 충분하다. 나머지는 이 검이 말한다.`, color: '#c8c0a8' });
      } else {
        this._storyQ.push({ text: `증거는 ${n}건뿐 — 상관없다. 내 몸이 증거다.`, color: '#9a9488' });
      }
    }

    // 단서 오브젝트 (기획 §4): 미획득 탐사 단서가 이 층 범위에 있으면 배치.
    // c1(덧칠된 비석)은 1층 첫 방 확정 — 부활 지점에서 첫 진실을 마주한다
    {
      const cand = CLUES.filter((c) => c.how === 'explore' && c.floors && !Meta.clueOwned(c.id) &&
        Dungeon.floor >= c.floors[0] && Dungeon.floor <= c.floors[1]);
      for (const c of cand) {
        const sure = c.guaranteed && Dungeon.roomIndex === 1;
        if (sure || (Dungeon.roomIndex > 1 && type !== 'boss' && RNG.chance(this.route === 'old' ? 0.3 : 0.16))) {
          const spot = World.safeSpot(World.center().x + 140, World.center().y + 60);
          this.interactables.push({ kind: 'clue', clueId: c.id, x: spot.x, y: spot.y, r: 26, used: false, t: 0 });
          if (sure) this.banner = { text: '낯익은 비석이 보인다…', life: 2.2, maxLife: 2.2, color: '#c8c0a8' };
          break; // 방당 1개
        }
      }
    }

    // 스킬 개조 세공대 (3축): 31층 첫 방 — 4막 입구에서 원한을 세공한다
    if (Dungeon.floor === 31 && Dungeon.roomIndex === 1 && !this.player.skillMod && this._modSeen !== 31) {
      this._modSeen = 31;
      const mc = World.safeSpot(World.center().x, World.center().y + 90);
      this.interactables.push({ kind: 'modShrine', x: mc.x, y: mc.y, r: 30, used: false, t: 0 });
      this.banner = { text: '원한의 세공대 — 스킬의 형태를 바꿀 수 있다 (다가가서 선택)', life: 3.0, maxLife: 3.0, color: '#b13ae0' };
    }

    // 스킬 사당 (P1): 5·15·25층의 첫 방에 무조건 선다 — 문 선택과 무관하게 킷이 자란다
    // ★ v182 — 사당을 2층부터. 종전엔 5·15·25층뿐이라 최고 8층인 사장은 **평생 딱 한 번**(5층)
    // 보조 스킬을 만났다. 한 번 고르고 끝이면 그건 빌드가 아니라 배급이다.
    // 2층에서 처음 만나고, 그 뒤로 3층마다 다시 고를 기회가 온다 (바꿔 쓰는 재미)
    if ([2, 5, 8, 11, 15, 18, 22, 25, 28].includes(Dungeon.floor) && Dungeon.roomIndex === 1 && this._shrineSeen !== Dungeon.floor) {
      this._shrineSeen = Dungeon.floor;
      const sc = World.safeSpot(World.center().x, World.center().y - 90);
      this.interactables.push({ kind: 'skillShrine', x: sc.x, y: sc.y, r: 30, used: false, t: 0 });
      this.banner = { text: '스킬 사당이 빛난다 — 다가가서 보조 스킬을 고르자 (E키로 사용)', life: 3.0, maxLife: 3.0, color: '#c9d94a' };
    }

    // 왕국의 징조 (Omen): 방마다 낮은 확률로 세계가 개입한다 — 저주는 편을 가리지 않는다
    if (this._moonT > 0 && this.player) { this.player.bonusAtk -= 1; this.player.speed /= 1.1; } // 월식 버프 회수
    this._moonT = 0;
    this._omen = null;
    this._omenKills = [];
    if ((type === 'combat' || type === 'elite') && Dungeon.floor >= 4 && RNG.chance(0.09)) {
      const pool = ['moon', 'eye'];
      if (Dungeon.floor >= 6) pool.push('eye'); // 심층부터 눈이 잦아진다
      if (Dungeon.floor >= 21) pool.push('horn');
      this._omen = { type: RNG.pick(pool), delay: 3 + RNG.next() * 5, fired: false, eyeT: 0 };
    }

    // 드라마 AI (M1) — 방 단위 상태 리셋: 경보/전투 시계/전령/전사자 장부/대형 여부
    this._roomAlert = false;
    this._roomFightT = 0;
    this._runnerCalled = false;
    this._sqDead = 0;
    this._drama = type === 'combat' || type === 'elite' || type === 'trial';
    this._formation = this._drama && Dungeon.floor >= 3 && RNG.chance(0.6) &&
      (World.lastTemplateTag === 'corridor' || World.lastTemplateTag === 'pillars');
    this._formN = 0;
    this._roleN = null; // v181 진형 역할 카운터 — 방마다 새로 센다

    if (type === 'combat') {
      const comp = Dungeon.combatComp(depth);
      this._roomKind = comp.roomKind || null; // v187 방 성격 — 검증·연출이 같은 값을 본다
      comp.forEach((s, i) => {
        // v186: pack·leader를 여기서 안 넘겨서 **리더가 한 기도 안 생겼다** (실측 8개 방 전부 0기).
        // v185의 사기 시스템이 통째로 죽어 있었다 — 회귀는 combatComp만 봤지 스폰 경로를 안 봤다
        // v187: hpMul(위협 예산 배분)도 함께 넘긴다 — v186과 같은 실수(필드 누락으로
        // 기능이 통째로 죽는)를 반복하지 않도록 회귀 검증이 이 경로를 직접 본다
        this.pendingSpawns.push({ delay: 0.4 + i * 0.3, type: s.type, elite: s.elite, mini: s.mini,
          pack: s.pack, leader: s.leader, hpMul: s.hpMul });
      });
      // M2: 탈영병 (선함) — 1~4막 7%: 싸우지 않는 병사가 다가와 무언가를 건네고 사라진다
      if (Dungeon.floor >= 2 && Dungeon.floor <= 40 && RNG.chance(0.07)) {
        const dp = World.safeSpot(TS * (World.cols - 4), TS * 3 + World.offsetY);
        const des = createEnemy('berserker', dp.x, dp.y, false, 1);
        des.neutral = true; des._deserter = 'approach'; des.spawnT = 0;
        des.hp = des.maxHp = 3;
        des.onDeath = function () {
          Particles.text(this.x, this.y - 30, '…왜…', { color: '#c8c0ac', size: 12 });
        };
        this.enemies.push(des);
      }
      // 층 첫 방이면 층 이름 배너 (지름길 도착이면 경고)
      if (depth === 1) {
        this.banner = Dungeon.shortcutHot
          ? { text: `지름길 — ${Dungeon.floor}층 ${Dungeon.floorName()} (정예가 들끓는다)`, life: 2.5, maxLife: 2.5, color: '#e43b44' }
          : { text: `${Dungeon.floor}층 — ${Dungeon.floorName()}`, life: 2.0, maxLife: 2.0 };
        // 다음 보스 예고 (v142): 층의 끝에서 누가 기다리는지 — 보스가 목적지가 된다
        const bd = typeof bossDefFor === 'function' ? bossDefFor(Dungeon.floor) : null;
        if (bd && !this.bossRush) {
          this._storyQ = this._storyQ || [];
          this._storyQ.push({ text: `이 층의 끝 — 「${bd.name}」이 기다린다`, color: '#e43b44' });
        }
      }
    } else if (type === 'elite') {
      Dungeon.eliteComp(depth).forEach((s, i) => {
        this.pendingSpawns.push({ delay: 0.4 + i * 0.3, type: s.type, elite: s.elite });
      });
      this.banner = { text: '정예의 방', life: 1.4, maxLife: 1.4 };
    } else if (type === 'treasure') {
      const c = World.center();
      this.interactables.push({ kind: 'chest', x: c.x, y: c.y, r: 24, used: false, t: 0 });
    } else if (type === 'camp') {
      // 모닥불: 휴식(회복) vs 담금질(이번 층 공격력) — 하나를 고르면 다른 쪽은 사라진다
      const c = World.center();
      this.interactables.push({ kind: 'camp', x: c.x - 78, y: c.y, r: 28, used: false, t: 0 });
      this.interactables.push({ kind: 'whetstone', x: c.x + 78, y: c.y, r: 28, used: false, t: 0 });
    } else if (type === 'event') {
      const c = World.center();
      if (this.gold >= 150 && RNG.chance(0.3)) {
        // 망자의 도박사 (골드 sink): 교수대 간수들이 하던 노름 — 골드 절반을 건다
        this.interactables.push({ kind: 'gambler', x: c.x, y: c.y, r: 26, used: false, t: 0 });
        this.banner = { text: '망자의 도박사 — 교수대 주사위가 구른다…', life: 2.0, maxLife: 2.0, color: '#f7b32b' };
      } else if (RNG.chance(0.4) && this.player.maxHp > 2) {
        // 악마 거래 (G2): 대가를 치르는 파워 — 최대 HP 1 ↔ 정예급 특성 선택
        this.interactables.push({ kind: 'bloodAltar', x: c.x, y: c.y, r: 26, used: false, t: 0 });
        this.banner = { text: '핏빛 제단이 고동친다... (대가: 최대 HP 1)', life: 2.2, maxLife: 2.2, color: '#e43b44' };
      } else {
        // 기연: 받아들이기 전엔 무엇인지 모른다 — 다가가면 수락(도박), 문으로 나가면 거절
        this.interactables.push({ kind: 'mystery', x: c.x, y: c.y, r: 26, used: false, t: 0 });
        this.banner = { text: '기이한 기운이 감돈다...', life: 1.8, maxLife: 1.8, color: '#b13ae0' };
      }
    } else if (type === 'merchant') {
      // 상인 (G1): 골드 sink — "지금 쓸까, 아낄까"가 이 방의 콘텐츠다
      const c = World.center();
      const f = Dungeon.floor;
      // 가격은 층 비례 가파르게 (경제 계측: 수입도 층 비례 급증) + 파편 주머니 = 후반 잉여 골드 sink
      const s1 = World.safeSpot(c.x - 180, c.y);
      const s2 = World.safeSpot(c.x - 60, c.y);
      const s3 = World.safeSpot(c.x + 60, c.y);
      const s4 = World.safeSpot(c.x + 180, c.y);
      const disc = this.player.rflags.haggle ? 0.75 : 1; // 장사꾼의 저울: -25%
      this.interactables.push({ kind: 'shopRelic', x: s1.x, y: s1.y, r: 26, used: false, t: 0, price: Math.round((40 + f * 8) * disc) });
      this.interactables.push({ kind: 'shopHeal', x: s2.x, y: s2.y, r: 26, used: false, t: 0, price: Math.round((12 + f * 3) * disc) });
      this.interactables.push({ kind: 'shopReroll', x: s3.x, y: s3.y, r: 26, used: false, t: 0, price: Math.round((18 + f * 3) * disc) });
      this.interactables.push({ kind: 'shopShards', x: s4.x, y: s4.y, r: 26, used: false, t: 0, price: Math.round((30 + f * 6) * disc), shards: 10 + f * 2 });
      // 골드 sink (경제 계측: 50층 7.5만 잉여): 검은 상자 — 비싸지만 레어 이상 확정
      const s5 = World.safeSpot(c.x, c.y + 95);
      this.interactables.push({ kind: 'shopBlack', x: s5.x, y: s5.y, r: 26, used: false, t: 0, price: Math.round((200 + f * 20) * disc) });
      // 까마귀의 기억 (v123): 런을 거듭할수록 나를 기억한다 — 단골에게는 진실 부스러기를 흘린다
      Meta.data.crowMet = (Meta.data.crowMet || 0) + 1;
      Meta.save();
      const cm = Meta.data.crowMet;
      const CROW = cm === 1 ? '…산 것도, 죽은 것도 아니군. 내 가게엔 제일 좋은 손님이야.'
        : cm === 2 ? '또 왔군. 죽은 자 치고 발이 빠르단 말이지.'
        : cm === 3 ? '네 얘기가 왕도까지 퍼졌어. 목값이 오르면 물건값도 올라야 하는데 — 정 때문에 참는다.'
        : cm === 5 ? '까마귀들이 그러더군. 축일마다 성 지하 예배당에 불이 켜진다고. 그날 밤엔 장사도 접어.'
        : cm === 8 ? '왕비의 무덤이 비어 있다는 소문은 들었나? 시신 없이 관만 묻었다더군.'
        : cm === 12 ? '너 말이야… 처음 왔을 때보다 눈빛이 사람 같아졌어. 이상한 일이지, 죽은 놈이.'
        : null;
      this.banner = CROW
        ? { text: `장물아비 '까마귀' — "${CROW}"`, life: 3.0, maxLife: 3.0, color: '#2ec4b6' }
        : { text: "장물아비 '까마귀' — 죽은 자의 편. 골드는 왕좌까지 못 가져간다", life: 2.2, maxLife: 2.2, color: '#2ec4b6' };
    } else if (type === 'trial') {
      // 시련 (G5): 다른 층의 악몽이 섞여 몰려온다 — 이기면 확정 상급 유물 + 골드
      this._trial = true;
      Dungeon.trialComp().forEach((s, i) => {
        this.pendingSpawns.push({ delay: 0.5 + i * 0.25, type: s.type, elite: s.elite });
      });
      this.banner = { text: '시련 — 다른 층의 악몽이 몰려온다!', life: 2.2, maxLife: 2.2, color: '#b13ae0' };
    } else if (type === 'vault') {
      // 비밀 금고 (맵 M3): 진행을 소모하지 않는 순수 보너스 — 상자 1 + 진귀한 항아리 2
      // (보상 감사: 상자 2개 = 유물 2개는 무위험 대비 과함 — 보물방(유물 1)의 상위 호환이 되어버린다)
      const c = World.center();
      const s1 = World.safeSpot(c.x, c.y);
      this.interactables.push({ kind: 'chest', x: s1.x, y: s1.y, r: 24, used: false, t: 0 });
      const p1 = World.safeSpot(c.x - 150, c.y - 70);
      const p2 = World.safeSpot(c.x + 150, c.y - 70);
      this.enemies.push(createPot(p1.x, p1.y, true), createPot(p2.x, p2.y, true));
      this.banner = { text: '비밀 금고 — 마음껏 챙겨라', life: 2.0, maxLife: 2.0, color: '#ffd866' };
    } else if (type === 'siege') {
      // 습격 (맵 M4): 세 번의 파도 — 버티면 정예급 보상
      this._siege = { wave: 1, total: 3 };
      Dungeon.siegeWave(1).forEach((s, i) => {
        this.pendingSpawns.push({ delay: 1.0 + i * 0.3, type: s.type, elite: s.elite });
      });
      this.banner = { text: '습격 — 세 번의 파도를 버텨라!', life: 2.2, maxLife: 2.2, color: '#e43b44' };
    } else if (type === 'boss') {
      const c = World.center();
      const boss = createBoss(Dungeon.floor, c.x + TS * 4, c.y);
      if (this.pacts.boss) {
        boss.hp = boss.maxHp = Math.round(boss.maxHp * 1.5);
      }
      this.enemies.push(boss);
      // 보스 등장 카드 (v142): 이름·기믹을 정면으로 — 싸우기 전에 "누구인지"부터 각인
      boss.spawnT = 1.2;
      // v187: 이름·기믹 밑에 **죄목** 한 줄. 이 보스가 나에게 무슨 짓을 했는지가
      // 싸우기 전에 화면에 있어야 한다 — 사장 지적 "보스에게 사연을 못 느끼고"
      const bcx = Meta.codexOf('boss' + boss.defId);
      this._bossIntro = { t: 2.8, name: boss.name, crime: bcx ? bcx.lore : '',
        label: [boss.affixLabel, boss.def.mechanic ? boss.def.mechanic.label : ''].filter(Boolean).join(' · ') };
      this.banner = null; // 카드가 화면을 갖는다 — 유언 배너는 카드가 걷힌 뒤
      this._storyQ = this._storyQ || [];
      this._storyQ.push({ text: boss.def.banner, color: '#e43b44' });
      // v176: 막마다 다른 위압 + 이 보스의 이름(시그니처 모티프).
      // 종전 bossAppear()의 언어(바닥이 꺼지는 초저역 + 단2도 클러스터)는 그대로 유지된다 —
      // "보스가 왔다"는 이미 학습된 소리라 버리면 안 된다
      if (typeof BossAudio !== 'undefined') BossAudio.entrance(boss.defId);
      else AudioSys.bossAppear();
      Music.setBossPhase(1);   // 다음 틱(16ms)을 기다리지 않고 즉시 — 등장 연출과 겹치게
      Renderer.shake(5, 0.5);
    }

    this.saveRun(); // 방 입장 스냅샷 — 브라우저를 닫아도 이 방부터 이어한다
  },

  // 층별 적 HP 스케일 — 심층(6층+)은 기울기 상향 (+30%→+40%/층).
  // 계측 근거: 5층부터 받은 피해가 거의 0 — 성장(공격력·진화·유물)이 +30% 기울기를 추월한다
  floorHpScale() {
    const f = Dungeon.floor;
    // v166 (사장 지시 "보상 1/3로 줄이고 적 단단하게"): 보상 축소가 화력을 절반으로 낮춰
    // 필요 타수가 이미 1.3~1.9타 → 2.3~3.5타로 올라왔다. 여기서 HP를 배로 올리면
    // 탄막 스펀지가 된다 — 목표(잡몹 3타)까지 **1.15배만** 얹는다.
    //   1층 ×1.00 · 5층 ×2.38 · 10층 ×4.83 · 이후 지수 유지
    if (f <= 5) return 1 + (f - 1) * 0.345;
    if (f <= 10) return 2.38 + (f - 5) * 0.49;
    return 4.83 * Math.pow(1.07, f - 10);
  },

  // 열기 반영 적 강화 배율
  enemyHpMul() {
    // 열기 재분배 (계측: 열기5 마도사 사망의 80%가 1층) — 평면 ×1.25 대신 층 비례:
    // 1층은 가볍게(×1.06+), 10층은 묵직하게(열기5 기준 ×1.79). 열기가 '후반 도전'이 되도록
    let m = this.floorHpScale();
    if (this.pacts && this.pacts.hp) m *= (1 + 0.012 * this.heat + 0.012 * this.heat * (Dungeon.floor - 1));
    if (this.pacts && this.pacts.wrath) m *= 1.25; // 왕의 진노: 전역 HP +25%
    return m;
  },

  // 현재 상태에 맞는 BGM 테마 결정 (v176)
  // ★ 순서가 중요하다 — **보스 분기가 먼저, 층 분기가 나중**이다 (사양서 C6).
  //   뒤집으면 보스방에서도 층 테마가 나가 보스곡 개편이 통째로 무력화된다
  _musicKey() {
    if (this.state === 'hub' || this.state === 'altar' || this.state === 'classes' || this.state === 'codex') return 'hub';
    if (this.state === 'over' || this.state === 'victory') return null;
    // 보스 — 막별 보스 테마 5 + 왕 3페이즈. 층이 아니라 **킷**으로 막을 정하므로
    // 51층+ 무한 순환에서도 "누구와 싸우는지"가 소리에 유지된다
    if (Dungeon.roomType === 'boss') {
      const b = this.enemies.find((e) => e.isBoss && !e.dead);
      if (b) return Music.bossKey(b);
      // 처치 직후의 정적도 소리다 — 여운이 끝나기 전엔 층 테마를 덮어씌우지 않는다
      if (typeof BossAudio !== 'undefined' && BossAudio.inSilence()) return null;
    }
    // 층 — 1막 층별 고유 10곡 / 2~5막 막당 3변주 / 51층+ 무한 2변주
    return Music.floorKey(Dungeon.floor);
  },

  // 현재 상태에 맞는 환경음(막). BGM과 별개 축이다 —
  // BGM은 층마다 바뀌어도 되지만 공간은 막 단위로만 바뀐다 (1막 10개 층은 같은 땅속이다)
  _ambKey() {
    if (this.state === 'over' || this.state === 'victory') return null;
    if (this.state === 'hub' || this.state === 'altar' || this.state === 'classes' || this.state === 'codex') return 'hub';
    return Math.min(5, Math.max(1, Math.ceil(Dungeon.floor / 10)));
  },

  // 음악이 읽는 전황 (v176) — 적 수·정예·보스 페이즈·내 HP를 **한 번에** 훑는다.
  // ★ 여기가 동적 음악의 유일한 입력 지점이다. 음악은 이 셋 말고 아무것도 안 본다 (사양서 C12)
  _musicPulse() {
    if (this.state !== 'play') return { intensity: 0, peril: 0, bossPhase: 0 };
    let live = 0, elite = 0, boss = null;
    for (const e of this.enemies) {
      if (e.dead || e.neutral) continue;   // 항아리·균열 같은 중립 개체는 전황이 아니다
      live++;
      if (e.elite || e.isMini) elite++;
      if (e.isBoss) boss = e;
    }
    // 0 탐색 / 1 접촉 / 2 격전(5마리+ 또는 정예) / 3 절정(보스)
    let intensity = boss ? 3 : (live >= 5 || elite > 0) ? 2 : live > 0 ? 1 : 0;
    if (this.roomCleared) intensity = 0;   // 문이 열렸으면 이미 끝난 방이다
    // 보스 페이즈 — boss.phase / _onslaught 는 **래치된** 값이라 왔다갔다 하지 않는다.
    // HP 비율은 보조 판정으로만 쓴다 (회복하는 보스가 있어도 페이즈가 되돌아가지 않게)
    let bossPhase = 0;
    if (boss) {
      const r = boss.maxHp > 0 ? boss.hp / boss.maxHp : 1;
      bossPhase = boss.spawnT > 0 ? 1
        : boss._onslaught ? 3
        : (boss.phase >= 2 || r <= 0.5) ? 2 : 1;
    }
    // 위기 — HP 30%부터 스며들어 8%에서 최대. 탐색 중엔 절반만 (혼자 걸을 땐 덜 조인다)
    const p = this.player;
    const hpr = p && p.maxHp > 0 ? p.hp / p.maxHp : 1;
    let peril = hpr >= 0.30 ? 0 : Math.min(1, (0.30 - hpr) / 0.22);
    if (peril > 0 && intensity === 0) peril *= 0.55;
    if (!p || p.dead) peril = 0;
    return { intensity, peril, bossPhase };
  },

  // ── 메인 틱 ──
  tick(dt) {
    this.blinkT += dt;
    // 오프닝/서사 배너 큐 — 현재 배너가 끝나면 다음 줄
    if (this._storyQ && this._storyQ.length && this.state === 'play' && (!this.banner || this.banner.life <= 0)) {
      const line = this._storyQ.shift();
      this.banner = { text: line.text, life: 2.8, maxLife: 2.8, color: line.color };
    }
    // v176: 곡 선택 → 강도 적용 순서를 보장한다 (ensure가 덱을 만든 뒤 pulse가 레이어를 켠다)
    const pulse = this._musicPulse();
    // v177: 소리의 기준점은 플레이어다 — 거리 감쇠·정위가 전부 여기서 갈린다
    if (this.player) AudioSys.setListener(this.player.x, this.player.y);
    Music.ensure(this._musicKey());
    Music.pulse(pulse);
    // v174: 공간의 소리 — 막이 바뀌면 공기와 잔향이 함께 바뀐다.
    // 거점/정산은 조용한 작은 방, 던전은 막별 앰비언스 + 그 막의 잔향 프리셋
    const ak = this._ambKey();
    if (ak == null) Ambience.stop();
    else Ambience.ensure(ak, ak === 'hub' ? null : (World.hazard || null));
    // 전황 판정은 한 곳에서만 — 환경음도 _musicPulse의 결과를 받는다 (사양서 C12)
    if (Ambience.setCombat) Ambience.setCombat(pulse.intensity > 0);
    if (Bot.enabled) Bot.update(this, dt);

    if (this.state === 'hub') {
      // 거점 배너 감쇠 — 플레이 틱과 별개 경로 (F9 리포트 배너가 영영 안 사라지던/안 보이던 문제)
      if (this.banner) {
        this.banner.life -= dt;
        if (this.banner.life <= 0) this.banner = null;
      }
      this._tickHub();
      return;
    }
    if (this.state === 'altar') {
      this._tickAltar();
      return;
    }
    if (this.state === 'classes') {
      this._tickClasses();
      return;
    }
    if (this.state === 'codex') {
      this._tickCodex();
      return;
    }
    if (this.state === 'over' || this.state === 'victory') {
      Particles.update(dt);
      // 파편 정산 카운트업 (+ 카운트 사운드)
      const prev = Math.floor(this.shardAnimT * 40);
      this.shardAnimT += dt;
      const cur = Math.min(this.shardsEarned, Math.floor(this.shardAnimT * 40));
      if (cur > prev && cur <= this.shardsEarned && cur % 3 === 0) AudioSys.shard();

      // 오클릭 방지: 진입 직후에는 입력을 받지 않는다 (죽은 줄도 모르고 넘어가는 문제)
      if (this.overLockT > 0) { this.overLockT -= dt; return; }

      // 다섯 번째 손 — 에필로그: 정산보다 먼저, 아무 키로 3장을 넘긴다
      if (this.state === 'victory' && this._epi && !this._epi.done) {
        if (Input.mouse.justDown || Input.pressed('Space', 'Enter', 'KeyR', 'KeyC', 'KeyJ')) {
          this._epi.page++;
          AudioSys.pickup();
          if (this._epi.page >= 3) this._epi.done = true;
        }
        return;
      }

      // v162: 정산 화면에서도 획득 목록(Tab)과 설정(O)이 열린다.
      // "이번 판에 뭘 들고 있었지"를 확인할 마지막 순간이고, 「망자의 가호」를 켜야겠다고
      // 마음먹는 순간도 정확히 여기다. 종전엔 둘 다 play 상태에서만 열려서,
      // 사망 화면이 권하는 설정을 사망 화면에서는 열 수 없었다
      if (this.showSettings) { this._tickSettings(); return; }
      if (this.showInventory) {
        if (Input.pressed('Tab', 'Escape', 'KeyP')) { this.showInventory = false; AudioSys.pickup(); }
        return;
      }
      if (Input.pressed('Tab')) { this.showInventory = true; AudioSys.pickup(); return; }
      if (Input.pressed('KeyO')) { this.showSettings = true; this._setRow = 0; AudioSys.pickup(); return; }

      if (Input.pressed('KeyR')) { this.restart(); return; }
      // 승리 화면에서 C — 1막 완수 후엔 2막(다리와 관문), 2막 완수 후엔 왕도 가도
      // v163: 승리 화면 S — 다음 막을 이어받되 지금은 쉰다.
      // 종전엔 C(즉시 계속)와 거점(빌드 소멸) 둘뿐이라, 30분을 쌓은 빌드를 들고
      // "오늘은 여기까지"를 고르면 그 빌드가 사라졌다. 로그라이크의 한 판은 길다
      if (this.state === 'victory' && Input.pressed('KeyS')) {
        const MAX_ACT = 5;
        if ((this.act || 1) < MAX_ACT && Dungeon.floor <= (this.act || 1) * 10) {
          this.continueNextAct(); // 다음 막 진입 + 진군로 대기 상태로 스냅샷 저장
          this.state = 'hub';
          this.banner = { text: '여기까지 저장했다 — 거점에서 「이어하기」로 돌아온다', life: 3.0, maxLife: 3.0, color: '#2ec4b6' };
          AudioSys.pickup();
        }
        return;
      }
      if (this.state === 'victory' && Input.pressed('KeyC')) {
        const MAX_ACT = 5; // 전 막 구현 완료 — 50층 왕좌가 끝이다
        if ((this.act || 1) < MAX_ACT && Dungeon.floor <= (this.act || 1) * 10) this.continueNextAct();
        else this.continueEndless();
        return;
      }
      if (Input.mouse.justDown || Input.pressed('Space', 'Enter')) {
        this.state = 'hub';
        AudioSys.pickup();
      }
      return;
    }
    if (this.state === 'levelup') {
      this.choiceLockT -= dt;
      // 환생 각인: E — 카드 다시 뽑기
      if (Input.pressed('KeyE') && this.player.rerolls > 0 && !this._subChoice) {
        this.player.rerolls--;
        this.traitCards = rollTraitCards(this.player, this.traitCards.length);
        this.choiceLockT = 0.3;
        AudioSys.chest();
      }
      this._handleCardInput(this.traitCards, (i) => this.pickTrait(i));
      return;
    }
    if (this.state === 'relic') {
      this.choiceLockT -= dt;
      this._handleCardInput(this.relicCards, (i) => this.pickRelic(i));
      return;
    }
    if (this.state === 'route') {
      this.choiceLockT -= dt;
      this._handleCardInput(this.routeCards, (i) => this.pickRoute(i));
      return;
    }
    if (this.state === 'skillmod') {
      this.choiceLockT -= dt;
      this._handleCardInput(this.modCards, (i) => this.pickSkillMod(i));
      return;
    }
    // ── v120 스토리 상태: 프롤로그 / 증거 카드 / 자백 장면 — 전부 아무 키 진행, 봇은 자동 통과 ──
    if (this.state === 'prologue') {
      const pr = this._pro;
      pr.t += dt;
      if (Input.pressed('Escape')) { this._endPrologue(); return; }
      const adv = Input.pressed('Space', 'Enter', 'KeyJ', 'Digit1', 'KeyE') || Input.mouse.justDown ||
        (Bot.enabled && pr.t > 0.5);
      if (adv && pr.t > 0.35) {
        pr.step++;
        pr.t = 0;
        if (pr.step === 1) { Renderer.shake(5, 0.4); AudioSys.thud(); }
        if (pr.step === 2) { // 내 비석 대면 — 첫 증거를 손에 넣는 순간이 곧 튜토리얼
          const c = Meta.gainClue('c1');
          if (c) { Meta.data.shards += 25; Meta.save(); AudioSys.chest(); }
        }
        if (pr.step >= 4) this._endPrologue();
      }
      return;
    }
    if (this.state === 'cluecard') {
      const cc = this.clueCard;
      cc.t += dt;
      if (cc.t > 0.45 && (Input.pressed('Space', 'Enter', 'KeyJ', 'Digit1', 'Escape') || Input.mouse.justDown || Bot.enabled)) {
        this.clueCard = null;
        this.state = 'play';
      }
      return;
    }
    if (this.state === 'confession') {
      const cf = this.confession;
      cf.t += dt;
      if (cf.t > 0.6 && (Input.pressed('Space', 'Enter', 'KeyJ', 'Digit1', 'Escape') || Input.mouse.justDown || Bot.enabled)) {
        this.confession = null;
        if (cf.clue) { this.clueCard = { clue: cf.clue, reward: 0, t: 0 }; this.state = 'cluecard'; }
        else this.state = 'play';
      }
      return;
    }
    if (this.state === 'transition') {
      const tr = this.transition;
      // v189: 666ms → 435ms. 런당 450회 × 666ms = 300초(5분)를 검정 화면에 쓰고 있었다.
      // 그리고 그 시간을 '암전'이 아니라 '이동'으로 채운다 — 나온 방은 왼쪽으로 밀려나고,
      // 새 방이 오른쪽에서 들어온다. 위 문으로 나갔으면 살짝 위에서 들어온다
      tr.t += dt * ((tr.type === 'nextfloor' || tr.type === 'shortcut') ? 3.0 : 4.6);
      {
        const k = Math.min(1, Math.max(0, tr.t));
        const ease = tr.phase === 'out' ? k * k : 1 - (1 - k) * (1 - k); // 나갈 땐 가속, 들어올 땐 감속
        // ★ v197 — 사장: "층 별로 맵이 다 이어지게 디자인해줘"
        // 층 이동은 종전에 floor++ 한 줄이었고 연출이 일반 방 전환과 100% 같았다.
        // **50층 탑인데 오르는 장면이 한 번도 없었다.** 계단은 옆이 아니라 위로 간다 —
        // 화면이 아래로 밀리면 내가 위로 오른 것으로 읽힌다
        const climb = tr.type === 'nextfloor' || tr.type === 'shortcut';
        if (climb) {
          Renderer.panX = 0;
          Renderer.panY = tr.phase === 'out' ? Renderer.H * ease : -Renderer.H * (1 - ease);
        } else {
          const vy = (tr.dy || 0) * Renderer.H * 0.22;
          Renderer.panX = tr.phase === 'out' ? -Renderer.W * ease : Renderer.W * (1 - ease);
          Renderer.panY = tr.phase === 'out' ? vy * ease : vy * (1 - ease);
        }
      }
      if (tr.phase === 'out' && tr.t >= 1) {
        Dungeon.pendingMod = tr.mod || null; // 문 수식어를 다음 방에 전달
        // v189: 나온 문의 높이·방향을 다음 방에 넘긴다 — 진입점과 지도 좌표가 여기서 갈린다
        Dungeon.entryY = tr.doorY != null ? tr.doorY : null;
        Dungeon.pendingDy = tr.dy || 0;
        Dungeon.advance(tr.type);
        tr.phase = 'in';
        tr.t = 0;
      } else if (tr.phase === 'in' && tr.t >= 1) {
        this.transition = null;
        Renderer.panX = 0; Renderer.panY = 0;   // 반드시 되돌린다 — 남으면 월드가 통째로 어긋난다
        this.state = 'play';
        if (this.pendingChoices > 0) this.openTraitChoice('levelup');
        // 막 시작 독백 (v120 ④): 비차단 하단 텍스트 — 전환 시간은 1초도 늘리지 않는다
        this._floorMonologue();
      }
      return;
    }

    this._tickPlay(dt);
  },
};

// 분리된 모듈을 Game에 합친다 (combat/rewards/play/screens/render-game)
Object.assign(Game, GameCombat, GameRewards, GamePlay, GameScreens, GameRender);

// ── 부트스트랩 ──
(async function boot() {
  const canvas = document.getElementById('game');
  Renderer.init(canvas);
  Input.init(canvas);
  await Store.init(); // 저장 백엔드 준비 (웹 localStorage / 데스크톱 세이브 파일) — Meta.load보다 먼저
  Meta.load();
  // 픽셀 폰트 선로드 — 로드 전 프레임은 monospace로 그려지다 자연 전환 (font-display: swap)
  if (document.fonts && document.fonts.load) {
    document.fonts.load('12px Galmuri11').catch(() => {});
    document.fonts.load('bold 12px Galmuri11').catch(() => {});
  }
  AudioSys.muted = Meta.data.muted;

  const qs = new URLSearchParams(location.search);
  if (qs.has('test')) Game.testMode = true;
  if (qs.has('class') && Meta.classUnlocked(qs.get('class'))) {
    Meta.selectClass(qs.get('class'));
  }
  if (qs.has('seed')) {
    const parsed = parseInt(qs.get('seed'), 36);
    if (!Number.isNaN(parsed)) Game._urlSeed = parsed >>> 0;
  }
  if (qs.has('bot')) {
    Bot.enabled = true;
    Game.testMode = true;   // 봇 모드는 테스트 도구 — 단축키도 함께 켠다
    Game.reviveMode = true; // 기본 무한 부활: 층별 사망 수를 세며 끝까지 진행 (F로 끄기)
  }
  window.BotReport = () => ({
    floor: Dungeon.floor, room: Dungeon.roomIndex, time: Math.round(Game.time),
    level: Game.level, kills: Game.kills, runs: Bot.runs, wins: Bot.wins,
    deaths: { ...Bot.deaths }, ...Bot.deathReport(), stats: { ...Bot.stats },
  });
  if (qs.has('botloop')) { Bot.enabled = true; Bot.loop = true; Game.testMode = true; }
  if (qs.has('human')) Bot.human = true; // 휴먼 모드 봇 (§0 원칙 B — 표준 난이도 검증용)
  if (qs.has('ff')) Bot.ff = Math.min(8, Math.max(1, parseInt(qs.get('ff'), 10) || 1));
  if (qs.has('autostart') || qs.has('demo') || Bot.enabled) Game.restart();
  if (qs.has('demo')) installDemoBot();
  if (qs.has('floor')) {
    // 테스트용: 특정 층 직행
    Dungeon.floor = Math.min(10, Math.max(1, parseInt(qs.get('floor'), 10) || 1));
    Dungeon.roomIndex = 1;
    Dungeon.build('combat');
  }
  if (qs.get('jump') === 'boss') {
    Dungeon.roomIndex = Dungeon.totalRooms;
    Dungeon.build('boss');
  }
  window.Game = Game;

  const STEP = 1 / 60;
  let last = performance.now();
  let acc = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    acc += dt;
    // 게임패드 폴링 — 키 입력으로 번역 (선택 화면에선 십자키 = 번호)
    // v187: 'codex'·'altar'·'classes' 추가 — 패드로 거점에 들어가면 도감·제단·직업 선택에서
    // 입력이 끊겼다. 사연을 도감에 넣어도 패드로는 닿을 수 없었다는 뜻이다
    const MENU_STATES = ['levelup', 'relic', 'route', 'skillmod', 'hub', 'over', 'victory', 'title',
      'codex', 'altar', 'classes'];
    Input.pollGamepad(MENU_STATES.includes(Game.state) || Game.paused);
    while (acc >= STEP) {
      // 배속 (?ff=N): 프레임당 N틱 — 봇 소크 테스트용
      for (let i = 0; i < Bot.ff; i++) {
        Game.tick(STEP);
        // 선입력 버퍼 (v160): 히트스톱(세계가 멈춘 순간)에는 함께 멈춘다.
        // 전투 밖에서는 통째로 비운다 — 카드를 Space로 고른 손이 복귀 직후
        // 유령 대시로 이어지면 안 된다
        if (Game.state !== 'play') Input.buf = {};
        else Input.decay(Game.hitstop > 0 ? 0 : STEP);
        Input.endFrame();
      }
      acc -= STEP;
    }
    Renderer.update(dt);
    Game.render();
  }
  requestAnimationFrame(frame);
})();

// 데모 봇: 자동 플레이 (검증용, ?demo=1)
function installDemoBot() {
  let t = 0;
  window.__demoBot = (game, dt) => {
    t += dt;
    const p = game.player;
    const moveToward = (tx, ty, stopDist = 8) => {
      Input.keys['KeyW'] = Input.keys['KeyA'] = Input.keys['KeyS'] = Input.keys['KeyD'] = false;
      if (tx < p.x - stopDist) Input.keys['KeyA'] = true;
      if (tx > p.x + stopDist) Input.keys['KeyD'] = true;
      if (ty < p.y - stopDist) Input.keys['KeyW'] = true;
      if (ty > p.y + stopDist) Input.keys['KeyS'] = true;
    };

    let target = null;
    let best = Infinity;
    for (const e of game.enemies) {
      if (e.phased) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < best) { best = d; target = e; }
    }

    if (target) {
      const ranged = p.classId !== 'knight';
      if (ranged) {
        // 원거리: 카이팅 — 거리 유지하며 쿨마다 사격
        if (best < 180) moveToward(p.x * 2 - target.x, p.y * 2 - target.y, 4); // 반대로 도주
        else if (best > 360) moveToward(target.x, target.y, 40);
        else Input.keys['KeyW'] = Input.keys['KeyA'] = Input.keys['KeyS'] = Input.keys['KeyD'] = false;
        if (p.attackCd <= 0 && best < 500) Input.justPressed['KeyJ'] = true;
        if (best < 100 && p.dashCharges >= 1) Input.justPressed['Space'] = true;
      } else {
        moveToward(target.x, target.y, 40);
        if (best < 80 && p.attackCd <= 0) {
          p.facing = { x: (target.x - p.x) / best, y: (target.y - p.y) / best };
          Input.justPressed['KeyJ'] = true;
        }
        if (t > 2.5) { Input.justPressed['Space'] = true; t = 0; }
      }
    } else {
      const it = game.interactables.find((i) => !i.used);
      if (it) moveToward(it.x, it.y, 4);
      else if (World.doorsActive && World.doors.length > 0) {
        moveToward(World.doors[0].x, World.doors[0].y, 4);
      }
    }
  };
  const origTick = Game.tick.bind(Game);
  Game.tick = function (dt) {
    if (this.state === 'levelup' || this.state === 'relic' || this.state === 'route' || this.state === 'skillmod' ||
        this.state === 'prologue' || this.state === 'cluecard' || this.state === 'confession') Input.justPressed['Digit1'] = true;
    origTick(dt);
  };
}
