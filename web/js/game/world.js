// 절차 생성 방 + 타일 충돌 + 출구 문 + 층 테마/환경 기믹.
// 타일: 0=바닥, 1=벽, 2=용암(비고체, 플레이어 피해)
const TS = 48;

// ─────────────────────────────────────────────────────────────────────────────
// CRAFT — 타일 공방 (v200)
//
// 사장: "이게 최선이야?" → "비용말고 퀄러티말이야."
// 종전 바닥은 48px 단색 사각형 + 줄눈 1px이었다. 그래서 화면이 **격자로** 읽혔다.
// 원인 진단 3가지와 그 처방이 이 파일의 규칙이다:
//   ① 도형(fillRect)으로 찍어서 완벽한 직선만 나왔다  → 값 노이즈로 불규칙성을 만든다
//   ② 광원 방향이 없어 입체가 안 섰다                 → **빛은 항상 좌상단**. 모든 면이 이 규칙 하나를 따른다
//   ③ 색이 제각각이라 따로 놀았다                     → 테마색에서 유도한 **고정 램프**만 쓴다
//
// 성능: 타일마다 픽셀을 놓으면 방 하나에 50만 회 fillRect가 된다(베이크 끊김).
//       24×24 ImageData로 **변종 12장을 한 번만** 구워 캐시하고 그 뒤엔 drawImage만 한다.
//       24px 소스를 ×2로 확대해 스프라이트(24px·SCALE 2)와 픽셀 크기를 맞춘다.
// ★ RNG 주의: 이 모듈은 RNG를 **한 번도** 쓰지 않는다. 자체 해시 노이즈만 쓴다.
//   생성 루프의 RNG 호출 수가 바뀌면 방 생성 전체가 어긋난다 (v197에서 실제로 겪음).
// ─────────────────────────────────────────────────────────────────────────────
const CRAFT = {
  SRC: 24,                       // 소스 해상도 (화면에서는 ×2 = 48px)
  VARIANTS: 12,
  _cache: {},

  hash(x, y, s) {
    let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 1442695041;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
  },

  _rgb(hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  },
  _mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; },

  // 색 램프 — 그림자는 차가운 청보라로, 하이라이트는 따뜻한 살구로 민다.
  // 명암을 단순히 밝기로만 주면 회색으로 죽는다. 색온도가 갈려야 입체로 읽힌다.
  ramp(hex, n) {
    const base = this._rgb(hex);
    const COOL = [46, 36, 74], WARM = [255, 214, 150];
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);                       // 0=가장 어두움 … 1=가장 밝음
      out.push(t < 0.5 ? this._mix(COOL, base, 0.45 + t * 1.1) : this._mix(base, WARM, (t - 0.5) * 0.34));
    }
    return out;
  },

  // ImageData 위에 픽셀 하나 — 캔버스 fillRect보다 100배 빠르다
  _px(d, W, x, y, c, a) {
    if (x < 0 || y < 0 || x >= W || y >= W) return;
    const i = (y * W + x) * 4;
    if (a === undefined || a >= 1) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; return; }
    d[i] += (c[0] - d[i]) * a; d[i + 1] += (c[1] - d[i + 1]) * a; d[i + 2] += (c[2] - d[i + 2]) * a; d[i + 3] = 255;
  },

  _canvas(img) {
    const S = this.SRC;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    c.getContext('2d').putImageData(img, 0, 0);
    return c;
  },

  // ── 바닥 ── 다진 흙 바탕 + 박힌 돌판 + 균열 + 이끼 + 잔뼈
  _floorTile(th, seed) {
    const S = this.SRC, W = S;
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const g = cv.getContext('2d');
    const img = g.createImageData(S, S), d = img.data;
    const E = this.ramp(th.floor[seed % th.floor.length], 5);      // 흙 5단
    const ST = this.ramp(th.floor[(seed + 1) % th.floor.length], 6); // 돌 6단. 바닥색 유도 —
    // wallFace(벽 색)를 쓰면 바닥보다 너무 밝아 '떠 있는 조각'으로 읽힌다 (4배 확대에서 확인)
    const MO = this.ramp(th.moss || '#3f5c33', 4);                 // 이끼 전용색. accent(횃불 빛)를 쓰면 바닥이 주황 얼룩이 된다

    // 바탕 — 픽셀 단위 노이즈. 균일한 면을 아예 만들지 않는다
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = this.hash(x, y, seed);
      this._px(d, W, x, y, E[n > 0.94 ? 3 : n > 0.70 ? 2 : n > 0.30 ? 1 : 0]);
    }
    // 박힌 돌판 0~2장 — 모서리를 확률적으로 깎아 직사각형이 안 보이게 한다
    const nSlab = this.hash(0, 0, seed) > 0.62 ? 2 : this.hash(0, 0, seed) > 0.20 ? 1 : 0;
    for (let k = 0; k < nSlab; k++) {
      const sx = Math.floor(this.hash(k, 1, seed) * (S - 13));
      const sy = Math.floor(this.hash(k, 2, seed) * (S - 11));
      const sw = 6 + Math.floor(this.hash(k, 3, seed) * 6);
      const sh = 5 + Math.floor(this.hash(k, 4, seed) * 5);
      for (let y = sy; y < sy + sh && y < S; y++) for (let x = sx; x < sx + sw && x < S; x++) {
        const ex = Math.min(x - sx, sx + sw - 1 - x), ey = Math.min(y - sy, sy + sh - 1 - y);
        if (ex + ey <= 1 && this.hash(x, y, seed + 9) > 0.30) continue;        // 모서리 크게 깨짐
        if (ex + ey <= 2 && this.hash(x, y, seed + 11) > 0.72) continue;
        const n = this.hash(x, y, seed + 5);
        const lit = (x === sx || y === sy);                                    // ← 광원 좌상단
        const dark = (x === sx + sw - 1 || y === sy + sh - 1);
        this._px(d, W, x, y, ST[lit ? 3 : dark ? 0 : n > 0.72 ? 2 : n > 0.3 ? 1 : 1]);
      }
    }
    // 균열 — 갈라진 방향이 매번 다르고, 갈라진 면에 반사광이 1px 붙는다
    if (this.hash(3, 3, seed) > 0.48) {
      let cx = Math.floor(this.hash(4, 4, seed) * S), cy = Math.floor(this.hash(5, 5, seed) * 6);
      const dir = this.hash(6, 6, seed) > 0.5 ? 1 : -1;
      const len = 10 + this.hash(7, 7, seed) * 12;
      for (let i = 0; i < len; i++) {
        this._px(d, W, cx, cy, ST[0]); this._px(d, W, cx + 1, cy, ST[3], 0.6);
        cy++; const t = this.hash(cx, cy, seed + 3);
        cx += t > 0.72 ? dir : t > 0.5 ? -dir : 0;
      }
    }
    // 흩어진 자갈 — 타일 경계가 만드는 가로 줄무늬를 깨는 역할. 1px 그림자가 우하단
    for (let k = 0; k < 5; k++) {
      if (this.hash(k, 30, seed) < 0.48) continue;
      const gx = Math.floor(this.hash(k, 31, seed) * (S - 3));
      const gy = Math.floor(this.hash(k, 32, seed) * (S - 3));
      const gs = this.hash(k, 33, seed) > 0.7 ? 2 : 1;
      for (let y = 0; y < gs; y++) for (let x = 0; x < gs; x++)
        this._px(d, W, gx + x, gy + y, ST[this.hash(k, 34, seed) > 0.5 ? 3 : 2]);
      this._px(d, W, gx + gs, gy + gs, ST[0], 0.7);
    }
    // 이끼 — 돌 틈에서만 자라야 한다. 아무 데나 찍으면 얼룩으로 보인다
    if (this.hash(8, 8, seed) > 0.80) {
      const mx = Math.floor(this.hash(9, 9, seed) * (S - 8)), my = Math.floor(this.hash(10, 10, seed) * (S - 8));
      for (let y = 0; y < 7; y++) for (let x = 0; x < 8; x++) {
        const n = this.hash(mx + x, my + y, seed + 17);
        const fall = 1 - (x / 8) * 0.6 - (y / 7) * 0.5;                        // 가장자리로 갈수록 성기게
        if (n < fall * 0.42) this._px(d, W, mx + x, my + y, MO[n < fall * 0.15 ? 2 : n < fall * 0.3 ? 1 : 0], 0.55);
      }
    }
    // 잔뼈 — 「지하 묘지」라는 서사가 바닥에 있어야 한다
    if (this.hash(12, 12, seed) > 0.88) {
      const bx = 3 + Math.floor(this.hash(13, 13, seed) * (S - 10));
      const by = 3 + Math.floor(this.hash(14, 14, seed) * (S - 7));
      const BN = this.ramp('#6b6472', 6);
      for (let i = 0; i < 5; i++) this._px(d, W, bx + i, by, BN[3], 0.8);
      this._px(d, W, bx, by - 1, BN[4], 0.8); this._px(d, W, bx + 4, by - 1, BN[4], 0.8);
      this._px(d, W, bx, by + 1, BN[1], 0.8); this._px(d, W, bx + 4, by + 1, BN[1], 0.8);
    }
    g.putImageData(img, 0, 0);
    return cv;
  },

  // ── 벽 정면 ── 그늘진 면. 벽돌이 어긋나게 쌓이고 좌상단 모서리에 빛이 걸린다
  _wallFaceTile(th, seed) {
    const S = this.SRC, W = S;
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const g = cv.getContext('2d');
    const img = g.createImageData(S, S), d = img.data;
    const B = this.ramp(th.wallFace, 6), K = this.ramp(th.wallDark, 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = this.hash(x, y, seed + 1);
      this._px(d, W, x, y, K[n > 0.8 ? 2 : n > 0.4 ? 1 : 0]);          // 줄눈(어두운 바탕)
    }
    for (const [y0, hh, off] of [[0, 8, 0], [8, 8, 5], [16, 8, 2]]) {   // 3단, 단마다 어긋남
      let x = -off - Math.floor(this.hash(y0, 40, seed) * 4);
      while (x < S) {
        const w = 8 + Math.floor(this.hash(x, y0, seed) * 5);
        for (let yy = y0 + 1; yy < y0 + hh - 1 && yy < S; yy++)
          for (let xx = x + 1; xx < x + w - 1; xx++) {
            if (xx < 0 || xx >= S) continue;
            const n = this.hash(xx, yy, seed + 2);
            const lit = (yy === y0 + 1 || xx === x + 1);                 // ← 광원 좌상단
            const dark = (yy === y0 + hh - 2 || xx === x + w - 2);
            this._px(d, W, xx, yy, B[lit ? 4 : dark ? 0 : n > 0.7 ? 3 : n > 0.35 ? 2 : 1]);
          }
        x += w;
      }
    }
    for (let x = 0; x < S; x++) { this._px(d, W, x, S - 2, K[1]); this._px(d, W, x, S - 1, K[0]); }  // 발밑 립
    g.putImageData(img, 0, 0);
    return cv;
  },

  // ── 벽 윗면 ── 빛을 정면으로 받는 면. 가장 밝고, 세로 이음매가 지난다
  _wallTopTile(th, seed) {
    const S = this.SRC, W = S;
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const g = cv.getContext('2d');
    const img = g.createImageData(S, S), d = img.data;
    const R = this.ramp(th.roof, 6);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = this.hash(x, y, seed);
      this._px(d, W, x, y, R[y < 3 ? (n > 0.5 ? 5 : 4) : n > 0.78 ? 4 : n > 0.4 ? 3 : 2]);
    }
    for (let k = 0; k < 3; k++) {                                        // 돌 이음매
      const jx = Math.floor(this.hash(k, 20, seed) * S);
      for (let y = 0; y < S; y++) if (this.hash(jx, y, seed) > 0.25) this._px(d, W, jx, y, R[1]);
    }
    for (let x = 0; x < S; x++) { this._px(d, W, x, S - 2, R[1]); this._px(d, W, x, S - 1, R[0]); }  // 앞면으로 꺾이는 모서리
    g.putImageData(img, 0, 0);
    return cv;
  },

  // ── 결(grain) ── 구조를 건드리지 않고 질감만 얹는 반투명 노이즈.
  // 벽은 이미 v191 「벽 솟음」과 벽돌 단위 명암이라는 좋은 구조를 갖고 있다.
  // 그걸 갈아엎지 않고 **결만** 덧입힌다 — 통짜 면이 사라지는 게 목적이다.
  _grainTile(seed) {
    const S = this.SRC, W = S;
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const g = cv.getContext('2d');
    const img = g.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = this.hash(x, y, seed);
      const i = (y * W + x) * 4;
      // 밝은 알갱이는 따뜻하게, 어두운 알갱이는 차갑게 — 여기서도 색온도를 가른다
      if (n > 0.90)      { d[i] = 255; d[i+1] = 226; d[i+2] = 176; d[i+3] = 26; }
      else if (n > 0.80) { d[i] = 255; d[i+1] = 236; d[i+2] = 206; d[i+3] = 12; }
      else if (n < 0.10) { d[i] = 22;  d[i+1] = 16;  d[i+2] = 40;  d[i+3] = 46; }
      else if (n < 0.22) { d[i] = 30;  d[i+1] = 24;  d[i+2] = 52;  d[i+3] = 22; }
      else d[i+3] = 0;
    }
    g.putImageData(img, 0, 0);
    return cv;
  },

  // 테마별 세트 — 한 번만 굽고 캐시한다
  set(th, key) {
    if (this._cache[key]) return this._cache[key];
    const s = { floor: [], face: [], top: [], grain: [] };
    for (let i = 0; i < this.VARIANTS; i++) s.floor.push(this._floorTile(th, i * 97 + 11));
    for (let i = 0; i < 6; i++) { s.face.push(this._wallFaceTile(th, i * 53 + 7)); s.top.push(this._wallTopTile(th, i * 31 + 3)); }
    for (let i = 0; i < 8; i++) s.grain.push(this._grainTile(i * 41 + 19));
    this._cache[key] = s;
    return s;
  },
};

