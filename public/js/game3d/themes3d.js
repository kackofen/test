// Country worlds for the 3D version, all drawn in code: sky, hills, ground textures,
// landmarks, plants, animals and the national collectible. One entry per team; teams
// without their own world get a neutral one in their colours.
/* global THREE */
import { toon, box, sphere, cylinder, cone, merge, canvasTexture, glowSprite, hex, shadeHex, inkMaterial, INK } from './toon.js';
import { installGroupB } from './themes3d-b.js';

export const makeRnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ shared building blocks
export function ridge(x0, x1, z, base, amp, top, color, seed, step = 1.5, opts = {}) {
  const pos = [], uvs = [];
  const taper = x => opts.taper === false ? 1 : smooth(x0, x0 + 9, x) * smooth(x1, x1 - 9, x);
  const raw = x => top + amp * (0.5 + 0.28 * Math.sin(x * 0.045 + seed) + 0.16 * Math.sin(x * 0.11 + seed * 2.3) + 0.06 * Math.sin(x * 0.31 + seed * 5.1));
  const h = x => base + (raw(x) - base) * taper(x);
  const q = opts.steps ? (y => base + Math.round((y - base) / opts.steps) * opts.steps) : (y => y);
  for (let x = x0; x < x1; x += step) {
    const a = q(h(x)), b = q(h(x + step));
    pos.push(x, base, z, x + step, base, z, x + step, b, z, x, base, z, x + step, b, z, x, a, z);
    pos.push(x, a, z, x + step, b, z, x + step, b - 0.6, z + 1.2, x, a, z, x + step, b - 0.6, z + 1.2, x, a - 0.6, z + 1.2);
    for (const [px, py] of [[x, base], [x + step, base], [x + step, b], [x, base], [x + step, b], [x, a], [x, a], [x + step, b], [x + step, b - 0.6], [x, a], [x + step, b - 0.6], [x, a - 0.6]]) uvs.push(px * (opts.uvx ?? 0.1), py * (opts.uvy ?? 0.5));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, toon(opts.map ? 0xffffff : color, { unique: true, side: THREE.DoubleSide, map: opts.map || null })); m.receiveShadow = true;
  m.userData.height = h;
  return m;
}
export function instanced(geo, mat, n, place, castShadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); place(o, i); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }
  if (!n) m.count = 0;
  m.castShadow = castShadow; m.receiveShadow = true; m.frustumCulled = false; return m;
}
const inkBack = () => new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
// a geometry plus a slightly bigger copy for the inked outline, both instanced
function instancedInked(geo, inkGeo, mat, n, place) {
  const g = new THREE.Group();
  g.add(instanced(geo, mat, n, place), instanced(inkGeo, inkBack(), n, place, false));
  return g;
}
function plain(x0, x1, color, y = -2.2, map = null) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 260), toon(map ? 0xffffff : color, { unique: true, map }));
  m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, -110); m.receiveShadow = true; return m;
}
function clouds(x0, x1, rnd, tint = 0xc9d4e6, count = 26) {
  const puffs = [];
  for (let i = 0; i < count; i++) { const cx = x0 - 30 + rnd() * (x1 - x0 + 60), cy = 13 + rnd() * 7, cz = -50 - rnd() * 40; for (let k = 0; k < 5; k++) puffs.push([cx + (k - 2) * 1.8 + rnd(), cy + Math.sin(k) * 0.7, cz, 1.4 + rnd() * 1.1]); }
  const m = instanced(new THREE.SphereGeometry(1, 10, 8), toon(0xffffff, { emissive: tint, emissiveIntensity: 0.55 }), puffs.length, (o, i) => { const [x, y, z, s] = puffs[i]; o.position.set(x, y, z); o.scale.set(s * 1.3, s * 0.8, s); }, false);
  return m;
}
// low-poly mountain range with snow caps (instanced cones)
function peaks(x0, x1, z, rnd, { color = 0x8a93ad, snow = 0xf6f8fc, h = [10, 18], r = [7, 11], gap = [8, 13], snowLine = 0.62 } = {}) {
  const list = [];
  for (let x = x0; x < x1; x += gap[0] + rnd() * (gap[1] - gap[0])) list.push([x, h[0] + rnd() * (h[1] - h[0]), r[0] + rnd() * (r[1] - r[0]), z - rnd() * 8]);
  const g = new THREE.Group();
  const geo = new THREE.ConeGeometry(1, 1, 6, 1); geo.translate(0, 0.5, 0);
  g.add(instanced(geo, toon(color), list.length, (o, i) => { const [x, hh, rr, zz] = list[i]; o.position.set(x, -2.2, zz); o.scale.set(rr, hh + 2.2, rr * 0.8); o.rotation.y = i * 0.7; }, false));
  const cap = new THREE.ConeGeometry(1, 1, 6, 1); cap.translate(0, 0.5, 0);
  g.add(instanced(cap, toon(snow), list.length, (o, i) => { const [x, hh, rr, zz] = list[i]; const s = 1 - snowLine; o.position.set(x, -2.2 + (hh + 2.2) * snowLine + 0.02, zz); o.scale.set(rr * s * 1.02, (hh + 2.2) * s, rr * 0.8 * s * 1.02); o.rotation.y = i * 0.7; }, false));
  return g;
}
function trunkCrownTrees(list, { trunk = 0x6d4a2a, crown = 0x3d7f3a, crownGeo = new THREE.SphereGeometry(1, 10, 8), trunkH = 1.2, crownY = 1.0, crownScale = [1.1, 0.95, 1.1] } = {}) {
  const g = new THREE.Group();
  const tg = new THREE.CylinderGeometry(0.12, 0.16, trunkH, 6);
  g.add(instanced(tg, toon(trunk), list.length, (o, i) => { const [x, y, z, s = 1] = list[i]; o.position.set(x, y + trunkH / 2 * s, z); o.scale.setScalar(s); }));
  const ink = crownGeo.clone(); ink.scale(1.06, 1.06, 1.06);
  g.add(instancedInked(crownGeo, ink, toon(crown), list.length, (o, i) => { const [x, y, z, s = 1] = list[i]; o.position.set(x, y + (trunkH + crownY * 0.6) * s, z); o.scale.set(crownScale[0] * s, crownScale[1] * s, crownScale[2] * s); }));
  return g;
}
function firs(list, color = 0x24503a) {
  const geo = merge([new THREE.ConeGeometry(0.9, 1.6, 7).translate(0, 1.2, 0), new THREE.ConeGeometry(0.72, 1.4, 7).translate(0, 2.0, 0), new THREE.ConeGeometry(0.5, 1.2, 7).translate(0, 2.7, 0), new THREE.CylinderGeometry(0.12, 0.14, 0.8, 6).translate(0, 0.4, 0)]);
  const ink = geo.clone(); ink.scale(1.08, 1.04, 1.08);
  return instancedInked(geo, ink, toon(color), list.length, (o, i) => { const [x, y, z, s = 1] = list[i]; o.position.set(x, y, z); o.scale.setScalar(s); });
}
function houses(list, { wall = 0xf7f3ea, roof = 0xc8643a, w = 1.6, h = 1.4, d = 1.4, roofH = 0.8, gable = false }) {
  const g = new THREE.Group();
  const hg = new THREE.BoxGeometry(w, h, d); hg.translate(0, h / 2, 0);
  let rg;
  if (gable) { const sh = new THREE.Shape(); sh.moveTo(-w / 2 - 0.2, 0); sh.lineTo(0, roofH); sh.lineTo(w / 2 + 0.2, 0); sh.lineTo(-w / 2 - 0.2, 0); rg = new THREE.ExtrudeGeometry(sh, { depth: d + 0.3, bevelEnabled: false }); rg.translate(0, h, -(d + 0.3) / 2); }
  else { rg = new THREE.ConeGeometry(Math.max(w, d) * 0.78, roofH, 4, 1); rg.rotateY(Math.PI / 4); rg.translate(0, h + roofH / 2, 0); }
  const hInk = hg.clone(); hInk.scale(1.05, 1.03, 1.05); const rInk = rg.clone(); rInk.scale(1.05, 1.05, 1.05);
  const place = (o, i) => { const [x, y, z, s = 1, ry = 0] = list[i]; o.position.set(x, y, z); o.scale.set(1, s, 1); o.rotation.y = ry; };
  g.add(instancedInked(hg, hInk, toon(wall), list.length, place));
  g.add(instancedInked(rg, rInk, toon(roof), list.length, place));
  // windows on the front
  const win = new THREE.BoxGeometry(0.28, 0.32, 0.04);
  g.add(instanced(win, toon(0x2a3550), list.length * 2, (o, i) => { const [x, y, z, s = 1, ry = 0] = list[i >> 1]; o.position.set(x + (i % 2 ? 0.35 : -0.35) * w / 1.6, y + h * s * 0.55, z + d / 2 + 0.02); o.rotation.y = ry; }, false));
  return g;
}
function along(x0, x1, stepMin, stepMax, rnd, fn) { const out = []; for (let x = x0; x < x1; x += stepMin + rnd() * (stepMax - stepMin)) { const r = fn(x); if (r) out.push(r); } return out; }

