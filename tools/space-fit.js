// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **장르에 안 맞는 설정이 남아 있나** (v117 · 뼈대만)
//
//    node tools/space-fit.js
//
//  ★ 사장님 (2026-08-12) 「**우리 장르에 맞지 않는 설정들이 없는지
//    점검해봐**」
//
//  ══ 왜 이 검사가 필요한가 ═══════════════════════════════════════════
//
//  이 저장소는 **목적이 두 번, 조작이 한 번 통째로 바뀌었다**:
//
//      GRIND.md §7   「짧고 밀도 높은 한 번」 → **계속 도는 게임**
//      WAR.md §9     「도망친다」 → **뚫고 들어간다**
//      v109·v110     「배 안을 걸어다니는 정비공」 → **조종석에 앉은 조종사**
//      v115          장르를 못박음 → **우주 비행전투 RPG**
//
//  ★ 바뀔 때마다 **옛 설정이 표와 주석에 남았다.** 이 저장소가 그것을
//    v110 에 스물두 개, v116 에 다섯 개 찾아냈다 — 둘 다 **사장님이
//    화면을 보시고** 물으신 뒤였다. 사람이 눈으로 찾는 한 또 남는다.
//
//  ★★★ 그래서 **기계로 센다.** 이 검사가 묻는 것은 「재미있나」가 아니라
//    **「지금 장르에서 닿을 수 있나」**뿐이다 — 그것만은 표로 답이 난다.
//
//  ══ 무엇을 보나 ═══════════════════════════════════════════════════
//
//   ① ★★★ **조종석에서 못 하는 것** — 앉아서 시작해 안 일어나는데
//      다른 방을 요구하는 항목이 있나 (`PILOT.canStand === false`)
//   ② **배에 없는 방**을 가리키는 항목
//   ③ ★★★ **장르 기둥 어디에도 안 붙는 표** — 다섯 기둥 중 아무 데도
//      안 들어가면 그건 이 게임의 것이 아니거나, 기둥 표가 낡은 것이다
//   ④ ★★ **뒤집힌 말이 주석에 남아 있나** — 「도망」·「정비공」·
//      「20분 회차」·「회차 배수」 같은 낡은 목적의 낱말
//   ⑤ **손이 셋을 넘나** — 조종석 하나짜리 배에서 손은 셋이다
// ══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { PILOT, FOLDED_CHECKS, foldedWhy } from '../web/space/js/game/pilot-table.js';
import { ROOMS } from '../web/space/js/game/rooms-table.js';
import { wired, blocked } from '../web/space/js/game/mission-table.js';
import { MISSIONS } from '../web/space/js/game/mission-table.js';
import { PILLARS, GENRE } from '../web/space/js/game/genre-table.js';
import { KEYS, HAND_MAX } from '../web/space/js/game/keys-table.js';

const DIR = new URL('../web/space/js/game/', import.meta.url);
let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const files = readdirSync(DIR).filter((f) => f.endsWith('-table.js'));
const read = (f) => readFileSync(new URL(f, DIR), 'utf8');

console.log(`장르에 안 맞는 설정이 남아 있나 — **${GENRE}** (뼈대만)`);

