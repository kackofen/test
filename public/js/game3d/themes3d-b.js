// Worlds of group B (world 2 on the map): Australia, Ireland, Nigeria, Canada. Same recipe as the
// worlds in themes3d.js: sky + fog, strip materials, national collectible and a build() with hills,
// landmarks, plants and animals – everything drawn in code. The building blocks of themes3d.js come in as `K`
// (passing them in avoids a circular import); the new collectibles, block textures and HUD icons are
// registered in K's tables.
/* global THREE */
import { toon, box, sphere, cylinder, cone, canvasTexture, hex, shadeHex, inkMaterial, INK } from './toon.js';

export function installGroupB(K) {
  const { plain, ridge, peaks, trunkCrownTrees, firs, houses, along, instanced, instancedInked, quadruped, sheepFlock, palms, skyTower, stripedTex } = K;
  const inkOf = (geo, k = 1.08) => new THREE.Mesh(geo.clone().scale(k, k, k), inkMaterial());
  const flagTex = (key, draw) => stripedTex(key, 96, 64, draw);

  // ---------------------------------------------------------------- collectibles
  K.ITEMS.boomerang = () => {
    const sh = new THREE.Shape(); sh.moveTo(-0.3, 0.14); sh.lineTo(-0.02, -0.15); sh.quadraticCurveTo(0.02, -0.18, 0.06, -0.15); sh.lineTo(0.31, 0.14); sh.lineTo(0.24, 0.19); sh.lineTo(0.02, -0.04); sh.lineTo(-0.24, 0.19); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }); geo.translate(0, 0, -0.035);
    const tex = stripedTex('boomerang', 128, 64, (c, w, h) => { c.fillStyle = '#d98a3a'; c.fillRect(0, 0, w, h); c.fillStyle = '#7a3a1a'; for (let x = 6; x < w; x += 22) { c.beginPath(); c.arc(x, 20, 5, 0, 7); c.arc(x + 8, 44, 5, 0, 7); c.fill(); } c.fillStyle = '#f2c14e'; c.fillRect(0, 28, w, 8); });
    tex.repeat.set(0.8, 1);
    const m = new THREE.Mesh(geo, toon(0xffffff, { map: tex })); m.add(new THREE.Mesh(geo.clone().scale(1.1, 1.1, 1.6), inkMaterial()));
    const g = new THREE.Group(); g.add(m); g.rotation.z = 0.5; return g;
  };
  K.ITEMS.clover = () => {
    const g = new THREE.Group();
    const h = new THREE.Shape(); h.moveTo(0, -0.02); h.bezierCurveTo(-0.04, 0.04, -0.17, 0.06, -0.16, 0.17); h.bezierCurveTo(-0.15, 0.27, -0.03, 0.27, 0, 0.19); h.bezierCurveTo(0.03, 0.27, 0.15, 0.27, 0.16, 0.17); h.bezierCurveTo(0.17, 0.06, 0.04, 0.04, 0, -0.02);
    const geo = new THREE.ExtrudeGeometry(h, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }); geo.translate(0, 0, -0.025);
    const mat = toon(0x2fae48), ink = inkMaterial();
    for (let k = 0; k < 3; k++) { const leaf = new THREE.Mesh(geo, mat); leaf.add(new THREE.Mesh(geo.clone().scale(1.13, 1.13, 1.6), ink)); leaf.rotation.z = k * 2.094; g.add(leaf); }
    const stem = cylinder(0.02, 0.025, 0.24, toon(0x1f7a35), { outline: 0.01, seg: 6 }); stem.position.set(0.0, -0.2, 0); stem.rotation.z = 0.2; g.add(stem);
    return g;
  };
  K.ITEMS.drum = () => {
    const pts = []; for (let i = 0; i <= 12; i++) { const k = i / 12; pts.push(new THREE.Vector2(0.09 + 0.17 * Math.pow(Math.abs(k - 0.5) * 2, 1.7), (k - 0.5) * 0.52)); }
    const geo = new THREE.LatheGeometry(pts, 14);
    const tex = stripedTex('drum', 32, 128, (c, w, h) => { c.fillStyle = '#8a5a2a'; c.fillRect(0, 0, w, h); c.fillStyle = '#0f8a3c'; c.fillRect(0, 20, w, 14); c.fillRect(0, h - 34, w, 14); c.fillStyle = '#f4f4f4'; c.fillRect(0, 36, w, 6); c.fillRect(0, h - 42, w, 6); });
    const m = new THREE.Mesh(geo, toon(0xffffff, { map: tex })); m.add(new THREE.Mesh(geo.clone().scale(1.1, 1.04, 1.1), inkMaterial()));
    const g = new THREE.Group(); g.add(m);
    for (const s of [-1, 1]) { const head = cylinder(0.25, 0.25, 0.03, toon(0xf0e0c0), { outline: 0.015, seg: 14 }); head.position.y = s * 0.27; g.add(head); }
    g.rotation.z = 0.5; return g;
  };
  K.ITEMS.maple = () => {
    const sh = new THREE.Shape(), pts = [], spikes = [[0, 0.34], [38, 0.3], [76, 0.3], [118, 0.2]], val = 0.16;
    pts.push([0, 0.34]);
    spikes.slice(1).forEach(([a, r], i) => { const va = (spikes[i][0] + a) / 2; pts.push([va, val]); pts.push([a, r]); });
    pts.push([152, 0.12]); pts.push([180, 0.1]); // bottom, where the stem is
    const left = pts.slice().reverse().slice(0, -1).map(([a, r]) => [-a, r]); // mirror image for the left half
    const all = [...pts, ...left];
    all.forEach(([a, r], i) => { const t = (90 - a) * Math.PI / 180, x = Math.cos(t) * r, y = Math.sin(t) * r; if (i) sh.lineTo(x, y); else sh.moveTo(x, y); });
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }); geo.translate(0, 0.02, -0.03);
    const m = new THREE.Mesh(geo, toon(0xe0262f)); m.add(new THREE.Mesh(geo.clone().scale(1.12, 1.12, 1.6), inkMaterial()));
    const stem = box(0.04, 0.14, 0.04, toon(0xa81d24), { outline: 0.01 }); stem.position.y = -0.22;
    const g = new THREE.Group(); g.add(m, stem); return g;
  };
  Object.assign(K.ITEM_ICON, {
    boomerang: '<path d="M2 6 9 16c.5.7 1.2.7 1.6 0L18 6l-2.4-1.4L10 12 4.4 4.6Z" fill="#d98a3a" stroke="#1a1222" stroke-width="1.8" stroke-linejoin="round"/>',
    clover: '<g fill="#2fae48" stroke="#1a1222" stroke-width="1.6"><circle cx="7" cy="7" r="3.6"/><circle cx="13" cy="7" r="3.6"/><circle cx="10" cy="12" r="3.6"/></g><path d="M10 13v5" stroke="#1a1222" stroke-width="2"/>',
    drum: '<path d="M4 3h12c-1 4-2 5-2 7s1 3 2 7H4c1-4 2-5 2-7S5 7 4 3Z" fill="#8a5a2a" stroke="#1a1222" stroke-width="1.8" stroke-linejoin="round"/><path d="M5 6h10M5 14h10" stroke="#0f8a3c" stroke-width="2"/>',
    maple: '<path d="M10 2 12 6l3-1-1 4 4 1-3 3 1 2-4-1v4H9v-4l-4 1 1-2-3-3 4-1-1-4 3 1Z" fill="#e0262f" stroke="#1a1222" stroke-width="1.6" stroke-linejoin="round"/>',
  });
  Object.assign(K.ITEM_NAME, { boomerang: 'boomerangs', clover: 'shamrocks', drum: 'talking drums', maple: 'maple leaves' });

  // ---------------------------------------------------------------- block textures
  K.BLOCKS.sandstone = (c, w, h) => { // layered red rock
    c.fillStyle = '#c4572f'; c.fillRect(0, 0, w, h);
    const bands = ['#d8794a', '#b8482a', '#e08e5c', '#a83e24'];
    for (let y = 0, i = 0; y < h; y += 28, i++) { c.fillStyle = bands[i % 4]; c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= w; x += 16) c.lineTo(x, y + Math.sin(x / 22 + i) * 4); c.lineTo(w, y + 20); c.lineTo(0, y + 20); c.fill(); }
    c.strokeStyle = '#6a2a12'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(16, 16, 80, 10);
  };
  K.BLOCKS.celtic = (c, w, h) => { // green tile with golden interlaced rings
    c.fillStyle = '#1b6b3a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#0d3a1c'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
    const ring = (x, y, r) => { c.lineWidth = 14; c.strokeStyle = '#0d3a1c'; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke(); c.lineWidth = 8; c.strokeStyle = '#e8b43a'; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke(); };
    ring(92, 92, 46); ring(164, 92, 46); ring(92, 164, 46); ring(164, 164, 46);
    c.lineWidth = 8; c.strokeStyle = '#e8b43a'; c.beginPath(); c.arc(128, 128, 22, 0, 7); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(14, 14, 90, 10);
  };
  K.BLOCKS.ankara = (c, w, h) => { // wax-print cloth
    c.fillStyle = '#f6eed8'; c.fillRect(0, 0, w, h);
    const cols = ['#1f5fbf', '#f28a12', '#0f8a3c', '#d52b1e'];
    for (const [x, y] of [[64, 64], [192, 64], [64, 192], [192, 192]]) { cols.forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, 50 - i * 12, 0, 7); c.fill(); }); c.fillStyle = '#f6eed8'; c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill(); }
    c.fillStyle = '#1a1222'; for (let i = 0; i < 8; i++) { c.fillRect(i * 32 + 12, 124, 8, 8); }
    c.strokeStyle = '#1a1222'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
  };
  K.BLOCKS.plaid = (c, w, h) => { // buffalo check
    c.fillStyle = '#c4202c'; c.fillRect(0, 0, w, h); c.fillStyle = '#1c1618';
    for (let i = 0; i < 4; i++) { c.fillRect(i * 64, 0, 32, h); c.fillRect(0, i * 64, w, 32); }
    c.fillStyle = 'rgba(255,255,255,0.1)'; for (let y = 0; y < h; y += 6) c.fillRect(0, y, w, 1);
    c.strokeStyle = '#3a0a0e'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
  };

  // ---------------------------------------------------------------- small helpers
  const rockDome = (rx, ry, rz, color, tint = null) => { // half-dome monolith with vertical streaks
    const tex = stripedTex('streak' + color, 128, 64, (c, w, h) => { c.fillStyle = '#' + color.toString(16).padStart(6, '0'); c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,0.16)'; for (let x = 0; x < w; x += 9) c.fillRect(x + (x * 7) % 5, 0, 3 + (x % 4), h); c.fillStyle = 'rgba(255,255,255,0.1)'; for (let x = 4; x < w; x += 23) c.fillRect(x, 0, 3, h); });
    const geo = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const g = new THREE.Group(); g.add(new THREE.Mesh(geo, toon(0xffffff, { map: tex, unique: true })), inkOf(geo, 1.015)); g.scale.set(rx, ry, rz); return g;
  };
  const kangaroo = () => {
    const g = new THREE.Group(), fur = toon(0xc07a48), belly = toon(0xe8c49a), dark = toon(0x7a4528);
    const body = sphere(0.5, fur, { seg: 12 }); body.scale.set(0.8, 1.35, 0.75); body.position.set(0, 1.2, 0); body.rotation.z = -0.35; g.add(body);
    const chest = sphere(0.34, belly, { seg: 10, outline: 0 }); chest.scale.set(0.7, 1.2, 0.7); chest.position.set(0.16, 1.15, 0); chest.rotation.z = -0.35; g.add(chest);
    const head = sphere(0.22, fur, { seg: 10 }); head.scale.set(1.1, 1, 0.85); head.position.set(0.42, 2.05, 0); g.add(head);
    const snout = cone(0.12, 0.3, fur, { seg: 8, outline: 0.02 }); snout.rotation.z = -Math.PI / 2; snout.position.set(0.68, 2.0, 0); g.add(snout);
    const nose = sphere(0.04, toon(0x1a1218), { seg: 6, outline: 0 }); nose.position.set(0.82, 2.0, 0); g.add(nose);
    for (const dz of [-0.1, 0.1]) { const ear = cone(0.06, 0.36, fur, { seg: 6, outline: 0.015 }); ear.position.set(0.34, 2.38, dz * 1.5); ear.rotation.x = dz * 2.2; ear.rotation.z = 0.15; g.add(ear); }
    const tail = cone(0.14, 1.3, dark, { seg: 7, outline: 0.03 }); tail.rotation.z = Math.PI / 2 + 0.55; tail.position.set(-0.75, 0.55, 0); g.add(tail);
    for (const dz of [-0.28, 0.28]) { const leg = box(0.28, 0.5, 0.18, fur, { outline: 0.03 }); leg.position.set(0.05, 0.55, dz); g.add(leg); const foot = box(0.55, 0.12, 0.2, dark, { outline: 0.03 }); foot.position.set(0.22, 0.1, dz); g.add(foot); }
    for (const dz of [-0.3, 0.3]) { const arm = box(0.1, 0.3, 0.08, fur, { outline: 0.02 }); arm.position.set(0.5, 1.35, dz); arm.rotation.z = 0.3; g.add(arm); }
    return g;
  };
  const elephant = () => {
    const g = new THREE.Group(), skin = toon(0x8f939e), dark = toon(0x70747f);
    const body = box(2.6, 1.5, 1.4, skin, { outline: 0.06 }); body.position.y = 2.0; g.add(body);
    const head = box(1.1, 1.2, 1.1, skin, { outline: 0.06 }); head.position.set(1.7, 2.3, 0); g.add(head);
    const trunk = cylinder(0.2, 0.12, 1.5, skin, { outline: 0.04 }); trunk.position.set(2.35, 1.6, 0); trunk.rotation.z = 0.3; g.add(trunk);
    for (const dz of [-1, 1]) { const ear = box(0.12, 1.1, 0.9, dark, { outline: 0.04 }); ear.position.set(1.45, 2.4, dz * 0.95); ear.rotation.x = dz * 0.25; g.add(ear); const tusk = cone(0.07, 0.7, toon(0xf4efe0), { outline: 0.02, seg: 6 }); tusk.position.set(2.15, 1.85, dz * 0.3); tusk.rotation.z = -1.1; g.add(tusk); }
    const legs = [];
    for (const [dx, dz] of [[-0.9, -0.5], [-0.9, 0.5], [0.9, -0.5], [0.9, 0.5]]) { const l = box(0.5, 1.4, 0.5, dark, { outline: 0.04 }); l.position.set(dx, 0.7, dz); g.add(l); legs.push(l); }
    const tail = box(0.1, 0.9, 0.1, dark, { outline: 0.02 }); tail.position.set(-1.35, 1.9, 0); g.add(tail);
    g.userData.legs = legs; return g;
  };
  const canoe = () => {
    const g = new THREE.Group();
    const hull = box(3.4, 0.35, 0.8, toon(0xc4402a), { outline: 0.05 }); hull.position.y = 0.2; g.add(hull);
    for (const dx of [-1.8, 1.8]) { const e = box(0.5, 0.35, 0.6, toon(0xc4402a), { outline: 0.05 }); e.position.set(dx, 0.36, 0); e.rotation.z = dx > 0 ? -0.5 : 0.5; g.add(e); }
    const paddler = box(0.4, 0.7, 0.4, toon(0x2a5fbf), { outline: 0.04 }); paddler.position.set(0.2, 0.75, 0); g.add(paddler);
    const head = sphere(0.2, toon(0xe8b88f), { seg: 8, outline: 0.03 }); head.position.set(0.2, 1.3, 0); g.add(head);
    const hat = cone(0.2, 0.2, toon(0xd8202c), { seg: 8, outline: 0.02 }); hat.position.set(0.2, 1.5, 0); g.add(hat);
    const pad = box(0.06, 1.6, 0.06, toon(0xf2c94c), { outline: 0.02 }); pad.position.set(0.3, 0.7, 0.55); pad.rotation.x = 0.6; g.add(pad);
    return g;
  };
  const logCabin = (x, y, z) => {
    const g = new THREE.Group(); g.position.set(x, y, z);
    const logs = stripedTex('logs', 64, 64, (c, w) => { c.fillStyle = '#7a4a26'; c.fillRect(0, 0, w, w); for (let y = 0; y < w; y += 10) { c.fillStyle = y % 20 ? '#8a5630' : '#6b3f20'; c.fillRect(0, y, w, 9); } });
    const wall = box(3.2, 1.8, 2.4, toon(0xffffff, { map: logs }), { outline: 0.07 }); wall.position.y = 0.9; g.add(wall);
    const roof = cone(2.5, 1.2, toon(0x3a2a22), { outline: 0.07, seg: 4 }); roof.rotation.y = Math.PI / 4; roof.position.y = 2.4; roof.scale.set(1, 1, 0.8); g.add(roof);
    const ch = box(0.4, 1.2, 0.4, toon(0x6a6a72), { outline: 0.04 }); ch.position.set(0.9, 2.7, 0); g.add(ch);
    const door = box(0.55, 1.0, 0.06, toon(0xc4202c), { outline: 0.03 }); door.position.set(0, 0.5, 1.23); g.add(door);
    const win = box(0.6, 0.5, 0.06, toon(0xbfe3ff), { outline: 0.03 }); win.position.set(-1.0, 1.1, 1.23); g.add(win);
    return g;
  };
  const roundHuts = list => {
    const g = new THREE.Group();
    const wall = new THREE.CylinderGeometry(0.85, 0.9, 1.1, 10).translate(0, 0.55, 0), roof = new THREE.ConeGeometry(1.25, 1.1, 10).translate(0, 1.65, 0);
    g.add(instancedInked(wall, inkOf(wall, 1.05).geometry, toon(0xb5673a), list.length, (o, i) => { const [x, y, z] = list[i]; o.position.set(x, y, z); }));
    g.add(instancedInked(roof, inkOf(roof, 1.06).geometry, toon(0xc9a24a), list.length, (o, i) => { const [x, y, z] = list[i]; o.position.set(x, y, z); }));
    return g;
  };
  const umbrellaTrees = list => trunkCrownTrees(list, { trunk: 0x6a4a2a, crown: 0x6d8a3a, trunkH: 1.9, crownY: 0.9, crownScale: [1.9, 0.38, 1.9] });
  const rainbow = (x, y, z, R = 16) => {
    const g = new THREE.Group(); g.position.set(x, y, z);
    ['#e63946', '#f4a261', '#ffd23f', '#52b788', '#4cc9f0', '#4361ee', '#9d4edd'].forEach((c, i) => { const t = new THREE.Mesh(new THREE.TorusGeometry(R - i * 0.5, 0.26, 6, 40, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.5, depthWrite: false })); g.add(t); });
    return g;
  };
  const flagPole = (x, y, z, tex) => {
    const g = new THREE.Group(); g.position.set(x, y, z);
    const pole = cylinder(0.05, 0.05, 3.2, toon(0xd9d9d9), { outline: 0.02 }); pole.position.y = 1.6; g.add(pole);
    const f = box(1.2, 0.8, 0.04, toon(0xffffff, { map: tex }), { outline: 0.03 }); f.position.set(0.65, 2.7, 0); g.add(f);
    return g;
  };

  // ---------------------------------------------------------------- the worlds
  const W = {};

  W.AUS = {
    name: 'Australia', item: 'boomerang', sky: [0x1f78d8, 0xffe1b8], fog: 0xf6dcc0, sun: true,
    soil: ['#b5502c', '#9a4122', '#d8794a'], grass: ['#c0b44a', '#a29a38', '#dcd46a'], tuft: 0xa59a3a, block: 'sandstone', ledge: 'wood', blockInk: 0x6a2a12,
    build(x0, x1, zo, rnd) {
      const group = new THREE.Group(), anim = [], span = x1 - x0;
      group.add(plain(x0, x1, 0xc2693a));
      const near = ridge(x0, x1, -10 + zo, -2.2, 3.0, 0.3, 0xcf9a58, 1.9, 1.2), mid = ridge(x0, x1, -27 + zo, -2.2, 3.4, 0.8, 0x9a5a3a, 4.8, 2);
      group.add(near, mid);
      group.add(peaks(x0 - 30, x1 + 30, -66 + zo, rnd, { color: 0xb06a46, snow: 0xcf8a5a, h: [5, 9], r: [10, 16], snowLine: 0.88 }));
      // Uluru and its small neighbours
      const ux = x0 + span * 0.56, ulu = rockDome(26, 9, 9, 0xb5402a); ulu.position.set(ux, -2.2, -60 + zo); group.add(ulu);
      for (const [dx, s] of [[34, 0.5], [44, 0.42], [52, 0.35]]) { const d = rockDome(10 * s * 2, 7 * s * 1.8, 7 * s * 1.6, 0xa5412c); d.position.set(ux + dx, -2.2, -62 + zo); group.add(d); }
      // harbour with the opera house and the bridge
      const hx = x0 + span * 0.2, water = new THREE.Mesh(new THREE.PlaneGeometry(52, 16), toon(0x2f9ed8, { unique: true })); water.rotation.x = -Math.PI / 2; water.position.set(hx, -2.15, -44 + zo); group.add(water);
      const opera = new THREE.Group(); opera.position.set(hx - 8, -2.1, -42 + zo);
      const podium = box(9, 0.7, 3.6, toon(0xe3d6bd), { outline: 0.08 }); podium.position.y = 0.35; opera.add(podium);
      const shell = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2); // closed half-dome: no black inside
      [[-2.7, 2.6, 0.9, 0.2], [-0.6, 3.4, 1.2, 0.0], [1.6, 2.8, 1.0, -0.1], [3.2, 1.8, 0.7, -0.25]].forEach(([dx, h, w, tilt], i) => {
        const s = new THREE.Group(); s.add(new THREE.Mesh(shell, toon(0xfaf5ea)), inkOf(shell, 1.04)); s.scale.set(w * 1.2, h, 1.3); s.position.set(dx, 0.7, 0); s.rotation.z = tilt; s.rotation.y = i % 2 ? Math.PI : 0; opera.add(s);
      });
      group.add(opera);
      const bridge = new THREE.Group(); bridge.position.set(hx + 12, -2.15, -45 + zo);
      const arch = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-13, 0, 0), new THREE.Vector3(0, 13, 0), new THREE.Vector3(13, 0, 0)), 24, 0.32, 6), toon(0x6b7480)); bridge.add(arch);
      const deck = box(28, 0.5, 1.6, toon(0x4a525c), { outline: 0.05 }); deck.position.y = 3.4; bridge.add(deck);
      for (let i = -5; i <= 5; i++) { // hangers between the arch and the deck
        const px = i * 2.4, ay = 6.5 * (1 - (px / 13) ** 2), len = ay - 3.4;
        if (len > 0.3) { const hang = box(0.08, len, 0.08, toon(0x6b7480), { outline: 0 }); hang.position.set(px, 3.4 + len / 2, 0); bridge.add(hang); }
      }
      group.add(bridge);
      // ghost gums, spinifex, termite mounds
      group.add(trunkCrownTrees(along(x0, x1, 4, 9, rnd, x => [x, -2.2, -4.5 - rnd() * 3.5 + zo, 0.9 + rnd() * 0.4]), { trunk: 0xe9e0cf, crown: 0x7e9a5c, trunkH: 2.3, crownY: 0.7, crownScale: [1.4, 0.65, 1.2] }));
      group.add(instanced(new THREE.ConeGeometry(0.45, 0.8, 6).translate(0, 0.4, 0), toon(0xcdb64e), 60, (o, i) => { o.position.set(x0 + rnd() * span, -2.2, -3.2 - rnd() * 5 + zo); o.scale.setScalar(0.7 + rnd() * 0.8); }, false));
      group.add(instanced(new THREE.ConeGeometry(0.6, 1.6, 7).translate(0, 0.8, 0), toon(0xa0522d), 10, (o, i) => { o.position.set(x0 + 8 + rnd() * (span - 16), near.userData.height(x0 + 10) - 2.5 > -9 ? -2.2 : -2.2, -8 - rnd() * 1.5 + zo); o.scale.set(1, 0.8 + rnd() * 0.8, 1); }));
      // kangaroos hopping on the plain
      for (let k = 0; k < 3; k++) {
        const roo = kangaroo(), bx = x0 + span * (0.22 + k * 0.28), z = -3.6 - k * 0.5 + zo; roo.position.set(bx, -2.2, z); roo.scale.setScalar(0.95); group.add(roo);
        let t = rnd() * 6; anim.push(dt => { t += dt; const c = Math.cos(t * 0.22), hop = Math.abs(Math.sin(t * 3.3 + k)); roo.position.x = bx + Math.sin(t * 0.22) * 10; roo.position.y = -2.2 + hop * (Math.abs(c) > 0.2 ? 1.1 : 0.1); roo.rotation.y = c >= 0 ? 0 : Math.PI; roo.rotation.z = Math.abs(c) > 0.2 ? (hop > 0.5 ? 0.12 : -0.08) : 0; });
      }
      return { group, anim };
    },
  };

  W.IRL = {
    name: 'Ireland', item: 'clover', sky: [0x4d93de, 0xe8f0ee], fog: 0xd8e6e0, sun: true,
    soil: ['#5d4a34', '#4a3a28', '#8a7a5a'], grass: ['#3fae45', '#2a8a36', '#78d66a'], tuft: 0x2a8a36, block: 'celtic', ledge: 'wood', blockInk: 0x0d3a1c,
    build(x0, x1, zo, rnd) {
      const group = new THREE.Group(), anim = [], span = x1 - x0;
      group.add(plain(x0, x1, 0x4c9a3c));
      const near = ridge(x0, x1, -10 + zo, -2.2, 4, 0.3, 0x58b848, 2.2, 1.2), mid = ridge(x0, x1, -27 + zo, -2.2, 6, 1.8, 0x3f9a40, 5.1, 2);
      group.add(near, mid);
      // Cliffs of Moher: a grassy cap behind a stepped rock face
      const capGeo = ridge(x0, x1, -40 + zo, -2.2, 10, 3.6, 0x4faa3e, 3.3, 1.5), face = ridge(x0, x1, -38.5 + zo, -2.2, 10, 3.0, 0x7b725c, 3.3, 1.5, { steps: 1.2 });
      group.add(capGeo, face);
      group.add(peaks(x0 - 30, x1 + 30, -70 + zo, rnd, { color: 0x7a8f90, snow: 0x9fb2b0, h: [8, 13], r: [10, 15], snowLine: 0.85 }));
      // low stone walls on the hills, hedgerows
      const walls = along(x0, x1, 5, 11, rnd, x => [x, near.userData.height(x) - 0.45, -9.2 - rnd() * 1.4 + zo, 1.5 + rnd() * 2.5]);
      group.add(instanced(new THREE.BoxGeometry(1, 0.5, 0.35), toon(0x9a958c), walls.length, (o, i) => { const [x, y, z, w] = walls[i]; o.position.set(x, y + 0.25, z); o.scale.set(w, 1, 1); }));
      group.add(trunkCrownTrees(along(x0, x1, 5, 12, rnd, x => [x, near.userData.height(x) - 0.5, -10.5 - rnd() * 1.2 + zo, 0.8 + rnd() * 0.4]), { crown: 0x2c7a34 }));
      // white cottages with thatched roofs
      const hs = along(x0 + 8, x1 - 8, 14, 26, rnd, x => [x, near.userData.height(x) - 0.6, -9.8 - rnd() * 1.2 + zo, 1, 0]);
      group.add(houses(hs, { wall: 0xf8f4ea, roof: 0xc9a24a, w: 2.0, h: 1.2, d: 1.5, roofH: 0.9, gable: true }));
      // round tower, high cross, lighthouse on the cliff
      { const tx = x0 + span * 0.3, th = near.userData.height(tx) - 0.4, t = new THREE.Group(); t.position.set(tx, th, -12 + zo);
        const shaft = cylinder(0.7, 0.95, 7, toon(0x9a958c), { outline: 0.08 }); shaft.position.y = 3.5; t.add(shaft);
        const roof = cone(0.82, 1.7, toon(0x4a4a52), { outline: 0.07, seg: 12 }); roof.position.y = 7.8; t.add(roof);
        const door = box(0.35, 0.7, 0.1, toon(0x2a2020), { outline: 0 }); door.position.set(0, 1.9, 0.92); t.add(door);
        for (const dy of [4.2, 6.0]) { const w = box(0.2, 0.4, 0.1, toon(0x2a2030), { outline: 0 }); w.position.set(0, dy, 0.8); t.add(w); }
        group.add(t); }
      { const cx = x0 + span * 0.62, cross = new THREE.Group(); cross.position.set(cx, near.userData.height(cx) - 0.3, -9 + zo);
        const st = toon(0xa09a8c), v = box(0.45, 3.2, 0.35, st, { outline: 0.05 }); v.position.y = 1.6; cross.add(v);
        const h = box(2.0, 0.45, 0.35, st, { outline: 0.05 }); h.position.y = 2.4; cross.add(h);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.12, 6, 20), st); ring.position.y = 2.4; cross.add(ring);
        group.add(cross); }
      // sheep + a rainbow in the far sky
      group.add(sheepFlock(along(x0 + 6, x1 - 6, 4, 9, rnd, x => [x, near.userData.height(x) - 0.55, -9.4 - rnd() * 1.2 + zo, rnd() < 0.5 ? 1 : -1])));
      group.add(sheepFlock(along(x0, x1, 5, 10, rnd, x => [x, mid.userData.height(x) - 0.8, -27 + zo, 1])));
      const rb = rainbow(x0 + span * 0.45, -2.2, -78 + zo, 24); group.add(rb);
      let rt = 0; anim.push(dt => { rt += dt; rb.children.forEach((m, i) => { m.material.opacity = 0.42 + Math.sin(rt * 0.8 + i * 0.5) * 0.08; }); });
      return { group, anim };
    },
  };

  W.NGA = {
    name: 'Nigeria', item: 'drum', sky: [0x2f86e6, 0xffe6bc], fog: 0xf3dfb8, sun: true,
    soil: ['#a65a2c', '#8a4620', '#c8824a'], grass: ['#a9b83f', '#8a9a2c', '#cddb62'], tuft: 0x8a9a2c, block: 'ankara', ledge: 'wood', blockInk: 0x14532d,
    build(x0, x1, zo, rnd) {
      const group = new THREE.Group(), anim = [], span = x1 - x0;
      group.add(plain(x0, x1, 0xb8a050));
      const near = ridge(x0, x1, -10 + zo, -2.2, 3, 0.3, 0xb2b845, 2.8, 1.2), mid = ridge(x0, x1, -26 + zo, -2.2, 5, 1.5, 0x9a8a3c, 6.2, 2);
      group.add(near, mid);
      group.add(peaks(x0 - 30, x1 + 30, -66 + zo, rnd, { color: 0x9a7a5a, snow: 0xb8956a, h: [5, 8], r: [10, 16], snowLine: 0.9 }));
      // Zuma Rock
      const zx = x0 + span * 0.5, zuma = rockDome(10, 17, 8, 0x8a6f5a); zuma.position.set(zx, -2.2, -58 + zo); group.add(zuma);
      // a skyline of towers on the horizon
      const tw = []; for (let i = 0; i < 16; i++) tw.push([x0 + span * 0.12 + i * 2.6 + rnd(), -2.2, -50 + zo - rnd() * 3, 3 + rnd() * 9, 1.4 + rnd() * 1.2]);
      group.add(instancedInked(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.BoxGeometry(1.06, 1.04, 1.06).translate(0, 0.5, 0), toon(0x8aa0c0), tw.length, (o, i) => { const [x, y, z, h, w] = tw[i]; o.position.set(x, y, z); o.scale.set(w, h, w); }));
      group.add(instanced(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), toon(0xcfe3f5), 6, (o, i) => { const t = tw[i * 2]; o.position.set(t[0], t[1] + t[3] * 0.4, t[2] + t[4] * 0.52); o.scale.set(t[4] * 0.7, t[3] * 0.5, 0.02); }, false));
      // oil palms, acacias, mud-brick huts
      group.add(palms(along(x0, x1, 5, 10, rnd, x => [x, -2.2, -4 - rnd() * 3 + zo, 0.9 + rnd() * 0.4, (rnd() - 0.4) * 0.5])));
      group.add(umbrellaTrees(along(x0, x1, 8, 16, rnd, x => [x, mid.userData.height(x) - 0.6, -26.5 + zo, 1.3])));
      group.add(umbrellaTrees(along(x0 + 3, x1, 12, 22, rnd, x => [x, -2.2, -7.5 - rnd() * 1.5 + zo, 1.0])));
      group.add(roundHuts(along(x0 + 10, x1 - 10, 16, 28, rnd, x => [x, near.userData.height(x) - 0.8, -11 + zo])));
      const gt = flagTex('ngflag', (c, w, h) => { c.fillStyle = '#0f8a3c'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.fillRect(w / 3, 0, w / 3, h); });
      for (let x = x0 + 14; x < x1 - 10; x += 38 + rnd() * 20) group.add(flagPole(x, near.userData.height(x) - 0.45, -9 + zo, gt));
      // elephants strolling on the savanna
      for (let k = 0; k < 2; k++) {
        const e = elephant(), bx = x0 + span * (0.3 + k * 0.4), z = -13 - k * 1.5 + zo; e.scale.setScalar(0.9); e.position.set(bx, near.userData.height(bx) - 0.45, z); group.add(e);
        let t = rnd() * 6; anim.push(dt => { t += dt; const c = Math.cos(t * 0.1); e.position.x = bx + Math.sin(t * 0.1) * 12; e.rotation.y = c >= 0 ? 0 : Math.PI; e.userData.legs.forEach((l, i) => { l.rotation.z = Math.sin(t * 1.6 + (i % 2) * Math.PI) * 0.12; }); });
      }
      return { group, anim };
    },
  };

  W.CAN = {
    name: 'Canada', item: 'maple', sky: [0x2a7fe6, 0xe3f1fb], fog: 0xe0ecf4, sun: true,
    soil: ['#5e4a3a', '#4a3a2c', '#8a7a68'], grass: ['#58a448', '#3f8a3a', '#8ad070'], tuft: 0x3f8a3a, block: 'plaid', ledge: 'wood', blockInk: 0x3a0a0e,
    build(x0, x1, zo, rnd) {
      const group = new THREE.Group(), anim = [], span = x1 - x0;
      group.add(plain(x0, x1, 0x4f9440));
      const near = ridge(x0, x1, -10 + zo, -2.2, 4, 0.4, 0x5aa648, 3.7, 1.2), mid = ridge(x0, x1, -26 + zo, -2.2, 9, 2.2, 0x2f6a3a, 1.4, 2);
      group.add(near, mid);
      // glacial lake in front of the Rockies
      const lake = new THREE.Mesh(new THREE.PlaneGeometry(span + 60, 18), toon(0x35b8c4, { unique: true })); lake.rotation.x = -Math.PI / 2; lake.position.set((x0 + x1) / 2, -2.15, -46 + zo); group.add(lake);
      group.add(peaks(x0 - 30, x1 + 30, -66 + zo, rnd, { color: 0x7c88a2, h: [15, 24], r: [8, 12], snowLine: 0.45 }));
      group.add(peaks(x0, x1, -40 + zo, rnd, { color: 0x5a6a80, h: [8, 13], r: [5, 8], gap: [10, 16], snowLine: 0.7 }));
      // spruce forests, maple trees in red and gold
      group.add(firs(along(x0, x1, 1.8, 3.4, rnd, x => [x, mid.userData.height(x) - 2.4, -27.5 - rnd() * 1.5 + zo, 1.2 + rnd() * 0.6]), 0x1f4a32));
      group.add(firs(along(x0, x1, 5, 10, rnd, x => [x, -2.2, -3.8 - rnd() * 2.4 + zo, 1.1 + rnd() * 0.5]), 0x24503a));
      group.add(trunkCrownTrees(along(x0, x1, 8, 15, rnd, x => [x, near.userData.height(x) - 0.4, -10.4 - rnd() + zo, 1.1]), { trunk: 0x5a3a26, crown: 0xd9482a, crownScale: [1.25, 1.0, 1.15] }));
      group.add(trunkCrownTrees(along(x0 + 6, x1, 9, 17, rnd, x => [x, near.userData.height(x) - 0.4, -9.4 - rnd() + zo, 1.0]), { trunk: 0x5a3a26, crown: 0xe8962a, crownScale: [1.2, 1.0, 1.1] }));
      // cabin on the shore, a tower in the distance
      group.add(logCabin(x0 + span * 0.26, near.userData.height(x0 + span * 0.26) - 0.6, -11.5 + zo));
      { const tx = x0 + span * 0.72, t = skyTower(tx, mid.userData.height(tx) - 1.2, -30 + zo); t.scale.set(0.85, 1.25, 0.85); group.add(t); }
      // flags, moose, canoe
      const ft = flagTex('caflag', (c, w, h) => { c.fillStyle = '#e0262f'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.fillRect(w * 0.25, 0, w * 0.5, h); c.fillStyle = '#e0262f'; const cx = w / 2, cy = h / 2; c.beginPath(); for (let i = 0; i < 14; i++) { const a = -Math.PI / 2 + i * Math.PI / 7, r = i % 2 ? 9 : 19; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.05); } c.closePath(); c.fill(); c.fillRect(cx - 1.5, cy + 12, 3, 8); });
      for (let x = x0 + 14; x < x1 - 10; x += 44 + rnd() * 18) group.add(flagPole(x, near.userData.height(x) - 0.4, -9 + zo, ft));
      { const mx = x0 + span * 0.5; group.add(quadruped(mx, near.userData.height(mx) - 0.35, -11 + zo, { body: 0x5a3a24, w: 2.1, h: 1.1, legs: 1.2, antlers: true })); }
      const cn = canoe(); cn.position.set(x0 + 20, -2.12, -40 + zo); group.add(cn);
      let ct = 0; anim.push(dt => { ct += dt; cn.position.x = x0 + 20 + ((ct * 1.1) % Math.max(30, span - 30)); cn.position.y = -2.12 + Math.sin(ct * 1.6) * 0.05; cn.rotation.z = Math.sin(ct * 1.1) * 0.03; });
      return { group, anim };
    },
  };

  return W;
}
