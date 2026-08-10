// ══════════════════════════════════════════════════════════════════════════
//  ★★★ 광학 창 — **당겨 본다. 그리고 부서지는 것을 본다** (v79)
//
//  ★ 사장님 「멀리있는 적을 레이더 말고 **확대**하거나 그럴 방법은 없어?」
//    「**격추시 적 기체가 부서지는 화면**도 보여주고 … **3D 모습**으로」
//    「적을 **거리에 맞게 자동 확대** … 스크린에는 **거리가 표시**」
//    「**상대 우주선의 전투력**도 표시되고 **우리 비행기의 전투력 차이**」
//    「**우주쓰레기면 필요한 재료나 음식이 있는지**」
//
//  ★★ **진짜 두 번째 카메라다.** 그림을 그려 흉내 내지 않는다 —
//    `WebGLRenderTarget` 에 장면을 한 번 더 그리고 그 그림을 판에 붙인다.
//    그래서 격추 장면이 **정말 그 자리에서 일어나는 3D** 다: 잔해가 돌고
//    조각이 튀는 것을 그대로 본다. 따로 만든 영상이 아니다.
//
//  ★★★ **배를 숨기고 그린다.** 광학 감지기는 선체 **밖**에 달렸다.
//    안 숨기면 판이 조종석 벽 안쪽을 비춘다 — 그리고 판 자신도 배에
//    붙어 있으므로 **판이 판을 비추는** 거울 방이 된다.
//
//  ★ 판 둘을 겹친다: 뒤는 **영상**(렌더 타깃), 앞은 **글자**(캔버스).
//    한 장에 다 그리려면 매 프레임 캔버스에 영상을 옮겨야 하는데 그건
//    GPU 에서 CPU 로 그림을 내리는 일이라 훨씬 비싸다
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { OPTIC, fovOf, readOut, blurOf, readable } from '../game/optic-table.js';
import { oddsOf } from '../game/might-table.js';

const GREEN = '#8fe6c0';
const DIM = 'rgba(143,230,192,.45)';
const WARN = '#ffcf6a';
const BAD = '#ff8a72';

const DEG = Math.PI / 180;

/** 각도와 거리 → 자리. `targets.js` · `shots.js` 와 **같은 식**이다 */
export function atOf(az, el, dist) {
  const a = az * DEG, e = el * DEG;
  return new THREE.Vector3(
    Math.sin(a) * Math.cos(e) * dist,
    Math.sin(e) * dist,
    -Math.cos(a) * Math.cos(e) * dist,
  );
}

/**
 * @param renderer  주 렌더러 — 렌더 타깃에 한 번 더 그린다
 * @param scene     주 장면
 * @param hide      그릴 때 숨길 것들 (배 · 손 …) — 배열
 * @param w,h       판의 실제 크기 (m)
 */
