// BRASILI 3D – renderer for the shared game core (sim.js): toon-shaded 2.5D world, the two
// country worlds of a match, procedural characters, dynamic camera, the three finales
// (header, free kick, penalty), particles, comic name bursts and a DOM HUD.
/* global THREE */
import { Sim, FIXED, TILE, ROWS } from '../game/sim.js';
import { Bursts } from '../game/bursts.js';
import { SCORE } from '../shared/scoring.js';
import { FK, fkAngle } from '../shared/finale.js';
import { makeFootballer, animate } from './rig.js';
import { buildStrip, buildDynamic, buildProps, buildStadium, ballMesh, X, Y, GOAL_HALF_W } from './world.js';
import { buildWorldScenery, world3d, ITEM_ICON } from './themes3d.js';
import { toon, box, cylinder, cone, hex, inkMaterial, FX } from './toon.js';
import { Post, Motes, Governor, TIERS, pickTier, lowerTier } from './fx3d.js';
import { HAIR_STYLES, SKINS, HAIRS } from '../game/sprites.js';
import { drawFlag } from '../ui/flags.js';

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyX: 'jump', KeyK: 'jump', Enter: 'jump',
  ShiftLeft: 'run', ShiftRight: 'run', KeyZ: 'run', KeyJ: 'run', Escape: 'pause', KeyP: 'pause',
};
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => Math.max(0, Math.min(1, v));
const ease = t => 1 - Math.pow(1 - clamp01(t), 3);

// ------------------------------------------------------------------ particles (one draw call)
class Particles {
  constructor(n = 700) {
    this.n = n; this.list = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*(600.0/-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); if(r>0.5) discard; float rim=smoothstep(0.36,0.48,r); gl_FragColor=vec4(mix(vC, vec3(0.1,0.07,0.13), rim*0.8), vA); }',
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false;
  }
  emit(x, y, z, o = {}) {
    for (let i = 0; i < (o.count || 6); i++) {
      if (this.list.length >= this.n) this.list.shift();
      const a = Math.random() * Math.PI * 2, sp = (o.speed ?? 2) * (0.4 + Math.random() * 0.8);
      const c = new THREE.Color(Array.isArray(o.color) ? o.color[i % o.color.length] : (o.color ?? 0xffffff));
      this.list.push({ x, y, z: z + (Math.random() - 0.5) * (o.spreadZ ?? 0.6), vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.abs(Math.sin(a)) * sp * (o.up ?? 1) + (o.vy || 0), vz: (Math.random() - 0.5) * sp * 0.5 + (o.vz || 0), g: o.g ?? 4, life: o.life ?? 0.6, t: 0, s: o.size ?? 0.25, c, drag: o.drag ?? 0.92 });
    }
  }
  update(dt) {
    let k = 0;
    this.list = this.list.filter(p => (p.t += dt) < p.life);
    for (const p of this.list) {
      p.vy -= p.g * dt; p.vx *= Math.pow(p.drag, dt * 60); p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      this.pos[k * 3] = p.x; this.pos[k * 3 + 1] = p.y; this.pos[k * 3 + 2] = p.z;
      this.col[k * 3] = p.c.r; this.col[k * 3 + 1] = p.c.g; this.col[k * 3 + 2] = p.c.b;
      const f = p.t / p.life; this.size[k] = p.s * (1 - f * 0.5) * 10; this.alpha[k] = 1 - f * f; k++;
    }
    for (let i = k; i < this.n; i++) this.alpha[i] = 0;
    const g = this.points.geometry; g.setDrawRange(0, k);
    for (const n of ['position', 'color', 'size', 'alpha']) g.attributes[n].needsUpdate = true;
  }
}

const ICON_HEART = full => `<svg viewBox="0 0 20 18" width="26" height="23"><path d="M10 17 1.8 9.2A5 5 0 0 1 10 3a5 5 0 0 1 8.2 6.2Z" fill="${full ? '#ff4d6d' : '#3a3550'}" stroke="#1a1222" stroke-width="2"/>${full ? '<circle cx="6" cy="6.5" r="1.6" fill="#ffc2cf"/>' : ''}</svg>`;
const ICON_CARD = col => `<svg viewBox="0 0 16 20" width="19" height="24"><rect x="1" y="1" width="14" height="18" rx="1.5" fill="#fdfaf0" stroke="#1a1222" stroke-width="2"/><rect x="3" y="3" width="10" height="10" fill="${col}"/><circle cx="8" cy="7" r="2.2" fill="#2a2030"/><rect x="5" y="9.5" width="6" height="3.5" fill="#2a2030"/></svg>`;
const ICON_SHIELD = '<svg viewBox="0 0 16 20" width="18" height="23"><path d="M2 2h12v12l-6 4-6-4Z" fill="#f5f5f5" stroke="#1a1222" stroke-width="2"/><rect x="3" y="6" width="10" height="3" fill="#3a86ff"/></svg>';
const itemIcon = kind => `<svg viewBox="0 0 20 20" width="24" height="24">${ITEM_ICON[kind] || ITEM_ICON.ball}</svg>`;
const FINALE_BANNER = { header: 'HEADER TIME!', freekick: 'FREE KICK!', penalty: 'PENALTY!' };

