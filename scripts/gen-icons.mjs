/**
 * 生成 tabBar PNG 图标（纯 Node 实现，无外部依赖）
 * 输出: src/static/tabbar/{market,watchlist}{,-active}.png  (81x81)
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'src', 'static', 'tabbar');
mkdirSync(OUT, { recursive: true });

// ---------- PNG 编码 ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- 简易画布 ----------
const S = 81;
function canvas() {
  return { px: new Uint8Array(S * S * 4) };
}
function put(c, x, y, rgb, a = 255) {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const i = (y * S + x) * 4;
  const na = a / 255, oa = c.px[i + 3] / 255;
  const outA = na + oa * (1 - na);
  if (outA <= 0) return;
  for (let k = 0; k < 3; k++) {
    c.px[i + k] = Math.round((rgb[k] * na + c.px[i + k] * oa * (1 - na)) / outA);
  }
  c.px[i + 3] = Math.round(outA * 255);
}
function rect(c, x0, y0, w, h, rgb) {
  for (let y = Math.round(y0); y < y0 + h; y++)
    for (let x = Math.round(x0); x < x0 + w; x++) put(c, x, y, rgb);
}
function vline(c, x, y0, y1, w, rgb) {
  rect(c, x - w / 2, y0, w, y1 - y0, rgb);
}
function polygon(c, pts, rgb) {
  const minY = Math.floor(Math.min(...pts.map(p => p[1])));
  const maxY = Math.ceil(Math.max(...pts.map(p => p[1])));
  const minX = Math.floor(Math.min(...pts.map(p => p[0])));
  const maxX = Math.ceil(Math.max(...pts.map(p => p[0])));
  const inside = (x, y) => {
    let ok = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ok = !ok;
    }
    return ok;
  };
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++)
      if (inside(x + 0.5, y + 0.5)) put(c, x, y, rgb);
}

const GRAY = [153, 153, 153];
const RED = [231, 76, 60];

// ---------- 行情图标: 三根K线 ----------
function drawMarket(rgb) {
  const c = canvas();
  vline(c, 20, 10, 70, 5, rgb); rect(c, 12, 24, 17, 28, rgb);
  vline(c, 41, 6, 66, 5, rgb);  rect(c, 33, 18, 17, 34, rgb);
  vline(c, 62, 14, 74, 5, rgb); rect(c, 54, 28, 17, 26, rgb);
  return encodePNG(S, S, Buffer.from(c.px));
}
// ---------- 收藏图标: 五角星 ----------
function drawStar(rgb) {
  const c = canvas();
  const cx = 40.5, cy = 42, R = 32, r = 13.5;
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? R : r;
    pts.push([cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]);
  }
  polygon(c, pts, rgb);
  return encodePNG(S, S, Buffer.from(c.px));
}
// ---------- 学习图标: 打开的书 ----------
function drawBook(rgb) {
  const c = canvas();
  // 左右两页 + 中缝
  polygon(c, [[8, 18], [38, 12], [38, 66], [8, 70]], rgb);
  polygon(c, [[73, 18], [43, 12], [43, 66], [73, 70]], rgb);
  // 中缝镂空（用白色线覆盖视觉分隔）
  vline(c, 40.5, 12, 70, 4, [255, 255, 255]);
  return encodePNG(S, S, Buffer.from(c.px));
}
// ---------- 多元策略图标: 金字塔（三层） ----------
function drawPyramid(rgb) {
  const c = canvas();
  polygon(c, [[40.5, 8], [66, 34], [15, 34]], rgb);
  polygon(c, [[28, 38], [53, 38], [66, 62], [15, 62]], rgb);
  return encodePNG(S, S, Buffer.from(c.px));
}
// ---------- 量化图标: 上升折线 + 节点 ----------
function drawQuant(rgb) {
  const c = canvas();
  const pts = [[8, 66], [28, 44], [44, 54], [70, 14]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    for (let s = 0; s <= 24; s++) {
      const x = x0 + ((x1 - x0) * s) / 24;
      const y = y0 + ((y1 - y0) * s) / 24;
      rect(c, x - 1.5, y - 1.5, 3, 3, rgb);
    }
  }
  rect(c, 66, 8, 8, 8, rgb);
  rect(c, 24, 40, 8, 8, rgb);
  rect(c, 40, 50, 8, 8, rgb);
  return encodePNG(S, S, Buffer.from(c.px));
}

const files = {
  'market.png': drawMarket(GRAY),
  'market-active.png': drawMarket(RED),
  'watchlist.png': drawStar(GRAY),
  'watchlist-active.png': drawStar(RED),
  'learn.png': drawBook(GRAY),
  'learn-active.png': drawBook(RED),
  'strategy.png': drawPyramid(GRAY),
  'strategy-active.png': drawPyramid(RED),
  'quant.png': drawQuant(GRAY),
  'quant-active.png': drawQuant(RED),
};
for (const [name, buf] of Object.entries(files)) {
  writeFileSync(join(OUT, name), buf);
  console.log('OK', name, buf.length, 'bytes');
}
