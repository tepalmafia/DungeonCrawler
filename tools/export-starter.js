// ══════════════════════════════════════════════════════════════════════════
//  뼈대 뽑기 — 다음 게임의 새 저장소로 **검증된 것만** 복사한다.
//
//    node tools/export-starter.js ../spacewar
//    node tools/export-starter.js ../spacewar --name spacewar --title "스페이스워"
//    node tools/export-starter.js ../spacewar --force     이미 있는 파일도 덮는다
//
//  무엇을 뽑고 무엇을 안 뽑는지는 `docs/REUSE.md` 에 적혀 있다.
//  요약하면: **장르와 무관하게 맞았던 것만** 나간다 (시드 RNG · 로컬 서버 ·
//  캐시버스트 동기화 · 에셋 목록 · 포스트모템). 표·시뮬·밸런스 숫자는
//  새 게임의 것이라 **안 나간다** — 그 자리를 채우는 게 새 저장소의 첫 작업이다.
//
//  ★ 이 도구가 지키는 것: **조용히 실패하지 않는다.**
//    경로를 바꿔 넣는 치환이 하나라도 안 맞으면 그 자리에서 말한다.
//    「복사는 됐는데 안에 옛 경로가 남아 있다」가 제일 나쁜 결과다 —
//    도구는 성공이라 찍고 새 저장소에서는 아무것도 안 돈다
//    (docs/POSTMORTEM.md §1-⑤ 와 같은 실패다).
// ══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── 인자 ────────────────────────────────────────────────────
// 값을 받는 것과 안 받는 것을 갈라 놓고 한 번에 훑는다.
// (indexOf 로 찾으면 같은 문자열이 두 번 나올 때 엉뚱한 자리를 짚는다)
const VALUED = new Set(['--name', '--title']);
const argv = process.argv.slice(2);
const opts = {};
let target = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (VALUED.has(a)) opts[a.slice(2)] = argv[++i];
  else if (a.startsWith('--')) opts[a.slice(2)] = true;
  else if (target === null) target = a;
}
const flag = (k, def = null) => (typeof opts[k] === 'string' ? opts[k] : def);
const FORCE = opts.force === true;

if (!target) {
  console.error('사용법: node tools/export-starter.js <대상폴더> [--name 저장소이름] [--title 게임이름] [--force]');
  process.exit(1);
}
const OUT = path.resolve(process.cwd(), target);
const NAME = flag('name', path.basename(OUT));
const TITLE = flag('title', NAME);

// ── 쓰기 ────────────────────────────────────────────────────
let wrote = 0, skipped = 0;

function put(rel, body) {
  const dst = path.join(OUT, rel);
  if (fs.existsSync(dst) && !FORCE) {
    console.log(`  건너뜀  ${rel}   (이미 있다 — 덮으려면 --force)`);
    skipped++;
    return;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, body);
  console.log(`  씀      ${rel}`);
  wrote++;
}

/**
 * 원본을 읽어 경로만 바꿔서 내보낸다.
 * @param subs [찾을 문자열, 바꿀 문자열] 목록. **하나라도 안 맞으면 멈춘다.**
 */
function copy(from, rel, subs = []) {
  let src = fs.readFileSync(path.join(ROOT, from), 'utf8');
  for (const [a, b] of subs) {
    if (!src.includes(a)) {
      console.error(`\n✘ ${from}: 바꿀 자리를 못 찾았다 —\n    ${a}`);
      console.error('  원본이 바뀌었다. 이 도구의 치환 목록을 고쳐야 한다.');
      process.exit(1);
    }
    src = src.split(a).join(b);
  }
  put(rel, src);
}

console.log(`\n${NAME} 뼈대를 ${OUT} 에 뽑는다\n`);

// ── 1. 그대로 나가는 것 ─────────────────────────────────────
// 그래픽·에셋·확인 방법의 실패 기록. 장르와 무관하다.
copy('docs/POSTMORTEM.md', 'docs/POSTMORTEM.md');
// 40줄, 의존성 0. ?seed=ABC123 규약까지 그대로 쓴다.
copy('web/3d/js/core/rng.js', 'web/js/core/rng.js', [
  ['// 기존 2D 게임(web/js/core/rng.js)과 같은 규약: 문자열 시드 → 32bit → mulberry32.',
    '// 규약: 문자열 시드 → 32bit → mulberry32. (DungeonCrawler 에서 그대로 가져왔다)'],
]);

