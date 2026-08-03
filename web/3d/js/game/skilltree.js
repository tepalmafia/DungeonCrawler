// 스킬 트리 — **칸 하나가 무엇을 바꾸는가**를 답하는 표.
//
// 설계는 docs/SKILL-TREE.md 를 따른다. 한 문장으로 줄이면
// **레벨업이 숫자가 아니라 선택을 준다.**
//
// ── 이 파일이 지금 하는 일 (단계 A) ──────────────────────────
// 표와 `mods()` 만 있다. 포인트 획득·창 UI·양자택일 잠금은 다음 단계다.
//
// **아무것도 안 찍은 상태에서 `mods()` 는 전부 1 을 돌려준다.**
// 그래서 이 단계가 끝나도 게임은 지금과 한 글자도 다르지 않아야 한다 —
// `tools/verify3d.js` 의 스킬 검사가 그것을 확인한다.
// 「새 기능이 하나도 안 늘어나는」 작업이라 미루기 쉽지만, 미루면 칸을
// 하나 만들 때마다 skills.js 를 헤집게 된다 (docs/FLOORS.md 의 A·B 와 같다).
//
// ── 지켜야 할 것 ────────────────────────────────────────────
// · **난수를 쓰지 않는다.** 트리가 rnd 를 부르면 층 지문이 흔들려
//   tools/floor-parity.js 비교가 무의미해진다.
// · **장비 스탯을 만지지 않는다.** 그건 items.js 의 aggregate() 몫이다.
//   두 곳에서 같은 수치가 흐르면 나중에 어느 쪽이 원인인지 못 찾는다.
//   트리는 **스킬 동작만** 만진다.
// · 판이 끝나면 사라진다. 이 게임에 저장이 없다.

/**
 * 칸 하나.
 *
 *   skill  어느 스킬에 붙나 ('common' 이면 스킬 무관)
 *   tier   1 기본 강화 · 2 양자택일 · 3 마무리
 *   excl   같은 자리의 반대편. 하나를 찍으면 다른 하나는 못 찍는다
 *   mod    곱하는 값들. **곱셈만 쓴다** — 더하기를 섞으면 순서에 따라
 *          결과가 달라져서 「무엇을 찍었나」로 값을 설명할 수 없다
 *   flag   수치가 아니라 규칙을 켜는 것 (스킬 코드가 읽는다)
 */
