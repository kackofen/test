// Country worlds ("Themenpakete"): sky, parallax backgrounds with landmarks, ground,
// blocks, the national collectible and an animal/vehicle passing by.
// A new country = a new entry in THEMES (see makeGeneric for the fallback).
import { makeCanvas, shade, mix, disc, line, px, poly, bandedGradient, ditherRect, OUTLINE, outline } from './pixel.js';
import { makeRng, hashString } from '../shared/rng.js';

export const LAYER_W = 768, LAYER_H = 224;

// ------------------------------------------------------------------ scenery helpers
const periodic = (rng, W, n = 4) => {
  const waves = Array.from({ length: n }, (_, i) => ({ f: (i + 1) * (1 + Math.floor(rng() * 2)), a: 1 / (i + 1.2), p: rng() * Math.PI * 2 }));
  return x => waves.reduce((s, w) => s + Math.sin(x / W * Math.PI * 2 * w.f + w.p) * w.a, 0);
};
function ridge(ctx, W, base, amp, top, color, light, rng, opts = {}) {
  const f = periodic(rng, W, opts.waves || 4);
  const H = [];
  for (let x = 0; x < W; x++) H[x] = Math.round(top + (1 - (f(x) + 1.8) / 3.6) * amp);
  for (let x = 0; x < W; x++) {
    const h = H[x];
    ctx.fillStyle = color; ctx.fillRect(x, h, 1, base - h);
    const slope = H[(x + 1) % W] - h;
    if (slope > 0 && light) { ctx.fillStyle = light; ctx.fillRect(x, h, 1, Math.min(6, 2 + slope * 2)); }
    if (opts.snow && h < top + amp * opts.snow) {
      ctx.fillStyle = '#f4f8ff'; ctx.fillRect(x, h, 1, Math.max(2, Math.round((top + amp * opts.snow - h) * 0.7)));
      ctx.fillStyle = '#c9d8f0'; if (slope < 0) ctx.fillRect(x, h, 1, Math.max(1, Math.round((top + amp * opts.snow - h) * 0.5)));
    }
  }
  if (opts.outlineTop) for (let x = 0; x < W; x++) px(ctx, x, H[x], opts.outlineTop);
  return H;
}
function wrapDraw(W, x, w, fn) { fn(x); if (x + w > W) fn(x - W); if (x < 0) fn(x + W); }
function clouds(ctx, W, rng, n, col = '#ffffff', shadeCol = '#d9e6f5', yMin = 14, yMax = 70) {
  for (let i = 0; i < n; i++) {
    const x = rng() * W, y = yMin + rng() * (yMax - yMin), s = 6 + rng() * 9;
    wrapDraw(W, x - s * 3, s * 6, xx => {
      const cx = xx + s * 3;
      disc(ctx, cx, y + 2, s * 0.9, shadeCol); disc(ctx, cx - s * 1.4, y + 3, s * 0.7, shadeCol); disc(ctx, cx + s * 1.5, y + 3, s * 0.65, shadeCol);
      disc(ctx, cx, y, s * 0.9, col); disc(ctx, cx - s * 1.4, y + 1.5, s * 0.7, col); disc(ctx, cx + s * 1.5, y + 2, s * 0.6, col);
      px(ctx, cx - s * 2, y + s * 0.6, shadeCol, s * 4, 2);
    });
  }
}
function windows(ctx, x, y, w, h, wallCol, winCol, rng, gx = 3, gy = 4) {
  px(ctx, x, y, wallCol, w, h);
  px(ctx, x, y, shade(wallCol, 0.12), 1, h);
  for (let yy = y + 2; yy < y + h - 2; yy += gy) for (let xx = x + 2; xx < x + w - 1; xx += gx) if (rng() < 0.8) px(ctx, xx, yy, winCol, 1, 2);
}
function skyline(ctx, W, base, rng, cols, n, hMin, hMax, wMin = 10, wMax = 24) {
  for (let i = 0; i < n; i++) {
    const w = Math.round(wMin + rng() * (wMax - wMin)), h = Math.round(hMin + rng() * (hMax - hMin)), x = Math.round(rng() * W);
    const col = cols[Math.floor(rng() * cols.length)];
    wrapDraw(W, x, w, xx => windows(ctx, xx, base - h, w, h, col, shade(col, 0.35), rng));
  }
}
function pine(ctx, x, base, h, col, snow) {
  const dark = shade(col, -0.3);
  px(ctx, x - 1, base - 4, '#4a3426', 2, 4);
  for (let i = 0; i < 3; i++) {
    const y0 = base - 4 - i * h / 3.4, hw = (3 - i) * h / 7;
    poly(ctx, [[x, y0 - h / 2.6], [x - hw, y0], [x + hw, y0]], col);
    poly(ctx, [[x, y0 - h / 2.6], [x - hw, y0], [x - hw * 0.3, y0]], dark);
    if (snow) px(ctx, x - hw * 0.4, y0 - h / 6, '#f2f6ff', hw * 0.6, 1);
  }
}
function roundTree(ctx, x, base, r, col, trunk = '#5d4030') {
  px(ctx, x - 1, base - r - 2, trunk, 3, r + 2);
  disc(ctx, x, base - r * 1.6, r, shade(col, -0.25)); disc(ctx, x - r * 0.5, base - r * 1.9, r * 0.75, col); disc(ctx, x + r * 0.4, base - r * 2.1, r * 0.6, shade(col, 0.15));
}
function palm(ctx, x, base, h, col = '#3f8f3a') {
  for (let i = 0; i < h; i++) px(ctx, x + Math.sin(i / h * 1.6) * 3, base - i, i % 3 ? '#8a6038' : '#6d4a2a', 2, 1);
  const tx = x + Math.sin(1.6) * 3, ty = base - h;
  for (const [dx, dy] of [[-9, 3], [-7, -2], [0, -4], [7, -2], [9, 3], [5, 5], [-5, 5]]) line(ctx, tx, ty, tx + dx, ty + dy, col, 2);
  disc(ctx, tx, ty + 1, 1.5, '#6d4a2a');
}
function water(ctx, W, y, h, col, light) {
  px(ctx, 0, y, col, W, h);
  for (let i = 0; i < W / 6; i++) px(ctx, (i * 37) % W, y + 2 + (i * 7) % Math.max(1, h - 3), light, 3 + (i % 3), 1);
}
function crowdStand(ctx, W, top, h, colsA, colsB, rng) {
  px(ctx, 0, top, '#2b2f3a', W, h);
  for (let y = top + 2; y < top + h - 1; y += 3) for (let x = (y % 2); x < W; x += 2) {
    const side = x < W / 2 ? colsA : colsB;
    px(ctx, x, y, rng() < 0.75 ? side[Math.floor(rng() * side.length)] : '#d9b38c', 1, 2);
  }
  px(ctx, 0, top, '#4a5060', W, 1);
}

