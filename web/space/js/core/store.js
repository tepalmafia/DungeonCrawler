// ══════════════════════════════════════════════════════════════════════════
//  저장을 **어디에 쓰나** — localStorage 를 감싼다.
//
//  ★ **없어도 게임은 돈다.** 사생활 보호 모드나 저장 공간이 꽉 찬
//    브라우저에서는 localStorage 가 던진다. 그때 게임이 통째로 죽으면
//    안 된다 — 저장을 못 하는 것과 못 노는 것은 다르다.
//    (소리도 같은 방식으로 감쌌다 — core/audio.js)
// ══════════════════════════════════════════════════════════════════════════
import { SAVE_KEY } from '../game/save-table.js';

/** 저장이 되는 브라우저인가 — 한 번만 알아본다 */
let works = null;
function check() {
  if (works !== null) return works;
  try {
    const k = `${SAVE_KEY}.시험`;
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    works = true;
  } catch {
    works = false;
    console.warn('[저장] 이 브라우저에서는 저장이 안 됩니다 — 게임은 그대로 돕니다');
  }
  return works;
}

export function saveRaw(obj) {
  if (!check()) return false;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(obj));
    return true;
  } catch {
    // 공간이 꽉 찼다. 조용히 넘어가되 다음에 다시 해 본다
    return false;
  }
}

export function loadRaw() {
  if (!check()) return null;
  try {
    const s = localStorage.getItem(SAVE_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    // ★ 망가진 글이 들어 있으면 **버린다.** 그대로 두면 켤 때마다 터진다
    try { localStorage.removeItem(SAVE_KEY); } catch { /* 어쩔 수 없다 */ }
    return null;
  }
}

export function clearRaw() {
  if (!check()) return;
  try { localStorage.removeItem(SAVE_KEY); } catch { /* 어쩔 수 없다 */ }
}

export const canSave = () => check();

/** 저장된 것이 남아 있나 — 검사가 「닫았다 켜면 이어지나」를 물으려고 쓴다 */
export function hasSave() {
  if (!check()) return false;
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}
