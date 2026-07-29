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
      // ── 동적 음악 인서트 (v176) ───────────────────────────────────────
      // ★ 로우패스와 레벨을 **여기서** 만든다. 나중에 musicBus.disconnect() 후 다시 이으면
      //   남이 끼운 인서트가 통째로 끊긴다 — 런타임 재배선은 금지다 (사양서 C4).
      //   음악 담당(Music._initChain)은 이 두 노드의 **참조만** 잡는다
      this.musicLP = this.ctx.createBiquadFilter();
      this.musicLP.type = 'lowpass';
      this.musicLP.frequency.value = 16000;   // 위기에서 Music._applyChain이 내린다
      this.musicLP.Q.value = 0.4;
      this.musicLvl = this.ctx.createGain();
      this.musicLvl.gain.value = 0.85;        // 격전에서 Music._applyChain이 올린다
      this.musicBus.connect(this.musicLP).connect(this.musicLvl).connect(this.duck).connect(this.master);
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

      // 음악 계열 send 입구 (v176) — bgm 슬라이더를 **미러**한다.
      // send 탭은 버스 게인보다 앞에서 갈라지므로, 여기에 같은 볼륨을 안 먹이면
      // bgm을 0으로 내려도 음악의 잔향만 남는다 (실측 -17.4dBFS 누설)
      this.revMusIn = this.ctx.createGain();
      this.revMusIn.connect(this.revBus);
      // 별칭 — 레이어마다 리버브를 다른 이름으로 찾는다. 세 이름을 다 살려 둔다 (사양서 C11)
      this.musicFx = this.musicBus;
      this.reverbIn = this.revMusIn;
      this.revSend = this.revBus;

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
    // 음악 잔향 send도 같은 슬라이더를 따라간다 (안 그러면 bgm 0에서 잔향만 남는다)
    if (this.revMusIn) this.revMusIn.gain.value = o.bgm ?? 0.8;
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

