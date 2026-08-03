// ══════════════════════════════════════════════════════════════════════════
//  밸런스 시뮬 — **게임과 같은 표를 읽어서** 1~9층을 계산한다.
//
//    node tools/sim.js              표로 본다
//    node tools/sim.js --csv        엑셀에서 볼 수 있게 뽑는다
//
//  ★ 이 도구의 유일한 규칙: **숫자를 여기 적지 않는다.**
//
//    밸런스를 볼 때마다 임시 스크립트에 숫자를 손으로 옮겨 적고 버렸다.
//    그러면 (1) 결과를 아무도 재현 못 하고, (2) 옮겨 적은 순간 원본과
//    갈라진다. 오늘 `?v=3` 과 `VERSION` 이 두 곳에 있어서 스무 번 배포되는
//    동안 어긋나 있던 것과 같은 실패다.
//
//    그래서 web/3d/js/game 의 표를 **그대로 import 한다.** 표가 바뀌면
//    이 도구의 답도 같이 바뀐다. 새 종족을 추가해도 여기는 안 고친다.
//
//    표를 읽으려고 순수 모듈 넷을 갈라 뒀다 (three 를 안 쓰는 부분만):
//      game/item-table.js    등급·기반·접사·롤·합산
//      game/enemy-table.js   종족과 변종의 숫자
//      game/growth-table.js  레벨 성장식·방어도 감쇠·경험치 곡선
//      world/floors.js       층별 배수·로스터·속성 분포 (원래 순수했다)
//
//  ★ 이 계산이 못 보는 것 (읽는 사람이 알아야 한다)
//    「여유」는 **적 하나가 쉬지 않고 때리고 내가 안 피할 때**의 값이다.
//    실제로는 둘셋이 붙으므로 절반쯤으로 보고, 반대로 피하고 물약을 쓰면
//    더 는다. 조각상은 아예 안 움직이므로 여기 숫자보다 훨씬 안전하다.
//    **순서와 폭이 맞는지**가 이 표로 아는 전부다.
// ══════════════════════════════════════════════════════════════════════════
import { BASES, RARITIES } from '../web/3d/js/game/item-table.js';
import { ARCHETYPES } from '../web/3d/js/game/enemy-table.js';
import { GROWTH, perHit, mitigate, levelAtXp, enemyDmgMult, HP_SCALE, itemScale }
  from '../web/3d/js/game/growth-table.js';
import { FLOORS } from '../web/3d/js/world/floors.js';
import { ELEMENTS, STRONG, WEAK } from '../web/3d/js/game/elements.js';
import { ATTACK_SCALE } from '../web/3d/js/game/pace.js';

const CSV = process.argv.includes('--csv');
const rows = [];
const out = (...a) => { if (!CSV) console.log(...a); };
const csv = (...a) => { if (CSV) rows.push(a.join(',')); };

// ── 가정 ────────────────────────────────────────────────────
// 시뮬이 **정하는** 것은 이 셋뿐이고, 나머지는 전부 표에서 온다.
const PER_FLOOR = 26;          // 한 층에 잡는 잡몹 수
const ARMOR_SLOTS = 7;         // 무기 뺀 장비 칸
const RARITY_BY_FLOOR = (f) => (f <= 2 ? 0 : f <= 4 ? 1 : f <= 6 ? 2 : 3);

/** 그 층에서 기대되는 장비 배율 */
const gearScale = (f) => itemScale(f, 0) * RARITIES[RARITY_BY_FLOOR(f)].mult;

/** 층별 누적 경험치 → 레벨. 경험치엔 층 배수가 없다(파밍 방지) */
function levelByFloor() {
  const lv = [];
  let xp = 0;
  for (const F of FLOORS) {
    // 그 층 로스터의 평균 경험치를 쓴다 — 로스터가 바뀌면 여기도 따라간다
    const avg = F.roster.reduce((s, k) => s + (ARCHETYPES[k]?.xp || 0), 0) / F.roster.length;
    xp += PER_FLOOR * avg + 90;                 // 잡몹 + 보스
    lv.push(levelAtXp(xp));
  }
  return lv;
}
const LV = levelByFloor();

