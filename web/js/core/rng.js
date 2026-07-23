// 시드 기반 난수 생성기 (mulberry32) — 던전 절차 생성의 재현성을 위해 시드 고정 가능
const RNG = {
  _state: 1,

  seed(s) {
    this._state = s >>> 0;
    if (this._state === 0) this._state = 0x9e3779b9;
  },

  next() {
    this._state = (this._state + 0x6d2b79f5) | 0;
    let t = this._state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  },

  range(min, max) {
    return min + this.next() * (max - min);
  },

  int(min, max) { // [min, max] 정수
    return Math.floor(this.range(min, max + 1));
  },

  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  },

  chance(p) {
    return this.next() < p;
  },
};

RNG.seed(Date.now());
