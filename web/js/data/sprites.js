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

  // ══════════════ 플레이어 — 언데드 4인 A안 (v119 리드로우) ══════════════
  // 청키 2등신·창백한 피부·붉은 눈: 각자의 죽음이 실루엣이 된다 (머플러/올가미/그을음/독).
  // 프레임: [0] 정지 / [1] 걷기-벌림 / [2] 걷기-모음 / [3] 공격 / [4] 피격
  // 다리는 클래스별 — 처형검·지팡이·옷자락이 허리 아래까지 내려오기 때문

  // 가레스 v133 리드로우 — 방패는 왼팔에 밀착(몸 실루엣과 맞닿음), 처형검은 어깨 위로 치켜든
  // 준비 자세: 정지(검 세움) → 공격(수평 휘두름)이 한 동작으로 읽힌다
  const GARETH_IDLE = [ // 가레스 — 잘린 목의 붉은 머플러, 근위 판금+금장, 깨진 방패, 치켜든 처형검
    '.......oooooo.......',
    '......osSSSSso......',
    '.....osffFFffso.....',
    '.....offFFFFffo.o...',
    '.....ofeeFFeefooWo..',
    '.....offfFFfffooWo..',
    '......offffffo.oWo..',
    '.....oqRRRRRRqooWo..',
    '....oRrrRRRRrrRoWo..',
    '...oqRRrrrrrrRRoWo..',
    '.oo.osSSoRRRosSSoWo.',
    '..osSSoddddddosSfWo.',
    '.osSsSSoddgggdoffhho',
    '.oSSosSoddddddo.oho.',
    '.oSsoSSoddgddso.ogo.',
    '.oSssSSoddddddso.o..',
    '..osSSoosdddddso....',
    '...oo.osddgddso.....',
    '.......osdddso......',
  ];
  const GARETH_ATK = [ // 치켜든 검이 수평으로 떨어진다 — 어깨 높이 횡베기
    '.......oooooo...........',
    '......osSSSSso..........',
    '.....osffFFffso.........',
    '.....offFFFFffo.........',
    '.....ofeeFFeefo.........',
    '.....offfFFfffo.........',
    '......offffffo..........',
    '.....oqRRRRRRqo.........',
    '....oRrrRRRRrrRo........',
    '...oqRRrrrrrrRRqo.......',
    '.oo.osSSoRRRosSSo.......',
    '..osSSoddddddosSffo.....',
    '.osSsSSoddgggdoffhWWWWWW',
    '.oSSosSoddddddo.ohwwwww.',
    '.oSsoSSoddgddso.o.......',
    '.oSssSSoddddddso........',
    '..osSSoosdddddso........',
    '...oo.osddgddso.........',
    '.......osdddso..........',
  ];
  const GARETH_HURT = [ // 피격 — 머리가 젖혀지고, 치켜든 검은 버틴다
    '......oooooo........',
    '.....osSSSSso.......',
    '....osffFFffso......',
    '....offFFFFffo..o...',
    '....ofeeFFeefo.oWo..',
    '....offfFFfffo.oWo..',
    '.....offffffo..oWo..',
    '.....oqRRRRRRqooWo..',
    '....oRrrRRRRrrRoWo..',
    '...oqRRrrrrrrRRoWo..',
    '.oo.osSSoRRRosSSoWo.',
    '..osSSoddddddosSfWo.',
    '.osSsSSoddgggdoffhho',
    '.oSSosSoddddddo.oho.',
    '.oSsoSSoddgddso.ogo.',
    '.oSssSSoddddddso.o..',
    '..osSSoosdddddso....',
    '...oo.osddgddso.....',
    '.......osdddso......',
  ];
  const GARETH_LEGS = [
    [ // 정지 (검을 치켜들어 다리 옆이 깨끗하다)
      '.......oddoodddo....',
      '.......olddoolldo...',
      '.......oLldo.oLlo...',
      '......ooLLoo.oLLoo..',
      '......okkko..okkko..',
      '.....ookkkoo.ookkoo.',
      '.....oooooo..oooooo.',
    ],
    [ // 걷기-벌림
      '.......oddoodddo....',
      '......olddo..olldo..',
      '......oLldo...oLlo..',
      '.....ooLLoo..oLLoo..',
      '.....okkko....okkko.',
      '....ookkkoo..ookkoo.',
      '....oooooo....oooooo',
    ],
    [ // 걷기-모음
      '.......oddoodddo....',
      '.......olddolldo....',
      '........oLldLlo.....',
      '.......ooLLLLoo.....',
      '........okkkko......',
      '.......ookkkkoo.....',
      '.......oooooo.......',
    ],
    [ // 공격 (하체는 버팀 자세 그대로)
      '.......oddoodddo....',
      '.......olddoolldo...',
      '.......oLldo.oLlo...',
      '......ooLLoo.oLLoo..',
      '......okkko..okkko..',
      '.....ookkkoo.ookkoo.',
      '.....oooooo..oooooo.',
    ],
  ];

  // 레나 v133 리드로우 — 뼈활을 발사 방향(오른쪽)으로: 시위가 몸쪽, 활배가 바깥.
  // 정지(활 세워 파지) → 공격(시위 당김 + 화살 수평)이 한 동작으로 읽힌다
  const LENA_IDLE = [ // 레나 — 맨머리, 목의 밧줄 자국과 늘어진 올가미, 뼈활
    '......aaaaaa........',
    '.....oaaaaaao.......',
    '....oaffFFffao......',
    '....offFFFFffo......',
    '....ofeeFFeefo......',
    '....offfFFfffo......',
    '.....offffffo.......',
    '.....oppppppo.......',
    '...onnppnnno.oBBo...',
    '..onnnppnnnoWobBo...',
    '..onnpNNnnnoW.obBo..',
    '..onnnppnnnoW..oBo..',
    '..onnnppnnnoWfffoBo.',
    '..onnnpnnnnoW..oBo..',
    '..onnnLLnnnoW.obBo..',
    '...onnnnnno.WobBo...',
    '...onnNnnno..oBBo...',
    '.....onnNnnno.......',
    '.....onnnnnno.......',
  ];
  const LENA_ATK = [ // 시위를 당겼다 — 화살이 활을 관통해 수평으로
    '......aaaaaa............',
    '.....oaaaaaao...........',
    '....oaffFFffao..........',
    '....offFFFFffo..........',
    '....ofeeFFeefo..........',
    '....offfFFfffo..........',
    '.....offffffo...........',
    '.....oppppppo...........',
    '...onnppnnno.oBBo.......',
    '..onnnppnnno.WobBo......',
    '..onnpNNnnno.W.obBo.....',
    '..onnnppnnno.W.oBo......',
    '..onnnppnnnofffhoBohhWW.',
    '..onnnpnnnno.W.oBo......',
    '..onnnLLnnno.W.obBo.....',
    '...onnnnnno..WobBo......',
    '...onnNnnno..oBBo.......',
    '.....onnNnnno...........',
    '.....onnnnnno...........',
  ];
  const LENA_HURT = [
    '.....aaaaaa.........',
    '....oaaaaaao........',
    '...oaffFFffao.......',
    '...offFFFFffo.......',
    '...ofeeFFeefo.......',
    '...offfFFfffo.......',
    '....offffffo........',
    '....oppppppo........',
    '...onnppnnno.oBBo...',
    '..onnnppnnnoWobBo...',
    '..onnpNNnnnoW.obBo..',
    '..onnnppnnnoW..oBo..',
    '..onnnppnnnoWfffoBo.',
    '..onnnpnnnnoW..oBo..',
    '..onnnLLnnnoW.obBo..',
    '...onnnnnno.WobBo...',
    '...onnNnnno..oBBo...',
    '.....onnNnnno.......',
    '.....onnnnnno.......',
  ];
  const LENA_LEGS = [
    [
      '.....onnoonnno......',
      '.....olno.olldo.....',
      '.....oLlo..oLlo.....',
      '....ooLLoo.oLLoo....',
      '....okkko..okkko....',
      '...ookkkoo.ookkoo...',
      '...oooooo..oooooo...',
    ],
    [
      '.....onnoonnno......',
      '....olno...olldo....',
      '....oLlo...oLlo.....',
      '...ooLLoo..oLLoo....',
      '...okkko....okkko...',
      '..ookkkoo..ookkoo...',
      '..oooooo....oooooo..',
    ],
    [
      '.....onnoonnno......',
      '.....olnolldo.......',
      '......oLlLlo........',
      '.....ooLLLLoo.......',
      '......okkkko........',
      '.....ookkkkoo.......',
      '.....oooooo.........',
    ],
  ];

  // 오르빈 v133 리드로우 — 별이 어깨 위로, 자루는 밝은 목재(H)로 지면까지: '떠 있는 별'이
  // 아니라 '별 지팡이를 짚은 점성술사'로 읽힌다. 공격은 지팡이 수평 내지르기
  const ORBIN_IDLE = [ // 오르빈 — 그을린 챙의 점성술사 모자, 해진 로브, 별 지팡이
    '........ovo.........',
    '.......ovVvo....oGo.',
    '.......ovVvo...oGXGo',
    '......ovvVVvo...oGo.',
    '.....ovvVVVVvo..oHo.',
    '...occvvvvvvvvccoHo.',
    '....occccccccco.oHo.',
    '....offFFFFffo..oHo.',
    '....ofeeFFeefo..oHo.',
    '....offfFFfffo..oHo.',
    '.....offffffo...oHo.',
    '....ovvVVVVvvo..oHo.',
    '...ovvvVVVVvvvo.oHo.',
    '..ovVvvvvvvvvVvooHo.',
    '..ovovvVVVVvvvffoHo.',
    '..ovovvvvvvvvovooHo.',
    '..ooovvcvvcvvooooHo.',
    '.....ovvvvvvo...oHo.',
    '.....ovcvvvvo...oHo.',
  ];
  const ORBIN_ATK = [ // 별 지팡이를 수평으로 내지른다 — 별끝에서 마력이 튄다
    '........ovo.............',
    '.......ovVvo............',
    '.......ovVvo............',
    '......ovvVVvo...........',
    '.....ovvVVVVvo..........',
    '...occvvvvvvvvcco.......',
    '....occccccccco.........',
    '....offFFFFffo..........',
    '....ofeeFFeefo..........',
    '....offfFFfffo..........',
    '.....offffffo...........',
    '....ovvVVVVvvo.....oGXo.',
    '...ovvvVVVVvvvffHHHHGXGX',
    '..ovVvvvvvvvvVvo...oGXo.',
    '..ovovvVVVVvvvovo.......',
    '..ovovvvvvvvvovo........',
    '..ooovvcvvcvvooo........',
    '.....ovvvvvvo...........',
    '.....ovcvvvvo...........',
  ];
  const ORBIN_HURT = [
    '.......ovo..........',
    '......ovVvo.....oGo.',
    '......ovVvo....oGXGo',
    '.....ovvVVvo....oGo.',
    '....ovvVVVVvo...oHo.',
    '..occvvvvvvvvccooHo.',
    '...occccccccco..oHo.',
    '...offFFFFffo...oHo.',
    '...ofeeFFeefo...oHo.',
    '...offfFFfffo...oHo.',
    '....offffffo....oHo.',
    '....ovvVVVVvvo..oHo.',
    '...ovvvVVVVvvvo.oHo.',
    '..ovVvvvvvvvvVvooHo.',
    '..ovovvVVVVvvvffoHo.',
    '..ovovvvvvvvvovooHo.',
    '..ooovvcvvcvvooooHo.',
    '.....ovvvvvvo...oHo.',
    '.....ovcvvvvo...oHo.',
  ];
  const ORBIN_LEGS = [
    [ // 해진 로브 밑단 + 지팡이 자루 (다리 대신 옷자락이 걷는다)
      '.....ovvvvcvo...oHo.',
      '.....ovvvvvvo...oHo.',
      '.....ocvvvvco...oHo.',
      '....ocvvcvvvco......',
      '....ovvovvovvo......',
      '....ovv.ovv.vo......',
      '....oc..oc..co......',
    ],
    [ // 밑단 벌어짐
      '.....ovvvvcvo...oHo.',
      '.....ovvvvvvo...oHo.',
      '.....ocvvvvco...oHo.',
      '....ocvvvcvvco......',
      '...ovvoovvoovvo.....',
      '...ovv..ovv..vo.....',
      '...oc...oc...co.....',
    ],
    [ // 밑단 모임
      '.....ovvvvcvo...oHo.',
      '.....ovvvvvvo...oHo.',
      '.....ocvvvvco...oHo.',
      '.....ovvcvvvo.......',
      '.....ovvovvvo.......',
      '.....ovv.vvo........',
      '.....oc..oco........',
    ],
    [ // 공격 (지팡이가 수평으로 나가 자루가 사라진다)
      '.....ovvvvcvo.......',
      '.....ovvvvvvo.......',
      '.....ocvvvvco.......',
      '....ocvvcvvvco......',
      '....ovvovvovvo......',
      '....ovv.ovv.vo......',
      '....oc..oc..co......',
    ],
  ];

  const ISOLDE_IDLE = [ // 이졸데 — 은발, 검푸른 입술, 치켜든 금간 플라스크, 반지 사슬
    '......iiiiii....oDDo',
    '.....oiiiiiio...oDPo',
    '....oiffFFffio..oDPo',
    '....offFFFFffo..o.Po',
    '....ofeeFFeefo..oDDo',
    '....offzFFzffo...oto',
    '.....offzzffo....oto',
    '....ottuuuutto..ofo.',
    '...otuuUUUUuuto.ofo.',
    '..otuuuuuuuuuutoofo.',
    '..otoutgggtuuotofo..',
    '..otouuuguuuuotoo...',
    '..otouuuuuuuuoto....',
    '..ooouuUUUuuooo.....',
    '.....ouuuuuuo.......',
    '.....ouuLLuuo.......',
    '.....ouuuuuuo.......',
    '.....otuuuuto.......',
    '.....otuuuuto.......',
  ];
  const ISOLDE_ATK = [ // 투척 순간 — 플라스크가 손끝을 막 떠난다 (은빛 궤적이 손과 잇는다)
    '......iiiiii............',
    '.....oiiiiiio...........',
    '....oiffFFffio..........',
    '....offFFFFffo..........',
    '....ofeeFFeefo.....oDDo.',
    '....offzFFzffo.....oDPo.',
    '.....offzzffo......oDDo.',
    '....ottuuuutto......oto.',
    '...otuuUUUUuutooffffii..',
    '..otuuuuuuuuuutoo.......',
    '..otoutgggtuuoto........',
    '..otouuuguuuuoto........',
    '..otouuuuuuuuoto........',
    '..ooouuUUUuuooo.........',
    '.....ouuuuuuo...........',
    '.....ouuLLuuo...........',
    '.....ouuuuuuo...........',
    '.....otuuuuto...........',
    '.....otuuuuto...........',
  ];
  const ISOLDE_HURT = [
    '.....iiiiii.....oDDo',
    '....oiiiiiio....oDPo',
    '...oiffFFffio...oDPo',
    '...offFFFFffo...o.Po',
    '...ofeeFFeefo...oDDo',
    '...offzFFzffo....oto',
    '....offzzffo.....oto',
    '....ottuuuutto..ofo.',
    '...otuuUUUUuuto.ofo.',
    '..otuuuuuuuuuutoofo.',
    '..otoutgggtuuotofo..',
    '..otouuuguuuuotoo...',
    '..otouuuuuuuuoto....',
    '..ooouuUUUuuooo.....',
    '.....ouuuuuuo.......',
    '.....ouuLLuuo.......',
    '.....ouuuuuuo.......',
    '.....otuuuuto.......',
    '.....otuuuuto.......',
  ];
  const ISOLDE_LEGS = [
    [
      '.....ottoottto......',
      '.....olto.otldo.....',
      '.....oLlo..oLlo.....',
      '....ooLLoo.oLLoo....',
      '....okkko..okkko....',
      '...ookkkoo.ookkoo...',
      '...oooooo..oooooo...',
    ],
    [
      '.....ottoottto......',
      '....olto...otldo....',
      '....oLlo...oLlo.....',
      '...ooLLoo..oLLoo....',
      '...okkko....okkko...',
      '..ookkkoo..ookkoo...',
      '..oooooo....oooooo..',
    ],
    [
      '.....ottoottto......',
      '.....oltotldo.......',
      '......oLlLlo........',
      '.....ooLLLLoo.......',
      '......okkkko........',
      '.....ookkkkoo.......',
      '.....oooooo.........',
    ],
  ];

  const CLASS_SPRITES = {
    player: {
      idle: GARETH_IDLE, attack: GARETH_ATK, hurt: GARETH_HURT, legs: GARETH_LEGS,
      pal: { o: '#16141e', f: '#b8c0a8', F: '#d4d8c4', e: '#e43b44', k: '#23202c', l: '#4a3620', L: '#6a4a2e', g: '#b08d4a', h: '#3a2c1a', d: '#31445a', s: '#5a7a94', S: '#8fb0c4', r: '#8a1c2c', R: '#c22030', q: '#e8503f', w: '#9aa8b8', W: '#e8f0f4' },
    },
    playerArcher: {
      idle: LENA_IDLE, attack: LENA_ATK, hurt: LENA_HURT, legs: LENA_LEGS,
      pal: { o: '#16141e', f: '#b8c0a8', F: '#d4d8c4', e: '#e43b44', k: '#23202c', l: '#4a3620', L: '#6a4a2e', d: '#2e3a26', h: '#6a4a2e', a: '#7a4a2e', p: '#8a653f', n: '#3a4a30', N: '#55663f', B: '#e8dfc8', b: '#b8ae96', W: '#e8f0f4' },
    },
    playerMage: {
      idle: ORBIN_IDLE, attack: ORBIN_ATK, hurt: ORBIN_HURT, legs: ORBIN_LEGS,
      pal: { o: '#16141e', f: '#b8c0a8', F: '#d4d8c4', e: '#e43b44', v: '#3a2c4a', V: '#553f66', c: '#2a2422', X: '#ff9a3c', G: '#ffd866', h: '#3a2c1a', H: '#8a653f' },
    },
    playerAlch: {
      idle: ISOLDE_IDLE, attack: ISOLDE_ATK, hurt: ISOLDE_HURT, legs: ISOLDE_LEGS,
      pal: { o: '#16141e', f: '#b8c0a8', F: '#d4d8c4', e: '#e43b44', k: '#23202c', l: '#4a3620', L: '#6a4a2e', d: '#243038', i: '#c8ccd8', z: '#3a4a6a', t: '#2e4a54', u: '#46666e', U: '#6e8e96', g: '#b08d4a', D: '#a8d8ee', P: '#8adf76' },
    },
  };

  sprites.playerFrames = {};
  for (const key of Object.keys(CLASS_SPRITES)) {
    const { idle, attack, hurt, pal, legs } = CLASS_SPRITES[key];
    sprites.playerFrames[key] = [
      make(pad([...idle, ...legs[0]]), pal),
      make(pad([...idle, ...legs[1]]), pal),
      make(pad([...idle, ...legs[2]]), pal),
      make(pad([...attack, ...(legs[3] || legs[0])]), pal), // [3] 공격 — 무기를 내지른다
      make(pad([...hurt, ...legs[1]]), pal),                // [4] 피격 — 뒤로 젖혀진 채 버틴다
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

  const SLIME_ROWS = [ // 기어오는 부패 (v121 A안) — 반쯤 잠긴 두개골과 끌리는 팔
    '.........offo...........',
    '........ofefo...........',
    '........offfo...........',
    '......oomffmoo..........',
    '....oommmmmmmmoo........',
    '...ommmMMmmmmmmoo..aa...',
    '..ommmmmmmmmmmmmmoaaao..',
    '..odmmmmmMMmmmmmmoaao...',
    '..odmmmmmmmmmmdmmmoo....',
    '...oddmmmmddmmmmdo......',
    '....ooddddddddddoo......',
    '......oooooooooo........',
  ];

  const ARCHER_ROWS = [ // 백골 궁수 (v121 A안) — 후드 + 뼈활 (레나와 같은 활 언어)
    '.....ohhhhhho.......',
    '....ohhhhhhhho......',
    '....ohBeBBeBho......',
    '....ohBBBBBBho......',
    '.....oBbbbbBo.......',
    '..BBooBBBBBBoo......',
    '.oBboWhhhhhhho......',
    '.oBo.oWhhhhhho......',
    '.oBoBBoWhhhhho......',
    '.oBo.oWhhhhhho......',
    '.oBbo.oWhhhhho......',
    '..BBooWhhhhhoo......',
    '.....ohhhhhho.......',
    '.....oBb..bBo.......',
    '.....oB....Bo.......',
    '....ooBo..oBoo......',
    '....obbo..obbo......',
    '...oobboo.oobboo....',
    '...ooooo...ooooo....',
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

  const HORSE_ROWS = [ // 미친 군마 (v121 A안) — 찢긴 마갑, 핏빛 눈. 무너진 왕의 석상(기마상)과 공유
    '............oHHo..............',
    '...........oHHHHo.............',
    '..........oHHeHo..............',
    '..........oHHHHoo.............',
    '...........oHHHo..............',
    '......oooooHHHoo..............',
    '....ooHHHHHHHHHo..............',
    '...oHHHHHHHHHHHHoo............',
    '..oHHppHHHHHHppHHHo...........',
    '..oHHppHHHHHHHHHHHo...........',
    '..oHHHHHHHHHHHppHHo...........',
    '...oHHHHHHHHHHHHHo............',
    '...oHHo..oHHo..oHHo...........',
    '...oHHo..oHHo..oHHo...........',
    '...oGko..oGko..oGko...........',
    '...oooo..oooo..oooo...........',
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

  const BAT_ROWS = [ // 유골 까마귀 (v121 A안) — 유골을 물고 나는 묘지의 까마귀
    '..ww..........ww..',
    '.wwww........wwww.',
    '.wwwww......wwwww.',
    '..wwwwwwwwwwwwww..',
    '...wwwbbbbbbwww...',
    '....bbkbbbbbb.....',
    '.....bbbbbbbb.....',
    '......bbbbbb......',
    '.......bffb.......',
    '......ffffff......',
    '.......f..f.......',
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
    o: '#16141e', m: '#5a6a4a', M: '#7a8a5a', d: '#3a4634', f: '#d4d8c4', e: '#e43b44', a: '#b8c0a8',
  });
  sprites.toxicSlime = make(SLIME_ROWS, {
    o: '#16141e', m: '#5a3a6a', M: '#8a5a9a', d: '#3a2444', f: '#d8c8f0', e: '#c56cf0', a: '#b09ac0',
  });
  sprites.archer = make(ARCHER_ROWS, {
    o: '#16121f', h: '#2e3a2e', B: '#e8dfc8', b: '#b8ae96', e: '#e43b44', W: '#e8f0f4',
  });
  sprites.boar = make(HORSE_ROWS, {
    o: '#16141e', H: '#3a3230', G: '#5a4a44', p: '#7a1c28', e: '#e43b44', k: '#23202c',
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

  const ARCHER_WALK2 = withRows(ARCHER_ROWS, { // v121 신 맵 기준 — 다리 모음
    13: '.....oBb.bBo........',
    14: '......oB..Bo........',
    15: '.....ooBooBoo.......',
    16: '.....obbobbo........',
    17: '....oobbobboo.......',
    18: '....ooooooooo.......',
  });
  const ARCHER_AIM = withRows(ARCHER_ROWS, { // 시위를 당긴 조준 자세
    8: '.oBoBBWWhhhhho......',
  });

  const BOAR_WALK2 = withRows(BOAR_ROWS, { // 불탄 사냥개 전용 (구 실루엣 유지)
    13: '..dbb.dbbb...dbb.dbbb...',
    14: '...db..db.....db..db....',
  });
  const HORSE_WALK2 = withRows(HORSE_ROWS, { // 미친 군마 — 질주 보폭
    12: '..oHHo....oHHo...oHHo.........',
    13: '..oHHo...oHHo.....oHHo........',
    14: '..oGko...oGko.....oGko........',
    15: '..oooo...oooo.....oooo........',
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
    archer: { o: '#16121f', h: '#2e3a2e', B: '#e8dfc8', b: '#b8ae96', e: '#e43b44', W: '#e8f0f4' },
    boar: { o: '#16141e', H: '#3a3230', G: '#5a4a44', p: '#7a1c28', e: '#e43b44', k: '#23202c' },
    lavaHound: { b: '#d35400', B: '#f07a2a', d: '#7a1010', k: '#ffd866', w: '#ffd866' },
    golem: { g: '#5d6b84', d: '#3d4a5c', k: '#5ce0e6' },
    spider: { b: '#2a1c3d', r: '#e43b44', l: '#4a4a5c' },
    necro: { n: '#2a4a3a', f: '#0d0b14', g: '#38b764', s: '#d9cbb8', N: '#1c3328' },
    mushroom: { m: '#8a5ac2', M: '#d8c8f0', D: '#5c3a8a', s: '#d9cbb8', k: '#1a1c2c' },
  };

  sprites.enemyFrames = {
    archer:    { walk: [sprites.archer, make(ARCHER_WALK2, PAL.archer)], attack: make(ARCHER_AIM, PAL.archer) },
    boar:      { walk: [sprites.boar, make(HORSE_WALK2, PAL.boar)] },
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
  const EXEC_ROWS = pad([ // (v87 인간판이 라이브 — 본 맵은 참조 기록용)
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
  const SKELETON_ROWS = pad([ // 깨어난 백골 (v121 A안) — 붉은 눈·갈비뼈 틈·녹슨 검
    '......oBBBBo........',
    '.....oBBBBBBo.......',
    '....oBBeBBeBBo......',
    '....oBBBBBBBBo......',
    '.....oBbbbbBo.......',
    '......oBBBBo........',
    '....oBBbBBbBBo..oRo.',
    '...oBoBBBBBBoBo.oro.',
    '..oBooBbBBbBooBooro.',
    '..oBo.oBBBBo..oBro..',
    '..oo..oBbbBo...oo...',
    '......oBBBBo........',
    '.....oBb..bBo.......',
    '.....oB....Bo.......',
    '.....oBb..bBo.......',
    '....ooBo..oBoo......',
    '....obbo..obbo......',
    '...oobboo.oobboo....',
    '...ooooo...ooooo....',
  ]);
  sprites.skeleton = make(SKELETON_ROWS, {
    o: '#16121f', B: '#e8dfc8', b: '#b8ae96', e: '#e43b44', r: '#8a6a4a', R: '#a88a5a',
  });

  // 방패 해골: 전면 대형 방패
  const SHIELD_ROWS = pad([ // 백골 방패병 (v122 A안) — v121 백골과 같은 뼈 언어 + 타워 방패
    '....wwww.....BBB..',
    '...wwwwww...BBBBB.',
    '...wewwew...BBBBB.',
    '...wwwwww...BmmmB.',
    '....wmmw....BmmmB.',
    '...wwwwww...BmmmB.',
    '..wwwwwwww..BmmmB.',
    '..w.wwwww.wwBmmmB.',
    '..w.wmwmw...BmmmB.',
    '..w.wwwww...BmmmB.',
    '....wwwww...BBBBB.',
    '....wmwmw...BBBBB.',
    '....wwwww....BBB..',
    '....ww.ww.........',
    '....w...w.........',
    '...ww...ww........',
    '..www...www.......',
  ]);
  sprites.shieldSkeleton = make(SHIELD_ROWS, { w: '#e8dfc8', k: '#1a1c2c', m: '#8a8074', B: '#3a7ca5', e: '#e43b44' });

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
  const SWARM_ROWS = pad([ // 시체 파리떼 (v121 A안)
    '..ll....ll..',
    '.llll..llll.',
    '..lkbbbbkl..',
    '...bBBBBb...',
    '...bbbbbb...',
    '....bkkb....',
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
  const SHAMAN_ROWS = pad([ // (v87 인간판이 라이브 — 본 맵은 참조 기록용)
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
  sprites.acidSnail = make(SLIME_ROWS, { o: '#16141e', m: '#6a5a3a', M: '#8a7a4a', d: '#4a3e24', f: '#c8ccd8', e: '#c9d94a', a: '#8a8a6a' });
  sprites.jailer = make(EXEC_ROWS, { h: '#3a5a7c', r: '#5ce0e6', a: '#2c3c50', d: '#1d2836', x: '#8a6a3a', X: '#a9c1d8' });
  sprites.frostMage = make(SHAMAN_ROWS, { t: '#3a6a9a', w: '#e8f4fa', k: '#5ce0e6', m: '#24455e', g: '#a9c1d8' });
  sprites.cinder = make(SWARM_ROWS, { k: '#2a1208', b: '#d35400', B: '#ff9a3c', l: '#7a1010' });
  sprites.ashWalker = make(GOLEM_ROWS, { g: '#4a4448', d: '#2e2a30', k: '#ff7043' });
  sprites.emberMoth = make(BAT_ROWS, { w: '#d97a20', b: '#8a3a10', k: '#ffd866', f: '#ffd866' });
  sprites.acolyte = make(NECRO_ROWS, { n: '#3a2a5c', f: '#0d0b14', g: '#b13ae0', s: '#c9b8e8', N: '#241838' });
  sprites.shade = make(STALKER_ROWS, { k: '#101018', r: '#5c7cff', s: '#2a2a44' });
  sprites.gazer = make(VOIDEYE_ROWS, { k: '#182448', w: '#a8c0f0', R: '#4a6ede', r: '#080c1e', t: '#2c3c6e' });
  sprites.bloodBat = make(BAT_ROWS, { w: '#8a2430', b: '#5a1424', k: '#ffd866', f: '#ff4757' });
  sprites.boneHeap = make(SKELETON_ROWS, { o: '#16121f', B: '#d8cfb8', b: '#a89e86', e: '#ffd866', r: '#6a4a2a', R: '#7a5a3a' });
  sprites.venomLasher = make(GHOUL_ROWS, { g: '#3f6a35', G: '#6a9a48', d: '#2a4a24', r: '#c9d94a', m: '#1d3318', b: '#55702a' });
  sprites.sporeMother = make(MUSHROOM_ROWS, { m: '#a04a7a', M: '#e8b8d0', D: '#702a52', s: '#c9b89a', k: '#1a1c2c' });
  sprites.acidSlug = make(LEECH_ROWS, { r: '#6a7a1a', R: '#9aa82a', W: '#d8e858', k: '#141a06' });
  // ── 2막 (11~20층, 균사 정원) 팔레트 스왑 ──
  sprites.sporeling = make(SLIME_ROWS, { o: '#16141e', m: '#5a8a4a', M: '#7ab848', d: '#3a6a2a', f: '#f0f8d0', e: '#c9d94a', a: '#9ac878' });
  sprites.fungalTick = make(LEECH_ROWS, { r: '#4a6a2a', R: '#7a9a3a', W: '#c9d94a', k: '#141a06' });
  sprites.myceliumBrute = make(GOLEM_ROWS, { g: '#5a7a4a', d: '#3a5230', k: '#c9d94a' });
  sprites.rotWalker = make(GOLEM_ROWS, { g: '#6a5a3a', d: '#463a24', k: '#8adf76' });
  sprites.glowShrieker = make(SHAMAN_ROWS, { t: '#3a7a5a', w: '#d0f0c0', k: '#8adf76', m: '#1d4a33', g: '#c9d94a' });
  sprites.warden = make(BRUTE_ROWS, { b: '#4a5a74', k: '#5ce0e6', m: '#2c3850', g: '#1d2836' });
  sprites.chainWraith = make(WRAITH_ROWS, { w: '#8a8a9a', k: '#16121f', m: '#4a3a3a', W: '#c05060' });
  sprites.frostGolem = make(GOLEM_ROWS, { g: '#5a9ac8', d: '#3a6a94', k: '#f0faff' });
  sprites.obsidianBeast = make(HORSE_ROWS, { o: '#16141e', H: '#2c2434', G: '#443a54', p: '#b13ae0', e: '#b13ae0', k: '#181220' });
  sprites.flameJuggler = make(SHAMAN_ROWS, { t: '#c04a3a', w: '#ffd866', k: '#ff9a3c', m: '#7a1010', g: '#ffd866' });
  sprites.lavaBurster = make(CRYSTAL_ROWS, { c: '#a83a1a', C: '#e06030', w: '#ffd866', W: '#fff0c0', d: '#701d0a' });
  sprites.voidSpawn = make(SWARM_ROWS, { k: '#12081e', b: '#3d2c5c', B: '#7a5ac2', l: '#241838' });
  sprites.riftCaster = make(NECRO_ROWS, { n: '#241838', f: '#0d0b14', g: '#c9b8e8', s: '#b13ae0', N: '#160e24' });
  sprites.mirrorKnight = make(SHIELD_ROWS, { w: '#e8ecf4', k: '#1a1c2c', m: '#9aa6ba', B: '#c8d4e4', e: '#5ce0e6' });

  // 1층: 무덤지기 오스문드 — 챙 넓은 두건, 낡은 외투, 낫과 랜턴 (v118: 사신 → 시체를 팔아온 인간)
  const BOSS_ROWS = pad([
    '...........hhhhhhhh...........',
    '.........hhhhhhhhhhhh.....SSSS',
    '........hhhhhhhhhhhhhh..SSSSS.',
    '.......hhhhhhhhhhhhhhhh.SSSS..',
    '.......hhhHHHHHHHHhhhhh.SS....',
    '........hffffffffffhh...ss....',
    '........hffeeffeeffh....ss....',
    '........hffeeffeeffh....ss....',
    '........hffffffffffh....ss....',
    '.........ffFFFFFFff.....ss....',
    '.......cccccccccccccc...ss....',
    '......cccccccccccccccc..ss....',
    '.....ccccccCCCCcccccccc.ss....',
    '.....ccccccCCCCcccccccc.ss....',
    '....oo.ccccccccccccccc..ss....',
    '...oooo.ccbbbbbbbbbcc...ss....',
    '...oooo.cccccccccccccc..ss....',
    '...oooo.cccccccccccccc..ss....',
    '....OO..cccccccccccccc..ss....',
    '....OO.ccccccccccccccc..ss....',
    '.......cccccccccccccccc.ss....',
    '.......ccccccc..ccccccc.ss....',
    '.......cccccc....cccccc.ss....',
    '.......ccccc......ccccc.ss....',
    '........cccc......cccc..ss....',
    '...ddddddd..........ddddddd...',
    '...dddddd............dddddd...',
  ]);
  sprites.boss = make(BOSS_ROWS, {
    h: '#3a3226', H: '#5e5426', f: '#c8a078', F: '#a07850', e: '#1a1c2c',
    c: '#2c2838', C: '#4a4458', b: '#6a4a2e', s: '#6b4a34', S: '#c8ccd8',
    o: '#ffd866', O: '#8a653f', d: '#262033',
  });

  // 2층: 시체 짐꾼 '삯꾼 몰레' — 구부정한 등에 짊어진 시체 자루, 손에는 짐꾼의 갈고리 (v118: 버섯 군주 → 나른 손)
  const BOSSSPORE_ROWS = pad([
    '......BBBBBBBBBB................',
    '....BBBBBBBBBBBBBB..............',
    '...BBBBBBbbBBBBBBBB.............',
    '..BBBBBBbbbbBBBBBBBB............',
    '..BBBBBBBbbBBBBBBBBBB...........',
    '..BBBBBBBBBBBBBBBBBBB...........',
    '..BBBBBBBBBBBBBBBBBBBB..........',
    '...BBBBBBBBBBBBBBBBBBrr.........',
    '...bBBBBBBBBBBBBBBBBrrr..hh.....',
    '....bbBBBBBBBBBBBBrrr...hhhh....',
    '......rrrrrrrrrrrr......hh.h....',
    '.......jjjjjjjfffff.....ss......',
    '......jjjjjjjffeeeff....ss......',
    '.....jjjjjjjjffeeeff....ss......',
    '.....jjjjJJjjjffffff....ss......',
    '....jjjjjJJjjjjfFFF.....ss......',
    '....jjjjjjjjjjjjjjj.....ss......',
    '....jjjjjjjjjjjjjjjj....ss......',
    '.....jjjjjjjjjjjjjjj...ss.......',
    '.....jjjjjj..jjjjjj...ss........',
    '......jjjjj...jjjjj.............',
    '.....pppppp..pppppp.............',
    '....dddddd....dddddd............',
  ]);
  sprites.bossSpore = make(BOSSSPORE_ROWS, {
    B: '#6a5a40', b: '#4a3e2a', r: '#8a653f', j: '#4a5a3a', J: '#6a7a4a',
    f: '#c8a078', F: '#a07850', e: '#1a1c2c', h: '#c8ccd8', s: '#6b4a34',
    p: '#3a3226', d: '#262033',
  });

  // 3층: 간수장 바르곤 — 투구 쓴 거구, 가죽 앞치마, 사슬과 열쇠꾸러미 (v118: 골렘 → 가둔 손)
  const BOSSGOLEM_ROWS = pad([
    '.........mmmmmmmm.............',
    '........mmmmmmmmmm............',
    '........mMMMMMMMMm............',
    '........mmffffffmm............',
    '........mmfeeffemm....cc......',
    '.........ffffffff....cccc.....',
    '.........fFFFFFFf...cc..cc....',
    '.......tttttttttttt.cc..cc....',
    '.....tttttttttttttttt.cc......',
    '....ttttttTTTTtttttt..cc......',
    '....tttaaaaaaaaaattt..cc......',
    '....tttaaaaaaaaaatttmmcc......',
    '....tttaAAAAAAaaattmmm........',
    '....tttaaaaaaaaaattt..........',
    '....tttaaaaaaaaaattKK.........',
    '....tttaaaaaaaaaatKKK.........',
    '.....ttaaaaaaaaaatt...........',
    '.....tttttt..tttttt...........',
    '......tttt....tttt............',
    '......tttt....tttt............',
    '....dddddd....dddddd..........',
    '....ddddd......ddddd..........',
  ]);
  sprites.bossGolem = make(BOSSGOLEM_ROWS, {
    m: '#6e7383', M: '#9aa1b0', f: '#dcb68c', F: '#c09468', e: '#1a1c2c',
    t: '#3a4450', T: '#5a6470', a: '#5e4226', A: '#7a5a34',
    c: '#9aa1b0', K: '#ffd866', d: '#262033',
  });

  // 4층: 방화대장 '그을음 브란트' — 치켜든 횃불, 기름단지, 그을린 붉은 두건 (v118: 화염 정령 → 태운 손)
  const BOSSIGNIS_ROWS = pad([
    '.....................OOO......',
    '....................OOOOO.....',
    '....................oOOOo.....',
    '....................ooooo.....',
    '.........rrrrrrrr....ooo......',
    '........rrrrrrrrrr....ss......',
    '........rrRRRRRRrr....ss......',
    '........ffffffffff....ss......',
    '........ffeeffeeff....ss......',
    '.........ffffffff.....ss......',
    '.........fFFFFFFf.....ss......',
    '.......tttttttttttt...ss......',
    '......tttttttttttttt..ss......',
    '.....tttttTTTTttttttt.ss......',
    '....jj.ttttTTTTtttttt.........',
    '...jjjj.tttttttttttt..........',
    '...jjjj.tttttttttttt..........',
    '...jJJj.tttttttttttt..........',
    '....jj..ttttt..ttttt..........',
    '........tttt....tttt..........',
    '....dddddd....dddddd..........',
    '....ddddd......ddddd..........',
  ]);
  sprites.bossIgnis = make(BOSSIGNIS_ROWS, {
    r: '#7a1c28', R: '#a03040', f: '#b09068', F: '#8a6a48', e: '#1a1c2c',
    t: '#5e3a28', T: '#7a4a30', o: '#ff9a3c', O: '#ffd866', s: '#6b4a34',
    j: '#8a653f', J: '#6a4a2e', d: '#262033',
  });

  // 5층: 교수대의 그림자 — 목에 밧줄을 늘어뜨린 창백한 원혼, 해진 수의 (v118: 심연 군주 잔재 → 매단 자들의 원한)
  const BOSSABYSS_ROWS = pad([
    '............rr............',
    '............rr............',
    '............rr............',
    '..........rrrrrr..........',
    '.........rr.rr.rr.........',
    '.........kkkkkkkk.........',
    '.......kkkkkkkkkkkk.......',
    '......kkkkkkkkkkkkkk......',
    '......kkwwwwwwwwwwkk......',
    '.....kkwwwwwwwwwwwwkk.....',
    '.....kkwweewwwweewwkk.....',
    '.....kkwweewwwweewwkk.....',
    '.....kkwwwwwwwwwwwwkk.....',
    '......kwwwmmmmmmwwwk......',
    '......kkwwwmmmmwwwkk......',
    '.....KKkkkkkkkkkkkkKK.....',
    '....KKKKkkkkkkkkkkKKKK....',
    '...KKKKkkkkkkkkkkkkKKKK...',
    '...KKKkkkkkkkkkkkkkkKKK...',
    '..KKKkkkkkkkkkkkkkkkkKKK..',
    '..KKkkkkkkkk..kkkkkkkkKK..',
    '..Kkkkkkkkk....kkkkkkkkK..',
    '..kkkkkkk........kkkkkkk..',
    '..kkkkk...........kkkkk...',
    '...kkk.....kk......kkk....',
    '....k......kk.......k.....',
  ]);
  sprites.bossAbyss = make(BOSSABYSS_ROWS, {
    r: '#8a653f', k: '#16121f', K: '#2c2440', w: '#c9b8e8',
    e: '#e43b44', m: '#5c1e5e',
  });

  // ── 되삼켜진 손들 (6~9층) — 같은 사람, 저주에 깨어난 후: 시체 팔레트 (v118) ──
  // 되살아난 오스문드: 썩은 살빛, 붉은 눈, 혼불이 된 랜턴, 유령빛 낫날
  sprites.bossWraith = make(BOSS_ROWS, {
    h: '#2c1218', H: '#5a2430', f: '#9ab088', F: '#6a8060', e: '#e43b44',
    c: '#1a0d12', C: '#3a2430', b: '#4a3a3a', s: '#4a3a3a', S: '#c9b8e8',
    o: '#b13ae0', O: '#5c1e5e', d: '#262033',
  });
  // 물에 불은 몰레: 익사체의 부푼 살, 물에 젖은 자루 — 늪이 돌려보낸 것
  sprites.bossPlague = make(BOSSSPORE_ROWS, {
    B: '#3a4a44', b: '#2a3630', r: '#5a6a5a', j: '#2e3e34', J: '#46564a',
    f: '#7aa08a', F: '#5a806a', e: '#e43b44', h: '#a9c1d8', s: '#4a5a4a',
    p: '#1d2420', d: '#262033',
  });
  // 사슬에 얽힌 바르곤: 잿빛 시체, 시퍼렇게 빛나는 사슬과 눈
  sprites.bossDespair = make(BOSSGOLEM_ROWS, {
    m: '#383850', M: '#5a5a7c', f: '#8a8a9a', F: '#6a6a7c', e: '#5ce0e6',
    t: '#242438', T: '#3a3a52', a: '#3a3226', A: '#4a4234',
    c: '#5ce0e6', K: '#8a8a6a', d: '#262033',
  });
  // 재가 된 브란트: 숯이 된 몸, 잉걸 눈, 백열하는 횃불 — 제 불에 삼켜진 자
  sprites.bossInferno = make(BOSSIGNIS_ROWS, {
    r: '#3a3230', R: '#5a4a40', f: '#3a3230', F: '#2a2422', e: '#ffd866',
    t: '#2a2422', T: '#4a3a30', o: '#ff7043', O: '#fff7d0', s: '#2a1a10',
    j: '#5a4a40', J: '#3a2e26', d: '#262033',
  });
  // (v118) 구 팔레트 스왑 막보스 정의 삭제 — 발디아/이노첸시오/늑대/왕/여왕은 아래 v101 전용 실루엣이 유일본

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


  // ══════════════ 왕의 공범들 (2026-07) — 순환 보스 8종: 전부 다른 얼굴 ══════════════
  sprites.bossBram = make(pad([
    '.........llllllll...........',
    '.......llllllllllll.........',
    '.......llfffeefffll.........',
    '......llffffeeffffll........',
    '......llfffFFFFfffll....ss..',
    '......lllfFFFFFFffll....ss..',
    '.....nnnllllllllnnnn....ss..',
    '....nnnnlllllllllnnn...sss..',
    '....nnnlllLLlllllnnn...sss..',
    '....nnllllLLllllllnn..sss...',
    '....nnllllllllllllnn..sss...',
    '....nlllllllllllllln..ss....',
    '....llllllllllllllll..ss....',
    '....llllllllllllllll..ss....',
    '....llllLLLLllllllll..ss....',
    '.....lllLLLLlllllll...ss....',
    '.....llllllllllllll...ww....',
    '......llllllllllll....ww....',
    '......lllll..lllll....ww....',
    '......llll....llll....ww....',
    '....dddddd....dddddd........',
    '....ddddd......ddddd........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', d: '#262033', k: '#23202c', w: '#5e4226', l: '#6a4a2e', L: '#8a653f', r: '#7a1c28', g: '#b08d4a', n: '#4a5a3a' });
  sprites.bossJorn = make(pad([
    '.......bbbbbbbbbbbbbb.......',
    '.....bbbbbbbbbbbbbbbbbb.....',
    '....bbbbbbbbbbbbbbbbbbbb....',
    '....bbbbbbbbbbbbbbbbbbbb....',
    '..........ffeeff........oo..',
    '..........ffeeff........oo..',
    '.........ccccccc........oo..',
    '.......cccccccccc.......oo..',
    '.......cccccccccc.......oo..',
    '.....cccccccccccccc.....oo..',
    '.....cccccCCccccccc.....oo..',
    '....ccccccCCcccccccc....oo..',
    '....cccccccccccccccc....oo..',
    '....cccccccccccccccc....oo..',
    '....cccccccccccccccc....oo..',
    '....cccccccccccccccc...ooo..',
    '....cccccccccccccccc...ooo..',
    '.....cccccccccccccc...oooo..',
    '.....cccccc..cccccc...oooo..',
    '......cccc....cccc.....oo...',
    '....dddddd....dddddd........',
    '....ddddd......ddddd........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', d: '#262033', k: '#23202c', w: '#5e4226', l: '#6a4a2e', L: '#8a653f', r: '#7a1c28', g: '#b08d4a', b: '#6a5a40', c: '#3a4450', C: '#5a6470', o: '#5e4226' });
  sprites.bossQuill = make(pad([
    '.........kkkkkk.....pp......',
    '........kkkkkkkk....pp......',
    '........kkkkkkkk....pp......',
    '........kkkkkkkk....pp......',
    '.......cffffeeffc...pp......',
    '......cccfffeefccc..pp......',
    '......cccccccccccc..........',
    '.....cccccccccccccc.........',
    '.....cccCCccccccccc...PP....',
    '....ccccCCcccccccccc..PP....',
    '....cccccccccccccccc..PP....',
    '....cccccccccccccccc..PP....',
    '....ccccggcccccccccc..PP....',
    '....ccccggcccccccccc..PP....',
    '....cccccccccccccccc..PP....',
    '....cccccccccccccccc..PP....',
    '....cccccccccccccccc........',
    '.....cccccccccccccc.........',
    '.....cccccc..cccccc.........',
    '......cccc....cccc..........',
    '....dddddd....dddddd........',
    '....ddddd......ddddd........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', d: '#262033', k: '#23202c', w: '#5e4226', l: '#6a4a2e', L: '#8a653f', r: '#7a1c28', g: '#b08d4a', c: '#4a4456', C: '#6a6478', p: '#d8d3c5', P: '#b8ae96' });
  sprites.bossGarok = make(pad([
    '.........mmmmmm........ss...',
    '.......mmmmmmmmmm....ssssss.',
    '.......mMMMMMMMMm....ssssss.',
    '......mmMMMMMMMMmm..ssssssss',
    '......mmmmeemmmmmm..ssssssss',
    '......mmmmeemmmmmm...ssssss.',
    '.....MMmmmmmmmmmmMM..ssssss.',
    '...MMMMMmmmmmmmmMMMMM..sss..',
    '..MMMMMrrrrrrrrrrMMMMM..ww..',
    '..MMMMrrrrrrrrrrrrMMMM..ww..',
    '....mmrrrrrrrrrrrrmm....ww..',
    '....mmrrrrrrrrrrrrmm....ww..',
    '....mmrrggggggrrrrmm....ww..',
    '....mmrrggggggrrrrmm....ww..',
    '....mmrrrrrrrrrrrrmm....ww..',
    '....mmrrrrrrrrrrrrmm....ww..',
    '....mmrrrrrrrrrrrrmm....ww..',
    '.....mmrrrrrrrrrrmm.....ww..',
    '.....mmmmm....mmmmm.........',
    '......mmmm....mmmm..........',
    '....dddddd....dddddd........',
    '....ddddd......ddddd........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', d: '#262033', k: '#23202c', w: '#5e4226', l: '#6a4a2e', L: '#8a653f', r: '#7a1c28', g: '#b08d4a' });
  sprites.bossCorvus = make(pad([
    '....kkkkkkkkkkkkkkkkkkkk....',
    '....kkkkkkkkkkkkkkkkkkkk....',
    '.......kkkkkkkkkkkkkk.......',
    '........kkkkkkkkkkkk........',
    '........kkeeeekkkkkbbbbb....',
    '........kkeeeekkkkbbbbbb....',
    '........kkkkkkkkkk..........',
    '........kkkkkkkkkk..........',
    '.......cccccccccccc...ii....',
    '.....cccccccccccccccc.iii...',
    '.....cccCCccccccccccc..iii..',
    '....ccccCCcccccccccccc..ii..',
    '....cccccccccccccccccc..ii..',
    '....cccccccccccccccccc..ii..',
    '....cccccccccccccccccc......',
    '....cccccccccccccccccc......',
    '....cccccccccccccccccc......',
    '.....cccccccccccccccc.......',
    '.....cccccc..cccccc.........',
    '......cccc....cccc..........',
    '....dddddd....dddddd........',
    '....ddddd......ddddd........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', d: '#262033', k: '#23202c', w: '#5e4226', l: '#6a4a2e', L: '#8a653f', r: '#7a1c28', g: '#b08d4a', c: '#2e3430', C: '#4a544c', b: '#b8ae96', i: '#6ab04c' });
  sprites.bossUrsh = make(pad([
    '.........llllll......ii.....',
    '.......llllllllll...iiii....',
    '.......lffeeffffl...oooo....',
    '......llffeeffffll..oooo....',
    '......llllllllllll..oooo....',
    '......llllllllllll...ooo....',
    '.....hhllllllllllhh..ooo....',
    '....hhhhllllllllhhhh..oo....',
    '....hhhollllllllohhh..ww....',
    '....hhooollllllooohhh.www...',
    '....hhoooolllloooohhhh.www..',
    '....hhhooollllooohhhhh..ww..',
    '....hhhhllllllllhhhhh...ww..',
    '....hhhllllllllllhhh...www..',
    '....llllllllllllllll...www..',
    '.....llllllllllllll...www...',
    '.....llllllllllllll...www...',
    '......llllllllllll....ww....',
    '......lllll..lllll..........',
    '......llll....llll..........',
    '....dddddd....dddddd........',
    '....ddddd......ddddd........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', d: '#262033', k: '#23202c', w: '#5e4226', l: '#6a4a2e', L: '#8a653f', r: '#7a1c28', g: '#b08d4a', h: '#3a3430', o: '#e25822', i: '#ffd866' });
  sprites.bossObel = make(pad([
    '.............bb.....ii......',
    '...........bbbbbb...ii......',
    '...........bbbbbb...........',
    '.........bbbbbbbbbb.........',
    '.........bbbbbbbbbb.........',
    '.......bbbbbbbbbbbbb........',
    '.......bffffeeffbbbb....ww..',
    '......bbffffeeffbbbb....ww..',
    '......bbbbbbbbbbbbbb....ww..',
    '.....bbbbbbbbbbbbbbbb...ww..',
    '.....bbbiiBBbbbbbbbbb...ww..',
    '....bbbbiiBBbbbbbbbbbb..ww..',
    '....bbbbbbbbbbiibbbbbb..ww..',
    '....bbbbbbbbbbiibbbbbb..ww..',
    '....bbiibbbbbbbbbbbbbb..ww..',
    '....bbiibbbbbbbbbbbbbb..ww..',
    '....bbbbbbbbbbbbiibbbb..ww..',
    '....bbbbbbbbbbbbiibbb...ww..',
    '....bbbbbbb..bbbbbbbb.......',
    '....bbbbb......bbbbb........',
    '....bbbbb......bbbbb........',
    '.....bb..........bb.........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', d: '#262033', k: '#23202c', w: '#5e4226', l: '#6a4a2e', L: '#8a653f', r: '#7a1c28', g: '#b08d4a', b: '#2e2a4a', B: '#4a4470', i: '#a9e3ff' });
  sprites.bossLancer = make(pad([
    '....rr...kkkkkk.........ss..',
    '....rrr.kkkkkkkkk.......ss..',
    '....rrrrkkkkkkkkk.......ss..',
    '.....rrkkkkkkkkkkk......ss..',
    '......kkkkiieekkkk......ss..',
    '......kkkkiieekkkk......ss..',
    '......kkkkkkkkkkkk......ss..',
    '.....kkkkkkkkkkkkkk.....ss..',
    '.....kkkkkkkkkkkkkk.....ww..',
    '....kkkkkkkkkkkkkkkk....ww..',
    '....kkkkrrkkkkkkkkkk....ww..',
    '....kkkkrrkkkkkkkkkk....ww..',
    '....kkkkkkkkkkkkkkkk....ww..',
    '....kkkkkkkkkkkkkkkk....ww..',
    '....kkkkkkkkkkkkkkkk....ww..',
    '....kkkkkkkkkkkkkkkk....ww..',
    '....kkkkkkkkkkkkkkkk....ww..',
    '.....kkkkkkkkkkkkkk.....ww..',
    '.....kkkkkk..kkkkkk.....ww..',
    '......kkkk....kkkk......ww..',
    '....dddddd....dddddd........',
    '....ddddd......ddddd........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', d: '#262033', k: '#23202c', w: '#5e4226', l: '#6a4a2e', L: '#8a653f', r: '#7a1c28', g: '#b08d4a', i: '#e43b44' });


  // ══════════════ 고정 보스 리드로우 (2026-07) — 왕은 왕처럼, 처형인은 도살자처럼 ══════════════
  sprites.bossVoid = make(pad([
    '.........kkkkkkkk...........',
    '.......kkkkkkkkkkkk.........',
    '.......kkkkkeekkkkk.........',
    '......kkkkkkeekkkkkk........',
    '......kkkkkkkkkkkkkk..sss...',
    '......kkkkkkkkkkkkkk..sssss.',
    '.....ffkkkkkkkkkkkkff...sss.',
    '...fffffkkkkkkkkkfffff..ssss',
    '...fffffllllllllffffffssssss',
    '..fffffllllllllllfffffsssss.',
    '..ffffflllLLlllllfffff..ww..',
    '...fffllllLLllllllfff...ww..',
    '...fffllllllllllllfff...ww..',
    '....fllllllllllllllf....ww..',
    '....llllLLLLLLLLllll....ww..',
    '....llllLLLLLLLLllll....ww..',
    '....llllllllllllllll....ww..',
    '....llllllllllllllll....ww..',
    '....lllllll..lllllll....ww..',
    '....llllll....llllll....ww..',
    '....dddddd....dddddd........',
    '.....dddd......dddd.........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', d: '#262033', k: '#23202c', w: '#5e4226', l: '#6a4a2e', L: '#8a653f', r: '#7a1c28', R: '#a03040', g: '#b08d4a' });
  sprites.bossQueen = make(pad([
    '.........mmmmmmmm......ss...',
    '.......mmmmmmmmmmmm...sssss.',
    '.......mMMMMMMMMMMm...ssMMs.',
    '......mmMMMMMMMMMMmm..ssMMss',
    '......mmmmmmeemmmmmm..ssMMss',
    '......mmmmmmeemmmmmm..ssMMss',
    '.....rMMMMMMMMMMMMrr..ssMMss',
    '....rrMMMMMMMMMMMMrr..ssMMss',
    '....rrmMMMMMMMMMMmrr..ssMMss',
    '....rrmmMMMMMMMMmmrr..ssMMss',
    '....rrmmMMggMMMMmmrr..ssMMss',
    '....rrmmMMggMMMMmmrr..ssMMss',
    '....rrmmMMMMMMMMmmrr..ssMMss',
    '....rrmmMMMMMMMMmmrr..ssMMss',
    '....rrmmMMMMMMMMmmrr..ssMMss',
    '....rrmmmMMMMMMmmmrr..ssMMs.',
    '....rrmmmmmmmmmmmmrr..sssss.',
    '.....rmmmmmmmmmmmmr....ss...',
    '......mmmmm..mmmmm..........',
    '......mmmm....mmmm..........',
    '....dddddd....dddddd........',
    '....ddddd......ddddd........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', d: '#262033', k: '#23202c', w: '#5e4226', l: '#6a4a2e', L: '#8a653f', r: '#7a1c28', R: '#a03040', g: '#b08d4a' });
  sprites.bossValdia = make(pad([
    '.........vvvvvvvv...........',
    '........vvvvvvvvvv..........',
    '........vvvvvvvvvv....tt....',
    '.......vvvvvvvvvvv...tttt...',
    '.......vffffeeffvv..tttttt..',
    '......vvffffeeffvv..tttttt..',
    '......vvvvvvvvvvvv...tttt...',
    '.....vvvvvvvvvvvvvv...tt....',
    '.....vvvggVVvvvvvvv.........',
    '....vvvvggVVvvvvvvvv........',
    '....vvVVvvvvvvvvvvvv..GG....',
    '....vvVVvvvvvvvvvvvv..GG....',
    '....vvvvvvvvggvvvvvv..GG....',
    '....vvvvvvvvggvvvvvv..GGG...',
    '....vvvvvvvvvvvvvvvv..GGGG..',
    '....vvvvvvvvvvvvvvvv...GGG..',
    '....vvvvvvvvvvvvvvvv........',
    '....vvvvvvvvvvvvvvvv........',
    '....vvvvvvv..vvvvvvv........',
    '....vvvvv......vvvvv........',
    '....vvvvv......vvvvv........',
    '.....vv..........vv.........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', d: '#262033', k: '#23202c', w: '#5e4226', l: '#6a4a2e', L: '#8a653f', r: '#7a1c28', R: '#a03040', g: '#b08d4a', v: '#4a4456', V: '#6a6478', t: '#b08d4a', G: '#8a8272' });
  sprites.bossBishop = make(pad([
    '...........pp...............',
    '.........pppppp.............',
    '.........pggppp.......gg....',
    '........ppggpppp.....ggg....',
    '........pppppppp....gggg....',
    '........pppppppp....gggg....',
    '.......cffffeeffc.....cc....',
    '......cccfffeefccc....cc....',
    '......cccccccccccc....cc....',
    '.....cccccccccccccc...cc....',
    '.....cccggCCggccccc...cc....',
    '....ccccggCCggcccccc..cc....',
    '....ccCCccccccccCCcc..cc....',
    '....ccCCccccccccCCcc..cc....',
    '....ccccggggggcccccc..cc....',
    '....ccccggggggcccccc..cc....',
    '....cccccccccccccccc..cc....',
    '....cccccccccccccccc..cc....',
    '....ccccccc..ccccccc........',
    '....ccccc......ccccc........',
    '....ccccc......ccccc........',
    '.....cc..........cc.........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', d: '#262033', k: '#23202c', w: '#5e4226', l: '#6a4a2e', L: '#8a653f', r: '#7a1c28', R: '#a03040', g: '#b08d4a', p: '#e8e0cf', c: '#d8d3c5', C: '#f0ece0' });
  sprites.bossWolf = make(pad([
    '....WW...mWWWWm...WW........',
    '....WWW.mWWWWWWm.WWW........',
    '....WWWWWWWWWWWWWWWW....ss..',
    '.....WWWWWWWWWWWWWW.....ss..',
    '.....WWWWWeeeeWWWWW.....ss..',
    '......WWWWeeeeWWWW......ss..',
    '......WWWWWWWWWWWW......ss..',
    '.....WWWWWWWWWWWWWW.....ss..',
    '.....WWWWWWWWWWWWWW.....ss..',
    '....WWWWWWWWWWWWWWWW....ss..',
    '....WWmmWWWWWWWWmmWW....ss..',
    '....WWmmWWWWWWWWmmWW....ss..',
    '....WWWWWWggWWWWWWWW....ss..',
    '....WWWWWWggWWWWWWWW....ss..',
    '....WWWWWWWWWWWWWWWW..gggg..',
    '.....WWWWWWWWWWWWWW...gggg..',
    '.....WWWWWWWWWWWWWW.....ww..',
    '......WWWWWWWWWWWW......ww..',
    '......WWWWW..WWWWW..........',
    '......WWWW....WWWW..........',
    '....dddddd....dddddd........',
    '....ddddd......ddddd........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', d: '#262033', k: '#23202c', w: '#5e4226', l: '#6a4a2e', L: '#8a653f', r: '#7a1c28', R: '#a03040', g: '#b08d4a', W: '#d8dce4' });
  sprites.bossKing = make(pad([
    '....gg..gg..gg..gg..........',
    '....gg..gg..gg..gg..........',
    '....gggggggggggggg..........',
    '.....gggggggggggg...........',
    '......ffeeffffff.....CC.....',
    '......ffeeffffff....CCCC....',
    '......fffffFFfff....CCCC....',
    '......ffffFFFFff....CCCC....',
    '.....rrrrrrrrrrrr...gCCC....',
    '....rrrrrrrrrrrrrrr..gC.....',
    '....rrrgRRrrrrrrggr.........',
    '....rrgRRRrrrrrrggrr........',
    '....rrRRRrrrrrrrrrrr..ss....',
    '....rrRRrrrrrrrrrrrr..ss....',
    '....rrrrrrggrrrrrrrr..ss....',
    '....rrrrrrggrrrrrrrr..ss....',
    '....rrrrrrrrrrrrrrrr..ss....',
    '....rrrrrrrrrrrrrrrr..ss....',
    '....rrrrrrr..rrrrrrr..ss....',
    '....rrrrr......rrrrr..ss....',
    '....rrrrr......rrrrr........',
    '.....rr..........rr.........',
  ]), { f: '#dcb68c', F: '#c09468', e: '#1a1c2c', m: '#6e7383', M: '#9aa1b0', s: '#c8ccd8', d: '#262033', k: '#23202c', w: '#5e4226', l: '#6a4a2e', L: '#8a653f', r: '#7a1c28', R: '#a03040', g: '#b08d4a', C: '#ffd866' });


  // ══════════════ 잡몹 시나리오 정합 (2026-07) — 저주는 시체를 뒤튼다: 부적합 20종 리드로우 ══════════════
  // v121: slime는 상단 A안 신규 맵 사용 (v102 소형판 대체)
  // v121: toxicSlime는 상단 A안 신규 맵 사용 (v102 소형판 대체)
  sprites.iceSlime = make(pad([
    '...ggggg.....',
    '..gggggggg...',
    '.ggsSsgggg.h.',
    'gggsssggggghh',
    'ggggggggggg..',
    '.ggggggggg...',
  ]), { g: '#3a5a74', s: '#d8e4ec', S: '#1a1c2c', h: '#a9c3d3' });
  sprites.magmaSlime = make(pad([
    '...ggggg.....',
    '..gggggggg...',
    '.ggsSsgggg.h.',
    'gggsssggggghh',
    'ggggggggggg..',
    '.ggggggggg...',
  ]), { g: '#7a3018', s: '#e8d0b0', S: '#1a1c2c', h: '#e25822' });
  sprites.mushroom = make(pad([
    '....ppp.....',
    '...pPrPp....',
    '....ppp.....',
    '.....t......',
    '.....t......',
    '..mmmmmmm...',
    '.mmmmmmmmm..',
    'mmmsmmmmmmm.',
  ]), { p: '#d8cfc0', P: '#e8e0d8', r: '#a03040', t: '#4a5a3e', m: '#3a2c1a', s: '#c9c2b2' });
  sprites.sporePuff = make(pad([
    '..pp..',
    '.pPrp.',
    '..pp..',
    '...t..',
  ]), { p: '#d8cfc0', P: '#e8e0d8', r: '#a03040', t: '#4a5a3e' });
  sprites.sporeMother = make(pad([
    '..ppp...ppp...',
    '.pPrPp.pPrPp..',
    '..ppp...ppp...',
    '...t..pp.t....',
    '...t.pPrp.....',
    '.mmmmmppmmmm..',
    'mmmmmmmtmmmmm.',
    'mmsmmmmmmmsmm.',
  ]), { p: '#d8cfc0', P: '#e8e0d8', r: '#a03040', t: '#4a5a3e', m: '#3a2c1a', s: '#c9c2b2' });
  sprites.acidSnail = make(pad([
    '...mmmmm....',
    '..mMMMMmm...',
    '..mmemmemm..',
    '.rmmmmmmmr..',
    '.rrmmmmmrr..',
    '..rr...rr...',
  ]), { m: '#5a5a48', M: '#7a7a64', e: '#c9d94a', r: '#6a4a2e' });
  sprites.acidSlug = make(pad([
    '..rrrr....',
    '.rrRRrr...',
    'rrRmmRrr..',
    '.rrrrrrr..',
  ]), { r: '#6a4a2e', R: '#8a653f', m: '#5a5a48' });
  sprites.frog = make(pad([
    '...bbbbbb.....',
    '..bbBBBBbb....',
    '.bbBeBBeBbb...',
    '.bbBBBBBBbb...',
    '.obbBBBBbbo...',
    '..bbbbbbbb....',
    '...bb..bb.....',
  ]), { b: '#8a94a0', B: '#a8b4c0', e: '#1a1c2c', o: '#6a5a40' });
  sprites.spider = make(pad([
    '...cccc.....',
    '..cceecc....',
    '..cccccc....',
    't.cccccc.t..',
    '.t.cccc.t...',
    't...cc...t..',
  ]), { c: '#d8d3c5', e: '#1a1c2c', t: '#8a8272' });
  sprites.leech = make(pad([
    'rrRr........',
    '.rrRrrr.....',
    '...rrRrrrr..',
    '......rrRrr.',
  ]), { r: '#7a1c28', R: '#a03040' });
  // v121: bat는 상단 A안 신규 맵 사용 (v102 소형판 대체)
  sprites.bloodBat = make(BAT_ROWS, { w: '#5a1424', b: '#8a2430', k: '#ffd866', f: '#ff4757' }); // v121: 신규 까마귀 맵 승격
  sprites.emberMoth = make(pad([
    '..oi...',
    '.oiio..',
    'oiIIio.',
    '.oiio..',
    '..o....',
  ]), { o: '#e25822', i: '#ffd866', I: '#fff7c0' });
  sprites.wisp = make(pad([
    '..bb...',
    '.bBBb..',
    '.bBIb..',
    '.bBBb..',
    '..bb...',
    '...b...',
  ]), { b: '#3a5a8a', B: '#5ce0e6', I: '#e8f0f8' });
  // v121: boar는 상단 A안 신규 맵 사용 (v102 소형판 대체)
  sprites.charger = make(pad([
    '.....mm.......',
    '....mkmm......',
    '....mmm.......',
    '.mmhhhhhmmm...',
    'mmhhhhhhhmmm..',
    'Smhhhhhhhhmm..',
    '.mm.mm..mm.mm.',
    '.mm.mm..mm.mm.',
  ]), { m: '#5a5a68', k: '#16141e', h: '#4a4a58', S: '#7a7a8c' });
  sprites.gazer = make(pad([
    '...ggg.....',
    '..gwwwg....',
    '.gwweewwg..',
    '.gwwerewwg.',
    '.gwweewwg..',
    '..gwwwg....',
    '...ggg.....',
  ]), { g: '#b08d4a', w: '#d8d3c5', e: '#1a1c2c', r: '#e43b44' });
  sprites.obsidianBeast = make(HORSE_ROWS, { o: '#16141e', H: '#2c2434', G: '#443a54', p: '#b13ae0', e: '#b13ae0', k: '#181220' }); // v121: 무너진 왕의 기마상

  return { ...sprites, white: whiteOf, tint: tintOf };
})();