// ------------------------------------------------------------------ landmarks (pixel drawings)
const LM = {
  skyTower(ctx, x, base) {
    px(ctx, x - 1, base - 120, '#c9ccd4', 3, 120); px(ctx, x - 1, base - 120, '#e9ebf0', 1, 120);
    px(ctx, x - 6, base - 92, '#aeb3bf', 13, 6); px(ctx, x - 5, base - 98, '#d7dae2', 11, 6); px(ctx, x - 4, base - 101, '#aeb3bf', 9, 3);
    px(ctx, x - 5, base - 96, '#3c6a8c', 11, 2); px(ctx, x, base - 140, '#9aa0ad', 1, 22); px(ctx, x - 7, base - 20, '#9aa0ad', 15, 20);
  },
  volcano(ctx, x, base, w, h, col) { poly(ctx, [[x - w / 2, base], [x - w / 8, base - h], [x + w / 8, base - h], [x + w / 2, base]], col); poly(ctx, [[x - w / 8, base - h], [x + w / 8, base - h], [x + w / 2, base], [x + w / 5, base]], shade(col, -0.18)); },
  fern(ctx, x, base, h, col) {
    for (let i = 0; i < h; i++) { const yy = base - i; px(ctx, x + Math.sin(i / h * 2) * 4, yy, shade(col, -0.2), 1, 1);
      if (i % 2 === 0) { const l = (1 - i / h) * 6 + 1; line(ctx, x + Math.sin(i / h * 2) * 4, yy, x + Math.sin(i / h * 2) * 4 - l, yy + 2, col); line(ctx, x + Math.sin(i / h * 2) * 4, yy, x + Math.sin(i / h * 2) * 4 + l, yy + 2, shade(col, 0.15)); } }
  },
  staveChurch(ctx, x, base) {
    const w = '#4a2e1c', d = '#2e1b10', r = '#6b3f22';
    px(ctx, x - 14, base - 18, w, 28, 18);
    for (let i = 0; i < 4; i++) { const y = base - 18 - i * 11, hw = 18 - i * 4; poly(ctx, [[x - hw, y], [x, y - 12], [x + hw, y]], i % 2 ? r : d); px(ctx, x - hw + 4, y - 3, w, hw * 2 - 8, 3); }
    line(ctx, x, base - 66, x, base - 74, d, 1); line(ctx, x - 14, base - 30, x - 18, base - 34, d, 1); line(ctx, x + 14, base - 30, x + 18, base - 34, d, 1);
    px(ctx, x - 3, base - 10, '#f2c04e', 6, 10);
  },
  redHouses(ctx, x, base, rng) {
    for (let i = 0; i < 3; i++) { const xx = x + i * 16, h = 12 + rng() * 6; px(ctx, xx, base - h, '#a4262c', 14, h); px(ctx, xx, base - h, '#c43c3c', 2, h);
      poly(ctx, [[xx - 1, base - h], [xx + 7, base - h - 7], [xx + 15, base - h]], '#3b2a26'); px(ctx, xx + 5, base - h + 4, '#f7e3a1', 3, 3); px(ctx, xx + 2, base, '#4a3426', 1, 3); px(ctx, xx + 11, base, '#4a3426', 1, 3); }
  },
  brandenburg(ctx, x, base) {
    const s = '#e2d3b0', d = '#bba67a';
    px(ctx, x - 32, base - 10, s, 64, 10); px(ctx, x - 36, base - 42, s, 72, 8); px(ctx, x - 30, base - 50, d, 60, 8); px(ctx, x - 34, base - 34, d, 68, 2);
    for (let i = 0; i < 6; i++) { const cx = x - 30 + i * 12; px(ctx, cx, base - 34, s, 4, 24); px(ctx, cx, base - 34, '#f3e8cf', 1, 24); }
    px(ctx, x - 8, base - 58, '#3d6b5a', 16, 8); px(ctx, x - 6, base - 62, '#3d6b5a', 4, 4); px(ctx, x + 2, base - 62, '#3d6b5a', 4, 4); px(ctx, x - 1, base - 66, '#3d6b5a', 2, 6);
  },
  tvTower(ctx, x, base) {
    px(ctx, x - 2, base - 130, '#c8ccd2', 5, 130); px(ctx, x - 2, base - 130, '#e8ebef', 1, 130);
    disc(ctx, x, base - 128, 9, '#9aa3ad'); disc(ctx, x - 2, base - 130, 5, '#c3cad3'); px(ctx, x - 9, base - 128, '#4c5966', 19, 2);
    px(ctx, x, base - 160, '#e04a3a', 1, 6); px(ctx, x, base - 154, '#d6dade', 1, 16); px(ctx, x - 5, base - 14, '#9aa3ad', 11, 14);
  },
  fachwerk(ctx, x, base, rng) {
    for (let i = 0; i < 3; i++) { const xx = x + i * 22, h = 26 + Math.floor(rng() * 8);
      px(ctx, xx, base - h, '#f3ead8', 20, h); for (let k = 0; k < 20; k += 6) px(ctx, xx + k, base - h, '#5a3a24', 2, h);
      px(ctx, xx, base - h, '#5a3a24', 20, 2); px(ctx, xx, base - h / 2, '#5a3a24', 20, 2); line(ctx, xx, base - h, xx + 6, base - h / 2, '#5a3a24', 1);
      poly(ctx, [[xx - 2, base - h], [xx + 10, base - h - 14], [xx + 22, base - h]], '#a8402e'); px(ctx, xx + 8, base - h + 6, '#7fb4d9', 3, 4); }
  },
  koutoubia(ctx, x, base) {
    const s = '#d39a62', d = '#a86f3e';
    px(ctx, x - 10, base - 110, s, 20, 110); px(ctx, x - 10, base - 110, shade(s, 0.12), 3, 110);
    for (let y = base - 100; y < base - 20; y += 26) { px(ctx, x - 5, y, d, 10, 14); px(ctx, x - 3, y + 2, '#6b3f22', 6, 10); }
    for (let k = -10; k < 10; k += 4) px(ctx, x + k, base - 114, s, 2, 4);
    px(ctx, x - 5, base - 130, s, 10, 16); px(ctx, x - 3, base - 126, d, 6, 8); px(ctx, x - 4, base - 133, '#3f8f6a', 8, 3);
    px(ctx, x, base - 146, '#e7c14b', 1, 13); disc(ctx, x, base - 137, 1.5, '#e7c14b'); disc(ctx, x, base - 141, 1.2, '#e7c14b'); disc(ctx, x, base - 144, 1, '#e7c14b');
  },
  riadWall(ctx, x, base, w) {
    px(ctx, x, base - 30, '#e0b07a', w, 30); for (let k = 0; k < w; k += 4) px(ctx, x + k, base - 33, '#e0b07a', 2, 3);
    for (let k = 6; k < w - 10; k += 18) { px(ctx, x + k, base - 22, '#7a4a2a', 10, 22); disc(ctx, x + k + 5, base - 22, 5, '#7a4a2a'); px(ctx, x + k + 1, base - 20, '#2f6b8f', 8, 2); }
  },
  operaHouse(ctx, x, base) {
    px(ctx, x - 40, base - 8, '#c9b48e', 80, 8);
    const sail = (sx, h, w) => { poly(ctx, [[sx, base - 8], [sx + w * 0.2, base - 8 - h], [sx + w, base - 8]], '#f4f1e8'); poly(ctx, [[sx + w * 0.2, base - 8 - h], [sx + w * 0.35, base - 8 - h * 0.9], [sx + w, base - 8], [sx + w * 0.8, base - 8]], '#d7d2c4'); };
    sail(x - 36, 26, 22); sail(x - 18, 34, 26); sail(x + 4, 28, 22); sail(x + 20, 20, 18);
  },
  harbourBridge(ctx, x, base, w) {
    const g = '#6f7d8c';
    for (let i = 0; i <= 40; i++) { const t = i / 40, xx = x + t * w, yy = base - 30 - Math.sin(t * Math.PI) * 34; px(ctx, xx, yy, g, 2, 2); if (i % 4 === 0) px(ctx, xx, yy, shade(g, -0.2), 1, base - 26 - yy); }
    px(ctx, x - 10, base - 28, g, w + 20, 3); px(ctx, x - 12, base - 46, '#c9b48e', 10, 46); px(ctx, x + w + 2, base - 46, '#c9b48e', 10, 46);
  },
  uluru(ctx, x, base) { poly(ctx, [[x - 60, base], [x - 50, base - 26], [x - 30, base - 34], [x + 30, base - 34], [x + 52, base - 22], [x + 62, base]], '#c2552b');
    for (let i = -48; i < 50; i += 9) line(ctx, x + i, base - 30, x + i - 3, base, '#a8441f', 1); px(ctx, x - 30, base - 34, '#de7a45', 60, 2); },
  gumTree(ctx, x, base, h) {
    line(ctx, x, base, x + 2, base - h, '#e8dccb', 3); line(ctx, x + 2, base - h * 0.6, x - 8, base - h * 0.9, '#d8cab4', 2); line(ctx, x + 2, base - h * 0.7, x + 10, base - h, '#d8cab4', 2);
    disc(ctx, x - 8, base - h - 2, 7, '#6b8f5a'); disc(ctx, x + 10, base - h - 4, 8, '#7a9e66'); disc(ctx, x + 2, base - h - 8, 9, '#6b8f5a');
  },
  eiffel(ctx, x, base) {
    const c = '#8a6a4a', d = '#6a4e36';
    for (let y = 0; y < 150; y++) {
      const t = y / 150, hw = Math.max(1.5, 38 * Math.pow(1 - t, 2.2) + 2);
      if (y < 40) { px(ctx, x - hw, base - y, c, 4, 1); px(ctx, x + hw - 4, base - y, d, 4, 1); if (y > 8 && y < 34) { const aw = (hw - 4) * Math.sin((y - 8) / 26 * Math.PI) ; } }
      else { px(ctx, x - hw, base - y, c, hw, 1); px(ctx, x, base - y, d, hw, 1); if (y % 4 === 0) px(ctx, x - hw + 1, base - y, '#b08a62', hw * 2 - 2, 1); }
    }
    for (let i = 0; i < 18; i++) { const t = i / 18; const xx = x - 30 + t * 60; px(ctx, xx, base - 22 - Math.sin(t * Math.PI) * 12, c, 2, 2); }
    px(ctx, x - 20, base - 40, c, 40, 3); px(ctx, x - 9, base - 88, c, 18, 2); px(ctx, x, base - 165, d, 1, 16);
  },
  haussmann(ctx, x, base, rng) {
    for (let i = 0; i < 4; i++) { const xx = x + i * 26, h = 36 + Math.floor(rng() * 6);
      px(ctx, xx, base - h, '#efe3c8', 24, h); px(ctx, xx, base - h, '#fbf3e0', 2, h);
      for (let fy = base - h + 6; fy < base - 6; fy += 9) for (let fx = xx + 3; fx < xx + 22; fx += 5) { px(ctx, fx, fy, '#59708a', 3, 5); px(ctx, fx - 1, fy + 5, '#2b2b33', 5, 1); }
      poly(ctx, [[xx - 1, base - h], [xx + 3, base - h - 10], [xx + 21, base - h - 10], [xx + 25, base - h]], '#5d6f86');
      px(ctx, xx + 6, base - h - 16, '#a6624a', 3, 6); px(ctx, xx + 16, base - h - 15, '#a6624a', 3, 5); px(ctx, xx + 8, base - h - 7, '#d9dfe8', 3, 3); }
  },
  windmill(ctx, x, base, ang = 0.4) {
    poly(ctx, [[x - 7, base], [x - 5, base - 32], [x + 5, base - 32], [x + 7, base]], '#f6f2ea'); px(ctx, x - 7, base - 32, '#d9d2c4', 2, 32);
    poly(ctx, [[x - 7, base - 32], [x, base - 42], [x + 7, base - 32]], '#2b2b33'); px(ctx, x - 1, base - 12, '#5b3a22', 3, 6);
    for (let k = 0; k < 4; k++) { const a = ang + k * Math.PI / 2; line(ctx, x, base - 34, x + Math.cos(a) * 20, base - 34 + Math.sin(a) * 20, '#6b5040', 1);
      line(ctx, x + Math.cos(a) * 6, base - 34 + Math.sin(a) * 6, x + Math.cos(a) * 20 + Math.cos(a + 1.57) * 3, base - 34 + Math.sin(a) * 20 + Math.sin(a + 1.57) * 3, '#d8cdb8', 2); }
  },
  sagrada(ctx, x, base) {
    const s = '#c9a77a', d = '#a6845a';
    px(ctx, x - 36, base - 30, s, 72, 30);
    const spire = (sx, h, w) => { poly(ctx, [[sx - w, base - 30], [sx - w * 0.6, base - 30 - h * 0.7], [sx, base - 30 - h], [sx + w * 0.6, base - 30 - h * 0.7], [sx + w, base - 30]], s);
      for (let yy = base - 34; yy > base - 30 - h * 0.7; yy -= 6) px(ctx, sx - 1, yy, d, 2, 3); disc(ctx, sx, base - 30 - h, 2, '#e3b04b'); };
    spire(x - 28, 50, 6); spire(x - 14, 68, 7); spire(x + 14, 68, 7); spire(x + 28, 50, 6); spire(x, 96, 8);
    px(ctx, x - 6, base - 22, '#5a4632', 12, 22);
  },
  orangeTree(ctx, x, base) { roundTree(ctx, x, base, 9, '#3f7f3a'); for (const [dx, dy] of [[-5, -16], [3, -20], [6, -13], [-2, -10], [-7, -22]]) px(ctx, x + dx, base + dy, '#f7931e', 2, 2); },
  bigBen(ctx, x, base) {
    const s = '#d5bf8e', d = '#a98f5c';
    px(ctx, x - 9, base - 120, s, 18, 120); px(ctx, x - 9, base - 120, shade(s, 0.12), 2, 120);
    for (let y = base - 110; y < base - 10; y += 7) px(ctx, x - 6, y, d, 12, 3);
    px(ctx, x - 11, base - 136, s, 22, 18); disc(ctx, x, base - 127, 7, '#f6f1e2'); disc(ctx, x, base - 127, 6, '#fbf8ef');
    line(ctx, x, base - 127, x, base - 131, OUTLINE); line(ctx, x, base - 127, x + 3, base - 126, OUTLINE);
    poly(ctx, [[x - 11, base - 136], [x, base - 166], [x + 11, base - 136]], '#5b6b5e'); px(ctx, x, base - 172, '#d4af37', 1, 7);
  },
  towerBridge(ctx, x, base) {
    const s = '#c9b48e', b = '#6fa3c4';
    for (const tx of [x - 30, x + 18]) { px(ctx, tx, base - 70, s, 14, 70); px(ctx, tx, base - 70, shade(s, 0.15), 2, 70);
      poly(ctx, [[tx - 1, base - 70], [tx + 7, base - 88], [tx + 15, base - 70]], '#4f5d6e'); px(ctx, tx + 5, base - 60, '#4f5d6e', 4, 8); px(ctx, tx + 5, base - 40, '#4f5d6e', 4, 8); }
    px(ctx, x - 16, base - 62, b, 34, 4); px(ctx, x - 16, base - 58, shade(b, -0.25), 34, 2);
    px(ctx, x - 60, base - 24, b, 120, 4); line(ctx, x - 60, base - 40, x - 30, base - 64, b, 1); line(ctx, x + 32, base - 64, x + 60, base - 40, b, 1);
  },
  phoneBox(ctx, x, base) { px(ctx, x, base - 20, '#c8102e', 9, 20); px(ctx, x + 2, base - 15, '#e8eef2', 5, 9); px(ctx, x - 1, base - 22, '#a00c24', 11, 2); px(ctx, x + 1, base - 19, '#f6f6f6', 7, 1); },
};

