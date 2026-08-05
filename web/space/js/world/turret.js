// ══════════════════════════════════════════════════════════════════════════
//  주포 — **조종석 위로 올라가는 자리** (사장님 요청 · game/gun-table.js)
//
//  ★ 왜 조종석 위인가
//    사장님이 「조종석 위로 올라가는」이라고 하셨고, 그게 배의 모양과도
//    맞는다 — 조종석은 배의 **앞머리**라 시야가 트인 유일한 곳이다.
//    기관실 위에 달면 엔진 뒤로 아무것도 안 보인다.
//
//  ★ **사다리는 보여야 한다**
//    이 저장소가 세 번 밟은 함정이 「되는데 안 보이는」 것이다
//    (크랭크가 벽에 파묻힘 · 조종간이 좌석 뒤에 숨음 · 패널이 랙에 겹침).
//    그래서 사다리는 **통로에서 조종석에 들어서면 바로 보이는 자리**에
//    두고, 가로대에 불을 넣어 어두운 데서도 선이 읽히게 한다.
//
//  ★ **포탑은 방이 아니다**
//    올라가면 몸이 위로 갈 뿐 새 방이 생기는 것이 아니다. 벽도 문도
//    안 만든다 — 방을 하나 더 만들면 걸어다닐 곳이 늘고, 그러면
//    「배가 좁다」가 무너진다.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { bayPlate } from './kit.js';

/** 사다리 밑동이 서는 자리 — 조종석 뒤쪽 오른편, 들어서면 바로 보인다 */
export const LADDER = { x: 2.35, z: -3.9 };
/** 포탑에 섰을 때 눈높이가 이만큼 올라간다 (m) */
export const TURRET_RISE = 1.95;

const FRAME = new THREE.MeshStandardMaterial({ color: 0x6a727d, roughness: 0.62, metalness: 0.5 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.8, metalness: 0.3 });
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
 * 사다리 + 해치 + 포탑을 세운다.
 *
 * @param H 천장 높이 — 해치가 뚫리는 자리
 * @returns { group, ladderHit, gunHit, aimAt(yaw), setUp(up) }
 */
export function buildTurret(parent, H, tint = 0x8fd0ff) {
  const g = new THREE.Group();
  g.name = '주포';
  parent.add(g);

  const { x, z } = LADDER;

  // ── 사다리 ──────────────────────────────────────────────
  // 세로대 둘 + 가로대. 벽에서 조금 띄운다 — 붙이면 손이 안 들어간다
  for (const sx of [-0.24, 0.24]) {
    box(g, 0.055, H, 0.055, FRAME, x + sx, H / 2, z);
  }
  // 가로대 — **불이 들어온다.** 어두운 데서 선이 읽혀야 「올라갈 수 있다」가 보인다
  const rungMat = lit(tint, 1.5);
  for (let y = 0.34; y < H - 0.1; y += 0.31) {
    box(g, 0.52, 0.045, 0.045, rungMat, x, y, z);
  }
  // 밑동 발판 — 「여기서부터」를 발로 안다
  box(g, 0.62, 0.05, 0.34, DARK, x, 0.03, z + 0.05);

  // ── 해치 (천장에 뚫린 자리) ─────────────────────────────
  // 천장을 실제로 뚫지는 않는다 (조종석은 캐노피라 천장 판이 없다).
  // 대신 **테**를 둘러 「여기가 구멍이다」를 말한다
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.46, 0.045, 8, 20),
    FRAME,
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, H - 0.06, z);
  g.add(ring);

  // ── 포탑 ────────────────────────────────────────────────
  // ★ 올라간 사람의 **어깨 높이**에 포신이 온다. 배 위로 삐죽 나와야
  //   「주포」로 읽히지, 천장에 붙어 있으면 환기구로 보인다
  const turret = new THREE.Group();
  turret.position.set(x, H + 0.42, z);
  g.add(turret);

  box(turret, 0.86, 0.34, 0.86, FRAME, 0, 0, 0);          // 받침
  const yawRig = new THREE.Group();
  turret.add(yawRig);
  box(yawRig, 0.5, 0.42, 0.62, DARK, 0, 0.3, 0);          // 포탑 몸
  // 포신 — 앞(-z)으로 뻗는다
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.095, 1.85, 10),
    FRAME,
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.3, -1.05);
  yawRig.add(barrel);
  // 총구 — 쏘면 여기가 밝아진다
  const muzzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.09, 10),
    lit(0xffb070, 0),
  );
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 0.3, -1.95);
  yawRig.add(muzzle);

  // 베이 번호 — 이 배의 물건은 다 번호를 단다 (bay-table.js 규약)
  bayPlate(g, 'G-1', x, 1.62, z + 0.2, tint);

  /** 조준선이 잡을 것 — 사다리 (히트 박스는 넉넉하게, 그리는 것은 얇게) */
  const ladderHit = box(g, 0.8, H - 0.3, 0.5, new THREE.MeshBasicMaterial({ visible: false }),
    x, (H - 0.3) / 2 + 0.15, z);
  ladderHit.name = '사다리';

  /** 포탑에 올라갔을 때 잡을 것 — 손잡이 */
  const gunHit = box(turret, 0.7, 0.5, 0.7, new THREE.MeshBasicMaterial({ visible: false }), 0, 0.3, 0);
  gunHit.name = '주포';

  let flash = 0;
  return {
    group: g,
    ladderHit,
    gunHit,
    /** 포탑이 어디를 겨누고 있나 — 사람이 보는 쪽을 따라간다 */
    aimAt(yaw) { yawRig.rotation.y = yaw; },
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
