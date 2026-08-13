// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **어스펙트 — 후미를 때리면 아픈가** — 뼈대만 (v137)
//
//    node tools/space-aspect.js
//
//  ★ 사장님 (2026-08-13) 「실감나는 전투를 위해 … **후미를 공격햇을때
//    데미지** 등 기획을 짜봐. 우주 전투시뮬레이션 RPG에 맞게」
//
//  ★★★ 묻는 것 일곱 (`docs/space/FIGHT.md §6`)
//      ① **셋이 다 나오나** — 각을 훑어 앞·옆·뒤가 다 갈리나
//      ② ★★★ **후미가 제일 아픈가**
//      ③ ★★★ **정면이 손해인가** — 손해가 아니면 아무도 안 돈다
//      ④ ★★★ **뒤를 잡으면 엔진이 나오나** — v70 부터 주석이 약속한 것이다
//      ⑤ **정면이면 무기가 나오나 · 엔진은 안 나오나**
//      ⑥ ★★ **한가운데를 맞혀야 핵심이 열리나** — 아니면 겨눌 이유가 없다
//      ⑦ ★★ **무기 셋이 어스펙트를 다르게 타나** — 같으면 성격이 없다
// ══════════════════════════════════════════════════════════════════════════
import {
  ASPECT, ASPECTS, aspectOf, aspectMult, aspectWord, partAt, WEAPON_ASPECT, multFor,
} from '../web/space/js/game/aspect-table.js';
import { PARTS } from '../web/space/js/game/target-table.js';
import { WEAPON_LIST } from '../web/space/js/game/combat-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
/** 그 각에서 천 번 맞으면 부위가 어떻게 갈리나 */
const spread = (deg, off = 0) => {
  const n = {};
  for (let i = 0; i < 1000; i++) { const k = partAt(deg, off, i / 1000); n[k] = (n[k] ?? 0) + 1; }
  return n;
};
const word = (n) => Object.entries(n).sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `${PARTS[k]?.name ?? k} ${(v / 10).toFixed(0)}%`).join(' · ');

console.log('어스펙트 — 내가 적의 어느 쪽에 있나 (게임을 안 부른다)');

console.log('\n[1] ★★ **셋이 다 나오나**');
{
  console.log('   각    구역   피해');
  const seen = new Set();
  for (const d of [0, 20, 44, 60, 90, 134, 150, 180]) {
    const a = aspectOf(d);
    seen.add(a);
    console.log(`   ${String(d).padStart(3)}°  ${aspectWord(d)}   ×${aspectMult(d)}`);
  }
  ok(seen.size === ASPECTS.length,
    `★★ **앞·옆·뒤가 다 갈린다** (${seen.size}/${ASPECTS.length}) — 하나가 안 나오면`
    + ' 그 자리로 갈 이유가 없어진다');
  ok(aspectOf(190) === aspectOf(170) && aspectOf(-40) === aspectOf(40),
    '★★★ **각이 한 바퀴를 돌아도 같은 뜻이다** — 190도와 170도는 둘 다 후미다.'
    + ' 이 저장소가 v69 에 방위를 그냥 빼다가 한 번 태운 자리라 여기서 먼저 막는다');
}

console.log('\n[2] ★★★ **후미가 제일 아픈가 · 정면이 손해인가**');
{
  const r = aspectMult(180), s = aspectMult(90), f = aspectMult(0);
  console.log(`   후미 ×${r} · 측면 ×${s} · 정면 ×${f}`);
  ok(r > s && s > f,
    `★★★ **뒤 > 옆 > 앞** (${r} > ${s} > ${f}) — 실기의 「꼬리를 문다」가 이것이다.`
    + ' 분사구에는 장갑을 못 두른다');
  ok(f < 1,
    `★★★ **정면은 1 보다 작다** (×${f}) — 여기가 이 판의 알맹이다. 마주보는 것이`
    + ' 이득이면 **아무도 안 돈다.** 그러면 v73 의 360도 선회도 v133 의'
    + ' 스로틀도 다 장식이 되고, 남는 것은 「마주보고 쏘기」뿐이다');
  ok(r / f > 1.6,
    `★★ **앞뒤 차이가 ${(r / f).toFixed(2)}배다** — 1.6 배는 넘어야 「30초를 써서라도`
    + ' 뒤로 돌아간다」가 셈이 맞는다. 너무 크면 정면 교차가 아예 사라진다');
}

