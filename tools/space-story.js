// ══════════════════════════════════════════════════════════════════════════
//  스토리 그물 — **그리고, 게임과 견준다** (docs/space/STORY.md)
//
//    node tools/space-story.js            그물을 그리고 검사한다
//    node tools/space-story.js --write    docs/space/STORY.md 를 **다시 뽑는다**
//
//  ★★ 이 도구가 「계속 유지하는 법」이다 (2026-08-06 · 사장님 「계속 잊을
//     수 있으니 어떻게 계속 유지할지도 정하고」)
//
//    기획을 그림으로 그려 두면 반드시 잊힌다 — 코드가 바뀌어도 그림은
//    안 바뀌기 때문이다. 이 저장소가 두 번 겪었다 (옛 목적이 주석에 남은 것,
//    `space-2h` 가 「C 가 다음 판」이라고 말한 것).
//
//    그래서 규칙을 뒤집는다:
//      ① 기획은 **표**에 적는다 (`game/story-table.js`)
//      ② 표가 가리키는 것이 **정말 게임에 있나**를 이 도구가 본다.
//         장면 하나를 지우거나 이름을 바꾸면 **여기가 빨개진다**
//      ③ 사람이 읽는 지도는 **손으로 안 적는다** — `--write` 로 뽑는다
//
//    ②가 핵심이다. 문서는 낡어도 조용하지만, **검사는 빨개진다.**
//
//  ★ 여기서 안 나오는 것 — 「이야기가 좋은가」. 그건 못 잰다.
//    여기서 나오는 것은 「줄기가 닫히나 · 서로 만나나 · 가리키는 것이 있나 ·
//    긴장이 모양을 갖췄나」뿐이다.
// ══════════════════════════════════════════════════════════════════════════
import { writeFileSync } from 'node:fs';
import { THREADS, SYSTEMS, SHAPE, OVERLAP_LEGS } from '../web/space/js/game/story-table.js';
import { SCENES, PLACEMENT } from '../web/space/js/game/scene-table.js';
// ★ `MISSIONS` 는 **배열**이다 — 열쇠로 찾으려면 `BY_KEY` 를 써야 한다.
//   처음에 `MISSIONS[key]` 로 썼다가 「fault:foulCoolant 이 없다」로 빨개졌다
import { MISSIONS, BY_KEY } from '../web/space/js/game/mission-table.js';
import { LEG } from '../web/space/js/game/route-table.js';

const WRITE = process.argv.includes('--write');
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fail++; };

/** 줄기의 모든 칸을 한 줄로 편다 */
const beats = (t) => [
  { kind: 'seed', ...t.seed },
  ...t.tighten.map((x) => ({ kind: 'tighten', ...x })),
  { kind: 'payoff', ...t.payoff },
];
const KIND = { seed: '심기', tighten: '조이기', payoff: '갚기' };

/** `at` 이 가리키는 것이 정말 있나 */
function resolve(at) {
  const [kind, key] = String(at).split(':');
  if (kind === 'scene') return SCENES[key] ? { kind, key, built: !!SCENES[key].built, name: SCENES[key].name } : null;
  if (kind === 'fault') return BY_KEY[key] ? { kind, key, built: !!BY_KEY[key].steps, name: BY_KEY[key].name } : null;
  if (kind === 'sys') return SYSTEMS[key] ? { kind, key, built: true, name: SYSTEMS[key] } : null;
  return null;
}

// ── 그린다 ──────────────────────────────────────────────────
console.log('\n스토리 그물 — 줄기 넷이 서로를 당긴다\n');
for (const t of THREADS) {
  console.log(`■ ${t.name}${t.spine ? ' ★등뼈' : ''} — 「${t.says}」`);
  for (const b of beats(t)) {
    const r = resolve(b.at);
    const mark = !r ? '✘없음' : r.built ? '  ' : '☐아직';
    console.log(`   ${String(b.leg).padStart(2)}구간 ${KIND[b.kind].padEnd(3)} ${mark} ${b.what}`);
  }
  console.log(`   ↔ 만난다: ${t.crosses.map((k) => THREADS.find((x) => x.key === k)?.name).join(' · ')}\n`);
}

