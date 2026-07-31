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
    this._initTouch(canvas);
  },

  // ══ 터치 조작 (v204) ═══════════════════════════════════════════════════
  // 사장: "플레이 안되는데?" — 사장은 갤럭시로 하신다.
  // 계측: input.js 에 touchstart/touchmove/pointerdown 이 **하나도 없었다.**
  // 조작 안내는 "WASD 이동 · Space 대시 · K 스킬"인데 폰에는 키보드가 없다 —
  // 폰에서는 프롤로그조차 못 넘어가고 이동 0px 였다.
  //
  // 설계: 게임패드가 이미 하는 방식 그대로 간다 — **터치를 키코드로 번역**한다.
  //   그러면 게임 로직·UI·봇 어느 것도 안 건드리고 폰이 켜진다.
  //   왼쪽 절반 = 가상 스틱(누른 자리가 원점) · 오른쪽 = 버튼 4개
  //   메뉴에서는 탭이 곧 클릭이다 (기존 마우스 UI가 그대로 산다)
  touch: { on: false, stick: null, sx: 0, sy: 0, dx: 0, dy: 0, btns: {} },
  TOUCH_BTNS: [
    { code: 'KeyJ',   label: '공격', x: 838, y: 452, r: 40, c: '#e43b44' },
    { code: 'Space',  label: '대시', x: 754, y: 386, r: 32, c: '#5ce0e6' },
    { code: 'KeyK',   label: '스킬', x: 900, y: 366, r: 32, c: '#f7b32b' },
    { code: 'KeyR',   label: '궁',   x: 806, y: 320, r: 26, c: '#b13ae0' },
  ],
  STICK_MAX: 54,

  _initTouch(canvas) {
    const coarse = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
    if (!('ontouchstart' in window) && !navigator.maxTouchPoints && !coarse) return;
    this.touch.on = true;
    const pos = (t) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((t.clientX - r.left) / r.width) * canvas.width,
               y: ((t.clientY - r.top) / r.height) * canvas.height };
    };
    const hitBtn = (p) => this.TOUCH_BTNS.find((b) => Math.hypot(p.x - b.x, p.y - b.y) <= b.r + 12);

    const start = (e) => {
      AudioSys.unlock();
      for (const t of e.changedTouches) {
        const p = pos(t);
        // ★ 스틱·버튼은 **플레이 중에만**. 1차에 메뉴에서도 왼쪽 절반을 스틱으로 먹어
        //   거점에서 탭이 클릭으로 안 갔다 — 폰에서 시작조차 못 했다
        const playing = typeof Game !== 'undefined' && Game.state === 'play' && !Game.paused;
        const b = playing ? hitBtn(p) : null;
        if (b) {
          this.touch.btns[t.identifier] = b.code;
          this.justPressed[b.code] = true;
          this.keys[b.code] = true;
          this.anyKeyPressed = true;
          if (this.BUFKEYS.includes(b.code)) this.buf[b.code] = this.BUFT;
          continue;
        }
        if (playing && p.x < canvas.width * 0.5 && this.touch.stick === null) {
          // 가상 스틱 — **누른 자리가 원점**이다. 고정 위치 스틱은 폰에서 손가락이 어긋난다
          this.touch.stick = t.identifier;
          this.touch.sx = p.x; this.touch.sy = p.y;
          this.touch.dx = 0; this.touch.dy = 0;
          continue;
        }
        // 그 밖의 탭 = 클릭 (메뉴·카드 선택·조준이 전부 이 경로로 산다)
        this.mouse.x = p.x; this.mouse.y = p.y;
        this.mouse.down = true; this.mouse.justDown = true;
        this.buf.Mouse0 = this.BUFT;
        this.mouse.moveT = performance.now() / 1000;
        this.anyKeyPressed = true;
      }
      e.preventDefault();
    };
    const move = (e) => {
      for (const t of e.changedTouches) {
        const p = pos(t);
        if (t.identifier === this.touch.stick) {
          const dx = p.x - this.touch.sx, dy = p.y - this.touch.sy;
          const d = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, d / this.STICK_MAX);
          this.touch.dx = (dx / d) * k; this.touch.dy = (dy / d) * k;
        } else if (!this.touch.btns[t.identifier]) {
          this.mouse.x = p.x; this.mouse.y = p.y;
          this.mouse.moveT = performance.now() / 1000;
        }
      }
      e.preventDefault();
    };
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.stick) {
          this.touch.stick = null; this.touch.dx = 0; this.touch.dy = 0;
          for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) this.keys[c] = false;
        } else if (this.touch.btns[t.identifier]) {
          this.keys[this.touch.btns[t.identifier]] = false;
          delete this.touch.btns[t.identifier];
        } else {
          this.mouse.down = false;
        }
      }
      e.preventDefault();
    };
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end, { passive: false });
    canvas.addEventListener('touchcancel', end, { passive: false });
  },

  // 매 프레임 — 스틱 기울기를 WASD 로 번역한다 (게임패드와 같은 방식)
  pollTouch() {
    if (!this.touch.on) return;
    const D = 0.28;
    const set = (code, on) => {
      if (on && !this.keys[code]) this.justPressed[code] = true;
      this.keys[code] = on;
      if (on) this.anyKeyPressed = true;
    };
    set('KeyA', this.touch.dx < -D);
    set('KeyD', this.touch.dx > D);
    set('KeyW', this.touch.dy < -D);
    set('KeyS', this.touch.dy > D);
  },

  // 화면 표시 — 보이지 않는 조작은 없는 것과 같다
  drawTouchUI(ctx, playing) {
    if (!this.touch.on) return;
    // ★ 세로 폰에서는 960×540 가로 캔버스가 화면 가운데 얇은 띠가 된다 (실측 412×232).
    //   조작이 되더라도 그 크기로는 못 논다 — 돌리라고 화면에 말해 준다
    if (typeof window !== 'undefined' && window.innerHeight > window.innerWidth * 1.15) {
      ctx.save();
      ctx.fillStyle = 'rgba(8,8,15,0.82)';
      ctx.fillRect(0, 0, Renderer.W, Renderer.H);
      ctx.fillStyle = '#ffd866';
      ctx.font = 'bold 26px Galmuri11, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('폰을 가로로 돌려주세요', Renderer.W / 2, Renderer.H / 2 - 16);
      ctx.font = '15px Galmuri11, monospace';
      ctx.fillStyle = '#c8c2d4';
      ctx.fillText('가로로 두면 화면이 꽉 찹니다', Renderer.W / 2, Renderer.H / 2 + 18);
      // 회전 아이콘 — 글자만 있으면 안 읽힌다
      ctx.strokeStyle = '#ffd866'; ctx.lineWidth = 3;
      ctx.strokeRect(Renderer.W / 2 - 26, Renderer.H / 2 + 44, 52, 34);
      ctx.beginPath();
      ctx.arc(Renderer.W / 2, Renderer.H / 2 + 61, 44, -0.9, 0.9);
      ctx.stroke();
      ctx.restore();
      ctx.textBaseline = 'alphabetic';
      return;
    }
    ctx.save();
    if (playing) {
      for (const b of this.TOUCH_BTNS) {
        const held = Object.values(this.touch.btns).includes(b.code);
        ctx.globalAlpha = held ? 0.62 : 0.30;
        ctx.fillStyle = b.c;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = held ? 1 : 0.72;
        ctx.strokeStyle = b.c; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#0d0b14';
        ctx.font = 'bold 13px Galmuri11, monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(b.label, b.x, b.y);
      }
      if (this.touch.stick !== null) {
        ctx.globalAlpha = 0.28; ctx.fillStyle = '#e8e0cf';
        ctx.beginPath(); ctx.arc(this.touch.sx, this.touch.sy, this.STICK_MAX, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.8; ctx.fillStyle = '#5ce0e6';
        ctx.beginPath();
        ctx.arc(this.touch.sx + this.touch.dx * this.STICK_MAX,
                this.touch.sy + this.touch.dy * this.STICK_MAX, 20, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 스틱이 어디 있는지 모르면 못 쓴다 — 왼쪽 아래에 흐린 안내를 상시 띄운다
        ctx.globalAlpha = 0.16; ctx.strokeStyle = '#e8e0cf'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(120, 430, this.STICK_MAX, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.34; ctx.fillStyle = '#e8e0cf';
        ctx.font = '11px Galmuri11, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('왼쪽을 끌어 이동', 120, 430);
      }
    }
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
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
