// ══════════════════════════════════════════════════════════════════════════
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
//    로컬에서는 `tools/serve.py` 가 요청받을 때마다 폴더를 훑어 만들어 준다 —
//    파일을 넣고 새로고침하면 바로 나온다. 이 도구는 **배포용**이다
//    (GitHub Pages 는 정적이라 훑어 줄 사람이 없다).
//
//  규격은 `web/3d/js/core/asset-table.js` 한 곳에만 있다. 여기에 다시 안 적는다.
// ══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'web/3d/assets');
const TABLE = path.join(ROOT, 'web/3d/js/core/asset-table.js');

// 규격표는 ES 모듈이고 이 도구는 CommonJS 다. 빌드 도구를 들이지 않으려고
// 표의 **id 만** 정규식으로 뽑는다 — 표가 바뀌면 여기도 따라온다.
const src = fs.readFileSync(TABLE, 'utf8');
const ids = new Set();
const optional = new Set();
// 1) 대놓고 적힌 열쇠:  'fx/dot': { ... }
for (const m of src.matchAll(/'((?:fx|tiles|icons)\/[\w/]+)':\s*\{([^}]*)\}/g)) {
  ids.add(m[1]);
  if (/optional:\s*true/.test(m[2])) optional.add(m[1]);
}
// 2) 반복문이 만드는 열쇠 — 테마·아이템·트리 세 갈래다
const themes = (src.match(/const THEMES = \[([^\]]+)\]/) || [, ''])[1]
  .split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
for (const t of themes) {
  for (const k of ['floor', 'wall', 'walltop']) ids.add(`tiles/${k}_${t}`);
  for (const k of ['floor', 'wall']) { ids.add(`tiles/${k}_${t}_h`); optional.add(`tiles/${k}_${t}_h`); }
}
for (const m of src.matchAll(/^ITEM\('([\w]+)'/gm)) ids.add(`icons/${m[1]}`);
for (const m of src.matchAll(/^icon\('(icons\/[\w]+)'/gm)) ids.add(m[1]);
const treeBlock = (src.match(/for \(const id of \[([\s\S]*?)\]\) ICONS\[`icons\/tree_/) || [, ''])[1];
for (const m of treeBlock.matchAll(/'(\w+)'/g)) ids.add(`icons/tree_${m[1]}`);

// ── 실제로 들어와 있는 파일 ──────────────────────────────────
const present = [];
for (const sub of ['fx', 'tiles', 'icons']) {
  const d = path.join(DIR, sub);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    if (!/\.png$/i.test(f)) continue;
    present.push(`${sub}/${f}`);
  }
}
present.sort();

const known = present.filter((f) => ids.has(f.replace(/\.png$/i, '')));
const unknown = present.filter((f) => !ids.has(f.replace(/\.png$/i, '')));
const required = [...ids].filter((i) => !optional.has(i)).sort();
const missing = required.filter((i) => !present.includes(`${i}.png`));

if (process.argv.includes('--write')) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, 'index.json'), JSON.stringify(known, null, 0) + '\n');
  console.log(`assets/index.json — ${known.length}장 기록`);
}

console.log(`\n그림 ${known.length} / ${required.length}장 (선택 높이맵 제외)`);
if (unknown.length) {
  console.log('\n⚠ 규격에 없는 이름 — 게임이 안 씁니다:');
  for (const f of unknown) console.log(`   ${f}`);
  console.log('   (core/asset-table.js 의 이름과 맞춰 주세요)');
}
if (missing.length) {
  console.log(`\n아직 없는 것 ${missing.length}장 — 코드 그림으로 대체 중:`);
  const by = {};
  for (const m of missing) (by[m.split('/')[0]] ||= []).push(m.split('/')[1]);
  for (const [k, v] of Object.entries(by)) console.log(`   ${k}/  ${v.join(' ')}`);
}
console.log('');
