// 1인칭 조작 — 포인터 잠금 + WASD.
//
// **손이 나오는 게임이므로 「누르고 있는 것」이 일급 시민이다.** 밸브는
// 한 번 누르는 게 아니라 **잡고 돌리는** 것이라(game/systems-table.js VALVE),
// 눌린 순간이 아니라 **눌려 있는 동안**을 보는 쪽이 기본이다.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.hold = false;        // 마우스 왼쪽을 잡고 있나
    this.dx = 0;              // 이번 프레임의 시선 이동
    this.dy = 0;
    this.locked = false;

    addEventListener('keydown', (e) => {
      // 브라우저 단축키를 뺏지 않는다 — 새로고침이 막히면 개발이 지옥이 된다
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    // 창 밖으로 나가면 눌린 키가 눌린 채로 남는다 — 「저절로 걸어간다」의 원인
    addEventListener('blur', () => { this.keys.clear(); this.hold = false; });

    // ★ 캔버스가 아니라 **창 전체**에서 받는다.
    //   캔버스에만 걸었더니, 위에 덮인 안내 창을 누른 사람은 게임을 못 켰다.
    //   화면을 어디를 누르든 시작돼야 한다 — 「어디를 눌러야 하는지」를
    //   사람이 알아맞히게 만들면 안 된다.
    addEventListener('mousedown', (e) => {
      if (e.button === 0) this.hold = true;
      // 잠금이 막 풀린 직후에 다시 걸면 브라우저가 거절한다. 조용히 넘긴다
      if (!this.locked) canvas.requestPointerLock?.()?.catch?.(() => {});
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.hold = false; });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) { this.keys.clear(); this.hold = false; }
    });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
  }

  /** 이번 프레임의 이동 입력. 대각선이 빨라지지 않게 길이를 1로 맞춘다 */
  move() {
    const f = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const r = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const len = Math.hypot(f, r);
    return len > 1 ? { f: f / len, r: r / len } : { f, r };
  }

  /** 시선 이동을 꺼내 가면서 비운다 — 안 비우면 계속 돈다 */
  takeLook() {
    const d = { dx: this.dx, dy: this.dy };
    this.dx = 0;
    this.dy = 0;
    return d;
  }
}
