// Look upgrade for the 3D game: post-processing pipeline (HDR + MSAA, bloom, sun light shafts, filmic
// tone mapping, colour grading, vignette, chromatic aberration, grain), floating motes, and the
// quality tiers (high / mid / low) with an automatic step-down on slow devices.
// Tuning in the browser console: window.FXT = { exposure, bloomK, thr, knee, sat, vig, ca, rim } (then g.setTier(...) or reload a level).
/* global THREE */

// ------------------------------------------------------------------ quality tiers
export const TIERS = {
  high: { post: true, samples: 4, bloom: 5, rays: true, fancy: true, shadow: 4096, pr: 2, motes: 160 },
  mid: { post: true, samples: 2, bloom: 4, rays: false, fancy: false, shadow: 2048, pr: 1.5, motes: 80 },
  low: { post: false, samples: 0, bloom: 0, rays: false, fancy: false, shadow: 1024, pr: 1, motes: 0 },
};
const ORDER = ['high', 'mid', 'low'];

// the player's choice in the settings menu: auto | high | mid | low
const QKEY = 'brasili-quality';
export function getQualitySetting() { try { const v = localStorage.getItem(QKEY); return v === 'auto' || TIERS[v] ? v : 'auto'; } catch { return 'auto'; } }
export function setQualitySetting(v) { try { localStorage.setItem(QKEY, v); } catch { /* storage unavailable */ } }

// ?q=high|mid|low in the address forces a tier for testing; then the setting; otherwise phones start on mid,
// desktops on high (both step down by themselves when the game runs slowly)
export function pickTier() {
  let forced = null;
  try { forced = new URLSearchParams(location.search).get('q'); } catch { /* no location */ }
  if (forced && TIERS[forced]) return { name: forced, auto: false };
  const saved = getQualitySetting();
  if (TIERS[saved]) return { name: saved, auto: false };
  const phone = matchMedia?.('(pointer: coarse)').matches;
  const weak = (navigator.hardwareConcurrency || 8) < 4 || (navigator.deviceMemory || 8) < 3;
  return { name: weak ? 'low' : phone ? 'mid' : 'high', auto: true };
}
export const lowerTier = name => ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(name) + 1)];

// steps down when the average frame takes longer than ~28 ms (< 36 fps) over two seconds
export class Governor {
  constructor(onSlow) { this.onSlow = onSlow; this.sum = 0; this.n = 0; this.skip = 45; }
  tick(dt) {
    if (this.skip > 0) { this.skip--; return; }
    this.sum += Math.min(dt, 0.25); this.n++;
    if (this.n >= 120) { const avg = this.sum / this.n; this.sum = 0; this.n = 0; if (avg > 0.028) this.onSlow(avg); }
  }
}