// ------------------------------------------------------------------ ambient animals / vehicles
const ANIMALS = {
  kiwi(ctx) { disc(ctx, 7, 7, 5, '#7a5a3a'); disc(ctx, 6, 6, 3, '#94704a'); line(ctx, 11, 6, 16, 9, '#e0c9a0', 1); px(ctx, 10, 5, OUTLINE); px(ctx, 5, 11, '#e0a070', 1, 3); px(ctx, 8, 11, '#e0a070', 1, 3); return [18, 15]; },
  moose(ctx) { px(ctx, 4, 8, '#5a3a24', 16, 8); px(ctx, 18, 4, '#5a3a24', 5, 6); px(ctx, 21, 6, '#4a2e1c', 3, 3); for (const lx of [5, 8, 15, 18]) px(ctx, lx, 16, '#3e2716', 2, 7);
    line(ctx, 18, 4, 15, 0, '#d8c39a', 1); line(ctx, 15, 0, 13, 1, '#d8c39a', 1); line(ctx, 21, 4, 24, 0, '#d8c39a', 1); line(ctx, 24, 0, 26, 1, '#d8c39a', 1); return [28, 24]; },
  dachshund(ctx) { px(ctx, 3, 5, '#8a4b20', 14, 5); px(ctx, 15, 3, '#8a4b20', 5, 4); px(ctx, 19, 5, '#6a3714', 2, 2); px(ctx, 15, 4, '#5a2c0e', 2, 4); px(ctx, 1, 4, '#8a4b20', 3, 1);
    for (const lx of [4, 7, 13, 16]) px(ctx, lx, 10, '#6a3714', 2, 3); px(ctx, 18, 4, OUTLINE); return [22, 14]; },
  camel(ctx) { px(ctx, 5, 10, '#c9995a', 16, 7); disc(ctx, 9, 9, 3, '#c9995a'); disc(ctx, 16, 9, 3, '#c9995a'); line(ctx, 21, 11, 25, 4, '#c9995a', 3); px(ctx, 24, 2, '#c9995a', 5, 3);
    for (const lx of [6, 9, 17, 20]) px(ctx, lx, 17, '#a87a40', 2, 8); px(ctx, 27, 3, OUTLINE); return [30, 26]; },
  kangaroo(ctx) { disc(ctx, 9, 12, 5, '#b8774a'); px(ctx, 11, 4, '#b8774a', 4, 6); px(ctx, 13, 2, '#b8774a', 4, 4); px(ctx, 13, 0, '#a0623a', 1, 3); px(ctx, 16, 3, OUTLINE);
    line(ctx, 5, 15, 0, 20, '#a0623a', 2); px(ctx, 8, 16, '#a0623a', 6, 3); px(ctx, 12, 19, '#a0623a', 6, 2); px(ctx, 14, 9, '#a0623a', 3, 1); return [20, 22]; },
  rooster(ctx) { disc(ctx, 7, 8, 4, '#f2f2f2'); px(ctx, 9, 2, '#f2f2f2', 3, 5); px(ctx, 9, 0, '#e03a2f', 3, 2); px(ctx, 12, 4, '#f2b53a', 2, 1); px(ctx, 11, 3, OUTLINE);
    line(ctx, 3, 7, 0, 2, '#1f4fa8', 2); line(ctx, 3, 8, 1, 4, '#e03a2f', 1); px(ctx, 6, 12, '#f2b53a', 1, 3); px(ctx, 8, 12, '#f2b53a', 1, 3); return [15, 16]; },
  bull(ctx) { px(ctx, 3, 6, '#2b2224', 15, 7); px(ctx, 16, 4, '#2b2224', 6, 6); line(ctx, 17, 4, 15, 1, '#e8e0d0', 1); line(ctx, 21, 4, 23, 1, '#e8e0d0', 1); px(ctx, 1, 6, '#2b2224', 2, 4);
    for (const lx of [4, 7, 13, 16]) px(ctx, lx, 13, '#1f181a', 2, 5); return [25, 19]; },
  bus(ctx) { px(ctx, 1, 2, '#c8102e', 30, 18); px(ctx, 1, 10, '#a00c24', 30, 1); for (let x = 3; x < 29; x += 5) { px(ctx, x, 4, '#d8e4ec', 4, 4); px(ctx, x, 12, '#d8e4ec', 4, 4); }
    px(ctx, 1, 18, '#2b2b2b', 30, 2); disc(ctx, 7, 20, 2, '#1b1b1b'); disc(ctx, 25, 20, 2, '#1b1b1b'); px(ctx, 28, 12, '#f7d774', 2, 2); return [33, 24]; },
};
export function animalSprite(kind) {
  if (!ANIMALS[kind]) return null;
  const [c, ctx] = makeCanvas(34, 28);
  ctx.translate(1, 1);
  ANIMALS[kind](ctx);
  return outline(c);
}