// ------------------------------------------------------------------ textures per country
const TEX = {};
function soilTex(c1, c2, peb) {
  return TEX['soil' + c1 + c2] ||= canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = c1; c.fillRect(0, 0, w, h);
    for (let y = 18; y < h; y += 52) { c.fillStyle = c2; c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= w; x += 16) c.lineTo(x, y + Math.sin(x / 26) * 5); c.lineTo(w, y + 16); for (let x = w; x >= 0; x -= 16) c.lineTo(x, y + 16 + Math.sin(x / 20) * 4); c.fill(); }
    c.fillStyle = 'rgba(40,20,10,0.16)'; for (let y = 0; y < h; y += 10) for (let x = (y / 10) % 2 * 5; x < w; x += 10) { c.beginPath(); c.arc(x, y, 1.6, 0, 7); c.fill(); }
    for (let i = 0; i < 16; i++) { const x = (i * 71) % w, y = (i * 113) % h, r = 5 + (i % 3) * 3; c.fillStyle = peb; c.beginPath(); c.ellipse(x, y, r, r * 0.7, 0, 0, 7); c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#2e1a10'; c.stroke(); }
  }, { repeat: true });
}
function grassTex(base, dark, light) {
  return TEX['grass' + base] ||= canvasTexture(256, 64, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { const x = (i * 37) % w, y = (i * 23) % h; c.strokeStyle = i % 2 ? dark : light; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y + 6); c.lineTo(x + 3, y); c.stroke(); }
  }, { repeat: true });
}
const BLOCKS = {
  azulejo: (c, w, h) => {
    c.fillStyle = '#f6efdf'; c.fillRect(0, 0, w, h); c.strokeStyle = '#1e4fa3'; c.fillStyle = '#1e4fa3';
    c.lineWidth = 10; c.strokeRect(8, 8, w - 16, h - 16);
    c.save(); c.translate(w / 2, h / 2); for (let k = 0; k < 4; k++) { c.rotate(Math.PI / 2); c.beginPath(); c.ellipse(0, -56, 26, 44, 0, 0, 7); c.fill(); }
    c.fillStyle = '#f2b632'; c.beginPath(); c.arc(0, 0, 22, 0, 7); c.fill(); c.lineWidth = 5; c.stroke(); c.restore();
    c.fillStyle = '#1e4fa3'; for (const [x, y] of [[8, 8], [w - 8, 8], [8, h - 8], [w - 8, h - 8]]) { c.beginPath(); c.arc(x, y, 30, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(20, 20, 70, 14); c.fillStyle = '#c9b996'; c.fillRect(0, 0, w, 4); c.fillRect(0, 0, 4, h);
  },
  fern: (c, w, h) => { // silver fern on a black tile
    c.fillStyle = '#16181c'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3a3f48'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
    c.save(); c.translate(w * 0.28, h * 0.88); c.rotate(-0.75); c.strokeStyle = '#e9eef2'; c.fillStyle = '#e9eef2'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(10, -90, 0, -190); c.stroke();
    for (let i = 1; i < 12; i++) { const y = -i * 15, len = 46 * Math.sin(Math.PI * (1 - i / 13)) + 6; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * len / 2, y - 4, len / 2, 5, s * -0.35, 0, 7); c.fill(); } }
    c.restore();
  },
  knit: (c, w, h) => { // Norwegian sweater pattern
    c.fillStyle = '#b3262e'; c.fillRect(0, 0, w, h); c.fillStyle = '#f4efe6';
    const cell = 16;
    const star = [[0,0,0,1,0,0,0],[0,1,0,1,0,1,0],[0,0,1,1,1,0,0],[1,1,1,0,1,1,1],[0,0,1,1,1,0,0],[0,1,0,1,0,1,0],[0,0,0,1,0,0,0]];
    star.forEach((row, y) => row.forEach((v, x) => { if (v) c.fillRect(72 + x * cell, 72 + y * cell, cell - 2, cell - 2); }));
    for (let x = 0; x < w; x += cell) { if ((x / cell) % 2 === 0) { c.fillRect(x, 8, cell - 2, cell - 2); c.fillRect(x, h - 24, cell - 2, cell - 2); } else { c.fillRect(x, 24, cell - 2, cell - 2); c.fillRect(x, h - 40, cell - 2, cell - 2); } }
    c.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
  },
  chocolate: (c, w, h) => {
    c.fillStyle = '#4a2716'; c.fillRect(0, 0, w, h);
    for (const [x, y] of [[0, 0], [128, 0], [0, 128], [128, 128]]) {
      c.fillStyle = '#6b3a20'; c.fillRect(x + 8, y + 8, 112, 112); c.fillStyle = '#8a5030'; c.fillRect(x + 8, y + 8, 112, 14); c.fillRect(x + 8, y + 8, 14, 112);
      c.fillStyle = '#3a1d10'; c.fillRect(x + 8, y + 106, 112, 14); c.fillRect(x + 106, y + 8, 14, 112);
      c.fillStyle = '#5a311b'; c.fillRect(x + 30, y + 30, 68, 68);
    }
  },
  banig: (c, w, h) => { // woven mat
    const cols = ['#e63946', '#ffd23f', '#2a9d8f', '#f4a261', '#7b2cbf'];
    c.fillStyle = '#e9d3a3'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { const d = Math.abs(((x + y) / 16) % 8 - 4) + Math.abs(((x - y + 512) / 16) % 8 - 4); if (d < 3) { c.fillStyle = cols[(d + (x >> 6)) % cols.length]; c.fillRect(x + 1, y + 1, 14, 14); } }
    c.strokeStyle = 'rgba(90,60,20,0.35)'; c.lineWidth = 2; for (let i = 0; i < w; i += 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); }
  },
  plain: (c, w, h, col = '#c9ccd6') => { c.fillStyle = col; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); },
};
function blockTex(kind, col) { return TEX['blk' + kind + (col || '')] ||= canvasTexture(256, 256, (c, w, h) => BLOCKS[kind](c, w, h, col), { repeat: true }); }
function woodTex() {
  return TEX.wood ||= canvasTexture(256, 64, (c, w, h) => {
    c.fillStyle = '#9a6234'; c.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 9) { c.strokeStyle = 'rgba(70,35,12,0.45)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= w; x += 20) c.lineTo(x, y + Math.sin(x / 30 + y) * 2); c.stroke(); }
    c.fillStyle = '#5a3416'; c.fillRect(126, 0, 4, h); c.fillStyle = '#d9d3c4'; for (const x of [12, 116, 140, 244]) { c.beginPath(); c.arc(x, h / 2, 4, 0, 7); c.fill(); }
  }, { repeat: true });
}
function bambooTex() {
  return TEX.bamboo ||= canvasTexture(256, 64, (c, w, h) => {
    for (let y = 0; y < h; y += 16) { c.fillStyle = y % 32 ? '#c9b35a' : '#b9a24a'; c.fillRect(0, y, w, 16); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(0, y + 3, w, 3); c.fillStyle = '#6f5f22'; for (let x = (y % 32) * 2; x < w; x += 64) c.fillRect(x, y, 4, 16); }
  }, { repeat: true });
}
function stripedTex(key, w, h, draw) { return TEX[key] ||= canvasTexture(w, h, draw, { repeat: true }); }

