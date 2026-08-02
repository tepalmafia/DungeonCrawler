// 샘플 재생 — **녹음된 소리를 쓰기 위한 층.**
//
// ── 왜 필요한가 ──────────────────────────────────────────────
// 타격음을 세 번 다시 짰다. 사각파(게임기 소리) → 고Q 공진(종소리) →
// 사인파 급강하(레트로 점프음). 네 번째로 잡음 기반으로 바꿔 「음정」은
// 없앴지만, 그것으로 **좋은 소리가 되지는 않는다.**
//
// 게임 오디오 연구가 말하는 것도 같다 — 설득력 있는 결과는 전부
// **녹음에서 모드를 추출한 것**이다. 녹음 없이 손으로 고른 값은
// 「그럴듯함」이 천장이다. 그래서 사장님이 CC0 샘플로 가자고 정하셨다.
//
// ── 이 파일이 지키는 것 ─────────────────────────────────────
// **파일이 하나도 없어도 게임이 똑같이 돌아야 한다.**
// 지금 저장소에는 음원이 없다(환경이 opengameart·freesound·kenney 를 막아
// 내가 받아 넣을 수 없었다). 그래서 이 층은 처음부터 **없으면 합성으로
// 떨어지는 것**을 전제로 만든다. 나중에 파일을 넣으면 그때부터 샘플이 난다.
//
// 「나중에 붙이겠다」로 미루면 그 사이 합성 쪽에 다시 손대게 되고,
// 파일이 들어온 날 두 벌을 합치는 일이 생긴다.
//
// ── 넣는 법 ─────────────────────────────────────────────────
// docs/AUDIO-ASSETS.md 참조. 요약하면 web/3d/audio/ 에 아래 이름으로 넣는다:
//   hit-bone-1.ogg  hit-flesh-1.ogg  hit-stone-1.ogg  hit-spirit-1.ogg
//   step-1.ogg      swing-1.ogg      ...
// 같은 이름에 -2, -3 을 더하면 **번갈아 재생**한다 (같은 소리 반복이 제일 티난다).

const BASE = 'audio/';

/**
 * 어떤 소리에 어떤 파일을 쓰는가.
 *
 * 한 항목에 여러 파일을 두면 칠 때마다 다른 것이 난다 — 이게 「기계 같다」를
 * 없애는 제일 큰 요인이다. 합성 쪽에서 주파수를 흔든 것과 같은 목적인데,
 * 녹음은 흔드는 것보다 **원래 서로 다른 것**이라 훨씬 자연스럽다.
 *
 * `vol` 은 파일마다 녹음 레벨이 달라서 두는 보정값이다. 넣고 나서
 * `tools/audio-audit.js` 로 재고 맞춘다 — 귀로 맞추면 다음에 또 어긋난다.
 */
export const MANIFEST = {
  'hit.bone':   { files: ['hit-bone-1', 'hit-bone-2', 'hit-bone-3'], vol: 1 },
  'hit.flesh':  { files: ['hit-flesh-1', 'hit-flesh-2', 'hit-flesh-3'], vol: 1 },
  'hit.stone':  { files: ['hit-stone-1', 'hit-stone-2'], vol: 1 },
  'hit.spirit': { files: ['hit-spirit-1', 'hit-spirit-2'], vol: 1 },
  'hit.crit':   { files: ['hit-crit-1', 'hit-crit-2'], vol: 1 },
  swing:        { files: ['swing-1', 'swing-2', 'swing-3'], vol: 0.8 },
  step:         { files: ['step-1', 'step-2', 'step-3', 'step-4'], vol: 0.7 },
  'step.stone': { files: ['step-stone-1', 'step-stone-2'], vol: 0.7 },
  'step.water': { files: ['step-water-1', 'step-water-2'], vol: 0.7 },
};

// 확장자 후보. ogg 가 작지만 사파리가 오래 못 읽었으므로 m4a·wav 도 본다.
const EXTS = ['ogg', 'm4a', 'wav'];