// ── 2. 경로만 바꿔서 나가는 것 ──────────────────────────────
// 새 저장소는 web/ 하나뿐이다. DungeonCrawler 의 /3d 는 옛 2D 게임과 나란히
// 두느라 생긴 이름이라 따라가지 않는다.
copy('tools/serve.py', 'tools/serve.py', [
  ['# 로컬 검증용 정적 서버 — tools/verify.js 가 이걸 붙잡고 돈다.',
    '# 로컬 정적 서버 — 게임을 열려면 필요하다.'],
  ['(web/3d/js/core/assets.js)', '(web/js/core/assets.js)'],
  ["os.path.join(os.getcwd(), '3d', 'assets')", "os.path.join(os.getcwd(), 'assets')"],
  // 따옴표까지 넣어 찾았더니 **코드 줄만 바뀌고 주석의 같은 경로가 남았다.**
  // 경로만으로 찾아 둘 다 잡는다.
  ['/3d/assets/index.json', '/assets/index.json'],
]);
copy('tools/bump-version.js', 'tools/bump-version.js', [
  [`// ★ 이 도구는 원래 옛 2D 게임(web/)을 보고 있었다. 3D 버전을 올리려고 돌렸더니
//   **엉뚱한 파일이 바뀌고 3D 는 그대로 남았다** — 로그에는 성공이라고 찍힌다.
//   옛 2D 게임은 지웠고, 이제 대상은 web/3d 하나뿐이다.`,
    `// ★ 대상이 이 두 줄뿐이다. 폴더 구조를 바꿨다면 **여기부터** 맞춘다 —
//   엉뚱한 파일을 고쳐도 로그에는 성공이라고 찍힌다 (DungeonCrawler 에서 실제로 났다).`],
  ["'web/3d/js/main.js'", "'web/js/main.js'"],
  ["'web/3d/index.html'", "'web/index.html'"],
]);

// ── 3. 틀만 나가는 것 ───────────────────────────────────────
// 원본 tools/assets.js 는 테마·아이템·스킬트리 열쇠를 정규식으로 만들어 낸다 —
// 그건 DungeonCrawler 의 규격표 모양이다. 여기서는 **대놓고 적힌 열쇠만** 읽는
// 일반형으로 줄여 내보낸다. 반복문이 만드는 열쇠가 필요해지면 원본을 보고 붙인다.
put('tools/assets.js', `// ══════════════════════════════════════════════════════════════════════════
//  그림 목록 만들기 + 지금 몇 장 들어왔나
//
//    node tools/assets.js          현황만 본다
//    node tools/assets.js --write  assets/index.json 을 다시 쓴다 (배포용)
//
//  ★ 왜 목록 파일이 필요한가
//    브라우저는 폴더를 못 훑는다. 파일마다 「있나?」를 물어보면 없는 것마다
//    404 가 찍혀 콘솔이 빨갛게 덮이고, 그 뒤에 진짜 오류가 숨는다.
//    그래서 목록을 미리 만들어 두고 게임은 그것 하나만 읽는다.
//
//    로컬에서는 \`tools/serve.py\` 가 요청받을 때마다 폴더를 훑어 만들어 준다 —
//    파일을 넣고 새로고침하면 바로 나온다. 이 도구는 **배포용**이다
//    (GitHub Pages 는 정적이라 훑어 줄 사람이 없다).
//
//  규격은 \`web/js/core/asset-table.js\` 한 곳에만 있다. 여기에 다시 안 적는다.
// ══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'web/assets');
const TABLE = path.join(ROOT, 'web/js/core/asset-table.js');

if (!fs.existsSync(TABLE)) {
  console.error('규격표가 없다: web/js/core/asset-table.js');
  console.error('그림을 넣기 전에 규격표부터 만든다 — 규격은 거기 한 곳에만 적는다.');
  process.exit(1);
}

// 규격표는 ES 모듈이고 이 도구는 CommonJS 다. 빌드 도구를 들이지 않으려고
// 표의 **열쇠만** 정규식으로 뽑는다 — 표가 바뀌면 여기도 따라온다.
//
// 원본(DungeonCrawler)은 반복문이 만드는 열쇠까지 읽었다. 그게 필요해지면
// 그쪽 tools/assets.js 를 보고 붙인다.
const src = fs.readFileSync(TABLE, 'utf8');
const ids = new Set();
const optional = new Set();
for (const m of src.matchAll(/'([\\w-]+\\/[\\w/-]+)':\\s*\\{([^}]*)\\}/g)) {
  ids.add(m[1]);
  if (/optional:\\s*true/.test(m[2])) optional.add(m[1]);
}

// 규격표가 쓰는 하위 폴더는 열쇠에서 뽑는다 — 목록을 두 곳에 적지 않는다.
const SUBS = [...new Set([...ids].map((k) => k.split('/')[0]))];

const present = [];
for (const sub of SUBS) {
  const d = path.join(DIR, sub);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    if (/\\.(png|jpg|webp)$/i.test(f)) present.push(\`\${sub}/\${f}\`);
  }
}
present.sort();

const key = (f) => f.replace(/\\.(png|jpg|webp)$/i, '');
const known = present.filter((f) => ids.has(key(f)));
const unknown = present.filter((f) => !ids.has(key(f)));
const missing = [...ids].filter((id) => !present.some((f) => key(f) === id)).sort();
const missingRequired = missing.filter((id) => !optional.has(id));

console.log(\`규격 \${ids.size}칸 · 들어온 것 \${known.length}장\`);
if (missingRequired.length) {
  console.log(\`\\n아직 없는 것 (\${missingRequired.length})\`);
  for (const id of missingRequired) console.log('  ·', id);
}
if (unknown.length) {
  console.log(\`\\n⚠ 규격표에 없는 이름 (\${unknown.length}) — 게임이 안 읽는다\`);
  for (const f of unknown) console.log('  ·', f);
}

if (process.argv.includes('--write')) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, 'index.json'), JSON.stringify(present, null, 0));
  console.log(\`\\nassets/index.json 갱신 — \${present.length}장\`);
}
`);