console.log('\n[1] ★★★ **조종석에서 못 하는 것이 있나** — 앉아서 시작해 안 일어난다');
{
  console.log(`   \`PILOT.canStand\` = ${PILOT.canStand} · \`seatOnly\` = ${PILOT.seatOnly}`);
  // ★ 조종석에서 되는 자리 — 앉은 채 닿는 곳
  const SEAT = new Set(['cockpit', 'helm', 'screen', null, undefined]);
  const away = MISSIONS.filter((m) => (m.where ?? []).some((w) => !SEAT.has(w)));
  for (const m of away) {
    const built = m.steps || (m.branches ?? []).some((b) => b.at);
    console.log(`   ${built ? '★' : ' '} ${m.name.padEnd(10)} ${(m.where ?? []).join(' · ')}`
      + `   ${built ? '**게임에 물려 있다**' : '(표에만 있다)'}`);
  }
  // ★★ **물려 있는 것**만 진짜 문제다 — 표에만 있는 것은 안 뜨므로
  //   사람이 못 만난다. 다만 그건 ②가 따로 센다
  // ★★★ v117 — **표 자신에게 묻는다.** `wired()` 가 이제 장르를 보므로
  //   (`mission-table.js reachable`), 「물려 있다」는 말이 진짜가 됐다
  const w = wired(); const b2 = blocked();
  console.log(`   물린 것 ${w.length} — ${w.map((m) => m.name).join(' · ') || '없다'}`);
  console.log(`   막힌 것 ${b2.length} — ${b2.map((m) => m.name).join(' · ') || '없다'}`);
  ok(!w.some((m) => (m.steps ?? []).some((st) => !SEAT.has(st.at))),
    '★★★ **「물려 있다」고 말하는 것 중에 조종석 밖으로 걸어가는 것이 없다**'
    + ' — v116 까지 표는 고장 아홉을 「물려 있다」고 말했지만 `PILOT.faults`'
    + ' 는 v106 에 이미 false 였다. **표가 거짓말을 하고 있었다**');
  ok(b2.length > 0,
    `★★ 막힌 것 ${b2.length} 개가 **이름을 갖고 남아 있다** — 지우지 않는다.`
    + ' 걷기가 돌아오거나 고장을 다시 켜면 저절로 되살아난다');
  ok(away.length > 0,
    `★★ 표에만 남은 것이 ${away.length} 개 있다 — **지우지 않는다.** 지우면 다음에`
    + ' 같은 것을 또 만든다 (`farm-table.js RETIRED` 와 같은 규약). 다만'
    + ' **지금 장르로 다시 지어야** 게임에 나온다');
}

console.log('\n[2] ★★ **배에 없는 방을 가리키나**');
{
  // ★ v117 — `ROOMS` 는 **배열**이다. `Object.keys` 로 읽어 0~6 이 나왔고,
  //   그래서 **모든 방이 「없는 방」으로** 찍혔다 — 검사가 스스로 틀린 것을
  //   재고 있었다. 「재는 것이 화면과 다르면 그 숫자로 고치면 안 된다」
  // ★ `'any'` 는 방 이름이 아니라 **「어디든」이라는 표시**다 (미소운석).
  //   갈래가 방을 뽑으므로 여기서 없는 방이라고 하면 틀린 말이 된다
  const have = new Set([...ROOMS.map((r) => r.key), 'any']);
  const ghost = [];
  for (const m of MISSIONS) {
    for (const w of m.where ?? []) if (!have.has(w)) ghost.push(`${m.name}→${w}`);
  }
  console.log(`   배의 방 ${[...have].join(' · ')}`);
  ok(!ghost.length, `**없는 방을 가리키는 항목이 없다**${ghost.length ? ` — ${ghost.join(' · ')}` : ''}`);
}

