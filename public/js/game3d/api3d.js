// API client of the 3D game. With the server: talks to /api/* (login, progress, album, bonus, leaderboard).
// Without one (single-file build, plain static server): the same rules run in this browser and the
// progress stays in localStorage – a preview without login and leaderboard.
import { makeContext, blankProgress, clientState, startLevel, finishLevel, finishBonus } from '../shared/rules.js';
import { LIVES } from '../shared/levelgen.js';

const base = (() => { try { return new URL('.', location.href).pathname; } catch { return '/'; } })();

async function call(method, path, body) {
  const res = await fetch(base + 'api/' + path, {
    method, credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null; try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) { const e = new Error(data?.error || `Error ${res.status}`); e.status = res.status; throw e; }
  return data;
}

const serverApi = {
  local: false,
  config: () => call('GET', 'config'),
  me: () => call('GET', 'me'),
  register: (nickname, email, password, invite) => call('POST', 'register', { nickname, email, password, invite }),
  login: (email, password) => call('POST', 'login', { email, password }),
  logout: () => call('POST', 'logout', {}),
  state: () => call('GET', 'state'),
  setAt: matchId => call('POST', 'at', { matchId }).catch(() => {}),
  setUnlock: on => call('POST', 'unlock', { on }),
  start: (matchId, side) => call('POST', 'run/start', { matchId, side }),
  finish: (matchId, token, result, album) => call('POST', 'run/finish', { matchId, token, result, album }),
  bonus: (key, hits) => call('POST', 'bonus/finish', { key, hits }),
  leaderboard: matchId => call('GET', 'leaderboard' + (matchId ? `?match=${matchId}` : '')),
};

// ------------------------------------------------------------------ browser-only stand-in
const KEY = 'brasili3d-progress-v1';
function makeLocalApi(data) {
  const ctx = makeContext(data);
  let ps = blankProgress(), unlockAll = false, active = {};
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) { ps = { ...ps, levels: s.levels || {}, album: s.album || {}, bonus: s.bonus || {}, at: s.at ?? null }; unlockAll = !!s.unlockAll; } } catch { /* storage unavailable */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ ...ps, unlockAll })); } catch { /* ignore */ } };
  const reply = v => Promise.resolve(v);
  const out = r => r.error ? Promise.reject(Object.assign(new Error(r.error[1]), { status: r.error[0] })) : null;
  const view = () => ({ state: clientState(ps, 'best', unlockAll), canToggleUnlock: true });
  const guest = { nickname: 'Guest', look: null, admin: false };
  return {
    local: true,
    config: () => reply({ invite: false, lives: LIVES, scoreMode: 'best', unlockAll: false }),
    me: () => reply({ user: guest }),
    logout: () => reply({ ok: true }),
    state: () => reply(view()),
    setAt: matchId => { ps.at = matchId; persist(); },
    setUnlock: on => { unlockAll = !!on; persist(); return reply(view()); },
    start: (matchId, side) => {
      const r = startLevel(ps, ctx, matchId, side, unlockAll); if (r.error) return out(r);
      const token = Math.random().toString(36).slice(2); active[matchId] = { token, started: Date.now() };
      persist(); return reply({ token, attempt: r.tries, lives: LIVES, ...view() });
    },
    finish: (matchId, token, result, album) => {
      const act = active[matchId];
      if (!act || act.token !== token) return out({ error: [409, 'This try is no longer active – a newer one was started.'] });
      const r = finishLevel(ps, ctx, matchId, result, album, null); if (r.error) return out(r);
      delete active[matchId]; persist(); return reply({ ...r, scoreMode: 'best', ...view() });
    },
    bonus: (key, hits) => { const r = finishBonus(ps, ctx, key, hits, unlockAll); if (r.error) return out(r); persist(); return reply({ ...r, ...view() }); },
    leaderboard: () => reply({ match: null, rows: [], me: null, players: 1 }),
  };
}

export async function createApi(data) {
  if (window.BRASILI_DATA) return makeLocalApi(data);
  try { await serverApi.config(); return serverApi; }
  catch { return makeLocalApi(data); }
}