// 층 테마 팔레트 (기획안 §8.2) — 같은 렌더 코드에 색만 갈아끼운다
// roof: 벽 윗면, grade: 층 컬러 그레이딩, accent: 횃불 빛, decals: 바닥 장식 종류
const FLOOR_THEMES = {
  1: { // 지하 묘지
    floor: ['#1b1b26', '#1e1e2a', '#191922', '#1d1d29'],
    wallBase: '#2a2a3a', wallFace: '#3d3d52', wallDark: '#1c1c28', roof: '#14141d',
    grade: 'rgba(60,60,110,0.05)', accent: '#ff9a3c',
    moss: '#3f5c33',
    decals: ['skull', 'bones', 'crack', 'pebbles'],
  },
  2: { // 곰팡이 동굴 (독 안개)
    floor: ['#16211b', '#182419', '#141f17', '#17231c'],
    wallBase: '#22382a', wallFace: '#2f4d3a', wallDark: '#101a14', roof: '#0d1710',
    grade: 'rgba(50,140,70,0.06)', accent: '#8adf76',
    moss: '#5f8a3e',
    decals: ['moss', 'spore', 'puddle', 'pebbles'],
  },
  3: { // 잊힌 감옥 (좁은 감방 구조)
    floor: ['#20202a', '#232330', '#1d1d26', '#212130'],
    wallBase: '#33334a', wallFace: '#474766', wallDark: '#191924', roof: '#16161f',
    grade: 'rgba(90,90,140,0.05)', accent: '#a9c1d8',
    moss: '#3a5450',
    decals: ['chain', 'crack', 'bones', 'pebbles'],
  },
  4: { // 용암 심층 (바닥 용암)
    floor: ['#241416', '#281618', '#1f1213', '#261517'],
    wallBase: '#3a1f1f', wallFace: '#57302a', wallDark: '#1a0d0e', roof: '#170b0c',
    grade: 'rgba(220,90,30,0.06)', accent: '#ff7043',
    moss: '#6b4a22',
    decals: ['ember', 'crack', 'pebbles'],
  },
  5: { // 심연의 옥좌 (어둠)
    floor: ['#171022', '#191226', '#140e1e', '#181126'],
    wallBase: '#2a1f3d', wallFace: '#3d2c5c', wallDark: '#120b1c', roof: '#0e0817',
    grade: 'rgba(120,40,140,0.06)', accent: '#b13ae0',
    moss: '#4a3a6b',
    decals: ['skull', 'crack', 'voidspeck'],
  },
  // ── 6~10층 심층: 더 어둡고 핏빛으로 물든 변주 ──
  6: { // 피의 묘지
    floor: ['#221419', '#26161c', '#1d1216', '#24151a'],
    wallBase: '#3a222c', wallFace: '#522e3d', wallDark: '#1c1014', roof: '#170c10',
    grade: 'rgba(200,40,60,0.07)', accent: '#e43b44',
    decals: ['skull', 'bones', 'crack', 'pebbles'],
  },
  7: { // 맹독 심연
    floor: ['#101c14', '#121f12', '#0e1a10', '#111e15'],
    wallBase: '#1a2e20', wallFace: '#26422e', wallDark: '#0b140e', roof: '#08110b',
    grade: 'rgba(80,180,60,0.08)', accent: '#6ab04c',
    decals: ['moss', 'spore', 'puddle', 'bones'],
  },
  8: { // 절망의 감옥
    floor: ['#181820', '#1b1b25', '#15151d', '#191924'],
    wallBase: '#282838', wallFace: '#383850', wallDark: '#12121a', roof: '#0e0e15',
    grade: 'rgba(70,70,120,0.08)', accent: '#a9c1d8',
    decals: ['chain', 'crack', 'bones', 'skull'],
  },
  9: { // 겁화의 핵
    floor: ['#2a1210', '#2e1412', '#25100e', '#2c1311'],
    wallBase: '#451f18', wallFace: '#663026', wallDark: '#1e0d0a', roof: '#1a0a08',
    grade: 'rgba(255,90,30,0.09)', accent: '#ffd866',
    decals: ['ember', 'crack'],
  },
  10: { // 심연의 왕좌
    floor: ['#120a1c', '#140b20', '#0f0818', '#130a1f'],
    wallBase: '#241636', wallFace: '#352052', wallDark: '#0e0716', roof: '#0a0511',
    grade: 'rgba(150,30,160,0.09)', accent: '#e43b44',
    decals: ['skull', 'voidspeck', 'crack'],
  },
  // ── 2막: 균사 정원 (11~20층) — 초록·보랏빛 균사가 탑을 삼켰다 ──
  11: { // 안개 낀 강둑
    floor: ['#18241a', '#1a271c', '#152016', '#17231b'],
    wallBase: '#28422e', wallFace: '#39583e', wallDark: '#121e15', roof: '#0e1810',
    grade: 'rgba(120,200,80,0.07)', accent: '#c9d94a',
    decals: ['moss', 'spore', 'pebbles', 'puddle'],
  },
  13: { // 하수 수문
    floor: ['#12221e', '#142521', '#101e1a', '#132320'],
    wallBase: '#1e3a34', wallFace: '#2c5248', wallDark: '#0c1a16', roof: '#091411',
    grade: 'rgba(80,220,160,0.08)', accent: '#8adf76',
    decals: ['puddle', 'moss', 'spore'],
  },
  15: { // 관문 회랑
    floor: ['#1c2014', '#1f2316', '#181c11', '#1b1f15'],
    wallBase: '#303a22', wallFace: '#445230', wallDark: '#161a0e', roof: '#11140b',
    grade: 'rgba(160,180,60,0.07)', accent: '#c9d94a',
    decals: ['moss', 'crack', 'spore', 'pebbles'],
  },
  17: { // 성벽 아래 오물길
    floor: ['#201a14', '#241d16', '#1c1711', '#221b15'],
    wallBase: '#38301e', wallFace: '#4e442c', wallDark: '#1a160d', roof: '#14110a'
    , grade: 'rgba(180,140,50,0.08)', accent: '#8adf76',
    decals: ['moss', 'bones', 'puddle', 'crack'],
  },
  19: { // 관문 광장
    floor: ['#1a1422', '#1d1626', '#16111d', '#191524'],
    wallBase: '#302246', wallFace: '#443264', wallDark: '#150e20', roof: '#100a19',
    grade: 'rgba(160,80,200,0.08)', accent: '#c9d94a',
    decals: ['spore', 'moss', 'voidspeck'],
  },
  // ── 3막: 영지와 재판소 (21~30층) — 귀족의 금빛이 바랜 잿빛 위엄 ──
  21: { // 영지 어귀·포도밭
    floor: ['#1c1a14', '#201d16', '#181611', '#1e1b15'],
    wallBase: '#33301e', wallFace: '#48432c', wallDark: '#17150d', roof: '#121009',
    grade: 'rgba(180,150,60,0.06)', accent: '#c8a068',
    decals: ['pebbles', 'crack', 'bones'],
  },
  23: { // 사병 주둔지
    floor: ['#1a1a1e', '#1d1d22', '#16161a', '#1c1c21'],
    wallBase: '#30303a', wallFace: '#44444f', wallDark: '#141418', roof: '#101013',
    grade: 'rgba(120,120,140,0.06)', accent: '#a9c1d8',
    decals: ['chain', 'crack', 'pebbles'],
  },
  25: { // 재판소
    floor: ['#1e1c18', '#22201b', '#1a1815', '#201e1a'],
    wallBase: '#3a3628', wallFace: '#524c38', wallDark: '#181610', roof: '#13110c',
    grade: 'rgba(200,170,90,0.07)', accent: '#d9c08a',
    decals: ['crack', 'pebbles'],
  },
  27: { // 지하 감옥·고문실
    floor: ['#16141a', '#19171e', '#131118', '#18161d'],
    wallBase: '#2a2634', wallFace: '#3c3749', wallDark: '#110f16', roof: '#0d0b11',
    grade: 'rgba(90,80,130,0.07)', accent: '#8a94a4',
    decals: ['chain', 'bones', 'skull', 'crack'],
  },
  29: { // 공작의 성관·판결의 홀
    floor: ['#1c161c', '#201920', '#181318', '#1e181e'],
    wallBase: '#362a36', wallFace: '#4c3c4c', wallDark: '#161016', roof: '#110c11',
    grade: 'rgba(170,90,150,0.07)', accent: '#c22030',
    decals: ['skull', 'crack', 'voidspeck'],
  },
  // ── 4막: 역병의 마을 (31~40층) — 썩은 황록과 소각의 주홍, 그리고 상아빛 위선 ──
  31: { // 봉쇄된 마을·썩은 밀밭
    floor: ['#171a12', '#1a1e14', '#141710', '#181c13'],
    wallBase: '#2a3020', wallFace: '#3c442e', wallDark: '#12160e', roof: '#0e110b',
    grade: 'rgba(140,180,60,0.06)', accent: '#8adf76',
    decals: ['moss', 'bones', 'crack', 'puddle'],
  },
  33: { // 좀비 거리·판자촌
    floor: ['#191714', '#1c1a16', '#151311', '#1b1815'],
    wallBase: '#302a22', wallFace: '#443c30', wallDark: '#14110d', roof: '#100d0a',
    grade: 'rgba(150,130,80,0.06)', accent: '#c8a068',
    decals: ['bones', 'skull', 'crack', 'pebbles'],
  },
  35: { // 소각장·재의 뜰
    floor: ['#201412', '#241614', '#1b110f', '#221513'],
    wallBase: '#3a221a', wallFace: '#523226', wallDark: '#180e0a', roof: '#130b08',
    grade: 'rgba(230,110,40,0.07)', accent: '#ff7043',
    decals: ['ember', 'bones', 'crack'],
  },
  37: { // 대성당
    floor: ['#1c1a16', '#201e19', '#181613', '#1e1c18'],
    wallBase: '#3a362c', wallFace: '#524c3e', wallDark: '#181610', roof: '#13110d',
    grade: 'rgba(220,200,140,0.07)', accent: '#ffd866',
    decals: ['crack', 'pebbles'],
  },
  39: { // 납골당·지하 성소
    floor: ['#141220', '#161425', '#11101c', '#151322'],
    wallBase: '#262238', wallFace: '#36304e', wallDark: '#0f0d16', roof: '#0b0a11',
    grade: 'rgba(110,90,180,0.07)', accent: '#b13ae0',
    decals: ['skull', 'bones', 'voidspeck', 'chain'],
  },
  // ── 5막: 왕도 (41~50층) — 검은 골목에서 상아·금의 왕좌로, 마지막은 성배의 핏빛 ──
  41: { // 뒷골목·빈민가
    floor: ['#131318', '#15151b', '#101015', '#141419'],
    wallBase: '#26262e', wallFace: '#38384a', wallDark: '#0f0f13', roof: '#0b0b0e',
    grade: 'rgba(80,80,120,0.06)', accent: '#c8a068',
    decals: ['crack', 'pebbles', 'bones'],
  },
  43: { // 대광장·처형대로
    floor: ['#1a1817', '#1d1b19', '#161413', '#1c1a18'],
    wallBase: '#34302c', wallFace: '#4a443e', wallDark: '#151311', roof: '#100f0d',
    grade: 'rgba(180,160,130,0.06)', accent: '#e43b44',
    decals: ['skull', 'crack', 'pebbles'],
  },
  45: { // 근위 관문·병영
    floor: ['#16181d', '#181a20', '#131519', '#171a1f'],
    wallBase: '#2c3040', wallFace: '#3e4458', wallDark: '#121419', roof: '#0e1014',
    grade: 'rgba(120,140,180,0.06)', accent: '#a9c1d8',
    decals: ['chain', 'crack'],
  },
  47: { // 왕성 회랑·알현 복도
    floor: ['#1e1c15', '#221f18', '#1a1812', '#201d16'],
    wallBase: '#3e382a', wallFace: '#57503c', wallDark: '#191711', roof: '#14120d',
    grade: 'rgba(230,200,120,0.08)', accent: '#ffd866',
    decals: ['crack', 'pebbles'],
  },
  49: { // 성배의 방·왕좌
    floor: ['#1c0f14', '#200f16', '#170d11', '#1e0e15'],
    wallBase: '#381822', wallFace: '#502232', wallDark: '#170a0e', roof: '#12080b',
    grade: 'rgba(220,40,60,0.09)', accent: '#c22030',
    decals: ['skull', 'voidspeck', 'crack'],
  },
};
// 짝수 층은 앞 층 테마를 공유한다 (2~5막 공통 규칙)
for (const f of [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50]) FLOOR_THEMES[f] = FLOOR_THEMES[f - 1];

// ── 다크 패스 (기획 §7 '아주 어두운 디아블로식'): 전 테마 명도 하향 — 낮이 없는 세계 ──
// 광원(횃불·accent·grade)만 색을 가진다. 별칭 층(12→11 등)은 같은 객체라 중복 적용 방지
(() => {
  const dk = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b2 = Math.round((n & 255) * f);
    return '#' + ((r << 16) | (g << 8) | b2).toString(16).padStart(6, '0');
  };
  const done = new Set();
  for (const k of Object.keys(FLOOR_THEMES)) {
    const t = FLOOR_THEMES[k];
    if (done.has(t)) continue;
    done.add(t);
    t.floor = t.floor.map((c) => dk(c, 0.72));
    t.wallBase = dk(t.wallBase, 0.76);
    t.wallFace = dk(t.wallFace, 0.8);
    t.wallDark = dk(t.wallDark, 0.7);
    t.roof = dk(t.roof, 0.65);
  }
})();

// 막별 이야기 소품 주입 (비주얼 1차) — 바닥 데칼 풀에 막의 사연을 심는다
(() => {
  const EXTRA = {
    1: ['tombstone', 'crow', 'wither'],
    2: ['rope'],
    3: ['scroll', 'scalemark'],
    4: ['plank', 'plagueX'],
    5: ['banner', 'candle'],
  };
  const done = new Set();
  for (const k of Object.keys(FLOOR_THEMES)) {
    const t = FLOOR_THEMES[k];
    if (done.has(t)) continue;
    done.add(t);
    const f = Number(k);
    const act = f <= 10 ? 1 : Math.min(5, Math.ceil(f / 10));
    for (const d of EXTRA[act] || []) if (!t.decals.includes(d)) t.decals.push(d);
  }
})();

// 층별 환경 기믹 (테마 순환)
const FLOOR_HAZARDS = {
  2: 'fog', 3: 'prison', 4: 'lava', 5: 'dark', 7: 'fog', 8: 'prison', 9: 'lava', 10: 'dark',
  // 2막: 홀씨 안개(11~12) / 어둠 습지(13~14) / 감옥형 회랑(15~16) / 독안개 온상(17~18), 여왕층(19~20)은 전투 집중
  11: 'fog', 12: 'fog', 13: 'dark', 14: 'dark', 15: 'prison', 16: 'prison', 17: 'fog', 18: 'fog',
  // 3막: 포도밭 안개 / 주둔지 창살 / 재판소 어둠 / 지하 감옥 창살, 29~30(성관·판결)은 전투 집중
  21: 'fog', 22: 'fog', 23: 'prison', 24: 'prison', 25: 'dark', 26: 'dark', 27: 'prison', 28: 'prison',
  // 4막: 역병 안개 / 골목 어둠 / 소각 용암 / 성당 창살, 39~40(성소)은 전투 집중
  31: 'fog', 32: 'fog', 33: 'dark', 34: 'dark', 35: 'lava', 36: 'lava', 37: 'prison', 38: 'prison',
  // 5막: 골목 어둠 / 광장 / 근위 창살 / 회랑, 49~50(성배·왕좌)은 전투 집중
  41: 'dark', 42: 'dark', 45: 'prison', 46: 'prison', 47: 'prison', 48: 'prison',
};

