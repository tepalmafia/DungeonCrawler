// ══════════════════════════════════════════════════════════════════════════
//  ★★★ 상태창 — **앉으면 뜬다** (v69 · 사장님 요청)
//
//  ★ 사장님: 「기타 다른것들은 **hud처럼 조정석에 앉았을때 보이도록** 해줘.
//             **퀘스트 안내창처럼.** 그리고 **냉각이나 속도** 이런 것들도
//             표시 되도록하고. **운전석에 탔을때 외에도 다른 모니터에서
//             확인할 수 있도록** 해줘」
//
//  ══ 왜 이게 필요한가 ═══════════════════════════════════════════════════
//
//  이 배의 계기는 **콘솔에 박혀 있다.** 고개를 숙여야 읽힌다 —
//  v63 에서 「계기를 읽으려 숙이면 창밖이 화면의 5% 로 준다」를 이미 쟀다.
//  평온할 때는 괜찮았다. 그런데 **격추 게임에서는 못 숙인다**: 숙이는
//  2초 동안 적이 붙는다.
//
//  ★★ 그래서 **늘 보이는 한 장**이 필요하다. 실제 전투기가 HUD 에
//    속도·고도·기수를 띄우는 이유가 정확히 이것이다 — 계기판을 안 봐도
//    되는 최소한을 유리에 얹는다.
//
//  ══ ★ 무엇을 얹고 무엇을 안 얹나 ═══════════════════════════════════════
//
//  다 얹으면 창이 사라진다. **여섯 줄**만 얹는다 — 「지금 나를 죽일 수
//  있는 것」과 「지금 내가 쏠 수 있는 것」만:
//
//      열      뜨거우면 못 숨고, 더 오르면 계통이 터진다
//      냉각    켜져 있나 (사장님이 콕 집어 말씀하신 것)
//      속도    지금 얼마나 가고 있나 (역시 콕 집어 말씀하신 것)
//      전력    셋 중 어느 둘이 켜져 있나 — 계기판에서 여기로 올라왔다
//      자국    얼마나 훤히 보이나
//      미사일  몇 발 남았나 (v69 · 저장고)
//
//  ★ **안 얹는 것**: 식량 · 부품 · 마모 · 고장 목록 · 항로. 급하지 않거나,
//    이미 손목 장치와 진단대가 맡고 있다. 급하지 않은 것을 유리에 얹으면
//    급한 것이 안 보인다.
//
//  ══ ★★ 두 군데에서 같은 그림을 쓴다 ═══════════════════════════════════
//
//  「운전석에 탔을때 외에도 다른 모니터에서」 — 그래서 이 파일이 **그리는
//  함수 하나**를 내놓고, 조종석 HUD 와 정비실 작업대가 **같은 것**을 부른다.
//  두 벌로 그리면 반드시 갈라진다 (이 저장소가 두 번 겪은 것).
//  다만 **색은 다르다**: HUD 는 초록(가산 혼합 · 배경 없음), 작업대는
//  호박색(불투명 화면). 그건 같은 값을 그 자리의 규약대로 입히는 것뿐이다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { CIRCUITS } from '../game/chase-table.js';
import { HEAT, CRUISE } from '../game/systems-table.js';
import { MISSILES } from '../game/supply-table.js';

/** 여섯 줄. **표에서 뽑는다** — 여기 손으로 안 적는다 */
export const ROWS = ['heat', 'cool', 'speed', 'power', 'sign', 'missiles'];

// ★ v73 — 초록을 한 톤 죽였다. 판 자체가 반투명이라 글씨까지 밝으면
//   결국 같은 밝기로 보인다 — 「거슬린다」의 절반은 글씨였다
const GREEN = { fg: '#6fc4a2', dim: 'rgba(143,230,192,.34)', hot: '#ff9a5c', bg: null };
const AMBER = { fg: '#ffc98a', dim: 'rgba(255,201,138,.42)', hot: '#ff7a55', bg: '#1a1008' };
export const THEME = { hud: GREEN, bench: AMBER };

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * 한 줄 — 이름 · 띠 · 한 마디.
 * ★ **숫자를 크게 안 쓴다.** 「62%」로는 아무것도 못 정한다 —
 *   띠의 길이와 낱말이 판단을 만든다 (이 배의 오랜 규약)
 */
