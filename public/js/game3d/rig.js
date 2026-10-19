// Low-poly footballer built from primitives, animated procedurally (no model files).
// Forward = +x, up = +y, the rig's origin is between the feet.
/* global THREE */
import { toon, sphere, capsule, cylinder, box, hex, shadeHex, INK } from './toon.js';

export function makeFootballer({ look, kit, gk = false, gloves = '#f2f2f2', stripes = null, scale = 0.9 }) {
  const skin = toon(hex(look.skin)), skinD = toon(shadeHex(look.skin, -0.12));
  const shirt = toon(hex(kit.shirt)), shorts = toon(hex(kit.shorts)), socks = toon(hex(kit.socks));
  const boots = toon(hex(look.boots || '#222222')), hair = toon(hex(look.hair)), hairD = toon(shadeHex(look.hair, -0.25));
  const trim = toon(shadeHex(kit.shirt, new THREE.Color(hex(kit.shirt)).getHSL({}).l > 0.6 ? -0.55 : 0.5));
  const glove = toon(hex(gloves));

  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.74; body.add(hips);
  const sh = cylinder(0.2, 0.2, 0.22, shorts, { seg: 12 }); sh.position.y = -0.02; hips.add(sh);

  const torso = new THREE.Group(); hips.add(torso);
  const shirtM = capsule(0.19, 0.2, shirt); shirtM.position.y = 0.27; shirtM.scale.set(1, 1, 0.82); torso.add(shirtM);
  if (stripes) { for (const z of [-0.08, 0.08]) { const st = box(0.36, 0.34, 0.035, toon(hex(stripes)), { outline: 0 }); st.position.set(0, 0.27, z * 2.1); torso.add(st); } }
  const collar = cylinder(0.09, 0.11, 0.06, trim, { outline: 0.02 }); collar.position.y = 0.52; torso.add(collar);

  const arm = side => {
    const g = new THREE.Group(); g.position.set(0, 0.43, side * 0.24); torso.add(g);
    const sleeve = cylinder(0.085, 0.08, 0.14, gk ? shirt : shirt, { seg: 10 }); sleeve.position.y = -0.06; g.add(sleeve);
    const upper = capsule(0.062, 0.12, gk ? shirt : skin); upper.position.y = -0.15; g.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.24; g.add(elbow);
    const fore = capsule(0.056, 0.13, gk ? shirt : skin); fore.position.y = -0.09; elbow.add(fore);
    const hand = sphere(gk ? 0.09 : 0.065, gk ? glove : skin, { seg: 10 }); hand.position.y = -0.21; elbow.add(hand);
    return { g, elbow };
  };
  const armL = arm(-1), armR = arm(1);

  const leg = side => {
    const g = new THREE.Group(); g.position.set(0, -0.08, side * 0.1); hips.add(g);
    const thigh = capsule(0.085, 0.16, skin); thigh.position.y = -0.14; g.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.3; g.add(knee);
    const shin = capsule(0.078, 0.18, socks); shin.position.y = -0.14; knee.add(shin);
    const ankle = new THREE.Group(); ankle.position.y = -0.31; knee.add(ankle);
    const boot = box(0.25, 0.1, 0.13, boots, { outline: 0.03 }); boot.position.set(0.05, -0.02, 0); ankle.add(boot);
    return { g, knee, ankle };
  };
  const legL = leg(-1), legR = leg(1);

  // head
  const neck = new THREE.Group(); neck.position.y = 0.55; torso.add(neck);
  const neckM = cylinder(0.06, 0.07, 0.1, skinD, { outline: 0.02 }); neckM.position.y = 0.02; neck.add(neckM);
  const head = new THREE.Group(); head.position.y = 0.27; neck.add(head);
  head.add(sphere(0.26, skin, { seg: 18 }));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.275, 18, 12, 0, Math.PI * 2, 0, look.hairStyle === 'short' ? 1.45 : 1.25), hair);
  cap.rotation.z = 0.55; cap.castShadow = true; head.add(cap);
  const capInk = new THREE.Mesh(new THREE.SphereGeometry(0.295, 18, 12, 0, Math.PI * 2, 0, look.hairStyle === 'short' ? 1.5 : 1.3), new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  capInk.rotation.z = 0.55; head.add(capInk);
  const tail = [];
  if (look.hairStyle === 'ponytail' || !look.hairStyle) {
    let parent = head; let off = new THREE.Vector3(-0.24, 0.1, 0);
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group(); g.position.copy(off); parent.add(g);
      const r = 0.1 - i * 0.022; const m = sphere(r, i ? hairD : hair, { seg: 10 }); m.position.set(-r * 0.8, -r * 0.6, 0); m.scale.set(1.25, 1, 0.9); g.add(m);
      tail.push(g); parent = g; off = new THREE.Vector3(-r * 1.6, -r * 1.1, 0);
    }
    const band = sphere(0.04, toon(hex(kit.shirt)), { seg: 8 }); band.position.set(-0.23, 0.1, 0); head.add(band);
  } else if (look.hairStyle === 'bun') {
    const b = sphere(0.12, hair, { seg: 12 }); b.position.set(-0.17, 0.2, 0); head.add(b);
  } else if (look.hairStyle === 'braids') {
    for (const z of [-0.1, 0.1]) { const b = capsule(0.04, 0.3, hairD); b.position.set(-0.2, -0.18, z); b.rotation.z = -0.2; head.add(b); }
  } else if (look.hairStyle === 'afro') {
    const a = sphere(0.33, hair, { seg: 16 }); a.position.set(-0.15, 0.12, 0); head.add(a);
  }
  // face (eyes look forward and slightly to the camera side)
  const eyeM = new THREE.MeshBasicMaterial({ color: INK }), glint = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const z of [-0.1, 0.1]) {
    const dir = new THREE.Vector3(0.22, 0.03, z).normalize().multiplyScalar(0.252);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), eyeM); e.position.copy(dir); e.scale.set(0.6, 1.25, 1); head.add(e);
    const gl = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), glint); gl.position.copy(dir.clone().multiplyScalar(1.06)).add(new THREE.Vector3(0, 0.02, 0.008)); head.add(gl);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.018, 0.07), hairD); brow.position.copy(dir.clone().multiplyScalar(1.02)).add(new THREE.Vector3(0, 0.075, 0)); head.add(brow);
  }
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xb5545c })); mouth.position.set(0.245, -0.09, 0.04); mouth.scale.set(0.5, 0.45, 1.2); head.add(mouth);
  for (const z of [-0.14, 0.14]) { const ch = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xf29a9a, transparent: true, opacity: 0.55 })); ch.position.set(0.2, -0.05, z); ch.scale.set(0.4, 0.6, 1); head.add(ch); }

  root.scale.setScalar(scale);
  root.traverse(o => { if (o.isMesh && o.material !== eyeM) o.castShadow = o.material?.side !== THREE.BackSide; });

  const R = {
    root, body, hips, torso, head, neck, armL, armR, legL, legR, tail,
    phase: Math.random() * 6, squash: 0, turn: -0.45, tailV: 0, tailA: 0, t: 0,
  };
  return R;
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
  const tgt = {
    legL: 0, legR: 0, kneeL: -0.1, kneeR: -0.1, armL: 0.15, armR: -0.15, elbL: 0.4, elbR: 0.4,
    lean: 0, headZ: 0, bodyY: 0, bodyRot: 0, ankleL: 0, ankleR: 0,
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
    tgt.armL = 2.9 + w * 0.15; tgt.armR = 2.9 - w * 0.15; tgt.elbL = tgt.elbR = 0.2; tgt.bodyY = Math.abs(Math.sin(R.t * 6)) * 0.25; tgt.headZ = 0.2;
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
  R.armL.g.rotation.x = -0.12; R.armR.g.rotation.x = 0.12;
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
  // ponytail follows the movement (damped spring)
  if (R.tail.length) {
    const target = Math.max(-0.4, Math.min(1.1, sp * 0.9 + (s.vy || 0) * 0.08)) + Math.sin(R.t * 3) * 0.05;
    R.tailV += (target - R.tailA) * dt * 40; R.tailV *= Math.pow(0.02, dt); R.tailA += R.tailV * dt;
    R.tail.forEach((g, i) => { g.rotation.z = -R.tailA * (0.6 + i * 0.25) + Math.sin(R.t * 5 + i) * 0.04 * (1 + sp); });
  }
}
