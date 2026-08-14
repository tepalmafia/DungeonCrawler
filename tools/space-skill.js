// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **스킬** — 더 화려한 전투 (v145 · 뼈대만). 기획은 `docs/space/SKILL.md`.
//
//    node tools/space-skill.js
//
//  ★ 사장님 (2026-08-14) 「더 화려한 전투를 하고 싶은데, 우주 전투에 있을
//    법한 스킬들을 기획해봐」 → 「**기획대로 구현해**」
//
//  ★★★ 묻는 것 일곱 (기획서 §7 그대로)
//      ① **손이 안 넘치나** — 새 키가 둘 이하인가 · 이미 쓰는 키와 안 겹치나
//      ② ★★★ **겨누는 것을 대신하지 않나** — 스킬만으로 적이 죽는 길이 있나
//      ③ ★★★ **다 못 가지나** — 다섯 중 둘
//      ④ **전부 값을 치르나** — 열·추진제·탄·시간 중 하나
//      ⑤ ★★ **쿨이 전투 한 판 안인가** — 12~30초
//      ⑥ ★★ **화면을 안 가리나** — 전투 원뿔 밖 · 0.6초 안
//      ⑦ ★★★ **이미 있는 계통에 물렸나** — 아무것도 안 가리키면 그건
//         손잡이가 아니라 **새 계통을 하나 더 얹은 것**이다
//
//  ★★★ v146 — 사장님 「**스킬 세기랑 쿨 밸런스 확인해봐**」
//      ⑩ ★★★ **다섯의 세기가 서로 비슷한가** — 하나가 두 배 넘게 세면
//         **그 하나만 쓴다.** 그러면 「다섯 중 둘」이 뜻을 잃는다
//      ⑪ ★★★ **쓰면 손해인 것이 없나** · **환산에 쓰는 숫자가 진짜 표와 같나**
// ══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import {
  SKILLS, BY_KEY, SLOTS, LANES, FX,
  makeSkills, opensAt, slotsAt, whyNotSkill, skillWhyWord,
  useSkill, stepSkills, isLive, setLane, laneEffect, dmgMult, muted,
  YARD, dpsLaser, worthOf, usesPerRun,
} from '../web/space/js/game/skill-table.js';
import { WEAPONS } from '../web/space/js/game/combat-table.js';
import { HEAT } from '../web/space/js/game/systems-table.js';
import { ENEMY_FIRE } from '../web/space/js/game/target-table.js';
import { KEYS } from '../web/space/js/game/keys-table.js';
import { MAX_LV } from '../web/space/js/game/growth-table.js';
import { CONE } from '../web/space/js/game/screen-table.js';

let bad = 0;
const ok = (c, m) => { console.log(`  ${c ? '✔' : '✘'} ${m}`); if (!c) bad++; };
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

console.log('스킬 — 더 화려한 전투 (게임을 안 부른다)');

