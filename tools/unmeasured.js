// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **잴 것이 없으면 통과가 아니라 「측정 불가」다** (v150)
//
//  ★ 사장님 (2026-08-14) 검사 도구를 훑다가 잡으셨다. `space-screen.js` 에
//    **계기 넷을 통째로 없앤 척**하고 돌리니 **「✔ 전투 화면이 비어 있다」**
//    가 나왔다 — 화면에 계기가 하나도 없는데 「화면을 안 가린다」로 합격이다.
//
//  ══ 왜 이런 일이 나나 — **판정의 모양** 때문이다 ══════════════════════
//
//  이 저장소의 검사는 상당수가 **「없어야 한다」 꼴**이다:
//
//      ok(!겹친것.length, '판끼리 안 겹친다')
//      ok(!잘린것.length, '잘린 판이 없다')
//      ok(목록.every(…),  '다 제 구석에 있다')
//
//  ★★★ **빈 목록이면 이 셋이 전부 참이다.** `[].every(…)` 는 자바스크립트에서
//    언제나 참이고, 빈 목록의 `.length` 는 0 이다. 불량품 상자가 비었는데
//    「불량이 없다」고 도장을 찍는 것과 같다 — **생산 라인이 멈춰서 빈 것인데도.**
//
//  전수 조사(2026-08-14)에서 이 모양이 이렇게 나왔다:
//
//      「없어야 한다」 판정이 무보호   46곳 / 20개 도구
//      빈 목록이면 무조건 참(every)   40곳
//      판정식 안에서 기본값(`??`·`?.`) 170곳 / 31개 도구
//
//  ══ ★★ **접힘(`folded.js`)과는 다른 상황**이라 다르게 끝낸다 ══════════
//
//    `folded.js`   「**설계가 바뀌어** 잴 것이 없어졌다」
//                  걷기를 없앴으니 걷기 검사는 **안 재는 것이 맞다.**
//                  그건 정상이므로 **0** 으로 끝난다.
//
//    여기          「**있어야 할 것이 없다**」
//                  계기는 있어야 하는 물건이다. 없으면 설계가 바뀐 것이
//                  아니라 **게임이나 구멍이 고장 난 것**이고, 그때 필요한
//                  답은 합격도 불합격도 아닌 **「못 쟀다」**이다.
//                  → **2** 로 끝낸다 (이 저장소가 「playwright 가 없다」에
//                    이미 쓰는 코드 · 「설비가 없어 못 쟀다」는 뜻).
//
//  ★★★ **0 으로 끝내면 안 된다.** 사람이 돌릴 때는 글이 보이지만, 나중에
//    자동으로 돌릴 때는 **종료 코드만 본다.** 0 이면 「합격」으로 읽힌다.
//
//  ══ ★ 도구는 **제 목록만 넘긴다** ═════════════════════════════════════
//
//    「어떻게 멈추나」를 도구마다 적기 시작하면, 어느 날 한 도구가
//    `exit(0)` 으로 적어 놓고 조용히 죽는다. `folded.js` 가 접힌 목록을
//    한 곳에 모아 둔 것과 **같은 까닭**이다.
//
//      import { measuring } from './unmeasured.js';
//
//      const must = measuring({
//        tool: 'space-screen',
//        what: '계기',
//        weak: '이 검사의 판정은 전부 「없어야 한다」 꼴입니다 …',
//        look: '`main.js` 의 `SPACE.panels()`',
//      });
//
//      const P = must.all(await S(() => SPACE.panels()), Object.keys(PANELS), '1280×760 에서');
//      must.has(C, '스킬줄', '1280×760 에서');
//
//      try { … } catch (e) { if (!must.caught(e)) throw e; } finally { await b.close(); }
//      must.bail();          // 담긴 것이 있으면 여기서 2 로 끝난다
//
//    ★★ `bail()` 을 **브라우저를 닫은 뒤** 부르는 것이 요점이다.
//      `process.exit()` 를 예외 자리에서 바로 부르면 `finally` 가 안 돌아
//      브라우저가 남는다 — 그래서 **던지고 · 담고 · 나중에 끝낸다.**
// ══════════════════════════════════════════════════════════════════════════

/** 못 쟀다 — 브라우저를 닫고 나서 알리려고 예외로 나른다 */
export class Unmeasured extends Error {}

/**
 * ★★★ 이 도구의 「측정 불가」 손잡이를 만든다.
 *
 * @param o.tool 도구 이름 (`space-screen` 처럼 확장자 없이)
 * @param o.what 무엇을 재나 — 사람이 읽는 말 (「계기」 · 「표적」 …)
 * @param o.weak ★ **이 검사가 왜 빈 값에 약한가** 한두 줄.
 *               안 적으면 일반적인 설명이 나간다. 적어 두면 다음 사람이
 *               「그래서 뭘 봐야 하나」를 바로 안다
 * @param o.look 먼저 볼 곳 (파일·함수 이름)
 */
