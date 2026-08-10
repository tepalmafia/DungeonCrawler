// ══════════════════════════════════════════════════════════════════════════
//  ★★★ 떠도는 것들 — **창밖에 진짜로 세운다** (v69 · docs/space/COMBAT.md)
//
//  ★ 사장님: 「**발사 되는게 안보이잔아? 적 비행선도 안보이고.**
//             이젠 최고 목적은 우주 전투니깐 기획 자체를 바꿔.
//             **우주선 격추 게임으로**」
//
//  ★★★ **v64 가 전투를 만들었는데 보이는 것을 안 만들었다.**
//    레이더 · 락온 · 미사일 세 종 · 적 우주선 · 충돌 — **숫자는 다 있다.**
//    그런데 `world/` 에 적도 탄도 그리는 파일이 **없었다.** 전부 HUD
//    캔버스의 초록 글리프뿐이었고, 그래서 창밖에는 별과 바위만 있었다.
//    **격추 게임인데 격추가 안 보였다.**
//
//  ★ 자리는 **표가 이미 정해 뒀다** (`target.js` 의 az · el · dist).
//    새 숫자를 안 만든다 — 여기는 **그 값을 눈에 보이게** 할 뿐이다.
//
//  ★★ **창밖 그룹에 매단다.** 그래야 배를 틀면 같이 흐른다 — 따로 매달면
//    조종간을 틀어도 적이 안 움직이고, 그건 첫 프레임에 들킨다.
//
//  ★ 그림은 사장님이 주신다 (CLAUDE.md). 여기 도형은 **주신 그림이 올
//    때까지의 임시**다 — 그림이 오면 통째로 걷어낸다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { SEEN, WRECK, KINDS } from '../game/target-table.js';

const DEG = Math.PI / 180;

/** 금속 — 어둡고 거칠다. 우주에는 빛이 하나뿐이라 대비가 세다 */
const METAL = () => new THREE.MeshStandardMaterial({ color: 0x6a6f78, roughness: 0.72, metalness: 0.62 });
const DARKM = () => new THREE.MeshStandardMaterial({ color: 0x2f343c, roughness: 0.9, metalness: 0.3 });
const PANELM = () => new THREE.MeshStandardMaterial({ color: 0x25406b, roughness: 0.35, metalness: 0.55 });
const GLOW = (hex) => new THREE.MeshBasicMaterial({ color: hex });

/**
 * ★★ 넷을 **HUD 글리프와 같은 모양**으로 만든다.
 *   화면 속 그림과 창밖이 다르면 「같은 것인지」를 사람이 못 잇는다 —
 *   `world/gunsight.js` 의 `glyph()` 가 위성을 「몸통 + 판 둘」로 그리므로
 *   여기도 그렇게 만든다
 */
