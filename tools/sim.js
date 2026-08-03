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
import { ARCHETYPES, DENSITY } from '../web/3d/js/game/enemy-table.js';
import { GROWTH, perHit, mitigate, levelAtXp, enemyDmgMult, HP_SCALE, itemScale }
  from '../web/3d/js/game/growth-table.js';
import { FLOORS } from '../web/3d/js/world/floors.js';
import { ELEMENTS, STRONG, WEAK } from '../web/3d/js/game/elements.js';
import { ATTACK_SCALE } from '../web/3d/js/game/pace.js';
import { DROP, COIN, DEATH } from '../web/3d/js/game/economy-table.js';
import { rollItem, power, priceOf, SLOTS } from '../web/3d/js/game/item-table.js';
import { makeRng } from '../web/3d/js/core/rng.js';
import { SKILL_NUM } from '../web/3d/js/game/skill-table.js';
import { NODES, SkillTree } from '../web/3d/js/game/skilltree.js';
import { SKILL_CD_SCALE } from '../web/3d/js/game/pace.js';

const CSV = process.argv.includes('--csv');
const rows = [];
const out = (...a) => { if (!CSV) console.log(...a); };
const csv = (...a) => { if (CSV) rows.push(a.join(',')); };

// ── 가정 ────────────────────────────────────────────────────
// 시뮬이 **정하는** 것은 이 셋뿐이고, 나머지는 전부 표에서 온다.
// 층당 잡몹 수 — **표에서 계산한다.** 방 개수는 floors.js, 방당 마릿수는
// enemy-table.js 의 DENSITY 다. 손으로 26 이라 적어 두면 밀도를 올린 순간
// 시뮬만 옛 값으로 돈다.
const roomsOf = (F) => (Array.isArray(F.rooms) ? (F.rooms[0] + F.rooms[1]) / 2 : F.rooms);
const perFloor = (F) => Math.round((roomsOf(F) - 2) *
  ((DENSITY.min + DENSITY.max) / 2 + (F.no >= DENSITY.bonusFrom ? DENSITY.bonusChance * DENSITY.bonus : 0)));
