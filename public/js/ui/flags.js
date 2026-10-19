// Simplified flags for all 2023/2027 teams, drawn on canvas (no image files needed).
// drawFlag(ctx, code, x, y, w, h) – flagDataUrl(code, w, h) for <img> tags.
const R = (ctx, c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
const star = (ctx, cx, cy, r, c, rot = -Math.PI / 2) => {
  ctx.fillStyle = c; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.42 : r, a = rot + i * Math.PI / 5; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
};
const circle = (ctx, cx, cy, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); };
const hStripes = (ctx, cols, w, h, weights) => { const tot = (weights || cols.map(() => 1)).reduce((a, b) => a + b, 0); let y = 0; cols.forEach((c, i) => { const hh = h * (weights ? weights[i] : 1) / tot; R(ctx, c, 0, y, w, hh + 0.5); y += hh; }); };
const vStripes = (ctx, cols, w, h) => cols.forEach((c, i) => R(ctx, c, i * w / cols.length, 0, w / cols.length + 0.5, h));
const nordic = (ctx, w, h, bg, cross, inner) => { R(ctx, bg, 0, 0, w, h); const t = h * 0.22; R(ctx, cross, w * 0.3, 0, t * 1.4, h); R(ctx, cross, 0, h / 2 - t * 0.7, w, t * 1.4); if (inner) { R(ctx, inner, w * 0.3 + t * 0.35, 0, t * 0.7, h); R(ctx, inner, 0, h / 2 - t * 0.35, w, t * 0.7); } };
const unionCanton = (ctx, w, h) => {
  const cw = w / 2, ch = h / 2; R(ctx, '#012169', 0, 0, cw, ch);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, cw, ch); ctx.clip();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = ch * 0.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(cw, ch); ctx.moveTo(cw, 0); ctx.lineTo(0, ch); ctx.stroke();
  ctx.strokeStyle = '#C8102E'; ctx.lineWidth = ch * 0.07; ctx.stroke();
  R(ctx, '#fff', cw * 0.42, 0, cw * 0.16, ch); R(ctx, '#fff', 0, ch * 0.4, cw, ch * 0.2);
  R(ctx, '#C8102E', cw * 0.46, 0, cw * 0.08, ch); R(ctx, '#C8102E', 0, ch * 0.45, cw, ch * 0.1);
  ctx.restore();
};

