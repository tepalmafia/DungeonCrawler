// 사운드 — 오디오 파일 0. 전부 Web Audio 오실레이터/노이즈로 합성한다.
// (기존 2D 게임 web/js/core/audio.js 와 같은 사상. 여기서는 샘플에 필요한 만큼만.)

let ctx = null, master = null, noiseBuf = null;
let ambient = null;
let enabled = true;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { enabled = false; return null; }
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);

  // 화이트 노이즈 1초 — 타격음·바람의 재료
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

export function resume() {
  ensure();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}
export function setEnabled(v) {
  enabled = v;
  if (master) master.gain.value = v ? 0.55 : 0;
}
export function isEnabled() { return enabled; }

function now() { return ctx.currentTime; }

function tone(freq, { type = 'sine', dur = 0.2, gain = 0.25, at = 0, decay = null, to = null, detune = 0, vol = 1, out = null } = {}) {
  if (!ensure() || !enabled || vol <= 0.02) return;
  gain *= vol;
  const t = now() + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  if (detune) o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (decay || dur));
  o.connect(g).connect(out || master);
  o.start(t);
  o.stop(t + (decay || dur) + 0.05);
}

function noise({ dur = 0.18, gain = 0.3, at = 0, lp = 1800, lpTo = null, hp = 0, q = 1, vol = 1, out = null } = {}) {
  if (!ensure() || !enabled || vol <= 0.02) return;
  gain *= vol;
  const t = now() + at;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(lp, t);
  f.Q.value = q;
  if (lpTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, lpTo), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let chain = s.connect(f);
  if (hp) {
    const h = ctx.createBiquadFilter();
    h.type = 'highpass';
    h.frequency.value = hp;
    chain = f.connect(h);
    chain.connect(g);
  } else {
    f.connect(g);
  }
  g.connect(out || master);
  s.start(t);
  s.stop(t + dur + 0.05);
}


// ─────────────────── 목소리(포먼트 합성) ───────────────────
// 「으악」·「웩」·「이얍」은 노이즈로는 안 난다. 사람 목소리의 정체는
// 성대 진동(톱니파)이 입 모양에 따라 특정 주파수대만 살아남는 것 —
// 그 공명대를 포먼트라 한다. 톱니파를 밴드패스 두 개에 통과시키면
// 모음이 만들어진다. 오디오 파일 0 원칙을 지키면서 목소리를 내는 방법이다.
//
//   F1(낮은 쪽)이 입을 벌린 정도, F2(높은 쪽)가 혀의 앞뒤를 정한다.
const VOWEL = {
  a: [730, 1090],     // 아  — 입을 크게
  e: [530, 1840],     // 에  — 「웩」
  i: [270, 2290],     // 이  — 「이얍」의 앞
  o: [570, 840],      // 오
  u: [300, 870],      // 우  — 「으」
};

/**
 * @param f0     성대 기본 주파수. 남성 100~140, 여성/비명 200~400, 괴물 60~90.
 * @param vowel  'a'|'e'|'i'|'o'|'u' 또는 [시작, 끝] 이면 모음이 변한다 (이→얍)
 * @param bend   끝날 때 음높이 배수. 1보다 작으면 처지고(신음), 크면 치솟는다(비명)
 * @param rasp   0~1. 성대가 거칠게 떨리는 정도 — 괴물일수록 높다
 */
function vox(f0, { dur = 0.3, gain = 0.22, at = 0, vowel = 'a', bend = 0.8, rasp = 0, vol = 1, out = null } = {}) {
  if (!ensure() || !enabled || vol <= 0.02) return;
  const t = now() + at;
  const g0 = gain * vol;
  const seq = Array.isArray(vowel) ? vowel : [vowel, vowel];
  const [f1a, f2a] = VOWEL[seq[0]] || VOWEL.a;
  const [f1b, f2b] = VOWEL[seq[1]] || VOWEL.a;

  const src = ctx.createOscillator();
  src.type = 'sawtooth';
  src.frequency.setValueAtTime(f0, t);
  src.frequency.exponentialRampToValueAtTime(Math.max(20, f0 * bend), t + dur);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(g0, t + Math.min(0.05, dur * 0.18));
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  // 포먼트 두 개를 병렬로 — 직렬로 걸면 소리가 다 죽는다
  for (const [fa, fb, amp, q] of [[f1a, f1b, 1.0, 7], [f2a, f2b, 0.5, 11]]) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = q;
    bp.frequency.setValueAtTime(fa, t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(80, fb), t + dur);
    const a = ctx.createGain();
    a.gain.value = amp;
    src.connect(bp).connect(a).connect(env);
  }
  env.connect(out || master);
  src.start(t);
  src.stop(t + dur + 0.05);

  // 성대의 거친 떨림 — 이게 없으면 괴물이 아니라 신디사이저다
  if (rasp > 0) {
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = (f1a + f2a) / 2;
    bp.Q.value = 2.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(g0 * rasp, t + 0.03);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(ng).connect(out || master);
    n.start(t);
    n.stop(t + dur + 0.05);
  }
}