// ══════════════ 절차 생성 BGM (v176 — 막별 확장 + 동적 레이어) ══════════════
// 층 테마별 코드 진행(루트 노트 열)과 스케일로 베이스+아르페지오+패드+드럼을
// 16분음표 시퀀서로 합성한다. 오디오 파일 0개.
//
// v176에서 바뀐 것 (계측 진단서의 세 가지 병을 정면으로 친다):
//   ① **편성이 데이터로 빠졌다.** 종전엔 테마가 바꿀 수 있는 게 bpm·roots·scale 셋뿐이라
//      킥(sine 105→38Hz)·하이햇(noise 6000Hz)이 보스곡까지 12곡 전부 같은 음원이었다 —
//      그래서 "12곡이 사실상 1곡"이었다. 이제 음색 프로파일 6종(MV_VOICES) + 베이스 패턴 5종 +
//      아르페지오 방향·간격·음역 + 코드 보이싱·디튠 + 타악기 편성 6종 + 필인·스윙·막 모티프를
//      테마가 고른다.
//   ② **11~50층의 f6~f10 5곡 순환을 막별 3변주 × 4막 + 무한 2 = 신규 14곡으로 늘렸다.**
//      확장 필드의 **기본값이 곧 v175 동작**이라 기존 12개 테마 객체는 한 글자도 안 바꿨다.
//   ③ **덱 크로스페이드 + 동적 레이어.** 전환이 stop()→start()로 뚝 끊기던 것을 마디 경계
//      등파워 크로스페이드로 바꾸고(노드 증가 0 — 스칼라 게인), 전투 강도 0~3 · 위기 0~1 ·
//      보스 페이즈 0~3에 따라 레이어를 켜고 끈다. 곡을 갈아치우지 않고 **곡이 반응한다.**
//
// CPU: 모든 레이어가 MV_BUDGET(46) 예산 게이트 `_afford(prio, t)`를 통과한다.
//      dynamic이 더한 레이어(drive/snare/tension/fill/heart)도 예외 없이 통과한다 —
//      이게 빠지면 노드 생성률이 87/초에서 104/초로 샌다.
const Music = {
  // ── 음색 프로파일 ──────────────────────────────────────────────
  // 막마다 '악기'가 다르다. 같은 음을 쳐도 다른 몸으로 울린다.
  MV_VOICES: {
    // 1막 묘지 — 흙과 마른 뼈. **종전 f1~f10의 음원을 그대로** 재현한다 (어택 declick만 추가).
    crypt: {
      bass: { type: 'sawtooth', atk: 0.004, dur: 0.28, vol: 0.075 },
      sub:  { type: 'sine',     atk: 0.006, dur: 0.30, vol: 0.060 },
      arp:  { type: 'triangle', atk: 0.004, dur: 0.14, vol: 0.042 },
      pad:  { type: 'sine',     atk: 0.020, dur: 1.40, vol: 0.035, hold: 0 },
      lead: { type: 'triangle', atk: 0.010, dur: 0.26, vol: 0.038 },
      kick: { f0: 105, f1: 38, dur: 0.10, vol: 0.160 },
      tick: { freq: 6000, q: 1, dur: 0.030, vol: 0.050 },
      orn:  { freq: 9000, q: 4, dur: 0.030, vol: 0.020 },
      bell: { f: 124, dur: 2.4, sub: 83 },   // 금 간 묘지의 종
    },
    // 2막 다리와 관문 — 젖은 돌, 강물. 어택이 물러 있고(20~40ms) 꼬리가 길다.
    wet: {
      bass: { type: 'triangle', atk: 0.030, dur: 0.34, vol: 0.070 },
      sub:  { type: 'sine',     atk: 0.040, dur: 0.42, vol: 0.062 },
      arp:  { type: 'sine',     atk: 0.020, dur: 0.30, vol: 0.038 },
      pad:  { type: 'triangle', atk: 0.400, dur: 1.80, vol: 0.032, hold: 0.35 },
      lead: { type: 'sine',     atk: 0.040, dur: 0.40, vol: 0.034 },
      kick: { f0: 98,  f1: 34, dur: 0.120, vol: 0.150 },
      tick: { freq: 7400, q: 2, dur: 0.030, vol: 0.052 },
      // 물방울은 하강 사인 + 수면이 튀는 고역 틱. 틱이 없으면 '물'이 아니라 '삐' 소리가 된다.
      orn:  { tone: 1, type: 'sine', f0: 2600, f1: 1150, dur: 0.12, vol: 0.030, atk: 0.002, hf: 8600, hv: 0.020 },
    },
    // 3막 영지와 재판소 — 대리석과 나무. 어택이 딱딱하고(2ms) 배음이 얇다.
    court: {
      bass: { type: 'square',   atk: 0.002, dur: 0.24, vol: 0.062 },
      sub:  { type: 'sine',     atk: 0.004, dur: 0.30, vol: 0.058 },
      arp:  { type: 'square',   atk: 0.002, dur: 0.10, vol: 0.026 },
      pad:  { type: 'sine',     atk: 0.150, dur: 1.90, vol: 0.030, hold: 0.30 },
      lead: { type: 'square',   atk: 0.003, dur: 0.30, vol: 0.030 },
      kick: { f0: 88,  f1: 34, dur: 0.160, vol: 0.150 },
      tick: { freq: 8400, q: 3, dur: 0.025, vol: 0.044 },
      orn:  { freq: 9600, q: 6, dur: 0.040, vol: 0.030 },
    },
    // 4막 역병과 대성당 — 성가가 썩는다. 톱니 패드에 디튠을 크게 건다.
    plague: {
      bass: { type: 'sawtooth', atk: 0.012, dur: 0.32, vol: 0.072 },
      sub:  { type: 'sine',     atk: 0.020, dur: 0.40, vol: 0.064 },
      arp:  { type: 'triangle', atk: 0.008, dur: 0.20, vol: 0.034 },
      pad:  { type: 'sawtooth', atk: 0.550, dur: 2.40, vol: 0.026, hold: 0.45 },
      lead: { type: 'triangle', atk: 0.060, dur: 0.55, vol: 0.034 },
      kick: { f0: 96,  f1: 30, dur: 0.150, vol: 0.160 },
      tick: { freq: 7600, q: 5, dur: 0.035, vol: 0.034 },
      orn:  { freq: 8800, q: 3, dur: 0.050, vol: 0.034 },
      bell: { f: 148, dur: 3.0, sub: 99 },   // 대성당의 종 — 높고 밝고 길게 남는다
    },
    // 5막 왕도 — 금관과 돌. 톱니, 어택이 짧고 몸통이 두껍다.
    crown: {
      bass: { type: 'sawtooth', atk: 0.006, dur: 0.30, vol: 0.082 },
      sub:  { type: 'sine',     atk: 0.008, dur: 0.36, vol: 0.070 },
      arp:  { type: 'sawtooth', atk: 0.006, dur: 0.16, vol: 0.028 },
      pad:  { type: 'sawtooth', atk: 0.300, dur: 2.20, vol: 0.028, hold: 0.40 },
      lead: { type: 'sawtooth', atk: 0.020, dur: 0.45, vol: 0.042 },
      kick: { f0: 112, f1: 32, dur: 0.140, vol: 0.180 },
      tick: { freq: 10200, q: 1.2, dur: 0.022, vol: 0.040 },
      orn:  { tone: 1, type: 'triangle', f0: 3600, dur: 0.09, vol: 0.022, atk: 0.004, hf: 11000, hv: 0.024 },
      bell: { f: 92, dur: 2.6, sub: 62 },    // 왕도의 대종 — 낮고 무겁다. 대성당 종보다 단6도 아래
    },
    // 무한 모드 '무너진 왕국' — 위의 재료가 부서진 것. 전부 조금씩 어긋나 있다.
    ruin: {
      bass: { type: 'sawtooth', atk: 0.004, dur: 0.26, vol: 0.080 },
      sub:  { type: 'square',   atk: 0.006, dur: 0.34, vol: 0.060 },
      arp:  { type: 'sawtooth', atk: 0.004, dur: 0.12, vol: 0.030 },
      pad:  { type: 'sawtooth', atk: 0.250, dur: 2.00, vol: 0.030, hold: 0.35 },
      lead: { type: 'square',   atk: 0.010, dur: 0.35, vol: 0.038 },
      kick: { f0: 120, f1: 28, dur: 0.130, vol: 0.190 },
      tick: { freq: 9400, q: 1.5, dur: 0.020, vol: 0.036 },
      orn:  { freq: 900, q: 0.7, dur: 0.180, vol: 0.032, hf: 7800, hv: 0.022 },
    },
  },

  themes: {
    // ── 기존 12곡: v175에서 한 글자도 바꾸지 않았다 ──────────────
    // 확장 필드의 기본값(voice:'crypt' / bassPat:'root' / arpEvery:2 / arpDir:1 /
    // arpOct:1 / chord:[7,-5] / drumPat: drums?'bone':'none' / fx:0)이 곧 종전 동작이다.
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

    // ── 2막 다리와 관문 (11~20층) ────────────────────────────────
    // 도리안(b3 + 장6도) — 습하지만 결의가 있다. 물은 마디를 가로지르고(3스텝 아르페지오),
    // 관문에 닿으면 행군이 시작된다. 진행은 3변주가 공유한다: i - iv - III (강이 흘러 내려간다).
    a2a: { bpm: 84,  roots: [38, 38, 43, 41], scale: [0, 2, 3, 7, 10], pad: true,
           voice: 'wet', bassPat: 'ped', arpEvery: 3, arpDir: -1, arpOct: 0,
           chord: [7, 14], det: 6, drumPat: 'none', orn: 0.40, gain: 0.95, fx: 0.22 },
    a2b: { bpm: 96,  roots: [38, 38, 36, 41], scale: [0, 2, 3, 7], pad: true,
           voice: 'wet', bassPat: 'ost', arpEvery: 4, arpDir: 1, arpOct: 1,
           chord: [7, 12], det: 4, drumPat: 'march', fill: 0.40, orn: 0.20, fx: 0.22 },
    a2c: { bpm: 104, roots: [36, 36, 34, 39], scale: [0, 2, 3, 6], pad: true,
           voice: 'wet', bassPat: 'ost', arpEvery: 3, arpDir: 0, arpOct: 1,
           chord: [6, 7], det: 10, drumPat: 'war', fill: 0.60, orn: 0.20, gain: 1.02, fx: 0.22 },

    // ── 3막 영지와 재판소 (21~30층) ──────────────────────────────
    // 격식과 차가운 대칭. 3도가 없는 오르가눔 보이싱(완전5도+옥타브),
    // 아르페지오는 상행한 만큼 정확히 역행한다(팰린드롬). 판결봉이 2·4박을 정확히 친다.
    // 세 변주 모두 A(33)를 중심음으로 고정하고 장7도(11)를 공유한다 — 그게 '격식'의 소리다.
    // 움직이는 건 보조 루트(36→32→30, 반음씩 내려온다 = 판결이 다가온다)와 편성뿐이다.
    a3a: { bpm: 100, roots: [33, 33, 36, 32], scale: [0, 3, 7, 11],
           voice: 'court', bassPat: 'walk', arpEvery: 4, arpDir: 1, arpSpan: 4, arpOct: 1,
           chord: [7, 12], drumPat: 'march', fill: 0.35, orn: 0.15, fx: 0.14 },
    a3b: { bpm: 88,  roots: [33, 33, 32, 33], scale: [0, 3, 7, 11], pad: true,
           voice: 'court', bassPat: 'ped', arpEvery: 2, arpDir: 0, arpOct: 0,
           chord: [7, 12, 19], drumPat: 'gavel', fill: 0.20, orn: 0.25, fx: 0.14 },
    a3c: { bpm: 76,  roots: [33, 33, 32, 30], scale: [0, 1, 7, 11], pad: true,
           voice: 'court', bassPat: 'toll', arpEvery: 4, arpDir: 0, arpOct: 0,
           chord: [7, 11, 12], drumPat: 'gavel', fill: 0.25, orn: 0.30, gain: 1.05, fx: 0.14,
           lead: { every: 64, at: [0, 8, 16], deg: [11, 7, 0], oct: 0, prob: 0.8 } },

    // ── 4막 역병의 마을과 대성당 (31~40층) ───────────────────────
    // 절뚝이는 걸음(swing 0.18)에서 시작해 불(소각장)을 지나 성가로 끝난다.
    // a4c는 게임에서 유일한 **장조**(장3도+장7도)다 — 그런데 패드가 18센트 어긋나 있다.
    // 아름다운데 속이 뒤틀린 소리. 그게 이 막의 정체다.
    a4a: { bpm: 72,  roots: [34, 34, 33, 34], scale: [0, 1, 3, 6], pad: true,
           voice: 'plague', bassPat: 'ost', arpEvery: 4, arpDir: -1, arpOct: 0,
           chord: [3, 7], det: 12, drumPat: 'rot', swing: 0.18, orn: 0.30, gain: 0.98, fx: 0.30 },
    a4b: { bpm: 116, roots: [36, 36, 39, 34], scale: [0, 3, 6, 10], pad: true,
           voice: 'plague', bassPat: 'ost', arpEvery: 2, arpDir: 1, arpOct: 1,
           chord: [6, 10], det: 8, drumPat: 'war', fill: 0.55, orn: 0.40, gain: 1.05, fx: 0.30 },
    a4c: { bpm: 60,  roots: [32, 32, 31, 36], scale: [0, 4, 7, 11], pad: true,
           voice: 'plague', bassPat: 'toll', arpEvery: 4, arpDir: 1, arpOct: 0,
           chord: [4, 7, 11, 16], det: 18, drumPat: 'toll', fill: 0.15, orn: 0.20, fx: 0.30,
           lead: { every: 64, at: [0, 12, 24, 40], deg: [0, 4, 7, 4], oct: 0, prob: 1 } },

    // ── 5막 왕도 (41~50층) ───────────────────────────────────────
    // 프리지안 도미넌트(b2 + 장3도) — 왕의 위압. a5b에서 왕의 팡파레 [0,4,7]이 처음 나오고,
    // a5c(49~50층)에서 그 팡파레가 [0,1,7]로 썩는다. 같은 훅의 장송 변주다.
    // a5c의 루트 28은 게임 전체에서 가장 낮다 (종전 최저 f10=31보다 3반음 아래).
    a5a: { bpm: 92,  roots: [40, 40, 38, 36], scale: [0, 1, 4, 7], pad: true,
           voice: 'crown', bassPat: 'walk', arpEvery: 4, arpDir: 1, arpOct: 1,
           chord: [7, 12], det: 4, drumPat: 'march', fill: 0.30, orn: 0.15, fx: 0.18 },
    a5b: { bpm: 108, roots: [36, 36, 35, 40], scale: [0, 1, 4, 8], pad: true,
           voice: 'crown', bassPat: 'ost', arpEvery: 2, arpDir: 1, arpOct: 1,
           chord: [7, 12], det: 6, drumPat: 'war', fill: 0.50, orn: 0.20, gain: 1.05, fx: 0.18,
           lead: { every: 32, at: [0, 3, 6], deg: [0, 4, 7], oct: 1, prob: 0.75 } },
    a5c: { bpm: 54,  roots: [28, 28, 27, 28], scale: [0, 1, 6, 7], pad: true,
           voice: 'crown', bassPat: 'toll', arpEvery: 6, arpDir: 0, arpOct: 0,
           chord: [6, 7, 12], det: 20, drumPat: 'toll', fill: 0.25, orn: 0.15, gain: 1.10, fx: 0.18,
           lead: { every: 64, at: [0, 10, 22], deg: [0, 1, 7], oct: 1, prob: 0.9 } },

    // ── 무한 모드 '무너진 왕국' (51층+) ──────────────────────────
    // 루트가 반음씩 미끄러진다 — 조성이 무너지는 소리.
    // a6a는 4막의 젖은 북(rot)과 절뚝이는 스윙을 5막의 낮은 루트 위에 얹는다 —
    // 서사 그대로다. 왕이 만든 역병이 결국 왕도까지 삼켰다. a6b는 끝나지 않는 전쟁.
    a6a: { bpm: 84,  roots: [28, 29, 27, 26], scale: [0, 1, 6, 11], pad: true,
           voice: 'ruin', bassPat: 'ost', arpEvery: 6, arpDir: 0, arpOct: 1,
           chord: [1, 6, 7], det: 22, drumPat: 'rot', swing: 0.12, fill: 0.35, orn: 0.35, gain: 1.05, fx: 0.26 },
    a6b: { bpm: 128, roots: [26, 26, 25, 31], scale: [0, 1, 5, 6], pad: true,
           voice: 'ruin', bassPat: 'walk', arpEvery: 2, arpDir: -1, arpOct: 1,
           chord: [1, 7, 11], det: 16, drumPat: 'war', fill: 0.80, orn: 0.20, gain: 1.05, fx: 0.26,
           lead: { every: 64, at: [0, 6, 13, 27], deg: [0, 1, 6, 11], oct: 1, prob: 0.5 } },
  },

  // ── 상태 ────────────────────────────────────────────────────────
  current: null,
  pending: null,
  step: 0,
  nextT: 0,
  _timer: null,

  iTarget: 0, iCur: 0,          // 전투 강도 0 탐색 / 1 접촉 / 2 격전 / 3 절정
  perilTarget: 0, perilCur: 0,  // 위기 0~1 (내 HP)
  bossPhase: 0, bpCur: 0,       // 0 = 보스 없음, 1/2/3 = 페이즈

  _decks: [],       // 동시 최대 3. 마지막 원소가 '프런트'(가장 새 곡)
  _layG: {},        // 레이어별 게인 (매 틱 갱신)
  _deckG: 1,        // 지금 스케줄 중인 덱의 크로스페이드 스칼라
  _deckTail: false, // 나가는 덱이면 지속 레이어만
  _chain: null,     // { lp, lvl } — unlock()이 만든 정적 노드의 **참조만** 잡는다
  _pv: {},          // AudioParam 중복 예약 방지용 캐시
  _brCur: 0,        // 클리어 여운 (1 → 0)
  _brDur: 4.5,
  _slamT: 0,        // 보스 페이즈 전환 잔압 (초)
  _slamAt: 0,
  _hbNextT: 0,      // 심장박동 자체 시계 (음악 박자와 일부러 어긋난다)
  _hbN: 0,
  _lastMs: 0,
  _bossHook: null,  // 보스곡 담당이 꽂는 자리 (BossAudio는 _schedule 맨 앞 가드를 쓴다)

  FADE: { soft: 1.6, hard: 0.7 },

  _freq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); },
  _ramp(x, a, b) { const v = (x - a) / (b - a); return v < 0 ? 0 : v > 1 ? 1 : v; },

  // ── 층 → 테마 키 ────────────────────────────────────────────────
  // 종전: ((floor-11)%5)+6 — 11~50층 40개 층이 f6~f10 5곡 순환.
  // 이제: 1막은 층별 고유 10곡(그대로), 2~5막은 막당 3변주, 51층+는 무한 2변주.
  MV_ACTCUT: {
    2: [4, 7],   // 11~14 강둑·수문 / 15~17 관문·성벽 / 18~20 오물길·사령부
    3: [4, 8],   // 21~24 영지·주둔지 / 25~28 재판소·고문실 / 29~30 성관·판결의 홀
    4: [4, 6],   // 31~34 봉쇄 마을 / 35~36 소각장·재의 뜰 / 37~40 대성당·납골당
    5: [4, 8],   // 41~44 뒷골목·처형대로 / 45~48 근위·왕성 / 49~50 성배·왕좌
  },
  floorKey(floor) {
    const f = Math.max(1, floor | 0);
    if (f <= 10) return 'f' + f;                                  // 1막: 종전 층별 고유 10곡
    if (f > 50) return 'a6' + (Math.floor((f - 51) / 5) % 2 ? 'b' : 'a'); // 무한: 5층마다 교대
    const act = Math.ceil(f / 10);
    const d = (f - 1) % 10;                                       // 막 안에서의 깊이 0~9
    const cut = this.MV_ACTCUT[act] || [4, 8];
    return 'a' + act + (d < cut[0] ? 'a' : d < cut[1] ? 'b' : 'c');
  },

  // 보스 테마 — BossAudio가 킷(막)과 왕 3페이즈를 판정한다. 없으면 구 'boss' 한 곡으로 떨어진다
  bossKey(boss) {
    if (typeof BossAudio !== 'undefined' && BossAudio.musicKey) return BossAudio.musicKey(boss);
    return 'boss';
  },

  // ── 외부 API (동적 음악) ────────────────────────────────────────
  setIntensity(n) { this.iTarget = n > 3 ? 3 : n > 0 ? n : 0; },
  setPeril(v)     { this.perilTarget = v > 1 ? 1 : v > 0 ? v : 0; },
  setBossPhase(n) {
    n = n > 3 ? 3 : n > 0 ? n : 0;
    // 페이즈가 **올라가는 순간**은 곡 교체가 아니라 하나의 사건이다 (아래 _phaseShift)
    if (n > this.bossPhase && this.bossPhase > 0 && AudioSys.ctx &&
        (!this._slamAt || AudioSys.ctx.currentTime - this._slamAt > 3)) this._phaseShift(n);
    this.bossPhase = n;
  },
  pulse(o) {
    if (!o) return;
    this.setIntensity(o.intensity || 0);
    this.setPeril(o.peril || 0);
    this.setBossPhase(o.bossPhase || 0);
  },

  // 페이즈 전환 — 곡을 갈아치우지 않고 **숨을 들이켰다 내리친다.**
  // 0.42초 동안 위가 빨려 올라가며 아르페지오·하이햇이 빨려 들어가고, 그 끝에서 저역이 내리꽂힌다.
  _phaseShift(n) {
    if (!AudioSys.ctx || AudioSys.muted) return;
    this._slamAt = AudioSys.ctx.currentTime;
    this._slamT = 1.1;
    const rise = 0.42;
    // 리버스 스웰 — 어택을 길게 줘서 '빨려 올라간다'
    AudioSys._tone({ type: 'sawtooth', f0: 120, f1: 900, dur: rise, vol: 0.055, atk: rise * 0.85, bus: 'music' });
    AudioSys._noise({ dur: rise, vol: 0.050, freq: 700, freq1: 6400, q: 0.7, atk: rise * 0.90, bus: 'music' });
    // 내리꽂힘
    AudioSys._tone({ type: 'sine', f0: 88, f1: 24, dur: 0.70, vol: 0.30, delay: rise, bus: 'music' });
    AudioSys._tone({ type: 'sine', f0: 44, f1: 20, dur: 0.90, vol: 0.22, delay: rise + 0.02, bus: 'music' });
    if (n >= 3) AudioSys._tone({ type: 'sawtooth', f0: 62, f1: 58, dur: 0.8, vol: 0.10, delay: rise + 0.05, bus: 'music' });
  },

  // 방을 다 치웠을 때 — 두드림을 멈추고 숨을 쉰다.
  // 계속 두드리면 3분이면 귀가 지친다. 정적은 '소리가 없는 것'이 아니라 '남는 것'이다
  clearBreath(sec = 4.5) {
    this.iTarget = 0;
    if (this.iCur > 0.4) this.iCur = 0.4;   // 드럼을 즉시 걷는다
    this._brDur = Math.max(0.5, sec);
    this._brCur = 1;
    const d = this._front();
    if (!d || !AudioSys.ctx || AudioSys.muted) return;
    const root = d.th.roots[0];
    AudioSys._tone({ type: 'sine',     f0: this._freq(root - 12), dur: 3.2, vol: 0.050, atk: 0.50, bus: 'music' });
    AudioSys._tone({ type: 'sine',     f0: this._freq(root + 7),  dur: 2.6, vol: 0.034, atk: 0.80, bus: 'music' });
    AudioSys._tone({ type: 'triangle', f0: this._freq(root + 19), dur: 2.0, vol: 0.020, atk: 1.10, delay: 0.25, bus: 'music' });
  },

  // ── 곡 전환 ─────────────────────────────────────────────────────
  // 원하는 테마를 선언 — 이미 재생 중이면 무시, 다르면 **크로스페이드** (null이면 페이드아웃)
  ensure(key) {
    if (!AudioSys.ctx) { this.pending = key; return; }
    this._initChain();
    if (key === this.current) return;
    if (key && !this.themes[key]) return;      // 없는 키는 무시 (현재 곡 유지)
    this.current = key;
    this.pending = null;
    if (!key) { this._fadeAll(this.FADE.hard); return; }
    const front = this._front();
    if (!front) { this.start(key); return; }
    // 극적 전환(보스 진입·이탈·거점 귀환)은 마디를 기다리지 않는다.
    // 같은 계열 안(막 변주끼리 / 왕 페이즈끼리)이면 마디 경계에서 부드럽게 갈아탄다
    const nk = this.themes[key], fk = front.th;
    const hard = key === 'hub' || front.key === 'hub' ||
      !!(nk && nk.bossKit) !== !!(fk && fk.bossKit) ||
      key === 'boss' || front.key === 'boss';
    this._crossTo(key, hard);
  },

  _actOf(key) {
    if (!key) return '';
    if (key === 'hub') return 'hub';
    if (key[0] === 'f') return '1';
    const m = /^a(\d)/.exec(key);
    if (m) return m[1];
    if (/^bossKing/.test(key)) return 'king';
    const b = /^bossA(\d)/.exec(key);
    return b ? 'b' + b[1] : key;
  },

  // 무음에서 시작 (AudioSys.unlock()이 호출한다 — 시그니처 유지)
  start(key) {
    if (!AudioSys.ctx || !this.themes[key]) { this.pending = key; return; }
    this._initChain();
    this.current = key;
    this.pending = null;
    this._decks.length = 0;
    const d = this._mkDeck(key, AudioSys.ctx.currentTime + 0.06, 0.9);
    this._decks.push(d);
    this.step = 0;
    this.nextT = d.nextT;
    this._run();
  },

  // 정지 — 종전엔 즉시 끊겼다. 이제 페이드아웃하고, 소리가 다 빠지면 타이머가 스스로 선다.
  // ★ 여기에 BossAudio.releaseChains()를 넣으면 안 된다 — 페이드 도중 드론만 뚝 끊긴다.
  //   자원 해제는 덱이 죽는 시점(_tick)이 맞다 (사양서 C10 / §11-5)
  stop() {
    this.current = null;
    this._fadeAll(this.FADE.hard);
  },

  // 즉시 정지 (디버그·페이지 종료용). 일반 흐름에서는 쓰지 마라 — 뚝 끊긴다
  hardStop() {
    this.current = null;
    this._decks.length = 0;
    this._brCur = 0;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this._lastMs = 0;
    if (typeof BossAudio !== 'undefined') BossAudio.releaseChains();
  },

  // ── 내부: 덱 ────────────────────────────────────────────────────
  _front() { return this._decks.length ? this._decks[this._decks.length - 1] : null; },

  _mkDeck(key, t0, fadeIn) {
    return {
      key, th: this.themes[key],
      step: 0, nextT: t0,
      g: 0, gTo: 1,                       // 크로스페이드 스칼라 (노드가 아니라 vol에 곱한다)
      rate: fadeIn > 0 ? 1 / fadeIn : 99,
      fadeAt: null,                       // 이 시각부터 게인이 움직인다 (마디 경계)
      tail: false,                        // true면 지속 레이어(베이스·서브·패드)만
      bpmMul: 1,
      dead: false,
    };
  },

  _stepDur(d) { return 60 / (d.th.bpm * d.bpmMul) / 4; },

  // 위기·격전에서 템포가 아주 조금 오른다. 마디 경계에서만 바꾼다 — 안 그러면 흔들려서 취한다
  _bpmMul() {
    const f = this._front();
    if (f && f.th && f.th.bossKit) return 1;   // 보스 시퀀서가 제 템포·단계를 직접 관리한다
    return 1 + 0.035 * this._ramp(this.iCur, 1.6, 3) + 0.05 * this.perilCur;
  },

  // 스케줄 시각 t에서의 덱 페이드 '위치'(0~1) — 룩어헤드(최대 0.18초)만큼 앞질러 선형 보간
  _gAt(d, t) {
    if (d.fadeAt != null && t < d.fadeAt) return d.g;
    const lead = t - AudioSys.ctx.currentTime;
    if (lead <= 0) return d.g;
    if (d.gTo > d.g) return Math.min(d.gTo, d.g + d.rate * lead);
    return Math.max(d.gTo, d.g - d.rate * lead);
  },

  // 등파워 곡선 — 두 덱이 같은 속도로 반대 방향으로 움직이므로 위치는 서로 여집합이다.
  // sin/cos을 물리면 sin²+cos²=1 이라 **겹치는 순간에도 총 에너지가 유지된다**
  // (선형으로 섞으면 서로 무상관인 두 곡의 합이 가운데서 3dB 꺼진다 — 실측 6.1dB 구멍)
  _curve(g) { return g <= 0 ? 0 : g >= 1 ? 1 : Math.sin(g * Math.PI * 0.5); },

  _crossTo(key, hard) {
    const ctx = AudioSys.ctx, now = ctx.currentTime;
    const front = this._front();
    const dur = hard ? this.FADE.hard : this.FADE.soft;
    // 전환 시각 — soft면 나가는 덱의 **다음 마디 첫 박**, hard면 지금
    let tSwap = now + 0.05;
    if (!hard && front) {
      const sd = this._stepDur(front);
      const target = Math.ceil(front.step / 16) * 16;   // nextT가 front.step의 시각이다
      tSwap = front.nextT + (target - front.step) * sd;
      if (tSwap - now > 3.6 || tSwap < now) tSwap = now + 0.05;  // 너무 멀면 그냥 지금
    }
    for (const d of this._decks) {
      // tail(지속음만 남기기)은 **긴 soft 전환에만**. soft는 마디 경계에서 갈아타므로
      // 나가는 드럼이 멈추는 자리에 새 드럼의 다운비트가 정확히 들어와 이음매가 안 보인다
      d.tail = !hard;
      d.gTo = 0; d.rate = 1 / dur; d.fadeAt = tSwap;
    }
    // 들어오는 덱의 페이드 속도를 나가는 덱과 **정확히 같게** 맞춘다 —
    // 그래야 위치가 서로 여집합이 되고 _curve()의 등파워가 성립한다
    const nd = this._mkDeck(key, tSwap, dur);
    nd.fadeAt = tSwap;
    // 같은 막 안 변주끼리는 박자를 이어받는다 — 층을 내려가도 곡이 '끊기는' 게 아니라 '깊어진다'
    if (front && this._actOf(key) === this._actOf(front.key)) {
      nd.step = Math.ceil(front.step / 16) * 16;   // 나가는 곡의 다음 마디 첫 박에 맞춰 이어붙인다
    }
    this._decks.push(nd);
    if (this._decks.length > 3) this._decks.splice(0, this._decks.length - 3);
    this._run();
  },

  _fadeAll(dur) {
    for (const d of this._decks) { d.tail = true; d.gTo = 0; d.rate = 1 / dur; d.fadeAt = null; }
    this.iTarget = 0; this.perilTarget = 0; this.bossPhase = 0;
    this._run();
  },

  _run() { if (!this._timer) { this._lastMs = 0; this._timer = setInterval(() => this._tick(), 50); } },

  // ── 내부: 믹스 체인 ─────────────────────────────────────────────
  // musicBus 뒤의 로우패스·레벨은 unlock()이 이미 만들어 뒀다. 여기서는 **참조만 잡는다.**
  // ★ 종전 초안은 musicBus.disconnect() 후 다시 이었다 — 그러면 남이 끼운 인서트가 끊긴다 (C4)
  _initChain() {
    if (this._chain || !AudioSys.ctx || !AudioSys.musicLP) return;
    this._chain = { lp: AudioSys.musicLP, lvl: AudioSys.musicLvl };
    this._pv = {};
  },

  _setP(key, param, v, tc, eps) {
    if (!param) return;
    if (this._pv[key] != null && Math.abs(this._pv[key] - v) < eps) return;
    this._pv[key] = v;
    param.setTargetAtTime(v, AudioSys.ctx.currentTime, tc);
  },

  _applyChain() {
    if (!this._chain || !AudioSys.ctx) return;
    // 탐색은 멀고 먹먹하게(2.6kHz), 전투는 눈앞에서 열린다(16kHz)
    const openF = 2600 * Math.pow(16000 / 2600, this._ramp(this.iCur, 0.2, 2.0));
    // 위기 — 귀가 먹먹해진다. 다만 보스전엔 패턴을 읽어야 하니 덜 막는다
    const floorF = this.bossPhase > 0 ? 1700 : 950;
    const perilF = 16000 * Math.pow(floorF / 16000, this.perilCur);
    this._setP('lp', this._chain.lp.frequency, Math.max(400, Math.min(openF, perilF)), 0.22, 25);
    // 레벨 — 계측: BGM이 전투 SFX보다 13dB 아래라 싸움 중엔 사라졌다. 격전에서 밀어올린다.
    // (0.80+0.45 → 0.74+0.42 : 신곡들이 이미 4~8dB 뜨거워졌다)
    const lvl = (0.74 + 0.42 * this._ramp(this.iCur, 0.4, 2.6)) * (1 + 0.10 * this.perilCur) * (1 - 0.30 * this._brCur);
    this._setP('lvl', this._chain.lvl.gain, lvl, 0.20, 0.008);
  },

  // ── 내부: 레이어 게인 ───────────────────────────────────────────
  // ★ _schedule 안의 모든 vol은 반드시 this._lv('레이어', 기본값)을 통과한다.
  //   그래야 크로스페이드·강도·위기·여운이 그 소리에 자동으로 붙는다.
  //   여기에 없는 이름을 쓰면 그 소리는 **영영 0**이다 — 레이어를 늘리면 반드시 여기에도 넣어라
  _calcLayers() {
    const i = this.iCur, p = this.perilCur, b = this.bpCur, br = this._brCur;
    const R = this._ramp, L = this._layG;
    L.bass    = (1 + 0.30 * R(i, 1.2, 2.6)) * (1 - 0.15 * br);
    L.sub     = Math.max(R(i, 1.4, 2.7), p * 0.8, R(b, 1.4, 2.4));               // 바닥이 내려앉는다
    L.arp     = (1 - 0.45 * R(i, 2.0, 3.0)) * (1 - 0.75 * p) * (1 - 0.75 * br);  // 탐색의 목소리
    L.pad     = (0.55 + 0.45 * R(i, 0.3, 2.0) + 0.30 * p) * (1 + 0.35 * br);
    L.drum    = R(i, 0.35, 1.15) * (1 - br);                                     // ★ 전투/탐색을 가르는 한 가지
    L.hat     = R(i, 0.5, 1.3) * (1 - 0.85 * p) * (1 - br);                      // 위기엔 고역을 덜어낸다
    L.snare   = R(i, 1.3, 2.1) * (1 - br);                                       // 격전이 되면 2·4박이 들어온다
    L.drive   = R(i, 1.8, 2.8) * (1 - br);                                       // 8분 몰이
    L.tension = Math.max(R(i, 2.3, 3.0), p * 0.7, R(b, 1.3, 2.3)) * (1 - 0.5 * br);
    L.fill    = R(i, 1.9, 2.6) * (1 - br);
    L.heart   = p;
    // 곡의 '얼굴'에 해당하는 층 — 탐색에서 사라지면 안 된다(그게 그 막의 소리다).
    // 다만 격전·위기에서는 물러난다. 종·모티프·장식이 여기 붙는다
    L.bell    = (1 - 0.20 * R(i, 2.0, 3.0)) * (1 - 0.10 * br);
    L.lead    = (1 - 0.35 * R(i, 2.0, 3.0)) * (1 - 0.50 * p) * (1 - 0.30 * br);
    // 테마가 **자기 편성으로 갖고 있는** 필인 — 4마디 루프의 이음매를 '구절'로 만드는 장치라
    // 탐색에서 꺼지면 안 된다. 전투에서 덧붙는 보강 필인(L.fill)과는 다른 축이다
    L.tfill   = (1 - 0.30 * R(i, 2.2, 3.0)) * (1 - 0.40 * p) * (1 - br);
    L.orn     = (1 - 0.60 * R(i, 1.5, 2.8)) * (1 - 0.80 * p) * (1 - 0.40 * br);
    L.bossCore = R(b, 0.15, 1.0);   // 보스 훅용 게이트
    L.bossP2   = R(b, 1.15, 2.0);
    L.bossP3   = R(b, 2.15, 3.0);
    // 페이즈 전환 잔압 — 위가 빨려 들어가고 아래가 부푼다. 1초 남짓의 사건이다
    if (this._slamT > 0) {
      const sl = Math.min(1, this._slamT / 0.6);
      L.arp *= 1 - 0.90 * sl;
      L.hat *= 1 - 0.90 * sl;
      L.orn *= 1 - 0.90 * sl;
      L.pad *= 1 - 0.50 * sl;
      L.drum *= 1 + 0.35 * sl;
      L.sub = Math.max(L.sub, sl);
      L.tension = Math.max(L.tension, sl * 0.9);
    }
  },

  _lay(n) { return this._layG[n] || 0; },
  // ★ dynamic 초안의 `_mv(n, base)`를 `_lv`로 개명했다 (사양서 C1) —
  //   `_mv`는 actbgm의 합성 보이스가 이미 쓰고 있고 `_mn`과 짝이다
  _lv(n, base) { const g = this._layG[n]; return g > 0 ? base * g * this._deckG : 0; },
  _on(n) { return (this._layG[n] || 0) * this._deckG > 0.02; },

  _advance(dt) {
    // 강도는 **오를 땐 빠르게, 내릴 땐 느리게** — 전투는 즉시 도착하고, 여운은 남는다
    const iT = Math.max(this.iTarget, this.bossPhase > 0 ? 2 : 0);
    if (this.iCur < iT) this.iCur = Math.min(iT, this.iCur + 1.7 * dt);
    else this.iCur = Math.max(iT, this.iCur - 0.55 * dt);
    const dp = this.perilTarget - this.perilCur;
    this.perilCur += dp > 0 ? Math.min(dp, 0.85 * dt) : Math.max(dp, -0.5 * dt);
    const db = this.bossPhase - this.bpCur;
    this.bpCur += db > 0 ? Math.min(db, 1.2 * dt) : Math.max(db, -1.2 * dt);
    if (this._brCur > 0) this._brCur = Math.max(0, this._brCur - dt / this._brDur);
    if (this._slamT > 0) this._slamT = Math.max(0, this._slamT - dt);
    this._calcLayers();
    this._applyChain();
  },

  // ── 룩어헤드 스케줄러 (0.18초 앞까지 예약) ──────────────────────
  _tick() {
    const ctx = AudioSys.ctx;
    if (!ctx) return;
    const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const dt = this._lastMs ? Math.min(0.25, (ms - this._lastMs) / 1000) : 0.05;
    this._lastMs = ms;
    this._advance(dt);

    const now = ctx.currentTime;
    for (const d of this._decks) {
      if (d.fadeAt != null && now < d.fadeAt) continue;
      if (d.g < d.gTo) d.g = Math.min(d.gTo, d.g + d.rate * dt);
      else if (d.g > d.gTo) d.g = Math.max(d.gTo, d.g - d.rate * dt);
      if (d.gTo === 0 && d.g <= 0.0008) d.dead = true;
    }
    if (this._decks.some((d) => d.dead)) {
      // 죽는 덱이 보스 테마였다면 지속 드론·체인을 여기서 걷는다.
      // ★ Music.stop()에 넣으면 페이드아웃 도중에 드론만 뚝 끊긴다 — 시점이 다르다 (C10)
      if (typeof BossAudio !== 'undefined' &&
          this._decks.some((d) => d.dead && d.th && d.th.bossKit) &&
          !this._decks.some((d) => !d.dead && d.th && d.th.bossKit)) BossAudio.releaseChains();
      this._decks = this._decks.filter((d) => !d.dead);
    }
    if (!this._decks.length) {
      if (this._timer) { clearInterval(this._timer); this._timer = null; }
      this._lastMs = 0;
      return;
    }

    const muted = AudioSys.muted;
    for (const d of this._decks) {
      while (d.nextT < now + 0.18) {
        // 음소거 중에도 박자는 진행시킨다 (풀면 제자리에서 이어진다)
        const pos = muted ? 0 : this._gAt(d, d.nextT);
        if (pos > 0.004) {
          this.step = d.step;                                   // ★ _schedule은 this.step을 읽는다
          this._deckG = this._curve(pos);                       // 등파워 크로스페이드
          this._deckTail = d.tail && (d.fadeAt == null || d.nextT >= d.fadeAt);
          this._schedule(d.nextT, d.th, d);
        }
        d.nextT += this._stepDur(d);
        d.step++;
        if (d.step % 16 === 0) d.bpmMul = this._bpmMul();        // 템포는 마디 경계에서만
      }
    }
    const f = this._front();
    if (f) { this.step = f.step; this.nextT = f.nextT; }
    if (!muted) this._heartbeat(now);
  },

  // 심장박동 — 음악의 박자와 **일부러 어긋난 자체 시계**를 쓴다.
  // 박에 맞으면 그냥 드럼이지만, 어긋나면 '내 몸에서 나는 소리'로 들린다
  _heartbeat(now) {
    const p = this.perilCur;
    if (p < 0.06) { this._hbNextT = 0; return; }
    // 원안 58+52p(→110bpm)는 왕 p3와 겹치면 음악 예산 밖에서 샌다 → 92bpm 상한
    const beat = 60 / (58 + 34 * p);
    if (!this._hbNextT || this._hbNextT < now - 1) { this._hbNextT = now + 0.05; this._hbN = 0; }
    while (this._hbNextT < now + 0.20) {
      const d = Math.max(0, this._hbNextT - now);
      const v = 0.17 * p;
      if (this._afford(1, this._hbNextT)) {
        AudioSys._tone({ type: 'sine', f0: 54, f1: 30, dur: 0.20, vol: v,        delay: d,        bus: 'music' });
        AudioSys._tone({ type: 'sine', f0: 44, f1: 26, dur: 0.26, vol: v * 0.72, delay: d + 0.19, bus: 'music' });
        this._nb += 4;
      }
      // 피가 도는 소리 — 깊은 위기에서 두 박에 한 번만 (노드 예산)
      if (p > 0.55 && (this._hbN = (this._hbN || 0) + 1) % 2 === 0 && this._afford(0, this._hbNextT)) {
        AudioSys._noise({ dur: 0.5, vol: 0.030 * p, freq: 150, q: 0.6, freq1: 70, atk: 0.12, delay: d, bus: 'music' });
        this._nb += 3;
      }
      this._hbNextT += beat;
    }
  },

  // ── 음악 전용 보이스 ────────────────────────────────────────────
  // AudioSys._tone과 달리 **어택 / 서스테인 / 릴리즈**가 있다.
  // (계측: 게임 전 소리 43종이 어택 0ms·즉시최대·지수감쇠 한 종류뿐이라
  //  악기가 달라도 '말투'가 같아 서로 다르게 들리지 않았다.)
  _mv(o) {
    const A = AudioSys, ctx = A.ctx;
    if (!ctx || A.muted) return;
    const vol = o.vol;
    if (!(vol > 0.0004)) return;
    const t = ctx.currentTime + (o.delay || 0);
    const dur = o.dur || 0.2;
    const atk = Math.min(o.atk == null ? 0.004 : o.atk, dur * 0.6);
    const hold = Math.min(o.hold || 0, Math.max(0, dur - atk - 0.02));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    if (hold > 0) g.gain.linearRampToValueAtTime(vol * (o.sus == null ? 0.55 : o.sus), t + atk + hold);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    g.connect(A.musicBus || A.master);
    if (o.fx > 0) this._send(g, o.fx);
    const n = o.det ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const osc = ctx.createOscillator();
      osc.type = o.type || 'triangle';
      osc.frequency.setValueAtTime(o.f0, t);
      if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(o.f1, 1), t + dur);
      if (o.det) osc.detune.setValueAtTime(i ? o.det : -o.det, t);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + dur + 0.06);
    }
    this._nb += 1 + n;
  },

  // 음악 전용 잡음 보이스 (드럼·장식). 필터 스윕과 어택 램프가 붙는다
  _mn(o) {
    const A = AudioSys, ctx = A.ctx;
    if (!ctx || A.muted || !A._noiseBuf) return;
    const vol = o.vol;
    if (!(vol > 0.0004)) return;
    const t = ctx.currentTime + (o.delay || 0);
    const dur = o.dur || 0.06;
    const atk = Math.min(o.atk == null ? 0.002 : o.atk, dur * 0.5);
    const src = ctx.createBufferSource();
    src.buffer = A._noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(o.freq, t);
    if (o.freq1) f.frequency.exponentialRampToValueAtTime(Math.max(o.freq1, 20), t + dur);
    f.Q.value = o.q == null ? 1 : o.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(g);
    g.connect(A.musicBus || A.master);
    if (o.fx > 0) this._send(g, o.fx);
    src.start(t, Math.random() * 0.5, dur + 0.06);
    this._nb += 3;
  },

  // 음악도 그 방에서 울린다 — 공간(IR)은 막마다 Ambience가 바꾼다.
  // ★ 컨텍스트가 다르면(오프라인 렌더 계측 중) 조용히 건너뛴다. 서로 다른 컨텍스트의
  //   노드를 connect하면 예외가 나면서 그 소리 전체가 죽는다
  _send(node, amt) {
    const A = AudioSys, ctx = A.ctx;
    const dst = A.revMusIn || A.revBus;
    if (!dst || !ctx || dst.context !== ctx) return;
    const s = ctx.createGain();
    s.gain.value = amt;
    node.connect(s); s.connect(dst);
    this._nb++;
  },

  // ── 노드 예산 ───────────────────────────────────────────────────
  // 계측 기준선: BGM 노드 생성 5.1/초, 전체 12.8/초, 동시 생존 노드 최대 17.
  // 확장 편성 + 동적 레이어 + 보스 시퀀서가 전부 이 한 통을 쓴다. 초과하면 prio 0부터 버려진다.
  // 창은 '음악 시간' 기준이라 오프라인 렌더에서도 실시간과 같은 값이 나온다
  MV_BUDGET: 46,
  _nb: 0, _nbT: -1e9,
  _afford(prio, t) {
    if (t - this._nbT >= 1) { this._nbT = t; this._nb = 0; }
    return this._nb < this.MV_BUDGET * (prio >= 2 ? 1 : prio === 1 ? 0.82 : 0.58);
  },

  // 결정적 난수 — 같은 마디는 늘 같은 필인이 난다 (무작위인데 '연주'로 들리게)
  _rnd(n) { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); },

  // 확장 스키마 기본값 = v175 동작. 테마당 1회만 만들고 캐시한다 (스텝마다 객체 할당 금지)
  _cfg(th) {
    let c = th._c;
    if (c) return c;
    c = th._c = {
      voice:    th.voice || 'crypt',
      bassPat:  th.bassPat || 'root',
      arpEvery: th.arpEvery == null ? 2 : th.arpEvery,
      arpDir:   th.arpDir == null ? 1 : th.arpDir,
      arpSpan:  th.arpSpan || 0,
      arpOct:   th.arpOct == null ? 1 : th.arpOct,
      chord:    th.chord || [7, -5],
      det:      th.det || 0,
      drumPat:  th.drumPat || (th.drums ? 'bone' : 'none'),
      fill:     th.fill || 0,
      swing:    th.swing || 0,
      lead:     th.lead || null,
      orn:      th.orn || 0,
      gain:     th.gain || 1,
      fx:       th.fx || 0,
      calm:     !!th.calm,
      pad:      !!th.pad,
    };
    return c;
  },
  // 테마를 런타임에 고친 뒤엔 캐시를 버려야 한다
  _cfgBust() { for (const k in this.themes) delete this.themes[k]._c; },

  // 2·4박 스네어를 자기 편성으로 내지 **않는** 드럼 패턴 — 격전에서만 보강한다
  _NOSNARE: { bone: 1, toll: 1, none: 1 },

  // ── 편성 ────────────────────────────────────────────────────────
  // 주의: 여기의 **모든 vol은 this._lv(...)를 통과한다.** 새 악기를 넣는 사람도 반드시 그렇게 해라.
  //      그리고 **모든 레이어가 this._afford(prio, t)를 통과한다** — 그래야 MV_BUDGET 하나가
  //      음악 전체의 상한이 된다 (이게 CPU 총합을 막는 유일한 장치다)
  _schedule(t, th, deck) {
    const ctx = AudioSys.ctx;

    // ★★ 보스 테마는 전용 시퀀서로 위임하고 즉시 빠진다. **반드시 맨 앞** —
    //    중간에 넣으면 층 테마 편성이 보스 테마에 얹혀 두 배로 울린다 (사양서 §11-2)
    if (th.bossKit) {
      if (this._deckTail || typeof BossAudio === 'undefined') return;
      BossAudio.scheduleBoss(t, th, this.step, Math.max(0, t - ctx.currentTime));
      return;
    }

    const c = this._cfg(th);
    const V = this.MV_VOICES[c.voice] || this.MV_VOICES.crypt;
    const nbar = th.roots.length;
    const s = this.step % 16;
    const bar = Math.floor(this.step / 16) % nbar;
    const root = th.roots[bar];
    const lastBar = bar === nbar - 1;
    const stepDur = 60 / th.bpm / 4;
    // 스윙 — 홀수 16분을 뒤로 민다 (셔플 / 절뚝이는 걸음)
    const sw = (s % 2 === 1) ? c.swing * stepDur : 0;
    const delay = Math.max(0, t - ctx.currentTime + sw);
    const trim = c.gain;
    const fx = c.fx;
    const F = this._freq;
    const loop = Math.floor(this.step / (16 * nbar));   // 몇 번째 루프인가 (필인·모티프 시드)

    // ── 1) 베이스 ──────────────────────────────────────────────
    // 종전엔 0·8스텝 두 번뿐이었고 12곡 전부 동일했다. 이제 테마가 패턴을 고른다
    let bassHit = false, bassNote = root;
    switch (c.bassPat) {
      case 'root': bassHit = (s === 0 || s === 8); break;                      // v175 동작
      case 'ost':  bassHit = (s % 4 === 0); bassNote = root + (s === 12 ? 7 : 0); break; // 오스티나토 = 발걸음
      case 'walk': bassHit = (s % 4 === 0); bassNote = root + [0, 7, 5, 3][s >> 2]; break; // 걷는 베이스
      case 'ped':  bassHit = (s === 0); break;                                 // 페달 포인트 (한 음이 마디 내내)
      case 'toll': bassHit = (s === 0); break;                                 // 종 — 온음표
    }
    const longBass = (c.bassPat === 'ped' || c.bassPat === 'toll');
    if (bassHit && this._afford(2, t)) {
      const B = V.bass, S = V.sub, lm = longBass ? 4 : 1, lv = longBass ? 1.15 : 1;
      // calm 감쇠비 11/15 · 6/7 · 5/6 은 v175가 하드코딩하던 값(0.055 / 0.03 / 0.035)을
      // 정확히 재현하는 분수다. 소수로 쓰면 기존 12테마가 0.05% 어긋난다
      this._mv({ type: B.type, f0: F(bassNote), dur: B.dur * lm, atk: B.atk,
                 hold: longBass ? B.dur * 2 : 0, sus: 0.5, fx,
                 vol: this._lv('bass', B.vol * (c.calm ? 11 / 15 : 1) * lv * trim), delay });
      this._mv({ type: S.type, f0: F(bassNote - 12), dur: S.dur * lm, atk: S.atk,
                 hold: longBass ? S.dur * 2 : 0, sus: 0.5, fx,
                 vol: this._lv('bass', S.vol * lv * trim), delay });
      // 서브 — 격전·위기·보스에서만 바닥이 한 옥타브 더 내려앉는다
      // (계측 H: 60Hz 이하를 주력으로 쓰는 소리가 게임에 없었다)
      if (this._on('sub') && this._afford(1, t)) {
        this._mv({ type: 'sine', f0: F(bassNote - 24), dur: 0.50, atk: 0.010,
                   vol: this._lv('sub', 0.075 * trim), delay });
      }
    }

    // ── 2) 패드(코드 보이싱) ───────────────────────────────────
    // 종전: 5도 + 4도아래 두 음 고정. 이제 보이싱과 디튠을 테마가 정한다.
    // 디튠이 4·5막의 핵심 장치다 — 장3도·장7도를 쌓아 '성스럽게' 만든 뒤 센트 단위로
    // 어긋내면 아름다움이 썩는 소리가 된다 (대성당 18센트 / 왕좌 20센트 / 무한 22센트).
    // 격전·위기에는 pad:false 테마에도 들어온다 (공간을 채워야 밀리지 않는다)
    if (s === 0 && this._on('pad') && (c.pad || this.iCur > 1.2 || this.perilCur > 0.2)
        && this._afford(1, t)) {
      const P = V.pad;
      for (let i = 0; i < c.chord.length; i++) {
        this._mv({ type: P.type, f0: F(root + c.chord[i]), dur: P.dur, atk: P.atk,
                   hold: P.dur * (P.hold || 0), sus: 0.7, det: c.det, fx,
                   vol: this._lv('pad', P.vol * (i ? 6 / 7 : 1) * trim), delay });
      }
    }

    // ↓ 나가는 덱(크로스페이드 중)은 여기서 끝. 지속음만 남기고 두드림은 넘기지 않는다
    if (this._deckTail) return;

    // ── 3) 아르페지오 ──────────────────────────────────────────
    // 종전: 무조건 8분음표 상행 + 8스텝 옥타브 스윙. 이제 간격·방향·음역을 테마가 정한다.
    // arpEvery가 16과 서로소면(3, 6) 물결이 마디를 가로질러 폴리리듬이 생긴다.
    // 절정에서는 음표 수를 반으로 줄인다 — 몰이·스네어가 이미 움직임을 맡았다
    const ae = c.arpEvery > 0 ? (this.iCur > 2.2 ? c.arpEvery * 2 : c.arpEvery) : 0;
    if (ae > 0 && this.step % ae === 0 && this._on('arp') && this._afford(1, t)) {
      const sc = th.scale;
      const n = c.arpSpan ? Math.min(c.arpSpan, sc.length) : sc.length;
      const i = Math.floor(this.step / ae);
      let k;
      if (c.arpDir > 0) k = i % n;                                   // 상행
      else if (c.arpDir < 0) k = (n - 1) - (i % n);                  // 하행
      else { const p = 2 * n - 2, m = p > 0 ? i % p : 0; k = m < n ? m : p - m; } // 미러(팰린드롬)
      const A = V.arp;
      const octave = c.arpOct ? (Math.floor(this.step / 8) % 2) * 12 : 0;
      this._mv({ type: A.type, f0: F(root + 12 + sc[k] + octave), dur: A.dur, atk: A.atk, fx,
                 vol: this._lv('arp', A.vol * (c.calm ? 5 / 6 : 1) * trim), delay });
    }

    // ── 4) 리듬 ────────────────────────────────────────────────
    this._drum(c, V, s, delay, trim, t, root, F, fx);

    // ── 5) 필인 (테마 자체 편성) ───────────────────────────────
    // 계측: 12테마 전부 4마디 리듬이 100% 동일 — 필인 0, 싱코페이션 0, 벨로시티 변화 0.
    // 마지막 마디 끝 4스텝에 필인이 들어가면 루프 이음매가 '반복'이 아니라 '구절'이 된다
    if (c.fill > 0 && lastBar && s >= 12 && this._rnd(loop * 7 + 3) < c.fill && this._afford(1, t)) {
      const j = s - 12;
      this._mv({ type: 'sine', f0: 156 - j * 18, f1: 42, dur: 0.09, atk: 0.001,
                 vol: this._lv('tfill', (0.085 + j * 0.022) * trim), delay });
      if (this._afford(0, t)) {
        this._mn({ freq: 2100 + j * 950, q: 1.1, dur: 0.05, vol: this._lv('tfill', (0.024 + j * 0.006) * trim), delay });
      }
    }

    // ── 6) 막 모티프 ───────────────────────────────────────────
    // 막마다 '기억되는 선율' 한 줄. 매 마디가 아니라 드물게 나와야 훅이 된다
    const L = c.lead;
    if (L && this._on('lead')) {
      const pos = this.step % L.every;
      const k = L.at.indexOf(pos);
      if (k >= 0 && this._rnd(Math.floor(this.step / L.every) * 13 + k) < (L.prob == null ? 1 : L.prob)
          && this._afford(0, t)) {
        const M = V.lead;
        this._mv({ type: M.type, f0: F(root + 12 + (L.oct || 0) * 12 + L.deg[k % L.deg.length]),
                   dur: M.dur, atk: M.atk, hold: M.dur * 0.3, sus: 0.6, fx,
                   vol: this._lv('lead', M.vol * trim), delay });
      }
    }

    // ── 7) 장식음 ──────────────────────────────────────────────
    // 물방울 / 마른 뼈 / 쇠사슬 / 파리 / 금박 / 무너지는 돌.
    // 예산 초과 시 가장 먼저 버려진다 (prio 0). 6.4kHz 이상 대역을 여는 역할도 겸한다
    if (c.orn > 0 && this._on('orn') && this._rnd(this.step * 3 + 11) < c.orn * 0.3 && this._afford(0, t)) {
      const O = V.orn, w = 0.8 + this._rnd(this.step * 5 + 1) * 0.55;
      if (O.tone) {
        this._mv({ type: O.type, f0: O.f0 * w, f1: O.f1 ? O.f1 * w : null, dur: O.dur,
                   atk: O.atk, vol: this._lv('orn', O.vol * trim), delay, fx });
      } else {
        this._mn({ freq: O.freq * w, q: O.q, dur: O.dur, vol: this._lv('orn', O.vol * trim), delay, fx });
      }
      // 고역 트랜지언트 — 물방울이 수면을 때리는 틱 / 금박이 스치는 소리
      if (O.hf && this._afford(0, t)) {
        this._mn({ freq: O.hf * w, q: 2.5, dur: 0.022, vol: this._lv('orn', O.hv * trim), delay });
      }
    }

    // ── 8) 전황 레이어 (동적 음악) ─────────────────────────────
    // 여기부터는 테마 편성이 아니라 **전황**이 켜는 것들이다. 전부 _afford를 통과한다
    if (!c.calm) {
      // 몰이 — 박 뒤 8분이 앞으로 민다. 격전 전용
      // (16분 전부가 아니라 s=3,7,11,15 넷만 — 음표를 배로 늘리지 않고도 추진력은 그대로다)
      if (this._on('drive')) {
        if (s % 4 === 3 && this._afford(0, t)) {
          this._mv({ type: 'square', f0: F(root + 12), dur: 0.075, atk: 0.002,
                     vol: this._lv('drive', 0.034 * trim), delay });
        }
        if ((s === 6 || s === 14) && this._afford(0, t)) {
          this._mv({ type: 'sawtooth', f0: F(root + 5), f1: F(root), dur: 0.12, atk: 0.002,
                     vol: this._lv('drive', 0.038 * trim), delay });
        }
      }
      // 스네어 보강 — 2·4박을 자기 편성으로 안 내는 테마(bone/toll/none)에서만.
      // 2·4박이 들어오는 순간 곡이 '배경'에서 '싸움'이 된다
      if (this._on('snare') && this._NOSNARE[c.drumPat] && (s === 4 || s === 12) && this._afford(1, t)) {
        this._mn({ freq: 1900, q: 0.7, freq1: 700, dur: 0.09, vol: this._lv('snare', 0.085 * trim), delay });
        this._mv({ type: 'triangle', f0: 210, f1: 150, dur: 0.06, atk: 0.001,
                   vol: this._lv('snare', 0.05 * trim), delay });
      }
      // 필인 보강 — 자기 필인이 없는 테마(기존 12곡)에도 격전에서는 4마디 주기의 끝이 생긴다
      if (c.fill === 0 && this._on('fill') && Math.floor(this.step / 16) % 4 === 3 && s >= 12
          && this._afford(1, t)) {
        const k = s - 12;
        this._mv({ type: 'sine', f0: 150 - k * 22, f1: 55, dur: 0.09, atk: 0.001,
                   vol: this._lv('fill', 0.10 - k * 0.008), delay });
        if (k === 3 && this._afford(0, t)) {
          this._mn({ dur: 0.14, vol: this._lv('fill', 0.07), freq: 3200, q: 0.6, freq1: 900, delay });
        }
      }
    }
    // 긴장 — 절정·위기·보스 후반. 단9도와 삼온음이 위에서 긁는다
    if (s === 0 && this._on('tension') && this._afford(0, t)) {
      this._mv({ type: 'sawtooth', f0: F(root + 13), dur: 1.1, atk: 0.35,
                 vol: this._lv('tension', 0.020 * trim), delay });
      this._mv({ type: 'sawtooth', f0: F(root + 18), dur: 0.9, atk: 0.45,
                 vol: this._lv('tension', 0.016 * trim), delay: delay + 0.12 });
    }

    // 보스 훅 (선택) — 게이트는 bossCore/bossP2/bossP3
    if (this._bossHook) this._bossHook(t, th, s, root, delay, this);
  },

  // ── 리듬 편성 ───────────────────────────────────────────────────
  // 종전: drums:true인 9개 테마가 킥(sine 105→38) + 하이햇(noise 6000) **동일 음원**을 썼다.
  // 보스곡 드럼과 1층 드럼이 같은 소리였다. 이제 막마다 다른 타악기를 쓴다.
  // 레이어: 킥·저역타 → drum / 하이햇·틱 → hat / 2·4박 → snare / 종 → bell(탐색에도 남는다)
  _drum(c, V, s, delay, trim, t, root, F, fx) {
    const p = c.drumPat;
    if (p === 'none') return;
    const K = V.kick, T = V.tick;
    switch (p) {
      case 'bone':   // 1막·종전 편성 — 마른 흙과 뼈 (v175와 동일한 음원·배치)
        if (s % 4 === 0 && this._on('drum') && this._afford(2, t))
          this._mv({ type: 'sine', f0: K.f0, f1: K.f1, dur: K.dur, atk: 0.001,
                     vol: this._lv('drum', K.vol * trim), delay });
        if (s % 4 === 2 && this._on('hat') && this._afford(0, t))
          this._mn({ freq: T.freq, q: T.q, dur: T.dur, vol: this._lv('hat', T.vol * trim), delay });
        break;

      case 'march':  // 2·3·5막 — 행군. 킥이 2연타로 발을 맞추고 군고가 2·4박을 친다
        if ((s === 0 || s === 3 || s === 8 || s === 11) && this._on('drum') && this._afford(2, t))
          this._mv({ type: 'sine', f0: K.f0 * 1.05, f1: K.f1, dur: K.dur * 0.9, atk: 0.001,
                     vol: this._lv('drum', K.vol * (s % 8 === 0 ? 1 : 0.62) * trim), delay });
        if ((s === 4 || s === 12) && this._on('snare') && this._afford(1, t)) {
          this._mn({ freq: 1900, q: 0.7, dur: 0.09, vol: this._lv('snare', 0.070 * trim), atk: 0.002, delay });
          this._mv({ type: 'triangle', f0: 190, f1: 120, dur: 0.07, atk: 0.001,
                     vol: this._lv('snare', 0.048 * trim), delay });
        }
        if (s % 4 === 2 && this._on('hat') && this._afford(0, t))
          this._mn({ freq: T.freq, q: T.q, dur: T.dur, vol: this._lv('hat', T.vol * 0.8 * trim), delay });
        break;

      case 'gavel':  // 3막 재판소 — 판결봉. 나무가 돌을 때린다. 정확히 2·4박, 흔들림 없이
        if ((s === 4 || s === 12) && this._on('snare') && this._afford(2, t)) {
          this._mn({ freq: 800, q: 8, dur: 0.05, vol: this._lv('snare', 0.098 * trim), atk: 0.001, delay });
          this._mv({ type: 'square', f0: 210, f1: 90, dur: 0.09, atk: 0.001,
                     vol: this._lv('snare', 0.052 * trim), delay });
        }
        if (s === 0 && this._on('drum') && this._afford(2, t))
          this._mv({ type: 'sine', f0: K.f0, f1: K.f1, dur: K.dur, atk: 0.002,
                     vol: this._lv('drum', K.vol * 0.95 * trim), delay });
        if ((s === 6 || s === 14) && this._on('hat') && this._afford(0, t))   // 서기의 펜 / 쇠사슬
          this._mn({ freq: T.freq, q: T.q * 2, dur: T.dur, vol: this._lv('hat', T.vol * 0.6 * trim), delay });
        break;

      case 'toll':   // 4막 대성당 / 5막 왕좌 — 큰 종.
        // 종은 배음이 조화롭지 않다(2.76배·5.4배). 그래서 종소리는 '음정'이 아니라 '울림'으로 들린다.
        // 종 크기는 음색 프로파일이 정한다 — 대성당의 종(148Hz, 밝고 길다)과
        // 왕도의 대종(92Hz, 낮고 무겁다)이 같은 종이면 37층과 49층이 같은 곳이 된다.
        // ★ 종은 그 막의 '얼굴'이다 — 드럼과 달리 탐색에서도 울린다 (bell 레이어)
        {
          const B = V.bell || { f: 116, dur: 2.2, sub: 78 };
          if (s === 0 && this._afford(2, t)) {
            this._mv({ type: 'sine', f0: B.f,        dur: B.dur,        atk: 0.004, hold: 0.5, sus: 0.45, fx, vol: this._lv('bell', 0.072 * trim), delay });
            this._mv({ type: 'sine', f0: B.f * 2.76, dur: B.dur * 0.68, atk: 0.003, fx, vol: this._lv('bell', 0.028 * trim), delay });
            this._mv({ type: 'sine', f0: B.f * 5.40, dur: B.dur * 0.41, atk: 0.002, fx, vol: this._lv('bell', 0.013 * trim), delay });
          }
          if (s === 8 && this._afford(1, t))
            this._mv({ type: 'sine', f0: B.sub, f1: B.sub * 0.79, dur: 1.1, atk: 0.02, hold: 0.3, sus: 0.5,
                       vol: this._lv('bell', 0.050 * trim), delay });
          if (s % 8 === 4 && this._on('hat') && this._afford(0, t))
            this._mn({ freq: B.f * 71, q: 2, dur: 0.03, vol: this._lv('hat', 0.014 * trim), delay });
        }
        break;

      case 'war':    // 4막 소각장 / 5막 근위 / 무한 — 전쟁 북. 밀도가 높고 필인이 붙는다
        if ((s % 4 === 0 || s === 6 || s === 14) && this._on('drum') && this._afford(2, t))
          this._mv({ type: 'sine', f0: K.f0, f1: K.f1, dur: K.dur, atk: 0.001,
                     vol: this._lv('drum', K.vol * (s % 8 === 0 ? 1.1 : 0.72) * trim), delay });
        if ((s === 4 || s === 12) && this._on('snare') && this._afford(1, t)) {
          this._mn({ freq: 1500, q: 0.5, dur: 0.13, vol: this._lv('snare', 0.082 * trim), atk: 0.002, delay });
          this._mn({ freq: 240, q: 0.8, dur: 0.10, vol: this._lv('snare', 0.048 * trim), delay });
        }
        if ((s === 2 || s === 7 || s === 10 || s === 15) && this._on('hat') && this._afford(0, t))
          this._mn({ freq: T.freq, q: T.q, dur: T.dur, vol: this._lv('hat', T.vol * trim), delay });
        break;

      case 'rot':    // 4막 역병 마을 — 젖은 북과 마른 기침. 박이 고르지 않다 (swing과 함께 쓴다)
        if ((s === 0 || s === 7 || s === 10) && this._on('drum') && this._afford(2, t))
          this._mv({ type: 'sine', f0: K.f0, f1: K.f1, dur: K.dur, atk: 0.003,
                     vol: this._lv('drum', K.vol * (s === 0 ? 1.05 : 0.62) * trim), delay });
        if (s === 12 && this._on('snare') && this._afford(1, t))   // 젖은 스네어 — 어택이 뭉개진다(30ms)
          this._mn({ freq: 620, q: 0.6, dur: 0.16, vol: this._lv('snare', 0.058 * trim), atk: 0.030, delay });
        if ((s === 5 || s === 13) && this._on('hat') && this._afford(0, t))  // 마른 기침
          this._mn({ freq: T.freq, q: T.q, dur: T.dur, vol: this._lv('hat', T.vol * trim), delay });
        break;
    }
  },
};