/** 계열별 대표 무기 — 그 층에 나올 수 있는 것 중 제일 좋은 것 */
function weaponFor(fam, f) {
  const pool = BASES.weapon.filter((b) => b.fam === fam && (b.lvl ?? 1) <= f);
  return pool[pool.length - 1] || BASES.weapon.find((b) => b.fam === fam);
}

/** 그 층·그 계열의 내 공격력 */
function attack(f, fam) {
  const lv = LV[f - 1], w = weaponFor(fam, f), sc = gearScale(f);
  const ph = perHit(w.spd);
  const dmin = Math.round(w.dmg[0] * sc) + (lv - 1) * GROWTH.dmgMin.per * ph;
  const dmax = Math.round(w.dmg[1] * sc) + (lv - 1) * GROWTH.dmgMax.per * ph;
  const crit = GROWTH.crit.base + (w.base?.crit || 0);
  const avg = ((dmin + dmax) / 2) * (1 + (crit / 100) * (GROWTH.critMult.base - 1));
  const aps = w.spd * ATTACK_SCALE * (1 + (lv - 1) * GROWTH.aspd.per);
  return { name: w.name, avg, aps, dps: avg * aps, dmin, dmax, lv };
}

/** 그 층의 내 몸 — 방어구 칸이 평균 등급으로 차 있다고 본다 */
function body(f) {
  const lv = LV[f - 1], sc = gearScale(f);
  // 방어구 기반의 중앙값을 쓴다. 표가 바뀌면 따라간다
  const midArmor = (slot) => {
    const pool = BASES[slot].filter((b) => (b.lvl ?? 1) <= f);
    const b = pool[Math.floor(pool.length / 2)] || BASES[slot][0];
    return ((b.armor[0] + b.armor[1]) / 2) * sc;
  };
  const slots = ['helm', 'armor', 'gloves', 'belt', 'boots', 'ring', 'amulet'];
  const armor = GROWTH.armor.base + (lv - 1) * GROWTH.armor.per
    + slots.reduce((s, k) => s + midArmor(k), 0);
  // 체력 접사는 슬롯 절반쯤에 붙는다고 본다 (접사 표의 중앙값 15.5)
  const hp = GROWTH.hp.base + (lv - 1) * GROWTH.hp.per + ARMOR_SLOTS * 0.5 * 15.5 * sc;
  return { hp, armor, lv };
}

// ── 1. 층별 난이도 곡선 ─────────────────────────────────────
out('\n── 층별 난이도 ──────────────────────────────────────────────');
out('여유 = 내가 죽는 시간 ÷ 적을 죽이는 시간. **적 하나 기준**이므로');
out('둘셋이 붙는 실제 상황은 절반쯤으로 봐야 한다.\n');
out('층 Lv 적           체력   방어  내DPS  잡는데  적DPS  내체력 버티는데 여유');
csv('층,Lv,적,체력,방어,내DPS,잡는데(초),적DPS,내체력,버티는데(초),여유');
for (const F of FLOORS) {
  const f = F.no, lv = LV[f - 1], me = body(f), atk = attack(f, '검');
  // 로스터는 **가중치를 중복으로** 준다 (해골이 두 번 적히면 두 배로 나온다).
  // 난이도 표에서는 종류당 한 줄이면 되므로 접어서 보여 준다.
  for (const key of [...new Set(F.roster)]) {
    const d = ARCHETYPES[key];
    if (!d) continue;
    const hp = Math.round(d.hp * F.powerMult * HP_SCALE);
    const armor = d.armor * F.powerMult;
    const myDps = mitigate(atk.avg, armor, lv) * atk.aps;
    const ttk = hp / myDps;
    const eDps = mitigate(d.dmg * enemyDmgMult(F.powerMult), me.armor, lv) / (d.windup + d.recover);
    const ttd = me.hp / eDps;
    out(`${String(f).padEnd(3)}${String(lv).padEnd(3)}${d.name.padEnd(12)}`
      + `${String(hp).padEnd(7)}${armor.toFixed(0).padEnd(6)}${myDps.toFixed(1).padEnd(7)}`
      + `${ttk.toFixed(1).padEnd(8)}${eDps.toFixed(1).padEnd(7)}${me.hp.toFixed(0).padEnd(7)}`
      + `${ttd.toFixed(0).padEnd(9)}${(ttd / ttk).toFixed(2)}`);
    csv(f, lv, d.name, hp, armor.toFixed(1), myDps.toFixed(1), ttk.toFixed(1),
      eDps.toFixed(1), me.hp.toFixed(0), ttd.toFixed(0), (ttd / ttk).toFixed(2));
  }
}

