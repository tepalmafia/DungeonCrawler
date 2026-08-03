// ══════════════════════════════════════════════════════════════════════════
//  「뿌리친 3초」를 **실제로 재 본다** — 소리는 눈으로 못 본다.
//
//    python3 tools/serve.py 8391 &
//    node tools/space-audio.js [포트]
//
//  ★ 왜 이 검사가 필요한가
//    이 게임의 보상은 뿌리친 직후 3초다 (docs/space/USER-VIEW.md §3-6).
//    그런데 소리는 **스크린샷에 안 찍힌다.** 「났나 안 났나」조차 화면으로는
//    모른다. 지금까지 이 저장소가 제일 자주 밟은 함정이 「고쳤는데 화면이
//    그대로다」였는데, 소리는 그 함정의 더 나쁜 판본이다 — 안 나도 아무
//    표시가 없다.
//
//  ★ 게임과 **똑같은 코드**를 잰다
//    게임이 실제로 쓰는 core/audio.js 를 OfflineAudioContext 에 태워
//    파형을 뽑고 0.1초마다 크기(RMS)를 센다. 검사용으로 따로 짜서 재면
//    검사는 통과하는데 게임은 안 나는 상태가 생긴다.
//
//  ★ 「좋은 소리인가」는 여기서 안 나온다
//    잴 수 있는 것은 **모양**뿐이다 — 추격이 두껍고, 뿌리치면 푹 꺼지고,
//    천천히 돌아오는가. 듣기 좋은지는 직접 들어 봐야 안다.
// ══════════════════════════════════════════════════════════════════════════
const PW = ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs'];
let chromium = null;
for (const m of PW) { try { ({ chromium } = await import(m)); break; } catch { /* 다음 것 */ } }
if (!chromium) {
  console.error('playwright 가 없습니다.  npm i -g playwright  뒤에 다시 돌리세요.');
  process.exit(2);
}

const PORT = process.argv[2] || '8391';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);

let fail = 0;
const ok = (c, msg) => { console.log((c ? '  ✔ ' : '  ✘ ') + msg); if (!c) fail++; };
const f2 = (v) => (v == null ? '—' : v.toFixed(4));

console.log('\n[1] 소리 그래프가 서 있나');
const a0 = await p.evaluate(() => SPACE.audio);
ok(a0.on, `소리가 켜졌다 (상태 ${a0.state})`);

console.log('\n[2] 뿌리친 3초 — 파형을 실제로 뽑아 잰다');
const r = await p.evaluate(() => SPACE.auditEscape({ chaseFor: 3, tail: 2.5 }));
const at = Math.round(r.escapeAt / r.step);          // 뿌리친 칸
const seg = (from, to) => r.rms.slice(Math.max(0, from), to);
const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

// 칸 번호로 옮긴다 — 뿌리친 시각을 0 으로 본다
const box = (t) => at + Math.round(t / r.step);

// ★ 침묵을 **보상음이 끝난 뒤**에서 잰다.
//   보상음(chime)은 일부러 덕킹을 안 받고 정적 위에 뜨므로, 그게 울리는
//   동안을 재면 「조용해졌나」가 아니라 「보상음이 크나」를 재게 된다.
//   처음에 0.6~1.4초를 재고 「36% 로 꺼진다」고 적었는데, 그 값은
//   대부분 보상음이었다. 재는 자리를 잘못 잡으면 통과해도 아무것도 모른다.
const chase = avg(seg(at - 10, at));
const quiet = avg(seg(box(1.3), box(2.0)));
const chime = Math.max(...seg(box(0.45), box(1.15)));
const back = avg(seg(box(r.total + 0.6), box(r.total + 1.8)));

console.log(`  추격 ${f2(chase)}  →  침묵 ${f2(quiet)}  →  되돌아옴 ${f2(back)}`);
ok(chase > 0.004, '추격 중에 소리가 난다');
ok(quiet < chase * 0.35, `뿌리치면 확 꺼진다 (${(quiet / chase * 100).toFixed(0)}% 로)`);
ok(back > quiet * 2, '다시 돌아온다 — 끊긴 채로 끝나지 않는다');
ok(Math.abs(back - chase) / chase < 0.5, '돌아온 크기가 추격 전과 얼추 같다');

