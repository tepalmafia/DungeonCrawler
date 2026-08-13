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

// ══════════════════════════════════════════════════════════════════════════
//  ★★★ v117 — **항목을 통째로 다시 짰다** (사장님 「기존 f2에 테스트 항목도
//     개선시켜주고 **테스트가 재대로 가능하게**」)
//
//  ══ 왜 다시 짰나 — 세 보니 절반이 죽어 있었다 ═══════════════════════
//
//  v109·v110 이 **걷기와 방들을 통째로 없앴는데**, 점검 모드는 그대로
//  「무전기 앞으로」·「윈치 앞으로」·「주 차단기 앞으로」·「우주복 걸이
//  앞으로」를 내고 있었다. 이 단추들은 `S.put()` 으로 몸을 옮기는데,
//  v110 이 **매 프레임 좌석으로 되돌리므로** 눌러도 아무 일이 안 난다.
//
//  ★★★ 그리고 그게 **예외를 안 던진다.** 훅은 다 살아 있어서 조용히
//    아무것도 안 한다 — 「게임이 고장난 건지 버튼이 고장난 건지 알 수가
//    없다」는 이 파일이 스스로 적어 둔 그 상태다. **조용한 무동작이
//    빨간 오류보다 나쁘다.**
//
//  ★ 그래서 죽은 것을 빼고, v110~v116 이 지은 것을 넣는다:
//    미사일 무한 · 파츠와 등급 · 성장과 특성 · 화물과 제조 · 조준 띠 ·
//    가속도 · 기체 도해.
//
//  ★★ 그리고 `tools/space-check.js` 가 이제 **단추를 하나하나 눌러 본다** —
//    항목이 죽으면 문서가 아니라 검사가 소리를 낸다
// ══════════════════════════════════════════════════════════════════════════