export const NODES = {
  // ── 회전 베기 ──
  cleaveWide:   { skill: 'cleave', tier: 1, name: '넓은 호', icon: '🌀',
    desc: '부채꼴이 등 뒤 절반까지 넓어진다', mod: { spread: 1.47 } },
  // ── 이 두 칸은 **한쪽이 압도적이었다** ──────────────────────
  //
  // 연격 +60% 대 가르기 +6%. 열 배 차이다. 원인은 방어도가 생각보다
  // 작다는 것이었다 — 9층 파수병 방어도 32, 감쇠식 k = 32/(32+42+9L) 이라
  // 방어도를 30% 깎아 봐야 피해가 6% 오른다. 「방어도 무시」는 방어도가
  // 클 때만 값어치가 있는데, 잡몹의 방어도는 크지 않다.
  //
  // 그래서 둘을 **쓸 곳이 다르게** 갈랐다. 연격은 낮추고(+35%), 가르기는
  // 방어도를 **전부** 무시하게 한다. 그러면 잡몹에겐 +19%, 골렘·조각상
  // (방어도 60~74)에겐 +44% 다 — 잡몹은 연격, 정예는 가르기가 된다.
  cleaveCombo:  { skill: 'cleave', tier: 2, name: '연격', excl: 'cleaveRend',
    desc: '두 번 휘두른다. 두 번째는 피해 35%', flag: { twice: 0.35 } },
  cleaveRend:   { skill: 'cleave', tier: 2, name: '가르기', excl: 'cleaveCombo',
    desc: '방어도를 통째로 무시한다 (방어도가 높은 적일수록 이득)', flag: { pierce: 1 } },
  cleaveWhirl:  { skill: 'cleave', tier: 3, name: '회오리',
    desc: '처치하면 재사용 대기가 0.35초 줄어든다 (겹친다)', flag: { killCdr: 0.35 } },

  // ── 그림자 돌진 ──
  dashAfter:    { skill: 'dash', tier: 1, name: '잔상',
    desc: '지나간 자리에 그림자가 1.2초 남아 적 시선을 끈다', flag: { decoy: 1.2 } },
  dashPierce:   { skill: 'dash', tier: 2, name: '관통', excl: 'dashBlast',
    desc: '벽을 한 겹 통과한다', flag: { throughWall: 1 } },
  dashBlast:    { skill: 'dash', tier: 2, name: '충격', excl: 'dashPierce',
    desc: '끝나는 지점에서 폭발한다', flag: { endBlast: 3 } },
  dashChain:    { skill: 'dash', tier: 3, name: '연쇄',
    desc: '돌진 중 적을 맞히면 재사용 대기 40% 즉시 회복', flag: { hitCdr: 0.4 } },

  // ── 화염 신성 ──
  novaLinger:   { skill: 'nova', tier: 1, name: '여진',
    desc: '장판이 오래 남는다', mod: { fieldLife: 1.62 } },
  novaSpread:   { skill: 'nova', tier: 2, name: '확산', excl: 'novaFocus',
    desc: '넓어지는 대신 약해진다', mod: { radius: 1.6, dmg: 0.7 } },
  novaFocus:    { skill: 'nova', tier: 2, name: '응축', excl: 'novaSpread',
    desc: '좁아지는 대신 세진다', mod: { radius: 0.75, dmg: 1.8, fieldDps: 2 } },
  novaRekindle: { skill: 'nova', tier: 3, name: '재점화',
    desc: '장판 위에서 적이 죽으면 그 자리에 작은 장판이 하나 더', flag: { rekindle: 1 } },

  // ── 운석 낙하 ──
  meteorAim:    { skill: 'meteor', tier: 1, name: '조준',
    desc: '낙하 예고가 짧아진다', mod: { delay: 0.71 } },
  meteorShards: { skill: 'meteor', tier: 2, name: '파편', excl: 'meteorDirect',
    desc: '본체가 약해지는 대신 작은 운석 셋이 더 떨어진다',
    mod: { dmg: 0.75 }, flag: { shards: 3 } },
  meteorDirect: { skill: 'meteor', tier: 2, name: '직격', excl: 'meteorShards',
    desc: '중심에 맞으면 피해 두 배', flag: { core: 2 } },
  meteorWake:   { skill: 'meteor', tier: 3, name: '여운',
    desc: '떨어진 자리가 4초간 적을 느리게 한다', flag: { slow: 4 } },

  // ── 공용 — 스킬을 안 쓰는 사람도 찍을 것이 있어야 한다 ──
  comMana:      { skill: 'common', tier: 1, name: '마나 회수',
    desc: '적을 처치하면 마나 +6', flag: { killMana: 6 } },
  comWick:      { skill: 'common', tier: 1, name: '랜턴 심지',
    desc: '랜턴 연료 소모 25% 감소', mod: { fuelBurn: 0.75 } },
  comGrit:      { skill: 'common', tier: 1, name: '죽음의 대가',
    desc: '한 판에 한 번, 쓰러져도 장비를 안 잃는다', flag: { deathSave: 1 } },
  comSense:     { skill: 'common', tier: 1, name: '상성 감각',
    desc: '적 이름표에 약점 속성이 뜬다', flag: { showWeak: 1 } },
};

/** 안 찍었을 때의 값. **전부 1** — 그래서 트리가 없는 것과 같다. */
const ONE = {};

/**
 * 한 판 동안의 트리 상태.
 *
 * 인스턴스로 둔다 — 모듈 상수로 두면 다시 시작해도 안 지워지고,
 * 그게 「판이 끝나면 사라진다」와 어긋난다 (보스 PHASES 에서 겪은 것과 같다).
 */
export class SkillTree {
  constructor() {
    this.points = 0;
    this.taken = new Set();
    this._cache = new Map();      // 찍을 때마다 비운다 — 매 프레임 다시 계산하면 낭비다
  }

  /** 찍을 수 있나 — 포인트가 있고, 이미 안 찍었고, 반대편을 안 찍었다 */
  canTake(id) {
    const n = NODES[id];
    if (!n || this.taken.has(id)) return false;
    if (this.points < 1) return false;
    if (n.excl && this.taken.has(n.excl)) return false;
    return true;
  }

  take(id) {
    if (!this.canTake(id)) return false;
    this.taken.add(id);
    this.points--;
    this._cache.clear();
    return true;
  }

  /** 「기억의 재」 — 전부 되돌린다. 값은 상점이 받는다 (docs/SKILL-TREE.md §1-5) */
  refund() {
    this.points += this.taken.size;
    this.taken.clear();
    this._cache.clear();
  }

  grant(n = 1) { this.points += n; }

  /**
   * 그 스킬의 배율 묶음. **안 찍었으면 전부 undefined** 이고,
   * 부르는 쪽이 `?? 1` 로 받으므로 지금과 값이 같다.
   *
   * 곱셈만 쓰므로 찍은 순서와 무관하다.
   */
  mods(skill) {
    if (!this.taken.size) return ONE;
    let m = this._cache.get(skill);
    if (m) return m;
    m = {};
    for (const id of this.taken) {
      const n = NODES[id];
      if (!n || (n.skill !== skill && n.skill !== 'common')) continue;
      for (const [k, v] of Object.entries(n.mod || {})) m[k] = (m[k] ?? 1) * v;
      for (const [k, v] of Object.entries(n.flag || {})) m[k] = v;
    }
    this._cache.set(skill, m);
    return m;
  }
}
