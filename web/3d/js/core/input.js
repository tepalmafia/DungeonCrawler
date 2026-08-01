// 입력 — 마우스 NDC, 지면 레이캐스트, 키 상태.
// 기존 2D 게임(web/js/core/input.js)과 같이 "누른 순간"과 "누르고 있음"을 분리한다.

import * as THREE from 'three';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.ndc = new THREE.Vector2(0, 0);
    this.down = false;          // 좌클릭 유지 (= 커서 쪽으로 계속 이동)
    this.justDown = false;      // 이번 프레임에 눌렸는가
    this.rightJustDown = false;
    this.keys = new Set();
    this.pressed = new Set();   // 이번 프레임에 처음 눌린 키
    this.alt = false;
    this.overUI = false;        // HUD 위에 커서가 있으면 지면 클릭을 무시한다
    this.wheel = 0;             // 이번 프레임에 굴린 양 (위로 = 음수 = 확대)

    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._hit = new THREE.Vector3();

    const setNdc = (e) => {
      const r = canvas.getBoundingClientRect();
      this.ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      this.clientX = e.clientX;
      this.clientY = e.clientY;
    };

    window.addEventListener('mousemove', (e) => {
      setNdc(e);
      this.overUI = !!(e.target.closest && e.target.closest('#inv, #overlay, #skillbar, .orb, #minimap'));
    });
    // 창(인벤토리·상점)이 열려 있으면 게임 입력을 막는다.
    //
    // 이 리스너들은 캔버스가 아니라 **window** 에 붙어 있다 — 커서가 HUD 위로
    // 나가도 이동이 이어지게 하려는 것이었는데, 그 대가로 전면 창을 클릭해도
    // 캐릭터가 같이 움직였다. 창을 닫으려고 ✕ 를 누르면 그 자리로 걸어갔다.
    //
    // 캔버스 리스너로 되돌리지 않는 이유: 그러면 커서가 구슬·단축바 위로
    // 지나갈 때마다 이동이 끊긴다. 게이트를 하나 두는 편이 낫다.
    this.blocked = () => false;

    window.addEventListener('mousedown', (e) => {
      if (this.blocked()) return;
      setNdc(e);
      if (this.overUI) return;
      if (e.button === 0) { this.down = true; this.justDown = true; }
      if (e.button === 2) this.rightJustDown = true;
    });
    // 놓는 것은 **막지 않는다.** 누른 채로 창을 열면 down 이 영원히 true 로
    // 남아, 창을 닫는 순간 캐릭터가 걷기 시작한다.
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.down = false; });
    window.addEventListener('blur', () => { this.down = false; this.keys.clear(); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // 휠 = 줌. deltaMode 는 브라우저마다 다르다(픽셀/줄/페이지) — 한 칸 단위로 정규화한다.
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      this.wheel += Math.max(-4, Math.min(4, (e.deltaY * unit) / 100));
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      this.alt = e.altKey;
      if (e.code === 'AltLeft' || e.code === 'AltRight') e.preventDefault();
      if (['Space', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyI', 'Digit1', 'Digit2'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.alt = e.altKey;
      this.keys.delete(e.code);
    });
  }

  /** 커서가 가리키는 y=0 평면 위 지점 */
  groundPoint(camera) {
    this._ray.setFromCamera(this.ndc, camera);
    return this._ray.ray.intersectPlane(this._plane, this._hit) ? this._hit.clone() : null;
  }

  /** 커서 아래에 있는 오브젝트들 */
  pick(camera, objects) {
    if (!objects.length) return [];
    this._ray.setFromCamera(this.ndc, camera);
    return this._ray.intersectObjects(objects, true);
  }

  isDown(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }

  /** 프레임 끝에서 호출 — "이번 프레임" 플래그를 비운다 */
  endFrame() {
    this.justDown = false;
    this.rightJustDown = false;
    this.wheel = 0;
    this.pressed.clear();
  }
}
