// ══════════════════════════════════════════════════════════════════════════
//  ★★ 주포 — **원격 포탑 + 실내 조준석** (2026-08-06 · 사장님)
//
//    「주포는 왜 우주에 덩그러니 있어? 실내에 조준석에서 조준해야지.
//      손으로 손잡이를 잡고 wasd로 조준하는 것으로. 조종석, 주포 둘 다.
//      어떻게 디자인할지 인터넷에서 참조해서 만들어」
//
//  ★ v44~v48 이 틀렸던 것
//    사다리를 타고 **배 위로 몸이 나가** 포탑에 섰다. 진공에 맨몸으로
//    서 있는 셈이었고, 무엇보다 「정비공이 배 안에서 일한다」는 전제와
//    어긋났다. 사장님 말씀이 맞다.
//
//  ★ 찾아본 것 둘 (사장님 「인터넷에서 참조해서」)
//
//    ① **B-29 중앙 사격 통제** (Sperry, 1943)
//       포탑은 기체 **밖**에 있고 사수는 **여압된 안쪽에 앉아** 관측창의
//       조준경으로 겨눈다. 포탑은 **원격**으로 돈다. 사수가 밖에 나가지
//       않는 이 구조가 사장님이 말씀하신 그림 그대로다.
//
//    ② **밀레니엄 팰컨 건너석**
//       좌석에 **손잡이 둘**이 붙어 있고 사수는 좌석째 돈다.
//       「손으로 손잡이를 잡고」가 여기서 왔다.
//
//  ★ 그래서 이 배는 이렇게 생겼다
//
//      [조종석 뒤 오른편]
//        · **좌석** — 등받이 · 방석 · 발판
//        · **손잡이 둘** — 잡으면 WASD 가 포탑을 돌린다
//        · **조준경** — 눈앞의 화면. 떠도는 것들과 십자선이 여기 뜬다
//        · **구동축** — 천장으로 올라가는 통. 「저 위 포탑과 이어져 있다」
//      [배 위]
//        · **원격 포탑** — 작다. 사람이 그 위에 안 선다
//
//  ★ **좌석은 발밑에서 잡힌다** — 앉은 채로 아래를 보면 「일어난다」.
//    v47 에서 만든 해치와 같은 규약이다. 앞을 보면 손잡이(=조준),
//    아래를 보면 좌석(=일어남). 한 손잡이가 두 일을 하면 반드시 부딪힌다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { bayPlate } from './kit.js';
import { SEAT as SEAT_AT } from '../game/gun-table.js';   // ★ 이 파일엔 이미 SEAT(재질)가 있다

/** 조준석이 서는 자리 — 조종석 뒤쪽 오른편, 들어서면 바로 보인다 */
// ★ v59 — 자리는 **표에 있다** (game/gun-table.js SEAT). 두 곳에 적으면
//   갈라진다 — 실제로 「앉으면 옮겨진다」를 만들 때 여기와 표가 어긋나면
//   사람이 좌석 옆에 앉는다
export const LADDER = { x: SEAT_AT.at.x, z: SEAT_AT.at.z };
/** 앉으면 눈높이가 이만큼 **내려간다** (m). 올라가는 것이 아니다 */
export const TURRET_RISE = -0.42;

const FRAME = new THREE.MeshStandardMaterial({ color: 0x6a727d, roughness: 0.62, metalness: 0.5 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.8, metalness: 0.3 });
const SEAT = new THREE.MeshStandardMaterial({ color: 0x3b4450, roughness: 0.9, metalness: 0.1 });
const lit = (c, i = 2.2) => new THREE.MeshStandardMaterial({
  color: c, emissive: c, emissiveIntensity: i, roughness: 0.4,
});

function box(parent, w, h, d, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.y = ry;
  parent.add(m);
  return m;
}

/**
 * 조준석 + 원격 포탑을 세운다.
 *
 * @param H 천장 높이
 * @param sight 조준경 화면 한 장 (world/gunsight.js 가 만든다)
 * @returns { group, seatHit, gripHit, gunHit, aimAt(az, el), fired(), update(dt) }
 */
