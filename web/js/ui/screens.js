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
    // 어디서나: O 파편 +500 / I 도감 완성 / Y 직업·열기 해금
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
      Meta.data.classes = { knight: true, archer: true, mage: true };
      Meta.data.wins = Math.max(1, Meta.data.wins);
      Meta.data.bestFloor = 5;
      Meta.save();
      AudioSys.relic('epic');
      this.banner = { text: '직업·열기 모드 해금!', life: 1.5, maxLife: 1.5 };
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
      if (Dungeon.floor >= 10 && !this.endless) {
        this.endRun(true);
        this.state = 'victory';
      } else {
        this.state = 'transition';
        this.transition = { phase: 'out', t: 0, type: 'nextfloor' };
      }
    }
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

    // 테스트 모드 토글 (T)
    if (Input.pressed('KeyT')) {
      this.testMode = !this.testMode;
      AudioSys[this.testMode ? 'buy' : 'deny']();
    }
    if (this.testMode) this._tickCheats();

    // 열기(고난이도) 조절 — 첫 정복 후 해금
    if (Meta.heatUnlocked()) {
      if (Input.pressed('ArrowLeft')) { Meta.setHeat(Meta.data.heat - 1); AudioSys.orb(); }
      if (Input.pressed('ArrowRight')) { Meta.setHeat(Meta.data.heat + 1); AudioSys.orb(); }
      if (Input.mouse.justDown) {
        const [minus, plus] = HUD.heatButtonRects();
        const mx = Input.mouse.x, my = Input.mouse.y;
        if (mx >= minus.x && mx <= minus.x + minus.w && my >= minus.y && my <= minus.y + minus.h) {
          Meta.setHeat(Meta.data.heat - 1); AudioSys.orb();
        }
        if (mx >= plus.x && mx <= plus.x + plus.w && my >= plus.y && my <= plus.y + plus.h) {
          Meta.setHeat(Meta.data.heat + 1); AudioSys.orb();
        }
      }
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
    if (act === 0) { AudioSys.buy(); this.restart(); }
    else if (act === 1) { AudioSys.pickup(); this.state = 'altar'; }
    else if (act === 2) { AudioSys.pickup(); this.state = 'classes'; }
    else if (act === 3) { AudioSys.pickup(); this.state = 'codex'; }

    // 오늘의 탑 (D): 날짜 기반 고정 시드 — 오늘은 모두가 같은 던전에 도전한다
    if (Input.pressed('KeyD')) this.startDaily();
  },

  startDaily() {
    const now = new Date();
    const key = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    this.restart(key);
    this.dailyRun = true;
    this.dailyKey = key;
    AudioSys.buy();
    this.banner = {
      text: `오늘의 탑 ${String(key).slice(4, 6)}/${String(key).slice(6)} — 모두에게 같은 던전`,
      life: 3, maxLife: 3, color: '#f7b32b',
    };
  },

  _tickCodex() {
    if (Input.pressed('Escape', 'Digit0', 'Backspace')) { this.state = 'hub'; return; }
    if (Input.pressed('Digit1')) this.codexTab = 0;
    if (Input.pressed('Digit2')) this.codexTab = 1;
    if (Input.pressed('Digit3')) this.codexTab = 2;
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
      } else if (Meta.unlockClass(id)) {
        AudioSys.relic('epic');
      } else {
        AudioSys.deny();
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
