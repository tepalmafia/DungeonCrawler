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
// ★★★ v151 — 「잴 것이 없으면 멈춘다」는 **한 곳에** 있다 (`folded.js` 옆)
import { measuring } from './unmeasured.js';

const DIR = new URL('../web/space/js/game/', import.meta.url);
let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const files = readdirSync(DIR).filter((f) => f.endsWith('-table.js'));
const read = (f) => readFileSync(new URL(f, DIR), 'utf8');

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ v151 — **잴 것이 없으면 통과가 아니라 「측정 불가」다**
//
//  ★ 이 검사는 「없어야 한다」 꼴로만 물어보는 도구다. 「없는 방을 안
//    가리킨다」·「아무도 안 쓰는 표가 없다」·「뒤집힌 낱말이 안 남았다」·
//    「안 물러나는 검사가 없다」 — **훑을 목록이 비면 넷이 다 저절로 참**
//    이 되고, 그러면 이 도구는 **아무것도 안 재고 초록**이 된다.
//
//  ★★★ [6] 의 마지막 줄이 제일 고약하다:
//
//      ok(FOLDED_CHECKS.every(([n]) => foldedWhy(n)) === !PILOT.canStand, …)
//
//    `FOLDED_CHECKS` 가 **비면** `every()` 가 참이고 `!canStand` 도 참이라
//    **양쪽이 맞아떨어진다** — 접힌 검사가 하나도 없는데
//    **「canStand 하나가 아홉을 다 여닫는다」**가 뜬다. 이 절이 지키려던
//    것이 「목록과 파일이 갈라지지 않는가」인데, **목록이 통째로 없어지는
//    것**만은 못 잡고 있었다.
//
//  ★★ 그래서 **재기 전에 「잴 것이 있나」를 먼저 묻는다.** 없으면
//    합격도 불합격도 아닌 **2**(못 쟀다)로 끝난다 (`unmeasured.js`).
//  ★ **이름을 종류마다 나눠 부른다** (`must.as(…)`). 이 도구 하나가 미션·
//    방·키·접힌 검사를 다 재는데, 이름이 하나뿐이면 「**표** 「HAND_MAX」 를
//    못 읽었습니다」 같은 **틀린 말**이 나간다.
//  ★ 그리고 이름을 **「… 표」로 끝나게** 골랐다 — 공용 손잡이의 말투가
//    `${이름} 가 0 개입니다` 라서, 받침으로 끝나는 이름(미션·방·키)을 그대로
//    넣으면 「미션 가」처럼 **조사가 어긋난다.** 손잡이는 스무 개 도구가
//    같이 쓰는 것이라 **고치지 않고 이름 쪽을 맞췄다**
// ══════════════════════════════════════════════════════════════════════════
const must = measuring({
  tool: 'space-fit',
  what: '표',
  weak: '이 검사의 판정은 거의 다 **「없어야 한다」** 꼴입니다\n'
    + '(없는 방을 안 가리킨다 · 아무도 안 쓰는 표가 없다 ·\n'
    + ' 뒤집힌 낱말이 안 남았다 · 안 물러나는 검사가 없다).\n'
    + '그래서 **훑을 목록이 비면 그것들이 다 저절로 참**이 됩니다.\n'
    + '특히 [6] 은 `FOLDED_CHECKS` 가 비면 `every()` 가 참이라\n'
    + '`=== !PILOT.canStand` 까지 맞아떨어져, **접힌 검사가 하나도**\n'
    + '**없는데 「아홉을 다 여닫는다」**가 초록으로 뜹니다.',
  look: '`game/mission-table.js` MISSIONS · `game/rooms-table.js` ROOMS'
    + ' · `game/pilot-table.js` FOLDED_CHECKS · `game/keys-table.js` KEYS'
    + ' · `web/space/js/game/*-table.js` 파일 목록',
});

console.log(`장르에 안 맞는 설정이 남아 있나 — **${GENRE}** (뼈대만)`);

