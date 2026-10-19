// BRASILI game core: rules and physics, independent of the graphics.
// Used by the 3D renderer (game3d/); the server does not run it, it re-checks results with shared/rules.js.
// Coordinates are "level pixels": 1 tile = 16, y grows downwards.
import { generateLevel, TILE, ROWS, isSolid, isOneWay, HALF_SECONDS, LIVES, RESPAWN_MIN_CLOCK } from '../shared/levelgen.js';
import { SCORE, liveScore } from '../shared/scoring.js';
import { tri, fkAngle, freekickPath, penaltyOutcome, FK } from '../shared/finale.js';
import { asciiUpper, lastName, colorDistance } from './pixel.js';

export const FIXED = 1 / 60;
export { TILE, ROWS, HALF_SECONDS, LIVES };

export function pickKits(teams, playerSide) {
  const me = teams[playerSide], opp = teams[playerSide === 'home' ? 'away' : 'home'];
  let oppKit = opp.kit;
  if (colorDistance(me.kit.shirt, opp.kit.shirt) < 110) oppKit = opp.away;
  return { me: me.kit, opp: oppKit, gk: { shirt: opp.gk, shorts: '#1f2430', socks: opp.gk } };
}
const NAME_FULL = new Set(['KOR', 'CHN', 'VIE']);
export const shortName = (p, code) => asciiUpper(NAME_FULL.has(code) ? p.name : lastName(p.name));
const clone = o => JSON.parse(JSON.stringify(o));

export class Sim {
  constructor(o) {
    this.o = o;
    this.L = generateLevel(o.match.id);
    if (o.finale) this.L.finale.kind = o.finale; // e.g. the pixel version only knows the header
    this.handlers = {};
    this.keys = {}; this.pressed = {};
    this.frame = 0; this.paused = false;
    const { teams, squads, playerSide } = o, L = this.L;
    this.side = playerSide; this.oppSide = playerSide === 'home' ? 'away' : 'home';
    this.halfTeam = [teams.home, teams.away];
    this.kits = pickKits(teams, playerSide);
    const sq = c => squads[c] || { players: [], featured: [] };
    const featured = code => { const s = sq(code); return s.featured.map(no => s.players.find(p => p.no === no)).filter(Boolean); };
    this.stickerPeople = [0, 1].map(h => featured(this.halfTeam[h].code).map(p => ({ ...p, short: shortName(p, this.halfTeam[h].code) })));
    const opp = teams[this.oppSide], oppF = featured(opp.code);
    this.keeper = { ...(oppF.find(p => p.pos === 'GK') || { name: 'Keeper', no: 1 }) };
    this.keeper.short = shortName(this.keeper, opp.code);
    const outfield = (oppF.filter(p => p.pos !== 'GK').length ? oppF.filter(p => p.pos !== 'GK') : sq(opp.code).players).map(p => ({ ...p, short: shortName(p, opp.code) }));

    this.items = L.items.map(i => ({ ...i, got: false, seg: -1 }));
    this.stickers = L.stickers.map(s => ({ ...s, got: false, seg: -1, person: this.stickerPeople[s.half][s.idx] || { short: '???', no: '', name: '?' } }));
    this.shields = L.shields.map(s => ({ ...s, got: false, seg: -1 }));
    this.springs = L.springs.map(s => ({ ...s, squash: 0 }));
    this.movers = L.movers.map(m => ({ ...m, px: m.x * TILE, dir: 1, dx: 0 }));
    this.enemyInit = L.enemies.map((e, i) => ({
      ...e, x: e.x * TILE - 5, y: e.y * TILE - 24, w: 10, h: 24, vx: (i % 2 ? -1 : 1) * e.speed, vy: 0, onGround: true,
      person: outfield[i % Math.max(1, outfield.length)] || { short: 'DEFENDER', no: 4 },
      dribbled: false, dSeg: -1, lastSide: 0, jumpT: 40 + (i * 37) % 60, anim: i * 7, dead: false, variant: i % 4,
    }));
    this.enemies = clone(this.enemyInit);
    this.bannerNames = L.banners.map((b, i) => {
      const ppl = sq(this.halfTeam[b.half].code).players;
      const p = ppl[(i * 5 + 3) % Math.max(1, ppl.length)];
      return { ...b, text: p ? `${shortName(p, this.halfTeam[b.half].code)} ${p.no}` : this.halfTeam[b.half].code };
    });

    this.count = { items: [0, 0], stickers: [0, 0], dribbles: 0, timeLeft: [0, 0] };
    this.half = 0; this.clock = HALF_SECONDS;
    this.lives = o.lives ?? LIVES;
    this.cpReached = 0;
    this.player = { x: 3 * TILE, y: L.groundTop[3] * TILE - 24, w: 10, h: 24, vx: 0, vy: 0, onGround: true, facing: 1, coyote: 0, jumpBuf: 0, shield: false, invuln: 0, anim: 0, pose: 'stand', ride: null, airT: 0 };
    this.snapshots = [this.snapshot()];
    this.finale = null;
    this.state = 'ready'; this.stateT = 0;
  }