// ------------------------------------------------------------------ tiles
function tileCanvas() { return makeCanvas(16, 16); }
function speckle(ctx, rng, n, cols, x0 = 0, y0 = 0, w = 16, h = 16) { for (let i = 0; i < n; i++) px(ctx, x0 + Math.floor(rng() * w), y0 + Math.floor(rng() * h), cols[Math.floor(rng() * cols.length)], 1 + (rng() < 0.3 ? 1 : 0), 1); }

function makeTiles(g, rng) {
  const top = [], fill = [];
  for (let v = 0; v < 3; v++) {
    const [c, ctx] = tileCanvas();
    px(ctx, 0, 0, g.fill, 16, 16);
    speckle(ctx, rng, 10, [g.fillDark, shade(g.fill, 0.1)], 0, 5, 16, 11);
    if (g.style === 'snow') {
      px(ctx, 0, 0, '#f4f8ff', 16, 5); px(ctx, 0, 4, '#c9d8f0', 16, 2);
      for (let x = 0; x < 16; x += 3 + v) px(ctx, x, 5 + (x % 2), '#f4f8ff', 2, 2); px(ctx, 2 + v * 3, 1, '#ffffff', 3, 1);
    } else if (g.style === 'sand') {
      px(ctx, 0, 0, g.top, 16, 5); ditherRect(ctx, 0, 4, 16, 3, g.top, g.fill, 0.5);
      speckle(ctx, rng, 6, [g.topLight, shade(g.top, -0.12)], 0, 0, 16, 4);
    } else if (g.style === 'cobble') {
      px(ctx, 0, 0, '#8e8a86', 16, 6);
      for (let x = (v % 2) * 2; x < 16; x += 4) { px(ctx, x, 1, '#b4afa8', 3, 2); px(ctx, x + 2, 4, '#a7a29b', 3, 1); }
      px(ctx, 0, 0, g.top, 16, 2); px(ctx, 0, 0, g.topLight, 16, 1);
    } else { // grass / dry grass / red earth
      px(ctx, 0, 0, g.top, 16, 4);
      for (let x = 0; x < 16; x++) { const d = (x * 7 + v * 5) % 5; if (d < 2) px(ctx, x, 4, g.top, 1, 1 + (d % 2)); }
      for (let x = v; x < 16; x += 4) px(ctx, x, 0, g.topLight, 2, 1);
      px(ctx, 0, 3, shade(g.top, -0.18), 16, 1);
      if (g.flowers && v === 2) { px(ctx, 4, 1, g.flowers, 1, 1); px(ctx, 11, 2, '#ffffff', 1, 1); }
    }
    top.push(c);
  }
  for (let v = 0; v < 2; v++) {
    const [c, ctx] = tileCanvas();
    px(ctx, 0, 0, g.fill, 16, 16);
    speckle(ctx, rng, 12, [g.fillDark, shade(g.fill, 0.1)]);
    if (g.rocks) { disc(ctx, 4 + v * 7, 9, 2, g.fillDark); px(ctx, 3 + v * 7, 8, shade(g.fill, 0.18), 2, 1); }
    fill.push(c);
  }
  return { top, fill };
}

