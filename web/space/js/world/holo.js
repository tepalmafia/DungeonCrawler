// ══════════════════════════════════════════════════════════════════════════
//  홀로그램 — **늘 보이는 유일한 계기.** 손목 장치를 갈아 끼운 것이다.
//
//  ★ 왜 손목을 걷어냈나 (2026-08-04 · 사장님)
//    「손목 시계가 아닌 플레이에 방해가 안 되는 곳에 홀로그램 스크린이
//     있는 것으로 다시 바꿔줘」
//
//    맞는 말이다. 손목 장치는 **까만 판때기**라 뒤가 안 보였다 — 왼쪽 아래
//    구석이라 해도 통로 왼쪽 벽과 문을 가렸다. 그리고 손목에 차는 물건은
//    **손이 있어야** 말이 되는데 우리는 손을 안 만들고 있었으므로,
//    허공에 떠 있는 검은 상자가 됐다.
//
//  ★ 홀로그램이 이 게임에 더 맞는 이유
//    **뒤가 비친다.** 그게 「방해가 안 되는 곳」의 진짜 답이다 — 자리를
//    옮기는 게 아니라 **가리지 않게** 만드는 것이다. 글자만 빛나고 배경이
//    없으므로 벽도 문도 그대로 보인다.
//
//    그리고 이 배에는 이미 홀로그램 문법이 있다 — 조종석 화면 다섯, 해도대,
//    진단대가 전부 청록으로 빛나는 캔버스다. 홀로그램은 **그 계열의 막내**라
//    새 문법을 하나 더 만들지 않는다.
//
//  ★ 여전히 HUD 가 아니다
//    화면에 얹은 그림이 아니라 **카메라에 매달린 3D 판**이다. 방의 안개를
//    그대로 받고, 기울어지고, 어깨 투사기에서 나온 빛줄기가 같이 뜬다.
//    조준점 말고 화면에 그리는 것은 여전히 없다 (PLAN §5-2).
//
//  ★ 뜨는 내용은 안 바뀌었다
//    「지금 할 일 하나」와 「내가 고친 것」뿐이다. 배의 상태(거리·자국·항로·
//    마모)는 여전히 방이 갖는다 — 그 선은 game/wrist-table.js 가 지키고
//    tools/space-wrist.js 가 묻는다. **그릇만 바꾼 것이지 규칙은 그대로다.**
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { WRIST } from '../game/wrist-table.js';

const FG = '#8fe8c4';
const DIM = 'rgba(143,232,196,.34)';
const HOT = '#ffb08a';

// 판 크기(월드 단위) — 눈앞 0.62m 에 뜬다
const PW = 0.30, PH = 0.15;

