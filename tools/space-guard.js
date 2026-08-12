// ══════════════════════════════════════════════════════════════════════════
//  덮개·가드가 **제 구실을 하나** — 실제 브라우저에서.
//
//    python3 tools/serve.py 8391 &
//    node tools/space-guard.js
//
//  ★ 왜 (docs/space/REALSHIP.md §3 · 사장님 「실제 우주선 형태를 고증해서」)
//    크루 드래건은 물리 버튼 상당수를 **투명 덮개 아래** 뒀고, 셔틀은
//    토글 스위치를 **움푹 들어가게** 박고 사이에 **철사 가드**를 넣었다.
//    쓸 일이 없어야 하는 것과 자주 쓰는 것을 **생김새로** 가르는 문법이다.
//
//  ★ 그런데 덮개는 장식이 아니라 **계기**로 쓴다
//    비상 크랭크 덮개는 닫혀 있으면 「이 문은 멀쩡하다」, 젖혀져 있으면
//    「여기가 끼었다」이다. 그래서 이 검사가 묻는 것은 「덮개를 만들었나」가
//    아니라 **「끼었을 때 정말 젖혀지나」** 다. 안 젖혀지면 그냥 유리판이고,
//    그건 배를 더 어수선하게 만들 뿐이다.
//
//  ★ 그리고 **덮개가 손을 막으면 안 된다**
//    조준선은 정해진 판정 상자만 쏘므로(main.js interactStep) 눈에만 있는
//    철사·유리는 손을 안 막는다. 하지만 그건 **확인해야 아는 것**이다 —
//    덮개를 달고 크랭크가 안 잡히면 문 하나가 통째로 잠긴다.
// ══════════════════════════════════════════════════════════════════════════
// ★★★ v124 — **접혔으면 여기서 물러난다** (사장님 「낡은 절들 정리해줘」).
//   브라우저를 띄우기 **전에** 부른다 — 띄운 뒤면 접힌 검사도 30초씩 먹는다.
//   접힌 목록과 까닭은 `game/pilot-table.js FOLDED_CHECKS` 한 곳에 있다
import { bailIfFolded } from './folded.js';
bailIfFolded('space-guard');

const PW = ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs'];
let chromium = null;
for (const m of PW) { try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ } }
if (!chromium) {
  console.error('playwright 가 없습니다.  npm i -g playwright  뒤에 다시 돌리세요.');
  process.exit(2);
}
const PORT = process.argv[2] || '8391';
const SP = process.env.SHOTS || null;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 640, height: 380 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };
const S = (fn, a) => p.evaluate(fn, a);
const until = async (fn, sec = 40, note = '', arg) => {
  const t0 = Date.now();
  while (Date.now() - t0 < sec * 1000) {
    if (await p.evaluate(fn, arg)) return true;
    await p.waitForTimeout(500);
  }
  console.log(`     (${note} 기다리다 지침)`);
  return false;
};
// ══ ★★★ v121 — **한복판을 눈 감고 누르지 않는다** ═══════════════════
//
//  ★ 여기가 `mouse.click(320, 190)` 이었다. 시작 화면이 생기기 전에 쓴
//    줄인데, 지금은 한복판에 **단추가 서 있다.** 「처음부터 다시」를
//    누르면 `location.reload()` 가 돌고, 그러면 검사가
//    「Execution context was destroyed」로 통째로 죽는다.
//  ★★ 그래서 **누를 것을 이름으로 부른다.** 좌표로 누르는 줄은 화면이
//    바뀔 때마다 말없이 엉뚱한 것을 누르게 된다 — 이 저장소가
//    `space-check.js` 를 만든 이유가 바로 그것이었다
await p.click('#btn-play').catch(() => {});
await p.waitForTimeout(600);
await S(() => { document.getElementById('hint')?.remove(); SPACE.skipTutor(); });

console.log('\n[1] 평소에는 **닫혀 있다** — 다 열려 있으면 아무 말도 안 하는 것이다');
{
  const c = await S(() => SPACE.covers);
  const keys = Object.keys(c);
  ok(keys.length >= 6, `문 ${keys.length} 개에 덮개가 있다`);
  const open = keys.filter((k) => c[k].open > 0.2);
  ok(open.length === 0, `멀쩡한 문의 덮개는 다 닫혀 있다 — ${open.join(' · ') || '열린 것 없음'}`);
}

console.log('\n[2] ★ **끼면 젖혀진다** — 이게 이 덮개의 일이다');
{
  ok(await S(() => SPACE.jam('engine')), '기관실 문을 끼운다');
  const flipped = await until(() => SPACE.covers.engine.open > 1.2, 30, '덮개가 젖혀지는 것');
  const c = await S(() => SPACE.covers);
  ok(flipped, `끼인 문의 덮개가 젖혀졌다 — ${c.engine.open} rad`);
  // 다른 문은 그대로여야 한다. 하나가 끼었다고 배 전체가 열리면
  // **어느 문인지**를 못 말한다
  const others = Object.keys(c).filter((k) => k !== 'engine' && c[k].open > 0.2);
  ok(others.length === 0, `끼지 않은 문은 그대로다 — ${others.join(' · ') || '없음'}`);
}