// ── 손제작 방 템플릿 (맵 다양화 M1) — Spelunky/Isaac 방식: 랜덤은 '조각의 선택'에만, 조각은 손제작 ──
// 18×9 = 내부 격자 (테두리 벽 제외). 규칙: 좌우 2열과 5번째 행(중앙 통로·문 접근로)은 항상 비운다.
// 문자: . 바닥 / # 벽 / H 위험 지대(용암 층에서만 용암, 그 외 바닥) / P 항아리(70%) / R 진귀한 항아리 / C 균열 벽(부수면 열린다)
// 적용 후 도달 불가 지역은 자동 봉인, 균열 벽 뒤 벽감은 적 스폰 금지 구역이 된다.
const ROOM_TEMPLATES = [
  { name: '기둥 홀', tag: 'pillars', rows: [
    '..................',
    '...#....P.....#...',
    '..................',
    '......#......#....',
    '..................',
    '......#......#....',
    '..................',
    '...#..........#...',
    '..................',
  ] },
  { name: '쪼개진 호수', tag: 'hazard', theme: 'lava', rows: [
    '..................',
    '..................',
    '......HHHHHH......',
    '.....HHHHHHHH.....',
    '..................',
    '.....HHHHHHHH.....',
    '......HHHHHH......',
    '..................',
    '..................',
  ] },
  // 계측 조정: 출입구 2개 밀실이라 사망률 1.86/방문(중앙값의 9배) — 상하 개구부를 뚫어 4방향 출입
  { name: '외곽 링', tag: 'corridor', rows: [
    '..................',
    '....###..###......',
    '....#......#......',
    '....#..P...#......',
    '..................',
    '....#...P..#......',
    '....#......#......',
    '....###..###......',
    '..................',
  ] },
  { name: '좁은 목', tag: 'corridor', rows: [
    '........#.........',
    '........#.........',
    '...P....#.........',
    '........#....P....',
    '..................',
    '........#.........',
    '...P....#....P....',
    '........#.........',
    '........#.........',
  ] },
  { name: '감옥 창살', tag: 'corridor', theme: 'prison', rows: [
    '..................',
    '....#..#..#..#....',
    '....#..#..#..#....',
    '..................',
    '..................',
    '..................',
    '....#..#..#..#....',
    '....#..#..#..#....',
    '..................',
  ] },
  { name: '지그재그 사선', tag: 'corridor', rows: [
    '..................',
    '....#.............',
    '.....##...........',
    '.......##....P....',
    '..................',
    '....P....##.......',
    '...........##.....',
    '.............#....',
    '..................',
  ] },
  { name: '세 갈래 회랑', tag: 'corridor', rows: [
    '..................',
    '..................',
    '...####...#####...',
    '..................',
    '..................',
    '..................',
    '...#####...####...',
    '..................',
    '..................',
  ] },
  { name: '보물꾼의 벽감', tag: 'open', rows: [
    '.............###..',
    '.............#R#..',
    '.............#C#..',
    '..................',
    '..................',
    '.....#............',
    '...#...#..........',
    '.....#......P.....',
    '..................',
  ] },
  { name: '항아리 창고', tag: 'open', rows: [
    '..................',
    '..P....#.....P....',
    '..................',
    '....P.....#.......',
    '..................',
    '.......#.....P....',
    '..................',
    '..P.........#..P..',
    '..................',
  ] },
  { name: '용암 십자', tag: 'hazard', theme: 'lava', rows: [
    '..................',
    '........HH........',
    '........HH........',
    '.....HHHHHHHH.....',
    '..................',
    '.....HHHHHHHH.....',
    '........HH........',
    '........HH........',
    '..................',
  ] },
  { name: '쌍둥이 방책', tag: 'pillars', rows: [
    '..................',
    '..................',
    '...######.........',
    '..................',
    '..................',
    '..................',
    '.........######...',
    '..................',
    '..................',
  ] },
  { name: '왕좌 전정', tag: 'pillars', rows: [
    '..................',
    '....#........#....',
    '........##........',
    '........##........',
    '..................',
    '........##........',
    '........##........',
    '....#........#....',
    '..................',
  ] },
  { name: '무너진 벽감', tag: 'open', rows: [
    '..................',
    '..................',
    '.......P..........',
    '..................',
    '..................',
    '..#C#.............',
    '..#R#....#........',
    '..###..........#..',
    '..................',
  ] },
  // ── 층 전용 템플릿 (theme: 해당 층 기믹에서만 등장, 가중치 ×3) ──
  // 묘지 (1·6층 — 기믹 없는 층): 납골당 선반과 묘비 정원
  { name: '납골당', tag: 'pillars', theme: 'crypt', rows: [
    '..................',
    '...##..##..##.....',
    '...P...........P..',
    '...##..##..##.....',
    '..................',
    '...##..##..##.....',
    '..............P...',
    '...##..##..##.....',
    '..................',
  ] },
  { name: '묘비 정원', tag: 'pillars', theme: 'crypt', rows: [
    '..................',
    '....#...#...#.....',
    '..................',
    '..#...#...#...#...',
    '..................',
    '....#...#...#.....',
    '..................',
    '..#...#...#...P...',
    '..................',
  ] },
  // 안개 (2·7층): H가 독 안개 웅덩이가 된다
  { name: '포자 골짜기', tag: 'hazard', theme: 'fog', rows: [
    '..................',
    '....HH......HH....',
    '...HHH..##..HHH...',
    '........##........',
    '..................',
    '........##........',
    '...HHH..##..HHH...',
    '....HH......HH....',
    '..................',
  ] },
  // 계측 조정: 안쪽 돌출벽이 안개 층에서 구석 몰이 포켓을 만들어 사망률 1.13 — 돌출벽을 없애고
  // 위험을 '보이는 독 웅덩이'로 옮긴다 (몰이가 아니라 판단의 문제가 되도록)
  { name: '균사 미로', tag: 'hazard', theme: 'fog', rows: [
    '..................',
    '.....HH....HH.....',
    '...####....####...',
    '..................',
    '..................',
    '..................',
    '...####....####...',
    '.....HH....HH.....',
    '..................',
  ] },
  // 감옥 (3·8층): 독방 중 하나는 균열 벽으로 봉인된 비밀 감방
  { name: '독방 블록', tag: 'corridor', theme: 'prison', rows: [
    '..................',
    '..#..#..#..###....',
    '..#..#..#..#R#....',
    '...........#C#....',
    '..................',
    '..................',
    '..#..#..#.....P...',
    '..#..#..#.........',
    '..................',
  ] },
  { name: '처형장', tag: 'open', theme: 'prison', rows: [
    '..................',
    '..................',
    '.....##....##.....',
    '.....#......#.....',
    '..................',
    '.....#......#.....',
    '.....##....##.....',
    '.......P..P.......',
    '..................',
  ] },
  // 용암 (4·9층): 강을 다리로 건너는 방, 잿더미 섬
  // 계측 조정: 1칸 다리에서 넉백 낙사가 잦아 사망률 0.75 — 다리를 2칸 폭으로
  { name: '용암 강', tag: 'hazard', theme: 'lava', rows: [
    '.........HH.......',
    '.........HH.......',
    '.........HH.......',
    '.........HH.......',
    '..................',
    '..................',
    '....P....HH.......',
    '.........HH.......',
    '.........HH.......',
  ] },
  { name: '잿더미 섬', tag: 'hazard', theme: 'lava', rows: [
    '..................',
    '....##...HH...##..',
    '..................',
    '..HH....##....HH..',
    '..................',
    '..HH....##....HH..',
    '..................',
    '....##...HH...##..',
    '..................',
  ] },
  // 어둠 (5·10층): 옥좌로 향하는 행렬 기둥, 공허의 십자 제단
  { name: '옥좌 길', tag: 'corridor', theme: 'dark', rows: [
    '..................',
    '..................',
    '...#..#..#..#.....',
    '..................',
    '..................',
    '..................',
    '...#..#..#..#.....',
    '..............P...',
    '..................',
  ] },
  { name: '공허 십자', tag: 'pillars', theme: 'dark', rows: [
    '..................',
    '........#.........',
    '.......###........',
    '........#.........',
    '..................',
    '........#.........',
    '.......###........',
    '....P...#.....P...',
    '..................',
  ] },
  // ── 막 전용 템플릿 (act: 해당 막에서만, 가중치 ×3) — 막마다 다른 "발밑의 문법" ──
  // 2막 다리·관문: 좁고 긴 통로 — 강물(H)과 수문이 싸움터를 조인다
  { name: '무너진 다리', tag: 'hazard', act: 2, rows: [
    '..HHHHHHHHHHHHHH..',
    '..HHHHHHHHHHHHHH..',
    '...#..........#...',
    '..................',
    '..................',
    '..................',
    '...#.....P....#...',
    '..HHHHHHHHHHHHHH..',
    '..HHHHHHHHHHHHHH..',
  ] },
  { name: '수문 통로', tag: 'corridor', act: 2, rows: [
    '..................',
    '..P...........P...',
    '..######..######..',
    '..................',
    '..................',
    '..................',
    '..######..######..',
    '...P...........P..',
    '..................',
  ] },
  { name: '잔교 지그재그', tag: 'corridor', act: 2, rows: [
    '.....#......#.....',
    '.....#......#.....',
    '.....#..P...#.....',
    '..................',
    '..................',
    '..................',
    '.........#........',
    '..P......#....P...',
    '.........#........',
  ] },
  // 3막 영지·재판소: 대칭 홀 — 방청석과 열주가 시야를 통제한다
  { name: '대법정', tag: 'pillars', act: 3, rows: [
    '..................',
    '..##..##..##..##..',
    '..................',
    '....#........#....',
    '..................',
    '....#........#....',
    '..................',
    '..##..##..##..##..',
    '.......P..P.......',
  ] },
  { name: '열주 재판정', tag: 'pillars', act: 3, rows: [
    '..................',
    '..................',
    '..#..#..#..#..#...',
    '..................',
    '..................',
    '..................',
    '...#..#..#..#..#..',
    '..................',
    '..................',
  ] },
  // 4막 역병 마을: 골목 미로 — 코너마다 기습, 좁은 시야
  { name: '골목 미로', tag: 'corridor', act: 4, rows: [
    '...#.....#.....#..',
    '...#.....#.....#..',
    '...#..P..#.....#..',
    '..................',
    '..................',
    '..................',
    '..#.....#.....#...',
    '..#..P..#.....#...',
    '..#.....#.....#...',
  ] },
  { name: '판자촌', tag: 'pillars', act: 4, rows: [
    '..................',
    '...##...##...##...',
    '...##...##...##...',
    '..................',
    '..................',
    '..................',
    '.....##.....##....',
    '..P..##.....##.P..',
    '..................',
  ] },
  { name: '봉쇄 바리케이드', tag: 'corridor', act: 4, rows: [
    '..................',
    '..................',
    '..#######......P..',
    '..................',
    '..................',
    '..................',
    '..P......#######..',
    '..................',
    '..................',
  ] },
  // 5막 왕도·왕성: 대회랑 — 넓지만 도망갈 곳 없는
  { name: '대회랑', tag: 'pillars', act: 5, rows: [
    '..................',
    '..#...#...#...#...',
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '...#...#...#...#..',
    '..................',
  ] },
  { name: '왕도 광장', tag: 'open', act: 5, rows: [
    '..P............P..',
    '..................',
    '........##........',
    '........##........',
    '..................',
    '..................',
    '..................',
    '..P............P..',
    '..................',
  ] },
  { name: '알현 회랑', tag: 'pillars', act: 5, rows: [
    '..................',
    '..................',
    '...#..#....#..#...',
    '..................',
    '..................',
    '..................',
    '...#..#....#..#...',
    '.........P........',
    '..................',
  ] },
  // ── 층 세트피스 (해당 층 첫 전투방 고정) — 서사의 랜드마크 ──
  { name: '대교', tag: 'hazard', setpiece: 11, rows: [
    '..HHHHHHHHHHHHHH..',
    '..HHHHHHHHHHHHHH..',
    '..HHHH......HHHH..',
    '.....#......#.....',
    '..................',
    '.....#......#.....',
    '..HHHH..P...HHHH..',
    '..HHHHHHHHHHHHHH..',
    '..HHHHHHHHHHHHHH..',
  ] },
  { name: '판결의 법정', tag: 'pillars', setpiece: 26, rows: [
    '..................',
    '..##..##..##..##..',
    '..................',
    '..##..........##..',
    '..................',
    '..##..........##..',
    '..................',
    '..##..##..##..##..',
    '.......R..........',
  ] },
  { name: '무너진 판자촌', tag: 'corridor', setpiece: 34, rows: [
    '...##.....##......',
    '...##..P..##...#..',
    '...............#..',
    '..#.....##........',
    '..................',
    '........##.....#..',
    '..##...........#..',
    '..##..P....##.....',
    '...........##..R..',
  ] },
  { name: '처형대', tag: 'open', setpiece: 44, rows: [
    '..................',
    '......######......',
    '......######......',
    '..................',
    '..................',
    '..................',
    '....#........#....',
    '....#...P....#....',
    '..................',
  ] },
  { name: '성배 제단', tag: 'open', setpiece: 49, rows: [
    '..................',
    '..................',
    '........##........',
    '........##........',
    '..................',
    '....#........#....',
    '..................',
    '....#...R....#....',
    '..................',
  ] },
];

// ── 막 실루엣 (맵 2단계) — 방의 "윤곽"을 막마다 다르게: 액자를 부순다 ──
// V = 허공(타일 3): 충돌은 벽과 같고, 그림은 낭떠러지/강물/어둠. 낙사는 없다 (계측 자산 보존).
// 불변 규칙: 5행(중앙 통로)과 우측 문 접근로(2·5·8행의 오른쪽 4열)는 절대 침식하지 않는다
const SILHOUETTES = {
  1: [[ // 묘지 언덕 — 모서리가 어둠에 잠긴다
    'VVVV............VVVV',
    'VV................VV',
    'V...................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    'V...................',
    'VV................VV',
    'VVVV............VVVV',
  ], [
    'VVVVVV........VVVVVV',
    'VVV..............VVV',
    'VV..................',
    'V...................',
    '....................',
    '....................',
    '....................',
    'V...................',
    'VV..................',
    'VVV..............VVV',
    'VVVVVV........VVVVVV',
  ]],
  2: [[ // 다리 — 위아래는 전부 썩은 강물이다
    'VVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVV',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    'VVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVV',
  ]],
  3: [[ // 법정 — 모따기된 대칭 홀
    'VVVVV..........VVVVV',
    'VVV..............VVV',
    'VV..................',
    'V...................',
    '....................',
    '....................',
    '....................',
    'V...................',
    'VV..................',
    'VVV..............VVV',
    'VVVVV..........VVVVV',
  ], [
    'VVVVVV........VVVVVV',
    'VVVV............VVVV',
    'VV..................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    'VV..................',
    'VVVV............VVVV',
    'VVVVVV........VVVVVV',
  ]],
  4: [[ // 무너진 골목 — 삐뚤빼뚤한 잔해 가장자리
    'VVVVVVV.....VVVVVVVV',
    'VVV...........VVVVVV',
    'V...................',
    'VV..................',
    '....................',
    '....................',
    '....................',
    'V...................',
    'VVV.................',
    'V................VVV',
    'VVVVVV.......VVVVVVV',
  ], [
    'VVVV.......VVVVVVVVV',
    'VV..............VVVV',
    '....................',
    'V...................',
    '....................',
    '....................',
    '....................',
    'VV..................',
    'V...................',
    'VVV..............VVV',
    'VVVVVVVV......VVVVVV',
  ]],
  5: [[ // 대성당 — 위가 크게 둥근 알현 홀
    'VVVVVV........VVVVVV',
    'VVVV............VVVV',
    'VV..................',
    'V...................',
    '....................',
    '....................',
    '....................',
    '....................',
    'V...................',
    'VV................VV',
    'VVVV............VVVV',
  ], [
    'VVVVVVV......VVVVVVV',
    'VVVV............VVVV',
    'VVV.................',
    'VV..................',
    '....................',
    '....................',
    '....................',
    'V...................',
    'VV..................',
    'VVVV............VVVV',
    'VVVVVVV......VVVVVVV',
  ]],
  boss: [[ // 결전장 — 모서리만 둥글게, 초식 공간은 온전히
    'VVVVVV........VVVVVV',
    'VVV..............VVV',
    'V...................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    'V...................',
    'VVV..............VVV',
    'VVVVVV........VVVVVV',
  ]],
};