  on(evt, fn) { (this.handlers[evt] ||= []).push(fn); return this; }
  emit(evt, data = {}) { for (const fn of this.handlers[evt] || []) fn(data); for (const fn of this.handlers['*'] || []) fn(evt, data); }
  setState(s, info) { this.state = s; this.stateT = 0; this.stateInfo = info; }
  snapshot() { return { count: clone(this.count), clock: this.clock, half: this.half, shield: this.player?.shield || false }; }
  get score() { return liveScore(this.count.items, this.count.stickers, this.count.dribbles); }
  get matchMinute() { const e = HALF_SECONDS - this.clock; return Math.min(45, Math.floor(e / HALF_SECONDS * 45)) + (this.half ? 45 : 0); }

  // ------------------------------------------------------------------ main step (1/60 s)
  step() {
    this.frame++;
    if (this.pressed.pause && ['play', 'finale', 'ready'].includes(this.state) && !(this.finale && this.finale.shot)) { this.paused = !this.paused; this.emit('pause', { paused: this.paused }); }
    if (this.paused) { this.pressed = {}; return; }
    this.stateT += FIXED;
    const L = this.L, p = this.player;
    switch (this.state) {
      case 'ready':
        this.updateWorld(false);
        if (this.stateT > 0.9) this.setState('play');
        break;
      case 'play': {
        this.clock -= FIXED;
        if (this.clock <= 0) { this.clock = 0; this.die('time'); break; }
        this.updatePlayer(); this.updateWorld(true);
        const next = L.checkpoints[this.cpReached];
        if (next && p.x > next.col * TILE) this.reachCheckpoint(next);
        else if (this.half === 1 && p.x > L.finale.start * TILE) this.startFinale();
        break;
      }
      case 'checkpoint': {
        this.updateWorld(false);
        p.vx *= 0.8; this.moveX(p, p.vx); p.pose = 'stand';
        const kind = this.stateInfo.kind;
        if (this.stateT > (kind === 'halftime' ? 1.8 : 1.0)) {
          if (kind === 'halftime') {
            this.half = 1; this.clock = HALF_SECONDS;
            if (this.o.skipSecondHalf) { // prototype: straight to the penalty area
              p.x = L.finale.start * TILE - 70; p.y = 12 * TILE - 24;
              this.cpReached = L.checkpoints.length;
            }
          }
          this.snapshots[this.cpReached] = this.snapshot();
          this.setState('play');
          this.emit('resume', { kind });
        }
        break;
      }
      case 'dying':
        p.vy += 0.3; p.y += p.vy;
        if (this.stateT > 1.5) {
          this.lives--;
          this.emit('lifelost', { lives: this.lives, reason: this.deathReason });
          if (this.lives > 0) this.respawn();
          else { this.setState('gameover'); this.emit('gameover', { reason: this.deathReason }); }
        }
        break;
      case 'finale': this.updateFinale(); break;
      case 'result':
        this.updateFinale();
        if (this.stateT > 3.0) { this.setState('done'); this.emit('finish', this.result()); }
        break;
    }
    for (const s of this.springs) s.squash = Math.max(0, s.squash - 0.08);
    this.pressed = {};
  }

