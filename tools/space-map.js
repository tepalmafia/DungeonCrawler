// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **우주 맵 — 열두 단계가 정말 다른가** (v161 · 뼈대만 · 게임을 안 부른다)
//
//    node tools/space-map.js
//
//  ★ 사장님 (2026-08-17) 「현재 우주가 rpg 처럼 **맵이 앞으로 진행되게**
//    되어 있고 **구역이 나눠져 있는지** 점검해봐. 우주 맵도 **단계를 나눠서**
//    만들어겠어. 기획부터. 예를 들어 **태양이 나타난다**던지, **외계 생명체가
//    살고 있는 행성 근처를 지나는데 그들이 공격**을 해온다던지」
//
//  ══ ★★ 점검부터 했고, 내가 한 번 틀렸다 ═══════════════════════════════
//
//  처음에 「구역 표가 `game/` 에 없다」고 말씀드렸는데 **틀렸다.**
//  `regions-table.js` 에 여섯이 제대로 있었고 창밖·자국·추적·파편을 바꾸고
//  있었다 — `sky-table.js` 만 뒤지고 단정한 것이다.
//  **없다고 말하기 전에 이름으로 한 번 더 찾는다.**
//
//  ★★★ 진짜로 빠진 것은 셋이었다:
//    ① **순서가 없다** — 어느 구역이 더 깊은 곳인지 표가 모른다
//    ② **적이 어디서나 같다** — 구역이 「무엇을 만나나」를 안 바꾼다
//    ③ **나오는 것이 같다** — 캐는 구역과 싸우는 구역이 안 갈린다
//
//  ══ 그래서 이 검사가 묻는 것 ═══════════════════════════════════════════
//
//   [1] 열둘이 있고 **단계가 겹치지 않나**
//   [2] ★★★ **이름만 다른 곳이 없나** — 손잡이 셋 이상이 달라야 한다
//   [3] ★★ **뒤로 갈수록 험한가** — 「뚫는다」가 목적 한 줄이다
//   [4] ★★★ **표가 가리키는 적이 정말 있나** (`KINDS` 와 대조)
//   [5] ★ **캐는 곳과 싸우는 곳이 갈리나**
//   [6] ★★ **사장님이 말씀하신 둘이 있나** — 태양 · 외계 생명권
//   [7] ★★★ **옛 여섯이 안 없어졌나** — 고장·경고·조종이 이름을 읽는다
// ══════════════════════════════════════════════════════════════════════════
import { REGIONS, REGION_BY_KEY } from '../web/space/js/game/regions-table.js';
import { KINDS } from '../web/space/js/game/target-table.js';
import { LEG, offerFor, depthAt } from '../web/space/js/game/route-table.js';
// ★ v162 [8] — **게임 파일을 직접 읽는다** (물렸다고 적기가 아니라 정말 물렸나 보기)
import { readFileSync } from 'node:fs';
import { measuring } from './unmeasured.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

// ══ ★ 잴 것이 없으면 통과가 아니라 「측정 불가」다 (`unmeasured.js`) ══════
//  이 검사의 알맹이가 「겹치는 것이 **없다**」 꼴이라, 표가 비면 전부
//  저절로 참이 된다 — 구역이 하나도 없는데 「열둘이 다 다르다」가 뜬다
const must = measuring({
  tool: 'space-map',
  what: '구역',
  weak: '이 검사의 판정은 「겹치는 것이 없다」 꼴입니다\n'
    + '(단계가 안 겹친다 · 이름만 다른 곳이 없다 · 없는 적을 안 가리킨다).\n'
    + '그래서 **표가 비면 그것들이 다 저절로 참**이 됩니다.',
  look: '`game/regions-table.js` 의 `REGIONS` · `game/target-table.js` 의 `KINDS`',
});
try {
  must.some(REGIONS, '구역을 세려는데');
  must.as('적 표').some(KINDS, '구역이 가리키는 적을 대조하려는데');
  must.as('값').value(LEG.count, 'LEG.count', '구간 수와 맞춰 보려는데');
} catch (e) { if (!must.caught(e)) throw e; }
must.bail();

const byDepth = [...REGIONS].sort((a, b) => (a.depth ?? 99) - (b.depth ?? 99));

console.log('우주 맵 — 열두 단계 (게임을 안 부른다)');

console.log('\n[1] ★★★ **열둘이 있고 단계가 안 겹치나**');
{
  const depths = REGIONS.map((r) => r.depth);
  console.log(`   구역 ${REGIONS.length} · 구간 ${LEG.count}`);
  console.log(`   ${byDepth.map((r) => `${r.depth}.${r.name}`).join(' → ')}`);
  ok(REGIONS.length === LEG.count,
    `★★★ **구역이 구간과 같은 수다** (${REGIONS.length} = ${LEG.count}) — 「구간 하나에`
    + ' 구역 하나」라야 「앞으로 나아가며 달라진다」가 된다. 수가 다르면 어딘가는'
    + ' 두 번 지나거나 안 지나간다');
  ok(new Set(depths).size === depths.length,
    '★★★ **단계가 안 겹친다** — 같은 숫자가 둘이면 순서가 없는 것이고,'
    + ' 순서가 없으면 「뚫고 들어간다」가 안 읽힌다');
  ok(depths.every((d) => Number.isFinite(d) && d >= 1 && d <= LEG.count),
    `★★ 단계가 다 1~${LEG.count} 안에 있다`);
}

console.log('\n[2] ★★★ **이름만 다른 곳이 없나** — 손잡이 셋 이상이 달라야 한다');
{
  //  ★★★ 이게 이 판의 핵심이다. 구역을 늘리는 것은 쉽고, **다르게 만드는
  //    것이 어렵다.** 창밖 색만 바꾸면 그건 배경화면이지 맵이 아니다.
  //    그래서 **숫자 손잡이**로만 센다 — 색은 안 센다
  const KNOB = ['speed', 'signMult', 'trackMult', 'debris', 'heat', 'radar', 'planet'];
  const same = [];
  for (let i = 0; i < REGIONS.length; i++) {
    for (let j = i + 1; j < REGIONS.length; j++) {
      const a = REGIONS[i], b = REGIONS[j];
      const diff = KNOB.filter((k) => (a[k] ?? 0) !== (b[k] ?? 0)).length;
      //  ★ 적 구성과 드랍도 「다름」으로 친다 — 같은 숫자라도 만나는 것이
      //    다르면 다른 곳이다
      const foeSame = JSON.stringify(a.foes ?? {}) === JSON.stringify(b.foes ?? {});
      const dropSame = JSON.stringify(a.drops ?? {}) === JSON.stringify(b.drops ?? {});
      const n = diff + (foeSame ? 0 : 1) + (dropSame ? 0 : 1);
      if (n < 3) same.push(`${a.name}↔${b.name}(${n})`);
    }
  }
  console.log(`   손잡이 ${KNOB.length} + 적 + 드랍 = 9 가지로 견줌`);
  ok(!same.length,
    `★★★ **셋 이상 다르지 않은 짝이 없다**${same.length ? ` — ${same.join(' · ')}` : ''}`
    + ' — 구역을 늘리는 것은 쉽고 **다르게 만드는 것이 어렵다.** 색만 바꾸면'
    + ' 그건 배경화면이지 맵이 아니다');
}

console.log('\n[3] ★★ **뒤로 갈수록 험한가** — 「뚫는다」가 목적 한 줄이다');
{
  //  ★ 험함 = 적 무게의 합 + 자국 배수. 캐는 구역이 중간에 하나쯤 끼는 것은
  //    정상이므로 **한 걸음씩**이 아니라 **앞 절반 vs 뒤 절반**으로 본다
  const rough = (r) => Object.values(r.foes ?? {}).reduce((a, v) => a + v, 0) * (r.signMult ?? 1);
  const half = Math.floor(byDepth.length / 2);
  const front = byDepth.slice(0, half).map(rough);
  const back = byDepth.slice(half).map(rough);
  const avg = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  console.log(`   앞 절반 ${avg(front).toFixed(2)} · 뒤 절반 ${avg(back).toFixed(2)}`);
  ok(avg(back) > avg(front) * 1.3,
    `★★★ **뒤 절반이 앞보다 험하다** (${avg(back).toFixed(2)} vs ${avg(front).toFixed(2)}) —`
    + ' 「적진을 뚫고 들어간다」가 목적 한 줄이므로 뒤로 갈수록 빡빡해야 한다.'
    + ' 평평하면 그건 지도가 아니라 목록이다');
  ok(rough(byDepth.at(-1)) >= Math.max(...byDepth.map(rough)) * 0.9,
    `★★ **마지막이 제일 험하다** (${byDepth.at(-1).name}) — 끝이 절정이 아니면`
    + ' 절정이 중간에 있고, 그러면 마지막이 소화 시간이 된다');
}

console.log('\n[4] ★★★ **표가 가리키는 적이 정말 있나**');
{
  //  ★★ 그림으로 그린 기획이 잊히는 것과 같은 병이다 — 이름을 적어 놓고
  //    그 이름이 없으면, 게임에서는 **아무것도 안 나온다.** 조용히
  const ghost = [];
  for (const r of REGIONS) {
    for (const k of Object.keys(r.foes ?? {})) if (!KINDS[k]) ghost.push(`${r.name}→${k}`);
  }
  console.log(`   가리키는 적 ${[...new Set(REGIONS.flatMap((r) => Object.keys(r.foes ?? {})))].join(' · ')}`);
  ok(!ghost.length,
    `★★★ **없는 적을 안 가리킨다**${ghost.length ? ` — ${ghost.join(' · ')}` : ''}`);
  const DROPS = new Set(['ore', 'parts', 'food', 'coolant', 'arc']);
  const badDrop = REGIONS.flatMap((r) => Object.keys(r.drops ?? {})
    .filter((k) => !DROPS.has(k)).map((k) => `${r.name}→${k}`));
  ok(!badDrop.length,
    `★★ **없는 물건을 안 떨군다**${badDrop.length ? ` — ${badDrop.join(' · ')}` : ''}`);
  ok(REGIONS.filter((r) => Object.keys(r.foes ?? {}).length === 0).length <= 2,
    '★ **적이 없는 구역이 둘 이하다** — 셋을 넘으면 회차의 4분의 1이 조용해진다');
}

console.log('\n[5] ★ **캐는 곳과 싸우는 곳이 갈리나**');
{
  const mine = REGIONS.filter((r) => Object.values(r.drops ?? {}).some((v) => v >= 1.5));
  const fight = REGIONS.filter((r) => Object.values(r.foes ?? {}).reduce((a, v) => a + v, 0) >= 4);
  console.log(`   캐는 곳 ${mine.map((r) => r.name).join(' · ') || '없음'}`);
  console.log(`   싸우는 곳 ${fight.map((r) => r.name).join(' · ') || '없음'}`);
  ok(mine.length >= 2 && fight.length >= 2,
    '★★ **양쪽이 다 있다** — 안 갈리면 「어디로 갈까」가 창밖 구경이 된다');
  //  ══ ★★★ 여기서 **검사를 고쳤다** — 표가 아니라 잣대가 셌다 ═══════════
  //
  //  처음에 「캐면서 싸우는 곳은 **없다**」로 썼고 셋이 걸렸다 (전초선 ·
  //  호송 항로 · 적 행성 상공). 그런데 뜯어 보니 **호송 항로는 싸워서
  //  얻는 곳인 것이 요점**이다 — 호송선을 놓치면 탄두가 안 찬다(v70).
  //  금지하면 그 갈고리가 죽는다.
  //
  //  ★★ 진짜 위험은 「위험하고 부유한 곳」이 아니라 **「안전한데 부유한
  //    곳」이 여럿인 것**이다. 그러면 거기만 돌면 되고, 나머지 열하나를
  //    갈 이유가 없어진다. 그래서 그것만 센다.
  //  ★ 「좋은 점과 대가가 반대 방향」이라는 이 표의 규약은 그대로다 —
  //    다만 **대가는 적일 수도 있고 열·계기일 수도** 있다
  const easyRich = REGIONS.filter((r) => Object.values(r.drops ?? {}).some((v) => v >= 1.5)
    && Object.values(r.foes ?? {}).reduce((a, v) => a + v, 0) <= 1
    && (r.heat ?? 0) === 0 && (r.radar ?? 1) >= 0.9);
  console.log(`   안전한데 부유한 곳 ${easyRich.map((r) => r.name).join(' · ') || '없음'}`);
  ok(easyRich.length <= 1,
    `★★★ **안전한데 부유한 곳이 ${easyRich.length} 곳이다** (하나까지) — 위험하고`
    + ' 부유한 곳은 괜찮다 (호송 항로가 그 자리다 — 놓치면 탄두가 안 찬다).'
    + ' 안 되는 것은 **거기만 돌면 되는 곳**이 여럿인 것이다');
}

console.log('\n[6] ★★ **사장님이 말씀하신 둘이 있나**');
{
  const star = REGIONS.find((r) => (r.heat ?? 0) > 0);
  const alive = REGIONS.find((r) => Object.keys(r.drops ?? {}).length === 0
    && Object.values(r.foes ?? {}).reduce((a, v) => a + v, 0) >= 4);
  ok(!!star,
    `★★★ **태양이 나타나는 곳이 있다** (${star?.name ?? '없음'} · 초당 ${star?.heat}) —`
    + ' 사장님 「태양이 나타난다던지」. 알맹이는 그림이 아니라 **열**이다:'
    + ' 가만히 있어도 뜨거우니 라디에이터를 여닫아야 하고, 그게 v58 을'
    + ' 전투 한복판으로 끌어온다');
  ok(!!alive,
    `★★★ **얻을 것 없이 달려드는 곳이 있다** (${alive?.name ?? '없음'}) —`
    + ' 사장님 「외계 생명체가 … 공격을 해온다던지」. 드랍이 비어 있는 것이'
    + ' 요점이다: **싸워서 얻는 곳이 아니라 빨리 지나가야 하는 곳**이고,'
    + ' 그런 구역은 지금까지 없었다');
  const dark = REGIONS.filter((r) => (r.radar ?? 1) < 0.5);
  ok(dark.length >= 1,
    `★ **계기가 죽는 곳이 있다** (${dark.map((r) => r.name).join(' · ') || '없음'}) —`
    + ' 광학 창(v79)과 조준 띠(v114)가 제일 크게 사는 자리다');
}

console.log('\n[7] ★★★ **옛 여섯이 안 없어졌나** — 딴 계통이 이름을 읽는다');
{
  //  ★★★ `fault.js` 가 `region === 'debris'`, `hazard-table.js` 가
  //    `'nebula'`, `helm-table.js` 가 `'planet'` 을 읽는다. 이름을 갈면
  //    그 셋이 **조용히** 죽는다 — 검사도 화면도 아무 말을 안 한다
  const OLD = ['empty', 'nebula', 'debris', 'planet', 'siege', 'void'];
  const gone = OLD.filter((k) => !REGION_BY_KEY[k]);
  ok(!gone.length,
    `★★★ **옛 여섯이 다 있다**${gone.length ? ` — 없어진 것: ${gone.join(' · ')}` : ''}`
    + ' — `fault.js`(debris) · `hazard-table.js`(nebula) · `helm-table.js`(planet)가'
    + ' 이 이름들을 읽는다. 갈면 그 셋이 **조용히** 죽는다');
  ok(REGIONS.length > OLD.length,
    `★ 더한 것이 ${REGIONS.length - OLD.length} 개다 — 지우지 않고 늘렸다`);
}

console.log('\n[8] ★★★ **게임이 이 표대로 도나** — ★ v162 에 물렸다');
{
  //  ★ 이 저장소 규칙: ①뼈대 → ②뼈대만 시뮬 → ③갈아 끼우기 → ④화면과 대조.
  //    v161 은 ①② 까지였고 이 절이 「아직 안 물렸다」고 **스스로 적었다.**
  //    v162 가 ③ 을 했으므로 이제 이 절이 **파일을 읽어서** 확인한다 —
  //    「물렸다고 적기」가 아니라 「정말 물렸나 보기」다.
  const read = (f) => {
    try { return readFileSync(new URL(f, import.meta.url), 'utf8'); } catch { return ''; }
  };
  //  ★★★ **주석을 걷어내고 센다.** 이 저장소는 「낡았다」를 주석에 남기는
  //    규약이라, 안 걷으면 **기록이 코드로 세어져** 늘 초록이 된다
  //    (v152·v154 에 두 번 데었다)
  const code = (f) => read(f)
    .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const G = '../web/space/js/';
  const tgt = code(G + 'game/target.js');
  const ttab = code(G + 'game/target-table.js');
  const salv = code(G + 'game/salvage-table.js');
  const main = code(G + 'main.js');
  const rtab = code(G + 'game/route-table.js');

  ok(/foePoolOf\(sky\.region\)/.test(tgt),
    '★★★ **`foes` — 저절로 오는 적을 구역이 정한다** (`target.js`). v161 까지'
    + ' `TARGET.foePool` 한 통이라 **열두 곳이 다 같은 것을** 보냈다');
  ok(/REGIONS\.map\(\(r\) => \[r\.key, r\.crowd\]\)/.test(ttab),
    '★★★ **`crowd` — 몇이 떠 있나를 구역 표에서 뽑는다** (`target-table.js`).'
    + ' 손으로 적은 목록이라 v161 에 구역을 여섯 더했을 때 **조용히 안 늘었다**');
  ok(/dropsOf\(sky\.region/.test(tgt) && /dropsOf\(region/.test(salv),
    '★★★ **`drops` — 나오는 것에 구역 배수가 먹는다** (격추 즉시와 회수 꾸러미'
    + ' **양쪽**). 한쪽만 물리면 「계기에 뜬 것과 실은 것이 다르다」가 난다');
  ok(/barren\(region\)/.test(salv),
    '★★ **얻을 것 없는 구역에서는 꾸러미가 아예 안 떨어진다** — 빈 꾸러미를'
    + ' 떨구면 줍는 데 3~6초를 쓰고 아무것도 안 들어온다. 그건 결심이 아니라 함정이다');
  ok(/\?\.heat \?\? 0\)/.test(main),
    '★★★ **`heat` — 밖에서 오는 열이 `stepHeat` 의 `extra` 로 들어간다**'
    + ' (`main.js`). 사장님 「태양이 나타난다던지」가 v58 열 계통에 얹히는 자리');
  ok(/radarBlips\([^)]*radarQ\(\)\)/.test(main) && /stepRadar\([^)]*radarQ\(\)\)/.test(main),
    '★★★ **`radar` — 계기 성능이 구역을 따른다** (점 찍기와 락온 **양쪽**).'
    + ' 한쪽만 깎으면 「안 보이는데 묶인다」가 난다');
  ok(/offerFor\(rnd, leg = 0\)/.test(rtab) && /depthAt\(leg\)/.test(rtab),
    '★★★ **`depth` — 구간 번호가 어느 구역을 낼지 정한다** (`route-table.js`).'
    + ' 이것이 사장님이 말씀하신 「**맵이 앞으로 진행되게**」의 실체다');
}

console.log('\n[9] ★★★ **깊이 창에 양쪽이 다 있나** — 「숨는 쪽 하나 · 빠른 쪽 하나」');
{
  //  ★★★ 이 표의 축은 **매 구간 양쪽에서 하나씩**이다. 깊이 창을 씌우면
  //    한쪽이 텅 빈 구간이 생길 수 있고, 그러면 그 구간은 **고를 것이 없다.**
  //    `offerFor` 가 창을 넓혀서 메우는데, **얼마나 넓혀야 하는지**를 본다 —
  //    다섯 단계를 건너뛰어야 짝이 생기면 그건 「이 깊이의 선택」이 아니다
  let worst = 0; let where = '';
  for (let leg = 0; leg < LEG.count - 1; leg++) {
    const d = depthAt(leg);
    for (const side of ['hide', 'fast']) {
      const near = REGIONS.filter((r) => r.depth < 11
        && (r.signMult < 1 ? 'hide' : 'fast') === side);
      const gap = Math.min(...near.map((r) => Math.abs(r.depth - d)));
      if (gap > worst) { worst = gap; where = `${leg + 1}구간(깊이 ${d}) 의 ${side === 'hide' ? '숨는' : '빠른'} 쪽`; }
    }
  }
  console.log(`   제일 멀리서 데려오는 곳 — ${where} · ${worst} 단계 건너`);
  ok(worst <= 2,
    `★★★ **어느 구간도 ${worst} 단계 넘게 안 건너뛴다** (둘까지) — 더 멀리서`
    + ' 데려오면 「이 깊이의 선택」이 아니라 **아무 데서나 끌어온 것**이 된다');
  //  ★ 그리고 실제로 뽑아 본다 — 규칙이 맞아도 부르면 터지는 일이 있다
  const rnd = (() => { let h = 7; return { pick: (a) => a[(h = (h * 31 + 17) % 9973) % a.length] }; })();
  let bothOk = true;
  for (let leg = 0; leg < LEG.count - 1; leg++) {
    const off = offerFor(rnd, leg);
    if (off.length !== 2 || off.some((f) => !f?.name) || off[0].key === off[1].key) bothOk = false;
  }
  ok(bothOk, '★★ **11구간 다 둘이 나오고, 둘이 서로 다르다** — 같은 것 둘이 나오면'
    + ' 그 구간은 고르는 척만 하는 것이다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 열두 단계가 섰다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