// ------------------------------------------------------------------ collectibles (one model per country)
const ITEMS = {
  orange() {
    const g = new THREE.Group();
    g.add(sphere(0.24, toon(0xf28a12), { seg: 14 }));
    const leaf = sphere(0.09, toon(0x3f8f3a), { seg: 8, outline: 0.02 }); leaf.scale.set(1.6, 0.5, 0.8); leaf.position.set(0.08, 0.23, 0); leaf.rotation.z = -0.5; g.add(leaf);
    return g;
  },
  kiwi() {
    const g = new THREE.Group();
    const skin = sphere(0.24, toon(0x8a6236), { seg: 14 }); skin.scale.set(1, 0.85, 0.85); g.add(skin);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), toon(0xffffff, { map: stripedTex('kiwiface', 128, 128, (c, w) => { c.fillStyle = '#7cc242'; c.fillRect(0, 0, w, w); c.fillStyle = '#b8e07a'; c.beginPath(); c.arc(64, 64, 52, 0, 7); c.fill(); c.fillStyle = '#7cc242'; c.beginPath(); c.arc(64, 64, 40, 0, 7); c.fill(); c.fillStyle = '#f2f6d8'; c.beginPath(); c.arc(64, 64, 16, 0, 7); c.fill(); c.fillStyle = '#1a1222'; for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283; c.beginPath(); c.ellipse(64 + Math.cos(a) * 26, 64 + Math.sin(a) * 26, 2.5, 5, a, 0, 7); c.fill(); } }) }));
    face.position.z = 0.205; g.add(face);
    return g;
  },
  waffle() {
    const sh = new THREE.Shape(); sh.moveTo(0, -0.24); sh.bezierCurveTo(-0.08, -0.14, -0.3, -0.02, -0.3, 0.12); sh.bezierCurveTo(-0.3, 0.26, -0.12, 0.3, 0, 0.17); sh.bezierCurveTo(0.12, 0.3, 0.3, 0.26, 0.3, 0.12); sh.bezierCurveTo(0.3, -0.02, 0.08, -0.14, 0, -0.24);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2 }); geo.translate(0, 0, -0.05);
    const tex = stripedTex('waffle', 64, 64, (c, w) => { c.fillStyle = '#e5a64a'; c.fillRect(0, 0, w, w); c.fillStyle = '#b8742a'; for (let i = 0; i < w; i += 12) { c.fillRect(i, 0, 4, w); c.fillRect(0, i, w, 4); } });
    tex.repeat.set(3, 3);
    const m = new THREE.Mesh(geo, toon(0xffffff, { map: tex })); const ink = new THREE.Mesh(geo.clone().scale(1.12, 1.12, 1.5), inkMaterial()); m.add(ink);
    const g = new THREE.Group(); g.add(m); return g;
  },
  cheese() {
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 3, 1, false, 0, Math.PI * 0.5); geo.rotateX(Math.PI / 2);
    const tex = stripedTex('cheese', 64, 64, (c, w) => { c.fillStyle = '#ffd34d'; c.fillRect(0, 0, w, w); c.fillStyle = '#e8b52e'; for (const [x, y, r] of [[16, 18, 7], [44, 30, 9], [24, 48, 5], [52, 54, 4]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } });
    const m = new THREE.Mesh(geo, toon(0xffffff, { map: tex })); m.position.set(-0.12, -0.12, 0); const ink = new THREE.Mesh(geo.clone().scale(1.15, 1.15, 1.4), inkMaterial()); m.add(ink); g.add(m);
    return g;
  },
  mango() {
    const g = new THREE.Group();
    const b = sphere(0.24, toon(0xffb627), { seg: 14 }); b.scale.set(0.8, 1.05, 0.75); b.rotation.z = 0.35; g.add(b);
    const blush = sphere(0.16, toon(0xff6b3d), { seg: 10, outline: 0 }); blush.position.set(0.07, -0.07, 0.07); blush.scale.set(1, 1.1, 0.9); g.add(blush);
    const leaf = sphere(0.08, toon(0x3f8f3a), { seg: 8, outline: 0.02 }); leaf.scale.set(1.8, 0.45, 0.8); leaf.position.set(0.1, 0.25, 0); leaf.rotation.z = -0.4; g.add(leaf);
    return g;
  },
  ball() {
    const g = new THREE.Group(); g.add(sphere(0.22, toon(0xffffff), { seg: 14 })); return g;
  },
};
export function itemModel(kind) { const g = (ITEMS[kind] || ITEMS.ball)(); g.add(glowSprite(0xffd27a, 1.2, 0.45)); return g; }
export const ITEM_ICON = {
  orange: '<circle cx="10" cy="11" r="7.5" fill="#f28a12" stroke="#1a1222" stroke-width="2"/><path d="M10 4c2-3 5-3 6-2-1 2-3 3-6 2Z" fill="#3f8f3a" stroke="#1a1222" stroke-width="1.5"/>',
  kiwi: '<circle cx="10" cy="10" r="8" fill="#8a6236" stroke="#1a1222" stroke-width="2"/><circle cx="10" cy="10" r="5.5" fill="#7cc242"/><circle cx="10" cy="10" r="2" fill="#f2f6d8"/>',
  waffle: '<path d="M10 17 2.5 9.5A4.4 4.4 0 0 1 10 4.6a4.4 4.4 0 0 1 7.5 4.9Z" fill="#e5a64a" stroke="#1a1222" stroke-width="2"/><path d="M5 8h10M5 11h10M7 5v9M10 5v11M13 5v9" stroke="#b8742a" stroke-width="1.2"/>',
  cheese: '<path d="M2 15 17 5v10Z" fill="#ffd34d" stroke="#1a1222" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="1.6" fill="#e8b52e"/><circle cx="8" cy="13.5" r="1" fill="#e8b52e"/>',
  mango: '<ellipse cx="10" cy="11" rx="6" ry="7.5" transform="rotate(20 10 11)" fill="#ffb627" stroke="#1a1222" stroke-width="2"/><path d="M11 4c2-2 4-2 5-1-1 2-3 2-5 1Z" fill="#3f8f3a" stroke="#1a1222" stroke-width="1.2"/>',
  ball: '<circle cx="10" cy="10" r="8" fill="#fff" stroke="#1a1222" stroke-width="2"/>',
};
export const ITEM_NAME = { orange: 'oranges', kiwi: 'kiwi fruit', waffle: 'waffle hearts', cheese: 'pieces of cheese', mango: 'mangoes', ball: 'footballs' };

