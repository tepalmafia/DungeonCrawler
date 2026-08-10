// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **3D 그림 받는 자리** — 넣으면 정말 물리나 (v85)
//
//    node tools/space-model.js            지금 몇 장 들어왔나 · 규격
//    node tools/space-model.js --write    docs/space/ASSETS3D.md 를 다시 뽑는다
//
//  ★ 사장님 「이렇게 게임을 더 퀄러티 있게 **에셋도 입히고** 할건데
//    가능할까?」 (Meshy · Tripo3D · 픽스필드 같은 3D 생성 AI)
//
//  ══ ★★ 이 검사가 막으려는 것 ═══════════════════════════════════════
//
//   **「파일을 넣었는데 아무 일도 안 일어나고 오류도 안 난다」**
//   (`POSTMORTEM.md §1-⑤`). 그 상태는 원인을 짐작할 길이 없어서 제일
//   비싸다. 그래서 묻는 것이 다섯이다:
//
//     ① 자리 이름이 **게임의 열쇠와 같나** (다르면 붙을 데가 없다)
//     ② 규격이 **한 곳에만** 적혀 있나 (문서·로더·검사가 같은 것을 읽나)
//     ③ 떨어뜨린 파일이 **정말 glb 인가** · 한도 안인가
//     ④ **없어도 게임이 도나** — 하나도 없는 것이 기본 상태다
//     ⑤ 문서가 **손으로 적혀 있지 않나** (표에서 뽑나)
//
//  ★ 브라우저를 안 쓴다. 「넣으면 화면에 정말 서나」는 `--see` 로 본다.
// ══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import {
  MODEL_ROOT, RULES, LIMITS, SLOTS, SLOT_LIST, pathOf, fitScale, slotWord, HOW,
} from '../web/space/js/core/model-table.js';
import { KINDS } from '../web/space/js/game/target-table.js';

const ROOT = new URL('..', import.meta.url).pathname;
const DIR = `${ROOT}web/space/${MODEL_ROOT}`;
const loader = `${ROOT}web/space/js/core/models.js`;
const targets = `${ROOT}web/space/js/world/targets.js`;

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const head = (t) => console.log(`\n${t}`);

/** 떨어진 파일들 */
function dropped() {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR).filter((f) => f.endsWith(RULES.ext));
}
/** glb 인가 — 앞 4바이트가 `glTF` 다 (한 번 읽고 끝난다) */
function isGlb(file) {
  const b = readFileSync(file).subarray(0, 4).toString('latin1');
  return b === 'glTF';
}

console.log('\n3D 그림 받는 자리 — 넣으면 정말 물리나');
console.log(`   ${MODEL_ROOT} · ${RULES.ext} · 기수 ${RULES.nose} · 위 ${RULES.up} · 원점 ${RULES.origin}`);

// ══ ① 자리 이름이 게임의 열쇠와 같나 ═════════════════════════════════
head('[1] ★★★ **자리 이름이 게임의 열쇠와 같나** — 다르면 붙을 데가 없다');
{
  const wrong = SLOT_LIST.filter((s) => !KINDS[s.kind]);
  ok(wrong.length === 0,
    wrong.length ? `✘ 게임에 없는 열쇠: ${wrong.map((s) => s.kind).join(' · ')}`
      : `자리 ${SLOT_LIST.length}개가 모두 \`KINDS\` 에 있다`);
  // 반대쪽도 — 게임에 있는데 자리가 없으면 **그 종류는 영영 그림이 안 든다**
  const missing = Object.keys(KINDS).filter((k) => !SLOTS[k]);
  ok(missing.length === 0,
    missing.length ? `✘ 자리가 없는 종류: ${missing.join(' · ')}` : '게임의 종류가 하나도 안 빠졌다');
}

