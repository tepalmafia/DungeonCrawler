// ══════════════════════════════════════════════════════════════════════════
//  손목 장치 — **할 일이 늘 하나 나오나. 그리고 배의 상태가 안 새나.**
//
//    node tools/space-wrist.js
//
//  ★ 여기서 제일 중요한 줄은 「안 새나」다
//    이 게임의 중심은 **동시에 두 곳에 못 있는다**이다 (GAP.md §3-C).
//    손목에 거리·자국·열 수치·항로·마모가 하나라도 뜨면 조종석 화면 다섯 ·
//    해도대 · 진단대가 그날로 장식이 되고, **방 일곱을 도는 이유가 사라진다.**
//    그런데 이건 편하려고 한 줄 보태고 싶어지는 자리라 **도구가 지킨다** —
//    문서에 적어 둔 규칙은 도구가 묻지 않으면 그냥 소원이다 (PLAN §13-4).
//
//  ★ 여기서 안 나오는 것
//    **읽히나 · 보이나.** 몸체가 방 색을 먹고 명패처럼 보이는 것도, 들어
//    올렸을 때 계기를 가리는 것도 여기서는 안 보인다 — 실제로 둘 다 났고
//    **화면을 찍어서** 알았다 (POSTMORTEM 3번). tools/space-chase.js 가
//    브라우저에서 「손목이 화면에 있나 · Q 로 올라오나」를 본다.
// ══════════════════════════════════════════════════════════════════════════
import { WRIST, JOBS, jobFor } from '../web/space/js/game/wrist-table.js';
import { MISSIONS } from '../web/space/js/game/mission-table.js';
// ★★★ v150 — 「잴 것이 없으면 멈춘다」는 **한 곳에** 있다 (`folded.js` 옆)
import { measuring } from './unmeasured.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ v150 — **잴 것이 없으면 통과가 아니라 「측정 불가」다**
//
//  ★ 이 검사도 `space-screen.js` 와 **같은 병**이 있었다. 여기 판정은
//    거의 다 **「없어야 한다」 꼴**이다:
//
//        ok(bad.length === 0,   '전부 동사다')        ← [2b]
//        ok(leak.length === 0,  '숫자가 안 샌다')     ← [4]
//        ok(where.length === 0, '방을 안 말한다')     ← [4]
//        ok(reveals.every(…),   '전부 22자 안이다')   ← [5]
//
//    이 넷은 **`JOBS` 를 비우고 `MISSIONS` 를 비우면 전부 저절로 참**이다.
//    할 일이 하나도 없는 손목이 「숫자가 안 샌다 · 방을 안 말한다 ·
//    전부 동사다」로 **통째로 초록**이 된다 — 안 새는 게 아니라 **말 자체가
//    없는 것**인데. 실제로 재 봤다: `JOBS = []` 로 두고 [2b]·[3]·[4] 만
//    돌리니 **여섯 줄이 다 ✔ 이고 종료 코드가 0** 이었다.
//
//  ★★ **그런데 그걸 처음엔 못 봤다** — `JOBS` 를 비우면 [1] 의 `jobFor` 가
//    `undefined.key` 로 먼저 터져서 종료 코드가 1 로 나왔다. 「빨간불이니
//    잡히는구나」로 넘어갈 뻔했는데, 그 빨강은 **터진 것**이지 잰 것이
//    아니다. 절 하나를 걷어 내고 다시 재서야 뒤의 여섯이 초록인 것이
//    보였다 — **앞 절이 터져서 가려 주는 초록은 언제든 되살아난다**
//    (계통 하나를 빼면 [1] 은 멀쩡히 돌고 뒤만 조용히 초록이 된다).
//
//  ★★ 그리고 **값 쪽이 더 조용하다.** `WRIST.maxLen` 이 사라지면
//    `t.length > undefined` 가 언제나 거짓이라 [1] 의 「22자를 안 넘는다」가
//    **넘치는 줄이 있어도** 초록이 된다. 목록이 빈 것은 그래도 눈에 띄는데
//    이건 **아무 표시도 안 난다** — 그래서 값도 같이 묻는다.
//
//  ★ 「어떻게 멈추나」는 이 파일에 안 적는다 (`unmeasured.js` 가 갖는다).
//    도구마다 적기 시작하면 어느 날 한 도구가 `exit(0)` 으로 적어 놓고
//    조용히 죽는다 — `folded.js` 가 접힌 목록을 한 곳에 모은 것과 같은 까닭.
// ══════════════════════════════════════════════════════════════════════════
const must = measuring({
  tool: 'space-wrist',
  what: '할 일',
  weak: '이 검사의 판정은 거의 다 **「없어야 한다」** 꼴입니다\n'
    + '(명사로 끝난 것이 없나 · 숫자가 샌 줄이 없나 · 방을 말한 줄이 없나).\n'
    + '그래서 **손목이 할 말을 다 잃으면 그 넷이 저절로 참**이 됩니다 —\n'
    + '`JOBS` 를 비우고 재 보니 [2b]·[3]·[4] 의 **여섯 줄이 전부 ✔** 였습니다.\n'
    + '값도 같습니다: `WRIST.maxLen` 을 없애니 26자짜리가 셋이나 있는데도\n'
    + '「한 줄이 undefined자를 안 넘는다 — 넘친 것 0가지」로 **초록**이었습니다\n'
    + '(`length > undefined` 는 언제나 거짓이라 세는 통이 안 찹니다).',
  look: '`game/wrist-table.js` 의 `JOBS`·`WRIST` · `game/mission-table.js` 의 `MISSIONS`',
});

