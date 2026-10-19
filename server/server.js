// BRASILI game server – plain Node.js (>= 20), no dependencies.
// Serves the game, handles accounts (nickname + e-mail + password), unlimited tries per
// level (3 lives each, handled in the game), the advent-calendar unlocking and the
// leaderboard (best or first finished score counts). Data lives in one JSON file.
import http from 'node:http';
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, statSync, createReadStream } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { levelFacts, HALF_SECONDS, LIVES } from '../public/js/shared/levelgen.js';
import { computeScore } from '../public/js/shared/scoring.js';

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(here, '..', 'public');
const env = (k, d) => process.env[k] ?? d;
const CFG = {
  port: +env('PORT', 8090),
  dataDir: env('DATA_DIR', join(here, '..', 'data')),
  unlockMode: env('UNLOCK_MODE', 'all'),          // all | date
  unlockTime: env('UNLOCK_TIME', '06:00'),         // local time on match day
  unlockOffset: env('UNLOCK_OFFSET', '+02:00'),    // CEST (Paris/Berlin in June/July)
  simNow: env('SIM_NOW', ''),                      // e.g. 2027-07-01T09:00:00+02:00 to test the calendar
  admins: env('ADMIN_EMAILS', '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean),
  inviteCode: env('INVITE_CODE', ''),
  boardKey: env('BOARD_KEY', ''),
  cookieSecure: env('COOKIE_SECURE', 'auto'),     // auto | 1 | 0
  frameAncestors: env('FRAME_ANCESTORS', "'self'"),
  scoreMode: env('SCORE_MODE', 'best') === 'first' ? 'first' : 'best', // best | first finished try counts
  lives: LIVES,
};
mkdirSync(CFG.dataDir, { recursive: true });

// ------------------------------------------------------------------ static data
const readJson = f => JSON.parse(readFileSync(join(PUBLIC, 'data', f), 'utf8'));
const TEAMS = readJson('teams.json');
const SCHEDULE = readJson('schedule.json');
const MATCH = new Map(SCHEDULE.map(m => [m.id, m]));
const FACTS = new Map(SCHEDULE.map(m => [m.id, { ...levelFacts(m.id), finale: 'header' }])); // the pixel version always ends with the header
const playable = m => !!(TEAMS[m.home]?.theme && TEAMS[m.away]?.theme);

// ------------------------------------------------------------------ storage
const DB_FILE = join(CFG.dataDir, 'db.json');
let db = { users: {}, sessions: {}, runs: {}, secret: crypto.randomBytes(32).toString('hex') };
if (existsSync(DB_FILE)) db = { ...db, ...JSON.parse(readFileSync(DB_FILE, 'utf8')) };
// runs from version 1 (2 lives per level) -> version 2 (unlimited tries, best score)
for (const [k, r] of Object.entries(db.runs)) {
  if (r.v === 2) continue;
  const done = !!r.finished;
  db.runs[k] = { v: 2, side: r.side || null, attempts: r.livesUsed || 0, finishes: done ? 1 : 0, active: null,
    best: done ? r.score : 0, bestGoal: done && !!r.goal, bestBreakdown: done ? r.breakdown || null : null,
    first: done ? r.score : null, firstGoal: done && !!r.goal, score: done ? r.score : 0, goal: done && !!r.goal, lastAt: r.finishedAt || null };
}
for (const r of Object.values(db.runs)) applyCounted(r); // SCORE_MODE may have changed since the last start
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    writeFileSync(tmp, JSON.stringify(db));
    renameSync(tmp, DB_FILE);
  }, 150);
}
save();

// ------------------------------------------------------------------ helpers
const now = () => CFG.simNow ? new Date(CFG.simNow) : new Date();
const unlockAt = m => new Date(`${m.date}T${CFG.unlockTime}:00${CFG.unlockOffset}`);
const isUnlocked = m => CFG.unlockMode === 'all' || now() >= unlockAt(m);
const id = (n = 16) => crypto.randomBytes(n).toString('hex');
const hashPw = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => e ? rej(e) : res(k.toString('hex'))));
const userByEmail = email => Object.values(db.users).find(u => u.email === email);
const userByNick = nick => Object.values(db.users).find(u => u.nickname.toLowerCase() === nick.toLowerCase());
const isAdmin = u => CFG.admins.includes(u.email);
const runKey = (uid, mid) => `${uid}:${mid}`;
const newRun = () => ({ v: 2, side: null, attempts: 0, finishes: 0, active: null, best: 0, bestGoal: false, bestBreakdown: null, first: null, firstGoal: false, score: 0, goal: false, lastAt: null });
const getRun = (uid, mid) => db.runs[runKey(uid, mid)] ||= newRun();
// the score that counts for the leaderboard
function applyCounted(r) {
  if (CFG.scoreMode === 'first') { r.score = r.first ?? 0; r.goal = !!r.firstGoal; }
  else { r.score = r.best; r.goal = !!r.bestGoal; }
}

