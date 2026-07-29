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
      // ── 마스터 체인 (v174) ────────────────────────────────────────────
      // 계측: 전투 6초 실측 피크 -5.13dBFS / RMS -32.9dBFS = 크레스트 27.7dB.
      // 리미터가 없어 **평소엔 안 들리다가 가끔 찢어진다.** 동시 울림이 최대 11겹까지
      // 쌓이는데(봇 실측) 여기에 리버브 send를 달면 피크가 더 튄다 — 리미터가 먼저 서야 한다
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -12;
      this.limiter.knee.value = 6;
      this.limiter.ratio.value = 8;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.14;
      this.limiter.connect(this.ctx.destination);

      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.35;
      this.master.connect(this.limiter);

      // 설정 패널용 2버스: 효과음 / 음악 — 개별 음량은 Meta.data.opts에서
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      // 덕킹 게인 — 중요한 소리(보스 등장·예고·처형)가 날 때 음악/환경음을 순간적으로 누른다.
      // 계측: BGM RMS -46.1dB vs 전투 SFX -32.9dB로 **전투가 시작되면 음악이 사라진다**.
      // 음악을 올리려면 밀려날 자리를 만들어줘야 한다 — 그게 덕킹이다
      this.duck = this.ctx.createGain();
      this.duck.gain.value = 1;
      this.musicBus.connect(this.duck).connect(this.master);
      this.sfxBus.connect(this.master);

      // ── 공유 리버브 (v174) ────────────────────────────────────────────
      // 계측: T60 중앙값 0.190초 — 석조 던전의 실제 T60은 1.2~3.0초다. 지금 이 게임의
      // 모든 소리는 **무향실에서** 난다. ConvolverNode를 소리마다 만들면 CPU가 죽으므로
      // **하나를 공유**하고 각 소리는 send 게인으로만 보낸다
      this.revBus = this.ctx.createGain();      // 여기로 보낸 만큼만 젖는다
      this.revBus.gain.value = 1;
      this.conv = this.ctx.createConvolver();
      this.conv.normalize = false;                // _makeIR이 직접 정규화한다 (위 주석 참조)
      this.conv.buffer = this._makeIR(1.6, 2.6);  // 기본: 석조 통로
      this.revWet = this.ctx.createGain();
      this.revWet.gain.value = 0.34;
      // 리버브 입력을 하이패스 — 저역이 젖으면 진흙이 된다 (계측 I: <400Hz에 에너지 81.4%)
      this.revHP = this.ctx.createBiquadFilter();
      this.revHP.type = 'highpass';
      this.revHP.frequency.value = 320;
      this.revBus.connect(this.revHP).connect(this.conv).connect(this.revWet).connect(this.master);

      this.applyOpts();

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

  // 절차 임펄스 응답 — 외부 파일 없이 잔향을 만든다.
  // 백색잡음을 지수 감쇠로 깎고, 초기 반사(early reflection) 몇 개를 심는다.
  // 스테레오 2채널로 만들어야 잔향이 좌우로 퍼진다 (드라이는 모노여도 웨트가 공간을 준다)
  _makeIR(seconds = 1.6, decay = 2.6) {
    const sr = this.ctx.sampleRate;
    const n = Math.max(1, Math.floor(sr * seconds));
    const buf = this.ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
      // 초기 반사 — 벽까지의 거리감. 채널마다 다르게 찍어 좌우 폭을 준다
      const taps = ch === 0 ? [0.011, 0.023, 0.041, 0.067] : [0.014, 0.027, 0.037, 0.073];
      for (const tp of taps) {
        const i = Math.floor(tp * sr);
        if (i < n) d[i] += (ch === 0 ? 0.7 : 0.62) * (1 - tp / seconds);
      }
      // ★ 에너지를 직접 정규화한다. ConvolverNode의 기본 normalize=true는 IR 총에너지로 나누는데,
      //   1.6초짜리 잡음 IR은 에너지가 커서 **웨트가 드라이의 1/100(피크 0.0003)로 눌린다** —
      //   리버브를 달아놓고 안 들리게 만드는 함정이다 (실측으로 발각).
      //   여기서 고정 에너지로 맞추면 방 길이가 달라져도 잔향 '양'은 일정하고, 길이만 달라진다
      let e = 0;
      for (let i = 0; i < n; i++) e += d[i] * d[i];
      const k = e > 0 ? 12 / Math.sqrt(e) : 1;
      for (let i = 0; i < n; i++) d[i] *= k;
    }
    return buf;
  },

  // 공간 프리셋 — 방/막마다 잔향이 다르다. IR을 바꿔 끼우기만 하면 전체 소리가 그 공간으로 간다
  _SPACES: {
    crypt:  { s: 1.5, d: 2.8, wet: 0.30, hp: 300 },  // 묘지 통로 — 짧고 건조
    hall:   { s: 2.2, d: 2.2, wet: 0.38, hp: 280 },  // 재판소·영지의 홀
    cavern: { s: 2.8, d: 1.9, wet: 0.44, hp: 240 },  // 다리 아래·동굴 — 길게 번진다
    chapel: { s: 3.4, d: 1.6, wet: 0.46, hp: 260 },  // 대성당 — 가장 길다
    throne: { s: 2.6, d: 2.0, wet: 0.40, hp: 300 },  // 왕좌의 홀 — 크되 위압적으로 단단하게
    small:  { s: 0.9, d: 3.4, wet: 0.20, hp: 360 },  // 좁은 방·거점
  },
  space: null,
  setSpace(name) {
    if (!this.ctx || this.space === name) return;
    const p = this._SPACES[name];
    if (!p) return;
    this.space = name;
    this.conv.buffer = this._makeIR(p.s, p.d);
    this.revWet.gain.setTargetAtTime(p.wet, this.ctx.currentTime, 0.25);
    this.revHP.frequency.setTargetAtTime(p.hp, this.ctx.currentTime, 0.25);
  },

  // 덕킹 — 중요한 소리가 날 때 음악·환경음을 amount만큼 눌렀다가 되돌린다
  ducker(amount = 0.35, hold = 0.18, back = 0.5) {
    if (!this.ctx || !this.duck) return;
    const t = this.ctx.currentTime;
    const g = this.duck.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(amount, t + 0.03);
    g.setValueAtTime(amount, t + 0.03 + hold);
    g.linearRampToValueAtTime(1, t + 0.03 + hold + back);
  },

  // 화면 좌표 → 좌우 정위. 방은 960px 한 화면 고정이라 x만으로 충분하다.
  // ★ 이건 연출이 아니라 정보다 — 왼쪽 적이 예고를 걸면 왼쪽에서 들려야 읽을 수 있다
  panOf(x) {
    if (x == null) return 0;
    const w = (typeof Renderer !== 'undefined' && Renderer.W) || 960;
    return Math.max(-0.85, Math.min(0.85, (x / w - 0.5) * 1.7));
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
  },

  // 설정 반영 — 버스 음량 (설정 패널에서 조절할 때마다 호출)
  applyOpts() {
    const o = (typeof Meta !== 'undefined' && Meta.data && Meta.data.opts) || {};
    if (this.sfxBus) this.sfxBus.gain.value = o.sfx ?? 0.8;
    if (this.musicBus) this.musicBus.gain.value = o.bgm ?? 0.8;
  },

  // ── 출력 라우팅 (v174) ──────────────────────────────────────────────
  // 드라이는 정위(pan)를 거쳐 버스로, 웨트는 공유 리버브로 send. 노드는 소리마다
  // 최대 2개(panner + send gain)만 늘어난다 — Convolver는 하나를 공유하므로 비용이 고정이다
  _out(node, { bus = 'sfx', pan = 0, send = 0 } = {}) {
    const dst = (bus === 'music' && this.musicBus) || this.sfxBus || this.master;
    let tail = node;
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      tail = node.connect(p);
    }
    tail.connect(dst);
    // 음악·환경음은 젖은 채로 이미 설계되므로 send는 효과음 위주로 쓴다
    if (send > 0 && this.revBus) {
      const s = this.ctx.createGain();
      s.gain.value = send;
      tail.connect(s).connect(this.revBus);
    }
    return tail;
  },

  // 포락선 — 계측 B: 43개 소리가 **전부** 어택 0ms 즉시최대 지수감쇠였다.
  // 소리 종류가 달라도 '말투'가 같으면 다르게 안 들린다. atk(어택)·hold(유지)를 열어
  // 스웰(활시위 당김)·서스테인(장판 지속)·타격(즉발)을 구분한다
  _env(gain, t, { vol, dur, atk = 0.001, hold = 0 }) {
    const g = gain.gain;
    const a = Math.max(0.0005, Math.min(atk, dur * 0.9));
    g.setValueAtTime(0.0001, t);
    if (atk > 0.02) g.linearRampToValueAtTime(vol, t + a);       // 느린 스웰은 선형이 자연스럽다
    else g.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + a);
    if (hold > 0) g.setValueAtTime(vol, t + a + hold);
    g.exponentialRampToValueAtTime(0.001, t + dur);
  },

  _tone({ type = 'square', f0 = 440, f1 = null, dur = 0.1, vol = 0.4, delay = 0, bus = 'sfx',
          pan = 0, send = 0, atk = 0.001, hold = 0, detune = 0 }) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    if (detune) osc.detune.value = detune;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(f1 ?? f0, 1), t + dur);
    this._env(gain, t, { vol, dur, atk, hold });
    this._out(osc.connect(gain), { bus, pan, send });
    osc.start(t);
    osc.stop(t + dur + 0.05);
  },

  _noise({ dur = 0.08, vol = 0.3, freq = 1200, q = 1, delay = 0, bus = 'sfx',
           pan = 0, send = 0, atk = 0.001, hold = 0, type = 'bandpass', freq1 = null }) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    // 필터 스윕 — 잡음도 움직이면 '쉭'이 '스와악'이 된다 (검격·바람·불꽃)
    if (freq1 && freq1 !== freq) filter.frequency.exponentialRampToValueAtTime(Math.max(freq1, 20), t + dur);
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    this._env(gain, t, { vol, dur, atk, hold });
    this._out(src.connect(filter).connect(gain), { bus, pan, send });
    src.start(t, Math.random() * 0.5, dur + 0.05);
  },

  // 피치 변주 — 같은 효과음이 반복돼도 기계적으로 들리지 않게 ±spread 만큼 흔든다
  _v(f, spread = 0.08) { return f * (1 - spread + Math.random() * spread * 2); },

  // 스로틀 — 광역기가 물량방을 쓸 때 같은 효과음이 한 프레임에 수십 개 겹치면
  // 오디오 노드 폭주로 프레임 히치 + 클리핑이 생긴다. 짧은 창 안 반복 재생을 제한.
  _gates: {},
  _gate(name, windowMs = 45, max = 2) {
    const now = performance.now();
    const g = this._gates[name] || (this._gates[name] = { t: 0, n: 0 });
    if (now - g.t > windowMs) { g.t = now; g.n = 0; }
    return ++g.n <= max;
  },

  // 검격: 콤보 단계(0/1/2)마다 음이 올라가고, 3타(마무리)는 낮은 붕 소리가 겹친다
  // 검격 (v174) — 계측: 전체 호출의 21%. 종전엔 밴드패스 잡음 한 겹 + 3타에만 저음.
  // 이제 **필터가 위에서 아래로 쓸린다**(쉭 → 스와악). 직업마다 휘두르는 물건이 다르다.
  // wep: 'blade'(기사 대검) 'bow'(궁수) 'staff'(마도사) 'flask'(연금술사)
  slash(step = 0, wep = 'blade', x = null) {
    const pan = this.panOf(x), s = this._slot(2);
    const fin = step === 2; // 마무리 3타 — 확실히 커야 한다
    if (wep === 'staff') {  // 지팡이 — 공기를 가르는 게 아니라 공간이 울린다
      const f = this._v([420, 500, 340][step] || 420, 0.08);
      this._tone({ type: 'sine', f0: f, f1: f * 2.2, dur: fin ? 0.22 : 0.15, vol: fin ? 0.26 : 0.17,
        atk: 0.03, pan, send: 0.5 });
      this._tone({ type: 'triangle', f0: f * 1.5, f1: f * 3, dur: 0.12, vol: 0.1, delay: 0.02, pan, send: 0.4 });
      if (fin) this._tone({ type: 'sine', f0: 110, f1: 44, dur: 0.2, vol: 0.3, pan });
      return;
    }
    if (wep === 'flask') {  // 독병 — 유리 부딪는 소리 + 찰랑임
      this._noise({ dur: 0.05, vol: 0.16, freq: this._v(4800, 0.18), q: 3, pan, send: 0.35 });
      this._tone({ type: 'triangle', f0: this._v(1150, 0.1), f1: 700, dur: 0.07, vol: 0.14, pan, send: 0.25 });
      this._noise({ dur: fin ? 0.14 : 0.09, vol: fin ? 0.2 : 0.13, freq: 620, q: 0.5, freq1: 200,
        atk: 0.01, pan, send: 0.2 });
      if (fin) this._tone({ type: 'sine', f0: 130, f1: 48, dur: 0.16, vol: 0.28, pan });
      return;
    }
    if (wep === 'bow') {    // 활 — 시위 긴장(스웰) 후 튕김. 어택이 있어야 '당겼다 놓았다'가 들린다
      this._tone({ type: 'sawtooth', f0: this._v(300, 0.1), f1: 96, dur: 0.07, vol: 0.16, atk: 0.018, pan });
      this._noise({ dur: 0.06, vol: 0.2, freq: this._v(3600, 0.15), q: 1.2, freq1: 1400, pan, send: 0.25 });
      if (fin) this._tone({ type: 'sine', f0: 120, f1: 45, dur: 0.15, vol: 0.28, pan });
      return;
    }
    // 대검 — 무겁게 쓸린다. 슬롯 2개로 뼈대를 바꾼다
    const base = [2300, 2750, 3300][step] || 2400;
    this._noise({ dur: fin ? 0.13 : 0.085, vol: fin ? 0.3 : 0.21, freq: this._v(base, 0.12) * (s ? 1.12 : 0.9),
      q: 0.8, freq1: 600, atk: fin ? 0.012 : 0.004, pan, send: fin ? 0.3 : 0.18 });
    this._noise({ dur: 0.05, vol: 0.09, freq: 6800, q: 1.5, delay: 0.01, pan, send: 0.3 }); // 공기감 (계측 H: 6.4kHz+ 가 3/43뿐)
    if (fin) {
      this._tone({ type: 'sine', f0: 145, f1: 46, dur: 0.17, vol: 0.32, pan });
      this._tone({ type: 'sine', f0: 62, f1: 34, dur: 0.22, vol: 0.26, pan });  // 무게
    }
  },
  // ── 타격음 재질 분기 (v162) ────────────────────────────────────────
  // 종전엔 해골도 골렘도 점액도 망령도 **전부 같은 소리**였다. 손맛의 절반은 귀에서 온다 —
  // 무엇을 때렸는지가 들려야 화면을 안 봐도 상황이 읽히고, 같은 동작이 지루해지지 않는다.
  // 적마다 재질 필드를 다는 대신 스프라이트 이름에서 유도한다 (보스 23종도 자동으로 덮인다).
  _MATRX: [
    [/slime|spore|ooze|acid|toxic|mushroom|mycel|fung|leech|venom|shriek|plague/i, 'ooze'],
    [/skel|bone|necro|ash|quill/i, 'bone'],
    [/golem|crystal|obsidian|lava|magma|turret|warden|mirror|mimic|snail|jorn|obel/i, 'stone'],
    [/wisp|wraith|shade|spirit|void|gazer|rift|ember|cinder|abyss|despair|corvus/i, 'spirit'],
  ],
  _matCache: {},
  mat(sprite) {
    if (!sprite) return 'flesh';
    const c = this._matCache[sprite];
    if (c) return c;
    let m = 'flesh';
    for (const [rx, name] of this._MATRX) if (rx.test(sprite)) { m = name; break; }
    return (this._matCache[sprite] = m);
  },
  // ── 타격 (v174 전면 개편) ───────────────────────────────────────────
  // 계측: 봇 실측에서 `hit`이 전체 효과음 호출의 **24%**, 상위 3종이 63%다.
  // 그런데 변주 폭 중앙값이 반음의 1/3(1.9%)이라 3분이면 귀가 지친다 — 사장 지적 그대로.
  // 처방 셋: ① 변주 슬롯 3개를 돌린다(같은 재질이어도 매번 다른 뼈대) ② 좌우 정위(어디서 때렸나)
  // ③ 리버브 send(공간). 그리고 위아래 대역을 연다 — 계측 H: 84%가 100~1200Hz에 눌려 있었다
  _slot(n) { return Math.floor(Math.random() * n); },

  // 직업 → 휘두르는 물건. 가레스는 대검, 레나는 활, 오르빈은 지팡이, 이졸데는 독병
  wepOf(cls) {
    return { knight: 'blade', archer: 'bow', mage: 'staff', alch: 'flask' }[cls] || 'blade';
  },

  hit(mat = 'flesh', x = null) {
    if (!this._gate('hit', 45, 3)) return;
    const pan = this.panOf(x), s = this._slot(3);
    if (mat === 'bone') {          // 마른 뼈 — 딱/우두둑/쩍. 고역을 연다
      const hi = [3400, 2600, 4200][s];
      this._noise({ dur: 0.035 + s * 0.008, vol: 0.32, freq: this._v(hi, 0.16), q: 1.4 + s * 0.5,
        freq1: hi * 0.45, pan, send: 0.22 });
      this._tone({ type: 'triangle', f0: this._v([560, 470, 640][s], 0.12), f1: 210, dur: 0.055, vol: 0.22, pan });
      if (s === 2) this._noise({ dur: 0.09, vol: 0.1, freq: 7200, q: 0.8, delay: 0.01, pan, send: 0.3 }); // 파편 튐
    } else if (mat === 'stone') {  // 돌·판금 — 저역을 연다. 무게가 귀에 와야 한다
      this._noise({ dur: 0.08, vol: 0.3, freq: this._v([420, 340, 520][s], 0.14), q: 0.5, pan, send: 0.26 });
      this._tone({ f0: this._v([120, 96, 145][s], 0.1), f1: 40, dur: 0.15, vol: 0.42, pan });
      this._tone({ type: 'sine', f0: this._v(58, 0.1), f1: 32, dur: 0.2, vol: 0.3, pan });   // 서브 — 계측 H: 60Hz 이하가 4/43뿐이었다
      if (s !== 1) this._noise({ dur: 0.05, vol: 0.14, freq: 5200, q: 2, pan, send: 0.34 }); // 쇳소리 잔향
    } else if (mat === 'ooze') {   // 점액 — 물컹. 필터가 아래로 미끄러진다
      this._noise({ dur: 0.11, vol: 0.24, freq: this._v([300, 240, 360][s], 0.14), q: 0.4,
        freq1: 90, atk: 0.006, pan, send: 0.14 });
      this._tone({ type: 'sine', f0: this._v([160, 130, 190][s], 0.12), f1: 62, dur: 0.14, vol: 0.3, atk: 0.008, pan });
    } else if (mat === 'spirit') { // 혼 — 타격이 아니라 울림. 가장 젖는다
      const f = this._v([700, 620, 830][s], 0.1);
      this._tone({ type: 'sine', f0: f, f1: f * 0.45, dur: 0.2, vol: 0.24, atk: 0.012, pan, send: 0.6 });
      this._tone({ type: 'sine', f0: f * 1.5, f1: f * 0.7, dur: 0.13, vol: 0.13, delay: 0.02, pan, send: 0.5 });
      this._noise({ dur: 0.05, vol: 0.09, freq: this._v(1500, 0.2), pan, send: 0.45 });
    } else {                       // 살 — 젖은 퍽. 슬롯마다 무게가 다르다
      this._noise({ dur: 0.055 + s * 0.01, vol: 0.38, freq: this._v([900, 700, 1150][s], 0.15), q: 0.7,
        freq1: 320, pan, send: 0.18 });
      this._tone({ f0: this._v([185, 150, 215][s], 0.12), f1: 55, dur: 0.09, vol: 0.34, pan });
      this._tone({ type: 'sine', f0: 70, f1: 38, dur: 0.11, vol: 0.2, pan }); // 무게
    }
  },
  crit(x = null) {
    if (!this._gate('crit')) return;
    const pan = this.panOf(x);
    this._noise({ dur: 0.08, vol: 0.42, freq: this._v(780), freq1: 300, pan, send: 0.3 });
    this._tone({ f0: this._v(160), f1: 42, dur: 0.13, vol: 0.42, pan });                 // 묵직한 저음
    this._tone({ type: 'sine', f0: 74, f1: 34, dur: 0.18, vol: 0.3, pan });              // 서브 — 크리는 배에 와야 한다
    this._tone({ f0: this._v(520), f1: 1150, dur: 0.12, vol: 0.28, delay: 0.02, pan, send: 0.25 }); // 상승 임팩트
    this._tone({ type: 'triangle', f0: this._v(1900), f1: 880, dur: 0.08, vol: 0.14, delay: 0.01, pan, send: 0.35 });
    this._noise({ dur: 0.07, vol: 0.1, freq: 8200, q: 1.2, delay: 0.015, pan, send: 0.4 }); // 공기감
  },
  // 처형 (v174) — 즉사. 크리보다 확실히 커야 하고, 그 순간 음악이 물러난다
  execute(x = null) {
    const pan = this.panOf(x);
    this.ducker(0.3, 0.22, 0.6);
    this._noise({ dur: 0.16, vol: 0.5, freq: 1400, q: 0.5, freq1: 220, pan, send: 0.45 });
    this._tone({ type: 'sine', f0: 96, f1: 26, dur: 0.42, vol: 0.55, pan });
    this._tone({ type: 'sine', f0: 48, f1: 20, dur: 0.5, vol: 0.4, delay: 0.02, pan });
    this._tone({ type: 'triangle', f0: 2400, f1: 600, dur: 0.14, vol: 0.16, pan, send: 0.55 });
  },
  // 막힘 / 빗나감 (v174) — 종전엔 '막힘'만 clank 하나였고 헛손질은 소리가 없었다.
  // v168에서 적 헛손질에 반격의 창을 열었는데, 그게 **들리지 않으면 창이 있는 줄 모른다**
  block(x = null) {
    const pan = this.panOf(x);
    this._noise({ dur: 0.06, vol: 0.3, freq: this._v(3200, 0.12), q: 2.5, pan, send: 0.3 });
    this._tone({ type: 'square', f0: this._v(1300, 0.08), f1: 760, dur: 0.09, vol: 0.24, pan, send: 0.25 });
    this._tone({ type: 'sine', f0: 150, f1: 70, dur: 0.1, vol: 0.2, pan });
  },
  whiff(x = null) {
    if (!this._gate('whiff', 60, 2)) return;
    const pan = this.panOf(x);
    // 빈 공기를 가르는 소리 — 고역만, 저역이 없어야 '허탕'으로 들린다
    this._noise({ dur: 0.13, vol: 0.16, freq: this._v(2600, 0.15), q: 0.6, freq1: 5200,
      atk: 0.02, pan, send: 0.28 });
  },
  hurt()   {
    this.ducker(0.6, 0.06, 0.3); // 맞는 순간 음악이 잠깐 물러난다 — 피격을 확실히 알린다
    this._tone({ type: 'sine', f0: 65, f1: 28, dur: 0.24, vol: 0.65 });                 // 몸에 꽂히는 저음
    this._tone({ type: 'sawtooth', f0: this._v(200), f1: 52, dur: 0.26, vol: 0.48 });
    this._noise({ dur: 0.16, vol: 0.28, freq: 520, freq1: 180, send: 0.2 });
  },
  // 접촉 예고 (v174) — v168이 만든 0.25초의 창을 **귀로도 읽게 한다.**
  // ★ 이 소리는 다른 무엇보다 뚫고 들려야 한다: 1.6~2.2kHz는 다른 소리가 거의 안 쓰는 대역이고
  //   (계측 H: 84%가 100~1200Hz), 상승 스윕이라 '무언가 온다'로 읽힌다. 정위로 방향까지 준다
  telegraph(x = null, elite = false) {
    if (!this._gate('tele', 70, 3)) return;
    const pan = this.panOf(x);
    const f = elite ? 1500 : 1750;
    this._tone({ type: 'triangle', f0: f, f1: f * 1.5, dur: elite ? 0.3 : 0.24, vol: 0.2,
      atk: 0.02, pan, send: 0.15 });
    if (elite) this._tone({ type: 'sine', f0: 92, f1: 128, dur: 0.3, vol: 0.22, atk: 0.05, pan });
  },
  // 처치음: 적 급에 따라 무게가 다르다 (정예는 굵게, 보스는 굉음)
  die(grade = 'small') {
    if (grade === 'small' && !this._gate('die', 60, 2)) return; // 광역 몰살 시 겹침 제한 (정예/보스는 항상)
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
  // 완벽 회피: 상승 사인 + 유리 같은 반짝임 — 시간이 늘어지는 순간의 청각 신호
  pdodge() {
    this._tone({ type: 'sine', f0: 480, f1: 1250, dur: 0.22, vol: 0.32 });
    this._tone({ type: 'triangle', f0: this._v(1900), f1: 2400, dur: 0.12, vol: 0.12, delay: 0.05 });
    this._noise({ dur: 0.1, vol: 0.1, freq: 2600, q: 1.5 });
  },
  pickup() { this._tone({ type: 'sine', f0: 660, dur: 0.08, vol: 0.3 }); this._tone({ type: 'sine', f0: 990, dur: 0.12, vol: 0.3, delay: 0.08 }); },
  thud()   { if (!this._gate('thud', 60, 2)) return; this._tone({ type: 'sine', f0: this._v(95), f1: 35, dur: 0.18, vol: 0.6 }); this._noise({ dur: 0.1, vol: 0.35, freq: 300 }); },
  shoot()  { if (!this._gate('shoot')) return; this._noise({ dur: 0.06, vol: 0.2, freq: this._v(1800), q: 2 }); },
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
  // 스킬 준비 완료 — 은은한 2음 차임 (전투 소음에 묻히지 않되 거슬리지 않게)
  skillReady() {
    this._tone({ type: 'sine', f0: 880, dur: 0.07, vol: 0.1 });
    this._tone({ type: 'sine', f0: 1320, dur: 0.1, vol: 0.1, delay: 0.06 });
  },

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

  // 계측: orb가 전체 호출의 18%인데 매번 사인 한 겹이었다. 5음 음계로 굴려 '줍는 노래'가 되게
  _ORB: [0, 3, 5, 7, 10],
  orb(x = null) {
    const st = this._ORB[this._slot(5)];
    const f = 784 * Math.pow(2, st / 12);
    this._tone({ type: 'sine', f0: f, f1: f * 1.5, dur: 0.07, vol: 0.13, pan: this.panOf(x), send: 0.3 });
    this._tone({ type: 'triangle', f0: f * 2, dur: 0.04, vol: 0.05, delay: 0.01, send: 0.35 });
  },
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

  // 보스 등장 — 위압감: 초저음 낙하 + 불협 클러스터 + 차오르는 노이즈 + 전쟁 나팔
  bossAppear() {
    this._tone({ type: 'sine', f0: 60, f1: 22, dur: 1.3, vol: 0.75 });                       // 바닥이 꺼지는 서브베이스
    this._tone({ type: 'sawtooth', f0: 98, f1: 49, dur: 1.0, vol: 0.3 });                     // 불협 클러스터 (단2도)
    this._tone({ type: 'sawtooth', f0: 104, f1: 52, dur: 1.0, vol: 0.3 });
    for (let i = 0; i < 4; i++) {                                                             // 차오르는 노이즈 스웰
      this._noise({ dur: 0.3, vol: 0.1 + i * 0.06, freq: 300 + i * 500, q: 0.6, delay: i * 0.18 });
    }
    this._tone({ type: 'square', f0: 82, f1: 78, dur: 0.5, vol: 0.28, delay: 0.55 });         // 전쟁 나팔 2연
    this._tone({ type: 'square', f0: 62, f1: 58, dur: 0.9, vol: 0.34, delay: 0.95 });
    this._tone({ type: 'sine', f0: 45, f1: 28, dur: 0.8, vol: 0.5, delay: 1.0 });             // 마지막 쿵
  },

  gameover() {
    [392, 311, 233, 155].forEach((f, i) =>
      this._tone({ type: 'triangle', f0: f, dur: 0.3, vol: 0.3, delay: i * 0.22 }));
  },
};

