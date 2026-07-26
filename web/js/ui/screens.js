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

  // ── 설정 패널 (O) — 음량/화면 흔들림/대미지 숫자/섬광. 거점·일시정지 공용 ──
  _tickSettings() {
    const o = Meta.data.opts;
    const ROWS = 5;
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
    if (this._setRow === 0) o.bgm = vol(o.bgm ?? 0.8);
    else if (this._setRow === 1) o.sfx = vol(o.sfx ?? 0.8);
    else if (this._setRow === 2) o.shake = tri(o.shake);
    else if (this._setRow === 3) o.dmgNum = o.dmgNum ? 0 : 1;
    else if (this._setRow === 4) o.flash = tri(o.flash);
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

    // 열기(고난이도) 조절 — 첫 정복 후 해금 (UI 개편: 칩은 로드아웃 줄 클릭 시에만)
    if (Meta.heatUnlocked()) {
      if (Input.pressed('ArrowLeft')) { Meta.setHeat(Meta.data.heat - 1); AudioSys.orb(); }
      if (Input.pressed('ArrowRight')) { Meta.setHeat(Meta.data.heat + 1); AudioSys.orb(); }
      // 세부 은닉 (난이도 개편): 골라담기 폐지 — 단계만 고른다. 무엇이 강해지는지는 몸으로 알게 된다
    }

    const rects = HUD.hubButtonRects();
    let act = -1;
    if (Input.pressed('Digit1') || Input.pressed('Space', 'Enter')) act = 0;
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
    // 보스 러시 (B): 첫 정복 후 해금
    if (Input.pressed('KeyB') && Meta.data.wins > 0) { this.clearRunSave(); this.startBossRush(); }
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
    if (this.codexTab !== prevTab) this.codexPage = 0;
    // 페이지 넘김 (←→) — 도감이 89종을 넘으며 한 화면에 다 안 들어간다
    if (Input.pressed('ArrowLeft', 'KeyA')) { this.codexPage = Math.max(0, (this.codexPage || 0) - 1); AudioSys.orb(); }
    if (Input.pressed('ArrowRight', 'KeyD')) { this.codexPage = (this.codexPage || 0) + 1; AudioSys.orb(); }
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
          AudioSys.orb();
        }
      });
    }
  },

  _tickAltar() {
    if (Input.pressed('Escape', 'Digit0', 'Backspace')) { this.state = 'hub'; return; }
    let act = -1;
    for (let i = 0; i < META_UPGRADES.length; i++) {
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
    if (act >= 0) {
      const up = META_UPGRADES[act];
      if (Meta.buy(up.id)) AudioSys.buy();
      else AudioSys.deny();
    }
  },

  _tickClasses() {
    if (Input.pressed('Escape', 'Digit0', 'Backspace')) { this.state = 'hub'; return; }
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