// 막별 태그 가중 — 막의 "발밑 문법"을 확률로 밀어준다 (2막 통로전 / 3막 대칭 홀 / 4막 골목 / 5막 대회랑)
const ACT_TAG_BOOST = {
  2: { corridor: 2.2 },
  3: { pillars: 2.2 },
  4: { corridor: 1.8, pillars: 1.3 },
  5: { pillars: 1.6, open: 1.6 },
};

// 바닥 장식 그리기 루틴 — 전부 코드 픽셀
const DECAL_PAINTERS = {
  // ── 막별 이야기 소품 (비주얼 1차) — 바닥이 막의 사연을 말한다 ──
  tombstone(ctx, x, y) { // 1막: 이름 없는 비석
    ctx.fillStyle = '#4a4a58';
    ctx.fillRect(x + 2, y, 8, 11);
    ctx.fillRect(x, y + 9, 12, 3);
    ctx.fillStyle = '#5c5c6e';
    ctx.fillRect(x + 3, y + 1, 3, 2);
    ctx.fillStyle = '#2a2a36';
    ctx.fillRect(x + 4, y + 4, 4, 1);
    ctx.fillRect(x + 4, y + 6, 4, 1);
  },
  crow(ctx, x, y) { // 1막: 처형장의 까마귀
    ctx.fillStyle = '#16141e';
    ctx.fillRect(x + 2, y + 3, 7, 4);
    ctx.fillRect(x + 4, y + 1, 4, 3);
    ctx.fillRect(x + 9, y + 4, 3, 2);
    ctx.fillStyle = '#e43b44';
    ctx.fillRect(x + 5, y + 2, 1, 1);
  },
  wither(ctx, x, y) { // 1막: 시든 조화(弔花)
    ctx.fillStyle = '#4a3a2e';
    ctx.fillRect(x + 4, y + 3, 1, 8);
    ctx.fillStyle = '#6a5240';
    ctx.fillRect(x + 2, y + 1, 2, 3);
    ctx.fillRect(x + 6, y + 2, 2, 2);
  },
  rope(ctx, x, y) { // 2막: 젖은 밧줄 뭉치
    ctx.strokeStyle = '#6a5a40';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 6, y + 6, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#6a5a40';
    ctx.fillRect(x + 9, y + 8, 6, 2);
  },
  scroll(ctx, x, y) { // 3막: 버려진 판결문
    ctx.fillStyle = '#b8ae96';
    ctx.fillRect(x, y + 2, 12, 9);
    ctx.fillStyle = '#8a8272';
    ctx.fillRect(x + 2, y + 4, 8, 1);
    ctx.fillRect(x + 2, y + 6, 8, 1);
    ctx.fillRect(x + 2, y + 8, 5, 1);
    ctx.fillStyle = '#7a1c28';
    ctx.fillRect(x + 9, y + 8, 2, 2); // 핏빛 인장
  },
  scalemark(ctx, x, y) { // 3막: 바닥에 새겨진 저울 각인
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(x + 5, y, 2, 9);
    ctx.fillRect(x, y + 2, 12, 1);
    ctx.fillRect(x, y + 3, 3, 2);
    ctx.fillRect(x + 9, y + 3, 3, 2);
  },
  plank(ctx, x, y) { // 4막: 뜯겨 나뒹구는 판자
    ctx.fillStyle = '#5e4226';
    ctx.save();
    ctx.translate(x + 8, y + 6);
    ctx.rotate(0.4);
    ctx.fillRect(-9, -2, 18, 4);
    ctx.fillStyle = '#3a2a16';
    ctx.fillRect(-7, -1, 1, 2);
    ctx.fillRect(6, -1, 1, 2);
    ctx.restore();
  },
  plagueX(ctx, x, y) { // 4막: 역병 봉쇄 표식 — 붉은 X
    ctx.strokeStyle = 'rgba(160,32,44,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + 12, y + 12);
    ctx.moveTo(x + 12, y); ctx.lineTo(x, y + 12);
    ctx.stroke();
  },
  banner(ctx, x, y) { // 5막: 찢어져 밟힌 왕실 깃발
    ctx.fillStyle = '#7a1c28';
    ctx.fillRect(x, y, 10, 12);
    ctx.fillStyle = '#b08d4a';
    ctx.fillRect(x + 2, y + 2, 6, 1);
    ctx.fillStyle = '#14110f';
    ctx.fillRect(x + 2, y + 9, 3, 3);
    ctx.fillRect(x + 7, y + 10, 3, 2);
  },
  candle(ctx, x, y) { // 5막: 쓰러진 촛대
    ctx.fillStyle = '#d8d3c5';
    ctx.fillRect(x + 2, y + 5, 8, 3);
    ctx.fillStyle = '#b08d4a';
    ctx.fillRect(x, y + 6, 3, 2);
    ctx.fillStyle = 'rgba(255,216,102,0.5)';
    ctx.fillRect(x + 10, y + 5, 2, 2);
  },
  skull(ctx, x, y) {
    ctx.fillStyle = '#c9c2b2';
    ctx.fillRect(x, y, 10, 8);
    ctx.fillRect(x + 2, y + 8, 6, 3);
    ctx.fillStyle = '#1a1c2c';
    ctx.fillRect(x + 2, y + 3, 2, 3);
    ctx.fillRect(x + 6, y + 3, 2, 3);
  },
  bones(ctx, x, y) {
    ctx.fillStyle = '#a99e8c';
    ctx.fillRect(x, y + 4, 14, 2);
    ctx.fillRect(x + 4, y, 2, 10);
    ctx.fillStyle = '#c9c2b2';
    ctx.fillRect(x - 1, y + 3, 3, 4);
    ctx.fillRect(x + 12, y + 3, 3, 4);
  },
  crack(ctx, x, y) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    let cx = x, cy = y;
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(cx, cy, 3, 2);
      cx += RNG.int(2, 5);
      cy += RNG.int(-2, 4);
    }
  },
  pebbles(ctx, x, y) {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = RNG.pick(['#4a4a5c', '#3a3a48', '#5c5c70']);
      ctx.fillRect(x + RNG.int(0, 14), y + RNG.int(0, 10), 3, 2);
    }
  },
  moss(ctx, x, y) {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = RNG.pick(['#2f6b3a', '#38b76433', '#245530']);
      ctx.fillRect(x + RNG.int(0, 16), y + RNG.int(0, 12), RNG.int(2, 5), 2);
    }
  },
  spore(ctx, x, y) {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = RNG.pick(['#8a5ac2', '#c56cf0']);
      ctx.fillRect(x + RNG.int(0, 14), y + RNG.int(0, 12), 2, 2);
    }
  },
  puddle(ctx, x, y) {
    ctx.fillStyle = 'rgba(60,180,100,0.15)';
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 6, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  chain(ctx, x, y) {
    ctx.strokeStyle = '#5c5c70';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.strokeRect(x + 2, y + i * 6, 5, 5);
    }
  },
  ember(ctx, x, y) {
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = RNG.pick(['#e2582266', '#ffd86655', '#7a101088']);
      ctx.fillRect(x + RNG.int(0, 14), y + RNG.int(0, 10), 3, 3);
    }
  },
  voidspeck(ctx, x, y) {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = RNG.pick(['#b13ae044', '#5c1e5e66']);
      ctx.fillRect(x + RNG.int(0, 14), y + RNG.int(0, 12), 2, 2);
    }
  },
};

