// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **UI 크기** — 뼈대만 (v135)
//
//    node tools/space-ui.js
//
//  ★ 사장님 (2026-08-13) 「글씨가 겹쳐서 구분이 안되잔아.
//    **UI를 전체적으로 크기를 키워. 전부**」
//
//  ★★★ 묻는 것 여섯
//      ① **정말 커졌나** — 배율이 1 보다 큰가 (안 물리면 아무 일도 안 난다)
//      ② ★★★ **DOM 과 3D 가 비슷하게 커졌나** — 한쪽만 크면 더 어긋난다
//      ③ ★★★ **전투 원뿔을 안 먹나** — 키운 것이 가린 것이 되면 안 된다
//      ④ **예산 안인가** — 계기가 하늘을 통째로 덮지는 않나
//      ⑤ ★★ **숫자가 한 곳에 있나** — 표에 안 박히면 다음에 또 흩어진다
//      ⑥ ★★★ **겹친 판이 없나** — 사장님이 보신 것은 크기가 아니라 **겹침**이었다
// ══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { UI, panelSide, screenSide, FOV0 } from '../web/space/js/game/ui-table.js';
import { FLY_VIEW } from '../web/space/js/game/helm-table.js';
import { PANELS, BUDGET, CONE } from '../web/space/js/game/screen-table.js';
import { MFD } from '../web/space/js/game/view-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

console.log('UI 크기 — 뼈대만 (게임을 안 부른다)');

console.log('\n[1] ★★★ **정말 커졌나**');
{
  console.log(`   DOM 배율 ×${UI.zoom} · 3D 판 넓이 ×${UI.panel} (변으로는 ×${panelSide().toFixed(2)})`);
  ok(UI.zoom > 1.15,
    `★★★ **DOM 이 ×${UI.zoom} 로 커졌다** — 1.15 아래면 사장님이 겪으신 것이 그대로 남는다`);
  //  ══ ★★★ v139 — **묻는 것을 고쳤다** ═══════════════════════════════
  //   여기가 「미터 배율이 1.3 을 넘나」를 묻고 있었다. 그런데 v139 가
  //   화각을 94 → 74 로 좁히자 **같은 미터가 화면을 1.27배 더 먹는다** —
  //   미터를 줄여도 화면에서는 안 줄고, 미터를 지켜도 화면에서는 커진다.
  //   ★★ 사장님이 「키우라」고 하신 것은 **화면에서** 크게이지 미터로
  //     크게가 아니다. 그래서 **화면 기준**으로 묻는다
  ok(screenSide(FLY_VIEW.fov) > 1.15,
    `★★ **3D 계기도 화면에서 ×${screenSide(FLY_VIEW.fov).toFixed(2)} 로 커졌다**`
    + ` (미터로는 넓이 ×${UI.panel} · 화각 ${FLY_VIEW.fov}°) — DOM 만 키우면`
    + ' 계기 셋이 상대적으로 더 작아 보여서 오히려 어긋난다');
  ok(UI.zoom < 1.7,
    `★ 그래도 ×${UI.zoom} 를 안 넘는다 — 1.7 이면 좁은 창에서 베이·툴팁이 화면을 넘친다`);
}

console.log('\n[2] ★★★ **DOM 과 3D 가 비슷하게 커졌나**');
{
  //  ★ 사람 눈에 「같이 커졌다」로 읽히려면 **글자 크기 배율**이 비슷해야
  //    한다. 3D 판은 넓이로 적혀 있으므로 변(=글자) 배율은 그 제곱근이다
  //  ★ v139 — **화면 기준**으로 견준다 (위 [1] 과 같은 까닭)
  const side = screenSide(FLY_VIEW.fov);
  const gap = Math.abs(side - UI.zoom) / UI.zoom;
  console.log(`   글자 기준 — DOM ×${UI.zoom} · 3D ×${side.toFixed(2)} (차이 ${(gap * 100).toFixed(0)}%)`);
  //  ★ v139 — 문턱이 **0.15 인데 말은 20%** 라고 하고 있었다. 둘이 다르면
  //    「왜 빨간지」를 사람이 못 읽는다 — 말을 따라 0.20 으로 맞춘다.
  //    (화각을 74 로 좁히며 3D 쪽이 ×1.25 가 되어 차이가 15% 로 벌어졌다)
  ok(gap < 0.20,
    `★★★ **둘의 차이가 ${(gap * 100).toFixed(0)}% 다** — 20% 를 넘으면 한쪽만 커 보이고,`
    + ' 그러면 「전부 키웠다」가 아니라 「반만 키웠다」다');
}

