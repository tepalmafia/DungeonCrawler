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

  // 일부 행만 바꾼 변형 픽셀맵 생성 (걷기/공격 프레임용)
  function withRows(rows, replacements) {
    const out = [...rows];
    for (const [idx, row] of Object.entries(replacements)) out[Number(idx)] = row;
    return out;
  }

  // 공격 자세: 오른팔을 앞으로 뻗는다 (좌우는 flip으로 처리)
  const PLAYER_TOP_ATTACK = withRows(PLAYER_TOP, {
    12: '.....ffttttttttttffff...',
  });

  sprites.playerFrames = {};
  for (const key of Object.keys(CLASS_PALETTES)) {
    const pal = CLASS_PALETTES[key];
    sprites.playerFrames[key] = [
      make([...PLAYER_TOP, ...PLAYER_LEGS_STAND], pal),
      make([...PLAYER_TOP, ...PLAYER_LEGS_APART], pal),
      make([...PLAYER_TOP, ...PLAYER_LEGS_CROSS], pal),
      make([...PLAYER_TOP_ATTACK, ...PLAYER_LEGS_STAND], pal), // [3] 공격 자세
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

  // ══════════════ 적 걷기·공격 프레임 (행 치환 변형) ══════════════

  const ARCHER_WALK2 = withRows(ARCHER_ROWS, {
    15: '........ww....ww........',
    16: '........ww....ww........',
    17: '.......ww......ww.......',
    18: '......www......www......',
  });
  const ARCHER_AIM = withRows(ARCHER_ROWS, { // 팔을 앞으로 뻗은 조준 자세
    10: '......ww.wwwwwwwwww.....',
  });

  const BOAR_WALK2 = withRows(BOAR_ROWS, {
    13: '..dbb.dbbb...dbb.dbbb...',
    14: '...db..db.....db..db....',
  });

  const GOLEM_WALK2 = withRows(GOLEM_ROWS, {
    14: '.....ggggg....ggggg.....',
    15: '.....ggggg....ggggg.....',
    16: '....dggggd....dggggd....',
    17: '....gggggg....gggggg....',
  });
  const GOLEM_SLAM = withRows(GOLEM_ROWS, { // 두 팔을 들어올린 내려찍기 자세
    5: '..gg.gggggggggggggg.gg..',
    6: '..gg.dggggggggggggd.gg..',
    7: '..gg..gggggggggggg..gg..',
    8: '......ggddggggddgg......',
    9: '......gggggggggggg......',
    10: '......gggggggggggg......',
    11: '......ggggddddgggg......',
    12: '......dggggggggggd......',
  });

  const SPIDER_WALK2 = withRows(SPIDER_ROWS, {
    3: '....l....l....l....l....',
    4: '...l....ll....ll....l...',
    5: '....l...ll....ll...l....',
    11: '..l...bbbbbbbbbbbb...l..',
    12: '.l.....bbbbbbbbbb.....l.',
    14: 'l........bbbbbb........l',
  });

  const NECRO_WALK2 = withRows(NECRO_ROWS, {
    17: '......nn..nnnn..nn......',
    18: '......n....nn....n......',
  });
  const NECRO_SUMMON = withRows(NECRO_ROWS, { // 두 팔을 들어올린 소환 자세
    8: '..s....nnnnnnnnnn....s..',
    9: '..nn..nnnnnnnnnnnn..nn..',
    10: '...nn..nnnnnnnnnn..nn...',
    11: '......nnnnnnnnnnnn......',
    12: '........nnnnnnnn........',
  });

  const MUSHROOM_WALK2 = withRows(MUSHROOM_ROWS, {
    14: '......sss......sss......',
  });

  const PAL = {
    archer: { w: '#e8e0cf', m: '#8a8074', k: '#5c1e1e' },
    boar: { b: '#8d5a3b', B: '#a4714e', d: '#5e3a26', k: '#1a1c2c', w: '#f4f4f4' },
    lavaHound: { b: '#d35400', B: '#f07a2a', d: '#7a1010', k: '#ffd866', w: '#ffd866' },
    golem: { g: '#5d6b84', d: '#3d4a5c', k: '#5ce0e6' },
    spider: { b: '#2a1c3d', r: '#e43b44', l: '#4a4a5c' },
    necro: { n: '#2a4a3a', f: '#0d0b14', g: '#38b764', s: '#d9cbb8', N: '#1c3328' },
    mushroom: { m: '#8a5ac2', M: '#d8c8f0', D: '#5c3a8a', s: '#d9cbb8', k: '#1a1c2c' },
  };

  sprites.enemyFrames = {
    archer:    { walk: [sprites.archer, make(ARCHER_WALK2, PAL.archer)], attack: make(ARCHER_AIM, PAL.archer) },
    boar:      { walk: [sprites.boar, make(BOAR_WALK2, PAL.boar)] },
    lavaHound: { walk: [sprites.lavaHound, make(BOAR_WALK2, PAL.lavaHound)] },
    golem:     { walk: [sprites.golem, make(GOLEM_WALK2, PAL.golem)], attack: make(GOLEM_SLAM, PAL.golem) },
    spider:    { walk: [sprites.spider, make(SPIDER_WALK2, PAL.spider)] },
    necro:     { walk: [sprites.necro, make(NECRO_WALK2, PAL.necro)], attack: make(NECRO_SUMMON, PAL.necro) },
    mushroom:  { walk: [sprites.mushroom, make(MUSHROOM_WALK2, PAL.mushroom)] },
  };

  // ══════════════ 보스 전용 대형 스프라이트 ══════════════
  // pad(): 가장 긴 행 기준으로 오른쪽을 투명으로 채워 행 길이를 맞춘다
  function pad(rows) {
    const w = Math.max(...rows.map((r) => r.length));
    return rows.map((r) => r.padEnd(w, '.'));
  }

  // ══════════════ 심층(6~10층) 전용 몬스터 — 신규 원화 + 신규 행동 ══════════════

  // 폭탄벌레 (6층): 다가와서 자폭한다
  sprites.bomber = make(pad([
    '............s',
    '...........ff',
    '..........ff',
    '.......bbbbbb',
    '.....bbbbbbbbbb',
    '....bBBbbbbbbBBb',
    '...bbbbbbbbbbbbbb',
    '...bbRRbbbbbbRRbb',
    '...bbbbbbbbbbbbbb',
    '....bbbbBBBBbbbb',
    '.....bbBBBBBBbb',
    '......bbbbbbbb',
    '.....l..l..l..l',
  ]), {
    b: '#5c3a3a', B: '#8a5c50', R: '#ff4757', f: '#d9cbb8', s: '#ffd866', l: '#2a1c1c',
  });

  // 가시덩굴 (7층): 고정 포탑, 가시 산탄
  sprites.thornPlant = make(pad([
    '.....t....t....t',
    '..t...t..t...t',
    '....ppppppppp',
    '..tpppppppppppt',
    '..ppPPppppPPppp',
    '.tppPPppppPPppt..t',
    '..ppppppppppppp',
    '...pppRRRRppp',
    '....ppppppppp',
    '......ss.ss',
    '.....sss.sss',
  ]), {
    p: '#4a7a3f', P: '#7ab04c', t: '#d9cbb8', R: '#8a1c2c', s: '#5e3a26',
  });

  // 처형자 (8층): 도끼 내려찍기 (직사각 텔레그래프)
  sprites.executioner = make(pad([
    '.......hhhhhh......X',
    '......hhhhhhhh....XX',
    '......hrrrrrrh....XXx',
    '......hhhhhhhh.....x',
    '....aaaahhhhaaaa...x',
    '...aaaaaaaaaaaaaa..x',
    '...aa.aaaaaaaa.ax..x',
    '...aa.aaaaaaaa.axxxx',
    '...aa.aaddddaa.aa..x',
    '......aaaaaaaa.....x',
    '......aaaaaaaa',
    '......aaa..aaa',
    '......aaa..aaa',
    '.....aaaa..aaaa',
  ]), {
    h: '#5d6b84', r: '#e43b44', a: '#3d3d52', d: '#2a2a3a', x: '#5e3a26', X: '#c8d4e4',
  });

  // 마그마 슬라임 (9층): 죽으면 둘로 갈라진다 (용암 균열 껍질)
  sprites.magmaSlime = make(pad([
    '.......mmmmmm',
    '.....mmmmmmmmmm',
    '....mmccmmmmccmm',
    '...mmmmmmccmmmmm',
    '...mWkmmmmmmWkmm',
    '..mmmccmmmmmccmmm',
    '..mmmmmmmccmmmmmm',
    '..mccmmmmmmmmccmm',
    '...DDDDDDDDDDDDD',
  ]), {
    m: '#4a1f1a', c: '#ff7043', W: '#ffd866', k: '#1a1c2c', D: '#2a0f0d',
  });

  // 공허의 눈 (10층): 도약 회피 + 추적탄
  sprites.voidEye = make(pad([
    '.....kkkkkk',
    '...kkkkkkkkkk',
    '..kkwwwwwwwwkk',
    '.kkwwwwwwwwwwkk',
    '.kkwwwRRRRwwwkk',
    '.kkwwRRrrRRwwkk',
    '.kkwwwRRRRwwwkk',
    '..kkwwwwwwwwkk',
    '...kkkkkkkkkk',
    '..t..t....t..t',
    '.t....t..t....t',
  ]), {
    k: '#241832', w: '#c9b8e8', R: '#b13ae0', r: '#0a0612', t: '#3d2c5c',
  });

  // ══════════════ 확장 몬스터 20종 (신규 원화 + 신규 행동) ══════════════

  // 해골 병사: 녹슨 검 — 찌르기 돌진
  sprites.skeleton = make(pad([
    '.....wwww',
    '....wwwwww',
    '....wkwwkw',
    '....wwwwww',
    '.....wmw......s',
    '...wwwwwww...ss',
    '..w.wwwww.w.ss',
    '..w.wwwww.wss',
    '..w..www..gg',
    '......w...gg',
    '....wwwww',
    '....w...w',
    '...ww...ww',
  ]), { w: '#d8d3c5', k: '#1a1c2c', m: '#8a8074', s: '#8a9a8a', g: '#5e3a26' });

  // 방패 해골: 전면 대형 방패
  sprites.shieldSkeleton = make(pad([
    '.....wwww....B',
    '....wwwwww..BB',
    '....wkwwkw..BB',
    '....wwwwww.BBBB',
    '.....wmw...BBBB',
    '...wwwwwww.BBBB',
    '..w.wwwww..BBBB',
    '..w.wwwww..BBBB',
    '..w..www...BBBB',
    '......w.....BB',
    '....wwwww...BB',
    '....w...w....B',
    '...ww...ww',
  ]), { w: '#d8d3c5', k: '#1a1c2c', m: '#8a8074', B: '#3a7ca5' });

  // 저격 해골: 후드 + 장궁
  sprites.sniper = make(pad([
    '....hhhhhh',
    '...hhhhhhhh',
    '...hhkwwkhh',
    '...hhwwwwhh....l',
    '....hhwwhh....ll',
    '..hhhhhhhhh..ll',
    '..h.hhhhh.h.ll',
    '..h.hhhhh.lll',
    '..h..hhh..ll',
    '......h..ll',
    '....hhhhh',
    '....h...h',
    '...hh...hh',
  ]), { h: '#3d3d52', k: '#e43b44', w: '#d8d3c5', l: '#8a6a3a' });

  // 벌레 떼: 아주 작은 벌레 (4마리씩 몰려온다)
  sprites.swarm = make(pad([
    '..k..k',
    '.kbbbbk',
    '.bBBBBb',
    '.bbbbbb',
    '..l..l',
  ]), { k: '#1a1c2c', b: '#5c3a5c', B: '#8a5a8a', l: '#2a1c2c' });

  // 독두꺼비: 도약 + 착지 독 장판
  sprites.frog = make(pad([
    '...gg......gg',
    '..gkgg....ggkg',
    '..gggggggggggg',
    '.gggGGGGGGgggg',
    '.ggGGGGGGGGgg',
    '.gggggggggggg',
    'ggsggggggggsgg',
    'gg..gggggg..gg',
    '.....g..g',
  ]), { g: '#4a7a3f', G: '#7ab04c', k: '#ffd866', s: '#38543a' });

  // 흡혈 거머리: 마디 지렁이
  sprites.leech = make(pad([
    '......rr',
    '....rrRRrr',
    '...rrRRRRrr',
    '..rrRRrrRRrr',
    '..rRRrrrrRRr',
    '..rrrr..rrrr',
    '...rr....rr',
    '...k......k',
  ]), { r: '#6a1c2c', R: '#a43a4a', k: '#1a0c12' });

  // 서리 슬라임: 죽으면 빙판
  sprites.iceSlime = make(pad([
    '......c.cc',
    '....ccccccc',
    '...ccCCCCccc',
    '..ccCCwwCCcc',
    '..cCCwkkwCCc.c',
    '..ccCCCCCCcc',
    '.ccccccccccccc',
    '..cccccccccc',
  ]), { c: '#7ab8d8', C: '#b8e0f0', w: '#ffffff', k: '#1a1c2c' });

  // 서리 궁수: 2연발 얼음 화살
  sprites.frostArcher = make(pad([
    '.....bbbb',
    '....bbbbbb',
    '....bkwwkb',
    '....bwwwwb.....l',
    '.....bmmb.....ll',
    '...bbbbbbbb..ll',
    '..b.bbbbb.b.ll',
    '..b.bbbbb.lll',
    '..b..bbb..ll',
    '......b..ll',
    '....bbbbb',
    '....b...b',
    '...bb...bb',
  ]), { b: '#3a6a9a', k: '#5ce0e6', w: '#d8ecf5', m: '#a9c1d8', l: '#8a9ab0' });

  // 광전사: 쌍도끼 오크 — 피가 모자라면 격노
  sprites.berserker = make(pad([
    '..a...........a',
    '.aaa..rrrr...aaa',
    '.aa..rrrrrr..aa',
    '..a..rkrrkr..a',
    '..a..rrrrrr..a',
    '..aa.rrmmrr.aa',
    '...rrrrrrrrrr',
    '..r.rrrrrrrr.r',
    '..r.rrrrrrrr.r',
    '..r..rrrrrr..r',
    '.....rr..rr',
    '....rrr..rrr',
  ]), { r: '#a43a3a', k: '#ffd866', m: '#6a1c1c', a: '#8a9ab0' });

  // 도깨비불: 원을 그리며 접근하는 불꽃
  sprites.wisp = make(pad([
    '.....ff',
    '....ffff',
    '...ffFFff',
    '..ffFFFFff',
    '..fFFwwFFf',
    '..fFwkkwFf',
    '..ffFFFFff',
    '...ffffff',
    '....ffff',
  ]), { f: '#3a8ac0', F: '#7ac0e8', w: '#e0f5ff', k: '#1a1c2c' });
  // 주술사: 아군을 치유하는 토템 가면
  sprites.shaman = make(pad([
    '....t.tt.t',
    '....tttttt',
    '...ttwwwwtt',
    '...twkwwkwt',
    '...ttwmmwtt',
    '....tttttt',
    '..ggttttttgg',
    '..g.tttttt.g',
    '..g.tttttt.g',
    '....tt..tt',
    '...ttt..ttt',
  ]), { t: '#6a4a8a', w: '#d9cbb8', k: '#38b764', m: '#4a2a5a', g: '#8a6a3a' });

  // 수정 정령: 죽으면 파편 사방 발사
  sprites.crystal = make(pad([
    '......c',
    '.....ccc',
    '....cCCCc',
    '...cCCwCCc',
    '..cCCwwwCCc',
    '..cCCCwCCCc',
    '...cCCCCCc',
    '....cCCCc',
    '.....ccc',
    '..c...c...c',
    '.ccc.....ccc',
  ]), { c: '#7a5ac2', C: '#b89ae8', w: '#f0e8ff' });

  // 구울: 시체를 먹고 강해진다
  sprites.ghoul = make(pad([
    '.....gggg',
    '....gggggg',
    '....grggrg',
    '....gggggg',
    '.....gmmg',
    '...gggggggg',
    '..gggggggggg',
    '..g.gggggg.g',
    '..g.gggggg.g',
    '.gg..gggg..gg',
    '.....g..g',
    '....gg..gg',
  ]), { g: '#6a7a5a', r: '#e43b44', m: '#3a4a30' });

  // 뿔벌레: 3연속 짧은 돌진
  sprites.charger = make(pad([
    '.h..........h',
    '.hh........hh',
    '..hhbbbbbbhh',
    '...bbBBBBbb',
    '..bbBBBBBBbb',
    '..bkbBBBBbkb',
    '..bbbbbbbbbb',
    '...l.l..l.l',
  ]), { h: '#d8d3c5', b: '#5a3a2a', B: '#8a5a3a', k: '#ffd866', l: '#2a1c12' });

  // 마력 포탑: 회전 탄막
  sprites.turret = make(pad([
    '.....mm',
    '....mMMm',
    '...mMwwMm',
    '...mMwwMm',
    '....mMMm',
    '...ssssss',
    '...ssssss',
    '..ssssssss',
    '..ssssssss',
    '.ssssssssss',
  ]), { m: '#8a5ac2', M: '#b89ae8', w: '#f0e8ff', s: '#5d6b84' });

  // 미믹: 깨어난 모습 (잠들 땐 보물상자로 위장)
  sprites.mimic = make(pad([
    '...ggggggggg',
    '..gGGGGGGGGGg',
    '..gGGGGGGGGGg',
    '..gwwGwwGwwg',
    '..grrrrrrrrg',
    '..gwwGwwGwwg',
    '..gGGGGGGGGGg',
    '...ggggggggg',
    '....l.....l',
  ]), { g: '#8a6a3a', G: '#c09a4a', w: '#f0e8d5', r: '#6a1020', l: '#3a2a12' });

  // 그림자 추적자: 등 뒤로 순간이동
  sprites.stalker = make(pad([
    '.....kkkk',
    '....kkkkkk',
    '....krkkrk',
    '....kkkkkk',
    '.....kkkk......s',
    '...kkkkkkkk...ss',
    '..k.kkkkkk.k.ss',
    '..k.kkkkkk.ss',
    '..k..kkkk.ss',
    '......kk.ss',
    '....kkkkk',
    '....k...k',
    '...kk...kk',
  ]), { k: '#241832', r: '#b13ae0', s: '#4a3a5c' });

  // 덩치: 넓은 부채꼴 몽둥이 휘두르기
  sprites.brute = make(pad([
    '.....bbbbbb.....g',
    '....bbbbbbbb...gg',
    '....bkbbbbkb...gg',
    '....bbbbbbbb..gg',
    '.....bmmmmb...gg',
    '..bbbbbbbbbbb.gg',
    '.bbbbbbbbbbbbgg',
    '.bb.bbbbbbbb.gg',
    '.bb.bbbbbbbb.g',
    '.bb..bbbbbb..g',
    '.....bb..bb',
    '....bbb..bbb',
  ]), { b: '#7a5a4a', k: '#ffd866', m: '#4a3226', g: '#5e3a26' });

  // 임프: 짧은 순간이동 + 화염구
  sprites.imp = make(pad([
    '..r.......r',
    '.rr.......rr',
    '..rrrrrrrrr',
    '..rrkrrkrr',
    '..rrrrrrrr',
    '...rmmmmr',
    '...rrrrrr',
    '..r.rrrr.r',
    '....r..r',
    '...rr..rr',
  ]), { r: '#c04a3a', k: '#ffd866', m: '#6a1c12' });

  // 식탐귀: 빨아들인 뒤 깨문다
  sprites.glutton = make(pad([
    '.....pppppp',
    '...pppppppppp',
    '..ppkppppppkpp',
    '..pppppppppppp',
    '.pwwwwwwwwwwwwp',
    '.pRRRRRRRRRRRRp',
    '.pwwwwwwwwwwwwp',
    '..pppppppppppp',
    '...pppppppppp',
    '....pp....pp',
  ]), { p: '#8a6a9a', k: '#ffd866', w: '#f0e8d5', R: '#4a1020' });

  // 1층: 무덤지기 카론 — 낫을 든 사신
  sprites.boss = make(pad([
    '..........kkkkkkkkkk',
    '........kkkkkkkkkkkkkk',
    '.......kkkkkkkkkkkkkkkk',
    '......kkkkkkkkkkkkkkkkkk....bb',
    '......kkkkwwwwwwwwkkkkkk...bbb',
    '.....kkkwwwwwwwwwwwwkkkk..bbbb',
    '.....kkkwwwwwwwwwwwwkkk..bbbb',
    '.....kkwwrrwwwwwwrrwwkk..bbb',
    '.....kkwwrrwwwwwwrrwwkk..bbb',
    '.....kkkwwwwwwwwwwwwkkk...bb',
    '......kkwwmmwwwwmmwwkk....ss',
    '......kkkwmmmmmmmmwkkk....ss',
    '.......kkkwwmmmmwwkkk.....ss',
    '........kkkkkkkkkkkk......ss',
    '......ppppppppppppppp.....ss',
    '.....pppppppppppppppppp...ss',
    '....pppppqqqqqqqqqqppppp..ss',
    '...pppppppppppppppppppppp.ss',
    '...pppppppppppppppppppp.ssss',
    '...ppppppppppppppppppppwsssw',
    '...pqqpppppppppppppppp..ss',
    '...pppppppppppppppppppp.ss',
    '...pppppppppppppppppppp.ss',
    '...ppppppppppppppppppp..ss',
    '....pppppp.pppppppppp...ss',
    '....ppppp...ppppppppp...ss',
    '.....pppp....pppp.ppp...ss',
    '.....ppp......ppp..pp',
    '......pp.......pp',
    '.......p........p',
  ]), {
    k: '#16121f', w: '#e8e0cf', r: '#b13ae0', m: '#8a8074',
    p: '#241832', q: '#4a3070', s: '#6b4a34', b: '#c8d4e4',
  });

  // 2층: 포자왕 믹서스 — 거대 버섯 군주
  sprites.bossSpore = make(pad([
    '...............mmmmmmmmmm',
    '...........mmmmmmmmmmmmmmmm',
    '.........mmmmmmMMMMmmmmmmmmmm',
    '.......mmmmmmmMMMMMMmmmmmmmmmm',
    '......mmmmmmmmmMMMMmmmmmmMMmmmm',
    '.....mmmMMmmmmmmmmmmmmmmMMMMmmmm',
    '....mmmMMMMmmmmmmmmmmmmmmMMmmmmmm',
    '....mmmmMMmmmmmmmmmmmmmmmmmmmmmmm',
    '...mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
    '...mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
    '...DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
    '....DDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
    '.......ssssssssssssssssssssss',
    '......ssssssssssssssssssssssss',
    '......ssskkkssssssssssskkksss',
    '......ssskkkssssssssssskkksss',
    '......ssssssssssssssssssssssss',
    '......sssssrrrrrrrrrrrrsssssss',
    '......ssssrrSSSSSSSSSSrrssssss',
    '......sssssssssssssssssssssss',
    '.......sssssssssssssssssssss',
    '.......SsssssssssssssssssssS',
    '........ssss...ssss...ssss',
    '.......sss......sss....sss',
  ]), {
    m: '#38b764', M: '#d8f070', D: '#1d7a42',
    s: '#e8e0cf', S: '#b8ae9c', k: '#5c1e5e', r: '#8a3a8c',
  });

  // 3층: 간수장 바르곤 — 사슬 묶인 거대 골렘
  sprites.bossGolem = make(pad([
    '..........gggggggggggggggg',
    '........gggggggggggggggggggg',
    '........ggGGGGGGGGGGGGGGGGgg',
    '........ggkkkkggggggkkkkggg',
    '........ggkkkkggggggkkkkggg',
    '........gggggggddddggggggg',
    '......dggggggggggggggggggggd',
    '....ggg.ggggggggggggggggg.ggg',
    '...gggg.ggddggggggggddgg.gggg',
    '..ggggg.gggggggggggggggg.ggggg',
    '..gggdg.gggggggggggggggg.gdggg',
    '..ggggg.ggggddddddddgggg.ggggg',
    '..cgggg.gggddggggggddggg.ggggc',
    '..cdggg.gggggggggggggggg.gggdc',
    '..ggggg..dggggggggggggd..ggggg',
    '...ggg....gggggggggggg....ggg',
    '...ccc....gggggggggggg....ccc',
    '...c.c....ggggg..ggggg....c.c',
    '..........ggggg..ggggg',
    '..........ggggg..ggggg',
    '.........dggggd..dggggd',
    '.........gggggg..gggggg',
  ]), {
    g: '#6b7a94', d: '#454f63', G: '#8a9ab4', k: '#e43b44', c: '#9aa0b4',
  });

  // 4층: 용암 심장 이그니스 — 백열하는 화염 정령체
  sprites.bossIgnis = make(pad([
    '................oo',
    '...........oo..oooo..oo',
    '..........oooo.oooo.oooo',
    '..........ooooooooooooooo',
    '.........ooooyyyyyyyyoooo',
    '........oooyyyyyyyyyyyyooo',
    '.......oooyyyyyyyyyyyyyyoo',
    '.......ooyyykkyyyyyykkyyyoo',
    '.......ooyyykkyyyyyykkyyyoo',
    '......oooyyyyyyyyyyyyyyyyooo',
    '......ooyyyyWWWWWWWWyyyyyyoo',
    '......ooyyyWWWWWWWWWWyyyyyoo',
    '......ooyyyWWWWWWWWWWyyyyyoo',
    '......oooyyyWWWWWWWWyyyyyooo',
    '.......ooyyyyyyyyyyyyyyyyoo',
    '.......rooyyyyyyyyyyyyyyoor',
    '.......roooyyyyyyyyyyyyooor',
    '........roooyyyyyyyyyyooor',
    '........rrooooyyyyyyooorr',
    '.........rroooo.ooooorr',
    '..........rroo...oorr',
    '...........rr.....rr',
  ]), {
    o: '#ff7043', y: '#ffd866', W: '#fff7d0', r: '#7a1010', k: '#4a0a0a',
  });

  // 5층: 심연의 군주 눅스 — 왕관과 뿔을 지닌 그림자 군주
  sprites.bossAbyss = make(pad([
    '...KK..................KK',
    '..KKK......cccccc......KKK',
    '..KK....cc.cccccc.cc....KK',
    '..KK....cccccccccccc....KK',
    '...KK..kkkkkkkkkkkkkk..KK',
    '...KKkkkkkkkkkkkkkkkkkkKK',
    '....kkkkkkkkkkkkkkkkkkkk',
    '....kkkwwwwwwwwwwwwwwkkk',
    '...kkkwwwwwwwwwwwwwwwwkkk',
    '...kkwwrrrwwwwwwwwrrrwwkk',
    '...kkwwrrrwwwwwwwwrrrwwkk',
    '...kkkwwwwwwwwwwwwwwwwkkk',
    '....kkwwwmmmmmmmmmmwwkk',
    '.....kkkwwmmmmmmwwkkkk',
    '......kkkkkkkkkkkkkkk',
    '....pppppppppppppppppp',
    '...pppppppppppppppppppp',
    '..ppppqqqqppppppqqqqpppp',
    '..pppppppppppppppppppppp',
    '..pqqpppppppppppppppppqp',
    '..pppppppppppppppppppppp',
    '..pppppppppppppppppppppp',
    '...ppppp.pppppppp.ppppp',
    '...pppp...pppppp...pppp',
    '....ppp....pppp.....ppp',
    '.....pp.....pp.......pp',
    '......p......p',
  ]), {
    K: '#3d2c5c', c: '#f7b32b', k: '#0a0612', w: '#c9b8e8',
    r: '#e43b44', m: '#5c1e5e', p: '#16101f', q: '#8a1c2c',
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