// ------------------------------------------------------------------ post-processing
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FRAG = {
  // brightness threshold + first downsample (soft knee)
  prefilter: `uniform sampler2D tex; uniform vec2 texel; uniform float thr; uniform float knee; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tex, vUv + texel * vec2(-1.0,-1.0)).rgb + texture2D(tex, vUv + texel * vec2(1.0,-1.0)).rgb
             + texture2D(tex, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(tex, vUv + texel * vec2(1.0, 1.0)).rgb;
      c *= 0.25;
      float br = max(c.r, max(c.g, c.b));
      float soft = clamp(br - thr + knee, 0.0, 2.0 * knee); soft = soft * soft / (4.0 * knee + 1e-4);
      c *= max(soft, br - thr) / max(br, 1e-4);
      gl_FragColor = vec4(c, 1.0);
    }`,
  down: `uniform sampler2D tex; uniform vec2 texel; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tex, vUv + texel * vec2(-1.0,-1.0)).rgb + texture2D(tex, vUv + texel * vec2(1.0,-1.0)).rgb
             + texture2D(tex, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(tex, vUv + texel * vec2(1.0, 1.0)).rgb;
      gl_FragColor = vec4(c * 0.25, 1.0);
    }`,
  up: `uniform sampler2D tex; uniform vec2 texel; uniform float k; varying vec2 vUv;
    vec3 s(float x, float y){ return texture2D(tex, vUv + texel * vec2(x, y)).rgb; }
    void main(){
      vec3 c = s(-1.,-1.) + 2.*s(0.,-1.) + s(1.,-1.) + 2.*s(-1.,0.) + 4.*s(0.,0.) + 2.*s(1.,0.) + s(-1.,1.) + 2.*s(0.,1.) + s(1.,1.);
      gl_FragColor = vec4(c / 16.0 * k, 1.0);
    }`,
  // only the very bright things (the sun disc) feed the light shafts
  raySrc: `uniform sampler2D tex; varying vec2 vUv; void main(){ vec3 c = texture2D(tex, vUv).rgb; gl_FragColor = vec4(max(c - 2.0, 0.0), 1.0); }`,
  composite: `uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tRay;
    uniform float bloomK; uniform float rayK; uniform vec2 sunUv; uniform float exposure; uniform float sat;
    uniform float vig; uniform float ca; uniform float grain; uniform float time; uniform float dusk; uniform float fancy; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    vec3 enc(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec3 col;
      if (fancy > 0.5) { vec2 o = d * r2 * ca; col = vec3(texture2D(tScene, vUv + o).r, texture2D(tScene, vUv).g, texture2D(tScene, vUv - o).b); }
      else col = texture2D(tScene, vUv).rgb;
      col += texture2D(tBloom, vUv).rgb * bloomK;
      if (rayK > 0.0) {
        vec2 dir = (sunUv - vUv) * (1.0 / 28.0); vec2 uv = vUv; float w = 1.0; vec3 acc = vec3(0.0);
        for (int i = 0; i < 28; i++) { uv += dir; acc += texture2D(tRay, uv).rgb * w; w *= 0.93; }
        col += acc * (1.0 / 28.0) * rayK * vec3(1.0, 0.86, 0.6);
      }
      col *= exposure;
      col = aces(col);
      col = enc(col);
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, sat);
      col += vec3(0.018, 0.004, 0.05) * (1.0 - l) * (1.0 - l);                 // violet shadows
      col *= mix(vec3(1.0), vec3(1.05, 1.0, 0.93), l * l);                    // warm highlights
      col = mix(col, col * vec3(1.12, 0.9, 0.92) + vec3(0.02, 0.0, 0.03), dusk * 0.35);
      col *= 1.0 - vig * smoothstep(0.12, 0.62, r2);
      float n = hash(vUv * 1000.0 + time);
      col += (n - 0.5) * (grain + 1.0 / 255.0);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Post {
  constructor(renderer, tier) {
    this.r = renderer; this.tier = tier;
    this.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad);
    const sm = (frag, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...extra });
    const T = () => ({ value: null }), V2 = () => ({ value: new THREE.Vector2() });
    this.m = {
      pre: sm(FRAG.prefilter, { tex: T(), texel: V2(), thr: { value: 1.0 }, knee: { value: 0.6 } }),
      down: sm(FRAG.down, { tex: T(), texel: V2() }),
      up: sm(FRAG.up, { tex: T(), texel: V2(), k: { value: 1 } }, { transparent: true, blending: THREE.AdditiveBlending }),
      raySrc: sm(FRAG.raySrc, { tex: T() }),
      comp: sm(FRAG.composite, { tScene: T(), tBloom: T(), tRay: T(), bloomK: { value: 0.5 }, rayK: { value: 0 }, sunUv: { value: new THREE.Vector2(0.7, 0.8) }, exposure: { value: 1.1 }, sat: { value: 1.12 }, vig: { value: 0.32 }, ca: { value: 0.012 }, grain: { value: 0.02 }, time: { value: 0 }, dusk: { value: 0 }, fancy: { value: 1 } }),
    };
    this.size = new THREE.Vector2(0, 0);
  }
  rt(w, h, samples = 0) {
    return new THREE.WebGLRenderTarget(Math.max(2, w), Math.max(2, h), { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: samples > 0, samples });
  }
  setSize(w, h) {
    if (this.size.x === w && this.size.y === h && this.scene) return;
    this.size.set(w, h); this.dispose(true);
    this.scene = this.rt(w, h, this.tier.samples);
    this.mips = [];
    for (let i = 1; i <= this.tier.bloom; i++) this.mips.push(this.rt(w >> i, h >> i));
    this.ray = this.tier.rays ? this.rt(w >> 2, h >> 2) : null;
  }
  setTier(tier) { this.tier = tier; this.size.set(0, 0); }
  pass(mat, target, clear = true) {
    const r = this.r; this.quad.material = mat;
    r.setRenderTarget(target); if (clear) r.clear();
    r.render(this.qs, this.qc);
  }
  // p: { time, dusk, sunUv: Vector2|null, rays, exposure }
  render(scene, camera, p) {
    const r = this.r, M = this.m, mips = this.mips, prevAuto = r.autoClear, prevTarget = r.getRenderTarget();
    r.autoClear = false;
    r.setRenderTarget(this.scene); r.clear(); r.render(scene, camera);
    // bloom: threshold + downsample chain, then additive upsample chain back to the biggest level
    M.pre.uniforms.tex.value = this.scene.texture; M.pre.uniforms.texel.value.set(1 / this.size.x, 1 / this.size.y);
    this.pass(M.pre, mips[0]);
    for (let i = 1; i < mips.length; i++) {
      M.down.uniforms.tex.value = mips[i - 1].texture; M.down.uniforms.texel.value.set(1 / mips[i - 1].width, 1 / mips[i - 1].height);
      this.pass(M.down, mips[i]);
    }
    for (let i = mips.length - 1; i > 0; i--) {
      M.up.uniforms.tex.value = mips[i].texture; M.up.uniforms.texel.value.set(1 / mips[i].width, 1 / mips[i].height); M.up.uniforms.k.value = 1;
      this.pass(M.up, mips[i - 1], false);
    }
    const rays = this.ray && p.sunUv && p.rays > 0;
    if (rays) { M.raySrc.uniforms.tex.value = this.scene.texture; this.pass(M.raySrc, this.ray); }
    const u = M.comp.uniforms;
    u.tScene.value = this.scene.texture; u.tBloom.value = mips[0].texture; u.tRay.value = this.ray ? this.ray.texture : mips[0].texture;
    const X = (typeof window !== 'undefined' && window.FXT) || {};
    u.bloomK.value = X.bloomK ?? (this.tier.fancy ? 0.32 : 0.26); u.sat.value = X.sat ?? 1.28; u.vig.value = X.vig ?? 0.32; M.pre.uniforms.thr.value = X.thr ?? 1.5; M.pre.uniforms.knee.value = X.knee ?? 0.6; u.rayK.value = rays ? p.rays : 0; if (p.sunUv) u.sunUv.value.copy(p.sunUv);
    u.exposure.value = (X.exposure ?? 1) * (p.exposure ?? 1.1); u.time.value = p.time % 100; u.dusk.value = p.dusk || 0;
    u.fancy.value = this.tier.fancy ? 1 : 0; u.grain.value = this.tier.fancy ? 0.02 : 0; u.ca.value = this.tier.fancy ? (X.ca ?? 0.005) : 0;
    this.pass(M.comp, null);
    r.setRenderTarget(prevTarget); r.autoClear = prevAuto;
  }
  dispose(keepMaterials) {
    this.scene?.dispose(); this.mips?.forEach(t => t.dispose()); this.ray?.dispose();
    this.scene = null; this.mips = []; this.ray = null;
    if (!keepMaterials) { Object.values(this.m).forEach(m => m.dispose()); this.quad.geometry.dispose(); }
  }
}

// ------------------------------------------------------------------ floating motes (pollen by day, fireflies at dusk)
export class Motes {
  constructor(n) {
    this.n = n;
    const g = new THREE.BufferGeometry(), seed = new Float32Array(n * 4), pos = new Float32Array(n * 3);
    for (let i = 0; i < n * 4; i++) seed[i] = Math.random();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    this.u = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uDay: { value: new THREE.Color(0xfff2b0) }, uNight: { value: new THREE.Color(0xc8ff9a) }, uDusk: { value: 0 } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec4 seed; uniform float uTime; uniform vec3 uCenter; varying float vA; varying float vS;
        void main(){
          vec3 box = vec3(44.0, 14.0, 26.0);
          vec3 p = seed.xyz * box + vec3(uTime * (0.12 + seed.w * 0.2), sin(uTime * 0.5 + seed.x * 40.0) * 0.7, cos(uTime * 0.37 + seed.y * 30.0) * 0.6);
          p = mod(p - uCenter + box * 0.5, box) - box * 0.5;
          vec4 mv = viewMatrix * vec4(uCenter + p + vec3(0.0, 2.0, 0.0), 1.0);
          gl_Position = projectionMatrix * mv;
          float edge = 1.0 - smoothstep(0.35, 0.5, length(p.xy / box.xy));
          vA = edge * (0.55 + 0.45 * sin(uTime * (1.2 + seed.w * 2.0) + seed.z * 20.0)); vS = seed.w;
          gl_PointSize = (1.2 + seed.w * 2.6) * (260.0 / max(1.0, -mv.z));
        }`,
      fragmentShader: `uniform vec3 uDay; uniform vec3 uNight; uniform float uDusk; varying float vA; varying float vS;
        void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; float a = pow(1.0 - r, 2.0) * vA * mix(0.5, 1.0, uDusk);
          gl_FragColor = vec4(mix(uDay, uNight, uDusk) * (1.0 + 1.5 * uDusk), a); }`,
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = 4;
  }
  update(t, center, dusk) { this.u.uTime.value = t; this.u.uCenter.value.copy(center); this.u.uDusk.value = dusk; }
  dispose() { this.points.geometry.dispose(); this.points.material.dispose(); }
}