export function buildTurret(parent, H, tint = 0x8fd0ff, sight = null) {
  const g = new THREE.Group();
  g.name = '조준석';
  parent.add(g);

  const { x, z } = LADDER;
  // 사람이 앉아 바라보는 쪽 — 배의 앞(-z)
  const st = new THREE.Group();
  st.position.set(x, 0, z);
  g.add(st);

  // ── 좌석 (팰컨 건너석 참조 — 등받이가 높고 손잡이가 붙는다) ──
  box(st, 0.62, 0.10, 0.56, SEAT, 0, 0.52, 0);            // 방석
  box(st, 0.62, 0.74, 0.11, SEAT, 0, 0.90, 0.30);         // 등받이
  box(st, 0.14, 0.46, 0.14, DARK, 0, 0.26, 0.10);         // 기둥
  box(st, 0.54, 0.06, 0.44, DARK, 0, 0.04, 0.02);         // 밑동
  box(st, 0.52, 0.05, 0.30, DARK, 0, 0.12, -0.42);        // 발판
  for (const sx of [-1, 1]) {
    box(st, 0.09, 0.09, 0.44, FRAME, sx * 0.34, 0.66, 0.02); // 팔걸이
  }

  // ── 손잡이 둘 — **잡으면 WASD 가 포탑을 돌린다** ──────────
  // ★ 팰컨 건너석이 정확히 이 모양이다. 손잡이가 **둘**이라야 「몸이 아니라
  //   기계를 돌린다」로 읽힌다 — 하나면 지팡이처럼 보인다
  const grips = new THREE.Group();
  grips.position.set(0, 1.04, -0.40);
  st.add(grips);
  box(grips, 0.46, 0.07, 0.07, FRAME, 0, 0, 0);            // 가로대
  for (const sx of [-1, 1]) {
    box(grips, 0.10, 0.20, 0.10, DARK, sx * 0.25, -0.03, 0);      // 손잡이
    // ★ 방아쇠 등 — **아주 약하게.** 1.6 으로 뒀더니 블룸이 먹어서
    //   손잡이가 주황 덩어리 둘로 번졌다 (화면을 찍어 보고 알았다)
    box(grips, 0.04, 0.04, 0.10, lit(0xff9a3c, 0.35), sx * 0.25, 0.10, 0);
  }
  box(st, 0.08, 0.42, 0.08, FRAME, 0, 0.80, -0.40);        // 손잡이 기둥

  // ── 조준경 — **눈앞의 화면.** 여기가 「실내에서 조준한다」의 전부다 ──
  const scope = new THREE.Group();
  scope.position.set(0, 1.30, -0.62);
  st.add(scope);
  // 차양 — 화면을 둘러싼 후드. 실제 조준경이 이렇게 생겼다 (빛을 막는다)
  box(scope, 0.72, 0.05, 0.20, DARK, 0, 0.26, 0.06);
  box(scope, 0.72, 0.05, 0.20, DARK, 0, -0.26, 0.06);
  for (const sx of [-1, 1]) box(scope, 0.05, 0.57, 0.20, DARK, sx * 0.335, 0, 0.06);
  if (sight) {
    sight.mesh.position.set(0, 0, 0.01);
    scope.add(sight.mesh);
  }
  // 화면 테 — 빛나는 띠. 어두운 데서 「여기를 본다」가 읽힌다
  box(scope, 0.74, 0.02, 0.02, lit(tint, 1.2), 0, 0.30, 0);
  box(scope, 0.74, 0.02, 0.02, lit(tint, 1.2), 0, -0.30, 0);

  // ── 구동축 — 천장으로. 「저 위 포탑과 이어져 있다」 ────────
  // ★ 이게 없으면 조준경이 그냥 또 하나의 모니터로 보인다. 밖의 포탑과
  //   **물리적으로 이어져 있다**는 것이 눈에 보여야 원격 포탑이 읽힌다
  box(st, 0.22, H - 1.5, 0.22, FRAME, 0.42, (H + 1.5) / 2 - 0.1, 0.24);
  for (let y = 1.7; y < H - 0.15; y += 0.34) {
    box(st, 0.28, 0.05, 0.28, DARK, 0.42, y, 0.24);        // 마디
  }

  // 베이 번호 — 이 배의 물건은 다 번호를 단다 (bay-table.js 규약)
  bayPlate(g, 'G-1', x - 0.55, 1.42, z + 0.1, tint);

  // ── 원격 포탑 (배 위) — **작다. 사람이 안 선다** ───────────
  const turret = new THREE.Group();
  turret.position.set(x + 0.42, H + 0.28, z + 0.24);
  g.add(turret);
  box(turret, 0.5, 0.2, 0.5, FRAME, 0, 0, 0);              // 받침
  const yawRig = new THREE.Group();
  turret.add(yawRig);
  box(yawRig, 0.34, 0.26, 0.4, DARK, 0, 0.2, 0);           // 포탑 몸
  const pitchRig = new THREE.Group();
  pitchRig.position.set(0, 0.2, 0);
  yawRig.add(pitchRig);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 1.3, 10), FRAME);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0, -0.72);
  pitchRig.add(barrel);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 10), lit(0xffb070, 0));
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 0, -1.36);
  pitchRig.add(muzzle);

  /**
   * ★ 조준선이 잡을 것 — **손잡이**(앞을 볼 때)와 **좌석**(아래를 볼 때).
   *   v47 의 주포/해치와 같은 규약이다. 겹치지 않게 자리를 확실히 가른다
   */
  // ★ **앉은 사람 눈높이(1.20)에 걸쳐야 한다.** 처음엔 0.98 에 뒀는데
  //   앉아서 앞을 보면 광선이 상자 **위로** 지나가 손잡이가 안 잡혔다 —
  //   「앉았는데 겨눌 수가 없다」였다. 눈보다 조금 아래에서 위로 걸친다
  const gripHit = box(st, 0.74, 0.58, 0.62, new THREE.MeshBasicMaterial({ visible: false }),
    0, 1.08, -0.46);
  gripHit.name = '조준 손잡이';
  /**
   * ★★ **자리를 두 번 고쳤다.** 처음엔 0.5 높이 · 0.66 깊이였는데,
   *   서서 내려다보는 각이 조금만 달라져도 안 걸렸다 (0.5 는 되고 0.75 는
   *   안 되는 식). 사람은 그렇게 정확히 안 내려다본다.
   *
   *   **깊이를 늘리는 것이 답이었다.** 높이만 키우면 앉은 사람(눈 1.20)을
   *   상자가 통째로 감싸서, 안에서 쏜 광선이 뒷면을 못 잡아 **일어날 수가
   *   없어진다.** 그래서 위끝은 1.00 에 두고(앉은 눈보다 아래) 앞뒤로 넓혔다
   */
  const seatHit = box(st, 0.80, 0.90, 0.90, new THREE.MeshBasicMaterial({ visible: false }),
    0, 0.55, 0.06);
  seatHit.name = '조준석';
  /**
   * ★★★ **상자가 하나로는 모자랐다** (2026-08-06 · 사장님 「주포 앉을수가
   *   없잔아」). 위 상자는 **앉은 사람이 아래를 볼 때**를 맞춘 것이라
   *   위끝이 1.00 이다. 그런데 **서서 다가가는 사람**의 눈은 1.62 이고,
   *   사람은 의자를 볼 때 **살짝만** 내려다본다(-10~-40도). 재 보니
   *   그 각도가 통째로 비어 있었다:
   *
   *     z=-3.6   0도 ✔ · -11도 ✘ · -23도 ✘ · -34도 ✘ · -51도 ✘
   *     z=-3.9   -23도에서는 **조종석 패널이 광선을 가로챘다**
   *
   *   높이를 키워 하나로 합칠 수가 없다 — 앉은 눈(1.20)을 감싸면 안에서
   *   쏜 광선이 뒷면을 못 잡아 **일어날 수가 없어진다** (v49 에 겪은 것).
   *   그래서 **서 있을 때만 쓰는 상자**를 따로 둔다. 등받이를 감싸는
   *   크기라 살짝 내려다보든 정면으로 보든 걸린다.
   */
  const standHit = box(st, 1.10, 1.40, 1.20, new THREE.MeshBasicMaterial({ visible: false }),
    0, 0.95, -0.05);
  standHit.name = '조준석 (서서)';

  let flash = 0;
  return {
    group: g,
    /** 앉은 뒤 **아래를 볼 때** 잡히는 것 — 일어나는 길 */
    seatHit,
    /** ★ **서서 다가갈 때** 잡히는 것. 앉으면 main.js 가 무시한다 */
    standHit,
    /** 앉은 뒤 앞을 보면 잡히는 것 — 잡고 WASD 로 겨눈다 */
    gripHit,
    /** 옛 이름 — main.js 가 아직 쓰는 자리가 있어 남겨 둔다 */
    ladderHit: seatHit,
    hatchHit: seatHit,
    gunHit: gripHit,
    /**
     * ★ **포탑이 겨누는 쪽** — 방위·고도(도). 사람이 보는 쪽이 아니라
     *   WASD 가 만든 값이다. 그래야 「실내에서 원격으로 돌린다」가 된다
     */
    aimAt(az = 0, el = 0) {
      yawRig.rotation.y = -az * Math.PI / 180;
      pitchRig.rotation.x = el * Math.PI / 180;
    },
    /** 쐈다 — 총구가 잠깐 밝아진다 */
    fired() { flash = 0.18; },
    update(dt) {
      if (flash > 0) {
        flash = Math.max(0, flash - dt);
        muzzle.material.emissiveIntensity = flash * 24;
      }
    },
  };
}
