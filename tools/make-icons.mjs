// Renders the Squeezy mascot app icons (PNG) with a tiny supersampling rasterizer. No dependencies.
import fs from 'node:fs';
import zlib from 'node:zlib';

function crc32(buf) { let c, crc = ~0; for (let i = 0; i < buf.length; i++) { c = (crc ^ buf[i]) & 255; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// scene in a 512x512 design space; `scale`/offset let the maskable variant shrink the content
function sample(x, y, maskable) {
  let col = [0, 0, 0, 0];
  const over = (c, a = 1) => { col = [c[0] * a + col[0] * (1 - a), c[1] * a + col[1] * (1 - a), c[2] * a + col[2] * (1 - a), Math.min(1, a + col[3] * (1 - a))]; };
  // rounded-square background (full-bleed for maskable)
  const r = 112, inRR = (() => { const dx = Math.max(Math.abs(x - 256) - (256 - r), 0), dy = Math.max(Math.abs(y - 256) - (256 - r), 0); return dx * dx + dy * dy <= r * r; })();
  if (maskable || inRR) over(mix(hex('#9b6bff'), hex('#ff3d92'), (x + y) / 1024));
  else return col;
  const s = maskable ? 0.78 : 1;
  const X = (x - 256) / s, Y = (y - 292 * (maskable ? 0.9 : 1) + (maskable ? 22 : 0)) / s + (maskable ? 0 : 0);
  const cx = X, cy = (y - (maskable ? 270 : 292)) / s;
  const circ = (px, py, rad) => (cx - px) ** 2 + (cy - py) ** 2 <= rad * rad;
  const ell = (px, py, rx, ry) => ((cx - px) / rx) ** 2 + ((cy - py) / ry) ** 2 <= 1;
  if (ell(0, 170, 130, 18)) over([0, 0, 0], 0.2); // shadow
  if (ell(30, -185, 75, 28) || ell(-50, -190, 55, 24)) over(hex('#4cd964')); // leaf
  if (circ(0, 0, 176)) over(hex('#b3410a')); // rim
  if (circ(0, 0, 166)) { const d = Math.hypot(cx + 60, cy + 70) / 260; over(d < 0.4 ? mix(hex('#ffd27a'), hex('#ff9f1c'), d / 0.4) : mix(hex('#ff9f1c'), hex('#e5560b'), Math.min(1, (d - 0.4) / 0.6))); }
  if (ell(-60, -92, 55, 28)) over([255, 255, 255], 0.4);
  if (circ(-105, 40, 24) || circ(105, 40, 24)) over(hex('#ff5d8f'), 0.5);
  if (circ(-62, -8, 27) || circ(62, -8, 27)) over(hex('#2a1250'));
  if (circ(-52, -18, 9) || circ(72, -18, 9)) over([255, 255, 255]);
  if (cy > 38 && cy < 118 && Math.abs(cx) < 74 && (cy - 38) < 80 * (1 - (cx / 74) ** 2) * 1.0 + 6 && cy > 44 + 14 * (cx / 74) ** 2 * 0) over(hex('#7a1f3d')); // mouth
  return col;
}
function render(size, maskable) {
  const buf = Buffer.alloc(size * size * 4), SS = 3;
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const c = sample(((px + (sx + 0.5) / SS) / size) * 512, ((py + (sy + 0.5) / SS) / size) * 512, maskable);
      r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3];
    }
    const o = (py * size + px) * 4, n = SS * SS;
    buf[o] = a ? r / a : 0; buf[o + 1] = a ? g / a : 0; buf[o + 2] = a ? b / a : 0; buf[o + 3] = (a / n) * 255;
  }
  return png(size, size, buf);
}
const out = new URL('../icons/', import.meta.url);
fs.writeFileSync(new URL('icon-192.png', out), render(192, false));
fs.writeFileSync(new URL('icon-512.png', out), render(512, false));
fs.writeFileSync(new URL('icon-maskable-512.png', out), render(512, true));
console.log('icons written');