function flagTexture(code) {
  const c = document.createElement('canvas'); c.width = 96; c.height = 64;
  const ctx = c.getContext('2d'); drawFlag(ctx, code, 0, 0, 96, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Game3D {
  // o: { match, teams, squads, playerSide, look, renderer?, onPause, onLifeLost, onGameOver, onFinish }
  constructor(container, o) {
    this.c = container; this.o = o;
    this.sim = new Sim({ match: o.match, teams: o.teams, squads: o.squads, playerSide: o.playerSide });
    this.t = 0; this.timeScale = 1; this.slowmo = 0; this.shake = 0;
    this.build();
    this.bindSim();
  }

  // ------------------------------------------------------------------ scene
  build() {
    const sim = this.sim, L = sim.L, o = this.o, F = L.finale, cp = L.checkpointCol;
    this.ownRenderer = !o.renderer;
    const R = this.renderer = o.renderer || new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    if (this.ownRenderer) {
      R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      R.outputColorSpace = THREE.SRGBColorSpace;
      R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    R.domElement.className = 'g3d-canvas';
    this.c.appendChild(R.domElement);
    const pick = pickTier(); this.tierName = pick.name; this.prevPR = R.getPixelRatio();
    this.gov = pick.auto ? new Governor(() => this.setTier(lowerTier(this.tierName))) : null;
    this.fx = document.createElement('canvas'); this.fx.className = 'g3d-fx'; this.c.appendChild(this.fx);
    this.bursts = new Bursts(this.fx);
    this.hud = document.createElement('div'); this.hud.className = 'g3d-hud'; this.c.appendChild(this.hud);
    this.meterEl = document.createElement('div'); this.meterEl.className = 'g3d-meter'; this.meterEl.hidden = true; this.c.appendChild(this.meterEl);

    const S = this.scene = new THREE.Scene();
    this.worlds = [0, 1].map(h => world3d(sim.halfTeam[h]));
    S.fog = new THREE.Fog(this.worlds[0].fog, 45, 190);
    const cam = this.camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.3, 400);
    S.add(cam);
    // sky: gradient plane fixed to the camera (blends between the two worlds and to dusk in the stadium)
    this.skyU = { top: { value: new THREE.Color(this.worlds[0].sky[0]) }, bottom: { value: new THREE.Color(this.worlds[0].sky[1]) }, duskTop: { value: new THREE.Color(0x1b2350) }, duskBottom: { value: new THREE.Color(0xff9a62) }, dusk: { value: 0 } };
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: this.skyU, depthWrite: false, depthTest: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.9999,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; uniform vec3 duskTop; uniform vec3 duskBottom; uniform float dusk; varying vec2 vUv; void main(){ float t=smoothstep(0.0,1.0,vUv.y); vec3 a=mix(bottom,top,t); vec3 b=mix(duskBottom,duskTop,t); vec3 c=mix(a,b,dusk); float band=step(0.5,fract(vUv.y*14.0))*0.015; gl_FragColor=vec4(c+band,1.0); }' }));
    sky.frustumCulled = false; sky.renderOrder = -10; S.add(sky);
    this.sun = new THREE.Group();
    this.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff4c8).multiplyScalar(5), fog: false }));
    this.sun.add(this.sunDisc);
    const halo = new THREE.Mesh(new THREE.CircleGeometry(5.5, 32), new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.25, fog: false, depthWrite: false }));
    halo.position.z = -0.1; this.sun.add(halo);
    this.sun.position.set(25, 12.5, -60); cam.add(this.sun);

    this.hemi = new THREE.HemisphereLight(0xdcefff, 0xc98a5a, 1.15); S.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.2); S.add(this.ambient);
    const sun = this.sunLight = new THREE.DirectionalLight(0xfff0d0, 2.1);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 14, bottom: -10, near: 1, far: 80 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
    S.add(sun); S.add(sun.target);
    // cool fill from behind-left: gives every toon step a shape and a blue edge against the warm sun
    this.fill = new THREE.DirectionalLight(0x8fb4ff, 0.55); this.fill.position.set(-14, 9, -12); S.add(this.fill);
    this.motes = new Motes(TIERS.high.motes); S.add(this.motes.points);

    // world: strip, collectibles, props, both country sceneries, stadium
    S.add(buildStrip(sim));
    this.dyn = buildDynamic(sim); S.add(this.dyn.group);
    S.add(buildProps(sim));
    this.scenery = [
      buildWorldScenery(sim.halfTeam[0], -60, cp + 9, 0, o.match.id * 2),
      buildWorldScenery(sim.halfTeam[1], cp - 9, L.cols + 40, -0.9, o.match.id * 2 + 1),
    ];
    for (const s of this.scenery) S.add(s.group);
    this.addHalftimeDivider(cp);
    this.stadium = buildStadium(sim); S.add(this.stadium.group);

    // characters
    const kits = sim.kits;
    this.player = makeFootballer({ scale: 1.08, look: o.look, kit: kits.me, stripes: o.teams[o.playerSide].code === 'ARG' ? '#ffffff' : null });
    S.add(this.player.root);
    const defLook = i => ({ hairStyle: HAIR_STYLES[(i * 3 + 1) % HAIR_STYLES.length], hair: HAIRS[(i * 2 + 1) % HAIRS.length], skin: SKINS[(i * 2 + 3) % SKINS.length], boots: i % 2 ? '#1b1b1b' : '#f5f5f5' });
    this.pool = [0, 1, 2, 3, 4, 5].map(i => { const r = makeFootballer({ scale: 1.08, look: defLook(i), kit: kits.opp }); r.root.visible = false; S.add(r.root); return { rig: r, enemy: null }; });
    this.wall = F.kind === 'freekick' ? [0, 1, 2].map(i => { const r = makeFootballer({ scale: 1, look: defLook(i + 2), kit: kits.opp }); r.root.visible = false; S.add(r.root); return r; }) : [];
    this.keeper = makeFootballer({ scale: 1.05, look: { hairStyle: 'bun', hair: '#2a1a12', skin: SKINS[1], boots: '#111111' }, kit: kits.gk, gk: true });
    this.keeper.root.position.set(F.goalX - 0.75, 2, 0); S.add(this.keeper.root);
    this.ball = ballMesh(); this.ball.visible = false; S.add(this.ball);
    this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
    this.ballShadow.rotation.x = -Math.PI / 2; this.ballShadow.visible = false; S.add(this.ballShadow);
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 24), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.position.set(F.crossTargetX + 0.75, 2.02, 0); this.marker.visible = false; S.add(this.marker);
    // aiming helpers: reticle on the goal (penalty), arrow at the ball (free kick)
    this.reticle = new THREE.Group();
    const ringM = new THREE.MeshBasicMaterial({ color: 0xffd23f, depthTest: false, transparent: true });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 28), ringM); ring.renderOrder = 5; this.reticle.add(ring);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), ringM); dot.renderOrder = 5; this.reticle.add(dot);
    this.reticle.rotation.y = -Math.PI / 2; this.reticle.visible = false; this.reticleMat = ringM; S.add(this.reticle);
    this.arrow = new THREE.Group();
    const shaftM = toon(0xffd23f, { unique: true });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 8).rotateZ(-Math.PI / 2).translate(0.5, 0, 0), shaftM); this.arrow.add(shaft);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 10).rotateZ(-Math.PI / 2), shaftM); this.arrow.add(head);
    for (const m of [shaft, head]) { const ink = new THREE.Mesh(m.geometry.clone().scale(1.25, 1.25, 1.25), inkMaterial()); m.add(ink); }
    this.arrowShaft = shaft; this.arrowHead = head; this.arrowMat = shaftM; this.arrow.visible = false; S.add(this.arrow);

    this.particles = new Particles(); S.add(this.particles.points);
    this.camPos = new THREE.Vector3(X(sim.player.x) + 4, 5, 23); this.camLook = new THREE.Vector3(X(sim.player.x) + 4, 3.4, 0);
    this.setTier(this.tierName);
    this.camSnap = true;
    this.onResize = () => this.resize(); window.addEventListener('resize', this.onResize);
  }
  // half-time: a stone wall with both flags hides the seam between the two worlds
  addHalftimeDivider(cp) {
    const g = new THREE.Group();
    const stone = toon(0x9a958c);
    const wall = box(1.2, 1.6, 9, stone, { outline: 0.06 }); wall.position.set(cp, -1.4, -6.6); g.add(wall);
    for (let i = 0; i < 4; i++) { const c = box(1.3, 0.5, 0.9, toon(0xb5b0a6), { outline: 0.04 }); c.position.set(cp, -0.4, -3 - i * 2.4); g.add(c); }
    [0, 1].forEach(h => {
      const pole = cylinder(0.06, 0.06, 4.2, toon(0xd9d9d9), { outline: 0.02 }); pole.position.set(cp + (h ? 0.5 : -0.5), 1.5, -4.2 - h * 3); g.add(pole);
      const fl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.04), toon(0xffffff, { map: flagTexture(this.sim.halfTeam[h].code), unique: true }));
      fl.position.set(cp + (h ? 0.5 : -0.5) + (h ? 0.78 : -0.78), 3.1, -4.2 - h * 3); g.add(fl);
    });
    this.scene.add(g);
  }
  // quality tier: post-processing, shadow resolution, pixel ratio, floating motes
  setTier(name) {
    const T = TIERS[name]; this.tierName = name;
    if (T.post) { if (this.post) this.post.setTier(T); else this.post = new Post(this.renderer, T); }
    else { this.post?.dispose(); this.post = null; }
    const sh = this.sunLight.shadow; sh.mapSize.set(T.shadow, T.shadow); sh.map?.dispose(); sh.map = null;
    this.motes.points.visible = T.motes > 0; this.motes.points.geometry.setDrawRange(0, T.motes);
    FX.rimK.value = (typeof window !== 'undefined' && window.FXT?.rim) ?? (T.post ? 0.16 : 0.1);
    this.resize();
  }
  // one picture: through the post-processing pipeline, or straight to the screen on the low tier
  renderFrame() {
    if (!this.post) { this.renderer.render(this.scene, this.camera); return; }
    const sunNdc = this.sun.position.clone().applyMatrix4(this.camera.projectionMatrix);
    const seen = this.sun.visible && sunNdc.z < 1 && Math.abs(sunNdc.x) < 1.6 && Math.abs(sunNdc.y) < 1.6;
    const dusk = this.skyU.dusk.value;
    this.post.render(this.scene, this.camera, { time: this.t, dusk, exposure: 0.8 - dusk * 0.04, sunUv: seen ? new THREE.Vector2(sunNdc.x * 0.5 + 0.5, sunNdc.y * 0.5 + 0.5) : null, rays: seen ? 0.55 * (1 - dusk) : 0 });
  }
  resize() {
    const r = this.c.getBoundingClientRect();
    const w = Math.max(320, r.width), h = Math.max(180, r.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TIERS[this.tierName].pr));
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    if (this.post) { const b = this.renderer.getDrawingBufferSize(new THREE.Vector2()); this.post.setSize(b.x, b.y); }
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.view = { w, h, s: w / 384 };
  }

  // ------------------------------------------------------------------ events from the game core -> effects
  bindSim() {
    const sim = this.sim, P = this.particles, B = this.bursts;
    const at = (px, py) => [X(px), Y(py), 0.6];
    sim.on('jump', e => P.emit(...at(e.x, e.y), { count: 5, color: 0xe8d6b8, speed: 1.5, up: 0.4, g: 1, life: 0.45, size: 0.35 }));
    sim.on('land', e => { P.emit(...at(e.x, e.y), { count: Math.min(10, 3 + Math.round(e.v * 1.2)), color: 0xe8d6b8, speed: 1.8, up: 0.3, g: 0.8, life: 0.5, size: 0.4 }); this.player.squash = Math.min(0.28, 0.06 + e.v * 0.035); });
    sim.on('item', e => { P.emit(X(e.item.x * TILE), Y(e.item.y * TILE), 0.4, { count: 10, color: [0xffa62b, 0xffd27a, 0xffffff], speed: 3.2, g: 6, life: 0.55, size: 0.22 }); });
    sim.on('sticker', e => {
      P.emit(X(e.sticker.x * TILE), Y(e.sticker.y * TILE), 0.4, { count: 22, color: [0xffffff, 0xffd23f, e.team.kit.shirt], speed: 4, g: 3, life: 0.9, size: 0.26 });
      B.name(e.sticker.x * TILE, e.sticker.y * TILE, `#${e.person.no} ${e.person.short}!`, e.team.kit.shirt, 'big');
      if (e.complete) setTimeout(() => B.banner(`FULL SQUAD ${e.team.code}! +${SCORE.SQUAD_BONUS}`, e.team.kit.shirt, 1.6), 700);
    });
    sim.on('shield', e => { B.name(e.shield.x * TILE, e.shield.y * TILE, 'SHIN GUARD!', '#9fe3ff', 'tiny'); P.emit(X(e.shield.x * TILE), Y(e.shield.y * TILE), 0.4, { count: 12, color: 0x9fe3ff, speed: 3, g: 2 }); });
    sim.on('shieldUsed', e => B.name(e.x + 5, e.y, 'SAVED BY THE GUARD!', '#9fe3ff', 'tiny'));
    sim.on('dribble', e => B.name(e.enemy.x + 5, e.enemy.y, `NUTMEG ${e.enemy.person.short}!`, sim.kits.opp.shirt, 'small'));
    sim.on('spring', e => { B.name(e.x, e.y, 'BOING!', '#ffd23f', 'tiny'); P.emit(X(e.x), Y(e.y), 0.5, { count: 8, color: 0xffffff, speed: 2.5, g: 2 }); });
    sim.on('bonk', e => P.emit(e.tx + 0.5, ROWS - e.ty - 1, 0.6, { count: 6, color: 0x1e4fa3, speed: 2, g: 6 }));
    sim.on('death', e => { this.shake = 0.35; B.banner(e.reason === 'time' ? 'TIME UP!' : e.reason === 'pit' ? 'OUT OF PLAY!' : 'FOUL!', '#ff5252', 1.4); });
    sim.on('respawn', e => { this.snapCamera(); B.banner(e.checkpoint === 'kickoff' ? 'KICK-OFF AGAIN!' : e.checkpoint === 'halftime' ? 'BACK FROM HALF-TIME!' : 'BACK AT THE COOLING BREAK!', '#ffd23f', 1.2); });
    sim.on('checkpoint', e => { B.banner(e.kind === 'halftime' ? 'HALF-TIME!' : 'COOLING BREAK!', e.kind === 'halftime' ? sim.halfTeam[0].kit.shirt : '#3a86ff', e.kind === 'halftime' ? 1.6 : 1.0); P.emit(X(sim.player.x + 5), Y(sim.player.y), 0.5, { count: 18, color: [0x9fe3ff, 0xffffff], speed: 3, g: 1.5, life: 0.9 }); });
    sim.on('resume', e => { if (e.kind === 'halftime') B.banner(`2ND HALF – WELCOME TO ${sim.halfTeam[1].name.toUpperCase()}!`, sim.halfTeam[1].kit.shirt, 1.4); });
    sim.on('finale', e => { B.banner(FINALE_BANNER[e.kind] || 'HEADER TIME!', '#ffd23f', e.kind === 'header' ? 1.2 : 0.9); if (e.kind !== 'header') { this.ball.visible = this.ballShadow.visible = true; } });
    sim.on('shot', e => { this.slowmo = e.kind === 'penalty' ? 0.5 : 0.25; P.emit(X(e.x), Y(e.y) + 0.1, 0, { count: 8, color: [0xffffff, 0xd9f0c0], speed: 2.5, g: 4, life: 0.4, size: 0.12 }); this.shake = 0.12; });
    sim.on('cross', () => { this.ball.visible = this.ballShadow.visible = true; });
    sim.on('header', e => { B.meter(e.x, e.y, e.power); this.slowmo = 0.9; P.emit(X(e.x), Y(e.y), 0.5, { count: 16, color: 0xffffff, speed: 4, g: 1 }); });
    sim.on('goal', e => {
      B.banner(e.text && e.text !== 'GOAL!' ? `GOAL! ${e.text}` : 'GOAL!!!', '#ffd23f', 2.6, true); this.stadium.excite.v = 1; this.shake = 0.3;
      const gx = sim.L.finale.goalX; for (let i = 0; i < 6; i++) setTimeout(() => this.particles.emit(gx + 1.5, 6, -1, { count: 26, color: [sim.kits.me.shirt, 0xffd23f, 0xffffff], speed: 6, g: 3, life: 2, size: 0.16, spreadZ: 3, drag: 0.97 }), i * 180);
    });
    sim.on('miss', e => B.banner(e.text, '#ff5252', 2.2));
    sim.on('pause', e => this.o.onPause?.(e.paused));
    sim.on('lifelost', e => this.o.onLifeLost?.(e));
    sim.on('gameover', e => this.o.onGameOver?.(e));
    sim.on('finish', r => this.o.onFinish?.(r));
  }

  // ------------------------------------------------------------------ input + loop
  start() {
    this.onKey = e => {
      const k = KEYMAP[e.code]; if (!k) return;
      e.preventDefault();
      if (e.type === 'keydown') { if (!this.sim.keys[k]) this.sim.pressed[k] = true; this.sim.keys[k] = true; } else this.sim.keys[k] = false;
    };
    window.addEventListener('keydown', this.onKey); window.addEventListener('keyup', this.onKey);
    this.onBlur = () => { this.sim.keys = {}; if (this.sim.state === 'play' && !this.sim.paused) { this.sim.paused = true; this.o.onPause?.(true); } };
    window.addEventListener('blur', this.onBlur);
    this.running = true;
    let last = performance.now(), acc = 0;
    const tick = now => {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      this.pollGamepad();
      this.timeScale = this.slowmo > 0 ? 0.35 : 1; this.slowmo = Math.max(0, this.slowmo - dt);
      acc += dt * this.timeScale;
      while (acc >= FIXED) { this.sim.step(); acc -= FIXED; }
      this.frame(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    this.bursts.banner('KICK-OFF!', this.sim.halfTeam[0].kit.shirt, 1.2);
  }
  stop() {
    this.running = false; cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.onBlur); window.removeEventListener('resize', this.onResize);
    this.bursts.clear();
    this.scene.traverse(o => {
      o.geometry?.dispose?.();
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) { m.map?.dispose?.(); m.dispose?.(); }
    });
    this.post?.dispose(); this.motes.dispose(); this.renderer.setPixelRatio(this.prevPR);
    if (this.ownRenderer) { this.renderer.dispose(); this.renderer.forceContextLoss?.(); }
    this.c.innerHTML = '';
  }
  resume() { this.sim.paused = false; }
  pollGamepad() {
    const gp = navigator.getGamepads?.()[0]; if (!gp) return;
    const s = this.sim, prev = this.gp ||= {};
    const set = (k, v) => { if (v && !prev[k]) s.pressed[k] = true; if (v || prev[k]) s.keys[k] = !!v; prev[k] = !!v; };
    const ax = gp.axes[0] || 0;
    set('left', ax < -0.4 || gp.buttons[14]?.pressed); set('right', ax > 0.4 || gp.buttons[15]?.pressed);
    set('jump', gp.buttons[0]?.pressed); set('run', gp.buttons[2]?.pressed || gp.buttons[1]?.pressed); set('pause', gp.buttons[9]?.pressed);
  }

  snapCamera() { this.camSnap = true; }
  updateCamera(dt) {
    const sim = this.sim, p = sim.player, L = sim.L, F = L.finale, f = sim.finale;
    const px = X(p.x + 5), py = Y(p.y + 24);
    const gy = ROWS - L.groundTop[Math.max(0, Math.min(L.cols - 1, Math.floor(p.x / TILE)))];
    const base = gy < ROWS ? Math.min(gy, py) : py;
    let lookY = Math.max(base + 2.6, py - 1.5), tx = px + 2.4 * (p.facing >= 0 ? 1 : -0.4) + p.vx * 0.8, ty = lookY + 1.6, tz = 17.5 + Math.abs(p.vx) * 0.5;
    let lookX = null, lookZ = 0, speed = 3.2;
    tx = Math.max(10, tx);
    if (f && f.kind === 'header') {
      tx = F.crossTargetX + 4.5; ty = 5.4; tz = 16; lookY = 4.2;
      if (f.ballFlying || sim.state === 'result') { const bx = f.ball ? X(f.ball.x) : tx; tx = Math.min(F.goalX - 1.5, Math.max(tx, bx)); tz = 11.5; ty = 4; lookY = 3.3; }
      if (sim.state === 'result' && f.goal) { const a = sim.stateT * 0.45; tx = F.goalX - 2.5 + Math.sin(a) * 3.5; tz = 10 + Math.cos(a) * 2; ty = 4.2; lookY = 3.4; }
    } else if (f && f.kind === 'freekick') {
      tx = X(f.spotX) + 6.4; ty = 5.0; tz = 19; lookY = 3.0; speed = 2.4;
      if (f.phase === 'flight' || sim.state === 'result') { tx = Math.min(F.goalX - 2, Math.max(tx, X(f.ball.x) + 1)); }
      if (sim.state === 'result' && f.goal) { const a = sim.stateT * 0.45; tx = F.goalX - 2.5 + Math.sin(a) * 3.5; tz = 10 + Math.cos(a) * 2; ty = 4.2; lookY = 3.4; }
    } else if (f && f.kind === 'penalty') {
      const spot = X(f.spotX);
      speed = f.phase === 'setup' ? 1.8 : 3;
      tx = spot - 7.2; ty = 3.55; tz = -1.1; lookX = F.goalX; lookY = 2.25; lookZ = 0.3;
    }
    if (sim.half === 1 && !f) tx = Math.max(tx, L.checkpointCol + 8);
    const k = this.camSnap ? 1 : Math.min(1, dt * speed);
    this.camSnap = false;
    this.camPos.lerp(new THREE.Vector3(tx, ty, tz), k);
    this.camLook.lerp(new THREE.Vector3(lookX ?? tx, lookY, lookZ), k);
    const sh = this.shake > 0 ? this.shake * 0.25 : 0; this.shake = Math.max(0, this.shake - dt);
    this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * sh, this.camPos.y + (Math.random() - 0.5) * sh, this.camPos.z);
    this.camera.lookAt(this.camLook);
    const fov = 32 + (f ? 0 : Math.min(3, Math.abs(p.vx) * 0.9)); this.fov = lerp(this.fov ?? 32, fov, Math.min(1, dt * 3));
    if (Math.abs(this.camera.fov - this.fov) > 0.01) { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }
    this.sunLight.position.set(this.camLook.x - 9, 22, 16); this.sunLight.target.position.set(this.camLook.x + 2, 2, 0); this.sunLight.target.updateMatrixWorld();
    // the two worlds blend at half-time, dusk + floodlights when the stadium comes into view
    const W = this.worlds, b = clamp01((this.camLook.x - (L.checkpointCol - 10)) / 20);
    const dusk = clamp01((this.camLook.x - (F.start - 26)) / 18);
    this.skyU.dusk.value = dusk;
    this.skyU.top.value.set(W[0].sky[0]).lerp(new THREE.Color(W[1].sky[0]), b);
    this.skyU.bottom.value.set(W[0].sky[1]).lerp(new THREE.Color(W[1].sky[1]), b);
    this.scene.fog.color.set(W[0].fog).lerp(new THREE.Color(W[1].fog), b).lerp(new THREE.Color(0x3a3150), dusk * 0.65);
    const lk = this.post ? 0.88 : 1; // the HDR pipeline does not clip, so the lights can be a bit lower
    this.sunLight.intensity = (2.1 - dusk * 0.9) * lk; this.sunLight.color.setRGB(1, 0.94 - dusk * 0.1, 0.82 + dusk * 0.12);
    this.hemi.intensity = (1.15 + dusk * 0.25) * lk; this.ambient.intensity = 0.2 + dusk * 0.45;
    this.sun.visible = dusk < 0.9 && !(f && f.kind === 'penalty');
  }

  // ------------------------------------------------------------------ the finales (positions from the game core)
  drawFinale(dt) {
    const sim = this.sim, f = sim.finale, F = sim.L.finale, K = this.keeper, GW = GOAL_HALF_W;
    this.reticle.visible = false; this.arrow.visible = false; this.meterEl.hidden = true;
    for (const w of this.wall) w.root.visible = false;
    if (!f) { animate(K, { speed: 0, ground: true, facing: -1, mode: 'idle' }, dt); this.ball.visible = this.ballShadow.visible = this.marker.visible = false; return; }
    const gx = F.goalX;
    if (f.kind === 'header') {
      K.root.position.set(X(f.keeperX + 5), 2, 0);
      animate(K, { speed: 0, ground: true, facing: -1, mode: f.keeperPose === 'dive' ? 'dive' : 'idle' }, dt);
      if (f.ball) this.placeBall(X(f.ball.x), Y(f.ball.y), 0, f.ballFlying && !f.done, f.ball.vx, dt);
      this.marker.visible = !!f.ball && !f.hit && !f.done; this.marker.scale.setScalar(1 + Math.sin(this.t * 8) * 0.12);
      return;
    }
    this.marker.visible = false;
    if (f.kind === 'freekick') {
      // the wall
      this.wall.forEach((w, i) => {
        w.root.visible = true;
        const jump = (f.wallJump || 0) * 0.32;
        w.root.position.set(X(f.wallX) + (i - 1) * 0.05, 2 + jump, (i - 1) * 0.72);
        animate(w, { speed: 0, ground: jump < 0.02, vy: jump > 0.02 ? -2 : 0, mode: jump > 0.02 ? 'air' : 'idle', yaw: Math.PI, snapYaw: true }, dt);
      });
      const out = f.shot?.path.out, decided = f.done;
      K.root.position.set(gx - 0.7, 2 + (decided && out && (out.at === 'keeper' || out.at === 'goal') ? 0.25 : 0), 0);
      animate(K, { speed: 0, ground: true, mode: decided && out && (out.at === 'keeper' || out.at === 'goal') ? 'dive' : 'idle', yaw: Math.PI, snapYaw: true }, dt);
      this.placeBall(X(f.ball.x), Y(f.ball.y), 0, f.phase === 'flight' && !f.done, 3, dt);
      if (f.phase === 'angle' || f.phase === 'power') {
        const ang = (f.phase === 'angle' ? fkAngle(f.meter) : f.angle) * Math.PI / 180;
        const len = f.phase === 'power' ? 1.2 + f.meter * 2.2 : 2.2;
        this.arrow.visible = true; this.arrow.position.set(X(f.ball.x), Y(f.ball.y), 0.6); this.arrow.rotation.z = ang;
        this.arrowShaft.scale.x = len; this.arrowHead.position.x = len + 0.18;
        this.arrowMat.color.setHex(f.phase === 'power' ? new THREE.Color(0xffd23f).lerp(new THREE.Color(0xff3b3b), f.meter).getHex() : 0xffd23f);
        this.showMeter(f.phase === 'angle' ? 'ANGLE' : 'POWER', f.meter, null);
      }
      return;
    }
    // penalty
    const spot = X(f.spotX);
    const o = f.shot?.out;
    let kz = 0, ky = 2, kmode = 'idle', kyaw = Math.PI;
    if (o) {
      const d = ease(f.shot.t / 0.42);
      if (o.keeper) { kz = o.keeper * 0.62 * GW * d; kyaw = o.keeper > 0 ? -Math.PI / 2 : Math.PI / 2; kmode = 'dive'; ky = 2 + Math.sin(Math.min(1, f.shot.t / 0.5) * Math.PI) * 0.45; }
      else { kmode = 'air'; ky = 2 + Math.sin(Math.min(1, f.shot.t / 0.5) * Math.PI) * 0.5; }
    } else if (f.phase === 'aim' || f.phase === 'power') { kz = Math.sin(this.t * 2.2) * 0.25; }
    K.root.position.set(gx - 0.45, ky, kz);
    animate(K, { speed: o ? 0 : 0.15, ground: !o, vy: -3, mode: kmode, yaw: kyaw, snapYaw: !!o }, dt);
    // ball
    if (!o) this.placeBall(spot, 2.12, 0, false, 0, dt);
    else {
      const T = 0.5, t = f.shot.t, k = Math.min(1, t / T);
      const tz = o.aim * GW * 0.92, ty = 2.12 + Math.min(o.height, 1.3) * 2.72;
      const tx = gx + 0.25;
      let bx = lerp(spot, tx, k), by = lerp(2.12, ty, k) + Math.sin(k * Math.PI) * 0.35, bz = lerp(0, tz, k);
      if (o.at === 'keeper' && k > 0.82) { const k2 = Math.min(1, (t - T * 0.82) / 0.6); bx = lerp(spot, tx, 0.82) - k2 * 2.5; by = Math.max(2.12, lerp(2.12, ty, 0.82) + 0.6 * Math.sin(k2 * Math.PI) - k2 * 1.2); bz = lerp(0, tz, 0.82) * (1 - k2 * 0.5); }
      else if (o.at === 'post' && k >= 1) { const k2 = Math.min(1, (t - T) / 0.6); bx = tx - k2 * 3; bz = tz * (1 - k2 * 0.3); by = Math.max(2.12, ty - k2 * 1.5); }
      else if (o.at === 'over' && k >= 1) { const k2 = (t - T); bx = tx + k2 * 10; by = ty + k2 * 3; bz = tz * (1 + k2 * 0.3); }
      else if (o.at === 'goal' && k >= 1) { const k2 = Math.min(1, (t - T) / 0.25); bx = tx + k2 * 1.2; by = Math.max(2.12, ty - k2 * 0.3 - Math.max(0, (t - T - 0.3)) * 3); }
      this.placeBall(bx, by, bz, k < 1, 6, dt);
    }
    if (f.phase === 'aim' || f.phase === 'power') {
      this.reticle.visible = true;
      const aim = f.phase === 'aim' ? f.meter * 2 - 1 : f.aim;
      const hgt = f.phase === 'power' ? 0.12 + f.meter * 1.0 : 0.5;
      this.reticle.position.set(gx - 0.1, 2.12 + Math.min(hgt, 1.25) * 2.72, aim * GW * 0.92);
      this.reticle.scale.setScalar(1 + Math.sin(this.t * 10) * 0.08);
      this.reticleMat.color.setHex(hgt > 1 ? 0xff3b3b : Math.abs(aim) > 0.95 ? 0xff9f1c : 0xffd23f);
      this.showMeter(f.phase === 'aim' ? 'AIM' : 'POWER', f.meter, f.phase === 'power' ? 0.88 : null);
    }
  }
  placeBall(x, y, z, flying, spin, dt) {
    this.ball.visible = this.ballShadow.visible = true;
    this.ball.position.set(x, y, z); this.ball.rotation.z -= spin * dt * 6; if (flying) this.ball.rotation.x += dt * 3;
    this.ballShadow.position.set(x, 2.015, z); const hgt = Math.max(0, y - 2); this.ballShadow.scale.setScalar(Math.max(0.4, 1.4 - hgt * 0.12)); this.ballShadow.material.opacity = Math.max(0.08, 0.35 - hgt * 0.03);
    if (flying && Math.random() < 0.6) this.particles.emit(x, y, z, { count: 1, color: 0xffffff, speed: 0.2, g: 0, life: 0.35, size: 0.3 });
  }
  showMeter(label, v, redFrom) {
    const el = this.meterEl; el.hidden = false;
    const key = label + (redFrom ?? '');
    if (el.dataset.key !== key) { el.dataset.key = key; el.innerHTML = `<b>${label}</b><div class="bar">${redFrom != null ? `<span class="red" style="left:${redFrom * 100}%"></span>` : ''}<i></i></div><kbd>SPACE</kbd>`; this.meterNeedle = el.querySelector('i'); }
    this.meterNeedle.style.left = `${clamp01(v) * 100}%`;
  }

  frame(dt) {
    this.t += dt;
    const sim = this.sim, p = sim.player, t = this.t, D = this.dyn;
    // player
    const pr = this.player, fin = sim.finale;
    let pz = 0;
    if (fin?.kind === 'penalty') pz = 0.3 + 1.0 * clamp01((fin.spotX - 8 - p.x) / 22);
    pr.root.position.set(X(p.x + 5), Y(p.y + 24), pz);
    let mode = null;
    if (sim.state === 'dying' || sim.state === 'gameover') mode = 'hurt';
    else if (p.pose === 'header') mode = 'header';
    else if (p.pose === 'cheer') mode = 'cheer';
    else if (p.pose === 'kick') mode = 'kick';
    const pen = sim.finale?.kind === 'penalty';
    animate(pr, { speed: Math.min(1, Math.abs(p.vx) / 2.6), ground: p.onGround, vy: p.vy, facing: p.facing, mode, yaw: pen ? 0.25 : undefined }, dt);
    pr.root.visible = !(p.invuln > 0 && Math.floor(t * 14) % 2 === 0);
    // defenders: assign pooled rigs to the nearest active defenders
    const near = sim.finale ? [] : sim.enemies.filter(e => !e.dead && Math.abs(X(e.x) - this.camLook.x) < 17).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x)).slice(0, this.pool.length);
    for (const slot of this.pool) if (slot.enemy && !near.includes(slot.enemy)) slot.enemy = null;
    for (const e of near) if (!this.pool.some(s => s.enemy === e)) { const free = this.pool.find(s => !s.enemy); if (free) free.enemy = e; }
    for (const slot of this.pool) {
      const e = slot.enemy, r = slot.rig;
      r.root.visible = !!e;
      if (!e) continue;
      r.root.position.set(X(e.x + 5), Y(e.y + 24), 0);
      animate(r, { speed: Math.min(1, Math.abs(e.vx) / 1.4), ground: e.onGround, vy: e.vy, facing: e.vx >= 0 ? 1 : -1 }, dt);
    }
    this.drawFinale(dt);
    // collectibles
    for (const it of D.items) { it.g.visible = !it.it.got; if (it.g.visible) { it.g.position.y = it.base + Math.sin(t * 2.5 + it.ph) * 0.12; it.g.rotation.y = t * 1.5 + it.ph; } }
    for (const s of D.stickers) { s.g.visible = !s.s.got; if (s.g.visible) { s.g.position.y = s.base + Math.sin(t * 2 + s.ph) * 0.14; s.card.rotation.y = Math.sin(t * 1.3 + s.ph) * 0.8; } }
    for (const s of D.shields) { s.g.visible = !s.s.got; if (s.g.visible) { s.g.position.y = s.base + Math.sin(t * 2.2 + s.ph) * 0.12; s.g.rotation.y = t * 1.2; } }
    for (const s of D.springs) s.mat.position.y = 0.32 - s.s.squash * 0.16;
    for (const m of D.movers) m.p.position.set(X(m.m.px) + m.m.w / 2, ROWS - m.m.y - 0.16, 0);
    // scenery animation (only the world in view)
    const cpx = sim.L.checkpointCol, cx = this.camLook.x;
    if (cx < cpx + 40) for (const fn of this.scenery[0].anim) fn(dt, t);
    if (cx > cpx - 40) for (const fn of this.scenery[1].anim) fn(dt, t);
    if (Math.abs(cx - sim.L.finale.start) < 60) for (const fn of this.stadium.anim) fn(dt, t);
    if (Math.abs(p.vx) > 2.4 && p.onGround && Math.random() < 0.35) this.particles.emit(X(p.x) - 0.3, Y(p.y + 12) + Math.random() * 0.8, 0.3, { count: 1, color: 0xffffff, speed: 0.1, vx: -6, g: 0, life: 0.25, size: 0.16 });
    this.particles.update(dt);
    this.updateCamera(dt);
    FX.time.value = t % 1000; this.motes.update(t, this.camLook, this.skyU.dusk.value);
    this.renderFrame();
    this.gov?.tick(dt);
    this.bursts.render(0, this.view, (wx, wy) => this.project(wx, wy));
    this.updateHud();
  }
  // test helper: run the game core for n seconds and draw one frame
  advance(sec) { const n = Math.round(sec / FIXED); for (let i = 0; i < n; i++) this.sim.step(); this.frame(sec); }
  project(wx, wy) {
    const v = new THREE.Vector3(X(wx), Y(wy), 0).project(this.camera);
    return { x: (v.x + 1) / 2 * this.view.w, y: (1 - v.y) / 2 * this.view.h };
  }
  updateHud() {
    const s = this.sim, h = s.half, item = this.worlds[h].item;
    const key = [s.lives, s.score, s.matchMinute, h, s.count.items[h], s.count.stickers[h], s.player.shield, s.clock < 15 && Math.floor(this.t * 2) % 2].join('|');
    if (key === this.hudKey) return; this.hudKey = key;
    this.hud.innerHTML = `
      <div class="h-left"><span class="h-hearts">${[0, 1, 2].map(i => ICON_HEART(i < s.lives)).join('')}</span><span class="h-score">${String(s.score).padStart(5, '0')}</span></div>
      <div class="h-clock ${s.clock < 15 ? 'warn' : ''}"><b>${s.matchMinute}'</b><span>${h ? '2ND HALF' : '1ST HALF'}</span></div>
      <div class="h-right"><span>${itemIcon(item)}<b>${s.count.items[h]}</b></span><span>${ICON_CARD(s.halfTeam[h].kit.shirt)}<b>${s.count.stickers[h]}/${s.L.counts.stickers[h]}</b></span>${s.player.shield ? `<span>${ICON_SHIELD}</span>` : ''}</div>`;
  }
  // first frame for the intro transition
  startFrame() {
    this.updateCamera(1);
    animate(this.player, { speed: 0, ground: true, facing: 1 }, 0.016);
    this.renderFrame();
    const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
    c.getContext('2d').drawImage(this.renderer.domElement, 0, 0, 1280, 720);
    return c;
  }
}
