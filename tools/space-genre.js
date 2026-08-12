// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **우주 비행전투 RPG 인가** — 기둥 다섯이 다 서 있나 (v115 · 뼈대만)
//
//    node tools/space-genre.js
//
//  ★ 사장님 (2026-08-11) 「**우주 비행전투 rpg야 우리 장르야**」
//
//  ══ 이 검사가 하는 일 ═══════════════════════════════════════════════
//
//  `genre-table.js` 가 「이 장르는 기둥이 다섯이고, 각 기둥은 이 표들이
//  든다」고 적어 두었다. 이 검사는 **그 표들이 정말 있나**를 본다.
//
//  ★★ 문서는 낡아도 조용하지만 **검사는 소리를 낸다** — `space-story.js`
//    와 같은 규약이다. 장르가 바뀌거나 기둥 하나가 죽으면 여기가 빨개진다.
//
//  ★★★ 그리고 **RPG 라는 말이 더하는 기둥은 하나뿐**이다 (성장).
//    나머지 넷은 슈팅에도 있다. 그래서 이 검사는 성장을 제일 세게 묻는다.
// ══════════════════════════════════════════════════════════════════════════
import { existsSync } from 'node:fs';
import { GENRE, PILLARS, AXES, NOT } from '../web/space/js/game/genre-table.js';

const DIR = new URL('../web/space/js/game/', import.meta.url);
let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const has = (f) => existsSync(new URL(f, DIR));

console.log(`장르 — **${GENRE}** (뼈대만 · 게임을 안 부른다)`);

console.log('\n[1] ★★★ **기둥 다섯이 다 서 있나** — 표가 정말 있나');
{
  for (const p of PILLARS) {
    const missing = p.by.filter((f) => !has(f));
    console.log(`   ${p.rpg ? '★' : ' '} ${p.name.padEnd(3)} ${p.need}`);
    console.log(`       드는 것 ${p.by.join(' · ')}`
      + `${missing.length ? `  ← **없다: ${missing.join(' · ')}**` : ''}`);
    ok(!missing.length,
      `${p.name} 기둥이 서 있다${missing.length ? ` — **${missing.join(' · ')} 가 없다**` : ''}`);
  }
}

console.log('\n[2] ★★★ **RPG 라는 말이 값을 하나** — 성장이 두 갈래인가');
{
  for (const a of AXES) {
    const there = has(a.by);
    console.log(`   ${a.name.padEnd(3)} ${a.from.padEnd(12)} 운 ${a.luck ? '섞임' : '없음'}`
      + ` · 잃음 ${a.lose ? '있음' : '없음'} · ${a.by}${there ? '' : '  ← **없다**'}`);
    ok(there, `**${a.name}이 크는 길**이 있다 (${a.by}) — ${a.what}`);
  }
  // ══ ★★★ 이 한 줄이 이 검사의 이유다 ═════════════════════════════
  ok(AXES.every((a) => has(a.by)),
    '★★★ **두 갈래가 다 있다** — 배만 크면 「운이 나쁘면 회차가 망한다」가 되고,'
    + ' 사람만 크면 「주울 이유가 없다」가 된다. 둘 다 있어야 파밍도 살고 솜씨도 산다');
  ok(AXES.some((a) => !a.luck && !a.lose),
    '★★ **운이 안 섞이고 안 잃는 갈래가 하나 있다** — 없으면 그건 RPG 가 아니라'
    + ' 장비 게임이다. 사람은 잘하게 될 뿐 되돌아가지 않는다');
}

console.log('\n[3] ★ **안 하는 것 다섯** — 기둥은 세우는 것보다 안 무너뜨리는 것이 어렵다');
for (const n of NOT) console.log(`   · ${n.what}\n     ${n.why}`);

console.log(bad ? `\n✘ ${bad} 군데 — **${GENRE} 라고 하기에 빈 자리가 있습니다**`
  : `\n✔ 기둥 다섯이 다 섰습니다 — ${GENRE}`);
process.exit(bad ? 1 : 0);