/** 아무 일도 없는 평온한 배 */
const calm = () => ({
  doorJammed: false, chasing: false, heatHigh: false, hazardSoon: false,
  faultsOpen: 0, foodLow: false, atPort: false, thrust: true, ore: 0,
});

console.log('\n══ 손목 장치 ══');

//  ★ 「못 쟀다」는 **던져서** 여기까지 나른다. 판정 한가운데서 바로
//    `process.exit` 를 부르면 나머지 절이 안 돌아 무엇이 더 비었는지
//    모르게 되고, 브라우저를 쓰는 도구와 모양이 갈라진다
try {
  console.log('\n[1] **늘 한 줄이 나온다** — 「할 일 없음」으로 비면 그건 고장난 게임이다');
  {
    //  ★★★ v150 — **재기 전에 잴 것이 있나부터.** 아래 두 판정은
    //    `JOBS` 가 비면 `jobFor` 가 `undefined` 를 만지다 터지고(그건 그나마
    //    낫다), `WRIST.maxLen` 이 비면 **아무 소리 없이 초록**이 된다
    must.some(JOBS, '어떤 상태에서도 한 줄이 나오나를 재려는데');
    must.as('값').value(WRIST.maxLen, 'maxLen', '한 줄 길이를 재려는데');

    // 켤 수 있는 조건을 전부 껐다 켰다 하며 쓸어 본다 (2^8 = 256 가지)
    // ★★ **v62 에 두 칸을 빠뜨렸다가 화면에서 들켰다.** `dry`·`inVacuum` 을
    //   여기 안 넣으니 새 줄 둘이 25·26자인데 **초록이었다** — 쓸어 보는
    //   목록에 없으면 아무리 쓸어도 안 나온다. 계통을 하나 만들면
    //   **여기에도 한 칸을 보탠다**
    const FLAGS = ['doorJammed', 'chasing', 'heatHigh', 'hazardSoon', 'foodLow', 'atPort', 'dry', 'inVacuum'];
    let empty = 0, tooLong = 0, worst = '';
    for (let m = 0; m < (1 << FLAGS.length); m++) {
      for (const faultsOpen of [0, 1, 3]) for (const thrust of [true, false]) {
        const s = { ...calm(), faultsOpen, thrust, suited: false };
        FLAGS.forEach((f, i) => { s[f] = !!(m & (1 << i)); });
        const j = jobFor(s);
        if (!j?.text) empty++;
        if (j.text.length > WRIST.maxLen) { tooLong++; if (j.text.length > worst.length) worst = j.text; }
      }
    }
    ok(empty === 0, `어떤 상태에서도 할 일이 하나 나온다 — 빈 화면 ${empty}가지`);
    ok(tooLong === 0, `한 줄이 ${WRIST.maxLen}자를 안 넘는다 — 넘친 것 ${tooLong}가지 ${worst && `(「${worst}」)`}`);
  }

  console.log('\n[2] **급한 것이 위로 온다** — 문에 갇힌 채로 「지금은 조용합니다」가 뜨면 안 된다');
  {
    // 전부 동시에 터진 상태. 위에서부터 하나씩 꺼 보면 순서가 그대로 나와야 한다
    const s = {
      doorJammed: true, chasing: true, heatHigh: true, hazardSoon: true,
      faultsOpen: 2, foodLow: true, atPort: true, thrust: false, ore: 0,
    };
    const want = ['jam', 'chase', 'hot', 'hazard', 'fault', 'hungry', 'route', 'thrust', 'calm'];
    //  ★★★ v150 — **아홉이 다 있나부터 묻는다.** 하나가 빠지면 아래
    //    판정은 「순서가 틀렸다」로 빨개지는데, 그건 **틀린 진단**이다 —
    //    순서가 어긋난 게 아니라 **잴 것이 없어진 것**이고, 그때 필요한
    //    답은 불합격이 아니라 「못 쟀다」다
    const byKey = Object.fromEntries(JOBS.map((j) => [j.key, j]));
    must.all(byKey, want, '급한 순서를 재려는데');
    const got = [];
    const off = { jam: 'doorJammed', chase: 'chasing', hot: 'heatHigh', hazard: 'hazardSoon' };
    for (let i = 0; i < want.length; i++) {
      const k = jobFor(s).key;
      got.push(k);
      if (off[k]) s[off[k]] = false;
      else if (k === 'fault') s.faultsOpen = 0;
      else if (k === 'hungry') s.foodLow = false;
      else if (k === 'route') s.atPort = false;
      else if (k === 'thrust') s.thrust = true;
      else break;
    }
    console.log(`  ${got.join(' → ')}`);
    ok(got.join() === want.join(), '급한 순서대로 하나씩 내려온다');
    ok(jobFor(calm()).key === 'calm', '아무 일 없으면 마지막 줄로 떨어진다');
  }

  console.log('\n[2b] ★★ **전부 동사인가** — 「열이 높습니다」는 할 일이 아니다');
  {
    // ★ 사장님이 화면을 보시고 「뭘 하라는거야?」라고 하셨다. 그때 손목이
    //   「열이 높습니다」였다 — **상태**다. 이 장치의 존재 이유가 「지금 뭘
    //   하나」인데 아홉 줄 중 **다섯이 명사**였다 (jam·hot·fault·hungry·thrust).
    //   추격만 고치고 나머지를 안 고친 것이다.
    //
    //   말투로 가른다: 손이 할 수 있는 동작으로 끝나야 한다. 새 줄을 보탤 때
    //   여기 없는 어미를 쓰면 ✘ 가 뜨고, 그때 **동사인지 다시 생각하게 된다.**
    const ACTS = [
      '켭니다', '끕니다', '내립니다', '올립니다', '고릅니다', '엽니다', '닫습니다',
      '찾습니다', '끌어옵니다', '버팁니다', '비킵니다', '갑니다', '둡니다',
      '돌립니다', '캡니다', '바꿉니다',
      // v62 — 우주복
      '입습니다', '채웁니다',
    ];
    const S = {
      doorJammed: true, chasing: true, heatHigh: true, hazardSoon: true,
      faultsOpen: 2, foodLow: true, atPort: true, thrust: false, cool: false,
      heat: 70, ore: 0,
      // v62 — 진공에 우주복 없이 · 추진제 바닥
      inVacuum: true, suited: false, dry: true,
    };
    //  ★★★ v150 — **`JOBS` 가 비면 이 절이 통째로 거짓말을 한다.**
    //    아래 `bad` 는 돌지 않은 반복문의 빈 배열이라 `length === 0` 이고,
    //    「아홉 줄이 전부 손이 할 동작으로 끝난다」가 **아홉 줄이 없는 채로**
    //    ✔ 가 된다. 여기가 이 도구에서 제일 조용한 자리다
    must.some(JOBS, '말투를 재려는데');
    const bad = [];
    for (const j of JOBS) {
      const t = typeof j.say === 'function' ? j.say(S) : j.say;
      const okAct = ACTS.some((a) => t.endsWith(a));
      console.log(`  ${okAct ? '·' : '✘'} ${j.key.padEnd(7)}「${t}」`);
      if (!okAct) bad.push(j.key);
    }
    ok(bad.length === 0, `아홉 줄이 전부 **손이 할 동작**으로 끝난다 — 명사로 끝난 것 ${bad.join(', ') || '없다'}`);

    // 갈래가 있는 줄(추격)도 전부 검사한다 — 하나만 명사여도 그 순간 못 읽는다
    //  ★ v150 — `find` 가 `undefined` 를 주면 다음 줄이 `TypeError` 로 터진다.
    //    터지는 것 자체는 초록보다 낫지만, **왜 못 쟀는지**는 안 나온다
    const chase = must.has(Object.fromEntries(JOBS.map((j) => [j.key, j])), 'chase', '추격 갈래를 재려는데');
    // ★ v62 — `dry` 를 **꺼 놓고** 네 갈래를 본다. 켜 놓으면 추진제 갈래가
    //   넷을 다 덮어서 「넷 다 같은 말」이 되고, 그건 갈래를 안 재는 것이다.
    //   추진제 갈래는 다섯째로 따로 묻는다
    const D = { ...S, dry: false };
    const each = [
      { ...D, thrust: false }, { ...D, thrust: true, cool: false },
      { ...D, thrust: true, cool: true, heat: 90 }, { ...D, thrust: true, cool: true, heat: 5 },
    ].map((x) => chase.say(x));
    //  ★ `each` 는 넷을 손으로 지어 넣으니 빌 일이 없지만, `ACTS` 가 비면
    //    `some` 이 늘 거짓이라 **빨개진다** — 초록으로 새지는 않는다
    ok(each.every((t) => ACTS.some((a) => t.endsWith(a))),
      `추격 갈래 넷도 전부 동사다 — ${each.map((t) => t.split(' · ')[1]).join(' / ')}`);
    // ★★ v62 — **추진제가 없으면 「추진을 켭니다」가 거짓말이다.**
    //   손목이 못 하는 일을 시키는 순간 이 장치를 안 믿게 된다
    const dryLine = chase.say({ ...S, dry: true, thrust: false });
    ok(!/추진을 켭니다/.test(dryLine),
      `★ 추진제가 없을 때 「추진을 켭니다」라고 **안 한다** — 「${dryLine}」`);
  }

  console.log('\n[3] **급한 것에만 빨간 불** — 전부 급하면 아무것도 안 급하다');
  {
    const urgent = JOBS.filter((j) => j.urgent).map((j) => j.key);
    console.log(`  급함: ${urgent.join(', ')}`);
    //  ★★★ v150 — **빨간 불이 하나도 없어도 이 절은 초록이다.**
    //    `urgent.length <= 4` 는 0 일 때 제일 잘 맞고, `includes` 두 개도
    //    빈 배열에서는 다 거짓이다. 그런데 급한 줄이 없는 손목은
    //    「급한 것에만 빨간 불」을 지킨 것이 아니라 **불이 나간 것**이다
    //    (진공·추격·열·잔해 넷이 급해야 한다)
    must.as('급한 줄').some(urgent, '빨간 불을 세려는데');
    ok(urgent.length <= 4, `급한 줄이 ${urgent.length}개 — 넷 이하 (전부 급하면 눈이 무뎌진다)`);
    ok(!urgent.includes('calm') && !urgent.includes('fault'),
      '고장·평온은 안 급하다 — 고장은 **천천히 찾아가는 것**이 이 게임이다 (PLAN §3-1)');
  }

  console.log('\n[4] ★★ **배의 상태가 안 샌다** — 여기가 이 도구의 이유다');
  {
    // 방이 가진 것을 손목이 알면 안 된다. 그런데 `jobFor` 에 넘기는 상태에는
    // 숫자가 들어 있으므로, **말로 나오는지**를 본다
    const s = {
      ...calm(), chasing: true, heatHigh: true, faultsOpen: 3, atPort: true,
      // 아래 넷은 **손목이 절대 몰라야 하는 것**이다. 일부러 섞어 넣는다
      dist: 812, sign: 74, heat: 61, wear: 0.63, leg: 3, food: 22,
    };
    const said = [];
    for (const j of JOBS) said.push(typeof j.say === 'function' ? j.say(s) : j.say);
    //  ★★★ v150 — **여기가 이 도구의 이유인데, 말이 없으면 저절로 참이다.**
    //    「숫자가 안 샌다 · 거리를 말하지 않는다 · 방을 안 말한다」 셋은
    //    전부 `said` 를 걸러 낸 것이 비었나를 묻는다. `said` 가 비면
    //    셋이 다 ✔ 다 — **한 마디도 안 하는 손목이 제일 안 새는 손목**이
    //    되는 셈이라, 그건 재나 마나다
    must.as('말한 줄').some(said, '무엇을 말하는지 보려는데');
    // 「고장 3군데」의 3 은 **몇 개인지**라 허용한다 — 그건 방이 가진 값이 아니다
    const leak = said.filter((t) => /\d/.test(t) && !/^고장 \d+군데( ·.*)?$/.test(t));
    console.log(said.map((t) => `  · ${t}`).join('\n'));
    ok(leak.length === 0, `숫자가 안 샌다 — 샌 줄 ${leak.join(' / ') || '없다'}`);
    ok(!said.some((t) => /m\b|미터|㎞|거리|자국|마모|℃|도씨/.test(t)),
      '거리·자국·마모를 말하지 않는다 — 그건 조종석·관측실·정비실이 갖는다');

    // 어디로 가라고도 안 한다. 「전방에 잔해 — 조종석으로」 하나만 예외인데,
    // 그건 **방이 아니라 조종간**을 가리키는 것이고 시간이 없어서 봐준다
    const ROOMS = ['관측실', '정비실', '온실', '에어록', '기관실', '통로'];
    const where = said.filter((t) => ROOMS.some((r) => t.includes(r)));
    ok(where.length === 0,
      `어느 방인지 안 말한다 — 말한 줄 ${where.join(' / ') || '없다'} (귀가 찾는다 · PLAN §3-1)`);
  }

  console.log('\n[5] 고친 기록 — **최신이 위로** 오고, 화면 밖으로 안 넘친다');
  {
    //  ★★★ v150 — 이 절의 숫자 셋이 표에서 온다. 하나라도 없으면
    //    `slice(0, undefined)` 가 **통째로** 잘라 오고 `> undefined` 는 늘
    //    거짓이라, 「넘치나」를 못 재면서도 줄 하나는 ✔ 로 지나간다
    must.as('값').all(WRIST, ['logShow', 'logMax', 'maxLen'], '기록 칸을 재려는데');

    // fault.js 는 `log.unshift` 로 쌓는다 — **최신이 배열 앞**이다.
    // world/holo.js 를 `slice(-n).reverse()` 로 짰다가 여섯이 찬 뒤부터
    // **제일 오래된 넷**을 보여줬다. 방금 고친 게 안 뜨면 그건 기록이 아니다
    const rows = (log) => log.slice(0, WRIST.logShow);
    const log = [];
    for (let i = 1; i <= 9; i++) {
      log.unshift(`고침 ${i}`);
      if (log.length > WRIST.logMax) log.pop();
    }
    console.log(`  ${rows(log).join(' / ')}`);
    ok(rows(log)[0] === '고침 9', '방금 고친 것이 맨 위에 온다');
    ok(rows(log).length === WRIST.logShow, `한 번에 ${WRIST.logShow}줄까지만 보인다`);
    ok(log.length === WRIST.logMax, `기록은 ${WRIST.logMax}개에서 잘린다 — 무한히 안 쌓인다`);

    // ★ 지어낸 문장이 아니라 **게임에 실제로 들어 있는 문장 45개**로 잰다.
    //   미션을 보탤 때마다 여기가 자동으로 같이 늘어난다 — 새 문장이 길면
    //   손목이 잘라서 「…」로 끝나므로, 몇 개가 잘리는지 눈으로 보고 결정한다
    const cut = (t) => (t.length > WRIST.maxLen ? `${t.slice(0, WRIST.maxLen - 1)}…` : t);
    //  ★★★ v150 — **미션이 비면 잴 문장이 없다.** `[].every(…)` 는 참이고
    //    `0 <= 0 * 0.25` 도 참이라 두 줄이 다 ✔ 가 된다. 게다가
    //    `Math.max(...[])` 는 `-Infinity` 라 화면에 「제일 긴 것 -Infinity자」가
    //    찍히는데, **그 이상한 숫자 옆에 초록불이 나란히** 선다
    must.as('미션').some(MISSIONS, '기록에 넣을 문장을 모으려는데');
    const reveals = MISSIONS.flatMap((m) => (m.branches ?? []).map((b) => b.what));
    must.as('문장').some(reveals, '기록 줄 길이를 재려는데');
    const over = reveals.filter((t) => t.length > WRIST.maxLen);
    console.log(`  게임 안 문장 ${reveals.length}개 · 제일 긴 것 ${Math.max(...reveals.map((t) => t.length))}자`);
    ok(reveals.every((t) => cut(t).length <= WRIST.maxLen), `전부 ${WRIST.maxLen}자 안에 들어간다`);
    ok(over.length <= reveals.length * 0.25,
      `잘리는 문장이 ${over.length}/${reveals.length} — 넷에 하나 아래 (절반이 「…」면 기록이 아니다)`);
    if (over.length) console.log(over.map((t) => `    … ${cut(t)}`).join('\n'));
  }
} catch (e) {
  //  ★★★ 우리 것이면 담고, **딴 오류는 다시 던진다.** 여기서 다 삼키면
  //    진짜 고장이 「측정 불가」로 위장되고, 그게 이 일에서 제일 나쁜 결과다
  if (!must.caught(e)) throw e;
}

//  ★ 담긴 것이 있으면 여기서 **2**(못 쟀다)로 끝난다 —
//    합격/불합격 줄을 찍기 **전**이라야 한다. 0 으로 끝내면 나중에 자동으로
//    돌릴 때 종료 코드만 보고 **「합격」으로 읽는다**
must.bail();

console.log('\n  ※ **보이나는 여기서 안 나온다.** 몸체가 방 색을 먹고 명패처럼 보이는');
console.log('     것도, 들어 올렸을 때 계기를 가리는 것도 둘 다 실제로 났고');
console.log('     **화면을 찍어서** 알았다. tools/space-chase.js 가 브라우저에서 본다.\n');
process.exit(fail ? 1 : 0);