  // ------------------------------------------------------------------ checkpoints, death, respawn
  reachCheckpoint(cp) {
    this.cpReached++;
    if (cp.kind === 'halftime') this.count.timeLeft[0] = this.clock;
    this.setState('checkpoint', { kind: cp.kind });
    this.emit('checkpoint', { kind: cp.kind, index: this.cpReached, col: cp.col, half: this.half });
  }
  die(reason) {
    if (['dying', 'gameover', 'result', 'done', 'checkpoint'].includes(this.state)) return;
    this.deathReason = reason;
    const p = this.player; p.pose = 'hurt'; p.vy = -5.5; p.vx = 0; p.ride = null;
    this.setState('dying');
    this.emit('death', { reason, x: p.x, y: p.y });
  }
  respawn() {
    const k = this.cpReached, s = this.snapshots[k], L = this.L;
    this.count = clone(s.count);
    this.half = s.half;
    this.clock = k === 0 ? HALF_SECONDS : Math.max(RESPAWN_MIN_CLOCK, s.clock);
    for (const list of [this.items, this.stickers, this.shields]) for (const it of list) if (it.got && it.seg >= k) { it.got = false; it.seg = -1; }
    this.enemies = this.enemyInit.map((e, i) => {
      const cur = this.enemies[i];
      const keep = cur.dribbled && cur.dSeg < k;
      return { ...clone(e), dribbled: keep, dSeg: keep ? cur.dSeg : -1 };
    });
    const col = (this.o.skipSecondHalf && k >= 2) ? L.finale.start - 5 : (k === 0 ? 3 : (L.checkpoints[k - 1].col + 1));
    const p = this.player;
    Object.assign(p, { x: col * TILE, y: L.groundTop[col] * TILE - 24, vx: 0, vy: 0, onGround: true, facing: 1, shield: s.shield, invuln: 90, pose: 'stand', ride: null, jumpBuf: 0, coyote: 0 });
    this.finale = null;
    this.setState('ready');
    this.emit('respawn', { checkpoint: k ? L.checkpoints[k - 1].kind : 'kickoff', lives: this.lives });
  }

