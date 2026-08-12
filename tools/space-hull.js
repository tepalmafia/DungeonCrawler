// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **기체 도해** — 파츠 일곱이 다 몸을 가졌나 (v116 · 뼈대만)
//
//    node tools/space-hull.js
//
//  ★ 사장님 (2026-08-11) 「**너무 허접하잔아. 3d로 기체도 나오고 각 파츠의
//    역할도 나오고 상세하게 예쁘게 꾸며, 인터넷에서 비행선 데이터를
//    참고해서**」
//
//  ══ 이 검사가 묻는 것 ═══════════════════════════════════════════════
//
//   ① ★★★ **파츠 일곱이 다 자리가 있나** — 하나라도 없으면 도해가 거짓말이다
//   ② **덩어리가 서로 파고들지 않나** — 파고들면 3D 에서 지저분해진다
//   ③ **배 안에 다 들어가나** — 삐져나오면 도해 틀 밖으로 잘린다
//   ④ ★★★ **무게 중심이 가운데인가** — 코가 무거우면 「기울어진 배」로 읽힌다
//   ⑤ **덩어리마다 왜 거기인지가 적혀 있나** — 근거 없는 자리는 다음 판에 흔들린다
//   ⑥ ★★ **파츠 표와 안 갈라졌나** — 도해에만 있는 슬롯이 있으면 안 된다
//
//  ★ 「예쁜가」는 여기서 안 나온다. 나오는 것은 **자리와 관계**뿐이고,
//    정말 그렇게 보이나는 **화면을 찍어야** 안다 (`POSTMORTEM.md §3`)
// ══════════════════════════════════════════════════════════════════════════
import {
  HULL, SECTIONS, sectionsFor, boxOf, overlaps, balance, homeless, VIEW, SPIN,
} from '../web/space/js/game/hull-table.js';
import { SLOTS, SLOT_BY } from '../web/space/js/game/parts-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };

console.log('기체 도해 — 파츠 일곱이 다 몸을 가졌나 (뼈대만 · three 를 안 쓴다)');

console.log(`\n[0] 배 ${HULL.len}×${HULL.wide}×${HULL.tall} m · 덩어리 ${SECTIONS.length}`);
for (const s of SECTIONS) {
  console.log(`   ${s.name.padEnd(10)} ${s.kind.padEnd(6)}`
    + ` 자리 (${s.at.map((v) => v.toFixed(1)).join(', ')})`
    + ` 크기 ${s.size.map((v) => v.toFixed(1)).join('×')}`
    + `  ${s.slot ? `→ ${SLOT_BY[s.slot]?.name ?? s.slot}` : '(구조물)'}`);
}

console.log('\n[1] ★★★ **파츠 일곱이 다 자리가 있나**');
{
  const none = homeless();
  for (const sl of SLOTS) {
    const secs = sectionsFor(sl.key);
    console.log(`   ${sl.name.padEnd(7)} ${secs.length ? secs.map((s) => s.name).join(' · ') : '**몸이 없다**'}`
      + `   — ${sl.what}`);
  }
  ok(!none.length,
    `★★★ **일곱이 다 몸을 가졌다**${none.length ? ` — 없는 것 ${none.join(' · ')}` : ''}`
    + ' — 도해에 없는 파츠는 「단다」를 눌러도 어디가 좋아졌는지 알 수가 없다');
  // ★★ 반대쪽도 물어야 한다 — 도해에만 있는 슬롯이 있으면 표가 갈라진 것이다
  const ghosts = [...new Set(SECTIONS.map((s) => s.slot).filter(Boolean))]
    .filter((k) => !SLOT_BY[k]);
  ok(!ghosts.length,
    `★★ **도해에만 있는 파츠가 없다**${ghosts.length ? ` — ${ghosts.join(' · ')}` : ''}`
    + ' — 자리를 아는 곳을 둘로 두면 반드시 갈라진다 (v91~v98 이 그 병이었다)');
}

