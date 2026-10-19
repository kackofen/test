// Progress on the world map, kept in this browser (localStorage) for the prototype.
// Worlds: Group A–H (6 matches each) and the knockout world (16 matches).
import { hasWorld3d } from './themes3d.js';

const KEY = 'brasili3d-progress-v1';
const blank = () => ({ v: 1, levels: {}, album: {}, bonus: {}, unlockAll: false, at: null, seenIntro: {} });

export function loadProgress() {
  let st = blank();
  try { const s = localStorage.getItem(KEY); if (s) st = { ...st, ...JSON.parse(s) }; } catch { /* storage unavailable */ }
  return st;
}
export function saveProgress(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore */ } }

// worlds and their levels from the schedule
export function buildWorlds(data) {
  const groups = 'ABCDEFGH'.split('');
  const worlds = groups.map((g, i) => {
    const matches = data.schedule.filter(m => m.stage === `Group ${g}`).sort((a, b) => a.id - b.id);
    const teams = [...new Set(matches.flatMap(m => [m.home, m.away]))];
    return { key: g, index: i, name: `Group ${g}`, title: `WORLD ${i + 1}`, matches, teams, bonus: { key: `bonus-${g}`, kind: 'goalwall', after: 2 } };
  });
  const ko = data.schedule.filter(m => m.id > 48).sort((a, b) => a.id - b.id);
  worlds.push({ key: 'KO', index: 8, name: 'Knockouts', title: 'WORLD 9', matches: ko, teams: [], bonus: null, ko: true });
  return worlds;
}
export const playable = (m, data) => hasWorld3d(m.home) && hasWorld3d(m.away) && !!data.teams[m.home] && !!data.teams[m.away];

// is level i of world w open? (pure progress: the level before must be finished)
export function levelOpen(st, worlds, w, i) {
  if (st.unlockAll) return true;
  if (w === 0 && i === 0) return true;
  if (i > 0) return !!st.levels[worlds[w].matches[i - 1].id]?.done;
  const prev = worlds[w - 1]; return !!st.levels[prev.matches[prev.matches.length - 1].id]?.done;
}
export function bonusOpen(st, world) {
  if (!world.bonus) return false;
  if (st.unlockAll) return true;
  return world.matches.some(m => st.levels[m.id]?.scored || st.levels[m.id]?.goal);
}
export function albumCount(st) { return Object.values(st.album).reduce((s, a) => s + a.length, 0); }
export function totalScore(st) { return Object.values(st.levels).reduce((s, l) => s + (l.best || 0), 0) + Object.values(st.bonus).reduce((s, b) => s + (b.best || 0), 0); }