const PER_FLOOR = perFloor(FLOORS[0]);
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
    xp += perFloor(F) * avg + 90;               // 잡몹 + 보스
    lv.push(levelAtXp(xp));
  }
  return lv;
}
const LV = levelByFloor();
// **마지막 층을 표에서 읽는다.** 9 라고 적어 뒀더니 회차를 여섯 층으로
// 줄이는 순간 없는 층을 읽어 죽었다.
const LAST = FLOORS[FLOORS.length - 1].no;

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
out(`여유 = 내가 죽는 시간 ÷ 적을 죽이는 시간. **동시에 ${DENSITY.engaged}마리가**`);
out(`때린다고 본다 (밀도 ${DENSITY.min}~${DENSITY.max}/방 · 리쉬 해제). 층당 잡몹 ${PER_FLOOR}마리.\n`);
// 내 감쇠율도 같이 찍는다. 디아블로3 는 DR = armor/(armor + 50×레벨) 인데
// 우리는 armor/(armor + 42 + 9×레벨) 이라 상수가 다르다 — 형태는 같으므로
// **실제로 몇 % 를 막는지**를 봐야 같은 대역인지 알 수 있다.
out('층 Lv 적           체력   방어  내DPS  잡는데  적DPS  내체력 내감쇠 버티는데 여유');
csv('층,Lv,적,체력,방어,내DPS,잡는데(초),적DPS,내체력,내감쇠,버티는데(초),여유');
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
    // **동시에 붙는 수로 나눈다.** 리쉬를 풀고 밀도를 올린 뒤로 「적 하나가
    // 때린다」는 가정이 거짓이 됐다 — 그대로 두면 여유가 17 로 나와서
    // 「엄청 쉬워졌다」로 읽힌다. 실제로는 서넛이 동시에 때린다.
    const ttd = me.hp / (eDps * DENSITY.engaged);
    const myDR = me.armor / (me.armor + 42 + lv * 9);
    out(`${String(f).padEnd(3)}${String(lv).padEnd(3)}${d.name.padEnd(12)}`
      + `${String(hp).padEnd(7)}${armor.toFixed(0).padEnd(6)}${myDps.toFixed(1).padEnd(7)}`
      + `${ttk.toFixed(1).padEnd(8)}${eDps.toFixed(1).padEnd(7)}${me.hp.toFixed(0).padEnd(7)}`
      + `${(myDR * 100).toFixed(0)}%`.padEnd(7)
      + `${ttd.toFixed(0).padEnd(9)}${(ttd / ttk).toFixed(2)}`);
    csv(f, lv, d.name, hp, armor.toFixed(1), myDps.toFixed(1), ttk.toFixed(1),
      eDps.toFixed(1), me.hp.toFixed(0), (myDR * 100).toFixed(0), ttd.toFixed(0), (ttd / ttk).toFixed(2));
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
  const d = FAMS.map((fam) => attack(LAST, fam).dps);
  // **지팡이를 섞어서 재면 안 된다.** 지팡이는 피해를 쿨감·마나와 맞바꾼
  // 설계라 낮은 게 맞다. 섞어 재면 「편차 21%」가 되어 멀쩡한 균형이
  // 깨진 것처럼 보인다 — 실제로 그렇게 잘못 보고한 적이 있다.
  const atkFams = FAMS.filter((f) => f !== '지팡이');
  const da = atkFams.map((fam) => attack(LAST, fam).dps);
  out(`\n${LAST}층 편차 ${((Math.max(...da) / Math.min(...da) - 1) * 100).toFixed(0)}% `
    + `(공격 계열 ${atkFams.length}종)  ·  지팡이는 ${(d[FAMS.indexOf('지팡이')] / Math.max(...da) * 100).toFixed(0)}% `
    + `— 쿨감·마나와 맞바꾼 설계라 낮은 게 맞다`);
  out('한 대의 크기 — 무게가 숫자로 보여야 한다');
  for (const fam of FAMS) {
    const a = attack(LAST, fam);
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




// ── 4. 드랍 · 경제 ──────────────────────────────────────────
//
// **실제 RNG 로 굴린다.** 확률을 손으로 곱해서 기댓값을 내면 「등급이 어떻게
// 섞이나」와 「몇 번 갈아입나」를 못 본다. 갈아입기는 굴려 봐야 아는 값이다 —
// 좋은 게 떨어져도 이미 낀 게 더 좋으면 안 갈아입는다.
//
// 판마다 운이 다르므로 여러 판을 돌려 중앙값을 본다.
out('\n── 드랍 · 경제 ─────────────────────────────────────────────');
out('시드 40판을 실제 RNG 로 굴린 중앙값. **갈아입기가 드랍 설계의 지표다**');
out('— 떨어져도 안 갈아입으면 그 드랍은 없는 것과 같다.\n');
out('층 떨어짐 갈아입음  등급(일반/마법/희귀/전설)  조각수입  살 수 있는 것');
csv('');
csv('층,떨어짐,갈아입음,일반,마법,희귀,전설,조각수입,장비값,살수있는것');

const RUNS = 40;
const median = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };

const per = FLOORS.map(() => ({ drops: [], mob: [], ups: [], coins: [], rar: [0, 0, 0, 0], price: [] }));
for (let run = 0; run < RUNS; run++) {
  const rnd = makeRng(`SIM-${run}`);
  // 시작 장비 — main.js 와 같다 (1층 무기 하나)
  const eq = Object.fromEntries(SLOTS.map((k) => [k, null]));
  eq.weapon = rollItem(rnd, 1, 0, { slot: 'weapon', minRarity: 0 });
  for (const F of FLOORS) {
    const f = F.no;
    let drops = 0, ups = 0, coins = 0, mobDrops = 0;
    const roll = (extra = {}) => rollItem(rnd, f, 0, {
      prefer: SLOTS.filter((s) => eq[s]), ...extra,
    });
    const take = (it) => {
      drops++;
      per[f - 1].rar[it.rarity]++;
      // **갈아입는가** — power() 는 게임의 비교 화살표와 같은 함수다
      if (power(it) > power(eq[it.slot])) { eq[it.slot] = it; ups++; }
    };
    for (let i = 0; i < PER_FLOOR; i++) {
      if (rnd.chance(DROP.normal)) { mobDrops++; take(roll()); }
      if (rnd.chance(COIN.chance.normal)) {
        coins += Math.max(1, Math.round(COIN.base(f) * COIN.mult.normal * rnd.range(...COIN.jitter)));
      }
    }
    // 보스 하나
    for (let i = 0; i < DROP.bossCount; i++) take(roll({ minRarity: DROP.bossMinRarity }));
    coins += Math.max(1, Math.round(COIN.base(f) * COIN.mult.boss * rnd.range(...COIN.jitter)));
    per[f - 1].mob.push(mobDrops);
    per[f - 1].drops.push(drops);
    per[f - 1].ups.push(ups);
    per[f - 1].coins.push(coins);
    per[f - 1].price.push(priceOf(roll({ minRarity: 1 })));
  }
}
for (const F of FLOORS) {
  const P = per[F.no - 1];
  const tot = P.rar.reduce((a, b) => a + b, 0) || 1;
  const rar = P.rar.map((n) => `${Math.round((n / tot) * 100)}%`).join('/');
  const coin = median(P.coins), price = median(P.price);
  out(`${String(F.no).padEnd(3)}${String(median(P.drops)).padEnd(7)}${String(median(P.ups)).padEnd(10)}`
    + `${rar.padEnd(26)}${String(coin).padEnd(10)}${(coin / price).toFixed(1)}개 (개당 ${price})`);
  csv(F.no, median(P.drops), median(P.ups), ...P.rar.map((n) => (n / tot).toFixed(3)),
    coin, price, (coin / price).toFixed(1));
}
{
  const upsAll = per.reduce((s, p) => s + median(p.ups), 0);
  const dropAll = per.reduce((s, p) => s + median(p.drops), 0);
  // **누가 장비를 주는가.** 잡몹 드랍이 층당 1개 남짓인데 보스가 확정으로
  // 둘을 뱉으면, 장비는 사실상 보스가 준다. 그러면 잡몹을 잡을 이유가
  // 경험치·조각뿐이 되고, 등급 분포도 보스의 minRarity 가 지배한다 —
  // 이 표에서 희귀가 66% 로 나오는 이유가 설계표(12%)가 아니라 그것이다.
  const mobAll = per.reduce((s, p) => s + p.mob.reduce((a, b) => a + b, 0) / RUNS, 0);
  const bossAll = FLOORS.length * DROP.bossCount;
  out(`\n누가 주는가 — 잡몹 ${mobAll.toFixed(1)}개 · 보스 ${bossAll}개 `
    + `(보스가 ${Math.round(bossAll / (mobAll + bossAll) * 100)}%). `
    + `보스 드랍은 등급 하한이 ${DROP.bossMinRarity} 라 등급 분포도 보스가 정한다`);
  out(`\n한 판 전체 — 떨어짐 ${dropAll}개 · 갈아입음 ${upsAll}번 `
    + `(${Math.round((upsAll / dropAll) * 100)}%)`);
  out('죽으면 낀 것 한 칸을 등급별 확률로 잃는다 — '
    + DEATH.loseChanceByRarity.map((v, i) => `${['일반', '마법', '희귀', '전설'][i]} ${Math.round(v * 100)}%`).join(' · ')
    + ` · 조각 ${Math.round(DEATH.coinPct * 100)}%`);
}



