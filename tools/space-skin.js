// ══════════════════════════════════════════════════════════════════════════
//  무늬 통로 검사 — 그림을 넣으면 **정말로 화면에 물리는가.**
//
//    python3 tools/serve.py 8391 &
//    node tools/space-skin.js [포트]
//
//  ★ 왜 그림도 없는데 이 검사를 만드나
//    그림이 오는 날 「넣었는데 아무 일도 안 일어난다」가 나면, 원인이
//    그림인지 코드인지 **그 자리에서는 못 가린다.** 이 저장소에서 제일
//    비싸게 친 실수가 그거다 (docs/POSTMORTEM.md §1-⑤).
//    그래서 코드 쪽은 미리 못박아 둔다 — 그림이 오면 남은 변수가 그림뿐이다.
//
//  ★ 색 공간이 이 검사의 핵심이다
//    색(map)은 sRGB, 굴곡·거칠기는 **선형**이다. 전부 sRGB 로 읽어도
//    오류가 안 나고 화면도 그럴싸하게 나온다 — 다만 거칠기가 감마만큼
//    어긋나 전체가 미끈해진다. **화면만 봐서는 절대 못 찾는다.**
//
//  ★ 임시 무늬는 넣었다 지운다 — 저장소에 안 남긴다
//    그림은 사장님이 주신다 (CLAUDE.md). 여기서 만드는 단색 판은 「그림」이
//    아니라 **통로에 물을 흘려 보는 것**이다. 끝나면 지운다.
//    같은 이름의 진짜 파일이 이미 있으면 **아무것도 안 하고 멈춘다** —
//    검사가 사장님 그림을 덮어쓰는 일은 없어야 한다.
// ══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { ASSETS, COMPANION } from '../web/space/js/core/asset-table.js';

/** 규격표의 **본체** 장수. 곁그림(`_n`·`_r`)은 빼고 센다 — assets.js 와 같은 셈 */
const ASSET_COUNT = Object.keys(ASSETS).filter((k) => !COMPANION.has(k)).length;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'web/space/assets/surf');
const PORT = process.argv[2] || '8391';

function crc32(buf) {
  let c, t = [];
  for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  let x = 0xffffffff;
  for (const b of buf) x = t[(x ^ b) & 0xff] ^ (x >>> 8);
  return (x ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** size x size RGB PNG, 한 가지 색 */
function png(size, rgb) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const o = y * (size * 3 + 1); raw[o] = 0;
    for (let x = 0; x < size; x++) { raw[o + 1 + x * 3] = rgb[0]; raw[o + 2 + x * 3] = rgb[1]; raw[o + 3 + x * 3] = rgb[2]; }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const FILES = {
  'hull_wall.png': png(512, [120, 128, 140]),
  'hull_wall_n.png': png(512, [128, 128, 255]),
  'hull_wall_r.png': png(512, [180, 180, 180]),
  'hull_wall_x.png': png(512, [255, 0, 0]),   // 규격표에 없는 이름 — 경고가 나야 한다
  'hull_floor.png': png(256, [60, 62, 66]),   // 규격은 512 — 크기 경고가 나야 한다
};

// ★ 진짜 그림이 있으면 손대지 않는다. 검사 하나 돌리자고 사장님이 주신
//   파일을 덮어쓰고 지우는 것보다는, 검사를 안 도는 쪽이 낫다.
const clash = Object.keys(FILES).filter((f) => fs.existsSync(path.join(DIR, f)));
if (clash.length) {
  console.error(`\n이미 그림이 있습니다 — 덮어쓰지 않고 멈춥니다:\n   ${clash.join(' ')}`);
  console.error('   (그림이 들어온 뒤엔 이 검사 대신 게임을 직접 보시면 됩니다)\n');
  process.exit(2);
}

fs.mkdirSync(DIR, { recursive: true });
for (const [f, buf] of Object.entries(FILES)) fs.writeFileSync(path.join(DIR, f), buf);

const PW = ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs'];
let chromium = null;
for (const m of PW) { try { ({ chromium } = await import(m)); break; } catch { /* 다음 */ } }
if (!chromium) {
  for (const f of Object.keys(FILES)) fs.rmSync(path.join(DIR, f), { force: true });
  console.error('playwright 가 없습니다.  npm i -g playwright  뒤에 다시 돌리세요.');
  process.exit(2);
}

let fail = 0;
const ok = (c, msg) => { console.log((c ? '  ✔ ' : '  ✘ ') + msg); if (!c) fail++; };
try {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  const logs = [], errs = [];
  p.on('console', (m) => logs.push(m.text()));
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${PORT}/space/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);

  const skin = await p.evaluate(() => SPACE.skin);
  console.log('\n[1] 색 + 곁그림 두 장이 벽에 물렸나');
  console.log('   ' + JSON.stringify(skin.wall));
  ok(skin.wall.maps.includes('map'), '색(map)');
  ok(skin.wall.maps.includes('normalMap'), '굴곡(normalMap)');
  ok(skin.wall.maps.includes('roughnessMap'), '거칠기(roughnessMap)');
  ok(skin.wall.space === 'srgb', '색은 sRGB');
  ok(skin.wall.linear === true, '굴곡·거칠기는 선형 (sRGB 로 읽으면 안 된다)');
  ok(String(skin.wall.repeat) === '2,1', '세 장의 반복이 같다 — ' + skin.wall.repeat);

  console.log('\n[2] 색만 온 면은 색만 쓴다');
  console.log('   ' + JSON.stringify(skin.floor));
  ok(skin.floor.maps.length === 1 && skin.floor.maps[0] === 'map', '바닥은 색 한 장');
  ok(skin.ceil.maps.length === 0, '천장은 아직 없다 — 민무늬');

  console.log('\n[3] 조용히 실패하지 않는다');
  ok(logs.some((l) => l.includes('규격표에 없는 이름') && l.includes('hull_wall_x')),
    '규격에 없는 이름을 말한다');
  ok(logs.some((l) => l.includes('크기가 규격과 다릅니다') && l.includes('hull_floor')),
    '크기가 다른 것을 말한다');
  const line = logs.filter((l) => /^\[assets\] \d+\//.test(l)).pop();
  console.log('   ' + line);
  // ★ **총 장수를 여기 안 적는다.** 「2/10장」이라고 박아 뒀더니 v28 에서
  //   손 그림 둘이 규격표에 늘면서 12장이 됐고, 검사만 빨개졌다 — 게임은
  //   멀쩡했다. 세는 것이 목적이 아니라 **곁그림을 본체와 섞어 안 세는가**가
  //   목적이므로, 총 장수는 규격표에서 읽는다
  const total = ASSET_COUNT;
  ok(new RegExp(`2/${total}장 \\(\\+곁그림 2장\\)`).test(line || ''),
    `곁그림을 따로 센다 — 본체 ${total}장과 안 섞는다`);

  ok(errs.length === 0, '오류 없음' + (errs.length ? ' — ' + errs.join(' / ') : ''));
  await b.close();
} finally {
  for (const f of Object.keys(FILES)) fs.rmSync(path.join(DIR, f), { force: true });
  console.log('\n(임시 무늬 지웠습니다)');
}
console.log(fail ? `\n✘ ${fail}개 실패` : '\n✔ 전부 통과');
process.exit(fail ? 1 : 0);