  // ------------------------------------------------------------------ player physics
  updatePlayer() {
    const p = this.player, k = this.keys;
    const dir = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    const run = !!k.run;
    const max = run ? 2.6 : 1.6, acc = p.onGround ? (run ? 0.12 : 0.085) : 0.07;
    if (dir) {
      if (p.vx * dir < 0 && p.onGround) p.vx += dir * 0.22;
      else p.vx += dir * acc;
      if (Math.abs(p.vx) > max) p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx) - max, 0.06);
      p.facing = dir;
    } else {
      const f = p.onGround ? 0.12 : 0.025;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
    }
    if (this.pressed.jump) p.jumpBuf = 6; else if (p.jumpBuf > 0) p.jumpBuf--;
    if (p.onGround) p.coyote = 6; else if (p.coyote > 0) p.coyote--;
    if (p.jumpBuf > 0 && p.coyote > 0) {
      p.vy = -(4.9 + 0.45 * Math.min(1, Math.abs(p.vx) / 2.6));
      p.onGround = false; p.jumpBuf = 0; p.coyote = 0; p.ride = null;
      this.emit('jump', { x: p.x + 5, y: p.y + 24 });
    }
    p.vy = Math.min(6, p.vy + ((p.vy < 0 && k.jump) ? 0.22 : 0.55));
    if (p.ride) p.x += p.ride.dx;
    this.moveX(p, p.vx);
    if (this.half === 1) p.x = Math.max(p.x, this.L.checkpointCol * TILE - 6);
    p.x = Math.max(0, p.x);
    const wasGround = p.onGround, fallV = p.vy;
    this.moveY(p, p.vy, true);
    p.airT = p.onGround ? 0 : p.airT + 1;
    if (p.onGround && !wasGround) this.emit('land', { x: p.x + 5, y: p.y + 24, v: fallV });
    for (const s of this.springs) {
      const sx = s.x * TILE, top = s.y * TILE - 8;
      if (p.vy >= 0 && p.x + p.w > sx + 1 && p.x < sx + 15 && p.y + p.h >= top && p.y + p.h <= top + 10) {
        p.y = top - p.h; p.vy = k.jump ? -9.3 : -8.7; p.onGround = false; p.ride = null; s.squash = 1;
        this.emit('spring', { spring: s, x: sx + 8, y: top });
      }
    }
    if (p.invuln > 0) p.invuln--;
    p.anim += Math.abs(p.vx) * 0.11;
    if (!p.onGround) p.pose = p.vy < 0 ? 'jump' : 'fall';
    else if (Math.abs(p.vx) > 0.2) p.pose = ['run1', 'run2', 'run3', 'run4'][Math.floor(p.anim) % 4];
    else p.pose = 'stand';
    if (p.y > ROWS * TILE + 20) this.die('pit');
    this.collect();
  }
  moveX(b, dx) {
    b.x += dx;
    const top = b.y + 1, bottom = b.y + b.h - 1, L = this.L;
    if (dx > 0) {
      const tx = Math.floor((b.x + b.w) / TILE);
      for (let ty = Math.floor(top / TILE); ty <= Math.floor(bottom / TILE); ty++) if (isSolid(L.get(tx, ty))) { b.x = tx * TILE - b.w; b.vx = 0; break; }
    } else if (dx < 0) {
      const tx = Math.floor(b.x / TILE);
      for (let ty = Math.floor(top / TILE); ty <= Math.floor(bottom / TILE); ty++) if (isSolid(L.get(tx, ty))) { b.x = (tx + 1) * TILE; b.vx = 0; break; }
    }
  }
  moveY(b, dy, isPlayer) {
    const prevBottom = b.y + b.h, L = this.L;
    b.y += dy; b.onGround = false;
    const left = b.x + 1, right = b.x + b.w - 1;
    if (dy > 0) {
      const ty = Math.floor((b.y + b.h) / TILE);
      for (let tx = Math.floor(left / TILE); tx <= Math.floor(right / TILE); tx++) {
        const t = L.get(tx, ty);
        if (isSolid(t) || (isOneWay(t) && prevBottom <= ty * TILE + 1)) { b.y = ty * TILE - b.h; b.vy = 0; b.onGround = true; break; }
      }
      if (isPlayer) {
        b.ride = null;
        for (const m of this.movers) {
          const mt = m.y * TILE;
          if (right > m.px && left < m.px + m.w * TILE && prevBottom <= mt + 2 && b.y + b.h >= mt) { b.y = mt - b.h; b.vy = 0; b.onGround = true; b.ride = m; }
        }
      }
    } else if (dy < 0) {
      const ty = Math.floor(b.y / TILE);
      for (let tx = Math.floor(left / TILE); tx <= Math.floor(right / TILE); tx++) {
        if (isSolid(L.get(tx, ty))) { b.y = (ty + 1) * TILE; b.vy = 0.5; if (isPlayer) this.emit('bonk', { tx, ty }); break; }
      }
    }
  }
  collect() {
    const p = this.player, cx = p.x + p.w / 2, cy = p.y + p.h / 2, seg = this.cpReached;
    const near = (x, y, r) => Math.abs(x - cx) < p.w / 2 + r && Math.abs(y - cy) < p.h / 2 + r;
    for (const it of this.items) if (!it.got && near(it.x * TILE, it.y * TILE, 5)) {
      it.got = true; it.seg = seg; this.count.items[it.half]++;
      this.emit('item', { item: it });
    }
    for (const s of this.stickers) if (!s.got && near(s.x * TILE, s.y * TILE, 7)) {
      s.got = true; s.seg = seg; this.count.stickers[s.half]++;
      const complete = this.count.stickers[s.half] === this.L.counts.stickers[s.half];
      this.emit('sticker', { sticker: s, person: s.person, team: this.halfTeam[s.half], complete });
    }
    for (const s of this.shields) if (!s.got && near(s.x * TILE, s.y * TILE, 6)) {
      s.got = true; s.seg = seg; p.shield = true;
      this.emit('shield', { shield: s });
    }
  }

  // ------------------------------------------------------------------ defenders, platforms
  updateWorld(active) {
    const p = this.player, L = this.L;
    for (const m of this.movers) {
      const before = m.px;
      m.px += m.speed * m.dir;
      if (m.px > m.maxX * TILE) { m.px = m.maxX * TILE; m.dir = -1; }
      if (m.px < m.minX * TILE) { m.px = m.minX * TILE; m.dir = 1; }
      m.dx = m.px - before;
    }
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.abs(e.x - p.x) > 520) continue; // sleep far away
      e.anim += Math.abs(e.vx) * 0.12;
      if (e.type === 'jumper' && e.onGround && --e.jumpT <= 0) { e.vy = -4.4; e.jumpT = 95; }
      e.vy = Math.min(6, e.vy + 0.35);
      const nx = e.x + e.vx;
      const fx = Math.floor((e.vx > 0 ? nx + e.w + 1 : nx - 1) / TILE), fy = Math.floor((e.y + e.h + 2) / TILE);
      const groundAhead = isSolid(L.get(fx, fy)) || isOneWay(L.get(fx, fy));
      if ((e.onGround && !groundAhead) || nx < e.minX * TILE || nx + e.w > e.maxX * TILE) e.vx = -e.vx;
      this.moveX(e, e.vx);
      if (e.vx === 0) e.vx = ((this.frame + e.id) % 2 ? -1 : 1) * e.speed;
      this.moveY(e, e.vy, false);
      if (e.y > ROWS * TILE) e.dead = true;
      if (!active) continue;
      const side = Math.sign((p.x + p.w / 2) - (e.x + e.w / 2));
      if (!e.dribbled && e.lastSide && side && side !== e.lastSide && p.y + p.h < e.y + 6) {
        e.dribbled = true; e.dSeg = this.cpReached; this.count.dribbles++;
        this.emit('dribble', { enemy: e });
      }
      e.lastSide = side || e.lastSide;
      if (p.invuln <= 0 && p.x + p.w - 2 > e.x + 2 && p.x + 2 < e.x + e.w - 2 && p.y + p.h - 2 > e.y + 3 && p.y + 3 < e.y + e.h) {
        if (p.shield) { p.shield = false; p.invuln = 100; p.vx = -Math.sign(e.x - p.x || 1) * 3; p.vy = -3; this.emit('shieldUsed', { x: p.x, y: p.y }); }
        else this.die('tackle');
      }
    }
  }

  // ------------------------------------------------------------------ finale: cross + header
  startFinale() {
    this.count.timeLeft[1] = this.clock;
    this.setState('finale');
    const F = this.L.finale, kind = F.kind || 'header', GY = 12 * TILE;
    const f = this.finale = { kind, t: 0, ball: null, hit: false, power: 0, done: false, ballFlying: false, keeperX: F.goalX * TILE - 12, keeperPose: 'stand', goal: false };
    const p = this.player;
    if (kind === 'freekick') {
      f.spotX = F.goalX * TILE - FK.DIST; f.wallX = f.spotX + FK.WALL;
      f.phase = 'setup'; f.meter = 0; f.angle = null; f.shot = null;
      f.ball = { x: f.spotX, y: GY - 4, vx: 0, vy: 0 };
      Object.assign(p, { x: f.spotX - 30, y: GY - 24, vx: 0, vy: 0, onGround: true, facing: 1, pose: 'stand', ride: null });
    } else if (kind === 'penalty') {
      f.spotX = F.goalX * TILE - 150;
      f.phase = 'setup'; f.meter = 0; f.aim = null; f.shot = null;
      f.ball = { x: f.spotX, y: GY - 4, vx: 0, vy: 0 };
      Object.assign(p, { x: f.spotX - 30, y: GY - 24, vx: 0, vy: 0, onGround: true, facing: 1, pose: 'stand', ride: null });
    }
    this.emit('finale', { kind });
  }
  updateFinale() {
    const k = this.finale.kind;
    if (k === 'freekick') return this.updateFreekick();
    if (k === 'penalty') return this.updatePenalty();
    return this.updateHeader();
  }
  // aim -> power -> shot for free kick and penalty; jump locks a meter, auto-lock after 6 s
  meterInput(f) {
    f.pt = (f.pt || 0) + FIXED;
    const lock = this.pressed.jump || f.pt > 6;
    if (lock) f.pt = 0;
    return lock;
  }
  updateFreekick() {
    const f = this.finale, p = this.player, GY = 12 * TILE;
    f.t += FIXED;
    if (f.phase === 'setup') { if (f.t > 1.1) { f.phase = 'angle'; f.t0 = f.t; this.emit('aim', { kind: 'freekick', step: 'angle' }); } }
    else if (f.phase === 'angle') { f.meter = tri((f.t - f.t0) * 0.55); if (this.meterInput(f)) { f.angle = fkAngle(f.meter); f.phase = 'power'; f.t0 = f.t; this.emit('aim', { kind: 'freekick', step: 'power', angle: f.angle }); } }
    else if (f.phase === 'power') { f.meter = tri((f.t - f.t0) * 0.85); if (this.meterInput(f)) { f.power = f.meter; f.phase = 'runup'; f.t0 = f.t; } }
    else if (f.phase === 'runup') {
      p.x = Math.min(f.spotX - 10, p.x + 1.6); p.pose = 'run1'; p.vx = 1.6;
      if (p.x >= f.spotX - 10) {
        const path = freekickPath(f.angle, f.power);
        f.shot = { path, i: 0 }; f.hit = true; f.ballFlying = true; f.phase = 'flight'; p.pose = 'kick'; p.vx = 0;
        this.emit('shot', { kind: 'freekick', angle: f.angle, power: f.power, x: f.ball.x, y: f.ball.y });
      }
    } else if (f.phase === 'flight' || this.state === 'result') {
      const sh = f.shot, pt = sh.path.pts[Math.min(sh.i, sh.path.pts.length - 1)];
      f.ball.x = f.spotX + pt.x; f.ball.y = GY - pt.h;
      if (sh.i === sh.path.endAt && !f.done) {
        f.done = true; const o = sh.path.out;
        f.keeperPose = o.at === 'keeper' || o.at === 'goal' ? 'dive' : 'stand';
        f.wallHit = o.at === 'wall';
        this.endFinale(o.goal, o.text);
      }
      sh.i++;
      if (this.state === 'result') p.pose = f.goal ? 'cheer' : 'stand';
    }
    if (f.phase === 'flight' && f.ball.x > f.wallX - 30) f.wallJump = Math.min(1, (f.wallJump || 0) + 0.12);
    else if (f.wallJump) f.wallJump = Math.max(0, f.wallJump - 0.05);
  }
  updatePenalty() {
    const f = this.finale, p = this.player;
    f.t += FIXED;
    if (f.phase === 'setup') { if (f.t > 1.3) { f.phase = 'aim'; f.t0 = f.t; this.emit('aim', { kind: 'penalty', step: 'aim' }); } }
    else if (f.phase === 'aim') { f.meter = tri((f.t - f.t0) * 0.5); if (this.meterInput(f)) { f.aim = f.meter * 2 - 1; f.phase = 'power'; f.t0 = f.t; this.emit('aim', { kind: 'penalty', step: 'power', aim: f.aim }); } }
    else if (f.phase === 'power') { f.meter = tri((f.t - f.t0) * 0.85); if (this.meterInput(f)) { f.power = f.meter; f.phase = 'runup'; f.t0 = f.t; } }
    else if (f.phase === 'runup') {
      p.x = Math.min(f.spotX - 8, p.x + 1.5); p.pose = 'run1'; p.vx = 1.5;
      if (p.x >= f.spotX - 8) {
        const o = penaltyOutcome(this.o.match.id, f.aim, f.power);
        f.shot = { out: o, t: 0 }; f.hit = true; f.ballFlying = true; f.phase = 'flight'; p.pose = 'kick'; p.vx = 0;
        f.keeperDive = o.keeper;
        this.emit('shot', { kind: 'penalty', aim: f.aim, power: f.power, x: f.ball.x, y: f.ball.y });
      }
    } else if (f.phase === 'flight' || this.state === 'result') {
      f.shot.t += FIXED;
      if (f.shot.t >= 0.5 && !f.done) { f.done = true; f.keeperPose = 'dive'; this.endFinale(f.shot.out.goal, f.shot.out.text); }
      if (this.state === 'result') p.pose = f.goal ? 'cheer' : 'stand';
    }
  }
  updateHeader() {
    const F = this.L.finale, f = this.finale, p = this.player;
    f.t += FIXED;
    if (this.state === 'finale') { this.updatePlayer(); p.x = Math.min(p.x, F.goalX * TILE - 40); }
    else { p.vx *= 0.9; this.moveX(p, p.vx); p.vy = Math.min(6, p.vy + 0.55); this.moveY(p, p.vy, true); p.pose = f.goal ? 'cheer' : (p.onGround ? 'stand' : 'fall'); }
    const groundY = 12 * TILE;
    if (!f.ball && f.t > 0.9) {
      const tx = F.crossTargetX * TILE + 4;
      f.ball = { x: tx + 160, y: 26, vx: -160 / 150, vy: -0.4, g: (groundY - 4 - 26 + 0.4 * 150) * 2 / (150 * 150), spin: 0 };
      this.emit('cross', { x: tx + 160, y: 26, target: tx });
    }
    const b = f.ball;
    if (b && !f.done) {
      b.x += b.vx; b.vy += b.g; b.y += b.vy; b.spin += 0.3;
      if (!f.hit) {
        const touch = b.x + 4 > p.x - 1 && b.x - 4 < p.x + p.w + 1 && b.y + 4 > p.y - 2 && b.y - 4 < p.y + p.h;
        if (touch) {
          if (b.y < p.y + 12) {
            const power = Math.max(0, Math.min(1, ((groundY - 24) - p.y) / 58));
            f.hit = true; f.power = power; f.ballFlying = true;
            b.vx = 2.2 + power * 4.2; b.vy = -1.2 - power * 1.6; b.g = 0.05;
            p.pose = 'header';
            this.emit('header', { power, x: b.x, y: b.y });
          } else { f.done = true; b.vx = -1; b.vy = -2; this.endFinale(false, 'MISSED!'); }
        }
        if (b.y > groundY - 4 && !f.hit && !f.done) { f.done = true; b.vy = -1.2; b.vx = -0.4; this.endFinale(false, 'MISSED THE CROSS!'); }
      } else {
        const goalLine = F.goalX * TILE, reach = f.power >= SCORE.GOAL_POWER;
        f.keeperPose = b.x > goalLine - 90 ? 'dive' : 'stand';
        if (!reach && b.x > f.keeperX - 6) { f.done = true; b.vx = 0; b.vy = 0; b.x = f.keeperX + 2; b.y = groundY - 30; this.endFinale(false, `SAVED BY ${this.keeper.short}!`); }
        if (b.y > groundY - 4) { b.y = groundY - 4; b.vy *= -0.4; b.vx *= 0.7; if (!reach && Math.abs(b.vx) < 0.5 && !f.done) { f.done = true; this.endFinale(false, 'TOO SHORT!'); } }
        if (reach && b.x > goalLine + 6 && !f.done) { f.done = true; b.vx = 0.6; b.vy = 0; this.endFinale(true); }
      }
    } else if (b) { b.vy += 0.2; b.y = Math.min(groundY - 4, b.y + b.vy); b.x += b.vx; b.vx *= 0.96; }
  }
  endFinale(goal, text) {
    this.finale.goal = goal;
    this.setState('result');
    this.emit(goal ? 'goal' : 'miss', { text: text || (goal ? 'GOAL!' : 'MISSED!') });
  }
  result() {
    const f = this.finale || {}, r3 = v => Math.round((v || 0) * 1000) / 1000;
    const header = { kind: f.kind || 'header', hit: !!f.hit, power: r3(f.power) };
    if (f.kind === 'penalty') header.aim = r3(f.aim);
    if (f.kind === 'freekick') header.angle = r3(f.angle);
    return { items: this.count.items, stickers: this.count.stickers, dribbles: this.count.dribbles, timeLeft: this.count.timeLeft.map(t => Math.round(t * 10) / 10), header, goal: !!f.goal };
  }
}
