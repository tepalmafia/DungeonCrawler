// ══════════════════════════════════════════════════════════════════════════
//  소리 — WebAudio 로 **만들어 낸다.** 소리 파일을 안 쓴다.
//
//  ★ 왜 파일이 아니라 합성인가
//    ① 이 작업 환경은 소리를 내려받을 수 없다 (프록시가 막는다 — 무늬와
//       같은 사정이다).
//    ② 이 게임의 소리는 **계속 변한다.** 경보 간격이 거리에 따라 촘촘해지고,
//       배가 열에 따라 앓는다. 파일을 틀어서는 그게 안 된다.
//    ③ 그리고 이건 `core/models.js` 의 코드 도형과 같은 자리다 —
//       **진짜 소리가 오면 걷어낸다.** 지금은 통로를 뚫어 두는 것이다.
//
//  ★ 시각을 밖에서 받는다 (`at`)
//    모든 함수가 「언제」를 인자로 받고, 기본값만 지금이다. 이유는 검사다 —
//    `OfflineAudioContext` 에 같은 코드를 태워 **실제로 나온 소리의 크기**를
//    재려면 시각을 앞당겨 예약할 수 있어야 한다. 검사용 코드를 따로 만들면
//    검사는 통과하는데 게임은 안 나는 상태가 생긴다. 그게 제일 나쁘다.
//
//  ★ 프레임에 박자를 매지 않는다
//    경보를 매 프레임 「지금 울릴 때인가」로 판단하면 프레임이 흔들릴 때
//    박자가 흔들린다. 급한 게 아니라 **고장 난 것으로 들린다.**
//    그래서 앞질러 예약한다 (lookahead).
// ══════════════════════════════════════════════════════════════════════════
import { MIX, BED, CHASE_SND, HAND, ESCAPE, RATTLE, RADAR_SND, STRUCT, MINE } from '../game/audio-table.js';

/** 얼마나 앞질러 예약하나. 프레임이 이보다 늦어도 박자가 안 끊긴다 */
const LOOKAHEAD = 0.35;

const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));

/**
 * 소리 한 벌. `ctx` 를 밖에서 넣을 수 있다 — 검사가 OfflineAudioContext 를 준다.
 */
