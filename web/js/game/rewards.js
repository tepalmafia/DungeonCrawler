// 보상·성장 — XP/레벨업 카드/유물 선택/런 정산.
// main.js에서 Object.assign(Game, GameRewards)으로 Game에 합쳐진다.
const GameRewards = {
  // 런 종료 정산 — 영혼 파편 지급 (1회만)
  endRun(victory) {
    if (this.runEnded) return;
    this.runEnded = true;
    if (this.endless) {
      // 무한 모드: 10층 정산에서 이미 받은 몫을 뺀 초과분만 지급
      this.shardsEarned = Meta.endlessRun(
        Dungeon.floor, Dungeon.roomIndex, this.kills, this.heat,
        this.shardsPaid, this.kills - this.killsPaid);
    } else {
      this.shardsEarned = Meta.endRun(Dungeon.floor, Dungeon.roomIndex, this.kills, victory, this.heat);
    }
    this.shardAnimT = 0;
    // 오클릭 방지: 전투 중 연타하던 클릭이 정산 화면을 바로 넘기지 않게 잠시 입력 잠금
    this.overLockT = 1.2;
  },

  // 무한 모드 진입 — 승리 화면에서 C: 정산은 유지하고 11층으로 계속 내려간다
  continueEndless() {
    this.endless = true;
    this.runEnded = false;
    this.shardsPaid = (this.shardsPaid || 0) + this.shardsEarned;
    this.killsPaid = this.kills;
    this.shardsEarned = 0;
    this.state = 'play';
    this.banner = { text: '심연 회랑 — 끝없는 하강이 시작된다', life: 2.5, maxLife: 2.5, color: '#b13ae0' };
    AudioSys.roar();
    Dungeon.nextFloor();
  },

  onBossDead() {
    this.arrows = [];
    this.rings = [];
    if (Dungeon.floor >= 10 && !this.endless) {
      this.endRun(true);
      this.state = 'victory';
      Renderer.shake(8, 0.6);
      AudioSys.gameover();
      setTimeout(() => AudioSys.levelup(), 500);
      return;
    }
    this.banner = { text: `${Dungeon.floor}층 클리어!`, life: 2.0, maxLife: 2.0 };
    Renderer.shake(8, 0.6);
    AudioSys.chest();
    this.bossRewardT = 1.2; // 잠시 후 유물 선택
  },

  gainXp(v) {
    this.xp += Math.round(v * this.player.xpMul);
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      // 완만한 커브: 초반 과속을 막고 심층(6~10층)에서도 성장이 이어지게 한다
      this.xpNext = Math.round(this.xpNext * 1.24);
      this.pendingChoices++;
    }
    if (this.pendingChoices > 0 && this.state === 'play') {
      this.openTraitChoice('levelup');
    }
  },

  traitCardCount() {
    return Math.min(4, 3 + (this.player.rflags.kingseal ? 1 : 0) + Meta.lvl('choice'));
  },

  openTraitChoice(reason) {
    this.choiceReason = reason;
    const n = this.traitCardCount();
    this.traitCards = rollTraitCards(this.player, n);
    if (this.traitCards.length === 0) { this.pendingChoices = 0; return; }
    this.state = 'levelup';
    this.choiceLockT = 0.4; // 오클릭 방지
    AudioSys.levelup();
    Particles.burst(this.player.x, this.player.y, {
      count: 16, colors: ['#2ec4b6', '#a9fff7'], speed: 130, life: 0.6, size: 3, gravity: -80,
    });
  },

  pickTrait(i) {
    const t = this.traitCards[i];
    if (!t) return;
    applyTrait(this.player, t);
    Meta.codexTrait(t.id);
    Particles.text(this.player.x, this.player.y - 30, t.name + '!', { color: t.color, size: 16 });
    this.pendingChoices = Math.max(0, this.pendingChoices - 1);
    if (this.pendingChoices > 0) {
      const n = this.traitCardCount();
      this.traitCards = rollTraitCards(this.player, n);
      this.choiceLockT = 0.35; // 연속 선택 사이에도 잠금 (더블클릭 방지)
      if (this.traitCards.length === 0) { this.pendingChoices = 0; this.state = 'play'; }
    } else {
      this.state = 'play';
    }
  },

  openRelicChoice() {
    this.relicCards = rollRelics(this.player, 3, true);
    if (this.relicCards.length === 0) {
      this._afterBossReward();
      return;
    }
    this.state = 'relic';
    this.choiceLockT = 0.4; // 오클릭 방지
    AudioSys.chest();
  },

  pickRelic(i) {
    const r = this.relicCards[i];
    if (!r) return;
    this.acquireRelic(r);
    this.state = 'play';
    if (this._relicSource === 'legacy') {
      this._relicSource = null; // 시작 유물(유산 각인)은 보상 흐름 없이 바로 시작
      return;
    }
    this._afterBossReward();
  },

  _afterBossReward() {
    World.openDoors([{ type: 'nextfloor', ...ROOM_META.nextfloor }]);
    // 왕의 인장 즉시 특성
    if (this.pendingChoices > 0) this.openTraitChoice('levelup');
  },

  acquireRelic(relic) {
    applyRelic(this.player, relic);
    Meta.codexRelic(relic.id);
    const rar = RARITY[relic.rarity];
    this.banner = { text: `[${rar.label}] ${relic.name}`, life: 2.0, maxLife: 2.0, color: rar.color };
    Particles.text(this.player.x, this.player.y - 30, relic.name, { color: rar.color, size: 17 });
    AudioSys.relic(relic.rarity);
    Particles.burst(this.player.x, this.player.y, {
      count: relic.rarity === 'legendary' ? 30 : 14,
      colors: [rar.color, '#ffffff'], speed: 150, life: 0.6, size: 3, gravity: -100,
    });
    if (relic.flag === 'kingseal') {
      this.pendingChoices++;
    }
  },

};
