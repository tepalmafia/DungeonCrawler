// ══════════════════════════════════════════════════════════════════════════
//  ★★★ 쏘는 것이 **날아간다** (v69 · docs/space/COMBAT.md §2-②)
//
//  ★ 사장님: 「**발사 되는게 안보이잔아?**」 · 「미사일도 제작하고 **임펙트**」
//
//  ★★ v64 까지 쏘면 **숫자만 줬다.** 열이 오르고 광석이 줄고 표적의 hp 가
//    빠졌다 — 화면에서는 아무 일도 안 일어났다. 격추 게임에서 그건
//    **쏘는 맛이 아예 없는 것**이다.
//
//  ★ 셋이 **다르게 보여야** 한다. 같은 빛이 날아가면 무기를 고른 뜻이 없다:
//
//      레이저    기수에서 표적까지 **한 줄기 빛** — 즉발, 0.12초 번쩍
//      열추적탄  작은 불꽃이 **휘며** 간다 — 쏘고 잊는다
//      유도탄    **곧게** 간다 — 묶고 있는 동안만 끝까지
//
//  ★ 창밖 그룹에 매단다 — 배를 틀면 같이 흐른다 (`targets.js` 와 같은 이유)
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { flownAt, speedAt, lit, LAUNCH } from '../game/slow-table.js';

const DEG = Math.PI / 180;
/** 기수 — 탄이 나가는 자리. 조종석 유리 조금 앞 */
const MUZZLE = new THREE.Vector3(0, -0.4, -11);

