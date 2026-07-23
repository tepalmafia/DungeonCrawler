// 픽셀아트를 문자열 배열로 정의하고 Canvas로 렌더링 — 외부 이미지 파일 없음.
// 각 문자는 팔레트의 색 인덱스. '.'은 투명.
const Sprites = (() => {
  const sprites = {};
  const whites = new Map(); // 피격 플래시용 흰색 버전 캐시

  function make(rows, pal) {
    const h = rows.length;
    const w = rows[0].length;
    for (const r of rows) {
      if (r.length !== w) throw new Error('픽셀맵 행 길이 불일치: ' + r);
    }
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        if (ch === '.') continue;
        const color = pal[ch];
        if (!color) throw new Error('팔레트에 없는 문자: ' + ch);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }

  function whiteOf(img) {
    if (!whites.has(img)) {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      whites.set(img, c);
    }
    return whites.get(img);
  }

  // ── 플레이어: 검사 ──────────────────────────────
  sprites.player = make([
    '................',
    '......hhhh......',
    '.....hhhhhh.....',
    '....hhhhhhhh....',
    '....hffffffh....',
    '....hfkffkfh....',
    '.....ffffff.....',
    '....tttttttt....',
    '...tttttttttt...',
    '...ttttyytttt...',
    '...tttttttttt...',
    '....tt....tt....',
    '....dd....dd....',
    '....dd....dd....',
    '...bbb....bbb...',
    '................',
  ], {
    h: '#94a1b8', f: '#f0c297', k: '#1a1c2c',
    t: '#3b5dc9', y: '#f7b32b', d: '#29366f', b: '#6b4034',
  });

  // ── 슬라임 ──────────────────────────────────────
  sprites.slime = make([
    '................',
    '................',
    '................',
    '......gggg......',
    '....gaagggga....',
    '...gaggggggggg..',
    '..ggWkggggWkgg..',
    '..gggggggggggg..',
    '.gggggggggggggg.',
    '.gggggggggggggg.',
    '..dddddddddddd..',
    '................',
  ], {
    g: '#38b764', a: '#a7f070', d: '#257179', W: '#f4f4f4', k: '#1a1c2c',
  });

  // ── 해골 궁수 ───────────────────────────────────
  sprites.archer = make([
    '................',
    '......wwww......',
    '.....wwwwww.....',
    '.....wkwwkw.....',
    '.....wwwwww.....',
    '......mmmm......',
    '.......ww.......',
    '.....wwwwww.....',
    '....ww.ww.ww....',
    '.....w.ww.w.....',
    '.......ww.......',
    '......w..w......',
    '......w..w......',
    '.....ww..ww.....',
    '................',
    '................',
  ], {
    w: '#e8e0cf', m: '#a99e8c', k: '#5c1e1e',
  });

  // ── 돌진 멧돼지 ─────────────────────────────────
  sprites.boar = make([
    '................',
    '..dd............',
    '.dddd......dd...',
    '.ddbbbbbbbbddb..',
    'dbbbbbbbbbbbbbb.',
    'bbbbbbbbbbbkbb..',
    '.bbbbbbbbbbbbbw.',
    '.bbbbbbbbbbbbb..',
    '..bbb.bb.bb.b...',
    '..dd..dd.dd.d...',
    '................',
    '................',
  ], {
    b: '#8d5a3b', d: '#5e3a26', k: '#1a1c2c', w: '#f4f4f4',
  });

  // ── HUD 하트 ────────────────────────────────────
  const heartMap = [
    '.rr..rr.',
    'rArrrrrr',
    'rrrrrrrr',
    '.rrrrrr.',
    '..rrrr..',
    '...rr...',
  ];
  sprites.heart = make(heartMap, { r: '#e43b44', A: '#f5817e' });
  sprites.heartEmpty = make(heartMap, { r: '#3a3a4a', A: '#4a4a5c' });

  // ── 화살 (오른쪽 방향 기준, 코드에서 회전) ───────
  sprites.arrow = make([
    '........',
    'ssssssww',
    '........',
  ], { s: '#a99e8c', w: '#f4f4f4' });

  return { ...sprites, white: whiteOf };
})();
