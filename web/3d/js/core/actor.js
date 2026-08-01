// Actor — 「무엇이 보이는가」와 「무엇을 하는가」 사이의 벽.
//
// ── 왜 필요한가 ──────────────────────────────────────────
// 지금 게임 로직은 `rig.torso.rotation.x = 0.3` 같은 식으로 **관절을 직접**
// 만지고 있고, 그런 자리가 42곳이다. 코드로 조립한 상자 기사에게는 그게
// 제일 짧은 길이었지만, 산 모델(glTF)로 갈아 끼우려는 순간 전부 막힌다:
// 남의 모델에는 `torso` 도 `legL` 도 없다.
//
// Actor 는 그 42곳을 **네 개의 동사**로 줄인다:
//
//     play('idle' | 'walk' | 'attack' | 'hit' | 'die')
//
// 상자 기사는 지금처럼 관절을 굽혀서, 산 모델은 AnimationMixer 로 그 동사를
// 수행한다. 호출부는 어느 쪽인지 몰라도 된다 — 그게 이 층의 전부다.
//
// ── 왜 지금인가 ──────────────────────────────────────────
// 에셋을 산 **뒤에** 이 층을 만들면, 그때는 이미 42곳을 고치면서 동시에
// 새 파이프라인을 디버깅해야 한다. 무엇이 깨졌는지 못 가린다.
// 지금 만들면 상자 기사로 **먼저 검증**할 수 있다 — 화면이 그대로면 성공이다.

import * as THREE from 'three';

/** 이 게임이 쓰는 동작. 모델을 사면 이 이름으로 매핑한다. */
export const CLIPS = ['idle', 'walk', 'attack', 'hit', 'die'];

/**
 * 코드로 조립한 리그를 감싼다.
 *
 * @param rig    build*() 가 돌려준 것 (group/torso/legL/legR/arm... )
 * @param poser  { [clip]: (rig, t, k, ctx) => void }
 *               t  = 이 동작이 시작된 뒤 흐른 시간
 *               k  = 0..1 진행도 (지속시간이 있는 동작만)
 *               ctx= 호출부가 넘기는 것 (moving, swing, facing 등)
 */
export class RigActor {
  constructor(rig, poser) {
    this.rig = rig;
    this.poser = poser;
    this.object = rig.group;
    this.clip = 'idle';
    this.t = 0;
    this.dur = 0;          // 0 이면 반복
    this.ctx = {};
  }

  /**
   * 동작을 건다. 같은 동작을 다시 걸면 **처음부터 다시 하지 않는다** —
   * 걷는 중에 매 프레임 play('walk') 를 불러도 다리가 떨리지 않아야 한다.
   */
  play(clip, { dur = 0, restart = false, ...ctx } = {}) {
    if (clip !== this.clip || restart) {
      this.clip = clip;
      this.t = 0;
      this.dur = dur;
    }
    Object.assign(this.ctx, ctx);
    return this;
  }

  update(dt) {
    this.t += dt;
    const k = this.dur > 0 ? Math.min(1, this.t / this.dur) : 0;
    const fn = this.poser[this.clip] || this.poser.idle;
    if (fn) fn(this.rig, this.t, k, this.ctx);
    // 지속시간이 있는 동작은 끝나면 스스로 idle 로 돌아간다.
    // 호출부가 「끝났나」를 세고 있으면 그 계산이 두 곳에 생긴다.
    if (this.dur > 0 && this.t >= this.dur && this.clip !== 'die') {
      this.clip = 'idle';
      this.t = 0;
      this.dur = 0;
    }
  }

  get position() { return this.object.position; }
  get rotation() { return this.object.rotation; }
  get scale() { return this.object.scale; }

  dispose() {}
}

/**
 * glTF 모델을 감싼다. **아직 쓰지 않는다** — 모델을 사면 이 클래스가 받는다.
 *
 * 여기 있는 이유: 호출부가 기대하는 표면(play/update/object/position)을
 * 미리 못박아 두려는 것이다. 나중에 만들면 그때 호출부를 또 고치게 된다.
 *
 * @param gltf   GLTFLoader 결과
 * @param map    { idle: 'Idle', walk: 'Run', ... } — 모델의 클립 이름으로 매핑
 */
export class GltfActor {
  constructor(gltf, map = {}) {
    this.object = gltf.scene;
    this.mixer = new THREE.AnimationMixer(this.object);
    this.actions = {};
    for (const name of CLIPS) {
      const clipName = map[name] || name;
      const clip = THREE.AnimationClip.findByName(gltf.animations || [], clipName);
      if (clip) this.actions[name] = this.mixer.clipAction(clip);
    }
    this.clip = null;
    this.ctx = {};
    this.play('idle');
  }

  play(clip, { restart = false, fade = 0.15, ...ctx } = {}) {
    Object.assign(this.ctx, ctx);
    if (clip === this.clip && !restart) return this;
    const next = this.actions[clip] || this.actions.idle;
    if (!next) return this;
    const prev = this.actions[this.clip];
    // 한 번만 하는 동작은 마지막 자세에서 멈춘다 — 죽은 뒤 idle 로 돌아가면
    // 시체가 일어선다.
    next.reset();
    next.setLoop(clip === 'walk' || clip === 'idle' ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = clip === 'die';
    next.fadeIn(fade).play();
    if (prev && prev !== next) prev.fadeOut(fade);
    this.clip = clip;
    return this;
  }

  update(dt) { this.mixer.update(dt); }

  get position() { return this.object.position; }
  get rotation() { return this.object.rotation; }
  get scale() { return this.object.scale; }

  dispose() { this.mixer.stopAllAction(); }
}

/**
 * 어느 쪽으로 만들지 한 곳에서 정한다.
 *
 * 지금은 항상 상자 리그를 돌려준다. 모델을 사면 여기서만 갈라진다 —
 * 호출부(player.js·enemies.js)는 한 줄도 안 바뀐다. 그게 이 층을 만든 이유다.
 */
export function makeActor(rig, poser) {
  return new RigActor(rig, poser);
}
