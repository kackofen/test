// Progress rules of the 3D version: worlds, unlocking, and what a finished level / bonus level
// changes in one player's progress. Pure functions – the server runs them as the authority, the
// browser runs the same ones in the server-less preview (api3d.js).
//
// Progress of one player:
//   { levels: { [matchId]: { done, best, goal, tries, side, scored, first, firstGoal, lastAt } },
//     album: { [teamCode]: [shirt numbers] }, bonus: { [key]: { best, hits, played } }, at: matchId|null }
// The client state adds `unlockAll` (test mode) – see clientState().
import { levelFacts } from './levelgen.js';
import { computeScore } from './scoring.js';

export const WORLD3D_CODES = ['ESP', 'NZL', 'NOR', 'SUI', 'PHI', 'AUS', 'IRL', 'NGA', 'CAN']; // = keys of WORLDS in game3d/themes3d.js
export const GOALWALL = { SHOTS: 6, HIT: 250, ALL: 500 };

export const blankProgress = () => ({ levels: {}, album: {}, bonus: {}, at: null });

// worlds and their levels from the schedule: Group A–H (6 matches each) and the knockout world
export function buildWorlds(data) {
  const worlds = 'ABCDEFGH'.split('').map((g, i) => {
    const matches = data.schedule.filter(m => m.stage === `Group ${g}`).sort((a, b) => a.id - b.id);
    const teams = [...new Set(matches.flatMap(m => [m.home, m.away]))];
    return { key: g, index: i, name: `Group ${g}`, title: `WORLD ${i + 1}`, matches, teams, bonus: { key: `bonus-${g}`, kind: 'goalwall', after: 2 } };
  });
  const ko = data.schedule.filter(m => m.id > 48).sort((a, b) => a.id - b.id);
  worlds.push({ key: 'KO', index: 8, name: 'Knockouts', title: 'WORLD 9', matches: ko, teams: [], bonus: null, ko: true });
  return worlds;
}
export const playable = (m, data) => WORLD3D_CODES.includes(m.home) && WORLD3D_CODES.includes(m.away) && !!data.teams[m.home] && !!data.teams[m.away];

// is level i of world w open? (progress only: the level before must be finished)
export function levelOpen(st, worlds, w, i) {
  if (st.unlockAll) return true;
  if (w === 0 && i === 0) return true;
  if (i > 0) return !!st.levels[worlds[w].matches[i - 1].id]?.done;
  const prev = worlds[w - 1]; return !!st.levels[prev.matches[prev.matches.length - 1].id]?.done;
}
// the bonus level opens after the first goal in its world
export function bonusOpen(st, world) {
  if (!world.bonus) return false;
  if (st.unlockAll) return true;
  return world.matches.some(m => st.levels[m.id]?.scored || st.levels[m.id]?.goal);
}
export const BONUS_WORLDS = 2; // the bonus level exists for the first two worlds so far
export const bonusPlayable = (st, world) => bonusOpen(st, world) && (st.unlockAll || world.index < BONUS_WORLDS);
export const albumCount = st => Object.values(st.album).reduce((s, a) => s + a.length, 0);
export const totalScore = st => Object.values(st.levels).reduce((s, l) => s + (l.best || 0), 0) + Object.values(st.bonus).reduce((s, b) => s + (b.best || 0), 0);

// ------------------------------------------------------------------ context + views
export function makeContext(data) {
  const worlds = buildWorlds(data);
  const matches = new Map(data.schedule.map(m => [m.id, m]));
  const where = new Map();
  worlds.forEach((w, wi) => w.matches.forEach((m, i) => where.set(m.id, { w: wi, i })));
  const facts = new Map();
  return { data, worlds, matches, where, facts: id => facts.get(id) || facts.set(id, levelFacts(id)).get(id) };
}

// which score counts for the leaderboard: the best finished try or the first one
export const countedOf = (lv, mode) => mode === 'first' ? { score: lv.first ?? 0, goal: !!lv.firstGoal } : { score: lv.best || 0, goal: !!lv.goal };

