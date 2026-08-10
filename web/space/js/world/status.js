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
  const top = y + h * 0.19, gap = h * 0.135;
  let i = 0;
  const at = () => top + gap * (i++);

  // ① 열 — 이 배에서 제일 자주 사람을 죽이는 것
  const ht = clamp01((s.heat ?? 0) / HEAT.max);
  row(ctx, T, x, at(), w, bh, '열', ht, ht > HEAT.warn / HEAT.max ? '뜨겁다' : '괜찮다',
    ht > HEAT.warn / HEAT.max);

  // ② 냉각 — 켜졌나. **띠가 아니라 켜짐/꺼짐이다**
  row(ctx, T, x, at(), w, bh, '냉각', s.cooling ? 1 : 0, s.cooling ? '돈다' : '꺼짐', !s.cooling);

  // ③ 속도 — 「지금 얼마나 가고 있나」
  const sp = clamp01(s.speed ?? 0);
  row(ctx, T, x, at(), w, bh, '속도', sp,
    sp < 0.05 ? '섰다' : sp < 0.5 ? '느리다' : '순항', sp < 0.05);

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
}

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
      drawTook(ctx, cv.width, cv.height, s);
      tex.needsUpdate = true;
    },
  };
}

/** 순항 대비 지금 속도 (0~1) — 표에서 뽑는다 */
export const speedOf = (mps) => clamp01(mps / CRUISE.speed);