const FLAGS = {
  NZL(ctx, w, h) { R(ctx, '#012169', 0, 0, w, h); unionCanton(ctx, w, h); for (const [x, y] of [[0.75, 0.25], [0.68, 0.5], [0.82, 0.45], [0.75, 0.78]]) { star(ctx, x * w, y * h, h * 0.075, '#fff'); star(ctx, x * w, y * h, h * 0.05, '#C8102E'); } },
  AUS(ctx, w, h) { R(ctx, '#012169', 0, 0, w, h); unionCanton(ctx, w, h); star(ctx, w * 0.25, h * 0.75, h * 0.12, '#fff'); for (const [x, y] of [[0.75, 0.2], [0.63, 0.45], [0.86, 0.4], [0.75, 0.82]]) star(ctx, x * w, y * h, h * 0.065, '#fff'); },
  NOR(ctx, w, h) { nordic(ctx, w, h, '#BA0C2F', '#fff', '#00205B'); },
  DEN(ctx, w, h) { nordic(ctx, w, h, '#C8102E', '#fff'); },
  SWE(ctx, w, h) { nordic(ctx, w, h, '#006AA7', '#FECC00'); },
  PHI(ctx, w, h) { hStripes(ctx, ['#0038A8', '#CE1126'], w, h); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.43, h / 2); ctx.lineTo(0, h); ctx.fill(); circle(ctx, w * 0.14, h / 2, h * 0.1, '#FCD116'); },
  SUI(ctx, w, h) { R(ctx, '#DA291C', 0, 0, w, h); R(ctx, '#fff', w / 2 - h * 0.1, h * 0.2, h * 0.2, h * 0.6); R(ctx, '#fff', w / 2 - h * 0.3, h * 0.4, h * 0.6, h * 0.2); },
  IRL(ctx, w, h) { vStripes(ctx, ['#169B62', '#fff', '#FF883E'], w, h); },
  NGA(ctx, w, h) { vStripes(ctx, ['#008751', '#fff', '#008751'], w, h); },
  CAN(ctx, w, h) { vStripes(ctx, ['#D52B1E', '#fff', '#fff', '#D52B1E'], w, h); ctx.fillStyle = '#D52B1E'; ctx.beginPath(); const cx = w / 2, cy = h / 2, s = h * 0.3; ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s * 0.35, cy - s * 0.3); ctx.lineTo(cx + s, cy - s * 0.4); ctx.lineTo(cx + s * 0.7, cy + s * 0.2); ctx.lineTo(cx + s * 0.1, cy + s * 0.6); ctx.lineTo(cx + s * 0.1, cy + s); ctx.lineTo(cx - s * 0.1, cy + s); ctx.lineTo(cx - s * 0.1, cy + s * 0.6); ctx.lineTo(cx - s * 0.7, cy + s * 0.2); ctx.lineTo(cx - s, cy - s * 0.4); ctx.lineTo(cx - s * 0.35, cy - s * 0.3); ctx.fill(); },
  ESP(ctx, w, h) { hStripes(ctx, ['#AA151B', '#F1BF00', '#AA151B'], w, h, [1, 2, 1]); R(ctx, '#AA151B', w * 0.22, h * 0.36, w * 0.1, h * 0.26); },
  CRC(ctx, w, h) { hStripes(ctx, ['#002B7F', '#fff', '#CE1126', '#fff', '#002B7F'], w, h, [1, 1, 2, 1, 1]); },
  ZAM(ctx, w, h) { R(ctx, '#198A00', 0, 0, w, h); ['#DE2010', '#000', '#EF7D00'].forEach((c, i) => R(ctx, c, w * (0.7 + i * 0.1), h * 0.38, w * 0.1, h * 0.62)); circle(ctx, w * 0.85, h * 0.2, h * 0.09, '#EF7D00'); },
  JPN(ctx, w, h) { R(ctx, '#fff', 0, 0, w, h); circle(ctx, w / 2, h / 2, h * 0.3, '#BC002D'); },
  ENG(ctx, w, h) { R(ctx, '#fff', 0, 0, w, h); R(ctx, '#CE1124', w / 2 - h * 0.1, 0, h * 0.2, h); R(ctx, '#CE1124', 0, h * 0.4, w, h * 0.2); },
  HAI(ctx, w, h) { hStripes(ctx, ['#00209F', '#D21034'], w, h); R(ctx, '#fff', w * 0.38, h * 0.32, w * 0.24, h * 0.36); circle(ctx, w / 2, h / 2, h * 0.09, '#016a16'); },
  CHN(ctx, w, h) { R(ctx, '#EE1C25', 0, 0, w, h); star(ctx, w * 0.17, h * 0.27, h * 0.15, '#FFFF00'); for (const [x, y] of [[0.33, 0.1], [0.4, 0.2], [0.4, 0.35], [0.33, 0.45]]) star(ctx, x * w, y * h, h * 0.05, '#FFFF00'); },
  USA(ctx, w, h) { for (let i = 0; i < 13; i++) R(ctx, i % 2 ? '#fff' : '#B22234', 0, i * h / 13, w, h / 13 + 0.5); R(ctx, '#3C3B6E', 0, 0, w * 0.4, h * 7 / 13); for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) circle(ctx, w * (0.04 + x * 0.08), h * (0.07 + y * 0.12), h * 0.018, '#fff'); },
  VIE(ctx, w, h) { R(ctx, '#DA251D', 0, 0, w, h); star(ctx, w / 2, h / 2 + h * 0.03, h * 0.3, '#FFFF00'); },
  NED(ctx, w, h) { hStripes(ctx, ['#AE1C28', '#fff', '#21468B'], w, h); },
  POR(ctx, w, h) { R(ctx, '#046A38', 0, 0, w * 0.4, h); R(ctx, '#DA291C', w * 0.4, 0, w * 0.6, h); circle(ctx, w * 0.4, h / 2, h * 0.2, '#FFE900'); circle(ctx, w * 0.4, h / 2, h * 0.12, '#DA291C'); R(ctx, '#fff', w * 0.37, h * 0.42, w * 0.06, h * 0.16); },
  FRA(ctx, w, h) { vStripes(ctx, ['#0055A4', '#fff', '#EF4135'], w, h); },
  JAM(ctx, w, h) { R(ctx, '#009B3A', 0, 0, w, h); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w / 2, h / 2); ctx.lineTo(0, h); ctx.fill(); ctx.beginPath(); ctx.moveTo(w, 0); ctx.lineTo(w / 2, h / 2); ctx.lineTo(w, h); ctx.fill(); ctx.strokeStyle = '#FED100'; ctx.lineWidth = h * 0.14; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.moveTo(w, 0); ctx.lineTo(0, h); ctx.stroke(); },
  BRA(ctx, w, h) { R(ctx, '#009C3B', 0, 0, w, h); ctx.fillStyle = '#FFDF00'; ctx.beginPath(); ctx.moveTo(w * 0.08, h / 2); ctx.lineTo(w / 2, h * 0.1); ctx.lineTo(w * 0.92, h / 2); ctx.lineTo(w / 2, h * 0.9); ctx.fill(); circle(ctx, w / 2, h / 2, h * 0.22, '#002776'); R(ctx, '#fff', w * 0.37, h * 0.46, w * 0.26, h * 0.05); },
  PAN(ctx, w, h) { R(ctx, '#fff', 0, 0, w, h); R(ctx, '#DA121A', w / 2, 0, w / 2, h / 2); R(ctx, '#072357', 0, h / 2, w / 2, h / 2); star(ctx, w / 4, h / 4, h * 0.11, '#072357'); star(ctx, w * 0.75, h * 0.75, h * 0.11, '#DA121A'); },
  RSA(ctx, w, h) { hStripes(ctx, ['#E03C31', '#001489'], w, h); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, h * 0.06); ctx.lineTo(w * 0.42, h * 0.36); ctx.lineTo(w, h * 0.36); ctx.lineTo(w, h * 0.64); ctx.lineTo(w * 0.42, h * 0.64); ctx.lineTo(0, h * 0.94); ctx.fill();
    ctx.fillStyle = '#007749'; ctx.beginPath(); ctx.moveTo(0, h * 0.17); ctx.lineTo(w * 0.38, h * 0.42); ctx.lineTo(w, h * 0.42); ctx.lineTo(w, h * 0.58); ctx.lineTo(w * 0.38, h * 0.58); ctx.lineTo(0, h * 0.83); ctx.fill();
    ctx.fillStyle = '#FFB612'; ctx.beginPath(); ctx.moveTo(0, h * 0.26); ctx.lineTo(w * 0.3, h / 2); ctx.lineTo(0, h * 0.74); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(0, h * 0.32); ctx.lineTo(w * 0.24, h / 2); ctx.lineTo(0, h * 0.68); ctx.fill(); },
  ITA(ctx, w, h) { vStripes(ctx, ['#009246', '#fff', '#CE2B37'], w, h); },
  ARG(ctx, w, h) { hStripes(ctx, ['#74ACDF', '#fff', '#74ACDF'], w, h); circle(ctx, w / 2, h / 2, h * 0.1, '#F6B40E'); },
  GER(ctx, w, h) { hStripes(ctx, ['#000', '#DD0000', '#FFCE00'], w, h); },
  MAR(ctx, w, h) { R(ctx, '#C1272D', 0, 0, w, h); ctx.strokeStyle = '#006233'; ctx.lineWidth = Math.max(1, h * 0.05); ctx.beginPath(); for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5; ctx.lineTo(w / 2 + Math.cos(a) * h * 0.25, h / 2 + Math.sin(a) * h * 0.25); } ctx.stroke(); },
  COL(ctx, w, h) { hStripes(ctx, ['#FCD116', '#003893', '#CE1126'], w, h, [2, 1, 1]); },
  KOR(ctx, w, h) { R(ctx, '#fff', 0, 0, w, h); circle(ctx, w / 2, h / 2, h * 0.25, '#0047A0'); ctx.fillStyle = '#CD2E3A'; ctx.beginPath(); ctx.arc(w / 2, h / 2, h * 0.25, Math.PI, 0); ctx.fill(); circle(ctx, w / 2 - h * 0.125, h / 2, h * 0.125, '#CD2E3A'); circle(ctx, w / 2 + h * 0.125, h / 2, h * 0.125, '#0047A0');
    ctx.fillStyle = '#000'; for (const [x, y] of [[0.18, 0.22], [0.82, 0.22], [0.18, 0.78], [0.82, 0.78]]) for (let k = -1; k <= 1; k++) R(ctx, '#000', x * w - h * 0.08, y * h + k * h * 0.05, h * 0.16, h * 0.03); },
};

export function drawFlag(ctx, code, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  (FLAGS[code] || ((c) => R(c, '#888', 0, 0, w, h)))(ctx, w, h);
  ctx.restore();
}
const urlCache = new Map();
export function flagDataUrl(code, w = 48, h = 32) {
  const key = `${code}-${w}x${h}`;
  if (urlCache.has(key)) return urlCache.get(key);
  const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
  drawFlag(c.getContext('2d'), code, 0, 0, w * 2, h * 2);
  const url = c.toDataURL(); urlCache.set(key, url);
  return url;
}
