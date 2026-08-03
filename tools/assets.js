// ══════════════════════════════════════════════════════════════════════════
//  그림 목록 만들기 + 지금 몇 장 들어왔나
//
//    node tools/assets.js 3d             던전 현황
//    node tools/assets.js space          스페이스워 현황
//    node tools/assets.js space --write  web/space/assets/index.json 을 다시 쓴다
//
//  ★ 게임 이름을 반드시 말해야 한다
//    예전엔 `web/3d` 가 박혀 있었다. 게임이 둘이 된 뒤로 이 도구는
//    **스페이스워 그림을 아예 못 봤다** — 그림을 넣어도 index.json 이
//    안 생기니 배포판에서는 조용히 안 나온다. 오류도 안 난다.
//    `bump-version.js` 가 엉뚱한 파일을 고치고 성공이라 찍은 것과 같은
//    사고라, 같은 처방을 쓴다: **빠뜨리면 아무것도 안 하고 멈춘다.**
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
//  ★ 규격표를 정규식으로 안 읽는다
//    예전엔 표를 문자열로 긁어 열쇠를 뽑았다. 표가 반복문으로 이름을 만들면
//    (테마 × 3, 아이템 목록…) 정규식이 그걸 따라가야 하고, 표를 고칠 때마다
//    **여기도 같이 고쳐야 하는데 안 고쳐도 조용히 돈다.** 지금은 node 가
//    표를 그냥 `import()` 한다 — 표가 진실이고 여기는 세기만 한다.
//    (표에 three.js 를 끌어오면 그 순간 이게 깨진다. 그래서 표는 three 를 안 쓴다.)
// ══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const GAMES = {
  '3d': { dir: 'web/3d', name: '심연의 왕관' },
  space: { dir: 'web/space', name: '스페이스워' },
};

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('-'));
const write = args.includes('--write');

if (!GAMES[target]) {
  console.error(`\n어느 게임인지 말해 주세요 — ${Object.keys(GAMES).join(' | ')}`);
  console.error('  node tools/assets.js space');
  console.error('  node tools/assets.js space --write   (배포용 목록 갱신)\n');
  process.exit(1);
}

const GAME = GAMES[target];
const DIR = path.join(ROOT, GAME.dir, 'assets');
const TABLE = path.join(ROOT, GAME.dir, 'js/core/asset-table.js');
const IMG = /\.(png|jpg|jpeg|webp)$/i;

/** 게임마다 표의 이름이 다르다. **표를 고치지 않고** 여기서 맞춘다 —
 *  던전 표는 이미 스무 군데가 읽고 있어서, 이름을 바꾸는 쪽이 더 위험하다. */
function normalize(mod) {
  const spec = mod.ASSET_SPEC || mod.ASSETS || {};
  const companion = mod.COMPANION || new Set();
  const required = mod.REQUIRED_IDS
    ? [...mod.REQUIRED_IDS]
    : Object.keys(spec).filter((k) => !spec[k].optional && !companion.has(k));
  return { spec, companion, required };
}

/** assets/ 아래 그림 전부. **하위 폴더 이름을 안 가린다** —
 *  가리면 새 분류(surf/ · sky/)가 조용히 빠진다. serve.py 와 같은 규칙이다. */
function scan() {
  const out = [];
  if (!fs.existsSync(DIR)) return out;
  for (const sub of fs.readdirSync(DIR).sort()) {
    const d = path.join(DIR, sub);
    if (!fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d).sort()) if (IMG.test(f)) out.push(`${sub}/${f}`);
  }
  return out;
}

(async () => {
  const { spec, companion, required } = normalize(await import(TABLE));
  const present = scan();
  const idOf = (f) => f.replace(IMG, '');

  const known = present.filter((f) => spec[idOf(f)]);
  const unknown = present.filter((f) => !spec[idOf(f)]);
  const have = new Set(known.map(idOf));
  const missing = required.filter((i) => !have.has(i));
  const sideGot = [...companion].filter((i) => have.has(i));

  if (write) {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(path.join(DIR, 'index.json'), JSON.stringify(known, null, 0) + '\n');
    console.log(`${GAME.dir}/assets/index.json — ${known.length}장 기록`);
  }

  console.log(`\n${GAME.name} — 그림 ${required.length - missing.length} / ${required.length}장`
    + (companion.size ? `  (곁그림 ${sideGot.length}/${companion.size})` : ''));

  if (unknown.length) {
    console.log('\n⚠ 규격에 없는 이름 — 게임이 안 씁니다:');
    for (const f of unknown) console.log(`   ${f}`);
    console.log(`   (${GAME.dir}/js/core/asset-table.js 의 이름과 맞춰 주세요)`);
  }
  if (missing.length) {
    console.log(`\n아직 없는 것 ${missing.length}장 — 코드 그림/민무늬로 대체 중:`);
    const by = {};
    for (const m of missing) (by[m.split('/')[0]] ||= []).push(m.split('/').slice(1).join('/'));
    for (const [k, v] of Object.entries(by)) console.log(`   ${k}/  ${v.join(' ')}`);
  }
  console.log('');
})();
