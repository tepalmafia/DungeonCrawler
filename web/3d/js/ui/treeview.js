// 스킬 트리 화면 — **목록이 아니라 그림이다.**
//
// 예전에는 칸 20개를 세로로 나열했다. 그러면 「무엇을 찍을까」가
// 항목 고르기가 되고, **양자택일과 순서가 안 보인다.** 디아블로 계열이
// 트리를 그림으로 그리는 이유가 그것이다 — 갈래가 눈에 보여야 「이쪽을
// 가면 저쪽을 못 간다」가 읽힌다.
//
// ── 배치 규칙 ────────────────────────────────────────────────
// 가운데 심장에서 다섯 갈래가 뻗는다. 갈래마다 세 단계다.
//
//   1단계  기본 강화 — 네모. 갈래의 입구다
//   2단계  양자택일 — **마름모.** 모양이 다르면 「여기서 갈린다」가
//          설명 없이 읽힌다. 둘 사이는 점선으로 잇고, 하나를 찍으면
//          반대편에 ✕ 가 뜬다
//   3단계  마무리 — 네모. 갈래의 끝
//
// 공용 갈래만 다르다 — 네 칸이 전부 1단계라 부채꼴로 편다.
//
// ── 좌표 ────────────────────────────────────────────────────
// 720×720 안에서 계산하고 화면에는 **비율(%)로 얹는다.** 그래야 창 크기가
// 바뀌어도 선과 칸이 같이 움직인다. 선은 SVG 라 viewBox 가 알아서 늘어난다.
// (창이 화면 밖에 그려진 사고를 겪었으므로, 고정 픽셀은 안 쓴다.)

import { NODES } from '../game/skilltree.js';
import { iconHTML } from '../core/assets.js';

const CX = 360, CY = 360;
const R1 = 122, R2 = 216, R3 = 302;
const SPREAD = 0.235;              // 2단계 두 칸이 갈라지는 각(라디안) — ±13도쯤

/** 갈래 — 각도는 화면 기준이다 (0 = 오른쪽, 양수 = 아래) */
const BRANCHES = [
  { skill: 'cleave', name: '회전 베기', icon: '🌀', hue: '#6f9fff', a: -Math.PI / 2 },
  { skill: 'dash', name: '그림자 돌진', icon: '💨', hue: '#a887ff', a: -Math.PI / 2 + 1.2566 },
  { skill: 'nova', name: '화염 신성', icon: '🔥', hue: '#ff8a2b', a: -Math.PI / 2 + 2.5133 },
  { skill: 'meteor', name: '운석 낙하', icon: '☄', hue: '#e35b5b', a: -Math.PI / 2 + 3.7699 },
  { skill: 'common', name: '공용', icon: '◆', hue: '#d8b45e', a: -Math.PI / 2 + 5.0265 },
];

/** 칸마다 글자 하나. 그림을 못 그리니 **모양으로 구분**한다 */
const GLYPH = {
  cleaveWide: '◠', cleaveCombo: '≫', cleaveRend: '✂', cleaveWhirl: '✹',
  dashAfter: '❯', dashPierce: '⇉', dashBlast: '✸', dashChain: '↻',
  novaLinger: '❂', novaSpread: '✺', novaFocus: '◉', novaRekindle: '✦',
  meteorAim: '⊕', meteorShards: '✱', meteorDirect: '◎', meteorWake: '❉',
  comMana: '◈', comWick: '✧', comGrit: '❖', comSense: '⬥',
};

const pos = (a, r) => ({ x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r });

/**
 * 칸 하나하나가 화면 어디에 놓이는가. **한 번만 계산한다** —
 * 찍을 때마다 다시 계산하면 칸이 미세하게 흔들린다.
 */