// ------------------------------------------------------------------ animals and landmarks
function bull(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); const m = toon(0x1f1a1c);
  const b = box(2.2, 1.1, 0.9, m, { outline: 0.05 }); b.position.y = 1.3; g.add(b);
  const h = box(0.8, 0.7, 0.7, m, { outline: 0.05 }); h.position.set(1.4, 1.6, 0); g.add(h);
  for (const dz of [-0.3, 0.3]) { const horn = cone(0.08, 0.5, toon(0xeee6d4), { outline: 0.02 }); horn.position.set(1.5, 2.1, dz); horn.rotation.z = -0.4; horn.rotation.x = dz > 0 ? 0.4 : -0.4; g.add(horn); }
  for (const [dx, dz] of [[-0.8, -0.3], [-0.8, 0.3], [0.8, -0.3], [0.8, 0.3]]) { const l = box(0.22, 0.9, 0.22, m, { outline: 0.04 }); l.position.set(dx, 0.45, dz); g.add(l); }
  return g;
}
function quadruped(x, y, z, { body = 0x7a5a3a, head = null, w = 1.6, h = 0.8, legs = 0.7, horns = null, patches = null, antlers = false, scale = 1 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(scale);
  const m = toon(body), hm = toon(head ?? body);
  const b = box(w, h, h * 0.9, m, { outline: 0.05 }); b.position.y = legs + h / 2; g.add(b);
  if (patches) for (const [px, py] of [[-0.3, 0.1], [0.25, -0.15]]) { const p = box(w * 0.28, h * 0.5, h * 0.95, toon(patches), { outline: 0 }); p.position.set(px * w, legs + h / 2 + py * h, 0); g.add(p); }
  const hd = box(h * 0.75, h * 0.7, h * 0.65, hm, { outline: 0.05 }); hd.position.set(w / 2 + h * 0.3, legs + h * 0.85, 0); g.add(hd);
  for (const [dx, dz] of [[-w * 0.36, -h * 0.28], [-w * 0.36, h * 0.28], [w * 0.36, -h * 0.28], [w * 0.36, h * 0.28]]) { const l = box(0.18, legs, 0.18, m, { outline: 0.04 }); l.position.set(dx, legs / 2, dz); g.add(l); }
  if (horns) for (const dz of [-1, 1]) { const hn = cone(0.07, 0.55, toon(horns), { outline: 0.02 }); hn.position.set(w / 2 + h * 0.25, legs + h * 1.25, dz * 0.3); hn.rotation.x = dz * 0.9; hn.rotation.z = -0.3; g.add(hn); }
  if (antlers) for (const dz of [-1, 1]) { const a = box(0.06, 0.08, 0.7, toon(0xd9c8a2), { outline: 0.02 }); a.position.set(w / 2 + h * 0.2, legs + h * 1.3, dz * 0.45); a.rotation.x = dz * 0.35; g.add(a); for (let k = 0; k < 3; k++) { const t = box(0.05, 0.3, 0.05, toon(0xd9c8a2), { outline: 0.015 }); t.position.set(w / 2 + h * 0.2, legs + h * 1.45, dz * (0.25 + k * 0.18)); g.add(t); } }
  return g;
}
function sheepFlock(list) {
  const g = new THREE.Group();
  const wool = new THREE.SphereGeometry(0.5, 9, 7); const ink = wool.clone(); ink.scale(1.08, 1.08, 1.08);
  g.add(instancedInked(wool, ink, toon(0xf4f1e8), list.length, (o, i) => { const [x, y, z] = list[i]; o.position.set(x, y + 0.55, z); o.scale.set(1.3, 0.9, 0.9); }));
  g.add(instanced(new THREE.SphereGeometry(0.22, 8, 6), toon(0x1f1a1c), list.length, (o, i) => { const [x, y, z, d = 1] = list[i]; o.position.set(x + d * 0.62, y + 0.72, z); o.scale.set(1.2, 1, 0.9); }));
  g.add(instanced(new THREE.BoxGeometry(0.1, 0.4, 0.1), toon(0x1f1a1c), list.length * 2, (o, i) => { const [x, y, z] = list[i >> 1]; o.position.set(x + (i % 2 ? 0.35 : -0.35), y + 0.2, z); }, false));
  return g;
}
function kiwiBird() {
  const g = new THREE.Group();
  const b = sphere(0.45, toon(0x7a5a38), { seg: 12 }); b.scale.set(1.2, 0.95, 0.95); b.position.y = 0.6; g.add(b);
  const hd = sphere(0.2, toon(0x7a5a38), { seg: 10 }); hd.position.set(0.5, 0.85, 0); g.add(hd);
  const beak = cone(0.04, 0.7, toon(0xe8d9b0), { outline: 0.015 }); beak.rotation.z = -Math.PI / 2 - 0.35; beak.position.set(0.85, 0.72, 0); g.add(beak);
  for (const dz of [-0.15, 0.15]) { const l = box(0.06, 0.3, 0.06, toon(0xd9c48a), { outline: 0.015 }); l.position.set(0, 0.15, dz); g.add(l); }
  return g;
}
function skyTower(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const shaft = cylinder(0.55, 0.75, 16, toon(0xd9dde4), { outline: 0.1 }); shaft.position.y = 8; g.add(shaft);
  for (const dy of [0, 1.1]) { const pod = cylinder(1.6 - dy * 0.3, 1.3, 1.0, toon(0x9fb3c8), { outline: 0.1, seg: 16 }); pod.position.y = 16.4 + dy; g.add(pod); }
  const ring = cylinder(1.75, 1.75, 0.25, toon(0xf4f4f4), { outline: 0.06, seg: 16 }); ring.position.y = 17.1; g.add(ring);
  const mast = cylinder(0.12, 0.3, 6, toon(0xe8e8e8), { outline: 0.05 }); mast.position.y = 21; g.add(mast);
  for (const k of [0, 1, 2]) { const leg = box(0.6, 2.4, 0.6, toon(0xc9ced8), { outline: 0.06 }); leg.position.set(Math.cos(k * 2.1) * 0.9, 1.2, Math.sin(k * 2.1) * 0.9); g.add(leg); }
  return g;
}
function lighthouse(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const t = cylinder(0.55, 0.8, 4, toon(0xf6f6f2), { outline: 0.06 }); t.position.y = 2; g.add(t);
  const lamp = cylinder(0.5, 0.5, 0.6, toon(0xfff2a8, { emissive: 0xffe680, emissiveIntensity: 0.6 }), { outline: 0.05 }); lamp.position.y = 4.3; g.add(lamp);
  const cap = cone(0.65, 0.7, toon(0x2f3a4a), { outline: 0.05 }); cap.position.y = 4.95; g.add(cap);
  return g;
}
function staveChurch(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const wood = toon(0x3b2416), roof = toon(0x2a1a10), gold = toon(0xc99a3a);
  const base = box(4, 2.4, 3, wood, { outline: 0.08 }); base.position.y = 1.2; g.add(base);
  const tiers = [[4.6, 1.3, 2.4], [3.4, 1.1, 3.6], [2.4, 1.0, 4.6], [1.5, 1.6, 5.7]];
  for (const [w, h, yy] of tiers) { const r = cone(w * 0.72, h, roof, { outline: 0.07, seg: 4 }); r.rotation.y = Math.PI / 4; r.position.y = yy; g.add(r); const wall = box(w * 0.7, 0.6, w * 0.55, wood, { outline: 0.05 }); wall.position.y = yy - h * 0.55; g.add(wall); }
  for (const [dx, yy] of [[1.6, 2.9], [-1.6, 2.9], [1.0, 4.0], [-1.0, 4.0]]) { const d = cone(0.14, 0.7, gold, { outline: 0.02, seg: 5 }); d.position.set(dx, yy + 0.3, 0); d.rotation.z = dx > 0 ? -0.6 : 0.6; g.add(d); }
  const spire = cone(0.35, 2.2, roof, { outline: 0.05, seg: 6 }); spire.position.y = 7.6; g.add(spire);
  return g;
}
function longship() {
  const g = new THREE.Group();
  const hull = box(5, 0.6, 1.3, toon(0x6a4022), { outline: 0.06 }); hull.position.y = 0.3; g.add(hull);
  for (const dx of [-2.8, 2.8]) { const n = box(0.4, 1.4, 0.4, toon(0x6a4022), { outline: 0.05 }); n.position.set(dx, 0.9, 0); n.rotation.z = dx > 0 ? -0.35 : 0.35; g.add(n); }
  const mast = cylinder(0.08, 0.08, 3.2, toon(0x5a3416), { outline: 0.03 }); mast.position.y = 2; g.add(mast);
  const sail = box(2.4, 2.0, 0.06, toon(0xffffff, { map: stripedTex('vsail', 64, 64, (c, w) => { for (let x = 0; x < w; x += 16) { c.fillStyle = (x / 16) % 2 ? '#f4efe6' : '#b3262e'; c.fillRect(x, 0, 16, w); } }) }), { outline: 0.04 }); sail.position.set(0, 2.3, 0); g.add(sail);
  for (let i = 0; i < 6; i++) { const s = cylinder(0.25, 0.25, 0.06, toon([0xf2c94c, 0xb3262e][i % 2]), { outline: 0.02, seg: 10 }); s.rotation.x = Math.PI / 2; s.position.set(-2 + i * 0.8, 0.55, 0.68); g.add(s); }
  return g;
}
function waterfall(x, y0, y1, z) {
  const tex = stripedTex('fall', 32, 128, (c, w, h) => { c.fillStyle = '#e8f4ff'; c.fillRect(0, 0, w, h); c.fillStyle = '#a8d4f5'; for (let y = 0; y < h; y += 16) c.fillRect((y * 7) % w, y, 6, 10); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, y1 - y0), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95 }));
  m.position.set(x, (y0 + y1) / 2, z); tex.repeat.set(1, (y1 - y0) / 4);
  return { mesh: m, tex };
}
function matterhorn(x, y, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s);
  const H = 26, bend = geo => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const k = p.getY(i) / H; p.setX(i, p.getX(i) + k * k * 3.5); p.setZ(i, p.getZ(i) * (1 - k * 0.2)); } geo.computeVertexNormals(); return geo; };
  const rock = bend(new THREE.ConeGeometry(9, H, 4, 3).translate(0, H / 2, 0));
  const snow = bend(new THREE.ConeGeometry(9 * 11 / H * 1.04, 11, 4, 2).translate(0, 15 + 5.5, 0));
  g.add(new THREE.Mesh(rock, toon(0x7d7f8f)), new THREE.Mesh(snow, toon(0xf7f9fd)));
  g.add(new THREE.Mesh(rock.clone().scale(1.03, 1.01, 1.03), inkMaterial()));
  return g;
}
function chalets(list) {
  const g = houses(list, { wall: 0x8a5532, roof: 0x3a2a22, w: 2.0, h: 1.3, d: 1.6, roofH: 1.0, gable: true });
  g.add(instanced(new THREE.BoxGeometry(2.04, 0.5, 1.64), toon(0xece6da), list.length, (o, i) => { const [x, y, z] = list[i]; o.position.set(x, y + 0.25, z); }, false));
  g.add(instanced(new THREE.BoxGeometry(1.4, 0.14, 0.18), toon(0xe63946), list.length, (o, i) => { const [x, y, z] = list[i]; o.position.set(x, y + 0.75, z + 0.85); }, false));
  return g;
}
function cableCar(x0, x1, yA, yB, z) {
  const g = new THREE.Group();
  for (const [x, y] of [[x0, yA], [x1, yB]]) { const m = box(0.4, 3, 0.4, toon(0x6b6f7a), { outline: 0.04 }); m.position.set(x, y + 1.5, z); g.add(m); }
  const pts = [new THREE.Vector3(x0, yA + 3, z), new THREE.Vector3(x1, yB + 3, z)];
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: INK })); g.add(line);
  const cab = box(1.0, 0.8, 0.8, toon(0xd8202c), { outline: 0.05 }); g.add(cab);
  const win = box(0.7, 0.3, 0.82, toon(0xbfe3ff), { outline: 0 }); cab.add(win); win.position.y = 0.12;
  const arm = box(0.06, 0.6, 0.06, toon(0x3a3a44), { outline: 0 }); arm.position.y = 0.7; cab.add(arm);
  let t = 0;
  const anim = dt => { t += dt * 0.05; const k = (Math.sin(t * 6.283) + 1) / 2; cab.position.set(x0 + (x1 - x0) * k, yA + 3 + (yB - yA) * k - 1.05, z); };
  anim(0);
  return { group: g, anim };
}
function swissFlag(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const pole = cylinder(0.05, 0.05, 3, toon(0xd9d9d9), { outline: 0.02 }); pole.position.y = 1.5; g.add(pole);
  const tex = stripedTex('chflag', 64, 64, (c, w) => { c.fillStyle = '#da291c'; c.fillRect(0, 0, w, w); c.fillStyle = '#fff'; c.fillRect(26, 12, 12, 40); c.fillRect(12, 26, 40, 12); });
  const f = box(0.9, 0.9, 0.04, toon(0xffffff, { map: tex }), { outline: 0.03 }); f.position.set(0.5, 2.5, 0); g.add(f);
  return g;
}
function palms(list) {
  const g = new THREE.Group();
  const trunk = new THREE.CylinderGeometry(0.13, 0.2, 1, 6); trunk.translate(0, 0.5, 0);
  const segs = 5;
  g.add(instanced(trunk, toon(0x9a7a4a), list.length * segs, (o, i) => { const [x, y, z, s = 1, lean = 0.2] = list[Math.floor(i / segs)]; const k = i % segs; o.position.set(x + Math.pow(k / segs, 2) * lean * 4 * s, y + k * 0.95 * s, z); o.rotation.z = -lean * k / segs * 1.4; o.scale.set(s * (1 - k * 0.08), s, s * (1 - k * 0.08)); }));
  const frond = new THREE.ConeGeometry(0.28, 2.4, 4); frond.rotateZ(-Math.PI / 2); frond.translate(1.2, 0, 0); frond.scale(1, 0.25, 1);
  const n = 7;
  g.add(instanced(frond, toon(0x3f9a3a), list.length * n, (o, i) => { const [x, y, z, s = 1, lean = 0.2] = list[Math.floor(i / n)]; const k = i % n; o.position.set(x + lean * 4 * s * 0.85, y + segs * 0.95 * s, z); o.rotation.set(0, k / n * 6.283, -0.5); o.scale.setScalar(s); }));
  g.add(instanced(new THREE.SphereGeometry(0.14, 6, 5), toon(0x6b4a22), list.length * 3, (o, i) => { const [x, y, z, s = 1, lean = 0.2] = list[Math.floor(i / 3)]; const k = i % 3; o.position.set(x + lean * 4 * s * 0.85 + Math.cos(k * 2.1) * 0.2, y + segs * 0.95 * s - 0.2, z + Math.sin(k * 2.1) * 0.2); }, false));
  return g;
}
function nipaHuts(list) {
  const g = new THREE.Group();
  g.add(instanced(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 5).translate(0, 0.6, 0), toon(0x8a6a2a), list.length * 4, (o, i) => { const [x, y, z] = list[i >> 2]; const k = i % 4; o.position.set(x + (k % 2 ? 0.7 : -0.7), y, z + (k > 1 ? 0.55 : -0.55)); }, false));
  const hut = new THREE.BoxGeometry(1.7, 1.0, 1.4).translate(0, 1.7, 0); const hInk = hut.clone().scale(1.05, 1.04, 1.05);
  g.add(instancedInked(hut, hInk, toon(0xd9b878), list.length, (o, i) => { const [x, y, z] = list[i]; o.position.set(x, y, z); }));
  const roof = new THREE.ConeGeometry(1.55, 1.5, 4).rotateY(Math.PI / 4).translate(0, 2.95, 0); const rInk = roof.clone().scale(1.06, 1.05, 1.06);
  g.add(instancedInked(roof, rInk, toon(0xb08a42), list.length, (o, i) => { const [x, y, z] = list[i]; o.position.set(x, y, z); }));
  return g;
}
function mayon(x, y, z, s = 1) {
  const pts = []; for (let i = 0; i <= 12; i++) { const k = i / 12; pts.push(new THREE.Vector2(Math.max(0.6, 14 * Math.pow(1 - k, 1.6)), k * 18)); }
  const geo = new THREE.LatheGeometry(pts, 24);
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s);
  const m = new THREE.Mesh(geo, toon(0x6f7d8a)); g.add(m);
  const top = new THREE.Mesh(new THREE.LatheGeometry(pts.slice(8).map(p => new THREE.Vector2(p.x * 1.02, p.y)), 24), toon(0xa9b2bd)); g.add(top);
  const ink = new THREE.Mesh(geo.clone().scale(1.02, 1.01, 1.02), inkMaterial()); g.add(ink);
  const smoke = []; for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), toon(0xf2f2f2, { emissive: 0xdadada, emissiveIntensity: 0.5 })); g.add(p); smoke.push({ p, ph: i / 6 }); }
  const anim = dt => { for (const s2 of smoke) { s2.ph = (s2.ph + dt * 0.06) % 1; const k = s2.ph; s2.p.position.set(k * 6, 18.5 + k * 7, 0); s2.p.scale.setScalar(1 + k * 2.4); s2.p.visible = k < 0.95; } };
  anim(0);
  return { group: g, anim };
}
function jeepney() {
  const g = new THREE.Group();
  const cols = [0xe63946, 0xffd23f, 0x2a9d8f, 0x3a86ff];
  const body = box(3.4, 1.1, 1.4, toon(0xf2f2f2), { outline: 0.05 }); body.position.y = 0.95; g.add(body);
  for (let i = 0; i < 4; i++) { const st = box(3.42, 0.12, 1.42, toon(cols[i]), { outline: 0 }); st.position.y = 0.6 + i * 0.18; g.add(st); }
  const roof = box(3.6, 0.15, 1.5, toon(0x3a86ff), { outline: 0.04 }); roof.position.y = 1.6; g.add(roof);
  const hood = box(1.0, 0.7, 1.2, toon(0xc9ced8), { outline: 0.04 }); hood.position.set(2.1, 0.7, 0); g.add(hood);
  const grill = box(0.06, 0.5, 0.9, toon(0x9a9faa), { outline: 0.02 }); grill.position.set(2.62, 0.7, 0); g.add(grill);
  const horse = box(0.35, 0.3, 0.08, toon(0xd9d9d9), { outline: 0.02 }); horse.position.set(2.4, 1.2, 0); g.add(horse);
  for (const [dx, dz] of [[-1.1, -0.7], [-1.1, 0.7], [1.9, -0.65], [1.9, 0.65]]) { const w = cylinder(0.32, 0.32, 0.2, toon(0x1f1a1c), { outline: 0.03, seg: 12 }); w.rotation.x = Math.PI / 2; w.position.set(dx, 0.32, dz); g.add(w); }
  return g;
}
function banca() {
  const g = new THREE.Group();
  const hull = box(3.2, 0.4, 0.6, toon(0x3a86ff), { outline: 0.05 }); hull.position.y = 0.2; g.add(hull);
  const top = box(3.0, 0.08, 0.62, toon(0xffd23f), { outline: 0 }); top.position.y = 0.42; g.add(top);
  for (const dz of [-1.2, 1.2]) { const fl = cylinder(0.08, 0.08, 3.2, toon(0xc9b35a), { outline: 0.02 }); fl.rotation.z = Math.PI / 2; fl.position.set(0, 0.1, dz); g.add(fl); const arm = box(0.08, 0.08, 2.4, toon(0x8a6a2a), { outline: 0.02 }); arm.position.set(dx(dz), 0.5, 0); g.add(arm); }
  function dx(dz) { return dz > 0 ? 0.8 : -0.8; }
  return g;
}
function carabao(x, y, z) { return quadruped(x, y, z, { body: 0x55565e, w: 1.9, h: 0.95, legs: 0.6, horns: 0xd9cfb8 }); }