console.log('\n[3] ★★★ **장르 기둥 어디에도 안 붙는 표가 있나**');
{
  const inPillar = new Set(PILLARS.flatMap((p) => p.by));
  // ★ 기둥이 이름을 안 부르더라도, **기둥이 부르는 표가 쓰는 표**면 붙은 것이다
  const reach = new Set(inPillar);
  for (let i = 0; i < 4; i++) {
    for (const f of [...reach]) {
      let src = '';
      try { src = read(f); } catch { continue; }
      for (const g of files) if (src.includes(`./${g}`)) reach.add(g);
    }
  }
  const loose = files.filter((f) => !reach.has(f));
  console.log(`   표 ${files.length} 개 중 기둥에 닿는 것 ${reach.size} 개`);
  if (loose.length) console.log(`   닿지 않는 것 — ${loose.join(' · ')}`);
  // ★★ **닿지 않는다고 곧 틀린 것은 아니다.** 계기·소리·저장처럼 기둥
  //   아래를 받치는 것도 있다. 그래서 이름을 부르고 **사람이 판정**하게 한다
  // ══ ★★★ v117 — **묻는 것을 바꿨다** ═══════════════════════════════
  //  처음엔 「기둥이 이름을 부르나」를 따라갔는데, 기둥은 표를 **몇 개만**
  //  대표로 부르므로 71 중 19 만 닿았다 — 그 숫자로는 아무 말도 못 한다.
  //  ★ 진짜 물어야 하는 것은 **「아무도 안 쓰는 표가 있나」**다.
  //    쓰이지 않는 표가 곧 「게임에 없는 설정」이고, 그게 이 검사의 일이다
  // ★★ v117 — 처음에 `game/` 과 `main.js` 만 훑었다가 **일곱을 「아무도 안
  //   쓴다」고 잘못 셌다** — 하늘·계기·방은 `world/` 가 쓴다. **소스를 다
  //   읽어야** 「안 쓰인다」를 말할 수 있다
  const SRC = new URL('../web/space/js/', import.meta.url);
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory()
    ? walk(new URL(`${e.name}/`, d)) : [readFileSync(new URL(e.name, d), 'utf8')]));
  const bodies = walk(SRC).join('\n');
  /**
   * ★★ **도구만 읽는 표**는 예외다 — 그게 그 표의 일이다.
   *   `genre-table.js` 는 장르를, `story-table.js` 는 이야기를 담고,
   *   둘 다 **검사가 게임을 견주는 자**다 (게임이 읽으면 오히려 이상하다)
   */
  const BY_TOOLS = ['genre-table.js', 'story-table.js'];
  const orphan = files.filter((f) => !BY_TOOLS.includes(f)
    && !bodies.includes(`/${f}`) && !bodies.includes(`'./${f}`));
  if (orphan.length) console.log(`   아무도 안 쓰는 표 — ${orphan.join(' · ')}`);
  ok(!orphan.length,
    `★★★ **아무도 안 쓰는 표가 없다** (${orphan.length}) — 쓰이지 않는 표가`
    + ' 곧 「게임에 없는 설정」이다. 있으면 접든지 물리든지 해야 한다');
}

console.log('\n[4] ★★★ **뒤집힌 말이 표에 남아 있나** — 낡은 목적은 주석으로 산다');
{
  /**
   * ★ 「이 낱말이 나오면 무조건 틀렸다」가 아니다. **뒤집힌 것을 적어 둔
   *   자리**(「그건 낡은 것이다」)는 오히려 있어야 한다. 그래서 **그 낱말이
   *   나오는데 「낡은/뒤집/옛」 같은 말이 같이 없는 줄**만 센다
   */
  const DEAD = [
    ['20분 회차', /20분\s*회차/],
    ['회차 배수', /회차\s*배수/],
    ['정비공이지 조종사가 아니다', /정비공이지/],
    ['따라오지 못하는 곳', /따라오지\s*못하는/],
    ['걸어가서', /걸어가서/],
  ];
  const hits = [];
  for (const f of files) {
    const lines = read(f).split('\n');
    lines.forEach((ln, i) => {
      for (const [name, re] of DEAD) {
        if (!re.test(ln)) continue;
        // ★ 뒤집혔다고 적어 둔 줄이면 넘어간다 — 그건 기록이지 설정이 아니다
        // ★ v117 — 창을 3 줄에서 **6 줄**로 넓혔다. 「걸어가서 하던 것을
        //   이제 …」처럼 **바뀐 것을 적어 둔 자리**가 세 줄 밖에 있어
        //   기록이 설정으로 잘못 세어졌다
        const around = lines.slice(Math.max(0, i - 6), i + 6).join(' ');
        // ★ v117 — 표시어를 넓혔다. 「걸어가서 꽂는 것이 **아니라**」·
        //   「그 방이 **없어졌다**」처럼 **바뀐 것을 적어 둔 말투**가
        //   `아니다`·`없앴` 로만 잡히지 않아 기록이 설정으로 세어졌다
        if (/낡은|뒤집|옛\s|없앴|없어졌|접었|죽었|바뀌|대신|아니라|안 한다|아니다/.test(around)) continue;
        hits.push(`${f}:${i + 1} ${name}`);
      }
    });
  }
  if (hits.length) for (const h of hits) console.log(`   ✘ ${h}`);
  ok(!hits.length,
    `★★★ **뒤집힌 낱말이 설정으로 남아 있지 않다** (${hits.length})`
    + ' — 이 저장소는 옛 목적이 주석에 남아 몇 달을 간 적이 두 번 있다.'
    + ' 「낡았다」고 적어 둔 자리는 세지 않는다 (그건 기록이다)');
}

