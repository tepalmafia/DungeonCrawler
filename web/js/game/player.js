// 플레이어 — 직업 3종 (검사: 근접 3연격 / 궁수: 화살 / 마도사: 유도 마탄).
// 타격 판정(strike)은 공용: 크리·상태이상·시너지가 모든 직업에서 동일하게 작동한다.
// 보조 스킬 (P1 슬롯 확장): 5·15·25층 '스킬 사당'에서 3택1 — E키.
// "10층만 가도 할 게 없다" 해결의 1축: 액티브 킷이 런 중간에 자란다
// 3축 스킬 개조 「원한의 세공」 — 31층 세공대에서 택1. K스킬의 성격이 바뀐다 (진화와 중첩)
const SKILL_MODS = {
  knight: [
    { id: 'kn_wide', name: '넓은 원한', desc: '참수 선회 반경 +45%, 피해 -15%', rMul: 1.45, dMul: 0.85 },
    { id: 'kn_heavy', name: '집행의 무게', desc: '참수 선회 피해 +60%, 쿨다운 +30%', dMul: 1.6, cdMul: 1.3 },
    { id: 'kn_double', name: '이중 선회', desc: '0.5초 뒤 두 번째 회전이 뒤따른다 (피해 50%)', flag: 'double' },
  ],
  archer: [
    { id: 'ar_focus2', name: '집중 낙하', desc: '뼈화살 비 반경 -30%, 화살 피해 +80%', rMul: 0.7, dMul: 1.8 },
    { id: 'ar_long', name: '긴 장마', desc: '화살 수 +60%, 반경 +15%, 피해 -15%', rMul: 1.15, sMul: 1.6, dMul: 0.85 },
    { id: 'ar_track', name: '추적하는 비', desc: '화살비가 가장 가까운 적을 따라간다', flag: 'track' },
  ],
  mage: [
    { id: 'mg_nova2', name: '초신성', desc: '별의 심판 반경 +35%, 피해 +40%, 낙하 예고 +0.3초', rMul: 1.35, dMul: 1.4, tAdd: 0.3 },
    { id: 'mg_quick', name: '유성 소나기', desc: '쿨다운 -25%, 낙하 -0.2초 — 반경 -25%, 피해 -20%', rMul: 0.75, dMul: 0.8, cdMul: 0.75, tAdd: -0.2 },
    { id: 'mg_pull', name: '별의 인력', desc: '착탄이 주변 적을 중심으로 끌어당긴다', flag: 'pull' },
  ],
  alch: [
    { id: 'al_pool', name: '응고 독배', desc: '폭발 피해 -40% — 자리에 큰 독 웅덩이가 오래 남는다', dMul: 0.6, flag: 'pool' },
    { id: 'al_throw2', name: '휘발 연투', desc: '쿨다운 -40%, 피해 -35%, 반경 -15%', rMul: 0.85, dMul: 0.65, cdMul: 0.6 },
    { id: 'al_chain', name: '연쇄 반응', desc: '상태이상 2종 이상인 적마다 소폭발이 재점화된다', flag: 'chain' },
  ],
};
function skillModOf(p2) {
  if (!p2.skillMod) return null;
  return (SKILL_MODS[p2.classId] || []).find((m) => m.id === p2.skillMod) || null;
}

const SUBSKILLS = {
  knight: [
    { id: 'sh_bash', name: '방패 올려치기', cd: 5, desc: '전방의 적을 방패로 쳐올린다 — 피해 + 강넉백' },
    { id: 'sh_execute', name: '처형 찌르기', cd: 8, desc: '돌진 찌르기 — 체력 30% 이하의 적은 그 자리에서 처형 (보스 제외)' },
    { id: 'sh_warcry', name: '전장의 포효', cd: 10, desc: '주변 적을 밀쳐내며 위축시킨다(둔화) — 자신은 잠시 무적' },
  ],
  archer: [
    { id: 'ar_trap', name: '올가미 덫', cd: 6, desc: '발밑에 덫 — 밟은 적은 감전 + 피해 (8초 유지)' },
    { id: 'ar_tumble', name: '텀블링 사격', cd: 5, desc: '뒤로 구르며(무적) 전방 3연발 부채꼴 사격' },
    { id: 'ar_volley', name: '관통 일제사', cd: 7, desc: '일직선을 꿰뚫는 강력한 관통 화살' },
  ],
  mage: [
    { id: 'mg_blink', name: '점멸', cd: 6, desc: '조준 방향으로 순간이동 — 출발점이 폭발한다' },
    { id: 'mg_nova', name: '서리 고리', cd: 7, desc: '주변을 얼려 피해 + 둔화' },
    { id: 'mg_lance', name: '마력 창', cd: 6, desc: '전방 일직선 관통 창 — 큰 피해 + 감전' },
  ],
  alch: [
    { id: 'al_smoke', name: '연막 플라스크', cd: 8, desc: '연막 지대 — 안의 적이 크게 둔화된다 (3초)' },
    { id: 'al_spray', name: '강산 살포', cd: 6, desc: '전방 부채꼴 산성 — 피해 + 중독 + 장갑 부식' },
    { id: 'al_tonic', name: '응급 조제', cd: 12, desc: 'HP 1 회복 + 3초간 이동 가속' },
  ],
};

