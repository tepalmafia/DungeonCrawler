// ══════════════════════════════════════════════════════════════════════════
//  ★★ 점검 모드 — **F2** (2026-08-06 · 사장님 「테스트를 할 수가 없잔아」)
//
//  ★ 왜 만들었나
//    만든 것들이 저마다 **조건 뒤에 숨어 있었다.** 주포는 쫓겨야 쏘였고,
//    착륙은 구간 3 의 장면 B 를 기다려야 했고, 바깥문은 에어록까지 걸어가야
//    했다. 그래서 사장님이 켜서 **만져 볼 수가 없었다.**
//
//    검사 도구는 `window.SPACE` 의 구멍으로 그걸 다 했는데, 그건
//    **콘솔을 열 줄 아는 사람만** 쓸 수 있다. 같은 구멍을 **버튼으로**
//    낸다 — 새 계통을 만드는 것이 아니라 이미 있는 것을 손에 닿게 한다.
//
//  ★ 규칙 셋
//    ① **F2 를 눌러야 뜬다.** 기본은 꺼져 있고, 놀 때는 아무것도 안 보인다
//       (★ F2 하나뿐이었던 것이 잘못이었다 — 노트북에서 F2 는 Fn 을 같이
//        눌러야 하는 하드웨어 키라 브라우저까지 안 온다. **` 도 받고**,
//        시작 화면·멈춤 화면에는 **단추로도** 낸다. 들어가는 길이 하나면
//        그 하나가 막힌 사람에게는 없는 것과 같다)
//    ② **게임을 안 고친다.** 여기서 하는 것은 전부 `SPACE.*` 호출이고,
//       그건 검사 도구가 쓰는 것과 **같은 구멍**이다 — 점검 모드에서만
//       되는 길을 새로 만들면 그 길은 아무도 안 검사한다
//    ③ **무엇을 눌렀는지 말한다.** 조용히 상태가 바뀌면 그게 제일 헷갈린다
// ══════════════════════════════════════════════════════════════════════════

/** 무엇을 낼 것인가 — **여기 한 곳에 적는다** */
const GROUPS = [
  ['주포', [
    ['사다리 앞으로', (S) => { S.put(1.9, -3.9, -Math.PI / 2, 0.1); return '조종석 사다리 앞 — 누르면 올라갑니다'; }],
    ['광석 60 싣기', (S) => { S.giveOre(60); return '광석을 실었습니다 — 탄약이 곧 수리 재료입니다'; }],
    ['적을 붙인다', (S) => { S.forceContact(); return '추격 — 이제 맞힐 것이 있습니다'; }],
  ]],
  ['에어록 · 광물 · 구조 신호', [
    // ★ 7판 G — 구간 7 을 안 기다리고 무전을 켠다
    ['조난 신호 켜기', (S) => { S.callRescue(); return '무전기에 신호가 왔습니다 — 에어록에서 잡습니다'; }],
    ['무전기 앞으로', (S) => { const a = S.outerAt; S.put(a.x - 1.0, a.z - 1.05, -Math.PI / 2, 0); return '무전기 앞 — 잡고 있으면 응답합니다'; }],
    ['바깥문 앞으로', (S) => { const a = S.outerAt; S.put(a.x - 1.1, a.z, -Math.PI / 2, 0); return '바깥문 앞 — 누르면 엽니다'; }],
    ['문 열기/닫기', (S) => { const o = S.lock.open; S.putLock(!o); return o ? '바깥문을 닫았습니다' : '바깥문을 열었습니다'; }],
    ['윈치 앞으로', (S) => { S.put(3.4, 5.15, 0, -0.34); return '윈치 앞 — 잡고 있으면 끌려옵니다'; }],
  ]],
  ['행성 착륙', [
    ['내릴 자리 띄우기', (S) => { S.offerLand(false); return '해도대에 「내린다 / 지나친다」가 떴습니다'; }],
    ['해도대 앞으로', (S) => { S.put(-2.4, 0.42, Math.PI / 2, -0.30); return '관측실 해도대 앞'; }],
    ['바로 착지', (S) => { S.putLand('landed', 1); return '내려앉았습니다 — 바깥문을 열고 싣습니다'; }],
    ['바로 이륙', (S) => { S.putLand('up', 0); return '분사 — 올라갑니다'; }],
    ['하늘로', (S) => { S.putLand('none', 0); return '우주로 돌아왔습니다'; }],
  ]],
  ['조종 · 자동 항법', [
    ['조종간 앞으로', (S) => { S.put(0, -6.4, 0, -0.2); return '조종석 — 잡으면 수동으로 바뀝니다'; }],
    ['수동으로', (S) => { S.setManual(); return '자동 항법을 껐습니다 — 놓아도 안 돌아옵니다'; }],
    ['항로 밖으로', (S) => { S.setOff(0.9); return '항로를 크게 벗어났습니다'; }],
    ['행성 곁으로', (S) => { S.setRegion('planet'); S.setPower('thrust', true); return '행성 곁 — 수동이면 끌려갑니다'; }],
  ]],
  ['배 · 항로', [
    ['구간 3 (행성)', (S) => { S.setLeg(3); S.seekScene(600); return '구간 3 — 장면 B(행성)'; }],
    ['구간 6 (자동 조종)', (S) => { S.setLeg(6); S.seekScene(600); return '구간 6 — 장면 C(자세 제어)'; }],
    ['박자 넘기기', (S) => S.skipBeat() && '다음 박자로'],
    ['고장 하나', (S) => { S.forceFault(); return '고장이 떴습니다 — 소리로 찾습니다'; }],
    ['열 90', (S) => { S.setHeat(90); return '열 90 — 기관실 밸브로 내립니다'; }],
    ['보급 가득', (S) => { S.setSupply({ food: 100, parts: 8, ore: 200 }); return '식량·부품·광석을 채웠습니다'; }],
    // ★ 8판 — 2시간을 안 기다리고 마지막 구간과 끝 화면을 본다
    ['성간 공백으로', (S) => { S.seekVoid(); return '11구간 끝 — 곧 성간 공백으로 들어섭니다'; }],
    ['바로 끝 화면', (S) => { S.seekEnd(); return '마지막 구간 끝 — 곧 도착합니다'; }],
  ]],
  // ★ **새 게임** (2026-08-06 · 사장님 「계속 이어하기로 나오는데?
  //   새 게임은 어떻게 하는거야?」). 저장 칸이 하나뿐이라 켤 때마다 말없이
  //   이어졌고, **처음부터 시작하는 길이 아무 데도 없었다.** 「저장 지우기」는
  //   있었지만 그건 지우기지 시작하기가 아니다 — 지운 다음 새로고침을
  //   해야 한다는 걸 알아야 쓸 수 있었다. 한 번에 되는 것으로 바꾼다.
  ['게임', [
    ['처음부터 다시', (S) => { S.newGame(); return '새 배로 다시 시작합니다'; }],
    ['지금 저장', (S) => { S.saveNow(); return '여기까지 저장했습니다'; }],
  ]],
];

