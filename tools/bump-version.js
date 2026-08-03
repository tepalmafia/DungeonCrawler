// ══════════════════════════════════════════════════════════════════════════
//  버전 올리기 — GAME_VERSION 과 index.html 캐시버스트를 **한 번에** 맞춘다.
//    node tools/bump-version.js 190     (지정)
//    node tools/bump-version.js         (현재 GAME_VERSION 으로 index.html만 동기화)
//
//  ★ 왜 도구가 필요한가 (v190 실사고)
//    v187·v188·v189 세 번의 빌드 동안 index.html 의 `?v=` 25개가 전부 186에 멈춰 있었다.
//    GAME_VERSION 은 main.js 에 있고 캐시버스트는 index.html 에 있어서, 버전을 올릴 때마다
//    한쪽만 올라갔다. 그러면 브라우저가 파일마다 제각각 갱신돼
//    **main.js 는 v189인데 enemies.js 는 v186** 인 상태가 만들어질 수 있다 —
//    화면에는 v189라고 찍히면서 그 버전의 변경은 적용되지 않는다.
//    "체감이 없다"는 보고가 코드가 아니라 여기서 나올 수 있었다.
//    두 값이 한 명령으로만 움직이게 하고, 회귀(release.cacheBustMatchesVersion)가 어긋남을 잡는다.
// ══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// ★ **어느 게임인가** — 이 도구는 원래 옛 2D 게임(web/)용이었다. 지금 만드는
//   것은 web/3d/ 라서, 아무 생각 없이 돌리면 **엉뚱한 파일의 버전이 올라가고
//   3D 는 그대로 남는다.** 실제로 한 번 그랬다(로그에는 성공이라고 찍힌다).
//   기본을 3d 로 두고, 옛 게임은 `--legacy` 로만 만진다.
const LEGACY = process.argv.includes('--legacy');
const DIR = LEGACY ? 'web' : 'web/3d';
const MAIN = path.join(ROOT, DIR, 'js/main.js');
const HTML = path.join(ROOT, DIR, 'index.html');

let main = fs.readFileSync(MAIN, 'utf8');
const RE = LEGACY ? /const GAME_VERSION = (\d+)/ : /export const VERSION = (\d+)/;
const cur = parseInt((main.match(RE) || [, '0'])[1], 10);
const want = parseInt(process.argv[2] || String(cur), 10);
if (!Number.isFinite(want) || want <= 0) {
  console.error('사용법: node tools/bump-version.js [버전번호]');
  process.exit(1);
}

if (want !== cur) {
  main = main.replace(RE, LEGACY ? `const GAME_VERSION = ${want}` : `export const VERSION = ${want}`);
  fs.writeFileSync(MAIN, main);
}

let html = fs.readFileSync(HTML, 'utf8');
const before = [...html.matchAll(/\?v=(\d+)/g)].map((m) => m[1]);
html = html.replace(/\?v=\d+/g, `?v=${want}`);
fs.writeFileSync(HTML, html);

const uniqBefore = [...new Set(before)];
console.log(`GAME_VERSION ${cur} → ${want}`);
console.log(`index.html 캐시버스트 ${before.length}개: ${uniqBefore.join(',')} → ${want}`);
if (uniqBefore.length === 1 && uniqBefore[0] === String(cur) && want === cur) {
  console.log('  (이미 일치)');
} else if (!uniqBefore.includes(String(cur))) {
  console.log(`  ⚠ 어긋나 있었다 — 캐시버스트가 ${uniqBefore.join(',')} 인데 게임은 v${cur} 였다`);
}
