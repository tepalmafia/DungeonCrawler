// 거점 화면 틱 — 허브/제단/직업/도감/치트/카드 입력.
// main.js에서 Object.assign(Game, GameScreens)으로 Game에 합쳐진다.
const GameScreens = {
  // ── 거점 화면들 ──
  // ── 테스트 모드 치트 (testMode가 켜졌을 때만) ──
  _tickCheats() {
    // 어디서나: V 봇 모드 토글
    if (Input.pressed('KeyV')) {
      Bot.toggle();
      this.banner = { text: Bot.enabled ? '🤖 봇 모드 ON' : '봇 모드 OFF', life: 1.2, maxLife: 1.2 };
    }
    // 어디서나: F 무한 부활 토글 (죽어도 풀피로 되살아난다)
    if (Input.pressed('KeyF')) {
      this.reviveMode = !this.reviveMode;
      this.banner = { text: this.reviveMode ? '♻ 무한 부활 ON' : '무한 부활 OFF', life: 1.2, maxLife: 1.2 };
      AudioSys[this.reviveMode ? 'buy' : 'deny']();
    }
    // 어디서나: O 한 조각 +500 / I 도감 완성 / Y 직업·열기 해금
    if (Input.pressed('KeyO')) {
      Meta.data.shards += 500;
      Meta.save();
      AudioSys.buy();
      if (this.player) Particles.text(this.player.x, this.player.y - 30, '◆ +500', { color: '#2ec4b6', size: 15 });
    }
    if (Input.pressed('KeyI')) {
      for (const e of CODEX_ENEMIES) {
        const key = e.boss ? 'boss' + e.id.slice(4) : e.id;
        Meta.data.codex.kills[key] = Math.max(1, Meta.data.codex.kills[key] || 0);
      }
      for (const r of RELICS) Meta.data.codex.relics[r.id] = true;
      for (const t of TRAITS) Meta.data.codex.traits[t.id] = Math.max(1, Meta.data.codex.traits[t.id] || 0);
      Meta.save();
      AudioSys.relic('legendary');
      this.banner = { text: '도감 완성!', life: 1.5, maxLife: 1.5 };
    }
    if (Input.pressed('KeyY')) {
      Meta.data.classes = { knight: true, archer: true, mage: true, alch: true };
      Meta.data.wins = Math.max(1, Meta.data.wins);
      Meta.data.bestFloor = 5;
      Meta.save();
      AudioSys.relic('epic');
      this.banner = { text: '망자·현상금 해금!', life: 1.5, maxLife: 1.5 };
    }

    if (this.state !== 'play') return;
    const p = this.player;
    // 플레이 중: G 무적 / H 회복 / K 전멸 / L 레벨업 / U 유물 / B 보스방 / N 다음 층
    if (Input.pressed('KeyG')) {
      p.god = !p.god;
      Particles.text(p.x, p.y - 30, p.god ? '무적 ON' : '무적 OFF', { color: '#5ce0e6', size: 15 });
      AudioSys.pickup();
    }
    if (Input.pressed('KeyH')) {
      p.hp = p.maxHp;
      Particles.text(p.x, p.y - 30, '회복!', { color: '#e43b44', size: 15 });
      AudioSys.pickup();
    }
    if (Input.pressed('KeyX')) { // K→X: 봇 스킬 키(K)와 충돌 — 봇이 스킬 쓸 때마다 방 전멸 (계측 왜곡 원인)
      for (const e of [...this.enemies]) {
        if (!e.dead) { e.spawnT = 0; e.phased = false; this.damageEnemy(e, 99999, { x: 0, y: -1 }, { feel: false }); }
      }
      this.markers.length = 0;
      this.pendingSpawns.length = 0;
    }
    if (Input.pressed('KeyL')) {
      this.gainXp(this.xpNext - this.xp + 1);
    }
    if (Input.pressed('KeyU')) {
      const rolled = rollRelics(p, 1, true);
      if (rolled.length > 0) this.acquireRelic(rolled[0]);
    }
    if (Input.pressed('KeyB') && Dungeon.roomType !== 'boss') {
      this._cheatScaleToFloor(); // 보스 직행 테스트: 층에 맞는 레벨·특성·유물로 자동 세팅 (순차 진행은 무관)
      Dungeon.roomIndex = Dungeon.totalRooms - 1;
      this.state = 'transition';
      this.transition = { phase: 'out', t: 0, type: 'boss' };
    }
    if (Input.pressed('KeyN')) {
      if (Dungeon.floor >= (this.act || 1) * 10 && !this.endless) {
        this.endRun(true);
        this.state = 'victory';
      } else {
        this.state = 'transition';
        this.transition = { phase: 'out', t: 0, type: 'nextfloor' };
      }
    }
  },

  // ── 정상 진행 기준선 (v165) ──────────────────────────────────────────
  // 손으로 박은 곡선은 다섯 번 연속 틀렸다 (v151·v153·v155·v158·v165). 이제 두 겹으로 간다:
  //  ① Meta.data.normRef — 치트·봇이 아닌 진짜 런이 층에 들어설 때마다 게임이 스스로 기록한다.
  //     사장의 실제 플레이가 쌓일수록 도구가 사장의 게임에 정확히 맞춰진다
  //  ② 아래 표 — normRef가 아직 비었을 때만 쓰는 임시 대역 (봇 정상 진행 실측 기반)
  // 어느 쪽이든 **화면에 정상치를 함께 띄우므로**, 도구가 다시 어긋나면 눈으로 즉시 보인다
  // 대역표 — 봇 정상 진행 실측(현상금 0, 치트 없음). 층 사이는 선형 보간한다.
  // 직업별 화력 차가 크다: 3층 실측 기사 공6 vs 궁수 공2 (3배). 뭉뚱그리면 도구가 다시 어긋난다
  // v166 보상 축소 **후** 실측으로 갱신 (1~5층 봇 표본 13건). 종전 표는 축소 전 값이라
  // 그대로 두면 도구가 다시 과잉 공급한다 — 실측 3층 기사 공6→3 · 유7→4
  _FALLBACK: {
    knight: { 1: { lv: 1, hp: 6, atk: 1, tr: 0, rel: 0 }, 2: { lv: 4, hp: 5, atk: 3, tr: 5, rel: 2 },
      3: { lv: 7, hp: 5, atk: 3, tr: 9, rel: 4 }, 4: { lv: 10, hp: 6, atk: 4, tr: 14, rel: 7 },
      5: { lv: 12, hp: 5, atk: 5, tr: 19, rel: 8 },
      8: { lv: 18, hp: 10, atk: 10, tr: 32, rel: 14 }, 10: { lv: 20, hp: 14, atk: 13, tr: 39, rel: 17 } },
    // 궁수는 축소 후 표본이 없어 기사 대비 비율(화력 0.55·HP 1.3)로 환산 — normRef가 쌓이면 대체된다
    archer: { 1: { lv: 1, hp: 5, atk: 1, tr: 0, rel: 0 }, 2: { lv: 4, hp: 6, atk: 2, tr: 5, rel: 2 },
      3: { lv: 6, hp: 8, atk: 2, tr: 10, rel: 4 }, 5: { lv: 9, hp: 8, atk: 3, tr: 19, rel: 8 },
      8: { lv: 13, hp: 9, atk: 7, tr: 28, rel: 12 }, 10: { lv: 18, hp: 12, atk: 11, tr: 38, rel: 15 } },
  },

  _normalRef(f, cls) {
    const bag = Meta.data && Meta.data.normRef && Meta.data.normRef[cls];
    const live = bag && bag[Math.round(f)];
    if (live && live.n >= 1) return { ...live, live: true };
    // 미측정 직업(마도사·연금술사)은 궁수 표로 대신한다 — 기사보다 저HP·저화력 쪽이 가깝다
    const T = this._FALLBACK[cls] || this._FALLBACK.archer;
    const keys = Object.keys(T).map(Number).sort((a, b) => a - b);
    let lo = keys[0], hi = keys[keys.length - 1];
    for (const k of keys) if (k <= f) lo = k;
    for (let i = keys.length - 1; i >= 0; i--) if (keys[i] >= f) hi = keys[i];
    if (lo === hi) {
      const base = T[lo];
      // 표 밖(11층 이상)은 10층 값에서 층 비례로 뻗는다
      const k = f > hi ? f / hi : 1;
      return { lv: Math.round(base.lv * k), hp: Math.round(base.hp * Math.min(k, 2.2)),
        atk: +(base.atk * k).toFixed(1), tr: Math.round(base.tr * k), rel: Math.round(base.rel * k), live: false };
    }
    const w = (f - lo) / (hi - lo);
    const mix = (a, b) => +(a + (b - a) * w).toFixed(1);
    return { lv: mix(T[lo].lv, T[hi].lv), hp: mix(T[lo].hp, T[hi].hp), atk: mix(T[lo].atk, T[hi].atk),
      tr: mix(T[lo].tr, T[hi].tr), rel: mix(T[lo].rel, T[hi].rel), live: false };
  },

  // ── 보스 직행 테스트 스케일링 — 층 기준 정상 진행 빌드 근사 ──
  // 이미 그 수준 이상이면 건드리지 않는다 (정상 진행 중 B를 눌러도 빌드가 뒤로 가지 않게)
  _cheatScaleToFloor() {
    const p = this.player;
    const f = Dungeon.floor;
    // ══ v158 곡선 전면 재교정 — 실측 대조(봇 정상 진행 vs 직행, 1·3·5·8층, 총 100+런) 근거 ══
    // 종전 곡선은 **모든 항목에서 정상 진행보다 약했다**. 실측 직행/정상 비율:
    //   유물 0~4% · 골드 6~23% · 특성 36~53% · 공격력 21~50% · 레벨 67~78%
    // 즉 사장이 B로 치른 보스전은 정상 플레이어보다 화력 1/4, 유물 0개인 몸으로 싸운 것이고,
    // 그 위에서 잰 수치로 v155 보스 완화를 결정했다. 도구가 밸런스 판단을 오염시킨 세 번째 사례다.
    // 아래 계수는 전부 실측 중앙값에서 역산했다 (괄호: f=1/3/5/8 산출 → 실측):
    if (!p) return;
    // ★ v171 (사장 제보 "보스로 바로가는데 레벨이 그대로인데?") — 결함 둘을 함께 고친다.
    //  ① **기준선을 층 입구에서 쟀는데 B는 층 끝(보스방)으로 보낸다.**
    //     normRef는 `roomIndex===1`(층에 막 들어선 순간)에 기록된다. 1층 입구의 정상 레벨은
    //     당연히 1이다 — 그래서 1층에서 B를 누르면 targetLv 1 → 아무 일도 안 일어났다.
    //     정상 플레이어가 **그 층의 보스와 싸울 때**의 몸은 다음 층 입구에 가깝다.
    //     → f와 f+1 사이 0.8 지점을 기준으로 삼는다 (보스 보상 직전)
    //  ② **레벨 가드가 전부를 막았다.** `level >= targetLv`면 특성·유물·화력까지 통째로 건너뛰었다.
    //     축별로 "낮추지 않는다"만 지키면 되지, 하나가 충족됐다고 나머지를 포기할 이유가 없다
    const refA = this._normalRef(f, p.classId);
    const refB = this._normalRef(f + 1, p.classId);
    const mix = (a, b) => a + (b - a) * 0.8;
    const ref = {
      lv: mix(refA.lv, refB.lv), hp: mix(refA.hp, refB.hp), atk: mix(refA.atk, refB.atk),
      tr: mix(refA.tr, refB.tr), rel: mix(refA.rel, refB.rel), live: refA.live && refB.live, n: refA.n,
    };
    const targetLv = Math.max(1, Math.round(ref.lv));
    // v165 (사장 제보 "체력도 넘치고" · F9 실측 3층 HP14 vs 정상 6):
    //  ★ preHp를 **현재** maxHp로 잡아서, B를 누를 때마다 hpTarget이 그 위에 다시 쌓였다.
    //    1층에서 B → 6+1=7, 2층에서 B → 7+1=8, 3층에서 B → 8+2=10 … 누를수록 영구 상승.
    //    사장이 층마다 B를 누르며 테스트하니 3층에서 HP 14(정상 6의 2.3배)가 나왔다.
    //    v153에서 특성 축의 연쇄 B 폭주를 고쳤는데, **HP 축에 같은 병이 남아 있었다.**
    //  → 첫 호출 시점의 HP를 기준선으로 고정한다. 이후 B는 같은 목표치로 수렴할 뿐 쌓이지 않는다
    if (p._cheatBaseHp == null) p._cheatBaseHp = p.maxHp;
    const preHp = p._cheatBaseHp;
    this.level = Math.max(this.level, targetLv); // 빌드를 낮추지 않는다
    this.xp = 0; this.xpNext = Math.round(40 * Math.pow(1.25, targetLv));
    // HP — **직업 기본치 기준 상대 성장**. 종전은 기사 곡선(6+f/4)을 전 직업에 강제해
    // 마도사(기본 3)에게 6을 줬다: 정상 3.31 대비 181% 과다 — 사장의 "체력이 너무 많은데?"의 진짜 뿌리.
    // (v155에서 고친 건 유물이 상한을 넘긴 것뿐이었고, 곡선이 직업을 무시하는 문제는 남아 있었다)
    const hpTarget = Math.max(preHp, Math.round(ref.hp)); // 기준선 그대로 (기사 3층 7 · 궁수 3층 10)
    p.maxHp = Math.max(preHp, hpTarget);
    p.hp = p.maxHp;
    this.gold = Math.max(this.gold || 0, Math.round(25 * f * f + 40 * f)); // 65/345/825/1920 → 65/345/564/1899
    // 특성: 레벨 수만큼 태그 겹치기 휴리스틱으로 자동 픽 (진화 시너지 근사)
    // v153 (실플레이 제보: 마도사 하트 19개): v151 희귀 특성이 '희귀' 태그를 공유하자 겹치기
    // 휴리스틱이 강골×6+중갑 서약을 스스로 조립해 HP 요새를 만들었다 — 중앙값 빌드 근사라는
    // 도구의 목적에 맞게 희귀·전설은 자동 픽에서 제외하고, HP 특성은 설계 곡선 +2까지만
    const tagCount = {};
    const hpCap = hpTarget + 2; // 기준선 +2까지만 (종전 +3은 유물 편차와 겹쳐 과다로 흘렀다)
    // v153 연쇄 B 폭주 수정: 매 호출마다 전량(targetLv-1)을 새로 얹어 10층 연쇄에 특성 78개가
    // 쌓였다 (정상 ~15) — 이미 가진 수를 빼고 '차액'만 채운다. 유물도 동일
    // v155 (사장 F9 실측, 기사 1층 4연사): 겹치기 휴리스틱이 **화력을 전혀 안 챙겼다** —
    // 1·3층 자동빌드의 공격력이 기본값 1 그대로였고(=TTK 25초), 게다가 리듬을 뒤집는 공격 변형
    // (대검화 공속 ×1.8 등)까지 뽑아 봇·라이트 유저 기준 DPS가 무너졌다. 사람은 초반에 반드시
    // 화력을 한두 장 집는다 — 그 상식을 도구에 넣는다: ① 리듬 반전 특성 제외 ② 공격력 하한 보증
    const RHYTHM_FLIP = ['greatsword', 'twinbow', 'mgsnipe', 'al_catalyst']; // 중앙값 근사엔 부적합
    // 특성 수 — 종전 `targetLv-1`은 **레벨업 보상만** 세고 엘리트 방 카드(1층만 평균 3.9개)를
    // 통째로 빠뜨렸다. 실측 대조에서 정상의 36~53%에 그쳤다
    // 유물 — 종전 `floor(f/6)`은 1~5층 전 구간에서 **0개**를 뱉었다. 정상은 1층조차 최소 1개이고
    // (49런 중 0개 0회) 8층이면 24개다. 유물은 화력·생존에 직접 붙는 축이라 이게 빠지면
    // 빌드의 절반이 사라진다 — 실측 직행/정상 비율 0~4%로 전 항목 중 최악이었다
    const wantRelics = Math.max(0, Math.round(ref.rel) - p.relics.length); // 기준선 (기사 3층 7 · 종전 공식은 9)
    for (let i = 0; i < wantRelics; i++) {
      const rolled = rollRelics(p, 1, true);
      if (rolled.length) applyRelic(p, rolled[0]); // applyRelic이 relics 목록 push까지 담당
      else break; // 풀 고갈
    }
    // 공격력 하한 — 유물 뒤, 일반 특성 앞. 유물이 화력의 상당 부분을 담당하므로(수집가 등)
    // 유물보다 앞에 두면 힘 단련이 이중으로 쌓이고, 특성 채우기보다 뒤에 두면 예산을 넘긴다
    // 기준선 화력. 종전 공식(f*2.4-0.5)은 직업을 무시해 **궁수 3층에 공7**을 줬다 (실측 2 — 3.5배)
    const atkTarget = Math.max(1, Math.round(ref.atk));
    const might = TRAITS.find((t) => t.id === 'atk');
    let guard = 0;
    // v173: 비교도 **빌드 화력**으로. 종전엔 currentAtk()라, 현상금8(검은 초 +4)이나
    // 다친 상태(관의 못)면 도구가 "이미 충분하다"고 판단해 화력을 아예 안 줬다 —
    // 기준선을 buildAtk로 바꾼 지금 그대로 두면 사과와 오렌지를 비교하게 된다
    while (might && p.buildAtk() < atkTarget && guard++ < 12 &&
           (p.traits.filter((x) => x === 'atk').length < (might.max || 8) || p.flags.unbound)) {
      applyTrait(p, might);
    }
    // v165 순서 교정: 유물 → 화력 → **남은 특성**. 종전엔 특성을 먼저 채운 뒤 화력 보정이
    // 그 위에 힘 단련을 더 얹어, 예산 11장짜리가 16장으로 불었다 (검증에서 발각).
    // 화력 보정도 결국 특성이므로 같은 예산 안에서 센다
    const wantTraits = Math.max(0, Math.round(ref.tr) - p.traits.length); // 기준선 (기사 3층 11 · 종전 공식은 17을 줬다)
    for (let i = 0; i < wantTraits; i++) {
      // v158: 희귀 재허용 — v153에서 전면 배제했으나 정상 빌드의 약 30%가 희귀다(8층 실측 12장).
      // 배제의 원래 목적(HP 요새)은 v157의 중갑 상한·등급 공명 제거 + 아래 최종 클램프가 담당한다
      const cards = rollTraitCards(p, 3).filter((c) => !c.legend && !RHYTHM_FLIP.includes(c.flag));
      if (!cards.length) continue;
      let best = null, bs = -1;
      for (const c of cards) {
        if ((c.id === 'hp' || c.id === 'heavyplate') && p.maxHp >= hpCap) continue; // HP 상한
        // v166: 화력도 상한을 둔다. 순서를 유물→화력→특성으로 바꾼 뒤,
        // 마지막 특성 채우기가 힘 단련을 더 집어 기준선을 넘겼다 (궁수 3층 목표 공2에 공6)
        if (c.id === 'atk' && p.buildAtk() >= atkTarget) continue;
        const s = (tagCount[c.tag] || 0) + (c.cls ? 0.5 : 0);
        if (s > bs) { bs = s; best = c; }
      }
      if (!best) continue;
      applyTrait(p, best);
      if (best.tag !== '스탯') tagCount[best.tag] = (tagCount[best.tag] || 0) + 1;
    }
    // ★ 최종 HP 클램프 (v155) — 사장이 본 '하트 19개'의 진짜 뿌리.
    // v153의 hpCap은 **특성 루프에만** 걸려 있었고, 그 뒤 유물(마르타의 목걸이 +2, 심장 조각 +1,
    // 황금 심장 +1 등)이 상한 밖으로 밀어올렸다 — 새 세이브 35층 58회 중 16회 초과, 최댓값 정확히 19.
    // 유물 풀이 얇은 **깨끗한 세이브(=신규 테스터의 기본 상태)에서 가장 자주 터진다**.
    // 단, 원래 갖고 있던 HP는 깎지 않는다 (빌드 하향 금지 원칙 유지)
    p.maxHp = Math.min(p.maxHp, Math.max(hpCap, preHp));
    p.hp = Math.min(p.hp, p.maxHp);
    // v165: 이 판이 치트 빌드라는 사실과 **정상치와의 격차**를 화면에 띄운다.
    // 도구가 조용히 다른 게임을 쥐여주면, 그 위에서 내리는 모든 난이도 판단이 오염된다
    // (v151·v153·v155·v158·v165 — 다섯 번째다). 이제 눈으로 확인할 수 있어야 한다
    this.banner = {
      text: `⚑ 치트 빌드 ${f}층 HP${p.maxHp}/공${p.buildAtk().toFixed(1)}`
        + (p.currentAtk() > p.buildAtk() ? `(지금 ${p.currentAtk().toFixed(1)})` : '')
        + `/특${p.traits.length}/유${p.relics.length}`
        + `  ← 기준 HP${ref.hp}/공${ref.atk}/특${Math.round(ref.tr)}/유${Math.round(ref.rel)}`
        + (ref.live ? ` (내 실플레이 ${ref.n}판 기준)` : ' (실측 대역표)'),
      life: 4.5, maxLife: 4.5, color: '#f7b32b',
    };
    // 31층+: 스킬 개조 소지, 10층+: 처형 선고
    if (f >= 31 && !p.skillMod) {
      const mods = SKILL_MODS[p.classId] || [];
      if (mods.length) p.skillMod = mods[Math.floor(Math.random() * mods.length)].id;
    }
    if (f >= 11) { const want = f >= 21 ? 2 : 1; if ((p.ult || 0) < want) { p.ult = want; p.ultGauge = p.ultGauge || 0; } } // 연쇄 시 2강 승급도 정상 반영
    this.banner = { text: `⚙ 보스 직행 세팅 — Lv.${targetLv} · 특성 ${p.traits.length} · 유물 ${p.relics.length}`, life: 2.2, maxLife: 2.2, color: '#5ce0e6' };
  },

  // ── 설정 패널 (O) — 음량/화면 흔들림/대미지 숫자/섬광. 거점·일시정지 공용 ──
  // 전체화면 토글 — 데스크톱(Electron)은 창 전체화면, 웹은 브라우저 Fullscreen API
  toggleFullscreen() {
    if (window.desktop && window.desktop.setFullscreen) {
      this._fsOn = !this._fsOn;
      window.desktop.setFullscreen(this._fsOn);
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  },

  _tickSettings() {
    const o = Meta.data.opts;
    const ROWS = 8;
    this._setRow = this._setRow || 0;
    if (Input.pressed('Escape', 'KeyO')) {
      this.showSettings = false;
      Meta.save();
      AudioSys.pickup();
      return;
    }
    if (Input.pressed('ArrowUp', 'KeyW')) { this._setRow = (this._setRow + ROWS - 1) % ROWS; AudioSys.shard(); }
    if (Input.pressed('ArrowDown', 'KeyS')) { this._setRow = (this._setRow + 1) % ROWS; AudioSys.shard(); }
    const dir = (Input.pressed('ArrowLeft', 'KeyA') ? -1 : 0) + (Input.pressed('ArrowRight', 'KeyD') ? 1 : 0);
    if (!dir) return;
    const vol = (v) => Math.round(Math.min(1, Math.max(0, v + dir * 0.1)) * 10) / 10;
    const tri = (v) => Math.min(1, Math.max(0, (v ?? 1) + dir * 0.5)); // 0 / 0.5 / 1 세 단계
    // 순서는 drawSettings의 rows와 1:1로 맞춰야 한다 (v162: 가호가 최상단)
    if (this._setRow === 0) o.grace = tri(o.grace ?? 0); // 망자의 가호 (v145) — 선택형 어시스트
    else if (this._setRow === 1) o.bgm = vol(o.bgm ?? 0.8);
    else if (this._setRow === 2) o.sfx = vol(o.sfx ?? 0.8);
    else if (this._setRow === 3) o.shake = tri(o.shake);
    else if (this._setRow === 4) o.dmgNum = o.dmgNum ? 0 : 1;
    else if (this._setRow === 5) o.flash = tri(o.flash);
    else if (this._setRow === 6) { this.toggleFullscreen(); return; }
    else if (this._setRow === 7) o.gore = tri(o.gore); // 죽음 연출 수위 — 심의·취향 대응
    AudioSys.applyOpts();
    AudioSys.pickup(); // 새 음량이 곧장 귀로 확인된다
    Meta.save();
  },

  _tickHub() {
    if (Input.pressed('KeyM')) { AudioSys.toggleMute(); Meta.data.muted = AudioSys.muted; Meta.save(); }

    // 매뉴얼 (H 또는 /) — 거점에서도 열람 가능
    if (Input.pressed('KeyH', 'Slash')) {
      this.showManual = ((this.showManual || 0) + 1) % 3;
      AudioSys.pickup();
    }
    if (this.showManual) {
      if (Input.pressed('Escape')) this.showManual = 0;
      return; // 매뉴얼이 열려 있는 동안 거점 입력 잠금
    }

    // 설정 (O) — 열려 있는 동안 거점 입력 잠금 (좌우 키가 열기 조절과 겹치지 않게)
    if (this.showSettings) { this._tickSettings(); return; }
    if (Input.pressed('KeyO')) {
      this.showSettings = true;
      this._setRow = 0;
      AudioSys.pickup();
      return;
    }

    // 테스트 모드 토글 (T)
    if (Input.pressed('KeyT')) {
      this.testMode = !this.testMode;
      AudioSys[this.testMode ? 'buy' : 'deny']();
    }
    if (this.testMode) this._tickCheats();

    // 열기(고난이도) 조절 — 첫 정복 후 해금.
    // v153 (실플레이 제보 "열기 4~5인데 고른 적 없다"): 전역 ←→가 열기를 몰래 올려 영구 저장되던
    // 스텔스 조절 버그 — 로드아웃 줄에 마우스를 올린 동안만 조절된다
    if (Meta.heatUnlocked()) {
      const lr = HUD.loadoutLineRect();
      const hovering = Input.mouse.x >= lr.x && Input.mouse.x <= lr.x + lr.w &&
                       Input.mouse.y >= lr.y && Input.mouse.y <= lr.y + lr.h;
      if (hovering) {
        if (Input.pressed('ArrowLeft')) { Meta.setHeat(Meta.data.heat - 1); AudioSys.orb(); }
        if (Input.pressed('ArrowRight')) { Meta.setHeat(Meta.data.heat + 1); AudioSys.orb(); }
      }
      // v154: 항상 보이는 −/+ 버튼 — "마우스 올리고 화살표"는 라이트 유저에게 발견되지 않았다
      if (Input.mouse.justDown) {
        for (const b of HUD.heatBtnRects()) {
          if (Input.mouse.x >= b.x && Input.mouse.x <= b.x + b.w && Input.mouse.y >= b.y && Input.mouse.y <= b.y + b.h) {
            Meta.setHeat(Meta.data.heat + b.d);
            AudioSys.orb();
          }
        }
      }
      // 세부 은닉 (난이도 개편): 골라담기 폐지 — 단계만 고른다. 무엇이 강해지는지는 몸으로 알게 된다
    }

    const rects = HUD.hubButtonRects();
    let act = -1;
    // 세이브 보호: 중단된 런이 있으면 Space/Enter는 '이어하기' — 타이틀을 Space로 넘기고
    // 한 번 더 누르면 세이브가 지워지며 새 런이 시작되던 함정 (실플레이 제보: 이어하기가 없어짐)
    const hasSave = !!this.loadRunSave();
    if (Input.pressed('Digit1') || (!hasSave && Input.pressed('Space', 'Enter'))) act = 0;
    if (hasSave && Input.pressed('Space', 'Enter')) {
      AudioSys.buy();
      this.resumeRun();
      return;
    }
    if (Input.pressed('Digit2')) act = 1;
    if (Input.pressed('Digit3')) act = 2;
    if (Input.pressed('Digit4')) act = 3;
    if (Input.mouse.justDown) {
      rects.forEach((r, i) => {
        if (Input.mouse.x >= r.x && Input.mouse.x <= r.x + r.w &&
            Input.mouse.y >= r.y && Input.mouse.y <= r.y + r.h) act = i;
      });
    }
    // 이어하기 (C 또는 버튼 클릭): 중단된 런 스냅샷 복원
    {
      const rb = HUD.resumeButtonRect();
      const clickResume = Input.mouse.justDown && !this._pactEdit &&
        Input.mouse.x >= rb.x && Input.mouse.x <= rb.x + rb.w &&
        Input.mouse.y >= rb.y && Input.mouse.y <= rb.y + rb.h;
      if ((Input.pressed('KeyC') || clickResume) && this.loadRunSave()) {
        AudioSys.buy();
        this.resumeRun();
        return;
      }
    }
    if (act === 0) { AudioSys.buy(); this.clearRunSave(); this.restart(); }
    else if (act === 1) { AudioSys.pickup(); this.state = 'altar'; }
    else if (act === 2) { AudioSys.pickup(); this.state = 'classes'; }
    else if (act === 3) { AudioSys.pickup(); this.state = 'codex'; }

    // 오늘의 탑 (D): 날짜 기반 고정 시드 — 오늘은 모두가 같은 던전에 도전한다
    if (Input.pressed('KeyD')) this.startDaily();
    if (Input.pressed('F9')) this.copyPlayReport(); // 플레이 리포트 (v144)
    // 보스 러시 (B): 첫 정복 후 해금
    if (Input.pressed('KeyB') && Meta.data.wins > 0) { this.clearRunSave(); this.startBossRush(); }
    // 왕도 직행 (G): 왕좌 정복 후 해금 — 3막부터 1시간 안에 왕까지
    if (Input.pressed('KeyG') && (Meta.data.epilogueSeen || Meta.data.bestFloor >= 50)) this.startExpress();
  },

  // 보스 러시 (B): 10보스 연속전 — 방·탐색 없이 보스전만. 시작 특성 4장, 보스마다 특성 2장 + 유물
  startBossRush() {
    this.restart();
    this.state = 'play'; this.route = null; this.routeCards = []; // 원수 연전엔 진군로가 없다
    this.bossRush = true;
    this.clearRunSave();
    Dungeon.floor = 1;
    Dungeon.roomIndex = Dungeon.totalRooms; // 문 로직이 곧장 보스로 향하도록
    Dungeon.build('boss');
    this.pendingChoices = 4; // 시작 빌드 — 맨몸으로 카론과 싸울 수는 없다
    this.openTraitChoice('elite');
    AudioSys.roar();
    this.banner = { text: '원수 연전 — 열 명의 원수가 연이어 온다', life: 3, maxLife: 3, color: '#e43b44' };
  },

  // 왕도 직행 (G): 정복 후 해금 — 3막(21층)부터, 2막 종료급 시작 빌드 지급.
  // 페이싱 감사: 풀런 2시간+가 부담인 유저에게 '오늘 밤 왕까지'를 1시간 안으로
  startExpress() {
    this.restart();
    this.clearRunSave();
    this.expressRun = true;
    this.route = null; this.routeCards = []; // 직행에 갈림길은 없다 (보스 러시와 동일)
    this.act = 3;
    Dungeon.floor = 21;
    Dungeon.roomIndex = 1;
    Dungeon.build('combat');
    const p = this.player;
    // 2막 종료급 근사 (계측 보정: 특성8+유물2+HP9는 21층에서 3분 15사망 — 정상 밴드는 1~2):
    // 특성 14장 + 유물 4(레어+ 2 보장, 유품 1 포함) + 심장 +5 + 레벨 보정 + 노잣돈
    p.maxHp += 5; p.hp = p.maxHp;
    p.bonusAtk = (p.bonusAtk || 0) + 3; // 계측 2차 보정: 첫 보스(가로크) 8사망 — 특성 운에 안 맡기는 기본 딜
    this.level = 18; this.xpNext = Math.round(this.xpNext * 7); // 레벨 커브 이어붙임 (21층 XP가 저레벨을 폭주시키지 않게)
    this.gold = 200;
    const pool = RELICS.filter((r) => Meta.isUnlocked(r) && (!r.heir || r.heir === p.classId));
    const rares = pool.filter((r) => r.rarity !== 'common');
    for (let k = 0; k < 2; k++) {
      const cand = rares.filter((r) => !p.relics.includes(r.id));
      const pick = cand[Math.floor(Math.random() * cand.length)];
      if (pick) this.acquireRelic(pick);
    }
    const heirs = pool.filter((r) => r.heir === p.classId && !p.relics.includes(r.id));
    if (heirs.length) this.acquireRelic(heirs[Math.floor(Math.random() * heirs.length)]);
    const rest = pool.filter((r) => !p.relics.includes(r.id));
    const last = rest[Math.floor(Math.random() * rest.length)];
    if (last) this.acquireRelic(last);
    this.pendingChoices = 16;
    this.openTraitChoice('elite');
    AudioSys.roar();
    this.banner = { text: '왕도 직행 — 영지의 문턱에서 시작한다. 왕좌까지 세 막.', life: 3, maxLife: 3, color: '#ffd866' };
  },

  startDaily() {
    const now = new Date();
    const key = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    this.restart(key);
    this.dailyRun = true;
    this.dailyKey = key;
    AudioSys.buy();
    this.banner = {
      text: `오늘의 수배령 ${String(key).slice(4, 6)}/${String(key).slice(6)} — 모두에게 같은 밤`,
      life: 3, maxLife: 3, color: '#f7b32b',
    };
  },

  _tickCodex() {
    if (Input.pressed('Escape', 'Digit0', 'Backspace')) { this.state = 'hub'; return; }
    const prevTab = this.codexTab;
    if (Input.pressed('Digit1')) this.codexTab = 0;
    if (Input.pressed('Digit2')) this.codexTab = 1;
    if (Input.pressed('Digit3')) this.codexTab = 2;
    if (Input.pressed('Digit4')) this.codexTab = 3;
    if (Input.pressed('Tab')) { this.codexTab = (this.codexTab + 1) % 4; AudioSys.orb(); } // 패드 어깨버튼 대용
    if (this.codexTab !== prevTab) { this.codexPage = 0; this.codexSel = 0; }

    // ── 커서 선택 (v187) ──────────────────────────────────────────────
    // 종전엔 사연이 **마우스 호버로만** 열렸다. 폰에는 호버가 없다 — 사장은 사연을
    // 볼 방법이 아예 없었다. 방향키/패드 d-pad로 칸을 고르고, 화면 끝에서 쪽이 넘어간다
    const g = HUD.codexGeom(this.codexTab);
    if (g) {
      const move = (dx, dy) => {
        let s = this.codexSel || 0;
        const col = s % g.cols, row = Math.floor(s / g.cols);
        if (dx) {
          if (col + dx < 0) {                       // 왼쪽 끝 → 이전 쪽 오른쪽 끝
            if ((this.codexPage || 0) > 0) { this.codexPage--; s = row * g.cols + (g.cols - 1); }
          } else if (col + dx >= g.cols) {          // 오른쪽 끝 → 다음 쪽 왼쪽 끝
            this.codexPage = (this.codexPage || 0) + 1; s = row * g.cols;
          } else s += dx;
        }
        if (dy) {
          const nr = row + dy;
          if (nr < 0) { if ((this.codexPage || 0) > 0) { this.codexPage--; s = (g.rows - 1) * g.cols + col; } }
          else if (nr >= g.rows) { this.codexPage = (this.codexPage || 0) + 1; s = col; }
          else s += dy * g.cols;
        }
        this.codexSel = Math.max(0, s);
        AudioSys.orb();
      };
      if (Input.pressed('ArrowLeft', 'KeyA')) move(-1, 0);
      if (Input.pressed('ArrowRight', 'KeyD')) move(1, 0);
      if (Input.pressed('ArrowUp', 'KeyW')) move(0, -1);
      if (Input.pressed('ArrowDown', 'KeyS')) move(0, 1);
      if (Input.pressed('KeyQ')) { this.codexPage = Math.max(0, (this.codexPage || 0) - 1); this.codexSel = 0; AudioSys.orb(); }
      if (Input.pressed('KeyE')) { this.codexPage = (this.codexPage || 0) + 1; this.codexSel = 0; AudioSys.orb(); }
    } else {
      // 증거 탭은 격자가 없다 — 종전대로 쪽 넘김만
      if (Input.pressed('ArrowLeft', 'KeyA', 'KeyQ')) { this.codexPage = Math.max(0, (this.codexPage || 0) - 1); AudioSys.orb(); }
      if (Input.pressed('ArrowRight', 'KeyD', 'KeyE')) { this.codexPage = (this.codexPage || 0) + 1; AudioSys.orb(); }
    }

    if (Input.mouse.justDown) {
      const back = HUD.backButtonRect();
      if (Input.mouse.x >= back.x && Input.mouse.x <= back.x + back.w &&
          Input.mouse.y >= back.y && Input.mouse.y <= back.y + back.h) {
        this.state = 'hub';
        return;
      }
      HUD.codexTabRects().forEach((r, i) => {
        if (Input.mouse.x >= r.x && Input.mouse.x <= r.x + r.w &&
            Input.mouse.y >= r.y && Input.mouse.y <= r.y + r.h) {
          this.codexTab = i;
          this.codexSel = 0;
          AudioSys.orb();
        }
      });
      // 터치 = 탭해서 고르기. 폰에는 호버가 없으므로 이 경로가 유일한 선택 수단이다
      if (g) {
        for (let i = 0; i < g.cols * g.rows; i++) {
          const r = HUD.codexCellRect(this.codexTab, i);
          if (Input.mouse.x >= r.x && Input.mouse.x <= r.x + r.w &&
              Input.mouse.y >= r.y && Input.mouse.y <= r.y + r.h) {
            this.codexSel = i;
            AudioSys.orb();
            break;
          }
        }
      }
    }
  },

  _tickAltar() {
    if (Input.pressed('Escape', 'Digit0', 'Backspace')) { this.state = 'hub'; return; }
    const list = HUD.altarList(); // 원한의 비석 + (정복 후) 깨어진 비석
    let act = -1;
    for (let i = 0; i < Math.min(9, list.length); i++) {
      if (Input.pressed('Digit' + (i + 1))) act = i;
    }
    const rects = HUD.altarRowRects();
    const back = HUD.backButtonRect();
    if (Input.mouse.justDown) {
      if (Input.mouse.x >= back.x && Input.mouse.x <= back.x + back.w &&
          Input.mouse.y >= back.y && Input.mouse.y <= back.y + back.h) {
        this.state = 'hub';
        return;
      }
      rects.forEach((r, i) => {
        if (Input.mouse.x >= r.x && Input.mouse.x <= r.x + r.w &&
            Input.mouse.y >= r.y && Input.mouse.y <= r.y + r.h) act = i;
      });
    }
    if (act >= 0 && list[act]) {
      if (Meta.buy(list[act].id)) AudioSys.buy();
      else AudioSys.deny();
    }
  },

  _tickClasses() {
    if (Input.pressed('Escape', 'Digit0', 'Backspace')) { this.state = 'hub'; return; }
    // 계승 (v127): 첫 정복 후 ←→로 선택 직업의 형상을 고른다 — 기본 / 형상 1 / 형상 2
    if (Meta.data.wins > 0 && (Input.pressed('ArrowLeft', 'KeyQ') || Input.pressed('ArrowRight', 'KeyE'))) {
      const dir = Input.pressed('ArrowLeft', 'KeyQ') ? -1 : 1;
      const cid = Meta.data.cls;
      const n = (FORMS[cid] || []).length + 1;
      Meta.data.forms[cid] = (((Meta.data.forms[cid] || 0) + dir) % n + n) % n;
      Meta.save();
      AudioSys.orb();
    }
    let act = -1;
    const ids = Object.keys(CLASSES);
    for (let i = 0; i < ids.length; i++) {
      if (Input.pressed('Digit' + (i + 1))) act = i;
    }
    const rects = HUD.cardRects(ids.length);
    const back = HUD.backButtonRect();
    if (Input.mouse.justDown) {
      if (Input.mouse.x >= back.x && Input.mouse.x <= back.x + back.w &&
          Input.mouse.y >= back.y && Input.mouse.y <= back.y + back.h) {
        this.state = 'hub';
        return;
      }
      rects.forEach((r, i) => {
        if (Input.mouse.x >= r.x && Input.mouse.x <= r.x + r.w &&
            Input.mouse.y >= r.y && Input.mouse.y <= r.y + r.h) act = i;
      });
    }
    if (act >= 0) {
      const id = ids[act];
      if (Meta.classUnlocked(id)) {
        Meta.selectClass(id);
        AudioSys.pickup();
      } else {
        AudioSys.deny(); // 조건 해금 — 카드에 적힌 조건을 달성하면 자동으로 열린다
      }
    }
  },

  _handleCardInput(cards, pick) {
    for (let i = 0; i < cards.length; i++) {
      if (Input.pressed('Digit' + (i + 1))) { pick(i); return; }
    }
    // 오클릭 방지: 카드가 열린 직후 잠깐은 마우스 클릭 무시
    // (전투 중 연타하던 클릭이 카드를 잘못 고르는 것을 막는다)
    if (this.choiceLockT > 0) return;
    if (Input.mouse.justDown) {
      const rects = HUD.cardRects(cards.length);
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (Input.mouse.x >= r.x && Input.mouse.x <= r.x + r.w &&
            Input.mouse.y >= r.y && Input.mouse.y <= r.y + r.h) {
          pick(i);
          return;
        }
      }
    }
  },
};