function row(ctx, T, x, y, w, bh, name, fill, word, hot) {
  const f = Math.round(bh * 0.82);
  ctx.fillStyle = hot ? T.hot : T.dim;
  ctx.font = `600 ${f}px system-ui, sans-serif`;
  ctx.fillText(name, x, y + bh * 0.85);
  const bx = x + w * 0.20, bw = w * 0.52;
  ctx.strokeStyle = T.dim;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx, y, bw, bh);
  if (fill > 0) {
    ctx.fillStyle = hot ? T.hot : T.fg;
    ctx.fillRect(bx, y, bw * clamp01(fill), bh);
  }
  if (word) {
    ctx.fillStyle = hot ? T.hot : T.dim;
    ctx.font = `700 ${Math.round(bh * 0.72)}px system-ui, sans-serif`;
    ctx.fillText(word, bx + bw + w * 0.03, y + bh * 0.85);
  }
}

/**
 * ★★ **여섯 줄을 그린다.** 조종석 HUD 와 정비실 작업대가 같이 부른다.
 *
 * @param s.heat 0~100 · s.cooling · s.speed 0~1 · s.power {thrust,sensor,cool}
 *        s.sign 0~100 · s.missiles · s.weapon 지금 고른 무기 이름
 * @param theme 'hud' | 'bench'
 */
