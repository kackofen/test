// Comic effects drawn on a high-resolution overlay above the pixel canvas:
// name explosions (stickers, dribbles), big banners (KICK-OFF, GOAL!), header power meter.
import { luminance } from './pixel.js';

const FONT = '"Bangers", "Impact", sans-serif';

function starPath(ctx, cx, cy, r1, r2, spikes, rot, jitter = 0) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = (i % 2 ? r2 : r1) * (1 + (i % 4 === 0 ? jitter : -jitter * 0.5));
    const a = rot + i / (spikes * 2) * Math.PI * 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.62;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}
const ease = t => 1 - Math.pow(1 - t, 3);
const pop = t => t < 0.6 ? ease(t / 0.6) * 1.15 : 1.15 - (t - 0.6) / 0.4 * 0.15;

export class Bursts {
  constructor(canvas) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.items = []; this.t = 0; }
  clear() { this.items = []; this.ctx.clearRect(0, 0, this.c.width, this.c.height); }
  name(wx, wy, text, color, size = 'big') { this.items.push({ kind: 'name', wx, wy, text, color, size, t0: performance.now(), dur: size === 'big' ? 1900 : 1300, rot: (Math.random() - 0.5) * 0.25 }); }
  banner(text, color, secs = 1.4, huge = false) { this.items = this.items.filter(i => i.kind !== 'banner'); this.items.push({ kind: 'banner', text, color, huge, t0: performance.now(), dur: secs * 1000, rot: (Math.random() - 0.5) * 0.12 }); }
  meter(wx, wy, power) { this.items.push({ kind: 'meter', wx, wy, power, t0: performance.now(), dur: 1800 }); }

  // project(wx, wy) -> {x, y} in CSS pixels (optional, for the 3D camera)
  render(camX, view, project) {
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(view.w * dpr), H = Math.round(view.h * dpr);
    if (this.c.width !== W || this.c.height !== H) { this.c.width = W; this.c.height = H; }
    const ctx = this.ctx, s = view.s * dpr;
    ctx.clearRect(0, 0, W, H);
    const now = performance.now();
    this.items = this.items.filter(it => now - it.t0 < it.dur);
    for (const it of this.items) {
      const t = (now - it.t0) / it.dur;
      ctx.save();
      if (it.kind === 'name') {
        const big = it.size === 'big', tiny = it.size === 'tiny';
        let x, y;
        if (project) { const q = project(it.wx, it.wy); x = q.x * dpr; y = (q.y - (30 + 46 * ease(t)) * view.s / 3) * dpr; }
        else { x = (it.wx - camX) * s; y = (it.wy - 8 - 18 * ease(t)) * s; }
        const fs = (big ? 12 : tiny ? 7.5 : 9) * s;
        const alpha = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
        ctx.globalAlpha = alpha;
        ctx.translate(x, y); ctx.rotate(it.rot); const sc = pop(Math.min(1, t * 3.2)); ctx.scale(sc, sc);
        ctx.font = `${fs}px ${FONT}`;
        const tw = ctx.measureText(it.text).width;
        if (!tiny) {
          starPath(ctx, 0, 0, tw * 0.62 + fs * 0.9, tw * 0.5 + fs * 0.55, big ? 14 : 11, t * 0.6, 0.08);
          ctx.fillStyle = '#1a1222'; ctx.save(); ctx.translate(fs * 0.12, fs * 0.16); ctx.fill(); ctx.restore();
          ctx.fillStyle = big ? '#ffd23f' : '#ffffff'; ctx.fill();
          ctx.lineWidth = Math.max(2, fs * 0.12); ctx.strokeStyle = '#1a1222'; ctx.stroke();
          starPath(ctx, 0, 0, tw * 0.5 + fs * 0.6, tw * 0.42 + fs * 0.35, big ? 14 : 11, t * 0.6 + 0.2, 0.05);
          ctx.fillStyle = it.color; ctx.globalAlpha = alpha * 0.9; ctx.fill(); ctx.globalAlpha = alpha;
        }
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        const light = luminance(it.color) > 0.62;
        const fill = tiny ? it.color : (light ? '#1a1222' : '#ffffff');
        const stroke = tiny ? '#1a1222' : (light ? '#ffffff' : '#1a1222');
        ctx.lineWidth = Math.max(2, fs * 0.16); ctx.strokeStyle = stroke; ctx.strokeText(it.text, 0, fs * 0.05);
        ctx.fillStyle = fill; ctx.fillText(it.text, 0, fs * 0.05);
      } else if (it.kind === 'banner') {
        const fs = (it.huge ? 34 : 20) * s;
        const inT = Math.min(1, t / 0.18), outT = t > 0.8 ? (t - 0.8) / 0.2 : 0;
        ctx.globalAlpha = 1 - outT;
        ctx.translate(W / 2, H * 0.42); ctx.rotate(it.rot); const sc = pop(inT) * (1 + outT * 0.3); ctx.scale(sc, sc);
        ctx.font = `${fs}px ${FONT}`;
        const tw = ctx.measureText(it.text).width;
        starPath(ctx, 0, 0, tw * 0.62 + fs * 0.9, tw * 0.5 + fs * 0.45, 18, now / 2000, 0.07);
        ctx.fillStyle = '#1a1222'; ctx.save(); ctx.translate(fs * 0.1, fs * 0.14); ctx.fill(); ctx.restore();
        ctx.fillStyle = it.color; ctx.fill(); ctx.lineWidth = fs * 0.1; ctx.strokeStyle = '#1a1222'; ctx.stroke();
        // halftone dots inside the burst
        ctx.save(); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        const step = fs * 0.28;
        for (let yy = -fs * 2; yy < fs * 2; yy += step) for (let xx = -tw; xx < tw; xx += step) { ctx.beginPath(); ctx.arc(xx + ((yy / step) % 2) * step / 2, yy, step * 0.22, 0, 7); ctx.fill(); }
        ctx.restore();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        const light = luminance(it.color) > 0.62;
        ctx.lineWidth = fs * 0.16; ctx.strokeStyle = light ? '#ffffff' : '#1a1222'; ctx.strokeText(it.text, 0, fs * 0.06);
        ctx.fillStyle = light ? '#1a1222' : '#ffffff'; ctx.fillText(it.text, 0, fs * 0.06);
      } else if (it.kind === 'meter') {
        const q = project ? project(it.wx, it.wy) : null;
        const x = q ? q.x * dpr : (it.wx - camX) * s, y = q ? (q.y - 60 * view.s / 3) * dpr : (it.wy - 24) * s, w = 60 * s / 2.2, h = 9 * s / 2.2;
        ctx.globalAlpha = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
        ctx.translate(x, y);
        ctx.fillStyle = '#1a1222'; ctx.fillRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
        const fill = Math.min(1, t * 4) * it.power;
        const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); grad.addColorStop(0, '#ff5252'); grad.addColorStop(0.45, '#ffd23f'); grad.addColorStop(1, '#5be37d');
        ctx.fillStyle = grad; ctx.fillRect(-w / 2, -h / 2, w * fill, h);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-w / 2 + w * 0.45 - 1, -h / 2 - 2, 2, h + 4);
        ctx.font = `${h * 1.5}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = h * 0.4; ctx.strokeStyle = '#1a1222'; ctx.lineJoin = 'round';
        const txt = `POWER ${Math.round(it.power * 100)}%`;
        ctx.strokeText(txt, 0, -h * 1.1); ctx.fillStyle = '#ffffff'; ctx.fillText(txt, 0, -h * 1.1);
      }
      ctx.restore();
    }
  }
}
