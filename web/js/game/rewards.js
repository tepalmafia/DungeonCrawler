// 보상·성장 — XP/레벨업 카드/유물 선택/런 정산.
// main.js에서 Object.assign(Game, GameRewards)으로 Game에 합쳐진다.
const GameRewards = {
  // 런 종료 정산 — 영혼 파편 지급 (1회만)
  endRun(victory) {
    if (this.runEnded) return;
    this.runEnded = true;
    // 사망 리포트: 직전 런과의 비교 기준 저장 (덮어쓰기 전에 백업)
    this.prevRun = Meta.data.lastRun || null;
    Meta.data.lastRun = { floor: Dungeon.floor, level: this.level, kills: this.kills, victory: !!victory };
    // 보스 러시 기록: 도달 군주 수 + 최속 완주
    if (this.bossRush) {
      const rec = Meta.data.rushBest || { floor: 0, time: 0 };
      rec.floor = Math.max(rec.floor, Dungeon.floor - (victory ? 0 : 1));
      if (victory && (!rec.time || this.time < rec.time)) rec.time = this.time;
      Meta.data.rushBest = rec;
    }
    // 오늘의 탑 기록 (최고 층 갱신 + 도전 횟수)
    if (this.dailyRun) {
      const rec = Meta.data.daily;
      if (!rec || rec.key !== this.dailyKey) {
        Meta.data.daily = { key: this.dailyKey, floor: Dungeon.floor, kills: this.kills, victory: !!victory, runs: 1 };
      } else {
        rec.runs++;
        if (Dungeon.floor > rec.floor || (Dungeon.floor === rec.floor && this.kills > rec.kills)) {
          rec.floor = Dungeon.floor;
          rec.kills = this.kills;
        }
        rec.victory = rec.victory || !!victory;
      }
    }
    if (this.endless || this.act2) {
      // 무한 모드·2막: 1막(10층) 정산에서 이미 받은 몫을 뺀 초과분만 지급 (승수 이중 집계 방지)
      this.shardsEarned = Meta.endlessRun(
        Dungeon.floor, Dungeon.roomIndex, this.kills, this.heat,
        this.shardsPaid, this.kills - this.killsPaid);
      if (victory && this.act2 && Dungeon.floor >= 20) {
        Meta.data.act2Wins = (Meta.data.act2Wins || 0) + 1; // 2막 정복 별도 집계
        Meta.save();
      }
      this.clearRunSave(); // 2막 포함 — 런이 끝났다
    } else {
      this.shardsEarned = Meta.endRun(Dungeon.floor, Dungeon.roomIndex, this.kills, victory, this.heat,
        this.player && this.player.rflags.charm ? 1.15 : 1); // 낡은 부적: 정산 +15%
      this.clearRunSave(); // 런이 끝났다 — 이어하기 스냅샷 소멸
    }
    this.shardAnimT = 0;
    // 오클릭 방지: 전투 중 연타하던 클릭이 정산 화면을 바로 넘기지 않게 잠시 입력 잠금
    this.overLockT = 1.2;
  },

  // 무한 모드 진입 — 2막 승리 화면에서 C: 정산은 유지하고 21층으로 계속 내려간다
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

  // 2막 진입 — 1막(10층) 승리 화면에서 C: 정산은 유지하고 균사 정원(11층)으로 내려간다
  continueAct2() {
    this.act2 = true;
    this.runEnded = false;
    this.shardsPaid = (this.shardsPaid || 0) + this.shardsEarned;
    this.killsPaid = this.kills;
    this.shardsEarned = 0;
    this.state = 'play';
    this.banner = { text: '2막 — 균사 정원. 탑의 뿌리가 살아 숨쉰다', life: 2.8, maxLife: 2.8, color: '#c9d94a' };
    AudioSys.roar();
    Dungeon.nextFloor();
    this.saveRun(); // 2막도 이어하기 지원 — 진입 즉시 스냅샷
  },

  onBossDead() {
    this.arrows = [];
    this.rings = [];
    // 1막 정점(10층, 2막 미진입 시)과 2막 정점(20층+)에서 승리 정산
    if (((Dungeon.floor === 10 && !this.act2) || Dungeon.floor >= 20) && !this.endless) {
      this.endRun(true);
      // 최속 클리어 기록 (P5): 승리 화면 '신기록!' 표시용 — 1막/2막 기록 분리
      const recKey = this.act2 ? 'bestWinTime2' : 'bestWinTime';
      this._newRecord = !Meta.data[recKey] || this.time < Meta.data[recKey];
      if (this._newRecord) { Meta.data[recKey] = this.time; Meta.save(); }
      this._vicStart = undefined; // 승리 연출 타이머 리셋
      this.state = 'victory';
      Renderer.shake(8, 0.6);
      AudioSys.gameover();
      setTimeout(() => AudioSys.levelup(), 500);
      return;
    }
    // 마이크로 서사 (S3): 보스의 마지막 한마디가 우선 — '층 클리어'는 유물 화면이 대신 말해준다
    this.banner = this._lastBossOutro
      ? { text: `"${this._lastBossOutro}"`, life: 2.6, maxLife: 2.6, color: '#c9b8e8' }
      : { text: `${Dungeon.floor}층 클리어!`, life: 2.0, maxLife: 2.0 };
    this._lastBossOutro = null;
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
      this.xpNext = Math.round(this.xpNext * 1.27); // 1.24→1.27: 중반 이후 레벨 폭주 완화
      this.pendingChoices++;
    }
    this.checkEvolution(); // 개화 대기 중이었다면 Lv.12 도달 순간 진화
    if (this.pendingChoices > 0 && this.state === 'play') {
      this.openTraitChoice('levelup');
    }
  },

  // 스킬 진화 발동 — 조건: 직업 특성 3장(evoReady) + Lv.12 이상.
  // 계측 근거: 3장 조건만으로는 평균 1.7층/Lv.5 진화 (봇 9런) — 너무 이르다.
  // Lv.12는 기대 성장표 기준 4층 보스 전후 = 런 중반의 '완성 순간'.
  checkEvolution() {
    const p = this.player;
    if (!p || p.skillEvolved || !p.evoReady || this.level < 12) return;
    p.skillEvolved = true;
    this.banner = { text: '⚡ 스킬 진화 — ' + p.skillName() + '!', life: 3, maxLife: 3, color: '#f7b32b' };
    AudioSys.levelup();
    Particles.burst(p.x, p.y, {
      count: 26, colors: ['#f7b32b', '#ffd866', '#fff7c0'], speed: 200, life: 0.8, size: 4, gravity: -120,
    });
    Particles.ring(p.x, p.y, { r0: 10, r1: 90, life: 0.5, color: '#f7b32b', width: 4 });
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
    // 보스 러시: 문 없이 곧장 다음 군주 — 회복 2 + 특성 2장이 막간의 숨
    if (this.bossRush) {
      const p = this.player;
      p.hp = Math.min(p.maxHp, p.hp + 2);
      Dungeon.floor++;
      Dungeon.roomIndex = Dungeon.totalRooms;
      Dungeon.build('boss');
      this.pendingChoices += 2;
      this.openTraitChoice('elite');
      return;
    }
    // 지름길 (R3): 3·6층 보스 처치 후 갈림길 — 한 층을 건너뛰되 도착 층은 정예가 들끓는다.
    // 런 중반의 '큰 결정'을 만든다 (9층은 제외 — 최종 보스를 건너뛸 수는 없다)
    const opts = [{ type: 'nextfloor', ...ROOM_META.nextfloor }];
    if ((Dungeon.floor === 3 || Dungeon.floor === 6) && !this.endless) {
      opts.push({ type: 'shortcut', ...ROOM_META.shortcut });
    }
    World.openDoors(opts);
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
