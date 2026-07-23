// 키보드 + 마우스 입력. 내부 해상도(960x540) 좌표계로 변환해서 보관한다.
const Input = {
  keys: {},
  justPressed: {},
  mouse: { x: 480, y: 270, down: false, justDown: false },
  anyKeyPressed: false,

  init(canvas) {
    this._canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
        e.preventDefault();
      }
      if (!this.keys[e.code]) this.justPressed[e.code] = true;
      this.keys[e.code] = true;
      this.anyKeyPressed = true;
      AudioSys.unlock();
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      this.mouse.y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouse.down = true;
        this.mouse.justDown = true;
        this.anyKeyPressed = true;
      }
      AudioSys.unlock();
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  down(...codes) {
    return codes.some((c) => this.keys[c]);
  },

  pressed(...codes) {
    return codes.some((c) => this.justPressed[c]);
  },

  // 프레임 종료 시 호출 — "이번 프레임에 눌림" 상태 초기화
  endFrame() {
    this.justPressed = {};
    this.mouse.justDown = false;
    this.anyKeyPressed = false;
  },
};