console.log('\n[1] ★★★ **손이 안 넘치나**');
{
  const main = read('../web/space/js/main.js');
  //  ★★★ **키는 `keys-table.js` 가 갖는다** — 여기서 문자열을 세면 손 배치가
  //    두 곳이 되고, 두 곳이면 반드시 갈라진다 (이 배의 제일 오랜 규약)
  const mine = ['skill1', 'skill2', 'pips'].map((k) => KEYS[k]).filter(Boolean);
  const others = Object.entries(KEYS).filter(([k]) => !['skill1', 'skill2', 'pips'].includes(k));
  console.log(`   스킬이 쓰는 키 ${mine.map((k) => k.code).join(' · ')}`);
  ok(mine.length === 3,
    `★★★ **새 키가 ${mine.length} 개뿐이다** — \`keys-table.js HAND_MAX\` 가 3 이다.`
    + ' 스무 개를 만들어도 손이 없으면 아무도 안 쓴다');
  ok(!mine.some((m) => others.some(([, o]) => o.code === m.code)),
    '★★★ **이미 쓰는 키와 안 겹친다** — 기획서를 쓰다가 Z·V 로 한 번 잡혔다'
    + ' (광학 창 · 탄두 투하). 겹치면 숫자를 아무리 잘 정해도 손이 거기 못 간다');
  //  ★★★ **게임이 그 표에서 읽나** — `Digit4` 를 게임에서 문자열로 만들면
  //    검사가 못 찾고, 못 찾으면 「표는 초록인데 사람은 못 쓴다」가 된다.
  //    v145 에 처음에 정확히 그렇게 짰다가 여기서 빨개졌다
  ok(/KEYS\.skill1\.code/.test(main) && /KEYS\.pips\.code/.test(main),
    '★★★ **게임이 키를 그 표에서 읽는다** — 문자열을 게임에서 만들면 손 배치가'
    + ' 두 곳이 된다 (v143 의 죽은 초록과 같은 모양)');
  //  ★★★ **Ctrl 을 안 쓴다** — 기획서에는 `Ctrl+1/2/3` 이라고 적었는데
  //    ① 그건 **브라우저 탭 전환**이고 ② `core/input.js` 가 `ctrlKey` 를
  //    통째로 버린다. 물리려다 막혀서 **O 하나로 돌리는** 것으로 바꿨다
  ok(KEYS.pips.code !== 'ControlLeft' && !mine.some((m) => /Control/.test(m.code)),
    '★★ **Ctrl 을 안 쓴다** — 브라우저 단축키를 뺏지 않는다는 규약이'
    + ' `core/input.js` 첫 줄에 있고, 그 줄이 `ctrlKey` 를 통째로 버린다');
}

console.log('\n[2] ★★★ **겨누는 것을 대신하지 않나**');
{
  //  ★★★ 스킬 다섯 중 **적을 직접 죽이는 것이 하나도 없어야 한다.**
  //    하나라도 있으면 v114 의 조준 띠와 v119 의 락온이 그 순간 헐거워진다
  const kills = SKILLS.filter((s) => s.dmgDirect || s.autoAim || s.homing);
  console.log(`   적을 **직접** 죽이는 스킬 ${kills.length} 개`);
  ok(kills.length === 0,
    '★★★ **스킬만으로 적이 죽는 길이 없다** — 전부 락온·자동이면 v114 의'
    + ' 조준 띠와 v119 의 락온이 **둘 다 죽는다.** 스킬은 **겨눌 기회를 만들** 뿐이다');
  //  ★ 과부하는 피해를 키우지만 **여전히 겨눠야 맞는다** — 그게 다른 점이다
  ok(BY_KEY.overdrive.dmg > 1 && !BY_KEY.overdrive.autoAim,
    `★★ **과부하는 배수만 올린다** (×${BY_KEY.overdrive.dmg}) — 여전히 조준선에`
    + ' 담아야 맞는다. 「세게 만든다」와 「대신 겨눠 준다」는 다른 말이다');
}

console.log('\n[3] ★★★ **다 못 가지나**');
{
  const slotted = SKILLS.filter((s) => s.slot);
  console.log(`   슬롯을 먹는 스킬 ${slotted.length} 개 · 슬롯 ${SLOTS} 칸`
    + ` · 레벨 ${MAX_LV} 에 열리는 것 ${opensAt(MAX_LV).length} 개`);
  ok(slotted.length > SLOTS,
    `★★★ **${slotted.length} 개 중 ${SLOTS} 개만 장착한다** — 다 가지면 고를 것이 없고,`
    + ' 고를 것이 없으면 그건 성장이 아니라 **해금표**다');
  ok(slotsAt(1) === 0 && slotsAt(2) === 1 && slotsAt(5) === 2,
    '★★ 슬롯이 **레벨 2 에 하나 · 5 에 둘**로 열린다 — 처음부터 둘이면'
    + ' 「하나뿐이라 무엇을 넣을까」라는 제일 좋은 결심이 통째로 사라진다');
  ok(opensAt(1).length === 0 && opensAt(MAX_LV).length === SKILLS.length,
    `★ 레벨 1 에는 하나도 없고 ${MAX_LV} 에 다섯이 다 열린다 — **열리는 것**과`
    + ' **장착하는 것**이 다른 축이다');
}