// ─────────────────── 몬스터 음색 ───────────────────
// 종족마다 「무엇으로 만들어졌는가」가 소리로 들려야 한다.
// 해골은 마른 뼈, 구울은 젖은 살, 망령은 빈 공허, 골렘은 돌.
// 눈으로 실루엣을 구분하듯 귀로도 구분되게 만드는 것이 목적이다.
const VOICE = {
  skeleton: {
    hit: (v, crit) => {                       // 마른 뼈 — 딱, 잔향 없음
      noise({ dur: crit ? 0.13 : 0.07, gain: crit ? 0.34 : 0.24, lp: 7000, lpTo: 1400, hp: 1500, vol: v });
      tone(crit ? 320 : 240, { type: 'square', dur: 0.05, gain: 0.14, to: 120, vol: v });
      tone(crit ? 900 : 720, { type: 'square', dur: 0.04, gain: 0.07, at: 0.015, to: 380, vol: v });
    },
    attack: (v) => noise({ dur: 0.12, gain: 0.16, lp: 5400, lpTo: 1000, hp: 900, vol: v }),
    // 해골은 폐가 없다 — 비명 대신 텅 빈 그르렁. 그래도 「소리를 낸다」가 중요하다.
    cry: (v, crit) => vox(78, { dur: crit ? 0.3 : 0.19, gain: 0.15, vowel: ['u', 'o'], bend: 0.72, rasp: 0.9, vol: v }),
    aggro: (v) => {                           // 턱이 딸깍딸깍
      for (let i = 0; i < 4; i++)
        tone(300 - i * 20, { type: 'square', dur: 0.035, gain: 0.09, at: i * 0.055, to: 150, vol: v });
    },
    die: (v) => {                             // 뼈가 무너져 내린다
      for (let i = 0; i < 6; i++)
        noise({ dur: 0.07, gain: 0.14, lp: 6000, lpTo: 900, hp: 1200, at: i * 0.06, vol: v });
      tone(150, { type: 'square', dur: 0.2, gain: 0.1, to: 60, at: 0.1, vol: v });
    },
  },
  ghoul: {
    hit: (v, crit) => {                       // 젖은 살 — 퍽
      noise({ dur: crit ? 0.2 : 0.13, gain: crit ? 0.4 : 0.3, lp: crit ? 1300 : 900, lpTo: 150, vol: v });
      tone(crit ? 130 : 104, { type: 'triangle', dur: 0.14, gain: 0.22, to: 44, vol: v });
      tone(196, { type: 'sawtooth', dur: 0.18, gain: 0.09, to: 78, at: 0.02, vol: v });  // 짧은 신음
    },
    attack: (v) => {                          // 할퀴기
      noise({ dur: 0.14, gain: 0.18, lp: 3800, lpTo: 700, hp: 600, vol: v });
      tone(150, { type: 'sawtooth', dur: 0.12, gain: 0.1, to: 70, vol: v });
    },
    // 「웩」 — 젖은 살이 눌리는 소리. 입을 벌렸다 다무는 모음 변화가 핵심.
    cry: (v, crit) => vox(crit ? 118 : 96, { dur: crit ? 0.42 : 0.28, gain: 0.26, vowel: ['e', 'u'], bend: 0.62, rasp: 0.45, vol: v }),
    aggro: (v) => {                           // 그르렁 — 낮고 젖은 신음
      tone(88, { type: 'sawtooth', dur: 0.5, gain: 0.17, to: 62, vol: v });
      tone(132, { type: 'sawtooth', dur: 0.45, gain: 0.09, to: 88, detune: 22, vol: v });
      noise({ dur: 0.42, gain: 0.09, lp: 700, lpTo: 220, vol: v });
    },
    die: (v) => {
      tone(120, { type: 'sawtooth', dur: 0.5, gain: 0.2, to: 38, vol: v });
      noise({ dur: 0.42, gain: 0.26, lp: 1100, lpTo: 110, vol: v });
    },
  },
  archer: {
    hit: (v, crit) => {                       // 망령 — 실체가 없다. 공허한 울림.
      tone(crit ? 660 : 520, { type: 'sine', dur: 0.26, gain: 0.2, to: 170, vol: v });
      tone(crit ? 990 : 780, { type: 'sine', dur: 0.22, gain: 0.1, at: 0.03, to: 260, vol: v });
      noise({ dur: 0.14, gain: 0.14, lp: 3400, lpTo: 500, hp: 800, vol: v });
    },
    attack: (v) => {                          // 시위를 놓는 팅
      tone(430, { type: 'triangle', dur: 0.14, gain: 0.16, to: 160, vol: v });
      noise({ dur: 0.08, gain: 0.1, lp: 6000, lpTo: 1200, hp: 1800, vol: v });
    },
    // 「으아—」 높고 가늘게 끌리는 비명. 망령이라 끝이 치솟는다.
    cry: (v, crit) => vox(crit ? 320 : 250, { dur: crit ? 0.5 : 0.34, gain: 0.18, vowel: ['u', 'a'], bend: 1.5, rasp: 0.12, vol: v }),
    aggro: (v) => {                           // 가늘고 높은 흐느낌
      tone(660, { type: 'sine', dur: 0.7, gain: 0.13, to: 300, vol: v });
      tone(990, { type: 'sine', dur: 0.6, gain: 0.06, at: 0.08, to: 420, vol: v });
    },
    die: (v) => {                             // 사라진다 — 위로 올라가며 흩어진다
      tone(320, { type: 'sine', dur: 0.7, gain: 0.18, to: 1200, vol: v });
      noise({ dur: 0.6, gain: 0.12, lp: 900, lpTo: 5200, hp: 500, vol: v });
    },
  },
  golem: {
    hit: (v, crit) => {                       // 돌 — 저역이 몸통이고 자갈이 표면이다
      tone(crit ? 78 : 62, { type: 'sine', dur: 0.22, gain: 0.34, to: 30, vol: v });
      noise({ dur: crit ? 0.24 : 0.16, gain: 0.3, lp: 2200, lpTo: 200, vol: v });
      noise({ dur: 0.18, gain: 0.12, lp: 7000, lpTo: 2000, hp: 2500, at: 0.02, vol: v });  // 부스러기
    },
    attack: (v) => {                          // 육중한 스윙
      noise({ dur: 0.24, gain: 0.2, lp: 1400, lpTo: 300, vol: v });
      tone(70, { type: 'sine', dur: 0.2, gain: 0.18, to: 34, vol: v });
    },
    // 돌이 내는 저음 — 목소리라기보다 울림
    cry: (v, crit) => vox(52, { dur: crit ? 0.5 : 0.32, gain: 0.2, vowel: ['o', 'u'], bend: 0.68, rasp: 0.75, vol: v }),
    aggro: (v) => {                           // 갈리는 돌
      noise({ dur: 0.8, gain: 0.16, lp: 900, lpTo: 260, q: 4, vol: v });
      tone(52, { type: 'sawtooth', dur: 0.75, gain: 0.16, to: 34, vol: v });
    },
    die: (v) => {                             // 무너진다
      tone(48, { type: 'sine', dur: 0.9, gain: 0.3, to: 24, vol: v });
      for (let i = 0; i < 7; i++)
        noise({ dur: 0.12, gain: 0.16, lp: 2600, lpTo: 300, at: i * 0.07, vol: v });
    },
  },
  lord: {
    hit: (v, crit) => {
      tone(crit ? 116 : 92, { type: 'sawtooth', dur: 0.2, gain: 0.26, to: 44, vol: v });
      noise({ dur: 0.18, gain: 0.24, lp: 2000, lpTo: 200, vol: v });
      tone(466, { type: 'square', dur: 0.1, gain: 0.07, at: 0.02, to: 233, vol: v });
    },
    attack: (v) => {
      noise({ dur: 0.26, gain: 0.22, lp: 3000, lpTo: 400, hp: 300, vol: v });
      tone(87, { type: 'sawtooth', dur: 0.24, gain: 0.16, to: 41, vol: v });
    },
    cry: (v, crit) => vox(crit ? 74 : 62, { dur: 0.55, gain: 0.24, vowel: ['a', 'o'], bend: 0.6, rasp: 0.85, vol: v }),
    aggro: (v) => Sfx.bossRoar(),
    die: (v) => Sfx.bossRoar(),
  },
};