const buffers = new Map();      // 'hit.bone' → [AudioBuffer, ...]
let loaded = false;
let loading = null;

/**
 * 어떤 파일이 실제로 있는지 적어 둔 목록을 먼저 읽는다.
 *
 * 이게 없으면 MANIFEST 의 모든 이름을 확장자 셋으로 찔러 보게 되고,
 * 음원이 하나도 없는 지금은 **404 가 스물다섯 개** 찍힌다. 콘솔이 더러워지고
 * `boot.noPageError` 검사가 그걸 잡는다 (실제로 잡혔다).
 *
 * 그래서 `audio/index.json` 하나만 읽고, 거기 적힌 것만 받는다.
 * 음원을 넣을 때 이름을 거기 더하면 된다 (docs/AUDIO-ASSETS.md).
 */
async function readIndex() {
  try {
    const res = await fetch(`${BASE}index.json`, { cache: 'force-cache' });
    if (!res.ok) return null;
    const j = await res.json();
    return Array.isArray(j.files) ? new Set(j.files) : null;
  } catch { return null; }
}

/** 파일 하나 — 있으면 디코드, 없으면 조용히 null */
async function fetchOne(ctx, name) {
  for (const ext of EXTS) {
    try {
      const res = await fetch(`${BASE}${name}.${ext}`, { cache: 'force-cache' });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      // decodeAudioData 는 형식이 안 맞으면 던진다 — 다음 확장자로 넘어간다
      return await ctx.decodeAudioData(buf);
    } catch { /* 없거나 못 읽는다 — 다음 후보 */ }
  }
  return null;
}

/**
 * 준비. **실패해도 아무 일도 안 일어난다** — 그게 이 층의 계약이다.
 * @param ctx  audio.js 가 만든 AudioContext
 */
export function preload(ctx) {
  if (loading) return loading;
  loading = (async () => {
    const have = await readIndex();
    // 목록이 없거나 비었으면 **아무것도 안 받는다.** 전부 합성으로 간다.
    if (!have || !have.size) { loaded = true; return 0; }
    const jobs = [];
    for (const [key, def] of Object.entries(MANIFEST)) {
      jobs.push((async () => {
        const got = [];
        for (const f of def.files) {
          if (!have.has(f)) continue;          // 목록에 없으면 찔러 보지도 않는다
          const b = await fetchOne(ctx, f);
          if (b) got.push(b);
        }
        if (got.length) buffers.set(key, got);
      })());
    }
    await Promise.all(jobs);
    loaded = true;
    return buffers.size;
  })();
  return loading;
}

/** 이 이름의 샘플이 있는가 — 없으면 부르는 쪽이 합성으로 떨어진다 */
export function has(key) { return buffers.has(key); }

/** 몇 종류가 준비됐나 (검사·계측용) */
export function count() { return buffers.size; }
export function isLoaded() { return loaded; }

/**
 * 재생. 없으면 **false** 를 돌려준다 — 부르는 쪽이 합성으로 떨어지게.
 *
 * `rate` 를 조금씩 흔든다. 같은 파일이라도 재생 속도가 다르면 다른 소리로
 * 들리고, 이게 「같은 소리 반복」을 줄이는 제일 싼 방법이다. 다만 크게
 * 흔들면 음정이 변한 게 티나므로 ±6% 안쪽으로 둔다.
 */
export function play(ctx, out, key, { vol = 1, rate = 1, jitter = 0.06, at = 0 } = {}) {
  const list = buffers.get(key);
  if (!list || !list.length || vol <= 0.02) return false;
  const buf = list[(Math.random() * list.length) | 0];
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate * (1 + (Math.random() - 0.5) * 2 * jitter);
  const g = ctx.createGain();
  g.gain.value = vol * (MANIFEST[key]?.vol ?? 1);
  src.connect(g).connect(out);
  src.start(ctx.currentTime + at);
  return true;
}