const attempts = new Map(); // rate limiting for login/register
function limited(key, max = 10, windowMs = 10 * 60 * 1000) {
  const t = Date.now(), a = (attempts.get(key) || []).filter(x => t - x < windowMs);
  a.push(t); attempts.set(key, a);
  return a.length > max;
}

function send(res, code, body, headers = {}) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}
const fail = (res, code, msg) => send(res, code, { error: msg });
async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > 64 * 1024) throw new Error('too large'); chunks.push(c); }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function cookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').map(s => s.trim().split('=')).filter(x => x[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))])); }
function secure(req) { return CFG.cookieSecure === '1' || (CFG.cookieSecure === 'auto' && (req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted)); }
function setSession(req, res, uid) {
  const token = id(32);
  db.sessions[token] = { uid, created: Date.now(), seen: Date.now() };
  save();
  res.setHeader('Set-Cookie', `brasili_sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 24 * 3600}${secure(req) ? '; Secure' : ''}`);
}
function currentUser(req) {
  const t = cookies(req).brasili_sid;
  const s = t && db.sessions[t];
  if (!s) return null;
  if (Date.now() - s.seen > 3600 * 1000) { s.seen = Date.now(); save(); }
  return db.users[s.uid] || null;
}
const publicUser = u => ({ nickname: u.nickname, look: u.look || null, admin: isAdmin(u) });