function layout() {
  const nodes = [];      // { id, x, y, shape, hue, branch }
  const links = [];      // { x1,y1,x2,y2, from, to, kind }
  for (const b of BRANCHES) {
    const root = pos(b.a, 52);
    if (b.skill === 'common') {
      // 공용 — 네 칸이 전부 1단계다. 두 줄 부채꼴로 편다
      const fan = [
        ['comMana', -SPREAD, R1], ['comWick', SPREAD, R1],
        ['comGrit', -SPREAD, R2], ['comSense', SPREAD, R2],
      ];
      const by = {};
      for (const [id, off, r] of fan) {
        const p = pos(b.a + off, r);
        by[id] = p;
        nodes.push({ id, ...p, shape: 'round', hue: b.hue, branch: b });
      }
      links.push({ ...root, x2: by.comMana.x, y2: by.comMana.y, x1: root.x, y1: root.y, from: null, to: 'comMana' });
      links.push({ x1: root.x, y1: root.y, x2: by.comWick.x, y2: by.comWick.y, from: null, to: 'comWick' });
      links.push({ x1: by.comMana.x, y1: by.comMana.y, x2: by.comGrit.x, y2: by.comGrit.y, from: 'comMana', to: 'comGrit' });
      links.push({ x1: by.comWick.x, y1: by.comWick.y, x2: by.comSense.x, y2: by.comSense.y, from: 'comWick', to: 'comSense' });
      continue;
    }
    const ids = Object.keys(NODES).filter((id) => NODES[id].skill === b.skill);
    const t1 = ids.find((id) => NODES[id].tier === 1);
    const t2 = ids.filter((id) => NODES[id].tier === 2);
    const t3 = ids.find((id) => NODES[id].tier === 3);

    const p1 = pos(b.a, R1);
    nodes.push({ id: t1, ...p1, shape: 'tile', hue: b.hue, branch: b });
    links.push({ x1: root.x, y1: root.y, x2: p1.x, y2: p1.y, from: null, to: t1 });

    const pa = pos(b.a - SPREAD, R2), pb = pos(b.a + SPREAD, R2);
    nodes.push({ id: t2[0], ...pa, shape: 'gem', hue: b.hue, branch: b });
    nodes.push({ id: t2[1], ...pb, shape: 'gem', hue: b.hue, branch: b });
    links.push({ x1: p1.x, y1: p1.y, x2: pa.x, y2: pa.y, from: t1, to: t2[0] });
    links.push({ x1: p1.x, y1: p1.y, x2: pb.x, y2: pb.y, from: t1, to: t2[1] });
    // 양자택일 표시 — 두 칸을 잇는 점선. 「여기서 갈린다」
    links.push({ x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, from: t2[0], to: t2[1], kind: 'xor' });

    const p3 = pos(b.a, R3);
    nodes.push({ id: t3, ...p3, shape: 'tile', hue: b.hue, branch: b });
    links.push({ x1: pa.x, y1: pa.y, x2: p3.x, y2: p3.y, from: t2[0], to: t3 });
    links.push({ x1: pb.x, y1: pb.y, x2: p3.x, y2: p3.y, from: t2[1], to: t3 });
  }
  return { nodes, links };
}

const L = layout();
const pct = (v) => `${(v / 720) * 100}%`;

/**
 * 한 칸의 상태. **찍을 수 있는지는 SkillTree 에게 묻는다** — 여기서 다시
 * 판단하면 규칙이 두 곳에 생기고, 언젠가 둘이 어긋난다.
 */
function stateOf(T, id) {
  if (T.taken.has(id)) return 'on';
  const n = NODES[id];
  if (n.excl && T.taken.has(n.excl)) return 'off';
  return T.canTake(id) ? 'can' : 'far';
}

/**
 * 트리를 그린다.
 * @param body  #treeBody
 * @param T     SkillTree
 * @param onTake  찍었을 때 부를 것 (토스트·다시 그리기는 호출부 몫)
 */