function makeBlock(b, rng) {
  const [c, ctx] = tileCanvas();
  const base = b.color, dk = shade(base, -0.28), lt = shade(base, 0.22);
  px(ctx, 0, 0, base, 16, 16);
  switch (b.style) {
    case 'brick':
      for (let r = 0; r < 4; r++) { px(ctx, 0, r * 4 + 3, b.mortar || '#d8cfc3', 16, 1); const off = r % 2 ? 4 : 0; for (let x = off; x < 16; x += 8) px(ctx, x, r * 4, b.mortar || '#d8cfc3', 1, 3); }
      speckle(ctx, rng, 6, [dk, lt]); break;
    case 'ice':
      px(ctx, 0, 0, lt, 16, 2); px(ctx, 0, 0, lt, 2, 16); line(ctx, 3, 12, 11, 3, '#ffffff', 1); line(ctx, 6, 13, 13, 6, shade(base, 0.35), 1); px(ctx, 0, 14, dk, 16, 2); px(ctx, 14, 0, dk, 2, 16); break;
    case 'zellige':
      px(ctx, 0, 0, '#f2ead8', 16, 16);
      poly(ctx, [[8, 1], [15, 8], [8, 15], [1, 8]], b.color); poly(ctx, [[8, 4], [12, 8], [8, 12], [4, 8]], b.accent || '#2f6b8f'); disc(ctx, 8, 8, 1.5, '#f2c04e');
      px(ctx, 0, 0, b.accent || '#2f6b8f', 2, 2); px(ctx, 14, 0, b.accent || '#2f6b8f', 2, 2); px(ctx, 0, 14, b.accent || '#2f6b8f', 2, 2); px(ctx, 14, 14, b.accent || '#2f6b8f', 2, 2); break;
    case 'terracotta':
      for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) { px(ctx, k * 8, r * 8, shade(base, (r + k) % 2 ? -0.1 : 0.05), 8, 8); px(ctx, k * 8, r * 8, lt, 8, 1); px(ctx, k * 8, r * 8 + 7, dk, 8, 1); px(ctx, k * 8 + 7, r * 8, dk, 1, 8); } break;
    case 'lava':
      speckle(ctx, rng, 20, [dk, shade(base, 0.12), '#5b5f66']); px(ctx, 0, 0, lt, 16, 1); px(ctx, 0, 15, dk, 16, 1); break;
    default: // stone / sandstone / limestone
      px(ctx, 0, 0, lt, 16, 2); px(ctx, 0, 0, lt, 2, 16); px(ctx, 0, 14, dk, 16, 2); px(ctx, 14, 0, dk, 2, 16);
      px(ctx, 0, 7, dk, 16, 1); px(ctx, 7, 0, dk, 1, 7); px(ctx, 11, 8, dk, 1, 6); speckle(ctx, rng, 8, [dk, lt], 2, 2, 12, 12);
  }
  return c;
}
function makeLedge(l) {
  const [c, ctx] = makeCanvas(16, 7);
  px(ctx, 0, 0, l.color, 16, 5); px(ctx, 0, 0, shade(l.color, 0.25), 16, 1); px(ctx, 0, 4, shade(l.color, -0.3), 16, 1);
  px(ctx, 7, 1, shade(l.color, -0.2), 1, 3); px(ctx, 15, 1, shade(l.color, -0.2), 1, 3);
  if (l.style === 'iron') { px(ctx, 0, 5, '#2b2b33', 16, 2); for (let x = 1; x < 16; x += 3) px(ctx, x, 5, '#4a4a55', 1, 2); }
  else { px(ctx, 2, 5, shade(l.color, -0.4), 2, 2); px(ctx, 12, 5, shade(l.color, -0.4), 2, 2); }
  return c;
}
export function makeBannerTile(kit) {
  const [c, ctx] = makeCanvas(16, 7);
  for (let x = 0; x < 16; x++) px(ctx, x, 0, (x >> 2) % 2 ? kit.shirt : kit.shorts, 1, 5);
  px(ctx, 0, 0, '#ffffff', 16, 1); px(ctx, 0, 4, shade(kit.shirt, -0.35), 16, 1); px(ctx, 3, 5, '#c9c9d4', 1, 2); px(ctx, 12, 5, '#c9c9d4', 1, 2);
  return c;
}