console.log('\n[4] ★★ **전부 값을 치르나**');
{
  console.log('   스킬        값            쿨     지속');
  let free = 0;
  for (const s of SKILLS) {
    if (!s.costs || s.costs.length === 0) free++;
    console.log(`   ${s.name.padEnd(6)}  ${(s.costs ?? []).join('·').padEnd(10)}  ${String(s.cool).padStart(4)}초  ${s.sec}초`);
  }
  ok(free === 0,
    '★★★ **공짜인 스킬이 없다** — 공짜면 늘 켜 두는 것이 되고, 늘 켜 두는 것은'
    + ' 조작이 아니라 **설정**이다');
  ok(BY_KEY.emp.blind > 0,
    `★★★ **EMP 는 나도 ${BY_KEY.emp.blind}초 눈을 감는다** — 이 값이 없으면 「여러 대에`
    + ' 둘러싸였을 때만 이득」이 성립하지 않고, 그러면 그냥 늘 누르는 단추가 된다');
  ok(BY_KEY.drift.mute === true,
    '★★★ **관성 정지 중에는 못 쏜다** — 공짜면 늘 이 상태로 다닌다.'
    + ' 「우주다운 기동」이 곧 「늘 켜는 기동」이 되면 기동이 아니다');
  ok(BY_KEY.overdrive.heat > 0,
    `★★ **과부하는 끝나고 열 ${BY_KEY.overdrive.heat} 를 얹는다** — 열은 v58 부터`
    + ' 이 배의 목줄이다. 뜨거우면 못 숨는다');
}

console.log('\n[5] ★★ **쿨이 전투 한 판 안인가**');
{
  //  ★ 전투 한 판: 요격기 1.1초 · 침입선 5.5초 · 포함 12초 (기획 §0-③).
  //    여러 마리가 붙으므로 한 교전은 20~60초쯤이다
  const cools = SKILLS.filter((s) => s.cool > 0).map((s) => s.cool);
  console.log(`   쿨 ${cools.join(' · ')}초`);
  ok(cools.every((c) => c >= 12 && c <= 30),
    '★★★ **전부 12~30초 안이다** — 60초를 넘으면 한 판에 한 번도 못 쓰고,'
    + ' 10초 아래면 「그냥 늘 누르는 것」이 된다');
  ok(BY_KEY.pips.cool === 0,
    '★★ **전력 몰기만 쿨이 없다** — 대신 **늘 하나만** 고를 수 있다. 그게 값이다');
  ok(BY_KEY.chaff.cool < BY_KEY.emp.cool,
    `★ 자주 쓰는 것일수록 쿨이 짧다 (기만체 ${BY_KEY.chaff.cool} < EMP ${BY_KEY.emp.cool})`);
}

console.log('\n[6] ★★ **화면을 안 가리나**');
{
  console.log(`   효과 최대 ${FX.maxSec}초 · 전투 원뿔 ${FX.cone}`);
  ok(FX.cone === CONE,
    `★★★ **원뿔 값이 screen-table.js 와 같다** (${FX.cone} = ${CONE}) — 두 곳에`
    + ' 적으면 반드시 갈라지고, 갈라지면 「가린 줄 모르고」 가린다');
  ok(FX.maxSec <= 0.8,
    `★★ **효과가 ${FX.maxSec}초 안에 끝난다** — v87 에 속도감을 주려고 알갱이를`
    + ' 키웠다가 **쫓던 적이 그 뒤로 사라졌다.** 화려함은 「밝고 큰 것」이 아니라'
    + ' **「무슨 일이 났는지 한눈에 읽히는 것」**이다');
  ok(SKILLS.every((s) => typeof s.fx === 'string' && s.fx.length > 4),
    '★★★ **다섯이 다 「화면에 무엇이 보이나」를 적어 뒀다** — 안 적으면 규칙만'
    + ' 만들고 화면을 잊는다. 이 저장소가 v64(격추)·v82(락온 원)에서 두 번 겪었다');
}

