// 3D world built from the level data: the play strip (ground, blocks, ledges, bonus banners)
// in the materials of each half's country, collectibles, checkpoints and the stadium.
// The country sceneries themselves live in themes3d.js.
/* global THREE */
import { toon, box, sphere, cylinder, cone, worldBox, outlineBoxGeo, merge, canvasTexture, glowSprite, hex, inkMaterial } from './toon.js';
import { T, TILE, ROWS } from '../shared/levelgen.js';
import { world3d, stripMaterials, itemModel, woodTex } from './themes3d.js';

export const GOAL_HALF_W = 2.6;
export const X = px => px / TILE;
export const Y = py => ROWS - py / TILE;
const Z0 = -1.6, Z1 = 1.6;
const rnd = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(12345);

// ------------------------------------------------------------------ textures
const TEX = {};
function pitchTex() {
  return TEX.pitch ||= canvasTexture(128, 128, (c, w, h) => { c.fillStyle = '#3f9d47'; c.fillRect(0, 0, w / 2, h); c.fillStyle = '#4bb054'; c.fillRect(w / 2, 0, w / 2, h); c.fillStyle = 'rgba(0,0,0,0.05)'; for (let i = 0; i < 300; i++) c.fillRect((i * 37) % w, (i * 53) % h, 2, 2); }, { repeat: true });
}
function stripeTex(a, b) {
  const k = a + b;
  return TEX['st' + k] ||= canvasTexture(128, 32, (c, w, h) => { for (let x = 0; x < w; x += 32) { c.fillStyle = (x / 32) % 2 ? a : b; c.fillRect(x, 0, 32, h); } c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(0, 2, w, 3); }, { repeat: true });
}
function signTex(text, bg, fg, w = 512, h = 128, font = 'Bangers') {
  return canvasTexture(w, h, (c) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h); c.lineWidth = 10; c.strokeStyle = '#1a1222'; c.strokeRect(5, 5, w - 10, h - 10);
    c.font = `${Math.round(h * 0.62)}px "${font}", Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = h * 0.08; c.strokeStyle = '#1a1222'; c.lineJoin = 'round'; c.strokeText(text, w / 2, h * 0.54); c.fillStyle = fg; c.fillText(text, w / 2, h * 0.54);
  });
}
function stickerTex(person, team) {
  return canvasTexture(256, 352, (c, w, h) => {
    c.fillStyle = '#fdfaf0'; c.fillRect(0, 0, w, h);
    c.fillStyle = team.kit.shirt; c.fillRect(14, 14, w - 28, h - 110);
    const g = c.createLinearGradient(0, 14, 0, h - 96); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0.25)'); c.fillStyle = g; c.fillRect(14, 14, w - 28, h - 110);
    c.fillStyle = '#2a2030'; c.beginPath(); c.arc(w / 2, 120, 46, 0, 7); c.fill(); c.beginPath(); c.ellipse(w / 2, 250, 90, 70, 0, Math.PI, 0); c.fill();
    c.font = '96px "Bangers", Impact, sans-serif'; c.textAlign = 'right'; c.fillStyle = '#ffffff'; c.lineWidth = 8; c.strokeStyle = '#1a1222'; c.strokeText(String(person.no), w - 26, 104); c.fillText(String(person.no), w - 26, 104);
    c.fillStyle = team.kit.shorts; c.fillRect(14, h - 92, w - 28, 78);
    c.font = `${person.short.length > 10 ? 34 : 44}px "Bangers", Impact, sans-serif`; c.textAlign = 'center'; c.fillStyle = '#ffffff'; c.lineWidth = 6; c.strokeText(person.short, w / 2, h - 44); c.fillText(person.short, w / 2, h - 44);
    c.lineWidth = 6; c.strokeStyle = '#1a1222'; c.strokeRect(3, 3, w - 6, h - 6);
  });
}

// ------------------------------------------------------------------ play strip
export function buildStrip(sim) {
  const L = sim.L, group = new THREE.Group();
  const fStart = L.finale.start - 6, cp = L.checkpointCol;
  const halfOf = c => c < cp ? 0 : 1;
  const P = [0, 1].map(() => ({ soil: [], grass: [], blocks: [], ledges: [], banners: [] }));
  const pitch = [], ink = [];
  // decorative ground left of the kick-off (the level itself starts at x = 0)
  P[0].soil.push(worldBox(-40, -7, Z0, 0, ROWS - L.groundTop[0] - 0.24, Z1, 0.5));
  P[0].grass.push(worldBox(-40, ROWS - L.groundTop[0] - 0.26, Z0 - 0.06, 0, ROWS - L.groundTop[0], Z1 + 0.06, 0.5));
  // ground runs (split at half-time and at the penalty area)
  let x = 0;
  while (x < L.cols) {
    const top = L.groundTop[x];
    if (top >= ROWS) { x++; continue; }
    let x1 = x; while (x1 < L.cols && L.groundTop[x1] === top && (x1 < fStart) === (x < fStart) && halfOf(x1) === halfOf(x)) x1++;
    const yTop = ROWS - top, h = halfOf(x);
    P[h].soil.push(worldBox(x, -7, Z0, x1, yTop - 0.24, Z1, 0.5));
    (x >= fStart ? pitch : P[h].grass).push(worldBox(x - 0.02, yTop - 0.26, Z0 - 0.06, x1 + 0.02, yTop, Z1 + 0.06, 0.5));
    ink.push(outlineBoxGeo(x - 0.02, -7, Z0 - 0.06, x1 + 0.02, yTop, Z1 + 0.06, 0.05));
    x = x1;
  }
  // blocks / ledges / banner routes as horizontal runs per row
  for (let row = 0; row < ROWS; row++) {
    let c = 0;
    while (c < L.cols) {
      const t = L.tiles[row * L.cols + c];
      if (t !== T.BLOCK && t !== T.LEDGE && t !== T.BANNER) { c++; continue; }
      let c1 = c; while (c1 < L.cols && L.tiles[row * L.cols + c1] === t && halfOf(c1) === halfOf(c)) c1++;
      const y1 = ROWS - row, y0 = y1 - 1, h = halfOf(c);
      if (t === T.BLOCK && c >= L.finale.goalX + 2) { c = c1; continue; }
      if (t === T.BLOCK) { P[h].blocks.push(worldBox(c, y0, -1.3, c1, y1, 1.3, 1)); ink.push(outlineBoxGeo(c, y0, -1.3, c1, y1, 1.3, 0.05)); }
      else if (t === T.LEDGE) { P[h].ledges.push(worldBox(c, y1 - 0.32, -1.15, c1, y1, 1.15, 1)); ink.push(outlineBoxGeo(c, y1 - 0.32, -1.15, c1, y1, 1.15, 0.045)); }
      else { P[h].banners.push(worldBox(c, y1 - 0.26, -1.0, c1, y1, 1.0, 0.5)); ink.push(outlineBoxGeo(c, y1 - 0.26, -1.0, c1, y1, 1.0, 0.04));
        for (const px of [c + 0.3, c1 - 0.3]) { const pole = cylinder(0.06, 0.06, y1 - 2, toon(0x8a8f9c), { outline: 0.025 }); pole.position.set(px, (y1 + 2) / 2 - 0.1, -0.9); group.add(pole); } }
      c = c1;
    }
  }
  const add = (geos, mat, cast = true) => { if (!geos.length) return; const m = new THREE.Mesh(merge(geos), mat); m.receiveShadow = true; m.castShadow = cast; group.add(m); return m; };
  const mats = [0, 1].map(h => stripMaterials(world3d(sim.halfTeam[h])));
  [0, 1].forEach(h => {
    const M = mats[h];
    add(P[h].soil, M.soil, false); add(P[h].grass, M.grass); add(P[h].blocks, M.block); add(P[h].ledges, M.ledge);
    add(P[h].banners, toon(0xffffff, { map: stripeTex(sim.halfTeam[h].kit.shirt, sim.halfTeam[h].kit.shorts) }));
  });
  add(pitch, toon(0xffffff, { map: pitchTex() }));
  const inkMesh = new THREE.Mesh(merge(ink), inkMaterial()); group.add(inkMesh);
  // grass tufts and little flowers on the strip edges (instanced, per half)
  for (const h of [0, 1]) {
    const tufts = [];
    for (let c = h ? cp : 0; c < (h ? fStart : Math.min(cp, fStart)); c++) { const top = L.groundTop[c]; if (top >= ROWS) continue; for (let k = 0; k < 3; k++) if (rnd() < 0.55) tufts.push([c + rnd(), ROWS - top, rnd() < 0.5 ? 1.45 + rnd() * 0.15 : -1.2 - rnd() * 0.35, rnd()]); }
    const tg = new THREE.ConeGeometry(0.07, 0.34, 4); tg.translate(0, 0.17, 0);
    const tm = new THREE.InstancedMesh(tg, mats[h].tuft, Math.max(1, tufts.length * 3)); const o3 = new THREE.Object3D(); let n = 0;
    for (const [tx, ty, tz, r] of tufts) for (let k = 0; k < 3; k++) { o3.position.set(tx + (k - 1) * 0.07, ty - 0.02, tz); o3.rotation.set(0, 0, (k - 1) * 0.35); o3.scale.setScalar(0.7 + r * 0.6); o3.updateMatrix(); tm.setMatrixAt(n++, o3.matrix); }
    tm.count = n; tm.frustumCulled = false; group.add(tm);
    const fl = tufts.filter(t => t[3] > 0.8);
    const fm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 4), toon(0xffffff), Math.max(1, fl.length)); const fc = new THREE.Color();
    fl.forEach(([fx, fy, fz], i) => { o3.position.set(fx, fy + 0.3, fz); o3.rotation.set(0, 0, 0); o3.scale.setScalar(1); o3.updateMatrix(); fm.setMatrixAt(i, o3.matrix); fm.setColorAt(i, fc.set([0xffd23f, 0xff7aa2, 0xffffff, 0xe63946][i % 4])); });
    fm.count = fl.length; fm.frustumCulled = false; group.add(fm);
  }
  return group;
}

// ------------------------------------------------------------------ dynamic things (collectibles, springs, movers …)
export function buildDynamic(sim) {
  const group = new THREE.Group(), L = sim.L;
  const kinds = [0, 1].map(h => world3d(sim.halfTeam[h]).item);
  const items = sim.items.map(it => {
    const g = itemModel(kinds[it.half]);
    g.position.set(X(it.x * TILE), Y(it.y * TILE), 0);
    group.add(g);
    return { g, it, base: g.position.y, ph: rnd() * 6 };
  });
  const stickers = sim.stickers.map(s => {
    const team = sim.halfTeam[s.half];
    const front = toon(0xffffff, { map: stickerTex(s.person, team), unique: true });
    const side = toon(0xfdfaf0);
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.86, 0.05), [side, side, side, side, front, front]);
    card.castShadow = true;
    const ink = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.92, 0.09), inkMaterial()); card.add(ink);
    const g = new THREE.Group(); g.add(card); g.add(glowSprite(0xffffff, 1.6, 0.45));
    g.position.set(X(s.x * TILE), Y(s.y * TILE), 0);
    group.add(g);
    return { g, s, card, base: g.position.y, ph: rnd() * 6 };
  });
  const shields = sim.shields.map(s => {
    const g = new THREE.Group();
    const b = box(0.34, 0.5, 0.12, toon(0xf5f5f5), { outline: 0.035 }); g.add(b);
    const st = box(0.35, 0.12, 0.13, toon(hex(sim.kits.me.shirt)), { outline: 0 }); st.position.y = 0.08; g.add(st);
    g.add(glowSprite(0x9fe3ff, 1.3, 0.55));
    g.position.set(X(s.x * TILE), Y(s.y * TILE), 0);
    group.add(g);
    return { g, s, base: g.position.y, ph: rnd() * 6 };
  });
  const springs = sim.springs.map(s => {
    const g = new THREE.Group(), team = sim.halfTeam[s.half];
    for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) { const leg = cylinder(0.04, 0.04, 0.3, toon(0x3d3d46), { outline: 0.02 }); leg.position.set(dx, 0.15, dz); g.add(leg); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 20), toon(0x8a8a96)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.32; g.add(ring);
    const mat = cylinder(0.46, 0.46, 0.06, toon(hex(team.kit.shirt)), { outline: 0.03, seg: 20 }); mat.position.y = 0.32; g.add(mat);
    g.position.set(s.x + 0.5, ROWS - s.y, 0);
    group.add(g);
    return { g, s, mat };
  });
  const movers = sim.movers.map(m => {
    const p = box(m.w, 0.32, 2.3, toon(0xffffff, { map: woodTex() }), { outline: 0.045 }); p.receiveShadow = true;
    group.add(p);
    return { p, m };
  });
  return { group, items, stickers, shields, springs, movers };
}

// ------------------------------------------------------------------ props along the strip
export function buildProps(sim) {
  const group = new THREE.Group(), L = sim.L;
  const groundY = col => ROWS - L.groundTop[Math.max(0, Math.min(L.cols - 1, col))];
  // fan banners with names (behind the strip)
  for (const b of sim.bannerNames) {
    const team = sim.halfTeam[b.half], y0 = groundY(b.x);
    const light = new THREE.Color(hex(team.kit.shirt)).getHSL({}).l > 0.6;
    const tex = signTex(b.text, team.kit.shirt, light ? '#1a1222' : '#ffffff', 512, 112);
    const w = 3.4;
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, 0.74, 0.06), [toon(0x6b6f7a), toon(0x6b6f7a), toon(0x6b6f7a), toon(0x6b6f7a), toon(0xffffff, { map: tex, unique: true }), toon(0x6b6f7a)]);
    board.position.set(b.x + w / 2, y0 + 1.75, -2.3); board.castShadow = true; group.add(board);
    for (const dx of [0.15, w - 0.15]) { const pole = cylinder(0.05, 0.05, 2.1, toon(0x6b6f7a), { outline: 0.02 }); pole.position.set(b.x + dx, y0 + 1.05, -2.34); group.add(pole); }
  }
  // cooling breaks: gazebo, drinks table, sign
  for (const cp of L.checkpoints) {
    const x0 = cp.col, y0 = ROWS - cp.y, team = sim.halfTeam[cp.kind === 'halftime' ? 1 : cp.half];
    if (cp.kind === 'cooling') {
      const g = new THREE.Group(); g.position.set(x0 + 0.5, y0, -2.6);
      for (const [dx, dz] of [[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.9], [1.3, 0.9]]) { const p = cylinder(0.05, 0.05, 2.3, toon(0xd9d9d9), { outline: 0.02 }); p.position.set(dx, 1.15, dz); g.add(p); }
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.9, 4, 1), toon(0xffffff, { map: stripeTex(team.kit.shirt, '#ffffff') })); roof.rotation.y = Math.PI / 4; roof.position.y = 2.7; roof.castShadow = true; g.add(roof);
      const roofInk = new THREE.Mesh(new THREE.ConeGeometry(2.18, 0.98, 4, 1), inkMaterial()); roofInk.rotation.y = Math.PI / 4; roofInk.position.y = 2.7; g.add(roofInk);
      const table = box(1.8, 0.08, 0.7, toon(0xf2f2f2), { outline: 0.03 }); table.position.set(0, 0.8, 0); g.add(table);
      for (const dx of [-0.8, 0.8]) { const l = cylinder(0.03, 0.03, 0.8, toon(0x9a9a9a), { outline: 0 }); l.position.set(dx, 0.4, 0); g.add(l); }
      for (let i = 0; i < 6; i++) { const b = cylinder(0.06, 0.06, 0.3, toon(i % 2 ? 0x3a86ff : 0x9fe3ff), { outline: 0.02, seg: 8 }); b.position.set(-0.6 + i * 0.24, 1.0, (i % 2) * 0.15 - 0.05); g.add(b); }
      const cooler = box(0.6, 0.45, 0.45, toon(0x2f9e44), { outline: 0.03 }); cooler.position.set(1.0, 0.23, 0.5); g.add(cooler);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.62), toon(0xffffff, { map: signTex('COOLING BREAK', '#3a86ff', '#ffffff'), unique: true })); sign.position.set(0, 2.05, 0.95); g.add(sign);
      group.add(g);
    } else {
      // half-time gate behind the strip: two pillars in the team colours and a big banner
      const home = sim.halfTeam[0], away = sim.halfTeam[1];
      for (const [dx, t] of [[-1.7, home], [1.7, away]]) { const p = cylinder(0.3, 0.34, 4.6, toon(hex(t.kit.shirt)), { outline: 0.05 }); p.position.set(x0 + dx, y0 + 2.3, -2.2); group.add(p); const ball = sphere(0.42, toon(hex(t.kit.shirt)), { seg: 12 }); ball.position.set(x0 + dx, y0 + 4.9, -2.2); group.add(ball); }
      const tex = signTex('HALF-TIME', '#1d2433', '#ffd23f');
      const beam = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.0, 0.3), [toon(0x1d2433), toon(0x1d2433), toon(0x1d2433), toon(0x1d2433), toon(0xffffff, { map: tex, unique: true }), toon(0x1d2433)]);
      beam.position.set(x0, y0 + 3.7, -2.1); beam.castShadow = true; group.add(beam);
      const bi = new THREE.Mesh(new THREE.BoxGeometry(4.1, 1.1, 0.4), inkMaterial()); bi.position.copy(beam.position); group.add(bi);
      const mat = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.04, 3.0), toon(0x1d2433)); mat.position.set(x0, y0 + 0.02, 0); mat.receiveShadow = true; group.add(mat);
      for (let i = 0; i < 5; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.045, 3.0), toon(0xffd23f)); st.position.set(x0 - 1.4 + i * 0.7, y0 + 0.025, 0); group.add(st); }
    }
  }
  // small props along the strip, in the style of each half's country
  const codes = [0, 1].map(h => sim.halfTeam[h].code);
  for (const d of L.decor) {
    if (d.kind !== 'prop') continue;
    const y0 = ROWS - d.y, k = d.x % 3, code = codes[d.half] || 'ESP';
    const g = new THREE.Group(); g.position.set(d.x + 0.5, y0, -1.9 - (d.x % 2) * 0.3);
    const spiky = (col, n = 7, len = 0.7, r = 0.08) => { for (let i = 0; i < n; i++) { const l = cone(r, len, toon(col), { outline: 0.02, seg: 4 }); l.position.y = len * 0.43; l.rotation.z = (i - (n - 1) / 2) * 0.3; l.rotation.x = (i % 2 ? 0.3 : -0.3); g.add(l); } };
    const pot = (col, flowers) => { const p = cylinder(0.22, 0.16, 0.36, toon(col), { outline: 0.03 }); p.position.y = 0.18; g.add(p); flowers.forEach((c, i) => { const f = sphere(0.09, toon(c), { seg: 8, outline: 0.02 }); f.position.set(-0.15 + i * 0.075, 0.45 + (i % 2) * 0.06, 0); g.add(f); }); const lv = sphere(0.18, toon(0x3f8f3a), { seg: 8 }); lv.position.y = 0.38; lv.scale.set(1.3, 0.6, 1); g.add(lv); };
    const rock = col => { const r = sphere(0.35, toon(col), { seg: 6, outline: 0.03 }); r.scale.set(1.3, 0.7, 1); r.position.y = 0.2; g.add(r); };
    const bench = () => { const seat = box(1.2, 0.08, 0.35, toon(0x9a6234), { outline: 0.03 }); seat.position.y = 0.42; g.add(seat); for (const dx of [-0.5, 0.5]) { const l = box(0.06, 0.42, 0.3, toon(0x3a3a44), { outline: 0.02 }); l.position.set(dx, 0.21, 0); g.add(l); } };
    const PROPS = {
      ESP: [() => spiky(0x6f9e7a), () => pot(0xc8643a, [0xe63946, 0xff7aa2, 0xffffff, 0xe63946, 0xff7aa2]), bench],
      NZL: [() => spiky(0x3f6a3a, 9, 0.9, 0.06), () => rock(0x7a7f88), bench],
      NOR: [() => rock(0x8a8f98), () => { const f = cone(0.45, 1.3, toon(0x24503a), { outline: 0.03, seg: 7 }); f.position.y = 0.65; g.add(f); }, bench],
      SUI: [() => { const hb = cylinder(0.32, 0.32, 0.5, toon(0xe0c060), { outline: 0.03 }); hb.rotation.x = Math.PI / 2; hb.position.y = 0.32; g.add(hb); }, () => pot(0x8a5532, [0xe63946, 0xffffff, 0xe63946, 0xffffff, 0xe63946]), bench],
      PHI: [() => spiky(0x5aa83a, 6, 1.1, 0.16), () => pot(0x8a5a2a, [0xff6b3d, 0xffd23f, 0xff6b3d, 0xffd23f, 0xff6b3d]), bench],
    };
    (PROPS[code] || PROPS.ESP)[k]();
    group.add(g);
  }
  return group;
}

// ------------------------------------------------------------------ the stadium (penalty area)
export function buildStadium(sim) {
  const L = sim.L, F = L.finale, group = new THREE.Group(), anim = [];
  const gx = F.goalX, y0 = 2;
  const cx = (F.start + F.wallX) / 2;
  // stands behind the pitch: 3 tiers, roof, floodlights
  const standMat = toon(0x5d6782), standMat2 = toon(0x4a536b);
  for (let tier = 0; tier < 3; tier++) {
    const s = box(70, 1.6, 3.2, tier % 2 ? standMat : standMat2, { outline: 0.06 }); s.position.set(cx, y0 + 0.6 + tier * 1.9, -5.2 - tier * 3.1); s.receiveShadow = true; group.add(s);
    const back = box(70, 1.9 * (tier + 1), 0.4, standMat2, { outline: 0 }); back.position.set(cx, y0 + 0.95 * (tier + 1) - 0.4, -6.8 - tier * 3.1); group.add(back);
  }
  const roof = box(74, 0.5, 12, toon(0xdfe3ea), { outline: 0.08 }); roof.position.set(cx, y0 + 9.5, -10.5); roof.rotation.x = -0.12; group.add(roof);
  for (let i = 0; i < 6; i++) { const p = cylinder(0.25, 0.25, 9, toon(0x7d8597), { outline: 0.05 }); p.position.set(cx - 32 + i * 12.8, y0 + 4.8, -15.5); group.add(p); }
  // advertising boards along the pitch
  const adCols = ['#1e6fd6', '#ffd23f', '#e63946', '#2a9d8f', '#ff9f1c'];
  for (let i = 0; i < 12; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.8, 0.15), toon(hex(adCols[i % 5]), { emissive: hex(adCols[i % 5]), emissiveIntensity: 0.35 })); b.position.set(cx - 33 + i * 6, y0 + 0.4, -3.4); if (Math.abs(b.position.x - gx) < 4) continue; group.add(b); }
  // the wide pitch around the strip, the end stand behind the goal (seen in the penalty view)
  const ptex = pitchTex().clone(); ptex.needsUpdate = true; ptex.repeat.set((gx + 6 - (F.start - 8)) / 4, 8);
  const turf = new THREE.Mesh(new THREE.PlaneGeometry(gx + 6 - (F.start - 8), 32), toon(0xffffff, { map: ptex, unique: true })); turf.rotation.x = -Math.PI / 2; turf.position.set((gx + 6 + F.start - 8) / 2, y0 - 0.012, 0); turf.receiveShadow = true; group.add(turf);
  for (let tier = 0; tier < 3; tier++) {
    const s2 = box(3.2, 1.6, 34, tier % 2 ? standMat : standMat2, { outline: 0.06 }); s2.position.set(gx + 6.4 + tier * 3.1, y0 + 0.6 + tier * 1.9, 0); s2.receiveShadow = true; group.add(s2);
    const bk = box(0.4, 1.9 * (tier + 1), 34, standMat2, { outline: 0 }); bk.position.set(gx + 8 + tier * 3.1, y0 + 0.95 * (tier + 1) - 0.4, 0); group.add(bk);
  }
  const roof2 = box(12, 0.5, 36, toon(0xdfe3ea), { outline: 0.08 }); roof2.position.set(gx + 11, y0 + 9.5, 0); roof2.rotation.z = 0.12; group.add(roof2);
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.8, 4.6), toon(hex(adCols[(i + 2) % 5]), { emissive: hex(adCols[(i + 2) % 5]), emissiveIntensity: 0.35 })); b.position.set(gx + 4, y0 + 0.4, -12.5 + i * 5); if (Math.abs(b.position.z) < 3) continue; group.add(b); }
  // crowd (instanced fans in both team colours, bobbing)
  const fans = [], cols = [sim.halfTeam[0].kit.shirt, sim.halfTeam[0].kit.shorts, sim.halfTeam[1].kit.shirt, sim.halfTeam[1].kit.shorts, '#f4f4f4'];
  for (let tier = 0; tier < 3; tier++) for (let row = 0; row < 2; row++) for (let x = -34; x < 34; x += 0.55) {
    if (rnd() < 0.12) continue;
    fans.push({ x: cx + x + (rnd() - 0.5) * 0.2, y: y0 + 1.6 + tier * 1.9 + row * 0.75, z: -4.4 - tier * 3.1 - row * 1.2, c: x < 0 ? cols[Math.floor(rnd() * 2)] : cols[2 + Math.floor(rnd() * 2)], ph: rnd() * 6 });
  }
  for (let tier = 0; tier < 3; tier++) for (let row = 0; row < 2; row++) for (let z = -16; z < 16; z += 0.55) {
    if (rnd() < 0.12) continue;
    fans.push({ x: gx + 5.6 + tier * 3.1 + row * 1.2, y: y0 + 1.6 + tier * 1.9 + row * 0.75, z: z + (rnd() - 0.5) * 0.2, c: cols[Math.floor(rnd() * 4)], ph: rnd() * 6 });
  }
  const fanGeo = new THREE.CapsuleGeometry(0.17, 0.32, 2, 6), headGeo = new THREE.SphereGeometry(0.15, 6, 5);
  const bodies = new THREE.InstancedMesh(fanGeo, toon(0xffffff), fans.length), heads = new THREE.InstancedMesh(headGeo, toon(0xe0b28c), fans.length);
  const col = new THREE.Color();
  fans.forEach((f, i) => { bodies.setColorAt(i, col.set(rnd() < 0.08 ? '#f4f4f4' : f.c)); heads.setColorAt(i, col.set(['#f1c9a5', '#d9a273', '#a9714a', '#6e4a32'][i % 4])); });
  bodies.frustumCulled = heads.frustumCulled = false;
  group.add(bodies, heads);
  const o = new THREE.Object3D();
  const excite = { v: 0 };
  anim.push((dt, t) => {
    for (let i = 0; i < fans.length; i++) {
      const f = fans[i], jump = Math.max(0, Math.sin(t * (4 + excite.v * 6) + f.ph)) * (0.06 + excite.v * 0.45);
      o.position.set(f.x, f.y + jump, f.z); o.updateMatrix(); bodies.setMatrixAt(i, o.matrix);
      o.position.set(f.x, f.y + 0.42 + jump, f.z); o.updateMatrix(); heads.setMatrixAt(i, o.matrix);
    }
    bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
    excite.v = Math.max(0, excite.v - dt * 0.25);
  });
  // floodlights
  for (const fx of [cx - 30, cx + 30]) {
    const mast = cylinder(0.3, 0.4, 16, toon(0x7d8597), { outline: 0.06 }); mast.position.set(fx, y0 + 8, -18); group.add(mast);
    const bank = box(4, 2, 0.4, toon(0xfff7d6, { emissive: 0xfff2b0, emissiveIntensity: 1.2 }), { outline: 0.06 }); bank.position.set(fx, y0 + 16.5, -17.6); group.add(bank);
    const gl = glowSprite(0xfff3c4, 14, 0.55); gl.position.set(fx, y0 + 16.5, -17); group.add(gl);
  }
  // pitch lines on the strip
  const white = toon(0xffffff);
  const line = (x, w, z, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), white); m.position.set(x, y0 + 0.012, z); m.receiveShadow = true; group.add(m); };
  line(gx - 0.05, 0.12, 0, 30);                         // goal line
  line(gx - 1.3, 2.6, -4.3, 0.12); line(gx - 1.3, 2.6, 4.3, 0.12); line(gx - 2.6, 0.12, 0, 8.6); // goal area
  line(gx - 7, 14, -10, 0.12); line(gx - 7, 14, 10, 0.12); line(gx - 14, 0.12, 0, 20.1); // penalty area
  line(F.crossTargetX + 0.5, 0.25, 0, 0.25); line(gx - 150 / 16, 0.3, 0, 0.3);
  // the goal: mouth faces the play direction (-x), width along z
  const post = toon(0xffffff);
  const goal = new THREE.Group(); goal.position.set(gx, y0, 0);
  const GW = GOAL_HALF_W;
  for (const z of [-GW, GW]) { const p = cylinder(0.07, 0.07, 2.9, post, { outline: 0.03, seg: 10 }); p.position.set(0, 1.45, z); goal.add(p); }
  const bar = cylinder(0.07, 0.07, GW * 2 + 0.06, post, { outline: 0.03, seg: 10 }); bar.rotation.x = Math.PI / 2; bar.position.set(0, 2.9, 0); goal.add(bar);
  const netTex = canvasTexture(256, 256, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 3; for (let i = 0; i <= w; i += 21) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); } });
  netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping;
  const netMat = new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  netTex.repeat.set(2, 1);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(GW * 2, 2.9), netMat); back.rotation.y = Math.PI / 2; back.position.set(1.6, 1.45, 0); goal.add(back);
  for (const z of [-GW, GW]) { const sd = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.9), netMat); sd.position.set(0.8, 1.45, z); goal.add(sd); }
  const top = new THREE.Mesh(new THREE.PlaneGeometry(1.6, GW * 2), netMat); top.rotation.x = Math.PI / 2; top.rotation.z = Math.PI / 2; top.position.set(0.8, 2.9, 0); goal.add(top);
  group.add(goal);
  return { group, anim, excite };
}

export function ballMesh() {
  const tex = canvasTexture(256, 128, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a1222'; for (const [x, y] of [[40, 30], [120, 64], [200, 30], [80, 100], [170, 100], [250, 70], [5, 75]]) { c.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283; c.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16); } c.fill(); } });
  const b = sphere(0.24, toon(0xffffff, { map: tex }), { seg: 16, outline: 0.03 });
  return b;
}
