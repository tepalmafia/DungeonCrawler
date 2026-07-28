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
      if (!this.keys[e.code]) {
        this.justPressed[e.code] = true;
        if (this.BUFKEYS.includes(e.code)) this.buf[e.code] = this.BUFT;
      }
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
      // v167: 최근 이동 시각 — 조준이 마우스를 따를지 이동 방향을 따를지 가른다.
      // 키보드로만 노는 사람이 가만히 놓인 커서에 끌려가면 안 된다
      this.mouse.moveT = performance.now() / 1000;
    });

    // v157: 포인터가 캔버스를 떠나면 좌표를 화면 밖으로 (모든 호버 판정의 뿌리 수정).
    // mousemove가 캔버스에만 붙어 있어, 레터박스 여백(16:9가 아닌 창)으로 포인터가 나가면
    // 좌표가 **마지막 위치에 얼어붙었다**. 그 결과 로드아웃 줄 위에서 마우스를 뺀 뒤 키보드만
    // 써도 현상금이 계속 조절됐다 (실측 1200x760에서 3→6→4). 사장이 겪은 "몰래 오른 열기"의
    // 잔존 경로이자, 호버를 쓰는 모든 UI에 공통으로 걸려 있던 문제다
    const leave = () => { this.mouse.x = -9999; this.mouse.y = -9999; this.mouse.down = false; this.mouse.moveT = -999; };
    canvas.addEventListener('mouseleave', leave);
    window.addEventListener('blur', leave);

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouse.down = true;
        this.mouse.justDown = true;
        this.buf.Mouse0 = this.BUFT;
        this.anyKeyPressed = true;
        this.mouse.moveT = performance.now() / 1000; // 클릭도 '마우스를 쓰는 중'이다 (v167)
      }
      if (e.button === 2) {
        this.mouse.rightJustDown = true; // 우클릭 = 스킬
        this.buf.Mouse2 = this.BUFT;
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

  // ── 선입력 버퍼 (v160) ──────────────────────────────────────────────
  // 히트스톱은 최대 0.09초(≈5프레임) 동안 tick을 통째로 건너뛰는데, endFrame은 그동안에도
  // 돌아 justPressed를 지웠다. 즉 "때린 그 순간 바로 누른 다음 타"가 조용히 사라졌다.
  // 사장이 느낀 "가끔 안 나가는 공격"의 정체다. 이제 전투 입력은 0.15초를 버틴다.
  BUFT: 0.15,
  BUFKEYS: ['KeyJ', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyK', 'KeyE', 'KeyR'],
  buf: {},

  // 버퍼 소비 — 소비하는 쪽이 "지금 발동 가능"할 때만 부르는 게 원칙이다.
  // 쿨다운 중에 부르지 않으면 버퍼가 살아남아 쿨이 끝나는 즉시 발동한다.
  // 봇·게임패드는 justPressed를 직접 쓰므로 그 경로도 함께 인정한다.
  take(...codes) {
    let hit = false;
    for (const c of codes) {
      if (c === 'Mouse0') {
        if (this.mouse.justDown) { this.mouse.justDown = false; hit = true; }
      } else if (c === 'Mouse2') {
        if (this.mouse.rightJustDown) { this.mouse.rightJustDown = false; hit = true; }
      } else if (this.justPressed[c]) {
        this.justPressed[c] = false; hit = true;
      }
      if (this.buf[c] > 0) { this.buf[c] = 0; hit = true; }
    }
    return hit;
  },

  decay(dt) {
    if (dt <= 0) return; // 히트스톱: 세계가 멈추면 버퍼도 함께 멈춘다
    for (const c in this.buf) if (this.buf[c] > 0) this.buf[c] -= dt;
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
      if (down && !this._padPrev[code]) {
        this.justPressed[code] = true; this.anyKeyPressed = true;
        if (this.BUFKEYS.includes(code)) this.buf[code] = this.BUFT;
      }
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
