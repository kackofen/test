// Bonus level "The Goal Wall" (Torwandschießen): 6 shots at a wall with two holes,
// 3 at the lower hole, 3 at the upper hole. Aim left/right, then height – SPACE locks.
/* global THREE */
import { toon, box, cylinder, sphere, canvasTexture, inkMaterial, glowSprite } from './toon.js';
import { makeFootballer, animate } from './rig.js';
import { ballMesh } from './world.js';
import { Bursts } from '../game/bursts.js';
import { tri } from '../shared/finale.js';

const WALL_W = 4.4, WALL_H = 3.0, HOLE_R = 0.42, CATCH = 0.36;
const HOLES = [{ x: -1.3, y: 0.75 }, { x: 1.3, y: 2.25 }];
const SPOT = { x: 0, z: 8.6 };
export const GOALWALL = { SHOTS: 6, HIT: 250, ALL: 500 };

export class GoalWall {
  // o: { renderer, look, kit, onFinish({hits, score, shots}), onQuit() }
  constructor(container, o) {
    this.c = container; this.o = o; this.t = 0;
    this.shots = []; this.phase = 'intro'; this.pt = 0; this.meter = 0;
    this.build();
  }
  build() {
    const S = this.scene = new THREE.Scene();
    S.background = new THREE.Color(0x101634);
    S.fog = new THREE.Fog(0x101634, 30, 70);
    this.camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.3, 200);
    S.add(new THREE.HemisphereLight(0xc9d8ff, 0x23304a, 0.9), new THREE.AmbientLight(0xffffff, 0.35));
    const spot = new THREE.DirectionalLight(0xfff4dc, 1.8); spot.position.set(-6, 14, 12); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024);
    Object.assign(spot.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 50 }); S.add(spot, spot.target);
    // studio floor: pitch with stripes and a big circle
    const turf = canvasTexture(256, 256, (c, w) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#3f9d47' : '#4bb054'; c.fillRect(0, i * 32, w, 32); } c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 4; c.beginPath(); c.arc(128, 128, 70, 0, 7); c.stroke(); });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), toon(0xffffff, { map: turf, unique: true })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; S.add(floor);
    // backdrop: studio wall with the show title and light bulbs
    const back = canvasTexture(1024, 256, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1b2a6b'); g.addColorStop(1, '#0d1440'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,0.06)'; for (let x = 0; x < w; x += 64) c.fillRect(x, 0, 2, h);
      c.font = '92px "Bangers", Impact, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffd23f'; c.lineWidth = 10; c.strokeStyle = '#1a1222'; c.strokeText('THE GOAL WALL', w / 2, 130); c.fillText('THE GOAL WALL', w / 2, 130);
      c.font = '30px "Press Start 2P", monospace'; c.fillStyle = '#9fe3ff'; c.fillText('TORWANDSCHIESSEN', w / 2, 200);
    });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 6.5), new THREE.MeshBasicMaterial({ map: back })); wall.position.set(0, 5.6, -6); S.add(wall);
    this.bulbs = [];
    for (let i = 0; i < 26; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a8 })); b.position.set(-12.5 + i, 9.6, -5.9); S.add(b); this.bulbs.push(b); }
    // audience silhouettes left and right
    const fanGeo = new THREE.CapsuleGeometry(0.22, 0.4, 2, 6), fans = [];
    for (const side of [-1, 1]) for (let r = 0; r < 3; r++) for (let k = 0; k < 9; k++) fans.push([side * (7 + k * 0.6 + r * 0.3), 0.6 + r * 0.7, -2 + r * 0.8 - k * 0.15]);
    const fm = new THREE.InstancedMesh(fanGeo, toon(0x2a3360), fans.length); const o3 = new THREE.Object3D();
    fans.forEach(([x, y, z], i) => { o3.position.set(x, y, z); o3.updateMatrix(); fm.setMatrixAt(i, o3.matrix); }); S.add(fm); this.fans = { mesh: fm, list: fans };
    // the goal wall: green board with two holes, on two feet
    const shape = new THREE.Shape(); shape.moveTo(-WALL_W / 2, 0); shape.lineTo(WALL_W / 2, 0); shape.lineTo(WALL_W / 2, WALL_H); shape.lineTo(-WALL_W / 2, WALL_H); shape.lineTo(-WALL_W / 2, 0);
    for (const h of HOLES) { const p = new THREE.Path(); p.absarc(h.x, h.y, HOLE_R, 0, Math.PI * 2, true); shape.holes.push(p); }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false, curveSegments: 24 }); geo.translate(0, 0.25, -0.09);
    const board = new THREE.Mesh(geo, toon(0x1f7a3a)); board.castShadow = true; S.add(board);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(WALL_W + 0.3, WALL_H + 0.3, 0.12), inkMaterial()); frame.position.set(0, 0.25 + WALL_H / 2, -0.14); S.add(frame);
    for (const h of HOLES) { const ring = new THREE.Mesh(new THREE.TorusGeometry(HOLE_R, 0.05, 8, 28), toon(0xffffff)); ring.position.set(h.x, 0.25 + h.y, 0.1); S.add(ring); }
    for (const dx of [-1.6, 1.6]) { const f = box(0.25, 0.25, 1.4, toon(0x6b6f7a), { outline: 0.04 }); f.position.set(dx, 0.12, -0.3); S.add(f); }
    const net = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, WALL_H + 0.25), new THREE.MeshBasicMaterial({ color: 0x0a0f22 })); net.position.set(0, (WALL_H + 0.25) / 2, -1.6); S.add(net);
    this.holeGlow = HOLES.map(h => { const g = glowSprite(0xffd23f, 1.6, 0.0); g.position.set(h.x, 0.25 + h.y, 0.15); S.add(g); return g; });
    // shooter and ball
    this.hero = makeFootballer({ scale: 1, look: this.o.look, kit: this.o.kit || this.o.look.kit });
    this.hero.root.position.set(SPOT.x + 0.7, 0, SPOT.z + 1.4); S.add(this.hero.root);
    this.ball = ballMesh(); this.ball.position.set(SPOT.x, 0.24, SPOT.z); S.add(this.ball);
    // aim reticle on the wall
    const ringM = new THREE.MeshBasicMaterial({ color: 0xffd23f, depthTest: false, transparent: true });
    this.reticle = new THREE.Group(); const rr = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 24), ringM); rr.renderOrder = 5; this.reticle.add(rr); const rd = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), ringM); rd.renderOrder = 5; this.reticle.add(rd);
    this.reticle.position.z = 0.2; this.reticle.visible = false; this.reticleMat = ringM; S.add(this.reticle);
    this.camera.position.set(-2.3, 3.5, 18.5); this.camera.lookAt(0.2, 1.7, 0);
    // DOM
    this.fx = document.createElement('canvas'); this.fx.className = 'g3d-fx'; this.c.appendChild(this.fx); this.bursts = new Bursts(this.fx);
    this.hud = document.createElement('div'); this.hud.className = 'gw-hud'; this.c.appendChild(this.hud);
    this.meterEl = document.createElement('div'); this.meterEl.className = 'g3d-meter'; this.meterEl.hidden = true; this.c.appendChild(this.meterEl);
  }
  get target() { return HOLES[this.shots.length < 3 ? 0 : 1]; }
  start() {
    const R = this.o.renderer; this.c.prepend(R.domElement); R.domElement.className = 'g3d-canvas';
    this.onKey = e => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') { e.preventDefault(); if (!e.repeat) this.press = true; }
      if (e.code === 'Escape') { e.preventDefault(); this.o.onQuit?.(); }
    };
    window.addEventListener('keydown', this.onKey);
    this.onResize = () => this.resize(); window.addEventListener('resize', this.onResize); this.resize();
    this.running = true; let last = performance.now();
    const tick = now => { if (!this.running) return; const dt = Math.min(0.1, (now - last) / 1000); last = now; this.frame(dt); this.raf = requestAnimationFrame(tick); };
    this.raf = requestAnimationFrame(tick);
    this.bursts.banner('THE GOAL WALL!', '#ffd23f', 1.4);
  }
  stop() {
    this.running = false; cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey); window.removeEventListener('resize', this.onResize);
    this.bursts.clear(); this.c.innerHTML = '';
    this.scene.traverse(o => { o.geometry?.dispose?.(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) { m.map?.dispose?.(); m.dispose?.(); } });
  }
  resize() {
    const r = this.c.getBoundingClientRect(), w = Math.max(320, r.width), h = Math.max(180, r.height);
    this.o.renderer.setSize(w, h, false); this.o.renderer.domElement.style.width = '100%'; this.o.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.view = { w, h, s: w / 384 };
  }
  // one fixed step of the mini game
  step(dt) {
    this.pt += dt;
    const press = this.press; this.press = false;
    if (this.phase === 'intro') { if (this.pt > 1.4) { this.phase = 'aimx'; this.pt = 0; } }
    else if (this.phase === 'aimx') { this.meter = tri(this.pt * 0.55); if (press || this.pt > 8) { this.ax = (this.meter * 2 - 1) * (WALL_W / 2 - 0.2); this.phase = 'aimy'; this.pt = 0; } }
    else if (this.phase === 'aimy') { this.meter = tri(this.pt * 0.6); if (press || this.pt > 8) { this.ay = 0.15 + this.meter * (WALL_H + 0.3); this.phase = 'runup'; this.pt = 0; } }
    else if (this.phase === 'runup') { if (this.pt > 0.35) { this.phase = 'flight'; this.pt = 0; const tg = this.target; const d = Math.hypot(this.ax - tg.x, this.ay - tg.y); this.result = d < CATCH ? 'hit' : (this.ay > WALL_H + 0.05 || Math.abs(this.ax) > WALL_W / 2) ? 'over' : 'wall'; } }
    else if (this.phase === 'flight') {
      if (this.pt > 0.5 && !this.judged) {
        this.judged = true; const hit = this.result === 'hit';
        this.shots.push(hit);
        const P = this.project(this.ax, this.ay + 0.25, 0);
        if (hit) { this.bursts.name(this.ax, this.ay + 0.25, ['IN!', 'BULLSEYE!', 'PERFECT!'][this.shots.filter(Boolean).length % 3], '#ffd23f', 'big'); this.holeFlash = 1; }
        else this.bursts.name(this.ax, Math.min(this.ay, WALL_H) + 0.25, this.result === 'over' ? 'OVER!' : 'CLONK!', '#ff5252', 'small');
        this.lastP = P;
      }
      if (this.pt > 1.3) {
        this.judged = false;
        if (this.shots.length >= GOALWALL.SHOTS) { this.phase = 'done'; this.pt = 0; const hits = this.shots.filter(Boolean).length; if (hits === 6) this.bursts.banner('GOAL WALL QUEEN!', '#ffd23f', 2.4, true); }
        else { this.phase = 'aimx'; this.pt = 0; if (this.shots.length === 3) this.bursts.banner('NOW THE TOP HOLE!', '#9fe3ff', 1.3); }
      }
    } else if (this.phase === 'done') {
      if (this.pt > 2.4 && !this.finished) { this.finished = true; const hits = this.shots.filter(Boolean).length; this.o.onFinish?.({ hits, shots: this.shots.slice(), score: hits * GOALWALL.HIT + (hits === 6 ? GOALWALL.ALL : 0) }); }
    }
  }
  frame(dt) {
    this.t += dt;
    this.step(dt);
    const H = this.hero, ph = this.phase;
    // shooter: stands beside the ball, runs in, kicks
    let mode = 'idle', hx = SPOT.x + 0.7, hz = SPOT.z + 1.4;
    if (ph === 'runup') { const k = this.pt / 0.35; hx = SPOT.x + 0.7 - 0.45 * k; hz = SPOT.z + 1.4 - 1.0 * k; mode = 'run'; }
    if (ph === 'flight' && this.pt < 0.4) { hx = SPOT.x + 0.25; hz = SPOT.z + 0.4; mode = 'kick'; }
    if (ph === 'done' && this.shots.filter(Boolean).length >= 4) mode = 'cheer';
    H.root.position.set(hx, 0, hz);
    animate(H, { speed: mode === 'run' ? 0.8 : 0, ground: true, mode, yaw: Math.PI / 2 + 0.25, snapYaw: true }, dt);
    // ball
    if (ph === 'flight') {
      const k = Math.min(1, this.pt / 0.5), tx = this.ax, ty = this.ay + 0.25;
      if (k < 1) this.ball.position.set(SPOT.x + (tx - SPOT.x) * k, 0.24 + (ty - 0.24) * k + Math.sin(k * Math.PI) * 0.5, SPOT.z * (1 - k) + 0.1 * k);
      else if (this.result === 'hit') { const k2 = Math.min(1, (this.pt - 0.5) / 0.4); this.ball.position.set(tx, ty - k2 * 0.4, 0.1 - k2 * 1.6); }
      else if (this.result === 'over') { const k2 = this.pt - 0.5; this.ball.position.set(tx, ty + k2 * 2, -k2 * 8); }
      else { const k2 = Math.min(1, (this.pt - 0.5) / 0.8); this.ball.position.set(tx + k2 * 0.6, Math.max(0.24, ty + Math.sin(k2 * Math.PI) * 0.6 - k2 * ty), 0.3 + k2 * 4); }
      this.ball.rotation.x -= dt * 12;
    } else if (ph !== 'done') this.ball.position.set(SPOT.x, 0.24, SPOT.z);
    // reticle + meter
    const aiming = ph === 'aimx' || ph === 'aimy';
    this.reticle.visible = aiming;
    if (aiming) {
      const x = ph === 'aimx' ? (this.meter * 2 - 1) * (WALL_W / 2 - 0.2) : this.ax;
      const y = ph === 'aimx' ? this.target.y : 0.15 + this.meter * (WALL_H + 0.3);
      this.reticle.position.set(x, y + 0.25, 0.2); this.reticle.scale.setScalar(1 + Math.sin(this.t * 10) * 0.08);
      const tg = this.target; this.reticleMat.color.setHex(Math.hypot(x - tg.x, ph === 'aimx' ? 0 : y - tg.y) < CATCH ? 0x2fbf71 : 0xffd23f);
      this.showMeter(ph === 'aimx' ? 'LEFT / RIGHT' : 'HEIGHT', this.meter);
    } else this.meterEl.hidden = true;
    // hole glow on the target hole, flash on a hit
    this.holeFlash = Math.max(0, (this.holeFlash || 0) - dt * 1.5);
    this.holeGlow.forEach((g, i) => { g.material.opacity = (HOLES[i] === this.target && ph !== 'done' ? 0.35 + Math.sin(this.t * 4) * 0.15 : 0) + (HOLES[i] === this.target ? this.holeFlash : 0); });
    this.bulbs.forEach((b, i) => b.material.color.setHex((Math.floor(this.t * 6) + i) % 3 === 0 ? 0xffffff : 0xffc94a));
    // fans bounce on hits
    const jump = this.holeFlash; const o3 = new THREE.Object3D();
    this.fans.list.forEach(([x, y, z], i) => { o3.position.set(x, y + Math.max(0, Math.sin(this.t * 9 + i)) * jump * 0.4, z); o3.updateMatrix(); this.fans.mesh.setMatrixAt(i, o3.matrix); });
    this.fans.mesh.instanceMatrix.needsUpdate = true;
    this.o.renderer.render(this.scene, this.camera);
    this.bursts.render(0, this.view, (wx, wy) => this.project(wx, wy, 0.2));
    this.updateHud();
  }
  project(x, y, z) { const v = new THREE.Vector3(x, y, z).project(this.camera); return { x: (v.x + 1) / 2 * this.view.w, y: (1 - v.y) / 2 * this.view.h }; }
  showMeter(label, v) {
    const el = this.meterEl; el.hidden = false;
    if (el.dataset.key !== label) { el.dataset.key = label; el.innerHTML = `<b>${label}</b><div class="bar"><i></i></div><kbd>SPACE</kbd>`; this.needle = el.querySelector('i'); }
    this.needle.style.left = `${Math.max(0, Math.min(1, v)) * 100}%`;
  }
  updateHud() {
    const key = this.shots.join(',') + this.phase;
    if (key === this.hudKey) return; this.hudKey = key;
    const hits = this.shots.filter(Boolean).length;
    this.hud.innerHTML = `<div class="gw-right"><div class="gw-title">${this.shots.length < 3 ? 'LOWER HOLE' : 'UPPER HOLE'} <small>SHOT ${Math.min(6, this.shots.length + 1)} / 6</small></div><div class="gw-balls">${Array.from({ length: 6 }, (_, i) => `<span class="${i < this.shots.length ? (this.shots[i] ? 'hit' : 'miss') : ''}">${i < this.shots.length ? (this.shots[i] ? '✓' : '✗') : '●'}</span>`).join('')}</div>
      <div class="gw-score">${hits} / 6 · ${(hits * GOALWALL.HIT).toLocaleString('en')} PTS</div></div>`;
  }
}
