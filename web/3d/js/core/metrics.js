// 실측 — 밸런스를 감이 아니라 수치로 판단하기 위한 기록기.
//
// 왜 필요한가: 지금까지 「해골 10초에 죽는다」, 「넉백 2유닛 밀린다」 같은 숫자는
// 매번 일회성 스크립트를 짜서 쟀다. 재현이 안 되고, 바꾸기 전후를 비교할 수 없고,
// 무엇보다 **한 판을 통째로 돌려본 수치가 아니라 실험실 수치**였다.
// 실제 플레이에서 나오는 수를 모아야 「이 값이 맞나」에 답할 수 있다.
//
// 설계 원칙:
//  · 매 프레임 도는 경로에 들어가므로 **할당을 만들지 않는다**. 배열 push 만 한다.
//  · 원본 표본을 버리지 않는다. 평균만 남기면 나중에 중앙값·p95 를 못 낸다.
//  · 표본 수에 상한을 둔다 — 30분을 돌려도 메모리가 터지지 않아야 한다.
//  · **측정이 게임을 바꾸면 안 된다.** 여기서 게임 상태를 절대 쓰지 않는다.
//
// 읽는 법:  window.G3.metrics.report()   →  JSON
//          tools/bench3d.js             →  여러 시드 집계 + 이전 결과와 비교

const CAP = 4000;             // 항목별 표본 상한

function push(arr, v) {
  if (!Number.isFinite(v)) return;
  if (arr.length >= CAP) arr[(Math.random() * CAP) | 0] = v;   // 저수지 근사 — 후반만 남지 않게
  else arr.push(v);
}

function stats(arr) {
  if (!arr.length) return null;
  const a = Array.prototype.slice.call(arr).sort((x, y) => x - y);
  const q = (p) => a[Math.min(a.length - 1, Math.max(0, Math.round((a.length - 1) * p)))];
  let sum = 0;
  for (const v of a) sum += v;
  return {
    n: a.length,
    min: +a[0].toFixed(3),
    med: +q(0.5).toFixed(3),
    p95: +q(0.95).toFixed(3),
    max: +a[a.length - 1].toFixed(3),
    mean: +(sum / a.length).toFixed(3),
  };
}

export class Metrics {
  constructor() { this.reset(); }

  reset() {
    this.t = 0;                       // 측정 대상 경과 시간(초)
    this.wall = 0;                    // 실제 경과 시간 — ff 배속과 구분하기 위해 따로 센다

    // 전투
    this.fights = new Map();          // Enemy → { t0, hits, dmg, crits }
    this.ttk = {};                    // 종족 → 처치까지 걸린 초
    this.hitsToKill = {};             // 종족 → 처치까지 때린 횟수
    this.dmgDealt = [];               // 1타당 피해
    this.dmgTaken = [];               // 1회당 받은 피해
    this.knockDist = [];              // **넉백으로 실제 밀려난 거리** (유닛)
    this.crits = 0;
    this.swings = 0;                  // 평타 시도

    // 흐름
    this.combatT = 0;                 // 어그로가 하나라도 붙어 있던 시간
    this.walkDist = 0;                // 플레이어 이동 거리
    this.floors = [];                 // { floor, sec, kills, deaths }
    this.deaths = 0;
    this.kills = 0;
    this.aggro = {};                  // 종족 → 어그로가 붙은 횟수

    // 자원
    this.fuel = [];                   // 랜턴 연료 시계열 (5초 간격)
    this.hpPct = [];                  // 체력 비율 시계열
    this.pickups = [0, 0, 0, 0];      // 등급별 획득 수

    // 성능
    this.logicMs = [];
    this.frameMs = [];

    // 사고
    this.stuck = 0;                   // 끼임 탈출 발동 횟수
    this.errors = 0;

    this._fuelAcc = 0;
    this._floorT = 0;
    this._floorKills = 0;
    this._floorNo = null;
  }