// ══ ② 규격이 한 곳에만 ═══════════════════════════════════════════════
head('[2] ★★ **규격이 한 곳에만 적혀 있나** — 두 곳이면 반드시 갈라진다');
{
  const src = readFileSync(loader, 'utf8');
  ok(src.includes("from './model-table.js'"), '로더가 표를 읽는다 (숫자를 다시 안 적는다)');
  // 로더 안에 한도 숫자가 손으로 박혀 있으면 갈라진다
  const hard = [String(LIMITS.tris), String(LIMITS.tex)].filter((n) => new RegExp(`[^.\\w]${n}[^\\w]`).test(src));
  ok(hard.length === 0,
    hard.length ? `✘ 로더에 손으로 박힌 숫자: ${hard.join(' · ')}` : '로더에 손으로 박힌 한도가 없다');
  const tsrc = readFileSync(targets, 'utf8');
  ok(tsrc.includes('modelFor('), '창밖이 **그림이 있으면 그것을** 쓴다');
  ok(tsrc.includes("KINDS[kind]?.size"),
    '★ 크기는 여전히 **표가 정한다** — 로더가 미리 나눠서 준다 (두 번 곱하면 안 된다)');
}

// ══ ③ 떨어뜨린 것 ════════════════════════════════════════════════════
head('[3] 지금 들어와 있는 것');
{
  const files = dropped();
  console.log(`   ${files.length} / ${SLOT_LIST.length}장`);
  const known = new Set(Object.keys(SLOTS).map((k) => `${k}${RULES.ext}`));
  for (const f of files) {
    const path = `${DIR}${f}`;
    const mb = +(statSync(path).size / 1048576).toFixed(2);
    const glb = isGlb(path);
    const mine = known.has(f);
    const notes = [];
    if (!glb) notes.push('**glb 가 아닙니다** (glTF Binary 로 내보내십시오)');
    if (!mine) notes.push('**모르는 이름입니다** — 아래 목록의 이름으로 바꾸십시오');
    if (mb > LIMITS.mb) notes.push(`${mb}MB — 한도 ${LIMITS.mb}MB`);
    console.log(`   ${notes.length ? '⚠' : '✔'} ${f} · ${mb}MB${notes.length ? ' — ' + notes.join(' · ') : ''}`);
    if (!glb || !mine) bad++;
  }
  if (!files.length) {
    console.log('   (아직 없습니다 — **코드 도형으로 돕니다.** 그게 기본 상태입니다)');
  }
  const miss = Object.keys(SLOTS).filter((k) => !files.includes(`${k}${RULES.ext}`));
  if (miss.length) {
    console.log('\n   아직 없는 자리:');
    for (const k of miss) console.log(`     ${slotWord(k)}`);
  }
}

