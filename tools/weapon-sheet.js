// ══════════════════════════════════════════════════════════════════════════
//  무기 비교 컷 — **여섯 계열을 한 장에 나란히 놓고 본다.**
//
//    python3 tools/serve.py 8137 &   node tools/weapon-sheet.js
//
//  결과: docs/audit3d/weapons-rest.png    겨눔 자세 (평소 보이는 모습)
//        docs/audit3d/weapons-swing.png   내려치는 도중 (동작이 다른가)
//
//  ★ 왜 숫자만으로 안 되는가
//    weapon-audit.js 는 「길이가 다르다 · 실루엣이 여섯 개 다 다르다」까지
//    말해 준다. 그런데 그건 **다르다**는 것이지 **철퇴처럼 보인다**는 게 아니다.
//    날이 거꾸로 박혀도, 자루가 손을 뚫고 나가도 길이와 크기는 그대로다.
//    이건 눈으로 볼 수밖에 없고, 그래서 보기 좋게 한 장으로 만든다.
//
//    게임 화면에서 찍지 않는다 — 던전은 어둡고 카메라가 멀어서 무기가
//    열 픽셀쯤으로 보인다. 여기서는 밝은 조명에 정면 가까이 놓고 찍는다.
// ══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137/3d';
const OUT = path.join(__dirname, '..', 'docs', 'audit3d');

// 자세를 **어느 순간에** 찍는가.
//   0.00 겨눔  — 안 싸울 때. 무기가 몸에 박혀 있지 않은지가 여기서 보인다
//   0.52 타격  — 내려치는 도중. 계열마다 궤적이 다른지가 여기서 보인다
const SHOTS = [
  { name: 'rest', atk: 0, why: '겨눔 자세 — 쥔 위치와 길이' },
  // 0.52(타격 순간)로 잡았더니 대검·지팡이가 몸 뒤로 지나가 안 보였다 —
  // 계열마다 궤적을 눕힌 각도(across)가 달라졌기 때문이다. 예비 동작의 꼭대기가
  // 계열 차이가 제일 크게 보이는 지점이다 (드는 높이 1.45 대 2.42).
  { name: 'swing', atk: 0.36, why: '예비 동작 꼭대기 — 계열마다 드는 높이가 다르다' },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1560, height: 480 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));

  await page.goto(`${BASE}/index.html?seed=SHEET&autostart=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.G3 && window.G3.state === 'play', { timeout: 45000 });

  // 게임 화면을 치우고 그 자리에 비교판을 만든다. 게임 렌더러는 그대로 두고
  // **따로 만든 렌더러**로 그린다 — 게임 카메라·조명·안개를 안 건드리려고.
  await page.evaluate(async () => {
    const THREE = await import('three');
    const { buildKnight } = await import('./js/core/models.js');
    const { attachWeapon } = await import('./js/core/weapons.js');
    const an = await import('./js/core/anim.js');
    const { Pose } = await import('./js/core/rig.js');

    const FAMS = ['단검', '검', '도끼', '둔기', '대검', '지팡이'];
    const W = 1560, H = 430;

    const host = document.createElement('div');
    host.id = 'sheet';
    host.style.cssText = `position:fixed;inset:0;z-index:99999;background:#15171c;
      font:14px/1.5 system-ui,sans-serif;color:#cfd4de;text-align:center`;
    document.body.appendChild(host);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setClearColor(0x15171c);
    renderer.shadowMap.enabled = false;
    host.appendChild(renderer.domElement);

    const row = document.createElement('div');
    row.style.cssText = `position:relative;width:${W}px;height:22px;margin:4px auto 0`;
    host.appendChild(row);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0x9fb2d0, 0x2a2620, 1.5));
    const key = new THREE.DirectionalLight(0xfff0d8, 2.1);
    key.position.set(-3, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6f9fff, 1.1);
    rim.position.set(4, 2, -4);
    scene.add(rim);

    const rigs = [];
    FAMS.forEach((f, i) => {
      const rig = buildKnight();
      attachWeapon(rig, f, rig.weaponPal);
      rig.stanceObj = an.stanceFor(an.STANCE.knight, f);
      // **rotation.y 를 직접 잡으면 안 된다.** poseHumanoid 첫 줄의
      // faceTowards 가 매 프레임 c.facing 으로 덮어쓴다 — 처음에 2.5 를
      // 직접 넣었더니 여섯 명이 전부 등을 보이고 서 있었다. 각도는 ctx 로 준다.
      rig.group.position.set((i - (FAMS.length - 1) / 2) * 1.78, 0, 0);
      scene.add(rig.group);
      rigs.push({ f, rig, P: new Pose(rig) });

      const lab = document.createElement('div');
      lab.style.cssText = 'position:absolute;transform:translateX(-50%);white-space:nowrap';
      lab.textContent = f;
      row.appendChild(lab);
    });

    const cam = new THREE.PerspectiveCamera(23, W / H, 0.1, 100);
    cam.position.set(0, 1.15, 10.2);
    cam.lookAt(0, 1.02, 0);

    // 라벨을 **투영해서** 붙인다. flex 로 균등 분할했더니 모델 간격과 안 맞아
    // 「단검」이 검 밑에 있었다. 화면 좌표를 직접 구하면 어긋날 데가 없다.
    cam.updateMatrixWorld(true);
    rigs.forEach(({ rig }, i) => {
      const v = new THREE.Vector3(rig.group.position.x, 0, 0).project(cam);
      row.children[i].style.left = `${(v.x * 0.5 + 0.5) * W}px`;
    });

    // 자세는 **0 부터 굴려서** 도착시킨다. 목표값을 한 번 대입하면 감쇠가
    // 안 붙어서 실제 게임에서 보이는 모습과 다르다 (Pose 는 매 프레임 다가간다).
    window.SHEET = (atk) => {
      for (const { rig, P } of rigs) {
        for (let i = 0; i <= 60; i++) {
          const k = atk === 0 ? 0 : (i / 60) * atk;
          an.poseHumanoid(rig, P, rig.stanceObj, {
            // 오른손 쪽이 카메라로 오게 돌린다. **부호를 틀리면 무기가 몸 뒤로
            // 간다** — 오른팔은 로컬 −X 라, 음수로 돌리면 카메라 반대편이 된다.
            dt: 1 / 60, time: 3 + i / 60, atk: k, moving: 0, facing: 0.95, hitT: 0, dieK: 0,
            swing: 0, turnRate: 999,
          });
        }
      }
      renderer.render(scene, cam);
    };
    return FAMS.length;
  });

  const made = [];
  for (const s of SHOTS) {
    await page.evaluate((a) => window.SHEET(a), s.atk);
    await page.waitForTimeout(300);
    const file = path.join(OUT, `weapons-${s.name}.png`);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1560, height: 462 } });
    made.push({ file, why: s.why });
  }

  await browser.close();
  if (errs.length) {
    console.log('페이지 오류: ' + [...new Set(errs)].slice(0, 4).join(' | '));
    process.exit(1);
  }
  console.log('생성됨:');
  for (const m of made) console.log(`  ${path.relative(path.join(__dirname, '..'), m.file)}  — ${m.why}`);
})().catch((e) => { console.error(e); process.exit(1); });