// what the browser gets to see (best = the counted score)
export function clientState(ps, mode, unlockAll) {
  const levels = {};
  for (const [id, lv] of Object.entries(ps.levels)) {
    const c = countedOf(lv, mode);
    levels[id] = { done: !!lv.done, best: c.score, goal: c.goal, tries: lv.tries || 0, side: lv.side || null, scored: !!lv.scored };
  }
  return { levels, album: ps.album, bonus: ps.bonus, at: ps.at, unlockAll: !!unlockAll };
}

// ------------------------------------------------------------------ actions
// each returns { error: [httpStatus, message] } or its result
export function startLevel(ps, ctx, matchId, side, unlockAll) {
  const m = ctx.matches.get(matchId);
  if (!m) return { error: [404, 'Unknown match.'] };
  if (!playable(m, ctx.data)) return { error: [403, 'This level is not built yet.'] };
  const at = ctx.where.get(matchId);
  if (!levelOpen({ ...ps, unlockAll }, ctx.worlds, at.w, at.i)) return { error: [403, 'This level is still locked – finish the one before it.'] };
  if (!['home', 'away'].includes(side)) return { error: [400, 'Choose a team.'] };
  const lv = ps.levels[matchId] ||= { done: false, best: 0, goal: false, tries: 0, side, scored: false, first: null, firstGoal: false, lastAt: null };
  lv.side = side; lv.tries++;
  return { tries: lv.tries };
}

// result: what the game reports; album: [[teamCode, shirtNo], …] of the stickers collected in this try;
// elapsed: seconds since the try was started (null = unknown)
export function finishLevel(ps, ctx, matchId, result, album, elapsed, now = Date.now()) {
  const m = ctx.matches.get(matchId), lv = ps.levels[matchId];
  if (!m || !lv) return { error: [404, 'Unknown match.'] };
  const f = ctx.facts(matchId);
  if (elapsed != null && elapsed < f.minSegmentSeconds.reduce((a, v) => a + v, 0) - 3) return { error: [400, 'Implausible time.'] };
  const s = computeScore(result || {}, f);
  const newBest = !lv.done || s.total > lv.best;
  if (lv.first == null) { lv.first = s.total; lv.firstGoal = s.goal; }
  if (newBest) { lv.best = s.total; lv.goal = s.goal; }
  if (s.goal) lv.scored = true;
  lv.done = true; lv.lastAt = now;
  // stickers: only players of the two teams, from the squad's featured list, no more than were collected
  let fresh = 0;
  [m.home, m.away].forEach((code, h) => {
    const featured = ctx.data.squads[code]?.featured || [];
    const nos = [...new Set((Array.isArray(album) ? album : []).filter(e => Array.isArray(e) && e[0] === code).map(e => +e[1]).filter(n => featured.includes(n)))].slice(0, s.clean.stickers[h]);
    const have = ps.album[code] ||= [];
    for (const n of nos) if (!have.includes(n)) { have.push(n); fresh++; }
    if (!have.length) delete ps.album[code];
  });
  return { score: s.total, breakdown: s.breakdown, goal: s.goal, kind: s.kind, newBest, fresh };
}

export function finishBonus(ps, ctx, key, hits, unlockAll) {
  const world = ctx.worlds.find(w => w.bonus?.key === key);
  if (!world) return { error: [404, 'Unknown bonus level.'] };
  if (!bonusPlayable({ ...ps, unlockAll }, world)) return { error: [403, 'This bonus level is still locked.'] };
  const n = Math.max(0, Math.min(GOALWALL.SHOTS, Math.floor(Number(hits) || 0)));
  const score = n * GOALWALL.HIT + (n === GOALWALL.SHOTS ? GOALWALL.ALL : 0);
  const b = ps.bonus[key] ||= { best: 0, hits: 0, played: false };
  const newBest = score > b.best;
  b.played = true; if (newBest) { b.best = score; b.hits = n; }
  return { score, hits: n, newBest, best: b.best };
}
