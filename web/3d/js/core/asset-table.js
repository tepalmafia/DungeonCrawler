// ══════════════════════════════════════════════════════════════════════════
//  그림 규격표 — `docs/ART-REQUEST.md` 의 기계가 읽는 판본.
//
//  **문서와 코드에 두 번 적지 않는다.** 요구서에는 「512 x 870」이라 써 놓고
//  코드는 정사각형을 기대하는 상태가 제일 위험하다 — 파일을 넣어도
//  아무 일이 안 일어나고 오류도 안 난다 (docs/POSTMORTEM.md §1-⑤).
//  그래서 규격을 여기 한 번만 적고, 로더도 검사 도구도 여기를 읽는다.
//
//  **three.js 를 쓰지 않는다.** node 로 도는 `tools/assets.js` 가 읽어야 한다
//  (CLAUDE.md 「숫자는 한 곳에만 둡니다」와 같은 이유).
// ══════════════════════════════════════════════════════════════════════════

/** 에셋 뿌리. index.html 기준 상대 경로다. */
export const ASSET_ROOT = 'assets/';

// ─────────────────────── 1순위 · 공용 이펙트 ───────────────────────
// 게임의 모든 빛과 파티클이 이 넷에서 나온다.
// **흰색/회색 + 알파로만.** 게임이 색을 곱해 쓴다 — 그림에 색이 있으면
// 빨강 스킬도 파랑 스킬도 그 색에 물든다.
const FX = {
  'fx/dot': { w: 64, h: 64, what: '파티클·발밑 그림자·아이템 광채·출구 광채' },
  'fx/flame': { w: 64, h: 128, what: '벽 횃불 불꽃' },
  'fx/beam': { w: 64, h: 128, what: '아이템·출구 광기둥' },
  'fx/ring': { w: 128, h: 128, what: '스킬·보스 예고 원' },
};

// ─────────────────────── 2순위 · 던전 타일 ───────────────────────
// 화면의 98%. 테마 3개 × (바닥·벽면·벽상단).
//
// 벽면만 정사각형이 아니다 — 벽 한 칸이 CELL 2 x WALL_H 3.4 라
// 세로가 1.7배 길다. 정사각형을 넣으면 벽돌이 그대로 늘어난다.
const THEMES = ['crypt', 'flood', 'throne'];
const TILES = {};
for (const t of THEMES) {
  TILES[`tiles/floor_${t}`] = { w: 512, h: 512, tile: 'xy', what: `${t} 바닥 (한 장 = 6x6 월드 유닛)` };
  TILES[`tiles/wall_${t}`] = { w: 512, h: 870, tile: 'x', what: `${t} 벽면 (가로:세로 = 1:1.7)` };
  TILES[`tiles/walltop_${t}`] = { w: 256, h: 256, tile: 'xy', what: `${t} 벽 꼭대기` };
  // 선택 — 회색조 높이맵. 128 = 기준면, 밝을수록 튀어나옴.
  // 색 텍스처와 **크기가 같아야** 한다.
  TILES[`tiles/floor_${t}_h`] = { w: 512, h: 512, tile: 'xy', gray: true, optional: true, what: `${t} 바닥 높이맵` };
  TILES[`tiles/wall_${t}_h`] = { w: 512, h: 870, tile: 'x', gray: true, optional: true, what: `${t} 벽 높이맵` };
}

// ─────────────────────── 3순위 · UI 아이콘 ───────────────────────
//
// 지금 UI 아이콘은 전부 이모지 **글자**다. 브라우저·OS 마다 모양이 다르고
// 크기도 제각각이라 칸 안에서 흔들린다.
//
// **색은 자유롭게 넣으셔도 된다.** 처음엔 「회색조로 주시면 게임이 등급 색을
// 곱한다」로 적었다가 물렀다 — 색을 입히려면 그림을 실루엣으로 깎아야 하고
// (CSS 마스크는 알파만 읽는다) 그러면 안쪽 명암이 통째로 날아간다.
// 등급은 아이템 **이름 색**이 이미 말해 주고 있으므로 아이콘까지 물들일
// 이유가 없다.
//
// `glyph` 는 **지금 쓰고 있는 이모지**다. 이게 열쇠 노릇을 한다 —
// 표(item-table.js)를 안 건드리고도 그림으로 갈아 끼울 수 있다.
const ICONS = {};
const icon = (id, glyph, w, what, extra = {}) => { ICONS[id] = { w, h: w, glyph, what, ...extra }; };