// ══════════════ 절차 생성 BGM ══════════════
// 층 테마별 코드 진행(루트 노트 열)과 스케일로 베이스+아르페지오+드럼을
// 16분음표 시퀀서로 합성한다. 오디오 파일 0개.
// ══════════════════════════════════════════════════════════════════════════
//  환경음 (v174 신설) — 계측: 이 게임에 공간의 소리가 **0개**였다.
//  BGM과 효과음뿐이라, 아무도 안 때리는 3초 동안 게임이 완전한 무음이 된다.
//  앰비언스는 "여기가 어디인지"를 계속 알려주는 층이다 — 막마다 다른 공기를 깐다.
//
//  구조: ① 지속 베드(노드 재사용 — 막이 바뀔 때만 다시 만든다) ② 간헐 원샷(랜덤 간격)
//  CPU: 베드는 상시 3노드, 원샷은 6~18초에 하나. 전투 동시발음 예산(최대 11겹)을 건드리지 않는다
// ══════════════════════════════════════════════════════════════════════════
const Ambience = {
  act: null,
  hazard: null,
  _nodes: null,
  _timer: null,
  _nextOneShot: 0,

  // 막별 공기. bed = 지속 드론(잡음 필터 + 저역 사인), shots = 간헐 원샷
  _ACTS: {
    1: { // 죄인의 묘지와 변두리 — 텅 빈 석실, 물이 새고 까마귀가 운다
      bed: { freq: 190, q: 0.6, vol: 0.030, drone: 44, droneVol: 0.022 },
      space: 'crypt', gap: [5, 13],
      shots: ['drip', 'crow', 'wind', 'stoneShift'],
    },
    2: { // 다리와 관문 — 아래로 물이 흐르고, 사슬이 삐걱이고, 멀리서 행군한다
      bed: { freq: 320, q: 0.4, vol: 0.034, drone: 52, droneVol: 0.020 },
      space: 'cavern', gap: [6, 14],
      shots: ['water', 'chain', 'wind', 'distantDrum'],
    },
    3: { // 영지와 재판소 — 격식. 종이 울리고 발소리가 대리석에 반사된다
      bed: { freq: 240, q: 0.8, vol: 0.026, drone: 62, droneVol: 0.018 },
      space: 'hall', gap: [7, 16],
      shots: ['bell', 'step', 'stoneShift', 'whisper'],
    },
    4: { // 역병의 마을과 대성당 — 기침, 파리, 뒤틀린 성가
      bed: { freq: 150, q: 0.5, vol: 0.032, drone: 38, droneVol: 0.024 },
      space: 'chapel', gap: [5, 12],
      shots: ['cough', 'fly', 'chant', 'whisper'],
    },
    5: { // 왕도와 왕좌 — 위압. 낮은 심장 같은 울림과 먼 함성
      bed: { freq: 110, q: 0.7, vol: 0.036, drone: 33, droneVol: 0.030 },
      space: 'throne', gap: [6, 14],
      shots: ['heartToll', 'roarFar', 'chain', 'wind'],
    },
    hub: { // 거점 — 조용하다. 바람과 아주 가끔의 물방울뿐
      bed: { freq: 210, q: 0.5, vol: 0.020, drone: 48, droneVol: 0.014 },
      space: 'small', gap: [9, 20],
      shots: ['wind', 'drip'],
    },
  },

  // 층 기믹이 있으면 그 소리를 하나 더 섞는다 — 용암층은 부글거림, 안개층은 습한 숨
  _HAZ: { lava: 'lavaBubble', fog: 'fogBreath', prison: 'chain' },

  ensure(act, hazard) {
    if (!AudioSys.ctx || AudioSys.muted) return;
    if (this.act === act && this.hazard === hazard) return;
    this.act = act; this.hazard = hazard;
    const def = this._ACTS[act] || this._ACTS[1];
    AudioSys.setSpace(def.space);
    this._buildBed(def.bed);
    if (!this._timer) this._timer = setInterval(() => this._tick(), 500);
    this._nextOneShot = performance.now() + 2000;
  },

  stop() {
    this._killBed();
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.act = null; this.hazard = null;
  },

  _killBed() {
    if (!this._nodes) return;
    const { src, gain, drone, dgain } = this._nodes;
    const t = AudioSys.ctx.currentTime;
    try {
      gain.gain.setTargetAtTime(0, t, 0.3); dgain.gain.setTargetAtTime(0, t, 0.3);
      src.stop(t + 1.4); drone.stop(t + 1.4);
    } catch (e) { /* 이미 정지 */ }
    this._nodes = null;
  },

  // 지속 베드 — 루프 잡음을 좁게 필터링한 '공기' + 그 아래 저역 드론.
  // 노드를 매번 만들지 않고 막 전환에만 다시 만든다
  _buildBed(b) {
    this._killBed();
    const ctx = AudioSys.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = AudioSys._noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = b.freq; f.Q.value = b.q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(b.vol, t + 2.5); // 서서히 들어온다 — 뚝 켜지면 티가 난다
    src.connect(f).connect(gain).connect(AudioSys.musicBus);

    const drone = ctx.createOscillator();
    drone.type = 'sine'; drone.frequency.value = b.drone;
    const dgain = ctx.createGain();
    dgain.gain.setValueAtTime(0.0001, t);
    dgain.gain.linearRampToValueAtTime(b.droneVol, t + 3);
    drone.connect(dgain).connect(AudioSys.musicBus);

    src.start(t); drone.start(t);
    this._nodes = { src, gain, drone, dgain };
  },

  _tick() {
    if (!AudioSys.ctx || AudioSys.muted || !this.act) return;
    const now = performance.now();
    if (now < this._nextOneShot) return;
    const def = this._ACTS[this.act] || this._ACTS[1];
    const pool = def.shots.slice();
    const hz = this._HAZ[this.hazard];
    if (hz) pool.push(hz, hz); // 기믹 층은 그 소리가 더 자주
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const fn = this._SHOTS[pick];
    if (fn) fn(AudioSys, (Math.random() * 2 - 1) * 0.7);
    const [lo, hi] = def.gap;
    this._nextOneShot = now + (lo + Math.random() * (hi - lo)) * 1000;
  },

  // 원샷들 — 전부 절차 합성. 잔향으로 보내야 '멀리서' 들린다
  _SHOTS: {
    drip: (A, pan) => {              // 물방울 — 짧고 높은 톡, 길게 젖는다
      const f = 900 + Math.random() * 700;
      A._tone({ type: 'sine', f0: f, f1: f * 0.35, dur: 0.12, vol: 0.10, pan, send: 0.8, bus: 'music' });
    },
    crow: (A, pan) => {              // 까마귀 — 거친 두 음절
      for (let i = 0; i < 2; i++) {
        A._noise({ dur: 0.11, vol: 0.075, freq: 1500 + Math.random() * 500, q: 3.5,
          freq1: 900, delay: i * 0.19, pan, send: 0.6, bus: 'music' });
      }
    },
    wind: (A, pan) => {              // 바람 — 느리게 부풀었다 사라진다 (어택이 길어야 바람이다)
      A._noise({ dur: 3.2, vol: 0.055, freq: 480, q: 0.35, freq1: 240,
        atk: 1.1, pan, send: 0.5, bus: 'music' });
    },
    stoneShift: (A, pan) => {        // 돌이 무너지듯 삐걱
      A._noise({ dur: 0.5, vol: 0.06, freq: 260, q: 0.8, freq1: 90, atk: 0.06, pan, send: 0.7, bus: 'music' });
    },
    water: (A, pan) => {             // 흐르는 물 — 넓은 대역, 길게
      A._noise({ dur: 2.6, vol: 0.05, freq: 1300, q: 0.3, atk: 0.8, pan, send: 0.45, bus: 'music' });
    },
    chain: (A, pan) => {             // 사슬 — 금속 알갱이 여러 개
      for (let i = 0; i < 4; i++) {
        A._noise({ dur: 0.05, vol: 0.045, freq: 3200 + Math.random() * 2200, q: 5,
          delay: i * (0.05 + Math.random() * 0.07), pan, send: 0.7, bus: 'music' });
      }
    },
    distantDrum: (A, pan) => {       // 먼 행군 북
      for (let i = 0; i < 3; i++) {
        A._tone({ type: 'sine', f0: 88, f1: 42, dur: 0.24, vol: 0.075,
          delay: i * 0.42, pan, send: 0.75, bus: 'music' });
      }
    },
    bell: (A, pan) => {              // 종 — 배음 두 겹, 아주 길게 젖는다
      const f = 330 + Math.random() * 60;
      A._tone({ type: 'sine', f0: f, dur: 2.4, vol: 0.075, atk: 0.006, pan, send: 0.9, bus: 'music' });
      A._tone({ type: 'sine', f0: f * 2.76, dur: 1.4, vol: 0.028, atk: 0.004, pan, send: 0.9, bus: 'music' });
    },
    step: (A, pan) => {              // 대리석 발소리 — 두 걸음
      for (let i = 0; i < 2; i++) {
        A._noise({ dur: 0.07, vol: 0.05, freq: 700, q: 1.2, freq1: 260,
          delay: i * 0.34, pan, send: 0.8, bus: 'music' });
      }
    },
    whisper: (A, pan) => {           // 속삭임 — 알아들을 수 없는 사람 소리
      A._noise({ dur: 1.1, vol: 0.04, freq: 1050, q: 4, freq1: 1500, atk: 0.3, pan, send: 0.7, bus: 'music' });
    },
    cough: (A, pan) => {             // 기침 — 역병
      A._noise({ dur: 0.13, vol: 0.07, freq: 620, q: 1.6, freq1: 240, pan, send: 0.6, bus: 'music' });
      A._tone({ type: 'sawtooth', f0: 150, f1: 80, dur: 0.1, vol: 0.035, pan, send: 0.5, bus: 'music' });
    },
    fly: (A, pan) => {               // 파리 — 떨리는 고음이 지나간다
      A._tone({ type: 'sawtooth', f0: 260, f1: 210, dur: 1.5, vol: 0.022, atk: 0.4, pan, send: 0.3, bus: 'music' });
    },
    chant: (A, pan) => {             // 뒤틀린 성가 — 5도 두 음, 아주 느리게
      const f = 146 + Math.random() * 20;
      A._tone({ type: 'sine', f0: f, dur: 3.2, vol: 0.045, atk: 1.2, pan, send: 0.85, bus: 'music' });
      A._tone({ type: 'sine', f0: f * 1.5, dur: 2.8, vol: 0.03, atk: 1.4, delay: 0.4, pan, send: 0.85, bus: 'music' });
    },
    heartToll: (A, pan) => {         // 왕도의 맥박 — 두 번 낮게
      for (let i = 0; i < 2; i++) {
        A._tone({ type: 'sine', f0: 46, f1: 30, dur: 0.5, vol: 0.10, delay: i * 0.34, pan, bus: 'music' });
      }
    },
    roarFar: (A, pan) => {           // 먼 함성 — 군중
      A._noise({ dur: 2.2, vol: 0.05, freq: 420, q: 0.5, freq1: 700, atk: 0.7, pan, send: 0.8, bus: 'music' });
    },
    lavaBubble: (A, pan) => {        // 용암 — 부글
      for (let i = 0; i < 3; i++) {
        const f = 90 + Math.random() * 70;
        A._tone({ type: 'sine', f0: f, f1: f * 1.9, dur: 0.16, vol: 0.05,
          delay: i * (0.1 + Math.random() * 0.2), pan, send: 0.4, bus: 'music' });
      }
    },
    fogBreath: (A, pan) => {         // 안개 — 습한 숨
      A._noise({ dur: 2.0, vol: 0.045, freq: 340, q: 0.5, freq1: 180, atk: 0.8, pan, send: 0.6, bus: 'music' });
    },
  },
};