console.log('긴장의 모양');
for (const s of SHAPE) {
  console.log(`   구간 ${s.legs.join('·').padEnd(10)} ${s.name.padEnd(4)} ${s.what}`);
}

// ── 견준다 ──────────────────────────────────────────────────
console.log('\n[1] ★★ **줄기가 닫히나** — 심기만 있고 갚기가 없으면 괴롭히기다');
for (const t of THREADS) {
  ok(!!t.seed && !!t.payoff && t.tighten.length >= 2,
    `${t.name} — 심기 1 · 조이기 ${t.tighten.length} · 갚기 1`);
}

console.log('\n[2] ★★ **가리키는 것이 정말 게임에 있나** — 여기가 낡음을 잡는다');
{
  let missing = 0, notYet = 0;
  for (const t of THREADS) {
    for (const b of beats(t)) {
      const r = resolve(b.at);
      if (!r) { console.log(`   ✘ ${t.name}: ${b.at} 이(가) 없다`); missing++; }
      else if (!r.built) notYet++;
    }
  }
  ok(missing === 0, missing ? `가리키는데 없는 것 ${missing}개 — **표가 게임보다 앞섰거나 게임이 표를 버렸다**` : '모든 칸이 실제로 있는 것을 가리킨다');
  console.log(`   아직 안 지은 칸 ${notYet}개 — 이건 실패가 아니라 **남은 일**이다`);
}

console.log('\n[3] ★ **줄기끼리 만나나** — 안 만나면 이야기가 아니라 난이도 곡선이다');
{
  for (const t of THREADS) {
    const bad = t.crosses.filter((k) => !THREADS.some((x) => x.key === k));
    ok(bad.length === 0 && t.crosses.length >= 2,
      `${t.name} 은(는) ${t.crosses.length}개와 만난다${bad.length ? ` — 없는 줄기: ${bad}` : ''}`);
  }
  // ★ **한쪽만 만난다고 적으면 안 된다** — 만남은 양쪽이다
  const oneSided = [];
  for (const t of THREADS) {
    for (const k of t.crosses) {
      const o = THREADS.find((x) => x.key === k);
      if (o && !o.crosses.includes(t.key)) oneSided.push(`${t.name}→${o.name}`);
    }
  }
  ok(oneSided.length === 0,
    oneSided.length ? `짝이 안 맞는 만남: ${oneSided.join(', ')}` : '만남이 **양쪽 다** 적혀 있다');
}

console.log('\n[4] ★ **긴장이 모양을 갖췄나** — 12구간을 다 덮나 · 절정이 절정인가');
{
  const covered = SHAPE.flatMap((s) => s.legs).sort((a, b) => a - b);
  ok(covered.length === LEG.count && covered[0] === 1 && covered[covered.length - 1] === LEG.count,
    `${LEG.count}구간을 빈틈없이 덮는다`);
  const climax = SHAPE.find((s) => s.name === '절정');
  ok(OVERLAP_LEGS.every((l) => climax.legs.includes(l)),
    `겹침 ${OVERLAP_LEGS.join('·')} 구간이 **절정 안에** 있다 — 겹침이 절정 밖이면 절정이 아니다`);
  // 배치표와 견준다 — 겹치는 구간이 정말 둘인가
  const real = PLACEMENT.map((r, i) => (r.scenes.length > 1 ? i + 1 : null)).filter(Boolean);
  ok(JSON.stringify(real) === JSON.stringify(OVERLAP_LEGS),
    `배치표의 겹침도 ${real.join('·')} — 표 둘이 안 갈라졌다`);
  // 갚기는 다 마지막 구간이어야 한다
  const late = THREADS.filter((t) => t.payoff.leg === LEG.count).length;
  ok(late === THREADS.length,
    `갚기 ${late}/${THREADS.length}개가 마지막 구간에 있다 — **넷이 한꺼번에 닫힌다**`);
}