export function drawStatus(ctx, x, y, w, h, s, theme = 'hud') {
  const T = THEME[theme] ?? GREEN;
  if (T.bg) { ctx.fillStyle = T.bg; ctx.fillRect(x, y, w, h); }

  // 머리 — **퀘스트 안내창처럼** 제목 한 줄과 밑줄
  const f = (k) => Math.round(h * k);
  ctx.fillStyle = T.dim;
  ctx.font = `600 ${f(0.088)}px system-ui, sans-serif`;
  ctx.fillText('배의 상태', x, y + h * 0.09);
  ctx.strokeStyle = T.dim;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.125); ctx.lineTo(x + w, y + h * 0.125);
  ctx.stroke();

  const bh = h * 0.086;
  // ★★ v99 — 줄이 여섯에서 **일곱**이 되면서 간격을 좁혔다.
  //   0.135 그대로 두면 일곱째가 `0.19 + 0.135×6 = 1.0` 이라 **판 밖**이다 —
  //   그리고 캔버스는 넘쳐도 조용하다. 「창이 화면 밖에 그려지고 있었다」를
  //   코드로는 못 찾는다는 것이 이 저장소의 오랜 교훈이라, 여기는 **셈으로**
  //   확인한다: 0.19 + 0.113×6 + 0.086 = 0.954 — 아래에 여백이 남는다
  // ══ ★★★ v121 — **줄이 여덟이 됐다** (장갑) ═══════════════════════
  //  ★ 사장님 (2026-08-12) 「스크린에 **무기 보유량 장갑 등 상태창**이
  //    나오도록 해줘」 — 무기 보유량은 이미 있었고(⑥ 미사일), **장갑이
  //    없었다.** 이 배에서 제일 자주 죽는 까닭이 선체인데 그것만 안 보였다.
  //  ★★ 간격을 0.113 → **0.098** 로 좁힌다. 셈으로 확인한다 (캔버스는
  //    넘쳐도 **조용하다** — 이 저장소의 오랜 교훈):
  //      0.19 + 0.098×7 + 0.086 = **0.962** — 아래에 여백이 남는다
  const top = y + h * 0.19, gap = h * 0.098;
  let i = 0;
  const at = () => top + gap * (i++);

  // ① 열 — 이 배에서 제일 자주 사람을 죽이는 것
  const ht = clamp01((s.heat ?? 0) / HEAT.max);
  row(ctx, T, x, at(), w, bh, '열', ht, ht > HEAT.warn / HEAT.max ? '뜨겁다' : '괜찮다',
    ht > HEAT.warn / HEAT.max);

  // ══ ★★★ ②-a v121 — **장갑** (선체가 얼마나 남았나) ═══════════════
  //
  //  ★ 사장님 「무기 보유량 **장갑** 등 상태창이 나오도록」
  //
  //  ★★ `s.hull` 은 **남은 몫**(1 = 멀쩡)이다. 안에서는 `faults.wear.hull`
  //    이 **깎인 몫**으로 사는데, 계기는 「얼마나 남았나」를 그려야
  //    사람이 읽는다 — 띠가 줄면 나쁜 것이라는 규약을 열·냉각과 맞춘다.
  //  ★ 그리고 **고칠 수 있는지**를 같이 적는다. 「32%」로는 아무것도 못
  //    정하지만 「깎였다 · P」는 손이 갈 데를 준다 (이 배의 오랜 규약)
  {
    const hull = clamp01(s.hull ?? 1);
    const hurt = hull < 0.72;
    row(ctx, T, x, at(), w, bh, '장갑', hull,
      hull > 0.92 ? '멀쩡' : hull > 0.72 ? '긁혔다' : hull > 0.4 ? '깎였다 · P' : '★ 위험 · P',
      hurt);
  }

  // ② 냉각 — 켜졌나. **띠가 아니라 켜짐/꺼짐이다**
  row(ctx, T, x, at(), w, bh, '냉각', s.cooling ? 1 : 0, s.cooling ? '돈다' : '꺼짐', !s.cooling);

  // ③ 속도 — 「지금 얼마나 가고 있나」
  // ★★ v116 — 말은 **표가 한다** (`speed-table.js speedWord`). 여기서
  //   따로 「느리다/순항」을 정하고 있었는데, 창밖 속도 눈금이 v116 에
  //   통째로 바뀌면서 **같은 속도를 두 곳이 다르게 부르게** 됐다
  const sp = clamp01(s.speed ?? 0);
  row(ctx, T, x, at(), w, bh, '속도', sp,
    s.speedWord ?? (sp < 0.05 ? '섰다' : sp < 0.5 ? '느리다' : '순항'), sp < 0.05);

  // ④ 전력 — **계기판에서 여기로 올라왔다** (v69).
  //    셋 중 켜진 것의 이름을 적는다. 띠로는 「어느 둘인가」를 못 말한다
  {
    const yy = at();
    ctx.fillStyle = T.dim;
    ctx.font = `600 ${Math.round(bh * 0.82)}px system-ui, sans-serif`;
    ctx.fillText('전력', x, yy + bh * 0.85);
    let cx2 = x + w * 0.20;
    for (const c of CIRCUITS) {
      const on = !!s.power?.[c.key];
      ctx.fillStyle = on ? T.fg : 'rgba(140,140,140,.35)';
      ctx.font = `700 ${Math.round(bh * 0.78)}px system-ui, sans-serif`;
      ctx.fillText(c.name, cx2, yy + bh * 0.85);
      cx2 += ctx.measureText(c.name).width + w * 0.045;
    }
  }

  // ⑤ 자국 — 얼마나 훤히 보이나
  const sg = clamp01((s.sign ?? 0) / 100);
  row(ctx, T, x, at(), w, bh, '자국', sg, sg > 0.6 ? '훤하다' : sg > 0.3 ? '보인다' : '조용', sg > 0.6);

  // ⑥ 미사일 — **몇 발 남았나** (v69 저장고). 여기만 숫자를 쓴다:
  //    「세 발」은 셀 수 있는 것이고, 셀 수 있는 것은 띠보다 숫자가 낫다
  {
    const yy = at();
    const n = s.missiles ?? 0;
    ctx.fillStyle = n === 0 ? T.hot : T.dim;
    ctx.font = `600 ${Math.round(bh * 0.82)}px system-ui, sans-serif`;
    ctx.fillText('미사일', x, yy + bh * 0.85);
    // 한 발이 네모 하나 — 세지 않아도 눈에 들어온다
    const bw2 = w * 0.052, gp = w * 0.012;
    for (let k = 0; k < MISSILES.max; k++) {
      const bx = x + w * 0.20 + k * (bw2 + gp);
      ctx.strokeStyle = T.dim;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(bx, yy, bw2, bh);
      if (k < n) { ctx.fillStyle = T.fg; ctx.fillRect(bx, yy, bw2, bh); }
    }
    if (s.weapon) {
      ctx.fillStyle = T.dim;
      ctx.font = `700 ${Math.round(bh * 0.7)}px system-ui, sans-serif`;
      ctx.fillText(s.weapon, x + w * 0.20 + MISSILES.max * (bw2 + gp) + w * 0.02, yy + bh * 0.85);
    }
  }

  // ══ ★★★ ⑦ v99 — **아크 도약** ═══════════════════════════════════════
  //
  //  ★ 여섯 줄을 일곱으로 늘렸다. 이 배의 규약은 「방을 안 늘린다」이지
  //    「줄을 안 늘린다」가 아니고, 이 줄은 **없으면 계통이 안 보인다** —
  //    26초를 재는 동안 볼 것이 없으면 그건 「아무 일도 안 일어나는 26초」다.
  //
  //  ★★ **재는 중이 아니면 전지 수만** 적는다. 늘 막대가 있으면 「지금
  //    재는 중인가」가 안 읽힌다 — 미사일 줄과 같은 규약이다
  {
    const yy = at();
    const a = s.arc ?? null;
    const ing = a && a.phase === 'charge';
    ctx.fillStyle = ing ? T.hot : T.dim;
    ctx.font = `600 ${Math.round(bh * 0.82)}px system-ui, sans-serif`;
    ctx.fillText('도약', x, yy + bh * 0.85);
    if (ing) {
      // 재는 중 — 막대가 찬다. **다 차면 뛴다**는 것이 눈에 보여야 한다
      row(ctx, T, x, yy, w, bh, '', clamp01(a.k ?? 0), `${Math.ceil((1 - (a.k ?? 0)) * 26)}초`, true);
    } else {
      // ★ 못 뛰면 **왜 못 뛰는지**를 적는다. 회색 막대만 있으면 「고장」으로
      //   읽힌다 — 이 배의 오랜 규약이다 (`combat-table.js whyNotFire`)
      const n = a?.cells ?? 0;
      const need = a?.need ?? 6;
      ctx.fillStyle = n >= need ? T.fg : 'rgba(140,140,140,.45)';
      ctx.font = `700 ${Math.round(bh * 0.78)}px system-ui, sans-serif`;
      ctx.fillText(`전지 ${n}/${need}`, x + w * 0.20, yy + bh * 0.85);
      if (a?.blocked && a.blocked !== 'cells') {
        ctx.fillStyle = 'rgba(140,140,140,.45)';
        ctx.font = `600 ${Math.round(bh * 0.66)}px system-ui, sans-serif`;
        ctx.fillText(ARC_SHORT[a.blocked] ?? '', x + w * 0.20 + w * 0.30, yy + bh * 0.85);
      }
    }
  }
}

