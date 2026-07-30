// ══════════════════════════════════════════════════════════════════════════
//  통합 대시보드 생성기 — 사장이 기획·구현·데이터를 한 화면에서 보기 위한 것.
//    node tools/dashboard.js [출력경로]
//  저장소의 실제 코드에서 데이터를 뽑는다. 손으로 적은 숫자는 낡는다.
//
//  ★ 이 파일은 저장소에 있어야 한다 — 스크래치패드에 둔 검증 자산을 컨테이너
//    스냅샷 복원으로 여러 번 잃었다. 도구는 코드와 같은 수명을 가져야 한다.
// ══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'docs', 'dashboard.html');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const sh = (c) => { try { return execSync(c, { cwd: ROOT }).toString().trim(); } catch { return ''; } };

// ── 저장소에서 데이터 뽑기 ────────────────────────────────────────────────
// 게임 파일을 통째로 평가하면 브라우저 전역(Renderer 등)에 걸린다.
// 필요한 배열만 잘라 격리 평가한다 — 데이터는 순수 리터럴이라 이게 안전하다
function evalArray(src, name) {
  const m = src.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\n\\];)`));
  if (!m) return null;
  try { return new Function(`return ${m[1].replace(/;$/, '')}`)(); } catch (e) { return null; }
}
function evalObject(src, name) {
  const m = src.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n\\};)`));
  if (!m) return null;
  try { return new Function(`return ${m[1].replace(/;$/, '')}`)(); } catch (e) { return null; }
}

const mainSrc = read('web/js/main.js');
const metaSrc = read('web/js/game/meta.js');
const dunSrc = read('web/js/game/dungeon.js');
const verSrc = read('tools/verify.js');