/** 무엇을 낼 것인가 — **여기 한 곳에 적는다** */
const GROUPS = [
  // ══ ★★★ 사장님이 제일 자주 쓰실 것을 맨 위에 ═══════════════════════
  ['★★ 시험 스위치', [
    /**
     * ★★★ 사장님 「**미사일 무한은 f2테스트에 넣어서 테스트할 때 사용할
     *   수 있도록**」 — v95~v116 내내 표에 `infinite: true` 로 박혀 있던 것을
     *   여기로 옮겼다. 기본은 **꺼짐**이고, 누르면 켜진다
     */
    ['★ 미사일 무한 켜기/끄기', (S) => {
      const on = S.setInfinite();
      return on ? '미사일 무한 **ON** — 안 닳고 재고도 안 봅니다 (시험용)'
        : '미사일 무한 OFF — 이제 진짜로 떨어집니다 (제조·거래로 채웁니다)';
    }],
    /**
     * ★★★ v119 — **락온을 기다리지 않고 곧바로 묶는다.** 묶는 데 2.6초가
     *   걸리므로 「묶은 뒤가 어떤가」를 보려면 매번 겨누고 기다려야 했다.
     *   새 길이 아니라 `stepRadar` 와 같은 자리에 `id` 를 꽂을 뿐이다
     */
    ['★ 지금 겨눈 것 곧바로 묶기', (S) => {
      const r = S.putLock(true);
      return r ? `${r.kind} (${r.dist}m) 를 묶었습니다 — 이제 조준선을 딴 데로 돌려 보십시오`
        : '겨눈 것이 없습니다 — 적을 먼저 부릅니다';
    }],
    ['락온 놓기', (S) => { S.putLock(false); return '놓았습니다'; }],
    ['미사일 8발 채우기', (S) => { S.setSupply({ missiles: 8 }); return `미사일 ${S.supply.missiles}발`; }],
    ['미사일 0발로', (S) => { S.setSupply({ missiles: 0 }); return '미사일 0 — 「못 쏩니다」가 뜨는지 봅니다'; }],
    ['보급 가득', (S) => { S.setSupply({ food: 100, parts: 12, ore: 240, fuel: 100, missiles: 8 }); return '식량·부품·광석·추진제·미사일을 채웠습니다'; }],
    ['처음부터 다시', (S) => { S.newGame(); return '새 배로 다시 시작합니다'; }],
    ['지금 저장', (S) => { S.saveNow(); return '여기까지 저장했습니다'; }],
  ]],

  // ══ 전투 — 이 게임의 알맹이 ════════════════════════════════════════
  ['전투 — 적을 부른다', [
    ['★ 요격기 (빠르고 떼로)', (S) => { const r = S.callFoe('fighter', 0, 120); return `요격기 — ${r.dist}m · 맷집 ${r.hp} · 셋이 옵니다`; }],
    ['★ 포함 (두껍고 세다)', (S) => { const r = S.callFoe('gunship', 0, 120); return `포함 — 맷집 ${r.hp} · 미사일이 필요합니다`; }],
    ['★ 자폭정 (몸이 탄)', (S) => { const r = S.callFoe('drone', 0, 140); return `자폭정 — ${r.dist}m · 먼저 봐야 합니다`; }],
    ['★ 방공 포대 (길을 막는다)', (S) => { S.callFoe('turret', -20, 110); return '방공 포대 — 안 움직입니다. 부수거나 돌아갑니다'; }],
    ['★★ 보급 호송선 (도망간다)', (S) => { S.callFoe('convoy', 15, 130); return '호송선 — 부수면 **분열 노심**이 나옵니다'; }],
    ['적 우주선 부르기', (S) => { const r = S.callRaider(); return `적 우주선 — ${r.dist}m · 맷집 ${r.hp}`; }],
    ['하늘 비우기', (S) => { S.clearSky(); return '적과 탄을 다 치웠습니다'; }],
    ['레이더 켜기/끄기', (S) => { const on = S.power.sensor; S.setPower('sensor', !on); return on ? '레이더를 껐습니다 — 묶을 수 없습니다' : '레이더 ON — 자국이 20 오릅니다'; }],
    ['레이저 / 열추적 / 유도', (S) => { const n = (S.combat.slot % 3) + 1; S.putWeapon(n); return `${S.combat.name} 로 바꿨습니다`; }],
    ['한 발 쏘기', (S) => { const r = S.fire(); return `쏨 ${r.fired} · 맞음 ${r.hits} · 부숨 ${r.kills}`; }],
    ['적을 붙인다 (추격)', (S) => { S.forceContact(); return '추격 — 적 우주선이 같이 뜹니다'; }],
  ]],

  // ══ ★★★ v114 — **조준 띠.** 「정확히 안쪽일수록 아프다」를 눌러 본다
  ['★★ 조준 띠 (v114)', [
    ['표적을 정중앙에', (S) => { S.putFoeAim(0); return '조준 오차 0° — 쏘면 **정중앙**(×2.00)이 나와야 합니다'; }],
    ['표적을 가장자리에', (S) => { S.putFoeAim(5.0); return '조준 오차 5° — **가장자리**(×0.30)쯤입니다'; }],
    ['표적을 문지방에', (S) => { S.putFoeAim(7.2); return '조준 오차 7.2° — **스침**(×0.12). 옛 규칙이면 빗나감이었습니다'; }],
    ['표적을 문 밖에', (S) => { S.putFoeAim(9.0); return '조준 오차 9° — 이건 **진짜 빗나감**입니다'; }],
  ]],

  // ══ ★★★ v111 — **회피 타이밍.** 탄이 날아와야 창이 생긴다
  ['★★ 회피 타이밍 (v111)', [
    ['★ 나에게 탄 하나', (S) => { S.putShotAtMe(); return '탄이 날아옵니다 — 고리가 붙는 순간 Q · E'; }],
    ['★ 완벽한 자리에서', (S) => { S.putShotAtMe(0.35); return '남은 0.35초 — **★★ 지금!** 자리입니다'; }],
    ['늦은 자리에서', (S) => { S.putShotAtMe(0.05); return '남은 0.05초 — 늦었습니다'; }],
  ]],

  // ══ ★★★ v116 — **가속도.** 「빨라진다」가 화면에 나오나
  ['★★ 가속도 · 속도 (v116)', [
    ['스로틀 0 (멈춘다)', (S) => { S.putThrottle(0); return `창밖 ${S.speedNow().mps} mps — 줄이 꺼져야 합니다`; }],
    ['★ 전속으로 밀기', (S) => { S.setThrust(true); S.putThrottle(1); return `창밖 ${S.speedNow().mps} mps — 화각이 열립니다`; }],
    ['역추진', (S) => { S.putThrottle(-0.8); return `역추진 ${S.speedNow().mps} mps — 자국이 반대로 뻗습니다`; }],
    ['급가속 (R 꾹)', (S) => { S.putBoost(1); return '급가속 — 추진제를 태웁니다'; }],
    ['지금 값 보기', (S) => { const v = S.speedNow(); return `속도 ${v.mps} · 가속 ${v.acc} · 화각 ${v.fov}° · 줄 ${v.streakLen}`; }],
  ]],

  // ══ ★★★ v110·v107 — **파밍과 파츠**
  ['★★ 파츠 · 파밍 (v110)', [
    ['표준 파츠 하나', (S) => { const p = S.givePart('gun', 'stock'); return `${p?.name ?? '주포'} 표준 — 랙에 들어갔습니다`; }],
    ['★ 명품 파츠 하나', (S) => { const p = S.givePart('engine', 'ace'); return `${p?.name ?? '엔진'} **명품** — I 창에서 답니다`; }],
    ['일곱 자리에 하나씩', (S) => {
      const list = S.putParts([['gun', 'fine'], ['tube', 'fine'], ['armor', 'fine'],
        ['engine', 'fine'], ['sensor', 'fine'], ['sink', 'fine'], ['hold', 'fine']]);
      return `일곱 자리에 상급을 넣었습니다 (${list?.length ?? 7})`;
    }],
    ['꾸러미 하나 띄우기', (S) => { S.putPack(); return '꾸러미 — F(팔) · G(그물) · B(로봇)'; }],
    ['★ 기체 도해 열기 (I)', (S) => { S.openBay(true); return 'I 창 — 기체 · 성장 · 화물·제조 · 탄두'; }],
  ]],

  // ══ ★★★ v115 — **성장.** RPG 의 기둥
  ['★★★ 성장 · 특성 (v115)', [
    ['경험 조금 (+200)', (S) => { const p = S.giveXp(200); return `Lv ${p.lv} · 고를 것 ${p.owed}`; }],
    ['★ 경험 많이 (+1500)', (S) => { const p = S.giveXp(1500); return `Lv ${p.lv} · 고를 것 ${p.owed} — I 창 「성장」에서 고릅니다`; }],
    ['★★ 끝까지 (Lv7)', (S) => { const p = S.giveXp(6000); return `Lv ${p.lv} — 여섯을 다 고를 수 있습니다`; }],
    ['지금 특성 보기', (S) => {
      const p = S.pilotNow();
      return `Lv ${p.lv} · 고른 것 ${p.picked.length ? p.picked.join(', ') : '없음'} · 남은 선택 ${p.owed}`;
    }],
  ]],

  // ══ ★★★ v114 — **화물 · 인벤토리 · 제조**
  ['★★ 화물 · 제조 (v114)', [
    ['재료 한 아름', (S) => { S.giveCargo({ ore: 12, spare: 8, coolant: 3, ration: 6, meal: 2, arc: 2 }); return '화물칸에 넣었습니다 — I 창 「화물·제조」'; }],
    ['★ 화물칸 꽉 채우기', (S) => { S.giveCargo({ ore: 40, spare: 20, coolant: 10, meal: 6 }); return `${S.cargo.used}/${S.cargo.hold} 짐 — 자리가 없으면 못 싣습니다`; }],
    ['화물칸 비우기', (S) => { for (const k of Object.keys(S.cargo.items)) S.giveItem(k, -99); return '화물칸을 비웠습니다'; }],
    ['제조 진행 보기', (S) => { const j = S.craftNow(); return j ? `${j.key} — ${j.left.toFixed(0)}초 남음` : '만드는 중인 것이 없습니다'; }],
  ]],

  // ══ 탄두 — 이 게임의 목적 ══════════════════════════════════════════
  ['★★ 탄두 (목적)', [
    ['재료 하나 꽂기', (S) => {
      const w = S.warhead;
      const next = w.parts.find((p) => !w.in.includes(p.key));
      if (!next) return '다섯이 다 찼습니다';
      const r = S.putHeadPart(next.key);
      return `${next.name} 을 꽂았습니다 — ${r.n}/${r.of}`;
    }],
    ['★ 다섯을 다 채우기', (S) => { S.fillHead(); return '다섯이 다 찼습니다 — 무장하면 떨굴 수 있습니다'; }],
    ['무장하기', (S) => { S.armHead(); return '무장 — 이제 J 로 투하 마디가 열립니다'; }],
    ['탄두 데우기 (95)', (S) => { S.setBake(95); return '탄두 95 — 100 에 닿으면 하나가 죽습니다'; }],
    ['★ 떨궈 보기 (결말)', (S) => { const e = S.dropHead(); return `${e.name} — ${e.what}`; }],
  ]],

  // ══ 배 상태 — 맞고 고치는 것 ═══════════════════════════════════════
  ['배 상태 · 수리', [
    ['맞아 보기', (S) => { S.hitMe(); return '한 대 맞았습니다 — 선체가 닳고 고장이 열립니다'; }],
    ['고장 하나', (S) => { S.forceFault(); return '고장이 떴습니다'; }],
    ['★ 수리 (P)', (S) => { S.doFix(); return '수리 — 부품을 쓰고 선체와 열이 돌아옵니다'; }],
    ['열 90', (S) => { S.setHeat(90); return '열 90 — 냉각제를 쓰거나 식기를 기다립니다'; }],
    ['열 0', (S) => { S.setHeat(0); return '식혔습니다'; }],
    ['영구 손상 하나', (S) => { S.giveScar(); return '흉터 — 이건 수리로 안 돌아옵니다'; }],
  ]],

  // ══ 항로 — 어디까지 갔나 ═══════════════════════════════════════════
  ['항로 · 장면', [
    ['구간 3 (행성)', (S) => { S.setLeg(3); S.seekScene(600); return '구간 3 — 장면 B(행성)'; }],
    ['구간 6 (자세 제어)', (S) => { S.setLeg(6); S.seekScene(600); return '구간 6 — 장면 C'; }],
    ['구간 9 (감압)', (S) => { S.setLeg(9); S.seekScene(600); return '구간 9 — 장면 A+F'; }],
    ['구간 12 (투하)', (S) => { S.setLeg(12); S.seekScene(600); return '구간 12 — 장면 J(투하)'; }],
    ['이 구간 건너뛰기', (S) => { S.skipLeg(); return '다음 거점으로'; }],
    ['박자 넘기기', (S) => S.skipBeat() && '다음 박자로'],
    ['★ 바로 끝 화면', (S) => { S.seekEnd(); return '마지막 구간 끝 — 곧 도착합니다'; }],
    ['행성 곁으로', (S) => { S.setRegion('planet'); return '행성 곁 — 끌려갑니다'; }],
    ['내릴 자리 띄우기', (S) => { S.offerLand(false); return '「내린다 / 지나친다」가 떴습니다'; }],
    ['바로 착지', (S) => { S.putLand('landed', 1); return '내려앉았습니다'; }],
    ['하늘로', (S) => { S.putLand('none', 0); return '우주로 돌아왔습니다'; }],
  ]],
];

/**
 * @param onShut ★★★ v129 — **닫혔다**고 알린다. 잠금을 다시 걸지는
 *   **여기서 못 정한다** — 다른 모드(베이 · 배치 · 도움말)가 아직 열려
 *   있으면 잠그면 안 되고, 그것을 아는 것은 `game/mode-table.js` 다.
 *   ★ 그래서 여기는 **알리기만** 한다 — 「재는 곳을 둘로 만들지 않는다」
 */
export function buildCheck(onShut = null) {
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
    const was = !box.hidden;
    box.hidden = on === undefined ? !box.hidden : !on;
    // 열려 있는 동안은 마우스를 써야 하므로 포인터 잠금을 푼다
    if (!box.hidden && document.pointerLockElement) document.exitPointerLock();
    // ★★★ v129 — **닫힐 때 알린다.** 여는 것만 있고 닫는 것이 없어서,
    //   점검 모드를 닫고 나면 화면을 눌러야 조종간이 살아났다 —
    //   사장님이 배치(U)에서 겪으신 것과 같은 병이다 (`space-check.js [3]`
    //   이 「화면을 누르니 다시 잠긴다」로 오래 빨갰던 자리이기도 하다)
    if (was && box.hidden) onShut?.();
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