console.log('\n[2] ★★ **덩어리가 서로 파고들지 않나**');
{
  const solid = SECTIONS.filter((s) => s.kind !== 'shell');
  const hits = [];
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      if (overlaps(solid[i], solid[j])) hits.push(`${solid[i].name}×${solid[j].name}`);
    }
  }
  ok(!hits.length, `**파고드는 짝이 없다**${hits.length ? ` — ${hits.join(' · ')}` : ''}`
    + ' (껍질은 두르는 것이 일이라 뺀다)');
}

console.log('\n[3] ★★ **배 안에 다 들어가나** — 삐져나오면 도해 틀에 잘린다');
{
  const out = [];
  for (const s of SECTIONS) {
    const b = boxOf(s);
    if (Math.abs(b.x0) > HULL.wide / 2 + 0.01 || Math.abs(b.x1) > HULL.wide / 2 + 0.01
      || Math.abs(b.z0) > HULL.len / 2 + 0.01 || Math.abs(b.z1) > HULL.len / 2 + 0.01
      || Math.abs(b.y0) > HULL.tall / 2 + 0.01 || Math.abs(b.y1) > HULL.tall / 2 + 0.01) {
      out.push(s.name);
    }
  }
  ok(!out.length, `**다 들어간다**${out.length ? ` — 삐져나온 것 ${out.join(' · ')}` : ''}`);
}

console.log('\n[4] ★★★ **무게 중심이 가운데인가**');
{
  const b = balance();
  console.log(`   부피 중심 z = ${b.z} (배 길이 ${HULL.len}, 가운데가 0)`);
  ok(Math.abs(b.z) < HULL.len * 0.1,
    `★★★ **중심이 배 길이의 ${((Math.abs(b.z) / HULL.len) * 100).toFixed(1)}%** 안이다 (10% 이내)`
    + ' — 코나 꼬리로 쏠리면 도해가 「기울어진 배」로 읽히고, 무엇보다'
    + ' 화물칸을 무게 중심에 둔다는 배치의 근거가 스스로 무너진다');
}

console.log('\n[5] ★★ **왜 거기인지가 다 적혀 있나** — 근거 없는 자리는 흔들린다');
{
  const noWhy = SECTIONS.filter((s) => !s.why || s.why.length < 10).map((s) => s.name);
  ok(!noWhy.length, `**여덟이 다 근거를 갖고 있다**${noWhy.length ? ` — 빈 것 ${noWhy.join(' · ')}` : ''}`);
  console.log('   근거 몇 줄 —');
  for (const s of SECTIONS.slice(0, 4)) console.log(`     ${s.name}: ${s.why}`);
}

console.log('\n[6] ★ **보는 각이 정해져 있나** — 정면 하나면 절반만 보인다');
{
  ok(VIEW.yaw > 15 && VIEW.pitch > 10,
    `★★ **3/4 뒤 위에서 본다** (좌우 ${VIEW.yaw}° · 위 ${VIEW.pitch}°) — 정면으로 보면`
    + ' 엔진도 방열판도 안 보인다. 실제 기체 카탈로그가 다 이 각인 이유다');
  ok(SPIN.pitchMin > -90 && SPIN.pitchMax < 90,
    `★ 손으로 돌리되 **뒤집지는 못한다** (${SPIN.pitchMin}° ~ ${SPIN.pitchMax}°)`
    + ' — 배 밑에는 볼 것이 없고, 뒤집히면 어디가 앞인지 잃는다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 일곱이 다 몸을 가졌고, 안 파고들고, 균형이 맞습니다');
console.log(`
  ※ **「예쁜가」는 여기서 안 나온다.** 여기서 나오는 것은 「자리와 관계」뿐이고,
     정말 그렇게 보이나는 **화면을 찍어야** 안다 (docs/POSTMORTEM.md §3).`);
process.exit(bad ? 1 : 0);