console.log('\n[5] ★★ **모든 장면이 줄기에 달려 있나** — 안 달린 것은 사건일 뿐 이야기가 아니다');
{
  const used = new Set(THREADS.flatMap((t) => beats(t)).map((b) => b.at));
  const orphan = Object.keys(SCENES).filter((k) => !used.has(`scene:${k}`));
  console.log(`   줄기에 달린 장면 ${Object.keys(SCENES).length - orphan.length}/${Object.keys(SCENES).length}`);
  ok(orphan.length === 0,
    orphan.length ? `줄기에 안 달린 장면: ${orphan.join('·')} — 왜 있는지 말할 수 없다면 빼야 한다` : '장면 여덟이 모두 어느 줄기의 칸이다');

  // ★ 고장 19종 — **여기는 다르다.** 고장은 배경이라 다 달릴 필요가 없다.
  //   다만 **손이 갈 자리(steps)가 없는 것**은 게임에 아예 안 나오므로 센다
  const withSteps = Object.values(MISSIONS).filter((m) => m.steps).length;
  const all = Object.keys(MISSIONS).length;
  console.log(`   손이 가는 고장 ${withSteps}/${all} — 나머지 ${all - withSteps}종은 표에만 있다`);
  ok(withSteps >= 8, `${withSteps}종이 실제로 나온다 (8 이상)`);
}

console.log('\n[6] 아직 안 지은 칸을 **소리 내어 센다**');
{
  const todo = [];
  for (const t of THREADS) {
    for (const b of beats(t)) {
      const r = resolve(b.at);
      if (r && !r.built) todo.push(`${t.name} ${b.leg}구간 — ${b.at} (${r.name})`);
    }
  }
  if (todo.length) todo.forEach((x) => console.log(`   ☐ ${x}`));
  else console.log('   (없음 — 넷이 다 서 있다)');
  ok(true, todo.length ? `${todo.length}개 남았다 — 이걸 0 이라고 찍으면 도구가 게임보다 앞선 것이다` : '넷이 다 서 있다');
}

// ── 지도를 뽑는다 ───────────────────────────────────────────
/**
 * 마디에 넣을 글자 — **머메이드가 삼킬 수 있게 씻는다.**
 * ★ `**` 를 그대로 넣으면 그림이 **아예 안 그려진다** (따옴표 안이라도
 *   머메이드가 굵게로 읽는다). 처음에 그대로 넣었다가 빈 상자만 나왔다.
 */