// ══ ④ 없어도 도나 ════════════════════════════════════════════════════
head('[4] ★★★ **없어도 게임이 도나** — 하나도 없는 것이 기본 상태다');
{
  const src = readFileSync(loader, 'utf8');
  ok(src.includes("method: 'HEAD'"),
    '★ 먼저 **있나 본다** — 없는 것은 잘못이 아니라 기본이라 빨갛게 두면 안 된다');
  ok(/return null/.test(src), '없으면 null 을 준다 — 부르는 쪽이 코드 도형을 쓴다');
  const tsrc = readFileSync(targets, 'utf8');
  ok(/if \(art\) \{/.test(tsrc), '창밖이 **있을 때만** 갈아 끼운다');
  ok(src.includes('console.log'),
    '★★ **조용히 실패하지 않는다** — 한 장마다 콘솔에 한 줄 (「넣었는데 아무 일도 안 난다」를 막는다)');
}

// ══ ⑤ 크기 맞추기 ════════════════════════════════════════════════════
head('[5] ★★ **크기는 안 맞춰도 된다** — 표가 정한 길이로 게임이 맞춘다');
{
  // 생성 AI 가 흔히 뱉는 크기들로 재 본다
  for (const raw of [1, 2.4, 100]) {
    const k = fitScale('raider', raw);
    const got = +(raw * k).toFixed(2);
    console.log(`      ${raw} 로 나온 것 → ×${k.toFixed(3)} → ${got}m (표 ${SLOTS.raider.long}m)`);
    if (Math.abs(got - SLOTS.raider.long) > 0.01) bad++;
  }
  ok(true, '어떤 크기로 뽑아 오셔도 표의 길이가 된다 — 블렌더를 안 여셔도 된다');
  ok(fitScale('raider', 0) === 1, '0 이 와도 안 터진다');
}

// ══ ⑥ 문서를 손으로 안 적나 ══════════════════════════════════════════
head('[6] ★ 문서를 **손으로 안 적나** — 손으로 적은 것은 코드가 바뀌어도 안 바뀐다');
{
  const doc = `${ROOT}docs/space/ASSETS3D.md`;
  ok(existsSync(doc), 'docs/space/ASSETS3D.md 가 있다');
  if (existsSync(doc)) {
    const d = readFileSync(doc, 'utf8');
    ok(d.includes('이 문서는 `tools/space-model.js --write`'),
      '★ 문서가 **표에서 뽑힌 것**이라고 스스로 말한다');
  }
}

// ══ 문서 다시 뽑기 ═══════════════════════════════════════════════════
if (process.argv.includes('--write')) {
  const rows = Object.keys(SLOTS).map((k) => {
    const s = SLOTS[k];
    return `| \`${k}${RULES.ext}\` | ${s.long}m | ${s.what} |`;
  }).join('\n');
  const how = HOW.map(([a, b]) => `| ${a} | ${b} |`).join('\n');
  const out = `# 3D 그림 규격 — 뽑아서 떨어뜨리면 게임에 나옵니다

> 이 문서는 \`tools/space-model.js --write\` 가 **표에서 뽑습니다.**
> 손으로 고치면 다음 번에 지워집니다 — 고치실 곳은
> \`web/space/js/core/model-table.js\` 입니다.

## 어디에 넣나

\`\`\`
web/space/${MODEL_ROOT}<이름>${RULES.ext}
\`\`\`

넣고 나서 확인:

\`\`\`
node tools/space-model.js
\`\`\`

**없으면 지금 코드 도형으로 돕니다.** 하나씩 갈아 끼우셔도 됩니다.

## 생성 AI 에서 뽑을 때 (Meshy · Tripo3D · 픽스필드 …)

| | |
|---|---|
${how}

★ **크기는 신경 쓰지 마십시오.** 어떤 크기로 나오든 게임이 아래 표의
길이로 맞춥니다 — 블렌더를 여실 일이 없습니다.

★ **앞쪽만은 맞춰 주십시오.** 기수가 **${RULES.nose}** 를 봐야 합니다.
안 그러면 적이 뒤로 날아갑니다 (v79 에 실제로 그랬습니다).

## 자리 ${SLOT_LIST.length}개

| 파일 이름 | 길이 | 무엇 |
|---|---|---|
${rows}

## 안 하는 것

- **애니메이션** — 넣어도 무시합니다. 움직임(엔진 불 · 격추 · 회전)은
  코드가 붙입니다. 살아 있는 것의 표시라 깜빡여야 하는데 그건 그림이
  못 합니다
- **텍스처 파일 따로** — \`.gltf\` + \`.bin\` + \`.png\` 로 나뉘면 경로가
  어긋나 **조용히 실패**합니다. \`${RULES.ext}\` 한 파일로 주십시오
- **배 안 소품** — 아직 자리가 없습니다. 밖에 뜨는 것 ${SLOT_LIST.length}개부터입니다
`;
  writeFileSync(`${ROOT}docs/space/ASSETS3D.md`, out);
  console.log('\n   docs/space/ASSETS3D.md 를 다시 뽑았습니다');
}

console.log(bad ? `\n✘ ${bad} 개가 안 맞습니다` : '\n✔ 전부 맞습니다');
console.log(`
  ※ **「그림이 좋아 보이나」는 여기서 안 나온다.** 그 판정은 사장님이
     하시고, 여기서 나오는 것은 「이름이 맞나 · 규격이 한 곳인가 ·
     없어도 도나 · 크기가 맞춰지나」뿐이다.
     화면에 정말 서는지는 브라우저로 본다 (space-endtoend.js [6l]).`);
process.exit(bad ? 1 : 0);