// ── 5. 빌드 대 빌드 ─────────────────────────────────────────
//
// 「어느 칸이 센가」는 손으로 곱하면 틀린다. 실제로 그렇게 재다가
// **연격 +60% 대 가르기 +6%** 를 오래 못 봤다 — 방어도 무시는 방어도가
// 클 때만 값어치가 있는데, 그걸 알려면 적의 방어도까지 넣고 계산해야 한다.
//
// 그래서 **한 판의 피해량**을 끝까지 굴린다: 평타를 계속 치면서 스킬은
// 쿨이 돌 때마다 쓰되, **마나가 없으면 못 쓴다.** 마나를 안 넣으면
// 회전 베기가 무한히 도는 것으로 계산되어 답이 통째로 틀린다.
//
// 표적 수를 1 과 4 로 나눠 본다 — 광역 칸은 뭉친 적에게만 값어치가 있고,
// 그 차이가 「무엇을 찍나」의 절반이다.

const WINDOW = 60;               // 초. 한 판의 교전을 이만큼으로 본다
// 적이 흩어져 있는 범위. **이게 없으면 광역 칸이 전부 0 이 된다** —
// 표적이 이미 다 범위 안에 있다고 보면 「넓어진다」가 아무 의미가 없어서,
// 확산(반경 1.6배·피해 0.7배)이 그냥 −30% 손해로 계산됐다.
const PACK_R = 8;

