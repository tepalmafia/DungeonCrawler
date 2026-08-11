// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **범례** — 뼈대만 (v108)
//
//    node tools/space-legend.js
//
//  ★ 사장님 「**우측 화면 상단에 도형이나 기타 표시로 적인지 물체인디
//    행성인지 알 수 있도록** 도움말 같은걸 표시해줘. 그래서 **글씨가 아닌
//    이모티콘이나 도형으로** 무슨 의미인지 알 수 있도록」
//
//  ★★★ 묻는 것 넷
//      ① **정말 무리가 없었나** — 모양은 아홉인데 뜻을 묶는 것이 있었나
//      ② 종류가 **하나도 안 빠졌나** — 빠지면 그건 「모르는 것」이 된다
//      ③ ★★ 무리가 **셋인가** — 넷째를 넣으면 색을 배우는 게임이 된다
//      ④ ★ 색이 **이미 쓰던 것**인가 — 새 색을 안 만든다
// ══════════════════════════════════════════════════════════════════════════
import { BANDS, BAND_BY, BAND_OF, bandOf, hueOf, AT, WORDS_FOR } from '../web/space/js/game/legend-table.js';
import { KINDS } from '../web/space/js/game/target-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

console.log('범례 — 뼈대만 (게임을 안 부른다)');

console.log('\n[1] ★★★ **정말 무리가 없었나** — 모양은 아홉인데 뜻이 안 묶였다');
{
  const ks = Object.keys(KINDS);
  console.log(`   떠도는 것이 ${ks.length} 가지다:`);
  for (const b of BANDS) {
    const mine = ks.filter((k) => BAND_OF[k] === b.key);
    console.log(`   ${b.mark.padEnd(6)} ${b.name.padEnd(8)} ${mine.map((k) => KINDS[k].name).join(' · ')}`);
  }
  const foes = ks.filter((k) => KINDS[k].shoots || KINDS[k].rams);
  ok(foes.length >= 4,
    `★★ 쏘거나 들이받는 것이 ${foes.length} 가지인데 **모양이 다 달랐다** —`
    + ' 처음 보는 사람에게 「이건 적이다」를 말해 주는 것이 없었다');
  ok(BANDS.every((b) => b.hue && b.mark && b.what),
    '★★★ 이제 무리마다 **색 · 도형 · 한 마디**가 다 있다');
}

console.log('\n[2] ★★ 종류가 **하나도 안 빠졌나**');
{
  const ks = Object.keys(KINDS);
  const miss = ks.filter((k) => !BAND_OF[k]);
  ok(!miss.length,
    `★★★ **떠도는 것 ${ks.length} 가지가 다 어느 무리에 든다**`
    + `${miss.length ? ` — 빠진 것: ${miss.join(' · ')}` : ''}`);
  // ★ 자동으로 가르면 틀린다 — 그래서 손으로 적었다. 그 손이 맞나 본다
  ok(bandOf('drone').key === 'foe',
    '★★★ **자폭정은 적이다** — 안 쏘지만 들이받는다.'
    + ' 「쏘면 적」으로 자동으로 갈랐으면 물건이 됐을 것이다');
  ok(bandOf('convoy').key === 'thing',
    '★★★ **보급 호송선은 물건이다** — 안 쏜다. 같은 규칙으로 자동으로'
    + ' 갈랐으면 적이 됐을 것이다');
  ok(bandOf('없는것').key === 'thing',
    '★ 모르는 것은 **물건**으로 본다 — 「적인 줄 알았는데 아니었다」보다'
    + ' 「물건인 줄 알았는데 적이었다」가 덜 위험하다… 는 반대다.'
    + ' 다만 모르는 종류가 생기면 위 검사가 먼저 빨개진다');
}

console.log('\n[3] ★★ 무리가 **셋인가**');
{
  ok(BANDS.length === 3,
    `★★★ **${BANDS.length} 개다** — 사장님이 말씀하신 그대로다`
    + ' (「적인지 물체인디 행성인지」). 넷째를 넣으면 색을 배우는 게임이 된다');
  ok(new Set(BANDS.map((b) => b.hue)).size === 3, '★ 색이 안 겹친다');
  ok(new Set(BANDS.map((b) => b.mark)).size === 3,
    '★★ **모양도 안 겹친다** — 색맹이어도 갈린다. 색 하나로만 가르면'
    + ' 열두 명 중 한 명은 못 읽는다');
}

console.log('\n[4] ★ 자리와 글');
{
  ok(AT.right < 0.1 && AT.top < 0.1, '★ **오른쪽 위**에 앉는다 (사장님 말씀 그대로)');
  ok(AT.w < 0.3, `★ 화면의 ${(AT.w * 100).toFixed(0)}% 만 쓴다 — 범례가 화면을 먹으면 안 된다`);
  ok(WORDS_FOR > 0,
    `★★★ **${WORDS_FOR}초 뒤에는 글이 사라지고 도형만 남는다** —`
    + ' 사장님 「글씨가 아닌 … 도형으로」. 영영 붙어 있으면 범례가 아니라 설명서다');
  for (const b of BANDS) console.log(`   ${b.hue}  ${b.mark.padEnd(6)} ${b.name} — ${b.what}`);
  ok(BANDS.every((b) => b.what.length > 8), '★ 한 마디가 빈 것이 없다');
  ok(hueOf('fighter') === BAND_BY.foe.hue && hueOf('junk') === BAND_BY.thing.hue,
    '★★ 종류를 주면 색이 나온다 — 조준경·레이더가 이걸 묻는다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
