// Toon toolkit for the 3D version (uses the global THREE from three.min.js):
// cel-shaded materials, inked outlines (inverted hull), canvas textures, primitive builders.
/* global THREE */
export const INK = 0x1a1222;

// shared look parameters (the game updates them per frame / per world)
export const FX = { time: { value: 0 }, rimColor: { value: new THREE.Color(0xcfe2ff) }, rimK: { value: 0.42 }, wind: { value: 1 } };

// 4 light steps; the shadow steps are tinted violet/blue instead of plain grey
let gradient = null;
export function toonGradient() {
  if (gradient) return gradient;
  const data = new Uint8Array([
    104, 92, 150, 255,
    176, 168, 212, 255,
    232, 228, 244, 255,
    255, 255, 255, 255,
  ]);
  gradient = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}
// rim light (fresnel, stronger on upward faces) and optional wind sway for instanced grass
function enhance(m, sway) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uRimColor = FX.rimColor; sh.uniforms.uRimK = FX.rimK; sh.uniforms.uTime = FX.time; sh.uniforms.uWind = FX.wind;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor; uniform float uRimK;')
      .replace('#include <opaque_fragment>', `float rimF = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.4);
        outgoingLight += uRimColor * rimF * uRimK * (0.55 + 0.45 * clamp(normal.y * 0.5 + 0.5, 0.0, 1.0));
        #include <opaque_fragment>`);
    if (sway) {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float ph = instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 0.5;
          #else
            float ph = 0.0;
          #endif
          float lift = max(position.y, 0.0);
          transformed.x += (sin(uTime * 2.1 + ph) * 0.07 + sin(uTime * 0.9 + ph * 0.3) * 0.05) * lift * uWind;`);
    }
  };
  m.customProgramCacheKey = () => sway ? 'toon-rim-sway' : 'toon-rim';
}
const matCache = new Map();
export function toon(color, opts = {}) {
  const key = `${color}|${opts.map?.uuid || ''}|${opts.emissive || ''}|${opts.transparent ? 1 : 0}|${opts.sway ? 1 : 0}`;
  if (!opts.unique && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), map: opts.map || null, emissive: opts.emissive || 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 1, transparent: !!opts.transparent, side: opts.side ?? THREE.FrontSide });
  enhance(m, !!opts.sway);
  if (!opts.unique) matCache.set(key, m);
  return m;
}
const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
export const inkMaterial = () => inkMat;

function withOutline(geo, outlineGeo, mat, opts) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = opts.shadow !== false; m.receiveShadow = !!opts.receive;
  if (outlineGeo) { const o = new THREE.Mesh(outlineGeo, inkMat); o.raycast = () => {}; m.add(o); }
  return m;
}
// t = outline thickness in world units (0 = none)
export function box(w, h, d, mat, opts = {}) {
  const t = opts.outline ?? 0.05;
  return withOutline(new THREE.BoxGeometry(w, h, d), t ? new THREE.BoxGeometry(w + 2 * t, h + 2 * t, d + 2 * t) : null, mat, opts);
}
export function sphere(r, mat, opts = {}) {
  const t = opts.outline ?? 0.04, seg = opts.seg || 14;
  return withOutline(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), t ? new THREE.SphereGeometry(r + t, seg, Math.round(seg * 0.75)) : null, mat, opts);
}
export function capsule(r, len, mat, opts = {}) {
  const t = opts.outline ?? 0.035;
  return withOutline(new THREE.CapsuleGeometry(r, len, 4, 10), t ? new THREE.CapsuleGeometry(r + t, len, 4, 10) : null, mat, opts);
}
export function cylinder(rt, rb, h, mat, opts = {}) {
  const t = opts.outline ?? 0.04, seg = opts.seg || 12;
  return withOutline(new THREE.CylinderGeometry(rt, rb, h, seg), t ? new THREE.CylinderGeometry(rt + t, rb + t, h + 2 * t, seg) : null, mat, opts);
}
export function cone(r, h, mat, opts = {}) {
  const t = opts.outline ?? 0.05, seg = opts.seg || 12;
  return withOutline(new THREE.ConeGeometry(r, h, seg), t ? new THREE.ConeGeometry(r + t * 1.5, h + t * 2.5, seg) : null, mat, opts);
}

// box geometry with UVs in world units, so a repeating texture tiles seamlessly across many boxes
export function worldBox(x0, y0, z0, x1, y1, z1, uvScale = 1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    if (ny > 0.5) uv.setXY(i, x * uvScale, z * uvScale);
    else if (nx > 0.5) uv.setXY(i, z * uvScale, y * uvScale);
    else uv.setXY(i, x * uvScale, y * uvScale);
  }
  return g;
}
export function outlineBoxGeo(x0, y0, z0, x1, y1, z1, t = 0.05) {
  const g = new THREE.BoxGeometry(x1 - x0 + 2 * t, y1 - y0 + 2 * t, z1 - z0 + 2 * t);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}
// merge many (non-indexed or indexed) geometries into one (same attributes)
export function merge(geos) {
  const parts = geos.map(g => g.index ? g.toNonIndexed() : g);
  const names = Object.keys(parts[0].attributes);
  const out = new THREE.BufferGeometry();
  for (const n of names) {
    const size = parts[0].attributes[n].itemSize;
    const total = parts.reduce((s, g) => s + g.attributes[n].count, 0);
    const arr = new Float32Array(total * size); let off = 0;
    for (const g of parts) { arr.set(g.attributes[n].array, off); off += g.attributes[n].array.length; }
    out.setAttribute(n, new THREE.BufferAttribute(arr, size));
  }
  return out;
}

export function canvasTexture(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}
export const hex = s => typeof s === 'number' ? s : parseInt(String(s).replace('#', ''), 16);
export function shadeHex(h, f) {
  const c = new THREE.Color(hex(h));
  if (f < 0) c.multiplyScalar(1 + f); else c.lerp(new THREE.Color(1, 1, 1), f);
  return c.getHex();
}
// soft round glow sprite (additive)
let glowTex = null;
export function glowSprite(color, size, opacity = 0.8) {
  glowTex ||= canvasTexture(128, 128, (ctx) => { const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.set(size, size, 1);
  return s;
}
// text on a plane (signs, banners, sticker cards)
export function textTexture(w, h, draw) { return canvasTexture(w, h, draw); }