function buildOne(kind) {
  const g = new THREE.Group();
  g.name = `표적:${kind}`;
  if (kind === 'sat') {
    // 죽은 위성 — 몸통 + 태양전지판 둘
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 2.2), METAL());
    g.add(body);
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 1.5), PANELM());
      p.position.x = sx * 2.5;
      g.add(p);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.14), DARKM());
      arm.position.x = sx * 1.2;
      g.add(arm);
    }
    // 죽은 것이라 **불이 없다** — 살아 있는 것과 갈라 보여야 한다
  } else if (kind === 'tank') {
    // 버려진 연료통 — 길쭉한 통. 맞으면 크게 터진다
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 2.6, 4, 10), METAL());
    c.rotation.z = Math.PI / 2;
    g.add(c);
    for (const sx of [-1, 1]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.09, 6, 14), DARKM());
      band.rotation.y = Math.PI / 2;
      band.position.x = sx * 0.8;
      g.add(band);
    }
  } else if (kind === 'raider') {
    // ★★ **적 우주선** — 나머지는 떠 있고 **이것만 몬다.**
    //   날렵한 쐐기 + 엔진 불. 실루엣이 달라야 「저건 적이다」가 즉시 읽힌다
    const hull = new THREE.Mesh(new THREE.ConeGeometry(1.15, 4.6, 4), METAL());
    hull.rotation.x = -Math.PI / 2;      // 코가 앞(-z)을 본다
    hull.rotation.z = Math.PI / 4;
    g.add(hull);
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 1.2), DARKM());
      wing.position.set(sx * 1.5, 0, 1.1);
      wing.rotation.y = sx * 0.34;
      g.add(wing);
    }
    // 엔진 불 — **살아 있는 것**의 표시. 죽은 위성과 갈라진다
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.8, 8), GLOW(0xff7a3c));
    fire.rotation.x = Math.PI / 2;
    fire.position.z = 2.7;
    fire.name = '엔진불';
    g.add(fire);
  } else if (kind === 'fighter') {
    // ★ 요격기 — **작고 날렵하다.** 적 우주선의 축소판이 아니라 다른 실루엣:
    //   가늘고 길고 날개가 뒤로 젖혀져 있다
    const hull = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.4, 3), METAL());
    hull.rotation.x = -Math.PI / 2;
    g.add(hull);
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.10, 0.8), DARKM());
      wing.position.set(sx * 1.0, 0, 1.0);
      wing.rotation.y = sx * 0.6;
      g.add(wing);
    }
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.3, 6), GLOW(0xffb45c));
    fire.rotation.x = Math.PI / 2; fire.position.z = 2.0; fire.name = '엔진불';
    g.add(fire);
  } else if (kind === 'gunship') {
    // ★★ 포함 — **덩어리다.** 두껍고 각지고 포탑이 붙어 있다.
    //   실루엣이 무거워야 「저건 미사일을 써야겠다」가 눈으로 읽힌다
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 5.6), METAL());
    g.add(hull);
    for (const sz of [-1.4, 1.4]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.7, 8), DARKM());
      t.position.set(0, 1.1, sz);
      g.add(t);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 6), DARKM());
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 1.1, sz - 1.1);
      g.add(barrel);
    }
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 8), GLOW(0xff7a3c));
    fire.rotation.x = Math.PI / 2; fire.position.z = 3.4; fire.name = '엔진불';
    g.add(fire);
  } else if (kind === 'drone') {
    // ★★ 자폭정 — **작고 밝다.** 몸이 탄이라 「빨갛게 달아오른 것」이 온다.
    //   작아서 늦게 보이는 것이 이 적의 전부이므로 **빛으로** 알린다
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), METAL());
    g.add(body);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), GLOW(0xff3a2a));
    glow.name = '엔진불';
    g.add(glow);
  } else if (kind === 'turret') {
    // ★ 방공 포대 — **안 움직인다.** 바닥판 + 포신. 떠 있는 것과 달리
    //   각이 안 변하므로 실루엣이 늘 같다
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 0.8, 8), METAL());
    g.add(base);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), DARKM());
    head.position.y = 0.8;
    g.add(head);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.0, 6), DARKM());
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.8, -1.6);
    g.add(barrel);
  } else if (kind === 'convoy') {
    // ★★★ 보급 호송선 — **크고 둔하고 안 쏜다.** 화물통을 줄줄이 매달았다.
    //   생김새가 「저건 싸우러 온 게 아니다」를 말해야, 놓쳤을 때 아깝다
    const spine = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 7.0), METAL());
    g.add(spine);
    for (const sz of [-2.0, 0, 2.0]) {
      for (const sx of [-1, 1]) {
        const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 1.6, 3, 8), PANELM());
        pod.rotation.x = Math.PI / 2;
        pod.position.set(sx * 1.5, 0, sz);
        g.add(pod);
      }
    }
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 8), GLOW(0x9ad4ff));
    fire.rotation.x = Math.PI / 2; fire.position.z = 4.2; fire.name = '엔진불';
    g.add(fire);
  } else {
    // 파편 — 부순 금속. 불규칙해야 「부서진 것」으로 읽힌다
    const r = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), METAL());
    r.scale.set(1, 0.62, 1.35);
    g.add(r);
    const chip = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.7), DARKM());
    chip.rotation.set(0.4, 0.8, 0.3);
    g.add(chip);
  }
  return g;
}

