// 픽셀아트를 문자열 배열로 정의하고 Canvas로 렌더링 — 외부 이미지 파일 없음.
// 각 문자는 팔레트의 색 인덱스. '.'은 투명.
// 팔레트 스왑: 같은 픽셀맵에 다른 팔레트를 적용해 변종을 만든다 (기획안 §11.1).
const Sprites = (() => {
  const sprites = {};
  const whites = new Map();
  const tints = new Map();

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

  function tintOf(img, color = '#b13ae0', alpha = 0.45) {
    const key = img.width + ':' + img.height + ':' + color + ':' + (img.__tid || (img.__tid = Math.random()));
    if (!tints.has(key)) {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, c.width, c.height);
      tints.set(key, c);
    }
    return tints.get(key);
  }

  // ══════════════ 원본 픽셀맵 (팔레트 스왑으로 재사용) ══════════════

  const PLAYER_ROWS = [
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
  ];

  const SLIME_ROWS = [
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
  ];

  const ARCHER_ROWS = [
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
  ];

  const BOAR_ROWS = [
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
  ];

  const REAPER_ROWS = [
    '......kkkkkk......',
    '.....kkkkkkkk.....',
    '....kkkkkkkkkk....',
    '....kkwwwwwwkk....',
    '...kkwwwwwwwwkk...',
    '...kkwrwwwwrwkk...',
    '...kkwwwwwwwwkk...',
    '....kkwmmmmwkk....',
    '.....kkkkkkkk.....',
    '....pppppppppp....',
    '...pppppppppppp...',
    '..pppppppppppppp..',
    '..pppqqppppqqppp..',
    '..pppppppppppppp..',
    '..pppppppppppppp..',
    '..ppp.pppp.ppp....',
    '...pp..ppp..pp....',
    '..................',
  ];

  const MUSHROOM_ROWS = [
    '................',
    '......mmmm......',
    '....mmmmmmmm....',
    '...mmMMmmMMmm...',
    '..mmmmmmmmmmmm..',
    '..MmmmmmmmmmmM..',
    '...ssssssssss...',
    '.....ssssss.....',
    '.....sksskss....',
    '.....ssssss.....',
    '....ss....ss....',
  ];

  const BAT_ROWS = [
    '................',
    '.ww..........ww.',
    '.wwww......wwww.',
    '..wwwwwwwwwwww..',
    '..wwwbbbbbbwww..',
    '...wbbkbbkbbw...',
    '....bbbbbbbb....',
    '.....b.bb.b.....',
  ];

  const SPIDER_ROWS = [
    '................',
    '..l..l....l..l..',
    '...l.l.ll.l.l...',
    '....bbbbbbbb....',
    '...bbrrbbrrbb...',
    '...bbbbbbbbbb...',
    '..l.bbbbbbbb.l..',
    '..l..bbbbbb..l..',
    '.l....bbbb....l.',
    '.l............l.',
  ];

  const GOLEM_ROWS = [
    '................',
    '....gggggggg....',
    '...gggggggggg...',
    '...ggkkggkkgg...',
    '...gggggggggg...',
    '..ggddggggddgg..',
    '.gg.gggggggg.gg.',
    '.gg.gggggggg.gg.',
    '.gg.dggggggd.gg.',
    '....gggggggg....',
    '....ggg..ggg....',
    '....ggg..ggg....',
    '...dggg..gggd...',
  ];

  const WRAITH_ROWS = [
    '................',
    '......wwww......',
    '....wwwwwwww....',
    '...wwwwwwwwww...',
    '...wwkwwwwkww...',
    '...wwwwwwwwww...',
    '....wwwmmwww....',
    '...wwwwwwwwww...',
    '...wwwwwwwwww...',
    '....wwwwwwww....',
    '....ww.ww.ww....',
    '.....w..w..w....',
  ];

  const NECRO_ROWS = [
    '................',
    '......nnnn......',
    '.....nnnnnn.....',
    '.....nffffn.....',
    '.....nfgfgn.....',
    '.....nnnnnn.....',
    '....nnnnnnnn....',
    '...nnnnnnnnnn...',
    '...nn.nnnn.nn...',
    '...nnnnnnnnnn...',
    '...nnnnnnnnnn...',
    '...nn.nnnn.nn...',
    '....n..nn..n....',
  ];

  // ══════════════ 스프라이트 생성 ══════════════

  sprites.player = make(PLAYER_ROWS, {
    h: '#94a1b8', f: '#f0c297', k: '#1a1c2c',
    t: '#3b5dc9', y: '#f7b32b', d: '#29366f', b: '#6b4034',
  });

  // 일반 적
  sprites.slime = make(SLIME_ROWS, {
    g: '#38b764', a: '#a7f070', d: '#257179', W: '#f4f4f4', k: '#1a1c2c',
  });
  sprites.toxicSlime = make(SLIME_ROWS, { // 팔레트 스왑: 독 슬라임
    g: '#8a3a8c', a: '#c56cf0', d: '#5c1e5e', W: '#d8f070', k: '#1a1c2c',
  });
  sprites.archer = make(ARCHER_ROWS, {
    w: '#e8e0cf', m: '#a99e8c', k: '#5c1e1e',
  });
  sprites.boar = make(BOAR_ROWS, {
    b: '#8d5a3b', d: '#5e3a26', k: '#1a1c2c', w: '#f4f4f4',
  });
  sprites.lavaHound = make(BOAR_ROWS, { // 팔레트 스왑: 용암 개
    b: '#d35400', d: '#7a1010', k: '#ffd866', w: '#ffd866',
  });
  sprites.mushroom = make(MUSHROOM_ROWS, {
    m: '#8a5ac2', M: '#d8c8f0', s: '#d9cbb8', k: '#1a1c2c',
  });
  sprites.bat = make(BAT_ROWS, {
    w: '#5c5c74', b: '#3a2a52', k: '#e43b44',
  });
  sprites.spider = make(SPIDER_ROWS, {
    b: '#241832', r: '#e43b44', l: '#3a3a4a',
  });
  sprites.golem = make(GOLEM_ROWS, {
    g: '#5d6b84', d: '#3d4a5c', k: '#5ce0e6',
  });
  sprites.wraith = make(WRAITH_ROWS, {
    w: '#a9c1d8', k: '#16121f', m: '#5d6b84',
  });
  sprites.fireSpirit = make(WRAITH_ROWS, { // 팔레트 스왑: 화염 정령
    w: '#ff9a3c', k: '#7a1010', m: '#ffd866',
  });
  sprites.necro = make(NECRO_ROWS, {
    n: '#2a4a3a', f: '#120d16', g: '#38b764',
  });

  // 보스
  sprites.boss = make(REAPER_ROWS, { // 1층: 무덤지기 카론
    k: '#16121f', w: '#e8e0cf', r: '#b13ae0', m: '#a99e8c',
    p: '#241832', q: '#4a3070',
  });
  sprites.bossSpore = make(MUSHROOM_ROWS, { // 2층: 포자왕 (거대 렌더링)
    m: '#38b764', M: '#d8f070', s: '#e8e0cf', k: '#5c1e5e',
  });
  sprites.bossGolem = make(GOLEM_ROWS, { // 3층: 간수장 (거대 렌더링)
    g: '#6b7a94', d: '#454f63', k: '#e43b44',
  });
  sprites.bossIgnis = make(WRAITH_ROWS, { // 4층: 용암 심장 (거대 렌더링)
    w: '#ff7043', k: '#ffd866', m: '#7a1010',
  });
  sprites.bossAbyss = make(REAPER_ROWS, { // 5층: 심연의 군주
    k: '#0a0612', w: '#c9b8e8', r: '#e43b44', m: '#5c1e5e',
    p: '#16101f', q: '#8a1c2c',
  });

  // 오브젝트
  const chestPal = { b: '#5e3a26', B: '#8d5a3b', g: '#f7b32b', k: '#120d16' };
  sprites.chest = make([
    '................',
    '..bbbbbbbbbbbb..',
    '.bBBBBBBBBBBBBb.',
    '.bBBBBBBBBBBBBb.',
    '.bggggggggggggb.',
    '.bBBBBBBggBBBBb.',
    '.bBBBBBBggBBBBb.',
    '.bBBBBBBBBBBBBb.',
    '.bbbbbbbbbbbbbb.',
    '................',
  ], chestPal);
  sprites.chestOpen = make([
    '.bbbbbbbbbbbbbb.',
    '.bkkkkkkkkkkkkb.',
    '.bkkkkkkkkkkkkb.',
    '.bbbbbbbbbbbbbb.',
    '.bggggggggggggb.',
    '.bBBBBBBBBBBBBb.',
    '.bBBBBBBBBBBBBb.',
    '.bBBBBBBBBBBBBb.',
    '.bbbbbbbbbbbbbb.',
    '................',
  ], chestPal);

  sprites.gem = make([
    '...c...',
    '..ccc..',
    '.ccCcc.',
    'ccCCCcc',
    '.ccCcc.',
    '..ccc..',
    '...c...',
  ], { c: '#2ec4b6', C: '#a9fff7' });

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

  sprites.arrow = make([
    '........',
    'ssssssww',
    '........',
  ], { s: '#a99e8c', w: '#f4f4f4' });

  return { ...sprites, white: whiteOf, tint: tintOf };
})();
