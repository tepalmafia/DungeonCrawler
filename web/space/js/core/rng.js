// 시드 RNG — 같은 시드는 항상 같은 항로를 만든다 (?seed=ABC123).
//
// 던전(web/3d/js/core/rng.js)에서 그대로 가져왔다. 40줄에 의존성이 0이라
// 고쳐 쓸 것이 없었다 — 같은 규약을 쓰면 시드 문자열도 서로 통한다
// (docs/REUSE.md §3).
//
// ★ 시뮬이 이걸 읽는다. 시드가 같으면 항로도 같아야 tools/space-route.js 가
//   「이 항로에서 몇 분 걸리나」를 되풀이해 잴 수 있다. Math.random 을 쓰면
//   그 순간 잴 수 없는 게임이 된다.

export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function makeRng(seed) {
  let a = (typeof seed === 'number' ? seed : hashSeed(seed)) >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rnd.range = (lo, hi) => lo + rnd() * (hi - lo);
  rnd.int = (lo, hi) => Math.floor(lo + rnd() * (hi - lo + 1));   // 양끝 포함
  rnd.pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  rnd.chance = (p) => rnd() < p;
  rnd.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  return rnd;
}

/** 시드 문자열 생성 (공유용) */
export function randomSeed() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}