// ══ ★★★ v151 — 몸통을 통째로 감싼다 ════════════════════════════════════
//  ★ 「못 쟀다」는 **예외로 날아온다** (`unmeasured.js`). 절마다 따로
//    받으면 첫 절이 멈춘 뒤에도 남은 절들이 계속 돌아 **초록 ✔ 를 줄줄이**
//    찍는다 — 사람은 그 화면을 보고 「대체로 괜찮구나」로 읽는다.
//  ★★ 그래서 한 번에 받고, **합격/불합격 줄을 찍기 전에** `bail()` 한다.
//    딴 오류는 **다시 던진다** — 여기서 삼키면 진짜 고장이 「측정 불가」로
//    위장된다 (`space-screen.js` 와 같은 규약)
try {
  console.log('\n[1] ★★★ **조종석에서 못 하는 것이 있나** — 앉아서 시작해 안 일어난다');
  {
    console.log(`   \`PILOT.canStand\` = ${PILOT.canStand} · \`seatOnly\` = ${PILOT.seatOnly}`);
    // ★★★ v151 — **재기 전에 잴 것이 있나부터.** 아래 첫 판정이
    //   「걸어가는 것이 **없다**」 꼴이라, 미션 표가 비면 `some()` 이
    //   저절로 거짓이 되어 **아무것도 안 재고 통과**한다
    must.as('미션 표').some(MISSIONS, '[1] 조종석 밖으로 걸어가는 것을 세려는데');
    // ★ `canStand` 는 **false 가 정상**이다 — 그래서 `value()` 로 묻는다
    //   (`value` 는 0·false 를 「있는 것」으로 친다). 이 칸이 없어지면
    //   `!PILOT.canStand` 가 참이 되어 [6] 의 마지막 줄이 조용히 어긋난다
    must.as('값').value(PILOT.canStand, 'PILOT.canStand', '[1] 앉은 배인가를 물으려는데');
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
    // ★★★ v151 — 판정이 「없는 방을 가리키는 항목이 **없다**」 꼴이다.
    //   방이 없어도 · 미션이 없어도 **둘 다 초록**이 된다 — 앞의 것은
    //   「배에 방이 하나도 없다」는 뜻인데도
    must.as('방 표').some(ROOMS, '[2] 배의 방을 세려는데');
    must.as('미션 표').some(MISSIONS, '[2] 없는 방을 가리키는 항목을 세려는데');
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
    // ★★★ v151 — 판정이 「아무도 안 쓰는 표가 **없다**」 꼴이다.
    //   표 파일을 한 장도 못 읽으면 `orphan` 이 빈 목록이 되어 **초록**이다 —
    //   `game/` 이 통째로 사라져도 이 절은 안 운다
    must.some(files, '[3] `game/*-table.js` 를 세려는데');
    must.as('기둥 표').some(PILLARS, '[3] 기둥에 닿는 표를 따라가려는데');
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
    // ★ 소스를 한 장도 못 읽으면 **모든 표가 「아무도 안 쓴다」**로 찍혀
    //   빨개진다 — 거짓 초록은 아니지만 **엉뚱한 빨강**이고, 그건 v124 가
    //   말한 「낡은 빨강이 새 빨강을 덮는다」와 같은 해를 끼친다
    const srcs = must.as('소스').some(walk(SRC), '[3] `web/space/js/` 를 훑으려는데');
    const bodies = srcs.join('\n');
    /**
     * ★★ **도구만 읽는 표**는 예외다 — 그게 그 표의 일이다.
     *   `genre-table.js` 는 장르를, `story-table.js` 는 이야기를 담고,
     *   둘 다 **검사가 게임을 견주는 자**다 (게임이 읽으면 오히려 이상하다)
     */
    const BY_TOOLS = ['genre-table.js', 'story-table.js'];
    // ══ ★★★ v135 — **일부러 접은 표는 비켜 간다** ═════════════════════════
    //  ★ 표시를 **접힌 파일 자신**이 들게 했다 (`export const FOLDED`). 목록을
    //    다른 곳에 두면 목록과 파일이 갈라진다 — 「접힌 검사 아홉」이
    //    `FOLDED_CHECKS` 와 파일을 **대조**해야 했던 까닭이 그것이다.
    //  ★★ 그래도 이 절은 안 죽는다: **잊고 안 물린 표**는 표시가 없으므로
    //    여전히 빨개진다. 접은 것과 빠뜨린 것을 가르는 것이 이 한 줄이다
    const folded = files.filter((f) => /export const FOLDED\b/.test(read(f)));
    if (folded.length) console.log(`   일부러 접은 표 — ${folded.join(' · ')}`);
    const orphan = files.filter((f) => !BY_TOOLS.includes(f) && !folded.includes(f)
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
    // ★★★ v151 — 판정이 「뒤집힌 낱말이 **안 남아 있다**」 꼴이다.
    //   훑을 표가 없어도 · 찾을 낱말이 없어도 `hits` 는 비고, 그러면
    //   **아무 줄도 안 읽고** 「낡은 말이 없다」가 뜬다
    must.some(files, '[4] 뒤집힌 낱말을 훑으려는데');
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
    // ★★★ v151 — 「손이 **둘 이하**다」·「잡는 것이 **셋 이하**다」는
    //   둘 다 위쪽만 막는 판정이라 **키가 하나도 없으면 0 짝으로 통과**한다.
    //   조작이 통째로 사라진 배가 「손이 안 넘친다」로 초록이 되는 셈이다
    must.as('키 표').some(Object.keys(KEYS), '[5] 맡은 키를 세려는데');
    must.as('값').value(HAND_MAX, 'HAND_MAX', '[5] 한 번에 잡는 수를 재려는데');
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
    // ══ ★★★ v151 — **여기가 이 도구에서 제일 위험한 자리였다** ═══════════
    //
    //  네 판정이 다 목록에 기대는데 셋은 「**없다**」 꼴(`!missing.length` ·
    //  `!ungated.length`)이고 하나는 `every()` 다. `FOLDED_CHECKS` 가 비면
    //  `every()` 가 참이 되고 `!PILOT.canStand` 도 참이라 **마지막 줄까지
    //  맞아떨어져서**, 접힌 검사가 하나도 없는데
    //  「**canStand 하나가 아홉을 다 여닫는다**」가 초록으로 뜬다.
    //  ★ 이 절이 지키려던 것은 「목록과 파일이 갈라지지 않는가」인데,
    //    **목록이 통째로 없어지는 것**만은 못 잡고 있었다
    must.as('접힌 검사 표').some(FOLDED_CHECKS, '[6] 목록과 파일을 대조하려는데');
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
} catch (e) { if (!must.caught(e)) throw e; }

//  ★ 담긴 것이 있으면 여기서 **2**(못 쟀다)로 끝난다 — 0 으로 끝내면
//    자동으로 돌릴 때 **「합격」으로 읽힌다**
must.bail();

console.log('\n[7] ★★★ **검사가 좌표로 단추를 누르나** (v155 · 사장님 「지금 봐」)');
{
  // ══ ★★★ **검사가 조용히 죽는 길** ═══════════════════════════════════
  //
  //  ★★★ `space-audio` 가 「포인터 잠금 + 소리 깨우기」로 `mouse.click(400,
  //    300)` 을 했다. 뷰포트가 800×600 이라 **화면 정중앙**인데, 시작
  //    화면 정중앙에 **「처음부터 다시」(`#btn-new`)** 가 있다. 누르면
  //    게임이 리셋되고 **실행 문맥이 사라진다** — 그래서 그 도구는
  //    `[4-2]`·`[5]` 에 **한 번도 못 닿은 채** 매번 터지고 있었다.
  //
  //  ★★ 단추가 원래 거기 있던 게 아니다. 시작 화면에 「처음부터 다시」와
  //    점검 모드를 **단추로도** 넣으면서 그 자리에 들어왔고, 그날부터
  //    죽었다. **좌표는 화면이 바뀌면 딴 것을 가리킨다.**
  //
  //  ★ `space-check` 도 같은 자리에서 이미 한 번 뎄다 (「여기가
  //    `mouse.click(640, 400)` 네 군데였다」는 주석이 남아 있다).
  //    **두 번 밟았으면 세는 것이 맞다.**
  //
  //  ★★ 다만 **`#btn-play` 를 이름으로 누르고 실패할 때만** 좌표로
  //    떨어지는 꼴(`.catch(() => p.mouse.click(...))`)은 센다고 얻을 것이
  //    없다 — 이름이 살아 있는 한 안 돌고, 이름이 죽으면 그때는 좌표라도
  //    눌러 보는 편이 낫다. **맨 좌표만** 센다
  //  ★ `read` 는 게임 표를 읽는 손잡이다 (`DIR` 기준). 여기는 **도구**를 읽으므로
  //    따로 연다 — 남의 손잡이를 억지로 쓰면 그게 다음 사람을 헷갈리게 한다
  const TOOLS = new URL('.', import.meta.url);
  const bare = [];
  for (const f of readdirSync(TOOLS).filter((n) => n.endsWith('.js'))) {
    const src = readFileSync(new URL(f, TOOLS), 'utf8');
    src.split('\n').forEach((line, i) => {
      //  ★ 주석은 뺀다 — 「예전에 이랬다」는 **기록**이다 (v152·v154 에 두 번 밟았다)
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      //  ★ `.catch(() => p.mouse.click(…))` 은 이름을 먼저 부른 것이므로 뺀다
      if (/catch\(\(\)\s*=>\s*p?\.?mouse\.click/.test(line)) return;
      //  ★ 자리에서 뽑아낸 좌표(`at.x`)도 뺀다 — 그건 이름으로 찾은 것이다
      if (/mouse\.click\(\s*[0-9]+\s*,\s*[0-9]+\s*\)/.test(line)) bare.push(`${f}:${i + 1}`);
    });
  }
  console.log(`   맨 좌표로 누르는 곳 ${bare.length} — ${bare.join(' · ') || '없음'}`);
  ok(bare.length === 0,
    `★★★ **맨 좌표로 누르는 곳이 ${bare.length} 군데다** — 화면이 바뀌면 조용히 딴 것을`
    + ' 누른다. `space-audio` 가 「처음부터 다시」를 눌러 **매번 터지고 있었고**,'
    + ' 터지는 자리 뒤의 절들은 **한 번도 안 돌았다.** 이름(`#view`·`#btn-play`)으로'
    + ' 누르면 화면을 다시 꾸며도 안 깨진다');
  ok(!bare.some((x) => x.startsWith('space-audio')),
    '★★ **`space-audio` 는 이름으로 누른다** — 여기가 그 함정을 처음 밟은 자리다');
}

console.log('\n[8] ★★★ **검사용 빨리감기가 게임으로 새나** (v156)');
{
  //  ★★★ `SPACE.fast(k)` 는 **검사를 돌게 하려고** 낸 구멍이다.
  //    `space-check`·`space-endtoend` 가 900초를 줘도 못 끝냈는데, 코드가
  //    틀린 게 아니라 헤드리스가 1~2fps 라 게임 시간이 25~60배로 느리게
  //    흘렀기 때문이다 — 즉 그 둘은 **사실상 안 도는 검사**였다.
  //
  //  ★★ 이런 구멍은 **반드시 새는 날이 온다.** 「빠르게 하면 편하네」로
  //    키에 물리거나 점검 모드에 얹히거나 저장에 실려 나간다. 그러면
  //    사람이 하는 판이 조용히 달라지고, 그건 아무도 안 눈치챈다.
  const m = readFileSync(new URL('../web/space/js/main.js', import.meta.url), 'utf8');
  const code = m.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  ok(/let fastK = 1;/.test(code),
    '★★★ **기본이 1 이다** — 1 이면 지금까지와 한 글자도 다르지 않다');
  ok((code.match(/fastK/g) ?? []).length <= 5,
    `★★ **손대는 곳이 ${(code.match(/fastK/g) ?? []).length} 군데뿐이다** — 계통마다 「지금 빠른가」를`
    + ' 묻게 하면 반드시 하나를 빠뜨리고, 빠뜨린 그 하나만 제 속도로 돌아 화면이 어긋난다');
  ok(!/KEYS[^\n]*fast|fast[^\n]*KeyF|addEventListener[^\n]*fast/.test(code),
    '★★★ **키에 안 물렸다** — 사람이 누를 길이 있으면 그건 검사 구멍이 아니라 게임 손잡이다');
  ok(!/save[^\n]*fastK|fastK[^\n]*save/i.test(code),
    '★★ **저장에 안 실린다** — 실리면 한 번 켠 것이 다음 판까지 따라간다');
  //  ══ ★★★ **아직 아무 검사도 이걸 안 쓴다** — 그것도 적어 둔다 ══════════
  //
  //  ★ 만든 까닭은 `space-check`·`space-endtoend` 를 돌게 하려는 것이었는데,
  //    8 배로 물려 보니 **850초에도 여전히 못 끝냈고**(더 멀리는 갔다 —
  //    e2e 가 27 ✔ 까지) 게다가 **새 빨강이 둘 났다**: 「조종간을 밀면
  //    기수가 돈다」가 0 도였다. 한 프레임에 0.4초가 흐르면 **마우스 쌓임과
  //    기수 도는 셈이 어긋난다** — 즉 빨리감기가 조종을 깨뜨린다.
  //
  //  ★★ 그래서 **구멍만 남기고 배선은 되돌렸다.** 검증 못 한 채로 검사를
  //    바꿔 두면 그 검사가 하는 말을 아무도 못 믿는다 — 오늘 고친 병들이
  //    다 그 모양이었다. 다음 판은 **큰 dt 에서 조종이 안 깨지게** 하는
  //    것부터다 (마우스 쌓임을 dt 로 나누거나, 프레임을 잘게 쪼개거나).
  //  ★ 점검 모드에도 안 넣는다 — 사장님이 쓰시는 곳이라 거기 있으면 게임 손잡이다
  ok(!/(check|점검)[^\n]{0,40}fast\(/i.test(code),
    '★ **점검 모드에도 없다** — 거기 있으면 「게임을 빠르게 하는 손잡이」가 된다');
}

console.log(bad ? `\n✘ ${bad} 군데 — **장르와 어긋난 자리가 있습니다**`
  : `\n✔ 지금 있는 설정이 다 ${GENRE} 안에 있습니다`);
console.log(`
  ※ **「재미있나」는 여기서 안 나온다.** 여기서 나오는 것은
     「지금 장르에서 **닿을 수 있나**」뿐이다.`);
process.exit(bad ? 1 : 0);