export function makeAudio(ctx = new (window.AudioContext || window.webkitAudioContext)()) {
  const gain = (v, to) => { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
  const ramp = (p, v, at, tau = 0.09) => p.setTargetAtTime(v, at, tau);

  // ── 버스 ────────────────────────────────────────────────
  // duck 아래에 있는 것은 뿌리칠 때 **통째로 줄어든다.**
  // 보상음(chime)만 그 위로 빠져나가 **정적 위에 홀로 뜬다** —
  // 같이 줄이면 제일 중요한 소리가 제일 안 들린다.
  const master = gain(MIX.master, ctx.destination);
  const duck = gain(1, master);
  const bedBus = gain(MIX.bed, duck);
  const chaseBus = gain(MIX.chase, duck);
  const handBus = gain(MIX.hand, duck);
  const chimeBus = gain(MIX.chime, master);

  // ── 잡음 한 통 ──────────────────────────────────────────
  // 공기 순환·김·딸깍 소리의 재료. 매번 만들면 비싸니 한 번만 만든다.
  const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
  {
    const d = noiseBuf.getChannelData(0);
    // ══ ★★ **난수를 씨앗에서 뽑는다** (v74) ═══════════════════════════
    //
    //  ★ `Math.random()` 이었다. 귀로는 아무 차이가 없지만 **검사가 못
    //    잰다** — 소리 하나를 재려면 「아무 일 없는 판」과 「소리를 낸 판」을
    //    태워서 빼야 하는데, 잡음이 매번 다르면 **빼도 0 이 안 남는다.**
    //    그 찌꺼기가 배경보다 작은 소리를 통째로 삼켜서, 같은 소리를 두 번
    //    쟀는데 **0.2초와 2.95초**가 나왔다.
    //
    //  ★★ 2초짜리 도는 버퍼라 정해진 잡음이어도 귀는 구별 못 한다.
    //    「검사가 재려면 시각을 밖에서 받아야 한다」(머리말)와 같은 이유로,
    //    **잴 수 있게 만드는 것이 소리 자체보다 중요하다**
    let s = 0x9e3779b9;
    const rnd = () => {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
    // 흰 잡음은 「쉬——」 하고 날카롭다. 한 번 눌러 낮은 쪽으로 기울인다
    let prev = 0;
    for (let i = 0; i < d.length; i++) {
      const w = rnd() * 2 - 1;
      prev = prev * 0.86 + w * 0.14;
      d[i] = prev * 3.2;
    }
  }
  function noiseSrc() { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; }

  // ── 늘 도는 것 · 배 ─────────────────────────────────────
  const bedGain = gain(BED.gain, bedBus);
  {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = BED.cut; lp.Q.value = 0.7;
    // 둘째 음은 작게. 같은 크기로 겹치면 완전히 죽었다 살아나서
    // 「웅웅」이 아니라 「웝—웝—」 하고 출렁인다 (audio-table.js BED 참고)
    for (const [hz, mix] of [[BED.hz, 1], [BED.hz + BED.beat, BED.beatMix]]) {
      const o = ctx.createOscillator();
      o.type = 'triangle'; o.frequency.value = hz;
      o.connect(gain(mix, lp)); o.start(0);
    }
    lp.connect(bedGain);
  }
  {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = BED.air.hz; bp.Q.value = BED.air.q;
    const g = gain(BED.air.gain, bedBus);
    const s = noiseSrc(); s.connect(bp); bp.connect(g); s.start(0);
  }

  // 열 — 배가 앓는 소리. 평소엔 0 이라 안 들린다
  const strainGain = gain(0, bedBus);
  const strainBp = ctx.createBiquadFilter();
  {
    strainBp.type = 'bandpass';
    strainBp.frequency.value = BED.strain.from; strainBp.Q.value = BED.strain.q;
    const o = ctx.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = BED.strain.hz;
    o.connect(strainBp); strainBp.connect(strainGain); o.start(0);
  }

  // ── 추격 · 저음 ─────────────────────────────────────────
  const growlGain = gain(0, chaseBus);
  {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = CHASE_SND.growl.cut;
    const o = ctx.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = CHASE_SND.growl.hz;
    o.connect(lp); lp.connect(growlGain); o.start(0);
  }

  // ── 한 번씩 나는 것 ─────────────────────────────────────
  /** 짧은 음 하나. 시작할 때 0 에서 올리고 끝에 0 으로 내린다 —
   *  네모지게 자르면 「딱」 하고 튀는 잡음(클릭)이 같이 난다 */
  function tone(bus, hz, at, len, vol, type = 'sine', hz2 = null) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(hz, at);
    if (hz2 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(1, hz2), at + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), at + Math.min(0.02, len * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(g); g.connect(bus);
    o.start(at); o.stop(at + len + 0.02);
  }
  /** 부딪히는 소리 — 잡음을 짧게 잘라 쓴다. 딸깍·덜컹이 전부 이것이다 */
  function knock(bus, at, len, vol, hz, q = 1.4) {
    const s = noiseSrc();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = hz; bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    s.connect(bp); bp.connect(g); g.connect(bus);
    s.start(at); s.stop(at + len + 0.02);
  }

  // ── 예약 커서 ───────────────────────────────────────────
  // 「다음 경보를 언제 울릴까」를 소리 쪽이 들고 있는다. 프레임과 무관하다.
  let nextAlarm = -1, nextPing = -1, nextRatchet = -1, nextRattle = -1;
  let nextSweep = -1, nextGrowl = -1;
  let muted = false;
  let lastEscape = -99;

  /**
   * 매 프레임 부른다. **상태만 넘긴다** — 게임 규칙은 여기 없다.
   * @param s {phase, urgency 0~1, heat01 0~1, turning 0~1}
   */
  function update(s, at = ctx.currentTime) {
    const chasing = s.phase === 'chase';

    // 열 — 뜨거울수록 크고 높아진다. 계기를 안 봐도 귀로 안다
    ramp(strainGain.gain, BED.strain.gain * s.heat01 * s.heat01, at, 0.5);
    ramp(strainBp.frequency, lerp(BED.strain.from, BED.strain.to, s.heat01), at, 0.6);

    // 추격 저음 — 가까울수록 두껍다
    const [g0, g1] = CHASE_SND.growl.gain;
    ramp(growlGain.gain, chasing ? lerp(g0, g1, s.urgency) : 0, at, chasing ? 0.4 : 0.25);

    // ── 앞질러 예약 ──────────────────────────────────────
    const until = at + LOOKAHEAD;
    if (chasing) {
      const [a0, a1] = CHASE_SND.alarm.gap;
      const [p0, p1] = CHASE_SND.ping.gap;
      if (nextAlarm < at) nextAlarm = at;
      while (nextAlarm < until) {
        const A = CHASE_SND.alarm;
        tone(chaseBus, A.hz[0], nextAlarm, A.len, A.gain, 'square');
        tone(chaseBus, A.hz[1], nextAlarm + A.len * 1.25, A.len, A.gain, 'square');
        nextAlarm += lerp(a0, a1, s.urgency);
      }
      if (nextPing < at) nextPing = at + 1.2;
      while (nextPing < until) {
        const P = CHASE_SND.ping;
        tone(chaseBus, P.hz, nextPing, P.len, P.gain, 'sine', P.hz * 0.72);
        nextPing += lerp(p0, p1, s.urgency);
      }
    } else { nextAlarm = -1; nextPing = -1; }

    // 밸브 — 돌리는 동안 톱니가 넘어간다. 손이 뭘 하고 있는지가 소리로 남는다
    if (s.turning > 0) {
      if (nextRatchet < at) nextRatchet = at;
      while (nextRatchet < until) {
        knock(handBus, nextRatchet, 0.05, HAND.ratchet.gain, HAND.ratchet.hz * 6, 2.2);
        nextRatchet += 1 / HAND.ratchet.rate;
      }
    } else nextRatchet = -1;

    // ★ 고장의 덜그럭거림 — **화면을 안 늘리고 진단을 만드는 유일한 통로.**
    //   가까울수록 촘촘하고 크다. 간격을 흔들어 두는 것이 요점이다 —
    //   일정하면 기계음으로 들리고, 기계음은 「정상」으로 읽힌다
    const near = s.rattle || 0;
    if (near > 0.02) {
      if (nextRattle < at) nextRattle = at;
      while (nextRattle < until) {
        const [g0, g1] = RATTLE.gain;
        knock(bedBus, nextRattle, 0.07, lerp(g0, g1, near), RATTLE.hz, RATTLE.q);
        const [k0, k1] = RATTLE.gap;
        // 흔들림은 예약 시각에서만 쓴다 — 소리 자체는 늘 같아야 「같은 것」으로 들린다
        nextRattle += lerp(k0, k1, near) * (1 + (jitter() - 0.5) * RATTLE.jitter);
      }
    } else nextRattle = -1;

    // ══ ★★★ 레이더 (v69) ═════════════════════════════════════════
    //  ① **훑는 소리** — 켜져 있으면 한 바퀴마다 한 번. **일정하다.**
    //     덜그럭거림과 반대다: 규칙적이라 「정상으로 돌고 있다」로 들리고,
    //     끊기면 전력이 나간 것을 **화면을 안 보고** 안다
    if (s.radarOn) {
      const S = RADAR_SND.sweep;
      if (nextSweep < at) nextSweep = at;
      while (nextSweep < until) {
        tone(chaseBus, S.hz, nextSweep, S.len, S.gain, 'sine', S.hz * 0.55);
        nextSweep += S.gap;
      }
    } else nextSweep = -1;

    //  ② ★★ **탐색기 으르렁** — 열원을 잡으면 으르렁, **물면 높아진다.**
    //     HUD 가 26도뿐이라 눈이 늘 조준선에 가 있을 수 없다. 귀가 대신 본다.
    //     이가 촘촘한 소리라 `knock` 을 빠르게 되풀이해 만든다 —
    //     한 음으로 내면 「삐——」가 되어 경보와 구분이 안 된다
    const seek = s.seek ?? 0;                 // 0 없음 · 0.5 잡음 · 1 물었다
    if (seek > 0.02) {
      const G = RADAR_SND.growl;
      if (nextGrowl < at) nextGrowl = at;
      const hz = lerp(G.hz[0], G.hz[1], seek);
      const rate = lerp(G.rate[0], G.rate[1], seek);
      const vol = lerp(G.gain[0], G.gain[1], seek);
      while (nextGrowl < until) {
        knock(chaseBus, nextGrowl, 0.035, vol, hz, 3.2);
        nextGrowl += 1 / rate;
      }
    } else nextGrowl = -1;
  }

  /**
   * 흔들림 — **Math.random 을 안 쓴다.**
   * OfflineAudioContext 로 파형을 재는 검사(tools/space-audio.js)가 같은
   * 코드를 태우는데, 거기서 난수가 끼면 잰 값이 매번 달라져 못 쓴다.
   * 아주 싼 결정적 수열이면 충분하다 — 귀로는 구분이 안 된다.
   */
  let jseed = 1;
  function jitter() {
    jseed = (jseed * 1103515245 + 12345) & 0x7fffffff;
    return (jseed % 1000) / 1000;
  }

  /**
   * ★ 뿌리쳤다 — **이 게임의 보상.** 표(ESCAPE)가 모양을 들고 있다.
   *   여기서는 그 모양을 그대로 automation 으로 옮기기만 한다.
   */
  function escaped(at) {
    lastEscape = at;
    // 추격음이 끊긴다. 그리고 3초 뒤 **다음 추격을 위해 조용히 되돌려 둔다**
    chaseBus.gain.cancelScheduledValues(at);
    chaseBus.gain.setValueAtTime(MIX.chase, at);
    chaseBus.gain.linearRampToValueAtTime(0, at + ESCAPE.cut);
    chaseBus.gain.setValueAtTime(0, at + ESCAPE.total);
    chaseBus.gain.linearRampToValueAtTime(MIX.chase, at + ESCAPE.total + 0.4);
    growlGain.gain.cancelScheduledValues(at);
    growlGain.gain.linearRampToValueAtTime(0, at + ESCAPE.cut);
    nextAlarm = nextPing = -1;

    // 배가 조용해진다 — **평소보다도.** 내려가는 건 빠르고 올라오는 건 느리다
    const d = duck.gain;
    d.cancelScheduledValues(at);
    d.setValueAtTime(1, at);
    d.linearRampToValueAtTime(ESCAPE.hush, at + ESCAPE.hushAt);
    d.setValueAtTime(ESCAPE.hush, at + ESCAPE.hushAt + ESCAPE.hold);
    d.linearRampToValueAtTime(1, at + ESCAPE.total);

    // 안도의 두 음 — 덕킹 위로 빠져나가 정적 위에 홀로 뜬다
    ESCAPE.chime.forEach((hz, i) => {
      tone(chimeBus, hz, at + ESCAPE.chimeAt + i * ESCAPE.chimeGap, ESCAPE.chimeLen, 0.42, 'sine');
      tone(chimeBus, hz * 2, at + ESCAPE.chimeAt + i * ESCAPE.chimeGap, ESCAPE.chimeLen * 0.6, 0.11, 'sine');
    });
  }

  /**
   * ★★★ **선체를 타고 오는 소리 하나** (v74 · `audio-table.js STRUCT`).
   *
   *   모양은 셋 다 같다 — **때리는 소리 + 배가 우는 소리.**
   *   다른 것은 「얼마나 낮고 얼마나 오래 우나」뿐이다: 큰 것에 맞을수록
   *   낮고 길게 운다. 그래야 눈을 안 보고도 스쳤는지 맞았는지 갈린다.
   *
   *   ★ 우는 부분(`ring`)이 이 소리의 정체다. 그게 없으면 그냥 딸깍이고,
   *     딸깍은 **배 안에서 뭘 눌렀을 때** 나는 소리라 헷갈린다
   */
  function hull(H, at) {
    // ① 때린다 — 잡음을 짧게. 낮을수록 큰 것에 맞은 것이다
    knock(handBus, at, H.len, H.gain, H.hz, 1.1);
    // ② 배가 운다 — **금속을 타고 퍼지는 것**. 천천히 낮아지며 사라진다
    tone(handBus, H.ringHz, at + 0.01, H.ring, H.gain * 0.45, 'triangle', H.ringHz * 0.55);
    tone(handBus, H.ringHz * 0.5, at + 0.02, H.ring * 1.15, H.gain * 0.28, 'sine', H.ringHz * 0.3);
  }

  /** 한 번 나는 소리들. 이름 하나에 물건 하나 */
  function event(name, at = ctx.currentTime) {
    switch (name) {
      case 'escaped': return escaped(at);
      case 'contact': {
        const C = HAND.contact;
        tone(handBus, C.hz, at, C.len, C.gain, 'sine', C.hz * 0.55);
        knock(handBus, at, 0.5, 0.35, 140, 0.8);
        return;
      }
      case 'caught': {
        const C = HAND.caught;
        tone(handBus, C.hz, at, C.len, C.gain, 'sawtooth', C.hz * 0.28);
        duck.gain.cancelScheduledValues(at);
        duck.gain.setValueAtTime(1, at);
        duck.gain.linearRampToValueAtTime(0.35, at + 0.6);
        duck.gain.linearRampToValueAtTime(1, at + C.len + 0.8);
        return;
      }
      case 'click': return knock(handBus, at, HAND.click.len, HAND.click.gain, HAND.click.hz * 4, 1.1);
      case 'doorOpen': {
        // 스르륵 — **위로 쓸려 올라가는 바람소리.** 문이 벌어지는 모양이다
        const D = HAND.doorOpen;
        knock(handBus, at, D.len, D.gain, D.hz, 0.7);
        knock(handBus, at + 0.04, D.air, D.gain * 0.6, D.hz * 1.8, 0.5);
        return;
      }
      case 'doorShut': {
        // 맞물린다 — **아래로 떨어지는 둔탁한 소리.** 여는 것과 반대 모양이라야
        // 눈을 안 보고도 열렸는지 닫혔는지 안다
        const D = HAND.doorShut;
        knock(handBus, at, D.len, D.gain, D.hz, 1.6);
        tone(handBus, D.hz * 0.35, at + 0.03, D.thud, D.gain * 0.5, 'sine', D.hz * 0.22);
        return;
      }
      case 'fault': {
        // 「무언가 잘못됐다」 — **아래로 처지는 두 음.** 경보와 헷갈리면 안 된다
        const F = HAND.fault;
        tone(handBus, F.hz, at, F.len, F.gain, 'triangle', F.hz * 0.62);
        knock(handBus, at + 0.02, 0.2, 0.22, 320, 1.2);
        return;
      }
      case 'fixed': {
        // 고쳐졌다 — **위로 올라가는 짧은 음.** 안도(escape)보다 작고 짧다
        const F = HAND.fixed;
        tone(handBus, F.hz, at, F.len, F.gain, 'sine', F.hz * 1.5);
        return;
      }
      // ══ ★★★ **선체를 타고 오는 소리** (v74 · 진공 규칙) ═══════════════
      //  밖에서 터지는 것은 안 들린다. **선체에 닿은 것만** 들린다 —
      //  공기를 타고 온 게 아니라 금속을 타고 들어온 소리다.
      //  ★ 그래서 모양이 「때린다 + **배가 운다**」 둘이다. 우는 부분이
      //    없으면 그냥 딸깍 소리라 「어디서 났나」가 안 산다
      case 'hullGraze': return hull(STRUCT.graze, at);
      case 'hullHit': return hull(STRUCT.hit, at);
      case 'hullRam': return hull(STRUCT.ram, at);
      // ══ ★★ **내가 쏘는 소리** — 무기는 선체에 붙어 있다 ═══════════════
      //  v73 까지 `caught`(잡혔다)를 빌려 써서 **「쐈다」와 「맞았다」가
      //  같은 소리**였다. 소리로 상황을 알라는 계통에서 제일 나쁜 겹침이다
      case 'laser': {
        const L = MINE.laser;
        // 캐패시터 방전 — 위에서 뚝 떨어지는 짧은 고음
        tone(handBus, L.hz, at, L.len, L.gain, 'square', L.hz * 0.25);
        // 그 뒤에 남는 낮은 울림 — 배가 전력을 한 번에 뱉은 흔적
        tone(handBus, L.whineHz, at + L.len * 0.5, L.whine, L.gain * 0.45, 'sine', L.whineHz * 0.7);
        return;
      }
      case 'tube': {
        const T = MINE.tube;
        // 발사관이 배를 밀친다 — 낮은 쿵
        knock(handBus, at, T.len, T.gain, T.hz * 3, 1.0);
        tone(handBus, T.hz, at, T.len, T.gain * 0.7, 'sine', T.hz * 0.55);
        // 빠지는 가스 — 위로 흩어진다
        knock(handBus, at + T.len * 0.6, T.hiss, T.gain * 0.30, 2400, 0.5);
        return;
      }
      case 'deny': return tone(handBus, HAND.deny.hz, at, HAND.deny.len, HAND.deny.gain, 'square', HAND.deny.hz * 0.7);
      case 'latch': {
        knock(handBus, at, 0.10, HAND.latch.gain, HAND.latch.hz * 3, 1.6);
        tone(handBus, HAND.latch.hz, at + 0.03, HAND.latch.len, 0.22, 'triangle');
        return;
      }
      default: console.warn(`[audio] 모르는 소리 — ${name}`);
    }
  }

  return {
    ctx, update, event,
    /** 뿌리친 뒤 몇 초가 지났나. 떨림·조명이 **같은 시계**를 본다 */
    sinceEscape(at = ctx.currentTime) { return at - lastEscape; },
    get muted() { return muted; },
    setMuted(v, at = ctx.currentTime) {
      muted = !!v;
      master.gain.cancelScheduledValues(at);
      ramp(master.gain, muted ? 0 : MIX.master, at, 0.05);
    },
    /** 브라우저는 사람이 뭔가 누르기 전엔 소리를 안 낸다. 그때 부른다 */
    resume() { return ctx.resume?.(); },
    get state() { return ctx.state; },
  };
}