const beamMat = () => new THREE.MeshBasicMaterial({
  color: 0x9cf0ff, transparent: true, opacity: 0.9,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const fireMat = (hex) => new THREE.MeshBasicMaterial({
  color: hex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
});

/** 각도와 거리 → 자리. `targets.js` 와 **같은 식**을 쓴다 */
export function atOf(az, el, dist) {
  const a = az * DEG, e = el * DEG;
  return new THREE.Vector3(
    Math.sin(a) * Math.cos(e) * dist,
    Math.sin(e) * dist,
    -Math.cos(a) * Math.cos(e) * dist,
  );
}

export function buildShots(parent) {
  const g = new THREE.Group();
  g.name = '쏜것들';
  parent.add(g);

  /** 날아가는 것들 */
  const live = [];
  let fired = 0;

  /**
   * 한 발 쏜다.
   * @param kind 'laser' | 'ir' | 'arh'
   * @param to   { az, el, dist } 표적 — 없으면 정면으로 나간다
   */
  function fire(kind, to = null) {
    fired++;
    const dst = to ? atOf(to.az, to.el, to.dist) : atOf(0, 0, 300);
    // ★★★ **어느 표적을 쫓는지 기억한다** (v79). 아래 `update` 가 매 프레임
    //   그 표적의 **지금 자리**로 종점을 고쳐 잡는다 — 이유는 update 주석에
    const chase = to?.id ?? null;
    if (kind === 'laser') {
      // ══ ★★★ v113 — **레이저를 레이저답게** ═══════════════════════════
      //
      //  ★ 사장님 「**미사일은 미사일답게 레이저는 레이저답게 나가도록**」
      //
      //  ★★ 여태 **6각 기둥 하나**였다. 지름 0.70m 짜리가 100m 를 가로질러
      //    놓이니 **각진 파이프**로 보였고, 게다가 **굵은 쪽이 표적 쪽**이라
      //    (재 봤다) 멀수록 두꺼워졌다 — 총구가 굵고 끝이 가늘어야 맞는데
      //    정반대였다.
      //
      //  ★★★ 레이저는 **속심 + 겉무리** 둘로 그린다. 하나짜리 기둥으로는
      //    「밝은 빛」이 안 난다 — 불투명도를 올리면 파이프가 되고,
      //    내리면 안 보인다. 둘로 나누면 **가운데는 하얗게 타고 둘레는
      //    번지는** 진짜 빔의 생김새가 된다.
      //  ★ 그리고 **각을 12 로** 올렸다. 6각은 옆에서 보면 각이 보인다
      // ══ ★★★ v113 ② — **화면을 찍어 보고 다시 고쳤다** ═══════════════
      //
      //  처음 고칠 때 「총구가 굵고 끝이 가늘어야 한다」고 정하고 도구까지
      //  그렇게 적었다. **뼈대 검사는 초록이었고, 화면은 아니었다** —
      //  1인칭이라 **총구 단면을 정면으로 들여다보게** 되어, 0.84m 짜리
      //  단면이 2.5m 앞에 있으니 **19도를 덮는 큰 다각형**이 됐다.
      //  「뼈대만 재는 검사는 절반」이라는 이 저장소의 규약 그대로다.
      //
      //  ★★ 그래서 둘을 고친다:
      //    ① **굵기를 고르게** — 총구 쪽을 가늘게 한다. 빔은 원래 평행하다
      //    ② **눈에서 떨어뜨려 시작** — 조종석 유리 너머부터 긋는다.
      //       그러면 단면을 들여다볼 일이 아예 없다
      const NEAR = 9;                       // 눈에서 이만큼 앞에서 시작한다
      const dir = dst.clone().sub(MUZZLE).normalize();
      const from = MUZZLE.clone().addScaledVector(dir, NEAR);
      const len = Math.max(1, from.distanceTo(dst));
      const beam = new THREE.Group();
      // 속심 — 아주 가늘고 거의 하얗다. **고르다** (빔은 평행하다)
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, len, 12),
        new THREE.MeshBasicMaterial({
          color: 0xeafcff, transparent: true, opacity: 0.95,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      // 겉무리 — 넓고 옅다. 속심을 감싸 **번지게** 한다
      const halo = new THREE.Mesh(
        new THREE.CylinderGeometry(0.20, 0.20, len, 12),
        new THREE.MeshBasicMaterial({
          color: 0x5fd0ff, transparent: true, opacity: 0.30,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      beam.add(core, halo);
      beam.position.copy(from.clone().lerp(dst, 0.5));
      beam.lookAt(dst);
      // ★ 기둥의 축은 로컬 +Y — `lookAt` 뒤 앞은 −Z 이므로 −90도로 돌린다
      beam.rotateX(-Math.PI / 2);
      g.add(beam);
      live.push({ m: beam, kind, t: 0, live: 0.12, beam: true, core, halo });
      // ★ 레이저의 몫 — **슬로우 대신 임펙트** (v84)
      muzzle(0x9cf0ff, 0.7, dir);
      return;
    }
    // ══ ★★★ v84 — **미사일 · 사출되어 나가고 점화되어 멀어진다** ═══════
    //  몸통 + **꼬리 불** + 배기. 불은 **처음엔 꺼져 있다** (사출 중) —
    //  그 대비가 「밀려 나갔다가 붙었다」를 글자 없이 알려 준다
    // ══ ★★★ v113 — **미사일을 미사일답게** ═══════════════════════════
    //
    //  ★ 사장님 「**미사일이 모양이 이상하게 나간다** … 미사일은 미사일답게」
    //
    //  ★★ 재 보니 **불이 코 앞에 붙어 있었다.** `lookAt` 은 −Z 를 앞으로
    //    돌려세우는데, 불과 배기를 **+z** 에 뒀다. 그래서 화염이 미사일보다
    //    1.1m 앞서 가고, 5m 짜리 배기 원뿔이 3.2m **앞으로** 뻗었다 —
    //    「이상한 모양」의 정체가 이것이다.
    //  ★ 그리고 몸통은 **맞게** 서 있었다 (재서 확인했다). 짐작으로
    //    「거꾸로겠지」 하고 뒤집었으면 멀쩡한 것을 망칠 뻔했다
    const s = new THREE.Group();
    // ══ ★★★ v113 — **몸통이 안 보이고 있었다** ═══════════════════════
    //
    //  화면을 찍어 보고 알았다: 미사일 자리에 **주황 점 하나**뿐이었다.
    //  까닭은 `MeshStandardMaterial` 이다 — 우주에는 **빛이 없어서**
    //  물질 셰이더가 통째로 **까맣게** 나온다. 즉 몸통은 늘 있었는데
    //  **한 번도 보인 적이 없고**, 눈에 남는 것은 불뿐이었다.
    //  그 불이 v112 까지 **코 앞에** 붙어 있었으니, 사장님 눈에는
    //  「몸도 없이 불덩이가 날아가는」 것으로 보였을 것이다.
    //
    //  ★ 그래서 **스스로 빛나게** 한다 (`emissive`). 빛을 새로 세우지
    //    않는다 — 조명 하나를 늘리면 배 안까지 밝아진다.
    //  ★★ 그리고 **크게** 한다. 1.5m 짜리는 20m 만 가도 25화소다.
    //    실제 대함 미사일이 4~5m 이므로 **고증에도 이쪽이 맞다**
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.26, 3.0, 4, 10),
      new THREE.MeshStandardMaterial({
        color: 0xc8ccd4, roughness: 0.45, metalness: 0.5,
        emissive: 0x6a7180, emissiveIntensity: 1,
      }),
    );
    body.rotation.x = Math.PI / 2;      // 축 +Y → 로컬 +Z. lookAt 뒤 앞(−Z)을 본다
    s.add(body);
    // ★ 꼬리날개 넷 — 미사일로 읽히는 것은 사실 **이것**이다.
    //   원통 하나는 어느 쪽이 앞인지 모른다
    const finMat = new THREE.MeshStandardMaterial({
      color: 0x9aa1ab, roughness: 0.6, metalness: 0.4,
      emissive: 0x4e545e, emissiveIntensity: 1,   // ★ 같은 까닭 — 빛이 없다
    });
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.05, 0.6), finMat);
      // ★★ 재 보니 **로컬 +z 가 앞**이었다 (`lookAt` 뒤 −Z 가 앞이고,
      //   그룹이 그쪽을 보므로 로컬 +z 가 그리로 간다). 처음에 +0.62 로
      //   뒀다가 도구가 「앞에 붙었다」고 빨개져서 잡았다 — **짐작하지
      //   말고 재라**는 것이 이 판의 전부다
      fin.position.z = -1.25;                   // 로컬 −z = **뒤쪽**
      fin.rotation.z = i * Math.PI / 2;
      s.add(fin);
    }
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.30, 2.6, 10),
      fireMat(kind === 'ir' ? 0xff9a4a : 0x7ad4ff),
    );
    // ★ 원뿔의 꼭짓점은 +Y 다. **−π/2** 로 돌리면 꼭짓점이 로컬 −Z(뒤)로
    //   가서 **뒤로 뾰족해진다** — 노즐에서 굵게 나와 뒤로 가늘어지는 모양
    flame.rotation.x = -Math.PI / 2;
    flame.position.z = -3.0;                    // ★ 뒤 (v112 까지 **앞**이었다)
    // ★★ **사출 중에는 불이 없다.** 가스로 밀려 나가는 동안은 모터가
    //   안 켜져 있다 — 관 안에서 켜면 제 배를 태운다 (진공이면 더욱)
    flame.visible = false;
    s.add(flame);
    // ★ 배기 자국 — 점화 뒤에만. 진공이라 **금방 흩어진다** (짧다)
    const trail = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 7.0, 8, 1, true),
      fireMat(kind === 'ir' ? 0xff7a2a : 0x4aa8ff),
    );
    trail.material.opacity = 0.30;
    trail.rotation.x = -Math.PI / 2;
    trail.position.z = -6.4;                    // ★ 뒤 (v112 까지 **앞**이었다)
    trail.visible = false;
    s.add(trail);
    s.position.copy(MUZZLE);
    g.add(s);
    live.push({
      m: s, kind, t: 0, live: 6.0,
      from: MUZZLE.clone(), to: dst, chase,
      // ★ 열추적탄은 **휜다** — 쏘고 잊는 대신 곧게 안 간다.
      //   유도탄은 곧다 — 묶고 있어야 하는 대신 정확하다
      wobble: kind === 'ir' ? 1 : 0,
      // ★ **순항** 속도다. 지금 속도는 `speedAt` 이 정한다 (사출 14 → 순항)
      speed: kind === 'ir' ? 95 : 140,
      flame, trail,
    });
    // ★★ **사출 섬광** — 관에서 밀려 나오는 그 순간. 미사일이 아직 느려서
    //   눈앞에 있으므로, 이 빛이 없으면 「어디서 나왔는지」가 안 보인다
    muzzle(kind === 'ir' ? 0xffc890 : 0x9cd8ff, 0.9,
      dst.clone().sub(MUZZLE).normalize());
  }

  /**
   * ★★ **총구 섬광** — 쏘는 순간 기수 앞이 번쩍한다.
   *
   *   ★ 레이저는 즉발이라 **슬로우가 안 걸린다** (`slow-table.js`).
   *     빛을 느리게 날리면 v57 이후의 고증이 거짓말이 된다. 대신
   *     이 섬광으로 갚는다 — 「쐈다」가 몸으로 느껴져야 한다
   */
  function muzzle(hex, big = 1, dir = null) {
    // ══ ★★★ v113 ③ — **화면을 덮던 것이 이것이었다** ═══════════════════
    //
    //  「레이저가 이상하다」의 정체가 빔이 아니라 **여기**였다. 화면을
    //  찍어 보니 청록색 **10각 원반**이 화면 절반을 덮고 있었는데,
    //  그것은 눈앞 **1.3m** 에 놓인 반지름 0.8m 짜리 구가 0.16초 동안
    //  **5배로 부푼** 것이었다 (7×5 면이라 각도 다 보였다).
    //
    //  ★ 즉 쏠 때마다 **얼굴에 공이 씌워지고** 있었다. 뼈대 검사로는
    //    절대 안 잡힌다 — 자리도 방향도 다 맞았고, 틀린 것은 **크기와
    //    눈까지의 거리**뿐이다. 그래서 화면을 찍어야 한다.
    //
    //  ★★ 고침 셋: **작게 · 멀리 · 매끄럽게.** 그리고 섬광은 원래
    //    「총구가 번쩍」이지 「앞이 하얘짐」이 아니다
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.42 * big, 12, 8), fireMat(hex));
    m.position.copy(MUZZLE);
    // ★ 눈에서 **6m 앞** — 조종석 유리 너머다. 전에는 1.3m 였다
    if (dir) m.position.addScaledVector(dir, 6);
    else m.position.z -= 6;
    g.add(m);
    // ★ 부풀리는 배수도 5 → 2.2 (아래 `pop` 가지에서 쓴다)
    live.push({ m, kind: 'flash', t: 0, live: 0.13, pop: true, grow: 2.2 });
  }

  /** 터짐 — 맞은 자리에서 (`targets.js` 의 것과 나란히 쓴다) */
  function pop(at) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), fireMat(0xffd08a));
    m.position.copy(at);
    g.add(m);
    live.push({ m, kind: 'pop', t: 0, live: 0.35, pop: true });
  }

  /**
   * ★★★ **적탄이 날아온다** (v70). 사장님 「긴박감있고 긴장감 있고」.
   *
   *   ★ **보여야 피한다.** 규칙에 0.9초의 비행 시간을 둔 이유가 이것인데,
   *     그 0.9초 동안 화면에 아무것도 없으면 그건 없는 시간이다 —
   *     「피할 수 있었다」와 「그냥 맞았다」가 구별이 안 된다.
   *
   *   ★ 우리 탄과 **색이 반대**다. 우리 것은 푸른 계열, 적의 것은
   *     붉은 계열 — 화면에 둘이 섞여 날 때 어느 쪽이 위험한지가
   *     글자 없이 읽혀야 한다
   */
  function incoming(from, left, total) {
    const k = 1 - Math.max(0, Math.min(1, left / Math.max(0.01, total)));
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.55 + k * 0.9, 6, 5),
      fireMat(0xff4a3a),
    );
    // 멀리서 가까이 — 자리를 매 프레임 다시 준다 (규칙이 시계를 들고 있다)
    m.position.copy(from).multiplyScalar(1 - k * 0.92);
    return m;
  }
  /** 지금 날아오는 것들 — 규칙이 준 목록 그대로 다시 그린다 */
  let inGroup = new THREE.Group();
  inGroup.name = '적탄';
  g.add(inGroup);

  return {
    group: g,
    fire,
    pop,
    /**
     * ★ 규칙이 든 목록을 **통째로 다시 그린다.** 낱낱이 짝을 맞춰
     *   들고 있으면 「부순 적의 탄이 남는다」 같은 어긋남이 나는데,
     *   개수가 몇 개뿐이라 다시 그리는 편이 싸고 안 갈라진다
     */
    setIncoming(list) {
      g.remove(inGroup);
      inGroup = new THREE.Group();
      inGroup.name = '적탄';
      for (const s of list ?? []) {
        inGroup.add(incoming(atOf(s.az, s.el, s.dist), s.t, 0.9));
      }
      g.add(inGroup);
    },
    /**
     * ★★★ **날아가는 것이 표적을 따라간다** (v79).
     *
     *   ★ 사장님 「현재 **미사일이 날아가는 궤적과 적이 격추되는 지점이
     *     다르게 보이니**」 — 맞는 말이고, 원인은 여기였다.
     *
     *   v78 까지 탄은 **쏜 순간의 자리**로 곧게 날아갔다 (`to` 를 그때
     *   한 번 계산했다). 그런데 규칙(`combat.js stepShots`)은 **닿는 순간의
     *   표적**으로 맞고 안 맞고를 가른다. 표적은 그동안 흐르고 다가오므로
     *   (`target.js` 의 vaz·vel·closes) 둘이 **다른 자리**가 된다:
     *
     *     탄은 「거기 있던 자리」에서 터지고, 적은 「지금 있는 자리」에서
     *     부서진다. 사장님이 보신 것이 정확히 이것이다.
     *
     *   ★★ 유도탄이 유도탄인 이유가 이것이므로, 고침도 **말이 되는 쪽**이다:
     *     탄이 표적을 **쫓는다.** 그러면 궤적의 끝과 격추 지점이 **같은
     *     자리일 수밖에 없다** — 맞춰 놓는 것이 아니라 구조상 같아진다.
     *
     *   @param posOf (id) => Vector3|null — 지금 그 표적이 어디 있나
     */
    update(dt, posOf = null) {
      for (let i = live.length - 1; i >= 0; i--) {
        const s = live[i];
        s.t += dt;
        // ★ 쫓는다. 표적이 사라졌으면(이미 부서졌으면) 마지막 자리로 간다
        if (s.chase != null && posOf) {
          const now = posOf(s.chase);
          if (now) s.to.copy(now);
        }
        if (s.beam) {
          // 번쩍하고 사라진다 — ★ v113 부터 **속심과 겉무리 둘**이다
          const k = 1 - s.t / s.live;
          if (s.core) s.core.material.opacity = 0.95 * k;
          if (s.halo) s.halo.material.opacity = 0.28 * k;
        } else if (s.pop) {
          const k = s.t / s.live;
          // ★ v113 — 섬광은 조금만 부푼다 (2.2). 터짐은 그대로 크게 (5)
          s.m.scale.setScalar(1 + k * (s.grow ?? 5));
          s.m.material.opacity = 1 - k;
        } else {
          const dir = s.to.clone().sub(s.from);
          const total = dir.length();
          // ══ ★★★ v84 — **사출 → 점화 → 가속** (`slow-table.js flownAt`) ══
          //  `s.t * s.speed` 였다 — 처음부터 순항 속도라 「점점 가속화」가
          //  없었고, 무엇보다 **규칙(`combat.js`)이 쓰는 비행 시간과 달랐다.**
          //  이제 규칙과 화면이 **같은 함수**를 쓴다
          const gone = Math.min(1, flownAt(s.t, s.speed) / Math.max(1, total));
          s.m.position.copy(s.from).addScaledVector(dir, gone);
          if (s.wobble) {
            // 휜다 — 옆으로 흔들리며 간다.
            // ★ 사출 중에는 안 휜다 — 아직 조종면이 안 산다 (불이 없다)
            const w = lit(s.t) ? 1 : 0;
            s.m.position.x += Math.sin(s.t * 9) * 3.2 * (1 - gone) * w;
            s.m.position.y += Math.cos(s.t * 7) * 2.4 * (1 - gone) * w;
          }
          s.m.lookAt(s.to);
          // ★★ **불은 점화 뒤에만.** 그리고 **속도만큼 길어진다** —
          //   부스트가 도는 동안 꼬리가 자라는 것이 「가속」으로 읽힌다
          if (s.flame) {
            const on = lit(s.t);
            s.flame.visible = on;
            if (s.trail) s.trail.visible = on;
            if (on) {
              const k = speedAt(s.t, s.speed) / Math.max(1, s.speed);   // 0.15 → 1
              s.flame.scale.set(0.8 + Math.random() * 0.3, 0.5 + k * 1.6, 0.8 + Math.random() * 0.3);
              if (s.trail) s.trail.scale.setScalar(0.4 + k * 0.9);
            }
          }
          if (gone >= 1) {
            pop(s.m.position);
            g.remove(s.m); live.splice(i, 1);
            continue;
          }
        }
        if (s.t >= s.live) { g.remove(s.m); live.splice(i, 1); }
      }
    },
    /** 검사가 「쏘면 정말 뭔가 날아가나」를 묻는다 */
    get seen() { return { fired, live: live.length, incoming: inGroup.children.length }; },
  };
}