// ------------------------------------------------------------------ theme packs
const THEMES = {
  NZL: {
    item: 'kiwi', animal: 'kiwi', animalMode: 'walk',
    sky: [[0, '#2f7fd1'], [0.6, '#7cc0f2'], [1, '#c9ecff']], sun: '#fff6c9',
    ground: { style: 'grass', top: '#46a13a', topLight: '#7ed35c', fill: '#5a3f2b', fillDark: '#3f2b1d', rocks: true, flowers: '#d6302f' },
    block: { style: 'lava', color: '#575c63' }, ledge: { color: '#9a6a3c' }, props: ['fern', 'flax'],
    far(ctx, W, rng) { ridge(ctx, W, 200, 60, 92, '#4b8a6a', '#6fae86', rng); for (let i = 0; i < 2; i++) LM.volcano(ctx, 140 + i * 400, 196, 180, 44, '#3f7a5b'); },
    mid(ctx, W, rng) { skyline(ctx, W, 190, rng, ['#6e7f93', '#8696aa', '#5b6b80'], 10, 20, 46); LM.skyTower(ctx, 260, 190); ridge(ctx, W, 196, 16, 176, '#3f8f4a', '#5aab5e', rng, { waves: 3 }); },
    near(ctx, W, rng) { for (let x = 10; x < W; x += 34 + rng() * 30) { LM.fern(ctx, x, 200, 26 + rng() * 10, '#3f9a48'); } for (let x = 30; x < W; x += 90) roundTree(ctx, x, 200, 10, '#2e7d3b'); },
  },
  NOR: {
    item: 'waffle', animal: 'moose', animalMode: 'far',
    sky: [[0, '#4a78b8'], [0.55, '#9cc2e6'], [1, '#e4f0fa']], sun: null, aurora: true,
    ground: { style: 'snow', top: '#f4f8ff', topLight: '#ffffff', fill: '#4b5563', fillDark: '#323a46', rocks: true },
    block: { style: 'ice', color: '#9fd3f2' }, ledge: { color: '#8a5a32' }, props: ['pine'],
    far(ctx, W, rng) { ridge(ctx, W, 186, 110, 40, '#5d7390', '#7d93b0', rng, { snow: 0.32, waves: 5 }); water(ctx, W, 176, 20, '#3e6f9c', '#7fb0d8'); },
    mid(ctx, W, rng) { ridge(ctx, W, 196, 30, 150, '#3d4d63', '#56677e', rng, { snow: 0.2 }); LM.staveChurch(ctx, 200, 188); LM.redHouses(ctx, 470, 190, rng); for (let x = 0; x < W; x += 26 + rng() * 20) pine(ctx, x, 194, 22 + rng() * 10, '#2d5a43', true); },
    near(ctx, W, rng) { for (let x = 6; x < W; x += 28 + rng() * 26) pine(ctx, x, 204, 30 + rng() * 14, '#24503a', true); },
  },
  GER: {
    item: 'pretzel', animal: 'dachshund', animalMode: 'walk',
    sky: [[0, '#3f78c8'], [0.6, '#8ec0ec'], [1, '#d9eefc']], sun: '#fff3c4',
    ground: { style: 'grass', top: '#4f9a3c', topLight: '#7fc45a', fill: '#6a4a32', fillDark: '#4b3322', flowers: '#f2d33b' },
    block: { style: 'brick', color: '#b0563c', mortar: '#e2d6c6' }, ledge: { color: '#7a5434' }, props: ['bush'],
    far(ctx, W, rng) { ridge(ctx, W, 200, 46, 110, '#3d6e4a', '#558a5f', rng); for (let x = 0; x < W; x += 9) pine(ctx, x, 150 + Math.sin(x / 40) * 8 + 10, 14, '#2f5a3c'); },
    mid(ctx, W, rng) { LM.brandenburg(ctx, 170, 190); LM.tvTower(ctx, 420, 190); LM.fachwerk(ctx, 520, 190, rng); skyline(ctx, W, 190, rng, ['#9aa4b0', '#b5bdc6'], 5, 14, 30); },
    near(ctx, W, rng) { for (let x = 10; x < W; x += 40 + rng() * 40) roundTree(ctx, x, 200, 9 + rng() * 4, '#3f8a3a'); },
  },
  MAR: {
    item: 'minttea', animal: 'camel', animalMode: 'far',
    sky: [[0, '#f08a5d'], [0.45, '#f9c784'], [1, '#fde8c3']], sun: '#fff1b8', sunLow: true,
    ground: { style: 'sand', top: '#e7b56e', topLight: '#f5d39b', fill: '#b97a44', fillDark: '#935c30' },
    block: { style: 'zellige', color: '#2e8b6e', accent: '#2f5f9f' }, ledge: { color: '#9b3d2c' }, props: ['cactus'],
    far(ctx, W, rng) { ridge(ctx, W, 196, 70, 70, '#a3708f', '#c18ca8', rng, { snow: 0.12 }); ridge(ctx, W, 200, 26, 160, '#d9a065', '#e8b77c', rng, { waves: 3 }); },
    mid(ctx, W, rng) { LM.koutoubia(ctx, 220, 190); LM.riadWall(ctx, 330, 190, 160); for (let x = 30; x < W; x += 70 + rng() * 40) palm(ctx, x, 192, 40 + rng() * 14); },
    near(ctx, W, rng) { for (let x = 20; x < W; x += 60 + rng() * 50) palm(ctx, x, 206, 30 + rng() * 10, '#3c8f45'); },
  },
  AUS: {
    item: 'boomerang', animal: 'kangaroo', animalMode: 'hop',
    sky: [[0, '#1f6fc4'], [0.6, '#5fb2ee'], [1, '#bfe6ff']], sun: '#fff7cf',
    ground: { style: 'grass', top: '#b9a24a', topLight: '#dcc771', fill: '#b5532c', fillDark: '#8c3d1f', rocks: true },
    block: { style: 'stone', color: '#d9a066' }, ledge: { color: '#8f5a34' }, props: ['bush'],
    far(ctx, W, rng) { ridge(ctx, W, 200, 20, 168, '#d27a45', '#e3955f', rng, { waves: 3 }); LM.uluru(ctx, 520, 176); },
    mid(ctx, W, rng) { water(ctx, W, 176, 16, '#2a77b8', '#7cc0ee'); LM.harbourBridge(ctx, 60, 192, 120); LM.operaHouse(ctx, 300, 190); skyline(ctx, W, 176, rng, ['#8ea1b5', '#a8b8c8'], 6, 16, 34); },
    near(ctx, W, rng) { for (let x = 20; x < W; x += 70 + rng() * 40) LM.gumTree(ctx, x, 206, 30 + rng() * 10); },
  },
  FRA: {
    item: 'croissant', animal: 'rooster', animalMode: 'walk',
    sky: [[0, '#5a86c9'], [0.6, '#a9c9ec'], [1, '#f1e7f2']], sun: '#fff1cf',
    ground: { style: 'cobble', top: '#5e8f3e', topLight: '#86b85a', fill: '#b9ab8f', fillDark: '#988a70' },
    block: { style: 'stone', color: '#e6d6b4' }, ledge: { color: '#3a3a44', style: 'iron' }, props: ['lamp'],
    far(ctx, W, rng) { ridge(ctx, W, 200, 30, 140, '#9fb2c9', '#b8c8db', rng); skyline(ctx, W, 186, rng, ['#c7c3bd', '#b7b2ab'], 14, 10, 24); },
    mid(ctx, W, rng) { LM.eiffel(ctx, 250, 192); LM.haussmann(ctx, 400, 192, rng); LM.haussmann(ctx, 650, 192, rng); },
    near(ctx, W, rng) { for (let x = 30; x < W; x += 80 + rng() * 30) roundTree(ctx, x, 204, 11, '#5f9a48', '#7a6a58'); },
  },
  ESP: {
    item: 'orange', animal: 'bull', animalMode: 'far',
    sky: [[0, '#2a7ed6'], [0.6, '#7cc2f5'], [1, '#d8f0ff']], sun: '#fff3b0',
    ground: { style: 'grass', top: '#a7a14a', topLight: '#cdc46a', fill: '#a8582f', fillDark: '#86411f' },
    block: { style: 'terracotta', color: '#c8643a' }, ledge: { color: '#8a5530' }, props: ['bush'],
    far(ctx, W, rng) { ridge(ctx, W, 200, 34, 130, '#c79a5c', '#ddb57a', rng); for (let i = 0; i < 3; i++) LM.windmill(ctx, 90 + i * 230, 150 + i * 4, i * 0.7); },
    mid(ctx, W, rng) { LM.sagrada(ctx, 330, 190); skyline(ctx, W, 190, rng, ['#e8d6b8', '#d9c3a0'], 9, 12, 26); for (let x = 500; x < 740; x += 60) LM.orangeTree(ctx, x, 192); },
    near(ctx, W, rng) { for (let x = 20; x < W; x += 60 + rng() * 40) LM.orangeTree(ctx, x, 206); },
  },
  ENG: {
    item: 'teacup', animal: 'bus', animalMode: 'drive',
    sky: [[0, '#6f88a8'], [0.6, '#aebfd3'], [1, '#e3e9ef']], sun: null, overcast: true,
    ground: { style: 'grass', top: '#3f9a3e', topLight: '#6cc25d', fill: '#5f4632', fillDark: '#433122', flowers: '#ffffff' },
    block: { style: 'brick', color: '#9c3b2c', mortar: '#d9cdbb' }, ledge: { color: '#6e4b30' }, props: ['phonebox'],
    far(ctx, W, rng) { ridge(ctx, W, 200, 34, 128, '#5e8a5a', '#77a46e', rng); for (let x = 0; x < W; x += 24) px(ctx, x, 150 + Math.sin(x / 50) * 6, '#3f6b3e', 18, 3); },
    mid(ctx, W, rng) { water(ctx, W, 178, 14, '#5d7c96', '#9cb6cc'); LM.towerBridge(ctx, 170, 190); LM.bigBen(ctx, 420, 190); skyline(ctx, W, 180, rng, ['#9b8f84', '#b0a598', '#7d8590'], 9, 14, 34); },
    near(ctx, W, rng) { for (let x = 20; x < W; x += 50 + rng() * 40) roundTree(ctx, x, 204, 10, '#3d7f3a'); },
  },
};

