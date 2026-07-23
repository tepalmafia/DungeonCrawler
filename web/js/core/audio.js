// Web Audio API 절차 합성 효과음 — 외부 오디오 파일 없이 전부 코드로 생성
const AudioSys = {
  ctx: null,
  master: null,
  muted: false,
  _noiseBuf: null,

  // 브라우저 정책상 첫 사용자 입력 후에만 AudioContext 사용 가능
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);

      const len = this.ctx.sampleRate;
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
  },

  _tone({ type = 'square', f0 = 440, f1 = null, dur = 0.1, vol = 0.4, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(f1 ?? f0, 1), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  },

  _noise({ dur = 0.08, vol = 0.3, freq = 1200, q = 1, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t, Math.random() * 0.5, dur + 0.05);
  },

  slash()  { this._noise({ dur: 0.07, vol: 0.22, freq: 2400, q: 0.8 }); },
  hit()    { this._noise({ dur: 0.06, vol: 0.4, freq: 900 }); this._tone({ f0: 180, f1: 60, dur: 0.08, vol: 0.35 }); },
  crit()   { this.hit(); this._tone({ f0: 520, f1: 1100, dur: 0.12, vol: 0.3, delay: 0.02 }); },
  hurt()   { this._tone({ type: 'sawtooth', f0: 200, f1: 55, dur: 0.25, vol: 0.5 }); this._noise({ dur: 0.15, vol: 0.3, freq: 500 }); },
  die()    { this._tone({ f0: 320, f1: 40, dur: 0.2, vol: 0.35 }); this._noise({ dur: 0.12, vol: 0.25, freq: 700 }); },
  dash()   { this._noise({ dur: 0.12, vol: 0.18, freq: 3000, q: 0.5 }); },
  pickup() { this._tone({ type: 'sine', f0: 660, dur: 0.08, vol: 0.3 }); this._tone({ type: 'sine', f0: 990, dur: 0.12, vol: 0.3, delay: 0.08 }); },
  thud()   { this._tone({ type: 'sine', f0: 95, f1: 35, dur: 0.18, vol: 0.6 }); this._noise({ dur: 0.1, vol: 0.35, freq: 300 }); },
  shoot()  { this._noise({ dur: 0.06, vol: 0.2, freq: 1800, q: 2 }); },

  wave() {
    [330, 440, 554].forEach((f, i) =>
      this._tone({ type: 'triangle', f0: f, dur: 0.12, vol: 0.25, delay: i * 0.09 }));
  },

  levelup() {
    [523, 659, 784, 1047].forEach((f, i) =>
      this._tone({ type: 'triangle', f0: f, dur: 0.14, vol: 0.3, delay: i * 0.08 }));
  },

  orb()   { this._tone({ type: 'sine', f0: 880 + Math.random() * 220, dur: 0.06, vol: 0.15 }); },
  clank() { this._tone({ type: 'square', f0: 1200, f1: 700, dur: 0.06, vol: 0.25 }); this._noise({ dur: 0.05, vol: 0.2, freq: 3000, q: 3 }); },

  // 유물 획득 팡파레 — 등급이 높을수록 화려하게
  relic(rarity) {
    const seqs = {
      common:    [523, 784],
      rare:      [523, 659, 988],
      epic:      [523, 659, 784, 1175],
      legendary: [392, 523, 659, 784, 1047, 1319],
    };
    (seqs[rarity] || seqs.common).forEach((f, i) =>
      this._tone({ type: 'triangle', f0: f, dur: 0.16, vol: 0.3, delay: i * 0.09 }));
  },
  chest() { this._tone({ type: 'triangle', f0: 392, dur: 0.1, vol: 0.3 }); this._tone({ type: 'triangle', f0: 587, dur: 0.12, vol: 0.3, delay: 0.09 }); this._tone({ type: 'triangle', f0: 784, dur: 0.16, vol: 0.3, delay: 0.18 }); },
  roar()  { this._tone({ type: 'sawtooth', f0: 70, f1: 38, dur: 0.7, vol: 0.55 }); this._noise({ dur: 0.5, vol: 0.3, freq: 250, q: 0.6 }); },

  gameover() {
    [392, 311, 233, 155].forEach((f, i) =>
      this._tone({ type: 'triangle', f0: f, dur: 0.3, vol: 0.3, delay: i * 0.22 }));
  },
};