  // ── 프레임 ────────────────────────────────────────────
  /** @param anyAggro 어그로가 붙은 적이 하나라도 있는가 */
  frame(dt, wallDt, { logicMs, frameMs, anyAggro, hpPct, fuel, walked, stuck }) {
    this.t += dt;
    this.wall += wallDt;
    this._floorT += dt;
    if (anyAggro) this.combatT += dt;
    this.walkDist += walked || 0;
    if (stuck != null) this.stuck = stuck;
    push(this.logicMs, logicMs);
    push(this.frameMs, frameMs);

    this._fuelAcc += dt;
    if (this._fuelAcc >= 5) {
      this._fuelAcc = 0;
      push(this.fuel, fuel);
      push(this.hpPct, hpPct);
    }
  }

  // ── 전투 ──────────────────────────────────────────────
  hit(e, dmg, crit) {
    push(this.dmgDealt, dmg);
    if (crit) this.crits++;
    let f = this.fights.get(e);
    if (!f) { f = { t0: this.t, hits: 0, dmg: 0 }; this.fights.set(e, f); }
    f.hits++;
    f.dmg += dmg;
  }

  swing() { this.swings++; }

  /** 넉백으로 **실제로** 밀려난 거리. 임펄스가 아니라 이동 합계다. */
  knock(dist) { if (dist > 0.001) push(this.knockDist, dist); }

  taken(dmg) { push(this.dmgTaken, dmg); }

  aggroOn(kind) { this.aggro[kind] = (this.aggro[kind] || 0) + 1; }

  kill(e) {
    this.kills++;
    this._floorKills++;
    const k = e.def?.key || 'unknown';
    const f = this.fights.get(e);
    if (f) {
      (this.ttk[k] ||= []).push(+(this.t - f.t0).toFixed(3));
      (this.hitsToKill[k] ||= []).push(f.hits);
      this.fights.delete(e);
    }
  }

  death() { this.deaths++; }
  pickup(rarity) { this.pickups[Math.min(3, Math.max(0, rarity | 0))]++; }

  // ── 층 ────────────────────────────────────────────────
  floorStart(no) {
    if (this._floorNo != null) this.floorEnd();
    this._floorNo = no;
    this._floorT = 0;
    this._floorKills = 0;
  }

  floorEnd() {
    if (this._floorNo == null) return;
    this.floors.push({
      floor: this._floorNo,
      sec: +this._floorT.toFixed(1),
      kills: this._floorKills,
    });
    this._floorNo = null;
  }

  // ── 산출 ──────────────────────────────────────────────
  report() {
    const perKind = {};
    for (const k of Object.keys(this.ttk)) {
      perKind[k] = {
        ttk: stats(this.ttk[k]),
        hits: stats(this.hitsToKill[k]),
        aggro: this.aggro[k] || 0,
      };
    }
    const dealt = stats(this.dmgDealt), taken = stats(this.dmgTaken);
    return {
      version: 1,
      elapsed: +this.t.toFixed(1),
      wall: +this.wall.toFixed(1),
      flow: {
        kills: this.kills,
        deaths: this.deaths,
        // 전투에 쓴 시간의 비율 — 「이동만 하다 끝났나」를 판별한다
        combatRatio: this.t > 0 ? +(this.combatT / this.t).toFixed(3) : 0,
        walkDist: +this.walkDist.toFixed(1),
        // 처치당 이동 거리 — 이게 크면 몹을 찾아 헤매고 있다는 뜻이다
        walkPerKill: this.kills ? +(this.walkDist / this.kills).toFixed(1) : null,
        floors: this.floors.slice(),
        stuck: this.stuck,
      },
      combat: {
        dmgDealt: dealt,
        dmgTaken: taken,
        dps: this.combatT > 0 && dealt ? +((dealt.mean * dealt.n) / this.combatT).toFixed(2) : null,
        dtps: this.combatT > 0 && taken ? +((taken.mean * taken.n) / this.combatT).toFixed(2) : null,
        critRate: this.swings ? +(this.crits / this.swings).toFixed(3) : null,
        // 넉백으로 실제 밀려난 거리. 격자 한 칸이 2.0 이라는 걸 기억할 것.
        knockDist: stats(this.knockDist),
      },
      perKind,
      resource: {
        fuel: stats(this.fuel),
        hpPct: stats(this.hpPct),
        pickups: this.pickups.slice(),
      },
      perf: { logicMs: stats(this.logicMs), frameMs: stats(this.frameMs) },
      errors: this.errors,
    };
  }
}
