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

function tone(freq, { type = 'sine', dur = 0.2, gain = 0.25, at = 0, decay = null, to = null, detune = 0 } = {}) {
  if (!ensure() || !enabled) return;
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
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + (decay || dur) + 0.05);
}

function noise({ dur = 0.18, gain = 0.3, at = 0, lp = 1800, lpTo = null, hp = 0, q = 1 } = {}) {
  if (!ensure() || !enabled) return;
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
  g.connect(master);
  s.start(t);
  s.stop(t + dur + 0.05);
}

// ─────────────────────── 효과음 ───────────────────────
export const Sfx = {
  swing() { noise({ dur: 0.13, gain: 0.14, lp: 5200, lpTo: 900, hp: 700 }); },

  hit(crit = false) {
    noise({ dur: crit ? 0.2 : 0.12, gain: crit ? 0.38 : 0.26, lp: crit ? 2600 : 1700, lpTo: 260 });
    tone(crit ? 165 : 120, { type: 'triangle', dur: crit ? 0.17 : 0.1, gain: 0.2, to: crit ? 60 : 50 });
    if (crit) tone(880, { type: 'square', dur: 0.09, gain: 0.09, at: 0.01, to: 440 });
  },

  enemyDie() {
    noise({ dur: 0.34, gain: 0.24, lp: 1400, lpTo: 130 });
    tone(210, { type: 'sawtooth', dur: 0.3, gain: 0.14, to: 48 });
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
export function startAmbient(themeKey = 'crypt') {
  if (!ensure() || ambient) return;
  const base = { crypt: 55, flood: 49, throne: 43.65 }[themeKey] || 55;
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

  const drip = setInterval(() => {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    if (Math.random() < 0.45)
      tone(700 + Math.random() * 900, { type: 'sine', dur: 0.35, gain: 0.045, to: 240 });
  }, 3400);

  ambient = { g, oscs, lfo, drip };
}

export function stopAmbient() {
  if (!ambient) return;
  const { g, oscs, lfo, drip } = ambient;
  clearInterval(drip);
  try {
    g.gain.cancelScheduledValues(now());
    g.gain.setValueAtTime(g.gain.value, now());
    g.gain.linearRampToValueAtTime(0.0001, now() + 0.6);
    oscs.forEach((o) => o.stop(now() + 0.7));
    lfo.stop(now() + 0.7);
  } catch { /* 컨텍스트가 이미 닫힌 경우 */ }
  ambient = null;
}