// 같은 순간에 여러 마리가 같은 소리를 내면 뭉개져서 「크기만 한 소음」이 된다.
// 종류별로 짧게 잠가 둔다 — 26마리가 동시에 울어도 귀가 버틴다.
const lastVoice = new Map();
function voiceOk(key, ms) {
  if (!ctx) return true;
  const t = ctx.currentTime * 1000;
  if ((lastVoice.get(key) ?? -1e9) + ms > t) return false;
  lastVoice.set(key, t);
  return true;
}

// ─────────────────────── 효과음 ───────────────────────
export const Sfx = {
  swing() { noise({ dur: 0.13, gain: 0.14, lp: 5200, lpTo: 900, hp: 700 }); },

  hit(crit = false) {
    noise({ dur: crit ? 0.2 : 0.12, gain: crit ? 0.38 : 0.26, lp: crit ? 2600 : 1700, lpTo: 260 });
    tone(crit ? 165 : 120, { type: 'triangle', dur: crit ? 0.17 : 0.1, gain: 0.2, to: crit ? 60 : 50 });
    if (crit) tone(880, { type: 'square', dur: 0.09, gain: 0.09, at: 0.01, to: 440 });
  },

  /** 종족별 피격음. vol 은 거리 감쇠(0~1). */
  enemyHit(kind, crit = false, vol = 1) {
    const V = VOICE[kind];
    if (!V) return Sfx.hit(crit);
    if (!voiceOk('h' + kind, 45)) return;
    V.hit(vol, crit);
    // 타격음(재질)과 비명(생명)은 다른 층위다. 둘 다 있어야 「맞았다」가 산다.
    // 비명은 타격음보다 조금 늦게 나와야 자연스럽다 — 맞고 나서 소리를 지른다.
    if (V.cry && voiceOk('c' + kind, 190)) {
      const d = ctx ? ctx.currentTime : 0;
      setTimeout(() => V.cry(vol * 0.85, crit), crit ? 25 : 40);
    }
  },

  /** 종족별 공격음 — 무엇을 휘두르는지가 들려야 예고가 귀로도 온다 */
  enemyAttack(kind, vol = 1) {
    const V = VOICE[kind];
    if (!V) return Sfx.swing();
    if (!voiceOk('a' + kind, 60)) return;
    V.attack(vol);
  },

  /** 어그로가 붙는 순간의 「음성」 — 붉은 원과 짝을 이룬다 */
  enemyAggro(kind, vol = 1) {
    const V = VOICE[kind];
    if (!V || !voiceOk('g' + kind, 260)) return;
    V.aggro(vol);
  },

  /**
   * 플레이어 기합 — 「이얍」. 매 스윙마다 지르면 금방 물린다.
   * 호출부에서 확률로 거르고, 여기서도 한 번 더 잠근다.
   */
  playerShout(crit = false) {
    if (!voiceOk('shout', 900)) return;
    if (crit) {
      // 「이야압!」 — 크리티컬은 길고 끝이 올라간다
      vox(142, { dur: 0.1, gain: 0.2, vowel: 'i', bend: 1.15, rasp: 0.1 });
      vox(158, { dur: 0.26, gain: 0.26, vowel: ['a', 'o'], bend: 0.72, rasp: 0.22, at: 0.09 });
    } else {
      vox(132, { dur: 0.07, gain: 0.16, vowel: 'i', bend: 1.1 });
      vox(146, { dur: 0.17, gain: 0.2, vowel: 'a', bend: 0.75, rasp: 0.15, at: 0.06 });
    }
  },

  /** 플레이어가 맞았을 때의 짧은 신음 — 「윽」 */
  playerGrunt(vol = 1) {
    if (!voiceOk('grunt', 420)) return;
    vox(118, { dur: 0.2, gain: 0.22, vowel: ['u', 'o'], bend: 0.68, rasp: 0.3, vol });
  },

  enemyDie(kind = null, vol = 1) {
    const V = kind && VOICE[kind];
    if (V) return V.die(vol);
    noise({ dur: 0.34, gain: 0.24, lp: 1400, lpTo: 130, vol });
    tone(210, { type: 'sawtooth', dur: 0.3, gain: 0.14, to: 48, vol });
  },

  playerHurt() {
    tone(150, { type: 'sawtooth', dur: 0.26, gain: 0.26, to: 62 });
    noise({ dur: 0.2, gain: 0.2, lp: 900, lpTo: 200 });
  },

  cast() {
    tone(320, { type: 'triangle', dur: 0.22, gain: 0.15, to: 900 });
    noise({ dur: 0.18, gain: 0.09, lp: 900, lpTo: 4200, hp: 400 });
  },

  dash() { noise({ dur: 0.22, gain: 0.17, lp: 4600, lpTo: 500, hp: 500 }); },

  nova() {
    tone(90, { type: 'sine', dur: 0.55, gain: 0.32, to: 34 });
    noise({ dur: 0.5, gain: 0.3, lp: 3200, lpTo: 180 });
    tone(440, { type: 'triangle', dur: 0.28, gain: 0.12, to: 130, at: 0.02 });
  },

  meteor() {
    noise({ dur: 0.8, gain: 0.16, lp: 400, lpTo: 2600 });                 // 낙하 예고
    tone(70, { type: 'sine', dur: 0.9, gain: 0.3, at: 0.8, to: 26 });     // 착탄
    noise({ dur: 0.7, gain: 0.42, lp: 3600, lpTo: 120, at: 0.8 });
  },

  /**
   * 아이템이 바닥에 떨어지는 소리 — 「털썩」.
   * 저역 임팩트(무게) + 흙먼지 노이즈 + 한 박자 늦은 작은 튐(구르는 느낌).
   * 등급이 높으면 뒤에 맑은 배음을 얹어 「좋은 게 떨어졌다」를 귀로도 알린다.
   */
  itemDrop(rarity = 0) {
    // 몸통 — 낮게 툭 떨어지는 무게감
    tone(96, { type: 'sine', dur: 0.26, gain: 0.3, to: 38 });
    tone(150, { type: 'triangle', dur: 0.16, gain: 0.12, to: 60 });
    // 먼지 — 짧고 탁하게
    noise({ dur: 0.16, gain: 0.22, lp: 1100, lpTo: 130 });
    // 두 번째 튐 — 이게 있어야 「털썩」이지 「퍽」이 아니다
    tone(78, { type: 'sine', dur: 0.13, gain: 0.13, at: 0.11, to: 42 });
    noise({ dur: 0.1, gain: 0.1, lp: 700, lpTo: 120, at: 0.11 });
    // 등급 배음
    if (rarity >= 2) {
      const f = rarity >= 3 ? 1046.5 : 784;
      tone(f, { type: 'triangle', dur: 0.5, gain: 0.075, at: 0.05 });
      tone(f * 1.5, { type: 'sine', dur: 0.4, gain: 0.04, at: 0.09 });
    }
  },

  pickup(rarity = 0) {
    const base = [523.25, 659.25, 783.99, 1046.5][Math.min(3, rarity)];
    for (let i = 0; i <= rarity; i++)
      tone(base * Math.pow(1.26, i), { type: 'triangle', dur: 0.22, gain: 0.14, at: i * 0.055 });
  },

  potion() { tone(392, { type: 'sine', dur: 0.3, gain: 0.16, to: 784 }); },

  levelUp() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone(f, { type: 'triangle', dur: 0.4, gain: 0.16, at: i * 0.09 }));
  },

  portal() {
    tone(180, { type: 'sine', dur: 0.7, gain: 0.2, to: 720 });
    noise({ dur: 0.6, gain: 0.12, lp: 600, lpTo: 5000, hp: 300 });
  },

  bossRoar() {
    tone(58, { type: 'sawtooth', dur: 1.5, gain: 0.34, to: 30 });
    tone(87, { type: 'sawtooth', dur: 1.4, gain: 0.2, to: 41, detune: 18 });
    noise({ dur: 1.3, gain: 0.24, lp: 700, lpTo: 90 });
    tone(233, { type: 'square', dur: 0.9, gain: 0.08, at: 0.15, to: 116 });
  },

  death() {
    [392, 349, 311, 233].forEach((f, i) =>
      tone(f, { type: 'sine', dur: 0.75, gain: 0.2, at: i * 0.22 }));
    noise({ dur: 1.4, gain: 0.14, lp: 700, lpTo: 70 });
  },

  victory() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      tone(f, { type: 'triangle', dur: 0.6, gain: 0.16, at: i * 0.13 }));
  },
};