// ══════════════════════════════════════════════════════════════════════════
//  BossAudio (v176) — 보스 음악·모티프 레이어
//  진단: 보스 23종 + 왕 3페이즈가 **전부 같은 7.27초 루프 한 곡**이었고,
//        그 곡과 f4(용암 심층)의 스펙트럼 거리가 0.017 — 전체 66쌍 중 최소였다.
//        즉 "보스전 음악"이 사실상 4층 배경음이었다.
//  처방: 막별 보스 테마 5 + 왕 3페이즈 = 8곡. roots 8마디 · 타악 폴리미터(3·4·5) ·
//        선율 위상(7·9·11·13)이 겹쳐 같은 마디가 60마디에 한 번 돌아온다.
//        그 위에 보스 23종 각자의 시그니처 모티프(3~5음)가 곡 안에서 울린다.
//  Music._schedule 맨 앞 가드가 bossKit 테마를 이리로 위임한다.
// ══════════════════════════════════════════════════════════════════════════
const BossAudio = {
  // ── 킷 id → 막. 층이 아니라 **킷**이 정체성이다:
  //    55층에 나온 갈고리 브람도 2막(다리와 관문)의 소리를 낸다.
  ACT: {
    1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1,
    20: 2, 60: 2, 61: 2,
    30: 3, 62: 3, 63: 3,
    40: 4, 64: 4, 65: 4,
    45: 5, 50: 5, 66: 5, 67: 5,
  },
  actOf(defId) { return this.ACT[defId] || 1; },
  motifRoot(defId) { return [0, 48, 50, 45, 46, 48][this.actOf(defId)]; },

  // ── 시그니처 모티프 (3~5음) ───────────────────────────────────────────
  //  n: 루트로부터의 반음, r: 다음 음까지의 간격(16분 단위), v: 음색, oct: 옥타브 이조
  //  같은 막의 보스도 이 세 줄이 다르면 "이 놈이구나"가 귀로 온다.
  MOTIFS: {
    1:  { v: 'earth',   n: [0, 0, -1],       r: [2, 2, 4],       oct: 0 },   // 삽이 흙을 두 번 찍고 가라앉는다
    2:  { v: 'creak',   n: [0, 3, 2],        r: [3, 3, 4],       oct: 0 },   // 수레바퀴 — 오르다 못 오른다
    3:  { v: 'iron',    n: [0, 5, 7, 5],     r: [2, 2, 2, 4],    oct: 0 },   // 열쇠 세 개가 철창을 긋는다
    4:  { v: 'flame',   n: [0, 6, 10],       r: [2, 2, 5],       oct: 0 },   // 불이 붙는 삼온음 상승
    5:  { v: 'choir',   n: [0, -1, -2, -3],  r: [3, 3, 3, 5],    oct: 0 },   // 밧줄이 조여든다 (반음 4단 하강)
    6:  { v: 'spirit',  n: [-1, 0, 0],       r: [2, 2, 5],       oct: 12 },  // 1번의 역행 — 죽어서 돌아온 자
    7:  { v: 'creak',   n: [0, 3, 2],        r: [4, 4, 6],       oct: -12 }, // 2번이 물에 잠겼다 (한 옥타브 아래, 느리게)
    8:  { v: 'iron',    n: [0, 5, 7, 4],     r: [2, 2, 2, 4],    oct: -12 }, // 3번의 마지막 음이 어긋난다 (사슬이 안 풀린다)
    9:  { v: 'flame',   n: [0, 6, 10, 9],    r: [2, 2, 2, 4],    oct: 0 },   // 4번의 상승이 꺼진다
    10: { v: 'axe',     n: [0, -12],         r: [3, 6],          oct: 0 },   // 도끼 한 번. 2음뿐 — 가장 짧고 가장 무겁다
    20: { v: 'horn',    n: [0, 7, 12],       r: [2, 2, 5],       oct: 0 },   // 사령관의 호각 (군대 신호)
    60: { v: 'hook',    n: [0, 8, 7],        r: [2, 3, 4],       oct: 0 },   // 갈고리가 걸리고 당겨진다
    61: { v: 'oar',     n: [0, -5],          r: [7, 7],          oct: -12 }, // 침묵의 요른 — 2음, 사이가 길다. 소리가 적은 것이 그의 서명
    30: { v: 'gavel',   n: [0, 0, 0, -6],    r: [2, 2, 2, 6],    oct: 0 },   // 판결봉 3타 + 삼온음 하강 = 사형선고
    62: { v: 'quill',   n: [0, 2, 1, 3, 2],  r: [1, 1, 1, 1, 4], oct: 12 },  // 펜이 급하게 긁는다 (5음, 잰 걸음)
    63: { v: 'mace',    n: [0, -5, 0],       r: [3, 3, 5],       oct: -12 }, // 철퇴가 올라갔다 내려온다
    40: { v: 'bell',    n: [0, 4, 7, 11],    r: [3, 3, 3, 6],    oct: 0 },   // 유일한 장3도 상행 — 그래서 더 소름끼친다. 8도가 아닌 장7도에서 멈춘다(축복이 어긋난다)
    64: { v: 'beak',    n: [0, -1, 0, -1],   r: [2, 1, 2, 4],    oct: 12 },  // 마스크 속 헐떡임 (반음 왕복)
    65: { v: 'furnace', n: [0, 3, 6],        r: [3, 3, 5],       oct: -12 }, // 소각로 문이 열린다
    45: { v: 'noble',   n: [0, 7, 5],        r: [2, 2, 6],       oct: 0 },   // 근위 팡파레인데 5도가 아니라 4도로 내려앉는다 = 맹세는 지켰으나 옳지 않았다
    66: { v: 'glass',   n: [0, 7, 14, 19],   r: [2, 2, 2, 6],    oct: 12 },  // 성좌 — 넓은 상행
    67: { v: 'hoof',    n: [0, 0, 0, -7],    r: [1, 1, 1, 5],    oct: 0 },   // 말발굽 3연 + 창끝이 내려온다
    // 왕 바르텐 3세 — 앞의 막보스 모티프 조각들을 이어붙인 것:
    //  0,7 (로트가르의 호각) → 11 (이노첸시오의 미해결 장7도) → 5 (늑대의 4도 낙하) → -12 (처형인의 옥타브 낙하)
    //  "명령은 위에서 내려왔다"가 음으로 성립한다.
    50: { v: 'crown',   n: [0, 7, 11, 5, -12], r: [2, 2, 2, 3, 7], oct: 0 },
  },
  // 왕의 페이즈 변주 — 같은 다섯 음이 오염되고(2) 순서가 무너진다(3)
  KING_P: {
    2: { v: 'crown', n: [0, 6, 11, 5, -12], r: [2, 2, 2, 3, 6], oct: 0 },   // 7 → 6: 성배의 삼온음이 호각을 먹었다
    3: { v: 'crown', n: [11, -12, 0, 5, 6], r: [1, 2, 1, 3, 5], oct: 0 },   // 순서 붕괴 — 왕이 아니라 왕국이 말한다
  },
  motifFor(defId, kingPhase) {
    if (defId === 50 && kingPhase >= 2) return this.KING_P[kingPhase] || this.MOTIFS[50];
    return this.MOTIFS[defId] || this.MOTIFS[1];
  },

  // ── 상태 ────────────────────────────────────────────────────────────
  activeDefId: null,   // 지금 싸우는 보스 (모티프 고스트용)
  stage: 1,            // 1=평상 2=격노 3=맹공 — 23종 전부에 걸리는 음악 반응 (테마 교체 없이)
  silentUntil: 0,      // 보스가 쓰러진 뒤의 정적 — **오디오 클럭** 기준 (초). 벽시계를 쓰면 탭 정지·프레임 히치와 어긋난다
  _chains: null, _chainKey: null,

  // ══ 저수준 합성 ═══════════════════════════════════════════════════════
  // AudioSys._tone/_noise 와 **별도**다 (그쪽은 「타격·스킬」 담당이 손댄다).
  // 차이: 어택 램프 / 홀드 / 필터 스윕 / 지속 체인 재사용 — 엔진에 없던 네 가지.
  _dest(bus) { return (bus === 'music' && AudioSys.musicBus) || AudioSys.sfxBus || AudioSys.master; },

  // 공유 ConvolverNode 앞단의 send 게인. ConvolverNode는 세션 내내 1개이고 AudioSys가 소유한다
  // (여기서 새로 만들면 CPU가 죽고 공간이 두 개가 된다 — 사양서 C5).
  // ★ 보스곡은 음악 계열이므로 bgm 슬라이더를 미러하는 revMusIn을 먼저 잡는다 (사양서 §7-1-1)
  _revBus() { const A = AudioSys; return A.revMusIn || A.revBus || A.revSend || null; },
  _fx(node, amt) {
    if (!amt || !AudioSys.ctx) return;
    const bus = this._revBus();
    // 컨텍스트가 다르면(오프라인 렌더 계측 중) 건너뛴다 — 교차 연결은 예외를 던진다
    if (!bus || bus.context !== AudioSys.ctx) return;
    const g = AudioSys.ctx.createGain();
    g.gain.value = amt;
    node.connect(g); g.connect(bus);
    this._nbHook(1);
  },

  // 노드 예산은 Music과 **같은 통**을 쓴다. 안 그러면 왕 p3가 예산 밖에서 47/초를 따로 쓴다
  // (사양서 §7-1-2 / §8-1). 이 훅이 없으면 MV_BUDGET이 음악 전체의 상한이 되지 못한다
  _nbHook(n) { if (typeof Music !== 'undefined' && Music._nb != null) Music._nb += n; },

  _shape(param, t0, o) {
    const dur = o.dur || 0.2;
    const atk = Math.max(0.0004, o.atk == null ? 0.004 : o.atk);
    const hold = o.hold || 0;
    const vol = Math.max(0.0008, o.vol == null ? 0.2 : o.vol);
    param.cancelScheduledValues(t0);
    param.setValueAtTime(0.0006, t0);
    param.linearRampToValueAtTime(vol, t0 + atk);          // ← 엔진 최초의 어택 램프
    if (hold > 0) param.setValueAtTime(vol, t0 + atk + hold);
    param.exponentialRampToValueAtTime(0.0006, t0 + atk + hold + dur);
    return atk + hold + dur;
  },

  tone(o) {
    const ctx = AudioSys.ctx;
    if (!ctx || AudioSys.muted) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const ch = o.chain;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sawtooth';
    if (o.det) osc.detune.setValueAtTime(o.det, t0);
    osc.frequency.setValueAtTime(Math.max(o.f0 || 220, 1), t0);
    const g = ch ? ch.gain : ctx.createGain();
    const total = this._shape(g.gain, t0, o);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(o.f1, 1), t0 + total);
    osc.connect(ch ? ch.in : g);
    if (!ch) {
      g.connect(this._dest(o.bus)); this._fx(g, o.fx);
      osc.onended = () => { try { g.disconnect(); } catch (e) { /* 이미 해제 */ } };
    }
    osc.start(t0);
    osc.stop(t0 + total + 0.02);
    this._nbHook(ch ? 1 : 2);
  },

  noise(o) {
    const ctx = AudioSys.ctx;
    if (!ctx || AudioSys.muted || !AudioSys._noiseBuf) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const ch = o.chain;
    const src = ctx.createBufferSource();
    src.buffer = AudioSys._noiseBuf;
    if (o.rate) src.playbackRate.value = o.rate;
    let g, entry, filt = null;
    if (ch) { g = ch.gain; entry = ch.in; } else {
      filt = ctx.createBiquadFilter();
      filt.type = o.ftype || 'bandpass';
      filt.frequency.setValueAtTime(o.freq || 1200, t0);
      filt.Q.value = o.q == null ? 1 : o.q;
      g = ctx.createGain(); filt.connect(g); entry = filt;
    }
    const total = this._shape(g.gain, t0, o);
    // 필터 스윕 — 잡음이 '움직이는' 소리를 낸다 (엔진에 없던 것)
    if (filt && o.freq1) filt.frequency.exponentialRampToValueAtTime(Math.max(o.freq1, 20), t0 + total);
    src.connect(entry);
    if (!ch) {
      g.connect(this._dest(o.bus)); this._fx(g, o.fx);
      src.onended = () => { try { g.disconnect(); } catch (e) { /* 이미 해제 */ } };
    }
    src.start(t0, Math.random() * 0.5, total + 0.03);
    this._nbHook(ch ? 1 : 3);
  },

  // ══ 음색표 — 모티프가 입는 옷 ═════════════════════════════════════════
  //  o = { v: 음량배수, d: 지연, b: 버스, lite: 장식 생략(반복 재생용) }
  VOICE: {
    earth(B, f, o) {                                   // 삽이 흙을 찍는다
      B.tone({ type: 'triangle', f0: f, f1: f * 0.62, dur: 0.20, atk: 0.002, vol: 0.30 * o.v, delay: o.d, bus: o.b, fx: 0.10 });
      B.noise({ freq: 210, q: 0.7, dur: 0.13, atk: 0.001, vol: 0.22 * o.v, delay: o.d, bus: o.b });
      if (!o.lite) B.noise({ freq: 3100, q: 5, dur: 0.035, vol: 0.09 * o.v, delay: o.d, bus: o.b });
    },
    creak(B, f, o) {                                   // 수레바퀴 — 느린 어택 + 미세 하강
      B.tone({ type: 'sawtooth', f0: f * 1.01, f1: f * 0.96, dur: 0.30, atk: 0.06, vol: 0.16 * o.v, delay: o.d, bus: o.b, fx: 0.12 });
      B.tone({ type: 'sine', f0: f * 0.5, dur: 0.22, atk: 0.010, vol: 0.14 * o.v, delay: o.d, bus: o.b });
      if (!o.lite) B.noise({ freq: 1250, freq1: 1650, q: 7, dur: 0.26, atk: 0.05, vol: 0.10 * o.v, delay: o.d, bus: o.b });
    },
    iron(B, f, o) {                                    // 철창·열쇠
      B.tone({ type: 'square', f0: f, dur: 0.13, atk: 0.0008, vol: 0.16 * o.v, delay: o.d, bus: o.b });
      B.noise({ freq: 3400, q: 8, dur: 0.05, vol: 0.13 * o.v, delay: o.d, bus: o.b });
      if (!o.lite) {
        B.tone({ type: 'triangle', f0: f * 3.01, f1: f * 2.9, dur: 0.09, atk: 0.0006, vol: 0.10 * o.v, delay: o.d, bus: o.b, fx: 0.16 });
        B.noise({ freq: 5200, q: 11, dur: 0.03, vol: 0.07 * o.v, delay: o.d + 0.05, bus: o.b });
      }
    },
    flame(B, f, o) {                                   // 불이 번진다 — 필터가 위로 열린다
      B.tone({ type: 'sawtooth', f0: f * 0.9, f1: f * 1.7, dur: 0.24, atk: 0.012, vol: 0.16 * o.v, delay: o.d, bus: o.b });
      B.noise({ freq: 600, freq1: 2600, q: 0.8, dur: 0.26, atk: 0.02, vol: 0.16 * o.v, delay: o.d, bus: o.b });
      if (!o.lite) B.noise({ freq: 180, q: 0.5, dur: 0.18, vol: 0.12 * o.v, delay: o.d, bus: o.b });
    },
    choir(B, f, o) {                                   // 합창 — 0.16s 어택 스웰 (엔진 최초)
      for (const c of [-9, 0, 7]) {
        B.tone({ type: 'sawtooth', f0: f, det: c, dur: 0.55, atk: 0.16, hold: 0.06, vol: 0.075 * o.v, delay: o.d, bus: o.b, fx: 0.28 });
      }
      B.tone({ type: 'sine', f0: f * 0.5, dur: 0.60, atk: 0.12, vol: 0.10 * o.v, delay: o.d, bus: o.b });
    },
    spirit(B, f, o) {                                  // 원혼 — 잡음이 거의 없다
      B.tone({ type: 'sine', f0: f, f1: f * 0.86, dur: 0.38, atk: 0.03, vol: 0.16 * o.v, delay: o.d, bus: o.b, fx: 0.32 });
      B.tone({ type: 'sine', f0: f * 2.02, dur: 0.24, atk: 0.02, vol: 0.07 * o.v, delay: o.d + 0.02, bus: o.b, fx: 0.30 });
      if (!o.lite) B.noise({ freq: 1600, q: 2, dur: 0.20, atk: 0.05, vol: 0.05 * o.v, delay: o.d, bus: o.b });
    },
    axe(B, f, o) {                                     // 처형인의 도끼 — 2음짜리 모티프의 무게 전부가 여기 있다
      B.noise({ freq: 5600, q: 9, dur: 0.04, vol: 0.16 * o.v, delay: o.d, bus: o.b });
      B.tone({ type: 'sine', f0: f, f1: f * 0.32, dur: 0.34, atk: 0.001, vol: 0.42 * o.v, delay: o.d + 0.02, bus: o.b });
      B.noise({ freq: 250, freq1: 110, q: 0.5, dur: 0.28, vol: 0.24 * o.v, delay: o.d + 0.02, bus: o.b, fx: 0.18 });
      if (!o.lite) B.tone({ type: 'sawtooth', f0: f * 0.5, f1: f * 0.25, dur: 0.40, atk: 0.002, vol: 0.12 * o.v, delay: o.d + 0.02, bus: o.b });
    },
    horn(B, f, o) {                                    // 전쟁 나팔 — 5도 오르가눔
      B.tone({ type: 'square', f0: f, dur: 0.26, atk: 0.014, hold: 0.06, vol: 0.13 * o.v, delay: o.d, bus: o.b, fx: 0.14 });
      B.tone({ type: 'sawtooth', f0: f * 1.005, dur: 0.28, atk: 0.020, hold: 0.06, vol: 0.11 * o.v, delay: o.d, bus: o.b });
      if (!o.lite) B.tone({ type: 'sawtooth', f0: f * 1.5, dur: 0.20, atk: 0.03, vol: 0.05 * o.v, delay: o.d, bus: o.b });
    },
    hook(B, f, o) {                                    // 갈고리 + 물에서 끌어올린다
      B.noise({ freq: 2700, q: 9, dur: 0.06, vol: 0.16 * o.v, delay: o.d, bus: o.b });
      B.tone({ type: 'sine', f0: f, f1: f * 0.80, dur: 0.30, atk: 0.006, vol: 0.14 * o.v, delay: o.d, bus: o.b, fx: 0.26 });
      if (!o.lite) {
        B.tone({ type: 'triangle', f0: f * 2, f1: f * 1.88, dur: 0.10, atk: 0.001, vol: 0.12 * o.v, delay: o.d, bus: o.b });
        B.noise({ freq: 420, freq1: 180, q: 1.2, dur: 0.22, atk: 0.02, vol: 0.08 * o.v, delay: o.d + 0.04, bus: o.b });
      }
    },
    oar(B, f, o) {                                     // 침묵의 요른 — 가장 조용한 시그니처
      B.noise({ freq: 360, freq1: 300, q: 1.4, dur: 0.42, atk: 0.09, vol: 0.10 * o.v, delay: o.d, bus: o.b, fx: 0.30 });
      B.tone({ type: 'sine', f0: f, dur: 0.50, atk: 0.10, vol: 0.09 * o.v, delay: o.d, bus: o.b, fx: 0.34 });
      if (!o.lite) B.noise({ freq: 1400, q: 3, dur: 0.08, atk: 0.03, vol: 0.03 * o.v, delay: o.d + 0.22, bus: o.b });
    },
    gavel(B, f, o) {                                   // 판결봉 — 짧고 건조하다
      B.tone({ type: 'triangle', f0: f * 2.4, f1: f * 0.8, dur: 0.055, atk: 0.0006, vol: 0.22 * o.v, delay: o.d, bus: o.b });
      B.noise({ freq: 1150, q: 3, dur: 0.045, vol: 0.15 * o.v, delay: o.d, bus: o.b, fx: 0.22 });
      if (!o.lite) B.tone({ type: 'sine', f0: f, dur: 0.16, atk: 0.001, vol: 0.12 * o.v, delay: o.d, bus: o.b });
    },
    quill(B, f, o) {                                   // 펜 — 5~7kHz 전용. 43개 SFX 중 이 대역 주력은 0개였다
      const n = o.lite ? 1 : 2;
      for (let i = 0; i < n; i++) B.noise({ freq: 5400 + i * 1200, q: 11, dur: 0.028, vol: (0.10 - i * 0.02) * o.v, delay: o.d + i * 0.035, bus: o.b });
      B.tone({ type: 'triangle', f0: f, dur: 0.12, atk: 0.004, vol: 0.07 * o.v, delay: o.d, bus: o.b });
      if (!o.lite) B.tone({ type: 'square', f0: f * 4, f1: f * 3.7, dur: 0.05, atk: 0.0008, vol: 0.05 * o.v, delay: o.d, bus: o.b, fx: 0.18 });
    },
    mace(B, f, o) {                                    // 철퇴
      B.tone({ type: 'sine', f0: f, f1: f * 0.28, dur: 0.30, atk: 0.001, vol: 0.36 * o.v, delay: o.d, bus: o.b });
      B.noise({ freq: 310, q: 0.6, dur: 0.20, vol: 0.20 * o.v, delay: o.d, bus: o.b, fx: 0.16 });
      if (!o.lite) {
        B.noise({ freq: 1900, q: 4, dur: 0.055, vol: 0.12 * o.v, delay: o.d, bus: o.b });
        B.tone({ type: 'sawtooth', f0: f * 1.5, f1: f * 0.9, dur: 0.14, atk: 0.002, vol: 0.08 * o.v, delay: o.d, bus: o.b });
      }
    },
    bell(B, f, o) {                                    // 대성당 종 — 실제 종의 비조화 부분음비
      const P = o.lite ? [[0.5, 0.28, 1.5], [1.0, 0.34, 1.1], [2.0, 0.13, 0.55]]
                       : [[0.5, 0.28, 1.5], [1.0, 0.34, 1.1], [1.19, 0.20, 0.8], [2.66, 0.11, 0.40]];
      const L = o.long ? 1.7 : 1;
      for (const p of P) B.tone({ type: 'sine', f0: f * p[0], dur: p[2] * L, atk: 0.002, vol: p[1] * 0.34 * o.v, delay: o.d, bus: o.b, fx: 0.34 });
      if (!o.lite) B.noise({ freq: 4200, q: 6, dur: 0.05, vol: 0.07 * o.v, delay: o.d, bus: o.b });
    },
    beak(B, f, o) {                                    // 부리가면 — 마스크 안의 헐떡임
      B.noise({ freq: 4600, q: 12, dur: 0.028, vol: 0.13 * o.v, delay: o.d, bus: o.b });
      B.tone({ type: 'square', f0: f, f1: f * 0.9, dur: 0.09, atk: 0.001, vol: 0.09 * o.v, delay: o.d, bus: o.b });
      if (!o.lite) {
        B.noise({ freq: 4600, q: 12, dur: 0.026, vol: 0.08 * o.v, delay: o.d + 0.055, bus: o.b });
        B.noise({ freq: 620, freq1: 420, q: 0.9, dur: 0.20, atk: 0.05, vol: 0.07 * o.v, delay: o.d + 0.03, bus: o.b });
      }
    },
    furnace(B, f, o) {                                 // 소각로 문이 열린다
      B.noise({ freq: 170, q: 0.5, dur: 0.45, atk: 0.09, vol: 0.20 * o.v, delay: o.d, bus: o.b });
      B.tone({ type: 'sawtooth', f0: f * 0.98, f1: f * 1.34, dur: 0.32, atk: 0.03, vol: 0.14 * o.v, delay: o.d, bus: o.b });
      if (!o.lite) B.noise({ freq: 2300, freq1: 900, q: 1, dur: 0.26, atk: 0.06, vol: 0.10 * o.v, delay: o.d + 0.06, bus: o.b, fx: 0.20 });
    },
    noble(B, f, o) {                                   // 근위 금관 — 판금 마찰이 섞인다
      B.tone({ type: 'sawtooth', f0: f, dur: 0.30, atk: 0.018, hold: 0.07, vol: 0.15 * o.v, delay: o.d, bus: o.b, fx: 0.18 });
      B.tone({ type: 'sawtooth', f0: f * 0.5, dur: 0.34, atk: 0.02, vol: 0.10 * o.v, delay: o.d, bus: o.b });
      if (!o.lite) {
        B.tone({ type: 'square', f0: f * 2, dur: 0.24, atk: 0.022, hold: 0.05, vol: 0.07 * o.v, delay: o.d, bus: o.b });
        B.noise({ freq: 2900, q: 4, dur: 0.06, atk: 0.01, vol: 0.05 * o.v, delay: o.d, bus: o.b });
      }
    },
    glass(B, f, o) {                                   // 별지기 — 6.4kHz↑를 주력으로 쓰는 최초의 음색
      B.tone({ type: 'sine', f0: f, dur: 0.65, atk: 0.008, vol: 0.13 * o.v, delay: o.d, bus: o.b, fx: 0.40 });
      B.tone({ type: 'sine', f0: f * 2.76, dur: 0.36, atk: 0.004, vol: 0.045 * o.v, delay: o.d, bus: o.b, fx: 0.40 });
      if (!o.lite) {
        B.tone({ type: 'sine', f0: f * 5.41, dur: 0.20, atk: 0.003, vol: 0.020 * o.v, delay: o.d, bus: o.b, fx: 0.40 });
        B.noise({ freq: 7600, q: 9, dur: 0.04, vol: 0.05 * o.v, delay: o.d, bus: o.b });
      }
    },
    hoof(B, f, o) {                                    // 말발굽 2연 + 창끝
      for (let i = 0; i < 2; i++) B.tone({ type: 'sine', f0: f * 0.62, f1: f * 0.26, dur: 0.085, atk: 0.0008, vol: 0.24 * o.v, delay: o.d + i * 0.075, bus: o.b });
      if (!o.lite) B.noise({ freq: 900, q: 2.2, dur: 0.05, vol: 0.12 * o.v, delay: o.d, bus: o.b });
      B.tone({ type: 'triangle', f0: f * 2, f1: f * 1.9, dur: 0.07, atk: 0.001, vol: 0.06 * o.v, delay: o.d + 0.15, bus: o.b });
    },
    crown(B, f, o) {                                   // 왕 — 금관 + 왕관의 종 + 서브
      B.tone({ type: 'sawtooth', f0: f, dur: 0.34, atk: 0.014, hold: 0.08, vol: 0.16 * o.v, delay: o.d, bus: o.b, fx: 0.22 });
      B.tone({ type: 'sine', f0: f * 0.5, dur: 0.42, atk: 0.006, vol: 0.16 * o.v, delay: o.d, bus: o.b });
      B.tone({ type: 'sine', f0: f * 2.38, dur: 0.50, atk: 0.003, vol: 0.05 * o.v, delay: o.d, bus: o.b, fx: 0.36 });
      if (!o.lite) {
        B.tone({ type: 'square', f0: f * 1.5, dur: 0.26, atk: 0.02, vol: 0.06 * o.v, delay: o.d, bus: o.b });
        B.noise({ freq: 3600, q: 5, dur: 0.05, atk: 0.008, vol: 0.05 * o.v, delay: o.d, bus: o.b });
      }
    },
  },

  // 음색별 게인 트림 — 오프라인 렌더로 잰 RMS를 -40~-45dB 밴드로 모은다.
  // (트림 전 실측 스프레드 16.0dB: quill -55.0 … crown -39.0 → 조용한 놈은 전투 중에 안 들린다)
  VGAIN: {
    earth: 1.25, creak: 1.30, iron: 1.35, flame: 1.85, choir: 0.90, spirit: 1.25,
    axe: 1.00, horn: 1.00, hook: 1.40, oar: 1.55, gavel: 1.95, quill: 3.40,
    mace: 1.00, bell: 0.95, beak: 2.90, furnace: 1.80, noble: 1.10, glass: 1.25,
    hoof: 1.30, crown: 1.00,
  },

  // 모티프 연주 (BGM 고스트 / 스팅어 공용)
  motifNotes(m, rootMidi, o) {
    if (!m || !AudioSys.ctx) return;
    const stepSec = o.step || 0.125;
    const fn = this.VOICE[m.v] || this.VOICE.iron;
    const trim = this.VGAIN[m.v] || 1;
    let acc = 0;
    for (let i = 0; i < m.n.length; i++) {
      const f = Music._freq(rootMidi + (m.oct || 0) + m.n[i]) * (o.dt || 1);
      fn(this, f, { v: (o.v == null ? 1 : o.v) * trim, d: (o.d || 0) + acc, b: o.b || 'sfx', lite: !!o.lite });
      acc += (m.r[i] || 2) * stepSec;
    }
  },

  // ══ 막별 편성 ═════════════════════════════════════════════════════════
  //  pat 문자 = X(강) x(보통) o(약) .(쉼)  ← 벨로시티. 기존 엔진엔 벨로시티가 없었다
  //  배열 길이를 서로 다르게(3·4·5) 둬서 **폴리미터**를 만든다:
  //  킥 4마디 × 하이햇 5마디 × 퍼커션 3마디 = 60마디(≈70~100초)가 지나야 같은 마디가 돌아온다.
  //  기존 전 테마는 4마디(≈7초)마다 완전 반복이었다.
  KITS: {
    // ── 1막 「나를 죽인 손들」: 도구가 무기가 된 사람들. 악기도 아직 사람의 도구다 ──
    a1: {
      hatType: 'highpass', hatF: 5400, hatQ: 0.7, percF: 2600, percQ: 1.4,
      pat: {
        k: ['x..x..x...x.x...', 'x..x..x...x.....', 'X..x.x....x.x..o', 'x..x..x...x.X.xx'],
        p: ['....x.......x...', '....x.......x..o', '....x...o...x...'],
        h: ['..o...x...o...x.', '..x.o.x...o...x.', '..o...x.x.o...x.', '..x...o...x.o.x.', '..o.x.x.x.o...x.'],
        a: ['x.o...x.o...x.x.', 'x.x.o...x.o...x.', 'x...o.x.x.o.x...'],
        b: ['x.......x...o...', 'x.......x.......', 'x.....o.x...x...'],
      },
      seq: [0, 1, 2, 1, 3, 2, 0, 3, 1], seqOct: [12, 12, 24, 12, 0, 24, 0, 12, 12],
      arpType: 'triangle', arpTr: 12, arpDur: 0.16, arpVol: 0.052, arpAtk: 0.004,
      bassType: 'sawtooth', bassDur: 0.30, bassAtk: 0.008, bassVol: 0.062, subVol: 0.020,
      drone: { m: 36, type: 'sawtooth', lp: 700, vol: 0.012 },
      kick(B, C, x, v) {                     // 가죽 북 — 마른 흙 위에 놓인
        B.tone({ type: 'sine', f0: 112, f1: 46, dur: 0.15, atk: 0.001, vol: 0.145 * v, delay: x.d, chain: C.kick });
        if (v > 1) B.noise({ freq: 190, q: 0.7, dur: 0.10, vol: 0.075, delay: x.d, bus: 'music' });
      },
      perc(B, C, x, v) { B.noise({ dur: 0.055, vol: 0.095 * v, delay: x.d, chain: C.perc }); },   // 삽날
      hat(B, C, x, v) { B.noise({ dur: 0.026, vol: 0.058 * v, delay: x.d, chain: C.hat }); },     // 뼈 딱
      color(B, C, x) {                       // 4마디마다 낫이 길게 긁힌다
        if (x.s === 12 && x.bar % 4 === 3) B.noise({ freq: 3100, freq1: 5600, q: 6, dur: 0.34, atk: 0.16, vol: 0.055, delay: x.d, bus: 'music', fx: 0.24 });
      },
      motifBar: 8, motifStep: 0, motifVol: 0.40, motifTr: 12,
    },
    // ── 2막 「다리와 관문」: 군대. 행진과 방패벽과 강물 ──
    a2: {
      hatType: 'highpass', hatF: 7600, hatQ: 0.7, percF: 1900, percQ: 0.9,
      pat: {
        k: ['x...x...x...x...', 'x...x..xX...x...', 'x...x...x...x.x.', 'x..xx...x...x..X'],
        p: ['....x.......x...', '....x.......x.xx', '....x...o...x...', '....x.......X.xx'],
        h: ['x.x.x.x.x.x.x.x.', 'x.x.x.x.x.xxx.x.', 'x.x.x.x.x.x.x.xx', 'x.xxx.x.x.x.x.x.', 'x.x.x.xxx.x.x.x.'],
        a: ['x...x.x...x.x...', 'x.x...x.x...x.x.', 'x...x...x.x.x.x.'],
        b: ['x...........x...', 'x.......x.......', 'x...........o...'],
      },
      seq: [0, 2, 3, 1, 0, 3, 2, 1, 3, 0, 2], seqOct: [0, 0, 0, 12, 0, 0, 12, 0, -12, 0, 0],
      arpType: 'square', arpTr: 12, arpDur: 0.11, arpVol: 0.042, arpAtk: 0.002,
      bassType: 'sawtooth', bassDur: 0.34, bassAtk: 0.010, bassVol: 0.078, subVol: 0.024,
      drone: { m: 38, type: 'sawtooth', lp: 620, vol: 0.014 },              // 다리 아래 강물
      kick(B, C, x, v) { B.tone({ type: 'sine', f0: 108, f1: 44, dur: 0.12, atk: 0.001, vol: 0.17 * v, delay: x.d, chain: C.kick }); },
      perc(B, C, x, v) { B.noise({ dur: 0.045, vol: 0.080 * v, delay: x.d, chain: C.perc }); },   // 행진 스네어
      hat(B, C, x, v) { B.noise({ dur: 0.020, vol: 0.052 * v, delay: x.d, chain: C.hat }); },
      color(B, C, x) {
        if (x.s === 0 && x.bar % 2 === 0) {                                 // 뿔나팔 — 5도 오르가눔
          B.tone({ type: 'square', f0: x.F(x.root + 12), dur: 0.42, atk: 0.020, hold: 0.08, vol: 0.055, delay: x.d, bus: 'music', fx: 0.18 });
          B.tone({ type: 'sawtooth', f0: x.F(x.root + 19), dur: 0.38, atk: 0.030, vol: 0.032, delay: x.d, bus: 'music' });
        }
        if (x.s === 14 && x.bar % 4 === 3) {                                // 방패벽이 닫힌다 (필인)
          for (let i = 0; i < 2; i++) B.noise({ freq: 2700, q: 7, dur: 0.06, vol: 0.050, delay: x.d + i * 0.055, bus: 'music' });
        }
      },
      motifBar: 8, motifStep: 0, motifVol: 0.38, motifTr: 12,
    },
    // ── 3막 「영지와 재판소」: 법. 온기가 없다. 드론이 없는 유일한 막 ──
    a3: {
      hatF: 4600, hatQ: 1.4, percF: 1150, percQ: 3,
      pat: {
        k: ['x.......x.......', 'x.......x.....o.', 'x.......x...x...'],
        p: ['x..x..x.........', 'x..x..x.....x...', 'x.......x..x..x.', 'x..x..x...x.....'],   // 갈베
        h: ['....o.......o...', '....o...o...o...', '....o.......o.o.'],
        a: ['x.x.x.x...x.x.x.', 'x.x...x.x.x.x.x.', 'x.x.x...x.x...x.', 'x...x.x.x.x.x.x.'],
        b: ['x.......x.......', 'x...........x...', 'x.......o...x...'],
      },
      seq: [0, 1, 2, 3, 2, 1, 3, 0, 2, 1, 3, 0, 1], seqOct: [0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 0, 12],
      arpType: 'square', arpTr: 24, arpDur: 0.085, arpVol: 0.040, arpAtk: 0.001,  // 하프시코드: 짧고 건조, 한 옥타브 위
      bassType: 'sawtooth', bassDur: 0.13, bassAtk: 0.002, bassVol: 0.075, subVol: 0.024,  // 피치카토
      drone: null,                                                          // ★ 침묵이 이 막의 악기다
      kick(B, C, x, v) { B.tone({ type: 'sine', f0: 88, f1: 34, dur: 0.18, atk: 0.002, vol: 0.15 * v, delay: x.d, chain: C.kick }); },
      perc(B, C, x, v) { B.VOICE.gavel(B, x.F(x.root + 24), { v: 0.52 * v, d: x.d, b: 'music', lite: true }); },
      hat(B, C, x, v) { B.noise({ dur: 0.030, vol: 0.078 * v, delay: x.d, chain: C.hat }); },
      color(B, C, x) {
        if (x.s === 0 && x.bar % 4 === 0) B.VOICE.bell(B, x.F(x.root - 5), { v: 0.30, d: x.d, b: 'music', lite: true });
      },
      motifBar: 6, motifStep: 8, motifVol: 0.42, motifTr: 12,
    },
    // ── 4막 「역병의 마을과 대성당」: 성가와 역병. 신의 이름으로 저지른 것 ──
    a4: {
      hatType: 'highpass', hatF: 6800, hatQ: 0.7, percF: 640, percQ: 0.9,
      pat: {
        k: ['x.......x.......', 'x..x....x.......', 'x.......x....x..'],    // 역병의 맥 — 두 번 뛴다
        p: ['........o.......', '..o.....o.......', '........o...o...'],    // 기침
        h: ['..o.o...o...o.o.', '..o.o...o.o.o...', 'o.o.o...o...o.o.'],
        a: ['x...x...x...x...', 'x...x.x...x.x...', 'x.....x...x...x.'],
        b: ['x...............', 'x.......o.......'],
      },
      seq: [0, 1, 3, 2, 0, 3, 1, 2, 3, 1, 0], seqOct: [0, 0, 0, 12, 0, 0, 12, 0, 0, -12, 0],
      arpType: 'sine', arpTr: 24, arpDur: 0.50, arpAtk: 0.12, arpVol: 0.052, // 성가 — 느린 어택, 긴 여운
      bassType: 'sine', bassDur: 1.70, bassAtk: 0.25, bassVol: 0.062, subVol: 0.020,  // 오르간 페달 포인트
      drone: { m: 34, type: 'sine', lp: 1100, vol: 0.014 },
      kick(B, C, x, v) { B.tone({ type: 'sine', f0: 76, f1: 32, dur: 0.22, atk: 0.004, vol: 0.17 * v, delay: x.d, chain: C.kick }); },
      perc(B, C, x, v) { B.noise({ dur: 0.13, atk: 0.02, vol: 0.055 * v, delay: x.d, chain: C.perc }); },
      hat(B, C, x, v) { B.noise({ dur: 0.060, atk: 0.012, vol: 0.070 * v, delay: x.d, chain: C.hat }); },
      color(B, C, x) {
        if (x.s === 0 && x.bar % 4 === 0) {                                 // 오르간 배음 스택
          [1, 2, 3, 5, 8].forEach((h, i) => B.tone({ type: 'sine', f0: x.F(x.root + 12) * h, dur: 1.6, atk: 0.10, vol: 0.034 / (i + 1), delay: x.d, bus: 'music', fx: 0.30 }));
        }
        if (x.s === 0 && x.bar % 8 === 4) B.VOICE.bell(B, x.F(x.root + 31), { v: 0.40, d: x.d, b: 'music' });
        if (x.s === 6 && x.bar % 4 === 1) B.noise({ freq: 2400, freq1: 3600, q: 2, dur: 0.22, atk: 0.06, vol: 0.030, delay: x.d, bus: 'music', fx: 0.30 }); // 향로 사슬
        if (x.s === 8 && x.bar % 2 === 1) {                                 // 합창 — 하행한다. 이 막에 상행하는 성가는 없다
          for (const c of [-10, 0, 6]) B.tone({ type: 'sawtooth', f0: x.F(x.root + 12), det: c, f1: x.F(x.root + 11), dur: 0.9, atk: 0.28, vol: 0.022, delay: x.d, bus: 'music', fx: 0.34 });
        }
      },
      motifBar: 6, motifStep: 0, motifVol: 0.36, motifTr: 12,
    },
    // ── 5막 「왕도와 왕좌」: 팀파니와 금관과 판금. 가장 빠르고 가장 위계적 ──
    a5: {
      hatType: 'highpass', hatF: 4400, hatQ: 0.7, percF: 2400, percQ: 1.1,
      pat: {
        k: ['x..x..x.x..x..x.', 'x..x..x.x..x.x.x', 'X..x..x.x.x...x.', 'x..x..x.x..x..XX'],
        p: ['..x...x...x...x.', '..x...x...x.x.x.', '..x.x.x...x...x.'],
        h: ['x.x.x.x.x.x.x.x.', 'x.xxx.x.x.x.x.xx', 'x.x.x.xxx.x.x.x.'],
        a: ['x.x.x...x.x.x.x.', 'x.x.x.x...x.x...', 'x...x.x.x.x.x.x.'],
        b: ['x.......x...x...', 'x.......x.......', 'x...o...x...x...'],
      },
      seq: [0, 2, 3, 1, 2, 0, 3, 2, 1], seqOct: [0, 0, 12, 0, 0, 12, 0, -12, 0],
      arpType: 'triangle', arpTr: 12, arpDur: 0.13, arpVol: 0.050, arpAtk: 0.003,
      bassType: 'sawtooth', bassDur: 0.26, bassAtk: 0.006, bassVol: 0.090, subVol: 0.032,
      drone: { m: 36, type: 'sawtooth', lp: 900, vol: 0.018 },
      kick(B, C, x, v) {                     // 팀파니 — 음정이 남는 북
        B.tone({ type: 'sine', f0: x.F(x.root) * 2, f1: x.F(x.root) * 1.55, dur: 0.22, atk: 0.002, vol: 0.15 * v, delay: x.d, chain: C.kick });
      },
      perc(B, C, x, v) { B.noise({ dur: 0.05, vol: 0.090 * v, delay: x.d, chain: C.perc }); },   // 판금
      hat(B, C, x, v) { B.noise({ dur: 0.022, vol: 0.058 * v, delay: x.d, chain: C.hat }); },
      color(B, C, x) {
        if (x.s === 0 && x.bar % 2 === 0) {                                 // 금관 3화음 (단조)
          [0, 3, 7].forEach((n) => B.tone({ type: 'sawtooth', f0: x.F(x.root + 12 + n), dur: 0.50, atk: 0.018, hold: 0.06, vol: 0.032, delay: x.d, bus: 'music', fx: 0.20 }));
        }
        if (x.s === 12 && x.bar % 4 === 3) B.noise({ freq: 3300, freq1: 7200, q: 2.5, dur: 0.12, atk: 0.01, vol: 0.060, delay: x.d, bus: 'music' });
      },
      motifBar: 8, motifStep: 0, motifVol: 0.38, motifTr: 12,
    },
    // ══ 왕 바르텐 3세 — 3페이즈 ══════════════════════════════════════════
    // p1 「국왕 검술」: 아직 음악이 온전하다. 격식·규칙적 리듬·명확한 단조.
    //                  붕괴할 여지를 여기서 만들어 둔다.
    k1: {
      hatF: 4200, hatQ: 1.3, percF: 2400, percQ: 2,
      pat: {
        k: ['x.......x.......', 'x.......x.....o.', 'x.......x...x...'],
        p: ['........x.......', '........x.....o.'],
        h: ['....x.......x...', '....x.......x.x.', '....x...x...x...'],
        a: ['x...x...x...x...', 'x...x.....x.x...', 'x...x...x...x.x.'],
        b: ['x.......x.......', 'x...............'],
      },
      seq: [0, 1, 2, 3, 2, 1, 0], seqOct: [0, 0, 12, 0, 0, 12, 0],
      arpType: 'triangle', arpTr: 12, arpDur: 0.14, arpVol: 0.048, arpAtk: 0.003,
      bassType: 'sawtooth', bassDur: 0.32, bassAtk: 0.008, bassVol: 0.095, subVol: 0.028,
      drone: { m: 36, type: 'sawtooth', lp: 950, vol: 0.018 },
      kick(B, C, x, v) { B.tone({ type: 'sine', f0: x.F(x.root) * 2, f1: x.F(x.root) * 1.5, dur: 0.24, atk: 0.002, vol: 0.16 * v, delay: x.d, chain: C.kick }); },
      perc(B, C, x, v) { B.noise({ dur: 0.05, vol: 0.072 * v, delay: x.d, chain: C.perc }); },
      hat(B, C, x, v) { B.noise({ dur: 0.024, vol: 0.082 * v, delay: x.d, chain: C.hat }); },
      color(B, C, x) {
        if (x.s === 0 && x.bar % 2 === 0) {                                 // 금관 팡파레 + 현
          [0, 3, 7].forEach((n) => B.tone({ type: 'sawtooth', f0: x.F(x.root + 24 + n), dur: 0.70, atk: 0.030, hold: 0.10, vol: 0.055, delay: x.d, bus: 'music', fx: 0.22 }));
          for (const c of [-7, 7]) B.tone({ type: 'sawtooth', f0: x.F(x.root + 19), det: c, dur: 2.0, atk: 0.55, vol: 0.050, delay: x.d, bus: 'music', fx: 0.30 });
          for (const c of [-5, 5]) B.tone({ type: 'sawtooth', f0: x.F(x.root + 31), det: c, dur: 1.8, atk: 0.60, vol: 0.030, delay: x.d, bus: 'music', fx: 0.32 });
        }
      },
      motifBar: 8, motifStep: 0, motifVol: 0.44, motifTr: 12,
    },
    // p2 「성배 폭주」: 지나온 막들의 음색이 유령처럼 섞인다 —
    //                  1막의 늪 저역, 3막의 갈베, 4막의 오르간·합창이 왕의 곡 안에서 동시에 운다.
    //                  ("네놈들의 원한이 이런 모습이더냐")
    k2: {
      hatType: 'highpass', hatF: 5600, hatQ: 0.7, percF: 2000, percQ: 1.6,
      pat: {
        k: ['x..xx...x..xx...', 'x..xx...x..xx..X', 'x.x.x...x..x..x.', 'x..xx...x.x.x...'],
        p: ['....x.......x...', '....x...o...x.x.', '..x.x.......x...'],
        h: ['x...x.x.x...x.x.', 'x.x.x...x.x.x.x.', 'x...x.x.x.x.x...', 'x.x.x.x...x.x.x.', 'x...x...x.x.x.x.'],
        a: ['x.x.x...x.x.x...', 'x.x.x...x...x.x.', 'x...x.x...x.x...'],
        b: ['x.......x...x...', 'x...x...x.......', 'x.......x...o.x.'],
      },
      seq: [0, 3, 1, 2, 3, 0, 2, 1, 3, 2, 0], seqOct: [0, 0, 12, 0, -12, 12, 0, 0, 12, 0, -12],
      arpType: 'sawtooth', arpTr: 12, arpDur: 0.12, arpVol: 0.044, arpAtk: 0.002,
      arp2: 3,                                                              // 2성 — 3도 위가 겹친다 (전용 체인)
      bassType: 'sawtooth', bassDur: 0.28, bassAtk: 0.004, bassVol: 0.085, subVol: 0.024,
      drone: { m: 34, type: 'sawtooth', lp: 800, vol: 0.015 },
      kick(B, C, x, v) {
        B.tone({ type: 'sine', f0: 122, f1: 46, dur: 0.14, atk: 0.001, vol: 0.135 * v, delay: x.d, chain: C.kick });
      },
      perc(B, C, x, v) { B.noise({ dur: 0.055, vol: 0.075 * v, delay: x.d, chain: C.perc }); },
      hat(B, C, x, v) { B.noise({ dur: 0.022, vol: 0.055 * v, delay: x.d, chain: C.hat }); },
      color(B, C, x) {
        if (x.s === 0 && x.bar % 2 === 0) {                                 // 4막의 오르간이 왕의 곡에 들어온다
          [1, 2, 3].forEach((h, i) => B.tone({ type: 'sine', f0: x.F(x.root + 12) * h, dur: 1.3, atk: 0.09, vol: 0.026 / (i + 1), delay: x.d, bus: 'music', fx: 0.30 }));
        }
        if (x.s === 8 && x.bar % 2 === 1) {                                 // 4막의 합창
          for (const c of [-10, 0, 6]) B.tone({ type: 'sawtooth', f0: x.F(x.root + 12), det: c, dur: 0.8, atk: 0.22, vol: 0.020, delay: x.d, bus: 'music', fx: 0.34 });
        }
        if (x.s === 6 && x.bar % 4 === 2) B.VOICE.gavel(B, x.F(x.root + 24), { v: 0.30, d: x.d, b: 'music', lite: true }); // 3막의 갈베
        if (x.s === 12 && x.bar % 4 === 1) B.noise({ freq: 200, freq1: 120, q: 0.6, dur: 0.30, atk: 0.10, vol: 0.045, delay: x.d, bus: 'music' }); // 1막의 늪
      },
      motifBar: 6, motifStep: 0, motifVol: 0.46, motifTr: 12,
    },
    // p3 「분리 발악」: 조성이 무너진다. 마디마다 전체 피치가 7센트씩 내려가고(성배가 식는다),
    //                  타악 패턴 길이가 5·7·3으로 갈라져 박자가 자기 자신과 어긋난다.
    k3: {
      hatType: 'highpass', hatF: 6800, hatQ: 0.7, percF: 2200, percQ: 1.3,
      pat: {
        k: ['X..x..x.X..x..x.', 'x.x.x...X....x.x', 'X.x....xx..x....', 'x..x..x.x..x...X', 'X.x....xx.x...x.'],
        p: ['..x.....x.x.....', '..x.x...x.......', '..x.....x.x.....', '..xx....x.x.....', '..x....xx.x.....', '..x.....x.x.x...', '..xx..x.x.x.....'],
        h: ['x...x...x...x...', 'x.x.x...x...x...', 'x...x...x.x.x...'],
        a: ['x.x.x...x.x.....', 'x.x.....x...x.x.', 'x.x.x.....x.....', 'x.x.x...x.x.x...'],
        b: ['x...x...x...x...', 'x...x.x.x...x...', 'x.x.x...x...x.x.'],
      },
      seq: [0, 3, 2, 1, 3, 0, 1, 2, 3, 1, 0, 2, 3], seqOct: [0, 12, -12, 0, 24, 0, -12, 12, 0, 0, 12, -12, 0],
      arpType: 'sawtooth', arpTr: 12, arpDur: 0.10, arpVol: 0.046, arpAtk: 0.001,
      arp2: 6,                                                              // 2성이 삼온음으로 갈라진다
      bassType: 'square', bassDur: 0.22, bassAtk: 0.002, bassVol: 0.085, subVol: 0.026,
      drone: { m: 33, type: 'sawtooth', lp: 760, vol: 0.016 },
      kick(B, C, x, v) {
        B.tone({ type: 'sine', f0: 132, f1: 44, dur: 0.13, atk: 0.001, vol: 0.135 * v, delay: x.d, chain: C.kick });
      },
      perc(B, C, x, v) { B.noise({ dur: 0.06, vol: 0.075 * v, delay: x.d, chain: C.perc }); },
      hat(B, C, x, v) { B.noise({ dur: 0.020, vol: 0.056 * v, delay: x.d, chain: C.hat }); },
      color(B, C, x) {
        if (x.s === 0 && x.bar % 2 === 0) {                                 // 금관이 반음 어긋난 채 겹친다
          [0, 1, 6, 7].forEach((n) => B.tone({ type: 'sawtooth', f0: x.F(x.root + 12 + n), dur: 0.45, atk: 0.014, vol: 0.026, delay: x.d, bus: 'music', fx: 0.24 }));
        }
        if (x.s === 0 && x.bar % 4 === 2) {                                 // 종에 금이 간다 (부분음 + 잡음)
          B.VOICE.bell(B, x.F(x.root + 7), { v: 0.30, d: x.d, b: 'music', lite: true });
          B.noise({ freq: 4600, freq1: 2200, q: 4, dur: 0.35, atk: 0.02, vol: 0.045, delay: x.d, bus: 'music', fx: 0.3 });
        }
        if (x.s === 14 && x.bar % 4 === 2) {                                // 32분 스네어 롤 필인
          for (let i = 0; i < 3; i++) B.noise({ freq: 2400, q: 1.4, dur: 0.03, vol: 0.038 + i * 0.012, delay: x.d + i * 0.028, bus: 'music' });
        }
      },
      motifBar: 4, motifStep: 0, motifVol: 0.50, motifTr: 12,
    },
  },

  // ══ 지속 체인 — 음마다 Gain·Biquad를 새로 만들지 않는다 ══════════════
  //  노트당 노드 생성이 2~3개 → 1개로 준다 (실측 근거: 노드 생성률이 CPU 대리지표).
  //  단, 체인은 모노포닉이다: 같은 체인에 겹치는 음을 넣지 마라 (패턴상 겹치지 않는다).
  ensureChains(kitKey, kit) {
    if (this._chainKey === kitKey && this._chains) return this._chains;
    this.releaseChains();
    const ctx = AudioSys.ctx;
    if (!ctx) return null;
    const dest = AudioSys.musicBus || AudioSys.master;
    if (!dest) return null;
    const mk = (fType, freq, q) => {
      const g = ctx.createGain(); g.gain.value = 0.0006; g.connect(dest);
      if (!fType) return { in: g, gain: g };
      const f = ctx.createBiquadFilter(); f.type = fType; f.frequency.value = freq; f.Q.value = q;
      f.connect(g); return { in: f, gain: g };
    };
    const C = {
      kick: mk(), sub: mk(), bass: mk(), arp: mk(), arp2: mk(),
      hat: mk(kit.hatType || 'bandpass', kit.hatF || 6200, kit.hatQ || 2),
      perc: mk('bandpass', kit.percF || 1900, kit.percQ || 1.2),
    };
    if (kit.drone) {                       // 지속 드론: 시작 1회, 이후 노드 생성 0
      const o = ctx.createOscillator(); o.type = kit.drone.type || 'sawtooth';
      o.frequency.value = Music._freq(kit.drone.m);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = kit.drone.lp || 400; lp.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.value = 0.0001;
      o.connect(lp); lp.connect(g); g.connect(dest);
      o.start();
      g.gain.linearRampToValueAtTime(kit.drone.vol, ctx.currentTime + 1.8);   // 서서히 차오른다
      C.drone = { osc: o, gain: g, lp: lp };
    }
    this._chains = C; this._chainKey = kitKey;
    return C;
  },
  releaseChains() {
    const C = this._chains;
    this._chains = null; this._chainKey = null;
    if (!C || !AudioSys.ctx) return;
    const t = AudioSys.ctx.currentTime;
    if (C.drone) {
      try {
        C.drone.gain.gain.cancelScheduledValues(t);
        C.drone.gain.gain.setValueAtTime(Math.max(0.0002, C.drone.gain.gain.value), t);
        C.drone.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        C.drone.osc.stop(t + 0.6);
      } catch (e) { /* 이미 정지 */ }
    }
    setTimeout(() => {
      for (const k in C) {
        const n = C[k];
        try { (n.gain || n).disconnect(); } catch (e) { /* noop */ }
        try { if (n.in && n.in !== n.gain) n.in.disconnect(); } catch (e) { /* noop */ }
        try { if (n.lp) n.lp.disconnect(); } catch (e) { /* noop */ }
      }
    }, 900);
  },

  // ══ 보스 테마 시퀀서 (Music._schedule 에서 위임받는다) ════════════════
  scheduleBoss(t, th, step, delay) {
    const kit = this.KITS[th.bossKit];
    if (!kit) return;
    const C = this.ensureChains(th.bossKit, kit);
    if (!C) return;
    const s = ((step % 16) + 16) % 16;
    const bar = Math.floor(step / 16);
    const root = th.roots[bar % th.roots.length];
    // 조성 붕괴 (왕 3페이즈 전용): 8마디에 걸쳐 전체 피치가 내려갔다 되돌아온다 — 성배가 식는다
    const dt = th.drift ? Math.pow(2, -((bar % 8) * th.drift) / 1200) : 1;
    const F = (m) => Music._freq(m) * dt;
    const V = (p, i) => { const c = p[bar % p.length][i]; return c === 'X' ? 1.35 : c === 'x' ? 1.0 : c === 'o' ? 0.55 : 0; };
    const st = this.stage;                       // 1 평상 / 2 격노 / 3 맹공
    const boost = st >= 3 ? 1.30 : st >= 2 ? 1.14 : 1;
    // ★ 예산 연동 (사양서 §7-1-2) — 왕 p3가 42~47노드/초로 예산 위쪽에 있고, 그 구간에
    //   광역기 SFX가 겹치면 초과한다. **킥·베이스·모티프는 절대 버리지 않는다.**
    //   버리는 순서: 장식(color) → 하이햇 → 퍼커션
    const M = (typeof Music !== 'undefined' && Music._afford) ? Music : null;
    const lean0 = M ? !M._afford(0, t) : false;
    const lean1 = M ? !M._afford(1, t) : false;
    const x = { s: s, bar: bar, root: root, F: F, d: delay, th: th, kit: kit, st: st };

    // 베이스 + 서브
    const bv = V(kit.pat.b, s);
    if (bv) {
      this.tone({ type: kit.bassType || 'sawtooth', f0: F(root), dur: kit.bassDur || 0.30, atk: kit.bassAtk || 0.006,
        vol: (kit.bassVol || 0.085) * bv * boost, delay: delay, chain: C.bass });
      this.tone({ type: 'sine', f0: F(root - 12), dur: (kit.bassDur || 0.30) * 1.1, atk: 0.004,
        vol: (kit.subVol || 0.070) * bv * boost, delay: delay, chain: C.sub });
    }
    // 아르페지오 — 선율 시퀀스 길이(7·9·11·13)가 16과 서로소라 리듬에 대해 위상이 어긋난다.
    // 같은 마디가 60마디에 한 번밖에 안 돌아온다 (기존: 4마디마다 완전 반복)
    const av = V(kit.pat.a, s);
    if (av) {
      const i = (bar * 16 + s) % kit.seq.length;
      const deg = th.scale[kit.seq[i] % th.scale.length];
      const oc = kit.seqOct[i % kit.seqOct.length];
      const tr = kit.arpTr == null ? 12 : kit.arpTr;
      this.tone({ type: kit.arpType || 'triangle', f0: F(root + tr + deg + oc), dur: kit.arpDur || 0.15,
        atk: kit.arpAtk || 0.003, vol: (kit.arpVol || 0.05) * av * boost, delay: delay, chain: C.arp });
      if (kit.arp2) {                            // 2성 (왕 p2·p3 전용) — 전용 체인이라 음당 노드 1개
        this.tone({ type: kit.arpType || 'triangle', f0: F(root + tr + deg + oc + kit.arp2), dur: (kit.arpDur || 0.15) * 0.8,
          atk: 0.004, vol: (kit.arpVol || 0.05) * av * 0.55 * boost, delay: delay, chain: C.arp2 });
      }
    }
    // 타악 — 킷마다 다른 음원. 보스곡의 킥과 1층 킥이 같은 음원이던 것이 밋밋함의 큰 축이었다
    const kv = V(kit.pat.k, s); if (kv && kit.kick) kit.kick(this, C, x, kv * boost);
    const pv = V(kit.pat.p, s); if (pv && kit.perc && !lean1) kit.perc(this, C, x, pv * boost);
    let hv = V(kit.pat.h, s); if (hv && kit.hat && !lean0) kit.hat(this, C, x, hv);
    // 격노·맹공 반응 (테마 교체 없이 23종 전부에 걸린다)
    if (st >= 3 && !hv && s % 4 === 1 && kit.hat && !lean0) kit.hat(this, C, x, 0.6);   // 하이햇 배속 (8분 뒷박)
    if (st >= 2 && s === 14 && bar % 2 === 1 && kit.kick) kit.kick(this, C, x, 0.8);

    // 막 고유 악기 (호른·종·오르간·갈베·금관) — 항상 독립 노드. 마디당 1~2회라 비용이 낮다
    if (kit.color && !lean1) kit.color(this, C, x);

    // 모티프 고스트 — 이 보스의 이름이 곡 안에서 조용히 울린다.
    // 막 테마 5곡이지만 23종이 서로 다르게 들리는 이유가 이 한 블록이다.
    if (s === (kit.motifStep == null ? 0 : kit.motifStep) && (bar % (kit.motifBar || 8)) === 0) {
      const m = this.motifFor(this.activeDefId, th.kingPhase);
      this.motifNotes(m, root + (kit.motifTr || 12), {
        v: (kit.motifVol || 0.4) * (st >= 3 ? 1.25 : 1), d: delay, b: 'music', lite: true,
        step: 60 / th.bpm / 4, dt: dt,
      });
    }
  },

  // ══ 공개 API ══════════════════════════════════════════════════════════
  // 1) 지금 어떤 곡을 틀 것인가 — main.js _musicKey()의 보스 분기가 이것만 부른다
  musicKey(boss) {
    const id = boss.defId;
    if (this.activeDefId !== id) { this.activeDefId = id; this.stage = 1; }
    let k;
    if (id === 50) k = 'bossKingP' + (boss._onslaught ? 3 : boss.phase >= 2 ? 2 : 1);
    else k = 'bossA' + this.actOf(id);
    return Music.themes[k] ? k : 'boss';        // 안전망: 테마가 없으면 구 보스곡
  },

  // 2) 등장 — 막마다 다른 위압, 그 뒤 이 보스의 이름(모티프)
  entrance(defId) {
    if (!AudioSys.ctx || AudioSys.muted) return;
    this.activeDefId = defId; this.stage = 1; this.silentUntil = 0;
    this._dread(this.actOf(defId), defId);
    this.motifNotes(this.motifFor(defId), this.motifRoot(defId),
      { v: defId === 50 ? 1.1 : 1.0, d: defId === 50 ? 1.5 : 1.05, b: 'sfx', step: 0.15 });
  },

  _dread(act, defId) {
    const B = this;
    // 공통 — 바닥이 꺼지는 초저역. 기존 bossAppear()의 언어를 유지한다 ("보스가 왔다"는 이미 학습된 소리다)
    B.tone({ type: 'sine', f0: 58, f1: 21, dur: 1.45, atk: 0.020, vol: 0.70, bus: 'sfx', fx: 0.25 });
    B.tone({ type: 'sawtooth', f0: 97, f1: 48.5, dur: 1.10, atk: 0.25, vol: 0.24, bus: 'sfx' });
    B.tone({ type: 'sawtooth', f0: 103, f1: 51.5, dur: 1.10, atk: 0.25, vol: 0.24, bus: 'sfx' });   // 단2도 클러스터
    if (defId === 50) {                                    // 왕 — 다섯 막이 한꺼번에 들어온다
      B.noise({ freq: 220, freq1: 110, q: 0.6, dur: 0.9, atk: 0.35, vol: 0.18, bus: 'sfx' });
      B.VOICE.bell(B, 110, { v: 1.0, d: 0.25, b: 'sfx', long: true });
      for (const c of [-11, 0, 7, 14]) B.tone({ type: 'sawtooth', f0: 87, det: c, dur: 1.8, atk: 0.60, vol: 0.070, delay: 0.30, bus: 'sfx', fx: 0.35 });
      for (let i = 0; i < 8; i++) B.tone({ type: 'sine', f0: 96, f1: 74, dur: 0.16, atk: 0.002, vol: 0.09 + i * 0.026, delay: 0.55 + i * 0.070, bus: 'sfx' });
      [0, 3, 7].forEach((n) => B.tone({ type: 'sawtooth', f0: Music._freq(45 + n), dur: 0.70, atk: 0.02, hold: 0.12, vol: 0.13, delay: 1.15, bus: 'sfx', fx: 0.22 }));
      B.tone({ type: 'sine', f0: 44, f1: 26, dur: 1.1, atk: 0.004, vol: 0.55, delay: 1.15, bus: 'sfx' });
      return;
    }
    if (act === 1) {                                       // 흙이 무너지고 낫이 긁히고 관 뚜껑이 닫힌다
      B.noise({ freq: 240, freq1: 120, q: 0.6, dur: 0.90, atk: 0.35, vol: 0.26, bus: 'sfx' });
      B.noise({ freq: 2900, freq1: 5200, q: 6, dur: 0.50, atk: 0.30, vol: 0.12, bus: 'sfx' });
      B.tone({ type: 'triangle', f0: 150, f1: 62, dur: 0.50, atk: 0.001, vol: 0.34, delay: 0.95, bus: 'sfx' });
      B.noise({ freq: 420, q: 0.8, dur: 0.35, vol: 0.24, delay: 0.95, bus: 'sfx', fx: 0.30 });
    } else if (act === 2) {                                // 방패벽이 3단으로 닫히고 나팔이 분다
      for (let i = 0; i < 3; i++) {
        B.noise({ freq: 2700, q: 7, dur: 0.09, vol: 0.20 - i * 0.03, delay: 0.20 + i * 0.16, bus: 'sfx' });
        B.tone({ type: 'triangle', f0: 1350, f1: 760, dur: 0.12, atk: 0.001, vol: 0.13, delay: 0.20 + i * 0.16, bus: 'sfx', fx: 0.24 });
      }
      B.tone({ type: 'square', f0: 82, dur: 0.55, atk: 0.03, hold: 0.12, vol: 0.26, delay: 0.75, bus: 'sfx' });
      B.tone({ type: 'sawtooth', f0: 123, dur: 0.50, atk: 0.04, hold: 0.10, vol: 0.16, delay: 0.75, bus: 'sfx', fx: 0.18 });
      B.noise({ freq: 180, q: 0.5, dur: 0.80, atk: 0.30, vol: 0.14, bus: 'sfx' });                 // 다리 아래 강물
    } else if (act === 3) {                                // 법정 문이 닫히고 판결봉이 세 번, 그리고 종
      B.noise({ freq: 110, q: 0.5, dur: 1.00, atk: 0.02, vol: 0.30, bus: 'sfx', fx: 0.28 });
      for (let i = 0; i < 3; i++) B.VOICE.gavel(B, 220, { v: 1.0, d: 0.45 + i * 0.22, b: 'sfx' });
      B.VOICE.bell(B, 92, { v: 0.90, d: 1.00, b: 'sfx', long: true });
    } else if (act === 4) {                                // 대성당 종 + 합창 스웰 (역행하는 성가)
      B.VOICE.bell(B, 118, { v: 1.10, d: 0.05, b: 'sfx', long: true });
      for (const c of [-11, 0, 7, 14]) B.tone({ type: 'sawtooth', f0: 87, f1: 82, det: c, dur: 1.50, atk: 0.55, vol: 0.075, bus: 'sfx', fx: 0.35 });
      B.tone({ type: 'sine', f0: 58, dur: 1.60, atk: 0.40, vol: 0.14, bus: 'sfx' });
      B.noise({ freq: 5200, q: 8, dur: 0.60, atk: 0.40, vol: 0.05, bus: 'sfx' });                  // 향로 사슬
    } else {                                               // 5막 — 팀파니 롤 + 단조 금관
      for (let i = 0; i < 7; i++) B.tone({ type: 'sine', f0: 96, f1: 74, dur: 0.16, atk: 0.002, vol: 0.10 + i * 0.028, delay: i * 0.075, bus: 'sfx' });
      [0, 3, 7].forEach((n) => B.tone({ type: 'sawtooth', f0: Music._freq(45 + n), dur: 0.55, atk: 0.02, hold: 0.10, vol: 0.13, delay: 0.72, bus: 'sfx', fx: 0.20 }));
      B.tone({ type: 'square', f0: Music._freq(33), dur: 0.70, atk: 0.02, vol: 0.16, delay: 0.72, bus: 'sfx' });
      B.noise({ freq: 3200, q: 4, dur: 0.12, atk: 0.01, vol: 0.10, delay: 0.70, bus: 'sfx' });     // 판금
    }
  },

  // 3) 페이즈 전환 — 리저 → 임팩트 → 반음 올라간 이름. 왕만 곡이 바뀌고, 나머지 22종은 stage로 반응한다
  phase(boss, n) {
    if (!AudioSys.ctx || AudioSys.muted) return;
    this.stage = Math.max(this.stage, n);
    const id = boss.defId;
    this.noise({ freq: 300, freq1: 5200, q: 0.8, dur: 0.85, atk: 0.50, vol: 0.24, bus: 'sfx' });          // 상승 리저
    this.tone({ type: 'sawtooth', f0: 70, f1: 190, dur: 0.80, atk: 0.40, vol: 0.20, bus: 'sfx' });
    this.tone({ type: 'sine', f0: 150, f1: 26, dur: 0.55, atk: 0.001, vol: 0.55, delay: 0.82, bus: 'sfx', fx: 0.30 });  // 임팩트
    this.noise({ freq: 380, q: 0.5, dur: 0.50, vol: 0.30, delay: 0.82, bus: 'sfx' });
    const m = this.motifFor(id, id === 50 ? n : 0);
    const up = n >= 3 ? 3 : 1;                                                                             // 같은 놈, 더 나쁜 놈
    this.motifNotes({ v: m.v, n: m.n.map((k) => k + up), r: m.r, oct: m.oct },
      this.motifRoot(id), { v: 0.90, d: 0.86, b: 'sfx', step: 0.13 });
  },

  // 4) 처치 — 모티프 역행 + 반음 아래 + 한 옥타브 아래. 이름이 무너지는 소리
  fall(defId) {
    if (!AudioSys.ctx || AudioSys.muted) return;
    const act = this.actOf(defId), B = this;
    const m = this.motifFor(defId, defId === 50 ? 3 : 0);
    this.motifNotes({ v: m.v, n: m.n.slice().reverse().map((k) => k - 1), r: m.r.slice().reverse(), oct: (m.oct || 0) - 12 },
      this.motifRoot(defId), { v: 0.95, d: 0.30, b: 'sfx', step: 0.20, lite: true });
    if (defId === 50) {                                    // 왕 — 성배가 식는다. 모든 것이 아래로 미끄러진다
      B.VOICE.bell(B, 110, { v: 0.9, d: 0.05, b: 'sfx', long: true });
      B.noise({ freq: 4600, freq1: 900, q: 4, dur: 1.6, atk: 0.05, vol: 0.16, bus: 'sfx', fx: 0.35 });     // 종에 금이 간다
      for (const c of [0, -20, -45, -75]) B.tone({ type: 'sawtooth', f0: 87, f1: 62, det: c, dur: 2.6, atk: 0.30, vol: 0.070, delay: 0.4, bus: 'sfx', fx: 0.40 });
      B.tone({ type: 'sine', f0: 52, f1: 19, dur: 3.0, atk: 0.10, vol: 0.50, delay: 0.4, bus: 'sfx' });
    } else if (act === 1) {                                // 흙과 나무가 무너진다
      B.noise({ freq: 300, freq1: 90, q: 0.5, dur: 1.0, atk: 0.03, vol: 0.42, bus: 'sfx', fx: 0.30 });
      B.tone({ type: 'triangle', f0: 130, f1: 48, dur: 0.55, atk: 0.002, vol: 0.40, delay: 0.14, bus: 'sfx' });
    } else if (act === 2) {                                // 방패가 떨어지고 물이 삼킨다
      B.noise({ freq: 2500, freq1: 700, q: 3, dur: 0.5, atk: 0.004, vol: 0.36, bus: 'sfx' });
      B.noise({ freq: 260, freq1: 120, q: 0.7, dur: 1.2, atk: 0.15, vol: 0.34, delay: 0.25, bus: 'sfx', fx: 0.35 });
    } else if (act === 3) {                                // 판결봉이 한 번 더 — 이번엔 그를 향해
      B.VOICE.gavel(B, 180, { v: 2.1, d: 0.60, b: 'sfx' });
      B.noise({ freq: 900, freq1: 300, q: 1.0, dur: 0.9, atk: 0.05, vol: 0.34, delay: 0.62, bus: 'sfx', fx: 0.32 });
      B.tone({ type: 'sine', f0: 96, f1: 34, dur: 0.7, atk: 0.002, vol: 0.34, delay: 0.62, bus: 'sfx' });
    } else if (act === 4) {                                // 종이 깨지고 성가가 끊긴다
      B.VOICE.bell(B, 96, { v: 1.3, d: 0.05, b: 'sfx', long: true });
      B.noise({ freq: 3800, freq1: 1100, q: 3, dur: 0.9, atk: 0.02, vol: 0.26, delay: 0.1, bus: 'sfx', fx: 0.35 });
      for (const c of [-11, 0, 9]) B.tone({ type: 'sawtooth', f0: 87, f1: 70, det: c, dur: 1.4, atk: 0.06, vol: 0.090, delay: 0.15, bus: 'sfx', fx: 0.32 });
    } else {                                               // 5막 — 갑옷이 무너지고 팀파니가 한 번
      B.noise({ freq: 3000, freq1: 800, q: 2.5, dur: 0.7, atk: 0.005, vol: 0.38, bus: 'sfx' });
      B.tone({ type: 'sine', f0: 92, f1: 40, dur: 0.9, atk: 0.002, vol: 0.46, delay: 0.30, bus: 'sfx', fx: 0.28 });
    }
    this.silentUntil = AudioSys.ctx.currentTime + (defId === 50 ? 4.2 : 2.6);
    this.activeDefId = null; this.stage = 1;
  },

  // 보스가 쓰러진 뒤의 정적이 아직 끝나지 않았는가 — main.js _musicKey()가 이것만 본다
  inSilence() { return !!(AudioSys.ctx && this.silentUntil > AudioSys.ctx.currentTime); },

  // 5) 고유기/인장기 — 이름이 기술과 함께 운다
  motif(defId, opt) {
    opt = opt || {};
    if (!AudioSys.ctx || AudioSys.muted || defId == null) return;
    if (!opt.force && !AudioSys._gate('bossMotif', opt.gate || 650, 1)) return;
    const m = this.motifFor(defId, opt.phase || 0);
    this.motifNotes(m, this.motifRoot(defId), {
      v: opt.vol == null ? 0.85 : opt.vol, d: opt.delay || 0, b: 'sfx',
      lite: opt.lite !== undefined ? opt.lite : true, step: opt.step || 0.125,
    });
  },
};