// fallback world for countries without a theme pack yet (built from the kit colours)
function makeGeneric(team) {
  const k = team.kit;
  return {
    item: 'ball', animal: null,
    sky: [[0, mix('#2f6fc0', k.shirt, 0.15)], [0.6, '#8fc4ef'], [1, '#d8eefc']], sun: '#fff6cc',
    ground: { style: 'grass', top: '#4a9b3f', topLight: '#7cc55e', fill: '#634631', fillDark: '#463021' },
    block: { style: 'stone', color: mix('#b9aa92', k.shirt, 0.2) }, ledge: { color: '#8a5a34' }, props: ['bush'],
    far(ctx, W, rng) { ridge(ctx, W, 200, 50, 110, '#5d8a6a', '#78a585', rng); },
    mid(ctx, W, rng) { skyline(ctx, W, 190, rng, [mix('#8e9aa8', k.shirt, 0.25), '#a8b2be'], 12, 16, 50); },
    near(ctx, W, rng) { for (let x = 20; x < W; x += 50 + rng() * 40) roundTree(ctx, x, 204, 10, '#3d7f3a'); },
  };
}

export const hasTheme = code => !!THEMES[code];
export const themeItem = code => (THEMES[code] || { item: 'ball' }).item;

const cache = new Map();
// Build (and cache) all canvases for one country world.
export function buildTheme(team) {
  if (cache.has(team.code)) return cache.get(team.code);
  const def = THEMES[team.code] || makeGeneric(team);
  const rng = makeRng(hashString('theme-' + team.code));
  const layer = () => makeCanvas(LAYER_W, LAYER_H);

  const [sky, sctx] = layer();
  bandedGradient(sctx, 0, 0, LAYER_W, LAYER_H, def.sky, 12);
  if (def.aurora) for (let x = 0; x < LAYER_W; x++) { const y = 18 + Math.sin(x / 60) * 8 + Math.sin(x / 23) * 3; sctx.fillStyle = 'rgba(120,255,190,0.35)'; sctx.fillRect(x, y, 1, 10 + Math.sin(x / 17) * 4); sctx.fillStyle = 'rgba(160,120,255,0.2)'; sctx.fillRect(x, y + 12, 1, 6); }
  if (def.sun) { const sx = 560, sy = def.sunLow ? 120 : 44; disc(sctx, sx, sy, 18, mix(def.sun, def.sky[1][1], 0.5)); disc(sctx, sx, sy, 14, def.sun); disc(sctx, sx - 4, sy - 4, 5, '#ffffff'); }
  clouds(sctx, LAYER_W, rng, def.overcast ? 14 : 7, '#ffffff', def.overcast ? '#c3cdd8' : '#dce9f7', 14, def.overcast ? 80 : 70);

  const [far, fctx] = layer(); def.far(fctx, LAYER_W, rng);
  const [mid, mctx] = layer(); def.mid(mctx, LAYER_W, rng);
  const [near, nctx] = layer(); def.near(nctx, LAYER_W, rng);
  // outline the near layer so it reads as "in front"
  outline(near, 'rgba(26,18,34,0.55)');

  const tiles = makeTiles(def.ground, rng);
  const theme = {
    code: team.code, def, sky, far, mid, near,
    groundTop: tiles.top, groundFill: tiles.fill,
    block: makeBlock(def.block, rng), ledge: makeLedge(def.ledge),
    item: def.item, animal: def.animal, animalMode: def.animalMode, props: def.props || [],
    edge: shade(def.ground.fill, -0.55),
  };
  cache.set(team.code, theme);
  return theme;
}

