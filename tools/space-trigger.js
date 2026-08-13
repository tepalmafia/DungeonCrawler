// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **방아쇠** — 당긴 것과 나간 것 사이 (v143 · 뼈대만)
//
//    node tools/space-trigger.js
//
//  ★ 사장님 (2026-08-13) 「**발사가 안되잔아!!**」 · 「근본적인 원인을 찾아.
//    그냥 찾지말고 **블록아웃 실제로 만들어서 한번에 고쳐**」
//
//  ★★★ 묻는 것 일곱
//      ① **문이 한 줄로 서 있나** — 판정하는 곳이 둘이면 한쪽은 반드시 조용해진다
//      ② ★★★ **말 없는 문이 없나** — 이 검사의 알맹이다
//      ③ ★★★ **전 조합을 쓸어도 「막혔는데 말이 없다」가 0 인가**
//      ④ ★★★ **앉아 있고 겨눴고 탄이 있으면 나가나** — 다른 문이 안 끼어드나
//      ⑤ ★★ **없앤 문 둘이 정말 게임에서 빠졌나** (`steering` · `aimName`)
//      ⑥ ★★ **화면과 검사가 같은 말을 쓰나** — 말이 두 벌이면 또 갈라진다
//      ⑦ ★ **막는 문마다 사람이 할 일이 있나** (없어도 되지만, 있으면 적는다)
// ══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import {
  GATES, BY_KEY, DROPPED, triggerWhy, gateWord, gateFix,
} from '../web/space/js/game/trigger-table.js';
import { WHY as CBT_WHY, whyNotFire, WEAPONS } from '../web/space/js/game/combat-table.js';
import { makeAmmo } from '../web/space/js/game/ammo-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

console.log('방아쇠 — 당긴 것과 나간 것 사이 (게임을 안 부른다)');

console.log('\n[1] ★★★ **문이 한 줄로 서 있나**');
{
  console.log('   순서  열쇠      무엇을 묻나');
  GATES.forEach((g, i) => {
    console.log(`   ${String(i + 1).padStart(2)}   ${g.key.padEnd(8)}  ${g.ask}`);
  });
  ok(GATES.length >= 8,
    `★★★ **문 ${GATES.length} 개가 한 표에 있다** — v142 까지 방아쇠 앞의 문은`
    + ' **입력 가지**(`steering` · `aimName`)와 **`whyNotFire`** 로 갈라져 있었고,'
    + ' 갈라진 쪽에는 말이 없었다. 판정하는 곳이 둘이면 한쪽은 반드시 조용해진다');
  const keys = GATES.map((g) => g.key);
  ok(new Set(keys).size === keys.length, '★ 열쇠가 안 겹친다');
}

console.log('\n[2] ★★★ **말 없는 문이 없나** — 이 검사의 알맹이다');
{
  const mute = GATES.filter((g) => !g.say || !g.say.trim());
  ok(mute.length === 0,
    '★★★ **문 전부가 말을 한다** — 「막혔는데 아무 말도 안 나는 것」이'
    + ' 이 저장소가 제일 자주 태우는 모양이다 (v133 사거리 · v141 탄 통 ·'
    + ' v142 잡기). 셋 다 **값이 아니라 「말이 없는 것」**이 병이었다');
  ok(GATES.every((g) => gateWord(g.key).length >= 4),
    '★★ 말이 **한 마디 이상**이다 — 「안 됩니다」 한 마디는 안내가 아니다');
  ok(gateWord(null) === '',
    '★ 막힌 것이 없으면 **아무 말도 안 한다** — 잘 나갈 때 말이 뜨면 그게 소음이다');
}

console.log('\n[3] ★★★ **전 조합을 쓸어도 조용한 구멍이 0 인가**');
{
  //  ★ 문 앞쪽 셋(dead·paused·seat)과 `whyNotFire` 가 낼 수 있는 열쇠 전부를
  //    곱해서 쓴다. **막혔는데 말이 없는 칸**이 하나라도 있으면 빨개진다
  const whys = [null, ...Object.keys(CBT_WHY), 'cover'];
  let n = 0; let mute = 0; let blocked = 0;
  for (const dead of [false, true]) {
    for (const paused of [false, true]) {
      for (const seat of [false, true]) {
        for (const why of whys) {
          n++;
          const g = triggerWhy({ dead, paused, seat, why });
          if (g === null) continue;
          blocked++;
          if (!gateWord(g)) mute++;
        }
      }
    }
  }
  console.log(`   조합 ${n} 가지 · 막힌 것 ${blocked} · **말 없는 것 ${mute}**`);
  ok(mute === 0,
    `★★★ **${n} 가지를 다 쓸어도 「막혔는데 말이 없다」가 ${mute} 다** —`
    + ' 사장님이 겪으신 것은 「안 나간다」가 아니라 **「안 나가는데 왜인지 모른다」**다');
  ok(triggerWhy({ seat: true, why: null }) === null,
    '★★★ **다 갖추면 아무 문도 안 막는다** — 문을 세우다 보면 「늘 막히는」'
    + ' 표가 되기 쉽다. 그러면 고친 것이 아니라 잠근 것이다');
}