// 아이템 32
const ITEM = (id, glyph, what) => icon(`icons/${id}`, glyph, 64, what);
ITEM('sword', '🗡', '검');
ITEM('axe', '🪓', '도끼');
ITEM('mace', '🔨', '둔기');
ITEM('greatsword', '⚔', '대검');
ITEM('dagger', '🔪', '단검');
ITEM('staff', '🪄', '지팡이');
ITEM('helm_hood', '🧢', '가죽 두건');
ITEM('helm_bone', '💀', '뼈 투구');
ITEM('helm_chain', '⛑', '사슬 투구');
ITEM('helm_plate', '🪖', '판금 투구');
ITEM('helm_crown', '👑', '대관식 투구');
ITEM('body_gambeson', '👕', '누비 옷');
ITEM('body_leather', '🎽', '가죽 갑옷');
ITEM('body_chain', '🥋', '사슬 갑옷');
ITEM('body_scale', '🐉', '비늘 갑옷');
ITEM('body_plate', '🛡', '판금 갑옷');
ITEM('hands_cloth', '🧤', '천·가죽 장갑');
ITEM('hands_chain', '🤲', '사슬 손모아');
ITEM('hands_plate', '🥊', '판금 건틀릿');
ITEM('belt_cord', '🪢', '노끈 허리띠');
ITEM('belt_leather', '🩹', '가죽 허리띠');
ITEM('belt_chain', '⛓', '사슬 허리띠');
ITEM('belt_war', '🎗', '전쟁띠');
ITEM('feet_worn', '🥿', '해진 신');
ITEM('feet_leather', '👢', '가죽 장화');
ITEM('feet_chain', '🥾', '사슬 장화');
ITEM('feet_plate', '🦿', '판금 강철화');
ITEM('ring', '💍', '반지');
ITEM('seal', '🔮', '영혼 인장');
ITEM('amulet_bone', '📿', '뼈 목걸이');
ITEM('amulet_charm', '🧿', '호박 부적');
ITEM('amulet_crest', '⚜', '왕관의 조각');

// 스킬 4 · 물약 2
icon('icons/skill_cleave', '🌀', 128, '회전 베기');
icon('icons/skill_dash', '💨', 128, '그림자 돌진');
icon('icons/skill_nova', '🔥', 128, '화염 신성');
icon('icons/skill_meteor', '☄', 128, '운석 낙하');
icon('icons/potion_hp', '🧪', 96, '체력 물약');
icon('icons/potion_mp', '🔵', 96, '마나 물약');

// 스킬트리 글리프 20 — 36px 로 찍혀도 서로 구별되는 실루엣이면 된다.
// **글리프가 아니라 칸 id 로 찾는다** — 트리는 `GLYPH[node.id]` 로 그리므로
// 이모지를 거칠 이유가 없다 (ui/treeview.js).
for (const id of [
  'cleaveWide', 'cleaveCombo', 'cleaveRend', 'cleaveWhirl',
  'dashAfter', 'dashPierce', 'dashBlast', 'dashChain',
  'novaLinger', 'novaSpread', 'novaFocus', 'novaRekindle',
  'meteorAim', 'meteorShards', 'meteorDirect', 'meteorWake',
  'comMana', 'comWick', 'comGrit', 'comSense',
]) ICONS[`icons/tree_${id}`] = { w: 88, h: 88, node: id, what: `스킬트리 — ${id}` };

// ───────────────────────────────────────────────────────────────
/** 전체 규격표. 열쇠 = 확장자 없는 경로 (`fx/dot` → `assets/fx/dot.png`) */
export const ASSET_SPEC = { ...FX, ...TILES, ...ICONS };

/** 이모지 → 에셋 id. UI 가 이걸로 글자를 그림으로 바꾼다. */
export const ICON_BY_GLYPH = {};
for (const [id, s] of Object.entries(ICONS)) if (s.glyph) ICON_BY_GLYPH[s.glyph] = id;

/** 스킬트리 칸 id → 에셋 id */
export const ICON_BY_NODE = {};
for (const [id, s] of Object.entries(ICONS)) if (s.node) ICON_BY_NODE[s.node] = id;

/** 파일 경로 (확장자까지) */
export const assetPath = (id) => `${ASSET_ROOT}${id}.png`;

/** 필수만 (선택 높이맵 제외) — 「몇 장 들어왔나」를 셀 때 쓴다 */
export const REQUIRED_IDS = Object.keys(ASSET_SPEC).filter((k) => !ASSET_SPEC[k].optional);