// small decoration props standing on the ground
export function propSprite(kind) {
  const [c, ctx] = makeCanvas(24, 30);
  switch (kind) {
    case 'fern': LM.fern(ctx, 12, 29, 22, '#3f9a48'); break;
    case 'flax': for (let i = -3; i <= 3; i++) line(ctx, 12, 29, 12 + i * 3, 12 + Math.abs(i) * 3, i % 2 ? '#5f7f3a' : '#7a9a48', 1); break;
    case 'pine': pine(ctx, 12, 29, 26, '#2d5a43', true); break;
    case 'bush': disc(ctx, 8, 24, 5, '#3f8a3a'); disc(ctx, 15, 23, 6, '#4f9a45'); disc(ctx, 12, 20, 5, '#5faa52'); px(ctx, 3, 28, '#3f8a3a', 18, 2); break;
    case 'cactus': px(ctx, 10, 10, '#4c9a52', 4, 20); px(ctx, 5, 15, '#4c9a52', 3, 6); px(ctx, 5, 20, '#4c9a52', 6, 2); px(ctx, 16, 13, '#4c9a52', 3, 7); px(ctx, 13, 19, '#4c9a52', 6, 2); px(ctx, 11, 11, '#7cc47f', 1, 18); break;
    case 'lamp': px(ctx, 11, 6, '#2b2b33', 2, 24); px(ctx, 8, 4, '#2b2b33', 8, 3); px(ctx, 9, 1, '#f6e7a1', 6, 4); px(ctx, 9, 28, '#2b2b33', 6, 2); break;
    case 'phonebox': LM.phoneBox(ctx, 7, 30); break;
    default: disc(ctx, 12, 24, 5, '#3f8a3a');
  }
  return outline(c);
}
