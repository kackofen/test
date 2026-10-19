// Stadium bumper (~10 s) before each level, comic style:
// city landmark(s) -> stadium from outside -> "CITY / STADIUM" lettering -> flight inside
// -> the illustration dissolves into pixels and becomes the first frame of the level.
import { comicify, loadImage } from './comicfx.js';
import { drawFlag } from '../ui/flags.js';

const W = 1280, H = 720;
const FONT = '"Bangers", Impact, sans-serif';
const INK = '#1a1222';

const prepared = new Map(); // venue id -> Promise<panels>

// ------------------------------------------------------------------ assets
export function prepareVenue(venue, base = '') {
  if (prepared.has(venue.id)) return prepared.get(venue.id);
  const job = (async () => {
    const out = { city: [], exterior: null, interior: null, credits: [] };
    const imgs = venue.images || [];
    for (let i = 0; i < imgs.length; i++) {
      const m = imgs[i];
      let canvas = null;
      const ext = (m.url.match(/\.(jpe?g|png)$/i)?.[1] || 'jpg').toLowerCase();
      for (const [url, cors] of [[`${base}img/intro/${venue.id}/${i + 1}.${ext}`, true], [m.url, true]]) {
        try {
          const im = await loadImage(url, cors);
          await new Promise(r => setTimeout(r, 0));
          canvas = comicify(im, W, H, { focus: m.focus });
          out.credits.push(m);
          break;
        } catch (e) { /* try next source */ }
      }
      if (!canvas) continue;
      if (m.role === 'city') out.city.push({ canvas, credit: m, focus: m.focus });
      else out[m.role] = { canvas, credit: m, focus: m.focus };
    }
    if (!out.city.length) out.city.push({ canvas: drawFallback('city', venue), credit: null });
    if (!out.exterior) out.exterior = { canvas: drawFallback('exterior', venue), credit: null };
    if (!out.interior) out.interior = { canvas: drawFallback('interior', venue), credit: null };
    return out;
  })();
  prepared.set(venue.id, job);
  return job;
}

