// Small pixel-art toolkit: canvases, colors, outlines, dithering.
export const OUTLINE = '#1a1222';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export function shade(hex, f) { // f < 0 darker, f > 0 lighter
  const [r, g, b] = hexToRgb(hex);
  if (f < 0) return rgbToHex(r * (1 + f), g * (1 + f), b * (1 + f));
  return rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
}
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
export function luminance(hex) { const [r, g, b] = hexToRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
export function colorDistance(a, b) { const A = hexToRgb(a), B = hexToRgb(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); }

// 1px outline around every opaque pixel (classic 16-bit look)
export function outline(canvas, color = OUTLINE) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const op = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) op[i] = d[i * 4 + 3] > 40 ? 1 : 0;
  const [r, g, b] = hexToRgb(color);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (op[i]) continue;
    if ((x > 0 && op[i - 1]) || (x < w - 1 && op[i + 1]) || (y > 0 && op[i - w]) || (y < h - 1 && op[i + w])) {
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function flipped(canvas) {
  const [c, ctx] = makeCanvas(canvas.width, canvas.height);
  ctx.translate(canvas.width, 0); ctx.scale(-1, 1); ctx.drawImage(canvas, 0, 0);
  return c;
}

// pixel helpers on a 2d context
export const px = (ctx, x, y, col, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
export function disc(ctx, cx, cy, r, col) {
  ctx.fillStyle = col;
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(Math.max(0, r * r - y * y)) + 0.35);
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}
export function line(ctx, x0, y0, x1, y1, col, w = 1) {
  ctx.fillStyle = col;
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
    ctx.fillRect(Math.round(x - (w - 1) / 2), Math.round(y - (w - 1) / 2), w, w);
  }
}
export function poly(ctx, pts, col) {
  ctx.fillStyle = col; ctx.beginPath();
  pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath(); ctx.fill();
}
// ordered 2x2 dither between two colors inside a rect (t = share of color b, 0..1)
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function ditherRect(ctx, x, y, w, h, a, b, t) {
  ctx.fillStyle = a; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = b;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (BAYER4[((y + j) & 3) * 4 + ((x + i) & 3)] < t * 16) ctx.fillRect(x + i, y + j, 1, 1);
  }
}
// vertical banded gradient with dithered transitions (16-bit sky)
export function bandedGradient(ctx, x, y, w, h, stops, bands = 10) {
  const bh = h / bands;
  for (let i = 0; i < bands; i++) {
    const t0 = i / bands, t1 = (i + 1) / bands;
    const c0 = sample(stops, t0), c1 = sample(stops, t1);
    const yy = Math.round(y + i * bh), hh = Math.round(y + (i + 1) * bh) - yy;
    ctx.fillStyle = c0; ctx.fillRect(x, yy, w, hh);
    const dh = Math.min(4, hh);
    ditherRect(ctx, x, yy + hh - dh, w, dh, c0, c1, 0.5);
  }
}
function sample(stops, t) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [ta, ca] = stops[i], [tb, cb] = stops[i + 1];
    if (t <= tb) return mix(ca, cb, (t - ta) / Math.max(1e-6, tb - ta));
  }
  return stops[stops.length - 1][1];
}

// names in the pixel font: upper case, no accents (Ø -> O, ß -> SS …)
export function asciiUpper(s) {
  return s.replace(/[øØ]/g, 'O').replace(/ß/g, 'SS').replace(/[đĐ]/g, 'D').replace(/[æÆ]/g, 'AE').replace(/[łŁ]/g, 'L')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}
export function lastName(full) {
  const parts = full.split(' ');
  if (parts.length === 1) return full;
  const lower = ['van', 'de', 'der', 'den', 'del', 'da', 'di', 'le', 'la', 'von', 'el'];
  let i = parts.length - 1;
  while (i > 1 && lower.includes(parts[i - 1].toLowerCase())) i--;
  return parts.slice(i).join(' ');
}
