// ══════════════════════════════════════════════════════════════════════════
//  ★★★ **어스펙트 — 내가 적의 어느 쪽에 있나** — 뼈대 (v137).
//    기획은 `docs/space/FIGHT.md`.
//
//  ★ 사장님 (2026-08-13) 「실감나는 전투를 위해 무기와 적의 기동 임펙트,
//    **후미를 공격햇을때 데미지** 등 … 우주 전투시뮬레이션 RPG에 맞게」
//
//  ══ ★★★ 재 보니 **말은 v70 부터 있었고 코드가 안 따라왔다** ══════════════
//
//  `target-table.js PARTS` 의 주석이 이미 이렇게 약속하고 있었다:
//
//      engine … '깨지면 못 도망가고 못 다가온다. **뒤를 잡으면 나온다**'
//      gun    … '깨지면 안 쏜다. **정면으로 맞붙으면 나온다**'
//
//  그런데 `pickHit` 은 **조준이 얼마나 어긋났나**로만 부위를 골랐다.
//  **내가 적의 어느 쪽에 있는지는 아무 데도 안 썼다** — 즉 뒤를 잡으나
//  정면으로 맞붙으나 결과가 같았다. v135 회피가 정확히 같은 병이었고
//  (화면은 「좌현으로」라고 하고 판정은 부호를 버렸다), 이 저장소는 그것을
//  **「재는 곳을 둘로 만들지 않는다」**로 부른다. 여기서는 한 술 더 떠서
//  **재는 곳이 아예 없었다.**
//
//  ══ ★★ 왜 이것이 「전투 시뮬레이션」의 알맹이인가 ═══════════════════════
//
//  어스펙트가 없으면 배를 돌릴 이유가 **사거리뿐**이다. 붙었다 떨어지는
//  것 말고는 조종이 전투에 안 들어온다. 어스펙트가 붙으면 **「뒤로 돌아
//  들어가는 30초」**가 값을 갖고, 그것이 실기 공중전(BFM)의 전부다.
//
//  ★★★ 그래서 **정면이 손해**여야 한다. 정면이 이득이면 아무도 안 돈다 —
//    「그냥 마주보고 쏘는 게 제일 낫다」가 되고, 그러면 v73 에 만든 360도
//    선회도 v133 의 스로틀도 다 장식이 된다.
//
//  ★ three.js 를 안 쓴다 — `tools/space-aspect.js` 가 읽는다.
// ══════════════════════════════════════════════════════════════════════════

/**
 * ★★★ **세 구역** — 적 기수에서 나까지의 각(도).
 *
 *   ★ 넷으로 안 가른다 (12·3·6·9시). 사람이 화면에서 읽을 수 있는 것은
 *     「앞이냐 뒤냐 옆이냐」까지고, 넷이 되면 3시와 9시가 **같은 뜻인데
 *     다른 칸**이 되어 표만 커진다.
 *
 *   @property from,to 각의 범위 (도)
 *   @property mult    이 쪽에서 때리면 피해 배수
 *   @property parts   잘 나오는 부위의 무게 (`target-table.js PARTS` 의 열쇠)
 */
export const ASPECT = {
  front: {
    key: 'front', name: '정면', from: 0, to: 45,
    mult: 0.75,
    parts: { gun: 3, hull: 3, core: 1, engine: 0 },
    what: '제일 두껍다. **마주보는 것은 손해**라야 돌아 들어갈 이유가 생긴다',
  },
  side: {
    key: 'side', name: '측면', from: 45, to: 135,
    mult: 1.15,
    parts: { hull: 4, core: 2, gun: 1, engine: 1 },
    what: '옆구리가 제일 넓다 — **맞히기는 쉽고** 급소는 아니다',
  },
  rear: {
    key: 'rear', name: '후미', from: 135, to: 180,
    mult: 1.45,
    parts: { engine: 4, hull: 2, core: 1, gun: 0 },
    what: '분사구는 장갑을 못 두른다. 실기의 **「꼬리를 문다」**가 이것이다',
  },
};

