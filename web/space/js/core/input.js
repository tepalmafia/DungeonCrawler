// 1인칭 조작 — 포인터 잠금 + WASD.
//
// **손이 나오는 게임이므로 「누르고 있는 것」이 일급 시민이다.** 밸브는
// 한 번 누르는 게 아니라 **잡고 돌리는** 것이라(game/systems-table.js VALVE),
// 눌린 순간이 아니라 **눌려 있는 동안**을 보는 쪽이 기본이다.

/** 한 이벤트가 옮길 수 있는 최대 — 화면 한 바퀴가 넘게 도는 것을 막는다 */
const LOOK_CAP = 180;
const clampLook = (v) => Math.max(-LOOK_CAP, Math.min(LOOK_CAP, v || 0));

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.hold = false;        // 마우스 왼쪽을 잡고 있나
    // ★ **Shift 로 뛴다** (game/move-table.js). 누르고 있는 동안만이라
    //   `keys` 와 달리 코드가 아니라 상태로 둔다 — 창을 나갔다 오면
    //   `blur` 가 꺼 준다
    this.run = false;
    this.press = false;       // 이번 프레임에 **눌린 순간**인가 (한 번만 먹는다)
    this.dx = 0;              // 이번 프레임의 시선 이동
    this.dy = 0;
    this.locked = false;

    addEventListener('keydown', (e) => {
      // 브라우저 단축키를 뺏지 않는다 — 새로고침이 막히면 개발이 지옥이 된다
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      this.keys.add(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.run = true;
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.run = false;
    });
    // 창 밖으로 나가면 눌린 키가 눌린 채로 남는다 — 「저절로 걸어간다」의 원인
    addEventListener('blur', () => { this.keys.clear(); this.hold = false; this.run = false; });

    // ★ 캔버스가 아니라 **창 전체**에서 받는다.
    //   캔버스에만 걸었더니, 위에 덮인 안내 창을 누른 사람은 게임을 못 켰다.
    //   화면을 어디를 누르든 시작돼야 한다 — 「어디를 눌러야 하는지」를
    //   사람이 알아맞히게 만들면 안 된다.
    addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.hold = true; this.press = true; }
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
      // ★ 한 번에 오는 이동량을 자른다.
      //   포인터 잠금에서는 movementX 가 아주 큰 값으로 한 번에 올 수 있다
      //   (창을 되돌아왔을 때, 마우스 드라이버, 자동화 도구…). 그대로 받으면
      //   **시야가 홱 돌아가서** 조준하던 것을 놓친다. 검사 도구에서 실제로
      //   났고, 진짜 마우스에서도 날 수 있는 종류다.
      this.dx += clampLook(e.movementX);
      this.dy += clampLook(e.movementY);
    });
  }

  /** 이번 프레임의 이동 입력. 대각선이 빨라지지 않게 길이를 1로 맞춘다 */
  move() {
    const f = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const r = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const len = Math.hypot(f, r);
    return len > 1 ? { f: f / len, r: r / len } : { f, r };
  }

  /**
   * 눌린 순간을 **한 번만** 돌려준다.
   * 레버는 「잡고 있는 것」이 아니라 「누르는 것」이라, hold 로 보면
   * 한 번 눌러도 프레임마다 토글돼서 켜졌다 꺼졌다 한다.
   */
  takePress() {
    const p = this.press;
    this.press = false;
    return p;
  }

  /** 시선 이동을 꺼내 가면서 비운다 — 안 비우면 계속 돈다 */
  takeLook() {
    const d = { dx: this.dx, dy: this.dy };
    this.dx = 0;
    this.dy = 0;
    return d;
  }
}
