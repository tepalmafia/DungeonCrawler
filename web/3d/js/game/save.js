// 저장 — **노가다 게임의 전제.** 남지 않으면 아무도 노가다를 안 한다.
//
// 지금까지 이 게임에는 저장이 없었다. 새로고침하면 레벨·장비·스킬이 전부
// 날아갔고, 그건 「한 번 끝까지 가는 여정」이라는 예전 목적에는 맞았다.
// 목적이 바뀌었으므로 (docs/GRIND.md) 제일 먼저 만든다.
//
// ── 무엇을 저장하고 무엇을 안 하는가 ────────────────────────
// **던전은 저장하지 않는다.** 시드로 다시 만들면 되고, 그게 「나갔다 다시
// 들어오는」 리듬과도 맞는다. 저장하는 것은 **내가 들고 나가는 것**뿐이다:
//
//   캐릭터  레벨 · 경험치 · 스킬 트리
//   장비    낀 것 8칸 + 가방
//   재화    영혼 조각 · 물약
//   진행    최고 도달 층 · 회차 · 통계
//
// ── 지켜야 할 것 ────────────────────────────────────────────
// **낡거나 깨진 저장이 게임을 못 켜게 만들면 안 된다.** 판이 바뀌면 표도
// 바뀌고, 그때 옛 저장을 그대로 밀어 넣으면 조용히 이상한 상태가 된다.
// 그래서 버전을 붙이고, 안 맞으면 **말없이 버린다.** 읽다가 예외가 나도
// 버린다 — 저장을 살리려다 게임을 못 켜는 쪽이 훨씬 나쁘다.
//
// **랜턴은 참조를 저장하지 않는다.** 아이템 안에 `def` 로 LANTERNS 의 항목을
// 가리키고 있어서, JSON 으로 굳히면 그 표의 복사본이 저장에 박힌다.
// 표를 고치는 순간 옛 저장만 옛 값으로 도는 상태가 된다 — tier 만 저장하고
// 불러올 때 지금 표에서 다시 찾는다.

import { makeLantern } from './lantern.js';

const KEY = 'dc3d.save';
const VERSION = 1;

/** 저장이 있는가 — 타이틀 화면이 「이어하기」를 띄울지 정할 때 쓴다 */
export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* 사생활 모드 등 — 조용히 넘어간다 */ }
}

/** 아이템 하나를 JSON 으로 굳힌다. 랜턴만 특별하다 */
function packItem(it) {
  if (!it) return null;
  if (it.kind === 'lantern') return { kind: 'lantern', tier: it.def?.tier ?? 0, fuel: it.fuel ?? 0 };
  // 나머지는 이미 순수 객체다. 다만 화면용 필드가 섞여 들어가지 않게 골라 담는다
  const { id, slot, icon, rarity, ilvl, fam, stats, baseStats, affixes,
    dmgMin, dmgMax, aspd, name, baseName, element } = it;
  return { id, slot, icon, rarity, ilvl, fam, stats, baseStats, affixes,
    dmgMin, dmgMax, aspd, name, baseName, element };
}

function unpackItem(o) {
  if (!o) return null;
  // **지금 표에서 다시 만든다.** 저장에 박힌 복사본을 쓰면 표를 고쳐도
  // 옛 저장만 옛 값으로 돈다. makeLantern 이 정본이므로 그걸 그대로 부른다.
  if (o.kind === 'lantern') return makeLantern(o.tier, o.fuel);
  return o;
}

/**
 * 지금 상태를 굳힌다. **자주 불려도 싸야 한다** — 층 이동·장착·상점마다 부른다.
 * 아이템 마흔여덟 개를 JSON 으로 만드는 정도라 프레임에 안 잡힌다.
 */
export function saveGame(G) {
  const p = G.player;
  if (!p) return false;
  const data = {
    v: VERSION,
    at: Date.now(),
    player: {
      level: p.level, xp: p.xp, xpNext: p.xpNext,
      coin: p.coin, potions: { ...p.potions },
      equipped: Object.fromEntries(Object.entries(p.equipped).map(([k, v]) => [k, packItem(v)])),
      bag: p.bag.map(packItem),
      lantern: packItem(p.lantern),
    },
    tree: { points: G.tree.points, taken: [...G.tree.taken] },
    run: { tier: G.tier, best: Math.max(G.best || 0, G.floorNo || 1) },
    stats: { ...G.stats },
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    // 용량 초과·사생활 모드. 게임은 계속 돌아야 한다
    return false;
  }
}

/**
 * 불러온다. **못 읽으면 null 을 돌려주고 저장을 지운다** —
 * 반쯤 읽힌 상태로 게임을 켜는 것보다 처음부터 하는 게 낫다.
 */
export function loadGame() {
  let raw;
  try { raw = localStorage.getItem(KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (d.v !== VERSION) { clearSave(); return null; }
    if (!d.player || typeof d.player.level !== 'number') { clearSave(); return null; }
    return d;
  } catch {
    clearSave();
    return null;
  }
}

/**
 * 불러온 것을 실제 상태에 밀어 넣는다.
 *
 * **recompute() 를 마지막에 한 번만 부른다.** 장비를 한 칸씩 넣을 때마다
 * 부르면 무기 메시를 여덟 번 만들었다 버린다.
 */
export function applySave(G, d) {
  const p = G.player;
  p.level = d.player.level;
  p.xp = d.player.xp;
  p.xpNext = d.player.xpNext;
  p.coin = d.player.coin || 0;
  p.potions = { hp: d.player.potions?.hp ?? 5, mp: d.player.potions?.mp ?? 5 };
  for (const [k, v] of Object.entries(d.player.equipped || {})) {
    if (k in p.equipped) p.equipped[k] = unpackItem(v);
  }
  p.bag = (d.player.bag || []).map(unpackItem).filter(Boolean);
  p.lantern = unpackItem(d.player.lantern);
  G.tree.points = d.tree?.points || 0;
  G.tree.taken = new Set(d.tree?.taken || []);
  G.tree._cache?.clear();
  G.tier = d.run?.tier || 0;
  G.best = d.run?.best || 1;
  if (d.stats) Object.assign(G.stats, d.stats);
  p.recompute();
  p.hp = p.maxHp;
  p.mp = p.maxMp;
}

/** 「언제 저장했나」 — 타이틀에 보여 준다 */
export function saveInfo() {
  const d = loadGame();
  if (!d) return null;
  return { level: d.player.level, tier: d.run?.tier || 0, best: d.run?.best || 1, at: d.at };
}