console.log('\n[7] ★★★ **이미 있는 계통에 물렸나**');
{
  //  ★★★ 다섯이 각각 **지어 놓은 계통**을 가리켜야 한다. 아무것도 안
  //    가리키면 그건 손잡이가 아니라 **새 계통을 하나 더 얹은 것**이고,
  //    그러면 2시간 여정에 계통이 하나 더 늘어난다
  const WHERE = {
    lock: '../web/space/js/game/combat.js',
    heat: '../web/space/js/game/heat-table.js',
    flight: '../web/space/js/game/helm-table.js',
    laser: '../web/space/js/game/combat-table.js',
    dark: '../web/space/js/game/scene-table.js',
  };
  console.log('   스킬        물리는 곳');
  let miss = 0;
  for (const s of SKILLS) {
    const where = WHERE[s.hooks];
    let there = false;
    try { there = read(where).length > 0; } catch { there = false; }
    if (!where || !there) miss++;
    console.log(`   ${s.name.padEnd(6)}  ${s.hooks.padEnd(7)} ${there ? '있다' : '★ 없다'}`);
  }
  ok(miss === 0,
    '★★★ **다섯이 다 이미 있는 계통을 가리킨다** — 새 계통 다섯을 만드는 것이'
    + ' 아니라 지어 놓은 다섯(v58 열 · v73 비행 · v119 락온 · v141 레이저 ·'
    + ' 장면 E 정전)에 **능동 손잡이**를 하나씩 다는 것이다');
  ok(new Set(SKILLS.map((s) => s.hooks)).size === SKILLS.length,
    '★★ **다섯이 서로 다른 계통에 물린다** — 둘이 같은 데 물리면 그 둘은'
    + ' 사람 눈에 **같은 스킬**로 보인다');
}