export function buildOptic(renderer, scene, hide, w = 0.336, h = 0.24) {
  const g = new THREE.Group();
  g.name = '광학창';

  // ── 영상 판 ──────────────────────────────────────────────
  const RW = OPTIC.w * OPTIC.rtScale, RH = OPTIC.h * OPTIC.rtScale;
  const rt = new THREE.WebGLRenderTarget(RW, RH, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  });
  const film = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: rt.texture, toneMapped: false }),
  );
  film.name = '광학영상';
  g.add(film);

  // ── 글자 판 ──────────────────────────────────────────────
  const cv = document.createElement('canvas');
  cv.width = RW; cv.height = RH;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  // ★★★ **가산 혼합이면 안 된다** (v79 · 화면으로 잡았다).
  //   처음에 조준경과 같은 규약으로 `AdditiveBlending` 을 썼다. 그런데
  //   이 판은 **글자 뒤에 어두운 띠를 깔아야** 읽힌다 — 가산에서는
  //   검은색이 「아무것도 안 더함」이라 **띠가 통째로 없는 것과 같다.**
  //   격추 순간 폭발이 하얗게 타면서 글자가 그 위에 묻혔다.
  //   조준경은 뒤가 늘 우주(검정)라 가산이 맞고, 여기는 뒤가 **영상**이다
  const skinMat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, toneMapped: false,
  });
  const skin = new THREE.Mesh(new THREE.PlaneGeometry(w, h), skinMat);
  skin.position.z = 0.001;
  g.add(skin);

  // ── 카메라 ───────────────────────────────────────────────
  // ★ **창밖 그룹의 자식으로 넣는다** (`attachTo`). 표적의 좌표가 그 그룹
  //   기준이므로, 다른 데 두면 배를 틀 때마다 좌표를 두 번 옮겨야 하고
  //   그 두 번 중 한 번은 반드시 틀린다 (v69 의 `inCone` 이 그랬다)
  const cam = new THREE.PerspectiveCamera(fovOf(1), OPTIC.w / OPTIC.h, 0.5, 900);

  /** 지금 비추는 자리 (창밖 그룹 기준) */
  const aim = new THREE.Vector3(0, 0, -100);
  let zoom = 1;
  let shown = 1;

  /** 격추 되감기 — 남은 시간 */
  let dead = 0;
  let deadInfo = null;

  function attachTo(outGroup) { outGroup.add(cam); }

  // ══ ★★★ **전체 화면 — 조준 포드처럼** (v79) ═══════════════════════
  //  사장님이 참고 화면을 주셨다: 실제 전투기의 **TPOD(조준 포드) 영상**이
  //  화면을 가득 채우고, 십자선과 모서리 괄호와 글자만 얹혀 있는 그림.
  //
  //  ★ 작은 판과 **같은 그림·같은 글자**를 쓴다 (재질을 공유한다).
  //    두 벌로 만들면 한쪽만 고쳐지는 날이 반드시 온다 —
  //    이 저장소가 `?v=` 와 `VERSION` 으로 스무 판을 겪었다.
  //  ★★ 그리고 **공짜가 아니다**: 이걸 켜는 동안 창밖을 안 본다.
  //    뒤에서 오는 것을 못 본다는 뜻이고, 그게 이 화면의 값이다
  const bigG = new THREE.Group();
  bigG.name = '광학전체';
  bigG.visible = false;
  // ★★ **재질은 따로, 그림은 같이.** 작은 판과 재질을 공유했더니 큰 판이
  //   **투명하게 비쳤다** — 뒤의 상태창과 레이더가 그대로 들여다보였다.
  //   큰 판은 눈앞 42cm 에 있는데 조종석 계기들이 `depthWrite:false` 라
  //   깊이로는 안 가려진다. 큰 판만 `depthTest:false` + 늦게 그리기로
  //   **덮는다.** 그런데 그 설정을 공유 재질에 걸면 **작은 판이 조종석
  //   벽을 뚫고** 보인다 — 그래서 재질을 가른다 (텍스처는 한 벌 그대로)
  // ★★★ `transparent: true` 가 **꼭 필요하다** — 안 그러면 여전히 비친다.
  //   three 는 **불투명 목록을 먼저, 투명 목록을 나중에** 그린다.
  //   조종석 HUD 들은 전부 투명이라 나중에 그려지므로, 이 판이 불투명
  //   목록에 있으면 `renderOrder` 를 아무리 크게 줘도 **HUD 가 위에 온다**
  //   (renderOrder 는 같은 목록 안에서만 겨룬다). 투명으로 옮겨 놓고
  //   순서를 900 으로 줘야 비로소 **맨 위**가 된다
  const bigFilmMat = new THREE.MeshBasicMaterial({
    map: rt.texture, toneMapped: false, transparent: true,
    depthTest: false, depthWrite: false,
  });
  const bigSkinMat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, toneMapped: false, depthTest: false, depthWrite: false,
  });
  const bigFilm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bigFilmMat);
  const bigSkin = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bigSkinMat);
  bigFilm.renderOrder = 900;
  bigSkin.renderOrder = 901;
  bigSkin.position.z = 0.0006;
  bigG.add(bigFilm, bigSkin);
  let big = false;

  /** 눈(카메라)에 매단다 — 화면에 붙박이로 뜬다 */
  function attachBig(eye) {
    // ★ 가까이 둔다. 조종석 물건보다 앞이어야 **판이 계기에 가리지 않는다**
    bigG.position.set(0, 0, -0.42);
    eye.add(bigG);
  }
  function setBig(on, fovDeg = 80) {
    big = !!on;
    bigG.visible = big;
    if (!big) return;
    // 화면 높이의 86% 를 덮는다 — 가장자리로 창밖이 조금 남아야
    // 「지금 판을 보고 있다」가 읽힌다 (통째로 덮으면 화면이 바뀐 줄 안다)
    const hh = 2 * Math.tan((fovDeg / 2) * Math.PI / 180) * 0.42 * 0.86;
    bigFilm.scale.set(hh * (OPTIC.w / OPTIC.h), hh, 1);
    bigSkin.scale.copy(bigFilm.scale);
  }

  /**
   * ★ 화면을 한 번 더 그린다. **주 렌더 앞에서** 부른다.
   *   @param on 앉아 있나 — 아니면 안 그린다 (그릴 값이 없다)
   */
  function render(on) {
    if (!on && !big) return;
    const was = hide.map((o) => o && o.visible);
    for (const o of hide) if (o) o.visible = false;
    const oldT = renderer.getRenderTarget();
    cam.fov = fovOf(shown);
    cam.updateProjectionMatrix();
    cam.lookAt(cam.parent ? cam.parent.localToWorld(aim.clone()) : aim);
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.setRenderTarget(oldT);
    hide.forEach((o, i) => { if (o) o.visible = was[i]; });
  }

  /** 격추 — 이 자리를 이만큼 비춘다 */
  function killed(at, info) {
    aim.copy(at);
    dead = OPTIC.replay;
    deadInfo = info;
  }

  const line = (t, x, y, px, col = GREEN, w2 = 600) => {
    ctx.fillStyle = col;
    ctx.font = `${w2} ${px}px system-ui, sans-serif`;
    ctx.fillText(t, x, y);
  };

  /**
   * @param s {
   *   on, target:{kind,dist,az,el}|null, zoom, push, my, weapon, noLock
   * }
   */
  function redraw(s, dt = 0) {
    // ★ 전체 화면일 때는 **작은 판을 끈다** — 같은 그림이 둘이면
    //   어느 쪽을 보는지가 안 읽히고, 작은 쪽이 큰 쪽 위에 겹친다
    g.visible = !!s.on && !big;
    bigG.visible = !!s.on && big;
    if (!s.on) return;
    if (dead > 0) dead = Math.max(0, dead - dt);
    else deadInfo = null;

    // 배율은 **미끄러져 간다** — 툭 바뀌면 렌즈가 아니라 스위치다.
    // ★ 되감기 중에는 **자동에 안 맡긴다** — 폭발이 코앞이라 자동은
    //   끝까지 당기고, 그러면 판이 하얀 덩어리가 된다 (`OPTIC.killZoom`)
    zoom = dead > 0 ? OPTIC.killZoom : (s.zoom ?? 1);
    shown += Math.max(-OPTIC.ramp * dt * shown, Math.min(OPTIC.ramp * dt * shown, zoom - shown));
    if (dt === 0) shown = zoom;

    // ★ 격추 되감기가 아니면 표적을 따라간다 — **기수와 상관없이.**
    //   이것이 사장님 「타겟을 따라가니깐 **좌우에서 타겟을 따라갈 수
    //   없잔아**」의 답이기도 하다: 이 눈은 기수에 안 붙어 있다
    if (dead > 0) {
      // ★ 잔해는 밀려 나간다 — 한 점에 묶으면 곧 빈 우주를 비춘다
      if (s.deadAt) aim.copy(s.deadAt);
    } else if (s.target) {
      aim.copy(atOf(s.target.az, s.target.el, s.target.dist));
    }

    const blur = blurOf(shown, s.push ?? 0);
    const ok = readable(shown, s.push ?? 0);
    // 흐리면 영상을 죽인다 — **흐림이 값이다** (`optic-table.js`)
    const lum = ok ? 1 - blur * 0.45 : 0.14;
    film.material.color.setScalar(lum);
    bigFilmMat.color.setScalar(lum);

    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    // ★ 화면 가득일 때 **글자를 상대적으로 줄인다.** 작은 판에서 읽히는
    //   비율(판 높이의 11~13%)을 그대로 키우면 화면에서 손바닥만 해진다 —
    //   실제 조준 포드 화면의 글자가 작은 이유가 이것이다. 줄이 아니라
    //   **영상**이 주인공이어야 한다
    const ts = big ? 0.48 : 1;
    const f = (k) => Math.round(H * k * ts);

    // ★ 자리는 **비율로** 잡는다. 화소로 적어 두면 `rtScale` 을 올리는
    //   순간 여백만 반으로 줄어 글자가 테두리에 붙는다
    const mx = W * 0.045, top = H * 0.10, bot = H * 0.045;

    // ── 테두리 · 모서리 괄호 ────────────────────────────
    ctx.strokeStyle = 'rgba(143,230,192,.30)';
    ctx.lineWidth = Math.max(2, H * 0.006);
    ctx.strokeRect(2, 2, W - 4, H - 4);
    const c = H * 0.085;
    ctx.strokeStyle = GREEN; ctx.lineWidth = Math.max(2, H * 0.009);
    for (const [x, y, sx, sy] of [
      [mx * 0.5, mx * 0.5, 1, 1], [W - mx * 0.5, mx * 0.5, -1, 1],
      [mx * 0.5, H - mx * 0.5, 1, -1], [W - mx * 0.5, H - mx * 0.5, -1, -1],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x, y + sy * c); ctx.lineTo(x, y); ctx.lineTo(x + sx * c, y);
      ctx.stroke();
    }

    // ── 윗줄: 광학 · 배율 · 거리 ────────────────────────
    line('광학', mx, top, f(0.072), DIM);
    line(`${shown.toFixed(1)}배`, mx + f(0.20), top, f(0.078), GREEN, 700);
    if (s.target) {
      ctx.textAlign = 'right';
      line(`${Math.round(s.target.dist)}m`, W - mx, top, f(0.092), GREEN, 700);
      ctx.textAlign = 'left';
    }

    // ── 십자선 ──────────────────────────────────────────
    const cx = W / 2, cy = H / 2;
    ctx.strokeStyle = 'rgba(143,230,192,.6)';
    ctx.lineWidth = Math.max(2, H * 0.006);
    const g0 = H * 0.045, g1 = H * 0.105;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * g0, cy + dy * g0);
      ctx.lineTo(cx + dx * g1, cy + dy * g1);
      ctx.stroke();
    }

    // ── 흐림 ────────────────────────────────────────────
    if (!ok) {
      ctx.fillStyle = 'rgba(255,207,106,.16)';
      const step = Math.max(4, H * 0.017);
      for (let i = 0; i < H; i += step) ctx.fillRect(0, i, W, step * 0.4);
      ctx.textAlign = 'center';
      line('기동 중 — 상이 흔들립니다', cx, cy - H * 0.16, f(0.085), WARN, 700);
      ctx.textAlign = 'left';
    }

    // ── 아랫줄 ──────────────────────────────────────────
    // ★ **어두운 띠**를 깐다. 뒤가 폭발이면 글자가 통째로 묻힌다
    const bandH = H * (big ? 0.20 : 0.32);
    const y0 = H - bandH;
    ctx.fillStyle = 'rgba(3,9,8,.72)';
    ctx.fillRect(0, y0, W, bandH);
    ctx.fillStyle = 'rgba(143,230,192,.22)';
    ctx.fillRect(0, y0, W, Math.max(1, H * 0.004));
    const r1 = y0 + bandH * 0.36;
    const r2 = y0 + bandH * 0.68;
    const r3 = y0 + bandH * 0.95;

    if (dead > 0 && deadInfo) {
      // ★★★ **격추** — 이 판이 지금 비추는 것은 부서지는 그 물건이다
      line('격추', mx, r1, f(0.10), WARN, 800);
      line(deadInfo.name ?? '', mx + f(0.30), r1, f(0.088), GREEN, 700);
      const got = [];
      if (deadInfo.loot?.weapon) got.push(`무기 +${deadInfo.loot.weapon}`);
      if (deadInfo.loot?.armor) got.push(`장갑 +${deadInfo.loot.armor}`);
      line(got.length ? `회수 — ${got.join(' · ')}` : '회수할 것이 없습니다',
        mx, r2, f(0.072), got.length ? GREEN : DIM);
      if (deadInfo.myNow) {
        line(`내 전투력 ${deadInfo.myWas} → ${deadInfo.myNow}`, mx, r3, f(0.070), WARN, 700);
      }
    } else if (!s.target) {
      line(s.noLock ?? '겨눌 것이 없습니다', mx, r1, f(0.080), DIM);
    } else {
      const r = readOut(s.target.kind);
      line(r?.name ?? '?', mx, r1, f(0.095), GREEN, 700);
      if (r?.foe) {
        // ★★ **전투력 · 내 것 · 견줌** — 이 줄이 「붙을까 지나칠까」다
        const o = oddsOf(s.my ?? 0, r.might);
        const col = o.tone === 'good' ? GREEN : (o.tone === 'warn' ? WARN : BAD);
        line(`전투력 ${r.might}  ·  나 ${s.my ?? '?'}`, mx, r2, f(0.072), DIM);
        ctx.textAlign = 'right';
        line(o.word, W - mx, r1, f(0.105), col, 800);
        ctx.textAlign = 'left';
        line(o.what.replace(/\*\*/g, ''), mx, r3, f(0.064), col);
      } else if (r) {
        // 쓰레기 — **든 것**을 말한다
        line(r.has.length ? r.has.join(' · ') : '쓸 것이 없습니다',
          mx, r2, f(0.078), r.has.length ? GREEN : DIM, 700);
        line(r.what.replace(/\*\*/g, ''), mx, r3, f(0.064), DIM);
      }
    }
    tex.needsUpdate = true;
  }

  return {
    group: g, mesh: g, cam, attachTo, render, redraw, killed,
    attachBig, setBig,
    get big() { return big; },
    /** 검사가 읽는다 — 「지금 무엇을 몇 배로 비추나」 */
    get seen() {
      return {
        on: g.visible || bigG.visible, big, zoom: +shown.toFixed(2),
        dead: +dead.toFixed(2), deadName: deadInfo?.name ?? null,
        aim: { x: +aim.x.toFixed(1), y: +aim.y.toFixed(1), z: +aim.z.toFixed(1) },
      };
    },
  };
}
