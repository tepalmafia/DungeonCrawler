// ══════════════════════════════════════════════════════════════════════════
//  스킬 트리 점검 — 「칸을 찍었는데 아무것도 안 바뀐다」를 잡는다.
//
//    python3 tools/serve.py 8137 &   node tools/tree-audit.js
//
//  ★ 왜 필요한가
//    칸이 스무 개인데 각각이 다른 파일을 만진다 — skills.js · combat.js ·
//    enemies.js · player.js · main.js. 표에 `flag: { twice: 0.6 }` 을 적어 두고
//    **읽는 쪽을 안 붙이면 조용히 아무 일도 안 일어난다.** 오류도 안 난다.
//    층 표의 chokeTraps 가 전 층 0개였던 것과 같은 종류의 침묵이다.
//
//    그래서 칸마다 **찍기 전과 후를 실제로 재서** 달라졌는지 본다.
//
//  재는 법
//    같은 자리에 같은 적을 세우고 스킬을 한 번 쓴다. 칸을 찍고 다시 쓴다.
//    두 번의 결과(피해 총량·맞은 수·쿨다운·마나)를 비교한다.
//    난수는 재는 동안 고정한다 — 안 그러면 운을 재게 된다.
// ══════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright-core');

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137/3d';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));

  await page.goto(`${BASE}/index.html?seed=TREE&autostart=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.G3 && window.G3.state === 'play', { timeout: 45000 });

  const rows = await page.evaluate(async () => {
    const G = window.G3, P = G.player;
    const sk = await import('./js/game/skills.js');
    const tr = await import('./js/game/skilltree.js');

    const realRandom = Math.random;
    const seedRandom = () => {
      let s = 20260802;
      Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    };

    P.maxHp = 1e9; P.hp = 1e9; P.invuln = 1e9; P.maxMp = 1e9;

    // 지금 층에 살아 있는 적을 **자리만 옮겨** 표적으로 쓴다.
    // 새로 소환하면 스폰 난수가 섞여 두 번의 측정이 달라진다.
    async function measure(skillKey, node) {
      seedRandom();
      G.tree = new tr.SkillTree();
      if (node) { G.tree.grant(1); G.tree.take(node); }
      G.fields.length = 0; G.timers.length = 0; G.slowZones.length = 0;
      G.cooldowns = {};
      P.mp = P.maxMp;

      const live = G.enemies.filter((e) => !e.dead).slice(0, 4);
      if (live.length < 2) return null;
      const save = live.map((e) => ({ e, x: e.pos.x, z: e.pos.z, hp: e.hp, max: e.maxHp }));
      // 플레이어 정면 2.2 유닛에 부채꼴로 세운다 — 회전 베기 범위 안
      live.forEach((e, i) => {
        const a = (i - (live.length - 1) / 2) * 0.5;
        e.pos.set(P.pos.x + Math.sin(a) * 2.2, 0, P.pos.z + Math.cos(a) * 2.2);
        e.hp = e.maxHp = 1e7;
        e.dead = false;
      });
      P.facing = 0;

      const before = live.reduce((a, e) => a + e.hp, 0);
      // trySkill 은 **키가 아니라 스킬 객체**를 받는다
      const def = sk.SKILLS.find((x) => x.key === skillKey);
      // **표적을 조준한다.** 엉뚱한 데를 겨누면 「직격」처럼 중심 판정이 있는
      // 칸이 전부 0 으로 나온다 — 코드가 아니라 측정이 틀린 것이다.
      const cx = live.reduce((a, e) => a + e.pos.x, 0) / live.length;
      const cz = live.reduce((a, e) => a + e.pos.z, 0) / live.length;
      sk.trySkill(G, def, { x: cx, z: cz });
      // 예약된 것(연격·파편·운석 본체)을 전부 밟는다.
      // **장판 수명보다 길게** 돌려야 「여진」이 보인다 (3.4초 → 5.5초).
      const STEP = 1 / 60;
      for (let i = 0; i < 60 * 8; i++) {
        for (let j = G.timers.length - 1; j >= 0; j--) {
          G.timers[j].t -= STEP;
          if (G.timers[j].t <= 0) { G.timers[j].fn(); G.timers.splice(j, 1); }
        }
        sk.updateFields(G, STEP);
      }
      const after = live.reduce((a, e) => a + e.hp, 0);
      const out = {
        dmg: Math.round(before - after),
        cd: +(G.cooldowns[skillKey] || 0).toFixed(2),
        fields: G.fields.length,
        slow: G.slowZones.length,
      };
      // 원상복구 — 검사가 상태를 바꾼 채 끝나면 뒤가 엉킨다
      for (const s of save) { s.e.pos.set(s.x, 0, s.z); s.e.hp = s.hp; s.e.maxHp = s.max; }
      Math.random = realRandom;
      return out;
    }

    const CASES = [
      ['cleave', null, '(안 찍음)'],
      ['cleave', 'cleaveWide', '넓은 호'],
      ['cleave', 'cleaveCombo', '연격'],
      ['cleave', 'cleaveRend', '가르기'],
      ['nova', null, '(안 찍음)'],
      ['nova', 'novaSpread', '확산'],
      ['nova', 'novaFocus', '응축'],
      ['nova', 'novaLinger', '여진'],
      ['meteor', null, '(안 찍음)'],
      ['meteor', 'meteorDirect', '직격'],
      ['meteor', 'meteorShards', '파편'],
      ['meteor', 'meteorWake', '여운'],
    ];
    const out = [];
    for (const [skill, node, label] of CASES) {
      const m = await measure(skill, node);
      out.push({ skill, node, label, ...(m || { dmg: -1, cd: -1, fields: -1, slow: -1 }) });
    }
    G.tree = new tr.SkillTree();
    Math.random = realRandom;
    return out;
  });

  console.log('\n스킬      칸            피해   쿨    장판  느린구역   기준 대비');
  const base = {};
  for (const r of rows) if (!r.node) base[r.skill] = r.dmg;
  for (const r of rows) {
    const b = base[r.skill] || 0;
    const diff = r.node ? (b ? `${((r.dmg / b - 1) * 100).toFixed(0)}%` : '?') : '—';
    const flag = r.node && b && Math.abs(r.dmg - b) < 1 && r.fields === 0 && r.slow === 0
      ? '  ← 변화 없음' : '';
    console.log(r.skill.padEnd(9) + r.label.padEnd(13)
      + String(r.dmg).padStart(7) + String(r.cd).padStart(6)
      + String(r.fields).padStart(6) + String(r.slow).padStart(8)
      + String(diff).padStart(10) + flag);
  }
  console.log('\n※ 「변화 없음」은 표에 칸을 적어 두고 **읽는 쪽을 안 붙인** 것이다.');
  console.log('  오류가 안 나므로 이 도구가 없으면 조용히 지나간다.');

  if (errs.length) console.log('\nERR ' + [...new Set(errs)].slice(0, 3).join(' | '));
  await browser.close();
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
