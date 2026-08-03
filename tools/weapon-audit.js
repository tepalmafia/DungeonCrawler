// ══════════════════════════════════════════════════════════════════════════
//  무기 점검 — 「장착한 무기가 화면에 보이는가」를 눈이 아니라 숫자로 잰다.
//
//    python3 tools/serve.py 8137 &   node tools/weapon-audit.js
//
//  ★ 왜 필요한가
//    이 작업 전에는 무기 열여덟 개가 **전부 같은 검 하나**로 보였고,
//    그런데도 게임은 아무 오류도 내지 않았다. `_syncBlade()` 가 색만 바꾸고
//    조용히 끝났기 때문이다 — 조사(docs/ANIM-AUDIT.md §1)에서 코드를 읽어야만
//    찾을 수 있었다. 같은 실패가 다시 나면 또 조용할 것이다.
//
//    그래서 **눈에 보이는 것을 그대로 잰다**:
//      · 계열마다 무기 끝(월드 좌표)이 손에서 얼마나 나가 있는가 → 길이가 다른가
//      · 삼각형 수가 계열마다 다른가                            → 진짜 다른 메시인가
//      · 갈아 끼운 뒤 옛 무기가 화면에 남아 있지 않은가          → 두 개 들고 있지 않은가
//      · 등급 발광이 새 무기로 옮겨 갔는가                      → bladeMat 이 살아 있는가
//      · 두 손 무기일 때 방패가 사라지는가
//      · 휘두름의 **여운**이 실제로 최저점을 지나치는가          → 무게가 읽히는가
//      · 창병이 베지 않고 찌르는가
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

  await page.goto(`${BASE}/index.html?seed=WEAPON&autostart=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.G3 && window.G3.state === 'play', { timeout: 45000 });

  const out = await page.evaluate(async () => {
    const THREE = await import('three');
    const G = window.G3, P = G.player;
    const em = await import('./js/game/enemies.js');
    const wp = await import('./js/core/weapons.js');

    // ── 1. 계열마다 진짜 다른 메시인가 ──
    //
    // **끝 좌표를 월드에서 잰다.** 로컬 좌표를 읽으면 「표에 그렇게 적혀 있다」를
    // 확인할 뿐이다. 실제로 손에 붙어서 그만큼 나가 있는지는 월드에서만 안다.
    const tipOut = () => {
      P.rig.group.updateMatrixWorld(true);
      const hand = new THREE.Vector3(), tip = new THREE.Vector3(), sh = new THREE.Vector3();
      P.rig.handR.getWorldPosition(hand);
      P.rig.armR.getWorldPosition(sh);
      P.rig.blade.getWorldPosition(tip);
      return { out: +(tip.distanceTo(sh) - hand.distanceTo(sh)).toFixed(3), grip: +tip.distanceTo(hand).toFixed(3) };
    };
    // **삼각형 수는 실루엣이 아니다.** 처음에 삼각형 수로 「서로 다른 메시인가」를
    // 재려다 검과 단검이 둘 다 128 이 나와 「재탕한다」로 잘못 읽혔다 — 실제로는
    // 손끝거리가 0.613 대 0.324 로 두 배 차이인데도. 같은 도형을 다른 크기로
    // 쓰면 삼각형 수는 같다. 화면에서 다른지는 **크기**로 재야 한다.
    const box = new THREE.Box3();
    const silhouette = (o) => {
      box.setFromObject(o);
      const s = box.getSize(new THREE.Vector3());
      return [s.x, s.y, s.z].map((v) => v.toFixed(2)).join('×');
    };
    const weaponMeshes = () => {
      let n = 0;
      P.rig.handR.traverse((m) => { if (m.isMesh) n++; });
      return n;
    };

    const FAMS = ['검', '대검', '도끼', '둔기', '단검', '지팡이'];
    const fams = [];
    for (const f of FAMS) {
      // 장착 경로를 그대로 탄다 — 표를 직접 부르면 게임이 하는 일을 안 지난다
      P.equipped.weapon = { name: f, slot: 'weapon', fam: f, rarity: 0, ilvl: 1,
        dmg: [5, 9], spd: 1, stats: {}, baseStats: {} };
      P.recompute();
      const t = tipOut();
      fams.push({
        f, fam: P.rig.weaponFam, out: t.out, grip: t.grip,
        sil: silhouette(P.rig.weapon), meshes: weaponMeshes(),
        two: !!P.rig.twoHand, shield: !!P.rig.shield?.visible,
        windup: +(P.rig.stanceObj?.windup ?? 0).toFixed(2),
        weight: +(P.rig.stanceObj?.weight ?? 0).toFixed(2),
      });
    }

    // ── 2. 갈아 끼우면 옛 무기가 사라지는가 ──
    // 손에 남는 메시는 「손 + 무기」뿐이어야 한다. 안 지우면 계속 쌓인다.
    const before = weaponMeshes();
    for (let i = 0; i < 6; i++) {
      P.equipped.weapon = { name: 'x', fam: FAMS[i % FAMS.length], slot: 'weapon', rarity: 0, stats: {}, baseStats: {}, ilvl: 1, dmg: [1, 2], spd: 1 };
      P.recompute();
    }
    const leak = { before, after: weaponMeshes() };

    // ── 3. 등급 발광이 새 무기로 옮겨 갔는가 ──
    // bladeMat 이 **같은 객체로 유지**되어야 한다. 무기를 만들 때 재질을 새로
    // 만들면 여기서 0 이 나오고, 그러면 전설 무기가 안 빛난다.
    P.equipped.weapon = { name: 'x', fam: '대검', slot: 'weapon', rarity: 3, stats: {}, baseStats: {}, ilvl: 9, dmg: [1, 2], spd: 1 };
    P.equipped.weapon.fam = '검'; P.recompute();          // 한 번 딴 계열로 돌린 뒤
    P.equipped.weapon.fam = '대검'; P.recompute();        // 대검으로 갈아 끼운다

    const glow = {
      mat: P.rig.blade.material === P.rig.bladeMat,
      emissive: +P.rig.bladeMat.emissiveIntensity.toFixed(2),
    };

    // ── 4. 여운 — 최저점을 **지나치는가** ──
    //
    // 이게 이 도구에서 제일 중요하다. 「지나친다」는 코드를 읽어도 눈으로 봐도
    // 애매하다. 어깨 각도를 공격 진행도별로 뽑아서 **최대값이 follow 보다 큰지**
    // 보면 한 줄로 끝난다. 예전 코드는 최대값이 정확히 follow 였다(= 안 지나침).
    const an = await import('./js/core/anim.js');
    const { Pose } = await import('./js/core/rig.js');
    const swing = (fam) => {
      const rig = P.rig;
      const Ps = new Pose(rig);
      const st = an.stanceFor(an.STANCE.knight, fam);
      let peak = -9, peakAt = 0;
      // 0 → 1 을 60 프레임으로 훑는다. 감쇠가 붙으므로 실제 관절값을 읽는다.
      for (let i = 0; i <= 60; i++) {
        const k = i / 60;
        an.poseHumanoid(rig, Ps, st, { dt: 1 / 60, time: i / 60, atk: k, moving: 0, facing: 0, hitT: 0, dieK: 0 });
        const v = rig.armR.rotation.x;
        if (v > peak) { peak = v; peakAt = k; }
      }
      return { peak: +peak.toFixed(3), at: +peakAt.toFixed(2), follow: st.follow, weight: st.weight };
    };
    const over = { 검: swing('검'), 대검: swing('대검'), 단검: swing('단검') };

    // ── 4-b. 무기 끝이 **바닥을 뚫는가** ──
    //
    // 비교 컷(weapons-swing.png)에서 대검 칼끝이 발밑을 지나 바닥 아래로
    // 내려가는 게 보였다. 긴 무기일수록 같은 각도로 휘두르면 더 깊이 박힌다 —
    // 각도는 계열마다 달라야 하는데 길이만 늘리고 각도를 안 줄이면 이렇게 된다.
    // 「보인다」로 끝내면 다음에 무기를 추가할 때 또 밟으므로 재 둔다.
    const floorDip = {};
    for (const f of ['검', '대검', '도끼', '둔기', '단검', '지팡이']) {
      P.equipped.weapon = { name: f, slot: 'weapon', fam: f, rarity: 0, ilvl: 1, dmg: [5, 9], spd: 1, stats: {}, baseStats: {} };
      P.recompute();
      const rig = P.rig, Ps = new Pose(rig), st = rig.stanceObj;
      const tip = new THREE.Vector3();
      let low = 99, lowAt = 0;
      // **먼저 겨눔 자세로 데운다.** 갓 만든 Pose 는 관절이 전부 0 이라 첫 몇
      // 프레임 동안 팔이 곧게 아래로 늘어져 있고, 그때 긴 무기는 당연히 바닥
      // 아래에 있다. 그걸 「휘두르다 바닥에 박힌다」로 읽어 −0.649 가 나왔다.
      // 게임에서는 그 순간이 없다 — 겨눔 자세에서 휘두르기 시작하기 때문이다.
      for (let i = 0; i < 40; i++)
        an.poseHumanoid(rig, Ps, st, { dt: 1 / 60, time: i / 60, atk: 0, moving: 0, facing: 0, hitT: 0, dieK: 0 });
      for (let i = 0; i <= 60; i++) {
        an.poseHumanoid(rig, Ps, st, { dt: 1 / 60, time: i / 60, atk: i / 60, moving: 0, facing: 0, hitT: 0, dieK: 0 });
        rig.group.updateMatrixWorld(true);
        // 날 **중심**이 아니라 끝을 봐야 한다. 중심은 늘 바닥 위에 있다.
        //
        // 처음엔 「날 중심의 y − 남은 길이」로 뺐다. 그건 **무기가 늘 수직으로
        // 아래를 본다고 가정**한 것이라, 눕혀 든 검까지 바닥에 박힌 것으로
        // 나왔다(검 −0.136). 무기 로컬 +Y 가 끝이므로 그 점을 그대로 월드로
        // 옮기면 가정이 없다.
        tip.set(0, rig.weaponReach, 0);
        rig.weapon.localToWorld(tip);
        if (tip.y < low) { low = tip.y; lowAt = +(i / 60).toFixed(2); }
      }
      floorDip[f] = { y: +low.toFixed(3), at: lowAt };
    }

    // ── 5. 창병이 찌르는가 ──
    // 찌르기는 **팔꿈치가 펴지는 것**이 동작의 전부다. 베기는 어깨가 크게 돈다.
    // 그래서 두 관절의 진폭을 비교하면 어느 동작인지 숫자로 갈린다.
    const spearRig = em.ARCHETYPES.spearman.build();
    const swordRig = em.ARCHETYPES.skeleton.build();
    const amp = (rig) => {
      const Ps = new Pose(rig);
      const st = an.stanceFor(an.STANCE.skeleton, rig.weaponFam);
      let aMin = 9, aMax = -9, fMin = 9, fMax = -9;
      for (let i = 0; i <= 60; i++) {
        an.poseHumanoid(rig, Ps, st, { dt: 1 / 60, time: i / 60, atk: i / 60, moving: 0, facing: 0, hitT: 0, dieK: 0 });
        aMin = Math.min(aMin, rig.armR.rotation.x); aMax = Math.max(aMax, rig.armR.rotation.x);
        fMin = Math.min(fMin, rig.foreR.rotation.x); fMax = Math.max(fMax, rig.foreR.rotation.x);
      }
      return { arm: +(aMax - aMin).toFixed(2), elbow: +(fMax - fMin).toFixed(2), fam: rig.weaponFam };
    };
    const motion = { 창병: amp(spearRig), 해골: amp(swordRig) };
    const shieldman = em.ARCHETYPES.shieldman.build();
    const guardShown = !!shieldman.shield && shieldman.shield.visible;

    return { fams, leak, glow, over, motion, guardShown, floorDip };
  });

  const F = out.fams;
  console.log('\n계열      화면상 길이  손끝거리  크기(가로×세로×두께)  메시  두손  방패  예비  무게');
  for (const r of F)
    console.log(`  ${r.f.padEnd(7)} ${String(r.out).padEnd(11)} ${String(r.grip).padEnd(9)} `
      + `${String(r.sil).padEnd(21)} ${String(r.meshes).padEnd(5)} ${(r.two ? 'O' : '·').padEnd(5)} `
      + `${(r.shield ? 'O' : '·').padEnd(5)} ${String(r.windup).padEnd(5)} ${r.weight}`);

  const lens = F.map((r) => r.grip);
  const distinct = new Set(F.map((r) => r.sil)).size;
  const span = +(Math.max(...lens) - Math.min(...lens)).toFixed(2);
  console.log(`\n  길이 차이 ${span} (대검 ${F[1].grip} vs 단검 ${F[4].grip})`
    + (span > 0.5 ? '   ✔ 화면에서 다르다' : '   ✘ 같아 보인다'));
  console.log(`  서로 다른 실루엣 ${distinct}/${F.length}`
    + (distinct === F.length ? '   ✔' : '   ✘ 같은 크기가 섞였다'));
  console.log(`  두 손 무기가 방패를 가리는가 — 대검 ${F[1].shield ? '안 가림 ✘' : '가림 ✔'}`
    + ` · 한손검 ${F[0].shield ? '보임 ✔' : '안 보임 ✘'}`);

  console.log(`\n  교체 후 손에 남은 메시 ${out.leak.before} → ${out.leak.after}`
    + (out.leak.after <= out.leak.before ? '   ✔ 안 쌓인다' : '   ✘ 옛 무기가 남는다'));
  console.log(`  등급 발광 — 새 날이 bladeMat 을 쓰는가 ${out.glow.mat ? '✔' : '✘'} · 세기 ${out.glow.emissive}`);

  console.log('\n여운 — 휘두름이 최저점을 지나치는가 (peak > follow 여야 한다)');
  for (const [k, v] of Object.entries(out.over))
    console.log(`  ${k.padEnd(5)} 최대 ${v.peak} vs follow ${v.follow} (무게 ${v.weight}, ${v.at} 지점)`
      + (v.peak > v.follow * 1.01 ? `   ✔ ${(v.peak / v.follow * 100 - 100).toFixed(0)}% 지나침` : '   ✘ 안 지나침'));

  // **기준선을 −0.25 로 둔다.** 이 값을 「통과」로 정해서가 아니라, 손검이
  // 이 게임이 나온 뒤로 줄곧 −0.20 쯤 박혀 있었고 아무도 못 알아챘기 때문이다
  // (카메라가 위에서 멀리 본다 · 그 순간이 두어 프레임이다). 그보다 나쁘면
  // 새로 생긴 문제이므로 그냥 실패로 적는다 — 기준을 올려서 통과시키지 않는다.
  console.log('\n무기 끝이 바닥을 뚫는가 (음수 = 바닥 아래로 들어간다. 기존 손검 수준 −0.20)');
  for (const [k, v] of Object.entries(out.floorDip))
    console.log(`  ${k.padEnd(5)} 최저 ${v.y} (${v.at} 지점)`
      + (v.y > -0.02 ? '   ✔ 안 뚫는다' : v.y > -0.25 ? '   △ 기존 손검 수준' : '   ✘ 더 나쁘다'));

  const M = out.motion;
  console.log('\n창병이 베지 않고 찌르는가 (찌르기 = 팔꿈치 진폭이 어깨보다 크다)');
  console.log(`  창병 ${M.창병.fam}  어깨 ${M.창병.arm} · 팔꿈치 ${M.창병.elbow}`
    + (M.창병.elbow > M.창병.arm ? '   ✔ 찌른다' : '   ✘ 벤다'));
  console.log(`  해골 ${M.해골.fam}  어깨 ${M.해골.arm} · 팔꿈치 ${M.해골.elbow}`
    + (M.해골.arm > M.해골.elbow ? '   ✔ 벤다' : '   ✘'));
  console.log(`  방패병이 방패를 드는가 ${out.guardShown ? '✔' : '✘ frontGuard 가 화면에 안 보인다'}`);

  if (errs.length) console.log('\nERR ' + [...new Set(errs)].slice(0, 3).join(' | '));
  await browser.close();
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