const VERSION = (mainSrc.match(/const GAME_VERSION = (\d+)/) || [, '?'])[1];
const ENEMIES = evalArray(metaSrc, 'CODEX_ENEMIES') || [];
const CLUES = evalArray(metaSrc, 'CLUES') || [];
const CLASSES = evalObject(metaSrc, 'CLASSES') || {};
const FLOORS = evalObject(dunSrc, 'FLOOR_DATA') || {};
const THREATS = evalArray(dunSrc, 'THREAT_SETS') || [];
const RELIC_N = (read('web/js/data/relics.js').match(/\{\s*id:/g) || []).length ||
  (read('web/js/game/rewards.js').match(/\{\s*id:/g) || []).length;
const TRAIT_N = (read('web/js/data/traits.js').match(/\{\s*id:/g) || []).length;

// 검증 항목
const ASSERTS = [...verSrc.matchAll(/ok\('([a-zA-Z0-9_.]+)'/g)].map((m) => m[1]);

// 커밋 이력 — 버전 태그가 붙은 것만
const LOG = sh("git log --oneline -80 --pretty=format:'%h%x09%ad%x09%s' --date=short")
  .split('\n').filter(Boolean).map((l) => {
    const [hash, date, ...rest] = l.split('\t');
    const subj = rest.join('\t');
    const v = (subj.match(/^v(\d+)/) || [])[1];
    return { hash, date, subj, v };
  }).filter((c) => c.v);

// 코드 규모
const files = sh("find web/js -name '*.js'").split('\n').filter(Boolean);
let LOC = 0;
for (const f of files) LOC += read(f).split('\n').length;

// ── 손으로 유지하는 부분: 기획·수치·로드맵 ────────────────────────────────
// 실측값은 tools/ 계측기에서 나온 것을 여기 옮겨 적는다. 출처를 반드시 같이 적을 것.
const FEEL = [
  { k: '적 접촉 예고', v187: '250ms', v188: '420ms', note: '인간 반응 시간이 약 250ms — 종전엔 여유 0' },
  { k: '정예 예고', v187: '300ms', v188: '500ms', note: '' },
  { k: '완벽 회피 판정 창', v187: '240ms', v188: '240ms', note: 'v169부터 있었으나 닿을 수 없었다' },
  { k: '대시 무적', v187: '220ms', v188: '220ms', note: '대시 자체(160ms)보다 길다' },
  { k: '히트스톱 · 일반 타격', v187: '0ms', v188: '40ms', note: '크리에만 걸려 있었다' },
  { k: '히트스톱 · 크리티컬', v187: '55ms', v188: '75ms', note: '' },
  { k: '히트스톱 · 잡몹 처치', v187: '50ms', v188: '65ms', note: '' },
  { k: '히트스톱 · 정예/보스 처치', v187: '90ms', v188: '120ms', note: '' },
  { k: '화면 흔들림 · 타격', v187: '2.5px', v188: '3.4px', note: '0.14초' },
  { k: '재공격 간격 · 맞았을 때', v187: '800ms', v188: '550ms (1~2층 720)', note: '예고를 늘린 대가를 여기서 받는다' },
  { k: '재공격 간격 · 피했을 때', v187: '1150ms', v188: '1150ms', note: '헛손질 경직 유지' },
];

const DODGE = [
  { react: '200ms', v187: '성공', v188: '실패', why: '너무 일러 무적(220ms)이 타격 전에 끝난다' },
  { react: '250ms — 인간 평균', v187: '실패', v188: '성공', why: '여유 170ms' },
  { react: '300ms', v187: '실패', v188: '성공', why: '여유 120ms' },
  { react: '350ms', v187: '실패', v188: '성공', why: '여유 70ms' },
];

const ROOMS = [
  { kind: '홑몸', pct: '25%', body: '×0.65', unit: '×1.50', mit: '0.000', n: '5.7' },
  { kind: '무리', pct: '45%', body: '×1.40', unit: '×0.62', mit: '0.302', n: '10.1' },
  { kind: '이중', pct: '25%', body: '×1.20', unit: '×0.78', mit: '0.110', n: '9.5' },
  { kind: '대무리', pct: '5%', body: '×1.55', unit: '×0.58', mit: '0.261', n: '11.6' },
];

const ROADMAP = [
  { v: 'v185', t: '리더·사기·군집 오라', s: 'done' },
  { v: 'v186', t: '무리 행태 — 배치가 아니라 행동', s: 'done' },
  { v: 'v187', t: '기준 구간(1~3층) 규격 · 사연 89종 · 도감 커서', s: 'done' },
  { v: 'v188', t: '손맛과 회피 — 예고 420ms · 일반 타격 히트스톱', s: 'done' },
  { v: 'v189', t: '맵 연결 기반 — 방 좌표계·문↔진입점·방향 전환·밝기 통일', s: 'done' },
  { v: 'v189b', t: '카메라 + 큰 방 + 격자 미니맵 (자산 절차적 재생성)', s: 'now' },
  { v: '이후', t: '스팀 출시 준비 — 데스크톱 빌드·도전과제·조작 설정', s: 'todo' },
];

const MAP = [
  { k: 'Dungeon 방 좌표', was: '0개 (roomIndex 정수 하나)', is: '노드·간선·상하 분기', note: '「다음 방」만 있고 「옆방」이 없었다' },
  { k: '플레이어 진입점', was: '49/49 전부 (81.6, 270)', is: '나온 문 높이를 잇는다 (5종)', note: '어느 문을 고르든 같은 자리였다' },
  { k: '방 전환 시간', was: '666ms', is: '467ms', note: '450회 × 666ms = 런당 300초가 검정 화면' },
  { k: '전환 연출', was: '방향 없는 검정 페이드', is: '화면 통째 960px 이동', note: '나온 방향으로 밀려나고 새 방이 들어온다' },
  { k: '완전 암전', was: '알파 1.0 (83ms)', is: '알파 0.42 (암전 없음)', note: '검정은 방 사이 틈만 메운다' },
  { k: '같은 층 밝기', was: '횃불 2~6개 (3배 차)', is: '3~5개', note: '밝기가 튀면 「순간이동했다」로 읽힌다' },
];

const MAPDIAG = [
  { k: '층당 테마', v: '1종', n: '7개 층 전수' },
  { k: '연속 방 실내 변화', v: '평균 13.5%', n: '최소 0% · 162칸 기준' },
  { k: '방 실루엣이 직전 방과 동일', v: '49%', n: '실루엣 9종뿐' },
  { k: '방 외곽', v: '42/42 완전 폐쇄', n: '문은 벽 구멍이 아니라 바닥 위 자립 아치' },
  { k: '방당 위협 0 직선 이동', v: '4.14초', n: '+ 암전 0.67초 = 방당 4.8초 × 450회' },
  { k: '층 이동 연출', v: '없음 (floor++ 한 줄)', n: '50층 탑인데 오르는 장면이 0회' },
];

const STEAM = [
  { item: '데스크톱 빌드에 web/ 미포함 (app.asar 6,985바이트 → 검은 창)', sev: '치명' },
  { item: 'npm run dist 동작 안 함', sev: '치명' },
  { item: '한글 productName이 세이브 경로를 깬다 (%APPDATA%)', sev: '높음' },
  { item: 'T키가 아무 조건 없이 치트 모드를 켠다', sev: '높음' },
  { item: '스팀 App ID 없음 (신청~승인 30일+, 사장 조치 필요)', sev: '높음' },
  { item: '창 포커스를 잃어도 일시정지 안 됨 — 키가 눌린 채 고착', sev: '중간' },
  { item: '조작 리바인딩 없음 · 스토어 에셋/아이콘 없음 · 도전과제 없음', sev: '중간' },
];

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const SIDE = { dead: ['억울한 죽음', 'dead'], crown: ['왕의 손', 'crown'], beast: ['짐승과 기물', 'beast'] };

const actOf = (f) => (f <= 10 ? 1 : f <= 20 ? 2 : f <= 30 ? 3 : f <= 40 ? 4 : 5);
const ACTS = { 1: '변경', 2: '다리와 관문', 3: '영지와 재판소', 4: '역병의 마을', 5: '왕도와 왕좌' };

const floorRows = Object.keys(FLOORS).map(Number).sort((a, b) => a - b).map((f) => {
  const d = FLOORS[f];
  return `<tr><td class="num">${f}</td><td class="dim">${actOf(f)}막</td><td>${esc(d.name)}</td>
    <td class="mono small">${esc((d.enemies || []).join(' · '))}</td>
    <td class="small dim">${esc(d.rule || '—')}</td></tr>`;
}).join('');

const enemyRows = ENEMIES.map((e) => {
  const [label, cls] = SIDE[e.side] || ['?', 'dead'];
  return `<tr class="${e.boss ? 'boss' : ''}">
    <td>${e.boss ? '<span class="tag boss">보스</span> ' : ''}${esc(e.name)}</td>
    <td><span class="tag ${cls}">${label}</span></td>
    <td class="small">${esc(e.lore)}</td>
    <td class="small dim">${esc(e.desc)}</td>
    <td class="small last">${e.last ? esc('"' + e.last + '"') : ''}</td></tr>`;
}).join('');

const clueRows = CLUES.filter((c) => c.text).map((c) =>
  `<tr><td class="dim num">${c.act}막</td><td>${esc(c.name)}</td>
   <td class="small dim">${c.how === 'boss' ? '막보스 자백' : '탐사'}</td>
   <td class="small">${esc(c.text)}</td></tr>`).join('');

const logRows = LOG.map((c) =>
  `<tr><td class="mono num">v${c.v}</td><td class="dim mono small">${c.date}</td>
   <td class="small">${esc(c.subj.replace(/^v\d+:\s*/, '').replace(/\s*\(#\d+\)$/, ''))}</td></tr>`).join('');

const assertGroups = {};
for (const a of ASSERTS) {
  const g = a.split('.')[0];
  (assertGroups[g] = assertGroups[g] || []).push(a);
}
const assertHtml = Object.entries(assertGroups).sort((a, b) => b[1].length - a[1].length)
  .map(([g, list]) => `<div class="agroup"><h4>${esc(g)} <span class="dim">${list.length}</span></h4>
    <ul>${list.map((a) => `<li class="mono small">${esc(a.split('.').slice(1).join('.') || a)}</li>`).join('')}</ul></div>`).join('');

const now = sh("date '+%Y-%m-%d %H:%M'") || '';

const doc = `<title>무덤에서 왕좌까지 — 개발 대시보드</title>
<style>
:root{
  --bg:#f7f3ea; --panel:#fffdf6; --line:#e2d8c3; --raise:#f1ebdc;
  --ink:#1b1712; --ink2:#544a3d; --ink3:#8a7f70;
  --gold:#96690f; --blood:#a71f26; --spirit:#12707a; --violet:#654391;
  --ok:#2a6f3c;
}
@media (prefers-color-scheme:dark){
  :root{
    --bg:#0c0a11; --panel:#141019; --line:#2a2334; --raise:#1c1726;
    --ink:#ece5d5; --ink2:#b2a894; --ink3:#7b7263;
    --gold:#f7b32b; --blood:#e43b44; --spirit:#5ce0e6; --violet:#b13ae0;
    --ok:#38b764;
  }
}
:root[data-theme="light"]{
  --bg:#f7f3ea; --panel:#fffdf6; --line:#e2d8c3; --raise:#f1ebdc;
  --ink:#1b1712; --ink2:#544a3d; --ink3:#8a7f70;
  --gold:#96690f; --blood:#a71f26; --spirit:#12707a; --violet:#654391; --ok:#2a6f3c;
}
:root[data-theme="dark"]{
  --bg:#0c0a11; --panel:#141019; --line:#2a2334; --raise:#1c1726;
  --ink:#ece5d5; --ink2:#b2a894; --ink3:#7b7263;
  --gold:#f7b32b; --blood:#e43b44; --spirit:#5ce0e6; --violet:#b13ae0; --ok:#38b764;
}

*{box-sizing:border-box}
body{
  margin:0; background:var(--bg); color:var(--ink);
  font-family:"Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",system-ui,sans-serif;
  font-size:15px; line-height:1.7; -webkit-text-size-adjust:100%;
}
.mono{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px 96px}

header{border-bottom:2px solid var(--line);margin-bottom:8px;padding:44px 0 26px}
h1{margin:0 0 6px;font-size:clamp(26px,4.2vw,40px);letter-spacing:-.02em;text-wrap:balance;line-height:1.2}
h1 small{display:block;font-size:13px;font-weight:400;color:var(--ink3);letter-spacing:.12em;margin-bottom:10px}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;align-items:center}
.pill{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:4px 13px;font-size:12.5px;color:var(--ink2)}
.pill b{color:var(--gold)}
a{color:var(--spirit)}
a.play{border-color:var(--gold);color:var(--gold);text-decoration:none;font-weight:600}

nav{position:sticky;top:0;z-index:9;background:var(--bg);border-bottom:1px solid var(--line);
  padding:9px 0;margin-bottom:34px;overflow-x:auto}
nav .inner{display:flex;gap:4px;max-width:1120px;margin:0 auto;padding:0 20px;white-space:nowrap}
nav a{color:var(--ink2);text-decoration:none;font-size:13px;padding:5px 11px;border-radius:6px}
nav a:hover{background:var(--raise);color:var(--ink)}

section{margin:0 0 52px;scroll-margin-top:60px}
h2{font-size:12px;letter-spacing:.16em;color:var(--ink3);text-transform:uppercase;
  margin:0 0 4px;font-weight:700}
h2+.lede{margin:0 0 20px;font-size:20px;letter-spacing:-.01em;color:var(--ink);text-wrap:balance}
h3{font-size:15px;margin:30px 0 10px}
h4{font-size:13px;margin:0 0 6px}
p{color:var(--ink2);max-width:66ch}
.dim{color:var(--ink3)}
.small{font-size:13px}
.num{font-variant-numeric:tabular-nums}

.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(168px,1fr))}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:15px 17px}
.card .k{font-size:11.5px;letter-spacing:.09em;color:var(--ink3);text-transform:uppercase}
.card .v{font-size:27px;font-weight:700;letter-spacing:-.02em;margin-top:2px;
  font-variant-numeric:tabular-nums;line-height:1.2}
.card .s{font-size:12.5px;color:var(--ink3)}

.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:var(--panel)}
table{border-collapse:collapse;width:100%;font-size:13.5px;min-width:520px}
th{text-align:left;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3);
  padding:11px 13px;border-bottom:1px solid var(--line);white-space:nowrap;position:sticky;top:0;background:var(--panel)}
td{padding:9px 13px;border-bottom:1px solid var(--line);vertical-align:top}
tbody tr:last-child td{border-bottom:0}
tbody tr:hover{background:var(--raise)}
td.was{color:var(--ink3);text-decoration:line-through}
td.is{color:var(--gold);font-weight:700}

.tag{display:inline-block;font-size:11px;padding:1.5px 8px;border-radius:999px;border:1px solid;white-space:nowrap}
.tag.dead{color:var(--spirit);border-color:var(--spirit)}
.tag.crown{color:var(--blood);border-color:var(--blood)}
.tag.beast{color:var(--ink3);border-color:var(--ink3)}
.tag.boss{color:var(--blood);border-color:var(--blood);font-weight:700}
tr.boss td:first-child{font-weight:600}
td.last{color:var(--violet);font-style:italic}

.rail{display:grid;gap:0;border-left:2px solid var(--line);margin-left:8px}
.rail .step{position:relative;padding:11px 0 11px 24px}
.rail .step::before{content:"";position:absolute;left:-7px;top:19px;width:12px;height:12px;border-radius:50%;
  background:var(--bg);border:2px solid var(--line)}
.rail .step.done::before{background:var(--ok);border-color:var(--ok)}
.rail .step.now::before{background:var(--gold);border-color:var(--gold);
  box-shadow:0 0 0 5px color-mix(in srgb,var(--gold) 22%,transparent)}
.rail .step .v{font-weight:700;font-size:13px;font-variant-numeric:tabular-nums}
.rail .step.now .v{color:var(--gold)}
.rail .step .t{color:var(--ink2);font-size:14px}

.note{border-left:3px solid var(--gold);background:var(--raise);padding:12px 16px;border-radius:0 8px 8px 0;
  margin:16px 0;font-size:14px;color:var(--ink2)}
.note b{color:var(--ink)}
.agroups{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(215px,1fr))}
.agroup{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.agroup h4{color:var(--gold);letter-spacing:.04em}
.agroup ul{margin:0;padding-left:16px;color:var(--ink2)}
.sev{font-weight:700;font-size:12px;white-space:nowrap}
.sev.치명{color:var(--blood)}
.sev.높음{color:var(--gold)}
.sev.중간{color:var(--ink3)}
footer{border-top:1px solid var(--line);padding-top:22px;color:var(--ink3);font-size:12.5px}
details summary{cursor:pointer;color:var(--ink2);font-size:14px;padding:6px 0}
</style>

<nav><div class="inner">
  <a href="#now">현재</a><a href="#feel">손맛·회피</a><a href="#room">방 규격</a>
  <a href="#map">맵</a><a href="#floors">50층</a><a href="#enemies">적 ${ENEMIES.length}종</a>
  <a href="#clues">증거</a><a href="#verify">검증</a><a href="#history">이력</a><a href="#steam">스팀</a>
</div></nav>

<div class="wrap">
<header>
  <h1><small>무덤에서 왕좌까지 · DUNGEONCRAWLER</small>개발 대시보드</h1>
  <div class="meta">
    <span class="pill">현재 빌드 <b>v${VERSION}</b></span>
    <span class="pill">적 <b>${ENEMIES.length}</b>종 (보스 ${ENEMIES.filter((e) => e.boss).length})</span>
    <span class="pill">층 <b>${Object.keys(FLOORS).length}</b></span>
    <span class="pill">회귀 검증 <b>${ASSERTS.length}</b>항목</span>
    <span class="pill">코드 <b>${LOC.toLocaleString()}</b>줄</span>
    <a class="pill play" href="https://tepalmafia.github.io/DungeonCrawler/" target="_blank" rel="noopener">▶ 플레이</a>
  </div>
</header>

<section id="now">
  <h2>지금</h2>
  <p class="lede">v188까지 배포됨. 다음은 카메라 이동으로 「이어진 맵」.</p>
  <div class="rail">
    ${ROADMAP.map((r) => `<div class="step ${r.s}"><div class="v">${esc(r.v)}</div><div class="t">${esc(r.t)}</div></div>`).join('')}
  </div>
  <div class="note"><b>기준 원칙.</b> 최종 판정은 사장의 실제 플레이 F9 리포트다.
  봇 수치와 회귀 검증은 결함을 잡는 도구일 뿐, 성공을 선언할 권한이 없다.
  그리고 <b>「작동한다」 ≠ 「보인다」 ≠ 「보기 좋다」</b> — 회귀가 통과해도 화면에서 안 읽히면 없는 것이다.</div>
</section>

<section id="feel">
  <h2>v188 · 손맛과 회피</h2>
  <p class="lede">기능이 없었던 게 아니라, 숫자가 사람이 닿지 못하게 막고 있었다.</p>
  <p>완벽 회피(슬로모 + 확정 크리 + 청록 섬광)는 v169부터 구현돼 있었다. 그런데 적 예고가 250ms —
  인간 반응 시간과 정확히 같아서, 보고 나서 누르면 물리적으로 늦었다. 우연히 터지는 것은 「내가 했다」가 아니다.</p>
  <div class="scroll"><table>
    <thead><tr><th>반응 시간</th><th>v187 (예고 250ms)</th><th>v188 (예고 420ms)</th><th>이유</th></tr></thead>
    <tbody>${DODGE.map((d) => `<tr><td>${esc(d.react)}</td>
      <td class="${d.v187 === '성공' ? 'is' : 'was'}">${d.v187}</td>
      <td class="${d.v188 === '성공' ? 'is' : 'was'}">${d.v188}</td>
      <td class="small dim">${esc(d.why)}</td></tr>`).join('')}</tbody>
  </table></div>
  <h3>바뀐 수치</h3>
  <div class="scroll"><table>
    <thead><tr><th>항목</th><th>v187</th><th>v188</th><th>메모</th></tr></thead>
    <tbody>${FEEL.map((f) => `<tr><td>${esc(f.k)}</td><td class="was mono">${esc(f.v187)}</td>
      <td class="is mono">${esc(f.v188)}</td><td class="small dim">${esc(f.note)}</td></tr>`).join('')}</tbody>
  </table></div>
  <div class="note">예고만 늘리면 <b>더 쉬워진다</b> — 적이 공격을 덜 하게 되니까.
  그래서 재공격 간격을 같이 줄였다. <b>맞으면 0.97초 만에 또 오고, 피하면 1.57초를 번다.</b>
  회피의 값이 0.35초 → 0.60초로 71% 커졌다. 실력이 곧 시간이 되는 구조다.
  1~2층만 0.72초로 완화 — 배우는 구간에 절벽을 세우지 않는다.</div>
</section>

<section id="room">
  <h2>v187 · 방 규격</h2>
  <p class="lede">기준을 「층」이 아니라 「방 1개」에 박았다. 층 번호를 파라미터로만 받으므로 50층까지 그대로 확장된다.</p>
  <p>v186까지는 1~3층 24개 방 <b>전부</b> 무리 1개·리더 1기였다. 무리가 죽어 있던 게 아니라 <b>상수</b>였고,
  상수는 아무것도 보여주지 않는다. 몸 수 × 개체 강도를 상수로 묶어 <b>난이도를 건드리지 않고 대비만</b> 만들었다.</p>
  <div class="scroll"><table>
    <thead><tr><th>방 유형</th><th>비율</th><th>몸 수</th><th>개체 강도</th><th>실측 경감</th><th>실측 적 수</th></tr></thead>
    <tbody>${ROOMS.map((r) => `<tr><td><b>${esc(r.kind)}</b></td><td class="mono">${r.pct}</td>
      <td class="mono">${r.body}</td><td class="mono">${r.unit}</td>
      <td class="mono ${r.mit === '0.000' ? 'dim' : 'is'}">${r.mit}</td><td class="mono">${r.n}</td></tr>`).join('')}</tbody>
  </table></div>
  <h3>설계된 위협 세트 · ${THREATS.length}종</h3>
  <div class="scroll"><table>
    <thead><tr><th>층</th><th>구성</th><th>선호 지형</th></tr></thead>
    <tbody>${THREATS.map((t) => `<tr><td class="mono num">${t.min}${t.max !== t.min ? '~' + t.max : ''}</td>
      <td class="mono small">${esc((t.units || []).join(' · '))}</td>
      <td class="dim small">${esc(t.wants || '')}</td></tr>`).join('')}</tbody>
  </table></div>
</section>

<section id="map">
  <h2>v189 · 맵 연결 기반</h2>
  <p class="lede">사장 지적의 원인은 「방마다 인상이 달라서」가 아니었다 — 실측은 정반대를 가리켰다.</p>
  <p><b>방들은 너무 같은데, 이동했다는 증거가 화면에 0이었다.</b> 팔레트도 같고 상자 모양도 같고 내 위치도 같았다.
  화면이 바뀌었는데 바뀐 게 없었다.</p>
  <div class="scroll" style="margin-bottom:18px"><table>
    <thead><tr><th>실측 진단</th><th>값</th><th>메모</th></tr></thead>
    <tbody>${MAPDIAG.map((m) => `<tr><td>${esc(m.k)}</td><td class="mono" style="color:var(--blood)">${esc(m.v)}</td>
      <td class="small dim">${esc(m.n)}</td></tr>`).join('')}</tbody>
  </table></div>
  <h3>고친 것</h3>
  <div class="scroll"><table>
    <thead><tr><th>항목</th><th>v188</th><th>v189</th><th>메모</th></tr></thead>
    <tbody>${MAP.map((m) => `<tr><td>${esc(m.k)}</td><td class="was mono small">${esc(m.was)}</td>
      <td class="is mono small">${esc(m.is)}</td><td class="small dim">${esc(m.note)}</td></tr>`).join('')}</tbody>
  </table></div>
  <div class="note"><b>카메라 비용은 코드가 아니라 자산이다.</b>
  <code>Renderer.offsetX/Y</code>를 읽는 곳은 3군데(전부 조준)뿐이고 UI는 이미 21군데에서 화면 좌표로 복귀한다 — 카메라 자체는 싸다.
  비싼 건 <code>World.cols/rows</code>를 건드리는 순간 <b>SILHOUETTES 10장 + ROOM_TEMPLATES 39개</b>가
  20×11 / 18×9로 하드코딩돼 있어 손제작 자산 49개를 전부 다시 그려야 한다는 것이다.
  v189b는 이걸 손그림 대신 <b>절차적 생성</b>으로 푼다.</div>
</section>

<section id="floors">
  <h2>세계</h2>
  <p class="lede">50층 · 5막. 모든 잡몹은 정확히 한 층에만 산다 — 층마다 새 얼굴, 새 기믹.</p>
  <div class="grid" style="margin-bottom:16px">
    ${Object.entries(ACTS).map(([a, n]) => `<div class="card"><div class="k">${a}막</div>
      <div class="v" style="font-size:19px">${esc(n)}</div>
      <div class="s">${(a - 1) * 10 + 1}~${a * 10}층</div></div>`).join('')}
  </div>
  <div class="scroll"><table>
    <thead><tr><th>층</th><th>막</th><th>이름</th><th>로스터</th><th>규칙</th></tr></thead>
    <tbody>${floorRows}</tbody>
  </table></div>
</section>

<section id="enemies">
  <h2>도감</h2>
  <p class="lede">적 ${ENEMIES.length}종 · 전원 사연 보유. 이 나라에서 죽은 자와, 죽인 자와, 그 사이에 낀 것들.</p>
  <div class="grid" style="margin-bottom:16px">
    ${Object.entries(SIDE).map(([k, [label]]) => `<div class="card"><div class="k">${esc(label)}</div>
      <div class="v">${ENEMIES.filter((e) => e.side === k).length}</div>
      <div class="s">${k === 'dead' ? '왕에게 죽은 자들' : k === 'crown' ? '왕의 손이 된 자들' : '짐승과 저주받은 기물'}</div></div>`).join('')}
    <div class="card"><div class="k">직업</div><div class="v">${Object.keys(CLASSES).length}</div>
      <div class="s">${esc(Object.values(CLASSES).map((c) => c.name).join(' · '))}</div></div>
    <div class="card"><div class="k">특성 / 유물</div><div class="v">${TRAIT_N} / ${RELIC_N}</div><div class="s">빌드 재료</div></div>
  </div>
  <details open><summary>전체 ${ENEMIES.length}종 펼쳐보기</summary>
  <div class="scroll" style="margin-top:10px;max-height:640px;overflow-y:auto"><table>
    <thead><tr><th>이름</th><th>진영</th><th>사연</th><th>공략</th><th>유언</th></tr></thead>
    <tbody>${enemyRows}</tbody>
  </table></div></details>
</section>

<section id="clues">
  <h2>진실</h2>
  <p class="lede">증거 ${CLUES.filter((c) => c.text).length}건 — 모으면 왕좌에 못박을 수 있다.</p>
  <div class="scroll"><table>
    <thead><tr><th>막</th><th>이름</th><th>획득</th><th>내용</th></tr></thead>
    <tbody>${clueRows}</tbody>
  </table></div>
</section>

<section id="verify">
  <h2>회귀 검증 · ${ASSERTS.length}항목</h2>
  <p class="lede">고친 결함이 되살아나지 않도록 못박은 것들. <span class="mono small">./tools/run-verify.sh ${VERSION}</span></p>
  <p>새 몹에 사연을 빼먹으면 <span class="mono small">lore.everyEnemyHasOne</span>이 잡고,
  예고를 다시 인간 반응 시간 아래로 줄이면 <span class="mono small">feel.dodgeWindowIsHuman</span>이 잡는다.
  <b>이게 규격이 50층까지 확장되는 방식이다.</b></p>
  <div class="agroups">${assertHtml}</div>
</section>

<section id="history">
  <h2>이력</h2>
  <p class="lede">버전 ${LOG.length}개.</p>
  <div class="scroll" style="max-height:460px;overflow-y:auto"><table>
    <thead><tr><th>버전</th><th>날짜</th><th>내용</th></tr></thead>
    <tbody>${logRows}</tbody>
  </table></div>
</section>

<section id="steam">
  <h2>스팀 출시 · 남은 장애물</h2>
  <p class="lede">₩10,000 출시 전에 반드시 해소해야 하는 것들.</p>
  <div class="scroll"><table>
    <thead><tr><th>등급</th><th>항목</th></tr></thead>
    <tbody>${STEAM.map((s) => `<tr><td class="sev ${s.sev}">${s.sev}</td><td>${esc(s.item)}</td></tr>`).join('')}</tbody>
  </table></div>
</section>

<footer>
  생성 ${esc(now)} · 빌드 v${VERSION} · <span class="mono">node tools/dashboard.js</span> 로 갱신<br>
  데이터는 저장소 코드에서 직접 뽑는다 — 손으로 적은 숫자는 낡는다.
</footer>
</div>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, doc);
console.log(`대시보드 생성: ${OUT}`);
console.log(`  v${VERSION} · 적 ${ENEMIES.length}종 · 층 ${Object.keys(FLOORS).length} · 검증 ${ASSERTS.length}항목 · 버전 이력 ${LOG.length}개 · 코드 ${LOC}줄`);