/** 셋 — 검사와 화면이 **같은 것**을 센다 */
export const ASPECTS = Object.keys(ASPECT);

/**
 * ★★★ **몇 도면 어느 쪽인가.**
 * @param deg 적 기수에서 나까지의 각 (0 = 적이 나를 정면으로 본다)
 */
export function aspectOf(deg = 90) {
  const a = Math.abs(((deg % 360) + 360) % 360);
  const d = a > 180 ? 360 - a : a;
  if (d < ASPECT.front.to) return 'front';
  return d < ASPECT.side.to ? 'side' : 'rear';
}

/** 이 쪽에서 때리면 피해가 몇 배 */
export const aspectMult = (deg) => ASPECT[aspectOf(deg)].mult;

/** 사람이 읽는 한 마디 — 계기가 적는다 */
export const aspectWord = (deg) => ASPECT[aspectOf(deg)].name;

/**
 * ★★★ **어디를 맞았나** — 조준과 어스펙트를 **곱해서** 고른다.
 *
 *   ★★ 둘 중 하나만 쓰면 안 된다:
 *     · 조준만 쓰면 (v136 까지) **뒤를 잡을 이유가 없다**
 *     · 어스펙트만 쓰면 **정확히 겨눌 이유가 없다** — 뒤에서 아무렇게나
 *       쏴도 엔진이 나온다
 *   그래서 **어스펙트가 후보의 무게를 정하고, 조준이 그중 급소를 연다.**
 *
 * @param deg  어스펙트 각
 * @param off  조준이 어긋난 정도 0~1 (0 이 한가운데 · `aimedAt` 이 준다)
 * @param rnd  0~1 (씨앗에서 뽑아 넘긴다 — `Math.random` 을 안 쓴다)
 */
export function partAt(deg, off = 0.5, rnd = 0.5) {
  const w = { ...ASPECT[aspectOf(deg)].parts };
  // ★ **한가운데를 맞혀야 핵심이 열린다.** 어긋나면 핵심 무게가 0 으로 간다 —
  //   「정확히 한가운데라야 나온다」는 `PARTS.core` 의 약속을 지키는 자리다
  w.core *= Math.max(0, 1 - off * 2.4);
  const tot = Object.values(w).reduce((s, v) => s + v, 0);
  if (tot <= 0) return 'hull';
  let x = Math.max(0, Math.min(0.999999, rnd)) * tot;
  for (const k of Object.keys(w)) { x -= w[k]; if (x < 0) return k; }
  return 'hull';
}

/**
 * ★★ **무기마다 어스펙트를 다르게 탄다** (`docs/space/FIGHT.md §4`).
 *
 *   · 유도탄은 **각도를 덜 가린다** — 그래서 정면 교차에서도 쓸 값이 있다
 *   · 열추적탄은 **후미에서 잘 문다** — 열원이 분사구라는 고증이 그대로 규칙이 된다
 *   ★ 새 축을 안 만든다: 여기 있는 것은 **이미 있는 어스펙트에 얹는 계수**뿐이다
 */
export const WEAPON_ASPECT = {
  laser: { follow: 1.0, why: '있는 그대로 탄다' },
  ir: { follow: 1.0, rearBonus: 0.25, why: '후미에서 더 잘 문다 — 열원이 분사구다' },
  arh: { follow: 0.45, why: '각도를 덜 가린다 — 정면에서도 쓸 값이 있다' },
};

/** 이 무기로 이 각에서 때리면 몇 배 */
export function multFor(weaponKey, deg) {
  const w = WEAPON_ASPECT[weaponKey] ?? { follow: 1 };
  const m = aspectMult(deg);
  // ★ `follow` 가 1 이면 그대로, 0 이면 **어스펙트를 아예 안 탄다**(=1.0)
  const out = 1 + (m - 1) * w.follow;
  return aspectOf(deg) === 'rear' ? out + (w.rearBonus ?? 0) : out;
}