const LOOK_KEYS = { hairStyle: /^(ponytail|bun|short|braids|afro)$/, hair: /^#[0-9a-f]{6}$/i, skin: /^#[0-9a-f]{6}$/i, boots: /^#[0-9a-f]{6}$/i };
function cleanLook(l = {}) {
  const out = {};
  for (const [k, re] of Object.entries(LOOK_KEYS)) if (typeof l[k] === 'string' && re.test(l[k])) out[k] = l[k];
  const n = parseInt(l.number); if (n >= 1 && n <= 99) out.number = n;
  if (l.kit && typeof l.kit === 'object') { const kit = {}; for (const k of ['shirt', 'shorts', 'socks']) if (/^#[0-9a-f]{6}$/i.test(l.kit[k] || '')) kit[k] = l.kit[k]; if (Object.keys(kit).length === 3) out.kit = kit; }
  return out;
}

function levelView(u, m) {
  const r = (u && db.runs[runKey(u.id, m.id)]) || newRun();
  return {
    ...m, playable: playable(m), unlocked: isUnlocked(m), unlockAt: unlockAt(m).toISOString(),
    run: { side: r.side, attempts: r.attempts, finishes: r.finishes, finished: r.finishes > 0, score: r.score, best: r.best, goal: !!r.goal },
  };
}

function leaderboard(matchId) {
  const rows = [];
  if (matchId) {
    for (const [k, r] of Object.entries(db.runs)) {
      const [uid, mid] = k.split(':');
      if (+mid !== matchId || !(r.finishes > 0)) continue;
      const u = db.users[uid]; if (!u) continue;
      rows.push({ nickname: u.nickname, points: r.score, goal: !!r.goal, side: r.side, attempts: r.attempts });
    }
  } else {
    const agg = {};
    for (const [k, r] of Object.entries(db.runs)) {
      const uid = k.split(':')[0]; const u = db.users[uid]; if (!u) continue;
      const a = agg[uid] ||= { nickname: u.nickname, points: 0, goals: 0, levels: 0 };
      if (r.finishes > 0) { a.points += r.score; a.goals += r.goal ? 1 : 0; a.levels++; }
    }
    rows.push(...Object.values(agg).filter(a => a.levels > 0));
  }
  rows.sort((a, b) => b.points - a.points || (b.goals || 0) - (a.goals || 0) || a.nickname.localeCompare(b.nickname));
  let rank = 0, prev = null;
  rows.forEach((r, i) => { if (r.points !== prev) rank = i + 1; r.rank = rank; prev = r.points; });
  return rows;
}

// ------------------------------------------------------------------ API
const routes = {
  'GET /api/config': async (req, res) => send(res, 200, { now: now().toISOString(), unlockMode: CFG.unlockMode, invite: !!CFG.inviteCode, halfSeconds: HALF_SECONDS, lives: CFG.lives, scoreMode: CFG.scoreMode }),

  'POST /api/register': async (req, res) => {
    if (limited('reg:' + req.socket.remoteAddress, 8)) return fail(res, 429, 'Too many attempts – try again in a few minutes.');
    const b = await readBody(req);
    const nickname = String(b.nickname || '').trim(), email = String(b.email || '').trim().toLowerCase(), password = String(b.password || '');
    if (CFG.inviteCode && b.invite !== CFG.inviteCode) return fail(res, 403, 'Invalid team code.');
    if (!/^[\p{L}\p{N} _.\-]{2,20}$/u.test(nickname)) return fail(res, 400, 'Nickname: 2–20 letters, numbers, spaces, - _ .');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 120) return fail(res, 400, 'Please enter a valid e-mail address.');
    if (password.length < 8 || password.length > 200) return fail(res, 400, 'Password: at least 8 characters.');
    if (userByEmail(email)) return fail(res, 409, 'This e-mail is already registered.');
    if (userByNick(nickname)) return fail(res, 409, 'This nickname is taken.');
    const salt = id(16), uid = id(8);
    db.users[uid] = { id: uid, nickname, email, salt, hash: await hashPw(password, salt), created: Date.now(), look: null };
    setSession(req, res, uid);
    send(res, 200, { user: publicUser(db.users[uid]) });
  },
  'POST /api/login': async (req, res) => {
    const b = await readBody(req);
    const email = String(b.email || '').trim().toLowerCase();
    if (limited('login:' + req.socket.remoteAddress + ':' + email)) return fail(res, 429, 'Too many attempts – try again in a few minutes.');
    const u = userByEmail(email);
    const hash = await hashPw(String(b.password || ''), u ? u.salt : 'x'.repeat(32));
    if (!u || !crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(u.hash, 'hex'))) return fail(res, 401, 'E-mail or password is wrong.');
    setSession(req, res, u.id);
    send(res, 200, { user: publicUser(u) });
  },
  'POST /api/logout': async (req, res) => {
    const t = cookies(req).brasili_sid; if (t) { delete db.sessions[t]; save(); }
    res.setHeader('Set-Cookie', 'brasili_sid=; Path=/; Max-Age=0');
    send(res, 200, { ok: true });
  },
  'GET /api/me': async (req, res, u) => send(res, 200, { user: publicUser(u) }),
  'POST /api/profile': async (req, res, u) => { const b = await readBody(req); u.look = cleanLook(b.look); save(); send(res, 200, { user: publicUser(u) }); },

  'GET /api/levels': async (req, res, u) => send(res, 200, { now: now().toISOString(), unlockMode: CFG.unlockMode, levels: SCHEDULE.map(m => levelView(u, m)) }),

  // a new try: always allowed once the door is open (3 lives per try are handled in the game)
  'POST /api/run/start': async (req, res, u) => {
    const b = await readBody(req);
    const m = MATCH.get(+b.matchId);
    if (!m) return fail(res, 404, 'Unknown match.');
    if (!isUnlocked(m)) return fail(res, 403, 'This level opens on match day.');
    if (!playable(m)) return fail(res, 403, 'This level is not built yet.');
    const r = getRun(u.id, m.id);
    if (!r.side) { if (!['home', 'away'].includes(b.side)) return fail(res, 400, 'Choose a team.'); r.side = b.side; }
    r.attempts++;
    r.active = { token: id(16), attempt: r.attempts, started: Date.now() };
    save();
    send(res, 200, { token: r.active.token, attempt: r.attempts, side: r.side, lives: CFG.lives, best: r.best, counted: r.score, finishes: r.finishes, scoreMode: CFG.scoreMode });
  },
  'POST /api/run/finish': async (req, res, u) => {
    const b = await readBody(req);
    const { m, r, err } = activeRun(u, b); if (err) return fail(res, err[0], err[1]);
    const f = FACTS.get(m.id), x = b.result || {};
    // a try always runs from kick-off; restarts at checkpoints only add time
    const elapsed = (Date.now() - r.active.started) / 1000;
    const minNeeded = f.minSegmentSeconds.reduce((a, v) => a + v, 0) - 3;
    if (elapsed < minNeeded) return fail(res, 400, 'Implausible time.');
    const s = computeScore({ items: x.items, stickers: x.stickers, dribbles: x.dribbles, timeLeft: x.timeLeft, header: x.header }, f);
    const newBest = r.finishes === 0 || s.total > r.best;
    r.finishes++;
    if (r.first == null) { r.first = s.total; r.firstGoal = s.goal; }
    if (newBest) { r.best = s.total; r.bestGoal = s.goal; r.bestBreakdown = s.breakdown; }
    applyCounted(r);
    r.active = null; r.lastAt = Date.now();
    save();
    send(res, 200, { score: s.total, breakdown: s.breakdown, goal: s.goal, newBest, best: r.best, counted: r.score, attempts: r.attempts, finishes: r.finishes, scoreMode: CFG.scoreMode });
  },

  'GET /api/leaderboard': async (req, res, u) => {
    const q = new URL(req.url, 'http://x').searchParams;
    const mid = q.get('match') ? +q.get('match') : null;
    const rows = leaderboard(mid);
    send(res, 200, { match: mid, rows: rows.slice(0, 300), me: rows.find(r => r.nickname === u.nickname) || null, players: Object.keys(db.users).length });
  },

  // admin
  'GET /api/admin/users': async (req, res, u) => {
    if (!isAdmin(u)) return fail(res, 403, 'Admins only.');
    const totals = Object.fromEntries(leaderboard(null).map(r => [r.nickname, r.points]));
    send(res, 200, { users: Object.values(db.users).map(x => ({ nickname: x.nickname, email: x.email, created: x.created, points: totals[x.nickname] || 0 })) });
  },
  'POST /api/admin/reset': async (req, res, u) => {
    if (!isAdmin(u)) return fail(res, 403, 'Admins only.');
    const b = await readBody(req);
    const target = b.nickname ? userByNick(String(b.nickname)) : null;
    if (b.nickname && !target) return fail(res, 404, 'Unknown nickname.');
    let n = 0;
    for (const k of Object.keys(db.runs)) {
      const [uid, mid] = k.split(':');
      if ((target && uid !== target.id) || (b.matchId && +mid !== +b.matchId)) continue;
      delete db.runs[k]; n++;
    }
    save(); send(res, 200, { reset: n });
  },
};
function activeRun(u, b) {
  const m = MATCH.get(+b.matchId);
  if (!m) return { err: [404, 'Unknown match.'] };
  const r = db.runs[runKey(u.id, m.id)];
  if (!r?.active || r.active.token !== b.token) return { err: [409, 'This try is no longer active – a newer one was started.'] };
  return { m, r };
}

// public read-only summary for the dashboard (needs ?key=BOARD_KEY when set)
function boardData() {
  const overall = leaderboard(null).slice(0, 10);
  const done = SCHEDULE.filter(m => isUnlocked(m) && playable(m)).map(m => m.id);
  const latest = done.length ? done[done.length - 1] : null;
  return { updated: new Date().toISOString(), players: Object.keys(db.users).length, overall, latest: latest ? { match: MATCH.get(latest), rows: leaderboard(latest).slice(0, 5) } : null };
}

// ------------------------------------------------------------------ static files
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
function serveStatic(req, res, path) {
  if (path === '/' || path === '') path = '/index.html';
  const file = normalize(join(PUBLIC, decodeURIComponent(path)));
  if (!file.startsWith(PUBLIC) || /\/dev-|\/devimg\//.test(file)) return send(res, 404, 'Not found');
  let st; try { st = statSync(file); } catch { return send(res, 404, 'Not found'); }
  if (st.isDirectory()) return serveStatic(req, res, path.replace(/\/?$/, '/index.html'));
  const ext = extname(file);
  const cache = ext === '.html' || ext === '.json' ? 'no-cache' : (/(fonts|img)\//.test(file) ? 'public, max-age=604800' : 'no-cache');
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': cache });
  createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  try {
    const url = new URL(req.url, 'http://x');
    const path = url.pathname;
    if (path === '/api/board') {
      if (CFG.boardKey && url.searchParams.get('key') !== CFG.boardKey) return fail(res, 403, 'Wrong key.');
      return send(res, 200, boardData(), { 'Access-Control-Allow-Origin': '*' });
    }
    if (path.startsWith('/api/')) {
      const route = routes[`${req.method} ${path}`];
      if (!route) return fail(res, 404, 'Not found');
      const open = ['GET /api/config', 'POST /api/register', 'POST /api/login', 'POST /api/logout'].includes(`${req.method} ${path}`);
      const u = currentUser(req);
      if (!open && !u) return fail(res, 401, 'Please log in.');
      if (req.method === 'POST' && req.headers['content-type']?.includes('application/json') !== true && path !== '/api/logout') return fail(res, 415, 'JSON expected.');
      return await route(req, res, u);
    }
    res.setHeader('Content-Security-Policy', `frame-ancestors ${path.startsWith('/board') ? CFG.frameAncestors : "'self'"}`);
    return serveStatic(req, res, path);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) fail(res, 500, 'Server error.');
  }
});
server.listen(CFG.port, () => console.log(`BRASILI running on :${CFG.port} (unlock mode: ${CFG.unlockMode}, data: ${CFG.dataDir})`));