const Music = {
  themes: {
    hub:  { bpm: 66,  roots: [45, 41, 43, 45], scale: [0, 3, 7, 10], drums: false, calm: true },
    // 1~5층: 층 배경에 맞춘 고유 진행
    f1:   { bpm: 92,  roots: [38, 38, 41, 36], scale: [0, 3, 5, 7],  drums: false },            // 지하 묘지: 느린 단조
    f2:   { bpm: 86,  roots: [40, 40, 43, 45], scale: [0, 2, 3, 7],  drums: false },            // 곰팡이 동굴: 눅눅한 도리안
    f3:   { bpm: 102, roots: [36, 36, 39, 41], scale: [0, 1, 5, 7],  drums: true },             // 잊힌 감옥: 반음 긴장
    f4:   { bpm: 118, roots: [38, 38, 36, 34], scale: [0, 3, 6, 7],  drums: true },             // 용암 심층: 빠르고 뜨겁게
    f5:   { bpm: 82,  roots: [33, 33, 36, 32], scale: [0, 1, 3, 7],  drums: true },             // 심연의 옥좌: 낮고 무겁게
    // 6~10층 (각성 심층): 같은 배경의 어두운 변주 — 더 낮고, 더 빠르고, 더 불협하게
    f6:   { bpm: 100, roots: [36, 36, 39, 34], scale: [0, 3, 5, 6],  drums: true,  pad: true }, // 피의 묘지: 삼온음 그림자
    f7:   { bpm: 94,  roots: [38, 38, 41, 43], scale: [0, 1, 3, 7],  drums: true,  pad: true }, // 맹독 심연: 프리지안 독기
    f8:   { bpm: 110, roots: [34, 34, 37, 39], scale: [0, 1, 4, 7],  drums: true,  pad: true }, // 절망의 감옥: b9의 불안
    f9:   { bpm: 126, roots: [36, 36, 34, 32], scale: [0, 3, 6, 10], drums: true,  pad: true }, // 겁화의 핵: 질주하는 화염
    f10:  { bpm: 76,  roots: [31, 31, 34, 30], scale: [0, 1, 6, 7],  drums: true,  pad: true }, // 심연의 왕좌: 가장 낮은 어둠
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
      AudioSys._tone({ type: 'sawtooth', f0: this._freq(root), dur: 0.28, vol: th.calm ? 0.055 : 0.075, delay, bus: 'music' });
      AudioSys._tone({ type: 'sine', f0: this._freq(root - 12), dur: 0.3, vol: 0.06, delay, bus: 'music' });
    }
    // 아르페지오 (8분음표, 스케일 순환)
    if (s % 2 === 0) {
      const deg = th.scale[(this.step / 2) % th.scale.length | 0];
      const octave = (Math.floor(this.step / 8) % 2) * 12;
      AudioSys._tone({
        type: 'triangle',
        f0: this._freq(root + 12 + deg + octave),
        dur: 0.14, vol: th.calm ? 0.035 : 0.042, delay, bus: 'music',
      });
    }
    // 패드 (심층 전용): 마디마다 낮게 깔리는 5도 지속음 — 공간의 위압감
    if (th.pad && s === 0) {
      AudioSys._tone({ type: 'sine', f0: this._freq(root + 7), dur: 1.4, vol: 0.035, delay, bus: 'music' });
      AudioSys._tone({ type: 'sine', f0: this._freq(root - 5), dur: 1.4, vol: 0.03, delay, bus: 'music' });
    }
    // 드럼 (긴장감 있는 층/보스)
    if (th.drums) {
      if (s % 4 === 0) {
        AudioSys._tone({ type: 'sine', f0: 105, f1: 38, dur: 0.1, vol: 0.16, delay, bus: 'music' });
      }
      if (s % 4 === 2) {
        AudioSys._noise({ dur: 0.03, vol: 0.05, freq: 6000, q: 1, delay, bus: 'music' });
      }
    }
  },
};
