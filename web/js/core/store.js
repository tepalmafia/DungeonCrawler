// 저장 어댑터 — 웹은 localStorage, 데스크톱(Electron)은 세이브 파일 (스팀 스프린트 1차)
// 기존 코드가 동기 API를 쓰므로: 부팅 시 전부 메모리로 올리고(get/set은 동기),
// 쓰기는 백엔드로 비동기 반영한다 (데스크톱은 300ms 디바운스 후 원자적 파일 쓰기).
const Store = {
  _cache: {},
  _desktop: false,
  _flushT: null,

  async init() {
    this._desktop = typeof window !== 'undefined' && !!window.desktop;
    if (this._desktop) {
      try { this._cache = (await window.desktop.loadSave()) || {}; } catch (e) { this._cache = {}; }
    } else {
      // 웹: 알려진 키만 localStorage에서 승계 (기존 세이브 호환)
      for (const k of ['dungeoncrawler_meta', 'dungeoncrawler_run']) {
        try {
          const v = localStorage.getItem(k);
          if (v != null) this._cache[k] = v;
        } catch (e) { /* 시크릿 모드 등 */ }
      }
    }
  },

  get(key) {
    return Object.prototype.hasOwnProperty.call(this._cache, key) ? this._cache[key] : null;
  },

  set(key, value) {
    this._cache[key] = value;
    this._flush(key);
  },

  remove(key) {
    delete this._cache[key];
    this._flush(key, true);
  },

  _flush(key, removed = false) {
    if (this._desktop) {
      // 파일 백엔드: 전체 캐시를 디바운스 후 한 번에 (원자적 쓰기는 메인 프로세스가)
      clearTimeout(this._flushT);
      this._flushT = setTimeout(() => { window.desktop.storeSave(this._cache); }, 300);
    } else {
      try {
        if (removed) localStorage.removeItem(key);
        else localStorage.setItem(key, this._cache[key]);
      } catch (e) { /* 저장 실패는 게임을 막지 않는다 */ }
    }
  },
};