console.log('\n[3] ★★★ **전투 원뿔을 안 먹나** — 키운 것이 가린 것이 되면 안 된다');
{
  //  ★ 판은 **구석에 붙은 채로** 커진다 (`ANCHOR` 가 바깥 모서리를 잡는다).
  //    그러니 판이 원뿔에 닿는지는 **판의 반쪽 크기**로 정해진다:
  //    바깥 모서리 0.955 에서 판 하나 폭만큼 들어온 자리가 안쪽 모서리다
  console.log('   판       넓이     안쪽 모서리   원뿔(0.45)');
  for (const [name, p] of Object.entries(PANELS)) {
    if (name === '조준경') continue;                       // 조준경은 원뿔이 제 자리다
    // 넓이 → 변 (가로세로 비를 MFD 에서 가져온다)
    const r = MFD.w / MFD.h;
    const h = Math.sqrt(p.area / r), w = h * r;
    const inner = 0.955 - w;                               // 바깥 모서리에서 판 폭만큼
    const okc = Math.abs(inner) > CONE;
    console.log(`   ${name}  ${p.area.toFixed(3)}   ${inner.toFixed(2)}          ${okc ? '안 닿는다' : '★ 닿는다'}`);
    ok(okc, `★★★ **${name} 이 전투 원뿔 밖이다** (안쪽 ${inner.toFixed(2)} > ${CONE})`
      + ' — v103 에 사장님이 「전투화면이 더 광활하게」라고 하셨다. 키우면서'
      + ' 복판으로 들어오면 그건 키운 것이 아니라 **가린 것**이다');
  }
}

console.log('\n[4] ★★ **예산 안인가**');
{
  //  ══ ★★★ v135 — **여기서 재던 것이 틀렸다** ═══════════════════════════
  //   처음에 `PANELS[].area` 의 합을 예산과 견주고 「넘었다」로 빨개졌다.
  //   그런데 그건 **상한**이지 실제 크기가 아니다 — 「이만큼까지는 커도
  //   된다」와 「이만큼 크다」는 다른 말이고, 실제는 **카메라에 투영해야**
  //   나온다 (`space-screen.js` 가 창 넷으로 잰다: 15.5% · 14.6% · 11.0% · 19.2%).
  //   ★★ 빨간 검사를 보고 **게임을 줄여** 버렸으면 사장님이 「키우라」고
  //     하신 것을 절반만 하고 넘어갔을 것이다. **재는 것이 틀렸는지 먼저
  //     묻는다** — 이 저장소가 v131·v134 에 두 번 그랬다
  const three = ['광학창', '상태창', '레이더'].reduce((s, k) => s + PANELS[k].area, 0);
  console.log(`   상한의 합 ${(three * 100).toFixed(1)}% · 예산 ${(BUDGET * 100).toFixed(0)}%`
    + '  (실제 크기는 space-screen.js 가 잰다)');
  ok(three >= BUDGET,
    `★★★ **상한이 예산보다 넉넉하다** (${(three * 100).toFixed(1)}% ≥ ${(BUDGET * 100).toFixed(0)}%) —`
    + ' 상한이 예산보다 빡빡하면 **예산이 남았는데도 못 키운다.**'
    + ' 진짜 문지기는 예산이고, 그것은 `space-screen.js` 가 **투영해서** 지킨다');
  ok(BUDGET < 0.35,
    `★★ 예산 자체도 ${(BUDGET * 100).toFixed(0)}% 를 안 넘는다 — 3분의 1을 넘으면`
    + ' 창밖을 보는 게임이 아니라 계기를 보는 게임이 된다');
}

console.log('\n[5] ★★ **숫자가 한 곳에 있나**');
{
  const css = read('../web/space/css/style.css');
  const scr = read('../web/space/js/game/screen-table.js');
  const view = read('../web/space/js/game/view-table.js');
  ok(/var\(--ui-zoom/.test(css) && !/zoom:\s*1\.\d/.test(css),
    '★★★ **CSS 에 배율 숫자가 안 박혀 있다** — 박으면 도구가 못 읽고,'
    + ' 못 읽으면 「키웠나」를 잴 수가 없다');
  ok(/ui-table\.js/.test(scr) && /ui-table\.js/.test(view),
    '★★★ **화면 표와 시야 표가 같은 곳에서 배율을 읽는다** — 두 곳에 적으면'
    + ' 반드시 갈라진다 (이 저장소의 제일 오래된 규약)');
  ok(/body > \*:not\(#view\)/.test(css),
    '★★ **3D 캔버스에는 안 건다** — 걸면 화면이 커지는 게 아니라 **흐려진다**');
}

console.log('\n[6] ★★★ **겹친 판이 없나** — 사장님이 보신 것은 크기가 아니라 겹침이었다');
{
  //  ★★★ 상태창 여덟 줄 위에 **획득 목록이 그대로 얹혀** 있었다.
  //    `drawTook` 이 `H*0.30` 에서 아래로 그리는데 상태 줄이 `H*0.215`
  //    에서 `H*0.09` 씩 내려온다 — 정확히 같은 자리다
  const st = read('../web/space/js/world/status.js');
  const called = /^\s*drawTook\(ctx/m.test(st);
  ok(!called,
    '★★★ **상태창이 획득 목록을 겹쳐 안 그린다** — 주운 것은 이미 제 창이 있고'
    + ' (`loothud.js` · 사람이 옮길 수도 있다), 같은 것을 두 곳에 그리면'
    + ' 옮겨도 한쪽은 안 따라온다. **그리는 곳도 둘로 만들지 않는다**');
  ok(/drawTook/.test(st),
    '★ 그래도 `drawTook` 은 **남겨 뒀다** — 왜 겹쳤는지가 같이 지워지면'
    + ' 다음에 또 얹는다 (접힌 것들과 같은 규약)');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