// ── 2. 무기 계열 ────────────────────────────────────────────
const FAMS = [...new Set(BASES.weapon.map((b) => b.fam))];
out('\n── 무기 계열별 초당 피해 ────────────────────────────────────');
out('편차가 크면 「고를 이유」가 아니라 「정답」이 된다.\n');
out('층 Lv  ' + FAMS.map((f) => f.padEnd(8)).join(''));
csv('');
csv('층,Lv,' + FAMS.join(','));
for (const F of FLOORS) {
  const f = F.no;
  const d = FAMS.map((fam) => attack(f, fam).dps);
  out(`${String(f).padEnd(3)}${String(LV[f - 1]).padEnd(4)}`
    + d.map((v) => v.toFixed(1).padEnd(8)).join(''));
  csv(f, LV[f - 1], ...d.map((v) => v.toFixed(1)));
}
{
  const d = FAMS.map((fam) => attack(9, fam).dps);
  // **지팡이를 섞어서 재면 안 된다.** 지팡이는 피해를 쿨감·마나와 맞바꾼
  // 설계라 낮은 게 맞다. 섞어 재면 「편차 21%」가 되어 멀쩡한 균형이
  // 깨진 것처럼 보인다 — 실제로 그렇게 잘못 보고한 적이 있다.
  const atkFams = FAMS.filter((f) => f !== '지팡이');
  const da = atkFams.map((fam) => attack(9, fam).dps);
  out(`\n9층 편차 ${((Math.max(...da) / Math.min(...da) - 1) * 100).toFixed(0)}% `
    + `(공격 계열 ${atkFams.length}종)  ·  지팡이는 ${(d[FAMS.indexOf('지팡이')] / Math.max(...da) * 100).toFixed(0)}% `
    + `— 쿨감·마나와 맞바꾼 설계라 낮은 게 맞다`);
  out('한 대의 크기 — 무게가 숫자로 보여야 한다');
  for (const fam of FAMS) {
    const a = attack(9, fam);
    out(`  ${fam.padEnd(7)} ${a.dmin.toFixed(0)}~${a.dmax.toFixed(0)}  (${a.name})`);
  }
}

// ── 3. 속성 ─────────────────────────────────────────────────
out('\n── 속성 ────────────────────────────────────────────────────');
out('무기 속성은 **고를 수 없는 접사**다. 층마다 어느 속성을 들었느냐로');
out('초당 피해가 얼마나 갈리는지 — 이게 크면 판단이 아니라 운이다.\n');
out('층 분포                          최선   최악   갈림');
csv('');
csv('층,분포,최선,최악,갈림');
const KEYS = Object.keys(ELEMENTS).filter((k) => k !== 'none');
for (const F of FLOORS) {
  const total = Object.values(F.mix).reduce((a, b) => a + b, 0);
  const val = (atk) => Object.entries(F.mix).reduce((s, [def, w]) => {
    let m = 1;
    if (ELEMENTS[atk]?.beats === def) m = STRONG;
    else if (ELEMENTS[def]?.beats === atk) m = WEAK;
    return s + (w / total) * m;
  }, 0);
  const vs = KEYS.map((k) => ({ k, v: val(k) })).sort((a, b) => b.v - a.v);
  const mix = Object.entries(F.mix).map(([k, v]) => `${ELEMENTS[k].name}${v}`).join(' ');
  out(`${String(F.no).padEnd(3)}${mix.padEnd(30)}`
    + `${vs[0].v.toFixed(2)}(${ELEMENTS[vs[0].k].name}) `
    + `${vs[vs.length - 1].v.toFixed(2)}(${ELEMENTS[vs[vs.length - 1].k].name}) `
    + `${(vs[0].v / vs[vs.length - 1].v).toFixed(2)}배`);
  csv(F.no, `"${mix}"`, vs[0].v.toFixed(2), vs[vs.length - 1].v.toFixed(2),
    (vs[0].v / vs[vs.length - 1].v).toFixed(2));
}

if (CSV) console.log(rows.join('\n'));