// ─────────────── 앰비언트: 저역 패드 + 이따금 물방울 ───────────────
// ─────────────────── 던전 앰비언스 ───────────────────
// 「음침함」은 큰 소리가 아니라 **불규칙한 작은 소리**에서 온다.
// 일정한 간격으로 반복되면 3분 만에 루프인 걸 알아채고 귀가 꺼 버린다.
// 그래서 모든 사건은 자기 스스로 다음 시각을 다시 뽑는다.
//
// 「멀리서」를 내려면 잔향이 필요하다. 외부 임펄스 파일 없이,
// 노이즈를 지수 감쇠시킨 버퍼를 만들어 ConvolverNode 에 물린다 —
// 돌방의 울림을 코드로 만드는 것이다.

let verb = null;
function reverb() {
  if (verb) return verb;
  const sec = 2.6, n = (ctx.sampleRate * sec) | 0;
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      // 초반에 성긴 반사, 뒤로 갈수록 촘촘한 꼬리 — 돌벽의 울림
      const sparse = i < n * 0.08 && Math.random() > 0.986 ? 6 : 1;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6) * sparse;
    }
  }
  const c = ctx.createConvolver();
  c.buffer = buf;
  const wet = ctx.createGain();
  wet.gain.value = 0.9;
  c.connect(wet).connect(master);
  verb = c;
  return c;
}