// ══ 보스 테마 8종 ═══════════════════════════════════════════════════════
// roots 8마디 = 화성 진행이 두 배 길다. 리듬 폴리미터(4·3·5)와 선율 위상(7·9·11·13)이 겹쳐
// "같은 마디"가 돌아오기까지 60마디 이상 걸린다. 기존 12테마는 전부 4마디였다.
// 구 'boss' 테마는 지우지 않는다 — musicKey()의 안전망이 그것을 가리킨다.
Object.assign(Music.themes, {
  // 1막 「나를 죽인 손들」 — 무덤으로 내려가는 반음 하강. 프리지안 + 삼온음
  bossA1: { bpm: 128, roots: [36, 36, 35, 34, 36, 36, 33, 34], scale: [0, 1, 5, 6], bossKit: 'a1' },
  // 2막 「다리와 관문」 — 행진. 에올리안(군가의 조성)
  bossA2: { bpm: 138, roots: [38, 38, 36, 41, 38, 38, 43, 36], scale: [0, 2, 3, 7], bossKit: 'a2' },
  // 3막 「영지와 재판소」 — 느리고 냉정하다. 재판은 서두르지 않는다. 증음정으로 이질감
  bossA3: { bpm: 112, roots: [33, 33, 32, 31, 33, 33, 28, 31], scale: [0, 1, 4, 8], bossKit: 'a3' },
  // 4막 「역병의 마을과 대성당」 — 가장 느리다. 성가의 템포에 역병의 맥이 얹힌다
  bossA4: { bpm: 100, roots: [34, 34, 33, 29, 34, 34, 27, 29], scale: [0, 1, 5, 8], bossKit: 'a4' },
  // 5막 「왕도와 왕좌」 — 가장 빠르다. 단조 금관과 말발굽
  bossA5: { bpm: 148, roots: [36, 36, 41, 39, 36, 36, 34, 39], scale: [0, 3, 7, 10], bossKit: 'a5' },
  // 왕 p1 「국왕 검술」 — 아직 온전한 단조. 격식이 있다
  bossKingP1: { bpm: 118, roots: [36, 36, 43, 41, 36, 36, 38, 41], scale: [0, 3, 7, 10], bossKit: 'k1', kingPhase: 1 },
  // 왕 p2 「성배 폭주」 — 삼온음이 침투한다. 지나온 막들의 음색이 섞인다
  bossKingP2: { bpm: 150, roots: [36, 36, 42, 41, 36, 35, 42, 40], scale: [0, 3, 6, 10], bossKit: 'k2', kingPhase: 2 },
  // 왕 p3 「분리 발악」 — 루트가 반음씩 어긋나고, 마디마다 전체 피치가 7센트 내려간다 (성배가 식는다)
  bossKingP3: { bpm: 168, roots: [36, 35, 37, 34, 33, 35, 36, 32], scale: [0, 1, 6, 7], bossKit: 'k3', kingPhase: 3, drift: 7 },
});
