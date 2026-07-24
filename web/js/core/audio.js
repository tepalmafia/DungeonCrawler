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
      this.master.gain.value = this.muted ? 0 : 0.35;
      this.master.connect(this.ctx.destination);

      const len = this.ctx.sampleRate;
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    // 언락 전에 요청된 BGM이 있으면 이제 시작
    if (typeof Music !== 'undefined' && Music.pending && !Music.current) {
      Music.start(Music.pending);
    }
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

  // 피치 변주 — 같은 효과음이 반복돼도 기계적으로 들리지 않게 ±spread 만큼 흔든다
  _v(f, spread = 0.08) { return f * (1 - spread + Math.random() * spread * 2); },

  // 검격: 콤보 단계(0/1/2)마다 음이 올라가고, 3타(마무리)는 낮은 붕 소리가 겹친다
  slash(step = 0) {
    const base = [2200, 2600, 3100][step] || 2400;
    this._noise({ dur: step === 2 ? 0.1 : 0.07, vol: step === 2 ? 0.3 : 0.22, freq: this._v(base), q: 0.8 });
    if (step === 2) this._tone({ type: 'sine', f0: 140, f1: 50, dur: 0.14, vol: 0.3 });
  },
  hit()    { this._noise({ dur: 0.06, vol: 0.4, freq: this._v(900) }); this._tone({ f0: this._v(180), f1: 60, dur: 0.08, vol: 0.35 }); },
  crit()   {
    this._noise({ dur: 0.08, vol: 0.45, freq: this._v(750) });
    this._tone({ f0: this._v(160), f1: 45, dur: 0.12, vol: 0.42 });                     // 묵직한 저음
    this._tone({ f0: this._v(520), f1: 1100, dur: 0.12, vol: 0.3, delay: 0.02 });       // 상승 임팩트
    this._tone({ type: 'triangle', f0: this._v(1800), f1: 900, dur: 0.07, vol: 0.14, delay: 0.01 }); // 금속성 핑
  },
  hurt()   {
    this._tone({ type: 'sine', f0: 65, f1: 30, dur: 0.22, vol: 0.65 });                 // 몸에 꽂히는 저음
    this._tone({ type: 'sawtooth', f0: this._v(200), f1: 55, dur: 0.25, vol: 0.5 });
    this._noise({ dur: 0.15, vol: 0.3, freq: 500 });
  },
  // 처치음: 적 급에 따라 무게가 다르다 (정예는 굵게, 보스는 굉음)
  die(grade = 'small') {
    if (grade === 'boss') {
      this._tone({ f0: 200, f1: 25, dur: 0.6, vol: 0.55 });
      this._tone({ type: 'sine', f0: 70, f1: 20, dur: 0.7, vol: 0.6, delay: 0.05 });
      this._noise({ dur: 0.5, vol: 0.4, freq: 400, q: 0.5 });
    } else if (grade === 'elite') {
      this._tone({ f0: this._v(260), f1: 30, dur: 0.3, vol: 0.45 });
      this._noise({ dur: 0.2, vol: 0.32, freq: this._v(550), q: 0.7 });
    } else {
      this._tone({ f0: this._v(320), f1: 40, dur: 0.2, vol: 0.35 });
      this._noise({ dur: 0.12, vol: 0.25, freq: this._v(700) });
    }
  },
  dash()   { this._noise({ dur: 0.12, vol: 0.18, freq: this._v(3000), q: 0.5 }); },
  pickup() { this._tone({ type: 'sine', f0: 660, dur: 0.08, vol: 0.3 }); this._tone({ type: 'sine', f0: 990, dur: 0.12, vol: 0.3, delay: 0.08 }); },
  thud()   { this._tone({ type: 'sine', f0: this._v(95), f1: 35, dur: 0.18, vol: 0.6 }); this._noise({ dur: 0.1, vol: 0.35, freq: 300 }); },
  shoot()  { this._noise({ dur: 0.06, vol: 0.2, freq: this._v(1800), q: 2 }); },
  bow(finisher = false) {
    this._tone({ type: 'square', f0: this._v(320), f1: 150, dur: 0.07, vol: finisher ? 0.26 : 0.2 });
    this._noise({ dur: 0.05, vol: 0.15, freq: this._v(2500), q: 1.5 });
    if (finisher) this._tone({ type: 'sine', f0: 120, f1: 60, dur: 0.1, vol: 0.2 });
  },
  bolt(finisher = false) {
    this._tone({ type: 'sine', f0: this._v(480), f1: finisher ? 880 : 720, dur: 0.09, vol: finisher ? 0.28 : 0.22 });
    if (finisher) this._noise({ dur: 0.08, vol: 0.14, freq: 1600, q: 1.2 });
  },
  buy()    { this._tone({ type: 'triangle', f0: 587, dur: 0.08, vol: 0.3 }); this._tone({ type: 'triangle', f0: 880, dur: 0.1, vol: 0.3, delay: 0.07 }); },
  deny()   { this._tone({ type: 'square', f0: 140, f1: 90, dur: 0.12, vol: 0.25 }); },
  shard()  { this._tone({ type: 'sine', f0: 700 + Math.random() * 500, dur: 0.05, vol: 0.12 }); },

  // ── 직업 스킬 전용 사운드 ──
  // 검사 회전 베기: 휘몰아치는 3연속 바람 가르기 + 금속 울림
  spin() {
    for (let i = 0; i < 3; i++) {
      this._noise({ dur: 0.09, vol: 0.28, freq: 1400 + i * 900, q: 1.2, delay: i * 0.07 });
    }
    this._tone({ type: 'sawtooth', f0: 180, f1: 420, dur: 0.28, vol: 0.22 });
    this._tone({ type: 'square', f0: 900, f1: 1400, dur: 0.12, vol: 0.12, delay: 0.14 });
  },

  // 궁수 화살비: 시위 3연발 + 상승 휘파람 (하늘로 쏘아올림)
  rainCast() {
    for (let i = 0; i < 3; i++) {
      this._tone({ type: 'square', f0: 340, f1: 160, dur: 0.06, vol: 0.2, delay: i * 0.06 });
    }
    this._tone({ type: 'sine', f0: 500, f1: 1300, dur: 0.4, vol: 0.14, delay: 0.1 });
  },

  // 화살비 착탄: 가볍고 둔탁한 톡톡 (연발이라 작게)
  rainHit() {
    this._noise({ dur: 0.04, vol: 0.16, freq: 2200, q: 1.5 });
    this._tone({ type: 'triangle', f0: 260, f1: 130, dur: 0.06, vol: 0.14 });
  },

  // 마도사 메테오 시전: 불길한 상승 울림 (낙하 예고)
  meteorCast() {
    this._tone({ type: 'sawtooth', f0: 70, f1: 180, dur: 0.8, vol: 0.25 });
    this._tone({ type: 'sine', f0: 300, f1: 700, dur: 0.7, vol: 0.12, delay: 0.1 });
    this._noise({ dur: 0.6, vol: 0.1, freq: 500, q: 0.5 });
  },

  // 메테오 착탄: 대폭발 굉음 + 잔불 튀는 소리
  meteorImpact() {
    this._tone({ type: 'sine', f0: 150, f1: 28, dur: 0.45, vol: 0.65 });
    this._noise({ dur: 0.35, vol: 0.45, freq: 350, q: 0.6 });
    this._noise({ dur: 0.12, vol: 0.2, freq: 1800, q: 1, delay: 0.12 });
    this._noise({ dur: 0.1, vol: 0.14, freq: 2600, q: 1.5, delay: 0.26 });
  },

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