export function buildHolo(camera) {
  const g = new THREE.Group();
  g.name = '홀로그램';
  camera.add(g);

  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;

  // ★ **더하기 합성(AdditiveBlending)** 이 홀로그램의 전부다.
  //   보통 합성으로 그리면 까만 바탕이 그대로 화면을 덮어 손목 장치와
  //   똑같아진다. 더하기는 **검정이 곧 투명**이라, 글자만 남고 뒤가 비친다.
  //   그래서 캔버스 바탕을 안 칠한다 (지우기만 한다).
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(PW, PH),
    new THREE.MeshBasicMaterial({
      map: tex, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    }),
  );
  // ★ `depthTest: false` — 벽 뒤에 파묻히면 안 된다. 홀로그램은 **내 장비**라
  //   방의 물건에 가려지는 순간 「방에 붙은 화면」으로 읽힌다
  screen.renderOrder = 999;
  g.add(screen);

  // 투사기에서 올라오는 빛줄기 둘 — **어디서 나온 빛인지**가 보여야
  // 허공에 뜬 글자가 아니라 장치가 쏜 것으로 읽힌다
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x4fd8b0, transparent: true, opacity: 0.10,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  for (const sx of [-1, 1]) {
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(0.012, PH * 1.5), beamMat);
    beam.position.set(sx * PW * 0.46, -PH * 0.55, 0.004);
    beam.rotation.z = sx * 0.30;
    beam.renderOrder = 998;
    g.add(beam);
  }

  let sig = null, flick = 0;
  function draw(s) {
    const now = `${s.job?.text}|${s.job?.urgent}|${s.fixed}|${(s.log ?? []).join()}|${s.raised}`;
    // 급할 때는 깜빡이므로 매 프레임, 아니면 바뀔 때만 (텍스처 올리기가 비싸다)
    if (now === sig && !s.job?.urgent) return;
    sig = now;

    const w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);

    // ── 지금 할 일 — **제일 크게** ──────────────────────
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '700 46px system-ui, sans-serif';
    const txt = s.job?.text ?? '';
    // 글자 뒤에 옅은 번짐 — 밝은 벽 앞에서도 읽히게. 판을 안 깔고
    // **글자에만** 후광을 주므로 뒤는 여전히 비친다
    ctx.shadowColor = s.job?.urgent ? 'rgba(255,120,80,.85)' : 'rgba(80,230,180,.75)';
    ctx.shadowBlur = 22;
    ctx.fillStyle = s.job?.urgent ? HOT : FG;
    ctx.fillText(txt, 18, 16);
    ctx.shadowBlur = 0;

    if (s.job?.urgent) {
      ctx.fillStyle = `rgba(255,120,80,${0.30 + 0.45 * Math.abs(Math.sin(s.clock * 4))})`;
      ctx.fillRect(18, 72, w - 36, 4);
    }

    // ── 가르는 줄 ──────────────────────────────────────
    // ★ 손목 판에서 배운 것 — 「한 일」이 큰 줄 바로 밑에 붙어 있으면
    //   **지금 하라는 말로 읽힌다** (사장님 「배선 위에 공구가 어딨어?」)
    ctx.strokeStyle = 'rgba(143,232,196,.30)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(18, 90); ctx.lineTo(w - 18, 90); ctx.stroke();

    ctx.fillStyle = DIM;
    ctx.font = '600 21px system-ui, sans-serif';
    ctx.fillText(s.fixed ? `고친 것 ${s.fixed}` : '고친 것 없음', 18, 100);

    // ★ 지난 기록은 **들어 올렸을 때만** 편다. 늘 펴 두면 홀로그램이
    //   커지고, 커지면 「방해가 안 되는 곳」이 아니게 된다
    const many = s.raised;
    const rows = (s.log ?? []).slice(0, many ? WRIST.logShow : 1);
    ctx.font = '500 20px system-ui, sans-serif';
    rows.forEach((line, i) => {
      ctx.fillStyle = `rgba(143,232,196,${0.72 - i * 0.15})`;
      const t = line.length > WRIST.maxLen ? `${line.slice(0, WRIST.maxLen - 1)}…` : line;
      ctx.fillText(`✓ ${t}`, 18, 132 + i * 26);
    });
    if (!rows.length) {
      ctx.fillStyle = 'rgba(143,232,196,.24)';
      ctx.fillText('아직 아무것도', 18, 132);
    }

    // 주사선 — 홀로그램이라는 것을 말해 주는 유일한 장식. 옅게
    ctx.fillStyle = 'rgba(143,232,196,.05)';
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);

    tex.needsUpdate = true;
  }

  let lift = 0;
  function update(s, dt = 0.016) {
    lift += ((s.raised ? 1 : 0) - lift) * Math.min(1, dt / WRIST.raise);

    // ★ 자리 — **왼쪽 아래 구석.** 손목과 같은 자리인데 **뒤가 비치므로**
    //   같은 자리도 안 가린다. 들면 조금 커지고 가운데로 조금 온다
    g.position.set(-0.27 + lift * 0.07, -0.20 + lift * 0.05, -0.62 + lift * 0.10);
    g.rotation.set(-0.16 + lift * 0.10, 0.34 - lift * 0.22, 0.05 - lift * 0.04);
    g.scale.setScalar(0.92 + lift * 0.30);

    // 아주 옅은 떨림 — 홀로그램이 「투사된 것」으로 읽히는 이유의 절반이다.
    // 크게 흔들면 못 읽으니 **읽는 데 지장 없는 만큼만**
    flick += dt;
    screen.material.opacity = 0.90 + 0.06 * Math.sin(flick * 11.3);

    draw(s);
  }
  update({ job: null, log: [], fixed: 0, clock: 0, raised: false }, 1);

  return { group: g, update, get lift() { return +lift.toFixed(3); } };
}
