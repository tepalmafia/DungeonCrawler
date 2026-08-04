// ══════════════════════════════════════════════════════════════════════════
//  손목 장치 — **늘 보이는 유일한 계기.**
//
//  ★ 왜 이것만 늘 보이나
//    다른 계기는 전부 방 안의 물건이고, 그게 이 게임이다 (GAP.md §3-C).
//    이것만 예외인 이유는 **여기 뜨는 것이 판단 재료가 아니기 때문**이다 —
//    「지금 할 일 하나」와 「내가 고친 것」뿐이고, 배의 상태(거리·자국·항로·
//    마모)는 안 나온다. 그건 여전히 방에 있다.
//
//  ★ HUD 를 안 만든다 — **화면에 그리는 게 아니라 물건이다**
//    조준점 말고 화면에 얹는 것은 안 만든다는 규칙(PLAN §5-2)을 지킨다.
//    이건 **카메라에 매달린 3D 물건**이라 조명·안개를 그대로 받고,
//    들어 올리면 실제로 기울어진다. 「손이 곧 상태창」과 같은 결이다.
//
//  ★ 손을 안 만든다
//    CLAUDE.md 의 절대 규칙 — 몸은 사장님이 주신 그림으로만 만든다.
//    그래서 팔뚝도 손도 없이 **장치만** 있다. 그림이 오면 그때 손목에 얹는다.
//
//  ★ 첫 판을 화면으로 보고 두 가지를 고쳤다 (2026-08-04)
//    코드로는 「된다」였고 화면에서는 아니었다 — 이 저장소가 반복해서 배운 것
//    (POSTMORTEM 3번: 확인은 실제 화면에서).
//
//    1) **몸체가 나무판처럼 누렇게** 떴다. `metalness 0.6` 이라 조종석
//       천장등이 면 전체를 정반사로 태웠고, 그 방 가구(콘솔)와 같은 색이 되어
//       **손목 장치가 아니라 벽에 붙은 명패**로 읽혔다.
//       → 거친 무광(`roughness .95` · `metalness .05`)에 거의 검은색.
//          빛을 반사하지 않으니 어느 방에서도 같은 색으로 남는다.
//    2) **들어 올리면 화면의 3분의 1**을 덮었다. 계기를 보려고 든 건데
//       계기가 가려졌다. → 몸체 자체를 납작하게(가로:세로 ≒ 2:1) 줄이고
//       든 상태를 26% 로. 손목에 차는 물건의 비율이기도 하다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { WRIST } from '../game/wrist-table.js';

const FG = '#8fe8c4';
const DIM = 'rgba(143,232,196,.38)';
const HOT = '#ffb08a';

// 몸체 치수 — **가로로 길다.** 정사각에 가까우면 손목이 아니라 액자다
const BW = 0.19, BH = 0.098, BD = 0.03;

/**
 * @returns { group, update(state, dt) }  — 카메라에 붙여 쓴다
 */