// ------------------------------------------------------------------ the worlds
// Each world: sky + fog colours, strip materials, item, and build(x0, x1, zOff) -> { group, anim }
export const WORLDS = {
  ESP: {
    name: 'Spain', item: 'orange', sky: [0x2f7fe0, 0xf6dcc0], fog: 0xf3dcc0, sun: true,
    soil: ['#b9643a', '#a4532e', '#d58a5c'], grass: ['#9fb23f', '#7f9a2e', '#c3cf62'], tuft: 0x7d9a2e, block: 'azulejo', ledge: 'wood', blockInk: 0x1e4fa3,
    build(x0, x1, zo, rnd) {
      const group = new THREE.Group(), anim = [];
      group.add(plain(x0, x1, 0xb3a253));
      const near = ridge(x0, x1, -10 + zo, -2.2, 3.5, 0.2, 0x8f9e3c, 1.3, 1.2), mid = ridge(x0, x1, -26 + zo, -2.2, 6, 1.5, 0xd8b158, 4.1, 2), far = ridge(x0 - 40, x1 + 40, -62 + zo, -2.2, 14, 3, 0x9a96b8, 7.7, 3);
      group.add(near, mid, far);
      const hs = []; for (let x = x0 + 8; x < x1 - 8; x += 7 + rnd() * 9) { const n = 2 + Math.floor(rnd() * 4); for (let i = 0; i < n; i++) { const xx = x + i * 1.9; hs.push([xx, near.userData.height(xx) * 0.6 - 0.6, -12 - rnd() * 4 + zo, 0.8 + (i % 3) * 0.25]); } }
      group.add(houses(hs, { wall: 0xf7f3ea, roof: 0xc8643a }));
      const trees = along(x0, x1, 3, 8, rnd, x => [x, -2.2, -4.2 - rnd() * 4 + zo]);
      group.add(trunkCrownTrees(trees, { trunk: 0x6d4a2a, crown: 0x3d7f3a }));
      const fruits = []; trees.forEach(([x, , z]) => { for (let k = 0; k < 6; k++) { const a = rnd() * 6.28, b = rnd() * 1.2 - 0.3; fruits.push([x + Math.cos(a) * 1.05 * Math.cos(b), -2.2 + 1.8 + Math.sin(b) * 0.95, z + Math.sin(a) * 1.05 * Math.cos(b)]); } });
      group.add(instanced(new THREE.SphereGeometry(0.14, 6, 5), toon(0xf28a12), fruits.length, (o, i) => o.position.set(...fruits[i]), false));
      group.add(firs(along(x0 + 4, x1, 9, 19, rnd, x => [x, -2.2, -7 - rnd() * 3 + zo, 1.2]), 0x2f5a3a));
      const windmill = (x, y, z) => {
        const g = new THREE.Group(); g.position.set(x, y, z);
        const tower = cylinder(0.9, 1.2, 4.2, toon(0xf6f2ea), { outline: 0.08 }); tower.position.y = 2.1; g.add(tower);
        const roof = cone(1.15, 1.4, toon(0x2b2b33), { outline: 0.08 }); roof.position.y = 4.9; g.add(roof);
        const sails = new THREE.Group(); sails.position.set(0, 4.1, 1.35); g.add(sails);
        for (let k = 0; k < 4; k++) { const arm = new THREE.Group(); arm.rotation.z = k * Math.PI / 2; sails.add(arm); const spar = box(0.12, 3.4, 0.08, toon(0x6b5040), { outline: 0.03 }); spar.position.y = 1.7; arm.add(spar); const cloth = box(0.7, 2.4, 0.04, toon(0xe8dcc6), { outline: 0.03 }); cloth.position.set(0.42, 2.1, 0); arm.add(cloth); }
        anim.push(dt => { sails.rotation.z += dt * 0.6; });
        return g;
      };
      for (let x = x0 + 20; x < x1 - 10; x += 55 + rnd() * 20) group.add(windmill(x, mid.userData.height(x) - 0.4, -26 + zo));
      group.add(sagrada(x0 + Math.min(70, (x1 - x0) / 2), -1, -78 + zo));
      group.add(bull(x0 + Math.min(110, (x1 - x0) * 0.7), mid.userData.height(x0 + 110) - 0.3, -24 + zo));
      const olives = along(x0, x1, 1.2, 2.4, rnd, x => [x, near.userData.height(x) - 0.25, -9.3 - rnd() * 2.5 + zo]);
      group.add(instanced(new THREE.SphereGeometry(0.55, 7, 5), toon(0x7c8c5c), olives.length, (o, i) => { o.position.set(...olives[i]); o.scale.set(1.2, 0.8, 1); }, false));
      return { group, anim };
    },
  },
  NZL: {
    name: 'New Zealand', item: 'kiwi', sky: [0x3d8fe0, 0xdcefff], fog: 0xd6e6ee, sun: true,
    soil: ['#6e4428', '#5a3520', '#9a6a44'], grass: ['#6fbf45', '#4f9a34', '#9adf63'], tuft: 0x4f9a34, block: 'fern', ledge: 'wood', blockInk: 0x16181c,
    build(x0, x1, zo, rnd) {
      const group = new THREE.Group(), anim = [];
      group.add(plain(x0, x1, 0x5c9a3a));
      const near = ridge(x0, x1, -10 + zo, -2.2, 4.2, 0.4, 0x6fbf45, 2.2, 1.2), mid = ridge(x0, x1, -26 + zo, -2.2, 7, 2, 0x4f9a3a, 5.3, 2);
      group.add(near, mid);
      group.add(peaks(x0 - 30, x1 + 30, -60 + zo, rnd, { color: 0x7d88a8, h: [14, 22], r: [7, 11] }));
      // lake in front of the mountains
      const lake = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 60, 14), toon(0x4aa3d8, { unique: true })); lake.rotation.x = -Math.PI / 2; lake.position.set((x0 + x1) / 2, -2.15, -46 + zo); group.add(lake);
      // sheep on the hills
      const sheep = along(x0 + 6, x1 - 6, 3, 7, rnd, x => { const z = -11 - rnd() * 3 + zo; return [x, near.userData.height(x) - 0.55, z, rnd() < 0.5 ? 1 : -1]; });
      group.add(sheepFlock(sheep));
      const sheepMid = along(x0, x1, 4, 9, rnd, x => [x, mid.userData.height(x) - 0.8, -27 + zo, 1]);
      group.add(sheepFlock(sheepMid));
      // tree ferns and round bush close behind the strip
      const fernCrown = merge(Array.from({ length: 8 }, (_, k) => { const g = new THREE.ConeGeometry(0.22, 1.9, 4); g.rotateZ(-Math.PI / 2 + 0.5); g.translate(0.85, -0.25, 0); g.rotateY(k / 8 * 6.283); return g; }));
      const ferns = along(x0, x1, 3.5, 8, rnd, x => [x, -2.2, -4 - rnd() * 4 + zo, 0.9 + rnd() * 0.4]);
      group.add(instanced(new THREE.CylinderGeometry(0.16, 0.22, 3, 6).translate(0, 1.5, 0), toon(0x4a3626), ferns.length, (o, i) => { const [x, y, z, s] = ferns[i]; o.position.set(x, y, z); o.scale.set(s, s * 1.1, s); }));
      group.add(instanced(fernCrown, toon(0x2f7a35), ferns.length, (o, i) => { const [x, y, z, s] = ferns[i]; o.position.set(x, y + 3.3 * s * 1.1, z); o.scale.setScalar(s * 1.2); }));
      group.add(trunkCrownTrees(along(x0, x1, 5, 11, rnd, x => [x, -2.2, -7 - rnd() * 2 + zo, 1.3]), { trunk: 0x5a3e2a, crown: 0x2c5e2e, crownScale: [1.3, 1.1, 1.2] }));
      // landmarks
      group.add(skyTower(x0 + (x1 - x0) * 0.55, mid.userData.height(x0 + (x1 - x0) * 0.55) - 1, -30 + zo));
      group.add(lighthouse(x0 + (x1 - x0) * 0.2, near.userData.height(x0 + (x1 - x0) * 0.2) - 0.3, -12 + zo));
      // rugby posts on a field
      const rx = x0 + (x1 - x0) * 0.82, ry = near.userData.height(rx) - 0.3;
      for (const dz of [-0.9, 0.9]) { const p = cylinder(0.06, 0.06, 3.4, toon(0xffffff), { outline: 0.02 }); p.position.set(rx, ry + 1.7, -12 + dz + zo); group.add(p); }
      const cb = cylinder(0.06, 0.06, 1.8, toon(0xffffff), { outline: 0.02 }); cb.rotation.x = Math.PI / 2; cb.position.set(rx, ry + 1.1, -12 + zo); group.add(cb);
      // kiwi birds strolling near the strip
      for (let k = 0; k < 3; k++) {
        const b = kiwiBird(); const bx = x0 + (x1 - x0) * (0.25 + k * 0.28), z = -2.6 + zo * 0.3; b.position.set(bx, 2 - 0.02, z); b.scale.setScalar(0.8); group.add(b);
        let t = rnd() * 6; anim.push(dt => { t += dt; const s = Math.sin(t * 0.35); b.position.x = bx + s * 3; b.rotation.y = Math.cos(t * 0.35) >= 0 ? 0 : Math.PI; b.position.y = 1.98 + Math.abs(Math.sin(t * 8)) * 0.04; });
      }
      return { group, anim };
    },
  },
  NOR: {
    name: 'Norway', item: 'waffle', sky: [0x3a7bd5, 0xe4eef5], fog: 0xdde6ee, sun: true,
    soil: ['#6b6660', '#57524d', '#8f8a82'], grass: ['#5f9a46', '#477a34', '#86bf5c'], tuft: 0x477a34, block: 'knit', ledge: 'wood', blockInk: 0x6e1418,
    build(x0, x1, zo, rnd) {
      const group = new THREE.Group(), anim = [];
      // the fjord: water instead of a plain
      const wTex = stripedTex('fjord', 128, 128, (c, w) => { c.fillStyle = '#2f6690'; c.fillRect(0, 0, w, w); c.fillStyle = '#4b86b4'; for (let y = 4; y < w; y += 16) for (let x = (y * 3) % 32; x < w; x += 32) c.fillRect(x, y, 14, 2); });
      wTex.repeat.set((x1 - x0) / 8, 32);
      group.add(plain(x0, x1, 0x2f6690, -2.2, wTex));
      const near = ridge(x0, x1, -12 + zo, -2.2, 5, 0.5, 0x2f5a3a, 3.1, 1.2), mid = ridge(x0, x1, -30 + zo, -2.2, 12, 3, 0x5f6874, 6.6, 2);
      group.add(near, mid);
      group.add(peaks(x0 - 30, x1 + 30, -64 + zo, rnd, { color: 0x8f98b0, h: [16, 24], r: [8, 12], snowLine: 0.5 }));
      group.add(peaks(x0, x1, -36 + zo, rnd, { color: 0x5f6874, h: [10, 15], r: [5, 8], gap: [10, 16], snowLine: 0.72 }));
      group.add(firs(along(x0, x1, 1.6, 3.2, rnd, x => [x, near.userData.height(x) - 1.5, -12.5 - rnd() * 1.5 + zo, 0.9 + rnd() * 0.5]), 0x1f4a32));
      group.add(firs(along(x0, x1, 4, 9, rnd, x => [x, -2.2, -3.5 - rnd() * 2 + zo, 1.1 + rnd() * 0.4]), 0x24503a));
      // red wooden houses on the shore
      const hs = []; for (let x = x0 + 10; x < x1 - 10; x += 14 + rnd() * 16) { const n = 1 + Math.floor(rnd() * 3); for (let i = 0; i < n; i++) hs.push([x + i * 2.4, -2.2, -8 - rnd() * 1.5 + zo, 0.9 + rnd() * 0.3]); }
      group.add(houses(hs, { wall: 0xa8322a, roof: 0x2e3a2a, w: 1.9, h: 1.5, d: 1.5, roofH: 0.9, gable: true }));
      group.add(instanced(new THREE.BoxGeometry(0.12, 2.2, 0.12), toon(0x4a3626), hs.length * 2, (o, i) => { const [x, y, z] = hs[i >> 1]; o.position.set(x + (i % 2 ? 0.7 : -0.7), y - 0.6, z + 0.9); }, false));
      { const sc = staveChurch(x0 + (x1 - x0) * 0.45, near.userData.height(x0 + (x1 - x0) * 0.45) - 0.8, -14 + zo); sc.scale.setScalar(0.62); group.add(sc); }
      // waterfall down the mid mountains
      const wx = x0 + (x1 - x0) * 0.72, wf = waterfall(wx, -1.5, mid.userData.height(wx) - 0.5, -29.2 + zo); group.add(wf.mesh); anim.push(dt => { wf.tex.offset.y += dt * 0.8; });
      // a longship sailing on the fjord
      const ship = longship(); ship.position.set(x0 + 10, -2.2, -6 + zo); group.add(ship);
      let st = 0; anim.push(dt => { st += dt; ship.position.x = x0 + 10 + ((st * 1.2) % Math.max(20, x1 - x0 - 20)); ship.position.y = -2.25 + Math.sin(st * 1.5) * 0.06; ship.rotation.z = Math.sin(st * 1.1) * 0.03; });
      // a moose on the hill
      group.add(quadruped(x0 + (x1 - x0) * 0.3, near.userData.height(x0 + (x1 - x0) * 0.3) - 0.35, -11 + zo, { body: 0x5a3a24, w: 2.1, h: 1.1, legs: 1.2, antlers: true }));
      return { group, anim };
    },
  },
  SUI: {
    name: 'Switzerland', item: 'cheese', sky: [0x2f80e8, 0xe8f2fa], fog: 0xe2ecf3, sun: true,
    soil: ['#7a5a3a', '#654a30', '#a08060'], grass: ['#86c255', '#669e3c', '#b0e07c'], tuft: 0x669e3c, block: 'chocolate', ledge: 'wood', blockInk: 0x2a140a,
    build(x0, x1, zo, rnd) {
      const group = new THREE.Group(), anim = [];
      group.add(plain(x0, x1, 0x6fa84a));
      const near = ridge(x0, x1, -10 + zo, -2.2, 4.5, 0.6, 0x8cc45a, 4.4, 1.2), mid = ridge(x0, x1, -27 + zo, -2.2, 9, 2.5, 0x5f9a46, 2.9, 2);
      group.add(near, mid);
      group.add(peaks(x0 - 30, x1 + 30, -62 + zo, rnd, { color: 0x8790a8, h: [16, 23], r: [8, 12], snowLine: 0.48 }));
      group.add(matterhorn(x0 + (x1 - x0) * 0.6, -2.2, -70 + zo, 1.05));
      group.add(firs(along(x0, x1, 2, 5, rnd, x => [x, mid.userData.height(x) - 2.2, -27.5 - rnd() + zo, 1.1 + rnd() * 0.5]), 0x2a5a36));
      group.add(firs(along(x0, x1, 5, 12, rnd, x => [x, -2.2, -4 - rnd() * 3 + zo, 1.2 + rnd() * 0.4]), 0x24503a));
      const ch = along(x0 + 8, x1 - 8, 9, 18, rnd, x => [x, near.userData.height(x) - 0.7, -11.5 - rnd() * 2 + zo]);
      group.add(chalets(ch));
      // cows with bells
      const cows = along(x0 + 5, x1 - 5, 6, 14, rnd, x => [x, near.userData.height(x) - 0.4, -10.5 - rnd() * 1.5 + zo]);
      for (const [x, y, z] of cows) { const c = quadruped(x, y, z, { body: 0xf4f1e8, head: 0x8a5a32, patches: 0x8a5a32, w: 1.5, h: 0.75, legs: 0.6, horns: 0xe8dcc0, scale: 0.9 }); c.rotation.y = rnd() < 0.5 ? 0 : Math.PI; const bell = sphere(0.1, toon(0xd9a63a), { seg: 8, outline: 0.02 }); bell.position.set(1.05, 0.75, 0); c.add(bell); group.add(c); }
      const cc = cableCar(x0 + (x1 - x0) * 0.25, x0 + (x1 - x0) * 0.25 + 24, near.userData.height(x0 + (x1 - x0) * 0.25) - 0.5, mid.userData.height(x0 + (x1 - x0) * 0.25 + 24) + 2, -18 + zo);
      group.add(cc.group); anim.push(cc.anim);
      for (let x = x0 + 15; x < x1 - 10; x += 40 + rnd() * 20) group.add(swissFlag(x, near.userData.height(x) - 0.4, -10 + zo));
      return { group, anim };
    },
  },
  PHI: {
    name: 'Philippines', item: 'mango', sky: [0x2e9be6, 0xfff1d6], fog: 0xf2e6cc, sun: true,
    soil: ['#8a4a2e', '#743b22', '#b9744a'], grass: ['#6cbf3f', '#4f9a2e', '#a2e06a'], tuft: 0x4f9a2e, block: 'banig', ledge: 'bamboo', blockInk: 0x6f4a1a,
    build(x0, x1, zo, rnd) {
      const group = new THREE.Group(), anim = [];
      const sea = stripedTex('sea', 128, 128, (c, w) => { c.fillStyle = '#21a7b5'; c.fillRect(0, 0, w, w); c.fillStyle = '#5fd0d6'; for (let y = 6; y < w; y += 18) for (let x = (y * 5) % 40; x < w; x += 40) c.fillRect(x, y, 18, 3); });
      sea.repeat.set((x1 - x0) / 8, 32);
      group.add(plain(x0, x1, 0x21a7b5, -2.2, sea));
      // rice terraces: a stepped hill with terrace walls
      const terr = stripedTex('terr', 64, 64, (c, w) => { c.fillStyle = '#7cc84a'; c.fillRect(0, 0, w, w); c.fillStyle = '#5a9a32'; c.fillRect(0, 0, w, 8); c.fillStyle = '#a6e070'; c.fillRect(0, 10, w, 4); });
      const near = ridge(x0, x1, -11 + zo, -2.2, 5.5, 0.4, 0x7cc84a, 1.7, 1.0, { steps: 0.55, map: terr, uvx: 0.05, uvy: 1 / 0.55 }), mid = ridge(x0, x1, -28 + zo, -2.2, 8, 2, 0x2f7a3a, 3.6, 2);
      group.add(near, mid);
      group.add(peaks(x0 - 30, x1 + 30, -66 + zo, rnd, { color: 0x6f8a7a, snow: 0x5f7a6a, h: [10, 15], r: [9, 13], snowLine: 0.8 }));
      const vo = mayon(x0 + (x1 - x0) * 0.5, -2.2, -72 + zo, 1.1); group.add(vo.group); anim.push(vo.anim);
      group.add(palms(along(x0, x1, 3, 7, rnd, x => [x, -2.2, -3.6 - rnd() * 3.5 + zo, 0.9 + rnd() * 0.4, (rnd() - 0.3) * 0.5])));
      group.add(palms(along(x0, x1, 2.5, 5, rnd, x => [x, mid.userData.height(x) - 1.2, -28.5 - rnd() + zo, 1.1, 0.15])));
      const huts = along(x0 + 10, x1 - 10, 12, 22, rnd, x => [x, -2.2, -7.5 - rnd() * 1.2 + zo]);
      group.add(nipaHuts(huts));
      // a jeepney on the coast road
      const road = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.1, 2.2), toon(0x8a8478)); road.position.set((x0 + x1) / 2, -2.1, -14.5 + zo); group.add(road);
      const jp = jeepney(); jp.position.set(x0, -2.05, -14.5 + zo); group.add(jp);
      let jt = 0; anim.push(dt => { jt += dt; const span = Math.max(30, x1 - x0); const k = (jt * 3.2) % (span * 2); const fwd = k < span; jp.position.x = x0 + (fwd ? k : span * 2 - k); jp.rotation.y = fwd ? 0 : Math.PI; jp.position.y = -2.05 + Math.abs(Math.sin(jt * 9)) * 0.04; });
      const boat = banca(); boat.position.set(x0 + 30, -2.2, -5 + zo); group.add(boat);
      let bt = 0; anim.push(dt => { bt += dt; boat.position.y = -2.18 + Math.sin(bt * 1.4) * 0.05; boat.rotation.z = Math.sin(bt) * 0.04; boat.position.x = x0 + 30 + Math.sin(bt * 0.1) * 12; });
      group.add(carabao(x0 + (x1 - x0) * 0.4, near.userData.height(x0 + (x1 - x0) * 0.4) - 0.5, -11.5 + zo));
      return { group, anim };
    },
  },
};
function sagrada(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(0.62);
  const stone = toon(0xd2ad7c), dark = toon(0xa9845a), gold = toon(0xf0bf4c);
  const nave = box(14, 7, 6, stone, { outline: 0.15 }); nave.position.y = 3.5; g.add(nave);
  const spire = (sx, h, r, sz = 0) => {
    const s = cylinder(r * 0.35, r, h, stone, { outline: 0.12, seg: 10 }); s.position.set(sx, 7 + h / 2, sz); g.add(s);
    for (let yy = 1.5; yy < h - 1; yy += 1.6) { const ring = cylinder(r * (1 - yy / h * 0.62) + 0.06, r * (1 - yy / h * 0.62) + 0.06, 0.2, dark, { outline: 0, seg: 10 }); ring.position.set(sx, 7 + yy, sz); g.add(ring); }
    const tip = sphere(r * 0.42, gold, { seg: 10, outline: 0.08 }); tip.position.set(sx, 7 + h + r * 0.2, sz); g.add(tip);
  };
  spire(-5.5, 11, 1.1, 1); spire(-2.5, 14, 1.25, 1); spire(2.5, 14, 1.25, 1); spire(5.5, 11, 1.1, 1);
  spire(0, 21, 1.6, -1); spire(-3.6, 16, 1.2, -1.6); spire(3.6, 16, 1.2, -1.6);
  return g;
}

