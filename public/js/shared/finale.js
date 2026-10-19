// The three finales at the end of a level – header, free kick, penalty. Pure functions,
// shared by the game core (to play them) and the server (to check a reported result).
// Units: level pixels (16 px = 1 tile), heights measured upwards from the pitch.

export const FINALES = ['header', 'freekick', 'penalty'];
export const FINALE_LABEL = { header: 'Header', freekick: 'Free kick', penalty: 'Penalty' };

// Which finale a match gets. Group stage: the 6 matches of a group run header, free kick,
// penalty, header, free kick, penalty (match numbers 1–48 follow round/group/pair order).
export function finaleKind(matchId) {
  if (matchId <= 48) {
    const round = Math.floor((matchId - 1) / 16), pair = (matchId - 1) % 2;
    return FINALES[(2 * round + pair) % 3];
  }
  if (matchId === 64) return 'header'; // the final ends like it all began
  return FINALES[(matchId - 49) % 3];
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
// triangle wave 0..1..0 for the aim and power meters
export const tri = t => { const f = t - Math.floor(t); return f < 0.5 ? f * 2 : 2 - f * 2; };

// ------------------------------------------------------------------ free kick (side view)
export const FK = {
  DIST: 200,        // ball -> goal line
  WALL: 80,         // ball -> defensive wall
  WALL_H: 26,       // top of the wall
  BAR: 44,          // highest ball centre that still goes under the bar
  KEEPER: 24,       // the keeper reaches every ball up to this height …
  BEAT_SPEED: 7.4,  // … unless it is faster than this (px per frame)
  ANGLE_MIN: 20, ANGLE_MAX: 44,
  G: 0.12,
};
export const fkAngle = meter => FK.ANGLE_MIN + clamp(meter, 0, 1) * (FK.ANGLE_MAX - FK.ANGLE_MIN);
export const fkSpeed = power => 5.4 + clamp(power, 0, 1) * 2.4;

// Full ball path for a free kick: one point per frame (dx from the ball spot, h above the pitch)
// plus the outcome. The path continues a little after the decisive moment for the animation.
export function freekickPath(angle, power) {
  const a = clamp(angle, FK.ANGLE_MIN, FK.ANGLE_MAX) * Math.PI / 180, v = fkSpeed(power);
  let x = 0, h = 4, vx = v * Math.cos(a), vy = v * Math.sin(a);
  const pts = [];
  let out = null, endAt = 0, crossed = false;
  for (let i = 0; i < 400; i++) {
    const px = x;
    x += vx; h += vy; vy -= FK.G; vx *= 0.996; vy *= 0.996;
    if (h < 4) { h = 4; vy = Math.abs(vy) * 0.45; vx *= 0.8; }
    pts.push({ x, h });
    if (!out) {
      if (px < FK.WALL + 5 && x >= FK.WALL - 5 && h < FK.WALL_H + 4) { out = { goal: false, text: 'BLOCKED BY THE WALL!', at: 'wall' }; endAt = i; vx = -Math.abs(vx) * 0.35; vy = 1.5; }
      else if (!crossed && x >= FK.DIST) {
        crossed = true; endAt = i;
        if (h > FK.BAR) out = { goal: false, text: 'OVER THE BAR!', at: 'over' };
        else if (h > FK.KEEPER || vx > FK.BEAT_SPEED) out = { goal: true, text: h > FK.KEEPER ? 'TOP CORNER!' : 'TOO HOT FOR THE KEEPER!', at: 'goal', h };
        else { out = { goal: false, text: 'SAVED!', at: 'keeper', h }; vx = 0; vy = 0; }
      } else if (vx < 0.4 && x < FK.DIST) { out = { goal: false, text: 'TOO SHORT!', at: 'short' }; endAt = i; }
    }
    if (out) {
      if (out.at === 'goal' && x > FK.DIST + 18) { vx = 0; vy = Math.min(vy, 0); } // the net stops it
      if (out.at === 'keeper') { pts[pts.length - 1] = { x: FK.DIST - 6, h: Math.max(14, Math.min(h, 34)) }; }
      if (i > endAt + 45) break;
    }
  }
  out ||= { goal: false, text: 'TOO SHORT!', at: 'short' };
  out.quality = out.goal ? Math.round((0.55 + 0.45 * clamp(power, 0, 1)) * 1000) / 1000 : Math.round(0.25 * clamp(power, 0, 1) * 1000) / 1000;
  return { pts, out, endAt };
}
export const freekickOutcome = (angle, power) => freekickPath(angle, power).out;

// ------------------------------------------------------------------ penalty (view from behind)
// aim: -1 (left post) … 1 (right post) from the shooter's view; power 0..1 sets the height.
function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return n >>> 0; }
export function penaltyOutcome(matchId, aim, power) {
  const a = clamp(aim, -1, 1), p = clamp(power, 0, 1);
  const height = 0.12 + p * 1.0;                 // share of the bar height
  const keeper = hash((matchId | 0) * 977 + Math.round(a * 40) * 31 + Math.round(p * 40)) % 3 - 1; // -1 | 0 | 1
  const quality = Math.round(Math.min(1, 0.3 + 0.45 * Math.abs(a) + 0.25 * Math.min(1, height / 0.85)) * 1000) / 1000;
  const res = (goal, text, at) => ({ goal, text, at, keeper, height, aim: a, quality: goal ? quality : Math.round(quality * 0.3 * 1000) / 1000 });
  if (height > 1) return res(false, 'OVER THE BAR!', 'over');
  if (Math.abs(a) > 0.95) return res(false, 'OFF THE POST!', 'post');
  const topCorner = Math.abs(a) > 0.6 && height > 0.7;
  const reach = 0.4 - 0.18 * Math.max(0, p - 0.45);
  if (!topCorner && Math.abs(a - keeper * 0.62) < reach) return res(false, 'SAVED!', 'keeper');
  return res(true, topCorner ? 'TOP CORNER!' : keeper === 0 ? 'CHEEKY!' : 'WRONG WAY!', 'goal');
}
