// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **표적이 눈에 보이나** (v148 · 뼈대 + 화면)
//
//    node tools/space-spot.js
//    python3 tools/serve.py 8391 &  node tools/space-spot.js --see 8391
//
//  ★ 사장님 (2026-08-14) 「**너무 빨간색 원이 많고 조잡한데 타겟 모습이
//    나오도록 할 수는 없어? 뭘 맞추는지도 모르겠어**」
//
//  ★★ 찍어서 재 보니 병이 둘이었다 (`game/spot-table.js` 머리말):
//    ① 몸통에 **빛이 안 닿는다** — 자체발광은 모든 면을 똑같이 밝혀서
//       「저기 있다」는 만들어도 **모양은 못 만든다**
//    ② **HUD 가 표적을 정확히 덮는다** — 봐야 할 곳이 제일 복잡한 곳이다
//
//  ★★★ 그리고 **광학 창(4배)에서는 잘 보였다.** 즉 3D 모형은 멀쩡하다 —
//    안 그랬으면 애먼 것을 고쳤을 것이다. **먼저 재고 나서 고친다.**
// ══════════════════════════════════════════════════════════════════════════
import { SUN, SKIN, READ, CLEAR, FOLDED, folds, marksAround } from '../web/space/js/game/spot-table.js';
import { PLANET } from '../web/space/js/game/sky-table.js';
import { CONE } from '../web/space/js/game/screen-table.js';
import { readFileSync } from 'node:fs';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

console.log('표적이 눈에 보이나 (게임을 안 부른다)');

console.log('\n[1] ★★★ **해가 하나뿐이고, 방향이 행성과 같나**');
{
  const d = SUN.dir;
  const len = Math.hypot(...d);
  ok(Math.abs(len) > 0.5, `해가 방향을 갖는다 (${d.map((x) => x.toFixed(2)).join(', ')})`);
  ok(d.every((x, i) => x === PLANET.sun[i]),
    '★★★ **행성이 쓰는 그 방향 그대로다** — 두 곳에 적으면 「행성은 왼쪽에서'
    + ' 해를 받는데 적은 오른쪽에서 받는」 화면이 된다. 사람은 그걸 말로'
    + ' 설명은 못 해도 **가짜 같다**고는 느낀다');
  ok(SUN.fill > 0 && SUN.fill < SUN.lit * 0.5,
    `★★ **채움 빛이 있되 약하다** (해 ${SUN.lit} · 채움 ${SUN.fill}) — 0 이면`
    + ' 그림자 쪽이 새까매서 배가 **반쪽으로 잘려** 보이고, 세면 대기가 있는'
    + ' 것처럼 보인다. 실제로도 별빛·행성반사가 조금은 있다');
}

console.log('\n[2] ★★★ **실내로 안 새나** — 층(layer)이 이 판의 핵심이다');
{
  ok(SUN.layer > 0, `★★★ 해가 **층 ${SUN.layer}** 에만 있다 — v82 에 태양을 놓았다가`
    + ' `DirectionalLight` 에 거리가 없어서 **배 안까지 밝아진** 사고가 있었다'
    + ' (`sky-table.js PLANET` 주석). 그 뒤로 이 저장소는 밖에 빛을 안 놓았다');
  const t = read('../web/space/js/world/targets.js');
  ok(t.includes('sun.layers.set(SUN.layer)') && t.includes('fill.layers.set(SUN.layer)'),
    '★★ 게임이 **정말 층을 매긴다** — 안 매기면 그 순간 v82 가 되풀이된다');
  ok(t.includes('litOutside(o)'),
    '★★★ **새로 서는 표적마다 층을 켠다** — 안 켜면 해가 안 닿아 v147 까지처럼'
    + ' 한 덩어리 얼룩으로 보인다. 「빛을 놓았다」와 「빛이 닿는다」는 다른 말이다');
  ok(SKIN.emissive < 0.5,
    `★★★ **자체발광을 ${SKIN.emissive} 로 낮췄다** (v87~v147 은 0.7~0.85) —`
    + ' 자체발광은 **모든 면을 똑같이** 밝히므로 「저기 있다」는 만들어도'
    + ' **모양은 못 만든다.** 오히려 실루엣을 뭉갠다. 이제 모양은 해가 만들고'
    + ' 자체발광은 **바닥만** 깐다 (해를 등진 쪽이 아주 사라지지 않게)');
}

console.log('\n[3] ★★★ **물었으면 표적 자리를 비우나**');
{
  console.log(`   안 물었을 때: ${marksAround(false).join(' · ')}`);
  console.log(`   물었을 때  : ${marksAround(true).join(' · ')}`);
  ok(marksAround(true).length <= CLEAR.maxMarks,
    `★★★ **물으면 표식이 ${marksAround(true).length} 개로 준다** (상한 ${CLEAR.maxMarks})`
    + ' — 사장님 「너무 빨간색 원이 많고 조잡한데」. 봐야 할 곳이 제일'
    + ' 복잡한 곳이면 그건 조준경이 아니라 장식이다');
  ok(marksAround(false).length > marksAround(true).length,
    '★★ **안 문 것에는 그대로 그린다** — 거기는 아직 실루엣이 안 읽히므로'
    + ' 도형이 「저기 뭐가 있다」를 대신해야 한다. 물었을 때만 비운다');
  ok(folds(true).length === FOLDED.length && folds(false).length === 0,
    `★ 접는 것 ${FOLDED.length} 개가 **물었을 때만** 접힌다`);
  ok(FOLDED.every((f) => f.what && f.why && f.why.length > 20),
    '★★★ **무엇을 왜 접었는지 다 적혀 있다** — 조용히 지우면 다음 판에 다시'
    + ' 그린다 (`pilot-table.js FOLDED_CHECKS` 와 같은 규약)');
  ok(CLEAR.corner > 0 && CLEAR.corner < 0.5,
    `★★★ **상자가 네 변이 아니라 귀퉁이 토막이다** (변의 ${(CLEAR.corner * 100).toFixed(0)}%)`
    + ' — 실기 HUD 의 TD box 가 그렇다. 변을 다 그리면 그 변이 **실루엣을'
    + ' 가로지르고**, 특히 위아래 변이 날개 자리를 지난다');
  const g = read('../web/space/js/world/gunsight.js');
  ok(g.includes('if (!isLocked) glyph('),
    '★★★ 조준경이 **정말 안 그린다** — 표만 고치고 그리는 쪽을 안 고치면'
    + ' 표는 초록인데 화면은 그대로다 (v145 가 그 상태였다)');
  ok(g.includes('CLEAR.corner'),
    '★ 귀퉁이 길이를 **표에서 읽는다** — 여기서 숫자를 적으면 검사가'
    + ' 「정말 뚫렸나」를 못 묻는다');
}

console.log('\n[4] ★★ **읽히는 바닥값이 서 있나**');
{
  ok(READ.minShade > 0 && READ.minAgainstSky > 0 && READ.minPixels > 0,
    `밝은/어두운 면 차 ${READ.minShade} · 배경 대비 ${READ.minAgainstSky}`
    + ` · 최소 ${READ.minPixels} 화소`);
  ok(CLEAR.inner > 0,
    `★ 표적 반지름의 ${CLEAR.inner} 배 안쪽은 안 그린다`);
  //  ★ 원뿔 값은 `screen-table.js` 것을 쓴다 — 여기 새로 안 적는다
  ok(typeof CONE === 'number' && CONE > 0, `전투 원뿔은 ${CONE} (screen-table.js 것)`);
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 표적이 보일 자격이 생겼다');
process.exit(bad ? 1 : 0);