// neutral world for teams without their own (still in their colours)
function genericWorld(team) {
  const k = team?.kit?.shirt || '#3a86ff';
  return {
    name: team?.name || 'World', item: 'ball', sky: [0x3a86e0, 0xe8eef8], fog: 0xe0e8f0, sun: true,
    soil: ['#7a5a3a', '#654a30', '#a08060'], grass: ['#7cbf4a', '#5f9a3a', '#a6df70'], tuft: 0x5f9a3a, block: 'plain', blockColor: k, ledge: 'wood', blockInk: 0x1a1222,
    build(x0, x1, zo, rnd) {
      const group = new THREE.Group();
      group.add(plain(x0, x1, 0x6fa84a));
      group.add(ridge(x0, x1, -10 + zo, -2.2, 4, 0.4, 0x7cbf4a, 2.5, 1.2), ridge(x0, x1, -26 + zo, -2.2, 7, 2, shadeHex(k, -0.2), 4.5, 2), peaks(x0 - 30, x1 + 30, -60 + zo, rnd, {}));
      group.add(trunkCrownTrees(along(x0, x1, 4, 9, rnd, x => [x, -2.2, -5 - rnd() * 3 + zo]), {}));
      return { group, anim: [] };
    },
  };
}
export function world3d(team) { return WORLDS[team?.code] || genericWorld(team); }
export const hasWorld3d = code => !!WORLDS[code];

// materials for the play strip of one world
export function stripMaterials(w) {
  return {
    soil: toon(0xffffff, { map: soilTex(...w.soil) }),
    grass: toon(0xffffff, { map: grassTex(...w.grass) }),
    block: toon(0xffffff, { map: blockTex(w.block, w.blockColor) }),
    ledge: toon(0xffffff, { map: w.ledge === 'bamboo' ? bambooTex() : woodTex() }),
    tuft: toon(w.tuft, { sway: true }),
  };
}
export function buildWorldScenery(team, x0, x1, zo = 0, seed = 1) {
  const w = world3d(team), rnd = makeRnd(seed * 7919 + 17);
  const s = w.build(x0, x1, zo, rnd);
  s.group.add(clouds(x0, x1, rnd));
  return s;
}
// world 2 (group B): Australia, Ireland, Nigeria, Canada – in their own file, they get the building blocks above
Object.assign(WORLDS, installGroupB({ plain, ridge, peaks, trunkCrownTrees, firs, houses, along, instanced, instancedInked, quadruped, sheepFlock, palms, skyTower, stripedTex, ITEMS, ITEM_ICON, ITEM_NAME, BLOCKS }));

export { woodTex };