export function renderTreeGraph(body, T, onTake) {
  body.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'tgraph';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 720 720');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  for (const l of L.links) {
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ln.setAttribute('x1', l.x1); ln.setAttribute('y1', l.y1);
    ln.setAttribute('x2', l.x2); ln.setAttribute('y2', l.y2);
    // **선이 켜지는 조건**: 양쪽이 다 찍혔을 때만. 한쪽만 찍힌 선까지 켜면
    // 화면이 온통 빨개져서 「어디까지 갔나」가 안 보인다.
    const lit = (l.from === null || T.taken.has(l.from)) && T.taken.has(l.to);
    ln.setAttribute('class', 'tlink' + (l.kind === 'xor' ? ' xor' : '') + (lit ? ' lit' : ''));
    svg.appendChild(ln);
  }
  wrap.appendChild(svg);

  // 심장 — 갈래가 모이는 곳. 남은 포인트를 여기에 띄운다
  const hub = document.createElement('div');
  hub.className = 'thub' + (T.points > 0 ? ' has' : '');
  hub.innerHTML = `<b>◈</b><span>${T.points}</span>`;
  hub.title = `남은 포인트 ${T.points}`;
  wrap.appendChild(hub);

  // 갈래 이름은 **바깥 끝**에 붙인다. 처음에 심장 옆(r=52)에 뒀더니
  // 다섯 개가 가운데 한 뼘 안에 뭉쳐서 서로 겹쳤고, 어느 게 어느 갈래인지
  // 오히려 안 보였다. 갈래는 밖으로 뻗으므로 이름도 밖에 있어야 한다.
  for (const b of BRANCHES) {
    const r = b.skill === 'common' ? R2 + 70 : R3 + 46;
    const p = pos(b.a, r);
    // **가장자리 안으로 가둔다.** 옆으로 뻗은 갈래(그림자 돌진)는 이름이
    // 720 칸의 96% 지점에 놓여, 가운데 정렬이라 절반이 창 밖으로 나갔다.
    const clamp = (v) => Math.max(64, Math.min(656, v));
    const lab = document.createElement('div');
    lab.className = 'tbranch';
    lab.style.left = pct(clamp(p.x)); lab.style.top = pct(clamp(p.y));
    lab.style.color = b.hue;
    lab.innerHTML = `<i>${iconHTML(b.icon)}</i><span>${b.name}</span>`;
    wrap.appendChild(lab);
  }

  const info = document.createElement('div');
  info.className = 'tinfo';
  const clearInfo = () => {
    info.innerHTML = `<b>스킬 트리</b><span>칸에 손을 올리면 설명이 나온다 · `
      + `마름모는 <b>둘 중 하나만</b> 찍을 수 있다</span>`;
  };
  clearInfo();

  for (const nd of L.nodes) {
    const n = NODES[nd.id];
    const st = stateOf(T, nd.id);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `tn ${nd.shape} ${st}`;
    el.style.left = pct(nd.x); el.style.top = pct(nd.y);
    el.style.setProperty('--hue', nd.hue);
    el.innerHTML = `<i>${iconHTML(GLYPH[nd.id] || '◆', nd.id)}</i>`
      + (st === 'on' ? '<u>✔</u>' : st === 'off' ? '<u class="x">✕</u>' : '');
    const show = () => {
      info.innerHTML = `<b style="color:${nd.hue}">${n.name}</b>`
        + `<span>${n.desc}</span>`
        + (n.excl ? `<em>${NODES[n.excl].name} 와 택일</em>` : '')
        + (st === 'off' ? '<em class="no">반대편을 찍어서 못 찍는다</em>'
          : st === 'far' ? '<em class="no">포인트가 없다</em>' : '');
    };
    el.addEventListener('mouseenter', show);
    el.addEventListener('focus', show);
    el.addEventListener('mouseleave', clearInfo);
    el.addEventListener('blur', clearInfo);
    if (st === 'can') el.addEventListener('click', () => onTake(nd.id, n));
    wrap.appendChild(el);
  }

  body.appendChild(wrap);
  body.appendChild(info);
}