// bump-version.js 가 붙잡을 두 파일. 게임이 아니라 **배관**이라 최소로 둔다.
put('web/js/main.js', `// 진입점.
//
// VERSION 과 index.html 의 ?v= 는 **항상 같이** 올린다:
//   node tools/bump-version.js 2
// 어긋나면 브라우저가 파일마다 제각각 갱신돼, 화면에는 새 버전이라 찍히면서
// 그 버전의 변경은 적용되지 않는 상태가 만들어진다.
export const VERSION = 1;

console.log(\`${TITLE} v\${VERSION}\`);
`);

put('web/index.html', `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${TITLE}</title>
<script type="module" src="js/main.js?v=1"></script>
</head>
<body>
<canvas id="view"></canvas>
</body>
</html>
`);

// ── 4. 새로 쓰는 것 ─────────────────────────────────────────
put('CLAUDE.md', `# 이 저장소에서 일할 때

## 목적 — 한 줄

> **아직 안 적었다.** 여기를 채우기 전에는 나머지 판단이 전부 근거를 잃는다.
> 어떤 변경이든 「이게 그 한 줄에 보탬이 되는가」로 답이 갈린다.

## 다시 만들기 전에 — \`docs/POSTMORTEM.md\` 를 읽는다

앞 저장소(DungeonCrawler)에서 그래픽 개선에 하루를 쓰고 화면이 그대로였던
일의 기록이다. 일곱 가지 실수와 다시 안 빠지는 방법이 적혀 있다. 요약하면 넷:

1. **화면 면적 순으로 일한다.** 캐릭터는 화면의 2%, 바닥·벽·조명이 98% 다
2. **방향을 정하기 전에 디테일을 만들지 않는다.** 정교함은 방향을 증폭할 뿐이다
3. **확인은 사장님이 보는 조건에서.** 실제 화면 · 실제 브라우저 · **움직이는 상태**
4. **화면이 안 바뀌면 계수를 만지지 말고 값을 찍는다.** 두 번 올려도 안 바뀌면
   세기 문제가 아니라 코드가 안 도는 것이다

## 그림은 내가 그리지 않는다 — **사장님이 주신 것을 쓴다**

**절대 규칙이다. 앞 저장소에서 어길 때마다 사고가 났다** (캐릭터를 코드로 다시
만드는 일을 다섯 판 태웠다). 「제안본」·「시제품」·「샘플」이라는 이름으로도
안 만든다. 그림이 아직 없으면 **기다리고**, 그 사이에 그림 아닌 것을 한다.
「일단 제가 만들어 볼까요」를 **묻지 않는다.**

내가 하는 것과 안 하는 것의 선은 **「좋아 보이는가」로 판정되느냐**다.
기하·배치·조명·충돌은 「맞나 틀리나」라 내가 해도 된다. 몸·무늬·아이콘은 아니다.

## 숫자는 한 곳에만 둡니다

밸런스 값을 **코드에 흩어 놓지 않는다.** 표에 두고 게임과 시뮬이 같은 표를
읽는다. 두 곳에 적으면 반드시 갈라진다.

**표는 렌더러(three.js 등)를 import 하지 않는다.** 그래야 \`tools/sim.js\` 가
브라우저 없이 읽는다. 새 숫자를 넣을 때 렌더러를 끌어오면 그 순간 시뮬이
못 읽는다.

## 목적을 숫자로

「재미있다」는 감상이라 검증할 수 없다. 잴 수 있는 형태로 못박아 두고
**바꿀 때마다 잰다.** 지표와 목표는 기획안에 있고, \`tools/sim.js\` 가 ✔/✘ 로
찍는다. **✘ 가 하나라도 있으면 목적에서 멀어진 것**이고, 그 숫자를 근거로
고친다. 느낌으로 조정하지 않는다.

## 작업 방식

- **고친 것만 잰다.** 기능 하나를 고치면 그것만 재는 스크립트를 쓴다.
  전체 검사를 매번 돌리지 않는다 — 앞 저장소의 13분짜리 전체 검사는
  실제 버그를 한 번도 못 잡았다
- **화면에 보이는 것은 화면으로 확인한다.** UI 를 고쳤으면 스크린샷을 찍어
  같이 보여 준다. 「창이 화면 밖에 그려지고 있었다」를 코드로는 못 찾는다
- **캐시**: \`web/index.html\` 의 \`?v=\` 와 \`js/main.js\` 의 \`VERSION\` 은
  **항상 같이** 올린다 — \`node tools/bump-version.js N\`

## 도구

\`\`\`
python3 tools/serve.py 8137      로컬 서버 (게임을 열려면 필요)
node tools/bump-version.js N     캐시버스트 동기화
node tools/assets.js             그림 몇 장 들어왔나 (--write 로 목록 갱신)
node tools/sim.js                밸런스·템포  ← 아직 없다. 표가 생기면 만든다
\`\`\`

**그림은 \`web/assets/\` 에 떨어뜨리면 게임에 나온다.** 규격은 기계가 읽는 판본
\`web/js/core/asset-table.js\` 한 곳뿐이다 — 문서와 코드에 두 번 적지 않는다.
이름이 틀리면 콘솔이 그 자리에서 알려 준다.

## 글은 한국어로

주석·문서·커밋 메시지 전부 한국어다. **무엇을 했는지가 아니라 왜 그렇게
했는지**를 적는다. 특히 **틀렸다가 고친 것**은 반드시 남긴다 — 같은 함정을
다음에 또 밟는다.

## 앞 저장소

\`github.com/tepalmafia/DungeonCrawler\` (공개). 무엇을 가져왔고 무엇을 두고
왔는지는 그쪽 \`docs/REUSE.md\` 에 줄 단위로 적혀 있다.
`);

