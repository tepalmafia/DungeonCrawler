// 픽셀아트를 문자열 배열로 정의하고 Canvas로 렌더링 — 외부 이미지 파일 없음.
// [아트 리마스터] 24×24 해상도 + 3단계 명암 + 자동 1px 아웃라인.
// 팔레트 스왑: 같은 픽셀맵에 다른 팔레트를 적용해 변종을 만든다 (기획안 §11.1).
const Sprites = (() => {
  const sprites = {};
  const whites = new Map();
  const tints = new Map();
  const OUTLINE = '#0d0b14';

  // ── 광원 통일 패스 (v200) ────────────────────────────────────────────────
  // 계측: 스프라이트 93종 중 좌상단 광원 규칙을 지키는 건 14종(15%)뿐이었다.
  //       34종은 정반대(우상단), 41종은 방향이 아예 없었다. 그래서 아무리 잘 그려도
  //       한 화면에 모아놓으면 따로 논다 — 맵에 규칙을 세워도 그 위의 것들이 안 지켰다.
  //
  // 93종을 손으로 다시 그리는 대신, **모든 스프라이트가 지나는 단일 관문**인 make()에서
  // 실루엣으로부터 면의 방향을 읽어 빛을 다시 얹는다.
  //   · 좌·상이 비어 있는 픽셀 = 빛을 받는 모서리  → 따뜻한 쪽으로
  //   · 우·하가 비어 있는 픽셀 = 그늘진 모서리     → 차가운 쪽으로
  // 색상(hue)은 건드리지 않는다. 원화가 의도한 색은 그대로 두고 **명암의 방향만** 통일한다.
  const LIT = [255, 214, 150];   // 따뜻한 하이라이트
  const SHA = [38, 28, 66];      // 차가운 그림자 — 밝기만 낮추면 회색으로 죽는다
  function relight(base, w, h, strength) {
    const ctx = base.getContext('2d');
    const im = ctx.getImageData(0, 0, w, h);
    const d = im.data;
    const src = new Uint8ClampedArray(d);          // 원본 참조 (연쇄 오염 방지)
    const solid = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : (src[(y * w + x) * 4 + 3] > 127 ? 1 : 0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] < 128) continue;
      // 좌상 3방향 노출 − 우하 3방향 노출 → −1(그늘) … +1(빛)
      const up = (1 - solid(x, y - 1)) + (1 - solid(x - 1, y)) + (1 - solid(x - 1, y - 1));
      const dn = (1 - solid(x, y + 1)) + (1 - solid(x + 1, y)) + (1 - solid(x + 1, y + 1));
      const k = (up - dn) / 3;
      if (k === 0) continue;
      const t = Math.min(1, Math.abs(k)) * strength;
      const tgt = k > 0 ? LIT : SHA;
      for (let c = 0; c < 3; c++) d[i + c] = src[i + c] + (tgt[c] - src[i + c]) * t;
    }
    ctx.putImageData(im, 0, 0);
  }

  // ?relight=0 으로 패스를 꺼서 전/후를 같은 자로 비교할 수 있게 한다 (tools/relight-ab.js)
  const RELIGHT = (() => {
    const m = typeof location !== 'undefined' && /[?&]relight=([\d.]+)/.exec(location.search);
    return m ? parseFloat(m[1]) : 0.45;
  })();

  // ds(draw scale): 원본 해상도를 올린 스프라이트가 화면에서 거인이 되지 않게 하는 고유 배율.
  // 예) 백골을 20×19 → 32×34 로 다시 그리면 기본 배율 2에서 화면 64px = 보스만 해진다.
  //     ds 1.35 를 물려 화면 43px 로 맞춘다 — **디테일만 2.6배, 크기는 그대로**
  function make(rows, pal, { outline = true, relightStrength = RELIGHT, ds = 0 } = {}) {
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
    // 광원 통일 — 아웃라인을 붙이기 **전에** 한다.
    // 붙인 뒤에 하면 아웃라인(불투명)이 실루엣을 메워 면의 방향을 못 읽는다
    if (relightStrength > 0) relight(base, w, h, relightStrength);

    if (!outline) { if (ds) base.__ds = ds; return base; }

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
    if (ds) c.__ds = ds;
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
      c.__ds = img.__ds; c.__dsSet = img.__dsSet;
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
      c.__ds = img.__ds; c.__dsSet = img.__dsSet;
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
  // ══════════════════════════════════════════════════════════════════════
  //  부품 공방 (v200) — 사장: "모든 플레이어 몬스터를 시제품처럼 다시 만들어"
  //
  //  93종을 한 장씩 손으로 찍으면 (a) 안 끝나고 (b) 서로 따로 논다.
  //  계측이 그걸 이미 보여줬다 — 광원 방향 15% 준수, 고유 색 251개.
  //  그래서 **부품**을 만든다. 두개골·갈비뼈·투구·검·방패를 한 번 제대로 그려두고
  //  몬스터마다 조립한다. 부품이 규칙을 지키면 조립된 것도 전부 지킨다.
  //
  //  부품이 지키는 규칙 (맵과 같은 3개):
  //    ① 빛은 좌상단 — 부품마다 왼쪽·위 모서리가 밝은 문자(대문자)를 쓴다
  //    ② 팔레트 고정 — 아래 PAL_* 만 쓴다. 부품이 색을 새로 만들지 않는다
  //    ③ 완벽한 직선 금지 — 뼈·천은 끝을 흐트러뜨린다
  //
  //  문자 규약 (모든 부품 공통 — 이게 곧 팔레트 통일이다)
  //    B/b/d  뼈 밝음/기본/그늘      F/f/p  살 밝음/기본/그늘
  //    A/a/n  천·갑옷 밝음/기본/그늘  K/S/s  금속 날/중간/그늘
  //    G/g/h  나무·가죽 밝음/기본/그늘 e/r    눈확/안광
  //    C/c    강조(직업·속성색) 밝음/기본
  // ══════════════════════════════════════════════════════════════════════
  function canvasGrid(w, h) {
    const g = Array.from({ length: h }, () => Array(w).fill('.'));
    g.w = w; g.h = h;
    return g;
  }
  const P = {
    put(g, x, y, ch) { x = Math.round(x); y = Math.round(y);
      if (x >= 0 && x < g.w && y >= 0 && y < g.h) g[y][x] = ch; },
    span(g, y, a, b, ch) { for (let x = a; x <= b; x++) P.put(g, x, y, ch); },
    rect(g, x0, y0, w, h, ch) { for (let y = y0; y < y0 + h; y++) P.span(g, y, x0, x0 + w - 1, ch); },
    ell(g, cx, cy, rx, ry, ch) {
      for (let y = Math.ceil(cy - ry); y <= cy + ry; y++)
        for (let x = Math.ceil(cx - rx); x <= cx + rx; x++)
          if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) P.put(g, x, y, ch);
    },
    // 좌상단 광원을 한 곳에서 강제한다 — 부품마다 손으로 밝기를 찍으면 반드시 어긋난다
    shade(g, cx, cy, rx, ry, hi, mid, lo) {
      P.ell(g, cx, cy, rx, ry, mid);
      for (let y = Math.ceil(cy - ry); y <= cy + ry; y++)
        for (let x = Math.ceil(cx - rx); x <= cx + rx; x++) {
          if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1) continue;
          const nx = (x - cx) / rx, ny = (y - cy) / ry;
          const l = -(nx * 0.72 + ny * 0.7);           // 좌상단 방향 성분
          if (l > 0.45) P.put(g, x, y, hi);
          else if (l < -0.42) P.put(g, x, y, lo);
        }
    },

    // ── 머리 ───────────────────────────────────────────────
    skull(g, cx, cy, s = 1, { jaw = true, horn = 0 } = {}) {
      P.shade(g, cx, cy, 6 * s, 5.5 * s, 'B', 'b', 'd');
      for (let y = cy - 1 * s; y <= cy + 1 * s; y++) {          // 눈확
        P.span(g, Math.round(y), Math.round(cx - 4 * s), Math.round(cx - 2 * s), 'e');
        P.span(g, Math.round(y), Math.round(cx + 2 * s), Math.round(cx + 4 * s), 'e');
      }
      P.put(g, cx - 3 * s, cy, 'r'); P.put(g, cx + 3 * s, cy, 'r');   // 안광
      if (jaw) {
        P.span(g, Math.round(cy + 3 * s), Math.round(cx - 3 * s), Math.round(cx + 3 * s), 'b');
        P.span(g, Math.round(cy + 4 * s), Math.round(cx - 3 * s), Math.round(cx + 3 * s), 'd');
        for (let x = cx - 3 * s; x <= cx + 3 * s; x += 2 * s) P.put(g, x, cy + 4 * s, 'B'); // 이빨
      }
      for (let i = 0; i < horn; i++) {                            // 뿔
        const sgn = i ? 1 : -1;
        for (let k = 0; k < 4 * s; k++) P.put(g, cx + sgn * (5 * s + k * 0.5), cy - 4 * s - k, k < 2 ? 'B' : 'd');
      }
    },
    head(g, cx, cy, s = 1, { hood = false, helm = false, eye = 'r' } = {}) {
      P.shade(g, cx, cy, 5.5 * s, 5 * s, 'F', 'f', 'p');
      if (helm) { P.shade(g, cx, cy - 1.5 * s, 6 * s, 4 * s, 'K', 'S', 's');
        P.span(g, Math.round(cy + 0.5 * s), Math.round(cx - 5 * s), Math.round(cx + 5 * s), 's'); }
      if (hood) { P.shade(g, cx, cy - 1 * s, 6.5 * s, 5.5 * s, 'A', 'a', 'n');
        P.ell(g, cx, cy + 1 * s, 4 * s, 3.2 * s, 'p'); }
      // 눈이 1px이면 4배 확대에서도 안 보인다. 2px + 눈썹 그늘로 얼굴을 만든다
      P.span(g, Math.round(cy - 1.6 * s), Math.round(cx - 3.2 * s), Math.round(cx + 3.2 * s), 'p');
      for (const sgn of [-1, 1]) {
        P.put(g, cx + sgn * 2 * s, cy, 'e'); P.put(g, cx + sgn * 2 * s + (sgn < 0 ? 1 : -1), cy, 'e');
        P.put(g, cx + sgn * 2 * s, cy, eye);
      }
      P.span(g, Math.round(cy + 2.4 * s), Math.round(cx - 1.6 * s), Math.round(cx + 1.6 * s), 'p');  // 입
    },

    // ── 몸통 ───────────────────────────────────────────────
    ribcage(g, cx, cy, s = 1, bars = 4) {
      P.shade(g, cx, cy, 6 * s, 5.5 * s, 'b', 'd', 'd');
      for (let i = 0; i < bars; i++) {
        const y = Math.round(cy - 3.5 * s + i * 2 * s);
        const w = Math.round((5 - Math.abs(i - (bars - 1) / 2) * 0.7) * s);
        P.span(g, y, cx - w, cx + w, 'b');
        P.put(g, cx - w, y, 'B');                                 // ← 좌측 모서리 하이라이트
      }
      for (let y = cy - 4 * s; y <= cy + 4 * s; y++) P.put(g, cx, Math.round(y), 'B'); // 흉골
    },
    torso(g, cx, cy, s = 1, { hi = 'A', mid = 'a', lo = 'n', belt = true } = {}) {
      P.shade(g, cx, cy, 5.5 * s, 6 * s, hi, mid, lo);
      if (belt) { P.span(g, Math.round(cy + 4 * s), Math.round(cx - 5 * s), Math.round(cx + 5 * s), 'h');
        P.put(g, cx, cy + 4 * s, 'G'); }
    },
    pelvis(g, cx, cy, s = 1, ch = 'b') {
      P.span(g, Math.round(cy), Math.round(cx - 4 * s), Math.round(cx + 4 * s), ch);
      P.span(g, Math.round(cy + 1 * s), Math.round(cx - 4 * s), Math.round(cx + 4 * s), 'd');
    },
    legs(g, cx, cy, s = 1, len = 7, { hi = 'b', lo = 'd', boot = false } = {}) {
      for (let y = 0; y < len; y++) {
        P.put(g, cx - 3 * s, cy + y, hi); P.put(g, cx - 4 * s, cy + y, lo);
        P.put(g, cx + 3 * s, cy + y, hi); P.put(g, cx + 4 * s, cy + y, lo);
      }
      const fy = Math.round(cy + len);
      P.span(g, fy, Math.round(cx - 5 * s), Math.round(cx - 2 * s), boot ? 'h' : hi);
      P.span(g, fy, Math.round(cx + 2 * s), Math.round(cx + 5 * s), boot ? 'h' : hi);
      P.span(g, fy + 1, Math.round(cx - 5 * s), Math.round(cx - 2 * s), boot ? 'G' : lo);
      P.span(g, fy + 1, Math.round(cx + 2 * s), Math.round(cx + 5 * s), boot ? 'G' : lo);
    },
    arms(g, cx, cy, s = 1, { hi = 'b', lo = 'd', raise = 0 } = {}) {
      for (let y = 0; y < 5 * s; y++) {                             // 왼팔 — 늘어뜨림
        P.put(g, cx - 7 * s, cy + y, hi); P.put(g, cx - 8 * s, cy + y + 1, lo);
      }
      P.span(g, Math.round(cy + 6 * s), Math.round(cx - 9 * s), Math.round(cx - 7 * s), hi);
      for (let y = 0; y < 4 * s; y++) {                             // 오른팔 — 무기 쪽
        P.put(g, cx + 7 * s, cy + y - raise, hi); P.put(g, cx + 8 * s, cy + y - 1 - raise, lo);
      }
    },
    // 망토 — 1차는 폭이 너무 벌어져 **고깔**이 됐다. 사람이 입은 천으로 읽히려면
    // ① 벌어짐이 완만하고 ② 세로 주름이 있고 ③ 밑단이 해져 있어야 한다.
    // 그리고 아래로 다리가 비어져 나와야 서 있는 사람이 된다 (len 을 짧게 잡는다)
    cloak(g, cx, cy, s = 1, len = 12, { hi = 'A', mid = 'a', lo = 'n' } = {}) {
      for (let y = 0; y < len; y++) {
        const t = y / len;
        const w = Math.round((4.2 + t * t * 4.4) * s);
        const yy = Math.round(cy + y);
        P.span(g, yy, cx - w, cx + w, mid);
        P.put(g, cx - w, yy, hi); P.put(g, cx - w + 1, yy, hi);
        P.put(g, cx + w, yy, lo); P.put(g, cx + w - 1, yy, lo);
        if (y > 1) for (const fx of [-2.4, 0.6, 2.8]) {
          const px = Math.round(cx + fx * s * (1 + t));
          if (Math.abs(px - cx) < w - 1) P.put(g, px, yy, (yy + px) % 3 ? lo : mid);
        }
        if (y === len - 1) for (let x = cx - w; x <= cx + w; x++)
          if ((x * 5 + yy * 3) % 3 === 0) P.put(g, x, yy + 1, lo);
      }
    },
    // 팔 — 타원 하나로 그리면 '알약'이 된다. 위팔·아래팔 2단으로 꺾고 팔꿈치에 어두운 선
    limb(g, x0, y0, s = 1, { hi = 'F', mid = 'f', lo = 'p', dx = 0, len = 5, thick = 3 } = {}) {
      let x = x0, y = y0;
      for (let k = 0; k < len; k++) {
        P.span(g, Math.round(y), Math.round(x - thick / 2), Math.round(x + thick / 2), mid);
        P.put(g, Math.round(x - thick / 2), Math.round(y), hi);
        P.put(g, Math.round(x + thick / 2), Math.round(y), lo);
        x += dx * 0.5; y += 1;
      }
      P.span(g, Math.round(y), Math.round(x - thick / 2), Math.round(x + thick / 2), lo);
      y += 1;
      for (let k = 0; k < len; k++) {
        P.span(g, Math.round(y), Math.round(x - thick / 2 + 0.5), Math.round(x + thick / 2 - 0.5), mid);
        P.put(g, Math.round(x - thick / 2 + 0.5), Math.round(y), hi);
        x += dx; y += 1;
      }
      P.shade(g, x, y, thick * 0.7, thick * 0.6, hi, mid, lo);
      return { x: Math.round(x), y: Math.round(y) };
    },
    // ── 무기 ── 어느 부품이든 '쥔 손'이 붙는다. 손이 없으면 몸에서 뜬다
    grip(g, x, y, s = 1) { P.rect(g, Math.round(x - 1), Math.round(y), 3, Math.round(2 * s), 'f'); },
    sword(g, x, y, s = 1, len = 11) {
      for (let k = 0; k < len; k++) {                               // 날 3px — 좌측이 밝다
        const yy = Math.round(y - k);
        P.put(g, x - 1, yy, 'K'); P.put(g, x, yy, 'S'); P.put(g, x + 1, yy, 's');
      }
      P.put(g, x, Math.round(y - len), 'K');                        // 칼끝
      P.span(g, Math.round(y + 1), x - 3, x + 3, 'G');              // 코등이
      P.span(g, Math.round(y + 2), x - 2, x + 2, 'g');
      P.rect(g, x - 1, Math.round(y + 3), 3, 4, 'h');               // 손잡이
      P.span(g, Math.round(y + 7), x - 2, x + 2, 'G');              // 자루끝
      P.grip(g, x, y + 3, s);
    },
    spear(g, x, y, s = 1, len = 20) {
      for (let k = 0; k < len; k++) P.put(g, x, Math.round(y - k), k % 5 === 4 ? 'G' : 'g');
      const t = Math.round(y - len);
      P.put(g, x, t - 3, 'K'); P.span(g, t - 2, x - 1, x + 1, 'K');
      P.span(g, t - 1, x - 2, x + 2, 'S'); P.span(g, t, x - 1, x + 1, 's');
      P.grip(g, x, y - 4, s);
    },
    // 도끼 — 1차는 날을 타원으로 그려 '회색 덩어리'였다.
    // 초승달 형태의 날 + 반대쪽 뿔 + 자루 밴드가 있어야 도끼로 읽힌다
    axe(g, x, y, s = 1) {
      for (let k = 0; k < 15 * s; k++) P.put(g, x, Math.round(y - k), k % 4 === 3 ? 'G' : 'g');
      const hy = Math.round(y - 13 * s);
      for (let dy = -6 * s; dy <= 6 * s; dy++) {                    // 날 — 바깥이 볼록한 초승달
        const t = dy / (6 * s);
        const out = Math.round((1 - t * t) * 7 * s) + 1;
        const inn = Math.round(Math.abs(t) * 1.6 * s);
        for (let dx = inn; dx <= out; dx++) {
          const px = x + 1 + dx, py = Math.round(hy + dy);
          P.put(g, px, py, dx >= out - 1 ? 'K' : dx <= inn + 1 ? 's' : 'S');
        }
      }
      P.put(g, x - 1, hy - 5 * s, 'S'); P.put(g, x - 2, hy - 4 * s, 's');   // 반대쪽 뿔
      P.put(g, x - 1, hy + 5 * s, 'S');
      P.span(g, hy + 7 * s, x - 1, x + 2, 'G');                            // 자루 밴드
      P.grip(g, x, y - 4 * s, s);
    },
    shield(g, x, y, s = 1) {
      P.shade(g, x, y, 5 * s, 6.5 * s, 'K', 'S', 's');
      P.ell(g, x, y, 2 * s, 2.5 * s, 'G');                          // 문장
      P.put(g, x - 1, y - 1, 'C');
    },
    staff(g, x, y, s = 1, len = 18) {
      for (let k = 0; k < len; k++) P.put(g, x, Math.round(y - k), k % 6 === 5 ? 'G' : 'g');
      P.shade(g, x, y - len - 2, 3, 3, 'C', 'c', 'c');              // 정수
      P.grip(g, x, y - 6, s);
    },
    // 활 — 첫 조립에서 '세로 막대'로 보였다. 만곡을 크게 주고 끝을 반대로 꺾어(리커브)
    // 활이라는 걸 실루엣만으로 알게 한다. 시위는 당겨진 각으로 그린다
    bow(g, x, y, s = 1, { drawn = true } = {}) {
      const H = 11;
      for (let k = -H; k <= H; k++) {
        const t = k / H;
        let dx = (1 - t * t) * 5.5;                                  // 바깥으로 부푼 활대
        if (Math.abs(k) > H - 3) dx -= (Math.abs(k) - (H - 3)) * 1.8; // 끝은 반대로 꺾인다
        const px = Math.round(x + dx), py = Math.round(y + k);
        P.put(g, px, py, 'G'); P.put(g, px + 1, py, 'g');
        if (Math.abs(k) === H) { P.put(g, px, py, 'h'); }             // 고자
      }
      const nock = drawn ? 3 : 0;                                     // 시위 — 당겨진 각
      for (let k = -H; k <= H; k++) {
        const t = Math.abs(k) / H;
        P.put(g, Math.round(x - nock * (1 - t)), Math.round(y + k), 's');
      }
      if (drawn) {                                                    // 메긴 화살
        for (let k = 0; k < 9; k++) P.put(g, Math.round(x - nock + 1 + k), y, k > 6 ? 'K' : 'g');
        P.put(g, Math.round(x - nock), y - 1, 'B'); P.put(g, Math.round(x - nock), y + 1, 'B');
      }
      P.grip(g, x + 2, y - 1, s);
    },
    scythe(g, x, y, s = 1) {
      for (let k = 0; k < 22; k++) P.put(g, x, Math.round(y - k), k % 5 === 4 ? 'G' : 'g');
      const cx = x - 9, cy = y - 20;                                 // 초승달 날
      for (let a = -0.2; a < 1.5; a += 0.05) {
        const rr = 9.5;
        P.put(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 'K');
        P.put(g, cx + Math.cos(a) * (rr - 1), cy + Math.sin(a) * (rr - 1), 'S');
      }
      P.grip(g, x, y - 5, s);
    },
    wings(g, cx, cy, s = 1, { hi = 'A', mid = 'a', lo = 'n' } = {}) {
      for (const sgn of [-1, 1]) for (let k = 0; k < 9 * s; k++) {
        const x = Math.round(cx + sgn * (6 * s + k));
        const h = Math.round(6 * s - k * 0.5);
        for (let y = -h; y <= h; y++) P.put(g, x, Math.round(cy + y * 0.6), sgn < 0 ? (y < 0 ? hi : mid) : (y < 0 ? mid : lo));
      }
    },
    // ── 짐승·비행·식물·점액 부품 (v200 2차) ──
    // 인간형만으로는 로스터가 안 채워진다. 실루엣이 갈리는 몸통 유형을 따로 만든다
    beast(g, cx, cy, s = 1, { hi = 'F', mid = 'f', lo = 'p', legs = 4 } = {}) {
      P.shade(g, cx, cy, 9 * s, 5.5 * s, hi, mid, lo);           // 네발 몸통 — 가로로 길다
      for (let i = 0; i < legs; i++) {                            // 다리
        const x = Math.round(cx - 6 * s + i * (12 * s / (legs - 1)));
        for (let y = 0; y < 5 * s; y++) { P.put(g, x, cy + 4 * s + y, mid); P.put(g, x + 1, cy + 4 * s + y, lo); }
        P.span(g, Math.round(cy + 9 * s), x - 1, x + 2, lo);
      }
    },
    snout(g, cx, cy, s = 1, { hi = 'F', mid = 'f', lo = 'p', tusk = false } = {}) {
      P.shade(g, cx, cy, 5 * s, 4 * s, hi, mid, lo);              // 주둥이 달린 머리
      P.span(g, Math.round(cy + 1 * s), Math.round(cx - 8 * s), Math.round(cx - 4 * s), mid);
      P.span(g, Math.round(cy + 2 * s), Math.round(cx - 8 * s), Math.round(cx - 4 * s), lo);
      P.put(g, cx - 1 * s, cy - 1 * s, 'r');
      if (tusk) { P.put(g, cx - 7 * s, cy, 'B'); P.put(g, cx - 8 * s, cy - 1 * s, 'B'); }
    },
    // 점액 — 1차 조립에서 **원뿔**로 보였다 (선형 테이퍼). 실제 점액은
    // 위가 둥근 돔이고, 아래가 바닥에 눌려 퍼지며, 가장자리가 출렁인다.
    blob(g, cx, cy, s = 1, { hi = 'C', mid = 'c', lo = 'n' } = {}) {
      const H = 7 * s, W = 8 * s;
      for (let y = -H; y <= H; y++) {
        const t = (y + H) / (2 * H);                       // 0 위 … 1 아래
        // 돔: 위는 원의 곡선, 아래는 바닥에 눌려 퍼진다
        let w = t < 0.55
          ? Math.sqrt(Math.max(0, 1 - ((0.55 - t) / 0.55) ** 2)) * W * 0.86
          : W * (0.86 + (t - 0.55) * 0.42);
        w += Math.sin(y * 1.4 + cx) * 0.7 * s;             // 출렁이는 가장자리
        w = Math.round(w);
        const yy = Math.round(cy + y);
        P.span(g, yy, cx - w, cx + w, mid);
        P.put(g, cx - w, yy, hi); P.put(g, cx + w, yy, lo);
        if (t > 0.92) { P.span(g, yy, cx - w, cx + w, lo); }   // 바닥에 닿아 어둡다
      }
      P.ell(g, cx - 3 * s, cy - 3.5 * s, 2.6 * s, 1.7 * s, hi);   // 큰 반사광 — 젤리로 읽히는 핵심
      P.put(g, cx - 4 * s, cy - 4 * s, 'B');
      for (const sgn of [-1, 1]) {                                // 눈 — 점이 아니라 덩어리
        P.ell(g, cx + sgn * 3.2 * s, cy + 0.5 * s, 1.7 * s, 2 * s, 'e');
        P.put(g, cx + sgn * 3.2 * s - 1, cy - 0.6 * s, 'B');
      }
    },
    flyer(g, cx, cy, s = 1, { hi = 'A', mid = 'a', lo = 'n', ear = true } = {}) {
      P.shade(g, cx, cy, 4.5 * s, 4 * s, hi, mid, lo);            // 작은 몸
      for (const sgn of [-1, 1]) for (let k = 1; k <= 10 * s; k++) {   // 막 날개
        const x = Math.round(cx + sgn * (4 * s + k));
        const top = Math.round(cy - 3 * s - k * 0.35);
        const bot = Math.round(cy + 2 * s - k * 0.15 + (k % 3 === 0 ? 1 : 0));  // 톱니 아랫단
        for (let y = top; y <= bot; y++) P.put(g, x, y, sgn < 0 ? (y < cy ? hi : mid) : (y < cy ? mid : lo));
      }
      if (ear) { P.put(g, cx - 2 * s, cy - 5 * s, mid); P.put(g, cx - 2 * s, cy - 6 * s, hi);
        P.put(g, cx + 2 * s, cy - 5 * s, mid); P.put(g, cx + 2 * s, cy - 6 * s, hi); }
      P.put(g, cx - 2 * s, cy, 'r'); P.put(g, cx + 2 * s, cy, 'r');
    },
    plant(g, cx, cy, s = 1, { hi = 'C', mid = 'c', stalk = 'm' } = {}) {
      for (let y = 0; y < 10 * s; y++) { P.put(g, cx, cy + y, stalk); P.put(g, cx - 1, cy + y, 'n'); }
      P.shade(g, cx, cy, 6 * s, 5 * s, hi, mid, 'n');             // 머리(꽃·갓)
      for (let k = 0; k < 5; k++) {                                // 이빨·가시
        const a = -0.4 + k * 0.45;
        P.put(g, cx + Math.cos(a) * 6 * s, cy + Math.sin(a) * 5 * s + 1, 'B');
      }
    },
    orb(g, cx, cy, s = 1, { hi = 'C', mid = 'c', lo = 'n', pupil = true } = {}) {
      P.shade(g, cx, cy, 6.5 * s, 6.5 * s, hi, mid, lo);          // 떠다니는 구체
      if (pupil) { P.ell(g, cx, cy, 3 * s, 3 * s, 'e'); P.ell(g, cx, cy, 1.6 * s, 1.6 * s, 'r');
        P.put(g, cx - 2 * s, cy - 2 * s, 'B'); }
      for (let k = 0; k < 6; k++) {                                // 아래로 늘어진 촉수
        const x = Math.round(cx - 5 * s + k * 2 * s);
        const len = 3 + ((k * 7) % 4);
        for (let y = 0; y < len; y++) P.put(g, x, Math.round(cy + 6 * s + y), y === len - 1 ? lo : mid);
      }
    },
    crawler(g, cx, cy, s = 1, { hi = 'A', mid = 'a', lo = 'n', legs = 8 } = {}) {
      P.shade(g, cx, cy + 1 * s, 5 * s, 4 * s, hi, mid, lo);      // 거미형 — 다리가 실루엣
      P.shade(g, cx, cy - 4 * s, 3 * s, 2.5 * s, hi, mid, lo);
      for (let i = 0; i < legs; i++) {
        const sgn = i % 2 ? 1 : -1, k = Math.floor(i / 2);
        let x = cx + sgn * 4 * s, y = cy - 1 * s + k * 2 * s;
        for (let j = 0; j < 6 * s; j++) {
          x += sgn * 1.1; y += (j < 3 * s ? -0.8 : 1.1);
          P.put(g, x, y, j < 3 * s ? mid : lo);
        }
      }
      P.put(g, cx - 2 * s, cy - 4 * s, 'r'); P.put(g, cx + 2 * s, cy - 4 * s, 'r');
    },
    // 조립 결과를 문자열 행으로
    rows(g) { return g.map((r) => r.join('')); },
  };

  // 표준 팔레트 — 부품이 쓰는 문자 전부를 여기서 정의한다.
  // 몬스터마다 색을 새로 만들지 않고 **이걸 덮어쓰기만** 한다. 그게 통일의 실체다.
  const KIT = {
    B: '#f4eeda', b: '#d8d0b8', d: '#9a917c',      // 뼈
    F: '#e8c9a0', f: '#c9a179', p: '#8a6a4e',      // 살
    A: '#6a6480', a: '#4a4560', n: '#2e2a3e',      // 천·갑옷
    K: '#e6ecff', S: '#9aa2b8', s: '#5a6076',      // 금속
    G: '#c0994e', g: '#8a6b3c', h: '#4a3620',      // 나무·가죽
    e: '#1a1622', r: '#e43b44',                    // 눈확·안광
    C: '#8ad8ff', c: '#4a9ad0',                    // 강조
    o: '#16121f', w: '#e8dfc8', m: '#b8ae96', R: '#a88a5a',  // 구(舊) 픽셀맵 호환
  };
  // 몬스터 한 마리 = 격자 + 조립 함수 + 팔레트 덮어쓰기.
  // ds 는 화면 크기를 유지하는 고유 배율 (원본을 키워도 덩치는 그대로)
  function mob(w, h, build, ov = {}, ds = 0) {   // ds 0 = 크기는 적 정의의 r 이 정한다 (enemies.js)
    const g = canvasGrid(w, h);
    build(g);
    return make(P.rows(g), { ...KIT, ...ov }, { ds });
  }

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
  // ★ v200 — 사장: "너가 만든 시제품이 더 나은데 왜 이렇게 안만들어?"
  // 맞는 지적이었다. 시제품(32×34)을 만들어놓고 전역 조명 패스라는 싸고 체계적인 길로
  // 도망쳤다. 모서리 45% 틴트는 22×21 막대기를 갈비뼈 있는 백골로 바꾸지 못한다.
  // 종전(20×19)에 없던 것: 갈비뼈 4단 · 흉골 · 눈확 · 이빨 · 골반 ·
  //                        날/코등이/손잡이가 있는 검 (종전엔 2px 갈색 막대)
  // 화면 크기는 ds 1.35 로 유지한다 — 디테일만 2.6배, 덩치는 그대로
  const SKELETON_ROWS = pad([ // 깨어난 백골 (v200 시제품 채택)
    '.......................K........',
    '......................KKs.......',
    '........BBBBBBBBB.....SKs.......',
    '.......BBBBBBBBBBB....SKs.......',
    '.......bbbbbbbbbbb....SKs.......',
    '.......bbbbbbbbbbb....SKs.......',
    '.......beeebbbeeeb....SKs.......',
    '......bberebbberebb...SKs.......',
    '.......beeebbbeeeb....SKs.......',
    '.......bbbbbbbbbbb....SKs.......',
    '.......bbbbbbbbbbb....SKs.......',
    '........bBdBdBdBb.....SKs.......',
    '..........bbbbb.....ggggggg.....',
    '..........ddddd.....bGGGGG......',
    '........ddddBdddd..bb.hhh.......',
    '.....b.bbbbbBbbbbb.bb.hhh.......',
    '....bb.dddddBddddd.bb.hhh.......',
    '....bb.bbbbbBbbbbb.b..hhh.......',
    '....bbddddddBdddddd..ggggg......',
    '....bb.bbbbbBbbbbb..............',
    '....b..dddddBddddd..............',
    '...bbb.bbbbbBbbbbb..............',
    '........ddddBdddd...............',
    '........bbbbbbbbb...............',
    '........ddddddddd...............',
    '........db.....bd...............',
    '........db.....bd...............',
    '........db.....bd...............',
    '........db.....bd...............',
    '........db.....bd...............',
    '........db.....bd...............',
    '........db.....bd...............',
    '.......bbbb...bbbb..............',
    '.......dddd...dddd..............',
  ]);
  // 뼈 3단(B 하이라이트 / b 기본 / d 그늘) + 검 3단(K 날 / S 중간 / s 그늘) + 금속 코등이
  const BONE_PAL = {
    b: '#d8d0b8', B: '#f4eeda', d: '#9a917c', e: '#1a1622', r: '#e43b44',
    S: '#9aa2b8', K: '#e6ecff', s: '#6a7086', g: '#8a6b3c', G: '#c0994e', h: '#4a3620',
    o: '#16121f', R: '#a88a5a', w: '#e8dfc8', m: '#b8ae96',
  };
  sprites.skeleton = make(SKELETON_ROWS, BONE_PAL);

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
  // 뼈무더기 — 같은 픽셀맵에 죽은 색을 입힌다 (팔레트 스왑). 새 문자 전부를 덮어야 한다
  sprites.boneHeap = make(SKELETON_ROWS, { ...BONE_PAL,
    B: '#d8cfb8', b: '#a89e86', d: '#6e6656', e: '#ffd866', r: '#6a4a2a', R: '#7a5a3a',
    S: '#5a5448', K: '#8a8272', s: '#3e3a30', g: '#4a3a22', G: '#6a5432', h: '#2e2216' });
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

  // ══════════════════════════════════════════════════════════════════════
  //  절차 프레임 생성 (v179) — "97종 중 걷기 7종·공격 2종·피격/죽음 0종"을 깬다
  //
  //  사장 질문: "몬스터 캐릭 맵 퀄러티 개편은?"
  //  계측: 스프라이트 97종 중 걷기 프레임 7종(7%) · 공격 2종(2%) · 피격/죽음 **0종**.
  //  적 63종 중 61종이 **정지 이미지**다. 움직여 보이던 건 전부 회전·눌림·반전 트릭이었다.
  //
  //  이건 그림 문제이자 게임플레이 문제다. v175에서 방패 해골을 고칠 때 적은 기록:
  //  "밀치기 중인지 걷는 중인지 화면상 구분이 불가능했다." 붉은 부채꼴은 **위험하다**를 말하고,
  //  자세는 **무엇이 오는가**를 말한다. 지금까지 후자가 없었다.
  //
  //  61종을 손으로 그릴 수는 없다. 대신 **한 장에서 자세를 만들어낸다** —
  //  실루엣을 행 구간별로 전단·이동·압축하면 관절이 있는 것처럼 보인다.
  //  ★ 정직하게: 자동 생성은 사람이 그린 무게 이동과 예비 동작을 못 만든다.
  //    "0에서 그럴듯한 것"까지가 이 기법의 한계다. 그 구간이 큰 도약이라 간다
  // ══════════════════════════════════════════════════════════════════════

  // 행 구간별로 다르게 변형한다. fn(t) → {dx, dy, sx} (t: 0=머리 1=발)
  function warp(img, fn) {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const h = img.height, w = img.width;
    for (let y = 0; y < h; y++) {
      const t = h > 1 ? y / (h - 1) : 0.45;
      const d = fn(t) || {};
      const dx = Math.round(d.dx || 0), dy = Math.round(d.dy || 0);
      const sx = d.sx == null ? 1 : d.sx;
      ctx.save();
      ctx.translate(w / 2 + dx, 0);
      ctx.scale(sx, 1);
      ctx.drawImage(img, 0, y, w, 1, -w / 2, y + dy, w, 1); // 픽셀아트라 보간 없이 정수 이동만
      ctx.restore();
    }
    return c;
  }

  // 명도·투명도 조정 — 피격(밝게)·죽음(어둡고 옅게)
  function shade(img, mul, alpha) {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    if (mul !== 1) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = Math.min(0.8, Math.abs(mul - 1));
      ctx.fillStyle = mul > 1 ? '#ffffff' : '#000000';
      ctx.fillRect(0, 0, c.width, c.height);
    }
    if (alpha != null && alpha < 1) {
      const out = document.createElement('canvas');
      out.width = c.width; out.height = c.height;
      const o = out.getContext('2d');
      o.imageSmoothingEnabled = false;
      o.globalAlpha = alpha;
      o.drawImage(c, 0, 0);
      return out;
    }
    return c;
  }

  // 한 장에서 자세를 만든다.
  //  walk 2장 — 상체는 거의 고정, 하체가 좌우로 흔들린다 (걸음의 무게 이동)
  //  wind    — 뒤로 젖히고 웅크린다 (예고: "온다")
  //  strike  — 앞으로 쏟아지며 가로로 늘어난다 (타격: "왔다") — 예고와 **반대 방향**이라 한 쌍으로 읽힌다
  //  hurt    — 뒤로 꺾이고 밝아진다      die — 세로로 무너진다
  function deriveFrames(img) {
    return {
      walk: [
        warp(img, (t) => ({ dx: t > 0.55 ? (t - 0.55) * 3.2 : 0, dy: t < 0.3 ? -1 : 0 })),
        warp(img, (t) => ({ dx: t > 0.55 ? -(t - 0.55) * 3.2 : 0, dy: t < 0.3 ? 1 : 0 })),
      ],
      wind: warp(img, (t) => ({ dx: -(1 - t) * 3.4, dy: t < 0.4 ? 1 : 0, sx: 1 - (1 - t) * 0.06 })),
      strike: warp(img, (t) => ({ dx: (1 - t) * 4.6, dy: t < 0.4 ? -1 : 0, sx: 1 + (1 - t) * 0.1 })),
      hurt: shade(warp(img, (t) => ({ dx: -(1 - t) * 2.2, dy: t < 0.5 ? 1 : 0 })), 1.45),
      die: shade(warp(img, (t) => ({ dy: (1 - t) * 4.5, sx: 1 + t * 0.3 })), 0.72, 0.85),
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  림라이트 (v180) — 스프라이트를 장면 **안**에 놓는다
  //
  //  계측: 어둠 패스·횃불 구멍·층 색보정·비네트는 이미 있다. 없던 것은
  //  **스프라이트가 광원에 반응하지 않는다**는 것 — 횃불 옆에 선 해골과
  //  방 구석의 해골이 똑같이 밝다. 그래서 캐릭터가 배경 '안'이 아니라 '위'에 얹혀 보인다.
  //
  //  픽셀아트의 정석 기법: 광원 쪽 가장자리 1~2px만 밝게(rim). 실루엣을 광원 반대로
  //  밀어 원본에서 빼면 **빛 받는 쪽 테두리**만 남는다.
  //  방향 8종 × 색 2종(따뜻한 불빛/차가운 달빛)을 **처음 쓸 때 구워** 캐시한다 —
  //  사운드에서 쓴 "render once, play many"와 같은 수법이다
  // ══════════════════════════════════════════════════════════════════════
  const rims = new Map();
  const RIM_DIRS = 8;
  // 실루엣을 n픽셀 깎는다 — 림이 **자동 생성된 검은 아웃라인 위에 얹히지 않게** 하는 장치.
  // v180의 림은 아웃라인을 포함한 이미지에서 만들어져서, `lighter` 합성이
  // **검은 테두리를 흰 후광으로** 바꿨다 (사장 스크린샷: "캐릭터 윤각이 두껍게 테두리가 생겼잔아").
  // make()가 실루엣을 8방향으로 찍어 1px 테두리를 두르므로, 2px 깎으면 안쪽 살만 남는다
  const eroded = new Map();
  function erodeOf(img, n) {
    const key = img.width + 'x' + img.height + '#' + n;
    let byImg = eroded.get(img);
    if (!byImg) { byImg = new Map(); eroded.set(img, byImg); }
    if (byImg.has(key)) return byImg.get(key);
    let cur = img;
    for (let i = 0; i < n; i++) {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.drawImage(cur, 0, 0);
      x.globalCompositeOperation = 'destination-in';
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) x.drawImage(cur, dx, dy);
      cur = c;
    }
    byImg.set(key, cur);
    return cur;
  }

  function rimOf(img, dir, warm) {
    const key = (warm ? 'w' : 'c') + dir;
    let byImg = rims.get(img);
    if (!byImg) { byImg = new Map(); rims.set(img, byImg); }
    const hit = byImg.get(key);
    if (hit) return hit;
    const a = (dir / RIM_DIRS) * Math.PI * 2;
    const dx = Math.round(Math.cos(a) * 1.6), dy = Math.round(Math.sin(a) * 1.6);
    const src = erodeOf(img, 2);   // ★ 아웃라인 2px를 깎아낸 '안쪽 살'에서만 림을 만든다
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0);
    // 광원 반대쪽으로 민 자기 자신을 빼면 빛 받는 쪽 가장자리만 남는다
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(src, -dx, -dy);
    // 그 테두리를 빛 색으로 칠한다 (불빛은 주황, 달빛은 창백한 청백)
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = warm ? '#ffb45c' : '#bcd0e8';
    ctx.fillRect(0, 0, c.width, c.height);
    c.__ds = img.__ds; c.__dsSet = img.__dsSet;
    byImg.set(key, c);
    return c;
  }
  // ── 실제 몸 높이 (v200) ────────────────────────────────────────────────
  // 사장: "몬스터에 맞게 크기 비율 맞춰야지"
  // 종전엔 모든 스프라이트를 같은 배율로 뿌려서, 게임이 이미 선언한 몸 크기(r)가
  // 화면에서 죽었다 — 골렘(r18)과 백골(r13)이 같은 키로 보였다.
  // 캔버스 높이는 여백을 포함하므로 자로 쓸 수 없다. **불투명 픽셀의 실제 높이**를 잰다.
  const bhCache = new Map();
  function bodyH(img) {
    if (!img || !img.width) return 0;
    if (bhCache.has(img)) return bhCache.get(img);
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let top = -1, bot = -1;
    for (let y = 0; y < c.height; y++) {
      let on = false;
      for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { on = true; break; }
      if (on) { if (top < 0) top = y; bot = y; }
    }
    const h = top < 0 ? img.height : (bot - top + 1);
    bhCache.set(img, h);
    return h;
  }
  sprites.bodyH = bodyH;
  // 몸 반경 r 인 적을 화면에서 얼마나 크게 그릴 것인가.
  // 중앙값 r=13 이 종전 백골과 비슷한 크기로 나오도록 잡았다 (r13 → 약 46px)
  sprites.scaleFor = (img, r) => {
    const h = bodyH(img);
    return h > 0 ? Math.max(1.1, Math.min(3.4, (r * 3.5) / h)) : SCALE_DEFAULT;
  };
  const SCALE_DEFAULT = 2;

  sprites.rim = rimOf;
  sprites.RIM_DIRS = RIM_DIRS;


  // ══════════════════════════════════════════════════════════════════════
  //  로스터 재조립 (v200) — 사장: "모든 플레이어 몬스터를 시제품처럼 다시 만들어"
  //  부품 공방으로 다시 조립한 몬스터. 종전 20×19 손그림을 32~34px 조립품으로 교체.
  //  화면 크기는 ds 로 유지한다 (디테일만 오르고 덩치는 그대로).
  //  ★ 각 마리의 정체성은 **실루엣**으로 준다 — 색만 다르면 같은 놈으로 보인다.
  //  ★ 자세(프레임) 생성보다 **앞에** 둔다. 뒤에 두면 옛 그림으로 프레임이 만들어진다.
  // ══════════════════════════════════════════════════════════════════════

  // 백골 방패병 — 큰 방패가 실루엣의 전부. 왼쪽을 통째로 가린다
  sprites.shieldSkeleton = mob(34, 36, (g) => {
    P.skull(g, 17, 8, 1);
    P.ribcage(g, 17, 19, 1, 4);
    P.pelvis(g, 17, 25);
    P.legs(g, 17, 27, 1, 6);
    P.arms(g, 17, 16);
    P.shield(g, 6, 19, 1.15);
    P.sword(g, 28, 18, 1, 8);
  }, { K: '#b8c0d0', S: '#7a8296', s: '#454b5e', C: '#e43b44' });

  // 궁수 백골 — 활을 든 자세. 세로로 길쭉하다
  sprites.sniper = mob(36, 38, (g) => {
    P.skull(g, 13, 8, 1);
    P.ribcage(g, 13, 20, 1, 4);
    P.pelvis(g, 13, 26);
    P.legs(g, 13, 28, 1, 6);
    P.arms(g, 13, 17, 1, { raise: 3 });
    P.bow(g, 26, 18, 1);                            // 몸 앞으로 — 활이 실루엣의 절반을 차지한다
  }, { r: '#ffd866', G: '#a07c46', g: '#6b5330' });

  // 시체 파먹는 것 — 등이 굽고 팔이 길다. 백골과 실루엣이 갈린다
  sprites.ghoul = mob(36, 34, (g) => {
    // 굽은 등 — 머리가 어깨보다 앞으로 나온다. 이게 구울의 실루엣이다
    P.shade(g, 18, 20, 8, 7, 'F', 'f', 'p');                 // 부푼 몸통
    for (const y of [16, 19, 22]) {                           // 찢긴 살 사이로 드러난 갈비뼈
      P.span(g, y, 13, 23, 'd'); P.put(g, 13, y, 'B');
    }
    P.head(g, 11, 10, 0.95, { eye: 'r' });
    P.span(g, 13, 8, 14, 'p'); P.span(g, 14, 9, 15, 'f');      // 목 — 앞으로 뻗음
    P.span(g, 12, 8, 14, 'B'); P.put(g, 9, 12, 'B'); P.put(g, 13, 12, 'B');  // 이빨
    for (let k = 0; k < 11; k++) {                            // 왼팔 — 길게 늘어져 땅에 닿는다
      P.put(g, 6 - k * 0.25, 15 + k, 'f'); P.put(g, 5 - k * 0.25, 16 + k, 'p');
    }
    for (const dx of [0, 2, 4]) { P.put(g, 1 + dx, 27, 'B'); P.put(g, 1 + dx, 28, 'd'); }  // 발톱
    for (let k = 0; k < 9; k++) { P.put(g, 27 + k * 0.2, 16 + k, 'f'); P.put(g, 28 + k * 0.2, 17 + k, 'p'); }
    for (const dx of [0, 2, 4]) { P.put(g, 26 + dx, 26, 'B'); P.put(g, 26 + dx, 27, 'd'); }
    P.legs(g, 18, 27, 1, 4, { hi: 'f', lo: 'p' });
  }, { F: '#8fa86a', f: '#6b8250', p: '#3e4d34', r: '#ffd866', B: '#efe6cc', d: '#a89e80' });

  // 돌 골렘 — 각지고 넓다. 유일하게 네모난 실루엣
  sprites.golem = mob(36, 36, (g) => {
    // 첫 조립은 완벽한 직사각형이라 '세탁기'로 보였다. 돌은 모서리가 깨져 있어야 한다
    const block = (x0, y0, w, h) => {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        const ex = Math.min(x - x0, x0 + w - 1 - x), ey = Math.min(y - y0, y0 + h - 1 - y);
        if (ex + ey === 0 && ((x * 7 + y * 13) % 3)) continue;        // 모서리 깨짐
        const lit = (x === x0 || y === y0), dark = (x === x0 + w - 1 || y === y0 + h - 1);
        P.put(g, x, y, lit ? 'K' : dark ? 's' : ((x * 5 + y * 11) % 7 ? 'S' : 'K'));
      }
    };
    block(10, 3, 16, 10);                                      // 머리
    P.rect(g, 12, 6, 4, 3, 'C'); P.rect(g, 20, 6, 4, 3, 'C');  // 발광 눈
    P.span(g, 11, 13, 22, 's'); P.span(g, 12, 15, 20, 's');    // 입 틈
    block(7, 14, 22, 13);                                      // 몸통
    for (const y of [18, 22]) P.span(g, y, 9, 26, 's');         // 돌 이음매
    for (let k = 0; k < 5; k++) P.put(g, 14 + k, 19 + (k % 2), 'C');  // 가슴 룬
    block(1, 15, 6, 13); block(29, 15, 6, 13);                  // 팔
    block(10, 28, 7, 7); block(20, 28, 7, 7);                   // 다리
    for (let k = 0; k < 9; k++) P.put(g, 24 - k * 0.4, 15 + k, 's');  // 균열
  }, { K: '#8a94b0', S: '#5e6880', s: '#333b52', C: '#6fe8ff' });

  // 간수 — 두건 + 곤봉 + 열쇠 꾸러미
  sprites.jailer = mob(34, 38, (g) => {
    P.cloak(g, 16, 18, 1, 15, { hi: 'A', mid: 'a', lo: 'n' });
    P.torso(g, 16, 20, 1);
    P.legs(g, 16, 30, 1, 5, { hi: 'a', lo: 'n', boot: true });
    P.head(g, 16, 9, 1, { hood: true, eye: 'r' });
    P.ell(g, 16, 10, 4, 3, 'n');                              // 두건 그늘
    P.put(g, 14, 10, 'r'); P.put(g, 18, 10, 'r');
    P.span(g, 13, 14, 18, 'p');                               // 턱
    for (let y = 16; y <= 23; y++) { P.rect(g, 6, y, 3, 1, 'f'); P.put(g, 5, y, 'p'); }   // 두꺼운 팔
    for (let y = 16; y <= 21; y++) { P.rect(g, 24, y, 3, 1, 'f'); P.put(g, 27, y, 'p'); }
    for (let k = 0; k < 8; k++) P.span(g, 22 + k, 24, 26, k % 3 === 2 ? 'G' : 'g');       // 곤봉 자루
    P.shade(g, 25, 30, 4, 3.5, 'S', 's', 's');                                            // 혹 달린 머리
    for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) P.put(g, 25 + dx, 30 + dy, 'K');
    for (const [kx, ky] of [[3, 26], [5, 28], [2, 29]]) {      // 열쇠 꾸러미
      P.put(g, kx, ky, 'G'); P.put(g, kx, ky + 1, 'G'); P.put(g, kx + 1, ky + 1, 'G');
    }
  }, { A: '#5c4a3a', a: '#3e3227', n: '#241c16', r: '#ffd866', S: '#7a8296', s: '#454b5e', K: '#b8c0d0' });

  // 잔불 — 떠다닌다. 다리가 없어 지상 몹과 한눈에 갈린다
  sprites.cinder = mob(26, 26, (g) => {
    P.shade(g, 13, 14, 7, 7, 'C', 'c', 'r');
    P.ell(g, 13, 13, 4, 4, 'C');
    for (let k = 0; k < 7; k++) {
      const x = 8 + k * 1.6, y = 5 - Math.abs(k - 3) * 0.9;
      P.put(g, x, y + 1, 'C'); P.put(g, x, y + 2, 'c');
    }
    P.put(g, 10, 13, 'e'); P.put(g, 16, 13, 'e');
  }, { C: '#ffd866', c: '#ff7043', r: '#8a2a10' });

  // 광신도 — 두건 깊고 지팡이. 사람인데 얼굴이 없다
  sprites.acolyte = mob(32, 36, (g) => {
    P.cloak(g, 15, 14, 1, 18);
    P.head(g, 15, 9, 1, { hood: true, eye: 'C' });
    P.ell(g, 15, 10, 4, 3.4, 'n');
    P.put(g, 13, 10, 'C'); P.put(g, 17, 10, 'C');
    P.staff(g, 27, 30, 1, 20);
  }, { A: '#4a3a5c', a: '#332844', n: '#1e182b', C: '#b13ae0', c: '#7a1ea8' });

  // 그림자 — 하반신이 흩어진다. 서 있는 것들과 완전히 다른 실루엣
  sprites.shade = mob(30, 32, (g) => {
    P.shade(g, 15, 10, 6.5, 6, 'A', 'a', 'n');
    P.put(g, 12, 10, 'C'); P.put(g, 18, 10, 'C');
    for (let y = 16; y < 30; y++) {
      const w = Math.round(6 - (y - 16) * 0.15);
      for (let x = 15 - w; x <= 15 + w; x++)
        if ((x * 7 + y * 13) % (y > 24 ? 3 : 9) !== 0) P.put(g, x, y, x < 15 ? 'a' : 'n');
    }
  }, { A: '#6a5a8c', a: '#3e3358', n: '#211a33', C: '#8ad8ff' });


  // ── 2차 배치 (v200) — 점액·비행·짐승·식물·구체 계열 ──
  sprites.slime = mob(30, 28, (g) => P.blob(g, 15, 15, 1.1),
    { C: '#8ad8ff', c: '#3fa9d8', n: '#1d5a7a' });
  sprites.toxicSlime = mob(30, 28, (g) => P.blob(g, 15, 15, 1.1),
    { C: '#b6f06a', c: '#6ab04c', n: '#2e5c26' });
  sprites.iceSlime = mob(30, 28, (g) => { P.blob(g, 15, 15, 1.1);
    for (const [x, y] of [[9, 8], [20, 10], [15, 6]]) { P.put(g, x, y, 'B'); P.put(g, x, y + 1, 'C'); } },
    { C: '#d8f4ff', c: '#7ec8e8', n: '#3a6f8a', B: '#ffffff' });
  sprites.magmaSlime = mob(30, 28, (g) => { P.blob(g, 15, 15, 1.1);
    for (let k = 0; k < 6; k++) P.put(g, 8 + k * 2.4, 6 + (k % 2), 'B'); },
    { C: '#ffd866', c: '#e25822', n: '#7a1010', B: '#fff4c8' });
  sprites.acidSlug = mob(34, 28, (g) => { P.blob(g, 17, 16, 1.25);
    for (let k = 0; k < 7; k++) P.put(g, 6 + k * 3.2, 25, 'n'); },   // 지나온 점액 자국
    { C: '#c8f078', c: '#7ab04c', n: '#3a5c22' });
  sprites.acidSnail = mob(34, 30, (g) => {
    P.blob(g, 13, 18, 0.95);
    P.shade(g, 23, 14, 8, 8, 'G', 'g', 'h');                          // 껍데기
    for (let a = 0; a < 9; a += 0.35) { const rr = 1.4 + a * 0.75;
      P.put(g, 23 + Math.cos(a) * rr, 14 + Math.sin(a) * rr, 'h'); }
    P.put(g, 9, 11, 'C'); P.put(g, 9, 9, 'c'); P.put(g, 12, 11, 'C'); P.put(g, 12, 9, 'c');  // 더듬이
  }, { C: '#c8f078', c: '#7ab04c', n: '#3a5c22', G: '#c9a24a', g: '#8a6b3c', h: '#4a3620' });

  sprites.bat = mob(34, 22, (g) => P.flyer(g, 17, 11, 1),
    { A: '#6a5a7c', a: '#453a58', n: '#241c33', r: '#e43b44' });
  sprites.bloodBat = mob(34, 22, (g) => { P.flyer(g, 17, 11, 1);
    P.put(g, 15, 14, 'r'); P.put(g, 19, 14, 'r'); },                  // 피 묻은 송곳니
    { A: '#8a3a4a', a: '#5c2230', n: '#2e0f18', r: '#ff5c6c' });
  sprites.emberMoth = mob(34, 24, (g) => { P.flyer(g, 17, 12, 1, { ear: false });
    for (let k = 0; k < 5; k++) P.put(g, 10 + k * 3.4, 3 + (k % 2) * 2, 'C'); },  // 흩날리는 불티
    { A: '#ffb45c', a: '#d4691e', n: '#6a2a08', r: '#fff4c8', C: '#ffd866' });
  sprites.wisp = mob(24, 24, (g) => { P.shade(g, 12, 12, 6, 6, 'C', 'c', 'n');
    P.ell(g, 12, 11, 3, 3, 'B');
    for (let k = 0; k < 8; k++) { const a = k * 0.79;
      P.put(g, 12 + Math.cos(a) * 9, 12 + Math.sin(a) * 9, k % 2 ? 'c' : 'C'); } },
    { C: '#8ad8ff', c: '#4a9ad0', n: '#1d4a6a', B: '#ffffff' });
  sprites.fireSpirit = mob(28, 32, (g) => {
    // 1차는 좌우 대칭 테이퍼라 '고깔'이 됐다. 불은 대칭이 아니다 —
    // 중심축이 위로 갈수록 한쪽으로 휘고, 윤곽이 매 줄 들쭉날쭉해야 불로 읽힌다
    for (let y = 0; y < 28; y++) {
      const t = y / 27;
      const cx = 14 + Math.sin(t * 2.6) * 3.2 * (1 - t);        // 휘어 오르는 축
      const w = (0.8 + (1 - t) ** 0.6 * 0) + t * 6.4;
      const jag = Math.sin(y * 1.9) * 0.9 + Math.sin(y * 0.7) * 0.6;
      const wl = Math.round(w + jag), wr = Math.round(w - jag * 0.6);
      const yy = 3 + y;
      P.span(g, yy, Math.round(cx - wl), Math.round(cx + wr), t < 0.3 ? 'B' : t < 0.66 ? 'C' : 'c');
      P.put(g, Math.round(cx - wl), yy, 'B');                    // ← 좌측이 밝다
      P.put(g, Math.round(cx + wr), yy, 'n');
      if (t > 0.45 && t < 0.9) P.span(g, yy, Math.round(cx - wl * 0.42), Math.round(cx + wr * 0.42), t < 0.7 ? 'C' : 'B');  // 심지
    }
    for (const [ox, oy, h] of [[-6, 12, 6], [6, 15, 5], [-3, 8, 4]])   // 튀어 오르는 혀
      for (let k = 0; k < h; k++) P.put(g, 14 + ox + (k % 2 ? 0 : 1) - k * 0.2, 3 + oy - k, k < 2 ? 'c' : 'C');
    P.put(g, 11, 21, 'e'); P.put(g, 17, 21, 'e');
  }, { B: '#fff4c8', C: '#ffd866', c: '#ff7043', n: '#8a2a10' });

  sprites.voidSpawn = mob(24, 24, (g) => { P.shade(g, 12, 12, 6.5, 6.5, 'A', 'a', 'n');
    P.ell(g, 12, 12, 3, 3, 'e'); P.put(g, 12, 12, 'C'); },
    { A: '#7a5a9c', a: '#4a2f6a', n: '#1e1030', C: '#e2b6ff' });
  sprites.swarm = mob(24, 20, (g) => {
    for (let k = 0; k < 9; k++) { const x = 4 + (k * 5) % 17, y = 4 + ((k * 7) % 13);
      P.shade(g, x, y, 2, 1.6, 'A', 'a', 'n'); P.put(g, x, y, 'r'); } },
    { A: '#8a7a5c', a: '#5c4c34', n: '#2e2418', r: '#ffd866' });

  sprites.spider = mob(34, 30, (g) => P.crawler(g, 17, 15, 1.1),
    { A: '#5a3a6c', a: '#3a1f4a', n: '#1c0d28', r: '#e43b44' });
  sprites.leech = mob(30, 22, (g) => { P.blob(g, 15, 12, 0.9);
    for (let k = 0; k < 5; k++) P.span(g, 8 + k * 2, 9, 21, k % 2 ? 'n' : 'c'); },  // 마디
    { C: '#c86a7a', c: '#8a3a4a', n: '#4a1620' });
  sprites.frog = mob(36, 28, (g) => {
    P.shade(g, 18, 17, 10, 6, 'C', 'c', 'n');                    // 납작하고 넓은 몸
    for (const sgn of [-1, 1]) {                                  // 접힌 뒷다리 — 개구리의 정체성
      P.shade(g, 18 + sgn * 9, 16, 4, 5, 'C', 'c', 'n');
      P.span(g, 22, 18 + sgn * 7, 18 + sgn * 13, 'c');
      P.span(g, 23, 18 + sgn * 9, 18 + sgn * 15, 'n');
      for (let k = 0; k < 3; k++) P.put(g, 18 + sgn * (13 + k), 23, 'C');   // 물갈퀴
    }
    P.span(g, 13, 12, 24, 'n'); P.span(g, 12, 13, 23, 'B');       // 넓은 입
    for (const sgn of [-1, 1]) {                                  // 툭 튀어나온 눈
      P.shade(g, 18 + sgn * 5, 8, 3.2, 3, 'B', 'C', 'c');
      P.ell(g, 18 + sgn * 5, 8, 1.4, 1.6, 'e');
      P.put(g, 18 + sgn * 5 - 1, 7, 'B');
    }
  }, { C: '#8fd86a', c: '#4c8a3a', n: '#24471c', B: '#e8f4c8' });

  sprites.boar = mob(38, 28, (g) => { P.beast(g, 19, 14, 1.05, { hi: 'F', mid: 'f', lo: 'p' });
    P.snout(g, 28, 12, 1, { hi: 'F', mid: 'f', lo: 'p', tusk: true });
    for (let k = 0; k < 7; k++) P.put(g, 12 + k * 2, 7 - (k % 2), 'p'); },   // 등털
    { F: '#7a5c46', f: '#54402f', p: '#2e231a', B: '#efe6cc', r: '#e43b44' });
  sprites.lavaHound = mob(38, 28, (g) => { P.beast(g, 19, 14, 1.05, { hi: 'C', mid: 'c', lo: 'n' });
    P.snout(g, 28, 12, 1, { hi: 'C', mid: 'c', lo: 'n' });
    for (let k = 0; k < 6; k++) P.put(g, 11 + k * 2.2, 6 - (k % 2) * 2, 'B'); },
    { C: '#ff9a3c', c: '#c0392b', n: '#5a1008', B: '#ffd866', r: '#fff4c8' });
  sprites.charger = mob(38, 30, (g) => { P.beast(g, 19, 15, 1.1, { hi: 'A', mid: 'a', lo: 'n' });
    P.snout(g, 29, 13, 1, { hi: 'A', mid: 'a', lo: 'n', tusk: true });
    for (let k = 0; k < 5; k++) P.put(g, 25 - k, 6 - k * 0.8, 'B'); },        // 뿔
    { A: '#6a6480', a: '#43405a', n: '#221f33', B: '#efe6cc', r: '#e43b44' });

  sprites.mushroom = mob(34, 30, (g) => {
    for (let y = 0; y < 10; y++) { P.span(g, 17 + y, 13, 20, 'm'); P.put(g, 13, 17 + y, 'B'); P.put(g, 20, 17 + y, 'n'); }
    P.span(g, 27, 10, 23, 'n');                                   // 밑동
    for (let y = 0; y < 11; y++) {                                // 갓 — 넓고 낮은 돔
      const t = y / 10;
      const w = Math.round(Math.sqrt(Math.max(0, 1 - t * t)) * 15);
      P.span(g, 16 - y, 17 - w, 17 + w, y < 3 ? 'n' : 'c');
      P.put(g, 17 - w, 16 - y, 'C');
    }
    P.span(g, 17, 3, 31, 'n'); P.span(g, 16, 4, 30, 'c');         // 갓 아래 주름
    for (const [x, y, r] of [[9, 10, 2], [22, 8, 2], [16, 6, 1], [26, 12, 1]])   // 반점
      P.ell(g, x, y, r, r * 0.8, 'C');
    P.put(g, 14, 21, 'e'); P.put(g, 19, 21, 'e');
  }, { C: '#e8d8ff', c: '#8a5ac2', n: '#4a2a7a', m: '#d9cbb8', B: '#f4eeda' });

  sprites.thornPlant = mob(34, 32, (g) => {
    P.span(g, 30, 6, 27, 'n'); P.span(g, 29, 8, 25, 'm');         // 뿌리가 흙을 밀어올린 자리
    for (let y = 0; y < 9; y++) { const w = Math.round(3 + y * 0.5);
      P.span(g, 28 - y, 17 - w, 17 + w, 'm'); P.put(g, 17 - w, 28 - y, 'C'); }   // 굵고 짧은 줄기
    for (let y = 0; y < 13; y++) {                                 // 벌린 아가리 — 위가 넓다
      const t = y / 12, w = Math.round(3 + t * 9);
      P.span(g, 19 - y, 17 - w, 17 + w, t > 0.55 ? 'c' : 'C');
      P.put(g, 17 - w, 19 - y, 'C'); P.put(g, 17 + w, 19 - y, 'n');
    }
    P.span(g, 8, 6, 28, 'n');                                      // 목구멍
    for (let k = 0; k < 7; k++) {                                  // 이빨
      const x = 6 + k * 3.7;
      P.put(g, x, 8, 'B'); P.put(g, x, 9, 'B'); P.put(g, x, 10, 'm');
    }
    for (const [x, y, dx, dy] of [[4, 20, -1, -1], [30, 20, 1, -1], [6, 26, -1, 1], [28, 26, 1, 1]])
      for (let k = 0; k < 4; k++) P.put(g, x + dx * k, y + dy * k, k < 2 ? 'c' : 'B');   // 사방 가시
  }, { C: '#a8e06a', c: '#4c8a3a', n: '#22421a', m: '#6b5330', B: '#efe6cc' });

  sprites.sporePuff = mob(28, 26, (g) => { P.shade(g, 14, 15, 7, 6, 'C', 'c', 'n');
    for (let k = 0; k < 7; k++) P.put(g, 6 + k * 2.4, 4 + ((k * 5) % 4), 'C');
    P.put(g, 11, 15, 'e'); P.put(g, 17, 15, 'e'); },
    { C: '#c8f078', c: '#7ab04c', n: '#3a5c22' });
  sprites.sporeling = mob(24, 22, (g) => { P.shade(g, 12, 13, 5.5, 5, 'C', 'c', 'n');
    P.put(g, 10, 13, 'e'); P.put(g, 14, 13, 'e');
    for (let k = 0; k < 4; k++) P.put(g, 8 + k * 2.4, 5, 'C'); },
    { C: '#c8f078', c: '#7ab04c', n: '#3a5c22' });

  sprites.voidEye = mob(30, 32, (g) => P.orb(g, 15, 14, 1.05),
    { C: '#b16aff', c: '#6a2f9c', n: '#2a1046', r: '#ffd866' });
  sprites.gazer = mob(32, 34, (g) => P.orb(g, 16, 15, 1.15),
    { C: '#8ad8ff', c: '#3a7ab0', n: '#12314a', r: '#e43b44' });
  sprites.crystal = mob(26, 30, (g) => {
    for (let y = 0; y < 22; y++) { const w = Math.round(6 - Math.abs(y - 9) * 0.42);
      P.span(g, 4 + y, 13 - w, 13 + w, y < 9 ? 'C' : 'c');
      P.put(g, 13 - w, 4 + y, 'B'); P.put(g, 13 + w, 4 + y, 'n'); }
    P.span(g, 27, 8, 18, 'n');
  }, { C: '#8ad8ff', c: '#3a7ab0', n: '#12314a', B: '#ffffff' });


  // ── 3차 배치 (v200) — 인간형 정예·시전자·기계 계열 ──
  // 인간형이 몰려 있어 실루엣이 겹치기 쉽다. 각자 **한 가지 과장**을 준다:
  // 광전사=어깨, 거구=팔뚝, 처형인=도끼+두건, 간수장=사슬, 주술사=가면, 서리술사=고드름
  sprites.archer = mob(34, 38, (g) => {
    P.head(g, 13, 9, 1, { eye: 'r' });
    P.torso(g, 13, 20, 1, { hi: 'A', mid: 'a', lo: 'n' });
    P.legs(g, 13, 28, 1, 6, { hi: 'a', lo: 'n', boot: true });
    P.arms(g, 13, 17, 1, { hi: 'f', lo: 'p', raise: 3 });
    P.bow(g, 26, 18, 1);
    for (let k = 0; k < 4; k++) P.put(g, 6 + k, 12 - k, 'g');        // 등에 멘 화살통
    P.rect(g, 4, 12, 4, 9, 'h');
  }, { A: '#3e5c3a', a: '#2a4028', n: '#16260f', r: '#e43b44' });

  sprites.necro = mob(34, 38, (g) => {
    P.cloak(g, 16, 14, 1, 20, { hi: 'A', mid: 'a', lo: 'n' });
    P.skull(g, 16, 9, 0.95, { jaw: false });
    P.staff(g, 28, 32, 1, 22);
    for (let k = 0; k < 3; k++) P.put(g, 6 + k * 2, 20 + k, 'C');    // 떠도는 혼불
  }, { A: '#3a6a4c', a: '#24422e', n: '#0f2418', C: '#38b764', c: '#1e7a3c', r: '#38b764' });

  sprites.shaman = mob(34, 38, (g) => {
    P.cloak(g, 16, 15, 1, 19, { hi: 'A', mid: 'a', lo: 'n' });
    P.head(g, 16, 9, 1, { eye: 'C' });
    P.shade(g, 16, 9, 5.5, 5, 'G', 'g', 'h');                        // 나무 가면
    P.span(g, 8, 12, 20, 'h'); P.put(g, 13, 9, 'C'); P.put(g, 19, 9, 'C');
    for (let k = 0; k < 5; k++) P.put(g, 10 + k * 3, 2 + (k % 2) * 2, 'B');  // 깃털 장식
    P.staff(g, 28, 32, 1, 20);
  }, { A: '#6a4a3a', a: '#472f24', n: '#241614', G: '#c9a24a', g: '#8a6b3c', h: '#4a3620', C: '#ffd866', c: '#d4691e' });

  sprites.frostMage = mob(34, 38, (g) => {
    P.cloak(g, 16, 15, 1, 19, { hi: 'A', mid: 'a', lo: 'n' });
    P.head(g, 16, 9, 1, { hood: true, eye: 'C' });
    P.staff(g, 28, 32, 1, 20);
    for (const [x, y, h] of [[7, 20, 5], [10, 24, 4], [4, 26, 3]])   // 매달린 고드름
      for (let k = 0; k < h; k++) P.put(g, x, y + k, k === h - 1 ? 'B' : 'C');
  }, { A: '#6a8ca8', a: '#3f5c78', n: '#1c2e44', C: '#b6e8ff', c: '#5aa8d8', B: '#ffffff' });

  sprites.berserker = mob(38, 40, (g) => {
    // 1차는 어깨를 타원으로 부풀려 '덩어리'가 됐다. 과장은 **어깨 너비**로 주되
    // 허리를 좁혀 역삼각 실루엣을 만든다. 그래야 근육질로 읽힌다
    P.legs(g, 19, 30, 1, 6, { hi: 'a', lo: 'n', boot: true });
    for (let y = 0; y < 14; y++) { const w = Math.round(10 - y * 0.42);
      P.span(g, 16 + y, 19 - w, 19 + w, 'f');
      P.put(g, 19 - w, 16 + y, 'F'); P.put(g, 19 + w, 16 + y, 'p'); }
    P.limb(g, 8, 18, 1, { dx: -0.4, len: 4, thick: 4 });
    P.limb(g, 28, 17, 1, { dx: 0.3, len: 4, thick: 4 });
    P.head(g, 19, 9, 1, { eye: 'r' });
    for (let k = 0; k < 7; k++) P.put(g, 14 + k * 1.7, 3 - (k % 3), 'h');
    P.axe(g, 28, 34, 1);   // 날이 오른쪽으로 8px 뻗으므로 자루를 안쪽에 둔다
    for (const [x, y] of [[15, 20], [22, 24], [18, 27]]) { P.put(g, x, y, 'r'); P.put(g, x + 1, y + 1, 'r'); }
  }, { F: '#d8a074', f: '#a8724c', p: '#6a4028', A: '#6a3a3a', a: '#472424', n: '#241212', r: '#e43b44', h: '#4a2a1a' });

  sprites.brute = mob(42, 42, (g) => {
    // 덩치는 **가로 폭**과 짧은 다리로 준다. 몸통을 타원으로 부풀리면 감자가 된다
    P.legs(g, 21, 33, 1.2, 5, { hi: 'f', lo: 'p', boot: true });
    for (let y = 0; y < 17; y++) { const w = Math.round(12 - y * 0.28);
      P.span(g, 16 + y, 21 - w, 21 + w, 'f');
      P.put(g, 21 - w, 16 + y, 'F'); P.put(g, 21 - w + 1, 16 + y, 'F'); P.put(g, 21 + w, 16 + y, 'p'); }
    P.span(g, 30, 10, 32, 'h'); P.put(g, 21, 30, 'G');
    P.limb(g, 6, 19, 1, { dx: -0.3, len: 5, thick: 5 });
    P.limb(g, 36, 18, 1, { dx: 0.3, len: 5, thick: 5 });
    P.head(g, 21, 9, 1.05, { eye: 'r' });
    P.span(g, 12, 16, 26, 'p');
    for (let k = 0; k < 4; k++) P.put(g, 17 + k * 2.6, 12, 'B');
  }, { F: '#c08a5c', f: '#8f6038', p: '#54371f', r: '#e43b44', h: '#3a2a18', G: '#c9a24a', B: '#f4eeda' });

  sprites.warden = mob(38, 42, (g) => {
    P.cloak(g, 18, 18, 1, 20, { hi: 'A', mid: 'a', lo: 'n' });
    P.head(g, 18, 10, 1, { helm: true, eye: 'r' });
    P.torso(g, 18, 22, 1);
    P.arms(g, 18, 19, 1, { hi: 'S', lo: 's' });
    for (let k = 0; k < 8; k++) {                                      // 늘어뜨린 사슬
      const x = 6 + k * 0.3, y = 22 + k * 2;
      P.put(g, x, y, 'K'); P.put(g, x + 1, y + 1, 'S');
    }
    P.spear(g, 31, 36, 1, 24);
  }, { A: '#4a4458', a: '#302b3e', n: '#171422', S: '#8a94b0', s: '#4a5266', K: '#d8e0f0', r: '#e43b44' });

  sprites.executioner = mob(42, 44, (g) => {
    P.legs(g, 20, 34, 1, 6, { hi: 'a', lo: 'n', boot: true });
    P.cloak(g, 20, 17, 1.05, 17);
    P.limb(g, 8, 20, 1, { dx: -0.2, len: 5, thick: 4 });
    P.head(g, 20, 10, 1.05, { hood: true, eye: 'r' });
    P.span(g, 11, 15, 25, 'n'); P.span(g, 12, 15, 25, 'n');
    P.put(g, 17, 11, 'r'); P.put(g, 23, 11, 'r');
    P.axe(g, 31, 38, 1.15);
    P.limb(g, 29, 19, 1, { dx: 0.1, len: 5, thick: 4 });
  }, { A: '#3a2c34', a: '#241a20', n: '#120b10', F: '#c08a5c', f: '#8f6038', p: '#54371f', r: '#e43b44' });

  sprites.stalker = mob(34, 38, (g) => {
    P.cloak(g, 16, 16, 1, 18, { hi: 'A', mid: 'a', lo: 'n' });
    P.head(g, 16, 9, 0.95, { hood: true, eye: 'C' });
    P.span(g, 10, 12, 20, 'n');
    P.put(g, 14, 10, 'C'); P.put(g, 18, 10, 'C');
    for (let k = 0; k < 7; k++) { P.put(g, 27 + k * 0.3, 16 + k, 'K'); P.put(g, 28 + k * 0.3, 17 + k, 's'); }  // 단검
    P.grip(g, 27, 15);
  }, { A: '#2e3a4a', a: '#1c2430', n: '#0d1219', C: '#8ad8ff', K: '#d8e0f0', s: '#4a5266' });

  sprites.mirrorKnight = mob(38, 40, (g) => {
    P.head(g, 18, 10, 1, { helm: true, eye: 'C' });
    P.torso(g, 18, 22, 1, { hi: 'K', mid: 'S', lo: 's' });
    P.legs(g, 18, 30, 1, 6, { hi: 'S', lo: 's', boot: true });
    P.arms(g, 18, 19, 1, { hi: 'S', lo: 's' });
    P.sword(g, 30, 26, 1, 13);
    for (let y = 17; y < 28; y++) P.put(g, 14 + (y % 3), y, 'K');      // 거울면 반사
  }, { K: '#e6ecff', S: '#9aa2b8', s: '#4a5266', C: '#8ad8ff' });

  sprites.chainWraith = mob(36, 38, (g) => {
    P.shade(g, 18, 11, 6.5, 6, 'A', 'a', 'n');
    P.put(g, 15, 11, 'C'); P.put(g, 21, 11, 'C');
    for (let y = 17; y < 34; y++) {                                    // 흩어지는 하반신
      const w = Math.round(6 - (y - 17) * 0.12);
      for (let x = 18 - w; x <= 18 + w; x++)
        if ((x * 7 + y * 13) % (y > 28 ? 3 : 9) !== 0) P.put(g, x, y, x < 18 ? 'a' : 'n');
    }
    for (let k = 0; k < 9; k++) { const a = k * 0.7;                   // 감긴 사슬
      P.put(g, 18 + Math.cos(a) * (8 + k * 0.4), 18 + k * 1.6, 'K');
      P.put(g, 18 + Math.cos(a) * (8 + k * 0.4) + 1, 19 + k * 1.6, 'S'); }
  }, { A: '#7a6a9c', a: '#463a68', n: '#221a38', C: '#e2b6ff', K: '#c8d0e0', S: '#7a8296' });

  sprites.flameJuggler = mob(36, 40, (g) => {
    P.head(g, 17, 10, 1, { eye: 'r' });
    P.torso(g, 17, 22, 1, { hi: 'A', mid: 'a', lo: 'n' });
    P.legs(g, 17, 30, 1, 6, { hi: 'a', lo: 'n', boot: true });
    P.arms(g, 17, 19, 1, { hi: 'f', lo: 'p', raise: 4 });
    for (const [x, y] of [[6, 8], [28, 6], [30, 18]]) {                // 공중의 불덩이
      P.shade(g, x, y, 3.2, 3.2, 'B', 'C', 'c');
      P.put(g, x, y - 4, 'C');
    }
  }, { A: '#8a3a2a', a: '#5c2418', n: '#2e0f08', B: '#fff4c8', C: '#ffd866', c: '#ff7043', r: '#ffd866' });

  sprites.riftCaster = mob(36, 40, (g) => {
    P.cloak(g, 17, 16, 1, 20, { hi: 'A', mid: 'a', lo: 'n' });
    P.head(g, 17, 9, 1, { hood: true, eye: 'C' });
    for (let a = 0; a < 6.3; a += 0.22) {                              // 열린 균열 고리
      const rr = 8 + Math.sin(a * 3) * 1.5;
      P.put(g, 28 + Math.cos(a) * rr * 0.55, 14 + Math.sin(a) * rr, a % 1.2 < 0.6 ? 'C' : 'c');
    }
  }, { A: '#4a3a6c', a: '#2e2444', n: '#150f24', C: '#e2b6ff', c: '#b13ae0' });

  sprites.turret = mob(32, 32, (g) => {
    P.span(g, 30, 4, 27, 'n'); P.span(g, 29, 6, 25, 's');              // 받침
    P.shade(g, 16, 20, 9, 7, 'K', 'S', 's');                           // 포탑 몸체
    P.rect(g, 13, 17, 6, 4, 'C');
    for (let k = 0; k < 9; k++) P.span(g, 8 + k, 14, 18, k < 3 ? 'K' : 'S');   // 총열
    P.span(g, 6, 13, 19, 's');
  }, { K: '#8a94b0', S: '#5e6880', s: '#333b52', n: '#1a1e2c', C: '#e43b44' });

  sprites.mimic = mob(36, 32, (g) => {
    P.rect(g, 4, 14, 28, 15, 'g'); P.rect(g, 4, 14, 1, 15, 'G');       // 궤짝 몸
    P.span(g, 28, 4, 31, 'h');
    for (const y of [17, 22, 26]) P.span(g, y, 4, 31, 'h');
    for (let y = 0; y < 8; y++) { const w = Math.round(14 - y * 0.4);  // 열린 뚜껑
      P.span(g, 12 - y, 18 - w, 18 + w, y < 2 ? 'G' : 'g'); }
    P.span(g, 13, 5, 31, 'n');
    for (let k = 0; k < 8; k++) { const x = 5 + k * 3.6;               // 이빨
      P.put(g, x, 13, 'B'); P.put(g, x, 14, 'B'); P.put(g, x, 12, 'B'); }
    P.put(g, 12, 19, 'r'); P.put(g, 24, 19, 'r');
  }, { G: '#c9a24a', g: '#8a6b3c', h: '#4a3620', n: '#1a0f08', B: '#f4eeda', r: '#e43b44' });

  sprites.bomber = mob(30, 28, (g) => {
    P.shade(g, 15, 16, 8, 7, 'C', 'c', 'n');                           // 부푼 몸
    for (let k = 0; k < 5; k++) P.put(g, 15 + (k % 2 ? 1 : -1) * (k * 0.6), 6 - k, k < 2 ? 'B' : 'C');  // 심지
    P.put(g, 12, 15, 'e'); P.put(g, 18, 15, 'e');
    for (const [x, y] of [[9, 20], [21, 21], [15, 23]]) P.ell(g, x, y, 2, 1.6, 'n');   // 부글거리는 반점
  }, { C: '#ff9a3c', c: '#c0392b', n: '#5a1008', B: '#fff4c8' });

  sprites.imp = mob(36, 32, (g) => {
    // 1차는 팔다리가 1px이라 '개미'로 보였다. 날개를 몸보다 크게 **먼저** 그리고
    // 웅크린 자세(짧은 다리·앞으로 굽은 등)로 작은 악마의 실루엣을 만든다
    for (const sgn of [-1, 1]) for (let k = 1; k <= 11; k++) {
      const x = Math.round(18 + sgn * (5 + k));
      const top = Math.round(6 + k * 0.55), bot = Math.round(20 - k * 0.5 + (k % 3 === 0 ? 1 : 0));
      for (let y = top; y <= bot; y++) P.put(g, x, y, sgn < 0 ? (y < 13 ? 'A' : 'a') : (y < 13 ? 'a' : 'n'));
      P.put(g, x, top, 'A');
    }
    P.shade(g, 18, 19, 6, 5.5, 'F', 'f', 'p');
    P.limb(g, 12, 17, 0.8, { dx: -0.3, len: 2, thick: 3 });
    P.limb(g, 24, 17, 0.8, { dx: 0.3, len: 2, thick: 3 });
    for (const sgn of [-1, 1]) for (let k = 0; k < 4; k++) {
      P.put(g, 18 + sgn * 3, 24 + k, 'f'); P.put(g, 18 + sgn * 4, 24 + k, 'p'); }
    P.span(g, 28, 13, 16, 'f'); P.span(g, 28, 20, 23, 'f');
    P.head(g, 18, 9, 0.95, { eye: 'r' });
    for (const sgn of [-1, 1]) for (let k = 0; k < 5; k++)
      P.put(g, 18 + sgn * (4 + k * 0.5), 4 - k, k < 2 ? 'F' : 'p');
    for (let k = 0; k < 7; k++) P.put(g, 24 + k * 0.9, 22 + k * 0.7, k > 5 ? 'F' : 'p');
  }, { F: '#e0846c', f: '#b04a34', p: '#5c1c10', A: '#8a4432', a: '#552418', n: '#2a1008', r: '#ffd866' });

  sprites.glutton = mob(42, 38, (g) => {
    // 배가 실루엣이지만 타원 하나면 감자가 된다. 아래로 처지는 비대칭 곡선 + 접힌 살
    P.legs(g, 21, 32, 1, 3, { hi: 'f', lo: 'p' });
    for (let y = 0; y < 20; y++) { const t = y / 19;
      const w = Math.round(6 + Math.sin(t * 2.5) * 8);
      P.span(g, 13 + y, 21 - w, 21 + w, 'f');
      P.put(g, 21 - w, 13 + y, 'F'); P.put(g, 21 + w, 13 + y, 'p'); }
    for (const y of [21, 26]) P.span(g, y, 12, 30, 'p');
    P.limb(g, 6, 17, 1, { dx: -0.2, len: 3, thick: 4 });
    P.limb(g, 36, 17, 1, { dx: 0.2, len: 3, thick: 4 });
    P.span(g, 12, 17, 25, 'p'); P.span(g, 11, 18, 24, 'f');     // 목 — 없으면 머리가 배에 묻힌다
    P.head(g, 21, 6, 1, { eye: 'r' });
    P.span(g, 9, 15, 27, 'n');                                    // 벌어진 입
    for (let k = 0; k < 6; k++) { const x = 16 + k * 2.6; P.put(g, x, 9, 'B'); P.put(g, x, 10, 'B'); }
  }, { F: '#c8a06a', f: '#96703f', p: '#563e20', n: '#2a1008', B: '#f4eeda', r: '#e43b44' });


  // ── 4차 배치 (v200) — 잡몹 마무리 8종 ──
  sprites.wraith = mob(34, 38, (g) => {
    P.shade(g, 17, 11, 6.5, 6, 'A', 'a', 'n');
    P.put(g, 14, 11, 'C'); P.put(g, 20, 11, 'C');
    P.span(g, 15, 14, 20, 'n');
    for (let y = 17; y < 36; y++) {                                   // 흩어지는 하반신
      const w = Math.round(7 - (y - 17) * 0.16);
      for (let x = 17 - w; x <= 17 + w; x++)
        if ((x * 7 + y * 13) % (y > 29 ? 3 : 11) !== 0) P.put(g, x, y, x < 17 ? 'a' : 'n');
      if (y % 4 === 0) P.put(g, 17 - w, y, 'A');
    }
    for (let k = 0; k < 6; k++) { P.put(g, 6 + k * 0.4, 16 + k, 'a'); P.put(g, 28 - k * 0.4, 16 + k, 'n'); }  // 늘어진 소매
  }, { A: '#8a7ab0', a: '#4e4070', n: '#241b3a', C: '#8ad8ff' });

  sprites.ashWalker = mob(36, 40, (g) => {
    P.legs(g, 17, 30, 1, 6, { hi: 'a', lo: 'n' });
    for (let y = 0; y < 15; y++) { const w = Math.round(7 - y * 0.1);   // 재로 굳은 몸
      P.span(g, 15 + y, 17 - w, 17 + w, 'a');
      P.put(g, 17 - w, 15 + y, 'A'); P.put(g, 17 + w, 15 + y, 'n'); }
    for (const [x, y] of [[13, 19], [21, 23], [16, 26], [22, 17]])      // 갈라진 틈에서 새는 불
      { P.put(g, x, y, 'C'); P.put(g, x, y + 1, 'c'); P.put(g, x + 1, y, 'c'); }
    P.limb(g, 8, 17, 1, { hi: 'A', mid: 'a', lo: 'n', dx: -0.2, len: 4, thick: 3 });
    P.limb(g, 26, 17, 1, { hi: 'A', mid: 'a', lo: 'n', dx: 0.2, len: 4, thick: 3 });
    P.head(g, 17, 8, 1, { eye: 'C' });
    for (let k = 0; k < 5; k++) P.put(g, 13 + k * 2, 1 + (k % 2), 'c');  // 피어오르는 재
  }, { A: '#7a6e6a', a: '#4a423e', n: '#231e1c', C: '#ff9a3c', c: '#c0392b', F: '#6a5e58', f: '#443c38', p: '#241e1c' });

  sprites.boneHeap = mob(34, 26, (g) => {
    // 뼈 무더기 — 서 있지 않다. 바닥에 쌓인 실루엣이라 다른 몹과 즉시 갈린다
    for (let y = 0; y < 12; y++) { const w = Math.round(4 + y * 1.05);
      P.span(g, 12 + y, 17 - w, 17 + w, y < 3 ? 'b' : 'd');
      P.put(g, 17 - w, 12 + y, 'B'); }
    for (const [x, y, len] of [[6, 16, 7], [22, 14, 6], [10, 21, 8], [20, 20, 5]]) {   // 삐져나온 뼈
      for (let k = 0; k < len; k++) P.put(g, x + k, y - (k % 2) * 0.5, 'b');
      P.put(g, x, y - 1, 'B'); P.put(g, x + len, y - 1, 'B');
    }
    P.skull(g, 12, 9, 0.85, { jaw: false });
    for (let k = 0; k < 4; k++) P.put(g, 24 + k, 11 - (k % 2), 'd');
  }, { B: '#f4eeda', b: '#d8d0b8', d: '#9a917c', e: '#1a1622', r: '#ffd866' });

  sprites.venomLasher = mob(38, 36, (g) => {
    P.blob(g, 15, 22, 1.05);
    for (let k = 0; k < 16; k++) {                                     // 채찍처럼 뻗은 촉수
      const t = k / 15;
      P.put(g, 20 + k * 1.1, 20 - Math.sin(t * 3.1) * 12, t < 0.5 ? 'c' : 'C');
      P.put(g, 20 + k * 1.1, 21 - Math.sin(t * 3.1) * 12, 'n');
    }
    for (let k = 0; k < 3; k++) P.put(g, 35 - k, 6 + k, 'B');           // 독침
  }, { C: '#b6f06a', c: '#6ab04c', n: '#2e5c26', B: '#ffffff' });

  sprites.sporeMother = mob(44, 42, (g) => {
    P.blob(g, 22, 26, 1.6);                                             // 거대한 몸
    for (const [x, y, r] of [[12, 12, 5], [31, 10, 6], [22, 6, 4.5], [6, 20, 3.5], [37, 20, 4]]) {
      P.shade(g, x, y, r, r * 0.8, 'B', 'C', 'c');                      // 등에 돋은 포자낭
      P.put(g, x - 1, y - 1, 'B');
      for (let k = 0; k < 3; k++) P.put(g, x + k - 1, y - r - 1 - k, 'C');
    }
    for (let k = 0; k < 5; k++) P.put(g, 8 + k * 7, 40, 'n');
  }, { C: '#c8f078', c: '#7ab04c', n: '#3a5c22', B: '#f0ffd0' });

  sprites.frostGolem = mob(42, 42, (g) => {
    const block = (x0, y0, w, h) => {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        const ex = Math.min(x - x0, x0 + w - 1 - x), ey = Math.min(y - y0, y0 + h - 1 - y);
        if (ex + ey === 0 && ((x * 7 + y * 13) % 3)) continue;
        const lit = (x === x0 || y === y0), dark = (x === x0 + w - 1 || y === y0 + h - 1);
        P.put(g, x, y, lit ? 'K' : dark ? 's' : ((x * 5 + y * 11) % 6 ? 'S' : 'K'));
      }
    };
    block(12, 4, 16, 10); block(8, 15, 24, 14);
    block(2, 16, 6, 13); block(32, 16, 6, 13);
    block(12, 30, 7, 8); block(22, 30, 7, 8);
    // ★ 눈과 고드름은 **맨 마지막에**. 블록보다 먼저 그리면 덮여 사라진다.
    //   그리고 눈 색이 몸 색과 가까우면 안 보인다 — 한랭 팔레트 안에서 대비를 만든다
    P.rect(g, 14, 7, 4, 3, 'C'); P.rect(g, 22, 7, 4, 3, 'C');
    P.rect(g, 14, 6, 4, 1, 'r'); P.rect(g, 22, 6, 4, 1, 'r');
    for (let k = 0; k < 6; k++) P.put(g, 12 + k * 3, 20 + (k % 2), 'C');   // 가슴 서리결
    for (const [x, y, h] of [[9, 28, 6], [31, 26, 5], [17, 28, 4], [25, 27, 5]])
      for (let k = 0; k < h; k++) P.put(g, x, y + k, k === h - 1 ? 'B' : k > h - 3 ? 'C' : 'K');
  }, { K: '#cfeaff', S: '#5f96bc', s: '#1d3a56', C: '#5ce0ff', B: '#ffffff', r: '#1a4a6a' });

  sprites.obsidianBeast = mob(42, 34, (g) => {
    P.beast(g, 21, 17, 1.2, { hi: 'K', mid: 'S', lo: 's' });
    P.snout(g, 32, 15, 1.05, { hi: 'K', mid: 'S', lo: 's', tusk: true });
    for (let k = 0; k < 8; k++) {                                       // 등에 솟은 흑요석 가시
      const x = 10 + k * 2.6, h = 4 + (k % 3);
      for (let j = 0; j < h; j++) P.put(g, x + j * 0.3, 10 - j, j > h - 2 ? 'C' : 'S');
    }
    for (const [x, y] of [[16, 18], [24, 20]]) { P.put(g, x, y, 'C'); P.put(g, x + 1, y + 1, 'C'); }
  }, { K: '#6a6480', S: '#3a3550', s: '#1a1628', C: '#e43b44', B: '#c8ccd8', r: '#ff5c6c' });

  sprites.lavaBurster = mob(36, 34, (g) => {
    P.blob(g, 18, 20, 1.25);
    for (const [x, y, r] of [[11, 12, 3], [25, 11, 3.5], [18, 8, 2.6]]) {  // 터지기 직전의 혹
      P.shade(g, x, y, r, r * 0.85, 'B', 'C', 'c');
      P.put(g, x - 1, y - 1, 'B');
    }
    for (let k = 0; k < 8; k++) P.put(g, 8 + k * 2.7, 30 + (k % 2), 'c');   // 흘러내린 용암
  }, { C: '#ffd866', c: '#e25822', n: '#7a1010', B: '#fff4c8' });


  // ══════════════════════════════════════════════════════════════════════
  //  주인공 4직업 재조립 (v200) — 사장: "모든 플레이어 몬스터를 시제품처럼"
  //  플레이어는 화면에 **항상** 있다. 가장 오래 보는 그림이므로 몬스터보다 더 밀어야 한다.
  //  프레임 5장(걷기3·공격·피격)을 같은 조립 함수에서 pose 만 바꿔 만든다 —
  //  손으로 5장을 따로 찍으면 프레임 사이에 몸이 미묘하게 어긋난다 (종전 그림의 실제 문제)
  // ══════════════════════════════════════════════════════════════════════
  function hero(w, h, build, ov) {
    // pose: 0 정지 · 1/2 걷기 · 3 공격(앞으로 쏟아짐) · 4 피격(뒤로 젖혀짐)
    return [0, 1, 2, 3, 4].map((pose) => {
      const g = canvasGrid(w, h);
      build(g, pose);
      return make(P.rows(g), { ...KIT, ...ov });
    });
  }
  // 걷기 다리 — pose 에 따라 앞뒤로 벌어진다. 상체는 거의 고정(걸음의 무게 이동)
  function heroLegs(g, cx, y0, pose, { hi = 'a', lo = 'n', boot = 'h' } = {}) {
    const sw = pose === 1 ? 1 : pose === 2 ? -1 : 0;
    for (const sgn of [-1, 1]) {
      const off = sgn === sw ? 1 : 0;
      const bend = sgn === -sw ? 1 : 0;
      for (let k = 0; k < 6 - bend; k++) {
        P.span(g, y0 + k, cx + sgn * 2 - 1 + off, cx + sgn * 2 + 1 + off, hi);
        P.put(g, cx + sgn * 2 - 1 + off, y0 + k, sgn < 0 ? hi : lo);
      }
      P.span(g, y0 + 6 - bend, cx + sgn * 2 - 2 + off, cx + sgn * 2 + 2 + off, boot);
      P.span(g, y0 + 7 - bend, cx + sgn * 2 - 2 + off, cx + sgn * 2 + 2 + off, 'n');
    }
  }

  // 가레스 — 판금 투구 · 방패 · 검. 실루엣의 정체성은 **방패와 어깨**
  sprites.playerFrames.player = hero(38, 40, (g, pose) => {
    const lean = pose === 3 ? 2 : pose === 4 ? -2 : 0;
    const cx = 18 + lean;
    heroLegs(g, 18, 30, pose, { hi: 'S', lo: 's', boot: 'h' });
    for (let y = 0; y < 13; y++) {                               // 흉갑 — 어깨 넓고 허리 좁게
      const wd = Math.round(8 - y * 0.28);
      P.span(g, 17 + y, cx - wd, cx + wd, 'S');
      P.put(g, cx - wd, 17 + y, 'K'); P.put(g, cx - wd + 1, 17 + y, 'K');
      P.put(g, cx + wd, 17 + y, 's');
    }
    P.span(g, 24, cx - 7, cx + 7, 'G'); P.put(g, cx, 24, 'C');   // 허리띠
    for (let y = 0; y < 9; y++) { const wd = Math.round(3 + y * 0.7);   // 붉은 망토
      P.span(g, 20 + y, cx - wd - 7, cx - wd - 4, 'A'); P.put(g, cx - wd - 7, 20 + y, 'C'); }
    P.head(g, cx, 10, 1, { helm: true, eye: 'C' });
    P.span(g, 8, cx - 6, cx + 6, 's'); P.put(g, cx, 6, 'C');     // 투구 볏
    if (pose === 3) { P.sword(g, cx + 15, 22, 1, 13); P.limb(g, cx + 11, 17, 1, { hi: 'K', mid: 'S', lo: 's', dx: 0.4, len: 3, thick: 3 }); }
    else { P.sword(g, cx + 12, 26, 1, 12); P.limb(g, cx + 9, 18, 1, { hi: 'K', mid: 'S', lo: 's', dx: 0.2, len: 3, thick: 3 }); }
    P.shield(g, cx - 12, 22, 1.1);                                // 방패는 맨 앞
  }, { K: '#e2e8f4', S: '#93a0b4', s: '#4a5266', A: '#a8202c', a: '#7a1620', n: '#3a0c12',
       G: '#c9a24a', g: '#8a6b3c', h: '#4a3620', C: '#ffd866', F: '#e8c9a0', f: '#c9a179', p: '#8a6a4e' });

  // 레나 — 두건 · 활 · 화살통. 정체성은 **몸 앞을 가로지르는 큰 활**
  sprites.playerFrames.playerArcher = hero(38, 40, (g, pose) => {
    const lean = pose === 3 ? 2 : pose === 4 ? -2 : 0;
    const cx = 18 + lean;
    heroLegs(g, 18, 30, pose, { hi: 'a', lo: 'n', boot: 'h' });
    P.rect(g, cx + 6, 12, 4, 10, 'h');                            // 등에 멘 화살통
    for (let k = 0; k < 4; k++) P.put(g, cx + 6 + k, 11 - k * 0.5, 'G');
    for (let y = 0; y < 13; y++) { const wd = Math.round(6.5 - y * 0.1);
      P.span(g, 17 + y, cx - wd, cx + wd, 'a');
      P.put(g, cx - wd, 17 + y, 'A'); P.put(g, cx + wd, 17 + y, 'n'); }
    P.span(g, 25, cx - 6, cx + 6, 'h'); P.put(g, cx, 25, 'G');
    P.head(g, cx, 10, 1, { hood: true, eye: 'C' });
    P.limb(g, cx - 8, 18, 1, { dx: -0.2, len: 3, thick: 3 });
    P.bow(g, cx + 11, 21, 1, { drawn: pose === 3 });
  }, { A: '#5e7a4a', a: '#3e5630', n: '#1e2c16', C: '#8ad8ff', G: '#c9a24a', g: '#8a6b3c', h: '#4a3620',
       F: '#e8c9a0', f: '#c9a179', p: '#8a6a4e' });

  // 오르빈 — 로브 · 지팡이 · 수염. 정체성은 **긴 로브와 빛나는 정수**
  sprites.playerFrames.playerMage = hero(38, 42, (g, pose) => {
    const lean = pose === 3 ? 2 : pose === 4 ? -2 : 0;
    const cx = 18 + lean;
    heroLegs(g, 18, 32, pose, { hi: 'a', lo: 'n', boot: 'h' });
    P.cloak(g, cx, 16, 1.15, 17);
    P.head(g, cx, 10, 1, { hood: true, eye: 'C' });
    for (let y = 0; y < 6; y++) {                                 // 수염 — 마법사의 정체성
      const wd = Math.round(4 - y * 0.5);
      P.span(g, 14 + y, cx - wd, cx + wd, y < 2 ? 'B' : 'b');
    }
    P.limb(g, cx - 9, 19, 1, { dx: -0.2, len: 3, thick: 3 });
    P.staff(g, cx + 12, pose === 3 ? 30 : 34, 1, 22);
  }, { A: '#4a3a6c', a: '#31264a', n: '#170f28', C: '#b16aff', c: '#7a2fb8',
       B: '#f4eeda', b: '#c8c0b0', F: '#e8c9a0', f: '#c9a179', p: '#8a6a4e', G: '#c9a24a', g: '#8a6b3c' });

  // 이졸데 — 코트 · 고글 · 허리의 약병들. 정체성은 **주렁주렁 매단 유리병**
  sprites.playerFrames.playerAlch = hero(38, 40, (g, pose) => {
    const lean = pose === 3 ? 2 : pose === 4 ? -2 : 0;
    const cx = 18 + lean;
    heroLegs(g, 18, 30, pose, { hi: 'a', lo: 'n', boot: 'h' });
    for (let y = 0; y < 16; y++) { const wd = Math.round(6.5 + y * 0.16);   // 긴 코트
      P.span(g, 17 + y, cx - wd, cx + wd, 'a');
      P.put(g, cx - wd, 17 + y, 'A'); P.put(g, cx - wd + 1, 17 + y, 'A');
      P.put(g, cx + wd, 17 + y, 'n');
      if (y > 2 && (y + cx) % 4 === 0) P.put(g, cx - 1, 17 + y, 'n'); }
    for (let y = 0; y < 16; y++) { P.put(g, cx, 17 + y, 'n'); P.put(g, cx + 1, 17 + y, 'A'); }  // 여밈선
    for (let k = 0; k < 5; k++) { P.put(g, cx + 2, 19 + k * 3, 'G'); }                          // 단추
    for (let k = 0; k < 5; k++) { P.put(g, cx - 4 + k, 17 + k, 'A'); P.put(g, cx + 4 - k, 17 + k, 'A'); }  // 깃(라펠)
    P.head(g, cx, 10, 1, { eye: 'C' });
    P.span(g, 8, cx - 6, cx + 6, 'S'); P.span(g, 9, cx - 6, cx + 6, 'K');   // 이마의 고글
    P.put(g, cx - 3, 9, 'C'); P.put(g, cx + 3, 9, 'C');
    for (const [dx, col] of [[-7, 'C'], [-4, 'P'], [7, 'r']]) {             // 허리의 약병
      P.rect(g, cx + dx, 25, 3, 4, col); P.put(g, cx + dx + 1, 24, 'S');
      P.put(g, cx + dx, 25, 'B');
    }
    P.limb(g, cx - 9, 19, 1, { dx: -0.2, len: 3, thick: 3 });
    if (pose === 3) { P.shade(g, cx + 13, 16, 3.5, 3.5, 'B', 'P', 'c'); P.limb(g, cx + 9, 17, 1, { dx: 0.4, len: 3, thick: 3 }); }
    else P.limb(g, cx + 9, 19, 1, { dx: 0.2, len: 3, thick: 3 });
  }, { A: '#3f5a6a', a: '#2a3d4a', n: '#131e26', C: '#8ad8ff', c: '#3a7ab0', P: '#8adf76',
       S: '#9aa2b8', K: '#d8e0f0', B: '#ffffff', r: '#e43b44', F: '#e8c9a0', f: '#c9a179', p: '#8a6a4e', h: '#3a2c1a' });

  for (const k of ['player', 'playerArcher', 'playerMage', 'playerAlch']) sprites[k] = sprites.playerFrames[k][0];


  // ══════════════════════════════════════════════════════════════════════
  //  보스 23종 재조립 (v200)
  //  보스는 방 하나를 통째로 지배해야 한다. 원본을 48~56px로 키우고
  //  **한 가지 과장**으로 실루엣을 만든다 — 사장 지적 "보스가 뭘 들고 있는지도 구분이 안되잔아"
  //  무기는 맨 마지막에, 크게, 쥔 손과 함께 그린다.
  // ══════════════════════════════════════════════════════════════════════

  // 1층 무덤지기 오스문드 — 챙 넓은 모자 + 초승달 낫
  sprites.boss = mob(56, 56, (g) => {
    heroLegs(g, 22, 44, 0, { hi: 'a', lo: 'n', boot: 'h' });
    P.cloak(g, 22, 24, 1.5, 22);
    P.limb(g, 10, 27, 1.2, { hi: 'F', mid: 'f', lo: 'p', dx: -0.2, len: 5, thick: 4 });
    P.shade(g, 22, 16, 8, 7, 'F', 'f', 'p');                       // 얼굴
    P.span(g, 14, 16, 28, 'p');
    P.put(g, 18, 15, 'r'); P.put(g, 19, 15, 'r'); P.put(g, 25, 15, 'r'); P.put(g, 26, 15, 'r');
    for (let y = 0; y < 5; y++) P.span(g, 6 + y, 14 - y, 30 + y, y < 2 ? 'A' : 'a');   // 크라운
    P.span(g, 11, 2, 42, 'A'); P.span(g, 12, 4, 40, 'a'); P.span(g, 13, 6, 38, 'n');   // 넓은 챙
    P.scythe(g, 40, 52, 1.5);                                       // 낫 — 맨 앞
    P.limb(g, 36, 26, 1.2, { hi: 'F', mid: 'f', lo: 'p', dx: 0.1, len: 4, thick: 4 });
  }, { A: '#4a4458', a: '#2e2a3c', n: '#16131f', F: '#c8b89a', f: '#9a8a6e', p: '#5e5242',
       K: '#e6ecff', S: '#9aa2b8', s: '#5a6076', G: '#c9a24a', g: '#8a6b3c', h: '#4a3620', r: '#e43b44' });

  // 2층 삯꾼 몰레 — 등에 진 시체 자루가 실루엣
  sprites.bossSpore = mob(56, 56, (g) => {
    heroLegs(g, 24, 44, 0, { hi: 'a', lo: 'n', boot: 'h' });
    for (let y = 0; y < 18; y++) { const w = Math.round(9 + y * 0.2);   // 굽은 등
      P.span(g, 24 + y, 24 - w, 24 + w, 'a'); P.put(g, 24 - w, 24 + y, 'A'); }
    P.shade(g, 38, 22, 14, 13, 'C', 'c', 'n');                       // 등에 진 자루
    for (let k = 0; k < 5; k++) P.put(g, 30 + k * 4, 10 + (k % 2) * 2, 'n');
    for (const [x, y] of [[34, 14], [44, 20], [40, 30]]) { P.put(g, x, y, 'B'); P.put(g, x + 1, y + 1, 'C'); }
    P.head(g, 20, 16, 1.4, { hood: true, eye: 'r' });
    P.limb(g, 8, 26, 1.2, { hi: 'F', mid: 'f', lo: 'p', dx: -0.3, len: 5, thick: 4 });
    for (let k = 0; k < 9; k++) P.put(g, 6 + k * 0.3, 40 + k, k > 6 ? 'C' : 'c');   // 흘리는 오물
  }, { A: '#5a5040', a: '#3a3428', n: '#1c1810', C: '#8fa85a', c: '#5e7a38', B: '#c8f078',
       F: '#c8b89a', f: '#9a8a6e', p: '#5e5242', r: '#ffd866', h: '#3a2c1a' });

  // 3층 간수장 바르곤 — 거대한 방패와 철갑. 폭이 실루엣
  sprites.bossGolem = mob(58, 56, (g) => {
    heroLegs(g, 28, 44, 0, { hi: 'S', lo: 's', boot: 'h' });
    for (let y = 0; y < 20; y++) { const w = Math.round(14 - y * 0.2);
      P.span(g, 22 + y, 28 - w, 28 + w, 'S');
      P.put(g, 28 - w, 22 + y, 'K'); P.put(g, 28 - w + 1, 22 + y, 'K'); P.put(g, 28 + w, 22 + y, 's'); }
    for (const y of [28, 34, 40]) P.span(g, y, 15, 41, 's');          // 판금 이음매
    P.head(g, 28, 13, 1.5, { helm: true, eye: 'r' });
    P.span(g, 16, 20, 36, 's');
    P.limb(g, 44, 24, 1.3, { hi: 'K', mid: 'S', lo: 's', dx: 0.2, len: 5, thick: 5 });
    for (let k = 0; k < 12; k++) { P.put(g, 48 + (k % 2), 30 + k * 1.6, 'K'); P.put(g, 49 + (k % 2), 31 + k * 1.6, 'S'); }  // 사슬
    P.shield(g, 10, 30, 2.4);                                        // 거대 방패 — 맨 앞
  }, { K: '#b8c0d0', S: '#6a7286', s: '#33394a', C: '#e43b44', h: '#3a2c1a', r: '#ffd866',
       G: '#c9a24a', g: '#8a6b3c', F: '#c8b89a', f: '#9a8a6e', p: '#5e5242' });

  // 4층 그을음 브란트 — 온몸이 불. 위로 뻗은 불길이 실루엣
  sprites.bossIgnis = mob(56, 60, (g) => {
    // 1차는 불을 머리 자리에 통째로 얹어 **아이스크림 콘**이 됐다.
    // 사람의 실루엣(머리·어깨·팔·다리)을 먼저 세우고, 불은 **머리 위로만** 피어오르게 한다
    heroLegs(g, 27, 46, 0, { hi: 'a', lo: 'n', boot: 'n' });
    for (let y = 0; y < 20; y++) { const w = Math.round(11 - y * 0.3);      // 그을린 몸통
      P.span(g, 24 + y, 27 - w, 27 + w, 'a');
      P.put(g, 27 - w, 24 + y, 'A'); P.put(g, 27 - w + 1, 24 + y, 'A'); P.put(g, 27 + w, 24 + y, 'n'); }
    for (const [x, y] of [[20, 30], [34, 34], [26, 40], [32, 28], [22, 42]])   // 갈라진 틈의 불
      { P.put(g, x, y, 'B'); P.put(g, x, y + 1, 'C'); P.put(g, x + 1, y, 'C'); }
    P.limb(g, 11, 27, 1.3, { hi: 'A', mid: 'a', lo: 'n', dx: -0.3, len: 5, thick: 5 });
    P.limb(g, 43, 27, 1.3, { hi: 'A', mid: 'a', lo: 'n', dx: 0.3, len: 5, thick: 5 });
    P.shade(g, 27, 17, 8, 7, 'A', 'a', 'n');                                   // 두개골 같은 얼굴
    P.span(g, 15, 20, 34, 'n');
    P.put(g, 22, 16, 'B'); P.put(g, 23, 16, 'B'); P.put(g, 31, 16, 'B'); P.put(g, 32, 16, 'B');
    for (let k = 0; k < 5; k++) P.put(g, 22 + k * 2.4, 21, 'C');               // 이빨
    for (let y = 0; y < 11; y++) {                                             // 머리 위로만 타오르는 불
      const t = y / 10;
      const cx = 27 + Math.sin(t * 3.4) * 6 * t;
      const w = Math.round((1 - t) * 8 + 1);
      const jag = Math.sin(y * 2.2) * 1.4;
      P.span(g, 10 - y, Math.round(cx - w - jag), Math.round(cx + w), t > 0.6 ? 'B' : t > 0.28 ? 'C' : 'c');
      P.put(g, Math.round(cx - w - jag), 10 - y, 'B');
    }
    for (const [ox, oy, hh] of [[-9, 6, 5], [10, 4, 4]])                        // 튀는 불티
      for (let k = 0; k < hh; k++) P.put(g, 27 + ox + (k % 2), oy - k, k < 2 ? 'C' : 'B');
  }, { A: '#7a6058', a: '#443430', n: '#1e1614', B: '#fff4c8', C: '#ffd866', c: '#ff7043', r: '#ffd866',
       F: '#8a6a58', f: '#5c4038', p: '#2e1e18' });

  sprites.bossAbyss = mob(56, 60, (g) => {
    for (let y = 20; y < 58; y++) {                                    // 흩어지는 아래
      const w = Math.round(13 - (y - 20) * 0.2);
      for (let x = 26 - w; x <= 26 + w; x++)
        if ((x * 7 + y * 13) % (y > 46 ? 3 : 13) !== 0) P.put(g, x, y, x < 26 ? 'a' : 'n');
      if (y % 5 === 0) P.put(g, 26 - w, y, 'A');
    }
    P.shade(g, 26, 16, 11, 10, 'A', 'a', 'n');
    P.span(g, 12, 18, 34, 'n');
    P.put(g, 21, 15, 'C'); P.put(g, 22, 15, 'C'); P.put(g, 30, 15, 'C'); P.put(g, 31, 15, 'C');
    for (let k = 0; k < 14; k++) P.put(g, 44, 2 + k, k % 3 === 2 ? 'G' : 'g');   // 교수 밧줄
    for (let a = 0; a < 6.3; a += 0.25) P.put(g, 44 + Math.cos(a) * 6, 22 + Math.sin(a) * 5, 'g');  // 올가미
    for (let k = 0; k < 5; k++) P.put(g, 8 + k * 0.4, 24 + k * 3, 'a');
  }, { A: '#8a7ab0', a: '#463a68', n: '#1e1830', C: '#8ad8ff', G: '#c9a24a', g: '#8a6b3c' });

  // 6층 되살아난 오스문드 — 1층과 같은 모자, 그러나 해골
  sprites.bossWraith = mob(56, 56, (g) => {
    for (let y = 26; y < 54; y++) {
      const w = Math.round(11 - (y - 26) * 0.14);
      for (let x = 22 - w; x <= 22 + w; x++)
        if ((x * 7 + y * 13) % (y > 44 ? 3 : 11) !== 0) P.put(g, x, y, x < 22 ? 'a' : 'n');
    }
    P.limb(g, 8, 28, 1.2, { hi: 'B', mid: 'b', lo: 'd', dx: -0.2, len: 5, thick: 3 });
    P.skull(g, 22, 17, 1.5);
    for (let y = 0; y < 5; y++) P.span(g, 7 + y, 14 - y, 30 + y, y < 2 ? 'A' : 'a');
    P.span(g, 12, 2, 42, 'A'); P.span(g, 13, 4, 40, 'a'); P.span(g, 14, 6, 38, 'n');
    P.scythe(g, 40, 52, 1.5);
  }, { A: '#6a5a8c', a: '#3e3358', n: '#1a1428', B: '#f4eeda', b: '#c8c0a8', d: '#8a8272',
       K: '#e2b6ff', S: '#9a6ac0', s: '#4a2f6a', G: '#8a6b3c', g: '#5e4728', r: '#8ad8ff', e: '#1a1622' });

  // 7층 물에 불은 몰레 — 퉁퉁 불어 자루와 몸이 하나가 됐다
  sprites.bossPlague = mob(58, 56, (g) => {
    heroLegs(g, 26, 46, 0, { hi: 'c', lo: 'n', boot: 'n' });
    P.blob(g, 30, 28, 2.4);                                            // 불어터진 몸
    for (const [x, y, r] of [[16, 16, 6], [44, 18, 7], [30, 10, 5]]) { // 터진 종기
      P.shade(g, x, y, r, r * 0.85, 'B', 'C', 'n'); P.put(g, x - 1, y - 1, 'B'); }
    P.span(g, 24, 16, 24, 'p');
    P.head(g, 20, 15, 1.5, { hood: true, eye: 'r' });                // ★ 맨 마지막 — 몸에 묻히지 않게
    for (let k = 0; k < 10; k++) P.put(g, 8 + k * 0.5, 34 + k, k > 7 ? 'B' : 'c');
  }, { C: '#8fa85a', c: '#4e6a2e', n: '#26380f', B: '#c8f078', A: '#5a5040', a: '#3a3428',
       F: '#a8b878', f: '#7a8a50', p: '#4a5a2e', r: '#ffd866' });

  // 8층 사슬에 얽힌 바르곤 — 방패는 깨지고 사슬이 몸을 감았다
  sprites.bossDespair = mob(58, 56, (g) => {
    heroLegs(g, 28, 44, 0, { hi: 'S', lo: 's', boot: 'h' });
    for (let y = 0; y < 20; y++) { const w = Math.round(14 - y * 0.2);
      P.span(g, 22 + y, 28 - w, 28 + w, 'S');
      P.put(g, 28 - w, 22 + y, 'K'); P.put(g, 28 + w, 22 + y, 's'); }
    for (let k = 0; k < 26; k++) {                                     // 몸을 감은 사슬
      const a = k * 0.42, x = Math.round(28 + Math.cos(a) * 15), y = Math.round(22 + k * 0.85);
      P.put(g, x, y, 'K'); P.put(g, x + 1, y, 'S');
    }
    P.head(g, 28, 13, 1.5, { helm: true, eye: 'r' });
    P.shield(g, 10, 30, 2.2);
    for (let k = 0; k < 9; k++) P.put(g, 4 + k, 24 + k * 1.3, 'n');    // 깨진 방패 조각
  }, { K: '#8a94b0', S: '#4a5266', s: '#232838', C: '#8ad8ff', h: '#3a2c1a', r: '#e43b44',
       n: '#141824', G: '#8a6b3c', g: '#5e4728', F: '#a8a094', f: '#78706a', p: '#443e3a' });

  // 9층 재가 된 브란트 — 백열. 불길이 온몸을 삼켰다
  sprites.bossInferno = mob(56, 60, (g) => {
    // 1차는 불을 머리 자리에 통째로 얹어 **아이스크림 콘**이 됐다.
    // 사람의 실루엣(머리·어깨·팔·다리)을 먼저 세우고, 불은 **머리 위로만** 피어오르게 한다
    heroLegs(g, 27, 46, 0, { hi: 'a', lo: 'n', boot: 'n' });
    for (let y = 0; y < 20; y++) { const w = Math.round(13 - y * 0.3);      // 그을린 몸통
      P.span(g, 24 + y, 27 - w, 27 + w, 'a');
      P.put(g, 27 - w, 24 + y, 'A'); P.put(g, 27 - w + 1, 24 + y, 'A'); P.put(g, 27 + w, 24 + y, 'n'); }
    for (const [x, y] of [[20, 30], [34, 34], [26, 40], [32, 28], [22, 42]])   // 갈라진 틈의 불
      { P.put(g, x, y, 'B'); P.put(g, x, y + 1, 'C'); P.put(g, x + 1, y, 'C'); }
    P.limb(g, 11, 27, 1.3, { hi: 'A', mid: 'a', lo: 'n', dx: -0.3, len: 5, thick: 5 });
    P.limb(g, 43, 27, 1.3, { hi: 'A', mid: 'a', lo: 'n', dx: 0.3, len: 5, thick: 5 });
    P.shade(g, 27, 17, 8, 7, 'A', 'a', 'n');                                   // 두개골 같은 얼굴
    P.span(g, 15, 20, 34, 'n');
    P.put(g, 22, 16, 'B'); P.put(g, 23, 16, 'B'); P.put(g, 31, 16, 'B'); P.put(g, 32, 16, 'B');
    for (let k = 0; k < 5; k++) P.put(g, 22 + k * 2.4, 21, 'C');               // 이빨
    for (let y = 0; y < 14; y++) {                                             // 머리 위로만 타오르는 불
      const t = y / 13;
      const cx = 27 + Math.sin(t * 3.4) * 6 * t;
      const w = Math.round((1 - t) * 10 + 1);
      const jag = Math.sin(y * 2.2) * 1.4;
      P.span(g, 10 - y, Math.round(cx - w - jag), Math.round(cx + w), t > 0.6 ? 'B' : t > 0.28 ? 'C' : 'c');
      P.put(g, Math.round(cx - w - jag), 10 - y, 'B');
    }
    for (const [ox, oy, hh] of [[-9, 6, 5], [10, 4, 4]])                        // 튀는 불티
      for (let k = 0; k < hh; k++) P.put(g, 27 + ox + (k % 2), oy - k, k < 2 ? 'C' : 'B');
  }, { A: '#c05a30', a: '#8a3a18', n: '#4a1608', B: '#fff4c8', C: '#ffd866', c: '#ff9a3c', r: '#ffd866',
       F: '#8a6a58', f: '#5c4038', p: '#2e1e18' });

  sprites.deriveFrames = deriveFrames;
  // UI·투사체·아이템은 자세가 없다 — 걸으면 안 된다
  const NO_POSE = /^(arrow|heart|coin|chest|orb|icon|shard|door|torch|pot|crack|rune|bolt|proj|white|tint)/i;
  let derivedN = 0;
  for (const key of Object.keys(sprites)) {
    const img = sprites[key];
    if (!img || !img.width || typeof img.getContext !== 'function') continue;
    if (NO_POSE.test(key)) continue;
    let cur = sprites.enemyFrames[key];
    // ★ 손으로 그린 걷기가 있으면 **그 걷기 프레임에서** 자세를 파생한다.
    // 기본 스프라이트에서 뽑으면 안 된다 — 거미는 기본이 웅크린 모습이고 걷기가 펼친 모습이라,
    // 기본에서 예고·타격을 만들면 **다른 생물이 찌그러진 그림**이 나왔다 (자세 시트로 발각)
    // ★ v200: 다시 그린 스프라이트는 치수가 달라진다. 옛 손그림 프레임을 그대로 쓰면
    // **다른 크기의 캔버스**가 섞여 자세 비교가 무의미해진다 (골렘 wind/strike 가 -1 로 나왔다).
    // 치수가 안 맞으면 그 손그림은 '옛 생물'의 것이므로 버린다 — 새 몸에서 다시 파생한다
    if (cur && cur.walk && cur.walk[0] && (cur.walk[0].width !== img.width || cur.walk[0].height !== img.height)) cur = null;
    const poseBase = (cur && cur.walk && cur.walk[0]) || img;
    const gen = deriveFrames(poseBase);
    // ★ 손으로 그린 프레임은 **절대 덮어쓰지 않는다** — 자동 생성이 사람 손보다 못하다는 걸 알고 쓴다
    //
    // ★ v200: 다만 손으로 그린 attack 에도 **앞으로 쏟아지는 기울기**는 얹는다.
    //   계측에서 골렘이 걸렸다 — 예고는 기본자세 대비 53% 다른데 타격은 20%뿐이라,
    //   「젖혔다 → 쏟아졌다」의 한 쌍이 성립하지 않았다. 손그림의 형태는 그대로 두고
    //   전신 기울기만 더한다 (warp 은 픽셀을 다시 그리는 게 아니라 행을 밀어내는 연산이다).
    const authored = cur && cur.attack;
    const strikeF = authored
      ? warp(authored, (t) => ({ dx: (1 - t) * 3.2, dy: t < 0.4 ? -1 : 0, sx: 1 + (1 - t) * 0.07 }))
      : gen.strike;
    sprites.enemyFrames[key] = {
      walk: (cur && cur.walk) || gen.walk,
      attack: strikeF,
      wind: gen.wind,
      strike: strikeF,
      hurt: gen.hurt,
      die: gen.die,
      derived: !(cur && cur.walk),   // 계측용
    };
    if (!(cur && cur.walk)) derivedN++;
  }
  sprites.frameStats = { total: Object.keys(sprites.enemyFrames).length, derived: derivedN };

  return { ...sprites, white: whiteOf, tint: tintOf };
})();