/** ★ 상태창은 좁다 — 긴 문장 대신 **넉 자**로 (`arc-table.js WHY` 의 짧은 판) */
const ARC_SHORT = {
  sink: '열 참', power: '전력 없음', cool: '식는 중', land: '착륙 중', busy: '재는 중',
};

/**
 * ★ 조종석 HUD 판 하나 — **앉으면 켜지고 서면 꺼진다.**
 *
 *   `world/gunsight.js` 와 같은 규약: 배경을 안 칠하고 가산 혼합으로
 *   얹는다. 그래야 「창 앞의 검은 판」이 안 된다 (v65 에 한 번 겪었다).
 */
/**
 * ★★★ **들어온 목록** — 사장님 「**실시간으로** 획득 아이템이 … q 스크린이나
 *   조정석에선 조정석 화면에서 **획득 리스트**를 보여줄 수 있도록」 (v83)
 *
 *   ★ 배너 한 줄로는 안 된다. 배너는 **하나씩 덮어쓰므로** 세 개가 한꺼번에
 *     들어오면 마지막 하나만 보인다. 목록이라야 「무엇 무엇이 들어왔나」가 남는다.
 *   ★ 오래된 줄은 **흐려지다 사라진다** — 지운 자국이 남으면 그건 기록이지
 *     실시간이 아니다
 */