const label = (s) => s
  .replace(/\*\*/g, '')          // 굵게 표시를 벗긴다
  .replace(/[★「」"]/g, '')       // 별표와 홑따옴표도 뺀다
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 30)
  .replace(/\s\S*$/, '');        // 잘린 마지막 낱말을 버린다

function mermaid() {
  const L = ['```mermaid', 'graph LR'];
  for (const s of SHAPE) {
    L.push(`  subgraph P${s.legs[0]}["${s.name} · 구간 ${s.legs.join('·')}"]`);
    for (const t of THREADS) {
      for (const b of beats(t)) {
        if (!s.legs.includes(b.leg)) continue;
        const id = `${t.key}${b.leg}${b.kind[0]}`;
        L.push(`    ${id}["${t.name}<br/>${label(b.what)}"]`);
      }
    }
    L.push('  end');
  }
  // 줄기 안의 흐름
  for (const t of THREADS) {
    const bs = beats(t);
    for (let i = 1; i < bs.length; i++) {
      L.push(`  ${t.key}${bs[i - 1].leg}${bs[i - 1].kind[0]} --> ${t.key}${bs[i].leg}${bs[i].kind[0]}`);
    }
  }
  // 줄기끼리 만나는 자리 — 갚기끼리 묶는다
  const seen = new Set();
  for (const t of THREADS) {
    for (const k of t.crosses) {
      const pair = [t.key, k].sort().join('|');
      if (seen.has(pair)) continue;
      seen.add(pair);
      const o = THREADS.find((x) => x.key === k);
      L.push(`  ${t.key}${t.tighten.at(-1).leg}t -.만난다.- ${o.key}${o.tighten.at(-1).leg}t`);
    }
  }
  for (const t of THREADS) L.push(`  style ${t.key}${t.payoff.leg}p fill:${t.color}22,stroke:${t.color}`);
  L.push('```');
  return L.join('\n');
}

function doc() {
  const L = [];
  L.push('# 스토리 그물 — 줄기 넷이 서로를 당긴다');
  L.push('');
  L.push('> ★★ **이 문서는 손으로 안 적습니다.**');
  L.push('> `web/space/js/game/story-table.js` 에서 `node tools/space-story.js --write` 로 뽑습니다.');
  L.push('> 손으로 고치면 다음에 뽑을 때 **지워집니다** — 고칠 것은 표입니다.');
  L.push('>');
  L.push('> 그림으로 그려 두면 반드시 잊힙니다. 코드가 바뀌어도 그림은 안 바뀌기');
  L.push('> 때문입니다. 그래서 표가 가리키는 것이 **정말 게임에 있나**를');
  L.push('> `space-story.js` 가 봅니다 — 장면을 지우거나 이름을 바꾸면 **빨개집니다.**');
  L.push('');
  L.push('## 그물');
  L.push('');
  L.push(mermaid());
  L.push('');
  L.push('## 줄기 넷');
  L.push('');
  for (const t of THREADS) {
    L.push(`### ${t.name}${t.spine ? ' — ★ 등뼈' : ''}`);
    L.push('');
    L.push(`> ${t.says}`);
    L.push('');
    L.push('| 구간 | | 무엇 | 있나 |');
    L.push('|---|---|---|---|');
    for (const b of beats(t)) {
      const r = resolve(b.at);
      L.push(`| ${b.leg} | ${KIND[b.kind]} | ${b.what} | ${!r ? '**✘ 없음**' : r.built ? '✔' : '☐ 아직'} |`);
    }
    L.push('');
    L.push(`**만난다** — ${t.crosses.map((k) => THREADS.find((x) => x.key === k)?.name).join(' · ')}`);
    L.push('');
  }
  L.push('## 긴장의 모양');
  L.push('');
  L.push('| 구간 | | |');
  L.push('|---|---|---|');
  for (const s of SHAPE) L.push(`| ${s.legs.join('·')} | **${s.name}** | ${s.what} |`);
  L.push('');
  L.push('## 계통 이름');
  L.push('');
  L.push('| | |');
  L.push('|---|---|');
  for (const [k, v] of Object.entries(SYSTEMS)) L.push(`| \`sys:${k}\` | ${v} |`);
  L.push('');
  L.push('---');
  L.push('');
  L.push('*이 문서는 `node tools/space-story.js --write` 가 뽑았습니다.*');
  return L.join('\n') + '\n';
}

if (WRITE) {
  writeFileSync('docs/space/STORY.md', doc());
  console.log('\n  docs/space/STORY.md 를 다시 뽑았습니다');
}

console.log('');
console.log(fail ? `✘ ${fail} 군데` : '✔ 전부 통과');
console.log('\n  ※ **「이야기가 좋은가」는 여기서 안 나온다.** 여기서 나오는 것은');
console.log('     「줄기가 닫히나 · 서로 만나나 · 가리키는 것이 있나 ·');
console.log('     긴장이 모양을 갖췄나」뿐이다. 나머지는 2시간 돌려 봐야 한다.');
process.exit(fail ? 1 : 0);