console.log('\n[4] ★★★ **앉아 있고 겨눴고 탄이 있으면 정말 나가나**');
{
  //  ★ `whyNotFire` 를 **진짜로** 부른다 — 표만 보고 「나갈 것이다」라고
  //    믿으면 그게 v141 의 병(말과 판정이 갈라진다)이다
  const target = { id: 1, kind: 'raider', dist: 70, vaz: 0, vel: 0 };
  const supply = { ore: 99, parts: 99, missiles: 9, ammo: makeAmmo() };
  console.log('   무기      whyNotFire   방아쇠');
  for (const w of Object.values(WEAPONS)) {
    const why = whyNotFire({
      weapon: w, target, locked: true, supply, cool: 0, radar: true,
    });
    const g = triggerWhy({ seat: true, why });
    console.log(`   ${w.name.padEnd(6)}  ${String(why ?? '—').padEnd(10)}   ${g ? gateWord(g) : '★ 나간다'}`);
    ok(g === null,
      `★★★ **${w.name} 이 나간다** — 70m · 묶었고 · 탄이 있고 · 앉아 있다.`
      + ' 여기서 막히면 그건 문이 아니라 **자물쇠**다');
  }
}

console.log('\n[5] ★★★ **없앤 문 둘이 정말 게임에서 빠졌나**');
{
  const main = read('../web/space/js/main.js');
  console.log(`   없앤 문: ${DROPPED.map((d) => d.key).join(' · ')}`);
  //  ★★★ 여기가 이 검사의 두 번째 알맹이다. 표에서만 지우고 게임에 남기면
  //    **표는 초록인데 사람은 그대로 못 쏜다** — 「죽은 초록」의 정석이다
  ok(!/firePressed\s*=\s*steering/.test(main),
    '★★★ **방아쇠가 「조종간을 잡았나」를 안 묻는다** — v110 이 「항상 앉은'
    + ' 상태에서 모든 조작을 한다」를 기본으로 못박았는데 방아쇠만 「먼저'
    + ' 잡아라」를 요구하고 있었다. 잡는 법을 모르면 **말 한마디 없이 영영**'
    + ' **못 쏜다** — 사장님이 「발사가 안되잔아」라고 하신 그것이다');
  ok(!/firePressed\s*=[^;]*aimName/.test(main),
    '★★★ **방아쇠가 「조준선에 계기가 걸렸나」를 안 묻는다** — 조준경이 화면'
    + ' 복판에 있으므로 **겨누는 자리가 곧 계기가 걸리는 자리**다. 즉 이 문은'
    + ' **정확히 쏘려는 순간에만** 막았다. v88 에 좌클릭이 발사였을 때 필요했던'
    + ' 문이고, v110 에 Space 로 옮기며 쓸 데가 없어졌는데 남아 있었다');
  ok(DROPPED.every((d) => d.why && d.why.length > 40),
    '★★ **왜 없앴는지가 표에 남아 있다** — 지우기만 하면 다음 사람이'
    + ' 「왜 없지」를 못 묻고, 그러면 **비슷한 문을 또 만든다**');
}

console.log('\n[6] ★★ **화면과 검사가 같은 말을 쓰나**');
{
  const main = read('../web/space/js/main.js');
  ok(/trigger-table\.js/.test(main),
    '★★★ **게임이 이 표에서 말을 읽는다** — 안 읽으면 표는 표대로 초록이고'
    + ' 화면은 화면대로 조용하다 (이 저장소의 오랜 규약: 재는 곳을 둘로 안 만든다)');
  //  ★ `whyNotFire` 가 내는 열쇠는 **전부** 이 표에 자리가 있어야 한다.
  //    없으면 그 열쇠는 화면에서 「지금은 못 쏩니다」로 뭉개진다
  const missing = Object.keys(CBT_WHY).filter((k) => !BY_KEY[k]);
  console.log(`   whyNotFire 의 열쇠 ${Object.keys(CBT_WHY).length} 개 중 표에 없는 것: ${missing.length ? missing.join(' · ') : '없음'}`);
  ok(missing.length === 0,
    '★★★ **`whyNotFire` 의 열쇠가 다 이 표에 있다** — 하나라도 빠지면 그 까닭만'
    + ' 「지금은 못 쏩니다」로 뭉개져서, 고칠 방법을 아는 사람만 고친다');
}

console.log('\n[7] ★ **막는 문마다 사람이 할 일이 있나**');
{
  const doable = GATES.filter((g) => gateFix(g.key));
  console.log(`   지금 할 일이 적힌 문 ${doable.length}/${GATES.length} — ${doable.map((g) => `${g.key}(${g.fix})`).join(' · ')}`);
  ok(doable.length >= 5,
    '★★ **절반 넘는 문이 「지금 뭘 하면 되는지」를 안다** — v133 에 사장님이'
    + ' 「공격이 안되는 이유는?」이라고 물으신 뒤 배운 것이다:'
    + ' **「안 된다」까지만 말하는 안내는 안내가 아니다**');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