/** 트리 조합 하나의 60초 피해량 */
function buildDamage(taken, targets, f = LAST, armorMode = 'mid') {
  const T = new SkillTree();
  T.grant(taken.length);
  for (const id of taken) T.take(id);
  const lv = LV[f - 1], atk = attack(f, '검'), me = body(f);
  const F = FLOORS[f - 1];
  // 표적은 그 층 로스터의 **중앙값 방어도**를 쓴다 — 특정 적에 맞추면
  // 그 적에게만 좋은 칸이 이겨 버린다
  const armors = [...new Set(F.roster)].map((k) => (ARCHETYPES[k]?.armor || 0) * F.powerMult).sort((a, b) => a - b);
  // **가르기(방어도 무시)를 재려면 방어도 높은 적이 필요하다.** 중앙값만
  // 보면 「방어도 무시」의 값어치를 영원히 못 본다 — 그게 이 칸을 오래
  // 잘못 평가한 이유다.
  const armor = armorMode === 'hard' ? armors[armors.length - 1]
    : armorMode === 'soft' ? armors[0]
      : armors[armors.length >> 1];
  const hit = (mult, ap = 0) => mitigate(atk.avg * mult, armor * (1 - ap), lv);

  let dmg = 0, mp = GROWTH.mp.base + (lv - 1) * GROWTH.mp.per;
  const regen = GROWTH.mpRegen.base + lv * GROWTH.mpRegen.per;
  const cd = {}, M = {};
  for (const k of Object.keys(SKILL_NUM)) { cd[k] = 0; M[k] = T.mods(k); }
  const cdr = 0;                 // 장비 쿨감은 빌드와 무관하므로 뺀다

  const DT = 0.05;
  for (let t = 0; t < WINDOW; t += DT) {
    mp = Math.min(GROWTH.mp.base + (lv - 1) * GROWTH.mp.per, mp + regen * DT);
    for (const k of Object.keys(cd)) cd[k] -= DT;

    // 평타 — 한 표적만 때린다
    if (Math.random() < 0) { /* 자리 표시 */ }
    dmg += hit(1) * atk.aps * DT;

    const N = SKILL_NUM;
    // 회전 베기 — 부채꼴이라 표적 전부에 닿는다
    if (cd.cleave <= 0 && mp >= N.cleave.cost) {
      const m = M.cleave;
      // 부채꼴이 넓어지면 **더 많이 닿는다.** 이걸 안 넣으면 「넓은 호」가
      // +0% 로 나와서 쓸모없는 칸처럼 보인다 — 실제로 그렇게 나왔다.
      // 부채꼴은 **각도**로 얼마나 잡는지가 정해진다. 기본 0.78π 는 원의 39% 다
      const arc = Math.min(1, (N.cleave.spread * (m.spread ?? 1)) / (Math.PI * 2));
      const n = Math.max(1, targets * arc);
      let d = hit(N.cleave.dmg * (m.dmg ?? 1), m.pierce ?? 0) * n;
      if (m.twice) d += hit(N.cleave.dmg * (m.dmg ?? 1) * m.twice, m.pierce ?? 0) * n;
      dmg += d; mp -= N.cleave.cost;
      cd.cleave = N.cleave.cd * SKILL_CD_SCALE * (1 - cdr);
      if (m.killCdr) cd.cleave = Math.max(0, cd.cleave - m.killCdr);   // 처치 가정 1
    }
    // 그림자 돌진 — 스치는 적만
    if (cd.dash <= 0 && mp >= N.dash.cost) {
      const m = M.dash;
      let d = hit(N.dash.dmg) * Math.min(targets, 2);
      if (m.endBlast) d += hit(m.endBlast) * targets;
      dmg += d; mp -= N.dash.cost;
      cd.dash = N.dash.cd * SKILL_CD_SCALE;
      if (m.hitCdr) cd.dash *= (1 - m.hitCdr);
    }
    // 화염 신성 — 광역 + 장판
    if (cd.nova <= 0 && mp >= N.nova.cost) {
      const m = M.nova;
      const R = N.nova.radius * (m.radius ?? 1);
      const n = Math.max(1, targets * Math.min(1, (R / PACK_R) ** 2));
      dmg += hit(N.nova.dmg * (m.dmg ?? 1)) * n;
      // 장판 — (dmgMin+dmgMax) 기준이라 평타 평균의 두 배쯤이다
      const fdps = (atk.dmin + atk.dmax) * N.nova.field.dps * (m.fieldDps ?? 1);
      dmg += mitigate(fdps, armor, lv) * N.nova.field.life * (m.fieldLife ?? 1) * n;
      mp -= N.nova.cost;
      cd.nova = N.nova.cd * SKILL_CD_SCALE;
    }
    // 운석 — 단발이 제일 크다
    if (cd.meteor <= 0 && mp >= N.meteor.cost) {
      const m = M.meteor;
      const R = N.meteor.radius * (m.radius ?? 1);
      const n = Math.max(1, targets * Math.min(1, (R / PACK_R) ** 2));
      // 가장자리 감쇠 — 평균 falloff 를 쓴다
      const fall = 1 - N.meteor.falloff * 0.5;
      let d = hit(N.meteor.dmg * (m.dmg ?? 1) * fall) * n;
      if (m.core) d += hit(N.meteor.dmg * (m.dmg ?? 1) * (m.core - 1)) * 1;   // 중심 하나만
      if (m.shards) d += hit(N.meteor.shard.dmg) * Math.min(targets, m.shards);
      const fdps = (atk.dmin + atk.dmax) * N.meteor.field.dps;
      d += mitigate(fdps, armor, lv) * N.meteor.field.life * n;
      dmg += d; mp -= N.meteor.cost;
      cd.meteor = N.meteor.cd * SKILL_CD_SCALE;
    }
  }
  return dmg;
}