/**
 * 떠도는 것들을 창밖에 세운다.
 *
 * @param parent 창밖 그룹 — **여기 매달아야 배를 틀 때 같이 흐른다**
 * @returns { update(list, dt), burst(t) }
 */
export function buildTargets(parent) {
  const g = new THREE.Group();
  g.name = '떠도는것들';
  parent.add(g);

  /** id → { group, kind } */
  const live = new Map();
  /** 터진 조각들 */
  const bits = [];
  // ══ ★★★ **잔해 — 격추가 보인다** (v79) ═══════════════════════════
  //
  //  ★ 사장님 「**격추시 적 기체가 부서지는 화면**도 보여주고 … 3D 모습으로」
  //
  //  ★★ v78 까지 격추는 **한 프레임짜리**였다: 규칙이 목록에서 빼면 여기서
  //    조각을 튀기고 몸통을 **그 자리에서 지웠다.** 즉 「부서졌다」가 아니라
  //    **「없어졌다」**였다. 조각 여덟 개가 0.35초 튀는 것이 전부였고,
  //    그 사이 몸통은 이미 사라진 뒤라 **무엇이 부서졌는지 안 보인다.**
  //
  //  ★★★ 이제 몸통이 **남는다.** 제어를 잃고 돌면서 밀려나고, 불이 붙고,
  //    조각이 떨어져 나간 뒤에 스러진다. 광학 창이 이 잔해를 비춘다 —
  //    그러니 이것은 「격추 영상」이 아니라 **진짜 그 자리에서 도는 3D** 다
  const wrecks = [];

  /**
   * ★★ **각도와 거리를 자리로 바꾼다.** 표가 도(度)로 적어 두었으므로
   *   여기서 한 번만 옮긴다 — 두 곳에서 옮기면 화면과 계기가 갈라진다.
   *   기수가 −z 이므로 방위각은 그 둘레의 회전이다
   */
  const place = (o, t) => {
    const az = t.az * DEG, el = t.el * DEG;
    const d = t.dist;
    o.position.set(
      Math.sin(az) * Math.cos(el) * d,
      Math.sin(el) * d,
      -Math.cos(az) * Math.cos(el) * d,
    );
    // ══ ★★★ **멀어도 점이 되지 않는다** (v79 · `target-table.js SEEN`) ══
    //
    //  ★ 사장님 「적을 **육안으로 식별할 수 있는 거리가 너무 짧잔아**」.
    //    재 보니 요격기가 90m 에서 0.92°(8픽셀), 260m 에서 0.32°(3픽셀)였다.
    //    레이더는 260m 를 보는데 **눈은 90m 까지만** 형태를 알았다 —
    //    「레이더는 잡았다는데 창밖은 비어 있다」가 그것이다.
    //
    //  ★★ 각지름에 **바닥**을 깐다. 멀어져도 그 아래로는 안 줄어드므로
    //    **점이 아니라 실루엣**으로 남는다. 크기로 거리를 읽는 대신
    //    **모양으로 종류를 읽게** 된다 — 거리는 레이더가 숫자로 말한다.
    //
    //  ★ 일부러 접는 것이다 (실제로는 멀면 점이다). 이 게임은 교전 거리를
    //    이미 100m 스케일로 접어 놨고, 그 접힘의 뒷값을 여기서 치른다
    const base = (KINDS[t.kind]?.size ?? 1) * 1.6;
    const deg = 2 * Math.atan(base / 2 / Math.max(1, d)) / DEG;
    const up = Math.min(SEEN.maxUp, Math.max(1, SEEN.minDeg / Math.max(1e-3, deg)));
    o.scale.setScalar(base * up);
    // 적은 **이쪽을 본다** — 죽은 것과 갈라지는 두 번째 표시
    // ★ 살아 있는 것은 **이쪽을 본다** — 죽은 것과 갈라지는 두 번째 표시.
    //   방공 포대만 빼고 (붙박이라 안 돈다)
    if (KINDS[t.kind]?.closes !== undefined || KINDS[t.kind]?.shoots) {
      if (t.kind !== 'turret') {
        o.lookAt(0, 0, 0);
        // ══ ★★★ **적이 뒤로 날아오고 있었다** (v79 · 화면으로 잡았다) ══
        //
        //  three 의 `Object3D.lookAt` 은 **+Z 를** 바라보는 점으로 돌린다
        //  (카메라만 −Z 다 — 소스에서 `isCamera` 로 갈린다). 그런데 이
        //  파일의 몸통들은 전부 **코가 −z** 를 보게 지어져 있다
        //  (`buildOne` 의 「코가 앞(-z)을 본다」). 그래서 v69 부터 지금까지
        //  **모든 적이 등을 돌린 채 다가오고 있었다.**
        //
        //  ★★ 그리고 그게 「안 보인다」의 한 조각이었다: 이쪽을 향한 것이
        //    실루엣이 아니라 **엔진 불꽃 원뿔의 밑면**이라, 화면에는
        //    주황색 팔각형 한 덩어리로 떴다. 종류가 다섯이든 여덟이든
        //    **전부 같은 주황 덩어리**로 보인 것이다.
        //
        //  ★ 검사는 이걸 못 잡는다 — 「창밖에 요격기가 있나」는 ✔ 였다.
        //    **화면을 찍어서** 나왔다 (CLAUDE.md 포스트모템 §3)
        o.rotateY(Math.PI);
      }
    }
  };

  /** 터짐 — 조각이 튄다. 「맞았나」를 숫자로 안 알려준다 */
  function burst(at, big = false) {
    const n = big ? 14 : 8;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        new THREE.TetrahedronGeometry(big ? 0.55 : 0.34, 0),
        GLOW(i % 3 === 0 ? 0xffd27a : 0xff8a4a),
      );
      m.position.copy(at);
      const s = (big ? 26 : 16) * (0.4 + Math.random());
      bits.push({
        m,
        v: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
          .normalize().multiplyScalar(s),
        t: 0, live: big ? 1.5 : 1.0,
      });
      g.add(m);
    }
  }

  let clock = 0;
  return {
    group: g,
    burst,
    /**
     * @param list `SPACE.sky.list` 와 같은 것 — { id, kind, az, el, dist, hp }
     */
    update(list, dt) {
      clock += dt;
      const seen = new Set();
      for (const t of list ?? []) {
        seen.add(t.id);
        let o = live.get(t.id);
        // ══ ★★ **종류가 바뀌면 다시 짓는다** (2026-08-08) ═══════════════
        //
        //  `live` 는 **id 로만** 찾고 있었다. 그래서 같은 id 의 `kind` 가
        //  바뀌어도 실루엣이 **영영 처음 것**이었다 — 「데이터는 요격기인데
        //  화면은 파편」인 상태가 조용히 성립했다.
        //
        //  ★ `space-endtoend [6c]②` 가 이걸 잡았다. 검사가
        //    `SPACE.putTarget('raider')` 로 종류를 바꿔 놓고 「적 우주선이
        //    창밖에 있나」를 물었는데 늘 없었다. **구멍이 거짓말을 하고
        //    있었던 것**이지 창밖이 고장 난 게 아니었다.
        //
        //  ★★ 그리고 이건 검사만의 일이 아니다 — 앞으로 어디서든 종류를
        //    바꾸면 화면이 따라와야 한다. 고칠 자리는 구멍이 아니라 **여기**다
        if (o && o.name !== `표적:${t.kind}`) { g.remove(o); live.delete(t.id); o = null; }
        if (!o) {
          o = buildOne(t.kind);
          // ★ 크기는 표가 정한다 (`KINDS[kind].size`) — 조준 허용각과 **같은
          //   값**을 쓴다. 눈에 큰 것이 맞히기도 쉬워야 한다
          const k = KINDS[t.kind];
          o.scale.setScalar((k?.size ?? 1) * 1.6);
          g.add(o);
          live.set(t.id, o);
        }
        place(o, t);
        // 떠 있는 것은 천천히 돈다 — 멈춰 있으면 그림으로 보인다
        if (!KINDS[t.kind]?.shoots && !KINDS[t.kind]?.rams) {
          o.rotation.x += dt * 0.22;
          o.rotation.z += dt * 0.15;
        } else {
          const fire = o.getObjectByName('엔진불');
          if (fire) fire.scale.setScalar(0.8 + Math.sin(clock * 14) * 0.25);
        }
      }
      // 사라진 것 — **터뜨리고** 잔해로 넘긴다
      for (const [id, o] of [...live]) {
        if (seen.has(id)) continue;
        // ★ v70 — **큰 것이 크게 터진다.** 종류가 다섯으로 늘었으므로
        //   이름을 손으로 견주지 않고 **표의 크기**로 정한다
        const kk = o.name.replace('표적:', '');
        const big = (KINDS[kk]?.size ?? 1) >= 1.15;
        burst(o.position, big);
        live.delete(id);
        // ★★ **몸통을 안 지운다** — 제어를 잃고 돌면서 스러진다
        wrecks.push({
          m: o, kind: kk, t: 0,
          live: big ? WRECK.big : WRECK.small,
          spin: new THREE.Vector3(
            (Math.random() - 0.5) * WRECK.spin,
            (Math.random() - 0.5) * WRECK.spin,
            (Math.random() - 0.5) * WRECK.spin,
          ),
          v: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
            .normalize().multiplyScalar(WRECK.push * (0.5 + Math.random())),
          // 두 번째 폭발이 **조금 늦게** 온다 — 한 번에 다 터지면 「터졌다」가
          // 순간이고, 늦은 하나가 있어야 「부서지는 중」이 된다
          again: WRECK.again,
        });
      }
      // ── 잔해 ────────────────────────────────────────────
      for (let i = wrecks.length - 1; i >= 0; i--) {
        const wk = wrecks[i];
        wk.t += dt;
        wk.m.position.addScaledVector(wk.v, dt);
        wk.m.rotation.x += wk.spin.x * dt;
        wk.m.rotation.y += wk.spin.y * dt;
        wk.m.rotation.z += wk.spin.z * dt;
        // 엔진 불은 **꺼진다** — 죽은 것과 산 것을 가르는 표시
        const fire = wk.m.getObjectByName('엔진불');
        if (fire) fire.scale.setScalar(Math.max(0.01, 1 - wk.t * 3));
        if (wk.again > 0) {
          wk.again -= dt;
          if (wk.again <= 0) burst(wk.m.position, false);
        }
        const k = 1 - wk.t / wk.live;
        // 끝에 가서 **쪼그라들며** 사라진다. 그냥 지우면 「없어졌다」로 돌아간다
        if (k < 0.3) wk.m.scale.multiplyScalar(Math.max(0.86, 1 - dt * 2.6));
        if (wk.t >= wk.live) { g.remove(wk.m); wrecks.splice(i, 1); }
      }
      // 조각들
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        b.t += dt;
        b.m.position.addScaledVector(b.v, dt);
        b.m.rotation.x += dt * 6; b.m.rotation.y += dt * 4;
        const k = 1 - b.t / b.live;
        b.m.scale.setScalar(Math.max(0.01, k));
        if (b.t >= b.live) { g.remove(b.m); bits.splice(i, 1); }
      }
    },
    /**
     * ★★ **가장 늦게 생긴 잔해의 자리** — 광학 창이 여기를 비춘다.
     *   자리를 여기서 주는 이유: 잔해는 규칙에 없는 물건이라 (규칙은 이미
     *   지웠다) **화면만 아는 값**이다. 밖에서 좌표를 다시 계산하면
     *   두 벌이 되고, 두 벌은 반드시 갈라진다
     */
    lastWreck() {
      const wk = wrecks[wrecks.length - 1];
      return wk ? wk.m.position.clone() : null;
    },
    /** 지금 이 id 의 물건이 어디 있나 — 날아가는 탄이 따라간다 */
    posOf(id) {
      const o = live.get(id);
      return o ? o.position.clone() : null;
    },
    /** 검사가 「창밖에 정말 있나」를 묻는다 */
    get seen() {
      return {
        n: live.size, kinds: [...live.values()].map((o) => o.name), bits: bits.length,
        // ★ v79 — 검사가 「격추가 **보이나**」를 물으려면 잔해가 세어져야 한다
        wrecks: wrecks.length,
      };
    },
  };
}
