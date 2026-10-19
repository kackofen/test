// Photo -> comic illustration: edge-preserving smoothing (Kuwahara), cel-shaded colours,
// ink outlines (difference of Gaussians) and halftone dots in the shadows.
// Works on any CORS-clean image; returns a new canvas of size w x h.

function coverDraw(ctx, img, w, h, focus = [0.5, 0.5], zoom = 1) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const s = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * s, dh = ih * s;
  const x = Math.min(0, Math.max(w - dw, w / 2 - focus[0] * dw));
  const y = Math.min(0, Math.max(h - dh, h / 2 - focus[1] * dh));
  ctx.drawImage(img, x, y, dw, dh);
}

function integral(src, w, h, sq) {
  const I = sq ? new Float64Array((w + 1) * (h + 1)) : new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let row = 0;
    for (let x = 1; x <= w; x++) {
      const v = src[(y - 1) * w + (x - 1)];
      row += sq ? v * v : v;
      I[y * (w + 1) + x] = I[(y - 1) * (w + 1) + x] + row;
    }
  }
  return I;
}
const boxSum = (I, w, x0, y0, x1, y1) => { const W = w + 1; return I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0]; };

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hh / 6, s, l];
}
function hsl2rgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

export function comicify(img, w, h, opts = {}) {
  const focus = opts.focus || [0.5, 0.5];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  coverDraw(ctx, img, w, h, focus, opts.zoom || 1);
  const src = ctx.getImageData(0, 0, w, h); // throws if the image is not CORS-clean
  const d = src.data, N = w * h;
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N), Lm = new Float32Array(N);
  for (let i = 0; i < N; i++) { R[i] = d[i * 4]; G[i] = d[i * 4 + 1]; B[i] = d[i * 4 + 2]; Lm[i] = 0.299 * R[i] + 0.587 * G[i] + 0.114 * B[i]; }

  // --- Kuwahara (radius r) using integral images
  const r = opts.radius || Math.max(2, Math.round(w / 300));
  const IR = integral(R, w, h), IG = integral(G, w, h), IB = integral(B, w, h), IL = integral(Lm, w, h), IL2 = integral(Lm, w, h, true);
  const oR = new Float32Array(N), oG = new Float32Array(N), oB = new Float32Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let best = Infinity, br = 0, bg = 0, bb = 0;
    for (let q = 0; q < 4; q++) {
      const x0 = q & 1 ? x : Math.max(0, x - r), x1 = q & 1 ? Math.min(w, x + r + 1) : x + 1;
      const y0 = q & 2 ? y : Math.max(0, y - r), y1 = q & 2 ? Math.min(h, y + r + 1) : y + 1;
      const n = (x1 - x0) * (y1 - y0);
      const m = boxSum(IL, w, x0, y0, x1, y1) / n;
      const v = boxSum(IL2, w, x0, y0, x1, y1) / n - m * m;
      if (v < best) { best = v; br = boxSum(IR, w, x0, y0, x1, y1) / n; bg = boxSum(IG, w, x0, y0, x1, y1) / n; bb = boxSum(IB, w, x0, y0, x1, y1) / n; }
    }
    const i = y * w + x; oR[i] = br; oG[i] = bg; oB[i] = bb;
  }

  // --- ink lines: difference of two box blurs on the smoothed luminance
  const sL = new Float32Array(N);
  for (let i = 0; i < N; i++) sL[i] = 0.299 * oR[i] + 0.587 * oG[i] + 0.114 * oB[i];
  const IS = integral(sL, w, h);
  const blur = (x, y, rad) => { const x0 = Math.max(0, x - rad), x1 = Math.min(w, x + rad + 1), y0 = Math.max(0, y - rad), y1 = Math.min(h, y + rad + 1); return boxSum(IS, w, x0, y0, x1, y1) / ((x1 - x0) * (y1 - y0)); };
  const r1 = Math.max(1, Math.round(r / 2)), r2 = r1 * 2 + 1;
  const ink = new Uint8Array(N);
  const thr = opts.inkThreshold ?? 5.5;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dog = blur(x, y, r1) - blur(x, y, r2);
    if (dog < -thr) ink[y * w + x] = 1;
  }

  // --- cel shading + halftone + ink
  const levels = opts.levels || 5;
  const sat = opts.saturation ?? 1.35;
  const dot = opts.dot || Math.max(4, Math.round(w / 180));
  const out = ctx.createImageData(w, h), o = out.data;
  const cos = Math.cos(Math.PI / 4), sin = Math.sin(Math.PI / 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let [hh, ss, ll] = rgb2hsl(oR[i], oG[i], oB[i]);
    // posterize lightness with a soft edge, keep hue, push saturation
    const q = Math.round(ll * (levels - 1)) / (levels - 1);
    ll = q * 0.8 + ll * 0.2;
    ss = Math.min(1, ss * sat + 0.04);
    let [rr, gg, bb] = hsl2rgb(hh, ss, Math.min(0.97, ll * 0.92 + 0.08));
    // halftone in mid/dark tones
    if (ll < 0.55) {
      const u = (x * cos + y * sin) / dot, v = (-x * sin + y * cos) / dot;
      const fu = u - Math.floor(u) - 0.5, fv = v - Math.floor(v) - 0.5;
      const rad = (0.55 - ll) / 0.55 * 0.55;
      if (fu * fu + fv * fv < rad * rad) { rr *= 0.55; gg *= 0.55; bb *= 0.6; }
    }
    // ink (thickened by 1px)
    if (ink[i] || (x > 0 && ink[i - 1]) || (y > 0 && ink[i - w])) { rr = 26; gg = 18; bb = 34; }
    o[i * 4] = rr; o[i * 4 + 1] = gg; o[i * 4 + 2] = bb; o[i * 4 + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  // paper warmth + vignette
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(255,244,225,1)'; ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(178,168,196,1)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

export function loadImage(url, cors = true) {
  return new Promise((res, rej) => {
    const im = new Image();
    if (cors) im.crossOrigin = 'anonymous';
    im.onload = () => res(im); im.onerror = () => rej(new Error('load ' + url));
    im.src = url;
  });
}