function drawTook(ctx, W, H, s) {
  const log = s.cargo?.log ?? [];
  if (!log.length) return;
  const f = (k) => Math.round(H * k);
  const x = W * 0.05;
  let y = H * 0.30;
  ctx.textAlign = 'left';
  ctx.font = `700 ${f(0.048)}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(143,230,192,.55)';
  ctx.fillText(`화물 ${s.cargo.used}/${s.cargo.hold}`, x, y);
  y += f(0.062);
  for (const l of log.slice(0, 5)) {
    // 남은 시간에 따라 흐려진다
    const k = Math.max(0.18, Math.min(1, l.t / 8));
    const got = l.n > 0;
    ctx.font = `700 ${f(0.052)}px system-ui, sans-serif`;
    ctx.fillStyle = got ? `rgba(127,230,168,${k})` : `rgba(255,138,114,${k})`;
    ctx.fillText(`${got ? '+' : '−'}${Math.abs(l.n)}`, x, y);
    ctx.fillStyle = `rgba(219,238,230,${k})`;
    ctx.fillText(l.name, x + f(0.075), y);
    y += f(0.058);
  }
}

export function buildStatusHud(w, h) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * 900);
  cv.height = Math.round(h * 900);
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map: tex, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false,
      // ★★★ v73 — **반투명하게** (사장님 요청). 0.95 는 사실상 불투명이라
      //   창을 덮었다. 0.52 면 별이 비쳐 보이고, 그래야 「얹혀 있는 것」이
      //   되지 「창에 붙은 판」이 안 된다
      opacity: 0.52,
    }),
  );
  mesh.renderOrder = 940;
  mesh.visible = false;
  return {
    mesh,
    redraw(s) {
      // ★ 앉아 있을 때만. 늘 켜 두면 걸어다니는 동안 계기가 따라다닌다
      mesh.visible = !!s.on;
      if (!s.on) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      drawStatus(ctx, cv.width * 0.04, cv.height * 0.04, cv.width * 0.92, cv.height * 0.92, s, 'hud');
      // ══ ★★★ v135 — **`drawTook` 을 안 부른다** (사장님 「글씨가 겹쳐서
      //    구분이 안되잔아」) ═══════════════════════════════════════════
      //
      //  ★★★ 겹친 것은 **줄 간격이 아니라 판 둘**이었다. `drawTook` 은
      //    `y = H*0.30` 에서 아래로 그리는데, 상태 여덟 줄이 `H*0.215`
      //    에서 `H*0.09` 씩 내려온다 — **정확히 같은 자리**다. 그래서
      //    「열」 위에 「화물 14/10」이, 「장갑」 위에 「+2 장전량 팩」이
      //    얹혀서 사장님 화면처럼 두 겹으로 보였다.
      //
      //  ★★ 그리고 이건 **중복**이다. 주운 것은 이미 제 창이 있고
      //    (`loothud.js cardMesh` · `layout-table.js 획득창`), v127 부터
      //    **사람이 옮길 수 있는** 창이다. 같은 것을 두 곳에 그리면
      //    옮겨도 한쪽은 안 따라오고, 그게 지금 상태였다.
      //    「재는 곳을 둘로 만들지 않는다」는 그리는 곳에도 그대로다.
      //
      //  ★ `drawTook` 자체는 지우지 않는다 — 왜 겹쳤는지가 이 주석과
      //    같이 남아 있어야 다음에 또 안 얹는다
      tex.needsUpdate = true;
    },
  };
}

/** 순항 대비 지금 속도 (0~1) — 표에서 뽑는다 */
export const speedOf = (mps) => clamp01(mps / CRUISE.speed);