/**
 * 먼 곳에서 나는 소리 — 잔향으로만 보낸다.
 * 직접음이 없고 반사음만 들리는 것이 「멀다」의 정체다.
 * fn 은 목적지 노드를 받아 tone/noise/vox 의 out 으로 넘긴다.
 */
function far(fn) {
  if (!ensure() || !enabled) return;
  fn(reverb());
}

// ── 사건들 ────────────────────────────────────────────
// 각 항목: [최소 간격, 최대 간격, 소리]  (초)
// export 하는 이유는 검증이다. 사건 간격이 16~95초라 그냥 두면
// 비명 코드에 버그가 있어도 40초 뒤에야 드러난다 — 검사가 직접 불러 본다.
export const AMBIENT_EVENTS = {
  // 물방울 — 「똑」. 짧은 사인 + 급격한 하강 + 작은 공명이 물이다.
  drip: [4, 13, (deep) => {
    const f = 900 + Math.random() * 1100;
    tone(f, { type: 'sine', dur: 0.09, gain: 0.06, to: f * 0.35 });
    tone(f * 0.5, { type: 'sine', dur: 0.22, gain: 0.03, at: 0.02, to: f * 0.2 });
    if (deep) noise({ dur: 0.14, gain: 0.02, lp: 2400, lpTo: 400, at: 0.03 });
  }],
  // 멀리서 나는 비명 — 잔향으로만 나가고, 저역만 남게 눌러 「거리」를 만든다
  scream: [38, 95, () => far((out) => {
    const f0 = 180 + Math.random() * 160;
    vox(f0, { dur: 0.9 + Math.random() * 0.5, gain: 0.085, vowel: ['a', 'o'], bend: 0.55, rasp: 0.35, out });
  })],
  // 쇠사슬 — 마르고 짧게 여러 번
  chain: [22, 60, () => far((out) => {
    const n = 3 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++)
      noise({ dur: 0.05, gain: 0.05, lp: 7000, lpTo: 2200, hp: 2600, at: i * (0.05 + Math.random() * 0.07), out });
  })],
  // 돌이 어긋나는 소리 — 아주 낮게, 길게
  shift: [30, 85, () => far((out) => {
    tone(44, { type: 'sawtooth', dur: 1.4, gain: 0.09, to: 30, out });
    noise({ dur: 1.2, gain: 0.05, lp: 420, lpTo: 140, q: 3, out });
  })],
  // 쥐 — 가까이서. 잔향 없이 나야 「바로 옆」이 된다
  rat: [16, 48, () => {
    for (let i = 0; i < 2; i++)
      tone(2200 + Math.random() * 900, { type: 'square', dur: 0.035, gain: 0.022, at: i * 0.06, to: 1400 });
    noise({ dur: 0.1, gain: 0.02, lp: 8000, hp: 3000, at: 0.02 });
  }],
};

