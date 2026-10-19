// BRASILI world map: nine islands (Group A–H and the knockout world) linked by bridges.
// Brasili walks from level to level; a level opens when the one before is finished.
/* global THREE */
import { toon, box, sphere, cylinder, cone, canvasTexture, hex, inkMaterial, glowSprite, INK } from './toon.js';
import { makeFootballer, animate } from './rig.js';
import { drawFlag } from '../ui/flags.js';
import { levelOpen, bonusOpen, playable } from './progress.js';
import { finaleKind, FINALE_LABEL } from '../shared/finale.js';
import { instanced, makeRnd } from './themes3d.js';

const LAYOUT = [[0, 0], [37, -5], [74, 0], [76, -40], [39, -45], [2, -41], [0, -82], [38, -87], [90, -90]];
const TOPS = [0x7cc84a, 0xe2c27a, 0x5fc9a8, 0xe8a85a, 0xb9a3e8, 0x9fd98a, 0xa8d8f0, 0xf29a8a, 0x6fbf4a];
const GROUP_R = 13.5, KO_R = 21;
const LOCAL = [[-9, 2], [-5.5, -2.5], [-1.5, 2.5], [2.5, -2.5], [6, 2.5], [9.5, -1.5]];
const BONUS_LOCAL = [-1.5, 8];
const KO_LOCAL = [[-15, 9], [-11, 9], [-7, 9], [-3, 9], [1, 9], [5, 9], [9, 9], [13, 9], [13, 2], [6, 2], [-2, 2], [-10, 2], [-12, -5], [-5, -5], [2, -6], [11, -10]];
const KO_LABEL = id => id <= 56 ? 'R16' : id <= 60 ? 'QF' : id <= 62 ? 'SF' : id === 63 ? '3RD' : 'FINAL';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function flagTex(code) {
  const c = document.createElement('canvas'); c.width = 96; c.height = 64; drawFlag(c.getContext('2d'), code, 0, 0, 96, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function labelTex(text, bg = '#fffaf0', fg = '#1a1222') {
  return canvasTexture(128, 128, c => { c.fillStyle = bg; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill(); c.font = `${text.length > 3 ? 34 : 52}px "Bangers", Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = fg; c.fillText(text, 64, 68); });
}
function signTex(lines, bg, fg) {
  return canvasTexture(512, 192, c => {
    c.fillStyle = bg; c.fillRect(0, 0, 512, 192); c.lineWidth = 12; c.strokeStyle = '#1a1222'; c.strokeRect(6, 6, 500, 180);
    c.textAlign = 'center'; c.fillStyle = fg; c.font = '44px "Press Start 2P", monospace'; c.fillText(lines[0], 256, 78);
    c.font = '64px "Bangers", Impact, sans-serif'; c.fillText(lines[1], 256, 160);
  });
}
function rot([x, z], a) { return [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)]; }

// small landmarks for the islands (one per team that has its own world)
function miniLandmark(code) {
  const g = new THREE.Group();
  if (code === 'NZL') { const s = cylinder(0.16, 0.24, 4.2, toon(0xd9dde4), { outline: 0.04 }); s.position.y = 2.1; g.add(s); const pod = cylinder(0.55, 0.45, 0.4, toon(0x9fb3c8), { outline: 0.04 }); pod.position.y = 4.1; g.add(pod); const m = cylinder(0.04, 0.08, 1.4, toon(0xf0f0f0), { outline: 0.02 }); m.position.y = 5; g.add(m); }
  else if (code === 'NOR') { const b = box(1.4, 0.9, 1, toon(0x3b2416), { outline: 0.05 }); b.position.y = 0.45; g.add(b); [[1.6, 0.5, 1.2], [1.1, 0.5, 1.7], [0.7, 0.8, 2.2]].forEach(([r, h, y]) => { const c = cone(r * 0.7, h, toon(0x2a1a10), { outline: 0.04, seg: 4 }); c.rotation.y = Math.PI / 4; c.position.y = y; g.add(c); }); }
  else if (code === 'SUI') { const geo = new THREE.ConeGeometry(1.6, 4.2, 4, 2); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const k = (p.getY(i) + 2.1) / 4.2; p.setX(i, p.getX(i) + k * k * 0.6); } geo.computeVertexNormals(); const m = new THREE.Mesh(geo, toon(0x7d7f8f)); m.position.y = 2.1; g.add(m); const s = cone(0.62, 1.6, toon(0xf7f9fd), { outline: 0.04, seg: 4 }); s.position.set(0.5, 3.4, 0); g.add(s); }
  else if (code === 'PHI') { const pts = []; for (let i = 0; i <= 8; i++) { const k = i / 8; pts.push(new THREE.Vector2(Math.max(0.12, 1.8 * Math.pow(1 - k, 1.6)), k * 3)); } const v = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), toon(0x6f7d8a)); g.add(v); const ink = new THREE.Mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p.x * 1.05, p.y)), 16), inkMaterial()); g.add(ink); const smoke = sphere(0.4, toon(0xf2f2f2), { outline: 0.03 }); smoke.position.set(0.3, 3.4, 0); g.add(smoke); }
  else if (code === 'ESP') { const t = cylinder(0.4, 0.55, 2, toon(0xf6f2ea), { outline: 0.04 }); t.position.y = 1; g.add(t); const r = cone(0.55, 0.7, toon(0x2b2b33), { outline: 0.04 }); r.position.y = 2.35; g.add(r); for (let k = 0; k < 4; k++) { const a = box(0.08, 1.4, 0.05, toon(0xe8dcc6), { outline: 0.02 }); a.position.set(0, 2, 0.6); a.rotation.z = k * Math.PI / 2 + 0.4; a.translateY(0.7); g.add(a); } }
  else { const t = cylinder(0.12, 0.16, 1, toon(0x6d4a2a), { outline: 0.03 }); t.position.y = 0.5; g.add(t); const c = sphere(0.8, toon(0x3d8f3a), { outline: 0.05 }); c.position.y = 1.4; g.add(c); }
  return g;
}
function flagPole(code) {
  const g = new THREE.Group();
  const pole = cylinder(0.05, 0.05, 2.6, toon(0xd9d9d9), { outline: 0.02 }); pole.position.y = 1.3; g.add(pole);
  const f = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.04), toon(0xffffff, { map: flagTex(code), unique: true })); f.position.set(0.62, 2.15, 0); g.add(f);
  return g;
}
function stadiumModel() {
  const g = new THREE.Group();
  const pts = [new THREE.Vector2(3.6, 0), new THREE.Vector2(5.4, 0), new THREE.Vector2(5.6, 2.2), new THREE.Vector2(4.6, 2.6), new THREE.Vector2(3.8, 0.6)];
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), toon(0xe9edf2, { side: THREE.DoubleSide })); bowl.scale.set(1.25, 1, 1); g.add(bowl);
  const ink = new THREE.Mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p.x * 1.03, p.y)), 40), inkMaterial()); ink.scale.set(1.25, 1.01, 1); g.add(ink);
  const pitch = new THREE.Mesh(new THREE.CircleGeometry(3.7, 32), toon(0x3f9d47)); pitch.rotation.x = -Math.PI / 2; pitch.position.y = 0.05; pitch.scale.set(1.25, 1, 1); g.add(pitch);
  const ring = cylinder(5.9, 5.9, 0.35, toon(0x3a86ff), { outline: 0.04, seg: 40 }); ring.scale.set(1.25, 1, 1); ring.position.y = 2.5; g.add(ring);
  return g;
}

export class WorldMap {
  // o: { renderer, data, worlds, progress, look, onEnter(node), onAlbum(), onBoard(), canToggleUnlock(), onToggleUnlock() }
  constructor(container, o) {
    this.c = container; this.o = o; this.data = o.data; this.worlds = o.worlds; this.st = o.progress;
    this.t = 0;
    this.build();
  }
  build() {
    const S = this.scene = new THREE.Scene();
    S.background = new THREE.Color(0x63b7e6);
    S.fog = new THREE.Fog(0x9fd2ef, 60, 150);
    this.camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.5, 400);
    S.add(new THREE.HemisphereLight(0xeaf6ff, 0x5a8a6a, 1.25));
    const sun = this.sunLight = new THREE.DirectionalLight(0xfff2d6, 1.9); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 }); sun.shadow.bias = -0.0008;
    S.add(sun, sun.target);
    // sea
    const seaTex = canvasTexture(128, 128, (c, w) => { c.fillStyle = '#3aa0d8'; c.fillRect(0, 0, w, w); c.fillStyle = '#69c0ea'; for (let y = 8; y < w; y += 20) for (let x = (y * 3) % 40; x < w; x += 40) c.fillRect(x, y, 16, 3); }, { repeat: true });
    seaTex.repeat.set(60, 60);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), toon(0xffffff, { map: seaTex, unique: true })); sea.rotation.x = -Math.PI / 2; sea.position.set(45, -1.1, -45); sea.receiveShadow = true; S.add(sea);
    this.seaTex = seaTex;

    // islands, nodes, paths
    this.nodes = []; this.seq = []; this.islands = [];
    const rnd = makeRnd(99);
    this.worlds.forEach((w, wi) => {
      const [cx, cz] = LAYOUT[wi], R = w.ko ? KO_R : GROUP_R;
      const prev = LAYOUT[wi - 1], next = LAYOUT[wi + 1];
      const dir = next && prev ? [next[0] - prev[0], next[1] - prev[1]] : next ? [next[0] - cx, next[1] - cz] : [cx - prev[0], cz - prev[1]];
      const ang = w.ko ? 0 : Math.atan2(dir[1], dir[0]);
      const island = new THREE.Group(); island.position.set(cx, 0, cz); S.add(island);
      const top = cylinder(R, R * 1.05, 2.2, toon(TOPS[wi]), { outline: 0.12, seg: 40 }); top.position.y = -1.1; top.receiveShadow = true; island.add(top);
      const cliff = cylinder(R * 1.05, R * 1.12, 1.4, toon(0x9a7550), { outline: 0.1, seg: 40 }); cliff.position.y = -2.1; island.add(cliff);
      const foam = new THREE.Mesh(new THREE.RingGeometry(R * 1.12, R * 1.3, 48), new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.55 })); foam.rotation.x = -Math.PI / 2; foam.position.y = -1.05; island.add(foam);
      // trees around the edge
      const trees = []; for (let k = 0; k < (w.ko ? 34 : 22); k++) { const a = rnd() * 6.283, r = R * (0.8 + rnd() * 0.14); trees.push([Math.cos(a) * r, Math.sin(a) * r, 0.7 + rnd() * 0.5]); }
      island.add(instanced(new THREE.CylinderGeometry(0.12, 0.16, 1, 6).translate(0, 0.5, 0), toon(0x6d4a2a), trees.length, (o, i) => { const [x, z, s] = trees[i]; o.position.set(x, 0, z); o.scale.setScalar(s); }));
      island.add(instanced(new THREE.SphereGeometry(0.75, 9, 7), toon(0x3d8f3a), trees.length, (o, i) => { const [x, z, s] = trees[i]; o.position.set(x, 1.3 * s, z); o.scale.setScalar(s); }));
      island.add(instanced(new THREE.SphereGeometry(0.8, 9, 7), new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }), trees.length, (o, i) => { const [x, z, s] = trees[i]; o.position.set(x, 1.3 * s, z); o.scale.setScalar(s); }, false));
      // levels
      const locals = w.ko ? KO_LOCAL : LOCAL;
      const wnodes = w.matches.map((m, i) => {
        const [lx, lz] = rot(locals[i] || [0, 0], w.ko ? 0 : ang);
        const node = { type: 'level', w: wi, i, m, x: cx + lx, z: cz + lz, label: w.ko ? KO_LABEL(m.id) : `${wi + 1}-${i + 1}` };
        this.addNode(node); this.seq.push(node); return node;
      });
      if (w.bonus) {
        const [lx, lz] = rot(BONUS_LOCAL, ang);
        const parent = wnodes[w.bonus.after];
        const bn = { type: 'bonus', w: wi, i: -1, parent, x: cx + lx, z: cz + lz, label: '★', key: w.bonus.key };
        parent.bonus = bn; this.addNode(bn);
        this.addPath(parent, bn, 0xd9c8f0);
      }
      for (let i = 1; i < wnodes.length; i++) this.addPath(wnodes[i - 1], wnodes[i], 0xe8d9a8);
      // decoration: flags and landmarks of the group's teams, the world sign
      w.teams.forEach((code, k) => {
        const [lx, lz] = rot([-7.5 + k * 5, -8.5 + (k % 2) * 1.2], ang);
        const fp = flagPole(code); fp.position.set(lx - 1.2, 0, lz); island.add(fp);
        const lm = miniLandmark(code); lm.position.set(lx + 0.8, 0, lz - 0.6); island.add(lm);
      });
      if (w.ko) { const st = stadiumModel(); st.position.set(13.5, 0, -12); island.add(st); }
      const [sx, sz] = rot(w.ko ? [-17, -4] : [-11.5, -6], w.ko ? 0 : ang);
      const sign = new THREE.Group(); sign.position.set(sx, 0, sz);
      for (const dx of [-1.1, 1.1]) { const p = cylinder(0.07, 0.07, 2.4, toon(0x6b4a2a), { outline: 0.02 }); p.position.set(dx, 1.2, 0); sign.add(p); }
      const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 0.1), [toon(0x6b4a2a), toon(0x6b4a2a), toon(0x6b4a2a), toon(0x6b4a2a), toon(0xffffff, { map: signTex([w.title, w.ko ? 'KNOCKOUTS' : w.name.toUpperCase()], '#fffaf0', '#1a1222'), unique: true }), toon(0x6b4a2a)]);
      board.position.y = 2.1; sign.add(board); island.add(sign);
      // clouds over locked islands
      const clouds = new THREE.Group(); clouds.position.y = 2.5;
      for (let k = 0; k < 16; k++) { const a = rnd() * 6.283, r = rnd() * R * 0.8; const p = new THREE.Mesh(new THREE.SphereGeometry(2 + rnd() * 1.6, 12, 9), toon(0xffffff, { emissive: 0xdde8f2, emissiveIntensity: 0.6 })); p.position.set(Math.cos(a) * r, rnd() * 1.5, Math.sin(a) * r); p.scale.y = 0.6; clouds.add(p); }
      const lock = new THREE.Group(); const lb = box(1.6, 1.3, 0.5, toon(0xffd23f), { outline: 0.06 }); lock.add(lb); const sh = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.14, 8, 16, Math.PI), toon(0xc9ced8)); sh.position.y = 0.65; lock.add(sh); lock.position.y = 4.5; clouds.add(lock);
      island.add(clouds);
      this.islands.push({ w, island, clouds, lock, R, center: [cx, cz] });
    });
    // bridges between the islands
    for (let wi = 1; wi < this.worlds.length; wi++) {
      const a = this.seq.filter(n => n.w === wi - 1).pop(), b = this.seq.find(n => n.w === wi);
      this.addPath(a, b, 0x9a6234, true);
    }
    // Brasili
    const look = this.o.look;
    this.hero = makeFootballer({ scale: 1.25, look, kit: look.kit });
    S.add(this.hero.root);
    const at = this.seq.find(n => n.m.id === this.st.at) || this.seq[0];
    this.cur = at; this.hero.root.position.set(at.x, 0.35, at.z); this.heading = 0;
    this.camPos = new THREE.Vector3(at.x, 17.5, at.z + 17); this.camLook = new THREE.Vector3(at.x, 0, at.z - 1);
    this.walk = null;
    this.sparkles = [];
    // DOM: top bar + node card
    this.hud = document.createElement('div'); this.hud.className = 'map-hud'; this.c.appendChild(this.hud);
    this.card = document.createElement('div'); this.card.className = 'map-card'; this.c.appendChild(this.card);
    this.refresh();
  }
  addNode(n) {
    const g = new THREE.Group(); g.position.set(n.x, 0, n.z);
    const base = cylinder(n.type === 'bonus' ? 1.15 : 1.05, 1.15, 0.35, toon(0xffffff, { unique: true }), { outline: 0.05, seg: n.type === 'bonus' ? 5 : 24 });
    base.position.y = 0.17; base.receiveShadow = true; g.add(base);
    const label = new THREE.Mesh(new THREE.CircleGeometry(0.78, 28), new THREE.MeshBasicMaterial({ map: labelTex(n.label), transparent: true }));
    label.rotation.x = -Math.PI / 2; label.position.y = 0.36; g.add(label);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.45, 32), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
    if (n.type === 'level') {
      for (const [k, code] of [[-1, n.m.home], [1, n.m.away]]) { const fp = new THREE.Group(); const pole = cylinder(0.035, 0.035, 1.5, toon(0xd9d9d9), { outline: 0.015 }); pole.position.y = 0.75; fp.add(pole); const f = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.03), toon(0xffffff, { map: flagTex(code), unique: true })); f.position.set(0.32, 1.28, 0); fp.add(f); fp.position.set(k * 1.25, 0, -0.75); g.add(fp); }
      const ball = sphere(0.22, toon(0xffffff), { outline: 0.03 }); ball.position.set(0.55, 0.6, 0.45); ball.visible = false; g.add(ball); n.ballMesh = ball;
      const star = cone(0.25, 0.4, toon(0xffd23f), { outline: 0.03, seg: 5 }); star.position.set(-0.55, 0.62, 0.45); star.visible = false; g.add(star); n.doneMesh = star;
    } else {
      const wall = box(1.0, 0.8, 0.12, toon(0x2f9e44), { outline: 0.04 }); wall.position.set(0, 0.95, -0.7); g.add(wall);
      for (const [hx, hy] of [[-0.25, 0.75], [0.25, 1.12]]) { const h = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), new THREE.MeshBasicMaterial({ color: 0x1a1222 })); h.position.set(hx, hy, -0.63); g.add(h); }
    }
    n.group = g; n.base = base; n.ring = ring;
    this.scene.add(g); this.nodes.push(n);
  }
  addPath(a, b, color, bridge = false) {
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
    if (bridge) {
      const plank = new THREE.BoxGeometry(0.28, 0.16, 1.6), n = Math.floor(len / 0.4);
      const deck = instanced(plank, toon(color), n, (o, i) => { const t = (i + 0.5) / n; o.position.set(a.x + dx * t, 0.04 + Math.sin(t * Math.PI) * 0.5, a.z + dz * t); o.rotation.y = -ang; });
      this.scene.add(deck);
      for (const side of [-1, 1]) { const rope = instanced(new THREE.BoxGeometry(0.08, 0.6, 0.08), toon(0x6b4a2a), Math.floor(n / 4), (o, i) => { const t = (i * 4 + 0.5) / n; o.position.set(a.x + dx * t - Math.sin(ang) * 0.8 * side, 0.34 + Math.sin(t * Math.PI) * 0.5, a.z + dz * t + Math.cos(ang) * 0.8 * side); }); this.scene.add(rope); }
      a.bridgeTo = b; b.bridgeFrom = a;
      return;
    }
    const n = Math.max(2, Math.floor(len / 0.85));
    this.scene.add(instanced(new THREE.CylinderGeometry(0.32, 0.36, 0.1, 10), toon(color), n, (o, i) => { const t = (i + 0.5) / n; o.position.set(a.x + dx * t, 0.03, a.z + dz * t); o.scale.set(1, 1, 0.8); o.rotation.y = -ang; }, false));
  }
  // node states from the progress
  refresh() {
    const st = this.st;
    for (const n of this.nodes) {
      if (n.type === 'level') {
        const lv = st.levels[n.m.id];
        n.open = levelOpen(st, this.worlds, n.w, n.i); n.done = !!lv?.done; n.goal = !!lv?.goal; n.best = lv?.best || 0;
        n.playable = playable(n.m, this.data);
        const col = !n.open ? 0x9aa0ad : !n.playable ? 0xc9b996 : n.done ? 0x2fbf71 : 0xffd23f;
        n.base.material.color.setHex(col);
        n.ballMesh.visible = n.goal; n.doneMesh.visible = n.done;
      } else {
        n.open = bonusOpen(st, this.worlds[n.w]) && (st.unlockAll || n.w === 0);
        n.playable = n.w === 0 || st.unlockAll;
        n.best = st.bonus[n.key]?.best || 0; n.done = !!st.bonus[n.key]?.played;
        n.base.material.color.setHex(!n.open ? 0x9aa0ad : 0xb57bff);
      }
      n.ring.visible = n.open && !n.done;
    }
    for (const isl of this.islands) {
      const first = this.seq.find(n => n.w === isl.w.index);
      isl.clouds.visible = !first.open;
    }
    if (this.cur && !this.cur.open && !this.walk) {
      const back = [...this.seq].reverse().find(n => n.open) || this.seq[0];
      this.focusMatch(back.m.id);
    }
    this.renderHud();
    this.renderCard();
  }
  renderHud() {
    const st = this.st;
    this.hud.innerHTML = `
      <div class="mh-left"><b class="logo">BRASILI</b><span class="chip">${this.o.score().toLocaleString('en')} PTS</span></div>
      <div class="mh-right"><button class="chip btn-album" data-a="album">ALBUM <b>${this.o.albumCount()}/${this.o.albumTotal()}</b></button><button class="chip btn-album" data-a="board">TOP LIST</button>${this.o.canToggleUnlock?.() ? `<button class="chip ${st.unlockAll ? 'on' : ''}" data-a="unlock" title="Test mode: open every level">TEST: ${st.unlockAll ? 'ALL OPEN' : 'UNLOCK ALL'}</button>` : ''}</div>`;
    this.hud.querySelector('[data-a=album]').onclick = () => this.o.onAlbum();
    this.hud.querySelector('[data-a=board]').onclick = () => this.o.onBoard();
    const unlock = this.hud.querySelector('[data-a=unlock]'); if (unlock) unlock.onclick = () => { this.o.onToggleUnlock(); };
  }
  renderCard() {
    const n = this.cur, D = this.data, w = this.worlds[n.w];
    if (!n) { this.card.innerHTML = ''; return; }
    let html;
    const keys = `<div class="mc-keys"><span><kbd>←</kbd><kbd>→</kbd> walk</span>${n.bonus && n.bonus.open ? '<span><kbd>↑</kbd> bonus</span>' : ''}${n.type === 'bonus' ? '<span><kbd>↓</kbd> back</span>' : ''}<span><kbd>A</kbd> album</span></div>`;
    if (n.type === 'bonus') {
      html = `<div class="mc-kicker">${esc(w.title)} · ${esc(w.name)} · BONUS LEVEL</div>
        <div class="mc-title">THE GOAL WALL <small>Torwandschießen</small></div>
        <div class="mc-line">6 shots at a wall with two holes – 3 low, 3 high. A German TV classic.</div>
        <div class="mc-line">${n.done ? `Best: <b>${n.best.toLocaleString('en')}</b> points · ${this.st.bonus[n.key]?.hits || 0} / 6 hits` : 'Not played yet'}</div>
        <div class="mc-actions">${n.playable ? '<kbd>SPACE</kbd> play' : 'Coming soon'}</div>${keys}`;
    } else {
      const m = n.m, T = D.teams, V = D.venues[m.venue], home = T[m.home], away = T[m.away];
      const flag = code => `<i class="mc-flag" data-flag="${code}"></i>`;
      const kind = finaleKind(m.id);
      let status;
      if (!n.open) status = n.i > 0 ? `Finish level ${n.w + 1}-${n.i} to open this one.` : `Finish ${esc(this.worlds[n.w - 1]?.name || '')} to open this world.`;
      else if (!n.playable) status = 'Coming soon – the 3D worlds of these teams are still being built.';
      else status = n.done ? `Best: <b>${n.best.toLocaleString('en')}</b>${n.goal ? ' · ⚽ goal' : ''}` : 'Not played yet';
      html = `<div class="mc-kicker">${esc(w.title)} · ${esc(w.ko ? m.stage : w.name)} · LEVEL ${esc(n.label)} · MATCH ${m.id}</div>
        <div class="mc-title">${flag(m.home)} ${esc(home?.name || m.home)} <span>vs</span> ${esc(away?.name || m.away)} ${flag(m.away)}</div>
        <div class="mc-line">${esc(V?.stadium || '')}, ${esc(V?.city || '')} · Finale: <b>${FINALE_LABEL[kind]}</b></div>
        <div class="mc-line">${status}</div>
        <div class="mc-actions">${n.open && n.playable ? '<kbd>SPACE</kbd> play' : ''}</div>${keys}`;
    }
    this.card.innerHTML = html;
    this.card.querySelectorAll('[data-flag]').forEach(el => { const c = document.createElement('canvas'); c.width = 36; c.height = 24; drawFlag(c.getContext('2d'), el.dataset.flag, 0, 0, 36, 24); el.replaceWith(c); c.className = 'mc-flag'; });
  }

  // ------------------------------------------------------------------ walking
  neighbour(dir) {
    const n = this.cur;
    if (n.type === 'bonus') return dir === 'down' || dir === 'left' || dir === 'right' ? n.parent : null;
    if (dir === 'up') return n.bonus && n.bonus.open ? n.bonus : null;
    const k = this.seq.indexOf(n);
    if (dir === 'right' || dir === 'down') { const nx = this.seq[k + 1]; return nx && nx.open ? nx : null; }
    if (dir === 'left') return this.seq[k - 1] || null;
    return null;
  }
  go(dir) {
    if (this.walk) return;
    const to = this.neighbour(dir);
    if (!to) { if (dir === 'right' && this.seq[this.seq.indexOf(this.cur) + 1]) this.bump(); return; }
    const pts = [[this.cur.x, this.cur.z], [to.x, to.z]];
    const len = Math.hypot(to.x - this.cur.x, to.z - this.cur.z);
    this.walk = { from: this.cur, to, pts, t: 0, dur: Math.max(0.35, len / 9), bridge: this.cur.bridgeTo === to || this.cur.bridgeFrom === to };
    this.card.classList.add('dim');
  }
  bump() { this.bumpT = 0.35; }
  enter() {
    const n = this.cur;
    if (this.walk || !n.open || !n.playable) { this.bump(); return; }
    this.o.onEnter(n);
  }
  celebrate(n) {
    if (!n) return;
    this.sparkles.push({ n, t: 0 });
  }
  focusMatch(id) { const n = this.seq.find(x => x.m.id === id); if (n) { this.cur = n; this.st.at = id; this.hero.root.position.set(n.x, 0.35, n.z); if (this.card) this.renderCard(); } }

  // ------------------------------------------------------------------ loop
  start() {
    this.c.prepend(this.o.renderer.domElement);
    this.o.renderer.domElement.className = 'g3d-canvas';
    this.onKey = e => {
      if (this.inputOff) return;
      if (e.repeat && !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) return;
      const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.code];
      if (k) { e.preventDefault(); this.go(k); return; }
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.enter(); }
      if (e.code === 'KeyA') { e.preventDefault(); this.o.onAlbum(); }
      if (e.code === 'KeyL') { e.preventDefault(); this.o.onBoard(); }
    };
    window.addEventListener('keydown', this.onKey);
    this.onResize = () => this.resize(); window.addEventListener('resize', this.onResize); this.resize();
    this.running = true;
    let last = performance.now();
    const tick = now => { if (!this.running) return; const dt = Math.min(0.1, (now - last) / 1000); last = now; this.frame(dt); this.raf = requestAnimationFrame(tick); };
    this.raf = requestAnimationFrame(tick);
  }
  stop() {
    this.running = false; cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey); window.removeEventListener('resize', this.onResize);
  }
  resize() {
    const r = this.c.getBoundingClientRect(), w = Math.max(320, r.width), h = Math.max(180, r.height);
    this.o.renderer.setSize(w, h, false);
    this.o.renderer.domElement.style.width = '100%'; this.o.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  frame(dt) {
    this.t += dt;
    const H = this.hero;
    let moving = false;
    if (this.walk) {
      const W = this.walk; W.t += dt / W.dur; moving = true;
      const k = Math.min(1, W.t), [a, b] = W.pts;
      const x = a[0] + (b[0] - a[0]) * k, z = a[1] + (b[1] - a[1]) * k;
      H.root.position.set(x, 0.35 + (W.bridge ? Math.sin(k * Math.PI) * 0.5 : 0) + Math.abs(Math.sin(k * Math.PI * 6)) * 0.05, z);
      this.heading = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
      if (k >= 1) { this.cur = W.to; this.walk = null; this.st.at = this.cur.m?.id ?? this.cur.parent.m.id; this.o.onMoved?.(); this.renderCard(); this.card.classList.remove('dim'); }
    }
    let yaw = this.heading;
    if (!moving) yaw = this.heading * 0.0 + (-0.6);
    animate(H, { speed: moving ? 0.75 : 0, ground: true, mode: moving ? 'run' : 'idle', yaw: moving ? this.heading : -Math.PI / 2 + 0.35 }, dt);
    if (this.bumpT > 0) { this.bumpT -= dt; H.root.position.y = 0.35 + Math.sin(this.bumpT * 30) * 0.06; }
    // nodes
    for (const n of this.nodes) if (n.ring.visible) { const s = 1 + Math.sin(this.t * 4 + n.x) * 0.08; n.ring.scale.set(s, s, s); }
    for (const sp of this.sparkles) { sp.t += dt; const s = 1 + sp.t * 3; sp.n.ring.scale.set(s, s, s); sp.n.ring.material.opacity = Math.max(0, 0.9 - sp.t); }
    this.sparkles = this.sparkles.filter(sp => { if (sp.t > 1.2) { sp.n.ring.material.opacity = 0.9; return false; } return true; });
    for (const isl of this.islands) if (isl.clouds.visible) { isl.clouds.rotation.y += dt * 0.03; isl.lock.position.y = 4.5 + Math.sin(this.t * 2) * 0.2; }
    this.seaTex.offset.x += dt * 0.01;
    // camera
    const p = H.root.position;
    const k = Math.min(1, dt * 3);
    this.camPos.lerp(new THREE.Vector3(p.x, 17.5, p.z + 17), k);
    this.camLook.lerp(new THREE.Vector3(p.x, 0, p.z - 1.5), k);
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
    this.sunLight.position.set(p.x - 12, 26, p.z + 14); this.sunLight.target.position.set(p.x, 0, p.z); this.sunLight.target.updateMatrixWorld();
    this.o.renderer.render(this.scene, this.camera);
  }
}
