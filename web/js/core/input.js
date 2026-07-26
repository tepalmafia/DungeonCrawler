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
      if (e.button === 2) {
        this.mouse.rightJustDown = true; // 우클릭 = 스킬
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
    this.mouse.rightJustDown = false;
    this.anyKeyPressed = false;
  },

  // ── 게임패드 (스팀 스프린트 1차) — 매 프레임 tick 전에 폴링, 키 상태로 번역한다 ──
  // A=공격 B=대시 X=스킬 Y=보조 RB=궁 LB=획득목록 Start=일시정지 / 왼스틱=이동
  // 십자키: 플레이 중 = 이동, 선택 화면(카드·거점) = 번호 선택
  _padPrev: {},
  pollGamepad(menuMode = false) {
    if (!navigator.getGamepads) return;
    const gp = [...navigator.getGamepads()].find((g) => g && g.connected);
    if (!gp) return;
    const press = (code, down) => {
      if (down && !this._padPrev[code]) { this.justPressed[code] = true; this.anyKeyPressed = true; }
      if (down) this.keys[code] = true;
      else if (this._padPrev[code]) this.keys[code] = false;
      this._padPrev[code] = down;
    };
    const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const ax = (i) => gp.axes[i] || 0;
    const D = 0.4; // 스틱 데드존
    // 이동: 왼스틱 (+ 플레이 중 십자키)
    press('KeyA', ax(0) < -D || (!menuMode && btn(14)));
    press('KeyD', ax(0) > D || (!menuMode && btn(15)));
    press('KeyW', ax(1) < -D || (!menuMode && btn(12)));
    press('KeyS', ax(1) > D || (!menuMode && btn(13)));
    // 선택 화면: 십자키 = 1~4번 카드/메뉴
    press('Digit1', menuMode && btn(14));
    press('Digit2', menuMode && btn(12));
    press('Digit3', menuMode && btn(15));
    press('Digit4', menuMode && btn(13));
    // 버튼
    press('KeyJ', btn(0));                 // A 공격
    press('Enter', btn(0) && menuMode);    // 메뉴에서 A = 확인
    press('Space', btn(1));                // B 대시 (메뉴: 확인 겸용)
    press('KeyK', btn(2));                 // X 스킬
    press('KeyE', btn(3));                 // Y 보조/리롤
    press('Tab', btn(4));                  // LB 획득 목록
    press('KeyR', btn(5));                 // RB 궁극기
    press('KeyC', btn(8));                 // Select 이어하기/계속
    press('Escape', btn(9));               // Start 일시정지
  },
};