console.log('\n[3] 덮개가 **손을 막지 않는다** — 막으면 문 하나가 통째로 잠긴다');
{
  // 기관실 문 앞에 서서 크랭크를 겨눈다. 문은 통로 z=10 에 있다
  const at = await S(() => SPACE.doorsRaw.find((d) => d.key === 'engine'));
  ok(!!at, `기관실 문 (${at?.x}, ${at?.z})`);
  // ★ 크랭크는 문 **중심이 아니라 문틀 기둥**에 붙어 있다. 문 좌표에서
  //   눈대중으로 옆으로 비켜서 봤더니 다섯 각도를 다 훑고도 안 잡혔다 —
  //   게임이 아니라 검사가 엉뚱한 데를 보고 있었다. **물어보고 간다**
  const c = await S((k) => SPACE.crankAt(k), 'engine');
  ok(!!c, `크랭크 자리 (${c?.x}, ${c?.y}, ${c?.z})`);
  // 통로 쪽(z 가 작은 쪽)에서 다가서서 **정확히 크랭크를 본다**
  const sx = c.x, sz = c.z - 0.85;
  const yaw = Math.atan2(-(c.x - sx), -(c.z - sz));
  const pitch = Math.atan2(c.y - 1.62, Math.hypot(c.x - sx, c.z - sz));
  await S(([a, b, y, q]) => SPACE.put(a, b, y, q), [sx, sz, yaw, pitch]);
  await until(([a, b]) => {
    const q = SPACE.camera.getWorldPosition(new SPACE.THREE.Vector3());
    return Math.abs(q.x - a) < 0.05 && Math.abs(q.z - b) < 0.05;
  }, 20, '카메라가 따라오는 것', [sx, sz]);
  const got = await until(() => /crank/.test(SPACE.aim ?? ''), 20, '크랭크 조준') ? yaw : null;
  ok(got !== null, `덮개 너머로 크랭크가 잡힌다 — aim=${await S(() => SPACE.aim) ?? '없음'}`);

  if (got !== null) {
    // 그리고 **정말 돌아가나.** 잡히기만 하고 안 돌면 잠긴 것과 같다
    // ★ Playwright 의 mouse.down() 은 포인터 잠금에서 좌표를 movementX 로
    //   보내 **시야를 홱 돌린다** — 누르는 순간 조준을 놓친다. 게임이 듣는
    //   이벤트를 그대로 만들어 보낸다 (tools/space-yoke.js 에서 데인 것)
    await S(() => dispatchEvent(new MouseEvent('mousedown', { button: 0 })));
    // ★ **다 돌 때까지 안 기다린다.** 크랭크는 9초를 돌려야 풀리는데
    //   헤드리스는 게임 시간이 실시간의 20분의 1이라 3분이 넘게 걸린다.
    //   여기서 묻는 것은 「덮개가 손을 막나」지 「크랭크가 몇 초인가」가
    //   아니다 — 그건 `tools/space-door.js` 가 브라우저 없이 잰다.
    //   **0 에서 움직였으면 안 막힌 것이다**
    const turned = await until(() => SPACE.doors.find((d) => d.key === 'engine').held > 0.01,
      40, '크랭크가 돌아가는 것');
    const held = await S(() => SPACE.doors.find((d) => d.key === 'engine').held);
    await S(() => dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
    ok(turned, `잡으니 돌아간다 — held ${held}`);
    if (SP) await p.screenshot({ path: `${SP}/크랭크덮개.png`, timeout: 90000 });
  }
}

console.log('\n[4] 차단기 철사 가드 — **눈에는 있고 손은 안 막는다**');
{
  const wires = await S(`(() => {
    const T = SPACE.THREE;
    let n = 0;
    SPACE.shipGroup.traverse((o) => {
      if (o.geometry?.type === 'CylinderGeometry'
        && o.geometry.parameters.radiusTop === 0.012) n++;
    });
    return n;
  })()`);
  ok(wires >= 8, `가드 철사 ${wires} 개 (차단기 셋이면 세로 4 + 가로 8)`);

  // 차단기가 여전히 잡히나 — 가드가 조준을 먹으면 전력 배분이 통째로 막힌다
  await S(() => SPACE.put(0.15, 3.3, Math.PI / 2, 0));
  await until(() => {
    const q = SPACE.camera.getWorldPosition(new SPACE.THREE.Vector3());
    return Math.abs(q.x - 0.15) < 0.05 && Math.abs(q.z - 3.3) < 0.05;
  }, 20, '카메라가 따라오는 것');
  let hitBreaker = null;
  for (const pitch of [-0.15, -0.25, -0.05, -0.35]) {
    await S((pp) => SPACE.put(0.15, 3.3, Math.PI / 2, pp), pitch);
    if (await until(() => /^(thrust|cool|sensor)$/.test(SPACE.aim ?? ''), 6, '')) {
      hitBreaker = await S(() => SPACE.aim); break;
    }
  }
  ok(!!hitBreaker, `가드 사이로 차단기가 잡힌다 — ${hitBreaker ?? `aim=${await S(() => SPACE.aim)}`}`);
  if (SP) { await p.waitForTimeout(600); await p.screenshot({ path: `${SP}/가드.png`, timeout: 90000 }); }
}

console.log('');
if (errs.length) { console.log('콘솔 오류:'); for (const e of errs.slice(0, 5)) console.log('  ' + e); fail += errs.length; }
else console.log('오류 없음');
console.log(fail ? `\n✘ ${fail} 군데` : '\n✔ 전부 통과');
if (SP) console.log(`  (${SP}/가드.png 저장)`);
await b.close();
process.exit(fail ? 1 : 0);