export function buildWrist(camera) {
  const g = new THREE.Group();
  camera.add(g);

  const cv = document.createElement('canvas');
  cv.width = 360; cv.height = 176;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;

  // ★ 무광 · **거의 검정**. 어느 방에 들어가도 같은 색으로 남아야 한다 —
  //   방마다 색이 변하면 그 순간 **방의 물건**으로 보이고 내 장비가 아니다.
  //
  //   0x161a20 으로 한 판을 찍어 봤더니 통로에서는 까맣게 잘 나오는데
  //   **조종석에서만 나무판처럼 누레졌다.** 버그가 아니라 방이 그렇다 —
  //   cockpit.js 가 (0, 1.1, -5.2) 에 세기 10 짜리 주황등(0xffa758)을 두고
  //   있고, 손목은 눈앞 0.6m 라 **그 등의 한복판**에 있다. 조명을 고칠 일이
  //   아니라 **그 빛을 맞고도 어두울 만큼** 바탕을 낮추는 게 맞다.
  const shell = () => new THREE.MeshStandardMaterial({
    color: 0x0b0e12, roughness: 1, metalness: 0.05,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(BW, BH, BD), shell());
  g.add(body);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(BW - 0.026, BH - 0.022),
    new THREE.MeshBasicMaterial({ map: tex }),
  );
  screen.position.z = BD / 2 + 0.001;
  g.add(screen);

  // 테두리 위아래 — 화면이 몸체에 **박혀** 있어 보이게. 없으면 떠 있는 판이다
  for (const y of [BH / 2 - 0.006, -BH / 2 + 0.006]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(BW, 0.012, BD + 0.004), shell());
    b.position.set(0, y, 0);
    g.add(b);
  }

  // ★ **바뀔 때만 다시 그린다.** 캔버스를 매 프레임 다시 올리면 360×176
  //   장을 초당 60번 GPU 로 보내는 셈이고, 조종석은 이미 화면 여섯을 그렇게
  //   그리고 있다. 손목은 대부분 **한 줄이 그대로**라 그럴 이유가 없다 —
  //   급할 때만 밑줄이 깜빡이므로 그때는 매 프레임 그린다
  let sig = null;
  function draw(s) {
    const now = `${s.job?.text}|${s.job?.urgent}|${s.fixed}|${(s.log ?? []).join()}`;
    if (now === sig && !s.job?.urgent) return;
    sig = now;

    const w = cv.width, h = cv.height;
    ctx.fillStyle = '#08120e';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = DIM;
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    // ── 지금 할 일 — **제일 크게.** 이게 이 장치의 존재 이유다 ──
    //    안 들고 곁눈으로 볼 때 읽히는 건 이 줄 하나뿐이고, 그거면 된다
    ctx.fillStyle = s.job?.urgent ? HOT : FG;
    ctx.font = '700 36px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(s.job?.text ?? '', 16, 14);

    // 급한 일이면 밑줄이 깜빡인다 — 글자를 키우는 것보다 눈에 띈다
    if (s.job?.urgent) {
      ctx.fillStyle = `rgba(255,120,80,${0.35 + 0.45 * Math.abs(Math.sin(s.clock * 4))})`;
      ctx.fillRect(16, 56, w - 32, 4);
    }

    // ── 고친 것 ────────────────────────────────────────
    ctx.fillStyle = DIM;
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText(s.fixed ? `고친 것 ${s.fixed}` : '고친 것 없음', 16, 70);

    // ★ **최신이 앞이다.** fault.js 는 `log.unshift` 로 쌓는다 (진단대가 그
    //   순서로 읽는다). `slice(-n).reverse()` 로 짰다가 **여섯 개가 찬 뒤부터
    //   제일 오래된 것 넷**을 보여줬다 — 방금 고친 게 안 뜨니 기록이 아니다
    ctx.font = '500 15px system-ui, sans-serif';
    const rows = (s.log ?? []).slice(0, WRIST.logShow);
    rows.forEach((line, i) => {
      // 최근 것일수록 밝다 — 방금 한 것이 제일 위에 온다
      ctx.fillStyle = `rgba(143,232,196,${0.85 - i * 0.18})`;
      const t = line.length > WRIST.maxLen ? `${line.slice(0, WRIST.maxLen - 1)}…` : line;
      ctx.fillText(`· ${t}`, 16, 94 + i * 19);
    });
    if (!rows.length) {
      ctx.fillStyle = 'rgba(143,232,196,.28)';
      ctx.fillText('· 아직 아무것도', 16, 94);
    }
    tex.needsUpdate = true;
  }

  let lift = 0;
  /**
   * @param s.raised 들어 올리고 있나 — 가까이 와서 커진다
   */
  function update(s, dt = 0.016) {
    lift += ((s.raised ? 1 : 0) - lift) * Math.min(1, dt / WRIST.raise);
    // 안 들면 왼쪽 아래 구석(곁눈), 들면 눈앞. **가운데로는 안 온다** —
    // 창밖과 콘솔이 이 게임의 화면이고 손목이 그걸 가리면 안 된다
    g.position.set(-0.30 + lift * 0.10, -0.235 + lift * 0.085, -0.60 + lift * 0.16);
    g.rotation.set(-0.60 + lift * 0.48, 0.44 - lift * 0.36, 0.17 - lift * 0.14);
    g.scale.setScalar(0.95 + lift * 0.65);
    draw(s);
  }
  update({ job: null, log: [], fixed: 0, clock: 0 }, 1);

  // `lift` 를 밖으로 낸다 — tools/space-chase.js 가 **Q 로 정말 올라오나**를
  // 본다. 화면만 보면 「올라온 것 같다」로 끝나고 그건 검사가 아니다
  return { group: g, update, get lift() { return +lift.toFixed(3); } };
}
