// 전투 판정 허브 — 피해/처치/폭발/피격/투사체 생성.
// main.js에서 Object.assign(Game, GameCombat)으로 Game에 합쳐진다.

// ══ 죽음의 흔적 (v126) — 종족별 절단·체액·잔존물: 무엇을 베었는지 잔해가 말해준다 ══
// kind: human(참수 대상)/beast(붉은 피 짐승)/bone(뼈 파편)/rot(썩은 피)/venom(독록)/stone(돌 파편)/spirit(소산)
const GORE_FLUIDS = {
  human:  { stamp: null, burst: ['#8a1c2c', '#c22030', '#3a0a0e', '#66131b'] }, // stamp null = 기본 붉은 셰이드
  beast:  { stamp: null, burst: ['#8a1c2c', '#c22030', '#66131b'] },
  bone:   { stamp: ['#8a8272', '#9a927e', '#6e6858'], burst: ['#e8dfc8', '#b8ae96', '#948a72'] },
  rot:    { stamp: ['#2e1a1e', '#3a2024', '#26161c'], burst: ['#6a1420', '#4a6a2a', '#3a2024'] },
  venom:  { stamp: ['#22301a', '#2c3c20', '#1a2814'], burst: ['#6ab04c', '#c9d94a', '#2c3c20'] },
  stone:  { stamp: ['#26262e', '#32323c'], burst: ['#6e7383', '#9aa1b0', '#44444f'] },
  spirit: { stamp: null, burst: ['#c9b8e8', '#b13ae0', '#7a5ac2'] },
};
const GORE_KINDS = {
  human: new Set(['berserker', 'shaman', 'sniper', 'jailer', 'executioner', 'warden', 'frostMage', 'frostArcher',
    'stalker', 'charger', 'flameJuggler', 'riftCaster', 'mirrorKnight', 'necro', 'bomber', 'acolyte']),
  beast: new Set(['boar', 'lavaHound', 'bloodBat', 'leech', 'swarm']),
  bone: new Set(['skeleton', 'shieldSkeleton', 'archer', 'boneHeap', 'bonePile', 'bat']),
  venom: new Set(['toxicSlime', 'sporePuff', 'sporeMother', 'venomLasher', 'acidSlug', 'acidSnail',
    'thornPlant', 'fungalTick', 'sporeling', 'mushroom']),
  stone: new Set(['golem', 'crystal', 'obsidianBeast', 'gazer', 'voidEye', 'turret', 'frostGolem', 'mimic']),
  spirit: new Set(['wisp', 'wraith', 'shade', 'fireSpirit', 'cinder', 'emberMoth', 'chainWraith', 'voidSpawn']),
};
// 보스 예외 (기본 = human): 그림자 5 소산 / 몰레·되살아난 손들은 썩은 피 / 재가 된 브란트는 잿돌
const GORE_BOSS = { 2: 'rot', 5: 'spirit', 6: 'rot', 7: 'rot', 8: 'rot', 9: 'stone' };
const GameCombat = {
  // ══ 계열 「원한의 길」 (v137) — 특성(태그)+유물+계승 형상을 통합 집계, 임계 2/4/6 ══
  sectCount(key) {
    const s = SECTS[key];
    const p = this.player;
    if (!s || !p) return 0;
    let n = 0;
    for (const id of p.traits) {
      const t = TRAITS.find((x) => x.id === id);
      if (t && t.tag === s.tag) n++;
    }
    for (const rid of s.relics) if (p.relics.includes(rid)) n++;
    if (p.form && s.forms.includes(p.form)) n++;
    return n;
  },
  // 획득 시마다 호출 — 단계 상승 순간에만 배너 (silent: 런 복원 시 연출 없이 동기화)
  checkSects(silent = false) {
    this.sects = this.sects || {};
    for (const k of Object.keys(SECTS)) {
      const cnt = this.sectCount(k);
      let lv = 0;
      for (const th of SECT_THRESH) if (cnt >= th) lv++;
      const prev = this.sects[k] || 0;
      this.sects[k] = lv;
      if (!silent && lv > prev) {
        const s = SECTS[k];
        this.banner = { text: `「${s.name}」의 길 ${lv}단 — ${s.tiers[lv - 1]}`, life: 2.6, maxLife: 2.6, color: s.color };
        AudioSys.levelup();
        Particles.burst(this.player.x, this.player.y, { count: 18, colors: [s.color, '#ffffff'], speed: 150, life: 0.6, size: 3, gravity: -60 });
        Particles.ring(this.player.x, this.player.y, { r0: 8, r1: 70, life: 0.45, color: s.color, width: 4 });
      }
    }
  },
  // 카드 하이라이트용: 이 태그를 1장 더 집으면 어느 계열이 몇 단이 되나
  sectPreview(tag) {
    const k = SECT_BY_TAG[tag];
    if (!k || !this.player) return null;
    const s = SECTS[k];
    const cnt = this.sectCount(k);
    const next = SECT_THRESH.find((th) => th > cnt);
    if (!next) return null;
    return { name: s.name, color: s.color, cnt, next, crossing: cnt + 1 >= next, nextDesc: s.tiers[SECT_THRESH.indexOf(next)] };
  },

  // 히트스톱 완화 — '탁탁' 끊기는 멈춤이 렉처럼 보인다는 피드백.
  // 0.35초 창 안에서는 첫 방만 짧게 멈추고, 나머지는 아예 멈추지 않는다 (초당 최대 ~3회).
  // 적용 여부를 돌려줘서 크리 섬광도 같은 리듬으로만 터지게 한다 (연속 번쩍임 방지).
  // 죽음의 흔적 (v126): 종족 → 고어 프로필
  _goreProf(e) {
    let kind = 'rot';
    if (e.isBoss) kind = GORE_BOSS[e.defId] || 'human';
    else for (const k of Object.keys(GORE_KINDS)) { if (GORE_KINDS[k].has(e.type)) { kind = k; break; } }
    return { kind, ...GORE_FLUIDS[kind] };
  },

  // 절단 조각 스폰: 스프라이트를 부위별로 잘라 날린다. 멈추면 바닥에 구워져 방이 끝날 때까지 남는다.
  // 반환 skipCorpse: 뼈는 통짜 잔상 대신 파편만 남긴다
  _spawnGibs(e, dir, prof, brutal) {
    const gore = (Meta.data.opts && Meta.data.opts.gore != null) ? Meta.data.opts.gore : 1;
    if (gore < 1 || prof.kind === 'spirit') return null;
    const key = e.isBoss ? e.def.sprite : e.sprite;
    const img = key && Sprites[key];
    if (!img || !img.width) return null;
    const behead = prof.kind === 'human' && brutal;
    const cache = (this._gibCache = this._gibCache || {});
    const ck = key + '|' + prof.kind + (behead ? '|b' : '');
    let cuts = cache[ck];
    if (!cuts) {
      const w = img.width, h = img.height;
      const mk = (sx, sy, sw, sh) => {
        const c = document.createElement('canvas');
        c.width = Math.max(3, Math.round(sw)); c.height = Math.max(3, Math.round(sh));
        c.getContext('2d').drawImage(img, Math.round(sx), Math.round(sy), c.width, c.height, 0, 0, c.width, c.height);
        return c;
      };
      if (prof.kind === 'bone') cuts = [mk(0, 0, w / 2, h / 2), mk(w / 2, 0, w / 2, h / 2), mk(0, h / 2, w / 2, h / 2), mk(w / 2, h / 2, w / 2, h / 2)];
      else if (behead) cuts = [mk(w * 0.26, 0, w * 0.48, h * 0.36)]; // 머리 — 참수
      else if (prof.kind === 'human') cuts = [mk(0, h * 0.18, w * 0.4, h * 0.6)]; // 팔쪽 절단
      else if (prof.kind === 'stone') cuts = [mk(0, 0, w / 2, h * 0.55), mk(w / 2, h * 0.3, w / 2, h * 0.55)];
      else cuts = [mk(w * 0.5, h * 0.45, w * 0.5, h * 0.55)]; // 짐승/시체: 살덩이
      cache[ck] = cuts;
    }
    const base = Math.atan2(dir.y, dir.x);
    for (const c of cuts) {
      if (this.gibs.length >= 24) { // 성능 상한 — 오래된 조각은 즉시 굽는다
        const old = this.gibs.shift();
        World.stampImage(old.img, old.x, old.y, old.rot, 0.85);
      }
      const a = base + (Math.random() - 0.5) * (prof.kind === 'bone' ? 2.6 : 1.1);
      const sp = (behead ? 240 : 165) + Math.random() * 90;
      this.gibs.push({
        img: c, x: e.x, y: e.y - 6,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * (prof.kind === 'bone' ? 14 : 9),
        t: 0, life: 0.85 + Math.random() * 0.5,
      });
    }
    if (behead) Particles.text(e.x, e.y - 40, '참수!', { color: '#e43b44', size: 14 });
    return { skipCorpse: prof.kind === 'bone' };
  },

  _applyHitstop(v) {
    if (this.time - (this._lastStopT ?? -9) > 0.35) {
      this.hitstop = Math.max(this.hitstop, v);
      this._lastStopT = this.time;
      return true;
    }
    return false;
  },

  damageEnemy(e, dmg, dir, { feel = true, crit = false, kb = 190, color } = {}) {
    if (e.dead || e.phased) return;
    // 기믹: 중장갑 — 직접 타격만 경감. 화상/중독 틱, 폭발·연쇄·장판(feel=false)은 무시
    if (e.armorCap && feel && dmg > e.armorCap) {
      dmg = e.armorCap;
      crit = false;
      Particles.text(e.x, e.y - 38, '경감!', { color: '#9aa0b4', size: 11 });
    }
    // 보스 버스트 상한 — 특성이 쌓인 빌드가 기믹·페이즈를 보기도 전에 녹이지 못하게.
    // 타격당 최대 피해 = 최대 HP의 1.5% (최소 2) — 어떤 빌드라도 보스는 ~67타를 버틴다.
    // 기준: 유일하게 "보스답다"는 평가를 받은 골렘(중장갑 flat 2, 강빌드 TTK 29s)과 같은 체급.
    // 약한 빌드에는 상한이 걸리지 않으므로 저점 난이도는 그대로다.
    // 왕관의 파편: 굵직한 표적 특화 — 버스트 상한보다 먼저 곱해 상한 취지 유지
    if ((e.isBoss || e.isMini) && this.player && this.player.rflags.crownshard) dmg = Math.round(dmg * 1.15);
    // 시너지 유물 (v128): 표적의 상태가 피해를 키운다 — 버스트 상한보다 먼저 곱한다
    if ((e.isBoss || e.isMini || e.elite) && this.player && this.player.rflags.wolftooth) dmg = Math.round(dmg * 1.1); // 흰 늑대의 이빨
    if (e.status && e.status.burn > 0 && this.player && this.player.rflags.brand) dmg = Math.round(dmg * 1.25); // 낙인 인두
    if (e.status && e.status.shock > 0 && this.player && this.player.rflags.gallows) dmg = Math.round(dmg * 1.35); // 교수대의 밧줄
    if (e._markUntil && this.time < e._markUntil) dmg = Math.round(dmg * 1.25); // 사냥 표식 (계승)
    if (e.isBoss) dmg = Math.min(dmg, Math.max(2, Math.round(e.maxHp * 0.012))); // v141: 1.5→1.2% — 보스 순삭 제보
    // 피뢰침: 크리티컬이 감전을 심는다 — 원소 트리 없이도 반응(과부하·마비)의 문이 열린다
    if (crit && !e.isBoss && this.player && this.player.rflags.stormcrit && Math.random() < 0.2) {
      e.status.shock = Math.max(e.status.shock || 0, 2);
      Particles.text(e.x, e.y - 30, '감전', { color: '#ffd866', size: 11 });
    }
    // 처형 (S1): 상태이상 2종 이상을 품은 적에게 크리티컬 = 피해 ×1.3 — 원소 믹스 빌드의 보상
    if (crit && !e.isBoss) {
      const stCount = (e.status.burn > 0 ? 1 : 0) + (e.status.poison > 0 ? 1 : 0) + (e.status.shock > 0 ? 1 : 0);
      if (stCount >= 2) {
        dmg = Math.round(dmg * 1.3);
        Particles.text(e.x, e.y - 38, '처형!', { color: '#e43b44', size: 13 });
        this.teachReaction('execute', '처형 — 상태 2종 + 크리티컬 = 피해 증폭');
      }
    }
    e.hp -= dmg;
    e.flash = 0.1;
    // 드라마 AI: 얻어맞으면 그 순간 침입자를 안다 — 방 전체에 경보
    if (e._aware === false) { e._aware = true; this._roomAlert = true; }
    if (kb && !e.isBoss) {
      e.kbx += dir.x * kb;
      e.kby += dir.y * kb;
    } else if (kb) {
      e.kbx += dir.x * kb * 0.25;
      e.kby += dir.y * kb * 0.25;
    }

    if (feel) {
      // 히트스톱은 크리티컬에만, 그것도 짧게 — 일반 연타마다 멈추면 '탁탁' 끊기는 스터터가 된다.
      // 일반 타격의 손맛은 흔들림 + 파티클 + 사운드가 담당한다.
      const stopped = crit ? this._applyHitstop(0.055) : false;
      Renderer.shake(crit ? 4 : 2.5, 0.13);
      // 고어 (기획 §7): 방향성 피 분무 + 바닥 혈흔 — 벨 때마다 피가 남는다
      Particles.burst(e.x, e.y, {
        count: crit ? 7 : 4, colors: ['#8a1c2c', '#5a1016', '#c22030'],
        speed: 200, life: 0.42, size: 3, gravity: 280, dir: Math.atan2(dir.y, dir.x), spread: 0.9,
      });
      World.stampBlood(e.x + dir.x * 10 + (Math.random() - 0.5) * 12, e.y + dir.y * 10 + (Math.random() - 0.5) * 12,
        2.5 + Math.random() * 3, 0.32);
      Particles.burst(e.x, e.y, {
        count: crit ? 16 : 9,
        colors: ['#ffffff', '#f7b32b', '#ffd866'],
        speed: crit ? 220 : 170, life: 0.32, size: 3,
        dir: Math.atan2(dir.y, dir.x), spread: 1.6,
      });
      // 타격 충격파 링 (크리는 이중 링 + 임팩트 스타)
      Particles.ring(e.x, e.y, { r0: 4, r1: crit ? 40 : 26, life: crit ? 0.28 : 0.2, color: crit ? '#ffd866' : '#ffffff', width: crit ? 4 : 3 });
      if (crit) {
        Particles.ring(e.x, e.y, { r0: 2, r1: 22, life: 0.18, color: '#ffffff', width: 2 });
        Particles.star(e.x, e.y, { size: 30, color: '#fff7c0' });
      }
      if (crit) {
        AudioSys.crit();
        // 화면 섬광은 히트스톱과 같은 리듬으로만 — 고크리 빌드에서 연속 번쩍임(눈 아픔) 방지
        if (stopped) this.critFlash = 0.07;
      } else {
        AudioSys.hit();
      }

      const p = this.player;
      if (crit && p.flags.lifesteal && p.lifestealCd <= 0 && p.hp < p.maxHp && !(p.brandT > 0)) {
        p.hp++;
        p.lifestealCd = (this.sects && this.sects.blood >= 1) ? 3 : 4; // 혈맹 1단: 흡혈 쿨 -25%
        Particles.text(p.x, p.y - 26, '+1', { color: '#e43b44', size: 14 });
        AudioSys.pickup();
      }
    }
    if (Meta.data.opts?.dmgNum !== 0) {
      Particles.text(e.x, e.y - 22, String(dmg), {
        color: color || (crit ? '#f7b32b' : '#ffffff'),
        size: crit ? 22 : feel ? 15 : 12,
      });
    }

    if (e.hp <= 0) this.killEnemy(e, dir, crit);
  },

  hitEnemy(e, dmg, dir, opts = {}) {
    // 계승 형상 훅 (v127) — 플레이어의 타격에만 걸린다
    {
      const pf = this.player;
      if (pf && pf.form === 'noose' && Math.random() < 0.12) { // 밧줄의 망령: 올가미
        e.status.shock = Math.max(e.status.shock || 0, 1.2);
        Particles.text(e.x, e.y - 26, '올가미!', { color: '#c8a860', size: 12 });
      }
      if (pf && pf.form === 'ash') e.status.burn = Math.max(e.status.burn || 0, 1.5); // 재의 현자: 명중마다 불
      if (pf && pf.form === 'hunt' && opts && opts.crit) { // 사냥의 원혼: 크리가 표식을 남긴다
        e._markUntil = this.time + 2.5;
        Particles.ring(e.x, e.y, { r0: 4, r1: 26, life: 0.3, color: '#8adf76', width: 2 });
      }
      // 사형수의 쇠고랑 (v128): 감전이 이웃에게 옮는다 — 감전 전이 유물
      if (pf && pf.rflags.conduct && e.status && e.status.shock > 0) {
        let near = null, bd = 120;
        for (const o of this.enemies) {
          if (o === e || o.dead || o.phased || o.neutral || (o.status && o.status.shock > 0)) continue;
          const dd = Math.hypot(o.x - e.x, o.y - e.y);
          if (dd < bd) { bd = dd; near = o; }
        }
        if (near) {
          near.status.shock = Math.max(near.status.shock || 0, 1.5);
          Particles.text(near.x, near.y - 26, '전이', { color: '#ffd866', size: 11 });
        }
      }
    }
    this.damageEnemy(e, dmg, dir, { ...opts, feel: true });
  },

  killEnemy(e, dir, brutal = false) {
    if (e.dead) return;
    e.dead = true;
    // 드라마 AI: 항복한 자를 베었다 — 처형. 정상 처치로 취급 (고어·집계·드랍 전부)
    if (e._surrender != null) {
      e.neutral = false;
      e._surrender = null;
      brutal = true;
      Particles.text(e.x, e.y - 34, '처형', { color: '#e43b44', size: 13 });
    }
    // 중립 개체(항아리·균열 벽): 처치 집계·도감·드랍 없이 부서진다
    if (e.neutral) {
      Particles.burst(e.x, e.y, {
        count: 10,
        colors: e.type === 'pot' ? ['#7a6a5a', '#5a4a3e', '#c09a4a'] : ['#8a8074', '#5a5a6e'],
        speed: 140, life: 0.4, size: 3, gravity: 260,
        dir: Math.atan2(dir.y, dir.x), spread: 2.4,
      });
      if (e.onDeath) e.onDeath(this);
      return;
    }
    this.kills++;
    // 킬 체인 (v138): 2초 안에 이어지는 처치 — 학살의 리듬이 화면에 보인다
    if (!e.neutral) {
      this._chainN = (this._chainT > 0 ? (this._chainN || 0) : 0) + 1;
      this._chainT = 2;
      if (this._chainN >= 2) {
        const cn = this._chainN;
        Particles.text(e.x, e.y - 48, `×${cn}`, {
          color: cn >= 8 ? '#e43b44' : cn >= 5 ? '#f7b32b' : '#ffd866',
          size: Math.min(15 + cn * 1.5, 30),
        });
        if (cn === 5 || cn === 8 || cn === 12) Renderer.shake(Math.min(4 + cn * 0.4, 9), 0.2);
      }
    }
    this._fearCheck(e, brutal); // 드라마 AI: 동료의 죽음을 본 산 자는 무너질 수 있다
    // 징조: 최근 시체 기록 — 어둠의 눈이 뜨면 이 자리에서 다시 일어난다
    if (this._omenKills && !e.isBoss && !e.isMini) {
      this._omenKills.push({ type: e.type, x: e.x, y: e.y });
      if (this._omenKills.length > 4) this._omenKills.shift();
    }
    // 궁극기 게이지 (P2): 처치가 선고를 당긴다 — 잡몹 1 / 정예·우두머리 4 / 보스 10
    {
      const pu = this.player;
      if (pu && pu.ult > 0 && pu.ultGauge < pu.ultMax) {
        pu.ultGauge = Math.min(pu.ultMax, pu.ultGauge + (e.isBoss ? 10 : (e.elite || e.isMini) ? 4 : 1));
        if (pu.ultGauge >= pu.ultMax) {
          Particles.text(pu.x, pu.y - 34, '처형 선고 준비! (R)', { color: '#e43b44', size: 14 });
          AudioSys.levelup();
        }
      }
    }
    // 보스 도감 키: createBoss가 새긴 실제 킷 id — 층 산식은 순환 보스 개편으로 폐기
    Meta.codexKill(e.isBoss ? 'boss' + (e.defId || Dungeon.floor) : (e.codexType || e.type));
    if (e.isBoss && e.def) this._lastBossOutro = e.def.outro; // 마이크로 서사: onBossDead 끝에서 출력
    if (e.isBoss || e.isMini || e.elite) this.hitstop = Math.max(this.hitstop, 0.09); // 굵직한 처치는 항상 강조
    else this._applyHitstop(0.05); // 잡몹 처치는 짧게 — 학살 중 '탁탁' 끊김 방지
    // 골드 (G1): 굵직한 처치에서만 떨어진다 — 상인에게만 쓰는 런 화폐
    {
      const pl = this.player;
      const gmul = (pl && pl.rflags.goldheart ? 1.3 : 1) * (pl && pl.rflags.crownshard && (e.isBoss || e.isMini) ? 2 : 1);
      if (e.isBoss) {
        const g = Math.round((20 + Dungeon.floor * 3) * gmul); // 경제 계측: 수입 감쇠 후 기준
        this.gold += g;
        Particles.text(e.x, e.y - 30, `+${g}G`, { color: '#ffd866', size: 16 });
      } else if (e.elite || e.isMini) {
        const g = Math.round((4 + Dungeon.floor) * gmul) + (e.royal ? 5 : 0); // 왕장 정예: 위험 수당
        this.gold += g;
        Particles.text(e.x, e.y - 26, `+${g}G`, { color: '#ffd866', size: 13 });
      }
      // 묘지기의 삽 (v128): 잡몹도 가끔 동전을 문다 — 소액 골드 보조 수입
      if (pl && pl.rflags.shovel && !e.isBoss && !e.elite && !e.isMini && Math.random() < 0.08) {
        this.gold += 2;
        Particles.text(e.x, e.y - 22, '+2G', { color: '#ffd866', size: 11 });
      }
      // 도살자의 갈고리: 굵직한 처치가 곧 회복 — 근접 빌드의 유지력 축
      if (pl && pl.rflags.butcher && (e.elite || e.isMini || e.isBoss) && pl.hp < pl.maxHp && !(pl.brandT > 0)) {
        pl.hp++;
        Particles.text(pl.x, pl.y - 28, '+1', { color: '#e43b44', size: 14 });
      }
      // 굶주린 검: 40처치마다 공격력 +1 (상한 +3) — 학살이 성장이 된다
      if (pl && pl.rflags.hungry) {
        pl._hungryKills = (pl._hungryKills || 0) + 1;
        if (pl._hungryKills % 40 === 0 && (pl._hungryStacks || 0) < 3) {
          pl._hungryStacks = (pl._hungryStacks || 0) + 1;
          pl.bonusAtk += 1;
          this.banner = { text: `굶주린 검이 깨어난다 — 공격력 +1 (${pl._hungryStacks}/3)`, life: 1.8, maxLife: 1.8, color: '#e43b44' };
          AudioSys.crit();
        }
      }
    }
    // 해방의 속삭임 (기획 §5 4막): 저주로 깨어난 자들은 베어주면 고맙다고 속삭인다
    if (Dungeon.floor >= 31 && Dungeon.floor <= 40 && ['ghoul', 'skeleton', 'shieldSkeleton', 'wraith', 'shade'].includes(e.type) && Math.random() < 0.12) {
      Particles.text(e.x, e.y - 30, '…고맙다…', { color: '#9a9488', size: 12 });
    }
    Renderer.shake(3, 0.15);
    AudioSys.die(e.isBoss ? 'boss' : e.elite ? 'elite' : 'small');

    const palettes = {
      slime: ['#38b764', '#a7f070', '#257179'],
      toxicSlime: ['#8a3a8c', '#c56cf0', '#5c1e5e'],
      archer: ['#e8e0cf', '#a99e8c'],
      boar: ['#8d5a3b', '#5e3a26'],
      lavaHound: ['#d35400', '#7a1010', '#ffd866'],
      mushroom: ['#8a5ac2', '#d8c8f0'],
      bat: ['#5c5c74', '#3a2a52'],
      spider: ['#241832', '#3a3a4a', '#e43b44'],
      golem: ['#5d6b84', '#3d4a5c'],
      wraith: ['#a9c1d8', '#5d6b84'],
      fireSpirit: ['#ff9a3c', '#ffd866', '#7a1010'],
      necro: ['#2a4a3a', '#38b764'],
      bomber: ['#5c3a3a', '#ff4757', '#ffd866'],
      thornPlant: ['#4a7a3f', '#7ab04c'],
      executioner: ['#3d3d52', '#5d6b84', '#c8d4e4'],
      magmaSlime: ['#4a1f1a', '#ff7043', '#ffd866'],
      magmaSmall: ['#4a1f1a', '#ff7043'],
      voidEye: ['#241832', '#b13ae0', '#c9b8e8'],
      skeleton: ['#d8d3c5', '#8a8074'],
      shieldSkeleton: ['#d8d3c5', '#3a7ca5'],
      sniper: ['#3d3d52', '#d8d3c5', '#e43b44'],
      swarm: ['#5c3a5c', '#8a5a8a'],
      frog: ['#4a7a3f', '#7ab04c'],
      leech: ['#6a1c2c', '#a43a4a'],
      iceSlime: ['#7ab8d8', '#b8e0f0'],
      frostArcher: ['#3a6a9a', '#5ce0e6'],
      berserker: ['#a43a3a', '#ffd866'],
      wisp: ['#3a8ac0', '#7ac0e8'],
      shaman: ['#6a4a8a', '#38b764'],
      crystal: ['#7a5ac2', '#b89ae8', '#f0e8ff'],
      ghoul: ['#6a7a5a', '#e43b44'],
      charger: ['#5a3a2a', '#8a5a3a', '#d8d3c5'],
      turret: ['#8a5ac2', '#5d6b84'],
      mimic: ['#c09a4a', '#6a1020'],
      stalker: ['#241832', '#b13ae0'],
      brute: ['#7a5a4a', '#5e3a26'],
      imp: ['#c04a3a', '#ffd866'],
      glutton: ['#8a6a9a', '#4a1020'],
      boss: e.def ? e.def.deathPalette : ['#b13ae0'],
    };
    Particles.burst(e.x, e.y, {
      count: e.isBoss ? 48 : 22,
      colors: palettes[e.type] || ['#ffffff'],
      speed: 210, life: 0.55, size: 4,
      gravity: 300, dir: Math.atan2(dir.y, dir.x), spread: 2.6,
    });
    const killPal = palettes[e.type] || ['#ffffff'];
    Particles.ring(e.x, e.y, { r0: 6, r1: e.isBoss ? 90 : 44, life: e.isBoss ? 0.45 : 0.3, color: killPal[0], width: 4 });
    Particles.star(e.x, e.y, { size: e.isBoss ? 46 : 26, color: '#ffffff' });
    if (e.isBoss) {
      Particles.ring(e.x, e.y, { r0: 4, r1: 140, life: 0.6, color: '#ffffff', width: 3 });
      Particles.ring(e.x, e.y, { r0: 2, r1: 60, life: 0.35, color: killPal[1] || killPal[0], width: 5 });
    }

    // 죽음의 흔적 (v126): 종족별 절단·체액·잔존물 — 크리티컬 처치는 더 격렬하게
    let gibRes = null;
    const goreLv = (Meta.data.opts && Meta.data.opts.gore != null) ? Meta.data.opts.gore : 1;
    // 4막 안식: 같은 저주의 망자는 베는 게 아니라 재운다 — 절단 없이 혼이 흩어진다
    const resting = Dungeon.floor >= 31 && Dungeon.floor <= 40 &&
      ['ghoul', 'skeleton', 'shieldSkeleton', 'wraith', 'shade'].includes(e.type);
    if (!e.neutral && goreLv > 0 && !resting) {
      const prof = this._goreProf(e);
      const big = brutal || e.isBoss || e.isMini;
      if (prof.kind !== 'spirit') {
        World.stampBlood(e.x, e.y, big ? 16 : 10, 0.55, prof.stamp);
        const nDrop = big ? 8 : 5;
        for (let gi = 0; gi < nDrop; gi++) {
          const ga = Math.atan2(dir.y, dir.x) + (Math.random() - 0.5) * 2.4;
          const gd = 10 + Math.random() * (big ? 40 : 24);
          World.stampBlood(e.x + Math.cos(ga) * gd, e.y + Math.sin(ga) * gd, 2 + Math.random() * 4, 0.42, prof.stamp);
        }
      }
      // 체액 분출: 종족의 색으로 터진다 (뼈는 골분, 정령은 혼의 입자)
      Particles.burst(e.x, e.y, {
        count: big ? 14 : 8, colors: prof.burst,
        speed: 250, life: 0.6, size: 4, gravity: prof.kind === 'spirit' ? -60 : 340,
        dir: Math.atan2(dir.y, dir.x), spread: 1.7,
      });
      gibRes = this._spawnGibs(e, dir, prof, brutal);
      if (big) Renderer.shake(5, 0.2);
    } else if (resting) {
      // 안식 — 보랏빛 혼이 천천히 오른다. 잔해는 남기지 않는다
      Particles.burst(e.x, e.y, { count: 9, colors: ['#c9b8e8', '#9a9488'], speed: 42, life: 1.0, size: 2, gravity: -70 });
    }

    // 사망 연출: 무너져 내리는 잔상 (뼈는 파편으로 대신한다)
    const spriteKey = e.isBoss ? e.def.sprite : e.sprite;
    if (spriteKey && Sprites[spriteKey] && !(gibRes && gibRes.skipCorpse)) {
      this.corpses.push({
        img: e.elite ? Sprites.tint(Sprites[spriteKey]) : Sprites[spriteKey],
        x: e.x, y: e.y, flip: e.flip,
        t: 0, dur: e.isBoss ? 0.7 : 0.35,
        scale: e.isBoss ? e.def.scale : 1,
      });
    }

    const p = this.player;

    // 처치 시 스킬 쿨다운 0.3초 감소 — 무리를 잘 쓸수록 스킬이 자주 돈다
    if (p.skillCd > 0) p.skillCd = Math.max(0, p.skillCd - 0.15); // 0.3→0.15: 물량방 '무한 스킬' 체감 완화 (실플레이 피드백)

    // 사망 시 발동 효과 (적 고유 + 특성 + 유물)
    if (e.onDeath) e.onDeath(this);

    // 왕의 권능 (전설): 처치 시 5% 영혼 폭발
    if (p.flags.monarch && Math.random() < 0.05) {
      this._explode(e.x, e.y, 90, 3, ['#ffd866', '#fff7c0', '#b13ae0'], '#ffd866');
      Particles.text(e.x, e.y - 34, '왕의 권능!', { color: '#ffd866', size: 14 });
    }
    if (p.flags.burnboom && e.status.burn > 0) {
      this._explode(e.x, e.y, 80, 2, ['#ff7043', '#ffd866', '#e43b44'], '#ff7043');
    }
    if ((p.flags.plague || p.form === 'plague' || p.rflags.venomburst) && e.status.poison > 0) { // 역병 의사 (계승)·초록 유리병 (유물): 역병은 번진다
      this.zones.push({ x: e.x, y: e.y, r: 50 * (this.sects && this.sects.venom >= 3 ? 1.4 : 1), life: 2.5, kind: 'poison', tickT: 0, hit: null }); // 독 3단 「창궐」
    }
    // 계열 3단 발화 (v137) — 화염 「대화재」 / 번개 「낙뢰」 / 혈맹 「피의 축제」
    if (this.sects && this.sects.fire >= 3 && e.status.burn > 0) {
      this.zones.push({ x: e.x, y: e.y, r: 44, life: 2.0, kind: 'fire', tickT: 0.3, hit: null });
    }
    if (this.sects && this.sects.volt >= 3 && e.status.shock > 0) {
      let spread = 0;
      for (const o of this.enemies) {
        if (spread >= 2) break;
        if (o === e || o.dead || o.phased || o.neutral || (o.status && o.status.shock > 0)) continue;
        if (Math.hypot(o.x - e.x, o.y - e.y) < 130) {
          o.status.shock = Math.max(o.status.shock || 0, 1.8);
          Particles.text(o.x, o.y - 26, '낙뢰', { color: '#ffd866', size: 11 });
          spread++;
        }
      }
    }
    if (this.sects && this.sects.blood >= 3 && Math.random() < 0.04 && p.hp < p.maxHp && !(p.brandT > 0)) {
      p.hp++;
      Particles.text(p.x, p.y - 26, '+1', { color: '#e43b44', size: 14 });
    }
    if (p.form === 'venge') { // 복수귀 (계승): 처치마다 원한이 쌓인다
      p._vs = Math.min(8, (p._vs || 0) + 1);
      if (p._vs === 8 && !p._vsMax) { p._vsMax = true; Particles.text(p.x, p.y - 36, '원한 만개!', { color: '#e43b44', size: 14 }); }
    }
    if (p.rflags.bomb && Math.random() < 0.15) {
      this._explode(e.x, e.y, 70, 2, ['#f7b32b', '#ff7043'], '#f7b32b');
    }
    // 집행인의 장갑 (v128): 크리티컬 처치(brutal)가 곧 처형 — 폭발로 번진다
    if (p.rflags.headsman && brutal) {
      this._explode(e.x, e.y, 70, 2, ['#e43b44', '#f7b32b'], '#e43b44');
    }
    // 죄인의 사슬 (v128): 3초 안의 세 목숨이 사슬을 푼다 — 대시 완전 충전
    if (p.rflags.chain3) {
      if (this.time - (p._ckT || -9) > 3) { p._ckT = this.time; p._ckN = 0; }
      if (++p._ckN >= 3) {
        p._ckN = 0; p._ckT = -9;
        if (p.dashCharges < p.dashMax) {
          p.dashCharges = p.dashMax;
          p.dashRegenT = 0;
          Particles.text(p.x, p.y - 26, '사슬이 풀린다!', { color: '#5ce0e6', size: 13 });
        }
      }
    }
    // 과충전: 물량방에서 처치가 초당 수 회 일어나면 사실상 무한 대시가 되므로 2초에 1회로 제한
    if (p.flags.overcharge && e.status.shock > 0 && p.dashCharges < p.dashMax && !(p._overchargeCd > 0)) {
      p.dashCharges = p.dashMax;
      p.dashRegenT = 0;
      p._overchargeCd = 2;
      Particles.text(p.x, p.y - 26, '충전!', { color: '#ffd866', size: 13 });
    }
    if (p.rflags.fang && Math.random() < 0.08 && p.hp < p.maxHp && !(p.brandT > 0)) {
      p.hp++;
      Particles.text(p.x, p.y - 26, '+1', { color: '#e43b44', size: 14 });
    }

    // 왕장 정예 (v130): 왕의 각인은 죽음으로 발화한다 — 대각 4방 원혼탄 (읽고 피할 수 있는 예고된 위협)
    if (e.royal) {
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + i * Math.PI / 2;
        this.spawnProjectile('soul', e.x, e.y, { x: Math.cos(a), y: Math.sin(a) }, { speed: 170, dmg: 1 });
      }
      Particles.ring(e.x, e.y, { r0: 6, r1: 44, life: 0.35, color: '#f7b32b', width: 3 });
      Particles.text(e.x, e.y - 34, '왕의 각인!', { color: '#f7b32b', size: 12 });
      AudioSys.shoot();
    }

    if (e.isBoss) {
      this.onBossDead();
      return;
    }

    if (e.noDrops) return; // 폭탄벌레 자폭 등 — 보상 없는 죽음

    // 전화의 길: 정예가 한(恨) 조각을 떨군다 — 위험을 정면으로 걸은 값
    if (e.elite && this.route === 'war') {
      Meta.data.shards += 1;
      Particles.text(e.x, e.y - 26, '◆ +1', { color: '#e43b44', size: 12 });
    }
    // 지름길 층 (R3): 정예가 파편을 떨군다 — 위험을 감수한 만큼의 수당
    if (e.elite && Dungeon.shortcutHot) {
      Meta.data.shards += 4;
      Particles.text(e.x, e.y - 34, '◆ +4', { color: '#2ec4b6', size: 13 });
    }

    // 중간보스(우두머리) 처치 보상: 하트 확정 + 영혼 파편 즉시 지급
    if (e.isMini) {
      this.pickups.push({ x: e.x, y: e.y, t: 0, r: 12 });
      // 깨어진 비석 「전승의 포식」: 우두머리를 삼킨 힘 — 하트 1 즉시 회복 (낙인 중엔 봉인)
      const pl = this.player;
      if (Meta.lvl('b_feast') > 0 && pl && pl.hp < pl.maxHp && !(pl.brandT > 0)) {
        pl.hp++;
        Particles.text(pl.x, pl.y - 34, '전승의 포식 +1', { color: '#e43b44', size: 13 });
      }
      const bonus = 6 + Dungeon.floor * 2;
      Meta.data.shards += bonus;
      Meta.save();
      Particles.text(e.x, e.y - 40, `◆ +${bonus}`, { color: '#2ec4b6', size: 16 });
      this.banner = { text: `${e.miniName} 격파!`, life: 1.5, maxLife: 1.5, color: '#2ec4b6' };
      Renderer.shake(5, 0.3);
    }

    let val = e.xpVal;
    while (val > 0) {
      const v = Math.min(3, val);
      val -= v;
      const a = Math.random() * Math.PI * 2;
      this.orbs.push({ x: e.x, y: e.y, val: v, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 });
    }
    // 하트: 기본 4.5% (개체수 +30% 보정) + 층이 깊을수록 감소 (최저 50%)
    // 보스전 중에는 절반 — 부하가 회복 셔틀이 되지 않게 (긴장 유지)
    // R1: 심층(7층+) 하트 추가 감쇠 — 후반 순항 방지 (회복이 귀할수록 긴장이 살아있다)
    const floorDecay = Math.max(0.4, 1 - 0.04 * (Dungeon.floor - 1) - (Dungeon.floor >= 7 ? 0.12 : 0));
    const bossFight = this.enemies.some((b) => b.isBoss && !b.dead) ? 0.5 : 1;
    // 행운(×2 중첩)·클로버(×1.8)가 겹치면 ×7.2까지 폭주 — 총 배율 상한 ×3
    const luckMul = Math.min(3, p.luckMul);
    let heartChance = 0.045 * floorDecay * bossFight * luckMul * (this.pacts.heal ? 0.5 : 1) *
      ((this.sects && this.sects.blood >= 2) ? 1.25 : 1); // 혈맹 2단: 하트 드랍 +25%
    if (p.flags.bloodlust) heartChance += 0.12;
    if (p.hp >= p.maxHp) heartChance *= 0.35; // 풀피면 감쇠 — 못 먹는 하트가 바닥에 쌓이는 낭비 방지
    if ((this._roomHearts || 0) >= 2) heartChance *= 0.25; // 방당 2개 이후 급감 (물량 방 인플레 방지)
    if (Math.random() < heartChance) {
      this._roomHearts = (this._roomHearts || 0) + 1;
      this.pickups.push({ x: e.x, y: e.y, t: 0, r: 12 });
    }
  },

  _explode(x, y, radius, dmg, colors, textColor) {
    Particles.burst(x, y, { count: 20, colors, speed: 220, life: 0.4, size: 4 });
    Particles.ring(x, y, { r0: 8, r1: radius, life: 0.3, color: colors[0], width: 5 });
    Particles.ring(x, y, { r0: 4, r1: radius * 0.6, life: 0.22, color: '#ffffff', width: 2 });
    Renderer.shake(3.5, 0.16);
    AudioSys.thud();
    for (const other of this.enemies) {
      if (other.dead || other.phased) continue;
      const dd = Math.hypot(other.x - x, other.y - y);
      if (dd < radius && dd > 0.01) {
        const ddir = { x: (other.x - x) / dd, y: (other.y - y) / dd };
        this.damageEnemy(other, dmg, ddir, { feel: false, kb: 150, color: textColor });
      }
    }
  },


  // 사망 리포트용 — 방금 나를 때린 것의 이름 (가장 가까운 살아있는 적 추정)
  _foeName(e) {
    let name;
    if (e.isBoss) name = e.name;
    else if (e.isMini) name = e.miniName || '우두머리';
    else {
      const c = typeof CODEX_ENEMIES !== 'undefined' && CODEX_ENEMIES.find((x) => x.id === (e.codexType || e.type));
      name = c ? c.name : e.type;
    }
    if (e.elite && !e.isBoss && !e.isMini) name = '정예 ' + name;
    return name;
  },

  _nearestFoeName() {
    const p = this.player;
    let best = 170, name = null;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < best) {
        best = d;
        name = this._foeName(e);
      }
    }
    return name;
  },

  hurtPlayer(dmg, dir, kb = 260, src = null) {
    const p = this.player;
    if (p.god) return; // 테스트 모드 무적
    if (p.invuln > 0 || this.state !== 'play') {
      // 완벽 회피 (P1) — 대시 무적 중에 공격이 스쳤다: 시간이 늘어지고 다음 일격이 확정 크리.
      // 텔레그래프가 '피할 것'에서 '노릴 것'으로 바뀌는 순간 — 실력 표현의 핵심 축
      if (p._dashWin > 0 && !p._pdodged && this.state === 'play') {
        p._pdodged = true;
        p.pdodgeCrit = true;
        this.slowmoT = 0.45;
        this.pdodgeFlash = 0.3; // 화면 청록 섬광 — 발동을 온몸으로 알린다
        Particles.ring(p.x, p.y, { r0: 8, r1: 84, life: 0.45, color: '#5ce0e6', width: 5 });
        Particles.ring(p.x, p.y, { r0: 4, r1: 44, life: 0.3, color: '#ffffff', width: 3 });
        Particles.burst(p.x, p.y, { count: 14, colors: ['#5ce0e6', '#a9fff7', '#ffffff'], speed: 170, life: 0.5, size: 3 });
        Particles.text(p.x, p.y - 34, '완벽 회피!', { color: '#5ce0e6', size: 19 });
        AudioSys.pdodge();
        Renderer.shake(3, 0.14);
        // 시곗바늘: 완벽 회피가 스킬을 당긴다 — 회피 실력이 화력이 되는 레전더리
        if (p.rflags.clockhand && p.skillCd > 0) {
          p.skillCd = Math.max(0, p.skillCd - 1.5);
          Particles.text(p.x, p.y - 52, '스킬 -1.5초', { color: '#f7b32b', size: 13 });
        }
        // 검은 거울 조각 (v128): 완벽 회피의 잔상이 주위를 벤다
        if (p.rflags.mirror) {
          for (const en of this.enemies) {
            if (en.dead || en.phased || en.neutral) continue;
            const dd = Math.hypot(en.x - p.x, en.y - p.y);
            if (dd < 110) {
              this.damageEnemy(en, 3, { x: (en.x - p.x) / (dd || 1), y: (en.y - p.y) / (dd || 1) }, { feel: false, kb: 220, color: '#5ce0e6' });
            }
          }
        }
      }
      return;
    }
    // 사인 기록: 명시된 출처(용암 등) > 최근접 적 추정
    this._lastHurtBy = src || this._nearestFoeName() || '이름 모를 어둠';
    // 흰 늑대의 가죽 (v128): 상처 없는 몸이 첫 이빨을 튕겨낸다 (12초마다 1회)
    if (p.rflags.pelt && p.hp >= p.maxHp && !(p._peltCd > 0)) {
      p._peltCd = 12;
      Particles.text(p.x, p.y - 34, '늑대 가죽!', { color: '#e8e0cf', size: 13 });
      Particles.ring(p.x, p.y, { r0: 6, r1: 60, life: 0.3, color: '#e8e0cf', width: 3 });
      AudioSys.clank();
      return;
    }
    if (p.form === 'venge' && p._vs > 0 && !p.shield) { p._vs = Math.floor(p._vs / 2); p._vsMax = false; } // 복수귀: 피는 원한을 씻는다

    // 보호막: 피해 1회 무효
    if (p.shield) {
      p.shield = false;
      p.shieldT = 0;
      if (p.form === 'guard') { // 수호망령 (계승): 깨진 보호막이 주위를 밀쳐낸다
        for (const en of this.enemies) {
          if (en.dead || en.isBoss) continue;
          const dd = Math.hypot(en.x - p.x, en.y - p.y);
          if (dd < 120) { const ux = (en.x - p.x) / (dd || 1), uy = (en.y - p.y) / (dd || 1); en.kbx = ux * 380; en.kby = uy * 380; }
        }
        Particles.ring(p.x, p.y, { r0: 10, r1: 118, life: 0.4, color: '#5ce0e6', width: 5 });
        AudioSys.thud();
      }
      p.invuln = Math.max(p.invuln, 0.5);
      p.hurtPoseT = 0.18; // 막았어도 몸은 휘청인다
      p.kbx = dir.x * kb * 0.5;
      p.kby = dir.y * kb * 0.5;
      if (p.flags.guardcrit) {
        p.pdodgeCrit = true; // 기사도: 막아낸 다음 일격은 확정 크리 (완벽 회피 보상 재사용)
        Particles.text(p.x, p.y - 40, '반격 준비!', { color: '#f7b32b', size: 13 });
      }
      // 수호 3단 「성채」 (v137): 깨진 보호막이 주위를 벤다 (형상 노바와 별개·중첩 가능)
      if (this.sects && this.sects.guard >= 3) {
        for (const en of this.enemies) {
          if (en.dead || en.phased || en.neutral) continue;
          const dd = Math.hypot(en.x - p.x, en.y - p.y);
          if (dd < 100) this.damageEnemy(en, 2, { x: (en.x - p.x) / (dd || 1), y: (en.y - p.y) / (dd || 1) }, { feel: false, kb: 200, color: '#5ce0e6' });
        }
        Particles.ring(p.x, p.y, { r0: 8, r1: 96, life: 0.35, color: '#5ce0e6', width: 4 });
      }
      Particles.text(p.x, p.y - 26, '막음!', { color: '#5ce0e6', size: 15 });
      Particles.burst(p.x, p.y, { count: 10, colors: ['#5ce0e6', '#a9fff7'], speed: 130, life: 0.35, size: 3 });
      AudioSys.clank();
      return;
    }

    // 위협 스케일 (v141, 실플레이 제보 "갈수록 쉬워진다"): 적 피해가 층과 함께 오른다 —
    // 잡몹 접촉 1이 끝까지 1이면, 커진 최대 HP·회복 앞에서 위협이 소멸한다
    dmg += Dungeon.floor >= 31 ? 2 : Dungeon.floor >= 16 ? 1 : 0;
    p.hp -= dmg;
    p.hurtPoseT = 0.32; // 피격 스프라이트 — 젖혀진 자세로 "맞았다"를 몸으로 보여준다
    // 고어 (기획 §7): 나도 피를 흘린다 — 후퇴선이 핏자국으로 남는다
    World.stampBlood(p.x + (Math.random() - 0.5) * 10, p.y + (Math.random() - 0.5) * 10, 3 + Math.random() * 3, 0.4);
    // 검사 1.2(근접 리스크 보상) / 궁수 1.05(밴드 계측: 열기0 사망이 검사의 120% — HP4 연쇄 피격 완화) / 마도사 0.9(밴드 내)
    p.invuln = (p.classId === 'knight' ? 1.2 : p.classId === 'archer' ? 1.05 : 0.9) +
      ((this.sects && this.sects.guard >= 2) ? 0.25 : 0); // 수호 2단: 피격 후 무적 연장
    p.kbx = dir.x * kb;
    p.kby = dir.y * kb;
    this.hitstop = Math.max(this.hitstop, 0.09); // 얻어맞는 순간은 세계가 함께 멈춘다
    this.vignette = 0.8;
    this.hurtFlash = 0.22; // 화면 전체 적색 섬광 + HUD 하트 흔들림
    Renderer.shake(7, 0.35);
    AudioSys.hurt();
    Particles.burst(p.x, p.y, {
      count: 13, colors: ['#e43b44', '#8a1c2c'], speed: 160, life: 0.4, size: 3,
    });
    Particles.ring(p.x, p.y, { r0: 6, r1: 38, life: 0.25, color: '#e43b44', width: 4 });
    // 방향성 임팩트 — 맞은 방향에서 흰 파편이 튄다 (어디서 맞았는지 몸이 먼저 안다)
    Particles.burst(p.x - dir.x * 10, p.y - dir.y * 10, {
      count: 6, colors: ['#ffffff', '#e8e0cf'], speed: 240, life: 0.22, size: 2,
      dir: Math.atan2(dir.y, dir.x), spread: 0.7,
    });

    // 수의 고정핀 (v128): 맞은 만큼 빨라진다 — 이탈 창
    if (p.rflags.panic) p._panicT = 2.5;
    // 잿불 망토: 얻어맞은 대가로 주변을 불태운다 (반응 재료 공급원이기도 하다)
    if (p.rflags.ashcloak) {
      for (const e of this.enemies) {
        if (e.dead || e.phased || e.neutral) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < 80) {
          e.status.burn = Math.max(e.status.burn || 0, 2.5);
        }
      }
      Particles.burst(p.x, p.y, { count: 10, colors: ['#ff7043', '#ffd866'], speed: 150, life: 0.4, size: 3 });
    }

    // 가시 갑옷 (특성) + 가시 방패 (유물)
    if (p.flags.thorns || p.rflags.spikeshield) {
      for (const e of this.enemies) {
        if (e.dead || e.phased) continue;
        const dd = Math.hypot(e.x - p.x, e.y - p.y);
        if (dd < 75) {
          const ddir = { x: (e.x - p.x) / (dd || 1), y: (e.y - p.y) / (dd || 1) };
          this.damageEnemy(e, 2, ddir, { feel: false, kb: 280, color: '#5ce0e6' });
        }
      }
      Particles.burst(p.x, p.y, { count: 10, colors: ['#5ce0e6'], speed: 180, life: 0.3, size: 3 });
    }

    if (p.hp <= 0) {
      // 테스트 모드 무한 부활 (F 토글): 죽음 직전 상황을 계속 테스트할 수 있다
      if (this.testMode && this.reviveMode) {
        if (Bot.enabled) Bot.onDeath(Dungeon.floor); // 층별 사망 집계
        // 루프 가드: 같은 방에서 10연속 사망(계측: 궁수 3층 452연속 소프트락) → 방 강제 클리어.
        // 실측치를 왜곡하는 병적 루프 차단 — 10회까지는 정상 집계되므로 난이도 신호는 남는다
        const rk = Dungeon.floor + ':' + Dungeon.roomIndex;
        this._loopGuard = this._loopGuard && this._loopGuard.rk === rk ? this._loopGuard : { rk, n: 0 };
        if (++this._loopGuard.n >= 10) {
          this._loopGuard.n = 0;
          for (const e of this.enemies) if (!e.neutral && !e.dead && !e.isBoss) { e.hp = 0; this.killEnemy(e, { x: 1, y: 0 }); }
          this.pendingSpawns = [];
          console.warn('[루프 가드] ' + rk + ' 강제 클리어');
        }
        p.hp = p.maxHp;
        p.invuln = 2;
        // 제자리 부활은 용암 호수 한복판 등에서 즉사 루프를 만든다 (계측: 998연속 사망) — 방 입구에서 재기
        const rs = World.playerStart();
        p.x = rs.x;
        p.y = rs.y;
        p.kbx = p.kby = 0;
        this.banner = { text: '♻ 부활 (테스트 모드)', life: 1.2, maxLife: 1.2, color: '#5ce0e6' };
        Particles.burst(p.x, p.y, { count: 16, colors: ['#5ce0e6', '#a9fff7'], speed: 160, life: 0.5, size: 3 });
        return;
      }
      // 불사조 깃털: 1회 부활
      if (p.rflags.revive && !p.reviveUsed) {
        p.reviveUsed = true;
        p.hp = 3;
        p.invuln = 2.5;
        this.banner = { text: '불사조의 깃털이 불탄다!', life: 1.8, maxLife: 1.8 };
        Renderer.shake(8, 0.5);
        AudioSys.levelup();
        Particles.burst(p.x, p.y, {
          count: 30, colors: ['#ff7043', '#ffd866', '#f7b32b'], speed: 240, life: 0.8, size: 4, gravity: -150,
        });
        return;
      }
      p.hp = 0;
      if (Bot.enabled) Bot.onDeath(Dungeon.floor); // 실사망도 집계
      // 사망 리포트 — 죽음을 다음 런의 지식으로 (무엇에게, 어디서)
      // 고어 (기획 §7): 쓰러진 자리에 퍼지는 웅덩이
      World.stampBlood(p.x, p.y, 20, 0.6);
      for (let gi = 0; gi < 7; gi++) {
        const ga = Math.random() * Math.PI * 2, gd = 12 + Math.random() * 30;
        World.stampBlood(p.x + Math.cos(ga) * gd, p.y + Math.sin(ga) * gd, 3 + Math.random() * 5, 0.45);
      }
      this.deathInfo = { src: this._lastHurtBy || '이름 모를 어둠', floor: Dungeon.floor, room: Dungeon.roomIndex };
      this.endRun(false);
      this.state = 'over';
      AudioSys.gameover();
      Renderer.shake(8, 0.5);
      Particles.burst(p.x, p.y, {
        count: 30, colors: ['#3b5dc9', '#94a1b8', '#f0c297'], speed: 220, life: 0.8, size: 4, gravity: 250,
      });
    }
  },

  spawnProjectile(kind, x, y, dir, { speed = 250, dmg = 1, slow = 0, homing = false, life = 4 } = {}) {
    // 예측 사격 (AI 고도화, 3층+): 플레이어를 정조준한 직사 탄은 이동 방향을 반쯤 읽는다.
    // 정조준 탄(코사인 0.94+)만 — 나선탄·부채꼴 가장자리 같은 패턴탄은 그대로 둔다
    if (!homing && this.bb && this.player && Dungeon.floor >= 3) {
      const p = this.player;
      const ax = p.x - x, ay = p.y - y;
      const ad = Math.hypot(ax, ay) || 1;
      if ((dir.x * ax + dir.y * ay) / ad > 0.94) {
        const t = ad / speed;
        const lx = p.x + this.bb.pvx * t * 0.5;
        const ly = p.y + this.bb.pvy * t * 0.5;
        const ld = Math.hypot(lx - x, ly - y) || 1;
        dir = { x: (lx - x) / ld, y: (ly - y) / ld };
      }
    }
    const style = PROJ_STYLES[kind] || PROJ_STYLES.arrow;
    // 사인 각인: 탄은 발사자 몸에서 태어난다 — 발사 좌표 최근접 생존 적이 곧 사수
    let by = null, bd = 48;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) { bd = d; by = this._foeName(e); }
    }
    this.arrows.push({ kind, x, y, dir, speed, dmg, slow, homing, r: style.r || 4, life, t: 0, by });
  },
};
