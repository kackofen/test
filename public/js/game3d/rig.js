// Stylised footballer built from primitives and canvas textures, animated procedurally (no model files).
// Slim athletic proportions (≈ 4.3 heads), tapered limbs, shaped jersey with pattern/number/name,
// painted face with expressions (blinking, effort, joy …), shaded hair. Forward = +x, up = +y,
// the rig's origin is between the feet. Joint layout (root → body → hips → torso/legs → arms/neck/head)
// is what animate() drives; the look of the parts can change without touching the animations.
/* global THREE */
import { toon, sphere, cylinder, box, hex, shadeHex, canvasTexture, inkMaterial, INK } from './toon.js';

const lightness = c => new THREE.Color(hex(c)).getHSL({}).l;
const hashStr = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
const css = n => '#' + n.toString(16).padStart(6, '0');
const sh = (c, f) => css(shadeHex(c, f)); // shaded colour as a CSS string (canvas drawing)
const contrast = c => sh(c, lightness(c) > 0.62 ? -0.55 : 0.55);

// ------------------------------------------------------------------ shapes with an inked outline
function offsetGeo(geo, t) {
  const g = geo.clone(), p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * t, p.getY(i) + n.getY(i) * t, p.getZ(i) + n.getZ(i) * t);
  return g;
}
function inked(geo, mat, t = 0.02) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = true;
  const o = new THREE.Mesh(offsetGeo(geo, t), inkMaterial()); o.raycast = () => {}; m.add(o);
  return m;
}
// points must run from bottom to top, otherwise the faces point inwards
const lathe = (pts, seg = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// ------------------------------------------------------------------ jersey texture (wraps around the torso: u 0.25 = front, 0.75 = back)
const texCache = new Map();
const cached = (key, make) => { let t = texCache.get(key); if (!t) texCache.set(key, t = make()); return t; };
function jerseyPattern(kit, stripes) { return stripes ? 2 : hashStr(kit.shirt + kit.shorts) % 6; }
function jerseyTexture(kit, number, name, stripes) {
  const pat = jerseyPattern(kit, stripes), key = `jersey|${kit.shirt}|${kit.shorts}|${stripes || ''}|${number}|${name || ''}`;
  return cached(key, () => canvasTexture(512, 512, (c, w, h) => {
    const main = kit.shirt, dk = sh(main, -0.2), lt = sh(main, 0.22), acc = stripes ? stripes : contrast(main);
    c.fillStyle = main; c.fillRect(0, 0, w, h);
    c.save();
    if (pat === 1) { c.fillStyle = lt; for (let y = 70; y < h; y += 96) c.fillRect(0, y, w, 46); }
    else if (pat === 2) { c.fillStyle = stripes || lt; for (let x = 0; x < w; x += 64) c.fillRect(x, 0, 32, h); }
    else if (pat === 3) { c.fillStyle = acc; c.beginPath(); c.moveTo(w * 0.05, 40); c.lineTo(w * 0.18, 40); c.lineTo(w * 0.45, h); c.lineTo(w * 0.32, h); c.closePath(); c.fill(); c.beginPath(); c.moveTo(w * 0.55, 40); c.lineTo(w * 0.68, 40); c.lineTo(w * 0.95, h); c.lineTo(w * 0.82, h); c.closePath(); c.fill(); }
    else if (pat === 4) { c.fillStyle = acc; c.fillRect(0, 150, w, 54); c.fillStyle = main; c.fillRect(0, 168, w, 18); }
    else if (pat === 5) { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, lt); g.addColorStop(0.55, main); g.addColorStop(1, dk); c.fillStyle = g; c.fillRect(0, 0, w, h); }
    c.restore();
    // side panels + seams, shoulder yoke, collar, hem
    c.fillStyle = 'rgba(0,0,0,0.13)'; for (const x of [0, w * 0.5]) { c.fillRect(x - 22, 0, 44, h); } c.fillRect(w - 22, 0, 22, h);
    c.fillStyle = 'rgba(0,0,0,0.25)'; for (const x of [22, w * 0.5 - 22, w * 0.5 + 22]) c.fillRect(x - 1.5, 30, 3, h - 30);
    c.fillStyle = acc; c.fillRect(0, 0, w, 26); c.fillRect(0, h - 22, w, 22);
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(0, 26, w, 6);
    // V-neck at the front, round at the back
    c.fillStyle = acc; c.beginPath(); c.moveTo(w * 0.25 - 40, 0); c.lineTo(w * 0.25, 78); c.lineTo(w * 0.25 + 40, 0); c.fill();
    c.fillStyle = main; c.beginPath(); c.moveTo(w * 0.25 - 26, 0); c.lineTo(w * 0.25, 50); c.lineTo(w * 0.25 + 26, 0); c.fill();
    // numbers + name
    const ink = lightness(main) > 0.62 ? '#1a1222' : '#ffffff', edge = lightness(main) > 0.62 ? '#ffffff' : '#1a1222';
    const txt = (s, x, y, size, lw) => { c.font = `${size}px "Bangers", Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = lw; c.strokeStyle = edge; c.strokeText(s, x, y); c.fillStyle = ink; c.fillText(s, x, y); };
    if (number != null) { txt(String(number), w * 0.75, 270, 210, 12); txt(String(number), w * 0.25 + 64, 150, 62, 6); }
    if (name) txt(String(name).toUpperCase().slice(0, 10), w * 0.75, 112, name.length > 7 ? 46 : 58, 6);
  }, { repeat: true }));
}

// ------------------------------------------------------------------ hair texture (strands + a light band)
function hairTexture(color) {
  return cached('hair|' + color, () => canvasTexture(256, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, sh(color, 0.08)); g.addColorStop(0.2, color); g.addColorStop(1, sh(color, -0.35)); c.fillStyle = g; c.fillRect(0, 0, w, h);
    const band = c.createLinearGradient(0, h * 0.1, 0, h * 0.34); band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(0.5, 'rgba(255,255,255,0.30)'); band.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = band; c.fillRect(0, h * 0.1, w, h * 0.24);
    c.strokeStyle = 'rgba(0,0,0,0.10)'; c.lineWidth = 1.2; for (let x = 0; x < w; x += 6) { c.beginPath(); c.moveTo(x + (x % 12), 0); c.lineTo(x + (x % 12) * 0.4, h); c.stroke(); }
  }, { repeat: true }));
}

// ------------------------------------------------------------------ face (decal on the front of the head)
const FACE = { phi: 1.7, theta: 1.25, theta0: Math.PI / 2 - 0.55 };
const EYE_COLORS = ['#4b2e1a', '#2f6fb5', '#3f8f5a', '#6b4a2a', '#3a2a22'];
function faceTexture(expr, eye, lip, brow) {
  return cached(`face|${expr}|${eye}|${lip}|${brow}`, () => canvasTexture(512, 380, (c, w, h) => {
    const ex = 118, ey = 138, rx = 44, ry = 50, cx = w / 2;
    c.lineCap = 'round'; c.lineJoin = 'round';
    const lidLine = (x, dir, wide) => { // upper lid with a lash flick on the outer corner
      c.strokeStyle = INK; c.lineWidth = 12; c.beginPath(); c.ellipse(x, ey, rx + 3, ry + 3, 0, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
      c.lineWidth = 8; c.beginPath(); c.moveTo(x + dir * (rx + 1), ey - 18); c.quadraticCurveTo(x + dir * (rx + 18), ey - 28, x + dir * (rx + 26), ey - 46); c.stroke();
      if (wide) { c.lineWidth = 5; c.beginPath(); c.moveTo(x + dir * (rx - 12), ey - ry - 2); c.lineTo(x + dir * (rx - 6), ey - ry - 18); c.stroke(); }
    };
    const eyeOpen = (x, dir, big) => {
      const ky = big ? 1.12 : 1;
      c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(x, ey, rx, ry * ky, 0, 0, 7); c.fill();
      c.save(); c.beginPath(); c.ellipse(x, ey, rx, ry * ky, 0, 0, 7); c.clip();
      const ig = c.createLinearGradient(0, ey - ry, 0, ey + ry); ig.addColorStop(0, sh(eye, -0.45)); ig.addColorStop(0.5, eye); ig.addColorStop(1, sh(eye, 0.35));
      c.fillStyle = ig; c.beginPath(); c.ellipse(x + dir * 5, ey + 4, rx * 0.74, ry * 0.9 * ky, 0, 0, 7); c.fill();
      c.fillStyle = INK; c.beginPath(); c.ellipse(x + dir * 5, ey + 4, rx * 0.34, ry * 0.44 * ky, 0, 0, 7); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(x - rx, ey - ry * ky, rx * 2, ry * 0.42);
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x - 12, ey - 14, 11, 0, 7); c.fill(); c.beginPath(); c.arc(x + 14, ey + 18, 5.5, 0, 7); c.fill();
      c.restore(); lidLine(x, dir, true);
    };
    const eyeClosed = (x, dir) => { c.strokeStyle = INK; c.lineWidth = 11; c.beginPath(); c.moveTo(x - rx, ey + 6); c.quadraticCurveTo(x, ey + 24, x + rx, ey + 6); c.stroke(); c.lineWidth = 7; c.beginPath(); c.moveTo(x + dir * rx, ey + 6); c.lineTo(x + dir * (rx + 14), ey - 6); c.stroke(); };
    const eyeJoy = x => { c.strokeStyle = INK; c.lineWidth = 12; c.beginPath(); c.moveTo(x - rx, ey + 14); c.quadraticCurveTo(x, ey - 34, x + rx, ey + 14); c.stroke(); };
    const eyeHurt = (x, dir) => { c.strokeStyle = INK; c.lineWidth = 12; c.beginPath(); c.moveTo(x - dir * rx, ey - 26); c.lineTo(x + dir * rx * 0.5, ey); c.lineTo(x - dir * rx, ey + 26); c.stroke(); };
    const eyeEffort = (x, dir) => { // narrowed, determined
      c.save(); c.beginPath(); c.rect(x - rx - 4, ey - 2, rx * 2 + 8, ry); c.clip(); eyeOpen(x, dir, false); c.restore();
      c.strokeStyle = INK; c.lineWidth = 12; c.beginPath(); c.moveTo(x - rx - 3, ey - 2 - dir * -6); c.lineTo(x + rx + 3, ey - 2 + dir * -6); c.stroke();
    };
    const browAt = (x, dir, y, tilt) => { c.strokeStyle = brow; c.lineWidth = 12; c.beginPath(); c.moveTo(x - dir * 44, y + tilt); c.quadraticCurveTo(x, y - 14, x + dir * 44, y - tilt); c.stroke(); };
    for (const s of [-1, 1]) {
      const x = cx + s * ex, dir = s; // dir: towards the outer corner
      if (expr === 'joy') { eyeJoy(x); browAt(x, dir, ey - 82, 4); }
      else if (expr === 'hurt') { eyeHurt(x, dir); browAt(x, dir, ey - 78, -14); }
      else if (expr === 'effort') { eyeEffort(x, dir); browAt(x, dir, ey - 62, 16); }
      else if (expr === 'blink') { eyeClosed(x, dir); browAt(x, dir, ey - 76, 0); }
      else { eyeOpen(x, dir, expr === 'shout' || expr === 'open'); browAt(x, dir, ey - 78 - (expr === 'open' || expr === 'shout' ? 8 : 0), expr === 'shout' ? -6 : 2); }
      c.fillStyle = 'rgba(255,110,120,0.34)'; c.beginPath(); c.ellipse(x + dir * 6, ey + 92, 36, 17, 0, 0, 7); c.fill();
    }
    c.strokeStyle = 'rgba(120,60,40,0.5)'; c.lineWidth = 6; c.beginPath(); c.moveTo(cx - 6, 226); c.quadraticCurveTo(cx + 5, 238, cx - 2, 244); c.stroke();
    const my = 292;
    c.strokeStyle = INK; c.lineWidth = 8; c.fillStyle = lip;
    if (expr === 'joy' || expr === 'shout') {
      const k = expr === 'shout' ? 1.3 : 1;
      c.beginPath(); c.moveTo(cx - 52 * k, my - 6); c.quadraticCurveTo(cx, my + 80 * k, cx + 52 * k, my - 6); c.closePath(); c.fillStyle = '#7a2230'; c.fill(); c.stroke();
      c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(cx - 44 * k, my - 3); c.lineTo(cx + 44 * k, my - 3); c.lineTo(cx + 40 * k, my + 12); c.lineTo(cx - 40 * k, my + 12); c.fill();
      c.fillStyle = '#e8737f'; c.beginPath(); c.ellipse(cx, my + 34 * k, 22 * k, 11 * k, 0, 0, 7); c.fill();
    } else if (expr === 'open') {
      c.fillStyle = '#7a2230'; c.beginPath(); c.ellipse(cx, my + 6, 20, 24, 0, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#e8737f'; c.beginPath(); c.ellipse(cx, my + 16, 12, 8, 0, 0, 7); c.fill();
    } else if (expr === 'effort') {
      c.beginPath(); c.roundRect(cx - 40, my - 8, 80, 30, 8); c.fillStyle = '#ffffff'; c.fill(); c.stroke();
      c.lineWidth = 4; c.beginPath(); c.moveTo(cx - 40, my + 7); c.lineTo(cx + 40, my + 7); c.moveTo(cx - 13, my - 8); c.lineTo(cx - 13, my + 22); c.moveTo(cx + 13, my - 8); c.lineTo(cx + 13, my + 22); c.stroke();
    } else if (expr === 'hurt') {
      c.beginPath(); c.moveTo(cx - 40, my + 14); c.quadraticCurveTo(cx - 20, my - 12, cx, my + 12); c.quadraticCurveTo(cx + 20, my + 36, cx + 40, my + 8); c.stroke();
    } else { // neutral: a friendly little smile
      c.beginPath(); c.moveTo(cx - 36, my); c.quadraticCurveTo(cx, my + 30, cx + 36, my); c.stroke();
      c.strokeStyle = lip; c.lineWidth = 5; c.beginPath(); c.moveTo(cx - 20, my + 14); c.quadraticCurveTo(cx, my + 24, cx + 20, my + 14); c.stroke();
    }
  }));
}
const exprFor = (mode, sp, blink) => (mode === 'cheer' ? 'joy' : mode === 'hurt' ? 'hurt' : mode === 'dive' ? 'shout' : mode === 'header' || mode === 'kick' ? 'effort' : mode === 'air' ? 'open' : mode === 'run' && sp > 0.55 ? 'effort' : blink ? 'blink' : 'neutral');

// ------------------------------------------------------------------ the figure
export function makeFootballer({ look, kit, gk = false, gloves = '#f2f2f2', stripes = null, scale = 0.9 }) {
  const skinL = lightness(look.skin);
  const skin = toon(hex(look.skin)), skinD = toon(shadeHex(look.skin, -0.14));
  const main = toon(hex(kit.shirt)), shorts = toon(hex(kit.shorts)), socks = toon(hex(kit.socks));
  const acc = shadeHex(kit.shirt, lightness(kit.shirt) > 0.6 ? -0.55 : 0.5), trim = toon(acc);
  const shortsTrim = toon(shadeHex(kit.shorts, lightness(kit.shorts) > 0.6 ? -0.5 : 0.55)), sockTrim = toon(shadeHex(kit.socks, lightness(kit.socks) > 0.6 ? -0.5 : 0.55));
  const boots = toon(hex(look.boots || '#222222')), bootsD = toon(shadeHex(look.boots || '#222222', -0.4)), glove = toon(hex(gloves));
  const hairCol = look.hair, hairMat = toon(0xffffff, { map: hairTexture(hairCol), unique: true }), hairD = toon(shadeHex(hairCol, -0.3));
  const number = look.number ?? 1 + (hashStr(hairCol + look.skin) % 23);
  const jersey = toon(0xffffff, { map: jerseyTexture(kit, number, look.name, stripes), unique: true });

  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.885; body.add(hips);

  // pelvis + shorts
  const pelvis = inked(lathe([[0.138, -0.11], [0.152, -0.05], [0.142, 0.02], [0.116, 0.06]]), shorts, 0.016); pelvis.scale.set(0.84, 1, 1.12); hips.add(pelvis);

  // torso: tapered jersey (narrow waist, shoulders), neck hole filled by the neck
  const torso = new THREE.Group(); hips.add(torso);
  const shirtM = inked(lathe([[0.16, -0.04], [0.158, 0.0], [0.15, 0.06], [0.128, 0.16], [0.14, 0.25], [0.164, 0.34], [0.168, 0.4], [0.148, 0.455], [0.08, 0.495]], 32), jersey, 0.014);
  shirtM.scale.set(0.8, 1, 1.18); torso.add(shirtM);

  const arm = side => {
    const g = new THREE.Group(); g.position.set(0, 0.435, side * 0.205); torso.add(g);
    const shoulder = sphere(0.056, main, { seg: 10, outline: 0.015 }); g.add(shoulder);
    const sleeve = cylinder(0.057, 0.056, gk ? 0.27 : 0.12, main, { seg: 12, outline: 0.016 }); sleeve.position.y = gk ? -0.12 : -0.06; g.add(sleeve);
    if (!gk) { const cuff = cylinder(0.057, 0.057, 0.022, trim, { seg: 12, outline: 0.012 }); cuff.position.y = -0.125; g.add(cuff); }
    const upper = cylinder(0.05, 0.043, 0.2, gk ? main : skin, { seg: 10, outline: 0.014 }); upper.position.y = -0.17; g.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.27; g.add(elbow);
    elbow.add(sphere(0.045, gk ? main : skin, { seg: 8, outline: 0.012 }));
    const fore = cylinder(0.043, 0.032, 0.24, gk ? main : skin, { seg: 10, outline: 0.014 }); fore.position.y = -0.13; elbow.add(fore);
    const hand = sphere(gk ? 0.075 : 0.048, gk ? glove : skin, { seg: 10, outline: 0.012 }); hand.position.y = -0.27; hand.scale.set(0.9, 1.15, 0.75); elbow.add(hand);
    if (!gk) { const th = sphere(0.02, skin, { seg: 6, outline: 0.008 }); th.position.set(0.035, -0.25, side * 0.01); elbow.add(th); }
    return { g, elbow };
  };
  const armL = arm(-1), armR = arm(1);

  const leg = side => {
    const g = new THREE.Group(); g.position.set(0, -0.06, side * 0.092); hips.add(g);
    const shortLeg = inked(lathe([[0.106, -0.095], [0.095, 0.0], [0.084, 0.095]], 16), shorts, 0.013); shortLeg.position.y = -0.06; g.add(shortLeg); // open tube: no cap outline poking through the hip
    const thigh = cylinder(0.09, 0.066, 0.36, skin, { seg: 12, outline: 0.015 }); thigh.position.y = -0.2; g.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.37; g.add(knee);
    knee.add(sphere(0.064, skin, { seg: 10, outline: 0.013 }));
    const shin = cylinder(0.062, 0.043, 0.37, socks, { seg: 12, outline: 0.014 }); shin.position.y = -0.19; knee.add(shin);
    const calf = sphere(0.062, socks, { seg: 10, outline: 0 }); calf.position.set(-0.025, -0.1, 0); calf.scale.set(0.9, 1.5, 0.95); knee.add(calf);
    const band = cylinder(0.064, 0.062, 0.035, sockTrim, { seg: 12, outline: 0.012 }); band.position.y = -0.06; knee.add(band);
    const ankle = new THREE.Group(); ankle.position.y = -0.37; knee.add(ankle);
    const upperB = sphere(0.07, boots, { seg: 12, outline: 0.016 }); upperB.position.set(0.065, -0.025, 0); upperB.scale.set(1.9, 0.85, 1.0); ankle.add(upperB);
    const sole = box(0.27, 0.028, 0.115, bootsD, { outline: 0.012 }); sole.position.set(0.075, -0.072, 0); ankle.add(sole);
    const lace = box(0.07, 0.012, 0.06, toon(0xffffff), { outline: 0 }); lace.position.set(0.05, 0.025, 0); lace.rotation.z = -0.35; ankle.add(lace);
    return { g, knee, ankle };
  };
  const legL = leg(-1), legR = leg(1);

  // neck + head
  const neck = new THREE.Group(); neck.position.y = 0.5; torso.add(neck);
  const neckM = cylinder(0.044, 0.054, 0.14, skinD, { seg: 10, outline: 0.012 }); neckM.position.y = 0.04; neck.add(neckM);
  const head = new THREE.Group(); head.position.y = 0.24; neck.add(head);
  const skull = sphere(0.215, skin, { seg: 28, outline: 0.016 }); skull.scale.set(0.97, 1.05, 0.95); head.add(skull);
  const chin = sphere(0.1, skin, { seg: 12, outline: 0 }); chin.position.set(0.05, -0.13, 0); chin.scale.set(0.9, 0.75, 0.95); head.add(chin);
  for (const s of [-1, 1]) { const ear = sphere(0.04, skin, { seg: 8, outline: 0.01 }); ear.position.set(-0.01, -0.02, s * 0.205); ear.scale.set(0.8, 1.1, 0.5); head.add(ear); }

  // face decal
  const eyeCol = EYE_COLORS[hashStr(hairCol + look.skin) % EYE_COLORS.length], lipCol = skinL < 0.4 ? '#8d3b4a' : '#cf6470', browCol = sh(hairCol, -0.35);
  const faceMat = new THREE.MeshBasicMaterial({ map: faceTexture('neutral', eyeCol, lipCol, browCol), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.2155, 28, 18, Math.PI - FACE.phi / 2, FACE.phi, FACE.theta0, FACE.theta), faceMat);
  face.renderOrder = 2; skull.add(face);

  // hair
  const style = look.hairStyle || 'ponytail', tail = [];
  const capLen = style === 'short' ? 1.75 : style === 'bun' ? 1.55 : 1.5;
  if (style !== 'afro') {
    const cap = inked(new THREE.SphereGeometry(0.236, 28, 16, 0, Math.PI * 2, 0, capLen), hairMat, 0.013); cap.rotation.z = 0.5; cap.scale.set(1, 1.03, 1); head.add(cap);
    const bangs = inked(new THREE.SphereGeometry(0.239, 24, 12, Math.PI - 0.95, 1.9, 0, 0.98), hairMat, 0.012); bangs.rotation.x = 0.16; head.add(bangs); // side-swept fringe
  }
  if (style === 'ponytail') {
    let parent = head, off = new THREE.Vector3(-0.22, 0.12, 0);
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group(); g.position.copy(off); parent.add(g);
      const r = 0.085 - i * 0.012, m = sphere(r, i % 2 ? hairD : hairMat, { seg: 10, outline: 0.012 }); m.position.set(-r * 0.7, -r * 0.7, 0); m.scale.set(1.2, 1.2, 0.85); g.add(m);
      tail.push(g); parent = g; off = new THREE.Vector3(-r * 1.2, -r * 1.35, 0);
    }
    const band = sphere(0.04, trim, { seg: 8, outline: 0.008 }); band.position.set(-0.215, 0.12, 0); band.scale.set(0.7, 1.1, 1.3); head.add(band);
  } else if (style === 'bun') {
    const b = sphere(0.115, hairMat, { seg: 14, outline: 0.013 }); b.position.set(-0.13, 0.25, 0); head.add(b);
    const band = cylinder(0.075, 0.075, 0.03, trim, { seg: 10, outline: 0.008 }); band.position.set(-0.13, 0.19, 0); band.rotation.z = 0.3; head.add(band);
    for (const s of [-1, 1]) { const st = sphere(0.045, hairMat, { seg: 8, outline: 0.01 }); st.position.set(0.02, -0.01, s * 0.215); st.scale.set(0.9, 2.2, 0.55); head.add(st); }
  } else if (style === 'short') {
    for (const s of [-1, 1]) { const sd = sphere(0.1, hairMat, { seg: 12, outline: 0.012 }); sd.position.set(-0.03, -0.1, s * 0.16); sd.scale.set(1.0, 1.25, 0.6); head.add(sd); }
    const bk = sphere(0.16, hairMat, { seg: 14, outline: 0.013 }); bk.position.set(-0.11, -0.06, 0); bk.scale.set(0.8, 1.15, 1.0); head.add(bk);
  } else if (style === 'braids') {
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const b = sphere(0.04 - i * 0.002, i % 2 ? hairD : hairMat, { seg: 8, outline: 0.008 }); b.position.set(-0.13 - i * 0.012, -0.08 - i * 0.075, s * 0.17); b.scale.set(1, 1.35, 0.9); head.add(b); }
    const bk = sphere(0.14, hairMat, { seg: 12, outline: 0.012 }); bk.position.set(-0.1, -0.02, 0); bk.scale.set(0.75, 1.1, 1.0); head.add(bk);
  } else if (style === 'afro') { // a cloud of curls
    const curlMat = toon(hex(hairCol));
    const core = sphere(0.25, curlMat, { seg: 16, outline: 0.015 }); core.position.set(-0.07, 0.09, 0); core.scale.set(0.95, 0.95, 1.0); head.add(core);
    const rnd = (i, k) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < 16; i++) {
      const th = 0.25 + rnd(i, 1) * 1.45, ph = rnd(i, 2) * Math.PI * 2, r = 0.27;
      const c = sphere(0.085 + rnd(i, 3) * 0.04, i % 3 ? curlMat : hairD, { seg: 8, outline: 0.012 });
      c.position.set(-0.07 + Math.sin(th) * Math.cos(ph) * r * 0.95, 0.09 + Math.cos(th) * r, Math.sin(th) * Math.sin(ph) * r);
      if (c.position.x > 0.1 && Math.abs(c.position.z) < 0.18 && c.position.y < 0.15) c.position.x -= 0.1; // keep the face free
      head.add(c);
    }
  }

  root.scale.setScalar(scale);
  root.traverse(o => { if (o.isMesh && o.material !== faceMat) o.castShadow = o.material?.side !== THREE.BackSide; });
  faceMat.map = faceTexture('neutral', eyeCol, lipCol, browCol);

  return {
    root, body, hips, torso, head, neck, armL, armR, legL, legR, tail,
    face: { mat: faceMat, expr: 'neutral', eye: eyeCol, lip: lipCol, brow: browCol, blinkAt: 1.5 + Math.random() * 3 },
    phase: Math.random() * 6, squash: 0, turn: -0.45, tailV: 0, tailA: 0, t: 0,
  };
}

const lerp = (a, b, t) => a + (b - a) * t;
// s: { speed 0..1, ground, vy (sim px/frame, down positive), facing, mode: run|air|header|cheer|hurt|dive|kick|idle }
export function animate(R, s, dt) {
  R.t += dt;
  const k = Math.min(1, dt * 12);
  const sp = s.speed || 0;
  let mode = s.mode || (s.ground ? (sp > 0.06 ? 'run' : 'idle') : 'air');
  R.phase += dt * (6 + sp * 9) * (mode === 'run' ? 1 : 0.4);
  const ph = R.phase;
  // face: expression by action, blinking every few seconds
  const F = R.face;
  if (R.t > F.blinkAt + 0.13) F.blinkAt = R.t + 2.2 + Math.random() * 3;
  const ex = exprFor(mode, sp, R.t > F.blinkAt && R.t < F.blinkAt + 0.12);
  if (ex !== F.expr) { F.expr = ex; F.mat.map = faceTexture(ex, F.eye, F.lip, F.brow); }
  const tgt = {
    legL: 0, legR: 0, kneeL: -0.1, kneeR: -0.1, armL: 0.15, armR: -0.15, elbL: 0.4, elbR: 0.4,
    lean: 0, headZ: 0, bodyY: 0, bodyRot: 0, ankleL: 0, ankleR: 0, spread: 0.12,
  };
  if (mode === 'run') {
    const a = 0.35 + sp * 0.75;
    tgt.legL = Math.sin(ph) * a; tgt.legR = Math.sin(ph + Math.PI) * a;
    tgt.kneeL = -(Math.max(0, Math.sin(ph - 1.3)) * (0.5 + sp * 1.1) + 0.12);
    tgt.kneeR = -(Math.max(0, Math.sin(ph + Math.PI - 1.3)) * (0.5 + sp * 1.1) + 0.12);
    tgt.armL = -Math.sin(ph) * (0.4 + sp * 0.6); tgt.armR = -Math.sin(ph + Math.PI) * (0.4 + sp * 0.6);
    tgt.elbL = tgt.elbR = 0.7 + sp * 0.6;
    tgt.lean = -0.08 - sp * 0.22;
    tgt.bodyY = Math.abs(Math.sin(ph)) * (0.03 + sp * 0.07);
  } else if (mode === 'idle') {
    const b = Math.sin(R.t * 2.4);
    tgt.armL = 0.12 + b * 0.04; tgt.armR = -0.12 - b * 0.04; tgt.bodyY = b * 0.008; tgt.headZ = Math.sin(R.t * 0.9) * 0.05;
  } else if (mode === 'air') {
    const up = s.vy < 0;
    tgt.legL = up ? 0.9 : 0.35; tgt.kneeL = up ? -1.3 : -0.5;
    tgt.legR = up ? -0.35 : -0.15; tgt.kneeR = up ? -0.7 : -0.3;
    tgt.armL = up ? 2.4 : 1.3; tgt.armR = up ? -0.8 : 1.0; tgt.elbL = 0.3; tgt.elbR = 0.6;
    tgt.lean = up ? -0.05 : 0.08;
  } else if (mode === 'header') {
    tgt.headZ = -0.55; tgt.lean = 0.25; tgt.armL = -0.9; tgt.armR = -0.9; tgt.legL = 0.4; tgt.legR = -0.5; tgt.kneeL = -0.9; tgt.kneeR = -0.6;
  } else if (mode === 'cheer') {
    const w = Math.sin(R.t * 10);
    tgt.armL = 2.35 + w * 0.2; tgt.armR = 2.0 - w * 0.2; tgt.elbL = tgt.elbR = 0.25; tgt.spread = 0.45; tgt.bodyY = Math.abs(Math.sin(R.t * 6)) * 0.25; tgt.headZ = 0.2;
  } else if (mode === 'hurt') {
    tgt.armL = 2.6; tgt.armR = 2.2; tgt.legL = 0.6; tgt.legR = -0.4; tgt.headZ = 0.4; tgt.bodyRot = R.t * 9;
  } else if (mode === 'kick') {
    tgt.legR = 1.35; tgt.kneeR = -0.15; tgt.legL = -0.25; tgt.kneeL = -0.35; tgt.armL = 1.4; tgt.armR = -0.7; tgt.elbL = 0.3; tgt.lean = 0.18; tgt.headZ = -0.2;
  } else if (mode === 'dive') {
    tgt.armL = 2.9; tgt.armR = 2.9; tgt.elbL = tgt.elbR = 0.05; tgt.legL = -0.2; tgt.legR = 0.2; tgt.bodyRot = 1.25; tgt.bodyY = 0.6;
  }
  const L = R.legL, Rr = R.legR;
  L.g.rotation.z = lerp(L.g.rotation.z, tgt.legL, k); Rr.g.rotation.z = lerp(Rr.g.rotation.z, tgt.legR, k);
  L.knee.rotation.z = lerp(L.knee.rotation.z, tgt.kneeL, k); Rr.knee.rotation.z = lerp(Rr.knee.rotation.z, tgt.kneeR, k);
  L.ankle.rotation.z = -L.g.rotation.z * 0.3 - L.knee.rotation.z * 0.6; Rr.ankle.rotation.z = -Rr.g.rotation.z * 0.3 - Rr.knee.rotation.z * 0.6;
  R.armL.g.rotation.z = lerp(R.armL.g.rotation.z, tgt.armL, k); R.armR.g.rotation.z = lerp(R.armR.g.rotation.z, tgt.armR, k);
  R.armL.elbow.rotation.z = lerp(R.armL.elbow.rotation.z, tgt.elbL, k); R.armR.elbow.rotation.z = lerp(R.armR.elbow.rotation.z, tgt.elbR, k);
  R.armL.g.rotation.x = lerp(R.armL.g.rotation.x, -tgt.spread, k); R.armR.g.rotation.x = lerp(R.armR.g.rotation.x, tgt.spread, k);
  R.torso.rotation.z = lerp(R.torso.rotation.z, tgt.lean, k);
  R.head.rotation.z = lerp(R.head.rotation.z, tgt.headZ, k);
  R.body.position.y = lerp(R.body.position.y, tgt.bodyY, k);
  if (mode === 'hurt') R.body.rotation.z = tgt.bodyRot; else R.body.rotation.z = lerp(R.body.rotation.z, tgt.bodyRot, Math.min(1, k * 0.8));
  // squash & stretch
  R.squash *= Math.pow(0.0005, dt);
  const stretch = mode === 'air' ? Math.max(-0.12, Math.min(0.12, -(s.vy || 0) * 0.025)) : 0;
  R.body.scale.set(1 + R.squash * 0.6 - stretch * 0.4, 1 - R.squash + stretch, 1 + R.squash * 0.6 - stretch * 0.4);
  // turn towards the camera a bit (3/4 view)
  const want = s.yaw ?? ((s.facing ?? 1) >= 0 ? -0.45 : Math.PI + 0.45);
  R.turn = s.snapYaw ? want : lerp(R.turn, want, Math.min(1, dt * 10));
  R.root.rotation.y = R.turn;
  // in the side-scrolling view the head looks a bit more towards the camera than the body, so the face reads
  const look = s.yaw == null ? (Math.cos(R.turn) >= 0 ? -0.5 : 0.5) : 0;
  R.head.rotation.y = lerp(R.head.rotation.y, look, Math.min(1, dt * 8));
  // ponytail follows the movement (damped spring)
  if (R.tail.length) {
    const target = Math.max(-0.4, Math.min(1.1, sp * 0.9 + (s.vy || 0) * 0.08)) + Math.sin(R.t * 3) * 0.05;
    R.tailV += (target - R.tailA) * dt * 40; R.tailV *= Math.pow(0.02, dt); R.tailA += R.tailV * dt;
    R.tail.forEach((g, i) => { g.rotation.z = -R.tailA * (0.5 + i * 0.2) + Math.sin(R.t * 5 + i) * 0.04 * (1 + sp); });
  }
}
