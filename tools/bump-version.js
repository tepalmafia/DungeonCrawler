// ══════════════════════════════════════════════════════════════════════════
//  버전 올리기 — VERSION 과 index.html 캐시버스트를 **한 번에** 맞춘다.
//
//    node tools/bump-version.js 3d 190      던전을 190 으로
//    node tools/bump-version.js space 4     스페이스워를 4 로
//    node tools/bump-version.js space       현재 VERSION 으로 index.html 만 동기화
//
//  ★ 왜 도구가 필요한가 (v190 실사고)
//    v187·v188·v189 세 번의 빌드 동안 index.html 의 `?v=` 25개가 전부 186에 멈춰 있었다.
//    VERSION 은 main.js 에 있고 캐시버스트는 index.html 에 있어서, 버전을 올릴 때마다
//    한쪽만 올라갔다. 그러면 브라우저가 파일마다 제각각 갱신돼
//    **main.js 는 v189인데 enemies.js 는 v186** 인 상태가 만들어질 수 있다 —
//    화면에는 v189라고 찍히면서 그 버전의 변경은 적용되지 않는다.
//    "체감이 없다"는 보고가 코드가 아니라 여기서 나올 수 있었다.
//
//  ★ 왜 대상을 인자로 받는가 (같은 사고의 두 번째 판)
//    이 도구는 원래 옛 2D 게임(web/)을 **하드코딩으로** 보고 있었다. 3D 버전을
//    올리려고 돌렸더니 **엉뚱한 파일이 바뀌고 3D 는 그대로 남았는데 로그에는
//    성공이라고 찍혔다.** 게임이 하나뿐일 때조차 그랬다.
//
//    이제 이 저장소에 게임이 둘이다 (던전 · 스페이스워). 하드코딩을 그대로
//    두면 같은 사고가 반드시 다시 난다 — **대상을 반드시 말하게 한다.**
//    빠뜨리면 아무것도 안 하고 멈춘다. 조용히 엉뚱한 것을 고치는 것보다
//    낫다 (docs/POSTMORTEM.md §1-⑤).
// ══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// 이 저장소의 게임들. 새 게임이 생기면 **여기 한 줄만** 는다.
const GAMES = {
  '3d': { dir: 'web/3d', name: '심연의 왕관 (던전)' },
  space: { dir: 'web/space', name: '스페이스워' },
};

const which = process.argv[2];
if (!which || !GAMES[which]) {
  console.error('사용법: node tools/bump-version.js <게임> [버전번호]');
  console.error('\n게임:');
  for (const [k, g] of Object.entries(GAMES)) console.error(`  ${k.padEnd(6)} ${g.name}  (${g.dir})`);
  process.exit(1);
}

const G = GAMES[which];
const MAIN = path.join(ROOT, G.dir, 'js/main.js');
const HTML = path.join(ROOT, G.dir, 'index.html');
for (const f of [MAIN, HTML]) {
  if (!fs.existsSync(f)) {
    console.error(`없는 파일: ${path.relative(ROOT, f)}`);
    process.exit(1);
  }
}

let main = fs.readFileSync(MAIN, 'utf8');
const RE = /export const VERSION = (\d+)/;
const cur = parseInt((main.match(RE) || [, '0'])[1], 10);
const want = parseInt(process.argv[3] || String(cur), 10);
if (!Number.isFinite(want) || want <= 0) {
  console.error('사용법: node tools/bump-version.js <게임> [버전번호]');
  process.exit(1);
}

if (want !== cur) {
  main = main.replace(RE, `export const VERSION = ${want}`);
  fs.writeFileSync(MAIN, main);
}

let html = fs.readFileSync(HTML, 'utf8');
const before = [...html.matchAll(/\?v=(\d+)/g)].map((m) => m[1]);
html = html.replace(/\?v=\d+/g, `?v=${want}`);
fs.writeFileSync(HTML, html);

const uniqBefore = [...new Set(before)];
console.log(`${G.name} — ${G.dir}`);
console.log(`  VERSION ${cur} → ${want}`);
console.log(`  index.html 캐시버스트 ${before.length}개: ${uniqBefore.join(',') || '없음'} → ${want}`);
if (uniqBefore.length === 1 && uniqBefore[0] === String(cur) && want === cur) {
  console.log('  (이미 일치)');
} else if (before.length && !uniqBefore.includes(String(cur))) {
  console.log(`  ⚠ 어긋나 있었다 — 캐시버스트가 ${uniqBefore.join(',')} 인데 게임은 v${cur} 였다`);
}
