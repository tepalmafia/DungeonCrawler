// ══════════════════════════════════════════════════════════════════════════
//  안내선이 어디를 가리키나 — **길 만들기.**
//
//  ★ 왜 여기 있나
//    「어느 방으로 가라」는 **규칙**이고 「바닥에 삼각형을 몇 개 깐다」는
//    그림이다. 규칙을 world/ 에 두면 브라우저 없이 못 재고, 못 재면
//    「선이 벽을 뚫고 간다」를 화면으로만 잡게 된다.
//
//  ★ three.js 를 안 쓴다 — tools/space-guide.js 가 브라우저 없이 읽는다.
// ══════════════════════════════════════════════════════════════════════════

/**
 * 가르침 하나가 어느 자리를 가리키나.
 *
 * ★ `walk` 은 **일부러 없다.** 「걸어서 둘러봅니다」는 갈 데가 없는
 *   가르침이고, 여기에 선을 그으면 첫 30초부터 「시키는 데로 가는 게임」이
 *   된다. 처음 여는 화면에서 하고 싶은 것은 **둘러보는 것**이다.
 *
 * ★ `fault` 도 없다. 그 가르침의 내용 자체가 「덜그럭거리는 쪽으로 간다」라,
 *   선을 그으면 **가르치려는 것을 그 가르침이 없앤다.** 대신 헤매면
 *   (TUTOR.showWhere 초) 글이 방을 말해 주고, 그때 world/guide.js 가
 *   고장 난 방으로 선을 잇는다 — 규칙은 같고 시점만 늦다.
 */
export const AIMS = {
  route: 'chart',
  power: 'breaker',
  valve: 'valve',
  fly: 'yoke',
  supply: 'winch',
};

/**
 * 배 안의 길. **통로가 척추라 길이 늘 셋으로 갈린다** —
 * 지금 방에서 통로로, 통로를 따라, 목표 방으로.
 *
 * @param from   {x,z} 지금 자리
 * @param to     {x,z} 목표
 * @param rooms  ROOMS 배열 (사각형들)
 * @param doors  [{key,x,z}] 문 여섯
 * @returns [{x,z}, ...] 꺾은점. 목표가 같은 방이면 두 점뿐이다
 */
export function pathTo(from, to, rooms, doors) {
  const R = Object.fromEntries(rooms.map((r) => [r.key, r]));
  const spine = R.spine;
  const inRoom = (p, r) => r && p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1;
  const roomOf = (p) => rooms.find((r) => inRoom(p, r))?.key ?? null;

  const a = roomOf(from), b = roomOf(to);
  if (!a || !b || a === b) return [from, to];

  // 문 앞의 두 자리 — **통로 쪽**과 **방 쪽**.
  // ★ 부호(ry)로 고르지 않는다. 문마다 ry 규약이 달라서 조종석·기관실만
  //   반대로 나오는 일이 실제로 있었다 (방 이름표가 그 함정에 빠졌다).
  //   **어느 쪽이 통로 사각형 안인지 직접 본다** — 규약이 바뀌어도 안 틀린다
  //
  // ★ **경계를 여유 있게 본다.** 문은 두 방이 맞닿은 자리라, 문 위의 점은
  //   `inRoom` 으로는 **양쪽 다 참**이다. 그래서 처음엔 조종석·기관실 문에서
  //   문틀을 따라 좌우로 갈랐다가 되돌아오는 **지그재그**가 나왔다
  //   (0,10) → (0.6,10) → (-0.6,10). 안쪽으로 M 만큼 파고든 점만 그 방의
  //   것으로 친다.
  const M = 0.2;
  const deepIn = (p, r) => r && p.x >= r.x0 + M && p.x <= r.x1 - M
    && p.z >= r.z0 + M && p.z <= r.z1 - M;
  const mouth = (key) => {
    const d = doors.find((x) => x.key === key);
    const side = R[key];
    if (!d || !side) return null;
    const D = 0.55;
    for (const [dx, dz] of [[D, 0], [-D, 0], [0, D], [0, -D]]) {
      const sp = { x: d.x + dx, z: d.z + dz };
      const rm = { x: d.x - dx, z: d.z - dz };
      if (deepIn(sp, spine) && deepIn(rm, side)) return { spine: sp, room: rm };
    }
    return null;
  };

  const out = [from];
  let cur = from;
  if (a !== 'spine') {
    const m = mouth(a);
    if (!m) return [from, to];
    out.push(m.room, m.spine);
    cur = m.spine;
  }
  if (b !== 'spine') {
    const m = mouth(b);
    if (!m) return [from, to];
    // 통로 한가운데를 따라 간다 — 벽을 스치면 선이 벽에 파묻힌다
    out.push({ x: 0, z: cur.z }, { x: 0, z: m.spine.z }, m.spine, m.room);
  } else {
    out.push({ x: 0, z: cur.z }, { x: 0, z: to.z });
  }
  out.push(to);

  // 붙어 있는 점은 버린다 — 같은 자리에 화살표가 겹쳐 찍힌다
  return out.filter((p, i) => i === 0 || Math.hypot(p.x - out[i - 1].x, p.z - out[i - 1].z) > 0.05);
}