// hand-drawn comic panels when no photo is available
function halftone(ctx, x0, y0, w, h, col, step = 10, maxR = 3.2, dir = 'down') {
  ctx.fillStyle = col;
  for (let y = y0; y < y0 + h; y += step) for (let x = x0 + ((y / step) % 2) * step / 2; x < x0 + w; x += step) {
    const t = dir === 'down' ? (y - y0) / h : 1 - (y - y0) / h;
    const r = maxR * t; if (r < 0.4) continue;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
}
function drawFallback(role, venue) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const [c1, c2, c3] = venue.colors || ['#2a9d8f', '#e9c46a', '#264653'];
  ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = INK;
  if (role === 'city') {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ff9a5a'); g.addColorStop(0.55, '#ffd27a'); g.addColorStop(1, '#ffe9b8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(W * 0.7, H * 0.38, 110, 0, 7); ctx.fill(); ctx.stroke();
    halftone(ctx, 0, 0, W, H * 0.6, 'rgba(255,120,80,0.35)', 14, 4, 'up');
    let seed = 3; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const [base, col, hmin, hmax] of [[H * 0.78, c3, 120, 300], [H * 0.86, c1, 60, 200]]) {
      for (let x = -20; x < W; ) {
        const bw = 50 + r() * 90, bh = hmin + r() * (hmax - hmin);
        ctx.fillStyle = col; ctx.fillRect(x, base - bh, bw, bh + 200); ctx.strokeRect(x, base - bh, bw, bh + 200);
        ctx.fillStyle = 'rgba(255,240,180,0.85)';
        for (let wy = base - bh + 16; wy < base - 10; wy += 26) for (let wx = x + 10; wx < x + bw - 12; wx += 20) if (r() < 0.6) ctx.fillRect(wx, wy, 8, 12);
        x += bw + 4;
      }
    }
    ctx.fillStyle = c2; ctx.fillRect(0, H * 0.9, W, H * 0.1); ctx.beginPath(); ctx.moveTo(0, H * 0.9); ctx.lineTo(W, H * 0.9); ctx.stroke();
  } else if (role === 'exterior') {
    ctx.fillStyle = '#7fb36a'; ctx.fillRect(0, 0, W, H);
    halftone(ctx, 0, 0, W, H, 'rgba(40,90,40,0.35)', 12, 3.5);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = i % 3 ? '#e8e1d4' : '#cfc6b5'; const x = (i * 197) % W, y = (i * 113) % H; ctx.fillRect(x, y, 70, 46); ctx.strokeRect(x, y, 70, 46); }
    const cx = W / 2, cy = H / 2 + 20;
    ctx.fillStyle = '#d9dde3'; ctx.beginPath(); ctx.ellipse(cx, cy, 470, 260, 0, 0, 7); ctx.fill(); ctx.lineWidth = 8; ctx.stroke();
    ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(cx, cy, 430, 230, 0, 0, 7); ctx.fill(); ctx.lineWidth = 5; ctx.stroke();
    halftone(ctx, cx - 430, cy - 230, 860, 460, 'rgba(0,0,0,0.25)', 12, 3);
    ctx.fillStyle = '#3f9a3e'; ctx.beginPath(); ctx.ellipse(cx, cy, 300, 150, 0, 0, 7); ctx.fill(); ctx.stroke();
    for (let k = -4; k <= 4; k += 2) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(cx + k * 30 - 30, cy - 140, 30, 280); }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.strokeRect(cx - 220, cy - 100, 440, 200); ctx.beginPath(); ctx.moveTo(cx, cy - 100); ctx.lineTo(cx, cy + 100); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, 34, 0, 7); ctx.stroke();
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#18213a'); g.addColorStop(1, '#2a3558');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const lx of [160, 1120]) { ctx.fillStyle = '#fff8d0'; ctx.fillRect(lx - 60, 40, 120, 40); ctx.strokeRect(lx - 60, 40, 120, 40); const lg = ctx.createRadialGradient(lx, 60, 10, lx, 60, 400); lg.addColorStop(0, 'rgba(255,248,200,0.5)'); lg.addColorStop(1, 'rgba(255,248,200,0)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H); }
    let seed = 9; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let y = 120; y < 430; y += 14) for (let x = 0; x < W; x += 12) { ctx.fillStyle = [c1, c2, '#ffffff', c3][Math.floor(r() * 4)]; ctx.beginPath(); ctx.arc(x + r() * 4, y, 4, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#3f9a3e'; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(220, 430); ctx.lineTo(W - 220, 430); ctx.lineTo(W, H); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(W / 2, 430); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.beginPath(); ctx.ellipse(W / 2, 560, 120, 50, 0, 0, 7); ctx.stroke();
  }
  return c;
}