console.log('\n[8] ★★★ **규칙이 정말 도나** — 표만 보지 않고 굴려 본다');
{
  const st = makeSkills();
  st.open = opensAt(MAX_LV); st.on = ['chaff', 'overdrive'];
  const seat = { seat: true, fuel: 99 };
  //  ① 못 쓰는 것은 **까닭을 말한다**
  const whys = ['chaff', 'drift', 'emp'].map((k) => whyNotSkill(st, k, seat));
  console.log(`   기만체 ${whys[0] ?? '쓸 수 있다'} · 관성정지 ${whys[1]} · EMP ${whys[2]}`);
  ok(whys[0] === null && whys[1] === 'unequipped',
    '★★★ **장착한 것만 쓸 수 있고, 안 한 것은 「장착하지 않았습니다」라고 말한다**');
  ok(SKILLS.every((s) => skillWhyWord(whyNotSkill(st, s.key, seat)) !== undefined),
    '★★ 까닭마다 **말이 있다** (v143 규약: 말 없는 문은 없다)');
  //  ② 쓰면 통이 줄고 쿨이 돈다
  const r = useSkill(st, 'chaff', seat);
  ok(r.ok && st.ammo.chaff === 2 && st.cool.chaff === BY_KEY.chaff.cool,
    `★★ **쓰면 통이 줄고**(3→${st.ammo.chaff}) **쿨이 돈다**(${st.cool.chaff}초)`);
  ok(whyNotSkill(st, 'chaff', seat) === 'cool', '★ 바로 또 쓰면 「준비 중」이다');
  stepSkills(st, BY_KEY.chaff.cool + 0.1);
  ok(whyNotSkill(st, 'chaff', seat) === null, '★ 쿨이 지나면 다시 쓸 수 있다');
  //  ③ 과부하가 도는 동안만 피해가 는다
  ok(dmgMult(st) === 1, '★★ 평소 레이저 피해 배수는 **1** 이다 — 안 그러면 저울이 새 나간다');
  useSkill(st, 'overdrive', seat);
  ok(dmgMult(st) === BY_KEY.overdrive.dmg && isLive(st, 'overdrive'),
    `★★★ **과부하 중에는 ×${BY_KEY.overdrive.dmg}** — 3초 동안만`);
  const done = stepSkills(st, BY_KEY.overdrive.sec + 0.1);
  ok(done.includes('overdrive') && dmgMult(st) === 1,
    '★★★ **끝나면 되돌아오고, 끝났다고 말해 준다** — 안 말하면 언제 끝났는지 모른다');
  //  ④ 전력 몰기 — 하나만 · 바꾸는 데 시간
  st.on = ['chaff', 'drift'];
  const e0 = laneEffect(st);
  ok(e0.heatMult < 1 && e0.radarAdd === 0,
    `★★★ **무기에 몰면 열이 덜 오르고**(×${e0.heatMult.toFixed(2)}) **센서는 그대로다**`);
  const sw = setLane(st, 'sensor');
  const e1 = laneEffect(st);
  ok(sw.ok && e1.radarAdd > 0 && e1.heatMult > 1,
    `★★★ **센서로 옮기면 멀리 보는 대신**(+${e1.radarAdd}m) **열이 더 오른다**`
    + `(×${e1.heatMult.toFixed(2)}) — 몰아주는 것은 **뺏어 오는 것**이다`);
  ok(setLane(st, 'agile').ok === false,
    `★★ 바꾼 직후에는 **또 못 바꾼다** (${BY_KEY.pips.swap}초) — 즉시 바뀌면 급할 때마다`
    + ' 옮기게 되고, 그러면 「미리 정해 두는 것」이라는 뜻이 사라진다');
  //  ⑤ 관성 정지 중에는 못 쏜다
  st.on = ['drift', 'chaff']; st.cool = {}; st.live = {};
  useSkill(st, 'drift', seat);
  ok(muted(st) === true, '★★★ **관성 정지 중에는 못 쏜다** — 그것이 값이다');
  stepSkills(st, BY_KEY.drift.sec + 0.1);
  ok(muted(st) === false, '★ 끝나면 다시 쏜다');
}

console.log('\n[9] ★★★ **게임이 이 표를 정말 쓰나**');
{
  const main = read('../web/space/js/main.js');
  ok(/skill-table\.js/.test(main),
    '★★★ **게임이 이 표에서 읽는다** — 안 읽으면 표는 표대로 초록이고 화면은'
    + ' 화면대로 그대로다 (v73 이 `RUSH` 를 급가속에만 물려 놓고 순항을 잊은 것)');
  for (const l of LANES) {
    ok(typeof l.name === 'string' && typeof l.what === 'string',
      `★ 전력 갈래 「${l.name}」이 **무엇이 좋아지는지**를 말한다 — ${l.what}`);
  }
}