out('\n── 빌드 대 빌드 ────────────────────────────────────────────');
out(`${LAST}층에서 60초간 넣는 피해. 마나 제한을 넣고 굴린다 —');
out('안 넣으면 회전 베기가 무한히 도는 것으로 계산되어 답이 통째로 틀린다.\n`);
out('칸            표적1     표적4     무른적    단단한적  성격  (「피해 밖」은 쓸모없다는 뜻이 아니다)');
csv('');
csv('칸,표적1,표적4,무른적,단단한적,성격');
// **기준을 표적 1 로 잡으면 광역 칸이 전부 0 이 된다.** 뭉친 적에서만
// 값어치가 있는 칸이 있다는 게 요점이므로 1 과 4 를 나란히 본다.
const base1 = buildDamage([], 1), base4 = buildDamage([], 4), baseH = buildDamage([], 1, LAST, 'hard'), baseS = buildDamage([], 1, LAST, 'soft');
for (const [id, n] of Object.entries(NODES)) {
  const g1 = buildDamage([id], 1) / base1 - 1;
  const g4 = buildDamage([id], 4) / base4 - 1;
  const gH = buildDamage([id], 1, LAST, 'hard') / baseH - 1;
  const gS = buildDamage([id], 1, LAST, 'soft') / baseS - 1;
  const pct = (v) => (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';
  // **「피해 아님」은 「쓸모없음」이 아니다.** 미끼·벽 통과·느림·표시는
  // 피해로 안 잡히지만 판을 바꾼다. 무엇을 하는 칸인지 같이 적는다.
  const NON_DMG = {
    dashAfter: '적 시선을 끈다', dashPierce: '벽을 통과한다', dashChain: '쿨 회복',
    meteorAim: '예고가 짧아 덜 피한다', meteorWake: '적을 느리게', novaRekindle: '장판 연쇄',
    cleaveWhirl: '처치할수록 쿨 감소', comMana: '마나 회수', comWick: '연료 절약',
    comGrit: '장비 보험', comSense: '약점 표시',
  };
  const kind = NON_DMG[id] ? `피해 밖 — ${NON_DMG[id]}`
    : Math.abs(g4 - g1) > 0.03 ? (g4 > g1 ? '뭉친 적에게' : '한 마리에게') : '고르게';
  out(`  ${n.name.padEnd(12)} ${pct(g1).padEnd(9)} ${pct(g4).padEnd(9)} ${pct(gS).padEnd(9)}${pct(gH).padEnd(10)}${kind}`);
  csv(n.name, (g1 * 100).toFixed(1), (g4 * 100).toFixed(1), (gS * 100).toFixed(1), (gH * 100).toFixed(1), kind);
}
out('\n양자택일 — 둘이 비슷하면 선택이 아니라 정답이 있는 것이다');
const seen = new Set();
for (const [id, n] of Object.entries(NODES)) {
  if (!n.excl || seen.has(id)) continue;
  seen.add(id); seen.add(n.excl);
  const a1 = buildDamage([id], 1) / base1 - 1, a4 = buildDamage([id], 4) / base4 - 1;
  const b1 = buildDamage([n.excl], 1) / base1 - 1, b4 = buildDamage([n.excl], 4) / base4 - 1;
  const aH = buildDamage([id], 1, LAST, 'hard') / baseH - 1;
  const bH = buildDamage([n.excl], 1, LAST, 'hard') / baseH - 1;
  const aS = buildDamage([id], 1, LAST, 'soft') / baseS - 1;
  const bS = buildDamage([n.excl], 1, LAST, 'soft') / baseS - 1;
  // **상황이 셋 중 하나라도 뒤집히면 선택이다.** 한 상황만 보면 늘 정답이 있다
  const flip = new Set([a4 > b4, aS > bS, aH > bH]).size > 1;
  out(`  ${n.name} vs ${NODES[n.excl].name}`
    + `   표적1 ${(a1 * 100).toFixed(1)}% : ${(b1 * 100).toFixed(1)}%`
    + `   표적4 ${(a4 * 100).toFixed(1)}% : ${(b4 * 100).toFixed(1)}%`
    + `   무른 ${(aS * 100).toFixed(1)}% : ${(bS * 100).toFixed(1)}%`
    + `   단단 ${(aH * 100).toFixed(1)}% : ${(bH * 100).toFixed(1)}%`
    + (flip ? '   ✔ 상황에 따라 뒤집힌다' : '   ← 늘 한쪽이 이긴다'));
}



// ── 6. 루프 템포 ────────────────────────────────────────────
//
// **이 게임의 진짜 지표다** (docs/GRIND.md §9). 값이 아니라 리듬을 본다 —
// 보상 주기를 길이가 다른 여러 겹으로 겹쳐서 **멈출 자리가 안 생기게** 하는
// 것이 목적이고, 겹 사이가 벌어지면 거기서 사람이 손을 뗀다.
//
// 시뮬이 **가정하는 것 하나**: 무리와 무리 사이를 걷는 시간.
// 이건 지도 모양과 이동 속도에 달려 있어 표에 없다. 한 마리당 1.4초로 둔다
// (방마다 서넛이 뭉쳐 있으므로 한 무리를 치우고 다음 방까지 4~5초).
const WALK_PER_KILL = 1.4;

out('\n── 루프 템포 ───────────────────────────────────────────────');
out('보상 주기를 겹쳐 놓는다. 겹 사이가 벌어지면 거기서 손을 뗀다.\n');
out('층  잡몹  처치간격  정예 잡는데  드랍간격   층 도는 시간   레벨업');
csv('');
csv('층,잡몹,처치간격(초),정예(초),드랍간격(초),층시간(분),레벨업');

let runSec = 0;
for (const F of FLOORS) {
  const f = F.no, lv = LV[f - 1], atk = attack(f, '검');
  // 그 층 로스터의 평균 체력으로 평균 TTK 를 낸다
  // **정예를 잡몹 평균에 섞으면 안 된다.** 골렘·조각상은 일부러 오래 걸리게
  // 만든 것이고, 섞으면 5층 평균이 5.7초로 튀어서 「후반이 늘어진다」로
  // 잘못 읽힌다. 정예는 따로 센다.
  const kinds = [...new Set(F.roster)].map((k) => ARCHETYPES[k]).filter((d) => d && !d.elite);
  const elites = [...new Set(F.roster)].map((k) => ARCHETYPES[k]).filter((d) => d && d.elite);
  const ttks = kinds.map((d) => {
    const hp = d.hp * F.powerMult * HP_SCALE;
    return hp / (mitigate(atk.avg, d.armor * F.powerMult, lv) * atk.aps);
  });
  const ttk = ttks.length ? ttks.reduce((a, b) => a + b, 0) / ttks.length : 3;
  const eTtk = elites.length ? elites.reduce((s2, d) =>
    s2 + (d.hp * F.powerMult * HP_SCALE) / (mitigate(atk.avg, d.armor * F.powerMult, lv) * atk.aps), 0) / elites.length : 0;
  const n = perFloor(F);
  const gap = ttk + WALK_PER_KILL;
  const floorSec = n * gap;
  runSec += floorSec;
  // 드랍 — 잡몹 확률 + 보스 확정. economy-table 에서 온다
  const drops = n * DROP.normal + DROP.bossCount;
  const dropGap = floorSec / drops;
  const ups = f === 1 ? LV[0] - 1 : LV[f - 1] - LV[f - 2];
  out(`${String(f).padEnd(4)}${String(n).padEnd(6)}${gap.toFixed(1).padEnd(10)}`
    + `${(eTtk ? eTtk.toFixed(1) + '초' : '—').padEnd(13)}`
    + `${dropGap.toFixed(0).padEnd(11)}${(floorSec / 60).toFixed(1)}분`.padEnd(15)
    + `+${ups}`);
  csv(f, n, gap.toFixed(1), eTtk.toFixed(1), dropGap.toFixed(0), (floorSec / 60).toFixed(1), ups);
}
{
  const mark = (v, lo, hi) => (v >= lo && v <= hi ? '✔' : v < lo ? '✘ 너무 짧다' : '✘ 너무 길다');
  // **요약을 1층으로만 내면 안 된다.** 후반이 늘어져도 ✔ 로 보인다.
  // 전 층의 최소~최대를 내고, 최악이 목표를 벗어나면 실패로 찍는다.
  const perTtk = FLOORS.map((F) => {
    const lv2 = LV[F.no - 1], a2 = attack(F.no, '검');
    const ks = [...new Set(F.roster)].map((k) => ARCHETYPES[k]).filter((d) => d && !d.elite);
    return ks.reduce((s2, d) =>
      s2 + (d.hp * F.powerMult * HP_SCALE) / (mitigate(a2.avg, d.armor * F.powerMult, lv2) * a2.aps), 0) / ks.length;
  });
  const ttk1 = Math.max(...perTtk);
  const nAll = FLOORS.reduce((s, F) => s + perFloor(F), 0);
  const dropAll = nAll * DROP.normal + FLOORS.length * DROP.bossCount;
  out('');
  out(`  한 마리 잡는 시간   ${Math.min(...perTtk).toFixed(1)} ~ ${ttk1.toFixed(1)}초   목표 1.5 ~ 3     ${mark(ttk1, 1.5, 3)}  (전 층 · 정예 제외)`);
  // **두 가지를 갈라 재야 한다.** 처음엔 「처치 사이 간격 3초 이하」 하나로
  // 봤는데, 그건 「한 마리 죽는 주기」와 「손이 쉬는 시간」을 섞은 것이다.
  // 때리는 동안 손은 안 쉰다 — 쉬는 건 무리와 무리 사이를 걷는 시간뿐이다.
  // 기획안 §2 의 첫 겹은 「2~4초, 한 마리 죽는다」이므로 그게 리듬의 목표고,
  // 쉬는 시간은 따로 3초 이하다.
  const rhythmLo = Math.min(...perTtk) + WALK_PER_KILL, rhythmHi = ttk1 + WALK_PER_KILL;
  out(`  처치 리듬           ${rhythmLo.toFixed(1)} ~ ${rhythmHi.toFixed(1)}초   목표 2 ~ 4       ${mark(rhythmHi, 2, 4)}`);
  out(`  손이 쉬는 시간      ${WALK_PER_KILL.toFixed(1)}초        목표 3 이하      ${mark(WALK_PER_KILL, 0, 3)}  (무리 사이 이동 — 가정값)`);
  out(`  드랍 사이 간격      ${(runSec / dropAll).toFixed(0)}초         목표 30 ~ 60     ${mark(runSec / dropAll, 30, 60)}`);
  // 층 목표를 3~5분 → **2.5~4분**으로 고친다. 목표를 낮춰 통과시키려는 게
  // 아니라, **원래 목표 둘이 서로 안 맞았다**: 한 회차가 여섯 층이면
  // 3분 × 6 = 18분이라 회차 목표(15~25분)의 아래쪽 절반이 아예 닿지 않는다.
  // 회차 길이가 더 중요한 지표이므로 층 쪽을 맞춘다.
  out(`  층 하나             ${(runSec / FLOORS.length / 60).toFixed(1)}분        목표 2.5 ~ 4     ${mark(runSec / FLOORS.length / 60, 2.5, 4)}`);
  out(`  회차 하나           ${(runSec / 60).toFixed(0)}분         목표 15 ~ 25     ${mark(runSec / 60, 15, 25)}`);
  csv('');
  csv('지표,값,목표');
  csv('한마리(초)', ttk1.toFixed(1), '1.5~3');
  csv('처치리듬(초)', rhythmHi.toFixed(1), '2~4');
  csv('드랍간격(초)', (runSec / dropAll).toFixed(0), '30~60');
  csv('층(분)', (runSec / FLOORS.length / 60).toFixed(1), '2.5~4');
  csv('회차(분)', (runSec / 60).toFixed(0), '15~25');
}

if (CSV) console.log(rows.join('\n'));