// 층 테마마다 무엇이 자주 나는지가 다르다
const AMBIENT_MIX = {
  crypt: { drip: 1, scream: 1, chain: 1.2, shift: 1, rat: 1.2 },
  flood: { drip: 2.6, scream: 0.8, chain: 0.7, shift: 1, rat: 0.6 },
  throne: { drip: 0.5, scream: 2.2, chain: 1.4, shift: 1.6, rat: 0.3 },
};

export function startAmbient(themeKey = 'crypt') {
  if (!ensure() || ambient) return;
  const base = { crypt: 55, flood: 49, throne: 43.65 }[themeKey] || 55;
  const mix = AMBIENT_MIX[themeKey] || AMBIENT_MIX.crypt;

  const g = ctx.createGain();
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(0.075, now() + 3);
  g.connect(master);

  const oscs = [];
  for (const [mult, det] of [[1, 0], [1, 7], [2.002, -5], [3, 4]]) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = base * mult;
    o.detune.value = det;
    const og = ctx.createGain();
    og.gain.value = mult > 2 ? 0.16 : 0.5;
    o.connect(og).connect(g);
    o.start();
    oscs.push(o);
  }
  // 아주 느린 흔들림 — 정지된 패드는 금방 귀에 걸린다
  const lfo = ctx.createOscillator();
  const lfoG = ctx.createGain();
  lfo.frequency.value = 0.06;
  lfoG.gain.value = 0.03;
  lfo.connect(lfoG).connect(g.gain);
  lfo.start();

  // ── 바람 — 끊기지 않는 얇은 층. 필터가 아주 느리게 오간다.
  const windSrc = ctx.createBufferSource();
  windSrc.buffer = noiseBuf;
  windSrc.loop = true;
  const windF = ctx.createBiquadFilter();
  windF.type = 'bandpass';
  windF.frequency.value = 380;
  windF.Q.value = 0.7;
  const windG = ctx.createGain();
  windG.gain.value = 0.026;
  const windLfo = ctx.createOscillator();
  const windLfoG = ctx.createGain();
  windLfo.frequency.value = 0.041;
  windLfoG.gain.value = 210;              // 380 ± 210 Hz 로 천천히 오간다
  windLfo.connect(windLfoG).connect(windF.frequency);
  windLfo.start();
  windSrc.connect(windF).connect(windG).connect(master);
  windSrc.start();

  // ── 불규칙 사건 — 각자 다음 시각을 스스로 뽑는다
  const timers = [];
  const deep = themeKey === 'flood';
  for (const [key, [lo, hi, play]] of Object.entries(AMBIENT_EVENTS)) {
    const w = mix[key] ?? 1;
    if (w <= 0) continue;
    const schedule = () => {
      const gap = (lo + Math.random() * (hi - lo)) / w;
      const id = setTimeout(() => {
        if (enabled && ctx && ctx.state === 'running') {
          try { play(deep); } catch { /* 컨텍스트가 닫히는 중 */ }
        }
        schedule();
      }, gap * 1000);
      timers[timers.length - 1] = id;
    };
    timers.push(0);
    schedule();
  }

  ambient = { g, oscs, lfo, windLfo, windSrc, windG, timers };
}

export function stopAmbient() {
  if (!ambient) return;
  const { g, oscs, lfo, windLfo, windSrc, windG, timers } = ambient;
  for (const id of timers) clearTimeout(id);
  try {
    g.gain.cancelScheduledValues(now());
    g.gain.setValueAtTime(g.gain.value, now());
    g.gain.linearRampToValueAtTime(0.0001, now() + 0.6);
    oscs.forEach((o) => o.stop(now() + 0.7));
    lfo.stop(now() + 0.7);
    windG.gain.linearRampToValueAtTime(0.0001, now() + 0.6);
    windSrc.stop(now() + 0.7);
    windLfo.stop(now() + 0.7);
  } catch { /* 컨텍스트가 이미 닫힌 경우 */ }
  ambient = null;
}