console.log('\n[10] ★★★ **다섯의 세기가 서로 비슷한가** (v146)');
{
  //  ★★★ 「12~30초 안인가」는 **범위**이지 밸런스가 아니다. 밸런스는
  //    **「한 번 쓰면 얼마를 벌고 얼마나 자주 쓰나」**이고, 그러려면
  //    다섯을 **하나의 자**로 환산해야 한다 — 레이저 초당 피해
  console.log(`   자 = 레이저 초당 피해 ${dpsLaser().toFixed(2)}`);
  console.log('   스킬        쿨    번다   치른다   순이득   **초당**   회차에');
  const rows = SKILLS.map((k) => ({ k, w: worthOf(k.key), n: usesPerRun(k.key) }));
  for (const { k, w, n } of rows) {
    console.log(`   ${k.name.padEnd(6)} ${String(k.cool).padStart(3)}초 ${String(w.gain).padStart(7)}`
      + ` ${String(w.cost).padStart(7)} ${String(w.net).padStart(8)}   ${String(w.per).padStart(6)}`
      + `   ${n === Infinity ? '늘' : n}`);
  }
  const per = rows.map((r) => r.w.per);
  const hi = Math.max(...per); const lo = Math.min(...per);
  const spread = hi / Math.max(1e-6, lo);
  console.log(`   제일 센 것 / 제일 약한 것 = **${spread.toFixed(2)} 배**`);
  ok(lo > 0,
    '★★★ **쓰면 손해인 스킬이 없다** — v145 에 재 보니 **과부하가 초당 −0.178**'
    + ' 이었다. 열을 두 번 물린 셈이 섞여 있었고(쏘는 열은 과부하가 아니어도'
    + ' 드는 값이다), 값도 과했다. **쓰면 손해인 것은 스킬이 아니라 함정**이다');
  ok(spread <= 2.2,
    `★★★ **제일 센 것이 제일 약한 것의 ${spread.toFixed(2)} 배다** — 2.2 배를 넘으면`
    + ' **그 하나만 쓴다.** 그러면 다섯을 만든 뜻(「다섯 중 둘」)이 사라진다.'
    + ' v145 에 재 보니 **14 배**였다');
  ok(rows.every((r) => r.n >= 8),
    '★★ **회차에 여덟 번 이상 쓴다** — 2시간 중 전투가 35% 라 치고 센 값이다.'
    + ' 그보다 적으면 「있는 줄도 모르고 끝나는」 스킬이 된다');
}

console.log('\n[11] ★★★ **환산에 쓰는 숫자가 진짜 표와 같나**');
{
  //  ★★★ `YARD` 는 **딴 표에서 베껴 온 값**이다. 베낀 값은 원본이 바뀌면
  //    조용히 낡는다 — 그러면 밸런스를 **낡은 자**로 재게 되고, 그게 제일
  //    나쁘다 (재는 자가 틀리면 답이 다 틀린다). 그래서 여기서 대조한다
  const pairs = [
    ['레이저 피해', YARD.laserDmg, WEAPONS.laser.dmg],
    ['레이저 재장전', YARD.laserReload, WEAPONS.laser.reload],
    ['레이저 열', YARD.laserHeat, WEAPONS.laser.heat],
    ['열 상한', YARD.heatMax, HEAT.max],
    ['열 시작', YARD.heatStart, HEAT.start],
    ['열 식는 속도', YARD.heatFall, HEAT.fall],
    ['적 사격 간격', YARD.foeEvery, ENEMY_FIRE.every],
    ['적 명중률', YARD.foeHit, ENEMY_FIRE.hit[0]],
  ];
  let off = 0;
  for (const [name, mine, real] of pairs) {
    if (mine !== real) { off++; console.log(`   ★ ${name} — 환산 ${mine} · 진짜 ${real}`); }
  }
  console.log(`   대조한 값 ${pairs.length} 개 · 어긋난 것 ${off} 개`);
  ok(off === 0,
    '★★★ **환산에 쓰는 숫자가 진짜 표와 하나도 안 어긋난다** — 베낀 값은'
    + ' 원본이 바뀌면 **조용히 낡는다.** 낡은 자로 재면 답이 다 틀리고,'
    + ' 그런데 검사는 초록이다 (이 저장소가 제일 무서워하는 모양)');
  ok(BY_KEY.overdrive.heat < HEAT.max - HEAT.start,
    `★★★ **과부하의 열(${BY_KEY.overdrive.heat})이 남은 여유(${HEAT.max - HEAT.start})보다 작다** —`
    + ' 넘으면 **가만히 있다 써도 그 자리에서 과열**이다. 그건 값이 아니라 벌이다');
}

console.log(bad ? `\n✘ ${bad} 군데` : '\n✔ 전부 맞습니다 — 게임에 붙일 자격이 생겼다');
process.exit(bad ? 1 : 0);