function createPlayer(x, y, classId = 'knight') {
  const cls = CLASSES[classId] || CLASSES.knight;
  const pl = {
    x, y,
    r: 13,
    classId: cls.id,
    // 계승 (v127): 첫 정복 후 선택한 형상 — 원한이 형태를 고른다
    form: (Meta.data.wins > 0 && Meta.data.forms && Meta.data.forms[cls.id] > 0 && FORMS[cls.id])
      ? FORMS[cls.id][Meta.data.forms[cls.id] - 1].id : null,
    maxHp: cls.hp + Meta.lvl('vit') + Meta.grudgeHp(), // 사무친 원한: 막의 진실 완성마다 +1
    hp: cls.hp + Meta.lvl('vit') + Meta.grudgeHp(),
    speed: cls.speed,
    facing: { x: 1, y: 0 },
    flip: false,

    bonusAtk: Meta.lvl('pow'),
    atkCdMul: 1,
    critChance: 0.05,
    critMul: 2,
    rangeMul: 1,
    comboLv: 0,
    xpMul: 1,
    magnetMul: 1,
    luckMul: 1,
    dashRegenMul: Math.pow(0.9, Meta.lvl('dash')),
    flags: {},
    rflags: {},
    traits: [],
    relics: [],
    lifestealCd: 0,
    finisherHealCd: 0, // 전투 본능 (검사): 마무리 적중 회복 쿨다운
    reviveUsed: false,

    shield: false,
    shieldT: 0,

    combo: 0,
    comboTimer: 0,
    attackCd: 0,
    slashes: [],
    dashCritReady: false,
    pdodgeCrit: false, // 완벽 회피 보상: 다음 일격 확정 크리
    _pdodged: false,
    dashAtkT: 0, // 대시 파생기 입력 창
    _dashWin: 0, // 완벽 회피 판정 창

    // 직업 스킬 (K / 우클릭): 검사 회전 베기 / 궁수 화살비 / 마도사 메테오
    skillCd: 0,
    skillCdMul: 1,
    subSkill: null, // 보조 스킬 id (스킬 사당에서 획득)
    subCd: 0,
    tonicT: 0, // 응급 조제 이속 버프
    ult: 0,       // 궁극기 (P2): 0=없음 / 1=처형 선고(10층 보스 전리품) / 2=강화(20층)
    ultGauge: 0,  // 처치로 충전 (잡몹 1 / 정예·우두머리 4 / 보스 10)
    ultMax: 45,
    spinT: 0, // 회전 베기 연출
    skillEvolved: false, // 스킬 진화 발동됨 (회오리 베기/화살 폭풍/쌍둥이 메테오)
    evoReady: false,     // 직업 특성 3장 수집 완료 — Lv.12 도달 시 진화 (rewards.checkEvolution)
    _spinPulseT: 0,      // [진화] 회오리 베기 추가 타격 주기

    dashMax: 1,
    dashCharges: 1,
    dashRegenT: 0,
    dashTimer: 0,
    dashDir: { x: 1, y: 0 },
    dashHit: null,
    ghosts: [],
    _trailDist: 0,

    invuln: 0,
    slowT: 0,
    kbx: 0, kby: 0,
    animT: 0,
    moving: false,
    attackPoseT: 0, // 공격 자세 프레임 유지 시간
    hurtPoseT: 0, // 피격 자세 프레임 유지 시간 (공격 자세보다 우선)

    sprImg() {
      return Sprites[cls.sprite];
    },

    dashRegenTime() {
      // 무한 대시 차단 — 어떤 조합(제단 강화 × 바람걸음 × 깃털 × 폭주 기관)이라도 충전 하한을 지킨다.
      // 대시 무적(0.22s)이 상시 유지되면 회피가 아니라 면역이 된다.
      if (this.rflags.engine) return 0.45; // 폭주 기관: 최속 고정 (기존 '쿨다운 소멸'은 무한 대시라 재설계)
      return Math.max(0.6, 1.5 * this.dashRegenMul);
    },

    skillMaxCd() {
      const base = { knight: 5, archer: 6, mage: 7, alch: 6 }[this.classId] || 5;
      // 스킬 쿨 하한 (밸런스 점검): 시간 왜곡 × 직업 쿨감 3중첩 + 처치 시 -0.3s가 겹치면
      // 사실상 상시 스킬이 된다 — 최소 1.5초는 유지
      const pact = (typeof Game !== 'undefined' && Game.pacts && Game.pacts.skill) ? 1.25 : 1; // 서약 '짧은 심지'
      const mod = skillModOf(this);
      return Math.max(1.5, base * this.skillCdMul * (mod && mod.cdMul ? mod.cdMul : 1) * pact);
    },

    skillName() {
      if (this.skillEvolved) {
        return { knight: '망자의 회오리', archer: '뼈화살 폭풍', mage: '쌍성의 심판', alch: '넘치는 독배' }[this.classId];
      }
      return { knight: '참수 선회', archer: '뼈화살 비', mage: '별의 심판', alch: '독배' }[this.classId];
    },

    // 스킬 조준점 (v167): 공격과 같은 규칙 — 겨눈 곳에 떨어진다.
    // 종전엔 '가장 가까운 적'에 고정이라, 뒤의 소환술사에게 메테오를 떨구는 선택 자체가 없었다
    _skillTarget(game) {
      const dir = this.aimDir(game);
      const t = this._aimTarget;
      if (t) return { x: t.x, y: t.y };
      const reach = this.classId === 'knight' ? 150 : 260;
      if (this.aimSource() === 'mouse' && !(typeof Bot !== 'undefined' && Bot.enabled)) {
        const mx = Input.mouse.x - Renderer.offsetX, my = Input.mouse.y - Renderer.offsetY;
        const d = Math.hypot(mx - this.x, my - this.y);
        if (d > 1) { const k = Math.min(1, reach * 1.6 / d); return { x: this.x + (mx - this.x) * k, y: this.y + (my - this.y) * k }; }
      }
      return { x: this.x + dir.x * reach, y: this.y + dir.y * reach };
    },

    subSkillDef() {
      return (SUBSKILLS[this.classId] || []).find((x) => x.id === this.subSkill) || null;
    },

    // ── 궁극기 (P2): '처형 선고' — 무거운 손의 도끼를 빼앗아 그의 일을 대신한다.
    // 게이지형(처치 충전): 쿨다운이 아니라 "잘 싸우면 빨리 온다". 2단(20층 로트가르)은 위력 강화
    useUltimate(game) {
      if (this.ult <= 0 || this.ultGauge < this.ultMax) return;
      this.ultGauge = 0;
      this.invuln = Math.max(this.invuln, 1.0);
      this.attackPoseT = 0.3;
      const mul = this.ult >= 2 ? 8 : 6;
      const execTh = this.ult >= 2 ? 0.4 : 0.3;
      const atk = this.currentAtk();
      let executed = 0;
      for (const e of game.enemies) {
        if (e.dead || e.neutral) continue;
        e.phased = false; // 선고 앞에서는 숨을 곳이 없다
        const dx = e.x - this.x, dy = e.y - this.y, d = Math.hypot(dx, dy) || 1;
        const dir = { x: dx / d, y: dy / d };
        game.hitEnemy(e, atk * mul, dir, { kb: 300, crit: true });
        if (!e.dead && !e.isBoss && !e.isMini && e.hp <= e.maxHp * execTh) {
          game.hitEnemy(e, 9999, dir, { kb: 0 });
          executed++;
        }
      }
      // 연출: 처형의 종이 울린다 — 화면 전체가 핏빛으로
      game.hurtFlash = 0.3;
      Renderer.shake(9, 0.5);
      Particles.ring(this.x, this.y, { r0: 20, r1: 320, life: 0.6, color: '#8a1c2c', width: 8 });
      Particles.ring(this.x, this.y, { r0: 10, r1: 200, life: 0.45, color: '#e43b44', width: 5 });
      Particles.text(this.x, this.y - 40, '처형 선고!', { color: '#e43b44', size: 22 });
      if (executed > 0) Particles.text(this.x, this.y - 60, `${executed}명 집행`, { color: '#8a1c2c', size: 14 });
      AudioSys.roar();
      AudioSys.gameover?.();
    },

    useSubSkill(game) {
      const def = this.subSkillDef();
      if (!def) return;
      this.subCd = def.cd;
      this.attackPoseT = 0.18;
      const dir = { ...this.facing };
      const atk = this.currentAtk();
      const cone = (r, arc, fn) => {
        const base = Math.atan2(dir.y, dir.x);
        for (const e of game.enemies) {
          if (e.dead || e.phased) continue;
          const dx = e.x - this.x, dy = e.y - this.y;
          const d = Math.hypot(dx, dy);
          if (d > r + e.r) continue;
          let diff = Math.atan2(dy, dx) - base;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (Math.abs(diff) > arc / 2) continue;
          fn(e, { x: dx / (d || 1), y: dy / (d || 1) }, d);
        }
      };
      switch (def.id) {
        case 'sh_bash': { // 방패 올려치기 — 전방 강넉백
          cone(110, 1.9, (e, hd) => game.hitEnemy(e, atk * 2, hd, { kb: 430 }));
          Renderer.shake(4, 0.18);
          Particles.ring(this.x + dir.x * 40, this.y + dir.y * 40, { r0: 12, r1: 70, life: 0.25, color: '#c8d4e4', width: 4 });
          AudioSys.clank();
          break;
        }
        case 'sh_execute': { // 처형 찌르기 — 돌진 경로의 적을 꿰뚫는다 (캡슐 판정)
          this.invuln = Math.max(this.invuln, 0.3);
          const ox = this.x, oy = this.y;
          World.moveEntity(this, dir.x * 110, dir.y * 110);
          for (const e of game.enemies) {
            if (e.dead || e.phased) continue;
            const dx = e.x - ox, dy = e.y - oy;
            const t = dx * dir.x + dy * dir.y;
            if (t < -20 || t > 150) continue;
            const perp = Math.abs(dx * -dir.y + dy * dir.x);
            if (perp > 42 + e.r) continue;
            if (!e.isBoss && !e.isMini && e.hp <= e.maxHp * 0.3) {
              game.hitEnemy(e, 9999, dir, { kb: 0, crit: true });
              Particles.text(e.x, e.y - 24, '처형!', { color: '#e43b44', size: 15 });
            } else {
              game.hitEnemy(e, atk * 2, dir, { kb: 220 });
            }
          }
          Particles.burst(this.x, this.y, { count: 10, colors: ['#c8d4e4', '#e43b44'], speed: 140, life: 0.3, size: 3 });
          AudioSys.slash();
          break;
        }
        case 'sh_warcry': { // 전장의 포효 — 밀쳐내기 + 위축
          this.invuln = Math.max(this.invuln, 0.8);
          for (const e of game.enemies) {
            if (e.dead || e.phased || e.neutral) continue;
            const dx = e.x - this.x, dy = e.y - this.y, d = Math.hypot(dx, dy) || 1;
            if (d > 150 + e.r) continue;
            e.kbx = (dx / d) * 320; e.kby = (dy / d) * 320;
            e.status.shock = Math.max(e.status.shock, 2);
          }
          Particles.ring(this.x, this.y, { r0: 16, r1: 150, life: 0.4, color: '#e43b44', width: 5 });
          Renderer.shake(5, 0.25);
          AudioSys.roar();
          break;
        }
        case 'ar_trap': { // 올가미 덫 — 기본 존(1회 감전+피해) 재사용
          game.zones.push({ x: this.x, y: this.y, r: 30, life: 8, hit: new Set() });
          Particles.ring(this.x, this.y, { r0: 6, r1: 30, life: 0.3, color: '#8a5a3a', width: 3 });
          AudioSys.pickup();
          break;
        }
        case 'ar_tumble': { // 텀블링 사격 — 후방 구르기 + 3연발
          this.invuln = Math.max(this.invuln, 0.45);
          World.moveEntity(this, -dir.x * 95, -dir.y * 95);
          const base = Math.atan2(dir.y, dir.x);
          for (const off of [-0.18, 0, 0.18]) {
            const d2 = { x: Math.cos(base + off), y: Math.sin(base + off) };
            game.pbolts.push({
              kind: 'parrow', x: this.x + d2.x * 14, y: this.y + d2.y * 14,
              dir: d2, speed: 500, finisher: false, pierce: false, life: 1.1, hit: new Set(), bounces: 0,
            });
          }
          AudioSys.bow(true);
          break;
        }
        case 'ar_volley': { // 관통 일제사 — 마무리급 관통 화살
          game.pbolts.push({
            kind: 'parrow', x: this.x + dir.x * 14, y: this.y + dir.y * 14,
            dir, speed: 620, finisher: true, pierce: true, life: 1.3, hit: new Set(), bounces: 0,
          });
          Renderer.shake(2, 0.1);
          AudioSys.bow(true);
          break;
        }
        case 'mg_blink': { // 점멸 — 출발점 폭발
          const ox = this.x, oy = this.y;
          const nx = this.x + dir.x * 150, ny = this.y + dir.y * 150;
          if (!World.isSolidAt(nx, ny)) { this.x = nx; this.y = ny; }
          this.invuln = Math.max(this.invuln, 0.35);
          for (const e of game.enemies) {
            if (e.dead || e.phased) continue;
            const dx = e.x - ox, dy = e.y - oy, d = Math.hypot(dx, dy);
            if (d < 75 + e.r) game.hitEnemy(e, atk * 2, { x: dx / (d || 1), y: dy / (d || 1) }, { kb: 200 });
          }
          Particles.burst(ox, oy, { count: 14, colors: ['#c56cf0', '#8a5ac2'], speed: 170, life: 0.35, size: 3 });
          Particles.burst(this.x, this.y, { count: 8, colors: ['#c56cf0', '#e8e8f0'], speed: 90, life: 0.3, size: 3 });
          AudioSys.dash();
          break;
        }
        case 'mg_nova': { // 서리 고리
          for (const e of game.enemies) {
            if (e.dead || e.phased) continue;
            const dx = e.x - this.x, dy = e.y - this.y, d = Math.hypot(dx, dy);
            if (d > 130 + e.r) continue;
            game.hitEnemy(e, atk * 2, { x: dx / (d || 1), y: dy / (d || 1) }, { kb: 180 });
            e.status.shock = Math.max(e.status.shock, 2.5);
          }
          Particles.ring(this.x, this.y, { r0: 14, r1: 130, life: 0.35, color: '#a8d8ee', width: 5 });
          AudioSys.clank();
          break;
        }
        case 'mg_lance': { // 마력 창 — 일직선 관통
          const len = 270, wid = 36;
          for (const e of game.enemies) {
            if (e.dead || e.phased) continue;
            const dx = e.x - this.x, dy = e.y - this.y;
            const t = dx * dir.x + dy * dir.y;
            if (t < 0 || t > len) continue;
            const perp = Math.abs(dx * -dir.y + dy * dir.x);
            if (perp > wid + e.r) continue;
            game.hitEnemy(e, atk * 3, dir, { kb: 170 });
            e.status.shock = Math.max(e.status.shock, 1.5);
          }
          for (let i = 0; i < 9; i++) {
            Particles.burst(this.x + dir.x * (20 + i * 28), this.y + dir.y * (20 + i * 28), {
              count: 2, colors: ['#c56cf0', '#5ce0e6'], speed: 40, life: 0.25, size: 3,
            });
          }
          Renderer.shake(3, 0.12);
          AudioSys.bolt(true);
          break;
        }
        case 'al_smoke': { // 연막 플라스크
          game.zones.push({ x: this.x + dir.x * 60, y: this.y + dir.y * 60, r: 90, life: 3.2, kind: 'smoke', tickT: 0 });
          AudioSys.bolt(false);
          break;
        }
        case 'al_spray': { // 강산 살포 — 중독 + 장갑 부식
          cone(120, 1.8, (e, hd) => {
            game.hitEnemy(e, atk, hd, { kb: 120 });
            e.status.poison = Math.max(e.status.poison, 4);
            if (e.armorCap) { e.armorCap = 0; Particles.text(e.x, e.y - 22, '부식!', { color: '#c9d94a', size: 12 }); }
          });
          Particles.burst(this.x + dir.x * 50, this.y + dir.y * 50, { count: 16, colors: ['#c9d94a', '#6ada8a'], speed: 150, life: 0.4, size: 3 });
          AudioSys.shoot();
          break;
        }
        case 'al_tonic': { // 응급 조제
          if (this.hp < this.maxHp) {
            this.hp++;
            Particles.text(this.x, this.y - 26, '+1', { color: '#e43b44', size: 15 });
          }
          this.tonicT = 3;
          Particles.burst(this.x, this.y - 10, { count: 10, colors: ['#c9d94a', '#a7f070'], speed: 80, life: 0.4, size: 3, gravity: -100 });
          AudioSys.pickup();
          break;
        }
      }
    },

    useSkill(game) {
      this.skillCd = this.skillMaxCd();
      if (this.flags.mgward) this.invuln = Math.max(this.invuln, 0.6); // 마력 장막

      const mod = skillModOf(this);
      if (this.classId === 'knight') {
        // 회전 베기: 360° 강타 + 강넉백 + 시전 중 무적 — 포위당했을 때의 탈출 버튼
        // [진화] 회오리 베기: 1.1초간 이동하며 회전 — 0.35초마다 추가 타격 펄스
        this.spinT = this.skillEvolved ? 1.1 : 0.35;
        this._spinPulseT = this.skillEvolved ? 0.35 : 0;
        this.invuln = Math.max(this.invuln, this.skillEvolved ? 0.5 : 0.4);
        AudioSys.spin();
        Renderer.shake(4, 0.2);
        Particles.ring(this.x, this.y, { r0: 20, r1: 100, life: 0.3, color: '#4a6ede', width: 5 });
        Particles.ring(this.x, this.y, { r0: 10, r1: 70, life: 0.22, color: '#ffffff', width: 3 });
        let hits = 0;
        for (const e of game.enemies) {
          if (e.dead || e.phased) continue;
          const dx = e.x - this.x, dy = e.y - this.y;
          const d = Math.hypot(dx, dy);
          if (d > 100 * (mod && mod.rMul ? mod.rMul : 1) + e.r) continue;
          const dir = { x: dx / (d || 1), y: dy / (d || 1) };
          const dmg = Math.max(1, Math.round(this.currentAtk() * 3 * (mod && mod.dMul ? mod.dMul : 1)));
          const crit = this.rflags.allcrit || Math.random() < Math.min(0.8, this.critChance);
          game.hitEnemy(e, crit ? Math.round(dmg * this.critMul) : dmg, dir, { crit, kb: 380 });
          hits++;
        }
        // 검기 방출
        if (this.flags.kn_wave) {
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            game.pbolts.push({
              kind: 'pwave', x: this.x, y: this.y,
              dir: { x: Math.cos(a), y: Math.sin(a) },
              speed: 340, finisher: false, pierce: true, life: 0.4, hit: new Set(),
            });
          }
        }
        // 피의 회전
        if (this.flags.kn_blood && hits >= 3 && this.hp < this.maxHp && !(this.brandT > 0)) {
          this.hp++;
          Particles.text(this.x, this.y - 28, '+1', { color: '#e43b44', size: 15 });
        }
        // 개조 「이중 선회」: 두 번째 회전 예약
        if (mod && mod.flag === 'double') this._spin2T = 0.5;
      } else if (this.classId === 'archer') {
        // 화살비: 지점 광역 폭격 — [진화] 화살 폭풍: 범위·화살 수 대폭 증가
        const t = this._skillTarget(game);
        AudioSys.rainCast();
        game.rains.push({
          x: t.x, y: t.y, r: (this.skillEvolved ? 140 : 110) * (mod && mod.rMul ? mod.rMul : 1), t: 0, next: 0.25,
          shots: Math.round((this.skillEvolved ? 24 : 14) * (mod && mod.sMul ? mod.sMul : 1)), fired: 0,
          explo: this.flags.ar_explo,
          dmgMul: mod && mod.dMul ? mod.dMul : 1,
          track: !!(mod && mod.flag === 'track'),
        });
      } else if (this.classId === 'alch') {
        // 휘발성 혼합물: 지점 대폭발 + 독·화상 동시 부여 — 반응(맹독 연소)을 스스로 만든다.
        // [진화] 대반응 폭탄: 감전까지 3원소 — 과부하·마비가 연쇄한다
        const t = this._skillTarget(game);
        AudioSys.meteorCast();
        const r = Math.min(240, (this.skillEvolved ? 132 : 100) * (this.flaskRadMul || 1) * (mod && mod.rMul ? mod.rMul : 1)); // 반경 상한 240px
        game._explode(t.x, t.y, r, Math.max(1, Math.round(this.currentAtk() * 2.5 * (mod && mod.dMul ? mod.dMul : 1))), ['#c9d94a', '#6ada8a', '#ff7043'], '#c9d94a');
        if (mod && mod.flag === 'pool') game.zones.push({ x: t.x, y: t.y, r: r * 1.15 * (game.sects && game.sects.venom >= 3 ? 1.4 : 1), life: 4.5, kind: 'poison', tickT: 0.4 }); // 독 3단
        for (const e of game.enemies) {
          if (e.dead || e.phased || e.neutral) continue;
          if (Math.hypot(e.x - t.x, e.y - t.y) < r + e.r) {
            e.status.poison = Math.max(e.status.poison || 0, this.flags.al_acid ? 6 : 4);
            e.status.burn = Math.max(e.status.burn || 0, 3);
            if (this.skillEvolved) e.status.shock = Math.max(e.status.shock || 0, 2.5);
            // 개조 「연쇄 반응」: 상태 2종+ 적마다 소폭발 재점화
            if (mod && mod.flag === 'chain') {
              const st = (e.status.burn > 0 ? 1 : 0) + (e.status.poison > 0 ? 1 : 0) + (e.status.shock > 0 ? 1 : 0);
              if (st >= 2) game._explode(e.x, e.y, 46, Math.max(1, Math.round(this.currentAtk())), ['#c9d94a', '#ffd866'], '#c9d94a');
            }
          }
        }
      } else {
        // 메테오: 예고 후 대광역 낙하 — [진화] 쌍둥이 메테오: 두 번째 낙하가 뒤따른다
        const t = this._skillTarget(game);
        AudioSys.meteorCast();
        game.meteors.push({ x: t.x, y: t.y, t: 0.7 + (mod && mod.tAdd ? mod.tAdd : 0), r: 105 * (mod && mod.rMul ? mod.rMul : 1),
          dmgMul: mod && mod.dMul ? mod.dMul : 1, pull: !!(mod && mod.flag === 'pull') });
        if (this.skillEvolved) {
          const side = Math.random() < 0.5 ? -1 : 1;
          game.meteors.push({ x: t.x + side * 120, y: t.y + (Math.random() - 0.5) * 90, t: 1.0, r: 105 });
        }
        if (this.flags.mg_meteor3) {
          for (let i = 0; i < 2; i++) {
            game.meteors.push({
              x: t.x + (Math.random() - 0.5) * 190,
              y: t.y + (Math.random() - 0.5) * 150,
              t: 0.9 + i * 0.25, r: 90,
            });
          }
        }
      }
    },

    update(dt, game) {
      this.animT += dt;
      if (this.attackCd > 0) this.attackCd -= dt;
      if (this.attackPoseT > 0) this.attackPoseT -= dt;
      if (this.hurtPoseT > 0) this.hurtPoseT -= dt;
      if (this.subCd > 0) this.subCd -= dt;
      if (this.tonicT > 0) this.tonicT -= dt;
      // 개조 「이중 선회」: 예약된 두 번째 회전
      if (this._spin2T > 0) {
        this._spin2T -= dt;
        if (this._spin2T <= 0) {
          this.spinT = 0.3;
          this.invuln = Math.max(this.invuln, 0.3);
          AudioSys.spin();
          Particles.ring(this.x, this.y, { r0: 16, r1: 90, life: 0.25, color: '#4a6ede', width: 4 });
          const mod2 = skillModOf(this);
          const rr = 100 * (mod2 && mod2.rMul ? mod2.rMul : 1);
          for (const e of game.enemies) {
            if (e.dead || e.phased || e.neutral) continue;
            const dx = e.x - this.x, dy = e.y - this.y, d = Math.hypot(dx, dy);
            if (d > rr + e.r) continue;
            const dmg = Math.max(1, Math.round(this.currentAtk() * 1.5));
            game.hitEnemy(e, dmg, { x: dx / (d || 1), y: dy / (d || 1) }, { kb: 300 });
          }
        }
      }
      if (this.skillCd > 0) {
        this.skillCd -= dt;
        if (this.skillCd <= 0) {
          // 스킬 준비 완료 — 은은한 차임 + 표시 (잊고 안 쓰는 것 방지)
          AudioSys.skillReady();
          Particles.text(this.x, this.y - 36, this.skillName() + ' 준비!', { color: '#5ce0e6', size: 12 });
        }
      }
      if (this.spinT > 0) {
        this.spinT -= dt;
        // [진화] 회오리 베기: 회전이 유지되는 동안 주기적 추가 타격 (이동하며 썰어낸다)
        if (this.skillEvolved && this.classId === 'knight' && this._spinPulseT > 0) {
          this._spinPulseT -= dt;
          if (this._spinPulseT <= 0 && this.spinT > 0.05) {
            this._spinPulseT = 0.35;
            Particles.ring(this.x, this.y, { r0: 14, r1: 96, life: 0.25, color: '#4a6ede', width: 4 });
            for (const e of game.enemies) {
              if (e.dead || e.phased) continue;
              const dx = e.x - this.x, dy = e.y - this.y;
              const d = Math.hypot(dx, dy);
              if (d > 96 + e.r) continue;
              const dir = { x: dx / (d || 1), y: dy / (d || 1) };
              const dmg = Math.max(1, Math.round(this.currentAtk() * 1.5));
              const crit = this.rflags.allcrit || Math.random() < Math.min(0.8, this.critChance);
              game.hitEnemy(e, crit ? Math.round(dmg * this.critMul) : dmg, dir, { crit, kb: 260 });
            }
          }
        }
      }
      if (this.comboTimer > 0) this.comboTimer -= dt; else this.combo = 0;
      if (this.invuln > 0) this.invuln -= dt;
      if (this.lifestealCd > 0) this.lifestealCd -= dt;
      if (this._overchargeCd > 0) this._overchargeCd -= dt;
      if (this.dashAtkT > 0) this.dashAtkT -= dt;
      if (this._huntT > 0) this._huntT -= dt;
      if (this._dashWin > 0) this._dashWin -= dt;
      if (this.finisherHealCd > 0) this.finisherHealCd -= dt;
      if (this.slowT > 0) this.slowT -= dt;
      if (this._chaliceT > 0) this._chaliceT -= dt;
      if (this._hornT > 0) this._hornT -= dt;
      if (this._panicT > 0) this._panicT -= dt;
      if (this._peltCd > 0) this._peltCd -= dt;
      if (this._reaperT > 0) this._reaperT -= dt; // 사신의 걸음 (v151)
      if (this._vengeT > 0) this._vengeT -= dt;   // 원한 폭주 (v151)

      if (this.dashCharges < this.dashMax) {
        this.dashRegenT += dt;
        if (this.dashRegenT >= this.dashRegenTime()) {
          this.dashRegenT = 0;
          this.dashCharges++;
        }
      }

      // 보호막 충전: 수호의 문장 특성(8초) 또는 검사 고유 '철벽'(9초)
      // 매트릭스 계측: 검사 사망이 심층(8~10층) 접촉 피해에 집중 — 철벽 11→9로 근접 리스크 보상
      const sectG = (typeof Game !== 'undefined' && Game.sects && Game.sects.guard >= 1) ? 0.85 : 1; // 수호 1단: 충전 -15%
      const shieldCd = (this.flags.shield ? 8 : this.rflags.ringshield ? 10 : (this.classId === 'knight' ? (this.form === 'guard' ? 5.4 : 9) : 0)) * sectG; // 수호망령: 철벽 40% 단축
      if (shieldCd > 0 && !this.shield) {
        this.shieldT += dt;
        if (this.shieldT >= shieldCd) {
          this.shield = true;
          this.shieldT = 0;
          Particles.burst(this.x, this.y, { count: 8, colors: ['#5ce0e6'], speed: 60, life: 0.4, size: 3 });
        }
      }

      let mx = 0, my = 0;
      if (Input.down('KeyA', 'ArrowLeft')) mx -= 1;
      if (Input.down('KeyD', 'ArrowRight')) mx += 1;
      if (Input.down('KeyW', 'ArrowUp')) my -= 1;
      if (Input.down('KeyS', 'ArrowDown')) my += 1;
      const len = Math.hypot(mx, my);
      if (len > 0) {
        mx /= len; my /= len;
        this.facing = { x: mx, y: my };
        if (mx !== 0) this.flip = mx < 0;
      }
      this.moving = len > 0;

      // v160: 조건을 먼저 본다 — 대시 충전이 없으면 버퍼를 소비하지 않고 남겨,
      // 충전이 차오르는 순간 눌러둔 대시가 나간다 (선입력 버퍼의 핵심 규칙)
      if (this.dashCharges >= 1 && Input.take('Space', 'ShiftLeft', 'ShiftRight')) {
        this.dashCharges--;
        this.dashTimer = 0.16;
        this.invuln = Math.max(this.invuln, 0.22);
        this.dashDir = len > 0 ? { x: mx, y: my } : { ...this.facing };
        this._trailDist = 0;
        this.dashHit = new Set();
        this._pdodged = false; // 완벽 회피: 대시당 1회
        this._dashWin = this.rflags.bell ? 0.38 : 0.24; // 완벽 회피 판정 창 — 무덤의 종은 창을 넓힌다
        // 게임필 (v138): 대시 먼지 — 발끝에서 흙이 튄다 (이동에 무게가 실린다)
        Particles.burst(this.x, this.y + 12, {
          count: 6, colors: ['#8a8074', '#5a5347', '#6e675c'], speed: 90, life: 0.35, size: 2,
          dir: Math.atan2(-this.dashDir.y, -this.dashDir.x), spread: 0.9, gravity: 60,
        });
        this.dashAtkT = 0.35; // 대시 파생기 입력 창: 대시 중 + 직후 0.19초 (0.16초는 너무 빡빡했다)
        if (this.flags.hunterstep) this._huntT = 1.5; // 사냥꾼의 호흡: 대시 후 공속 창
        if (this.rflags.dashcrit) this.dashCritReady = true;
        // 불꽃 대시 (특성): 대시 궤적에 불타는 자취
        if (this.flags.dashfire) {
          for (let k = 0; k < 3; k++) {
            game.zones.push({
              x: this.x + this.dashDir.x * k * 34, y: this.y + this.dashDir.y * k * 34,
              r: 26, life: 1.6, kind: 'fire', tickT: 0.15 + k * 0.1, hit: null,
            });
          }
        }
        AudioSys.dash();
        Particles.burst(this.x, this.y, {
          count: 8, colors: ['#8a8aa0', '#5c5c74'], speed: 60, life: 0.35, size: 3,
        });
      }

      if (this.dashTimer > 0) {
        this.dashTimer -= dt;
        const step = 560 * dt;
        World.moveEntity(this, this.dashDir.x * step, this.dashDir.y * step);
        this.ghosts.push({ x: this.x, y: this.y, flip: this.flip, life: 0.25 });

        if (this.flags.shocktrail) {
          this._trailDist += step;
          if (this._trailDist >= 26) {
            this._trailDist = 0;
            game.zones.push({ x: this.x, y: this.y, r: 26, life: 1.2, hit: new Set() });
          }
        }
        if (this.flags.ram) {
          for (const e of game.enemies) {
            if (e.dead || this.dashHit.has(e) || e.phased) continue;
            if (Math.hypot(e.x - this.x, e.y - this.y) < e.r + this.r + 4) {
              this.dashHit.add(e);
              game.hitEnemy(e, 1, { ...this.dashDir }, { kb: 260 });
            }
          }
        }
      } else if (len > 0) {
        // 클리어 가속 (v140, 몰입 계측 처방): 방을 비운 순간부터 다음 방까지 +20% —
        // 로밍 타임(마도사 28.8% 실측)이 몰입을 끊는 유일한 구간이었다
        const clearMul = (typeof Game !== 'undefined' && Game.roomCleared) ? 1.2 : 1;
        const spd = this.speed * (this.slowT > 0 ? 0.55 : 1) * (this.tonicT > 0 ? 1.35 : 1) * (this._panicT > 0 ? 1.4 : 1) * clearMul *
          (this.flags.reapstep && this._reaperT > 0 ? 1.3 : 1); // 사신의 걸음 (v151)
        World.moveEntity(this, mx * spd * dt, my * spd * dt);
      }

      if (Math.abs(this.kbx) > 1 || Math.abs(this.kby) > 1) {
        World.moveEntity(this, this.kbx * dt, this.kby * dt);
        this.kbx *= Math.pow(0.005, dt);
        this.kby *= Math.pow(0.005, dt);
      }

      for (let i = this.ghosts.length - 1; i >= 0; i--) {
        this.ghosts[i].life -= dt;
        if (this.ghosts[i].life <= 0) this.ghosts.splice(i, 1);
      }

      // 스킬 (K / 우클릭)
      if (this.subSkill && this.subCd <= 0 && this.dashTimer <= 0 && Input.take('KeyE')) {
        this.useSubSkill(game);
      }
      if (this.ult > 0 && this.ultGauge >= this.ultMax && this.dashTimer <= 0 && Input.take('KeyR')) {
        this.useUltimate(game);
      }
      if (this.skillCd <= 0 && this.dashTimer <= 0 && Input.take('KeyK', 'Mouse2')) {
        this.useSkill(game);
      }

      // 조준은 매 프레임 갱신한다 — 브래킷이 '지금 겨눈 대상'을 실시간으로 보여주도록 (v167).
      // 공격할 때만 계산하면 화면이 한 박자 늦은 거짓말을 한다
      const aim = this.aimDir(game);

      // 공격 입력 (v160): ① 선입력 버퍼 ② 마우스/J 홀드 연사.
      // 쿨이 남아 있으면 take를 부르지 않는다 — 버퍼가 살아 쿨 종료 즉시 첫 타가 나간다.
      const byMouse = Input.mouse.down || Input.mouse.justDown || Input.buf.Mouse0 > 0;
      const attackInput = this.attackCd <= 0 &&
        (Input.take('KeyJ', 'Mouse0') || Input.mouse.down || Input.down('KeyJ'));
      // 대시 파생기 (P2): 대시 중·직후 입력 창(0.35초) 안에 공격 — 직업별 특수기
      if (attackInput && this.dashAtkT > 0) {
        this.dashAttack(game);
      } else if (attackInput && this.dashTimer <= 0) {
        this.attack(aim, game); // v167: 조준은 플레이어의 것
      }

      for (let i = this.slashes.length - 1; i >= 0; i--) {
        this.slashes[i].life -= dt;
        if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
      }
    },

    // ══ 조준 (v167) — 조준은 플레이어의 것이다 ═══════════════════════════
    // 종전엔 autoTarget이 **가장 가까운 적**을 대신 골랐다. 그래서 로그라이크 전투에서
    // 가장 자주 내리는 결정 — "누구를 먼저 칠까" — 가 통째로 사라져 있었다.
    // 소환술사를 먼저 끊을지, 돌진해 오는 놈을 먼저 칠지, 뒤의 저격수를 볼지를
    // 이제 플레이어가 정한다. 대신 픽셀 정밀도는 요구하지 않는다 — 겨눈 근처면 붙는다.
    aimSource() {
      // 최근 2.5초 안에 마우스를 움직였거나 누르고 있으면 '마우스로 조준 중'.
      // 키보드만 쓰는 사람이 가만히 놓인 커서에 끌려가면 안 된다
      const t = (Input.mouse.moveT || -999);
      return (Input.mouse.down || (performance.now() / 1000 - t) < 2.5) && Input.mouse.x > -9000
        ? 'mouse' : 'move';
    },

    aimDir(game) {
      // 봇은 마우스가 없다 — 계측 인프라를 보존하려 종전 자동 조준을 그대로 쓴다
      if (typeof Bot !== 'undefined' && Bot.enabled) {
        const t = this.autoTarget(game);
        this._aimTarget = t;
        if (t) { const dx = t.x - this.x, dy = t.y - this.y, d = Math.hypot(dx, dy) || 1; return { x: dx / d, y: dy / d }; }
        return { ...this.facing };
      }
      let base;
      if (this.aimSource() === 'mouse') {
        const dx = Input.mouse.x - Renderer.offsetX - this.x;
        const dy = Input.mouse.y - Renderer.offsetY - this.y;
        const d = Math.hypot(dx, dy) || 1;
        base = { x: dx / d, y: dy / d };
      } else {
        base = { ...this.facing };
      }
      return this._snapAim(game, base);
    },

    // 소프트 스냅 — 조준선에서 일정 각 안에 있는 적 중 **각도가 가장 가까운** 놈에게 붙는다.
    // '가장 가까운 적'이 아니라 '가장 겨눈 적'이라는 점이 핵심이다: 겨눈 대상이 곧 표적이다
    _snapAim(game, base) {
      const maxRange = this.classId === 'knight' ? 240 : this.classId === 'archer' ? 440 : 520;
      const SNAP = this.aimSource() === 'mouse' ? 0.24 : 0.40; // 마우스 ≈14° · 키보드 ≈23°
      const a0 = Math.atan2(base.y, base.x);
      let best = Infinity, target = null;
      for (const e of game.enemies) {
        if (e.dead || e.phased || e.spawnT > 0 || e.neutral) continue;
        const dx = e.x - this.x, dy = e.y - this.y;
        const d = Math.hypot(dx, dy);
        if (d > maxRange) continue;
        let diff = Math.atan2(dy, dx) - a0;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        // 몸이 겹치는 근접 거리에선 창을 넓힌다 — 붙어 있는데 안 맞으면 그건 답답함이지 난이도가 아니다
        const win = SNAP * (d < 90 ? 1.7 : 1);
        const ad = Math.abs(diff);
        if (ad < win && ad < best) { best = ad; target = e; }
      }
      this._aimTarget = target;
      if (!target) return base;
      const dx = target.x - this.x, dy = target.y - this.y, d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d };
    },

    // 자동 타겟: 사거리 내 가장 가까운 적 (비물질 망령 제외) — 봇 전용으로 남는다
    autoTarget(game) {
      const maxRange = this.classId === 'knight' ? 240 : this.classId === 'archer' ? 440 : 520;
      let best = maxRange;
      let target = null;
      for (const e of game.enemies) {
        if (e.dead || e.phased || e.spawnT > 0 || e.neutral) continue; // 항아리 등 중립 개체는 조준 안 함
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d < best) { best = d; target = e; }
      }
      return target;
    },

    currentAtk() {
      let atk = 1 + this.bonusAtk + (this.floorAtk || 0); // floorAtk: 모닥불 담금질 (이번 층 한정)
      if (this.form === 'venge') atk += Math.min(8, this._vs || 0) * 0.4; // 복수귀: 원한 중첩
      if (this._chaliceT > 0) atk += 1; // 성배를 삼킨 자: 하트의 힘
      if (this.flags.bloodpact && this.hp >= this.maxHp) atk += 1; // DPS 리그: +2는 +59%로 과함
      if (this.flags.berserk && this.hp <= 2) atk += 1;
      if (this.rflags.berserkhelm && this.hp <= 3) atk += 4; // 에픽 가치 밴드 보정
      if (this._hornT > 0) atk += 1; // 뿔나팔: 파생기의 여세
      if (this.rflags.blackcandle && typeof Game !== 'undefined') atk += (Game.heat || 0) * 0.5; // 검은 초: 저주가 힘이 된다
      if (this.rflags.debt && typeof Game !== 'undefined') atk += Math.min(5, Math.floor((Game.gold || 0) / 60)); // 차용증: 빚이 무기가 된다
      if (this.rflags.nail) atk += (this.maxHp - this.hp) * 0.7; // 관의 못: 상처가 힘이다
      if (this.rflags.lastwill && typeof Meta !== 'undefined') atk += Meta.clueCount() * 0.15; // 유언장: 진실의 무게
      if (this.flags.collector) atk += Math.floor(this.relics.length / 2); // 수집가 (v151): 유물 2개당 +1
      if (this.flags.vengeblood && this._vengeT > 0) atk += 3; // 원한 폭주 (v151): 상처가 칼이 된다
      return atk;
    },

    // ── 공용 타격 판정: 크리·추가피해·상태이상·연쇄를 한 곳에서 ──
    // 반환: 'blocked' | 'hit'
    strike(game, e, hitDir, { finisher = false, kb = 190, dmgMul = 1 } = {}) {
      if (e.blocksFrom && e.blocksFrom(hitDir)) {
        Particles.text(e.x, e.y - 22, '막힘', { color: '#5ce0e6', size: 13 });
        Particles.burst(e.x - hitDir.x * 12, e.y - hitDir.y * 12, {
          count: 5, colors: ['#5ce0e6', '#94a1b8'], speed: 90, life: 0.25, size: 2,
        });
        AudioSys.clank();
        return 'blocked';
      }

      // 번개 2단 (v137): 감전된 적은 급소가 드러난다 — 크리 +15%p
      const voltCc = (game.sects && game.sects.volt >= 2 && e.status && e.status.shock > 0) ? 0.15 : 0;
      let crit = Math.random() < Math.min(0.8, this.critChance + voltCc);
      if (this.rflags.allcrit) crit = true;
      if (this.flags.firecrit && e.status.burn > 0) crit = true;
      if (this.dashCritReady) { crit = true; this.dashCritReady = false; }
      if (this.pdodgeCrit) { crit = true; this.pdodgeCrit = false; } // 완벽 회피 보상: 다음 일격 확정 크리
      if (this.flags.firststrike && this._fsReady) { crit = true; this._fsReady = false; Particles.text(e.x, e.y - 34, '선제일격!', { color: '#c9b8e8', size: 13 }); }

      // ✦ 완력의 정점 (v169 — 힘 단련 3장): 타격이 적을 두 배로 밀어낸다.
      // v168 분리력과 맞물려 **전선을 밀어내는 무기**가 된다 — 벽꽂기 피해까지 이어진다
      if (this.flags.atkPeak) kb = Math.round(kb * 2);
      // ✦ 간파의 정점 (v169 — 급소 간파 3장): 크리티컬이 그 적의 접촉 예고를 지운다.
      // "크리가 터지면 한 대 안 맞는다" — 확률 스탯이 **방어 행동**으로 번역된다
      if (crit && this.flags.critPeak && e._windT > 0) {
        e._windT = 0; e.hitCd = Math.max(e.hitCd, 0.7);
        Particles.text(e.x, e.y - 30, '끊었다', { color: '#ffd866', size: 12 });
      }

      let bonus = 0;
      if (this.flags.corrode && e.status.poison > 0) bonus += 1;
      if (this.flags.static && e.status.shock > 0) bonus += 2; // 번개 트리 상향
      if (this.flags.execeye && e.hp <= e.maxHp * 0.3) bonus += 2; // 처형인의 눈 (v151)
      if (this.flags.duelist && !e.isBoss && game.enemies.filter((o) => !o.dead && !o.neutral && !o.phased).length === 1) bonus += 3; // 결투가 (v151)

      const baseDmg = this.currentAtk();
      let dmg = finisher ? Math.round(baseDmg * (2 + this.comboLv + (this.flags.bowmaster ? 1 : 0))) : baseDmg;
      if (finisher && this.rflags.knell) dmg = Math.round(dmg * 1.3); // 세 번째 타종: 마지막 울림이 가장 크다
      if (this.flags.greatsword) dmg = Math.round(dmg * 2.2); // 대검화: 느리고 무겁게
      if (this.flags.gambler && !crit) dmg = Math.max(1, dmg - 1); // 도박사의 피 (v151): 비크리는 무디다
      const finalDmg = Math.max(1, Math.round(((crit ? Math.round(dmg * this.critMul) : dmg) + bonus) * dmgMul));
      game.hitEnemy(e, finalDmg, hitDir, { crit, kb });
      // 메아리 일격 (v151): 네 번째 일격마다 잔격 50% — 리듬이 손에 익는 순간을 만든다
      if (this.flags.echostrike && !e.dead) {
        this._echoN = (this._echoN || 0) + 1;
        if (this._echoN % 4 === 0) {
          game.damageEnemy(e, Math.max(1, Math.round(finalDmg * 0.5)), hitDir, { feel: false, kb: 80, color: '#c9b8e8' });
          Particles.text(e.x, e.y - 26, '메아리', { color: '#c9b8e8', size: 12 });
        }
      }

      if (this.flags.ignite && !e.dead && Math.random() < 0.25) {
        e.status.burn = this.flags.inferno ? 4 : 2;
        Particles.burst(e.x, e.y, { count: 4, colors: ['#ff7043', '#ffd866'], speed: 60, life: 0.3, size: 3 });
      }
      if (this.flags.poison && !e.dead && Math.random() < 0.3) {
        e.status.poison = 4;
        Particles.burst(e.x, e.y, { count: 4, colors: ['#6ab04c'], speed: 60, life: 0.3, size: 3 });
      }
      if (this.flags.chain && Math.random() < 0.3) { // 번개 트리 상향 (20%→30%)
        let nearest = null;
        let best = 170;
        for (const o of game.enemies) {
          if (o === e || o.dead || o.phased) continue;
          const od = Math.hypot(o.x - e.x, o.y - e.y);
          if (od < best) { best = od; nearest = o; }
        }
        if (nearest) {
          nearest.status.shock = 2;
          game.damageEnemy(nearest, 2, { x: 0, y: 0 }, { feel: false, kb: 60, color: '#ffd866' });
          const steps = 6;
          for (let s = 0; s <= steps; s++) {
            const lx = e.x + ((nearest.x - e.x) * s) / steps + (Math.random() - 0.5) * 10;
            const ly = e.y + ((nearest.y - e.y) * s) / steps + (Math.random() - 0.5) * 10;
            Particles.burst(lx, ly, { count: 1, colors: ['#ffd866', '#fff7c0'], speed: 15, life: 0.2, size: 3 });
          }
        }
      }
      return 'hit';
    },

    attack(dir, game) {
      const finisher = this.combo === 2;
      const comboStep = this.combo; // 사운드용: 0/1/2타
      this.comboTimer = 0.9;
      this.combo = (this.combo + 1) % 3;

      let cdBase;
      if (this.classId === 'knight') cdBase = finisher ? 0.45 : 0.22;
      else if (this.classId === 'archer') cdBase = finisher ? 0.58 : 0.33; // 밸런스: 원거리 저위험 보상
      else if (this.classId === 'alch') cdBase = finisher ? 0.74 : 0.50; // 밴드 계측: 2·3사망(검사의 34%) — 전탄 광역의 대가로 더 느리게
      else cdBase = finisher ? 0.58 : 0.32;
      let cd = cdBase * this.atkCdMul;
      if (this.flags.berserk && this.hp <= 2) cd *= 0.7;
      if (this.flags.underdog && this.hp <= this.maxHp / 2) cd *= 0.75; // 역전의 명수 (v151)
      if (this._huntT > 0) cd *= 0.7; // 사냥꾼의 호흡
      // 공속 하한 (밸런스 점검): 신속×4 + 민첩의 룬 + 광폭 중첩 시 10타/초까지 치솟는 폭주 차단
      this.attackCd = Math.max(0.12, cd);
      this.attackPoseT = 0.18;
      if (dir.x !== 0) this.flip = dir.x < 0; // 공격 방향을 바라본다

      if (this.classId === 'knight') {
        this._meleeAttack(dir, game, finisher, comboStep);
      } else if (this.classId === 'archer') {
        AudioSys.bow(finisher);
        World.moveEntity(this, -dir.x * 5, -dir.y * 5); // 반동
        // 이중 사격: 부채꼴 2발
        let angles = this.flags.ar_double ? [-0.11, 0.11] : [0];
        if (this.flags.twinbow) angles = angles.length === 2 ? [-0.2, -0.07, 0.07, 0.2] : [-0.13, 0.13]; // 쌍궁
        for (const off of angles) {
          const a = Math.atan2(dir.y, dir.x) + off;
          const d2 = { x: Math.cos(a), y: Math.sin(a) };
          game.pbolts.push({
            kind: 'parrow', x: this.x + d2.x * 14, y: this.y + d2.y * 14,
            dir: d2, speed: finisher ? 560 : 480,
            finisher, pierce: finisher, life: 1.1, hit: new Set(),
            bounces: this.flags.rebound ? 1 : 0, // 도탄 특성
          });
        }
        // 머즐 플래시 — 시위를 놓는 순간의 방향성 섬광
        Particles.burst(this.x + dir.x * 18, this.y + dir.y * 18, {
          count: finisher ? 7 : 4, colors: ['#ffffff', '#d9cbb8', '#38b764'],
          speed: 170, life: 0.18, size: 2, dir: Math.atan2(dir.y, dir.x), spread: 0.5,
        });
      } else if (this.classId === 'alch') {
        // 플라스크 투척: 모든 착탄이 소형 산성 폭발(중독) — 반응의 밑재료를 상시 뿌린다
        AudioSys.bolt(finisher);
        const throwOnce = (off) => {
          const a = Math.atan2(dir.y, dir.x) + off;
          const d2 = { x: Math.cos(a), y: Math.sin(a) };
          game.pbolts.push({
            kind: 'pflask', x: this.x + d2.x * 14, y: this.y + d2.y * 14,
            dir: d2, speed: (finisher ? 310 : 360) * (this.flags.al_catalyst ? 0.85 : 1),
            finisher, pierce: false, homing: 0,
            aoe: Math.min(140, Math.round((finisher ? 56 : 36) * (this.flaskRadMul || 1))), // 밴드 하향: 42/64→36/56
            venom: true, catalyst: this.flags.al_catalyst,
            life: 1.4, hit: new Set(),
            bounces: this.flags.rebound ? 1 : 0,
          });
        };
        throwOnce(0);
        if (this.flags.al_double && Math.random() < 0.2) throwOnce(0.16); // 쌍병 투척
        // 투척 순간 액체 튐 — 병 주둥이에서 흩날리는 산성 방울
        Particles.burst(this.x + dir.x * 18, this.y + dir.y * 18, {
          count: finisher ? 8 : 5, colors: ['#ffffff', '#c9d94a', '#6ada8a'],
          speed: 150, life: 0.22, size: 2, dir: Math.atan2(dir.y, dir.x), spread: 0.8, gravity: 120,
        });
      } else {
        AudioSys.bolt(finisher);
        // 파이어볼: 관통 + 상시 착탄 폭발
        const fireball = this.flags.mg_fireball;
        game.pbolts.push({
          kind: 'pbolt', x: this.x + dir.x * 14, y: this.y + dir.y * 14,
          dir: { ...dir }, speed: (finisher ? 260 : 300) * (this.flags.mgsnipe ? 1.9 : 1),
          finisher, pierce: fireball, homing: this.flags.mgsnipe ? 0 : 5.0,
          aoe: finisher ? (this.form === 'star' ? 98 : 70) : (fireball ? 40 : (this.flags.mgsnipe ? 35 : 0)), // 별의 인도자: 대원혼탄 +40%
          fire: fireball,
          life: 2.0, hit: new Set(),
          bounces: this.flags.rebound ? 1 : 0, // 도탄 특성
        });
        // 시전 섬광 — 지팡이 끝에서 마력이 터진다
        Particles.burst(this.x + dir.x * 18, this.y + dir.y * 18, {
          count: finisher ? 8 : 5, colors: fireball ? ['#ffffff', '#ff7043', '#ffd866'] : ['#ffffff', '#c56cf0', '#8a5ac2'],
          speed: 160, life: 0.2, size: 2, dir: Math.atan2(dir.y, dir.x), spread: 0.6,
        });
      }

      // 지진파 (특성): 마무리 일격이 전방으로 관통 충격파를 쏜다
      if (finisher && this.flags.quake) {
        game.pbolts.push({
          kind: 'pwave', x: this.x + dir.x * 12, y: this.y + dir.y * 12,
          dir: { ...dir }, speed: 330, finisher: false, pierce: true, life: 0.55, hit: new Set(),
        });
      }
    },

    // 대시 파생기 — 대시의 기세를 공격으로 잇는다 (손맛 동사 확장)
    dashAttack(game) {
      this.attackCd = 0.5 * this.atkCdMul;
      this.attackPoseT = 0.18;
      this.dashAtkT = 0; // 파생기는 대시당 1회
      const dir = { ...this.dashDir };
      const angle = Math.atan2(dir.y, dir.x);
      if (dir.x !== 0) this.flip = dir.x < 0;
      // 파생기 체감: 순간 잔상 + 흔들림 + 발동 표시
      Renderer.shake(3, 0.14);
      Particles.text(this.x, this.y - 34, '파생기!', { color: '#5ce0e6', size: 13 });
      this.ghosts.push({ x: this.x, y: this.y, flip: this.flip, life: 0.3 });
      if (this.rflags.horn) this._hornT = 2; // 뿔나팔: 파생기가 사냥의 여세를 연다

      if (this.classId === 'knight') {
        // 돌진 찌르기: 좁고 긴 관통 일격 (대시 방향으로 꿰뚫는다)
        AudioSys.slash(2);
        this.slashes.push({ angle, range: 108, arc: 0.7, life: 0.14, maxLife: 0.14, finisher: true });
        World.moveEntity(this, dir.x * 14, dir.y * 14);
        for (const e of game.enemies) {
          if (e.dead || e.phased) continue;
          const dx = e.x - this.x, dy = e.y - this.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 108 + e.r) continue;
          let diff = Math.atan2(dy, dx) - angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (Math.abs(diff) > 0.35 + 0.25) continue;
          const hitDir = { x: dx / (dist || 1), y: dy / (dist || 1) };
          const dmg = Math.round(this.currentAtk() * 2);
          let crit = this.rflags.allcrit || Math.random() < Math.min(0.8, this.critChance);
          if (this.pdodgeCrit) { crit = true; this.pdodgeCrit = false; }
          game.hitEnemy(e, crit ? Math.round(dmg * this.critMul) : dmg, hitDir, { crit, kb: 360 });
        }
      } else if (this.classId === 'archer') {
        // 후퇴 사격: 물러나며 3발 부채꼴 — 카이팅의 리듬
        AudioSys.bow(true);
        World.moveEntity(this, -dir.x * 30, -dir.y * 30);
        for (const off of [-0.22, 0, 0.22]) {
          const a = angle + off;
          const d2 = { x: Math.cos(a), y: Math.sin(a) };
          game.pbolts.push({
            kind: 'parrow', x: this.x + d2.x * 14, y: this.y + d2.y * 14,
            dir: d2, speed: 540, finisher: false, pierce: false, life: 1.0, hit: new Set(),
            bounces: this.flags.rebound ? 1 : 0,
          });
        }
      } else if (this.classId === 'alch') {
        // 후퇴 투척: 물러나며 큰 플라스크 — 카이팅의 리듬
        AudioSys.bolt(true);
        World.moveEntity(this, -dir.x * 26, -dir.y * 26);
        game.pbolts.push({
          kind: 'pflask', x: this.x + dir.x * 14, y: this.y + dir.y * 14,
          dir: { ...dir }, speed: 380, finisher: true, pierce: false, homing: 0,
          aoe: Math.min(150, Math.round(58 * (this.flaskRadMul || 1))), venom: true, catalyst: this.flags.al_catalyst,
          life: 1.2, hit: new Set(),
        });
      } else {
        // 점멸 폭발: 대시로 빠져나온 자리가 터진다
        AudioSys.bolt(true);
        game._explode(
          this.x - dir.x * 34, this.y - dir.y * 34, 80,
          Math.max(1, Math.round(this.currentAtk() * 1.5)),
          ['#c56cf0', '#8a5ac2', '#ffd866'], '#c56cf0');
      }
    },

    _meleeAttack(dir, game, finisher, comboStep = 0) {
      const range = (finisher ? 94 : 77) * this.rangeMul; // 밸런스: 근접 리스크 보상 (+10% 상향)
      const arc = finisher ? 2.4 : 1.9;
      const angle = Math.atan2(dir.y, dir.x);
      AudioSys.slash(comboStep);
      if (finisher) {
        // 마무리 일격: 살짝 파고들며 화면이 함께 울린다
        World.moveEntity(this, dir.x * 6, dir.y * 6);
        Renderer.shake(2.5, 0.12);
      }

      this.slashes.push({
        angle, range, arc,
        life: finisher ? 0.16 : 0.12,
        maxLife: finisher ? 0.16 : 0.12,
        finisher,
        rev: comboStep === 1, // 2타는 역방향 스윙 — 왕복 베기의 리듬
        step: comboStep,
      });

      // 칼날 궤적 스파크 (부채꼴 가장자리를 따라)
      const sparkN = finisher ? 7 : 4;
      for (let i = 0; i < sparkN; i++) {
        const a = angle + (i / (sparkN - 1) - 0.5) * arc;
        Particles.burst(this.x + Math.cos(a) * range * 0.9, this.y + Math.sin(a) * range * 0.9, {
          count: 1, colors: finisher ? ['#ffd866', '#fff7c0'] : ['#ffffff', '#c8d4e4'],
          speed: 60, life: 0.22, size: 2, dir: a, spread: 0.6,
        });
      }

      World.moveEntity(this, dir.x * 10, dir.y * 10);

      let hitAny = false;
      for (const e of game.enemies) {
        if (e.dead || e.phased) continue;
        const dx = e.x - this.x;
        const dy = e.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > range + e.r) continue;
        let diff = Math.atan2(dy, dx) - angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) > arc / 2 + 0.25) continue;

        const hitDir = { x: dx / (dist || 1), y: dy / (dist || 1) };
        this.strike(game, e, hitDir, { finisher, kb: finisher ? 320 : 190 });
        hitAny = true;
      }
      if (hitAny && finisher) {
        Renderer.shake(3, 0.15);
        game.hitstop = Math.max(game.hitstop, 0.045); // 3타가 박히는 찰나 — 세계가 반박자 멈춘다
        // 전투 본능 (검사 고유): 마무리 일격이 적중하면 HP 1 회복 (6초에 한 번)
        // — 근접의 리스크를 "잘 싸우면 버틴다"로 보상한다
        if (this.finisherHealCd <= 0 && this.hp < this.maxHp) {
          this.hp++;
          // v147: 5→8초 — 소크 계측: 27분 런 기준 본능 회복 총량 ~324로, 피격 310회의 피해를
          // 혼자 상쇄한다 (사망 0의 최대 지분). 위협 상향과 세트로 회복 경제를 적자로 전환
          this.finisherHealCd = 8;
          Particles.text(this.x, this.y - 26, '전투 본능 +1', { color: '#e43b44', size: 13 });
          AudioSys.pickup();
        }
      }
    },

    draw(ctx) {
      for (const g of this.ghosts) {
        Renderer.drawSprite(this.sprImg(), g.x, g.y, {
          flip: g.flip, alpha: g.life * 1.6,
        });
      }

      // 애니메이션: 피격 자세 > 공격 자세 > 걷기 사이클(벌림-정지-모음-정지) > 정지
      const frames = Sprites.playerFrames[cls.sprite];
      const cycle = [1, 0, 2, 0];
      let img;
      if (this.hurtPoseT > 0) img = frames[4];
      else if (this.attackPoseT > 0) img = frames[3];
      else if (this.moving) img = frames[cycle[Math.floor(this.animT * 9) % 4]];
      else img = frames[0];
      const bob = this.moving ? Math.abs(Math.sin(this.animT * 11)) * 1.5 : Math.sin(this.animT * 3) * 1;
      let rot = this.moving ? Math.sin(this.animT * 11) * 0.04 : 0;
      if (this.spinT > 0) rot = ((this.skillEvolved && this.classId === 'knight' ? 1.1 : 0.35) - this.spinT) * 18; // 회전 베기: 계속 돌기
      const flash = this.invuln > 0 && Math.floor(this.invuln * 18) % 2 === 0;

      Renderer.drawSprite(flash ? Sprites.white(img) : img,
        this.x, this.y - bob, {
          flip: this.flip, rot, shadow: true,
          alpha: this.invuln > 0 ? 0.8 : 1,
        });

      if (this.shield) {
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(this.animT * 5) * 0.2;
        ctx.strokeStyle = '#5ce0e6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r + 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // ── 유물 시각 흔적 — 레어 이상 유물은 캐릭터에 보이는 표식을 남긴다 (런마다 다른 모습) ──
      {
        const notable = this.relics.filter((id) => {
          const r = RELICS.find((x) => x.id === id);
          return r && r.rarity !== 'common';
        });
        // 궤도를 도는 유물 문장 (등급색 점)
        for (let i = 0; i < Math.min(notable.length, 8); i++) {
          const r = RELICS.find((x) => x.id === notable[i]);
          const a = this.animT * 1.4 + (i / Math.min(notable.length, 8)) * Math.PI * 2;
          const ox = this.x + Math.cos(a) * 21;
          const oy = this.y - 6 + Math.sin(a) * 8 - Math.abs(Math.cos(a)) * 2;
          ctx.save();
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = RARITY[r.rarity].color;
          ctx.fillRect(Math.round(ox) - 1.5, Math.round(oy) - 1.5, 3, 3);
          ctx.globalAlpha = 0.25;
          ctx.fillRect(Math.round(ox) - 3, Math.round(oy) - 3, 6, 6);
          ctx.restore();
        }
        // 광전사의 투구: 위기(HP≤3)에 붉은 아우라가 타오른다
        if (this.rflags.berserkhelm && this.hp <= 3) {
          ctx.save();
          ctx.globalAlpha = 0.16 + Math.sin(this.animT * 8) * 0.06;
          ctx.fillStyle = '#e43b44';
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.r + 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // 불사조 깃털(미사용): 이따금 불씨가 피어오른다
        if (this.rflags.revive && !this.reviveUsed && Math.random() < 0.06) {
          Particles.burst(this.x + (Math.random() - 0.5) * 14, this.y - 14, {
            count: 1, colors: ['#ff7043', '#ffd866'], speed: 26, life: 0.5, size: 2, gravity: -90,
          });
        }
        // 유리 대검: 서릿발 같은 흰 섬광이 반짝인다
        if (this.rflags.allcrit && Math.random() < 0.08) {
          Particles.burst(this.x + (Math.random() - 0.5) * 18, this.y - 8 + (Math.random() - 0.5) * 14, {
            count: 1, colors: ['#ffffff', '#fff7c0'], speed: 8, life: 0.35, size: 2,
          });
        }
      }

      for (const s of this.slashes) {
        const t = s.life / s.maxLife;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(s.angle);
        // 웨지 (그라데이션)
        ctx.globalAlpha = t * 0.85;
        const grad = ctx.createRadialGradient(0, 0, s.range * 0.3, 0, 0, s.range);
        grad.addColorStop(0, s.finisher ? 'rgba(247,179,43,0)' : 'rgba(255,255,255,0)');
        grad.addColorStop(1, s.finisher ? 'rgba(247,179,43,0.9)' : 'rgba(255,255,255,0.8)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, s.range, -s.arc / 2, s.arc / 2);
        ctx.closePath();
        ctx.fill();
        // 칼날 궤적 (밝은 외곽 호 — 시간에 따라 휘둘러지는 느낌). 2타(rev)는 역방향으로 되돌아온다
        const prog = Math.max(1 - t, 0.35);
        const sweep = prog * s.arc;
        ctx.globalAlpha = t;
        ctx.strokeStyle = s.finisher ? '#ffd866' : '#ffffff';
        ctx.lineWidth = s.finisher ? 4 : 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (s.rev) ctx.arc(0, 0, s.range * 0.94, s.arc / 2, s.arc / 2 - sweep, true);
        else ctx.arc(0, 0, s.range * 0.94, -s.arc / 2, -s.arc / 2 + sweep);
        ctx.stroke();
        // 칼날 스트릭 — 실제 휘둘러지는 검신: 진행 각도에 빛나는 날 (두꺼운 잔광 + 흰 심)
        const bladeA = s.rev ? s.arc / 2 - (1 - t) * s.arc : -s.arc / 2 + (1 - t) * s.arc;
        const bx = Math.cos(bladeA), by = Math.sin(bladeA);
        ctx.globalAlpha = t * 0.55;
        ctx.strokeStyle = s.finisher ? '#f7b32b' : '#c8d4e4';
        ctx.lineWidth = s.finisher ? 7 : 5;
        ctx.beginPath();
        ctx.moveTo(bx * s.range * 0.3, by * s.range * 0.3);
        ctx.lineTo(bx * s.range * 0.98, by * s.range * 0.98);
        ctx.stroke();
        ctx.globalAlpha = t;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx * s.range * 0.34, by * s.range * 0.34);
        ctx.lineTo(bx * s.range * 0.96, by * s.range * 0.96);
        ctx.stroke();
        // 마무리 일격: 부챗살 스피드라인 — 한 프레임의 폭발적 기세
        if (s.finisher) {
          ctx.globalAlpha = t * 0.6;
          ctx.strokeStyle = '#fff7c0';
          ctx.lineWidth = 1.5;
          for (let k = 0; k < 6; k++) {
            const la = -s.arc / 2 + ((k + 0.5) / 6) * s.arc;
            const lx = Math.cos(la), ly = Math.sin(la);
            ctx.beginPath();
            ctx.moveTo(lx * s.range * 1.02, ly * s.range * 1.02);
            ctx.lineTo(lx * (s.range * 1.02 + 14 + (k % 2) * 8), ly * (s.range * 1.02 + 14 + (k % 2) * 8));
            ctx.stroke();
          }
        }
        // 안쪽 보조 호
        ctx.globalAlpha = t * 0.5;
        ctx.strokeStyle = s.finisher ? '#ffd866' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, s.range * 0.6, -s.arc / 2, s.arc / 2);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      // 회전 베기: 도는 동안 칼바람 궤적 링 + 3개 칼날 잔광이 함께 돈다
      if (this.spinT > 0) {
        const rr = 96 * this.rangeMul;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalAlpha = 0.35 + Math.sin(this.animT * 30) * 0.12;
        ctx.strokeStyle = '#c8d4e4';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, Math.PI * 2);
        ctx.stroke();
        const spinA = this.animT * 22;
        for (let k = 0; k < 3; k++) {
          const a = spinA + (k / 3) * Math.PI * 2;
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = k === 0 ? '#ffffff' : '#9fb8cc';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, rr * 0.97, a, a + 0.9);
          ctx.stroke();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    },
  };
  if (pl.form === 'chalice') { pl.maxHp = Math.max(1, pl.maxHp - 1); pl.hp = pl.maxHp; } // 성배를 삼킨 자
  return pl;
}