console.log(`  보상음이 정적 위로 ${f2(chime)} (바닥의 ${(chime / quiet).toFixed(1)}배)`);
ok(chime > quiet * 2, '안도의 음이 정적 위로 뜬다 — 같이 묻히지 않는다');

// ★ 내려가는 건 빠르고 올라오는 건 느려야 한다.
//   반대면 안도가 아니라 불안이 된다 — 슬금슬금 사라지는 건 무언가
//   다가올 때의 모양이다.
const half = quiet + (chase - quiet) * 0.5;
let down = null, up = null;
for (let i = at; i < r.rms.length; i++) if (r.rms[i] < half) { down = (i - at) * r.step; break; }
for (let i = box(2.0); i < r.rms.length; i++) if (r.rms[i] > half) { up = (i - at) * r.step; break; }
const rise = up === null ? null : up - (r.total - 1.65);   // 올라오기 시작한 뒤 걸린 시간
console.log(`  절반까지 내려가는 데 ${f2(down)}초 · 올라오기 시작해 절반까지 ${f2(rise)}초`);
ok(down !== null && down < 0.8, '내려가는 건 빠르다');
ok(rise !== null && down !== null && rise > down * 1.5, '올라오는 건 그보다 느리다');

console.log('\n[3] 침묵이 실제로 이어지나 (한 칸도 안 튀어야 한다)');
const spikes = seg(box(1.3), box(2.0)).filter((v) => v > chase * 0.5).length;
ok(spikes === 0, `조용한 구간에 추격 소리가 안 샌다 (튄 칸 ${spikes})`);

console.log('\n[4] 떨림이 소리와 **같은 모양**인가');
const rows = [0, 0.4, 1.0, 1.5, 2.4, 3.15];
for (const t of rows) {
  const s = await p.evaluate((x) => SPACE.shakeAt(x), t);
  console.log(`   ${t.toFixed(2)}초 → 떨림 ${s}`);
}
const s0 = await p.evaluate(() => SPACE.shakeAt(0.4));
const s1 = await p.evaluate(() => SPACE.shakeAt(3.15));
ok(s0 < 0.3, '제일 조용할 때 떨림도 바닥이다 (손이 떨림을 멈춘다)');
ok(Math.abs(s1 - 1) < 0.01, '3.15초에 떨림이 평소로 돌아온다 — 소리와 같은 시각');

// ★ 위의 [4] 는 **순수 함수**를 잰 것이다 — 게임 루프가 그걸 실제로 쓰는지는
//   따로 봐야 한다. 표는 맞는데 아무도 안 읽는 상태가 이 저장소의 단골이다.
console.log('\n[4-2] 게임이 그 모양을 정말 쓰나 (실제 루프에서)');
await p.mouse.click(400, 300);                       // 포인터 잠금 + 소리 깨우기
await p.evaluate(() => { SPACE.resetChase(); SPACE.forceContact(); });
await p.waitForFunction(() => SPACE.chase.phase === 'chase', null, { timeout: 15000 });
await p.waitForFunction(() => SPACE.audio.shake > 1.2, null, { timeout: 15000 })
  .then(() => ok(true, '추격이 붙으면 배가 더 떤다'))
  .catch(async () => ok(false, `추격 중인데 떨림이 그대로다 (${(await p.evaluate(() => SPACE.audio.shake))})`));

await p.evaluate(() => SPACE.setDist(100));
// ★ 고정 대기를 안 쓴다. 헤드리스는 1~3fps 라 게임 시간이 실시간과 다르다
await p.waitForFunction(() => SPACE.chase.phase === 'shaken' && SPACE.audio.since > 0.5,
  null, { timeout: 20000 });
const live = await p.evaluate(() => SPACE.audio);
console.log(`   뿌리친 뒤 ${live.since}초 → 떨림 ${live.shake}`);
ok(live.shake < 0.4, '뿌리치면 그 자리에서 잔잔해진다');

console.log('\n[5] 끄는 방법이 있나');
ok((await p.evaluate(() => SPACE.mute(true))) === true, 'M 으로 끈다');
ok((await p.evaluate(() => SPACE.mute(false))) === false, '다시 켠다');

console.log(errs.length ? `\n오류: ${errs.join(' / ')}` : '\n오류 없음');
if (errs.length) fail++;
await b.close();
console.log(fail ? `\n✘ ${fail}개 실패` : '\n✔ 전부 통과');
process.exit(fail ? 1 : 0);