console.log('\n[5] ★★ **손이 셋을 넘나** — 조종석 하나짜리 배의 손');
{
  const codes = [...new Set(Object.values(KEYS).map((k) => k.code))];
  console.log(`   맡은 키 ${codes.length} — ${codes.join(' · ')}`);
  const hands = [...new Set(Object.values(KEYS).map((k) => k.hand))];
  ok(hands.length <= 2, `손이 ${hands.length} 짝이다 (${hands.join(' · ')})`);
  ok(HAND_MAX <= 3,
    `★★ 한 번에 잡는 것이 **${HAND_MAX} 개 이하**다 — 조종간·스로틀·방아쇠.`
    + ' 넷이 되면 그건 앉은 사람이 못 하는 배다');
}

console.log('\n[6] ★★★ **접힌 검사가 접힌 채로 있나** (v124 · 사장님 「낡은 절들 정리해줘」)');
{
  // ══ ★★★ 여기가 이 절의 요점이다 ══════════════════════════════════
  //
  //  v109·v110 이 걷기와 방 여섯을 없앴는데 그것을 재던 검사 아홉이
  //  남아 있었다. 넷은 **빨갛게** 울고 있었고 (낡은 빨강은 새 빨강을
  //  덮는다 — v120·v121 에 두 번 겪었다), 다섯은 **초록으로 거짓말**을
  //  하고 있었다 — 「걸어오는 동안 문이 다 열린다」가 초록이었다.
  //
  //  ★ 지우지 않고 **접었다.** 그래서 이제 물어야 할 것이 생긴다:
  //    ① 목록이 가리키는 파일이 정말 있나 (이름이 틀리면 안 접힌다)
  //    ② 그 파일이 정말 **물러나게** 돼 있나 (`bailIfFolded`)
  //    ③ 걷기가 돌아오면 **한꺼번에** 깨어나나
  const missing = [], ungated = [];
  for (const [name] of FOLDED_CHECKS) {
    const f = `tools/${name}.js`;
    if (!existsSync(f)) { missing.push(name); continue; }
    if (!readFileSync(f, 'utf8').includes('bailIfFolded')) ungated.push(name);
  }
  console.log(`   접힌 검사 ${FOLDED_CHECKS.length} —`);
  for (const [n, what, why] of FOLDED_CHECKS) console.log(`     ${n.padEnd(14)} ${what}\n${' '.repeat(21)}└ ${why}`);
  ok(!missing.length,
    `★★ **목록이 가리키는 파일이 다 있다** ${missing.length ? `— 없는 것 ${missing.join(' · ')}` : ''}`
    + ' — 이름이 틀리면 접히지도 깨어나지도 않는다');
  ok(!ungated.length,
    `★★★ **아홉이 다 물러나게 돼 있다** ${ungated.length ? `— 안 물러나는 것 ${ungated.join(' · ')}` : ''}`
    + ' — 목록에만 적고 파일에 안 물리면 그 검사는 계속 거짓말을 한다');
  ok(FOLDED_CHECKS.every(([, , why]) => why && why.length > 4),
    '★ 접은 **까닭**이 다 적혀 있다 — 까닭 없이 접으면 다음에 왜 접었는지 모른다');
  ok(FOLDED_CHECKS.every(([n]) => foldedWhy(n)) === !PILOT.canStand,
    `★★★ **canStand 하나가 아홉을 다 여닫는다** (지금 ${PILOT.canStand}) —`
    + ' 도구마다 제 조건을 적으면 걷기가 돌아왔을 때 아홉 군데를 다 찾아 풀어야 하고,'
    + ' 한 군데만 빠뜨려도 조용히 죽는다');
}

console.log(bad ? `\n✘ ${bad} 군데 — **장르와 어긋난 자리가 있습니다**`
  : `\n✔ 지금 있는 설정이 다 ${GENRE} 안에 있습니다`);
console.log(`
  ※ **「재미있나」는 여기서 안 나온다.** 여기서 나오는 것은
     「지금 장르에서 **닿을 수 있나**」뿐이다.`);
process.exit(bad ? 1 : 0);