// ------------------------------------------------------------------ drawing helpers
const clamp01 = t => Math.max(0, Math.min(1, t));
const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
const easeIn = t => Math.pow(clamp01(t), 2.2);
function kenBurns(ctx, img, t, from, to, focus = [0.5, 0.5]) {
  const s = from + (to - from) * t;
  const fx = (focus[0] - 0.5) * W * (s - 1), fy = (focus[1] - 0.5) * H * (s - 1);
  ctx.drawImage(img, W / 2 - (W * s) / 2 - fx * 0.6, H / 2 - (H * s) / 2 - fy * 0.6, W * s, H * s);
}
function caption(ctx, text, x, y, size, bg, fg, rot, t) {
  if (t <= 0) return;
  ctx.save();
  ctx.font = `${size}px ${FONT}`;
  const tw = ctx.measureText(text).width, padX = size * 0.4, padY = size * 0.18;
  const sc = t < 1 ? easeOut(t) * 1.08 - Math.max(0, t - 0.8) * 0.4 : 1;
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc);
  ctx.fillStyle = INK; ctx.fillRect(-padX + 8, -size - padY + 8, tw + padX * 2, size + padY * 2);
  ctx.fillStyle = bg; ctx.fillRect(-padX, -size - padY, tw + padX * 2, size + padY * 2);
  ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeRect(-padX, -size - padY, tw + padX * 2, size + padY * 2);
  ctx.fillStyle = fg; ctx.textBaseline = 'alphabetic'; ctx.fillText(text, 0, -padY * 0.4);
  ctx.restore();
}
function bigLettering(ctx, text, x, y, size, col, t, rot = -0.04) {
  if (t <= 0) return;
  ctx.save();
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  const sc = easeOut(Math.min(1, t * 1.6)) * (1 + Math.max(0, 0.3 - t) * 0.6);
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc);
  for (let i = 10; i > 0; i -= 2) { ctx.fillStyle = INK; ctx.fillText(text, i, i); }      // extrusion
  ctx.lineWidth = size * 0.12; ctx.strokeStyle = INK; ctx.strokeText(text, 0, 0);
  const g = ctx.createLinearGradient(0, -size, 0, 0); g.addColorStop(0, '#fff6c2'); g.addColorStop(0.5, col); g.addColorStop(1, '#ff9f1c');
  ctx.fillStyle = g; ctx.fillText(text, 0, 0);
  ctx.lineWidth = size * 0.035; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.strokeText(text, 0, 0);
  ctx.restore();
}
function speedLines(ctx, t, intensity, cx = W / 2, cy = H / 2) {
  if (intensity <= 0) return;
  ctx.save();
  let seed = 5; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2, r0 = 160 + r() * 260 - t * 400 * intensity % 200, len = 140 + r() * 520;
    ctx.strokeStyle = i % 3 ? `rgba(26,18,34,${0.55 * intensity})` : `rgba(255,255,255,${0.75 * intensity})`;
    ctx.lineWidth = 2 + r() * 5;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len)); ctx.stroke();
  }
  ctx.restore();
}
function credit(ctx, c) {
  if (!c) return;
  ctx.save(); ctx.font = '15px system-ui, sans-serif'; ctx.textAlign = 'right';
  const txt = `Photo: ${c.author} · ${c.license} · Wikimedia Commons (comic-filtered)`;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; const tw = ctx.measureText(txt).width; ctx.fillRect(W - tw - 22, H - 32, tw + 14, 22);
  ctx.fillStyle = '#ffffff'; ctx.fillText(txt, W - 14, H - 16); ctx.restore();
}
function panelFrame(ctx) { ctx.save(); ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.strokeRect(7, 7, W - 14, H - 14); ctx.restore(); }
function pixelate(ctx, src, block, tmp) {
  const w = Math.max(2, Math.round(W / block)), h = Math.max(2, Math.round(H / block));
  tmp.width = w; tmp.height = h;
  const t = tmp.getContext('2d'); t.imageSmoothingEnabled = true; t.drawImage(src, 0, 0, w, h);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(tmp, 0, 0, W, H); ctx.imageSmoothingEnabled = true;
}

