// ══════════════════════════════════════════════════════════════════════════
//  소리 계측 — 「넣었는데 안 들린다」를 숫자로 가른다.
//
//    python3 tools/serve.py 8137 &   node tools/audio-audit.js
//
//  ★ 왜 필요한가
//    타격음에 겹을 둘 더했는데 사장님이 「적용 안 됐다」고 하셨다. 코드는
//    분명히 부르고 있다. 그러면 남는 가능성은 하나다 — **다른 소리에 묻혔다.**
//    그건 코드를 읽어서는 절대 안 보인다. 귀로도 「작다」까지만 알 수 있고
//    「얼마나 작아서 안 들리나」는 모른다.
//
//    그래서 OfflineAudioContext 로 각 겹을 **따로 렌더링**해서 잰다.
//    audio.js 는 window.AudioContext 로 컨텍스트를 만드므로, 그것만 바꿔
//    끼우면 코드를 한 줄도 안 고치고 그대로 잴 수 있다.
//
//  재는 것 (겹마다):
//    · peak / RMS — 얼마나 큰가
//    · 대역 에너지 (저 <300Hz · 중 300~2k · 고 >2k) — 어디에 있는가
//    · **마스킹 여유** = 겹의 RMS − 같이 나는 소리의 RMS (dB).
//      −12 dB 아래면 사람 귀에는 사실상 없는 소리다.
// ══════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright-core');

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8137/3d';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));

  // 게임을 띄우지 않는다 — 빈 페이지에서 audio.js 만 불러 잰다.
  // 게임 루프가 돌면 앰비언트가 섞여 측정이 오염된다.
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });

  const rows = await page.evaluate(async () => {
    const SR = 48000, LEN = SR * 0.8;
    let bust = 0;   // 캐시 무효화용 — Math.random 을 쓰면 씨앗 고정과 충돌한다

    /** 한 번의 렌더 — fn 이 내는 소리를 통째로 담아 돌려준다 */
    async function render(modPath, fn) {
      // ★ **재는 동안은 난수를 고정한다.** impactBody 는 때릴 때마다 모드
      //   주파수를 ±7% 흔든다(그래야 기계처럼 안 들린다). 그대로 재면 같은
      //   코드로 두 번 돌려도 dB 가 −54.6 / −56.4 / −49.2 로 흔들려서
      //   「고쳤는데 좋아졌나」를 판단할 수 없다. 앞서 보스 기술 지문에서
      //   똑같이 당했다.
      const realRandom = Math.random;
      let seed = 20260802;
      Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      // ① 컨텍스트를 오프라인으로 바꿔 끼운다
      const real = window.AudioContext;
      let off = null;
      window.AudioContext = function () {
        off = new OfflineAudioContext(1, LEN, SR);
        return off;
      };
      window.webkitAudioContext = window.AudioContext;
      // ② 모듈을 **새로** 불러온다 (?t= 로 캐시를 피한다). 안 그러면 첫 번째
      //    렌더의 ctx 를 계속 쓴다 — 두 번째부터 소리가 안 담긴다.
      const A = await import(`${modPath}?t=${++bust}`);
      A.resume();                       // ensure() 를 태워 ctx 를 만든다
      fn(A);
      window.AudioContext = real;
      window.webkitAudioContext = real;
      if (!off) return null;
      const buf = await off.startRendering();
      Math.random = realRandom;
      return buf.getChannelData(0);
    }

    /** 소리 하나의 크기와 대역 */
    function measure(d) {
      if (!d) return null;
      let peak = 0, sum = 0;
      for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; }
      const rms = Math.sqrt(sum / d.length);
      // 대역 — 아주 거친 3분할 FFT 대신 1차 필터 두 개로 나눈다(경향만 보면 된다)
      const bands = [0, 0, 0];
      let lo = 0, mid = 0;
      const aLo = 0.04, aMid = 0.25;           // 대략 300Hz / 2kHz 근방
      for (let i = 0; i < d.length; i++) {
        lo += aLo * (d[i] - lo);
        mid += aMid * (d[i] - mid);
        bands[0] += lo * lo;
        bands[1] += (mid - lo) * (mid - lo);
        bands[2] += (d[i] - mid) * (d[i] - mid);
      }
      const tot = bands[0] + bands[1] + bands[2] || 1;

      // ★ **주기성(tonality)** — 「뿅/핑」인지 「퍽/챙」인지를 가르는 수치.
      //
      //   음정이 있는 소리는 파형이 **되풀이된다.** 자기상관(자기 자신을
      //   조금 밀어서 곱한 값)이 특정 지연에서 크게 튄다. 잡음은 안 튄다.
      //   dB·대역만 봐서는 사인파와 저역 잡음을 구분할 수 없다 —
      //   실제로 그래서 「저역 90%」를 보고 「퍽으로 바뀌었다」고 착각했다.
      //   사인파를 아래로 쓸어내린 것도 저역 90% 다. 그게 레트로 점프음이다.
      //
      //   40~800Hz 대역(사람이 음정으로 듣는 구간)만 본다.
      let tonality = 0;
      const N = Math.min(d.length, SR * 0.25);
      let e0 = 0;
      for (let i = 0; i < N; i++) e0 += d[i] * d[i];
      if (e0 > 1e-9) {
        for (let lag = Math.floor(SR / 800); lag < Math.floor(SR / 40); lag++) {
          let c = 0;
          for (let i = 0; i + lag < N; i += 3) c += d[i] * d[i + lag];
          const norm = Math.abs(c * 3) / e0;
          if (norm > tonality) tonality = norm;
        }
      }
      return {
        tonality: +tonality.toFixed(3),
        peak: +peak.toFixed(4),
        rms: +rms.toFixed(5),
        db: +(20 * Math.log10(rms || 1e-9)).toFixed(1),
        lo: Math.round((bands[0] / tot) * 100),
        mid: Math.round((bands[1] / tot) * 100),
        hi: Math.round((bands[2] / tot) * 100),
      };
    }

    const P = './js/core/audio.js';
    const out = [];
    const add = async (label, fn) => {
      const m = measure(await render(P, fn));
      out.push({ label, ...(m || { peak: 0, rms: 0, db: -999, lo: 0, mid: 0, hi: 0 }) });
    };

    // 종족 타격음만 (겹 없이) — audio.js 안의 VOICE 는 안 내보내므로
    // enemyAttack 으로 대신 재고, 전체는 enemyHit 로 잰다
    await add('enemyHit 해골 (전체)', (A) => A.Sfx.enemyHit('skeleton', false, 1));
    await add('enemyHit 해골 치명', (A) => A.Sfx.enemyHit('skeleton', true, 1));
    await add('enemyHit 구울 (전체)', (A) => A.Sfx.enemyHit('ghoul', false, 1));
    await add('enemyHit 골렘 (전체)', (A) => A.Sfx.enemyHit('golem', false, 1));
    for (const k of ['skeleton', 'ghoul', 'archer', 'golem'])
      await add(`★ 겹만 — ${k}`, (A) => A.impactBody(false, 1, A.BODY_MIX[k]));
    await add('★ impactBody 겹 (기본)', (A) => A.impactBody(false, 1));
    await add('★ impactBody 겹 (치명)', (A) => A.impactBody(true, 1));
    await add('enemyHit 궁수 (전체)', (A) => A.Sfx.enemyHit('archer', false, 1));
    await add('Sfx.hit (VOICE 없을 때)', (A) => A.Sfx.hit(false));
    await add('Sfx.swing (휘두르기)', (A) => A.Sfx.swing());
    await add('Sfx.step (발소리)', (A) => A.Sfx.step({ vol: 1 }));
    await add('playerGrunt (비명 기준)', (A) => A.Sfx.playerGrunt(1));
    return out;
  });

  console.log('\n소리                       peak     RMS      dB    저역 중역 고역   ★음정');
  for (const r of rows)
    console.log(r.label.padEnd(26)
      + String(r.peak).padStart(7) + String(r.rms).padStart(9) + String(r.db).padStart(8)
      + String(r.lo + '%').padStart(6) + String(r.mid + '%').padStart(5) + String(r.hi + '%').padStart(5)
      + String(r.tonality ?? '-').padStart(8) + ((r.tonality ?? 0) > 0.35 ? '  ← 뿅/핑' : ''));

  console.log('\n※ dB 는 RMS 기준. 두 소리가 같이 날 때 **12dB 이상 차이**가 나면');
  console.log('   작은 쪽은 사실상 안 들린다 (마스킹).');
  console.log('※ 음정 = 자기상관 최대값. **0.35 넘으면 음정이 있는 소리**다 —');
  console.log('   타격음이 그러면 「뿅/핑」으로 들린다. 잡음 기반이면 0.1 근처가 나온다.');
  console.log('   비명·마법·UI 는 음정이 있어야 맞으므로 이 기준을 안 쓴다.');

  if (errs.length) console.log('\nERR ' + [...new Set(errs)].slice(0, 3).join(' | '));
  await browser.close();
})().catch((e) => { console.log('CRASH', e.message); process.exit(2); });
