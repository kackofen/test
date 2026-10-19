// API client. With a server: talks to /api/*. Without one (demo build / preview):
// a local stand-in with the same rules, stored in this browser only.
import { computeScore } from './shared/scoring.js';
import { levelFacts, HALF_SECONDS, LIVES } from './shared/levelgen.js';

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
  demo: false,
  config: () => call('GET', 'config'),
  me: () => call('GET', 'me'),
  register: (nickname, email, password, invite) => call('POST', 'register', { nickname, email, password, invite }),
  login: (email, password) => call('POST', 'login', { email, password }),
  logout: () => call('POST', 'logout', {}),
  saveLook: look => call('POST', 'profile', { look }),
  levels: () => call('GET', 'levels'),
  start: (matchId, side) => call('POST', 'run/start', { matchId, side }),
  finish: (matchId, token, result) => call('POST', 'run/finish', { matchId, token, result }),
  leaderboard: matchId => call('GET', 'leaderboard' + (matchId ? `?match=${matchId}` : '')),
};

// ------------------------------------------------------------------ demo stand-in
// Same rules as the server: unlimited tries, best finished score counts.
function makeDemoApi(data) {
  const KEY = 'brasili-demo-v2';
  let st = { user: null, runs: {} };
  try { const s = localStorage.getItem(KEY); if (s) st = JSON.parse(s); } catch { /* storage unavailable */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore */ } };
  const err = (status, msg) => { const e = new Error(msg); e.status = status; throw e; };
  const playable = m => !!(data.teams[m.home]?.theme && data.teams[m.away]?.theme);
  const blank = () => ({ side: null, attempts: 0, finishes: 0, active: null, best: 0, goal: false });
  const run = id => st.runs[id] ||= blank();
  const view = r => ({ side: r.side, attempts: r.attempts, finishes: r.finishes, finished: r.finishes > 0, score: r.best, best: r.best, goal: !!r.goal });
  const facts = {};
  const F = id => facts[id] ||= levelFacts(id);
  const bots = [['Kiki', 7400, 3], ['Pelé-Fan', 6120, 2], ['Torjägerin', 5980, 2], ['Nova', 4100, 1], ['Bolzplatz', 2950, 1]];
  const delay = v => new Promise(r => setTimeout(() => r(v), 60));
  return {
    demo: true,
    config: () => delay({ now: new Date().toISOString(), unlockMode: 'all', invite: false, halfSeconds: HALF_SECONDS, lives: LIVES, scoreMode: 'best' }),
    me: () => st.user ? delay({ user: st.user }) : Promise.reject(Object.assign(new Error('Please log in.'), { status: 401 })),
    register: (nickname) => { st.user = { nickname: nickname || 'Guest', look: null, admin: false }; persist(); return delay({ user: st.user }); },
    login: (email) => { st.user = st.user || { nickname: (email || 'guest').split('@')[0], look: null, admin: false }; persist(); return delay({ user: st.user }); },
    logout: () => { st.user = null; persist(); return delay({ ok: true }); },
    saveLook: look => { st.user.look = look; persist(); return delay({ user: st.user }); },
    levels: () => delay({ now: new Date().toISOString(), unlockMode: 'all', levels: data.schedule.map(m => ({ ...m, playable: playable(m), unlocked: true, unlockAt: `${m.date}T04:00:00.000Z`, run: view(st.runs[m.id] || blank()) })) }),
    start: (matchId, side) => {
      const r = run(matchId);
      r.side ||= side; r.attempts++;
      r.active = { token: Math.random().toString(36).slice(2), started: Date.now() };
      persist();
      return delay({ token: r.active.token, attempt: r.attempts, side: r.side, lives: LIVES, best: r.best, counted: r.best, finishes: r.finishes, scoreMode: 'best' });
    },
    finish: (matchId, token, result) => {
      const r = run(matchId);
      if (r.active?.token !== token) err(409, 'This try is no longer active – a newer one was started.');
      const s = computeScore(result, F(matchId));
      const newBest = r.finishes === 0 || s.total > r.best;
      r.finishes++;
      if (newBest) { r.best = s.total; r.goal = s.goal; }
      r.active = null;
      persist();
      return delay({ score: s.total, breakdown: s.breakdown, goal: s.goal, newBest, best: r.best, counted: r.best, attempts: r.attempts, finishes: r.finishes, scoreMode: 'best' });
    },
    leaderboard: matchId => {
      const me = st.user?.nickname || 'You';
      let rows;
      if (matchId) {
        const r = st.runs[matchId];
        rows = bots.slice(0, 3).map(([n, p], i) => ({ nickname: n, points: Math.round(p / 5 + i * 37), goal: i < 2, side: i % 2 ? 'away' : 'home', attempts: 3 + i * 4 }));
        if (r && r.finishes > 0) rows.push({ nickname: me, points: r.best, goal: r.goal, side: r.side, attempts: r.attempts });
      } else {
        rows = bots.map(([n, p, g]) => ({ nickname: n, points: p, goals: g, levels: g + 1 }));
        const mine = Object.values(st.runs).filter(r => r.finishes > 0);
        if (mine.length) rows.push({ nickname: me, points: mine.reduce((s, r) => s + r.best, 0), goals: mine.filter(r => r.goal).length, levels: mine.length });
      }
      rows.sort((a, b) => b.points - a.points); rows.forEach((r, i) => { r.rank = i + 1; });
      return delay({ match: matchId || null, rows, me: rows.find(r => r.nickname === me) || null, players: rows.length });
    },
  };
}

export async function createApi(data) {
  if (window.BRASILI_DEMO) return makeDemoApi(data);
  try { await serverApi.config(); return serverApi; }
  catch { return makeDemoApi(data); }
}