put('README.md', `# ${TITLE}

\`\`\`
python3 tools/serve.py 8137
\`\`\`
→ http://127.0.0.1:8137/

## 이 저장소는

\`tools/export-starter.js\` 로 [DungeonCrawler](https://github.com/tepalmafia/DungeonCrawler)
에서 **검증된 뼈대만** 뽑아 온 상태다. 가져온 것과 두고 온 것은 그쪽
\`docs/REUSE.md\` 에 적혀 있다.

가져온 것: 시드 RNG · 로컬 서버(에셋 목록 자동 생성) · 캐시버스트 동기화 ·
에셋 목록 도구 · 포스트모템.
**두고 온 것: 표 · 시뮬 · 밸런스 숫자 · 세계관.** 그건 이 게임의 것이라
여기서 새로 쓴다.

## 다음에 할 일

1. \`CLAUDE.md\` 의 「목적 — 한 줄」을 채운다
2. 목표를 숫자로 적는다 (아직 못 재도 적어 둔다 — 못 재는 것과 안 정한 것은 다르다)
3. **에셋 통로를 뚫는다.** 게임 로직보다 먼저
4. 세로로 한 줄을 끝낸다
5. 표와 \`tools/sim.js\` 를 세운다 — 숫자가 흩어지기 전에
`);

put('.gitignore', `node_modules/
.DS_Store
web/assets/index.json
`);

// ── 5. 잔재 검사 ────────────────────────────────────────────
// 치환 목록을 손으로 관리하는 한 **하나를 빠뜨린다.** 실제로 빠뜨렸다 —
// serve.py 의 경로를 따옴표까지 넣어 찾는 바람에 코드 줄만 바뀌고 주석에
// 옛 경로가 남았다. 그래도 도구는 성공이라 찍었다.
// 그래서 마지막에 뽑아 놓은 것을 다시 훑는다. 이게 §머리말의 약속이다.
const STALE = ['web/3d', '/3d/', "'3d'"];
const leftovers = [];
(function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '.git') scan(p); continue; }
    if (!/\.(js|py|html|css|json)$/i.test(e.name)) continue;   // 문서는 옛 저장소를 인용해도 된다
    const body = fs.readFileSync(p, 'utf8');
    body.split('\n').forEach((line, i) => {
      if (STALE.some((s) => line.includes(s))) {
        leftovers.push(`${path.relative(OUT, p)}:${i + 1}  ${line.trim()}`);
      }
    });
  }
})(OUT);

console.log(`\n${wrote}개 씀${skipped ? ` · ${skipped}개 건너뜀` : ''}`);

if (leftovers.length) {
  console.error(`\n✘ 옛 저장소 경로가 남았다 (${leftovers.length}줄) — 이대로면 새 저장소에서 안 돈다`);
  for (const l of leftovers) console.error('   ', l);
  console.error('\n  이 도구의 치환 목록을 고쳐야 한다.');
  process.exit(1);
}

console.log(`\n다음: cd ${target} && git init && python3 tools/serve.py 8137`);
