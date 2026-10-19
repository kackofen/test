// BRASILI – the pixel renderer. Rules and physics live in sim.js (shared with the 3D version);
// this file draws the 16-bit look and turns game events into comic effects.
import { TILE, ROWS, T, isSolid, LIVES } from '../shared/levelgen.js';
import { SCORE } from '../shared/scoring.js';
import { Sim, FIXED, pickKits, shortName } from './sim.js';
import { makeCanvas, shade, px, OUTLINE } from './pixel.js';
import { footballerSheet, itemSprite, ballSprite, stickerSprite, shieldSprite, springSprite, HAIR_STYLES, SKINS, HAIRS } from './sprites.js';
import { buildTheme, makeBannerTile, animalSprite, propSprite, LAYER_W } from './themes.js';
import { Bursts } from './bursts.js';

export { pickKits, shortName };
export const VIEW_W = 384, VIEW_H = 216;
const CAM_Y = ROWS * TILE - VIEW_H; // 8

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyX: 'jump', KeyK: 'jump',
  ShiftLeft: 'run', ShiftRight: 'run', KeyZ: 'run', KeyJ: 'run',
  Escape: 'pause', KeyP: 'pause', Enter: 'confirm',
};

export class Game {
  // opts: { match, teams, squads, playerSide, look, lives?, callbacks: { onPause, onLifeLost, onGameOver, onFinish, onCheckpoint } }
  constructor(canvas, overlay, opts) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
    this.overlay = overlay;
    this.o = opts;
    this.cb = opts.callbacks || {};
    this.sim = new Sim({ match: opts.match, teams: opts.teams, squads: opts.squads, playerSide: opts.playerSide, lives: opts.lives ?? LIVES, finale: 'header' });
    this.L = this.sim.L;
    this.setup();
    this.wire();
  }

  // live views on the simulation (respawns replace some of these objects)
  get player() { return this.sim.player; }
  get items() { return this.sim.items; }
  get stickers() { return this.sim.stickers; }
  get shields() { return this.sim.shields; }
  get springs() { return this.sim.springs; }
  get movers() { return this.sim.movers; }
  get enemies() { return this.sim.enemies; }
  get finale() { return this.sim.finale; }
  get count() { return this.sim.count; }
  get half() { return this.sim.half; }
  get clock() { return this.sim.clock; }
  get state() { return this.sim.state; }
  get frame() { return this.sim.frame; }
  get lives() { return this.sim.lives; }
  get keys() { return this.sim.keys; }
  get pressed() { return this.sim.pressed; }
  get paused() { return this.sim.paused; }
  set paused(v) { this.sim.paused = !!v; }
  resume() { this.sim.paused = false; }

  // ------------------------------------------------------------------ setup
  setup() {
    const { teams, look } = this.o, sim = this.sim;
    this.side = sim.side; this.oppSide = sim.oppSide;
    this.halfTeam = sim.halfTeam;
    this.themes = [buildTheme(teams.home), buildTheme(teams.away)];
    const kits = this.kits = sim.kits;
    this.playerSheet = footballerSheet(look, kits.me, { stripes: teams[this.side].code === 'ARG' ? '#ffffff' : null });
    const opp = teams[this.oppSide];
    this.defSheets = [0, 1, 2, 3].map(i => footballerSheet({
      hairStyle: HAIR_STYLES[(i * 3 + 1) % HAIR_STYLES.length], hair: HAIRS[(i * 2 + 1) % HAIRS.length],
      skin: SKINS[(i * 2 + 3) % SKINS.length], boots: i % 2 ? '#1b1b1b' : '#f5f5f5',
    }, kits.opp, { stripes: opp.code === 'ARG' && kits.opp === opp.kit ? '#ffffff' : null }));
    this.gkSheet = footballerSheet({ hairStyle: 'bun', hair: '#2a1a12', skin: SKINS[1], boots: '#111' }, kits.gk, { gk: true, gloves: '#f2f2f2' });
    this.keeper = sim.keeper;
    this.bannerNames = sim.bannerNames;

    // sprites
    this.itemSprites = [itemSprite(this.themes[0].item), itemSprite(this.themes[1].item)];
    this.stickerSprites = [0, 1].map(h => [0, 2, 4, 6, 8].map(sh => stickerSprite(this.halfTeam[h].kit, sh)));
    this.shieldSprite = shieldSprite(kits.me);
    this.springSprites = [0, 1].map(h => [springSprite(this.halfTeam[h].kit, 0), springSprite(this.halfTeam[h].kit, 1)]);
    this.bannerTiles = [makeBannerTile(this.halfTeam[0].kit), makeBannerTile(this.halfTeam[1].kit)];
    this.ball = ballSprite();
    this.animals = this.themes.map(t => t.animal ? { sprite: animalSprite(t.animal), mode: t.animalMode } : null);
    this.propSprites = {};
    for (const t of this.themes) for (const p of t.props) this.propSprites[p] = this.propSprites[p] || propSprite(p);
    this.pitchTile = this.makePitchTile();
    this.pitchFill = this.makePitchTile(true);
    this.crowd = this.makeCrowd(teams);
    this.halftimeArch = this.makeArch();
    this.coolingSprites = [0, 1].map(h => this.makeCoolingStation(this.halfTeam[h].kit));

    this.camX = 0; this.snapCamera();
    this.particles = [];
    this.bursts = new Bursts(this.overlay);
  }

  // game events -> comic effects and app callbacks
  wire() {
    const s = this.sim, B = () => this.bursts;
    s.on('jump', e => this.puff(e.x, e.y, 3));
    s.on('land', e => this.puff(e.x, e.y, 2));
    s.on('bonk', e => this.bonk(e.tx, e.ty));
    s.on('item', e => this.sparkle(e.item.x * TILE, e.item.y * TILE, '#ffe28a'));
    s.on('sticker', e => {
      const st = e.sticker;
      this.sparkle(st.x * TILE, st.y * TILE, '#ffffff', 14);
      B().name(st.x * TILE, st.y * TILE - 6, `#${e.person.no} ${e.person.short}!`, e.team.kit.shirt, 'big');
      if (e.complete) setTimeout(() => B().banner(`FULL SQUAD ${e.team.code}! +${SCORE.SQUAD_BONUS}`, e.team.kit.shirt, 1.6), 700);
    });
    s.on('shield', e => { this.sparkle(e.shield.x * TILE, e.shield.y * TILE, '#9fe3ff', 10); this.burstSmall(e.shield.x * TILE, e.shield.y * TILE - 8, 'SHIN GUARD!', '#9fe3ff'); });
    s.on('shieldUsed', e => this.burstSmall(e.x, e.y - 4, 'SAVED BY THE GUARD!', '#9fe3ff'));
    s.on('dribble', e => B().name(e.enemy.x + 5, e.enemy.y - 6, `NUTMEG ${e.enemy.person.short}!`, this.kits.opp.shirt, 'small'));
    s.on('spring', e => this.burstSmall(e.x, e.y, 'BOING!', '#ffd23f'));
    s.on('death', e => B().banner(e.reason === 'time' ? 'TIME UP!' : e.reason === 'pit' ? 'OUT OF PLAY!' : 'FOUL!', '#ff5252', 1.4));
    s.on('checkpoint', e => {
      const ht = e.kind === 'halftime';
      B().banner(ht ? 'HALF-TIME!' : 'COOLING BREAK!', ht ? this.halfTeam[0].kit.shirt : '#3a86ff', ht ? 1.6 : 1.0);
      this.sparkle(this.player.x + 5, this.player.y + 4, '#9fe3ff', 16);
      this.burstSmall(this.player.x + 5, this.player.y - 10, 'CHECKPOINT!', '#ffffff');
      this.cb.onCheckpoint?.(e);
    });
    s.on('resume', e => { if (e.kind === 'halftime') B().banner('2ND HALF!', this.halfTeam[1].kit.shirt, 1.0); else B().banner('PLAY ON!', '#3a86ff', 0.8); });
    s.on('respawn', e => {
      this.snapCamera(); this.particles = [];
      B().banner(e.checkpoint === 'kickoff' ? 'KICK-OFF AGAIN!' : e.checkpoint === 'halftime' ? 'BACK FROM HALF-TIME!' : 'BACK AT THE COOLING BREAK!', '#ffd23f', 1.3);
      this.burstSmall(this.player.x + 5, this.player.y - 6, e.lives === 1 ? 'LAST LIFE!' : `${e.lives} LIVES LEFT`, '#ff4d6d');
    });
    s.on('finale', () => B().banner('HEADER TIME!', '#ffd23f', 1.2));
    s.on('cross', e => this.burstSmall(e.target + 120, 40, 'CROSS!', '#ffffff'));
    s.on('header', e => { B().meter(e.x, e.y - 10, e.power); this.sparkle(e.x, e.y, '#ffffff', 10); });
    s.on('goal', () => {
      B().banner('GOAL!!!', '#ffd23f', 2.6, true);
      for (let i = 0; i < 60; i++) this.particles.push({ x: this.L.finale.goalX * TILE, y: 150, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4 - 1, life: 1.8, col: [this.kits.me.shirt, '#ffd23f', '#ffffff'][i % 3], size: 2, g: 0.08 });
    });
    s.on('miss', e => B().banner(e.text, '#ff5252', 2.2));
    s.on('pause', e => this.cb.onPause?.(e.paused));
    s.on('lifelost', e => this.cb.onLifeLost?.(e));
    s.on('gameover', e => this.cb.onGameOver?.(e));
    s.on('finish', r => this.cb.onFinish?.(r));
  }
  snapCamera() {
    const p = this.player;
    let x = p.x - VIEW_W * 0.38;
    if (this.half === 1) x = Math.max(x, this.L.checkpointCol * TILE - 80);
    this.camX = Math.max(0, Math.min(this.L.cols * TILE - VIEW_W, x));
  }

  makePitchTile(fill) {
    const [c, ctx] = makeCanvas(16, 16);
    if (fill) { px(ctx, 0, 0, '#2f6f33', 16, 16); for (let i = 0; i < 6; i++) px(ctx, (i * 7) % 16, (i * 5) % 16, '#285f2c', 2, 1); return c; }
    px(ctx, 0, 0, '#3f9a3e', 16, 16); px(ctx, 0, 0, '#6cc25d', 16, 1); px(ctx, 0, 3, '#358a35', 16, 1);
    px(ctx, 0, 4, '#2f6f33', 16, 12); for (let i = 0; i < 6; i++) px(ctx, (i * 7) % 16, 6 + (i * 3) % 9, '#285f2c', 2, 1);
    return c;
  }
  makeCrowd(teams) {
    // stadium stand: roof, upper tier, concourse, lower tier, advertising boards
    const W = 600, H = 112;
    const [c, ctx] = makeCanvas(W, H);
    let seed = 11; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const ca = [teams.home.kit.shirt, teams.home.kit.shorts], cb = [teams.away.kit.shirt, teams.away.kit.shorts];
    const skin = ['#e7c3a0', '#c99a72', '#8a5a3a', '#5e3a22'];
    const tier = (y0, y1, dark) => {
      px(ctx, 0, y0, dark, W, y1 - y0);
      for (let y = y0 + 2; y < y1 - 1; y += 3) {
        px(ctx, 0, y + 2, shade(dark, -0.25), W, 1);
        for (let x = (y % 2) * 2; x < W; x += 3) {
          if (r() < 0.12) continue;
          const cols = x < W / 2 ? ca : cb;
          px(ctx, x, y, skin[Math.floor(r() * skin.length)], 2, 1);
          px(ctx, x, y + 1, r() < 0.8 ? cols[Math.floor(r() * cols.length)] : '#d9d9d9', 2, 1);
        }
      }
    };
    px(ctx, 0, 0, '#1b1f2a', W, 8); px(ctx, 0, 8, '#3a4152', W, 2);                  // roof
    for (let x = 20; x < W; x += 46) px(ctx, x, 10, '#2a2f3c', 2, 22);                 // roof pillars
    tier(12, 40, '#2a2f3c');
    px(ctx, 0, 40, '#151821', W, 8); for (let x = 8; x < W; x += 16) px(ctx, x, 42, '#f6e7a1', 3, 2); // concourse
    tier(48, 96, '#323848');
    px(ctx, 0, 96, '#f2f2f2', W, 2);
    for (let x = 0; x < W; x += 50) { px(ctx, x, 98, ['#1e6fd6', '#ffd23f', '#e63946', '#2a9d8f'][(x / 50) % 4], 50, 14); px(ctx, x + 6, 103, '#ffffff', 20, 3); }
    for (const lx of [60, W / 2 - 4, W - 70]) { px(ctx, lx, 0, '#7d8597', 12, 5); for (let i = 0; i < 5; i++) px(ctx, lx + 1 + i * 2, 1, '#fff7c2', 1, 3); }
    return c;
  }
  makeArch() {
    const [c, ctx] = makeCanvas(72, 64);
    const k = this.halfTeam[1].kit, k0 = this.halfTeam[0].kit;
    px(ctx, 2, 14, k0.shirt, 10, 50); px(ctx, 2, 14, shade(k0.shirt, 0.2), 2, 50); px(ctx, 60, 14, k.shirt, 10, 50); px(ctx, 68, 14, shade(k.shirt, -0.25), 2, 50);
    for (let y = 20; y < 64; y += 8) { px(ctx, 2, y, shade(k0.shirt, -0.25), 10, 1); px(ctx, 60, y, shade(k.shirt, -0.25), 10, 1); }
    px(ctx, 0, 0, '#1d2433', 72, 16); px(ctx, 0, 0, '#ffd23f', 72, 2); px(ctx, 0, 14, '#ffd23f', 72, 2);
    return c;
  }

  makeCoolingStation(kit) {
    // pop-up gazebo in the team colours, drinks table, cooler box, sign
    const W = 84, H = 60;
    const [c, ctx] = makeCanvas(W, H);
    const k = kit.shirt, dark = shade(k, -0.3);
    for (const x of [8, 74]) { px(ctx, x, 12, OUTLINE, 3, 48); px(ctx, x + 1, 12, '#d9d9d9', 1, 47); }
    // canopy: striped valance
    px(ctx, 2, 2, OUTLINE, 80, 12);
    for (let x = 3; x < 81; x += 6) { px(ctx, x, 3, k, 3, 10); px(ctx, x + 3, 3, '#ffffff', 3, 10); }
    px(ctx, 3, 3, shade(k, 0.25), 78, 1); px(ctx, 3, 12, dark, 78, 1);
    for (let x = 3; x < 81; x += 6) { px(ctx, x, 13, k, 3, 2); px(ctx, x + 3, 13, '#ffffff', 3, 2); }
    // sign under the roof
    px(ctx, 16, 17, OUTLINE, 52, 13); px(ctx, 17, 18, '#3a86ff', 50, 11); px(ctx, 17, 18, '#6aa6ff', 50, 1);
    ctx.font = '6px "Press Start 2P"'; ctx.textBaseline = 'top'; ctx.fillStyle = '#ffffff';
    ctx.fillText('COOLING', 21, 19); ctx.fillText('BREAK', 27, 25);
    // table with water bottles and cups
    px(ctx, 14, 42, OUTLINE, 44, 4); px(ctx, 15, 43, '#f2f2f2', 42, 2);
    for (const x of [18, 52]) px(ctx, x, 46, '#7d8597', 2, 14);
    for (let i = 0; i < 6; i++) {
      const x = 17 + i * 6, col = i % 2 ? '#3a86ff' : '#9fe3ff';
      px(ctx, x, 34, OUTLINE, 5, 9); px(ctx, x + 1, 35, col, 3, 7); px(ctx, x + 1, 33, '#ffffff', 3, 2); px(ctx, x + 1, 36, '#ffffff', 1, 3);
    }
    // cooler box with a tap
    px(ctx, 60, 44, OUTLINE, 14, 16); px(ctx, 61, 45, '#2f9e44', 12, 14); px(ctx, 61, 45, '#51cf66', 12, 2); px(ctx, 61, 51, '#ffffff', 12, 1); px(ctx, 65, 40, OUTLINE, 5, 4);
    return c;
  }

  // ------------------------------------------------------------------ input
  bindInput() {
    this.onKey = e => {
      const k = KEYMAP[e.code];
      if (!k) return;
      e.preventDefault();
      const keys = this.sim.keys;
      if (e.type === 'keydown') { if (!keys[k]) this.sim.pressed[k] = true; keys[k] = true; }
      else keys[k] = false;
    };
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    this.onBlur = () => { this.sim.keys = {}; if (['play', 'finale'].includes(this.sim.state) && !this.sim.paused) { this.sim.paused = true; this.cb.onPause?.(true); } };
    window.addEventListener('blur', this.onBlur);
  }
  pollGamepad() {
    const gp = navigator.getGamepads?.()[0];
    if (!gp) return;
    const S = this.sim;
    const set = (k, v) => { if (v && !this.gpPrev?.[k]) S.pressed[k] = true; if (v || this.gpPrev?.[k]) S.keys[k] = !!v; (this.gpPrev ||= {})[k] = v; };
    const ax = gp.axes[0] || 0;
    set('left', ax < -0.4 || gp.buttons[14]?.pressed);
    set('right', ax > 0.4 || gp.buttons[15]?.pressed);
    set('jump', gp.buttons[0]?.pressed);
    set('run', gp.buttons[2]?.pressed || gp.buttons[1]?.pressed);
    set('pause', gp.buttons[9]?.pressed);
  }

  // ------------------------------------------------------------------ loop
  start() {
    this.bindInput();
    this.running = true;
    let last = performance.now(), acc = 0;
    const tick = now => {
      if (!this.running) return;
      acc += Math.min(0.1, (now - last) / 1000); last = now;
      this.pollGamepad();
      while (acc >= FIXED) { this.update(); acc -= FIXED; }
      this.render();
      this.bursts.render(this.camX, this.viewScale());
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    this.bursts.banner('KICK-OFF!', this.halfTeam[0].kit.shirt, 1.2);
  }
  stop() {
    this.running = false; cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey); window.removeEventListener('blur', this.onBlur);
    this.bursts.clear();
  }
  viewScale() { const r = this.canvas.getBoundingClientRect(); return { s: r.width / VIEW_W, w: r.width, h: r.height }; }

  // one fixed step: rules in the simulation, camera and particles here
  update() {
    this.sim.step();
    if (this.sim.paused) return;
    const L = this.L, p = this.player;
    let target = p.x - VIEW_W * 0.38 + p.vx * 18;
    if (this.finale) target = L.finale.crossTargetX * TILE - 130;
    if (this.half === 1) target = Math.max(target, L.checkpointCol * TILE - 80);
    this.camX += (target - this.camX) * 0.12;
    this.camX = Math.max(0, Math.min(L.cols * TILE - VIEW_W, this.camX));
    for (const pt of this.particles) { pt.x += pt.vx; pt.y += pt.vy; pt.vy += pt.g ?? 0.05; pt.life -= FIXED; }
    this.particles = this.particles.filter(q => q.life > 0);
  }
  bonk(tx, ty) { for (let i = 0; i < 4; i++) this.particles.push({ x: tx * TILE + 8, y: ty * TILE + 16, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 1.5, life: 0.4, col: '#ffffff', size: 1 }); }
  result() { return this.sim.result(); }

  // ------------------------------------------------------------------ effects
  puff(x, y, n) { for (let i = 0; i < n; i++) this.particles.push({ x, y, vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * 0.6, life: 0.35, col: '#e8e2d4', size: 2, g: 0 }); }
  sparkle(x, y, col, n = 7) { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; this.particles.push({ x, y, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.6, life: 0.45, col, size: 2, g: 0 }); } }
  burstSmall(x, y, text, col) { this.bursts.name(x, y, text, col, 'tiny'); }

  // ------------------------------------------------------------------ rendering
  themeBlend() {
    const cx = this.camX + VIEW_W / 2, cp = this.L.checkpointCol * TILE;
    const t = (cx - (cp - 120)) / 240;
    return Math.max(0, Math.min(1, t));
  }
  drawLayer(ctx, img, factor) {
    const x = -Math.floor((this.camX * factor) % LAYER_W);
    ctx.drawImage(img, x, -CAM_Y); ctx.drawImage(img, x + LAYER_W, -CAM_Y);
  }
  render(target) {
    const ctx = target || this.ctx;
    const L = this.L, cam = Math.round(this.camX);
    const blend = this.themeBlend();
    const drawBg = (th, alpha) => {
      if (alpha <= 0) return;
      ctx.globalAlpha = alpha;
      ctx.drawImage(th.sky, 0, -CAM_Y);
      this.drawLayer(ctx, th.far, 0.12); this.drawLayer(ctx, th.mid, 0.32);
      ctx.globalAlpha = 1;
    };
    drawBg(this.themes[0], 1);
    if (blend > 0) drawBg(this.themes[1], blend);
    // stadium crowd in the finale area (parallax 0.5)
    const fX = L.finale.start * TILE;
    const crowdX = Math.round(((fX - 40) - cam) * 0.6 - 90);
    const nearFade = 1 - Math.max(0, Math.min(1, (cam - (fX - 420)) / 200));
    if (crowdX < VIEW_W) ctx.drawImage(this.crowd, crowdX, 184 - this.crowd.height);
    // ambient animals (mid plane)
    this.drawAnimals(ctx, cam);
    if (nearFade > 0) {
      ctx.globalAlpha = (1 - blend) * nearFade; this.drawLayer(ctx, this.themes[0].near, 0.62);
      ctx.globalAlpha = blend * nearFade; if (blend > 0) this.drawLayer(ctx, this.themes[1].near, 0.62); ctx.globalAlpha = 1;
    }

    ctx.save(); ctx.translate(-cam, -CAM_Y);
    this.drawDecor(ctx, cam);
    this.drawTiles(ctx, cam);
    // movers
    for (const m of this.movers) { const th = this.themes[m.half]; for (let i = 0; i < m.w; i++) ctx.drawImage(th.ledge, Math.round(m.px) + i * TILE, m.y * TILE); }
    // springs
    for (const s of this.springs) { if (s.x * TILE < cam - 20 || s.x * TILE > cam + VIEW_W + 20) continue; ctx.drawImage(this.springSprites[s.half][s.squash > 0.3 ? 1 : 0], s.x * TILE - 1, s.y * TILE - 12); }
    // collectibles
    const bob = Math.sin(this.frame * 0.08) * 1.5;
    for (const it of this.items) if (!it.got && it.x * TILE > cam - 16 && it.x * TILE < cam + VIEW_W + 16) ctx.drawImage(this.itemSprites[it.half], Math.round(it.x * TILE - 7), Math.round(it.y * TILE - 7 + bob));
    for (const s of this.stickers) if (!s.got && s.x * TILE > cam - 16 && s.x * TILE < cam + VIEW_W + 16) {
      const shine = Math.floor(this.frame / 6 + s.idx * 3) % 20; const spr = this.stickerSprites[s.half][Math.min(4, Math.max(0, shine - 15))];
      ctx.drawImage(spr, Math.round(s.x * TILE - 8), Math.round(s.y * TILE - 10 + bob * 1.4));
      if (this.frame % 30 < 15) px(ctx, s.x * TILE + 7, s.y * TILE - 11 + bob, '#ffffff', 1, 1);
    }
    for (const s of this.shields) if (!s.got) ctx.drawImage(this.shieldSprite, Math.round(s.x * TILE - 6), Math.round(s.y * TILE - 7 + bob));
    this.drawHalftimeArch(ctx);
    this.drawGoal(ctx, 'back');
    // enemies
    for (const e of this.enemies) {
      if (e.dead || e.x < cam - 30 || e.x > cam + VIEW_W + 30) continue;
      const pose = !e.onGround ? 'jump' : ['run1', 'run2', 'run3', 'run4'][Math.floor(e.anim) % 4];
      ctx.drawImage(this.defSheets[e.variant % this.defSheets.length][e.vx >= 0 ? 'right' : 'left'][pose], Math.round(e.x - 5), Math.round(e.y - 2));
    }
    // keeper
    if (this.finale || cam + VIEW_W > L.finale.goalX * TILE - 60) {
      const kx = this.finale ? this.finale.keeperX : L.finale.goalX * TILE - 12;
      const pose = this.finale?.keeperPose || 'stand';
      const spr = this.gkSheet.left[pose === 'dive' ? 'dive' : (this.frame % 40 < 20 ? 'stand' : 'run4')];
      ctx.drawImage(spr, Math.round(kx - 5), 12 * TILE - 26 - (pose === 'dive' ? 6 : 0));
    }
    // player
    const p = this.player;
    if (!(p.invuln > 0 && this.frame % 6 < 3)) {
      const spr = this.playerSheet[p.facing >= 0 ? 'right' : 'left'][p.pose];
      ctx.drawImage(spr, Math.round(p.x - 5), Math.round(p.y - 2));
      if (p.shield) { ctx.globalAlpha = 0.35 + Math.sin(this.frame * 0.2) * 0.15; ctx.strokeStyle = '#9fe3ff'; ctx.lineWidth = 1; ctx.strokeRect(Math.round(p.x - 3) + 0.5, Math.round(p.y - 3) + 0.5, p.w + 6, p.h + 5); ctx.globalAlpha = 1; }
    }
    // ball (+ shadow and landing marker for the cross)
    if (this.finale) {
      const f = this.finale, tx = L.finale.crossTargetX * TILE + 4, gy = 12 * TILE;
      if (!f.hit && !f.done) { const a = 0.5 + Math.sin(this.frame * 0.25) * 0.3; ctx.globalAlpha = a; px(ctx, tx - 6, gy - 1, '#ffd23f', 13, 1); px(ctx, tx, gy - 4, '#ffd23f', 1, 3); ctx.globalAlpha = 1; }
      if (f.ball) { const b = f.ball; const d = Math.max(0, Math.min(1, (gy - b.y) / 160));
        ctx.globalAlpha = 0.35; px(ctx, b.x - 4 + d * 2, gy - 1, '#000000', 8 - d * 4, 1); ctx.globalAlpha = 1;
        ctx.drawImage(this.ball, Math.round(b.x - 5), Math.round(b.y - 5)); }
    }
    this.drawGoal(ctx, 'front');
    // particles
    for (const pt of this.particles) { ctx.globalAlpha = Math.min(1, pt.life * 3); px(ctx, pt.x, pt.y, pt.col, pt.size, pt.size); }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (!target) this.drawHud(ctx);
  }

  drawAnimals(ctx, cam) {
    for (let h = 0; h < 2; h++) {
      const a = this.animals[h]; if (!a) continue;
      const half = this.L.halves[h];
      // one animal crossing the scenery per ~600px, moving slowly
      for (let base = half.from * TILE + 200; base < half.to * TILE; base += 620) {
        const t = this.frame * (a.mode === 'drive' ? 0.6 : a.mode === 'hop' ? 0.45 : 0.25);
        const wx = base + ((t + base * 0.37) % 300) - 150;
        const sx = Math.round(wx - cam * 1);
        if (sx < -40 || sx > VIEW_W + 40) continue;
        const hop = a.mode === 'hop' ? Math.abs(Math.sin(t * 0.06)) * 10 : 0;
        const y = (a.mode === 'far' ? 150 : 172) - a.sprite.height / 2 - hop - CAM_Y + (a.mode === 'far' ? 0 : 8);
        ctx.drawImage(a.sprite, sx, Math.round(y));
      }
    }
  }

  drawDecor(ctx, cam) {
    // fan banners with player names (world space, behind the action)
    for (const b of this.bannerNames) {
      const x = b.x * TILE; if (x < cam - 120 || x > cam + VIEW_W + 40) continue;
      const gy = this.L.groundTop[b.x] * TILE, team = this.halfTeam[b.half];
      const w = Math.max(56, b.text.length * 6 + 10);
      px(ctx, x, gy - 40, '#6b6f7a', 2, 40); px(ctx, x + w - 2, gy - 40, '#6b6f7a', 2, 40);
      px(ctx, x + 1, gy - 40, team.kit.shirt, w - 2, 14); px(ctx, x + 1, gy - 28, shade(team.kit.shirt, -0.3), w - 2, 2);
      ctx.fillStyle = OUTLINE; ctx.fillRect(x, gy - 41, w, 1);
      ctx.font = '6px "Press Start 2P"'; ctx.textBaseline = 'top';
      const txtCol = luma(team.kit.shirt) > 0.6 ? '#1a1222' : '#ffffff';
      ctx.fillStyle = txtCol; ctx.fillText(b.text, x + 5, gy - 36);
    }
    this.drawCooling(ctx, cam);
    for (const d of this.L.decor) {
      if (d.kind !== 'prop') continue;
      const x = d.x * TILE; if (x < cam - 30 || x > cam + VIEW_W + 30) continue;
      const th = this.themes[d.half]; const kind = th.props[(d.x * 7) % th.props.length]; const spr = this.propSprites[kind];
      if (spr) ctx.drawImage(spr, x - 4, d.y * TILE - 30);
    }
  }

  drawCooling(ctx, cam) {
    this.L.checkpoints.forEach((cp, i) => {
      const x = cp.col * TILE, gy = cp.y * TILE;
      if (x < cam - 80 || x > cam + VIEW_W + 80) return;
      const reached = this.sim.cpReached > i;
      if (cp.kind === 'cooling') ctx.drawImage(this.coolingSprites[cp.half], x - 34, gy - 60);
      // checkpoint flag: grey and low until reached, then up in the team colour with a tick
      const fx = cp.kind === 'cooling' ? x + 52 : x + 48, col = reached ? this.halfTeam[cp.kind === 'halftime' ? 1 : cp.half].kit.shirt : '#7d8597';
      px(ctx, fx, gy - 44, OUTLINE, 3, 44); px(ctx, fx + 1, gy - 43, '#e8e8e8', 1, 43); px(ctx, fx - 1, gy - 46, '#ffd23f', 5, 3);
      const fy = reached ? gy - 42 : gy - 18, wave = reached ? Math.round(Math.sin(this.frame * 0.15) * 1) : 0;
      px(ctx, fx + 3, fy, OUTLINE, 16, 11); px(ctx, fx + 3, fy + 1, col, 15, 9 + wave); px(ctx, fx + 3, fy + 1, shade(col, 0.25), 15, 1);
      if (reached) { const tc = luma(col) > 0.6 ? OUTLINE : '#ffffff'; px(ctx, fx + 7, fy + 5, tc, 2, 2); px(ctx, fx + 9, fy + 6, tc, 2, 2); px(ctx, fx + 11, fy + 4, tc, 2, 2); px(ctx, fx + 13, fy + 2, tc, 2, 2); }
    });
  }

  drawTiles(ctx, cam) {
    const L = this.L;
    const x0 = Math.max(0, Math.floor(cam / TILE) - 1), x1 = Math.min(L.cols - 1, Math.ceil((cam + VIEW_W) / TILE) + 1);
    const fStart = L.finale.start - 6;
    for (let x = x0; x <= x1; x++) {
      const th = this.themes[x < L.checkpointCol ? 0 : 1];
      const halfIdx = x < L.checkpointCol ? 0 : 1;
      for (let y = 0; y < ROWS; y++) {
        const t = L.tiles[y * L.cols + x];
        if (!t) continue;
        const X = x * TILE, Y = y * TILE;
        if (t === T.GROUND) {
          const above = y > 0 ? L.tiles[(y - 1) * L.cols + x] : 0;
          if (x >= fStart) ctx.drawImage(above === T.GROUND ? this.pitchFill : this.pitchTile, X, Y);
          else ctx.drawImage(above === T.GROUND ? th.groundFill[(x + y) % 2] : th.groundTop[(x * 7 + y) % 3], X, Y);
          if (x > 0 && L.tiles[y * L.cols + x - 1] !== T.GROUND) px(ctx, X, Y, th.edge, 1, TILE);
          if (x < L.cols - 1 && L.tiles[y * L.cols + x + 1] !== T.GROUND) px(ctx, X + 15, Y, th.edge, 1, TILE);
          if (above !== T.GROUND) px(ctx, X, Y - 1, OUTLINE, TILE, 1);
        } else if (t === T.BLOCK) {
          ctx.drawImage(th.block, X, Y);
          ctx.fillStyle = OUTLINE;
          if (!isSolid(L.get(x, y - 1))) ctx.fillRect(X, Y - 1, TILE, 1);
          if (!isSolid(L.get(x - 1, y))) ctx.fillRect(X - 1, Y, 1, TILE);
          if (!isSolid(L.get(x + 1, y))) ctx.fillRect(X + TILE, Y, 1, TILE);
          if (!isSolid(L.get(x, y + 1))) ctx.fillRect(X, Y + TILE, TILE, 1);
        } else if (t === T.LEDGE) ctx.drawImage(th.ledge, X, Y);
        else if (t === T.BANNER) ctx.drawImage(this.bannerTiles[halfIdx], X, Y);
      }
    }
    // pitch markings in the finale
    const F = L.finale;
    if (cam + VIEW_W > F.start * TILE - 100) {
      px(ctx, (F.goalX - 11) * TILE, 12 * TILE, '#ffffff', 2, 2);
      px(ctx, (F.goalX - 11) * TILE, 12 * TILE, '#ffffff', 11 * TILE, 1);
      px(ctx, (F.crossTargetX) * TILE + 3, 12 * TILE + 1, '#ffffff', 3, 1); // penalty spot
    }
  }

  drawHalftimeArch(ctx) {
    const x = this.L.checkpointCol * TILE - 30, gy = this.L.groundTop[this.L.checkpointCol] * TILE;
    ctx.drawImage(this.halftimeArch, x, gy - 64);
    ctx.font = '8px "Press Start 2P"'; ctx.textBaseline = 'top'; ctx.fillStyle = '#ffffff';
    ctx.fillText('HALF-TIME', x + 1, gy - 60);
  }
  drawGoal(ctx, layer) {
    const g = this.L.finale.goalX * TILE, top = 12 * TILE - 46, bottom = 12 * TILE;
    if (layer === 'back') {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let x = g + 2; x < g + 26; x += 3) ctx.fillRect(x, top + (x - g) * 0.15, 1, bottom - top);
      for (let y = top + 2; y < bottom; y += 3) ctx.fillRect(g + 2, y, 24, 1);
      px(ctx, g + 24, top + 4, '#d9d9d9', 2, bottom - top - 4);
      px(ctx, g, top, '#d9d9d9', 26, 2);
    } else {
      px(ctx, g - 1, top, '#ffffff', 3, bottom - top); px(ctx, g - 1, top, '#ffffff', 26, 3);
      px(ctx, g - 2, top - 1, OUTLINE, 1, bottom - top + 1); px(ctx, g + 2, top + 3, '#bdbdbd', 1, bottom - top - 3);
    }
  }

  drawHud(ctx) {
    const team = this.halfTeam[this.half];
    ctx.fillStyle = 'rgba(16,14,30,0.72)'; ctx.fillRect(0, 0, VIEW_W, 15);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, 15, VIEW_W, 1);
    ctx.font = '8px "Press Start 2P"'; ctx.textBaseline = 'top';
    // lives
    const maxLives = this.o.lives ?? LIVES;
    for (let i = 0; i < maxLives; i++) this.heart(ctx, 4 + i * 11, 4, i < this.lives);
    // score
    ctx.fillStyle = '#ffffff'; ctx.fillText(String(this.sim.score).padStart(5, '0'), 8 + maxLives * 11, 4);
    // clock
    const clockTxt = `${String(this.sim.matchMinute).padStart(2, ' ')}'`;
    ctx.fillStyle = this.clock < 15 && this.frame % 30 < 15 ? '#ff5252' : '#ffd23f';
    ctx.fillText(clockTxt, 168, 4);
    ctx.fillStyle = '#9aa3c7'; ctx.font = '6px "Press Start 2P"'; ctx.fillText(this.half ? '2ND' : '1ST', 200, 5);
    ctx.font = '8px "Press Start 2P"';
    // items / stickers
    ctx.drawImage(this.itemSprites[this.half], 236, 1, 14, 14);
    ctx.fillStyle = '#ffffff'; ctx.fillText(`${this.count.items[this.half]}`, 252, 4);
    ctx.drawImage(this.stickerSprites[this.half][0], 284, 1, 11, 14);
    ctx.fillText(`${this.count.stickers[this.half]}/${this.L.counts.stickers[this.half]}`, 297, 4);
    if (this.player.shield) ctx.drawImage(this.shieldSprite, 346, 1);
    ctx.fillStyle = team.kit.shirt; ctx.fillRect(362, 3, 18, 9); ctx.fillStyle = OUTLINE; ctx.strokeStyle = OUTLINE; ctx.strokeRect(361.5, 2.5, 19, 10);
    ctx.fillStyle = luma(team.kit.shirt) > 0.6 ? '#1a1222' : '#ffffff'; ctx.font = '6px "Press Start 2P"'; ctx.fillText(team.code.slice(0, 3), 363, 5);
    if (this.paused) { ctx.fillStyle = 'rgba(10,8,20,0.55)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  }
  heart(ctx, x, y, full) {
    const c = full ? '#ff4d6d' : '#4a4a5a';
    px(ctx, x + 1, y, c, 3, 2); px(ctx, x + 5, y, c, 3, 2); px(ctx, x, y + 1, c, 9, 3); px(ctx, x + 1, y + 4, c, 7, 1); px(ctx, x + 2, y + 5, c, 5, 1); px(ctx, x + 3, y + 6, c, 3, 1); px(ctx, x + 4, y + 7, c, 1, 1);
    if (full) px(ctx, x + 2, y + 1, '#ffb3c1', 1, 1);
  }

  // first frame of the level for the intro morph
  startFrame() {
    const [c, ctx] = makeCanvas(VIEW_W, VIEW_H);
    this.render(ctx);
    this.drawHud(ctx);
    return c;
  }
}

function luma(hex) { const n = parseInt(hex.slice(1), 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }
