// Level builder ("Level-Baukasten"). Pure logic, no DOM: used by the browser to build
// the level and by the server to validate results (item counts, minimum times).
// Every match id always produces the same level, for every player and both team choices.
import { makeRng, hashString } from './rng.js';
import { finaleKind } from './finale.js';

export const LEVEL_VERSION = 2;
export const LIVES = 3;          // lives per attempt (attempts are unlimited)
export const RESPAWN_MIN_CLOCK = 20; // seconds left at least after a restart at a checkpoint
export const TILE = 16;
export const ROWS = 14;
export const GROUND = 12;           // default ground surface row
export const HALF_SECONDS = 90;     // real seconds per half (shown as 45 match minutes)
export const STICKERS_PER_HALF = 11;
export const RUN_SPEED = 2.6 * 60;  // px per second at full sprint

export const T = { EMPTY: 0, GROUND: 1, BLOCK: 2, LEDGE: 3, BANNER: 4 };
export const isSolid = t => t === T.GROUND || t === T.BLOCK;
export const isOneWay = t => t === T.LEDGE || t === T.BANNER;

const HALF_LEN = 182;
const MAX_COLS = 640;

export function generateLevel(matchId, version = LEVEL_VERSION) {
  const rng = makeRng(hashString(`brasili-v${version}-match-${matchId}`));
  const buf = new Uint8Array(MAX_COLS * ROWS);
  const groundTop = new Int16Array(MAX_COLS).fill(ROWS);
  const L = {
    matchId, version, rows: ROWS,
    items: [], stickers: [], springs: [], enemies: [], movers: [], shields: [], banners: [], decor: [],
    halves: [], checkpointCol: 0, finale: null,
    checkpoints: [], // cooling break 1st half, half-time, cooling break 2nd half
  };
  const set = (x, y, t) => { if (x >= 0 && x < MAX_COLS && y >= 0 && y < ROWS) buf[y * MAX_COLS + x] = t; };
  const ground = (from, to, top) => {
    for (let x = from; x < to; x++) {
      for (let y = top; y < ROWS; y++) set(x, y, T.GROUND);
      groundTop[x] = top;
    }
  };

  let c = 0, gy = GROUND;
  ground(0, 8, gy); c = 8;

  for (let half = 0; half < 2; half++) {
    const start = c, target = c + HALF_LEN;
    const item = (x, y) => L.items.push({ x, y, half });
    // four bonus routes per half carrying 3+3+3+2 stickers, at fixed fractions of the half
    const sizes = [3, 3, 3, 2];
    for (let i = sizes.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [sizes[i], sizes[j]] = [sizes[j], sizes[i]]; }
    const bonusAt = [0.13, 0.37, 0.61, 0.83].map(f => start + Math.round(f * HALF_LEN));
    let bonusIdx = 0, stickerIdx = 0, shieldPlaced = false, coolPlaced = false;
    const cooling = c0 => {
      // drinks break in the middle of the half = checkpoint
      ground(c0, c0 + 10, gy);
      L.checkpoints.push({ col: c0 + 5, kind: 'cooling', half, y: gy });
      L.decor.push({ kind: 'cooling', x: c0 + 5, y: gy, half });
      coolPlaced = true;
      return c0 + 10;
    };

    const maybeShield = (x, y) => {
      if (!shieldPlaced && (c - start) > HALF_LEN * 0.3 && rng() < 0.55) { L.shields.push({ x, y, half }); shieldPlaced = true; return true; }
      return false;
    };
    const bonus = (c0, k) => {
      // the bonus jump: a spring launches Brasili up to a banner route with player stickers
      if (gy < 11) { ground(c0, c0 + 3, gy); c0 += 3; gy = 12; }
      const n = 15;
      ground(c0, c0 + n, gy);
      L.springs.push({ x: c0 + 3, y: gy, half });
      const routeY = gy - 7;
      for (let x = c0 + 1; x < c0 + 14; x++) set(x, routeY, T.BANNER);
      const xs = k === 3 ? [c0 + 4.5, c0 + 8, c0 + 11.5] : [c0 + 5.5, c0 + 10.5];
      for (const x of xs) L.stickers.push({ x, y: routeY - 1.3, half, idx: stickerIdx++ });
      item(c0 + 3.5, gy - 3); item(c0 + 3.5, gy - 4.5);
      return c0 + n;
    };
    const CHUNKS = {
      flat(c0, d) {
        const n = rng.int(8, 12); ground(c0, c0 + n, gy);
        if (rng() < 0.7) { const h = rng.int(2, 3); for (let i = 0; i < 4; i++) item(c0 + 2 + i * 1.5, gy - h - (i === 1 || i === 2 ? 0.6 : 0)); }
        if (rng() < 0.6) L.decor.push({ kind: 'prop', x: c0 + rng.int(1, n - 2), y: gy, half });
        if (d > 0.15 && rng() < 0.55) L.enemies.push({ type: 'walker', x: c0 + n - 3, y: gy, minX: c0 + 2, maxX: c0 + n - 1, half, speed: 0.45 + d * 0.2 });
        return c0 + n;
      },
      pit(c0, d) {
        const w = Math.min(4, 2 + Math.round(d * 2 + rng() * 0.8));
        ground(c0, c0 + 3, gy);
        const after = c0 + 3 + w;
        ground(after, after + 4, gy);
        for (let i = 0; i < 3; i++) item(c0 + 2.5 + w / 2 + (i - 1) * 1.1, gy - 3.6 - (i === 1 ? 0.7 : 0));
        return after + 4;
      },
      stairs(c0) {
        const h = rng.int(2, 3), n = h * 2 + 6;
        ground(c0, c0 + n, gy);
        for (let i = 0; i < h; i++) {
          for (let y = gy - 1 - i; y < gy; y++) { set(c0 + 2 + i, y, T.BLOCK); set(c0 + 3 + h * 2 - i, y, T.BLOCK); }
        }
        for (let y = gy - h; y < gy; y++) { set(c0 + 2 + h, y, T.BLOCK); set(c0 + 3 + h, y, T.BLOCK); }
        if (!maybeShield(c0 + 3 + h, gy - h - 1)) { item(c0 + 2.5 + h, gy - h - 1.5); item(c0 + 3.5 + h, gy - h - 1.5); }
        return c0 + n;
      },
      platforms(c0, d) {
        const w = rng.int(7, 9 + Math.round(d));
        ground(c0, c0 + 2, gy);
        let x = c0 + 3, up = 2;
        while (x + 3 <= c0 + 2 + w) {
          const y = gy - up;
          for (let i = 0; i < 3; i++) set(x + i, y, T.LEDGE);
          item(x + 1.5, y - 1.5);
          x += 3 + rng.int(1, 2);
          up = up === 2 ? 3 : 2;
        }
        const after = Math.max(x, c0 + 2 + w);
        ground(after, after + 3, gy);
        return after + 3;
      },
      defenders(c0, d) {
        const n = 14; ground(c0, c0 + n, gy);
        const count = 1 + (d > 0.35 ? 1 : 0) + (d > 0.75 && rng() < 0.6 ? 1 : 0);
        for (let i = 0; i < count; i++) {
          const a = c0 + 2 + i * 4, b = Math.min(c0 + n - 2, a + 5);
          L.enemies.push({ type: 'walker', x: a + 1 + rng() * 2, y: gy, minX: a, maxX: b, half, speed: 0.45 + d * 0.25 });
        }
        if (rng() < 0.6) { for (let i = 0; i < 3; i++) item(c0 + 4 + i * 3, gy - 3); }
        return c0 + n;
      },
      ledge(c0) {
        const n = 13; ground(c0, c0 + n, gy);
        const y = gy - 4;
        for (let x = c0 + 3; x < c0 + 10; x++) set(x, y, T.LEDGE);
        set(c0 + 1, gy - 1, T.BLOCK); set(c0 + 2, gy - 1, T.BLOCK); set(c0 + 2, gy - 2, T.BLOCK);
        for (let i = 0; i < 4; i++) item(c0 + 4 + i * 1.6, y - 1.5);
        if (!maybeShield(c0 + 6.5, y - 1)) item(c0 + 6.5, y - 3);
        if (rng() < 0.6) L.enemies.push({ type: 'walker', x: c0 + 6, y: gy, minX: c0 + 4, maxX: c0 + 11, half, speed: 0.5 });
        return c0 + n;
      },
      step(c0) {
        const ny = Math.max(10, Math.min(12, gy + (rng() < 0.5 ? -1 : 1) * rng.int(1, 2)));
        ground(c0, c0 + 3, gy);
        const n = rng.int(6, 10);
        ground(c0 + 3, c0 + 3 + n, ny);
        if (ny < gy) item(c0 + 3.5, ny - 2.5);
        gy = ny;
        return c0 + 3 + n;
      },
      mover(c0) {
        const w = rng.int(8, 10);
        ground(c0, c0 + 2, gy);
        const y = gy - 1;
        L.movers.push({ x: c0 + 2, y, w: 3, minX: c0 + 2, maxX: c0 + 2 + w - 3, speed: 0.55, half });
        for (let i = 0; i < 3; i++) item(c0 + 3 + i * 2.5, y - 2);
        ground(c0 + 2 + w, c0 + 6 + w, gy);
        return c0 + 6 + w;
      },
      jumpers(c0, d) {
        const n = 13; ground(c0, c0 + n, gy);
        L.enemies.push({ type: 'jumper', x: c0 + 6, y: gy, minX: c0 + 3, maxX: c0 + 10, half, speed: 0.35 + d * 0.2 });
        if (d > 0.6) L.enemies.push({ type: 'walker', x: c0 + 10.5, y: gy, minX: c0 + 9, maxX: c0 + 12, half, speed: 0.5 });
        item(c0 + 6.5, gy - 5);
        return c0 + n;
      },
      blocks(c0) {
        const n = 12; ground(c0, c0 + n, gy);
        const y = gy - 4;
        for (let x = c0 + 3; x < c0 + 9; x++) if (x !== c0 + 5) set(x, y, T.BLOCK);
        for (let i = 0; i < 5; i++) item(c0 + 3.5 + i * 1.2, y - 1.5);
        return c0 + n;
      },
    };

    ground(c, c + 6, gy); c += 6;
    while (c < target - 16 || bonusIdx < bonusAt.length) {
      const d = Math.min(1, (c - start) / HALF_LEN);
      if (bonusIdx < bonusAt.length && (c >= bonusAt[bonusIdx] || c >= target - 16)) {
        c = bonus(c, sizes[bonusIdx++]);
        continue;
      }
      if (!coolPlaced && c >= start + HALF_LEN * 0.5) { c = cooling(c); continue; }
      const kind = rng.weighted([
        ['flat', 1.1], ['pit', 1.3 + d], ['stairs', 0.9], ['platforms', 0.8 + d], ['defenders', 2.2 + d],
        ['ledge', 1.1], ['step', 0.8], ['mover', 0.4 + d * 0.8], ['jumpers', 0.6 + d * 1.2], ['blocks', 0.9],
      ]);
      c = CHUNKS[kind](c, d);
    }
    // back to normal ground level, finish the half
    if (gy !== GROUND) { ground(c, c + 3, gy); c += 3; gy = GROUND; }
    const end = Math.max(target, c + 6);
    ground(c, end, gy); c = end;
    L.halves.push({ from: start, to: end });
    if (half === 0) {           // half-time tunnel = checkpoint
      ground(c, c + 10, gy);
      L.checkpointCol = c + 4;
      L.checkpoints.push({ col: c + 4, kind: 'halftime', half: 0, y: gy });
      c += 10;
    }
  }

  // ---- finale: the penalty area with the header
  ground(c, c + 40, GROUND);
  const f0 = c + 6;
  L.finale = { start: f0, crossTargetX: f0 + 8, goalX: f0 + 21, wallX: c + 39, kind: finaleKind(matchId) };
  for (let y = 0; y < ROWS; y++) set(c + 39, y, T.BLOCK);
  c += 40;

  // ---- trim buffers to the real width
  L.cols = c;
  L.tiles = new Uint8Array(c * ROWS);
  for (let y = 0; y < ROWS; y++) L.tiles.set(buf.subarray(y * MAX_COLS, y * MAX_COLS + c), y * c);
  L.groundTop = groundTop.slice(0, c);
  L.get = (x, y) => (y >= ROWS) ? T.EMPTY : (y < 0 ? T.EMPTY : (x < 0 || x >= c) ? T.BLOCK : L.tiles[y * c + x]);

  // ---- guarantee a fair minimum: >= 5 defenders and exactly 1 shin guard per half
  for (let half = 0; half < 2; half++) {
    const h = L.halves[half];
    let n = L.enemies.filter(e => e.half === half).length, guard = 0;
    while (n < 5 && guard++ < 200) {
      const x0 = rng.int(h.from + 14, h.to - 14);
      let ok = true;
      for (let x = x0; x < x0 + 8; x++) {
        if (L.groundTop[x] !== L.groundTop[x0] || L.groundTop[x] >= ROWS) ok = false;
        for (let y = 0; y < L.groundTop[x0]; y++) if (L.tiles[y * c + x] === T.BLOCK && y >= L.groundTop[x0] - 2) ok = false;
      }
      if (!ok) continue;
      if (L.enemies.some(e => Math.abs(e.x - x0 - 4) < 8) || L.springs.some(s => Math.abs(s.x - x0 - 4) < 6)) continue;
      if (L.checkpoints.some(cp => x0 + 8 >= cp.col - 6 && x0 <= cp.col + 6)) continue; // keep restart spots calm
      L.enemies.push({ type: 'walker', x: x0 + 4, y: L.groundTop[x0], minX: x0, maxX: x0 + 8, half, speed: 0.5 });
      n++;
    }
    if (!L.shields.some(s => s.half === half)) {
      const cands = L.items.filter(i => i.half === half && i.x > h.from + 40 && i.x < h.to - 30);
      if (cands.length) { const it = cands[Math.floor(rng() * cands.length)]; L.items.splice(L.items.indexOf(it), 1); L.shields.push({ x: it.x, y: it.y, half }); }
    }
  }
  L.enemies.forEach((e, i) => { e.id = i; });

  // ---- decoration: fan banners with player names in the background
  for (let half = 0; half < 2; half++) {
    const h = L.halves[half];
    for (let x = h.from + 10 + rng.int(0, 6); x < h.to - 8; x += rng.int(18, 26)) L.banners.push({ x, half });
  }

  L.counts = {
    items: [0, 1].map(h => L.items.filter(i => i.half === h).length),
    stickers: [0, 1].map(h => L.stickers.filter(i => i.half === h).length),
    enemies: L.enemies.length,
  };
  L.minHalfSeconds = L.halves.map(h => ((h.to - h.from) * TILE / RUN_SPEED) * 0.8);
  const marks = [3, ...L.checkpoints.map(c => c.col), L.finale.start];
  L.minSegmentSeconds = marks.slice(1).map((m, i) => ((m - marks[i]) * TILE / RUN_SPEED) * 0.8);
  return L;
}

// Compact facts the server needs (no tile data)
export function levelFacts(matchId) {
  const L = generateLevel(matchId);
  return { matchId, finale: L.finale.kind, counts: L.counts, minHalfSeconds: L.minHalfSeconds, minSegmentSeconds: L.minSegmentSeconds, version: L.version, cols: L.cols };
}