export function buildCheck() {
  const box = document.createElement('div');
  box.id = 'check';
  box.hidden = true;
  // ★★ **이 한 줄이 없어서 단추가 안 먹었다.** `core/input.js` 가 창 전체에서
  //   mousedown 을 받아 포인터 잠금을 다시 거는데, 여기를 눌러도 그게 돌아서
  //   **커서가 사라졌다.** 그러면 두 번째 단추부터는 어디를 눌러도 안 먹는다.
  //   `data-ui` 는 「이건 게임 화면이 아니라 손으로 만지는 것」이라는 표다
  box.dataset.ui = '1';
  const head = document.createElement('b');
  head.textContent = '점검 모드 — F2 (또는 `) 로 닫습니다';
  box.appendChild(head);
  const say = document.createElement('p');
  say.className = 'say';
  say.textContent = '아무거나 눌러 봅니다. 게임은 그대로 돕니다.';
  box.appendChild(say);

  for (const [title, items] of GROUPS) {
    const h = document.createElement('p');
    h.className = 'grp';
    h.textContent = title;
    box.appendChild(h);
    const row = document.createElement('div');
    row.className = 'row';
    for (const [label, run] of items) {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        try {
          const msg = run(window.SPACE);
          say.textContent = typeof msg === 'string' ? msg : `${label} — 했습니다`;
        } catch (err) {
          // ★ **조용히 실패하지 않는다.** 점검 모드가 조용히 안 먹으면
          //   「게임이 고장난 건지 버튼이 고장난 건지」를 알 수가 없다
          say.textContent = `${label} — 안 됩니다: ${err.message}`;
        }
      });
      row.appendChild(b);
    }
    box.appendChild(row);
  }
  document.body.appendChild(box);

  /** 열고 닫는다 — 키로도, 단추로도 같은 이 함수를 부른다 */
  const toggle = (on) => {
    box.hidden = on === undefined ? !box.hidden : !on;
    // 열려 있는 동안은 마우스를 써야 하므로 포인터 잠금을 푼다
    if (!box.hidden && document.pointerLockElement) document.exitPointerLock();
  };

  // ★ **F2 하나로는 못 연다.** 노트북에서 F2 는 Fn 을 같이 눌러야 하는
  //   하드웨어 키인 경우가 많아 브라우저까지 아예 안 온다. `(Backquote) 는
  //   어느 자판에서나 그냥 눌리고, 게임이 안 쓰는 키다
  addEventListener('keydown', (e) => {
    if (e.code !== 'F2' && e.code !== 'Backquote') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;   // 브라우저 단축키는 안 뺏는다
    e.preventDefault();
    toggle();
  });
  return { box, toggle, get open() { return !box.hidden; } };
}