// ══════════════ 절차 생성 BGM ══════════════
// 층 테마별 코드 진행(루트 노트 열)과 스케일로 베이스+아르페지오+드럼을
// 16분음표 시퀀서로 합성한다. 오디오 파일 0개.
const Music = {
  themes: {
    hub:  { bpm: 66,  roots: [45, 41, 43, 45], scale: [0, 3, 7, 10], drums: false, calm: true },
    f1:   { bpm: 92,  roots: [38, 38, 41, 36], scale: [0, 3, 5, 7],  drums: false },
    f2:   { bpm: 86,  roots: [40, 40, 43, 45], scale: [0, 2, 3, 7],  drums: false },
    f3:   { bpm: 102, roots: [36, 36, 39, 41], scale: [0, 1, 5, 7],  drums: true },
    f4:   { bpm: 118, roots: [38, 38, 36, 34], scale: [0, 3, 6, 7],  drums: true },
    f5:   { bpm: 82,  roots: [33, 33, 36, 32], scale: [0, 1, 3, 7],  drums: true },
    boss: { bpm: 132, roots: [36, 36, 34, 39], scale: [0, 1, 6, 7],  drums: true },
  },
  current: null,
  pending: null,
  step: 0,
  nextT: 0,
  _timer: null,

  _freq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  },

  // 원하는 테마를 선언 — 이미 재생 중이면 무시, 다르면 전환 (null이면 정지)
  ensure(key) {
    if (!AudioSys.ctx) {
      this.pending = key; // 오디오 언락 후 시작
      return;
    }
    if (key === this.current) return;
    this.stop();
    if (key) this.start(key);
  },

  start(key) {
    if (!AudioSys.ctx || !this.themes[key]) { this.pending = key; return; }
    this.current = key;
    this.pending = null;
    this.step = 0;
    this.nextT = AudioSys.ctx.currentTime + 0.05;
    if (!this._timer) {
      this._timer = setInterval(() => this._tick(), 50);
    }
  },

  stop() {
    this.current = null;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  // 룩어헤드 스케줄러: 0.18초 앞까지 노트 예약
  _tick() {
    if (!this.current || !AudioSys.ctx || AudioSys.muted) {
      if (this.current && AudioSys.ctx) {
        // 음소거 중에도 박자는 진행시킨다
        const th = this.themes[this.current];
        const stepDur = 60 / th.bpm / 4;
        while (this.nextT < AudioSys.ctx.currentTime + 0.18) {
          this.nextT += stepDur;
          this.step++;
        }
      }
      return;
    }
    const th = this.themes[this.current];
    const stepDur = 60 / th.bpm / 4;
    while (this.nextT < AudioSys.ctx.currentTime + 0.18) {
      this._schedule(this.nextT, th);
      this.nextT += stepDur;
      this.step++;
    }
  },

  _schedule(t, th) {
    const ctx = AudioSys.ctx;
    const s = this.step % 16;
    const bar = Math.floor(this.step / 16) % th.roots.length;
    const root = th.roots[bar];
    const delay = Math.max(0, t - ctx.currentTime);

    // 베이스 (마디 첫 박 + 뒤 박)
    if (s === 0 || s === 8) {
      AudioSys._tone({ type: 'sawtooth', f0: this._freq(root), dur: 0.28, vol: th.calm ? 0.055 : 0.075, delay });
      AudioSys._tone({ type: 'sine', f0: this._freq(root - 12), dur: 0.3, vol: 0.06, delay });
    }
    // 아르페지오 (8분음표, 스케일 순환)
    if (s % 2 === 0) {
      const deg = th.scale[(this.step / 2) % th.scale.length | 0];
      const octave = (Math.floor(this.step / 8) % 2) * 12;
      AudioSys._tone({
        type: 'triangle',
        f0: this._freq(root + 12 + deg + octave),
        dur: 0.14, vol: th.calm ? 0.035 : 0.042, delay,
      });
    }
    // 드럼 (긴장감 있는 층/보스)
    if (th.drums) {
      if (s % 4 === 0) {
        AudioSys._tone({ type: 'sine', f0: 105, f1: 38, dur: 0.1, vol: 0.16, delay });
      }
      if (s % 4 === 2) {
        AudioSys._noise({ dur: 0.03, vol: 0.05, freq: 6000, q: 1, delay });
      }
    }
  },
};
