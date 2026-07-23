// 픽셀아트를 문자열 배열로 정의하고 Canvas로 렌더링 — 외부 이미지 파일 없음.
// [아트 리마스터] 24×24 해상도 + 3단계 명암 + 자동 1px 아웃라인.
// 팔레트 스왑: 같은 픽셀맵에 다른 팔레트를 적용해 변종을 만든다 (기획안 §11.1).
const Sprites = (() => {
  const sprites = {};
  const whites = new Map();
  const tints = new Map();
  const OUTLINE = '#0d0b14';

  function make(rows, pal, { outline = true } = {}) {
    const h = rows.length;
    const w = rows[0].length;
    for (const r of rows) {
      if (r.length !== w) throw new Error('픽셀맵 행 길이 불일치(' + r.length + '/' + w + '): ' + r);
    }
    // 원본 픽셀
    const base = document.createElement('canvas');
    base.width = w;
    base.height = h;
    const bctx = base.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        if (ch === '.') continue;
        const color = pal[ch];
        if (!color) throw new Error('팔레트에 없는 문자: ' + ch);
        bctx.fillStyle = color;
        bctx.fillRect(x, y, 1, 1);
      }
    }
    if (!outline) return base;

    // 실루엣을 8방향으로 찍어 1px 아웃라인 자동 생성
    const sil = document.createElement('canvas');
    sil.width = w;
    sil.height = h;
    const sctx = sil.getContext('2d');
    sctx.drawImage(base, 0, 0);
    sctx.globalCompositeOperation = 'source-in';
    sctx.fillStyle = OUTLINE;
    sctx.fillRect(0, 0, w, h);

    const c = document.createElement('canvas');
    c.width = w + 2;
    c.height = h + 2;
    const ctx = c.getContext('2d');
    for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2], [0, 0], [2, 0], [0, 2], [2, 2]]) {
      ctx.drawImage(sil, dx, dy);
    }
    ctx.drawImage(base, 1, 1);
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

  // ══════════════ 플레이어 (24×24, 걷기 프레임 3장) ══════════════
  // 상체 공통 + 다리 프레임 3종 (정지 / 벌림 / 모음)

  const PLAYER_TOP = [
    '........................',
    '.........hhhhhh.........',
    '........hhhhhhhh........',
    '.......hhhhhhhhhh.......',
    '.......hhHHHHHHhh.......',
    '.......hHffffffHh.......',
    '.......hHfkffkfFh.......',
    '.......hHffffffFh.......',
    '........FffmmffF........',
    '.........ffffff.........',
    '.......tttttttttt.......',
    '......tttttttttttt......',
    '.....ffttttttttttff.....',
    '.....ffttyyyyyyttff.....',
    '.....FfttttttttttfF.....',
    '......TttttttttttT......',
    '.......TTttttttTT.......',
  ];
  const PLAYER_LEGS_STAND = [
    '.......dddd..dddd.......',
    '.......dddd..dddd.......',
    '.......dddd..dddd.......',
    '......bbbbb..bbbbb......',
    '......BbbbB..BbbbB......',
    '........................',
    '........................',
  ];
  const PLAYER_LEGS_APART = [
    '......dddd....dddd......',
    '......dddd....dddd......',
    '......dddd....dddd......',
    '.....bbbbb....bbbbb.....',
    '.....BbbbB....BbbbB.....',
    '........................',
    '........................',
  ];
  const PLAYER_LEGS_CROSS = [
    '........dddddddd........',
    '........dddddddd........',
    '........dddddddd........',
    '.......bbbbbbbbb........',
    '.......BbbbbbbbB........',
    '........................',
    '........................',
  ];

  const CLASS_PALETTES = {
    player: { // 검사
      h: '#b8c4d8', H: '#7a8aa4', f: '#f0c297', F: '#c99a6e', m: '#b97a5a', k: '#1a1c2c',
      t: '#4a6ede', T: '#2c4a9e', y: '#f7b32b', d: '#29366f', b: '#6b4034', B: '#4a2a20',
    },
    playerArcher: { // 궁수 (초록 후드)
      h: '#3d9960', H: '#256b42', f: '#f0c297', F: '#c99a6e', m: '#b97a5a', k: '#1a1c2c',
      t: '#38b764', T: '#1d7a42', y: '#d9cbb8', d: '#1d4a33', b: '#5e3a26', B: '#3d2418',
    },
    playerMage: { // 마도사 (보라 로브)
      h: '#8a5ac2', H: '#5c2e8a', f: '#f0c297', F: '#c99a6e', m: '#b97a5a', k: '#1a1c2c',
      t: '#9a6ad2', T: '#6a3aa2', y: '#ffd866', d: '#3d1e5c', b: '#29366f', B: '#1a2148',
    },
  };

  sprites.playerFrames = {};
  for (const key of Object.keys(CLASS_PALETTES)) {
    const pal = CLASS_PALETTES[key];
    sprites.playerFrames[key] = [
      make([...PLAYER_TOP, ...PLAYER_LEGS_STAND], pal),
      make([...PLAYER_TOP, ...PLAYER_LEGS_APART], pal),
      make([...PLAYER_TOP, ...PLAYER_LEGS_CROSS], pal),
    ];
    sprites[key] = sprites.playerFrames[key][0]; // 정지 프레임 (거점 미리보기·잔상용)
  }

  // ══════════════ 적 픽셀맵 (24×24, 팔레트 스왑 재사용) ══════════════

  const SLIME_ROWS = [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '.........gggggg.........',
    '.......gggggggggg.......',
    '......agggggggggggg.....',
    '.....aaggggggggggggg....',
    '....ggggWWkggggWWkggg...',
    '....gggggggggggggggg....',
    '...gggggggggggggggggg...',
    '...gggggggggggggggggg...',
    '...GggggggggggggggggGG..',
    '....GGGGGGGGGGGGGGGG....',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ];

  const ARCHER_ROWS = [
    '........................',
    '.........wwwwww.........',
    '........wwwwwwww........',
    '.......wwwwwwwwww.......',
    '.......wwkkwwkkww.......',
    '.......wwkkwwkkww.......',
    '.......wwwwwwwwww.......',
    '........wmwmwmww........',
    '..........wwww..........',
    '.......wwwwwwwwww.......',
    '......ww.wwwwww.ww......',
    '......ww.w.ww.w.ww......',
    '......ww.wwwwww.ww......',
    '.........w.ww.w.........',
    '..........wwww..........',
    '.........ww..ww.........',
    '.........ww..ww.........',
    '.........ww..ww.........',
    '........www..www........',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ];

  const BOAR_ROWS = [
    '........................',
    '........................',
    '........................',
    '........................',
    '...dd...................',
    '..dddd..........ddd.....',
    '..ddBBBBBBBBBBBBddd.....',
    '.ddBBBBBBBBBBBBBBdd.....',
    'ddbbbbbbbbbbbbbbbbbbd...',
    'dbbbbbbbbbbbbbbbbkbbb...',
    '.bbbbbbbbbbbbbbbbbbbbw..',
    '.bbbbbbbbbbbbbbbbbbbww..',
    '..bbbbbbbbbbbbbbbbbbb...',
    '..dbbb.dbbb..dbbb.dbb...',
    '..dbb..dbb...dbb..db....',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ];

  const MUSHROOM_ROWS = [
    '........................',
    '........................',
    '.........mmmmmm.........',
    '.......mmmmmmmmmm.......',
    '......mmMMmmmmMMmm......',
    '.....mmmmmmmmmmmmmm.....',
    '....mMMmmmmmmmmmmMMm....',
    '....mmmmmmmmmmmmmmmm....',
    '.....DDDDDDDDDDDDDD.....',
    '.......ssssssssss.......',
    '........ssssssss........',
    '........skssksss........',
    '........ssssssss........',
    '........ssssssss........',
    '.......sss....sss.......',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ];

  const BAT_ROWS = [
    '........................',
    '........................',
    '........................',
    '..ww................ww..',
    '..wwww............wwww..',
    '..wwwwww........wwwwww..',
    '...wwwwwww....wwwwwww...',
    '....wwwwbbbbbbbbwwww....',
    '.....wwbbkbbbbkbbww.....',
    '......bbbbbbbbbbbb......',
    '.......bbbffbbbb........',
    '........b..bb..b........',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ];

  const SPIDER_ROWS = [
    '........................',
    '........................',
    '........................',
    '...l....l......l....l...',
    '....l...ll....ll...l....',
    '.....l..ll....ll..l.....',
    '......llbbbbbbbbll......',
    '.......bbrrbbrrbb.......',
    '......bbbrrbbrrbbb......',
    '.....bbbbbbbbbbbbbb.....',
    '....llbbbbbbbbbbbbll....',
    '...l..bbbbbbbbbbbb..l...',
    '..l....bbbbbbbbbb....l..',
    '.l......bbbbbbbb......l.',
    '.l.......bbbbbb.......l.',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ];

  const GOLEM_ROWS = [
    '........................',
    '......gggggggggggg......',
    '.....gggggggggggggg.....',
    '.....ggkkkggggkkkgg.....',
    '.....ggkkkggggkkkgg.....',
    '.....gggggggggggggg.....',
    '....dggggggggggggggd....',
    '...gg.gggggggggggg.gg...',
    '..ggg.ggddggggddgg.ggg..',
    '..ggg.gggggggggggg.ggg..',
    '..ggg.gggggggggggg.ggg..',
    '..dgg.ggggddddgggg.ggd..',
    '..gg..dggggggggggd..gg..',
    '......gggggggggggg......',
    '......ggggg..ggggg......',
    '......ggggg..ggggg......',
    '.....dggggd..dggggd.....',
    '.....gggggg..gggggg.....',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ];

  const WRAITH_ROWS = [
    '........................',
    '........................',
    '.........wwwwww.........',
    '.......wwwwwwwwww.......',
    '......wwwwwwwwwwww......',
    '......wwkkwwwwkkww......',
    '......wwkkwwwwkkww......',
    '......wwwwwwwwwwww......',
    '.......wwwmmmmwww.......',
    '......wwwwwmmwwwww......',
    '.....wwwwwwwwwwwwww.....',
    '.....wwwwwwwwwwwwww.....',
    '.....WwwwwwwwwwwwwW.....',
    '......wwwwwwwwwwww......',
    '......www.wwww.www......',
    '.......ww..ww..ww.......',
    '........w...w...w.......',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ];

  const NECRO_ROWS = [
    '........................',
    '.........nnnnnn.........',
    '........nnnnnnnn........',
    '........nnnnnnnn........',
    '........nffffffn........',
    '........nfgffgfn........',
    '........nffffffn........',
    '.........nnnnnn.........',
    '.......nnnnnnnnnn.......',
    '......nnnnnnnnnnnn......',
    '.....snn.nnnnnn.nns.....',
    '.....snn.nnnnnn.nns.....',
    '......n..nnnnnn..n......',
    '.........nnnnnn.........',
    '........nnnnnnnn........',
    '........nnnnnnnn........',
    '........nNnnnnNn........',
    '.......nn.nnnn.nn.......',
    '.......n...nn...n.......',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ];

  const REAPER_ROWS = [
    '........kkkkkkkk........',
    '.......kkkkkkkkkk.......',
    '......kkkkkkkkkkkk......',
    '......kkwwwwwwwwkk......',
    '.....kkwwwwwwwwwwkk.....',
    '.....kkwrrwwwwrrwkk.....',
    '.....kkwwwwwwwwwwkk.....',
    '......kkwmmmmmmwkk......',
    '.......kkkkkkkkkk.......',
    '......pppppppppppp......',
    '.....pppppppppppppp.....',
    '....ppqqqppppppqqqpp....',
    '...pppppppppppppppppp...',
    '...pppppppppppppppppp...',
    '...pqppppppppppppppqp...',
    '...pppppppppppppppppp...',
    '...ppp.pppppppp.pppp....',
    '....pp..pppppp..ppp.....',
    '....p...pppp....pp......',
    '.........pp.............',
    '........................',
    '........................',
    '........................',
    '........................',
  ];

  // ══════════════ 스프라이트 생성 (팔레트 스왑 변종 포함) ══════════════

  sprites.slime = make(SLIME_ROWS, {
    g: '#38b764', a: '#a7f070', G: '#257179', W: '#f4f4f4', k: '#1a1c2c',
  });
  sprites.toxicSlime = make(SLIME_ROWS, {
    g: '#8a3a8c', a: '#c56cf0', G: '#5c1e5e', W: '#d8f070', k: '#1a1c2c',
  });
  sprites.archer = make(ARCHER_ROWS, {
    w: '#e8e0cf', m: '#8a8074', k: '#5c1e1e',
  });
  sprites.boar = make(BOAR_ROWS, {
    b: '#8d5a3b', B: '#a4714e', d: '#5e3a26', k: '#1a1c2c', w: '#f4f4f4',
  });
  sprites.lavaHound = make(BOAR_ROWS, {
    b: '#d35400', B: '#f07a2a', d: '#7a1010', k: '#ffd866', w: '#ffd866',
  });
  sprites.mushroom = make(MUSHROOM_ROWS, {
    m: '#8a5ac2', M: '#d8c8f0', D: '#5c3a8a', s: '#d9cbb8', k: '#1a1c2c',
  });
  sprites.bat = make(BAT_ROWS, {
    w: '#5c5c74', b: '#3a2a52', k: '#ff4757', f: '#f4f4f4',
  });
  sprites.spider = make(SPIDER_ROWS, {
    b: '#2a1c3d', r: '#e43b44', l: '#4a4a5c',
  });
  sprites.golem = make(GOLEM_ROWS, {
    g: '#5d6b84', d: '#3d4a5c', k: '#5ce0e6',
  });
  sprites.wraith = make(WRAITH_ROWS, {
    w: '#a9c1d8', k: '#16121f', m: '#3d5068', W: '#7a94ac',
  });
  sprites.fireSpirit = make(WRAITH_ROWS, {
    w: '#ff9a3c', k: '#7a1010', m: '#ffd866', W: '#d97a20',
  });
  sprites.necro = make(NECRO_ROWS, {
    n: '#2a4a3a', f: '#0d0b14', g: '#38b764', s: '#d9cbb8', N: '#1c3328',
  });

  // 보스
  sprites.boss = make(REAPER_ROWS, { // 1층: 무덤지기 카론
    k: '#16121f', w: '#e8e0cf', r: '#b13ae0', m: '#8a8074',
    p: '#241832', q: '#4a3070',
  });
  sprites.bossAbyss = make(REAPER_ROWS, { // 5층: 심연의 군주
    k: '#0a0612', w: '#c9b8e8', r: '#e43b44', m: '#5c1e5e',
    p: '#16101f', q: '#8a1c2c',
  });
  sprites.bossSpore = make(MUSHROOM_ROWS, { // 2층: 포자왕 (거대 렌더링)
    m: '#38b764', M: '#d8f070', D: '#1d7a42', s: '#e8e0cf', k: '#5c1e5e',
  });
  sprites.bossGolem = make(GOLEM_ROWS, { // 3층: 간수장 (거대 렌더링)
    g: '#6b7a94', d: '#454f63', k: '#e43b44',
  });
  sprites.bossIgnis = make(WRAITH_ROWS, { // 4층: 용암 심장 (거대 렌더링)
    w: '#ff7043', k: '#ffd866', m: '#7a1010', W: '#d95420',
  });

  // ══════════════ 오브젝트 ══════════════

  const chestPal = { b: '#5e3a26', B: '#8d5a3b', L: '#a4714e', g: '#f7b32b', k: '#120d16' };
  sprites.chest = make([
    '........................',
    '........................',
    '........................',
    '...bbbbbbbbbbbbbbbbbb...',
    '..bLLLLLLLLLLLLLLLLLLb..',
    '..bBBBBBBBBBBBBBBBBBBb..',
    '..bBBBBBBBBBBBBBBBBBBb..',
    '..bggggggggggggggggggb..',
    '..bBBBBBBBBggggBBBBBBb..',
    '..bBBBBBBBBggggBBBBBBb..',
    '..bBBBBBBBBBBBBBBBBBBb..',
    '..bBBBBBBBBBBBBBBBBBBb..',
    '..bbbbbbbbbbbbbbbbbbbb..',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ], chestPal);
  sprites.chestOpen = make([
    '........................',
    '........................',
    '..bbbbbbbbbbbbbbbbbbbb..',
    '..bkkkkkkkkkkkkkkkkkkb..',
    '..bkkkkkkkkkkkkkkkkkkb..',
    '..bkkkkkkkkkkkkkkkkkkb..',
    '..bbbbbbbbbbbbbbbbbbbb..',
    '..bggggggggggggggggggb..',
    '..bBBBBBBBBBBBBBBBBBBb..',
    '..bBBBBBBBBBBBBBBBBBBb..',
    '..bBBBBBBBBBBBBBBBBBBb..',
    '..bBBBBBBBBBBBBBBBBBBb..',
    '..bbbbbbbbbbbbbbbbbbbb..',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
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
  ], { s: '#a99e8c', w: '#f4f4f4' }, { outline: false });

  return { ...sprites, white: whiteOf, tint: tintOf };
})();