const World = {
  // v191: 벽이 위로 솟는 높이(px). 0이면 v190까지의 평면 벽.
  // 위 칸이 solid 일 때만 적용된다 — 바닥을 덮으면 걸어다닐 자리가 사라진다
  WALL_RISE: 22,

  cols: 20,
  rows: 11,
  offsetY: 6,
  map: [],
  doors: [],
  doorsActive: false,
  fogZones: [],   // 독 안개 (2층) — 플레이어 피해
  lavaTiles: [],  // 용암 타일 좌표 (4층 발광 연출용)
  theme: FLOOR_THEMES[1],
  floor: 1,
  _floorCanvas: null,

  buildRoom(depth, type, floor = 1) {
    this.floor = floor;
    // 1~50층은 고유 테마, 51층+(무너진 왕국)은 5막 테마를 순환
    const themeKey = floor <= 50 ? floor : ((floor - 51) % 5) + 46;
    this.theme = FLOOR_THEMES[themeKey] || FLOOR_THEMES[1];
    this.hazard = floor <= 10 ? (FLOOR_HAZARDS[floor] || null) : (FLOOR_HAZARDS[themeKey] || null);
    this.fogZones = [];
    this.lavaTiles = [];

    this.map = [];
    for (let y = 0; y < this.rows; y++) {
      const row = [];
      for (let x = 0; x < this.cols; x++) {
        row.push(y === 0 || y === this.rows - 1 || x === 0 || x === this.cols - 1 ? 1 : 0);
      }
      this.map.push(row);
    }

    // v172: 습격(3파도 생존)·시련(강화전)도 **전투방**이다. 종전엔 템플릿 계통에서 빠져 있어
    // 지형 1종(막는 칸 4.5%)으로 고정됐다 — 3파도를 버티는 방에 엄폐가 하나도 없었다.
    // v168에서 접촉 예고와 적 분리력을 넣었는데, 물러설 지형이 없으면 그 결정이 성립하지 않는다
    const combatRoom = type === 'combat' || type === 'elite' || type === 'siege' || type === 'trial';
    this.potSpots = [];
    this.crackSpots = [];
    this._noSpawn = null;

    // 막 번호 — 51층+(무너진 왕국)은 5막의 문법을 쓴다
    this.act = floor <= 50 ? Math.min(5, Math.ceil(floor / 10)) : 5;
    // 왕좌 카펫: 45·50층 보스방 (무한 모드의 왕좌 순환층 포함)
    this._bossCarpet = type === 'boss' && (floor === 45 || floor === 50 || (floor > 50 && (floor - 51) % 5 === 4));
    this._bossRoom = type === 'boss'; // v125: 모든 보스방에 결전장 프레이밍 (러너·기둥·배너)

    // 막 실루엣 적용 — 금고방(보너스)만 제외. 템플릿·스폰·용암보다 먼저 깔린다
    if (type !== 'vault') {
      const pool = type === 'boss' ? SILHOUETTES.boss : SILHOUETTES[this.act];
      if (pool && pool.length) {
        const mask = pool[Math.floor(RNG.next() * pool.length)];
        for (let ty = 0; ty < this.rows; ty++) {
          for (let tx = 0; tx < this.cols; tx++) {
            if (mask[ty][tx] === 'V') this.map[ty][tx] = 3;
          }
        }
      }
    }

    this.lastTemplateTag = 'open'; // 지형 태그 (M-커플링): 위협 세트가 지형에 맞는 무리를 고르는 데 쓴다
    if (combatRoom) {
      // 층 세트피스: 해당 층의 첫 전투방은 고정 지형 (서사 랜드마크 — 대교/법정/판자촌/처형대/제단)
      let tpl = null;
      const sp = ROOM_TEMPLATES.find((t) => t.setpiece === floor);
      if (sp && this._setpieceFloor !== floor) {
        tpl = sp;
        this._setpieceFloor = floor;
      } else {
        tpl = this._pickTemplate();
      }
      this.lastTemplate = tpl ? tpl.name : '무작위 잔해'; // 디버그/검증용
      this.lastTemplateTag = tpl ? (tpl.tag || 'open') : 'open';
      if (tpl) {
        this._applyTemplate(tpl);
      } else {
        // 무작위 잔해 (구 방식 — 템플릿 풀의 한 갈래로 유지해 변화를 준다)
        const nObstacles = (this.hazard === 'prison' ? 2 : 0) + RNG.int(2, 4 + Math.min(2, Math.floor(depth / 3)));
        for (let i = 0; i < nObstacles; i++) {
          for (let tries = 0; tries < 20; tries++) {
            const tx = RNG.int(4, this.cols - 5);
            const ty = RNG.int(2, this.rows - 3);
            if (ty === 5) continue; // 가운데 통로 확보
            const vertical = this.hazard === 'prison' && RNG.chance(0.6); // 감옥 창살
            const wide = !vertical && RNG.chance(0.4);
            if (this.map[ty][tx] !== 0) continue;
            this.map[ty][tx] = 1;
            if (vertical && ty + 1 < this.rows - 2 && ty + 1 !== 5 && this.map[ty + 1][tx] === 0) {
              this.map[ty + 1][tx] = 1;
            } else if (wide && tx + 1 < this.cols - 2 && this.map[ty][tx + 1] === 0) {
              this.map[ty][tx + 1] = 1;
            }
            break;
          }
        }
      }
    }

    // ── 보스방 엄폐 (v172) ─────────────────────────────────────────────
    // 보스방은 막는 칸이 8칸(4.9%)뿐인 빈 결전장이었다. v159에서 휘두르기 예고를 판정과
    // 일치시켰지만, **읽고 나서 갈 곳이 없으면 예고는 정보일 뿐 결정이 되지 못한다.**
    // 네 귀퉁이 바깥 띠에만 기둥을 세운다 — 중앙 결전 공간(초식 궤도)은 건드리지 않는다.
    // 벽꽂기(v168 분리력·v169 완력의 정점)와도 맞물려 "몰아붙일 곳"이 생긴다
    if (type === 'boss') {
      const midX = (this.cols - 1) / 2, midY = (this.rows - 1) / 2;
      const spots = [[3, 2], [this.cols - 4, 2], [3, this.rows - 3], [this.cols - 4, this.rows - 3],
        [5, this.rows - 3], [this.cols - 6, 2], [5, 2], [this.cols - 6, this.rows - 3],
        [2, 3], [this.cols - 3, 3], [2, this.rows - 4], [this.cols - 3, this.rows - 4]];
      // 순서를 섞고 3~5기를 세운다 — 고정 순서 6칸이면 결전장이 매번 같은 모양이 된다
      for (let i = spots.length - 1; i > 0; i--) {
        const j = RNG.int(0, i);
        const t = spots[i]; spots[i] = spots[j]; spots[j] = t;
      }
      const want = RNG.int(3, 5);
      let placed = 0;
      for (const [tx, ty] of spots) {
        if (placed >= want) break;
        if (Math.hypot(tx - midX, ty - midY) < 5) continue; // 중앙 5칸 반경은 비운다
        if (this.map[ty] && this.map[ty][tx] === 0) { this.map[ty][tx] = 1; placed++; }
      }
    }

    // 독 안개 지대 — 2층(입문)은 작고 적게, 7층(심층)은 본래 규모. 템플릿이 깔았으면 생략
    if (this.hazard === 'fog' && combatRoom && this.fogZones.length === 0) {
      const deep = floor >= 6;
      const n = deep ? RNG.int(2, 3) : 2;
      for (let i = 0; i < n; i++) {
        this.fogZones.push({
          x: RNG.range(TS * 4, TS * (this.cols - 4)),
          y: RNG.range(TS * 2.5, TS * (this.rows - 2.5)) + this.offsetY,
          r: deep ? RNG.range(48, 72) : RNG.range(40, 56),
        });
      }
    }

    // 용암 웅덩이 (보스방 포함) — 템플릿이 이미 용암을 깔았다면 생략
    if (this.hazard === 'lava' && (combatRoom || type === 'boss') && this.lavaTiles.length === 0) {
      const n = type === 'boss' ? 3 : RNG.int(2, 4);
      for (let i = 0; i < n; i++) {
        const tx = RNG.int(3, this.cols - 5);
        const ty = RNG.int(2, this.rows - 4);
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            if (this.map[ty + dy][tx + dx] === 0 && ty + dy !== 5) {
              this.map[ty + dy][tx + dx] = 2;
              this.lavaTiles.push({ tx: tx + dx, ty: ty + dy });
            }
          }
        }
      }
    }

    this._finalizeTerrain(); // 금빛 균열보다 먼저 — 봉인으로 벽이 될 칸 옆에 균열을 놓으면 못 닿는다

    // 비밀 금고 (맵 M3): 층당 한 번, 전투방 내부 벽 어딘가에 금빛 균열 — 부수면 금고방 문이 열린다
    this.goldCrackSpot = null;
    if (combatRoom && typeof Dungeon !== 'undefined' && !Dungeon.vaultCrackPlaced && RNG.chance(0.14)) {
      const cracked = new Set(this.crackSpots.map((s) => s.ty * 100 + s.tx));
      const cands = [];
      for (let ty = 1; ty < this.rows - 1; ty++) {
        for (let tx = 2; tx < this.cols - 3; tx++) {
          if (this.map[ty][tx] !== 1 || cracked.has(ty * 100 + tx)) continue;
          const openAdj = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) =>
            this.map[ty + dy] && this.map[ty + dy][tx + dx] === 0);
          if (openAdj) cands.push({ tx, ty });
        }
      }
      if (cands.length) {
        const c = cands[Math.floor(RNG.next() * cands.length)];
        this.goldCrackSpot = { tx: c.tx, ty: c.ty, x: c.tx * TS + TS / 2, y: c.ty * TS + TS / 2 + this.offsetY };
        Dungeon.vaultCrackPlaced = true;
      }
    }

    this.doors = [];
    this.doorsActive = false;
    this._prerenderFloor();
  },

  // 방 하나가 다 깔린 뒤 딱 한 번 — 갇힌 칸이 하나도 없도록 정리한다 (v172).
  // 종전엔 _applyTemplate 안에서만 돌아서, 템플릿을 안 쓰는 경로가 통째로 빠져 있었다:
  //   · 무작위 잔해(12%) · 보스방 · 상점/휴식방 · 그리고 **실루엣·용암은 봉인 이후에** 깔렸다.
  // 갇힌 칸은 그냥 낭비가 아니라 사고다 — 적이 그 안에 스폰되면 방이 영영 안 끝난다
  _finalizeTerrain() {
    this._sealAndMarkAlcoves();
    // 봉인되며 벽이 된 자리에 남은 유령 배치물을 걷어낸다 (닿을 수 없는 항아리·꺼진 용암)
    this.lavaTiles = this.lavaTiles.filter((t) => this.map[t.ty] && this.map[t.ty][t.tx] === 2);
    this.potSpots = this.potSpots.filter((p) =>
      !this.isSolidTile(Math.floor(p.x / TS), Math.floor((p.y - this.offsetY) / TS)));
  },

  // ── 템플릿 시스템 (M1~M4) ──
  _pickTemplate() {
    // null = 무작위 잔해 (구 방식). 층 전용(theme)·막 전용(act) 템플릿은 해당 층/막에서만, 가중치 ×3.
    // 막별 태그 가중(ACT_TAG_BOOST)이 막의 지형 문법을 밀어준다.
    const themeNow = this.hazard || 'crypt'; // 기믹 없는 층(1·6)은 '묘지' 취급
    const boost = ACT_TAG_BOOST[this.act] || {};
    const pool = [{ tpl: null, w: 2 }];
    for (const t of ROOM_TEMPLATES) {
      if (t.setpiece) continue; // 세트피스는 무작위 풀에서 제외
      if (t.theme && t.theme !== themeNow) continue;
      if (t.act && t.act !== this.act) continue;
      pool.push({ tpl: t, w: (t.theme || t.act ? 3 : 1) * (boost[t.tag] || 1) });
    }
    let total = 0;
    for (const e of pool) total += e.w;
    let roll = RNG.next() * total;
    for (const e of pool) {
      roll -= e.w;
      if (roll <= 0) return e.tpl;
    }
    return null;
  },

  _applyTemplate(tpl) {
    const flip = RNG.chance(0.5); // 좌우 반전으로 체감 풀 2배
    for (let r = 0; r < 9; r++) {
      const row = tpl.rows[r];
      for (let c = 0; c < 18; c++) {
        const ch = row[flip ? 17 - c : c];
        if (ch === '.') continue;
        const tx = 1 + c, ty = 1 + r;
        if (this.map[ty][tx] === 3) continue; // 실루엣 허공 위에는 놓지 않는다
        const cx = tx * TS + TS / 2, cy = ty * TS + TS / 2 + this.offsetY;
        if (ch === '#') {
          this.map[ty][tx] = 1;
        } else if (ch === 'H') {
          if (this.hazard === 'lava') {
            this.map[ty][tx] = 2;
            this.lavaTiles.push({ tx, ty });
          } else {
            // 용암 층이 아니면 H = 독 웅덩이 (안개 층의 독 안개, 2막 다리의 썩은 강물)
            this.fogZones.push({ x: cx, y: cy, r: 34 });
          }
        } else if (ch === 'P') {
          if (RNG.chance(0.7)) this.potSpots.push({ x: cx, y: cy + 4, rare: false });
        } else if (ch === 'R') {
          this.potSpots.push({ x: cx, y: cy + 4, rare: true });
        } else if (ch === 'C') {
          this.map[ty][tx] = 1;
          this.crackSpots.push({ tx, ty, x: cx, y: cy });
        }
      }
    }
    // 봉인은 여기서 하지 않는다 — 방이 다 깔린 뒤 _finalizeTerrain()이 한 번에 한다 (v172)
  },

  // 입구에서 도달 가능한지 BFS — passCracks=true면 균열 벽을 통과 가능으로 취급
  _flood(passCracks) {
    const seen = Array.from({ length: this.rows }, () => new Array(this.cols).fill(false));
    const cracks = new Set(this.crackSpots.map((s) => s.ty * 100 + s.tx));
    // 플레이어 진입 지점(중앙 통로 왼쪽 끝). 실루엣·보스 기둥이 그 칸을 막았을 수 있어서,
    // 막혔으면 가장 가까운 열린 칸에서 시작한다 — safeSpot이 플레이어를 밀어내는 곳과 같은 자리다.
    // (종전엔 (2,5)를 무조건 seen으로 찍고 시작해서, 그 칸이 벽이면 방 전체가 봉인될 수 있었다)
    let sx = 2, sy = 5;
    if (this.isSolidTile(sx, sy)) {
      let best = Infinity;
      for (let ty = 1; ty < this.rows - 1; ty++) {
        for (let tx = 1; tx < this.cols - 1; tx++) {
          if (this.isSolidTile(tx, ty)) continue;
          const d = Math.abs(tx - 2) + Math.abs(ty - 5);
          if (d < best) { best = d; sx = tx; sy = ty; }
        }
      }
      if (best === Infinity) return seen; // 열린 칸이 하나도 없다 — 손댈 게 없다
    }
    const q = [[sx, sy]];
    seen[sy][sx] = true;
    while (q.length) {
      const [tx, ty] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = tx + dx, ny = ty + dy;
        if (nx <= 0 || ny <= 0 || nx >= this.cols - 1 || ny >= this.rows - 1 || seen[ny][nx]) continue;
        const nt = this.map[ny][nx];
        if (nt === 3) continue; // 허공은 못 건넌다
        if (nt === 1 && !(passCracks && cracks.has(ny * 100 + nx))) continue;
        seen[ny][nx] = true;
        q.push([nx, ny]);
      }
    }
    return seen;
  },

  // 연결성 보장: 영원히 도달 불가한 바닥은 벽으로 봉인 (적이 갇혀 방이 안 끝나는 사고 방지),
  // 균열 벽을 부숴야만 닿는 벽감은 적 스폰 금지 구역으로 표시
  _sealAndMarkAlcoves() {
    const now = this._flood(false);
    const ever = this._flood(true);
    this._noSpawn = Array.from({ length: this.rows }, () => new Array(this.cols).fill(false));
    for (let ty = 1; ty < this.rows - 1; ty++) {
      for (let tx = 1; tx < this.cols - 1; tx++) {
        if (this.map[ty][tx] === 1 || this.map[ty][tx] === 3) continue;
        if (!ever[ty][tx]) this.map[ty][tx] = 1;
        else if (!now[ty][tx]) this._noSpawn[ty][tx] = true;
      }
    }
  },

  // 균열 벽 파괴 (M3) — 타일을 바닥으로 바꾸고 다시 굽는다
  breakWall(tx, ty) {
    if (this.map[ty] && this.map[ty][tx] === 1) {
      this.map[ty][tx] = 0;
      if (this._noSpawn && this._noSpawn[ty]) this._noSpawn[ty][tx] = false;
      this._prerenderFloor();
    }
  },

  openDoors(options) {
    const slots = { 1: [5], 2: [3, 7], 3: [2, 5, 8] }[options.length] || [5];
    this.doors = options.map((opt, i) => ({
      x: (this.cols - 1.5) * TS,
      y: slots[i] * TS + TS / 2 + this.offsetY,
      opt,
    }));
    this.doorsActive = true;
  },

  isSolidTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return true;
    const t = this.map[ty][tx];
    return t === 1 || t === 3; // 허공(3)도 벽처럼 막는다 — 낙사 없음
  },

  // 배치 안전 지점: 원하는 좌표가 벽/용암/봉인 벽감이면 가장 가까운 열린 타일 중앙으로 밀어낸다
  // (계측: '경비' 수식어 상자가 템플릿 중앙 기둥 안에 박혀 열 수 없는 방이 나왔다 — 하드 스톨의 범인)
  // ── 진형을 위한 지형 질의 (v181) ────────────────────────────────────
  // 사장 지적: "맵도 거기에 맞게 디자인해야지?"
  // 진형만 세우면 반쪽이다. **지형이 그 자리에 값을 매겨야** 방패벽이 뜻을 갖는다:
  // 좁은 목을 막고 있으니 뚫기 어렵고, 엄폐 뒤에 있으니 저격수를 못 치고,
  // 트인 길에 있으니 돌진이 속도를 붙인다. 그때 비로소 **"어디부터 깰까"**가 결정이 된다
  _tileOpen(tx, ty) {
    return tx > 0 && ty > 0 && tx < this.cols - 1 && ty < this.rows - 1 && !this.isSolidTile(tx, ty)
      && !(this._noSpawn && this._noSpawn[ty] && this._noSpawn[ty][tx]);
  },
  // 사방 이웃 중 막힌 칸 수 — 0이면 트임, 3이면 막다른 목
  _wallsAround(tx, ty) {
    let n = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.isSolidTile(tx + dx, ty + dy)) n++;
    return n;
  },
  // 기준점 주변 r픽셀 안에서 조건을 가장 잘 만족하는 열린 칸을 고른다
  _bestSpot(x, y, r, score) {
    const cx = Math.floor(x / TS), cy = Math.floor((y - this.offsetY) / TS);
    const rad = Math.max(1, Math.round(r / TS));
    let best = null, bs = -Infinity;
    for (let ty = cy - rad; ty <= cy + rad; ty++) {
      for (let tx = cx - rad; tx <= cx + rad; tx++) {
        if (!this._tileOpen(tx, ty)) continue;
        const d = Math.hypot(tx - cx, ty - cy);
        if (d > rad) continue;
        const sc = score(tx, ty) - d * 0.35; // 기준점에서 멀수록 감점 — 진형이 흩어지지 않게
        if (sc > bs) { bs = sc; best = { x: tx * TS + TS / 2, y: ty * TS + TS / 2 + this.offsetY }; }
      }
    }
    return best;
  },
  // 엄폐 — 벽을 등진 자리 (후열: 원거리·주술)
  coverSpot(x, y, r = 96) { return this._bestSpot(x, y, r, (tx, ty) => this._wallsAround(tx, ty) * 2); },
  // 좁은 목 — 양옆이 막혀 지나가려면 여기를 지나야 하는 자리 (전열: 방패)
  chokeSpot(x, y, r = 110) {
    return this._bestSpot(x, y, r, (tx, ty) => {
      const h = this.isSolidTile(tx, ty - 1) && this.isSolidTile(tx, ty + 1); // 상하 막힘 = 가로 통로
      const v = this.isSolidTile(tx - 1, ty) && this.isSolidTile(tx + 1, ty); // 좌우 막힘 = 세로 통로
      return (h || v) ? 6 : this._wallsAround(tx, ty);
    });
  },
  // 트인 길 — 사방이 비어 속도를 붙일 수 있는 자리 (측면: 돌진·기습)
  openSpot(x, y, r = 110) { return this._bestSpot(x, y, r, (tx, ty) => -this._wallsAround(tx, ty) * 2); },

  safeSpot(x, y) {
    const ok = (tx, ty) => {
      if (tx <= 0 || ty <= 0 || tx >= this.cols - 1 || ty >= this.rows - 1) return false;
      if (this.map[ty][tx] !== 0) return false;
      return !(this._noSpawn && this._noSpawn[ty] && this._noSpawn[ty][tx]);
    };
    // 소프트락 수리: 목표가 맵 밖이면 먼저 경계 안으로 클램프 — 돌진 착지점이 맵 밖 8타일+면
    // 링 탐색이 전부 실패해 원좌표(벽/허공)를 그대로 돌려줬고, 보스가 밖에 박혀 영영 못 나왔다 (14층 계측)
    const tx0 = Math.min(this.cols - 2, Math.max(1, Math.floor(x / TS)));
    const ty0 = Math.min(this.rows - 2, Math.max(1, Math.floor((y - this.offsetY) / TS)));
    if (ok(tx0, ty0)) return { x: tx0 * TS + TS / 2, y: ty0 * TS + TS / 2 + this.offsetY };
    for (let r = 1; r < 16; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (ok(tx0 + dx, ty0 + dy)) {
            return { x: (tx0 + dx) * TS + TS / 2, y: (ty0 + dy) * TS + TS / 2 + this.offsetY };
          }
        }
      }
    }
    // 최후: 방 중앙 (어떤 경우에도 맵 밖은 돌려주지 않는다)
    return { x: (this.cols / 2) * TS, y: (this.rows / 2) * TS + this.offsetY };
  },

  isSolidAt(x, y) {
    return this.isSolidTile(Math.floor(x / TS), Math.floor((y - this.offsetY) / TS));
  },

  // 용암 위에 서 있는지 (플레이어 발 위치 기준)
  isLavaAt(x, y) {
    const tx = Math.floor(x / TS);
    const ty = Math.floor((y - this.offsetY) / TS);
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return false;
    return this.map[ty][tx] === 2;
  },

  // 독 안개 안에 있는지
  inFog(x, y) {
    return this.fogZones.some((f) => Math.hypot(x - f.x, y - f.y) < f.r);
  },

  boxCollides(x, y, r) {
    return (
      this.isSolidAt(x - r, y - r) || this.isSolidAt(x + r, y - r) ||
      this.isSolidAt(x - r, y + r) || this.isSolidAt(x + r, y + r)
    );
  },

  moveEntity(e, dx, dy) {
    const hit = { x: false, y: false };
    if (dx !== 0) {
      if (!this.boxCollides(e.x + dx, e.y, e.r)) e.x += dx;
      else hit.x = true;
    }
    if (dy !== 0) {
      if (!this.boxCollides(e.x, e.y + dy, e.r)) e.y += dy;
      else hit.y = true;
    }
    return hit;
  },

  // 벽 무시 이동 (망령 비물질 상태)
  moveGhost(e, dx, dy) {
    e.x = Math.min(Math.max(e.x + dx, TS * 0.7), TS * (this.cols - 0.7));
    e.y = Math.min(Math.max(e.y + dy, this.offsetY + TS * 0.7), this.offsetY + TS * (this.rows - 0.7));
  },

  randomSpawnPos(player, minDist = 190) {
    for (let tries = 0; tries < 60; tries++) {
      const tx = RNG.int(2, this.cols - 3);
      const ty = RNG.int(1, this.rows - 2);
      if (this.map[ty][tx] !== 0) continue;
      if (this._noSpawn && this._noSpawn[ty][tx]) continue; // 벽감(비밀 공간)엔 적이 스폰되지 않는다
      const x = tx * TS + TS / 2;
      const y = ty * TS + TS / 2 + this.offsetY;
      if (Math.hypot(x - player.x, y - player.y) >= minDist) return { x, y };
    }
    return { x: TS * 2.5, y: TS * 2 + this.offsetY };
  },

  center() {
    return { x: (this.cols / 2) * TS, y: (this.rows / 2) * TS + this.offsetY };
  },

  playerStart() {
    const cx = TS * 1.7;
    const mid = (this.rows / 2) * TS + this.offsetY;
    // v189: 나온 문의 높이로 들어선다 — 오른쪽 벽에서 나갔으니 다음 방 왼쪽 벽 같은 높이로.
    // 위 문을 골랐으면 위에서, 아래 문을 골랐으면 아래에서 걷기 시작한다.
    // 종전엔 49/49 전부 이 함수가 돌려주는 상수 한 점이었다 — 그러니 "내가 골랐다"가
    // 화면에 남을 자리가 없었다
    const want = (typeof Dungeon !== 'undefined' && Dungeon.entryY != null) ? Dungeon.entryY : mid;
    // 벽 안이면 안 된다 — 가장 가까운 열린 자리로 붙인다 (템플릿마다 좌측 벽 두께가 다르다)
    const spot = this.safeSpot ? this.safeSpot(cx, want) : { x: cx, y: want };
    return { x: spot.x, y: spot.y };
  },

  _wallAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return true;
    return this.map[ty][tx] === 1;
  },

  // [아트 리마스터] 오토타일 벽(정면/윗면 구분) + 테마 데코 + 벽 그림자 + 횃불 배치
  _prerenderFloor() {
    const c = document.createElement('canvas');
    c.width = this.cols * TS;
    c.height = this.rows * TS;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;      // 24px 소스를 ×2 확대 — 픽셀이 뭉개지면 픽셀아트가 아니다
    const th = this.theme;
    const craft = CRAFT.set(th, (Dungeon.floor || 1) + ':' + (this.act || 1));
    this.torches = [];

    // 1) 바닥 + 용암
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const x = tx * TS;
        const y = ty * TS;
        const tile = this.map[ty][tx];
        if (tile === 1) continue;
        if (tile === 3) {
          // 허공 — 낭떠러지 어둠. 2막은 썩은 강물, 나머지는 막 기운이 밴 심연
          ctx.fillStyle = this.act === 2 ? '#122a28' : '#0a080e';
          ctx.fillRect(x, y, TS, TS);
          if (this.act === 2) {
            ctx.fillStyle = 'rgba(64,140,130,0.5)';
            ctx.fillRect(x, y + ((ty * 7 + tx * 3) % 4) * 10, TS, 5);
            ctx.fillRect(x, y + 26 + ((tx * 5) % 3) * 6, TS, 3);
            if ((tx * 13 + ty * 7) % 3 === 0) {
              ctx.fillStyle = 'rgba(92,224,230,0.22)';
              ctx.fillRect(x + ((tx * 11) % 30) + 6, y + ((ty * 17) % 30) + 8, 3, 2);
            }
          } else {
            ctx.fillStyle = 'rgba(90,60,90,0.05)';
            ctx.fillRect(x + ((tx * 7) % 20), y + ((ty * 11) % 26), 14, 9);
          }
          // 절벽 립: 위가 걷는 바닥이면 낙차 그림자 + 모서리 명암
          const above = ty > 0 ? this.map[ty - 1][tx] : 3;
          if (above === 0 || above === 2) {
            const g = ctx.createLinearGradient(0, y, 0, y + 18);
            g.addColorStop(0, 'rgba(0,0,0,0.55)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x, y, TS, 18);
            ctx.fillStyle = th.wallDark;
            ctx.fillRect(x, y, TS, 4);
          }
          continue;
        }
        if (tile === 2) {
          ctx.fillStyle = '#7a1010';
          ctx.fillRect(x, y, TS, TS);
          ctx.fillStyle = '#c0392b';
          ctx.fillRect(x + 2, y + 2, TS - 4, TS - 4);
          ctx.fillStyle = '#e25822';
          ctx.fillRect(x + 6, y + 6, TS - 12, TS - 12);
          ctx.fillStyle = '#ffd866';
          for (let i = 0; i < 3; i++) {
            ctx.fillRect(x + RNG.int(8, TS - 12), y + RNG.int(8, TS - 12), 4, 4);
          }
          continue;
        }
        // 석판 바닥 (v124 맵 퀄리티): 타일 격자 → 큰 판석. 행마다 반 칸 엇갈린 2타일 판석이
        // 4단 명암으로 깔린다 — 세로 줄눈이 절반으로 줄고, 도면이 아니라 돌바닥이 된다
        {
          const hsh = (a, b) => { let h = (a * 73856093) ^ (b * 19349663) ^ (this._slabSeed || 0); h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) % 1000 / 1000; };
          const slabX = Math.floor((tx + (ty % 2)) / 2); // 벽돌식 엇갈림
          const v = hsh(slabX, ty);
          // ── v200 공방 타일 ──
          // 종전엔 여기서 단색 채우기 + 4단 톤 + 1px 줄눈을 그렸다. 코드상으로는 판석이었지만
          // 화면에서는 **격자**로 읽혔다 (사장: "바닥에 빨간 영역만 나오고…", 맵 실사 확인).
          // 원인 3가지와 처방은 CRAFT 모듈 주석에 있다 — 여기선 바탕만 갈아끼운다.
          // 판석 엇갈림·깨진 판석·막별 재질은 **그대로 살린다** (그건 잘 작동하던 설계다).
          ctx.drawImage(craft.floor[Math.floor(v * CRAFT.VARIANTS) % CRAFT.VARIANTS], x, y, TS, TS);
          // 판 단위 명암 — 큰 판석의 존재감은 유지하되 폭을 절반으로 줄인다(노이즈를 덮지 않게)
          const tone = v < 0.25 ? 'rgba(0,0,0,0.05)' : v < 0.5 ? 'rgba(0,0,0,0.022)' : v < 0.75 ? 'rgba(255,255,255,0.010)' : 'rgba(255,255,255,0.022)';
          ctx.fillStyle = tone;
          ctx.fillRect(x, y, TS, TS);
          // 줄눈: **판 경계에만.** 매 행 가로줄이 격자의 주범이었다.
          // 남긴 경계선도 어두운 선 1px + 아래에 반사광 1px — 파인 홈으로 읽히게 한다
          const leftSlab = Math.floor(((tx - 1) + (ty % 2)) / 2);
          if (leftSlab !== slabX || tx === 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.34)'; ctx.fillRect(x, y, 1, TS);
            ctx.fillStyle = 'rgba(255,222,170,0.05)'; ctx.fillRect(x + 1, y, 1, TS);   // ← 광원 좌상단
          }
          if ((ty + tx) % 2 === 0 || hsh(slabX, ty * 7) < 0.5) {
            ctx.fillStyle = 'rgba(0,0,0,0.20)'; ctx.fillRect(x, y, TS, 1);
            ctx.fillStyle = 'rgba(255,222,170,0.04)'; ctx.fillRect(x, y + 1, TS, 1);
          }
          // 깨진 판석: 사선 균열 + 떨어져나간 모서리
          if (hsh(slabX * 31 + 7, ty) < 0.11) {
            ctx.strokeStyle = 'rgba(0,0,0,0.32)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            const cx0 = x + 6 + v * 20, cy0 = y + 5;
            ctx.moveTo(cx0, cy0);
            ctx.lineTo(cx0 + 8 - v * 10, cy0 + 14);
            ctx.lineTo(cx0 + 3, cy0 + 26);
            ctx.stroke();
          } else if (hsh(slabX * 17 + 3, ty * 13) < 0.08) {
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.fillRect(x + (v < 0.5 ? 1 : TS - 9), y + TS - 8, 8, 7);
          }
          // 막별 바닥 재질 (v125 「막의 표정」): 같은 판석이라도 막의 땅이 다르다
          if (this.act === 1) { // 묘지·변두리: 무덤 흙 얼룩 + 풀포기
            if (hsh(tx * 3 + 1, ty * 5) < 0.14) {
              ctx.fillStyle = 'rgba(58,44,26,0.30)';
              ctx.fillRect(x + 5 + (tx % 3) * 6, y + 8 + (ty % 3) * 6, 18, 12);
            }
            if (hsh(tx * 11, ty * 7 + 2) < 0.10) {
              ctx.fillStyle = 'rgba(74,106,58,0.55)';
              const gx2 = x + 8 + ((tx * 13) % 26), gy2 = y + 10 + ((ty * 17) % 26);
              ctx.fillRect(gx2, gy2 - 3, 1, 4); ctx.fillRect(gx2 + 2, gy2 - 4, 1, 5); ctx.fillRect(gx2 + 4, gy2 - 2, 1, 3);
            }
          } else if (this.act === 2) { // 다리·관문: 젖은 판석 — 물기 하이라이트
            if (hsh(tx * 5, ty * 3 + 1) < 0.18) {
              ctx.fillStyle = 'rgba(120,200,190,0.06)';
              ctx.fillRect(x + 3, y + TS - 10 - ((tx * 7) % 8), TS - 6, 3);
            }
          } else if (this.act === 3) { // 재판소·영지: 대리석 결
            if (hsh(tx * 7 + 3, ty * 11) < 0.22) {
              ctx.strokeStyle = 'rgba(255,255,255,0.05)';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(x + 4, y + 6 + ((tx * 5) % 12));
              ctx.lineTo(x + TS - 6, y + 18 + ((ty * 7) % 16));
              ctx.stroke();
            }
          } else if (this.act === 4) { // 역병 마을: 판자 덧댐 + 마른 얼룩
            if (hsh(slabX * 5 + 2, ty * 3) < 0.13) {
              ctx.fillStyle = 'rgba(74,54,32,0.42)';
              ctx.fillRect(x + 2, y + 4, TS - 4, TS - 8);
              ctx.fillStyle = 'rgba(0,0,0,0.25)';
              for (let k = 1; k < 4; k++) ctx.fillRect(x + 2 + k * ((TS - 4) / 4), y + 4, 1, TS - 8);
            } else if (hsh(tx * 9, ty * 13 + 5) < 0.10) {
              ctx.fillStyle = 'rgba(40,20,14,0.28)';
              ctx.beginPath(); ctx.arc(x + TS / 2 + ((tx * 7) % 10) - 5, y + TS / 2, 9 + (ty % 4), 0, Math.PI * 2); ctx.fill();
            }
          } else if (this.act === 5) { // 왕성: 금 상감 — 판 경계에 드물게 금선
            if ((leftSlab !== slabX || tx === 0) && hsh(slabX * 13, ty * 5 + 1) < 0.16) {
              ctx.fillStyle = 'rgba(176,141,74,0.35)';
              ctx.fillRect(x, y + 2, 1, TS - 4);
            }
          }
          if (RNG.chance(0.10)) { // 잔돌·이물 (기존 감성 유지)
            ctx.fillStyle = 'rgba(120,120,150,0.10)';
            ctx.fillRect(x + RNG.int(6, TS - 12), y + RNG.int(6, TS - 12), RNG.int(3, 8), 3);
          }
        }
      }
    }

    // 1.5) 왕좌 카펫 (45·50층 보스방, 무한 왕좌 순환 포함) — 좌우 문을 잇는 핏빛 융단 + 금테
    if (this._bossCarpet) {
      const cy0 = 4 * TS + this.offsetY, ch2 = 3 * TS - this.offsetY;
      ctx.fillStyle = 'rgba(122,16,24,0.32)';
      ctx.fillRect(TS, cy0, (this.cols - 2) * TS, ch2);
      ctx.fillStyle = 'rgba(56,6,10,0.5)';
      ctx.fillRect(TS, cy0, (this.cols - 2) * TS, 3);
      ctx.fillRect(TS, cy0 + ch2 - 3, (this.cols - 2) * TS, 3);
      ctx.fillStyle = 'rgba(176,141,74,0.5)';
      ctx.fillRect(TS, cy0 + 4, (this.cols - 2) * TS, 2);
      ctx.fillRect(TS, cy0 + ch2 - 6, (this.cols - 2) * TS, 2);
      for (let tx = 2; tx < this.cols - 2; tx += 3) {
        ctx.fillRect(tx * TS + TS / 2 - 1, cy0 + 10, 2, ch2 - 20); // 융단 문양 세로줄
      }
    }

    // 1.6) 보스방 결전장 프레이밍 (v125): 왕좌 카펫이 없는 보스방도 '결전의 방'으로 읽히게
    if (this._bossRoom && !this._bossCarpet) {
      const AC = { 1: '110,70,140', 2: '60,140,130', 3: '180,130,60', 4: '110,150,70', 5: '180,50,60' }[this.act] || '140,50,60';
      // 입장로 러너: 좌측 문에서 결전 문양까지, 막 색의 낡은 융단
      const ry0 = Math.floor(this.rows / 2) * TS - Math.floor(TS * 0.6);
      const rh = Math.floor(TS * 1.2);
      const rw = Math.floor(this.cols * 0.58) * TS;
      ctx.fillStyle = `rgba(${AC},0.26)`;
      ctx.fillRect(TS, ry0, rw, rh);
      ctx.fillStyle = `rgba(${AC},0.55)`;
      ctx.fillRect(TS, ry0, rw, 3);
      ctx.fillRect(TS, ry0 + rh - 3, rw, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; // 러너 그늘 결
      for (let sx2 = TS + 20; sx2 < TS + rw - 10; sx2 += 52) ctx.fillRect(sx2, ry0 + 6, 2, rh - 12);
      // 결전 문양: 러너 끝의 이중 링 — 보스가 기다리는 자리
      const mx = TS + rw + Math.floor(TS * 1.2), my = ry0 + rh / 2;
      ctx.strokeStyle = `rgba(${AC},0.55)`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(mx, my, TS * 1.15, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx, my, TS * 0.72, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(${AC},0.20)`;
      ctx.beginPath(); ctx.arc(mx, my, TS * 0.72, 0, Math.PI * 2); ctx.fill();
      // 기둥 받침 데칼 2열 (러너 양옆)
      for (let px2 = 4; px2 < this.cols - 3; px2 += 4) {
        for (const py2 of [ry0 - TS - 6, ry0 + rh + TS - 24]) {
          if (py2 < TS || py2 > (this.rows - 1) * TS) continue;
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(px2 * TS + 6, py2 + 22, 34, 10);
          ctx.fillStyle = `rgba(${AC},0.5)`;
          ctx.fillRect(px2 * TS + 10, py2, 26, 26);
          ctx.fillStyle = 'rgba(255,255,255,0.10)';
          ctx.fillRect(px2 * TS + 10, py2, 26, 4);
        }
      }
      this._bossBanner = AC; // 정면 벽 배너 색 — 벽 패스에서 그린다
    } else this._bossBanner = null;

    // 2) 바닥 데코 (테마별, 스폰 위치 회피 불필요 — 순수 장식)
    // 첫인상 스프린트 ③: 9~15 → 18~26 — 넓은 검은 바닥이 그대로 노출되던 밀도를 상향
    const nDecals = RNG.int(18, 26);
    for (let i = 0; i < nDecals; i++) {
      const tx = RNG.int(1, this.cols - 2);
      const ty = RNG.int(1, this.rows - 2);
      if (this.map[ty][tx] !== 0) continue;
      const painter = DECAL_PAINTERS[RNG.pick(th.decals)];
      if (painter) painter(ctx, tx * TS + RNG.int(6, TS - 22), ty * TS + RNG.int(6, TS - 18));
    }
    // 미세 흙때 — 타일 4칸당 1개꼴의 아주 옅은 점무늬: 바닥이 '비어 있음'에서 '낡음'으로
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let i = 0; i < 60; i++) {
      const tx = RNG.int(1, this.cols - 2), ty = RNG.int(1, this.rows - 2);
      if (this.map[ty][tx] !== 0) continue;
      ctx.fillRect(tx * TS + RNG.int(2, TS - 6), ty * TS + RNG.int(2, TS - 6), RNG.int(2, 5), RNG.int(2, 4));
    }
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    for (let i = 0; i < 40; i++) {
      const tx = RNG.int(1, this.cols - 2), ty = RNG.int(1, this.rows - 2);
      if (this.map[ty][tx] !== 0) continue;
      ctx.fillRect(tx * TS + RNG.int(2, TS - 8), ty * TS + RNG.int(2, TS - 6), RNG.int(3, 7), RNG.int(2, 5));
    }

    // 3) 벽 (오토타일: 아래가 바닥이면 정면, 아니면 윗면)
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        if (this.map[ty][tx] !== 1) continue;
        const x = tx * TS;
        const y = ty * TS;
        const faceDown = !this._wallAt(tx, ty + 1); // 아래가 바닥 → 벽 정면이 보임

        if (faceDown) {
          // ── 벽 솟음 (v191) ────────────────────────────────────────────
          // 지금 벽은 자기 타일 48px 안에만 그려진다. 그래서 「위에서 내려다본 두께」로만
          // 읽히고 「서 있는 벽」으로 안 읽힌다 — 2.5D 입체감이 여기서 죽는다.
          // 위 칸이 **이미 solid** 일 때만 그 위로 rise 만큼 얼굴을 끌어올린다.
          // (위가 바닥이면 걸어다닐 자리를 덮게 되므로 절대 올리지 않는다)
          const solidAbove = this._wallAt(tx, ty - 1);
          const rise = solidAbove ? World.WALL_RISE : 0;
          // 정면: 벽돌 쌓기 + 윗면 캡 + 아래 어두운 립
          ctx.fillStyle = th.wallBase;
          ctx.fillRect(x, y - rise, TS, TS + rise);
          // 벽돌 단위 명암 (v124): 벽돌 하나하나가 다른 돌이다 — 평면 스트립 탈피
          {
            const bh = Math.floor((TS - 14) / 2); // 벽돌 2단
            for (let row = 0; row < 2; row++) {
              const off = row % 2 ? TS / 4 : 0;
              for (let col = -1; col < 3; col++) {
                const bx = x + off + col * (TS / 2) + 1;
                const bw = TS / 2 - 2;
                const cx2 = Math.max(x + 1, bx), cw = Math.min(x + TS - 1, bx + bw) - cx2;
                if (cw <= 0) continue;
                let bv = ((tx * 7 + col * 13 + row * 29 + ty * 3) % 5);
                ctx.fillStyle = th.wallFace;
                ctx.fillRect(cx2, y - rise + 8 + row * (bh + 2), cw, bh + rise * (row ? 1 : 0));
                ctx.fillStyle = bv === 0 ? 'rgba(0,0,0,0.14)' : bv === 1 ? 'rgba(0,0,0,0.07)' : bv === 4 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0)';
                ctx.fillRect(cx2, y - rise + 8 + row * (bh + 2), cw, bh + rise * (row ? 1 : 0));
              }
            }
          }
          // 윗면 캡 — 솟은 만큼 위로 올라간다 (벽의 '꼭대기'가 여기다)
          ctx.fillStyle = th.roof;
          ctx.fillRect(x, y - rise, TS, 8);
          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          ctx.fillRect(x, y - rise + 7, TS, 1);
          // v191: 꼭대기 아래로 떨어지는 그늘 — 높이가 있어야 생기는 음영이다
          if (rise > 0) {
            const g = ctx.createLinearGradient(0, y - rise + 8, 0, y - rise + 8 + Math.min(26, rise + 10));
            g.addColorStop(0, 'rgba(0,0,0,0.34)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x, y - rise + 8, TS, Math.min(26, rise + 10));
          }
          // 아래 립
          ctx.fillStyle = th.wallDark;
          ctx.fillRect(x, y + TS - 6, TS, 6);
          // ── v200 결 + 광원 규칙 ──
          // 벽돌 구조(v124)와 벽 솟음(v191)은 좋은 설계라 건드리지 않는다.
          // 통짜 면만 없앤다: 반투명 노이즈를 얹고, 빛을 좌상단으로 통일한다
          {
            const gi = Math.floor(CRAFT.hash(tx, ty, 3) * 8) % 8;
            const gt = craft.grain[gi];
            for (let gy = y - rise; gy < y + TS; gy += TS) ctx.drawImage(gt, x, gy, TS, TS);
            ctx.fillStyle = 'rgba(255,222,170,0.055)';        // 좌측 모서리에 걸린 빛
            ctx.fillRect(x, y - rise + 8, 1, TS + rise - 8);
            ctx.fillStyle = 'rgba(18,12,34,0.34)';            // 우측은 그늘 (광원 반대쪽)
            ctx.fillRect(x + TS - 2, y - rise + 8, 2, TS + rise - 8);
          }
          // 벽돌 하이라이트 — 꼭대기 모서리에 얹는다
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(x + 2, y - rise + 9, TS / 2 - 3, 2);
          // 막별 벽 표정 (비주얼 1차) — 같은 벽돌이라도 막의 이야기가 묻어 있다
          if (this.act === 1) { // 묘지: 돌 틈의 이끼
            if ((tx * 7 + ty * 5) % 3 === 0) {
              ctx.fillStyle = 'rgba(56,110,72,0.35)';
              ctx.fillRect(x + ((tx * 9) % 28) + 4, y + 10 + ((ty * 7) % 18), 7, 2);
            }
          } else if (this.act === 2) { // 강둑: 물때 자국
            ctx.fillStyle = 'rgba(52,110,104,0.28)';
            ctx.fillRect(x, y + TS - 13, TS, 7);
          } else if (this.act === 3) { // 재판소: 정제 석벽 몰딩
            ctx.fillStyle = 'rgba(255,255,255,0.09)';
            ctx.fillRect(x, y + 12, TS, 1);
          } else if (this.act === 4) { // 역병 마을: 덧대어 못박은 판자
            if ((tx + ty) % 2 === 0) {
              ctx.fillStyle = 'rgba(94,66,38,0.55)';
              ctx.fillRect(x + 6 + ((tx * 5) % 12), y + 10, 5, TS - 18);
              ctx.fillStyle = 'rgba(255,255,255,0.12)';
              ctx.fillRect(x + 8 + ((tx * 5) % 12), y + 13, 1, 1);
            }
          } else if (this.act === 5) { // 왕성: 금 몰딩
            ctx.fillStyle = 'rgba(176,141,74,0.45)';
            ctx.fillRect(x, y + 8, TS, 1);
          }
          // 보스방 배너 (v125): 결전의 방 정면 벽마다 막 색의 깃발이 걸린다
          if (this._bossBanner && tx % 4 === 1) {
            ctx.fillStyle = `rgba(${this._bossBanner},0.75)`;
            ctx.fillRect(x + TS / 2 - 6, y + 6, 12, 26);
            ctx.beginPath();
            ctx.moveTo(x + TS / 2 - 6, y + 32);
            ctx.lineTo(x + TS / 2, y + 40);
            ctx.lineTo(x + TS / 2 + 6, y + 32);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            ctx.fillRect(x + TS / 2 - 6, y + 6, 12, 2);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(x + TS / 2 - 6, y + 5, 12, 1);
          }
        } else {
          // 윗면(지붕) v124: 석재 블록 질감 — 배경 어둠과 구분되는 '두꺼운 벽 덩어리'로
          ctx.fillStyle = th.roof;
          ctx.fillRect(x, y, TS, TS);
          // 큰 블록 줄눈 (2×2 격자, 엇갈림)
          ctx.fillStyle = 'rgba(0,0,0,0.30)';
          ctx.fillRect(x, y + TS / 2, TS, 1);
          ctx.fillRect(x + (ty % 2 ? TS / 2 : TS / 4), y, 1, TS / 2);
          ctx.fillRect(x + (ty % 2 ? TS / 4 : TS / 2), y + TS / 2, 1, TS / 2);
          ctx.fillStyle = 'rgba(255,255,255,0.035)';
          for (let i = 0; i < 3; i++) {
            ctx.fillRect(x + RNG.int(2, TS - 8), y + RNG.int(2, TS - 4), RNG.int(3, 6), 1);
          }
          // v200 결 — 윗면도 통짜 면이면 배경 어둠과 같아진다
          ctx.drawImage(craft.grain[Math.floor(CRAFT.hash(tx, ty, 7) * 8) % 8], x, y, TS, TS);
          // 바닥과 접한 전 방향 모서리 — 벽 실루엣이 어둠 속에서도 읽힌다
          ctx.fillStyle = 'rgba(255,255,255,0.075)';
          if (!this._wallAt(tx - 1, ty)) ctx.fillRect(x, y, 2, TS);
          if (!this._wallAt(tx + 1, ty)) ctx.fillRect(x + TS - 2, y, 2, TS);
          if (!this._wallAt(tx, ty - 1)) ctx.fillRect(x, y, TS, 2);
        }

        // 횃불 배치: 정면 벽에 일정 간격으로
        // ★ v189 주의: 이 RNG.chance(0.85)를 **지우면 안 된다.**
        // 처음엔 밝기를 통일하려고 이 확률을 걷어냈는데, 그러면 난수 소비가 하나 줄어
        // **뒤따르는 방 생성 전체가 다른 스트림을 타고** 실루엣·템플릿이 통째로 바뀐다
        // (실측: 모든 방 횃불이 2개로 붕괴). 생성기는 그대로 두고 총량만 아래에서 맞춘다
        if (faceDown && tx % 5 === 2 && RNG.chance(0.85)) {
          this.torches.push({ x: x + TS / 2, y: y + TS - 16, seed: RNG.next() * 10 });
        }
      }
    }

    // 4) 벽 아래 바닥 그림자 (입체감)
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        if (this.map[ty][tx] === 1) continue;
        const x = tx * TS;
        const y = ty * TS;
        if (this._wallAt(tx, ty - 1)) {
          const g = ctx.createLinearGradient(0, y, 0, y + 14);
          g.addColorStop(0, 'rgba(0,0,0,0.4)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x, y, TS, 14);
        }
        if (this._wallAt(tx - 1, ty)) {
          const g = ctx.createLinearGradient(x, 0, x + 8, 0);
          g.addColorStop(0, 'rgba(0,0,0,0.25)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x, y, 8, TS);
        }
        if (this._wallAt(tx + 1, ty)) {
          const g = ctx.createLinearGradient(x + TS - 7, 0, x + TS, 0);
          g.addColorStop(0, 'rgba(0,0,0,0)');
          g.addColorStop(1, 'rgba(0,0,0,0.20)');
          ctx.fillStyle = g;
          ctx.fillRect(x + TS - 7, y, 7, TS);
        }
      }
    }

    // 5) 광원 보장 (v124): 방마다 최소 2개의 불 — 초점 없는 균일 어둠 방지
    // v189: 하한만 있고 상한이 없어서 같은 층 안에서 2~6개(최대 3배)로 튀었다.
    // 어두운 방 → 밝은 방 → 어두운 방이 무작위로 오면 "같은 복도를 걷는다"가 아니라
    // "다른 장소로 순간이동했다"로 읽힌다 — 통일돼야 할 것이 통일돼 있지 않았다.
    // 하한을 2 → 3으로 올리고 상한 5를 세운다 (아래 5-b)
    if (this.torches.length < 3) {
      const spots = [[0.3, 0.35], [0.7, 0.65], [0.5, 0.2]];
      for (const [fxr, fyr] of spots) {
        if (this.torches.length >= 3) break;
        let tx0 = Math.round(this.cols * fxr), ty0 = Math.round(this.rows * fyr);
        let found = null;
        for (let rr = 0; rr < 5 && !found; rr++) {
          for (let dy = -rr; dy <= rr && !found; dy++) for (let dx = -rr; dx <= rr && !found; dx++) {
            const ax = tx0 + dx, ay = ty0 + dy;
            if (ax > 0 && ay > 0 && ax < this.cols - 1 && ay < this.rows - 1 && this.map[ay][ax] === 0) found = [ax, ay];
          }
        }
        if (found) this.torches.push({ x: found[0] * TS + TS / 2, y: found[1] * TS + TS / 2, seed: RNG.next() * 10, stand: true });
      }
    }

    // 5-b) 밝기 상한 (v189): 5개를 넘으면 고르게 솎아낸다 — 간격을 유지해 한쪽으로 몰리지 않게.
    // ★ RNG를 쓰지 않는다. 여기서 난수를 뽑으면 뒤따르는 생성이 통째로 다른 스트림을 탄다
    const TORCH_MAX = 5;
    if (this.torches.length > TORCH_MAX) {
      const src = this.torches, keep = [];
      for (let i = 0; i < TORCH_MAX; i++) keep.push(src[Math.round(i * (src.length - 1) / (TORCH_MAX - 1))]);
      this.torches = keep;
    }

    this._floorCanvas = c;
    // 고어 레이어 (v136): 혈흔·잔해는 바닥과 분리된 캔버스에 굽는다 — 시간이 지나면 마르며 사라진다
    const gc = document.createElement('canvas');
    gc.width = c.width; gc.height = c.height;
    this._goreCanvas = gc;
    this._goreFadeT = 0;
  },

  // ── 혈흔 스탬프 (고어, 기획 §7): 고어 레이어에 굽는다 — 프레임 비용 0.
  // v136: 영구 잔존 → 서서히 마르며 사라진다 (오랜 전투에서 바닥이 학살 지도가 되는 문제)
  stampBlood(x, y, r = 8, alpha = 0.5, shadesIn = null) {
    if (!this._goreCanvas) return;
    if ((Meta.data.opts && Meta.data.opts.gore) <= 0) return; // 고어 끔 — 흔적을 남기지 않는다
    if (this.isSolidAt(x, y)) return; // 벽 위에는 안 굽는다
    const ctx = this._goreCanvas.getContext('2d');
    ctx.save();
    ctx.globalAlpha = alpha;
    const shades = shadesIn || ['#4a0d12', '#5a1016', '#3a0a0e', '#66131b'];
    ctx.fillStyle = shades[Math.floor(Math.random() * shades.length)];
    ctx.beginPath();
    ctx.ellipse(x, y - this.offsetY + 6, r, r * 0.62, (Math.random() - 0.5) * 0.8, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const a2 = Math.random() * Math.PI * 2, d2 = r * (0.9 + Math.random() * 0.9);
      ctx.fillStyle = shades[Math.floor(Math.random() * shades.length)];
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a2) * d2, y - this.offsetY + 6 + Math.sin(a2) * d2 * 0.62,
        1.2 + Math.random() * 2.2, 1 + Math.random() * 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  // 절단 조각 베이크 (v126): 멈춘 조각을 고어 레이어에 굽는다 — 프레임 비용 0, 시간이 지나면 스러진다
  stampImage(img, x, y, rot = 0, alpha = 0.88) {
    if (!this._goreCanvas || !img) return;
    if (this.isSolidAt(x, y)) return;
    const ctx = this._goreCanvas.getContext('2d');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y - this.offsetY);
    ctx.rotate(rot);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  },

  // 고어 풍화 (v136): 0.5초마다 알파를 5%씩 깎는다 — 핏자국이 마르고 잔해가 삭는다.
  // 신선한 흔적은 또렷하고(3초 후에도 74%), 오랜 전투의 누적은 스스로 정리된다 (30초 ≈ 4%)
  tickGore(dt) {
    if (!this._goreCanvas) return;
    this._goreFadeT = (this._goreFadeT || 0) + dt;
    if (this._goreFadeT < 0.5) return;
    this._goreFadeT -= 0.5;
    const ctx = this._goreCanvas.getContext('2d');
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this._goreCanvas.width, this._goreCanvas.height);
    ctx.restore();
  },

  draw(ctx, animT = 0) {
    ctx.drawImage(this._floorCanvas, 0, this.offsetY);
    if (this._goreCanvas) ctx.drawImage(this._goreCanvas, 0, this.offsetY);

    // 횃불: 깜빡이는 불꽃 + 따뜻한 빛 번짐
    for (const t of this.torches || []) {
      const y = t.y + this.offsetY;
      const flick = Math.sin(animT * 11 + t.seed) * 0.5 + Math.sin(animT * 23 + t.seed * 3) * 0.3;
      // 받침대 (stand: 바닥 화로 — 기둥과 화분이 있다)
      ctx.fillStyle = '#3d2418';
      if (t.stand) {
        ctx.fillRect(t.x - 2, y - 4, 4, 16);
        ctx.fillStyle = '#2a1a10';
        ctx.fillRect(t.x - 6, y + 10, 12, 3);
        ctx.fillStyle = '#4a3020';
        ctx.fillRect(t.x - 5, y - 6, 10, 4);
      } else {
        ctx.fillRect(t.x - 2, y, 4, 8);
      }
      // 불꽃 (3단)
      ctx.fillStyle = '#ff7043';
      ctx.fillRect(t.x - 3, y - 6 + flick, 6, 6);
      ctx.fillStyle = '#ffd866';
      ctx.fillRect(t.x - 2, y - 9 + flick * 1.4, 4, 5);
      ctx.fillStyle = '#fff7c0';
      ctx.fillRect(t.x - 1, y - 7 + flick, 2, 3);
      // 빛 번짐
      const gr = (t.stand ? 96 : 78) + flick * 7; // v124: 빛 반경 확대 — 방에 초점이 생긴다
      const glow = ctx.createRadialGradient(t.x, y - 4, 4, t.x, y - 4, gr);
      glow.addColorStop(0, 'rgba(255,150,60,0.15)');
      glow.addColorStop(0.6, 'rgba(255,120,50,0.06)');
      glow.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(t.x, y - 4, gr + 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 용암 발광 펄스
    if (this.lavaTiles.length > 0) {
      ctx.globalAlpha = 0.15 + Math.sin(animT * 3) * 0.08;
      ctx.fillStyle = '#ffd866';
      for (const t of this.lavaTiles) {
        ctx.fillRect(t.tx * TS, t.ty * TS + this.offsetY, TS, TS);
      }
      ctx.globalAlpha = 1;
    }

    // 독 안개 (초록 원, 일렁임)
    for (const f of this.fogZones) {
      const pulse = 1 + Math.sin(animT * 2 + f.x) * 0.06;
      const g = ctx.createRadialGradient(f.x, f.y, f.r * 0.2, f.x, f.y, f.r * pulse);
      g.addColorStop(0, 'rgba(106,176,76,0.30)');
      g.addColorStop(1, 'rgba(106,176,76,0.04)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawDoors(ctx, animT) {
    if (!this.doorsActive) return;
    for (const d of this.doors) {
      const c = d.opt.color;
      const pulse = 0.5 + Math.sin(animT * 3 + d.y * 0.01) * 0.18;

      // 바닥 빛 웅덩이
      ctx.save();
      ctx.globalAlpha = 0.16 + pulse * 0.1;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y + 30, 26, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 석조 프레임 (기둥 + 아치 + 쐐기돌)
      ctx.fillStyle = '#0d0a12';
      ctx.fillRect(d.x - 20, d.y - 22, 40, 52); // 안쪽 어둠
      ctx.fillStyle = '#2a2438';
      ctx.fillRect(d.x - 26, d.y - 22, 7, 54);  // 왼 기둥
      ctx.fillRect(d.x + 19, d.y - 22, 7, 54);  // 오른 기둥
      ctx.beginPath();                          // 아치
      ctx.arc(d.x, d.y - 20, 26, Math.PI, 0);
      ctx.arc(d.x, d.y - 20, 19, 0, Math.PI, true);
      ctx.fill();
      ctx.fillStyle = '#3a3450';                // 기둥 하이라이트 + 쐐기돌
      ctx.fillRect(d.x - 25, d.y - 22, 2, 54);
      ctx.fillRect(d.x + 20, d.y - 22, 2, 54);
      ctx.fillRect(d.x - 4, d.y - 48, 8, 9);
      ctx.fillStyle = '#1a1626';                // 받침돌
      ctx.fillRect(d.x - 27, d.y + 28, 54, 5);

      // 포탈 내부 발광 (방 타입 색)
      ctx.save();
      ctx.beginPath();
      ctx.rect(d.x - 19, d.y - 21, 38, 50);
      ctx.arc(d.x, d.y - 20, 19, Math.PI, 0);
      ctx.clip();
      const g = ctx.createRadialGradient(d.x, d.y + 2, 3, d.x, d.y + 2, 34);
      g.addColorStop(0, c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.34 + pulse * 0.22;
      ctx.fillStyle = g;
      ctx.fillRect(d.x - 20, d.y - 42, 40, 74);
      // 세로 일렁임
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#ffffff';
      for (let k = 0; k < 3; k++) {
        const sx = d.x - 12 + k * 12 + Math.sin(animT * 2 + k * 2.1) * 3;
        ctx.fillRect(sx, d.y - 38, 2, 66);
      }
      // 상승 입자 (결정적 애니메이션 — 랜덤 없음)
      ctx.fillStyle = c;
      for (let k = 0; k < 4; k++) {
        const ph = (animT * 22 + k * 17) % 52;
        ctx.globalAlpha = 0.5 * (1 - ph / 52);
        ctx.fillRect(d.x - 10 + k * 7, d.y + 24 - ph, 2, 2);
      }
      ctx.restore();

      // 타입 아이콘 (포탈 중앙)
      this._doorIcon(ctx, d.opt.type, d.x, d.y - 2, c, pulse);

      // 명판 (라벨)
      const w = ctx.measureText ? Math.max(40, d.opt.label.length * 13 + 14) : 46;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#0d0a12';
      ctx.fillRect(d.x - w / 2, d.y - 66, w, 18);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c;
      ctx.lineWidth = 1;
      ctx.strokeRect(d.x - w / 2, d.y - 66, w, 18);
      ctx.font = 'bold 12px Galmuri11, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = c;
      ctx.fillText(d.opt.label, d.x, d.y - 53);

      // 한 줄 툴팁 — 문의 의미를 그 자리에서 배운다 (신규 유저 학습 부하 대응)
      if (d.opt.desc) {
        ctx.font = '10px Galmuri11, monospace';
        ctx.fillStyle = '#9aa0b4';
        ctx.fillText(d.opt.desc, d.x, d.y + 46);
      }

      // 문 수식어 (위험-보상): 명판 위에 경고 라벨 + 설명
      if (d.opt.mod) {
        ctx.font = 'bold 11px Galmuri11, monospace';
        ctx.fillStyle = '#e43b44';
        ctx.fillText(`⚠ ${d.opt.mod.label}`, d.x, d.y - 72);
        ctx.font = '10px Galmuri11, monospace';
        ctx.fillStyle = '#9aa0b4';
        ctx.fillText(d.opt.mod.desc, d.x, d.y - 84);
      }
    }
  },

  // 방 타입별 문 아이콘 — 외부 폰트 없이 도형으로 그린다
  _doorIcon(ctx, type, x, y, color, pulse) {
    ctx.save();
    ctx.globalAlpha = 0.75 + pulse * 0.25;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    if (type === 'combat') {
      // 교차하는 두 자루 검
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x - 8 * s, y + 8);
        ctx.lineTo(x + 8 * s, y - 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - 8 * s, y + 4);
        ctx.lineTo(x - 4 * s, y + 8);
        ctx.stroke();
      }
    } else if (type === 'shortcut') {
      // 이중 화살촉 (아래로) — 두 층을 한 번에 내려간다
      for (const oy of [-5, 3]) {
        ctx.beginPath();
        ctx.moveTo(x - 8, y + oy - 4);
        ctx.lineTo(x, y + oy + 4);
        ctx.lineTo(x + 8, y + oy - 4);
        ctx.stroke();
      }
    } else if (type === 'elite') {
      // 왕관
      ctx.beginPath();
      ctx.moveTo(x - 9, y + 6); ctx.lineTo(x - 9, y - 3); ctx.lineTo(x - 4, y + 1);
      ctx.lineTo(x, y - 7); ctx.lineTo(x + 4, y + 1); ctx.lineTo(x + 9, y - 3);
      ctx.lineTo(x + 9, y + 6); ctx.closePath();
      ctx.fill();
    } else if (type === 'vault') {
      // 금고 자물쇠 — 몸통 + 고리
      ctx.beginPath();
      ctx.arc(x, y - 4, 6, Math.PI, 0);
      ctx.stroke();
      ctx.fillRect(x - 8, y - 4, 16, 11);
      ctx.fillStyle = '#0d0a12';
      ctx.fillRect(x - 1.5, y - 1, 3, 5);
    } else if (type === 'siege') {
      // 밀려오는 세 겹 파도
      for (const oy of [-6, 0, 6]) {
        ctx.beginPath();
        ctx.moveTo(x - 9, y + oy);
        ctx.quadraticCurveTo(x - 4, y + oy - 5, x, y + oy);
        ctx.quadraticCurveTo(x + 4, y + oy + 5, x + 9, y + oy);
        ctx.stroke();
      }
    } else if (type === 'treasure') {
      // 보물상자
      ctx.fillRect(x - 9, y - 2, 18, 9);
      ctx.beginPath();
      ctx.arc(x, y - 2, 9, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#0d0a12';
      ctx.fillRect(x - 1.5, y - 2, 3, 5);
    } else if (type === 'camp') {
      // 모닥불 불꽃
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.quadraticCurveTo(x + 8, y - 1, x + 5, y + 5);
      ctx.quadraticCurveTo(x + 3, y + 8, x, y + 8);
      ctx.quadraticCurveTo(x - 6, y + 7, x - 5, y + 1);
      ctx.quadraticCurveTo(x - 4, y - 3, x, y - 9);
      ctx.fill();
    } else if (type === 'boss') {
      // 해골
      ctx.beginPath();
      ctx.arc(x, y - 2, 8, Math.PI * 0.9, Math.PI * 0.1);
      ctx.fill();
      ctx.fillRect(x - 8, y - 2, 16, 6);
      ctx.fillRect(x - 5, y + 4, 3, 4);
      ctx.fillRect(x + 2, y + 4, 3, 4);
      ctx.fillStyle = '#0d0a12';
      ctx.beginPath();
      ctx.arc(x - 3.5, y - 2, 2.2, 0, Math.PI * 2);
      ctx.arc(x + 3.5, y - 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'event') {
      // 물음표 — 무엇이 기다릴까
      ctx.font = 'bold 18px Galmuri11, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', x, y + 6);
    } else if (type === 'merchant') {
      // 골드 주머니 — 장사꾼의 표식
      ctx.font = 'bold 17px Galmuri11, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('$', x, y + 6);
    } else if (type === 'trial') {
      // 느낌표 — 위험하지만 확실한 보상
      ctx.font = 'bold 18px Galmuri11, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', x, y + 6);
    } else if (type === 'nextfloor') {
      // 아래로 향하는 계단 화살표
      ctx.beginPath();
      ctx.moveTo(x, y + 8); ctx.lineTo(x - 8, y - 2); ctx.lineTo(x - 3, y - 2);
      ctx.lineTo(x - 3, y - 8); ctx.lineTo(x + 3, y - 8); ctx.lineTo(x + 3, y - 2);
      ctx.lineTo(x + 8, y - 2); ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  },
};