// ------------------------------------------------------------------ the bumper
// canvas: the visible canvas (sized by CSS); opts: { venue, match, teams, startFrame(): canvas 384x216, stageLabel }
export async function playIntro(canvas, opts) {
  const panels = await prepareVenue(opts.venue, opts.base || '');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
  const vctx = canvas.getContext('2d');
  const buf = document.createElement('canvas'); buf.width = W; buf.height = H;
  const ctx = buf.getContext('2d');
  const tmp = document.createElement('canvas');
  const scene = document.createElement('canvas'); scene.width = W; scene.height = H; const sctx = scene.getContext('2d');
  const startFrame = opts.startFrame();
  const { venue, match, teams } = opts;
  const city = venue.city.toUpperCase(), stadium = venue.stadium.toUpperCase();
  const label = opts.stageLabel || `MATCH ${match.id}`;
  const c1 = panels.city[0], c2 = panels.city[1] || panels.city[0];
  const DUR = 10.2;

  return new Promise(resolve => {
    const t0 = performance.now();
    let skipAt = null, done = false;
    const skip = e => { if ((performance.now() - t0) > 400 && skipAt === null) { skipAt = (performance.now() - t0) / 1000; e?.preventDefault?.(); } };
    window.addEventListener('keydown', skip); canvas.addEventListener('pointerdown', skip);
    const finish = () => { if (done) return; done = true; window.removeEventListener('keydown', skip); canvas.removeEventListener('pointerdown', skip); resolve(); };

    const frame = () => {
      let t = (performance.now() - t0) / 1000;
      if (skipAt !== null) t = Math.max(t, DUR - 0.6 + (t - skipAt));
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      let creditInfo = null;

      // build the "scene" (everything before the pixel morph)
      sctx.fillStyle = '#000'; sctx.fillRect(0, 0, W, H);
      if (t < 2.7) { // city shot 1
        kenBurns(sctx, c1.canvas, clamp01(t / 2.9), 1.04, 1.16, c1.focus); creditInfo = c1.credit;
      } else if (t < 4.6) { // city shot 2 slides in as a diagonal panel
        kenBurns(sctx, c1.canvas, clamp01(t / 2.9), 1.04, 1.18, c1.focus);
        const k = easeOut((t - 2.7) / 0.55);
        sctx.save(); sctx.beginPath();
        const x0 = W * (1 - k) + W * 0.02;
        sctx.moveTo(x0 + 140, 0); sctx.lineTo(W + 40, 0); sctx.lineTo(W + 40, H); sctx.lineTo(x0 - 140, H); sctx.closePath(); sctx.clip();
        kenBurns(sctx, c2.canvas, clamp01((t - 2.7) / 2.2), 1.12, 1.02, c2.focus);
        sctx.restore();
        sctx.save(); sctx.lineWidth = 16; sctx.strokeStyle = INK; sctx.beginPath(); sctx.moveTo(x0 + 140, 0); sctx.lineTo(x0 - 140, H); sctx.stroke(); sctx.restore();
        creditInfo = k > 0.5 ? c2.credit : c1.credit;
      } else if (t < 6.7) { // stadium exterior
        const e = panels.exterior; kenBurns(sctx, e.canvas, clamp01((t - 4.6) / 2.1), 1.0, 1.22, e.focus); creditInfo = e.credit;
        if (t < 4.75) { sctx.fillStyle = `rgba(255,255,255,${1 - (t - 4.6) / 0.15})`; sctx.fillRect(0, 0, W, H); }
      } else if (t < 8.1) { // flight inside: zoom into the exterior, cut to the interior pulling back
        const k = (t - 6.7) / 1.4;
        if (k < 0.45) {
          const e = panels.exterior; kenBurns(sctx, e.canvas, 1, 1.22 + easeIn(k / 0.45) * 3.2, 1.22 + easeIn(k / 0.45) * 3.2, e.focus);
          speedLines(sctx, t, easeIn(k / 0.45));
        } else {
          const i = panels.interior, kk = (k - 0.45) / 0.55;
          kenBurns(sctx, i.canvas, 1, 1.7 - easeOut(kk) * 0.62, 1.7 - easeOut(kk) * 0.62, i.focus);
          speedLines(sctx, t, Math.max(0, 1 - kk * 1.6));
          if (kk < 0.12) { sctx.fillStyle = `rgba(255,255,255,${1 - kk / 0.12})`; sctx.fillRect(0, 0, W, H); }
          creditInfo = i.credit;
        }
      } else { // interior settles
        const i = panels.interior; kenBurns(sctx, i.canvas, clamp01((t - 8.1) / 2), 1.08, 1.04, i.focus); creditInfo = i.credit;
      }
      panelFrame(sctx);

      // lettering
      const capT = clamp01((t - 0.7) / 0.35);
      if (t < 6.7) caption(sctx, city, 70, H - 70, 92, '#ffd23f', INK, -0.03, capT * (t < 6.4 ? 1 : 1 - (t - 6.4) / 0.3));
      caption(sctx, `${label}  ·  ${fmtDate(match.date)}`, 60, 110, 40, '#ffffff', INK, -0.02, clamp01((t - 0.2) / 0.3) * (t < 9.4 ? 1 : 0));
      if (t > 4.85 && t < 6.9) bigLettering(sctx, stadium, W / 2, H / 2 + 40, stadium.length > 16 ? 108 : 132, '#ffd23f', (t - 4.85) / 0.9);
      if (t > 7.4 && t < 9.6) vsBanner(sctx, teams, (t - 7.4) / 0.5, t > 9.2 ? (t - 9.2) / 0.4 : 0);
      if (creditInfo && t < 8.9) credit(sctx, creditInfo);

      // morph into the level: pixels (2D game) or comic halftone dots (3D game)
      if (t < 8.6) ctx.drawImage(scene, 0, 0);
      else if (opts.transition === 'halftone') {
        const k = clamp01((t - 8.6) / (DUR - 8.6));
        ctx.drawImage(scene, 0, 0);
        tmp.width = W; tmp.height = H;
        const m = tmp.getContext('2d');
        m.globalCompositeOperation = 'source-over'; m.drawImage(startFrame, 0, 0, W, H);
        m.globalCompositeOperation = 'destination-in';
        const step = 44, r = easeIn(k) * step * 0.82;
        m.fillStyle = '#000';
        if (r > 0.5) for (let yy = 0, row = 0; yy < H + step; yy += step * 0.866, row++) for (let xx = (row % 2) * step / 2; xx < W + step; xx += step) { m.beginPath(); m.arc(xx, yy, r, 0, 7); m.fill(); }
        else m.clearRect(0, 0, W, H);
        m.globalCompositeOperation = 'source-over';
        ctx.drawImage(tmp, 0, 0);
      } else {
        const k = clamp01((t - 8.6) / (DUR - 8.6));
        if (k < 0.55) pixelate(ctx, scene, 1 + easeIn(k / 0.55) * 26, tmp);
        else {
          const kk = (k - 0.55) / 0.45;
          pixelate(ctx, scene, 27, tmp);
          ctx.globalAlpha = clamp01(kk * 1.6);
          const block = Math.max(W / 384, 27 * (1 - easeOut(kk)));
          pixelate(ctx, startFrame, block, tmp);
          ctx.globalAlpha = 1;
        }
      }
      vctx.imageSmoothingEnabled = true;
      vctx.drawImage(buf, 0, 0, canvas.width, canvas.height);
      if (t >= DUR) { finish(); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

function vsBanner(ctx, teams, tin, tout) {
  ctx.save();
  const k = easeOut(tin), y = H - 150 + (1 - k) * 220 + tout * 220;
  ctx.globalAlpha = 1 - tout;
  ctx.fillStyle = INK; ctx.fillRect(0, y - 6, W, 112);
  const half = (side, x0, dir) => {
    const t = teams[side];
    ctx.fillStyle = t.kit.shirt; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + dir * 600, y); ctx.lineTo(x0 + dir * 560, y + 100); ctx.lineTo(x0, y + 100); ctx.fill();
    drawFlag(ctx, t.code, dir > 0 ? 40 : W - 40 - 96, y + 18, 96, 64); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeRect(dir > 0 ? 40 : W - 136, y + 18, 96, 64);
    ctx.font = `66px ${FONT}`; ctx.textAlign = dir > 0 ? 'left' : 'right'; ctx.lineJoin = 'round';
    ctx.lineWidth = 10; ctx.strokeStyle = INK; const tx = dir > 0 ? 160 : W - 160;
    ctx.strokeText(t.name.toUpperCase(), tx, y + 74); ctx.fillStyle = '#ffffff'; ctx.fillText(t.name.toUpperCase(), tx, y + 74);
  };
  half('home', 0, 1); half('away', W, -1);
  ctx.font = `90px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 12; ctx.strokeStyle = INK;
  ctx.strokeText('VS', W / 2, y + 84); ctx.fillStyle = '#ffd23f'; ctx.fillText('VS', W / 2, y + 84);
  ctx.restore();
}
function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).toUpperCase();
}
