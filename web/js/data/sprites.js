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

  // ══════════════ 플레이어 (28×24, 직업별 전용 픽셀맵) ══════════════
  // [스프라이트 리워크] 4직업이 각자의 무기를 들고 있다 — 상체 17행 + 다리 7행.
  // 프레임: [0] 정지 / [1] 걷기-벌림 / [2] 걷기-모음 / [3] 공격(무기 액션) / [4] 피격(젖혀짐)

  const KNIGHT_IDLE = [ // 검사 — 대투구+깃털, 카이트 방패, 장검
    '..............rr............',
    '.............rrrr......w....',
    '...........hhhhhh......wW...',
    '..........hhhhhhhh.....wW...',
    '..........hkkkkkkh.....wW...',
    '..........hkokkokh.....wW...',
    '..........hHhhhhHh.....wW...',
    '..........hhhhhhhh.....wW...',
    '...........hhhhhh......wW...',
    '.......sss.tttttt.sss.yyyy..',
    '......ssssttttttttssss.mm...',
    '...eEEEeffttttttttff..fmmf..',
    '...eEyEeffttyyyyttff...yy...',
    '...eEEEeffttttttttff........',
    '....eEe.FfttttttttfF........',
    '.....e...TttttttttT.........',
    '...........TTttttTT.........',
  ];
  const KNIGHT_ATK = [
    '..............rr............',
    '.............rrrr...........',
    '...........hhhhhh...........',
    '..........hhhhhhhh..........',
    '..........hkkkkkkh..........',
    '..........hkokkokh..........',
    '..........hHhhhhHh..........',
    '..........hhhhhhhh..........',
    '...........hhhhhh...........',
    '.......sss.tttttt.sss.......',
    '......ssssttttttttssss......',
    '...eEEEeffttttttttffffywwwww',
    '...eEyEeffttyyyyttff...WWWW.',
    '...eEEEeffttttttttff........',
    '....eEe.FfttttttttfF........',
    '.....e...TttttttttT.........',
    '...........TTttttTT.........',
  ];
  const KNIGHT_HURT = [
    '.............rr.............',
    '............rrrr.......w....',
    '..........hhhhhh.......wW...',
    '.........hhhhhhhh......wW...',
    '.........hkkkkkkh......wW...',
    '.........hkkkkkkh......wW...',
    '.........hHhhhhHh......wW...',
    '.........hhhhhhhh......wW...',
    '..........hhhhhh.......wW...',
    '.......sss.tttttt.sss.yyyy..',
    '......ssssttttttttssss.mm...',
    '...eEEEeffttttttttff..fmmf..',
    '...eEyEeffttyyyyttff...yy...',
    '...eEEEeffttttttttff........',
    '....eEe.FfttttttttfF........',
    '.....e...TttttttttT.........',
    '...........TTttttTT.........',
  ];
  const ARCHER_IDLE = [ // 궁수 — 깊은 후드, 장궁+시위, 조준 화살
    '............hhhh............',
    '...........hhhhhh...........',
    '..........hhhhhhhh.....mm...',
    '.........hhhhhhhhhh...s.mM..',
    '.........hhkkkkkkhh...s.mM..',
    '.........hhkgkkgkhh...s.Mm..',
    '.........hhkkkkkkhh...s..mM.',
    '.........hHhffffhHh...s..mM.',
    '..........hRRRRRRh....s..mM.',
    '........ccttttttttcc..s.Mm..',
    '.......cctxttttttxtcc.s.mM..',
    '......ffttxxttxxttff.ffMm...',
    '......ffttyyyyyyttff..s.mM..',
    '......ffttttttttttff...mm...',
    '......FfttttttttttfF........',
    '........TttttttttttT........',
    '..........TTttttTT..........',
  ];
  const ARCHER_ATK = [
    '............hhhh............',
    '...........hhhhhh...........',
    '..........hhhhhhhh..........',
    '.........hhhhhhhhhh.........',
    '.........hhkkkkkkhh.........',
    '.........hhkgkkgkhh.........',
    '.........hhkkkkkkhh.........',
    '.........hHhffffhHh.........',
    '..........hRRRRRRh.....mm...',
    '........ccttttttttcc..s.mM..',
    '.......cctxttttttxtccs..mM..',
    '......ffttxxttxxttfffaaaaMw.',
    '......ffttyyyyyyttff.s..mM..',
    '......ffttttttttttff..s.mM..',
    '......FfttttttttttfF...mm...',
    '........TttttttttttT........',
    '..........TTttttTT..........',
  ];
  const ARCHER_HURT = [
    '...........hhhh.............',
    '..........hhhhhh............',
    '.........hhhhhhhh......mm...',
    '........hhhhhhhhhh....s.mM..',
    '........hhkkkkkkhh....s.mM..',
    '........hhkkkkkkhh....s.Mm..',
    '........hhkkkkkkhh....s..mM.',
    '........hHhffffhHh....s..mM.',
    '.........hRRRRRRh.....s..mM.',
    '........ccttttttttcc..s.Mm..',
    '.......cctxttttttxtcc.s.mM..',
    '......ffttxxttxxttff.ffMm...',
    '......ffttyyyyyyttff..s.mM..',
    '......ffttttttttttff...mm...',
    '......FfttttttttttfF........',
    '........TttttttttttT........',
    '..........TTttttTT..........',
  ];
  const MAGE_IDLE = [ // 마도사 — 별 장식 대모자, 수정 지팡이
    '.............pp........v....',
    '............pppp......vVv...',
    '...........ppyppp......v....',
    '..........pppppppp.....m....',
    '...........pppppp......m....',
    '........pppppppppppp...m....',
    '......pppppppppppppppp.m....',
    '.........hffffffffh....m....',
    '.........hfvffffvfh....m....',
    '..........ffwwwwff.....m....',
    '...........wwwwww......m....',
    '.........tttttttttt..ffm....',
    '........tttttttttttt...m....',
    '.......ffttyyyyyyttff..m....',
    '.......FfttttttttttfF..m....',
    '........TttttttttttT........',
    '.........TTttttttTT.........',
  ];
  const MAGE_ATK = [
    '.............pp.............',
    '............pppp............',
    '...........ppyppp...........',
    '..........pppppppp..........',
    '...........pppppp...........',
    '........pppppppppppp........',
    '......pppppppppppppppp......',
    '.........hffffffffh.........',
    '.........hfvffffvfh.........',
    '..........ffwwwwff.......V..',
    '...........wwwwww.......vV..',
    '.........ttttttttttffmmmvVVv',
    '........tttttttttttt....Vv..',
    '.......ffttyyyyyyttff....v..',
    '.......FfttttttttttfF.......',
    '........TttttttttttT........',
    '.........TTttttttTT.........',
  ];
  const MAGE_HURT = [
    '............pp.........v....',
    '...........pppp.......vVv...',
    '..........ppyppp.......v....',
    '.........pppppppp......m....',
    '..........pppppp.......m....',
    '.......pppppppppppp....m....',
    '.....pppppppppppppppp..m....',
    '........hffffffffh.....m....',
    '........hffffffffh.....m....',
    '..........ffwwwwff.....m....',
    '...........wwwwww......m....',
    '.........tttttttttt..ffm....',
    '........tttttttttttt...m....',
    '.......ffttyyyyyyttff..m....',
    '.......FfttttttttttfF..m....',
    '........TttttttttttT........',
    '.........TTttttttTT.........',
  ];
  const ALCH_IDLE = [ // 연금술사 — 황동 고글, 시약 탄띠, 투척 플라스크
    '...........qqqqqq...........',
    '..........qqqqqqqq..........',
    '.........GGGGGGGGGG.........',
    '.........GLLGGGGLLG.........',
    '.........GLLGGGGLLG.........',
    '.........ffffffffff.........',
    '..........ffffffff..........',
    '.........tttttttttt.........',
    '.......ttxttttttttttt.......',
    '......fftttxtttttttt........',
    '......ffttttxtttttttff.c....',
    '......ffxOxOxOxxttttf.vvv...',
    '......ffttttttttttttf.vOv...',
    '......Fftttttttttttt..vvv...',
    '.......FttttttttttttF.......',
    '........TttttttttttT........',
    '..........TTttttTT..........',
  ];
  const ALCH_ATK = [
    '...........qqqqqq....vOv....',
    '..........qqqqqqqq...vvv....',
    '.........GGGGGGGGGG...c.....',
    '.........GLLGGGGLLG..ff.....',
    '.........GLLGGGGLLG.f.......',
    '.........fffffffffff........',
    '..........ffffffff.f........',
    '.........ttttttttttf........',
    '.......ttxttttttttttt.......',
    '......fftttxtttttttt........',
    '......ffttttxttttttt........',
    '......ffxOxOxOxxtttt........',
    '......fftttttttttttt........',
    '......Fftttttttttttt........',
    '.......FttttttttttttF.......',
    '........TttttttttttT........',
    '..........TTttttTT..........',
  ];
  const ALCH_HURT = [
    '..........qqqqqq............',
    '.........qqqqqqqq...........',
    '........GGGGGGGGGG..........',
    '........GGGGGGGGGG..........',
    '........GGGGGGGGGG..........',
    '........ffffffffff..........',
    '.........ffffffff...........',
    '........tttttttttt..........',
    '.......ttxttttttttttt.......',
    '......fftttxtttttttt........',
    '......ffttttxtttttttff.c....',
    '......ffxOxOxOxxttttf.vvv...',
    '......ffttttttttttttf.vOv...',
    '......Fftttttttttttt..vvv...',
    '.......FttttttttttttF.......',
    '........TttttttttttT........',
    '..........TTttttTT..........',
  ];
  const PLAYER_LEGS_STAND = [
    '.........dddd..dddd.........',
    '.........dddd..dddd.........',
    '.........dddd..dddd.........',
    '........bbbbb..bbbbb........',
    '........BbbbB..BbbbB........',
    '............................',
    '............................',
  ];
  const PLAYER_LEGS_APART = [
    '........dddd....dddd........',
    '........dddd....dddd........',
    '........dddd....dddd........',
    '.......bbbbb....bbbbb.......',
    '.......BbbbB....BbbbB.......',
    '............................',
    '............................',
  ];
  const PLAYER_LEGS_CROSS = [
    '..........dddddddd..........',
    '..........dddddddd..........',
    '..........dddddddd..........',
    '.........bbbbbbbbb..........',
    '.........BbbbbbbbB..........',
    '............................',
    '............................',
  ];

  const CLASS_SPRITES = {
    player: {
      idle: KNIGHT_IDLE, attack: KNIGHT_ATK, hurt: KNIGHT_HURT,
      pal: { r: '#3a3a44', h: '#8a9484', H: '#5a6454', k: '#16121f', o: '#e43b44', s: '#6a7464', t: '#3a4a5e', T: '#242f3e', y: '#8a7a3a', f: '#707a6a', F: '#4a544a', w: '#c8ccc0', W: '#8a9488', m: '#5a4a3a', e: '#2a3a34', E: '#4a5e54', d: '#242f3e', b: '#3d4438', B: '#282e24' },
    },
    playerArcher: {
      idle: ARCHER_IDLE, attack: ARCHER_ATK, hurt: ARCHER_HURT,
      pal: { h: '#2e3a2e', H: '#1e281e', k: '#0d1410', g: '#ff6a5a', f: '#9aa88a', F: '#6a7a5e', c: '#4a3220', x: '#6a4a2e', t: '#2e4a3a', T: '#1a3226', y: '#8a8474', m: '#8a5e34', M: '#5a3c20', s: '#c8c0a8', a: '#a8845a', w: '#c8ccc0', R: '#7a5a2e', d: '#182a20', b: '#4a3220', B: '#2e2014' },
    },
    playerMage: {
      idle: MAGE_IDLE, attack: MAGE_ATK, hurt: MAGE_HURT,
      pal: { p: '#3a2e4a', h: '#7a7a72', f: '#9aa88a', F: '#6a7a5e', v: '#b13ae0', V: '#e0c8f8', w: '#8a8a82', t: '#4a3a5e', T: '#302644', y: '#8a7a3a', m: '#4a3c2e', d: '#241c30', b: '#2a2438', B: '#181420' },
    },
    playerAlch: {
      idle: ALCH_IDLE, attack: ALCH_ATK, hurt: ALCH_HURT,
      pal: { q: '#2e2e38', G: '#8a7a4a', L: '#a7f070', f: '#8a9a94', F: '#5e6e68', t: '#4a5a44', T: '#2e3a2a', x: '#443020', O: '#7ad94a', c: '#6a4a30', v: '#a7f070', d: '#242e20', b: '#443020', B: '#2a1e12' },
    },
  };

  sprites.playerFrames = {};
  for (const key of Object.keys(CLASS_SPRITES)) {
    const { idle, attack, hurt, pal } = CLASS_SPRITES[key];
    sprites.playerFrames[key] = [
      make([...idle, ...PLAYER_LEGS_STAND], pal),
      make([...idle, ...PLAYER_LEGS_APART], pal),
      make([...idle, ...PLAYER_LEGS_CROSS], pal),
      make([...attack, ...PLAYER_LEGS_STAND], pal),  // [3] 공격 — 무기를 내지른다
      make([...hurt, ...PLAYER_LEGS_APART], pal),    // [4] 피격 — 뒤로 젖혀진 채 버틴다
    ];
    sprites[key] = sprites.playerFrames[key][0]; // 정지 프레임 (거점 미리보기·잔상용)
  }

  // 일부 행만 바꾼 변형 픽셀맵 생성 (걷기/공격 프레임용)
  function withRows(rows, replacements) {
    const out = [...rows];
    for (const [idx, row] of Object.entries(replacements)) out[Number(idx)] = row;
    return out;
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
  const EXEC_ROWS = pad([
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
  ]);
  sprites.executioner = make(EXEC_ROWS, {
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
  const VOIDEYE_ROWS = pad([
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
  ]);
  sprites.voidEye = make(VOIDEYE_ROWS, {
    k: '#241832', w: '#c9b8e8', R: '#b13ae0', r: '#0a0612', t: '#3d2c5c',
  });

  // ══════════════ 확장 몬스터 20종 (신규 원화 + 신규 행동) ══════════════

  // 해골 병사: 녹슨 검 — 찌르기 돌진
  const SKELETON_ROWS = pad([
    '......WWWWW',
    '.....WWwwwwW',
    '.....Wwkwwkw',
    '.....Wwwwwww',
    '.....wwsmmsw',
    '......wwww.......rr',
    '...AAwwwwwwAA...rrr',
    '..AAs.wwwww.sA..rrr',
    '..As..wswsw..s..rr',
    '..ws..wwsww..ssrr',
    '..w...wswsw...gg',
    '......swwws...g',
    '.....sww.wws',
    '....sww...wws',
    '....Www...wwW',
  ]);
  sprites.skeleton = make(SKELETON_ROWS, {
    W: '#f0ece0', w: '#d8d3c5', s: '#a09a8a', m: '#6a665a', k: '#16121f',
    r: '#8a5a3a', g: '#5e3a26', A: '#5d6b84',
  });

  // 방패 해골: 전면 대형 방패
  const SHIELD_ROWS = pad([
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
  ]);
  sprites.shieldSkeleton = make(SHIELD_ROWS, { w: '#d8d3c5', k: '#1a1c2c', m: '#8a8074', B: '#3a7ca5' });

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
  const SWARM_ROWS = pad([
    '..k..k',
    '.kbbbbk',
    '.bBBBBb',
    '.bbbbbb',
    '..l..l',
  ]);
  sprites.swarm = make(SWARM_ROWS, { k: '#1a1c2c', b: '#5c3a5c', B: '#8a5a8a', l: '#2a1c2c' });

  // 독두꺼비: 도약 + 착지 독 장판
  sprites.frog = make(pad([
    '...gg........gg',
    '..gkGg......gGkg',
    '..gGGgggggggGGg',
    '.ggGGGGGGGGGGGg',
    '.gGGpGGGGGGpGGg',
    '.gGGGGGppGGGGGg',
    'ggdGGpGGGGpGGdgg',
    'gGdddGGGGGGdddGg',
    'gg.ddgggggddd.gg',
    '.....gg..gg',
    '....ggg..ggg',
  ]), {
    g: '#3f6a35', G: '#6a9a48', p: '#c9d94a', k: '#ffd866', d: '#2a4a24',
  });

  // 흡혈 거머리: 마디 지렁이
  const LEECH_ROWS = pad([
    '.......rr',
    '.....rrRRr',
    '....rRRrrRRr',
    '...rRRrRRrRRr',
    '..rRRrRRRRrRRr',
    '..rRrRRWWRRrRr',
    '..rrRRrWWrRRrr',
    '...rrrr..rrrr',
    '....rr....rr',
    '....k......k',
  ]);
  sprites.leech = make(LEECH_ROWS, {
    r: '#5a1424', R: '#8a3040', W: '#c05060', k: '#1a0c12',
  });

  // 서리 슬라임: 죽으면 빙판
  sprites.iceSlime = make(pad([
    '......W..cc..W',
    '....cccWccccW',
    '...ccCCCCCCccc',
    '..ccCCWWCCCCcc',
    '..cCCWkkWCCCCc.c',
    '..cCCCCCCCCCCc..W',
    '.ccCCcCCCCcCCcc',
    '.cccccccccccccc',
    '..dcccccccccd',
  ]), {
    c: '#5a9ac8', C: '#a8d8ee', W: '#f0faff', k: '#16202c', d: '#3a6a94',
  });

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
    '..aa...........aa',
    '.aAAa..rrrrrr..aAAa',
    '.aAa..rRRRRRRr..aAa',
    '..aa..RkRRRRkR..aa',
    '..a..rRRRRRRRRr..a',
    '..a..rRRmRRmRRr..a',
    '..aa..RRmmmmRR..aa',
    '...rrRRRRRRRRRRrr',
    '..rr.RRtRRRRtRR.rr',
    '..r..RRRRRRRRRR..r',
    '..r..rRRRRRRRRr..r',
    '.....RRRr..rRRR',
    '....RRRr....rRRR',
    '....rrr......rrr',
  ]), {
    r: '#8a2f2f', R: '#a94444', m: '#5c1a1a', k: '#ffd866', t: '#3a1010',
    a: '#8a9ab0', A: '#c8d4e4',
  });

  // 도깨비불: 원을 그리며 접근하는 불꽃
  sprites.wisp = make(pad([
    '......f',
    '.....ff.f',
    '....fFFff',
    '...fFFFFFf',
    '..fFFWWWFFf',
    '..fFWWwWWFf',
    '..fFWkWkWFf',
    '..fFWWWWWFf',
    '...fFFWFFf',
    '....fFFFf',
    '.....fff',
  ]), {
    f: '#2a6a9a', F: '#5aaad8', W: '#a8e0f8', w: '#e8f8ff', k: '#101820',
  });
  // 주술사: 아군을 치유하는 토템 가면
  const SHAMAN_ROWS = pad([
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
  ]);
  sprites.shaman = make(SHAMAN_ROWS, { t: '#6a4a8a', w: '#d9cbb8', k: '#38b764', m: '#4a2a5a', g: '#8a6a3a' });

  // 수정 정령: 죽으면 파편 사방 발사
  const CRYSTAL_ROWS = pad([
    '.......W',
    '......cWc',
    '.....cCWCc',
    '....cCCwCCc',
    '...cCCwwwCCc',
    '..cCCwwWwwCCc',
    '..cCCCwwwCCCc',
    '...dCCCwCCCd',
    '....dCCCCCd',
    '.....dCCCd',
    '......dcd',
    '..c....d....c',
    '.cWc.......cWc',
  ]);
  sprites.crystal = make(CRYSTAL_ROWS, {
    c: '#6a4aa8', C: '#9a7ad0', w: '#d8c8f8', W: '#ffffff', d: '#4a3078',
  });

  // 구울: 시체를 먹고 강해진다
  const GHOUL_ROWS = pad([
    '.......gGGGg',
    '......gGGGGGg',
    '......GrGGGrG',
    '......GGGGGGG',
    '.......GmmmG',
    '.....gGGGGGGGg',
    '....gGGGGGGGGGg',
    '...gG.GGGdGGG.Gg',
    '...gG.GGdddGG.Gg',
    '...g..GGGdGGG..g',
    '..gg..dGGGGGd..gg',
    '..bg...GGGGG...gb',
    '.......dG.Gd',
    '......gGG.GGg',
    '.....gGG...GGg',
  ]);
  sprites.ghoul = make(GHOUL_ROWS, {
    g: '#4a5a40', G: '#6a7a5a', d: '#3a4a30', r: '#e43b44', m: '#2a3220', b: '#7a2430',
  });

  // 뿔벌레: 3연속 짧은 돌진
  sprites.charger = make(pad([
    '.hh...........hh',
    '.Hhh.........hhH',
    '..Hhh.bbbbbb.hhH',
    '...hhbBBBBBBbhh',
    '...bbBBCCCCBBbb',
    '..bbBCCBBBBCCBb',
    '..bkbBBBBBBBBkb',
    '..bbbBdBBBBdBbb',
    '..dbbbbbbbbbbbd',
    '...dl.dl..ld.ld',
    '...ll.ll..ll.ll',
  ]), {
    h: '#c8beab', H: '#f0ece0', b: '#4a3020', B: '#7a5030', C: '#a5764a',
    d: '#2a1c12', k: '#ffd866', l: '#1a120c',
  });

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
  const STALKER_ROWS = pad([
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
  ]);
  sprites.stalker = make(STALKER_ROWS, { k: '#241832', r: '#b13ae0', s: '#4a3a5c' });

  // 덩치: 넓은 부채꼴 몽둥이 휘두르기
  const BRUTE_ROWS = pad([
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
  ]);
  sprites.brute = make(BRUTE_ROWS, { b: '#7a5a4a', k: '#ffd866', m: '#4a3226', g: '#5e3a26' });

  // 임프: 짧은 순간이동 + 화염구
  sprites.imp = make(pad([
    '..rr.........rr',
    '.rDr.........rDr',
    '..rDrrrrrrrrrDr',
    '...rRRRRRRRRr',
    '...RRkRRRRkRR',
    '...RRRRRRRRRR',
    '....RmmmmmmR',
    '....RRRRRRRR....f',
    '...R.RRRRRR.RR.ff',
    '.....RRRRRR...f',
    '.....RR..RR..D',
    '....rr....rrDD',
  ]), {
    r: '#8a2c20', R: '#c04a3a', D: '#5a1c14', k: '#ffd866', m: '#4a120c', f: '#ff9a3c',
  });

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

  // ══════════════ 신규 24종 — 팔레트 스왑 변종 (층 전용 로스터 확장) ══════════════
  // 같은 실루엣이라도 층이 달라 마주치지 않고, 팔레트·기믹이 완전히 다르다
  sprites.sporePuff = make(MUSHROOM_ROWS, { m: '#b8a0d0', M: '#ece4f8', D: '#8a6aa8', s: '#c9d94a', k: '#1a1c2c' });
  sprites.acidSnail = make(SLIME_ROWS, { g: '#8a8a3a', a: '#c9d94a', G: '#55561f', W: '#f0f0c0', k: '#1a1c2c' });
  sprites.jailer = make(EXEC_ROWS, { h: '#3a5a7c', r: '#5ce0e6', a: '#2c3c50', d: '#1d2836', x: '#8a6a3a', X: '#a9c1d8' });
  sprites.frostMage = make(SHAMAN_ROWS, { t: '#3a6a9a', w: '#e8f4fa', k: '#5ce0e6', m: '#24455e', g: '#a9c1d8' });
  sprites.cinder = make(SWARM_ROWS, { k: '#2a1208', b: '#d35400', B: '#ff9a3c', l: '#7a1010' });
  sprites.ashWalker = make(GOLEM_ROWS, { g: '#4a4448', d: '#2e2a30', k: '#ff7043' });
  sprites.emberMoth = make(BAT_ROWS, { w: '#d97a20', b: '#8a3a10', k: '#ffd866', f: '#ffd866' });
  sprites.acolyte = make(NECRO_ROWS, { n: '#3a2a5c', f: '#0d0b14', g: '#b13ae0', s: '#c9b8e8', N: '#241838' });
  sprites.shade = make(STALKER_ROWS, { k: '#101018', r: '#5c7cff', s: '#2a2a44' });
  sprites.gazer = make(VOIDEYE_ROWS, { k: '#182448', w: '#a8c0f0', R: '#4a6ede', r: '#080c1e', t: '#2c3c6e' });
  sprites.bloodBat = make(BAT_ROWS, { w: '#8a2430', b: '#5a1424', k: '#ffd866', f: '#ff4757' });
  sprites.boneHeap = make(SKELETON_ROWS, { W: '#e8dfc8', w: '#c8bfa8', s: '#948a72', m: '#5e564a', k: '#16121f', r: '#6a4a2a', g: '#4a3020', A: '#7a5a3a' });
  sprites.venomLasher = make(GHOUL_ROWS, { g: '#3f6a35', G: '#6a9a48', d: '#2a4a24', r: '#c9d94a', m: '#1d3318', b: '#55702a' });
  sprites.sporeMother = make(MUSHROOM_ROWS, { m: '#a04a7a', M: '#e8b8d0', D: '#702a52', s: '#c9b89a', k: '#1a1c2c' });
  sprites.acidSlug = make(LEECH_ROWS, { r: '#6a7a1a', R: '#9aa82a', W: '#d8e858', k: '#141a06' });
  // ── 2막 (11~20층, 균사 정원) 팔레트 스왑 ──
  sprites.sporeling = make(SLIME_ROWS, { g: '#7ab848', a: '#c9d94a', G: '#4a7a2a', W: '#f0f8d0', k: '#1a1c2c' });
  sprites.fungalTick = make(LEECH_ROWS, { r: '#4a6a2a', R: '#7a9a3a', W: '#c9d94a', k: '#141a06' });
  sprites.myceliumBrute = make(GOLEM_ROWS, { g: '#5a7a4a', d: '#3a5230', k: '#c9d94a' });
  sprites.rotWalker = make(GOLEM_ROWS, { g: '#6a5a3a', d: '#463a24', k: '#8adf76' });
  sprites.glowShrieker = make(SHAMAN_ROWS, { t: '#3a7a5a', w: '#d0f0c0', k: '#8adf76', m: '#1d4a33', g: '#c9d94a' });
  sprites.warden = make(BRUTE_ROWS, { b: '#4a5a74', k: '#5ce0e6', m: '#2c3850', g: '#1d2836' });
  sprites.chainWraith = make(WRAITH_ROWS, { w: '#8a8a9a', k: '#16121f', m: '#4a3a3a', W: '#c05060' });
  sprites.frostGolem = make(GOLEM_ROWS, { g: '#5a9ac8', d: '#3a6a94', k: '#f0faff' });
  sprites.obsidianBeast = make(BOAR_ROWS, { b: '#2c2434', B: '#443a54', d: '#181220', k: '#b13ae0', w: '#b13ae0' });
  sprites.flameJuggler = make(SHAMAN_ROWS, { t: '#c04a3a', w: '#ffd866', k: '#ff9a3c', m: '#7a1010', g: '#ffd866' });
  sprites.lavaBurster = make(CRYSTAL_ROWS, { c: '#a83a1a', C: '#e06030', w: '#ffd866', W: '#fff0c0', d: '#701d0a' });
  sprites.voidSpawn = make(SWARM_ROWS, { k: '#12081e', b: '#3d2c5c', B: '#7a5ac2', l: '#241838' });
  sprites.riftCaster = make(NECRO_ROWS, { n: '#241838', f: '#0d0b14', g: '#c9b8e8', s: '#b13ae0', N: '#160e24' });
  sprites.mirrorKnight = make(SHIELD_ROWS, { w: '#e8ecf4', k: '#1a1c2c', m: '#9aa6ba', B: '#c8d4e4' });

  // 1층: 무덤지기 카론 — 낫을 든 사신
  const BOSS_ROWS = pad([
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
  ]);
  sprites.boss = make(BOSS_ROWS, {
    k: '#16121f', w: '#e8e0cf', r: '#b13ae0', m: '#8a8074',
    p: '#241832', q: '#4a3070', s: '#6b4a34', b: '#c8d4e4',
  });

  // 2층: 포자왕 믹서스 — 거대 버섯 군주
  const BOSSSPORE_ROWS = pad([
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
  ]);
  sprites.bossSpore = make(BOSSSPORE_ROWS, {
    m: '#38b764', M: '#d8f070', D: '#1d7a42',
    s: '#e8e0cf', S: '#b8ae9c', k: '#5c1e5e', r: '#8a3a8c',
  });

  // 3층: 간수장 바르곤 — 사슬 묶인 거대 골렘
  const BOSSGOLEM_ROWS = pad([
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
  ]);
  sprites.bossGolem = make(BOSSGOLEM_ROWS, {
    g: '#6b7a94', d: '#454f63', G: '#8a9ab4', k: '#e43b44', c: '#9aa0b4',
  });

  // 4층: 용암 심장 이그니스 — 백열하는 화염 정령체
  const BOSSIGNIS_ROWS = pad([
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
  ]);
  sprites.bossIgnis = make(BOSSIGNIS_ROWS, {
    o: '#ff7043', y: '#ffd866', W: '#fff7d0', r: '#7a1010', k: '#4a0a0a',
  });

  // 5층: 심연의 군주 눅스 — 왕관과 뿔을 지닌 그림자 군주
  const BOSSABYSS_ROWS = pad([
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
  ]);
  sprites.bossAbyss = make(BOSSABYSS_ROWS, {
    K: '#3d2c5c', c: '#f7b32b', k: '#0a0612', w: '#c9b8e8',
    r: '#e43b44', m: '#5c1e5e', p: '#16101f', q: '#8a1c2c',
  });

  // ── 각성 보스 (6~10층) — 같은 실루엣, 다른 존재감: 전용 팔레트 ──
  sprites.bossWraith = make(BOSS_ROWS, { k: '#1a0d12', w: '#d8c8c8', r: '#e43b44', m: '#6a5a5a', p: '#2c1218', q: '#5a2430', s: '#4a3a3a', b: '#e8a0a8' });
  sprites.bossPlague = make(BOSSSPORE_ROWS, { m: '#6ab04c', M: '#c9d94a', D: '#3a6a2a', s: '#d8c8e8', S: '#a89ac0', k: '#3d1e5c', r: '#b13ae0' });
  sprites.bossDespair = make(BOSSGOLEM_ROWS, { g: '#383850', d: '#242438', G: '#5a5a7c', k: '#5ce0e6', c: '#6a6a8a' });
  sprites.bossInferno = make(BOSSIGNIS_ROWS, { o: '#ffd866', y: '#fff7d0', W: '#ffffff', r: '#d35400', k: '#7a1010' });
  sprites.bossVoid = make(BOSSABYSS_ROWS, { K: '#5c1e5e', c: '#e43b44', k: '#050308', w: '#e8d8f8', r: '#ff4757', m: '#8a1c8c', p: '#0e0716', q: '#c02040' });
  // 2막 막보스: 균사 여왕 스포라 — 보랏빛 왕관 균사 + 산성빛 홀씨
  // 3막 막보스: 대재판관 발디아 — 잿금빛 법복 + 핏빛 인장
  sprites.bossValdia = make(BOSSGOLEM_ROWS, { g: '#4c4434', d: '#322c20', G: '#6c6248', k: '#c22030', c: '#d9c08a' });
  // 4막 막보스: 대주교 이노첸시오 — 상아빛 제의 + 금빛 성화 + 핏빛 눈
  sprites.bossBishop = make(BOSSABYSS_ROWS, { K: '#c8bfa8', c: '#ffd866', k: '#3a3226', w: '#f4efe0', r: '#c22030', m: '#8a7a4a', p: '#241f14', q: '#d9a020' });
  // 5막: 근위대장 '흰 늑대' — 흰 판금 + 강철 / 왕 바르텐 3세 — 금빛 왕관 + 성배의 핏빛
  sprites.bossWolf = make(BOSSGOLEM_ROWS, { g: '#c8d0d8', d: '#8a94a4', G: '#e8ecf4', k: '#c22030', c: '#5a7a94' });
  sprites.bossKing = make(BOSSABYSS_ROWS, { K: '#d9a020', c: '#c22030', k: '#241408', w: '#ffd866', r: '#e43b44', m: '#8a1c2c', p: '#141414', q: '#fff0c0' });
  sprites.bossQueen = make(BOSSSPORE_ROWS, { m: '#4a5464', M: '#8a94a4', D: '#2e3644', s: '#8a1c2c', S: '#5e1420', k: '#14181e', r: '#c22030' });

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





  // ══════════════ 몹 인간화 (2026-07) — 왕의 병사들: 인간의 얼굴 ══════════════
  // 아래 정의가 동명 스프라이트를 덮어쓴다. 군제: 왕실(크림슨+강철+금테)/용병(가죽)/교회(로브)
  sprites.sniper = make(pad([
    '.........mmmmmmmm.........',
    '.......mmmmmmmmmmmm.......',
    '.......mMMMMMMMMMMm.......',
    '.....mmmMMMMMMMMMMmmm.....',
    '....mmmmmmmmmmmmmmmmmm....',
    '....mmmmmmmmmmmmmmmmmm....',
    '......ffffeeffffff........',
    '......ffffeefffff.........',
    '......fffFFFFffff.........',
    '......ffFFFFFFff..........',
    '.....rrrRRrrrrrrr...ss....',
    '....rrrrRRrrrrrrrr.ssss...',
    '....ggrrrrrrrrrrrgsswwss..',
    '....ggrrrrrrrrrrggsswwss..',
    '....rrrrrrrrrrrr...ssss...',
    '.....rrrrrrrrrrr....ss....',
    '.....rrrrr..rrrr..........',
    '......rrrr..rrrr..........',
    '......dddd..dddd..........',
    '.....ddddd..ddddd.........',
    '....dddddd..dddddd........',
    '....ddddd....ddddd........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', r: '#7a1c28', R: '#a03040', g: '#b08d4a', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', l: '#6a4a2e', L: '#8a653f', d: '#262033', k: '#23202c', w: '#5e4226' });
  sprites.frostArcher = make(pad([
    '.........mmmmmm...........',
    '.......mmmmmmmmmm.........',
    '.......mmmmmmmmmm.........',
    '......mmmmmmmmmmmm........',
    '......mmmfffeefmmm........',
    '......mmffffeeffmm........',
    '......mmfffFFFffmm....ww..',
    '......mmffFFFFffmm...www..',
    '......bbbbbbbbbbbb..www.ss',
    '.....bbbbbbbbbbbb...ww..ss',
    '.....bbbBBbbbbbbb...ww..ss',
    '....bbbbBBbbbbbb....ww..ss',
    '....ggbbbbbbbbgg....ww..ss',
    '....ggbbbbbbbbgg....ww..ss',
    '....bbbbbbbbbbbb....ww..ss',
    '.....bbbbbbbbbbb....www.ss',
    '.....bbbbb..bbbb.....www..',
    '......bbbb..bbbb......ww..',
    '......dddd..dddd..........',
    '.....ddddd..ddddd.........',
    '....dddddd..dddddd........',
    '....ddddd....ddddd........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', r: '#7a1c28', R: '#a03040', g: '#b08d4a', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', l: '#6a4a2e', L: '#8a653f', d: '#262033', k: '#23202c', w: '#5e4226', b: '#3a5a8a', B: '#5a7ab0' });
  sprites.frostMage = make(pad([
    '...........bb.............',
    '.........bbbbbb...........',
    '.........bbbbbb......ii...',
    '.......bbbbbbbbbb...iiii..',
    '.......bbbbbbbbbb...iiii..',
    '......bbbbbbbbbbbb...iii..',
    '......bbffffeeffbb....ww..',
    '......bbffffeeffbb....ww..',
    '......bbbbbbbbbbbb....ww..',
    '.....bbbbbbbbbbbbb....ww..',
    '.....bbbBBBBbbbbbb....ww..',
    '....bbbBBBBBbbbbbb....ww..',
    '....bbBBBbbbbbbbbb....ww..',
    '....bbBBbbbbbbbbbb....ww..',
    '....bbbbbbbbbbbbbb....ww..',
    '....bbbbbbbbbbbbbb....ww..',
    '....bbbbbbbbbbbbbb....ww..',
    '....bbbbbbbbbbbbbb....ww..',
    '....bbbbbb..bbbbbb........',
    '....bbbbb....bbbbb........',
    '....bbbbb....bbbbb........',
    '.....bb........bb.........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', r: '#7a1c28', R: '#a03040', g: '#b08d4a', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', l: '#6a4a2e', L: '#8a653f', d: '#262033', k: '#23202c', w: '#5e4226', b: '#2e4a74', B: '#5a7ab0', i: '#a9e3ff' });
  sprites.glowShrieker = make(pad([
    '...........mm.............',
    '.........mmmmmm...........',
    '.........mmmmmm...........',
    '.......mmmmmmmmmm.........',
    '.......mmMMMMMMmmm........',
    '......mmMMMMMMMMmm........',
    '......ffffeeffff..........',
    '......ffffeefff...........',
    '......fffFFFfff....gg.....',
    '......ffFFFFff...gggggg...',
    '.....rrrRRrrrrrrggGGGGgg..',
    '....rrrrRRrrrrrgggGGGGgg..',
    '....ggrrrrrrrrgg..ggggg...',
    '....ggrrrrrrrrgg...gg.....',
    '....rrrrrrrrrrrr..........',
    '.....rrrrrrrrrrr..........',
    '.....rrrrr..rrrr..........',
    '......rrrr..rrrr..........',
    '......dddd..dddd..........',
    '.....ddddd..ddddd.........',
    '....dddddd..dddddd........',
    '....ddddd....ddddd........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', r: '#7a1c28', R: '#a03040', g: '#b08d4a', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', l: '#6a4a2e', L: '#8a653f', d: '#262033', k: '#23202c', w: '#5e4226', G: '#d8b25a' });
  sprites.jailer = make(pad([
    '.........mmmmmm...........',
    '.......mmmmmmmmmm.........',
    '.......mmmmmmmmmm.........',
    '......mmmmmmmmmmmm........',
    '......mmmfffeefmmm........',
    '......mmffffeeffmm........',
    '......mmfffFFFffmm........',
    '......mmffFFFFffm.........',
    '......llllllllll..........',
    '.....lllllllllll..........',
    '.....lllLLllllll..mm..mm..',
    '....llllLLllllll..mm..mm..',
    '....llllllllllll....mm....',
    '....llllllllllll....mm....',
    '....llllllllllll..mm..mm..',
    '.....lllllllllll..mm..mm..',
    '.....lllll..llll....ss....',
    '......llll..llll....ss....',
    '......dddd..dddd..........',
    '.....ddddd..ddddd.........',
    '....dddddd..dddddd........',
    '....ddddd....ddddd........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', r: '#7a1c28', R: '#a03040', g: '#b08d4a', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', l: '#6a4a2e', L: '#8a653f', d: '#262033', k: '#23202c', w: '#5e4226', W: '#d8d3c5' });
  sprites.warden = make(pad([
    '.........mmmmmm...........',
    '.......mmmmmmmmmm.........',
    '.......mMMMMMMMMm....ss...',
    '......mmMMMMMMMMmm..sssss.',
    '......mmmmmmmmmmmm..ssMMs.',
    '......mmmmmmmmmmm...ssMMss',
    '......mmmmeemmmmm...ssMMss',
    '......mmmmeemmmm....ssMMss',
    '......rrrrrrrrrr....ssMMss',
    '.....rrrrrrrrrrr....ssMMss',
    '.....rrrRRrrrrrr....ssMMss',
    '....rrrrRRrrrrrr....ssMMss',
    '....ggrrrrrrrrgg....ssMMss',
    '....ggrrrrrrrrgg....ssMMss',
    '....rrrrrrrrrrrr....ssMMss',
    '.....rrrrrrrrrrr....ssMMs.',
    '.....rrrrr..rrrr....sssss.',
    '......rrrr..rrrr.....ss...',
    '......dddd..dddd..........',
    '.....ddddd..ddddd.........',
    '....dddddd..dddddd........',
    '....ddddd....ddddd........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', r: '#7a1c28', R: '#a03040', g: '#b08d4a', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', l: '#6a4a2e', L: '#8a653f', d: '#262033', k: '#23202c', w: '#5e4226' });
  sprites.mirrorKnight = make(pad([
    '....rr...mMMMMm...........',
    '....rrr.mMMMMMMmm.........',
    '....rrrrMMMMMMMmm.........',
    '.....rrrMMMMMMMMmm........',
    '......mmmmddeeddmm........',
    '......mmmmddeeddmm........',
    '......mmmMMMMMMMmm....ss..',
    '......mmMMMMMMMMmm....ss..',
    '......mmMMMMMMMMmm....ss..',
    '.....mmMMMMMMMMMmm....ss..',
    '.....mmMggMMMMMMmm....ss..',
    '....mmMMggMMMMMMmm....ss..',
    '....mmMMMMMMMMMMmm....ss..',
    '....mmMMMMMMMMMmm.....ss..',
    '....mmMMMMMMMMMmm...gggg..',
    '.....mmMMMMMMmmm....gggg..',
    '.....mmmmm..mmmm......ww..',
    '......mmmm..mmmm......ww..',
    '......dddd..dddd..........',
    '.....ddddd..ddddd.........',
    '....dddddd..dddddd........',
    '....ddddd....ddddd........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', r: '#7a1c28', R: '#a03040', g: '#b08d4a', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', l: '#6a4a2e', L: '#8a653f', d: '#262033', k: '#23202c', w: '#5e4226' });
  sprites.stalker = make(pad([
    '.........kkkkkk...........',
    '.......kkkkkkkkkk.........',
    '.......kkkkkkkkkk.........',
    '......kkkkkkkkkkkk........',
    '......kkkkiieekkkk........',
    '......kkkkiieekkkk........',
    '......kkkkkkkkkkkk........',
    '......kkkkkkkkkkk.........',
    '......kkkkkkkkkkk.........',
    '.....kkkkkkkkkkk..........',
    '.....kkkKKkkkkkk..ss......',
    '....kkkkKKkkkkkk..ss......',
    '....kkkkkkkkkkkk..ss......',
    '....kkkkkkkkkkkk..ss......',
    '....rkkkkkkkkkrr..kk......',
    '.....rkkkkkkkkrr..kk......',
    '......kkkk..kkkk..........',
    '......kkkk..kkkk..........',
    '......dddd..dddd..........',
    '.....ddddd..ddddd.........',
    '....dddddd..dddddd........',
    '....ddddd....ddddd........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', r: '#7a1c28', R: '#a03040', g: '#b08d4a', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', l: '#6a4a2e', L: '#8a653f', d: '#262033', k: '#23202c', w: '#5e4226', K: '#3a3444', i: '#e43b44' });
  sprites.berserker = make(pad([
    '.........rrrrrr...........',
    '........rrrrrrrr..........',
    '.......fffffffffff........',
    '......ffffffffffff........',
    '......ffffeeffFF..........',
    '......ffffeefFFF..........',
    '......LfffFFFfFf.....ss...',
    '......LLffFFFFff...sssss..',
    '.....lllllllllll..ssssss..',
    '....llllllllllll..sssss...',
    '....llLLLLllllll....ww....',
    '....llLLLLllllll....ww....',
    '....llllllllllll....ww....',
    '....llllllllllll....ww....',
    '....llllllllllll....ww....',
    '.....lllllllllll....ww....',
    '.....lllll..llll....ww....',
    '......llll..llll....ww....',
    '......dddd..dddd..........',
    '.....ddddd..ddddd.........',
    '....dddddd..dddddd........',
    '....ddddd....ddddd........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', r: '#7a1c28', R: '#a03040', g: '#b08d4a', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', l: '#6a4a2e', L: '#8a653f', d: '#262033', k: '#23202c', w: '#5e4226' });
  sprites.brute = make(pad([
    '...........llllll.........',
    '..........llllllll........',
    '.........fffffffffff......',
    '........ffffffffffff......',
    '........ffffeefffF........',
    '........ffffeeffFF........',
    '.....LLLLLLLLLLLLLL...ss..',
    '....LLLLLLLLLLLLLLLL..ss..',
    '...lllllLLLLLlllllll..ww..',
    '..llllllLLLLllllllll..ww..',
    '..llllLLLLLLllllllll..ww..',
    '..llllLLLLLllllllllll.ww..',
    '..llllllllllllllllllllww..',
    '...lllllllllllllllllllww..',
    '...llllllllllllllllll.ww..',
    '.....lllllllllllllll..ww..',
    '.....lllllll..llllll......',
    '......lllll....lllll......',
    '......dddd......dddd......',
    '.....ddddd.....ddddd......',
    '....dddddd....dddddd......',
    '....ddddd.....ddddd.......',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', r: '#7a1c28', R: '#a03040', g: '#b08d4a', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', l: '#6a4a2e', L: '#8a653f', d: '#262033', k: '#23202c', w: '#5e4226' });
  sprites.bomber = make(pad([
    '.........llllll...........',
    '.......llllllllll.........',
    '.......llllllllll.....ii..',
    '......llllllllllll....ii..',
    '......llffeeffffll....kk..',
    '......llffeeffffll...kkk..',
    '......llllllllllll...kkk..',
    '......lllllllllll..kkkkkk.',
    '......lllllllllll..kkkkkk.',
    '.....lllllllllll..kkkkkkkk',
    '.....lLLLLllllll..kkkkkkkk',
    '....llLLLLllllll..kkkkkkkk',
    '....llllllllllll..kkkkkkkk',
    '....llllllllllll...kkkkkk.',
    '....llllllllllll...kkkkkk.',
    '.....lllllllllll.....kk...',
    '.....lllll..llll..........',
    '......llll..llll..........',
    '......dddd..dddd..........',
    '.....ddddd..ddddd.........',
    '....dddddd..dddddd........',
    '....ddddd....ddddd........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', r: '#7a1c28', R: '#a03040', g: '#b08d4a', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', l: '#6a4a2e', L: '#8a653f', d: '#262033', k: '#23202c', w: '#5e4226', i: '#ffd866' });
  sprites.shaman = make(pad([
    '...........cc.............',
    '.........cccccc...........',
    '.........cccccc...........',
    '.......cccccccccc.........',
    '.......cccccccccc.........',
    '......cccccccccccc........',
    '......ccffffeeffcc........',
    '......ccffffeeffcc........',
    '......cccccccccccc..gg....',
    '.....ccccccccccccc..gg....',
    '.....cccCCCCcccccc..gg....',
    '....cccCCCCCcccccc..ggg...',
    '....ccCCCccccccccc..ggg...',
    '....ccCCcccccccccc..gggg..',
    '....cccccccccccccc..gggg..',
    '....cccccccccccccc...gg...',
    '....cccccccccccccc........',
    '....cccccccccccccc........',
    '....cccccc..cccccc........',
    '....ccccc....ccccc........',
    '....ccccc....ccccc........',
    '.....cc........cc.........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', r: '#7a1c28', R: '#a03040', g: '#b08d4a', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', l: '#6a4a2e', L: '#8a653f', d: '#262033', k: '#23202c', w: '#5e4226', c: '#c8c0ac', C: '#e2dcc8' });
  sprites.acolyte = make(pad([
    '...........cc.............',
    '.........cccccc...........',
    '.........cccccc.......ii..',
    '.......cccccccccc.....ii..',
    '.......cccccccccc.....WW..',
    '......cccccccccccc....WW..',
    '......ccffffeeffcc....WW..',
    '......ccffffeeffcc....WW..',
    '......cccccccccccc........',
    '.....ccccccccccccc........',
    '.....cccCCcccccccc..ii....',
    '....cccCCCcccccccc..ii....',
    '....ccCCCccccccccc..WW....',
    '....ccCCcccccccccc..WW....',
    '....cccccccccccccc..WW....',
    '....cccccccccccccc..WW....',
    '....cccccccccccccc........',
    '....cccccccccccccc........',
    '....cccccc..cccccc........',
    '....ccccc....ccccc........',
    '....ccccc....ccccc........',
    '.....cc........cc.........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', r: '#7a1c28', R: '#a03040', g: '#b08d4a', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', l: '#6a4a2e', L: '#8a653f', d: '#262033', k: '#23202c', w: '#5e4226', c: '#6a6274', C: '#8a8296', i: '#ffd866', W: '#d8d3c5' });
  sprites.flameJuggler = make(pad([
    '.........kkkkkk...........',
    '.......kkkkkkkkkk.........',
    '.......kkkkkkkkkk.....ii..',
    '......kkkkkkkkkkkk...iii..',
    '......kkffeeffkkkk...iii..',
    '......kkffeeffkkkk..iiii..',
    '......kkkkkkkkkkkk..oooo..',
    '......kkkkkkkkkkk....ooo..',
    '......kkkkkkkkkk......ww..',
    '.....kkkkkkkkkkk......ww..',
    '.....kkkKKkkkkkkk.....ww..',
    '....kkkKKKkkkkkkkk....ww..',
    '....kkKKKkkkkkkkkk....ww..',
    '....kkKKkkkkkkkkkk....ww..',
    '....kkkkkkkkkkkkkk........',
    '....kkkkkkkkkkkkkk........',
    '....kkkkkkkkkkkkkk........',
    '....kkkkkkkkkkkkkk........',
    '....kkkkkk..kkkkkk........',
    '....kkkkk....kkkkk........',
    '....kkkkk....kkkkk........',
    '.....kk........kk.........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', r: '#7a1c28', R: '#a03040', g: '#b08d4a', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', l: '#6a4a2e', L: '#8a653f', d: '#262033', k: '#23202c', w: '#5e4226', K: '#3a3444', i: '#ffd866', o: '#e25822' });
  sprites.executioner = make(pad([
    '.........kkkkkk...........',
    '.......kkkkkkkkkk.........',
    '.......kkkkkkkkkk.........',
    '......kkkkkkkkkkkk........',
    '......kkkkeekkkkkk........',
    '......kkkkeekkkkkk........',
    '......kkkkkkkkkkkk...ss...',
    '......kkkkkkkkkkk..sssss..',
    '.....rrrrrrrrrrr...sssss..',
    '....rrrrrrrrrrrr..ssssss..',
    '....rrRRrrrrrrrr..ssssss..',
    '....rrRRrrrrrrrr...ssss...',
    '....ggrrrrrrrrgg....ww....',
    '....ggrrrrrrrrgg....ww....',
    '....rrrrrrrrrrrr....ww....',
    '....rrrrrrrrrrrr....ww....',
    '....rrrrrrrrrrrr....ww....',
    '.....rrrrrrrrrrr....ww....',
    '.....rrrrr..rrrr....ww....',
    '......rrrr..rrrr....ww....',
    '....dddddd..dddddd........',
    '....ddddd....ddddd........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', r: '#7a1c28', R: '#a03040', g: '#b08d4a', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', l: '#6a4a2e', L: '#8a653f', d: '#262033', k: '#23202c', w: '#5e4226' });

  return { ...sprites, white: whiteOf, tint: tintOf };
})();