export function measuring({ tool = '', what = '잴 것', weak = '', look = '' } = {}) {
  /** 담긴 까닭 — 담기면 합격/불합격을 안 찍는다 */
  let why = null;

  const throwUp = (msg) => { throw new Unmeasured(msg); };

  /**
   * ★★ 한 도구가 **여러 가지**를 재는 일이 흔하다 (계기 + 딱지 · 표적 + 탄).
   *   그때 이름이 하나뿐이면 「**계기** 「스킬줄」이 없습니다」 같은 **틀린 말**이
   *   나간다 — v150 에 옮기다가 실제로 그렇게 됐고 사장님이 잡으실 뻔했다.
   *   그래서 **이름만 바꾼 짝**을 만들어 쓴다: `must.as('딱지').has(…)`.
   *   담는 자리(`why`)는 **하나를 같이 쓴다** — 어느 쪽이 먼저 걸리든
   *   `bail()` 한 번으로 끝나야 하기 때문이다
   */
  const make = (noun) => ({
    /**
     * ★★★ **이름 목록이 다 있나** — 하나라도 없으면 멈춘다.
     *
     *   ★ 「하나라도」로 잡는 것이 맞다. 하나가 빠질 때마다 위의
     *     「없어야 한다」 판정들이 **그만큼씩 조용히 약해진다** —
     *     「넷 중 셋만 재고 통과」는 통과가 아니다.
     *
     * @param got   이름 → 값 (없는 것은 `null`/`undefined`)
     * @param want  있어야 하는 이름들
     * @param where 어느 대목에서 재려다 못 쟀나
     * @returns got 그대로 (그대로 이어 쓰라고)
     */
    all(got, want, where = '') {
      const have = want.filter((n) => got && got[n]);
      if (have.length === want.length) return got;
      const miss = want.filter((n) => !(got && got[n]));
      throwUp(`${where} — ${noun} ${want.length} 개 중 **${have.length} 개만** 보입니다`
        + `\n     안 보이는 것: ${miss.join(' · ')}`);
      return got;
    },

    /** 이름 하나가 있나 (딱지 하나 · 값 하나) */
    has(got, name, where = '') {
      if (got && got[name]) return got[name];
      throwUp(`${where} — ${noun} 「${name}」 가 없습니다`);
      return null;
    },

    /**
     * ★ **목록이 비어 있지 않나** — `every()` 로 재기 전에 부른다.
     *   `[].every(…)` 는 언제나 참이므로, 이걸 안 부르면 빈 목록이
     *   **모든 조건을 만족한 것**으로 읽힌다
     */
    some(list, where = '', least = 1) {
      const n = Array.isArray(list) ? list.length : Object.keys(list ?? {}).length;
      if (n >= least) return list;
      throwUp(`${where} — ${noun} 가 ${n} 개입니다 (${least} 개 이상이라야 잽니다)`);
      return list;
    },

    /** 값 하나가 있나 (0 과 false 는 **있는 것**으로 친다 — 잰 값일 수 있다) */
    value(v, name, where = '') {
      if (v !== undefined && v !== null) return v;
      throwUp(`${where} — ${noun} 「${name}」 를 못 읽었습니다 (구멍이 없어졌을 수 있습니다)`);
      return v;
    },

    /**
     * 우리 것이면 담고 참을 준다. 아니면 거짓 — 부른 쪽이 다시 던진다.
     *   ★ 딴 오류까지 여기서 삼키면 **진짜 고장이 「측정 불가」로 위장**된다
     */
    caught(e) {
      if (!(e instanceof Unmeasured)) return false;
      why = e.message;
      return true;
    },

    /** 지금 못 잰 상태인가 (도구가 마지막 줄에서 물어볼 수 있게) */
    get stopped() { return why !== null; },

    /**
     * ★★★ 담긴 것이 있으면 **여기서 2 로 끝낸다.**
     *   브라우저를 닫은 **뒤에** 부른다
     */
    bail() {
      if (why === null) return false;
      console.log('\n■ **측정 불가** — 통과도 실패도 아닙니다\n');
      console.log(`   ${why}`);
      console.log('');
      if (weak) {
        for (const line of weak.split('\n')) console.log(`   ★ ${line}`);
        console.log('');
      } else {
        console.log('   ★ 이 검사에는 **「없어야 한다」 꼴의 판정**이 있습니다.');
        console.log('     잴 것이 없으면 그 판정들이 **저절로 참**이 되므로,');
        console.log('     여기서 멈추지 않으면 통째로 초록이 됩니다.');
        console.log('');
      }
      console.log('   ※ 접힌 검사(`tools/folded.js`)와는 다릅니다. 그건');
      console.log('     「설계가 바뀌어 잴 것이 없어졌다」라 **0** 으로 끝나고,');
      console.log('     이건 「있어야 할 것이 없다」라 **2**(못 쟀다)로 끝납니다.');
      if (look) {
        console.log('');
        console.log(`   먼저 볼 곳: ${look}`);
      }
      if (tool) console.log(`\n   (${tool})`);
      process.exit(2);
      return true;
    },

    /** ★ **이름만 바꾼 짝** — 같은 도구가 딴 것을 잴 때 (`must.as('딱지')`) */
    as: (noun) => make(noun),
  });

  return make(what);
}