console.log('\n[3] ★★★ **뒤를 잡으면 엔진이 나오나** (v70 부터 주석이 약속한 것)');
{
  const rear = spread(180, 0.5);
  console.log(`   후미에서 — ${word(rear)}`);
  ok((rear.engine ?? 0) > 300,
    `★★★ **엔진이 ${((rear.engine ?? 0) / 10).toFixed(0)}% 나온다** — \`PARTS.engine\` 의 주석이`
    + ' 「**뒤를 잡으면 나온다**」라고 v70 부터 적어 두고 있었는데, 코드는 조준'
    + ' 어긋남만 봤다. **말과 판정이 갈라져 있던 자리**다');
  ok(!(rear.gun > 0),
    '★★ **뒤에서는 무기가 안 나온다** — 포구는 앞에 있다. 안 그러면 어스펙트가'
    + ' 「배수만 다른 같은 것」이 된다');
  const front = spread(0, 0.5);
  console.log(`   정면에서 — ${word(front)}`);
  ok((front.gun ?? 0) > 250 && !(front.engine > 0),
    '★★★ **정면에서는 무기가 나오고 엔진은 안 나온다** — 「정면으로 맞붙으면'
    + ' 나온다」는 `PARTS.gun` 의 약속이다. 그래서 정면 교차에도 값이 있다:'
    + ' 아프게는 못 해도 **못 쏘게** 만들 수 있다');
}

console.log('\n[4] ★★ **한가운데를 맞혀야 핵심이 열리나**');
{
  const mid = spread(90, 0);      // 정확히 가운데
  const off = spread(90, 0.9);    // 크게 어긋남
  console.log(`   가운데 — ${word(mid)}`);
  console.log(`   빗맞음 — ${word(off)}`);
  ok((mid.core ?? 0) > (off.core ?? 0) * 3,
    `★★★ **가운데라야 핵심이 열린다** (${((mid.core ?? 0) / 10).toFixed(0)}% vs`
    + ` ${((off.core ?? 0) / 10).toFixed(0)}%) — 어스펙트만 쓰면 「뒤에서 아무렇게나 쏴도`
    + ' 된다」가 되어 **정확히 겨눌 이유가 없어진다.** 둘을 곱해야 둘 다 산다');
}

console.log('\n[5] ★★ **무기 셋이 어스펙트를 다르게 타나**');
{
  console.log('   무기        정면    측면    후미');
  const row = [];
  for (const w of WEAPON_LIST) {
    const f = multFor(w.key, 0), s = multFor(w.key, 90), r = multFor(w.key, 180);
    row.push({ key: w.key, f, s, r });
    console.log(`   ${w.name.padEnd(8)} ×${f.toFixed(2)}  ×${s.toFixed(2)}  ×${r.toFixed(2)}`);
  }
  ok(WEAPON_LIST.every((w) => WEAPON_ASPECT[w.key]),
    '★★ **무기마다 칸이 있다** — 빠진 무기는 조용히 「있는 그대로」가 된다');
  const arh = row.find((r) => r.key === 'arh'), laser = row.find((r) => r.key === 'laser');
  ok(arh && laser && arh.f > laser.f,
    `★★★ **유도탄은 정면에서 덜 손해다** (×${arh?.f.toFixed(2)} vs ×${laser?.f.toFixed(2)}) —`
    + ' 「각도를 덜 가린다」가 규칙이 된 자리다. 그래서 정면 교차에서 쓸 것이 생긴다');
  const ir = row.find((r) => r.key === 'ir');
  ok(ir && ir.r > laser.r,
    `★★★ **열추적탄은 후미에서 더 문다** (×${ir?.r.toFixed(2)} vs ×${laser?.r.toFixed(2)}) —`
    + ' 열원이 분사구라는 **고증이 그대로 규칙**이 됐다. 새 축을 안 만들고');
  ok(new Set(row.map((r) => r.f.toFixed(2))).size > 1,
    '★★ **셋이 서로 다르다** — 같으면 「무기 성격」이 아니라 이름만 셋이다');
}

console.log('\n[6] ★★ **셋 다 제 까닭을 갖나**');
{
  ok(ASPECTS.every((k) => ASPECT[k].what && ASPECT[k].what.length > 10),
    '★ 세 구역이 다 **왜 그런지**를 들고 있다 — 까닭 없는 숫자는 다음 판에 흔들린다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
